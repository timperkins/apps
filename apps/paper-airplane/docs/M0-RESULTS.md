# M0: does procedurally folded paper look real?

**Verdict: go.** Rigid fold kinematics plus a bend deformation, layer offsets and rolled crease
edges produce paper that reads as paper. Nothing was authored by hand, there are no texture or
model assets, and no Blender step is involved. Every image below came out of the app itself.

The spike went wider than the plan called for. The plan proposed one fold and a hard-coded
three-layer stack, but the layer criterion only means anything against real stacked geometry, so
the spike drives the whole classic dart through a working fold engine instead: five steps, ending
at sixteen layers of paper at the nose.

## What was built

| Piece | File |
|---|---|
| 2D geometry: lines, isometries, convex split and intersection | `src/lib/geom.ts` |
| Fold engine: faces, creases, layer rule, flap refinement | `src/lib/fold.ts` |
| Renderer: bend map, layer offsets, rolled edges, triangle builder | `src/lib/paperMesh.ts` |
| Procedural fibre and roughness maps | `src/lib/paperTexture.ts` |
| Studio scene, transport, tuning panel | `src/components/` |
| The dart, written against the engine's ops | `src/lib/planes/dart.ts` |

## The three go/no-go criteria

**1. Does the crease read as bent paper mid-fold and as a flat fold at the end?** Yes. Paper
within a band of the fold line follows a circular arc whose total turn is the fold angle. Arc
length is preserved per layer, so nothing stretches, and at 180 degrees the band becomes a
half-cylinder, which is what a real crease looks like in cross-section.

Finishing the fold on exactly the state the engine commits took more care than starting it. A
fold wraps real paper around the crease: pi times the radius, which for the outer layers of a
thick stack is centimetres. If the committed state ignores that, the model snaps as each step
ends and every folded edge springs into perfect alignment. So the engine takes that paper out of
the flat model and slides what is left up to the fold line. The flap lands short by exactly what
it wrapped, each layer by its own amount, and the edges of a thick fold fan out instead of lining
up. That is both what really happens and the thing that stops a finished fold looking machined.

Three consequences follow, and all of them are load-bearing:

- **Layer spacing has to be even.** A fold turns a stack over, so the sheet that was on the
  bottom ends up on top. Only even spacing puts it back exactly where the committed state expects
  it. An earlier version squeezed the deeper layers to keep the nose slim, and that squeeze was
  the largest single jump in the animation.
- **The finished crease width follows from thickness** rather than being its own control: half a
  sheet is the radius the innermost layer turns through, and a half turn wraps pi times that.
- **Thickness is now limited from above as well as below.** It decides how much paper each crease
  eats, so beyond about three times real paper the nose, where sixteen layers fold at once,
  starts losing visible chunks.

**2. Do stacked layers read as a stack rather than z-fighting?** Yes, and making a *single* fold
read took more than making the nose read. The two turned out to pull against each other.

Real paper is about 0.1 mm thick, which is less than a pixel at any sensible viewing distance, so a
folded corner sitting on the sheet below was invisible: the first version of this spike produced a
featureless white pentagon after the corners were folded in. Thickness has to be exaggerated to
roughly 0.3 mm before one fold shows. At that spacing sixteen layers at the nose come to 4.5 mm,
and pushing it much further starts eating visible chunks of paper into the creases.

Three things resolve it:

- **Thickness is exaggerated, and the spacing stays even.** An early version squeezed the deeper
  layers to keep the nose slim, which was the largest single jump in the whole animation: a fold
  turns a stack over, so only even spacing returns a sheet to where the committed state expects
  it. Sixteen even layers at 0.3 mm come to 4.5 mm, which reads as a thick nose rather than as
  corrugated board, and one fold is still visible because an edge wall and the crease round are
  drawn rather than left to a sub-pixel step.
- **Every edge is closed off.** A raw edge of the sheet gets a wall down to whatever it rests on,
  which is what draws the outline of a folded flap lying on the paper below.
- **Two-tone paper.** Folding a flap turns it face down, so a different colour on the back makes
  every fold legible at a glance, the way origami diagrams do. Both colours are controls, and
  setting them equal gives plain white paper.

Getting the layer numbering right mattered too. Assigning one layer per face floats the thin tail
as high as the thick nose, so a flap is cut along the outlines of the paper it lands on, and the
numbering is compacted afterwards. The dart's layer histogram ends up the right shape: six faces on
the table, one at the sixteenth layer.

**3. Performance.** The CPU side is measured and comfortable. The GPU side is not measured,
because this environment only has a software rasterizer.

| Step | Faces | Triangles | Rebuild | Per-frame bend |
|---|---|---|---|---|
| Fold the top corners | 1 | 717 | 2.9 ms | 0.16 ms |
| Fold the slanted edges | 3 | 1,291 | 4.4 ms | 0.11 ms |
| Fold the plane in half | 11 | 2,608 | 8.2 ms | 0.18 ms |
| Fold the wings down | 29 | 4,281 | 12.1 ms | 0.32 ms |
| Open the wings | 150 | 8,296 | 32.2 ms | 1.28 ms |

Rebuilding the triangle list happens once per step change, not per frame. The per-frame cost is
only the arc map, which stays under 1.3 ms at the deepest step against a 16.7 ms budget. The whole
plane is one draw call of about eight thousand triangles, which is nothing for a real GPU, but
frame rate still needs confirming on actual hardware and on a phone.

## Bugs the spike caught

Every one of these was real, and most would have been hard to spot later:

- **Inverted winding.** Triangles were wound against the normals they carried, so double-sided
  shading flipped them and the paper lit from underneath. `scripts/check-winding.ts` now asserts
  every triangle's geometric normal agrees with its vertex normals.
- **Stacks stretching through a crease.** Sharing one arc radius across all layers stretched the
  outer layers of a thick fold by a centimetre. Each layer now bends on its own radius, which both
  removes the stretch and reproduces the real effect where the outer layers of a thick stack run
  slightly short.
- **Rolled edges left behind.** During the wing-opening rotation the rolled edges stayed put while
  the faces swung away, leaving stray hairlines. Rolls now follow the faces they join.
- **Grain sliding across the paper.** Texture coordinates were in model space, so the fibre grain
  slid when a flap folded over. They are now mapped back into paper space.
- **Rolled edges joining sheets that were never folded together.** Pairing them by layer adjacency
  is wrong twice over: a fold through a stack of four leaves its outermost sheets three layers
  apart, and two sheets that merely end up next to each other were never joined at all. Each crease
  now carries an id and a side, shared by exactly the two halves the fold separated.
- **The wrong side of the paper painted along every crease.** The outside of a fold is one
  continuous side of the sheet, because the flap turns over as it goes round. Blending towards the
  lower face's colour painted the other side of the paper along the crease.
- **Open steps between pieces of one sheet.** Splitting a flap to work out its layers leaves
  internal edges, and those were drawn as nothing at all. Where two pieces of the same sheet ended
  up at different heights, the step was left open and the layers underneath showed through it as a
  bright seam. Every edge now looks just past itself: flush with its neighbour means no wall, lower
  means a wall down to it, nothing there means the rim of the sheet.
- **Abutting flaps flickering where they meet.** Two flaps that butt against each other had exactly
  coincident walls. Each is now pulled back a hair into its own face, so the pair reads as a fine
  seam.
- **Paper keeping the wrong colour through a fold.** A flap shows its far side from the moment it
  passes vertical, but the colour was fixed per face for the whole step and only changed when the
  step committed. Both colours now travel on the geometry and the shader picks by which way the
  triangle faces, so the change happens where it should.
- **Edge walls ending up on top.** A wall hangs under the sheet it belongs to. Carried round by
  the fold it finished above the paper, which is both wrong and a jolt at the commit. Walls are
  now dropped after bending, so they stay underneath however far the fold has turned.
- **Rolled edges spanning creases a later fold had pulled apart.** Sharing a crease id is not
  enough once a fold has cut an old crease in two and carried half of it away; candidates are now
  checked against the line they actually lie on.
- **Shading flipping at the moment a step committed.** The worst artefact in the whole spike, and
  the least obvious: the paper changed brightness in one frame as a fold finished, which read as a
  flash. The side of the paper was right either way; what changed was the *tangent frame*. Faces
  were wound to face upwards, so a sheet lying face down was drawn front-to-camera once it
  committed, having been drawn back-to-camera for the whole fold. The fibre normal map's handedness
  flipped with it. Faces are now wound by the paper's own side, which ties the two together. In the
  frame sampler the jump at a step boundary fell from 40 of 255 in a block to 0.4, which is what
  neighbouring frames inside a fold measure.
- **The bend arc measured from the wrong stack.** The engine takes the crease's paper out layer by
  layer, using how deep the stack is *where each sheet sits*: one fold can run through the sixteen
  layers at a dart's nose and the two at its tail. The renderer's arc used a single depth for the
  whole fold, so every sheet away from the deepest point turned through the wrong radius and landed
  somewhere the committed state did not expect. Both sides now call the same `movingTopLayers`, and
  the arc reference travels per vertex.
- **Creases drawn as nothing at all.** A crease is rolled by joining the two halves the fold
  separated, and about a third of them never find their partner: a later fold can cut one half away
  entirely or drag it out of line. Those edges got no wall either, because walls skip creases, so
  the one edge on a sheet that is never sharp was being drawn knife sharp. Unpaired creases now get
  a rim of their own, turned through the same half-round, with its radius read from the local stack
  - the outermost sheet of a fold wraps everything inside it, a sheet in the middle of the stack
  wraps almost nothing.
- **The folded edge stopping short of the corner.** A crease is drawn by joining the two halves
  the fold separated, over the part they share. But a flap lands short of the crease it turned
  about by the paper it wrapped, and on a corner that shortens its half of the crease at *both
  ends*, so the two halves never share the whole length. The leftover stub got nothing at all:
  not a round, because the half counted as paired, and not a wall, because walls skip creases. So
  the thickness band around the paper ran out a few millimetres before each corner and the edge
  went knife sharp, most visibly at the start of step 2. The stub is exactly the crease allowance
  long, which grows with thickness: half a millimetre at the default, over three at the top of the
  slider. Coverage is now tracked along each crease and whatever pairing leaves bare is drawn by
  carrying the neighbouring round on to the end. `scripts/check-edges.ts` asserts that no folded
  edge is left bare, across the whole range of the thickness slider.
- **The rolled edge hanging off the side of its crease.** The round was measured from whichever
  half of the crease the pairing loop happened to reach first, then shifted half the step towards
  the upper sheet. That is right only when the first half reached is the lower one. When it was
  the upper one the shift went the wrong way, and the round ended up beside the crease rather than
  in it, by the full width of the step: at the spine of the folded dart, a bead of paper floating
  0.87 mm clear of the edge it was supposed to join, which is three sheet thicknesses. The round is
  now centred on the step between the two sheets, so it meets both whichever way round they come.
- **The thickness band streaked instead of grained.** Edge walls and crease rims took their
  texture coordinates from the model position, so every vertex down the band shared one
  coordinate and the paper fibre smeared into vertical streaks - a bevelled metal look, and worse
  the thicker the sheet. They now run along the band and across it, so a cut edge shows the grain
  end on.
- **Two-tone paper reading as a chamfer.** A strong contrast between the two sides was what made
  folds legible in the first place, but it also lights up every place a sheet wraps over: a crease,
  or a flap that lands a millimetre short of the one below. Those strips are real and only a
  millimetre or two wide, and at full contrast they read as a bevelled edge rather than as paper.
  The default back colour is now only just cooler than the front. Both are still controls.
- **Paper bending instead of folding over.** A sheet was drawn as one surface with a wall hanging
  under it, and the wall hung straight down whatever the paper was doing, so a flap in mid-air
  carried its thickness as a vertical skirt rather than as its own cut edge. Worse, the arc was
  measured from the top of the moving stack rather than from the middle of its top sheet, which
  lifted the whole fold half a thickness: the surface that started on top rolled round the outside
  of the crease and arrived still on top, and the flap came to rest a thickness clear of the sheet
  it had just been folded onto. At the top of the thickness slider that is 3 mm of daylight under
  a fold, and the paper reads as bent rather than folded. Each sheet is now a slab: the bend maps
  its middle, and its two sides are carried half a thickness either side of that along the paper's
  own normal, so they turn over with it. The crease round grew to match - it runs from the
  underside of the lower sheet to the top of the upper one, wrapping both thicknesses, where
  before it joined the two surfaces and left the sheets' cut edges bare inside the fold.
  `scripts/check-slab.ts` asserts all three: a sheet keeps its thickness through the bend, a fold
  turns its sides over, and the flap lands on the sheet below rather than above it.

## What the spike does not do yet

- **No `unfold` or `crease`**, so the dart skips the centre pre-crease. Adding it is M1 work.
- **Committed states must be flat.** A 180 degree fold of a flat model is a mirror, which is what
  makes the engine simple and exact. Non-flat rests need the `keyframe` escape hatch from the plan.
- **The layer rule is a good approximation, not a solver.** Folding into a pocket is not handled.
- **Thickness is exaggerated**, about three times real paper, which in turn exaggerates the crease
  allowance. A renderer aiming at photographic accuracy would need real thickness and a camera
  close enough to see it.
- **Layer order is settled before the crease allowance is applied**, so a fold that shifts paper
  far enough to change what covers what would be stacked on slightly stale information.
- **A step boundary is smooth but not identical.** Through the fold the crease is live geometry:
  the outer layers of a thick stack bulge a couple of millimetres past the fold line. At the commit
  the engine hands that paper to a rolled edge instead. Where the two halves of the crease pair up
  the round is the same size and nothing moves; where they do not, the rim is rebuilt from the
  local stack, which is close but not exact. Measured on rendered pixels the worst boundary changes
  by 11 of 255 in one block of a 32x24 grid, against 40 before this round and 0.3 for a pair of
  frames inside a fold. Pairing more creases is the way to close the rest.
- **No ambient occlusion.** Contact shadows and a real shadow map carry the grounding for now.
  Screen-space occlusion would deepen the layer stacks and is worth trying next.
- **One active fold line per face per step.** Ops in a step animate together, but their moving
  regions have to be disjoint, which is true for the symmetric folds a plane needs.

## Running it

```
npm run dev            # the app
npm run check          # engine, bend, slab, winding and mesh checks, no browser needed
npm run check:browser  # playback and controls in a real browser
npm run shoot <dir> '<json shots>'   # save frames for judging the look
npx tsx scripts/check-cover.ts       # which layers are actually visible from above
npx tsx scripts/check-edges.ts       # whether every folded edge carries its band end to end
npx tsx scripts/check-slab.ts        # whether a sheet keeps its thickness and turns over when folded
npx tsx scripts/check-continuity.ts  # how far the model moves at each step boundary
npx tsx scripts/check-frames.ts 0.96 1.04 0.01   # how much the rendered picture changes, frame to frame
```

Shots take `look` and `mesh` overrides, so a frame can be captured with the paper recoloured or
the layers tinted. Two settings earned their keep while chasing the seams above: colouring by
layer, and setting the front and back of the paper to strongly different colours, which shows at a
glance which side of the sheet a stray sliver belongs to.

The checks are plain scripts rather than a test runner so far; M1 moves them onto vitest.
