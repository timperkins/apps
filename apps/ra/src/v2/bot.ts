// A computer player, run on the host's screen. It plays like a person would,
// at about a person's pace: it deploys its Foundry, builds up a base, keeps
// its Barracks and Vehicle works busy, and every so often sends the army it
// has gathered against the nearest enemy base. It only acts through the same
// orders a player gives (IsoGame.exec), one decision every couple of seconds.
import type { BuildingKind } from './sprites';
import { toScreen } from './stack';
import { TECH } from './tech';
import type { IsoGame } from './game';

export type BotLevel = 'easy' | 'normal' | 'hard';
export const BOT_LEVELS: { id: BotLevel; name: string }[] = [
  { id: 'easy', name: 'Easy' },
  { id: 'normal', name: 'Normal' },
  { id: 'hard', name: 'Hard' },
];

interface Level {
  think: number; // seconds between decisions
  army: number; // units gathered before an attack goes out
  firstAttack: number; // seconds before the first one
  every: number; // seconds between attacks after that
  order: string[]; // what it builds, in order
  units: string[]; // what it trains, in turn
}

const LEVELS: Record<BotLevel, Level> = {
  easy: {
    think: 4,
    army: 4,
    firstAttack: 420,
    every: 180,
    order: ['power', 'barracks', 'refinery', 'power', 'factory'],
    units: ['inf', 'inf', 'buggy', 'inf', 'light'],
  },
  normal: {
    think: 2.5,
    army: 6,
    firstAttack: 300,
    every: 120,
    order: ['power', 'barracks', 'refinery', 'power', 'factory', 'tower', 'power', 'refinery'],
    units: ['inf', 'light', 'rocket', 'light', 'gren', 'buggy', 'inf'],
  },
  hard: {
    think: 1.5,
    army: 8,
    firstAttack: 210,
    every: 90,
    order: ['power', 'barracks', 'refinery', 'power', 'factory', 'refinery', 'tower', 'power', 'radar', 'power', 'tower'],
    units: ['light', 'rocket', 'gren', 'light', 'arty', 'light', 'inf'],
  },
};

type Unit = IsoGame['units'][number];
type Building = IsoGame['buildings'][number];

// distance on the ground, the short way round the world
function apart(g: IsoGame, ax: number, ay: number, bx: number, by: number): number {
  const [nx, ny] = g.nearest(ax, ay, bx, by);
  const [sx0, sy0] = toScreen(ax, ay);
  const [sx1, sy1] = toScreen(nx, ny);
  return Math.hypot(sx1 - sx0, (sy1 - sy0) * 2);
}

export class Bot {
  private lv: Level;
  private t = 0; // seconds played
  private next = 0; // when it next decides something
  private trained = 0; // how many units it has started (to take turns through `units`)
  private attackAt: number;
  private wave = new Set<number>(); // units out on an attack
  private moved = 0; // tries at finding somewhere to deploy

  constructor(
    private g: IsoGame,
    readonly f: number,
    level: BotLevel,
  ) {
    this.lv = LEVELS[level] ?? LEVELS.normal;
    this.attackAt = this.lv.firstAttack;
    // (not all at once at the start)
    this.next = 1 + Math.random() * this.lv.think;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.t < this.next) return;
    this.next = this.t + this.lv.think * (0.8 + Math.random() * 0.4);
    const g = this.g;
    const mine = g.units.filter((u) => u.f === this.f && !u.dead);
    const base = g.buildings.filter((b) => b.f === this.f && !b.dead);
    if (!mine.length && !base.length) return; // out
    const yard = base.find((b) => b.kind === 'yard');
    if (!yard) return this.deploy(mine);
    // one thing a turn, like a person tapping: place, build, train or send
    if (this.place(yard)) return;
    if (this.build()) return;
    if (this.train()) return;
    this.fight(mine, yard);
  }

  // No Foundry yet: deploy the vehicle, moving it somewhere open first if it has to.
  private deploy(mine: Unit[]): void {
    const mcv = mine.find((u) => u.kind === 'mcv');
    if (!mcv || mcv.deploy || mcv.moving) return;
    if (this.g.canDeploy(mcv.id)) {
      this.g.exec(this.f, { c: 'deploy', u: [mcv.id] });
      return;
    }
    // try a step in some direction, a little further each time
    const r = 40 + Math.min(10, this.moved++) * 15;
    const a = Math.random() * Math.PI * 2;
    this.g.exec(this.f, { c: 'move', m: [[mcv.id, mcv.x + Math.cos(a) * r, mcv.y + Math.sin(a) * r]] });
  }

  // A finished building waiting: put it down near the Foundry.
  private place(yard: Building): boolean {
    const e = this.g.eco[this.f];
    const j = e.jobs.get('base')?.ready ? e.jobs.get('base') : e.jobs.get('defense')?.ready ? e.jobs.get('defense') : undefined;
    if (!j) return false;
    const spot = this.g.findSite(this.f, j.tech.id, yard.x, yard.y);
    if (spot) this.g.exec(this.f, { c: 'place', t: j.tech.id, x: spot[0], y: spot[1] });
    else this.g.exec(this.f, { c: 'cancel', t: j.tech.id });
    return true;
  }

  // The next building on its list, once it can afford it.
  private build(): boolean {
    const e = this.g.eco[this.f];
    const have = this.g.standing(this.f);
    const counts = new Map<BuildingKind, number>();
    for (const b of this.g.buildings) if (b.f === this.f && !b.dead) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
    // what the list wants, counting what is already built
    const want = new Map<string, number>();
    let id: string | undefined;
    for (const t of this.lv.order) {
      want.set(t, (want.get(t) ?? 0) + 1);
      if ((counts.get(t as BuildingKind) ?? 0) < want.get(t)!) {
        id = t;
        break;
      }
    }
    // short of power: a power plant first
    const pw = this.g.power(this.f);
    if (pw.used > pw.made - 10 && id && id !== 'power' && have.has('yard')) id = 'power';
    if (!id) return false;
    const tab = id === 'tower' ? 'defense' : 'base';
    if (e.jobs.get(tab)) return false; // busy with it already
    const t = TECH.find((q) => q.id === id);
    if (!t || !t.needs.every((k) => have.has(k)) || e.credits < Math.min(t.cost, 600)) return false;
    this.g.exec(this.f, { c: 'build', t: id });
    return true;
  }

  // Keep the Barracks and Vehicle works busy, a unit at a time.
  private train(): boolean {
    const e = this.g.eco[this.f];
    const have = this.g.standing(this.f);
    // keep enough back to finish the base first
    if (e.credits < 400) return false;
    for (let i = 0; i < this.lv.units.length; i++) {
      const id = this.lv.units[(this.trained + i) % this.lv.units.length];
      const t = TECH.find((q) => q.id === id);
      if (!t || !t.needs.every((k) => have.has(k)) || e.jobs.get(t.tab) || t.cost > e.credits) continue;
      this.trained += i + 1;
      this.g.exec(this.f, { c: 'build', t: id });
      return true;
    }
    return false;
  }

  // Gather an army, and every so often send it at the nearest enemy base.
  private fight(mine: Unit[], yard: Building): void {
    const g = this.g;
    const army = mine.filter((u) => u.kind !== 'mcv' && u.kind !== 'hauler');
    for (const id of [...this.wave]) if (!army.some((u) => u.id === id)) this.wave.delete(id);
    // the ones out on an attack: on to the next target once they're done with theirs
    const out = army.filter((u) => this.wave.has(u.id));
    if (out.length) {
      const idle = out.filter((u) => !u.target && !u.moving);
      if (idle.length) {
        const t = this.targetNear(idle[0].x, idle[0].y);
        if (t) g.exec(this.f, { c: 'attack', u: idle.map((u) => u.id), t: t.id });
      }
      return;
    }
    const home = army.filter((u) => !this.wave.has(u.id));
    if (this.t < this.attackAt || home.length < this.lv.army) {
      // the rest wait in front of the base
      const loose = home.filter((u) => !u.moving && !u.target && apart(g, u.x, u.y, yard.x, yard.y) > 220);
      if (loose.length) g.exec(this.f, { c: 'move', m: loose.map((u) => [u.id, yard.x + 50 + Math.random() * 40, yard.y + 50 + Math.random() * 40]) });
      return;
    }
    const t = this.targetNear(yard.x, yard.y, true);
    if (!t) return;
    this.attackAt = this.t + this.lv.every;
    for (const u of home) this.wave.add(u.id);
    g.exec(this.f, { c: 'attack', u: home.map((u) => u.id), t: t.id });
  }

  // The nearest enemy building (or, with none left nearby, unit) to (x, y).
  private targetNear(x: number, y: number, buildingsOnly = false): { id: number } | null {
    const g = this.g;
    let best: { id: number } | null = null;
    let bd = Infinity;
    const out = g.out;
    for (const b of g.buildings) {
      if (b.f === this.f || b.dead || out.has(b.f)) continue;
      const d = apart(g, x, y, b.x, b.y);
      if (d < bd) [best, bd] = [b, d];
    }
    if (best && (buildingsOnly || bd < 900)) return best;
    for (const u of g.units) {
      if (u.f === this.f || u.dead || u.kind === 'heli' || u.kind === 'boat') continue;
      const d = apart(g, x, y, u.x, u.y);
      if (d < bd) [best, bd] = [u, d];
    }
    return best;
  }
}
