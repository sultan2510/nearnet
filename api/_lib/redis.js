import { Redis } from "@upstash/redis";

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the
// environment. Set these in Vercel's Project Settings -> Environment
// Variables after creating a free Redis database at upstash.com.
export const redis = Redis.fromEnv();

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
