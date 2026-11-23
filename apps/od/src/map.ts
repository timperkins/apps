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
  name: 'city' | 'bank';
  w: number;
  h: number;
  tiles: Uint8Array;
  heights: Float32Array;
  pal: Uint8Array;
  restricted: Uint8Array;
  places: Map<number, string>;
  labels: Label[];
  spawns: Record<string, { x: number; y: number }[]>;
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
];

export const ROAD_BASES = [2, 14, 26, 38, 50];

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
  return t === T.Building || t === T.Tree || t === T.Wall || t === T.Vent || t === T.Locked || t === T.Vault || t === T.Counter;
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

export const CITY_W = 66;
export const CITY_H = 54;
export const SHIP_START = { x: 60, y: 27, angle: Math.PI / 2 };

export function buildCity(): GameMap {
  const m = blank('city', CITY_W, CITY_H, T.Grass);
  const r = rng(7);
  const last = ROAD_BASES[ROAD_BASES.length - 1];

  // Trees around the edge.
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < 52; x++) {
      const edge = x < 2 || y < 2 || y > last + 1;
      if (edge && r() < 0.55) rect(m, x, y, x, y, T.Tree, 1.4);
    }

  // Beach and sea.
  rect(m, 52, 0, 54, m.h - 1, T.Sand);
  rect(m, 55, 0, m.w - 1, m.h - 1, T.Water);

  // Blocks: sidewalk ring, then contents.
  for (let i = 0; i < ROAD_BASES.length - 1; i++)
    for (let j = 0; j < ROAD_BASES.length - 1; j++) {
      const x0 = ROAD_BASES[i] + 2;
      const x1 = ROAD_BASES[i + 1] - 1;
      const y0 = ROAD_BASES[j] + 2;
      const y1 = ROAD_BASES[j + 1] - 1;
      rect(m, x0, y0, x1, y1, T.Sidewalk);
      rect(m, x0 + 1, y0 + 1, x1 - 1, y1 - 1, T.Grass);
      fillBlock(m, i, j, x0 + 1, y0 + 1, x1 - 1, y1 - 1, r);
    }

  // Roads on top.
  for (const b of ROAD_BASES) {
    rect(m, 2, b, last + 1, b + 1, T.Road);
    rect(m, b, 2, b + 1, last + 1, T.Road);
  }

  // The dock reaches out to the ship.
  rect(m, 52, 26, 58, 27, T.Dock);
  m.labels.push({ x: 55, y: 25.5, z: 1.4, text: 'DOCK', color: '#7a4f2a' });
  m.spawns.player = [{ x: 8.5, y: 12.5 }];
  return m;
}

function addDoor(m: GameMap, x: number, y: number, place: string) {
  rect(m, x, y, x, y, T.Door);
  m.places.set(idx(m, x, y), place);
}

function fillBlock(m: GameMap, i: number, j: number, x0: number, y0: number, x1: number, y1: number, r: () => number) {
  const key = `${i},${j}`;
  switch (key) {
    case '0,0': // home
      rect(m, x0 + 1, y0 + 1, x0 + 4, y0 + 3, T.Building, 1.3, 7);
      addDoor(m, x0 + 2, y0 + 4, 'home');
      m.labels.push({ x: x0 + 3, y: y0 + 2, z: 2.2, text: 'HOME', color: '#9c3d3d' });
      trees(m, x0 + 5, y0, x1, y1, r, 0.25);
      return;
    case '1,0': // shop
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0 + 1, y0 + 1, x1 - 1, y0 + 4, T.Building, 1.6, 4);
      addDoor(m, x0 + 3, y0 + 5, 'shop');
      addDoor(m, x0 + 4, y0 + 5, 'shop');
      m.labels.push({ x: x0 + 4, y: y0 + 3, z: 2.6, text: 'SHOP', color: '#b06d00' });
      return;
    case '2,0': // car lot
      rect(m, x0, y0, x1, y1, T.Lot);
      rect(m, x1 - 1, y0, x1, y0 + 1, T.Building, 1.1, 3);
      addDoor(m, x1 - 1, y0 + 2, 'lot');
      m.labels.push({ x: x1 - 0.5, y: y0 + 1, z: 2, text: 'CARS', color: '#2e7d32' });
      m.spawns.lotCars = [
        { x: x0 + 1.5, y: y0 + 1.5 },
        { x: x0 + 1.5, y: y0 + 4.5 },
        { x: x0 + 4.5, y: y0 + 1.5 },
        { x: x0 + 4.5, y: y0 + 4.5 },
      ];
      m.spawns.lotDrop = [{ x: x0 + 3, y: y1 - 0.5 }];
      return;
    case '3,0': // police
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0 + 1, y0, x1 - 1, y0 + 4, T.Building, 2, 6);
      m.labels.push({ x: x0 + 4, y: y0 + 2, z: 3, text: 'POLICE', color: '#1f4fa0' });
      m.spawns.police = [{ x: x0 + 4, y: y0 + 6 }];
      return;
    case '1,1': // bank
      rect(m, x0, y0, x1, y1, T.Plaza);
      rect(m, x0, y0, x1, y0 + 4, T.Building, 2.4, 5);
      addDoor(m, x0 + 3, y0 + 5, 'bank');
      addDoor(m, x0 + 4, y0 + 5, 'bank');
      m.labels.push({ x: x0 + 4, y: y0 + 2.5, z: 3.4, text: 'BANK', color: '#8a6d00' });
      m.spawns.bankExit = [{ x: x0 + 4, y: y0 + 6.5 }];
      return;
    case '2,2':
    case '0,3': // parks
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
// L locked door, D exit door, c counter, g guard, s sleeping guard.
const BANK = [
  'WWWWWWWWWWWWWWWWWW',
  'Wrr$$rrrrrrrrrrVVW',
  'Wrr$$rrrrrrrrrrGVW',
  'WrrrrrrrrrrrrrrrVW',
  'WrrrrrrrrrsrrrrrVW',
  'WrrrrrrrrrrrrrrrVW',
  'WWWWWWWLWWWWWWWWVW',
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
