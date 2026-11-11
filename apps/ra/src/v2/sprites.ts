// Isometric art for v2: units, buildings and props as shaded voxel shapes.
import { RGB, hash2, hex, mix, shade } from '../gfx';
import { FACTIONS, Faction } from '../v1/sprites';
import { Shape, StackSprite, inBox, renderDirs, renderStack } from './stack';

export { FACTIONS };
export type { Faction };

export const DIRS = 32;

const TREAD = hex('#3a3833');
const TREAD_L = hex('#5c5950');
const WHEEL = hex('#26251f');
const HUB = hex('#7d7a70');
const GUN = hex('#4c4f51');
const GUN_D = hex('#2b2d2f');
const GLASS = hex('#86cde0');
const GLASS_D = hex('#2e5966');
const LAMP = hex('#f3e39a');
const CONC = hex('#9a968a');
const CONC_D = hex('#6d6a61');
const CONC_L = hex('#bdb8a9');
const TAR = hex('#4e4d48');
const METAL = hex('#a3a9ab');
const RUST = hex('#8a5a3a');
const WIN = hex('#1f292d');
const WIN_LIT = hex('#f0dc84');
const HAZ = hex('#e0b83c');
const BLACK = hex('#1c1b19');
const SKIN = hex('#dba97c');
const OLIVE = hex('#5a6b45');
const WOOD = hex('#7a5634');

const g = (c: RGB, u: number, v: number, z: number, k = 0.1, s = 1) => shade(c, (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 131, s) - 0.5) * k);

// ---------- Vehicles ----------

function tracks(u: number, v: number, z: number, hl: number, hw: number, tw: number, th: number): RGB | null {
  const av = Math.abs(v);
  if (av < hw - tw || av > hw || Math.abs(u) > hl) return null;
  // rounded front and back
  const end = hl - Math.abs(u);
  if (end < 1.5 && z > th - (1.5 - end) * 1.2) return null;
  if (z > th) return null;
  if (av > hw - 0.6 && z < th - 0.6) {
    // road wheels on the outer face
    const wu = ((u + 40) % 3.2) - 1.6;
    if (wu * wu + (z - th / 2) ** 2 < 1.4) return Math.abs(wu) < 0.5 && Math.abs(z - th / 2) < 0.5 ? HUB : WHEEL;
  }
  if (z > th - 0.6) return Math.floor(u * 1.5 + 40) % 2 ? TREAD : TREAD_L;
  return TREAD;
}

function tankHull(f: Faction, L: number, W: number, heavy: boolean): Shape {
  const hl = L / 2;
  const hw = W / 2;
  const th = heavy ? 3.5 : 3;
  const top = heavy ? 6 : 5;
  return (u, v, z) => {
    const t = tracks(u, v, z, hl, hw, heavy ? 3 : 2.4, th);
    if (t) return t;
    const av = Math.abs(v);
    // fenders over the tracks
    if (av <= hw && av > hw - (heavy ? 3 : 2.4) && z > th && z <= th + 0.7 && Math.abs(u) < hl - 0.5) return g(shade(f.main, -0.2), u, v, z);
    if (av > hw - (heavy ? 3 : 2.4) + 0.2) return null;
    if (z < 1.5) return null;
    // sloped glacis at the front, slight slope at the back
    let zt = top;
    if (u > hl - 4) zt = top - (u - (hl - 4)) * 0.8;
    if (u < -hl + 1.5) zt = top - (-hl + 1.5 - u) * 1.2;
    if (Math.abs(u) > hl || z > zt) return null;
    if (u > hl - 1 && z < zt && z > zt - 1 && av > hw - (heavy ? 4.5 : 4) && av < hw - (heavy ? 3.2 : 2.6)) return LAMP;
    let c = f.main;
    if (z > zt - 0.6) c = f.light;
    if (u < -hl + 4.5 && z > zt - 0.6 && av < hw - 4) c = Math.floor(u * 2) % 2 ? GUN_D : GUN; // engine grille
    if (heavy && Math.abs(u + 1) < 1 && av > 3 && av < 4.5 && z > zt - 0.6) c = WOOD; // stowage
    return g(c, u, v, z);
  };
}

function turretShape(f: Faction, r: number, z0: number, barrels: number, len: number): Shape {
  const h = r * 0.75;
  return (u, v, z) => {
    if (z < z0) return null;
    const bz = z0 + h * 0.5;
    const brl = (off: number) => u > r - 1 && u < len && (v - off) ** 2 + (z - bz) ** 2 < 0.55;
    if (barrels === 2 ? brl(1.1) || brl(-1.1) : brl(0)) return u > len - 1.5 ? GUN_D : GUN;
    if (barrels === 1 && u > len - 1.8 && u < len && v * v + (z - bz) ** 2 < 1.1) return GUN_D; // muzzle brake
    const du = u + 0.6;
    const d2 = du * du * 0.8 + v * v;
    const rr = r * r * (1 - ((z - z0) / (h + 0.5)) ** 2 * 0.35);
    if (d2 <= rr && z <= z0 + h) {
      if (z > z0 + h - 0.6) {
        if ((du + 1.3) ** 2 + (v + 0.8) ** 2 < 1.4) return shade(f.dark, -0.1); // hatch
        if (Math.abs(du - 0.8) < 0.5 && Math.abs(v - 1.5) < 0.5) return GLASS_D; // periscope
      }
      return g(z > z0 + h - 0.6 ? f.light : f.main, u, v, z);
    }
    // antenna
    if (Math.abs(du + r * 0.7) < 0.4 && Math.abs(v - r * 0.5) < 0.4 && z < z0 + h + 5) return GUN_D;
    return null;
  };
}

function buggy(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    // big wheels
    for (const wu of [-3.8, 3.8]) {
      const d = (u - wu) ** 2 + (z - 1.7) ** 2;
      if (av > 3.2 && av < 5 && d < 3) return d < 0.6 ? HUB : WHEEL;
    }
    if (Math.abs(u) > 6.3 || av > 3.6 || z < 1.6) return null;
    // windshield frame and roll bar
    if (u > 1.5 && u < 2.3 && z > 4 && z < 6.8 && av < 3) return z > 6 || av > 2.4 ? GUN_D : GLASS;
    if (u > -2.6 && u < -1.9 && z > 4 && z < 7 && (av > 2.6 || z > 6.3)) return GUN_D;
    // pintle gun
    if (Math.abs(u + 3.5) < 0.5 && av < 0.5 && z > 4 && z < 6.5) return GUN_D;
    if (u > -3.5 && u < 0.5 && av < 0.5 && Math.abs(z - 6.5) < 0.5) return GUN;
    let zt = 4;
    if (u > 3) zt = 4 - (u - 3) * 0.35;
    if (z > zt) return null;
    if (u > 6 && av > 2 && av < 3 && z > zt - 1.3) return LAMP;
    const seat = u > -1.8 && u < 1.4 && av < 2.6 && z > zt - 0.5;
    return g(seat ? BLACK : z > zt - 0.6 ? f.light : av > 3 ? f.dark : f.main, u, v, z);
  };
}

function hauler(f: Faction): Shape {
  const ore = hex('#c09443');
  return (u, v, z) => {
    const t = tracks(u, v, z, 11, 6, 2.2, 3);
    if (t) return t;
    const av = Math.abs(v);
    if (av > 4.2 || z < 1.5 || Math.abs(u) > 11) return null;
    // cab
    if (u > 4.5) {
      if (u > 10.5 || z > 9) return null;
      if (z > 5 && z < 8 && (u > 9.6 || av > 3.6) && !(u > 9.6 && av > 3.6)) return u > 9.6 ? GLASS : GLASS_D;
      if (u > 10 && z < 3.5 && av > 2.4 && av < 3.6) return LAMP;
      return g(z > 8.5 ? f.light : f.main, u, v, z);
    }
    if (u > 3.6) return z < 7 ? GUN_D : null;
    // ore bed with walls and a heap
    if (u < -10.5) return null;
    const wall = av > 3.4 || u < -9.6 || u > 2.8;
    if (wall && z <= 6.5) return g(z > 6 ? shade(METAL, 0.15) : Math.floor(u) % 3 === 0 ? shade(METAL, -0.2) : METAL, u, v, z, 0.12);
    const heap = 5.5 + 2 * Math.cos((u + 3.5) / 7) * Math.cos(v / 4) + (hash2(Math.floor(u * 2), Math.floor(v * 2), 3) - 0.5) * 0.8;
    if (z <= heap) return shade(ore, (hash2(Math.floor(u * 3), Math.floor(v * 3) + Math.floor(z * 3) * 77, 9) - 0.5) * 0.5);
    return null;
  };
}

function artillery(f: Faction): Shape {
  const hull = tankHull(f, 16, 12, false);
  return (u, v, z) => {
    // long barrel raised at an angle
    const t = Math.max(0, Math.min(1, ((u + 1) * 14 + (z - 7) * 5) / (14 * 14 + 5 * 5)));
    const bu = -1 + 14 * t;
    const bz = 7 + 5 * t;
    if ((u - bu) ** 2 + (z - bz) ** 2 + v * v < 0.7) return t > 0.92 ? GUN_D : GUN;
    // cradle
    if (Math.abs(u + 1) < 2.6 && Math.abs(v) < 2.6 && z > 5 && z < 8.2) return g(z > 7.6 ? f.light : METAL, u, v, z);
    if (Math.abs(v) > 1.5 && Math.abs(v) < 2.2 && u > -6 && u < -2 && z > 5 && z < 6.5) return GUN_D;
    return hull(u, v, z);
  };
}

function boat(f: Faction): Shape {
  const hull = hex('#a8aeb0');
  return (u, v, z) => {
    if (u < -13 || u > 15) return null;
    const hw = u > 5 ? 5.2 * Math.sqrt(Math.max(0, (15 - u) / 10)) : 5.2;
    const av = Math.abs(v);
    if (av > hw || z > 12) return null;
    if (z <= 3) {
      if (z < 1 && av > hw - 0.8) return shade(hull, -0.4);
      if (z > 2.4 && av > hw - 0.7) return METAL; // rail
      if (z > 2.4) return g(hex('#6d7275'), u, v, z, 0.08); // deck
      return g(z < 1.2 ? shade(hull, -0.25) : hull, u, v, z, 0.08);
    }
    // bridge
    if (u > -6 && u < 2 && av < 3 && z <= 7) {
      if (z > 5 && z < 6.5 && (u > 1.4 || av > 2.4)) return u > 1.4 ? GLASS : GLASS_D;
      return g(z > 6.5 ? f.light : f.main, u, v, z);
    }
    if (Math.abs(u + 2) < 0.4 && av < 0.4 && z < 12) return GUN_D; // mast
    if (Math.abs(u + 2) < 0.4 && av < 2 && Math.abs(z - 10) < 0.4) return GUN_D;
    // gun mount at the bow
    if ((u - 8) ** 2 + v * v < 3 && z < 5) return g(z > 4.4 ? f.light : f.dark, u, v, z);
    if (u > 8 && u < 13 && av < 0.5 && Math.abs(z - 4.3) < 0.5) return GUN;
    // stern deck gear
    if (u < -9 && u > -11.5 && av < 2 && z < 4.5) return g(f.dark, u, v, z);
    return null;
  };
}

function heli(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    const e = (u - 1) ** 2 / 36 + v * v / 7 + (z - 3.6) ** 2 / 7;
    if (e <= 1) {
      if (u > 3.2 && z > 3.4) return u > 5 ? GLASS : GLASS_D;
      if (z > 5.6 && av < 1.2 && u > -3 && u < 2) return GUN_D; // engine
      return g(z < 2.6 ? f.dark : f.main, u, v, z);
    }
    if (u > -13 && u < -4 && av < 0.9 && z > 3.5 && z < 5.2) return g(f.main, u, v, z);
    if (u > -14.5 && u < -12 && av < 0.5 && z > 3.5 && z < 9) return g(f.dark, u, v, z);
    if (u > -14.5 && u < -12.5 && av < 2.6 && Math.abs(z - 4.5) < 0.5) return f.dark;
    // skids and struts
    if (u > -3 && u < 6 && av > 2.6 && av < 3.4 && z < 0.8) return GUN_D;
    if ((Math.abs(u + 1.5) < 0.4 || Math.abs(u - 3.5) < 0.4) && av > 1.6 && av < 3.2 && z < 2) return GUN_D;
    // rocket pods
    if (u > -1 && u < 3.5 && av > 3.2 && av < 4.4 && Math.abs(z - 3) < 0.8) return u > 3 ? BLACK : OLIVE;
    return null;
  };
}

function soldier(f: Faction, rocket: boolean, frame: number): Shape {
  const body = rocket ? mix(f.main, OLIVE, 0.4) : f.main;
  const step = frame === 0 ? 0 : frame === 1 ? 0.9 : -0.9;
  return (u, v, z) => {
    const av = Math.abs(v);
    // legs
    if (z < 3.2) {
      const legU = v > 0 ? step : -step;
      if (Math.abs(u - legU * (z < 1.6 ? 1 : 0.5)) < 0.6 && av > 0.2 && av < 1.3) return z < 0.8 ? BLACK : shade(f.dark, -0.15);
      return null;
    }
    if (z < 6.3 && Math.abs(u) < 0.9 && av < 1.4) return g(z > 5.7 ? shade(body, 0.1) : body, u, v, z, 0.1);
    if (z < 6 && z > 4 && Math.abs(u - 0.3) < 0.6 && av >= 1.4 && av < 2) return z < 4.6 ? SKIN : body; // arms
    if (z >= 6.3 && z < 8.4 && u * u + v * v < 1.1) return z > 7.5 || u < -0.3 ? shade(f.dark, 0.05) : SKIN;
    if (rocket) {
      if (u > -2.5 && u < 3 && (v - 1.4) ** 2 + (z - 7) ** 2 < 0.5) return u > 2.4 ? BLACK : OLIVE;
    } else if (u > 0.5 && u < 3.8 && Math.abs(v - 1) < 0.45 && Math.abs(z - 5.2) < 0.45) return GUN_D;
    return null;
  };
}

// The Mobile Foundry: a long tracked carrier with a cab, a boxy works module
// and a crane folded flat along the top. It deploys into the Foundry.
function foundryVehicle(f: Faction): Shape {
  return (u, v, z) => {
    const t = tracks(u, v, z, 15, 9, 3, 3.5);
    if (t) return t;
    const av = Math.abs(v);
    if (av <= 9 && av > 6 && z > 3.5 && z <= 4.2 && Math.abs(u) < 14.5) return g(shade(f.main, -0.25), u, v, z);
    if (av > 6.2 || z < 1.5 || Math.abs(u) > 15) return null;
    // folded crane: boom along the top, its slewing ring at the back
    if (Math.abs(v - 3) < 1 && u > -12 && u < 11 && z > 12 && z <= 13.6) return (Math.floor(u + 40) % 3 === 0 ? GUN_D : HAZ);
    if (cyl(u, v, -9, 3, 2.2) && z > 11.5 && z <= 14.5) return g(z > 14 ? METAL : GUN, u, v, z);
    // exhaust stack
    if (cyl(u, v, -1, -4.2, 0.9) && z <= 16) return z > 15.3 ? BLACK : GUN_D;
    // cab
    if (u > 8) {
      if (u > 14 || av > 5 || z > 11) return u <= 14.5 && z <= 6 && av <= 6 ? g(f.dark, u, v, z) : null;
      if (z > 7 && z < 10 && (u > 13.4 || av > 4.4)) return u > 13.4 ? GLASS : GLASS_D;
      if (u > 13.4 && z < 5 && av > 3 && av < 4.4) return LAMP;
      return g(z > 10.4 ? f.light : f.main, u, v, z);
    }
    // the works module
    if (u > -14 && av <= 5.6 && z <= 12) {
      if (z > 11.4) return g(Math.abs(v + 2.5) < 1.6 && Math.abs(u + 3) < 3 ? GUN_D : f.light, u, v, z);
      if (z > 8 && z < 9.4) return Math.floor((u + v) / 1.5 + 40) % 2 ? HAZ : BLACK;
      if (av > 5 && Math.abs(u + 3) < 4 && z > 3 && z < 7.5) return Math.floor(z) % 2 ? shade(METAL, -0.2) : METAL; // shutter
      return g(z < 4 ? f.dark : f.main, u, v, z);
    }
    if (z <= 6) return g(f.dark, u, v, z);
    return null;
  };
}

export interface V2FactionArt {
  mcv: StackSprite[];
  lightTank: StackSprite[];
  lightTurret: StackSprite[];
  heavyTank: StackSprite[];
  heavyTurret: StackSprite[];
  buggy: StackSprite[];
  hauler: StackSprite[];
  artillery: StackSprite[];
  boat: StackSprite[];
  heli: StackSprite[];
  towerGun: StackSprite[];
  infantry: StackSprite[][]; // [frame][dir]
  rocket: StackSprite[][];
}

export function makeFactionArt(f: Faction): V2FactionArt {
  const inf = (rocket: boolean) => [0, 1, 2].map((fr) => renderDirs(soldier(f, rocket, fr), 16, { r: 4, zmax: 9, step: 0.5, bakeShadow: true }));
  return {
    mcv: renderDirs(foundryVehicle(f), DIRS, { r: 17.5, zmax: 17, bakeShadow: true }),
    lightTank: renderDirs(tankHull(f, 16, 12, false), DIRS, { r: 10.5, zmax: 6, bakeShadow: true }),
    lightTurret: renderDirs(turretShape(f, 3.6, 5, 1, 11), DIRS, { r: 11.5, zmax: 14 }),
    heavyTank: renderDirs(tankHull(f, 20, 15, true), DIRS, { r: 13, zmax: 7, bakeShadow: true }),
    heavyTurret: renderDirs(turretShape(f, 4.8, 6, 2, 13), DIRS, { r: 13.5, zmax: 16 }),
    buggy: renderDirs(buggy(f), DIRS, { r: 8, zmax: 8, bakeShadow: true }),
    hauler: renderDirs(hauler(f), DIRS, { r: 12.5, zmax: 10, bakeShadow: true }),
    artillery: renderDirs(artillery(f), DIRS, { r: 13.5, zmax: 13, bakeShadow: true }),
    boat: renderDirs(boat(f), DIRS, { r: 15.5, zmax: 12, bakeShadow: true, shadowAlpha: 0.2 }),
    heli: renderDirs(heli(f), DIRS, { r: 15, zmax: 10 }),
    towerGun: renderDirs(turretShape(f, 4, 0, 2, 11), DIRS, { r: 11.5, zmax: 9 }),
    infantry: inf(false),
    rocket: inf(true),
  };
}

// ---------- Buildings ----------

export type BuildingKind = 'yard' | 'hq' | 'power' | 'barracks' | 'refinery' | 'radar' | 'factory' | 'tower' | 'silo' | 'helipad';

export interface V2BuildingArt {
  spr: StackSprite;
  rx: number; // half footprint in world units
  ry: number;
  fx: { x: number; y: number; z: number }[]; // effect anchors (smoke, lights, dish, gun)
}

// Windows on the two visible faces of a box (+x face and +y face).
function windows(u: number, v: number, z: number, x1: number, y1: number, z0: number, z1: number, seed: number): RGB | null {
  if (z < z0 + 1.5 || z > z1 - 1.5) return null;
  const onX = u > x1 - 0.6;
  const onY = v > y1 - 0.6;
  if (!onX && !onY) return null;
  const along = onX ? v : u;
  const zz = z - z0;
  if (((along % 5) + 5) % 5 < 2.2 && zz % 5 > 1.6 && zz % 5 < 3.8) {
    return hash2(Math.floor(along / 5), Math.floor(zz / 5) + (onX ? 50 : 0), seed) < 0.3 ? WIN_LIT : WIN;
  }
  return null;
}

function cyl(u: number, v: number, cu: number, cv: number, r: number) {
  return (u - cu) ** 2 + (v - cv) ** 2 <= r * r;
}

function buildingShape(kind: BuildingKind, f: Faction): { shape: Shape; rx: number; ry: number; zmax: number; fx: V2BuildingArt['fx'] } {
  switch (kind) {
    case 'yard': {
      // The Foundry: a works hall with a big door, a tower crane over the
      // apron and stacks of parts waiting to be put together.
      const shape: Shape = (u, v, z) => {
        // tower crane: lattice mast, cab, boom, counterweight, cable and hook
        if (Math.abs(u - 13) < 1.6 && Math.abs(v + 13) < 1.6 && z < 29) {
          const edge = Math.abs(u - 13) > 1 || Math.abs(v + 13) > 1;
          if (edge && (Math.abs(Math.abs(u - 13) - Math.abs(v + 13)) < 0.5 || Math.floor(z) % 3 === 0)) return HAZ;
          return null;
        }
        if (inBox(u, v, z, 11, 15.5, -15, -11, 26, 29.5)) return z > 29 ? f.light : u > 15 ? GLASS : g(f.main, u, v, z);
        if (Math.abs(v + 13) < 0.8 && u > 4 && u < 24 && z > 29.5 && z < 31) return Math.floor(u + 40) % 2 ? HAZ : GUN_D;
        if (inBox(u, v, z, 4, 7, -14.5, -11.5, 27, 30)) return g(CONC_D, u, v, z);
        if (Math.abs(u - 21) < 0.4 && Math.abs(v + 13) < 0.4 && z > 17 && z < 30) return GUN_D;
        if (inBox(u, v, z, 20, 22, -14, -12, 15, 17)) return HAZ;
        // works hall
        if (inBox(u, v, z, -21, 6, -19, 4, 0, 15)) {
          if (v > 3.4 && Math.abs(u + 7) < 7 && z < 10) {
            if (Math.abs(u + 7) > 6.2 || z > 9.2) return (Math.floor(u + z) & 2) ? HAZ : BLACK;
            return Math.floor(z) % 2 ? shade(METAL, -0.25) : METAL;
          }
          const w = windows(u, v, z, 6, 4, 0, 15, 21);
          if (w && z > 9) return w;
          if (z > 14.4) {
            if (Math.abs(u + 7) < 9 && Math.abs(v + 7.5) < 5) return ((Math.floor(u / 2) & 1) ? GLASS_D : shade(GLASS_D, 0.2)); // skylight
            return g(Math.abs(u + 7) < 2 ? f.main : CONC_L, u, v, z, 0.08);
          }
          if (z > 11 && z < 12.6) return g(f.main, u, v, z);
          if (z < 1) return CONC_D;
          return g(CONC, u, v, z, 0.08);
        }
        // a stack of parts on the apron
        if (inBox(u, v, z, 10, 16, 7, 13, 0, 4)) return g(z > 3.4 ? shade(f.main, 0.1) : f.dark, u, v, z);
        if (inBox(u, v, z, 11, 15, 8, 12, 4, 7)) return g(z > 6.4 ? METAL : GUN, u, v, z);
        if (inBox(u, v, z, 17, 22, 9, 13, 0, 3)) return g(z > 2.4 ? WOOD : shade(WOOD, -0.2), u, v, z);
        // the apron: concrete with a hazard edge
        if (Math.abs(u) <= 24 && Math.abs(v) <= 22 && z < 1) {
          if (Math.abs(u) > 23 || Math.abs(v) > 21) return Math.floor((u + v) / 2 + 40) % 2 ? HAZ : BLACK;
          return g(CONC, u, v, z, 0.12);
        }
        return null;
      };
      return { shape, rx: 24, ry: 22, zmax: 32, fx: [{ x: 23, y: -13, z: 31 }, { x: 21, y: -13, z: 17 }] };
    }
    case 'hq': {
      const shape: Shape = (u, v, z) => {
        // antenna mast and dish
        if (Math.abs(u - 4) < 0.5 && Math.abs(v + 6) < 0.5 && z < 36) return z > 35 ? hex('#ff5a3c') : GUN_D;
        if (Math.abs(u - 4) < 2.2 && Math.abs(v + 6) < 0.4 && Math.abs(z - 30) < 0.4) return GUN_D;
        if ((u + 10) ** 2 + (v + 8) ** 2 < 9 && z > 22 && z < 24 - Math.hypot(u + 10, v + 8) * 0.5) return METAL;
        // tower block
        if (inBox(u, v, z, -14, 8, -14, 0, 0, 22)) {
          const w = windows(u, v, z, 8, 0, 12, 22, 4);
          if (w) return w;
          if (z > 21.4) return g(f.main, u, v, z);
          if (z > 19.5) return g(f.dark, u, v, z);
          return g(CONC_L, u, v, z, 0.08);
        }
        // main block
        if (inBox(u, v, z, -20, 20, -16, 16, 0, 12)) {
          const w = windows(u, v, z, 20, 16, 0, 12, 3);
          // entrance on the +y face
          if (v > 15.4 && Math.abs(u - 4) < 4 && z < 7) return z > 6.3 ? HAZ : WIN;
          if (w) return w;
          if (z > 11.4) {
            // roof: tar with a grid and AC units handled below
            if (Math.abs(u) > 18.5 || Math.abs(v) > 14.5) return g(CONC_L, u, v, z, 0.06);
            return g(((Math.floor(u / 4) + Math.floor(v / 4)) & 1) ? TAR : shade(TAR, 0.08), u, v, z, 0.1);
          }
          if (z > 9 && z < 10.5) return g(f.main, u, v, z);
          if (z < 1) return CONC_D;
          return g(CONC, u, v, z, 0.08);
        }
        // awning over the door
        if (inBox(u, v, z, -0.5, 8.5, 16, 19, 6.5, 7.5)) return g(f.main, u, v, z);
        // roof clutter
        if (inBox(u, v, z, 10, 15, 4, 9, 12, 14.5)) return z > 14 ? (Math.floor(u * 2) % 2 ? GUN_D : METAL) : g(METAL, u, v, z);
        if (inBox(u, v, z, 12, 17, -10, -6, 12, 13.5)) return g(CONC_D, u, v, z);
        return null;
      };
      return { shape, rx: 21, ry: 20, zmax: 37, fx: [{ x: 4, y: -6, z: 36 }] };
    }
    case 'power': {
      const tower = (u: number, v: number, z: number, cu: number, cv: number) => {
        const d = Math.hypot(u - cu, v - cv);
        const r = 8 - 2.2 * Math.sin((Math.PI * Math.min(z, 26)) / 30);
        if (z > 26 || d > r) return null;
        if (z > 25.4 || d > r - 1.4) {
          if (z > 25.4 && d < r - 1.4) return null;
          let c = CONC_L;
          if (z > 18 && z < 21) c = f.main;
          if (z < 2) c = CONC_D;
          return g(c, u, v, z, 0.08);
        }
        return z > 23 ? hex('#30302c') : null;
      };
      const shape: Shape = (u, v, z) => {
        const t = tower(u, v, z, -7, -5) ?? tower(u, v, z, 10, -5);
        if (t) return t;
        if (inBox(u, v, z, -18, 18, 3, 13, 0, 9)) {
          if (v > 12.4 && z < 6 && ((u + 40) % 7) < 3) return z > 5.4 ? HAZ : WIN;
          if (z > 8.4) return g(Math.abs(u) < 3 ? f.main : CONC, u, v, z, 0.08);
          return g(CONC, u, v, z, 0.08);
        }
        // pipes linking the towers
        if (Math.abs(v + 5) < 1 && u > -1 && u < 3 && Math.abs(z - 6) < 1) return METAL;
        if (Math.abs(u - 1.5) < 1 && v > -5 && v < 3 && Math.abs(z - 6) < 1) return METAL;
        // transformer
        if (inBox(u, v, z, 13, 18, 13.5, 17, 0, 5)) return z > 4.4 ? GUN_D : (Math.floor(u) % 2 ? METAL : shade(METAL, -0.2));
        return null;
      };
      return { shape, rx: 19, ry: 17, zmax: 27, fx: [{ x: -7, y: -5, z: 26 }, { x: 10, y: -5, z: 26 }] };
    }
    case 'barracks': {
      const R = 9;
      const shape: Shape = (u, v, z) => {
        if (Math.abs(u) <= 14 && v * v + z * z <= R * R) {
          if (u > 13.4) {
            // end wall with door
            if (Math.abs(v) < 2.5 && z < 6) return z > 5.4 ? HAZ : WIN;
            if (Math.abs(v - 5) < 1 && Math.abs(z - 4) < 1) return WIN_LIT;
            return g(CONC_D, u, v, z);
          }
          const rib = ((u + 40) % 4) < 0.7;
          const c = mix(f.main, CONC, 0.4);
          return g(rib ? shade(c, -0.2) : c, u, v, z, 0.08);
        }
        // sandbags along the front
        if (v > 10 && v < 12 && u > -12 && u < 8 && z < 2.4) {
          const bag = Math.floor((u + 40) / 2) + Math.floor(z / 1.2);
          return shade(hex('#a8956a'), bag % 2 ? -0.1 : 0.05);
        }
        // flagpole
        if (Math.abs(u - 15.5) < 0.4 && Math.abs(v - 9) < 0.4 && z < 22) return GUN_D;
        return null;
      };
      return { shape, rx: 16, ry: 12, zmax: 22, fx: [{ x: 15.5, y: 9, z: 21 }] };
    }
    case 'refinery': {
      const shape: Shape = (u, v, z) => {
        // big tank with a dome
        const d = Math.hypot(u - 12, v + 4);
        if (d <= 9 && z <= 20 + Math.sqrt(Math.max(0, 81 - d * d)) * 0.35) {
          if (z > 20) return g(METAL, u, v, z, 0.06);
          if (z > 12 && z < 15) return g(f.main, u, v, z);
          if ((u - 12) > 0 && Math.abs(v + 4 - 8.4) < 0.6 && Math.floor(z) % 2 === 0) return GUN_D; // ladder rungs
          return g(((Math.floor(z / 4)) & 1) ? METAL : shade(METAL, -0.06), u, v, z, 0.06);
        }
        // processing hall
        if (inBox(u, v, z, -20, 3, -14, 14, 0, 12)) {
          if (v > 13.4 && u > -16 && u < -4 && z < 8) return z > 7.2 ? HAZ : Math.floor(z) % 2 ? shade(METAL, -0.3) : METAL;
          const w = windows(u, v, z, 3, 14, 0, 12, 11);
          if (w && z > 7) return w;
          if (z > 11.4) return g(Math.abs(v) < 2 ? f.main : CONC_L, u, v, z, 0.08);
          return g(CONC, u, v, z, 0.08);
        }
        // pipes and a chimney
        if (Math.abs(v + 4) < 1 && u > 2 && u < 4 && z > 6 && z < 9) return METAL;
        if (cyl(u, v, -16, -10, 1.5) && z < 20) return z > 18 ? f.main : g(CONC_D, u, v, z);
        // ore unloading pad
        if (inBox(u, v, z, 5, 20, 7, 15, 0, 1)) return Math.floor(u / 2 + v / 2) % 2 ? HAZ : BLACK;
        return null;
      };
      return { shape, rx: 21, ry: 16, zmax: 24, fx: [{ x: -16, y: -10, z: 20 }] };
    }
    case 'radar': {
      const shape: Shape = (u, v, z) => {
        if (inBox(u, v, z, -10, 10, -8, 8, 0, 9)) {
          const w = windows(u, v, z, 10, 8, 0, 9, 7);
          if (w) return w;
          if (z > 8.4) return g(Math.abs(u) < 3 && Math.abs(v) < 3 ? GUN_D : f.main, u, v, z);
          return g(CONC, u, v, z, 0.08);
        }
        // lattice mast
        if (Math.abs(u) < 1.6 && Math.abs(v) < 1.6 && z < 19) {
          const edge = Math.abs(u) > 1 || Math.abs(v) > 1;
          if (edge && (Math.abs(Math.abs(u) - Math.abs(v)) < 0.5 || Math.floor(z) % 3 === 0)) return GUN;
          return null;
        }
        return null;
      };
      return { shape, rx: 11, ry: 9, zmax: 20, fx: [{ x: 0, y: 0, z: 21 }] };
    }
    case 'factory': {
      const shape: Shape = (u, v, z) => {
        if (inBox(u, v, z, -26, 26, -18, 18, 0, 22)) {
          // saw-tooth roof
          const s = ((u + 26) % 10) / 10;
          const roof = 16 + s * 5;
          if (z > roof) return null;
          if (z > 16 && s > 0.85 && Math.abs(v) < 16) return GLASS_D; // skylights on the steep side
          if (z > 16) return g(Math.abs(v) > 16.5 ? CONC_D : shade(METAL, -0.1 + s * 0.15), u, v, z, 0.06);
          // big door on the +y face
          if (v > 17.4 && Math.abs(u + 2) < 9 && z < 12) {
            if (Math.abs(u + 2) > 8 || z > 11) return ((Math.floor(u + z) & 2) ? HAZ : BLACK);
            return Math.floor(z) % 2 ? shade(METAL, -0.25) : METAL;
          }
          const w = windows(u, v, z, 26, 18, 0, 13, 13);
          if (w && !(v > 17.4)) return w;
          if (z > 13 && z < 15.5) return g(f.main, u, v, z);
          if (z < 1) return CONC_D;
          return g(CONC, u, v, z, 0.08);
        }
        // roof vents
        if (cyl(u, v, -18, -8, 1.6) && z < 25) return z > 24 ? GUN_D : METAL;
        if (cyl(u, v, 12, -8, 1.6) && z < 25) return z > 24 ? GUN_D : METAL;
        return null;
      };
      return { shape, rx: 27, ry: 19, zmax: 26, fx: [{ x: -18, y: -8, z: 25 }, { x: 12, y: -8, z: 25 }] };
    }
    case 'tower': {
      const shape: Shape = (u, v, z) => {
        const oct = Math.max(Math.abs(u), Math.abs(v), (Math.abs(u) + Math.abs(v)) * 0.72);
        if (oct < 7.5 && z < 5) {
          if (z > 4.4) return g(oct < 4.5 ? f.dark : CONC_L, u, v, z);
          return g(z < 1 ? CONC_D : CONC, u, v, z, 0.08);
        }
        return null;
      };
      return { shape, rx: 8, ry: 8, zmax: 6, fx: [{ x: 0, y: 0, z: 5 }] };
    }
    case 'silo': {
      const silo = (u: number, v: number, z: number, cu: number, cv: number, h: number) => {
        const d = Math.hypot(u - cu, v - cv);
        if (d > 5.5 || z > h + Math.sqrt(Math.max(0, 30 - d * d)) * 0.6) return null;
        if (z > h) return g(METAL, u, v, z, 0.06);
        if (z > h * 0.5 && z < h * 0.5 + 2.5) return g(f.main, u, v, z);
        if (u - cu > 0 && Math.abs(v - cv - 4.5) < 0.6 && Math.floor(z) % 2 === 0) return GUN_D;
        return g(METAL, u, v, z, 0.06);
      };
      const shape: Shape = (u, v, z) => silo(u, v, z, -5, -3, 18) ?? silo(u, v, z, 6, 3, 14);
      return { shape, rx: 12, ry: 10, zmax: 23, fx: [] };
    }
    case 'helipad': {
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        if (d > 12 || z > 1) return null;
        if (d > 11) return CONC_D;
        if (Math.abs(d - 9) < 0.7) return HAZ;
        if ((Math.abs(u + 3) < 0.8 || Math.abs(u - 3) < 0.8) && Math.abs(v) < 4) return HAZ;
        if (Math.abs(u) < 3 && Math.abs(v) < 0.8) return HAZ;
        return g(CONC, u, v, z, 0.1);
      };
      return { shape, rx: 12, ry: 12, zmax: 2, fx: [] };
    }
  }
}

export function makeBuilding(kind: BuildingKind, f: Faction): V2BuildingArt {
  const b = buildingShape(kind, f);
  const spr = renderStack(b.shape, { r: 0, rx: b.rx, ry: b.ry, zmax: b.zmax, bakeShadow: true, step: 0.5, shadowAlpha: 0.32 });
  return { spr, rx: b.rx, ry: b.ry, fx: b.fx };
}

export function makeDish(): StackSprite[] {
  const dish: Shape = (u, v, z) => {
    // a tilted parabolic dish facing +u
    const zz = z - 4;
    const r2 = v * v + zz * zz;
    if (r2 > 30) {
      return Math.abs(u) < 0.5 && Math.abs(v) < 0.5 && z < 4 ? GUN_D : null;
    }
    const surf = -2 + r2 * 0.07;
    if (Math.abs(u - surf) < 0.6) return shade(CONC_L, -Math.sqrt(r2) * 0.03);
    if (Math.abs(u - 2) < 0.5 && v * v + zz * zz < 0.6) return GUN_D;
    if (u > 0 && u < 2 && Math.abs(v) < 0.3 && Math.abs(zz) < 0.3) return GUN_D;
    return null;
  };
  return renderDirs(dish, 16, { r: 6.5, zmax: 10, outline: [30, 30, 28] });
}

// ---------- Props ----------

export function makeTrees(): StackSprite[] {
  const out: StackSprite[] = [];
  const greens = [hex('#2f5a2c'), hex('#26492a'), hex('#3a6a33'), hex('#335f2e')];
  const trunk = hex('#55402a');
  for (let vnt = 0; vnt < 8; vnt++) {
    const base = greens[vnt % 4];
    let shape: Shape;
    let zmax: number;
    if (vnt < 5) {
      const H = 15 + (vnt % 3) * 3;
      zmax = H + 1;
      shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        if (z < 3) return d < 0.9 ? trunk : null;
        // tiers: radius shrinks within each tier and overall with height
        const tiers = 4;
        const tz = (z - 3) / (H - 3);
        if (tz > 1) return null;
        const within = (tz * tiers) % 1;
        const r = (1 - tz) * 5.5 * (0.55 + 0.45 * (1 - within)) + 0.4;
        const jag = (hash2(Math.floor(Math.atan2(v, u) * 3), Math.floor(z), vnt) - 0.5) * 0.9;
        if (d > r + jag) return null;
        const edge = d > r - 1;
        return shade(base, (edge ? -0.05 : -0.18) + within * 0.12 + (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z) * 31, vnt) - 0.5) * 0.25);
      };
    } else {
      zmax = 14;
      const leaf = mix(base, hex('#5f7d30'), 0.45);
      const blobs: [number, number, number, number][] = [
        [0, 0, 8, 4.6],
        [-2.5, 1.5, 6.5, 3.2],
        [2.2, -1.5, 7, 3.4],
        [0.5, 0.8, 10.5, 3],
      ];
      shape = (u, v, z) => {
        if (z < 5) return Math.hypot(u, v) < 0.9 ? trunk : null;
        for (const [bu, bv, bz, r] of blobs) {
          const n = (hash2(Math.floor(u * 1.5), Math.floor(v * 1.5) + Math.floor(z * 1.5) * 17, vnt) - 0.5) * 1.2;
          if ((u - bu) ** 2 + (v - bv) ** 2 + ((z - bz) * 1.15) ** 2 < (r + n) ** 2) return shade(leaf, (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 7, vnt + 3) - 0.5) * 0.3);
        }
        return null;
      };
    }
    out.push(renderStack(shape, { r: 6.5, zmax, bakeShadow: true, step: 0.5, outline: [12, 22, 12], shadowAlpha: 0.3 }));
  }
  return out;
}

export function makeRocks(): StackSprite[] {
  const out: StackSprite[] = [];
  for (let vnt = 0; vnt < 4; vnt++) {
    const base = mix(hex('#8f8676'), hex('#6c675d'), vnt / 3);
    const s = 1.6 + (vnt % 2) * 1.2;
    out.push(
      renderStack(
        (u, v, z) => {
          const n = (hash2(Math.floor(u * 1.5), Math.floor(v * 1.5) + Math.floor(z * 1.5) * 9, vnt + 60) - 0.5) * 0.9;
          if ((u / (s * 1.4)) ** 2 + (v / s) ** 2 + (z / (s * 0.8)) ** 2 < 1 + n * 0.4) return shade(base, (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 5, vnt) - 0.5) * 0.25);
          return null;
        },
        { r: 4.5, zmax: 4, bakeShadow: true, outline: [30, 28, 24] },
      ),
    );
  }
  return out;
}

export function makeBushes(): StackSprite[] {
  const out: StackSprite[] = [];
  for (let vnt = 0; vnt < 3; vnt++) {
    const base = mix(hex('#3e6a2f'), hex('#5a7a30'), vnt / 2);
    out.push(
      renderStack(
        (u, v, z) => {
          const n = (hash2(Math.floor(u * 1.5), Math.floor(v * 1.5) + Math.floor(z * 1.5) * 9, vnt + 80) - 0.5) * 1;
          if (u * u + v * v + (z * 1.4) ** 2 < (2.8 + n) ** 2) {
            if (vnt === 2 && hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 3, 4) > 0.93) return hex('#e9d36a');
            return shade(base, (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 5, vnt) - 0.5) * 0.35);
          }
          return null;
        },
        { r: 4, zmax: 4, bakeShadow: true, outline: [14, 24, 12] },
      ),
    );
  }
  return out;
}

export function makeClutter(): StackSprite[] {
  // crates, barrels and a sandbag nest for around the bases
  const crate: Shape = (u, v, z) => {
    if (Math.abs(u) > 2 || Math.abs(v) > 2 || z > 3.5) return null;
    const edge = Math.abs(u) > 1.5 || Math.abs(v) > 1.5 || z > 3;
    return shade(WOOD, edge ? -0.2 : (hash2(Math.floor(u * 3), Math.floor(z * 3), 1) - 0.5) * 0.15);
  };
  const crates: Shape = (u, v, z) => crate(u - 1.8, v + 1, z) ?? crate(u + 2.2, v - 1.5, z) ?? crate(u - 0.5, v - 0.2, z - 3.5);
  const barrels: Shape = (u, v, z) => {
    for (const [bu, bv] of [
      [0, 0],
      [2.6, 0.8],
      [0.8, 2.6],
    ]) {
      const d = Math.hypot(u - bu, v - bv);
      if (d < 1.2 && z < 3.2) return z > 2.8 ? shade(RUST, -0.2) : Math.abs(z - 1) < 0.25 || Math.abs(z - 2.2) < 0.25 ? shade(RUST, -0.25) : RUST;
    }
    return null;
  };
  const sandbags: Shape = (u, v, z) => {
    const d = Math.hypot(u, v);
    if (d < 3.5 || d > 5.5 || z > 2.4 || (u > 2 && Math.abs(v) < 2)) return null;
    const bag = Math.floor(Math.atan2(v, u) * 3) + Math.floor(z / 1.2);
    return shade(hex('#a8956a'), bag % 2 ? -0.12 : 0.04);
  };
  return [crates, barrels, sandbags].map((s) => renderStack(s, { r: 6, zmax: 7, bakeShadow: true, outline: [28, 24, 18] }));
}
