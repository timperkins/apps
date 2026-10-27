import {
  BOOST_COST,
  BOOST_DROP_EVERY_S,
  BOOST_DROP_SHARE,
  BOOST_SPEED,
  DEATH_DROP_SHARE,
  FOOD_MAX,
  FOOD_TARGET,
  lengthFor,
  MAGNET,
  MIN_MASS,
  PROTECT_S,
  radiusFor,
  RESPAWN_S,
  SPACING,
  SPEED,
  START_MASS,
  turnRateFor,
  WORLD_H,
  WORLD_W,
} from './constants';
import { SpatialGrid } from './grid';
import type { Look } from './looks';
import { clamp, dist2, makeRng, wrap, wrapDelta, type Vec } from './math';

export interface Snake extends Look {
  id: string;
  bot: boolean;
  alive: boolean;
  // Head first. Coordinates are always wrapped into the world.
  points: Vec[];
  heading: number;
  mass: number;
  radius: number;
  // World time until which the snake can neither kill nor die.
  protectedUntil: number;
  respawnAt: number;
  kills: number;
  best: number;
  boosting: boolean;
  boostDropTimer: number;
  boostDropMass: number;
}

export interface Food {
  x: number;
  y: number;
  value: number;
  radius: number;
  color: string;
  // Food from a death or a boost; it is drawn brighter.
  rich: boolean;
}

export interface SnakeInput {
  // Turn amount, -1 (hard left) to 1 (hard right).
  s: number;
  boost: boolean;
}

export type WorldEvent =
  | { type: 'eat'; id: string }
  | { type: 'death'; id: string; by: string | null; x: number; y: number; color: string }
  | { type: 'spawn'; id: string };

const NATURAL_FOOD_COLORS = ['#ff5a5f', '#ffd23f', '#3ddc84', '#3fa7ff', '#9d4edd', '#f15bb5', '#2ec4b6', '#ff9f1c'];

export function foodRadius(value: number): number {
  return Math.min(9, 2.5 + value * 1.4);
}

export class World {
  snakes: Snake[] = [];
  food: Food[] = [];
  time = 0;
  // Natural food is topped up toward this count.
  foodTarget = FOOD_TARGET;
  readonly rng: () => number;
  private grid = new SpatialGrid();
  private maxRadius = 0;

  constructor(seed = Date.now()) {
    this.rng = makeRng(seed);
    this.refillFood(FOOD_TARGET);
  }

  get(id: string): Snake | undefined {
    return this.snakes.find((s) => s.id === id);
  }

  addSnake(id: string, look: Look, bot: boolean): Snake {
    const snake: Snake = {
      id,
      ...look,
      bot,
      alive: false,
      points: [],
      heading: 0,
      mass: START_MASS,
      radius: radiusFor(START_MASS),
      protectedUntil: 0,
      respawnAt: this.time,
      kills: 0,
      best: START_MASS,
      boosting: false,
      boostDropTimer: 0,
      boostDropMass: 0,
    };
    this.snakes.push(snake);
    this.spawn(snake);
    return snake;
  }

  removeSnake(id: string): void {
    this.snakes = this.snakes.filter((s) => s.id !== id);
  }

  // Fresh round: every snake back to starting size, new food, scores cleared.
  reset(): void {
    this.food = [];
    this.refillFood(this.foodTarget);
    for (const snake of this.snakes) {
      snake.kills = 0;
      snake.best = START_MASS;
      this.spawn(snake);
    }
  }

  spawn(snake: Snake): void {
    const at = this.clearSpot();
    snake.alive = true;
    snake.mass = START_MASS;
    snake.radius = radiusFor(START_MASS);
    snake.heading = this.rng() * Math.PI * 2;
    snake.protectedUntil = this.time + PROTECT_S;
    snake.boosting = false;
    snake.boostDropTimer = 0;
    snake.boostDropMass = 0;
    const count = Math.ceil(lengthFor(snake.mass) / SPACING) + 1;
    snake.points = [];
    for (let i = 0; i < count; i++) {
      snake.points.push({
        x: wrap(at.x - Math.cos(snake.heading) * SPACING * i, WORLD_W),
        y: wrap(at.y - Math.sin(snake.heading) * SPACING * i, WORLD_H),
      });
    }
  }

  // The best of a few random spots, judged by distance to the nearest snake.
  private clearSpot(): Vec {
    let best: Vec = { x: this.rng() * WORLD_W, y: this.rng() * WORLD_H };
    let bestScore = -1;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = this.rng() * WORLD_W;
      const y = this.rng() * WORLD_H;
      let nearest = Infinity;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        for (let i = 0; i < s.points.length; i += 4) {
          nearest = Math.min(nearest, dist2(x, y, s.points[i].x, s.points[i].y));
        }
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x, y };
      }
    }
    return best;
  }

  isProtected(snake: Snake): boolean {
    return snake.protectedUntil > this.time;
  }

  step(dt: number, inputs: Map<string, SnakeInput>): WorldEvent[] {
    this.time += dt;
    const events: WorldEvent[] = [];

    for (const snake of this.snakes) {
      if (!snake.alive) {
        if (this.time >= snake.respawnAt) {
          this.spawn(snake);
          events.push({ type: 'spawn', id: snake.id });
        }
        continue;
      }
      this.move(snake, inputs.get(snake.id) ?? { s: 0, boost: false }, dt);
    }

    this.collide(events);
    this.eat(events, dt);
    if (this.food.length < this.foodTarget) this.refillFood(2);
    return events;
  }

  private move(snake: Snake, input: SnakeInput, dt: number): void {
    const s = Number.isFinite(input.s) ? clamp(input.s, -1, 1) : 0;
    snake.heading += s * turnRateFor(snake.radius) * dt;
    snake.boosting = !!input.boost && snake.mass > MIN_MASS;
    let speed = SPEED;
    if (snake.boosting) {
      speed = BOOST_SPEED;
      const spent = Math.min(BOOST_COST * dt, snake.mass - MIN_MASS);
      snake.mass -= spent;
      snake.boostDropMass += spent * BOOST_DROP_SHARE;
      snake.boostDropTimer += dt;
      if (snake.boostDropTimer >= BOOST_DROP_EVERY_S && snake.boostDropMass > 0) {
        const tail = snake.points[snake.points.length - 1];
        this.addFood(tail.x, tail.y, snake.boostDropMass, snake.color, true);
        snake.boostDropTimer = 0;
        snake.boostDropMass = 0;
      }
    }

    const head = snake.points[0];
    head.x = wrap(head.x + Math.cos(snake.heading) * speed * dt, WORLD_W);
    head.y = wrap(head.y + Math.sin(snake.heading) * speed * dt, WORLD_H);
    // Lay a new body point once the head is a full spacing ahead of the last one.
    const next = snake.points[1];
    if (next && dist2(head.x, head.y, next.x, next.y) >= SPACING * SPACING) {
      snake.points.splice(1, 0, { x: head.x, y: head.y });
    }
    snake.radius = radiusFor(snake.mass);
    const keep = Math.ceil(lengthFor(snake.mass) / SPACING) + 1;
    if (snake.points.length > keep) snake.points.length = keep;
  }

  private collide(events: WorldEvent[]): void {
    const grid = this.grid;
    grid.clear();
    const solid = this.snakes.map((s) => s.alive && !this.isProtected(s));
    let maxRadius = 0;
    this.snakes.forEach((s, si) => {
      if (!solid[si]) return;
      maxRadius = Math.max(maxRadius, s.radius);
      for (let pi = 0; pi < s.points.length; pi++) grid.insert(s.points[pi].x, s.points[pi].y, si, pi);
    });

    // Decide every death first, then apply them, so a head-on crash kills both snakes.
    const killedBy = new Map<number, number>();
    this.maxRadius = maxRadius;
    this.snakes.forEach((a, ai) => {
      if (!solid[ai]) return;
      const head = a.points[0];
      let hit = -1;
      grid.query(head.x, head.y, a.radius + maxRadius, (bi, pi) => {
        if (hit !== -1 || bi === ai) return;
        const b = this.snakes[bi];
        const p = b.points[pi];
        const reach = (a.radius + b.radius) * 0.8;
        if (dist2(head.x, head.y, p.x, p.y) < reach * reach) hit = bi;
      });
      if (hit !== -1) killedBy.set(ai, hit);
    });

    for (const [ai, bi] of killedBy) {
      const victim = this.snakes[ai];
      const killer = this.snakes[bi];
      killer.kills += 1;
      this.kill(victim, killer.id, events);
    }
  }

  // True if another snake's body is within `radius` of the point, using the grid from the last step.
  bodyNear(x: number, y: number, radius: number, self: Snake): boolean {
    let found = false;
    this.grid.query(x, y, radius + this.maxRadius, (bi, pi) => {
      if (found) return;
      const b = this.snakes[bi];
      if (b === self || !b || !b.alive) return;
      const p = b.points[pi];
      if (!p) return;
      const reach = radius + b.radius;
      if (dist2(x, y, p.x, p.y) < reach * reach) found = true;
    });
    return found;
  }

  kill(snake: Snake, by: string | null, events: WorldEvent[]): void {
    if (!snake.alive) return;
    const head = snake.points[0];
    events.push({ type: 'death', id: snake.id, by, x: head.x, y: head.y, color: snake.color });
    this.dropBody(snake);
    snake.alive = false;
    snake.respawnAt = this.time + RESPAWN_S;
    snake.points = [];
    snake.boosting = false;
  }

  // Spreads most of the snake's mass along where its body lay.
  private dropBody(snake: Snake): void {
    const total = snake.mass * DEATH_DROP_SHARE;
    const pieces = Math.max(1, Math.min(Math.ceil(total / 1.5), Math.ceil(snake.points.length / 2)));
    const value = total / pieces;
    for (let i = 0; i < pieces; i++) {
      const p = snake.points[Math.floor((i / pieces) * snake.points.length)];
      const jx = (this.rng() - 0.5) * snake.radius * 1.6;
      const jy = (this.rng() - 0.5) * snake.radius * 1.6;
      this.addFood(p.x + jx, p.y + jy, value, snake.color, true);
    }
  }

  private eat(events: WorldEvent[], dt: number): void {
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const head = snake.points[0];
      const reach = snake.radius + MAGNET;
      let ate = false;
      for (let i = this.food.length - 1; i >= 0; i--) {
        const f = this.food[i];
        const dx = wrapDelta(head.x - f.x, WORLD_W);
        const dy = wrapDelta(head.y - f.y, WORLD_H);
        const d2 = dx * dx + dy * dy;
        if (d2 > reach * reach) continue;
        const mouth = snake.radius + f.radius;
        if (d2 <= mouth * mouth) {
          snake.mass += f.value;
          this.food[i] = this.food[this.food.length - 1];
          this.food.pop();
          ate = true;
          continue;
        }
        // Drift toward the mouth.
        const d = Math.sqrt(d2);
        const pull = Math.min(d, 220 * dt);
        f.x = wrap(f.x + (dx / d) * pull, WORLD_W);
        f.y = wrap(f.y + (dy / d) * pull, WORLD_H);
      }
      if (ate) {
        snake.best = Math.max(snake.best, snake.mass);
        events.push({ type: 'eat', id: snake.id });
      }
    }
  }

  addFood(x: number, y: number, value: number, color: string, rich: boolean): void {
    if (this.food.length >= FOOD_MAX) {
      // Over the cap: fold the value into an existing piece instead of adding one.
      const f = this.food[Math.floor(this.rng() * this.food.length)];
      f.value += value;
      f.radius = foodRadius(f.value);
      return;
    }
    this.food.push({ x: wrap(x, WORLD_W), y: wrap(y, WORLD_H), value, radius: foodRadius(value), color, rich });
  }

  private refillFood(count: number): void {
    for (let i = 0; i < count; i++) {
      const roll = this.rng();
      const value = roll < 0.7 ? 1 : roll < 0.95 ? 2 : 4;
      const color = NATURAL_FOOD_COLORS[Math.floor(this.rng() * NATURAL_FOOD_COLORS.length)];
      this.addFood(this.rng() * WORLD_W, this.rng() * WORLD_H, value, color, false);
    }
  }
}

// Biggest living snake when the timer runs out; a dead snake counts as size 0.
export function pickWinner(snakes: Snake[]): Snake | null {
  let winner: Snake | null = null;
  for (const s of snakes) {
    if (!s.alive) continue;
    if (!winner || s.mass > winner.mass) winner = s;
  }
  return winner;
}

// Living snakes biggest first, then the dead ones.
export function ranking(snakes: Snake[]): Snake[] {
  return [...snakes].sort((a, b) => Number(b.alive) - Number(a.alive) || b.mass - a.mass);
}
