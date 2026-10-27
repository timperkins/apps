/**
 * The fold engine.
 *
 * A state is a list of flat faces. Each face is a convex polygon in paper space
 * plus the isometry that places it on the model and the layer it sits in. A
 * 180-degree fold of a flat model is exactly a mirror across the fold line, so
 * applying a fold means splitting faces along that line, mirroring the moving
 * side, and restacking the layers.
 *
 * Nothing here knows about three.js. The renderer turns states into geometry.
 */

import {
  applyIso,
  composeIso,
  intersectConvex,
  ISO_IDENTITY,
  Iso2,
  isoDet,
  Line2,
  lineCrosses,
  lineThroughPoints,
  mul,
  offsetLine,
  orientTowards,
  overlapArea,
  Poly,
  polyArea,
  polyCentroid,
  pullbackLine,
  reflectionIso,
  splitPoly,
  translationIso,
  V2,
  v2,
} from "./geom";

/**
 * What an edge of a face is.
 *
 * `raw` is a cut edge of the original sheet, so it shows the paper's thickness.
 * `internal` is a bookkeeping cut between two coplanar pieces of the same
 * sheet, made when working out layer order, and is never drawn.
 *
 * `crease` is a fold. It carries an id shared by exactly the two pieces the
 * fold separated, which is what pairs them up again when the rolled edge is
 * drawn. Layer numbers cannot do that job: a fold through a stack of four
 * leaves its outermost sheets three layers apart, while two sheets that merely
 * end up next to each other were never joined at all.
 */
export type EdgeLabel =
  | { kind: "raw" }
  | { kind: "internal" }
  /**
   * `side` says which half of the fold this piece came from. Later folds and
   * layer bookkeeping can split one side into several pieces at different
   * layers, so the id alone is not enough to pair a crease back up.
   */
  | { kind: "crease"; id: number; side: "moving" | "stationary" };

export const RAW_EDGE: EdgeLabel = { kind: "raw" };
export const INTERNAL_EDGE: EdgeLabel = { kind: "internal" };

export type Face = {
  id: string;
  /** Convex polygon in paper space, millimetres. */
  poly: Poly;
  /** What the edge starting at poly[i] is. */
  edges: EdgeLabel[];
  /** Paper space to model space. */
  xf: Iso2;
  /** Stacking order; 0 sits on the table. */
  layer: number;
  /** Free-form marks used by later steps to select groups of faces. */
  tags: string[];
};

export type FoldState = {
  faces: Face[];
  /**
   * Paper consumed by the rounded part of creases, in square millimetres.
   *
   * Folding round a crease of radius r uses pi*r of length that no longer lies
   * flat, which is why the far edge of a flap comes up short and why the layers
   * of a thick fold do not line up. The flat faces lose that strip, so it is
   * counted here to keep the paper accounted for.
   */
  rolledArea: number;
};

/** Fold everything on the moving side of `line` over by `angle` degrees. */
export type FoldOp = {
  kind: "fold";
  line: Line2;
  /** A model-space point on the side that moves. */
  movingRef: V2;
  angle: number;
  /** Tag applied to every face this op moves. */
  tag?: string;
};

/**
 * A presentation-only rotation, used for opening the finished wings.
 * Faces carrying `requireTag` rotate about `line`; those that also carry
 * `signTag` rotate one way and the rest the other, which is what makes the two
 * mirrored halves of a plane open into a dihedral.
 */
export type RotateOp = {
  kind: "rotate";
  line: Line2;
  /** A model-space point on the side the rotating faces occupy. */
  modelRef: V2;
  angle: number;
  requireTag: string;
  signTag: string;
};

export type Op = FoldOp | RotateOp;

export type Step = {
  id: string;
  title: string;
  text: string;
  bookmark?: boolean;
  durationMs: number;
  /** Ops in one step animate together, so their moving regions must be disjoint. */
  ops: Op[];
  /** Eased model roll at the end of this step, degrees, for the final pose. */
  roll?: number;
};

export type Plane = {
  id: string;
  name: string;
  /** Sheet size in millimetres. */
  paper: { width: number; height: number };
  steps: Step[];
};

let faceCounter = 0;
let creaseCounter = 0;
const nextId = (prefix: string) => `${prefix}_${(faceCounter++).toString(36)}`;

export function initialState(width: number, height: number): FoldState {
  faceCounter = 0;
  creaseCounter = 0;
  const hw = width / 2;
  const hh = height / 2;
  return {
    rolledArea: 0,
    faces: [
      {
        id: nextId("f"),
        poly: [v2(-hw, -hh), v2(hw, -hh), v2(hw, hh), v2(-hw, hh)],
        edges: [RAW_EDGE, RAW_EDGE, RAW_EDGE, RAW_EDGE],
        xf: ISO_IDENTITY,
        layer: 0,
        tags: [],
      },
    ],
  };
}

export const faceWorldPoly = (f: Face): Poly => f.poly.map((p) => applyIso(f.xf, p));

/** True when the face is showing the back of the paper. */
export const faceIsMirrored = (f: Face): boolean => isoDet(f.xf) < 0;

export const maxLayer = (s: FoldState): number =>
  s.faces.reduce((m, f) => Math.max(m, f.layer), 0);

/** Faces overlapping by less than this (square millimetres) are treated as disjoint. */
const OVERLAP_EPS = 0.5;
/** Refinement never produces a piece smaller than this, to keep slivers out. */
const MIN_PIECE = 2.0;
/** Nor one thinner than this, which would render as a stray hairline. */
const MIN_PIECE_WIDTH = 0.25;

/** Rough width of a polygon: its area spread over its longest edge. */
function polyWidth(poly: Poly): number {
  let longest = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    longest = Math.max(longest, Math.hypot(poly[j].x - poly[i].x, poly[j].y - poly[i].y));
  }
  return longest < 1e-9 ? 0 : Math.abs(polyArea(poly)) / longest;
}

const isUsablePiece = (poly: Poly): boolean =>
  Math.abs(polyArea(poly)) > MIN_PIECE && polyWidth(poly) > MIN_PIECE_WIDTH;

/**
 * Cut a flap along the outlines of the paper it lands on.
 *
 * Without this a single large flap gets one layer index for its whole area, so
 * the thin part of the model would float as high as the thick part. Splitting
 * the flap where the stack underneath changes gives every piece a layer that is
 * right for the paper below it.
 */
function refineAgainst(moving: Face[], stationary: Face[]): Face[] {
  let work = moving;
  for (const s of stationary) {
    const sWorld = faceWorldPoly(s);
    const next: Face[] = [];
    for (const m of work) next.push(...splitFaceByOutline(m, sWorld));
    work = next;
  }
  return work;
}

function splitFaceByOutline(face: Face, outline: Poly): Face[] {
  let pieces: Face[] = [face];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const edgeLine = lineThroughPoints(outline[i], outline[j]);
    const next: Face[] = [];
    for (const p of pieces) {
      const pWorld = faceWorldPoly(p);
      const shared = intersectConvex(pWorld, outline);
      // Only worth cutting where this face really covers the other one, and
      // only along outline edges that actually run through the face.
      if (Math.abs(polyArea(shared)) < MIN_PIECE || !lineCrosses(pWorld, edgeLine)) {
        next.push(p);
        continue;
      }
      const paperLine = pullbackLine(p.xf, edgeLine);
      const { pos, neg } = splitPoly(p.poly, p.edges, paperLine, INTERNAL_EDGE);
      if (pos && neg && isUsablePiece(pos.poly) && isUsablePiece(neg.poly)) {
        next.push({ ...p, id: nextId("f"), poly: pos.poly, edges: pos.flags });
        next.push({ ...p, id: nextId("f"), poly: neg.poly, edges: neg.flags });
      } else {
        next.push(p);
      }
    }
    pieces = next;
  }
  return pieces;
}

/**
 * Squeeze the layer numbering down so each face sits directly on whatever it
 * covers. Relative order is preserved; only the gaps disappear.
 */
function compactLayers(faces: Face[]): void {
  const world = faces.map(faceWorldPoly);
  const order = faces.map((_, i) => i).sort((a, b) => faces[a].layer - faces[b].layer);
  const assigned = new Array<number>(faces.length).fill(0);
  for (const i of order) {
    let level = 0;
    for (let j = 0; j < faces.length; j++) {
      if (j === i || faces[j].layer >= faces[i].layer) continue;
      if (overlapArea(world[i], world[j]) > OVERLAP_EPS) {
        level = Math.max(level, assigned[j] + 1);
      }
    }
    assigned[i] = level;
  }
  faces.forEach((f, i) => {
    f.layer = assigned[i];
  });
}

/**
 * How much paper this fold wraps around its crease, for a sheet at layer `k`.
 *
 * A stack folds like a rolled-up newspaper: the innermost sheet turns through
 * the tightest radius and the outer ones have to reach round everything inside
 * them. Layer `k` of a moving stack whose top layer is `topLayer` ends up at
 * radius (half a sheet + however many sheets lie above it), and wraps pi times
 * that much paper into the crease.
 *
 * This is what stops a finished fold looking machined: each layer's far edge
 * falls short by its own allowance, so the edges fan out instead of lining up.
 */
const creaseAllowance = (k: number, topLayer: number, thickness: number): number =>
  Math.PI * thickness * (0.5 + (topLayer - k));

/**
 * How deep the moving stack is where each face sits, keyed by face id.
 *
 * It has to be local: the nose of a dart is sixteen layers thick while the
 * tail is two, and one fold runs through both. Taking the deepest point for
 * the whole fold would have the tail wrap as much paper as the nose.
 *
 * The renderer needs the same answer, because the arc a sheet bends through
 * has to end exactly where this puts it. Exported so there is one definition
 * of it rather than two that can drift apart.
 *
 * `line` must already be oriented so the moving paper is on its positive side.
 */
export function movingTopLayers(faces: Face[], line: Line2): Map<string, number> {
  const movingWorld = new Map<string, Poly>();
  for (const f of faces) {
    const paperLine = pullbackLine(f.xf, line);
    const { pos } = splitPoly(f.poly, f.edges, paperLine, INTERNAL_EDGE);
    if (pos) movingWorld.set(f.id, pos.poly.map((p) => applyIso(f.xf, p)));
  }
  const topLayerFor = new Map<string, number>();
  for (const f of faces) {
    const own = movingWorld.get(f.id);
    if (!own) continue;
    let top = f.layer;
    for (const g of faces) {
      const other = movingWorld.get(g.id);
      if (!other || g.id === f.id || g.layer <= top) continue;
      if (overlapArea(own, other) > OVERLAP_EPS) top = g.layer;
    }
    topLayerFor.set(f.id, top);
  }
  return topLayerFor;
}

function applyFoldOp(faces: Face[], op: FoldOp, thickness: number): {
  faces: Face[];
  rolled: number;
} {
  const line = orientTowards(op.line, op.movingRef);
  const stationary: Face[] = [];
  const moving: Face[] = [];
  let rolled = 0;

  const topLayerFor = movingTopLayers(faces, line);

  for (const f of faces) {
    const paperLine = pullbackLine(f.xf, line);
    // One identity per face this fold cuts, so the two halves can find each
    // other again however much later folds chop them up.
    const id = creaseCounter++;
    const creaseMoving: EdgeLabel = { kind: "crease", id, side: "moving" };
    const { pos, neg } = splitPoly(f.poly, f.edges, paperLine, creaseMoving, {
      kind: "crease",
      id,
      side: "stationary",
    });
    if (neg) {
      stationary.push({ ...f, id: nextId("f"), poly: neg.poly, edges: neg.flags });
    }
    if (!pos) continue;

    // Take the crease's own paper out of the flat model and slide what is left
    // up to the fold line, so the flap lands short by exactly what it wrapped.
    const allowance = creaseAllowance(f.layer, topLayerFor.get(f.id) ?? f.layer, thickness);
    let keptPoly = pos.poly;
    let keptEdges = pos.flags;
    if (allowance > 1e-6) {
      const cut = splitPoly(
        pos.poly,
        pos.flags,
        offsetLine(paperLine, allowance),
        creaseMoving,
        { kind: "internal" },
      );
      const wrapped = Math.abs(polyArea(pos.poly)) - Math.abs(polyArea(cut.pos?.poly ?? []));
      if (!cut.pos) {
        // The whole piece is inside the crease; it is all rolled paper.
        rolled += Math.abs(polyArea(pos.poly));
        continue;
      }
      rolled += wrapped;
      keptPoly = cut.pos.poly;
      keptEdges = cut.pos.flags;
    }

    moving.push({
      ...f,
      id: nextId("f"),
      poly: keptPoly,
      edges: keptEdges,
      xf: composeIso(
        translationIso(mul(line.n, allowance)),
        composeIso(reflectionIso(line), f.xf),
      ),
      tags: op.tag && !f.tags.includes(op.tag) ? [...f.tags, op.tag] : f.tags,
    });
  }

  // Restack. A flap that folds over lands on top of whatever stationary paper
  // it covers, and the order within the flap reverses.
  const refined = refineAgainst(moving, stationary);
  const sWorld = stationary.map(faceWorldPoly);
  const mWorld = refined.map(faceWorldPoly);
  const newLayers = refined.map((m, i) => {
    let base = -1;
    for (let j = 0; j < stationary.length; j++) {
      if (overlapArea(mWorld[i], sWorld[j]) > OVERLAP_EPS) {
        base = Math.max(base, stationary[j].layer);
      }
    }
    let localMax = m.layer;
    for (let j = 0; j < refined.length; j++) {
      if (i !== j && overlapArea(mWorld[i], mWorld[j]) > OVERLAP_EPS) {
        localMax = Math.max(localMax, refined[j].layer);
      }
    }
    return base + 1 + (localMax - m.layer);
  });
  refined.forEach((m, i) => {
    m.layer = newLayers[i];
  });

  const result = [...stationary, ...refined];
  compactLayers(result);
  return { faces: result, rolled };
}

/** Commit a step, producing the flat state that follows it. */
export function applyStep(state: FoldState, step: Step, thickness: number): FoldState {
  let faces = state.faces;
  let rolledArea = state.rolledArea;
  for (const op of step.ops) {
    if (op.kind === "fold") {
      const result = applyFoldOp(faces, op, thickness);
      faces = result.faces;
      rolledArea += result.rolled;
    }
    // Rotate ops are presentational and leave the committed state alone.
  }
  return { faces, rolledArea };
}

/**
 * All committed states: index i is the state before step i.
 *
 * Sheet thickness is an input because it decides how much paper each crease
 * wraps, which is real geometry and not just a drawing choice.
 */
export function buildTimeline(plane: Plane, thickness: number): FoldState[] {
  const states: FoldState[] = [initialState(plane.paper.width, plane.paper.height)];
  for (const step of plane.steps) {
    states.push(applyStep(states[states.length - 1], step, thickness));
  }
  return states;
}

/** Sign of the rotation this op applies to a face: 1, -1, or 0 for "stays put". */
export function rotateSignFor(op: RotateOp, f: Face): number {
  if (!f.tags.includes(op.requireTag)) return 0;
  return f.tags.includes(op.signTag) ? 1 : -1;
}

/** Diagnostics used by the sanity check and the dev overlay. */
export function stateSummary(s: FoldState) {
  const area = s.faces.reduce((a, f) => a + Math.abs(polyArea(f.poly)), 0) + s.rolledArea;
  const layers = new Map<number, number>();
  for (const f of s.faces) layers.set(f.layer, (layers.get(f.layer) ?? 0) + 1);
  return {
    faces: s.faces.length,
    area,
    maxLayer: maxLayer(s),
    layerHistogram: [...layers.entries()].sort((a, b) => a[0] - b[0]),
    centroid: polyCentroid(faceWorldPoly(s.faces[0])),
  };
}
