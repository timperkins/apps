// The game itself: players, animals, buildings, machines, power, oil, the rocket silo and the space ship.
// The host's copy runs everything; friends' copies only show what the host sends and move their own player.
import {
  AMMO_BONUS, BUILDS, CARS, CRUSH, DAY_LEN, DESTINATIONS, FUEL_KM, HOMES, ITEMS, MAX_HP, MOBS, MONTH_DAYS, RECIPE, ROCK_HP, TECH, ROCK_ITEM,
  SILO_CARGO, SMELT, SPACE_UNITS_TO_LAUNCH, START_MONEY, THRUSTER_SPEED, WATER_LEVEL, WEAPONS, FOOD_MENU, STORE_STOCK, PETS,
  type BuildId, type CarId, type HomeId, type ItemId, type RockKind, type RockSize, type WeaponId,
} from './data';
import { add, count, counts, newInv, plan, remove, room, type Inv, type Slot } from './inventory';
import { CAVE_ORE, CAVE_SIZE, World, dist2, key, wd, wrap, type Feature, type VillageBuilding } from './world';

export type Dim = string; // 'earth', 'space', or a cave / mine id like 'c:500123:4100'
export const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // north, east, south, west

export interface Player {
  slot: number;
  name: string;
  color: string;
  x: number; y: number; z: number; yaw: number; vy: number;
  dim: Dim;
  hp: number;
  money: number;
  inv: Inv;
  hand: number;
  craftQ: { id: string; left: number; total: number; part?: boolean; req?: number; refund?: [ItemId, number][] }[];
  car: number | null;
  home: { x: number; z: number; dim: Dim } | null;
  houses: string[];
  cool: number;
  hurtT: number;
  anim: number; // walking phase
  swing: number;
  traveled: number;
  open: number | null; // building panel open (friends get its contents)
}

export interface Building {
  id: number;
  type: BuildId;
  dim: Dim;
  x: number; z: number;
  dir: number;
  hp: number;
  inv?: Inv; // chests, houses, silo cargo, refinery and crusher output
  inp?: Slot | null;
  fuel?: Slot | null;
  out?: Slot | null;
  burn?: number;
  prog?: number;
  recipe?: string | null;
  parts?: Record<ItemId, number>; // assembler ingredients
  items?: { id: ItemId; p: number }[]; // belt
  hold?: Slot | null; // grabber
  swing?: number;
  pair?: number | null; // underground belt / pipe partner
  ug?: 'in' | 'out';
  power?: number; // 0..1 how much power it gets
  on?: boolean;
  aim?: number;
  units?: number; // silo
  launch?: number; // silo countdown
  rider?: number | null; // silo: player slot inside
  oil?: number; // pumpjack buffer
  water?: boolean; // has water (steam engine)
  owner?: number;
  hub?: boolean;
  /** Roboports: where robots may get things for ghosts. */
  fromChests?: boolean;
  fromBelts?: boolean;
}

/** A see-through plan of a building: it does nothing until a robot (or you) builds the real thing there. */
export interface Ghost { id: number; type: BuildId; dim: Dim; x: number; z: number; dir: number; owner: number }

/** A flying robot out on a job. */
export interface Bot {
  id: number; dim: Dim; x: number; y: number; z: number;
  home: number; // roboport id
  ghost: number; // the ghost it is building
  src: number; // where it gets the thing from (0 = going home)
  carry: ItemId | null;
  stage: 'fetch' | 'build' | 'home';
}

export interface Mob {
  id: number;
  type: string;
  dim: Dim;
  x: number; y: number; z: number; yaw: number;
  hp: number;
  tgt: { k: 'p' | 'm' | 'b'; id: number } | null;
  t: number; // timer for wandering / attacks
  wx: number; wz: number; // wander goal
  hx: number; hz: number; // home (nest, village)
  home?: string; // nest key / village id
  owner?: number; // pets: player slot
  angry: number;
  anim: number;
  flee: number;
  raid?: boolean;
}

export interface Vehicle {
  id: number;
  car: CarId;
  x: number; y: number; z: number; yaw: number;
  owner: number;
  rentDay: number | null; // rented until this day, null = bought
  driver: number | null;
}

export interface Shot { id: number; dim: Dim; x: number; y: number; z: number; vx: number; vy: number; vz: number; dmg: number; splash: number; kind: 'rocket' | 'grenade'; owner: number; life: number; }

export interface Rock { id: number; kind: RockKind; size: RockSize; x: number; z: number; vx: number; vz: number; hp: number; rot: number; grabbed?: number; }

export interface Ship {
  tiles: Set<string>;
  at: number; // DESTINATIONS index
  dest: number;
  moving: boolean;
  km: number; // traveled toward dest
  rocks: Rock[];
  made: boolean;
}

export type Fx =
  | { k: 'sfx'; s: string; x: number; y: number; z: number; dim: Dim }
  | { k: 'puff' | 'spark' | 'boom' | 'chips' | 'flame' | 'smoke'; x: number; y: number; z: number; dim: Dim; c?: string; n?: number }
  | { k: 'tracer'; x: number; y: number; z: number; tx: number; ty: number; tz: number; dim: Dim; c?: string }
  | { k: 'launch'; x: number; z: number; dim: Dim };

export type Target =
  | { k: 'mob'; id: number }
  | { k: 'feat'; x: number; z: number }
  | { k: 'build'; id: number }
  | { k: 'cave'; x: number; z: number }
  | { k: 'ground'; x: number; z: number }
  | { k: 'rock'; id: number }
  | { k: 'ghost'; id: number };

export const PLAYER_RADIUS = 0.35;
/** Crafting by hand takes a little while (Tim: "crafting should take a little time"). */
export const handTime = (t: number) => Math.max(0.6, t * 1.6);
export const REACH = 6;
const TICK = 0.05;
const BELT_SPEED = 1.9;
const ENGINE_POWER = 900;

const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
export const COLORS = ['#ffd23f', '#4fc3f7', '#ff6b9d', '#7ddc6a'];

export const isFluid = (t: BuildId) => t === 'pipe' || t === 'underground_pipe' || t === 'water_pump' || t === 'steam_engine' || t === 'pumpjack' || t === 'oil_refinery';
export const isGrabber = (t: BuildId) => t === 'grabber' || t === 'long_grabber' || t === 'bulk_grabber' || t === 'fast_grabber';
export const isBelt = (t: BuildId) => t === 'belt' || t === 'underground_belt' || t === 'fast_belt' || t === 'express_belt';
export const isChest = (t: BuildId) => t === 'chest' || t === 'steel_chest';
const SOLAR_POWER = 120;

export function newPlayer(slot: number, w: World): Player {
  const inv = newInv(40);
  add(inv, 'wood', 20);
  add(inv, 'stone', 10);
  add(inv, 'furnace', 2);
  add(inv, 'chest', 1);
  add(inv, 'torch', 4);
  add(inv, 'apple', 5);
  return {
    slot, name: NAMES[slot] ?? 'Player', color: COLORS[slot] ?? '#fff',
    x: w.spawnX + 0.5 + slot * 1.5, y: 0, z: w.spawnZ + 0.5, yaw: Math.PI / 2, vy: 0, dim: 'earth',
    hp: MAX_HP, money: START_MONEY, inv, hand: 0, craftQ: [], car: null, home: null, houses: [], cool: 0, hurtT: 0, anim: 0, swing: 0, traveled: 0, open: null,
  };
}

export class Game {
  w: World;
  time = DAY_LEN * 0.05;
  players = new Map<number, Player>();
  me: Player;
  buildings = new Map<number, Building>();
  occ = new Map<string, number>(); // `dim|x,z` -> building id
  ghosts = new Map<number, Ghost>();
  gocc = new Map<string, number>(); // `dim|x,z` -> ghost id
  bots: Bot[] = [];
  mobs = new Map<number, Mob>();
  cars = new Map<number, Vehicle>();
  shots: Shot[] = [];
  ship: Ship = { tiles: new Set(), at: 0, dest: 0, moving: false, km: 0, rocks: [], made: false };
  /** Houses people bought: village building id -> owner name + storage. */
  owned = new Map<string, { slot: number; inv: Inv }>();
  nextId = 1;
  fx: Fx[] = [];
  toasts: string[] = [];
  /** Things friends need to hear about (buildings, edits); the host sends these. */
  events: unknown[] = [];
  remote = false; // a friend's copy
  private acc = 0;
  private powerDirty = true;
  private fluidDirty = true;
  private spawnT = 0;
  private raidT = 120;
  private nestBugs = new Map<string, number>();
  private nestT = new Map<string, number>();
  private villagePeople = new Map<string, number>();
  dirtyPlayers = new Set<number>();

  constructor(seed: number) {
    this.w = new World(seed);
    this.me = newPlayer(0, this.w);
    this.me.y = this.w.heightAt(this.me.x, this.me.z);
    this.players.set(0, this.me);
  }

  // ---------- small helpers ----------
  get day() { return Math.floor(this.time / DAY_LEN) + 1; }
  get tod() { return (this.time % DAY_LEN) / DAY_LEN; }
  get night() { const t = this.tod; return t > 0.72 || t < 0.02; }
  /** 0 at night, 1 in the day. */
  get light() {
    const t = this.tod;
    if (t < 0.02) return 0.15 + (t / 0.02) * 0.2;
    if (t < 0.1) return 0.35 + ((t - 0.02) / 0.08) * 0.65;
    if (t < 0.65) return 1;
    if (t < 0.75) return 1 - ((t - 0.65) / 0.1) * 0.85;
    return 0.15;
  }
  toast(s: string, p?: Player) {
    if (!p || p === this.me) this.toasts.push(s);
    else this.events.push({ t: 'toast', to: p.slot, s });
  }
  sfx(s: string, x: number, y: number, z: number, dim: Dim) { this.fx.push({ k: 'sfx', s, x, y, z, dim }); }
  dirty(p: Player) { this.dirtyPlayers.add(p.slot); }
  held(p: Player): Slot | null { return p.inv[p.hand] ?? null; }
  occKey(dim: Dim, x: number, z: number) { return `${dim}|${wrap(Math.floor(x))},${wrap(Math.floor(z))}`; }
  buildingAt(dim: Dim, x: number, z: number): Building | null {
    const id = this.occ.get(this.occKey(dim, x, z));
    return id ? this.buildings.get(id) ?? null : null;
  }
  /** Belts, pipes and roads lie under machines' footprints? No: one thing per tile. */
  private ahead(b: Building, n = 1): [number, number] {
    const [dx, dz] = DIRS[b.dir];
    return [b.x + dx * n, b.z + dz * n];
  }

  // ---------- moving around ----------
  groundY(dim: Dim, x: number, z: number) {
    if (dim === 'earth') {
      const h = this.w.heightAt(x, z);
      return Math.max(h, this.w.latitude(z) < 1300 ? h : h);
    }
    return 0;
  }
  /** Can a body stand at x,z coming from height y? */
  free(dim: Dim, x: number, z: number, y: number, r = PLAYER_RADIUS, step = 1.05): boolean {
    for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const px = x + ox, pz = z + oz;
      const tx = Math.floor(px), tz = Math.floor(pz);
      if (dim === 'earth') {
        if (this.groundY(dim, px, pz) - y > step) return false;
        const f = this.w.feature(tx, tz);
        if (this.w.blocks(f)) {
          const cx = tx + 0.5, cz = tz + 0.5;
          const rr = f!.kind === 'rock' ? 0.45 : f!.kind === 'nest' ? 0.6 : 0.3;
          if (Math.abs(wd(x, cx)) < rr + r && Math.abs(wd(z, cz)) < rr + r) return false;
        }
        if (this.w.villageBuildingAt(px, pz)) return false;
      } else if (dim === 'space') {
        if (!this.ship.tiles.has(key(tx, tz))) return false;
      } else {
        const c = this.w.cave(dim);
        if (this.w.caveCell(c, px, pz) !== 0) return false;
      }
      const b = this.buildingAt(dim, px, pz);
      if (b && !BUILDS[b.type].flat) return false;
    }
    return true;
  }

  /** Moves a player by their own controls; used on every device for its own player. */
  movePlayer(p: Player, mx: number, mz: number, jump: boolean, run: boolean, dt: number) {
    const car = p.car ? this.cars.get(p.car) : null;
    const water = p.dim === 'earth' && this.w.isWater(p.x, p.z) && this.groundY('earth', p.x, p.z) < WATER_LEVEL - 0.6;
    let speed = car ? CARS[car.car].speed : run ? 7 : 4.6;
    if (water) speed = car ? 2 : 2.4;
    if (p.dim === 'earth' && this.w.isRoad(p.x, p.z)) speed *= 1.25;
    if (p.dim === 'earth') { const b = this.buildingAt('earth', p.x, p.z); if (b && (b.type === 'road' || b.type === 'roundabout')) speed *= 1.25; }
    if (car) {
      // cars turn with left/right and go with forward/back
      const fwd = -mz, turn = mx;
      if (Math.abs(fwd) > 0.05) p.yaw -= turn * dt * 2.2 * Math.sign(fwd);
      mx = Math.sin(p.yaw) * fwd;
      mz = Math.cos(p.yaw) * fwd;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const dx = mx * speed * dt, dz = mz * speed * dt;
    const step = car ? 0.7 : 1.05;
    const r = car ? 0.9 : PLAYER_RADIUS;
    let nx = p.x, nz = p.z;
    if (dx && this.free(p.dim, p.x + dx, p.z, p.y, r, step)) nx = p.x + dx;
    if (dz && this.free(p.dim, nx, p.z + dz, p.y, r, step)) nz = p.z + dz;
    const moved = Math.hypot(wd(nx, p.x), nz - p.z);
    p.traveled += moved;
    p.x = p.dim === 'earth' ? wrap(nx) : nx;
    p.z = p.dim === 'earth' ? wrap(nz) : nz;
    if (len > 0.05 && !car) p.yaw = Math.atan2(mx, mz);
    p.anim = moved > 0.001 ? p.anim + moved * 2.2 : 0;
    const g = this.groundY(p.dim, p.x, p.z);
    const floor = water ? WATER_LEVEL - 0.55 : g;
    if (jump && p.y <= floor + 0.05 && !car) p.vy = 7;
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= floor) {
      if (p.vy < -17 && p.dim === 'earth' && !water) this.hurtPlayer(p, Math.round((-p.vy - 17) * 4), 'a fall');
      p.y = floor;
      p.vy = 0;
    }
    if (car) { car.x = p.x; car.z = p.z; car.y = p.y; car.yaw = p.yaw; }
  }

  // ---------- the world clock ----------
  update(dt: number) {
    this.time += dt;
    if (this.remote) return;
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK && n++ < 5) {
      this.acc -= TICK;
      this.tick(TICK);
    }
    if (this.acc > TICK) this.acc = 0;
  }

  private tick(dt: number) {
    for (const p of this.players.values()) this.tickPlayer(p, dt);
    if (this.powerDirty) this.computePower();
    if (this.fluidDirty) this.computeFluids();
    this.tickPower();
    for (const b of this.buildings.values()) this.tickBuilding(b, dt);
    this.tickMobs(dt);
    this.tickAlerts(dt);
    this.tickBots(dt);
    this.tickShots(dt);
    this.tickShip(dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.5; this.spawnStuff(); }
    this.raidT -= dt;
    if (this.raidT <= 0) { this.raidT = 150 + Math.random() * 90; this.raid(); }
    // rented cars go back after a month
    for (const c of this.cars.values()) if (c.rentDay !== null && this.day > c.rentDay) {
      const p = this.players.get(c.owner);
      if (p && p.car === c.id) p.car = null;
      this.cars.delete(c.id);
      this.events.push({ t: 'car-', id: c.id });
      if (p) this.toast('Your rented car went back to the rental shop (the month is up).', p);
    }
  }

  private tickPlayer(p: Player, dt: number) {
    p.cool = Math.max(0, p.cool - dt);
    p.hurtT += dt;
    if (p.hurtT > 5 && p.hp < MAX_HP) { p.hp = Math.min(MAX_HP, p.hp + dt * 2); if (Math.floor(p.hp) % 5 === 0) this.dirty(p); }
    // campfires heal faster
    const q = p.craftQ[0];
    if (q) {
      q.left -= dt;
      if (q.left <= 0) {
        p.craftQ.shift();
        const r = RECIPE[q.id];
        if (!q.part) {
          const left = add(p.inv, r.out, r.n);
          if (left) this.toast('Your bag is full!', p);
          this.sfx('craft', p.x, p.y, p.z, p.dim);
          // once a job is partly done, cancelling it gives back nothing more for the finished ones
          if (q.refund === undefined) { const fin = p.craftQ.find((o) => o.req === q.req && o.refund); if (fin) fin.refund = fin.refund!.map(([id, n]) => [id, Math.floor(n * 0.9)]); }
        }
        this.dirty(p);
      }
    }
  }

  // ---------- players doing things (friends' actions come here through the host) ----------
  action(p: Player, a: string, args: Record<string, unknown>): void {
    const num = (k: string) => Number(args[k]) || 0;
    const str = (k: string) => String(args[k] ?? '');
    switch (a) {
      case 'craft': return this.craft(p, str('id'), Math.max(1, Math.min(50, num('n'))));
      case 'cancel': {
        // cancel the last job you asked for, and get back what it took
        const last = p.craftQ[p.craftQ.length - 1];
        if (!last) return;
        const req = last.req;
        const job = p.craftQ.filter((q) => q.req === req);
        const done = job.filter((q) => !q.part).length;
        const total = job.find((q) => q.refund)?.refund;
        p.craftQ = p.craftQ.filter((q) => q.req !== req);
        if (total) for (const [id, n] of total) add(p.inv, id, n);
        void done;
        this.dirty(p);
        return;
      }
      case 'mine': return this.mine(p, args.tg as Target);
      case 'hit': return this.melee(p, args.tg as Target);
      case 'fire': return this.fire(p, num('x'), num('y'), num('z'));
      case 'place': return this.place(p, num('slot'), num('x'), num('z'), num('dir') & 3);
      case 'ghost': {
        // hold Ctrl: a plan of the building in your hand, without using it up
        const sl = p.inv[num('slot')];
        const type = sl ? ITEMS[sl.id]?.build : undefined;
        if (!type) return;
        const why = this.placeGhost(p, type, num('x'), num('z'), num('dir') & 3, true);
        if (why) { this.toast(why, p); this.sfx('nope', p.x, p.y, p.z, p.dim); } else this.sfx('click', p.x, p.y, p.z, p.dim);
        return;
      }
      case 'ghosts': {
        // a blueprint: lots of ghosts at once
        const list = Array.isArray(args.list) ? (args.list as unknown[]).slice(0, 2000) : [];
        let ok = 0, bad = 0;
        for (const e of list) {
          const [type, x, z, dir] = e as [BuildId, number, number, number];
          if (!BUILDS[type] || type === 'space_platform' || type === 'house' || !Number.isFinite(x) || !Number.isFinite(z)) continue;
          if (this.placeGhost(p, type, Math.floor(x), Math.floor(z), (dir | 0) & 3, false)) bad++; else ok++;
        }
        this.toast(ok ? `Placed ${ok} ghost${ok > 1 ? 's' : ''}${bad ? ` (${bad} didn’t fit)` : ''}. Robots from a roboport will build them.` : 'None of it fits there.', p);
        this.sfx(ok ? 'place' : 'nope', p.x, p.y, p.z, p.dim);
        return;
      }
      case 'research': {
        const id = str('id');
        if (id === '') { this.research.cur = null; this.research.units = 0; this.resEvent(); return; }
        if (!this.canResearch(id) || this.research.cur === id) return;
        this.research.cur = id; this.research.units = 0;
        for (const b of this.buildings.values()) if (b.type === 'lab') b.prog = 0;
        this.resEvent();
        return;
      }
      case 'unghost': { const gh = this.ghosts.get(num('id')); if (gh && gh.dim === p.dim) { this.removeGhost(gh); this.sfx('pickup', gh.x + 0.5, p.y, gh.z + 0.5, p.dim); } return; }
      case 'robo': {
        const b = this.buildings.get(num('id'));
        if (!b || b.type !== 'roboport') return;
        if (args.chests !== undefined) b.fromChests = args.chests === true;
        if (args.belts !== undefined) b.fromBelts = args.belts === true;
        this.bchanged(b);
        return;
      }
      case 'pickup': return this.pickUp(p, num('id'));
      case 'eat': return this.eat(p, num('slot'));
      case 'swap': return this.swap(p, num('a'), num('b'));
      case 'hand': p.hand = Math.max(0, Math.min(9, num('i'))); this.dirty(p); return;
      case 'bput': return this.bput(p, num('id'), num('slot'), args.all === true);
      case 'btake': return this.btake(p, num('id'), str('from'), num('i'));
      case 'recipe': { const b = this.buildings.get(num('id')); if (b && b.type === 'assembler' && ((RECIPE[str('r')] && !this.locked(str('r'))) || str('r') === '')) { b.recipe = str('r') || null; b.prog = 0; this.bchanged(b); } return; }
      case 'rotate': { const b = this.buildings.get(num('id')); if (b && this.near(p, b.x, b.z, REACH + 2)) { b.dir = (b.dir + 1) & 3; this.bchanged(b); this.powerDirty = this.fluidDirty = true; } return; }
      case 'open': p.open = num('id') || null; return;
      case 'enter': return this.enter(p, args.tg as Target);
      case 'leave': return this.leaveCave(p);
      case 'car': return this.toggleCar(p);
      case 'buy': return this.buy(p, str('shop'), str('id'), Math.max(1, Math.min(100, num('n'))), str('vb'));
      case 'sell': return this.sell(p, num('slot'), args.all === true);
      case 'launch': return this.launch(p, num('id'), args.ride === true);
      case 'travel': return this.travel(num('dest'));
      case 'stop': this.ship.moving = false; return;
      case 'down': return this.goDown(p);
      case 'hput': case 'htake': {
        // storage in a village house you bought
        const o = this.owned.get(str('vb'));
        const door = this.villageDoor(p);
        if (!o || o.slot !== p.slot || !door || door.id !== str('vb')) return;
        const i = num('i');
        if (a === 'hput') { const s = p.inv[i]; if (!s) return; const left = add(o.inv, s.id, s.n); if (left) s.n = left; else p.inv[i] = null; }
        else { const s = o.inv[i]; if (!s) return; const left = add(p.inv, s.id, s.n); if (left) s.n = left; else o.inv[i] = null; }
        this.sfx('drop', p.x, p.y, p.z, p.dim);
        this.events.push({ t: 'hinv', to: p.slot, vb: str('vb'), inv: o.inv });
        this.dirty(p);
        return;
      }
      case 'sethome': { const b = this.buildings.get(num('id')); if (b && b.type === 'house') { p.home = { x: b.x + 1.5, z: b.z + 3.6, dim: b.dim }; this.toast('This is your home now. You wake up here.', p); this.dirty(p); } return; }
    }
  }

  near(p: Player, x: number, z: number, r = REACH) {
    r += this.reachBonus();
    return dist2(p.x, p.z, x, z) <= r * r;
  }

  craft(p: Player, id: string, n: number) {
    const r = RECIPE[id];
    if (!r) return;
    const have0 = counts(p.inv);
    const have = new Map(have0);
    const steps = plan(have, id, n * r.n);
    if (this.locked(id)) { this.toast(`Research ${TECH[r.tech!].name} first (🔬 in a lab).`, p); return; }
    if (!steps) { this.toast(`You need more stuff to make ${ITEMS[r.out].name}.`, p); return; }
    // take what the whole job uses out of the bag now; parts made along the way go straight into the next step
    const refund: [ItemId, number][] = [];
    for (const [k, v0] of have0) {
      const v = have.get(k) ?? 0;
      if (v < v0) { remove(p.inv, k, v0 - v); refund.push([k, v0 - v]); }
    }
    for (const [k, v] of have) {
      const extra = v - (have0.get(k) ?? 0);
      if (extra > 0 && k !== r.out) add(p.inv, k, extra); // leftover parts (belts come in twos)
    }
    const req = this.nextId++;
    const last = steps[steps.length - 1];
    for (const s of steps) {
      const rr = RECIPE[s.id];
      const ht = handTime(rr.time) * (this.has('quick_hands') ? 0.6 : 1);
      for (let i = 0; i < s.times; i++) p.craftQ.push({ id: s.id, left: ht, total: ht, part: s !== last, req, refund: s === last && i === s.times - 1 ? refund : undefined } as Player['craftQ'][number]);
    }
    this.sfx('click', p.x, p.y, p.z, p.dim);
    this.dirty(p);
  }

  /** Mines a tree, rock, ore tile or cave wall. The player's device times the mining; this hands out the items. */
  mine(p: Player, tg: Target) {
    if (!tg) return;
    if (tg.k === 'feat') {
      if (p.dim !== 'earth' || !this.near(p, tg.x + 0.5, tg.z + 0.5, REACH + 1)) return;
      const x = wrap(tg.x | 0), z = wrap(tg.z | 0);
      const f = this.w.feature(x, z);
      if (!f) return;
      const k = key(x, z);
      const give = (id: ItemId, n: number) => { const left = add(p.inv, id, n); if (left < n) this.events.push({ t: 'got', to: p.slot, id, n: n - left }); if (left) this.toast('Your bag is full!', p); };
      const fy = this.w.tileHeight(x, z);
      if (f.kind === 'tree' || f.kind === 'pine' || f.kind === 'palm' || f.kind === 'snowtree' || f.kind === 'cactus') {
        give('wood', f.kind === 'cactus' ? 2 : 4 + Math.floor(f.v * 3));
        if (f.kind === 'tree' && f.v > 0.7) give('apple', 1);
        this.removeFeature(k);
        this.sfx('treefall', x + 0.5, fy, z + 0.5, 'earth');
        this.fx.push({ k: 'chips', x: x + 0.5, y: fy + 1.5, z: z + 0.5, dim: 'earth', c: '#2f7d31', n: 14 });
      } else if (f.kind === 'rock') {
        give('stone', 5 + Math.floor(f.v * 6));
        if (f.v > 0.8) give('coal', 2);
        if (f.v < 0.12) give('iron_ore', 2);
        this.removeFeature(k);
        this.sfx('rockbreak', x + 0.5, fy, z + 0.5, 'earth');
        this.fx.push({ k: 'chips', x: x + 0.5, y: fy + 0.5, z: z + 0.5, dim: 'earth', c: '#8a8a8a', n: 12 });
      } else if (f.kind === 'ore') {
        give(f.ore!, 1);
        this.takeOre(x, z, f, 1);
        this.sfx('pick', x + 0.5, fy, z + 0.5, 'earth');
      } else if (f.kind === 'bush' || f.kind === 'flower') {
        if (f.kind === 'bush' && f.v > 0.5) give('apple', 1);
        this.removeFeature(k);
        this.sfx('rustle', x + 0.5, fy, z + 0.5, 'earth');
      } else if (f.kind === 'nest') {
        // nests have to be fought, not mined
        return;
      }
      this.dirty(p);
    } else if (tg.k === 'cave') {
      if (p.dim === 'earth' || p.dim === 'space') return;
      const c = this.w.cave(p.dim);
      const x = tg.x | 0, z = tg.z | 0;
      if (x <= 0 || z <= 0 || x >= CAVE_SIZE - 1 || z >= CAVE_SIZE - 1) return;
      const cell = this.w.caveCell(c, x, z);
      if (cell === 0) return;
      if (!this.near(p, x + 0.5, z + 0.5, REACH)) return;
      const id = cell === 6 ? 'wood' : CAVE_ORE[cell];
      add(p.inv, id, cell === 1 ? 3 : cell === 6 ? 3 : cell === 5 ? 1 : 4);
      this.events.push({ t: 'got', to: p.slot, id, n: cell === 1 ? 3 : 4 });
      const k = `${c.id}|${x},${z}`;
      this.w.caveDug.add(k);
      this.events.push({ t: 'cdig', k });
      this.sfx('rockbreak', x + 0.5, 1, z + 0.5, p.dim);
      this.fx.push({ k: 'chips', x: x + 0.5, y: 1, z: z + 0.5, dim: p.dim, c: '#7a7468', n: 12 });
      this.dirty(p);
    } else if (tg.k === 'ground') {
      // dig the ground down (or fill it back up with dirt in your hand)
      if (p.dim !== 'earth') return;
      const x = wrap(tg.x | 0), z = wrap(tg.z | 0);
      if (!this.near(p, x + 0.5, z + 0.5, REACH)) return;
      if (this.w.villageAt(x, z) || this.buildingAt('earth', x, z) || this.w.feature(x, z)) return;
      const b = this.w.baseBiome(x, z);
      const h = this.w.tileHeight(x, z);
      if (h < -6) return;
      for (const [cx, cz] of [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]]) {
        const kk = key(wrap(cx), wrap(cz));
        const v = (this.w.dug.get(kk) ?? 0) - 0.5;
        this.w.dug.set(kk, v);
        this.events.push({ t: 'dig', k: kk, v });
      }
      const got: ItemId = b === 'desert' || b === 'beach' ? 'sand' : b === 'snow' || b === 'pole' ? 'snow' : h < 8 ? 'dirt' : 'stone';
      add(p.inv, got, 1);
      this.events.push({ t: 'got', to: p.slot, id: got, n: 1 });
      this.sfx('dig', x + 0.5, h, z + 0.5, 'earth');
      this.fx.push({ k: 'chips', x: x + 0.5, y: h + 0.2, z: z + 0.5, dim: 'earth', c: got === 'sand' ? '#e0cf8a' : got === 'snow' ? '#ffffff' : '#7a5a3a', n: 10 });
      this.dirty(p);
    }
  }
  removeFeature(k: string) {
    this.w.removed.add(k);
    this.events.push({ t: 'rm', k });
  }
  takeOre(x: number, z: number, f: Feature, n: number) {
    const k = key(x, z);
    const left = (f.amount ?? 0) - n;
    if (left <= 0) { this.w.oreLeft.delete(k); this.removeFeature(k); }
    else { this.w.oreLeft.set(k, left); if (left % 10 === 0) this.events.push({ t: 'ore', k, n: left }); }
  }

  /** Punch (or swing a gun butt). Also hits nests and buildings you don't want. */
  melee(p: Player, tg: Target) {
    if (!tg || p.cool > 0) return;
    p.cool = WEAPONS.fist.cool;
    p.swing = 1;
    if (tg.k === 'mob') {
      const m = this.mobs.get(tg.id);
      if (!m || m.dim !== p.dim || !this.near(p, m.x, m.z, 3.2 + MOBS[m.type].size * 0.5)) return;
      this.hurtMob(m, WEAPONS.fist.dmg * (count(p.inv, 'steel_pickaxe') ? 1.6 : 1), { k: 'p', id: p.slot });
    } else if (tg.k === 'feat') {
      const f = this.w.feature(tg.x, tg.z);
      if (f?.kind === 'nest' && this.near(p, tg.x + 0.5, tg.z + 0.5, 4)) this.hurtNest(p, tg.x, tg.z, WEAPONS.fist.dmg);
    }
  }

  private nestHp = new Map<string, number>();
  hurtNest(p: Player | null, x: number, z: number, dmg: number) {
    const k = key(wrap(x), wrap(z));
    const hp = (this.nestHp.get(k) ?? 200) - dmg;
    const y = this.w.tileHeight(x, z);
    this.fx.push({ k: 'spark', x: x + 0.5, y: y + 1, z: z + 0.5, dim: 'earth', c: '#5ef2c4', n: 6 });
    this.sfx('squish', x + 0.5, y, z + 0.5, 'earth');
    // the nest's bugs come to defend it
    for (const m of this.mobs.values()) if (m.home === k && p) { m.tgt = { k: 'p', id: p.slot }; m.angry = 30; }
    if (hp <= 0) {
      this.nestHp.delete(k);
      this.removeFeature(k);
      this.fx.push({ k: 'puff', x: x + 0.5, y: y + 1, z: z + 0.5, dim: 'earth', c: '#c9a0ff', n: 30 });
      this.sfx('boom', x + 0.5, y, z + 0.5, 'earth');
      if (p) { add(p.inv, 'bug_shell', 4); add(p.inv, 'crystal', 2); p.money += 60; this.toast('Bug spawner destroyed! +4 bug shells, +2 crystals, +$60', p); this.dirty(p); }
    } else this.nestHp.set(k, hp);
  }

  fire(p: Player, ax: number, ay: number, az: number) {
    const held = this.held(p);
    const wid = held ? ITEMS[held.id]?.weapon : undefined;
    if (!wid || p.cool > 0 || p.car) return;
    const W = WEAPONS[wid];
    const ammoId = W.ammo.find((a) => count(p.inv, a) > 0);
    if (!ammoId) { this.toast(`No ${ITEMS[W.ammo[0]].name.toLowerCase()} for the ${ITEMS[held!.id].name.toLowerCase()}! Craft some.`, p); p.cool = 0.6; return; }
    p.cool = W.cool;
    const sy = p.y + 1.3;
    let dx = wd(ax, p.x), dy = ay - sy, dz = wd(az, p.z);
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    p.yaw = Math.atan2(dx, dz);
    if (wid === 'grenade' || wid === 'rocket_launcher') {
      remove(p.inv, ammoId, 1);
      const sp = wid === 'grenade' ? 14 : 30;
      this.shots.push({ id: this.nextId++, dim: p.dim, x: p.x + dx, y: sy, z: p.z + dz, vx: dx * sp, vy: dy * sp + (wid === 'grenade' ? 5 : 0), vz: dz * sp, dmg: W.dmg, splash: W.splash ?? 3, kind: wid === 'grenade' ? 'grenade' : 'rocket', owner: p.slot, life: wid === 'grenade' ? 2.2 : 3 });
      this.sfx(wid === 'grenade' ? 'throw' : 'rocketfire', p.x, sy, p.z, p.dim);
      this.dirty(p);
      return;
    }
    if (wid === 'flamethrower') {
      if (Math.random() < 0.15) remove(p.inv, ammoId, 1);
      this.fx.push({ k: 'flame', x: p.x + dx, y: sy, z: p.z + dz, dim: p.dim, c: `${dx},${dy},${dz}` });
      if (Math.random() < 0.3) this.sfx('flame', p.x, sy, p.z, p.dim);
      for (const m of this.mobs.values()) {
        if (m.dim !== p.dim || m.owner !== undefined || m.type === 'villager' || m.type === 'cop') continue;
        const mx = wd(m.x, p.x), mz = wd(m.z, p.z), d = Math.hypot(mx, mz);
        if (d > W.range || d < 0.1) continue;
        if ((mx * dx + mz * dz) / d > 0.85) this.hurtMob(m, W.dmg, { k: 'p', id: p.slot });
      }
      this.dirty(p);
      return;
    }
    // bullets: hit the first animal along the line
    if (ammoId === 'ammo' || ammoId === 'advanced_ammo') { if (Math.random() < (wid === 'sniper' ? 1 : 0.34)) remove(p.inv, ammoId, 1); }
    const dmg = W.dmg * (AMMO_BONUS[ammoId] ?? 1);
    let best: Mob | null = null, bestT = W.range;
    for (const m of this.mobs.values()) {
      if (m.dim !== p.dim || m.owner !== undefined) continue;
      const def = MOBS[m.type];
      const mx = wd(m.x, p.x), my = m.y + def.size * 0.5 - sy, mz = wd(m.z, p.z);
      const t = mx * dx + my * dy + mz * dz;
      if (t < 0 || t > bestT) continue;
      const cx = mx - dx * t, cy = my - dy * t, cz = mz - dz * t;
      if (cx * cx + cy * cy + cz * cz < (def.size * 0.7 + 0.2) ** 2) { best = m; bestT = t; }
    }
    // in space, bullets hit asteroids
    let rock: Rock | null = null;
    if (p.dim === 'space') for (const r of this.ship.rocks) {
      const mx = r.x - p.x, my = 0.5 - sy, mz = r.z - p.z;
      const t = mx * dx + my * dy + mz * dz;
      if (t < 0 || t > bestT) continue;
      const cx = mx - dx * t, cz = mz - dz * t;
      if (cx * cx + cz * cz < (0.5 + r.size * 0.8) ** 2) { rock = r; bestT = t; best = null; }
    }
    const tx = p.x + dx * bestT, ty = sy + dy * bestT, tz = p.z + dz * bestT;
    this.fx.push({ k: 'tracer', x: p.x + dx * 0.6, y: sy, z: p.z + dz * 0.6, tx, ty, tz, dim: p.dim, c: wid === 'sniper' ? '#ff6' : '#ffd27a' });
    this.sfx(wid === 'sniper' ? 'sniper' : 'gun', p.x, sy, p.z, p.dim);
    if (best) this.hurtMob(best, dmg, { k: 'p', id: p.slot });
    else if (rock) this.hurtRock(rock, dmg);
    else if (p.dim === 'earth') {
      // bullets can hit nests too
      const fxT = Math.floor(tx), fzT = Math.floor(tz);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) if (this.w.feature(fxT + ox, fzT + oz)?.kind === 'nest' && dist2(tx, tz, fxT + ox + 0.5, fzT + oz + 0.5) < 2) this.hurtNest(p, fxT + ox, fzT + oz, dmg);
    }
    this.dirty(p);
  }

  private tickShots(dt: number) {
    for (const s of this.shots) {
      s.life -= dt;
      if (s.kind === 'grenade') s.vy -= 20 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let hit = s.life <= 0 || s.y < this.groundY(s.dim, s.x, s.z);
      if (!hit && s.kind === 'rocket') for (const m of this.mobs.values()) if (m.dim === s.dim && m.owner === undefined && dist2(m.x, m.z, s.x, s.z) < 1.2 && Math.abs(m.y + 0.6 - s.y) < 1.5) hit = true;
      if (!hit && s.dim === 'space') for (const r of this.ship.rocks) if (dist2(r.x, r.z, s.x, s.z) < (0.6 + r.size * 0.8) ** 2) hit = true;
      if (s.kind === 'rocket') this.fx.push({ k: 'smoke', x: s.x, y: s.y, z: s.z, dim: s.dim });
      if (hit) {
        s.life = -99;
        this.explode(s.dim, s.x, s.y, s.z, s.splash, s.dmg, { k: 'p', id: s.owner });
      }
    }
    this.shots = this.shots.filter((s) => s.life > -99);
  }
  private alertT = 0;
  private alertN = 0;
  private alertWhat = '';
  /** A building got destroyed: it blows up, and everyone sees an alert by the hotbar. */
  blowUp(b: Building, by: string) {
    const size = BUILDS[b.type].size;
    const big = b.type === 'rocket_silo' || b.type === 'steam_engine';
    const cx = b.x + size / 2, cz = b.z + size / 2, y = this.groundY(b.dim, cx, cz) + 0.6;
    this.removeBuilding(b);
    const r = (big ? 4 : 1) * Math.max(1.6, size * 0.9);
    this.fx.push({ k: 'chips', x: cx, y, z: cz, dim: b.dim, c: '#6b6f78', n: big ? 40 : 14 });
    this.explode(b.dim, cx, y, cz, r, big ? 40 : 10, { k: 'b', id: -1 });
    if (big) this.sfx('boom', cx, y, cz, b.dim);
    this.alertN++;
    this.alertWhat = `${by} destroyed ${this.alertN > 1 ? `${this.alertN} buildings` : `a ${BUILDS[b.type].name.toLowerCase()}`}`;
    this.alertAt = { x: Math.round(cx), z: Math.round(cz), dim: b.dim };
    this.sendAlert();
  }
  private alertAt = { x: 0, z: 0, dim: 'earth' as Dim };
  private sendAlert() {
    if (!this.alertN) return;
    this.events.push({ t: 'alert', s: `⚠️ ${this.alertWhat}!`, x: this.alertAt.x, z: this.alertAt.z, dim: this.alertAt.dim });
    this.alertN = 0;
  }
  tickAlerts(dt: number) {
    if (this.alertT > 0) { this.alertT -= dt; if (this.alertT <= 0) this.sendAlert(); }
  }
  explode(dim: Dim, x: number, y: number, z: number, r: number, dmg: number, by: { k: 'p' | 'm' | 'b'; id: number }) {
    this.fx.push({ k: 'boom', x, y, z, dim, n: r });
    this.sfx('boom', x, y, z, dim);
    for (const m of this.mobs.values()) {
      if (m.dim !== dim || m.owner !== undefined || m.type === 'villager' || m.type === 'cop') continue;
      const d = Math.sqrt(dist2(m.x, m.z, x, z));
      if (d < r) this.hurtMob(m, dmg * (1 - d / r / 2), by);
    }
    if (dim === 'earth') for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) if (this.w.feature(Math.floor(x) + ox, Math.floor(z) + oz)?.kind === 'nest') this.hurtNest(this.players.get(by.id) ?? null, Math.floor(x) + ox, Math.floor(z) + oz, dmg);
    if (dim === 'space') for (const rk of [...this.ship.rocks]) if (dist2(rk.x, rk.z, x, z) < (r + rk.size) ** 2) this.hurtRock(rk, dmg);
  }

  hurtMob(m: Mob, dmg: number, by: { k: 'p' | 'm' | 'b'; id: number }) {
    const def = MOBS[m.type];
    m.hp -= dmg;
    this.fx.push({ k: 'spark', x: m.x, y: m.y + def.size * 0.6, z: m.z, dim: m.dim, c: '#ffffff', n: 5 });
    // hitting people in town gets the cops on you
    if (by.k === 'p' && (m.type === 'villager' || m.type === 'cop')) {
      const p = this.players.get(by.id);
      if (p) {
        m.hp = Math.max(m.hp, 1);
        const fine = Math.min(p.money, 50);
        p.money -= fine;
        this.toast(`👮 "Hey! No hitting people in town!" You paid a $${fine} fine.`, p);
        this.sfx('whistle', m.x, m.y, m.z, m.dim);
        this.dirty(p);
      }
      return;
    }
    if (def.hostile || m.type === 'bug' || m.type === 'big_bug') { m.tgt = by; m.angry = 20; }
    else m.flee = 6;
    if (by.k === 'p') m.tgt = def.dmg > 0 ? by : null;
    if (m.home && (m.type === 'bug' || m.type === 'big_bug')) {
      // hurting one bug angers its nest-mates too
      for (const o of this.mobs.values()) if (o.home === m.home && o !== m && dist2(o.x, o.z, m.x, m.z) < 400) { o.tgt = by; o.angry = 20; }
    }
    this.sfx('hit', m.x, m.y, m.z, m.dim);
    if (m.hp <= 0) this.killMob(m, by);
  }
  killMob(m: Mob, by: { k: 'p' | 'm' | 'b'; id: number }) {
    const def = MOBS[m.type];
    this.mobs.delete(m.id);
    // no blood: they vanish in a puff
    this.fx.push({ k: 'puff', x: m.x, y: m.y + def.size * 0.5, z: m.z, dim: m.dim, c: '#ffffff', n: 16 });
    this.sfx('poof', m.x, m.y, m.z, m.dim);
    if (m.home && this.nestBugs.has(m.home)) this.nestBugs.set(m.home, Math.max(0, (this.nestBugs.get(m.home) ?? 1) - 1));
    if (m.home && this.villagePeople.has(m.home)) this.villagePeople.set(m.home, Math.max(0, (this.villagePeople.get(m.home) ?? 1) - 1));
    if (m.owner !== undefined) {
      const o = this.players.get(m.owner);
      if (o) this.toast(`Your ${def.name.toLowerCase()} got tired and went back to the pet shop. Buy it again any time.`, o);
      return;
    }
    // whoever is nearest gets the loot (the player who did it, or the owner of the pet or turret)
    let p: Player | undefined = by.k === 'p' ? this.players.get(by.id) : undefined;
    if (!p) { let bd = 30 * 30; for (const q of this.players.values()) if (q.dim === m.dim) { const d = dist2(q.x, q.z, m.x, m.z); if (d < bd) { bd = d; p = q; } } }
    if (!p) return;
    const got: string[] = [];
    for (const [id, a, b] of def.drops) {
      const n = a + Math.floor(Math.random() * (b - a + 1));
      if (n > 0) { add(p.inv, id, n); got.push(`${n} ${ITEMS[id].name.toLowerCase()}`); this.events.push({ t: 'got', to: p.slot, id, n }); }
    }
    if (def.coins) { p.money += def.coins; got.push(`$${def.coins}`); }
    if (got.length && def.hostile) this.toast(`${def.name} beaten: ${got.join(', ')}`, p);
    this.dirty(p);
  }
  hurtPlayer(p: Player, dmg: number, by: string) {
    if (dmg <= 0) return;
    p.hp -= dmg;
    p.hurtT = 0;
    this.sfx('ouch', p.x, p.y, p.z, p.dim);
    this.fx.push({ k: 'spark', x: p.x, y: p.y + 1, z: p.z, dim: p.dim, c: '#ffffff', n: 4 });
    if (p.hp <= 0) {
      p.hp = MAX_HP;
      if (p.car) { const c = this.cars.get(p.car); if (c) c.driver = null; p.car = null; }
      const h = p.home;
      if (h) { p.dim = h.dim; p.x = h.x; p.z = h.z; }
      else { p.dim = 'earth'; p.x = this.w.spawnX + 0.5; p.z = this.w.spawnZ + 0.5; }
      p.y = this.groundY(p.dim, p.x, p.z) + 0.5;
      this.events.push({ t: 'tp', to: p.slot, x: p.x, y: p.y, z: p.z, dim: p.dim });
      this.toast(`You got knocked out by ${by} and woke up ${h ? 'at home' : 'back at the start'}. You kept all your things.`, p);
      this.sfx('knockout', p.x, p.y, p.z, p.dim);
    }
    this.dirty(p);
  }

  // ---------- building ----------
  canPlace(p: Player | null, type: BuildId, x: number, z: number, dim: Dim, ghost = false): string | null {
    const def = BUILDS[type];
    if (def.spaceOnly && dim !== 'space') return 'That only works on a space platform.';
    if (dim === 'space' && !def.space) return 'That doesn’t work in space.';
    if (type === 'space_platform') {
      if (this.ship.tiles.has(key(x, z))) return 'There’s already platform there.';
      const nb = DIRS.some(([dx, dz]) => this.ship.tiles.has(key(x + dx, z + dz)));
      return nb ? null : 'Put platform next to your ship.';
    }
    for (let ox = 0; ox < def.size; ox++) for (let oz = 0; oz < def.size; oz++) {
      const tx = x + ox, tz = z + oz;
      if (this.buildingAt(dim, tx, tz)) return 'Something is in the way.';
      if (dim === 'earth') {
        const f = this.w.feature(tx, tz);
        if (f && f.kind !== 'flower' && f.kind !== 'ore' && f.kind !== 'oil') return 'Clear the trees and rocks first.';
        if (this.w.villageBuildingAt(tx, tz)) return 'A village house is in the way.';
        if (this.w.isWater(tx, tz) && type !== 'water_pump') return 'You can’t build on water.';
        if (this.w.tileSlope(tx, tz) > 1.6 && !def.flat) return 'Too steep here.';
        if (!ghost) for (const q of this.players.values()) if (q.dim === dim && !def.flat && Math.floor(q.x) === wrap(tx) && Math.floor(q.z) === wrap(tz)) return 'Step out of the way first.';
      } else if (dim === 'space') {
        if (!this.ship.tiles.has(key(tx, tz))) return 'Build on the platform.';
      } else {
        if (this.w.caveCell(this.w.cave(dim), tx, tz) !== 0) return 'Dig the wall out first.';
      }
    }
    if (type === 'pumpjack' && this.w.feature(x, z)?.kind !== 'oil') return 'Pumpjacks go on oil (dark puddles).';
    if (type === 'miner' && dim === 'earth' && !this.oreAround(x, z).length) return 'Drills go on ore patches.';
    if (type === 'water_pump') {
      if (dim !== 'earth') return 'Water pumps go next to a lake or the ocean.';
      if (!this.w.isWater(x, z) && !DIRS.some(([dx, dz]) => this.w.isWater(x + dx, z + dz))) return 'Water pumps go at the edge of water.';
    }
    if (type === 'rocket_silo' && dim !== 'earth') return 'Rocket silos go on Earth.';
    return null;
  }
  oreAround(x: number, z: number): [number, number, Feature][] {
    const out: [number, number, Feature][] = [];
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      const f = this.w.feature(x + ox, z + oz);
      if (f?.kind === 'ore') out.push([wrap(x + ox), wrap(z + oz), f]);
    }
    return out;
  }

  place(p: Player, slot: number, x: number, z: number, dir: number) {
    const s = p.inv[slot];
    if (!s) return;
    const it = ITEMS[s.id];
    if (!it?.build) {
      // dirt, sand and snow fill holes back in
      if ((s.id === 'dirt' || s.id === 'sand' || s.id === 'snow' || s.id === 'stone') && p.dim === 'earth' && this.near(p, x + 0.5, z + 0.5)) {
        const tx = wrap(x), tz = wrap(z);
        let deep = false;
        for (const [cx, cz] of [[tx, tz], [tx + 1, tz], [tx, tz + 1], [tx + 1, tz + 1]]) if ((this.w.dug.get(key(wrap(cx), wrap(cz))) ?? 0) < 0) deep = true;
        if (!deep) return;
        for (const [cx, cz] of [[tx, tz], [tx + 1, tz], [tx, tz + 1], [tx + 1, tz + 1]]) {
          const kk = key(wrap(cx), wrap(cz));
          const v = Math.min(0, (this.w.dug.get(kk) ?? 0) + 0.5);
          if (v === 0) this.w.dug.delete(kk); else this.w.dug.set(kk, v);
          this.events.push({ t: 'dig', k: kk, v });
        }
        remove(p.inv, s.id, 1);
        this.sfx('dig', x + 0.5, p.y, z + 0.5, 'earth');
        this.dirty(p);
      }
      return;
    }
    const type = it.build;
    if (!this.near(p, x + 0.5, z + 0.5, REACH + 4)) return;
    if (p.dim === 'earth') { x = wrap(x); z = wrap(z); }
    const why = this.canPlace(p, type, x, z, p.dim);
    if (why) { this.toast(why, p); this.sfx('nope', p.x, p.y, p.z, p.dim); return; }
    remove(p.inv, s.id, 1);
    if (type === 'space_platform') {
      this.ship.tiles.add(key(x, z));
      this.events.push({ t: 'tile', k: key(x, z) });
      this.sfx('place', x + 0.5, 0, z + 0.5, 'space');
      this.dirty(p);
      return;
    }
    const b = this.addBuilding(type, p.dim, x, z, dir, p.slot);
    this.sfx('place', x + 0.5, p.y, z + 0.5, p.dim);
    this.fx.push({ k: 'puff', x: x + BUILDS[type].size / 2, y: this.groundY(p.dim, x + 0.5, z + 0.5) + 0.2, z: z + BUILDS[type].size / 2, dim: p.dim, c: '#d8cbb0', n: 8 });
    if (type === 'house') { p.home = { x: x + 1.5, z: z + 3.6, dim: p.dim }; this.toast('You built a house! You wake up here now, and it has a chest inside.', p); }
    if (type === 'rocket_silo') this.toast('Rocket silo built! Put in 10 space units, then launch.', p);
    void b;
    this.dirty(p);
  }

  addBuilding(type: BuildId, dim: Dim, x: number, z: number, dir: number, owner = 0, id?: number): Building {
    const def = BUILDS[type];
    const b: Building = { id: id ?? this.nextId++, type, dim, x, z, dir, hp: def.hp, owner };
    if (id && id >= this.nextId) this.nextId = id + 1;
    if (def.slots) b.inv = newInv(def.slots);
    if (type === 'furnace' || type === 'steel_furnace' || type === 'electric_furnace' || type === 'miner' || type === 'steam_engine' || type === 'crusher' || type === 'oil_refinery' || type === 'assembler' || type === 'thruster') {
      b.inp = null; b.fuel = null; b.out = null; b.burn = 0; b.prog = 0;
    }
    if (type === 'crusher' || type === 'oil_refinery') b.inv = newInv(4);
    if (type === 'assembler') { b.recipe = null; b.parts = {}; }
    if (isBelt(type)) b.items = [];
    if (isGrabber(type) || type === 'asteroid_grabber') { b.hold = null; b.swing = 0; }
    if (type === 'rocket_silo') { b.units = 0; b.inv = newInv(10); b.launch = 0; b.rider = null; }
    if (type === 'pumpjack') b.oil = 0;
    if (type === 'underground_belt' || type === 'underground_pipe') this.pairUnderground(b);
    this.buildings.set(b.id, b);
    for (let ox = 0; ox < def.size; ox++) for (let oz = 0; oz < def.size; oz++) this.occ.set(this.occKey(dim, x + ox, z + oz), b.id);
    // building over ghosts replaces them
    this.clearGhosts(dim, x, z, def.size);
    if (type === 'roboport') { b.fromChests = true; b.fromBelts = false; }
    this.powerDirty = this.fluidDirty = true;
    this.events.push({ t: 'b+', b });
    return b;
  }
  private pairUnderground(b: Building) {
    // the first one is the way in; the next one ahead (same way, up to 6 / 10 tiles) is the way out
    const reach = b.type === 'underground_belt' ? 6 : 10;
    const [dx, dz] = DIRS[b.dir];
    for (let i = 1; i <= reach; i++) {
      const o = this.buildingAt(b.dim, b.x - dx * i, b.z - dz * i);
      if (o && o.type === b.type && o.dir === b.dir && (o.pair == null) && o.ug !== 'out') {
        o.pair = b.id; o.ug = 'in'; b.pair = o.id; b.ug = 'out';
        this.bchanged(o);
        return;
      }
    }
    b.ug = 'in';
    b.pair = null;
  }
  removeBuilding(b: Building) {
    const def = BUILDS[b.type];
    this.buildings.delete(b.id);
    for (let ox = 0; ox < def.size; ox++) for (let oz = 0; oz < def.size; oz++) this.occ.delete(this.occKey(b.dim, b.x + ox, b.z + oz));
    if (b.pair) { const o = this.buildings.get(b.pair); if (o) { o.pair = null; o.ug = 'in'; this.bchanged(o); } }
    this.powerDirty = this.fluidDirty = true;
    this.events.push({ t: 'b-', id: b.id });
  }
  bchanged(b: Building) { this.events.push({ t: 'b+', b }); }

  pickUp(p: Player, id: number) {
    const b = this.buildings.get(id);
    if (!b || b.hub || b.dim !== p.dim || !this.near(p, b.x + 0.5, b.z + 0.5, REACH + 2)) return;
    if (b.type === 'rocket_silo' && b.launch) return;
    // everything inside comes with it
    const back = (s: Slot | null | undefined) => { if (s) add(p.inv, s.id, s.n); };
    back(b.inp); back(b.fuel); back(b.out); back(b.hold);
    for (const s of b.inv ?? []) back(s);
    for (const it of b.items ?? []) add(p.inv, it.id, 1);
    for (const [id2, n] of Object.entries(b.parts ?? {})) add(p.inv, id2, n);
    if (b.units) add(p.inv, 'space_unit', b.units);
    add(p.inv, b.type, 1);
    this.removeBuilding(b);
    this.sfx('pickup', b.x + 0.5, p.y, b.z + 0.5, p.dim);
    this.dirty(p);
  }

  swap(p: Player, a: number, c: number) {
    if (a < 0 || c < 0 || a >= p.inv.length || c >= p.inv.length) return;
    const A = p.inv[a], C = p.inv[c];
    if (A && C && A.id === C.id) {
      const max = ITEMS[A.id].stack;
      const k = Math.min(A.n, max - C.n);
      C.n += k; A.n -= k;
      if (A.n <= 0) p.inv[a] = null;
    } else { p.inv[a] = C; p.inv[c] = A; }
    this.dirty(p);
  }
  eat(p: Player, slot: number) {
    const s = p.inv[slot];
    const food = s ? ITEMS[s.id]?.food : 0;
    if (!s || !food) return;
    if (p.hp >= MAX_HP) { this.toast('You’re not hungry. (Full health)', p); return; }
    remove(p.inv, s.id, 1);
    p.hp = Math.min(MAX_HP, p.hp + food);
    this.sfx('eat', p.x, p.y, p.z, p.dim);
    this.dirty(p);
  }

  // ---------- putting things in and taking them out of machines ----------
  /** Can this building take one of these? If `doIt`, it does. */
  accept(b: Building, id: ItemId, doIt: boolean): boolean {
    const it = ITEMS[id];
    if (!it) return false;
    const fill = (slot: 'inp' | 'fuel' | 'out', max: number) => {
      const s = b[slot];
      if (s && (s.id !== id || s.n >= max)) return false;
      if (doIt) { if (s) s.n++; else b[slot] = { id, n: 1 }; }
      return true;
    };
    switch (b.type) {
      case 'chest': case 'steel_chest': case 'house': case 'roboport':
        if (!b.inv || room(b.inv, id) < 1) return false;
        if (doIt) add(b.inv, id, 1);
        return true;
      case 'furnace': case 'steel_furnace': case 'electric_furnace': {
        const sm = SMELT[id];
        if (sm && (!sm.steelOnly || b.type !== 'furnace') && !(b.type === 'furnace' && id === 'iron')) return fill('inp', 50);
        if (b.type === 'electric_furnace') return false;
        if (it.fuel) return fill('fuel', 50);
        return false;
      }
      case 'miner': case 'steam_engine':
        return it.fuel ? fill('fuel', 50) : false;
      case 'thruster':
        return id === 'thruster_fuel' ? fill('fuel', 50) : false;
      case 'assembler': {
        const r = b.recipe ? RECIPE[b.recipe] : null;
        const need = r?.inp.find(([i]) => i === id);
        if (!need) return false;
        const have = b.parts![id] ?? 0;
        if (have >= need[1] * 2 + 2) return false;
        if (doIt) b.parts![id] = have + 1;
        return true;
      }
      case 'turret':
        if (id !== 'ammo' && id !== 'advanced_ammo') return false;
        if (!b.inv) return false;
        if (room(b.inv, id) < 1) return false;
        if (doIt) add(b.inv, id, 1);
        return true;
      case 'rocket_silo':
        if (b.launch) return false;
        if (id === 'space_unit') { if ((b.units ?? 0) >= 50) return false; if (doIt) b.units = (b.units ?? 0) + 1; return true; }
        if (b.rider != null) return false;
        if (count(b.inv!, '__') + b.inv!.reduce((a, s) => a + (s?.n ?? 0), 0) >= SILO_CARGO) return false;
        if (room(b.inv!, id) < 1) return false;
        if (doIt) add(b.inv!, id, 1);
        return true;
      case 'crusher':
        return CRUSH[id] ? fill('inp', 50) : false;
      case 'lab':
        if (!/_pack$/.test(id) || !b.inv || room(b.inv, id) < 1) return false;
        if (count(b.inv, id) >= 50) return false;
        if (doIt) add(b.inv, id, 1);
        return true;
      case 'oil_refinery':
        return id === 'ice' ? fill('inp', 50) : false;
      case 'belt': case 'underground_belt': case 'fast_belt': case 'express_belt': {
        if (b.ug === 'out' && b.type === 'underground_belt') return false;
        const items = b.items!;
        if (items.length >= 4) return false;
        if (items.some((x) => x.p < 0.27)) return false;
        if (doIt) items.push({ id, p: 0 });
        return true;
      }
    }
    return false;
  }
  /** Takes one thing a grabber may pick up (what `want` returns true for). */
  takeOne(b: Building, want: (id: ItemId) => boolean): ItemId | null {
    const from = (slot: 'inp' | 'fuel' | 'out') => {
      const s = b[slot];
      if (!s || !want(s.id)) return null;
      s.n--;
      if (s.n <= 0) b[slot] = null;
      return s.id;
    };
    switch (b.type) {
      case 'chest': case 'steel_chest': case 'house': case 'crusher': case 'oil_refinery': case 'lab': {
        if (b.type === 'crusher' || b.type === 'oil_refinery') { const o = from('out'); if (o) return o; }
        for (let i = (b.inv?.length ?? 0) - 1; i >= 0; i--) {
          const s = b.inv![i];
          if (s && want(s.id)) { s.n--; if (s.n <= 0) b.inv![i] = null; return s.id; }
        }
        return null;
      }
      case 'furnace': case 'steel_furnace': case 'electric_furnace': case 'assembler': case 'miner':
        return from('out');
      case 'belt': case 'underground_belt': case 'fast_belt': case 'express_belt': {
        const items = b.items!;
        let best = -1;
        for (let i = 0; i < items.length; i++) if (want(items[i].id) && (best < 0 || items[i].p > items[best].p)) best = i;
        if (best < 0) return null;
        return items.splice(best, 1)[0].id;
      }
    }
    return null;
  }

  bput(p: Player, id: number, slot: number, all: boolean) {
    const b = this.buildings.get(id);
    const s = p.inv[slot];
    if (!b || !s || b.dim !== p.dim || !this.near(p, b.x + 0.5, b.z + 0.5, REACH + 3)) return;
    let n = 0;
    const max = all ? s.n : 1;
    while (n < max && p.inv[slot] && this.accept(b, s.id, true)) {
      n++;
      s.n--;
      if (s.n <= 0) p.inv[slot] = null;
    }
    if (!n) this.toast(`The ${BUILDS[b.type].name.toLowerCase()} doesn’t take ${ITEMS[s.id].name.toLowerCase()}${b.type === 'assembler' && !b.recipe ? ' (pick what it makes first)' : ''}.`, p);
    else this.sfx('drop', b.x + 0.5, p.y, b.z + 0.5, p.dim);
    this.bchanged(b);
    this.dirty(p);
  }
  btake(p: Player, id: number, from: string, i: number) {
    const b = this.buildings.get(id);
    if (!b || b.dim !== p.dim || !this.near(p, b.x + 0.5, b.z + 0.5, REACH + 3)) return;
    const give = (s: Slot | null | undefined): number => {
      if (!s) return 0;
      const left = add(p.inv, s.id, s.n);
      const n = s.n - left;
      s.n = left;
      return n;
    };
    if (from === 'inv' && b.inv) { const s = b.inv[i]; if (s) { give(s); if (s.n <= 0) b.inv[i] = null; } }
    else if (from === 'inp' || from === 'fuel' || from === 'out') { const s = b[from]; if (s) { give(s); if (s.n <= 0) b[from] = null; } }
    else if (from === 'parts' && b.parts) { for (const [k, n] of Object.entries(b.parts)) add(p.inv, k, n); b.parts = {}; }
    else if (from === 'units' && b.units) { add(p.inv, 'space_unit', b.units); b.units = 0; }
    else if (from === 'all') {
      for (const k of ['inp', 'fuel', 'out'] as const) { const s = b[k]; if (s) { give(s); if (s.n <= 0) b[k] = null; } }
      if (b.inv) for (let j = 0; j < b.inv.length; j++) { const s = b.inv[j]; if (s) { give(s); if (s.n <= 0) b.inv[j] = null; } }
    }
    this.sfx('pickup', b.x + 0.5, p.y, b.z + 0.5, p.dim);
    this.bchanged(b);
    this.dirty(p);
  }

  reachBonus() { return this.has('long_reach') ? 3 : 0; }
  roboRange() { return BUILDS.roboport.robo! * (this.has('super_robots') ? 2 : 1); }
  // ---------- ghosts ----------
  ghostAt(dim: Dim, x: number, z: number): Ghost | null {
    const id = this.gocc.get(this.occKey(dim, x, z));
    return id ? this.ghosts.get(id) ?? null : null;
  }
  /** Puts a ghost down; returns why not, or null. */
  placeGhost(p: Player, type: BuildId, x: number, z: number, dir: number, near: boolean): string | null {
    if (type === 'space_platform') return 'Platform can’t be a ghost.';
    if (near && !this.near(p, x + 0.5, z + 0.5, REACH + 4)) return 'Too far away.';
    const dim = p.dim === 'silo' ? 'earth' : p.dim;
    if (dim === 'earth') { x = wrap(x); z = wrap(z); }
    const why = this.canPlace(p, type, x, z, dim, true);
    if (why) return why;
    const size = BUILDS[type].size;
    const same = this.ghostAt(dim, x, z);
    if (same && same.type === type && same.x === x && same.z === z && same.dir === dir) return null;
    this.clearGhosts(dim, x, z, size);
    this.addGhost({ id: this.nextId++, type, dim, x, z, dir, owner: p.slot });
    return null;
  }
  addGhost(gh: Ghost) {
    if (gh.id >= this.nextId) this.nextId = gh.id + 1;
    this.ghosts.set(gh.id, gh);
    const size = BUILDS[gh.type].size;
    for (let ox = 0; ox < size; ox++) for (let oz = 0; oz < size; oz++) this.gocc.set(this.occKey(gh.dim, gh.x + ox, gh.z + oz), gh.id);
    this.events.push({ t: 'g+', g: gh });
  }
  removeGhost(gh: Ghost) {
    if (!this.ghosts.delete(gh.id)) return;
    const size = BUILDS[gh.type].size;
    for (let ox = 0; ox < size; ox++) for (let oz = 0; oz < size; oz++) if (this.gocc.get(this.occKey(gh.dim, gh.x + ox, gh.z + oz)) === gh.id) this.gocc.delete(this.occKey(gh.dim, gh.x + ox, gh.z + oz));
    this.events.push({ t: 'g-', id: gh.id });
  }
  clearGhosts(dim: Dim, x: number, z: number, size: number) {
    for (let ox = 0; ox < size; ox++) for (let oz = 0; oz < size; oz++) { const gh = this.ghostAt(dim, x + ox, z + oz); if (gh) this.removeGhost(gh); }
  }

  // ---------- flying robots ----------
  private botT = 0;
  private stuck = new Map<number, number>(); // ghost id -> time it can be tried again
  private tickRoboport(b: Building, dt: number) {
    b.on = this.bots.some((r) => r.home === b.id);
    void dt;
  }
  private inRange(port: Building, dim: Dim, x: number, z: number) {
    if (port.dim !== dim) return false;
    const r = this.roboRange();
    const dx = dim === 'earth' ? wd(x, port.x + 1) : x - port.x - 1, dz = dim === 'earth' ? wd(z, port.z + 1) : z - port.z - 1;
    return Math.abs(dx) <= r && Math.abs(dz) <= r;
  }
  /** Something in range that has this item: the roboport itself, chests, or (if allowed) belts. */
  private findSource(port: Building, id: ItemId, gx: number, gz: number): Building | null {
    if (port.inv && port.inv.some((s) => s?.id === id)) return port;
    let best: Building | null = null, bd = Infinity;
    for (const o of this.buildings.values()) {
      if (o === port || o.dim !== port.dim) continue;
      let has = false;
      if (isChest(o.type) && port.fromChests !== false) has = !!o.inv?.some((s) => s?.id === id);
      else if (isBelt(o.type) && port.fromBelts) has = !!o.items?.some((i) => i.id === id);
      if (!has || !this.inRange(port, o.dim, o.x, o.z)) continue;
      const d = dist2(o.x, o.z, gx, gz);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  private takeFrom(src: Building, id: ItemId): boolean {
    if (isBelt(src.type)) {
      const i = src.items?.findIndex((x) => x.id === id) ?? -1;
      if (i < 0) return false;
      src.items!.splice(i, 1);
      return true;
    }
    if (!src.inv || !src.inv.some((s) => s?.id === id)) return false;
    remove(src.inv, id, 1);
    this.bchanged(src);
    return true;
  }
  private tickBots(dt: number) {
    // send robots out to ghosts
    this.botT -= dt;
    if (this.botT <= 0 && this.ghosts.size) {
      this.botT = 0.5;
      const busy = new Set(this.bots.map((r) => r.ghost));
      const now = this.time;
      for (const port of this.buildings.values()) {
        if (port.type !== 'roboport' || (port.power ?? 0) <= 0 || !port.inv) continue;
        let sent = 0;
        for (const gh of this.ghosts.values()) {
          if (sent >= 3 || !port.inv.some((s) => s?.id === 'robot')) break;
          if (busy.has(gh.id) || (this.stuck.get(gh.id) ?? 0) > now || !this.inRange(port, gh.dim, gh.x, gh.z)) continue;
          const src = this.findSource(port, gh.type, gh.x, gh.z);
          if (!src) continue;
          remove(port.inv, 'robot', 1);
          const y = this.groundY(port.dim, port.x + 1, port.z + 1) + 2.2;
          this.bots.push({ id: this.nextId++, dim: port.dim, x: port.x + 1, y, z: port.z + 1, home: port.id, ghost: gh.id, src: src.id, carry: null, stage: 'fetch' });
          busy.add(gh.id);
          sent++;
          this.bchanged(port);
          this.sfx('whoosh', port.x + 1, y, port.z + 1, port.dim);
        }
      }
    }
    const SPEED = this.has('faster_robots') ? 14 : 9;
    for (const r of this.bots) {
      let tx: number, tz: number;
      const gh = this.ghosts.get(r.ghost);
      const home = this.buildings.get(r.home);
      if (r.stage === 'fetch') {
        const src = this.buildings.get(r.src);
        if (!src || !gh) { r.stage = 'home'; continue; }
        tx = src.x + 0.5; tz = src.z + 0.5;
      } else if (r.stage === 'build') {
        if (!gh) { r.stage = 'home'; continue; }
        const sz = BUILDS[gh.type].size;
        tx = gh.x + sz / 2; tz = gh.z + sz / 2;
      } else {
        if (!home) { // its roboport is gone: it drops what it had and is lost
          if (r.carry) this.toast(`A robot lost its roboport.`);
          r.stage = 'home'; (r as { dead?: boolean }).dead = true; continue;
        }
        tx = home.x + 1; tz = home.z + 1;
      }
      const dx = r.dim === 'earth' ? wd(tx, r.x) : tx - r.x, dz = r.dim === 'earth' ? wd(tz, r.z) : tz - r.z;
      const d = Math.hypot(dx, dz);
      const want = this.groundY(r.dim, r.x, r.z) + 2.2;
      r.y += (want - r.y) * Math.min(1, dt * 3);
      if (d > 0.3) {
        const st = Math.min(d, SPEED * dt);
        r.x += (dx / d) * st; r.z += (dz / d) * st;
        if (r.dim === 'earth') { r.x = wrap(r.x); r.z = wrap(r.z); }
        continue;
      }
      // arrived
      if (r.stage === 'fetch') {
        const src = this.buildings.get(r.src)!;
        if (this.takeFrom(src, gh!.type)) { r.carry = gh!.type; r.stage = 'build'; this.sfx('grab', r.x, r.y, r.z, r.dim); }
        else {
          const port = home ? this.findSource(home, gh!.type, gh!.x, gh!.z) : null;
          if (port) r.src = port.id; else r.stage = 'home';
        }
      } else if (r.stage === 'build') {
        const g2 = gh!;
        const why = this.canPlace(null, g2.type, g2.x, g2.z, g2.dim);
        if (!why) {
          this.addBuilding(g2.type, g2.dim, g2.x, g2.z, g2.dir, g2.owner);
          const sz = BUILDS[g2.type].size;
          this.fx.push({ k: 'puff', x: g2.x + sz / 2, y: this.groundY(g2.dim, g2.x + 0.5, g2.z + 0.5) + 0.2, z: g2.z + sz / 2, dim: g2.dim, c: '#9fd8ff', n: 10 });
          this.sfx('place', g2.x + 0.5, r.y, g2.z + 0.5, g2.dim);
          r.carry = null;
        } else this.stuck.set(g2.id, this.time + 10); // a tree, an animal or a player in the way: try again later
        r.stage = 'home';
      } else if (home) {
        // back home: the robot and anything it still carries go in the roboport
        if (home.inv) { add(home.inv, 'robot', 1); if (r.carry) add(home.inv, r.carry, 1); }
        r.carry = null;
        (r as { dead?: boolean }).dead = true;
        this.bchanged(home);
      }
    }
    if (this.bots.some((r) => (r as { dead?: boolean }).dead)) this.bots = this.bots.filter((r) => !(r as { dead?: boolean }).dead);
  }

  // ---------- electricity and pipes ----------
  private netOf = new Map<number, number>(); // building -> power network id (a pole id)
  private nets = new Map<number, { supply: number; demand: number; engines: Building[] }>();
  private computePower() {
    this.powerDirty = false;
    this.netOf.clear();
    this.nets.clear();
    const poles = [...this.buildings.values()].filter((b) => BUILDS[b.type].wire);
    const parent = new Map<number, number>();
    const find = (a: number): number => { let r = a; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(a, r); return r; };
    for (const p of poles) parent.set(p.id, p.id);
    for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++) {
      const a = poles[i], b = poles[j];
      if (a.dim !== b.dim) continue;
      const r = Math.min(BUILDS[a.type].wire!, BUILDS[b.type].wire!);
      if (dist2(a.x, a.z, b.x, b.z) <= r * r) parent.set(find(a.id), find(b.id));
    }
    for (const b of this.buildings.values()) {
      const def = BUILDS[b.type];
      const gen = b.type === 'steam_engine' || b.type === 'solar_panel';
      if (!def.power && !gen) continue;
      for (const p of poles) {
        if (p.dim !== b.dim) continue;
        const a = BUILDS[p.type].area!;
        const s = def.size;
        if (wd(b.x + s - 1, p.x) >= -a && wd(b.x, p.x) <= a && wd(b.z + s - 1, p.z) >= -a && wd(b.z, p.z) <= a) {
          const n = find(p.id);
          if (gen) { if (!this.nets.has(n)) this.nets.set(n, { supply: 0, demand: 0, engines: [] }); const e = this.nets.get(n)!.engines; if (!e.includes(b)) e.push(b); }
          else this.netOf.set(b.id, n);
          if (!gen) break;
        }
      }
    }
  }
  private tickPower() {
    // every connected machine counts for sharing power out; only busy ones make engines burn fuel
    const active = new Map<number, number>();
    for (const n of this.nets.values()) { n.supply = 0; n.demand = 0; }
    for (const [bid, n] of this.netOf) {
      const b = this.buildings.get(bid);
      if (!b) continue;
      if (!this.nets.has(n)) this.nets.set(n, { supply: 0, demand: 0, engines: [] });
      this.nets.get(n)!.demand += BUILDS[b.type].power!;
      if (b.on) active.set(n, (active.get(n) ?? 0) + BUILDS[b.type].power!);
    }
    const sun = Math.max(0, (this.light - 0.15) / 0.85);
    for (const n of this.nets.values()) for (const e of n.engines) {
      if (e.type === 'solar_panel') { n.supply += SOLAR_POWER * sun; e.on = sun > 0.05; }
      else if (e.water && ((e.burn ?? 0) > 0 || e.fuel)) n.supply += ENGINE_POWER;
    }
    for (const b of this.buildings.values()) {
      if (!BUILDS[b.type].power) continue;
      if (b.dim === 'space') { b.power = 1; continue; }
      const n = this.netOf.get(b.id);
      const net = n !== undefined ? this.nets.get(n) : undefined;
      b.power = net && net.demand > 0 ? Math.min(1, net.supply / net.demand) : 0;
    }
    for (const [id, n] of this.nets) {
      const use = active.get(id) ?? 0;
      const share = Math.min(1, use / Math.max(1, n.supply));
      for (const e of n.engines) {
        if (e.type === 'solar_panel') continue;
        if (!e.water) { e.on = false; continue; }
        if (use > 0 && (e.burn ?? 0) <= 0 && e.fuel) { e.burn = ITEMS[e.fuel.id].fuel! * 2; e.fuel.n--; if (e.fuel.n <= 0) e.fuel = null; }
        if (use > 0 && (e.burn ?? 0) > 0) { e.burn! -= TICK * share; e.on = true; } else e.on = false;
      }
    }
  }
  private computeFluids() {
    this.fluidDirty = false;
    const fl = [...this.buildings.values()].filter((b) => isFluid(b.type));
    const parent = new Map<number, number>();
    const find = (a: number): number => { let r = a; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(a, r); return r; };
    for (const b of fl) parent.set(b.id, b.id);
    for (const b of fl) {
      const s = BUILDS[b.type].size;
      for (let ox = -1; ox <= s; ox++) for (let oz = -1; oz <= s; oz++) {
        if ((ox === -1 || ox === s) === (oz === -1 || oz === s)) continue; // edges only, no corners
        const o = this.buildingAt(b.dim, b.x + ox, b.z + oz);
        if (o && o !== b && isFluid(o.type)) parent.set(find(b.id), find(o.id));
      }
      if (b.type === 'underground_pipe' && b.pair) { const o = this.buildings.get(b.pair); if (o) parent.set(find(b.id), find(o.id)); }
    }
    const water = new Set<number>();
    for (const b of fl) if (b.type === 'water_pump') water.add(find(b.id));
    this.fluidNet = new Map();
    for (const b of fl) {
      const r = find(b.id);
      this.fluidNet.set(b.id, r);
      if (b.type === 'steam_engine') b.water = water.has(r);
    }
  }
  private fluidNet = new Map<number, number>();

  // ---------- machines ----------
  private tickBuilding(b: Building, dt: number) {
    switch (b.type) {
      case 'belt': case 'underground_belt': case 'fast_belt': case 'express_belt': return this.tickBelt(b, dt);
      case 'grabber': case 'long_grabber': case 'bulk_grabber': case 'fast_grabber': return this.tickGrabber(b, dt);
      case 'asteroid_grabber': return this.tickRockGrabber(b, dt);
      case 'miner': return this.tickMiner(b, dt);
      case 'furnace': case 'steel_furnace': case 'electric_furnace': return this.tickFurnace(b, dt);
      case 'lab': return this.tickLab(b, dt);
      case 'laser_turret': return this.tickTurret(b, dt);
      case 'assembler': return this.tickAssembler(b, dt);
      case 'pumpjack': if ((b.power ?? 0) > 0 && (b.oil ?? 0) < 200) { b.oil = (b.oil ?? 0) + dt * 2 * b.power!; b.on = true; } else b.on = false; return;
      case 'oil_refinery': return this.tickRefinery(b, dt);
      case 'crusher': return this.tickCrusher(b, dt);
      case 'turret': return this.tickTurret(b, dt);
      case 'rocket_silo': return this.tickSilo(b, dt);
      case 'roboport': return this.tickRoboport(b, dt);
      case 'campfire':
        for (const p of this.players.values()) if (p.dim === b.dim && p.hp < MAX_HP && dist2(p.x, p.z, b.x + 0.5, b.z + 0.5) < 9) { p.hp = Math.min(MAX_HP, p.hp + dt * 4); this.dirty(p); }
        return;
    }
  }
  private outputTo(b: Building, id: ItemId, dist = 1): boolean {
    const [tx, tz] = this.ahead(b, dist);
    const t = this.buildingAt(b.dim, tx, tz);
    return !!t && t !== b && this.accept(t, id, true);
  }
  private tickBelt(b: Building, dt: number) {
    const items = b.items!;
    if (!items.length) return;
    items.sort((a, c) => c.p - a.p);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const limit = i === 0 ? 1 : items[i - 1].p - 0.26;
      it.p = Math.min(limit, it.p + BELT_SPEED * (b.type === 'express_belt' ? 3 : b.type === 'fast_belt' ? 2 : 1) * dt);
    }
    const first = items[0];
    if (first.p >= 1) {
      let ok = false;
      if (b.type === 'underground_belt' && b.ug === 'in' && b.pair) {
        const o = this.buildings.get(b.pair);
        if (o && o.items!.length < 4 && !o.items!.some((x) => x.p < 0.27)) { o.items!.push({ id: first.id, p: 0 }); ok = true; }
      } else {
        const [tx, tz] = this.ahead(b);
        const t = this.buildingAt(b.dim, tx, tz);
        if (t && isBelt(t.type)) {
          if (t.dir !== ((b.dir + 2) & 3)) ok = this.accept(t, first.id, true);
        } else if (t && !isGrabber(t.type)) ok = this.accept(t, first.id, true);
      }
      if (ok) items.shift();
    }
  }
  private tickGrabber(b: Building, dt: number) {
    const pw = b.power ?? 0;
    b.on = pw > 0;
    if (pw <= 0) return;
    const reach = b.type === 'long_grabber' ? 2 : 1;
    const bulk = b.type === 'bulk_grabber' ? 5 : 1;
    const speed = (b.type === 'bulk_grabber' ? 0.9 : b.type === 'fast_grabber' ? 2.8 : 1.3) * pw;
    const [fx, fz] = [b.x - DIRS[b.dir][0] * reach, b.z - DIRS[b.dir][1] * reach];
    const [tx, tz] = this.ahead(b, reach);
    const src = this.buildingAt(b.dim, fx, fz), dst = this.buildingAt(b.dim, tx, tz);
    if (b.hold) {
      b.swing = Math.min(1, (b.swing ?? 0) + dt * speed);
      if (b.swing >= 1 && dst) {
        while (b.hold && dst.type !== b.type && this.accept(dst, b.hold.id, true)) {
          b.hold.n--;
          if (b.hold.n <= 0) b.hold = null;
        }
        if (!b.hold) this.bchangedLite(b);
      }
    } else {
      b.swing = Math.max(0, (b.swing ?? 0) - dt * speed);
      if (b.swing <= 0 && src && dst && !isGrabber(src.type)) {
        let got: ItemId | null = null;
        let n = 0;
        while (n < bulk) {
          const id = this.takeOne(src, (i) => (got === null || i === got) && this.accept(dst, i, false));
          if (!id) break;
          got = id; n++;
        }
        if (got) { b.hold = { id: got, n }; this.bchangedLite(b); }
      }
    }
  }
  private bchangedLite(_b: Building) { /* moving parts go out in snapshots */ }
  private tickMiner(b: Building, dt: number) {
    const pw = b.power ?? 0;
    let speed = pw;
    if (speed <= 0) {
      if ((b.burn ?? 0) <= 0 && b.fuel) { b.burn = ITEMS[b.fuel.id].fuel!; b.fuel.n--; if (b.fuel.n <= 0) b.fuel = null; }
      if ((b.burn ?? 0) > 0) speed = 0.7;
    }
    if (b.out && b.out.n > 0 && this.outputTo(b, b.out.id)) { b.out.n--; if (b.out.n <= 0) b.out = null; }
    if (speed <= 0 || (b.out && b.out.n >= 20)) { b.on = false; return; }
    if (b.dim !== 'earth') { b.on = false; return; }
    const ores = this.oreAround(b.x, b.z);
    if (!ores.length) { b.on = false; return; }
    b.on = true;
    if (pw <= 0) b.burn! -= dt;
    b.prog = (b.prog ?? 0) + dt * speed * 0.5;
    if (b.prog >= 1) {
      b.prog = 0;
      const [x, z, f] = ores[Math.floor(Math.random() * ores.length)];
      this.takeOre(x, z, f, 1);
      if (b.out) b.out.n++; else b.out = { id: f.ore!, n: 1 };
      if (Math.random() < 0.15) this.sfx('drill', b.x + 0.5, this.groundY(b.dim, b.x, b.z), b.z + 0.5, b.dim);
    }
  }
  private tickFurnace(b: Building, dt: number) {
    if (b.out && b.out.n > 0 && this.outputTo(b, b.out.id)) { b.out.n--; if (b.out.n <= 0) b.out = null; }
    const sm = b.inp ? SMELT[b.inp.id] : null;
    const need = b.inp?.id === 'iron' ? 2 : 1;
    if (!sm || !b.inp || b.inp.n < need || (b.out && (b.out.id !== sm.out || b.out.n >= 100))) { b.on = false; return; }
    let speed = b.type === 'steel_furnace' ? 2 : 1;
    if (b.type === 'electric_furnace') {
      // runs on electricity, no fuel
      if ((b.power ?? 0) <= 0) { b.on = false; return; }
      speed = 2 * b.power!;
    } else {
      if ((b.burn ?? 0) <= 0) {
        if (!b.fuel) { b.on = false; return; }
        b.burn = ITEMS[b.fuel.id].fuel!;
        b.fuel.n--;
        if (b.fuel.n <= 0) b.fuel = null;
      }
      b.burn! -= dt;
    }
    b.on = true;
    b.prog = (b.prog ?? 0) + (dt * speed) / sm.time;
    if (b.prog >= 1) {
      b.prog = 0;
      b.inp.n -= need;
      if (b.inp.n <= 0) b.inp = null;
      if (b.out) b.out.n += sm.n; else b.out = { id: sm.out, n: sm.n };
    }
  }
  private tickAssembler(b: Building, dt: number) {
    if (b.out && b.out.n > 0 && this.outputTo(b, b.out.id)) { b.out.n--; if (b.out.n <= 0) b.out = null; }
    const r = b.recipe ? RECIPE[b.recipe] : null;
    const pw = b.power ?? 0;
    if (!r || pw <= 0 || (b.out && (b.out.id !== r.out || b.out.n >= 50))) { b.on = false; return; }
    if (!r.inp.every(([id, n]) => (b.parts![id] ?? 0) >= n)) { b.on = false; return; }
    b.on = true;
    b.prog = (b.prog ?? 0) + (dt * pw) / Math.max(0.5, r.time);
    if (b.prog >= 1) {
      b.prog = 0;
      for (const [id, n] of r.inp) b.parts![id] -= n;
      if (b.out) b.out.n += r.n; else b.out = { id: r.out, n: r.n };
    }
  }
  private tickRefinery(b: Building, dt: number) {
    if (b.out && b.out.n > 0 && this.outputTo(b, b.out.id, 2)) { b.out.n--; if (b.out.n <= 0) b.out = null; }
    const pw = b.power ?? 0;
    if (pw <= 0) { b.on = false; return; }
    // ice to water: "if you put ice in an oil refinery you get 96 water"
    if (b.inp && b.inp.id === 'ice') {
      b.prog = (b.prog ?? 0) + dt * pw;
      b.on = true;
      if (b.prog >= 1) {
        b.prog = 0;
        b.inp.n--;
        if (b.inp.n <= 0) b.inp = null;
        add(b.inv!, 'water', 96);
      }
      return;
    }
    // crude oil from pumpjacks in the same pipe network
    const net = this.fluidNet.get(b.id);
    if (net === undefined) { b.on = false; return; }
    let jack: Building | null = null;
    for (const o of this.buildings.values()) if (o.type === 'pumpjack' && this.fluidNet.get(o.id) === net && (o.oil ?? 0) >= 1) { jack = o; break; }
    if (!jack) { b.on = false; return; }
    b.on = true;
    b.prog = (b.prog ?? 0) + (dt * pw) / 3;
    if (b.prog >= 1) {
      b.prog = 0;
      jack.oil! -= 5;
      if (jack.oil! < 0) jack.oil = 0;
      add(b.inv!, 'fuel', 1);
      add(b.inv!, 'plastic', 1);
    }
  }
  private tickCrusher(b: Building, dt: number) {
    if (b.inv) for (const s of b.inv) if (s && this.outputTo(b, s.id)) { s.n--; break; }
    if (b.inv) for (let i = 0; i < b.inv.length; i++) if (b.inv[i] && b.inv[i]!.n <= 0) b.inv[i] = null;
    if (!b.inp) { b.on = false; return; }
    b.on = true;
    b.prog = (b.prog ?? 0) + dt / 1.5;
    if (b.prog >= 1) {
      b.prog = 0;
      const res = CRUSH[b.inp.id] ?? [];
      b.inp.n--;
      if (b.inp.n <= 0) b.inp = null;
      for (const [id, chance] of res) if (Math.random() < chance) add(b.inv!, id, 1);
      if (Math.random() < 0.3) this.sfx('crush', b.x + 0.5, 0, b.z + 0.5, b.dim);
    }
  }
  // ---------- research ----------
  research = { done: new Set<string>(), cur: null as string | null, units: 0 };
  has(tech: string) { return this.research.done.has(tech); }
  canResearch(id: string) { const t = TECH[id]; return !!t && !this.has(id) && t.needs.every((n) => this.has(n)); }
  locked(recipe: string) { const t = RECIPE[recipe]?.tech; return !!t && !this.has(t); }
  private resEvent() { this.events.push({ t: 'res', done: [...this.research.done], cur: this.research.cur, units: this.research.units }); }
  private tickLab(b: Building, dt: number) {
    const cur = this.research.cur ? TECH[this.research.cur] : null;
    if (!cur || (b.power ?? 0) <= 0 || !b.inv) { b.on = false; return; }
    if ((b.prog ?? 0) <= 0) {
      // one of each pack for every unit of research
      if (!cur.packs.every((id) => count(b.inv!, id) > 0)) { b.on = false; return; }
      for (const id of cur.packs) remove(b.inv, id, 1);
      b.prog = 0.0001;
    }
    b.on = true;
    b.prog = (b.prog ?? 0) + (dt * b.power!) / cur.time;
    if (b.prog >= 1) {
      b.prog = 0;
      if (this.research.cur !== cur.id) return;
      this.research.units++;
      if (this.research.units >= cur.units) {
        this.research.done.add(cur.id);
        this.research.cur = null;
        this.research.units = 0;
        for (const p of this.players.values()) this.toast(`🔬 Research done: ${cur.name}! ${cur.what}`, p);
        this.sfx('arrive', b.x + 1, this.groundY(b.dim, b.x + 1, b.z + 1) + 1, b.z + 1, b.dim);
      }
      this.resEvent();
    }
  }
  private tickTurret(b: Building, dt: number) {
    b.prog = Math.max(0, (b.prog ?? 0) - dt);
    const laser = b.type === 'laser_turret';
    const ammo = laser ? null : b.inv?.[0];
    if (laser ? (b.power ?? 0) <= 0 : !ammo) { b.on = false; return; }
    const R = 20;
    let tx = 0, tz = 0, ty = 0;
    let target: Mob | Rock | null = null;
    if (b.dim === 'space') {
      // turrets in space shoot medium, big and huge asteroids
      let bd = R * R;
      for (const r of this.ship.rocks) if (r.size > 0) { const d = dist2(r.x, r.z, b.x + 0.5, b.z + 0.5); if (d < bd) { bd = d; target = r; tx = r.x; tz = r.z; ty = 0.5; } }
    } else {
      let bd = R * R;
      for (const m of this.mobs.values()) {
        if (m.dim !== b.dim || !MOBS[m.type].hostile || m.owner !== undefined || m.type === 'cop') continue;
        const d = dist2(m.x, m.z, b.x + 0.5, b.z + 0.5);
        if (d < bd) { bd = d; target = m; tx = m.x; tz = m.z; ty = m.y + 0.6; }
      }
    }
    b.on = !!target;
    if (!target) return;
    b.aim = Math.atan2(wd(tx, b.x + 0.5), wd(tz, b.z + 0.5));
    if (b.prog! > 0) return;
    b.prog = laser ? 0.4 / b.power! : 0.25;
    const dmg = laser ? 16 : 9 * (AMMO_BONUS[ammo!.id] ?? 1);
    if (ammo && Math.random() < 0.25) { ammo.n--; if (ammo.n <= 0) b.inv![0] = null; }
    const by = this.groundY(b.dim, b.x + 0.5, b.z + 0.5) + 1.3;
    this.fx.push({ k: 'tracer', x: b.x + 0.5, y: by, z: b.z + 0.5, tx, ty, tz, dim: b.dim, c: laser ? '#ff3060' : '#ffe066' });
    this.sfx('turret', b.x + 0.5, by, b.z + 0.5, b.dim);
    if ('kind' in target) this.hurtRock(target, dmg);
    else this.hurtMob(target, dmg, { k: 'b', id: b.id });
  }

  // ---------- rocket silo and space ----------
  private tickSilo(b: Building, dt: number) {
    if (!b.launch) return;
    b.launch -= dt;
    if (b.launch <= 0) {
      b.launch = 0;
      this.fx.push({ k: 'launch', x: b.x + 1.5, z: b.z + 1.5, dim: b.dim });
      this.sfx('liftoff', b.x + 1.5, this.groundY(b.dim, b.x, b.z), b.z + 1.5, b.dim);
      this.makeShip();
      const hub = [...this.buildings.values()].find((x) => x.hub);
      if (hub && b.inv) { for (const s of b.inv) if (s) add(hub.inv!, s.id, s.n); b.inv = newInv(10); this.bchanged(hub); }
      if (b.rider != null) {
        const p = this.players.get(b.rider);
        b.rider = null;
        if (p) {
          p.dim = 'space'; p.x = 0.5; p.z = 2.5; p.y = 0;
          this.events.push({ t: 'tp', to: p.slot, x: p.x, y: 0, z: p.z, dim: 'space' });
          this.toast('🚀 You made it to space! Build platform to make the ship bigger, add thrusters and asteroid grabbers. The hub chest has what you sent up.', p);
          this.dirty(p);
        }
      }
      this.bchanged(b);
    }
  }
  launch(p: Player, id: number, ride: boolean) {
    const b = this.buildings.get(id);
    if (!b || b.type !== 'rocket_silo' || b.launch) return;
    if ((b.units ?? 0) < SPACE_UNITS_TO_LAUNCH) { this.toast(`A launch takes ${SPACE_UNITS_TO_LAUNCH} space units. This silo has ${b.units ?? 0}.`, p); return; }
    if (ride) {
      const cargo = b.inv!.reduce((a, s) => a + (s?.n ?? 0), 0);
      if (cargo > 0) { this.toast('The silo holds 100 things OR 1 you. Take the cargo out to ride.', p); return; }
      if (!count(p.inv, 'space_starter')) { this.toast('To go to space you need a space starter.', p); return; }
      remove(p.inv, 'space_starter', 1);
      b.rider = p.slot;
      p.dim = 'silo';
      p.x = b.x + 1.5; p.z = b.z + 1.5;
      this.events.push({ t: 'tp', to: p.slot, x: p.x, y: p.y, z: p.z, dim: 'silo' });
    } else if (!this.ship.made) { this.toast('Ride the first rocket yourself (with a space starter) to make your space ship.', p); return; }
    b.units! -= SPACE_UNITS_TO_LAUNCH;
    b.launch = 5;
    this.sfx('countdown', b.x + 1.5, p.y, b.z + 1.5, b.dim);
    this.toast('Launching in 5…', p);
    this.bchanged(b);
    this.dirty(p);
  }
  makeShip() {
    if (this.ship.made) return;
    this.ship.made = true;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 3; z++) { this.ship.tiles.add(key(x, z)); this.events.push({ t: 'tile', k: key(x, z) }); }
    const hub = this.addBuilding('chest', 'space', 0, 0, 0, 0);
    hub.hub = true;
    hub.inv = newInv(48);
    this.bchanged(hub);
  }
  travel(dest: number) {
    if (dest < 0 || dest >= DESTINATIONS.length || dest === this.ship.at) return;
    const thr = [...this.buildings.values()].filter((b) => b.type === 'thruster' && b.dim === 'space' && (b.fuel || (b.burn ?? 0) > 0));
    if (!thr.length) { this.toast('Your ship needs thrusters with thruster fuel to move.'); for (const p of this.players.values()) if (p.dim === 'space' && p !== this.me) this.toast('The ship needs thrusters with thruster fuel to move.', p); return; }
    this.ship.dest = dest;
    this.ship.km = 0;
    this.ship.moving = true;
    this.sfx('engine', 0, 0, 0, 'space');
  }
  goDown(p: Player) {
    if (p.dim !== 'space') return;
    if (this.ship.at !== 0 || this.ship.moving) { this.toast('Fly back to Earth orbit first.', p); return; }
    const silo = [...this.buildings.values()].find((b) => b.type === 'rocket_silo');
    p.dim = 'earth';
    p.x = silo ? silo.x + 4.5 : this.w.spawnX + 0.5;
    p.z = silo ? silo.z + 1.5 : this.w.spawnZ + 0.5;
    p.y = this.groundY('earth', p.x, p.z) + 6;
    this.events.push({ t: 'tp', to: p.slot, x: p.x, y: p.y, z: p.z, dim: 'earth' });
    this.toast('🪂 Back down to Earth!', p);
    this.sfx('whoosh', p.x, p.y, p.z, 'earth');
    this.dirty(p);
  }
  shipSpeed() {
    const thr = [...this.buildings.values()].filter((b) => b.type === 'thruster' && b.dim === 'space' && (b.fuel || (b.burn ?? 0) > 0));
    return Math.min(8, thr.length) * THRUSTER_SPEED;
  }
  private tickShip(dt: number) {
    const s = this.ship;
    if (!s.made) return;
    let anyone = false;
    for (const p of this.players.values()) if (p.dim === 'space') anyone = true;
    if (s.moving) {
      const thr = [...this.buildings.values()].filter((b) => b.type === 'thruster' && b.dim === 'space');
      let firing = 0;
      for (const t of thr) {
        if ((t.burn ?? 0) <= 0 && t.fuel) { t.burn = FUEL_KM / THRUSTER_SPEED; t.fuel.n--; if (t.fuel.n <= 0) t.fuel = null; }
        if ((t.burn ?? 0) > 0) { t.burn! -= dt; t.on = true; firing++; } else t.on = false;
      }
      const speed = Math.min(8, firing) * THRUSTER_SPEED;
      if (!speed) { s.moving = false; this.toast('Out of thruster fuel! The ship stopped. Make thruster fuel: 1 crystal + 100 water.'); }
      s.km += speed * dt;
      const total = Math.abs(DESTINATIONS[s.dest].dist - DESTINATIONS[s.at].dist);
      if (s.km >= total) {
        s.moving = false;
        s.at = s.dest;
        s.km = 0;
        for (const t of thr) t.on = false;
        const msg = `🪐 Arrived at ${DESTINATIONS[s.at].name}!`;
        for (const p of this.players.values()) if (p.dim === 'space') this.toast(msg, p);
        this.sfx('arrive', 0, 0, 0, 'space');
      }
    } else for (const b of this.buildings.values()) if (b.type === 'thruster') b.on = false;
    if (!anyone && s.rocks.length > 40) s.rocks.length = 40;
    // asteroids fly past; "you only see medium asteroids if your ship is moving"
    const mix = DESTINATIONS[s.moving ? s.dest : s.at].mix;
    const rate = s.moving ? 2.2 : 0.6;
    if (Math.random() < rate * dt && s.rocks.length < 70) {
      const r = Math.random();
      const kind: RockKind = r < mix[0] ? 'rusty' : r < mix[0] + mix[1] ? 'carbon' : 'cryser';
      let size: RockSize = 0;
      if (s.moving) { const q = Math.random(); size = q < 0.55 ? 0 : q < 0.85 ? 1 : q < 0.97 ? 2 : 3; }
      const w = this.shipBounds();
      s.rocks.push({ id: this.nextId++, kind, size, x: w.x0 - 6 + Math.random() * (w.x1 - w.x0 + 12), z: w.z0 - 40, vx: (Math.random() - 0.5) * 0.6, vz: (s.moving ? 4 : 1.2) + Math.random() * 1.5, hp: ROCK_HP[size], rot: Math.random() * 6 });
    }
    const w = this.shipBounds();
    for (const r of s.rocks) {
      if (r.grabbed) continue;
      r.x += r.vx * dt;
      r.z += r.vz * dt;
      r.rot += dt * (0.4 + r.size * 0.1);
      // bigger rocks crash into the ship
      if (r.size > 0 && s.tiles.has(key(Math.floor(r.x), Math.floor(r.z)))) {
        const b = this.buildingAt('space', r.x, r.z);
        if (b && !b.hub) {
          b.hp -= 40 * r.size;
          if (b.hp <= 0) { this.removeBuilding(b); this.fx.push({ k: 'boom', x: r.x, y: 0.5, z: r.z, dim: 'space', n: 2 }); }
        }
        for (const p of this.players.values()) if (p.dim === 'space' && dist2(p.x, p.z, r.x, r.z) < 4) this.hurtPlayer(p, 10 * r.size, 'an asteroid');
        this.fx.push({ k: 'boom', x: r.x, y: 0.5, z: r.z, dim: 'space', n: 1 + r.size });
        this.sfx('boom', r.x, 0.5, r.z, 'space');
        r.hp = -1;
      }
    }
    s.rocks = s.rocks.filter((r) => r.hp > 0 && r.z < w.z1 + 30);
  }
  shipBounds() {
    let x0 = 0, x1 = 0, z0 = 0, z1 = 0;
    for (const k of this.ship.tiles) { const [x, z] = k.split(',').map(Number); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { x0, x1, z0, z1 };
  }
  hurtRock(r: Rock, dmg: number) {
    r.hp -= dmg;
    this.fx.push({ k: 'chips', x: r.x, y: 0.5, z: r.z, dim: 'space', c: '#9a8a7a', n: 4 });
    if (r.hp > 0) return;
    // "medium asteroids double and go to the size lower"
    this.ship.rocks = this.ship.rocks.filter((x) => x !== r);
    this.sfx('rockbreak', r.x, 0.5, r.z, 'space');
    if (r.size > 0) for (let i = 0; i < 2; i++) {
      const size = (r.size - 1) as RockSize;
      this.ship.rocks.push({ id: this.nextId++, kind: r.kind, size, x: r.x + (i ? 0.8 : -0.8), z: r.z, vx: (i ? 1 : -1) * (0.8 + Math.random()), vz: r.vz * 0.8, hp: ROCK_HP[size], rot: 0 });
    }
  }
  private tickRockGrabber(b: Building, dt: number) {
    b.on = true;
    if (b.hold) {
      b.swing = Math.min(1, (b.swing ?? 0) + dt * 1.2);
      if (b.swing >= 1) {
        const [tx, tz] = this.ahead(b);
        const t = this.buildingAt(b.dim, tx, tz);
        if (t && this.accept(t, b.hold.id, true)) { b.hold.n--; if (b.hold.n <= 0) b.hold = null; }
      }
      return;
    }
    b.swing = Math.max(0, (b.swing ?? 0) - dt * 1.2);
    if (b.swing > 0) return;
    // grab a little asteroid within reach
    for (const r of this.ship.rocks) {
      if (r.size !== 0) continue;
      if (dist2(r.x, r.z, b.x + 0.5, b.z + 0.5) < 36) {
        this.ship.rocks = this.ship.rocks.filter((x) => x !== r);
        b.hold = { id: ROCK_ITEM[r.kind], n: 1 };
        b.aim = Math.atan2(r.x - b.x - 0.5, r.z - b.z - 0.5);
        this.sfx('grab', b.x + 0.5, 0.5, b.z + 0.5, 'space');
        return;
      }
    }
  }

  // ---------- caves, cars, shops ----------
  enter(p: Player, tg: Target) {
    if (!tg) return;
    if (tg.k === 'feat' && p.dim === 'earth') {
      const f = this.w.feature(tg.x, tg.z);
      if (!f || (f.kind !== 'cave' && f.kind !== 'shaft') || !this.near(p, tg.x + 0.5, tg.z + 0.5, 4)) return;
      if (p.car) this.toggleCar(p);
      const id = `${f.kind === 'cave' ? 'c' : 'm'}:${wrap(tg.x)}:${wrap(tg.z)}`;
      const c = this.w.cave(id);
      p.dim = id;
      p.x = c.exit[0]; p.z = c.exit[1] - 1; p.y = 0;
      this.events.push({ t: 'tp', to: p.slot, x: p.x, y: 0, z: p.z, dim: id });
      this.toast(f.kind === 'cave' ? '🦇 You climbed into a cave. Dig the walls for ore and crystals. Walk back to the light to leave.' : '⛏️ You went down a mine shaft. Lots of ore down here! The ladder takes you back up.', p);
      this.sfx('cave', p.x, 0, p.z, id);
      this.spawnCave(id);
      this.dirty(p);
    }
  }
  leaveCave(p: Player) {
    if (p.dim === 'earth' || p.dim === 'space' || p.dim === 'silo') return;
    const c = this.w.cave(p.dim);
    if (dist2(p.x, p.z, c.exit[0], c.exit[1]) > 9) return;
    p.dim = 'earth';
    p.x = c.ex + 0.5; p.z = c.ez + 1.8;
    p.y = this.groundY('earth', p.x, p.z) + 0.3;
    this.events.push({ t: 'tp', to: p.slot, x: p.x, y: p.y, z: p.z, dim: 'earth' });
    this.sfx('whoosh', p.x, p.y, p.z, 'earth');
    this.dirty(p);
  }
  toggleCar(p: Player) {
    if (p.car) {
      const c = this.cars.get(p.car);
      p.car = null;
      if (c) {
        c.driver = null;
        // step out to the side
        const sx = c.x + Math.cos(c.yaw) * 1.6, sz = c.z - Math.sin(c.yaw) * 1.6;
        if (this.free(p.dim, sx, sz, p.y + 1)) { p.x = sx; p.z = sz; }
        this.events.push({ t: 'tp', to: p.slot, x: p.x, y: p.y, z: p.z, dim: p.dim });
      }
      this.sfx('door', p.x, p.y, p.z, p.dim);
      this.dirty(p);
      return;
    }
    if (p.dim !== 'earth') return;
    for (const c of this.cars.values()) {
      if (c.driver !== null || dist2(c.x, c.z, p.x, p.z) > 9) continue;
      if (c.owner !== p.slot) { this.toast('That’s not your car.', p); return; }
      c.driver = p.slot;
      p.car = c.id;
      p.x = c.x; p.z = c.z; p.yaw = c.yaw;
      this.events.push({ t: 'tp', to: p.slot, x: p.x, y: p.y, z: p.z, dim: p.dim, yaw: p.yaw });
      this.sfx('carstart', p.x, p.y, p.z, p.dim);
      this.dirty(p);
      return;
    }
  }

  buy(p: Player, shop: string, id: string, n: number, vb: string) {
    const pay = (price: number) => {
      if (p.money < price) { this.toast(`You need $${price - p.money} more.`, p); this.sfx('nope', p.x, p.y, p.z, p.dim); return false; }
      p.money -= price;
      this.sfx('cash', p.x, p.y, p.z, p.dim);
      this.dirty(p);
      return true;
    };
    const vil = this.w.villageAt(p.x, p.z);
    if (!vil || p.dim !== 'earth') return;
    if (shop === 'store') {
      const row = STORE_STOCK.find(([i]) => i === id);
      if (!row) return;
      const k = Math.min(n, room(p.inv, id));
      if (k <= 0) return this.toast('Your bag is full!', p);
      if (pay(row[1] * k)) add(p.inv, id, k);
    } else if (shop === 'restaurant') {
      const row = FOOD_MENU.find(([i]) => i === id);
      if (!row) return;
      if (pay(row[1] * n)) { add(p.inv, id, n); this.toast(`${ITEMS[id].icon} Yum! It’s in your bag. Eat it to get health back.`, p); }
    } else if (shop === 'cars') {
      const [kind, car] = id.split(':') as ['rent' | 'buy', CarId];
      const def = CARS[car];
      if (!def) return;
      if ([...this.cars.values()].some((c) => c.owner === p.slot)) return this.toast('You already have a car. Find it (🚗 on the map).', p);
      if (!pay(kind === 'rent' ? def.rent : def.buy)) return;
      const shopB = vil.buildings.find((b) => b.shop === 'cars')!;
      const c: Vehicle = { id: this.nextId++, car, x: shopB.door[0] + 0.5, z: shopB.door[1] + (shopB.door[1] > shopB.z ? 2.5 : -2.5), y: vil.y, yaw: 0, owner: p.slot, rentDay: kind === 'rent' ? this.day + MONTH_DAYS : null, driver: null };
      this.cars.set(c.id, c);
      this.events.push({ t: 'car+', c });
      this.toast(kind === 'rent' ? `🚗 You rented a ${def.name} for a month (until day ${c.rentDay}). It’s parked outside. Press E next to it.` : `🚗 You bought a ${def.name}! It’s parked outside. Press E next to it.`, p);
    } else if (shop === 'homes') {
      const home = HOMES.find((h) => h.id === id);
      const target = vil.buildings.find((b) => b.id === vb);
      if (!home || !target || target.kind !== 'house' || this.owned.has(target.id)) return;
      if (!pay(home.price)) return;
      this.owned.set(target.id, { slot: p.slot, inv: newInv(32) });
      p.houses.push(target.id);
      p.home = { x: target.door[0] + 0.5, z: target.door[1] + 0.5, dim: 'earth' };
      this.events.push({ t: 'own', id: target.id, slot: p.slot });
      this.toast(`🏠 You bought a ${home.name}! It has a storage chest (E at the door) and you wake up there.`, p);
    } else if (shop === 'pets') {
      const row = PETS.find(([i]) => i === id);
      if (!row) return;
      if ([...this.mobs.values()].filter((m) => m.owner === p.slot).length >= 3) return this.toast('You can have 3 pets at a time.', p);
      if (!pay(row[1])) return;
      const def = MOBS[id];
      const m = this.spawnMob(id, 'earth', p.x + 1, p.z + 1);
      m.owner = p.slot;
      m.hp = def.hp;
      this.toast(`🐾 Your new ${def.name.toLowerCase()} will follow you and protect you!`, p);
    }
  }
  sell(p: Player, slot: number, all: boolean) {
    const s = p.inv[slot];
    if (!s || !this.w.villageAt(p.x, p.z)) return;
    const price = ITEMS[s.id].sell ?? (ITEMS[s.id].build ? 5 : 0);
    if (!price) { this.toast('The store doesn’t buy that.', p); return; }
    const n = all ? s.n : 1;
    s.n -= n;
    if (s.n <= 0) p.inv[slot] = null;
    p.money += price * n;
    this.sfx('cash', p.x, p.y, p.z, p.dim);
    this.dirty(p);
  }
  villageDoor(p: Player): VillageBuilding | null {
    if (p.dim !== 'earth') return null;
    const v = this.w.villageAt(p.x, p.z);
    if (!v) return null;
    let best: VillageBuilding | null = null, bd = 6.5;
    for (const b of v.buildings) {
      const d = dist2(p.x, p.z, b.door[0] + 0.5, b.door[1] + 0.5);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ---------- animals ----------
  spawnMob(type: string, dim: Dim, x: number, z: number): Mob {
    const def = MOBS[type];
    const m: Mob = { id: this.nextId++, type, dim, x, z, y: this.groundY(dim, x, z), yaw: Math.random() * 6.28, hp: def.hp, tgt: null, t: Math.random() * 3, wx: x, wz: z, hx: x, hz: z, angry: 0, anim: 0, flee: 0 };
    this.mobs.set(m.id, m);
    return m;
  }
  private spawnStuff() {
    const earthPlayers = [...this.players.values()].filter((p) => p.dim === 'earth');
    // forget animals nobody is near
    for (const m of this.mobs.values()) {
      if (m.owner !== undefined) continue;
      let near = false;
      for (const p of this.players.values()) if (p.dim === m.dim && dist2(p.x, p.z, m.x, m.z) < 120 * 120) near = true;
      if (!near) {
        this.mobs.delete(m.id);
        if (m.home && this.nestBugs.has(m.home)) this.nestBugs.set(m.home, Math.max(0, this.nestBugs.get(m.home)! - 1));
        if (m.home && this.villagePeople.has(m.home)) this.villagePeople.set(m.home, Math.max(0, this.villagePeople.get(m.home)! - 1));
      }
    }
    for (const p of earthPlayers) {
      let wild = 0, hostile = 0;
      for (const m of this.mobs.values()) if (m.dim === 'earth' && !m.home && m.owner === undefined && dist2(p.x, p.z, m.x, m.z) < 90 * 90) { wild++; if (MOBS[m.type].hostile) hostile++; }
      const night = this.night;
      if (wild < (night ? 22 : 14)) {
        const a = Math.random() * Math.PI * 2, d = 35 + Math.random() * 40;
        const x = wrap(p.x + Math.cos(a) * d), z = wrap(p.z + Math.sin(a) * d);
        const b = this.w.biome(x, z);
        const vil = this.w.villageAt(x, z);
        if (!vil) {
          const options = Object.entries(MOBS).filter(([, def]) => Array.isArray(def.biomes) && def.biomes.includes(b) && (!def.night || night));
          const weighted = options.flatMap(([id, def]) => Array(def.hostile ? (def.night ? (night ? 3 : 0) : 1) : night ? 1 : 4).fill(id) as string[]);
          if (hostile > (night ? 10 : 3)) weighted.splice(0, weighted.length, ...weighted.filter((id) => !MOBS[id].hostile));
          const type = weighted[Math.floor(Math.random() * weighted.length)];
          if (type) {
            const water = this.w.isWater(x, z);
            if ((MOBS[type].shape === 'fish') === water && this.free('earth', x, z, this.groundY('earth', x, z) + 1, 0.4, 3)) {
              const herd = MOBS[type].hostile ? (type === 'wolf' || type === 'snow_wolf' ? 3 : 1) : 1 + Math.floor(Math.random() * 3);
              for (let i = 0; i < herd; i++) this.spawnMob(type, 'earth', x + i * 1.2, z + (i % 2));
            }
          }
        }
      }
      // bugs around their nests
      const tx = Math.floor(p.x), tz = Math.floor(p.z);
      // bug spawners send out a new bug every little while, up to 5 each
      void tx; void tz;
      for (const [x, z] of this.w.nestsNear(p.x, p.z, 110)) {
        const k = key(x, z);
        const have = this.nestBugs.get(k) ?? 0;
        const t = (this.nestT.get(k) ?? 0) - 1;
        if (have >= 5 || t > 0) { this.nestT.set(k, t); continue; }
        this.nestT.set(k, 6 + Math.floor(Math.random() * 6)); // spawn checks run about once a second
        const big = Math.random() < (this.day > 3 ? 0.3 : 0.15);
        const m = this.spawnMob(big ? 'big_bug' : 'bug', 'earth', x + 0.5, z + 1.6);
        m.home = k; m.hx = x + 0.5; m.hz = z + 0.5;
        this.nestBugs.set(k, have + 1);
        const y = this.w.tileHeight(x, z);
        this.fx.push({ k: 'puff', x: x + 0.5, y: y + 0.6, z: z + 1.2, dim: 'earth', c: '#b070e0', n: 10 });
        this.sfx('chitter', x + 0.5, y, z + 0.5, 'earth');
      }
      // villagers and cops
      for (const v of this.w.villagesNear(p.x, p.z)) {
        if (dist2(p.x, p.z, v.x, v.z) > 100 * 100) continue;
        const have = this.villagePeople.get(v.id) ?? 0;
        if (have < 10) {
          const road = [...v.roads];
          const k = road[Math.floor(Math.random() * road.length)].split(',').map(Number);
          const m = this.spawnMob(have % 3 === 0 ? 'cop' : 'villager', 'earth', k[0] + 0.5, k[1] + 0.5);
          m.home = v.id; m.hx = v.x; m.hz = v.z;
          this.villagePeople.set(v.id, have + 1);
        }
      }
    }
  }
  spawnCave(id: string) {
    let n = 0;
    for (const m of this.mobs.values()) if (m.dim === id) n++;
    const c = this.w.cave(id);
    for (let i = 0; n < 8 && i < 200; i++) {
      const x = 2 + Math.floor(Math.random() * (CAVE_SIZE - 4)), z = 2 + Math.floor(Math.random() * (CAVE_SIZE - 12));
      if (this.w.caveCell(c, x, z) !== 0) continue;
      const r = Math.random();
      this.spawnMob(r < 0.4 ? 'bat' : r < 0.85 ? 'cave_spider' : 'bug', id, x + 0.5, z + 0.5);
      n++;
    }
  }
  /** Bugs come for your machines now and then, if your factory is near their nests. */
  private raid() {
    const machines = [...this.buildings.values()].filter((b) => b.dim === 'earth' && b.on && (BUILDS[b.type].power || BUILDS[b.type].burns));
    if (machines.length < 3) return;
    const homes = new Set<string>();
    for (const m of this.mobs.values()) if (m.home && (m.type === 'bug' || m.type === 'big_bug')) homes.add(m.home);
    for (const h of homes) {
      const [hx, hz] = h.split(',').map(Number);
      let best: Building | null = null, bd = 150 * 150;
      for (const b of machines) { const d = dist2(hx, hz, b.x, b.z); if (d < bd) { bd = d; best = b; } }
      if (!best) continue;
      let sent = 0;
      for (const m of this.mobs.values()) if (m.home === h && sent < 3) { m.tgt = { k: 'b', id: best.id }; m.raid = true; m.angry = 90; sent++; }
      for (const p of this.players.values()) if (p.dim === 'earth' && dist2(p.x, p.z, best.x, best.z) < 200 * 200) this.toast('🐛 Alien bugs are coming for your base! Turrets and walls help.', p);
    }
  }

  private posOf(t: { k: 'p' | 'm' | 'b'; id: number }): { x: number; z: number; y: number; dim: Dim; r: number } | null {
    if (t.k === 'p') { const p = this.players.get(t.id); return p && p.dim !== 'silo' ? { x: p.x, z: p.z, y: p.y, dim: p.dim, r: 0.4 } : null; }
    if (t.k === 'm') { const m = this.mobs.get(t.id); return m ? { x: m.x, z: m.z, y: m.y, dim: m.dim, r: MOBS[m.type].size * 0.5 } : null; }
    const b = this.buildings.get(t.id);
    return b ? { x: b.x + BUILDS[b.type].size / 2, z: b.z + BUILDS[b.type].size / 2, y: 0, dim: b.dim, r: BUILDS[b.type].size / 2 + 0.3 } : null;
  }

  private tickMobs(dt: number) {
    const night = this.night;
    for (const m of this.mobs.values()) {
      const def = MOBS[m.type];
      m.t -= dt;
      m.angry = Math.max(0, m.angry - dt);
      m.flee = Math.max(0, m.flee - dt);
      const isBug = m.type === 'bug' || m.type === 'big_bug';
      // pick a target
      if (m.t <= 0 || (m.tgt && !this.posOf(m.tgt))) {
        m.t = 0.6 + Math.random() * 0.6;
        if (m.tgt && !this.posOf(m.tgt)) m.tgt = null;
        if (m.tgt && m.tgt.k !== 'b') {
          const tp = this.posOf(m.tgt)!;
          if (tp.dim !== m.dim || dist2(tp.x, tp.z, m.x, m.z) > 30 * 30) m.tgt = null;
        }
        if (m.owner !== undefined) {
          // pets go after anything hostile near their owner
          const o = this.players.get(m.owner);
          m.tgt = null;
          if (o) {
            let bd = 12 * 12;
            for (const e of this.mobs.values()) if (e.dim === m.dim && MOBS[e.type].hostile && e.owner === undefined && e.type !== 'cop') { const d = dist2(e.x, e.z, o.x, o.z); if (d < bd) { bd = d; m.tgt = { k: 'm', id: e.id }; } }
            if (o.dim !== m.dim && o.dim !== 'silo') { m.dim = o.dim; m.x = o.x + 1; m.z = o.z + 1; }
          }
        } else if (m.type === 'cop') {
          m.tgt = null;
          let bd = 25 * 25;
          for (const e of this.mobs.values()) if (e.dim === m.dim && MOBS[e.type].hostile && e.owner === undefined) { const d = dist2(e.x, e.z, m.x, m.z); if (d < bd && dist2(e.x, e.z, m.hx, m.hz) < 60 * 60) { bd = d; m.tgt = { k: 'm', id: e.id }; } }
        } else if (def.hostile && !m.tgt) {
          const aggro = isBug ? 9 : night ? 16 : 11;
          let bd = aggro * aggro;
          for (const p of this.players.values()) {
            if (p.dim !== m.dim) continue;
            if (this.w.villageAt(p.x, p.z) && m.dim === 'earth' && !isBug) continue; // safe in town
            const d = dist2(p.x, p.z, m.x, m.z);
            if (d < bd) { bd = d; m.tgt = { k: 'p', id: p.slot }; }
          }
          for (const e of this.mobs.values()) {
            if (e.dim !== m.dim || e === m) continue;
            // wolves and other hunters go after bugs; pets are fair game too
            const ok = (def.huntsBugs && (e.type === 'bug' || e.type === 'big_bug')) || (e.owner !== undefined && !isBug);
            if (!ok) continue;
            const d = dist2(e.x, e.z, m.x, m.z);
            if (d < bd * 0.8) { bd = d; m.tgt = { k: 'm', id: e.id }; }
          }
        }
        if (!m.tgt) {
          // wander
          const leash = m.owner !== undefined ? 0 : m.home ? (isBug ? 7 : 30) : 12;
          if (m.owner !== undefined) {
            const o = this.players.get(m.owner);
            if (o) { m.wx = o.x + Math.cos(m.id) * 2; m.wz = o.z + Math.sin(m.id) * 2; }
          } else if (Math.random() < 0.5) {
            const bx = m.home ? m.hx : m.x, bz = m.home ? m.hz : m.z;
            m.wx = bx + (Math.random() - 0.5) * leash * 2;
            m.wz = bz + (Math.random() - 0.5) * leash * 2;
          }
        }
      }
      // move
      let gx = m.wx, gz = m.wz, speed = def.speed * 0.45;
      const tp = m.tgt ? this.posOf(m.tgt) : null;
      if (tp && tp.dim === m.dim) { gx = tp.x; gz = tp.z; speed = def.speed; }
      if (m.flee > 0) {
        let fx = m.x, fz = m.z;
        for (const p of this.players.values()) if (p.dim === m.dim) { fx = p.x; fz = p.z; }
        gx = m.x - wd(fx, m.x) * 3; gz = m.z - wd(fz, m.z) * 3; speed = def.speed * 1.2;
      }
      if (m.owner !== undefined && !tp) {
        const o = this.players.get(m.owner);
        if (o && dist2(o.x, o.z, m.x, m.z) > 40 * 40 && o.dim === m.dim) { m.x = o.x + 1; m.z = o.z + 1; }
        if (o?.car) speed = Math.max(speed, CARS[this.cars.get(o.car)?.car ?? 'buggy'].speed);
        else speed = def.speed * (o && dist2(o.x, o.z, m.x, m.z) > 16 ? 1 : 0.4);
      }
      const dx = wd(gx, m.x), dz = wd(gz, m.z);
      const d = Math.hypot(dx, dz);
      const reach = tp ? tp.r + def.size * 0.5 + 0.6 : 0.5;
      if (d > reach) {
        const sx = (dx / d) * speed * dt, sz = (dz / d) * speed * dt;
        const flying = def.shape === 'bat' || (def.shape === 'bird' && m.owner !== undefined);
        const fish = def.shape === 'fish';
        const ok = (x: number, z: number) => {
          if (m.dim === 'earth' && fish) return this.w.isWater(x, z);
          if (m.dim === 'earth' && !fish && this.w.isWater(x, z) && !flying && !(this.w.tileHeight(Math.floor(x), Math.floor(z)) > -1.2)) return false;
          return flying && m.dim === 'earth' ? true : this.free(m.dim, x, z, m.y, Math.min(0.45, def.size * 0.35), 1.3);
        };
        if (ok(m.x + sx, m.z + sz)) { m.x += sx; m.z += sz; }
        else if (ok(m.x + sx, m.z)) m.x += sx;
        else if (ok(m.x, m.z + sz)) m.z += sz;
        else { m.wx = m.x + (Math.random() - 0.5) * 10; m.wz = m.z + (Math.random() - 0.5) * 10; }
        if (m.dim === 'earth') { m.x = wrap(m.x); m.z = wrap(m.z); }
        m.yaw = Math.atan2(dx, dz);
        m.anim += speed * dt * 2;
        const g = this.groundY(m.dim, m.x, m.z);
        m.y = def.shape === 'fish' ? Math.min(g + 0.3, WATER_LEVEL - 0.6) : flying ? Math.max(g, m.dim === 'earth' ? WATER_LEVEL : 0) + 1.6 + Math.sin(m.anim) * 0.3 : Math.max(g, m.dim === 'earth' && this.w.isWater(m.x, m.z) ? WATER_LEVEL - 0.5 : g);
      } else if (tp && def.dmg > 0) {
        m.yaw = Math.atan2(dx, dz);
        // attack
        if (m.t > 0.4 && m.t < 0.45 + dt) {
          // once per think
        }
        (m as Mob & { atk?: number }).atk = ((m as Mob & { atk?: number }).atk ?? 0) - dt;
        if (((m as Mob & { atk?: number }).atk ?? 0) <= 0) {
          (m as Mob & { atk?: number }).atk = 1.1;
          this.sfx(def.sound === 'voice' ? 'whistle' : def.sound, m.x, m.y, m.z, m.dim);
          if (m.tgt!.k === 'p') this.hurtPlayer(this.players.get(m.tgt!.id)!, def.dmg, `a ${def.name.toLowerCase()}`);
          else if (m.tgt!.k === 'm') { const e = this.mobs.get(m.tgt!.id); if (e) this.hurtMob(e, def.dmg, { k: 'm', id: m.id }); }
          else {
            const b = this.buildings.get(m.tgt!.id);
            if (b) {
              b.hp -= def.dmg;
              this.fx.push({ k: 'spark', x: b.x + 0.5, y: this.groundY(b.dim, b.x, b.z) + 0.8, z: b.z + 0.5, dim: b.dim, c: '#ffcc66', n: 5 });
              if (b.hp <= 0) { this.blowUp(b, 'Alien bugs'); m.tgt = null; m.raid = false; }
            }
          }
        }
      }
      // random noises
      if (Math.random() < dt * 0.04) this.sfx(def.sound, m.x, m.y, m.z, m.dim);
    }
  }

  // ---------- saving ----------
  save() {
    const p = this.me;
    return {
      v: 1,
      seed: this.w.seed,
      time: this.time,
      nextId: this.nextId,
      me: { x: p.x, y: p.y, z: p.z, dim: p.dim === 'silo' ? 'earth' : p.dim, hp: p.hp, money: p.money, inv: p.inv, home: p.home, houses: p.houses, traveled: p.traveled, hand: p.hand },
      removed: [...this.w.removed],
      ore: [...this.w.oreLeft],
      dug: [...this.w.dug],
      caveDug: [...this.w.caveDug],
      buildings: [...this.buildings.values()],
      ship: { tiles: [...this.ship.tiles], at: this.ship.at, made: this.ship.made },
      owned: [...this.owned].filter(([, o]) => o.slot === 0),
      cars: [...this.cars.values()].filter((c) => c.owner === 0).map((c) => ({ ...c, driver: null })),
      pets: [...this.mobs.values()].filter((m) => m.owner === 0).map((m) => m.type),
      ghosts: [...this.ghosts.values()],
      research: { done: [...this.research.done], cur: this.research.cur, units: this.research.units },
      // robots out flying go back in their roboport when the world loads
      botsOut: this.bots.map((r) => [r.home, r.carry] as [number, ItemId | null]),
    };
  }
  static load(s: ReturnType<Game['save']>): Game {
    const g = new Game(s.seed);
    g.time = s.time;
    const p = g.me;
    Object.assign(p, s.me);
    p.car = null;
    for (const k of s.removed) g.w.removed.add(k);
    for (const [k, n] of s.ore) g.w.oreLeft.set(k, n);
    for (const [k, n] of s.dug) g.w.dug.set(k, n);
    for (const k of s.caveDug ?? []) g.w.caveDug.add(k);
    for (const b of s.buildings) {
      g.buildings.set(b.id, b);
      const size = BUILDS[b.type]?.size ?? 1;
      for (let ox = 0; ox < size; ox++) for (let oz = 0; oz < size; oz++) g.occ.set(g.occKey(b.dim, b.x + ox, b.z + oz), b.id);
    }
    for (const k of s.ship?.tiles ?? []) g.ship.tiles.add(k);
    g.ship.at = s.ship?.at ?? 0;
    g.ship.dest = g.ship.at;
    g.ship.made = !!s.ship?.made;
    for (const [k, o] of s.owned ?? []) g.owned.set(k, o);
    for (const c of s.cars ?? []) g.cars.set(c.id, c);
    for (const gh of s.ghosts ?? []) g.addGhost(gh);
    if (s.research) { for (const d of s.research.done) g.research.done.add(d); g.research.cur = s.research.cur; g.research.units = s.research.units; }
    for (const [home, carry] of s.botsOut ?? []) { const b = g.buildings.get(home); if (b?.inv) { add(b.inv, 'robot', 1); if (carry) add(b.inv, carry, 1); } }
    g.nextId = Math.max(s.nextId, ...[...g.buildings.keys()].map((n) => n + 1), ...[...g.ghosts.keys()].map((n) => n + 1), 1);
    for (const t of s.pets ?? []) { const m = g.spawnMob(t, p.dim === 'space' ? 'space' : p.dim, p.x + 1, p.z + 1); m.owner = 0; }
    if (p.dim === 'earth') p.y = g.groundY('earth', p.x, p.z) + 0.2;
    g.events = [];
    return g;
  }
}
