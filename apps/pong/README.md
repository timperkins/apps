# Pong

Retro two-player Pong for the web. One screen (TV, laptop, tablet) shows the game; each player joins with a phone and tilts it to move their paddle.

- React + Vite + TypeScript, installable as a PWA.
- Game drawn on a 320 × 240 canvas, scaled up with crisp pixels. Square-wave sound effects from the Web Audio API.
- No game server. Firestore (named database `pong` in project `apps-97595`) holds rooms and sets up a direct WebRTC link from each phone to the screen; paddle input flows over that link.

## How a game works

1. On the screen, open the app and tap **New game**. It shows a 4-letter room code and a QR code.
2. Each player scans the QR code (or opens the app and types the code) and taps **Tap to start**, which asks for motion access on iPhone.
3. Hold the phone comfortably and tap **Ready**. That position becomes the middle of the screen. When both players are ready, a 3-second countdown starts.
4. Tip the top of the phone away to move up, toward you to move down. First to 11 wins; tap **Ready** on both phones to play again.

Tilt is the only control, so players need a phone with a motion sensor. Both phones and the screen should be on the same Wi-Fi; if the direct link cannot connect, the phone shows an error with a Retry button.

## Setup

1. In the Firebase console for `apps-97595`, enable **Authentication > Sign-in method > Anonymous**.
2. The web app config for `apps-97595` is built into `src/net/firebase.ts`; `.env.local` can override it (see `.env.example`).
3. Security rules (`firestore.rules`) deploy with the app: previews deploy them to `pong-preview`, merges to `main` to `pong`.
4. Add TTL policies so abandoned rooms delete themselves (each document has an `expiresAt` field, 6 hours after its last write):

   ```sh
   for db in pong pong-preview; do for group in rooms players rtc; do
     gcloud firestore fields ttls update expiresAt --collection-group=$group --database=$db --enable-ttl --project=apps-97595
   done; done
   ```

## Development

```sh
npm install
npm run emulators            # Firestore + Auth emulators (needs Java)
VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-pong npm run dev
npm test                     # physics, room codes, tilt mapping
npm run build
```

Phones only expose motion sensors over HTTPS, so test tilt on a real phone through a preview link rather than the plain-HTTP dev server.

## Deploy

A static single-page app on Firebase Hosting at https://pong.trom.dev, deployed by the `apps` repo's CI: a preview channel for every branch (using the `pong-preview` database), prod on merge to `main` (using `pong`). See `docs/PLAN.md` at the repo root. Hosting site, SPA rewrite and cache headers are in `firebase.json`.
