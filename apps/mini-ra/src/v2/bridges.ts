// Where the bridges go. Wherever a road crosses a river or a stream there is
// a bridge, and every river gets one or two more off the roads (with a short
// track leading to them), so there is always another way over. Streams get
// dirt causeways and timber trestles, rivers stone arches and steel trusses
// (bridge-art.ts). A bridge runs along a world axis, the one most nearly
// square to the water, and the road is bent to meet it head on. Each one has
// a repair hut at either end, where an Engineer goes to mend it.
import type { River } from './rivers';
import { BridgeStyle, DECK_W, END, SEG, bridgeLen } from './bridge-art';
import { K, type IsoTerrain } from './terrain';

export interface BridgePlan {
  style: BridgeStyle;
  axis: 0 | 1;
  x: number; // its middle, in world units (on the road's copy of the map)
  y: number;
  n: number; // spans over the water
  huts: [number, number][]; // a repair hut at each end
}

const MAX_SPAN = 150;
// How far a hut stands out from the bridge's end and its side.
const HUT_OUT = 5;
const HUT_SIDE = DECK_W + 7;

type Pt = [number, number];

function crossAt(a: Pt, b: Pt, p: Pt, q: Pt): [number, number] | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = q[0] - p[0];
  const sy = q[1] - p[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p[0] - a[0]) * sy - (p[1] - a[1]) * sx) / den;
  const u = ((p[0] - a[0]) * ry - (p[1] - a[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

/**
 * Plan the bridges for a map whose rivers are laid into T, given the roads
 * (world polylines, which this bends to meet them). Returns the bridges, and
 * the roads with the bends and the tracks to the bridges off the roads.
 */
export function planBridges(T: IsoTerrain, rivers: River[], roads: Pt[][], rand: () => number): { bridges: BridgePlan[]; roads: Pt[][] } {
  const { w, h } = T;
  const wet = (x: number, y: number) => {
    const k = T.k(x, y);
    return k === K.Water || k === K.Sand;
  };
  const dry = (x: number, y: number) => {
    const k = T.k(x, y);
    return (k === K.Grass || k === K.Road || k === K.Pad) && !T.cliff(x, y);
  };
  const bridges: BridgePlan[] = [];
  const laps: Pt[] = [];
  for (const j of [-1, 0, 1]) for (const k of [-1, 0, 1]) laps.push([(k * w) / 2 + j * h, (-k * w) / 2 + j * h]);
  // the distance between two world points, the shortest way round the planet
  const gap = (ax: number, ay: number, bx: number, by: number) => Math.min(...laps.map(([dx, dy]) => Math.hypot(ax - bx - dx, ay - by - dy)));

  // A bridge over the water at (cx, cy), where it runs (dx, dy): null if
  // there's no good place for one there.
  const fit = (cx: number, cy: number, dx: number, dy: number, big: boolean, style: BridgeStyle): BridgePlan | null => {
    const axis: 0 | 1 = Math.abs(dx) > Math.abs(dy) ? 1 : 0;
    const ex = axis === 0 ? 1 : 0;
    const ey = 1 - ex;
    if (!wet(cx, cy)) return null;
    // out to dry land each way
    const reach = (sgn: number): number => {
      for (let t = 0; t < MAX_SPAN; t++) {
        const x = cx + ex * t * sgn;
        const y = cy + ey * t * sgn;
        if (!wet(x, y) && !wet(x + ex * sgn * 3, y + ey * sgn * 3)) return t;
      }
      return -1;
    };
    const a = reach(-1);
    const b = reach(1);
    if (a < 0 || b < 0 || a + b > (big ? MAX_SPAN : 64)) return null;
    const span = a + b;
    const n = Math.max(2, Math.ceil((span + 2) / SEG / 2) * 2);
    const L = bridgeLen(n);
    // centered on the water
    const mx = cx + ex * (b - a) * 0.5;
    const my = cy + ey * (b - a) * 0.5;
    // both ends on dry, level ground, the deck clear of cliffs
    for (const sgn of [-1, 1])
      for (let k = -1; k <= 1; k++) {
        const x = mx + ex * sgn * (L / 2 - 4) + ey * k * (DECK_W - 2);
        const y = my + ey * sgn * (L / 2 - 4) + ex * k * (DECK_W - 2);
        if (!dry(x, y)) return null;
      }
    for (let t = -L / 2; t <= L / 2; t += 3) if (T.isHigh(mx + ex * t, my + ey * t)) return null;
    // not on top of another bridge
    if (bridges.some((o) => gap(o.x, o.y, mx, my) < bridgeLen(o.n) / 2 + L / 2 + 30)) return null;
    // the huts: beside each end, on whichever side is clear
    const huts: Pt[] = [];
    for (const sgn of [-1, 1]) {
      let spot: Pt | null = null;
      for (const side of [1, -1]) {
        const x = mx + ex * sgn * (L / 2 + HUT_OUT) + ey * side * HUT_SIDE;
        const y = my + ey * sgn * (L / 2 + HUT_OUT) + ex * side * HUT_SIDE;
        if (dry(x, y) && dry(x + 3, y + 3) && dry(x - 3, y - 3)) {
          spot = [x, y];
          break;
        }
      }
      if (!spot) return null;
      huts.push(spot);
    }
    // (a dirt causeway only over a narrow stream)
    return { style: style === 'dirt' && n > 4 ? 'timber' : style, axis, x: mx, y: my, n, huts };
  };
  // ...or near it, a little up or down the river
  const fitNear = (cx: number, cy: number, dx: number, dy: number, big: boolean, style: BridgeStyle): BridgePlan | null => {
    const l = Math.hypot(dx, dy) || 1;
    for (const o of [0, 16, -16, 32, -32, 52, -52]) {
      const p = fit(cx + (dx / l) * o, cy + (dy / l) * o, dx, dy, big, style);
      if (p) return p;
    }
    return null;
  };
  const streamStyle = (onRoad: boolean): BridgeStyle => (rand() < (onRoad ? 0.65 : 0.45) ? 'dirt' : 'timber');
  const riverStyle = (): BridgeStyle => (rand() < 0.5 ? 'stone' : 'steel');

  // where each road crosses each river
  const out = roads.map((l) => l.slice());
  for (let li = 0; li < out.length; li++) {
    const line = out[li];
    for (let si = 0; si < line.length - 1; si++) {
      const A = line[si];
      const B = line[si + 1];
      let best: { t: number; x: number; y: number; dx: number; dy: number; big: boolean } | null = null;
      for (const r of rivers)
        for (let k = 0; k < r.pts.length - 1; k++)
          for (const [ox, oy] of laps) {
            const p: Pt = [r.pts[k][0] + ox, r.pts[k][1] + oy];
            const q: Pt = [r.pts[k + 1][0] + ox, r.pts[k + 1][1] + oy];
            const c = crossAt(A, B, p, q);
            if (!c || (best && c[0] >= best.t)) continue;
            best = { t: c[0], x: A[0] + (B[0] - A[0]) * c[0], y: A[1] + (B[1] - A[1]) * c[0], dx: q[0] - p[0], dy: q[1] - p[1], big: r.big };
          }
      if (!best) continue;
      const plan = fitNear(best.x, best.y, best.dx, best.dy, best.big, best.big ? riverStyle() : streamStyle(true));
      if (!plan) continue;
      bridges.push(plan);
      // bend the road to meet it head on: up to the near end, over, and on from the far end
      const L = bridgeLen(plan.n);
      const ex = plan.axis === 0 ? 1 : 0;
      const ey = 1 - ex;
      const sgn = (A[0] - plan.x) * ex + (A[1] - plan.y) * ey < 0 ? -1 : 1;
      const end = (s: number, d: number): Pt => [plan.x + ex * s * (L / 2 + d), plan.y + ey * s * (L / 2 + d)];
      const bend: Pt[] = [end(sgn, 16), end(sgn, -2), end(-sgn, -2), end(-sgn, 16)];
      // drop the road's own points too close to the river
      const R = L / 2 + 24;
      let i0 = si;
      while (i0 > 0 && Math.hypot(line[i0][0] - plan.x, line[i0][1] - plan.y) < R) i0--;
      let i1 = si + 1;
      while (i1 < line.length - 1 && Math.hypot(line[i1][0] - plan.x, line[i1][1] - plan.y) < R) i1++;
      line.splice(i0 + 1, i1 - i0 - 1, ...bend);
      si = i0 + bend.length; // (on past the bridge)
    }
  }

  // and one or two more on each river, away from the roads, with a track to them
  for (const r of rivers) {
    let len = 0;
    for (let k = 0; k < r.pts.length - 1; k++) len += Math.hypot(r.pts[k + 1][0] - r.pts[k][0], r.pts[k + 1][1] - r.pts[k][1]);
    const want = r.big && len > 1400 ? 2 : 1;
    for (let m = 0; m < want; m++) {
      for (let tries = 0; tries < 8; tries++) {
        const k = Math.floor((0.2 + ((m + rand()) / want) * 0.6) * (r.pts.length - 1));
        const [px, py] = r.pts[k];
        const [qx, qy] = r.pts[k + 1];
        if (bridges.some((o) => gap(o.x, o.y, px, py) < 260)) continue;
        const plan = fitNear(px, py, qx - px, qy - py, r.big, r.big ? riverStyle() : streamStyle(false));
        if (!plan) continue;
        bridges.push(plan);
        const L = bridgeLen(plan.n);
        const ex = plan.axis === 0 ? 1 : 0;
        const ey = 1 - ex;
        for (const s of [-1, 1]) {
          const t0 = L / 2 - 2;
          const t1 = L / 2 + 60 + rand() * 50;
          const bendX = (rand() - 0.5) * 30;
          out.push([
            [plan.x + ex * s * t0, plan.y + ey * s * t0],
            [plan.x + ex * s * (L / 2 + 16), plan.y + ey * s * (L / 2 + 16)],
            [plan.x + ex * s * t1 + ey * bendX, plan.y + ey * s * t1 + ex * bendX],
          ]);
        }
        break;
      }
    }
  }
  void END;
  return { bridges, roads: out };
}
