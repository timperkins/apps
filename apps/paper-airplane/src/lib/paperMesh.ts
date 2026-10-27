/**
 * Turning fold states into paper-looking geometry.
 *
 * The engine only ever produces flat states, so everything that makes the model
 * read as paper happens here:
 *
 *  - Creases bend along a circular arc instead of rotating about a zero-width
 *    hinge. Arc length is preserved, so at 180 degrees the band becomes a
 *    half-cylinder, which is what a real crease looks like in cross-section.
 *  - Layers are lifted by their stacking index so a folded nose is a visible
 *    stack rather than a pile of coplanar faces.
 *  - Every sheet is drawn as a slab: the bend maps the paper's middle, and its
 *    two sides are carried half a thickness either side of it, along the
 *    paper's own normal. A flap that turns over therefore turns its sides over
 *    too, which is the whole of what a fold does to a sheet.
 *  - Folded edges get a rolled strip joining the two layers, so the model has
 *    no knife edges when it is sitting still.
 *
 * The expensive part, working out which triangles exist, depends only on the
 * step and the tuning values, so it is done once in `buildFlatMesh`. Per frame
 * `applyBend` just pushes those vertices through the arc map.
 */

import {
  Face,
  faceIsMirrored,
  faceWorldPoly,
  FoldState,
  movingTopLayers,
  rotateSignFor,
  Step,
} from "./fold";
import {
  invertIso,
  Iso2,
  Line2,
  offsetLine,
  pointInPoly,
  orientTowards,
  Poly,
  polyArea,
  polyCentroid,
  pullbackLine,
  signedDist,
  splitPoly,
  V2,
} from "./geom";

export type BendOp = {
  /** Oriented so that the paper which moves is on the positive side. */
  line: Line2;
  /** Full rotation for this op in degrees, always positive. */
  target: number;
  /** Highest layer among faces rotating upward; keeps the arc radius positive. */
  dMaxPlus: number;
  /** Lowest layer among faces rotating downward. */
  dMinMinus: number;
  /**
   * Top layer of the local moving stack, per face id, for folds.
   *
   * A fold can run through a thick part of the model and a thin part at once,
   * and each sheet turns through the radius its own stack gives it. The engine
   * takes the crease's paper out layer by layer on exactly this basis, so the
   * arc has to use the same number or the model shifts when the step commits.
   * Rotations do not restack, so they leave this undefined and use the two
   * bounds above.
   */
  topLayer?: Map<string, number>;
};

export type FlatMesh = {
  count: number;
  /** Flat model position, (x, layerHeight, z). */
  pos: Float32Array;
  nrm: Float32Array;
  /**
   * Offset from the sheet's middle along the paper's own normal.
   *
   * `pos` holds the middle of the sheet, which is the surface the arc maps. A
   * slab's two sides sit half a thickness either side of it, and the wall round
   * a cut edge runs between them. Because the offset turns with the paper, the
   * side that was uppermost ends up underneath once the flap has folded over,
   * and lands exactly where the committed state restacks it.
   */
  off: Float32Array;
  /**
   * Distance straight down in the model, applied after bending.
   *
   * Only the skirt that closes the gap under a flap overhanging a step uses
   * this. It stands in for paper that is not there, so it hangs where it is
   * drawn rather than turning over with the sheet above it.
   */
  drop: Float32Array;
  /**
   * Middle of the top sheet of the stack this vertex bends with.
   *
   * Together with the band width it fixes the arc radius, and so how far short
   * the flap lands. It is per vertex rather than per op because one fold can
   * cross stacks of different depths.
   */
  ref: Float32Array;
  uv: Float32Array;
  /** Colour of the side facing up as generated. */
  col: Float32Array;
  /**
   * Colour of the other side.
   *
   * A flap turning over shows its far side long before the step commits, so the
   * shader picks between the two by which way the triangle faces. Without this
   * the paper keeps the wrong colour through the fold and then changes the
   * instant the step ends.
   */
  colBack: Float32Array;
  /** Index into `ops`, or -1 when the vertex does not move this step. */
  op: Int8Array;
  /** Rotation direction: 1, -1, or 0. */
  sgn: Int8Array;
  ops: BendOp[];
  /** Diagnostics for the dev readout. */
  stats: {
    faces: number;
    triangles: number;
    rolls: number;
    walls: number;
    creaseEdges: number;
    /**
     * Crease length covered by carrying a round on past where the two halves
     * of the fold overlap, millimetres.
     *
     * A flap lands short of its crease by the paper it wrapped, so on a corner
     * its half of the crease is shorter than the sheet's at both ends. This is
     * how much folded edge would otherwise have been left bare.
     */
    creaseStubMm: number;
    /**
     * Longest single stretch of folded edge still left with no band.
     *
     * A sum would hide the thing that shows: one break long enough to see,
     * rather than a scattering of slivers each narrower than a pixel.
     */
    creaseGapMm: number;
    /** Vertices belonging to faces; rolled-edge vertices follow these. */
    faceVertices: number;
    /** Wall-clock cost of this build, milliseconds. */
    buildMs: number;
  };
};

export type MeshOptions = {
  /** Exaggerated sheet thickness in millimetres. */
  thickness: number;
  /** Width of the bending band while the paper is in motion, millimetres. */
  bandStart: number;
  /** Strips across the band; more means a smoother arc. */
  strips: number;
  /** Segments around a rolled edge. */
  rollArcSegments: number;
  /** Target length of a roll or wall segment along an edge, millimetres. */
  rollStepMm: number;
  /**
   * How much an edge darkens towards the crevice it sits in, 0 to 1. This is a
   * stand-in for the occlusion under a folded flap, and it is what makes the
   * edge of folded paper read as a line rather than blending into the sheet.
   */
  edgeShade: number;
  frontTint: [number, number, number];
  backTint: [number, number, number];
  /** Colour each layer differently instead of by paper side, for debugging. */
  debugLayers: boolean;
};

/** A distinct colour per layer, spread around the hue circle. */
export function layerTint(layer: number): [number, number, number] {
  const hue = ((layer * 67) % 360) / 60;
  const c = 0.6;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = 0.25;
  const [r, g, b] =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [r + m, g + m, b + m];
}

export const DEFAULT_MESH_OPTIONS: MeshOptions = {
  // Exaggerated about three times over real paper, which is around 0.1 mm.
  // Thickness sets both how far a fold lifts and how much paper each crease
  // wraps, so raising it much further starts eating visible chunks out of the
  // sheet at the nose, where sixteen layers fold at once.
  thickness: 0.3,
  bandStart: 9,
  strips: 12,
  rollArcSegments: 5,
  rollStepMm: 6,
  edgeShade: 0.3,
  frontTint: [1, 1, 1],
  backTint: [0.55, 0.62, 0.68],
  debugLayers: false,
};

type Piece = {
  world: Poly;
  /** Model space back to paper space, so the fibre grain follows the paper. */
  toPaper: Iso2;
  /** Height of the middle of the sheet; its sides sit half a thickness away. */
  d: number;
  /** Colour of the side currently facing up, used by this piece's edges. */
  tint: [number, number, number];
  /** True when the paper is lying front side down. */
  mirrored: boolean;
  op: number;
  sgn: number;
  /** Middle of the top sheet of the local stack; sets this piece's radius. */
  ref: number;
};

const DEG = Math.PI / 180;

/**
 * Heights and gaps for every layer in a state.
 *
 * `height[k]` is where layer k's surface sits; `gap[k]` is the space between
 * layer k and the one above it, which is also how thick layer k's edge wall is.
 *
 * The spacing is even. It has to be: a fold turns a stack over, so the layer
 * that was on the bottom ends up on top, and only even spacing puts it back
 * exactly where the committed state expects it. Uneven spacing would make the
 * model jump at the end of every step.
 */
export type LayerHeights = { height: number[]; gap: number[] };

export function layerHeights(o: MeshOptions, maxLayer: number): LayerHeights {
  const height: number[] = [0];
  const gap: number[] = [];
  for (let k = 0; k <= maxLayer; k++) {
    gap.push(o.thickness);
    height.push(height[k] + o.thickness);
  }
  return { height, gap };
}

/**
 * How wide the bending band ends up once a fold is pressed flat.
 *
 * Half a sheet's thickness is the radius the middle of the innermost sheet of
 * a fold turns through - its outer side wraps a full thickness and its inner
 * side pinches shut - and a half turn wraps pi times that much paper. The
 * engine takes exactly this much out of the flat model as the crease's own
 * paper, so matching it here is what makes the animation finish precisely on
 * the committed state instead of snapping to it.
 */
export const bandEndFor = (o: MeshOptions): number => (Math.PI * o.thickness) / 2;

/**
 * How far down an edge has to be closed off, or null when it needs no wall.
 *
 * Looking just past the edge answers both questions at once. If the paper out
 * there is as high as this face, the two sit flush and there is no step to
 * show. If it is lower, the wall has to reach down to it, however many layers
 * that spans. If there is nothing out there at all, the edge is the rim of the
 * sheet and shows a single thickness.
 *
 * Without this, a step between two pieces of the same sheet is left open and
 * the layers underneath show through it as a bright seam.
 */
function wallBottom(
  faceIndex: number,
  edgeMid: V2,
  outward: V2,
  worlds: Poly[],
  state: FoldState,
  layers: LayerHeights,
): number | null {
  const face = state.faces[faceIndex];
  const d = layers.height[face.layer];
  const probe: V2 = { x: edgeMid.x + outward.x * 0.05, y: edgeMid.y + outward.y * 0.05 };

  let below = -Infinity;
  for (let j = 0; j < state.faces.length; j++) {
    if (j === faceIndex) continue;
    if (!pointInPoly(probe, worlds[j])) continue;
    const h = layers.height[state.faces[j].layer];
    if (h >= d - 1e-9) return null; // flush with, or covered by, its neighbour
    below = Math.max(below, h);
  }
  return Number.isFinite(below) ? below : d - layers.gap[0];
}

/**
 * How deep a crease edge has to curve when it is drawn on its own.
 *
 * A fold turns the whole local stack over, so the sheet on top of the stack
 * ends up underneath and the crease that joins them wraps everything between:
 * the outermost sheet gets the widest round and a sheet in the middle of the
 * stack gets a tight one. Reading the stack at the edge recovers which sheet
 * this one turned over with, and the drop between the two is the diameter of
 * its round, which is the same radius the bend just animated. Anything else
 * would make the crease jump as the step commits.
 *
 * The round runs from the top of this sheet's slab to the underside of its
 * partner's, because the paper wraps the crease on its outside: a sheet's own
 * thickness is part of what turns over, so it is part of what the round has to
 * cover. Measured from surface to surface instead, the round would sit inside
 * the fold and leave both sheets' cut edges showing as knife edges.
 */
function creaseRimDepth(
  faceIndex: number,
  edgeMid: V2,
  outward: V2,
  worlds: Poly[],
  state: FoldState,
  layers: LayerHeights,
): number {
  const face = state.faces[faceIndex];
  // Just inside the edge, so the face itself is part of what is measured.
  const probe: V2 = { x: edgeMid.x - outward.x * 0.05, y: edgeMid.y - outward.y * 0.05 };
  let lo = face.layer;
  let hi = face.layer;
  for (let j = 0; j < state.faces.length; j++) {
    if (j === faceIndex || !pointInPoly(probe, worlds[j])) continue;
    lo = Math.min(lo, state.faces[j].layer);
    hi = Math.max(hi, state.faces[j].layer);
  }
  // Turning the stack over swaps a sheet with its opposite number in it.
  const partner = lo + hi - face.layer;
  const drop = Math.abs(layers.height[partner] - layers.height[face.layer]);
  // A lone sheet has only its own thickness to turn through.
  return drop + layers.gap[0];
}

/** Active ops for a step, already oriented so the moving paper is positive. */
function activeOps(state: FoldState, step: Step | null, layers: LayerHeights): BendOp[] {
  if (!step) return [];
  const ops: BendOp[] = [];
  for (const op of step.ops) {
    if (op.kind === "fold") {
      const line = orientTowards(op.line, op.movingRef);
      const topLayer = movingTopLayers(state.faces, line);
      let dMaxPlus = 0;
      for (const top of topLayer.values()) {
        dMaxPlus = Math.max(dMaxPlus, layers.height[top]);
      }
      ops.push({ line, target: Math.abs(op.angle), dMaxPlus, dMinMinus: 0, topLayer });
    } else {
      const line = orientTowards(op.line, op.modelRef);
      let dMaxPlus = 0;
      let dMinMinus = Infinity;
      for (const f of state.faces) {
        const s = rotateSignFor(op, f);
        if (s > 0) dMaxPlus = Math.max(dMaxPlus, layers.height[f.layer]);
        if (s < 0) dMinMinus = Math.min(dMinMinus, layers.height[f.layer]);
      }
      ops.push({
        line,
        target: Math.abs(op.angle),
        dMaxPlus,
        dMinMinus: Number.isFinite(dMinMinus) ? dMinMinus : 0,
      });
    }
  }
  return ops;
}

export function buildFlatMesh(
  state: FoldState,
  step: Step | null,
  o: MeshOptions,
): FlatMesh {
  const startedAt = performance.now();
  const maxLayer = state.faces.reduce((m, f) => Math.max(m, f.layer), 0);
  const layers = layerHeights(o, maxLayer);
  // Every height here is the middle of a sheet, half a thickness under the top
  // of the layer it occupies. The two sides of the slab are carried out to
  // either side of it by the bend.
  const halfT = o.thickness / 2;
  const ops = activeOps(state, step, layers);
  const isRotate = step?.ops[0]?.kind === "rotate";

  const pos: number[] = [];
  const nrm: number[] = [];
  const off: number[] = [];
  const drop: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const colBack: number[] = [];
  const opIdx: number[] = [];
  const sgnIdx: number[] = [];
  const refHeights: number[] = [];

  const push = (
    world: V2,
    paper: V2,
    d: number,
    nx: number,
    ny: number,
    nz: number,
    tint: [number, number, number],
    op: number,
    sgn: number,
    below = 0,
    tintBack: [number, number, number] = tint,
    ref = 0,
    above = 0,
  ) => {
    pos.push(world.x, d, world.y);
    nrm.push(nx, ny, nz);
    off.push(above);
    drop.push(below);
    uv.push(paper.x, paper.y);
    col.push(tint[0], tint[1], tint[2]);
    colBack.push(tintBack[0], tintBack[1], tintBack[2]);
    opIdx.push(op);
    sgnIdx.push(sgn);
    refHeights.push(ref);
  };

  /**
   * The height the arc for `face` is measured from under op `opIndex`.
   *
   * For a fold that is the middle of the top sheet of the face's own local
   * stack, matching what the engine wrapped into the crease. A rotation keeps
   * the whole model rigid, so its two bounds serve every face.
   *
   * It is the sheet's middle rather than the top of its layer because that is
   * the surface the arc maps: the stack turns over about the plane where it
   * comes to rest on itself, which is half a thickness above that middle, and
   * that is exactly the innermost sheet's own radius once the crease is
   * pressed flat. Measuring from the layer top instead puts the whole fold half
   * a thickness proud of the crease, and the sheet's upper side rolls round the
   * outside of the crease and stays uppermost, when folding over should have
   * turned it underneath.
   */
  const refHeight = (face: Face, opIndex: number, sgn: number): number => {
    if (opIndex < 0 || sgn === 0) return 0;
    const bend = ops[opIndex];
    if (bend.topLayer) {
      return layers.height[bend.topLayer.get(face.id) ?? face.layer] - halfT;
    }
    return sgn > 0 ? bend.dMaxPlus - halfT : bend.dMinMinus + halfT;
  };

  // --- Faces -------------------------------------------------------------
  const pieces: Piece[] = [];
  for (const face of state.faces) {
    const d = layers.height[face.layer] - halfT;
    const mirrored = faceIsMirrored(face);
    const tint = o.debugLayers ? layerTint(face.layer) : mirrored ? o.backTint : o.frontTint;

    const toPaper = invertIso(face.xf);

    if (isRotate) {
      const op = step!.ops[0];
      const sgn = op.kind === "rotate" ? rotateSignFor(op, face) : 0;
      pieces.push({
        world: faceWorldPoly(face),
        toPaper,
        d,
        tint,
        mirrored,
        op: sgn === 0 ? -1 : 0,
        sgn,
        ref: refHeight(face, sgn === 0 ? -1 : 0, sgn),
      });
      continue;
    }

    // Peel off the part that each fold op moves; whatever survives stays put.
    let rest: Poly | null = face.poly;
    for (let i = 0; i < ops.length && rest; i++) {
      const paperLine = pullbackLine(face.xf, ops[i].line);
      // Copied into a plainly typed local so the split's result type does not
      // depend on the variable it will be assigned back into.
      const current: Poly = rest;
      const flags: boolean[] = current.map(() => false);
      const { pos: movingPart, neg } = splitPoly(current, flags, paperLine, false);
      if (movingPart) {
        pieces.push({
          world: movingPart.poly.map((p) => applyXf(face.xf, p)),
          toPaper,
          d,
          tint,
          mirrored,
          op: i,
          sgn: 1,
          ref: refHeight(face, i, 1),
        });
      }
      rest = neg ? neg.poly : null;
    }
    if (rest) {
      pieces.push({
        world: rest.map((p) => applyXf(face.xf, p)),
        toPaper,
        d,
        tint,
        mirrored,
        op: -1,
        sgn: 0,
        ref: 0,
      });
    }
  }

  // Cut the moving pieces into strips across the bending band so the arc is
  // smooth. Distances are the same in paper space and model space.
  let triangles = 0;
  for (const piece of pieces) {
    const strips: Poly[] = [];
    if (piece.op < 0 || piece.sgn === 0) {
      strips.push(piece.world);
    } else {
      const bend = ops[piece.op];
      // Outer layers of a stack travel further through the bend, so the band
      // they occupy is wider. Subdivide out to the widest case for this piece,
      // graded towards the crease where the curvature is.
      // The far side of the slab is half a thickness further out again.
      const spread = (piece.sgn > 0 ? piece.ref - piece.d : piece.d - piece.ref) + halfT;
      const extent = o.bandStart + Math.max(0, spread) * Math.PI;
      let remaining: Poly | null = piece.world;
      for (let j = 1; j <= o.strips && remaining; j++) {
        const cut = offsetLine(bend.line, extent * Math.pow(j / o.strips, 1.6));
        const current: Poly = remaining;
        const flags: boolean[] = current.map(() => false);
        const { pos: beyond, neg: inside } = splitPoly(current, flags, cut, false);
        if (inside) strips.push(inside.poly);
        remaining = beyond ? beyond.poly : null;
      }
      if (remaining) strips.push(remaining);
    }

    for (const strip of strips) {
      if (strip.length < 3) continue;
      // Wind so the triangle's front is the paper's front, not simply upwards.
      // A sheet lying face down is then drawn back-to-front, exactly as it is
      // mid-fold once it has turned past vertical. Tying the two together keeps
      // the fibre texture's tangent frame, and so the shading, from flipping
      // when a step commits. In this 2D frame (x, z) a positive shoelace area
      // points the face downward.
      const faceUp = polyArea(strip) <= 0;
      const ordered = faceUp !== piece.mirrored ? strip : [...strip].reverse();
      const up = piece.mirrored ? -1 : 1;
      // Texture coordinates are paper coordinates, so the grain stays glued to
      // the sheet instead of sliding when a flap folds over.
      const uvOf = (w: V2) => applyXf(piece.toPaper, w);
      for (let i = 1; i + 1 < ordered.length; i++) {
        const a = ordered[0];
        const b = ordered[i];
        const c = ordered[i + 1];
        // Skip hairline triangles: they contribute nothing but shimmer.
        const twiceArea = Math.abs(
          (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
        );
        if (twiceArea < 2e-3) continue;
        const emitVert = (q: V2, above: number) =>
          push(
            q,
            uvOf(q),
            piece.d,
            0,
            up,
            0,
            o.debugLayers ? piece.tint : o.frontTint,
            piece.op,
            piece.sgn,
            0,
            o.debugLayers ? piece.tint : o.backTint,
            piece.ref,
            above,
          );
        // The same triangle twice, half a thickness either side of the middle
        // of the sheet: the paper's two sides. Both keep the winding of the
        // paper's front, so which side of the paper a fragment shows is decided
        // exactly as it is for a single sheet - by which way it is facing - and
        // the shading of the far side of the slab, which is the one facing into
        // the sheet, is turned round with it.
        emitVert(a, halfT);
        emitVert(b, halfT);
        emitVert(c, halfT);
        emitVert(a, -halfT);
        emitVert(b, -halfT);
        emitVert(c, -halfT);
        triangles += 2;
      }
    }
  }

  // --- Edges: rolled creases and thickness walls --------------------------
  const faceVertices = opIdx.length;
  const edges = emitEdges(state, step, ops, o, layers, push, refHeight);
  triangles += edges.triangles;

  return {
    count: opIdx.length,
    pos: new Float32Array(pos),
    nrm: new Float32Array(nrm),
    off: new Float32Array(off),
    drop: new Float32Array(drop),
    ref: new Float32Array(refHeights),
    uv: new Float32Array(uv),
    col: new Float32Array(col),
    colBack: new Float32Array(colBack),
    op: Int8Array.from(opIdx),
    sgn: Int8Array.from(sgnIdx),
    ops,
    stats: {
      faces: state.faces.length,
      triangles,
      rolls: edges.rolls,
      walls: edges.walls,
      creaseEdges: edges.creaseEdges,
      creaseStubMm: edges.creaseStubMm,
      creaseGapMm: edges.creaseGapMm,
      faceVertices,
      buildMs: performance.now() - startedAt,
    },
  };
}

function applyXf(xf: import("./geom").Iso2, p: V2): V2 {
  return { x: xf.a * p.x + xf.b * p.y + xf.tx, y: xf.c * p.x + xf.d * p.y + xf.ty };
}

type PushFn = (
  world: V2,
  paper: V2,
  d: number,
  nx: number,
  ny: number,
  nz: number,
  tint: [number, number, number],
  op: number,
  sgn: number,
  below?: number,
  tintBack?: [number, number, number],
  ref?: number,
  above?: number,
) => void;

/** One rolled edge: where it runs, which layers it joins, and how it faces. */
export type RollSpec = {
  creaseId: number;
  p0: V2;
  p1: V2;
  upperD: number;
  lowerD: number;
  upperLayer: number;
  lowerLayer: number;
  outward: V2;
  upperTint: [number, number, number];
  sgn: number;
};

type Corner = { world: V2; d: number; nx: number; ny: number; nz: number };

/**
 * True when winding a triangle in this order gives it a geometric normal
 * pointing the same way as the normals its corners carry.
 */
function agrees(a: Corner, b: Corner, c: Corner): boolean {
  const ax = b.world.x - a.world.x;
  const ay = b.d - a.d;
  const az = b.world.y - a.world.y;
  const bx = c.world.x - a.world.x;
  const by = c.d - a.d;
  const bz = c.world.y - a.world.y;
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  const nx = a.nx + b.nx + c.nx;
  const ny = a.ny + b.ny + c.ny;
  const nz = a.nz + b.nz + c.nz;
  return cx * nx + cy * ny + cz * nz >= 0;
}

/**
 * The parts of [lo, hi] that none of `covered` reaches.
 *
 * Used to find the stubs of a crease that pairing left bare. The intervals are
 * merged first, so overlapping rounds do not leave phantom gaps between them.
 */
function gapsIn(
  lo: number,
  hi: number,
  covered: Array<[number, number]>,
): Array<[number, number]> {
  const inside = covered
    .filter(([a, b]) => b > lo && a < hi)
    .map(([a, b]): [number, number] => [Math.max(a, lo), Math.min(b, hi)])
    .sort((p, q) => p[0] - q[0]);
  const gaps: Array<[number, number]> = [];
  let at = lo;
  for (const [a, b] of inside) {
    if (a > at) gaps.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < hi) gaps.push([at, hi]);
  return gaps;
}

/** How far a drawn round is from an interval, zero when they touch. */
function gapTo(round: { lo: number; hi: number }, lo: number, hi: number): number {
  return Math.max(0, round.lo - hi, lo - round.hi);
}

/**
 * Perpendicular to one edge of a polygon, pointing out of it.
 *
 * Taken from which way round the polygon is wound rather than from where its
 * centre lies: on a long thin sliver the centre sits almost on the edge, and
 * the direction away from it becomes noise.
 */
function outwardOfEdge(poly: Poly, i: number, orientation: number): V2 | null {
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-6) return null;
  // Interior lies to the left of each edge when the winding is positive.
  return { x: (orientation * ey) / len, y: (-orientation * ex) / len };
}

/**
 * Draw the edges of the paper.
 *
 * Two kinds matter. A crease joins two layers, and gets a rolled half-cylinder
 * so folded edges are rounded rather than knife sharp. A raw edge is a cut edge
 * of the original sheet, and gets a wall the height of the paper's thickness,
 * which is what makes the outline of a folded flap visible where it lies on the
 * sheet below. Both darken towards the crevice they sit in.
 *
 * The two faces meeting at a crease can be cut into different pieces by later
 * folds, so matching whole edges is not enough. Instead every crease edge is
 * filed under the infinite line it lies on, and pieces of paper that lie on the
 * same line one layer apart are joined over the interval they share.
 */
function emitEdges(
  state: FoldState,
  step: Step | null,
  ops: BendOp[],
  o: MeshOptions,
  layers: LayerHeights,
  push: PushFn,
  refHeight: (face: Face, opIndex: number, sgn: number) => number,
): {
  rolls: number;
  walls: number;
  triangles: number;
  creaseEdges: number;
  creaseStubMm: number;
  creaseGapMm: number;
} {
  type Seg = {
    a: V2;
    b: V2;
    layer: number;
    /** Height of the middle of this sheet. */
    d: number;
    centroid: V2;
    tint: [number, number, number];
    /** Out of the face this edge belongs to. */
    out: V2;
    creaseId: number;
    /** Which half of the fold this piece came from. */
    side: "moving" | "stationary";
    /** Rotation direction of the face this edge belongs to, for rotate steps. */
    sgn: number;
    /** The face this edge bounds, for working out how it bends. */
    face: Face;
    /** How far this edge has to reach down if it ends up drawn on its own. */
    depth: number;
  };
  const groups = new Map<number, Seg[]>();
  const halfT = o.thickness / 2;
  let creaseEdges = 0;
  let triangles = 0;

  const rotateOp = step?.ops[0]?.kind === "rotate" ? step.ops[0] : null;

  /**
   * Which movement a piece of edge follows. During a fold that is decided by
   * which side of the fold line it sits on; during a rotation it has to follow
   * the face it belongs to, or it is left behind as a stray sliver while the
   * paper swings away.
   */
  const assignAt = (
    p: V2,
    face: Face,
    faceSgn: number,
  ): { op: number; sgn: number; ref: number } => {
    if (rotateOp) {
      const op = faceSgn === 0 ? -1 : 0;
      return { op, sgn: faceSgn, ref: refHeight(face, op, faceSgn) };
    }
    for (let i = 0; i < ops.length; i++) {
      if (signedDist(ops[i].line, p) > 0) {
        return { op: i, sgn: 1, ref: refHeight(face, i, 1) };
      }
    }
    return { op: -1, sgn: 0, ref: 0 };
  };

  const shaded = (
    tint: [number, number, number],
    amount: number,
  ): [number, number, number] => [tint[0] * amount, tint[1] * amount, tint[2] * amount];


  // --- Collect crease edges, and draw walls on raw edges as we go -----------
  let walls = 0;
  const worlds = state.faces.map(faceWorldPoly);
  for (let fi = 0; fi < state.faces.length; fi++) {
    const face = state.faces[fi];
    const world = worlds[fi];
    const orientation = polyArea(world) >= 0 ? 1 : -1;
    const centroid = polyCentroid(world);
    const tint = o.debugLayers
      ? layerTint(face.layer)
      : faceIsMirrored(face)
        ? o.backTint
        : o.frontTint;
    const faceSgn = rotateOp ? rotateSignFor(rotateOp, face) : 0;
    const d = layers.height[face.layer] - halfT;

    for (let i = 0; i < world.length; i++) {
      const label = face.edges[i];
      const a = world[i];
      const b = world[(i + 1) % world.length];

      // Creases are rolled; every other edge may need a wall, including the
      // bookkeeping cuts, because those can sit at a step between layers.
      if (label.kind !== "crease") {
        const out = outwardOfEdge(world, i, orientation);
        if (!out) continue;
        const mid: V2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const bottom = wallBottom(fi, mid, out, worlds, state, layers);
        if (bottom === null) continue;
        // Measured from the top of this sheet's slab, which is where the wall
        // starts, down to whatever the edge has to reach.
        const depth = d + halfT - bottom;
        triangles += emitWall(a, b, d, depth, out, tint, face, faceSgn, o, assignAt, shaded, push);
        walls++;
        continue;
      }

      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) continue;
      const edgeOut = outwardOfEdge(world, i, orientation);
      if (!edgeOut) continue;
      creaseEdges++;
      const creaseMid: V2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const group = groups.get(label.id) ?? [];
      group.push({
        a,
        b,
        layer: face.layer,
        d,
        centroid,
        tint,
        out: edgeOut,
        creaseId: label.id,
        side: label.side,
        sgn: faceSgn,
        face,
        depth: creaseRimDepth(fi, creaseMid, edgeOut, worlds, state, layers),
      });
      groups.set(label.id, group);
    }
  }

  // --- Roll every crease ---------------------------------------------------
  let rolls = 0;
  let creaseStubMm = 0;
  let creaseGapMm = 0;
  const MIN_ROLL_MM = 0.5;
  /**
   * The shortest stub of crease worth its own geometry. Below this the gap is
   * narrower than the seam between two abutting walls and nothing would show.
   */
  const MIN_STUB_MM = 0.02;
  /** How far apart two halves of one crease may drift and still be joined. */
  const MAX_CREASE_DRIFT = 12;
  /** How far the join itself may lean sideways before it would fold over. */
  const MAX_CREASE_LEAN = 1.5;

  // Which halves found their partner. Whatever is left over is drawn on its
  // own afterwards, so no crease is ever left as a bare edge.
  const joined = new Set<Seg>();

  /** A round already drawn, and how to carry it further along its own crease. */
  type Round = {
    /** Interval covered, in the group's shared parameter along the crease. */
    lo: number;
    hi: number;
    segs: [Seg, Seg];
    draw: (lo: number, hi: number) => void;
  };

  for (const segs of groups.values()) {
    if (segs.length < 2) continue;

    // One axis for the whole crease, so every half's extent and every gap
    // between them is measured in the same parameter. Pieces of one crease are
    // parallel to within the pairing test below, so a single axis serves.
    const lengthOf = (s: Seg) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    const longest = segs.reduce((m, s) => (lengthOf(s) > lengthOf(m) ? s : m), segs[0]);
    const gl = lengthOf(longest) || 1;
    /** Along the crease. */
    const gd: V2 = { x: (longest.b.x - longest.a.x) / gl, y: (longest.b.y - longest.a.y) / gl };
    /** Across it. */
    const gn: V2 = { x: -gd.y, y: gd.x };
    const along = (q: V2) => q.x * gd.x + q.y * gd.y;
    const across = (q: V2) => q.x * gn.x + q.y * gn.y;
    /** The point at parameter `u` on the line sitting `k` across the axis. */
    const at = (u: number, k: number): V2 => ({
      x: gd.x * u + gn.x * k,
      y: gd.y * u + gn.y * k,
    });

    const span = segs.map((seg) => {
      const len = lengthOf(seg);
      const dir: V2 =
        len < 1e-6 ? { x: 1, y: 0 } : { x: (seg.b.x - seg.a.x) / len, y: (seg.b.y - seg.a.y) / len };
      const u0 = along(seg.a);
      const u1 = along(seg.b);
      return {
        seg,
        dir,
        len,
        // Averaged, because a half dragged out of line by a thick fold is only
        // nearly parallel and its offset drifts a little from end to end.
        k: (across(seg.a) + across(seg.b)) / 2,
        lo: Math.min(u0, u1),
        hi: Math.max(u0, u1),
      };
    });

    const drawn: Round[] = [];

    for (let i = 0; i < span.length; i++) {
      for (let j = i + 1; j < span.length; j++) {
        const A = span[i];
        const B = span[j];
        // Only ever join the two halves the fold actually separated. Pieces of
        // the same half can end up at different layers, and joining those would
        // draw a rolled edge through the middle of a flat sheet.
        if (A.seg.side === B.seg.side) continue;
        if (A.seg.layer === B.seg.layer) continue;
        if (A.len < 1e-6 || B.len < 1e-6) continue;

        // The halves need not have stayed exactly on one line. Folding a stack
        // makes its sheets slip past each other by different amounts, which
        // drags any crease already inside it out of line. They still have to be
        // parallel and close, and the join is built to span whatever gap is
        // left rather than assuming there is none.
        if (Math.abs(A.dir.x * B.dir.x + A.dir.y * B.dir.y) < 0.996) continue;
        if (Math.abs(B.k - A.k) > MAX_CREASE_DRIFT) continue;

        const t0 = Math.max(A.lo, B.lo);
        const t1 = Math.min(A.hi, B.hi);
        if (t1 - t0 < MIN_ROLL_MM) continue;

        const upper = A.seg.d > B.seg.d ? A : B;
        const lower = A.seg.d > B.seg.d ? B : A;
        // Let the join lean, but only so far.
        const lean = Math.max(
          -MAX_CREASE_LEAN,
          Math.min(MAX_CREASE_LEAN, upper.k - lower.k),
        );
        const out = upper.seg.out;

        // Half the step from the underside of the lower sheet to the top of the
        // upper one: partly up, and partly sideways where the sheets have
        // slipped. Both sheets' own thicknesses are inside the round, because
        // the paper wraps the crease on its outside - the sides now facing the
        // gap between the two sheets meet at the crease and go no further.
        const half = {
          x: (gn.x * lean) / 2,
          y: (upper.seg.d + halfT - (lower.seg.d - halfT)) / 2,
          z: (gn.y * lean) / 2,
        };
        // The round is centred on that step, so it meets both sheets. Measuring
        // it from whichever half the pairing loop happened to reach first would
        // hang it off the side of the crease by the whole width of the step.
        const axisK = lower.k + lean / 2;
        const axisD = lower.seg.d - halfT + half.y;
        // The join is a half-round of exactly the radius the two sheets set.
        // Its bulge runs square to the step between them, not simply outwards:
        // where the sheets have slipped, the step already leans outwards, and a
        // bulge in the same direction would flatten the curve into a crease
        // with a pointed crown, which reads as a chamfer rather than a fold.
        const radius = Math.hypot(half.x, half.y, half.z);
        if (radius < 1e-9) continue;
        const stepOut = half.x * out.x + half.z * out.y;
        const perpOut = half.y;
        const perpUp = -stepOut;
        const perpLen = Math.hypot(perpOut, perpUp) || 1;
        const bulge = {
          x: (out.x * perpOut * radius) / perpLen,
          y: (perpUp * radius) / perpLen,
          z: (out.y * perpOut * radius) / perpLen,
        };

        const edgeSgn = upper.seg.sgn === lower.seg.sgn ? upper.seg.sgn : 0;
        // The join is the outer sheet carrying on round the crease, so it
        // bends on that sheet's arc.
        const rollFace = upper.seg.face;
        const arcSegments = Math.max(3, o.rollArcSegments);

        const drawRound = (u0: number, u1: number) => {
          const lengthSegments = Math.max(1, Math.ceil((u1 - u0) / o.rollStepMm));
          for (let li = 0; li < lengthSegments; li++) {
            const q0 = at(u0 + ((u1 - u0) * li) / lengthSegments, axisK);
            const q1 = at(u0 + ((u1 - u0) * (li + 1)) / lengthSegments, axisK);
            const midPt: V2 = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
            const { op, sgn, ref } = assignAt(midPt, rollFace, edgeSgn);

            for (let ai = 0; ai < arcSegments; ai++) {
              const th0 = (Math.PI * ai) / arcSegments;
              const th1 = (Math.PI * (ai + 1)) / arcSegments;
              // theta runs from the upper sheet's edge, out round the bulge, to
              // the lower sheet's edge.
              const corner = (q: V2, th: number) => {
                const c = Math.cos(th);
                const sn = Math.sin(th);
                // Radius from the middle of the step: at 0 it meets the upper
                // sheet, at pi the lower one, and square to both in between.
                const rx = c * half.x + sn * bulge.x;
                const ry = c * half.y + sn * bulge.y;
                const rz = c * half.z + sn * bulge.z;
                const px = q.x + rx;
                const py = axisD + ry;
                const pz = q.y + rz;
                // On a circle the outward normal is simply the radius.
                const nx = rx / radius;
                const ny = ry / radius;
                const nz = rz / radius;
                const occlusion = 1 - o.edgeShade * (th / Math.PI);
                return {
                  world: { x: px, y: pz } as V2,
                  d: py,
                  nx,
                  ny,
                  nz,
                  // The outside of a fold is one continuous side of the sheet:
                  // the flap turns over, so the side now facing up carries on
                  // round the crease and becomes the underside of the sheet it
                  // landed on, which is why one tint serves the whole round.
                  tint: shaded(upper.seg.tint, occlusion),
                  // Across the round and along it, so the fibre wraps the
                  // crease instead of smearing into streaks down its side.
                  uv: { x: along(q), y: radius * th } as V2,
                };
              };
              const c00 = corner(q0, th0);
              const c01 = corner(q0, th1);
              const c10 = corner(q1, th0);
              const c11 = corner(q1, th1);
              const emit = (c: ReturnType<typeof corner>) =>
                push(c.world, c.uv, c.d, c.nx, c.ny, c.nz, c.tint, op, sgn, 0, c.tint, ref);
              // Rather than reason out the handedness of a surface that can lean
              // as well as bulge, compare the triangle's own normal with the
              // normals it carries and wind it to agree.
              if (agrees(c00, c11, c10)) {
                emit(c00);
                emit(c11);
                emit(c10);
                emit(c00);
                emit(c01);
                emit(c11);
              } else {
                emit(c00);
                emit(c10);
                emit(c11);
                emit(c00);
                emit(c11);
                emit(c01);
              }
              triangles += 2;
            }
          }
        };

        drawRound(t0, t1);
        drawn.push({ lo: t0, hi: t1, segs: [A.seg, B.seg], draw: drawRound });
        joined.add(A.seg);
        joined.add(B.seg);
        rolls++;
      }
    }

    // A flap lands short of the crease it turned about by the paper it wrapped,
    // and on a corner that shortens its half of the crease at both ends. Pairing
    // covers only the part the two halves share, so the folded edge would stop
    // short of the corner and run on as a bare knife edge - by a stub as long as
    // the crease allowance, which grows with the sheet's thickness. Carrying the
    // neighbouring round on to the end keeps the folded edge continuous.
    const covered: Array<[number, number]> = drawn.map((r) => [r.lo, r.hi]);
    for (const s of span) {
      if (!joined.has(s.seg)) continue;
      const mine = drawn.filter((r) => r.segs[0] === s.seg || r.segs[1] === s.seg);
      if (!mine.length) continue;
      for (const [gapLo, gapHi] of gapsIn(s.lo, s.hi, covered)) {
        if (gapHi - gapLo < MIN_STUB_MM) continue;
        // Carry on the round nearest the stub, so the two meet end to end.
        const nearest = mine.reduce((best, r) =>
          gapTo(r, gapLo, gapHi) < gapTo(best, gapLo, gapHi) ? r : best,
        );
        nearest.draw(gapLo, gapHi);
        covered.push([gapLo, gapHi]);
        creaseStubMm += gapHi - gapLo;
        rolls++;
      }
    }

    // Whatever is still bare on a half that was rolled. Stubs too short to be
    // worth their own geometry land here, and nothing else should.
    for (const s of span) {
      if (!joined.has(s.seg)) continue;
      for (const [lo, hi] of gapsIn(s.lo, s.hi, covered)) {
        creaseGapMm = Math.max(creaseGapMm, hi - lo);
      }
    }
  }

  let rims = 0;
  for (const segs of groups.values()) {
    for (const seg of segs) {
      if (joined.has(seg) || seg.depth < 1e-6) continue;
      triangles += emitCreaseRim(
        seg.a,
        seg.b,
        seg.d,
        seg.depth,
        seg.out,
        seg.tint,
        seg.face,
        seg.sgn,
        o,
        assignAt,
        shaded,
        push,
      );
      rims++;
    }
  }

  return { rolls: rolls + rims, walls, triangles, creaseEdges, creaseStubMm, creaseGapMm };
}

/**
 * A rounded rim along a crease edge that found no partner.
 *
 * Most creases are drawn by joining the two halves the fold separated, which
 * gives the half-round of paper that wraps the crease. Some halves never meet:
 * a later fold can cut one of them away entirely, or leave the two so far out
 * of line that joining them would draw a bridge through open air. Left alone
 * those edges are knife sharp, because a crease gets no wall - and a folded
 * edge is the one edge on a sheet of paper that is never sharp.
 *
 * So the rim is built from the edge alone: the same half-round, turned about
 * the edge from the top of the sheet's slab, out, and down to whatever it rests
 * on. `d` is the middle of the sheet and `depth` is measured from the top of
 * its slab, as for a wall.
 */
function emitCreaseRim(
  a: V2,
  b: V2,
  d: number,
  depth: number,
  out: V2,
  tint: [number, number, number],
  face: Face,
  faceSgn: number,
  o: MeshOptions,
  assignAt: (p: V2, face: Face, faceSgn: number) => { op: number; sgn: number; ref: number },
  shaded: (t: [number, number, number], amount: number) => [number, number, number],
  push: PushFn,
): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-6 || depth < 1e-6) return 0;
  const halfT = o.thickness / 2;

  // Half the drop is the radius, so the rim leaves the surface flat and
  // arrives flat underneath, exactly as a sheet bent back on itself does.
  const radius = depth / 2;
  const rightHanded = out.x * (ey / len) - out.y * (ex / len) > 0;
  const arc = Math.max(3, o.rollArcSegments);
  const segments = Math.max(1, Math.ceil(len / o.rollStepMm));
  let triangles = 0;

  for (let i = 0; i < segments; i++) {
    const q0: V2 = { x: a.x + ex * (i / segments), y: a.y + ey * (i / segments) };
    const q1: V2 = { x: a.x + ex * ((i + 1) / segments), y: a.y + ey * ((i + 1) / segments) };
    const midPt: V2 = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
    const { op, sgn, ref } = assignAt(midPt, face, faceSgn);

    // Angle 0 is the top of the sheet's slab; pi is the underside it turns
    // onto.
    const corner = (q: V2, th: number, s: number) => {
      const sn = Math.sin(th);
      const cs = Math.cos(th);
      const world: V2 = { x: q.x + out.x * radius * sn, y: q.y + out.y * radius * sn };
      // Curving away from the light, a crease darkens towards its underside.
      const c = shaded(tint, 1 - o.edgeShade * (th / Math.PI));
      return {
        world,
        below: radius - radius * cs,
        nx: out.x * sn,
        ny: cs,
        nz: out.y * sn,
        c,
        // Along the rim and around it. Reading the model position instead would
        // give every vertex down the rim the same texture coordinate, and the
        // fibre would smear into streaks running down it.
        uv: { x: s, y: radius * th } as V2,
      };
    };
    // All of it is paper wrapping the crease, so it turns with the sheet.
    const emit = (v: ReturnType<typeof corner>) =>
      push(v.world, v.uv, d, v.nx, v.ny, v.nz, v.c, op, sgn, 0, v.c, ref, halfT - v.below);

    const s0 = (len * i) / segments;
    const s1 = (len * (i + 1)) / segments;
    for (let k = 0; k < arc; k++) {
      const t0 = (Math.PI * k) / arc;
      const t1 = (Math.PI * (k + 1)) / arc;
      const c00 = corner(q0, t0, s0);
      const c01 = corner(q0, t1, s0);
      const c10 = corner(q1, t0, s1);
      const c11 = corner(q1, t1, s1);
      if (rightHanded) {
        emit(c00); emit(c10); emit(c11);
        emit(c00); emit(c11); emit(c01);
      } else {
        emit(c00); emit(c11); emit(c10);
        emit(c00); emit(c01); emit(c11);
      }
      triangles += 2;
    }
  }
  return triangles;
}

/**
 * The cut edge of a sheet, and whatever gap is left under it.
 *
 * `d` is the middle of the sheet and `depth` is measured from the top of its
 * slab: the first thickness of it is the sheet's own cut edge, and anything
 * beyond that is a skirt closing the gap under a flap that overhangs a step.
 * That is what gives a folded flap a visible edge instead of melting into the
 * sheet it rests on.
 */
function emitWall(
  a: V2,
  b: V2,
  d: number,
  depth: number,
  out: V2,
  tint: [number, number, number],
  face: Face,
  faceSgn: number,
  o: MeshOptions,
  assignAt: (p: V2, face: Face, faceSgn: number) => { op: number; sgn: number; ref: number },
  shaded: (t: [number, number, number], amount: number) => [number, number, number],
  push: PushFn,
): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-6) return 0;
  const halfT = o.thickness / 2;

  // Where two flaps butt up against each other their walls would be exactly
  // coincident and z-fight, so each is pulled back a hair into its own face.
  // The pair then reads as a fine seam instead of a flickering line.
  const inset = 0.03;
  const ax = a.x - out.x * inset;
  const ay = a.y - out.y * inset;
  // A paper edge is a little duller than its face, then darker still where it
  // meets what it rests on.
  const topTint = shaded(tint, 0.92);
  const bottomTint = shaded(tint, 1 - o.edgeShade);
  // The winding that makes the front face point along `out`.
  const rightHanded = out.x * (ey / len) - out.y * (ex / len) > 0;

  const segments = Math.max(1, Math.ceil(len / o.rollStepMm));
  // The wall is square, like a cut edge of real paper: one flat face, with the
  // darkening confined to a narrow contact band at the very bottom rather than
  // graded over the whole height, which would read as a chamfer.
  const CONTACT = 0.35;
  let triangles = 0;
  for (let i = 0; i < segments; i++) {
    const f0 = i / segments;
    const f1 = (i + 1) / segments;
    const q0: V2 = { x: ax + ex * f0, y: ay + ey * f0 };
    const q1: V2 = { x: ax + ex * f1, y: ay + ey * f1 };
    const midPt: V2 = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
    const { op, sgn, ref } = assignAt(midPt, face, faceSgn);

    // Along the edge and down the wall. Reading the model position instead
    // would give the top and bottom of the wall the same texture coordinate,
    // and the fibre would smear into vertical streaks down a cut edge that
    // should show the grain end on.
    const s0 = len * f0;
    const s1 = len * f1;
    // The sheet's own edge is part of the paper, so it is carried round by the
    // fold and ends up on top once the flap has turned over. The skirt below it
    // is standing in for paper that is not there, so it hangs where it is drawn.
    const vert = (q: V2, s: number, below: number, c: [number, number, number]) => {
      const sheet = Math.min(below, o.thickness);
      push(
        q,
        { x: s, y: below },
        d,
        out.x,
        0,
        out.y,
        c,
        op,
        sgn,
        below - sheet,
        c,
        ref,
        halfT - sheet,
      );
    };

    const band = (
      topBelow: number,
      bottomBelow: number,
      topC: [number, number, number],
      bottomC: [number, number, number],
    ) => {
      if (rightHanded) {
        vert(q0, s0, topBelow, topC);
        vert(q1, s1, topBelow, topC);
        vert(q1, s1, bottomBelow, bottomC);
        vert(q0, s0, topBelow, topC);
        vert(q1, s1, bottomBelow, bottomC);
        vert(q0, s0, bottomBelow, bottomC);
      } else {
        vert(q0, s0, topBelow, topC);
        vert(q1, s1, bottomBelow, bottomC);
        vert(q1, s1, topBelow, topC);
        vert(q0, s0, topBelow, topC);
        vert(q0, s0, bottomBelow, bottomC);
        vert(q1, s1, bottomBelow, bottomC);
      }
      triangles += 2;
    };

    const knee = depth * (1 - CONTACT);
    band(0, knee, topTint, topTint);
    band(knee, depth, topTint, bottomTint);
  }
  return triangles;
}

// ---------------------------------------------------------------------------
// The bend itself
// ---------------------------------------------------------------------------

type Field = {
  nx: number;
  nz: number;
  k: number;
  ax: number;
  az: number;
  a0x: number;
  a0z: number;
  alpha: number;
  /** Radius of the innermost layer's arc; outer layers add their own depth. */
  r: number;
  cosA: number;
  sinA: number;
};

/** Smooth step used to press the crease flat over the last part of the fold. */
const smoothstep = (a: number, b: number, x: number): number => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Band width at progress `t`: wide while the paper moves, crisp once pressed. */
export const bandAt = (t: number, o: MeshOptions): number => {
  const end = bandEndFor(o);
  return o.bandStart + (end - o.bandStart) * smoothstep(0.55, 1, t);
};

function fieldsFor(ops: BendOp[], t: number, band: number): Field[] {
  return ops.map((op) => {
    const alpha = t * op.target * DEG;
    const r = alpha > 1e-6 ? band / alpha : Infinity;
    return {
      nx: op.line.n.x,
      nz: op.line.n.y,
      k: op.line.k,
      ax: -op.line.n.y,
      az: op.line.n.x,
      a0x: op.line.n.x * op.line.k,
      a0z: op.line.n.y * op.line.k,
      alpha,
      r,
      cosA: Math.cos(alpha),
      sinA: Math.sin(alpha),
    };
  });
}

/**
 * Map the flat vertices through the arc for progress `t` in [0, 1].
 *
 * Paper within `band` of the fold line follows a circular arc whose total turn
 * is the fold angle; paper beyond it continues straight along the arc's
 * tangent, which is a rigid rotation. Layers share the arc's angular sweep but
 * sit at different radii, so a stack stays parallel through the bend.
 *
 * What is mapped is the middle of each sheet. Its two sides are then set off
 * along the turned normal, so a sheet keeps its thickness all the way round the
 * crease and arrives with the side that was up facing down.
 */
export function applyBend(
  flat: FlatMesh,
  t: number,
  band: number,
  posOut: Float32Array,
  nrmOut: Float32Array,
): void {
  const fields = fieldsFor(flat.ops, t, band);
  const { pos, nrm, off, drop, ref, op, sgn, count } = flat;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = pos[i3];
    const d = pos[i3 + 1];
    const z = pos[i3 + 2];
    const oi = op[i];
    const sg = sgn[i];
    const f = oi >= 0 ? fields[oi] : undefined;

    if (!f || sg === 0 || f.alpha < 1e-6) {
      posOut[i3] = x;
      posOut[i3 + 1] = d + off[i] - drop[i];
      posOut[i3 + 2] = z;
      nrmOut[i3] = nrm[i3];
      nrmOut[i3 + 1] = nrm[i3 + 1];
      nrmOut[i3 + 2] = nrm[i3 + 2];
      continue;
    }

    const s = f.nx * x + f.nz * z - f.k;
    if (s <= 0) {
      posOut[i3] = x;
      posOut[i3 + 1] = d + off[i] - drop[i];
      posOut[i3 + 2] = z;
      nrmOut[i3] = nrm[i3];
      nrmOut[i3 + 1] = nrm[i3 + 1];
      nrmOut[i3 + 2] = nrm[i3 + 2];
      continue;
    }

    const tAlong = f.ax * x + f.az * z;
    // The arc is measured from the middle of the top sheet of this vertex's own
    // stack, so a fold that runs through a thick part of the model and a thin
    // one turns each through its own radius and both land where the engine puts
    // them. The stack comes to rest on itself half a thickness above that, and
    // that half thickness is the innermost sheet's own radius: its upper side
    // pinches shut in the crease and its underside wraps the outside.
    const h = sg > 0 ? f.r + ref[i] : f.r - ref[i];
    const radius = h - sg * d;
    // Arc length equals paper length on every layer, so nothing stretches and
    // the outer layers of a stack run out slightly short, as real paper does.
    const arcEnd = radius * f.alpha;
    const phi = s < arcEnd ? s / radius : f.alpha;
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);

    let out = radius * sp;
    let y = sg * h - sg * radius * cp;
    if (s > arcEnd) {
      const ex = s - arcEnd;
      out += ex * f.cosA;
      y += ex * sg * f.sinA;
    }

    // The surface frame turns with the arc, so anything square to the paper -
    // the normal, and the two sides of the slab - rotates about the crease
    // direction by the same angle.
    const th = sg * phi;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    // Straight up in the flat model, turned by the arc: the direction the
    // sheet's own thickness now points.
    const ov = off[i];

    posOut[i3] = f.a0x + out * f.nx + tAlong * f.ax - ov * f.az * st;
    posOut[i3 + 1] = y + ov * ct - drop[i];
    posOut[i3 + 2] = f.a0z + out * f.nz + tAlong * f.az + ov * f.ax * st;

    const vx = nrm[i3];
    const vy = nrm[i3 + 1];
    const vz = nrm[i3 + 2];
    const adv = f.ax * vx + f.az * vz;
    nrmOut[i3] = vx * ct + -f.az * vy * st + f.ax * adv * (1 - ct);
    nrmOut[i3 + 1] = vy * ct + (f.az * vx - f.ax * vz) * st;
    nrmOut[i3 + 2] = vz * ct + f.ax * vy * st + f.az * adv * (1 - ct);
  }
}
