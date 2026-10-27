# Paper Airplane

Animated, step-by-step paper airplane folding instructions, folded procedurally in three.js.

The paper is not an authored animation or an imported model. A fold engine holds the sheet as
flat polygonal faces and applies real folds to them; the renderer bends creases along arcs, lifts
layers by their stacking order and rolls folded edges, so the result looks like paper without any
modelling or texture assets.

Right now this is the M0 realism spike: the classic dart, five steps, scrubbable, with a tuning
panel for the paper and lighting. See `docs/PLAN.md` for where it is going and
`docs/M0-RESULTS.md` for what the spike established.

The paper is two-tone by default, but only just: folding a flap turns it face down, so a slightly
different colour on the back makes every fold legible, the way origami diagrams do. The difference
is kept small on purpose. Every place a sheet wraps over - a crease, or a flap landing a
millimetre short of the one below - shows the other side in a narrow strip, and at high contrast
those strips read as bevelled edges rather than as paper. The panel has both colours and a button
to match them for plain white. Sheet thickness is exaggerated too, because real paper is thinner
than a pixel at this distance.

Every sheet is a slab, not a surface. The bend maps the middle of the paper and carries its two
sides half a thickness either side of that, along the paper's own normal, so a flap turns its
thickness over with it: the side that was uppermost wraps the outside of the crease and arrives
underneath, resting on the sheet it was folded onto, and the side that was hidden becomes the one
you see. Raise the thickness slider and you can watch it happen.

Folds carry their crease allowance: wrapping paper round a crease uses it up, so a flap lands
short by what it wrapped, each layer by its own amount, measured against how deep the stack is
where that sheet sits. The edges of a thick fold fan out rather than lining up, and because the
engine and the bend agree on the same numbers the animation ends exactly where it leaves off
instead of snapping into a perfect fold.

Faces are wound by the side of the paper they show rather than by which way is up, so a sheet
lying face down is drawn the same way at rest as it was mid-fold. That keeps the fibre texture's
tangent frame, and so the shading, from flipping as a step commits.

## Running

```
npm install
npm run dev
```

Space plays and pauses, the arrow keys step, shift with the arrows scrubs, and `[` and `]` change
speed.

## Deploying

`next.config.ts` sets `output: "export"`, so `npm run build` writes a static site to `out/`. It is
served from Firebase Hosting at https://paper-airplane.trom.dev and deployed by the `apps` repo's CI:
a preview channel for every branch, prod on merge to `main` (see `docs/PLAN.md` at the repo root).
CI runs `npm run lint` before the build. The Hosting site and cache headers are in `firebase.json`.

## Checks

```
npm run check          # geometry, bend maths, sheet thickness, winding and mesh integrity
npm run check:browser  # drives the running app in Chromium
```

`npm run check` verifies that paper area is conserved exactly through every fold, that the bend
map preserves arc length and lands a 180 degree fold flat, that a sheet keeps its thickness
through a crease and comes to rest on the paper below with the side that was up now underneath,
that every triangle is wound to agree with its normals, that the mesh has no holes, and that every
folded edge carries its rounded band from one end to the other at any sheet thickness. Two more
scripts measure smoothness at a step boundary, which is where a jump in the animation would show:
`scripts/check-continuity.ts` on the geometry, and `scripts/check-frames.ts` on the rendered
pixels, walking the timeline in a browser and reporting how much the picture changes from one
frame to the next.

```
npx tsx scripts/check-frames.ts 0.96 1.04 0.01   # needs the app running on :3100
```

## Layout

```
src/lib/geom.ts          2D vectors, lines, isometries, convex polygon splitting
src/lib/fold.ts          the fold engine: faces, creases, layers, folds
src/lib/paperMesh.ts     bend deformation and triangle building
src/lib/paperTexture.ts  procedural fibre and roughness maps
src/lib/planes/          plane definitions
src/components/          the viewer, scene and model
scripts/                 checks and the screenshot driver
```
