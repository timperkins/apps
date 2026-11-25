// Robopoculeps simulation: the mine, the miner, flying robots, belts, grabbers, payers and crates.
// No DOM in here; index.ts drives it and render.ts draws it. Units are tiles.
import {
  BAG_COST, BAG_LV, GOLDEN_ROBOT, KIND_INFO, ORES, ORE_IDS, SPEED_COST, SPEED_LV, ZONES,
  type Kind, type OreId,
} from './data';

export const W = 64;
export const H = 40;
/** Wall columns between the caves; each has a boulder door. */
export const DIVIDERS = [14, 26, 38, 50];
export const DOOR_Y0 = 18;
export const DOOR_H = 4;
/** The shop is a hole in the top wall; the shopkeeper stands at (SHOP_X, 1). */
export const SHOP_X = 6;
export const SHOP_SPOT = { x: SHOP_X + 0.5, y: 2.1 };
const SPAWN = { x: SHOP_X + 0.5, y: 4.5 };

export enum Tile {
  Floor = 0,
  Wall = 1,
  Boulder = 2,
  Shop = 3,
}

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export interface Rock { x: number; y: number; ore: OreId; amt: number; max: number; claims: number }
export interface BeltItem { ore: OreId; p: number }
export interface Building {
  k: Kind;
  dir: number;
  /** crate contents */
  store: Partial<Record<OreId, number>>;
  /** belt items, front first */
  items: BeltItem[];
  /** grabber timer and swing (0..1, 1 just after a grab) */
  t: number;
  swing: number;
  held: OreId | null;
}
export type RobotKind = OreId | 'king';
export interface Robot {
  kind: RobotKind;
  x: number;
  y: number;
  state: 'seek' | 'fly' | 'mine' | 'home' | 'idle';
  rock: number; // tile index of target rock, -1 none
  carry: OreId[];
  t: number;
  phase: number;
  face: number; // -1 left / 1 right
  /** On a friend's game: where the host last had it, to glide toward. */
  tx?: number;
  ty?: number;
}
export interface Player { tx?: number; ty?: number; slot: number; x: number; y: number; dir: number; face: number; moving: boolean; walk: number; mining: number; swing: number; miningRock: number; wantMine: boolean }
export const newPlayer = (slot: number, x = SPAWN.x, y = SPAWN.y): Player =>
  ({ slot, x, y, dir: 1, face: 1, moving: false, walk: 0, mining: 0, swing: 0, miningRock: -1, wantMine: false });
/** What the host sends friends about 12 times a second: everything but the cave walls (which never change). */
export interface Snap {
  money: number; earned: number; bag: Record<OreId, number>; tools: Tools; unlocked: number; speed: number; bagLv: number; golden: boolean; time: number;
  rocks: [number, OreId, number][];
  blds: [number, Kind, number, Partial<Record<OreId, number>>, BeltItem[], number, number, OreId | null][];
  robots: [RobotKind, number, number, string, number, OreId[], number][];
  players: [number, number, number, number, number, number, number, number, number][];
  floaters: Floater[];
}
export interface Floater { x: number; y: number; text: string; color: string; t: number }
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; size: number }
export type Tools = Record<Kind, number> & { dynamite: number };

export interface SaveData {
  v: 1;
  money: number;
  bag: Record<OreId, number>;
  tools: Tools;
  unlocked: number;
  speed: number;
  bagLv: number;
  golden: boolean;
  time: number;
  earned: number;
  player: { x: number; y: number };
  rocks: [number, number, OreId, number][];
  blds: [number, Kind, number, Partial<Record<OreId, number>>, BeltItem[]][];
  robots: [RobotKind, OreId[]][];
}

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

export const zoneOf = (x: number) => {
  let z = 0;
  for (const d of DIVIDERS) if (x > d) z++;
  return z;
};
const idx = (x: number, y: number) => y * W + x;
const emptyBag = (): Record<OreId, number> => ({ stone: 0, coal: 0, iron: 0, gold: 0, diamond: 0 });
const ROCKS_PER_ZONE = 16;

export class Game {
  tiles = new Uint8Array(W * H);
  lanterns: { x: number; y: number }[] = [];
  rocks = new Map<number, Rock>();
  blds = new Map<number, Building>();
  robots: Robot[] = [];
  floaters: Floater[] = [];
  particles: Particle[] = [];
  money = 0;
  earned = 0;
  bag = emptyBag();
  tools: Tools = { belt: 0, grabber: 0, payer: 0, crate: 0, dynamite: 0 };
  unlocked = 0;
  speed = 0;
  bagLv = 0;
  golden = false;
  time = 0;
  /** You. In co-op, friends are in `others` (on a friend's game, the host is in there too). */
  player: Player = newPlayer(0);
  others: Player[] = [];
  /** Set while the miner is chipping at a rock, for the pickaxe animation. */
  get miningRock() { return this.player.miningRock; }
  regrow = [0, 0, 0, 0, 0];
  onSound: (name: string) => void = () => {};
  onMsg: (text: string) => void = () => {};
  private coinCool = 0;
  /** Floating texts already sent to friends. */
  private sent = new WeakSet<Floater>();

  constructor(save?: SaveData) {
    this.buildMap();
    if (save) this.load(save);
    else this.fresh();
  }

  // ---------- map ----------
  private buildMap() {
    const r = rng(7331);
    const t = this.tiles;
    t.fill(Tile.Floor);
    for (let x = 0; x < W; x++) {
      // bumpy cave ceiling and floor
      const top = x >= SHOP_X - 3 && x <= SHOP_X + 3 ? 1 : 1 + Math.floor(r() * 2.2);
      const bot = 1 + Math.floor(r() * 2.2);
      for (let y = 0; y < top; y++) t[idx(x, y)] = Tile.Wall;
      for (let y = H - bot; y < H; y++) t[idx(x, y)] = Tile.Wall;
    }
    for (let y = 0; y < H; y++) {
      t[idx(0, y)] = Tile.Wall;
      t[idx(W - 1, y)] = Tile.Wall;
      if (r() < 0.5) t[idx(1, y)] = Tile.Wall;
      if (r() < 0.5) t[idx(W - 2, y)] = Tile.Wall;
    }
    for (let x = SHOP_X - 2; x <= SHOP_X + 2; x++) t[idx(x, 1)] = Tile.Wall;
    t[idx(SHOP_X, 1)] = Tile.Shop;
    t[idx(SHOP_X - 1, 1)] = Tile.Shop;
    t[idx(SHOP_X + 1, 1)] = Tile.Shop;
    for (const d of DIVIDERS) {
      for (let y = 0; y < H; y++) t[idx(d, y)] = y >= DOOR_Y0 && y < DOOR_Y0 + DOOR_H ? Tile.Boulder : Tile.Wall;
    }
    // rock pillars inside each cave
    for (let z = 0; z < 5; z++) {
      const x0 = z === 0 ? 2 : DIVIDERS[z - 1] + 1;
      const x1 = z === 4 ? W - 3 : DIVIDERS[z] - 1;
      for (let n = 0; n < 7; n++) {
        const cx = x0 + 1 + Math.floor(r() * (x1 - x0 - 1));
        const cy = 4 + Math.floor(r() * (H - 9));
        if (Math.abs(cy - (DOOR_Y0 + 2)) < 4 && (cx - x0 < 3 || x1 - cx < 3)) continue;
        if (cx < SHOP_X + 5 && cy < 8) continue;
        const rad = 0.8 + r() * 1.4;
        for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
          for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
            if (x <= x0 || x >= x1 || y < 2 || y > H - 3) continue;
            if (Math.hypot(x - cx, (y - cy) * 1.2) <= rad + r() * 0.4) t[idx(x, y)] = Tile.Wall;
          }
      }
    }
    // fill any pocket you could never walk to (boulders count as open)
    const seen = new Uint8Array(W * H);
    const stack = [idx(Math.floor(SPAWN.x), Math.floor(SPAWN.y))];
    seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      for (let d = 0; d < 4; d++) {
        const j = idx(x + DX[d], y + DY[d]);
        if (!seen[j] && (t[j] === Tile.Floor || t[j] === Tile.Boulder)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    for (let i = 0; i < W * H; i++) if (t[i] === Tile.Floor && !seen[i]) t[i] = Tile.Wall;
    // lanterns on wall faces above floor
    for (let x = 3; x < W - 2; x += 5) {
      for (let y = 1; y < 6; y++) {
        if (t[idx(x, y)] === Tile.Wall && t[idx(x, y + 1)] === Tile.Floor) {
          if (Math.abs(x - SHOP_X) > 2) this.lanterns.push({ x: x + 0.5, y: y + 0.75 });
          break;
        }
      }
      for (let y = H - 2; y > H - 7; y--) {
        if (t[idx(x + 2, y)] === Tile.Wall && t[idx(x + 2, y - 1)] === Tile.Floor) {
          this.lanterns.push({ x: x + 2.5, y: y + 0.3 });
          break;
        }
      }
    }
  }

  private fresh() {
    for (let z = 0; z < 5; z++) for (let n = 0; n < ROCKS_PER_ZONE; n++) this.spawnRock(z);
    this.blds.set(idx(SHOP_X + 4, 5), this.mk('crate', 0));
  }

  private mk(k: Kind, dir: number): Building {
    return { k, dir, store: {}, items: [], t: 0, swing: 0, held: null };
  }

  tile(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return Tile.Wall;
    return this.tiles[idx(x, y)] as Tile;
  }

  solid(x: number, y: number) {
    const t = this.tile(x, y);
    return t !== Tile.Floor || this.rocks.has(idx(x, y));
  }

  private spawnRock(z: number) {
    const r = Math.random;
    const x0 = z === 0 ? 1 : DIVIDERS[z - 1] + 1;
    const x1 = z === 4 ? W - 1 : DIVIDERS[z];
    for (let tries = 0; tries < 40; tries++) {
      const x = x0 + Math.floor(r() * (x1 - x0));
      const y = 2 + Math.floor(r() * (H - 4));
      const i = idx(x, y);
      if (this.tiles[i] !== Tile.Floor || this.rocks.has(i) || this.blds.has(i)) continue;
      if (Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y) < 2.5) continue;
      if (Math.hypot(x + 0.5 - SHOP_SPOT.x, y + 0.5 - SHOP_SPOT.y) < 3.5) continue;
      if (x === x0 || x === x1 - 1) if (y >= DOOR_Y0 - 1 && y <= DOOR_Y0 + DOOR_H) continue;
      // keep at least two open sides so rocks never wall off a path
      let open = 0;
      for (let d = 0; d < 4; d++) if (!this.solid(x + DX[d], y + DY[d])) open++;
      if (open < 3) continue;
      let ore: OreId = ORE_IDS[z];
      if (z > 0 && r() < 0.35) ore = ORE_IDS[Math.floor(r() * z)];
      const max = ORES[ore].amt;
      this.rocks.set(i, { x, y, ore, amt: max, max, claims: 0 });
      return;
    }
  }

  // ---------- money ----------
  spend(n: number) {
    if (this.money < n) return false;
    this.money -= n;
    return true;
  }

  pay(n: number, x: number, y: number) {
    this.money += n;
    this.earned += n;
    this.floaters.push({ x, y, text: `+$${n}`, color: '#7dff8a', t: 0 });
    if (this.coinCool <= 0) {
      this.onSound('coin');
      this.coinCool = 0.12;
    }
  }

  sellValue(ore?: OreId) {
    const list = ore ? [ore] : ORE_IDS;
    return list.reduce((s, o) => s + this.bag[o] * ORES[o].price, 0);
  }

  sell(ore?: OreId) {
    const v = this.sellValue(ore);
    if (!v) return 0;
    for (const o of ore ? [ore] : ORE_IDS) this.bag[o] = 0;
    this.money += v;
    this.earned += v;
    this.onSound('cash');
    return v;
  }

  buyRobot(kind: RobotKind) {
    const cost = kind === 'king' ? GOLDEN_ROBOT : ORES[kind].robot;
    if (kind !== 'king' && ORE_IDS.indexOf(kind) > this.unlocked) return false;
    if (kind === 'king' && this.golden) return false;
    if (!this.spend(cost)) return false;
    if (kind === 'king') this.golden = true;
    this.robots.push(this.newRobot(kind, SHOP_X + 0.5, 1.2));
    this.onSound('buy');
    return true;
  }

  private newRobot(kind: RobotKind, x: number, y: number): Robot {
    return { kind, x, y, state: 'seek', rock: -1, carry: [], t: Math.random(), phase: Math.random() * 6, face: 1 };
  }

  buyTool(k: Kind | 'dynamite', n = 1) {
    if (k === 'dynamite') {
      if (this.unlocked >= 4 || this.tools.dynamite > 0) return false;
      if (!this.spend(ZONES[this.unlocked + 1].dynamite)) return false;
      this.tools.dynamite = 1;
    } else {
      if (!this.spend(KIND_INFO[k].price * n)) return false;
      this.tools[k] += n;
    }
    this.onSound('buy');
    return true;
  }

  buyUpgrade(which: 'speed' | 'bag') {
    const lv = which === 'speed' ? this.speed : this.bagLv;
    const cost = (which === 'speed' ? SPEED_COST : BAG_COST)[lv];
    if (cost === undefined || !this.spend(cost)) return false;
    if (which === 'speed') this.speed++;
    else this.bagLv++;
    this.onSound('buy');
    return true;
  }

  // ---------- building ----------
  canPlace(x: number, y: number) {
    const i = idx(x, y);
    return this.tile(x, y) === Tile.Floor && !this.rocks.has(i) && !this.blds.has(i);
  }

  place(x: number, y: number, k: Kind, dir: number) {
    const i = idx(x, y);
    const b = this.blds.get(i);
    if (b) {
      if (b.k === k && b.dir !== dir) {
        b.dir = dir;
        this.onSound('click');
        return true;
      }
      return false;
    }
    if (!this.canPlace(x, y) || this.tools[k] <= 0) return false;
    this.tools[k]--;
    this.blds.set(i, this.mk(k, dir));
    this.onSound('place');
    return true;
  }

  remove(x: number, y: number) {
    const i = idx(x, y);
    const b = this.blds.get(i);
    if (!b) return false;
    this.tools[b.k]++;
    for (const o of ORE_IDS) this.bag[o] += b.store[o] ?? 0;
    for (const it of b.items) this.bag[it.ore]++;
    if (b.held) this.bag[b.held]++;
    this.blds.delete(i);
    this.onSound('pick');
    return true;
  }

  bldAt(x: number, y: number) {
    return this.blds.get(idx(x, y));
  }

  // ---------- player ----------
  private frontRock(p = this.player): number {
    const fx = Math.floor(p.x + DX[p.dir] * 0.85), fy = Math.floor(p.y + DY[p.dir] * 0.85);
    if (this.rocks.has(idx(fx, fy))) return idx(fx, fy);
    let best = -1, bd = 1.3;
    for (let y = Math.floor(p.y) - 1; y <= Math.floor(p.y) + 1; y++)
      for (let x = Math.floor(p.x) - 1; x <= Math.floor(p.x) + 1; x++) {
        const i = idx(x, y);
        if (!this.rocks.has(i)) continue;
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    return best;
  }

  nearShop(p = this.player) {
    return Math.hypot(p.x - SHOP_SPOT.x, p.y - SHOP_SPOT.y) < 2;
  }

  nearBoulder(p = this.player): number {
    for (let k = 0; k < DIVIDERS.length; k++) {
      const d = DIVIDERS[k];
      if (this.tile(d, DOOR_Y0) !== Tile.Boulder) continue;
      const nx = Math.max(d, Math.min(d + 1, p.x));
      const ny = Math.max(DOOR_Y0, Math.min(DOOR_Y0 + DOOR_H, p.y));
      if (Math.hypot(nx - p.x, ny - p.y) < 0.9) return k;
    }
    return -1;
  }

  nearCrate(p = this.player): number {
    let best = -1, bd = 1.3;
    for (let y = Math.floor(p.y) - 1; y <= Math.floor(p.y) + 1; y++)
      for (let x = Math.floor(p.x) - 1; x <= Math.floor(p.x) + 1; x++) {
        const b = this.blds.get(idx(x, y));
        if (!b || b.k !== 'crate') continue;
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
        if (d < bd) {
          bd = d;
          best = idx(x, y);
        }
      }
    return best;
  }

  /** E / Space pressed. Returns 'shop' when the shop should open. */
  act(p = this.player): 'shop' | null {
    if (this.nearShop(p)) return 'shop';
    const door = this.nearBoulder(p);
    if (door >= 0) {
      if (door !== this.unlocked) return null;
      if (this.tools.dynamite > 0) {
        this.blast(door);
      } else {
        this.onMsg(`Big boulders! Buy dynamite from the shop ($${ZONES[door + 1].dynamite}) to blast into the ${ZONES[door + 1].name}.`);
      }
      return null;
    }
    const c = this.nearCrate(p);
    if (c >= 0) {
      const b = this.blds.get(c)!;
      let n = 0;
      for (const o of ORE_IDS) {
        n += b.store[o] ?? 0;
        this.bag[o] += b.store[o] ?? 0;
      }
      b.store = {};
      if (n) {
        this.onSound('pick');
        this.floaters.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.2, text: `took ${n}`, color: '#ffe6a8', t: 0 });
      } else if (this.frontRock(p) < 0) this.onMsg('This crate is empty. Robots fill the nearest crate.');
    }
    return null;
  }

  private blast(door: number) {
    const d = DIVIDERS[door];
    for (let y = DOOR_Y0; y < DOOR_Y0 + DOOR_H; y++) {
      this.tiles[idx(d, y)] = Tile.Floor;
      for (let n = 0; n < 14; n++) this.burst(d + 0.5, y + 0.5, n % 2 ? '#ff9a3c' : '#6f6157', 6, 0.15);
    }
    this.tools.dynamite = 0;
    this.unlocked = door + 1;
    this.onSound('boom');
    this.onMsg(`BOOM! The ${ZONES[this.unlocked].name} is open. Its ${ORES[ORE_IDS[this.unlocked]].name.toLowerCase()} robots are in the shop now.`);
  }

  private burst(x: number, y: number, color: string, speed: number, size: number) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
    this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, t: 0, life: 0.5 + Math.random() * 0.4, color, size });
  }

  private mineOne(i: number, x: number, y: number, toBag: boolean): OreId | null {
    const rock = this.rocks.get(i);
    if (!rock) return null;
    rock.amt--;
    for (let n = 0; n < 4; n++) this.burst(x, y, n % 2 ? ORES[rock.ore].fleck : ORES[rock.ore].rock, 2.5, 0.07);
    if (toBag) {
      this.bag[rock.ore]++;
      this.floaters.push({ x, y: y - 0.4, text: `+1 ${ORES[rock.ore].name}`, color: '#ffffff', t: 0 });
    }
    if (rock.amt <= 0) {
      this.rocks.delete(i);
      for (let n = 0; n < 10; n++) this.burst(rock.x + 0.5, rock.y + 0.5, ORES[rock.ore].rock, 4, 0.12);
      this.onSound('crumble');
    }
    return rock.ore;
  }

  // ---------- tick ----------
  /** `sim` is false on a friend's game: only your own miner moves here, the host runs the rest. */
  step(dt: number, mx: number, my: number, mining: boolean, sim = true) {
    if (sim) this.time += dt;
    this.coinCool -= dt;
    const p = this.player;
    const len = Math.hypot(mx, my);
    p.moving = len > 0.1;
    if (p.moving) {
      const sp = 4.2 * Math.min(1, len);
      const vx = (mx / len) * sp * dt, vy = (my / len) * sp * dt;
      this.moveAxis(p, vx, 0);
      this.moveAxis(p, 0, vy);
      p.walk += dt * 10;
      if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 0 : 2;
      else p.dir = my > 0 ? 1 : 3;
      if (Math.abs(mx) > 0.2) p.face = mx > 0 ? 1 : -1;
    }
    p.wantMine = mining;
    this.minePlayer(p, dt, sim);
    // glide the other miners (and, on a friend's game, the robots) toward where they last were
    const k = Math.min(1, dt * 12);
    for (const o of sim ? this.others : [...this.robots, ...this.others]) {
      if (o.tx === undefined || o.ty === undefined) continue;
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
    }
    if (!sim) {
      this.stepEffects(dt);
      return;
    }
    for (const o of this.others) this.minePlayer(o, dt, true);

    for (const r of this.robots) this.stepRobot(r, dt);
    this.stepBuildings(dt);

    for (let z = 0; z < 5; z++) {
      this.regrow[z] += dt;
      if (this.regrow[z] > 10) {
        this.regrow[z] = 0;
        let n = 0;
        for (const r of this.rocks.values()) if (zoneOf(r.x) === z) n++;
        if (n < ROCKS_PER_ZONE) this.spawnRock(z);
      }
    }
    this.stepEffects(dt);
  }

  private minePlayer(p: Player, dt: number, sim: boolean) {
    p.miningRock = -1;
    if (p.wantMine) {
      const i = this.frontRock(p);
      if (i >= 0) {
        const rock = this.rocks.get(i)!;
        p.miningRock = i;
        if (rock.x + 0.5 > p.x + 0.3) p.face = 1;
        else if (rock.x + 0.5 < p.x - 0.3) p.face = -1;
        p.mining += dt;
        p.swing = (p.swing + dt * 6) % 1;
        if (p.mining >= ORES[rock.ore].handTime) {
          p.mining = 0;
          if (sim) this.mineOne(i, rock.x + 0.5, rock.y + 0.5, true);
          if (sim || p === this.player) this.onSound('tink');
        }
      } else p.mining = 0;
    } else {
      p.mining = 0;
      p.swing = 0;
    }
  }

  private stepEffects(dt: number) {
    for (const f of this.floaters) {
      f.t += dt;
      f.y -= dt * 0.8;
    }
    this.floaters = this.floaters.filter((f) => f.t < 1.1);
    if (this.floaters.length > 60) this.floaters.splice(0, this.floaters.length - 60);
    for (const q of this.particles) {
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 9 * dt;
    }
    this.particles = this.particles.filter((q) => q.t < q.life);
  }

  private moveAxis(p: Player, vx: number, vy: number) {
    const rad = 0.28;
    const nx = p.x + vx, ny = p.y + vy;
    const hit = (x: number, y: number) =>
      this.solid(Math.floor(x - rad), Math.floor(y - rad)) || this.solid(Math.floor(x + rad), Math.floor(y - rad)) ||
      this.solid(Math.floor(x - rad), Math.floor(y + rad)) || this.solid(Math.floor(x + rad), Math.floor(y + rad));
    if (!hit(nx, ny)) {
      p.x = nx;
      p.y = ny;
    }
  }

  robotCap(r: Robot) {
    return r.kind === 'king' ? 20 : BAG_LV[this.bagLv];
  }

  private stepRobot(r: Robot, dt: number) {
    r.phase += dt;
    const speed = 3 * SPEED_LV[this.speed] * (r.kind === 'king' ? 2 : 1);
    const flyTo = (tx: number, ty: number) => {
      const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
      if (d < 0.05) return true;
      const s = Math.min(d, speed * dt);
      r.x += (dx / d) * s;
      r.y += (dy / d) * s;
      if (Math.abs(dx) > 0.05) r.face = dx > 0 ? 1 : -1;
      return d < 0.25;
    };
    const release = () => {
      const rock = this.rocks.get(r.rock);
      if (rock) rock.claims = Math.max(0, rock.claims - 1);
      r.rock = -1;
    };
    switch (r.state) {
      case 'idle':
      case 'seek': {
        r.t -= dt;
        if (r.state === 'idle') {
          const a = r.phase * 0.7;
          flyTo(this.player.x + Math.cos(a) * 1.4, this.player.y - 0.6 + Math.sin(a) * 0.6);
          if (r.t > 0) break;
        }
        let best = -1, bd = Infinity;
        for (const [i, rock] of this.rocks) {
          if (r.kind !== 'king' && rock.ore !== r.kind) continue;
          if (zoneOf(rock.x) > this.unlocked) continue;
          const d = Math.hypot(rock.x + 0.5 - r.x, rock.y + 0.5 - r.y) + rock.claims * 6;
          if (rock.claims < 3 && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          r.rock = best;
          this.rocks.get(best)!.claims++;
          r.state = 'fly';
        } else if (r.carry.length) r.state = 'home';
        else {
          r.state = 'idle';
          r.t = 1.5;
        }
        break;
      }
      case 'fly': {
        const rock = this.rocks.get(r.rock);
        if (!rock) {
          r.rock = -1;
          r.state = r.carry.length ? 'home' : 'seek';
          break;
        }
        if (flyTo(rock.x + 0.5, rock.y + 0.1)) {
          r.state = 'mine';
          r.t = 0;
        }
        break;
      }
      case 'mine': {
        const rock = this.rocks.get(r.rock);
        if (!rock) {
          r.rock = -1;
          r.state = r.carry.length ? 'home' : 'seek';
          break;
        }
        r.t += dt;
        const need = ORES[rock.ore].robotTime / (r.kind === 'king' ? 3 : 1);
        if (r.t >= need) {
          r.t = 0;
          const ore = this.mineOne(r.rock, rock.x + 0.5, rock.y + 0.5, false);
          if (ore) r.carry.push(ore);
          if (r.carry.length >= this.robotCap(r) || !this.rocks.has(r.rock)) {
            release();
            r.state = 'home';
          }
        }
        break;
      }
      case 'home': {
        let best = -1, bd = Infinity;
        for (const [i, b] of this.blds) {
          if (b.k !== 'crate') continue;
          const d = Math.hypot((i % W) + 0.5 - r.x, ((i / W) | 0) + 0.5 - r.y);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        const tx = best >= 0 ? (best % W) + 0.5 : this.player.x;
        const ty = best >= 0 ? ((best / W) | 0) + 0.3 : this.player.y - 0.5;
        if (flyTo(tx, ty)) {
          if (best >= 0) {
            const b = this.blds.get(best)!;
            for (const o of r.carry) b.store[o] = (b.store[o] ?? 0) + 1;
          } else {
            for (const o of r.carry) this.bag[o]++;
            this.floaters.push({ x: tx, y: ty - 0.4, text: `+${r.carry.length}`, color: '#ffe6a8', t: 0 });
          }
          r.carry = [];
          r.state = 'seek';
          r.t = 0;
        }
        break;
      }
    }
  }

  /** Try to hand an item to the building at (x, y). */
  private give(x: number, y: number, ore: OreId): boolean {
    const b = this.blds.get(idx(x, y));
    if (!b) return false;
    if (b.k === 'crate') {
      b.store[ore] = (b.store[ore] ?? 0) + 1;
      return true;
    }
    if (b.k === 'payer') {
      this.pay(ORES[ore].price, x + 0.5, y + 0.2);
      b.swing = 1;
      return true;
    }
    if (b.k === 'belt') {
      const last = b.items[b.items.length - 1];
      if (last && last.p < 0.34) return false;
      b.items.push({ ore, p: 0 });
      return true;
    }
    return false;
  }

  private stepBuildings(dt: number) {
    for (const [i, b] of this.blds) {
      const x = i % W, y = (i / W) | 0;
      if (b.k === 'belt') {
        let limit = Infinity;
        for (let n = 0; n < b.items.length; n++) {
          const it = b.items[n];
          it.p = Math.min(it.p + dt * 2, limit - 0.34, 1);
          limit = it.p;
        }
        const front = b.items[0];
        if (front && front.p >= 1 && this.give(x + DX[b.dir], y + DY[b.dir], front.ore)) b.items.shift();
      } else if (b.k === 'grabber') {
        b.swing = Math.max(0, b.swing - dt * 3);
        b.t -= dt;
        if (b.held) {
          if (b.t <= 0 && this.give(x + DX[b.dir], y + DY[b.dir], b.held)) {
            b.held = null;
            b.t = 0.3;
            b.swing = 1;
          }
          continue;
        }
        if (b.t > 0) continue;
        const src = this.blds.get(idx(x - DX[b.dir], y - DY[b.dir]));
        if (!src) continue;
        let got: OreId | null = null;
        if (src.k === 'crate') {
          let most = 0;
          for (const o of ORE_IDS) if ((src.store[o] ?? 0) > most) {
            most = src.store[o]!;
            got = o;
          }
          if (got) src.store[got]!--;
        } else if (src.k === 'belt' && src.items.length && src.items[0].p > 0.5) {
          got = src.items.shift()!.ore;
        }
        if (got) {
          b.held = got;
          b.t = 0.3;
        }
      } else if (b.k === 'payer') {
        b.swing = Math.max(0, b.swing - dt * 3);
      }
    }
  }

  // ---------- co-op ----------
  snap(): Snap {
    const all = [this.player, ...this.others];
    return {
      money: this.money, earned: this.earned, bag: { ...this.bag }, tools: { ...this.tools }, unlocked: this.unlocked,
      speed: this.speed, bagLv: this.bagLv, golden: this.golden, time: this.time,
      rocks: [...this.rocks].map(([i, r]) => [i, r.ore, r.amt]),
      blds: [...this.blds].map(([i, b]) => [i, b.k, b.dir, b.store, b.items, +b.t.toFixed(2), +b.swing.toFixed(2), b.held]),
      robots: this.robots.map((r) => [r.kind, +r.x.toFixed(2), +r.y.toFixed(2), r.state, r.face, r.carry, +r.phase.toFixed(2)]),
      players: all.map((p) => [p.slot, +p.x.toFixed(2), +p.y.toFixed(2), p.dir, p.face, p.moving ? 1 : 0, +p.walk.toFixed(1), +p.swing.toFixed(2), p.miningRock]),
      floaters: this.floaters.filter((f) => !this.sent.has(f) && this.sent.add(f)),
    };
  }

  /** On a friend's game: take the host's world, but keep your own miner where you put it. */
  applySnap(s: Snap) {
    this.money = s.money; this.earned = s.earned; this.bag = s.bag; this.tools = s.tools; this.speed = s.speed;
    this.bagLv = s.bagLv; this.golden = s.golden; this.time = s.time;
    if (s.unlocked !== this.unlocked) {
      for (let k = 0; k < DIVIDERS.length; k++)
        for (let y = DOOR_Y0; y < DOOR_Y0 + DOOR_H; y++) this.tiles[idx(DIVIDERS[k], y)] = k < s.unlocked ? Tile.Floor : Tile.Boulder;
      if (s.unlocked > this.unlocked) this.onSound('boom');
      this.unlocked = s.unlocked;
    }
    this.rocks.clear();
    for (const [i, ore, amt] of s.rocks) this.rocks.set(i, { x: i % W, y: (i / W) | 0, ore, amt, max: ORES[ore].amt, claims: 0 });
    this.blds.clear();
    for (const [i, k, dir, store, items, t, swing, held] of s.blds) this.blds.set(i, { k, dir, store, items, t, swing, held });
    const old = this.robots;
    this.robots = s.robots.map(([kind, x, y, state, face, carry, phase], n) => {
      const r = old[n] && old[n].kind === kind ? old[n] : this.newRobot(kind, x, y);
      if (Math.hypot(r.x - x, r.y - y) > 3) { r.x = x; r.y = y; }
      r.tx = x; r.ty = y;
      r.state = state as Robot['state']; r.face = face; r.carry = carry; r.phase = phase;
      return r;
    });
    const others: Player[] = [];
    for (const [slot, x, y, dir, face, moving, walk, swing, miningRock] of s.players) {
      if (slot === this.player.slot) continue;
      const p = this.others.find((o) => o.slot === slot) ?? newPlayer(slot, x, y);
      if (Math.hypot(p.x - x, p.y - y) > 3) { p.x = x; p.y = y; }
      Object.assign(p, { tx: x, ty: y, dir, face, moving: !!moving, walk, swing, miningRock });
      others.push(p);
    }
    this.others = others;
    for (const f of s.floaters) this.floaters.push({ ...f });
  }

  /** On the host: where a friend says their miner is. */
  setOther(slot: number, x: number, y: number, dir: number, face: number, moving: boolean, walk: number, mine: boolean) {
    let p = this.others.find((o) => o.slot === slot);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!p) this.others.push((p = newPlayer(slot, x, y)));
    if (Math.hypot(p.x - x, p.y - y) > 3) { p.x = x; p.y = y; }
    Object.assign(p, { tx: x, ty: y, dir, face, moving, walk, wantMine: mine });
  }

  removeOther(slot: number) {
    this.others = this.others.filter((o) => o.slot !== slot);
  }

  other(slot: number) {
    return this.others.find((o) => o.slot === slot);
  }

  // ---------- save ----------
  save(): SaveData {
    return {
      v: 1,
      money: this.money,
      bag: { ...this.bag },
      tools: { ...this.tools },
      unlocked: this.unlocked,
      speed: this.speed,
      bagLv: this.bagLv,
      golden: this.golden,
      time: this.time,
      earned: this.earned,
      player: { x: this.player.x, y: this.player.y },
      rocks: [...this.rocks.values()].map((r) => [r.x, r.y, r.ore, r.amt]),
      blds: [...this.blds].map(([i, b]) => {
        const items = b.items.map((it) => ({ ...it }));
        if (b.held) items.push({ ore: b.held, p: -1 });
        return [i, b.k, b.dir, { ...b.store }, items];
      }),
      robots: this.robots.map((r) => [r.kind, [...r.carry]]),
    };
  }

  private load(s: SaveData) {
    this.money = s.money;
    this.earned = s.earned ?? 0;
    this.bag = { ...emptyBag(), ...s.bag };
    this.tools = { ...this.tools, ...s.tools };
    this.speed = s.speed;
    this.bagLv = s.bagLv;
    this.golden = s.golden;
    this.time = s.time;
    for (let k = 0; k < s.unlocked; k++) {
      for (let y = DOOR_Y0; y < DOOR_Y0 + DOOR_H; y++) this.tiles[idx(DIVIDERS[k], y)] = Tile.Floor;
    }
    this.unlocked = s.unlocked;
    this.player.x = s.player.x;
    this.player.y = s.player.y;
    for (const [x, y, ore, amt] of s.rocks) {
      if (this.tiles[idx(x, y)] === Tile.Floor) this.rocks.set(idx(x, y), { x, y, ore, amt, max: ORES[ore].amt, claims: 0 });
    }
    for (const [i, k, dir, store, items] of s.blds) {
      const b = this.mk(k, dir);
      b.store = store;
      b.items = items.filter((it) => it.p >= 0);
      b.held = items.find((it) => it.p < 0)?.ore ?? null;
      this.blds.set(i, b);
    }
    for (const [kind, carry] of s.robots) {
      const r = this.newRobot(kind, this.player.x + Math.random() * 2 - 1, this.player.y - 1);
      r.carry = carry;
      this.robots.push(r);
    }
  }
}
