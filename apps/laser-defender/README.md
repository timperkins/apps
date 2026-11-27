# Laser defender

A voxel dungeon survival game. You hold the dungeon with a laser and chain lightning while zombies, spiders and skeleton archers rise out of the floor in waves. Every fifth wave brings a brute. Between waves you pick one of three upgrades.

Live at https://laser-defender.trom.dev. Static site on Firebase Hosting, no database. Best score is kept in `localStorage`.

## Controls

- Computer: WASD or arrow keys move, the mouse aims, hold left click for the laser, Q / E or right click for lightning, Space or Shift to dash, P or Esc to pause, M to mute.
- Phone (play sideways): left thumb moves, right thumb aims and fires the laser (with a little aim assist), the ⚡ button casts lightning and 💨 dashes.

## How it works

- Three.js, no image or audio files. Every model is built from boxes in `src/models.ts` (voxel size 0.1) and merged into one geometry per body part. Sounds are synthesised in `src/audio.ts`.
- `src/dungeon.ts` generates a new room-and-corridor dungeon each run, builds it with instanced cubes, bakes torch light into the tile colours, and keeps a breadth-first distance field from the player so enemies path around walls.
- `src/game.ts` has the game loop: player, laser (heat and overheat), lightning (chains between nearby enemies), enemy AI, waves and upgrades. `src/fx.ts` has the voxel particles, lightning arcs and rings.
- `window.__game` exposes the game object for automated checks.

## Run it

```sh
npm install
npm run dev
npm run build   # typecheck, then vite build into dist/
```
