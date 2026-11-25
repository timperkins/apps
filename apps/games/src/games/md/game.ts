// M.D. simulation: the hero, monsters, projectiles, loot and level flow. No drawing here.
import {
  ARMOR, ARTIFACTS, LEVELS, MELEE, MONSTERS, RANGED, SMITH_STOCK, ARMOR_STOCK, TRADERS, armorOf, isArmor, isMelee, isRanged, makeKey, meleeOf, parseKey, rangedOf, rollRarity, itemName, DIFFS, ELEMENT_BONUS, ICE_SLOW, MAX_LEVEL, xpNeed, type Element,
  type ArmorId, type ArrowKind, type ArtifactId, type Melee, type GearId, type ItemKey, type LevelDef, type MonsterDef, type MonsterKind, type Rarity, type Trader,
} from './data';
import { T, generateCamp, generateDungeon, isWallTile, rng, tileAt, type Level, type Prop } from './dungeon';

export interface SaveData {
  v: 1;
  coins: number;
  owned: ItemKey[];
  /** '' = fists */
  melee: ItemKey;
  ranged: ItemKey;
  armor: ItemKey;
  arrows: number;
  special: Record<Exclude<ArrowKind, 'normal'>, number>;
  arrowKind: ArrowKind;
  artifacts: ArtifactId[];
  slots: (ArtifactId | '')[];
  potions: number;
  bombs: number;
  /** highest level index unlocked (0..4) */
  unlocked: number;
  cleared: string[];
  won: boolean;
  runs: number;
  /** "the set": each owned item's level (1..100) and xp toward the next */
  levels: Record<ItemKey, { lv: number; xp: number }>;
  /** the hardest difficulty beaten on each dungeon (index into DIFFS) */
  best: Record<string, number>;
}

export const newSave = (): SaveData => ({
  v: 1, coins: 30, owned: ['rusty-sword', 'shortbow', 'tunic'], melee: 'rusty-sword', ranged: 'shortbow', armor: 'tunic',
  arrows: 40, special: { fire: 0, frost: 0, boom: 0 }, arrowKind: 'normal', artifacts: [], slots: ['', '', ''], potions: 1, bombs: 1, unlocked: 0, cleared: [], won: false, runs: 0, levels: {}, best: {},
});

export interface Monster {
  id: number;
  kind: MonsterKind;
  def: MonsterDef;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  scale: number;
  guardian: boolean;
  state: 'idle' | 'chase' | 'wind' | 'recover' | 'special';
  t: number;
  cd: number;
  special: number;
  face: number;
  awake: boolean;
  slowT: number;
  burnT: number;
  stunT: number;
  flash: number;
  kx: number;
  ky: number;
  walk: number;
  hover: number;
  dead: boolean;
  /** what the boss is winding up */
  move?: 'slam' | 'charge' | 'volley' | 'summon';
  cx?: number;
  cy?: number;
}

export interface Shot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  dmg: number;
  from: 'hero' | 'monster';
  kind: 'arrow' | 'bolt' | 'star' | 'ember' | 'spore' | 'ice' | 'firework';
  pierce: number;
  effect?: 'burn' | 'slow' | 'boom';
  element?: Element;
  color?: string;
  hit: Set<number>;
  life: number;
}
export interface Bomb {
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  fuse: number;
}
export interface Drop {
  x: number;
  y: number;
  kind: 'coin' | 'potion' | 'arrows';
  n: number;
  t: number;
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
}
export interface Floater {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
}
export interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  life: number;
  total: number;
  color: string;
}
/** a warning circle on the floor before a big hit */
export interface Warn {
  x: number;
  y: number;
  r: number;
  t: number;
  total: number;
}

export type AimMode = 'mouse' | 'front' | 'nearest';
export interface Input {
  mx: number;
  my: number;
  aim: { x: number; y: number } | null;
  melee: boolean;
  ranged: boolean;
  roll: boolean;
  potion: boolean;
  bomb: boolean;
  use: boolean;
  /** artifact slot pressed this frame (0..2), or -1 */
  artifact?: number;
  cycleArrow?: boolean;
  aimMode?: AimMode;
  autoFire?: boolean;
  /** the mouse moved in the last moment, so standing still you turn to it */
  aimFresh?: boolean;
}
/** the other player, as the host's game sees them */
export interface Peer {
  id: string;
  name: string;
  x: number;
  y: number;
  face: number;
  moving: boolean;
  walk: number;
  dead: boolean;
  rolling: boolean;
  swingT: number;
  swingDur: number;
  drawT: number;
  hp: number;
  maxHp: number;
  armor: string;
  melee: string;
  ranged: string;
}
/** something the guest did that the host's game has to carry out */
export type Act =
  | { a: 'swing'; face: number; key: string; lv?: number }
  | { a: 'shoot'; angle: number; key: string; ak: ArrowKind; lv?: number }
  | { a: 'art'; id: ArtifactId; x: number; y: number }
  | { a: 'bomb'; tx: number; ty: number }
  | { a: 'chest'; i: number }
  | { a: 'portal' };
interface Tgt {
  /** '' = the host's own hero, '-' = nobody */
  id: string;
  x: number;
  y: number;
}
export interface Totem {
  x: number;
  y: number;
  t: number;
}
export interface Bolt {
  x: number;
  y: number;
  /** offsets from x, y and the height of each point, ground first */
  pts: [number, number, number][];
  life: number;
}

export const CAMP_DEF: LevelDef = {
  id: 'camp', name: 'Hearthstead Camp', blurb: '', floor: ['#6fae4a', '#64a043'], wall: ['#3f7a34', '#2c5a26'], accent: '#ffd27a', ambient: '#000', light: 0,
  monsters: [], guardian: { kind: 'mossling', name: '', scale: 1, hp: 1 }, rooms: 1, map: { x: 0, y: 0 }, reward: 0,
};

const HERO_R = 0.3;
const LOCAL_SOUNDS = new Set(['hurt', 'die', 'coin', 'pickup', 'drink', 'rare', 'buy', 'click', 'artifact', 'roll', 'bow', 'swing', 'punch', 'throw']);
export const POTION_EVERY = 20;
export const RESPAWN_AFTER = 8;
const MAX_HP = 100;

export class Game {
  save: SaveData;
  mode: 'camp' | 'dungeon' = 'camp';
  levelIdx = 0;
  def: LevelDef = CAMP_DEF;
  L: Level;
  time = 0;
  // hero
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  hp = MAX_HP;
  maxHp = MAX_HP;
  face = Math.PI / 4;
  walk = 0;
  moving = false;
  swingT = 0;
  swingDur = 0.3;
  /** the seed the current dungeon was built from (a guest builds the same one) */
  seed = 0;
  meleeCd = 0;
  rangedCd = 0;
  drawT = 0;
  rollT = 0;
  rollCd = 0;
  rollDx = 0;
  rollDy = 0;
  hurtT = 0;
  slowT = 0;
  potionCd = 0;
  bombCd = 0;
  dead = false;
  deadT = 0;
  // world
  monsters: Monster[] = [];
  shots: Shot[] = [];
  bombs: Bomb[] = [];
  drops: Drop[] = [];
  parts: Particle[] = [];
  floats: Floater[] = [];
  rings: Ring[] = [];
  warns: Warn[] = [];
  shake = 0;
  nextId = 1;
  kills = 0;
  runCoins = 0;
  bossAwake = false;
  guardian: Monster | null = null;
  // flow field toward the hero, rebuilt a few times a second
  flow: Int16Array = new Int16Array(0);
  flowT = 0;
  near: { label: string; act: () => void } | null = null;
  /** locked target (click a monster), 0 = none */
  targetId = 0;
  artCd = [0, 0, 0];
  totems: Totem[] = [];
  bolts: Bolt[] = [];
  speedT = 0;
  ironT = 0;
  autoT = 0;
  /** potion refill timer (one draught every 20 s, holding at most 1) */
  potionT = 0;
  // ---- co-op ----
  /** true on the guest: the host's game runs monsters, loot and level flow */
  remote = false;
  /** the other player (on the host) */
  peers: Peer[] = [];
  /** the host as the guest sees it */
  mate: Peer | null = null;
  /** fx events to forward to the guest (host only, when someone has joined) */
  fxOut: unknown[] | null = null;
  onAct: (a: Act) => void = () => {};
  onPeerHurt: (id: string, dmg: number, fx: number, fy: number, effect?: 'slow' | 'burn') => void = () => {};
  onPeerGain: (id: string, g: { coins?: number; arrows?: number; gear?: boolean; special?: [string, number]; heal?: number; xp?: number }) => void = () => {};
  onBothDown: () => void = () => {};
  /** host: the level changed (camp or a dungeon, with its seed) */
  onEnter: (mode: 'camp' | 'dungeon', idx: number, seed: number) => void = () => {};
  /** host: a level was finished, just before going home */
  onFinish: () => void = () => {};
  /** plays a sound, and on the host also plays it for the guest */
  sound(name: string) {
    this.onSound(name);
    if (this.fxOut && !LOCAL_SOUNDS.has(name)) this.fxOut.push(['s', name]);
  }
  get coop() {
    return this.remote || this.peers.length > 0;
  }

  onSound: (s: string) => void = () => {};
  onMsg: (s: string) => void = () => {};
  onBanner: (title: string, sub: string) => void = () => {};
  onTrader: (t: Trader) => void = () => {};
  onMissionTable: () => void = () => {};
  onLevelDone: (def: LevelDef, reward: number) => void = () => {};
  onDeath: () => void = () => {};
  onWin: () => void = () => {};
  onSave: () => void = () => {};

  constructor(save?: SaveData) {
    this.save = save ?? newSave();
    this.L = generateCamp();
    this.enterCamp();
  }

  get melee() {
    return meleeOf(this.save.melee, this.lvOf(this.save.melee));
  }
  get ranged() {
    return rangedOf(this.save.ranged, this.lvOf(this.save.ranged));
  }
  get armor() {
    return armorOf(this.save.armor, this.lvOf(this.save.armor));
  }
  /** the difficulty of the dungeon you're in (or about to pick) */
  diff = 1;
  get D() {
    return DIFFS[this.diff] ?? DIFFS[1];
  }
  lvOf(key: ItemKey | ''): number {
    return key ? (this.save.levels?.[key]?.lv ?? 1) : 1;
  }
  xpOf(key: ItemKey): number {
    return this.save.levels?.[key]?.xp ?? 0;
  }
  /** the set (equipped weapon, bow and armor) gets xp only from beating mobs and opening chests */
  gainSetXp(n: number) {
    if (n <= 0) return;
    if (!this.save.levels) this.save.levels = {};
    const ups: string[] = [];
    for (const key of [this.save.melee, this.save.ranged, this.save.armor]) {
      if (!key) continue;
      const e = (this.save.levels[key] ??= { lv: 1, xp: 0 });
      if (e.lv >= MAX_LEVEL) continue;
      e.xp += n;
      while (e.lv < MAX_LEVEL && e.xp >= xpNeed(e.lv)) {
        e.xp -= xpNeed(e.lv);
        e.lv++;
        ups.push(`${itemName(key)} Lv ${e.lv}`);
      }
      if (e.lv >= MAX_LEVEL) e.xp = 0;
    }
    if (ups.length) {
      this.float(this.x, this.y - 0.3, 'LEVEL UP!', '#7affb0');
      this.ring(this.x, this.y, 1.4, '#7affb0', 0.4);
      this.onSound('rare');
      this.onMsg(`⬆ ${ups.join(' · ')}`);
    }
  }
  get rollMax() {
    return this.armor.quickroll ? 0.42 : 0.85;
  }
  owns(id: GearId) {
    return this.save.owned.some((k) => parseKey(k).id === id);
  }
  /** Gives the player a new item, rolling for gold (0.5%) or diamond (0.05%). */
  grant(id: GearId, rarity: Rarity = rollRarity()): ItemKey {
    const key = makeKey(id, rarity);
    if (!this.save.owned.includes(key)) this.save.owned.push(key);
    if (rarity !== 'normal') {
      this.onBanner(rarity === 'gold' ? '✨ GOLD ITEM! ✨' : '💎 DIAMOND ITEM! 💎', `${itemName(key)}: much stronger than the normal one!`);
      this.sound('rare');
    }
    this.onSave();
    return key;
  }

  enterCamp() {
    this.mode = 'camp';
    this.def = CAMP_DEF;
    this.L = generateCamp();
    this.x = this.L.start.x;
    this.y = this.L.start.y;
    this.resetRun();
    this.hp = this.maxHp;
    this.onEnter('camp', 0, 0);
  }

  enterLevel(idx: number, seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    this.mode = 'dungeon';
    this.levelIdx = idx;
    this.def = LEVELS[idx];
    this.L = generateDungeon(this.def, seed);
    this.x = this.L.start.x;
    this.y = this.L.start.y;
    this.resetRun();
    this.hp = this.maxHp;
    this.save.runs++;
    if (!this.remote) this.populate(seed);
    this.onEnter('dungeon', idx, seed);
    this.reveal();
    this.onBanner(this.def.name, this.def.blurb);
    this.sound('portal');
  }

  private resetRun() {
    this.monsters = [];
    this.totems = [];
    this.bolts = [];
    this.targetId = 0;
    this.speedT = this.ironT = 0;
    this.artCd = [0, 0, 0];
    this.shots = [];
    this.bombs = [];
    this.drops = [];
    this.parts = [];
    this.floats = [];
    this.rings = [];
    this.warns = [];
    this.vx = this.vy = 0;
    this.dead = false;
    this.rollT = this.swingT = this.hurtT = this.slowT = 0;
    this.kills = 0;
    this.runCoins = 0;
    this.bossAwake = false;
    this.guardian = null;
    this.flow = new Int16Array(this.L.w * this.L.h);
    this.flowT = 0;
  }

  private populate(seed: number) {
    const r = rng(seed ^ 0x5bd1e995);
    const L = this.L;
    const tier = this.levelIdx;
    L.rooms.forEach((rm, i) => {
      if (i === 0) return;
      if (i === L.bossRoom) {
        const gd = this.def.guardian;
        const m = this.spawn(gd.kind, rm.cx + 0.5, rm.cy - 2.5, true);
        m.name = gd.name;
        m.scale = gd.scale;
        m.hp = m.maxHp = Math.round(gd.hp * this.D.hp);
        m.dmg = Math.round(MONSTERS[gd.kind].dmg * (gd.kind === 'hollow-crown' ? 1 : 1.7) * this.D.dmg);
        this.guardian = m;
        // a couple of guards
        for (let k = 0; k < 2 + tier; k++) {
          const kind = this.def.monsters[Math.floor(r() * this.def.monsters.length)];
          this.spawn(kind, rm.x + 1 + r() * (rm.w - 2), rm.y + 1 + r() * (rm.h - 2));
        }
        return;
      }
      const n = 2 + Math.floor(r() * (3 + Math.ceil(tier * 0.75))) + (rm.w * rm.h > 70 ? 1 : 0) + this.D.more;
      for (let k = 0; k < n; k++) {
        const kind = this.def.monsters[Math.floor(r() * this.def.monsters.length)];
        for (let tries = 0; tries < 10; tries++) {
          const x = rm.x + 0.5 + r() * (rm.w - 1), y = rm.y + 0.5 + r() * (rm.h - 1);
          if (this.walkable(x, y, kind === 'gloomwing')) {
            this.spawn(kind, x, y);
            break;
          }
        }
      }
    });
  }

  spawn(kind: MonsterKind, x: number, y: number, guardian = false): Monster {
    const def = MONSTERS[kind];
    const tier = this.levelIdx;
    const D = this.D;
    const hp = Math.round(def.hp * (1 + 0.3 * tier) * D.hp);
    const m: Monster = {
      id: this.nextId++, kind, def, name: def.name, x, y, hp, maxHp: hp, dmg: Math.round(def.dmg * (1 + 0.22 * tier) * D.dmg),
      scale: 1, guardian, state: 'idle', t: 0, cd: 0.5 + Math.random(), special: 5, face: Math.random() * 6.28, awake: false,
      slowT: 0, burnT: 0, stunT: 0, flash: 0, kx: 0, ky: 0, walk: Math.random() * 10, hover: Math.random() * 6, dead: false,
    };
    this.monsters.push(m);
    return m;
  }

  // ---------- map helpers ----------
  solidAt(tx: number, ty: number, flier = false): boolean {
    const t = tileAt(this.L, tx, ty);
    if (isWallTile(t)) return true;
    if (!flier && t === T.HAZARD && this.def.hazard === 'lava' && this.mode === 'dungeon') return false;
    return this.propSolid(tx, ty);
  }
  private propGrid: Map<number, Prop> | null = null;
  private propSolid(tx: number, ty: number) {
    if (!this.propGrid) {
      this.propGrid = new Map();
      for (const p of this.L.props) if (p.solid && p.hp > 0) this.propGrid.set(p.y * this.L.w + p.x, p);
    }
    return this.propGrid.has(ty * this.L.w + tx);
  }
  propsDirty() {
    this.propsChanged();
  }
  private propsChanged() {
    this.propGrid = null;
  }
  walkable(x: number, y: number, flier = false) {
    const t = tileAt(this.L, Math.floor(x), Math.floor(y));
    if (!flier && t === T.HAZARD && this.def.hazard === 'lava') return false;
    return !this.solidAt(Math.floor(x), Math.floor(y), flier);
  }
  /** moves a circle with wall sliding */
  private moveCircle(o: { x: number; y: number }, dx: number, dy: number, r: number, flier = false, avoidLava = false) {
    const blocked = (x: number, y: number) => {
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        const tx = Math.floor(x + ox), ty = Math.floor(y + oy);
        if (this.solidAt(tx, ty, flier)) return true;
        if (avoidLava && tileAt(this.L, tx, ty) === T.HAZARD && this.def.hazard === 'lava') return true;
      }
      return false;
    };
    if (!blocked(o.x + dx, o.y)) o.x += dx;
    if (!blocked(o.x, o.y + dy)) o.y += dy;
  }
  lineOfSight(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d * 3);
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
      const t = tileAt(this.L, Math.floor(x), Math.floor(y));
      if (isWallTile(t)) return false;
    }
    return true;
  }
  private buildFlow() {
    const L = this.L, W = L.w;
    const f = this.flow;
    f.fill(-1);
    const sx = Math.floor(this.x), sy = Math.floor(this.y);
    const q = new Int32Array(W * L.h);
    let h = 0, tl = 0;
    f[sy * W + sx] = 0;
    q[tl++] = sy * W + sx;
    while (h < tl) {
      const c = q[h++];
      const cx = c % W, cy = (c / W) | 0;
      const d = f[c];
      if (d > 40) continue;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ox, ny = cy + oy;
        const ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= L.h || f[ni] >= 0) continue;
        const t = L.tiles[ni];
        if (isWallTile(t) || (t === T.HAZARD && this.def.hazard === 'lava') || this.propSolid(nx, ny)) continue;
        f[ni] = d + 1;
        q[tl++] = ni;
      }
    }
  }
  private reveal() {
    const L = this.L;
    const R = 7;
    const cx = Math.floor(this.x), cy = Math.floor(this.y);
    for (let y = cy - R; y <= cy + R; y++)
      for (let x = cx - R; x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= L.w || y >= L.h) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        L.explored[y * L.w + x] = 1;
      }
    // seeing into a room reveals the whole room
    for (const rm of L.rooms) {
      if (cx >= rm.x - 1 && cx <= rm.x + rm.w && cy >= rm.y - 1 && cy <= rm.y + rm.h)
        for (let y = rm.y - 1; y <= rm.y + rm.h; y++) for (let x = rm.x - 1; x <= rm.x + rm.w; x++) L.explored[y * L.w + x] = 1;
    }
  }

  // ---------- effects ----------
  burst(x: number, y: number, z: number, color: string, n: number, speed = 3, size = 0.08) {
    this.fxOut?.push(['b', +x.toFixed(2), +y.toFixed(2), +z.toFixed(2), color, Math.round(n), speed, size]);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      const life = 0.35 + Math.random() * 0.4;
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 2 + Math.random() * 3, life, max: life, color, size });
    }
  }
  float(x: number, y: number, text: string, color: string) {
    this.fxOut?.push(['f', +x.toFixed(2), +y.toFixed(2), text, color]);
    this.floats.push({ x, y, z: 1.6, text, color, life: 0.9 });
  }
  ring(x: number, y: number, max: number, color: string, life = 0.4) {
    this.fxOut?.push(['r', +x.toFixed(2), +y.toFixed(2), max, color, life]);
    this.rings.push({ x, y, r: 0.2, max, life, total: life, color });
  }

  // ---------- combat ----------
  hurtHero(dmg: number, fromX: number, fromY: number, effect?: 'slow' | 'burn') {
    if (this.dead || this.rollT > 0 || this.hurtT > 0) return;
    const real = Math.max(1, Math.round(dmg * (1 - this.armor.block) * (this.ironT > 0 ? 0.25 : 1)));
    this.hp -= real;
    this.hurtT = 0.45;
    this.shake = Math.min(1, this.shake + 0.35);
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.vx += ((this.x - fromX) / d) * 6;
    this.vy += ((this.y - fromY) / d) * 6;
    if (effect === 'slow') this.slowT = 2;
    this.float(this.x, this.y, `-${real}`, '#ff6a6a');
    this.burst(this.x, this.y, 0.8, '#d83a3a', 6);
    this.sound('hurt');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.sound('die');
    }
  }

  hurtMonster(m: Monster, dmg: number, fromX: number, fromY: number, knock: number, effect?: 'slow' | 'burn' | 'stun', element?: Element) {
    if (m.dead) return;
    const crit = Math.random() < 0.1;
    // fire beats ice, ice beats fire
    const me = m.def.element;
    const strong = !!element && !!me && element !== me;
    const real = Math.round(dmg * (crit ? 2 : 1) * (strong ? ELEMENT_BONUS : 1) * (0.9 + Math.random() * 0.2));
    if (element === 'fire') effect = effect === 'stun' ? effect : 'burn';
    if (element === 'ice' && effect !== 'stun') effect = 'slow';
    m.hp -= real;
    m.flash = 0.12;
    m.awake = true;
    const d = Math.hypot(m.x - fromX, m.y - fromY) || 1;
    const k = knock / (m.guardian || m.kind === 'hollow-crown' ? 4 : m.kind === 'rustknight' ? 2 : 1);
    m.kx += ((m.x - fromX) / d) * k;
    m.ky += ((m.y - fromY) / d) * k;
    if (effect === 'slow') m.slowT = ICE_SLOW;
    if (effect === 'burn') m.burnT = 3;
    if (strong) this.burst(m.x, m.y, 0.8 * m.scale, element === 'fire' ? '#ff8a3a' : '#aee8ff', 10, 3);
    if (effect === 'stun' && !m.guardian) {
      m.stunT = 0.9;
      m.state = 'recover';
    }
    this.float(m.x, m.y, strong ? `${real}!!` : crit ? `${real}!` : `${real}`, strong ? (element === 'fire' ? '#ff9a4a' : '#9ae6ff') : crit ? '#ffe066' : '#ffffff');
    this.burst(m.x, m.y, 0.7 * m.scale, this.bloodColor(m.kind), 5);
    this.sound('hit');
    if (m.hp <= 0) this.killMonster(m);
  }

  bloodColor(k: MonsterKind) {
    return k === 'mossling' ? '#7fb85a' : k === 'sporecap' ? '#e06ad6' : k === 'frost-wisp' ? '#bfefff' : k === 'cinder-hound' ? '#ff8a2a' : k === 'lantern-monk' ? '#ffd27a' : k === 'hollow-crown' ? '#b07aff' : '#b8b8c0';
  }

  private killMonster(m: Monster) {
    m.dead = true;
    this.kills++;
    this.burst(m.x, m.y, 0.6 * m.scale, this.bloodColor(m.kind), 18 * m.scale, 4, 0.12);
    this.sound(m.guardian ? 'bossdie' : 'kill');
    const [a, b] = m.def.coins;
    let coins = a + Math.floor(Math.random() * (b - a + 1));
    if (m.guardian) coins = Math.round(coins * 1.5) + 30;
    coins = Math.max(1, Math.round(coins * this.D.coins));
    // the set levels up from beating mobs (your teammate's set too)
    const xp = Math.max(1, Math.round((m.guardian ? 20 : 1) * this.D.xp));
    this.gainSetXp(xp);
    for (const p of this.peers) this.onPeerGain(p.id, { xp });
    const piles = Math.min(8, Math.max(1, Math.ceil(coins / 4)));
    for (let i = 0; i < piles; i++) this.drop(m.x, m.y, 'coin', Math.ceil(coins / piles));
    if (Math.random() < 0.15) this.drop(m.x, m.y, 'arrows', 6 + Math.floor(Math.random() * 6));
    if (m.guardian) {
      this.shake = 1;
      this.L.portal.open = true;
      this.ring(m.x, m.y, 5, this.def.accent, 0.9);
      if (m.kind === 'hollow-crown') {
        this.onBanner('The Hollow Crown falls!', 'Step into the portal to finish the dungeons.');
      } else this.onBanner(`${m.name} is beaten!`, 'A portal opened in the middle of the room.');
      this.sound('portal');
    }
  }

  warn(x: number, y: number, r: number, t: number) {
    this.fxOut?.push(['w', +x.toFixed(2), +y.toFixed(2), r, t]);
    this.warns.push({ x, y, r, t, total: t });
  }
  bolt(x: number, y: number) {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 7; k++) pts.push([k ? (Math.random() - 0.5) * 0.5 : 0, k ? (Math.random() - 0.5) * 0.5 : 0, k * 0.7]);
    this.bolts.push({ x, y, pts, life: 0.35 });
    this.fxOut?.push(['l', +x.toFixed(2), +y.toFixed(2)]);
  }
  /** replays an fx event from the host (guest only) */
  playFx(e: unknown[]) {
    const [k, x, y] = e as [string, number, number];
    if (k === 'b') this.burst(x, y, e[3] as number, e[4] as string, e[5] as number, e[6] as number, e[7] as number);
    else if (k === 'f') this.float(x, y, e[3] as string, e[4] as string);
    else if (k === 'r') this.ring(x, y, e[3] as number, e[4] as string, e[5] as number);
    else if (k === 'w') this.warn(x, y, e[3] as number, e[4] as number);
    else if (k === 'l') this.bolt(x, y);
    else if (k === 's') this.sound(e[1] as string);
    else if (k === 'k') this.shake = Math.max(this.shake, e[1] as number);
  }

  drop(x: number, y: number, kind: Drop['kind'], n: number) {
    const a = Math.random() * Math.PI * 2, d = 0.2 + Math.random() * 0.6;
    const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
    this.drops.push({ x: this.walkable(nx, ny) ? nx : x, y: this.walkable(nx, ny) ? ny : y, kind, n, t: 0 });
  }

  private swing() {
    const w = this.melee;
    this.meleeCd = w.rate;
    this.swingT = this.swingDur = Math.min(0.32, w.rate * 0.85);
    this.sound(w.shape === 'fist' ? 'punch' : w.effect === 'stun' ? 'slam' : 'swing');
    if (this.remote) this.onAct({ a: 'swing', face: this.face, key: this.save.melee, lv: this.lvOf(this.save.melee) });
    else this.meleeHit(this.x, this.y, this.face, w);
  }

  /** the damage part of a swing, from any player (the host runs it for the guest too) */
  meleeHit(x0: number, y0: number, face: number, w: Melee) {
    const half = (w.arc * Math.PI) / 360;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - x0, dy = m.y - y0;
      const d = Math.hypot(dx, dy);
      if (d > w.reach + m.def.radius * m.scale) continue;
      let da = Math.atan2(dy, dx) - face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (w.arc < 360 && Math.abs(da) > half + 0.25 && d > 0.6) continue;
      this.hurtMonster(m, w.dmg, x0, y0, w.knock, w.effect, w.element);
    }
    if (w.effect === 'stun') {
      this.ring(x0, y0, w.reach, '#ffe066', 0.35);
      this.shake = Math.min(1, this.shake + 0.3);
    }
    // smash crates and barrels
    for (const p of this.L.props) {
      if ((p.kind !== 'crate' && p.kind !== 'barrel') || p.hp <= 0 || p.hp > 50) continue;
      const dx = p.x + 0.5 - x0, dy = p.y + 0.5 - y0;
      if (Math.hypot(dx, dy) > w.reach + 0.5) continue;
      let da = Math.atan2(dy, dx) - face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (w.arc < 360 && Math.abs(da) > half + 0.4) continue;
      p.hp = 0;
      this.propsChanged();
      this.burst(p.x + 0.5, p.y + 0.5, 0.5, p.kind === 'crate' ? '#a0713f' : '#7a4a28', 14, 3, 0.1);
      this.sound('crate');
      const roll = Math.random();
      if (roll < 0.65) this.drop(p.x + 0.5, p.y + 0.5, 'coin', 2 + Math.floor(Math.random() * 4));
      else if (roll < 0.88) this.drop(p.x + 0.5, p.y + 0.5, 'arrows', 5);
    }
  }

  /** the arrow type that will fly next */
  get loadedArrow(): ArrowKind {
    const k = this.save.arrowKind;
    return k !== 'normal' && this.save.special[k] > 0 ? k : 'normal';
  }
  arrowCount(k: ArrowKind = this.loadedArrow) {
    return k === 'normal' ? this.save.arrows : this.save.special[k];
  }
  cycleArrow() {
    const order: ArrowKind[] = ['normal', 'fire', 'frost', 'boom'];
    let i = order.indexOf(this.save.arrowKind);
    for (let n = 0; n < 4; n++) {
      i = (i + 1) % 4;
      if (order[i] === 'normal' || this.save.special[order[i] as 'fire'] > 0) break;
    }
    this.save.arrowKind = order[i];
    this.onMsg(`Loaded: ${order[i] === 'normal' ? 'plain arrows' : order[i] + ' arrows'} (${this.arrowCount(order[i])})`);
  }

  private shoot(angle: number) {
    const w = this.ranged;
    const ak = this.loadedArrow;
    if (this.arrowCount(ak) <= 0) {
      this.rangedCd = 0.4;
      this.onMsg('Out of arrows! Old Pip in camp sells more.');
      return;
    }
    if (ak === 'normal') this.save.arrows--;
    else this.save.special[ak]--;
    this.face = angle;
    this.rangedCd = w.rate;
    this.drawT = 0.18;
    this.sound('bow');
    if (this.remote) this.onAct({ a: 'shoot', angle, key: this.save.ranged, ak, lv: this.lvOf(this.save.ranged) });
    else this.fireArrows(this.x, this.y, angle, this.save.ranged, ak, this.lvOf(this.save.ranged));
  }

  /** the arrows themselves, from any player */
  fireArrows(x0: number, y0: number, angle: number, rangedKey: ItemKey, ak: ArrowKind, lv = 1) {
    const w = rangedOf(rangedKey, lv);
    const { id, rarity } = parseKey(rangedKey);
    const kind = w.shape === 'crossbow' ? 'bolt' : id === 'starlight-bow' || id === 'storm-bow' || rarity !== 'normal' ? 'star' : 'arrow';
    const effect = ak === 'fire' || w.burn ? 'burn' : ak === 'frost' || w.chill ? 'slow' : ak === 'boom' ? 'boom' : undefined;
    const element: Element | undefined = ak === 'fire' ? 'fire' : ak === 'frost' ? 'ice' : w.element;
    const color = ak !== 'normal' ? ({ fire: '#ff8a3a', frost: '#aee8ff', boom: '#ffe066' } as const)[ak] : w.burn ? '#ff8a3a' : w.chill ? '#aee8ff' : rarity === 'gold' ? '#ffd040' : rarity === 'diamond' ? '#8af4ff' : id === 'storm-bow' ? '#9ab0ff' : undefined;
    for (let i = 0; i < w.shots; i++) {
      const a = angle + (i - (w.shots - 1) / 2) * w.spread;
      this.shots.push({
        x: x0 + Math.cos(a) * 0.4, y: y0 + Math.sin(a) * 0.4, z: 0.9, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg, from: 'hero', kind, pierce: w.pierce, hit: new Set(), life: 1.4, effect, element, color,
      });
    }
  }

  // ---------- aiming ----------
  target(): Monster | null {
    if (!this.targetId) return null;
    const m = this.monsters.find((q) => q.id === this.targetId && !q.dead);
    if (!m) this.targetId = 0;
    return m ?? null;
  }
  /** click on a monster to lock on to it */
  lockAt(p: { x: number; y: number }): boolean {
    let best: Monster | null = null, bd = 1.1;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y) - m.def.radius * m.scale * 0.6;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) {
      this.targetId = best.id;
      return true;
    }
    return false;
  }
  nearestEnemy(range: number): Monster | null {
    let best: Monster | null = null, bd = range;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - this.x, m.y - this.y);
      if (d < bd && this.lineOfSight(this.x, this.y, m.x, m.y)) {
        bd = d;
        best = m;
      }
    }
    return best;
  }
  private angleTo(m: { x: number; y: number }) {
    return Math.atan2(m.y - this.y, m.x - this.x);
  }
  bowAngle(inp: Input): number {
    const t = this.target();
    if (t) return this.angleTo(t);
    const mode = inp.aimMode ?? 'mouse';
    if (mode === 'mouse' && inp.aim) return this.angleTo(inp.aim);
    if (mode === 'nearest' || (mode === 'mouse' && !inp.aim)) {
      const n = this.nearestEnemy(9);
      if (n) return this.angleTo(n);
    }
    return this.face;
  }
  private meleeAngle(inp: Input): number {
    const w = this.melee;
    const t = this.target();
    if (t && Math.hypot(t.x - this.x, t.y - this.y) < w.reach + 1.2) return this.angleTo(t);
    const n = this.nearestEnemy(w.reach + 0.9);
    if (n) return this.angleTo(n);
    if (!this.moving && (inp.aimMode ?? 'mouse') === 'mouse' && inp.aim && inp.aimFresh) return this.angleTo(inp.aim);
    return this.face;
  }

  // ---------- artifacts ----------
  private useArtifact(i: number) {
    const id = this.save.slots[i];
    if (!id) {
      this.onMsg(`Artifact slot ${i + 1} is empty. Mira the Mystic in camp sells artifacts.`);
      return;
    }
    if (this.artCd[i] > 0) return;
    const A = ARTIFACTS[id];
    this.artCd[i] = A.cooldown;
    this.sound('artifact');
    if (id === 'ghost-boots') {
      this.speedT = 5;
      this.burst(this.x, this.y, 0.2, '#b8a8ff', 14, 2);
    } else if (id === 'ironhide-charm') {
      this.ironT = 6;
      this.ring(this.x, this.y, 1.2, '#c8d0d8', 0.4);
    } else if (this.remote) this.onAct({ a: 'art', id, x: this.x, y: this.y });
    else this.artifactAt(id, this.x, this.y);
  }

  /** artifacts that touch monsters, from any player */
  artifactAt(id: ArtifactId, x0: number, y0: number) {
    const tier = this.mode === 'dungeon' ? this.levelIdx : 0;
    if (id === 'healing-totem') {
      this.totems.push({ x: x0, y: y0, t: 7 });
      this.burst(x0, y0, 0.5, '#6fe08a', 16, 2);
    } else if (id === 'gust-horn') {
      this.ring(x0, y0, 4, '#cfe8ff', 0.45);
      for (const m of this.monsters) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - x0, m.y - y0);
        if (d > 4) continue;
        this.hurtMonster(m, 6, x0, y0, 14, m.guardian ? undefined : 'stun');
      }
    } else if (id === 'thunder-charm') {
      const near = this.monsters.filter((m) => !m.dead && Math.hypot(m.x - x0, m.y - y0) < 9).sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0)).slice(0, 5);
      if (!near.length) this.onMsg('No enemies close enough for the lightning.');
      for (const m of near) {
        this.bolt(m.x, m.y);
        this.hurtMonster(m, 30 + tier * 10, m.x, m.y - 0.1, 1, m.guardian ? undefined : 'stun');
      }
      this.shake = Math.min(1, this.shake + 0.4);
      this.sound('thunder');
    } else if (id === 'firework-crown') {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        this.shots.push({ x: x0, y: y0, z: 1, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: 20 + tier * 6, from: 'hero', kind: 'firework', pierce: 0, hit: new Set(), life: 0.9, effect: 'boom', color: ['#ff6ad6', '#ffe066', '#6ad6ff'][k % 3] });
      }
    }
  }

  private monsterShoot(m: Monster, angle: number, kind: 'ember' | 'spore' | 'ice', speed = 7, dmg = m.dmg) {
    this.shots.push({
      x: m.x + Math.cos(angle) * 0.4, y: m.y + Math.sin(angle) * 0.4, z: 0.8 * m.scale, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      dmg, from: 'monster', kind, pierce: 0, hit: new Set(), life: 3,
    });
  }

  private throwBomb(aim: { x: number; y: number } | null) {
    if (this.save.bombs <= 0) {
      this.onMsg('No Fizz Bombs left. Old Pip sells them.');
      this.bombCd = 0.5;
      return;
    }
    this.save.bombs--;
    this.bombCd = 0.8;
    let tx = this.x + Math.cos(this.face) * 4, ty = this.y + Math.sin(this.face) * 4;
    if (aim) {
      const d = Math.hypot(aim.x - this.x, aim.y - this.y);
      const k = Math.min(1, 5 / (d || 1));
      tx = this.x + (aim.x - this.x) * k;
      ty = this.y + (aim.y - this.y) * k;
    }
    this.sound('throw');
    if (this.remote) this.onAct({ a: 'bomb', tx, ty });
    else this.bombs.push({ x: this.x, y: this.y, tx, ty, t: 0, fuse: 1.0 });
  }

  private explode(x: number, y: number) {
    this.ring(x, y, 2.4, '#ffb347', 0.4);
    this.burst(x, y, 0.4, '#ffb347', 26, 6, 0.12);
    this.burst(x, y, 0.4, '#555', 12, 3, 0.16);
    this.shake = 1;
    this.sound('boom');
    for (const m of this.monsters) if (!m.dead && Math.hypot(m.x - x, m.y - y) < 2.4 + m.def.radius) this.hurtMonster(m, 45, x, y, 6, 'burn');
    for (const p of this.L.props)
      if ((p.kind === 'crate' || p.kind === 'barrel') && p.hp > 0 && p.hp < 50 && Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y) < 2.4) {
        p.hp = 0;
        this.propsChanged();
        this.drop(p.x + 0.5, p.y + 0.5, 'coin', 3);
      }
  }

  drinkPotion() {
    if (this.potionCd > 0 || this.dead) return;
    if (this.save.potions <= 0) {
      this.onMsg(`Your next Healing Draught is ready in ${Math.ceil(POTION_EVERY - this.potionT)}s.`);
      this.potionCd = 0.5;
      return;
    }
    if (this.hp >= this.maxHp) {
      this.onMsg('You are already at full health.');
      this.potionCd = 0.5;
      return;
    }
    this.save.potions--;
    const heal = Math.round(this.maxHp * 0.6);
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.potionCd = 0.6;
    this.potionT = 0;
    this.float(this.x, this.y, `+${heal}`, '#6fe08a');
    this.burst(this.x, this.y, 1, '#ff5a8a', 14, 2);
    this.sound('drink');
  }

  // ---------- update ----------
  update(dt: number, inp: Input) {
    this.time += dt;
    // the teammate's swing and bow pose tick down between network updates
    for (const p of this.mate ? [this.mate, ...this.peers] : this.peers) {
      p.swingT = Math.max(0, p.swingT - dt);
      p.drawT = Math.max(0, p.drawT - dt);
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.dead) {
      this.deadT += dt;
      if (!this.coop) {
        this.updateEffects(dt);
        if (this.deadT > 1.8 && this.deadT - dt <= 1.8) this.onDeath();
        return;
      }
      // on a team: get back up next to your teammate, unless they are down too
      const mate = this.remote ? this.mate : this.peers[0];
      if (mate && !mate.dead && this.deadT >= RESPAWN_AFTER) {
        this.dead = false;
        this.hp = Math.round(this.maxHp * 0.5);
        this.x = mate.x;
        this.y = mate.y;
        this.hurtT = 1.5;
        this.burst(this.x, this.y, 0.6, '#ffe066', 16, 2);
        this.onMsg('Back on your feet!');
      } else if (!this.remote && (!mate || mate.dead) && this.deadT > 1.8 && this.deadT - dt <= 1.8) this.onBothDown();
    } else this.updateHero(dt, inp);
    if (this.remote) {
      // the guest only moves its own hero; the host's snapshots bring everything else
      this.reveal();
      this.updateEffects(dt);
      return;
    }
    if (this.mode === 'dungeon') {
      this.flowT -= dt;
      if (this.flowT <= 0) {
        this.flowT = 0.25;
        this.buildFlow();
      }
      this.updateMonsters(dt);
      this.reveal();
    }
    this.updateShots(dt);
    this.updateBombs(dt);
    this.updateDrops(dt);
    this.updateEffects(dt);
    this.monsters = this.monsters.filter((m) => !m.dead);
  }

  private updateHero(dt: number, inp: Input) {
    this.meleeCd -= dt;
    this.rangedCd -= dt;
    this.rollCd -= dt;
    this.hurtT -= dt;
    this.slowT -= dt;
    this.potionCd -= dt;
    if (this.save.potions >= 1) {
      this.save.potions = 1;
      this.potionT = 0;
    } else {
      this.potionT += dt;
      if (this.potionT >= POTION_EVERY) {
        this.potionT = 0;
        this.save.potions = 1;
        this.float(this.x, this.y, '🧪 ready', '#ff8ab0');
        this.onSound('pickup');
      }
    }
    this.bombCd -= dt;
    this.speedT -= dt;
    this.ironT -= dt;
    for (let i = 0; i < 3; i++) this.artCd[i] = Math.max(0, this.artCd[i] - dt);
    for (const t of this.totems) {
      t.t -= dt;
      if (Math.hypot(t.x - this.x, t.y - this.y) < 2.6 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + 9 * dt);
        if (Math.random() < dt * 6) this.parts.push({ x: this.x + (Math.random() - 0.5) * 0.5, y: this.y + (Math.random() - 0.5) * 0.5, z: 0.5, vx: 0, vy: 0, vz: 2, life: 0.6, max: 0.6, color: '#6fe08a', size: 0.07 });
      }
    }
    for (const t of this.totems)
      for (const p of this.peers) if (!p.dead && Math.hypot(t.x - p.x, t.y - p.y) < 2.6) this.onPeerGain(p.id, { heal: 9 * dt });
    this.totems = this.totems.filter((t) => t.t > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    this.swingT = Math.max(0, this.swingT - dt);
    this.drawT = Math.max(0, this.drawT - dt);
    if (this.armor.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.armor.regen * dt);

    // input is in screen space (up = north-west on the iso grid); turn it into grid directions
    let mx = inp.mx, my = inp.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    // screen right = (+x, -y), screen down = (+x, +y)
    const gx = (mx + my) * Math.SQRT1_2, gy = (my - mx) * Math.SQRT1_2;
    this.moving = ml > 0.1;

    // the body faces the mouse (in mouse aim mode) or where you walk; attacks turn it
    const busy = this.swingT > 0 || this.drawT > 0;
    if (!busy) {
      // walking always turns you; standing still, you turn to look at the mouse once it moves
      if (this.moving) this.face = Math.atan2(gy, gx);
      else if ((inp.aimMode ?? 'mouse') === 'mouse' && inp.aim && inp.aimFresh) this.face = Math.atan2(inp.aim.y - this.y, inp.aim.x - this.x);
    }

    if (inp.roll && this.rollCd <= 0 && this.rollT <= 0) {
      const a = this.moving ? Math.atan2(gy, gx) : this.face;
      this.rollDx = Math.cos(a);
      this.rollDy = Math.sin(a);
      this.rollT = 0.3;
      this.rollCd = this.rollMax;
      this.sound('roll');
      this.burst(this.x, this.y, 0.1, '#bfb3a0', 6, 1.5);
    }

    const tile = tileAt(this.L, Math.floor(this.x), Math.floor(this.y));
    const onHaz = tile === T.HAZARD && this.mode === 'dungeon';
    let speed = 4.6 * (this.speedT > 0 ? 1.6 : 1) * this.armor.speed * (this.slowT > 0 ? 0.6 : 1) * (onHaz && this.def.hazard === 'water' ? 0.6 : 1);
    if (this.swingT > 0 && this.melee.rate > 0.6) speed *= 0.55;
    if (this.rollT > 0) {
      this.rollT -= dt;
      this.vx = this.rollDx * 11;
      this.vy = this.rollDy * 11;
    } else {
      const slip = onHaz && this.def.hazard === 'ice' ? 2.5 : 14;
      this.vx += (gx * speed - this.vx) * Math.min(1, dt * slip);
      this.vy += (gy * speed - this.vy) * Math.min(1, dt * slip);
    }
    this.moveCircle(this, this.vx * dt, this.vy * dt, HERO_R);
    if (this.moving || this.rollT > 0) this.walk += dt * 10;
    if (this.speedT > 0 && this.moving && Math.random() < dt * 14) this.burst(this.x, this.y, 0.1, '#b8a8ff', 1, 0.5);
    if (onHaz && this.def.hazard === 'lava' && this.rollT <= 0 && !this.armor.lavaproof) {
      if (Math.random() < dt * 8) this.burst(this.x, this.y, 0.1, '#ff8a2a', 2, 1.5);
      if (this.hurtT <= 0) this.hurtHero(12, this.x - this.vx, this.y - this.vy);
    }

    if (inp.melee && this.meleeCd <= 0 && this.rollT <= 0) {
      this.face = this.meleeAngle(inp);
      this.swing();
    }
    if (this.rangedCd <= 0 && this.rollT <= 0) {
      if (inp.ranged) this.shoot(this.bowAngle(inp));
      else if (this.ranged.auto && (inp.autoFire ?? true) && this.arrowCount() > 0) {
        // auto-fire bows shoot by themselves while an enemy is close
        const t = this.target() ?? this.nearestEnemy(8.5);
        if (t && t.awake) this.shoot(this.bowAngle(inp));
      }
    }
    if (inp.cycleArrow) this.cycleArrow();
    if (inp.artifact !== undefined && inp.artifact >= 0) this.useArtifact(inp.artifact);
    if (inp.potion) this.drinkPotion();
    if (inp.bomb && this.bombCd <= 0) this.throwBomb(inp.aim);

    // things to use nearby
    this.near = this.findNear();
    if (inp.use && this.near) this.near.act();
  }

  private findNear(): { label: string; act: () => void } | null {
    if (this.mode === 'camp') {
      for (const t of TRADERS)
        if (Math.hypot(t.x - this.x, t.y - this.y) < 1.6) return { label: `Talk to ${t.name} the ${t.title}`, act: () => this.onTrader(t) };
      const table = this.L.props.find((p) => p.kind === 'table')!;
      if (Math.hypot(table.x + 0.5 - this.x, table.y + 0.5 - this.y) < 1.7) return { label: 'Open the mission map', act: () => this.onMissionTable() };
      return null;
    }
    const P = this.L.portal;
    if (P.open && Math.hypot(P.x + 0.5 - this.x, P.y + 0.5 - this.y) < 1.2)
      return { label: this.coop ? 'Step into the portal (takes your team home)' : 'Step into the portal', act: () => (this.remote ? this.onAct({ a: 'portal' }) : this.finishLevel()) };
    for (const [i, p] of this.L.props.entries()) {
      if (p.kind !== 'chest' || p.open) continue;
      if (Math.hypot(p.x + 0.5 - this.x, p.y + 0.5 - this.y) < 1.4) return { label: 'Open the chest', act: () => (this.remote ? this.onAct({ a: 'chest', i }) : this.openChest(p)) };
    }
    return null;
  }

  openChest(p: Prop, opener = '') {
    p.open = true;
    this.sound('chest');
    this.burst(p.x + 0.5, p.y + 0.5, 0.6, '#ffe066', 18, 2.5);
    const cx = p.x + 0.5, cy = p.y + 1.1;
    for (let i = 0; i < 4; i++) this.drop(cx, cy, 'coin', Math.round((5 + this.levelIdx * 3) * this.D.coins));
    const cxp = Math.max(1, Math.round(5 * this.D.xp));
    if (opener) this.onPeerGain(opener, { xp: cxp });
    else this.gainSetXp(cxp);
    this.drop(cx, cy, 'arrows', 10);
    // sometimes a piece of gear you don't have yet
    if (opener) {
      // the guest rolls their own gear from their own save
      this.onPeerGain(opener, { gear: Math.random() < 0.45, special: Math.random() < 0.35 ? [['fire', 'frost', 'boom'][Math.floor(Math.random() * 3)], 6] : undefined });
    } else if (Math.random() < 0.45) {
      const pool = [...SMITH_STOCK, ...ARMOR_STOCK].filter((g) => !this.owns(g) && gearTier(g) <= this.levelIdx + 1);
      if (pool.length) {
        const g = pool[Math.floor(Math.random() * pool.length)];
        const key = this.grant(g);
        if (parseKey(key).rarity === 'normal') this.onBanner('New gear!', `${itemName(key)}: equip it from your inventory (Ctrl).`);
      }
    }
    if (!opener && Math.random() < 0.35) {
      const k = (['fire', 'frost', 'boom'] as const)[Math.floor(Math.random() * 3)];
      this.save.special[k] += 6;
      this.float(cx, cy, `+6 ${k} arrows`, '#ffe08a');
    }
  }

  /** a chest roll for this player (used when the guest opened one) */
  chestGear(level: number) {
    const pool = [...SMITH_STOCK, ...ARMOR_STOCK].filter((g) => !this.owns(g) && gearTier(g) <= level + 1);
    if (!pool.length) return;
    const key = this.grant(pool[Math.floor(Math.random() * pool.length)]);
    if (parseKey(key).rarity === 'normal') this.onBanner('New gear!', `${itemName(key)}: equip it from your inventory (Ctrl).`);
  }

  finishLevel() {
    const def = this.def;
    const first = !this.save.cleared.includes(def.id);
    const reward = Math.round((first ? def.reward : def.reward / 3) * this.D.reward);
    this.save.coins += reward;
    if (first) this.save.cleared.push(def.id);
    if (!this.save.best) this.save.best = {};
    this.save.best[def.id] = Math.max(this.save.best[def.id] ?? -1, this.diff);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length - 1, this.levelIdx + 1));
    const won = def.id === 'throne' && !this.save.won;
    if (def.id === 'throne') this.save.won = true;
    this.sound('win');
    if (!this.remote) this.onFinish();
    this.enterCamp();
    this.onSave();
    if (won) this.onWin();
    else this.onLevelDone(def, reward);
  }

  /** the players monsters can go after: you, and your teammate */
  private targets(): Tgt[] {
    const t: Tgt[] = [];
    if (!this.dead) t.push({ id: '', x: this.x, y: this.y });
    for (const p of this.peers) if (!p.dead) t.push({ id: p.id, x: p.x, y: p.y });
    return t;
  }
  private hurtTarget(T: Tgt, dmg: number, fx: number, fy: number, effect?: 'slow' | 'burn') {
    if (!T.id) this.hurtHero(dmg, fx, fy, effect);
    else {
      const p = this.peers.find((q) => q.id === T.id);
      if (p && !p.dead && !p.rolling) this.onPeerHurt(T.id, Math.round(dmg), fx, fy, effect);
    }
  }

  /** the host carries out what the guest did */
  peerAct(id: string, a: Act) {
    const p = this.peers.find((q) => q.id === id);
    if (!p || p.dead) return;
    if (a.a === 'swing') this.meleeHit(p.x, p.y, a.face, meleeOf(a.key, Math.min(MAX_LEVEL, a.lv ?? 1)));
    else if (a.a === 'shoot') this.fireArrows(p.x, p.y, a.angle, a.key, a.ak, Math.min(MAX_LEVEL, a.lv ?? 1));
    else if (a.a === 'art') this.artifactAt(a.id, p.x, p.y);
    else if (a.a === 'bomb') this.bombs.push({ x: p.x, y: p.y, tx: a.tx, ty: a.ty, t: 0, fuse: 1.0 });
    else if (a.a === 'chest') {
      const c = this.L.props[a.i];
      if (c && c.kind === 'chest' && !c.open && this.mode === 'dungeon') this.openChest(c, id);
    } else if (a.a === 'portal' && this.L.portal.open && this.mode === 'dungeon') this.finishLevel();
  }

  private updateMonsters(dt: number) {
    const all = this.targets();
    for (const m of this.monsters) {
      if (m.dead) continue;
      // go after the closest player
      let T: Tgt = all[0] ?? { id: '-', x: this.x, y: this.y };
      for (const c of all) if (Math.hypot(c.x - m.x, c.y - m.y) < Math.hypot(T.x - m.x, T.y - m.y)) T = c;
      const hx = T.x, hy = T.y;
      m.flash -= dt;
      m.hover += dt;
      m.slowT -= dt;
      m.stunT -= dt;
      if (m.burnT > 0) {
        m.burnT -= dt;
        if (Math.random() < dt * 6) this.burst(m.x, m.y, 0.8 * m.scale, '#ff8a2a', 1, 1);
        m.hp -= dt * 6;
        if (m.hp <= 0) {
          this.killMonster(m);
          continue;
        }
      }
      // knockback
      if (m.kx || m.ky) {
        this.moveCircle(m, m.kx * dt, m.ky * dt, m.def.radius * Math.min(m.scale, 1.4), m.kind === 'gloomwing', true);
        m.kx *= Math.pow(0.0005, dt);
        m.ky *= Math.pow(0.0005, dt);
        if (Math.abs(m.kx) + Math.abs(m.ky) < 0.05) m.kx = m.ky = 0;
      }
      if (T.id === '-') continue;
      const dx = hx - m.x, dy = hy - m.y;
      const dist = Math.hypot(dx, dy);
      if (!m.awake) {
        if (dist < (m.guardian ? 7 : 8) && this.lineOfSight(m.x, m.y, hx, hy)) {
          m.awake = true;
          if (m.guardian && !this.bossAwake) {
            this.bossAwake = true;
            this.onBanner(m.name, m.kind === 'hollow-crown' ? 'The ruler of the deep dungeons.' : 'The guardian of this dungeon.');
            this.sound('roar');
          }
        } else continue;
      }
      if (m.stunT > 0) continue;
      const slow = m.slowT > 0 ? 0.5 : 1;
      const r = m.def.radius * Math.min(m.scale, 1.4);
      const flier = m.kind === 'gloomwing';
      const toward = (sp: number) => {
        let ax = dx / (dist || 1), ay = dy / (dist || 1);
        if (!flier && !this.lineOfSight(m.x, m.y, hx, hy)) {
          // follow the flow field around walls
          const W = this.L.w;
          const tx = Math.floor(m.x), ty = Math.floor(m.y);
          let best = this.flow[ty * W + tx], bx = 0, by = 0;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const v = this.flow[(ty + oy) * W + tx + ox];
            if (v >= 0 && (best < 0 || v < best)) {
              best = v;
              bx = ox;
              by = oy;
            }
          }
          if (bx || by) {
            ax = tx + 0.5 + bx - m.x;
            ay = ty + 0.5 + by - m.y;
            const l = Math.hypot(ax, ay) || 1;
            ax /= l;
            ay /= l;
          }
        }
        this.moveCircle(m, ax * sp * dt, ay * sp * dt, r, flier, !flier);
        m.face = Math.atan2(ay, ax);
        m.walk += dt * sp * 3;
      };
      // keep monsters from stacking up on each other
      for (const o of this.monsters) {
        if (o === m || o.dead) continue;
        const ox = m.x - o.x, oy = m.y - o.y;
        const od = Math.hypot(ox, oy), min = r + o.def.radius * Math.min(o.scale, 1.4);
        if (od > 0.001 && od < min) this.moveCircle(m, (ox / od) * (min - od) * 0.5, (oy / od) * (min - od) * 0.5, r, flier, !flier);
      }

      if (m.def.style === 'boss') {
        this.updateBoss(m, dt, dist, dx, dy, toward, T);
        continue;
      }
      // guardians have a special ring attack every few seconds
      if (m.guardian) {
        m.special -= dt;
        if (m.special <= 0 && m.state !== 'wind' && dist < 9) {
          m.special = 6;
          m.state = 'special';
          m.t = 1;
          this.warn(m.x, m.y, 3.2, 1);
        }
        if (m.state === 'special') {
          m.t -= dt;
          if (m.t <= 0) {
            m.state = 'recover';
            m.cd = 0.8;
            if (m.def.shot) for (let i = 0; i < 12; i++) this.monsterShoot(m, (i / 12) * Math.PI * 2 + m.hover, m.def.shot, 6, Math.round(m.dmg * 0.6));
            this.ring(m.x, m.y, 3.2, this.bloodColor(m.kind), 0.4);
            this.shake = Math.min(1, this.shake + 0.5);
            this.sound('slam');
            if (dist < 3.2) this.hurtTarget(T, m.dmg, m.x, m.y);
          }
          continue;
        }
      }

      const reach = m.def.range * (m.guardian ? m.scale * 0.6 : 1) + 0.3;
      if (m.state === 'wind') {
        m.t -= dt;
        m.face = Math.atan2(dy, dx);
        if (m.t <= 0) {
          m.state = 'recover';
          m.cd = m.def.cooldown * (0.8 + Math.random() * 0.4);
          if (m.def.style === 'ranged' && m.def.shot) {
            const a = Math.atan2(dy, dx);
            if (m.kind === 'sporecap') for (const o of [-0.25, 0, 0.25]) this.monsterShoot(m, a + o, 'spore', 4.5);
            else this.monsterShoot(m, a, m.def.shot, m.kind === 'frost-wisp' ? 8 : 7);
            if (m.guardian && m.def.shot) for (const o of [-0.5, 0.5]) this.monsterShoot(m, a + o, m.def.shot, 6);
            this.sound('cast');
          } else {
            if (dist < reach + 0.5) this.hurtTarget(T, m.dmg, m.x, m.y);
            if (m.def.style === 'flier') m.cd = m.def.cooldown;
            this.sound(m.kind === 'rustknight' ? 'slam' : 'bite');
            if (m.guardian) this.ring(m.x + Math.cos(m.face) * 0.8, m.y + Math.sin(m.face) * 0.8, 1.5, '#fff', 0.25);
          }
        }
        continue;
      }
      if (m.state === 'recover') {
        m.cd -= dt;
        if (m.def.style === 'flier' && dist < 3) toward(-m.def.speed * 0.7 * slow);
        if (m.cd <= 0) m.state = 'chase';
        continue;
      }
      // chase
      m.state = 'chase';
      m.cd -= dt;
      if (m.def.style === 'ranged') {
        const los = this.lineOfSight(m.x, m.y, hx, hy);
        if (dist > m.def.range || !los) toward(m.def.speed * slow);
        else if (dist < m.def.range * 0.45) toward(-m.def.speed * 0.8 * slow);
        else {
          // drift sideways a bit
          const s = Math.sin(m.hover * 0.9 + m.id) * m.def.speed * 0.5 * slow;
          this.moveCircle(m, (-dy / dist) * s * dt, (dx / dist) * s * dt, r, false, true);
          m.face = Math.atan2(dy, dx);
          m.walk += dt * 2;
        }
        if (los && dist <= m.def.range + 0.5 && m.cd <= 0) {
          m.state = 'wind';
          m.t = m.def.windup;
        }
      } else {
        if (dist > reach) toward(m.def.speed * slow * (m.kind === 'cinder-hound' && dist < 5 ? 1.4 : 1));
        else if (m.cd <= 0) {
          m.state = 'wind';
          m.t = m.def.windup * (m.guardian ? 1.2 : 1);
        }
      }
    }
  }

  private updateBoss(m: Monster, dt: number, dist: number, dx: number, dy: number, toward: (sp: number) => void, T: Tgt) {
    const enraged = m.hp < m.maxHp * 0.5;
    if (m.state === 'wind' || m.state === 'special') {
      m.t -= dt;
      if (m.move === 'charge' && m.state === 'special') {
        // rushing toward where you were
        const cx = (m.cx ?? m.x) - m.x, cy = (m.cy ?? m.y) - m.y;
        const l = Math.hypot(cx, cy);
        if (l < 0.3 || m.t <= 0) {
          m.state = 'recover';
          m.cd = 1;
          this.ring(m.x, m.y, 1.8, '#b07aff', 0.3);
          this.shake = 0.6;
          this.sound('slam');
          if (dist < 2) this.hurtTarget(T, m.dmg, m.x, m.y);
        } else {
          const sp = 12 * dt;
          const before = { x: m.x, y: m.y };
          this.moveCircle(m, (cx / l) * sp, (cy / l) * sp, 0.9, false, false);
          if (Math.hypot(m.x - before.x, m.y - before.y) < sp * 0.3) m.t = 0;
          if (dist < 1.4) this.hurtTarget(T, m.dmg, m.x, m.y);
          if (Math.random() < 0.6) this.burst(m.x, m.y, 0.2, '#3a2a50', 2, 1);
        }
        return;
      }
      m.face = Math.atan2(dy, dx);
      if (m.t > 0) return;
      if (m.move === 'slam') {
        this.ring(m.x, m.y, 3.6, '#b07aff', 0.45);
        this.shake = 1;
        this.sound('slam');
        if (dist < 3.6) this.hurtTarget(T, m.dmg * 1.2, m.x, m.y);
        m.state = 'recover';
        m.cd = enraged ? 0.8 : 1.3;
      } else if (m.move === 'charge') {
        m.state = 'special';
        m.t = 1.1;
        m.cx = T.x + (dx / (dist || 1)) * 1.5;
        m.cy = T.y + (dy / (dist || 1)) * 1.5;
        this.sound('roar');
      } else if (m.move === 'volley') {
        const n = enraged ? 20 : 14;
        for (let i = 0; i < n; i++) this.monsterShoot(m, (i / n) * Math.PI * 2 + this.time, 'ember', 6, 14);
        this.sound('cast');
        m.state = 'recover';
        m.cd = 1;
      } else if (m.move === 'summon') {
        const kinds: MonsterKind[] = ['gloomwing', 'mossling', 'lantern-monk'];
        for (let i = 0; i < (enraged ? 4 : 3); i++) {
          const a = (i / 3) * Math.PI * 2;
          const x = m.x + Math.cos(a) * 2, y = m.y + Math.sin(a) * 2;
          if (this.walkable(x, y)) {
            const s = this.spawn(kinds[i % kinds.length], x, y);
            s.awake = true;
            this.burst(x, y, 0.5, '#b07aff', 12, 2);
          }
        }
        this.sound('portal');
        m.state = 'recover';
        m.cd = 1.2;
      }
      return;
    }
    if (m.state === 'recover') {
      m.cd -= dt;
      if (m.cd <= 0) m.state = 'chase';
      return;
    }
    m.state = 'chase';
    m.special -= dt;
    if (dist > 2.2) toward(m.def.speed * (enraged ? 1.3 : 1) * (m.slowT > 0 ? 0.6 : 1));
    if (m.special <= 0) {
      const opts: ('slam' | 'charge' | 'volley' | 'summon')[] = dist < 3 ? ['slam', 'slam', 'volley', 'summon'] : ['charge', 'volley', 'charge', 'summon'];
      m.move = opts[Math.floor(Math.random() * opts.length)];
      m.special = enraged ? 2.2 : 3.2;
      m.state = 'wind';
      m.t = m.move === 'slam' ? 0.9 : m.move === 'charge' ? 0.7 : 0.8;
      if (m.move === 'slam') this.warn(m.x, m.y, 3.6, 0.9);
    }
  }

  private updateShots(dt: number) {
    for (const s of this.shots) {
      s.life -= dt;
      const steps = 3;
      for (let k = 0; k < steps && s.life > 0; k++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        if (isWallTile(tileAt(this.L, Math.floor(s.x), Math.floor(s.y))) || this.solidAt(Math.floor(s.x), Math.floor(s.y), true)) {
          s.life = 0;
          this.burst(s.x - s.vx * 0.01, s.y - s.vy * 0.01, s.z, s.from === 'hero' ? (s.color ?? '#d8c8a0') : this.shotColor(s.kind), 4, 1.5);
          if (s.effect === 'boom') this.miniBoom(s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.dmg * 0.6, s.color ?? '#ffe066');
          break;
        }
        if (s.from === 'hero') {
          for (const m of this.monsters) {
            if (m.dead || s.hit.has(m.id)) continue;
            if (Math.hypot(m.x - s.x, m.y - s.y) < m.def.radius * m.scale + 0.15) {
              s.hit.add(m.id);
              this.hurtMonster(m, s.dmg, s.x - s.vx, s.y - s.vy, 2, s.effect === 'boom' ? undefined : s.effect, s.element);
              if (s.effect === 'boom') this.miniBoom(s.x, s.y, s.dmg * 0.6, s.color ?? '#ffe066', m.id);
              if (s.pierce-- <= 0) {
                s.life = 0;
                break;
              }
            }
          }
        } else {
          for (const T of this.targets()) {
            if (Math.hypot(T.x - s.x, T.y - s.y) >= HERO_R + 0.18) continue;
            if (!T.id && this.rollT > 0) continue;
            if (T.id && this.peers.find((q) => q.id === T.id)?.rolling) continue;
            s.life = 0;
            this.hurtTarget(T, s.dmg, s.x - s.vx, s.y - s.vy, s.kind === 'ice' ? 'slow' : undefined);
            if (s.kind === 'spore') this.burst(s.x, s.y, 0.6, '#e06ad6', 8, 1.5, 0.14);
            break;
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  shotColor(k: Shot['kind']) {
    return k === 'ember' ? '#ffb347' : k === 'spore' ? '#e06ad6' : k === 'ice' ? '#bfefff' : k === 'star' ? '#fff3a0' : '#d8c8a0';
  }

  private miniBoom(x: number, y: number, dmg: number, color: string, skip = 0) {
    this.ring(x, y, 1.4, color, 0.3);
    this.burst(x, y, 0.6, color, 12, 4, 0.1);
    this.sound('pop');
    for (const m of this.monsters) if (!m.dead && m.id !== skip && Math.hypot(m.x - x, m.y - y) < 1.4 + m.def.radius) this.hurtMonster(m, dmg, x, y, 3);
  }

  private updateBombs(dt: number) {
    for (const b of this.bombs) {
      b.t += dt;
      const k = Math.min(1, b.t / 0.45);
      if (k < 1) {
        const nx = b.x + (b.tx - b.x) * Math.min(1, dt / Math.max(0.01, 0.45 - b.t + dt));
        const ny = b.y + (b.ty - b.y) * Math.min(1, dt / Math.max(0.01, 0.45 - b.t + dt));
        if (this.walkable(nx, ny, true)) {
          b.x = nx;
          b.y = ny;
        } else {
          b.tx = b.x;
          b.ty = b.y;
        }
      }
      if (Math.random() < dt * 20) this.parts.push({ x: b.x, y: b.y, z: 0.5, vx: 0, vy: 0, vz: 1.5, life: 0.3, max: 0.3, color: '#ffe066', size: 0.05 });
      if (b.t >= b.fuse) this.explode(b.x, b.y);
    }
    this.bombs = this.bombs.filter((b) => b.t < b.fuse);
  }

  private updateDrops(dt: number) {
    for (const d of this.drops) {
      d.t += dt;
      // your teammate can grab it too
      const pr = this.peers.find((p) => !p.dead && Math.hypot(p.x - d.x, p.y - d.y) < 0.5);
      if (pr && d.t > 0.35) {
        d.t = -1;
        this.onPeerGain(pr.id, d.kind === 'coin' ? { coins: d.n } : d.kind === 'arrows' ? { arrows: d.n } : {});
        continue;
      }
      const dist = Math.hypot(this.x - d.x, this.y - d.y);
      if (dist < 2.2 && d.t > 0.35) {
        const k = Math.min(1, dt * 10);
        d.x += (this.x - d.x) * k;
        d.y += (this.y - d.y) * k;
      }
      if (dist < 0.4 && d.t > 0.35) {
        d.t = -1;
        if (d.kind === 'coin') {
          this.save.coins += d.n;
          this.runCoins += d.n;
          this.sound('coin');
        } else if (d.kind === 'potion') {
          this.save.potions++;
          this.float(this.x, this.y, '+1 draught', '#ff8ab0');
          this.sound('pickup');
        } else {
          this.save.arrows += d.n;
          this.float(this.x, this.y, `+${d.n} arrows`, '#e8d8b0');
          this.sound('pickup');
        }
      }
    }
    this.drops = this.drops.filter((d) => d.t >= 0);
  }

  private updateEffects(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 12 * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    for (const f of this.floats) {
      f.life -= dt;
      f.z += dt * 1.2;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r = r.max * (1 - r.life / r.total);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const w of this.warns) w.t -= dt;
    this.warns = this.warns.filter((w) => w.t > 0);
  }

  // ---------- shop ----------
  buyGear(id: GearId): ItemKey | string {
    const g = gearPrice(id);
    if (this.owns(id)) return 'You already own that.';
    if (this.save.coins < g) return 'Not enough coins.';
    this.save.coins -= g;
    const key = this.grant(id);
    this.equip(key);
    this.sound('buy');
    this.onSave();
    return key;
  }
  equip(key: ItemKey) {
    if (!this.save.owned.includes(key)) return;
    const { id } = parseKey(key);
    if (isMelee(id)) this.save.melee = key;
    else if (isRanged(id)) this.save.ranged = key;
    else if (isArmor(id)) this.save.armor = key;
    this.onSave();
  }
  unequipMelee() {
    this.save.melee = '';
    this.onSave();
  }
  buyArtifact(id: ArtifactId): string | null {
    if (this.save.artifacts.includes(id)) return 'You already own that.';
    const p = ARTIFACTS[id].price;
    if (this.save.coins < p) return 'Not enough coins.';
    this.save.coins -= p;
    this.save.artifacts.push(id);
    const empty = this.save.slots.indexOf('');
    if (empty >= 0) this.save.slots[empty] = id;
    this.sound('buy');
    this.onSave();
    return null;
  }
  slotArtifact(id: ArtifactId) {
    const s = this.save.slots;
    if (s.includes(id)) s[s.indexOf(id)] = '';
    else {
      const empty = s.indexOf('');
      if (empty >= 0) s[empty] = id;
      else {
        s.shift();
        s.push(id);
      }
    }
    this.onSave();
  }
}

export function gearPrice(id: GearId) {
  return isMelee(id) ? MELEE[id].price : isRanged(id) ? RANGED[id].price : ARMOR[id as ArmorId].price;
}
export function gearName(id: GearId) {
  return isMelee(id) ? MELEE[id].name : isRanged(id) ? RANGED[id].name : ARMOR[id as ArmorId].name;
}
/** rough level a piece of gear belongs to, so chests don't hand out the best stuff early */
export function gearTier(id: GearId) {
  const p = gearPrice(id);
  return p < 120 ? 0 : p < 230 ? 1 : p < 330 ? 2 : p < 500 ? 3 : 4;
}
