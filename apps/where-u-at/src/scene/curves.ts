// Arcs between two screen points: a quadratic curve that lifts toward the top of the screen.

export interface Pt {
  x: number;
  y: number;
}

export interface Arc {
  p0: Pt;
  c: Pt;
  p1: Pt;
}

/** Unit vector at right angles to the chord, pointing up the screen. */
export function upNormal(p0: Pt, p1: Pt): Pt {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}

export function arc(p0: Pt, p1: Pt): Arc {
  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const lift = Math.min(dist * 0.32, 260);
  const n = upNormal(p0, p1);
  return { p0, p1, c: { x: (p0.x + p1.x) / 2 + n.x * lift, y: (p0.y + p1.y) / 2 + n.y * lift } };
}

/** The same arc moved sideways by `offset` pixels, for side-by-side traces and flights. */
export function shifted(a: Arc, offset: number): Arc {
  if (!offset) return a;
  const n = upNormal(a.p0, a.p1);
  const move = (p: Pt) => ({ x: p.x + n.x * offset, y: p.y + n.y * offset });
  return { p0: move(a.p0), c: move(a.c), p1: move(a.p1) };
}

export function laneOffset(lane: number, laneCount: number, spacing: number): number {
  return (lane - (laneCount - 1) / 2) * spacing;
}

export function pointAt(a: Arc, s: number): Pt {
  const u = 1 - s;
  return {
    x: u * u * a.p0.x + 2 * u * s * a.c.x + s * s * a.p1.x,
    y: u * u * a.p0.y + 2 * u * s * a.c.y + s * s * a.p1.y,
  };
}

export function easeInOut(s: number): number {
  return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2;
}
