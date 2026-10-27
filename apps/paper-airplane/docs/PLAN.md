# Paper Airplane Folding App: Plan

Client-side web app that shows realistic, animated, step-by-step paper airplane folding
instructions in three.js, and lets users author new airplanes with a fold builder.
No backend for now. The single biggest question to answer first: **can rigid, procedurally
folded paper look realistic in three.js without hand-authored Blender animation?**

---

## 1. Goals and non-goals

**Goals (this phase)**

- Player: pick an airplane, watch it fold, scrub back and forth, change speed, jump to bookmarked steps.
- Builder: start from a flat sheet, pick fold lines, set fold angle, commit steps, export JSON.
- One data format (JSON) drives both. Anything the builder produces, the player can play.
- Realism: paper that reads as paper, folds that bend rather than snap, soft lighting and shadows.

**Non-goals (this phase)**

- Accounts, database, publishing, sharing. The JSON format is designed so these bolt on later.
- Physically simulated paper (cloth). We use rigid-origami kinematics plus visual tricks.
- Arbitrary origami. Airplanes first; the op set grows toward general origami over time.

---

## 2. Core architectural decision: exact engine, approximate renderer

Split the problem into two layers with a hard boundary:

1. **Fold engine (pure TypeScript, no three.js).** Owns the exact model: the sheet as a
   crease pattern of flat polygonal faces, each with a rigid transform into 3D and a layer
   index. Applying a step's operations to a state produces the next state. Deterministic,
   unit-testable, runs anywhere (later: server-side thumbnails).
2. **Renderer (three.js via react-three-fiber).** Takes engine states and a parameter
   `t ∈ [0,1]` for the in-progress step and produces something that looks like paper:
   bent creases instead of sharp hinges, layer thickness, PBR paper material, lighting.

The engine never knows about bend radii or textures. The renderer never mutates fold data.
This keeps the "does it look good" question isolated in one place and keeps the builder
and player on identical logic.

### Why not a physics simulation?

Origami Simulator (Ghassaei, MIT) proves mass-spring simulation of crease patterns can look
great, but it is hard to control: folds settle where physics says, timing is emergent, and
scrubbing backward means re-simulating. Instructional content needs fully deterministic,
scrubbable, reversible motion. Rigid kinematics gives that. We borrow the *look*
(rounded creases, subtle paper material) without the simulation.

---

## 3. Fold engine

### 3.1 Model

- **Paper space**: 2D coordinates on the unfolded sheet (mm). Sheet presets: A4, US Letter, square.
- **Face**: convex planar polygon in paper space + a rigid 3D transform (rotation + translation)
  + a `layer` integer (stacking order) + `side` (which face of the paper is "up" after flips).
- **Crease**: a segment in paper space shared by two faces, with a current dihedral angle and a
  type (mountain/valley/unfolded-crease-mark).
- **State**: `{ faces, creases }`. Immutable; each step produces a new state.
- Interop: the crease pattern part maps cleanly onto the FOLD file format (Demaine et al.), so
  import/export to other origami tools is possible later.

### 3.2 Operations (what a step is made of)

Each step contains one or more ops. Primitive ops:

| Op | Meaning |
|---|---|
| `fold` | Fold about a line, rotating everything on the moving side by `angle` (default 180, valley; negative for mountain). Splits every face the line crosses. |
| `unfold` | Reverse a previous fold, leaving a crease mark. |
| `crease` | `fold` + `unfold` in one step (pre-creasing). |
| `flip` / `rotate` | Turn the whole model over or rotate it in the view. Pure transform, no geometry change. |
| `keyframe` | Escape hatch: explicit per-face transforms at t=0 and t=1. For the odd non-rigid move (curling a wing tip, a pinch). |

Composite ops (phase 4) are expressed in terms of primitives plus a coupled motion:

| Op | Meaning |
|---|---|
| `insideReverseFold`, `outsideReverseFold` | Pre-crease, then a simultaneous multi-crease collapse driven by one parameter. |
| `squashFold`, `rabbitEar`, `petalFold` | Same pattern: named collapse with a small rigid-origami solver for the coupled angles. |

Fold lines are stored as **constructions**, not raw coordinates, so they remain meaningful
when the paper size changes and so the builder can snap to them:

- `throughPoints(a, b)` (Huzita–Hatori axiom 1)
- `pointOntoPoint(a, b)` (axiom 2: perpendicular bisector; the most common airplane fold)
- `lineOntoLine(l1, l2)` (axiom 3: angle bisector; "fold the edge to the center line")
- `perpendicularThrough(l, p)` (axiom 4)

Points are references such as `corner(topLeft)`, `midpoint(edge)`, `intersection(c1, c2)`,
or explicit coordinates. The engine resolves them against the current state.

### 3.3 Applying a fold

1. Resolve the line in paper space; pick the moving side via a reference point.
2. For every face crossed by the line, split it into two faces along the line. Create the crease.
3. All faces on the moving side (reachable from the reference point without crossing the line)
   get their 3D transform composed with a rotation of `angle` about the line's 3D position.
4. **Layer ordering**: moving faces reverse their relative order and are placed above the
   highest stationary layer they overlap. This simple rule is correct for the vast majority of
   airplane folds. Complex cases (folding into pockets) are deferred; the `keyframe` op or a
   manual `layer` override covers them until a proper layer solver exists.
5. Interpolation for animation: the renderer asks the engine for `stateAt(stepIndex, t)`, which
   returns faces with the rotation angle scaled by an easing of `t`. Because every op is a
   rotation about a line, intermediate states are always well defined.

### 3.4 Scrubbing and precomputation

States are precomputed for every step boundary at load time (tens of steps, hundreds of faces:
trivial). Scrubbing to any point is "take precomputed state N, apply step N+1 at parameter t".
Backward playback is free.

---

## 4. Renderer: making it look real

This is the feasibility spike. Everything here is a visual trick layered on rigid geometry.

### 4.1 Bent creases instead of hinges

Real paper does not rotate about a zero-width line. During a fold animation the renderer
replaces the rigid rotation with a **bend deformation**: vertices within a band of width `w`
on the moving side of the crease are mapped onto a circular arc of angle `angle · t`
(arc length preserved, so the paper does not stretch), and vertices beyond the band are
rotated rigidly about the arc's far end. As `t → 1` for a 180° fold the arc becomes a
half-cylinder of radius `w/π`, which is exactly what a real crease looks like in cross-section.
Faces crossing the band are subdivided into thin strips along the crease direction so the
arc is smooth. The band width is a tunable ("paper stiffness") and is the single biggest
contributor to realism.

At rest, the same deformation with a very small band gives creases a subtle fillet instead of a
knife edge.

### 4.2 Thickness and layers

Each face is offset along its normal by `layer × thickness` (thickness exaggerated to roughly
0.2–0.3 mm at sheet scale). This removes z-fighting and produces the visible stack of layers
at the airplane's nose that reads as "folded paper". Later refinement: outer layers of a fold
get a larger bend radius (`w + layersInside × thickness`), which is what real multi-layer folds do.

### 4.3 Material

- `MeshPhysicalMaterial`, near-white with a slight warm tint, roughness ≈ 0.85–0.95.
- `sheen` for the fibrous look, tuned low.
- Procedurally generated fiber normal map + subtle roughness map (noise, generated at startup;
  no asset pipeline).
- Two-sided: separate front and back materials so colored or printed paper is possible, and
  the back side is a touch darker to fake translucency where layers overlap.
- Optional: printed graphics (a UV-mapped texture in paper space) for decorated planes.

### 4.4 Lighting and post

- Soft studio HDRI environment (small local file or drei `Environment` preset).
- One key directional light with a soft shadow map, plus `AccumulativeShadows` or
  `ContactShadows` on the ground plane.
- MSAA; screen-space ambient occlusion (N8AO via `@react-three/postprocessing`) makes layer
  stacks pop. Evaluate cost on mobile; make it a quality toggle.
- Tone mapping ACES, subtle vignette.

### 4.5 Motion

- Ease-in-out per fold with a tiny settle at the end (overshoot 1–2°, then rest).
- Per-step optional camera pose; damped `OrbitControls` between poses so the user always keeps control.
- Crease-line overlay (dashed valley / dash-dot mountain) toggle, drawn in the engine's exact
  geometry, useful for both instruction clarity and the builder.

### 4.6 Go/no-go criteria for the spike

Build a single sheet with one animated fold using 4.1–4.5 and judge:

- Does the crease read as bent paper at 50 % and as a flat fold at 100 %?
- Do 4–6 stacked layers at a nose look like a stack, not like z-fighting soup?
- Does it hold 60 fps on a mid-range laptop and 30 fps on a phone?

If yes, proceed. If the bend deformation is the sticking point, fallback is a vertex-shader
implementation of the same math (cheap) before considering anything heavier.

---

## 5. Instruction format (JSON)

Versioned, validated with zod at load time. Sketch:

```jsonc
{
  "schemaVersion": 1,
  "id": "classic-dart",
  "name": "Classic Dart",
  "difficulty": 1,
  "paper": { "preset": "letter", "front": "#f5f2e8", "back": "#f5f2e8" },
  "steps": [
    {
      "id": "s1",
      "title": "Crease the center line",
      "text": "Fold in half lengthwise and unfold.",
      "bookmark": true,
      "durationMs": 1800,
      "camera": { "preset": "topDown" },
      "ops": [
        { "type": "crease",
          "line": { "kind": "pointOntoPoint", "a": "corner:topLeft", "b": "corner:topRight" } }
      ]
    },
    {
      "id": "s2",
      "title": "Fold the top corners to the center",
      "ops": [
        { "type": "fold",
          "line": { "kind": "throughPoints", "a": "corner:topLeft", "b": "point:centerTop" },
          "moving": "corner:topLeft", "angle": 180 },
        { "type": "fold",
          "line": { "kind": "throughPoints", "a": "corner:topRight", "b": "point:centerTop" },
          "moving": "corner:topRight", "angle": 180 }
      ]
    }
  ]
}
```

Notes:

- Multiple ops in one step animate simultaneously (symmetric folds) unless `sequential: true`.
- `bookmark`, `title`, `text`, `camera` are presentation metadata the player uses; the engine ignores them.
- Later additions (author, publishedAt, thumbnails, i18n text) are additive fields.

---

## 6. Player UI

- **Route**: `/planes/[slug]`. Gallery at `/`.
- **Layout**: 3D viewport dominates; step list in a collapsible sidebar (title + text, current
  step highlighted, bookmarks starred); transport bar under the viewport.
- **Transport**: play/pause, previous/next step, scrub slider over the whole plane with step
  ticks and bookmark markers, speed (0.25×–3×), loop-this-step, camera reset, crease overlay toggle.
- **Keyboard**: space, ←/→ (step), Shift+←/→ (scrub), `[`/`]` (speed), `B` (bookmark list), `R` (reset camera).
- **URL state**: `?step=4` for deep links.
- **Store**: zustand; `{ planeId, stepIndex, t, playing, speed, loop }`. A `useFrame` loop
  advances `t` by `dt × speed / durationMs` and rolls over steps.

---

## 7. Builder UI

- **Route**: `/builder` (and `/builder?load=<id>` to edit a local draft).
- Same viewport and engine as the player, in edit mode.
- **Fold line selection** (the core interaction):
  1. Choose a construction (through two points, point onto point, edge onto edge, perpendicular).
  2. Click targets on the 3D model with snapping to corners, edge midpoints, crease endpoints and
     intersections. Snap candidates are engine-provided and drawn as small handles. A raycast
     hit is projected into paper space, then snapped.
  3. Preview the line on the paper; hover over a side to choose what moves.
  4. Angle slider (default 180, mountain/valley toggle, live preview at that angle).
  5. Commit → step appended. Title/text/bookmark editable in the sidebar. Reorder and delete steps.
- **Undo/redo**: steps are an immutable list, so history is just the list of lists.
- **Persistence**: localStorage drafts; export/import JSON; "Play this" opens the player on the draft.
- **Complex ops**: initially via named composites with parameters (pick the crease set and a
  driving angle); the generic collapse tool comes with the solver in phase 4.
- **Validation**: engine flags impossible folds (line does not cross the paper, would pass a face
  through another layer) and shows why.

---

## 8. Stack and project structure

- Next.js (App Router) + TypeScript, strict.
- `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.
- `zustand` (UI state), `zod` (schema), `vitest` (engine tests), `leva` (dev-only tuning panel).
- Tailwind for the shell. The three.js canvas is loaded with `dynamic(..., { ssr: false })`.

```
app/
  page.tsx                  gallery
  planes/[slug]/page.tsx    player
  builder/page.tsx          builder
src/
  engine/                   pure TS: geometry, crease pattern, ops, layer ordering, solver
  schema/                   zod schemas + TS types for the instruction format
  three/                    PaperMesh, bend deformation, materials, lighting, scene, camera presets
  player/                   transport, timeline, step list, store
  builder/                  selection tools, snapping, step editor, store
  content/planes/*.json     hand-authored planes
docs/                       this plan, schema docs
```

`src/engine` has no imports from `three`. If it grows, it becomes a workspace package.

---

## 9. Milestones

**M0. Realism spike. Done — see `docs/M0-RESULTS.md`.** Delivered wider than planned: rather than
one fold and a mocked three-layer stack, the spike runs the whole classic dart through a real
fold engine, because the layer criterion in 4.6 is only meaningful against genuine stacked
geometry. Verdict: go.

**M1. Engine.** Partly built by M0: faces, creases, `fold`, mirror-based state transitions, the
layer rule with flap refinement and compaction, and `rotate` for presentation. Still to do:
paper presets, `unfold`/`crease`/`flip`, fold-line constructions and point references, the JSON
schema with zod, and moving the checks in `scripts/` onto vitest.

**M2. Player.** Renderer consumes engine states; transport, scrubbing, speed, bookmarks, step
list, keyboard, URL state. Author two planes by hand in JSON (classic dart, a glider) and a
third with a non-trivial fold to stress the layer rule.

**M3. Builder.** Selection tools with snapping, side pick, angle, preview, commit, edit
metadata, undo/redo, localStorage, JSON export/import, "play this".

**M4. Depth.** Composite ops and the rigid-origami collapse solver, `keyframe` escape hatch,
per-layer bend radius, per-step camera authoring in the builder, thumbnails rendered from the
engine, quality toggles for mobile.

**Later.** Accounts, storage, publishing from builder to gallery, moderation, comments.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rigid folds look mechanical | Bend deformation (4.1) and easing (4.5); this is what M0 tests. |
| Layer ordering wrong for tucked/pocket folds | Simple rule now, manual `layer` override, proper solver later. Airplanes rarely need it. |
| Faces intersect mid-animation on multi-layer folds | All moving layers rotate together about the same line with offsets, so simple folds are intersection-free. Composite ops go through the solver. |
| Non-rigid moves (curls, pinches) | `keyframe` op as an escape hatch. |
| Builder snapping feels imprecise on a 3D model | Snap in paper space, not screen space; show candidates; allow numeric entry. |
| Mobile performance | Small meshes; SSAO and accumulative shadows behind a quality toggle. |
| Format lock-in | Constructions instead of coordinates; versioned schema; FOLD-compatible crease pattern. |

---

## 11. Open questions, with what M0 settled

- Bend on CPU or in a vertex shader? **Settled: CPU.** The per-frame arc map costs under
  1.1 ms at the deepest step, well inside a 16.7 ms frame.
- One mesh or one per face? **Settled: one mesh.** The whole plane is a single draw call;
  the builder writes every face and rolled edge into one buffer.
- Where does easing live? **Settled: the renderer.** The engine's `stateAt` stays linear
  and testable; `PaperModel` applies smootherstep.

Still open:

- Whether a proper layer solver is needed before general origami, or whether flap refinement
  plus compaction carries far enough.
- Whether cut edges need real thickness, or whether rolled crease edges alone are enough.
- Whether screen-space ambient occlusion earns its cost on mobile.

## 12. Original open questions (superseded by section 11)

- Bend deformation on CPU (simple, fine for hundreds of vertices) or vertex shader (needed only
  if we subdivide heavily)? Start CPU.
- One mesh with material groups vs. one mesh per face? Start one mesh per face for simplicity;
  merge if draw calls matter.
- Should `t` easing live in the engine (`stateAt`) or renderer? Renderer, so the engine stays linear and testable.
