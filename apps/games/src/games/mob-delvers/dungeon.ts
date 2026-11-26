// Dungeon and camp layouts. A level is a grid of tiles plus props (crates, chests, torches…).
import type { LevelDef } from './data';

export const T = { VOID: 0, FLOOR: 1, WALL: 2, HAZARD: 3, PILLAR: 4, PORTAL: 5, PATH: 6, HEDGE: 7, HOUSE: 8 } as const;

export type PropKind = 'crate' | 'barrel' | 'chest' | 'torch' | 'shroom' | 'bones' | 'tree' | 'campfire' | 'table' | 'stall' | 'banner' | 'crystal' | 'anvil' | 'flowers' | 'door'
  | 'pumpkin' | 'ruin' | 'rock' | 'cart' | 'ore' | 'statue' | 'reed' | 'spire' | 'tent' | 'bed';
export interface Prop {
  x: number;
  y: number;
  kind: PropKind;
  hp: number;
  open?: boolean;
  /** stall/banner color, tree size… */
  v?: number;
  solid: boolean;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** an outdoor area: grass, trees and daylight instead of stone and torches */
  out?: boolean;
}

export interface Level {
  w: number;
  h: number;
  tiles: Uint8Array;
  vary: Uint8Array;
  explored: Uint8Array;
  /** 1 where a tile is outdoors */
  out: Uint8Array;
  rooms: Room[];
  start: { x: number; y: number };
  bossRoom: number;
  props: Prop[];
  portal: { x: number; y: number; open: boolean };
}

/** Small seeded random number generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blank(w: number, h: number): Level {
  return {
    w, h,
    tiles: new Uint8Array(w * h),
    vary: new Uint8Array(w * h),
    explored: new Uint8Array(w * h),
    out: new Uint8Array(w * h),
    rooms: [],
    start: { x: 0, y: 0 },
    bossRoom: 0,
    props: [],
    portal: { x: 0, y: 0, open: false },
  };
}

export const tileAt = (L: Level, x: number, y: number) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? T.VOID : L.tiles[y * L.w + x]);
export const isWallTile = (t: number) => t === T.WALL || t === T.PILLAR || t === T.VOID || t === T.HEDGE || t === T.HOUSE;

export function generateDungeon(def: LevelDef, seed: number): Level {
  const r = rng(seed);
  const W = 46 + def.rooms * 2, H = 46 + def.rooms * 2;
  const L = blank(W, H);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const set = (x: number, y: number, t: number) => {
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) L.tiles[y * W + x] = t;
  };

  // rooms: a winding chain, each one placed off the previous one so the dungeon reads as a path
  let tries = 0, fails = 0;
  const parent: number[] = [];
  while (L.rooms.length < def.rooms && tries++ < 6000) {
    // grow off the newest room; if it is boxed in, branch off an earlier one
    const pi = fails > 40 && L.rooms.length > 1 ? Math.floor(r() * (L.rooms.length - 1)) : L.rooms.length - 1;
    const last = L.rooms[pi];
    const isBoss = L.rooms.length === def.rooms - 1;
    const w = isBoss ? ri(11, 13) : ri(6, 10), h = isBoss ? ri(11, 13) : ri(6, 10);
    let x: number, y: number;
    if (!last) {
      x = ri(3, 8);
      y = ri(3, 8);
    } else {
      const ang = r() * Math.PI * 2;
      const dist = ri(11, 15);
      x = Math.round(last.cx + Math.cos(ang) * dist - w / 2);
      y = Math.round(last.cy + Math.sin(ang) * dist - h / 2);
    }
    const clash = L.rooms.some((o) => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y);
    if (x < 2 || y < 2 || x + w > W - 3 || y + h > H - 3 || clash) {
      fails++;
      continue;
    }
    fails = 0;
    parent.push(pi);
    L.rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
  }
  // half of every level is outside: the first half of the way is open air, then you go into the dungeon for the second half
  const half = Math.ceil(L.rooms.length / 2);
  L.rooms.forEach((rm, i) => {
    rm.out = i < half;
  });
  for (const rm of L.rooms)
    for (let y = rm.y; y < rm.y + rm.h; y++)
      for (let x = rm.x; x < rm.x + rm.w; x++) {
        set(x, y, T.FLOOR);
        if (rm.out) L.out[y * W + x] = 1;
      }

  // corridors: chain plus a couple of loops
  const carve = (a: Room, b: Room) => {
    const wide = r() < 0.5 ? 2 : 3;
    const outside = !!a.out && !!b.out;
    const put = (x: number, y: number, t: number) => {
      const inRoom = L.rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      set(x, y, t);
      if (!inRoom && x >= 0 && y >= 0 && x < W && y < H) L.out[y * W + x] = outside ? 1 : 0;
    };
    let x = a.cx, y = a.cy;
    const horizFirst = r() < 0.5;
    const stepX = () => {
      while (x !== b.cx) {
        for (let k = 0; k < wide; k++) put(x, y + k - 1, T.FLOOR);
        x += Math.sign(b.cx - x);
      }
    };
    const stepY = () => {
      while (y !== b.cy) {
        for (let k = 0; k < wide; k++) put(x + k - 1, y, T.FLOOR);
        y += Math.sign(b.cy - y);
      }
    };
    if (horizFirst) {
      stepX();
      stepY();
    } else {
      stepY();
      stepX();
    }
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) put(b.cx + k, b.cy + j, T.FLOOR);
  };
  for (let i = 1; i < L.rooms.length; i++) carve(L.rooms[parent[i]], L.rooms[i]);
  for (let k = 0; k < 2 && L.rooms.length > 5; k++) {
    const a = ri(0, L.rooms.length - 4);
    carve(L.rooms[a], L.rooms[a + 2]);
  }

  // walls around every floor tile
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (L.tiles[y * W + x] !== T.VOID) continue;
      let near = false;
      for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) if (tileAt(L, x + i, y + j) === T.FLOOR) near = true;
      if (near) L.tiles[y * W + x] = T.WALL;
    }
  // walls that only touch outdoor ground are hedges; walls between inside and outside stay stone (a building's wall)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (L.tiles[y * W + x] !== T.WALL) continue;
      let o = 0, i = 0;
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) {
          if (tileAt(L, x + k, y + j) !== T.FLOOR) continue;
          if (L.out[(y + j) * W + x + k]) o++;
          else i++;
        }
      if (o && !i) {
        L.tiles[y * W + x] = T.HEDGE;
        L.out[y * W + x] = 1;
      }
    }
  for (let i = 0; i < W * H; i++) L.vary[i] = Math.floor(r() * 256);

  const first = L.rooms[0];
  L.start = { x: first.cx + 0.5, y: first.cy + 0.5 };
  L.bossRoom = L.rooms.length - 1;
  const boss = L.rooms[L.bossRoom];
  L.portal = { x: boss.cx, y: boss.cy, open: false };

  const occupied = new Set<number>();
  const free = (x: number, y: number) => tileAt(L, x, y) === T.FLOOR && !occupied.has(y * W + x);
  const place = (x: number, y: number, kind: PropKind, solid: boolean, hp = 1, v = 0) => {
    occupied.add(y * W + x);
    L.props.push({ x, y, kind, solid, hp, v });
  };
  occupied.add(boss.cy * W + boss.cx);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) occupied.add((first.cy + j) * W + first.cx + i);

  const deco = def.deco;
  L.rooms.forEach((rm, idx) => {
    const nearStart = (x: number, y: number) => idx === 0 && Math.abs(x - first.cx) < 3 && Math.abs(y - first.cy) < 3;
    const spot = (pad = 1): [number, number] => [ri(rm.x + pad, rm.x + rm.w - 1 - pad), ri(rm.y + pad, rm.y + rm.h - 1 - pad)];
    // outdoor areas: trees, flowers and each mission's own things
    if (rm.out) {
      const trees = deco === 'canyon' || deco === 'void' ? 0 : ri(1, 3) + (rm.w * rm.h > 70 ? 1 : 0);
      for (let k = 0; k < trees; k++) {
        const [x, y] = spot();
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'tree', true, 999, deco === 'pumpkins' ? 3 : ri(0, 2));
      }
      if (deco !== 'canyon' && deco !== 'void')
        for (let k = 0; k < 4; k++) {
          const [x, y] = spot(0);
          if (free(x, y)) place(x, y, 'flowers', false, 1, ri(0, 3));
        }
    }
    if (deco === 'village' && rm.out && idx !== L.bossRoom) {
      // broken houses: chunks of wall and fallen roof
      for (let k = 0; k < ri(1, 3); k++) {
        const [x, y] = spot();
        if (!free(x, y) || nearStart(x, y)) continue;
        place(x, y, 'ruin', true, 999, ri(0, 2));
        if (free(x + 1, y) && r() < 0.6) place(x + 1, y, 'ruin', true, 999, ri(0, 2));
        if (free(x, y + 1) && r() < 0.4) place(x, y + 1, 'ruin', true, 999, ri(0, 2));
      }
    }
    if (deco === 'pumpkins' && idx !== L.bossRoom) {
      // pumpkins everywhere
      for (let k = 0; k < ri(6, 11); k++) {
        const [x, y] = spot(0);
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'pumpkin', false, r() < 0.5 ? 1 : 999, ri(0, 3));
      }
    }
    if (deco === 'canyon' && idx !== L.bossRoom) {
      for (let k = 0; k < ri(2, 4); k++) {
        const [x, y] = spot();
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'rock', true, 999, ri(0, 2));
      }
      if (r() < 0.4) {
        const [x, y] = spot();
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'tent', true, 999, 0);
      }
    }
    if (deco === 'mines' && idx !== L.bossRoom) {
      for (let k = 0; k < ri(2, 4); k++) {
        const [x, y] = spot(0);
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'ore', false, 1, ri(0, 3));
      }
      if (r() < 0.6) {
        const [x, y] = spot();
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'cart', true, 999, 0);
      }
    }
    if (deco === 'halls' && !rm.out) {
      for (const [px, py] of [[rm.x + 1, rm.y], [rm.x + rm.w - 2, rm.y]]) if (free(px, py)) place(px, py, 'banner', true, 999, ri(0, 1));
      if (r() < 0.5) {
        const [x, y] = spot(2);
        if (free(x, y)) place(x, y, 'statue', true, 999, 0);
      }
    }
    if (deco === 'caves') {
      for (let k = 0; k < ri(3, 6); k++) {
        const [x, y] = spot(0);
        if (free(x, y) && !nearStart(x, y)) place(x, y, r() < 0.6 ? 'crystal' : 'shroom', false, 1, ri(0, 3));
      }
    }
    if (deco === 'creek' && rm.out) {
      for (let k = 0; k < ri(4, 8); k++) {
        const [x, y] = spot(0);
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'reed', false, 1, ri(0, 3));
      }
    }
    if (deco === 'void' && idx !== L.bossRoom) {
      for (let k = 0; k < ri(1, 3); k++) {
        const [x, y] = spot();
        if (free(x, y) && !nearStart(x, y)) place(x, y, 'spire', true, 999, ri(0, 2));
      }
    }
    if (rm.w >= 8 && rm.h >= 8 && idx !== 0 && !rm.out && deco !== 'caves') {
      for (const [px, py] of [[rm.x + 2, rm.y + 2], [rm.x + rm.w - 3, rm.y + 2], [rm.x + 2, rm.y + rm.h - 3], [rm.x + rm.w - 3, rm.y + rm.h - 3]])
        if (free(px, py)) {
          set(px, py, T.PILLAR);
          occupied.add(py * W + px);
        }
    }
    // a pool of the level's hazard in the middle of some rooms (a creek runs through the creek mission)
    const poolOdds = deco === 'creek' ? 0.8 : 0.45;
    if (def.hazard && idx > 0 && idx !== L.bossRoom && rm.w >= 7 && rm.h >= 7 && r() < poolOdds) {
      const pw = ri(2, rm.w - 5), ph = ri(2, rm.h - 5);
      const px = rm.x + Math.floor((rm.w - pw) / 2), py = rm.y + Math.floor((rm.h - ph) / 2);
      for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) if (free(x, y)) set(x, y, T.HAZARD);
    }
    // torches on the top walls (indoors only)
    if (!rm.out) for (let x = rm.x + 1; x < rm.x + rm.w - 1; x += ri(3, 5)) if (tileAt(L, x, rm.y - 1) === T.WALL) L.props.push({ x, y: rm.y - 1, kind: 'torch', solid: true, hp: 1 });
    if (!rm.out) for (let y = rm.y + 2; y < rm.y + rm.h - 1; y += ri(4, 6)) if (tileAt(L, rm.x - 1, y) === T.WALL) L.props.push({ x: rm.x - 1, y, kind: 'torch', solid: true, hp: 1 });
    if (idx === L.bossRoom) return;
    // crates and barrels along the edges
    const n = ri(1, 4);
    for (let k = 0; k < n; k++) {
      const edge = ri(0, 3);
      const x = edge === 0 ? rm.x : edge === 1 ? rm.x + rm.w - 1 : ri(rm.x, rm.x + rm.w - 1);
      const y = edge === 2 ? rm.y : edge === 3 ? rm.y + rm.h - 1 : ri(rm.y, rm.y + rm.h - 1);
      if (free(x, y)) place(x, y, r() < 0.5 ? 'crate' : 'barrel', true, 1);
    }
    // little floor bits
    if (!rm.out || deco === 'canyon')
      for (let k = 0; k < 2; k++) {
        const [x, y] = spot(0);
        if (free(x, y)) place(x, y, 'bones', false, 1, ri(0, 3));
      }
  });
  // chests in a few rooms (never the first)
  // shuffle with our own seeded random numbers (a sort with a random compare differs between browsers,
  // which gave two players different chest rooms)
  const pickable = L.rooms.map((_, i) => i).filter((i) => i > 0 && i !== L.bossRoom);
  for (let i = pickable.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pickable[i], pickable[j]] = [pickable[j], pickable[i]];
  }
  const chestRooms = pickable.slice(0, 3);
  for (const i of chestRooms) {
    const rm = L.rooms[i];
    for (let k = 0; k < 20; k++) {
      const x = ri(rm.x + 1, rm.x + rm.w - 2), y = rm.y;
      if (free(x, y)) {
        place(x, y, 'chest', true, 1);
        break;
      }
    }
  }
  return L;
}

// The camp: a little clearing with tents, a campfire and the mission table in the middle.
const CAMP = [
  '##########################',
  '#ffff..........,.....ffff#',
  '#f..T....,........T.....f#',
  '#..HHHH..........HHHH....#',
  '#..HHHH...,,.....HHHH..T.#',
  '#..HHHH..........HHHH....#',
  '#........................#',
  '#..T.....:::::::.........#',
  '#........:::::::.....,...#',
  '#....,...:::::::.........#',
  '#........:::::::......T..#',
  '#........................#',
  '#..T.....................#',
  '#.............HHHH.......#',
  '#.......,.....HHHH...,...#',
  '#.............HHHH.......#',
  '#..f.....................#',
  '#.ff..T...........T....ff#',
  '#........................#',
  '##########################',
];

export function generateCamp(): Level {
  const H = CAMP.length, W = CAMP[0].length;
  const L = blank(W, H + 2);
  const r = rng(4242);
  for (let y = 0; y < H + 2; y++)
    for (let x = 0; x < W; x++) {
      const ch = CAMP[y]?.[x] ?? '#';
      const t = ch === '#' ? T.HEDGE : ch === 'H' ? T.HOUSE : ch === ':' ? T.PATH : T.FLOOR;
      L.tiles[y * W + x] = y >= H ? T.HEDGE : t;
      L.vary[y * W + x] = Math.floor(r() * 256);
      if (ch === 'T') L.props.push({ x, y, kind: 'tree', solid: true, hp: 1, v: Math.floor(r() * 3) });
      if (ch === 'f') L.props.push({ x, y, kind: 'flowers', solid: false, hp: 1, v: Math.floor(r() * 4) });
    }
  L.explored.fill(1);
  // the mission map sits on a table in the middle of camp, with the campfire beside it
  L.props.push({ x: 12, y: 8, kind: 'table', solid: true, hp: 1 });
  L.props.push({ x: 13, y: 11, kind: 'campfire', solid: true, hp: 1 });
  L.props.push({ x: 8, y: 11, kind: 'tent', solid: true, hp: 1, v: 0 });
  L.props.push({ x: 18, y: 10, kind: 'tent', solid: true, hp: 1, v: 1 });
  L.props.push({ x: 5, y: 6, kind: 'banner', solid: true, hp: 1, v: 0 });
  L.props.push({ x: 20, y: 6, kind: 'banner', solid: true, hp: 1, v: 1 });
  for (const [dx, dy] of [[4, 6], [18, 6], [15, 16]]) L.props.push({ x: dx, y: dy, kind: 'door', solid: false, hp: 1 });
  L.props.push({ x: 6, y: 12, kind: 'barrel', solid: true, hp: 99 });
  L.props.push({ x: 7, y: 13, kind: 'crate', solid: true, hp: 99 });
  L.props.push({ x: 10, y: 13, kind: 'bed', solid: false, hp: 1 });
  L.start = { x: 13.5, y: 13.5 };
  L.rooms = [{ x: 1, y: 1, w: W - 2, h: H - 1, cx: 13, cy: 10 }];
  return L;
}
