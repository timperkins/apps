# RA

A pixel-art real-time strategy graphics test at [ra.trom.dev](https://ra.trom.dev).

- The whole screen is a procedurally generated landscape: grass, a winding dirt road, rocky ridges, forests and a lake with a beach and shimmering surf.
- Two factions (Cobalt and Ember) each have a base (HQ, factory, power plants, barracks, refinery, silos, radar, helipad, gun towers) and an army: tanks, scout buggies, an ore hauler, artillery, a copter, a patrol boat and infantry.
- The world is bigger than the screen. The toolbar at the bottom has two modes:
  - **Select** (default): tap a unit to select it, drag a box to select several, tap the ground to send them there.
  - **Pan**: drag to move around the world; taps still select and send units.
  - **Add** makes taps and boxes add to the selection, **All** selects everything on screen, **Clear** deselects.
- Pinch to zoom on a phone (two fingers also pan); on a computer, scroll to zoom around the cursor, or use + / - / 0.
- On a computer: shift adds to the selection, right-click moves, middle-drag or the arrow keys pan, S and P switch modes, Esc clears.
- **New map** generates a fresh layout.
- The picker at the top right switches versions (also `?v=1` / `?v=2` in the URL; the last pick is remembered):
  - **v2 · Isometric** (default): 2:1 isometric view with raised plateaus and rock faces, and every unit, building, tree and prop drawn as a shaded voxel shape with cast shadows (`src/v2/`).
  - **v1 · Top-down**: the original straight-down oblique view (`src/v1/`).

No collision, map edges, combat or economy yet. All art is drawn in code (`sprites.ts` and `terrain.ts` in each version's folder) at native pixel size and scaled up with nearest-neighbour filtering.

```sh
npm install
npm run dev
npm run build
```
