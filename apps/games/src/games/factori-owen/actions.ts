// Everything a player can do to the shared world. Single-player and hosts apply these directly;
// guests send them to the host (see mp.ts).
import { RECIPE_BY_ID, type EntityType, type ItemId } from './data';
import { RES_ITEM } from './world';
import type { Dir, Entity, Game } from './sim';

export type Items = [ItemId, number][];
export type TakeWhat = 'fuel' | 'output' | 'input' | 'chest' | 'belt';

export interface Actions {
  place(type: EntityType, x: number, y: number, dir: Dir, item: ItemId): boolean;
  remove(e: Entity): void;
  rotate(e: Entity, dir?: Dir): void;
  give(e: Entity, slot: number, n: number): boolean;
  /** Take items out of a building. `half` takes half the stack (right-click). */
  take(e: Entity, what: TakeWhat, key?: string | number, half?: boolean): void;
  setRecipe(e: Entity, id: string): void;
  research(id: string): void;
  /** Finish hand-mining a tile (ore or tree). */
  mine(x: number, y: number): void;
}

// ---------- the real effects, returning what the player gets back ----------

export function doTake(g: Game, e: Entity, what: TakeWhat, key?: string | number, roomFn: (item: ItemId) => number = () => 1e9, half = false): Items {
  const out: Items = [];
  if (what === 'belt') {
    // pick everything up off a belt tile
    const keep = [];
    for (const b of e.items) {
      if (roomFn(b.item) > 0 && (out.find((o) => o[0] === b.item)?.[1] ?? 0) < roomFn(b.item)) {
        const o = out.find((x) => x[0] === b.item);
        if (o) o[1]++;
        else out.push([b.item, 1]);
      } else keep.push(b);
    }
    e.items = keep;
    return out;
  }
  // right-click takes half (rounded up), like splitting a stack
  const room = (item: ItemId, n: number) => Math.min(roomFn(item), half ? Math.ceil(n / 2) : n);
  if (what === 'fuel' && e.fuel) {
    const k = room(e.fuel.item, e.fuel.n);
    out.push([e.fuel.item, k]);
    e.fuel.n -= k;
    if (e.fuel.n <= 0) e.fuel = null;
  } else if (what === 'output' && e.output) {
    const k = room(e.output.item, e.output.n);
    out.push([e.output.item, k]);
    e.output.n -= k;
    if (e.output.n <= 0) e.output = null;
  } else if (what === 'input') {
    const item = (key || Object.keys(e.input).find((k) => e.input[k as ItemId])) as ItemId | undefined;
    if (item && e.input[item]) {
      const k = room(item, e.input[item]!);
      out.push([item, k]);
      e.input[item]! -= k;
      if (!e.input[item]) delete e.input[item];
    }
  } else if (what === 'chest' && e.inv) {
    const s = e.inv.slots[Number(key)];
    if (s) {
      const k = room(s.item, s.n);
      out.push([s.item, k]);
      s.n -= k;
      if (s.n <= 0) e.inv.slots[Number(key)] = null;
    }
  }
  return out.filter(([, n]) => n > 0);
}

export function doSetRecipe(g: Game, e: Entity, id: string): Items {
  const out: Items = [];
  if (!RECIPE_BY_ID[id]) return out;
  if (e.recipe !== id) {
    for (const [k, v] of Object.entries(e.input)) if (v) out.push([k as ItemId, v]);
    e.input = {};
    if (e.crafting) {
      for (const [it, n] of RECIPE_BY_ID[e.crafting].ing) out.push([it, n]);
      e.crafting = null;
      e.progress = 0;
    }
  }
  e.recipe = id;
  return out;
}

export function doMine(g: Game, x: number, y: number): Items {
  const w = g.world;
  if (!w.inside(x, y)) return [];
  const i = w.idx(x, y);
  if (w.tree[i]) {
    w.tree[i] = 0;
    w.changed?.add(i);
    g.produced.wood = (g.produced.wood ?? 0) + 4;
    return [['wood', 4]];
  }
  if (w.res[i]) {
    const item = RES_ITEM[w.res[i]] as ItemId;
    if (w.mineRes(x, y)) {
      g.produced[item] = (g.produced[item] ?? 0) + 1;
      return [[item, 1]];
    }
  }
  return [];
}

function addAll(g: Game, items: Items) {
  for (const [it, n] of items) {
    const k = g.inv.add(it, n);
    if (k < n) g.toast('Inventory full: some items were lost');
  }
}

export function localActions(g: () => Game): Actions {
  return {
    place(type, x, y, dir, item) {
      const game = g();
      if (game.inv.count(item) <= 0) return false;
      const e = game.place(type, x, y, dir);
      if (!e) return false;
      game.inv.remove(item, 1);
      return true;
    },
    remove(e) {
      addAll(g(), g().remove(e));
    },
    rotate(e, dir) {
      const game = g();
      if (dir === undefined) game.rotate(e);
      else {
        e.dir = dir;
        if (e.def.kind === 'belt') game.updateCurves(e.x, e.y);
      }
    },
    give(e, slot, n) {
      const game = g();
      const s = game.inv.slots[slot];
      if (!s) return false;
      const k = game.insert(e, s.item, Math.min(n, s.n), true);
      if (k <= 0) return false;
      s.n -= k;
      if (s.n <= 0) game.inv.slots[slot] = null;
      return true;
    },
    take(e, what, key, half) {
      const game = g();
      addAll(game, doTake(game, e, what, key, (item) => game.inv.space(item), half));
    },
    setRecipe(e, id) {
      addAll(g(), doSetRecipe(g(), e, id));
    },
    research(id) {
      if (g().canResearch(id)) g().research = id;
    },
    mine(x, y) {
      const game = g();
      const w = game.world;
      const i = w.idx(x, y);
      if (w.res[i] && game.inv.space(RES_ITEM[w.res[i]] as ItemId) <= 0) {
        game.toast('Inventory full');
        return;
      }
      addAll(game, doMine(game, x, y));
    },
  };
}
