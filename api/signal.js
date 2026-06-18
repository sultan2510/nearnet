import { redis, inboxKey, SIGNAL_TTL_SECONDS } from "./_lib/redis.js";
import { isValidRoomCode, isValidPeerId } from "./_lib/validate.js";

const VALID_TYPES = new Set(["offer", "answer", "ice"]);

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { code, from, to, type, payload } = req.body || {};
    const normalizedCode = (code || "").toUpperCase();
    if (!isValidRoomCode(normalizedCode) || !isValidPeerId(from) || !isValidPeerId(to) || !VALID_TYPES.has(type) || !payload) {
      res.status(400).json({ error: "Invalid signal." });
      return;
    }
    const key = inboxKey(normalizedCode, to);
    await redis.rpush(key, JSON.stringify({ from, type, payload, ts: Date.now() }));
    await redis.expire(key, SIGNAL_TTL_SECONDS);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "GET") {
    const code = String(req.query.code || "").toUpperCase();
    const peerId = String(req.query.peerId || "");
    if (!isValidRoomCode(code) || !isValidPeerId(peerId)) {
      res.status(400).json({ error: "Invalid request." });
      return;
    }
    const key = inboxKey(code, peerId);
    const messages = await redis.lrange(key, 0, -1);
    if (messages?.length) await redis.del(key);
    const parsed = (messages || []).map((m) => (typeof m === "string" ? JSON.parse(m) : m));
    res.status(200).json({ messages: parsed });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
