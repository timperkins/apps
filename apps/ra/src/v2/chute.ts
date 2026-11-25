// A paratrooper's parachute, as the game and the units page draw it: the
// canopy bursts open just after he jumps, swings him to and fro on the way
// down, and folds over and sinks onto the grass once he lands.
import type { Faction } from '../factions';
import { css, mix, type RGB } from '../gfx';
import { DROP_ALT } from './combat';

export const DROP_S = 3.2; // seconds for a paratrooper to come down
export const FOLD_S = 1.2; // seconds for his canopy to fold up once he's down
const OPEN_S = 0.6; // seconds for the canopy to open after he jumps

const W = 10; // canopy half-width, in map pixels
const HH = 6.5; // how tall the dome stands above its skirt
const DD = 3; // the skirt, an ellipse seen from above: its half-depth
const L = 12.5; // lines: from the skirt's middle down to his harness
const HARNESS = 5.5; // his harness, this high above his feet
const GORES = 12;

const CREAM: RGB = [233, 228, 212];
const LINE = 'rgba(44,42,38,0.6)';
const LIGHT = norm([-0.55, 0.8, 0.35]);
const SEAM_W = 0.07; // share of a gore drawn as its seam

function norm(v: [number, number, number]): [number, number, number] {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** How high a paratrooper is, fly running from 1 (just jumped) to 0 (down): he drops fast before the canopy bites, then floats. */
export const dropAlt = (fly: number): number => DROP_ALT * fly * (0.55 + 0.45 * fly);

const clamp = (v: number) => Math.max(0, Math.min(1, v));
// opening: a quick pull with a little overshoot, as the canopy fills
const easeBack = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

/** Where a paratrooper's canopy is and how it's shaped, from how long ago he jumped (and seed, his own sway). */
export interface ChuteState {
  open: number; // 0 packed, 1 full (a little more while it overshoots)
  tilt: number; // his swing, radians: >0 out to the right of his canopy
  fold: number; // 0 in the air, 1 lying flat once he's down
}

export function chuteInAir(since: number, seed: number): ChuteState {
  const k = clamp(since / OPEN_S);
  const open = k < 1 ? Math.max(0.12, easeBack(k)) : 1 + 0.03 * Math.sin(since * 5.1 + seed);
  // the jolt as it opens starts him swinging, and it dies down to a gentle sway
  const amp = 0.08 + 0.3 * Math.exp(-Math.max(0, since - OPEN_S * 0.6) * 0.9);
  const tilt = amp * Math.sin(since * 2.6 + seed * 1.7) * clamp(since / (OPEN_S * 0.6));
  return { open, tilt, fold: 0 };
}

/**
 * A paratrooper's lines and canopy, his feet at screen point (x, y) (map
 * pixels). Draw him first, shifted by swingOffset, then this.
 */
export function drawChute(c: CanvasRenderingContext2D, x: number, y: number, st: ChuteState, f: Faction, t: number, alpha = 1): void {
  const [ox, oy] = swingOffset(st);
  const hx = x + ox;
  const hy = y + oy - HARNESS;
  // the canopy's skirt, right over where he would hang if he didn't swing
  const fold = st.fold;
  const w = W * (0.22 + 0.78 * Math.min(st.open, 1.1)) * (1 + 0.35 * fold) * (st.open < 0.6 ? 1 + 0.08 * Math.sin(t * 47) : 1);
  const h = HH * (1.7 - 0.7 * Math.min(st.open, 1.08)) * (1 - 0.86 * fold);
  const d = DD * (0.3 + 0.7 * Math.min(st.open, 1)) * (1 + 0.5 * fold);
  // once he's down it drifts on downwind (to the right) and sinks onto the grass
  const cx = x + fold * 9;
  const cy = y - HARNESS - L * (1 - fold) + fold * (HARNESS - d * 0.4);
  const tilt = fold ? fold * 0.25 : -st.tilt;
  const cs = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const toS = (X: number, Y: number): [number, number] => [cx + X * cs + Y * sn, cy - X * sn + Y * cs];
  c.globalAlpha = alpha * (fold > 0.7 ? 1 - (fold - 0.7) / 0.3 : 1);

  // the lines, skirt to harness (slack and trailing once he's down); the back ones first
  c.fillStyle = LINE;
  if (fold < 0.55) {
    const slack = fold / 0.55;
    for (const back of [true, false])
      for (let i = 0; i <= 4; i++) {
        const ph = (i / 4) * Math.PI;
        const [px, py] = toS(-Math.cos(ph) * w * 0.96, (back ? -1 : 1) * Math.sin(ph) * d * 0.9);
        if (back && i % 4 !== 0) continue; // the back lines hide behind the front ones
        if (!back && i % 4 === 0) continue;
        const ex = hx + (px - hx) * slack * 0.4;
        const ey = hy + (py - hy) * slack * 0.4 + slack * 3;
        line(c, px, py, ex, ey);
      }
    if (!fold) {
      // the risers: two short straps up from his shoulders
      c.fillRect(Math.round((hx - 1) * 2) / 2, Math.round((hy - 1.5) * 2) / 2, 0.5, 1.5);
      c.fillRect(Math.round((hx + 0.5) * 2) / 2, Math.round((hy - 1.5) * 2) / 2, 0.5, 1.5);
    }
  }

  // the canopy, one half-pixel at a time: each point of the dome seen from
  // above and in front, painted in its gore's color and lit from the upper left
  const light = mix(CREAM, f.light, 0.15);
  const band = mix(f.light, f.main, 0.35);
  const R = Math.hypot(h, d);
  const beta = Math.atan2(h, d);
  const ext = w + h + d + 1;
  const x0 = Math.floor((cx - ext) * 2) / 2;
  const x1 = cx + ext;
  const y0 = Math.floor((cy - ext) * 2) / 2;
  const y1 = cy + ext;
  for (let py = y0; py <= y1; py += 0.5) {
    let run = '';
    let rx = 0;
    const flush = (to: number) => {
      if (run) {
        c.fillStyle = run;
        c.fillRect(rx, py, to - rx, 0.5);
      }
    };
    for (let px = x0; px <= x1; px += 0.5) {
      const col = canopyAt(px + 0.25 - cx, py + 0.25 - cy);
      if (col !== run) {
        flush(px);
        run = col;
        rx = px;
      }
    }
    flush(x1 + 0.5);
  }
  c.globalAlpha = 1;

  function canopyAt(dx: number, dy: number): string {
    // back into the canopy's own frame (X right, Y down, from the skirt's middle)
    const X = dx * cs - dy * sn;
    const Y = dx * sn + dy * cs;
    const sx = X / w;
    if (Math.abs(sx) >= 1) return '';
    const r = Math.sqrt(1 - sx * sx);
    const s = Y / (r * R);
    if (s < -1 || s > 1) return '';
    const al = beta + Math.asin(s);
    if (al > Math.PI / 2) return '';
    const yy = r * Math.cos(al);
    const zz = r * Math.sin(al);
    // its gore, by longitude round the dome
    const lon = Math.atan2(zz, sx) + Math.PI;
    const g = (lon / (Math.PI * 2)) * GORES;
    const gi = Math.floor(g);
    const seam = g - gi < SEAM_W || g - gi > 1 - SEAM_W;
    const nn = norm([sx * (h / w), yy, zz * (h / Math.max(d, 0.5))]);
    let lit = nn[0] * LIGHT[0] + nn[1] * LIGHT[1] + nn[2] * LIGHT[2];
    // a crumpled canopy: wrinkles across it
    if (fold) lit -= 0.35 * fold * (Math.sin(sx * 9 + yy * 5) > 0.3 ? 1 : 0);
    let base: RGB = gi % 2 ? band : light;
    if (yy > 0.965) base = f.dark; // the vent at the top
    else if (yy < 0.09) base = mix(base, f.dark, 0.35); // the hem
    const k = lit > 0.62 ? 0 : lit > 0.25 ? 1 : 2;
    const shade = [0, 0.18, 0.38][k] + (seam ? 0.16 : 0);
    return css(mix(base, [40, 36, 32], shade));
  }
}

/** How far a paratrooper hangs from right under his canopy as he swings, in screen map pixels. */
export function swingOffset(st: ChuteState): [number, number] {
  if (st.fold) return [0, 0];
  return [L * Math.sin(st.tilt), L * (1 - Math.cos(st.tilt))];
}

/** A canopy's shadow on the grass under it: k from 0 (high up) to 1 (down). */
export function drawChuteShadow(c: CanvasRenderingContext2D, x: number, y: number, k: number, open: number): void {
  const rx = W * (0.3 + 0.7 * Math.min(open, 1)) * (0.55 + 0.45 * k);
  const ry = rx * 0.5;
  c.fillStyle = `rgba(0,0,0,${0.08 + 0.14 * k})`;
  for (let py = -ry; py <= ry; py += 0.5) {
    const hw = rx * Math.sqrt(Math.max(0, 1 - (py / ry) ** 2));
    if (hw < 0.25) continue;
    c.fillRect(Math.round((x - hw) * 2) / 2, Math.round((y + py) * 2) / 2, Math.round(hw * 4) / 2, 0.5);
  }
}

function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2);
  for (let i = 0; i <= n; i++) c.fillRect(Math.round((x0 + ((x1 - x0) * i) / n) * 2) / 2, Math.round((y0 + ((y1 - y0) * i) / n) * 2) / 2, 0.5, 0.5);
}
