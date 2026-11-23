# Reef Raiders

A pirate fishing party game. One screen (TV, laptop) shows the sea in pixel art; up to 12 players join with their phones, on two teams:

- **The Crew** (up to 4): each Raider has their own boat in their own color. Slide to sail along the surface, **Cast**, hold to reel the line in, and when something bites, tap to win the tug-of-war. Tapping just as the gold ring closes is a **Heave** and pulls much harder. A catch pays coins, or sometimes meat, which Gristle Pete buys when his boat comes by ("Hot diggity dog, do you have any meat?").
- **The School** (up to 8): each Swimmer is a fish in their own color. Drag to swim, eat smaller fish to grow, dodge bigger ones and hooks, and **Dash**. When hooked, tap fast to pull free, and **Thrash** once per fight. Ramming a boat damages it; a sunk boat is fixed after 8 seconds. Swimmers can lay eggs that hatch into babies that follow them, and clownfish can **Taunt** ("You can't catch me, I'm the gingerbread man").

Computer fish fill the sea. A round lasts 3 minutes; lines reach all the way to the seabed. The team with the bigger total wins (the Crew's total is scaled by how many Swimmers there are per Raider, so uneven teams stay fair).

Spend coins in the **Store** (B on a keyboard, then 1-4) on upgrades for your boat (sails, hull, reel, line) or fish (fins, dash, strength, ram). Every upgrade can be bought again; each level costs more. Upgrades reset each round.

Not built yet: drawing your own fish, extra customization and Frenzy mode.

## How it works

- No game server. Firestore (named database `reef-raiders` in project `apps-97595`) holds only the room: its code, who joined, the phase and the WebRTC handshake. All game data then goes peer to peer between each phone and the screen.
- The screen runs the simulation at 60 Hz and draws it into a 640x360 canvas that CSS scales up with crisp pixels. All sprites are drawn in code (`src/render/sprites.ts`); the background is painted once.
- Phones send their stick 30 times a second over an unreliable channel and actions (cast, tap, dash…) over a reliable one; the screen sends each phone its status 5 times a second.

## Development

```sh
npm install
npm run emulators            # Firestore + Auth emulators (needs Java)
VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-reef npm run dev
npm test                     # world rules, stick math, message checks
npm run build
npm run icons                # regenerate the PWA icons
```

Code map: `src/game/` is the simulation (`world.ts`) and tuning (`constants.ts`); `src/net/` is rooms, WebRTC and `validate.ts` for phone messages; `src/controller/` is the thumbstick; `src/render/` draws the scene; `src/screens/` has the screen (`Host.tsx`, `hostSession.ts`) and phone (`Play.tsx`) pages.
