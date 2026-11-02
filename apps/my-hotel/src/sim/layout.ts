// The hotel's floor plan. The world is a grid of 1x1 cells grouped into 12x12 "lots".
// Cell (x, z) covers world x..x+1, z..z+1. +z is the front of the hotel (towards the street).
// Lot (0, 0) is the lobby. Lots with j = 1 are the street and can never be bought.

export const LOT = 12;
export const MIN_I = -4;
export const MAX_I = 4;
export const MIN_J = -4;
export const MAX_J = 0;
export const START_LOTS: [number, number][] = [[-1, 0], [0, 0], [1, 0]];

export type LotKey = string;
export const lotKey = (i: number, j: number): LotKey => `${i},${j}`;
export function parseLot(k: LotKey): [number, number] {
  const [i, j] = k.split(',').map(Number);
  return [i, j];
}
export const lotOfCell = (x: number, z: number): [number, number] => [Math.floor(x / LOT), Math.floor(z / LOT)];

export interface Rect {
  x0: number;
  z0: number;
  x1: number; // exclusive, world units
  z1: number;
}
export const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;

// ---------- lobby (lot 0,0) ----------
export const DESK: Rect = { x0: 2, z0: 4, x1: 4, z1: 8 }; // blocked cells
export const DESK_ZONE: Rect = { x0: 0, z0: 4, x1: 2, z1: 8 }; // stand here to check guests in
export const SOFA: Rect = { x0: 8, z0: 1, x1: 11, z1: 2 };
export const ENTRANCE_CELLS = [5, 6]; // x of the gap in the lobby's front wall (z = 11)
export const ENTRANCE_X = 6;
export const SPAWN = { x: 6, z: LOT + 9 }; // out on the street
export const COIN_PILE = { x: 3, z: 9 };
export const PILE_RADIUS = 1.6;
export const QUEUE_CELLS: [number, number][] = [4, 5, 6, 7, 8, 9, 10].map((x) => [x, 5]);
export const RECEPTIONIST_SPOT = { x: 1, z: 6 };

// ---------- room lots ----------
// Each non-lobby lot holds two rooms at the back (x 0-4 and 7-11, z 0-6) with a corridor
// between them (x 5-6) so every lot connects front-to-back and side-to-side.
export interface RoomGeom {
  rect: Rect; // whole room including walls, in cells
  door: [number, number]; // x of the two door cells in the front wall
  bed: { x: number; z: number }; // where the guest sleeps
  clean: Rect; // stand here to clean
  pad: { x: number; z: number };
}

export function roomGeom(i: number, j: number, side: 0 | 1): RoomGeom {
  const x0 = i * LOT + (side === 0 ? 0 : 7);
  const z0 = j * LOT;
  const doorStart = side === 0 ? x0 + 2 : x0 + 1;
  return {
    rect: { x0, z0, x1: x0 + 5, z1: z0 + 7 },
    door: [doorStart, doorStart + 1],
    bed: { x: x0 + 2.5, z: z0 + 2.5 },
    clean: { x0: x0 + 1, z0: z0 + 1, x1: x0 + 4, z1: z0 + 6 },
    pad: { x: doorStart + 1, z: z0 + 9 },
  };
}

export function lotCenter(i: number, j: number) {
  return { x: i * LOT + LOT / 2, z: j * LOT + LOT / 2 };
}

/** Lots next to the hotel that can be bought now. */
export function lotsForSale(owned: Set<LotKey>): [number, number][] {
  const out: [number, number][] = [];
  for (let i = MIN_I; i <= MAX_I; i++) {
    for (let j = MIN_J; j <= MAX_J; j++) {
      if (owned.has(lotKey(i, j))) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => owned.has(lotKey(i + di, j + dj)));
      if (touches) out.push([i, j]);
    }
  }
  return out;
}

/**
 * Unowned lots that the hotel has completely surrounded can't be reached from outside,
 * so they come with the purchase that closed them in.
 */
export function enclosedLots(owned: Set<LotKey>): [number, number][] {
  const seen = new Set<LotKey>();
  const stack: [number, number][] = [];
  // flood from every lot on the border of the allowed area (and the street row)
  for (let i = MIN_I - 1; i <= MAX_I + 1; i++) {
    for (let j = MIN_J - 1; j <= MAX_J + 1; j++) {
      const border = i === MIN_I - 1 || i === MAX_I + 1 || j === MIN_J - 1 || j === MAX_J + 1;
      if (border) stack.push([i, j]);
    }
  }
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const k = lotKey(i, j);
    if (seen.has(k) || owned.has(k)) continue;
    if (i < MIN_I - 1 || i > MAX_I + 1 || j < MIN_J - 1 || j > MAX_J + 1) continue;
    seen.add(k);
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  const out: [number, number][] = [];
  for (let i = MIN_I; i <= MAX_I; i++) {
    for (let j = MIN_J; j <= MAX_J; j++) {
      const k = lotKey(i, j);
      if (!owned.has(k) && !seen.has(k)) out.push([i, j]);
    }
  }
  return out;
}

// ---------- the walkable grid ----------
export type WallKind = 'outer' | 'room';

export interface Grid {
  x0: number; // first cell x
  z0: number;
  w: number;
  h: number;
  blocked: Uint8Array; // 1 = blocked
  walls: Map<number, WallKind>; // index -> wall kind, for drawing
}

export interface LayoutInput {
  owned: Set<LotKey>;
  builtRooms: { i: number; j: number; side: 0 | 1 }[];
}

export function worldBounds(owned: Set<LotKey>) {
  let minI = 0, maxI = 0, minJ = 0;
  for (const k of owned) {
    const [i, j] = parseLot(k);
    minI = Math.min(minI, i);
    maxI = Math.max(maxI, i);
    minJ = Math.min(minJ, j);
  }
  return { x0: (minI - 1) * LOT, x1: (maxI + 2) * LOT, z0: (minJ - 1) * LOT, z1: 2 * LOT };
}

export function buildGrid(input: LayoutInput): Grid {
  const b = worldBounds(input.owned);
  const w = b.x1 - b.x0, h = b.z1 - b.z0;
  const grid: Grid = { x0: b.x0, z0: b.z0, w, h, blocked: new Uint8Array(w * h), walls: new Map() };
  const mark = (x: number, z: number, kind: WallKind | null) => {
    const gx = x - grid.x0, gz = z - grid.z0;
    if (gx < 0 || gz < 0 || gx >= w || gz >= h) return;
    const idx = gz * w + gx;
    grid.blocked[idx] = 1;
    if (kind) grid.walls.set(idx, kind);
  };

  for (const k of input.owned) {
    const [i, j] = parseLot(k);
    const ox = i * LOT, oz = j * LOT;
    const open = (di: number, dj: number) => input.owned.has(lotKey(i + di, j + dj));
    for (let lx = 0; lx < LOT; lx++) {
      for (let lz = 0; lz < LOT; lz++) {
        let wall = false;
        if (lx === 0 && !open(-1, 0)) wall = true;
        if (lx === LOT - 1 && !open(1, 0)) wall = true;
        if (lz === 0 && !open(0, -1)) wall = true;
        if (lz === LOT - 1 && !open(0, 1)) wall = true;
        // close the diagonal pinch where two walls meet at an inside corner
        if (!wall && (lx === 0 || lx === LOT - 1) && (lz === 0 || lz === LOT - 1)) {
          const di = lx === 0 ? -1 : 1, dj = lz === 0 ? -1 : 1;
          if (!open(di, dj)) wall = true;
        }
        if (wall && i === 0 && j === 0 && lz === LOT - 1 && ENTRANCE_CELLS.includes(lx)) wall = false;
        if (wall) mark(ox + lx, oz + lz, 'outer');
      }
    }
  }

  if (input.owned.has(lotKey(0, 0))) {
    for (let x = DESK.x0; x < DESK.x1; x++) for (let z = DESK.z0; z < DESK.z1; z++) mark(x, z, null);
    for (let x = SOFA.x0; x < SOFA.x1; x++) for (let z = SOFA.z0; z < SOFA.z1; z++) mark(x, z, null);
  }

  for (const r of input.builtRooms) {
    const g = roomGeom(r.i, r.j, r.side);
    for (let x = g.rect.x0; x < g.rect.x1; x++) {
      for (let z = g.rect.z0; z < g.rect.z1; z++) {
        const edge = x === g.rect.x0 || x === g.rect.x1 - 1 || z === g.rect.z0 || z === g.rect.z1 - 1;
        if (!edge) continue;
        if (z === g.rect.z1 - 1 && g.door.includes(x)) continue;
        mark(x, z, 'room');
      }
    }
  }
  return grid;
}

export function isBlocked(g: Grid, x: number, z: number): boolean {
  const gx = Math.floor(x) - g.x0, gz = Math.floor(z) - g.z0;
  if (gx < 0 || gz < 0 || gx >= g.w || gz >= g.h) return true;
  return g.blocked[gz * g.w + gx] === 1;
}
