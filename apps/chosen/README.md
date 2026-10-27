# You Have Been Chosen

A playful finger-picker PWA. Everyone puts a finger on the screen, rings pulse through a 4 second countdown, and the app picks one person. A loser or two gets an arrow and a mocking message.

## How it plays

- Each finger gets its own colored ring the moment it touches.
- With 2 or more fingers the rings pulse and a 4 second countdown arc fills. Adding or lifting a finger restarts it.
- When time runs out the winner's ring bursts with confetti and a crown. With 2 or 3 players one loser gets taunted; with 4 or more, two do.
- The result stays up until everyone lifts, then the screen resets.
- Sound effects are synthesized with Web Audio and are always on.

## Development

```sh
npm install
npm run dev      # dev server
npm test         # game logic unit tests
npm run lint
npm run build    # typecheck + production build into dist/
npm run preview  # serve dist/ locally
```

Multi-touch needs a real phone. Run `npm run dev -- --host` and open the network URL on your phone while on the same Wi-Fi.

## Project layout

- `src/game/` pure game logic: the state machine (`machine.ts`), taunt messages, finger colors
- `src/render/` canvas renderer for rings, pulses, winner animation, arrows and bubbles
- `src/audio/` synthesized sound effects
- `src/App.tsx` wires pointer events, the animation loop, and wake lock

## Deploying

A static site on Firebase Hosting at https://chosen.trom.dev, deployed by the `apps` repo's CI: a preview channel for every branch, prod on merge to `main` (see `docs/PLAN.md` at the repo root). Hosting site and cache headers are in `firebase.json`.
