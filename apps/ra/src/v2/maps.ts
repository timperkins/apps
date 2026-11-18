// The maps you can pick from when the game starts. Each one shapes the same
// kind of land differently: how much of the planet is water, how much is high
// ground, and (for the ocean maps) where the land is. Where your army and the
// enemy's base start is given as fractions of the screen-space map.
import { RGB, WrapNoise, hex, mix, rng, wrapNoise } from '../gfx';
import { CH } from '../tiles';
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
  // how big the planet is, against the usual one (1): the small maps are a
  // fraction of it across, so the bases are close and games are quick
  size?: number;
  // how many players it is made for, fewest to most
  players: [number, number];
  // where players can start, as fractions of the map (at least players[1]
  // of them); startsFor() picks the ones furthest apart for a game
  starts: [number, number][];
  home: [number, number]; // single player: your start
  enemy: [number, number]; // and the enemy base (the start furthest from yours)
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// Shortest distance between two coordinates on a loop of length p.
const loop = (d: number, p: number) => {
  d = Math.abs(d) % p;
  return Math.min(d, p - d);
};
// Turn a signed distance from the coast (negative inland) into a nudge to the
// lake field: inland is kept dry, the open sea wet, and the coast in between
// is left to the noise, so it comes out ragged. `k` is how wide that ragged
// band is, as a share of the map's width.
const coast = (d: number, w: number, k = 0.09) => clamp(d / (k * w), -1, 1.5) * 0.35;

// Distances on the ground, in map pixels across: screen y is squashed by
// half in the isometric view, so a fraction of the map's height counts
// double. (u, v) are fractions of the map.
const gdist = (sx: number, sy: number, w: number, h: number, u: number, v: number) => Math.hypot(loop(sx - u * w, w), loop(sy - v * h, h) * 2);
// ...to the segment from (u0, v0) to (u1, v1), which mustn't cross the map's edge.
function segDist(sx: number, sy: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number): number {
  const ax = u0 * w;
  const ay = v0 * h * 2;
  const bx = u1 * w;
  const by = v1 * h * 2;
  // the copy of the point nearest the segment's middle
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  let px = sx;
  let py = sy * 2;
  px += Math.round((mx - px) / w) * w;
  py += Math.round((my - py) / (h * 2)) * h * 2;
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / Math.max(1e-9, dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
// A blob of radius r (a share of the map's width) round (u, v), its edge
// wobbling by `wob` of that: the signed distance to its edge.
const blob = (sx: number, sy: number, w: number, h: number, N: WrapNoise, s: number, u: number, v: number, r: number, wob = 0.3) =>
  gdist(sx, sy, w, h, u, v) - r * w * (1 + (N(sx, sy, w / 6, s, 2) - 0.5) * wob * 2);
// Points evenly round a circle of radius r about (u, v), starting at angle a0.
const ringOf = (n: number, u: number, v: number, r: number, a0 = Math.PI): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    return [(((u + Math.cos(a) * r) % 1) + 1) % 1, (((v + Math.sin(a) * r) % 1) + 1) % 1];
  });
// A grid of starts: `cols` across, `rows` down, every other row shifted half a step.
const lattice = (cols: number, rows: number, u0: number, v0: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) out.push([(u0 + (i + (j % 2) * 0.5) / cols) % 1, (v0 + j / rows) % 1]);
  return out;
};

// Distance between two starts on the planet (it wraps both ways), on the ground.
export const startDist = (a: [number, number], b: [number, number]) => Math.hypot(loop(a[0] - b[0], 1), loop(a[1] - b[1], 1));

// The n starts of a map for a game of n players: the first one, then each
// time the one furthest from all those picked so far.
export function startsFor(def: Pick<MapDef, 'starts'>, n: number): [number, number][] {
  const all = def.starts;
  const out: [number, number][] = [all[0]];
  while (out.length < Math.min(n, all.length)) {
    let best = -1;
    let bd = -1;
    for (let i = 0; i < all.length; i++) {
      if (out.includes(all[i])) continue;
      const d = Math.min(...out.map((p) => startDist(p, all[i])));
      if (d > bd + 1e-9) {
        bd = d;
        best = i;
      }
    }
    out.push(all[best]);
  }
  return out;
}

type Recipe = Omit<MapDef, 'home' | 'enemy'>;

const RECIPES: Recipe[] = [
  // ----- small maps: a few screens across, for quick games -----
  {
    id: 'islet',
    name: 'Islet',
    blurb: 'A little island alone in the ocean, with the enemy just down the beach.',
    water: 0.8,
    high: 0.06,
    size: 0.25,
    mask: (sx, sy, w, h, N, s) => coast(blob(sx, sy, w, h, N, s, 0.5, 0.5, 0.21, 0.15), w, 0.06),
    players: [2, 2],
    starts: [
      [0.38, 0.5],
      [0.62, 0.5],
    ],
  },
  {
    id: 'skirmish',
    name: 'Skirmish',
    blurb: 'A small world of open grassland with a few ponds. Nowhere to hide.',
    water: 0.1,
    high: 0.08,
    size: 0.25,
    players: [2, 4],
    starts: lattice(2, 2, 0.25, 0.25),
  },
  {
    id: 'twins',
    name: 'Twin Isles',
    blurb: 'Two small islands joined by a sandbar, a base on each.',
    water: 0.72,
    high: 0.08,
    size: 0.3,
    mask: (sx, sy, w, h, N, s) => {
      const d = Math.min(
        blob(sx, sy, w, h, N, s, 0.3, 0.5, 0.15, 0.15),
        blob(sx, sy, w, h, N, s + 3, 0.7, 0.5, 0.15, 0.15),
        segDist(sx, sy, w, h, 0.3, 0.5, 0.7, 0.5) - 0.05 * w,
      );
      return coast(d, w, 0.05);
    },
    players: [2, 2],
    starts: [
      [0.27, 0.5],
      [0.73, 0.5],
    ],
  },
  {
    id: 'brook',
    name: 'Brookside',
    blurb: 'A stream winds through a small world. Cross at the fords, or go the long way round.',
    water: 0.14,
    high: 0.1,
    size: 0.3,
    mask: (sx, sy, w, h, N, s) => {
      const xc = 0.5 * w + (N(0, sy, w / 3, s + 1, 2) - 0.5) * w * 0.08;
      let r = 0.03 * w - loop(sx - xc, w);
      for (const fv of [0.15, 0.65]) if (loop(sy / h - fv, 1) < 0.06) r = Math.min(r, -0.02 * w);
      return coast(r, w, 0.025);
    },
    players: [2, 2],
    starts: [
      [0.25, 0.4],
      [0.75, 0.4],
    ],
  },
  // ----- planet-sized maps -----
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
    players: [2, 2],
    starts: [
      [0.22, 0.5],
      [0.72, 0.5],
    ],
  },
  {
    id: 'ring',
    name: 'Equator',
    blurb: 'A belt of land around the middle of the planet, oceans to north and south. Two ways around to the enemy.',
    water: 0.5,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      const yc = h * 0.5 + (N(sx, 0, w / 3, s + 1, 2) - 0.5) * h * 0.25;
      const t = 0.25 * w * (1 + (N(sx, 0, w / 5, s + 2, 2) - 0.5) * 0.6);
      return coast(loop(sy - yc, h) * 2 - t, w);
    },
    players: [2, 4],
    starts: [
      [0.25, 0.5],
      [0.75, 0.5],
      [0.0, 0.5],
      [0.5, 0.5],
    ],
  },
  {
    id: 'lakes',
    name: 'Lakelands',
    blurb: 'Rolling grassland all the way around, with lakes and ridges. Open in every direction.',
    water: 0.15,
    high: 0.14,
    players: [2, 8],
    starts: [[0.24, 0.3], ...lattice(4, 2, 0.24, 0.3).slice(1)],
  },
  {
    id: 'high',
    name: 'Highlands',
    blurb: 'Dry, rugged country: few lakes and plateaus everywhere.',
    water: 0.06,
    high: 0.3,
    players: [2, 8],
    starts: [[0.24, 0.3], ...lattice(4, 2, 0.24, 0.3).slice(1)],
  },
  {
    id: 'trident',
    name: 'Trident',
    blurb: 'Three long peninsulas joined in the middle, a base at the tip of each.',
    water: 0.66,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      const tips = ringOf(3, 0.5, 0.5, 0.33, Math.PI / 2);
      let d = blob(sx, sy, w, h, N, s, 0.5, 0.5, 0.14);
      for (const [u, v] of tips) {
        d = Math.min(d, segDist(sx, sy, w, h, 0.5, 0.5, u, v) - 0.075 * w, blob(sx, sy, w, h, N, s + 5, u, v, 0.11));
      }
      return coast(d, w, 0.07);
    },
    players: [2, 3],
    starts: ringOf(3, 0.5, 0.5, 0.33, Math.PI / 2),
  },
  {
    id: 'isthmus',
    name: 'Isthmus',
    blurb: 'Two round lands joined by a narrow neck. Whoever holds the neck holds the map.',
    water: 0.68,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      const d = Math.min(
        blob(sx, sy, w, h, N, s, 0.27, 0.5, 0.2, 0.2),
        blob(sx, sy, w, h, N, s + 3, 0.73, 0.5, 0.2, 0.2),
        segDist(sx, sy, w, h, 0.27, 0.5, 0.73, 0.5) - 0.06 * w,
      );
      return coast(d, w, 0.06);
    },
    players: [2, 4],
    starts: [
      [0.2, 0.4],
      [0.8, 0.6],
      [0.2, 0.62],
      [0.8, 0.38],
    ],
  },
  {
    id: 'cross',
    name: 'Crossroads',
    blurb: 'Two belts of land cross in the middle of the ocean and run on around the planet.',
    water: 0.6,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      const xc = 0.5 * w + (N(0, sy, w / 3, s + 1, 2) - 0.5) * w * 0.1;
      const yc = 0.5 * h + (N(sx, 0, w / 3, s + 2, 2) - 0.5) * h * 0.2;
      const d = Math.min(loop(sx - xc, w), loop(sy - yc, h) * 2) - 0.1 * w;
      return coast(d, w, 0.06);
    },
    players: [2, 4],
    starts: [
      [0.25, 0.5],
      [0.75, 0.5],
      [0.5, 0.25],
      [0.5, 0.75],
    ],
  },
  {
    id: 'serpent',
    name: 'Serpent',
    blurb: 'A winding band of land coiled around the planet, sea on either side.',
    water: 0.62,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      const u = sx / w;
      const off = 0.07 * Math.sin(u * Math.PI * 4) + (N(sx, sy, w / 4, s + 1, 2) - 0.5) * 0.08;
      const d = (loop(sy / h - u - off, 1) / Math.SQRT2) * w - 0.11 * w;
      return coast(d, w, 0.06);
    },
    players: [2, 4],
    starts: [
      [0.125, 0.125 + 0.07],
      [0.625, 0.625 + 0.07],
      [0.375, 0.375 - 0.07],
      [0.875, 0.875 - 0.07],
    ],
  },
  {
    id: 'fjords',
    name: 'Fjords',
    blurb: 'A northern sea with long, narrow inlets cutting deep into the land.',
    water: 0.3,
    high: 0.18,
    mask: (sx, sy, w, h, N, s) => {
      // the sea, round the top (and bottom) edge of the map
      let d = 0.11 * w - loop(sy, h) * 2;
      // inlets reaching down from it, and up into it from the far side
      for (let i = 0; i < 6; i++) {
        const u = (i + 0.5) / 6;
        const down = i % 2 === 0;
        const v1 = down ? 0.38 : 0.62;
        const wob = (N(sx, sy, w / 8, s + i, 2) - 0.5) * 0.04 * w;
        d = Math.max(d, 0.03 * w - segDist(sx, sy, w, h, u, down ? 0.02 : 0.98, u, v1) + wob);
      }
      return coast(d, w, 0.035);
    },
    players: [2, 4],
    starts: [
      [1 / 6, 0.5],
      [2 / 3, 0.5],
      [1 / 3, 0.5],
      [5 / 6, 0.5],
    ],
  },
  {
    id: 'rivers',
    name: 'Riverlands',
    blurb: 'Three great rivers run from pole to pole. Cross them at the fords.',
    water: 0.2,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      let d = -1e9;
      for (let i = 0; i < 3; i++) {
        const xc = (i / 3) * w + (N(0, sy, w / 5, s + i, 2) - 0.5) * w * 0.12;
        let r = 0.028 * w - loop(sx - xc, w);
        // fords: dry crossings, three on each river
        for (let k = 0; k < 3; k++) {
          const fv = ((k + (i % 2) * 0.5) / 3 + 0.1) % 1;
          if (loop(sy / h - fv, 1) < 0.035) r = Math.min(r, -0.02 * w);
        }
        d = Math.max(d, r);
      }
      return coast(d, w, 0.025);
    },
    players: [2, 6],
    starts: [
      [1 / 6, 0.25],
      [5 / 6, 0.75],
      [0.5, 0.25],
      [1 / 6, 0.75],
      [5 / 6, 0.25],
      [0.5, 0.75],
    ],
  },
  {
    id: 'inland',
    name: 'Inland Sea',
    blurb: 'Land all the way around a great sea in the middle of the map.',
    water: 0.3,
    high: 0.14,
    mask: (sx, sy, w, h, N, s) => coast(-blob(sx, sy, w, h, N, s, 0.5, 0.5, 0.24, 0.25), w, 0.06),
    players: [2, 6],
    starts: [[0.13, 0.5], ...ringOf(6, 0.5, 0.5, 0.37).slice(1)],
  },
  {
    id: 'atoll',
    name: 'Atoll',
    blurb: 'A ring of land around a lagoon, open ocean outside. Bases around the ring.',
    water: 0.6,
    high: 0.1,
    mask: (sx, sy, w, h, N, s) => {
      const r = gdist(sx, sy, w, h, 0.5, 0.5) * (1 + (N(sx, sy, w / 6, s, 2) - 0.5) * 0.2);
      return coast(Math.abs(r - 0.3 * w) - 0.1 * w, w, 0.05);
    },
    players: [2, 6],
    starts: ringOf(6, 0.5, 0.5, 0.3),
  },
  {
    id: 'wetlands',
    name: 'Wetlands',
    blurb: 'Low, soggy country full of lakes and ponds. Lots of ways around, few straight lines.',
    water: 0.3,
    high: 0.06,
    players: [2, 6],
    starts: lattice(3, 2, 1 / 6, 0.25),
  },
  {
    id: 'seas',
    name: 'Six Seas',
    blurb: 'Six round seas set about the planet, with bases on the land between them.',
    water: 0.33,
    high: 0.12,
    mask: (sx, sy, w, h, N, s) => {
      let d = -1e9;
      for (const [u, v] of lattice(3, 2, 0, 0)) d = Math.max(d, -blob(sx, sy, w, h, N, s + Math.round(u * 10), u, v, 0.135, 0.25));
      return coast(d, w, 0.05);
    },
    players: [2, 6],
    starts: lattice(3, 2, 1 / 6, 0.25),
  },
  {
    id: 'badlands',
    name: 'Badlands',
    blurb: 'Dry and broken: plateaus and ridges everywhere, hardly any water.',
    water: 0.03,
    high: 0.45,
    players: [2, 8],
    starts: lattice(4, 2, 0.125, 0.25),
  },
  {
    id: 'crater',
    name: 'Crater Lake',
    blurb: 'A ring of water around an island in the middle, crossed by three causeways. Bases all around it.',
    water: 0.16,
    high: 0.14,
    mask: (sx, sy, w, h, N, s) => {
      const dx = ((((sx - 0.5 * w) % w) + 1.5 * w) % w) - w / 2;
      const dy = (((((sy - 0.5 * h) % h) + 1.5 * h) % h) - h / 2) * 2;
      const r = Math.hypot(dx, dy) * (1 + (N(sx, sy, w / 6, s, 2) - 0.5) * 0.12);
      let d = 0.05 * w - Math.abs(r - 0.17 * w);
      const a = Math.atan2(dy, dx);
      for (let i = 0; i < 3; i++) {
        const da = Math.abs(((a - (i / 3) * Math.PI * 2 - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da * r < 0.035 * w) d = Math.min(d, -0.03 * w);
      }
      return coast(d, w, 0.03);
    },
    players: [2, 8],
    starts: ringOf(8, 0.5, 0.5, 0.38),
  },
  {
    id: 'pangaea',
    name: 'Pangaea',
    blurb: 'One great continent with ragged coasts, room for a crowd.',
    water: 0.5,
    high: 0.14,
    mask: (sx, sy, w, h, N, s) => {
      const dx = loop(sx - 0.5 * w, w) / 0.42;
      const dy = (loop(sy - 0.5 * h, h) * 2) / 0.37;
      const r = Math.hypot(dx, dy) * (1 + (N(sx, sy, w / 5, s, 3) - 0.5) * 0.5);
      return coast(r - w, w, 0.07);
    },
    players: [4, 8],
    starts: ringOf(8, 0.5, 0.5, 0.26).map(([u, v]): [number, number] => [0.5 + (u - 0.5) * 1.15, 0.5 + (v - 0.5) * 1.0]),
  },
  {
    id: 'continents',
    name: 'Two Continents',
    blurb: 'Two big lands, east and west, joined by a land bridge on each side.',
    water: 0.5,
    high: 0.14,
    mask: (sx, sy, w, h, N, s) => {
      const land = (u: number, s2: number) => {
        const dx = loop(sx - u * w, w) / 0.2;
        const dy = (loop(sy - 0.5 * h, h) * 2) / 0.38;
        return ((Math.hypot(dx, dy) * (1 + (N(sx, sy, w / 5, s + s2, 3) - 0.5) * 0.4)) / w - 1) * 0.2 * w;
      };
      const d = Math.min(
        land(0.25, 0),
        land(0.75, 7),
        segDist(sx, sy, w, h, 0.25, 0.3, 0.75, 0.3) - 0.055 * w,
        segDist(sx, sy, w, h, 0.75, 0.7, 1.25, 0.7) - 0.055 * w,
      );
      return coast(d, w, 0.06);
    },
    players: [4, 8],
    starts: [
      [0.22, 0.22],
      [0.78, 0.78],
      [0.78, 0.22],
      [0.22, 0.78],
      [0.3, 0.5],
      [0.7, 0.5],
      [0.16, 0.5],
      [0.84, 0.5],
    ],
  },
  {
    id: 'meridian',
    name: 'Meridian',
    blurb: 'A broad belt of land from pole to pole, ocean around the back of the planet.',
    water: 0.46,
    high: 0.14,
    mask: (sx, sy, w, h, N, s) => {
      const xc = 0.5 * w + (N(0, sy, w / 3, s + 1, 2) - 0.5) * w * 0.12;
      const t = 0.26 * w * (1 + (N(0, sy, w / 5, s + 2, 2) - 0.5) * 0.4);
      return coast(loop(sx - xc, w) - t, w, 0.07);
    },
    players: [4, 8],
    starts: [
      [0.38, 0.125],
      [0.62, 0.625],
      [0.62, 0.125],
      [0.38, 0.625],
      [0.38, 0.375],
      [0.62, 0.875],
      [0.62, 0.375],
      [0.38, 0.875],
    ],
  },
  {
    id: 'plains',
    name: 'Grand Plains',
    blurb: 'Wide open grassland, hardly a lake or a hill. Made for big games.',
    water: 0.04,
    high: 0.06,
    players: [6, 8],
    starts: lattice(4, 2, 0.125, 0.25),
  },
];

export const MAPS: MapDef[] = RECIPES.map((r) => {
  const [home, enemy] = startsFor(r, 2);
  return { ...r, home, enemy };
});

// The maps that fit a game of n players.
export const mapsFor = (n: number): MapDef[] => MAPS.filter((m) => n >= m.players[0] && n <= m.players[1]);

// Where you start in the Combat stage: a base of your own a short drive
// from the enemy's (about a screen and a half). On a small map your usual
// start is already that close.
export const combatHome = (def: MapDef): [number, number] => ((def.size ?? 1) < 1 ? def.home : [(def.enemy[0] + 0.89) % 1, def.enemy[1]]);

// The size of the planet a map makes, given the usual one (w x h map pixels):
// scaled by its size, in whole ground tiles.
export function worldOf(def: Pick<MapDef, 'size'>, w: number, h: number): { w: number; h: number } {
  const s = def.size ?? 1;
  if (s === 1) return { w, h };
  return { w: Math.max(4, Math.round((w / CH) * s)) * CH, h: Math.max(2, Math.round((h / CH) * s)) * CH };
}

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

// The land a seed would make on a coarse pw x ph grid: 0 water, 1 beach,
// 2 grass, 3 plateau, with each water cell's depth (0..1).
export function landGrid(def: MapDef, seed: number, w: number, h: number, pw: number, ph: number): { kind: Uint8Array; depth: Float32Array } {
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
  const kind = new Uint8Array(n);
  const depth = new Float32Array(n);
  for (let q = 0; q < n; q++) {
    const v = wet[q];
    if (v > wThr) depth[q] = Math.min(1, ((v - wThr) / Math.max(1e-6, wMax - wThr)) * 1.6);
    kind[q] = v > wThr ? 0 : v > sThr ? 1 : hi[q] > hThr ? 3 : 2;
  }
  return { kind, depth };
}

// The colors players' start dots are drawn in on the previews (a start's
// number is its place in startsFor).
export const START_DOTS = ['#8fb2dc', '#eba05d'];
// every place a player can start, all alike (the multiplayer lobby)
export const START_DOT = '#e8e2c8';

// A small picture of the map the game would make from this seed: water,
// beaches, grass and plateaus, and dots for the starts: yours and the enemy
// base, or (given `players`) each player's.
export function mapPreview(def: MapDef, seed: number, w: number, h: number, pw = 160, ph = 80, allStarts = false): HTMLCanvasElement {
  const { kind, depth } = landGrid(def, seed, w, h, pw, ph);
  const n = pw * ph;
  const cv = document.createElement('canvas');
  cv.width = pw;
  cv.height = ph;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(pw, ph);
  const rnd = rng(seed);
  for (let q = 0; q < n; q++) {
    const k = kind[q];
    const col: RGB = k === 0 ? mix(P_SHALLOW, P_DEEP, Math.pow(depth[q], 0.6)) : k === 1 ? P_SAND : k === 3 ? P_HIGH : mix(P_GRASS, hex('#2f4d24'), rnd() * 0.5);
    img.data.set([col[0], col[1], col[2], 255], q * 4);
  }
  c.putImageData(img, 0, 0);
  const dot = (f: [number, number], fill: string) => {
    const x = Math.round(f[0] * pw);
    const y = Math.round(f[1] * ph);
    // (the map wraps round: a start on an edge shows on both sides)
    for (const ox of [-pw, 0, pw])
      for (const oy of [-ph, 0, ph]) {
        c.fillStyle = '#10170d';
        c.fillRect(x + ox - 3, y + oy - 3, 7, 7);
        c.fillStyle = fill;
        c.fillRect(x + ox - 2, y + oy - 2, 5, 5);
      }
  };
  if (allStarts) def.starts.forEach((p) => dot(p, START_DOT));
  else {
    dot(def.home, START_DOTS[0]);
    dot(def.enemy, START_DOTS[1]);
  }
  return cv;
}
