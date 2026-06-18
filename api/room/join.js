import { redis, roomKey, peersKey, ROOM_TTL_SECONDS } from "../_lib/redis.js";
import { isValidRoomCode, isValidPeerId, isSafeNickname } from "../_lib/validate.js";
import { checkRateLimit, clientIp } from "../_lib/rateLimit.js";

const MAX_PEERS = 50;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, peerId, nickname, publicKey } = req.body || {};
  const normalizedCode = (code || "").toUpperCase();

  if (!isValidRoomCode(normalizedCode) || !isValidPeerId(peerId) || !isSafeNickname(nickname) || typeof publicKey !== "string") {
    res.status(400).json({ error: "Invalid join request." });
    return;
  }

  const ip = clientIp(req);
  const ok = await checkRateLimit(`nn:rate:join:${ip}`, 30, 60);
  if (!ok) {
    res.status(429).json({ error: "Too many join attempts. Slow down a moment." });
    return;
  }

  const roomRaw = await redis.get(roomKey(normalizedCode));
  if (!roomRaw) {
    res.status(404).json({ error: "Room not found or it has expired." });
    return;
  }
  const room = typeof roomRaw === "string" ? JSON.parse(roomRaw) : roomRaw;

  const pKey = peersKey(normalizedCode);
  const existingPeers = (await redis.hgetall(pKey)) || {};
  const peerEntries = Object.entries(existingPeers);

  if (!existingPeers[peerId] && peerEntries.length >= MAX_PEERS) {
    res.status(403).json({ error: "This room is full." });
    return;
  }

  const now = Date.now();
  await redis.hset(pKey, { [peerId]: JSON.stringify({ nickname, publicKey, lastSeen: now }) });
  const remainingTtl = Math.max(1, Math.round((room.expiresAt - now) / 1000));
  await redis.expire(pKey, remainingTtl);

  const others = peerEntries
    .filter(([id]) => id !== peerId)
    .map(([id, raw]) => {
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { peerId: id, nickname: v.nickname, publicKey: v.publicKey };
    });

  res.status(200).json({ peers: others, expiresAt: room.expiresAt });
}
