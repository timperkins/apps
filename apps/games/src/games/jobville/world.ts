// Jobville: the village map. A fixed seed, so the village is the same every time you play.

export const W = 180;
export const H = 180;

export const enum T {
  Grass,
  Road,
  Water,
  Sand,
  Field,
  Tree,
  Building,
  Plaza,
  Rock,
  Quarry,
  Flowers,
  Hedge,
  Stump,
  Path,
  Board,
  Dock,
}

export type BuildingKind = 'house' | 'shop' | 'post' | 'pizza' | 'hall' | 'sawmill' | 'barn' | 'mine' | 'fishhut' | 'home';

export interface Building {
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  wall: string;
  roof: string;
  /** The walkable tile in front of the door (door is above it). */
  door: { x: number; y: number };
  /** Door on the top side (house faces a road above it). */
  up: boolean;
  num: number;
  label?: string;
}

export interface World {
  tiles: Uint8Array;
  /** Game time (seconds) when a chopped tree, mined rock or picked crop comes back. */
  regrow: Float64Array;
  hits: Uint8Array;
  buildings: Building[];
  houses: Building[];
  byKind: Partial<Record<BuildingKind, Building>>;
  /** Which building covers each tile (index into buildings, -1 for none). */
  owner: Int16Array;
  fields: number[];
  rocks: number[];
  forest: number[];
  board: { x: number; y: number };
  fountain: { x: number; y: number };
  dock: { x: number; y: number };
  roads: number[];
}

export const idx = (x: number, y: number) => y * W + x;
export const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap per-tile hash for decoration (0..1). */
export function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const WALLS = ['#f2d7b6', '#e9b8a8', '#c9dcef', '#f5ecc4', '#d8e8c7', '#e7cfe9', '#f3c58f', '#d9d2c5', '#bfe3df'];
const ROOFS = ['#b5483a', '#3f6aa1', '#4f8a4a', '#7a4f9a', '#c1762b', '#5a5a6e', '#a13d6c', '#2f7f86'];

// Road grid: 2-wide roads every 12 tiles, 8 x 8 blocks of houses in between.
export const GRID_X0 = 44;
export const GRID_Y0 = 40;
export const PITCH = 12;
export const BLOCKS = 8;

export const SOLID = new Set<number>([T.Water, T.Tree, T.Building, T.Rock, T.Hedge, T.Board]);

export function makeWorld(): World {
  const r = rng(20261117);
  const tiles = new Uint8Array(W * H);
  const owner = new Int16Array(W * H).fill(-1);
  const buildings: Building[] = [];
  const set = (x: number, y: number, t: T) => {
    if (inMap(x, y)) tiles[idx(x, y)] = t;
  };
  const get = (x: number, y: number) => (inMap(x, y) ? tiles[idx(x, y)] : T.Hedge);

  // Grass with flower patches
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) tiles[idx(x, y)] = hash(x, y) < 0.04 ? T.Flowers : T.Grass;

  // West forest
  for (let y = 0; y < H; y++)
    for (let x = 0; x < GRID_X0 - 2; x++) {
      const edge = (GRID_X0 - 2 - x) / 10;
      if (r() < Math.min(0.55, 0.15 + edge * 0.4)) set(x, y, T.Tree);
    }
  // Trees sprinkled everywhere else
  for (let i = 0; i < 900; i++) set(Math.floor(r() * W), Math.floor(r() * H), T.Tree);

  // North quarry
  for (let y = 4; y < GRID_Y0 - 3; y++)
    for (let x = 58; x < 128; x++) {
      const dx = (x - 93) / 36;
      const dy = (y - 20) / 17;
      if (dx * dx + dy * dy < 1) set(x, y, r() < 0.2 ? T.Rock : T.Quarry);
    }

  // East farm fields in patches with hedges
  for (let fy = 0; fy < 6; fy++)
    for (let fx = 0; fx < 3; fx++) {
      const x0 = 145 + fx * 11;
      const y0 = 30 + fy * 20;
      for (let y = y0; y < y0 + 14; y++)
        for (let x = x0; x < x0 + 9; x++) {
          const border = y === y0 || y === y0 + 13 || x === x0 || x === x0 + 8;
          set(x, y, border ? (x === x0 + 4 ? T.Path : T.Grass) : T.Field);
        }
    }

  // South pond with a sandy beach
  const pcx = 120;
  const pcy = 158;
  for (let y = 138; y < H; y++)
    for (let x = 80; x < 170; x++) {
      const dx = (x - pcx) / 30;
      const dy = (y - pcy) / 13;
      const d = dx * dx + dy * dy + (hash(x, y) - 0.5) * 0.08;
      if (d < 1) set(x, y, T.Water);
      else if (d < 1.45) set(x, y, T.Sand);
    }

  // Roads
  const gx = (k: number) => GRID_X0 + k * PITCH;
  const gy = (k: number) => GRID_Y0 + k * PITCH;
  const last = gx(BLOCKS);
  const lastY = gy(BLOCKS);
  for (let k = 0; k <= BLOCKS; k++) {
    for (let y = gy(0); y <= lastY + 1; y++) for (let d = 0; d < 2; d++) set(gx(k) + d, y, T.Road);
    for (let x = gx(0); x <= last + 1; x++) for (let d = 0; d < 2; d++) set(x, gy(k) + d, T.Road);
  }
  // Main roads out to the forest, the farms, the quarry and the pond
  const midX = gx(4);
  const midY = gy(4);
  for (let x = 4; x < W - 4; x++) for (let d = 0; d < 2; d++) if (get(x, midY + d) !== T.Water) set(x, midY + d, T.Road);
  for (let y = 8; y <= lastY; y++) for (let d = 0; d < 2; d++) set(midX + d, y, T.Road);
  // road down to the dock
  for (let y = lastY; y < 146; y++) for (let d = 0; d < 2; d++) set(116 + d, y, T.Road);
  for (let x = midX; x <= 117; x++) for (let d = 0; d < 2; d++) set(x, lastY + d, T.Road);
  // farm lanes
  for (let fy = 0; fy < 6; fy++) {
    const y = 30 + fy * 20 + 16;
    for (let x = last; x < 178; x++) for (let d = 0; d < 2; d++) if (get(x, y + d) !== T.Field) set(x, y + d, T.Road);
  }
  for (let y = 24; y < 150; y++) for (let d = 0; d < 2; d++) if (get(143 + d, y) !== T.Water) set(143 + d, y, T.Road);
  for (let x = 143; x < 160; x++) for (let d = 0; d < 2; d++) set(x, 24 + d, T.Road);

  // Dock into the pond
  const dock = { x: 116, y: 150 };
  for (let y = 146; y < 151; y++) for (let d = 0; d < 2; d++) set(116 + d, y, T.Dock);

  // Hedge border
  for (let i = 0; i < W; i++)
    for (let d = 0; d < 2; d++) {
      set(i, d, T.Hedge);
      set(i, H - 1 - d, T.Hedge);
      set(d, i, T.Hedge);
      set(W - 1 - d, i, T.Hedge);
    }

  // Town square
  const px0 = gx(3) + 2;
  const px1 = gx(5) - 1;
  const py0 = gy(3) + 2;
  const py1 = gy(5) - 1;
  for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) set(x, y, T.Plaza);
  const fountain = { x: midX + 1, y: midY + 1 };
  for (let y = midY - 1; y <= midY + 2; y++) for (let x = midX - 1; x <= midX + 2; x++) set(x, y, T.Building);
  const board = { x: midX - 5, y: midY - 5 };
  set(board.x, board.y, T.Board);
  set(board.x + 1, board.y, T.Board);
  // flower beds at the square's corners
  for (const [cx, cy] of [[px0 + 1, py0 + 1], [px1 - 2, py0 + 1], [px0 + 1, py1 - 2], [px1 - 2, py1 - 2]])
    for (let y = cy; y < cy + 2; y++) for (let x = cx; x < cx + 2; x++) set(x, y, T.Flowers);

  const addBuilding = (b: Omit<Building, 'num'>) => {
    const id = buildings.length;
    const nb: Building = { ...b, num: 0 };
    buildings.push(nb);
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        set(x, y, T.Building);
        if (inMap(x, y)) owner[idx(x, y)] = id;
      }
    if (get(b.door.x, b.door.y) !== T.Road && get(b.door.x, b.door.y) !== T.Plaza) set(b.door.x, b.door.y, T.Path);
    return nb;
  };

  // Special buildings around the square: [block x, block y, kind, label, wall, roof]
  const specials: [number, number, BuildingKind, string, string, string][] = [
    [5, 3, 'shop', 'SHOP', '#ffe08a', '#d04a7a'],
    [2, 3, 'post', 'POST OFFICE', '#cfe0ff', '#2f5fb0'],
    [2, 4, 'pizza', 'PIZZA', '#fff1d6', '#d23b2a'],
    [5, 4, 'hall', 'TOWN HALL', '#efe6d8', '#6b5a8e'],
  ];
  const special = new Set(specials.map(([bx, by]) => `${bx},${by}`));
  for (let by = 3; by <= 4; by++) for (let bx = 3; bx <= 4; bx++) special.add(`${bx},${by}`);

  for (const [bx, by, kind, label, wall, roof] of specials) {
    const x0 = gx(bx) + 2;
    const y0 = gy(by) + 2;
    for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + 10; x++) set(x, y, T.Grass);
    addBuilding({ kind, label, x: x0 + 1, y: y0 + 1, w: 8, h: 6, wall, roof, door: { x: x0 + 5, y: y0 + 7 }, up: false });
    for (let y = y0 + 8; y < y0 + 10; y++) set(x0 + 5, y, T.Path);
  }

  // Houses: up to 4 per block, two facing each road
  const houses: Building[] = [];
  for (let by = 0; by < BLOCKS; by++)
    for (let bx = 0; bx < BLOCKS; bx++) {
      if (special.has(`${bx},${by}`)) continue;
      const x0 = gx(bx) + 2;
      const y0 = gy(by) + 2;
      // clear the block
      for (let y = y0; y < y0 + 10; y++)
        for (let x = x0; x < x0 + 10; x++) set(x, y, hash(x, y) < 0.08 ? T.Flowers : T.Grass);
      const park = r() < 0.08;
      if (park) {
        for (let i = 0; i < 6; i++) set(x0 + 1 + Math.floor(r() * 8), y0 + 1 + Math.floor(r() * 8), T.Tree);
        continue;
      }
      const spots: [number, number, boolean][] = [
        [x0, y0 + 1, true],
        [x0 + 5, y0 + 1, true],
        [x0, y0 + 6, false],
        [x0 + 5, y0 + 6, false],
      ];
      for (const [hx, hy, up] of spots) {
        if (r() < 0.1) {
          if (r() < 0.5) set(hx + 2, hy + 1, T.Tree);
          continue;
        }
        const w = 4 + (r() < 0.3 ? 1 : 0);
        const doorX = hx + Math.floor(w / 2);
        const doorY = up ? hy - 1 : hy + 3;
        const b = addBuilding({
          kind: 'house',
          x: hx,
          y: hy,
          w: Math.min(w, 5),
          h: 3,
          wall: WALLS[Math.floor(r() * WALLS.length)],
          roof: ROOFS[Math.floor(r() * ROOFS.length)],
          door: { x: doorX, y: doorY },
          up,
        });
        houses.push(b);
        if (r() < 0.5) set(hx + (up ? 0 : w - 1), up ? hy + 3 : hy - 1, T.Tree);
      }
    }

  // Out-of-town buildings
  addBuilding({ kind: 'sawmill', label: 'SAWMILL', x: 30, y: midY - 7, w: 8, h: 5, wall: '#b98a58', roof: '#6b4a2b', door: { x: 34, y: midY - 2 }, up: false });
  for (let x = 24; x < 42; x++) for (let y = midY - 9; y < midY; y++) if (get(x, y) === T.Tree) set(x, y, T.Grass);
  addBuilding({ kind: 'barn', label: 'BARN', x: 150, y: 14, w: 9, h: 6, wall: '#c0392b', roof: '#7b241c', door: { x: 154, y: 20 }, up: false });
  for (let y = 21; y < 25; y++) set(154, y, T.Path);
  addBuilding({ kind: 'mine', label: 'MINE', x: 89, y: 4, w: 8, h: 4, wall: '#7d7466', roof: '#4b453d', door: { x: 93, y: 8 }, up: false });
  addBuilding({ kind: 'fishhut', label: 'BAIT', x: 106, y: 141, w: 5, h: 3, wall: '#9fd0e0', roof: '#2b6f8c', door: { x: 108, y: 144 }, up: false });

  // Number the houses along the streets
  houses.sort((a, b) => a.y - b.y || a.x - b.x);
  houses.forEach((h, i) => (h.num = i + 1));

  const byKind: World['byKind'] = {};
  for (const b of buildings) if (b.kind !== 'house') byKind[b.kind] = b;

  const fields: number[] = [];
  const rocks: number[] = [];
  const forest: number[] = [];
  const roads: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const t = tiles[i];
    if (t === T.Field) fields.push(i);
    else if (t === T.Rock) rocks.push(i);
    else if (t === T.Tree) {
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 2 && y > 2 && x < W - 3 && y < H - 3) forest.push(i);
    } else if (t === T.Road) roads.push(i);
  }

  return {
    tiles,
    regrow: new Float64Array(W * H),
    hits: new Uint8Array(W * H),
    buildings,
    houses,
    byKind,
    owner,
    fields,
    rocks,
    forest,
    board,
    fountain,
    dock,
    roads,
  };
}
