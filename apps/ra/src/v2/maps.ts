// The maps you can pick from when the game starts. Each one shapes the same
// kind of land differently: how much of the planet is water, how much is high
// ground, and (for the ocean maps) where the land is. Where your army and the
// enemy's base start is given as fractions of the screen-space map.
import { RGB, WrapNoise, hex, mix, rng, wrapNoise } from '../gfx';
import { HIGH_CELL, LAKE_CELL } from './terrain';

// Shapes the land: added to the lake field at screen point (sx, sy), so higher
// means wetter. N is seamless noise over the map.
export type Mask = (sx: number, sy: number, w: number, h: number, N: WrapNoise, s: number) => number;

export interface MapDef {
  id: string;
  name: string;
  blurb: string;
  water: number; // share of the planet under water
  high: number; // share of the land raised into plateaus
  mask?: Mask;
  home: [number, number]; // your start, as fractions of the map
  enemy: [number, number]; // the enemy base
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// Shortest distance between two coordinates on a loop of length p.
const loop = (d: number, p: number) => {
  d = Math.abs(d) % p;
  return Math.min(d, p - d);
};
// Turn a signed distance from the coast (negative inland) into a nudge to the
// lake field: inland is kept dry, the open sea wet, and the coast in between
// is left to the noise, so it comes out ragged.
const coast = (d: number, w: number) => clamp(d / (0.09 * w), -1, 1.5) * 0.35;

export const MAPS: MapDef[] = [
  {
    id: 'isle',
    name: 'Long Isle',
    blurb: 'One long island in a world of ocean. The enemy is at the far end.',
    water: 0.75,
    high: 0.1,
    // a long, wobbly island lying east-west with blunt ends, and a wide
    // stretch of open sea between its ends the other way round
    mask: (sx, sy, w, h, N, s) => {
      const a0 = 0.19 * w;
      const a1 = 0.75 * w;
      const dx = sx >= a0 && sx <= a1 ? 0 : Math.min(loop(sx - a0, w), loop(sx - a1, w));
      const yc = h * 0.5 + (N(sx, 0, w / 3, s + 1, 2) - 0.5) * h * 0.25;
      const t = 0.175 * w * (1 + (N(sx, 0, w / 4, s + 2, 2) - 0.5) * 0.6);
      return coast(Math.hypot(dx * 1.8, loop(sy - yc, h) * 2) - t, w);
    },
    home: [0.22, 0.5],
    enemy: [0.72, 0.5],
  },
  {
    id: 'ring',
    name: 'Equator',
    blurb: 'A belt of land round the middle of the planet, oceans to north and south. Two ways round to the enemy.',
    water: 0.5,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      const yc = h * 0.5 + (N(sx, 0, w / 3, s + 1, 2) - 0.5) * h * 0.25;
      const t = 0.25 * w * (1 + (N(sx, 0, w / 5, s + 2, 2) - 0.5) * 0.6);
      return coast(loop(sy - yc, h) * 2 - t, w);
    },
    home: [0.25, 0.5],
    enemy: [0.75, 0.5],
  },
  {
    id: 'lakes',
    name: 'Lakelands',
    blurb: 'Rolling grassland all the way round, with lakes and ridges. Open in every direction.',
    water: 0.15,
    high: 0.14,
    home: [0.24, 0.3],
    enemy: [0.74, 0.8],
  },
  {
    id: 'high',
    name: 'Highlands',
    blurb: 'Dry, rugged country: few lakes and plateaus everywhere.',
    water: 0.06,
    high: 0.3,
    home: [0.24, 0.3],
    enemy: [0.74, 0.8],
  },
];

// Where you start in the Combat stage: a base of your own a short drive
// from the enemy's (about a screen and a half).
export const combatHome = (def: MapDef): [number, number] => [(def.enemy[0] + 0.89) % 1, def.enemy[1]];

export const mapDef = (id: string): MapDef => MAPS.find((m) => m.id === id) ?? MAPS[0];

const percentile = (s: Float32Array, q: number) => {
  const a = s.slice().sort();
  return a[Math.min(a.length - 1, Math.floor(a.length * q))] ?? 0;
};

const P_DEEP = hex('#1c3d5c');
const P_SHALLOW = hex('#4d8ea6');
const P_SAND = hex('#b8a676');
const P_GRASS = hex('#3d5f2d');
const P_HIGH = hex('#5f6b3a');

// A small picture of the map the game would make from this seed: water,
// beaches, grass and plateaus, and dots for your start and the enemy base.
export function mapPreview(def: MapDef, seed: number, w: number, h: number, pw = 160, ph = 80): HTMLCanvasElement {
  const N = wrapNoise(w, h);
  const n = pw * ph;
  const wet = new Float32Array(n);
  const hi = new Float32Array(n);
  for (let j = 0; j < ph; j++)
    for (let i = 0; i < pw; i++) {
      const sx = ((i + 0.5) / pw) * w;
      const sy = ((j + 0.5) / ph) * h;
      wet[j * pw + i] = N(sx, sy, LAKE_CELL, seed, 5) + (def.mask?.(sx, sy, w, h, N, seed + 300) ?? 0);
      hi[j * pw + i] = N(sx, sy, HIGH_CELL, seed + 211, 4);
    }
  const wThr = percentile(wet, 1 - def.water);
  const sThr = percentile(wet, 1 - def.water - 0.025);
  const wMax = percentile(wet, 0.999);
  const hThr = percentile(hi, 1 - def.high);
  const cv = document.createElement('canvas');
  cv.width = pw;
  cv.height = ph;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(pw, ph);
  const rnd = rng(seed);
  for (let q = 0; q < n; q++) {
    const v = wet[q];
    let col: RGB;
    if (v > wThr) col = mix(P_SHALLOW, P_DEEP, Math.pow(Math.min(1, ((v - wThr) / Math.max(1e-6, wMax - wThr)) * 1.6), 0.6));
    else if (v > sThr) col = P_SAND;
    else if (hi[q] > hThr) col = P_HIGH;
    else col = mix(P_GRASS, hex('#2f4d24'), rnd() * 0.5);
    img.data.set([col[0], col[1], col[2], 255], q * 4);
  }
  c.putImageData(img, 0, 0);
  const dot = (f: [number, number], fill: string) => {
    const x = Math.round(f[0] * pw);
    const y = Math.round(f[1] * ph);
    c.fillStyle = '#10170d';
    c.fillRect(x - 3, y - 3, 7, 7);
    c.fillStyle = fill;
    c.fillRect(x - 2, y - 2, 5, 5);
  };
  dot(def.home, '#8fb2dc');
  dot(def.enemy, '#eba05d');
  return cv;
}
