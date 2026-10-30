// Springy layout for face bubbles: each bubble is pulled toward its spot on the map, bounces off
// the others, and a final pass guarantees no two bubbles overlap.

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Where the bubble wants to be, in screen pixels. */
  ax: number;
  ay: number;
  /** Bubbles in the same family attract each other a little, so families cluster. */
  family: string;
  /** Flying bubbles follow their arc tightly and only bump into other flying bubbles. */
  flying: boolean;
  /** Bubbles that aren't drawn (not born yet) take no part. */
  active: boolean;
}

export const GAP = 3;

const SPRING = 55;
const DAMPING = 7.5;
const FLY_SPRING = 900;
const FLY_DAMPING = 60;
const FAMILY = 14;
const RESTITUTION = 0.35;
const SOLVE_PASSES = 80;

export function step(bodies: Body[], dt: number): void {
  const live = bodies.filter((b) => b.active);
  for (const b of live) {
    const k = b.flying ? FLY_SPRING : SPRING;
    const c = b.flying ? FLY_DAMPING : DAMPING;
    let fx = k * (b.ax - b.x) - c * b.vx;
    let fy = k * (b.ay - b.y) - c * b.vy;
    if (!b.flying) {
      for (const o of live) {
        if (o === b || o.flying || o.family !== b.family) continue;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d = Math.hypot(dx, dy);
        const rest = b.r + o.r + GAP;
        if (d > rest && d < rest * 4) {
          fx += (FAMILY * (d - rest) * dx) / d;
          fy += (FAMILY * (d - rest) * dy) / d;
        }
      }
    }
    b.vx += fx * dt;
    b.vy += fy * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  bounce(live);
  separate(live);
}

function collides(a: Body, b: Body): boolean {
  return a.flying === b.flying;
}

/** Exchange a bit of momentum between bubbles that touch, so they visibly bump. */
function bounce(live: Body[]): void {
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (!collides(a, b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      if (d >= a.r + b.r + GAP) continue;
      const nx = dx / d;
      const ny = dy / d;
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing >= 0) continue;
      const impulse = (-(1 + RESTITUTION) * closing) / 2;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }
}

/** Push overlapping bubbles apart until none overlap. Bigger bubbles move less. */
export function separate(live: Body[]): void {
  for (let pass = 0; pass < SOLVE_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (!collides(a, b)) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + GAP;
        if (d >= min) continue;
        if (d < 0.0001) {
          // Same spot: split them along a direction that depends on their ids, so it is stable.
          const angle = (hash(a.id + b.id) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        const push = (min - d) / d;
        const wa = b.r / (a.r + b.r);
        const wb = a.r / (a.r + b.r);
        a.x -= dx * push * wa;
        a.y -= dy * push * wa;
        b.x += dx * push * wb;
        b.y += dy * push * wb;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
