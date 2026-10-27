import { MIN_MASS, SPEED, turnRateFor, WORLD_H, WORLD_W } from './constants';
import { angleDiff, clamp, dist2, wrapDelta } from './math';
import type { Snake, SnakeInput, World } from './world';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

interface Tuning {
  // Steps between decisions; slower bots react late.
  think: number;
  lookAhead: number;
  foodRange: number;
  // Random wobble added to each decision, in radians.
  noise: number;
  // Whether it sees other heads coming; easy bots blunder into head-on crashes.
  watchesHeads: boolean;
  hunts: boolean;
}

const TUNING: Record<Difficulty, Tuning> = {
  easy: { think: 14, lookAhead: 70, foodRange: 220, noise: 0.5, watchesHeads: false, hunts: false },
  normal: { think: 7, lookAhead: 130, foodRange: 360, noise: 0.2, watchesHeads: true, hunts: false },
  hard: { think: 3, lookAhead: 200, foodRange: 500, noise: 0.05, watchesHeads: true, hunts: true },
};

const CANDIDATES = [-1.6, -1.1, -0.7, -0.35, 0, 0.35, 0.7, 1.1, 1.6];

// One brain per bot (and per phone that has dropped out, which the bots fly until it returns).
export class Brain {
  private wait = 0;
  private input: SnakeInput = { s: 0, boost: false };

  constructor(public difficulty: Difficulty) {}

  decide(world: World, me: Snake): SnakeInput {
    if (!me.alive) return { s: 0, boost: false };
    if (this.wait > 0) {
      this.wait -= 1;
      return this.input;
    }
    const tune = TUNING[this.difficulty];
    this.wait = tune.think;
    this.input = chooseInput(world, me, tune);
    return this.input;
  }
}

function chooseInput(world: World, me: Snake, tune: Tuning): SnakeInput {
  const head = me.points[0];
  const target = pickTarget(world, me, tune);
  let bestScore = -Infinity;
  let bestAngle = me.heading;
  for (const offset of CANDIDATES) {
    const angle = me.heading + offset;
    const danger = dangerAlong(world, me, angle, tune.lookAhead, tune.watchesHeads);
    let score = -danger * 10 - Math.abs(offset) * 0.15;
    if (target) {
      const want = Math.atan2(wrapDelta(target.y - head.y, WORLD_H), wrapDelta(target.x - head.x, WORLD_W));
      score += Math.cos(angleDiff(angle, want)) * target.weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  bestAngle += (world.rng() - 0.5) * tune.noise;
  const s = clamp(angleDiff(bestAngle, me.heading) / 0.6, -1, 1);
  const boost = !!target?.chase && me.mass > MIN_MASS + 6 && dangerAlong(world, me, me.heading, tune.lookAhead * 1.5, true) === 0;
  return { s, boost };
}

interface Target {
  x: number;
  y: number;
  weight: number;
  chase: boolean;
}

function pickTarget(world: World, me: Snake, tune: Tuning): Target | null {
  const head = me.points[0];
  if (tune.hunts) {
    // Cut in front of a nearby much smaller snake's head.
    for (const other of world.snakes) {
      if (other === me || !other.alive || world.isProtected(other) || other.mass * 1.5 > me.mass) continue;
      const oh = other.points[0];
      if (dist2(head.x, head.y, oh.x, oh.y) > 220 * 220) continue;
      const lead = other.radius * 6;
      return {
        x: oh.x + Math.cos(other.heading) * lead,
        y: oh.y + Math.sin(other.heading) * lead,
        weight: 1.4,
        chase: true,
      };
    }
  }
  let best: Target | null = null;
  let bestValue = 0;
  const range2 = tune.foodRange * tune.foodRange;
  const turnCircle = (2 * SPEED) / turnRateFor(me.radius);
  const rivals = world.snakes.filter((s) => s !== me && s.alive).map((s) => s.points[0]);
  for (const f of world.food) {
    const d2 = dist2(head.x, head.y, f.x, f.y);
    if (d2 > range2) continue;
    // Leave food that another snake will reach first; racing for it ends in head-on crashes.
    if (tune.watchesHeads && rivals.some((r) => dist2(r.x, r.y, f.x, f.y) < d2)) continue;
    // Food off to the side inside the turning circle can't be reached; chasing it means orbiting forever.
    const side = Math.abs(angleDiff(Math.atan2(wrapDelta(f.y - head.y, WORLD_H), wrapDelta(f.x - head.x, WORLD_W)), me.heading));
    if (side > Math.PI / 3 && d2 < turnCircle * turnCircle) continue;
    const value = f.value / (Math.sqrt(d2) + 30);
    if (value > bestValue) {
      bestValue = value;
      best = { x: f.x, y: f.y, weight: 1, chase: false };
    }
  }
  return best;
}

// 0 when the way ahead is clear, rising toward 1 the closer the nearest body is.
export function dangerAlong(world: World, me: Snake, angle: number, lookAhead: number, watchHeads = true): number {
  const head = me.points[0];
  const step = 10;
  for (let d = step; d <= lookAhead; d += step) {
    const x = head.x + Math.cos(angle) * d;
    const y = head.y + Math.sin(angle) * d;
    if (world.bodyNear(x, y, me.radius * 1.2, me)) return 1 - d / (lookAhead + step);
    if (!watchHeads) continue;
    // Where each other head will be by the time we get here, assuming it keeps going straight.
    for (const other of world.snakes) {
      if (other === me || !other.alive || world.isProtected(other)) continue;
      const oh = other.points[0];
      const ox = oh.x + Math.cos(other.heading) * d;
      const oy = oh.y + Math.sin(other.heading) * d;
      const reach = (me.radius + other.radius) * 2;
      if (dist2(x, y, ox, oy) < reach * reach) return 1 - d / (lookAhead + step);
    }
  }
  return 0;
}
