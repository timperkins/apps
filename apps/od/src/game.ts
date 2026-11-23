import {
  BULLY_LINES,
  CAPTAIN_LINES,
  COP_LINES,
  DRIVER_LINES,
  GUARD_IDLE,
  HELLO_LINES,
  LOST_LINES,
  RENT_PRICE,
  RENT_SECONDS,
  BUY_PRICE,
  SHOP_ITEMS,
  TIRED_LINES,
  TROOP_LINES,
  VAULT_CASH,
  VAULT_REFILL,
} from './data';
import { copLevel, copMultiplier } from './iso';
import {
  GameMap,
  ROAD_BASES,
  SHIP_START,
  T,
  buildBank,
  buildCity,
  drivable,
  idx,
  tileAt,
  walkable,
} from './map';
import { sfx } from './audio';

export type PersonKind =
  | 'player'
  | 'ped'
  | 'bully'
  | 'driver'
  | 'cop'
  | 'guard'
  | 'grenider'
  | 'heater'
  | 'lazor'
  | 'captain'
  | 'sailor';

export interface Person {
  id: number;
  kind: PersonKind;
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  speed: number;
  walk: number;
  moving: boolean;
  ko: number;
  gone: boolean;
  hit: number;
  punch: number; // swing animation timer
  attackCd: number;
  say: string;
  sayT: number;
  sayCd: number;
  hostile: boolean;
  chase: number;
  tired: boolean;
  flee: number;
  sleeping: boolean;
  onShip: boolean;
  home: { x: number; y: number };
  target: { x: number; y: number } | null;
  stuck: number;
  detour: { x: number; y: number; t: number } | null;
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  mult: number;
  burn: number;
}

export type VehicleKind = 'car' | 'bus' | 'cop' | 'army' | 'tank' | 'ship' | 'sports';

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  x: number;
  y: number;
  angle: number;
  speed: number;
  len: number;
  wid: number;
  hgt: number;
  color: string;
  driver: 'ai' | 'player' | 'none' | 'cop' | 'army';
  dir: { x: number; y: number };
  lane: number;
  hp: number;
  maxHp: number;
  broken: number;
  rental: number;
  mine: boolean;
  lot: boolean;
  troops: number;
  dropT: number;
  fireCd: number;
  turret: number;
  stuck: number;
  backT: number;
  leaving: boolean;
  gone: boolean;
  hit: number;
  copOut: boolean;
  inter: number;
}

export interface Shot {
  kind: 'grenade' | 'laser' | 'flame' | 'shell';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  dmg: number;
  mine?: boolean;
}

export interface Fx {
  kind: 'text' | 'boom' | 'smoke' | 'splash';
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
  text: string;
  color: string;
  size: number;
}

export interface Scene {
  map: GameMap;
  people: Person[];
  vehicles: Vehicle[];
  shots: Shot[];
  fx: Fx[];
}

export interface Input {
  mx: number; // world-space move
  my: number;
  mag: number;
  punch: boolean;
  fire: boolean;
  use: boolean;
}

export interface Hint {
  text: string;
  label: string;
  act: (() => void) | null;
}

export interface SaveData {
  money: number;
  owned: string[];
  upgrades: Record<string, number>;
  wearing: string | null;
  ownsCar: boolean;
  time: number;
}

const SKINS = ['#f2c9a0', '#e0ac7e', '#c68a5a', '#8d5a3a', '#f7d8b8'];
const HAIRS = ['#3b2a1e', '#1c1c1c', '#a0662e', '#e6c35c', '#7a3b1c', '#9e9e9e'];
const SHIRTS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1', '#f06292', '#aed581', '#fff176'];
const PANTS = ['#3e4a61', '#5d4037', '#455a64', '#37474f', '#6d4c41'];
const CAR_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#f5f5f5', '#6d4c41'];
const ROAD_FIRST = ROAD_BASES[0];
const ROAD_LAST = ROAD_BASES[ROAD_BASES.length - 1];

let nextId = 1;
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makePerson(kind: PersonKind, x: number, y: number, mult = 1): Person {
  const p: Person = {
    id: nextId++,
    kind,
    x,
    y,
    z: 0,
    fx: 0,
    fy: 1,
    kx: 0,
    ky: 0,
    hp: 40,
    maxHp: 40,
    speed: 1.4,
    walk: Math.random() * 10,
    moving: false,
    ko: 0,
    gone: false,
    hit: 0,
    punch: 0,
    attackCd: 0,
    say: '',
    sayT: 0,
    sayCd: Math.random() * 4,
    hostile: false,
    chase: 0,
    tired: false,
    flee: 0,
    sleeping: false,
    onShip: false,
    home: { x, y },
    target: null,
    stuck: 0,
    detour: null,
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    skin: pick(SKINS),
    hair: pick(HAIRS),
    mult,
    burn: 0,
  };
  const set = (hp: number, speed: number) => {
    p.hp = p.maxHp = hp;
    p.speed = speed;
  };
  const toughSpeed = Math.min(mult, 1.4);
  switch (kind) {
    case 'player':
      set(100, 4);
      break;
    case 'bully':
      set(50, 2.6);
      p.shirt = '#424242';
      break;
    case 'cop':
      set(60 * mult, 3.5 * toughSpeed);
      p.shirt = '#2a4d9b';
      p.pants = '#1b2f5e';
      break;
    case 'guard':
      set(60, 3.2);
      p.shirt = '#6d6d6d';
      p.pants = '#3a3a3a';
      break;
    case 'grenider':
      set(70 * mult, 2.4 * toughSpeed);
      p.shirt = '#6b7a3a';
      p.pants = '#4a5528';
      break;
    case 'heater':
      set(80 * mult, 2.6 * toughSpeed);
      p.shirt = '#7a6a3a';
      p.pants = '#4a5528';
      break;
    case 'lazor':
      set(60 * mult, 2.5 * toughSpeed);
      p.shirt = '#55603a';
      p.pants = '#3c4426';
      break;
    case 'captain':
      set(300, 3);
      p.shirt = '#1a2a52';
      p.pants = '#1a2a52';
      p.hair = '#e8e8e8';
      break;
    case 'sailor':
      set(60, 3);
      p.shirt = '#f5f5f5';
      p.pants = '#2a3f7a';
      break;
  }
  return p;
}

function makeVehicle(kind: VehicleKind, x: number, y: number, angle: number): Vehicle {
  const v: Vehicle = {
    id: nextId++,
    kind,
    x,
    y,
    angle,
    speed: 0,
    len: 1.9,
    wid: 1.0,
    hgt: 0.5,
    color: pick(CAR_COLORS),
    driver: 'none',
    dir: { x: Math.cos(angle), y: Math.sin(angle) },
    lane: 0,
    hp: 100,
    maxHp: 100,
    broken: 0,
    rental: 0,
    mine: false,
    lot: false,
    troops: 0,
    dropT: 0,
    fireCd: 2,
    turret: angle,
    stuck: 0,
    backT: 0,
    leaving: false,
    gone: false,
    hit: 0,
    copOut: false,
    inter: -1,
  };
  if (kind === 'bus') Object.assign(v, { len: 3.8, wid: 1.25, hgt: 1.1, color: '#f9a825', hp: 200, maxHp: 200 });
  if (kind === 'army') Object.assign(v, { len: 3.8, wid: 1.3, hgt: 1.15, color: '#5b6b35', hp: 300, maxHp: 300 });
  if (kind === 'cop') Object.assign(v, { color: '#f5f5f5', hp: 140, maxHp: 140 });
  if (kind === 'sports') Object.assign(v, { color: '#d81b60', hgt: 0.42 });
  if (kind === 'tank') Object.assign(v, { len: 2.6, wid: 1.7, hgt: 0.6, color: '#5d6b3a', hp: 500, maxHp: 500 });
  if (kind === 'ship') Object.assign(v, { len: 8, wid: 3, hgt: 0.6, color: '#8d4a2b', hp: 9999, maxHp: 9999 });
  return v;
}

function maxSpeed(v: Vehicle): number {
  switch (v.kind) {
    case 'bus':
    case 'army':
      return 7;
    case 'tank':
      return 3;
    case 'ship':
      return 6;
    case 'sports':
      return 12;
    case 'cop':
      return 10;
    default:
      return 9.5;
  }
}

export function inRect(v: Vehicle, x: number, y: number, pad = 0): boolean {
  const dx = x - v.x;
  const dy = y - v.y;
  const c = Math.cos(-v.angle);
  const s = Math.sin(-v.angle);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= v.len / 2 + pad && Math.abs(ly) <= v.wid / 2 + pad;
}

function local(v: Vehicle, lx: number, ly: number) {
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  return { x: v.x + lx * c - ly * s, y: v.y + lx * s + ly * c };
}

function corners(v: Vehicle, x = v.x, y = v.y, angle = v.angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: { x: number; y: number }[] = [];
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const lx = (a * v.len) / 2;
    const ly = (b * v.wid) / 2;
    out.push({ x: x + lx * c - ly * s, y: y + lx * s + ly * c });
  }
  return out;
}

export class Game {
  city: Scene;
  bank: Scene;
  scene: Scene;
  player: Person;
  vehicle: Vehicle | null = null;
  inVent = false;
  ship: Vehicle;
  captainDown = false;
  money = 250;
  wanted = 0;
  calm = 0;
  crimeCd = 0;
  time = 0;
  shownLevel = 1;
  owned = new Set<string>();
  upgrades: Record<string, number> = { shoes: 0, gloves: 0, vest: 0 };
  wearing: string | null = null;
  disguiseCd = 0;
  ownsCar = false;
  myCar: Vehicle | null = null;
  vaults: Record<string, number> = {}; // seconds until each bank's vault refills
  bankId = '';
  bankReturn = { x: 0, y: 0 };
  alarm = false;
  hint: Hint | null = null;
  banners: { text: string; t: number; color: string }[] = [];
  overlay: { title: string; sub: string; t: number } | null = null;
  lift: { t: number; driver: Person; car: Vehicle } | null = null;
  invuln = 0;
  flameT = 0;
  regen = 0;
  copT = 0;
  armyT = 10;
  tankT = 0;
  cam = { x: 0, y: 0 };
  menu: 'shop' | 'lot' | null = null;
  onSave: (() => void) | null = null;

  constructor(save?: SaveData | null) {
    this.city = { map: buildCity(), people: [], vehicles: [], shots: [], fx: [] };
    this.bank = { map: buildBank(), people: [], vehicles: [], shots: [], fx: [] };
    this.scene = this.city;
    const s = this.city.map.spawns.player[0];
    this.player = makePerson('player', s.x, s.y);
    this.player.shirt = '#222';
    this.player.pants = '#30343c';
    this.player.skin = '#f2c9a0';
    if (save) {
      this.money = save.money;
      save.owned.forEach((o) => this.owned.add(o));
      Object.assign(this.upgrades, save.upgrades);
      this.wearing = save.wearing && this.owned.has(save.wearing) ? save.wearing : null;
      this.ownsCar = save.ownsCar;
      this.time = save.time ?? 0;
      this.shownLevel = copLevel(this.time);
    }
    this.applyUpgrades();
    this.player.hp = this.player.maxHp;
    this.ship = makeVehicle('ship', SHIP_START.x, SHIP_START.y, SHIP_START.angle);
    this.city.vehicles.push(this.ship);
    this.spawnCrew();
    for (const p of this.city.map.spawns.lotCars ?? []) {
      const v = makeVehicle(Math.random() < 0.3 ? 'sports' : 'car', p.x, p.y, Math.PI / 2);
      v.lot = true;
      this.city.vehicles.push(v);
    }
    for (let i = 0; i < 16; i++) this.spawnTraffic(i < 3 ? 'bus' : 'car', true);
    for (let i = 0; i < 26; i++) this.spawnPed(true);
    if (this.ownsCar) this.callMyCar(true);
    this.cam = { x: this.player.x, y: this.player.y };
  }

  save(): SaveData {
    return {
      money: Math.floor(this.money),
      owned: [...this.owned],
      upgrades: this.upgrades,
      wearing: this.wearing,
      ownsCar: this.ownsCar,
      time: this.time,
    };
  }

  get vaultT() {
    return this.vaults[this.bankId] ?? 0;
  }

  set vaultT(v: number) {
    this.vaults[this.bankId] = v;
  }

  get mult() {
    return copMultiplier(this.time);
  }

  get hasTool() {
    return this.owned.has('screwdriver') || this.owned.has('wrench');
  }

  applyUpgrades() {
    this.player.speed = 4 + this.upgrades.shoes * 0.9;
    this.player.maxHp = 100 + this.upgrades.vest * 50;
  }

  banner(text: string, color = '#fff') {
    this.banners.push({ text, t: 3.2, color });
    if (this.banners.length > 3) this.banners.shift();
  }

  fx(kind: Fx['kind'], x: number, y: number, z: number, text = '', color = '#fff', life = 0.8, size = 1) {
    this.scene.fx.push({ kind, x, y, z, t: 0, life, text, color, size });
  }

  say(p: Person, text: string, t = 2.2) {
    p.say = text;
    p.sayT = t;
  }

  // ---------- spawning ----------

  spawnCrew() {
    const deck = (lx: number, ly: number) => local(this.ship, lx, ly);
    const helm = this.helmPos();
    const cap = makePerson('captain', helm.x, helm.y);
    cap.onShip = true;
    const a = deck(1.5, 0.6);
    const b = deck(-0.5, -0.7);
    const s1 = makePerson('sailor', a.x, a.y);
    const s2 = makePerson('sailor', b.x, b.y);
    s1.onShip = s2.onShip = true;
    this.city.people.push(cap, s1, s2);
  }

  helmPos() {
    return local(this.ship, -this.ship.len / 2 + 1.1, 0);
  }

  randomSidewalk(minD: number, maxD: number): { x: number; y: number } | null {
    const m = this.city.map;
    const c = this.vehicle ?? this.player;
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = minD + Math.random() * (maxD - minD);
      const x = Math.floor(c.x + Math.cos(a) * d);
      const y = Math.floor(c.y + Math.sin(a) * d);
      const t = tileAt(m, x, y);
      if (t === T.Sidewalk || t === T.Plaza) return { x: x + 0.5, y: y + 0.5 };
    }
    return null;
  }

  spawnPed(anywhere = false) {
    const pos = anywhere ? this.randomSidewalk(2, 40) : this.randomSidewalk(13, 22);
    if (!pos) return;
    const p = makePerson(Math.random() < 0.14 ? 'bully' : 'ped', pos.x, pos.y);
    this.city.people.push(p);
  }

  spawnTraffic(kind: 'car' | 'bus', anywhere = false) {
    const c = this.vehicle ?? this.player;
    for (let tries = 0; tries < 30; tries++) {
      const horiz = Math.random() < 0.5;
      const base = pick(ROAD_BASES);
      const pos = ROAD_FIRST + 2 + Math.random() * (ROAD_LAST - ROAD_FIRST - 2);
      const sign = Math.random() < 0.5 ? 1 : -1;
      const dir = horiz ? { x: sign, y: 0 } : { x: 0, y: sign };
      const lane = base + (sign > 0 ? (horiz ? 1.5 : 0.5) : horiz ? 0.5 : 1.5);
      const x = horiz ? pos : lane;
      const y = horiz ? lane : pos;
      // stay away from intersections and the player
      const along = horiz ? x : y;
      if (ROAD_BASES.some((b) => Math.abs(along - (b + 1)) < 2)) continue;
      const d = Math.hypot(x - c.x, y - c.y);
      if (!anywhere && (d < 14 || d > 30)) continue;
      if (anywhere && (d < 5 || d > 30)) continue;
      if (this.city.vehicles.some((o) => Math.hypot(o.x - x, o.y - y) < 5)) continue;
      const v = makeVehicle(kind, x, y, Math.atan2(dir.y, dir.x));
      v.driver = 'ai';
      v.dir = dir;
      v.lane = lane;
      v.speed = 3;
      this.city.vehicles.push(v);
      return;
    }
  }

  spawnCop(onRoad = false, calm = false) {
    const c = this.vehicle ?? this.player;
    const police = this.city.map.spawns.police.reduce((a, b) => (dist(a, c) < dist(b, c) ? a : b));
    let pos = this.randomSidewalk(9, 15);
    if (!pos || Math.random() < 0.2) pos = dist(police, c) < 25 ? police : pos;
    if (!pos) return;
    if (onRoad) {
      const v = makeVehicle('cop', pos.x, pos.y, Math.atan2(c.y - pos.y, c.x - pos.x));
      // put the car on the nearest road
      const rp = this.nearestRoad(pos.x, pos.y);
      if (!rp) return;
      v.x = rp.x;
      v.y = rp.y;
      v.driver = 'cop';
      this.city.vehicles.push(v);
      return;
    }
    const p = makePerson('cop', pos.x, pos.y, this.mult);
    p.hostile = !calm;
    this.city.people.push(p);
  }

  nearestRoad(x: number, y: number) {
    const m = this.city.map;
    for (let r = 0; r < 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const tx = Math.floor(x) + dx;
          const ty = Math.floor(y) + dy;
          if (tileAt(m, tx, ty) === T.Road) return { x: tx + 0.5, y: ty + 0.5 };
        }
    return null;
  }

  spawnArmy(kind: 'army' | 'tank') {
    const c = this.vehicle ?? this.player;
    // Arrive along a road from the far side.
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * Math.PI * 2;
      const rp = this.nearestRoad(c.x + Math.cos(a) * 18, c.y + Math.sin(a) * 18);
      if (!rp) continue;
      const v = makeVehicle(kind, rp.x, rp.y, Math.atan2(c.y - rp.y, c.x - rp.x));
      v.driver = 'army';
      v.troops = kind === 'army' ? 3 + Math.min(3, copLevel(this.time) - 1) : 0;
      this.city.vehicles.push(v);
      this.banner(kind === 'army' ? 'The army is coming!' : 'A TANK is rolling in!', '#c5e1a5');
      sfx('alarm');
      return;
    }
  }

  // ---------- world queries ----------

  canWalk(p: Person, x: number, y: number): boolean {
    const r = 0.26;
    const m = this.scene.map;
    const inVent = p.kind === 'player' && this.inVent;
    const ship = this.scene === this.city ? this.ship : null;
    for (const [ox, oy] of [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
    ]) {
      const px = x + ox;
      const py = y + oy;
      const onDeck = ship !== null && inRect(ship, px, py, -0.2);
      if (p.onShip) {
        if (!onDeck) return false;
        continue;
      }
      if (onDeck) continue;
      if (!walkable(tileAt(m, px, py), inVent)) return false;
    }
    return true;
  }

  movePerson(p: Person, dx: number, dy: number): boolean {
    let ok = true;
    if (dx !== 0) {
      if (this.canWalk(p, p.x + dx, p.y)) p.x += dx;
      else ok = false;
    }
    if (dy !== 0) {
      if (this.canWalk(p, p.x, p.y + dy)) p.y += dy;
      else ok = false;
    }
    return ok;
  }

  canDrive(v: Vehicle, x: number, y: number, angle: number): boolean {
    const m = this.scene.map;
    for (const c of corners(v, x, y, angle)) {
      const t = tileAt(m, c.x, c.y);
      if (v.kind === 'ship' ? t !== T.Water : !drivable(t)) return false;
    }
    if (v.kind !== 'ship' && inRect(this.ship, x, y, 0.3)) return false;
    return true;
  }

  hostilesNear(r: number): number {
    const c = this.vehicle ?? this.player;
    let n = 0;
    for (const p of this.scene.people)
      if (p.hostile && p.ko === 0 && !p.gone && p.kind !== 'bully' && dist(p, c) < r) n++;
    for (const v of this.scene.vehicles)
      if ((v.driver === 'cop' || v.driver === 'army') && !v.gone && dist(v, c) < r) n++;
    return n;
  }

  // ---------- crime ----------

  /** Is a police officer close enough to see what you just did? */
  copSees(): boolean {
    if (this.scene !== this.city) return false;
    const c = this.vehicle ?? this.player;
    for (const p of this.city.people) if (p.kind === 'cop' && p.ko === 0 && dist(p, c) < 11) return true;
    for (const v of this.city.vehicles) if (v.kind === 'cop' && v.driver === 'cop' && dist(v, c) < 13) return true;
    return false;
  }

  /** Police only get angry when they see a crime; big crimes (bank, ship) always count. */
  crime(n: number, why: string, big = false) {
    if (!big && !this.copSees()) return;
    if (!big && this.crimeCd > 0) return;
    this.crimeCd = 6;
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    this.calm = 0;
    if (this.wanted > before) {
      this.banner(`${why} ${'★'.repeat(this.wanted)}`, '#ffd54f');
      sfx('siren');
    }
    for (const p of this.city.people) if (p.kind === 'cop' && p.ko === 0) p.hostile = true;
  }

  clearWanted() {
    this.wanted = 0;
    this.calm = 0;
    for (const p of this.city.people) {
      if (p.kind === 'cop' || p.kind === 'grenider' || p.kind === 'heater' || p.kind === 'lazor') {
        p.hostile = false;
        p.chase = 0;
      }
    }
    for (const v of this.city.vehicles) if (v.driver === 'cop' || v.driver === 'army') v.leaving = true;
  }

  // ---------- player actions ----------

  setOutfit(id: string | null) {
    if (id && !this.owned.has(id)) return;
    if (id === this.wearing) id = null;
    this.wearing = id;
    sfx('cloth');
    if (this.wanted > 0) {
      if (this.disguiseCd > 0) {
        this.banner('Wait a bit before changing again.', '#ffcc80');
      } else if (this.hostilesNear(7) > 0) {
        this.banner('They saw you change! Get out of sight first.', '#ffab91');
      } else {
        this.wanted = Math.max(0, this.wanted - 2);
        this.disguiseCd = 30;
        this.banner(this.wanted === 0 ? 'Disguise worked! The cops lost you.' : 'Disguise worked! Fewer cops now.', '#a5d6a7');
        for (const p of this.city.people) if (p.hostile && p.kind !== 'bully' && p.ko === 0 && Math.random() < 0.7) this.say(p, pick(LOST_LINES));
        if (this.wanted === 0) this.clearWanted();
      }
    }
    this.onSave?.();
  }

  buy(id: string): string {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return '';
    const level = this.upgrades[id] ?? 0;
    const price = item.kind === 'upgrade' ? item.price * (level + 1) : item.price;
    if (item.kind === 'upgrade' && level >= (item.max ?? 1)) return 'Already maxed out!';
    if ((item.kind === 'tool' || item.kind === 'disguise' || item.kind === 'weapon') && this.owned.has(id)) return 'You already have it.';
    if (item.kind === 'heal' && this.player.hp >= this.player.maxHp) return "You're not hungry.";
    if (this.money < price) return 'Not enough money!';
    this.money -= price;
    sfx('cash');
    if (item.kind === 'upgrade') {
      this.upgrades[id] = level + 1;
      this.applyUpgrades();
      if (id === 'vest') this.player.hp = this.player.maxHp;
    } else if (item.kind === 'heal') {
      this.player.hp = this.player.maxHp;
    } else {
      this.owned.add(id);
    }
    this.onSave?.();
    return `Bought ${item.name}!`;
  }

  priceOf(id: string): number {
    const item = SHOP_ITEMS.find((i) => i.id === id)!;
    return item.kind === 'upgrade' ? item.price * ((this.upgrades[id] ?? 0) + 1) : item.price;
  }

  lotDeal(kind: 'rent' | 'buy'): string {
    const price = kind === 'rent' ? RENT_PRICE : BUY_PRICE;
    if (kind === 'buy' && this.ownsCar) return 'You already own a car! Call it from your phone.';
    if (this.money < price) return 'Not enough money!';
    this.money -= price;
    sfx('cash');
    const pl = this.player;
    const drop = this.city.map.spawns.lotDrop.reduce((a, b) => (dist(a, pl) < dist(b, pl) ? a : b));
    const v = makeVehicle(kind === 'buy' ? 'sports' : 'car', drop.x, drop.y, 0);
    if (kind === 'buy') {
      v.mine = true;
      v.color = '#d81b60';
      this.ownsCar = true;
      this.myCar = v;
    } else {
      v.rental = RENT_SECONDS;
      v.color = '#26a69a';
    }
    this.city.vehicles.push(v);
    this.menu = null;
    this.enterVehicle(v);
    this.onSave?.();
    return '';
  }

  callMyCar(silent = false) {
    if (!this.ownsCar) return;
    if (this.scene !== this.city) {
      this.banner('Go outside first.', '#ffcc80');
      return;
    }
    if (this.myCar && !this.myCar.gone && this.myCar.broken === 0 && this.vehicle === this.myCar) return;
    if (this.myCar) this.myCar.gone = true;
    const c = this.player;
    const rp = this.nearestRoad(c.x, c.y) ?? { x: c.x, y: c.y };
    const v = makeVehicle('sports', rp.x, rp.y, 0);
    v.mine = true;
    v.color = '#d81b60';
    this.myCar = v;
    this.city.vehicles.push(v);
    if (!silent) {
      this.banner('Your car is here!', '#a5d6a7');
      sfx('horn');
    }
  }

  enterVehicle(v: Vehicle) {
    this.vehicle = v;
    v.driver = 'player';
    this.player.x = v.x;
    this.player.y = v.y;
    sfx('door');
  }

  exitVehicle() {
    const v = this.vehicle;
    if (!v) return;
    if (v.kind === 'ship') {
      const h = this.helmPos();
      this.player.x = h.x;
      this.player.y = h.y;
      v.driver = 'none';
      v.speed = 0;
      this.vehicle = null;
      return;
    }
    const tries = [
      [0, v.wid / 2 + 0.5],
      [0, -v.wid / 2 - 0.5],
      [v.len / 2 + 0.5, 0],
      [-v.len / 2 - 0.5, 0],
      [0, v.wid / 2 + 1.2],
      [0, -v.wid / 2 - 1.2],
    ];
    for (const [lx, ly] of tries) {
      const p = local(v, lx, ly);
      if (this.canWalk(this.player, p.x, p.y)) {
        this.player.x = p.x;
        this.player.y = p.y;
        v.driver = 'none';
        this.vehicle = null;
        sfx('door');
        return;
      }
    }
    this.banner("No room to get out here!", '#ffcc80');
  }

  grabDriver(v: Vehicle) {
    v.driver = 'none';
    v.speed = 0;
    const d = makePerson('driver', v.x, v.y);
    this.lift = { t: 0.7, driver: d, car: v };
    this.scene.people.push(d);
    d.z = 1;
    sfx('lift');
    this.crime(1, 'Car stolen!');
  }

  punch() {
    const pl = this.player;
    if (pl.attackCd > 0 || this.vehicle || this.lift) return;
    pl.attackCd = 0.33;
    pl.punch = 0.2;
    sfx('swing');
    const dmg = 20 + this.upgrades.gloves * 12;
    let best: Person | null = null;
    let bestD = 1.25;
    for (const p of this.scene.people) {
      if (p === pl || p.ko > 0 || p.gone || p.z > 0.8 !== pl.z > 0.8) continue;
      const d = dist(p, pl);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    if (best) {
      this.hitPerson(best, dmg, pl.x, pl.y, true);
      return;
    }
    for (const v of this.scene.vehicles) {
      if (v.gone || v.kind === 'ship' || v.driver === 'player') continue;
      if (inRect(v, pl.x + pl.fx * 0.6, pl.y + pl.fy * 0.6, 0.35)) {
        this.hitVehicle(v, dmg * 0.6);
        this.fx('text', pl.x + pl.fx * 0.6, pl.y + pl.fy * 0.6, 1, 'BONK!', '#ffeb3b');
        if (v.driver === 'cop' || v.kind === 'tank' || v.kind === 'army') this.crime(1, 'You punched a police car!');
        return;
      }
    }
  }

  fireFlamer(dt: number) {
    if (!this.owned.has('flamer') || this.vehicle || this.inVent || this.lift) return;
    const pl = this.player;
    pl.punch = 0.1;
    this.flameT -= dt;
    while (this.flameT <= 0) {
      this.flameT += 0.04;
      const a = Math.atan2(pl.fy, pl.fx) + (Math.random() - 0.5) * 0.45;
      this.scene.shots.push({
        kind: 'flame',
        x: pl.x + pl.fx * 0.4,
        y: pl.y + pl.fy * 0.4,
        z: pl.z + 0.8,
        vx: Math.cos(a) * 6,
        vy: Math.sin(a) * 6,
        vz: 0.4,
        t: 0.45,
        dmg: 4,
        mine: true,
      });
    }
    if (Math.random() < dt * 6) sfx('flame');
  }

  /** A player's flame touching someone: cartoon "HOT!", no gore. */
  flameHit(s: Shot) {
    for (const p of this.scene.people) {
      if (p === this.player || p.ko > 0 || p.gone || dist(p, s) > 0.5) continue;
      p.hp -= s.dmg;
      p.hit = 0.12;
      s.t = 0;
      if (p.burn <= 0) {
        p.burn = 0.7;
        this.fx('text', p.x, p.y, 1.8 + p.z, pick(['HOT!', 'YOW!', 'TOASTY!', 'OUCH!']), '#ffab40');
        // same reactions as getting punched, without the knockback
        const hp = p.hp;
        this.hitPerson(p, 0, p.x, p.y, true, true);
        p.hp = hp;
      }
      if (p.hp <= 0) this.knockOut(p);
      return;
    }
    for (const v of this.scene.vehicles) {
      if (v.gone || v.kind === 'ship' || v.driver === 'player') continue;
      if (inRect(v, s.x, s.y, 0.1)) {
        this.hitVehicle(v, s.dmg * 0.6);
        s.t = 0;
        if (v.driver === 'cop' || v.kind === 'tank' || v.kind === 'army') this.crime(1, 'You torched a police car!');
        return;
      }
    }
  }

  hitPerson(p: Person, dmg: number, fromX: number, fromY: number, byPlayer: boolean, quiet = false) {
    p.hp -= dmg;
    p.hit = 0.25;
    if (!quiet) {
      const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
      p.kx = ((p.x - fromX) / d) * 4;
      p.ky = ((p.y - fromY) / d) * 4;
      this.fx('text', p.x, p.y, 1.6 + p.z, pick(['POW!', 'BAM!', 'WHAM!', 'BOP!']), '#ffeb3b');
      sfx('punch');
    }
    if (p.sleeping) {
      p.sleeping = false;
      this.alarm = true;
    }
    if (byPlayer) {
      switch (p.kind) {
        case 'ped':
        case 'driver':
          p.flee = 5;
          if (Math.random() < 0.5) this.say(p, pick(['Ow!', 'Help!', 'Hey!', 'Rude!']));
          this.crime(1, 'A cop saw that!');
          break;
        case 'bully':
          p.hostile = true;
          break;
        case 'cop':
          this.crime(1, 'You punched a cop!');
          p.hostile = true;
          break;
        case 'guard':
          this.alarm = true;
          break;
        case 'captain':
        case 'sailor':
          for (const q of this.city.people) if (q.onShip) q.hostile = true;
          break;
      }
    }
    if (p.hp <= 0) this.knockOut(p);
  }

  knockOut(p: Person) {
    p.ko = p.kind === 'ped' || p.kind === 'bully' || p.kind === 'driver' ? 7 : 5;
    p.hostile = false;
    p.say = '';
    this.fx('text', p.x, p.y, 2, 'KO!', '#ff8a65', 1.1, 1.3);
    if ((p.kind === 'ped' || p.kind === 'bully') && Math.random() < 0.6) {
      const cash = 5 + Math.floor(Math.random() * (p.kind === 'bully' ? 60 : 25));
      this.money += cash;
      this.fx('text', p.x, p.y, 2.6, `+$${cash}`, '#a5d6a7', 1.2);
      sfx('coin');
    }
    if (p.kind === 'captain') {
      this.captainDown = true;
      this.crime(2, 'You beat the captain!', true);
      this.banner('The ship is yours! Go to the wheel at the back.', '#80deea');
      for (const q of this.city.people)
        if (q.onShip && q !== p && q.ko === 0) {
          this.say(q, 'Abandon ship!');
          q.hostile = false;
          q.flee = 1.2;
        }
    }
  }

  hitVehicle(v: Vehicle, dmg: number) {
    if (v.kind === 'ship' || v.broken > 0) return;
    v.hp -= dmg;
    v.hit = 0.2;
    if (v.hp <= 0) {
      v.broken = 1;
      v.speed = 0;
      this.fx('boom', v.x, v.y, 0.5, '', '#ffb74d', 0.8, 1.4);
      this.fx('text', v.x, v.y, 1.6, v.kind === 'tank' ? 'TANK DOWN!' : 'CLUNK!', '#ffcc80', 1.2, 1.2);
      sfx('boom');
      if (this.vehicle === v) {
        this.exitVehicle();
        this.banner('Your ride broke down!', '#ffab91');
      }
      if (v.driver === 'cop' || v.driver === 'army') {
        v.driver = 'none';
        v.leaving = false;
      }
      if (v === this.myCar) this.banner('Your car broke. Call a new one from your phone.', '#ffcc80');
    }
  }

  damagePlayer(dmg: number, big = true) {
    if (this.overlay) return;
    const v = this.vehicle;
    if (v && v.kind !== 'ship') {
      this.hitVehicle(v, dmg);
      return;
    }
    if (big) {
      if (this.invuln > 0) return;
      this.invuln = 0.45;
    }
    this.player.hp -= dmg;
    this.player.hit = 0.25;
    this.regen = 0;
    if (big) sfx('hurt');
    if (this.player.hp <= 0) this.playerDown();
  }

  playerDown() {
    const busted = this.wanted > 0 || this.scene === this.bank;
    const lose = Math.floor(this.money * (busted ? 0.5 : 0.1));
    this.money -= lose;
    this.overlay = {
      title: busted ? 'BUSTED!' : 'KNOCKED OUT!',
      sub: lose > 0 ? `You dropped $${lose}. Back home you go.` : 'Back home you go.',
      t: 3,
    };
    sfx('busted');
    if (this.vehicle) this.exitVehicle();
    this.vehicle = null;
    this.lift = null;
    this.inVent = false;
    this.scene = this.city;
    const s = this.city.map.spawns.player[0];
    this.player.x = s.x;
    this.player.y = s.y;
    this.player.hp = this.player.maxHp;
    this.player.ko = 0;
    this.clearWanted();
    this.city.people = this.city.people.filter((p) => !['cop', 'grenider', 'heater', 'lazor'].includes(p.kind) || dist(p, s) > 20);
    this.city.vehicles = this.city.vehicles.filter((v) => !(v.driver === 'cop' || v.driver === 'army' || (v.kind === 'tank' && v.broken === 0)));
    this.city.shots = [];
    this.onSave?.();
  }

  enterBank(doorX: number, doorY: number) {
    // banks have two door tiles side by side; name the bank by its left one
    const m = this.city.map;
    const left = m.places.get(idx(m, doorX - 1, doorY)) === 'bank' ? doorX - 1 : doorX;
    this.bankId = `${left},${doorY}`;
    this.bankReturn = { x: left + 1, y: doorY + 1.5 };
    this.bank = { map: buildBank(), people: [], vehicles: [], shots: [], fx: [] };
    for (const g of this.bank.map.spawns.guards) {
      const p = makePerson('guard', g.x, g.y);
      this.bank.people.push(p);
    }
    for (const g of this.bank.map.spawns.sleepers) {
      const p = makePerson('guard', g.x, g.y);
      p.sleeping = true;
      this.bank.people.push(p);
    }
    this.alarm = false;
    this.inVent = false;
    this.scene = this.bank;
    const e = this.bank.map.spawns.entry[0];
    this.player.x = e.x;
    this.player.y = e.y;
    this.cam = { x: e.x, y: e.y };
    sfx('door');
    this.banner(this.vaultT > 0 ? 'The vault is empty right now. Come back later.' : 'Find a way to the vault without the guards seeing you.', '#fff59d');
  }

  leaveBank() {
    this.scene = this.city;
    this.inVent = false;
    const e = this.bankReturn;
    this.player.x = e.x;
    this.player.y = e.y;
    this.cam = { x: e.x, y: e.y };
    sfx('door');
    if (this.wanted > 0) for (let i = 0; i < 2; i++) this.spawnCop();
  }

  robVault() {
    this.money += VAULT_CASH;
    this.vaultT = VAULT_REFILL;
    this.alarm = true;
    this.fx('text', this.player.x, this.player.y, 2.4, `+$${VAULT_CASH}`, '#a5d6a7', 1.6, 1.5);
    this.banner(`You grabbed $${VAULT_CASH}! The alarm is ringing!`, '#a5d6a7');
    sfx('cash');
    sfx('alarm');
    this.crime(3, 'Bank robbed!', true);
    this.onSave?.();
  }

  // ---------- hints / use ----------

  computeHint(): Hint | null {
    const pl = this.player;
    const m = this.scene.map;
    if (this.lift) return null;
    const v = this.vehicle;
    if (v) {
      if (v.kind === 'ship') return { text: 'Steer the ship on the water', label: 'Leave wheel', act: () => this.exitVehicle() };
      return { text: '', label: 'Get out', act: () => this.exitVehicle() };
    }
    const tx = Math.floor(pl.x);
    const ty = Math.floor(pl.y);
    // nearby tiles
    let near: { t: number; x: number; y: number; d: number } | null = null;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        const t = tileAt(m, x, y);
        if (t === T.Door || t === T.Grate || t === T.Locked || t === T.Vault) {
          const d = Math.hypot(x + 0.5 - pl.x, y + 0.5 - pl.y);
          const prio = t === T.Grate ? -0.2 : 0;
          if (d < 1.25 && (!near || d + prio < near.d)) near = { t, x, y, d: d + prio };
        }
      }
    if (this.inVent) {
      if (tileAt(m, pl.x, pl.y) === T.Grate)
        return { text: 'You are hiding in the vent', label: 'Climb out', act: () => this.toggleVent() };
      return { text: 'Crawling through the vent. The guards cannot see you.', label: '', act: null };
    }
    if (near) {
      const i = idx(m, near.x, near.y);
      if (near.t === T.Door) {
        const place = m.places.get(i);
        if (place === 'bank') return { text: 'The Bank', label: 'Go in', act: () => this.enterBank(near.x, near.y) };
        if (place === 'exit') return { text: 'Leave the bank', label: 'Go out', act: () => this.leaveBank() };
        if (place === 'shop') return { text: 'Tools, disguises and upgrades', label: 'Shop', act: () => (this.menu = 'shop') };
        if (place === 'lot') return { text: 'Rent or buy a car', label: 'Car lot', act: () => (this.menu = 'lot') };
        if (place === 'home')
          return {
            text: 'Home sweet home',
            label: 'Rest',
            act: () => {
              if (this.wanted > 0) this.banner("Can't rest with cops after you!", '#ffab91');
              else {
                this.player.hp = this.player.maxHp;
                this.banner('All rested up!', '#a5d6a7');
              }
            },
          };
      }
      if (near.t === T.Grate) {
        if (!this.hasTool) return { text: 'A vent. You need a screwdriver or wrench (from the Shop).', label: '', act: null };
        return { text: 'A vent grate', label: 'Into vent', act: () => this.toggleVent() };
      }
      if (near.t === T.Locked) {
        if (!this.hasTool) return { text: 'Locked! You need a screwdriver or wrench.', label: '', act: null };
        return {
          text: 'A locked door',
          label: 'Unlock',
          act: () => {
            m.tiles[i] = T.Floor;
            m.heights[i] = 0;
            m.restricted[i] = 1;
            sfx('unlock');
            if (this.scene.people.some((g) => g.kind === 'guard' && !g.sleeping && g.ko === 0 && dist(g, pl) < 7)) {
              this.alarm = true;
              this.banner('A guard saw you!', '#ffab91');
            }
          },
        };
      }
      if (near.t === T.Vault) {
        if (this.vaultT > 0) return { text: `The vault is empty. It refills in ${Math.ceil(this.vaultT / 60)} min.`, label: '', act: null };
        return { text: 'The VAULT!', label: 'Steal!', act: () => this.robVault() };
      }
    }
    // ship wheel
    if (this.scene === this.city && dist(pl, this.helmPos()) < 1.3) {
      if (!this.captainDown) return { text: 'Defeat the captain to take the ship!', label: '', act: null };
      return { text: 'The ship wheel', label: 'Drive ship', act: () => this.enterVehicle(this.ship) };
    }
    // vehicles
    let car: Vehicle | null = null;
    let carD = 1.9;
    for (const v of this.scene.vehicles) {
      if (v.gone || v.kind === 'ship' || v.kind === 'tank' || v.broken > 0) continue;
      if (v.driver === 'cop' || v.driver === 'army') continue;
      const d = inRect(v, pl.x, pl.y, 0.9) ? 0.5 : dist(v, pl);
      if (d < carD) {
        car = v;
        carD = d;
      }
    }
    if (car) {
      const c = car;
      if (c.driver === 'ai') return { text: 'Pick up the driver and take the car', label: 'Steal car', act: () => this.grabDriver(c) };
      if (c.lot)
        return {
          text: 'A car for sale',
          label: 'Steal car',
          act: () => {
            c.lot = false;
            this.crime(1, 'You stole from the car lot!');
            this.enterVehicle(c);
          },
        };
      return { text: c.rental > 0 ? `Rental: ${Math.ceil(c.rental)}s left` : c.mine ? 'Your car' : '', label: 'Get in', act: () => this.enterVehicle(c) };
    }
    return null;
  }

  toggleVent() {
    const pl = this.player;
    if (!this.inVent) {
      const g = this.findTile(T.Grate, pl.x, pl.y, 1.4);
      if (!g) return;
      pl.x = g.x + 0.5;
      pl.y = g.y + 0.5;
      this.inVent = true;
      sfx('vent');
    } else {
      this.inVent = false;
      sfx('vent');
    }
  }

  findTile(t: number, x: number, y: number, r: number) {
    const m = this.scene.map;
    let best: { x: number; y: number } | null = null;
    let bd = r;
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (tileAt(m, tx, ty) !== t) continue;
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d < bd) {
          bd = d;
          best = { x: tx, y: ty };
        }
      }
    return best;
  }

  // ---------- update ----------

  update(dt: number, input: Input) {
    if (this.menu) return;
    if (this.overlay) {
      this.overlay.t -= dt;
      if (this.overlay.t <= 0) this.overlay = null;
      return;
    }
    this.time += dt;
    this.crimeCd = Math.max(0, this.crimeCd - dt);
    this.disguiseCd = Math.max(0, this.disguiseCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    for (const k in this.vaults) this.vaults[k] = Math.max(0, this.vaults[k] - dt);
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter((b) => b.t > 0);

    const lvl = copLevel(this.time);
    if (lvl > this.shownLevel) {
      this.shownLevel = lvl;
      this.banner(`10 more minutes! Cops are now 25% tougher (level ${lvl}).`, '#90caf9');
      sfx('siren');
    }

    this.updatePlayer(dt, input);
    for (const p of this.scene.people) this.updatePerson(p, dt);
    for (const v of this.scene.vehicles) this.updateVehicle(v, dt);
    this.updateShots(dt);
    this.updateFx(dt);
    this.runOvers();
    if (this.scene === this.city) this.spawner(dt);
    this.scene.people = this.scene.people.filter((p) => !p.gone);
    this.scene.vehicles = this.scene.vehicles.filter((v) => !v.gone);

    // regenerate health slowly
    this.regen += dt;
    if (this.regen > 5) this.player.hp = Math.min(this.player.maxHp, this.player.hp + dt * 4);

    // wanted cools down when no one is close
    if (this.wanted > 0 && this.scene === this.city) {
      if (this.hostilesNear(13) === 0) this.calm += dt;
      else this.calm = Math.max(0, this.calm - dt * 0.5);
      if (this.calm > 18) {
        this.wanted--;
        this.calm = 0;
        if (this.wanted === 0) {
          this.clearWanted();
          this.banner('You got away!', '#a5d6a7');
        } else this.banner(`Laying low... ${'★'.repeat(this.wanted)}`, '#fff59d');
      }
    }

    this.hint = this.computeHint();
    if (input.use && this.hint?.act) this.hint.act();

    const c = this.vehicle ?? this.player;
    const k = Math.min(1, dt * 6);
    this.cam.x += (c.x - this.cam.x) * k;
    this.cam.y += (c.y - this.cam.y) * k;
  }

  updatePlayer(dt: number, input: Input) {
    const pl = this.player;
    pl.attackCd = Math.max(0, pl.attackCd - dt);
    pl.punch = Math.max(0, pl.punch - dt);
    pl.hit = Math.max(0, pl.hit - dt);
    if (this.lift) {
      const L = this.lift;
      L.t -= dt;
      L.driver.x = pl.x;
      L.driver.y = pl.y;
      L.driver.z = 1.15;
      if (L.t <= 0) {
        // put the driver down beside you, then hop in
        const side = local(L.car, 0, -L.car.wid / 2 - 0.9);
        const d = L.driver;
        d.x = side.x;
        d.y = side.y;
        if (!this.canWalk(d, d.x, d.y)) {
          d.x = pl.x;
          d.y = pl.y;
        }
        d.z = 0;
        d.flee = 4;
        this.say(d, pick(DRIVER_LINES));
        this.lift = null;
        this.enterVehicle(L.car);
      }
      return;
    }
    if (this.vehicle) {
      this.drive(this.vehicle, dt, input);
      if (this.vehicle) {
        if (this.vehicle.kind === 'ship') {
          const h = this.helmPos();
          pl.x = h.x;
          pl.y = h.y;
          pl.z = this.ship.hgt;
        } else {
          pl.x = this.vehicle.x;
          pl.y = this.vehicle.y;
        }
      }
      return;
    }
    if (input.punch) this.punch();
    if (input.fire) this.fireFlamer(dt);
    if (input.mag > 0.1) {
      const sp = pl.speed * (this.inVent ? 0.6 : 1) * Math.min(1, input.mag);
      this.movePerson(pl, input.mx * sp * dt, input.my * sp * dt);
      pl.fx = input.mx;
      pl.fy = input.my;
      pl.walk += dt * sp * 3;
      pl.moving = true;
    } else pl.moving = false;
    // height: on top of vents, or on the ship's deck
    const t = tileAt(this.scene.map, pl.x, pl.y);
    if (this.inVent) pl.z = t === T.Vent ? 1.3 : 0.5;
    else pl.z = this.scene === this.city && inRect(this.ship, pl.x, pl.y) ? this.ship.hgt : 0;
  }

  drive(v: Vehicle, dt: number, input: Input) {
    if (v.rental > 0) {
      v.rental -= dt;
      if (v.rental <= 0) {
        this.banner('Rental time is up! The car goes back to the lot.', '#ffcc80');
        this.exitVehicle();
        v.gone = true;
        return;
      }
    }
    const max = maxSpeed(v);
    if (input.mag > 0.1) {
      const target = Math.atan2(input.my, input.mx);
      const diff = angDiff(v.angle, target);
      const turn = (v.kind === 'ship' ? 1.4 : 3.4) * dt * clamp(Math.abs(v.speed) / 3 + 0.3, 0.3, 1);
      v.angle += clamp(diff, -turn, turn);
      const want = Math.abs(diff) < 1.6 ? max * Math.min(1, input.mag) : 1.5;
      v.speed += clamp(want - v.speed, -14 * dt, (v.kind === 'ship' ? 2.5 : 9) * dt);
    } else {
      v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 7 * dt);
    }
    this.moveVehicle(v, dt, true);
  }

  moveVehicle(v: Vehicle, dt: number, isPlayer: boolean) {
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (!this.canDrive(v, nx, ny, v.angle)) {
      if (isPlayer && Math.abs(v.speed) > 5) {
        this.fx('text', nx, ny, 1, 'CRASH!', '#ffcc80');
        sfx('crash');
        this.hitVehicle(v, Math.abs(v.speed) * 1.2);
      }
      v.speed = -v.speed * 0.25;
      v.stuck += dt;
      return false;
    }
    // bump into other vehicles
    for (const o of this.scene.vehicles) {
      if (o === v || o.gone || o.kind === 'ship') continue;
      const r = (Math.min(v.len, v.wid) + Math.min(o.len, o.wid)) / 2 + 0.25;
      if (Math.hypot(o.x - nx, o.y - ny) < r && Math.hypot(o.x - nx, o.y - ny) < Math.hypot(o.x - v.x, o.y - v.y)) {
        if (Math.abs(v.speed) > 4 && isPlayer) {
          this.fx('text', (o.x + nx) / 2, (o.y + ny) / 2, 1, 'CRASH!', '#ffcc80');
          sfx('crash');
          this.hitVehicle(o, Math.abs(v.speed) * 3);
          this.hitVehicle(v, Math.abs(v.speed) * 1.5);
          if (o.driver === 'ai') o.speed = 0;
          if (o.driver === 'cop' || o.kind === 'tank' || o.kind === 'army') this.crime(1, 'You crashed into the police!');
        }
        v.speed = -v.speed * 0.3;
        return false;
      }
    }
    v.x = nx;
    v.y = ny;
    v.stuck = 0;
    return true;
  }

  runOvers() {
    for (const v of this.scene.vehicles) {
      if (v.gone || v.kind === 'ship' || Math.abs(v.speed) < 2.2) continue;
      for (const p of this.scene.people) {
        if (p.ko > 0 || p.gone || p.onShip || p.z > 0.8) continue;
        if (!inRect(v, p.x, p.y, 0.25)) continue;
        if (p === this.player) {
          if (this.vehicle) continue;
          const big = v.kind === 'bus' || v.kind === 'army' || v.kind === 'tank';
          if (this.invuln <= 0) {
            this.fx('text', p.x, p.y, 1.6, big ? 'BONK!!' : 'BONK!', '#ff8a65', 1, 1.2);
            sfx('crash');
          }
          this.damagePlayer((big ? 22 : 12) + Math.abs(v.speed) * 1.5);
          const side = local(v, 0, 1);
          const sx = side.x - v.x;
          const sy = side.y - v.y;
          const s = (p.x - v.x) * sx + (p.y - v.y) * sy > 0 ? 1 : -1;
          p.kx = sx * s * 6;
          p.ky = sy * s * 6;
          continue;
        }
        if (v.driver === 'player') {
          this.fx('text', p.x, p.y, 1.6, 'BONK!', '#ff8a65');
          sfx('crash');
          this.hitPerson(p, 45, v.x, v.y, false);
          if (p.kind === 'ped' || p.kind === 'driver') this.crime(1, 'Watch where you drive!');
          if (p.kind === 'cop') this.crime(1, 'You bumped a cop!');
        } else if (p.kind === 'ped' || p.kind === 'bully' || p.kind === 'driver') {
          // traffic just shoves people out of the way
          const side = local(v, 0, 1);
          p.kx = (side.x - v.x) * 3;
          p.ky = (side.y - v.y) * 3;
        }
      }
    }
  }

  updatePerson(p: Person, dt: number) {
    if (p.kind === 'player') return;
    p.hit = Math.max(0, p.hit - dt);
    p.burn = Math.max(0, p.burn - dt);
    p.punch = Math.max(0, p.punch - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.sayT = Math.max(0, p.sayT - dt);
    p.sayCd = Math.max(0, p.sayCd - dt);
    if (this.lift?.driver === p) return;
    // knockback
    if (Math.abs(p.kx) + Math.abs(p.ky) > 0.05) {
      this.movePerson(p, p.kx * dt, p.ky * dt);
      p.kx *= Math.pow(0.02, dt);
      p.ky *= Math.pow(0.02, dt);
    }
    if (p.ko > 0) {
      p.ko -= dt;
      if (p.ko <= 0) {
        if (p.kind === 'ped' || p.kind === 'bully' || p.kind === 'driver') {
          p.ko = 0;
          p.hp = p.maxHp * 0.6;
          p.flee = 6;
          this.say(p, pick(['Ouch...', 'What happened?', 'My head!']));
        } else if (p.kind === 'captain') {
          // the captain gives up and swims for shore
          p.gone = true;
          this.fx('splash', p.x + 1.8, p.y, 0, 'SPLASH!', '#b3e5fc', 1);
          sfx('splash');
        } else {
          p.gone = true;
          this.fx('smoke', p.x, p.y, 0.3, '', '#ddd', 0.6);
        }
      }
      return;
    }
    if (p.onShip && p.kind === 'sailor' && this.captainDown && p.flee > 0) {
      p.flee -= dt;
      if (p.flee <= 0) {
        p.gone = true;
        this.fx('splash', p.x + 1.5, p.y, 0, 'SPLASH!', '#b3e5fc', 1);
        sfx('splash');
      }
      return;
    }
    const pl = this.player;
    const target = this.vehicle ?? pl;
    const dP = dist(p, target);
    let mx = 0;
    let my = 0;
    let speed = p.speed;
    const toward = (tx: number, ty: number) => {
      const d = Math.hypot(tx - p.x, ty - p.y) || 1;
      mx = (tx - p.x) / d;
      my = (ty - p.y) / d;
    };
    const away = (tx: number, ty: number) => {
      toward(tx, ty);
      mx = -mx;
      my = -my;
    };
    const meleeRange = this.vehicle ? Math.max(this.vehicle.wid, 1) * 0.7 + 0.4 : 0.85;
    const melee = (dmg: number, cd: number) => {
      if (dP < meleeRange) {
        mx = my = 0;
        if (p.attackCd <= 0) {
          p.attackCd = cd;
          p.punch = 0.2;
          if (this.vehicle) {
            if (this.vehicle.kind !== 'ship') {
              this.hitVehicle(this.vehicle, dmg);
              this.fx('text', target.x, target.y, 1.2, 'BONK!', '#ffeb3b');
            }
          } else if (!this.inVent) {
            this.fx('text', pl.x, pl.y, 1.8, pick(['POW!', 'OOF!', 'BAM!']), '#ff8a65');
            this.damagePlayer(dmg);
            const d = dP || 1;
            pl.kx = ((pl.x - p.x) / d) * 3;
            pl.ky = ((pl.y - p.y) / d) * 3;
            sfx('punch');
          }
        }
      }
    };

    switch (p.kind) {
      case 'ped':
      case 'driver':
      case 'bully': {
        if (p.flee > 0) {
          p.flee -= dt;
          away(pl.x, pl.y);
          speed = 3;
          break;
        }
        if (p.kind === 'bully' && !this.vehicle && !this.inVent) {
          if (!p.hostile && dP < 3.5 && this.scene === this.city) {
            p.hostile = true;
            this.say(p, pick(BULLY_LINES));
          }
          if (p.hostile) {
            if (dP > 11) p.hostile = false;
            toward(pl.x, pl.y);
            melee(6, 1.0);
            break;
          }
        } else if (p.kind === 'bully') p.hostile = false;
        if (dP < 2.3 && !this.vehicle && p.sayCd <= 0 && p.kind !== 'bully') {
          this.say(p, pick(HELLO_LINES));
          p.sayCd = 10 + Math.random() * 8;
        }
        this.wander(p, dt, 5);
        return;
      }
      case 'cop': {
        if (!p.hostile || this.wanted === 0) {
          p.hostile = false;
          p.chase = 0;
          p.tired = false;
          if (dP < 2.3 && !this.vehicle && p.sayCd <= 0) {
            this.say(p, pick(['Evening.', 'Stay out of trouble!', 'Nice day for a walk.', 'Hello, citizen.']));
            p.sayCd = 12;
          }
          this.wander(p, dt, 6);
          if (dP > 26) p.gone = true;
          return;
        }
        p.chase += dt;
        if (!p.tired && p.chase > 22) {
          p.tired = true;
          this.say(p, TIRED_LINES[0], 3);
        }
        if (p.tired) {
          speed *= 0.42;
          if (p.sayCd <= 0) {
            this.say(p, pick(TIRED_LINES), 2.5);
            p.sayCd = 5;
          }
          if (p.chase > 45) {
            p.tired = false;
            p.chase = 0;
            this.say(p, 'Okay, I got my breath back!');
          }
        } else if (p.sayCd <= 0 && dP < 9) {
          this.say(p, pick(COP_LINES));
          p.sayCd = 6 + Math.random() * 5;
        }
        if (this.inVent || this.scene !== this.city) {
          mx = my = 0;
          break;
        }
        toward(target.x, target.y);
        melee(8 * p.mult, 1.1);
        break;
      }
      case 'guard': {
        if (p.sleeping) {
          if (this.alarm) {
            p.sleeping = false;
            this.say(p, 'Huh?! Wha?!');
          }
          return;
        }
        if (!this.alarm && !this.inVent && dP < 4.2) {
          const ti = idx(this.scene.map, Math.floor(pl.x), Math.floor(pl.y));
          if (this.scene.map.restricted[ti]) {
            this.alarm = true;
            this.banner('A guard spotted you! Use the vents to sneak.', '#ffab91');
            sfx('alarm');
          } else if (p.sayCd <= 0 && dP < 2.5) {
            this.say(p, pick(GUARD_IDLE));
            p.sayCd = 9;
          }
        }
        if (this.alarm) {
          if (this.inVent) {
            if (p.sayCd <= 0) {
              this.say(p, pick(LOST_LINES));
              p.sayCd = 6;
            }
            this.wander(p, dt, 2);
            return;
          }
          if (p.sayCd <= 0) {
            this.say(p, pick(['Stop, thief!', 'Halt!', 'Get back here!']));
            p.sayCd = 6;
          }
          toward(pl.x, pl.y);
          melee(9, 1.1);
          break;
        }
        this.wander(p, dt, 3);
        return;
      }
      case 'captain':
      case 'sailor': {
        const onDeck = this.scene === this.city && !this.vehicle && inRect(this.ship, pl.x, pl.y, 0.3);
        if (onDeck && !p.hostile) {
          p.hostile = true;
          this.say(p, p.kind === 'captain' ? pick(CAPTAIN_LINES) : 'Intruder!');
        }
        if (!onDeck) p.hostile = false;
        if (p.hostile) {
          if (p.kind === 'captain' && p.sayCd <= 0) {
            this.say(p, pick(CAPTAIN_LINES));
            p.sayCd = 5;
          }
          toward(pl.x, pl.y);
          melee(p.kind === 'captain' ? 14 : 7, p.kind === 'captain' ? 1.2 : 1);
        } else {
          this.wander(p, dt, 1.5);
          return;
        }
        break;
      }
      case 'grenider':
      case 'heater':
      case 'lazor': {
        if (!p.hostile || this.wanted === 0) {
          this.wander(p, dt, 6);
          if (dP > 22) p.gone = true;
          return;
        }
        if (p.sayCd <= 0 && dP < 12) {
          this.say(p, pick(TROOP_LINES));
          p.sayCd = 9 + Math.random() * 6;
        }
        const want = p.kind === 'grenider' ? 5 : p.kind === 'lazor' ? 6 : 1.6;
        if (dP > want + 0.5) toward(target.x, target.y);
        else if (dP < want - 1.5) away(target.x, target.y);
        p.fx = (target.x - p.x) / (dP || 1);
        p.fy = (target.y - p.y) / (dP || 1);
        if (p.attackCd <= 0 && dP < want + 2.5 && !this.inVent) {
          this.troopAttack(p, target);
        }
        break;
      }
    }
    if (mx !== 0 || my !== 0) this.stepToward(p, mx, my, speed, dt);
    else p.moving = false;
  }

  troopAttack(p: Person, target: { x: number; y: number }) {
    const m = p.mult;
    const d = dist(p, target) || 1;
    const dx = (target.x - p.x) / d;
    const dy = (target.y - p.y) / d;
    if (p.kind === 'grenider') {
      p.attackCd = 2.6;
      const flight = 1.1;
      this.scene.shots.push({
        kind: 'grenade',
        x: p.x,
        y: p.y,
        z: 1,
        vx: (target.x - p.x) / flight,
        vy: (target.y - p.y) / flight,
        vz: 5.5,
        t: 3,
        dmg: 18 * m,
      });
      sfx('throw');
    } else if (p.kind === 'lazor') {
      p.attackCd = 1.3;
      this.scene.shots.push({ kind: 'laser', x: p.x + dx * 0.4, y: p.y + dy * 0.4, z: 0.9, vx: dx * 11, vy: dy * 11, vz: 0, t: 1.2, dmg: 9 * m });
      sfx('laser');
    } else {
      p.attackCd = 0.08;
      if (d < 3) {
        const spread = (Math.random() - 0.5) * 0.5;
        const a = Math.atan2(dy, dx) + spread;
        this.scene.shots.push({ kind: 'flame', x: p.x + dx * 0.4, y: p.y + dy * 0.4, z: 0.8, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, vz: 0.5, t: 0.45, dmg: 1.4 * m });
        if (Math.random() < 0.1) sfx('flame');
      }
    }
  }

  stepToward(p: Person, mx: number, my: number, speed: number, dt: number) {
    if (p.detour) {
      p.detour.t -= dt;
      mx = p.detour.x;
      my = p.detour.y;
      if (p.detour.t <= 0) p.detour = null;
    }
    const ok = this.movePerson(p, mx * speed * dt, my * speed * dt);
    p.fx = mx;
    p.fy = my;
    p.walk += dt * speed * 3;
    p.moving = true;
    if (!ok) {
      p.stuck += dt;
      if (p.stuck > 0.5 && !p.detour) {
        const s = Math.random() < 0.5 ? 1 : -1;
        p.detour = { x: -my * s, y: mx * s, t: 0.8 + Math.random() };
        p.stuck = 0;
      }
    } else p.stuck = Math.max(0, p.stuck - dt);
  }

  wander(p: Person, dt: number, range: number) {
    const m = this.scene.map;
    if (!p.target || dist(p, p.target) < 0.3 || p.stuck > 1) {
      p.stuck = 0;
      for (let i = 0; i < 10; i++) {
        const x = p.home.x + (Math.random() - 0.5) * range * 2;
        const y = p.home.y + (Math.random() - 0.5) * range * 2;
        const t = tileAt(m, x, y);
        const ok =
          p.onShip
            ? inRect(this.ship, x, y, -0.4)
            : this.scene === this.city
              ? t === T.Sidewalk || t === T.Plaza || (t === T.Grass && p.kind !== 'ped')
              : walkable(t, false);
        if (ok) {
          p.target = { x, y };
          break;
        }
      }
      if (Math.random() < 0.3) {
        p.moving = false;
        return;
      }
    }
    if (!p.target) return;
    const d = dist(p, p.target) || 1;
    const before = { x: p.x, y: p.y };
    this.movePerson(p, ((p.target.x - p.x) / d) * p.speed * 0.5 * dt * 1.6, ((p.target.y - p.y) / d) * p.speed * 0.5 * dt * 1.6);
    if (before.x === p.x && before.y === p.y) p.stuck += dt;
    p.fx = (p.target.x - p.x) / d;
    p.fy = (p.target.y - p.y) / d;
    p.walk += dt * 3;
    p.moving = true;
    // peds slowly drift their home along with them
    if (!p.onShip && this.scene === this.city) {
      p.home.x += (p.x - p.home.x) * dt * 0.05;
      p.home.y += (p.y - p.home.y) * dt * 0.05;
    }
  }

  updateVehicle(v: Vehicle, dt: number) {
    v.hit = Math.max(0, v.hit - dt);
    if (v.broken > 0) {
      v.broken += dt;
      v.speed = 0;
      if (Math.random() < dt * 3) this.fx('smoke', v.x, v.y, v.hgt + 0.3, '', '#9e9e9e', 1.2);
      if (v.broken > 25 && dist(v, this.player) > 14) v.gone = true;
      return;
    }
    if (v.driver === 'player') return;
    if (v.driver === 'ai') this.trafficAI(v, dt);
    else if (v.driver === 'cop' || v.driver === 'army') this.chaseAI(v, dt);
    else {
      v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
      if (Math.abs(v.speed) > 0.05) this.moveVehicle(v, dt, false);
      if (v.rental > 0) {
        v.rental -= dt;
        if (v.rental <= 0) v.gone = true;
      }
    }
  }

  trafficAI(v: Vehicle, dt: number) {
    const horiz = v.dir.x !== 0;
    const cruise = v.kind === 'bus' ? 3.6 : 5;
    // brake for vehicles ahead
    let blocked = false;
    for (const o of this.scene.vehicles) {
      if (o === v || o.gone) continue;
      const rx = o.x - v.x;
      const ry = o.y - v.y;
      const ahead = rx * v.dir.x + ry * v.dir.y;
      const side = Math.abs(rx * v.dir.y - ry * v.dir.x);
      if (ahead > 0 && ahead < (v.len + o.len) / 2 + 1.2 && side < 1.0) blocked = true;
    }
    const want = blocked ? 0 : cruise;
    v.speed += clamp(want - v.speed, -12 * dt, 4 * dt);
    const prevAlong = horiz ? v.x : v.y;
    v.x += v.dir.x * v.speed * dt;
    v.y += v.dir.y * v.speed * dt;
    // ease into the lane
    if (horiz) v.y += clamp(v.lane - v.y, -3 * dt, 3 * dt);
    else v.x += clamp(v.lane - v.x, -3 * dt, 3 * dt);
    const along = horiz ? v.x : v.y;
    const sign = horiz ? v.dir.x : v.dir.y;
    const crossBase = ROAD_BASES.reduce((best, rb) => (Math.abs(rb + 1 - v.lane) < Math.abs(best + 1 - v.lane) ? rb : best), ROAD_BASES[0]);
    for (const b of ROAD_BASES) {
      const c = b + 1;
      if (prevAlong === along || (prevAlong - c) * (along - c) > 0) continue;
      const bx = horiz ? b : crossBase;
      const by = horiz ? crossBase : b;
      const key = bx * 100 + by;
      if (v.inter === key) break;
      v.inter = key;
      const can = (dx: number, dy: number) =>
        !((dx > 0 && bx >= ROAD_LAST) || (dx < 0 && bx <= ROAD_FIRST) || (dy > 0 && by >= ROAD_LAST) || (dy < 0 && by <= ROAD_FIRST));
      const straight = horiz ? { x: sign, y: 0 } : { x: 0, y: sign };
      const left = { x: straight.y, y: -straight.x };
      const right = { x: -straight.y, y: straight.x };
      const opts: { x: number; y: number }[] = [];
      if (can(straight.x, straight.y)) opts.push(straight, straight);
      if (can(left.x, left.y)) opts.push(left);
      if (can(right.x, right.y)) opts.push(right);
      if (opts.length === 0) opts.push(straight);
      const nd = pick(opts);
      if (nd !== straight) {
        v.dir = nd;
        if (horiz) {
          v.lane = b + (nd.y > 0 ? 0.5 : 1.5);
          v.x = c;
        } else {
          v.lane = b + (nd.x > 0 ? 1.5 : 0.5);
          v.y = c;
        }
      }
      break;
    }
    const ta = Math.atan2(v.dir.y, v.dir.x);
    v.angle += clamp(angDiff(v.angle, ta), -6 * dt, 6 * dt);
    if (dist(v, this.player) > 34) v.gone = true;
  }

  chaseAI(v: Vehicle, dt: number) {
    const target = this.vehicle ?? this.player;
    const d = dist(v, target);
    if (this.scene !== this.city) return;
    if (v.leaving || this.wanted === 0) {
      v.leaving = true;
      const a = Math.atan2(v.y - target.y, v.x - target.x);
      v.angle += clamp(angDiff(v.angle, a), -2 * dt, 2 * dt);
      v.speed += clamp(6 - v.speed, -10 * dt, 5 * dt);
      if (!this.moveVehicle(v, dt, false)) v.angle += 1.5 * dt;
      if (d > 26) v.gone = true;
      return;
    }
    if (v.kind === 'tank') {
      v.turret += clamp(angDiff(v.turret, Math.atan2(target.y - v.y, target.x - v.x)), -1.5 * dt, 1.5 * dt);
      v.fireCd -= dt;
      if (v.fireCd <= 0 && d < 11 && !this.inVent) {
        v.fireCd = 3.6 / Math.min(this.mult, 1.6);
        const mz = local({ ...v, angle: v.turret }, v.len * 0.7, 0);
        this.scene.shots.push({
          kind: 'shell',
          x: mz.x,
          y: mz.y,
          z: 0.9,
          vx: Math.cos(v.turret) * 8,
          vy: Math.sin(v.turret) * 8,
          vz: 0,
          t: d / 8 + 0.1,
          dmg: 25 * this.mult,
        });
        sfx('cannon');
      }
    }
    const stopAt = v.kind === 'army' ? 7 : v.kind === 'tank' ? 6 : this.vehicle ? 0 : 2.5;
    if (v.backT > 0) {
      v.backT -= dt;
      v.speed = -3;
      v.angle += 1.8 * dt;
      this.moveVehicle(v, dt, false);
      return;
    }
    const a = Math.atan2(target.y - v.y, target.x - v.x);
    v.angle += clamp(angDiff(v.angle, a), -2.4 * dt, 2.4 * dt);
    const tired = v.kind === 'cop' && this.time % 60 > 45; // cop cars ease off now and then
    const want = d > stopAt ? maxSpeed(v) * (v.kind === 'cop' ? Math.min(this.mult, 1.3) * (tired ? 0.55 : 0.8) : 0.7) : 0;
    v.speed += clamp(want - v.speed, -12 * dt, 6 * dt);
    if (!this.moveVehicle(v, dt, false) || v.stuck > 0.6) {
      v.backT = 0.7;
      v.stuck = 0;
    }
    // cop cars ram the player's car
    if (v.kind === 'cop' && this.vehicle && d < 1.8 && v.hit <= 0) {
      this.hitVehicle(this.vehicle, 10 * this.mult);
      v.hit = 1;
      this.fx('text', target.x, target.y, 1.2, 'BUMP!', '#90caf9');
      sfx('crash');
    }
    if (d <= stopAt + 0.5 && Math.abs(v.speed) < 1) {
      if (v.kind === 'cop' && !v.copOut && !this.vehicle) {
        v.copOut = true;
        const s = local(v, 0, v.wid / 2 + 0.5);
        const c = makePerson('cop', s.x, s.y, this.mult);
        c.hostile = true;
        if (this.canWalk(c, s.x, s.y)) this.city.people.push(c);
      }
      if (v.kind === 'army' && v.troops > 0) {
        v.dropT -= dt;
        if (v.dropT <= 0) {
          v.dropT = 0.45;
          v.troops--;
          const s = local(v, -v.len / 2 + 0.4 + Math.random(), v.wid / 2 + 0.5);
          const kind = pick(['grenider', 'heater', 'lazor'] as const);
          const t = makePerson(kind, s.x, s.y, this.mult);
          t.hostile = true;
          if (this.canWalk(t, s.x, s.y)) this.city.people.push(t);
          if (v.troops === 0) v.leaving = true;
        }
      }
    }
  }

  updateShots(dt: number) {
    const pl = this.player;
    const target = this.vehicle ?? pl;
    const m = this.scene.map;
    for (const s of this.scene.shots) {
      s.t -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.mine) {
        if (!walkable(tileAt(m, s.x, s.y), false) && tileAt(m, s.x, s.y) !== T.Water) s.t = 0;
        else this.flameHit(s);
        continue;
      }
      if (s.kind === 'grenade') {
        s.vz -= 12 * dt;
        s.z += s.vz * dt;
        if (s.z <= 0) {
          this.explode(s.x, s.y, 1.5, s.dmg);
          s.t = 0;
        }
        continue;
      }
      if (tileAt(m, s.x, s.y) !== T.Water && !walkable(tileAt(m, s.x, s.y), false)) {
        if (s.kind === 'shell') this.explode(s.x, s.y, 1.6, s.dmg);
        s.t = 0;
        continue;
      }
      const hitR = this.vehicle ? Math.max(this.vehicle.wid, 0.8) * 0.6 : 0.45;
      if (dist(s, target) < hitR && !this.inVent) {
        if (s.kind === 'shell') this.explode(s.x, s.y, 1.6, s.dmg);
        else {
          this.damagePlayer(s.dmg, s.kind === 'laser');
          if (s.kind === 'laser') this.fx('text', target.x, target.y, 1.5, 'ZAP!', '#80deea');
        }
        s.t = 0;
        continue;
      }
      if (s.t <= 0 && s.kind === 'shell') this.explode(s.x, s.y, 1.6, s.dmg);
    }
    this.scene.shots = this.scene.shots.filter((s) => s.t > 0);
  }

  explode(x: number, y: number, r: number, dmg: number) {
    this.fx('boom', x, y, 0.2, '', '#ffb74d', 0.7, r);
    this.fx('text', x, y, 1.4, 'BOOM!', '#ffcc80', 0.9, 1.2);
    sfx('boom');
    const target = this.vehicle ?? this.player;
    if (dist(target, { x, y }) < r + (this.vehicle ? 0.6 : 0) && !this.inVent) this.damagePlayer(dmg);
    for (const p of this.scene.people) {
      if (p === this.player || p.ko > 0) continue;
      if (dist(p, { x, y }) < r && (p.kind === 'ped' || p.kind === 'bully' || p.kind === 'driver')) {
        p.flee = 4;
        const d = dist(p, { x, y }) || 1;
        p.kx = ((p.x - x) / d) * 5;
        p.ky = ((p.y - y) / d) * 5;
      }
    }
  }

  updateFx(dt: number) {
    for (const f of this.scene.fx) f.t += dt;
    this.scene.fx = this.scene.fx.filter((f) => f.t < f.life);
  }

  spawner(dt: number) {
    const c = this.vehicle ?? this.player;
    const people = this.city.people;
    const peds = people.filter((p) => p.kind === 'ped' || p.kind === 'bully' || p.kind === 'driver');
    for (const p of peds) if (dist(p, c) > 30) p.gone = true;
    if (peds.length < 24 && Math.random() < dt * 3) this.spawnPed();

    const traffic = this.city.vehicles.filter((v) => v.driver === 'ai');
    if (traffic.length < 15 && Math.random() < dt * 2) this.spawnTraffic(Math.random() < 0.2 ? 'bus' : 'car');

    // police
    const lvl = copLevel(this.time);
    const cops = people.filter((p) => p.kind === 'cop' && p.ko === 0 && p.hostile).length;
    const copCars = this.city.vehicles.filter((v) => v.kind === 'cop' && v.driver === 'cop' && !v.leaving).length;
    const wantCops = this.wanted > 0 ? Math.min(12, Math.round(this.wanted * 1.5 * (1 + 0.25 * (lvl - 1)))) : 0;
    const wantCars = this.wanted >= 2 ? Math.min(4, this.wanted - 1) : 0;
    this.copT -= dt;
    if (this.copT <= 0) {
      this.copT = 2.5;
      // a few calm police officers walk the beat when you're not in trouble
      const patrol = people.filter((p) => p.kind === 'cop' && !p.hostile).length;
      if (this.wanted === 0 && patrol < 4) this.spawnCop(false, true);
      if (cops < wantCops) this.spawnCop();
      if (copCars < wantCars) this.spawnCop(true);
    }
    // army
    if (this.wanted >= 4) {
      this.armyT -= dt;
      const troops = people.filter((p) => (p.kind === 'grenider' || p.kind === 'heater' || p.kind === 'lazor') && p.ko === 0).length;
      if (this.armyT <= 0 && troops < 6) {
        this.armyT = 35;
        this.spawnArmy('army');
      }
    } else this.armyT = Math.min(this.armyT, 8);
    if (this.wanted >= 5) {
      this.tankT -= dt;
      const tanks = this.city.vehicles.filter((v) => v.kind === 'tank' && v.broken === 0).length;
      if (this.tankT <= 0 && tanks === 0) {
        this.tankT = 50;
        this.spawnArmy('tank');
      }
    }
  }
}
