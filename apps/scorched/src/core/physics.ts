import {
  BARREL_LEN,
  CHUTE_HALF_W,
  CHUTE_BOTTOM,
  CHUTE_TOP,
  PLANE_HALF_H,
  PLANE_HALF_W,
  POWER_TO_SPEED,
  TANK_H,
  TANK_HALF_W,
  WORLD_W,
} from './constants';
import type { Terrain } from './terrain';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PhysicsEnv {
  width: number;
  gravity: number;
  /** Horizontal acceleration from wind, px/s^2. */
  windAccel: number;
}

export interface TankShape {
  x: number;
  y: number;
  alive: boolean;
  /** An open parachute above the tank can be shot as well as the tank itself. */
  flight?: string | null;
}

/** A plane's center, and whether it can still be hit. */
export interface PlaneShape {
  x: number;
  y: number;
  flying: boolean;
}

export type Hit =
  | { kind: 'terrain'; x: number; y: number }
  | { kind: 'tank'; tank: number; x: number; y: number }
  | { kind: 'plane'; plane: number; x: number; y: number }
  | { kind: 'chute'; tank: number; x: number; y: number };

/** The map wraps around: a column off one side is the same as one on the other. */
export function wrapX(x: number, width = WORLD_W): number {
  return ((x % width) + width) % width;
}

/** Shortest horizontal offset from `from` to `to` on the wrapped map. */
export function wrapDx(from: number, to: number, width = WORLD_W): number {
  const d = wrapX(to - from, width);
  return d > width / 2 ? d - width : d;
}

/** Tip of the barrel for a tank whose treads rest at (x, y). Angle 0 = right, 90 = up. */
export function muzzle(x: number, y: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: x + Math.cos(a) * BARREL_LEN, y: y - TANK_H - Math.sin(a) * BARREL_LEN };
}

export function launchVelocity(angleDeg: number, power: number): { vx: number; vy: number } {
  const a = (angleDeg * Math.PI) / 180;
  const speed = power * POWER_TO_SPEED;
  return { vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
}

/** Index of the living tank covering (x, y), or -1. */
export function tankAt(tanks: readonly TankShape[], x: number, y: number): number {
  for (let i = 0; i < tanks.length; i++) {
    const t = tanks[i];
    if (!t.alive) continue;
    if (Math.abs(wrapDx(t.x, x)) <= TANK_HALF_W && y >= t.y - TANK_H - 2 && y <= t.y) return i;
  }
  return -1;
}

/** Index of the flying plane covering (x, y), or -1. */
export function planeAt(planes: readonly PlaneShape[], x: number, y: number): number {
  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    if (p.flying && Math.abs(wrapDx(p.x, x)) <= PLANE_HALF_W && Math.abs(y - p.y) <= PLANE_HALF_H) return i;
  }
  return -1;
}

/** Index of the living tank whose open parachute covers (x, y), or -1. */
export function chuteAt(tanks: readonly TankShape[], x: number, y: number): number {
  for (let i = 0; i < tanks.length; i++) {
    const t = tanks[i];
    if (!t.alive || t.flight !== 'chute') continue;
    if (Math.abs(wrapDx(t.x, x)) <= CHUTE_HALF_W && y >= t.y - CHUTE_TOP && y <= t.y - CHUTE_BOTTOM) return i;
  }
  return -1;
}

/**
 * Advances a body by one step under gravity and wind, checking every pixel of the
 * path for collisions. Mutates the body and returns what it hit, if anything.
 */
export function stepBody(
  b: Body,
  dt: number,
  env: PhysicsEnv,
  terrain: Terrain,
  tanks: readonly TankShape[],
  planes: readonly PlaneShape[] = [],
): Hit | null {
  b.vx += env.windAccel * dt;
  b.vy += env.gravity * dt;
  const x0 = b.x;
  const y0 = b.y;
  const x1 = x0 + b.vx * dt;
  const y1 = y0 + b.vy * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 1; i <= n; i++) {
    const px = wrapX(x0 + ((x1 - x0) * i) / n, env.width);
    const py = y0 + ((y1 - y0) * i) / n;
    const pl = planes.length ? planeAt(planes, px, py) : -1;
    if (pl >= 0) {
      b.x = px;
      b.y = py;
      return { kind: 'plane', plane: pl, x: px, y: py };
    }
    const c = chuteAt(tanks, px, py);
    if (c >= 0) {
      b.x = px;
      b.y = py;
      return { kind: 'chute', tank: c, x: px, y: py };
    }
    const t = tankAt(tanks, px, py);
    if (t >= 0) {
      b.x = px;
      b.y = py;
      return { kind: 'tank', tank: t, x: px, y: py };
    }
    if (terrain.isSolid(px, py)) {
      b.x = px;
      b.y = py;
      return { kind: 'terrain', x: px, y: py };
    }
  }
  b.x = wrapX(x1, env.width);
  b.y = y1;
  return null;
}
