# RA

A pixel-art real-time strategy graphics test at [ra-rts.trom.dev](https://ra-rts.trom.dev).

- The whole screen is a procedurally generated landscape: grass, a winding dirt road, rocky ridges, forests and a lake with a beach and shimmering surf.
- Two factions (Cobalt and Ember) each have a base (HQ, factory, power plants, barracks, refinery, silos, radar, helipad, gun towers) and an army: tanks, scout buggies, an ore hauler, artillery, a copter, a patrol boat and infantry.
- Click or tap a unit to select it, drag a box to select several (shift adds to the selection), then click or tap the ground to send them there. Right-click also moves. Esc clears the selection.
- **New map** generates a fresh layout.

No collision, map edges, combat or economy yet. All art is drawn in code (`src/sprites.ts`, `src/terrain.ts`) at native pixel size and scaled up with nearest-neighbour filtering.

```sh
npm install
npm run dev
npm run build
```
