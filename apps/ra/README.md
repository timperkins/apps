# RA

A pixel-art real-time strategy graphics test at [ra.trom.dev](https://ra.trom.dev).

- The world is a tiny planet: a procedurally generated landscape of grass, a dirt road that loops right round, rocky ridges, forests and lakes with beaches and shimmering surf, the same kind of land all over.
- The world wraps round in every direction: pan any way and you come back round, with the land flowing on seamlessly and everything the same way up (terrain noise is periodic both ways: `wrapNoise` and `WorldField` in `src/gfx.ts`). Units go the way you panned, so you can attack from either side.
- Zoom far out and you whoosh up through the atmosphere into space, where the world is a hazy, cloudy globe (`src/planet.ts`) with the map wrapped round it from the point under the camera, so panning slides the map round the globe without stretching it. From orbit it shows a simplified map: lakes, forests as darker land, the bases themselves, and units as dots of their colour. Drag it to spin it. Tap it to fly down, or, with units selected, to send them there the shortest way.
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
