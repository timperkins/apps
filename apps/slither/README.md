# Slither

A slither.io-style party game. One screen (TV, laptop) shows the arena; up to 10 snakes, players and computer players together, each player steering from their phone. Eat food to grow; run your head into another snake and you die, leaving most of your mass behind as food.

- React + Vite + TypeScript, installable as a PWA. Same stack and networking as Pong.
- No game server. Firestore (named database `slither` in project `apps-97595`) holds only the room: its code, who joined, the phase and the WebRTC handshake. All game data then goes peer to peer between each phone and the screen.
- The screen runs the whole simulation, including the computer players, at a fixed 60 Hz.

## How a game works

1. On the screen, open the app and click **New game**. It shows a room code, a QR code and the game setup: computer players (none by default), their difficulty (Easy, Normal, Hard) and a timer (off, 2, 3, 5 or 10 minutes). The last setup is remembered.
2. Each player scans the QR code (or opens the app and types the code) and taps **Join game**. On the phone they pick a name, one of 16 colors (colors other players have are greyed out), a pattern (solid, stripes, dots, rainbow, glow) and a control mode. Snakes can already move around while everyone joins.
3. Click **Start game** on the screen. After a 3-second countdown every snake starts fresh.
4. With a timer, the biggest snake still alive when time runs out wins. Without one, click **End game** when you're done; the biggest living snake wins. The results show final size, biggest size and kills.

### Rules

- The arena is the screen. There are no walls: going off one edge brings you back on the opposite edge.
- Your own body is safe. Your head touching any other snake kills you; two heads meeting kills both.
- A dead snake drops 80% of its mass as food along its body and respawns at starting size after 3 seconds, with 2 seconds of see-through protection.
- Boost doubles your speed and burns mass, most of which drops behind you as food. You can't boost below the minimum size, and new snakes start only a little above it, so a fresh snake gets just a short burst.
- Players can join a running game. A phone that drops out has its snake flown by the computer until it reconnects (2 minutes at most).

### Controls

- **Touch:** the first place you touch is the center; slide left or right of it to turn (a quarter of the screen width is a full turn). Lift to go straight. Double-tap and hold to boost.
- **Tilt:** hold the phone sideways like a steering wheel and turn it. Choosing Tilt sets straight ahead to how you're holding it; **Straighten** resets it. The sensitivity and an invert switch are under Style & controls. Double-tap and hold anywhere to boost. Needs a phone with a motion sensor (and on iPhone, permission, asked for when you pick Tilt).

Both modes send the same turn amount, so neither has an edge. Phones and the screen should be on the same Wi-Fi; if the direct link can't connect, the phone shows a Retry button.

## Setup

The hosting site `trom-slither`, the `slither` and `slither-preview` databases and the `slither.trom.dev` domain were created by the repo's `create-app` workflow. Anonymous sign-in is already enabled for the project (Pong uses it). Rules deploy with the app: previews to `slither-preview`, merges to `main` to `slither`.

Add TTL policies so abandoned rooms delete themselves (each document has an `expiresAt` field, 6 hours after its last write):

```sh
for db in slither slither-preview; do for group in rooms players rtc; do
  gcloud firestore fields ttls update expiresAt --collection-group=$group --database=$db --enable-ttl --project=apps-97595
done; done
```

## Development

```sh
npm install
npm run emulators            # Firestore + Auth emulators (needs Java)
VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-slither npm run dev
npm test                     # world rules, AI, steering math, message checks
npm run build
npm run icons                # regenerate the PWA icons
```

Phones only expose motion sensors over HTTPS, so test tilt on a real phone through a preview link.

Code map: `src/game/` is the simulation (`world.ts`), the computer players (`ai.ts`) and tuning (`constants.ts`); `src/net/` is copied from Pong (rooms and WebRTC) plus `validate.ts` for phone messages; `src/controller/` turns touch and tilt into steering; `src/render/` draws the arena and snakes; `src/screens/` has the screen (`Host.tsx`, `hostSession.ts`) and phone (`Play.tsx`) pages.
