# RA

A pixel-art real-time strategy graphics test at [ra.trom.dev](https://ra.trom.dev).

- The world is a tiny planet: a procedurally generated landscape of grass, a dirt road that loops right round, rocky ridges, forests, a lake with a beach and shimmering surf, and ice caps at the poles.
- The map is a longitude/latitude grid (`src/planet.ts`, `SphereField` in `src/gfx.ts`). It wraps east to west, and the terrain is generated on the sphere so it joins up everywhere. Units can go either way round (they go the way you panned) or over a pole, which brings them down the far side of the globe.
- Zoom far out and you rise into space, where the world is a globe you can drag to spin. Tap it to fly down, or, with units selected, to send them there the shortest way (over a pole if that is quicker).
- At normal zoom a minimap globe sits at the top right with the view outlined. Drag it to spin the world quickly, or tap it to jump there.
- Two factions (Cobalt and Ember) each have a base (HQ, factory, power plants, barracks, refinery, silos, radar, helipad, gun towers) and an army: tanks, scout buggies, an ore hauler, artillery, a copter, a patrol boat and infantry.
- The toolbar at the bottom has two modes:
  - **Select** (default): tap a unit to select it, drag a box to select several, tap the ground to send them there.
  - **Pan**: drag to move around the world; taps still select and send units.
  - **All** selects everything on screen.
  - While units are selected, **More** and **Clear** appear above the toolbar. Turn on More and taps and boxes add to the selection; Clear deselects.
- Pinch to zoom on a phone (two fingers also pan); on a computer, scroll to zoom around the cursor, or use + / - / 0.
- On a computer: shift adds to the selection, right-click moves, middle-drag or the arrow keys pan, S and P switch modes, Esc clears.
- The menu button at the top left holds **New map**, which generates a fresh world, and the version picker, which switches versions (also `?v=1` / `?v=2` in the URL; the last pick is remembered):
  - **v2 · Isometric** (default): 2:1 isometric view with raised plateaus and rock faces, and every unit, building, tree and prop drawn as a shaded voxel shape with cast shadows (`src/v2/`).
  - **v1 · Top-down**: the original straight-down oblique view (`src/v1/`).

No collision, combat or economy yet, and water and cliffs don't block units yet. All art is drawn in code (`sprites.ts` and `terrain.ts` in each version's folder) at native pixel size and scaled up with nearest-neighbour filtering.

```sh
npm install
npm run dev
npm run build
```
