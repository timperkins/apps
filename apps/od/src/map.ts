// Tile maps for the city and the bank interior.
export const T = {
  Grass: 0,
  Road: 1,
  Sidewalk: 2,
  Water: 3,
  Sand: 4,
  Dock: 5,
  Building: 6,
  Tree: 7,
  Lot: 8,
  Plaza: 9,
  Door: 10,
  Floor: 11,
  Wall: 12,
  Vent: 13,
  Grate: 14,
  Locked: 15,
  Vault: 16,
  Counter: 17,
  Laser: 18,
  Crate: 19,
  Pit: 20, // the jail course: fall in and start over
  Block: 21, // a parkour platform
  Bounce: 22, // a springy pad that throws you up high
  Trophy: 23,
} as const;
export type Tile = (typeof T)[keyof typeof T];

export interface Label {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
}

export interface GameMap {
  name: 'city' | 'bank' | 'jail';
  w: number;
  h: number;
  tiles: Uint8Array;
  heights: Float32Array;
  pal: Uint8Array;
  restricted: Uint8Array;
  places: Map<number, string>;
  labels: Label[];
  spawns: Record<string, { x: number; y: number }[]>;
  /** Jail course: platform number (1..34) for each tile, 0 elsewhere. */
  course?: Int16Array;
  /** Jail course: the tile that shows each platform's number. */
  courseLabels?: Map<number, number>;
  /** Jail course: platforms that blink on and off. */
  blinks?: { tiles: number[]; h: number; phase: number }[];
  /** Blinking platforms about to vanish. */
  warn?: Set<number>;
}

/** Building colours: top, left face, right face. */
export const PALETTE: [string, string, string][] = [
  ['#d9c9a8', '#b8a582', '#9c8a69'], // 0 sand stone
  ['#c9d4e0', '#9fb0c2', '#8396ab'], // 1 grey blue
  ['#e8b4a0', '#c98e78', '#ad7561'], // 2 brick light
  ['#b8d8b0', '#92b78a', '#7a9c72'], // 3 mint
  ['#f0dc96', '#d4bd70', '#b8a05a'], // 4 yellow
  ['#e2e2e8', '#c0c0cc', '#a4a4b2'], // 5 white (bank)
  ['#8fb3e8', '#6b8fcc', '#5577b0'], // 6 police blue
  ['#d68a8a', '#b86868', '#9c5252'], // 7 red roof
  ['#b5a0d8', '#937dbb', '#7a669e'], // 8 purple
  ['#7a7f8c', '#5f6370', '#4c505c'], // 9 bank wall dark
  ['#9aa3ad', '#7b848f', '#646c77'], // 10 vent metal
  ['#a07850', '#80603e', '#664c30'], // 11 wood counter
  ['#ef9a9a', '#d77b7b', '#bb6262'], // 12 jail course red
  ['#90caf9', '#6fa8dc', '#5a8fc2'], // 13 jail course blue
  ['#a5d6a7', '#82b885', '#6b9d6e'], // 14 jail course green
  ['#ffe082', '#e0bd5c', '#c4a144'], // 15 jail course yellow
  ['#ce93d8', '#ae73b8', '#935c9d'], // 16 jail course purple
  ['#ffab91', '#e08a70', '#c47358'], // 17 jail course orange
  ['#80deea', '#5fbcc8', '#4aa1ad'], // 18 jail course cyan (blinking)
  ['#6d7380', '#545a66', '#434852'], // 19 jail stone
];

// 14 x 14 city blocks, 12 tiles apart (about 10 times the area of the first version).
export const BLOCKS = 14;
export const ROAD_BASES = Array.from({ length: BLOCKS + 1 }, (_, i) => 2 + i * 12);

export function idx(m: GameMap, x: number, y: number): number {
  return y * m.w + x;
}

export function tileAt(m: GameMap, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return m.name === 'city' ? T.Tree : T.Wall;
  return m.tiles[ty * m.w + tx];
}

export function isTall(t: number): boolean {
  return (
    t === T.Building ||
    t === T.Tree ||
    t === T.Wall ||
    t === T.Vent ||
    t === T.Locked ||
    t === T.Vault ||
    t === T.Counter ||
    t === T.Crate ||
    t === T.Block ||
    t === T.Bounce ||
    t === T.Trophy
  );
}

/** Low blocks you can jump up onto. */
export function isPlatform(t: number): boolean {
  return t === T.Crate || t === T.Counter || t === T.Block || t === T.Bounce;
}

export function walkable(t: number, inVent: boolean): boolean {
  if (inVent) return t === T.Vent || t === T.Grate;
  return !(isTall(t) || t === T.Water);
}

export function drivable(t: number): boolean {
  return !(isTall(t) || t === T.Water || t === T.Floor);
}

function blank(name: GameMap['name'], w: number, h: number, fill: number): GameMap {
  return {
    name,
    w,
    h,
    tiles: new Uint8Array(w * h).fill(fill),
    heights: new Float32Array(w * h),
    pal: new Uint8Array(w * h),
    restricted: new Uint8Array(w * h),
    places: new Map(),
    labels: [],
    spawns: {},
  };
}

// Small deterministic random so the city is the same every time.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rect(m: GameMap, x0: number, y0: number, x1: number, y1: number, t: number, h = 0, pal = 0) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const i = idx(m, x, y);
      m.tiles[i] = t;
      m.heights[i] = h;
      m.pal[i] = pal;
    }
}

const LAST_ROAD = 2 + BLOCKS * 12;
const BEACH = LAST_ROAD + 2; // first sand column
const SEA = BEACH + 3; // first water column
export const CITY_W = SEA + 30;
export const CITY_H = LAST_ROAD + 4;
const DOCK_Y = ROAD_BASES[Math.floor(BLOCKS / 2)];
export const SHIP_START = { x: SEA + 5, y: DOCK_Y + 1, angle: Math.PI / 2 };

// What goes in special blocks (block column, block row). Everything else is ordinary city or park.
const SPECIAL: Record<string, string> = {
  '0,0': 'home',
  '1,0': 'shop',
  '2,0': 'lot',
  '3,0': 'police',
  '1,1': 'bank',
  '7,5': 'bank',
  '11,10': 'bank',
  '3,11': 'bank',
  '6,3': 'shop',
  '10,7': 'shop',
  '4,9': 'shop',
  '12,2': 'shop',
  '8,9': 'lot',
  '12,12': 'lot',
  '5,6': 'police',
  '11,3': 'police',
  '2,7': 'police',
  '9,12': 'police',
  '2,2': 'park',
  '0,3': 'park',
  '6,0': 'park',
  '8,6': 'park',
  '4,4': 'park',
  '4,0': 'jail',
  '13,8': 'park',
  '1,12': 'park',
  '10,1': 'park',
};

export function buildCity(): GameMap {
  const m = blank('city', CITY_W, CITY_H, T.Grass);
  const r = rng(7);
  const last = LAST_ROAD;
  for (const k of ['police', 'lotCars', 'lotDrop', 'lots']) m.spawns[k] = [];

  // Trees around the edge.
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < BEACH; x++) {
      const edge = x < 2 || y < 2 || y > last + 1 || x > last + 1;
      if (edge && r() < 0.55) rect(m, x, y, x, y, T.Tree, 1.4);
    }

  // Beach and sea, with a few little islands to sail around.
  rect(m, BEACH, 0, SEA - 1, m.h - 1, T.Sand);
  rect(m, SEA, 0, m.w - 1, m.h - 1, T.Water);
  for (const [ix, iy, rad] of [
    [SEA + 16, 25, 4],
    [SEA + 22, 120, 5],
    [SEA + 12, 150, 3],
    [SEA + 20, 60, 3],
  ]) {
    for (let y = iy - rad; y <= iy + rad; y++)
      for (let x = ix - rad; x <= ix + rad; x++) {
        const d = Math.hypot(x - ix, y - iy);
        if (d <= rad) rect(m, x, y, x, y, d < rad - 1.5 && r() < 0.5 ? T.Tree : T.Sand, 1.4);
      }
  }

  // Blocks: sidewalk ring, then contents.
  for (let i = 0; i < BLOCKS; i++)
    for (let j = 0; j < BLOCKS; j++) {
      const x0 = ROAD_BASES[i] + 2;
      const x1 = ROAD_BASES[i + 1] - 1;
      const y0 = ROAD_BASES[j] + 2;
      const y1 = ROAD_BASES[j + 1] - 1;
      rect(m, x0, y0, x1, y1, T.Sidewalk);
      rect(m, x0 + 1, y0 + 1, x1 - 1, y1 - 1, T.Grass);
      fillBlock(m, SPECIAL[`${i},${j}`] ?? (r() < 0.1 ? 'park' : ''), x0 + 1, y0 + 1, x1 - 1, y1 - 1, r);
    }

  // Roads on top.
  for (const b of ROAD_BASES) {
    rect(m, 2, b, last + 1, b + 1, T.Road);
    rect(m, b, 2, b + 1, last + 1, T.Road);
  }

  // The dock reaches out to the ship.
  rect(m, BEACH, DOCK_Y, SHIP_START.x - 2, DOCK_Y + 1, T.Dock);
  m.labels.push({ x: BEACH + 3, y: DOCK_Y - 0.5, z: 1.4, text: 'DOCK', color: '#7a4f2a' });
  m.spawns.player = [{ x: 8.5, y: 12.5 }];
  return m;
}

function addDoor(m: GameMap, x: number, y: number, place: string) {
  rect(m, x, y, x, y, T.Door);
  m.places.set(idx(m, x, y), place);
}

function fillBlock(m: GameMap, kind: string, x0: number, y0: number, x1: number, y1: number, r: () => number) {
  switch (kind) {
    case 'home':
      rect(m, x0 + 1, y0 + 1, x0 + 4, y0 + 3, T.Building, 1.3, 7);
      addDoor(m, x0 + 2, y0 + 4, 'home');
      m.labels.push({ x: x0 + 3, y: y0 + 2, z: 2.2, text: 'HOME', color: '#9c3d3d' });
      trees(m, x0 + 5, y0, x1, y1, r, 0.25);
      return;
    case 'shop':
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0 + 1, y0 + 1, x1 - 1, y0 + 4, T.Building, 1.6, 4);
      addDoor(m, x0 + 3, y0 + 5, 'shop');
      addDoor(m, x0 + 4, y0 + 5, 'shop');
      m.labels.push({ x: x0 + 4, y: y0 + 3, z: 2.6, text: 'SHOP', color: '#b06d00' });
      return;
    case 'lot':
      rect(m, x0, y0, x1, y1, T.Lot);
      rect(m, x1 - 1, y0, x1, y0 + 1, T.Building, 1.1, 3);
      addDoor(m, x1 - 1, y0 + 2, 'lot');
      m.labels.push({ x: x1 - 0.5, y: y0 + 1, z: 2, text: 'CARS', color: '#2e7d32' });
      m.spawns.lotCars.push(
        { x: x0 + 1.5, y: y0 + 1.5 },
        { x: x0 + 1.5, y: y0 + 4.5 },
        { x: x0 + 4.5, y: y0 + 1.5 },
        { x: x0 + 4.5, y: y0 + 4.5 },
      );
      m.spawns.lotDrop.push({ x: x0 + 3, y: y1 - 0.5 });
      return;
    case 'police':
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0 + 1, y0, x1 - 1, y0 + 4, T.Building, 2, 6);
      m.labels.push({ x: x0 + 4, y: y0 + 2, z: 3, text: 'POLICE', color: '#1f4fa0' });
      m.spawns.police.push({ x: x0 + 4, y: y0 + 6 });
      return;
    case 'bank':
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0, y0, x1, y0 + 4, T.Building, 2.4, 5);
      addDoor(m, x0 + 3, y0 + 5, 'bank');
      addDoor(m, x0 + 4, y0 + 5, 'bank');
      m.labels.push({ x: x0 + 4, y: y0 + 2.5, z: 3.4, text: 'BANK', color: '#8a6d00' });
      return;
    case 'jail':
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0, y0, x1, y0 + 4, T.Building, 2.2, 19);
      addDoor(m, x0 + 4, y0 + 5, 'jail');
      m.labels.push({ x: x0 + 4, y: y0 + 2.5, z: 3.2, text: 'JAIL', color: '#37474f' });
      return;
    case 'park':
      trees(m, x0, y0, x1, y1, r, 0.3);
      return;
  }
  // Ordinary city block: a few buildings.
  const mid = x0 + 3 + Math.floor(r() * 2);
  const midY = y0 + 3 + Math.floor(r() * 2);
  const parts = [
    [x0, y0, mid - 1, midY - 1],
    [mid + 1, y0, x1, midY - 1],
    [x0, midY + 1, mid - 1, y1],
    [mid + 1, midY + 1, x1, y1],
  ];
  for (const [a, b, c, d] of parts) {
    if (r() < 0.15) continue;
    const h = 1 + Math.floor(r() * 3) * 0.7;
    const pal = [0, 1, 2, 3, 4, 8][Math.floor(r() * 6)];
    rect(m, a, b, c, d, T.Building, h, pal);
  }
}

function trees(m: GameMap, x0: number, y0: number, x1: number, y1: number, r: () => number, p: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (r() < p) rect(m, x, y, x, y, T.Tree, 1.4);
}

// Bank interior. W wall, . floor, r restricted floor, $ vault, V vent duct, G vent grate,
// L locked door, D exit door, c counter, g guard, s sleeping guard,
// ~ laser floor (sets off the alarm), # crate to jump on (parkour across the lasers).
const BANK = [
  'WWWWWWWWWWWWWWWWWW',
  'Wrr$$~~~~~rrrrrVVW',
  'Wrr$$~#~~~rrrrrGVW',
  'Wrrrr~~~#~rrrrrrVW',
  'Wrrrr~~~~~rsrrrrVW',
  'Wrrrr~~~~~rrrrrrVW',
  'WWWWWWWWWWWWLWWWVW',
  'W...............VW',
  'W..............GVW',
  'W.cccccc.........W',
  'W................W',
  'W....g......g....W',
  'W................W',
  'W................W',
  'WWWWWWWWDWWWWWWWWW',
];

export function buildBank(): GameMap {
  const w = BANK[0].length;
  const h = BANK.length;
  const m = blank('bank', w, h, T.Floor);
  m.spawns.guards = [];
  m.spawns.sleepers = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = BANK[y][x] ?? 'W';
      const i = idx(m, x, y);
      switch (c) {
        case 'W':
          rect(m, x, y, x, y, T.Wall, 1.3, 9);
          break;
        case 'r':
          m.restricted[i] = 1;
          break;
        case '$':
          rect(m, x, y, x, y, T.Vault, 1.2, 5);
          m.restricted[i] = 1;
          break;
        case 'V':
          rect(m, x, y, x, y, T.Vent, 1.3, 10);
          break;
        case 'G':
          rect(m, x, y, x, y, T.Grate);
          m.restricted[i] = BANK[y][x - 1] === 'r' ? 1 : 0;
          break;
        case 'L':
          rect(m, x, y, x, y, T.Locked, 1.3, 11);
          break;
        case 'D':
          addDoor(m, x, y, 'exit');
          break;
        case 'c':
          rect(m, x, y, x, y, T.Counter, 0.6, 11);
          break;
        case '~':
          rect(m, x, y, x, y, T.Laser);
          m.restricted[i] = 1;
          break;
        case '#':
          rect(m, x, y, x, y, T.Crate, 0.55, 11);
          m.restricted[i] = 1;
          break;
        case 'g':
          m.spawns.guards.push({ x: x + 0.5, y: y + 0.5 });
          break;
        case 's':
          m.spawns.sleepers.push({ x: x + 0.5, y: y + 0.5 });
          m.restricted[i] = 1;
          break;
      }
    }
  // Cutaway: the front walls are drawn low so you can see inside.
  for (let x = 0; x < w; x++) m.heights[idx(m, x, h - 1)] = 0.35;
  for (let y = 0; y < h; y++) m.heights[idx(m, w - 1, y)] = 0.35;
  m.spawns.entry = [{ x: 8.5, y: 13.2 }];
  m.labels.push({ x: 3.5, y: 1.5, z: 2.2, text: 'VAULT', color: '#8a6d00' });
  return m;
}

// The jail: a huge parkour course. 34 platforms over a deep pit, from START to the golden trophy.
// [x, y, width, depth, height, kind]: b block, k blinks on and off, s springy pad.
export const COURSE: [number, number, number, number, number, 'b' | 'k' | 's'][] = [
  [10, 25, 2, 2, 0.4, 'b'], // 1
  [13, 25, 1, 1, 0.7, 'b'],
  [15, 26, 1, 1, 0.9, 'b'],
  [17, 25, 2, 1, 0.6, 'b'],
  [20, 25, 1, 1, 0.6, 'k'], // 5
  [22, 24, 1, 1, 0.8, 'b'],
  [24, 24, 1, 1, 0.3, 's'],
  [26, 23, 2, 2, 2.2, 'b'],
  [29, 23, 1, 1, 2.0, 'b'],
  [31, 24, 1, 1, 1.6, 'b'], // 10
  [33, 25, 3, 1, 1.0, 'b'],
  [37, 25, 1, 1, 0.6, 'k'],
  [37, 22, 1, 1, 0.9, 'b'],
  [36, 19, 2, 1, 1.2, 'b'],
  [37, 17, 1, 1, 0.5, 'k'], // 15
  [36, 14, 1, 2, 0.8, 'b'],
  [34, 13, 1, 1, 1.1, 'b'],
  [31, 12, 2, 1, 1.4, 'b'],
  [29, 11, 1, 1, 0.3, 's'],
  [26, 10, 2, 2, 2.4, 'b'], // 20
  [23, 11, 1, 1, 2.0, 'b'],
  [21, 12, 1, 1, 1.6, 'k'],
  [18, 12, 2, 1, 1.2, 'b'],
  [16, 11, 1, 1, 1.4, 'b'],
  [14, 12, 1, 1, 1.0, 'b'], // 25
  [11, 12, 1, 3, 0.7, 'b'],
  [8, 13, 1, 1, 0.5, 'k'],
  [5, 12, 2, 2, 0.8, 'b'],
  [5, 9, 1, 1, 1.1, 'b'],
  [6, 7, 1, 1, 0.3, 's'], // 30
  [8, 5, 2, 1, 2.2, 'b'],
  [11, 4, 1, 1, 1.8, 'k'],
  [14, 4, 1, 1, 1.4, 'b'],
  [17, 2, 4, 3, 1.0, 'b'], // 34: the finish
];

export function buildJail(): GameMap {
  const w = 40;
  const h = 30;
  const m = blank('jail', w, h, T.Pit);
  m.course = new Int16Array(w * h);
  m.courseLabels = new Map();
  m.blinks = [];
  m.warn = new Set();
  rect(m, 0, 0, w - 1, 0, T.Wall, 1.6, 19);
  rect(m, 0, 0, 0, h - 1, T.Wall, 1.6, 19);
  rect(m, w - 1, 0, w - 1, h - 1, T.Wall, 0.35, 19);
  rect(m, 0, h - 1, w - 1, h - 1, T.Wall, 0.35, 19);
  // the start: solid floor by the door
  rect(m, 1, 24, 8, 28, T.Floor);
  addDoor(m, 4, h - 1, 'exit');
  const colors = [12, 13, 14, 15, 16, 17];
  COURSE.forEach(([x, y, cw, cd, ch, kind], k) => {
    const n = k + 1;
    const t = kind === 's' ? T.Bounce : T.Block;
    const pal = kind === 'k' ? 18 : kind === 's' ? 12 : colors[k % colors.length];
    rect(m, x, y, x + cw - 1, y + cd - 1, t, ch, pal);
    const tiles: number[] = [];
    for (let yy = y; yy < y + cd; yy++)
      for (let xx = x; xx < x + cw; xx++) {
        m.course![idx(m, xx, yy)] = n;
        tiles.push(idx(m, xx, yy));
      }
    m.courseLabels!.set(idx(m, x + cw - 1, y + cd - 1), n);
    if (kind === 'k') m.blinks!.push({ tiles, h: ch, phase: n * 0.7 });
  });
  // the golden trophy waits at the end of platform 34
  rect(m, 21, 3, 21, 3, T.Trophy, 1.3, 15);
  m.spawns.entry = [{ x: 4.5, y: 27.5 }];
  m.spawns.start = [{ x: 5.5, y: 25.5 }];
  m.labels.push({ x: 5, y: 24.5, z: 1.2, text: 'START', color: '#2e7d32' });
  m.labels.push({ x: 19, y: 3, z: 2.6, text: 'FINISH', color: '#b8860b' });
  return m;
}

export const BLINK_CYCLE = 3.4;
export const BLINK_ON = 2.4;

/** Turn the blinking platforms on and off for the time t. */
export function jailTick(m: GameMap, t: number) {
  if (!m.blinks || !m.warn) return;
  m.warn.clear();
  for (const b of m.blinks) {
    const local = (t + b.phase) % BLINK_CYCLE;
    const on = local < BLINK_ON;
    for (const i of b.tiles) {
      m.tiles[i] = on ? T.Block : T.Pit;
      m.heights[i] = on ? b.h : 0;
      if (on && local > BLINK_ON - 0.7) m.warn.add(i);
    }
  }
}
