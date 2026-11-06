// Survival: a top-down mode. A little guy with a crossbow walks around a walled base while
// slow bears gather at the gate; a bear that has waited 30 seconds there comes in.
import { Sound } from './audio';

/** Tim's numbers. Damage and healing are shares of max health. */
export const SURVIVAL = {
  maxHp: 1_000_000,
  bearHit: .08,         // a bear hit takes 8% of max health
  bearCooldown: 5,      // seconds between one bear's hits
  heal: .012,           // the guy heals 1.2% of max health every second
  bearHp: 10.5,
  gateWait: 30,         // seconds a bear waits at the gate before it comes in
  gateWaitLater: 20,    // ...and after the first 4 bears are defeated
  rushKills: 4,         // bears to defeat before the gate wait drops and the mine and machine appear
  bearThrow: .09,       // a bear inside throws a rock that takes 9% of max health
  throwCooldown: 5,
  throwSpeed: 170,
  mineEvery: 4,         // mining gives a stone every 4 seconds
  batchTime: 4,         // the machine turns each stone into stone ammo in 4 seconds
  batchAmmo: 5,         // stone ammo per stone
  stoneDamage: 1.7,     // stone ammo does 1.7x normal ammo damage
  targetRange: 300,     // space bar only fires if a bear is this close (world units)
  boltRange: 420,
  boltSpeed: 520,
  guySpeed: 120,
  bearSpeed: 20,        // slow
  bearSpeedInside: 26,
};

export type AmmoId = 'normal' | 'quick' | 'heavy';
export const AMMO: Record<AmmoId, { name: string; reload: number; damage: number; color: string; desc: string }> = {
  normal: { name: 'Normal', reload: 3, damage: 3.5, color: '#e8d9b8', desc: '3 s reload, 3.5 damage' },
  quick: { name: 'Quick', reload: 1.5, damage: 2.1, color: '#9fe6ff', desc: '1.5 s reload, 2.1 damage' },
  heavy: { name: 'Heavy', reload: 5, damage: 5.25, color: '#ff9a6a', desc: '5 s reload, 5.25 damage' },
};
export type HatId = 'none' | 'cap' | 'helmet' | 'crown';
export const HATS: Record<HatId, string> = { none: 'No hat', cap: 'Cap', helmet: 'Helmet', crown: 'Crown' };
export const COLORS = ['#3f7fd6', '#d64545', '#3ea860', '#e0a32e', '#8e5bd6', '#e06aa8', '#30b8b0', '#f2f2f2'];
export interface Loadout { name: string; color: string; hat: HatId; ammo: AmmoId; }
export interface SurvivalResult { time: number; kills: number; shots: number; hits: number; damage: number; }

// world layout (world units; the whole map is scaled to fit the screen)
const W = 600, H = 920;
const WALL = { x0: 110, x1: 490, y0: 400, y1: 860, t: 14 };
const GATE = { x: 300, w: 74 };
const GUY_R = 13, BEAR_R = 18, STONE = '#a9a59c';
const MINE = { x: WALL.x0 + 62, y: WALL.y0 + 95, r: 24 }, MACHINE = { x: WALL.x1 - 62, y: WALL.y0 + 215, r: 26 }, NEAR = 58;

type BearState = 'walk' | 'wait' | 'enter' | 'inside' | 'dead';
interface Bear { tc: number; id: number; x: number; y: number; hp: number; state: BearState; wait: number; tx: number; ty: number; cd: number; face: number; swipe: number; hurt: number; dead: number; step: number; }
interface Bolt { stone: boolean; x: number; y: number; vx: number; vy: number; left: number; dmg: number; target: Bear | null; }
interface Rock { x: number; y: number; vx: number; vy: number; left: number; spin: number; }
interface Bubble { x: number; y: number; text: string; t: number; kind: 'loss' | 'dmg' | 'info'; }

export interface SurvivalHooks { over(r: SurvivalResult): void; pause(): void; }

export class Survival {
  running = false;
  paused = false;
  private ctx: CanvasRenderingContext2D;
  private load!: Loadout;
  private hp = SURVIVAL.maxHp;
  private x = 300; private y = 640; private face = -Math.PI / 2;
  private reload = 0;
  private bears: Bear[] = [];
  private bolts: Bolt[] = [];
  private bubbles: Bubble[] = [];
  private t = 0; private healT = 0; private spawnT = 0; private nextId = 1; private kills = 0;
  private shots = 0; private hits = 0; private damage = 0;
  private gateOpen = 0; private hurtFlash = 0; private walk = 0;
  private keys = new Set<string>();
  private stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private scale = 1; private ox = 0; private oy = 0; private cw = 0;
  private decor: { x: number; y: number; r: number; k: number }[] = [];
  private noTargetT = 0;
  private rocks: Rock[] = [];
  private gateWait = SURVIVAL.gateWait;
  private mineOn = false; private mining = false; private mineT = 0; private swing = 0;
  private popT = 0; private stones = 0; private queue = 0; private batchT = 0; private stoneAmmo = 0; private useStone = false;

  constructor(private canvas: HTMLCanvasElement, private pad: HTMLElement, private hooks: SurvivalHooks) {
    this.ctx = canvas.getContext('2d')!;
    // fixed scenery: trees and bushes outside the walls, tufts inside
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H;
      const inBase = x > WALL.x0 - 30 && x < WALL.x1 + 30 && y > WALL.y0 - 40 && y < WALL.y1 + 30;
      const nearGate = Math.abs(x - GATE.x) < 190 && y > 170 && y < WALL.y0;
      if (inBase) { if (x > WALL.x0 + 30 && x < WALL.x1 - 30 && y > WALL.y0 + 30 && y < WALL.y1 - 30) this.decor.push({ x, y, r: 3 + rnd() * 3, k: 2 }); continue; }
      if (nearGate) continue;
      this.decor.push({ x, y, r: 10 + rnd() * 14, k: rnd() < .55 ? 0 : 1 });
    }
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    const up = (e: PointerEvent) => { if (this.stick && this.stick.id === e.pointerId) this.stick = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    const btn = (id: string, f: () => void) => pad.querySelector<HTMLElement>(id)!.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (this.running && !this.paused) f(); });
    btn('#svTarget', () => this.shoot(true));
    btn('#svFree', () => this.shoot(false));
    btn('#svPause', () => this.hooks.pause());
    btn('#svMine', () => this.action());
    btn('#svAmmoBtn', () => this.switchAmmo());
    addEventListener('keydown', e => {
      if (!this.running || this.paused) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.shoot(true); return; }
      if (k === 'z') { if (!e.repeat) this.shoot(false); return; }
      if (k === 'p' || k === 'Escape') { this.hooks.pause(); return; }
      if (k === 'm') { if (!e.repeat) this.action(); return; }
      if (k === 's') { if (!e.repeat) this.switchAmmo(); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); this.keys.add(k); }
    });
    addEventListener('keyup', e => this.keys.delete(e.key));
    addEventListener('blur', () => this.keys.clear());
  }

  start(load: Loadout) {
    this.load = load;
    this.hp = SURVIVAL.maxHp; this.x = 300; this.y = 660; this.face = -Math.PI / 2; this.reload = 0;
    this.bears = []; this.bolts = []; this.bubbles = [];
    this.t = 0; this.healT = 0; this.spawnT = 2; this.kills = 0; this.shots = 0; this.hits = 0; this.damage = 0;
    this.gateOpen = 0; this.hurtFlash = 0; this.keys.clear(); this.stick = null;
    this.rocks = []; this.gateWait = SURVIVAL.gateWait;
    this.mineOn = false; this.mining = false; this.mineT = 0; this.swing = 0; this.popT = 0;
    this.stones = 0; this.queue = 0; this.batchT = 0; this.stoneAmmo = 0; this.useStone = false;
    this.running = true; this.paused = false;
    this.canvas.hidden = false; this.pad.hidden = false;
    this.say('Bears are coming. Shoot them before they get in!');
  }
  stop() { this.running = false; this.paused = false; this.canvas.hidden = true; this.pad.hidden = true; this.keys.clear(); this.stick = null; }

  /* ---------- input ---------- */
  private down(e: PointerEvent) {
    e.preventDefault();
    if (!this.running || this.paused) return;
    // a tap on the machine uses it
    if (this.mineOn) {
      const wx = (e.offsetX - this.ox) / this.scale, wy = (e.offsetY - this.oy) / this.scale;
      if (Math.hypot(wx - MACHINE.x, wy - MACHINE.y) < MACHINE.r + 10) { this.useMachine(); return; }
    }
    // anywhere on the map works as a joystick: drag from where the finger lands
    this.stick = { id: e.pointerId, ox: e.offsetX, oy: e.offsetY, dx: 0, dy: 0 };
  }
  private move(e: PointerEvent) {
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    s.dx = e.offsetX - s.ox; s.dy = e.offsetY - s.oy;
    const m = Math.hypot(s.dx, s.dy), max = 46;
    if (m > max) { s.ox += s.dx * (1 - max / m); s.oy += s.dy * (1 - max / m); s.dx *= max / m; s.dy *= max / m; }
  }

  /** Space shoots at the nearest bear in range; Z shoots straight ahead with no target. */
  private shoot(targeted: boolean) {
    if (this.reload > 0) { Sound.click(); return; }
    let target: Bear | null = null;
    if (targeted) {
      let best = SURVIVAL.targetRange;
      for (const b of this.bears) {
        if (b.state === 'dead') continue;
        const d = Math.hypot(b.x - this.x, b.y - this.y);
        if (d < best) { best = d; target = b; }
      }
      if (!target) {
        if (this.noTargetT <= 0) { this.bubble(this.x, this.y - 30, 'No bear in range', 'info'); this.noTargetT = 1.2; }
        Sound.denied();
        return;
      }
      this.face = Math.atan2(target.y - this.y, target.x - this.x);
    }
    const a = this.face, ammo = AMMO[this.load.ammo];
    // stone ammo: 1.7x normal damage, and each shot uses one up
    const stone = this.useStone && this.stoneAmmo > 0;
    const dmg = stone ? AMMO.normal.damage * SURVIVAL.stoneDamage : ammo.damage;
    if (stone) { this.stoneAmmo--; if (!this.stoneAmmo) { this.useStone = false; this.bubble(this.x, this.y - 30, 'Out of stone ammo', 'info'); } }
    this.mining = false;
    this.bolts.push({ x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: SURVIVAL.boltRange, dmg, target, stone });
    this.reload = ammo.reload;
    this.shots++;
    Sound.tone('triangle', 900, 260, .12, .14); Sound.noise(.08, 'highpass', 2400, .8, .1);
  }

  /** M: start or stop mining when next to the mine, or use the machine when next to it. */
  private action() {
    if (!this.mineOn) return;
    if (dist(this.x, this.y, MINE.x, MINE.y) < NEAR) {
      this.mining = !this.mining; this.mineT = 0;
      if (this.mining) this.face = Math.atan2(MINE.y - this.y, MINE.x - this.x);
      Sound.ui();
    } else if (dist(this.x, this.y, MACHINE.x, MACHINE.y) < NEAR) this.useMachine();
    else this.bubble(this.x, this.y - 30, 'Walk to the mine or the machine', 'info');
  }
  /** The machine takes all your stone; each stone is a batch that gives 5 stone ammo after 4 seconds. */
  private useMachine() {
    if (dist(this.x, this.y, MACHINE.x, MACHINE.y) > NEAR) { this.bubble(MACHINE.x, MACHINE.y - 36, 'Walk to the machine', 'info'); Sound.denied(); return; }
    if (!this.stones) { this.bubble(MACHINE.x, MACHINE.y - 36, 'No stone to put in', 'info'); Sound.denied(); return; }
    this.bubble(MACHINE.x, MACHINE.y - 36, `${this.stones} stone in`, 'info');
    this.queue += this.stones; this.stones = 0;
    Sound.thump();
  }
  /** S: switch between your loadout ammo and stone ammo. */
  private switchAmmo() {
    if (!this.useStone && !this.stoneAmmo) { this.bubble(this.x, this.y - 30, 'No stone ammo yet', 'info'); Sound.denied(); return; }
    this.useStone = !this.useStone;
    this.bubble(this.x, this.y - 30, this.useStone ? 'Stone ammo' : `${AMMO[this.load.ammo].name} ammo`, 'info');
    Sound.click();
  }

  /* ---------- rules ---------- */
  update(dt: number) {
    if (!this.running || this.paused) return;
    this.t += dt;
    this.reload = Math.max(0, this.reload - dt);
    this.noTargetT -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // walking: arrow keys or the drag stick
    let mx = 0, my = 0;
    if (this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('ArrowDown')) my += 1;
    if (this.stick) { const m = Math.hypot(this.stick.dx, this.stick.dy); if (m > 6) { mx = this.stick.dx / 46; my = this.stick.dy / 46; } }
    const m = Math.hypot(mx, my);
    if (m > 0) {
      if (m > 1) { mx /= m; my /= m; }
      this.x += mx * SURVIVAL.guySpeed * dt; this.y += my * SURVIVAL.guySpeed * dt;
      this.face = Math.atan2(my, mx);
      this.walk += dt * 10 * Math.min(1, m);
    }
    // the guy stays inside the walls
    this.x = clamp(this.x, WALL.x0 + WALL.t + GUY_R, WALL.x1 - WALL.t - GUY_R);
    this.y = clamp(this.y, WALL.y0 + WALL.t + GUY_R, WALL.y1 - WALL.t - GUY_R);

    // healing: 1.2% of max health every second
    this.healT += dt;
    while (this.healT >= 1) { this.healT -= 1; this.hp = Math.min(SURVIVAL.maxHp, this.hp + SURVIVAL.maxHp * SURVIVAL.heal); }

    // mining: a stone every 4 seconds while next to the mine
    this.swing = Math.max(0, this.swing - dt);
    if (this.mineOn) this.popT += dt;
    if (this.mining) {
      if (m > 0 || dist(this.x, this.y, MINE.x, MINE.y) > NEAR) this.mining = false;
      else {
        this.face = Math.atan2(MINE.y - this.y, MINE.x - this.x);
        if (this.swing <= 0) { this.swing = 1; Sound.click(); }
        this.mineT += dt;
        if (this.mineT >= SURVIVAL.mineEvery) { this.mineT -= SURVIVAL.mineEvery; this.stones++; this.bubble(MINE.x, MINE.y - 30, '+1 stone', 'info'); Sound.thump(); }
      }
    }
    if (this.queue > 0) {
      this.batchT += dt;
      if (this.batchT >= SURVIVAL.batchTime) {
        this.batchT -= SURVIVAL.batchTime; this.queue--; this.stoneAmmo += SURVIVAL.batchAmmo;
        this.bubble(MACHINE.x, MACHINE.y - 36, `+${SURVIVAL.batchAmmo} stone ammo`, 'info'); Sound.pop();
      }
    } else this.batchT = 0;

    // more bears as time goes on
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnBear();
      if (this.t > 150 && Math.random() < .3) this.spawnBear();
      this.spawnT = Math.max(3.5, 10 - this.t / 35);
    }

    let entering = false;
    for (const b of this.bears) {
      if (b.state === 'dead') { b.dead += dt; continue; }
      b.hurt = Math.max(0, b.hurt - dt); b.swipe = Math.max(0, b.swipe - dt);
      if (b.state === 'walk') {
        if (this.stepTo(b, b.tx, b.ty, SURVIVAL.bearSpeed, dt)) b.state = 'wait';
      } else if (b.state === 'wait') {
        b.wait += dt;
        b.face = approachAngle(b.face, Math.atan2(WALL.y0 - b.y, GATE.x - b.x), dt * 2);
        if (b.wait >= this.gateWait) b.state = 'enter';
      } else if (b.state === 'enter') {
        entering = true;
        // line up at the gate, then walk through it
        if (b.y < WALL.y0 - BEAR_R - 2) {
          const x = clamp(b.x, GATE.x - 12, GATE.x + 12);
          if (Math.abs(b.x - x) > 1) this.stepTo(b, x, b.y + 4, SURVIVAL.bearSpeedInside, dt);
          else this.stepTo(b, GATE.x, WALL.y0 + 50, SURVIVAL.bearSpeedInside, dt);
        } else if (this.stepTo(b, GATE.x, WALL.y0 + WALL.t + BEAR_R + 8, SURVIVAL.bearSpeedInside, dt)) {
          b.state = 'inside'; b.cd = .8; b.tc = 2;
          this.say('A bear got in!');
          Sound.tone('sawtooth', 160, 90, .5, .12);
        }
      } else {
        // inside: go for the guy and swipe every 5 seconds
        b.cd = Math.max(0, b.cd - dt);
        const d = Math.hypot(this.x - b.x, this.y - b.y), reach = GUY_R + BEAR_R + 6;
        if (d > reach - 2) this.stepTo(b, this.x, this.y, SURVIVAL.bearSpeedInside, dt, reach - 2);
        else b.face = approachAngle(b.face, Math.atan2(this.y - b.y, this.x - b.x), dt * 6);
        if (d <= reach && b.cd <= 0) this.bearHit(b);
        // from further off it throws a rock, every 5 seconds
        b.tc = Math.max(0, b.tc - dt);
        if (d > reach + 20 && b.tc <= 0) this.throwRock(b);
      }
    }
    this.gateOpen = clamp(this.gateOpen + (entering ? dt : -dt) * 1.5, 0, 1);
    this.separate(dt);

    // bolts
    for (const bo of this.bolts) {
      if (bo.target && bo.target.state !== 'dead') {
        // a targeted bolt curves onto its bear
        const a = Math.atan2(bo.target.y - bo.y, bo.target.x - bo.x), s = SURVIVAL.boltSpeed;
        const cur = Math.atan2(bo.vy, bo.vx), na = approachAngle(cur, a, dt * 9);
        bo.vx = Math.cos(na) * s; bo.vy = Math.sin(na) * s;
      }
      bo.x += bo.vx * dt; bo.y += bo.vy * dt; bo.left -= SURVIVAL.boltSpeed * dt;
      for (const b of this.bears) {
        if (b.state === 'dead') continue;
        if (Math.hypot(b.x - bo.x, b.y - bo.y) < BEAR_R + 4) { this.boltHit(b, bo); bo.left = 0; break; }
      }
    }
    this.bolts = this.bolts.filter(b => b.left > 0);
    for (const r of this.rocks) {
      r.x += r.vx * dt; r.y += r.vy * dt; r.left -= SURVIVAL.throwSpeed * dt; r.spin += dt * 9;
      if (dist(r.x, r.y, this.x, this.y) < GUY_R + 5) { r.left = 0; this.hurt(SURVIVAL.bearThrow); }
    }
    this.rocks = this.rocks.filter(r => r.left > 0);
    this.bears = this.bears.filter(b => b.state !== 'dead' || b.dead < 1.2);
    for (const u of this.bubbles) u.t += dt;
    this.bubbles = this.bubbles.filter(u => u.t < (u.kind === 'loss' ? 1.6 : 1.1));

    if (this.hp <= 0) {
      this.hp = 0; this.running = false;
      Sound.boom(false);
      this.mining = false;
      this.hooks.over({ time: this.t, kills: this.kills, shots: this.shots, hits: this.hits, damage: this.damage });
    }
  }

  private spawnBear() {
    // bears come from the woods north of the base and make for a spot outside the gate
    const side = Math.random();
    let x: number, y: number;
    if (side < .5) { x = 30 + Math.random() * (W - 60); y = -BEAR_R - 10; }
    else if (side < .75) { x = -BEAR_R - 10; y = 30 + Math.random() * 300; }
    else { x = W + BEAR_R + 10; y = 30 + Math.random() * 300; }
    const waiting = this.bears.filter(b => b.state === 'walk' || b.state === 'wait').length;
    const ring = 70 + Math.min(4, Math.floor(waiting / 5)) * 42;
    const a = Math.PI + .25 + Math.random() * (Math.PI - .5);
    const tx = clamp(GATE.x + Math.cos(a) * ring * 1.4, 40, W - 40), ty = clamp(WALL.y0 - 10 + Math.sin(a) * ring, 40, WALL.y0 - BEAR_R - 10);
    this.bears.push({ tc: 0, id: this.nextId++, x, y, hp: SURVIVAL.bearHp, state: 'walk', wait: 0, tx, ty, cd: 0, face: Math.atan2(ty - y, tx - x), swipe: 0, hurt: 0, dead: 0, step: Math.random() * 6 });
  }

  /** Moves a bear toward a point; returns true once it is there. */
  private stepTo(b: Bear, tx: number, ty: number, speed: number, dt: number, stopAt = 2) {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d <= stopAt) return true;
    const s = Math.min(d - stopAt + .01, speed * dt);
    b.x += dx / d * s; b.y += dy / d * s;
    b.face = approachAngle(b.face, Math.atan2(dy, dx), dt * 4);
    b.step += dt * 6;
    return false;
  }

  /** Bears don't stand on each other, and only cross the wall at the gate. */
  private separate(dt: number) {
    const live = this.bears.filter(b => b.state !== 'dead');
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, min = BEAR_R * 2;
      if (d < min) {
        const push = Math.min(min - d, 40 * dt) / 2;
        // a bear going through the gate holds its line
        const wa = a.state === 'enter' ? 0 : 1, wb = b.state === 'enter' ? 0 : 1;
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * wb; b.y += dy / d * push * wb;
      }
    }
    for (const b of live) {
      if (b.state === 'inside') {
        b.x = clamp(b.x, WALL.x0 + WALL.t + BEAR_R, WALL.x1 - WALL.t - BEAR_R);
        b.y = clamp(b.y, WALL.y0 + WALL.t + BEAR_R, WALL.y1 - WALL.t - BEAR_R);
      } else if (b.state === 'wait' || b.state === 'walk') {
        // outside: keep out of the walls
        if (b.x > WALL.x0 - BEAR_R && b.x < WALL.x1 + BEAR_R && b.y > WALL.y0 - BEAR_R) b.y = WALL.y0 - BEAR_R;
      }
    }
  }

  private throwRock(b: Bear) {
    b.tc = SURVIVAL.throwCooldown; b.swipe = .25;
    const a = Math.atan2(this.y - b.y, this.x - b.x);
    b.face = a;
    this.rocks.push({ x: b.x + Math.cos(a) * 24, y: b.y + Math.sin(a) * 24, vx: Math.cos(a) * SURVIVAL.throwSpeed, vy: Math.sin(a) * SURVIVAL.throwSpeed, left: 520, spin: 0 });
    Sound.tone('sine', 300, 160, .15, .1);
  }

  private bearHit(b: Bear) {
    b.cd = SURVIVAL.bearCooldown; b.swipe = .35;
    this.hurt(SURVIVAL.bearHit);
  }

  private hurt(share: number) {
    const dmg = SURVIVAL.maxHp * share;
    this.hp -= dmg;
    this.hurtFlash = .4;
    this.bubble(this.x + (Math.random() - .5) * 16, this.y - 24, '-' + fmt(dmg), 'loss');
    Sound.noise(.25, 'lowpass', 700, .8, .4); Sound.tone('sine', 120, 50, .25, .3);
    if (navigator.vibrate) try { navigator.vibrate(60); } catch { }
  }

  private boltHit(b: Bear, bo: Bolt) {
    b.hp -= bo.dmg; b.hurt = .25;
    this.hits++; this.damage += Math.min(bo.dmg, b.hp + bo.dmg);
    this.bubble(b.x, b.y - 26, '-' + trim(bo.dmg), 'dmg');
    Sound.hitPlane();
    if (b.hp <= 1e-6) {
      b.state = 'dead'; b.dead = 0; this.kills++;
      if (this.kills === SURVIVAL.rushKills) {
        // the bears get impatient, and a mine and a machine pop up in the camp
        this.gateWait = SURVIVAL.gateWaitLater;
        this.say('Bears in base in 20 seconds', 4);
        this.mineOn = true;
        Sound.alarm();
      }
      Sound.tone('sine', 200, 70, .4, .18);
    }
  }

  private bubble(x: number, y: number, text: string, kind: Bubble['kind']) { this.bubbles.push({ x, y, text, t: 0, kind }); }
  private sayT = 0; private sayText = '';
  private say(text: string, secs = 3) { this.sayText = text; this.sayT = secs; }

  /* ---------- drawing ---------- */
  draw(dt: number) {
    const c = this.canvas, cw = c.clientWidth, ch = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    this.cw = cw;
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the map sits between the health bar (top) and the buttons (bottom)
    const top = this.mineOn ? 82 : 64, bottom = 96;
    this.scale = Math.min(cw / W, (ch - top - bottom) / H);
    this.ox = (cw - W * this.scale) / 2; this.oy = top + (ch - top - bottom - H * this.scale) / 2;
    g.fillStyle = '#2f4426'; g.fillRect(0, 0, cw, ch);
    g.save();
    g.translate(this.ox, this.oy); g.scale(this.scale, this.scale);
    this.drawWorld(g);
    g.restore();
    this.drawHud(g, dt);
  }

  private drawWorld(g: CanvasRenderingContext2D) {
    // ground
    g.fillStyle = '#4b6b37'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(30,50,20,.25)';
    for (const d of this.decor) if (d.k === 0) { g.beginPath(); g.arc(d.x + 6, d.y + 8, d.r * 1.1, 0, 7); g.fill(); }
    // a worn path to the gate
    g.fillStyle = '#6f6a45';
    g.beginPath(); g.moveTo(GATE.x - 30, WALL.y0); g.quadraticCurveTo(GATE.x - 10, 220, GATE.x - 50, 0); g.lineTo(GATE.x + 40, 0); g.quadraticCurveTo(GATE.x + 20, 220, GATE.x + 30, WALL.y0); g.fill();
    // inside the base: packed earth, with the wall's shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(WALL.x0 + 4, WALL.y0 + 6, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.fillStyle = '#8b7651'; g.fillRect(WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.fillStyle = 'rgba(60,45,25,.18)';
    for (const d of this.decor) if (d.k === 2) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill(); }
    // a campfire and a tent so it reads as a camp
    this.drawCamp(g);
    // scenery outside
    for (const d of this.decor) {
      if (d.k === 0) { // tree
        g.fillStyle = '#2d4a22'; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill();
        g.fillStyle = '#3c5f2c'; g.beginPath(); g.arc(d.x - d.r * .25, d.y - d.r * .25, d.r * .65, 0, 7); g.fill();
      } else if (d.k === 1) { // bush
        g.fillStyle = '#3f6230'; g.beginPath(); g.arc(d.x, d.y, d.r * .55, 0, 7); g.fill();
      }
    }
    if (this.mineOn) this.drawMineAndMachine(g);
    this.drawWalls(g);
    // dead bears fade, then the rest on top
    for (const b of this.bears) if (b.state === 'dead') this.drawBear(g, b);
    for (const b of this.bears) if (b.state !== 'dead') this.drawBear(g, b);
    this.drawGuy(g);
    for (const bo of this.bolts) {
      const a = Math.atan2(bo.vy, bo.vx);
      g.save(); g.translate(bo.x, bo.y); g.rotate(a);
      g.strokeStyle = '#5a3d22'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = bo.stone ? STONE : AMMO[this.load.ammo].color; g.beginPath(); g.moveTo(10, 0); g.lineTo(4, -3.5); g.lineTo(4, 3.5); g.fill();
      g.fillStyle = '#f0e6d0'; g.fillRect(-15, -3, 4, 6);
      g.restore();
    }
    // rocks thrown by bears
    for (const r of this.rocks) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(r.x + 3, r.y + 4, 6, 0, 7); g.fill();
      g.save(); g.translate(r.x, r.y); g.rotate(r.spin);
      g.fillStyle = '#8d8a84'; g.beginPath(); g.moveTo(-6, -3); g.lineTo(-1, -7); g.lineTo(6, -4); g.lineTo(7, 3); g.lineTo(1, 7); g.lineTo(-6, 4); g.closePath(); g.fill();
      g.fillStyle = '#b5b1a8'; g.beginPath(); g.arc(-1, -2, 2.5, 0, 7); g.fill();
      g.restore();
    }
    // targeting range when a bear is close: a faint ring
    g.strokeStyle = 'rgba(255,245,234,.10)'; g.lineWidth = 1.5; g.setLineDash([6, 8]);
    g.beginPath(); g.arc(this.x, this.y, SURVIVAL.targetRange, 0, 7); g.stroke(); g.setLineDash([]);
  }

  private drawMineAndMachine(g: CanvasRenderingContext2D) {
    const pop = Math.min(1, this.popT * 2);
    // the mine: a heap of grey rock
    g.save(); g.translate(MINE.x, MINE.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(4, 6, 28, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#6f6c66'; g.beginPath(); g.moveTo(-26, 10); g.lineTo(-18, -12); g.lineTo(-4, -22); g.lineTo(14, -16); g.lineTo(26, 2); g.lineTo(18, 16); g.lineTo(-12, 18); g.closePath(); g.fill();
    g.fillStyle = '#8f8b84'; g.beginPath(); g.moveTo(-14, -8); g.lineTo(-3, -17); g.lineTo(10, -12); g.lineTo(4, 0); g.lineTo(-10, 2); g.closePath(); g.fill();
    g.fillStyle = '#c7c2b8'; g.beginPath(); g.arc(12, 6, 3, 0, 7); g.arc(-8, 10, 2.5, 0, 7); g.fill();
    if (this.mining && this.swing > .7) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * 1.6 + this.t * 3; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); g.stroke(); } }
    g.restore();
    // the machine: a metal box with a hopper, a light while it works and a progress bar
    g.save(); g.translate(MACHINE.x, MACHINE.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-22, -18, 50, 44);
    g.fillStyle = '#5b6670'; g.fillRect(-26, -22, 52, 44);
    g.fillStyle = '#7d8a95'; g.fillRect(-20, -16, 24, 18);
    g.fillStyle = '#3a4249'; g.beginPath(); g.moveTo(8, -18); g.lineTo(22, -18); g.lineTo(18, -6); g.lineTo(12, -6); g.closePath(); g.fill();
    g.fillStyle = this.queue ? (Math.sin(this.t * 10) > 0 ? '#ffcf4a' : '#a07a20') : '#3c4a3c'; g.beginPath(); g.arc(16, 10, 4, 0, 7); g.fill();
    if (this.queue) { g.fillStyle = '#222'; g.fillRect(-20, 8, 26, 6); g.fillStyle = '#9fe0b0'; g.fillRect(-20, 8, 26 * this.batchT / SURVIVAL.batchTime, 6); }
    g.restore();
    // labels
    g.fillStyle = '#fff5ea'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText('Mine', MINE.x, MINE.y + 34);
    g.fillText(this.queue ? `Machine (${this.queue} left)` : 'Machine', MACHINE.x, MACHINE.y + 38);
    // mining progress ring
    if (this.mining) {
      g.strokeStyle = '#c7c2b8'; g.lineWidth = 3;
      g.beginPath(); g.arc(MINE.x, MINE.y, MINE.r + 8, -Math.PI / 2, -Math.PI / 2 + this.mineT / SURVIVAL.mineEvery * Math.PI * 2); g.stroke();
    }
  }

  private drawCamp(g: CanvasRenderingContext2D) {
    // tent
    const tx = WALL.x0 + 70, ty = WALL.y1 - 90;
    g.fillStyle = '#b88a4a'; g.beginPath(); g.moveTo(tx - 38, ty + 30); g.lineTo(tx, ty - 30); g.lineTo(tx + 38, ty + 30); g.closePath(); g.fill();
    g.fillStyle = '#8f6633'; g.beginPath(); g.moveTo(tx, ty - 30); g.lineTo(tx + 38, ty + 30); g.lineTo(tx, ty + 30); g.closePath(); g.fill();
    // fire pit
    const fx = GATE.x + 70, fy = WALL.y1 - 130, f = .8 + Math.sin(this.t * 13) * .15;
    g.fillStyle = '#5d5148'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.arc(fx + Math.cos(a) * 15, fy + Math.sin(a) * 15, 4.5, 0, 7); g.fill(); }
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.arc(fx, fy, 9 * f, 0, 7); g.fill();
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(fx, fy, 4.5 * f, 0, 7); g.fill();
    // crates
    g.fillStyle = '#9a6a3a'; g.fillRect(WALL.x1 - 70, WALL.y0 + 40, 34, 34); g.fillRect(WALL.x1 - 50, WALL.y0 + 80, 30, 30);
    g.strokeStyle = '#6a4626'; g.lineWidth = 2; g.strokeRect(WALL.x1 - 70, WALL.y0 + 40, 34, 34); g.strokeRect(WALL.x1 - 50, WALL.y0 + 80, 30, 30);
  }

  private drawWalls(g: CanvasRenderingContext2D) {
    const { x0, x1, y0, y1, t } = WALL, gl = GATE.x - GATE.w / 2, gr = GATE.x + GATE.w / 2;
    const logs = (ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 13));
      for (let i = 0; i < n; i++) {
        const k = (i + .5) / n, x = ax + (bx - ax) * k, y = ay + (by - ay) * k;
        g.fillStyle = i % 2 ? '#6d4a2a' : '#7c5631'; g.beginPath(); g.arc(x, y, t * .55, 0, 7); g.fill();
        g.fillStyle = '#a07a4c'; g.beginPath(); g.arc(x - 1, y - 1, t * .28, 0, 7); g.fill();
      }
    };
    logs(x0 + t / 2, y0 + t / 2, gl, y0 + t / 2);
    logs(gr, y0 + t / 2, x1 - t / 2, y0 + t / 2);
    logs(x1 - t / 2, y0 + t / 2, x1 - t / 2, y1 - t / 2);
    logs(x1 - t / 2, y1 - t / 2, x0 + t / 2, y1 - t / 2);
    logs(x0 + t / 2, y1 - t / 2, x0 + t / 2, y0 + t / 2);
    // gate posts and the two doors, which swing in while a bear comes through
    const open = easeInOut(this.gateOpen) * 1.35;
    for (const [px, dir] of [[gl, 1], [gr, -1]] as const) {
      g.save(); g.translate(px, y0 + t / 2); g.rotate(dir * open);
      g.fillStyle = '#5e3f22'; g.fillRect(dir > 0 ? 0 : -GATE.w / 2, -4, GATE.w / 2, 8);
      g.fillStyle = '#3e2a16'; g.fillRect(dir > 0 ? GATE.w / 2 - 5 : -GATE.w / 2, -4, 5, 8);
      g.restore();
      g.fillStyle = '#4a3219'; g.beginPath(); g.arc(px, y0 + t / 2, 9, 0, 7); g.fill();
    }
  }

  private drawBear(g: CanvasRenderingContext2D, b: Bear) {
    g.save(); g.translate(b.x, b.y);
    if (b.state === 'dead') g.globalAlpha = Math.max(0, 1 - b.dead / 1.2);
    // shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(3, 5, BEAR_R * 1.1, BEAR_R * .9, 0, 0, 7); g.fill();
    g.rotate(b.face);
    const fur = b.hurt > 0 ? '#c9875a' : '#6b4a2e', dark = '#4f3520';
    // paws, stepping
    const st = Math.sin(b.step) * 4;
    g.fillStyle = dark;
    for (const [px, py, s] of [[8, -13, st], [8, 13, -st], [-9, -13, -st], [-9, 13, st]]) { g.beginPath(); g.arc(px + s, py, 5.5, 0, 7); g.fill(); }
    if (b.state === 'dead') { g.rotate(.6); }
    g.fillStyle = fur; g.beginPath(); g.ellipse(-2, 0, BEAR_R * 1.05, BEAR_R * .85, 0, 0, 7); g.fill();
    // head with ears and a snout
    g.fillStyle = fur; g.beginPath(); g.arc(15, 0, 10, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(11, -9, 4, 0, 7); g.arc(11, 9, 4, 0, 7); g.fill();
    g.fillStyle = '#b08a62'; g.beginPath(); g.ellipse(23, 0, 5, 4.2, 0, 0, 7); g.fill();
    g.fillStyle = '#1e140c'; g.beginPath(); g.arc(27, 0, 2, 0, 7); g.fill();
    g.beginPath(); g.arc(17, -4.5, 1.5, 0, 7); g.arc(17, 4.5, 1.5, 0, 7); g.fill();
    // a swipe: claw marks in front
    if (b.swipe > 0) {
      g.strokeStyle = `rgba(255,255,255,${b.swipe / .35})`; g.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(26, i * 6, 10, -.6, .6); g.stroke(); }
    }
    g.restore();
    if (b.state === 'dead') return;
    // waiting at the gate: a ring that fills over 30 seconds, and the seconds left
    if (b.state === 'wait') {
      const k = b.wait / this.gateWait;
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, BEAR_R + 7, 0, 7); g.stroke();
      g.strokeStyle = k > .8 ? '#ff6a5a' : '#ffcf8c'; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, BEAR_R + 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      g.fillStyle = '#fff5ea'; g.font = '600 13px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(String(Math.ceil(this.gateWait - b.wait)), b.x, b.y - BEAR_R - 12);
    }
    // health bar once hurt
    if (b.hp < SURVIVAL.bearHp) {
      const w = 34, k = Math.max(0, b.hp / SURVIVAL.bearHp), y = b.y + BEAR_R + 8;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(b.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle = '#ff6a5a'; g.fillRect(b.x - w / 2, y, w * k, 4);
    }
  }

  private drawGuy(g: CanvasRenderingContext2D) {
    const L = this.load, a = this.face, bob = Math.sin(this.walk) * 2;
    g.save(); g.translate(this.x, this.y);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(2, 4, GUY_R + 2, GUY_R, 0, 0, 7); g.fill();
    if (this.hurtFlash > 0) { g.fillStyle = `rgba(255,60,50,${this.hurtFlash})`; g.beginPath(); g.arc(0, 0, GUY_R + 10, 0, 7); g.fill(); }
    paintGuy(g, L, a + (this.mining ? Math.sin(this.swing * Math.PI) * .5 : 0), bob, this.reload > 0 ? 0 : 1, this.useStone ? STONE : undefined);
    g.restore();
    // reload ring around the guy
    if (this.reload > 0) {
      const k = 1 - this.reload / AMMO[L.ammo].reload;
      g.strokeStyle = 'rgba(255,245,234,.75)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(this.x, this.y, GUY_R + 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
    }
  }

  private drawHud(g: CanvasRenderingContext2D, dt: number) {
    const cw = this.cw, s = this.scale;
    // the guy's name over his head
    g.font = '500 12px Jost, sans-serif'; g.textAlign = 'center';
    const nx = this.ox + this.x * s, ny = this.oy + (this.y - GUY_R - 14) * s - 4;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(this.load.name, nx + 1, ny + 1);
    g.fillStyle = '#fff5ea'; g.fillText(this.load.name, nx, ny);

    // health bar
    const x = 14, y = 12, w = cw - 28 - 46, h = 18, k = this.hp / SURVIVAL.maxHp;
    g.fillStyle = 'rgba(10,8,24,.7)'; roundRect(g, x - 2, y - 2, w + 4, h + 4, 8); g.fill();
    g.fillStyle = k > .5 ? '#5fbf86' : k > .25 ? '#e0b43a' : '#e0524a';
    roundRect(g, x, y, Math.max(0, w * k), h, 6); g.fill();
    g.fillStyle = '#fff'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText(`${fmt(Math.ceil(this.hp))} / ${fmt(SURVIVAL.maxHp)}`, x + w / 2, y + 13.5);
    g.textAlign = 'left'; g.font = '500 13px Jost, sans-serif'; g.fillStyle = '#fff5ea';
    const waiting = this.bears.filter(b => b.state === 'wait' || b.state === 'walk').length, inside = this.bears.filter(b => b.state === 'inside' || b.state === 'enter').length;
    g.fillText(`${clock(this.t)}   Bears defeated ${this.kills}`, x, y + h + 20);
    g.textAlign = 'right';
    g.fillStyle = inside ? '#ff8a7a' : '#fff5ea';
    g.fillText(inside ? `${inside} inside · ${waiting} outside` : `${waiting} outside`, cw - 14, y + h + 20);
    if (this.mineOn) {
      g.textAlign = 'left'; g.fillStyle = '#d9d4ca';
      g.fillText(`Stone ${this.stones}   Stone ammo ${this.stoneAmmo}`, x, y + h + 38);
      g.textAlign = 'right'; g.fillStyle = this.useStone ? '#fff' : '#fff5ea';
      g.fillText(`Ammo: ${this.useStone ? 'Stone' : AMMO[this.load.ammo].name}`, cw - 14, y + h + 38);
    }

    // bubbles: red for health lost, small white numbers on bears
    for (const u of this.bubbles) {
      const life = u.kind === 'loss' ? 1.6 : 1.1, p = u.t / life;
      const bx = this.ox + u.x * s, by = this.oy + u.y * s - p * 38;
      g.globalAlpha = p < .75 ? 1 : 1 - (p - .75) / .25;
      if (u.kind === 'loss') {
        g.font = '700 14px Jost, sans-serif'; const tw = g.measureText(u.text).width;
        const pop = 1 + Math.max(0, .25 - u.t) * 1.6;
        g.save(); g.translate(bx, by); g.scale(pop, pop);
        g.fillStyle = '#d8312a'; roundRect(g, -tw / 2 - 9, -13, tw + 18, 24, 12); g.fill();
        g.strokeStyle = '#ff9a90'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(u.text, 0, 4);
        g.restore();
      } else {
        g.font = u.kind === 'info' ? '500 12px Jost, sans-serif' : '700 13px Jost, sans-serif'; g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(u.text, bx + 1, by + 1);
        g.fillStyle = u.kind === 'info' ? '#fff5ea' : '#ffe9b0'; g.fillText(u.text, bx, by);
      }
      g.globalAlpha = 1;
    }

    // a short message in the middle
    if (this.sayT > 0) {
      this.sayT -= dt;
      g.globalAlpha = Math.min(1, this.sayT);
      g.font = '500 14px Jost, sans-serif'; g.textAlign = 'center';
      const tw = g.measureText(this.sayText).width, my = this.oy + 22;
      g.fillStyle = 'rgba(20,16,34,.78)'; roundRect(g, cw / 2 - tw / 2 - 12, my - 17, tw + 24, 28, 14); g.fill();
      g.fillStyle = '#fff5ea'; g.fillText(this.sayText, cw / 2, my + 2);
      g.globalAlpha = 1;
    }

    // drag stick
    if (this.stick) {
      g.strokeStyle = 'rgba(255,245,234,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(this.stick.ox, this.stick.oy, 46, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,245,234,.35)'; g.beginPath(); g.arc(this.stick.ox + this.stick.dx, this.stick.oy + this.stick.dy, 20, 0, 7); g.fill();
    }

    // reload shown on the buttons
    const r = this.reload / AMMO[this.load.ammo].reload;
    this.pad.style.setProperty('--reload', String(r));
    this.pad.classList.toggle('loading', this.reload > 0);
    const nearMine = this.mineOn && dist(this.x, this.y, MINE.x, MINE.y) < NEAR, nearMachine = this.mineOn && dist(this.x, this.y, MACHINE.x, MACHINE.y) < NEAR;
    const mb = this.pad.querySelector<HTMLElement>('#svMine')!, ab = this.pad.querySelector<HTMLElement>('#svAmmoBtn')!;
    mb.hidden = !nearMine && !nearMachine;
    const label = nearMine ? (this.mining ? 'Stop' : 'Mine') : 'Machine';
    if (mb.firstElementChild!.textContent !== label) mb.firstElementChild!.textContent = label;
    ab.hidden = !this.stoneAmmo && !this.useStone;
    const al = this.useStone ? 'Stone' : AMMO[this.load.ammo].name;
    if (ab.firstElementChild!.textContent !== al) ab.firstElementChild!.textContent = al;
  }
}

/** The little guy, centred on the origin, facing angle a. */
function paintGuy(g: CanvasRenderingContext2D, L: Loadout, a: number, bob: number, pull: number, boltColor = AMMO[L.ammo].color) {
  g.rotate(a);
  // feet
  g.fillStyle = '#3a2c20'; g.beginPath(); g.arc(3 + bob, -6, 3.5, 0, 7); g.arc(3 - bob, 6, 3.5, 0, 7); g.fill();
  // body (shirt colour) and arms holding the crossbow forward
  g.fillStyle = L.color; g.beginPath(); g.ellipse(0, 0, GUY_R * .8, GUY_R, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(12, -5, 3, 0, 7); g.arc(12, 5, 3, 0, 7); g.fill();
  // crossbow: stock, bow and string; a bolt sits on it when loaded
  g.strokeStyle = '#5a3d22'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(4, 0); g.lineTo(26, 0); g.stroke();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, -12); g.quadraticCurveTo(28, 0, 22, 12); g.stroke();
  g.strokeStyle = '#e8e0d0'; g.lineWidth = 1; g.beginPath(); g.moveTo(22, -12); g.lineTo(22 - 8 * pull, 0); g.lineTo(22, 12); g.stroke();
  if (pull) { g.strokeStyle = boltColor; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 0); g.lineTo(30, 0); g.stroke(); }
  // head and hat
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, 0, 7.5, 0, 7); g.fill();
  if (L.hat === 'cap') { g.fillStyle = shade(L.color, -.25); g.beginPath(); g.arc(0, 0, 7.8, 0, 7); g.fill(); g.beginPath(); g.ellipse(7, 0, 5, 6, 0, -Math.PI / 2, Math.PI / 2); g.fill(); }
  else if (L.hat === 'helmet') { g.fillStyle = '#6b7a52'; g.beginPath(); g.arc(0, 0, 9.5, 0, 7); g.fill(); g.fillStyle = '#7f8f63'; g.beginPath(); g.arc(-1.5, -1.5, 5.5, 0, 7); g.fill(); }
  else if (L.hat === 'crown') {
    g.fillStyle = '#ffd34a'; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 8.5, an = i / 10 * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    g.closePath(); g.fill(); g.fillStyle = '#ff5a6a'; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill();
  }
}

/** Draws the little guy on the loadout screen. */
export function drawPreview(c: HTMLCanvasElement, L: Loadout) {
  const g = c.getContext('2d')!, dpr = Math.min(2, devicePixelRatio || 1), size = c.clientWidth || 96;
  c.width = c.height = Math.round(size * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
  g.fillStyle = '#8b7651'; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 7); g.fill();
  g.translate(size / 2 - 6, size / 2); g.scale(size / 52, size / 52);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(2, 4, GUY_R + 2, GUY_R, 0, 0, 7); g.fill();
  paintGuy(g, L, -.5, 0, 1);
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const trim = (n: number) => String(Math.round(n * 100) / 100);
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const easeInOut = (k: number) => k * k * (3 - 2 * k);
function approachAngle(a: number, b: number, step: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
