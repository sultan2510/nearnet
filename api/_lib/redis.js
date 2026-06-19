import { Redis } from "@upstash/redis";

// Vercel's Upstash integration sometimes names these KV_REST_API_URL /
// KV_REST_API_TOKEN instead of UPSTASH_REDIS_REST_URL / _TOKEN. Support both.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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