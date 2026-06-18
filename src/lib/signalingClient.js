// Thin REST client around the Vercel serverless signaling functions.
// The signaling server only ever sees: room codes, peer IDs, public keys,
// and opaque SDP/ICE blobs needed to establish a direct WebRTC connection.
// Once two peers are connected, all chat/file data flows device-to-device
// and never touches this API again.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json();
}

export async function createRoom() {
  return request("/room/create", { method: "POST" });
}

export async function joinRoom({ code, peerId, nickname, publicKey }) {
  return request("/room/join", {
    method: "POST",
    body: JSON.stringify({ code, peerId, nickname, publicKey })
  });
}

export async function leaveRoom({ code, peerId }) {
  return request("/room/leave", {
    method: "POST",
    body: JSON.stringify({ code, peerId })
  });
}

export async function listPeers({ code }) {
  return request(`/room/peers?code=${encodeURIComponent(code)}`, { method: "GET" });
}

export async function heartbeat({ code, peerId }) {
  return request("/heartbeat", {
    method: "POST",
    body: JSON.stringify({ code, peerId })
  });
}

export async function sendSignal({ code, from, to, type, payload }) {
  return request("/signal", {
    method: "POST",
    body: JSON.stringify({ code, from, to, type, payload })
  });
}

export async function pollSignal({ code, peerId }) {
  return request(`/signal?code=${encodeURIComponent(code)}&peerId=${encodeURIComponent(peerId)}`, {
    method: "GET"
  });
}

// Starts two polling loops: one for new peers in the room, one for
// signaling messages addressed to us. Returns a stop() function.
export function startPolling({ code, peerId, onPeers, onSignals, intervalMs = 1500, heartbeatMs = 10000 }) {
  let stopped = false;

  async function peerLoop() {
    while (!stopped) {
      try {
        const { peers, expiresAt } = await listPeers({ code });
        onPeers(peers, expiresAt);
      } catch (err) {
        onPeers(null, null, err);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async function signalLoop() {
    while (!stopped) {
      try {
        const { messages } = await pollSignal({ code, peerId });
        if (messages?.length) onSignals(messages);
      } catch {
        // transient network errors are expected on flaky local networks; keep polling
      }
      await new Promise((r) => setTimeout(r, 900));
    }
  }

  async function heartbeatLoop() {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, heartbeatMs));
      if (stopped) break;
      heartbeat({ code, peerId }).catch(() => {});
    }
  }

  peerLoop();
  signalLoop();
  heartbeatLoop();

  return function stop() {
    stopped = true;
  };
}
