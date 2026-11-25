// Emberwild game state: the hero, creatures, mining, building and the beacons.
import {
  B, BEACONS, BLOCKS, DAY_LEN, FIST_DAMAGE, G, ITEMS, PICKS, RECIPES, SWORDS, VEIN_ORE, isWater,
  type ItemId, type Recipe,
} from './data';
import { DX, DY, Factory, add, newMachine, take, type Machine, type Stock } from './sim';
import { World, hash2 } from './world';

export type CreatureKind = 'bramble' | 'gloom' | 'rustguard';
export interface Creature {
  kind: CreatureKind;
  x: number;
  y: number;
  hp: number;
  max: number;
  vx: number;
  vy: number;
  cd: number;
  hurt: number;
  hx: number;
  hy: number; // home
  beacon?: string;
  charge?: number;
  fade?: number;
}
export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  enemy: boolean;
  dmg: number;
  life: number;
}
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}
export type Relic = 'boots' | 'fins' | 'lantern' | 'kite';
export const RELICS: Record<Relic, { name: string; text: string }> = {
  boots: { name: 'Swift boots', text: 'You run a quarter faster.' },
  fins: { name: 'Otter fins', text: 'Swimming uses half the stamina, and you swim faster.' },
  lantern: { name: 'Ember lantern', text: 'You glow brighter, and gloomlings keep further away.' },
  kite: { name: 'Wind kite', text: 'Hold sprint while running to glide over water for free.' },
};

export interface SaveData {
  v: 1;
  seed: number;
  t: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  inv: Stock;
  hot: (ItemId | null)[];
  sel: number;
  spawn: [number, number];
  diff: number[];
  fog: string;
  machines: Machine[];
  beacons: { id: string; lit: boolean; given: Record<string, number>; guards: number }[];
  stones: boolean[];
  chests: boolean[];
  relics: Relic[];
  won: boolean;
  name: string;
}

/** Everything that belongs to one hero. The Game's own fields hold the hero being run right now. */
export const HERO_KEYS = [
  'px', 'py', 'face', 'hp', 'maxHp', 'stamina', 'tired', 'inv', 'hot', 'sel', 'spawn', 'relics', 'swing', 'swingDir',
  'atkCd', 'bowCd', 'invuln', 'mining', 'swimming', 'gliding', 'moving', 'lastLand', 'dead', 'stepT', 'name',
] as const;
type HeroKey = (typeof HERO_KEYS)[number];
export type Hero = { [K in HeroKey]: Game[K] } & {
  /** 0 is the host (or you on your own), 1 to 3 are friends. */
  slot: number;
  /** Counts the host moving this hero (waking up after a knock-out), so the friend's game follows. */
  tp: number;
  /** Where a friend last said they are, to glide toward. */
  tx?: number;
  ty?: number;
  /** The tile a friend is holding to mine. */
  mineAt?: { x: number; y: number } | null;
};

/** What the host sends each friend about 12 times a second. */
export interface Snap {
  t: number;
  won: boolean;
  guards: Record<string, number>;
  beacons: [boolean, Record<string, number>][];
  stones: boolean[];
  chests: boolean[];
  cr: [CreatureKind, number, number, number, number, number, number][];
  shots: [number, number, number, number, number][];
  floats: FloatText[];
  parts: Particle[];
  heroes: [number, number, number, number, number, number, number, number, number, number, number, string][];
  world: number[];
  machines?: Machine[];
  you: { hp: number; maxHp: number; inv: Stock; hot: (ItemId | null)[]; spawn: [number, number]; relics: Relic[]; dead: number; invuln: number; mining: Game['mining']; tp: number; px: number; py: number };
}

const REACH = 4.2;
const MAX_HP_CAP = 30;

export class Game {
  world: World;
  fac: Factory;
  t = DAY_LEN * 0.3; // start in the morning
  px: number;
  py: number;
  face = 0; // radians
  hp = 10;
  maxHp = 10;
  stamina = 1;
  tired = false;
  inv: Stock = {};
  hot: (ItemId | null)[] = Array(9).fill(null);
  sel = 0;
  spawn: [number, number];
  relics = new Set<Relic>();
  guards: Record<string, number> = {};
  won = false;
  name = 'Wren';

  creatures: Creature[] = [];
  shots: Shot[] = [];
  parts: Particle[] = [];
  floats: FloatText[] = [];

  swing = 0; // >0 while the sword swing shows
  swingDir = 0;
  atkCd = 0;
  bowCd = 0;
  invuln = 0;
  mining: { x: number; y: number; prog: number; need: number } | null = null;
  swimming = false;
  gliding = false;
  moving = false;
  lastLand: [number, number];
  spawnTimer = 0;
  dead = 0;
  stepT = 0;

  onSound: (n: string) => void = () => {};
  onMsg: (t: string) => void = () => {};
  onWin: () => void = () => {};
  onBeaconLit: (name: string) => void = () => {};

  /** Playing together: you, everyone else, and whose fields the Game holds right now. */
  me!: Hero;
  others: Hero[] = [];
  active!: Hero;
  /** On the host: world tiles changed since the start, as index, ground, block (friends get the new ones). */
  worldLog: number[] = [];

  constructor(save?: SaveData, seed?: number) {
    const s = save?.seed ?? seed ?? (Math.floor(Math.random() * 1e9) | 0);
    this.world = new World(s);
    this.fac = new Factory(this.world);
    const w = this.world;
    this.px = w.home.x + 0.5;
    this.py = w.home.y + 0.5;
    this.spawn = [this.px, this.py];
    for (const b of w.beacons) this.guards[b.id] = 3;
    if (save) {
      w.applyDiff(save.diff);
      w.loadFog(save.fog);
      this.fac.load(save.machines);
      this.t = save.t;
      this.px = save.px;
      this.py = save.py;
      this.hp = save.hp;
      this.maxHp = save.maxHp;
      this.inv = save.inv;
      this.hot = save.hot;
      this.sel = save.sel;
      this.spawn = save.spawn;
      for (const b of save.beacons) {
        const p = w.beacons.find((q) => q.id === b.id);
        if (p) {
          p.lit = b.lit;
          p.given = b.given;
        }
        this.guards[b.id] = b.guards;
      }
      save.stones.forEach((f, i) => w.stones[i] && (w.stones[i].found = f));
      save.chests.forEach((o, i) => w.chests[i] && (w.chests[i].opened = o));
      for (const r of save.relics) this.relics.add(r);
      this.won = save.won;
      this.name = save.name || this.name;
    } else {
      this.give('wood', 0);
    }
    this.lastLand = [this.px, this.py];
    this.spawnGuards();
    w.reveal(this.px, this.py, 14);
    this.me = this.active = { slot: 0, tp: 0 } as Hero;
    w.onChange = (i) => this.worldLog.push(i, w.ground[i], w.block[i]);
  }

  // ---------- heroes ----------
  get heroes() {
    return [this.me, ...this.others];
  }
  /** Puts hero `h` into the Game's fields (and the one there back into its own object). */
  private swap(h: Hero) {
    if (h === this.active) return;
    const a = this.active as Record<string, unknown>, b = h as Record<string, unknown>, me = this as unknown as Record<string, unknown>;
    for (const k of HERO_KEYS) a[k] = me[k];
    for (const k of HERO_KEYS) me[k] = b[k];
    this.active = h;
  }
  /** Runs `fn` as hero `h`: the host doing what a friend asked, or a creature biting whoever is closest. */
  as<R>(h: Hero, fn: () => R): R {
    const prev = this.active;
    this.swap(h);
    try {
      return fn();
    } finally {
      this.swap(prev);
    }
  }
  /** A new hero for slot `slot`, next to the camp. */
  newHero(slot: number): Hero {
    const x = this.world.home.x + 0.5 + (slot % 2 ? 1 : -1) * Math.ceil(slot / 2), y = this.world.home.y + 1.5;
    const p = this.world.findLand(Math.floor(x), Math.floor(y));
    const px = Math.abs(p.x - x) < 3 ? x : p.x + 0.5, py = Math.abs(p.y - y) < 3 ? y : p.y + 0.5;
    return {
      slot, tp: 0, px, py, face: 0, hp: 10, maxHp: 10, stamina: 1, tired: false, inv: { campfire: 1 }, hot: ['campfire', null, null, null, null, null, null, null, null],
      sel: 0, spawn: [this.world.home.x + 0.5, this.world.home.y + 0.5], relics: new Set(), swing: 0, swingDir: 0, atkCd: 0, bowCd: 0, invuln: 0,
      mining: null, swimming: false, gliding: false, moving: false, lastLand: [px, py], dead: 0, stepT: 0, name: `Player ${slot + 1}`,
    };
  }
  other(slot: number) {
    return this.others.find((h) => h.slot === slot);
  }
  /** The hero nearest to (x, y), awake ones first. */
  private nearestHero(x: number, y: number) {
    let best = this.me, bd = Infinity;
    for (const h of this.heroes) {
      const hx = h === this.active ? this.px : h.px, hy = h === this.active ? this.py : h.py;
      const dead = h === this.active ? this.dead : h.dead;
      const d = Math.hypot(hx - x, hy - y) + (dead ? 1000 : 0);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  // ---------- playing together: sending the world ----------
  /** For friend `h`: the world as it is now. `worldFrom` is how much of the change log they already have. */
  /** Effects made since the last call, sent once to every friend. */
  newEffects() {
    const seen = this.sentFx;
    const floats = this.floats.filter((f) => !seen.has(f) && seen.add(f));
    const parts = this.parts.filter((q) => !seen.has(q) && seen.add(q)).slice(-60);
    return { floats, parts };
  }
  private sentFx = new WeakSet<object>();

  snap(h: Hero, worldFrom: number, machines: boolean, fx: { floats: FloatText[]; parts: Particle[] }): Snap {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const w = this.world;
    const pub = (q: Hero) => this.as(q, () => [q.slot, r2(this.px), r2(this.py), r2(this.face), r2(this.swing), r2(this.swingDir), this.dead > 0 ? r2(this.dead) : 0, r2(this.invuln), this.moving ? 1 : 0, this.swimming ? 1 : 0, this.gliding ? 1 : 0, this.name] as Snap['heroes'][number]);
    const you = this.as(h, () => ({ hp: this.hp, maxHp: this.maxHp, inv: { ...this.inv }, hot: [...this.hot], spawn: this.spawn, relics: [...this.relics], dead: this.dead, invuln: this.invuln, mining: this.mining, tp: h.tp, px: this.px, py: this.py }));
    return {
      t: r2(this.t), won: this.won, guards: this.guards,
      beacons: w.beacons.map((b) => [b.lit, b.given]),
      stones: w.stones.map((q) => q.found),
      chests: w.chests.map((c) => c.opened),
      cr: this.creatures.map((c) => [c.kind, r2(c.x), r2(c.y), c.hp, c.max, r2(c.hurt), r2(c.fade ?? 0)]),
      shots: this.shots.map((q) => [r2(q.x), r2(q.y), r2(q.vx), r2(q.vy), q.enemy ? 1 : 0]),
      floats: fx.floats,
      parts: fx.parts,
      heroes: this.heroes.filter((q) => q !== h).map(pub),
      world: this.worldLog.slice(worldFrom),
      machines: machines ? this.fac.serialize() : undefined,
      you,
    };
  }

  /** On a friend's game: take the host's world, but keep walking where you are. */
  applySnap(s: Snap) {
    const w = this.world;
    // keep the clock close, without jumping back and forth
    if (Math.abs(this.t - s.t) > 1) this.t = s.t;
    for (let k = 0; k + 2 < s.world.length; k += 3) {
      w.ground[s.world[k]] = s.world[k + 1];
      w.block[s.world[k]] = s.world[k + 2];
    }
    if (s.machines) this.fac.load(s.machines);
    if (s.won && !this.won) {
      this.won = true;
      this.onWin();
    }
    this.guards = s.guards;
    s.beacons.forEach(([lit, given], i) => {
      const b = w.beacons[i];
      if (!b) return;
      b.given = given;
      if (lit && !b.lit) {
        b.lit = true;
        w.reveal(b.x, b.y, 70);
        this.onBeaconLit(BEACONS.find((q) => q.id === b.id)!.name);
      }
    });
    s.stones.forEach((f, i) => w.stones[i] && (w.stones[i].found = f));
    s.chests.forEach((o, i) => w.chests[i] && (w.chests[i].opened = o));
    const old = this.creatures;
    this.creatures = s.cr.map(([kind, x, y, hp, max, hurt, fade], i) => {
      const c = old[i] && old[i].kind === kind && Math.hypot(old[i].x - x, old[i].y - y) < 2 ? old[i] : ({ kind, x, y, vx: 0, vy: 0, cd: 0, hx: x, hy: y } as Creature);
      // glide toward the host's spot
      c.hx = x;
      c.hy = y;
      return Object.assign(c, { kind, hp, max, hurt, fade: fade || undefined });
    });
    this.shots = s.shots.map(([x, y, vx, vy, enemy]) => ({ x, y, vx, vy, enemy: !!enemy, dmg: 0, life: 1 }));
    this.floats.push(...s.floats);
    this.parts.push(...s.parts);
    const others: Hero[] = [];
    for (const [slot, px, py, face, swing, swingDir, dead, invuln, moving, swimming, gliding, name] of s.heroes) {
      const h = this.other(slot) ?? this.newHero(slot);
      if (h.tx === undefined || Math.hypot(h.px - px, h.py - py) > 6) {
        h.px = px;
        h.py = py;
      }
      Object.assign(h, { tx: px, ty: py, face, swing, swingDir, dead, invuln, moving: !!moving, swimming: !!swimming, gliding: !!gliding, name });
      others.push(h);
    }
    this.others = others;
    const y = s.you;
    Object.assign(this, { hp: y.hp, maxHp: y.maxHp, inv: y.inv, hot: y.hot, spawn: y.spawn, dead: y.dead, invuln: y.invuln, mining: y.mining });
    this.relics = new Set(y.relics);
    if (y.tp !== this.me.tp) {
      // the host moved you (you woke up by the fire)
      this.me.tp = y.tp;
      this.px = y.px;
      this.py = y.py;
      this.lastLand = [this.px, this.py];
    }
  }

  /** On the host: where a friend says they are and what they're mining. */
  setOther(slot: number, m: { x: number; y: number; face: number; moving: boolean; swimming: boolean; gliding: boolean; mine: { x: number; y: number } | null }) {
    const h = this.other(slot);
    if (!h || !Number.isFinite(m.x) || !Number.isFinite(m.y) || h.dead) return;
    if (Math.hypot(h.px - m.x, h.py - m.y) > 6) {
      h.px = m.x;
      h.py = m.y;
    }
    Object.assign(h, { tx: m.x, ty: m.y, face: +m.face || 0, moving: !!m.moving, swimming: !!m.swimming, gliding: !!m.gliding });
    h.mineAt = m.mine && Number.isFinite(m.mine.x) ? { x: m.mine.x | 0, y: m.mine.y | 0 } : null;
  }


  save(): SaveData {
    const w = this.world;
    return {
      v: 1,
      seed: w.seed,
      t: this.t,
      px: this.px,
      py: this.py,
      hp: this.hp,
      maxHp: this.maxHp,
      inv: this.inv,
      hot: this.hot,
      sel: this.sel,
      spawn: this.spawn,
      diff: w.diff(),
      fog: w.fogString(),
      machines: this.fac.serialize(),
      beacons: w.beacons.map((b) => ({ id: b.id, lit: b.lit, given: b.given, guards: this.guards[b.id] ?? 0 })),
      stones: w.stones.map((s) => s.found),
      chests: w.chests.map((c) => c.opened),
      relics: [...this.relics],
      won: this.won,
      name: this.name,
    };
  }

  // ---------- time & light ----------
  get dayPhase() {
    return (this.t % DAY_LEN) / DAY_LEN; // 0 = dawn
  }
  get day() {
    return Math.floor(this.t / DAY_LEN) + 1;
  }
  /** 0 = full day, 1 = darkest night */
  get darkness() {
    const p = this.dayPhase;
    if (p < 0.6) return p < 0.05 ? 1 - p / 0.05 : 0;
    if (p < 0.7) return (p - 0.6) / 0.1;
    return 1;
  }
  get isNight() {
    return this.darkness > 0.6;
  }

  // ---------- inventory ----------
  has(id: ItemId, n = 1) {
    return (this.inv[id] ?? 0) >= n;
  }
  give(id: ItemId, n: number, show = false) {
    if (n <= 0) return;
    add(this.inv, id, n);
    if (show) this.float(`+${n} ${ITEMS[id].name}`, '#fff2b0');
    const def = ITEMS[id];
    if (!def.tool && !this.hot.includes(id) && (def.block || def.machine || def.heal || id === 'arrow')) {
      if (id === 'arrow') return;
      const free = this.hot.indexOf(null);
      if (free >= 0) this.hot[free] = id;
    }
  }
  use(id: ItemId, n: number) {
    take(this.inv, id, n);
  }
  get pick() {
    for (const [id, tier, speed] of PICKS) if (this.has(id)) return { tier, speed };
    return { tier: 0, speed: 1 };
  }
  get swordDmg() {
    for (const [id, d] of SWORDS) if (this.has(id)) return d;
    return FIST_DAMAGE;
  }
  get selected(): ItemId | null {
    const id = this.hot[this.sel];
    if (id && !this.has(id)) return null;
    return id;
  }

  float(text: string, color = '#fff', x = this.px, y = this.py - 0.8) {
    const recent = this.floats.filter((f) => f.life > 1.0 && Math.abs(f.x - x) < 1).length;
    this.floats.push({ x, y: y - recent * 0.4, text, life: 1.4, color });
  }
  burst(x: number, y: number, color: string, n = 8, speed = 2.5, size = 0.12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size });
    }
  }

  // ---------- crafting ----------
  nearCampfire() {
    const r = 4;
    for (let y = Math.floor(this.py) - r; y <= Math.floor(this.py) + r; y++)
      for (let x = Math.floor(this.px) - r; x <= Math.floor(this.px) + r; x++) if (this.fac.at(x, y)?.kind === 'campfire') return true;
    return false;
  }
  get allLit() {
    return this.world.beacons.every((b) => b.lit);
  }
  recipeOpen(r: Recipe) {
    if (r.locked === 'engine') return this.allLit;
    return true;
  }
  canCraft(r: Recipe, times = 1) {
    if (!this.recipeOpen(r)) return false;
    if (r.needs === 'campfire' && !this.nearCampfire()) return false;
    if (ITEMS[r.out].tool && this.has(r.out)) return false;
    return r.inp.every(([id, n]) => this.has(id, n * times));
  }
  craft(i: number, times = 1) {
    const r = RECIPES[i];
    let done = 0;
    for (let k = 0; k < times && this.canCraft(r); k++) {
      for (const [id, n] of r.inp) this.use(id, n);
      this.give(r.out, r.n);
      done++;
      if (ITEMS[r.out].tool) break;
    }
    if (done) {
      this.onSound('craft');
      this.float(`+${r.n * done} ${ITEMS[r.out].name}`, '#b8ffb0');
    }
    return done;
  }

  // ---------- targeting ----------
  /** The tile the player is aiming at: the cursor if close enough, else the tile in front. */
  target(aim: { x: number; y: number } | null) {
    if (aim) {
      const tx = Math.floor(aim.x), ty = Math.floor(aim.y);
      if (Math.hypot(tx + 0.5 - this.px, ty + 0.5 - this.py) <= REACH) return { x: tx, y: ty };
      return null;
    }
    return { x: Math.floor(this.px + Math.cos(this.face) * 0.95), y: Math.floor(this.py + Math.sin(this.face) * 0.95) };
  }
  poiAt(x: number, y: number) {
    const w = this.world;
    const b = w.beacons.find((q) => q.x === x && q.y === y);
    if (b) return { kind: 'beacon' as const, b };
    const si = w.stones.findIndex((q) => q.x === x && q.y === y);
    if (si >= 0) return { kind: 'stone' as const, i: si };
    const ci = w.chests.findIndex((q) => q.x === x && q.y === y && !q.opened);
    if (ci >= 0) return { kind: 'chest' as const, i: ci };
    return null;
  }
  /** Something to talk to or open within reach of the player (closest first). */
  nearbyThing() {
    let best: { x: number; y: number; d: number } | null = null;
    const fx = Math.floor(this.px), fy = Math.floor(this.py);
    for (let y = fy - 2; y <= fy + 2; y++)
      for (let x = fx - 2; x <= fx + 2; x++) {
        const m = this.fac.at(x, y);
        const interesting = this.poiAt(x, y) || (m && m.kind !== 'belt' && m.kind !== 'lamp');
        if (!interesting) continue;
        const d = Math.hypot(x + 0.5 - this.px, y + 0.5 - this.py);
        if (d < 1.9 && (!best || d < best.d)) best = { x, y, d };
      }
    return best;
  }

  tileSolid(x: number, y: number) {
    const w = this.world;
    if (!w.inside(x, y)) return true;
    if (w.solidBlock(x, y)) return true;
    const m = this.fac.at(x, y);
    if (m && m.kind !== 'belt') return true;
    if (this.poiAt(x, y)) return true;
    return false;
  }
  blocked(x: number, y: number, r = 0.3) {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (this.tileSolid(Math.floor(x + ox), Math.floor(y + oy))) return true;
    return false;
  }

  // ---------- mining & placing ----------
  canPlaceAt(x: number, y: number, id: ItemId) {
    const w = this.world;
    if (!w.inside(x, y)) return 'Too far.';
    if (w.b(x, y) !== B.NONE || this.fac.at(x, y) || this.poiAt(x, y)) return 'Something is already there.';
    const def = ITEMS[id];
    const g = w.g(x, y);
    if (def.machine && isWater(g)) return 'Fill the water with stone first.';
    if (def.machine === 'drill' && !VEIN_ORE[g]) return 'Drills go on an ore vein. Mine a seam to uncover its vein.';
    if (def.block === B.COBBLE && g === G.DEEP) return 'Too deep here. Fill the shallow water first.';
    if (def.block && def.block !== B.COBBLE && isWater(g)) return 'Fill the water with stone first.';
    const solid = def.block !== undefined || (def.machine && def.machine !== 'belt');
    if (solid && Math.abs(x + 0.5 - this.px) < 0.8 && Math.abs(y + 0.5 - this.py) < 0.8) return "You're standing there.";
    if (solid && this.creatures.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y)) return 'Something is in the way.';
    return '';
  }

  place(x: number, y: number, id: ItemId, dir: number): boolean {
    const why = this.canPlaceAt(x, y, id);
    if (why) {
      this.onMsg(why);
      return false;
    }
    const def = ITEMS[id];
    const w = this.world;
    if (def.block === B.COBBLE && isWater(w.g(x, y))) {
      w.setG(x, y, G.PATH); // fill water: a stone path
      this.use(id, 1);
      this.onSound('place');
      return true;
    }
    if (def.block) w.setB(x, y, def.block);
    else if (def.machine) {
      const m = newMachine(def.machine, x, y, dir);
      if (def.machine === 'sky_engine') {
        this.won = true;
        this.onWin();
      }
      this.fac.place(m);
    } else return false;
    this.use(id, 1);
    this.onSound('place');
    this.burst(x + 0.5, y + 0.5, '#d9c7a4', 5, 1.5);
    return true;
  }

  /** Progress mining the given tile. Returns true while there's something to mine. */
  mineTick(x: number, y: number, dt: number) {
    const w = this.world;
    const m = this.fac.at(x, y);
    const blk = w.b(x, y);
    const g = w.g(x, y);
    let need = 0;
    if (m) need = m.kind === 'sky_engine' ? 0 : 0.35;
    else if (blk !== B.NONE) {
      const def = BLOCKS[blk];
      if (def.unbreakable) return false;
      if (this.pick.tier < def.tier) {
        if (!this.mining || this.mining.x !== x || this.mining.y !== y) {
          this.onMsg(def.tier === 1 ? 'You need a stone pickaxe for that.' : 'You need an iron pickaxe for that.');
          this.mining = { x, y, prog: 0, need: 99 };
        }
        return false;
      }
      need = def.hard / this.pick.speed;
    } else if (VEIN_ORE[g]) {
      const ore = VEIN_ORE[g];
      if (ore === 'crystal' && this.pick.tier < 2) return false;
      if ((ore === 'iron_ore' || ore === 'copper_ore') && this.pick.tier < 1) return false;
      need = 3.6 / this.pick.speed;
    }
    if (!need) return false;
    if (!this.mining || this.mining.x !== x || this.mining.y !== y) this.mining = { x, y, prog: 0, need };
    this.mining.need = need;
    this.mining.prog += dt;
    this.face = Math.atan2(y + 0.5 - this.py, x + 0.5 - this.px);
    if (Math.random() < dt * 9) {
      this.onSound('tink');
      this.burst(x + 0.5, y + 0.5, blk === B.TREE || blk === B.PINE || blk === B.PALM ? '#8a5a2e' : '#9a958c', 2, 1.6, 0.08);
    }
    if (this.mining.prog >= need) {
      this.mining = null;
      this.breakTile(x, y);
    }
    return true;
  }

  breakTile(x: number, y: number) {
    const w = this.world;
    const m = this.fac.at(x, y);
    if (m) {
      this.fac.remove(x, y);
      const got = this.fac.contents(m);
      this.give(m.kind as ItemId, 1, true);
      for (const k in got) this.give(k as ItemId, got[k as ItemId]!);
      this.onSound('pop');
      return;
    }
    const blk = w.b(x, y);
    if (blk !== B.NONE) {
      const def = BLOCKS[blk];
      w.setB(x, y, B.NONE);
      for (const [id, n] of def.drops) this.give(id, n, true);
      if ((blk === B.TREE || blk === B.PALM) && Math.random() < 0.3) this.give('apple', 1, true);
      if (blk === B.ROCK && Math.random() < 0.15) this.give('coal', 1, true);
      if (blk === B.CACTUS && Math.random() < 0.5) this.give('berries', 1, true);
      this.onSound(blk === B.TREE || blk === B.PINE || blk === B.PALM ? 'chop' : 'break');
      this.burst(x + 0.5, y + 0.5, blk === B.TREE || blk === B.PINE ? '#3f8a3a' : '#9a958c', 12, 3);
      return;
    }
    const ore = VEIN_ORE[w.g(x, y)];
    if (ore) {
      this.give(ore, 1, true);
      this.onSound('break');
      this.burst(x + 0.5, y + 0.5, '#9a958c', 8, 2);
    }
  }

  eat(id: ItemId) {
    const heal = ITEMS[id].heal;
    if (!heal || !this.has(id)) return;
    if (this.hp >= this.maxHp) {
      this.onMsg("You're already full of health.");
      return;
    }
    this.use(id, 1);
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.onSound('eat');
    this.float(`+${heal / 2} ♥`, '#ff8d9a');
  }

  // ---------- combat ----------
  attack() {
    if (this.atkCd > 0 || this.dead) return;
    this.atkCd = 0.38;
    this.swing = 0.22;
    this.swingDir = this.face;
    this.onSound('swing');
    const dmg = this.swordDmg;
    for (const c of this.creatures) {
      const dx = c.x - this.px, dy = c.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d > 1.9) continue;
      let da = Math.atan2(dy, dx) - this.face;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d > 0.6 && Math.abs(da) > 1.15) continue;
      this.hurtCreature(c, dmg, dx / (d || 1), dy / (d || 1));
    }
  }
  shoot() {
    if (this.bowCd > 0 || this.dead) return;
    if (!this.has('bow')) return this.onMsg('Craft a bow first (wood and copper wire).');
    if (!this.has('arrow')) return this.onMsg('No arrows. Craft some from wood and stone.');
    this.bowCd = 0.45;
    this.use('arrow', 1);
    const sp = 14;
    this.shots.push({ x: this.px, y: this.py, vx: Math.cos(this.face) * sp, vy: Math.sin(this.face) * sp, enemy: false, dmg: 4 + Math.floor(this.swordDmg / 2), life: 0.9 });
    this.onSound('bow');
  }
  hurtCreature(c: Creature, dmg: number, kx: number, ky: number) {
    c.hp -= dmg;
    c.hurt = 0.2;
    c.vx += kx * 7;
    c.vy += ky * 7;
    c.charge = 0;
    this.onSound('hit');
    this.burst(c.x, c.y, c.kind === 'gloom' ? '#7d5cff' : c.kind === 'rustguard' ? '#d08a3a' : '#7a3b2a', 6, 2.5);
    if (c.hp <= 0) {
      this.creatures.splice(this.creatures.indexOf(c), 1);
      this.onSound('die');
      this.burst(c.x, c.y, c.kind === 'gloom' ? '#b9a4ff' : '#c8b08a', 16, 3.5);
      if (c.kind === 'bramble') this.give('meat', 1 + (Math.random() < 0.4 ? 1 : 0), true);
      if (c.kind === 'gloom') this.give('gloom', 1, true);
      if (c.kind === 'rustguard') {
        this.give('gear', 3, true);
        this.give('iron', 4, true);
        if (c.beacon) {
          this.guards[c.beacon] = Math.max(0, (this.guards[c.beacon] ?? 1) - 1);
          if (!this.guards[c.beacon]) this.onMsg('The guardians are beaten. Walk up to the beacon and press E.');
        }
      }
    }
  }
  hurtPlayer(dmg: number, fx: number, fy: number) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= dmg;
    this.invuln = 0.9;
    const d = Math.hypot(this.px - fx, this.py - fy) || 1;
    this.push((this.px - fx) / d * 0.5, (this.py - fy) / d * 0.5);
    this.onSound('ouch');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = 2.2;
      this.onSound('down');
    }
  }
  private push(dx: number, dy: number) {
    if (!this.blocked(this.px + dx, this.py)) this.px += dx;
    if (!this.blocked(this.px, this.py + dy)) this.py += dy;
  }

  // ---------- creatures ----------
  spawnGuards() {
    for (const b of this.world.beacons) {
      if (b.lit) continue;
      const n = this.guards[b.id] ?? 0;
      const have = this.creatures.filter((c) => c.beacon === b.id).length;
      for (let i = have; i < n; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = b.x + 0.5 + Math.cos(a) * 2.6, y = b.y + 0.5 + Math.sin(a) * 2.6;
        this.creatures.push({ kind: 'rustguard', x, y, hp: 34, max: 34, vx: 0, vy: 0, cd: 1 + i, hurt: 0, hx: x, hy: y, beacon: b.id });
      }
    }
  }
  private lightNear(x: number, y: number, r: number) {
    for (const b of this.world.beacons) if (b.lit && Math.hypot(b.x - x, b.y - y) < 16) return true;
    for (let yy = Math.floor(y) - r; yy <= Math.floor(y) + r; yy++)
      for (let xx = Math.floor(x) - r; xx <= Math.floor(x) + r; xx++) {
        const m = this.fac.at(xx, yy);
        if (m && (m.kind === 'lamp' || m.kind === 'campfire' || m.kind === 'sky_engine')) return true;
      }
    return false;
  }
  private spawnCreatures(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 1.5;
    const w = this.world;
    const near = this.creatures.filter((c) => Math.hypot(c.x - this.px, c.y - this.py) < 34);
    const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 8;
    const x = this.px + Math.cos(a) * d, y = this.py + Math.sin(a) * d;
    const tx = Math.floor(x), ty = Math.floor(y);
    const g = w.g(tx, ty);
    if (isWater(g) || this.tileSolid(tx, ty) || g === G.RUIN) return;
    if (Math.hypot(tx - w.home.x, ty - w.home.y) < 12) return;
    if (this.isNight) {
      const glooms = near.filter((c) => c.kind === 'gloom').length;
      const cap = Math.min(8, 3 + Math.floor(this.day / 2));
      if (glooms < cap && !this.lightNear(x, y, this.relics.has('lantern') ? 9 : 6)) {
        this.creatures.push({ kind: 'gloom', x, y, hp: 8, max: 8, vx: 0, vy: 0, cd: 0, hurt: 0, hx: x, hy: y });
        return;
      }
    }
    const brambles = near.filter((c) => c.kind === 'bramble').length;
    if (brambles < 6 && (g === G.FOREST || g === G.GRASS || g === G.SNOW || g === G.SAND) && Math.random() < (g === G.FOREST ? 0.7 : 0.35)) {
      this.creatures.push({ kind: 'bramble', x, y, hp: 12, max: 12, vx: 0, vy: 0, cd: 0, hurt: 0, hx: x, hy: y, charge: 0 });
    }
  }
  private moveCreature(c: Creature, dx: number, dy: number) {
    const ok = (x: number, y: number) => {
      const tx = Math.floor(x), ty = Math.floor(y);
      if (this.tileSolid(tx, ty)) return false;
      if (c.kind !== 'gloom' && isWater(this.world.g(tx, ty))) return false;
      return true;
    };
    let moved = false;
    if (ok(c.x + dx + Math.sign(dx) * 0.3, c.y)) {
      c.x += dx;
      moved = true;
    }
    if (ok(c.x, c.y + dy + Math.sign(dy) * 0.3)) {
      c.y += dy;
      moved = true;
    }
    return moved;
  }
  private updateCreatures(dt: number) {
    const night = this.isNight;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      // each creature goes after the nearest hero who is awake
      this.as(this.nearestHero(c.x, c.y), () => this.updateCreature(c, i, dt, night));
    }
  }
  private updateCreature(c: Creature, i: number, dt: number, night: boolean) {
    {
      const dx = this.px - c.x, dy = this.py - c.y;
      const d = Math.hypot(dx, dy);
      c.hurt = Math.max(0, c.hurt - dt);
      c.cd -= dt;
      // knockback drift
      if (Math.abs(c.vx) + Math.abs(c.vy) > 0.05) {
        this.moveCreature(c, c.vx * dt, c.vy * dt);
        c.vx *= Math.pow(0.02, dt);
        c.vy *= Math.pow(0.02, dt);
      }
      if (c.kind !== 'rustguard' && d > 48) {
        this.creatures.splice(i, 1);
        return;
      }
      if (c.kind === 'gloom') {
        if (!night) {
          c.fade = (c.fade ?? 0) + dt;
          if (c.fade > 1.5) this.creatures.splice(i, 1);
          return;
        }
        if (this.lightNear(c.x, c.y, 3)) {
          this.moveCreature(c, (-dx / d) * 1.5 * dt, (-dy / d) * 1.5 * dt);
          return;
        }
        if (d < 22 && !this.dead) this.moveCreature(c, (dx / d) * 2.1 * dt, (dy / d) * 2.1 * dt);
        if (d < 0.75 && c.cd <= 0) {
          c.cd = 1;
          this.hurtPlayer(1, c.x, c.y);
        }
      } else if (c.kind === 'bramble') {
        if (d < 7 && !this.dead) {
          if ((c.charge ?? 0) > 0) {
            c.charge! -= dt;
            this.moveCreature(c, c.hx * 6 * dt, c.hy * 6 * dt);
          } else if (c.cd <= 0 && d < 5) {
            c.charge = 0.55;
            c.hx = dx / d;
            c.hy = dy / d;
            c.cd = 2.2;
          } else this.moveCreature(c, (dx / d) * 1.4 * dt, (dy / d) * 1.4 * dt);
          if (d < 0.8) this.hurtPlayer(1, c.x, c.y);
        } else {
          const t = this.t * 0.4 + i * 7;
          this.moveCreature(c, Math.cos(t) * 0.6 * dt, Math.sin(t * 1.3) * 0.6 * dt);
        }
      } else {
        // rustguard: stays near its beacon, fires sparks
        const hd = Math.hypot(c.hx - c.x, c.hy - c.y);
        if (d < 9 && !this.dead) {
          if (d > 3 && hd < 6) this.moveCreature(c, (dx / d) * 1.1 * dt, (dy / d) * 1.1 * dt);
          if (c.cd <= 0) {
            c.cd = 1.8;
            const sp = 6;
            this.shots.push({ x: c.x, y: c.y, vx: (dx / d) * sp, vy: (dy / d) * sp, enemy: true, dmg: 2, life: 2 });
            this.onSound('spark');
          }
          if (d < 0.9) this.hurtPlayer(2, c.x, c.y);
        } else if (hd > 0.3) this.moveCreature(c, ((c.hx - c.x) / hd) * 1.2 * dt, ((c.hy - c.y) / hd) * 1.2 * dt);
      }
    }
  }
  private updateShots(dt: number) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let gone = s.life <= 0 || this.world.solidBlock(Math.floor(s.x), Math.floor(s.y));
      if (!gone && s.enemy)
        gone = this.as(this.nearestHero(s.x, s.y), () => {
          if (Math.hypot(s.x - this.px, s.y - this.py) >= 0.5) return false;
          this.hurtPlayer(s.dmg, s.x - s.vx, s.y - s.vy);
          return true;
        });
      if (!gone && !s.enemy)
        for (const c of this.creatures)
          if (Math.hypot(s.x - c.x, s.y - c.y) < 0.55) {
            const sp = Math.hypot(s.vx, s.vy);
            this.hurtCreature(c, s.dmg, s.vx / sp, s.vy / sp);
            gone = true;
            break;
          }
      if (gone) this.shots.splice(i, 1);
    }
  }

  // ---------- points of interest ----------
  openChest(i: number) {
    const c = this.world.chests[i];
    if (!c || c.opened) return [];
    c.opened = true;
    const got: string[] = [];
    const r = (k: number) => hash2(c.x, c.y, this.world.seed + k);
    const tier = c.dist < 50 ? 0 : c.dist < 100 ? 1 : 2;
    const giveL = (id: ItemId, n: number) => {
      this.give(id, n);
      got.push(`${n} × ${ITEMS[id].name}`);
    };
    const missingRelics = (Object.keys(RELICS) as Relic[]).filter((k) => !this.relics.has(k));
    if (!this.has('bow') && r(1) < 0.5) giveL('bow', 1);
    if (missingRelics.length && r(2) < 0.3) {
      const rel = missingRelics[Math.floor(r(3) * missingRelics.length)];
      this.relics.add(rel);
      got.push(`${RELICS[rel].name}! ${RELICS[rel].text}`);
    } else if (r(4) < 0.35 && this.maxHp < MAX_HP_CAP) {
      this.maxHp += 2;
      this.hp = this.maxHp;
      got.push('A heart vessel: +1 heart!');
    }
    const pool: [ItemId, number][][] = [
      [['arrow', 12], ['coal', 10], ['copper', 8], ['apple', 3], ['plank', 12], ['iron_ore', 10]],
      [['arrow', 16], ['iron', 12], ['gear', 8], ['wire', 16], ['roast', 3], ['glass', 8], ['coal', 20]],
      [['arrow', 20], ['circuit', 8], ['steel', 6], ['crystal', 6], ['stew', 2], ['gear', 14], ['lens', 3]],
    ];
    const list = pool[tier];
    for (let k = 0; k < 2 + tier; k++) {
      const [id, n] = list[Math.floor(r(10 + k) * list.length)];
      giveL(id, n);
    }
    this.onSound('chest');
    this.burst(c.x + 0.5, c.y + 0.5, '#ffd76a', 18, 3);
    return got;
  }

  findStone(i: number) {
    const s = this.world.stones[i];
    if (!s.found) {
      s.found = true;
      this.world.reveal(s.x, s.y, 26);
      this.onSound('chime');
      this.onMsg('Waystone woken! You can travel here from the map.');
    }
    this.spawn = [s.x + 0.5, s.y + 1.6];
  }

  travel(x: number, y: number) {
    const p = this.world.findLand(x, y + 2);
    this.px = p.x + 0.5;
    this.py = p.y + 0.5;
    if (this.blocked(this.px, this.py)) {
      this.world.clear(p.x, p.y, 0);
    }
    this.creatures = this.creatures.filter((c) => c.kind === 'rustguard');
    this.world.reveal(this.px, this.py, 14);
    this.onSound('travel');
  }

  giveToBeacon(id: string) {
    const b = this.world.beacons.find((q) => q.id === id)!;
    const def = BEACONS.find((q) => q.id === id)!;
    if (b.lit) return;
    if ((this.guards[id] ?? 0) > 0) return this.onMsg('The Rustguards still hold this beacon.');
    let gave = 0;
    for (const [item, n] of def.want) {
      const still = n - (b.given[item] ?? 0);
      const can = Math.min(still, this.inv[item] ?? 0);
      if (can > 0) {
        this.use(item, can);
        b.given[item] = (b.given[item] ?? 0) + can;
        gave += can;
      }
    }
    if (!gave) return this.onMsg("You don't have anything it still needs.");
    this.onSound('give');
    if (def.want.every(([item, n]) => (b.given[item] ?? 0) >= n)) {
      b.lit = true;
      this.give('ember_core', 1);
      this.maxHp = Math.min(MAX_HP_CAP, this.maxHp + 2);
      this.hp = this.maxHp;
      this.world.reveal(b.x, b.y, 70);
      this.spawn = [b.x + 0.5, b.y + 2.5];
      this.burst(b.x + 0.5, b.y + 0.5, '#ffb347', 40, 5, 0.18);
      this.onSound('lit');
      this.onBeaconLit(def.name);
    }
  }

  // ---------- main update ----------
  /** `sim` is false on a friend's game: only your own hero walks there; the host runs creatures, mining and fights. */
  update(dt: number, input: { mx: number; my: number; sprint: boolean }, sim = true) {
    this.t += dt;
    // a friend runs the machines too, so belts move smoothly between the host's updates
    this.fac.tick(dt);
    this.tickHero(dt, input, sim);
    const k = Math.min(1, dt * 12);
    for (const h of this.others) {
      // glide the others toward where they last were
      if (h.tx !== undefined && h.ty !== undefined && !h.dead) {
        h.px += (h.tx - h.px) * k;
        h.py += (h.ty - h.py) * k;
      }
      if (sim)
        this.as(h, () => {
          this.tickHero(dt, null, true);
          const at = h.mineAt;
          if (at && !this.dead && Math.hypot(at.x + 0.5 - this.px, at.y + 0.5 - this.py) <= REACH + 1) {
            if (!this.mineTick(at.x, at.y, dt)) this.mining = this.mining && this.mining.need > 50 ? this.mining : null;
          } else this.mining = null;
        });
      else {
        h.swing = Math.max(0, h.swing - dt);
        h.invuln = Math.max(0, h.invuln - dt);
      }
    }
    if (sim) {
      const live = this.heroes.filter((h) => !(h === this.active ? this.dead : h.dead));
      const who = live[Math.floor(Math.random() * live.length)] ?? this.me;
      this.as(who, () => this.spawnCreatures(dt));
      this.updateCreatures(dt);
      this.updateShots(dt);
      if (this.creatures.length < 200 && Math.random() < dt * 0.2) this.spawnGuards();
    } else {
      for (const c of this.creatures) {
        c.x += (c.hx - c.x) * k;
        c.y += (c.hy - c.y) * k;
        c.hurt = Math.max(0, c.hurt - dt);
      }
      for (const q of this.shots) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
    }
    this.updateEffects(dt);
  }

  /** One hero's timers, waking up and walking. `input` is null for a friend on the host (they walk on their own game). */
  private tickHero(dt: number, input: { mx: number; my: number; sprint: boolean } | null, sim: boolean) {
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.bowCd = Math.max(0, this.bowCd - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.dead > 0 && !sim) return;

    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) {
        this.dead = 0;
        this.px = this.spawn[0];
        this.py = this.spawn[1];
        if (this.blocked(this.px, this.py)) {
          const p = this.world.findLand(Math.floor(this.px), Math.floor(this.py));
          this.px = p.x + 0.5;
          this.py = p.y + 0.5;
        }
        this.hp = this.maxHp;
        this.stamina = 1;
        if (!this.others.length) this.creatures = this.creatures.filter((c) => c.kind === 'rustguard');
        this.active.tp++;
        this.onMsg('You wake up by the fire, all patched up.');
      }
    } else if (input) this.movePlayer(dt, input);
  }

  private updateEffects(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 4 * dt;
      p.life -= dt;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.y -= dt * 0.8;
      f.life -= dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    // embers drifting from lit beacons and fires
    for (const b of this.world.beacons)
      if (b.lit && Math.abs(b.x - this.px) < 30 && Math.abs(b.y - this.py) < 20 && Math.random() < dt * 8)
        this.parts.push({ x: b.x + 0.5 + (Math.random() - 0.5) * 0.6, y: b.y - 0.6, vx: (Math.random() - 0.5) * 0.6, vy: -1.5 - Math.random(), life: 1.4, max: 1.4, color: '#ffb347', size: 0.07 });
  }

  private movePlayer(dt: number, input: { mx: number; my: number; sprint: boolean }) {
    const w = this.world;
    let { mx, my } = input;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.moving = len > 0.1;
    const tx = Math.floor(this.px), ty = Math.floor(this.py);
    const g = w.g(tx, ty);
    this.swimming = isWater(g);
    const kite = this.relics.has('kite');
    this.gliding = this.swimming && kite && input.sprint && this.moving && this.stamina > 0;
    if (this.gliding) this.swimming = false;
    const sprint = input.sprint && this.moving && !this.tired && !this.swimming;
    let speed = 4.2 * (this.relics.has('boots') ? 1.25 : 1);
    if (sprint) speed *= 1.6;
    if (this.swimming) speed = this.relics.has('fins') ? 3.4 : 2.4;
    if (g === G.SNOW) speed *= 0.92;
    if (g === G.PATH || g === G.RUIN) speed *= 1.1;

    // stamina
    if (this.swimming) this.stamina -= dt * (this.relics.has('fins') ? 0.045 : 0.09);
    else if (this.gliding) this.stamina -= dt * 0.03;
    else if (sprint) this.stamina -= dt * 0.22;
    else this.stamina = Math.min(1, this.stamina + dt * 0.3);
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.tired = true;
      if (this.swimming || isWater(g)) {
        this.px = this.lastLand[0];
        this.py = this.lastLand[1];
        this.hurtPlayer(1, this.px, this.py - 1);
        this.onMsg('Out of breath! You wash back to the shore.');
        this.stamina = 0.4;
      }
    }
    if (this.tired && this.stamina > 0.35) this.tired = false;
    if (!isWater(g)) this.lastLand = [this.px, this.py];

    let vx = mx * speed, vy = my * speed;
    // belts carry you along
    const belt = this.fac.at(tx, ty);
    if (belt?.kind === 'belt') {
      vx += DX[belt.dir] * 1.4;
      vy += DY[belt.dir] * 1.4;
    }
    if (this.moving && !this.mining) this.face = Math.atan2(my, mx);
    const nx = this.px + vx * dt, ny = this.py + vy * dt;
    if (!this.blocked(nx, this.py)) this.px = nx;
    if (!this.blocked(this.px, ny)) this.py = ny;
    if (this.moving) {
      this.stepT += dt * speed;
      if (this.stepT > 1.6) {
        this.stepT = 0;
        this.onSound(this.swimming ? 'swim' : 'step');
      }
    }
    w.reveal(this.px, this.py, this.relics.has('lantern') ? 15 : 13);
  }

  /** The next thing to aim for, for the HUD's compass. */
  objective(): { text: string; x?: number; y?: number } {
    const inv = this.inv;
    if (this.pick.tier === 0) {
      if ((inv.wood ?? 0) < 3) return { text: 'Hold click on a tree to chop wood.' };
      if ((inv.stone ?? 0) < 4) return { text: 'Mine some rocks for stone.' };
      return { text: 'Open your bag (Tab) and craft a stone pickaxe.' };
    }
    if (![...this.fac.machines.values()].some((m) => m.kind === 'furnace') && !this.has('copper', 1) && !this.has('furnace'))
      return { text: 'Craft a furnace (10 stone) and place it. Feed it coal and copper ore with E.' };
    for (const b of this.world.beacons) {
      if (b.lit) continue;
      const def = BEACONS.find((q) => q.id === b.id)!;
      if ((this.guards[b.id] ?? 0) > 0) return { text: `Find the ${def.name} in the ${def.biome} and beat its Rustguards.`, x: b.x, y: b.y };
      const need = def.want.map(([id, n]) => `${Math.max(0, n - (b.given[id] ?? 0))} ${ITEMS[id].name.toLowerCase()}`).join(', ');
      return { text: `${def.name} needs ${need}. ${def.hint}`, x: b.x, y: b.y };
    }
    if (!this.won) return { text: 'All four beacons burn! Craft the Sky Engine and place it.' };
    return { text: 'You did it! Keep building, exploring and automating.' };
  }

  /** Light level helpers for the renderer */
  lights(): { x: number; y: number; r: number }[] {
    const out: { x: number; y: number; r: number }[] = [{ x: this.px, y: this.py, r: this.relics.has('lantern') ? 6.5 : 4.2 }];
    const x0 = this.px - 30, x1 = this.px + 30, y0 = this.py - 20, y1 = this.py + 20;
    for (const m of this.fac.machines.values()) {
      if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
      if (m.kind === 'lamp') out.push({ x: m.x + 0.5, y: m.y + 0.5, r: 7 });
      else if (m.kind === 'campfire') out.push({ x: m.x + 0.5, y: m.y + 0.5, r: 5.5 });
      else if (m.kind === 'furnace' && m.working) out.push({ x: m.x + 0.5, y: m.y + 0.5, r: 2.5 });
      else if (m.kind === 'sky_engine') out.push({ x: m.x + 0.5, y: m.y + 0.5, r: 12 });
    }
    for (const b of this.world.beacons) if (b.lit) out.push({ x: b.x + 0.5, y: b.y + 0.5, r: 14 });
    for (const s of this.world.stones) if (s.found) out.push({ x: s.x + 0.5, y: s.y + 0.5, r: 3 });
    return out;
  }
}
