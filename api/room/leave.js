import { redis, peersKey } from "../_lib/redis.js";
import { isValidRoomCode, isValidPeerId } from "../_lib/validate.js";

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

  await redis.hdel(peersKey(normalizedCode), peerId);
  res.status(200).json({ ok: true });
}
