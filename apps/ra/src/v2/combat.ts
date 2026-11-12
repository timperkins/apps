// Combat for v2: what each unit and building is armed with and armoured in,
// the shots in flight, and the flashes, sparks, explosions, fire and smoke.
//
// The rules follow the classic RTS scheme: every weapon has a warhead, every
// target an armour type, and a table says how much of the damage gets through
// (small arms shred infantry and barely scratch tanks, armour-piercing rounds
// are the other way round, high explosive is good against buildings). Units
// with nothing to do pick the nearest enemy in range and fire on it, and a
// unit that is hit turns on whoever hit it. All the numbers are our own.
import { ART, RGB, hash2, vnoise } from '../gfx';
import type { BuildingKind } from './sprites';
import { StackSprite, toScreen } from './stack';

export type Armor = 'none' | 'wood' | 'light' | 'heavy' | 'concrete';
export type Warhead = 'SA' | 'AP' | 'HE';
export type ShotKind = 'bullet' | 'shell' | 'rocket' | 'arc';

// How much of each warhead's damage gets through each armour.
export const VERSUS: Record<Warhead, Record<Armor, number>> = {
  SA: { none: 1, wood: 0.5, light: 0.6, heavy: 0.25, concrete: 0.25 },
  AP: { none: 0.3, wood: 0.75, light: 0.75, heavy: 1, concrete: 0.5 },
  HE: { none: 0.9, wood: 0.75, light: 0.6, heavy: 0.25, concrete: 1 },
};

// One cell of range, in world units (about a tank's length).
export const CELL = 16;

export interface Weapon {
  name: string;
  dmg: number; // per round, before armour
  rof: number; // seconds between shots
  range: number; // world units
  wh: Warhead;
  shot: ShotKind;
  speed: number; // world units a second (bullets arrive at once)
  barrels: number; // rounds per shot, one from each barrel
  air: boolean; // can hit aircraft
  ground: boolean; // can hit things on the ground or water
  splash?: number; // radius of an area hit (artillery)
  scatter?: number; // how far off the aim point a round may land
  big?: boolean; // heavy rounds: they shove tanks about, not just soldiers
}

export type UnitKind = 'mcv' | 'light' | 'heavy' | 'buggy' | 'hauler' | 'arty' | 'boat' | 'heli' | 'inf' | 'rocket';

export const WEAPON: Partial<Record<UnitKind | 'tower', Weapon>> = {
  inf: { name: 'Rifle', dmg: 15, rof: 1.1, range: 3.5 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true },
  rocket: { name: 'Rocket launcher', dmg: 35, rof: 2.6, range: 5 * CELL, wh: 'AP', shot: 'rocket', speed: 120, barrels: 1, air: true, ground: true },
  buggy: { name: 'Machine gun', dmg: 15, rof: 0.5, range: 4 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true },
  light: { name: '75mm gun', dmg: 25, rof: 1.6, range: 4.75 * CELL, wh: 'AP', shot: 'shell', speed: 260, barrels: 1, air: false, ground: true },
  heavy: { name: 'Twin 105mm', dmg: 30, rof: 2.2, range: 4.75 * CELL, wh: 'AP', shot: 'shell', speed: 260, barrels: 2, air: true, ground: true, big: true },
  arty: { name: '155mm howitzer', dmg: 150, rof: 4.5, range: 6.5 * CELL, wh: 'HE', shot: 'arc', speed: 95, barrels: 1, air: false, ground: true, splash: 14, scatter: 8, big: true },
  heli: { name: 'Rocket pods', dmg: 40, rof: 1.6, range: 4 * CELL, wh: 'AP', shot: 'rocket', speed: 150, barrels: 2, air: true, ground: true },
  boat: { name: 'Deck gun', dmg: 25, rof: 1.4, range: 5 * CELL, wh: 'HE', shot: 'shell', speed: 240, barrels: 1, air: false, ground: true },
  tower: { name: 'Twin cannon', dmg: 25, rof: 1.5, range: 6 * CELL, wh: 'AP', shot: 'shell', speed: 260, barrels: 2, air: false, ground: true },
};

export const UNIT_DEF: Record<UnitKind, { strength: number; armor: Armor }> = {
  inf: { strength: 50, armor: 'none' },
  rocket: { strength: 45, armor: 'none' },
  buggy: { strength: 150, armor: 'light' },
  light: { strength: 300, armor: 'heavy' },
  heavy: { strength: 450, armor: 'heavy' },
  hauler: { strength: 600, armor: 'heavy' },
  arty: { strength: 75, armor: 'light' },
  mcv: { strength: 600, armor: 'light' },
  heli: { strength: 120, armor: 'heavy' },
  boat: { strength: 200, armor: 'heavy' },
};

export const BUILDING_DEF: Record<BuildingKind, { strength: number; armor: Armor }> = {
  yard: { strength: 1000, armor: 'heavy' },
  hq: { strength: 1000, armor: 'heavy' },
  factory: { strength: 1000, armor: 'heavy' },
  power: { strength: 400, armor: 'wood' },
  barracks: { strength: 500, armor: 'wood' },
  refinery: { strength: 900, armor: 'wood' },
  silo: { strength: 300, armor: 'wood' },
  radar: { strength: 1000, armor: 'wood' },
  helipad: { strength: 800, armor: 'wood' },
  lab: { strength: 600, armor: 'wood' },
  tower: { strength: 400, armor: 'heavy' },
};

// A building is shown damaged (scorched, holed, on fire) at or below this much health.
export const DAMAGED = 0.5;
// How long the pieces of something destroyed fly about before they're gone.
export const PIECE_S = 1.3;
export const HELI_ALT = 20;

// The size of the explosion when each kind of vehicle is destroyed (map pixels).
export const BOOM: Partial<Record<UnitKind, number>> = { buggy: 7, light: 11, heavy: 14, hauler: 12, arty: 8, mcv: 15, heli: 9, boat: 10 };
// Tracked armour: these cook off in a string of explosions when destroyed.
const TANKS = new Set<UnitKind>(['light', 'heavy', 'mcv', 'hauler']);

// How hard the screen shakes (in map pixels) when something big is
// destroyed nearby: tanks and the like, and every building, by its size.
export const QUAKE: Partial<Record<UnitKind, number>> = { light: 1.5, heavy: 2, mcv: 2, hauler: 1.6, boat: 1.2 };
export const buildingQuake = (rx: number, ry: number) => Math.min(3.5, 1.8 + (rx + ry) * 0.04);
// How long a shake lasts, in seconds.
export const QUAKE_S = 0.5;

// How far (world units) a round shoves what it hits, away from where it came
// from: soldiers are knocked back by anything, tanks only by heavy rounds.
// k is how much of the round's force reaches it (less further from a burst).
export function knockback(w: Weapon, kind: UnitKind, k = 1): number {
  if (kind === 'inf' || kind === 'rocket') return k * (w.shot === 'bullet' ? 1.6 : w.shot === 'arc' ? 6 : w.shot === 'rocket' ? 3.5 : 3);
  if ((kind === 'light' || kind === 'heavy') && w.big) return k * (w.shot === 'arc' ? 2.8 : 1.6);
  return 0;
}
// A knock in progress slides it this far each second, as a share of what is
// left (so the shove is quick and eases off).
export const KNOCK_EASE = 12;

// Where a weapon's rounds leave from, in world units: one point per barrel.
// a is the way the body faces, tur the turret's (tanks and towers). For a
// tank the turret turns about a point 1.2 behind the hull's middle. z is the
// ground (or flying) height under the unit.
export function muzzles(kind: UnitKind | 'tower', x: number, y: number, z: number, a: number, tur: number): [number, number, number][] {
  const at = (px: number, py: number, ang: number, u: number, v: number, h: number): [number, number, number] => [
    px + Math.cos(ang) * u - Math.sin(ang) * v,
    py + Math.sin(ang) * u + Math.cos(ang) * v,
    z + h,
  ];
  const px = x - Math.cos(a) * 1.2;
  const py = y - Math.sin(a) * 1.2;
  switch (kind) {
    case 'inf':
      return [at(x, y, a, 4.2, 1, 5.2)];
    case 'rocket':
      return [at(x, y, a, 3.4, 1.5, 7)];
    case 'buggy':
      return [at(x, y, a, 1.4, 0, 6.7)];
    case 'light':
      return [at(px, py, tur, 11.2, 0, 6.3)];
    case 'heavy':
      return [at(px, py, tur, 13.2, 1.15, 7.7), at(px, py, tur, 13.2, -1.15, 7.7)];
    case 'arty':
      return [at(x, y, a, 13.4, 0, 12)];
    case 'heli':
      return [at(x, y, a, 3.8, 4.1, 2.7), at(x, y, a, 3.8, -4.1, 2.7)];
    case 'boat':
      return [at(x, y, a, 13.8, 0, 4.4)];
    case 'tower':
      return [at(x, y, tur, 11.2, 1.15, 1.45), at(x, y, tur, 11.2, -1.15, 1.45)];
    default:
      return [[x, y, z + 4]];
  }
}

// ---------- Shots in flight ----------

export interface Shot {
  kind: ShotKind;
  x0: number;
  y0: number;
  z0: number;
  x1: number; // where it is going (moved along each frame to follow a target)
  y1: number;
  z1: number;
  t: number;
  dur: number;
  peak: number; // how high an artillery shell arcs
  x: number; // where it is now
  y: number;
  z: number;
  track?: () => [number, number, number] | null;
  hit: (s: Shot) => void;
  puffT: number;
}

export function makeShot(kind: ShotKind, from: [number, number, number], to: [number, number, number], speed: number, hit: (s: Shot) => void, track?: Shot['track']): Shot {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const dur = kind === 'bullet' ? 0.06 : d / speed;
  return {
    kind,
    x0: from[0],
    y0: from[1],
    z0: from[2],
    x1: to[0],
    y1: to[1],
    z1: to[2],
    t: 0,
    dur: Math.max(0.04, dur),
    peak: kind === 'arc' ? 10 + d * 0.32 : kind === 'rocket' ? 2 : 0,
    x: from[0],
    y: from[1],
    z: from[2],
    track,
    hit,
    puffT: 0,
  };
}

// ---------- Effects, in screen pixels ----------

type PKind = 'smoke' | 'soot' | 'spark' | 'ember' | 'dust' | 'debris';
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: PKind;
  size: number;
  g: number; // gravity
}
interface Boom {
  x: number;
  y: number;
  r: number; // size in map pixels
  t: number; // < 0 while waiting to go off
  seed: number;
}
// A chunk of a sprite thrown off when it is destroyed: the patch of the
// picture at (px, py), pw by ph art pixels, flying about and landing on its
// own bit of ground (floor).
interface Piece {
  img: HTMLCanvasElement;
  px: number;
  py: number;
  pw: number;
  ph: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  life: number;
  max: number;
}
const alphaOf = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();

interface Flash {
  x: number;
  y: number;
  t: number;
  r: number;
}

const FIRE: RGB[] = [
  [255, 250, 226],
  [255, 230, 120],
  [255, 176, 58],
  [236, 106, 36],
  [176, 52, 26],
  [96, 30, 20],
];
const rgb = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// A pixel-art fireball r map pixels across at time k (0 at the bang, 1 when
// it has gone to smoke), drawn in half pixels. It flares white-hot, swells
// into lumpy orange and red, then darkens and lifts away as smoke.
export function drawBoom(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, seed: number): void {
  if (k < 0 || k >= 1) return;
  const grow = 1 - (1 - Math.min(1, k * 2.6)) ** 3;
  const R = r * (0.35 + 0.65 * grow);
  const lift = k * r * 0.55;
  const frame = Math.floor(k * 14); // flickers at a steady pixel-art rate
  const cy = y - lift;
  const step = 0.5;
  for (let dy = -R; dy <= R * 0.8; dy += step)
    for (let dx = -R * 1.15; dx <= R * 1.15; dx += step) {
      const nx = dx / 1.15;
      const ny = dy < 0 ? dy : dy * 1.25;
      const n = vnoise((dx + 40) / 2.2, (dy + 40) / 2.2 + frame * 0.7, seed) - 0.5;
      const d = Math.hypot(nx, ny) / R + n * 0.55;
      if (d > 1) continue;
      const heat = (1 - d) * 1.6 - k * 1.9 + (dy < 0 ? 0.1 : 0);
      let col: string;
      if (heat > 1.05) col = rgb(FIRE[0]);
      else if (heat > 0.8) col = rgb(FIRE[1]);
      else if (heat > 0.55) col = rgb(FIRE[2]);
      else if (heat > 0.3) col = rgb(FIRE[3]);
      else if (heat > 0.08) col = rgb(FIRE[4]);
      else if (heat > -0.15) col = rgb(FIRE[5], 0.95);
      else {
        const a = 0.75 * (1 - k) * Math.min(1, 1 - d + 0.3);
        if (a < 0.08) continue;
        col = `rgba(${52 + (n > 0 ? 10 : 0)},${46 + (n > 0 ? 8 : 0)},${42},${a})`;
      }
      c.fillStyle = col;
      c.fillRect(Math.round((x + dx) * 2) / 2, Math.round((cy + dy) * 2) / 2, step, step);
    }
}

// A little flickering flame, h map pixels tall, its foot at (x, y).
export function drawFlame(c: CanvasRenderingContext2D, x: number, y: number, h: number, t: number, seed: number): void {
  const fr = Math.floor(t * 12);
  const w = Math.max(2, h * 0.7);
  for (let i = 0; i < w * 2; i++) {
    const dx = i / 2 - w / 2;
    const edge = 1 - Math.abs(dx) / (w / 2 + 0.25);
    const top = h * edge * (0.55 + 0.6 * hash2(i, fr, seed));
    for (let j = 0; j < top * 2; j++) {
      const k = j / 2 / Math.max(0.5, top);
      const col = k > 0.75 ? FIRE[4] : k > 0.5 ? FIRE[3] : k > 0.25 || Math.abs(dx) > w * 0.25 ? FIRE[2] : FIRE[1];
      c.fillStyle = rgb(col, k > 0.85 ? 0.7 : 1);
      c.fillRect(Math.round((x + dx) * 2) / 2, Math.round((y - j / 2) * 2) / 2 - 0.5, 0.5, 0.5);
    }
  }
}

// Everything that flies about in a fight: shots, explosions, muzzle flashes,
// sparks, embers, debris and smoke. Screen coordinates, except the shots,
// which are in world coordinates and drawn through toScreen.
export class Fx {
  shots: Shot[] = [];
  private ps: P[] = [];
  private booms: Boom[] = [];
  private flashes: Flash[] = [];
  private tracers: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  private pieces: Piece[] = [];
  // columns of smoke rising from wrecks: `rate` puffs a second, thinning out
  // over `dur` seconds
  private plumes: { x: number; y: number; t: number; dur: number; rate: number; size: number; w: number }[] = [];

  clear(): void {
    this.pieces = [];
    this.plumes = [];
    this.shots = [];
    this.ps = [];
    this.booms = [];
    this.flashes = [];
    this.tracers = [];
  }

  private p(x: number, y: number, kind: PKind, o: Partial<P>): void {
    this.ps.push({ x, y, vx: 0, vy: 0, life: 0, max: 1, kind, size: 1, g: 0, ...o });
  }

  fire(s: Shot): void {
    this.shots.push(s);
  }

  // The flash at a gun's muzzle (screen point), for a moment.
  muzzle(x: number, y: number, big = false): void {
    this.flashes.push({ x, y, t: 0, r: big ? 2.5 : 1.5 });
    if (big) for (let i = 0; i < 3; i++) this.p(x, y, 'smoke', { vx: (Math.random() - 0.5) * 8, vy: -3 - Math.random() * 4, max: 0.9 + Math.random() * 0.5, size: 1.5 });
  }

  // Rounds hitting something hard: a spray of sparks.
  sparks(x: number, y: number, n = 5): void {
    this.flashes.push({ x, y, t: 0, r: 1 });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const v = 14 + Math.random() * 26;
      this.p(x, y, 'spark', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.25 + Math.random() * 0.25, g: 90 });
    }
  }

  // Rounds hitting soft ground or a soldier: a little kick of dust.
  dust(x: number, y: number, n = 3): void {
    for (let i = 0; i < n; i++) this.p(x + (Math.random() - 0.5) * 2, y, 'dust', { vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 8, max: 0.5 + Math.random() * 0.4, g: 20 });
  }

  // An explosion r map pixels across, after `delay` seconds: the fireball,
  // then debris and embers thrown out, and smoke rolling up after it.
  boom(x: number, y: number, r: number, delay = 0): void {
    this.booms.push({ x, y, r, t: -delay, seed: Math.floor(Math.random() * 1e6) });
  }

  // Blow a sprite drawn with its ground origin at screen point (sx, sy) to
  // pieces: it is cut into chunks of `chunk` art pixels which fly out from
  // (ox, oy), fall back to the ground round gy and fade (PIECE_S seconds).
  // Chunks that are mostly shadow are left out; at most `cap` are thrown.
  shatter(spr: StackSprite, sx: number, sy: number, ox: number, oy: number, gy: number, chunk: number, force: number, cap = 160): void {
    const img = spr.img;
    let a = alphaOf.get(img);
    if (!a) {
      a = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
      alphaOf.set(img, a);
    }
    const W = img.width;
    const H = img.height;
    const out: Piece[] = [];
    for (let py = 0; py < H; py += chunk)
      for (let px = 0; px < W; px += chunk) {
        let solid = 0;
        let n = 0;
        for (let y = py; y < Math.min(H, py + chunk); y++)
          for (let x = px; x < Math.min(W, px + chunk); x++) {
            n++;
            if (a[(y * W + x) * 4 + 3] > 200) solid++;
          }
        if (solid * 2 < n) continue;
        const x = sx - spr.cx + px / ART;
        const y = sy - spr.cy + py / ART;
        const dx = x + chunk / ART / 2 - ox;
        const dy = y + chunk / ART / 2 - oy;
        const d = Math.hypot(dx, dy) || 1;
        const v = force * (0.5 + Math.random() * 0.8);
        out.push({
          img,
          px,
          py,
          pw: Math.min(chunk, W - px),
          ph: Math.min(chunk, H - py),
          x,
          y,
          vx: (dx / d) * v + (Math.random() - 0.5) * force * 0.4,
          vy: (dy / d) * v * 0.6 - force * (0.5 + Math.random() * 0.7),
          floor: gy + (Math.random() - 0.3) * (6 + force * 0.12),
          life: 0,
          max: PIECE_S * (0.6 + Math.random() * 0.5),
        });
      }
    // too many: keep an even spread of them
    while (out.length > cap) out.splice(Math.floor(Math.random() * out.length), 1);
    this.pieces.push(...out);
  }

  // A column of dark smoke rising from (x, y) for dur seconds, w pixels wide.
  plume(x: number, y: number, dur: number, rate: number, size: number, w = 3): void {
    this.plumes.push({ x, y, t: 0, dur, rate, size, w });
  }

  // A thick cloud of smoke rolling up over an area w by h pixels round (x, y).
  billow(x: number, y: number, w: number, h: number, n: number, size: number): void {
    for (let i = 0; i < n; i++)
      this.p(x + (Math.random() - 0.5) * w, y + (Math.random() - 0.5) * h, i % 4 ? 'soot' : 'smoke', {
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 7,
        max: 2.4 + Math.random() * 1.8,
        size: size * (0.7 + Math.random() * 0.6),
      });
  }

  // A unit is destroyed: it blows up, breaks into a few big chunks and leaves
  // a column of smoke (tanks cook off in a string of explosions, the turret
  // thrown high). parts are the sprites it is drawn with and the screen
  // points they are drawn at, (ox, oy) is its middle and gy the ground under it.
  wreck(kind: UnitKind, parts: [StackSprite, number, number][], ox: number, oy: number, gy: number): void {
    const foot = kind === 'inf' || kind === 'rocket';
    const tank = TANKS.has(kind);
    const r = BOOM[kind] ?? 3;
    parts.forEach(([spr, px, py], i) => {
      if (foot) this.shatter(spr, px, py, ox, oy, gy, 3, 18, 7);
      else this.shatter(spr, px, py, ox, oy, gy, 6, 30 + r * 2 + (tank && i ? 25 : 0), i ? 6 : 14);
    });
    if (foot) {
      this.boom(ox, oy, 3);
      this.billow(ox, oy, 3, 2, 5, 1.5);
      return;
    }
    this.boom(ox, oy, r);
    this.boom(ox + (Math.random() - 0.5) * r, oy - r * 0.3, r * 0.6, 0.15);
    if (tank) {
      // it cooks off: more bangs round it, and a fountain of embers
      for (const [d, k] of [
        [0.3, 0.55],
        [0.5, 0.7],
        [0.8, 0.5],
      ])
        this.boom(ox + (Math.random() - 0.5) * r * 1.2, oy - Math.random() * r * 0.5, r * k, d);
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const v = 30 + Math.random() * 40;
        this.p(ox, oy, i % 2 ? 'ember' : 'spark', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.6 + Math.random() * 0.7, g: 70 });
      }
    }
    this.billow(ox, oy - r * 0.2, r * 1.4, r * 0.6, Math.round(r * 1.6), 2 + r * 0.2);
    this.plume(ox, gy - 2, tank ? 7 : 4.5, tank ? 9 : 6, 1.6 + r * 0.12, r * 0.5);
  }

  // A building's big bang: it breaks into a few big chunks over its ruin and
  // smoke rolls up over the whole of it. (sx, sy) is where its sprite is drawn,
  // (ox, oy) where the pieces fly out from, w by h its size on screen.
  collapse(spr: StackSprite, sx: number, sy: number, ox: number, oy: number, w: number, h: number): void {
    this.shatter(spr, sx, sy, ox, oy, sy, 10, 55, 40);
    this.billow(ox, (oy + sy) / 2, w, h, Math.round(14 + w * 0.6), 3.5);
    this.plume(ox, sy - 2, 9, 12, 3, w * 0.4);
  }

  smoke(x: number, y: number, dark = true, size = 1.5): void {
    this.p(x + (Math.random() - 0.5) * 3, y, dark ? 'soot' : 'smoke', { vx: 2 + Math.random() * 3, vy: -6 - Math.random() * 4, max: 2.2 + Math.random() * 1.2, size });
  }

  ember(x: number, y: number): void {
    this.p(x + (Math.random() - 0.5) * 3, y, 'ember', { vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 8, max: 0.6 + Math.random() * 0.6, g: -4 });
  }

  // Shots move on; each one that arrives calls its hit().
  step(dt: number): void {
    for (const s of this.shots) {
      if (s.track) {
        const p = s.track();
        if (p) [s.x1, s.y1, s.z1] = p;
      }
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.x = s.x0 + (s.x1 - s.x0) * k;
      s.y = s.y0 + (s.y1 - s.y0) * k;
      s.z = s.z0 + (s.z1 - s.z0) * k + s.peak * 4 * k * (1 - k);
      if (s.kind === 'rocket' && (s.puffT -= dt) <= 0) {
        s.puffT = 0.03;
        const [sx, sy] = toScreen(s.x, s.y, s.z);
        this.p(sx, sy, 'smoke', { vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 2, max: 0.5 + Math.random() * 0.3, size: 1 });
      }
      if (s.kind === 'bullet' && s.t <= dt) {
        const [ax, ay] = toScreen(s.x0, s.y0, s.z0);
        const [bx, by] = toScreen(s.x1, s.y1, s.z1);
        this.tracers.push({ x0: ax, y0: ay, x1: bx, y1: by, t: 0 });
      }
    }
    const done = this.shots.filter((s) => s.t >= s.dur);
    this.shots = this.shots.filter((s) => s.t < s.dur);
    for (const s of done) s.hit(s);

    for (const b of this.booms) {
      const was = b.t;
      b.t += dt;
      if (was < 0 && b.t >= 0) {
        // the bang: debris and embers fly out, smoke follows
        const n = Math.round(b.r * 1.2);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
          const v = (16 + Math.random() * 34) * Math.sqrt(b.r / 6);
          this.p(b.x, b.y - b.r * 0.2, i % 5 ? 'spark' : 'debris', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.4 + Math.random() * 0.6, g: 110 });
        }
        for (let i = 0; i < Math.round(b.r * 0.6); i++)
          this.p(b.x + (Math.random() - 0.5) * b.r, b.y - Math.random() * b.r * 0.5, 'soot', { vx: (Math.random() - 0.5) * 6, vy: -5 - Math.random() * 6, max: 1.8 + Math.random() * 1.4, size: 1.5 + b.r * 0.15 });
      }
    }
    this.booms = this.booms.filter((b) => b.t < this.boomLen(b));
    for (const m of this.plumes) {
      m.t += dt;
      const k = 1 - m.t / m.dur;
      if (Math.random() < m.rate * dt * k)
        this.p(m.x + (Math.random() - 0.5) * m.w, m.y, Math.random() < 0.8 ? 'soot' : 'smoke', {
          vx: 2 + Math.random() * 4,
          vy: -7 - Math.random() * 5,
          max: 2 + Math.random() * 1.4,
          size: m.size * (0.6 + 0.4 * k),
        });
    }
    this.plumes = this.plumes.filter((m) => m.t < m.dur);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.07);
    for (const t of this.tracers) t.t += dt;
    this.tracers = this.tracers.filter((t) => t.t < 0.06);
    for (const p of this.ps) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'soot') p.size += dt * 2;
      if (p.kind === 'debris' || p.kind === 'spark') {
        p.vx *= 1 - dt * 1.5;
      }
    }
    this.ps = this.ps.filter((p) => p.life < p.max);
    for (const p of this.pieces) {
      p.life += dt;
      if (p.y < p.floor || p.vy < 0) {
        p.vy += 140 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y >= p.floor && p.vy > 0) {
          // land with a little bounce, then lie there
          p.y = p.floor;
          p.vy = Math.abs(p.vy) > 25 ? -p.vy * 0.3 : 0;
          p.vx *= 0.5;
        }
      }
    }
    this.pieces = this.pieces.filter((p) => p.life < p.max);
  }

  private boomLen(b: Boom): number {
    return 0.55 + b.r * 0.035;
  }

  // Smoke and dust, under the fire.
  drawBelow(c: CanvasRenderingContext2D): void {
    for (const p of this.ps) {
      if (p.kind !== 'smoke' && p.kind !== 'soot' && p.kind !== 'dust') continue;
      const k = p.life / p.max;
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle = p.kind === 'smoke' ? `rgba(214,212,204,${0.55 * (1 - k)})` : p.kind === 'soot' ? `rgba(48,44,40,${0.6 * (1 - k)})` : `rgba(160,140,100,${0.55 * (1 - k)})`;
      const X = Math.round(p.x - s / 2);
      const Y = Math.round(p.y - s / 2);
      if (s > 1) {
        c.fillRect(X + 0.5, Y, s - 1, s);
        c.fillRect(X, Y + 0.5, 0.5, s - 1);
        c.fillRect(X + s - 0.5, Y + 0.5, 0.5, s - 1);
      } else c.fillRect(X, Y, s, s);
    }
  }

  // Shots, flying pieces, fireballs, flashes and sparks, over everything.
  drawAbove(c: CanvasRenderingContext2D): void {
    for (const p of this.pieces) {
      // scorched as they fly, fading out towards the end
      const k = p.life / p.max;
      c.globalAlpha = k < 0.45 ? 1 : Math.max(0, 1 - (k - 0.45) / 0.55);
      const X = Math.round(p.x * ART) / ART;
      const Y = Math.round(p.y * ART) / ART;
      c.drawImage(p.img, p.px, p.py, p.pw, p.ph, X, Y, p.pw / ART, p.ph / ART);
      c.globalAlpha *= Math.min(0.3, k * 0.6);
      c.fillStyle = '#1e1b18';
      c.fillRect(X, Y, p.pw / ART, p.ph / ART);
    }
    c.globalAlpha = 1;
    for (const t of this.tracers) {
      c.fillStyle = 'rgba(255,236,150,0.9)';
      const n = Math.ceil(Math.hypot(t.x1 - t.x0, t.y1 - t.y0) * 2);
      // a short bright streak travelling down the line
      const k0 = t.t / 0.06;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        if (k < k0 - 0.1 || k > k0 + 0.55) continue;
        c.fillRect(Math.round((t.x0 + (t.x1 - t.x0) * k) * 2) / 2, Math.round((t.y0 + (t.y1 - t.y0) * k) * 2) / 2, 0.5, 0.5);
      }
    }
    for (const s of this.shots) {
      const [x, y] = toScreen(s.x, s.y, s.z);
      const X = Math.round(x * 2) / 2;
      const Y = Math.round(y * 2) / 2;
      if (s.kind === 'shell') {
        // a hot round with a short streak behind it
        const [px, py] = toScreen(s.x - (s.x1 - s.x0) * 0.04, s.y - (s.y1 - s.y0) * 0.04, s.z - (s.z1 - s.z0) * 0.04);
        c.fillStyle = 'rgba(255,200,90,0.6)';
        c.fillRect(Math.round(px * 2) / 2, Math.round(py * 2) / 2, 0.5, 0.5);
        c.fillStyle = '#fff4c2';
        c.fillRect(X, Y, 1, 0.5);
      } else if (s.kind === 'rocket') {
        c.fillStyle = '#d8d4c8';
        c.fillRect(X, Y, 1, 1);
        c.fillStyle = Math.floor(s.t * 30) % 2 ? '#ffd65a' : '#ff8a3a';
        const [px, py] = toScreen(s.x - (s.x1 - s.x0) * 0.03, s.y - (s.y1 - s.y0) * 0.03, s.z);
        c.fillRect(Math.round(px * 2) / 2, Math.round(py * 2) / 2, 0.5, 0.5);
      } else if (s.kind === 'arc') {
        // the shell high up, and its shadow sliding along the ground
        const [gx, gy] = toScreen(s.x, s.y, s.z0 + (s.z1 - s.z0) * (s.t / s.dur));
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(Math.round(gx), Math.round(gy), 1, 0.5);
        c.fillStyle = '#2a2a26';
        c.fillRect(X - 0.5, Y, 1.5, 1);
        c.fillStyle = '#ffb347';
        c.fillRect(X, Y + 0.5, 0.5, 0.5);
      }
    }
    for (const b of this.booms) drawBoom(c, b.x, b.y, b.r, b.t / this.boomLen(b), b.seed);
    for (const f of this.flashes) {
      const r = f.r * (f.t < 0.035 ? 1 : 0.6);
      c.fillStyle = 'rgba(255,214,110,0.55)';
      c.fillRect(Math.round((f.x - r) * 2) / 2, Math.round((f.y - r * 0.8) * 2) / 2, r * 2, r * 1.6);
      c.fillStyle = '#fffbe6';
      c.fillRect(Math.round((f.x - r / 2) * 2) / 2, Math.round((f.y - r / 2) * 2) / 2, Math.max(0.5, r), Math.max(0.5, r * 0.8));
    }
    for (const p of this.ps) {
      if (p.kind === 'spark') {
        c.fillStyle = p.life < 0.12 ? '#fff6c8' : '#ffb347';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5);
      } else if (p.kind === 'ember') {
        const k = p.life / p.max;
        c.fillStyle = k < 0.5 ? '#ffcf5a' : '#e0602c';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5);
      } else if (p.kind === 'debris') {
        c.fillStyle = '#2a2622';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 1, 1);
        c.fillStyle = '#6a5a48';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5);
      }
    }
  }
}
