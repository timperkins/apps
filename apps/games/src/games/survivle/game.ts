// Survivle's game state and rules: the hero, cliffs and climbing, swords and bows, enemies, chests,
// campfires, traders and the Dark Beast. No drawing here.
import {
  ACORN_HEAL, BOSS_HP, CAMPFIRE_WOOD, CHALLENGES, CROP_TIME, ENEMY_KINDS, FOOD_HEAL, MAX_BOW, MAX_HP, MAX_HP_CAP, MAX_SWORD,
  MAX_UPGRADE, TIME_LIMIT, bowName, jobById, rollEnemyKind, swordName,
} from './data';
import { sfx } from './audio';
import { MINI_KINDS, Minis } from './minis';

const MINI_NAMES = MINI_KINDS.map((k) => k.name);
import {
  BOARD, CX, CY, FLOOR_H, WARPS, lairPad, G, OVEN, ROOM_R, SIZE, START_X, START_Y, T, VILLAGES, World,
  blocksMove, castleR, hash, inRoom, stoneIn, tG, tH, tT, villageAt,
} from './world';

export const GRAVITY = 32;
const JUMP_V = Math.sqrt(2 * GRAVITY * 2.4); // clears a 2-level step
const WALK = 4.6;
const CLIMB_SPEED = 1.6; // levels per second
const CLIMB_DRAIN = 0.12; // 12% of the stamina ring per second
const SAFE_FALL = 4; // levels you can drop without getting hurt
const AGGRO = 30; // tiles
const MAX_CHESTS = 10;

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
  state: 'idle' | 'wind' | 'heavy' | 'recover';
  t: number;
  next: number;
  hurtT: number;
  rings: { x: number; y: number; r: number; t: number; max: number; heavy: boolean }[];
  orbs: { x: number; y: number; dx: number; dy: number; life: number }[];
  dead: boolean;
  deadT: number;
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
  work: Work | null = null;
  onJobs: ((village: number) => void) | null = null;
  /** Narrator: say a line (key keeps it from repeating too often). */
  onSay: ((key: string, text: string, cooldown?: number) => void) | null = null;
  private seen = new Set<string>();
  private stoneCache: { x: number; y: number }[] = [];
  private stoneAt = { x: -1e9, y: -1e9 };
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
  won = false;
  lost = false;
  time = 0;
  toasts: { text: string; t: number }[] = [];
  /** Screen shake strength. */
  shake = 0;
  knockedOut = 0;
  onShop: (() => void) | null = null;
  private nextId = 1;
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

  private freshBoss(): Boss {
    return { x: CX + 0.5, y: CY + 0.5, hp: BOSS_HP, active: false, state: 'idle', t: 0, next: 2, hurtT: 0, rings: [], orbs: [], dead: false, deadT: 0 };
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

  /** Glowing challenge rocks near the hero. */
  stones(): { x: number; y: number }[] {
    const p = this.p;
    if (Math.abs(p.x - this.stoneAt.x) > 60 || Math.abs(p.y - this.stoneAt.y) > 60) {
      this.stoneAt = { x: p.x, y: p.y };
      const list: { x: number; y: number }[] = [];
      const rx = Math.floor(p.x / 250), ry = Math.floor(p.y / 250);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const t = stoneIn(rx + i, ry + j, this.world);
          if (t) list.push(t);
        }
      this.stoneCache = list;
    }
    return this.stoneCache;
  }

  stoneDone(st: { x: number; y: number }) {
    return this.stonesDone.has(`${st.x},${st.y}`);
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
    let hit = false;
    for (const e of this.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 1.8 && Math.abs(e.z - p.z) < 2 && (d < 0.5 || angDiff(ang(dx, dy), p.face) < 1.25)) {
        this.hurtEnemy(e, dmg, dx / (d || 1), dy / (d || 1));
        hit = true;
      }
    }
    const b = this.boss;
    if (b.active && !b.dead) {
      const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
      if (d < 3.1 && angDiff(ang(dx, dy), p.face) < 1.3) {
        this.hurtBoss(dmg);
        hit = true;
      }
    }
    if (this.minis.swordHit(this, dmg, (dx, dy) => angDiff(ang(dx, dy), p.face) < 1.3)) hit = true;
    if (hit) return;
    // chop a tree in front
    const fx = p.x + Math.cos(p.face) * 0.9, fy = p.y + Math.sin(p.face) * 0.9;
    const cands = [[Math.floor(fx), Math.floor(fy)], [Math.floor(p.x + Math.cos(p.face) * 0.5), Math.floor(p.y + Math.sin(p.face) * 0.5)]];
    for (const [tx, ty] of cands) {
      const v = this.world.tile(tx, ty);
      const t = tT(v);
      if (t === T.None) continue;
      if (Math.abs(tH(v) - p.z) > 1.5) continue;
      this.chopTree(tx, ty, t, tH(v));
      return;
    }
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
    if (this.arrows <= 0) {
      this.toast('Out of arrows! Buy more from a trader.');
      p.bowCd = 0.6;
      return;
    }
    const a = this.input.aimX || this.input.aimY ? ang(this.input.aimX, this.input.aimY) : p.face;
    p.face = a;
    p.bowCd = 0.5;
    this.arrows--;
    this.arrowsFlying.push({ x: p.x, y: p.y, z: p.z + 0.9, dx: Math.cos(a), dy: Math.sin(a), life: 1.8, dmg: this.bowDmg });
    sfx.bow();
  }

  /** Open a chest or talk to a trader if one is close. */
  interact() {
    const p = this.p;
    for (let i = 0; i < this.chests.length; i++) {
      const c = this.chests[i];
      if (Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - p.y) < 1.6 && Math.abs(this.world.heightAt(c.x, c.y) - p.z) < 1.5) {
        this.chests.splice(i, 1);
        this.openChest(c);
        return;
      }
    }
    for (const st of this.stones()) {
      if (this.nearTile(st.x, st.y, 2.6)) {
        if (this.stoneDone(st)) return this.toast('You already beat this rock\'s challenge');
        if (this.challenge) return;
        this.startChallenge(st);
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
      if (this.job === 'farmer') {
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
            this.coins += 3;
            sfx.coin();
            this.float(p.x, p.y, p.z, '+3 coins', '#ffd34d');
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
    if (this.job === 'miner') {
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          if (tG(this.world.tile(Math.floor(p.x) + i, Math.floor(p.y) + j)) === G.Rock) {
            this.startWork('Mining', 2.5, () => {
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
    this.letterTo = id === 'courier' ? 1 - village : null;
    const j = jobById(id);
    this.toast(`You're a ${j?.name} now!`);
    if (id === 'courier') this.say('courier', `Take this letter to ${VILLAGES[1 - village].name}. Follow the yellow arrow!`, 5);
    else this.say('job', `Good luck with your new job!`, 5);
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

  private startChallenge(st: { x: number; y: number }) {
    const c = CHALLENGES[Math.floor(hash(st.x, st.y, this.world.seed + 77) * CHALLENGES.length)];
    this.challenge = { key: `${st.x},${st.y}`, x: st.x + 0.5, y: st.y + 0.5, name: c.name };
    this.enemies = this.enemies.filter((e) => e.aggro);
    c.kinds.forEach((kind, i) => {
      const a = (i / c.kinds.length) * Math.PI * 2;
      let ex = st.x + 0.5 + Math.cos(a) * 6, ey = st.y + 0.5 + Math.sin(a) * 6;
      const v = this.world.tile(Math.floor(ex), Math.floor(ey));
      if (tG(v) === G.Water || blocksMove(v)) {
        ex = st.x + 0.5 + Math.cos(a) * 2;
        ey = st.y + 0.5 + Math.sin(a) * 2;
      }
      this.enemies.push({
        id: this.nextId++, kind, x: ex, y: ey, z: this.world.heightAt(ex, ey), hp: ENEMY_KINDS[kind].hp, aggro: true, atkCd: 1.5,
        hurtT: 0, kx: 0, ky: 0, wanderA: 0, wanderT: 0, hop: Math.random() * 6, ch: true,
      });
      this.puff(ex, ey, this.world.heightAt(ex, ey), '#5ad0ff', 12, 2);
    });
    this.shake = 8;
    sfx.door();
    this.toast(`Challenge: ${c.name}! Win for a permanent quarter heart.`);
    this.say('challenge', 'Here they come! Beat them all!', 10);
  }

  private updateChallenge() {
    const c = this.challenge;
    if (!c) return;
    const left = this.enemies.filter((e) => e.ch).length;
    const far = Math.hypot(this.p.x - c.x, this.p.y - c.y) > 45;
    if (this.knockedOut || far) {
      this.enemies = this.enemies.filter((e) => !e.ch);
      this.challenge = null;
      this.toast('Challenge failed. Try the rock again!');
      return;
    }
    if (left === 0) {
      this.stonesDone.add(c.key);
      this.challenge = null;
      if (this.maxHp < MAX_HP_CAP) {
        this.maxHp++;
        this.toast(`Challenge won! +¼ heart forever (${this.maxHp / 4} hearts)`);
      } else this.toast('Challenge won! You already have the most hearts (20).');
      this.p.hp = this.maxHp;
      sfx.chest();
      this.puff(c.x, c.y, this.world.heightAt(c.x, c.y) + 1, '#5ad0ff', 30, 3);
      this.say('chwin', 'You won! You got stronger!', 20);
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
      if (this.job === 'farmer' && tG(this.world.tile(Math.floor(p.x), Math.floor(p.y))) === G.Farm) {
        const pl = this.farm.get(Math.floor(p.x) * SIZE + Math.floor(p.y));
        return pl === undefined ? 'Plant' : this.elapsed - pl >= CROP_TIME ? 'Harvest' : null;
      }
    }
    if (this.job === 'fisher' || this.job === 'miner') {
      const want = this.job === 'fisher' ? G.Water : G.Rock;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          if (tG(this.world.tile(Math.floor(p.x) + i, Math.floor(p.y) + j)) === want && !p.inWater) return this.job === 'fisher' ? 'Fish' : 'Mine';
    }
    for (const t of this.traders()) if (Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.y) < 2.2) return 'Trade';
    return null;
  }

  private openChest(c: Chest) {
    sfx.chest();
    this.chestCd = 15;
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

  private hurtEnemy(e: Enemy, dmg: number, nx: number, ny: number) {
    e.hp -= dmg;
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
      this.coins += k.coins;
      this.float(e.x, e.y, e.z + 0.5, `+${k.coins} coin${k.coins > 1 ? 's' : ''}`, '#ffd34d');
      if (Math.random() < 0.3) this.arrows += 2;
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

  private hurtBoss(dmg: number) {
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
      this.won = true;
      this.world.sealed = false;
      sfx.win();
      this.toast('The Dark Beast is defeated!');
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
    this.updateTrader(dt);
    this.updateEnemies(dt);
    this.updateChallenge();
    this.minis.update(this, dt);
    this.updateNarrator();
    this.updateArrows(dt);
    this.updateBoss(dt);
    this.updateChests(dt);
    this.updateParticles(dt);
    this.world.prune(Math.floor(this.p.x), Math.floor(this.p.y));
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
        t.y = CY + 15.5;
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
          this.toast('Letter delivered! +15 coins. Here is one for the other village.');
          this.letterTo = 1 - vi;
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
    this.enemies = [];
    this.arrowsFlying = [];
    this.work = null;
    if (this.boss.active && !this.boss.dead) {
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
    if (!this.boss.active && !this.boss.dead && inRoom(p.x, p.y) && p.onGround && p.z <= FLOOR_H + 0.5) {
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
    const p = this.p;
    const fighting = this.boss.active && !this.boss.dead;
    // spawn around the hero, but never in the castle
    this.spawnCd -= dt;
    if (!fighting && !this.challenge && this.spawnCd <= 0 && this.enemies.length < 8 && castleR(p.x, p.y) > 60 && villageAt(p.x, p.y) < 0) {
      this.spawnCd = 2.5;
      const a = Math.random() * Math.PI * 2;
      const d = 34 + Math.random() * 14;
      const ex = p.x + Math.cos(a) * d, ey = p.y + Math.sin(a) * d;
      const v = this.world.tile(Math.floor(ex), Math.floor(ey));
      if (tG(v) !== G.Water && !blocksMove(v) && castleR(ex, ey) > 40 && villageAt(ex, ey) < 0) {
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
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if ((d > 75 && !e.ch && !e.minion) || fighting) {
        this.enemies.splice(i, 1);
        continue;
      }
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.atkCd -= dt;
      e.hop += dt * (e.aggro ? 9 : 5);
      if (d <= AGGRO && !this.knockedOut && !e.aggro) {
        e.aggro = true;
        if (!e.ch) this.say(e.kind === 2 ? 'green' : e.kind === 1 ? 'blue' : 'watch', e.kind === 2 ? 'Whoa, a green Murk! Those are tough!' : e.kind === 1 ? 'A blue Murk! Careful!' : ['Watch out!', 'Murk coming!', 'Heads up, an enemy!'][Math.floor(Math.random() * 3)], e.kind ? 30 : 40);
      }
      if (this.knockedOut) e.aggro = false;
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
      this.moveEnemy(e, mx, my);
      const gh = this.world.heightAt(e.x, e.y);
      e.z += (gh - e.z) * Math.min(1, dt * 12);
      if (e.aggro && d < 0.95 && Math.abs(e.z - p.z) < 1.3 && e.atkCd <= 0) {
        e.atkCd = 1.3;
        this.hurtPlayer(k.dmg, e.x, e.y);
      }
    }
  }

  private moveEnemy(e: Enemy, mx: number, my: number) {
    const ok = (nx: number, ny: number) => {
      const v = this.world.tile(Math.floor(nx), Math.floor(ny));
      if (blocksMove(v) || tG(v) === G.Water || castleR(nx, ny) <= 33 || villageAt(nx, ny) >= 0) return false;
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
            this.hurtEnemy(e, a.dmg, a.dx, a.dy);
            dead = true;
            break;
          }
        }
      }
      const b = this.boss;
      if (!dead && b.active && !b.dead && Math.hypot(b.x - a.x, b.y - a.y) < 1.4) {
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
    // drift toward the hero, keeping a little distance, staying in the room
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
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
      if (b.next <= 0) {
        if (Math.random() < 0.3) {
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
        if (d < 2.4) this.hurtPlayer(4, b.x, b.y);
      } else {
        const n = b.hp < 250 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = ang(dx, dy) + (i - (n - 1) / 2) * 0.35;
          b.orbs.push({ x: b.x, y: b.y, dx: Math.cos(a), dy: Math.sin(a), life: 3.5 });
        }
      }
      b.state = 'recover';
      b.t = 0.7;
    } else if (b.state === 'heavy' && b.t <= 0) {
      sfx.beastBlast();
      this.shake = 18;
      b.rings.push({ x: b.x, y: b.y, r: 5, t: 0, max: 0.5, heavy: false });
      if (d <= 5) this.hurtPlayer(6, b.x, b.y);
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
      if (Math.hypot(o.x - p.x, o.y - p.y) < 0.65 && p.z < FLOOR_H + 1.8) {
        this.hurtPlayer(4, o.x, o.y);
        o.life = 0;
      }
      if (o.life <= 0 || !inRoom(o.x, o.y)) b.orbs.splice(i, 1);
    }
  }

  /** Keep 10 chests hidden somewhere near the hero: on cliff tops and deep in forests. */
  private updateChests(dt: number) {
    const p = this.p;
    this.chests = this.chests.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 340);
    this.chestCd -= dt;
    if (this.chests.length >= MAX_CHESTS || this.chestCd > 0) return;
    this.chestCd = 0.5;
    let best: Chest | null = null, bestScore = 0;
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 45 + Math.random() * 230;
      const x = Math.floor(p.x + Math.cos(a) * d), y = Math.floor(p.y + Math.sin(a) * d);
      if (castleR(x, y) < 40) continue;
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
      minis: this.minis.defeated(),
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
    g.minis = new Minis(s.minis ?? []);
    // If saved inside the locked room, start just outside its door so the fight starts fresh.
    if (inRoom(s.x, s.y) && !s.won) {
      g.p.x = CX + 0.5;
      g.p.y = CY + 15.5;
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
