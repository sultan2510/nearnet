import { redis, roomKey, ROOM_TTL_SECONDS } from "../_lib/redis.js";
import { generateRoomCode } from "../_lib/validate.js";
import { checkRateLimit, clientIp } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip = clientIp(req);
  const ok = await checkRateLimit(`nn:rate:create:${ip}`, 10, 60);
  if (!ok) {
    res.status(429).json({ error: "Too many rooms created. Try again in a minute." });
    return;
  }

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const exists = await redis.exists(roomKey(candidate));
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    res.status(500).json({ error: "Could not allocate a room code, please try again." });
    return;
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + ROOM_TTL_SECONDS * 1000;
  await redis.set(roomKey(code), JSON.stringify({ createdAt, expiresAt }), { ex: ROOM_TTL_SECONDS });

  res.status(200).json({ code, expiresAt });
}
