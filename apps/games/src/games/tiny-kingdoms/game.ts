// Tiny Kingdoms: the world and its rules. The host's game runs this; friends only draw snapshots of it.

export const TILE = 64;
export const MW = 110;
export const MH = 72;
/** Teams 0–3 are the players' kingdoms (all on one side), 4 is the Black kingdom, 5 is the wild (sheep). */
export const BLACK = 4;
export const WILD = 5;
export const COLORS = ['blue', 'red', 'yellow', 'purple', 'black'] as const;
export const COLOR_NAMES = ['Blue', 'Red', 'Yellow', 'Purple', 'Black'];

export type UnitKind = 'hero' | 'pawn' | 'warrior' | 'archer' | 'lancer' | 'monk' | 'sheep' | 'fighter';
export type BuildKind = 'castle' | 'house' | 'barracks' | 'archery' | 'monastery' | 'tower' | 'wall' | 'mansion' | 'tower2';
export type Res = 'gold' | 'wood' | 'meat';
export type Cost = Partial<Record<Res, number>>;
export type Order = 'follow' | 'defend' | 'attack';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Anim = 'idle' | 'run' | 'attack' | 'attack2' | 'shoot' | 'heal' | 'chop' | 'mine' | 'stab' | 'guard' | 'graze';

export const UNIT_KINDS: UnitKind[] = ['hero', 'pawn', 'warrior', 'archer', 'lancer', 'monk', 'sheep', 'fighter'];
export const BUILD_KINDS: BuildKind[] = ['castle', 'house', 'barracks', 'archery', 'monastery', 'tower', 'wall', 'mansion', 'tower2'];
export const ANIMS: Anim[] = ['idle', 'run', 'attack', 'attack2', 'shoot', 'heal', 'chop', 'mine', 'stab', 'guard', 'graze'];

interface UnitStat { name: string; hp: number; speed: number; dmg: number; range: number; cd: number; aggro: number; pop: number; cost?: Cost; r: number; desc: string }
export const UNIT: Record<UnitKind, UnitStat> = {
  hero: { name: 'Hero', hp: 360, speed: 200, dmg: 30, range: 82, cd: 0.5, aggro: 0, pop: 0, r: 18, desc: '' },
  pawn: { name: 'Pawn', hp: 60, speed: 150, dmg: 5, range: 52, cd: 1, aggro: 0, pop: 1, cost: { meat: 12 }, r: 14, desc: 'Chops wood, mines gold and herds sheep for meat.' },
  warrior: { name: 'Warrior', hp: 140, speed: 140, dmg: 15, range: 62, cd: 0.9, aggro: 300, pop: 1, cost: { gold: 15, meat: 15 }, r: 17, desc: 'Sword and shield. Tough and cheap.' },
  archer: { name: 'Archer', hp: 70, speed: 140, dmg: 11, range: 330, cd: 1.3, aggro: 380, pop: 1, cost: { gold: 10, wood: 20 }, r: 15, desc: 'Shoots from far away. Keep them behind warriors.' },
  lancer: { name: 'Lancer', hp: 180, speed: 165, dmg: 25, range: 96, cd: 1.2, aggro: 330, pop: 2, cost: { gold: 30, meat: 25 }, r: 19, desc: 'Long lance, lots of health, hits hard. Takes 2 room.' },
  monk: { name: 'Monk', hp: 80, speed: 135, dmg: 0, range: 240, cd: 2, aggro: 320, pop: 1, cost: { gold: 25, wood: 20 }, r: 15, desc: 'Heals hurt friends nearby, heroes too.' },
  fighter: { name: 'Fighter', hp: 50, speed: 145, dmg: 4, range: 56, cd: 0.9, aggro: 280, pop: 1, cost: {}, r: 14, desc: 'Costs just 1 wood, 1 meat or 1 gold (whatever you have most of). Weak, but cheap!' },
  sheep: { name: 'Sheep', hp: 24, speed: 70, dmg: 0, range: 0, cd: 1, aggro: 0, pop: 0, r: 13, desc: '' },
};

interface BuildStat { name: string; hp: number; w: number; h: number; cost: Cost; trains: UnitKind[]; pop?: number; desc: string }
export const BUILD: Record<BuildKind, BuildStat> = {
  castle: { name: 'Castle', hp: 2600, w: 5, h: 2, cost: {}, trains: ['pawn'], pop: 10, desc: 'Your home. Shoots arrows at enemies close by. Keep it standing!' },
  house: { name: 'House', hp: 450, w: 2, h: 1, cost: { wood: 30 }, trains: [], pop: 5, desc: 'Room for 5 more units.' },
  barracks: { name: 'Barracks', hp: 900, w: 3, h: 2, cost: { wood: 60, gold: 10 }, trains: ['fighter', 'warrior', 'lancer'], desc: 'Trains fighters, warriors and lancers.' },
  archery: { name: 'Archery Range', hp: 750, w: 3, h: 2, cost: { wood: 60, gold: 10 }, trains: ['archer'], desc: 'Trains archers.' },
  monastery: { name: 'Monastery', hp: 750, w: 3, h: 2, cost: { wood: 80, gold: 30 }, trains: ['monk'], desc: 'Trains monks, who heal.' },
  tower: { name: 'Tower', hp: 1000, w: 2, h: 2, cost: { wood: 60, gold: 20 }, trains: [], desc: 'Shoots arrows at enemies that come close.' },
  wall: { name: 'Wall', hp: 600, w: 1, h: 1, cost: { wood: 6 }, trains: [], desc: 'Stops enemies until they break it. Your own army walks right through. Keep placing to make a long wall.' },
  mansion: { name: 'Mansion', hp: 1100, w: 3, h: 2, cost: { wood: 90, gold: 40 }, trains: [], pop: 15, desc: 'A big fancy house: room for 15 more units.' },
  tower2: { name: 'Double Arrow Tower', hp: 1600, w: 3, h: 2, cost: { wood: 110, gold: 70 }, trains: [], desc: 'Two towers that shoot two arrows at once, farther than a tower.' },
};
export const BUILDABLE: BuildKind[] = ['wall', 'house', 'mansion', 'barracks', 'archery', 'tower', 'tower2', 'monastery'];

const DIFF: Record<Difficulty, { grace: number; gap: number; mult: number; hp: number }> = {
  easy: { grace: 240, gap: 85, mult: 0.6, hp: 0.8 },
  normal: { grace: 180, gap: 70, mult: 1, hp: 1 },
  hard: { grace: 120, gap: 55, mult: 1.4, hp: 1.15 },
};

const CARRY: Record<Res, number> = { wood: 6, gold: 6, meat: 8 };
export const START_STOCK = { gold: 60, wood: 60, meat: 30 };

export interface Unit {
  id: number; kind: UnitKind; team: number;
  x: number; y: number; hp: number; maxHp: number;
  anim: Anim; seq: number; animT: number; left: boolean;
  cd: number; target: number; think: number;
  order?: Order; slot?: number; // heroes: whose
  carry?: Res; carryN: number; job?: Res; node: number; // pawns
  path: number[]; pathGoal: number; pathT: number; stuck: number;
  homeX: number; homeY: number; // sheep and black guards
  hitT: number; garrison?: boolean; dead?: boolean;
  dmgMul: number; wx: number; wy: number; aimY: number; eatT: number;
}
export interface Building {
  id: number; kind: BuildKind; team: number;
  x: number; y: number; // bottom middle, in pixels
  hp: number; maxHp: number; cd: number; variant: number; dead?: boolean;
}
export interface Tree { id: number; tx: number; ty: number; wood: number; regrow: number; variant: number }
export interface Gold { id: number; tx: number; ty: number; gold: number }
export interface Arrow { x: number; y: number; tx: number; ty: number; target: number; dmg: number; team: number; speed: number; ang: number }
export interface Kingdom {
  slot: number; stock: Record<Res, number>; order: Order; heroId: number; respawn: number;
  castleId: number; cx: number; cy: number; out: boolean;
}
export interface Input { mx: number; my: number; atk: boolean; guard: boolean }
export type Fx = [kind: number, x: number, y: number]; // kinds: 0 explosion, 1 dust, 2 heal, 3 splash, 4 big explosion, 5 tree hit and 6 gold hit (x, y are the tile)
export type Sound = 'swing' | 'hit' | 'bow' | 'chop' | 'mine' | 'coin' | 'build' | 'boom' | 'heal' | 'baa' | 'horn' | 'win' | 'lose' | 'train' | 'no' | 'hurt' | 'eat';
export interface SoundEv { s: Sound; x: number; y: number }

/** Small seeded random, so every player builds the same island from the seed. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** The island: 1 for land, 0 for water. Same seed, same island. */
export function makeLand(seed: number): Uint8Array {
  const r = rng(seed * 7 + 3);
  const land = new Uint8Array(MW * MH);
  // a wobbly edge: each side moves in and out by 0–3 tiles
  const wob = (n: number) => { const a: number[] = []; let v = 1.5; for (let i = 0; i < n; i++) { v = Math.max(0, Math.min(3, v + (r() - 0.5) * 1.4)); a.push(v); } return a; };
  const top = wob(MW), bot = wob(MW), lef = wob(MH), rig = wob(MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const inside = y >= 2 + top[x] && y < MH - 2 - bot[x] && x >= 2 + lef[y] && x < MW - 2 - rig[y];
    // round the corners
    const cx = Math.min(x - 2, MW - 3 - x), cy = Math.min(y - 2, MH - 3 - y);
    const corner = cx < 5 && cy < 5 && Math.hypot(5 - cx, 5 - cy) > 5.5;
    land[y * MW + x] = inside && !corner ? 1 : 0;
  }
  // smooth: no one-tile spikes or holes (they draw badly)
  for (let pass = 0; pass < 3; pass++) for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    const i = y * MW + x;
    const h = land[i - 1] + land[i + 1], v = land[i - MW] + land[i + MW];
    if (land[i] && (h === 0 || v === 0)) land[i] = 0;
    if (!land[i] && h + v >= 3) land[i] = 1;
  }
  return land;
}

/** Castle spots (bottom middle, in tiles) for players 1–4, and the Black castle in the middle. */
export const CASTLE_AT: [number, number][] = [[17, 14], [93, 14], [17, 60], [93, 60]];
export const BLACK_AT: [number, number] = [55, 38];
// open ground left free of trees around each castle, so there's room to build
const PLOT_REL: [number, number][] = [[-7, 0], [7, 0], [-7, 4], [-2.5, 4], [2.5, 4], [7, 4], [-4.5, 8], [0, 8], [4.5, 8]];

/** Where a new building goes for a hero standing at (hx, hy): just behind them, so they stand at its door. In tiles. */
export function ghostSpot(kind: BuildKind, hx: number, hy: number) {
  const s = BUILD[kind];
  return { tx: Math.round(hx / TILE - s.w / 2), ty: Math.floor(hy / TILE) - s.h };
}
/** Bottom middle (pixels) of a building whose top-left tile is (tx, ty). */
export const spotPx = (kind: BuildKind, tx: number, ty: number) => ({ x: (tx + BUILD[kind].w / 2) * TILE, y: (ty + BUILD[kind].h) * TILE });
/** Tile codes: 0 open grass, 1 water or off the map, 2 building, 3 tree or gold. */
export function canPlace(kind: BuildKind, tx: number, ty: number, code: (x: number, y: number) => number) {
  const s = BUILD[kind];
  for (let y = ty; y < ty + s.h; y++) for (let x = tx; x < tx + s.w; x++) if (code(x, y) !== 0) return false;
  // keep the door clear: no building right in front
  if (kind !== 'wall') for (let x = tx; x < tx + s.w; x++) if (code(x, ty + s.h) === 2) return false;
  return true;
}

/** Open ground near a castle (bottom middle, in tiles). */
export function plotSpots(cx: number, cy: number): [number, number][] {
  const sx = cx < MW / 2 ? 1 : -1, sy = cy < MH / 2 ? 1 : -1;
  return PLOT_REL.map(([dx, dy]) => [cx + dx * sx, cy + dy * sy + (sy < 0 ? -1 : 0)] as [number, number]);
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const enemies = (a: number, b: number) => a !== WILD && b !== WILD && (a === BLACK) !== (b === BLACK);
/** What a unit costs right now. A fighter takes 1 of whatever you have most of. */
export function unitCost(kind: UnitKind, stock: Record<Res, number>): Cost {
  if (kind !== 'fighter') return UNIT[kind].cost ?? {};
  const best = (['wood', 'meat', 'gold'] as Res[]).reduce((a, r) => (stock[r] > stock[a] ? r : a), 'wood' as Res);
  return { [best]: 1 };
}
const costText = (c: Cost) => (Object.keys(c) as Res[]).map(k => `${c[k]} ${k}`).join(', ');
export { costText };

export interface Snap {
  t: number; // game time
  e: number[][]; // [id, kindIndex(units then buildings), team, x, y, anim, seq, flags, hp%]
  a: number[][]; // arrows [x, y, angle*100]
  k: { s: number; g: number; w: number; m: number; o: Order; h: number; r: number; pop: number; cap: number; out: boolean }[];
  n: number[][]; // node changes [id, amount]
  fx: Fx[];
  snd: SoundEv[];
  wave: number; next: number; bhp: number; state: 'play' | 'won' | 'lost'; msg: string[];
}

export class Game {
  seed: number;
  diff: Difficulty;
  land: Uint8Array;
  blocked: Uint8Array;
  units: Unit[] = [];
  buildings: Building[] = [];
  trees: Tree[] = [];
  golds: Gold[] = [];
  arrows: Arrow[] = [];
  kingdoms: Kingdom[] = [];
  inputs = new Map<number, Input>();
  fx: Fx[] = [];
  sounds: SoundEv[] = [];
  msgs: string[] = [];
  changedNodes = new Set<number>();
  time = 0;
  wave = 0;
  nextWave: number;
  state: 'play' | 'won' | 'lost' = 'play';
  blackCastle = 0;
  private nid = 1;
  private r: () => number;
  private byId = new Map<number, Unit | Building>();
  private sheepT = 0;
  private garrisonT = 0;
  private herdSpots: [number, number][] = [];

  constructor(seed: number, diff: Difficulty) {
    this.seed = seed;
    this.diff = diff;
    this.r = rng(seed);
    this.land = makeLand(seed);
    this.blocked = new Uint8Array(MW * MH);
    this.nextWave = DIFF[diff].grace;
    this.setupBlack();
    this.placeNature();
    this.rebuildBlocked();
  }

  // ---------- setup ----------
  private setupBlack() {
    const [bx, by] = BLACK_AT;
    this.blackCastle = this.addBuilding('castle', BLACK, bx * TILE, by * TILE).id;
    this.addBuilding('tower', BLACK, (bx - 6) * TILE, (by + 1) * TILE);
    this.addBuilding('tower', BLACK, (bx + 6) * TILE, (by + 1) * TILE);
    this.addBuilding('barracks', BLACK, (bx - 4) * TILE, (by - 4) * TILE);
    this.addBuilding('archery', BLACK, (bx + 4) * TILE, (by - 4) * TILE);
    this.addBuilding('house', BLACK, (bx - 3) * TILE, (by + 4) * TILE);
    this.addBuilding('house', BLACK, (bx + 3) * TILE, (by + 4) * TILE);
    for (let i = 0; i < 9; i++) this.spawnBlackGuard(i % 3 === 2 ? 'archer' : 'warrior');
  }

  private spawnBlackGuard(kind: UnitKind) {
    const [bx, by] = BLACK_AT;
    const a = this.r() * Math.PI * 2, d = 120 + this.r() * 170;
    const u = this.addUnit(kind, BLACK, bx * TILE + Math.cos(a) * d * 1.4, by * TILE + 90 + Math.sin(a) * d * 0.6);
    u.garrison = true;
    u.homeX = u.x; u.homeY = u.y;
  }

  /** Trees, gold and sheep, from the seed. Keeps clear of castles and building spots. */
  private placeNature() {
    const keepOut: [number, number, number][] = [];
    const spots = [...CASTLE_AT, BLACK_AT];
    spots.forEach(([x, y], i) => keepOut.push([x, y - 1, i === 4 ? 9 : 5]));
    for (const [cx, cy] of CASTLE_AT) for (const p of plotSpots(cx, cy)) keepOut.push([p[0], p[1] - 1, 2.6]);
    const free = (x: number, y: number) =>
      x > 1 && y > 1 && x < MW - 2 && y < MH - 2 && this.land[y * MW + x] && this.landAround(x, y) &&
      keepOut.every(([kx, ky, kr]) => Math.hypot(x - kx, y - ky) > kr) &&
      !this.trees.some(t => t.tx === x && t.ty === y) && !this.golds.some(g => g.tx === x && g.ty === y);
    const forest = (cx: number, cy: number, n: number) => {
      for (let i = 0, made = 0; i < n * 6 && made < n; i++) {
        const x = Math.round(cx + (this.r() - 0.5) * 9), y = Math.round(cy + (this.r() - 0.5) * 6);
        if (free(x, y)) { this.trees.push({ id: this.nid++, tx: x, ty: y, wood: 12, regrow: 0, variant: Math.floor(this.r() * 4) }); made++; }
      }
    };
    const mine = (cx: number, cy: number, n: number) => {
      for (let i = 0, made = 0; i < n * 8 && made < n; i++) {
        const x = Math.round(cx + (this.r() - 0.5) * 4), y = Math.round(cy + (this.r() - 0.5) * 3);
        if (free(x, y)) { this.golds.push({ id: this.nid++, tx: x, ty: y, gold: 80 }); made++; }
      }
    };
    CASTLE_AT.forEach(([cx, cy], i) => {
      const sx = i % 2 ? -1 : 1, sy = i < 2 ? 1 : -1;
      forest(cx - sx * 6, cy + sy * 13, 14); // a wood past the building spots
      forest(cx + sx * 13, cy - sy * 3, 10);
      mine(cx + sx * 6, cy - sy * 5, 4); // gold just behind the castle, away from the fighting
      mine(cx - sx * 9, cy + sy * 5, 3);
      this.herdSpots.push([cx + sx * 4, cy + sy * 13]);
    });
    // forests and gold out in the open land
    for (let i = 0; i < 26; i++) forest(8 + this.r() * (MW - 16), 6 + this.r() * (MH - 12), 9);
    for (let i = 0; i < 6; i++) mine(10 + this.r() * (MW - 20), 8 + this.r() * (MH - 16), 3);
    mine(BLACK_AT[0] - 11, BLACK_AT[1] - 1, 5);
    mine(BLACK_AT[0] + 11, BLACK_AT[1] - 1, 5);
    this.herdSpots.push([BLACK_AT[0], 9], [BLACK_AT[0], MH - 8], [9, BLACK_AT[1]], [MW - 9, BLACK_AT[1]], [BLACK_AT[0] - 22, 20], [BLACK_AT[0] + 22, MH - 20]);
    for (const [hx, hy] of this.herdSpots) for (let i = 0; i < 4; i++) this.spawnSheep(hx, hy);
  }

  private landAround(x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!this.land[(y + dy) * MW + x + dx]) return false;
    return true;
  }

  private spawnSheep(hx: number, hy: number) {
    for (let i = 0; i < 10; i++) {
      const x = (hx + (this.r() - 0.5) * 5) * TILE, y = (hy + (this.r() - 0.5) * 4) * TILE;
      if (this.walkable(x, y)) {
        const s = this.addUnit('sheep', WILD, x, y);
        s.homeX = hx * TILE; s.homeY = hy * TILE;
        return s;
      }
    }
    return null;
  }


  /** A player's kingdom, made the first time they play (the host at the start, friends when they join). */
  addKingdom(slot: number): Kingdom {
    const old = this.kingdoms.find(k => k.slot === slot);
    if (old) return old;
    const [cx, cy] = CASTLE_AT[slot];
    const castle = this.addBuilding('castle', slot, cx * TILE, cy * TILE);
    const k: Kingdom = {
      slot, stock: { ...START_STOCK }, order: 'follow', heroId: 0, respawn: 0, castleId: castle.id, cx: cx * TILE, cy: cy * TILE,
      out: false,
    };
    this.kingdoms.push(k);
    this.spawnHero(k);
    for (let i = 0; i < 4; i++) this.addUnit('pawn', slot, k.cx - 90 + i * 60, k.cy + 60);
    // clear trees that ended up on the new castle's spot
    this.trees = this.trees.filter(t => !(Math.abs(t.tx - cx) < 4 && t.ty > cy - 4 && t.ty <= cy + 1));
    this.rebuildBlocked();
    return k;
  }

  private spawnHero(k: Kingdom) {
    const h = this.addUnit('hero', k.slot, k.cx, k.cy + 70);
    h.slot = k.slot;
    k.heroId = h.id;
    return h;
  }

  private addUnit(kind: UnitKind, team: number, x: number, y: number): Unit {
    const s = UNIT[kind];
    const mul = team === BLACK ? DIFF[this.diff].hp : 1;
    const u: Unit = {
      id: this.nid++, kind, team, x, y, hp: s.hp * mul, maxHp: s.hp * mul, anim: 'idle', seq: 0, animT: 0, left: x > MW * TILE / 2,
      cd: 0, target: 0, think: this.r() * 0.3, carryN: 0, node: 0, path: [], pathGoal: -1, pathT: 0, stuck: 0,
      homeX: x, homeY: y, wx: x, wy: y, aimY: 0, eatT: 0, hitT: 0, dmgMul: team === BLACK ? DIFF[this.diff].hp : 1,
    };
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  private addBuilding(kind: BuildKind, team: number, x: number, y: number): Building {
    const s = BUILD[kind];
    const b: Building = { id: this.nid++, kind, team, x, y, hp: s.hp, maxHp: s.hp, cd: 0, variant: Math.floor(this.r() * 3) };
    if (team === BLACK) { b.hp *= DIFF[this.diff].hp * (kind === 'castle' ? 3.5 : 1.5); b.maxHp = b.hp; }
    this.buildings.push(b);
    this.byId.set(b.id, b);
    return b;
  }

  get(id: number) { return this.byId.get(id); }

  // ---------- the grid ----------
  rebuildBlocked() {
    const bl = this.blocked;
    for (let i = 0; i < bl.length; i++) bl[i] = this.land[i] ? 0 : 1;
    for (const b of this.buildings) {
      const r = this.rect(b);
      for (let ty = Math.floor(r.y0 / TILE); ty <= Math.floor((r.y1 - 1) / TILE); ty++)
        for (let tx = Math.floor(r.x0 / TILE); tx <= Math.floor((r.x1 - 1) / TILE); tx++)
          if (tx >= 0 && ty >= 0 && tx < MW && ty < MH) bl[ty * MW + tx] = b.kind === 'wall' ? 5 + b.team : 2;
    }
    for (const t of this.trees) if (t.wood > 0) bl[t.ty * MW + t.tx] = 3;
    for (const g of this.golds) if (g.gold > 0) bl[g.ty * MW + g.tx] = 3;
  }

  /** The ground a building covers (its walls), in pixels. */
  rect(b: Building) {
    const s = BUILD[b.kind];
    // building art is taller than its footprint; the footprint is its bottom part
    return { x0: b.x - s.w * TILE / 2 + 8, x1: b.x + s.w * TILE / 2 - 8, y0: b.y - s.h * TILE + 4, y1: b.y - 6 };
  }

  /** Open ground for `team` (walls are open to their own side, like a gate). */
  walkable(x: number, y: number, team = -1) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return false;
    const b = this.blocked[ty * MW + tx];
    return b === 0 || b === 5 + team;
  }
  private open(i: number, team: number) { const b = this.blocked[i]; return b === 0 || b === 5 + team; }

  private clearLine(ax: number, ay: number, bx: number, by: number, team: number) {
    const d = dist(ax, ay, bx, by), n = Math.ceil(d / 20);
    for (let i = 1; i < n; i++) if (!this.walkable(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, team)) return false;
    return true;
  }

  /** A* on the tile grid to a goal tile (or next to it, when it is a tree, gold or building). Returns tile indexes. */
  private findPath(sx: number, sy: number, gx: number, gy: number, team: number): number[] {
    const start = Math.floor(sy / TILE) * MW + Math.floor(sx / TILE);
    const gtx = Math.max(0, Math.min(MW - 1, Math.floor(gx / TILE))), gty = Math.max(0, Math.min(MH - 1, Math.floor(gy / TILE)));
    const goalBlocked = !this.open(gty * MW + gtx, team);
    const done = (i: number) => {
      const x = i % MW, y = (i / MW) | 0;
      return goalBlocked ? Math.abs(x - gtx) <= 1 && Math.abs(y - gty) <= 1 : x === gtx && y === gty;
    };
    const N = MW * MH;
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open: number[] = [start], f = new Float32Array(N);
    g[start] = 0;
    const h = (i: number) => { const dx = Math.abs(i % MW - gtx), dy = Math.abs(((i / MW) | 0) - gty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    f[start] = h(start);
    let best = start, bestH = h(start), steps = 0;
    while (open.length && steps++ < 9000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (done(cur)) { best = cur; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const hc = h(cur);
      if (hc < bestH) { bestH = hc; best = cur; }
      const cx = cur % MW, cy = (cur / MW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        const ni = ny * MW + nx;
        if (!this.open(ni, team) || closed[ni]) continue;
        // no cutting corners past walls
        if (dx && dy && (!this.open(cy * MW + nx, team) || !this.open(ny * MW + cx, team))) continue;
        const ng = g[cur] + (dx && dy ? 1.41 : 1);
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; f[ni] = ng + h(ni); open.push(ni); }
      }
    }
    const path: number[] = [];
    for (let i = best; i !== -1 && i !== start; i = from[i]) path.push(i);
    return path.reverse();
  }

  /** Walk toward a point, around buildings, trees and water. Returns true when there. */
  private moveTo(u: Unit, x: number, y: number, dt: number, near = 8, speedMul = 1): boolean {
    const d = dist(u.x, u.y, x, y);
    if (d <= near) { this.setAnim(u, 'idle'); return true; }
    let wx = x, wy = y;
    if (!this.clearLine(u.x, u.y, x, y, u.team)) {
      const goal = Math.floor(y / TILE) * MW + Math.floor(x / TILE);
      u.pathT -= dt;
      if (goal !== u.pathGoal || u.pathT <= 0 || !u.path.length) {
        u.path = this.findPath(u.x, u.y, x, y, u.team);
        u.pathGoal = goal;
        u.pathT = 1 + this.r();
      }
      // skip ahead to the farthest waypoint we can see
      while (u.path.length > 1) {
        const n = u.path[1];
        if (this.clearLine(u.x, u.y, (n % MW + 0.5) * TILE, (((n / MW) | 0) + 0.5) * TILE, u.team)) u.path.shift(); else break;
      }
      if (u.path.length) {
        const n = u.path[0];
        wx = (n % MW + 0.5) * TILE; wy = (((n / MW) | 0) + 0.5) * TILE;
        if (dist(u.x, u.y, wx, wy) < 10) u.path.shift();
      }
    } else u.path = [];
    const wd = dist(u.x, u.y, wx, wy) || 1;
    const sp = UNIT[u.kind].speed * speedMul * dt;
    this.step(u, (wx - u.x) / wd * Math.min(sp, wd), (wy - u.y) / wd * Math.min(sp, wd));
    if (Math.abs(wx - u.x) > 2) u.left = wx < u.x;
    this.setAnim(u, 'run');
    return false;
  }

  /** Moves by (dx, dy), sliding along walls. */
  private step(u: Unit, dx: number, dy: number) {
    const r = 10;
    const t = u.team, box = (x: number, y: number) => this.walkable(x - r, y, t) && this.walkable(x + r, y, t) && this.walkable(x, y - r / 2, t) && this.walkable(x, y + r / 2, t);
    // already touching a wall (pushed there by a crowd or a new building): only the feet have to be clear
    const ok = box(u.x, u.y) ? box : (x: number, y: number) => this.walkable(x, y, t) || !this.walkable(u.x, u.y, t);
    if (ok(u.x + dx, u.y + dy)) { u.x += dx; u.y += dy; u.stuck = 0; return; }
    if (dx && ok(u.x + dx, u.y)) { u.x += dx; u.stuck = 0; return; }
    if (dy && ok(u.x, u.y + dy)) { u.y += dy; u.stuck = 0; return; }
    u.stuck += 1;
    if (u.stuck === 20) { u.pathT = 0; this.breakWall(u); }
    if (u.stuck > 90 && u.kind !== 'hero') this.unstick(u);
  }

  /** Blocked by an enemy wall: hit it. */
  private breakWall(u: Unit) {
    if (u.kind === 'pawn' || u.kind === 'sheep' || u.kind === 'monk' || u.kind === 'hero') return;
    let best = 0, bd = 150;
    for (const b of this.buildings) {
      if (b.dead || b.kind !== 'wall' || !enemies(u.team, b.team)) continue;
      const d = this.distToRect(u.x, u.y, b);
      if (d < bd) { bd = d; best = b.id; }
    }
    if (best) { u.target = best; u.think = 2; }
  }

  /** Last resort for someone wedged in a corner: hop to the closest open tile. */
  private unstick(u: Unit) {
    const tx = Math.floor(u.x / TILE), ty = Math.floor(u.y / TILE);
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= MW || y >= MH || !this.open(y * MW + x, u.team)) continue;
      u.x = (x + 0.5) * TILE; u.y = (y + 0.5) * TILE; u.stuck = 0; u.path = []; u.pathT = 0;
      return;
    }
  }

  private setAnim(u: Unit, a: Anim, restart = false) {
    if (u.anim !== a || restart) { u.anim = a; u.seq = (u.seq + 1) % 1000; u.animT = 0; }
  }

  // ---------- players' actions ----------
  kingdom(slot: number) { return this.kingdoms.find(k => k.slot === slot); }
  hero(slot: number): Unit | undefined {
    const k = this.kingdom(slot), h = k ? this.get(k.heroId) : undefined;
    return h && 'carryN' in h && h.kind === 'hero' && !h.dead ? h : undefined;
  }
  pop(team: number) { let n = 0; for (const u of this.units) if (u.team === team && !u.dead) n += UNIT[u.kind].pop; return n; }
  cap(team: number) { let n = 0; for (const b of this.buildings) if (b.team === team && !b.dead) n += BUILD[b.kind].pop ?? 0; return Math.min(n, 60); }
  private afford(k: Kingdom, c: Cost) { return (Object.keys(c) as Res[]).every(r => k.stock[r] >= (c[r] ?? 0)); }
  private pay(k: Kingdom, c: Cost) { for (const r of Object.keys(c) as Res[]) k.stock[r] -= c[r] ?? 0; }

  /** What's on a tile, for building (0 open, 1 water, 2 building, 3 tree or gold). */
  tileCode(x: number, y: number) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return 1;
    const b = this.blocked[y * MW + x];
    return b === 0 ? 0 : b === 1 ? 1 : b === 3 ? 3 : 2;
  }

  /** Build anywhere there's room, close to your hero. Returns a message when it can't. */
  build(slot: number, kind: BuildKind, tx: number, ty: number): string | null {
    const k = this.kingdom(slot), h = this.hero(slot);
    if (!k || k.out || !BUILDABLE.includes(kind)) return 'Can’t build now.';
    const { x, y } = spotPx(kind, tx, ty);
    if (!h || dist(h.x, h.y, x, y) > 260) return 'Walk over there first.';
    if (!canPlace(kind, tx, ty, (a, b) => this.tileCode(a, b))) return 'No room there. Find open grass.';
    if (!this.afford(k, BUILD[kind].cost)) return `You need ${costText(BUILD[kind].cost)}.`;
    const b = this.addBuilding(kind, slot, x, y);
    // move anyone standing on it out of the way
    const r = this.rect(b);
    for (const u of this.units) if (u.x > r.x0 - 12 && u.x < r.x1 + 12 && u.y > r.y0 - 12 && u.y < r.y1 + 12) u.y = r.y1 + 26;
    this.pay(k, BUILD[kind].cost);
    this.rebuildBlocked();
    this.fx.push([1, x - 40, y - 20], [1, x + 40, y - 20], [1, x, y - 50]);
    this.sound('build', x, y);
    return null;
  }

  /** Train a unit at one of your buildings. */
  train(slot: number, bid: number, kind: UnitKind): string | null {
    const k = this.kingdom(slot), b = this.get(bid) as Building | undefined, h = this.hero(slot);
    if (!k || !b || !('maxHp' in b) || b.team !== slot || b.dead || !BUILD[b.kind]?.trains.includes(kind)) return 'Can’t train that here.';
    if (!h || dist(h.x, h.y, b.x, b.y) > 260) return 'Walk over to the building first.';
    const cost = unitCost(kind, k.stock);
    if (!this.afford(k, cost)) return kind === 'fighter' ? 'You need 1 wood, meat or gold.' : `You need ${costText(cost)}.`;
    if (this.pop(slot) + UNIT[kind].pop > this.cap(slot)) return 'No room! Build a house for 5 more.';
    this.pay(k, cost);
    const u = this.addUnit(kind, slot, b.x + (this.r() - 0.5) * 80, b.y + 30 + this.r() * 20);
    if (!this.walkable(u.x, u.y)) { u.x = b.x; u.y = b.y + 40; }
    this.fx.push([1, u.x, u.y - 10]);
    this.sound('train', b.x, b.y);
    return null;
  }

  /** Half the price back, rounded down. */
  static refund(c: Cost): Cost {
    const out: Cost = {};
    for (const r of Object.keys(c) as Res[]) { const n = Math.floor((c[r] ?? 0) / 2); if (n) out[r] = n; }
    return out;
  }

  /** Sell one of your buildings (not the castle) for half its price. */
  sell(slot: number, bid: number): string | null {
    const k = this.kingdom(slot), b = this.get(bid) as Building | undefined, h = this.hero(slot);
    if (!k || !b || !('variant' in b) || b.team !== slot || b.dead) return 'Can’t sell that.';
    if (b.kind === 'castle') return 'You can’t sell your castle!';
    if (!h || this.distToRect(h.x, h.y, b) > 220) return 'Walk over to it first.';
    const back = Game.refund(BUILD[b.kind].cost);
    for (const r of Object.keys(back) as Res[]) k.stock[r] += back[r] ?? 0;
    b.dead = true;
    this.fx.push([1, b.x - 30, b.y - 20], [1, b.x + 30, b.y - 30], [1, b.x, b.y - 50]);
    this.sound('coin', b.x, b.y);
    return null;
  }

  /** Sell one unit of a kind that this building trains (the closest one to it) for half its price. */
  sellUnit(slot: number, bid: number, kind: UnitKind): string | null {
    const k = this.kingdom(slot), b = this.get(bid) as Building | undefined, h = this.hero(slot);
    if (!k || !b || !('variant' in b) || b.team !== slot || b.dead || !BUILD[b.kind].trains.includes(kind)) return 'Can’t sell that here.';
    if (!h || dist(h.x, h.y, b.x, b.y) > 260) return 'Walk over to the building first.';
    let best: Unit | null = null, bd = Infinity;
    for (const u of this.units) if (!u.dead && u.team === slot && u.kind === kind) { const d = dist(u.x, u.y, b.x, b.y); if (d < bd) { bd = d; best = u; } }
    if (!best) return `You don’t have any ${UNIT[kind].name.toLowerCase()}s.`;
    const back = Game.refund(UNIT[kind].cost ?? {});
    for (const r of Object.keys(back) as Res[]) k.stock[r] += back[r] ?? 0;
    best.dead = true;
    this.fx.push([1, best.x, best.y - 10]);
    this.sound('coin', best.x, best.y);
    return null;
  }

  /** Eat 5 meat to heal the hero. */
  eat(slot: number): string | null {
    const k = this.kingdom(slot), h = this.hero(slot);
    if (!k || !h) return 'Your hero is knocked out.';
    if (h.hp >= h.maxHp) return 'You’re not hurt.';
    if (k.stock.meat < 5) return 'You need 5 meat to eat.';
    if (h.eatT > 0) return null;
    k.stock.meat -= 5;
    h.hp = Math.min(h.maxHp, h.hp + 80);
    h.eatT = 0.6;
    this.fx.push([2, h.x, h.y]);
    this.sound('eat', h.x, h.y);
    return null;
  }

  setOrder(slot: number, o: Order) {
    const k = this.kingdom(slot);
    if (!k) return;
    k.order = o;
    for (const u of this.units) if (u.team === slot && u.kind !== 'pawn' && u.kind !== 'hero') { u.target = 0; u.path = []; }
  }

  private sound(s: Sound, x: number, y: number) { if (this.sounds.length < 40) this.sounds.push({ s, x, y }); }
  private say(m: string) { this.msgs.push(m); }

  // ---------- the tick ----------
  update(dt: number) {
    if (this.state !== 'play') { for (const u of this.units) { u.animT += dt; } return; }
    this.time += dt;
    for (const k of this.kingdoms) this.kingdomTick(k, dt);
    for (const u of this.units) {
      if (u.dead) continue;
      u.animT += dt;
      u.cd -= dt;
      u.hitT -= dt;
      u.eatT -= dt;
      u.think -= dt;
      switch (u.kind) {
        case 'hero': this.heroTick(u, dt); break;
        case 'pawn': this.pawnTick(u, dt); break;
        case 'sheep': this.sheepTick(u, dt); break;
        case 'monk': this.monkTick(u, dt); break;
        default: this.fighterTick(u, dt);
      }
    }
    this.separate();
    for (const b of this.buildings) if (!b.dead) this.buildingTick(b, dt);
    this.arrowTick(dt);
    this.natureTick(dt);
    this.blackTick(dt);
    // clean up the fallen
    if (this.units.some(u => u.dead)) this.units = this.units.filter(u => { if (u.dead) this.byId.delete(u.id); return !u.dead; });
    if (this.buildings.some(b => b.dead)) {
      this.buildings = this.buildings.filter(b => { if (b.dead) this.byId.delete(b.id); return !b.dead; });
      this.rebuildBlocked();
    }
  }

  private kingdomTick(k: Kingdom, dt: number) {
    const castle = this.get(k.castleId) as Building | undefined;
    if (!castle || castle.dead) {
      if (!k.out) { k.out = true; this.say(`${COLOR_NAMES[k.slot]}’s castle has fallen!`); }
    }
    if (!this.get(k.heroId)) {
      k.respawn -= dt;
      if (k.respawn <= 0 && !k.out) { this.spawnHero(k); }
    }
  }

  private heroTick(u: Unit, dt: number) {
    const inp = this.inputs.get(u.slot!) ?? { mx: 0, my: 0, atk: false, guard: false };
    const busy = (u.anim === 'attack' || u.anim === 'attack2') && u.animT < 0.36;
    const m = Math.hypot(inp.mx, inp.my);
    if (inp.guard && !busy) {
      this.setAnim(u, 'guard');
      if (m > 0.1) u.left = inp.mx < 0;
    } else if (m > 0.1 && !busy) {
      const sp = UNIT.hero.speed * dt * Math.min(1, m);
      this.step(u, inp.mx / m * sp, inp.my / m * sp);
      if (Math.abs(inp.mx) > 0.05) u.left = inp.mx < 0;
      this.setAnim(u, 'run');
    } else if (!busy) this.setAnim(u, 'idle');
    if (inp.atk && u.cd <= 0 && !inp.guard) {
      u.cd = UNIT.hero.cd;
      this.setAnim(u, u.anim === 'attack' ? 'attack2' : 'attack', true);
      this.heroSwing(u);
    }
  }

  private heroSwing(u: Unit) {
    const k = this.kingdom(u.team)!;
    const reach = UNIT.hero.range, fx = u.x + (u.left ? -30 : 30);
    let hit = false;
    for (const v of this.units) {
      // other players' heroes can be hit too (only heroes: armies stay friends)
      const rival = v.kind === 'hero' && v.team !== u.team && v.team !== BLACK;
      if (v.dead || v === u || !(enemies(u.team, v.team) || v.kind === 'sheep' || rival)) continue;
      if (dist(fx, u.y, v.x, v.y) < reach) { this.damage(v, rival ? UNIT.hero.dmg * 0.6 : UNIT.hero.dmg, u); hit = true; }
    }
    for (const b of this.buildings) {
      // other players' buildings can be hit too, at a bit less damage
      const rivalB = b.team !== u.team && b.team < BLACK;
      if (b.dead || !(enemies(u.team, b.team) || rivalB)) continue;
      if (this.distToRect(fx, u.y, b) < reach - 20) { this.damageB(b, rivalB ? UNIT.hero.dmg * 0.6 : UNIT.hero.dmg, u); hit = true; }
    }
    // chop and mine too
    for (const t of this.trees) if (t.wood > 0 && dist(fx, u.y - 10, (t.tx + 0.5) * TILE, (t.ty + 0.6) * TILE) < reach) {
      const n = Math.min(2, t.wood); t.wood -= n; k.stock.wood += n; hit = true; this.sound('chop', u.x, u.y); this.changedNodes.add(t.id); this.fx.push([5, t.tx, t.ty]);
      if (t.wood <= 0) { t.regrow = 90; this.rebuildBlocked(); }
      break;
    }
    for (const g of this.golds) if (g.gold > 0 && dist(fx, u.y - 10, (g.tx + 0.5) * TILE, (g.ty + 0.5) * TILE) < reach) {
      const n = Math.min(2, g.gold); g.gold -= n; k.stock.gold += n; hit = true; this.sound('mine', u.x, u.y); this.changedNodes.add(g.id); this.fx.push([6, g.tx, g.ty]);
      if (g.gold <= 0) { this.fx.push([1, (g.tx + 0.5) * TILE, (g.ty + 0.6) * TILE]); this.rebuildBlocked(); }
      break;
    }
    this.sound(hit ? 'hit' : 'swing', u.x, u.y);
  }

  private pawnTick(u: Unit, dt: number) {
    const k = this.kingdom(u.team);
    const castle = k && this.get(k.castleId) as Building | undefined;
    if (!k || !castle || castle.dead) { this.setAnim(u, 'idle'); return; }
    const working = (u.anim === 'chop' || u.anim === 'mine' || u.anim === 'stab');
    // hurt: run home for a bit
    if (u.hitT > 0) {
      const r = this.rect(castle);
      this.moveTo(u, Math.max(r.x0, Math.min(r.x1, u.x)), r.y1 + 30, dt, 20, 1.2);
      return;
    }
    // carrying a full load: take it home
    if (u.carry && (u.carryN >= CARRY[u.carry] || (!this.nodeAlive(u) && u.carry !== 'meat'))) {
      const r = this.rect(castle);
      const tx = Math.max(r.x0, Math.min(r.x1, u.x)), ty = r.y1 + 18;
      if (this.moveTo(u, tx, ty, dt, 20)) {
        k.stock[u.carry] += u.carryN;
        this.sound('coin', u.x, u.y);
        u.carry = undefined; u.carryN = 0;
      }
      return;
    }
    if (!u.job) u.job = this.pickJob(u.team);
    if (!this.nodeAlive(u) || u.think <= 0 && !working && !u.node) {
      u.node = this.findNode(u, u.job);
      u.think = 2;
      if (!u.node) { u.job = (['wood', 'gold', 'meat'] as Res[])[Math.floor(this.r() * 3)]; this.setAnim(u, 'idle'); return; }
    }
    const node = u.node;
    if (u.job === 'meat') {
      const s = this.get(node) as Unit | undefined;
      if (!s || s.dead) { u.node = 0; return; }
      if (dist(u.x, u.y, s.x, s.y) > 40) { this.moveTo(u, s.x, s.y, dt, 30); return; }
      u.left = s.x < u.x;
      if (u.cd <= 0) {
        u.cd = 0.9;
        this.setAnim(u, 'stab', true);
        this.damage(s, 8, u);
        if (s.dead) { u.carry = 'meat'; u.carryN = CARRY.meat; u.node = 0; }
      }
      return;
    }
    const isTree = u.job === 'wood';
    const n = isTree ? this.trees.find(t => t.id === node) : this.golds.find(g => g.id === node);
    if (!n) { u.node = 0; return; }
    const nx = (n.tx + 0.5) * TILE, ny = (n.ty + 0.5) * TILE;
    // stand on the near side
    const side = u.x < nx ? -1 : 1;
    const sx = nx + side * 48, sy = ny + 14;
    if (dist(u.x, u.y, nx, ny) > 64) {
      const tx = this.walkable(sx, sy, u.team) ? sx : nx, ty = this.walkable(sx, sy, u.team) ? sy : ny;
      this.moveTo(u, tx, ty, dt, 10);
      if (u.stuck > 60) { u.stuck = 0; u.node = 0; }
      return;
    }
    u.left = nx < u.x;
    this.setAnim(u, isTree ? 'chop' : 'mine');
    if (u.cd <= 0) {
      u.cd = 0.75;
      const amt = isTree ? (n as Tree).wood : (n as Gold).gold;
      if (amt <= 0) { u.node = 0; return; }
      if (isTree) { (n as Tree).wood--; if ((n as Tree).wood <= 0) { (n as Tree).regrow = 90; this.rebuildBlocked(); } }
      else { (n as Gold).gold--; if ((n as Gold).gold <= 0) { this.fx.push([1, nx, ny]); this.rebuildBlocked(); } }
      this.changedNodes.add(n.id);
      this.fx.push([isTree ? 5 : 6, n.tx, n.ty]);
      u.carry = u.job; u.carryN++;
      if (dist(u.x, u.y, this.cameraHint.x, this.cameraHint.y) < 700) this.sound(isTree ? 'chop' : 'mine', u.x, u.y);
    }
  }
  /** Where the host is looking, so far-off pawns don't make noise. */
  cameraHint = { x: 0, y: 0 };

  private nodeAlive(u: Unit) {
    if (!u.node) return false;
    if (u.job === 'wood') return this.trees.some(t => t.id === u.node && t.wood > 0);
    if (u.job === 'gold') return this.golds.some(g => g.id === u.node && g.gold > 0);
    const s = this.get(u.node) as Unit | undefined;
    return !!s && !s.dead;
  }

  private pickJob(team: number): Res {
    const n = { wood: 0, gold: 0, meat: 0 };
    for (const u of this.units) if (u.team === team && u.kind === 'pawn' && u.job) n[u.job]++;
    // aim for 3 wood : 2 gold : 2 meat
    const score = (r: Res) => n[r] / (r === 'wood' ? 3 : 2) + (r === 'wood' ? 0 : 0.01);
    return (['wood', 'gold', 'meat'] as Res[]).sort((a, b) => score(a) - score(b))[0];
  }

  private findNode(u: Unit, job: Res): number {
    let best = 0, bd = 2200;
    if (job === 'meat') {
      for (const s of this.units) if (s.kind === 'sheep' && !s.dead) { const d = dist(u.x, u.y, s.x, s.y); if (d < bd) { bd = d; best = s.id; } }
      return best;
    }
    // spread out: don't all pick the same tree
    const taken = new Map<number, number>();
    for (const o of this.units) if (o.kind === 'pawn' && o.node) taken.set(o.node, (taken.get(o.node) ?? 0) + 1);
    const list = job === 'wood' ? this.trees.filter(t => t.wood > 0) : this.golds.filter(g => g.gold > 0);
    for (const n of list) {
      const d = dist(u.x, u.y, (n.tx + 0.5) * TILE, (n.ty + 0.5) * TILE) + (taken.get(n.id) ?? 0) * 260;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  private sheepTick(u: Unit, dt: number) {
    if (u.hitT > 0) {
      // run from whoever hit it
      const a = Math.atan2(u.y - u.homeY, u.x - u.homeX) + (this.r() - 0.5);
      this.step(u, Math.cos(a) * 90 * dt, Math.sin(a) * 90 * dt);
      this.setAnim(u, 'run');
      return;
    }
    if (u.think <= 0) {
      u.think = 2 + this.r() * 4;
      if (this.r() < 0.4) this.setAnim(u, this.r() < 0.5 ? 'graze' : 'idle');
      else {
        u.wx = u.homeX + (this.r() - 0.5) * 320;
        u.wy = u.homeY + (this.r() - 0.5) * 240;
        u.stuck = 0;
        this.setAnim(u, 'run');
      }
    }
    if (u.anim === 'run' && (!this.walkable(u.wx, u.wy) || this.moveTo(u, u.wx, u.wy, dt, 8, 0.6) || u.stuck > 30)) {
      u.stuck = 0;
      this.setAnim(u, 'idle');
    }
  }

  private monkTick(u: Unit, dt: number) {
    const s = UNIT.monk;
    if (u.anim === 'heal' && u.animT < 1.1) return;
    // heal the most hurt friend in range
    let best: Unit | null = null, bestLack = 15;
    for (const v of this.units) {
      if (v.dead || v.kind === 'sheep' || enemies(u.team, v.team) || v.team === WILD) continue;
      if ((u.team === BLACK) !== (v.team === BLACK)) continue;
      const lack = v.maxHp - v.hp;
      if (lack > bestLack && dist(u.x, u.y, v.x, v.y) < s.range) { best = v; bestLack = lack; }
    }
    if (best && u.cd <= 0) {
      u.cd = s.cd;
      u.left = best.x < u.x;
      this.setAnim(u, 'heal', true);
      best.hp = Math.min(best.maxHp, best.hp + 22);
      this.fx.push([2, best.x, best.y]);
      this.sound('heal', u.x, u.y);
      return;
    }
    this.armyMove(u, dt, true);
  }

  private fighterTick(u: Unit, dt: number) {
    const s = UNIT[u.kind];
    // finish the swing that's going
    const swingLen = u.kind === 'archer' ? 0.7 : u.kind === 'lancer' ? 0.35 : 0.4;
    if ((u.anim === 'attack' || u.anim === 'shoot') && u.animT < swingLen) return;
    if (u.think <= 0) { u.think = 0.3 + this.r() * 0.2; u.target = this.findTarget(u); }
    const t = u.target ? this.get(u.target) : undefined;
    if (t && !t.dead) {
      const isB = 'variant' in t;
      const d = isB ? this.distToRect(u.x, u.y, t as Building) : dist(u.x, u.y, t.x, t.y);
      if (d <= s.range) {
        u.left = t.x < u.x;
        if (u.cd <= 0) {
          u.cd = s.cd;
          if (u.kind === 'archer') {
            this.setAnim(u, 'shoot', true);
            this.shoot(u.x + (u.left ? -20 : 20), u.y - 40, t, s.dmg * u.dmgMul, u.team);
          } else {
            this.setAnim(u, 'attack', true);
            if (isB) this.damageB(t as Building, s.dmg * u.dmgMul, u); else this.damage(t as Unit, s.dmg * u.dmgMul, u);
            this.sound('hit', u.x, u.y);
          }
          u.aimY = t.y - u.y;
        } else if (u.anim !== 'attack' && u.anim !== 'shoot') this.setAnim(u, 'idle');
        return;
      }
      const ty = isB ? Math.max(this.rect(t as Building).y0, Math.min(this.rect(t as Building).y1 + 20, u.y)) : t.y;
      const tx = isB ? Math.max(this.rect(t as Building).x0, Math.min(this.rect(t as Building).x1, u.x)) : t.x;
      this.moveTo(u, tx, ty, dt, s.range * 0.8);
      return;
    }
    u.target = 0;
    this.armyMove(u, dt, false);
  }

  /** Where an army unit goes when it isn't fighting: by its kingdom's order, or the Black kingdom's plan. */
  private armyMove(u: Unit, dt: number, monk: boolean) {
    if (u.team === BLACK) {
      if (u.garrison) { this.moveTo(u, u.homeX, u.homeY, dt, 30); return; }
      const goal = this.nearestPlayerBuilding(u.x, u.y);
      if (goal) { const r = this.rect(goal); this.moveTo(u, (r.x0 + r.x1) / 2, r.y1 + 30, dt, 60); }
      else this.setAnim(u, 'idle');
      return;
    }
    const k = this.kingdom(u.team);
    if (!k) return;
    const idx = u.id % 12;
    if (k.order === 'follow') {
      const h = this.get(k.heroId) as Unit | undefined;
      const ax = h ? h.x : k.cx, ay = h ? h.y : k.cy + 120;
      // a loose ring behind the hero
      const ang = idx / 12 * Math.PI * 2, rr = monk ? 70 : 90 + (idx % 3) * 30;
      this.moveTo(u, ax + Math.cos(ang) * rr, ay + Math.sin(ang) * rr * 0.6, dt, 40, h && dist(u.x, u.y, h.x, h.y) > 400 ? 1.3 : 1);
    } else if (k.order === 'defend') {
      const ang = idx / 12 * Math.PI, rr = 200 + (idx % 2) * 50;
      const sx = k.cx < MW * TILE / 2 ? 1 : -1, sy = k.cy < MH * TILE / 2 ? 1 : -1;
      this.moveTo(u, k.cx + sx * Math.cos(ang) * rr * 0.9 + sx * 80, k.cy + sy * (Math.sin(ang) * rr * 0.6 + 120), dt, 30);
    } else {
      const bc = this.get(this.blackCastle) as Building | undefined;
      const goal = bc && !bc.dead ? bc : this.buildings.find(b => b.team === BLACK && !b.dead);
      if (goal) {
        const r = this.rect(goal);
        const gx = (r.x0 + r.x1) / 2 + ((idx % 5) - 2) * 50, gy = (u.y < goal.y ? r.y0 - 30 : r.y1 + 40);
        this.moveTo(u, gx, gy, dt, 40);
      } else this.setAnim(u, 'idle');
    }
  }

  private findTarget(u: Unit): number {
    const s = UNIT[u.kind];
    let aggro = s.aggro, ax = u.x, ay = u.y;
    if (u.team === BLACK && u.garrison) { ax = u.homeX; ay = u.homeY; aggro = 520; }
    else if (u.team !== BLACK) {
      const k = this.kingdom(u.team);
      if (k?.order === 'defend') { ax = k.cx; ay = k.cy; aggro = 560; }
      if (k?.order === 'follow') { const h = this.get(k.heroId) as Unit | undefined; if (h && dist(u.x, u.y, h.x, h.y) > 480) return 0; }
    }
    let best = 0, bd = Infinity;
    for (const v of this.units) {
      if (v.dead || !enemies(u.team, v.team)) continue;
      const da = dist(ax, ay, v.x, v.y);
      if (da > aggro && dist(u.x, u.y, v.x, v.y) > s.aggro) continue;
      const d = dist(u.x, u.y, v.x, v.y);
      if (d < bd) { bd = d; best = v.id; }
    }
    if (best) return best;
    // no one to fight: knock down buildings close by (Black soldiers on the march, players attacking)
    const k = u.team !== BLACK ? this.kingdom(u.team) : undefined;
    if (u.garrison || k?.order === 'defend' || k?.order === 'follow') return 0;
    for (const b of this.buildings) {
      if (b.dead || !enemies(u.team, b.team)) continue;
      const d = this.distToRect(u.x, u.y, b);
      if (b.kind === 'wall' && d > 40) continue; // walls only when they're in the way
      if (d < Math.max(s.aggro, 260) && d < bd) { bd = d; best = b.id; }
    }
    return best;
  }

  private nearestPlayerBuilding(x: number, y: number): Building | undefined {
    let best: Building | undefined, bd = Infinity;
    for (const b of this.buildings) {
      if (b.dead || b.team === BLACK || b.kind === 'wall') continue;
      const d = dist(x, y, b.x, b.y) - (b.kind === 'castle' ? 300 : 0);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  distToRect(x: number, y: number, b: Building) {
    const r = this.rect(b);
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
    return Math.hypot(dx, dy);
  }

  private damage(v: Unit, n: number, by?: Unit) {
    if (v.dead) return;
    if (v.kind === 'hero' && v.anim === 'guard') n *= 0.25;
    v.hp -= n;
    v.hitT = v.kind === 'sheep' ? 1.2 : v.kind === 'pawn' ? 3 : 0.15;
    if (v.kind === 'sheep' && by) { v.homeX = by.x; v.homeY = by.y; if (this.r() < 0.3) this.sound('baa', v.x, v.y); }
    if (v.kind === 'hero') this.sound('hurt', v.x, v.y);
    if (v.hp <= 0) {
      v.dead = true;
      this.fx.push([1, v.x, v.y - 10]);
      if (v.kind === 'sheep' && by?.kind === 'hero') { const k = this.kingdom(by.team); if (k) k.stock.meat += 6; }
      if (v.kind === 'hero') {
        const k = this.kingdom(v.team);
        if (k) { k.respawn = 8; this.say(`${COLOR_NAMES[v.team]} hero was knocked out! Back in 8 seconds.`); }
      }
    } else if (by && v.kind !== 'hero' && v.kind !== 'pawn' && v.kind !== 'sheep' && !v.target) v.target = by.id;
  }

  private damageB(b: Building, n: number, _by?: Unit) {
    if (b.dead) return;
    b.hp -= n;
    if (b.hp <= 0) {
      b.dead = true;
      if (b.kind === 'wall') { this.fx.push([1, b.x, b.y - 30]); this.sound('hit', b.x, b.y); }
      else { this.fx.push([4, b.x, b.y - 60], [0, b.x - 50, b.y - 30], [0, b.x + 50, b.y - 40]); this.sound('boom', b.x, b.y); }
      if (b.id === this.blackCastle) { this.state = 'won'; this.sound('win', b.x, b.y); this.say('The Black castle has fallen. You win!'); }
      else if (b.team === BLACK && b.kind !== 'wall') this.say(`The Black ${BUILD[b.kind].name.toLowerCase()} is down!`);
      else if (b.kind !== 'castle' && b.kind !== 'wall') this.say(`${COLOR_NAMES[b.team]} lost a ${BUILD[b.kind].name.toLowerCase()}.`);
    }
  }

  private shoot(x: number, y: number, t: Unit | Building, dmg: number, team: number) {
    const tx = t.x, ty = t.y - ('variant' in t ? 60 : 30);
    this.arrows.push({ x, y, tx, ty, target: t.id, dmg, team, speed: 640, ang: Math.atan2(ty - y, tx - x) });
    this.sound('bow', x, y);
  }

  private arrowTick(dt: number) {
    for (const a of this.arrows) {
      const t = this.get(a.target);
      if (t && !t.dead) { a.tx = t.x; a.ty = t.y - ('variant' in t ? 60 : 30); }
      const d = dist(a.x, a.y, a.tx, a.ty), sp = a.speed * dt;
      a.ang = Math.atan2(a.ty - a.y, a.tx - a.x);
      if (d <= sp) {
        a.speed = 0;
        if (t && !t.dead) { if ('variant' in t) this.damageB(t as Building, a.dmg); else this.damage(t as Unit, a.dmg); }
      } else { a.x += (a.tx - a.x) / d * sp; a.y += (a.ty - a.y) / d * sp; }
    }
    this.arrows = this.arrows.filter(a => a.speed > 0);
  }

  private buildingTick(b: Building, dt: number) {
    if (b.kind !== 'tower' && b.kind !== 'tower2' && b.kind !== 'castle') return;
    b.cd -= dt;
    if (b.cd > 0) return;
    const range = b.kind === 'tower2' ? 480 : b.kind === 'tower' ? 420 : 400;
    // the two nearest enemies (a double tower shoots both)
    let best: Unit | null = null, second: Unit | null = null, bd = range, sd = range;
    for (const v of this.units) {
      if (v.dead || !enemies(b.team, v.team)) continue;
      const d = dist(b.x, b.y - 40, v.x, v.y);
      if (d < bd) { second = best; sd = bd; bd = d; best = v; } else if (d < sd) { sd = d; second = v; }
    }
    if (!best) return;
    const mul = b.team === BLACK ? DIFF[this.diff].hp : 1;
    if (b.kind === 'tower2') {
      b.cd = 0.8;
      this.shoot(b.x - 56, b.y - 170, best, 15 * mul, b.team);
      this.shoot(b.x + 56, b.y - 170, second ?? best, 15 * mul, b.team);
      return;
    }
    b.cd = b.kind === 'tower' ? 0.9 : b.team === BLACK ? 0.7 : 1.1;
    this.shoot(b.x, b.y - (b.kind === 'tower' ? 170 : 120), best, (b.kind === 'tower' ? 14 : 12) * mul, b.team);
  }

  /** Units push apart a little so they don't stack on one spot. */
  private separate() {
    const cell = new Map<number, Unit[]>();
    for (const u of this.units) {
      if (u.dead) continue;
      const key = Math.floor(u.x / 48) * 1000 + Math.floor(u.y / 48);
      let a = cell.get(key); if (!a) cell.set(key, a = []); a.push(u);
    }
    for (const u of this.units) {
      if (u.dead) continue;
      const cx = Math.floor(u.x / 48), cy = Math.floor(u.y / 48);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const list = cell.get((cx + dx) * 1000 + cy + dy);
        if (!list) continue;
        for (const v of list) {
          if (v.id <= u.id) continue;
          const min = UNIT[u.kind].r + UNIT[v.kind].r;
          const d = dist(u.x, u.y, v.x, v.y);
          if (d < min && d > 0.01) {
            const push = (min - d) * 0.25, nx = (u.x - v.x) / d, ny = (u.y - v.y) / d;
            if (u.kind !== 'hero' && this.walkable(u.x + nx * push, u.y + ny * push, u.team)) { u.x += nx * push; u.y += ny * push; }
            if (v.kind !== 'hero' && this.walkable(v.x - nx * push, v.y - ny * push, v.team)) { v.x -= nx * push; v.y -= ny * push; }
          } else if (d <= 0.01) u.x += 1;
        }
      }
    }
  }

  private natureTick(dt: number) {
    for (const t of this.trees) if (t.wood <= 0) {
      t.regrow -= dt;
      if (t.regrow <= 0) {
        // only grow back where nobody is standing
        const cx = (t.tx + 0.5) * TILE, cy = (t.ty + 0.5) * TILE;
        if (this.units.some(u => dist(u.x, u.y, cx, cy) < 50)) { t.regrow = 3; continue; }
        t.wood = 12; this.changedNodes.add(t.id); this.rebuildBlocked();
      }
    }
    this.sheepT -= dt;
    if (this.sheepT <= 0) {
      this.sheepT = 12;
      const n = this.units.filter(u => u.kind === 'sheep').length;
      if (n < this.herdSpots.length * 4) { const [hx, hy] = this.herdSpots[Math.floor(this.r() * this.herdSpots.length)]; this.spawnSheep(hx, hy); }
    }
  }

  /** The Black kingdom: keeps its guards up and sends bigger and bigger attacks. */
  private blackTick(dt: number) {
    const bc = this.get(this.blackCastle) as Building | undefined;
    if (!bc || bc.dead) return;
    const players = Math.max(1, this.kingdoms.filter(k => !k.out).length);
    this.garrisonT -= dt;
    if (this.garrisonT <= 0) {
      this.garrisonT = 18;
      const guards = this.units.filter(u => u.team === BLACK && u.garrison).length;
      if (guards < 9 + Math.min(16, Math.floor(this.wave * 1.5))) this.spawnBlackGuard(this.r() < 0.35 ? 'archer' : this.wave > 4 && this.r() < 0.3 ? 'lancer' : 'warrior');
    }
    this.nextWave -= dt;
    if (this.nextWave <= 0) {
      this.wave++;
      const d = DIFF[this.diff];
      this.nextWave = d.gap;
      const n = Math.max(2, Math.round((1 + this.wave * 1.25) * d.mult * (1 + 0.55 * (players - 1))));
      const w = this.wave;
      for (let i = 0; i < n; i++) {
        const roll = this.r();
        const kind: UnitKind = w >= 6 && roll < 0.1 ? 'monk' : w >= 4 && roll < 0.3 ? 'lancer' : w >= 2 && roll < 0.6 ? 'archer' : 'warrior';
        const u = this.addUnit(kind, BLACK, bc.x + (this.r() - 0.5) * 260, bc.y + 50 + this.r() * 60);
        if (!this.walkable(u.x, u.y)) { u.x = bc.x; u.y = bc.y + 60; }
      }
      this.say(`Wave ${w}: ${n} Black soldiers are coming!`);
      this.sound('horn', bc.x, bc.y);
    }
    if (this.kingdoms.length && this.kingdoms.every(k => k.out)) { this.state = 'lost'; this.sound('lose', bc.x, bc.y); this.say('All the castles have fallen…'); }
  }

  // ---------- snapshots for friends (and for drawing) ----------
  snap(): Snap {
    const e: number[][] = [];
    for (const u of this.units) {
      const flags = (u.left ? 1 : 0) | (u.carry ? (['wood', 'gold', 'meat'].indexOf(u.carry) + 1) << 1 : 0) | (u.hitT > 0 ? 8 : 0) | (u.garrison ? 16 : 0);
      e.push([u.id, UNIT_KINDS.indexOf(u.kind), u.team, Math.round(u.x), Math.round(u.y), ANIMS.indexOf(u.anim), u.seq, flags, Math.ceil(u.hp / u.maxHp * 100), Math.round(u.aimY)]);
    }
    for (const b of this.buildings) e.push([b.id, 100 + BUILD_KINDS.indexOf(b.kind), b.team, Math.round(b.x), Math.round(b.y), 0, b.variant, 0, Math.ceil(b.hp / b.maxHp * 100), 0]);
    const n: number[][] = [];
    for (const id of this.changedNodes) {
      const t = this.trees.find(x => x.id === id); if (t) { n.push([id, t.wood]); continue; }
      const g = this.golds.find(x => x.id === id); if (g) n.push([id, g.gold]);
    }
    this.changedNodes.clear();
    const bc = this.get(this.blackCastle) as Building | undefined;
    const s: Snap = {
      t: this.time,
      e,
      a: this.arrows.map(a => [Math.round(a.x), Math.round(a.y), Math.round(a.ang * 100)]),
      k: this.kingdoms.map(k => ({ s: k.slot, g: Math.floor(k.stock.gold), w: Math.floor(k.stock.wood), m: Math.floor(k.stock.meat), o: k.order, h: k.heroId, r: Math.ceil(k.respawn), pop: this.pop(k.slot), cap: this.cap(k.slot), out: k.out })),
      n,
      fx: this.fx.splice(0),
      snd: this.sounds.splice(0),
      wave: this.wave, next: Math.ceil(this.nextWave), bhp: bc && !bc.dead ? Math.ceil(bc.hp / bc.maxHp * 100) : 0,
      state: this.state, msg: this.msgs.splice(0),
    };
    return s;
  }

  /** Every tree and gold stone (sent once to friends when they join). */
  nodes() {
    return {
      trees: this.trees.map(t => [t.id, t.tx, t.ty, t.variant, t.wood]),
      golds: this.golds.map(g => [g.id, g.tx, g.ty, g.gold]),
    };
  }
}
