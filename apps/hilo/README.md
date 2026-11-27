# HILO

A party game for 2 to 8 players on their phones, at [hilo.trom.dev](https://hilo.trom.dev).

Each round one player asks a question with a number for an answer ("How far is it from Seattle to
San Francisco?"). Gemini looks up the real answer and keeps it hidden. Another player guesses the
number, then everyone bets whether the real answer is higher or lower than that guess. Right bets
score 10 points; the player who guessed the number gets a 10 point bonus for landing within 10% (20 for an exact hit).
Everyone asks once or twice, then the best score wins and the host can start a new game for the
same group.

Ported from the `timperkins/hilo` repo. The visual direction follows the HILO Figma board.

## How it works

- Next.js on Firebase App Hosting (`apphosting.yaml`, preview overrides in `apphosting.preview.yaml`).
- Players sign in anonymously. All game changes go through tRPC routes (`server/routers`) that use
  Firebase Admin; browsers only read Firestore, plus a heartbeat on their own player document.
- Firestore database `hilo` (previews use `hilo-preview`):
  `games/{roomCode}` with `players`, `rounds` and `secrets` (correct answers until revealed,
  server only). Every document has an `expiresAt` a day out, deleted by a TTL policy.
- Presence: each open page writes `lastSeen` every 8 seconds; a player counts as gone after 25
  seconds without one. If the host leaves, the earliest-joined player still here runs the game,
  and the host can hand a stuck turn to someone else.
- Answers come from Gemini with Google Search (`server/services/ai/gemini.ts`), using the
  project's existing `GEMINI_API_KEY` secret.

Code layout: `src/` is the client (`src/lib/boxes/hilo` holds the game screens), `server/` the
tRPC API, `shared/` types and game rules used by both.

## Local development

```bash
cp .env.example .env.local   # emulator settings; HILO_FAKE_AI=1 makes up answers
npm install
npm run emulators            # Auth + Firestore emulators (needs Java)
npm run dev                  # in another terminal
```

Set `GEMINI_API_KEY` in `.env.local` (and remove `HILO_FAKE_AI`) to get real answers locally.
Open the app in a few browser profiles to play against yourself.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
