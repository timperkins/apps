// The yard simulation. The host's game (or a solo game) runs this; friends get snapshots of it.
import {
  DEATH_DROP, FOOD, FOOD_KINDS, FOOD_TARGET, HEAL_PER_SEC, MAX_LEVEL, NPC_TARGET, STAGES, WORLD,
  foodNeeded, meatFor, power, type FoodKind,
} from './data';
import { collide, makeWorld, openSpot, wetness, type World } from './world';

export interface Ant {
  id: number;
  /** player slot (0 is the host), or -1 for wild ants */
  slot: number;
  name: string;
  level: number;
  rebirths: number;
  food: number;
  hp: number;
  x: number;
  y: number;
  a: number;
  moving: boolean;
  cool: number;
  /** counts down after a bite, for the jaw animation */
  bite: number;
  /** counts down after getting hurt, for the flash */
  hurt: number;
  /** players: seconds until they hatch again after dying */
  dead: number;
  // wild ant brain
  angry: boolean;
  target: number;
  wanderA: number;
  wanderT: number;
  lastHitBy: number;
  /** goes up each time a player hatches somewhere new, so friends know to jump there */
  spawn: number;
}

export interface Food { id: number; x: number; y: number; k: FoodKind; v: number }

export interface Input { mx: number; my: number; bite: boolean }

export type GameEvent =
  | { e: 'eat'; slot: number; v: number; x: number; y: number }
  | { e: 'bite'; x: number; y: number; big: boolean }
  | { e: 'hurt'; slot: number }
  | { e: 'kill'; x: number; y: number; level: number; by: number }
  | { e: 'die'; slot: number; by: string; level: number }
  | { e: 'evolve'; slot: number; level: number }
  | { e: 'rebirth'; slot: number; rebirths: number };

export const maxHp = (a: { level: number; rebirths: number }) => STAGES[a.level].hp * power(a.rebirths);
export const reachOf = (a: Ant) => STAGES[a.level].size * 0.62 + 8;
export const radiusOf = (level: number) => STAGES[level].size * 0.32;

/** Move an ant by a stick direction. Used by the host for every ant and by friends for their own ant. */
export function moveAnt(w: World, a: { level: number; rebirths: number; x: number; y: number; a: number; moving: boolean }, mx: number, my: number, dt: number) {
  const len = Math.hypot(mx, my);
  a.moving = len > 0.08;
  if (!a.moving) return;
  const k = Math.min(1, len);
  const st = STAGES[a.level];
  const wet = wetness(w, a.x, a.y);
  // bigger ants wade through puddles better
  const slow = wet > 0 ? Math.max(0.35, 0.55 - wet * 0.25 + a.level * 0.015) : 1;
  const sp = st.speed * slow * (1 + Math.min(0.3, a.rebirths * 0.03)) * k;
  const want = Math.atan2(my, mx);
  let d = want - a.a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  a.a += d * Math.min(1, dt * 14);
  const nx = a.x + (mx / len) * sp * dt, ny = a.y + (my / len) * sp * dt;
  [a.x, a.y] = collide(w, nx, ny, radiusOf(a.level));
}

export class Game {
  world: World;
  ants = new Map<number, Ant>();
  food = new Map<number, Food>();
  inputs = new Map<number, Input>();
  events: GameEvent[] = [];
  foodAdded: Food[] = [];
  foodRemoved: number[] = [];
  private nextId = 1;
  private rand: () => number;
  private t = 0;

  constructor(public seed: number) {
    this.world = makeWorld(seed);
    this.rand = Math.random;
    for (let i = 0; i < FOOD_TARGET; i++) this.spawnFood();
    for (let i = 0; i < NPC_TARGET; i++) this.spawnNpc();
    this.foodAdded = [];
  }

  // ---------- players ----------

  addPlayer(slot: number, name: string, level: number, food: number, rebirths: number): Ant {
    const old = this.playerAnt(slot);
    if (old) this.ants.delete(old.id);
    const [x, y] = this.startSpot();
    const a = this.newAnt(slot, name, level, x, y);
    a.food = food;
    a.rebirths = rebirths;
    a.hp = maxHp(a);
    this.ants.set(a.id, a);
    return a;
  }

  removePlayer(slot: number) {
    const a = this.playerAnt(slot);
    if (a) this.ants.delete(a.id);
    this.inputs.delete(slot);
  }

  playerAnt(slot: number): Ant | undefined {
    for (const a of this.ants.values()) if (a.slot === slot) return a;
    return undefined;
  }

  evolve(slot: number) {
    const a = this.playerAnt(slot);
    if (!a || a.dead > 0 || a.level >= MAX_LEVEL || a.food < foodNeeded(a.level)) return;
    const ratio = a.hp / maxHp(a);
    a.food = 0;
    a.level++;
    a.hp = Math.max(ratio, 0.6) * maxHp(a);
    this.events.push({ e: 'evolve', slot, level: a.level });
  }

  /** The J + K cheat: up one level right away, no food needed. */
  cheatLevel(slot: number) {
    const a = this.playerAnt(slot);
    if (!a || a.dead > 0 || a.level >= MAX_LEVEL) return;
    a.food = foodNeeded(a.level);
    this.evolve(slot);
  }

  rebirth(slot: number) {
    const a = this.playerAnt(slot);
    if (!a || a.dead > 0 || a.level < MAX_LEVEL || a.food < foodNeeded(a.level)) return;
    a.level = 0;
    a.food = 0;
    a.rebirths++;
    a.hp = maxHp(a);
    this.events.push({ e: 'rebirth', slot, rebirths: a.rebirths });
  }

  // ---------- spawning ----------

  private newAnt(slot: number, name: string, level: number, x: number, y: number): Ant {
    return {
      id: this.nextId++, slot, name, level, rebirths: 0, food: 0, hp: 1, x, y, a: this.rand() * Math.PI * 2, moving: false,
      cool: 0, bite: 0, hurt: 0, dead: 0, angry: false, target: 0, wanderA: this.rand() * Math.PI * 2, wanderT: 0, lastHitBy: 0, spawn: 0,
    };
  }

  private startSpot(): [number, number] {
    // near the middle, away from wild ants that are much bigger
    for (let i = 0; i < 30; i++) {
      const [x, y] = openSpot(this.world, this.rand, 40);
      const near = [...this.ants.values()].some((o) => o.slot < 0 && o.level > 4 && Math.hypot(o.x - x, o.y - y) < 500);
      if (!near) return [x, y];
    }
    return openSpot(this.world, this.rand, 40);
  }

  private spawnFood(kind?: FoodKind, x?: number, y?: number, v?: number) {
    let k = kind;
    if (!k) {
      let roll = this.rand() * FOOD_KINDS.reduce((s, f) => s + FOOD[f].weight, 0);
      k = FOOD_KINDS[0];
      for (const f of FOOD_KINDS) { roll -= FOOD[f].weight; if (roll <= 0) { k = f; break; } }
    }
    if (x === undefined || y === undefined) [x, y] = openSpot(this.world, this.rand, 20);
    const f: Food = { id: this.nextId++, x, y, k, v: v ?? FOOD[k].value };
    this.food.set(f.id, f);
    this.foodAdded.push(f);
  }

  private spawnNpc() {
    const players = [...this.ants.values()].filter((a) => a.slot >= 0);
    let level: number;
    if (players.length && this.rand() < 0.75) {
      const p = players[Math.floor(this.rand() * players.length)];
      level = p.level + Math.floor(this.rand() * 8) - 5;
    } else level = 1 + Math.floor(this.rand() * 12);
    if (this.rand() < 0.06) level = 14 + Math.floor(this.rand() * 7); // a rare giant
    level = Math.max(1, Math.min(MAX_LEVEL, level));
    let x = 0, y = 0;
    for (let i = 0; i < 20; i++) {
      [x, y] = openSpot(this.world, this.rand, 40);
      // not right on top of a player
      if (players.every((p) => Math.hypot(p.x - x, p.y - y) > 700)) break;
    }
    const a = this.newAnt(-1, STAGES[level].name, level, x, y);
    a.angry = this.rand() < 0.3;
    a.hp = maxHp(a);
    this.ants.set(a.id, a);
  }

  private retire() {
    const players = [...this.ants.values()].filter((a) => a.slot >= 0);
    if (!players.length) return;
    const npcs = [...this.ants.values()].filter((a) => a.slot < 0 && !a.target);
    const a = npcs[Math.floor(this.rand() * npcs.length)];
    if (!a) return;
    const near = players.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < 1000);
    const fits = players.some((p) => a.level >= p.level - 5 && a.level <= p.level + 3);
    if (!near && !fits) this.ants.delete(a.id);
  }

  // ---------- step ----------

  step(dt: number) {
    this.t += dt;
    if (this.food.size < FOOD_TARGET && this.rand() < dt * 30) this.spawnFood();
    let npcs = 0;
    for (const a of this.ants.values()) if (a.slot < 0) npcs++;
    if (npcs < NPC_TARGET && this.rand() < dt * 0.8) this.spawnNpc();
    // wild ants that don't fit anyone's level wander off when no player is near, so new ones can come
    if (this.rand() < dt * 2) this.retire();

    for (const a of this.ants.values()) {
      a.cool = Math.max(0, a.cool - dt);
      a.bite = Math.max(0, a.bite - dt);
      a.hurt = Math.max(0, a.hurt - dt);
      if (a.dead > 0) {
        a.dead -= dt;
        if (a.dead <= 0) {
          [a.x, a.y] = this.startSpot();
          a.hp = maxHp(a);
          a.dead = 0;
          a.spawn++;
        }
        continue;
      }
      a.hp = Math.min(maxHp(a), a.hp + maxHp(a) * HEAL_PER_SEC * dt);
      if (a.slot >= 0) {
        const inp = this.inputs.get(a.slot);
        // the host moves its own ant here; friends move theirs and send where they are
        if (inp && a.slot === 0) moveAnt(this.world, a, inp.mx, inp.my, dt);
        if (inp?.bite) this.tryBite(a);
        this.eat(a);
      } else this.think(a, dt);
    }
  }

  private eat(a: Ant) {
    const need = foodNeeded(a.level);
    const rad = radiusOf(a.level) + 6;
    for (const f of this.food.values()) {
      const dx = f.x - a.x, dy = f.y - a.y, r = rad + FOOD[f.k].r;
      if (dx * dx + dy * dy > r * r) continue;
      if (a.slot >= 0 && a.food >= need) break; // full: evolve first
      this.food.delete(f.id);
      this.foodRemoved.push(f.id);
      if (a.slot >= 0) {
        a.food = Math.min(need, a.food + f.v);
        this.events.push({ e: 'eat', slot: a.slot, v: f.v, x: f.x, y: f.y });
        // eggs hatch by themselves
        if (a.level === 0 && a.food >= need) this.evolve(a.slot);
      } else a.hp = Math.min(maxHp(a), a.hp + f.v * 2);
    }
  }

  tryBite(a: Ant) {
    if (a.cool > 0 || a.dead > 0 || a.level === 0) return;
    a.cool = 0.42;
    a.bite = 0.22;
    const reach = reachOf(a);
    let hit = false;
    for (const o of this.ants.values()) {
      if (o === a || o.dead > 0) continue;
      const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy);
      if (d > reach + radiusOf(o.level)) continue;
      let diff = Math.atan2(dy, dx) - a.a;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 1.15 && d > radiusOf(a.level)) continue;
      // wild ants bite a bit softer than players
      this.damage(o, STAGES[a.level].dmg * power(a.rebirths) * (a.slot < 0 ? 0.7 : 1) * (0.9 + this.rand() * 0.2), a);
      hit = true;
    }
    if (hit) this.events.push({ e: 'bite', x: a.x + Math.cos(a.a) * reach, y: a.y + Math.sin(a.a) * reach, big: a.level >= 12 });
  }

  private damage(o: Ant, dmg: number, by: Ant) {
    o.hp -= dmg;
    o.hurt = 0.18;
    o.lastHitBy = by.id;
    if (o.slot >= 0) this.events.push({ e: 'hurt', slot: o.slot });
    if (o.slot < 0) {
      o.target = by.id;
      if (o.hp < maxHp(o) * 0.3 && by.level > o.level + 1) o.target = -by.id; // run away
    }
    if (o.hp <= 0) this.kill(o, by);
  }

  private kill(o: Ant, by: Ant) {
    // meat: bigger ant, more meat, in chunks around where it fell
    let left = meatFor(o.level) * (o.slot >= 0 ? 1 + o.rebirths * 0.25 : 1);
    const chunks = Math.min(8, Math.max(1, Math.ceil(left / 30)));
    const spread = STAGES[o.level].size * 0.5;
    for (let i = 0; i < chunks; i++) {
      const v = Math.round(left / (chunks - i));
      left -= v;
      const ang = (i / chunks) * Math.PI * 2 + this.rand();
      const [x, y] = collide(this.world, o.x + Math.cos(ang) * spread * this.rand(), o.y + Math.sin(ang) * spread * this.rand(), 6);
      this.spawnFood('meat', x, y, v);
    }
    this.events.push({ e: 'kill', x: o.x, y: o.y, level: o.level, by: by.slot });
    if (o.slot >= 0) {
      this.events.push({ e: 'die', slot: o.slot, by: by.slot >= 0 ? by.name : `a ${STAGES[by.level].name}`, level: o.level });
      o.level = Math.max(0, o.level - DEATH_DROP);
      o.food = 0;
      o.hp = maxHp(o);
      o.dead = 2.5;
    } else this.ants.delete(o.id);
  }

  private think(a: Ant, dt: number) {
    let tx = 0, ty = 0, go = false, bite = false;
    // follow a grudge (or run from it)
    let target = a.target ? this.ants.get(Math.abs(a.target)) : undefined;
    if (target && (target.dead > 0 || Math.hypot(target.x - a.x, target.y - a.y) > 650)) { a.target = 0; target = undefined; }
    if (!target && a.angry && this.rand() < dt * 2) {
      // look for a player to pick on: not eggs, and not much bigger than itself
      let best = 300;
      for (const o of this.ants.values()) {
        if (o.slot < 0 || o.dead > 0 || o.level === 0 || o.level > a.level || o.level < a.level - 6) continue;
        const d = Math.hypot(o.x - a.x, o.y - a.y);
        if (d < best) { best = d; a.target = o.id; target = o; }
      }
    }
    if (target) {
      const dx = target.x - a.x, dy = target.y - a.y, d = Math.hypot(dx, dy);
      if (a.target < 0) { tx = -dx; ty = -dy; go = true; }
      else {
        tx = dx; ty = dy; go = d > reachOf(a) * 0.7 + radiusOf(target.level);
        if (d < reachOf(a) + radiusOf(target.level)) {
          a.a = Math.atan2(dy, dx);
          bite = true;
        }
      }
    } else {
      // wander, and nibble food on the way
      let best = 220, f: Food | undefined;
      if (this.rand() < dt * 3) {
        for (const x of this.food.values()) {
          const d = Math.hypot(x.x - a.x, x.y - a.y);
          if (d < best) { best = d; f = x; }
        }
      }
      if (f) a.wanderA = Math.atan2(f.y - a.y, f.x - a.x);
      a.wanderT -= dt;
      if (a.wanderT <= 0) { a.wanderA += (this.rand() - 0.5) * 2.2; a.wanderT = 1 + this.rand() * 2.5; }
      if (a.x < 150 || a.x > WORLD - 150 || a.y < 150 || a.y > WORLD - 150) a.wanderA = Math.atan2(WORLD / 2 - a.y, WORLD / 2 - a.x);
      tx = Math.cos(a.wanderA); ty = Math.sin(a.wanderA); go = a.wanderT > 0.5;
      this.eat(a);
    }
    const len = Math.hypot(tx, ty) || 1;
    const k = target ? 0.85 : 0.45;
    if (go) moveAnt(this.world, a, (tx / len) * k, (ty / len) * k, dt);
    else a.moving = false;
    if (bite) {
      const cool = a.cool;
      this.tryBite(a);
      if (cool === 0) a.cool = 0.9 + this.rand() * 0.4; // wild ants bite slower than players
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
