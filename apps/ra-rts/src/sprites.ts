// All unit, building and prop art, drawn procedurally at native pixel size.
import { Pix, RGB, Shader, hash2, hex, mix, rotFrames, shade } from './gfx';

export interface Faction {
  name: string;
  main: RGB;
  light: RGB;
  dark: RGB;
}

export const FACTIONS: Faction[] = [
  { name: 'Cobalt', main: hex('#4f74a8'), light: hex('#8fb2dc'), dark: hex('#2c446b') },
  { name: 'Ember', main: hex('#c0622e'), light: hex('#eba05d'), dark: hex('#71331a') },
];

const TREAD = hex('#3c3a35');
const TREAD_L = hex('#5a574e');
const TREAD_D = hex('#24231f');
const GUN = hex('#4a4d4f');
const GUN_D = hex('#2a2c2e');
const GLASS = hex('#7fc7d8');
const GLASS_D = hex('#2f5e6b');
const TYRE = hex('#1e1d1b');
const CONC = hex('#8e8b80');
const CONC_L = hex('#b4b0a2');
const CONC_D = hex('#5f5c54');
const METAL = hex('#9aa0a2');
const WIN = hex('#20292c');
const WIN_LIT = hex('#e8d77c');
const HAZARD = hex('#d8b23a');

const grain = (c: RGB, sx: number, sy: number, k = 0.1) => shade(c, (hash2(sx, sy, 91) - 0.5) * k);

export const DIRS = 32;

export interface RotSprite {
  img: HTMLCanvasElement[];
  shadow: HTMLCanvasElement[];
  size: number;
}

function rot(size: number, shader: Shader): RotSprite {
  return { ...rotFrames(size, DIRS, shader), size };
}

// ---------- Vehicles ----------

function tankHull(f: Faction, L: number, W: number): Shader {
  const hl = L / 2;
  const hw = W / 2;
  return (u, v, sx, sy) => {
    const au = Math.abs(u);
    const av = Math.abs(v);
    if (au > hl || av > hw) return null;
    if (av >= hw - 2.2) {
      if (au > hl - 0.6 && av > hw - 0.8) return null;
      const stripe = Math.floor(u + 40) % 2 === 0;
      if (av > hw - 0.8) return TREAD_D;
      return stripe ? TREAD : TREAD_L;
    }
    if (au > hl - 1.2) return null;
    let c = f.main;
    if (u > hl - 3.5) c = f.light;
    else if (u < -hl + 2.5) c = f.dark;
    if (av > hw - 3) c = shade(c, -0.22);
    if (u < -hl + 4 && u > -hl + 2.5 && av < hw - 4) c = GUN_D; // engine grille
    return grain(c, sx, sy);
  };
}

function turretShader(f: Faction, r: number, barrels: number, len: number): Shader {
  return (u, v, sx, sy) => {
    const d = Math.hypot(u + 0.5, v);
    if (barrels === 2) {
      if (u > r - 1 && u < len && (Math.abs(v - 1.3) < 0.8 || Math.abs(v + 1.3) < 0.8)) return u > len - 1.5 ? GUN_D : GUN;
    } else if (u > r - 1 && u < len && Math.abs(v) < 0.85) return u > len - 1.5 ? GUN_D : GUN;
    if (d <= r) {
      if (d < 1.3 && u < 0) return f.dark; // hatch
      return grain(d > r - 1 ? f.main : f.light, sx, sy);
    }
    return null;
  };
}

function buggy(f: Faction): Shader {
  return (u, v, sx, sy) => {
    const au = Math.abs(u);
    const av = Math.abs(v);
    if (Math.abs(au - 3.5) < 1.4 && av >= 3 && av < 4.8) return TYRE;
    if (au > 5.5 || av > 3.2) return null;
    if (u > 4.5 && av > 2.2) return null;
    if (u > 0.8 && u < 2.6 && av < 2.4) return u < 1.6 ? GLASS_D : GLASS;
    if (Math.hypot(u + 2.2, v) < 1.6) return GUN_D;
    if (u < -2 && u > -4.8 && Math.abs(v) < 0.6) return GUN;
    return grain(u > 2.6 ? f.light : av > 2.2 ? f.dark : f.main, sx, sy);
  };
}

function hauler(f: Faction): Shader {
  const ore = hex('#b08a3e');
  return (u, v, sx, sy) => {
    const au = Math.abs(u);
    const av = Math.abs(v);
    if (au > 11 || av > 6) return null;
    if (av >= 4) {
      if (au > 10.4 && av > 5.2) return null;
      return av > 5.2 ? TREAD_D : Math.floor(u + 40) % 2 ? TREAD : TREAD_L;
    }
    if (u > 4.5) {
      if (u > 10) return null;
      if (u > 7 && u < 8.6 && av < 3) return u < 7.8 ? GLASS_D : GLASS;
      return grain(u > 8.6 ? f.light : f.main, sx, sy);
    }
    if (u > 3.5) return GUN_D;
    if (u < -10) return null;
    if (av > 3 || u < -9 || u > 2.5) return grain(METAL, sx, sy, 0.14);
    return shade(ore, (hash2(sx, sy, 5) - 0.5) * 0.5);
  };
}

function artillery(f: Faction): Shader {
  const base = tankHull(f, 15, 11);
  return (u, v, sx, sy) => {
    if (u > -2 && u < 11 && Math.abs(v) < 0.9) return u > 9.5 ? GUN_D : GUN;
    if (Math.hypot(u + 1, v) < 3) return grain(Math.hypot(u + 1, v) < 1.5 ? f.dark : METAL, sx, sy);
    return base(u, v, sx, sy);
  };
}

function boat(f: Faction): Shader {
  const hull = hex('#9ca3a6');
  return (u, v, sx, sy) => {
    if (u < -12 || u > 14) return null;
    const hw = u > 5 ? 5 * ((14 - u) / 9) : 5;
    const av = Math.abs(v);
    if (av > hw) return null;
    if (av > hw - 1.2) return shade(hull, -0.35);
    if (Math.hypot(u - 7, v) < 2) return Math.hypot(u - 7, v) < 0.9 ? GUN_D : f.light;
    if (u > 7 && u < 12 && av < 0.6) return GUN;
    if (u > -6 && u < 2 && av < 3) return u > 0.8 ? GLASS : grain(f.main, sx, sy);
    if (u < -9 && av < 2) return f.dark;
    return grain(hull, sx, sy, 0.12);
  };
}

function heli(f: Faction): Shader {
  return (u, v, sx, sy) => {
    const av = Math.abs(v);
    const e = ((u - 2) / 6.5) ** 2 + (v / 3.2) ** 2;
    if (e <= 1) {
      if (u > 5) return u > 6.6 ? GLASS : GLASS_D;
      return grain(av > 2 ? f.dark : f.main, sx, sy);
    }
    if (u > -12 && u < -3 && av < 1) return grain(f.dark, sx, sy);
    if (u > -14 && u < -11.5 && av < 3) return f.main;
    if (u > -2 && u < 6 && av > 3.4 && av < 4.2) return GUN_D; // skids
    return null;
  };
}

export interface VehicleArt {
  body: RotSprite;
  turret?: RotSprite;
}

export interface FactionArt {
  lightTank: VehicleArt;
  heavyTank: VehicleArt;
  buggy: VehicleArt;
  hauler: VehicleArt;
  artillery: VehicleArt;
  boat: VehicleArt;
  heli: VehicleArt;
  towerGun: RotSprite;
  infantry: HTMLCanvasElement[][]; // [dir: down, up, side][frame]
  rocket: HTMLCanvasElement[][];
}

export function makeFactionArt(f: Faction): FactionArt {
  return {
    lightTank: { body: rot(20, tankHull(f, 14, 11)), turret: rot(22, turretShader(f, 3.4, 1, 9)) },
    heavyTank: { body: rot(26, tankHull(f, 19, 15)), turret: rot(28, turretShader(f, 4.6, 2, 12)) },
    buggy: { body: rot(16, buggy(f)) },
    hauler: { body: rot(26, hauler(f)) },
    artillery: { body: rot(26, artillery(f)) },
    boat: { body: rot(32, boat(f)) },
    heli: { body: rot(32, heli(f)) },
    towerGun: rot(22, turretShader(f, 3.8, 2, 10)),
    infantry: makeInfantry(f, false),
    rocket: makeInfantry(f, true),
  };
}

// ---------- Infantry (hand-placed pixels, 7x10) ----------

function makeInfantry(f: Faction, rocket: boolean): HTMLCanvasElement[][] {
  const skin = hex('#d9a77a');
  const body = rocket ? mix(f.main, hex('#6b6b4a'), 0.35) : f.main;
  const legs = shade(f.dark, -0.2);
  const helm = rocket ? f.light : shade(f.main, -0.15);
  const dirs: HTMLCanvasElement[][] = [];
  for (let d = 0; d < 3; d++) {
    const frames: HTMLCanvasElement[] = [];
    for (let fr = 0; fr < 3; fr++) {
      const p = new Pix(9, 12);
      const ox = 2;
      const oy = 1;
      p.ellipse(4.5, 10.5, 3.5, 1.3, [0, 0, 0], 80); // soft shadow
      // legs
      const step = fr === 0 ? 0 : fr === 1 ? 1 : -1;
      if (d === 2) {
        p.rect(ox + 1 + step, oy + 7, 1, 3, legs);
        p.rect(ox + 3 - step, oy + 7, 1, 3, legs);
      } else {
        p.rect(ox + 1, oy + 7, 1, step === 1 ? 2 : 3, legs);
        p.rect(ox + 3, oy + 7, 1, step === -1 ? 2 : 3, legs);
      }
      // torso
      p.rect(ox, oy + 3, 5, 4, body);
      p.rect(ox + 1, oy + 6, 3, 1, shade(body, -0.25));
      // head
      p.rect(ox + 1, oy + 1, 3, 2, d === 1 ? helm : skin);
      p.rect(ox + 1, oy, 3, 1, helm);
      if (d === 0) p.set(ox + 1, oy + 1, helm), p.set(ox + 3, oy + 1, helm);
      if (d === 2) p.set(ox + 1, oy + 1, helm), p.set(ox + 1, oy + 2, helm);
      // weapon
      if (rocket) {
        if (d === 2) p.rect(ox - 1, oy + 2, 7, 1, hex('#556b4a'));
        else p.rect(ox + 4, oy - 1, 1, 6, hex('#556b4a'));
      } else if (d === 2) p.rect(ox + 3, oy + 4, 4, 1, GUN_D);
      else p.rect(ox + 4, oy + 3, 1, 4, GUN_D);
      p.finish([20, 22, 16], 0.25, -0.2);
      frames.push(p.canvas());
    }
    dirs.push(frames);
  }
  return dirs;
}

// ---------- Buildings ----------

function box(p: Pix, x: number, y: number, w: number, d: number, h: number, roof: RGB, wall: RGB, windows = true, seed = 1): void {
  p.rect(x, y, w, d, (sx, sy) => grain(roof, sx, sy, 0.12));
  p.rect(x, y, w, 1, shade(roof, 0.25));
  p.rect(x, y + d, w, h, (sx, sy) => grain(wall, sx, sy, 0.1));
  p.rect(x, y + d, w, 1, shade(wall, -0.35));
  p.rect(x, y + d + h - 1, w, 1, shade(wall, -0.25));
  if (windows && h >= 6) {
    for (let wy = y + d + 2; wy + 2 <= y + d + h - 2; wy += 4)
      for (let wx = x + 2; wx + 2 <= x + w - 2; wx += 4) {
        p.rect(wx, wy, 2, 2, hash2(wx, wy, seed) < 0.25 ? WIN_LIT : WIN);
      }
  }
}

function cylinder(p: Pix, cx: number, top: number, r: number, h: number, col: RGB, band?: RGB): void {
  const ry = Math.max(2, r * 0.45);
  for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
    const t = (x + 0.5 - cx) / r; // -1..1 across the face
    if (Math.abs(t) > 1) continue;
    const curve = Math.sqrt(1 - t * t) * ry;
    for (let y = top; y < top + h + curve; y++) {
      const rel = y - curve - top;
      let c = shade(col, -t * 0.35 - 0.05);
      if (band && rel > h * 0.35 && rel < h * 0.35 + 3) c = shade(band, -t * 0.3);
      p.set(x, y, grain(c, x, y, 0.08));
    }
  }
  p.ellipse(cx, top, r, ry, (x, y) => grain(shade(col, 0.18), x, y, 0.08));
  p.ellipse(cx, top, r - 1.5, ry - 0.8, shade(col, -0.3));
}

export type BuildingKind = 'hq' | 'power' | 'barracks' | 'refinery' | 'radar' | 'factory' | 'tower' | 'silo' | 'helipad';

export interface BuildingArt {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  // pad (foundation) relative to the bottom-centre anchor
  pad: { x: number; y: number; w: number; h: number };
}

export function makeBuilding(kind: BuildingKind, f: Faction): BuildingArt {
  let p: Pix;
  switch (kind) {
    case 'hq': {
      p = new Pix(56, 48);
      box(p, 3, 16, 50, 18, 13, CONC, CONC_D, true, 3);
      p.rect(3, 16, 50, 3, (x, y) => grain(f.main, x, y));
      p.rect(3, 31, 50, 2, f.dark);
      box(p, 18, 5, 20, 11, 9, f.main, shade(f.dark, 0.1), true, 4);
      p.rect(24, 34, 8, 10, WIN);
      p.rect(25, 35, 6, 1, HAZARD);
      p.ellipse(10, 23, 4, 3, CONC_D);
      p.ellipse(10, 23, 2, 1.5, METAL);
      for (let i = 0; i < 4; i++) p.rect(42 + (i % 2) * 4, 21 + Math.floor(i / 2) * 4, 3, 2, CONC_D);
      p.line(35, 0, 35, 6, GUN_D);
      p.set(35, 0, hex('#ff5a3c'));
      break;
    }
    case 'power': {
      p = new Pix(46, 44);
      box(p, 2, 22, 42, 10, 10, CONC, CONC_D, false);
      for (let x = 6; x < 42; x += 6) p.rect(x, 34, 3, 6, WIN);
      cylinder(p, 13, 6, 8, 26, CONC_L, f.main);
      cylinder(p, 33, 6, 8, 26, CONC_L, f.main);
      p.rect(20, 25, 6, 3, METAL);
      break;
    }
    case 'barracks': {
      p = new Pix(42, 32);
      for (let y = 5; y < 22; y++) {
        const t = (y - 5) / 17;
        const c = shade(mix(f.main, CONC, 0.35), 0.25 - t * 0.55);
        p.rect(3, y, 36, 1, (x, yy) => grain(x % 6 === 0 ? shade(c, -0.15) : c, x, yy, 0.08));
      }
      p.rect(3, 22, 36, 6, (x, y) => grain(CONC_D, x, y));
      p.rect(17, 22, 8, 6, WIN);
      p.rect(17, 22, 8, 1, HAZARD);
      p.rect(6, 24, 3, 2, WIN_LIT);
      p.rect(33, 24, 3, 2, WIN);
      break;
    }
    case 'refinery': {
      p = new Pix(56, 46);
      box(p, 2, 18, 34, 16, 11, CONC, CONC_D, false);
      p.rect(8, 36, 14, 9, WIN);
      for (let x = 8; x < 22; x += 2) p.set(x, 36, HAZARD);
      p.rect(4, 20, 30, 2, f.main);
      p.rect(24, 23, 9, 8, (x, y) => grain(METAL, x, y));
      cylinder(p, 45, 8, 9, 30, METAL, f.main);
      p.rect(34, 24, 3, 3, GUN);
      break;
    }
    case 'radar': {
      p = new Pix(36, 34);
      box(p, 4, 14, 28, 10, 9, CONC, CONC_D, true, 7);
      p.rect(4, 14, 28, 2, f.main);
      p.rect(17, 6, 2, 9, GUN);
      break;
    }
    case 'factory': {
      p = new Pix(64, 50);
      box(p, 2, 10, 60, 24, 14, shade(CONC, -0.05), CONC_D, false);
      p.rect(2, 10, 60, 3, f.main);
      for (let i = 0; i < 6; i++) p.rect(8 + i * 9, 17, 5, 3, CONC_D), p.rect(8 + i * 9, 17, 5, 1, CONC_L);
      p.rect(2, 26, 60, 2, f.dark);
      for (let y = 36; y < 48; y += 2) p.rect(22, y, 20, 1, y % 4 === 0 ? CONC_D : METAL);
      for (let x = 22; x < 42; x += 4) p.rect(x, 34, 2, 2, HAZARD), p.rect(x + 2, 34, 2, 2, TYRE);
      p.rect(6, 38, 3, 2, WIN_LIT);
      p.rect(54, 38, 3, 2, WIN);
      break;
    }
    case 'tower': {
      p = new Pix(22, 20);
      p.ellipse(11, 12, 9, 6, (x, y) => grain(CONC_D, x, y));
      p.ellipse(11, 10, 8, 5.5, (x, y) => grain(CONC, x, y));
      p.ellipse(11, 10, 5, 3.5, f.dark);
      break;
    }
    case 'silo': {
      p = new Pix(30, 30);
      cylinder(p, 9, 4, 6, 20, METAL, f.main);
      cylinder(p, 21, 9, 6, 16, METAL, f.main);
      break;
    }
    case 'helipad': {
      p = new Pix(30, 22);
      p.ellipse(15, 11, 14, 9, (x, y) => grain(CONC_D, x, y));
      p.ellipse(15, 10, 13, 8, (x, y) => grain(CONC, x, y));
      p.ellipse(15, 10, 9, 5.5, HAZARD);
      p.ellipse(15, 10, 8, 4.5, CONC);
      p.rect(11, 7, 1, 6, HAZARD);
      p.rect(19, 7, 1, 6, HAZARD);
      p.rect(11, 10, 9, 1, HAZARD);
      break;
    }
  }
  p.finish([22, 22, 18], 0.18, -0.25);
  const pads: Record<BuildingKind, [number, number]> = {
    hq: [62, 30],
    power: [50, 22],
    barracks: [46, 20],
    refinery: [60, 26],
    radar: [40, 20],
    factory: [70, 32],
    tower: [24, 14],
    silo: [32, 16],
    helipad: [32, 18],
  };
  const [pw, ph] = pads[kind];
  return { img: p.canvas(), w: p.w, h: p.h, pad: { x: -pw / 2, y: -ph + 4, w: pw, h: ph } };
}

// ---------- Props ----------

export function makeTrees(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  const greens = [hex('#2f5a2c'), hex('#25482a'), hex('#3b6b33')];
  for (let v = 0; v < 6; v++) {
    const p = new Pix(16, 22);
    const g = greens[v % 3];
    const tall = 14 + (v % 3) * 2;
    p.ellipse(10, 19.5, 6, 2.2, [0, 0, 0], 90);
    if (v < 4) {
      // pine: stacked tiers
      const top = 20 - tall;
      p.rect(7, 17, 2, 3, hex('#4a3523'));
      const tiers = 4;
      for (let t = 0; t < tiers; t++) {
        const y0 = top + t * (tall / tiers) * 0.8;
        const hgt = (tall / tiers) * 1.3;
        for (let y = 0; y < hgt; y++) {
          const half = 1 + ((y / hgt) * (2.5 + t * 1.1));
          for (let x = -half; x <= half; x++) {
            const sx = Math.round(8 + x);
            const sy = Math.round(y0 + y);
            const lit = x < -half * 0.3 ? 0.18 : x > half * 0.4 ? -0.25 : 0;
            p.set(sx, sy, shade(g, lit + (hash2(sx, sy, v) - 0.5) * 0.2));
          }
        }
      }
    } else {
      // broadleaf: lumpy crown
      p.rect(7, 15, 2, 5, hex('#4a3523'));
      const leaf = mix(g, hex('#5c7a2e'), 0.5);
      for (const [cx, cy, r] of [
        [8, 9, 5.5],
        [5, 11, 3.5],
        [11, 11, 4],
        [8, 6, 3.5],
      ] as const)
        p.ellipse(cx, cy, r, r * 0.9, (x, y) => shade(leaf, (x - 8) * -0.04 + (y - 9) * -0.03 + (hash2(x, y, v) - 0.5) * 0.25));
    }
    p.finish([12, 22, 12], 0.12, -0.2);
    out.push(p.canvas());
  }
  return out;
}

export function makeRocks(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let v = 0; v < 4; v++) {
    const p = new Pix(12, 9);
    const base = mix(hex('#8a8172'), hex('#6e6a60'), v / 3);
    p.ellipse(7, 6.5, 4.5, 2, [0, 0, 0], 70);
    p.ellipse(5.5, 4.5, 3 + (v % 2), 2.5, (x, y) => shade(base, (x - 5) * -0.06 + (y - 4) * -0.08 + (hash2(x, y, v + 20) - 0.5) * 0.2));
    if (v > 1) p.ellipse(8.5, 5, 2, 1.6, (x, y) => shade(base, -0.1 + (hash2(x, y, v) - 0.5) * 0.2));
    p.finish([30, 28, 24], 0.2, -0.25);
    out.push(p.canvas());
  }
  return out;
}

export function makeBushes(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let v = 0; v < 3; v++) {
    const p = new Pix(10, 8);
    const g = mix(hex('#3e6a2f'), hex('#56742f'), v / 2);
    p.ellipse(6, 6, 4, 1.5, [0, 0, 0], 70);
    p.ellipse(4, 4, 3, 2.4, (x, y) => shade(g, (hash2(x, y, v + 40) - 0.5) * 0.35));
    p.ellipse(6.5, 4.5, 2.5, 2, (x, y) => shade(g, -0.1 + (hash2(x, y, v + 41) - 0.5) * 0.35));
    p.finish([14, 24, 12], 0.2, -0.2);
    out.push(p.canvas());
  }
  return out;
}
