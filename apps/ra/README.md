# RA

A pixel-art real-time strategy graphics test at [ra.trom.dev](https://ra.trom.dev).

- The world is a small planet, about twenty screens across (14336 × 7168 map pixels): a procedurally generated landscape of grass, rocky ridges, forests, lakes with beaches and shimmering surf, and dirt roads linking the bases, the same kind of land all over. It is far too big to paint at once, so the ground is classified and painted in 128-pixel tiles as they come into view, a few each frame (`src/tiles.ts`), with a coarse overview of the whole map filling in until they are ready.
- The world wraps round in every direction: pan any way and you come back round, with the land flowing on seamlessly and everything the same way up (terrain noise is periodic both ways: `wrapNoise` and `WorldField` in `src/gfx.ts`). Units go the way you panned, so you can attack from either side.
- Zoom out past half size and you whoosh up through the atmosphere into space, where the world is a hazy, cloudy globe (`src/planet.ts`) with the map wrapped round it from the point under the camera, so panning slides the map round the globe without stretching it. The globe starts out bigger than the screen and keeps shrinking as you zoom out. It shows the overview of the map: lakes, roads, forests as darker land, the bases themselves, and units as dots of their colour. Drag it to spin it. Tap it to fly down, or, with units selected, to send them there the shortest way.
- At normal zoom a minimap globe sits at the top right with the view outlined. Drag it to spin the world quickly, or tap it to jump there.
- You play Cobalt, and you start with a handful of units and no base: a **Mobile Foundry** (a big tracked vehicle with a crane folded on top), two Lancer tanks, a Scout buggy and three Riflemen (in v2; v1 still starts with ready-made bases). Ember has a home base nearby (HQ, factory, power plants, barracks, refinery, silos, radar, helipad, gun towers), and there are outposts of both sides spread round the planet, each with an army: tanks, scout buggies, an ore hauler, artillery, a copter and infantry, and patrol boats on the nearest lake.
- **Deploying the Foundry**: select the Mobile Foundry and its footprint shows on the ground, green where it can deploy (open, level grass clear of roads, water and other buildings) and red where it can't. Tap **Deploy** above the toolbar (or tap the vehicle again, or press D) and it lines up, anyone standing in the way drives off, and the Foundry rises out of the ground, clearing the trees. Tap the Foundry to select it and **Pack up** folds it back into the vehicle, so you can move your base.
- **Building your base**: once the Foundry stands, **Build** appears on the toolbar and your credits ($5000 to start, shown at the top) appear next to the menu button. Build opens the build menu: a sheet above the toolbar on a phone, a sidebar under the minimap on a wide screen (B toggles it). It lists only what you can build right now, in tabs (Base, Defense). Tap an item to start it: its icon darkens and a clock wipe sweeps round as the credits drain. Tap it again to put it on hold, and hold it (or right-click) to cancel and get your credits back. Each tab builds one thing at a time. When a building is ready, tap it and a see-through ghost of it goes on the map, green where it can stand (open, level ground within a short gap of the rest of your base) and red where it can't. On a phone, tap or drag to move it and press **Place**; with a mouse it follows the pointer and a click puts it down (right-click or Esc to put it back for later). It rises out of the ground.
- **The tech tree**: each building opens up more. Foundry → Generator → Barracks and Ore refinery; Barracks → Gun tower; Refinery → Ore silo, Vehicle works and Radar mast; Radar → Helipad; Vehicle works + Radar → Tech lab. New options get a **New** badge and a message. The tree is in `src/v2/tech.ts`.
- **Training units**: the Barracks opens the **Infantry** tab (Riflemen, Rocketeers) and the Vehicle works the **Vehicles** tab (Scout buggy and Lancer tank; Ore hauler with a refinery; Howler artillery with a radar; Bastion tank with a Tech lab; another Mobile Foundry), and a Helipad plus a Tech lab add the Kestrel copter. Units queue up: tap an item once per unit (up to 5 of each, the count shows on the icon) and hold it to take one off. Each tab makes one unit at a time; it drives out of the door, or lifts off the helipad. Select a Barracks, Vehicle works or Helipad and tap the ground to set its **rally point**, shown as a flag, where its new units go (**Clear rally** removes it). With two of the same kind, **Make primary** picks which one they come out of.
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
