# My hotel

A 3D hotel game for the browser at [my-hotel.trom.dev](https://my-hotel.trom.dev). You play the manager and walk around with WASD or the arrow keys (or drag on a touch screen).

- Stand behind the desk to check guests in. Their coins pile up by the desk; walk over the pile to pick them up.
- Guests sleep, then leave a messy room. Walk into it to clean it.
- Stand on a pad to pay for it: new rooms, a desk clerk, a cleaner, or land outside the walls. Each plot of land you buy opens up the next one beyond it.
- Pick a map (Seaside, City or Lodge) on the start screen. Each map keeps its own save in the browser.

## Code

- `src/sim/` game rules: plain TypeScript, fixed tick, seeded random numbers, no DOM. `layout.ts` is the floor plan (12x12 lots of 1x1 cells), `path.ts` is A*, `hotel.ts` is the game.
- `src/render/` three.js scene: `world.ts` builds what only changes with the layout, `renderer.ts` draws people, pads, coins and bubbles each frame.
- `src/ui/` start screen and HUD, `src/input.ts` keyboard and touch, `src/save/` browser saves.

```
npm run dev        # local server
npm test           # game-rule tests
npm run build      # typecheck + production build
```
