import { redis, roomKey, peersKey, STALE_PEER_SECONDS } from "../_lib/redis.js";
import { isValidRoomCode } from "../_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const code = String(req.query.code || "").toUpperCase();
  if (!isValidRoomCode(code)) {
    res.status(400).json({ error: "Invalid room code." });
    return;
  }

  const roomRaw = await redis.get(roomKey(code));
  if (!roomRaw) {
    res.status(404).json({ error: "Room not found or it has expired." });
    return;
  }
  const room = typeof roomRaw === "string" ? JSON.parse(roomRaw) : roomRaw;

  const all = (await redis.hgetall(peersKey(code))) || {};
  const now = Date.now();
  const peers = Object.entries(all)
    .map(([id, raw]) => {
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { peerId: id, nickname: v.nickname, publicKey: v.publicKey, lastSeen: v.lastSeen };
    })
    .filter((p) => now - p.lastSeen < STALE_PEER_SECONDS * 1000)
    .map(({ peerId, nickname, publicKey }) => ({ peerId, nickname, publicKey }));

  res.status(200).json({ peers, expiresAt: room.expiresAt });
}
