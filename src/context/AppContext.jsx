import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  generateIdentityKeyPair,
  exportPublicKeyRaw,
  importPublicKeyRaw,
  exportPrivateKeyJwk,
  importPrivateKeyJwk,
  peerIdFromPublicKeyRaw,
  deriveSharedKey,
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes
} from "../lib/crypto.js";
import { saveIdentity, loadIdentity, upsertContact, getAllContacts, addMessage, getMessagesForPeer } from "../lib/db.js";
import * as signaling from "../lib/signalingClient.js";
import { PeerManager } from "../lib/peerManager.js";

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [identity, setIdentity] = useState(null); // { peerId, nickname, publicKeyRaw, privateKey, privateKeyJwk }

  const [screen, setScreen] = useState("entry");
  const [roomCode, setRoomCode] = useState(null);
  const [roomExpiresAt, setRoomExpiresAt] = useState(null);
  const [peers, setPeers] = useState([]); // [{peerId, nickname, publicKeyRaw}]
  const [connectionStatus, setConnectionStatus] = useState({}); // peerId -> 'connecting'|'connected'|'disconnected'
  const [activePeerId, setActivePeerId] = useState(null);
  const [messages, setMessages] = useState({}); // peerId -> [message]
  const [contacts, setContacts] = useState({}); // peerId -> {publicKeyRaw, nickname, verifiedAt}
  const [broadcasts, setBroadcasts] = useState([]);
  const [roomError, setRoomError] = useState(null);

  const [networkAvailable, setNetworkAvailable] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [battery, setBattery] = useState({ level: null, supported: false, manual: 80 });
  const [isAnchor, setIsAnchor] = useState(false);

  const peerManagerRef = useRef(null);
  const stopPollingRef = useRef(null);
  const sessionKeyCache = useRef(new Map()); // peerId -> CryptoKey
  const identityRef = useRef(null);
  const handleEnvelopeRef = useRef(null);
  const handleFileReceivedRef = useRef(null);

  // --- Identity bootstrap ---
  useEffect(() => {
    (async () => {
      let id = await loadIdentity();
      if (!id) {
        const keyPair = await generateIdentityKeyPair();
        const publicKeyRaw = await exportPublicKeyRaw(keyPair.publicKey);
        const peerId = await peerIdFromPublicKeyRaw(publicKeyRaw);
        const privateKeyJwk = await exportPrivateKeyJwk(keyPair.privateKey);
        id = { peerId, publicKeyRaw, privateKeyJwk, nickname: null };
        await saveIdentity(id);
      }
      const privateKey = await importPrivateKeyJwk(id.privateKeyJwk);
      const full = { ...id, privateKey };
      identityRef.current = full;
      setIdentity(full);
      if (!id.nickname) setNeedsOnboarding(true);

      const savedContacts = await getAllContacts();
      const contactMap = {};
      for (const c of savedContacts) contactMap[c.peerId] = c;
      setContacts(contactMap);

      setBooting(false);
    })();

    function goOnline() {
      setNetworkAvailable(true);
    }
    function goOffline() {
      setNetworkAvailable(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    if ("getBattery" in navigator) {
      navigator.getBattery().then((b) => {
        setBattery((prev) => ({ ...prev, level: Math.round(b.level * 100), supported: true }));
        b.addEventListener("levelchange", () => setBattery((prev) => ({ ...prev, level: Math.round(b.level * 100) })));
      });
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const completeOnboarding = useCallback(async (nickname) => {
    const id = identityRef.current;
    const updated = { ...id, nickname };
    await saveIdentity({ peerId: id.peerId, publicKeyRaw: id.publicKeyRaw, privateKeyJwk: id.privateKeyJwk, nickname });
    identityRef.current = updated;
    setIdentity(updated);
    setNeedsOnboarding(false);
  }, []);

  const setNickname = useCallback(async (nickname) => {
    const id = identityRef.current;
    const updated = { ...id, nickname };
    await saveIdentity({ peerId: id.peerId, publicKeyRaw: id.publicKeyRaw, privateKeyJwk: id.privateKeyJwk, nickname });
    identityRef.current = updated;
    setIdentity(updated);
  }, []);

  // --- Session key resolution (only "verified" once a contact's key is confirmed via QR) ---
  const getSessionKey = useCallback(async (peerId) => {
    if (sessionKeyCache.current.has(peerId)) {
      return { aesKey: sessionKeyCache.current.get(peerId), verified: true };
    }
    const contact = contacts[peerId];
    if (!contact) return { aesKey: null, verified: false };
    const peerPublicKey = await importPublicKeyRaw(contact.publicKeyRaw);
    const aesKey = await deriveSharedKey(identityRef.current.privateKey, peerPublicKey);
    sessionKeyCache.current.set(peerId, aesKey);
    return { aesKey, verified: true };
  }, [contacts]);

  // --- Local message helpers ---
  const appendMessage = useCallback((peerId, message) => {
    setMessages((prev) => ({ ...prev, [peerId]: [...(prev[peerId] || []), message] }));
  }, []);

  const updateMessage = useCallback((peerId, id, patch) => {
    setMessages((prev) => ({
      ...prev,
      [peerId]: (prev[peerId] || []).map((m) => (m.id === id ? { ...m, ...patch } : m))
    }));
  }, []);

  const loadHistoryFor = useCallback(async (peerId) => {
    const history = await getMessagesForPeer(peerId);
    setMessages((prev) => ({ ...prev, [peerId]: history.sort((a, b) => a.ts - b.ts) }));
  }, []);

  // --- Incoming envelope handling ---
  const handleEnvelope = useCallback(
    async (envelope) => {
      const { from, payload } = envelope;
      if (payload.type === "ack") {
        updateMessage(from, payload.ackFor, { status: "delivered" });
        return;
      }
      if (payload.type === "broadcast") {
        setBroadcasts((prev) => [{ id: envelope.id, from, text: payload.text, ts: payload.ts || Date.now() }, ...prev].slice(0, 30));
        return;
      }
      if (payload.type === "chat") {
        let text = payload.text;
        let verified = false;
        if (payload.encrypted) {
          const { aesKey, verified: v } = await getSessionKey(from);
          verified = v;
          if (aesKey) {
            try {
              text = await decryptText(aesKey, { iv: payload.iv, data: payload.data });
            } catch {
              text = "[unable to decrypt message]";
            }
          } else {
            text = "[encrypted message — exchange keys on the Profile screen to read it]";
          }
        }
        const msg = { id: envelope.id, fromMe: false, type: "text", text, ts: envelope.createdAt, status: "received", verified };
        appendMessage(from, msg);
        addMessage({ ...msg, peerId: from }).catch(() => {});
        peerManagerRef.current?.send(from, { type: "ack", ackFor: envelope.id });
        return;
      }
    },
    [appendMessage, getSessionKey, updateMessage]
  );

  const handleFileReceived = useCallback(
    async (info) => {
      const { fromPeerId, fileId, name, mime, size, iv, dataB64 } = info;
      try {
        let blobParts;
        if (iv) {
          const { aesKey } = await getSessionKey(fromPeerId);
          if (aesKey) {
            const decoded = await decryptBytes(aesKey, { iv, data: dataB64 });
            blobParts = [decoded];
          }
        }
        if (!blobParts) {
          const raw = atob(dataB64);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          blobParts = [bytes];
        }
        const blob = new Blob(blobParts, { type: mime });
        const url = URL.createObjectURL(blob);
        appendMessage(fromPeerId, {
          id: fileId,
          fromMe: false,
          type: "file",
          ts: Date.now(),
          status: "received",
          fileMeta: { name, size, mime, url, progress: 100 }
        });
      } catch (err) {
        console.warn("Failed to assemble received file", err);
      }
    },
    [appendMessage, getSessionKey]
  );

  useEffect(() => {
    handleEnvelopeRef.current = handleEnvelope;
  }, [handleEnvelope]);

  useEffect(() => {
    handleFileReceivedRef.current = handleFileReceived;
  }, [handleFileReceived]);

  // --- Room lifecycle ---
  const wireUpRoom = useCallback(
    (code, expiresAt, initialPeers) => {
      setRoomCode(code);
      setRoomExpiresAt(expiresAt);
      setPeers(initialPeers.filter((p) => p.peerId !== identityRef.current.peerId));

      const pm = new PeerManager(identityRef.current.peerId, {
        sendSignal: ({ to, type, payload }) => signaling.sendSignal({ code, from: identityRef.current.peerId, to, type, payload }),
        onPeerStatus: (peerId, status) => setConnectionStatus((prev) => ({ ...prev, [peerId]: status })),
        onEnvelope: (envelope) => handleEnvelopeRef.current?.(envelope),
        onFileMeta: ({ fromPeerId, fileId, name, size, mime }) =>
          appendMessage(fromPeerId, { id: fileId, fromMe: false, type: "file", ts: Date.now(), status: "receiving", fileMeta: { name, size, mime, progress: 0 } }),
        onFileProgress: ({ fileId, fromPeerId, completed, total }) =>
          updateMessage(fromPeerId, fileId, { fileMeta: { progress: Math.round((completed / total) * 100) } }),
        onFileReceived: (info) => handleFileReceivedRef.current?.(info)
      });
      peerManagerRef.current = pm;

      const stop = signaling.startPolling({
        code,
        peerId: identityRef.current.peerId,
        onPeers: (list, exp) => {
          if (!list) return;
          const others = list.filter((p) => p.peerId !== identityRef.current.peerId);
          setPeers(others);
          if (exp) setRoomExpiresAt(exp);
          for (const p of others) {
            if (!pm.connections.has(p.peerId) && identityRef.current.peerId < p.peerId) {
              pm.connectTo(p.peerId);
            }
          }
        },
        onSignals: (msgs) => {
          for (const m of msgs) pm.handleSignal(m.from, m.type, m.payload);
        }
      });
      stopPollingRef.current = stop;
      setScreen("radar");
    },
    [appendMessage, updateMessage]
  );

  const createAndEnterRoom = useCallback(async () => {
    setRoomError(null);
    try {
      const { code, expiresAt } = await signaling.createRoom();
      const { peers: initialPeers } = await signaling.joinRoom({
        code,
        peerId: identityRef.current.peerId,
        nickname: identityRef.current.nickname,
        publicKey: identityRef.current.publicKeyRaw
      });
      wireUpRoom(code, expiresAt, initialPeers);
    } catch (err) {
      setRoomError(err.message);
    }
  }, [wireUpRoom]);

  const joinRoomWithCode = useCallback(
    async (code) => {
      setRoomError(null);
      try {
        const { peers: initialPeers, expiresAt } = await signaling.joinRoom({
          code,
          peerId: identityRef.current.peerId,
          nickname: identityRef.current.nickname,
          publicKey: identityRef.current.publicKeyRaw
        });
        wireUpRoom(code, expiresAt, initialPeers);
      } catch (err) {
        setRoomError(err.message);
      }
    },
    [wireUpRoom]
  );

  const leaveRoom = useCallback(() => {
    stopPollingRef.current?.();
    peerManagerRef.current?.destroy();
    if (roomCode && identityRef.current) {
      signaling.leaveRoom({ code: roomCode, peerId: identityRef.current.peerId }).catch(() => {});
    }
    peerManagerRef.current = null;
    stopPollingRef.current = null;
    setRoomCode(null);
    setRoomExpiresAt(null);
    setPeers([]);
    setConnectionStatus({});
    setActivePeerId(null);
    setBroadcasts([]);
    setScreen("entry");
  }, [roomCode]);

  // --- Messaging actions ---
  const sendMessage = useCallback(
    async (peerId, text) => {
      const { aesKey, verified } = await getSessionKey(peerId);
      let payload;
      if (verified && aesKey) {
        const enc = await encryptText(aesKey, text);
        payload = { type: "chat", encrypted: true, iv: enc.iv, data: enc.data };
      } else {
        payload = { type: "chat", encrypted: false, text };
      }
      const id = peerManagerRef.current.send(peerId, payload);
      const msg = { id, fromMe: true, type: "text", text, ts: Date.now(), status: "sent", verified };
      appendMessage(peerId, msg);
      addMessage({ ...msg, peerId }).catch(() => {});
    },
    [appendMessage, getSessionKey]
  );

  const sendFile = useCallback(
    async (peerId, file) => {
      const { aesKey, verified } = await getSessionKey(peerId);
      const fileId = crypto.randomUUID();
      const buf = await file.arrayBuffer();
      let iv = null;
      let dataB64;
      if (verified && aesKey) {
        const enc = await encryptBytes(aesKey, new Uint8Array(buf));
        iv = enc.iv;
        dataB64 = enc.data;
      } else {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        dataB64 = btoa(binary);
      }
      const url = URL.createObjectURL(file);
      appendMessage(peerId, { id: fileId, fromMe: true, type: "file", ts: Date.now(), status: "sent", fileMeta: { name: file.name, size: file.size, mime: file.type, url, progress: 0 } });
      await peerManagerRef.current.sendEncryptedFile(
        peerId,
        { fileId, name: file.name, mime: file.type, size: file.size, iv, dataB64 },
        (sent, total) => updateMessage(peerId, fileId, { fileMeta: { name: file.name, size: file.size, mime: file.type, url, progress: Math.round((sent / total) * 100) } })
      );
    },
    [appendMessage, getSessionKey, updateMessage]
  );

  const broadcastEmergency = useCallback(
    (text) => {
      peerManagerRef.current?.broadcast({ type: "broadcast", text, ts: Date.now() });
      setBroadcasts((prev) => [{ id: crypto.randomUUID(), from: identityRef.current.peerId, text, ts: Date.now(), self: true }, ...prev].slice(0, 30));
    },
    []
  );

  // --- Contacts / QR key exchange ---
  const addContactFromScan = useCallback(async (scanned) => {
    const data = typeof scanned === "string" ? JSON.parse(scanned) : scanned;
    if (!data?.peerId || !data?.publicKey) throw new Error("That QR code isn't a NearNet key.");
    const record = { peerId: data.peerId, publicKeyRaw: data.publicKey, nickname: data.nickname || "Unknown", verifiedAt: Date.now() };
    await upsertContact(record);
    sessionKeyCache.current.delete(data.peerId);
    setContacts((prev) => ({ ...prev, [data.peerId]: record }));
    return record;
  }, []);

  const openChat = useCallback(
    (peerId) => {
      setActivePeerId(peerId);
      loadHistoryFor(peerId);
      setScreen("chat");
    },
    [loadHistoryFor]
  );

  const value = {
    booting,
    needsOnboarding,
    identity,
    completeOnboarding,
    setNickname,
    screen,
    setScreen,
    roomCode,
    roomExpiresAt,
    roomError,
    peers,
    connectionStatus,
    activePeerId,
    openChat,
    messages,
    contacts,
    broadcasts,
    createAndEnterRoom,
    joinRoomWithCode,
    leaveRoom,
    sendMessage,
    sendFile,
    broadcastEmergency,
    addContactFromScan,
    networkAvailable,
    battery,
    setBattery,
    isAnchor,
    setIsAnchor
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
