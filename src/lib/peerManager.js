// Manages all WebRTC peer connections for the current room.
// - Establishes direct RTCPeerConnections via manual SDP/ICE signaling
//   (the signaling server only relays opaque offer/answer/ice blobs).
// - Routes chat envelopes: sends directly if connected, otherwise floods
//   through connected peers with a hop limit (TTL) and a 60s message
//   lifetime, deduplicating by message id to prevent loops.
// - Handles direct-only chunked file transfer (files never relay through mesh).
//
// This module is crypto-agnostic: it moves already-encrypted payloads.
// Encryption/decryption happens one layer up, in AppContext.

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free TURN fallback (Open Relay Project) for when peers can't reach each
  // other directly (different networks/restrictive NATs). Same-Wi-Fi/hotspot
  // connections — NearNet's main use case — work fine on STUN alone.
  // These are shared public demo credentials with modest rate limits; swap
  // in your own TURN provider (e.g. metered.ca, Twilio) for heavier use.
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
];
const MAX_HOPS = 3;
const MESSAGE_TTL_MS = 60000;
const FILE_CHUNK_CHARS = 16000;
const BUFFERED_AMOUNT_LIMIT = 262144;

export class PeerManager {
  constructor(myPeerId, { sendSignal, onPeerStatus, onEnvelope, onFileMeta, onFileProgress, onFileReceived }) {
    this.myPeerId = myPeerId;
    this.sendSignal = sendSignal;
    this.onPeerStatus = onPeerStatus || (() => {});
    this.onEnvelope = onEnvelope || (() => {});
    this.onFileMeta = onFileMeta || (() => {});
    this.onFileProgress = onFileProgress || (() => {});
    this.onFileReceived = onFileReceived || (() => {});

    this.connections = new Map(); // peerId -> { pc, channel, status, pendingIce }
    this.seen = new Map(); // messageId -> timestamp
    this.incomingFiles = new Map(); // fileId -> { name, mime, size, iv, totalChunks, chunks }
    this.pendingOutbound = new Map(); // peerId -> queued JSON strings

    this._cleanupTimer = setInterval(() => this._cleanupSeen(), 15000);
  }

  destroy() {
    clearInterval(this._cleanupTimer);
    for (const [, conn] of this.connections) {
      try {
        conn.channel?.close();
        conn.pc?.close();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
  }

  isConnected(peerId) {
    return this.connections.get(peerId)?.status === "connected";
  }

  connectedPeerIds() {
    return [...this.connections.entries()].filter(([, c]) => c.status === "connected").map(([id]) => id);
  }

  // Call when we discover a peer and decide WE should initiate (deterministic
  // tie-break: the caller decides who initiates, e.g. by comparing peer IDs).
  async connectTo(peerId) {
    if (this.connections.has(peerId)) return;
    const conn = this._createConnection(peerId, true);
    const channel = conn.pc.createDataChannel("nearnet");
    this._bindChannel(peerId, channel);
    conn.channel = channel;
    try {
      const offer = await conn.pc.createOffer();
      await conn.pc.setLocalDescription(offer);
      this.sendSignal({ to: peerId, type: "offer", payload: offer });
    } catch (err) {
      console.warn("Failed to create offer for", peerId, err);
    }
  }

  async handleSignal(fromPeerId, type, payload) {
    let conn = this.connections.get(fromPeerId);
    if (!conn && type === "offer") {
      conn = this._createConnection(fromPeerId, false);
    }
    if (!conn) return;

    if (type === "offer") {
      await conn.pc.setRemoteDescription(payload);
      await this._flushPendingIce(conn);
      const answer = await conn.pc.createAnswer();
      await conn.pc.setLocalDescription(answer);
      this.sendSignal({ to: fromPeerId, type: "answer", payload: answer });
    } else if (type === "answer") {
      await conn.pc.setRemoteDescription(payload);
      await this._flushPendingIce(conn);
    } else if (type === "ice") {
      if (conn.pc.remoteDescription && conn.pc.remoteDescription.type) {
        try {
          await conn.pc.addIceCandidate(payload);
        } catch (err) {
          console.warn("ICE candidate error", err);
        }
      } else {
        conn.pendingIce.push(payload);
      }
    }
  }

  disconnectPeer(peerId) {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    try {
      conn.channel?.close();
      conn.pc?.close();
    } catch {
      // ignore
    }
    this.connections.delete(peerId);
    this.onPeerStatus(peerId, "disconnected");
  }

  // --- Chat envelope routing (direct, or hop-limited mesh flood) ---
  send(toPeerId, payload) {
    const envelope = {
      id: crypto.randomUUID(),
      to: toPeerId,
      from: this.myPeerId,
      ttl: MAX_HOPS,
      createdAt: Date.now(),
      payload
    };
    this._deliverOrForward(envelope, null);
    return envelope.id;
  }

  broadcast(payload) {
    for (const peerId of this.connectedPeerIds()) {
      this.send(peerId, payload);
    }
  }

  _deliverOrForward(envelope, excludePeerId) {
    if (envelope.to === this.myPeerId) {
      this.onEnvelope(envelope);
      return;
    }
    if (this.seen.has(envelope.id)) return;
    if (Date.now() - envelope.createdAt > MESSAGE_TTL_MS) return;

    const direct = this.connections.get(envelope.to);
    if (direct?.channel?.readyState === "open") {
      this.seen.set(envelope.id, Date.now());
      this._sendFrame(direct.channel, { kind: "relay", envelope });
      return;
    }

    if (envelope.ttl <= 0) return;
    this.seen.set(envelope.id, Date.now());
    const next = { ...envelope, ttl: envelope.ttl - 1 };
    for (const [peerId, conn] of this.connections) {
      if (peerId === excludePeerId) continue;
      if (conn.channel?.readyState === "open") {
        this._sendFrame(conn.channel, { kind: "relay", envelope: next });
      }
    }
  }

  _cleanupSeen() {
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    for (const [id, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(id);
    }
  }

  // --- Direct-only file transfer ---
  async sendEncryptedFile(peerId, fileInfo, onProgress) {
    const conn = this.connections.get(peerId);
    if (conn?.channel?.readyState !== "open") {
      throw new Error("No direct connection to this peer — file transfer requires a direct link.");
    }
    const { fileId, name, mime, size, iv, dataB64 } = fileInfo;
    const totalChunks = Math.ceil(dataB64.length / FILE_CHUNK_CHARS) || 1;
    this._sendFrame(conn.channel, { kind: "file-meta", fileId, name, mime, size, iv, totalChunks, from: this.myPeerId });

    for (let i = 0; i < totalChunks; i++) {
      const chunk = dataB64.slice(i * FILE_CHUNK_CHARS, (i + 1) * FILE_CHUNK_CHARS);
      await this._waitForBufferSpace(conn.channel);
      this._sendFrame(conn.channel, { kind: "file-chunk", fileId, index: i, data: chunk });
      onProgress?.(i + 1, totalChunks);
    }
    this._sendFrame(conn.channel, { kind: "file-done", fileId });
  }

  async _waitForBufferSpace(channel) {
    while (channel.bufferedAmount > BUFFERED_AMOUNT_LIMIT) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  // --- Internal connection plumbing ---
  _createConnection(peerId, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const conn = { pc, channel: null, status: "connecting", pendingIce: [] };
    this.connections.set(peerId, conn);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal({ to: peerId, type: "ice", payload: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        conn.status = "disconnected";
        this.onPeerStatus(peerId, "disconnected");
      }
    };
    if (!isInitiator) {
      pc.ondatachannel = (e) => {
        conn.channel = e.channel;
        this._bindChannel(peerId, e.channel);
      };
    }
    return conn;
  }

  async _flushPendingIce(conn) {
    const queued = conn.pendingIce.splice(0);
    for (const candidate of queued) {
      try {
        await conn.pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("Failed flushing ICE candidate", err);
      }
    }
  }

  _bindChannel(peerId, channel) {
    channel.onopen = () => {
      const conn = this.connections.get(peerId);
      if (conn) conn.status = "connected";
      this.onPeerStatus(peerId, "connected");
    };
    channel.onclose = () => {
      const conn = this.connections.get(peerId);
      if (conn) conn.status = "disconnected";
      this.onPeerStatus(peerId, "disconnected");
    };
    channel.onerror = (e) => console.warn("Data channel error with", peerId, e);
    channel.onmessage = (e) => this._onChannelMessage(peerId, e.data);
  }

  _sendFrame(channel, obj) {
    try {
      channel.send(JSON.stringify(obj));
    } catch (err) {
      console.warn("Failed to send frame", err);
    }
  }

  _onChannelMessage(fromPeerId, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.kind === "relay") {
      this._deliverOrForward(msg.envelope, fromPeerId);
    } else if (msg.kind === "file-meta") {
      this.incomingFiles.set(msg.fileId, {
        name: msg.name,
        mime: msg.mime,
        size: msg.size,
        iv: msg.iv,
        totalChunks: msg.totalChunks,
        chunks: new Array(msg.totalChunks),
        fromPeerId
      });
      this.onFileMeta({ fromPeerId, fileId: msg.fileId, name: msg.name, size: msg.size, mime: msg.mime });
    } else if (msg.kind === "file-chunk") {
      const record = this.incomingFiles.get(msg.fileId);
      if (!record) return;
      record.chunks[msg.index] = msg.data;
      const completed = record.chunks.filter(Boolean).length;
      this.onFileProgress({ fileId: msg.fileId, fromPeerId, completed, total: record.totalChunks });
    } else if (msg.kind === "file-done") {
      const record = this.incomingFiles.get(msg.fileId);
      if (!record) return;
      const dataB64 = record.chunks.join("");
      this.onFileReceived({
        fromPeerId,
        fileId: msg.fileId,
        name: record.name,
        mime: record.mime,
        size: record.size,
        iv: record.iv,
        dataB64
      });
      this.incomingFiles.delete(msg.fileId);
    }
  }
}
