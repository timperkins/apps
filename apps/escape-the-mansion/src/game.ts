// The simulation: Lenny, guards, dogs, traps, items, throws, noise and Jeff.
import { castRay, findPath, generateLevel, isWall, lineOfSight, type LevelData, type Pt } from './level';
import { TILE } from './themes';
import type { ItemKind } from './sprites';
import { lennyStage, jeffStage } from './sprites';
import { CARRY, itemWeights, stats, type Ranks, type Stats } from './powerups';
import { Rng } from './rng';
import { JEFF_CAMEO, JEFF_FINAL_CHASE, LENNY_CAMEO, freshLine, stageLines } from './story';

const T = TILE;
export type Face = 'down' | 'up' | 'left' | 'right';

export interface Player {
  x: number;
  y: number;
  face: Face;
  ang: number;
  moving: boolean;
  anim: number;
  hearts: number;
  invuln: number;
  held: ItemKind | null;
  count: number;
  inSmoke: boolean;
  twitchT: number;
  danger: number; // 0..1, highest alert of anything watching
}

export type GuardState = 'patrol' | 'investigate' | 'look' | 'chase' | 'search' | 'return' | 'ko';
export interface Guard {
  x: number;
  y: number;
  route: Pt[];
  wp: number;
  wpDir: number;
  state: GuardState;
  ang: number;
  alert: number;
  path: Pt[];
  repath: number;
  target: Pt | null;
  lastSeen: Pt | null;
  lost: number;
  timer: number;
  ko: number;
  variant: number;
  anim: number;
  moving: boolean;
  sentry: boolean;
  lookBase: number;
  armored: boolean;
}

export type DogState = 'wander' | 'idle' | 'chase' | 'eat' | 'retreat' | 'ko';
export interface Dog {
  x: number;
  y: number;
  cells: Pt[];
  state: DogState;
  path: Pt[];
  timer: number;
  repath: number;
  ang: number;
  ko: number;
  anim: number;
  moving: boolean;
  meat: Meat | null;
  alert: number;
}

export interface Laser {
  a: Pt;
  b: Pt;
  period: number;
  offset: number;
  duty: number;
  on: boolean;
  warn: boolean;
}
export interface Camera {
  x: number;
  y: number;
  base: number;
  sweep: number;
  speed: number;
  ang: number;
  alert: number;
  cooldown: number;
  disabled: number;
}
export interface Spike {
  tx: number;
  ty: number;
  period: number;
  offset: number;
  state: 0 | 1 | 2; // down, warning, up
}
export interface Item {
  x: number;
  y: number;
  kind: ItemKind;
  count: number;
  alive: boolean;
  bob: number;
}
export interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: ItemKind;
  dist: number;
  max: number;
  z: number;
  spin: number;
}
export interface Meat {
  x: number;
  y: number;
  t: number;
  eaten: boolean;
}
export interface Cloud {
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
}
export interface Toy {
  x: number;
  y: number;
  t: number;
  tick: number;
}
export interface Ring {
  x: number;
  y: number;
  r: number;
  t: number;
  color: string;
}
export interface Popup {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}
export interface Bubble {
  who: 'jeff' | 'lenny';
  text: string;
  t: number;
}
export interface Jeff {
  x: number;
  y: number;
  mode: 'cameo' | 'boss';
  t: number;
  visible: boolean;
  stun: number;
  path: Pt[];
  repath: number;
  ang: number;
  anim: number;
  moving: boolean;
  shout: number;
}
export interface Poof {
  x: number;
  y: number;
  t: number;
}

export type GameEvent =
  | { type: 'sfx'; name: string; x?: number; y?: number }
  | { type: 'xp'; amount: number; reason: string }
  | { type: 'caught'; reason: 'guard' | 'health' | 'jeff' }
  | { type: 'complete'; ghost: boolean; time: number }
  | { type: 'spotted' }
  | { type: 'hint'; text: string }
  | { type: 'intercom'; text: string };

export interface Input {
  mx: number;
  my: number;
  action: boolean; // pressed this frame
}

export class Game {
  L: LevelData;
  level: number;
  ranks: Ranks;
  st: Stats;
  p!: Player;
  guards: Guard[] = [];
  dogs: Dog[] = [];
  lasers: Laser[] = [];
  cameras: Camera[] = [];
  spikes: Spike[] = [];
  items: Item[] = [];
  projs: Proj[] = [];
  meats: Meat[] = [];
  clouds: Cloud[] = [];
  toys: Toy[] = [];
  rings: Ring[] = [];
  popups: Popup[] = [];
  poofs: Poof[] = [];
  bubbles: Bubble[] = [];
  jeff: Jeff | null = null;
  cameoDone = false;
  intercomT = 0;
  time = 0;
  spotted = false;
  over: 'caught' | 'complete' | null = null;
  overT = 0;
  overReason: 'guard' | 'health' | 'jeff' = 'guard';
  events: GameEvent[] = [];
  rng: Rng;
  dropGuard: Item | null = null;
  shake = 0;
  stage: number;
  jstage: number;

  constructor(level: number, ranks: Ranks) {
    this.level = level;
    this.ranks = ranks;
    this.st = stats(ranks);
    this.L = generateLevel(level, itemWeights(ranks, level), this.st.itemScale);
    this.rng = new Rng(this.L.seed + 99);
    this.stage = lennyStage(level);
    this.jstage = jeffStage(level);
    this.reset();
  }

  /** Puts everything back where it started (used when Lenny is caught). */
  reset() {
    const L = this.L;
    this.rng = new Rng(L.seed + 99);
    this.time = 0;
    this.spotted = false;
    this.over = null;
    this.overT = 0;
    this.projs = [];
    this.meats = [];
    this.clouds = [];
    this.toys = [];
    this.rings = [];
    this.popups = [];
    this.poofs = [];
    this.bubbles = [];
    this.cameoDone = false;
    this.intercomT = 25 + this.rng.next() * 25;
    this.dropGuard = null;
    this.p = {
      x: L.start.x,
      y: L.start.y,
      face: 'down',
      ang: Math.PI / 2,
      moving: false,
      anim: 0,
      hearts: this.st.maxHearts,
      invuln: 0,
      held: null,
      count: 0,
      inSmoke: false,
      twitchT: 2,
      danger: 0,
    };
    this.guards = L.guards.map((g) => ({
      x: g.route[0].x,
      y: g.route[0].y,
      route: g.route,
      wp: 0,
      wpDir: 1,
      state: 'patrol' as GuardState,
      ang: Math.PI / 2,
      alert: 0,
      path: [],
      repath: 0,
      target: null,
      lastSeen: null,
      lost: 0,
      timer: 0,
      ko: 0,
      variant: g.variant,
      anim: 0,
      moving: false,
      sentry: g.route.length === 1,
      lookBase: this.rng.next() * Math.PI * 2,
      armored: !!g.armored,
    }));
    this.dogs = L.dogs.map((d) => ({
      x: d.home.x,
      y: d.home.y,
      cells: d.cells,
      state: 'idle' as DogState,
      path: [],
      timer: this.rng.next() * 2,
      repath: 0,
      ang: 0,
      ko: 0,
      anim: 0,
      moving: false,
      meat: null,
      alert: 0,
    }));
    this.lasers = L.lasers.map((l) => ({ ...l, on: false, warn: false }));
    this.cameras = L.cameras.map((c) => ({ ...c, ang: c.base, alert: 0, cooldown: 0, disabled: 0 }));
    this.spikes = L.spikes.map((s) => ({ ...s, state: 0 as const }));
    this.items = L.items.map((i) => ({ ...i, count: 1, alive: true, bob: this.rng.next() * 6 }));
    this.jeff = null;
    if (L.final) {
      // Jeff waits in the room before the gate and comes for Lenny himself
      const p = findPath(L, L.start.x, L.start.y, L.exit.x, L.exit.y, 100000) ?? [];
      const spot = p[Math.floor(p.length * 0.55)] ?? L.exit;
      this.jeff = { x: spot.x, y: spot.y, mode: 'boss', t: 0, visible: true, stun: 0, path: [], repath: 0, ang: 0, anim: 0, moving: false, shout: 2 };
    }
  }

  emit(e: GameEvent) {
    this.events.push(e);
  }
  popup(x: number, y: number, text: string, color = '#fff') {
    this.popups.push({ x, y, text, t: 0, color });
  }
  say(who: 'jeff' | 'lenny', text: string) {
    this.bubbles = this.bubbles.filter((b) => b.who !== who);
    this.bubbles.push({ who, text, t: 0 });
  }

  // ------------------------------------------------------------ movement helpers

  private blocked(x: number, y: number, hw: number, hh: number) {
    return (
      isWall(this.L, Math.floor((x - hw) / T), Math.floor((y - hh) / T)) ||
      isWall(this.L, Math.floor((x + hw) / T), Math.floor((y - hh) / T)) ||
      isWall(this.L, Math.floor((x - hw) / T), Math.floor((y + hh) / T)) ||
      isWall(this.L, Math.floor((x + hw) / T), Math.floor((y + hh) / T))
    );
  }

  private moveBox(e: { x: number; y: number }, dx: number, dy: number, hw = 8, hh = 7) {
    if (dx && !this.blocked(e.x + dx, e.y, hw, hh)) e.x += dx;
    else if (dx) {
      // slide around corners: nudge vertically if almost aligned with an opening
      for (const n of [3, -3, 6, -6]) {
        if (!this.blocked(e.x + dx, e.y + n, hw, hh) && !this.blocked(e.x, e.y + n, hw, hh)) {
          e.y += Math.sign(n) * Math.min(Math.abs(n), Math.abs(dx));
          break;
        }
      }
    }
    if (dy && !this.blocked(e.x, e.y + dy, hw, hh)) e.y += dy;
    else if (dy) {
      for (const n of [3, -3, 6, -6]) {
        if (!this.blocked(e.x + n, e.y + dy, hw, hh) && !this.blocked(e.x + n, e.y, hw, hh)) {
          e.x += Math.sign(n) * Math.min(Math.abs(n), Math.abs(dy));
          break;
        }
      }
    }
  }

  /** Moves toward a point; returns true when it arrives. */
  private stepTo(e: { x: number; y: number; ang: number; moving: boolean }, tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      e.x = tx;
      e.y = ty;
      return true;
    }
    const s = Math.min(d, speed * dt);
    e.x += (dx / d) * s;
    e.y += (dy / d) * s;
    e.ang = turnToward(e.ang, Math.atan2(dy, dx), 10 * dt);
    e.moving = true;
    return s >= d - 0.01;
  }

  private followPath(e: { x: number; y: number; ang: number; moving: boolean; path: Pt[] }, speed: number, dt: number) {
    let budget = dt;
    while (e.path.length && budget > 0) {
      const n = e.path[0];
      const d = Math.hypot(n.x - e.x, n.y - e.y);
      const need = d / speed;
      if (need <= budget) {
        this.stepTo(e, n.x, n.y, speed, need + 0.0001);
        e.path.shift();
        budget -= need;
      } else {
        this.stepTo(e, n.x, n.y, speed, budget);
        budget = 0;
      }
    }
    return e.path.length === 0;
  }

  private pathTo(from: { x: number; y: number }, to: Pt): Pt[] {
    return findPath(this.L, from.x, from.y, to.x, to.y) ?? [];
  }

  inSmoke(x: number, y: number) {
    return this.clouds.some((c) => Math.hypot(c.x - x, c.y - y) < c.r * Math.min(1, c.t * 3, (c.max - c.t) * 1.5 + 0.2));
  }

  /** Can something at (x,y) facing ang see Lenny? */
  private sees(x: number, y: number, ang: number, range: number, fov: number) {
    const p = this.p;
    const px = p.x;
    const py = p.y - 8;
    const d = Math.hypot(px - x, py - y);
    if (d > range) return 0;
    if (p.inSmoke || this.inSmoke(x, y)) return 0;
    if (Math.abs(angDiff(Math.atan2(py - y, px - x), ang)) > fov / 2 && d > T * 0.9) return 0;
    if (!lineOfSight(this.L, x, y, px, py)) return 0;
    return 1 - d / range;
  }

  // ------------------------------------------------------------ noise

  noise(x: number, y: number, radius: number, color = 'rgba(255,255,255,0.6)', credit = false) {
    this.rings.push({ x, y, r: radius, t: 0, color });
    let reacted = 0;
    for (const g of this.guards) {
      if (g.state === 'ko' || g.state === 'chase') continue;
      if (Math.hypot(g.x - x, g.y - y) > radius) continue;
      const path = this.pathTo(g, { x, y });
      if (!path.length && Math.hypot(g.x - x, g.y - y) > T) continue;
      g.state = 'investigate';
      g.path = path;
      g.target = { x, y };
      g.timer = 0;
      g.alert = Math.max(g.alert, 0.2);
      reacted++;
    }
    if (credit && reacted) {
      this.emit({ type: 'xp', amount: 5 * reacted, reason: 'Distraction' });
      this.popup(x, y - 20, reacted > 1 ? `Distracted ${reacted}!` : 'Distracted!', '#9fe0ff');
    }
    return reacted;
  }

  // ------------------------------------------------------------ update

  update(dt: number, input: Input) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2);
    this.events.length = 0;

    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.8);
    for (const pp of this.popups) pp.t += dt;
    this.popups = this.popups.filter((pp) => pp.t < 1.4);
    for (const pf of this.poofs) pf.t += dt;
    this.poofs = this.poofs.filter((pf) => pf.t < 0.7);
    for (const b of this.bubbles) b.t += dt;
    this.bubbles = this.bubbles.filter((b) => b.t < 3.6);

    if (this.over) {
      this.overT += dt;
      return;
    }

    this.updatePlayer(dt, input);
    this.updateTraps(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.updateGuards(dt);
    this.updateDogs(dt);
    this.updateCameras(dt);
    this.updateJeff(dt);

    // danger level for Lenny's nervous animation
    let danger = 0;
    for (const g of this.guards) if (g.state !== 'ko') danger = Math.max(danger, g.state === 'chase' ? 1 : g.alert);
    for (const c of this.cameras) danger = Math.max(danger, c.alert);
    for (const d of this.dogs) if (d.state === 'chase') danger = 1;
    this.p.danger = danger;

    // exit
    const L = this.L;
    if (Math.hypot(this.p.x - L.exit.x, this.p.y - L.exit.y) < 26) {
      this.over = 'complete';
      this.overT = 0;
      this.emit({ type: 'complete', ghost: !this.spotted, time: this.time });
    }
  }

  private updatePlayer(dt: number, input: Input) {
    const p = this.p;
    p.invuln = Math.max(0, p.invuln - dt);
    p.twitchT -= dt;
    if (p.twitchT < -0.18) p.twitchT = this.stage === 0 ? 0.8 + this.rng.next() * 2 : 2 + this.rng.next() * 4;

    const mag = Math.min(1, Math.hypot(input.mx, input.my));
    p.moving = mag > 0.15;
    if (p.moving) {
      const ang = Math.atan2(input.my, input.mx);
      p.ang = ang;
      const sp = this.st.speed * (0.35 + 0.65 * mag);
      this.moveBox(p, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
      p.anim += dt * sp * 0.06;
      p.face = faceOf(ang);
    }
    p.inSmoke = this.inSmoke(p.x, p.y);

    // pick up
    if (this.dropGuard && Math.hypot(this.dropGuard.x - p.x, this.dropGuard.y - p.y) > 22) this.dropGuard = null;
    for (const it of this.items) {
      if (!it.alive || it === this.dropGuard) continue;
      if (Math.hypot(it.x - p.x, it.y - (p.y - 4)) > 18) continue;
      if (it.kind === 'bandage') {
        if (p.hearts < this.st.maxHearts) {
          it.alive = false;
          p.hearts++;
          this.popup(it.x, it.y - 10, '+1 heart', '#ff8a8a');
          this.emit({ type: 'sfx', name: 'heal' });
        }
        continue;
      }
      const cap = CARRY[it.kind] + this.st.carryBonus;
      if (p.held === null || (p.held === it.kind && p.count < cap)) {
        const take = Math.min(it.count, cap - (p.held === it.kind ? p.count : 0));
        p.held = it.kind;
        p.count += take;
        it.count -= take;
        if (it.count <= 0) it.alive = false;
        this.emit({ type: 'sfx', name: 'pickup' });
        this.emit({ type: 'xp', amount: 1, reason: 'Pickup' });
        this.popup(it.x, it.y - 10, `+${take} ${it.kind}`, '#ffe28a');
      } else if (p.held !== it.kind) {
        // swap what you're holding for this
        const dropped: Item = { x: p.x, y: p.y + 2, kind: p.held, count: p.count, alive: true, bob: 0 };
        this.items.push(dropped);
        this.dropGuard = dropped;
        p.held = it.kind;
        p.count = Math.min(it.count, cap);
        it.alive = false;
        this.emit({ type: 'sfx', name: 'pickup' });
        this.popup(it.x, it.y - 10, `Swapped for ${it.kind}`, '#ffe28a');
      }
    }
    this.items = this.items.filter((i) => i.alive);

    if (input.action) this.useHeld();
  }

  private useHeld() {
    const p = this.p;
    if (!p.held) {
      this.emit({ type: 'hint', text: 'Nothing to throw. Pick something up first.' });
      return;
    }
    const kind = p.held;
    p.count--;
    if (p.count <= 0) {
      p.held = null;
      p.count = 0;
    }
    if (kind === 'smoke') {
      this.clouds.push({ x: p.x, y: p.y - 6, r: T * 2.3, t: 0, max: 7 });
      this.emit({ type: 'sfx', name: 'smoke' });
      return;
    }
    // aim assist: home in on the nearest suitable target in front of Lenny
    let ang = p.ang;
    const range = (kind === 'rock' ? 6.5 : 7) * T * this.st.throwMul;
    let best = Infinity;
    const consider = (x: number, y: number) => {
      const d = Math.hypot(x - p.x, y - (p.y - 8));
      if (d > range || d < 4) return;
      const a = Math.atan2(y - (p.y - 8), x - p.x);
      const off = Math.abs(angDiff(a, p.ang));
      if (off > this.st.aimCone) return;
      if (!lineOfSight(this.L, p.x, p.y - 8, x, y)) return;
      const score = d * (1 + off * 2);
      if (score < best) {
        best = score;
        ang = a;
      }
    };
    if (kind === 'rock') {
      for (const g of this.guards) if (g.state !== 'ko') consider(g.x, g.y - 10);
      for (const d of this.dogs) if (d.state !== 'ko') consider(d.x, d.y - 6);
      for (const c of this.cameras) if (c.disabled <= 0) consider(c.x, c.y);
      if (this.jeff && this.jeff.mode === 'boss' && this.jeff.stun <= 0) consider(this.jeff.x, this.jeff.y - 12);
    } else if (kind === 'meat') {
      for (const d of this.dogs) if (d.state !== 'ko') consider(d.x, d.y);
    }
    const speed = 380 * Math.sqrt(this.st.throwMul);
    this.projs.push({ x: p.x, y: p.y - 8, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, kind, dist: 0, max: range, z: 0, spin: 0 });
    this.emit({ type: 'sfx', name: 'throw' });
  }

  private hurt(reason: string) {
    const p = this.p;
    if (p.invuln > 0) return;
    p.hearts--;
    p.invuln = 1.4;
    this.shake = 0.5;
    this.emit({ type: 'sfx', name: 'hurt' });
    this.popup(p.x, p.y - 30, reason, '#ff6b6b');
    if (p.hearts <= 0) this.fail('health');
  }

  private fail(reason: 'guard' | 'health' | 'jeff') {
    if (this.over) return;
    this.over = 'caught';
    this.overT = 0;
    this.overReason = reason;
    this.shake = 0.6;
    this.emit({ type: 'caught', reason });
  }

  private updateTraps(dt: number) {
    const p = this.p;
    for (const l of this.lasers) {
      const ph = ((this.time + l.offset) % l.period) / l.period;
      l.on = ph < l.duty;
      l.warn = !l.on && ph > 0.88;
      if (l.on && p.invuln <= 0 && segDist(p.x, p.y - 6, l.a, l.b) < 9) {
        this.hurt('Zap!');
        this.noise(p.x, p.y, T * 9, 'rgba(255,60,60,0.7)');
        this.emit({ type: 'sfx', name: 'alarm' });
        this.popup(p.x, p.y - 44, 'ALARM!', '#ff3b3b');
      }
    }
    void dt;
    const tx = Math.floor(p.x / T);
    const ty = Math.floor((p.y - 2) / T);
    for (const s of this.spikes) {
      const ph = ((this.time + s.offset) % s.period) / s.period;
      const prev = s.state;
      s.state = ph < 0.55 ? 0 : ph < 0.72 ? 1 : 2;
      if (s.state === 2 && prev !== 2 && Math.hypot((s.tx + 0.5) * T - p.x, (s.ty + 0.5) * T - p.y) < 6 * T)
        this.emit({ type: 'sfx', name: 'spike', x: s.tx, y: s.ty });
      if (s.state === 2 && s.tx === tx && s.ty === ty) this.hurt('Ouch!');
    }
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projs) {
      const sx = pr.vx * dt;
      const sy = pr.vy * dt;
      const nx = pr.x + sx;
      const ny = pr.y + sy;
      pr.spin += dt * 14;
      let land = false;
      if (isWall(this.L, Math.floor(nx / T), Math.floor(ny / T))) land = true;
      else {
        pr.x = nx;
        pr.y = ny;
        pr.dist += Math.hypot(sx, sy);
        pr.z = Math.sin(Math.PI * Math.min(1, pr.dist / pr.max)) * 14;
        if (pr.dist >= pr.max) land = true;
      }
      if (pr.kind === 'rock') {
        // hits
        for (const g of this.guards) {
          if (g.state === 'ko' || Math.hypot(g.x - pr.x, g.y - 10 - pr.y) > 15) continue;
          if (g.armored) {
            // rocks bounce off armour: it only staggers
            g.state = 'ko';
            g.ko = 1.3;
            g.path = [];
            this.popup(g.x, g.y - 34, 'CLANG!', '#cfd8e0');
            this.emit({ type: 'sfx', name: 'clang' });
            this.emit({ type: 'xp', amount: 3, reason: 'Stagger' });
            land = true;
            break;
          }
          g.state = 'ko';
          g.ko = 6 * this.st.koMul;
          g.alert = 0;
          g.path = [];
          this.popup(g.x, g.y - 34, 'BONK!', '#ffd34d');
          this.emit({ type: 'sfx', name: 'bonk' });
          this.emit({ type: 'xp', amount: 15, reason: 'Knockout' });
          pr.dist = pr.max + 1;
          land = true;
          break;
        }
        if (!land)
          for (const d of this.dogs) {
            if (d.state === 'ko' || Math.hypot(d.x - pr.x, d.y - 6 - pr.y) > 15) continue;
            d.state = 'ko';
            d.ko = 4.5 * this.st.koMul;
            d.path = [];
            this.popup(d.x, d.y - 26, 'YELP!', '#ffd34d');
            this.emit({ type: 'sfx', name: 'yelp' });
            this.emit({ type: 'xp', amount: 10, reason: 'Knockout' });
            land = true;
            break;
          }
        if (!land)
          for (const c of this.cameras) {
            if (c.disabled > 0 || Math.hypot(c.x - pr.x, c.y - pr.y) > 14) continue;
            c.disabled = 9 * this.st.koMul;
            c.alert = 0;
            this.popup(c.x, c.y - 16, 'CRACK!', '#ffd34d');
            this.emit({ type: 'sfx', name: 'glass' });
            this.emit({ type: 'xp', amount: 5, reason: 'Camera' });
            land = true;
            break;
          }
        const j = this.jeff;
        if (!land && j && j.mode === 'boss' && j.stun <= 0 && Math.hypot(j.x - pr.x, j.y - 12 - pr.y) > 0 && Math.hypot(j.x - pr.x, j.y - 12 - pr.y) < 16) {
          j.stun = 3.5 * this.st.koMul;
          j.path = [];
          this.popup(j.x, j.y - 36, 'OOF!', '#ffd34d');
          this.say('jeff', this.rng.pick(['My HEAD!', 'How DARE you!', 'Ow! Ow ow ow!']));
          this.emit({ type: 'sfx', name: 'bonk' });
          land = true;
        }
      }
      if (land) {
        pr.dist = Infinity;
        this.land(pr);
      }
    }
    this.projs = this.projs.filter((p) => p.dist !== Infinity);
  }

  private land(pr: Proj) {
    // step back out of a wall
    let x = pr.x;
    let y = pr.y;
    if (isWall(this.L, Math.floor(x / T), Math.floor(y / T))) {
      x -= pr.vx * 0.02;
      y -= pr.vy * 0.02;
    }
    switch (pr.kind) {
      case 'rock':
        this.emit({ type: 'sfx', name: 'clack' });
        this.noise(x, y, T * 3, 'rgba(255,255,255,0.5)', true);
        break;
      case 'bottle':
        this.emit({ type: 'sfx', name: 'glass' });
        this.noise(x, y, T * 8.5, 'rgba(160,255,190,0.7)', true);
        this.shake = Math.max(this.shake, 0.15);
        break;
      case 'meat': {
        const m: Meat = { x, y, t: 0, eaten: false };
        this.meats.push(m);
        this.emit({ type: 'sfx', name: 'splat' });
        break;
      }
      case 'toy':
        this.toys.push({ x, y, t: 0, tick: 0 });
        this.emit({ type: 'sfx', name: 'clack' });
        break;
      case 'smoke':
        this.clouds.push({ x, y, r: T * 2.3, t: 0, max: 7 });
        this.emit({ type: 'sfx', name: 'smoke' });
        break;
      default:
        break;
    }
  }

  private updateEffects(dt: number) {
    for (const c of this.clouds) c.t += dt;
    this.clouds = this.clouds.filter((c) => c.t < c.max);
    for (const t of this.toys) {
      t.t += dt;
      t.tick -= dt;
      if (t.tick <= 0) {
        t.tick = 1.1;
        this.emit({ type: 'sfx', name: 'toy' });
        this.noise(t.x, t.y, T * 7, 'rgba(255,230,120,0.6)', t.t < 0.2);
      }
    }
    this.toys = this.toys.filter((t) => t.t < 7);
    for (const m of this.meats) m.t += dt;
    this.meats = this.meats.filter((m) => !m.eaten && m.t < 20);
  }

  private visionRange() {
    return (4.2 + this.level * 0.04) * T * this.st.visionMul;
  }

  private updateGuards(dt: number) {
    const p = this.p;
    const patrolSpeed = 52 + this.level * 0.7;
    const chaseSpeed = Math.min(116, 100 + this.level * 0.4);
    const range = this.visionRange();
    const fov = (68 * Math.PI) / 180;
    for (const g of this.guards) {
      g.moving = false;
      const slow = g.armored ? 0.85 : 1;
      if (g.state === 'ko') {
        g.ko -= dt;
        if (g.ko <= 0) {
          g.state = 'return';
          g.path = this.pathTo(g, g.route[g.wp]);
          g.alert = 0.3;
        }
        continue;
      }
      // perception
      const seen = this.sees(g.x, g.y - 12, g.ang, range, fov);
      if (seen > 0) {
        if (g.state !== 'chase') {
          g.alert += dt * (0.9 + 2.4 * seen) * this.st.detectMul * (g.state === 'investigate' || g.state === 'search' ? 1.5 : 1);
          if (g.alert >= 1) {
            g.alert = 1;
            g.state = 'chase';
            g.repath = 0;
            this.spotted = true;
            this.emit({ type: 'spotted' });
            this.emit({ type: 'sfx', name: 'spotted' });
            this.popup(g.x, g.y - 40, '!', '#ff4040');
            // shout for help
            for (const o of this.guards) {
              if (o === g || o.state === 'ko' || o.state === 'chase') continue;
              if (Math.hypot(o.x - g.x, o.y - g.y) < T * 6) {
                o.state = 'investigate';
                o.target = { x: p.x, y: p.y };
                o.path = this.pathTo(o, o.target);
                o.timer = 0;
              }
            }
          }
        }
        g.lastSeen = { x: p.x, y: p.y };
        g.lost = 0;
      } else if (g.state !== 'chase') {
        g.alert = Math.max(0, g.alert - dt * 0.35);
      }

      // a guard that becomes suspicious turns to look
      if (seen > 0 && g.state !== 'chase' && g.alert > 0.35) {
        g.ang = turnToward(g.ang, Math.atan2(p.y - g.y, p.x - g.x), 3 * dt);
      }

      switch (g.state) {
        case 'patrol': {
          if (g.alert > 0.35 && seen > 0) break; // freeze and stare
          if (g.sentry) {
            g.timer += dt;
            const open = openDirs(this.L, g.x, g.y);
            const k = Math.floor((g.timer + g.lookBase) / 2.4) % open.length;
            g.ang = turnToward(g.ang, open[k], 2.5 * dt);
            break;
          }
          const tgt = g.route[g.wp];
          if (this.stepTo(g, tgt.x, tgt.y, patrolSpeed * slow, dt)) {
            if (g.route.length > 1) {
              if (g.wp + g.wpDir < 0 || g.wp + g.wpDir >= g.route.length) {
                g.wpDir *= -1;
                g.state = 'look';
                g.timer = 0;
                g.target = null;
                g.lookBase = g.ang;
              }
              g.wp += g.wpDir;
            }
          }
          break;
        }
        case 'investigate': {
          if (this.followPath(g, patrolSpeed * 1.35 * slow, dt)) {
            g.state = 'look';
            g.timer = 0;
            g.lookBase = g.ang;
          }
          break;
        }
        case 'look': {
          g.timer += dt;
          g.ang = g.lookBase + Math.sin(g.timer * 2.2) * 1.3;
          if (g.timer > (g.target ? 2.6 : 1.1)) {
            g.state = 'return';
            g.path = this.pathTo(g, g.route[g.wp]);
          }
          break;
        }
        case 'search': {
          if (this.followPath(g, patrolSpeed * 1.4 * slow, dt)) {
            g.state = 'look';
            g.timer = 0;
            g.target = g.lastSeen;
            g.lookBase = g.ang;
            g.alert = 0.6;
          }
          break;
        }
        case 'return': {
          if (this.followPath(g, patrolSpeed * slow, dt)) {
            g.state = 'patrol';
            g.target = null;
          }
          break;
        }
        case 'chase': {
          g.repath -= dt;
          if (seen <= 0) g.lost += dt;
          if (g.lost > 3.2) {
            g.state = 'search';
            g.alert = 0.7;
            g.path = g.lastSeen ? this.pathTo(g, g.lastSeen) : [];
            break;
          }
          if (g.repath <= 0) {
            g.repath = 0.3;
            const goal = seen > 0 ? { x: p.x, y: p.y } : (g.lastSeen ?? { x: p.x, y: p.y });
            g.path = this.pathTo(g, goal);
          }
          if (seen > 0 && lineOfSight(this.L, g.x, g.y, p.x, p.y) && Math.hypot(p.x - g.x, p.y - g.y) < T * 1.5) {
            this.stepTo(g, p.x, p.y, chaseSpeed * slow, dt);
          } else this.followPath(g, chaseSpeed * slow, dt);
          break;
        }
      }
      if (g.moving) g.anim += dt * 6;

      // caught!
      if (Math.hypot(p.x - g.x, p.y - g.y) < 17) {
        g.state = 'chase';
        this.fail('guard');
      }
    }
  }

  private updateDogs(dt: number) {
    const p = this.p;
    const nose = T * 3.6 * this.st.dogNoseMul;
    for (const d of this.dogs) {
      d.moving = false;
      if (d.state === 'ko') {
        d.ko -= dt;
        if (d.ko <= 0) {
          d.state = 'idle';
          d.timer = 1;
        }
        continue;
      }
      // meat beats everything
      if (d.state !== 'eat') {
        const m = this.meats.find((m) => !m.eaten && Math.hypot(m.x - d.x, m.y - d.y) < T * 8 && !this.dogs.some((o) => o !== d && o.meat === m));
        if (m) {
          d.state = 'eat';
          d.meat = m;
          d.path = this.pathTo(d, m);
          d.timer = 0;
          this.popup(d.x, d.y - 28, '♥', '#ff8aa0');
        }
      }
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      const smell = !p.inSmoke && dist < nose && (dist < T * 1.6 || lineOfSight(this.L, d.x, d.y - 6, p.x, p.y - 6));
      switch (d.state) {
        case 'idle':
        case 'wander': {
          if (smell) {
            d.state = 'chase';
            d.timer = 0;
            d.repath = 0;
            this.spotted = true;
            this.emit({ type: 'sfx', name: 'bark' });
            this.popup(d.x, d.y - 28, 'WOOF!', '#ffb04d');
            this.noise(d.x, d.y, T * 6, 'rgba(255,170,80,0.6)');
            break;
          }
          if (d.state === 'idle') {
            d.timer -= dt;
            if (d.timer <= 0 && d.cells.length) {
              d.state = 'wander';
              const c = this.rng.pick(d.cells);
              d.path = this.pathTo(d, { x: c.x + (this.rng.next() - 0.5) * T, y: c.y + (this.rng.next() - 0.5) * T });
            }
          } else if (this.followPath(d, 62, dt)) {
            d.state = 'idle';
            d.timer = 0.8 + this.rng.next() * 1.8;
          }
          break;
        }
        case 'chase': {
          d.timer += dt;
          d.repath -= dt;
          if (d.repath <= 0) {
            d.repath = 0.25;
            d.path = this.pathTo(d, p);
          }
          if (dist < T) this.stepTo(d, p.x, p.y, 138, dt);
          else this.followPath(d, 138, dt);
          if (d.timer > 5.5 || (dist > nose * 1.8 && d.timer > 1.5)) {
            d.state = 'idle';
            d.timer = 1.5;
          }
          if (dist < 16) {
            this.hurt('Bite!');
            this.emit({ type: 'sfx', name: 'bark' });
            d.state = 'retreat';
            d.timer = 2.4;
            const away = { x: d.x + (d.x - p.x) * 3, y: d.y + (d.y - p.y) * 3 };
            d.path = this.pathTo(d, away).slice(0, 4);
          }
          break;
        }
        case 'retreat': {
          d.timer -= dt;
          this.followPath(d, 70, dt);
          if (d.timer <= 0) d.state = 'idle';
          break;
        }
        case 'eat': {
          const m = d.meat;
          if (!m || m.eaten) {
            d.state = 'idle';
            d.meat = null;
            break;
          }
          if (this.followPath(d, 120, dt) || Math.hypot(m.x - d.x, m.y - d.y) < 10) {
            d.timer += dt;
            d.anim += dt * 3;
            if (d.timer > 7) {
              m.eaten = true;
              d.meat = null;
              d.state = 'idle';
              d.timer = 1;
            }
          }
          break;
        }
      }
      if (d.moving) d.anim += dt * 9;
    }
  }

  private updateCameras(dt: number) {
    const range = 5.2 * T * this.st.visionMul;
    const fov = (46 * Math.PI) / 180;
    for (const c of this.cameras) {
      if (c.disabled > 0) {
        c.disabled -= dt;
        continue;
      }
      c.ang = c.base + Math.sin(this.time * c.speed) * c.sweep;
      c.cooldown = Math.max(0, c.cooldown - dt);
      const seen = c.cooldown > 0 ? 0 : this.sees(c.x, c.y, c.ang, range, fov);
      if (seen > 0) {
        c.alert += dt * (1 + 1.6 * seen) * this.st.detectMul;
        if (c.alert >= 1) {
          c.alert = 0;
          c.cooldown = 4;
          this.spotted = true;
          this.emit({ type: 'sfx', name: 'alarm' });
          this.popup(c.x, c.y - 10, 'ALARM!', '#ff3b3b');
          this.noise(this.p.x, this.p.y, T * 12, 'rgba(255,60,60,0.7)');
        }
      } else c.alert = Math.max(0, c.alert - dt * 0.5);
    }
  }

  private updateJeff(dt: number) {
    const p = this.p;
    const L = this.L;
    // now and then Jeff pipes up over the house intercom
    this.intercomT -= dt;
    if (this.intercomT <= 0 && !this.jeff && !L.final) {
      this.intercomT = 45 + this.rng.next() * 40;
      this.emit({ type: 'intercom', text: freshLine(stageLines(JEFF_CAMEO, this.jstage), `jeff${this.jstage}`, () => this.rng.next()) });
    }
    // mid-level cameo
    if (!this.jeff && !this.cameoDone && L.cameo && Math.hypot(p.x - L.cameo.x, p.y - L.cameo.y) < T * 5.5) {
      this.cameoDone = true;
      // stand a little way off, ideally in view
      this.jeff = { x: L.cameo.x, y: L.cameo.y, mode: 'cameo', t: 0, visible: true, stun: 0, path: [], repath: 0, ang: 0, anim: 0, moving: false, shout: 0 };
      this.poofs.push({ x: L.cameo.x, y: L.cameo.y - 12, t: 0 });
      this.emit({ type: 'sfx', name: 'jeff' });
      this.say('jeff', freshLine(stageLines(JEFF_CAMEO, this.jstage), `jeff${this.jstage}`, () => this.rng.next()));
    }
    const j = this.jeff;
    if (!j) return;
    j.t += dt;
    j.moving = false;
    if (j.mode === 'cameo') {
      j.ang = Math.atan2(p.y - j.y, p.x - j.x);
      if (j.t > 2.4 && j.t - dt <= 2.4) this.say('lenny', freshLine(stageLines(LENNY_CAMEO, this.stage), `lenny${this.stage}`, () => this.rng.next()));
      if (j.t > 3.8) {
        this.poofs.push({ x: j.x, y: j.y - 12, t: 0 });
        this.emit({ type: 'sfx', name: 'poof' });
        this.jeff = null;
      }
      return;
    }
    // boss: Jeff comes for Lenny himself
    if (j.stun > 0) {
      j.stun -= dt;
      return;
    }
    j.shout -= dt;
    if (j.shout <= 0) {
      j.shout = 4 + this.rng.next() * 2;
      this.say('jeff', freshLine(JEFF_FINAL_CHASE, 'final', () => this.rng.next()));
    }
    j.repath -= dt;
    if (j.repath <= 0) {
      j.repath = 0.4;
      j.path = this.pathTo(j, p);
    }
    this.followPath(j, 92, dt);
    if (j.moving) j.anim += dt * 6;
    if (Math.hypot(p.x - j.x, p.y - j.y) < 17) this.fail('jeff');
  }

  /** Vision cone polygon for drawing, from a point. */
  cone(x: number, y: number, ang: number, range: number, fov: number, rays = 22): Pt[] {
    const pts: Pt[] = [{ x, y }];
    for (let i = 0; i <= rays; i++) {
      const a = ang - fov / 2 + (fov * i) / rays;
      const d = castRay(this.L, x, y, a, range);
      pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
    }
    return pts;
  }
  guardVision() {
    return { range: this.visionRange(), fov: (68 * Math.PI) / 180 };
  }
  cameraVision() {
    return { range: 5.2 * T * this.st.visionMul, fov: (46 * Math.PI) / 180 };
  }
}

// ------------------------------------------------------------ math helpers

export function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnToward(a: number, target: number, maxStep: number) {
  const d = angDiff(target, a);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}
export function faceOf(ang: number): Face {
  const a = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= (7 * Math.PI) / 4) return 'right';
  if (a < (3 * Math.PI) / 4) return 'down';
  if (a < (5 * Math.PI) / 4) return 'left';
  return 'up';
}
function segDist(px: number, py: number, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}
function openDirs(L: LevelData, x: number, y: number): number[] {
  const out: number[] = [];
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (castRay(L, x, y - 4, a, T * 2) >= T * 1.8) out.push(a);
  return out.length ? out : [Math.PI / 2];
}
