// Rivers and streams. Every map gets a few: each rises somewhere inland and
// winds downhill (towards the wetter ground of the lake field, so towards
// lakes and the sea) until it reaches water, runs into another river, or
// gives out (a big river then ends in a pond). They keep clear of where
// players start. The world is made from the same seed on every screen, and
// the map previews draw them too, so they only depend on the map and seed.
//
// A river is a polyline in world units (continuous: it may run off the first
// copy of the map) with a half-width at each point. The terrain turns it
// into water with sandy banks (IsoTerrain.setRivers); bridges and fords
// carry the roads over (bridges.ts).
import { WrapNoise, rng, wrapNoise } from '../gfx';
import { Roads } from '../tiles';
import { toScreen, toWorld } from './stack';

export const LAKE_NOISE_CELL = 234; // (LAKE_CELL in terrain.ts)

export interface River {
  pts: [number, number][];
  half: number[]; // half-width (world units) at each point
  big: boolean; // a river (bridged by stone and steel) or a stream (dirt and timber)
}

export interface RiverMap {
  water: number;
  mask?: (sx: number, sy: number, w: number, h: number, N: WrapNoise, s: number) => number;
  starts: [number, number][];
  size?: number;
}

// Half-widths in world units: a stream is about a tank wide, a river three.
export const STREAM_HALF = 8;
export const RIVER_HALF = 22;
// How far a river keeps from anywhere a player can start (world units).
const AVOID = 300;
const STEP = 14;

const wrap = (d: number, p: number) => d - Math.round(d / p) * p;

/** The rivers of a map, for a seed, on a w x h (screen pixels) planet. */
export function riversFor(def: RiverMap, seed: number, w: number, h: number): River[] {
  const N = wrapNoise(w, h);
  const wetS = (sx: number, sy: number) => {
    sx -= Math.floor(sx / w) * w;
    sy -= Math.floor(sy / h) * h;
    return N(sx, sy, LAKE_NOISE_CELL, seed, 5) + (def.mask?.(sx, sy, w, h, N, seed + 300) ?? 0);
  };
  const wet = (wx: number, wy: number) => wetS(...toScreen(wx, wy));
  // the water line, as the terrain works it out
  const samples: number[] = [];
  for (let j = 0; j < 48; j++) for (let i = 0; i < 96; i++) samples.push(wetS(((i + 0.5) / 96) * w, ((j + 0.5) / 48) * h));
  samples.sort((a, b) => a - b);
  const thr = samples[Math.min(samples.length - 1, Math.floor(samples.length * (1 - def.water)))];
  const lo = samples[Math.floor(samples.length * 0.05)];

  // ground distance between two world points on the planet (it wraps)
  const dist = (ax: number, ay: number, bx: number, by: number) => {
    const [as, at] = toScreen(ax, ay);
    const [bs, bt] = toScreen(bx, by);
    const ds = wrap(bs - as, w);
    const dt = wrap(bt - at, h);
    return Math.sqrt((ds * ds) / 2 + 2 * dt * dt);
  };
  const starts = def.starts.map(([u, v]) => toWorld(u * w, v * h));
  const nearStart = (x: number, y: number, r: number) => starts.some(([sx, sy]) => dist(x, y, sx, sy) < r);

  const area = (w * h) / (10240 * 5120);
  const nBig = Math.max(def.water > 0.7 && area < 0.2 ? 0 : 1, Math.round(area * 3));
  const avoid = area < 0.2 ? 170 : AVOID;
  const nSmall = Math.max(1, Math.round(area * 6));
  const rand = rng(seed * 131 + 977);
  const out: River[] = [];
  const nearRiver = (x: number, y: number, pad: number): [number, number] | null => {
    for (const r of out)
      for (let i = 0; i < r.pts.length; i++) {
        const [px, py] = r.pts[i];
        if (dist(x, y, px, py) < r.half[i] + pad) return [px, py];
      }
    return null;
  };

  for (let n = 0; n < nBig + nSmall; n++) {
    const big = n < nBig;
    const H = big ? RIVER_HALF * (0.85 + rand() * 0.3) : STREAM_HALF * (0.85 + rand() * 0.3);
    const maxLen = (big ? 1500 + rand() * 1400 : 500 + rand() * 700) * Math.min(1, Math.sqrt(def.size ?? 1) * 1.4);
    const minLen = big ? 600 * Math.min(1, area * 3) + 200 : 200;
    let made: River | null = null;
    for (let tries = 0; tries < 30 && !made; tries++) {
      // the source: the driest of a few spots well inland, away from the starts and other rivers
      let sx = 0;
      let sy = 0;
      let best = Infinity;
      for (let k = 0; k < 10; k++) {
        const [x, y] = toWorld(rand() * w, rand() * h);
        const v = wet(x, y);
        if (v > thr - (thr - lo) * 0.35 || nearStart(x, y, avoid + 60) || nearRiver(x, y, 160)) continue;
        if (v < best) {
          best = v;
          sx = x;
          sy = y;
        }
      }
      if (best === Infinity) continue;
      const pts: [number, number][] = [[sx, sy]];
      // the way it is heading overall: at first down the slope of the land,
      // then turning only slowly; it swings either side of that in meanders
      const D = 60;
      let base = Math.atan2(wet(sx, sy + D) - wet(sx, sy - D), wet(sx + D, sy) - wet(sx - D, sy));
      if (!isFinite(base)) base = rand() * Math.PI * 2;
      const lam = (big ? 380 : 220) * (0.8 + rand() * 0.4);
      const amp = 0.55 + rand() * 0.25;
      const p1 = rand() * 9;
      let a = base;
      let x = sx;
      let y = sy;
      let len = 0;
      let end: 'mouth' | 'join' | 'land' = 'land';
      for (let i = 0; len < maxLen; i++) {
        const gx = wet(x + D, y) - wet(x - D, y);
        const gy = wet(x, y + D) - wet(x, y - D);
        let want = Math.hypot(gx, gy) > 1e-5 ? Math.atan2(gy, gx) : base;
        let pull = 0.025;
        // away from the starts
        for (const [qx, qy] of starts) {
          if (dist(x, y, qx, qy) < avoid * 1.6) {
            const [s0, t0] = toScreen(x, y);
            const [s1, t1] = toScreen(qx, qy);
            const ax = wrap(s0 - s1, w);
            const ay = wrap(t0 - t1, h);
            want = Math.atan2(ay - ax / 2, ax / 2 + ay); // (that screen offset, as a way on the ground)
            pull = 0.12;
            break;
          }
        }
        let da = want - base;
        da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
        base += Math.max(-pull, Math.min(pull, da));
        a = base + amp * Math.sin((len / lam) * Math.PI * 2 + p1) + 0.15 * Math.sin((len / lam) * 5.3 + p1 * 2);
        x += Math.cos(a) * STEP;
        y += Math.sin(a) * STEP;
        len += STEP;
        if (nearStart(x, y, avoid)) break;
        const j = i > 4 ? nearRiver(x, y, H + 4) : null;
        if (j) {
          pts.push(j);
          end = 'join';
          break;
        }
        pts.push([x, y]);
        if (wet(x, y) > thr + 0.015 && len > minLen) {
          // into a lake or the sea: a little further, so it joins cleanly
          for (let k = 0; k < 4; k++) pts.push([(x += Math.cos(a) * STEP), (y += Math.sin(a) * STEP)]);
          end = 'mouth';
          break;
        }
      }
      if (len < minLen || pts.length < 6) continue;
      // narrow at its source, and where it gives out on land; wider at the mouth
      const half = pts.map((_, i) => {
        const fromTop = Math.min(1, 0.35 + i / 10);
        const fromEnd = end === 'land' && !big ? Math.min(1, 0.3 + (pts.length - 1 - i) / 8) : 1;
        const mouth = end === 'mouth' ? 1 + Math.max(0, 1 - (pts.length - 1 - i) / 6) * 0.35 : 1;
        return H * Math.min(fromTop, fromEnd) * mouth;
      });
      if (end === 'land' && big) {
        // a big river that gives out on land ends in a pond
        const [ex, ey] = pts[pts.length - 1];
        pts.push([ex + Math.cos(a) * H * 1.2, ey + Math.sin(a) * H * 1.2]);
        half.push(H * 3.2);
      }
      made = { pts, half, big };
    }
    if (made) out.push(made);
  }
  return out;
}

// Rivers as Roads (distance in half-widths), with copies one lap round each way.
export function riverIndex(rivers: River[], w: number, h: number, bx0: number, by0: number, bs: number): Roads {
  const R = new Roads(bx0, by0, bs, bs);
  for (const r of rivers)
    for (let s = 0; s < r.pts.length - 1; s++) {
      const half = (r.half[s] + r.half[s + 1]) / 2;
      for (const j of [-1, 0, 1])
        for (const k of [-1, 0, 1]) {
          const dx = (k * w) / 2 + j * h;
          const dy = (-k * w) / 2 + j * h;
          R.add(r.pts[s][0] + dx, r.pts[s][1] + dy, r.pts[s + 1][0] + dx, r.pts[s + 1][1] + dy, half, half * 2.2 + 16);
        }
    }
  return R;
}
