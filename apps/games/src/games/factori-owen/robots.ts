// Advanced mode: roboports and their robots. A roboport with robots in it sends them out to fix
// damaged buildings within 25 tiles, and to rebuild buildings the bugs destroyed, using the item
// from a crate nearby.
import { ENTITIES, maxHp, type EntityType, type ItemId } from './data';
import type { Dir, Entity, Game } from './sim';

export const ROBO_RANGE = 25;
const BOT_SPEED = 8 / 60;
const REPAIR_PER_TICK = 0.6;
/** Ghosts are forgotten after ten minutes. */
const GHOST_TICKS = 60 * 60 * 10;

export interface Ghost {
  type: EntityType;
  x: number;
  y: number;
  dir: number;
  t: number; // tick it was destroyed
}

export interface Bot {
  port: number;
  x: number;
  y: number;
  /** what it is going to: an entity to fix, or a ghost to build */
  fix: number;
  ghost: Ghost | null;
  carry: ItemId | null;
  from: number; // crate the item came from
  phase: 'go' | 'work' | 'back';
  t: number;
}

const inRange = (e: Entity, x: number, y: number) => Math.abs(x - e.cx) <= ROBO_RANGE && Math.abs(y - e.cy) <= ROBO_RANGE;

export function addGhost(g: Game, e: Entity) {
  if (!g.advanced || e.def.kind === 'mine' || e.def.kind === 'silo') return;
  g.ghosts.push({ type: e.type, x: e.x, y: e.y, dir: e.dir, t: g.tick });
  if (g.ghosts.length > 200) g.ghosts.shift();
}

/** Building over a ghost's spot clears it. */
export function clearGhosts(g: Game, e: Entity) {
  if (!g.ghosts.length) return;
  g.ghosts = g.ghosts.filter((h) => {
    const d = ENTITIES[h.type];
    return h.x >= e.x + e.w || h.x + d.w <= e.x || h.y >= e.y + e.h || h.y + d.h <= e.y;
  });
}

export function updateRoboport(g: Game, e: Entity) {
  const robots = e.input.robot ?? 0;
  const mine = g.bots.filter((b) => b.port === e.id);
  if (e.net < 0 || e.sat <= 0) {
    e.working = false;
    e.status = e.net < 0 ? 'Not connected to power' : 'No power';
  } else if (!robots) {
    e.working = false;
    e.status = 'Put robots in it';
  } else {
    e.working = mine.length > 0;
    e.status = `${robots} robot(s) · ${mine.length} busy`;
  }
  if (g.ghosts.length && g.tick % 600 === 0) g.ghosts = g.ghosts.filter((h) => g.tick - h.t < GHOST_TICKS);
  if (e.sat <= 0 || mine.length >= robots || g.tick % 20 !== e.id % 20) return;
  const busy = new Set(g.bots.map((b) => b.fix));
  // fix the most damaged building first
  let worst: Entity | null = null, wf = 1;
  for (const o of g.ents.values()) {
    if (busy.has(o.id) || !inRange(e, o.cx, o.cy)) continue;
    const f = o.hp / maxHp(o.type);
    if (f < wf) {
      wf = f;
      worst = o;
    }
  }
  if (worst) {
    g.bots.push({ port: e.id, x: e.cx, y: e.cy - 0.5, fix: worst.id, ghost: null, carry: null, from: 0, phase: 'go', t: 0 });
    return;
  }
  // rebuild a ghost with an item from a crate in range
  const taken = new Set(g.bots.map((b) => b.ghost));
  for (const h of g.ghosts) {
    if (taken.has(h) || !inRange(e, h.x, h.y)) continue;
    const item = ENTITIES[h.type].item;
    const crate = [...g.ents.values()].find((c) => c.def.kind === 'chest' && inRange(e, c.cx, c.cy) && c.inv!.count(item) > 0);
    if (!crate) continue;
    crate.inv!.remove(item, 1);
    g.bots.push({ port: e.id, x: e.cx, y: e.cy - 0.5, fix: -1, ghost: h, carry: item, from: crate.id, phase: 'go', t: 0 });
    return;
  }
}

/** Moves every robot one tick (the host only). */
export function updateBots(g: Game) {
  for (const b of g.bots) {
    const port = g.ents.get(b.port);
    const target = b.fix > 0 ? g.ents.get(b.fix) : null;
    let tx: number, ty: number;
    if (b.phase === 'back') {
      if (!port) {
        b.t = -1;
        continue;
      }
      tx = port.cx;
      ty = port.cy - 0.5;
    } else if (b.ghost) {
      const d = ENTITIES[b.ghost.type];
      tx = b.ghost.x + d.w / 2;
      ty = b.ghost.y + d.h / 2 - 0.4;
    } else if (target) {
      tx = target.cx;
      ty = target.cy - 0.4;
    } else {
      b.phase = 'back';
      continue;
    }
    const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy);
    if (dist > BOT_SPEED) {
      b.x += (dx / dist) * BOT_SPEED;
      b.y += (dy / dist) * BOT_SPEED;
      continue;
    }
    b.x = tx;
    b.y = ty;
    if (b.phase === 'back') {
      if (b.carry && port) {
        // couldn't build: put the item back where it came from
        const crate = g.ents.get(b.from);
        if (crate?.inv) crate.inv.add(b.carry, 1);
      }
      b.t = -1;
      continue;
    }
    if (b.ghost) {
      const h = b.ghost;
      const ok = g.ghosts.includes(h) && g.canPlace(h.type, h.x, h.y, h.dir);
      if (ok) {
        g.place(h.type, h.x, h.y, h.dir as Dir);
        g.ghosts = g.ghosts.filter((x) => x !== h);
        b.carry = null;
      }
      b.ghost = null;
      b.phase = 'back';
      continue;
    }
    if (target) {
      b.phase = 'work';
      target.hp = Math.min(maxHp(target.type), target.hp + REPAIR_PER_TICK);
      if (target.hp >= maxHp(target.type)) b.phase = 'back';
    }
  }
  if (g.bots.some((b) => b.t < 0)) g.bots = g.bots.filter((b) => b.t >= 0);
}
