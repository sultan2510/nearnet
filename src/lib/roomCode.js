// 6-character room codes using only unambiguous characters (no 0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode() {
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function isValidRoomCode(code) {
  if (typeof code !== "string") return false;
  const c = code.trim().toUpperCase();
  if (c.length !== 6) return false;
  for (const ch of c) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function normalizeRoomCode(code) {
  return (code || "").trim().toUpperCase();
}
