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
  /** Flying bubbles follow their arc tightly. */
  flying: boolean;
  /** Bubbles still high in the air pass over the others and only bump into each other. */
  ghost?: boolean;
  /** Bubbles that aren't drawn (not born yet) take no part. */
  active: boolean;
}

// Space between bubble edges. The colored rings take 3.5px each, so family members' rings touch
// and there is a little air between families.
export const FAMILY_GAP = 8;
export const GAP = 18;

export function gapBetween(a: Body, b: Body): number {
  return a.family === b.family ? FAMILY_GAP : GAP;
}

const SPRING = 55;
const DAMPING = 7.5;
const FLY_SPRING = 900;
const FLY_DAMPING = 60;
const FAMILY = 14;
const SOLVE_PASSES = 160;
/** Share of each pass's pushes applied, so pushes from several sides at once don't overshoot. */
const RELAX = 0.5;
/** Pixels per second under which a bubble counts as resting. */
const REST_SPEED = 12;
/** A bubble only counts as resting once the push-apart it needs is this small, in pixels. */
const REST_PUSH = 1;
/** Share of a shove, up to MAX_BOUNCE pixels, kept as outward speed. */
const PUSH_BOUNCE = 0.5;
const MAX_BOUNCE = 3;
const CRAWL_SPEED = 20;
const CRAWL_FRICTION = 0.8;

export function step(bodies: Body[], dt: number): void {
  const live = bodies.filter((b) => b.active);
  const before = live.map((b) => [b.x, b.y]);
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
        const rest = b.r + o.r + FAMILY_GAP;
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
  const free = live.map((b) => [b.x, b.y]);
  separate(live);
  let rested = false;
  live.forEach((b, i) => {
    const dx = b.x - free[i][0];
    const dy = b.y - free[i][1];
    const push = Math.hypot(dx, dy);
    if (push > 0.001) {
      const nx = dx / push;
      const ny = dy / push;
      // The push-apart moves a bubble without flinging it: a pressed bubble just stops heading
      // into the others...
      const into = b.vx * nx + b.vy * ny;
      if (into < 0) {
        b.vx -= into * nx;
        b.vy -= into * ny;
      }
      // ...and when another bubble shoves it, it keeps a little of that as speed, for a small
      // bounce as bubbles make room.
      const shove = push - Math.max(0, -into) * dt;
      if (shove > REST_PUSH) {
        const kept = Math.min(shove, MAX_BOUNCE) * PUSH_BOUNCE;
        b.vx += (nx * kept) / dt;
        b.vy += (ny * kept) / dt;
      }
    }
    // Slow bubbles feel extra friction, so a settled group comes to a stop instead of drifting.
    if (!b.flying && Math.hypot(b.vx, b.vy) < CRAWL_SPEED) {
      b.vx *= CRAWL_FRICTION;
      b.vy *= CRAWL_FRICTION;
    }
    // A bubble pressed against others that is only crawling stays put rather than creeping.
    const moved = Math.hypot(b.x - before[i][0], b.y - before[i][1]) / dt;
    if (push > 0.001 && push < REST_PUSH && !b.flying && moved < REST_SPEED) {
      b.x = before[i][0];
      b.y = before[i][1];
      b.vx = b.vy = 0;
      rested = true;
    }
  });
  // Putting resting bubbles back can't be allowed to leave an overlap.
  if (rested) separate(live);
}

function collides(a: Body, b: Body): boolean {
  return !!a.ghost === !!b.ghost;
}

/**
 * Push overlapping bubbles apart until none overlap. Bigger bubbles move less. Each pass works out
 * every pair from the same positions, so the order of the list favors no one and a squeezed crowd
 * doesn't slowly turn.
 */
export function separate(live: Body[]): void {
  const n = live.length;
  const cx = new Float64Array(n);
  const cy = new Float64Array(n);
  for (let pass = 0; pass < SOLVE_PASSES; pass++) {
    cx.fill(0);
    cy.fill(0);
    let worst = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = live[i];
        const b = live[j];
        if (!collides(a, b)) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + gapBetween(a, b);
        if (d >= min) continue;
        worst = Math.max(worst, min - d);
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
        cx[i] -= dx * push * wa;
        cy[i] -= dy * push * wa;
        cx[j] += dx * push * wb;
        cy[j] += dy * push * wb;
      }
    }
    if (worst < 0.01) return;
    for (let i = 0; i < n; i++) {
      live[i].x += cx[i] * RELAX;
      live[i].y += cy[i] * RELAX;
    }
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
