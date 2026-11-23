// Machines: belts carry things, drills dig veins forever, furnaces smelt, assemblers build, chests hold.
import { BELT_SPEED, DRILL_TIME, ITEMS, RECIPES, SMELT, VEIN_ORE, type ItemId, type MachineKind } from './data';
import type { World } from './world';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export type Stock = Partial<Record<ItemId, number>>;

export interface Machine {
  kind: MachineKind;
  x: number;
  y: number;
  dir: number;
  items?: { id: ItemId; p: number }[]; // belt
  inp?: Stock;
  out?: Stock;
  fuel?: number; // smelts left in the current burn
  fuelStock?: number; // fuel items waiting (counted as smelts)
  prog?: number;
  recipe?: number; // assembler recipe index, -1 = none
  working?: boolean;
}

const sum = (s: Stock | undefined) => {
  let n = 0;
  if (s) for (const k in s) n += s[k as ItemId] ?? 0;
  return n;
};
export const add = (s: Stock, id: ItemId, n: number) => void (s[id] = (s[id] ?? 0) + n);
export const take = (s: Stock, id: ItemId, n: number) => {
  const v = (s[id] ?? 0) - n;
  if (v <= 0) delete s[id];
  else s[id] = v;
};

export function newMachine(kind: MachineKind, x: number, y: number, dir: number): Machine {
  const m: Machine = { kind, x, y, dir };
  if (kind === 'belt') m.items = [];
  if (kind === 'furnace' || kind === 'assembler' || kind === 'chest' || kind === 'drill') {
    m.inp = {};
    m.out = {};
    m.prog = 0;
  }
  if (kind === 'furnace') {
    m.fuel = 0;
    m.fuelStock = 0;
  }
  if (kind === 'assembler') m.recipe = -1;
  return m;
}

export class Factory {
  machines = new Map<number, Machine>();
  constructor(public world: World) {}

  at(x: number, y: number) {
    return this.machines.get(y * this.world.W + x);
  }
  place(m: Machine) {
    this.machines.set(m.y * this.world.W + m.x, m);
  }
  remove(x: number, y: number) {
    const k = y * this.world.W + x;
    const m = this.machines.get(k);
    this.machines.delete(k);
    return m;
  }

  /** Everything a machine is holding, so mining it gives it all back. */
  contents(m: Machine): Stock {
    const s: Stock = {};
    for (const it of m.items ?? []) add(s, it.id, 1);
    for (const src of [m.inp, m.out]) if (src) for (const k in src) add(s, k as ItemId, src[k as ItemId]!);
    if (m.kind === 'furnace' && m.fuelStock) add(s, 'coal', Math.floor(m.fuelStock / 4));
    return s;
  }

  /** Can this machine take one `id`, arriving from direction `fromDir` (the mover's facing)? */
  accept(m: Machine, id: ItemId, fromDir: number, dry = false): boolean {
    switch (m.kind) {
      case 'belt': {
        const its = m.items!;
        // fed from behind: enter at the start; from a side: drop in the middle
        const p = fromDir === m.dir ? 0 : (fromDir + 2) % 4 === m.dir ? -1 : 0.5;
        if (p < 0) return false;
        if (its.some((o) => Math.abs(o.p - p) < 0.34)) return false;
        if (!dry) {
          its.push({ id, p });
          its.sort((a, b) => b.p - a.p);
        }
        return true;
      }
      case 'furnace': {
        const f = ITEMS[id].fuel;
        if (f && !SMELT[id]) {
          if (m.fuelStock! >= 40) return false;
          if (!dry) m.fuelStock! += f;
          return true;
        }
        if (!SMELT[id]) return false;
        if (sum(m.inp) >= 40) return false;
        // one kind at a time, so a mixed belt doesn't jam it
        const cur = Object.keys(m.inp!)[0];
        if (cur && cur !== id) return false;
        if (!dry) add(m.inp!, id, 1);
        return true;
      }
      case 'assembler': {
        const r = RECIPES[m.recipe ?? -1];
        if (!r) return false;
        const need = r.inp.find(([k]) => k === id);
        if (!need || (m.inp![id] ?? 0) >= need[1] * 4) return false;
        if (!dry) add(m.inp!, id, 1);
        return true;
      }
      case 'chest':
        if (sum(m.out) >= 800) return false;
        if (!dry) add(m.out!, id, 1);
        return true;
      default:
        return false;
    }
  }

  /** Push one item out of a machine into the tile in front of it. */
  private emit(m: Machine, id: ItemId) {
    const nx = m.x + DX[m.dir], ny = m.y + DY[m.dir];
    const t = this.at(nx, ny);
    return !!t && this.accept(t, id, m.dir);
  }

  private flush(m: Machine) {
    const out = m.out!;
    for (const k in out) {
      const id = k as ItemId;
      if (this.emit(m, id)) {
        take(out, id, 1);
        return;
      }
    }
  }

  tick(dt: number) {
    for (const m of this.machines.values()) {
      switch (m.kind) {
        case 'belt': {
          const its = m.items!;
          for (let i = 0; i < its.length; i++) {
            const it = its[i];
            const limit = i === 0 ? 1 : its[i - 1].p - 0.34;
            it.p = Math.min(limit, it.p + BELT_SPEED * dt);
          }
          const head = its[0];
          if (head && head.p >= 1) {
            const nx = m.x + DX[m.dir], ny = m.y + DY[m.dir];
            const t = this.at(nx, ny);
            if (t && this.accept(t, head.id, m.dir)) its.shift();
          }
          break;
        }
        case 'drill': {
          const ore = VEIN_ORE[this.world.g(m.x, m.y)];
          if (!ore) {
            m.working = false;
            break;
          }
          if (sum(m.out) < 10) {
            m.prog! += dt;
            m.working = true;
            if (m.prog! >= DRILL_TIME) {
              m.prog = 0;
              add(m.out!, ore, 1);
            }
          } else m.working = false;
          this.flush(m);
          break;
        }
        case 'furnace': {
          const k = Object.keys(m.inp!)[0] as ItemId | undefined;
          const sm = k && SMELT[k];
          m.working = false;
          if (sm && (m.inp![k!] ?? 0) >= sm.use && sum(m.out) < 40) {
            if (m.fuel! <= 0 && m.fuelStock! > 0) {
              m.fuelStock! -= 1;
              m.fuel = 1;
            }
            if (m.fuel! > 0) {
              m.working = true;
              m.prog! += dt;
              if (m.prog! >= sm.time) {
                m.prog = 0;
                m.fuel = 0;
                take(m.inp!, k!, sm.use);
                add(m.out!, sm.out, 1);
              }
            }
          }
          this.flush(m);
          break;
        }
        case 'assembler': {
          const r = RECIPES[m.recipe ?? -1];
          m.working = false;
          if (r && r.inp.every(([id, n]) => (m.inp![id] ?? 0) >= n) && sum(m.out) < 20) {
            m.working = true;
            m.prog! += dt;
            if (m.prog! >= r.time * 1.5) {
              m.prog = 0;
              for (const [id, n] of r.inp) take(m.inp!, id, n);
              add(m.out!, r.out, r.n);
            }
          }
          this.flush(m);
          break;
        }
      }
    }
  }

  serialize() {
    return [...this.machines.values()];
  }
  load(list: Machine[]) {
    this.machines.clear();
    for (const m of list) this.place(m);
  }
}

export const stockSum = sum;
