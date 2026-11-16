// Survivle's game state and rules: the hero, cliffs and climbing, swords and bows, enemies, chests,
// campfires, traders and the Dark Beast. No drawing here.
import {
  ACORN_HEAL, BOSS_HP, CAMPFIRE_WOOD, CHALLENGES, CROP_TIME, ENEMY_KINDS, FOOD_HEAL, MAX_BOW, MAX_HP, MAX_HP_CAP, MAX_SWORD,
  GOODS, type GoodId, MAX_UPGRADE, TIME_LIMIT, bowName, jobById, rollEnemyKind, swordName,
} from './data';
import { sfx } from './audio';
import { MINI_KINDS, Minis } from './minis';

const MINI_NAMES = MINI_KINDS.map((k) => k.name);
import {
  BOARD, STORE, CX, CY, FLOOR_H, WARPS, lairPad, G, OVEN, ROOM_R, SIZE, START_X, START_Y, T, VILLAGES, World,
  CASTLE_R, isDoor as isDoorTile, blocksMove, castleR, hash, inRoom, tG, tH, tT, villageAt,
} from './world';

export const GRAVITY = 32;
const JUMP_V = Math.sqrt(2 * GRAVITY * 2.4); // clears a 2-level step
const WALK = 4.6;
const CLIMB_SPEED = 1.6; // levels per second
const CLIMB_DRAIN = 0.12; // 12% of the stamina ring per second
const SAFE_FALL = 4; // levels you can drop without getting hurt
const AGGRO = 30; // tiles
const MAX_CHESTS = 25;
/** Most things one sword swing can hit. */
const SWING_MAX = 10;
const ROCKS = 10;
export const WALL_WOOD = 5;
/** 12 hearts, in quarters. */
export const WALL_HP = 48;

export interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Aim direction in world units (set from the mouse). */
  aimX: number;
  aimY: number;
}

export interface Player {
  name: string;
  outfit: string;
  x: number;
  y: number;
  z: number;
  vz: number;
  fallTop: number;
  onGround: boolean;
  climbing: boolean;
  climbDX: number;
  climbDY: number;
  pushT: number;
  face: number; // angle in world space
  moving: boolean;
  walkT: number;
  hp: number; // quarter hearts
  stamina: number; // 0..1
  staminaWait: number;
  swingT: number;
  swingCd: number;
  bowCd: number;
  hurtT: number;
  inWater: boolean;
}

export interface Enemy {
  id: number;
  kind: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  aggro: boolean;
  atkCd: number;
  hurtT: number;
  kx: number;
  ky: number;
  wanderA: number;
  wanderT: number;
  hop: number;
  /** Part of a challenge-rock fight. */
  ch?: boolean;
  /** Called in by a mini boss. */
  minion?: boolean;
  /** Seconds left frozen by an ice arrow. */
  frozen?: number;
  /** Where a friend's game last saw it (co-op guests smooth toward this). */
  tx?: number;
  ty?: number;
}

export interface Arrow {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  life: number;
  dmg: number;
  fromBoss?: boolean;
  owner?: string;
  /** An ice arrow: freezes a Murk for 10 seconds but does a tenth of the damage. */
  ice?: boolean;
}

export interface Chest {
  x: number;
  y: number;
}

export interface Fire {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
  text?: string;
  /** Gas that floats up and spreads instead of falling. */
  gas?: boolean;
}

export interface Boss {
  x: number;
  y: number;
  hp: number;
  active: boolean;
  state: 'idle' | 'wind' | 'heavy' | 'recover' | 'nova' | 'dash';
  t: number;
  next: number;
  hurtT: number;
  rings: { x: number; y: number; r: number; t: number; max: number; heavy: boolean }[];
  orbs: { x: number; y: number; dx: number; dy: number; life: number }[];
  dead: boolean;
  deadT: number;
  /** While split, two copies fight next to it (all three share one health bar). */
  clones: Clone[];
  /** Seconds left split into three. */
  split: number;
  splits: number;
  /** A charge straight across the room: a warning line first, then a rush. */
  dash: { fx: number; fy: number; tx: number; ty: number; t: number; warn: number; hit: string[] } | null;
}

export interface Clone {
  x: number;
  y: number;
  cd: number;
  hurtT: number;
  wind: number;
}

export interface SaveData {
  v: 1;
  id: string;
  name: string;
  outfit: string;
  owned: string[];
  seed: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  elapsed: number;
  swords: number[];
  bows: number[];
  sword: number;
  bow: number;
  arrows: number;
  wood: number;
  coins: number;
  apples: number;
  chopped: number[];
  fires: Fire[];
  spawn: { x: number; y: number };
  chests: Chest[];
  won: boolean;
  savedAt: number;
  acorns?: number;
  maxHp?: number;
  stones?: string[];
  job?: string | null;
  jobVillage?: number;
  farm?: [number, number][];
  letterTo?: number | null;
  minis?: number[];
  goods?: Record<string, number>;
  shelves?: Record<string, number>;
  rocks?: { x: number; y: number }[];
  rockLevel?: number;
  walls?: Wall[];
  iceArrows?: number;
}

/** A wooden wall someone built. Its builder can walk through it; nobody else can. */
export interface Wall {
  id: number;
  x: number;
  y: number;
  owner: string;
  hp: number;
  hurtT: number;
}

/** A villager shopping at your grocery store. */
export interface Shopper {
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: 'in' | 'shop' | 'out';
  t: number;
  look: number;
  got: GoodId | null;
}

/** Another hero in a co-op game. */
export interface Other {
  id: string;
  name: string;
  outfit: string;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  face: number;
  walkT: number;
  moving: boolean;
  swingT: number;
  climbing: boolean;
  hp: number;
  maxHp: number;
  ko: boolean;
  swordD: number;
}

export interface Target {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** What the co-op link does for the game. */
export interface NetHooks {
  hurtRemote(id: string, q: number, fx?: number, fy?: number): void;
  hitEnemy(id: number, dmg: number, nx: number, ny: number): void;
  hitBoss(dmg: number): void;
  hitMini(kind: number, dmg: number): void;
  shoot(a: Arrow): void;
  chop(key: number): void;
  chest(x: number, y: number): void;
  stone(x: number, y: number): void;
  reward(owner: string, coins: number, arrows: number): void;
  bonus(kind: 'mini' | 'challenge', value: string): void;
  build(x: number, y: number): void;
  /** Hit another player (multiplayer is for fighting each other). */
  pvp(target: string): void;
  hitWall(id: number, q: number): void;
}

export interface Work {
  label: string;
  t: number;
  max: number;
  x: number;
  y: number;
  done: () => void;
}

const ang = (dx: number, dy: number) => Math.atan2(dy, dx);
function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** A village to carry a letter to: any one but this. */
function otherVillage(vi: number) {
  const n = VILLAGES.length;
  return (vi + 1 + Math.floor(Math.random() * (n - 1))) % n;
}

export class Game {
  id: string;
  world: World;
  p: Player;
  owned: string[] = ['forest'];
  swords: number[] = [1];
  bows: number[] = [2];
  sword = 0;
  bow = 0;
  arrows = 20;
  iceArrows = 0;
  /** Shoot ice arrows instead of normal ones (Q switches). */
  useIce = false;
  wood = 0;
  coins = 0;
  apples = 0;
  acorns = 0;
  maxHp = MAX_HP;
  elapsed = 0;
  /** The trader who follows you around. */
  trader = { x: START_X + 3, y: START_Y - 2, z: 0, walkT: 0, face: 0 };
  stonesDone = new Set<string>();
  challenge: { key: string; x: number; y: number; name: string } | null = null;
  job: string | null = null;
  jobVillage = 0;
  /** Planted farm tiles: tile key -> play time when planted. */
  farm = new Map<number, number>();
  letterTo: number | null = null;
  /** Grocery store: what you are carrying to sell, and what is on the shelves. */
  goods: Record<GoodId, number> = { veg: 0, ore: 0, wood: 0, meat: 0 };
  shelves: Record<GoodId, number> = { veg: 0, ore: 0, wood: 0, meat: 0 };
  shoppers: Shopper[] = [];
  private shopperCd = 3;
  work: Work | null = null;
  onJobs: ((village: number) => void) | null = null;
  /** Narrator: say a line (key keeps it from repeating too often). */
  onSay: ((key: string, text: string, cooldown?: number) => void) | null = null;
  private seen = new Set<string>();
  /** The glowing rocks out in the world right now (one starts right by the camp). */
  rocks: { x: number; y: number }[] = [{ x: 4993, y: 5594 }];
  /** How many challenges have been won: each new one is a little harder. */
  rockLevel = 0;
  private rockCd = 0;
  walls: Wall[] = [];
  /** Who walls count as "mine" for: 'me' here, or a friend's id when you joined their game. */
  myId = 'me';
  private lastLand = { x: START_X, y: START_Y };
  private lastHour = -1;
  private wasVillage = -1;
  private gasT = 0;
  fires: Fire[] = [];
  spawn = { x: START_X, y: START_Y };
  chests: Chest[] = [];
  enemies: Enemy[] = [];
  arrowsFlying: Arrow[] = [];
  particles: Particle[] = [];
  treeHits = new Map<number, { hits: number; t: number }>();
  boss: Boss;
  minis = new Minis();
  /** Co-op: 'host' runs the world, 'guest' shows the host's world. */
  role: 'solo' | 'host' | 'guest' = 'solo';
  others: Other[] = [];
  net: NetHooks | null = null;
  coopLabel = '';
  won = false;
  lost = false;
  time = 0;
  toasts: { text: string; t: number }[] = [];
  /** Screen shake strength. */
  shake = 0;
  knockedOut = 0;
  onShop: (() => void) | null = null;
  nextId = 1;
  private spawnCd = 4;
  private chestCd = 0;
  private fireTick = 0;

  constructor(name: string, seed: number, id = `s${Date.now().toString(36)}`) {
    this.id = id;
    this.world = new World(seed);
    this.p = {
      name, outfit: 'forest', x: START_X, y: START_Y, z: 0, vz: 0, fallTop: 0, onGround: true, climbing: false,
      climbDX: 0, climbDY: 0, pushT: 0, face: Math.PI * 1.25, moving: false, walkT: 0, hp: MAX_HP, stamina: 1,
      staminaWait: 0, swingT: 0, swingCd: 0, bowCd: 0, hurtT: 0, inWater: false,
    };
    this.p.z = this.world.heightAt(this.p.x, this.p.y);
    this.trader.z = this.world.heightAt(this.trader.x, this.trader.y);
    this.boss = this.freshBoss();
  }

  say(key: string, text: string, cooldown?: number) {
    this.onSay?.(key, text, cooldown);
  }

  /** In co-op every hit does a quarter heart. */
  get coop() {
    return this.role === 'guest' || (this.role === 'host' && this.others.length > 0);
  }

  /** Heroes enemies can go after: you, and friends in co-op. */
  targets(): Target[] {
    const list: Target[] = [];
    if (!this.knockedOut) list.push({ id: 'me', x: this.p.x, y: this.p.y, z: this.p.z });
    for (const o of this.others) if (!o.ko) list.push({ id: o.id, x: o.x, y: o.y, z: o.z });
    return list;
  }

  nearest(x: number, y: number): (Target & { d: number }) | null {
    let best: (Target & { d: number }) | null = null;
    for (const t of this.targets()) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (!best || d < best.d) best = { ...t, d };
    }
    return best;
  }

  /** Where the Dark Beast is: one body, or three while it is split. */
  beastBodies(): { x: number; y: number; r: number }[] {
    const b = this.boss;
    if (!b.active || b.dead) return [];
    return [{ x: b.x, y: b.y, r: b.split > 0 ? 0.75 : 1 }, ...b.clones.map((c) => ({ x: c.x, y: c.y, r: 0.75 }))];
  }

  hurtTarget(id: string, q: number, fx?: number, fy?: number) {
    if (id === 'me') this.hurtPlayer(q, fx, fy);
    else this.net?.hurtRemote(id, q, fx, fy);
  }

  private freshBoss(): Boss {
    return { x: CX + 0.5, y: CY + 0.5, hp: BOSS_HP, active: false, state: 'idle', t: 0, next: 2, hurtT: 0, rings: [], orbs: [], dead: false, deadT: 0, clones: [], split: 0, splits: 0, dash: null };
  }

  get swordDmg() {
    return this.swords[this.sword] ?? 1;
  }
  get bowDmg() {
    return this.bows[this.bow] ?? 2;
  }
  get timeLeft() {
    return Math.max(0, TIME_LIMIT - this.elapsed);
  }
  /** 0 at the start, 1 when the world has gone black. */
  get gloom() {
    return Math.min(1, this.elapsed / TIME_LIMIT);
  }

  toast(text: string) {
    this.toasts.push({ text, t: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  float(x: number, y: number, z: number, text: string, color: string) {
    this.particles.push({ x, y, z: z + 1.6, vx: 0, vy: 0, vz: 1.4, life: 1, max: 1, color, size: 13, text });
  }

  puff(x: number, y: number, z: number, color: string, n = 8, speed = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      this.particles.push({ x, y, z: z + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1 + Math.random() * 2, life: 0.6, max: 0.6, color, size: 3 + Math.random() * 3 });
    }
  }

  // ---------- terrain helpers ----------

  private tileFree(x: number, y: number) {
    return !blocksMove(this.world.tile(Math.floor(x), Math.floor(y))) && x > 1 && y > 1 && x < SIZE - 1 && y < SIZE - 1;
  }

  traders(): { x: number; y: number }[] {
    return [{ x: this.trader.x - 0.5, y: this.trader.y - 0.5 }];
  }

  /** Glowing challenge rocks: 10 at a time somewhere around the heroes. */
  stones(): { x: number; y: number }[] {
    return this.rocks;
  }

  stoneDone(st: { x: number; y: number }) {
    return this.stonesDone.has(`${st.x},${st.y}`) && !this.rocks.some((r) => r.x === st.x && r.y === st.y);
  }

  /** Keep 10 glowing rocks around: a beaten one goes away and a new one shows up somewhere else. */
  private updateRocks(dt: number) {
    this.rockCd -= dt;
    if (this.rockCd > 0) return;
    this.rockCd = 0.7;
    const all = this.targets();
    const heroes = all.length ? all : [this.p];
    this.rocks = this.rocks.filter((r) => (this.challenge && this.challenge.key === `${r.x},${r.y}`) || heroes.some((t) => Math.hypot(r.x - t.x, r.y - t.y) < 420));
    if (this.rocks.length >= ROCKS) return;
    const c = heroes[Math.floor(Math.random() * heroes.length)];
    const a = Math.random() * Math.PI * 2, d = 35 + Math.random() * 190;
    const x = Math.floor(c.x + Math.cos(a) * d), y = Math.floor(c.y + Math.sin(a) * d);
    if (castleR(x, y) < 150 || villageAt(x, y) >= 0 || x < 60 || y < 60 || x > SIZE - 60 || y > SIZE - 60) return;
    const v = this.world.tile(x, y);
    if (tG(v) === G.Water || blocksMove(v) || tT(v) !== T.None) return;
    if (this.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < 40)) return;
    this.rocks.push({ x, y });
  }

  private nearTile(x: number, y: number, r: number) {
    return Math.hypot(x + 0.5 - this.p.x, y + 0.5 - this.p.y) < r;
  }

  // ---------- actions ----------

  jump() {
    const p = this.p;
    if (!p.onGround || p.climbing || this.knockedOut) return;
    p.vz = p.inWater ? JUMP_V * 0.5 : JUMP_V;
    p.onGround = false;
    p.fallTop = p.z;
    sfx.jump();
  }

  swing() {
    const p = this.p;
    if (p.swingCd > 0 || p.climbing || this.knockedOut) return;
    p.swingT = 0.28;
    p.swingCd = 0.4;
    sfx.swing();
    const dmg = this.swordDmg;
    for (let i = -3; i <= 3; i++) {
      const a = p.face + i * 0.4;
      this.puff(p.x + Math.cos(a) * 2, p.y + Math.sin(a) * 2, p.z + 0.8, '#f4f8ff', 1, 0.6);
    }
    // one swing hits up to 10 things in a wide arc in front of you: Murks, bosses and trees
    let left = SWING_MAX;
    const close = this.enemies
      .map((e) => ({ e, dx: e.x - p.x, dy: e.y - p.y, d: Math.hypot(e.x - p.x, e.y - p.y) }))
      .filter((q) => q.d < 2.4 && Math.abs(q.e.z - p.z) < 2 && (q.d < 0.6 || angDiff(ang(q.dx, q.dy), p.face) < 1.4))
      .sort((a, b) => a.d - b.d);
    for (const { e, dx, dy, d } of close) {
      if (left <= 0) break;
      left--;
      if (this.role === 'guest') {
        this.net?.hitEnemy(e.id, dmg, dx / (d || 1), dy / (d || 1));
        e.hurtT = 0.25;
        sfx.hit();
        this.float(e.x, e.y, e.z, `${dmg}`, '#fff');
      } else this.hurtEnemy(e, dmg, dx / (d || 1), dy / (d || 1));
    }
    // other players in the arc: in multiplayer you fight each other
    for (const o of this.others) {
      if (left <= 0) break;
      if (o.ko) continue;
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
      if (d < 2.6 && Math.abs(o.z - p.z) < 2 && (d < 0.6 || angDiff(ang(dx, dy), p.face) < 1.4)) {
        left--;
        this.net?.pvp(o.id);
        sfx.hit();
        this.float(o.x, o.y, o.z + 1.2, '-¼', '#ff8a8a');
      }
    }
    const b = this.boss;
    const body = this.beastBodies().find((q) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      return Math.hypot(dx, dy) < 2.3 + q.r * 0.8 && angDiff(ang(dx, dy), p.face) < 1.3;
    });
    if (body && left > 0) {
      left--;
      if (this.role === 'guest') {
        this.net?.hitBoss(dmg);
        b.hurtT = 0.2;
        sfx.hit();
      } else this.hurtBoss(dmg);
    }
    if (left > 0 && this.minis.swordHit(this, dmg, (dx, dy) => angDiff(ang(dx, dy), p.face) < 1.3)) left--;
    // your own walls, if you want to take one down
    for (const w of [...this.walls]) {
      if (left <= 0) break;
      if (w.owner !== this.myId) continue;
      const dx = w.x + 0.5 - p.x, dy = w.y + 0.5 - p.y, d = Math.hypot(dx, dy);
      if (d < 2 && (d < 0.8 || angDiff(ang(dx, dy), p.face) < 1.2)) {
        left--;
        this.hurtWall(w, dmg * 2);
        sfx.chop();
      }
    }
    // trees and bushes in the arc, nearest first
    if (left <= 0) return;
    const trees: { tx: number; ty: number; t: number; h: number; d: number }[] = [];
    const R = 3;
    for (let ty = Math.floor(p.y - R); ty <= Math.floor(p.y + R); ty++)
      for (let tx = Math.floor(p.x - R); tx <= Math.floor(p.x + R); tx++) {
        const v = this.world.tile(tx, ty);
        const t = tT(v);
        if (t === T.None || Math.abs(tH(v) - p.z) > 1.5) continue;
        const dx = tx + 0.5 - p.x, dy = ty + 0.5 - p.y, d = Math.hypot(dx, dy);
        if (d > R || (d > 0.9 && angDiff(ang(dx, dy), p.face) > 1.4)) continue;
        trees.push({ tx, ty, t, h: tH(v), d });
      }
    trees.sort((a, b) => a.d - b.d);
    for (const tr of trees.slice(0, left)) this.chopTree(tr.tx, tr.ty, tr.t, tr.h);
  }

  private chopTree(tx: number, ty: number, t: number, h: number) {
    const key = tx * SIZE + ty;
    const need = t === T.Bush ? 1 : Math.max(1, 3 - Math.floor(this.swordDmg / 5));
    const rec = this.treeHits.get(key) ?? { hits: 0, t: 0 };
    rec.hits++;
    rec.t = 0.25;
    this.treeHits.set(key, rec);
    sfx.chop();
    this.puff(tx + 0.5, ty + 0.5, h + 1, t === T.Bush ? '#5fa24a' : '#8a5a2b', 5, 1.5);
    if (rec.hits < need) return;
    this.treeHits.delete(key);
    this.world.chopped.add(key);
    this.net?.chop(key);
    const got = t === T.Bush ? 0 : 1 + Math.floor(Math.random() * 2);
    if (got) {
      this.wood += got;
      this.float(tx + 0.5, ty + 0.5, h, `+${got} wood`, '#e9c58a');
      sfx.treeFall();
    }
    if (t !== T.Bush) {
      this.acorns++;
      this.float(tx + 0.5, ty + 0.5, h + 1.2, '+1 acorn', '#d9a35a');
      if (this.job === 'lumberjack') {
        this.coins += 2;
        this.float(tx + 0.5, ty + 0.5, h + 1.8, '+2 coins', '#ffd34d');
      }
      this.say('chop', 'Nice chop! Trees give you wood and an acorn.', 600);
    }
    if (Math.random() < (t === T.Oak ? 0.18 : t === T.Bush ? 0.12 : 0.04)) {
      this.apples++;
      this.float(tx + 0.5, ty + 0.5, h + 0.6, '+1 apple', '#ff7a6b');
    }
    this.puff(tx + 0.5, ty + 0.5, h + 1, t === T.Pine ? '#2f6d3a' : '#4f9a3c', 14, 2.5);
  }

  shoot() {
    const p = this.p;
    if (p.bowCd > 0 || p.climbing || this.knockedOut) return;
    if (this.useIce && this.iceArrows <= 0) {
      this.useIce = false;
      this.toast('Out of ice arrows! Back to normal arrows. The trader sells 10 for 20 coins.');
    }
    const ice = this.useIce;
    if (!ice && this.arrows <= 0) {
      this.toast('Out of arrows! Buy more from a trader.');
      p.bowCd = 0.6;
      return;
    }
    const a = this.input.aimX || this.input.aimY ? ang(this.input.aimX, this.input.aimY) : p.face;
    p.face = a;
    p.bowCd = 0.5;
    if (ice) this.iceArrows--;
    else this.arrows--;
    const dmg = ice ? Math.max(0.1, Math.round(this.bowDmg) / 10) : this.bowDmg;
    const arrow: Arrow = { x: p.x, y: p.y, z: p.z + 0.9, dx: Math.cos(a), dy: Math.sin(a), life: 1.8, dmg, ice: ice || undefined };
    if (this.role === 'guest') this.net?.shoot(arrow);
    else this.arrowsFlying.push(arrow);
    sfx.bow();
  }

  /** Switch between normal and ice arrows. */
  toggleIce() {
    if (!this.useIce && this.iceArrows <= 0) {
      this.toast('No ice arrows. The trader sells 10 for 20 coins.');
      return;
    }
    this.useIce = !this.useIce;
    sfx.click();
    this.toast(this.useIce ? `Ice arrows ready (${this.iceArrows})` : `Normal arrows (${this.arrows})`);
  }

  /** Open a chest or talk to a trader if one is close. */
  interact() {
    const p = this.p;
    for (let i = 0; i < this.chests.length; i++) {
      const c = this.chests[i];
      if (Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - p.y) < 1.6 && Math.abs(this.world.heightAt(c.x, c.y) - p.z) < 1.5) {
        this.chests.splice(i, 1);
        this.openChest(c);
        this.net?.chest(c.x, c.y);
        return;
      }
    }
    for (const st of this.stones()) {
      if (this.nearTile(st.x, st.y, 2.6)) {
        if (this.stoneDone(st)) return this.toast('You already beat this rock\'s challenge');
        if (this.challenge) return;
        if (this.role === 'guest') this.net?.stone(st.x, st.y);
        else this.startChallenge(st);
        return;
      }
    }
    for (let i = 0; i < WARPS.length; i++) {
      const w = WARPS[i], back = lairPad(i);
      if (this.nearTile(w.x, w.y, 1.4)) return this.warp(back.x + 0.5, back.y + 1.5, MINI_NAMES[i]);
      if (this.nearTile(back.x, back.y, 1.4)) return this.warp(WARPS[i].x + 0.5, WARPS[i].y + 1.5, 'the starting camp');
    }
    const vi = villageAt(p.x, p.y);
    if (vi >= 0) {
      const v = VILLAGES[vi];
      if (this.nearTile(v.x + BOARD.x, v.y + BOARD.y, 2.2)) {
        this.onJobs?.(vi);
        return;
      }
      if (this.job === 'baker' && this.nearTile(v.x + OVEN.x, v.y + OVEN.y, 2.2)) {
        this.startWork('Baking', 4, () => {
          this.coins += 2;
          this.apples++;
          sfx.coin();
          this.toast('Fresh bread! +2 coins, and a loaf to eat');
        });
        return;
      }
      if (this.job === 'grocer' && vi === this.jobVillage && this.nearTile(v.x + STORE.x, v.y + STORE.y, 2.6)) {
        this.stockShelves();
        return;
      }
      if (this.job === 'farmer' || this.job === 'grocer') {
        const tx = Math.floor(p.x), ty = Math.floor(p.y);
        if (tG(this.world.tile(tx, ty)) === G.Farm) {
          const key = tx * SIZE + ty;
          const planted = this.farm.get(key);
          if (planted === undefined) {
            this.farm.set(key, this.elapsed);
            sfx.eat();
            this.float(p.x, p.y, p.z, 'Planted!', '#9be37a');
          } else if (this.elapsed - planted >= CROP_TIME) {
            this.farm.delete(key);
            if (this.job === 'grocer') {
              this.goods.veg += 2;
              sfx.eat();
              this.float(p.x, p.y, p.z, '+2 veggies for the store', '#9be37a');
            } else {
              this.coins += 3;
              sfx.coin();
              this.float(p.x, p.y, p.z, '+3 coins', '#ffd34d');
            }
          } else this.toast(`Still growing… ${Math.ceil(CROP_TIME - (this.elapsed - planted))}s`);
          return;
        }
      }
    }
    for (const t of this.traders()) {
      if (Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.y) < 2.2) {
        this.onShop?.();
        return;
      }
    }
    if (this.job === 'fisher') {
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          if (tG(this.world.tile(Math.floor(p.x) + i, Math.floor(p.y) + j)) === G.Water && !p.inWater) {
            this.startWork('Fishing', 3, () => {
              this.coins += 4;
              sfx.coin();
              this.toast('Caught a fish! Sold for 4 coins');
            });
            return;
          }
    }
    if (this.job === 'miner' || this.job === 'grocer') {
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          if (tG(this.world.tile(Math.floor(p.x) + i, Math.floor(p.y) + j)) === G.Rock) {
            this.startWork('Mining', 2.5, () => {
              if (this.job === 'grocer') {
                this.goods.ore++;
                sfx.chop();
                this.toast('Mined some ore for the store');
                return;
              }
              const gem = Math.random() < 0.15;
              this.coins += gem ? 20 : 3;
              sfx.coin();
              this.toast(gem ? 'A shiny gem! +20 coins' : 'Mined some ore. +3 coins');
            });
            return;
          }
    }
  }

  private warp(x: number, y: number, where: string) {
    const p = this.p;
    this.puff(p.x, p.y, p.z, '#b77cff', 20, 3);
    p.x = x;
    p.y = y;
    p.z = this.world.heightAt(x, y);
    p.vz = 0;
    p.onGround = true;
    p.climbing = false;
    this.trader.x = x + 2;
    this.trader.y = y + 1;
    this.enemies = this.enemies.filter((e) => e.ch);
    this.lastLand = { x, y };
    this.puff(x, y, p.z, '#b77cff', 20, 3);
    sfx.chest();
    this.toast(`Warped to ${where}!`);
  }

  private startWork(label: string, max: number, done: () => void) {
    if (this.work) return;
    this.work = { label, t: 0, max, x: this.p.x, y: this.p.y, done };
  }

  takeJob(id: string, village: number) {
    this.job = id;
    this.jobVillage = village;
    this.letterTo = id === 'courier' ? otherVillage(village) : null;
    const j = jobById(id);
    this.toast(`You're a ${j?.name} now!`);
    if (id === 'courier') this.say('courier', `Take this letter to ${VILLAGES[this.letterTo ?? 0].name}. Follow the yellow arrow!`, 5);
    else this.say('job', `Good luck with your new job!`, 5);
  }

  addMeat(x: number, y: number, z: number) {
    this.goods.meat++;
    this.float(x, y, z + 1, '+1 meat', '#ff9a8a');
  }

  wallAt(tx: number, ty: number): Wall | undefined {
    for (const w of this.walls) if (w.x === tx && w.y === ty) return w;
    return undefined;
  }

  /** The tile in front of you where a wall would go. */
  wallSpot() {
    const p = this.p;
    return { x: Math.floor(p.x + Math.cos(p.face) * 1.1), y: Math.floor(p.y + Math.sin(p.face) * 1.1) };
  }

  /** Build a wall in front of you: 5 wood, 12 hearts. You can walk through your own walls. */
  build() {
    const p = this.p;
    if (p.climbing || this.knockedOut) return;
    if (this.wood < WALL_WOOD) {
      this.toast(`A wall takes ${WALL_WOOD} wood. Chop some trees!`);
      return;
    }
    const { x, y } = this.wallSpot();
    if (!this.canWall(x, y)) {
      this.toast("You can't build a wall there");
      return;
    }
    this.wood -= WALL_WOOD;
    sfx.chop();
    this.puff(x + 0.5, y + 0.5, this.world.heightAt(x, y) + 0.5, '#9b6b3c', 10, 2);
    if (this.role === 'guest') {
      this.net?.build(x, y);
      this.walls.push({ id: -1, x, y, owner: this.myId, hp: WALL_HP, hurtT: 0 });
    } else this.addWall(x, y, 'me');
    this.say('wall', 'A wall! You can walk through your own walls, but Murks and other people cannot.', 600);
  }

  canWall(x: number, y: number, z: number | null = this.p.z) {
    const v = this.world.tile(x, y);
    if (tG(v) === G.Water || tT(v) !== T.None || this.wallAt(x, y)) return false;
    if ((z !== null && Math.abs(tH(v) - z) > 1.5) || (this.world.sealed && isDoorTile(x, y))) return false;
    if (villageAt(x, y) >= 0 && tG(v) === G.Roof) return false;
    return !this.enemies.some((e) => Math.floor(e.x) === x && Math.floor(e.y) === y);
  }

  addWall(x: number, y: number, owner: string) {
    if (this.wallAt(x, y)) return;
    this.walls.push({ id: this.nextId++, x, y, owner, hp: WALL_HP, hurtT: 0 });
  }

  /** Something hit a wall. Returns true if it broke. */
  hurtWall(w: Wall, q: number) {
    if (this.role === 'guest') {
      this.net?.hitWall(w.id, q);
      w.hurtT = 0.2;
      return false;
    }
    w.hp -= q;
    w.hurtT = 0.2;
    if (w.hp > 0) return false;
    this.walls = this.walls.filter((o) => o !== w);
    this.puff(w.x + 0.5, w.y + 0.5, this.world.heightAt(w.x, w.y) + 0.6, '#9b6b3c', 16, 2.5);
    sfx.treeFall();
    return true;
  }

  /** Put everything you are carrying on the store shelves (wood too). */
  stockShelves() {
    const carried = this.goods.veg + this.goods.ore + this.goods.meat + this.wood;
    if (!carried) {
      const on = GOODS.reduce((n, g) => n + this.shelves[g.id], 0);
      this.toast(on ? `${on} things on the shelves. Go get more to sell!` : 'Nothing to stock. Farm, mine, chop and beat Murks for meat!');
      return;
    }
    this.goods.wood += this.wood;
    this.wood = 0;
    for (const g of GOODS) {
      this.shelves[g.id] += this.goods[g.id];
      this.goods[g.id] = 0;
    }
    sfx.chest();
    this.toast(`Stocked ${carried} thing${carried > 1 ? 's' : ''}! Villagers will come and buy them.`);
    this.shopperCd = Math.min(this.shopperCd, 1.5);
  }

  /** Villagers walk to your store, take something off a shelf, pay and walk home. */
  private updateStore(dt: number) {
    if (this.job !== 'grocer') {
      this.shoppers = [];
      return;
    }
    const v = VILLAGES[this.jobVillage] ?? VILLAGES[0];
    const sx = v.x + STORE.x + 0.5, sy = v.y + STORE.y + 1.8;
    const stocked = GOODS.filter((g) => this.shelves[g.id] > 0);
    this.shopperCd -= dt;
    if (stocked.length && this.shopperCd <= 0 && this.shoppers.length < 3 && Math.hypot(this.p.x - v.x, this.p.y - v.y) < 120) {
      this.shopperCd = 5 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      const fx = v.x + 0.5 + Math.cos(a) * 9, fy = v.y + 0.5 + Math.sin(a) * 9;
      this.shoppers.push({ x: fx, y: fy, tx: sx + (Math.random() - 0.5) * 2, ty: sy + Math.random() * 0.6, phase: 'in', t: 0, look: Math.floor(Math.random() * 4), got: null });
    }
    for (let i = this.shoppers.length - 1; i >= 0; i--) {
      const s = this.shoppers[i];
      s.t += dt;
      if (s.phase === 'shop') {
        if (s.t > 1.6) {
          const left = GOODS.filter((g) => this.shelves[g.id] > 0);
          if (left.length) {
            const g = left[Math.floor(Math.random() * left.length)];
            this.shelves[g.id]--;
            s.got = g.id;
            this.coins += g.price;
            const near = Math.hypot(this.p.x - s.x, this.p.y - s.y) < 30;
            if (near) {
              sfx.coin();
              this.float(s.x, s.y, this.world.heightAt(s.x, s.y) + 1.6, `+${g.price} coins`, '#ffd34d');
            } else this.toast(`A villager bought ${g.name} at your store: +${g.price} coins`);
          }
          s.phase = 'out';
          const a = Math.random() * Math.PI * 2;
          s.tx = v.x + 0.5 + Math.cos(a) * 12;
          s.ty = v.y + 0.5 + Math.sin(a) * 12;
          s.t = 0;
        }
        continue;
      }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
      if (d < 0.2) {
        if (s.phase === 'in') {
          s.phase = 'shop';
          s.t = 0;
        } else this.shoppers.splice(i, 1);
        continue;
      }
      const sp = Math.min(d, 2.2 * dt);
      s.x += (dx / d) * sp;
      s.y += (dy / d) * sp;
    }
  }

  quitJob() {
    this.job = null;
    this.letterTo = null;
  }

  spawnMinion(kind: number, x: number, y: number) {
    this.enemies.push({
      id: this.nextId++, kind, x, y, z: this.world.heightAt(x, y), hp: ENEMY_KINDS[kind].hp, aggro: true, atkCd: 1.5,
      hurtT: 0, kx: 0, ky: 0, wanderA: 0, wanderT: 0, hop: Math.random() * 6, minion: true,
    });
    this.puff(x, y, this.world.heightAt(x, y), '#6fbf4a', 10, 2);
  }

  startChallenge(st: { x: number; y: number }) {
    const c = CHALLENGES[Math.floor(hash(st.x, st.y, this.world.seed + 77) * CHALLENGES.length)];
    const lv = this.rockLevel;
    const name = lv ? `${c.name} (level ${lv + 1})` : c.name;
    this.challenge = { key: `${st.x},${st.y}`, x: st.x + 0.5, y: st.y + 0.5, name };
    this.enemies = this.enemies.filter((e) => e.aggro);
    // each win makes the next rock a little harder: an extra Murk, and every Murk a bit tougher
    const kinds = [...c.kinds];
    for (let i = 0; i < Math.min(lv, 12); i++) kinds.push(i % 3 === 2 ? 1 : 0);
    const tough = 1 + Math.min(lv, 20) * 0.12;
    kinds.forEach((kind, i) => {
      const a = (i / kinds.length) * Math.PI * 2;
      let ex = st.x + 0.5 + Math.cos(a) * 6, ey = st.y + 0.5 + Math.sin(a) * 6;
      const v = this.world.tile(Math.floor(ex), Math.floor(ey));
      if (tG(v) === G.Water || blocksMove(v)) {
        ex = st.x + 0.5 + Math.cos(a) * 2;
        ey = st.y + 0.5 + Math.sin(a) * 2;
      }
      this.enemies.push({
        id: this.nextId++, kind, x: ex, y: ey, z: this.world.heightAt(ex, ey), hp: Math.round(ENEMY_KINDS[kind].hp * tough), aggro: true, atkCd: 1.5,
        hurtT: 0, kx: 0, ky: 0, wanderA: 0, wanderT: 0, hop: Math.random() * 6, ch: true,
      });
      this.puff(ex, ey, this.world.heightAt(ex, ey), '#5ad0ff', 12, 2);
    });
    this.shake = 8;
    sfx.door();
    this.toast(`Challenge: ${name}! Win for a permanent quarter heart.`);
    this.say('challenge', 'Here they come! Beat them all!', 10);
  }

  private updateChallenge() {
    const c = this.challenge;
    if (!c) return;
    const left = this.enemies.filter((e) => e.ch).length;
    const near = this.nearest(c.x, c.y);
    if (!near || near.d > 45) {
      this.enemies = this.enemies.filter((e) => !e.ch);
      this.challenge = null;
      this.toast('Challenge failed. Try the rock again!');
      return;
    }
    if (left === 0) {
      this.stonesDone.add(c.key);
      this.rocks = this.rocks.filter((r) => `${r.x},${r.y}` !== c.key);
      this.rockLevel++;
      this.challenge = null;
      this.net?.bonus('challenge', c.key);
      if (this.maxHp < MAX_HP_CAP) {
        this.maxHp++;
        this.toast(`Challenge won! +¼ heart forever (${this.maxHp / 4} hearts)`);
      } else this.toast('Challenge won! You already have the most hearts (20).');
      this.p.hp = this.maxHp;
      sfx.chest();
      this.puff(c.x, c.y, this.world.heightAt(c.x, c.y) + 1, '#5ad0ff', 30, 3);
      this.say('chwin', 'You won! You got stronger! The rock is gone, and the next one will be a little harder.', 20);
    }
  }

  nearSomething(): string | null {
    const p = this.p;
    for (const c of this.chests) if (Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - p.y) < 1.6) return 'Open chest';
    for (let i = 0; i < WARPS.length; i++) {
      if (this.nearTile(WARPS[i].x, WARPS[i].y, 1.4)) return `Warp to the ${MINI_NAMES[i]}`;
      const b = lairPad(i);
      if (this.nearTile(b.x, b.y, 1.4)) return 'Warp back to camp';
    }
    for (const st of this.stones()) if (this.nearTile(st.x, st.y, 2.6)) return this.stoneDone(st) ? null : this.challenge ? null : 'Take the challenge';
    const vi = villageAt(p.x, p.y);
    if (vi >= 0) {
      const v = VILLAGES[vi];
      if (this.nearTile(v.x + BOARD.x, v.y + BOARD.y, 2.2)) return 'Job board';
      if (this.job === 'baker' && this.nearTile(v.x + OVEN.x, v.y + OVEN.y, 2.2)) return 'Bake bread';
      if (this.job === 'grocer' && vi === this.jobVillage && this.nearTile(v.x + STORE.x, v.y + STORE.y, 2.6)) return 'Stock the shelves';
      if ((this.job === 'farmer' || this.job === 'grocer') && tG(this.world.tile(Math.floor(p.x), Math.floor(p.y))) === G.Farm) {
        const pl = this.farm.get(Math.floor(p.x) * SIZE + Math.floor(p.y));
        return pl === undefined ? 'Plant' : this.elapsed - pl >= CROP_TIME ? 'Harvest' : null;
      }
    }
    if (this.job === 'fisher' || this.job === 'miner' || this.job === 'grocer') {
      const want = this.job === 'fisher' ? G.Water : G.Rock;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          if (tG(this.world.tile(Math.floor(p.x) + i, Math.floor(p.y) + j)) === want && !p.inWater) return this.job === 'fisher' ? 'Fish' : this.job === 'grocer' ? 'Mine ore' : 'Mine';
    }
    for (const t of this.traders()) if (Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.y) < 2.2) return 'Trade';
    return null;
  }

  private openChest(c: Chest) {
    sfx.chest();
    this.chestCd = 5;
    const h = this.world.heightAt(c.x, c.y);
    this.puff(c.x + 0.5, c.y + 0.5, h, '#ffe27a', 18, 2.5);
    const bestS = Math.max(...this.swords), bestB = Math.max(...this.bows);
    const canS = bestS < MAX_SWORD, canB = bestB < MAX_BOW;
    const extraArrows = 5 + Math.floor(Math.random() * 6);
    this.arrows += extraArrows;
    if (canS && (!canB || Math.random() < 0.62)) {
      const top = Math.min(MAX_SWORD, bestS + MAX_UPGRADE);
      const d = bestS + 1 + Math.floor(Math.pow(Math.random(), 1.4) * (top - bestS));
      this.swords.push(d);
      this.swords.sort((a, b) => a - b);
      this.sword = this.swords.lastIndexOf(d);
      this.toast(`Found the ${swordName(d)}! (${d} damage) + ${extraArrows} arrows`);
    } else if (canB) {
      const top = Math.min(MAX_BOW, bestB + MAX_UPGRADE);
      const d = bestB + 1 + Math.floor(Math.pow(Math.random(), 1.4) * (top - bestB));
      this.bows.push(d);
      this.bows.sort((a, b) => a - b);
      this.bow = this.bows.lastIndexOf(d);
      this.toast(`Found the ${bowName(d)}! (${d} damage) + ${extraArrows} arrows`);
    } else {
      this.coins += 20;
      this.toast(`Found 20 coins and ${extraArrows} arrows`);
    }
    this.say('chestopen', ['Ooh, nice!', 'Awesome loot!', 'Look what you found!'][Math.floor(Math.random() * 3)], 30);
  }

  campfire() {
    const p = this.p;
    if (!p.onGround || p.climbing) return;
    if (this.wood < CAMPFIRE_WOOD) {
      this.toast(`A campfire needs ${CAMPFIRE_WOOD} wood. Chop trees with your sword!`);
      return;
    }
    const tx = Math.floor(p.x + Math.cos(p.face) * 1.1), ty = Math.floor(p.y + Math.sin(p.face) * 1.1);
    const v = this.world.tile(tx, ty);
    if (tG(v) === G.Water || tT(v) !== T.None || Math.abs(tH(v) - p.z) > 0.5 || inRoom(tx, ty)) {
      this.toast("Can't build a campfire there");
      return;
    }
    if (this.fires.some((f) => f.x === tx && f.y === ty)) return;
    this.wood -= CAMPFIRE_WOOD;
    this.fires.push({ x: tx, y: ty });
    if (this.fires.length > 40) this.fires.shift();
    this.spawn = { x: p.x, y: p.y };
    sfx.fire();
    this.toast('Campfire lit! Rest near it to heal. You will wake up here if you get knocked out.');
  }

  eat() {
    const p = this.p;
    if (p.hp >= this.maxHp) return this.toast('Your hearts are already full');
    const missing = this.maxHp - p.hp;
    if (this.apples > 0 && (missing >= FOOD_HEAL || this.acorns <= 0)) {
      this.apples--;
      p.hp = Math.min(this.maxHp, p.hp + FOOD_HEAL);
    } else if (this.acorns > 0) {
      this.acorns--;
      p.hp = Math.min(this.maxHp, p.hp + ACORN_HEAL);
    } else return this.toast('Nothing to eat. Chop trees for acorns!');
    sfx.eat();
  }

  // ---------- damage ----------

  hurtPlayer(q: number, fromX?: number, fromY?: number) {
    const p = this.p;
    if (this.coop) q = 1; // co-op: every hit is a quarter heart
    if (p.hurtT > 0 || this.knockedOut || this.won) return;
    p.hp = Math.max(0, p.hp - q);
    p.hurtT = 0.8;
    this.shake = Math.max(this.shake, 6 + q * 2);
    sfx.hurt();
    this.float(p.x, p.y, p.z, `-${q / 4}`, '#ff5a5a');
    if (fromX !== undefined && fromY !== undefined && !p.climbing) {
      const dx = p.x - fromX, dy = p.y - fromY, d = Math.hypot(dx, dy) || 1;
      this.tryMove(p, (dx / d) * 0.6, (dy / d) * 0.6, false);
    }
    if (p.hp > 0 && p.hp <= 4) this.say('lowhp', "You're hurt! Eat something with H, or rest by a fire.", 45);
    if (p.hp <= 0) {
      this.knockedOut = 2.2;
      this.toast('You were knocked out!');
    }
  }

  hurtEnemy(e: Enemy, dmg: number, nx: number, ny: number, owner = 'me') {
    e.hp = Math.round((e.hp - dmg) * 100) / 100;
    e.hurtT = 0.25;
    e.aggro = true;
    e.kx = nx * 6;
    e.ky = ny * 6;
    sfx.hit();
    this.float(e.x, e.y, e.z, `${dmg}`, '#fff');
    if (e.hp <= 0) {
      const k = ENEMY_KINDS[e.kind];
      this.enemies.splice(this.enemies.indexOf(e), 1);
      this.puff(e.x, e.y, e.z, k.body, 16, 3);
      const bonusArrows = Math.random() < 0.3 ? 2 : 0;
      if (owner !== 'me') {
        this.net?.reward(owner, k.coins, bonusArrows);
        sfx.enemyDie();
        return;
      }
      this.coins += k.coins;
      this.float(e.x, e.y, e.z + 0.5, `+${k.coins} coin${k.coins > 1 ? 's' : ''}`, '#ffd34d');
      this.arrows += bonusArrows;
      if (this.job === 'grocer') this.addMeat(e.x, e.y, e.z);
      if (this.job === 'guard') {
        this.coins += 3;
        this.float(e.x, e.y, e.z + 1, '+3 pay', '#ffd34d');
      }
      sfx.enemyDie();
      sfx.coin();
    }
  }

  gas(x: number, y: number, z: number) {
    const a = Math.random() * Math.PI * 2, r = 1.1 + Math.random() * 0.4;
    this.particles.push({
      x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: z + 1 + Math.random() * 0.8, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5,
      vz: 1 + Math.random(), life: 1.8, max: 1.8, color: Math.random() < 0.5 ? '#7a34c0' : '#0b0612', size: 4 + Math.random() * 4, gas: true,
    });
  }

  hurtBoss(dmg: number) {
    const b = this.boss;
    const wasHalf = b.hp > 250;
    b.hp = Math.max(0, b.hp - dmg);
    if (wasHalf && b.hp <= 250 && b.hp > 0) this.say('bhalf', "It's getting weaker! Keep going!", 999);
    b.hurtT = 0.2;
    sfx.hit();
    this.float(b.x, b.y, FLOOR_H + 2.4, `${dmg}`, '#e9c6ff');
    if (b.hp <= 0 && !b.dead) {
      b.dead = true;
      b.deadT = 0;
      b.rings = [];
      b.orbs = [];
      b.clones = [];
      b.split = 0;
      b.dash = null;
      this.won = true;
      this.world.sealed = false;
      sfx.win();
      this.coins += 50;
      this.toast('The Dark Beast is defeated! +50 coins');
      this.say('won', 'You did it! The Dark Beast is gone and the land is saved!', 999);
    }
  }

  // ---------- update ----------

  input: Input = { up: false, down: false, left: false, right: false, aimX: 0, aimY: 0 };

  private stepDt = 1 / 60;

  update(dt: number) {
    this.stepDt = dt;
    this.time += dt;
    if (!this.won) this.elapsed += dt;
    if (this.elapsed >= TIME_LIMIT && !this.won) {
      this.lost = true;
      return;
    }
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    for (const [k, r] of this.treeHits) {
      r.t -= dt;
      if (r.t < -6) this.treeHits.delete(k);
    }

    if (this.knockedOut > 0) {
      this.knockedOut -= dt;
      if (this.knockedOut <= 0) this.respawn();
    } else {
      this.updatePlayer(dt);
    }
    this.updateWork(dt);
    this.updateStore(dt);
    for (const w of this.walls) w.hurtT = Math.max(0, w.hurtT - dt);
    this.updateTrader(dt);
    if (this.role === 'guest') {
      this.guestTick(dt);
    } else {
      this.updateEnemies(dt);
      this.updateChallenge();
      this.updateRocks(dt);
      this.minis.update(this, dt);
      this.updateArrows(dt);
      this.updateBoss(dt);
      this.updateChests(dt);
    }
    for (const o of this.others) {
      const k = Math.min(1, dt * 12);
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
      o.z += (o.tz - o.z) * k;
      o.walkT += o.moving ? dt : 0;
      o.swingT = Math.max(0, o.swingT - dt);
    }
    this.updateNarrator();
    this.updateParticles(dt);
    this.world.prune(Math.floor(this.p.x), Math.floor(this.p.y));
  }

  /** A co-op guest only smooths what the host sends, and makes the boss's gas. */
  private guestTick(dt: number) {
    const k = Math.min(1, dt * 12);
    for (const e of this.enemies) {
      if (e.tx !== undefined && e.ty !== undefined) {
        e.x += (e.tx - e.x) * k;
        e.y += (e.ty - e.y) * k;
      }
      e.hurtT = Math.max(0, e.hurtT - dt);
      if (!e.frozen) e.hop += dt * (e.aggro ? 9 : 5);
    }
    const b = this.boss;
    b.hurtT = Math.max(0, b.hurtT - dt);
    if (b.dead) b.deadT += dt;
    for (const r of b.rings) r.t += dt;
    for (const h of this.minis.hazards) h.t += dt;
    for (const o of b.orbs) {
      o.x += o.dx * 7 * dt;
      o.y += o.dy * 7 * dt;
    }
    for (const sh of this.minis.shots) {
      sh.x += sh.dx * sh.speed * dt;
      sh.y += sh.dy * sh.speed * dt;
    }
    for (const a of this.arrowsFlying) {
      a.x += a.dx * 15 * dt;
      a.y += a.dy * 15 * dt;
    }
    this.gasT -= dt;
    if (!b.dead && this.gasT <= 0 && Math.hypot(this.p.x - b.x, this.p.y - b.y) < 70) {
      this.gasT = 0.09;
      this.gas(b.x, b.y, FLOOR_H + 1.6);
    }
  }

  private updateWork(dt: number) {
    const w = this.work;
    if (!w) return;
    if (Math.hypot(this.p.x - w.x, this.p.y - w.y) > 0.3 || this.knockedOut) {
      this.work = null;
      return;
    }
    w.t += dt;
    if (w.t >= w.max) {
      this.work = null;
      w.done();
    }
  }

  private updateTrader(dt: number) {
    const t = this.trader, p = this.p;
    const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
    if (d > 22 || (inRoom(t.x, t.y) && !inRoom(p.x, p.y))) {
      // catch up when left far behind (or never follow into the Dark Beast's room)
      const a = p.face + Math.PI;
      t.x = p.x + Math.cos(a) * 3;
      t.y = p.y + Math.sin(a) * 3;
      if (inRoom(t.x, t.y)) {
        t.x = CX + 0.5;
        t.y = CY + ROOM_R + 5.5;
      }
    } else if (d > 3 && !inRoom(p.x, p.y)) {
      const sp = Math.min(d - 3, (d > 8 ? 6 : 4.4) * dt);
      t.x += (dx / d) * sp;
      t.y += (dy / d) * sp;
      t.walkT += dt;
      t.face = Math.atan2(dy, dx);
    }
    const gh = this.world.heightAt(t.x, t.y);
    t.z += (gh - t.z) * Math.min(1, dt * 10);
  }

  private updateNarrator() {
    const p = this.p;
    // time
    const hoursLeft = Math.ceil(this.timeLeft / 3600);
    if (this.lastHour < 0) this.lastHour = hoursLeft;
    if (hoursLeft < this.lastHour && !this.won) {
      this.lastHour = hoursLeft;
      this.say(`h${hoursLeft}`, hoursLeft === 1 ? 'Only one hour left! Hurry to the castle!' : `${hoursLeft} hours left before the world goes black.`, 5);
    }
    if (this.timeLeft < 600 && this.timeLeft > 590 && !this.won) this.say('10min', 'Ten minutes left! Go, go, go!', 9999);
    // things you can see
    for (const c of this.chests) {
      const k = `c${c.x},${c.y}`;
      if (!this.seen.has(k) && Math.hypot(c.x - p.x, c.y - p.y) < 13) {
        this.seen.add(k);
        this.say('chest', ["Look, there's a chest!", 'Is that a chest over there?', 'A treasure chest! Go get it!'][Math.floor(Math.random() * 3)], 20);
      }
    }
    for (const st of this.stones()) {
      const k = `s${st.x},${st.y}`;
      if (!this.seen.has(k) && !this.stoneDone(st) && Math.hypot(st.x - p.x, st.y - p.y) < 14) {
        this.seen.add(k);
        this.say('stone', 'A glowing rock! Press E next to it to take its challenge.', 30);
      }
    }
    const vi = villageAt(p.x, p.y);
    if (vi !== this.wasVillage) {
      this.wasVillage = vi;
      if (vi >= 0) {
        this.say(`v${vi}`, `Welcome to ${VILLAGES[vi].name}! Check the job board to get a job.`, 120);
        if (this.job === 'courier' && this.letterTo === vi) {
          this.coins += 15;
          sfx.coin();
          this.letterTo = otherVillage(vi);
          this.toast(`Letter delivered! +15 coins. Next one goes to ${VILLAGES[this.letterTo].name}.`);
        }
      }
    }
    const cr = castleR(p.x, p.y);
    if (cr < 140 && cr > 40 && !this.won) this.say('castle', 'The castle… I can feel the gloom. Be brave.', 300);
    if (p.climbing && p.stamina < 0.3) this.say('hang', 'Hang on! Your stamina is running out!', 25);
    if (p.inWater && !this.seen.has('swim')) {
      this.seen.add('swim');
      this.say('swim', 'Time for a swim! Swimming uses stamina, so do not go too far.', 60);
    }
    if (p.inWater && p.stamina < 0.3) this.say('swimlow', 'Swim to shore, quick!', 20);
  }

  private respawn() {
    const p = this.p;
    p.x = this.spawn.x;
    p.y = this.spawn.y;
    p.z = this.world.heightAt(p.x, p.y);
    p.vz = 0;
    p.hp = this.maxHp;
    p.stamina = 1;
    p.climbing = false;
    p.onGround = true;
    if (!this.coop) this.enemies = [];
    this.arrowsFlying = [];
    this.work = null;
    if (this.boss.active && !this.boss.dead && this.role !== 'guest' && !this.others.some((o) => !o.ko && inRoom(o.x, o.y))) {
      this.boss = this.freshBoss();
      this.world.sealed = false;
    }
    this.toast('You wake up by the fire. Hurry, the gloom is spreading!');
  }

  /** Move with sliding. Returns false if fully blocked. */
  private tryMove(p: Player, mx: number, my: number, allowClimb: boolean): boolean {
    let moved = false;
    const stepUp = p.onGround ? 1.05 : 0.05;
    const tryAxis = (nx: number, ny: number) => {
      if (nx < 1 || ny < 1 || nx > SIZE - 1 || ny > SIZE - 1) return false;
      const v = this.world.tile(Math.floor(nx), Math.floor(ny));
      if (blocksMove(v)) return false;
      const w = this.walls.length ? this.wallAt(Math.floor(nx), Math.floor(ny)) : undefined;
      if (w && w.owner !== this.myId) return false;
      const th = tH(v);
      if (th > p.z + stepUp) return false;
      if (th > p.z) p.z = th; // stepping up one level
      p.x = nx;
      p.y = ny;
      return true;
    };
    if (tryAxis(p.x + mx, p.y + my)) return true;
    if (Math.abs(mx) > 0.0001 && tryAxis(p.x + mx, p.y)) moved = true;
    if (Math.abs(my) > 0.0001 && tryAxis(p.x, p.y + my)) moved = true;
    if (moved || !allowClimb) return moved;
    // facing a wall: start climbing after pushing for a moment
    const dirX = Math.abs(mx) >= Math.abs(my) ? Math.sign(mx) : 0;
    const dirY = dirX === 0 ? Math.sign(my) : 0;
    const wx = Math.floor(p.x + dirX * 0.7), wy = Math.floor(p.y + dirY * 0.7);
    const wv = this.world.tile(wx, wy);
    const sealedIn = this.world.sealed && inRoom(p.x, p.y);
    if (!blocksMove(wv) && tH(wv) > p.z + 0.5 && p.onGround && p.stamina > 0.02 && !sealedIn && tG(wv) !== G.Water) {
      p.pushT += this.stepDt;
      if (p.pushT > 0.04) {
        p.climbing = true;
        p.climbDX = dirX;
        p.climbDY = dirY;
        p.onGround = false;
        p.vz = 0;
        // snap against the wall
        if (dirX) p.x = dirX > 0 ? wx - 0.32 : wx + 1.32;
        if (dirY) p.y = dirY > 0 ? wy - 0.32 : wy + 1.32;
      }
    }
    return false;
  }

  private updatePlayer(dt: number) {
    const p = this.p;
    const inp = this.input;
    // screen directions -> world directions (isometric)
    let sx = 0, sy = 0;
    if (inp.up) sy -= 1;
    if (inp.down) sy += 1;
    if (inp.left) sx -= 1;
    if (inp.right) sx += 1;
    let wx = sx + sy, wy = sy - sx;
    const len = Math.hypot(wx, wy);
    if (len) {
      wx /= len;
      wy /= len;
    }
    p.moving = len > 0;
    p.swingT = Math.max(0, p.swingT - dt);
    p.swingCd = Math.max(0, p.swingCd - dt);
    p.bowCd = Math.max(0, p.bowCd - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);

    const ground = this.world.heightAt(p.x, p.y);
    p.inWater = tG(this.world.tile(Math.floor(p.x), Math.floor(p.y))) === G.Water && p.z <= 0.05;

    if (p.climbing) {
      const pushing = len > 0 && wx * p.climbDX + wy * p.climbDY > 0.3;
      const wallX = Math.floor(p.x + p.climbDX * 0.7), wallY = Math.floor(p.y + p.climbDY * 0.7);
      const wallH = this.world.heightAt(wallX, wallY);
      if (pushing) {
        p.z += CLIMB_SPEED * dt;
        p.walkT += dt;
      }
      p.stamina -= CLIMB_DRAIN * dt; // hanging on costs stamina too
      p.staminaWait = 1;
      if (p.z >= wallH) {
        p.z = wallH;
        p.x = wallX + 0.5 - p.climbDX * 0.2;
        p.y = wallY + 0.5 - p.climbDY * 0.2;
        p.climbing = false;
        p.onGround = true;
      } else if (p.stamina <= 0) {
        p.stamina = 0;
        p.climbing = false;
        p.fallTop = p.z;
        this.toast('Out of stamina!');
      } else if (len > 0 && wx * p.climbDX + wy * p.climbDY < -0.3) {
        p.climbing = false; // let go
        p.fallTop = p.z;
      }
      return;
    }

    if (len) {
      p.face = ang(wx, wy);
      p.walkT += dt;
      const speed = (p.inWater ? WALK * 0.5 : WALK) * dt;
      if (!this.tryMove(p, wx * speed, wy * speed, true)) {
        /* blocked */
      } else p.pushT = 0;
    } else p.pushT = 0;

    // gravity and falling
    const g2 = this.world.heightAt(p.x, p.y);
    if (p.onGround && p.z > g2 + 0.01) {
      // walked off a ledge
      if (p.z - g2 <= 1.05) p.z = g2;
      else {
        p.onGround = false;
        p.vz = 0;
        p.fallTop = p.z;
      }
    }
    if (!p.onGround) {
      p.vz -= GRAVITY * dt;
      p.z += p.vz * dt;
      p.fallTop = Math.max(p.fallTop, p.z);
      const gh = this.world.heightAt(p.x, p.y);
      if (p.z <= gh) {
        const fell = p.fallTop - gh;
        p.z = gh;
        p.vz = 0;
        p.onGround = true;
        const water = tG(this.world.tile(Math.floor(p.x), Math.floor(p.y))) === G.Water;
        if (fell > SAFE_FALL && !water) {
          const q = Math.ceil(fell - SAFE_FALL);
          this.hurtPlayer(q);
          this.toast(`Ouch! Fell ${Math.round(fell)} levels`);
          this.say('fall', 'Ouch! That was a long way down.', 30);
        } else if (fell > 1.5) sfx.land();
      }
    } else p.z = Math.max(p.z, ground === g2 ? ground : g2);

    // swimming uses stamina like climbing; run out and you sink back to shore
    if (p.inWater && p.onGround) {
      p.stamina -= CLIMB_DRAIN * dt;
      p.staminaWait = 1;
      if (p.stamina <= 0) {
        p.stamina = 0.35;
        p.x = this.lastLand.x;
        p.y = this.lastLand.y;
        p.z = this.world.heightAt(p.x, p.y);
        this.toast('Too tired to swim! You washed back to shore.');
        this.hurtPlayer(2);
      }
    } else if (p.onGround && tG(this.world.tile(Math.floor(p.x), Math.floor(p.y))) !== G.Water) {
      this.lastLand = { x: p.x, y: p.y };
    }
    // stamina refills on dry ground
    if (p.onGround && !p.inWater) {
      p.staminaWait -= dt;
      if (p.staminaWait <= 0) p.stamina = Math.min(1, p.stamina + 0.4 * dt);
    }

    // campfires heal
    this.fireTick += dt;
    if (this.fireTick > 1.5) {
      this.fireTick = 0;
      if (p.hp < this.maxHp && this.fires.some((f) => Math.hypot(f.x + 0.5 - p.x, f.y + 0.5 - p.y) < 2.6)) {
        p.hp++;
        this.float(p.x, p.y, p.z, '+¼', '#ff9bb0');
      }
    }

    // entering the Dark Beast's room locks the doors
    if (this.role !== 'guest' && !this.boss.active && !this.boss.dead && inRoom(p.x, p.y) && p.onGround && p.z <= FLOOR_H + 0.5) {
      this.boss.active = true;
      this.boss.next = 2.5;
      this.world.sealed = true;
      this.enemies = [];
      this.shake = 14;
      sfx.door();
      this.toast('The doors slam shut! There is no way out. Defeat the Dark Beast!');
      this.say('boss', "There's no way out! Fight the Dark Beast!", 5);
    }
  }

  private updateEnemies(dt: number) {
    const all = this.targets();
    const p = all.length ? all[Math.floor(Math.random() * all.length)] : this.p;
    const fighting = this.boss.active && !this.boss.dead;
    if (this.boss.active === false && !this.boss.dead && this.others.some((o) => !o.ko && inRoom(o.x, o.y))) {
      // a friend walked into the Dark Beast's room
      this.boss.active = true;
      this.boss.next = 2.5;
      this.world.sealed = true;
      this.enemies = [];
      sfx.door();
      this.toast('Your friend entered the Dark Beast\'s room. The doors slam shut!');
    }
    // spawn around a hero, but never in the castle
    this.spawnCd -= dt;
    if (!fighting && !this.challenge && this.spawnCd <= 0 && this.enemies.length < 8 + this.others.length * 4 && castleR(p.x, p.y) > CASTLE_R + 26 && villageAt(p.x, p.y) < 0) {
      this.spawnCd = 2.5;
      const a = Math.random() * Math.PI * 2;
      const d = 34 + Math.random() * 14;
      const ex = p.x + Math.cos(a) * d, ey = p.y + Math.sin(a) * d;
      const v = this.world.tile(Math.floor(ex), Math.floor(ey));
      if (tG(v) !== G.Water && !blocksMove(v) && castleR(ex, ey) > CASTLE_R + 6 && villageAt(ex, ey) < 0) {
        const kind = rollEnemyKind(Math.random());
        this.enemies.push({
          id: this.nextId++, kind, x: Math.floor(ex) + 0.5, y: Math.floor(ey) + 0.5, z: tH(v), hp: ENEMY_KINDS[kind].hp,
          aggro: false, atkCd: 1, hurtT: 0, kx: 0, ky: 0, wanderA: Math.random() * 7, wanderT: 0, hop: Math.random() * 6,
        });
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const k = ENEMY_KINDS[e.kind];
      const tg = this.nearest(e.x, e.y);
      const tx = tg ? tg.x : e.x + 999, ty = tg ? tg.y : e.y;
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
      if ((d > 75 && !e.ch && !e.minion) || fighting) {
        this.enemies.splice(i, 1);
        continue;
      }
      e.hurtT = Math.max(0, e.hurtT - dt);
      if (e.frozen) {
        // frozen solid by an ice arrow: no moving, no biting
        e.frozen = Math.max(0, e.frozen - dt);
        e.aggro = true;
        e.kx = e.ky = 0;
        continue;
      }
      e.atkCd -= dt;
      e.hop += dt * (e.aggro ? 9 : 5);
      if (d <= AGGRO && tg && !e.aggro) {
        e.aggro = true;
        if (!e.ch && tg.id === 'me') this.say(e.kind === 2 ? 'green' : e.kind === 1 ? 'blue' : 'watch', e.kind === 2 ? 'Whoa, a green Murk! Those are tough!' : e.kind === 1 ? 'A blue Murk! Careful!' : ['Watch out!', 'Murk coming!', 'Heads up, an enemy!'][Math.floor(Math.random() * 3)], e.kind ? 30 : 40);
      }
      if (!tg) e.aggro = false;
      let mx = 0, my = 0;
      if (e.aggro && d > 0.75) {
        mx = (dx / d) * k.speed * dt;
        my = (dy / d) * k.speed * dt;
      } else if (!e.aggro) {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = 1 + Math.random() * 3;
          e.wanderA = Math.random() < 0.4 ? NaN : Math.random() * Math.PI * 2;
        }
        if (!Number.isNaN(e.wanderA)) {
          mx = Math.cos(e.wanderA) * k.speed * 0.4 * dt;
          my = Math.sin(e.wanderA) * k.speed * 0.4 * dt;
        }
      }
      // knockback
      mx += e.kx * dt;
      my += e.ky * dt;
      e.kx *= Math.pow(0.002, dt);
      e.ky *= Math.pow(0.002, dt);
      const ox = e.x, oy = e.y;
      this.moveEnemy(e, mx, my);
      if (e.aggro && this.walls.length && Math.hypot(e.x - ox, e.y - oy) < Math.hypot(mx, my) * 0.3 && e.atkCd <= 0) {
        // a wall is in the way: chew on it
        const w = this.wallAt(Math.floor(e.x + Math.sign(mx) * 0.7), Math.floor(e.y)) ?? this.wallAt(Math.floor(e.x), Math.floor(e.y + Math.sign(my) * 0.7));
        if (w) {
          e.atkCd = 1.3;
          this.hurtWall(w, k.dmg);
        }
      }
      const gh = this.world.heightAt(e.x, e.y);
      e.z += (gh - e.z) * Math.min(1, dt * 12);
      if (tg && e.aggro && d < 0.95 && Math.abs(e.z - tg.z) < 1.3 && e.atkCd <= 0) {
        e.atkCd = 1.3;
        this.hurtTarget(tg.id, k.dmg, e.x, e.y);
      }
    }
  }

  private moveEnemy(e: Enemy, mx: number, my: number) {
    const ok = (nx: number, ny: number) => {
      const v = this.world.tile(Math.floor(nx), Math.floor(ny));
      if (blocksMove(v) || tG(v) === G.Water || castleR(nx, ny) <= CASTLE_R - 1 || villageAt(nx, ny) >= 0) return false;
      if (this.walls.length && this.wallAt(Math.floor(nx), Math.floor(ny))) return false;
      const th = tH(v);
      return th - e.z <= 1.05 && e.z - th <= 3;
    };
    if (ok(e.x + mx, e.y + my)) {
      e.x += mx;
      e.y += my;
    } else if (ok(e.x + mx, e.y)) e.x += mx;
    else if (ok(e.x, e.y + my)) e.y += my;
    else if (!e.aggro) e.wanderT = 0;
  }

  private updateArrows(dt: number) {
    for (let i = this.arrowsFlying.length - 1; i >= 0; i--) {
      const a = this.arrowsFlying[i];
      const step = 15 * dt;
      a.x += a.dx * step;
      a.y += a.dy * step;
      a.life -= dt;
      let dead = a.life <= 0;
      const v = this.world.tile(Math.floor(a.x), Math.floor(a.y));
      if (tH(v) > a.z || (blocksMove(v) && a.z < tH(v) + 2.5)) dead = true;
      if (!dead) {
        for (const e of this.enemies) {
          if (Math.hypot(e.x - a.x, e.y - a.y) < 0.6 && Math.abs(e.z + 0.5 - a.z) < 1.4) {
            if (a.ice) {
              e.frozen = 10;
              e.kx = e.ky = 0;
              this.puff(e.x, e.y, e.z + 0.6, '#bff1ff', 14, 2);
            }
            this.hurtEnemy(e, a.dmg, a.ice ? 0 : a.dx, a.ice ? 0 : a.dy, a.owner);
            dead = true;
            break;
          }
        }
      }
      if (!dead && this.coop) {
        // arrows hit other players too (not the one who shot it)
        const shooter = a.owner ?? 'me';
        for (const t of this.targets()) {
          if (t.id === shooter || Math.hypot(t.x - a.x, t.y - a.y) > 0.55 || Math.abs(t.z + 0.9 - a.z) > 1.4) continue;
          this.hurtTarget(t.id, 1, a.x - a.dx, a.y - a.dy);
          dead = true;
          break;
        }
      }
      const b = this.boss;
      if (!dead && b.active && !b.dead && this.beastBodies().some((q) => Math.hypot(q.x - a.x, q.y - a.y) < 1.4 * q.r)) {
        this.hurtBoss(a.dmg);
        dead = true;
      }
      if (!dead && this.minis.arrowHit(this, a.x, a.y, a.dmg)) dead = true;
      if (dead) this.arrowsFlying.splice(i, 1);
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    const p = this.p;
    if (b.dead) {
      b.deadT += dt;
      return;
    }
    b.hurtT = Math.max(0, b.hurtT - dt);
    // black and purple gas pours off the Dark Beast
    this.gasT -= dt;
    if (this.gasT <= 0 && Math.hypot(this.p.x - b.x, this.p.y - b.y) < 70) {
      this.gasT = 0.09;
      this.gas(b.x, b.y, FLOOR_H + 1.6);
    }
    for (const r of b.rings) r.t += dt;
    b.rings = b.rings.filter((r) => r.t < r.max);
    if (!b.active) return;
    // drift toward the nearest hero, keeping a little distance, staying in the room
    const tg = this.nearest(b.x, b.y) ?? { id: 'me', x: p.x, y: p.y, z: p.z, d: 99 };
    const dx = tg.x - b.x, dy = tg.y - b.y, d = Math.hypot(dx, dy) || 1;
    const hitAll = (r: number, q: number) => {
      for (const t of this.targets()) if (Math.hypot(t.x - b.x, t.y - b.y) < r) this.hurtTarget(t.id, q, b.x, b.y);
    };
    const want = b.state === 'idle' || b.state === 'recover' ? d - 1.9 : 0;
    const sp = (b.hp < 250 ? 1.9 : 1.4) * dt;
    if (Math.abs(want) > 0.2) {
      b.x += (dx / d) * Math.sign(want) * Math.min(sp, Math.abs(want));
      b.y += (dy / d) * Math.sign(want) * Math.min(sp, Math.abs(want));
    }
    const lim = ROOM_R - 1.4;
    b.x = Math.min(CX + 0.5 + lim, Math.max(CX + 0.5 - lim, b.x));
    b.y = Math.min(CY + 0.5 + lim, Math.max(CY + 0.5 - lim, b.y));

    b.t -= dt;
    if (b.state === 'idle') {
      b.next -= dt;
      const r = Math.random();
      if (b.next <= 0 && b.split <= 0 && ((b.splits === 0 && b.hp <= 350) || (b.splits === 1 && b.hp <= 150))) {
        // it splits into three for 40 seconds
        b.splits++;
        b.split = 40;
        b.clones = [-1, 1].map((s) => ({ x: b.x + s * 3, y: b.y + s * 1.5, cd: 1.5 + Math.random(), hurtT: 0, wind: 0 }));
        for (const c of b.clones) this.puff(c.x, c.y, FLOOR_H + 1.6, '#9b3ad6', 24, 4);
        sfx.beastBlast();
        this.shake = 14;
        this.toast('The Dark Beast splits into three!');
        this.say('split', 'Whoa, there are three of them now! Hit any of them. They join back together in 40 seconds.', 5);
        b.next = 2;
      } else if (b.next <= 0 && r < 0.18) {
        // gloom nova: a ring of orbs in every direction. Hide behind a barricade!
        b.state = 'nova';
        b.t = 1.1;
        b.rings.push({ x: b.x, y: b.y, r: 3, t: 0, max: 1.1, heavy: true });
        sfx.beastWind();
        this.say('nova', 'It is about to shoot everywhere! Hide behind a barricade!', 12);
      } else if (b.next <= 0 && r < 0.38) {
        // shadow dash: a warning line, then it rushes straight across the room
        const len = Math.min(16, d + 5), lim = ROOM_R - 1.4;
        const tx = Math.min(CX + 0.5 + lim, Math.max(CX + 0.5 - lim, b.x + (dx / d) * len));
        const ty = Math.min(CY + 0.5 + lim, Math.max(CY + 0.5 - lim, b.y + (dy / d) * len));
        b.state = 'dash';
        b.dash = { fx: b.x, fy: b.y, tx, ty, t: 0, warn: 0.85, hit: [] };
        sfx.orb();
        this.say('dash', 'It is going to charge! Get out of the line!', 12);
      } else if (b.next <= 0) {
        if (r < 0.6) {
          b.state = 'heavy';
          b.t = 2.4; // 4× as long as a normal attack
          b.rings.push({ x: b.x, y: b.y, r: 5, t: 0, max: 2.4, heavy: true });
          sfx.beastWind();
          this.say('heavy', "It's charging a big attack! Get away from it!", 15);
        } else {
          b.state = 'wind';
          b.t = 0.6;
          sfx.orb();
        }
      }
    } else if (b.state === 'wind' && b.t <= 0) {
      if (d < 3.2) {
        b.rings.push({ x: b.x, y: b.y, r: 2.4, t: 0, max: 0.35, heavy: false });
        sfx.slam();
        this.shake = 8;
        hitAll(2.4, 4);
      } else {
        const n = b.hp < 250 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = ang(dx, dy) + (i - (n - 1) / 2) * 0.35;
          b.orbs.push({ x: b.x, y: b.y, dx: Math.cos(a), dy: Math.sin(a), life: 3.5 });
        }
      }
      b.state = 'recover';
      b.t = 0.7;
    } else if (b.state === 'nova' && b.t <= 0) {
      const n = b.hp < 250 ? 20 : 14;
      const a0 = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        b.orbs.push({ x: b.x, y: b.y, dx: Math.cos(a), dy: Math.sin(a), life: 4.5 });
      }
      sfx.beastBlast();
      this.shake = 10;
      b.state = 'recover';
      b.t = 1;
    } else if (b.state === 'dash' && b.dash) {
      const D = b.dash;
      D.t += dt;
      if (D.t > D.warn) {
        const f = Math.min(1, (D.t - D.warn) / 0.5);
        b.x = D.fx + (D.tx - D.fx) * f;
        b.y = D.fy + (D.ty - D.fy) * f;
        if (Math.random() < 0.6) this.gas(b.x, b.y, FLOOR_H + 1.2);
        for (const t of this.targets()) {
          if (!D.hit.includes(t.id) && Math.hypot(t.x - b.x, t.y - b.y) < 1.6) {
            D.hit.push(t.id);
            this.hurtTarget(t.id, 4, b.x, b.y);
          }
        }
        if (f >= 1) {
          b.dash = null;
          b.state = 'recover';
          b.t = 0.9;
          sfx.slam();
          this.shake = 8;
        }
      }
    } else if (b.state === 'heavy' && b.t <= 0) {
      sfx.beastBlast();
      this.shake = 18;
      b.rings.push({ x: b.x, y: b.y, r: 5, t: 0, max: 0.5, heavy: false });
      hitAll(5, 6);
      for (const w of [...this.walls]) if (Math.hypot(w.x + 0.5 - b.x, w.y + 0.5 - b.y) < 5) this.hurtWall(w, 6);
      b.state = 'recover';
      b.t = 1;
    } else if (b.state === 'recover' && b.t <= 0) {
      b.state = 'idle';
      b.next = (b.hp < 250 ? 1.1 : 1.7) + Math.random() * 1.2;
    }
    for (let i = b.orbs.length - 1; i >= 0; i--) {
      const o = b.orbs[i];
      o.x += o.dx * 7 * dt;
      o.y += o.dy * 7 * dt;
      o.life -= dt;
      for (const t of this.targets()) {
        if (o.life > 0 && Math.hypot(o.x - t.x, o.y - t.y) < 0.65 && t.z < FLOOR_H + 1.8) {
          this.hurtTarget(t.id, 4, o.x, o.y);
          o.life = 0;
        }
      }
      const ow = this.walls.length ? this.wallAt(Math.floor(o.x), Math.floor(o.y)) : undefined;
      if (ow && o.life > 0) {
        this.hurtWall(ow, 4);
        o.life = 0;
      }
      // barricades stop orbs
      if (tH(this.world.tile(Math.floor(o.x), Math.floor(o.y))) > FLOOR_H + 0.5) {
        o.life = 0;
        this.puff(o.x, o.y, FLOOR_H + 1, '#9b3ad6', 5, 1.5);
      }
      if (o.life <= 0 || !inRoom(o.x, o.y)) b.orbs.splice(i, 1);
    }
    this.updateClones(dt);
  }

  /** The two extra copies while the Dark Beast is split. */
  private updateClones(dt: number) {
    const b = this.boss;
    if (b.split <= 0) return;
    b.split -= dt;
    if (b.split <= 0) {
      for (const c of b.clones) this.puff(c.x, c.y, FLOOR_H + 1.6, '#9b3ad6', 20, 3);
      b.clones = [];
      this.toast('The Dark Beast pulls itself back together');
      sfx.beastWind();
      return;
    }
    const lim = ROOM_R - 1.4;
    for (const c of b.clones) {
      c.hurtT = Math.max(0, c.hurtT - dt);
      const tg = this.nearest(c.x, c.y);
      if (!tg) continue;
      const dx = tg.x - c.x, dy = tg.y - c.y, d = Math.hypot(dx, dy) || 1;
      // copies keep a little apart from each other so they surround you
      let px = 0, py = 0;
      for (const o of [b, ...b.clones]) {
        if (o === c) continue;
        const ox = c.x - o.x, oy = c.y - o.y, od = Math.hypot(ox, oy);
        if (od < 4 && od > 0.01) { px += (ox / od) * (4 - od); py += (oy / od) * (4 - od); }
      }
      const want = d - 2.4;
      if (Math.abs(want) > 0.2) {
        c.x += (dx / d) * Math.sign(want) * Math.min(2.1 * dt, Math.abs(want));
        c.y += (dy / d) * Math.sign(want) * Math.min(2.1 * dt, Math.abs(want));
      }
      c.x += px * dt;
      c.y += py * dt;
      c.x = Math.min(CX + 0.5 + lim, Math.max(CX + 0.5 - lim, c.x));
      c.y = Math.min(CY + 0.5 + lim, Math.max(CY + 0.5 - lim, c.y));
      if (c.wind > 0) {
        c.wind -= dt;
        if (c.wind <= 0) {
          if (d < 3) {
            b.rings.push({ x: c.x, y: c.y, r: 2.2, t: 0, max: 0.35, heavy: false });
            sfx.slam();
            for (const t of this.targets()) if (Math.hypot(t.x - c.x, t.y - c.y) < 2.2) this.hurtTarget(t.id, 3, c.x, c.y);
          } else {
            const a = ang(dx, dy);
            b.orbs.push({ x: c.x, y: c.y, dx: Math.cos(a), dy: Math.sin(a), life: 3.5 });
            sfx.orb();
          }
        }
        continue;
      }
      c.cd -= dt;
      if (c.cd <= 0) {
        c.cd = 2 + Math.random() * 1.4;
        c.wind = 0.6;
      }
    }
  }

  /** Keep 25 chests hidden somewhere near the hero: on cliff tops and deep in forests. */
  private updateChests(dt: number) {
    const all = this.targets();
    const p = all.length ? all[Math.floor(Math.random() * all.length)] : this.p;
    this.chests = this.chests.filter((c) => (all.length ? all : [this.p]).some((t) => Math.hypot(c.x - t.x, c.y - t.y) < 340));
    this.chestCd -= dt;
    if (this.chests.length >= MAX_CHESTS + this.others.length * 5 || this.chestCd > 0) return;
    this.chestCd = 0.5;
    let best: Chest | null = null, bestScore = 0;
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 45 + Math.random() * 230;
      const x = Math.floor(p.x + Math.cos(a) * d), y = Math.floor(p.y + Math.sin(a) * d);
      if (castleR(x, y) < CASTLE_R + 6) continue;
      const v = this.world.tile(x, y);
      const g = tG(v);
      if (g === G.Water || g === G.Path || g === G.Bridge || tT(v) !== T.None) continue;
      const h = tH(v);
      let low = h, trees = 0;
      for (let j = -2; j <= 2; j++)
        for (let k = -2; k <= 2; k++) {
          const n = this.world.tile(x + k, y + j);
          low = Math.min(low, tH(n));
          if (blocksMove(n)) trees++;
        }
      const score = (h - low >= 3 ? 3 + (h - low) * 0.2 : 0) + (trees >= 9 ? 2.5 : trees >= 6 ? 1 : 0) + hash(x, y, 5) * 0.3;
      if (score > bestScore && !this.chests.some((c) => Math.abs(c.x - x) < 30 && Math.abs(c.y - y) < 30)) {
        bestScore = score;
        best = { x, y };
      }
    }
    if (best && bestScore >= 2) this.chests.push(best);
  }

  updateParticles(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.gas) {
        q.size += dt * 9;
        q.vx *= 0.98;
        q.vy *= 0.98;
      } else if (!q.text) q.vz -= 8 * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  // ---------- saving ----------

  toSave(): SaveData {
    const p = this.p;
    return {
      v: 1, id: this.id, name: p.name, outfit: p.outfit, owned: this.owned, seed: this.world.seed,
      x: p.x, y: p.y, z: p.z, hp: Math.max(1, p.hp), elapsed: this.elapsed, swords: this.swords, bows: this.bows,
      sword: this.sword, bow: this.bow, arrows: this.arrows, wood: this.wood, coins: this.coins, apples: this.apples,
      chopped: [...this.world.chopped].slice(-20000), fires: this.fires, spawn: this.spawn, chests: this.chests,
      won: this.won, savedAt: Date.now(), acorns: this.acorns, maxHp: this.maxHp, stones: [...this.stonesDone], job: this.job,
      jobVillage: this.jobVillage, farm: [...this.farm], letterTo: this.letterTo,
      minis: this.minis.defeated(), goods: this.goods, shelves: this.shelves,
      rocks: this.rocks, rockLevel: this.rockLevel, walls: this.walls, iceArrows: this.iceArrows,
    };
  }

  static fromSave(s: SaveData): Game {
    const g = new Game(s.name, s.seed, s.id);
    g.p.outfit = s.outfit;
    g.owned = s.owned;
    g.elapsed = s.elapsed;
    g.swords = s.swords;
    g.bows = s.bows;
    g.sword = Math.min(s.sword, s.swords.length - 1);
    g.bow = Math.min(s.bow, s.bows.length - 1);
    g.arrows = s.arrows;
    g.iceArrows = s.iceArrows ?? 0;
    g.wood = s.wood;
    g.coins = s.coins;
    g.apples = s.apples;
    g.world.chopped = new Set(s.chopped);
    g.fires = s.fires;
    g.spawn = s.spawn;
    g.chests = s.chests;
    g.won = s.won;
    g.p.hp = s.hp;
    g.acorns = s.acorns ?? 0;
    g.maxHp = s.maxHp ?? MAX_HP;
    g.stonesDone = new Set(s.stones ?? []);
    g.job = s.job ?? null;
    g.jobVillage = s.jobVillage ?? 0;
    g.farm = new Map(s.farm ?? []);
    g.letterTo = s.letterTo ?? null;
    if (g.jobVillage >= VILLAGES.length) g.jobVillage = 0;
    if (g.letterTo !== null && g.letterTo >= VILLAGES.length) g.letterTo = otherVillage(g.jobVillage);
    g.minis = new Minis(s.minis ?? []);
    if (s.goods) Object.assign(g.goods, s.goods);
    if (s.rocks) g.rocks = s.rocks;
    g.rockLevel = s.rockLevel ?? 0;
    g.walls = (s.walls ?? []).map((w) => ({ ...w, id: g.nextId++, hurtT: 0 }));
    if (s.shelves) Object.assign(g.shelves, s.shelves);
    // If saved inside the locked room, start just outside its door so the fight starts fresh.
    if (inRoom(s.x, s.y) && !s.won) {
      g.p.x = CX + 0.5;
      g.p.y = CY + ROOM_R + 5.5;
    } else {
      g.p.x = s.x;
      g.p.y = s.y;
    }
    g.p.z = g.world.heightAt(g.p.x, g.p.y);
    if (s.z > g.p.z) g.p.z = s.z;
    g.trader.x = g.p.x + 2;
    g.trader.y = g.p.y + 2;
    g.trader.z = g.world.heightAt(g.trader.x, g.trader.y);
    g.lastLand = { x: g.p.x, y: g.p.y };
    return g;
  }
}
