# Your doom

A snowy isometric wood-gathering game at [your-doom.trom.dev](https://your-doom.trom.dev).

- Walk out of the camp through a gate and stand next to a tree to chop it (3 logs per tree; stumps regrow).
- Carry the stack back and stand on the dashed square next to the counter to drop it off.
- Townspeople queue at the counter and buy wood for **10 eeeddd** a log.
- Stand on a yellow pad to spend eeeddd on upgrades:
  - **Wood belt** (150): a second drop-off by the north gate with a conveyor to the counter.
  - **Bigger bag** (40 / 100 / 220 / 450): carry 5 more logs per level.
  - **Sharper axe** (60 / 160 / 380): chop faster.
  - **Hire woodcutter** (80 / 200 / 400): up to 3 helpers who walk out, chop trees and bring the wood to the nearest drop-off (the belt too, once built).

- Tap **Upgrades** (top right) for the full list, including menu-only upgrades: Snow boots (walk faster), Fancy wood (+5 eeeddd per log), Town sign (more customers), Tree fertilizer (faster regrowth) and Giant trees (4 logs per tree). **Start over** at the bottom wipes your save (tap twice to confirm).

Extra fun:
- **Goals** at the bottom of the screen pay bonus eeeddd when you finish them.
- **Golden trees** appear now and then (the arrow points to them) and burst into 100 eeeddd.
- **Rich customers** wear a crown and pay double.
- A **wolf** roams the woods. If it catches you, you drop half your logs; run back into camp to escape.
- **Restart** (top right) starts a new game after a confirm.

Controls: drag anywhere on touch screens, WASD or arrow keys on desktop.
Progress (eeeddd and upgrades) is saved in the browser's localStorage. No server or database.

```
npm run dev        # local dev server
npm run build      # typecheck + production build
```

All drawing is code in `src/game.ts` (canvas 2D, no image assets).
