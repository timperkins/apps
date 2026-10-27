/**
 * 2D geometry for the fold engine.
 *
 * All paper and model geometry lives in a 2D plane measured in millimetres.
 * A committed fold state is always flat, so a face's placement on the model is
 * a 2D isometry (rotation or mirror plus translation) rather than a full 3D
 * transform. The third dimension only appears at render time.
 */

export type V2 = { x: number; y: number };

export const v2 = (x: number, y: number): V2 => ({ x, y });
export const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: V2, s: number): V2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: V2, b: V2): number => a.x * b.x + a.y * b.y;
export const cross = (a: V2, b: V2): number => a.x * b.y - a.y * b.x;
export const length = (a: V2): number => Math.hypot(a.x, a.y);
export const perp = (a: V2): V2 => ({ x: -a.y, y: a.x });
export const norm = (a: V2): V2 => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};

/** A line in normal form: the set of points q with dot(n, q) === k, n a unit vector. */
export type Line2 = { n: V2; k: number };

export const lineFromPointDir = (p: V2, d: V2): Line2 => {
  const n = norm(perp(d));
  return { n, k: dot(n, p) };
};
export const lineThroughPoints = (a: V2, b: V2): Line2 => lineFromPointDir(a, sub(b, a));
export const signedDist = (l: Line2, q: V2): number => l.n.x * q.x + l.n.y * q.y - l.k;
export const flipLine = (l: Line2): Line2 => ({ n: mul(l.n, -1), k: -l.k });
/** Return the line oriented so that `ref` lies on its positive side. */
export const orientTowards = (l: Line2, ref: V2): Line2 =>
  signedDist(l, ref) >= 0 ? l : flipLine(l);
export const reflectPoint = (l: Line2, q: V2): V2 => sub(q, mul(l.n, 2 * signedDist(l, q)));
/** The line parallel to `l` at signed distance `d` on its positive side. */
export const offsetLine = (l: Line2, d: number): Line2 => ({ n: l.n, k: l.k + d });

/**
 * A 2D isometry: q = [[a, b], [c, d]] * p + (tx, ty).
 * The linear part is orthogonal; a negative determinant means the face is
 * mirrored, i.e. we are looking at the back of the paper.
 */
export type Iso2 = { a: number; b: number; c: number; d: number; tx: number; ty: number };

export const ISO_IDENTITY: Iso2 = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export const applyIso = (m: Iso2, p: V2): V2 => ({
  x: m.a * p.x + m.b * p.y + m.tx,
  y: m.c * p.x + m.d * p.y + m.ty,
});

export const isoDet = (m: Iso2): number => m.a * m.d - m.b * m.c;

/** The isometry that mirrors the plane across `l`. */
export const reflectionIso = (l: Line2): Iso2 => {
  const { x: nx, y: ny } = l.n;
  return {
    a: 1 - 2 * nx * nx,
    b: -2 * nx * ny,
    c: -2 * nx * ny,
    d: 1 - 2 * ny * ny,
    tx: 2 * l.k * nx,
    ty: 2 * l.k * ny,
  };
};

/**
 * The inverse isometry. The linear part is orthogonal, so inverting it is just
 * a transpose; the translation is then undone in that rotated frame.
 */
export const invertIso = (m: Iso2): Iso2 => {
  const a = m.a;
  const b = m.c;
  const c = m.b;
  const d = m.d;
  return { a, b, c, d, tx: -(a * m.tx + b * m.ty), ty: -(c * m.tx + d * m.ty) };
};

/** A pure translation. */
export const translationIso = (t: V2): Iso2 => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: t.x,
  ty: t.y,
});

/** outer ∘ inner */
export const composeIso = (outer: Iso2, inner: Iso2): Iso2 => ({
  a: outer.a * inner.a + outer.b * inner.c,
  b: outer.a * inner.b + outer.b * inner.d,
  c: outer.c * inner.a + outer.d * inner.c,
  d: outer.c * inner.b + outer.d * inner.d,
  tx: outer.a * inner.tx + outer.b * inner.ty + outer.tx,
  ty: outer.c * inner.tx + outer.d * inner.ty + outer.ty,
});

/**
 * Express a model-space line in the paper space of a face.
 *
 * Substituting q = R p + t into dot(n, q) = k gives dot(transpose(R) n, p) = k - dot(n, t).
 * Because R is orthogonal the pulled-back normal stays unit length, so signed
 * distances (and therefore which side is which) are preserved exactly.
 */
export const pullbackLine = (m: Iso2, l: Line2): Line2 => ({
  n: { x: m.a * l.n.x + m.c * l.n.y, y: m.b * l.n.x + m.d * l.n.y },
  k: l.k - (l.n.x * m.tx + l.n.y * m.ty),
});

// ---------------------------------------------------------------------------
// Convex polygons
// ---------------------------------------------------------------------------

export type Poly = V2[];

export const polyArea = (p: Poly): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    s += cross(p[i], p[j]);
  }
  return s / 2;
};

export const polyCentroid = (p: Poly): V2 => {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const f = cross(p[i], p[j]);
    a += f;
    cx += (p[i].x + p[j].x) * f;
    cy += (p[i].y + p[j].y) * f;
  }
  if (Math.abs(a) < 1e-12) {
    // Degenerate sliver: fall back to the vertex average.
    return p.reduce((acc, q) => add(acc, mul(q, 1 / p.length)), v2(0, 0));
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
};

export type SplitHalf<T> = { poly: Poly; flags: T[] } | null;

/**
 * Cut a convex polygon with a line.
 *
 * `flags[i]` describes the edge that starts at `poly[i]`; the caller decides
 * what those labels mean. The edge the cut itself creates is labelled
 * `cutPos` on the positive half and `cutNeg` on the negative half, so a fold
 * can record which side of the crease each piece came from.
 */
export function splitPoly<T>(
  poly: Poly,
  flags: T[],
  line: Line2,
  cutPos: T,
  cutNeg: T = cutPos,
  eps = 1e-7,
): { pos: SplitHalf<T>; neg: SplitHalf<T> } {
  const n = poly.length;
  const d = poly.map((p) => signedDist(line, p));
  let hasPos = false;
  let hasNeg = false;
  for (const x of d) {
    if (x > eps) hasPos = true;
    else if (x < -eps) hasNeg = true;
  }
  if (!hasPos) return { pos: null, neg: { poly, flags } };
  if (!hasNeg) return { pos: { poly, flags }, neg: null };

  const posV: Poly = [];
  const posF: T[] = [];
  const negV: Poly = [];
  const negF: T[] = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const di = d[i];
    const dj = d[j];
    if (di >= -eps) {
      posV.push(poly[i]);
      // If the edge leaving this vertex heads to the negative side and this
      // vertex sits on the line, the positive half continues along the cut.
      posF.push(dj < -eps && di <= eps ? cutPos : flags[i]);
    }
    if (di <= eps) {
      negV.push(poly[i]);
      negF.push(dj > eps && di >= -eps ? cutNeg : flags[i]);
    }
    if ((di > eps && dj < -eps) || (di < -eps && dj > eps)) {
      const t = di / (di - dj);
      const ip: V2 = {
        x: poly[i].x + t * (poly[j].x - poly[i].x),
        y: poly[i].y + t * (poly[j].y - poly[i].y),
      };
      if (di > eps) {
        // Leaving the positive side: the cut edge starts here on the positive half.
        posV.push(ip);
        posF.push(cutPos);
        negV.push(ip);
        negF.push(flags[i]);
      } else {
        negV.push(ip);
        negF.push(cutNeg);
        posV.push(ip);
        posF.push(flags[i]);
      }
    }
  }

  return {
    pos: posV.length >= 3 ? { poly: posV, flags: posF } : null,
    neg: negV.length >= 3 ? { poly: negV, flags: negF } : null,
  };
}

/** Clip a convex polygon to the half-plane where signedDist <= 0. */
export function clipPolyToHalfPlane(poly: Poly, line: Line2, eps = 1e-9): Poly {
  const out: Poly = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const di = signedDist(line, poly[i]);
    const dj = signedDist(line, poly[j]);
    if (di <= eps) out.push(poly[i]);
    if ((di > eps && dj < -eps) || (di < -eps && dj > eps)) {
      const t = di / (di - dj);
      out.push({
        x: poly[i].x + t * (poly[j].x - poly[i].x),
        y: poly[i].y + t * (poly[j].y - poly[i].y),
      });
    }
  }
  return out;
}

/** The region shared by two convex polygons, empty when they do not overlap. */
export function intersectConvex(a: Poly, b: Poly): Poly {
  if (a.length < 3 || b.length < 3) return [];
  const bcc = polyArea(b) >= 0 ? b : [...b].reverse();
  let clipped: Poly = a;
  for (let i = 0; i < bcc.length && clipped.length >= 3; i++) {
    const j = (i + 1) % bcc.length;
    const dir = sub(bcc[j], bcc[i]);
    // For a counter-clockwise polygon the outward normal of edge i is (dy, -dx).
    const nOut = norm({ x: dir.y, y: -dir.x });
    clipped = clipPolyToHalfPlane(clipped, { n: nOut, k: dot(nOut, bcc[i]) });
  }
  return clipped.length >= 3 ? clipped : [];
}

/**
 * Area shared by two convex polygons, used to decide which faces land on top of
 * which when a flap is folded over.
 */
export function overlapArea(a: Poly, b: Poly): number {
  return Math.abs(polyArea(intersectConvex(a, b)));
}

/** True when `q` lies inside `poly`. */
export function pointInPoly(q: V2, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when `line` passes through the interior of `poly`, with area on both sides. */
export function lineCrosses(poly: Poly, line: Line2, eps = 1e-6): boolean {
  let pos = false;
  let neg = false;
  for (const q of poly) {
    const d = signedDist(line, q);
    if (d > eps) pos = true;
    else if (d < -eps) neg = true;
    if (pos && neg) return true;
  }
  return false;
}
