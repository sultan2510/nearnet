import { redis, peersKey } from "./_lib/redis.js";
import { isValidRoomCode, isValidPeerId } from "./_lib/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, peerId } = req.body || {};
  const normalizedCode = (code || "").toUpperCase();
  if (!isValidRoomCode(normalizedCode) || !isValidPeerId(peerId)) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  const key = peersKey(normalizedCode);
  const raw = await redis.hget(key, peerId);
  if (!raw) {
    res.status(404).json({ error: "Peer not found in room \u2014 you may need to rejoin." });
    return;
  }
  const v = typeof raw === "string" ? JSON.parse(raw) : raw;
  v.lastSeen = Date.now();
  await redis.hset(key, { [peerId]: JSON.stringify(v) });

  res.status(200).json({ ok: true });
}
