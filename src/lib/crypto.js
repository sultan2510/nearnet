// All cryptography here uses the browser's native Web Crypto API.
// No third-party crypto libraries — matches the security model in the spec.
//
// Identity: each device generates one ECDH P-256 key pair on first launch.
// Peer ID: SHA-256 hash of the raw public key, truncated to 16 hex chars.
// Session key: ECDH-derived shared secret -> AES-GCM 256 key, per contact.
// Every message gets a fresh random 12-byte IV (never reused).

const CURVE = "P-256";

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function generateIdentityKeyPair() {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: CURVE }, true, ["deriveKey"]);
}

export async function exportPublicKeyRaw(publicKey) {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return bufToBase64(raw);
}

export async function importPublicKeyRaw(base64Raw) {
  const raw = base64ToBuf(base64Raw);
  return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: CURVE }, [], []);
}

export async function exportPrivateKeyJwk(privateKey) {
  return crypto.subtle.exportKey("jwk", privateKey);
}

export async function importPrivateKeyJwk(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: CURVE }, true, ["deriveKey"]);
}

export async function peerIdFromPublicKeyRaw(base64Raw) {
  const raw = base64ToBuf(base64Raw);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex.slice(0, 16).toUpperCase();
}

export async function deriveSharedKey(myPrivateKey, peerPublicKey) {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(aesKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
  return { iv: bufToBase64(iv), data: bufToBase64(ciphertext) };
}

export async function decryptText(aesKey, payload) {
  const iv = new Uint8Array(base64ToBuf(payload.iv));
  const data = base64ToBuf(payload.data);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, data);
  return new TextDecoder().decode(plainBuf);
}

export async function encryptBytes(aesKey, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, bytes);
  return { iv: bufToBase64(iv), data: bufToBase64(ciphertext) };
}

export async function decryptBytes(aesKey, payload) {
  const iv = new Uint8Array(base64ToBuf(payload.iv));
  const data = base64ToBuf(payload.data);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, data);
  return new Uint8Array(plainBuf);
}

export { bufToBase64, base64ToBuf };
