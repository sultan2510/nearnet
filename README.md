# NearNet

Offline-first, end-to-end encrypted, peer-to-peer chat and file transfer for people on the same local network. No accounts, no central chat server — messages and files travel directly between devices over WebRTC once a room is set up.

## How it works

1. **No sign-in.** On first launch, the app generates an ECDH P-256 key pair in your browser (Web Crypto API). A hash of your public key becomes your anonymous Peer ID. You just pick a nickname — there's no email, password, or server-side account.
2. **Rooms.** One person creates a room and gets a 6-character code (or a QR code) to share. Others join with that code.
3. **Signaling, not chat.** A small Vercel serverless API + Redis store only helps peers find each other and exchange WebRTC connection info (SDP/ICE). It never sees message content. Once two devices connect directly, the signaling server is no longer involved in that conversation.
4. **Mesh relay.** If two peers can't connect directly, messages hop through other connected peers (TTL-limited to 3 hops, 60-second message lifetime, loop-safe). File transfers always require a direct connection.
5. **Verified encryption.** Messages travel over a private WebRTC channel either way, but full end-to-end encryption (ECDH-derived AES-256-GCM) only turns on for a contact once you've scanned their QR code on the Profile screen — that's the in-person step that defeats a malicious signaling server.

## Known limitations (please read before demoing)

- **Mesh relaying needs the relay device's browser tab open and active.** Browsers (especially iOS Safari) suspend background tabs aggressively. There's no way for a web app to run a persistent background relay service the way a native app could. If someone is relaying for others, they need NearNet open on screen.
- **"Become the anchor" can't actually turn on a phone's hotspot.** No browser API allows that. The Emergency screen guides the user to do it manually in their phone settings.
- **Battery level is best-effort.** The Battery Status API was removed from most browsers for privacy reasons. Where it's unavailable, NearNet shows a manual slider instead.
- **Range rings are logical, not physical.** WebRTC doesn't measure radio distance — "direct" vs. "mesh hop" reflects network topology (how peers happen to be connected), not literal meters.
- **A free public TURN server is included** (Open Relay Project) as a fallback for when two peers can't connect directly — e.g. different Wi-Fi networks or restrictive NATs. It only relays opaque, already-encrypted bytes, never plaintext. It's shared/rate-limited, so for heavier real-world use, swap in your own TURN credentials (metered.ca, Twilio, etc.) in `ICE_SERVERS` in `src/lib/peerManager.js`.
- **Received files aren't persisted across a reload** (only text message history is saved to IndexedDB) — this keeps the demo simple, but is worth knowing.

## Project structure

```
src/
  lib/            crypto.js, db.js, peerManager.js, signalingClient.js, roomCode.js, format.js
  context/        AppContext.jsx — all app state and orchestration
  components/      shared UI: TopBar, BottomNav, PeerRow, MessageBubble, QRCodeView, QRScanner
  screens/        RoomEntry, Radar, Chat, Profile, Emergency, Onboarding
api/
  room/           create.js, join.js, peers.js, leave.js
  signal.js       SDP/ICE relay (POST to send, GET to poll)
  heartbeat.js    keeps a peer marked active in a room
  _lib/           redis.js, rateLimit.js, validate.js
```

## Local development

You'll need Node.js 18+ and the Vercel CLI (`npm i -g vercel`) so the frontend and the `/api` serverless functions run together.

```bash
npm install
vercel dev
```

`vercel dev` serves the Vite frontend and the API functions on the same local URL, which is the easiest way to test WebRTC signaling locally. (Running plain `vite` also works for frontend-only UI tweaks — there's a dev proxy in `vite.config.js` for `/api`, but you'd need a separate `vercel dev` process on port 3000 for it to actually work.)

You'll need Redis credentials even for local dev — see below.

## Setting up Redis (required for signaling)

1. Go to [upstash.com](https://upstash.com) and create a free account + a Redis database (or use the "Upstash for Redis" integration from your Vercel project's Storage tab — same thing, one click).
2. Copy the **REST URL** and **REST TOKEN** it gives you.
3. Locally: copy `.env.example` to `.env` and paste them in.
4. On Vercel: add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Project Settings → Environment Variables.

## Deploying — GitHub + Vercel

1. **Push to GitHub.**
   ```bash
   git add -A
   git commit -m "Initial NearNet build"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nearnet.git
   git push -u origin main
   ```
2. **Import into Vercel.**
   - Go to [vercel.com/new](https://vercel.com/new), choose "Import Git Repository," and pick your `nearnet` repo.
   - Vercel will auto-detect Vite. Leave build settings as default (`vercel.json` already pins `npm run build` / `dist`).
3. **Add the Redis environment variables** (see above) in the project's Settings → Environment Variables before the first deploy, or redeploy after adding them.
4. **Deploy.** Vercel gives you a `https://your-project.vercel.app` URL. Open it on two phones on the same Wi-Fi to test.
5. **Install as an app (optional but recommended):** open the URL on a phone, then "Add to Home Screen" (iOS Safari) or use the install prompt (Android Chrome). NearNet is a PWA and works offline once loaded, aside from the initial room-join handshake which needs *some* network path between the devices (same Wi-Fi, hotspot, etc.) to exchange signaling.

## Security notes

- All cryptography uses the browser's native Web Crypto API — no custom crypto code.
- Private keys never leave the device (stored in IndexedDB, never sent anywhere).
- The signaling API rate-limits room creation and joins per IP and validates all input shapes server-side.
- The Redis store only ever holds: room codes, peer IDs, public keys, nicknames, and short-lived (≤120s) opaque SDP/ICE blobs — never message content.
