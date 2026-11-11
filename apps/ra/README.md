# RA

A pixel-art real-time strategy graphics test at [ra.trom.dev](https://ra.trom.dev).

- The world is a small planet, about twenty screens across (14336 × 7168 map pixels): a procedurally generated landscape of grass, rocky ridges, forests, lakes with beaches and shimmering surf, and dirt roads linking the bases, the same kind of land all over. It is far too big to paint at once, so the ground is classified and painted in 128-pixel tiles as they come into view, a few each frame (`src/tiles.ts`), with a coarse overview of the whole map filling in until they are ready.
- The world wraps round in every direction: pan any way and you come back round, with the land flowing on seamlessly and everything the same way up (terrain noise is periodic both ways: `wrapNoise` and `WorldField` in `src/gfx.ts`). Units go the way you panned, so you can attack from either side.
- Zoom out past half size and you whoosh up through the atmosphere into space, where the world is a hazy, cloudy globe (`src/planet.ts`) with the map wrapped round it from the point under the camera, so panning slides the map round the globe without stretching it. The globe starts out bigger than the screen and keeps shrinking as you zoom out. It shows the overview of the map: lakes, roads, forests as darker land, the bases themselves, and units as dots of their colour. Drag it to spin it. Tap it to fly down, or, with units selected, to send them there the shortest way.
- At normal zoom a minimap globe sits at the top right with the view outlined. Drag it to spin the world quickly, or tap it to jump there.
- You play Cobalt, and you start with a handful of units and no base: a **Mobile Foundry** (a big tracked vehicle with a crane folded on top), two Lancer tanks, a Scout buggy and three Riflemen (in v2; v1 still starts with ready-made bases). Ember has a home base nearby (HQ, factory, power plants, barracks, refinery, silos, radar, helipad, gun towers), and there are outposts of both sides spread round the planet, each with an army: tanks, scout buggies, an ore hauler, artillery, a copter and infantry, and patrol boats on the nearest lake.
- **Deploying the Foundry**: select the Mobile Foundry and its footprint shows on the ground, green where it can deploy (open, level grass clear of roads, water and other buildings) and red where it can't. Tap **Deploy** above the toolbar (or tap the vehicle again, or press D) and it lines up, anyone standing in the way drives off, and the Foundry rises out of the ground, clearing the trees. Tap the Foundry to select it and **Pack up** folds it back into the vehicle, so you can move your base.
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
