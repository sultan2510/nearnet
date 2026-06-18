const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isValidRoomCode(code) {
  if (typeof code !== "string") return false;
  const c = code.trim().toUpperCase();
  if (c.length !== 6) return false;
  for (const ch of c) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function generateRoomCode() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function isValidPeerId(id) {
  return typeof id === "string" && /^[0-9A-F]{16}$/.test(id);
}

export function isSafeNickname(name) {
  return typeof name === "string" && name.length > 0 && name.length <= 24;
}
