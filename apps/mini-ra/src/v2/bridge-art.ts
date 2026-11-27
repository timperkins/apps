// Bridges and their repair huts, as voxel shapes (see stack.ts).
//
// Four styles: a dirt track on an earth causeway over a culvert and a timber
// trestle for the streams, and a stone arch bridge and a steel truss bridge
// for the rivers. A bridge runs along one of the world axes (axis 0 along x,
// 1 along y), so on screen it lies along one of the diagonals. Its length is
// two abutments (END each, ramping up onto the deck) and n spans of SEG, n
// even, so arches and trusses come out whole.
//
// Each bridge is drawn as two pictures: everything but the rail on the side
// nearest the camera (drawn before anything on the deck), and that rail on
// its own (drawn after), so a tank on the deck shows between them. A broken
// bridge keeps its abutments and the stumps of its piers.
import { RGB, hash2, hex, mix, shade } from '../gfx';
import { Shape, StackSprite, renderStack } from './stack';

export type BridgeStyle = 'dirt' | 'timber' | 'stone' | 'steel';
export const BRIDGE_STYLES: BridgeStyle[] = ['dirt', 'timber', 'stone', 'steel'];

export const END = 12; // an abutment, along the bridge
export const SEG = 8; // a span
export const DECK_W = 9; // half the deck's width, rails and all
// how high the deck is over the water
export const BRIDGE_Z: Record<BridgeStyle, number> = { dirt: 2.5, timber: 4.5, stone: 5, steel: 5 };
const ZMAX: Record<BridgeStyle, number> = { dirt: 5, timber: 8, stone: 8, steel: 13 };

export const bridgeLen = (n: number) => END * 2 + n * SEG;

/** How high the deck's surface is at distance s along a bridge of length L. */
export function deckTop(style: BridgeStyle, s: number, L: number): number {
  const k = Math.max(0, Math.min(1, Math.min(s, L - s) / (END * 0.85)));
  return BRIDGE_Z[style] * k * k * (3 - 2 * k);
}

const DIRT = hex('#8f7f5b');
const DIRT_D = hex('#6a5c41');
const EARTH = hex('#6e5a3e');
const GRASS = hex('#3d5f2d');
const ROCK = hex('#8a7e69');
const ROCK_D = hex('#5a5043');
const WOOD = hex('#7a5634');
const WOOD_L = hex('#9c7446');
const WOOD_D = hex('#4e3620');
const STONE = hex('#a39a86');
const STONE_L = hex('#c2b9a3');
const STONE_D = hex('#6f6758');
const MORTAR = hex('#5e574b');
const CONC = hex('#9a968a');
const CONC_D = hex('#6d6a61');
const TAR = hex('#4a4944');
const LINE = hex('#e0b83c');
const GIRDER = hex('#5f6d63');
const GIRDER_L = hex('#8a9a8c');
const GIRDER_D = hex('#3c4640');
const RUST = hex('#8a5a3a');
const BLACK = hex('#1c1b19');
const HAZ = hex('#e0b83c');
const AMBER = hex('#f0a020');

const mod = (a: number, n: number) => ((a % n) + n) % n;
const grain = (c: RGB, a: number, b: number, s: number, k = 0.08) => shade(c, (hash2(Math.floor(a * 2), Math.floor(b * 2), s) - 0.5) * k);

// The parts of a bridge: (s along, from 0 to L; c across, positive towards
// the camera; z up). near: the near rail only; otherwise everything else.
type Part = (s: number, c: number, z: number, L: number, n: number, broken: boolean) => RGB | null;

// Is s in the middle of the bridge (over the water), not on an abutment?
const midOf = (s: number, L: number) => s > END && s < L - END;
// Where s is in its pair of spans (an arch, a truss panel): t from -SEG to SEG.
const pairT = (s: number) => mod(s - END, SEG * 2) - SEG;

// ---- dirt track over a culvert: a low earth causeway ----
const dirt: Part = (s, c, z, L, _n, broken) => {
  const top = deckTop('dirt', s, L);
  const mid = midOf(s, L);
  if (broken && mid && s > END + 3 && s < L - END - 3) {
    // washed out: low heaps of earth and stones, and a log or two
    const h = hash2(Math.floor(s / 2.5), Math.floor((c + 20) / 3), 71);
    if (z < 0.4 + h * 0.8 && Math.abs(c) < DECK_W && h > 0.45) return grain(h > 0.8 ? ROCK : EARTH, s, c, 72, 0.16);
    if (z < 1.1 && Math.abs(c - (s - L / 2) * 0.8) < 0.9 && Math.abs(s - L / 2) < 6) return WOOD_D;
    return null;
  }
  // the embankment slopes out below the track
  const hw = DECK_W - 0.5 + Math.max(0, top - z) * 0.9;
  if (Math.abs(c) > hw || z > top + 0.01) return null;
  if (z < 0) return null;
  // a culvert pipe through it in the middle, its mouth on either side
  const pc = L / 2;
  if (mid && Math.abs(c) > hw - 0.8) {
    const r = Math.hypot(s - pc, z - 0.9);
    if (r < 1.1) return BLACK;
    if (r < 1.6) return grain(CONC, s, z, 73);
  }
  if (z > top - 0.6) {
    // the track: two ruts, a crown of grass down the middle, grass at the edges
    const ac = Math.abs(c);
    if (ac > DECK_W - 1.6 && hash2(Math.floor(s * 2), Math.floor(c * 2), 74) > 0.35) return grain(GRASS, s, c, 75, 0.2);
    if (Math.abs(ac - 3.6) < 0.7) return grain(DIRT_D, s, c, 76);
    if (ac < 0.8 && hash2(Math.floor(s * 2), 3, 77) > 0.6) return grain(GRASS, s, c, 78, 0.2);
    return grain(DIRT, s, c, 79, 0.14);
  }
  // the bank's face: earth with stones set in it, and logs along its foot
  if (z < 1 && Math.abs(c) > hw - 1) return mod(s, 1.4) < 0.25 ? WOOD_D : grain(WOOD, s, z, 80, 0.15);
  const st = hash2(Math.floor(s / 1.6), Math.floor(z / 1.1) + Math.floor(c), 81);
  return st > 0.7 ? grain(mix(ROCK, ROCK_D, st), s, z, 82) : grain(EARTH, s, z, 83, 0.14);
};

// ---- timber trestle ----
const timber: Part = (s, c, z, L, _n, broken) => {
  const top = deckTop('timber', s, L);
  const mid = midOf(s, L);
  const ac = Math.abs(c);
  if (ac > DECK_W + 0.6 || z < 0) return null;
  const bentT = pairT(s); // a bent of piles at each pair of spans' middle and ends
  const nearBent = Math.min(Math.abs(bentT), SEG - Math.abs(bentT)) < 0.9;
  if (!mid) {
    // the abutment: a crib of logs filled with earth
    if (ac > DECK_W - 0.4 || z > top) return null;
    if (z > top - 0.7) return mod(s, 1.3) < 0.2 ? WOOD_D : grain(WOOD_L, s, c, 90, 0.12);
    if (ac > DECK_W - 1.4) return mod(z, 1.1) < 0.2 ? WOOD_D : grain(WOOD, s, z, 91, 0.14);
    return grain(EARTH, s, z, 92);
  }
  const lost = broken && s > END + 1.5 && s < L - END - 1.5;
  // piles and their cap beam, braced
  if (nearBent) {
    const capZ = top - 1.6;
    const stump = lost ? 1.2 + hash2(Math.floor(s / 4), Math.floor(c / 3) + 5, 93) * 1.6 : capZ;
    for (const pc of [-6, 0, 6]) if (Math.hypot(Math.abs(bentT) < 2 ? bentT : SEG - Math.abs(bentT), c - pc) < 0.75 && z < stump) return grain(WOOD_D, z, c, 94, 0.1);
    if (!lost) {
      if (z >= capZ && z < top - 0.8 && ac < DECK_W - 0.6) return WOOD;
      if (ac < 6 && Math.abs(z - (capZ * (c + 6)) / 12) < 0.35) return WOOD_D;
    }
  }
  if (lost) {
    // a few planks left hanging near the bents
    if (nearBent && z > top - 1.4 && z < top - 0.8 && hash2(Math.floor(c / 1.5), Math.floor(s), 95) > 0.6 && ac < DECK_W - 1) return WOOD_D;
    return null;
  }
  // stringers, the deck planks laid across, and a rail each side
  if (z > top - 1.6 && z < top - 0.8 && (Math.abs(ac - (DECK_W - 2)) < 0.6 || ac < 0.6)) return WOOD_D;
  if (z > top - 0.8 && z <= top && ac < DECK_W - 0.4) return mod(s, 1.6) < 0.22 ? WOOD_D : grain(hash2(Math.floor(s / 1.6), 1, 96) > 0.5 ? WOOD_L : WOOD, s, c, 97, 0.1);
  if (ac > DECK_W - 1 && z > top) {
    const post = mod(s, 2.4) < 0.6;
    if (post && z < top + 2.4) return WOOD;
    if ((z > top + 1.8 && z < top + 2.4) || (z > top + 0.9 && z < top + 1.2)) return WOOD_L;
  }
  return null;
};

// ---- stone arches ----
const masonry = (a: number, z: number, seed: number): RGB => {
  const course = Math.floor(z / 1.2);
  const off = course % 2 ? 1.2 : 0;
  const blk = Math.floor((a + off) / 2.4);
  if (mod(z, 1.2) < 0.18 || mod(a + off, 2.4) < 0.2) return MORTAR;
  return grain(mix(STONE_D, STONE_L, 0.25 + hash2(blk, course, seed) * 0.6), a, z, seed + 1, 0.08);
};
const stone: Part = (s, c, z, L, _n, broken) => {
  const top = deckTop('stone', s, L);
  const mid = midOf(s, L);
  const ac = Math.abs(c);
  if (z < 0) return null;
  const t = pairT(s);
  const R = 6.6; // the arch's span, either side of its middle
  const pier = mid && Math.abs(t) > R;
  // piers stand out a little either side, with pointed cutwaters
  if (pier && z < 2.6) {
    const into = SEG - Math.abs(t); // 0 at the pier's middle
    if (ac < DECK_W + 1.8 - into * 0.9) {
      if (broken || z < 2.6) return masonry(c, z, 101);
    }
  }
  if (ac > DECK_W) return null;
  const lost = broken && mid && s > END + 1 && s < L - END - 1;
  if (lost) {
    if (pier) {
      const h = 2.6 + hash2(Math.floor(s), Math.floor(c / 2), 102) * 2;
      if (z < h) return masonry(s, z, 103);
    }
    // rubble in the water under where the arches were
    const rb = hash2(Math.floor(s / 2), Math.floor(c / 2) + 9, 104);
    if (z < rb * 1.3 && rb > 0.5) return grain(STONE_D, s, c, 105, 0.2);
    return null;
  }
  // the parapets, with lighter coping stones
  if (z > top) {
    if (ac > DECK_W - 1.4 && z < top + 2) return z > top + 1.5 ? grain(STONE_L, s, c, 106) : masonry(s, z - top, 107);
    return null;
  }
  // the arch: open underneath
  if (mid && Math.abs(t) < R) {
    const ah = (BRIDGE_Z.stone - 1.6) * Math.sqrt(1 - (t / R) ** 2);
    if (z < ah) return null;
    // a ring of voussoirs round it
    if (z < ah + 1.1 && ac > DECK_W - 1) return mod(Math.atan2(z, t) * 9, 1) < 0.15 ? MORTAR : grain(STONE_L, s, z, 108);
  }
  if (z > top - 0.5) {
    // the roadway: flagstones
    if (mod(s, 2) < 0.18 || mod(c + (Math.floor(s / 2) % 2) * 1.5, 3) < 0.18) return shade(STONE_D, -0.1);
    return grain(STONE, s, c, 109, 0.1);
  }
  return masonry(ac > DECK_W - 1 ? s : c, z, 110);
};

// ---- steel truss ----
const TRUSS_H = 6.4;
const steel: Part = (s, c, z, L, _n, broken) => {
  const top = deckTop('steel', s, L);
  const mid = midOf(s, L);
  const ac = Math.abs(c);
  if (z < 0 || ac > DECK_W) return null;
  const t = pairT(s);
  const atPier = Math.abs(t) > SEG - 1.8 || !mid;
  // concrete piers under every other span's end (and the abutments)
  if (atPier && z < BRIDGE_Z.steel - 1.2 && ac < DECK_W - 1) {
    if (!mid && z > top - 0.01) return null;
    return mod(z, 1.6) < 0.15 ? CONC_D : grain(CONC, s, z, 120);
  }
  const lost = broken && mid && s > END + 1.5 && s < L - END - 1.5;
  if (lost && !(Math.abs(t) > SEG - 3 && z > top - 2 && z < top && hash2(Math.floor(c / 2), Math.floor(s), 121) > 0.3)) {
    // only the girder stubs at the piers, and wreckage in the water
    if (z < 0.9 && hash2(Math.floor(s / 2), Math.floor(c / 2) + 3, 122) > 0.72) return grain(RUST, s, c, 123, 0.2);
    return null;
  }
  if (lost) return GIRDER_D;
  // the deck: asphalt with a dashed line, kerbs, girders under it
  if (z > top - 0.8 && z <= top) {
    if (ac > DECK_W - 1.6) return grain(CONC, s, c, 124);
    if (ac < 0.3 && mod(s, 4) < 2) return LINE;
    return grain(TAR, s, c, 125, 0.1);
  }
  if (z > top - 2 && z <= top - 0.8 && (Math.abs(ac - (DECK_W - 1.6)) < 0.5 || ac < 0.5) && !(!mid && z < top - 0.8)) return GIRDER_D;
  // the trusses either side: chords, posts and crossed diagonals
  if (z > top && ac > DECK_W - 0.9 && mid) {
    const zz = z - top;
    const u = s - END;
    const span = L - END * 2;
    const h = Math.min(TRUSS_H, u * 0.8, (span - u) * 0.8); // sloping down at the ends
    if (zz > h + 0.01) return null;
    if (zz < 0.8) return grain(GIRDER, s, z, 126);
    if (zz > h - 0.8) return grain(GIRDER_L, s, z, 127);
    const q = mod(u, SEG);
    if (q < 0.5 || q > SEG - 0.5) return GIRDER;
    if (Math.abs(zz - (q / SEG) * h) < 0.55 || Math.abs(zz - (1 - q / SEG) * h) < 0.55) return GIRDER;
    return null;
  }
  return null;
};
// the bracing across the top of a truss bridge, drawn with the near side
const steelTop = (s: number, c: number, z: number, L: number, broken: boolean): RGB | null => {
  if (broken || !midOf(s, L)) return null;
  const top = BRIDGE_Z.steel;
  const u = s - END;
  const span = L - END * 2;
  if (Math.min(u, span - u) * 0.8 < TRUSS_H) return null;
  if (z > top + TRUSS_H - 0.7 && z <= top + TRUSS_H && Math.abs(c) < DECK_W && mod(u, SEG) < 0.6) return GIRDER_D;
  return null;
};

const PARTS: Record<BridgeStyle, Part> = { dirt, timber, stone, steel };

/** The shape of a bridge's two pictures, in its own local coordinates. */
export function bridgeShapes(style: BridgeStyle, axis: 0 | 1, n: number, broken: boolean): { back: Shape; front: Shape | null; rx: number; ry: number; zmax: number } {
  const L = bridgeLen(n);
  const part = PARTS[style];
  // u, v: world x and y from the bridge's middle
  const sc = (u: number, v: number): [number, number] => (axis === 0 ? [u + L / 2, v] : [v + L / 2, u]);
  const nearRail = (c: number, z: number, s: number) => c > DECK_W - 1.6 && z > deckTop(style, s, L) + 0.01;
  const back: Shape = (u, v, z) => {
    const [s, c] = sc(u, v);
    if (s < 0 || s > L) return null;
    if (nearRail(c, z, s)) return null;
    return part(s, c, z, L, n, broken);
  };
  const front: Shape | null =
    style === 'dirt'
      ? null
      : (u, v, z) => {
          const [s, c] = sc(u, v);
          if (s < 0 || s > L) return null;
          if (style === 'steel') {
            const top = steelTop(s, c, z, L, broken);
            if (top) return top;
          }
          if (!nearRail(c, z, s)) return null;
          return part(s, c, z, L, n, broken);
        };
  const rx = axis === 0 ? L / 2 : DECK_W + 2;
  const ry = axis === 0 ? DECK_W + 2 : L / 2;
  return { back, front, rx, ry, zmax: ZMAX[style] };
}

/** A bridge's two pictures (the near rail may be null). */
export function makeBridge(style: BridgeStyle, axis: 0 | 1, n: number, broken: boolean): [StackSprite, StackSprite | null] {
  const { back, front, rx, ry, zmax } = bridgeShapes(style, axis, n, broken);
  const b = renderStack(back, { r: Math.max(rx, ry), rx, ry, zmax, bakeShadow: true, shadowAlpha: 0.3, outline: [24, 22, 18] });
  const f = front ? renderStack(front, { r: Math.max(rx, ry), rx, ry, zmax, bakeShadow: true, noGroundShadow: true, outline: [24, 22, 18] }) : null;
  return [b, f];
}

/** The key a worker makes a bridge's pictures from (see art-worker.ts). */
export const bridgeKey = (style: BridgeStyle, axis: 0 | 1, n: number, broken: boolean) => `br:${style}:${axis}:${n}:${broken ? 1 : 0}`;
export function bridgeFromKey(key: string): [StackSprite, StackSprite | null] {
  const [, style, axis, n, broken] = key.split(':');
  return makeBridge(style as BridgeStyle, Number(axis) as 0 | 1, Number(n), broken === '1');
}

// ---- the repair hut: a little concrete blockhouse with a striped roof edge,
// a door, a toolbox on the step and an amber lamp on top ----
export const HUT_R = 3.5;
export function makeHut(): StackSprite[] {
  const hut = (lit: boolean): Shape => (u, v, z) => {
    const au = Math.abs(u);
    const av = Math.abs(v);
    if (z < 0) return null;
    if (au <= 3 && av <= 2.6 && z < 4.2) {
      // walls: concrete blocks, a door on the +x side, a window on the +y
      if (u > 2.6 && av < 0.9 && z < 2.8) return z > 2.5 ? CONC_D : shade(GIRDER_D, 0.05);
      if (v > 2.2 && au < 1 && z > 1.6 && z < 2.8) return hex('#2e3d44');
      if (z > 3.7) return mod(u + v, 1.4) < 0.7 ? HAZ : BLACK; // a striped band under the roof
      return mod(z, 0.9) < 0.12 || mod(u + (Math.floor(z / 0.9) % 2) * 0.8, 1.6) < 0.12 ? CONC_D : grain(CONC, u, z, 130, 0.06);
    }
    // the roof: flat, overhanging a little
    if (au <= 3.4 && av <= 3 && z >= 4.2 && z < 4.8) return z > 4.6 ? grain(hex('#6a6d68'), u, v, 131) : CONC_D;
    // the lamp
    if (Math.hypot(u + 1.5, v - 1.2) < 0.55 && z >= 4.8 && z < 5.7) return z > 5.1 ? (lit ? AMBER : shade(AMBER, -0.45)) : BLACK;
    // a toolbox by the door
    if (u > 3.4 && u < 4.4 && v > 1 && v < 2.4 && z < 0.9) return z > 0.7 ? shade(hex('#b3402e'), -0.1) : hex('#b3402e');
    return null;
  };
  return [false, true].map((lit) => renderStack(hut(lit), { r: 5, zmax: 7, bakeShadow: true, outline: [24, 22, 18] }));
}
