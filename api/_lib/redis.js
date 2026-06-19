import { Redis } from "@upstash/redis";

// Vercel's Upstash integration auto-creates KV_REST_API_URL / KV_REST_API_TOKEN.
// Prefer those (can't have copy-paste typos), fall back to manually-added ones.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !url.startsWith("https://")) {
  console.error("Redis URL is missing or malformed:", url);
}

export const redis = new Redis({ url, token });

export const ROOM_TTL_SECONDS = 60 * 60 * 24; // 24 hours
export const SIGNAL_TTL_SECONDS = 120;
export const STALE_PEER_SECONDS = 25;

export function roomKey(code) {
  return `nn:room:${code}`;
}
export function peersKey(code) {
  return `nn:peers:${code}`;
}
export function inboxKey(code, peerId) {
  return `nn:inbox:${code}:${peerId}`;
}
export function rateKey(bucket, id) {
  return `nn:rate:${bucket}:${id}`;
}