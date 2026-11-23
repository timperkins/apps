import * as K from './constants';
import { boost, roleOf, upgradeCost, type Levels, type UpgradeId } from './upgrades';
import type { FishKind } from './looks';

// The whole game simulation, with no rendering or networking so it can be unit tested.
// Coordinates are scene pixels (640x360); y grows downward and the waterline is at K.SURF.

export interface Fish {
  id: string;
  // Player fish belong to a phone; computer fish and babies don't.
  player: boolean;
  kind: FishKind | 'npc';
  // Look index for computer fish.
  species: number;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  level: number;
  food: number;
  alive: boolean;
  respawnAt: number;
  safeUntil: number;
  dashUntil: number;
  dashReadyAt: number;
  ramReadyAt: number;
  ups: Levels;
  eggReadyAt: number;
  tauntUntil: number;
  tauntReadyAt: number;
  findUntil: number;
  hookedBy: string | null;
  score: number;
  coins: number;
  eats: number;
  best: number;
  nextSurviveCoin: number;
  // Babies follow their parent and feed it.
  baby: boolean;
  // What a baby is swimming after.
  snack?: { x: number; y: number } | null;
  owner: string | null;
  diesAt: number;
  nextFeed: number;
  // Computer fish wander toward a target.
  tx: number;
  ty: number;
  retargetAt: number;
}

export type HookState = 'ready' | 'down' | 'fight';

export interface Hook {
  state: HookState;
  x: number;
  y: number;
  fishId: string | null;
  knot: number;
  fightStart: number;
  fightY0: number;
  // Reeling in by itself after a tap on Reel in.
  auto?: boolean;
}

export interface Boat {
  id: string;
  name: string;
  color: string;
  x: number;
  vx: number;
  dir: 1 | -1;
  health: number;
  sunk: boolean;
  respawnAt: number;
  hook: Hook;
  meat: number;
  coins: number;
  score: number;
  catches: number;
  // Who rammed this boat and when, for sink assists.
  hits: Map<string, number>;
  findUntil: number;
  tapTimes: number[];
  ups: Levels;
}

export interface Egg {
  id: string;
  owner: string;
  color: string;
  x: number;
  y: number;
  hatchAt: number;
}

export interface Coin {
  id: string;
  x: number;
  y: number;
  restUntil: number;
  phase: number;
}

export interface FishInput {
  x: number;
  y: number;
}

export interface BoatInput {
  x: number;
  reel: boolean;
}

export type Reward = { kind: 'coins' | 'meat'; amount: number };

export type WorldEvent =
  | { type: 'cast'; boat: string; x: number }
  | { type: 'bite'; boat: string; fish: string }
  | { type: 'catch'; boat: string; fish: string; player: boolean; reward: Reward; x: number; y: number }
  | { type: 'escape'; boat: string; fish: string }
  | { type: 'eat'; by: string; victim: string; player: boolean; x: number; y: number; color: string }
  | { type: 'coin'; by: string; x: number; y: number }
  | { type: 'ram'; boat: string; by: string; x: number }
  | { type: 'sink'; boat: string; by: string; x: number }
  | { type: 'boatBack'; boat: string }
  | { type: 'levelUp'; id: string; level: number }
  | { type: 'egg'; id: string }
  | { type: 'hatch'; owner: string; x: number; y: number }
  | { type: 'peteArrive' }
  | { type: 'peteLeave' }
  | { type: 'sell'; boat: string }
  | { type: 'taunt'; id: string }
  | { type: 'buy'; id: string; item: UpgradeId; level: number }
  | { type: 'died'; id: string; by: string | null; how: 'eaten' | 'caught' };

export const NPC_SPECIES = 6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const fishLen = (f: Pick<Fish, 'level' | 'baby'>) => (f.baby ? 8 : K.fishLength(f.level));

// Where the mouth is: the hook bites and eating happen there.
export const mouthOf = (f: Fish) => ({ x: f.x + f.dir * fishLen(f) * 0.45, y: f.y + fishLen(f) * 0.06 });

export const maxHealth = (b: Boat) => K.BOAT_HEALTH * boost(b.ups, 'hull');

export const rodTip = (b: Boat) => ({ x: b.x + b.dir * K.ROD_DX, y: K.SURF + K.ROD_DY });

export class World {
  time = 0;
  fish: Fish[] = [];
  boats: Boat[] = [];
  eggs: Egg[] = [];
  coins: Coin[] = [];
  npcTarget = K.NPC_TARGET;
  // Off by default: School players are teammates and can't eat each other.
  schoolEats = false;
  peteHere = false;
  peteSince = 0;
  peteNext = K.PETE_FIRST_S;
  private serial = 0;
  private coinTimer = 0;
  private npcTimer = 0;
  private events: WorldEvent[] = [];
  private fishTaps = new Map<string, number[]>();

  constructor(private rand: () => number = Math.random) {}

  get(id: string): Fish | undefined {
    return this.fish.find((f) => f.id === id);
  }

  boat(id: string): Boat | undefined {
    return this.boats.find((b) => b.id === id);
  }

  // ---------- setup ----------

  addSwimmer(id: string, name: string, color: string, kind: FishKind): Fish {
    this.removePlayer(id);
    const f = this.newFish(id, true, kind, 0, name, color, 1);
    this.placeSpawn(f);
    f.safeUntil = this.time + K.SPAWN_SAFE_S;
    this.fish.push(f);
    return f;
  }

  addRaider(id: string, name: string, color: string): Boat {
    this.removePlayer(id);
    const x = this.freeBoatX();
    const boat: Boat = {
      id,
      name,
      color,
      x,
      vx: 0,
      dir: x < K.SCENE_W / 2 ? 1 : -1,
      health: K.BOAT_HEALTH,
      sunk: false,
      respawnAt: 0,
      hook: { state: 'ready', x, y: K.SURF, fishId: null, knot: 0, fightStart: 0, fightY0: 0 },
      meat: 0,
      coins: 0,
      score: 0,
      catches: 0,
      hits: new Map(),
      findUntil: 0,
      tapTimes: [],
      ups: {},
    };
    this.boats.push(boat);
    return boat;
  }

  removePlayer(id: string): void {
    const f = this.get(id);
    if (f) {
      if (f.hookedBy) this.releaseHook(this.boat(f.hookedBy));
      this.fish = this.fish.filter((x) => x.id !== id);
      for (const b of this.fish) if (b.owner === id) b.owner = null;
      this.eggs = this.eggs.filter((e) => e.owner !== id);
    }
    const b = this.boat(id);
    if (b) {
      this.releaseHook(b);
      this.boats = this.boats.filter((x) => x.id !== id);
    }
  }

  setLook(id: string, name: string, color: string): void {
    const f = this.get(id);
    if (f) Object.assign(f, { name, color });
    const b = this.boat(id);
    if (b) Object.assign(b, { name, color });
  }

  // A new round: everyone keeps their side and look, stats and the ocean start fresh.
  reset(): void {
    this.fish = this.fish.filter((f) => f.player);
    for (const f of this.fish) {
      Object.assign(f, { level: 1, food: 0, score: 0, coins: 0, eats: 0, best: 1, hookedBy: null, alive: true, ups: {} });
      this.placeSpawn(f);
      f.safeUntil = this.time + K.SPAWN_SAFE_S;
      f.nextSurviveCoin = this.time + K.SURVIVE_COIN_S;
      f.eggReadyAt = this.time;
    }
    for (const b of this.boats) {
      Object.assign(b, { health: K.BOAT_HEALTH, sunk: false, meat: 0, coins: 0, score: 0, catches: 0, vx: 0, ups: {} });
      b.hits.clear();
      b.hook = { state: 'ready', x: b.x, y: K.SURF, fishId: null, knot: 0, fightStart: 0, fightY0: 0 };
    }
    this.eggs = [];
    this.coins = [];
    this.peteHere = false;
    this.peteNext = this.time + K.PETE_FIRST_S;
    this.fillNpcs(true);
  }

  // ---------- actions from phones ----------

  dash(id: string): void {
    const f = this.get(id);
    if (!f?.alive || f.hookedBy || this.time < f.dashReadyAt) return;
    f.dashUntil = this.time + K.DASH_S;
    f.dashReadyAt = this.time + K.DASH_COOLDOWN_S / boost(f.ups, 'dash');
  }

  taunt(id: string): void {
    const f = this.get(id);
    if (!f?.alive || f.kind !== 'clown' || this.time < f.tauntReadyAt) return;
    f.tauntUntil = this.time + K.TAUNT_S;
    f.tauntReadyAt = this.time + K.TAUNT_COOLDOWN_S;
    this.events.push({ type: 'taunt', id });
  }

  layEgg(id: string): void {
    const f = this.get(id);
    if (!f?.alive || f.hookedBy || this.time < f.eggReadyAt) return;
    f.eggReadyAt = this.time + K.EGG_COOLDOWN_S;
    this.eggs.push({ id: `egg-${this.serial++}`, owner: id, color: f.color, x: f.x, y: f.y, hatchAt: this.time + K.EGG_HATCH_S });
    this.events.push({ type: 'egg', id });
  }

  findMe(id: string): void {
    const f = this.get(id);
    if (f) f.findUntil = this.time + 2;
    const b = this.boat(id);
    if (b) b.findUntil = this.time + 2;
  }

  cast(id: string): void {
    const b = this.boat(id);
    if (!b || b.sunk || b.hook.state !== 'ready') return;
    const tip = rodTip(b);
    b.hook = { state: 'down', x: tip.x + b.dir * 10, y: K.SURF + 2, fishId: null, knot: 0, fightStart: 0, fightY0: 0 };
    this.events.push({ type: 'cast', boat: id, x: b.hook.x });
  }

  // Spends coins on the next level of an upgrade. Returns false if it can't be bought.
  buy(id: string, item: UpgradeId): boolean {
    const b = this.boat(id);
    const f = this.get(id);
    const owner = b ?? f;
    if (!owner || roleOf(item) !== (b ? 'raider' : 'swimmer')) return false;
    const level = owner.ups[item] ?? 0;
    const cost = upgradeCost(level);
    if (owner.coins < cost) return false;
    owner.coins -= cost;
    if (b && item === 'hull') {
      const before = maxHealth(b);
      b.ups.hull = level + 1;
      if (!b.sunk) b.health += maxHealth(b) - before;
    } else owner.ups[item] = level + 1;
    this.events.push({ type: 'buy', id, item, level: level + 1 });
    return true;
  }

  // Reels the line all the way in by itself, so the Raider can cast again.
  reelIn(id: string): void {
    const b = this.boat(id);
    if (b && b.hook.state === 'down') b.hook.auto = true;
  }

  // A Raider's tap during a tug-of-war. Heave taps land in the gold window and pull harder.
  reelTap(id: string, heave: boolean): void {
    const b = this.boat(id);
    if (!b || b.hook.state !== 'fight' || !this.allowTap(b.tapTimes)) return;
    b.hook.knot += (heave ? K.HEAVE_TAP : K.REEL_TAP) * boost(b.ups, 'reel');
  }

  // A hooked Swimmer's swipe.
  pullTap(id: string): void {
    const f = this.get(id);
    const b = f?.hookedBy ? this.boat(f.hookedBy) : undefined;
    if (!f || !b || b.hook.state !== 'fight') return;
    if (!this.fishTaps.has(id)) this.fishTaps.set(id, []);
    if (!this.allowTap(this.fishTaps.get(id)!)) return;
    b.hook.knot -= K.PULL_TAP * K.sizeFactor(f.level) * boost(f.ups, 'strength');
  }

  thrash(id: string): void {
    const f = this.get(id);
    const b = f?.hookedBy ? this.boat(f.hookedBy) : undefined;
    if (!f || !b || b.hook.state !== 'fight') return;
    b.hook.knot -= K.THRASH * boost(f.ups, 'strength');
  }

  sell(id: string): void {
    const b = this.boat(id);
    if (!b || !this.peteHere || b.meat <= 0) return;
    b.meat -= 1;
    b.coins += K.MEAT_PRICE;
    b.score += K.MEAT_PRICE;
    this.events.push({ type: 'sell', boat: id });
  }

  // ---------- the step ----------

  step(dt: number, fishInputs: Map<string, FishInput>, boatInputs: Map<string, BoatInput>): WorldEvent[] {
    this.time += dt;
    // Events from actions since the last step (cast, taunt, sell…) are kept and returned too.
    this.respawn();
    this.moveBoats(dt, boatInputs);
    this.moveFish(dt, fishInputs);
    this.moveHooks(dt);
    this.eating();
    this.ramming();
    this.eggsAndBabies(dt);
    this.coinsStep(dt);
    this.pete();
    this.survival();
    this.npcTimer -= dt;
    if (this.npcTimer <= 0) {
      this.npcTimer = K.NPC_RESPAWN_S;
      this.fillNpcs(false);
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  private respawn(): void {
    for (const f of this.fish) {
      if (!f.alive && f.player && this.time >= f.respawnAt) {
        Object.assign(f, { alive: true, level: 1, food: 0, hookedBy: null, vx: 0, vy: 0 });
        this.placeSpawn(f);
        f.safeUntil = this.time + K.SPAWN_SAFE_S;
        f.nextSurviveCoin = this.time + K.SURVIVE_COIN_S;
      }
    }
    for (const b of this.boats) {
      if (b.sunk && this.time >= b.respawnAt) {
        b.sunk = false;
        b.health = maxHealth(b);
        b.hits.clear();
        this.events.push({ type: 'boatBack', boat: b.id });
      }
    }
  }

  private moveBoats(dt: number, inputs: Map<string, BoatInput>): void {
    for (const b of this.boats) {
      const input = inputs.get(b.id) ?? { x: 0, reel: false };
      if (b.sunk) {
        b.vx = 0;
        continue;
      }
      const slow = b.hook.state === 'ready' ? 1 : K.BOAT_HOOK_DOWN_MULT;
      const target = clamp(input.x, -1, 1) * K.BOAT_SPEED * boost(b.ups, 'speed') * slow;
      b.vx += (target - b.vx) * Math.min(1, K.BOAT_ACCEL * dt);
      b.x = clamp(b.x + b.vx * dt, K.BOAT_MIN_X, K.BOAT_MAX_X);
      if (b.hook.state === 'ready' && Math.abs(input.x) > 0.2) b.dir = input.x > 0 ? 1 : -1;
      // Holding Reel raises the hook.
      if (b.hook.state === 'down') {
        if (b.hook.auto) b.hook.y -= K.HOOK_REEL * K.AUTO_REEL_MULT * boost(b.ups, 'reel') * dt;
        else if (input.reel) b.hook.y -= K.HOOK_REEL * boost(b.ups, 'reel') * dt;
        else b.hook.y = Math.min(this.lineDepth(), b.hook.y + K.HOOK_SINK * boost(b.ups, 'line') * dt);
        if (b.hook.y <= K.SURF) b.hook.state = 'ready';
      }
    }
    // Boats bump off each other instead of overlapping.
    const afloat = this.boats.filter((b) => !b.sunk).sort((a, c) => a.x - c.x);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i + 1 < afloat.length; i++) {
        const a = afloat[i];
        const c = afloat[i + 1];
        const gap = c.x - a.x;
        if (gap < K.BOAT_GAP) {
          const push = (K.BOAT_GAP - gap) / 2;
          a.x = clamp(a.x - push, K.BOAT_MIN_X, K.BOAT_MAX_X);
          c.x = clamp(c.x + push, K.BOAT_MIN_X, K.BOAT_MAX_X);
          if (a.vx > 0) a.vx *= -0.3;
          if (c.vx < 0) c.vx *= -0.3;
        }
      }
    }
  }

  lineDepth(): number {
    return K.LINE_DEEP;
  }

  private moveFish(dt: number, inputs: Map<string, FishInput>): void {
    for (const f of this.fish) {
      if (!f.alive || f.hookedBy) continue;
      let ix = 0;
      let iy = 0;
      if (f.player) {
        const input = inputs.get(f.id);
        if (input) {
          ix = clamp(input.x, -1, 1);
          iy = clamp(input.y, -1, 1);
          const m = Math.hypot(ix, iy);
          if (m > 1) {
            ix /= m;
            iy /= m;
          }
        }
      } else {
        const want = this.npcSteer(f);
        ix = want.x;
        iy = want.y;
      }
      const dash = this.time < f.dashUntil ? K.DASH_MULT : 1;
      const speed = K.FISH_SPEED * (f.baby ? 1.1 : K.speedForLevel(f.level)) * dash * (f.player || f.baby ? 1 : 0.6) * boost(f.ups, 'fins');
      f.vx += (ix * speed - f.vx) * Math.min(1, K.FISH_ACCEL * dt);
      f.vy += (iy * speed - f.vy) * Math.min(1, K.FISH_ACCEL * dt);
      const half = fishLen(f) / 2;
      f.x = clamp(f.x + f.vx * dt, half, K.SCENE_W - half);
      f.y = clamp(f.y + f.vy * dt, K.SURF + 6, K.SEABED - fishLen(f) * 0.25);
      if (Math.abs(f.vx) > 6) f.dir = f.vx > 0 ? 1 : -1;
    }
  }

  // The boat a fish has rammed in the last few seconds, if it is still afloat.
  private boatUnderAttack(parent: Fish): Boat | undefined {
    if (!parent.alive) return undefined;
    return this.boats.find((b) => !b.sunk && this.time - (b.hits.get(parent.id) ?? -Infinity) < K.BABY_ATTACK_S);
  }

  // The nearest coin or minnow anywhere in the sea that a sibling isn't already going for.
  private nearestSnack(f: Fish): { x: number; y: number } | null {
    const claimed = new Set<{ x: number; y: number }>();
    for (const o of this.fish) {
      if (o !== f && o.baby && o.owner === f.owner && o.snack) claimed.add(o.snack);
    }
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    const consider = (t: { x: number; y: number }) => {
      if (claimed.has(t)) return;
      const d = Math.hypot(t.x - f.x, t.y - f.y);
      if (d < bestD) [best, bestD] = [t, d];
    };
    for (const c of this.coins) consider(c);
    for (const v of this.fish) if (!v.player && !v.baby && v.level === 0 && v.alive && !v.hookedBy) consider(v);
    f.snack = best;
    return best;
  }

  // Computer fish wander, flee big player fish, and sometimes go for a hook. Babies follow their parent.
  private npcSteer(f: Fish): { x: number; y: number } {
    if (f.baby) {
      const parent = f.owner ? this.get(f.owner) : undefined;
      const target = parent ? this.boatUnderAttack(parent) : undefined;
      const snack = target ? null : this.nearestSnack(f);
      if (target) {
        // Join in: ram the boat the parent is ramming.
        f.tx = target.x + ((Number(f.id.split('-').pop()) % 5) - 2) * 12;
        f.ty = K.SURF + 4;
      } else if (snack) {
        f.tx = snack.x;
        f.ty = snack.y;
      } else if (parent?.alive) {
        const i = Number(f.id.split('-').pop()) % 3;
        f.tx = parent.x - parent.dir * (fishLen(parent) * 0.6 + 6 + i * 6);
        f.ty = parent.y + (i - 1) * 7;
      } else if (this.time > f.retargetAt) this.retarget(f);
    } else {
      if (this.time > f.retargetAt || Math.hypot(f.tx - f.x, f.ty - f.y) < 6) this.retarget(f);
      const len = fishLen(f);
      for (const p of this.fish) {
        if (!p.player || !p.alive || p.hookedBy) continue;
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d < 70 && fishLen(p) >= len * K.EAT_RATIO) {
          f.tx = clamp(f.x - (p.x - f.x) * 2, 10, K.SCENE_W - 10);
          f.ty = clamp(f.y - (p.y - f.y) * 2, K.SURF + 10, K.SEABED - 10);
          f.retargetAt = this.time + 1;
        }
      }
      for (const b of this.boats) {
        if (b.hook.state !== 'down') continue;
        const d = Math.hypot(b.hook.x - f.x, b.hook.y - f.y);
        if (d < 55 && this.rand() < K.NPC_BITE_CHANCE * K.STEP) {
          f.tx = b.hook.x;
          f.ty = b.hook.y;
          f.retargetAt = this.time + 3;
        }
      }
    }
    const dx = f.tx - f.x;
    const dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) return { x: 0, y: 0 };
    const s = Math.min(1, d / 30);
    return { x: (dx / d) * s, y: (dy / d) * s };
  }

  private retarget(f: Fish): void {
    f.tx = 20 + this.rand() * (K.SCENE_W - 40);
    f.ty = K.SURF + 30 + this.rand() * (K.SEABED - K.SURF - 50);
    f.retargetAt = this.time + 3 + this.rand() * 5;
  }

  private moveHooks(dt: number): void {
    for (const b of this.boats) {
      const h = b.hook;
      const tip = rodTip(b);
      if (h.state === 'ready') {
        h.x = tip.x;
        h.y = tip.y;
        continue;
      }
      if (h.state === 'down') {
        // The hook trails the boat when it moves.
        h.x += (tip.x + b.dir * 8 - h.x) * Math.min(1, K.HOOK_FOLLOW * dt);
        // Nothing bites until the hook has sunk a little, so a cast never snags a fish at the surface.
        if (h.y < K.SURF + K.HOOK_BITE_DEPTH) continue;
        for (const f of this.fish) {
          if (!f.alive || f.hookedBy || this.time < f.safeUntil) continue;
          const m = mouthOf(f);
          if (Math.hypot(m.x - h.x, m.y - h.y) < K.HOOK_RADIUS * boost(b.ups, 'line') + fishLen(f) * 0.15) {
            h.state = 'fight';
            h.fishId = f.id;
            h.knot = K.KNOT_START;
            h.fightStart = this.time;
            h.fightY0 = f.y;
            f.hookedBy = b.id;
            f.vx = 0;
            f.vy = 0;
            this.events.push({ type: 'bite', boat: b.id, fish: f.id });
            break;
          }
        }
        continue;
      }
      // Tug-of-war.
      const f = h.fishId ? this.get(h.fishId) : undefined;
      if (!f || !f.alive) {
        this.releaseHook(b);
        continue;
      }
      h.knot += K.RATCHET_PER_S * dt;
      if (!f.player) h.knot -= K.NPC_PULL_PER_S * K.sizeFactor(f.level) * dt;
      const t = clamp(h.knot / K.KNOT_LANDED, 0, 1);
      f.y = K.SURF + 10 + (h.fightY0 - K.SURF - 10) * (1 - t);
      f.x = clamp(f.x + (tip.x - f.x) * 0.4 * dt + Math.sin(this.time * 9) * 12 * dt, 8, K.SCENE_W - 8);
      f.dir = f.x < tip.x ? -1 : 1;
      const m = mouthOf(f);
      h.x = m.x;
      h.y = m.y;
      if (h.knot >= K.KNOT_LANDED) this.land(b, f);
      else if (h.knot <= 0) {
        f.hookedBy = null;
        f.safeUntil = this.time + K.ESCAPE_SAFE_S;
        f.vy = 40;
        h.state = 'ready';
        h.fishId = null;
        this.events.push({ type: 'escape', boat: b.id, fish: f.id });
      }
    }
  }

  private land(b: Boat, f: Fish): void {
    const reward: Reward =
      this.rand() < K.MEAT_CHANCE
        ? { kind: 'meat', amount: Math.min(3, 1 + Math.floor((f.level - 1) / 3)) }
        : { kind: 'coins', amount: 4 + f.level * 2 + Math.floor(this.rand() * 4) };
    if (reward.kind === 'meat') b.meat += reward.amount;
    else b.coins += reward.amount;
    b.score += K.CATCH_SCORE + f.level * 5;
    b.catches += 1;
    this.events.push({ type: 'catch', boat: b.id, fish: f.id, player: f.player, reward, x: f.x, y: f.y });
    b.hook.state = 'ready';
    b.hook.fishId = null;
    this.kill(f, b.id, 'caught');
  }

  private releaseHook(b: Boat | undefined): void {
    if (!b) return;
    const f = b.hook.fishId ? this.get(b.hook.fishId) : undefined;
    if (f) f.hookedBy = null;
    b.hook.state = 'ready';
    b.hook.fishId = null;
  }

  private kill(f: Fish, by: string | null, how: 'eaten' | 'caught'): void {
    if (f.hookedBy) {
      const b = this.boat(f.hookedBy);
      f.hookedBy = null;
      if (b && b.hook.fishId === f.id) {
        b.hook.state = 'ready';
        b.hook.fishId = null;
      }
    }
    if (f.player) {
      f.alive = false;
      f.respawnAt = this.time + K.RESPAWN_S;
      this.events.push({ type: 'died', id: f.id, by, how });
    } else {
      this.fish = this.fish.filter((x) => x !== f);
    }
  }

  private eating(): void {
    for (const a of this.fish) {
      if (!(a.player || a.baby) || !a.alive || a.hookedBy) continue;
      // A baby gathers for its parent: what it eats and picks up goes to the parent.
      const parent = a.baby ? (a.owner ? this.get(a.owner) : undefined) : a;
      if (!parent) continue;
      const la = fishLen(a);
      const m = mouthOf(a);
      for (const v of this.fish) {
        if (v === a || !v.alive || v.hookedBy || this.time < v.safeUntil) continue;
        // Babies are safe from being eaten; only a hook can take them.
        if (v.baby || v.owner === parent.id) continue;
        const lv = fishLen(v);
        // Babies are tiny, so they can only manage minnows.
        if (a.baby ? v.player || v.level > 0 : la < lv * K.EAT_RATIO) continue;
        if (v.player && !this.schoolEats) continue;
        if (Math.hypot(m.x - v.x, m.y - v.y) > la * 0.25 + lv * 0.3 + (a.baby ? 3 : 0)) continue;
        const food = v.player ? 2 + v.level * 2 : Math.max(1, v.level);
        parent.eats += 1;
        parent.score += v.player ? K.EAT_PLAYER_SCORE * v.level : K.EAT_SCORE * Math.max(1, v.level);
        this.events.push({ type: 'eat', by: parent.id, victim: v.id, player: v.player, x: v.x, y: v.y, color: v.color });
        this.feed(parent, food);
        this.kill(v, parent.id, 'eaten');
      }
      if (a.baby) {
        this.pickCoins(a, parent);
        continue;
      }
      // Other fish's eggs are a snack too.
      for (const e of this.eggs) {
        if (e.owner === a.id) continue;
        if (Math.hypot(m.x - e.x, m.y - e.y) < la * 0.3 + 3) {
          e.hatchAt = -1;
          this.feed(a, 2);
          this.events.push({ type: 'eat', by: a.id, victim: e.id, player: false, x: e.x, y: e.y, color: e.color });
        }
      }
      this.eggs = this.eggs.filter((e) => e.hatchAt !== -1);
      this.pickCoins(a, a);
    }
  }

  // `picker` touches the coin; `owner` gets it.
  private pickCoins(picker: Fish, owner: Fish): void {
    const m = mouthOf(picker);
    const r = fishLen(picker) * 0.3 + (picker.baby ? 6 : 4);
    for (const c of this.coins) {
      if (Math.hypot(m.x - c.x, m.y - c.y) < r) {
        c.restUntil = -1;
        owner.coins += 1;
        owner.score += K.COIN_SCORE;
        this.events.push({ type: 'coin', by: owner.id, x: c.x, y: c.y });
      }
    }
    this.coins = this.coins.filter((c) => c.restUntil !== -1);
  }

  feed(f: Fish, food: number): void {
    f.food += food;
    while (f.level < K.MAX_LEVEL && f.food >= K.foodToLevel(f.level)) {
      f.food -= K.foodToLevel(f.level);
      f.level += 1;
      f.best = Math.max(f.best, f.level);
      this.events.push({ type: 'levelUp', id: f.id, level: f.level });
    }
  }

  private ramming(): void {
    for (const f of this.fish) {
      if (!(f.player || f.baby) || !f.alive || f.hookedBy || f.y > K.SURF + K.SURFACE_BAND) continue;
      if (this.time < f.ramReadyAt) continue;
      // A baby's ram counts for its parent.
      const by = f.baby ? (f.owner ? this.get(f.owner) : undefined) : f;
      if (!by) continue;
      for (const b of this.boats) {
        if (b.sunk || Math.abs(f.x - b.x) > K.BOAT_HALF_W + fishLen(f) * 0.3) continue;
        f.ramReadyAt = this.time + K.RAM_COOLDOWN_S;
        f.vy = 70;
        b.health -= f.baby ? K.BABY_RAM_DAMAGE * boost(by.ups, 'ram') : K.ramDamage(f.level) * boost(f.ups, 'ram');
        if (!f.baby) b.hits.set(f.id, this.time);
        this.events.push({ type: 'ram', boat: b.id, by: by.id, x: f.x });
        if (b.health <= 0) this.sink(b, by);
        break;
      }
    }
  }

  private sink(b: Boat, by: Fish): void {
    b.health = 0;
    b.sunk = true;
    b.respawnAt = this.time + K.BOAT_RESPAWN_S;
    this.releaseHook(b);
    by.score += K.SINK_SCORE;
    this.feed(by, K.SINK_FOOD);
    for (const [id, at] of b.hits) {
      const helper = this.get(id);
      if (helper && helper !== by && helper.alive && this.time - at < K.ASSIST_S) this.feed(helper, K.ASSIST_FOOD);
    }
    this.events.push({ type: 'sink', boat: b.id, by: by.id, x: b.x });
  }

  private eggsAndBabies(dt: number): void {
    for (const e of this.eggs) {
      e.y = Math.min(K.SEABED - 2, e.y + 22 * dt);
      if (this.time >= e.hatchAt) {
        const have = this.fish.filter((f) => f.baby && f.owner === e.owner).length;
        for (let i = 0; i < Math.min(K.BABIES_PER_EGG, K.MAX_BABIES - have); i++) {
          const parent = this.get(e.owner);
          const baby = this.newFish(`baby-${this.serial++}`, false, 'npc', 0, '', e.color, 1);
          Object.assign(baby, {
            baby: true,
            owner: e.owner,
            x: e.x + i * 4,
            y: e.y - 4,
            kind: parent?.kind === 'clown' ? 'clown' : 'npc',
          });
          this.fish.push(baby);
        }
        this.events.push({ type: 'hatch', owner: e.owner, x: e.x, y: e.y });
      }
    }
    this.eggs = this.eggs.filter((e) => this.time < e.hatchAt);
  }

  private coinsStep(dt: number): void {
    this.coinTimer -= dt;
    if (this.coinTimer <= 0 && this.coins.length < K.COINS_MAX) {
      this.coinTimer = K.COIN_EVERY_S;
      this.coins.push({ id: `coin-${this.serial++}`, x: 20 + this.rand() * (K.SCENE_W - 40), y: K.SURF + 4, restUntil: 0, phase: this.rand() * 6 });
    }
    for (const c of this.coins) {
      if (c.y < K.SEABED - 2) {
        c.y += 14 * dt;
        c.x += Math.sin(this.time * 2 + c.phase) * 8 * dt;
      } else if (c.restUntil === 0) c.restUntil = this.time + 8;
    }
    this.coins = this.coins.filter((c) => c.restUntil === 0 || this.time < c.restUntil);
  }

  private pete(): void {
    if (!this.peteHere && this.time >= this.peteNext && this.boats.length > 0) {
      this.peteHere = true;
      this.peteSince = this.time;
      this.events.push({ type: 'peteArrive' });
    } else if (this.peteHere && this.time - this.peteSince >= K.PETE_STAY_S) {
      this.peteHere = false;
      this.peteNext = this.time + K.PETE_EVERY_MIN_S + this.rand() * (K.PETE_EVERY_MAX_S - K.PETE_EVERY_MIN_S);
      this.events.push({ type: 'peteLeave' });
    }
  }

  private survival(): void {
    for (const f of this.fish) {
      if (!f.player || !f.alive || this.time < f.nextSurviveCoin) continue;
      f.nextSurviveCoin = this.time + K.SURVIVE_COIN_S;
      f.coins += 1;
      f.score += K.COIN_SCORE;
    }
  }

  // ---------- helpers ----------

  private allowTap(times: number[]): boolean {
    while (times.length && this.time - times[0] > 1) times.shift();
    if (times.length >= K.MAX_TAPS_PER_S) return false;
    times.push(this.time);
    return true;
  }

  fillNpcs(all: boolean): void {
    const npcs = this.fish.filter((f) => !f.player && !f.baby);
    const missing = this.npcTarget - npcs.length;
    const add = all ? missing : Math.min(2, missing);
    for (let i = 0; i < add; i++) {
      const r = this.rand();
      // Level 0 minnows are the only thing a brand-new player fish is big enough to eat.
      const level = r < 0.45 ? 0 : r < 0.65 ? 1 : r < 0.8 ? 2 : r < 0.9 ? 3 : r < 0.97 ? 5 : 8;
      const f = this.newFish(`npc-${this.serial++}`, false, 'npc', Math.floor(this.rand() * NPC_SPECIES), '', '', level);
      if (all) {
        f.x = 20 + this.rand() * (K.SCENE_W - 40);
        f.y = K.SURF + 30 + this.rand() * (K.SEABED - K.SURF - 50);
      } else {
        f.x = this.rand() < 0.5 ? -8 : K.SCENE_W + 8;
        f.y = K.SURF + 40 + this.rand() * (K.SEABED - K.SURF - 60);
      }
      this.retarget(f);
      this.fish.push(f);
    }
    if (missing < 0) {
      for (const f of npcs.slice(0, -missing)) if (!f.hookedBy) this.fish = this.fish.filter((x) => x !== f);
    }
  }

  private newFish(id: string, player: boolean, kind: Fish['kind'], species: number, name: string, color: string, level: number): Fish {
    return {
      id,
      player,
      kind,
      species,
      name,
      color,
      x: K.SCENE_W / 2,
      y: K.SURF + 80,
      vx: 0,
      vy: 0,
      dir: this.rand() < 0.5 ? 1 : -1,
      level,
      food: 0,
      alive: true,
      respawnAt: 0,
      safeUntil: 0,
      dashUntil: 0,
      dashReadyAt: 0,
      ramReadyAt: 0,
      ups: {},
      eggReadyAt: this.time,
      tauntUntil: 0,
      tauntReadyAt: 0,
      findUntil: 0,
      hookedBy: null,
      score: 0,
      coins: 0,
      eats: 0,
      best: level,
      nextSurviveCoin: this.time + K.SURVIVE_COIN_S,
      baby: false,
      owner: null,
      diesAt: 0,
      nextFeed: 0,
      tx: 0,
      ty: 0,
      retargetAt: 0,
    };
  }

  // Swimmers start in Midwater, away from hooks and big fish where possible.
  private placeSpawn(f: Fish): void {
    let best = { x: K.SCENE_W / 2, y: 200, score: -1 };
    for (let i = 0; i < 12; i++) {
      const x = 30 + this.rand() * (K.SCENE_W - 60);
      const y = K.SURF + 70 + this.rand() * 140;
      let score = 999;
      for (const o of this.fish) if (o !== f && o.alive && fishLen(o) > fishLen(f)) score = Math.min(score, Math.hypot(o.x - x, o.y - y));
      for (const b of this.boats) if (b.hook.state !== 'ready') score = Math.min(score, Math.hypot(b.hook.x - x, b.hook.y - y));
      if (score > best.score) best = { x, y, score };
    }
    f.x = best.x;
    f.y = best.y;
    f.vx = 0;
    f.vy = 0;
  }

  private freeBoatX(): number {
    const slots = [K.SCENE_W * 0.14, K.SCENE_W * 0.86, K.SCENE_W * 0.32, K.SCENE_W * 0.68];
    for (const x of slots) if (this.boats.every((b) => Math.abs(b.x - x) > K.BOAT_GAP)) return x;
    return slots[this.boats.length % slots.length];
  }
}

// Team totals. The Crew total is scaled by the ratio of Swimmers to Raiders so uneven teams stay fair.
export function teamTotals(world: World): { crew: number; school: number } {
  const raiders = world.boats.length;
  const swimmers = world.fish.filter((f) => f.player).length;
  const crewRaw = world.boats.reduce((s, b) => s + b.score, 0);
  const school = world.fish.filter((f) => f.player).reduce((s, f) => s + f.score, 0);
  const scale = raiders > 0 && swimmers > 0 ? clamp(swimmers / raiders, 0.5, 2) : 1;
  return { crew: Math.round(crewRaw * scale), school };
}
