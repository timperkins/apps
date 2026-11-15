// The simulation: entities, power, research, hand crafting and the player.
import {
  ENTITIES, INPUT_BUFFER_CRAFTS, maxHp, SCIENCE_PACKS, ITEMS, PLAYER_START, POLE_SUPPLY_RADIUS, POLE_WIRE_REACH, RECIPES,
  RECIPE_BY_ID, SMELT_BY_INPUT, TECHS, TECH_BY_ID,
  type EntityType, type ItemId, type Recipe,
} from './data';
import { Inventory, type Stack } from './inventory';
import { b64, RES_ITEM, Res, unb64, World, WORLD } from './world';
import { packExplored, unpackExplored } from './minimap';
import { asmProd, bootsMult, craftSpeed, genMult, hpMult, invSize, labSpeed, miningProd } from './bonus';
import { legsMult, newSuit, suitFromJSON, suitToJSON, updateSuit } from './armor';
import { newCombatState, nestBlocks, playerFire, PLAYER_HP, PLAYER_SPEED, spawnNests, updateCombat, type CombatState } from './combat';

export interface RemotePlayer {
  x: number;
  y: number;
  dir: number;
  moving: boolean;
  hp: number;
  name: string;
  dead: boolean;
}

export const TPS = 60;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export type Dir = 0 | 1 | 2 | 3;

export const BELT_SPACING = 0.25;
export const DAY_LENGTH = 60 * 8; // seconds per full day

export interface BeltItem {
  item: ItemId;
  pos: number; // 0 = entry edge, 1 = exit edge
}

export class Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  dir: Dir;
  // burner energy
  fuel: Stack | null = null;
  burn = 0;
  // machines
  input: Partial<Record<ItemId, number>> = {};
  output: Stack | null = null;
  recipe: string | null = null;
  crafting: string | null = null; // recipe in progress
  progress = 0;
  // chest
  inv: Inventory | null = null;
  // belt
  items: BeltItem[] = [];
  curve: -1 | Dir = -1; // direction items arrive from when this belt is a turn
  // inserter
  held: ItemId | null = null;
  phase: 'pick' | 'swing' | 'drop' | 'back' = 'pick';
  t = 0;
  // drill
  pending: ItemId | null = null;
  cursor = 0;
  /** productivity progress (drills, assemblers) */
  extra = 0;
  // power
  net = -1;
  sat = 0;
  wire: number[] = []; // poles
  working = false;
  status = '';
  anim = 0;
  hp: number;

  constructor(id: number, type: EntityType, x: number, y: number, dir: Dir) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.dir = dir;
    const def = ENTITIES[type];
    this.hp = maxHp(type);
    if (def.kind === 'chest') this.inv = new Inventory(def.slots ?? 16);
  }

  get def() {
    return ENTITIES[this.type];
  }
  get cx() {
    return this.x + this.def.w / 2;
  }
  get cy() {
    return this.y + this.def.h / 2;
  }
}

export interface CraftJob {
  recipe: string;
  count: number;
}

export interface Toast {
  text: string;
  until: number;
}

export class Game {
  world: World;
  tick = 0;
  ents = new Map<number, Entity>();
  grid: Int32Array = new Int32Array(WORLD * WORLD);
  nextId = 1;
  // power
  netsDirty = true;
  netCount = 0;
  netSat: number[] = [];
  netDemand: number[] = [];
  netSupply: number[] = [];
  // player
  px = WORLD / 2 + 0.5;
  py = WORLD / 2 + 0.5;
  pdir = 2;
  pmoving = false;
  inv = new Inventory(80);
  craftQueue: CraftJob[] = [];
  craftProgress = 0;
  // research
  researched = new Set<string>();
  research: string | null = null;
  researchUnits: Record<string, number> = {};
  produced: Partial<Record<ItemId, number>> = {};
  won = false;
  toasts: Toast[] = [];
  /** Events the renderer/audio can react to (cleared by the consumer). */
  events: string[] = [];
  // combat
  enemies = true;
  cs: CombatState = newCombatState();
  kills = 0;
  nestsDestroyed = 0;
  pistolRounds = 0;
  playerDead = 0; // ticks until respawn
  killedBy = '';
  shooting = false;
  aim: { x: number; y: number } | null = null;
  /** Guest copy of a hosted game: the host runs bugs, turrets and research. */
  remote = false;
  /** Guests send shots to the host instead of resolving them. */
  onFire: ((weapon: 'pistol' | 'rail' | 'grenade', aim?: { x: number; y: number }) => void) | null = null;
  /** Other players in a multiplayer game (host side), by id. */
  others = new Map<string, RemotePlayer>();
  /** Damage dealt to other players this tick, for the host to send out. */
  hurtOthers: [string, number, string][] = [];
  /** Tiles changed by mining, for the host to send out. */
  tileChanges = new Set<number>();
  /** Armor and personal grid. */
  suit = newSuit();
  /** 1 where the player has seen the tile (for the map). */
  explored = new Uint8Array(WORLD * WORLD);
  exploredAt = -1;
  spawnX = WORLD / 2 + 0.5;
  spawnY = WORLD / 2 + 0.5;

  constructor(world: World) {
    this.world = world;
  }

  static fresh(seed: number, enemies = true): Game {
    const g = new Game(new World(seed));
    g.enemies = enemies;
    for (const [item, n] of PLAYER_START) g.inv.add(item, n);
    if (enemies) spawnNests(g);
    return g;
  }

  killPlayer(by: string) {
    if (this.playerDead) return;
    this.playerDead = 60 * 4;
    this.killedBy = by;
    this.events.push('died');
  }

  private updatePlayerLife() {
    if (!this.playerDead) return;
    this.playerDead--;
    if (this.playerDead === 0) {
      this.px = this.spawnX;
      this.py = this.spawnY;
      this.cs.playerHp = this.maxHp();
      this.toast('You woke up back at the start.', 3);
    }
  }

  // ---------- helpers ----------

  maxHp() {
    return PLAYER_HP * hpMult(this);
  }

  /** Applies research upgrades that change the player's things (like the backpack). */
  applyBonuses() {
    this.inv.resize(invSize(this));
  }

  entAt(x: number, y: number): Entity | null {
    if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return null;
    const id = this.grid[y * WORLD + x];
    return id ? this.ents.get(id) ?? null : null;
  }

  toast(text: string, secs = 3) {
    this.toasts.push({ text, until: this.tick + secs * TPS });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  unlocked(r: Recipe): boolean {
    return !r.unlock || this.researched.has(r.unlock);
  }

  daylight(): number {
    const t = (this.tick / TPS / DAY_LENGTH) % 1; // 0 = noon
    const c = Math.cos(t * Math.PI * 2); // 1 noon, -1 midnight
    return Math.max(0, Math.min(1, c * 1.6 + 0.5));
  }

  // ---------- placement ----------

  canPlace(type: EntityType, x: number, y: number): boolean {
    const d = ENTITIES[type];
    for (let j = 0; j < d.h; j++)
      for (let i = 0; i < d.w; i++) {
        const tx = x + i, ty = y + j;
        if (!this.world.buildable(tx, ty)) return false;
        if (this.grid[ty * WORLD + tx]) return false;
        if (this.playerOverlaps(tx, ty) && solid(type)) return false;
      }
    if (nestBlocks(this, x, y, d.w, d.h)) return false;
    if (d.kind === 'drill') {
      if (!this.drillHasOre(x, y, d.w, d.area ?? d.w)) return false;
    }
    return true;
  }

  private playerOverlaps(tx: number, ty: number) {
    const r = 0.3;
    return this.px + r > tx && this.px - r < tx + 1 && this.py + r > ty && this.py - r < ty + 1;
  }

  drillHasOre(x: number, y: number, w: number, area: number) {
    const o = (area - w) / 2;
    for (let j = 0; j < area; j++)
      for (let i = 0; i < area; i++) {
        const tx = x - o + i, ty = y - o + j;
        if (this.world.inside(tx, ty) && this.world.res[ty * WORLD + tx]) return true;
      }
    return false;
  }

  place(type: EntityType, x: number, y: number, dir: Dir): Entity | null {
    if (!this.canPlace(type, x, y)) return null;
    const e = new Entity(this.nextId++, type, x, y, ENTITIES[type].rotatable ? dir : 0);
    if (e.def.ug) this.ugPair(e);
    this.addEntity(e);
    return e;
  }

  addEntity(e: Entity) {
    this.ents.set(e.id, e);
    this.nextId = Math.max(this.nextId, e.id + 1);
    const d = e.def;
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.grid[(e.y + j) * WORLD + e.x + i] = e.id;
    if (d.kind === 'pole') this.connectPole(e);
    if (d.kind === 'belt') this.updateCurves(e.x, e.y);
    this.netsDirty = true;
    if (d.kind === 'monument' && !this.won) {
      this.won = true;
      this.events.push('win');
    }
  }

  /** Removes an entity and returns everything it held (including itself). */
  remove(e: Entity): [ItemId, number][] {
    const d = e.def;
    const out: [ItemId, number][] = [[d.item, 1]];
    const add = (item: ItemId | null | undefined, n = 1) => {
      if (item && n > 0) out.push([item, n]);
    };
    if (e.fuel) add(e.fuel.item, e.fuel.n);
    if (e.output) add(e.output.item, e.output.n);
    for (const [k, v] of Object.entries(e.input)) add(k as ItemId, v ?? 0);
    if (e.crafting) {
      const r = RECIPE_BY_ID[e.crafting];
      if (r) for (const [it, n] of r.ing) add(it, n);
    }
    if (e.inv) for (const s of e.inv.slots) if (s) add(s.item, s.n);
    for (const b of e.items) add(b.item);
    add(e.held);
    add(e.pending);
    this.ents.delete(e.id);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.grid[(e.y + j) * WORLD + e.x + i] = 0;
    if (d.kind === 'pole') {
      for (const id of e.wire) {
        const o = this.ents.get(id);
        if (o) o.wire = o.wire.filter((w) => w !== e.id);
      }
    }
    if (d.kind === 'belt') this.updateCurves(e.x, e.y);
    this.netsDirty = true;
    return out;
  }

  rotate(e: Entity) {
    if (!e.def.rotatable) return;
    if (e.def.ug) {
      // an underground belt flips between going in and coming out
      e.recipe = e.recipe === 'out' ? null : 'out';
      return;
    }
    e.dir = ((e.dir + 1) % 4) as Dir;
    if (e.def.kind === 'belt') this.updateCurves(e.x, e.y);
  }

  private connectPole(e: Entity) {
    const near: [number, Entity][] = [];
    for (const o of this.ents.values()) {
      if (o === e || o.def.kind !== 'pole') continue;
      const d = Math.hypot(o.cx - e.cx, o.cy - e.cy);
      if (d <= Math.min(e.def.wireReach ?? POLE_WIRE_REACH, o.def.wireReach ?? POLE_WIRE_REACH)) near.push([d, o]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, o] of near.slice(0, 2)) {
      e.wire.push(o.id);
      o.wire.push(e.id);
    }
  }

  // ---------- belts ----------

  /** Is there a belt at (x,y) whose output points into tile (tx,ty)? */
  private beltFeeds(x: number, y: number, tx: number, ty: number): boolean {
    const e = this.entAt(x, y);
    return !!e && e.def.kind === 'belt' && x + DX[e.dir] === tx && y + DY[e.dir] === ty;
  }

  updateCurves(cx: number, cy: number) {
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++) {
        const e = this.entAt(x, y);
        if (!e || e.def.kind !== 'belt') continue;
        const back = ((e.dir + 2) % 4) as Dir;
        e.curve = -1;
        if (this.beltFeeds(x + DX[back], y + DY[back], x, y)) continue;
        const left = ((e.dir + 3) % 4) as Dir, right = ((e.dir + 1) % 4) as Dir;
        const fl = this.beltFeeds(x + DX[left], y + DY[left], x, y);
        const fr = this.beltFeeds(x + DX[right], y + DY[right], x, y);
        if (fl !== fr) e.curve = fl ? left : right;
      }
  }

  /** Can an item enter this belt at `pos`? */
  beltRoom(e: Entity, pos: number): boolean {
    for (const b of e.items) if (Math.abs(b.pos - pos) < BELT_SPACING - 1e-6) return false;
    return true;
  }

  beltPut(e: Entity, item: ItemId, pos: number): boolean {
    if (!this.beltRoom(e, pos)) return false;
    const it = { item, pos };
    let i = 0;
    while (i < e.items.length && e.items[i].pos < pos) i++;
    e.items.splice(i, 0, it);
    return true;
  }

  private updateBelt(e: Entity) {
    const items = e.items;
    if (!items.length) return;
    const v = (e.def.speed ?? 1.875) / TPS;
    for (let i = items.length - 1; i >= 0; i--) {
      const b = items[i];
      const limit = i === items.length - 1 ? 1 : items[i + 1].pos - BELT_SPACING;
      b.pos = Math.min(b.pos + v, Math.max(b.pos, limit));
      if (i === items.length - 1 && b.pos >= 1) {
        if (e.def.ug && e.recipe !== 'out') {
          // underground entrance: the item pops out of the paired exit
          const exit = this.ugExit(e);
          if (exit && this.beltRoom(exit, 0)) {
            items.pop();
            this.beltPut(exit, b.item, 0);
          }
          b.pos = Math.min(b.pos, 1);
          continue;
        }
        const nx = e.x + DX[e.dir], ny = e.y + DY[e.dir];
        const n = this.entAt(nx, ny);
        if (n && n.def.kind === 'splitter' && n.dir === e.dir) {
          if (n.items.length < 2) {
            items.pop();
            n.items.push({ item: b.item, pos: 0 });
          }
        } else if (n && n.def.kind === 'belt' && n.dir !== (e.dir + 2) % 4) {
          const straight = n.dir === e.dir || n.curve === ((e.dir + 2) % 4);
          const entry = straight ? 0 : 0.5;
          if (this.beltRoom(n, entry)) {
            items.pop();
            this.beltPut(n, b.item, entry);
          }
        }
        b.pos = Math.min(b.pos, 1);
      }
    }
  }

  /** The exit of an underground entrance: the first underground belt ahead, up to 5 tiles. */
  ugExit(e: Entity): Entity | null {
    for (let k = 1; k <= 5; k++) {
      const o = this.entAt(e.x + DX[e.dir] * k, e.y + DY[e.dir] * k);
      if (o && o.def.ug && o.dir === e.dir) return o.recipe === 'out' ? o : null;
    }
    return null;
  }

  /** Decides whether a new underground belt is an exit (an entrance points at it from behind). */
  private ugPair(e: Entity) {
    for (let k = 1; k <= 5; k++) {
      const o = this.entAt(e.x - DX[e.dir] * k, e.y - DY[e.dir] * k);
      if (o && o.def.ug && o.dir === e.dir) {
        e.recipe = o.recipe === 'out' ? null : 'out';
        return;
      }
    }
    e.recipe = null;
  }

  /** Hands items out in turn to belts on the splitter's left, front and right. */
  private updateSplitter(e: Entity) {
    if (!e.items.length) return;
    for (let k = 0; k < 3; k++) {
      const turn = [3, 0, 1][(e.cursor + k) % 3];
      const od = ((e.dir + turn) % 4) as Dir;
      const n = this.entAt(e.x + DX[od], e.y + DY[od]);
      if (!n || n.def.kind !== 'belt' || n.dir === (od + 2) % 4) continue;
      const entry = n.dir === od ? 0 : 0.5;
      if (this.beltPut(n, e.items[0].item, entry)) {
        e.items.shift();
        e.cursor = (e.cursor + k + 1) % 3;
        e.working = true;
        return;
      }
    }
    e.working = false;
  }

  // ---------- item exchange ----------

  isFuel(item: ItemId) {
    return !!ITEMS[item].fuel && item !== 'wooden-chest';
  }

  usesFuel(e: Entity) {
    const d = e.def;
    return (!!d.power && !d.electric) || d.kind === 'generator';
  }

  /**
   * How many of `item` this entity would take. `hand` is a player insert, which may fill more
   * than an inserter would.
   */
  accepts(e: Entity, item: ItemId, hand = false): number {
    const d = e.def;
    const stack = ITEMS[item].stack;
    if (d.kind === 'chest') return e.inv!.space(item);
    if (d.kind === 'belt') return this.beltRoom(e, 0.5) ? 1 : 0;
    if (this.usesFuel(e) && this.isFuel(item)) {
      if (e.fuel && e.fuel.item !== item) return 0;
      const have = e.fuel?.n ?? 0;
      const cap = hand ? stack : d.kind === 'inserter' ? 1 : 5;
      return Math.max(0, cap - have);
    }
    if (d.kind === 'furnace') {
      const r = SMELT_BY_INPUT[item];
      if (!r || !this.unlocked(r)) return 0;
      const cur = Object.keys(e.input).find((k) => (e.input[k as ItemId] ?? 0) > 0);
      if (cur && cur !== item) return 0;
      if (e.output && e.output.item !== r.out) return 0;
      const have = e.input[item] ?? 0;
      const cap = hand ? stack : r.ing[0][1] * INPUT_BUFFER_CRAFTS + 1;
      return Math.max(0, cap - have);
    }
    if (d.kind === 'assembler') {
      const r = e.recipe ? RECIPE_BY_ID[e.recipe] : null;
      if (!r) return 0;
      const ing = r.ing.find(([it]) => it === item);
      if (!ing) return 0;
      const have = e.input[item] ?? 0;
      const cap = hand ? stack : ing[1] * INPUT_BUFFER_CRAFTS;
      return Math.max(0, cap - have);
    }
    if (d.kind === 'turret') {
      if (item !== d.ammo) return 0;
      return Math.max(0, (hand ? stack : 10) - (e.input[item] ?? 0));
    }
    if (d.kind === 'lab') {
      if (!SCIENCE_PACKS.includes(item)) return 0;
      const have = e.input[item] ?? 0;
      return Math.max(0, (hand ? stack : 4) - have);
    }
    return 0;
  }

  /** Inserts up to n; returns how many went in. */
  insert(e: Entity, item: ItemId, n: number, hand = false): number {
    const k = Math.min(n, this.accepts(e, item, hand));
    if (k <= 0) return 0;
    const d = e.def;
    if (d.kind === 'chest') return e.inv!.add(item, k);
    if (d.kind === 'belt') return this.beltPut(e, item, 0.5) ? 1 : 0;
    if (this.usesFuel(e) && this.isFuel(item)) {
      if (e.fuel) e.fuel.n += k;
      else e.fuel = { item, n: k };
      return k;
    }
    e.input[item] = (e.input[item] ?? 0) + k;
    return k;
  }

  /** Inserter pickup: removes and returns one item for which `want` is true. */
  take(e: Entity, want: (item: ItemId) => boolean): ItemId | null {
    const d = e.def;
    if (d.kind === 'chest') {
      const it = e.inv!.firstItem(want);
      if (it) e.inv!.remove(it, 1);
      return it;
    }
    if (d.kind === 'belt') {
      for (let i = e.items.length - 1; i >= 0; i--) {
        const b = e.items[i];
        if (want(b.item)) {
          e.items.splice(i, 1);
          return b.item;
        }
      }
      return null;
    }
    if ((d.kind === 'furnace' || d.kind === 'assembler' || d.kind === 'drill') && e.output && want(e.output.item)) {
      const it = e.output.item;
      e.output.n--;
      if (e.output.n <= 0) e.output = null;
      return it;
    }
    return null;
  }

  private addOutput(e: Entity, item: ItemId, n: number) {
    if (e.output) e.output.n += n;
    else e.output = { item, n };
    this.produced[item] = (this.produced[item] ?? 0) + n;
  }

  // ---------- energy ----------

  /** Draws `joules` from a burner entity; returns fraction 0..1 obtained. */
  private burnerDraw(e: Entity, joules: number): number {
    if (e.burn < joules && e.fuel) {
      e.burn += ITEMS[e.fuel.item].fuel ?? 0;
      e.fuel.n--;
      if (e.fuel.n <= 0) e.fuel = null;
    }
    if (e.burn <= 0) return 0;
    const got = Math.min(e.burn, joules);
    e.burn -= got;
    return got / joules;
  }

  /** Energy for this tick, as a speed multiplier. */
  private energy(e: Entity, scale = 1): number {
    const d = e.def;
    if (!d.power) return 1;
    if (d.electric) return e.sat;
    return this.burnerDraw(e, (d.power * scale) / TPS);
  }

  private rebuildNets() {
    this.netsDirty = false;
    const poles = [...this.ents.values()].filter((e) => e.def.kind === 'pole');
    for (const p of poles) p.net = -1;
    let n = 0;
    for (const p of poles) {
      if (p.net >= 0) continue;
      const stack = [p];
      p.net = n;
      while (stack.length) {
        const q = stack.pop()!;
        for (const id of q.wire) {
          const o = this.ents.get(id);
          if (o && o.net < 0) {
            o.net = n;
            stack.push(o);
          }
        }
      }
      n++;
    }
    this.netCount = n;
    for (const e of this.ents.values()) {
      const d = e.def;
      if (d.kind === 'pole') continue;
      e.net = -1;
      if (!d.electric && d.kind !== 'generator' && d.kind !== 'solar' && d.kind !== 'battery') continue;
      for (const p of poles) {
        const r = p.def.supply ?? POLE_SUPPLY_RADIUS;
        if (e.x < p.cx + r && e.x + d.w > p.cx - r && e.y < p.cy + r && e.y + d.h > p.cy - r) {
          e.net = p.net;
          break;
        }
      }
    }
  }

  private wantsPower(e: Entity): number {
    const d = e.def;
    if (!d.electric || !d.power || e.net < 0) return 0;
    switch (d.kind) {
      case 'inserter': return e.phase === 'pick' ? d.power * 0.05 : d.power;
      case 'drill': return e.pending ? 0 : d.power;
      case 'assembler': return e.crafting ? d.power : d.power * 0.03;
      case 'lab': return e.crafting ? d.power : d.power * 0.03;
      case 'turret': return e.progress < 1 ? d.power : d.power * 0.01;
      case 'lamp': return this.daylight() < 0.6 ? d.power : 0;
    }
    return d.power;
  }

  private updatePower() {
    if (this.netsDirty) this.rebuildNets();
    const n = this.netCount;
    const demand = new Array(n).fill(0);
    const supply = new Array(n).fill(0);
    const light = this.daylight();
    const gm = genMult(this);
    const batts: Entity[] = [];
    const out = new Array(n).fill(0); // what batteries could give, watts
    const room = new Array(n).fill(0); // what batteries could take, watts
    for (const e of this.ents.values()) {
      if (e.net < 0) continue;
      const d = e.def;
      if (d.kind === 'generator') {
        if (e.burn > 0 || e.fuel) supply[e.net] += d.output! * gm;
      } else if (d.kind === 'solar') {
        supply[e.net] += d.output! * light;
      } else if (d.kind === 'battery') {
        batts.push(e);
        out[e.net] += Math.min(d.rate!, e.burn * TPS);
        room[e.net] += Math.min(d.rate!, (d.capacity! - e.burn) * TPS);
      } else demand[e.net] += this.wantsPower(e);
    }
    // batteries fill up from spare power and help out when there isn't enough
    const give = demand.map((dm, i) => Math.max(0, Math.min(out[i], dm - supply[i])));
    const take = demand.map((dm, i) => Math.max(0, Math.min(room[i], supply[i] - dm)));
    for (const e of batts) {
      const d = e.def;
      const i = e.net;
      const myOut = Math.min(d.rate!, e.burn * TPS), myRoom = Math.min(d.rate!, (d.capacity! - e.burn) * TPS);
      if (give[i] > 0 && out[i] > 0) e.burn -= (myOut * (give[i] / out[i])) / TPS;
      if (take[i] > 0 && room[i] > 0) e.burn += (myRoom * (take[i] / room[i])) / TPS;
      e.burn = Math.max(0, Math.min(d.capacity!, e.burn));
      e.working = give[i] > 0 || take[i] > 0;
      e.status = `Charge ${Math.round((e.burn / d.capacity!) * 100)}%` + (give[i] > 0 ? ' · helping out' : take[i] > 0 ? ' · charging' : '');
    }
    for (const e of this.ents.values()) if (e.def.kind === 'battery' && e.net < 0) e.status = 'Not connected to a power pole';
    for (let i = 0; i < n; i++) {
      supply[i] += give[i];
      demand[i] += take[i];
    }
    const sat = demand.map((dm, i) => (dm <= 0 ? 1 : Math.min(1, supply[i] / dm)));
    // generators only burn for what isn't covered by solar and batteries
    const load = demand.map((dm, i) => {
      const gen = supply[i] - give[i];
      return gen <= 0 ? 0 : Math.min(1, Math.max(0, dm) / supply[i]);
    });
    for (const e of this.ents.values()) {
      const d = e.def;
      if (d.electric) e.sat = e.net >= 0 && supply[e.net] > 0 ? sat[e.net] : 0;
      if (d.kind === 'generator' && e.net >= 0) {
        const want = load[e.net] * d.output! * gm / TPS;
        e.working = want > 0 && this.burnerDraw(e, want) > 0;
        e.status = !e.fuel && e.burn <= 0 ? 'No fuel' : load[e.net] > 0 ? `Supplying ${Math.round(load[e.net] * 100)}%` : 'Idle';
      } else if (d.kind === 'generator') {
        e.status = 'Not connected to a power pole';
      }
      if (d.kind === 'solar') {
        e.working = e.net >= 0 && light > 0;
        e.status = e.net < 0 ? 'Not connected to a power pole' : `Output ${Math.round(light * 60)} kW`;
      }
    }
    this.netSat = sat;
    this.netDemand = demand;
    this.netSupply = supply;
  }

  // ---------- entity updates ----------

  private updateDrill(e: Entity) {
    const d = e.def;
    if (e.pending) {
      const [ox, oy] = drillOut(e);
      const t = this.entAt(ox, oy);
      if (t && this.insert(t, e.pending, 1) === 1) e.pending = null;
      else if (!t && (!e.output || (e.output.item === e.pending && e.output.n < 50))) {
        // nothing in front: keep the ore inside until someone collects it
        if (e.output) e.output.n++;
        else e.output = { item: e.pending, n: 1 };
        e.pending = null;
      } else {
        e.working = false;
        e.status = t ? 'Output full' : 'Nothing to output into';
        return;
      }
    }
    const area = d.area ?? d.w;
    const o = (area - d.w) / 2;
    // find a tile with ore, continuing from the last one
    let tx = -1, ty = -1;
    for (let k = 0; k < area * area; k++) {
      const c = (e.cursor + k) % (area * area);
      const x = e.x - o + (c % area), y = e.y - o + Math.floor(c / area);
      if (this.world.inside(x, y) && this.world.res[y * WORLD + x]) {
        tx = x;
        ty = y;
        e.cursor = c;
        break;
      }
    }
    if (tx < 0) {
      e.working = false;
      e.status = 'No resources left';
      return;
    }
    const en = this.energy(e);
    if (en <= 0) {
      e.working = false;
      e.status = d.electric ? (e.net < 0 ? 'Not connected to power' : 'No power') : 'No fuel';
      return;
    }
    e.working = true;
    e.status = 'Mining';
    e.anim += en;
    e.progress += (en * (d.speed ?? 0.25)) / TPS;
    if (e.progress >= 1) {
      e.progress -= 1;
      const kind = this.world.res[ty * WORLD + tx] as Res;
      // productivity: now and then a free ore that doesn't use up the patch
      e.extra += miningProd(this);
      if (e.extra >= 1) e.extra -= 1;
      else this.world.mineRes(tx, ty);
      e.cursor++;
      e.pending = RES_ITEM[kind] as ItemId;
      this.produced[e.pending] = (this.produced[e.pending] ?? 0) + 1;
    }
  }

  private updateFurnace(e: Entity) {
    const d = e.def;
    if (!e.crafting) {
      const item = Object.keys(e.input).find((k) => (e.input[k as ItemId] ?? 0) > 0) as ItemId | undefined;
      const r = item ? SMELT_BY_INPUT[item] : undefined;
      if (!item || !r) {
        e.working = false;
        e.status = 'Waiting for ore';
        return;
      }
      if ((e.input[item] ?? 0) < r.ing[0][1]) {
        e.working = false;
        e.status = 'Waiting for more ' + ITEMS[item].name.toLowerCase();
        return;
      }
      if (e.output && (e.output.item !== r.out || e.output.n >= ITEMS[r.out].stack)) {
        e.working = false;
        e.status = 'Output full';
        return;
      }
      e.input[item]! -= r.ing[0][1];
      if (!e.input[item]) delete e.input[item];
      e.crafting = r.id;
      e.progress = 0;
    }
    const r = RECIPE_BY_ID[e.crafting];
    const en = this.energy(e);
    if (en <= 0) {
      e.working = false;
      e.status = d.electric ? (e.net < 0 ? 'Not connected to power' : 'No power') : 'No fuel';
      return;
    }
    e.working = true;
    e.status = 'Smelting ' + ITEMS[r.out].name;
    e.progress += (en * (d.speed ?? 1)) / TPS / r.time;
    if (e.progress >= 1) {
      this.addOutput(e, r.out, r.count);
      e.crafting = null;
      e.progress = 0;
    }
  }

  private updateAssembler(e: Entity) {
    const d = e.def;
    const r = e.recipe ? RECIPE_BY_ID[e.recipe] : null;
    if (!r) {
      e.working = false;
      e.status = 'Choose a recipe';
      return;
    }
    if (!e.crafting) {
      if (e.output && e.output.n >= Math.max(r.count * 4, 10)) {
        e.working = false;
        e.status = 'Output full';
        return;
      }
      const missing = r.ing.find(([it, n]) => (e.input[it] ?? 0) < n);
      if (missing) {
        e.working = false;
        e.status = 'Needs ' + ITEMS[missing[0]].name.toLowerCase();
        return;
      }
      for (const [it, n] of r.ing) {
        e.input[it]! -= n;
        if (!e.input[it]) delete e.input[it];
      }
      e.crafting = r.id;
      e.progress = 0;
    }
    const en = this.energy(e);
    if (en <= 0) {
      e.working = false;
      e.status = e.net < 0 ? 'Not connected to power' : 'No power';
      return;
    }
    e.working = true;
    e.status = 'Making ' + ITEMS[r.out].name;
    e.anim += en;
    e.progress += (en * (d.speed ?? 0.75)) / TPS / r.time;
    if (e.progress >= 1) {
      e.extra += asmProd(this);
      let bonus = 0;
      if (e.extra >= 1) {
        e.extra -= 1;
        bonus = r.count;
      }
      this.addOutput(e, r.out, r.count + bonus);
      e.crafting = null;
      e.progress = 0;
    }
  }

  private updateLab(e: Entity) {
    const tech = this.research ? TECH_BY_ID[this.research] : null;
    if (!tech) {
      e.working = false;
      e.status = 'No research chosen (press T)';
      return;
    }
    if (!e.crafting || e.crafting !== tech.id) {
      const missing = tech.packs.find((p) => (e.input[p] ?? 0) < 1);
      if (missing) {
        e.working = false;
        e.status = 'Needs ' + ITEMS[missing].name.toLowerCase();
        return;
      }
      for (const p of tech.packs) {
        e.input[p]! -= 1;
        if (!e.input[p]) delete e.input[p];
      }
      e.crafting = tech.id;
      e.progress = 0;
    }
    const en = this.energy(e);
    if (en <= 0) {
      e.working = false;
      e.status = e.net < 0 ? 'Not connected to power' : 'No power';
      return;
    }
    e.working = true;
    e.status = 'Researching ' + tech.name;
    e.anim += en;
    e.progress += (en * labSpeed(this)) / TPS / tech.time;
    if (e.progress >= 1) {
      e.crafting = null;
      e.progress = 0;
      this.researchUnits[tech.id] = (this.researchUnits[tech.id] ?? 0) + 1;
      if (this.researchUnits[tech.id] >= tech.units) this.finishResearch(tech.id);
    }
  }

  private finishResearch(id: string) {
    this.researched.add(id);
    this.research = null;
    this.applyBonuses();
    this.toast(`Research complete: ${TECH_BY_ID[id].name}`, 5);
    this.events.push('research');
    for (const e of this.ents.values()) if (e.def.kind === 'lab' && e.crafting === id) e.crafting = null;
  }

  private updateInserter(e: Entity) {
    const d = e.def;
    const reach = d.reach ?? 1;
    const sx = e.x - DX[e.dir] * reach, sy = e.y - DY[e.dir] * reach;
    const tx = e.x + DX[e.dir] * reach, ty = e.y + DY[e.dir] * reach;
    const dst = this.entAt(tx, ty);
    const step = ((d.speed ?? 0.85) * 2) / TPS;
    if (e.phase === 'pick') {
      e.working = false;
      const src = this.entAt(sx, sy);
      if (!src || !dst || src === dst) {
        e.status = !src ? 'Nothing to pick up from' : 'Nothing to drop into';
        return;
      }
      if (d.electric && e.sat <= 0) {
        e.status = e.net < 0 ? 'Not connected to power' : 'No power';
        return;
      }
      if (!d.electric && e.burn <= 0 && !e.fuel) {
        // A burner arm with no fuel can still grab fuel for itself.
        const it = this.take(src, (i) => this.isFuel(i));
        if (it) {
          e.fuel = { item: it, n: 1 };
        } else {
          e.status = 'No fuel';
          return;
        }
      }
      const filter = d.filter ? e.recipe : null;
      if (d.filter && !filter) {
        e.status = 'Pick an item to move';
        return;
      }
      const it = this.take(src, (i) => (!filter || i === filter) && this.accepts(dst, i) > 0);
      if (!it) {
        e.status = 'Waiting for items';
        return;
      }
      if (!d.electric && !e.fuel && this.isFuel(it)) {
        // fuel-up: a burner arm keeps a spare piece of fuel for itself before passing any on
        e.fuel = { item: it, n: 1 };
        e.status = 'Fueling up';
        return;
      }
      e.held = it;
      e.phase = 'swing';
      e.t = 0;
    }
    if (!d.electric && e.burn <= 0 && !e.fuel && e.held && this.isFuel(e.held)) {
      // ran dry mid-swing while carrying fuel: burn what it's holding
      e.fuel = { item: e.held, n: 1 };
      e.held = null;
      e.phase = 'back';
    }
    const en = this.energy(e);
    if (en <= 0) {
      e.status = d.electric ? 'No power' : 'No fuel';
      return;
    }
    e.working = true;
    e.status = 'Working';
    if (e.phase === 'swing') {
      e.t += step * en;
      if (e.t >= 1) {
        e.t = 1;
        e.phase = 'drop';
      }
    }
    if (e.phase === 'drop') {
      if (!e.held) e.phase = 'back';
      else if (dst && this.insert(dst, e.held, 1) === 1) {
        e.held = null;
        e.phase = 'back';
      } else if (!e.def.electric && !e.fuel && e.burn <= 0 && this.isFuel(e.held)) {
        e.fuel = { item: e.held, n: 1 };
        e.held = null;
        e.phase = 'back';
      } else {
        e.status = 'Waiting for space';
        e.working = false;
        return;
      }
    }
    if (e.phase === 'back') {
      e.t -= step * en;
      if (e.t <= 0) {
        e.t = 0;
        e.phase = 'pick';
      }
    }
  }

  // ---------- hand crafting ----------

  /** Hand recipe that makes this item (first unlocked one). */
  handRecipeFor(item: ItemId): Recipe | null {
    return RECIPES.find((r) => r.out === item && r.hand && this.unlocked(r)) ?? null;
  }

  /** Plans `times` crafts of a recipe, including intermediates. Returns ordered jobs or null. */
  planCraft(recipe: Recipe, times: number): CraftJob[] | null {
    const sim = new Map<ItemId, number>();
    for (const s of this.inv.slots) if (s) sim.set(s.item, (sim.get(s.item) ?? 0) + s.n);
    // queued jobs will consume their ingredients too; reserve them
    for (const j of this.craftQueue) {
      const r = RECIPE_BY_ID[j.recipe];
      for (const [it, n] of r.ing) sim.set(it, (sim.get(it) ?? 0) - n * j.count);
      sim.set(r.out, (sim.get(r.out) ?? 0) + r.count * j.count);
    }
    const jobs: CraftJob[] = [];
    const need = (r: Recipe, k: number, depth: number): boolean => {
      if (depth > 6) return false;
      for (const [it, n] of r.ing) {
        const want = n * k;
        const have = Math.max(0, sim.get(it) ?? 0);
        if (have < want) {
          const sub = this.handRecipeFor(it);
          if (!sub) return false;
          const times = Math.ceil((want - have) / sub.count);
          if (!need(sub, times, depth + 1)) return false;
          jobs.push({ recipe: sub.id, count: times });
          sim.set(it, (sim.get(it) ?? 0) + sub.count * times);
        }
        sim.set(it, (sim.get(it) ?? 0) - want);
      }
      return true;
    };
    if (!need(recipe, times, 0)) return null;
    jobs.push({ recipe: recipe.id, count: times });
    return jobs;
  }

  /** Largest count up to `max` that can be crafted right now. */
  craftable(recipe: Recipe, max = 50): number {
    if (!this.planCraft(recipe, 1)) return 0;
    let lo = 1, hi = max;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (this.planCraft(recipe, mid)) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  queueCraft(recipe: Recipe, times: number): boolean {
    const jobs = this.planCraft(recipe, times);
    if (!jobs) return false;
    for (const j of jobs) {
      const last = this.craftQueue[this.craftQueue.length - 1];
      if (last && last.recipe === j.recipe && jobs.length === 1) last.count += j.count;
      else this.craftQueue.push(j);
    }
    return true;
  }

  private updateCrafting() {
    const job = this.craftQueue[0];
    if (!job) return;
    const r = RECIPE_BY_ID[job.recipe];
    if (this.craftProgress === 0) {
      if (r.ing.some(([it, n]) => this.inv.count(it) < n)) {
        // ingredients vanished (used elsewhere): drop the job
        this.craftQueue.shift();
        this.toast(`Not enough ingredients for ${ITEMS[r.out].name}`);
        return;
      }
      for (const [it, n] of r.ing) this.inv.remove(it, n);
      this.craftProgress = 1e-6;
    }
    this.craftProgress += craftSpeed(this) / TPS / r.time;
    if (this.craftProgress >= 1) {
      this.craftProgress = 0;
      const added = this.inv.add(r.out, r.count);
      this.produced[r.out] = (this.produced[r.out] ?? 0) + r.count;
      if (added < r.count) this.toast('Inventory full!');
      this.events.push('craft');
      job.count--;
      if (job.count <= 0) this.craftQueue.shift();
    }
  }

  cancelCraft(index: number) {
    const job = this.craftQueue[index];
    if (!job) return;
    if (index === 0 && this.craftProgress > 0) {
      const r = RECIPE_BY_ID[job.recipe];
      for (const [it, n] of r.ing) this.inv.add(it, n);
      this.craftProgress = 0;
    }
    this.craftQueue.splice(index, 1);
  }

  // ---------- player ----------

  movePlayer(mx: number, my: number) {
    if (this.playerDead) {
      this.pmoving = false;
      return;
    }
    if (this.cs.shootStop > 0) {
      // planted to shoot: no walking for a moment
      mx = 0;
      my = 0;
    }
    const under = this.entAt(Math.floor(this.px), Math.floor(this.py));
    const sp = (PLAYER_SPEED * bootsMult(this) * legsMult(this) * (under?.def.kind === 'floor' ? 1.3 : 1)) / TPS;
    this.pmoving = mx !== 0 || my !== 0;
    if (this.pmoving) {
      const l = Math.hypot(mx, my);
      mx = (mx / l) * sp;
      my = (my / l) * sp;
      if (Math.abs(mx) > Math.abs(my)) this.pdir = mx > 0 ? 1 : 3;
      else this.pdir = my > 0 ? 2 : 0;
    }
    // belts carry the player
    if (under && under.def.kind === 'belt') {
      const v = (under.def.speed ?? 1.875) / TPS;
      mx += DX[under.dir] * v;
      my += DY[under.dir] * v;
    }
    if (mx && this.free(this.px + mx, this.py)) this.px += mx;
    if (my && this.free(this.px, this.py + my)) this.py += my;
  }

  private free(x: number, y: number): boolean {
    const r = 0.28;
    for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const tx = Math.floor(cx), ty = Math.floor(cy);
      if (!this.world.walkable(tx, ty)) return false;
      const e = this.entAt(tx, ty);
      if (e && solid(e.type)) return false;
    }
    return true;
  }

  // ---------- main tick ----------

  step() {
    this.tick++;
    this.updatePower();
    for (const e of this.ents.values()) {
      switch (e.def.kind) {
        case 'belt': this.updateBelt(e); break;
        case 'inserter': this.updateInserter(e); break;
        case 'drill': this.updateDrill(e); break;
        case 'furnace': this.updateFurnace(e); break;
        case 'assembler': this.updateAssembler(e); break;
        case 'lab': if (!this.remote) this.updateLab(e); break;
        case 'splitter': this.updateSplitter(e); break;
        case 'lamp': e.working = e.sat > 0 && this.daylight() < 0.6; break;
      }
    }
    this.updateCrafting();
    updateSuit(this);
    if (this.shooting && !this.playerDead) playerFire(this, this.aim ?? undefined);
    updateCombat(this);
    this.updatePlayerLife();
    this.toasts = this.toasts.filter((t) => t.until > this.tick);
  }

  // ---------- research ----------

  canResearch(id: string): boolean {
    const t = TECH_BY_ID[id];
    return !!t && !this.researched.has(id) && t.requires.every((r) => this.researched.has(r));
  }

  allResearched() {
    return TECHS.every((t) => this.researched.has(t.id));
  }

  // ---------- save ----------

  serializeEnts() {
    return [...this.ents.values()].map((e) => ({
      i: e.id, t: e.type, x: e.x, y: e.y, d: e.dir,
      f: e.fuel, b: e.burn, in: e.input, o: e.output, r: e.recipe, c: e.crafting, p: e.progress,
      inv: e.inv?.toJSON(), it: e.items, hp: e.hp, h: e.held, ph: e.phase, tt: e.t, pe: e.pending, cu: e.cursor, w: e.wire,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadEnts(list: any[]) {
    this.ents.clear();
    this.grid.fill(0);
    for (const d of list) {
      if (!ENTITIES[d.t as EntityType]) continue;
      const e = new Entity(d.i, d.t, d.x, d.y, d.d);
      e.fuel = d.f ?? null;
      e.burn = d.b ?? 0;
      e.input = d.in ?? {};
      e.output = d.o ?? null;
      e.recipe = d.r ?? null;
      e.crafting = d.c ?? null;
      e.progress = d.p ?? 0;
      if (e.inv && d.inv) e.inv.load(d.inv);
      e.items = d.it ?? [];
      e.held = d.h ?? null;
      e.phase = d.ph ?? 'pick';
      e.t = d.tt ?? 0;
      e.pending = d.pe ?? null;
      e.cursor = d.cu ?? 0;
      e.wire = d.w ?? [];
      if (typeof d.hp === 'number') e.hp = d.hp;
      this.ents.set(e.id, e);
      this.nextId = Math.max(this.nextId, e.id + 1);
      const def = e.def;
      for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) this.grid[(e.y + j) * WORLD + e.x + i] = e.id;
    }
    for (const e of this.ents.values()) if (e.def.kind === 'belt') this.updateCurves(e.x, e.y);
    this.netsDirty = true;
  }

  serialize() {
    const ents = this.serializeEnts();
    return {
      v: 1,
      world: this.world.serialize(),
      tick: this.tick,
      ents,
      px: this.px, py: this.py,
      inv: this.inv.toJSON(),
      queue: this.craftQueue, cp: this.craftProgress,
      researched: [...this.researched], research: this.research, units: this.researchUnits,
      produced: this.produced, won: this.won,
      enemies: this.enemies,
      bugs: this.cs.bugs, nests: this.cs.nests, evo: this.cs.evolution, php: this.cs.playerHp,
      pol: Array.from(this.cs.pollution, (v) => Math.round(v * 100) / 100),
      kills: this.kills, nd: this.nestsDestroyed, pr: this.pistolRounds,
      exp: b64(packExplored(this.explored)),
      suit: suitToJSON(this.suit),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static load(s: any): Game {
    const g = new Game(World.load(s.world));
    g.tick = s.tick ?? 0;
    g.px = s.px;
    g.py = s.py;
    g.inv.load(s.inv ?? []);
    g.craftQueue = (s.queue ?? []).filter((j: CraftJob) => RECIPE_BY_ID[j.recipe]);
    g.craftProgress = s.cp ?? 0;
    g.researched = new Set(s.researched ?? []);
    g.research = s.research ?? null;
    g.researchUnits = s.units ?? {};
    g.produced = s.produced ?? {};
    g.won = !!s.won;
    if (s.exp) unpackExplored(unb64(s.exp), g.explored);
    g.enemies = s.enemies ?? true;
    g.cs.bugs = s.bugs ?? [];
    g.cs.nests = s.nests ?? [];
    g.cs.nextBug = g.cs.bugs.reduce((m: number, b: { id: number }) => Math.max(m, b.id + 1), 1);
    g.cs.evolution = s.evo ?? 0;
    g.suit = suitFromJSON(s.suit);
    g.applyBonuses();
    g.cs.playerHp = s.php ?? g.maxHp();
    if (Array.isArray(s.pol)) g.cs.pollution.set(s.pol.slice(0, g.cs.pollution.length));
    g.kills = s.kills ?? 0;
    g.nestsDestroyed = s.nd ?? 0;
    g.pistolRounds = s.pr ?? 0;
    g.loadEnts(s.ents ?? []);
    g.netsDirty = true;
    return g;
  }
}

export function solid(type: EntityType): boolean {
  const k = ENTITIES[type].kind;
  return k !== 'belt' && k !== 'floor' && k !== 'splitter' && k !== 'mine';
}


/** Tile a drill drops its ore onto. */
export function drillOut(e: Entity): [number, number] {
  const { w, h } = e.def;
  switch (e.dir) {
    case 0: return [e.x + Math.floor((w - 1) / 2), e.y - 1];
    case 1: return [e.x + w, e.y + Math.floor((h - 1) / 2)];
    case 2: return [e.x + Math.ceil((w - 1) / 2), e.y + h];
    default: return [e.x - 1, e.y + Math.ceil((h - 1) / 2)];
  }
}
