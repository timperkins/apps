// Archenimys simulation. The host's copy is the real one: it runs monsters, shots, damage, stages,
// chests and level-ups. Each player moves their own body (moveSelf) and sends where they are,
// so movement feels instant on every screen.
import {
  ARCHER, BOSSES, BOSS_ORDER, DMG, ENCHANTS, ENCHANT_IDS, H, MONSTERS, MONSTER_KINDS, PLAYER_MONSTER_HP, PLAYER_MONSTER_SPEED, STAGES, W, WORLDS,
  bossFor, dmgScale as dmgScaleW, hpScale as hpScaleW, isBossStage, isChestStage, isMythicStage, rollOffers, upValue, xpNeed,
  type BossKind, type Enchant, type MonsterKind, type Offer, type UpId,
} from './data';

// the current world is part of how hard everything is
let curWorld = 1;
const hpScale = (stage: number) => hpScaleW(stage, curWorld);
const dmgScale = (stage: number) => dmgScaleW(stage, curWorld);

export type Role = 'archer' | 'monster';

export interface Player {
  id: string;
  name: string;
  slot: number;
  role: Role | null;
  kind: MonsterKind;
  x: number;
  y: number;
  aim: number;
  moving: boolean;
  hp: number;
  maxHp: number;
  dead: boolean;
  respawnT: number;
  /** bumps when the host moves you (new stage, respawn) so your own screen jumps there too */
  tp: number;
  level: number;
  xp: number;
  ups: Partial<Record<UpId, number>>;
  /** the 3 upgrade cards on screen, or null */
  offers: Offer[] | null;
  offerLucky: boolean;
  offerMyth: boolean;
  /** level-ups and chests still waiting to be shown */
  queue: ('lvl' | 'loot' | 'myth')[];
  healChoice: boolean;
  opened: number[];
  fireCd: number;
  hurtCd: number;
  hurtT: number;
  fuse: number; // boom pot players: seconds until the boom (0 = not lit)
  switchCd: number;
  slowT: number;
  kills: number;
  weapon: 'bow' | 'sword';
  /** shield energy 0..100; holding block takes 95% less damage */
  shield: number;
  blocking: boolean;
  shieldBroken: boolean;
  swingT: number;
  shotN: number;
  rainT: number;
  // how fast they're going (for the Sharp Crab's aim)
  vx: number;
  vy: number;
  lx: number;
  ly: number;
}

export interface Wolf { id: number; owner: string; power: number; x: number; y: number; face: number; cd: number; moving: boolean; biteT: number }

export interface Enemy {
  id: number;
  kind: MonsterKind;
  boss: BossKind | null;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  /** 0 walk, 1 winding up, 2 dashing */
  state: number;
  t: number; // time in this state
  cd: number; // until the next attack
  cd2: number; // bosses: until the next summon or special
  dx: number;
  dy: number;
  side: number;
  fuse: number;
  slowT: number;
  slowPct: number;
  burnT: number;
  burnDps: number;
  burnBy: string;
  hurtT: number;
  hitOnce: number;
  face: number;
  pattern: number;
  ench: Enchant | '';
  /** the Enchanter's last spell, told to archers who come close */
  said: string;
}

export interface Shot {
  id: number;
  kind: 'arrow' | 'thorn' | 'glob';
  team: 'a' | 'm'; // archers' shots hit monsters, monsters' shots hit archers
  owner: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  pierce: number;
  bounce: number;
  crit: boolean;
  hit: number[];
  child?: boolean;
  // globs fly in an arc from (sx, sy) to (tx, ty)
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
}

export interface Splotch { id: number; x: number; y: number; r: number; t: number; team: 'a' | 'm' }
export interface Chest { id: number; kind: 'loot' | 'health' | 'mythic'; x: number; y: number }
export interface Pillar { x: number; y: number; r: number }
/** things that happened this tick, for sounds and sparkles (sent to friends too) */
export interface Fx { k: string; x: number; y: number; v?: number; c?: string; r?: number; who?: string; x2?: number; y2?: number }

export interface State {
  phase: 'lobby' | 'play' | 'over' | 'won';
  world: number;
  stage: number;
  /** stage 50: 1 = every boss at once, 2 = the boss with all their moves */
  finale: number;
  wolves: Wolf[];
  cleared: boolean;
  stairsT: number; // countdown once an archer is on the stairs (-1 = nobody)
  bannerT: number;
  players: Player[];
  enemies: Enemy[];
  shots: Shot[];
  splotches: Splotch[];
  chests: Chest[];
  pillars: Pillar[];
  spawnLeft: number;
  spawnT: number;
  time: number;
  nextId: number;
  bossId: number;
}

export interface Input {
  fire: boolean;
  aim: number;
  block?: boolean;
}

export type Act =
  | { t: 'role'; role: Role; kind?: MonsterKind }
  | { t: 'pick'; i: number }
  | { t: 'heal'; opt: 0 | 1 }
  | { t: 'switch'; kind?: MonsterKind }
  | { t: 'weapon'; w?: 'bow' | 'sword' };

export const STAIRS = { x: W / 2, y: 40, w: 96, h: 40 };
export const WALL = 26;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export function newState(): State {
  return {
    phase: 'lobby', world: 1, stage: 1, finale: 0, wolves: [], cleared: false, stairsT: -1, bannerT: 0,
    players: [], enemies: [], shots: [], splotches: [], chests: [], pillars: [],
    spawnLeft: 0, spawnT: 0, time: 0, nextId: 1, bossId: 0,
  };
}

export function newPlayer(id: string, name: string, slot: number): Player {
  return {
    id, name, slot, role: null, kind: 'crab', x: W / 2, y: H - 80, aim: -Math.PI / 2, moving: false,
    hp: ARCHER.hp, maxHp: ARCHER.hp, dead: false, respawnT: 0, tp: 0,
    level: 1, xp: 0, ups: {}, offers: null, offerLucky: false, offerMyth: false, queue: [], healChoice: false, opened: [],
    fireCd: 0, hurtCd: 0, hurtT: 0, fuse: 0, switchCd: 0, slowT: 0, kills: 0,
    weapon: 'bow', shield: 100, blocking: false, shieldBroken: false, swingT: 0, shotN: 0, rainT: 3, vx: 0, vy: 0, lx: W / 2, ly: H - 80,
  };
}

// ---------- archer stats from upgrades ----------

export const up = (p: Player, u: UpId) => p.ups[u] ?? 0;
export function archerStats(p: Player) {
  return {
    dmg: ARCHER.dmg * (1 + up(p, 'sharp') / 100),
    fireEvery: ARCHER.fireEvery / (1 + up(p, 'quick') / 100),
    speed: ARCHER.speed * (1 + up(p, 'boots') / 100),
    arrowSpeed: ARCHER.arrowSpeed * (1 + up(p, 'long') / 100),
    range: ARCHER.range * (1 + up(p, 'long') / 100),
    guard: Math.min(0.7, up(p, 'guard') / 100),
    crit: up(p, 'crit') / 100,
  };
}

export function playerSpeed(p: Player) {
  const base = p.role === 'archer' ? archerStats(p).speed : PLAYER_MONSTER_SPEED[p.kind];
  return base * (p.slowT > 0 ? 0.6 : 1) * (p.fuse > 0 ? 0.5 : 1) * (p.blocking ? 0.55 : 1);
}
export const playerR = (p: Player) => (p.role === 'archer' ? ARCHER.r : MONSTERS[p.kind].r + 3);
/** can this player be hurt and act right now? */
export const choosing = (p: Player) => !!p.offers || p.healChoice;

/** walls and pillars push circles out */
export function collide(s: State, o: { x: number; y: number }, r: number) {
  o.x = Math.max(WALL + r, Math.min(W - WALL - r, o.x));
  o.y = Math.max(WALL + r, Math.min(H - WALL - r, o.y));
  for (const pl of s.pillars) {
    const d = dist(o.x, o.y, pl.x, pl.y);
    const min = pl.r + r;
    if (d < min && d > 0.001) {
      o.x = pl.x + ((o.x - pl.x) / d) * min;
      o.y = pl.y + ((o.y - pl.y) / d) * min;
    }
  }
}

/** a player moves their own body (run on their own screen) */
export function moveSelf(s: State, p: Player, mx: number, my: number, dt: number) {
  if (p.dead || !p.role || s.phase !== 'play') {
    p.moving = false;
    return;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  p.moving = len > 0.1;
  const sp = playerSpeed(p);
  p.x += mx * sp * dt;
  p.y += my * sp * dt;
  collide(s, p, playerR(p));
}

// ---------- the game ----------

export class Game {
  s: State = newState();
  inputs = new Map<string, Input>();
  fx: Fx[] = [];
  /** called when a stage starts (for the host list and the banner) */
  onStage: (stage: number) => void = () => {};

  private id() {
    return this.s.nextId++;
  }
  private emit(f: Fx) {
    this.fx.push(f);
  }
  player(id: string) {
    return this.s.players.find((p) => p.id === id);
  }
  archers(alive = true) {
    return this.s.players.filter((p) => p.role === 'archer' && (!alive || !p.dead));
  }

  addPlayer(id: string, name: string) {
    const used = new Set(this.s.players.map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const p = newPlayer(id, name, slot);
    this.s.players.push(p);
    return p;
  }
  removePlayer(id: string) {
    this.s.players = this.s.players.filter((p) => p.id !== id);
    this.inputs.delete(id);
    if (this.s.phase === 'play' && !this.archers().length && !this.archers(false).length && this.s.players.length) {
      // nobody left climbing
      this.s.phase = 'over';
    }
  }

  start() {
    this.s.stage = 0;
    this.s.phase = 'play';
    for (const p of this.s.players) if (!p.role) p.role = 'archer';
    this.nextStage();
  }

  act(id: string, a: Act) {
    const p = this.player(id);
    if (!p) return;
    if (a.t === 'role') {
      p.role = a.role;
      if (a.kind) p.kind = a.kind;
      p.offers = null;
      p.queue = [];
      p.healChoice = false;
      p.fuse = 0;
      if (a.role === 'archer') {
        p.maxHp = ARCHER.hp + up(p, 'tough');
        p.hp = p.maxHp;
        p.x = W / 2 + (p.slot - 1.5) * 40;
        p.y = H - 70;
      } else {
        this.spawnMonsterPlayer(p, a.kind ?? p.kind);
      }
      p.dead = false;
      p.blocking = false;
      p.tp++;
    } else if (a.t === 'weapon') {
      if (p.role !== 'archer') return;
      p.weapon = a.w ?? (p.weapon === 'bow' ? 'sword' : 'bow');
      p.fireCd = 0.2;
    } else if (a.t === 'pick') {
      if (!p.offers) return;
      const o = p.offers[a.i];
      if (!o) return;
      this.applyUpgrade(p, o);
      p.offers = null;
      this.nextOffer(p);
    } else if (a.t === 'heal') {
      if (!p.healChoice) return;
      if (a.opt === 0) p.hp = p.maxHp;
      else {
        p.maxHp += 25;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp / 2);
      }
      p.healChoice = false;
      this.emit({ k: 'heal', x: p.x, y: p.y });
    } else if (a.t === 'switch') {
      if (p.role !== 'monster' || p.dead || p.switchCd > 0) return;
      const next = a.kind && a.kind !== p.kind ? a.kind : MONSTER_KINDS[(MONSTER_KINDS.indexOf(p.kind) + 1) % MONSTER_KINDS.length];
      const frac = p.hp / p.maxHp;
      p.kind = next;
      p.maxHp = Math.round(PLAYER_MONSTER_HP[next] * hpScale(this.s.stage) ** 0.5);
      p.hp = Math.max(1, Math.round(p.maxHp * frac));
      p.fuse = 0;
      p.switchCd = 3;
      this.emit({ k: 'poof', x: p.x, y: p.y });
    }
  }

  private applyUpgrade(p: Player, o: Offer) {
    const v = upValue(o);
    p.ups[o.up] = Math.round(((p.ups[o.up] ?? 0) + v) * 100) / 100;
    if (o.up === 'tough') {
      p.maxHp += v;
      p.hp += v;
    }
    if (o.up === 'bone') {
      // a new wolf for every Tasty Bone
      this.s.wolves.push({ id: this.id(), owner: p.id, power: v, x: p.x + 20, y: p.y, face: 0, cd: 0, moving: false, biteT: 0 });
    }
    this.emit({ k: 'upgrade', x: p.x, y: p.y, v: o.q });
  }

  private nextOffer(p: Player) {
    if (p.offers || !p.queue.length) return;
    const what = p.queue.shift()!;
    p.offerLucky = what === 'loot';
    p.offerMyth = what === 'myth';
    p.offers = rollOffers(this.s.stage, p.offerLucky, this.s.world, p.offerMyth);
  }

  private spawnMonsterPlayer(p: Player, kind: MonsterKind) {
    p.kind = kind;
    p.maxHp = Math.round(PLAYER_MONSTER_HP[kind] * hpScale(this.s.stage) ** 0.5);
    p.hp = p.maxHp;
    p.fuse = 0;
    // somewhere away from the archers
    const r = rng(Date.now() ^ (p.slot * 99));
    let best = { x: W / 2, y: 120 }, bestD = -1;
    for (let i = 0; i < 12; i++) {
      const c = { x: 80 + r() * (W - 160), y: 90 + r() * (H * 0.45) };
      collide(this.s, c, 20);
      const d = Math.min(...this.archers().map((a) => dist(a.x, a.y, c.x, c.y)), 9999);
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    p.x = best.x;
    p.y = best.y;
    p.tp++;
  }

  // ---------- stages ----------

  nextStage() {
    const s = this.s;
    s.stage++;
    if (s.stage > STAGES) {
      if (s.world >= WORLDS) {
        s.stage = STAGES;
        s.phase = 'won';
        this.emit({ k: 'win', x: W / 2, y: H / 2 });
        return;
      }
      // the top of the tower opens onto a new map: 50 more stages, a lot harder
      s.world++;
      s.stage = 1;
      this.emit({ k: 'world', x: W / 2, y: H / 2, v: s.world });
    }
    curWorld = s.world;
    s.finale = 0;
    s.cleared = false;
    s.stairsT = -1;
    s.bannerT = 2.5;
    s.enemies = [];
    s.shots = [];
    s.splotches = [];
    s.chests = [];
    s.bossId = 0;
    // pillars: a few, never near the stairs or the archers' start
    const r = rng(s.stage * 7919 + 13 + s.world * 104729);
    s.pillars = [];
    const n = isBossStage(s.stage) ? 2 : 2 + Math.floor(r() * 4);
    for (let i = 0; i < n * 4 && s.pillars.length < n; i++) {
      const pl = { x: 110 + r() * (W - 220), y: 130 + r() * (H - 300), r: 20 + r() * 16 };
      if (dist(pl.x, pl.y, W / 2, H / 2) < 70 && isBossStage(s.stage)) continue;
      if (s.pillars.some((q) => dist(q.x, q.y, pl.x, pl.y) < q.r + pl.r + 70)) continue;
      s.pillars.push(pl);
    }
    const archers = this.archers(false);
    archers.forEach((p, i) => {
      p.x = W / 2 + (i - (archers.length - 1) / 2) * 44;
      p.y = H - 70;
      p.tp++;
      p.opened = [];
      if (p.dead) {
        p.dead = false;
        p.hp = Math.round(p.maxHp / 2);
        p.offers = null;
      }
    });
    for (const w of s.wolves) {
      const o = this.player(w.owner);
      if (o) {
        w.x = o.x + 30;
        w.y = o.y - 10;
      }
    }
    for (const p of s.players) if (p.role === 'monster') {
      if (p.dead) {
        p.dead = false;
        p.respawnT = 0;
      }
      this.spawnMonsterPlayer(p, p.kind);
    }
    const team = Math.max(1, archers.length);
    if (s.stage === STAGES) {
      // the top: every boss at once
      s.spawnLeft = 0;
      s.finale = 1;
      BOSS_ORDER.forEach((k, i) => {
        const b = this.spawnBoss(k, team, 0.55);
        b.x = 180 + i * ((W - 360) / 3);
        b.y = 140 + (i % 2) * 60;
        b.cd = 2 + i * 0.7;
      });
    } else if (isBossStage(s.stage)) {
      s.spawnLeft = 0;
      const b = this.spawnBoss(bossFor(s.stage), team);
      s.bossId = b.id;
    } else {
      // World 2 sends twice as many monsters
      const many = (5 + s.stage * 1.1) * (1 + 0.45 * (team - 1)) * (s.world > 1 ? 2 : 1);
      s.spawnLeft = Math.min(s.world > 1 ? 90 : 48, Math.round(many));
      s.spawnT = 1.2;
    }
    this.emit({ k: 'stage', x: W / 2, y: H / 2, v: s.stage });
    this.onStage(s.stage);
  }

  private pickKind(r: () => number): MonsterKind {
    const st = this.s.stage;
    const pool: [MonsterKind, number][] = [['pot', 30], ['crab', 28], ['cactus', 20], ['stew', 20], ['sharpCrab', 18], ['enchanter', 7]];
    const ok = pool.filter(([k]) => this.s.world > 1 || MONSTERS[k].firstStage <= st);
    const total = ok.reduce((a, [, w]) => a + w, 0);
    let x = r() * total;
    for (const [k, w] of ok) {
      if ((x -= w) < 0) return k;
    }
    return 'crab';
  }

  private makeEnemy(kind: MonsterKind, x: number, y: number, boss: BossKind | null = null, hpMul = 1): Enemy {
    const def = MONSTERS[kind];
    const bd = boss ? BOSSES[boss] : null;
    const hp = Math.round((bd ? bd.hp : def.hp) * hpScale(this.s.stage) * hpMul);
    return {
      id: this.id(), kind, boss, x, y, hp, maxHp: hp, r: bd ? bd.r : def.r, speed: (bd ? bd.speed : def.speed) * (1 + this.s.stage * 0.004),
      state: 0, t: 0, cd: 1 + Math.random() * 1.5, cd2: 5, dx: 0, dy: 0, side: Math.random() < 0.5 ? 1 : -1, fuse: 0,
      slowT: 0, slowPct: 0, burnT: 0, burnDps: 0, burnBy: '', hurtT: 0, hitOnce: 0, face: 0, pattern: 0, ench: '', said: '',
    };
  }

  private spawnBoss(kind: BossKind, team: number, hpMul = 1) {
    const b = this.makeEnemy(BOSSES[kind].look, W / 2, 150, kind, (1 + 0.6 * (team - 1)) * hpMul);
    b.cd = 2;
    b.cd2 = 6;
    this.s.enemies.push(b);
    return b;
  }

  private spawnEnemy(kind?: MonsterKind, at?: { x: number; y: number }) {
    const r = Math.random;
    let x = 0, y = 0;
    if (at) {
      x = at.x;
      y = at.y;
    } else {
      // from the top and the sides, away from archers
      for (let i = 0; i < 8; i++) {
        const side = Math.floor(r() * 3);
        if (side === 0) {
          x = 60 + r() * (W - 120);
          y = 60;
        } else {
          x = side === 1 ? 50 : W - 50;
          y = 60 + r() * (H * 0.55);
        }
        if (this.archers().every((a) => dist(a.x, a.y, x, y) > 200)) break;
      }
    }
    const e = this.makeEnemy(kind ?? this.pickKind(r), x, y);
    collide(this.s, e, e.r);
    this.s.enemies.push(e);
    this.emit({ k: 'spawn', x: e.x, y: e.y });
    return e;
  }

  // ---------- damage ----------

  /** hurt a player (archer or monster player). Returns true if it landed. */
  hurtPlayer(p: Player, dmg: number, by: string, dot = false): boolean {
    if (p.dead || !p.role || this.s.phase !== 'play') return false;
    if (choosing(p)) return false; // no damage while picking an upgrade or a chest choice
    if (!dot && p.hurtCd > 0) return false;
    if (p.role === 'archer') dmg *= 1 - archerStats(p).guard;
    // the shield blocks 95% of the damage
    if (p.blocking && p.shield > 0) {
      dmg *= 0.05;
      if (!dot) this.emit({ k: 'block', x: p.x, y: p.y });
    }
    p.hp -= dmg;
    p.hurtT = 0.18;
    if (!dot) {
      p.hurtCd = 0.3;
      this.emit({ k: 'hurt', x: p.x, y: p.y, v: Math.round(dmg), who: p.id });
    }
    if (p.hp <= 0) this.killPlayer(p, by);
    return true;
  }

  private killPlayer(p: Player, by: string) {
    if (p.role === 'archer' && up(p, 'phoenix') >= 1) {
      p.ups.phoenix = up(p, 'phoenix') - 1;
      p.hp = p.maxHp;
      p.hurtCd = 1.5;
      this.emit({ k: 'phoenix', x: p.x, y: p.y });
      return;
    }
    p.hp = 0;
    p.dead = true;
    p.fuse = 0;
    p.offers = null;
    this.emit({ k: 'die', x: p.x, y: p.y, who: p.id, c: p.role ?? '' });
    if (p.role === 'monster') {
      p.respawnT = 5;
      // archers get the xp for knocking out a monster player
      this.giveXp(MONSTERS[p.kind].xp * 2);
      const k = this.player(by);
      if (k?.role === 'archer') this.lifesteal(k);
      if (p.kind === 'pot') this.explode(p.x, p.y, DMG.boomR, DMG.boom * dmgScale(this.s.stage), 'm', p.id);
    } else if (!this.archers().length) {
      this.s.phase = 'over';
      this.emit({ k: 'over', x: W / 2, y: H / 2 });
    }
  }

  private lifesteal(p: Player) {
    const v = up(p, 'lifesteal');
    if (v > 0 && !p.dead) p.hp = Math.min(p.maxHp, p.hp + v);
  }

  private giveXp(n: number) {
    for (const p of this.archers(false)) {
      p.xp += n * (1 + up(p, 'golden') / 100);
      let need = xpNeed(p.level);
      while (p.xp >= need) {
        p.xp -= need;
        p.level++;
        p.queue.push('lvl');
        need = xpNeed(p.level);
        this.emit({ k: 'level', x: p.x, y: p.y, who: p.id });
      }
      this.nextOffer(p);
    }
  }

  hurtEnemy(e: Enemy, dmg: number, by: string, crit = false) {
    if (e.hp <= 0) return;
    if (e.ench === 'protection') dmg *= 0.5;
    const k = e.boss ? this.player(by) : null;
    if (k) dmg *= 1 + up(k, 'giant') / 100;
    e.hp -= dmg;
    e.hurtT = 0.12;
    this.emit({ k: 'num', x: e.x, y: e.y - e.r, v: Math.round(dmg), c: crit ? 'crit' : '' });
    if (e.hp <= 0) this.killEnemy(e, by);
  }

  private killEnemy(e: Enemy, by: string) {
    e.hp = 0;
    this.s.enemies = this.s.enemies.filter((x) => x !== e);
    const xp = e.boss ? BOSSES[e.boss].xp : MONSTERS[e.kind].xp;
    this.giveXp(xp);
    const k = this.player(by);
    if (k?.role === 'archer') {
      k.kills++;
      this.lifesteal(k);
    }
    this.emit({ k: e.boss ? 'bossdie' : 'pop', x: e.x, y: e.y, c: e.kind, r: e.r });
    // a destroyed Boom Pot still goes boom
    if (e.kind === 'pot' && !e.boss) this.explode(e.x, e.y, DMG.boomR, DMG.boom * dmgScale(this.s.stage), 'm', '');
  }

  /** an explosion hurts archers (team m) and also other monsters around it */
  explode(x: number, y: number, r: number, dmg: number, team: 'a' | 'm', by: string) {
    this.emit({ k: 'boom', x, y, r });
    for (const p of this.s.players) {
      if (p.dead || p.id === by) continue;
      const hits = team === 'm' ? p.role === 'archer' : p.role === 'monster';
      if (hits && dist(p.x, p.y, x, y) < r + playerR(p)) this.hurtPlayer(p, dmg, by);
    }
    for (const e of [...this.s.enemies]) {
      if (e.boss) continue;
      const d = dist(e.x, e.y, x, y);
      if (d < 4 || d > r + e.r) continue;
      this.hurtEnemy(e, dmg * 0.5, by);
    }
  }

  // ---------- shooting ----------

  private fireArrows(p: Player) {
    const st = archerStats(p);
    const multi = up(p, 'multi');
    const dirs: number[] = [];
    const spread = 0.16;
    for (let i = 0; i <= multi; i++) dirs.push(p.aim + (i - multi / 2) * spread);
    for (let i = 0; i < up(p, 'side'); i++) {
      dirs.push(p.aim + Math.PI / 2 + i * 0.14, p.aim - Math.PI / 2 - i * 0.14);
    }
    for (let i = 0; i < up(p, 'back'); i++) dirs.push(p.aim + Math.PI + (i - (up(p, 'back') - 1) / 2) * 0.16);
    for (const a of dirs) {
      const crit = Math.random() < st.crit;
      this.s.shots.push({
        id: this.id(), kind: 'arrow', team: 'a', owner: p.id, x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
        vx: Math.cos(a) * st.arrowSpeed, vy: Math.sin(a) * st.arrowSpeed, dmg: st.dmg * (crit ? 2 : 1), crit,
        life: st.range / st.arrowSpeed, pierce: up(p, 'pierce'), bounce: up(p, 'bounce'), hit: [],
        sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
      });
    }
    this.emit({ k: 'shoot', x: p.x, y: p.y, who: p.id });
    // Thunder Bow: every 4th shot calls lightning
    p.shotN++;
    if (up(p, 'thunder') && p.shotN % 4 === 0) this.lightning(p, p.x, p.y, st.dmg * 2.2);
  }

  /** lightning jumps from (x, y) to up to 5 monsters in a row */
  private lightning(p: Player, x: number, y: number, dmg: number) {
    const hit: number[] = [];
    for (let n = 0; n < 5; n++) {
      let best: Enemy | null = null, bd = n === 0 ? 420 : 240;
      for (const e of this.s.enemies) {
        const d = dist(e.x, e.y, x, y);
        if (!hit.includes(e.id) && d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) break;
      hit.push(best.id);
      this.emit({ k: 'zap', x, y, x2: best.x, y2: best.y });
      x = best.x;
      y = best.y;
      this.hurtEnemy(best, dmg, p.id);
    }
  }

  /** a sword swing: hits everything in a wide arc in front of you */
  private swing(p: Player) {
    const st = archerStats(p);
    const reach = 74;
    p.swingT = 0.22;
    this.emit({ k: 'swing', x: p.x, y: p.y, v: p.aim, who: p.id });
    const inArc = (x: number, y: number, r: number) => {
      const d = dist(x, y, p.x, p.y);
      if (d > reach + r) return false;
      let da = Math.atan2(y - p.y, x - p.x) - p.aim;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) < 1.05 || d < r + 10;
    };
    for (const e of [...this.s.enemies]) {
      if (!inArc(e.x, e.y, e.r)) continue;
      const crit = Math.random() < st.crit;
      this.hurtEnemy(e, st.dmg * 1.9 * (crit ? 2 : 1), p.id, crit);
      this.onHitEffects(p, e);
      // knock it back a little
      const d = dist(e.x, e.y, p.x, p.y) || 1;
      if (!e.boss) {
        e.x += ((e.x - p.x) / d) * 22;
        e.y += ((e.y - p.y) / d) * 22;
        collide(this.s, e, e.r);
      }
    }
    for (const q of this.s.players) {
      if (q.role !== 'monster' || q.dead || !inArc(q.x, q.y, playerR(q))) continue;
      this.hurtPlayer(q, st.dmg * 1.9, p.id);
      this.emit({ k: 'num', x: q.x, y: q.y - 20, v: Math.round(st.dmg * 1.9), c: '' });
    }
  }

  /** frost and fire upgrades */
  private onHitEffects(owner: Player, e: Enemy) {
    const fr = up(owner, 'frost');
    if (fr) {
      e.slowT = 2;
      e.slowPct = Math.min(60, fr);
    }
    const fi = up(owner, 'fire');
    if (fi) {
      e.burnT = 3;
      e.burnDps = Math.max(e.burnDps, fi);
      e.burnBy = owner.id;
    }
  }

  /** the Sharp Crab's shot: thorns one behind another, all in a line */
  thornLine(x: number, y: number, aim: number, n: number, owner: string, dmgMul = 1) {
    const cx = Math.cos(aim), cy = Math.sin(aim);
    for (let i = 0; i < n; i++) {
      this.s.shots.push({
        id: this.id(), kind: 'thorn', team: 'm', owner, x: x - cx * i * 16, y: y - cy * i * 16, vx: cx * 400, vy: cy * 400,
        dmg: DMG.thorn * dmgScale(this.s.stage) * dmgMul, life: 2.2, pierce: 0, bounce: 0, crit: false, hit: [],
        sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
      });
    }
    this.emit({ k: 'thorns', x, y });
  }

  thorns(x: number, y: number, aim: number, n: number, spreadDeg: number, owner: string, dmgMul = 1) {
    const spread = (spreadDeg * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? aim : aim - spread / 2 + (spread * i) / (n - 1);
      this.s.shots.push({
        id: this.id(), kind: 'thorn', team: 'm', owner, x, y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270,
        dmg: DMG.thorn * dmgScale(this.s.stage) * dmgMul, life: 2.6, pierce: 0, bounce: 0, crit: false, hit: [],
        sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
      });
    }
    this.emit({ k: 'thorns', x, y });
  }

  glob(x: number, y: number, tx: number, ty: number, owner: string, dmgMul = 1) {
    const c = { x: tx, y: ty };
    collide(this.s, c, 6);
    this.s.shots.push({
      id: this.id(), kind: 'glob', team: 'm', owner, x, y, vx: 0, vy: 0, dmg: DMG.acidHit * dmgScale(this.s.stage) * dmgMul,
      life: 5, pierce: 0, bounce: 0, crit: false, hit: [], sx: x, sy: y, tx: c.x, ty: c.y, t: 0, dur: 0.6 + dist(x, y, c.x, c.y) / 600,
    });
    this.emit({ k: 'spit', x, y });
  }

  private nearestArcher(x: number, y: number) {
    let best: Player | null = null, bd = Infinity;
    for (const p of this.archers()) {
      const d = dist(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // ---------- update ----------

  update(dt: number) {
    const s = this.s;
    if (s.phase !== 'play') return;
    curWorld = s.world;
    // alone and picking an upgrade: the tower waits for you
    const humans = s.players.filter((p) => p.role);
    if (humans.length === 1 && choosing(humans[0])) return;
    s.time += dt;
    s.bannerT = Math.max(0, s.bannerT - dt);

    for (const p of s.players) this.updatePlayer(p, dt);
    if (s.phase !== 'play') return;

    // spawning
    if (s.spawnLeft > 0) {
      s.spawnT -= dt;
      const maxAlive = 6 + Math.floor(s.stage / 6) + 2 * (this.archers(false).length - 1);
      if (s.spawnT <= 0 && s.enemies.length < maxAlive) {
        this.spawnEnemy();
        s.spawnLeft--;
        s.spawnT = Math.max(0.25, 0.9 - s.stage * 0.01);
      }
    }

    for (const e of [...s.enemies]) this.updateEnemy(e, dt);
    this.updateShots(dt);
    this.updateOrbs(dt);
    this.updateWolves(dt);
    this.updateMythics(dt);

    // stage 50: once every boss is beaten, the boss with all their moves shows up
    if (s.finale === 1 && !s.enemies.some((e) => e.boss)) {
      s.finale = 2;
      const b = this.spawnBoss('archenemy', Math.max(1, this.archers(false).length));
      b.y = 120;
      s.bossId = b.id;
      this.emit({ k: 'finale', x: b.x, y: b.y });
    }

    // acid splotches
    for (const sp of s.splotches) {
      sp.t -= dt;
      for (const p of s.players) {
        if (p.dead || p.role !== (sp.team === 'm' ? 'archer' : 'monster')) continue;
        if (dist(p.x, p.y, sp.x, sp.y) < sp.r + playerR(p) * 0.5) {
          this.hurtPlayer(p, DMG.acidDps * dmgScale(s.stage) * dt, '', true);
          p.slowT = Math.max(p.slowT, 0.2);
        }
      }
    }
    s.splotches = s.splotches.filter((sp) => sp.t > 0);

    // the stage is clear once every monster the tower sent is gone
    if (!s.cleared && s.spawnLeft <= 0 && !s.enemies.length && s.finale !== 1) {
      s.cleared = true;
      this.emit({ k: 'clear', x: W / 2, y: H / 2 });
      if (s.stage === STAGES && s.world >= WORLDS) {
        this.nextStage(); // the very top: you win
        return;
      }
      if (isChestStage(s.stage)) {
        s.chests = [
          { id: this.id(), kind: 'loot', x: W / 2 - 70, y: H / 2 },
          { id: this.id(), kind: 'health', x: W / 2 + 70, y: H / 2 },
        ];
      }
      if (isMythicStage(s.stage)) s.chests.push({ id: this.id(), kind: 'mythic', x: W / 2, y: H / 2 + 70 });
    }
    if (s.cleared) this.updateExit(dt);
  }

  private updateExit(dt: number) {
    const s = this.s;
    // chests
    for (const p of this.archers()) {
      for (const c of s.chests) {
        if (p.opened.includes(c.id) || dist(p.x, p.y, c.x, c.y) > 34) continue;
        p.opened.push(c.id);
        this.emit({ k: 'chest', x: c.x, y: c.y, who: p.id, c: c.kind });
        if (c.kind === 'loot' || c.kind === 'mythic') {
          p.queue.unshift(c.kind === 'loot' ? 'loot' : 'myth');
          this.nextOffer(p);
        } else p.healChoice = true;
      }
    }
    // the stairs up
    const alive = this.archers();
    const on = alive.filter((p) => Math.abs(p.x - STAIRS.x) < STAIRS.w / 2 && p.y < STAIRS.y + STAIRS.h);
    if (!on.length) {
      s.stairsT = -1;
      return;
    }
    if (on.length === alive.length && alive.every((p) => !choosing(p))) {
      this.nextStage();
      return;
    }
    if (s.stairsT < 0) s.stairsT = 5;
    s.stairsT -= dt;
    if (s.stairsT <= 0) this.nextStage();
  }

  private updatePlayer(p: Player, dt: number) {
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.switchCd = Math.max(0, p.switchCd - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.swingT = Math.max(0, p.swingT - dt);
    // how fast they're moving (the Sharp Crab aims where you're going)
    if (dt > 0) {
      p.vx = p.vx * 0.7 + ((p.x - p.lx) / dt) * 0.3;
      p.vy = p.vy * 0.7 + ((p.y - p.ly) / dt) * 0.3;
      if (Math.hypot(p.x - p.lx, p.y - p.ly) > 80) p.vx = p.vy = 0;
    }
    p.lx = p.x;
    p.ly = p.y;
    if (!p.role) return;
    if (p.dead) {
      if (p.role === 'monster') {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          // back as a different monster
          const others = MONSTER_KINDS.filter((k) => k !== p.kind);
          p.dead = false;
          this.spawnMonsterPlayer(p, others[Math.floor(Math.random() * others.length)]);
          this.emit({ k: 'spawn', x: p.x, y: p.y });
        }
      }
      return;
    }
    const inp = this.inputs.get(p.id);
    if (inp) p.aim = inp.aim;
    if (p.role === 'archer') {
      const regen = up(p, 'regen');
      if (regen > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
      // the shield: hold to block 95% of damage while its energy lasts
      if (p.shieldBroken && p.shield >= 40) p.shieldBroken = false;
      p.blocking = !!inp?.block && !p.shieldBroken && p.shield > 0;
      if (p.blocking) {
        p.shield = Math.max(0, p.shield - 28 * dt);
        if (p.shield <= 0) {
          p.shieldBroken = true;
          this.emit({ k: 'shieldbreak', x: p.x, y: p.y, who: p.id });
        }
      } else p.shield = Math.min(100, p.shield + 16 * dt);
      if (inp?.fire && !p.blocking && !choosing(p) && p.fireCd <= 0) {
        if (p.weapon === 'sword') {
          p.fireCd = archerStats(p).fireEvery * 1.15;
          this.swing(p);
        } else {
          p.fireCd = archerStats(p).fireEvery;
          this.fireArrows(p);
        }
      }
      return;
    }
    p.blocking = false;
    // monster players
    const dm = dmgScale(this.s.stage);
    if (p.fuse > 0) {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        p.fuse = 0;
        this.explode(p.x, p.y, DMG.boomR * 1.1, DMG.boom * 1.3 * dm, 'm', p.id);
        p.hp = 0;
        p.dead = true;
        p.respawnT = 5;
        this.emit({ k: 'die', x: p.x, y: p.y, who: p.id, c: 'monster' });
      }
      return;
    }
    if (!inp?.fire || p.fireCd > 0) return;
    const cx = Math.cos(p.aim), cy = Math.sin(p.aim);
    if (p.kind === 'pot') {
      p.fuse = 0.6;
      this.emit({ k: 'fuse', x: p.x, y: p.y });
    } else if (p.kind === 'cactus') {
      p.fireCd = 1.3;
      this.thorns(p.x + cx * 18, p.y + cy * 18, p.aim, 5, 55, p.id, 1.2);
    } else if (p.kind === 'stew') {
      p.fireCd = 1.5;
      const reach = 260;
      this.glob(p.x, p.y, p.x + cx * reach, p.y + cy * reach, p.id, 1.2);
    } else if (p.kind === 'sharpCrab') {
      p.fireCd = 1.4;
      this.thornLine(p.x + cx * 20, p.y + cy * 20, p.aim, 5, p.id, 1.2);
    } else if (p.kind === 'enchanter') {
      p.fireCd = 2.5;
      const t = this.enchantNearest(p.x, p.y, 320);
      if (!t) this.emit({ k: 'fizzle', x: p.x, y: p.y, who: p.id });
    } else {
      p.fireCd = 0.55;
      const px = p.x + cx * 30, py = p.y + cy * 30;
      this.emit({ k: 'pinch', x: px, y: py });
      for (const a of this.archers()) if (dist(a.x, a.y, px, py) < 34 + ARCHER.r) this.hurtPlayer(a, DMG.pinch * 1.3 * dm, p.id);
    }
  }

  private updateEnemy(e: Enemy, dt: number) {
    const s = this.s;
    e.hurtT = Math.max(0, e.hurtT - dt);
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burnDps * dt;
      if (e.hp <= 0) {
        this.killEnemy(e, e.burnBy);
        return;
      }
    }
    e.slowT = Math.max(0, e.slowT - dt);
    const slow = e.slowT > 0 ? 1 - e.slowPct / 100 : 1;
    const target = this.nearestArcher(e.x, e.y);
    e.t += dt;
    e.cd -= dt * slow;
    e.cd2 -= dt;
    // enchantments from an Enchanter
    const em = e.ench === 'sharp' ? 1.6 : 1;
    const dm = dmgScale(s.stage) * em;
    if (e.ench === 'regrowth') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05 * dt);
    if (!target) {
      return;
    }
    const tx = target.x - e.x, ty = target.y - e.y;
    const d = Math.hypot(tx, ty) || 1;
    const nx = tx / d, ny = ty / d;
    e.face = Math.atan2(ty, tx);
    const sp = e.speed * slow * (e.ench === 'speed' ? 1.6 : 1);
    const move = (mx: number, my: number, speed = sp) => {
      e.x += mx * speed * dt;
      e.y += my * speed * dt;
      collide(s, e, e.r);
    };
    // monsters don't stack on top of each other
    for (const o of s.enemies) {
      if (o === e) continue;
      const od = dist(o.x, o.y, e.x, e.y), min = o.r + e.r;
      if (od < min && od > 0.01) {
        e.x += ((e.x - o.x) / od) * (min - od) * 0.5;
        e.y += ((e.y - o.y) / od) * (min - od) * 0.5;
      }
    }
    // touching an archer hurts a little
    if (d < e.r + ARCHER.r && e.kind !== 'pot') this.hurtPlayer(target, (e.boss ? 16 : 7) * dm, '');

    if (e.boss) {
      this.updateBoss(e, dt, target, d, nx, ny, sp);
      return;
    }

    if (e.kind === 'pot') {
      if (e.fuse > 0) {
        e.fuse -= dt;
        if (e.fuse <= 0) {
          s.enemies = s.enemies.filter((x) => x !== e);
          this.explode(e.x, e.y, DMG.boomR, DMG.boom * dm, 'm', '');
        }
        return;
      }
      move(nx, ny);
      if (d < e.r + 44) {
        e.fuse = 0.85;
        this.emit({ k: 'fuse', x: e.x, y: e.y });
      }
    } else if (e.kind === 'crab') {
      this.crabStep(e, dt, target, d, nx, ny, sp, DMG.pinch * dm, 1);
    } else if (e.kind === 'cactus') {
      if (e.state === 1) {
        if (e.t > 0.45) {
          this.thorns(e.x, e.y, e.face, 5 + Math.floor(s.stage / 12), 50, '', em);
          e.state = 0;
          e.t = 0;
          e.cd = 2.2 + Math.random();
        }
        return;
      }
      if (d > 280) move(nx, ny);
      if (e.cd <= 0 && d < 520) {
        e.state = 1;
        e.t = 0;
      }
    } else if (e.kind === 'stew') {
      const want = 250;
      if (d > want + 30) move(nx, ny);
      else if (d < want - 50) move(-nx, -ny, sp * 0.8);
      else move(-ny * e.side, nx * e.side, sp * 0.5);
      if (e.cd <= 0 && d < 480) {
        e.cd = 2.6 + Math.random() * 0.8;
        // aim a little ahead of a running archer
        this.glob(e.x, e.y - 10, target.x + (Math.random() - 0.5) * 40, target.y + (Math.random() - 0.5) * 40, '', em);
      }
    } else if (e.kind === 'sharpCrab') {
      // keeps its distance, then shoots a line of thorns right where you're heading (3× a cactus's aim)
      if (e.state === 1) {
        if (e.t > 0.5) {
          const fly = d / 400;
          const ax = target.x + target.vx * fly, ay = target.y + target.vy * fly;
          this.thornLine(e.x, e.y, Math.atan2(ay - e.y, ax - e.x), 5 + Math.floor(s.stage / 15), '', em);
          e.state = 0;
          e.t = 0;
          e.cd = 2 + Math.random() * 0.8;
        }
        return;
      }
      const want = 230;
      const circle = d > want + 30 ? 0.8 : d < want - 40 ? -0.8 : 0;
      move(nx * circle - ny * e.side, ny * circle + nx * e.side, sp);
      if (Math.random() < dt * 0.5) e.side *= -1;
      if (e.cd <= 0 && d < 520) {
        e.state = 1;
        e.t = 0;
      }
    } else if (e.kind === 'enchanter') {
      // stays back and enchants the monster closest to it
      const want = 320;
      if (d < want - 40) move(-nx, -ny);
      else if (d > want + 80) move(nx, ny, sp * 0.6);
      else move(-ny * e.side, nx * e.side, sp * 0.4);
      if (e.cd <= 0) {
        e.cd = 4 + Math.random() * 1.5;
        const t = this.enchantNearest(e.x, e.y, 360, e);
        if (t) e.said = `I gave the ${t.boss ? BOSSES[t.boss].name.replace(/^The /, '') : MONSTERS[t.kind].name} ${ENCHANTS[t.ench as Enchant].name}!`;
      }
    }
  }

  /** enchant the monster nearest to (x, y); ones without an enchantment come first */
  enchantNearest(x: number, y: number, range: number, by?: Enemy): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    for (const o of this.s.enemies) {
      if (o === by || o.kind === 'enchanter') continue;
      const d = dist(o.x, o.y, x, y) + (o.ench ? 400 : 0);
      if (d < bd && dist(o.x, o.y, x, y) < range) {
        bd = d;
        best = o;
      }
    }
    if (!best) return null;
    best.ench = ENCHANT_IDS[Math.floor(Math.random() * ENCHANT_IDS.length)];
    this.emit({ k: 'enchant', x, y, x2: best.x, y2: best.y, c: best.ench });
    return best;
  }

  private crabStep(e: Enemy, dt: number, target: Player, d: number, nx: number, ny: number, sp: number, pinch: number, dashes: number) {
    const move = (mx: number, my: number, speed: number) => {
      e.x += mx * speed * dt;
      e.y += my * speed * dt;
      collide(this.s, e, e.r);
    };
    if (e.state === 0) {
      // scuttle sideways around the archer, closing in
      const circle = d > 150 ? 0.7 : -0.2;
      move(nx * circle - ny * e.side, ny * circle + nx * e.side, sp);
      if (Math.random() < dt * 0.6) e.side *= -1;
      if (e.cd <= 0 && d < 260) {
        e.state = 1;
        e.t = 0;
        e.dx = nx;
        e.dy = ny;
      }
    } else if (e.state === 1) {
      e.dx = nx;
      e.dy = ny;
      if (e.t > (e.boss ? 0.5 : 0.35)) {
        e.state = 2;
        e.t = 0;
        e.hitOnce = 0;
        this.emit({ k: 'dash', x: e.x, y: e.y });
      }
    } else {
      move(e.dx, e.dy, sp * 3.6);
      for (const a of this.archers()) {
        if (!e.hitOnce && dist(a.x, a.y, e.x, e.y) < e.r + ARCHER.r + 6) {
          e.hitOnce = 1;
          this.hurtPlayer(a, pinch, '');
          this.emit({ k: 'pinch', x: a.x, y: a.y });
        }
      }
      if (e.t > 0.38) {
        e.pattern++;
        if (e.pattern < dashes) {
          e.state = 1;
          e.t = 0;
        } else {
          e.pattern = 0;
          e.state = 0;
          e.t = 0;
          e.cd = 1.4 + Math.random();
        }
      }
    }
  }

  private updateBoss(e: Enemy, dt: number, target: Player, d: number, nx: number, ny: number, sp: number) {
    const s = this.s;
    const dm = dmgScale(s.stage);
    const kind = e.boss!;
    const move = (mx: number, my: number, speed = sp) => {
      e.x += mx * speed * dt;
      e.y += my * speed * dt;
      collide(s, e, e.r);
    };
    const summon = (k: MonsterKind, n: number) => {
      const w2 = s.world > 1;
      if (s.enemies.length > (w2 ? 26 : 14)) return;
      // in World 2 bosses call twice as many of their kind, all over the floor
      for (let i = 0; i < n * (w2 ? 2 : 1); i++) {
        const a = Math.random() * Math.PI * 2;
        if (w2 && i % 2) this.spawnEnemy(k);
        else this.spawnEnemy(k, { x: e.x + Math.cos(a) * (e.r + 24), y: e.y + Math.sin(a) * (e.r + 24) });
      }
    };
    const crab = () => this.crabStep(e, dt, target, d, nx, ny, sp, 30 * dm, 3);
    const thornlord = () => {
      if (d > 300) move(nx, ny);
      if (e.state === 1) {
        if (e.t > 0.6) {
          // denser and more often: a thick fan, then a full ring with a second ring offset into its gaps
          e.pattern++;
          if (e.pattern % 2) {
            this.thorns(e.x, e.y, e.face, 15, 80, '', 1.2);
            this.thorns(e.x, e.y, e.face, 8, 40, '', 1.2);
          } else {
            this.thorns(e.x, e.y, e.face, 32, 360 - 360 / 32, '', 1.1);
            this.thorns(e.x, e.y, e.face + Math.PI / 32, 32, 360 - 360 / 32, '', 1.1);
          }
          e.state = 0;
          e.t = 0;
          e.cd = 1.4;
        }
      } else if (e.cd <= 0) {
        e.state = 1;
        e.t = 0;
      }
    };
    const teapot = () => {
      if (e.state === 1) {
        // a big steam blast: shows a ring first
        if (e.t > 1) {
          this.explode(e.x, e.y, 150, 34 * dm, 'm', '');
          e.state = 0;
          e.t = 0;
          e.cd = 4;
        }
        return;
      }
      move(nx, ny);
      if (d < 150 && e.cd <= 0) {
        e.state = 1;
        e.t = 0;
        this.emit({ k: 'fuse', x: e.x, y: e.y });
      }
    };
    const cauldron = () => {
      const want = 280;
      if (d > want + 30) move(nx, ny);
      else if (d < want - 60) move(-nx, -ny, sp * 0.8);
      else move(-ny * e.side, nx * e.side, sp * 0.5);
      if (e.cd <= 0) {
        e.cd = 2.4;
        for (let i = 0; i < 3; i++) {
          this.glob(e.x, e.y - 20, target.x + (Math.random() - 0.5) * 160, target.y + (Math.random() - 0.5) * 160, '', 1.3);
        }
      }
    };
    if (kind === 'crabKing') {
      crab();
      if (e.cd2 <= 0) {
        e.cd2 = 8;
        summon('crab', 2);
      }
    } else if (kind === 'thornlord') {
      thornlord();
      if (e.cd2 <= 0) {
        e.cd2 = 10;
        summon('cactus', 1);
      }
    } else if (kind === 'teapotTitan') {
      teapot();
      if (e.cd2 <= 0) {
        e.cd2 = 4.5;
        summon('pot', 2 + (Math.random() < 0.5 ? 1 : 0));
      }
    } else if (kind === 'cauldron') {
      cauldron();
      if (e.cd2 <= 0) {
        e.cd2 = 8;
        summon('stew', 1);
      }
    } else {
      // the Archenemy takes turns with every boss's moves, faster below half health
      const phase = Math.floor(s.time / 7) % 4;
      if (phase === 0) crab();
      else if (phase === 1) thornlord();
      else if (phase === 2) teapot();
      else cauldron();
      if (e.state === 0 && e.cd > 0 && e.hp < e.maxHp / 2) e.cd -= dt * 0.6;
      if (e.cd2 <= 0) {
        e.cd2 = 7;
        summon(['pot', 'crab', 'cactus', 'stew'][Math.floor(Math.random() * 4)] as MonsterKind, 2);
      }
    }
  }

  private updateShots(dt: number) {
    const s = this.s;
    const keep: Shot[] = [];
    for (const sh of s.shots) {
      if (sh.kind === 'glob') {
        sh.t += dt;
        const k = Math.min(1, sh.t / sh.dur);
        sh.x = sh.sx + (sh.tx - sh.sx) * k;
        sh.y = sh.sy + (sh.ty - sh.sy) * k;
        if (k >= 1) {
          // lands: hurts whoever is right there and leaves a splotch for 5 seconds
          s.splotches.push({ id: this.id(), x: sh.tx, y: sh.ty, r: DMG.splotchR * (sh.dmg > DMG.acidHit * 1.25 * dmgScale(s.stage) ? 1.2 : 1), t: DMG.splotchLife, team: sh.team });
          this.emit({ k: 'splat', x: sh.tx, y: sh.ty });
          for (const p of this.archers()) if (dist(p.x, p.y, sh.tx, sh.ty) < DMG.splotchR + ARCHER.r) this.hurtPlayer(p, sh.dmg, sh.owner);
        } else keep.push(sh);
        continue;
      }
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt;
      let dead = sh.life <= 0 || sh.x < WALL || sh.x > W - WALL || sh.y < WALL || sh.y > H - WALL;
      if (!dead && s.pillars.some((pl) => dist(pl.x, pl.y, sh.x, sh.y) < pl.r)) {
        dead = true;
        this.emit({ k: 'thud', x: sh.x, y: sh.y });
      }
      if (!dead && sh.team === 'm') {
        for (const p of this.archers()) {
          if (dist(p.x, p.y, sh.x, sh.y) < ARCHER.r + 4) {
            if (this.hurtPlayer(p, sh.dmg, sh.owner) || choosing(p)) dead = true;
            break;
          }
        }
      } else if (!dead) {
        dead = this.arrowHits(sh);
      }
      if (!dead) keep.push(sh);
    }
    s.shots = keep;
  }

  /** returns true when the arrow is used up */
  private arrowHits(sh: Shot): boolean {
    const owner = this.player(sh.owner);
    const hitEnemy = (e: Enemy) => {
      this.hurtEnemy(e, sh.dmg, sh.owner, sh.crit);
      if (owner) {
        this.onHitEffects(owner, e);
        // Splitting Arrows: burst into more arrows
        const n = up(owner, 'split');
        if (n && !sh.child) {
          const sp = Math.hypot(sh.vx, sh.vy) * 0.8;
          const base = Math.atan2(sh.vy, sh.vx);
          for (let i = 0; i < n; i++) {
            const a = base + ((i + 1) / (n + 1) - 0.5) * 2.4;
            this.s.shots.push({
              ...sh, id: this.id(), child: true, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              dmg: sh.dmg * 0.5, life: 0.5, pierce: 0, bounce: 0, hit: [e.id],
            });
          }
        }
      }
    };
    for (const e of this.s.enemies) {
      if (sh.hit.includes(e.id) || dist(e.x, e.y, sh.x, sh.y) > e.r + 3) continue;
      sh.hit.push(e.id);
      hitEnemy(e);
      return this.afterHit(sh, e.x, e.y);
    }
    // monster players
    for (const p of this.s.players) {
      if (p.role !== 'monster' || p.dead) continue;
      const pid = -p.slot - 1;
      if (sh.hit.includes(pid) || dist(p.x, p.y, sh.x, sh.y) > playerR(p) + 3) continue;
      sh.hit.push(pid);
      this.hurtPlayer(p, sh.dmg, sh.owner);
      this.emit({ k: 'num', x: p.x, y: p.y - 20, v: Math.round(sh.dmg), c: sh.crit ? 'crit' : '' });
      return this.afterHit(sh, p.x, p.y);
    }
    return false;
  }

  private afterHit(sh: Shot, x: number, y: number): boolean {
    if (sh.bounce > 0) {
      // ricochet to the closest monster it hasn't hit yet
      let best: Enemy | null = null, bd = 280;
      for (const e of this.s.enemies) {
        const d = dist(e.x, e.y, x, y);
        if (!sh.hit.includes(e.id) && d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        sh.bounce--;
        const sp = Math.hypot(sh.vx, sh.vy);
        const a = Math.atan2(best.y - y, best.x - x);
        sh.vx = Math.cos(a) * sp;
        sh.vy = Math.sin(a) * sp;
        sh.life = Math.max(sh.life, 0.6);
        return false;
      }
    }
    if (sh.pierce > 0) {
      sh.pierce--;
      return false;
    }
    return true;
  }

  private updateWolves(dt: number) {
    const s = this.s;
    s.wolves = s.wolves.filter((w) => s.players.some((p) => p.id === w.owner));
    for (const w of s.wolves) {
      const o = this.player(w.owner)!;
      w.cd = Math.max(0, w.cd - dt);
      w.biteT = Math.max(0, w.biteT - dt);
      if (o.role !== 'archer') {
        w.moving = false;
        continue;
      }
      // go for the monster closest to its archer
      let t: Enemy | null = null, bd = 380;
      for (const e of s.enemies) {
        const d = dist(e.x, e.y, o.x, o.y);
        if (d < bd) {
          bd = d;
          t = e;
        }
      }
      const gx = t ? t.x : o.x + Math.cos(w.id) * 40, gy = t ? t.y : o.y + Math.sin(w.id) * 30;
      const d = dist(w.x, w.y, gx, gy);
      const reach = t ? t.r + 14 : 20;
      w.moving = d > reach;
      if (d > reach) {
        const sp = (d > 300 ? 420 : 280) * dt;
        w.x += ((gx - w.x) / d) * Math.min(sp, d - reach);
        w.y += ((gy - w.y) / d) * Math.min(sp, d - reach);
        collide(s, w, 10);
      }
      w.face = Math.atan2(gy - w.y, gx - w.x);
      if (t && d <= reach + 4 && w.cd <= 0) {
        w.cd = 0.55;
        w.biteT = 0.15;
        this.hurtEnemy(t, 9 * w.power * Math.sqrt(hpScale(s.stage)), o.id);
        this.emit({ k: 'bite', x: t.x, y: t.y });
      }
    }
  }

  /** Arrow Rain and Burning Aura */
  private updateMythics(dt: number) {
    for (const p of this.archers()) {
      const st = archerStats(p);
      const rain = up(p, 'rain');
      if (rain) {
        p.rainT -= dt;
        if (p.rainT <= 0 && this.s.enemies.length) {
          p.rainT = 3;
          for (let i = 0; i < rain; i++) {
            const e = this.s.enemies[Math.floor(Math.random() * this.s.enemies.length)];
            if (!e) break;
            this.emit({ k: 'rain', x: e.x, y: e.y });
            this.hurtEnemy(e, st.dmg, p.id);
          }
        }
      }
      const aura = up(p, 'aura');
      if (aura) {
        for (const e of [...this.s.enemies]) {
          if (dist(e.x, e.y, p.x, p.y) > 110 + e.r) continue;
          e.hp -= aura * dt * (e.ench === 'protection' ? 0.5 : 1);
          if (e.hp <= 0) this.killEnemy(e, p.id);
        }
      }
    }
  }

  private orbHit = new Map<string, number>();
  private updateOrbs(dt: number) {
    for (const p of this.archers()) {
      const n = up(p, 'orbs');
      if (!n) continue;
      const st = archerStats(p);
      for (let i = 0; i < n; i++) {
        const { x, y } = orbPos(p, i, n, this.s.time);
        for (const e of [...this.s.enemies]) {
          if (dist(e.x, e.y, x, y) > e.r + 10) continue;
          const key = `${p.id}:${i}:${e.id}`;
          if ((this.orbHit.get(key) ?? 0) > this.s.time) continue;
          this.orbHit.set(key, this.s.time + 0.5);
          this.hurtEnemy(e, st.dmg * 0.7, p.id);
        }
      }
    }
    if (this.orbHit.size > 500) this.orbHit.clear();
  }
}

export function orbPos(p: Player, i: number, n: number, time: number) {
  const a = time * 3 + (i * Math.PI * 2) / n;
  return { x: p.x + Math.cos(a) * 62, y: p.y + Math.sin(a) * 62 };
}
