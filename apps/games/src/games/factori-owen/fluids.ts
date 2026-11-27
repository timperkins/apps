// Liquids in advanced mode. Pipes, underground pipes and pipe containers that touch each other
// make one network holding one liquid. Machines next to a network take liquid out of it or put
// liquid in (pumps, pump jacks, steam engines, oil refineries and crafters). A machine joins the
// networks around it without joining them to each other, so a refinery can have a crude oil pipe
// on one side and heavy and light oil pipes on the others.
import { ENTITIES, ITEMS, type EntityType, type ItemId } from './data';
import type { Entity, Game } from './sim';
import { WORLD } from './world';

export interface FluidNet {
  fluid: ItemId | null;
  amt: number;
  cap: number;
  members: Entity[];
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
export const UG_PIPE_REACH = 10;

export const isPipe = (e: Entity | null | undefined): boolean => !!e && e.def.kind === 'pipe';

/** Entities on the tiles just outside an entity (or a footprint). */
function around(g: Game, x: number, y: number, w: number, h: number): Entity[] {
  const out = new Set<Entity>();
  for (let i = 0; i < w; i++) {
    for (const ty of [y - 1, y + h]) {
      const e = g.entAt(x + i, ty);
      if (e) out.add(e);
    }
  }
  for (let j = 0; j < h; j++) {
    for (const tx of [x - 1, x + w]) {
      const e = g.entAt(tx, y + j);
      if (e) out.add(e);
    }
  }
  return [...out];
}

/** The underground pipe this one tunnels to: the first one ahead on the same line, up to 10 tiles. */
export function ugPipePair(g: Game, x: number, y: number, dir: number, self?: Entity): Entity | null {
  for (let k = 1; k <= UG_PIPE_REACH + 1; k++) {
    const o = g.entAt(x + DX[dir] * k, y + DY[dir] * k);
    if (o && o !== self && o.def.ugPipe && o.dir % 2 === dir % 2) return o;
  }
  return null;
}

/** Pipe pieces joined to this one. */
function pipeLinks(g: Game, e: Entity): Entity[] {
  const out = around(g, e.x, e.y, e.w, e.h).filter((o) => isPipe(o));
  if (e.def.ugPipe) {
    const p = ugPipePair(g, e.x, e.y, e.dir, e);
    if (p) out.push(p);
  }
  return out;
}

/** Puts every network's liquid back into its pipes, so it survives a rebuild or a save. */
export function spreadBack(g: Game) {
  for (const n of g.fnets) {
    for (const p of n.members) {
      p.fluid = n.amt > 0.01 ? n.fluid : null;
      p.famt = n.cap > 0 ? (n.amt * (p.def.fcap ?? 0)) / n.cap : 0;
    }
  }
}

export function rebuildFluids(g: Game) {
  spreadBack(g);
  g.fnets = [];
  const pipes = [...g.ents.values()].filter(isPipe);
  for (const p of pipes) p.fnet = -1;
  // links from underground pipes go one way, so collect them both ways first
  const links = new Map<Entity, Entity[]>();
  for (const p of pipes) links.set(p, []);
  for (const p of pipes)
    for (const o of pipeLinks(g, p)) {
      links.get(p)!.push(o);
      links.get(o)?.push(p);
    }
  for (const p of pipes) {
    if (p.fnet >= 0) continue;
    const net: FluidNet = { fluid: null, amt: 0, cap: 0, members: [] };
    const id = g.fnets.length;
    g.fnets.push(net);
    const stack = [p];
    p.fnet = id;
    const amounts = new Map<ItemId, number>();
    while (stack.length) {
      const q = stack.pop()!;
      net.members.push(q);
      net.cap += q.def.fcap ?? 0;
      if (q.fluid && q.famt > 0) amounts.set(q.fluid, (amounts.get(q.fluid) ?? 0) + q.famt);
      for (const o of links.get(q) ?? []) {
        if (o.fnet < 0) {
          o.fnet = id;
          stack.push(o);
        }
      }
    }
    // a network keeps only its main liquid (they never mix while you play)
    let best: ItemId | null = null;
    for (const [f, a] of amounts) if (!best || a > amounts.get(best)!) best = f;
    net.fluid = best;
    net.amt = best ? Math.min(net.cap, amounts.get(best)!) : 0;
  }
  // machines remember which networks touch them
  for (const e of g.ents.values()) {
    if (isPipe(e)) continue;
    e.ports = usesFluid(e) ? [...new Set(around(g, e.x, e.y, e.w, e.h).filter(isPipe).map((p) => p.fnet))] : [];
  }
}

export function usesFluid(e: Entity) {
  const k = e.def.kind;
  return k === 'pump' || k === 'pumpjack' || k === 'assembler' || !!e.def.steam;
}

/** Liquid of a kind in the networks next to a machine. */
export function fluidAround(g: Game, e: Entity, fluid: ItemId): number {
  let n = 0;
  for (const i of e.ports) {
    const f = g.fnets[i];
    if (f && f.fluid === fluid) n += f.amt;
  }
  return n;
}

/** Takes liquid from the networks next to a machine; returns how much it got. */
export function drawFluid(g: Game, e: Entity, fluid: ItemId, want: number): number {
  let got = 0;
  for (const i of e.ports) {
    const f = g.fnets[i];
    if (!f || f.fluid !== fluid || got >= want) continue;
    const k = Math.min(f.amt, want - got);
    f.amt -= k;
    got += k;
    if (f.amt <= 0.001) {
      f.amt = 0;
      f.fluid = null;
    }
  }
  return got;
}

/** Room for a liquid next to a machine (in networks holding it, or empty ones). */
export function fluidRoom(g: Game, e: Entity, fluid: ItemId): number {
  let n = 0;
  for (const i of e.ports) {
    const f = g.fnets[i];
    if (f && (f.fluid === fluid || !f.fluid)) n += f.cap - f.amt;
  }
  return n;
}

/** Pushes liquid into the networks next to a machine, preferring ones that already hold it. Returns how much went in. */
export function pushFluid(g: Game, e: Entity, fluid: ItemId, n: number): number {
  let left = n;
  const nets = e.ports.map((i) => g.fnets[i]).filter((f) => f && (f.fluid === fluid || !f.fluid));
  nets.sort((a, b) => Number(b.fluid === fluid) - Number(a.fluid === fluid));
  for (const f of nets) {
    if (left <= 0) break;
    if (f.fluid && f.fluid !== fluid) continue;
    const k = Math.min(left, f.cap - f.amt);
    if (k <= 0) continue;
    f.fluid = fluid;
    f.amt += k;
    left -= k;
  }
  return n - left;
}

/**
 * Can a pipe piece go here without mixing two liquids? Returns the clash ("water and crude oil")
 * or null when it's fine.
 */
export function pipeClash(g: Game, type: EntityType, x: number, y: number, dir: number): string | null {
  const d = ENTITIES[type];
  if (d.kind !== 'pipe') return null;
  const near = around(g, x, y, d.w, d.h).filter(isPipe);
  if (d.ugPipe) {
    const p = ugPipePair(g, x, y, dir);
    if (p) near.push(p);
  }
  // underground pipes behind this spot that would tunnel to it
  for (let k = 1; k <= UG_PIPE_REACH + 1; k++)
    for (const dd of [0, 1, 2, 3]) {
      const o = g.entAt(x - DX[dd] * k, y - DY[dd] * k);
      if (o && o.def.ugPipe && o.dir === dd && d.ugPipe && dir % 2 === dd % 2 && ugPipePair(g, o.x, o.y, o.dir, o) === null) near.push(o);
    }
  const fluids = new Set<ItemId>();
  for (const p of near) {
    const f = g.fnets[p.fnet];
    if (f?.fluid && f.amt > 0.01) fluids.add(f.fluid);
  }
  if (fluids.size < 2) return null;
  return [...fluids].map((f) => ITEMS[f].name.toLowerCase()).join(' and ');
}

/** Is there water on a tile next to this spot? (offshore pumps) */
export function nextToWater(g: Game, x: number, y: number): boolean {
  for (let d = 0; d < 4; d++) {
    const tx = x + DX[d], ty = y + DY[d];
    if (tx >= 0 && ty >= 0 && tx < WORLD && ty < WORLD && g.world.ground[ty * WORLD + tx] === 4) return true;
  }
  return false;
}
