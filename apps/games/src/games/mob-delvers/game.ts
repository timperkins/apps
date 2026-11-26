// Mob Delvers simulation: the hero, monsters, allies, projectiles, loot and mission flow. No drawing here.
import {
  ALL_ARMOR, ALL_ARTIFACTS, ALL_MELEE, ALL_RANGED, ARTIFACTS, DIFFS, ELEMENT_BONUS, ENCHANTS, HERO_MAX, ICE_SLOW, LAST_LEVEL, LEVELS, MAX_LEVEL, MAX_SOULS, MOB_GEAR_CHANCE, MONSTERS,
  armorDef, armorOf, enchCost, enchChoices, enchantArmor, enchantMelee, enchantRanged, gear, gearMul, heroXpNeed, isArmor, isArtifact, isMelee, isRanged, itemName, makeKey, meleeOf, modeOf,
  parseKey, powerOf, rangedOf, rollDropLevel, threatDmg,
  type ArtifactId, type Element, type EnchId, type EnchSet, type GearId, type ItemKey, type LevelDef, type Melee, type ModeId, type MonsterDef, type MonsterKind, type MonsterShot,
} from './data';
import { T, generateCamp, generateDungeon, isWallTile, rng, tileAt, type Level, type Prop } from './dungeon';

export interface SaveData {
  v: 1;
  /** swords, bows and armor you own */
  owned: ItemKey[];
  /** artifacts you own */
  arts: ItemKey[];
  /** '' = fists */
  melee: ItemKey;
  ranged: ItemKey;
  armor: ItemKey;
  /** the 3 artifact slots */
  slots: (ItemKey | '')[];
  arrows: number;
  potions: number;
  /** missions beaten at least once (any mode or difficulty) */
  cleared: string[];
  /** the hardest difficulty beaten on each mission in each mode: "normal:village" → 0..9 */
  best: Record<string, number>;
  /** beat mission 8 (opens Hard) */
  won: boolean;
  /** beat mission 8 on Hard (opens Nightmare) */
  wonHard: boolean;
  runs: number;
  heroLv: number;
  heroXp: number;
  /** enchantments on each item */
  ench: Record<ItemKey, EnchSet>;
  /** the mode picked last on the mission map */
  mode: ModeId;
}

export const newSave = (): SaveData => {
  const sword = makeKey('rusty-sword', 1), bow = makeKey('shortbow', 1), armor = makeKey('tunic', 1), totem = makeKey('healing-totem', 1);
  return {
    v: 1, owned: [sword, bow, armor], arts: [totem], melee: sword, ranged: bow, armor, slots: [totem, '', ''], arrows: 60, potions: 1,
    cleared: [], best: {}, won: false, wonHard: false, runs: 0, heroLv: 1, heroXp: 0, ench: {}, mode: 'normal',
  };
};

export type MobEnch = 'swift' | 'shield' | 'strong';
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
  poisonT?: number;
  flash: number;
  kx: number;
  ky: number;
  walk: number;
  hover: number;
  dead: boolean;
  /** what the boss is winding up */
  move?: 'slam' | 'charge' | 'volley' | 'summon' | 'sonic' | 'breath' | 'fangs' | 'blink';
  cx?: number;
  cy?: number;
  /** enchanted by a hexer (or born that way in Hard and Nightmare) */
  ench?: MobEnch;
  /** fighting for the players (Charm Medallion) */
  charmT?: number;
  /** a small gloop that won't split again */
  small?: boolean;
  /** summoned by a boss (doesn't drop gear) */
  minion?: boolean;
}

export interface Shot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  dmg: number;
  from: 'hero' | 'monster';
  kind: 'arrow' | 'bolt' | 'star' | 'firework' | 'soul' | 'spit' | MonsterShot;
  pierce: number;
  effect?: 'burn' | 'slow' | 'boom' | 'poison' | 'bigboom';
  element?: Element;
  color?: string;
  hit: Set<number>;
  life: number;
  /** soul arrows: hits left, the monster it keeps coming back to, and time since it bounced */
  bounce?: number;
  home?: number;
  back?: number;
  knock?: number;
  /** who healed from souls it earned ('' = host, else a guest id) */
  owner?: string;
}
export interface Drop {
  x: number;
  y: number;
  kind: 'soul' | 'arrows';
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
/** a delayed hit on the floor (the Hex Lord's spikes) */
interface Strike {
  x: number;
  y: number;
  r: number;
  t: number;
  dmg: number;
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
  use: boolean;
  /** artifact slot pressed this frame (0..2), or -1 */
  artifact?: number;
  /** E (or the hand button) is held down right now */
  useHeld?: boolean;
  aimMode?: AimMode;
  autoFire?: boolean;
  /** the mouse moved in the last moment, so standing still you turn to it */
  aimFresh?: boolean;
}
/** another player, as the host's game sees them */
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
export type Quiver = 'fire' | 'poison' | 'firework';
/** something a guest did that the host's game has to carry out */
export type Act =
  | { a: 'swing'; face: number; key: string; en?: EnchSet }
  | { a: 'shoot'; angle: number; key: string; en?: EnchSet; q?: Quiver }
  | { a: 'art'; id: ArtifactId; lv: number; face: number }
  | { a: 'revive'; who?: string }
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
/** a wolf or llama fighting on your side */
export interface Ally {
  id: number;
  kind: 'wolf' | 'llama';
  owner: string;
  x: number;
  y: number;
  face: number;
  walk: number;
  t: number;
  cd: number;
  dmg: number;
}
/** a Soul Beacon beam */
export interface Beam {
  owner: string;
  x: number;
  y: number;
  face: number;
  t: number;
  dmg: number;
  tick: number;
}

export const CAMP_DEF: LevelDef = {
  id: 'camp', name: 'Delvers’ Camp', blurb: '', floor: ['#6fae4a', '#64a043'], wall: ['#3f7a34', '#2c5a26'], accent: '#ffd27a', ambient: '#000', light: 0,
  monsters: [], guardian: { kind: 'shambler', name: '', scale: 1, hp: 1 }, rooms: 1, map: { x: 0, y: 0 }, outdoor: 1, deco: 'village', out: ['grass', '#6fae4a', '#5f9a40', '#3f8a3a', '#2f6e2c'],
};

const HERO_R = 0.3;
const LOCAL_SOUNDS = new Set(['hurt', 'die', 'pickup', 'drink', 'rare', 'buy', 'click', 'artifact', 'roll', 'bow', 'swing', 'punch', 'soul']);
export const POTION_EVERY = 20;
/** on a team, if nobody revives you, you get up by yourself after this long */
export const RESPAWN_AFTER = 30;
/** seconds of holding E next to a downed teammate to revive them */
export const REVIVE_TIME = 1.5;
/** the big heart: 100 health, more with armor */
export const BASE_HP = 100;
const BEAM_LEN = 9;

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
  hp = BASE_HP;
  face = Math.PI / 4;
  walk = 0;
  moving = false;
  swingT = 0;
  swingDur = 0.3;
  /** the seed the current mission was built from (guests build the same one) */
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
  dead = false;
  deadT = 0;
  souls = 0;
  /** loaded by the Fire, Poison and Firework artifacts */
  quiver: { kind: Quiver; n: number } | null = null;
  // world
  monsters: Monster[] = [];
  allies: Ally[] = [];
  beams: Beam[] = [];
  shots: Shot[] = [];
  drops: Drop[] = [];
  parts: Particle[] = [];
  floats: Floater[] = [];
  rings: Ring[] = [];
  warns: Warn[] = [];
  private strikes: Strike[] = [];
  shake = 0;
  nextId = 1;
  kills = 0;
  /** gear found this run, for the end screen */
  found: ItemKey[] = [];
  bossAwake = false;
  guardian: Monster | null = null;
  // flow field toward the hero, rebuilt a few times a second
  flow: Int16Array = new Int16Array(0);
  flowT = 0;
  near: { label: string; act: () => void } | null = null;
  /** standing on lava sets you on fire: you burn for a few seconds instead of taking one big hit */
  burnT = 0;
  /** how long you've held E next to your downed teammate */
  reviveT = 0;
  /** a downed teammate is close enough to revive */
  reviveNear = false;
  /** host: you (or a guest, `by`) revived guest `id` */
  onReviveMate: (id: string, by: string) => void = () => {};
  /** locked target (click a monster), 0 = none */
  targetId = 0;
  artCd = [0, 0, 0];
  totems: Totem[] = [];
  bolts: Bolt[] = [];
  speedT = 0;
  ironT = 0;
  /** potion refill timer (one draught every 20 s, holding at most 1) */
  potionT = 0;
  /** the mode and difficulty (0..9) of the mission you're in (or about to pick) */
  playMode: ModeId = 'normal';
  diff = 0;
  // ---- co-op ----
  /** true on a guest: the host's game runs monsters, loot and level flow */
  remote = false;
  /** the other players (on the host) */
  peers: Peer[] = [];
  /** the host as a guest sees it */
  mate: Peer | null = null;
  /** the other guests as a guest sees them */
  others: Peer[] = [];
  get mates(): Peer[] {
    return this.remote ? (this.mate ? [this.mate, ...this.others] : this.others) : this.peers;
  }
  /** fx events to forward to guests (host only, when someone has joined) */
  fxOut: unknown[] | null = null;
  onAct: (a: Act) => void = () => {};
  onPeerHurt: (id: string, dmg: number, fx: number, fy: number, effect?: 'slow' | 'burn') => void = () => {};
  onPeerGain: (id: string, g: { souls?: number; arrows?: number; gear?: number; art?: number; heal?: number; xp?: number }) => void = () => {};
  onBothDown: () => void = () => {};
  private allDownSent = false;
  /** host: the level changed (camp or a mission, with its seed) */
  onEnter: (mode: 'camp' | 'dungeon', idx: number, seed: number) => void = () => {};
  /** host: a mission was finished, just before going home */
  onFinish: () => void = () => {};
  /** plays a sound, and on the host also plays it for guests */
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
  onMissionTable: () => void = () => {};
  onLevelDone: (def: LevelDef, found: ItemKey[]) => void = () => {};
  onDeath: () => void = () => {};
  onWin: (hard: boolean) => void = () => {};
  onSave: () => void = () => {};

  constructor(save?: SaveData) {
    this.save = save ?? newSave();
    this.playMode = this.save.mode ?? 'normal';
    this.L = generateCamp();
    this.enterCamp();
  }

  get melee() {
    return enchantMelee(meleeOf(this.save.melee), this.enchOf(this.save.melee));
  }
  get ranged() {
    return enchantRanged(rangedOf(this.save.ranged), this.enchOf(this.save.ranged));
  }
  get armor() {
    return enchantArmor(armorOf(this.save.armor), this.enchOf(this.save.armor));
  }
  get maxHp() {
    return BASE_HP + this.armor.hp;
  }
  /** your gear power: sword + bow + armor levels ÷ 3 */
  get power() {
    return powerOf(this.save.melee, this.save.ranged, this.save.armor);
  }
  enchOf(key: ItemKey | ''): EnchSet {
    return key ? (this.save.ench?.[key] ?? {}) : {};
  }
  /** enchant points spent on all your items */
  get enchSpent() {
    let n = 0;
    const have = new Set(this.save.owned);
    for (const [k, e] of Object.entries(this.save.ench ?? {})) if (have.has(k)) for (const t of Object.values(e)) n += enchCost(t ?? 0);
    return n;
  }
  /** one enchant point per hero level after the first */
  get enchPoints() {
    return Math.max(0, (this.save.heroLv ?? 1) - 1 - this.enchSpent);
  }
  /** adds a tier of one of the item's 3 enchantments; returns an error message or null */
  enchant(key: ItemKey, id: EnchId): string | null {
    if (!key) return 'Fists can’t be enchanted.';
    if (!enchChoices(key).includes(id)) return 'That enchantment doesn’t fit this item.';
    if (!this.save.ench) this.save.ench = {};
    const e = (this.save.ench[key] ??= {});
    const t = e[id] ?? 0;
    if (t >= 3) return 'That enchantment is already at its best.';
    if (this.enchPoints < t + 1) return `You need ${t + 1} enchant point${t ? 's' : ''}. Level up to get more.`;
    e[id] = t + 1;
    this.sound('artifact');
    this.onSave();
    return null;
  }
  /** takes every enchantment off an item and gives the points back */
  disenchant(key: ItemKey) {
    if (this.save.ench) delete this.save.ench[key];
    this.onSave();
  }
  get D() {
    return DIFFS[this.diff] ?? DIFFS[0];
  }
  get M() {
    return modeOf(this.playMode);
  }
  /** the monsters' level in this mission */
  get threat() {
    return Math.min(MAX_LEVEL, this.M.threat[this.diff] + (this.mode === 'dungeon' ? this.levelIdx : 0));
  }
  private get hpMul() {
    return gearMul(this.threat) * this.M.hp;
  }
  private get dmgMul() {
    return threatDmg(this.threat) * this.M.dmg;
  }

  // ---------- unlocking ----------
  mapOpen(i: number) {
    return i === 0 || this.save.cleared.includes(LEVELS[0].id);
  }
  modeOpen(m: ModeId) {
    return m === 'easy' || m === 'normal' || (m === 'hard' && this.save.won) || (m === 'nightmare' && this.save.wonHard);
  }
  /** difficulty 1 is always open; beat it once on a map and every difficulty opens there */
  diffOpen(mapId: string, m: ModeId, d: number) {
    return d === 0 || (this.save.best?.[`${m}:${mapId}`] ?? -1) >= 0;
  }
  bestOn(mapId: string, m: ModeId) {
    return this.save.best?.[`${m}:${mapId}`] ?? -1;
  }

  // ---------- xp and loot ----------
  gainXp(n: number) {
    if (n <= 0) return;
    if (!this.save.heroLv) this.save.heroLv = 1;
    if (this.save.heroLv >= HERO_MAX) return;
    this.save.heroXp = (this.save.heroXp ?? 0) + n;
    let up = false;
    while (this.save.heroLv < HERO_MAX && this.save.heroXp >= heroXpNeed(this.save.heroLv)) {
      this.save.heroXp -= heroXpNeed(this.save.heroLv);
      this.save.heroLv++;
      up = true;
    }
    if (up) {
      this.onBanner(`Level ${this.save.heroLv}!`, '+1 enchanting point. Open your inventory (Shift) and pick an enchantment.');
      this.float(this.x, this.y - 0.3, 'LEVEL UP!', '#7affb0');
      this.ring(this.x, this.y, 2, '#ffe066', 0.6);
      this.onSound('rare');
    }
  }
  owns(key: ItemKey) {
    return this.save.owned.includes(key) || this.save.arts.includes(key);
  }
  /** A new piece of gear (or an artifact) at a level rolled from your power and the mission. */
  grantDrop(what: 'gear' | 'art' = 'gear', why = 'New gear!') {
    const lv = rollDropLevel(this.playMode, this.power, this.diff);
    let key: ItemKey;
    if (what === 'art') {
      key = makeKey(ALL_ARTIFACTS[Math.floor(Math.random() * ALL_ARTIFACTS.length)], lv);
      this.save.arts.push(key);
    } else {
      const roll = Math.random();
      const list: GearId[] = roll < 0.4 ? ALL_MELEE : roll < 0.75 ? ALL_RANGED : ALL_ARMOR;
      // early missions on low difficulties hand out simpler gear; later on, anything
      const cap = this.playMode === 'hard' || this.playMode === 'nightmare' ? 9 : this.levelIdx + 1 + Math.floor(this.diff / 3);
      const pool = list.filter((g) => gearTier(g) <= cap);
      const id = pool[Math.floor(Math.random() * pool.length)] ?? list[0];
      key = makeKey(id, lv);
      this.save.owned.push(key);
    }
    this.found.push(key);
    this.onBanner(why, `${itemName(key)} · Level ${lv}. Equip it from your inventory (Shift).`);
    this.float(this.x, this.y - 0.2, `${itemName(key)} Lv ${lv}`, '#ffe066');
    this.ring(this.x, this.y, 1.6, '#ffe066', 0.5);
    this.onSound('rare');
    this.onSave();
    return key;
  }
  /** host: everyone on the team gets a roll of their own (each from their own power) */
  private dropForAll(what: 'gear' | 'art', why: string) {
    this.grantDrop(what, why);
    for (const p of this.peers) this.onPeerGain(p.id, what === 'gear' ? { gear: 1 } : { art: 1 });
  }
  /** throws an item away (its enchant points come back) */
  salvage(key: ItemKey): string | null {
    if (key === this.save.melee || key === this.save.ranged || key === this.save.armor || this.save.slots.includes(key)) return 'Take it off first.';
    this.save.owned = this.save.owned.filter((k) => k !== key);
    this.save.arts = this.save.arts.filter((k) => k !== key);
    if (this.save.ench) delete this.save.ench[key];
    this.onSave();
    return null;
  }
  get rollMax() {
    return (this.armor.quickroll ? 0.42 : 0.85) * (this.armor.rollMul ?? 1);
  }
  get soulHeal() {
    return (this.melee.soulHeal ?? 0) + (this.ranged.soulHeal ?? 0) + (this.armor.soulHeal ?? 0);
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
    this.onBanner(this.def.name, `${this.M.name} · Difficulty ${this.diff + 1} · monsters level ${this.threat}`);
    this.sound('portal');
  }

  private resetRun() {
    this.monsters = [];
    this.allies = [];
    this.beams = [];
    this.totems = [];
    this.bolts = [];
    this.strikes = [];
    this.targetId = 0;
    this.speedT = this.ironT = 0;
    this.artCd = [0, 0, 0];
    this.shots = [];
    this.drops = [];
    this.parts = [];
    this.floats = [];
    this.rings = [];
    this.warns = [];
    this.vx = this.vy = 0;
    this.dead = false;
    this.rollT = this.swingT = this.hurtT = this.slowT = this.burnT = 0;
    this.kills = 0;
    this.souls = 0;
    this.found = [];
    this.quiver = null;
    this.bossAwake = false;
    this.guardian = null;
    this.flow = new Int16Array(this.L.w * this.L.h);
    this.flowT = 0;
    this.propGrid = null;
  }

  private populate(seed: number) {
    const r = rng(seed ^ 0x5bd1e995);
    const L = this.L;
    const tier = this.levelIdx;
    const midRoom = Math.floor(L.rooms.length / 2);
    const hogRoom = r() < 0.6 ? 1 + Math.floor(r() * (L.rooms.length - 2)) : -1;
    L.rooms.forEach((rm, i) => {
      if (i === 0) return;
      if (i === L.bossRoom) {
        const gd = this.def.guardian;
        const m = this.spawn(gd.kind, rm.cx + 0.5, rm.cy - 2.5, true);
        m.name = gd.name;
        m.scale = gd.scale;
        m.hp = m.maxHp = Math.round(gd.hp * this.hpMul);
        if (MONSTERS[gd.kind].style !== 'boss') m.dmg = Math.round(MONSTERS[gd.kind].dmg * (MONSTERS[gd.kind].mini ? 1.15 : 1.6) * this.dmgMul);
        m.ench = undefined;
        this.guardian = m;
        for (let k = 0; k < 2 + Math.floor(tier / 2); k++) {
          const kind = this.def.monsters[Math.floor(r() * this.def.monsters.length)];
          this.spawn(kind, rm.x + 1 + r() * (rm.w - 2), rm.y + 1 + r() * (rm.h - 2));
        }
        return;
      }
      if (i === midRoom && this.def.mini) {
        const m = this.spawn(this.def.mini, rm.cx + 0.5, rm.cy + 0.5);
        m.ench = undefined;
      }
      if (i === hogRoom) {
        const m = this.spawn('loot-hog', rm.cx + 0.5, rm.cy + 0.5);
        m.ench = undefined;
      }
      const n = 2 + Math.floor(r() * (3 + Math.ceil(tier * 0.4))) + (rm.w * rm.h > 70 ? 1 : 0) + this.D.more;
      for (let k = 0; k < n; k++) {
        const kind = this.def.monsters[Math.floor(r() * this.def.monsters.length)];
        for (let tries = 0; tries < 10; tries++) {
          const x = rm.x + 0.5 + r() * (rm.w - 1), y = rm.y + 0.5 + r() * (rm.h - 1);
          if (this.walkable(x, y)) {
            this.spawn(kind, x, y);
            break;
          }
        }
      }
    });
  }

  spawn(kind: MonsterKind, x: number, y: number, guardian = false): Monster {
    const def = MONSTERS[kind];
    const hp = Math.round(def.hp * this.hpMul);
    const m: Monster = {
      id: this.nextId++, kind, def, name: def.name, x, y, hp, maxHp: hp, dmg: Math.round(def.dmg * this.dmgMul),
      scale: def.mini ? 1.15 : 1, guardian, state: 'idle', t: 0, cd: 0.5 + Math.random(), special: 3 + Math.random() * 3, face: Math.random() * 6.28, awake: false,
      slowT: 0, burnT: 0, stunT: 0, flash: 0, kx: 0, ky: 0, walk: Math.random() * 10, hover: Math.random() * 6, dead: false,
    };
    // Hard and Nightmare: some monsters come enchanted
    if (!def.mini && def.style !== 'boss' && kind !== 'loot-hog' && Math.random() < this.M.enchanted) this.enchantMob(m, false);
    this.monsters.push(m);
    return m;
  }
  enchantMob(m: Monster, fx = true) {
    const e = (['swift', 'shield', 'strong'] as MobEnch[])[Math.floor(Math.random() * 3)];
    m.ench = e;
    if (e === 'strong') m.dmg = Math.round(m.dmg * 1.5);
    if (fx) {
      this.ring(m.x, m.y, 1.2, mobEnchColor(e), 0.4);
      this.burst(m.x, m.y, 0.8, mobEnchColor(e), 10, 2);
    }
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
    this.propGrid = null;
  }
  walkable(x: number, y: number, flier = false) {
    const t = tileAt(this.L, Math.floor(x), Math.floor(y));
    if (!flier && t === T.HAZARD && this.def.hazard === 'lava') return false;
    return !this.solidAt(Math.floor(x), Math.floor(y), flier);
  }
  /** if you're ever inside a wall, a tree or a crate, hop to the nearest open spot */
  unstick() {
    const open = (x: number, y: number) => !this.solidAt(Math.floor(x), Math.floor(y));
    const free = (x: number, y: number) => open(x - 0.2, y - 0.2) && open(x + 0.2, y - 0.2) && open(x - 0.2, y + 0.2) && open(x + 0.2, y + 0.2);
    if (free(this.x, this.y)) return false;
    for (let r = 0.5; r <= 12; r += 0.5)
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = Math.floor(this.x + Math.cos(a) * r) + 0.5, y = Math.floor(this.y + Math.sin(a) * r) + 0.5;
        if (free(x, y)) {
          this.x = x;
          this.y = y;
          this.vx = this.vy = 0;
          return true;
        }
      }
    return false;
  }
  private stuckCheck = 0;
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
    const starts = [[sx, sy], ...this.peers.filter((p) => !p.dead).map((p) => [Math.floor(p.x), Math.floor(p.y)])];
    if (this.dead && starts.length > 1) starts.shift();
    for (const [x, y] of starts) {
      const i = y * W + x;
      if (i < 0 || i >= f.length || f[i] === 0) continue;
      f[i] = 0;
      q[tl++] = i;
    }
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
  /** a number only you see (your own damage taken, pickups) */
  private floatLocal(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, z: 1.6, text, color, life: 1.1 });
  }
  ring(x: number, y: number, max: number, color: string, life = 0.4) {
    this.fxOut?.push(['r', +x.toFixed(2), +y.toFixed(2), max, color, life]);
    this.rings.push({ x, y, r: 0.2, max, life, total: life, color });
  }

  // ---------- combat ----------
  hurtHero(dmg: number, fromX: number, fromY: number, effect?: 'slow' | 'burn') {
    if (this.dead || this.rollT > 0 || this.hurtT > 0) return;
    const real = Math.max(1, Math.round((dmg * (1 - this.armor.block) * (this.ironT > 0 ? 0.25 : 1)) / armorDef(parseKey(this.save.armor).lv)));
    this.hp -= real;
    this.hurtT = 0.45;
    this.shake = Math.min(1, this.shake + 0.35);
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.vx += ((this.x - fromX) / d) * 6;
    this.vy += ((this.y - fromY) / d) * 6;
    if (effect === 'slow') this.slowT = 2;
    if (effect === 'burn') this.burnT = Math.max(this.burnT, 2);
    // how much damage you took, right over your head
    this.floatLocal(this.x, this.y, `-${real}`, '#ff5a5a');
    this.burst(this.x, this.y, 0.8, '#d83a3a', 6);
    this.sound('hurt');
    // thorns hurt back whatever hit you
    const th = this.armor.thorns ?? 0;
    if (th > 0 && !this.remote) {
      const near = this.monsters.find((m) => !m.dead && Math.hypot(m.x - fromX, m.y - fromY) < 1.5);
      if (near) this.hurtMonster(near, Math.max(1, dmg * th * gearMul(parseKey(this.save.armor).lv) * 0.5), this.x, this.y, 1);
    }
    if (this.hp <= 0) this.die();
  }
  private die() {
    this.hp = 0;
    this.dead = true;
    this.deadT = 0;
    this.burnT = 0;
    this.allDownSent = false;
    this.sound('die');
  }

  hurtMonster(m: Monster, dmg: number, fromX: number, fromY: number, knock: number, effect?: 'slow' | 'burn' | 'stun' | 'poison', element?: Element, crit = 0) {
    if (m.dead) return;
    const isCrit = Math.random() < 0.08 + crit;
    const me = m.def.element;
    const strong = !!element && !!me && element !== me;
    const shield = m.ench === 'shield' ? 0.5 : 1;
    const real = Math.max(1, Math.round(dmg * (isCrit ? 2 : 1) * (strong ? ELEMENT_BONUS : 1) * shield * (0.9 + Math.random() * 0.2)));
    if (element === 'fire') effect = effect === 'stun' ? effect : 'burn';
    if (element === 'ice' && effect !== 'stun') effect = 'slow';
    m.hp -= real;
    m.flash = 0.12;
    if (!m.awake) this.wake(m);
    const d = Math.hypot(m.x - fromX, m.y - fromY) || 1;
    const heavy = m.guardian || m.def.style === 'boss' || m.def.mini;
    const k = knock / (heavy ? 4 : m.kind.startsWith('armored') || m.kind === 'bog-rider' ? 2 : 1);
    m.kx += ((m.x - fromX) / d) * k;
    m.ky += ((m.y - fromY) / d) * k;
    if (effect === 'slow') m.slowT = ICE_SLOW;
    if (effect === 'burn') m.burnT = 3;
    if (effect === 'poison') m.poisonT = 4;
    if (strong) this.burst(m.x, m.y, 0.8 * m.scale, element === 'fire' ? '#ff8a3a' : '#aee8ff', 10, 3);
    if (effect === 'stun' && !heavy) {
      m.stunT = 0.9;
      m.state = 'recover';
    }
    this.float(m.x, m.y, strong ? `${real}!!` : isCrit ? `${real}!` : `${real}`, strong ? (element === 'fire' ? '#ff9a4a' : '#9ae6ff') : isCrit ? '#ffe066' : '#ffffff');
    this.burst(m.x, m.y, 0.7 * m.scale, this.bloodColor(m.kind), 5);
    this.sound('hit');
    if (m.hp <= 0) this.killMonster(m);
  }

  bloodColor(k: MonsterKind) {
    return k === 'gloop' ? '#7ae05a' : k === 'fizzler' ? '#ff9a3a' : k === 'shambler' || k === 'armored-shambler' || k === 'bog-rider' ? '#8aa06a' : k === 'rattler' || k === 'armored-rattler' ? '#e8e0d0'
      : k === 'hexer' || k === 'hex-lord' || k === 'void-stalker' || k === 'nyxwing' ? '#b07aff' : k === 'ember-golem' ? '#ff6a2a' : k === 'gloomguard' ? '#5ae0d0' : k === 'loot-hog' ? '#ffb0c0' : '#c8b8a8';
  }

  private wake(m: Monster) {
    m.awake = true;
    if (m.guardian && !this.bossAwake) {
      this.bossAwake = true;
      this.onBanner(m.name, m.def.style === 'boss' ? 'The final boss!' : 'The boss of this mission.');
      this.sound('roar');
    } else if (m.def.mini && !m.guardian) {
      this.onBanner(m.name, 'A mini-boss!');
      this.sound('roar');
    }
  }

  private killMonster(m: Monster, by = '') {
    m.dead = true;
    if (m.kind !== 'loot-hog') this.kills++;
    this.burst(m.x, m.y, 0.6 * m.scale, this.bloodColor(m.kind), 18 * m.scale, 4, 0.12);
    this.sound(m.guardian || m.def.mini ? 'bossdie' : 'kill');
    // xp for everyone on the team
    const xp = Math.max(1, Math.round(m.def.xp * this.D.xp * (m.guardian ? 3 : 1) * (1 + this.threat / 40)));
    this.gainXp(xp);
    for (const p of this.peers) this.onPeerGain(p.id, { xp });
    // souls
    const souls = m.def.style === 'boss' ? 12 : m.def.mini ? 6 : m.minion ? 0 : 1;
    const extra = Math.random() < (this.melee.soulBonus ?? 0) ? 2 : 0;
    for (let i = 0; i < souls + extra; i++) this.drop(m.x, m.y, 'soul', 1);
    if (Math.random() < 0.18) this.drop(m.x, m.y, 'arrows', 4 + Math.floor(Math.random() * 5));
    void by;
    if (m.kind === 'loot-hog') {
      this.onMsg('You caught the Loot Hog!');
      this.dropForAll('gear', 'Loot Hog gear!');
      if (Math.random() < 0.35) this.dropForAll('art', 'Loot Hog artifact!');
    } else if (m.def.mini && !m.guardian) {
      this.dropForAll('gear', 'Mini-boss gear!');
    } else if (!m.guardian && !m.minion && Math.random() < MOB_GEAR_CHANCE) this.dropForAll('gear', 'Lucky drop!');
    if (m.kind === 'gloop' && !m.small) {
      // it splits in two
      for (const s of [-1, 1]) {
        const x = m.x + s * 0.3, y = m.y - s * 0.2;
        const c = this.spawn('gloop', this.walkable(x, y) ? x : m.x, this.walkable(x, y) ? y : m.y);
        c.small = true;
        c.scale = 0.6;
        c.hp = c.maxHp = Math.max(1, Math.round(m.maxHp * 0.35));
        c.dmg = Math.round(m.dmg * 0.6);
        c.awake = true;
        c.ench = undefined;
      }
    }
    if (m.guardian) {
      this.shake = 1;
      this.L.portal.open = true;
      this.ring(m.x, m.y, 5, this.def.accent, 0.9);
      this.onBanner(`${m.name} is beaten!`, 'A portal opened in the middle of the room. Step in to finish the mission.');
      this.sound('portal');
      // everyone else in the room vanishes
      for (const o of this.monsters) if (!o.dead && o.minion) o.dead = true;
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
    const a = Math.random() * Math.PI * 2, d = 0.2 + Math.random() * 0.7;
    const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
    this.drops.push({ x: this.walkable(nx, ny) ? nx : x, y: this.walkable(nx, ny) ? ny : y, kind, n, t: 0 });
  }

  private swing() {
    const w = this.melee;
    this.meleeCd = w.rate;
    this.swingT = this.swingDur = Math.min(0.32, w.rate * 0.85);
    this.sound(w.shape === 'fist' ? 'punch' : w.effect === 'stun' ? 'slam' : 'swing');
    if (this.remote) this.onAct({ a: 'swing', face: this.face, key: this.save.melee, en: this.enchOf(this.save.melee) });
    else this.meleeHit(this.x, this.y, this.face, w, (n) => this.leechHeal(n));
  }

  private leechHeal(n: number) {
    if (this.dead || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + n);
  }
  meleeHit(x0: number, y0: number, face: number, w: Melee, heal?: (n: number) => void) {
    const half = (w.arc * Math.PI) / 360;
    for (const m of this.monsters) {
      if (m.dead || (m.charmT ?? 0) > 0) continue;
      const dx = m.x - x0, dy = m.y - y0;
      const d = Math.hypot(dx, dy);
      if (d > w.reach + m.def.radius * m.scale) continue;
      let da = Math.atan2(dy, dx) - face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (w.arc < 360 && Math.abs(da) > half + 0.25 && d > 0.6) continue;
      const fx = w.effect ?? (w.burnChance && Math.random() < w.burnChance ? 'burn' : w.slowChance && Math.random() < w.slowChance ? 'slow' : undefined);
      this.hurtMonster(m, w.dmg, x0, y0, w.knock, fx, w.element, w.crit ?? 0);
      if (w.leech && heal) heal(w.leech);
    }
    if (w.effect === 'stun') {
      this.ring(x0, y0, w.reach, '#ffe066', 0.35);
      this.shake = Math.min(1, this.shake + 0.3);
    }
    // smash crates, barrels and pumpkins
    for (const p of this.L.props) {
      if ((p.kind !== 'crate' && p.kind !== 'barrel' && p.kind !== 'pumpkin') || p.hp <= 0 || p.hp > 50) continue;
      const dx = p.x + 0.5 - x0, dy = p.y + 0.5 - y0;
      if (Math.hypot(dx, dy) > w.reach + 0.5) continue;
      let da = Math.atan2(dy, dx) - face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (w.arc < 360 && Math.abs(da) > half + 0.4) continue;
      this.smash(p);
    }
  }
  private smash(p: Prop) {
    p.hp = 0;
    this.propsDirty();
    this.burst(p.x + 0.5, p.y + 0.5, 0.5, p.kind === 'crate' ? '#a0713f' : p.kind === 'pumpkin' ? '#ff9a2a' : '#7a4a28', 14, 3, 0.1);
    this.sound('crate');
    const roll = Math.random();
    if (roll < 0.45) this.drop(p.x + 0.5, p.y + 0.5, 'arrows', 5);
    else if (roll < 0.7) this.drop(p.x + 0.5, p.y + 0.5, 'soul', 1);
  }

  arrowCount() {
    return this.save.arrows;
  }

  private shoot(angle: number) {
    const w = this.ranged;
    if (this.save.arrows <= 0) {
      this.rangedCd = 0.4;
      this.onMsg('Out of arrows! Smash crates and beat monsters to find more.');
      return;
    }
    this.save.arrows--;
    this.face = angle;
    this.rangedCd = w.rate;
    this.drawT = 0.18;
    this.sound('bow');
    let q: Quiver | undefined;
    if (this.quiver) {
      q = this.quiver.kind;
      if (--this.quiver.n <= 0) this.quiver = null;
    }
    if (this.remote) this.onAct({ a: 'shoot', angle, key: this.save.ranged, en: this.enchOf(this.save.ranged), q });
    else this.fireArrows(this.x, this.y, angle, this.save.ranged, this.enchOf(this.save.ranged), q, '');
  }

  /** the arrows themselves, from any player */
  fireArrows(x0: number, y0: number, angle: number, rangedKey: ItemKey, en: EnchSet = {}, q?: Quiver, owner = '') {
    const w = enchantRanged(rangedOf(rangedKey), en);
    const { id } = parseKey(rangedKey);
    const kind = q === 'firework' ? 'firework' : w.shape === 'crossbow' ? 'bolt' : id === 'starlight-bow' || id === 'storm-bow' ? 'star' : 'arrow';
    const shots = w.shots + (w.extraShot && Math.random() < w.extraShot ? 2 : 0);
    const spread = w.spread || (shots > 1 ? 0.14 : 0);
    const color = q === 'fire' ? '#ff8a3a' : q === 'poison' ? '#8ae04a' : q === 'firework' ? '#ff6ad6' : w.burn ? '#ff8a3a' : w.chill ? '#aee8ff' : id === 'storm-bow' ? '#9ab0ff' : undefined;
    for (let i = 0; i < shots; i++) {
      const a = angle + (i - (shots - 1) / 2) * spread;
      let effect: Shot['effect'] = q === 'fire' || w.burn ? 'burn' : q === 'poison' ? 'poison' : q === 'firework' ? 'bigboom' : w.chill ? 'slow' : undefined;
      if (!effect) effect = w.burnChance && Math.random() < w.burnChance ? 'burn' : w.slowChance && Math.random() < w.slowChance ? 'slow' : w.poisonChance && Math.random() < w.poisonChance ? 'poison' : undefined;
      this.shots.push({
        x: x0 + Math.cos(a) * 0.4, y: y0 + Math.sin(a) * 0.4, z: 0.9, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg, from: 'hero', kind, pierce: q === 'firework' ? 0 : w.pierce, hit: new Set(), life: 1.4, element: q === 'fire' ? 'fire' : w.element, color, effect, owner,
      });
      if (q === 'firework') break;
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
      if (m.dead || (m.charmT ?? 0) > 0) continue;
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
  nearestEnemy(range: number, fx = this.x, fy = this.y): Monster | null {
    let best: Monster | null = null, bd = range;
    for (const m of this.monsters) {
      if (m.dead || (m.charmT ?? 0) > 0) continue;
      const d = Math.hypot(m.x - fx, m.y - fy);
      if (d < bd && this.lineOfSight(fx, fy, m.x, m.y)) {
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
    const key = this.save.slots[i];
    if (!key) {
      this.onMsg(`Artifact slot ${i + 1} is empty. Put an artifact on it from your inventory (Shift).`);
      return;
    }
    if (this.artCd[i] > 0) return;
    const { id: raw, lv } = parseKey(key);
    const id = raw as unknown as ArtifactId;
    const A = ARTIFACTS[id];
    if (!A) return;
    if (A.souls && this.souls < A.souls) {
      this.onMsg(`${A.name} needs ${A.souls} souls. You have ${this.souls}. Beat monsters to collect more.`);
      this.artCd[i] = 0.4;
      return;
    }
    if (this.mode === 'camp' && A.souls) {
      this.onMsg('Save your souls for a mission!');
      return;
    }
    this.souls -= A.souls;
    this.artCd[i] = A.cooldown;
    this.sound('artifact');
    if (id === 'ghost-boots') {
      this.speedT = 5;
      this.burst(this.x, this.y, 0.2, '#b8a8ff', 14, 2);
    } else if (id === 'ironhide-charm') {
      this.ironT = 6;
      this.ring(this.x, this.y, 1.2, '#c8d0d8', 0.4);
    } else if (id === 'fire-quiver' || id === 'poison-quiver') {
      this.quiver = { kind: id === 'fire-quiver' ? 'fire' : 'poison', n: 8 };
      this.onMsg(`Your next 8 arrows ${id === 'fire-quiver' ? 'burn' : 'poison'}!`);
      this.burst(this.x, this.y, 0.8, A.color, 12, 2);
    } else if (id === 'firework-arrow') {
      this.quiver = { kind: 'firework', n: 1 };
      this.onMsg('A firework is tied to your next arrow!');
      this.burst(this.x, this.y, 0.8, A.color, 12, 2);
    } else if (this.remote) this.onAct({ a: 'art', id, lv, face: this.face });
    else this.artifactAt(id, this.x, this.y, lv, this.face, '');
  }

  /** artifacts that touch the world, from any player (the host runs them) */
  artifactAt(id: ArtifactId, x0: number, y0: number, lv: number, face: number, owner: string) {
    const P = gearMul(lv);
    if (id === 'healing-totem') {
      this.totems.push({ x: x0, y: y0, t: 7 });
      this.burst(x0, y0, 0.5, '#6fe08a', 16, 2);
    } else if (id === 'gust-horn') {
      this.ring(x0, y0, 4, '#cfe8ff', 0.45);
      for (const m of this.monsters) {
        if (m.dead || (m.charmT ?? 0) > 0) continue;
        if (Math.hypot(m.x - x0, m.y - y0) > 4) continue;
        this.hurtMonster(m, 6 * P, x0, y0, 14, m.guardian || m.def.mini ? undefined : 'stun');
      }
    } else if (id === 'thunder-charm') {
      const near = this.monsters.filter((m) => !m.dead && !(m.charmT ?? 0) && Math.hypot(m.x - x0, m.y - y0) < 9).sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0)).slice(0, 5);
      for (const m of near) {
        this.bolt(m.x, m.y);
        this.hurtMonster(m, 30 * P, m.x, m.y - 0.1, 1, m.guardian || m.def.mini ? undefined : 'stun');
      }
      this.shake = Math.min(1, this.shake + 0.4);
      this.sound('thunder');
    } else if (id === 'soul-beacon') {
      this.beams.push({ owner, x: x0, y: y0, face, t: 3, dmg: 9 * P, tick: 0 });
      this.sound('beam');
    } else if (id === 'soul-mender') {
      this.ring(x0, y0, 6, '#7af0e0', 0.6);
      this.burst(x0, y0, 0.8, '#7af0e0', 24, 3);
      if (Math.hypot(this.x - x0, this.y - y0) < 6 && !this.dead) this.healHero(Math.round(this.maxHp * 0.4));
      for (const p of this.peers) if (!p.dead && Math.hypot(p.x - x0, p.y - y0) < 6) this.onPeerGain(p.id, { heal: Math.round(p.maxHp * 0.4) });
    } else if (id === 'old-bone' || id === 'hay-bundle') {
      const kind = id === 'old-bone' ? 'wolf' : 'llama';
      this.allies = this.allies.filter((a) => !(a.owner === owner && a.kind === kind));
      const a = Math.random() * Math.PI * 2;
      const x = x0 + Math.cos(a) * 0.8, y = y0 + Math.sin(a) * 0.8;
      this.allies.push({ id: this.nextId++, kind, owner, x: this.walkable(x, y) ? x : x0, y: this.walkable(x, y) ? y : y0, face: face, walk: 0, t: 30, cd: 0.5, dmg: (kind === 'wolf' ? 10 : 8) * P });
      this.burst(x0, y0, 0.5, kind === 'wolf' ? '#e8e0d0' : '#e8c860', 16, 2);
      this.sound('summon');
    } else if (id === 'charm-medallion') {
      const near = this.monsters
        .filter((m) => !m.dead && !m.guardian && !m.def.mini && m.def.style !== 'boss' && m.kind !== 'loot-hog' && Math.hypot(m.x - x0, m.y - y0) < 7)
        .sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0))
        .slice(0, 5);
      if (!near.length) this.onMsg('No monsters close enough to charm.');
      for (const m of near) {
        m.charmT = 10;
        m.awake = true;
        m.state = 'chase';
        this.burst(m.x, m.y, 1, '#ff7aa8', 12, 2);
      }
      if (this.targetId && near.some((m) => m.id === this.targetId)) this.targetId = 0;
      this.ring(x0, y0, 7, '#ff7aa8', 0.5);
    } else if (id === 'soul-quiver') {
      for (const o of [-0.2, 0, 0.2]) {
        const a = face + o;
        this.shots.push({ x: x0 + Math.cos(a) * 0.4, y: y0 + Math.sin(a) * 0.4, z: 0.9, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, dmg: 14 * P, from: 'hero', kind: 'soul', pierce: 99, hit: new Set(), life: 3, color: '#9ae0ff', bounce: 10, knock: 5, owner });
      }
      this.sound('beam');
    }
  }
  private healHero(n: number) {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.floatLocal(this.x, this.y, `+${n}`, '#6fe08a');
  }

  private monsterShoot(m: Monster, angle: number, kind: MonsterShot, speed = 7, dmg = m.dmg) {
    this.shots.push({
      x: m.x + Math.cos(angle) * 0.4, y: m.y + Math.sin(angle) * 0.4, z: 0.8 * Math.min(2, m.scale), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      dmg, from: 'monster', kind, pierce: 0, hit: new Set(), life: 3,
    });
  }

  private explode(x: number, y: number, r: number, dmg: number, hitsPlayers: boolean, hitsMobs: boolean) {
    this.ring(x, y, r, '#ffb347', 0.4);
    this.burst(x, y, 0.4, '#ffb347', 26, 6, 0.12);
    this.burst(x, y, 0.4, '#555', 12, 3, 0.16);
    this.shake = 1;
    this.sound('boom');
    if (hitsMobs) for (const m of this.monsters) if (!m.dead && !(m.charmT ?? 0) && Math.hypot(m.x - x, m.y - y) < r + m.def.radius) this.hurtMonster(m, dmg, x, y, 6, 'burn');
    if (hitsPlayers) for (const T of this.targets()) if (Math.hypot(T.x - x, T.y - y) < r) this.hurtTarget(T, dmg, x, y);
    for (const p of this.L.props)
      if ((p.kind === 'crate' || p.kind === 'barrel' || p.kind === 'pumpkin') && p.hp > 0 && p.hp < 50 && Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y) < r) this.smash(p);
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
    this.floatLocal(this.x, this.y, `+${heal}`, '#6fe08a');
    this.burst(this.x, this.y, 1, '#ff5a8a', 14, 2);
    this.sound('drink');
  }

  // ---------- update ----------
  update(dt: number, inp: Input) {
    this.time += dt;
    for (const p of this.mates) {
      p.swingT = Math.max(0, p.swingT - dt);
      p.drawT = Math.max(0, p.drawT - dt);
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    if (this.dead) {
      this.deadT += dt;
      if (!this.coop) {
        this.updateEffects(dt);
        if (this.deadT > 1.8 && this.deadT - dt <= 1.8) this.onDeath();
        return;
      }
      const mate = this.mates.find((m) => !m.dead);
      if (mate && this.deadT >= RESPAWN_AFTER) {
        this.x = mate.x;
        this.y = mate.y;
        this.revived('');
      } else if (!this.remote && !mate && this.deadT > 1.8 && !this.allDownSent) {
        this.allDownSent = true;
        this.onBothDown();
      }
    } else this.updateHero(dt, inp);
    if (this.remote) {
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
      this.updateAllies(dt);
      this.updateBeams(dt);
      this.updateStrikes(dt);
      this.reveal();
    }
    this.updateTotems(dt);
    this.updateShots(dt);
    this.updateDrops(dt);
    this.updateEffects(dt);
    this.monsters = this.monsters.filter((m) => !m.dead);
  }

  private updateTotems(dt: number) {
    for (const t of this.totems) {
      t.t -= dt;
      if (!this.dead && Math.hypot(t.x - this.x, t.y - this.y) < 2.6 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + 9 * dt);
        if (Math.random() < dt * 6) this.parts.push({ x: this.x + (Math.random() - 0.5) * 0.5, y: this.y + (Math.random() - 0.5) * 0.5, z: 0.5, vx: 0, vy: 0, vz: 2, life: 0.6, max: 0.6, color: '#6fe08a', size: 0.07 });
      }
      for (const p of this.peers) if (!p.dead && Math.hypot(t.x - p.x, t.y - p.y) < 2.6) this.onPeerGain(p.id, { heal: 9 * dt });
    }
    this.totems = this.totems.filter((t) => t.t > 0);
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
        this.floatLocal(this.x, this.y, '🧪 ready', '#ff8ab0');
        this.onSound('pickup');
      }
    }
    this.speedT -= dt;
    this.ironT -= dt;
    for (let i = 0; i < 3; i++) this.artCd[i] = Math.max(0, this.artCd[i] - dt);
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
    const gx = (mx + my) * Math.SQRT1_2, gy = (my - mx) * Math.SQRT1_2;
    this.moving = ml > 0.1;

    const busy = this.swingT > 0 || this.drawT > 0;
    if (!busy) {
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
    this.stuckCheck -= dt;
    if (this.stuckCheck <= 0) {
      this.stuckCheck = 0.5;
      this.unstick();
    }
    if (this.moving || this.rollT > 0) this.walk += dt * 10;
    if (this.speedT > 0 && this.moving && Math.random() < dt * 14) this.burst(this.x, this.y, 0.1, '#b8a8ff', 1, 0.5);
    if (onHaz && this.def.hazard === 'lava' && this.rollT <= 0 && !this.armor.lavaproof) {
      if (this.burnT <= 0) this.onMsg('You’re on fire! Get off the lava.');
      this.burnT = 2.5;
    }
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (this.armor.lavaproof && onHaz) this.burnT = 0;
      this.hp -= (9 * dt * (1 - this.armor.block * 0.5) * (this.ironT > 0 ? 0.25 : 1) * (this.mode === 'dungeon' ? this.dmgMul : 1)) / armorDef(parseKey(this.save.armor).lv);
      if (Math.random() < dt * 18) this.burst(this.x, this.y, 0.5 + Math.random() * 0.5, Math.random() < 0.5 ? '#ff8a2a' : '#ffd040', 1, 1.2, 0.05);
      if (this.hp <= 0) this.die();
    }

    if (inp.melee && this.meleeCd <= 0 && this.rollT <= 0) {
      this.face = this.meleeAngle(inp);
      this.swing();
    }
    if (this.rangedCd <= 0 && this.rollT <= 0) {
      if (inp.ranged) this.shoot(this.bowAngle(inp));
      else if (this.ranged.auto && (inp.autoFire ?? true) && this.save.arrows > 0) {
        const t = this.target() ?? this.nearestEnemy(8.5);
        if (t && t.awake) this.shoot(this.bowAngle(inp));
      }
    }
    if (inp.artifact !== undefined && inp.artifact >= 0) this.useArtifact(inp.artifact);
    if (inp.potion) this.drinkPotion();

    // a downed teammate next to you: hold E to get them back up
    const mate = this.mates.find((m) => m.dead && Math.hypot(m.x - this.x, m.y - this.y) < 1.4);
    this.reviveNear = !!mate;
    if (this.reviveNear && inp.useHeld) {
      this.reviveT += dt;
      if (Math.random() < dt * 20) this.burst(mate!.x, mate!.y, 0.4, '#ffe066', 1, 1.5);
      if (this.reviveT >= REVIVE_TIME) {
        this.reviveT = 0;
        this.burst(mate!.x, mate!.y, 0.6, '#ffe066', 20, 2.5);
        this.sound('artifact');
        this.onMsg(`You revived ${mate!.name}!`);
        mate!.dead = false;
        if (this.remote) this.onAct({ a: 'revive', who: mate!.id });
        else this.onReviveMate(mate!.id, '');
      }
    } else this.reviveT = 0;
    this.near = this.reviveNear ? null : this.findNear();
    if (inp.use && this.near) this.near.act();
  }

  private findNear(): { label: string; act: () => void } | null {
    if (this.mode === 'camp') {
      const table = this.L.props.find((p) => p.kind === 'table')!;
      if (Math.hypot(table.x + 0.5 - this.x, table.y + 0.5 - this.y) < 1.8) return { label: 'Open the mission map', act: () => this.onMissionTable() };
      return null;
    }
    const P = this.L.portal;
    if (P.open && Math.hypot(P.x + 0.5 - this.x, P.y + 0.5 - this.y) < 1.2)
      return { label: this.coop ? 'Step into the portal (takes your team home)' : 'Step into the portal', act: () => (this.remote ? this.onAct({ a: 'portal' }) : this.finishLevel()) };
    for (const [i, p] of this.L.props.entries()) {
      if (p.kind !== 'chest' || p.open) continue;
      if (Math.hypot(p.x + 0.5 - this.x, p.y + 0.5 - this.y) < 1.4) return { label: 'Open the loot chest', act: () => (this.remote ? this.onAct({ a: 'chest', i }) : this.openChest(p)) };
    }
    return null;
  }

  openChest(p: Prop) {
    p.open = true;
    this.sound('chest');
    this.burst(p.x + 0.5, p.y + 0.5, 0.6, '#ffe066', 18, 2.5);
    const cx = p.x + 0.5, cy = p.y + 1.1;
    for (let i = 0; i < 3; i++) this.drop(cx, cy, 'soul', 1);
    this.drop(cx, cy, 'arrows', 10);
    const xp = Math.max(1, Math.round(6 * this.D.xp));
    this.gainXp(xp);
    for (const q of this.peers) this.onPeerGain(q.id, { xp });
    // a loot chest: gear for everyone (each rolls their own), sometimes an artifact
    if (Math.random() < this.D.gear) this.dropForAll('gear', 'Loot chest!');
    if (Math.random() < 0.22) this.dropForAll('art', 'Loot chest artifact!');
  }

  finishLevel() {
    const def = this.def;
    const first = !this.save.cleared.includes(def.id);
    if (first) this.save.cleared.push(def.id);
    if (!this.save.best) this.save.best = {};
    const bk = `${this.playMode}:${def.id}`;
    this.save.best[bk] = Math.max(this.save.best[bk] ?? -1, this.diff);
    // finishing a mission always gives a piece of gear, and sometimes an artifact
    this.grantDrop('gear', 'Mission reward!');
    if (Math.random() < 0.5) this.grantDrop('art', 'Mission reward!');
    let won = false, wonHard = false;
    if (def.id === LEVELS[LAST_LEVEL].id) {
      if (!this.save.won) won = true;
      this.save.won = true;
      if ((this.playMode === 'hard' || this.playMode === 'nightmare') && !this.save.wonHard) {
        this.save.wonHard = true;
        wonHard = true;
      }
    }
    const found = this.found.slice();
    this.sound('win');
    if (!this.remote) this.onFinish();
    this.enterCamp();
    this.onSave();
    if (won || wonHard) this.onWin(wonHard);
    else this.onLevelDone(def, found);
  }

  /** the players monsters can go after: you, and your teammates */
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

  /** back up after a teammate revived you (or after waiting) */
  revived(by: string) {
    if (!this.dead) return;
    this.dead = false;
    this.burnT = 0;
    this.hp = Math.round(this.maxHp * 0.5);
    this.hurtT = 1.5;
    this.burst(this.x, this.y, 0.6, '#ffe066', 16, 2);
    this.sound('artifact');
    this.onMsg(by ? `${by} revived you!` : 'Back on your feet!');
  }

  /** the host carries out what a guest did */
  peerAct(id: string, a: Act) {
    const p = this.peers.find((q) => q.id === id);
    if (a.a === 'revive') {
      const who = a.who && a.who !== 'host' ? this.peers.find((q) => q.id === a.who) : null;
      if (who) {
        who.dead = false;
        this.onReviveMate(who.id, p?.name ?? 'Your teammate');
      } else this.revived(p?.name ?? 'Your teammate');
      return;
    }
    if (!p || p.dead) return;
    if (a.a === 'swing') this.meleeHit(p.x, p.y, a.face, enchantMelee(meleeOf(cleanKey(a.key, isMelee)), cleanEnch(a.en)), (n) => this.onPeerGain(id, { heal: n }));
    else if (a.a === 'shoot') this.fireArrows(p.x, p.y, a.angle, cleanKey(a.key, isRanged) || 'shortbow~1~0', cleanEnch(a.en), a.q === 'fire' || a.q === 'poison' || a.q === 'firework' ? a.q : undefined, id);
    else if (a.a === 'art' && isArtifact(a.id)) this.artifactAt(a.id, p.x, p.y, Math.max(1, Math.min(MAX_LEVEL, Math.round(a.lv) || 1)), +a.face || 0, id);
    else if (a.a === 'chest') {
      const c = this.L.props[a.i];
      if (c && c.kind === 'chest' && !c.open && this.mode === 'dungeon') this.openChest(c);
    } else if (a.a === 'portal' && this.L.portal.open && this.mode === 'dungeon') this.finishLevel();
  }

  private ownerPos(owner: string): { x: number; y: number; face: number } | null {
    if (!owner) return this.dead ? null : { x: this.x, y: this.y, face: this.face };
    const p = this.peers.find((q) => q.id === owner);
    return p && !p.dead ? { x: p.x, y: p.y, face: p.face } : null;
  }

  private updateAllies(dt: number) {
    for (const a of this.allies) {
      a.t -= dt;
      a.cd -= dt;
      const own = this.ownerPos(a.owner) ?? { x: this.x, y: this.y, face: 0 };
      const tgt = this.nearestEnemy(9, a.x, a.y);
      const reach = a.kind === 'wolf' ? 0.9 : 5;
      let gx = own.x, gy = own.y, stopAt = 1.4;
      if (tgt && tgt.kind !== 'loot-hog') {
        gx = tgt.x;
        gy = tgt.y;
        stopAt = reach * 0.85 + tgt.def.radius * tgt.scale;
        const d = Math.hypot(tgt.x - a.x, tgt.y - a.y);
        a.face = Math.atan2(tgt.y - a.y, tgt.x - a.x);
        if (d < reach + tgt.def.radius * tgt.scale && a.cd <= 0) {
          if (a.kind === 'wolf') {
            a.cd = 0.8;
            this.hurtMonster(tgt, a.dmg, a.x, a.y, 2);
            this.sound('bite');
          } else {
            a.cd = 1.4;
            this.shots.push({ x: a.x, y: a.y, z: 1.1, vx: Math.cos(a.face) * 10, vy: Math.sin(a.face) * 10, dmg: a.dmg, from: 'hero', kind: 'spit', pierce: 0, hit: new Set(), life: 0.8, color: '#f0f0e0' });
          }
        }
      }
      const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
      if (d > 12 && !tgt) {
        // too far behind: hop back to the owner
        a.x = own.x;
        a.y = own.y;
      } else if (d > stopAt) {
        const sp = (a.kind === 'wolf' ? 5 : 3.6) * dt;
        this.moveCircle(a, (dx / d) * sp, (dy / d) * sp, 0.25, false, true);
        a.walk += sp * 3;
        if (!tgt) a.face = Math.atan2(dy, dx);
      }
    }
    const gone = this.allies.filter((a) => a.t <= 0);
    for (const a of gone) this.burst(a.x, a.y, 0.4, '#ffffff', 10, 2);
    this.allies = this.allies.filter((a) => a.t > 0);
  }

  private updateBeams(dt: number) {
    for (const b of this.beams) {
      b.t -= dt;
      const own = this.ownerPos(b.owner);
      if (!own) {
        b.t = 0;
        continue;
      }
      b.x = own.x;
      b.y = own.y;
      b.face = own.face;
      b.tick -= dt;
      if (b.tick > 0) continue;
      b.tick = 0.15;
      const cx = Math.cos(b.face), cy = Math.sin(b.face);
      for (const m of this.monsters) {
        if (m.dead || (m.charmT ?? 0) > 0) continue;
        const rx = m.x - b.x, ry = m.y - b.y;
        const along = rx * cx + ry * cy;
        const side = Math.abs(-rx * cy + ry * cx);
        if (along > 0 && along < BEAM_LEN && side < 0.6 + m.def.radius * m.scale) this.hurtMonster(m, b.dmg, b.x, b.y, 0.6);
      }
    }
    this.beams = this.beams.filter((b) => b.t > 0);
  }

  private updateStrikes(dt: number) {
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t > 0) continue;
      this.burst(s.x, s.y, 0.3, '#b07aff', 8, 3);
      for (const T of this.targets()) if (Math.hypot(T.x - s.x, T.y - s.y) < s.r) this.hurtTarget(T, s.dmg, s.x, s.y);
    }
    if (this.strikes.some((s) => s.t <= 0)) this.sound('pop');
    this.strikes = this.strikes.filter((s) => s.t > 0);
  }

  private updateMonsters(dt: number) {
    const all = this.targets();
    for (const m of this.monsters) {
      if (m.dead) continue;
      m.flash -= dt;
      m.hover += dt;
      m.slowT -= dt;
      m.stunT -= dt;
      if (m.burnT > 0) {
        m.burnT -= dt;
        if (Math.random() < dt * 6) this.burst(m.x, m.y, 0.8 * m.scale, '#ff8a2a', 1, 1);
        m.hp -= dt * Math.max(6, m.maxHp * 0.03);
        if (m.hp <= 0) {
          this.killMonster(m);
          continue;
        }
      }
      if ((m.poisonT ?? 0) > 0) {
        m.poisonT! -= dt;
        if (Math.random() < dt * 6) this.burst(m.x, m.y, 0.8 * m.scale, '#8ae04a', 1, 1);
        m.hp -= dt * Math.max(8, m.maxHp * 0.045);
        if (m.hp <= 0) {
          this.killMonster(m);
          continue;
        }
      }
      // knockback
      if (m.kx || m.ky) {
        this.moveCircle(m, m.kx * dt, m.ky * dt, m.def.radius * Math.min(m.scale, 1.4), !!m.def.fly, true);
        m.kx *= Math.pow(0.0005, dt);
        m.ky *= Math.pow(0.0005, dt);
        if (Math.abs(m.kx) + Math.abs(m.ky) < 0.05) m.kx = m.ky = 0;
      }
      if ((m.charmT ?? 0) > 0) {
        this.updateCharmed(m, dt);
        continue;
      }
      if (m.def.style === 'flee') {
        this.updateHog(m, dt, all);
        continue;
      }
      // go after the closest player
      let T: Tgt = all[0] ?? { id: '-', x: this.x, y: this.y };
      for (const c of all) if (Math.hypot(c.x - m.x, c.y - m.y) < Math.hypot(T.x - m.x, T.y - m.y)) T = c;
      const hx = T.x, hy = T.y;
      if (T.id === '-') continue;
      const dx = hx - m.x, dy = hy - m.y;
      const dist = Math.hypot(dx, dy);
      if (!m.awake) {
        if (dist < (m.guardian ? 7 : 8) && this.lineOfSight(m.x, m.y, hx, hy)) this.wake(m);
        else continue;
      }
      if (m.stunT > 0) continue;
      const fast = m.ench === 'swift' ? 1.3 : 1;
      const slow = (m.slowT > 0 ? 0.5 : 1) * fast;
      const r = m.def.radius * Math.min(m.scale, 1.4);
      const flier = !!m.def.fly;
      const toward = (sp: number) => this.stepToward(m, dx, dy, dist, hx, hy, sp, dt, r, flier);
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
      // specials
      m.special -= dt;
      if (m.kind === 'hexer' && m.special <= 0) {
        m.special = 5 + Math.random() * 2;
        const pal = this.monsters.find((o) => o !== m && !o.dead && !o.ench && !o.def.mini && o.def.style !== 'boss' && o.kind !== 'loot-hog' && o.kind !== 'hexer' && !(o.charmT ?? 0) && Math.hypot(o.x - m.x, o.y - m.y) < 6);
        if (pal) {
          this.enchantMob(pal);
          this.sound('cast');
        }
      }
      if (m.kind === 'void-stalker' && m.special <= 0 && dist < 9 && m.state === 'chase') {
        // blink behind the player
        m.special = 4 + Math.random() * 2;
        const bx = hx - (dx / (dist || 1)) * -1.2, by = hy - (dy / (dist || 1)) * -1.2;
        if (this.walkable(bx, by)) {
          this.burst(m.x, m.y, 1, '#b07aff', 16, 3);
          m.x = bx;
          m.y = by;
          this.burst(m.x, m.y, 1, '#b07aff', 16, 3);
          this.sound('blink');
          m.state = 'wind';
          m.t = 0.45;
          continue;
        }
      }
      if (m.kind === 'hex-lord' && m.special <= 0 && dist < 9 && m.state !== 'wind') {
        m.special = 4.5;
        const minions = this.monsters.filter((o) => o.minion && !o.dead).length;
        if (Math.random() < 0.35 && minions < 4) {
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            const x = m.x + Math.cos(a) * 1.6, y = m.y + Math.sin(a) * 1.6;
            if (!this.walkable(x, y)) continue;
            const s = this.spawn('shambler', x, y);
            s.awake = true;
            s.minion = true;
            this.burst(x, y, 0.5, '#b07aff', 12, 2);
          }
          this.sound('summon');
        } else {
          // a row of biting spikes rushing toward the player
          const a = Math.atan2(dy, dx);
          for (let k = 1; k <= 8; k++) {
            const x = m.x + Math.cos(a) * k * 0.9, y = m.y + Math.sin(a) * k * 0.9;
            if (isWallTile(tileAt(this.L, Math.floor(x), Math.floor(y)))) break;
            const t = 0.55 + k * 0.08;
            this.warn(x, y, 0.55, t);
            this.strikes.push({ x, y, r: 0.65, t, dmg: m.dmg });
          }
          this.sound('cast');
        }
      }
      // big guardians and the golem have a ring slam every few seconds
      if ((m.guardian || m.kind === 'ember-golem') && m.def.style === 'melee') {
        if (m.special <= 0 && m.state !== 'wind' && dist < 9) {
          m.special = m.kind === 'ember-golem' ? 5 : 6;
          m.state = 'special';
          m.t = 1;
          this.warn(m.x, m.y, 3.2, 1);
        }
        if (m.state === 'special') {
          m.t -= dt;
          if (m.t <= 0) {
            m.state = 'recover';
            m.cd = 0.8;
            this.ring(m.x, m.y, 3.2, this.bloodColor(m.kind), 0.4);
            this.shake = Math.min(1, this.shake + 0.5);
            this.sound('slam');
            for (const P of all) if (Math.hypot(P.x - m.x, P.y - m.y) < 3.2) this.hurtTarget(P, m.dmg, m.x, m.y);
          }
          continue;
        }
      }

      const reach = m.def.range * (m.guardian ? Math.max(1, m.scale * 0.6) : 1) + 0.3;
      if (m.state === 'wind') {
        m.t -= dt;
        m.face = Math.atan2(dy, dx);
        if (m.kind === 'fizzler') {
          // hissing: if you get away in time, it calms down
          if (Math.random() < dt * 20) this.burst(m.x, m.y, 0.9, '#ffffff', 1, 0.8, 0.05);
          if (dist > 3.4) {
            m.state = 'chase';
            continue;
          }
        }
        if (m.t <= 0) {
          m.state = 'recover';
          m.cd = m.def.cooldown * (0.8 + Math.random() * 0.4) * (m.ench === 'swift' ? 0.5 : 1);
          if (m.kind === 'fizzler') {
            m.dead = true;
            this.explode(m.x, m.y, 2.3, m.dmg, true, false);
            this.drop(m.x, m.y, 'soul', 1);
            continue;
          }
          if (m.def.style === 'ranged' && m.def.shot) {
            const a = Math.atan2(dy, dx);
            const sp = m.def.shot === 'mbolt' ? 11 : m.def.shot === 'bone' ? 9 : 6.5;
            this.monsterShoot(m, a, m.def.shot, sp);
            if (m.guardian) for (const o of [-0.3, 0.3]) this.monsterShoot(m, a + o, m.def.shot, sp);
            this.sound(m.def.shot === 'void' ? 'cast' : 'bow');
          } else {
            if (dist < reach + 0.5) this.hurtTarget(T, m.dmg, m.x, m.y);
            this.sound(m.kind === 'ember-golem' || m.kind.startsWith('armored') ? 'slam' : 'bite');
            if (m.guardian) this.ring(m.x + Math.cos(m.face) * 0.8, m.y + Math.sin(m.face) * 0.8, 1.5, '#fff', 0.25);
          }
        }
        continue;
      }
      if (m.state === 'recover') {
        m.cd -= dt;
        if (m.cd <= 0) m.state = 'chase';
        continue;
      }
      m.state = 'chase';
      m.cd -= dt;
      if (m.def.style === 'ranged') {
        const los = this.lineOfSight(m.x, m.y, hx, hy);
        if (dist > m.def.range || !los) toward(m.def.speed * slow);
        else if (dist < m.def.range * 0.45) toward(-m.def.speed * 0.8 * slow);
        else {
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
        if (dist > reach) toward(m.def.speed * slow);
        else if (m.cd <= 0) {
          m.state = 'wind';
          m.t = m.def.windup * (m.guardian ? 1.2 : 1);
          if (m.kind === 'fizzler') this.sound('hiss');
        }
      }
    }
  }

  private stepToward(m: Monster | Ally, dx: number, dy: number, dist: number, hx: number, hy: number, sp: number, dt: number, r: number, flier: boolean) {
    let ax = dx / (dist || 1), ay = dy / (dist || 1);
    if (!flier && !this.lineOfSight(m.x, m.y, hx, hy)) {
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
    m.walk += dt * Math.abs(sp) * 3;
  }

  /** a charmed monster fights the other monsters */
  private updateCharmed(m: Monster, dt: number) {
    m.charmT! -= dt;
    if (Math.random() < dt * 3) this.parts.push({ x: m.x, y: m.y, z: 1.2 * m.scale, vx: 0, vy: 0, vz: 1.5, life: 0.7, max: 0.7, color: '#ff7aa8', size: 0.1 });
    if (m.charmT! <= 0) {
      m.charmT = 0;
      this.burst(m.x, m.y, 1, '#ff7aa8', 8, 2);
      return;
    }
    const foe = this.nearestEnemy(9, m.x, m.y);
    if (!foe || foe === m) return;
    const dx = foe.x - m.x, dy = foe.y - m.y, d = Math.hypot(dx, dy);
    const reach = (m.def.style === 'ranged' ? 4 : m.def.range + 0.3) + foe.def.radius * foe.scale;
    m.cd -= dt;
    m.face = Math.atan2(dy, dx);
    if (d > reach) this.stepToward(m, dx, dy, d, foe.x, foe.y, m.def.speed, dt, m.def.radius, !!m.def.fly);
    else if (m.cd <= 0) {
      m.cd = m.def.cooldown;
      m.state = 'recover';
      if (m.kind === 'fizzler') {
        m.dead = true;
        this.explode(m.x, m.y, 2.3, foe.maxHp * 0.6, false, true);
        return;
      }
      this.hurtMonster(foe, Math.max(4, foe.maxHp * 0.22), m.x, m.y, 2);
    }
  }

  private updateHog(m: Monster, dt: number, all: Tgt[]) {
    let near: Tgt | null = null, nd = 6;
    for (const c of all) {
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      if (d < nd) {
        nd = d;
        near = c;
      }
    }
    m.special -= dt;
    if (near) {
      const dx = m.x - near.x, dy = m.y - near.y, d = Math.hypot(dx, dy) || 1;
      const a = Math.atan2(dy, dx) + Math.sin(this.time * 2 + m.id) * 0.6;
      const sp = m.def.speed * (m.slowT > 0 ? 0.5 : 1) * dt;
      const bx = m.x, by = m.y;
      this.moveCircle(m, Math.cos(a) * sp, Math.sin(a) * sp, m.def.radius, false, true);
      if (Math.hypot(m.x - bx, m.y - by) < sp * 0.3) this.moveCircle(m, Math.cos(a + 1.6) * sp, Math.sin(a + 1.6) * sp, m.def.radius, false, true);
      m.face = a;
      m.walk += sp * 3;
      if (!m.awake) m.awake = true;
      void d;
    } else if (m.special <= 0) {
      m.special = 1.5 + Math.random() * 2;
      m.face = Math.random() * Math.PI * 2;
    } else {
      const sp = 0.8 * dt;
      this.moveCircle(m, Math.cos(m.face) * sp, Math.sin(m.face) * sp, m.def.radius, false, true);
      m.walk += sp * 3;
    }
  }

  private updateBoss(m: Monster, dt: number, dist: number, dx: number, dy: number, toward: (sp: number) => void, T: Tgt) {
    const enraged = m.hp < m.maxHp * 0.5;
    const wyrm = m.kind === 'nyxwing';
    const col = wyrm ? '#c07aff' : '#5ae0d0';
    if (m.state === 'wind' || m.state === 'special') {
      m.t -= dt;
      if (m.move === 'charge' && m.state === 'special') {
        const cx = (m.cx ?? m.x) - m.x, cy = (m.cy ?? m.y) - m.y;
        const l = Math.hypot(cx, cy);
        if (l < 0.3 || m.t <= 0) {
          m.state = 'recover';
          m.cd = 1;
          this.ring(m.x, m.y, 1.8, col, 0.3);
          this.shake = 0.6;
          this.sound('slam');
          if (dist < 2) this.hurtTarget(T, m.dmg, m.x, m.y);
        } else {
          const sp = (wyrm ? 14 : 12) * dt;
          const before = { x: m.x, y: m.y };
          this.moveCircle(m, (cx / l) * sp, (cy / l) * sp, 0.9, wyrm, false);
          if (Math.hypot(m.x - before.x, m.y - before.y) < sp * 0.3) m.t = 0;
          if (dist < 1.4) this.hurtTarget(T, m.dmg, m.x, m.y);
          if (Math.random() < 0.6) this.burst(m.x, m.y, 0.2, wyrm ? '#3a1a5a' : '#2a3a3a', 2, 1);
        }
        return;
      }
      m.face = Math.atan2(dy, dx);
      if (m.t > 0) return;
      const a = Math.atan2(dy, dx);
      if (m.move === 'slam') {
        this.ring(m.x, m.y, 3.6, col, 0.45);
        this.shake = 1;
        this.sound('slam');
        for (const P of this.targets()) if (Math.hypot(P.x - m.x, P.y - m.y) < 3.6) this.hurtTarget(P, m.dmg * 1.2, m.x, m.y);
        m.state = 'recover';
        m.cd = enraged ? 0.8 : 1.3;
      } else if (m.move === 'charge') {
        m.state = 'special';
        m.t = 1.1;
        m.cx = T.x + (dx / (dist || 1)) * 1.5;
        m.cy = T.y + (dy / (dist || 1)) * 1.5;
        this.sound('roar');
      } else if (m.move === 'sonic') {
        // a sonic roar: a big fast blast straight at you, with two smaller ones beside it
        this.monsterShoot(m, a, 'sonic', 13, m.dmg * 1.3);
        for (const o of [-0.35, 0.35]) this.monsterShoot(m, a + o, 'sonic', 11, m.dmg * 0.7);
        this.shake = 0.6;
        this.sound('sonic');
        m.state = 'recover';
        m.cd = 1;
      } else if (m.move === 'breath') {
        // a cone of void fire
        for (let i = -4; i <= 4; i++) this.monsterShoot(m, a + i * 0.11, 'void', 8 + Math.random() * 2, m.dmg * 0.6);
        this.sound('breath');
        m.state = 'recover';
        m.cd = 1;
      } else if (m.move === 'volley') {
        const n = enraged ? 20 : 14;
        for (let i = 0; i < n; i++) this.monsterShoot(m, (i / n) * Math.PI * 2 + this.time, wyrm ? 'void' : 'sonic', 6, m.dmg * 0.45);
        this.sound('cast');
        m.state = 'recover';
        m.cd = 1;
      } else if (m.move === 'summon') {
        const kinds: MonsterKind[] = wyrm ? ['armored-shambler', 'fizzler'] : ['gloop', 'armored-shambler'];
        const minions = this.monsters.filter((o) => o.minion && !o.dead).length;
        for (let i = 0; i < (enraged ? 3 : 2) && minions + i < 6; i++) {
          const b = (i / 3) * Math.PI * 2;
          const x = m.x + Math.cos(b) * 2.2, y = m.y + Math.sin(b) * 2.2;
          if (this.walkable(x, y)) {
            const s = this.spawn(kinds[i % kinds.length], x, y);
            s.awake = true;
            s.minion = true;
            this.burst(x, y, 0.5, col, 12, 2);
          }
        }
        this.sound('summon');
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
      type Move = NonNullable<Monster['move']>;
      const opts: Move[] = wyrm
        ? dist < 3 ? ['slam', 'breath', 'volley', 'summon'] : ['charge', 'breath', 'breath', 'volley', 'summon']
        : dist < 3 ? ['slam', 'slam', 'sonic', 'summon'] : ['charge', 'sonic', 'sonic', 'volley', 'summon'];
      m.move = opts[Math.floor(Math.random() * opts.length)];
      m.special = enraged ? 2.2 : 3.2;
      m.state = 'wind';
      m.t = m.move === 'slam' ? 0.9 : m.move === 'charge' ? 0.7 : m.move === 'sonic' ? 1.0 : 0.8;
      if (m.move === 'slam') this.warn(m.x, m.y, 3.6, 0.9);
    }
  }

  private updateShots(dt: number) {
    for (const s of this.shots) {
      s.life -= dt;
      // soul arrows come back to the monster they hit
      if (s.kind === 'soul' && s.home !== undefined) {
        s.back = (s.back ?? 0) + dt;
        const h = this.monsters.find((q) => q.id === s.home && !q.dead);
        if (!h) s.home = undefined;
        else if (s.back > 0.35) {
          const a = Math.atan2(h.y - s.y, h.x - s.x);
          s.vx += (Math.cos(a) * 7 - s.vx) * Math.min(1, dt * 6);
          s.vy += (Math.sin(a) * 7 - s.vy) * Math.min(1, dt * 6);
        }
      }
      const steps = 3;
      for (let k = 0; k < steps && s.life > 0; k++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        if (isWallTile(tileAt(this.L, Math.floor(s.x), Math.floor(s.y))) || this.solidAt(Math.floor(s.x), Math.floor(s.y), true)) {
          if (s.kind === 'soul' && (s.bounce ?? 0) > 0) {
            s.x -= (s.vx * dt) / steps;
            s.y -= (s.vy * dt) / steps;
            s.vx = -s.vx;
            s.vy = -s.vy;
            s.bounce!--;
            continue;
          }
          s.life = 0;
          this.burst(s.x - s.vx * 0.01, s.y - s.vy * 0.01, s.z, s.from === 'hero' ? (s.color ?? '#d8c8a0') : this.shotColor(s.kind), 4, 1.5);
          if (s.effect === 'bigboom') this.explode(s.x - s.vx * 0.02, s.y - s.vy * 0.02, 2.6, s.dmg * 2.5, false, true);
          break;
        }
        if (s.from === 'hero') {
          for (const m of this.monsters) {
            if (m.dead || s.hit.has(m.id) || (m.charmT ?? 0) > 0) continue;
            if (Math.hypot(m.x - s.x, m.y - s.y) < m.def.radius * m.scale + 0.15) {
              s.hit.add(m.id);
              const eff = s.effect === 'boom' || s.effect === 'bigboom' ? undefined : s.effect;
              this.hurtMonster(m, s.dmg, s.x - s.vx, s.y - s.vy, s.knock ?? 2, eff, s.element);
              if (s.effect === 'bigboom') {
                this.explode(s.x, s.y, 2.6, s.dmg * 2.5, false, true);
                s.life = 0;
                break;
              }
              if (s.kind === 'soul' && (s.bounce ?? 0) > 0) {
                // knock it back, fly back out, and come round to hit it again
                s.bounce!--;
                s.home = m.id;
                s.back = 0;
                s.vx = -s.vx;
                s.vy = -s.vy;
                s.life = Math.max(s.life, 1.5);
                s.hit.clear();
                break;
              }
              if (s.pierce-- <= 0) {
                s.life = 0;
                break;
              }
            }
          }
        } else {
          for (const T of this.targets()) {
            const hitR = s.kind === 'sonic' ? 0.5 : HERO_R + 0.18;
            if (Math.hypot(T.x - s.x, T.y - s.y) >= hitR) continue;
            if (!T.id && this.rollT > 0) continue;
            if (T.id && this.peers.find((q) => q.id === T.id)?.rolling) continue;
            s.life = 0;
            this.hurtTarget(T, s.dmg, s.x - s.vx, s.y - s.vy, s.kind === 'ice' ? 'slow' : undefined);
            break;
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  shotColor(k: Shot['kind']) {
    return k === 'ember' ? '#ffb347' : k === 'spore' ? '#e06ad6' : k === 'ice' ? '#bfefff' : k === 'star' ? '#fff3a0' : k === 'void' ? '#c07aff' : k === 'sonic' ? '#7af0e0'
      : k === 'bone' ? '#e8e0d0' : k === 'mbolt' ? '#a0a8b0' : k === 'soul' ? '#9ae0ff' : k === 'spit' ? '#f0f0e0' : '#d8c8a0';
  }

  private updateDrops(dt: number) {
    for (const d of this.drops) {
      d.t += dt;
      // teammates grab things too
      const pr = this.peers.find((p) => !p.dead && Math.hypot(p.x - d.x, p.y - d.y) < 0.6);
      if (pr && d.t > 0.35) {
        d.t = -1;
        this.onPeerGain(pr.id, d.kind === 'soul' ? { souls: d.n } : { arrows: d.n });
        continue;
      }
      const dist = Math.hypot(this.x - d.x, this.y - d.y);
      // souls fly to you from further away
      if (!this.dead && dist < (d.kind === 'soul' ? 3.2 : 2.2) && d.t > 0.35) {
        const k = Math.min(1, dt * 10);
        d.x += (this.x - d.x) * k;
        d.y += (this.y - d.y) * k;
      }
      if (!this.dead && dist < 0.45 && d.t > 0.35) {
        d.t = -1;
        if (d.kind === 'soul') this.gainSouls(d.n);
        else {
          this.save.arrows = Math.min(999, this.save.arrows + d.n);
          this.floatLocal(this.x, this.y, `+${d.n} arrows`, '#e8d8b0');
          this.sound('pickup');
        }
      }
    }
    this.drops = this.drops.filter((d) => d.t >= 0);
  }
  gainSouls(n: number) {
    this.souls = Math.min(MAX_SOULS, this.souls + n);
    this.sound('soul');
    // Soul Healing: every soul you collect heals you
    const h = this.soulHeal * n;
    if (h > 0 && !this.dead && this.hp < this.maxHp) this.healHero(h);
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

  // ---------- inventory ----------
  equip(key: ItemKey) {
    const { id } = parseKey(key);
    if (isArtifact(id)) {
      if (!this.save.arts.includes(key)) return;
      const s = this.save.slots;
      if (s.includes(key)) return;
      const empty = s.indexOf('');
      s[empty >= 0 ? empty : 0] = key;
    } else {
      if (!this.save.owned.includes(key)) return;
      if (isMelee(id)) this.save.melee = key;
      else if (isRanged(id)) this.save.ranged = key;
      else if (isArmor(id)) this.save.armor = key;
    }
    this.hp = Math.min(this.hp, this.maxHp);
    this.onSave();
  }
  /** puts an artifact on a slot (0..2), or empties the slot */
  slotArtifact(i: number, key: ItemKey | '') {
    const s = this.save.slots;
    if (key) {
      const was = s.indexOf(key);
      if (was >= 0) s[was] = s[i];
    }
    s[i] = key;
    this.artCd[i] = 0;
    this.onSave();
  }
}

export function gearName(id: GearId) {
  return gear(id).name;
}
/** an enchant set from the network, kept to real enchantments at tiers 1..3 */
function cleanEnch(e?: EnchSet): EnchSet {
  const out: EnchSet = {};
  if (!e || typeof e !== 'object') return out;
  for (const [k, v] of Object.entries(e)) if (k in ENCHANTS && typeof v === 'number') out[k as EnchId] = Math.max(1, Math.min(3, Math.round(v)));
  return out;
}
/** an item key from the network, if it's a real one of the right kind */
function cleanKey(key: unknown, test: (id: string) => boolean): ItemKey {
  if (typeof key !== 'string') return '';
  const { id, lv, uid } = parseKey(key);
  return test(id) ? makeKey(id, lv, uid) : '';
}
/** rough tier of a piece of gear, so early missions don't hand out the best stuff */
export function gearTier(id: GearId) {
  const p = gear(id).price;
  return p < 120 ? 0 : p < 230 ? 1 : p < 330 ? 2 : p < 500 ? 3 : 4;
}
export function mobEnchColor(e: MobEnch) {
  return e === 'swift' ? '#7affb0' : e === 'shield' ? '#7ab8ff' : '#ff5a5a';
}
export const MOB_ENCH_NAME: Record<MobEnch, string> = { swift: 'Fast hits', shield: 'Protection', strong: 'Strength' };
