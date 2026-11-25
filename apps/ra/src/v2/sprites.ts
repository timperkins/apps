// Isometric art: units, buildings and props as shaded voxel shapes.
// Everything is modelled in world units (one unit is one pixel across the
// ground) down to half a unit, which is the finest the renderer samples.
import { RGB, dirIndex, hash2, hex, mix, rng, shade, vnoise } from '../gfx';
import { FACTIONS, Faction } from '../factions';
import { Shape, StackOpts, StackSprite, columnMap, inBox, renderDirs, renderStack, toScreen } from './stack';

export { FACTIONS };
export type { Faction };

export const DIRS = 32;

const TREAD = hex('#3a3833');
const TREAD_L = hex('#615d53');
const TREAD_D = hex('#22211e');
const WHEEL = hex('#2b2a25');
const HUB = hex('#8a877c');
const GUN = hex('#4f5356');
const GUN_L = hex('#73787b');
const GUN_D = hex('#2b2d2f');
const GLASS = hex('#86cde0');
const GLASS_L = hex('#c9ecf4');
const GLASS_D = hex('#2e5966');
const LAMP = hex('#f6e8a4');
const TAIL = hex('#d8452f');
const CONC = hex('#9a968a');
const CONC_D = hex('#6d6a61');
const CONC_L = hex('#bdb8a9');
const TAR = hex('#4e4d48');
const METAL = hex('#a3a9ab');
const METAL_D = hex('#757c80');
const STEEL = hex('#c3c9ca');
const RUST = hex('#8a5a3a');
const WIN = hex('#1f292d');
const WIN_B = hex('#35505c');
const WIN_LIT = hex('#f0dc84');
const HAZ = hex('#e0b83c');
const BLACK = hex('#1c1b19');
const WHITE = hex('#e6e2d4');
const SKIN = hex('#dba97c');
const OLIVE = hex('#5a6b45');
const OLIVE_D = hex('#3f4c31');
const WOOD = hex('#7a5634');
const WOOD_L = hex('#9c7446');
const SAND_BAG = hex('#a8956a');
const RED = hex('#ff5a3c');
const BRICK = hex('#8c5b48');
const COPPER = hex('#b3703f');

const rnd = (u: number, v: number, z: number, s: number) => hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 131, s);
// A little grain, so big surfaces aren't flat fills.
const g = (c: RGB, u: number, v: number, z: number, k = 0.06, s = 1) => shade(c, (rnd(u, v, z, s) - 0.5) * k);
// Streaks of grime running down a wall, heavier towards the ground.
const grime = (c: RGB, along: number, z: number, h: number, s: number) => {
  const st = hash2(Math.floor(along * 1.5), 7, s);
  const reach = st > 0.72 ? (st - 0.72) * 3.2 * h : 0;
  return shade(c, (z < 1.2 ? -0.1 : 0) + (z > h - reach ? -0.09 : 0));
};
const mod = (a: number, n: number) => ((a % n) + n) % n;
const hazard = (a: number, b: number) => (mod(Math.floor((a + b) / 1.5), 2) ? HAZ : BLACK);

function cyl(u: number, v: number, cu: number, cv: number, r: number) {
  return (u - cu) ** 2 + (v - cv) ** 2 <= r * r;
}

// ---------- Vehicles ----------

// A pair of tracks: links along the top run, a drive sprocket and an idler at
// the ends and road wheels between them on the outer face.
function tracks(u: number, v: number, z: number, hl: number, hw: number, tw: number, th: number): RGB | null {
  const av = Math.abs(v);
  if (av < hw - tw || av > hw || Math.abs(u) > hl || z > th) return null;
  const r = th / 2;
  const end = hl - Math.abs(u);
  if (end < r && (r - end) ** 2 + (z - r) ** 2 > r * r + 0.4) return null;
  if (av > hw - 0.7) {
    if (z > th - 0.7 || z < 0.6) return mod(Math.floor(u * 1.5), 2) ? TREAD : TREAD_D;
    const n = Math.max(2, Math.round((2 * hl - 2 * r) / 3.1));
    const pitch = (2 * hl - 2 * r) / n;
    const k = Math.round((u + hl - r) / pitch);
    const wu = u - (-hl + r + k * pitch);
    const big = k === 0 || k === n;
    const d = wu * wu + (z - (big ? r : th * 0.42)) ** 2;
    if (d < (big ? 1.9 : 1.5)) return d < 0.35 ? HUB : big ? TREAD_L : WHEEL;
    return TREAD_D;
  }
  if (z > th - 0.6 || end < r) {
    const link = mod(Math.floor(u * 1.5), 2);
    if (Math.abs(av - (hw - tw / 2)) < 0.3) return link ? TREAD_D : TREAD;
    return link ? TREAD : TREAD_L;
  }
  return TREAD_D;
}

function tankHull(f: Faction, L: number, W: number, heavy: boolean): Shape {
  const hl = L / 2;
  const hw = W / 2;
  const tw = heavy ? 3 : 2.4;
  const th = heavy ? 3.5 : 3;
  const top = heavy ? 6 : 5;
  const deck = mix(f.main, f.light, 0.45);
  return (u, v, z) => {
    const t = tracks(u, v, z, hl, hw, tw, th);
    if (t) return t;
    const av = Math.abs(v);
    // fenders over the tracks, with a stripe at the front and gear stowed on them
    if (av <= hw && av > hw - tw && Math.abs(u) < hl - 0.5) {
      if (z > th && z <= th + 0.7) {
        if (u > hl - 2.2) return u > hl - 1.4 ? WHITE : f.dark;
        if (u < -hl + 1.6) return v > 0 ? TAIL : shade(f.dark, -0.15);
        return g(Math.abs(mod(u, 4) - 2) < 0.3 ? shade(f.dark, -0.12) : shade(f.main, -0.16), u, v, z);
      }
      if (z > th + 0.7 && z <= th + 2) {
        // a stowage box on the left fender, fuel cans or a log on the right
        if (v < 0 && u > -3.5 && u < 0.5 && av < hw - 0.4) return z > th + 1.5 ? shade(OLIVE, 0.12) : Math.abs(u + 1.5) < 0.3 ? OLIVE_D : OLIVE;
        if (v > 0 && av < hw - 0.5) {
          if (heavy && u > -5 && u < 2.5) return (u > 2 || u < -4.5) ? WOOD_L : mod(Math.floor(u * 2), 5) === 0 ? shade(WOOD, -0.25) : WOOD;
          if (!heavy && u > -5 && u < -2.4) return Math.abs(u + 3.7) < 0.25 ? BLACK : z > th + 1.6 ? shade(OLIVE_D, 0.2) : OLIVE_D;
        }
      }
      return null;
    }
    if (av > hw - tw + 0.2) return null;
    if (z < 1.5) return null;
    // sloped glacis at the front, a short slope at the back
    let zt = top;
    if (u > hl - 4) zt = top - (u - (hl - 4)) * 0.8;
    if (u < -hl + 1.5) zt = top - (-hl + 1.5 - u) * 1.2;
    if (Math.abs(u) > hl || z > zt) {
      // exhaust stubs standing up from the engine deck
      if (u < -hl + 3 && u > -hl + 1.4 && Math.abs(av - (hw - tw - 1.1)) < 0.6 && z <= top + 1.4) return z > top + 0.9 ? BLACK : RUST;
      return null;
    }
    const skin = z > zt - 0.6;
    if (u > hl - 1 && z > zt - 1.1 && av > hw - tw - 1.6 && av < hw - tw - 0.3) return LAMP;
    if (u > hl - 0.7 && z < 2.6 && av < 1.2) return GUN_D; // tow shackle
    if (!skin) {
      if (u < -hl + 0.7) return av < hw - tw - 1.6 && mod(Math.floor(z * 2), 2) ? GUN_D : shade(f.dark, -0.1); // rear louvres
      return g(z < 2.4 ? f.dark : shade(f.main, -0.08), u, v, z);
    }
    // the deck
    if (u > hl - 4) {
      // glacis: the driver's hatch and vision block, spare links (or armor blocks)
      if (Math.abs(u - (hl - 2.6)) < 0.9 && Math.abs(v + 1.6) < 1.1) return Math.abs(u - (hl - 2)) < 0.3 ? GLASS_D : shade(f.dark, 0.05);
      if (heavy && v > 0.4 && v < hw - tw - 0.6 && u < hl - 0.8) return mod(Math.floor(u * 2) + Math.floor(v * 1.4), 2) ? shade(f.main, -0.2) : f.main;
      if (!heavy && Math.abs(u - (hl - 2.4)) < 0.4 && v > 0.6 && v < 3) return mod(Math.floor(v * 2), 2) ? TREAD_L : TREAD;
      return g(deck, u, v, z);
    }
    if (Math.abs(u - (hl - 4.2)) < 0.3) return shade(f.main, -0.22); // weld line
    if (u < -hl + 5) {
      // engine deck: a framed grille and a filler cap
      if (av < hw - tw - 1.9 && u > -hl + 1.6 && u < -hl + 4.6) return mod(Math.floor(u * 2), 2) ? GUN_D : GUN;
      if (Math.abs(u + hl - 5) < 0.3) return shade(f.main, -0.22);
      return g(shade(f.main, -0.06), u, v, z);
    }
    if (av > hw - tw - 0.5) return shade(f.dark, 0.1); // hull edge
    return g(deck, u, v, z);
  };
}

function turretShape(f: Faction, r: number, z0: number, barrels: number, len: number): Shape {
  const h = r * 0.72;
  const big = barrels === 2;
  const roof = mix(f.main, f.light, 0.5);
  return (u, v, z) => {
    if (z < z0) return null;
    const av = Math.abs(v);
    const bz = z0 + h * 0.5;
    // barrels: a thick sleeve at the mantlet, a bore evacuator and a muzzle brake
    for (const off of big ? [1.15, -1.15] : [0]) {
      if (u <= r - 1.4 || u >= len) continue;
      const d2 = (v - off) ** 2 + (z - bz) ** 2;
      const t = (u - r) / (len - r);
      const rad = t < 0.16 ? 0.95 : !big && Math.abs(t - 0.55) < 0.07 ? 0.85 : u > len - 1.6 ? (big ? 0.62 : 1.05) : 0.5;
      if (d2 < rad * rad + 0.12) return u > len - 0.6 ? BLACK : u > len - 1.6 ? GUN_D : t < 0.16 ? GUN_D : (z > bz + 0.1 ? GUN_L : GUN);
    }
    const du = u + 0.6;
    // a faceted shell that leans in towards the roof
    const k = 1 - ((z - z0) / (h + 0.4)) ** 2 * 0.3;
    const oct = Math.max(Math.abs(du) * 0.88, av, (Math.abs(du) * 0.88 + av) * 0.74);
    if (oct <= r * k && z <= z0 + h) {
      const skin = z > z0 + h - 0.6;
      if (skin) {
        // cupola ring and hatch, loader's hatch, sight, an identity stripe
        const cd = (du + 1.1) ** 2 + (v + r * 0.35) ** 2;
        if (cd < 1.7) return cd < 0.7 ? shade(f.dark, -0.2) : shade(f.dark, 0.12);
        if (big && (du + 1.2) ** 2 + (v - r * 0.4) ** 2 < 1.2) return shade(f.dark, -0.05);
        if (Math.abs(du - r * 0.42) < 0.5 && Math.abs(v - r * 0.36) < 0.5) return GLASS_D;
        if (du < -r * 0.52 && du > -r * 0.52 - 1) return WHITE;
        return g(roof, u, v, z);
      }
      if (du > r * 0.62 && av < (big ? 2.4 : 1.4)) return z > bz + 0.9 ? GUN : GUN_D; // mantlet
      if (z < z0 + 0.7) return shade(f.dark, -0.1); // turret ring
      return g(f.main, u, v, z);
    }
    // cupola standing proud of the roof
    if ((du + 1.1) ** 2 + (v + r * 0.35) ** 2 < 1.5 && z <= z0 + h + 0.8) return z > z0 + h + 0.4 ? shade(f.dark, 0.05) : f.dark;
    // stowage rack on the back with a rolled tarp
    if (du < -r * 0.86 && du > -r - 1.6 && av < r * 0.62 && z > z0 + 0.8 && z < z0 + h - 0.2) {
      if (du < -r - 1.1 || av > r * 0.62 - 0.5) return GUN_D;
      return z > z0 + h - 1 ? shade(OLIVE, 0.1) : OLIVE;
    }
    // smoke dischargers on the cheeks
    if (du > r * 0.1 && du < r * 0.5 && av > r * k - 0.2 && av < r * k + 0.9 && z > bz - 0.3 && z < bz + 0.9) return mod(Math.floor(du * 2), 2) ? GUN_D : GUN;
    // antenna on a sprung base
    if (Math.abs(du + r * 0.72) < 0.4 && Math.abs(v - r * 0.52) < 0.4 && z < z0 + h + 6) return z < z0 + h + 1 ? GUN : z > z0 + h + 5.4 ? RED : GUN_D;
    return null;
  };
}

function buggy(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    // chunky tyres with lugs, a spare on the back
    for (const wu of [-3.8, 3.8]) {
      const d = (u - wu) ** 2 + (z - 1.8) ** 2;
      if (av > 3.1 && av < 5 && d < 3.3) {
        if (av > 4.4) return d < 0.5 ? HUB : d < 1.4 ? GUN : WHEEL;
        return d > 2.3 && mod(Math.floor(Math.atan2(z - 1.8, u - wu) * 2.2), 2) ? TREAD : WHEEL;
      }
    }
    if (u < -5.6 && u > -6.9 && av < 1.9 && z > 2.6 && (av * av + (z - 4.4) ** 2 < 3.2)) return av * av + (z - 4.4) ** 2 < 0.7 ? HUB : WHEEL;
    if (Math.abs(u) > 6.3 || av > 3.6 || z < 1.6) return null;
    // bull bar
    if (u > 5.8 && z < 3.4 && (mod(Math.floor(av * 1.2), 2) === 0 || z > 2.8)) return GUN;
    // windscreen frame and glass
    if (u > 1.5 && u < 2.3 && z > 4 && z < 6.8 && av < 3) return z > 6.2 || av > 2.4 ? GUN_D : z > 5.4 ? GLASS_L : GLASS;
    // roll cage: a hoop, with bars running back
    if (u > -2.6 && u < -1.9 && z > 4 && z < 7.2 && (av > 2.5 || z > 6.5)) return GUN_D;
    if (u > -5.4 && u <= -2.6 && Math.abs(av - 2.8) < 0.4 && Math.abs(z - (7 + (u + 2.6) * 0.95)) < 0.45) return GUN_D;
    // pintle gun with an ammo box
    if (Math.abs(u + 3.4) < 0.5 && av < 0.5 && z > 4 && z < 6.6) return GUN_D;
    if (u > -4.2 && u < 1 && av < 0.45 && Math.abs(z - 6.7) < 0.45) return u > 0.2 ? BLACK : GUN;
    if (u > -4.4 && u < -3 && v > 0.4 && v < 1.5 && z > 5.6 && z < 6.8) return OLIVE;
    // whip aerial
    if (Math.abs(u + 5) < 0.35 && Math.abs(v + 3) < 0.35 && z < 9.5) return z > 9 ? RED : GUN_D;
    let zt = 4;
    if (u > 3) zt = 4 - (u - 3) * 0.35;
    if (z > zt) {
      // seat backs and the driver's helmet
      if (Math.abs(u + 0.9) < 0.5 && av > 0.5 && av < 2.4 && z < 5.6) return BLACK;
      if ((u - 0.1) ** 2 + (v + 1.4) ** 2 < 0.7 && z < 6.4) return z > 5.5 ? OLIVE_D : SKIN;
      return null;
    }
    if (u > 6 && av > 1.9 && av < 3.1 && z > zt - 1.3) return LAMP;
    if (u < -6 && av > 2.2 && z > 3) return TAIL;
    const skin = z > zt - 0.6;
    if (skin) {
      if (u > -1.8 && u < 1.4 && av < 2.6) return Math.abs(av - 1.3) < 0.9 ? shade(BLACK, 0.12) : BLACK; // seats
      if (u > 3 && av < 0.4) return shade(f.main, -0.2); // bonnet seam
      if (u > 3.4 && u < 5.4 && av > 1 && av < 2.4 && mod(Math.floor(u * 2), 2)) return shade(f.dark, -0.1); // vents
      if (u < -2.6) return mod(Math.floor(u * 1.5), 2) ? shade(f.dark, 0.15) : f.dark; // ribbed tray
      return g(mix(f.main, f.light, 0.5), u, v, z);
    }
    if (av > 3 && z > 2.6 && z < 3.3 && Math.abs(u) < 2.2) return WHITE; // side stripe
    return g(av > 3 ? f.dark : f.main, u, v, z);
  };
}

// The Mule armored carrier: a six-wheeled box with a sloped nose, a
// machine-gun cupola on the roof and a ramp door at the back for the five
// soldiers it carries.
function apc(f: Faction): Shape {
  const roof = mix(f.main, f.light, 0.45);
  return (u, v, z) => {
    const av = Math.abs(v);
    // six big tyres with lugs, under arched wheel wells
    for (const wu of [-5.6, 0, 5.6]) {
      const d = (u - wu) ** 2 + (z - 2) ** 2;
      if (av > 3 && av < 5 && d < 4.2) {
        if (av > 4.4) return d < 0.6 ? HUB : d < 1.6 ? GUN : WHEEL;
        return d > 3 && mod(Math.floor(Math.atan2(z - 2, u - wu) * 2.4), 2) ? TREAD : WHEEL;
      }
    }
    // the cupola: a ring with a hatch and the gun on a pintle, its barrel forward
    const cu = 1;
    const cv = -1.4;
    const cd = (u - cu) ** 2 + (v - cv) ** 2;
    if (z > 7 && z <= 8.6 && cd < 2.6) {
      if (z > 8) return cd < 1.1 ? shade(f.dark, -0.2) : shade(f.dark, 0.12);
      return cd > 1.8 ? g(f.main, u, v, z) : shade(f.dark, -0.1);
    }
    if (z > 8.6 && z < 10 && Math.abs(v - cv) < 0.45) {
      if (Math.abs(u - (cu + 0.8)) < 0.45) return GUN_D; // pintle
      if (u > cu + 0.4 && u < cu + 1.8 && z > 9.2) return OLIVE; // ammo box
      if (u > cu + 1.2 && u < cu + 4.6 && Math.abs(z - 9.4) < 0.45) return u > cu + 4 ? BLACK : GUN;
    }
    // whip aerial at the back corner
    if (Math.abs(u + 7.6) < 0.35 && Math.abs(v - 3.2) < 0.35 && z > 7 && z < 13) return z > 12.4 ? RED : GUN_D;
    if (Math.abs(u) > 9 || z < 1.6) return null;
    // the hull narrows a little towards the roof; a sloped nose, a short slope at the back
    const side = 4.4 - Math.max(0, z - 4.6) * 0.28;
    if (av > side) return null;
    let zt = 7;
    if (u > 4) zt = 7 - (u - 4) * 0.62;
    if (u < -8.2) zt = 7 - (-8.2 - u) * 1.2;
    if (z > zt) {
      // a jerry can rack on the roof at the back, and a rolled tarp
      if (u > -7.6 && u < -5.4 && v > 0.6 && v < 3.4 && z <= 8.4) return z > 8 ? shade(OLIVE_D, 0.2) : Math.abs(v - 2) < 0.25 ? BLACK : OLIVE_D;
      if (u > -4.8 && u < -1.6 && v > 1 && v < 2.6 && z <= 8) return (u < -4.4 || u > -2) ? GUN_D : shade(OLIVE, 0.08);
      return null;
    }
    const skin = z > zt - 0.6;
    const nose = u > 4;
    // headlamps and the tow hook on the nose
    if (u > 8.4 && z > 3.4 && z < 4.6 && av > 2.4 && av < 3.6) return LAMP;
    if (u > 8.4 && z < 2.6 && av < 1) return GUN_D;
    // the driver's vision slits in the glacis
    if (nose && Math.abs(u - 5.4) < 0.5 && v < -0.4 && v > -3 && z > zt - 0.7) return GLASS_D;
    // tail lamps and the ramp door at the back, with its hinge and handle
    if (u < -8.6) {
      if (av > 3.3 && z > 5.4 && z < 6.3) return TAIL;
      if (av < 2.6 && z < 6.6) {
        if (av > 2.2 || z > 6.2) return shade(f.dark, -0.22);
        if (Math.abs(z - 2.4) < 0.3) return GUN_D;
        if (Math.abs(z - 4.4) < 0.35 && Math.abs(v - 1.4) < 0.5) return METAL;
        return g(shade(f.main, -0.12), u, v, z);
      }
    }
    if (skin) {
      // roof hatches for the troops, the engine grille beside the driver
      if (u > -7.4 && u < -1.4 && Math.abs(av - 1.6) < 1.2 && v < 0) return Math.abs(u + 4.4) < 0.25 ? shade(f.dark, -0.2) : shade(f.dark, 0.06);
      if (nose && v > 0.6 && v < 3.4 && u < 7.6) return mod(Math.floor(u * 2), 2) ? GUN_D : GUN;
      if (Math.abs(u - 4) < 0.3) return shade(f.main, -0.22); // the seam where the nose starts
      if (av > side - 0.5) return shade(f.dark, 0.1); // roof edge
      return g(roof, u, v, z);
    }
    // the sides: firing ports with vision blocks, a faction stripe, a step
    if (av > side - 0.6) {
      if (z > 5 && z < 6 && u > -7 && u < 3 && mod(u + 7, 3.4) < 1) return mod(u + 7, 3.4) < 0.5 ? GLASS_D : GLASS;
      if (z > 4 && z < 4.6 && u > -8.4 && u < 8) return WHITE;
      if (z < 3.2 && Math.abs(u + 2.8) < 0.9) return GUN_D;
    }
    if (z < 3.4) return g(f.dark, u, v, z);
    return g(f.main, u, v, z);
  };
}

// A parked buggy: the red lamp on the tip of its whip aerial gives one short
// flash every 8 seconds. Drawn over the buggy's sprite at (x, y, z) facing a,
// at time t. The position matches the aerial in buggy() above.
export function drawBuggyLights(c: CanvasRenderingContext2D, x: number, y: number, z: number, a: number, t: number): void {
  if (t % 8 >= 0.3) return;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const [sx, sy] = toScreen(x - 5 * ca + 3 * sa, y - 5 * sa - 3 * ca, z + 9.3);
  const X = Math.round(sx);
  const Y = Math.round(sy);
  c.fillStyle = 'rgba(255,80,60,0.4)';
  c.fillRect(X - 1, Y - 1, 3, 3);
  c.fillStyle = '#ff6a5a';
  c.fillRect(X, Y, 1, 1);
}

// fill: how much ore is in the bed, 0 empty, 1 partly full, 2 full.
// The ore hauler. fill: how full its bed is (0 empty, 1 partly, 2 full).
// scoop: the digging scoop at the front, down on the ground (0), lifting (1)
// or up and tipping its ore back into the bed (2). tilt: the bed tipped up
// about its back edge by this angle (radians) to pour its load out behind,
// with the tailgate swung open and a ram pushing it up.
function hauler(f: Faction, fill = 2, scoop = 0, tilt = 0): Shape {
  const ore = hex('#c09443');
  const oreL = hex('#f2d06a');
  const oreBit = (u: number, v: number, z: number) => {
    const n = hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 77, 9);
    return n > 0.9 ? oreL : shade(ore, (n - 0.5) * 0.55);
  };
  // the bed in its own frame (as it sits when it is down)
  const bed = (u: number, v: number, z: number): RGB | null => {
    const av = Math.abs(v);
    if (av > 4.2 || z < 1.5 || u < -10.5 || u > 3.6) return null;
    // ribbed steel walls with a hazard lip (the tailgate is open while it tips)
    const gate = u < -9.6 && av <= 3.4;
    const wall = av > 3.4 || u < -9.6 || u > 2.8;
    if (wall && z <= 6.6 && !(gate && tilt > 0 && z > 2.6)) {
      if (z > 6) return hazard(u, v);
      const along = av > 3.4 ? u : v;
      if (z < 2.2) return f.dark;
      return g(mod(along, 3) < 0.6 ? METAL_D : z < 3 ? shade(METAL, -0.12) : METAL, u, v, z, 0.08);
    }
    // the floor of the bed, ribbed across, seen when it is empty
    if (z <= 2.6) return mod(u, 2.4) < 0.5 ? METAL_D : g(shade(METAL, -0.22), u, v, z, 0.06);
    if (!fill) return null;
    const lumpy = (hash2(Math.floor(u * 1.2), Math.floor(v * 1.2), 3) - 0.5) * 1.2;
    // partly full: a low heap slumped to the back of the bed (and, tipped, sliding out of it)
    const heap = fill === 2 ? 5.6 + 2.2 * Math.cos((u + 3.5) / 7) * Math.cos(v / 4) + lumpy : 3.4 + 2.4 * Math.max(0, Math.cos((u + 6) / 5)) * Math.cos(v / 4.5) + lumpy * 0.8;
    if (z <= heap) return oreBit(u, v, z);
    return null;
  };
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const lift = scoop * 2.4;
  const ramU = -1;
  return (u, v, z) => {
    const t = tracks(u, v, z, 11, 6, 2.2, 3);
    if (t) return t;
    const av = Math.abs(v);
    // exhaust stack behind the cab and an amber beacon on its roof
    if (cyl(u, v, 4, -3.2, 0.7) && z > 3 && z <= 11) return z > 10.3 ? BLACK : z > 9.6 ? STEEL : GUN_D;
    if (cyl(u, v, 7.6, 0, 0.75) && z > 9 && z <= 10.2) return HAZ;
    // the scoop across the front, with teeth: lifted, its lip tips up
    // towards the cab, with a scoopful of ore in it
    if (u > 10.6 && u <= 12.4 && av < 5) {
      const sz = z - lift - (u - 10.6) * 0.75 * scoop;
      if (sz >= 0 && sz < 3.4) {
        if (scoop && sz > 2.1 && u < 12 && av < 4.4) return oreBit(u, v, z);
        if (sz < 1.2 && u > 11.6) return mod(Math.floor(av * 1.4), 2) ? STEEL : GUN_D;
        return sz > 2.7 ? HAZ : g(METAL_D, u, v, z);
      }
      // the arms it hangs from, out of the front of the cab
      if (scoop && Math.abs(av - 4.4) < 0.5 && u < 11.6 && z < lift + 2.4 && z > 1.4) return z > lift + 1.6 ? GUN : GUN_D;
    }
    if (tilt) {
      // the bed swings up about its back bottom edge
      const du = u + 10.5;
      const dz = z - 1.5;
      const b = bed(du * ct + dz * st - 10.5, v, -du * st + dz * ct + 1.5);
      if (b) return b;
      // and the ram under it, from the chassis up to the front of the bed
      if (av < 0.9) {
        const bx = -10.5 + 11.5 * ct - ramU;
        const bz = 1.5 + 11.5 * st - 1.6;
        const k = Math.max(0, Math.min(1, ((u - ramU) * bx + (z - 1.6) * bz) / (bx * bx + bz * bz)));
        if (Math.hypot(u - ramU - bx * k, z - 1.6 - bz * k) < (k > 0.5 ? 0.55 : 0.8)) return k > 0.5 ? STEEL : GUN_D;
      }
    }
    if (av > 4.2 || z < 1.5 || Math.abs(u) > 11) return null;
    // mudguards
    if (z <= 3.6 && z > 3 && av > 3.8) return shade(f.dark, -0.1);
    // cab
    if (u > 4.8) {
      if (u > 10.5 || z > 9) return null;
      if (z > 5.2 && z < 8) {
        const front = u > 9.8;
        const side = av > 3.6;
        if (front && !side) return Math.abs(v) < 0.3 ? f.dark : z > 7.1 ? GLASS_L : GLASS;
        if (side && !front && u > 5.8) return Math.abs(u - 7.9) < 0.3 ? f.dark : z > 7.1 ? GLASS : GLASS_D;
      }
      if (u > 10 && z < 3.6 && av > 2.4 && av < 3.6) return LAMP;
      if (u > 10 && z < 4.6 && z > 2 && av < 2) return mod(Math.floor(z * 2), 2) ? GUN_D : GUN; // radiator
      if (z > 8.4) return g(Math.abs(u - 7.6) < 2 && av < 2.4 ? f.light : mix(f.main, f.light, 0.5), u, v, z);
      if (z > 4.4 && z < 5.1) return WHITE;
      return g(z < 3.4 ? f.dark : f.main, u, v, z);
    }
    if (u > 3.6) return z < 7 ? (z > 6.4 ? GUN : GUN_D) : null;
    if (!tilt) return bed(u, v, z);
    // under the lifted bed: the chassis rails
    if (z <= 2.2 && u > -10.5 && Math.abs(av - 2.4) < 0.8) return mod(u, 3) < 0.5 ? GUN : GUN_D;
    return null;
  };
}

// The Scorch tank's turret: a low rounded dome with two stubby flame
// projectors and a pair of fuel drums slung across its back.
function scorchTurret(f: Faction): Shape {
  const roof = mix(f.main, f.light, 0.5);
  return (u, v, z) => {
    if (z < 5) return null;
    // the projectors, each with a pilot light at the tip
    for (const off of [1.3, -1.3]) {
      if (u < 2.4 || u > 9) continue;
      const d2 = (v - off) ** 2 + (z - 6.6) ** 2;
      const rad = u > 8 ? 0.75 : u < 3.6 ? 0.85 : 0.5;
      if (d2 < rad * rad + 0.1) return u > 8.6 ? (d2 < 0.2 ? hex('#ffb347') : BLACK) : u > 8 ? GUN_D : z > 6.8 ? GUN_L : GUN;
    }
    // fuel drums lying across the back, banded
    if (u > -6.2 && u < -2.8 && Math.abs(v) < 3.4) {
      const d2 = (u + 4.5) ** 2 + (z - 6.8) ** 2;
      if (d2 < 2.6) return Math.abs(Math.abs(v) - 2.2) < 0.3 ? HAZ : Math.abs(v) > 3.1 ? GUN_D : d2 < 1 && z > 7.2 ? shade(OLIVE, 0.18) : OLIVE;
    }
    // the dome
    const d = Math.hypot((u + 0.4) * 0.92, v);
    if (d > 4.2) return null;
    const top = 5 + 2.9 * Math.sqrt(Math.max(0, 1 - (d / 4.2) ** 2));
    if (z > top) {
      // a hatch standing proud
      if ((u + 1) ** 2 + (v + 1.4) ** 2 < 1.2 && z < top + 0.6) return shade(f.dark, 0.08);
      return null;
    }
    if (z > top - 0.6) {
      if (Math.abs(u - 1.4) < 0.4 && Math.abs(v - 1.6) < 0.5) return GLASS_D; // sight
      if (u < -2.6 && u > -3.4) return WHITE; // identity stripe
      return g(roof, u, v, z);
    }
    if (z < 5.6) return shade(f.dark, -0.1);
    if (u > 2.6 && Math.abs(v) < 2.4) return z > 6.9 ? GUN : GUN_D; // mantlet
    return g(f.main, u, v, z);
  };
}

// The Lumen emitter, on the tower and the tank: a stack of rings narrowing
// up a glowing rod to a bright ball, which the beam leaves from. Its foot is
// at `foot`, drawn s times the tank's size; the ball's middle is COIL_BALL * s
// above the foot.
const COIL_BALL = 6.3;
function coil(f: Faction, u: number, v: number, z: number, foot: number, s: number): RGB | null {
  const x = u / s;
  const y = v / s;
  const w = (z - foot) / s;
  if (w < 0 || w > COIL_BALL + 1.6 || Math.abs(x) > 2.6 || Math.abs(y) > 2.6) return null;
  const glow = glowOf(f);
  const core = mix(glow, WHITE, 0.6);
  const d = Math.hypot(x, y);
  const ball = Math.hypot(x, y, w - COIL_BALL);
  if (ball < 1.5) return ball < 0.9 || (x > 0.2 && w > COIL_BALL + 0.3) ? core : glow;
  if (w < 5.4) {
    if (d < 0.6) return glow;
    const k = Math.floor(w / 0.9);
    if (w - k * 0.9 < 0.45 && d < 2.5 - k * 0.22) return d > 2.1 - k * 0.22 ? f.light : k % 2 ? COPPER : GUN_L;
  }
  return null;
}

// The Lumen tank's turret: a turntable carrying a tall emitter mast, braced
// by two fins of the side's color, with the emitter coil standing on a collar
// at its top (its ball, which the beam leaves from, is LUMEN_Z up).
const LUMEN_FOOT = 12.8;
export const LUMEN_Z = LUMEN_FOOT + COIL_BALL;
function lumenTurret(f: Faction): Shape {
  const glow = glowOf(f);
  return (u, v, z) => {
    if (z < 5) return null;
    const c = coil(f, u, v, z, LUMEN_FOOT, 1);
    if (c) return c;
    const d = Math.hypot(u + 0.3, v);
    const av = Math.abs(v);
    // the turntable, with a ring of glowing ports
    if (d < 4.4 && z < 6.8) {
      if (z > 6.2) return d > 3.8 ? shade(f.dark, 0.1) : mix(f.main, f.light, 0.4);
      if (z > 5.5 && mod(Math.atan2(v, u + 0.3) * 6 / Math.PI, 1) < 0.35) return glow;
      return f.dark;
    }
    // the mast: four-sided, narrowing up to the cradle, a glowing slit up its front
    const mr = 1.9 - (z - 6.8) * 0.08;
    if (z < 12 && Math.max(Math.abs(u), av) < mr) {
      if (u > mr - 0.5 && av < 0.4 && z > 7.4) return glow;
      return z > 11.4 ? GUN_L : g(mod(Math.floor(z * 1.2), 3) ? GUN : GUN_D, u, v, z);
    }
    // the two fins either side, sweeping up from the turntable to the cradle
    const fo = 3.6 - (z - 6.8) * 0.42;
    if (z < 12.4 && Math.abs(av - Math.max(1.2, fo)) < 0.45 && Math.abs(u + (z - 6.8) * 0.15) < 1.8 - (z - 6.8) * 0.18) return z > 11.6 ? f.light : g(f.main, u, v, z);
    // the collar the coil stands on
    if (z >= 12 && z < LUMEN_FOOT && Math.hypot(u, v) < 2.2) return z > 12.5 ? f.light : GUN_D;
    // a counterweight box behind
    if (u < -2.4 && u > -5 && av < 2 && z < 8) return z > 7.5 ? mix(f.main, f.light, 0.4) : f.main;
    return null;
  };
}

// The Skyguard battery's launcher: a yoke on a turntable holding a box of
// four missile tubes tilted up at the sky.
function aaLauncher(f: Faction): Shape {
  const tilt = 0.55;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return (u, v, z) => {
    const d = Math.hypot(u, v);
    if (z < 1.2) return d < 3.6 ? (d > 3 ? GUN_D : f.dark) : null;
    // the yoke arms either side of the box
    if (Math.abs(Math.abs(v) - 3.6) < 0.5 && Math.abs(u) < 1 && z < 4.6) return z > 4 ? GUN_L : GUN;
    if (d < 1.4 && z < 3) return GUN;
    // the box, tipped up about its trunnions at z = 4
    const bu = u * ct + (z - 4) * st;
    const bz = -u * st + (z - 4) * ct;
    if (Math.abs(bu - 1) > 4.2 || Math.abs(v) > 3.1 || Math.abs(bz) > 2.1) return null;
    if (bu > 4.6) {
      // the business end: four tube mouths
      const tv = Math.abs(v) - 1.5;
      const tz = Math.abs(bz) - 1;
      if (tv * tv + tz * tz < 0.55) return tv * tv + tz * tz < 0.2 ? BLACK : GUN_D;
      return GUN;
    }
    if (bz > 1.6) return mix(f.main, f.light, 0.45);
    if (Math.abs(bu + 0.8) < 0.3) return HAZ; // a warning band
    return g(f.main, u, v, z);
  };
}

// The Skyguard tank's turret: the battery's four-tube launcher on a low
// turret ring, with a small radar dome on a post at the back.
function skyguardTurret(f: Faction): Shape {
  const launcher = aaLauncher(f);
  const Z0 = 5;
  return (u, v, z) => {
    if (z < Z0) return null;
    const lz = z - Z0;
    // the turret ring under the launcher
    const d = Math.hypot(u, v);
    if (lz < 0.8 && d < 4.6) return d > 4 ? GUN_D : g(mix(f.main, f.light, 0.3), u, v, z);
    const ru = u + 4.2;
    if (Math.hypot(ru, v) < 0.5 && lz < 4.4) return GUN_D;
    const rd = Math.hypot(ru, v, lz - 5.6);
    if (rd < 1.7) return mod(Math.atan2(v, ru) * 3, 1) < 0.1 ? PLAS_D : WHITE;
    return launcher(u + 0.6, v, lz - 0.6);
  };
}

function artillery(f: Faction): Shape {
  const hull = tankHull(f, 16, 12, false);
  return (u, v, z) => {
    const av = Math.abs(v);
    // long barrel raised at an angle, stepped down towards the muzzle
    const t = Math.max(0, Math.min(1, ((u + 1) * 14 + (z - 7) * 5) / (14 * 14 + 5 * 5)));
    const bu = -1 + 14 * t;
    const bz = 7 + 5 * t;
    const d2 = (u - bu) ** 2 + (z - bz) ** 2 + v * v;
    const rad = t < 0.3 ? 1.05 : t > 0.9 ? 0.95 : 0.62;
    if (d2 < rad * rad) return t > 0.97 ? BLACK : t > 0.9 ? GUN_D : t < 0.3 ? GUN : Math.abs(t - 0.6) < 0.03 ? GUN_D : GUN_L;
    // recoil cylinders either side of the breech
    if (t < 0.34 && t > 0.02 && Math.abs(av - 1.5) < 0.5 && Math.abs(z - bz) < 0.55) return STEEL;
    // cradle and trunnions, a gun shield with a sight slot
    if (Math.abs(u + 1) < 2.6 && av < 2.8 && z > 5 && z < 8.2) return g(z > 7.6 ? mix(f.main, f.light, 0.5) : av > 2.2 ? f.dark : METAL_D, u, v, z);
    if (u > 1.4 && u < 2.2 && av < 4.4 && av > 1.2 && z > 5 && z < 9.4 - av * 0.3) return Math.abs(av - 3) < 0.4 && Math.abs(z - 7.6) < 0.4 ? BLACK : g(f.main, u, v, z);
    // ammunition ready rack and a spade folded up at the back
    if (u > -7.4 && u < -4.2 && av < 3 && z > 5 && z < 6.8) {
      if (z > 6.2) return mod(Math.floor(v * 1.3), 2) ? COPPER : shade(COPPER, -0.3);
      return OLIVE_D;
    }
    if (u < -7.6 && u > -8.6 && av < 4 && z > 2.5 && z < 6.4) return av > 3.2 || z > 5.6 ? GUN_D : null;
    return hull(u, v, z);
  };
}

// The Comet launcher: a long tracked chassis with an armored cab up front
// and, along its back, an erector rail tipped up at the sky on two rams. While
// it is loaded one huge rocket lies on the rail (off-white with a band of the
// side's color, hazard stripes and cross fins); fired, the rail stands bare
// until the next is loaded. The rocket leaves from its nose, COMET_NOSE
// (forward, up) from the middle.
const COMET_PIVOT: [number, number] = [-6.8, 7];
const COMET_TILT = 0.4;
const COMET_LEN = 16;
const COMET_LIFT = 2; // the rocket's middle above the rail's top
export const COMET_NOSE: [number, number] = [
  COMET_PIVOT[0] + COMET_LEN * Math.cos(COMET_TILT) - COMET_LIFT * Math.sin(COMET_TILT),
  COMET_PIVOT[1] + COMET_LEN * Math.sin(COMET_TILT) + COMET_LIFT * Math.cos(COMET_TILT),
];
function comet(f: Faction, loaded: boolean): Shape {
  const hull = tankHull(f, 18, 12, false);
  const ct = Math.cos(COMET_TILT);
  const st = Math.sin(COMET_TILT);
  const [pu, pz] = COMET_PIVOT;
  const roof = mix(f.main, f.light, 0.5);
  // where each ram meets the rail's underside
  const ramTop = (side: number): P3 => [pu + 6.5 * ct + 0.9 * st, side * 1.7, pz + 6.5 * st - 0.9 * ct];
  return (u, v, z) => {
    const av = Math.abs(v);
    // along (s) and up off (n) the rail
    const s = (u - pu) * ct + (z - pz) * st;
    const n = -(u - pu) * st + (z - pz) * ct;
    if (loaded && s > -0.6 && s < COMET_LEN) {
      const nn = n - COMET_LIFT;
      const R = 1.55;
      const r = s > COMET_LEN - 3.6 ? R * Math.sqrt(Math.max(0, 1 - ((s - (COMET_LEN - 3.6)) / 3.6) ** 2)) : s < 0 ? 0.95 : R;
      if (v * v + nn * nn < r * r + 0.1) {
        if (s < 0) return GUN_D; // the nozzle
        if (s > COMET_LEN - 0.9) return GUN_D; // the nose tip
        if (s > 9.4 && s < 10.4) return f.main; // the side's band
        if (s > 1.6 && s < 3.4) return hazard(s * 1.6, Math.atan2(nn, v) * 1.4);
        return g(nn > 0.7 ? hex('#f1eee4') : nn < -0.6 ? shade(WHITE, -0.14) : WHITE, u, v, z, 0.04);
      }
      // four fins in a cross at the tail
      if (s < 2.4 && ((av < 0.3 && Math.abs(nn) < 3) || (Math.abs(nn) < 0.3 && av < 3))) return s > 2 ? shade(f.dark, 0.15) : f.dark;
    }
    // the rail: a girder with a lip either side and two saddles for the rocket
    if (s > -1 && s < 15.4 && n > -0.9 && n < 0.6) {
      if (av < 1.1 && n <= 0) return n > -0.4 ? (mod(Math.floor(s * 1.2), 4) ? GUN_L : GUN) : GUN_D;
      if (av >= 1.1 && av < 1.6 && n < 0.3) return n > -0.1 ? f.light : f.dark;
      if (av < 1.6 && (Math.abs(s - 4) < 0.6 || Math.abs(s - 11) < 0.6) && n < 0.6) return HAZ;
    }
    // the rams lifting it, and the pivot block at the back
    for (const side of [1, -1]) if (segD(u, v, z, [-1, side * 1.7, 5], ramTop(side)) < 0.55) return z > 7 ? STEEL : METAL_D;
    if (u > pu - 1.3 && u < pu + 1.6 && av < 2.4 && z >= 5 && z < pz + 0.4) return z > pz - 0.3 ? GUN : av > 1.8 ? GUN_D : f.dark;
    // the armored cab at the front, its front sloping back to a vision slit
    if (u > 3.2 && u < 8.4 && av < 3.5 && z >= 5) {
      const zt = 8.8 - Math.max(0, u - 6.2) * 1.15;
      if (z <= zt) {
        if (z > zt - 0.5) return Math.abs(u - 4.2) < 0.3 ? WHITE : g(roof, u, v, z);
        if (u > 6.2 && z > 6.6 && z < 7.5 && av < 2.9) return GLASS_D;
        if (av > 3 && Math.abs(u - 5) < 0.8 && z > 6.6 && z < 7.8) return GLASS_D;
        return g(z < 5.6 ? f.dark : f.main, u, v, z);
      }
      // an aerial on the cab's back corner
      if (Math.abs(u - 3.7) < 0.35 && Math.abs(v + 2.8) < 0.35 && z < 13) return z > 12.4 ? RED : GUN_D;
    }
    return hull(u, v, z);
  };
}

function boat(f: Faction): Shape {
  const hull = hex('#a8aeb0');
  const deck = hex('#74797b');
  const keel = hex('#7a3b33');
  return (u, v, z) => {
    if (u < -13 || u > 15) return null;
    const flare = z < 3 ? 0.82 + z * 0.06 : 1;
    const hw = (u > 5 ? 5.2 * Math.sqrt(Math.max(0, (15 - u) / 10)) : u < -11 ? 5.2 - (-11 - u) * 0.5 : 5.2) * flare;
    const av = Math.abs(v);
    if (z > 13) return null;
    if (z <= 3) {
      if (av > hw) return null;
      const side = av > hw - 0.8;
      if (z > 2.4) {
        if (side) return null;
        if (av > hw - 1.5) return shade(deck, -0.2); // gunwale
        if (mod(u, 3) < 0.5) return shade(deck, -0.1); // deck plates
        if (u > 11 && av < 0.5) return GUN_D; // anchor chain
        return g(deck, u, v, z, 0.06);
      }
      if (side || u < -12.4) {
        if (z < 0.9) return keel;
        if (z < 1.4) return WHITE;
        if (u > 9 && u < 12.5 && z > 1.6) return mod(Math.floor(u * 1.5), 2) ? shade(hull, -0.3) : hull; // pennant number
        if (z > 1.9 && z < 2.5 && u < 6) return f.main;
        return g(hull, u, v, z, 0.05);
      }
      return shade(hull, -0.2);
    }
    // rail stanchions round the deck
    if (z <= 4.3 && av > hw - 1.3 && av <= hw - 0.5 && u < 12 && (z > 3.9 || mod(u, 3) < 0.5)) return STEEL;
    // wheelhouse: wrap-round windows, a roof with a searchlight
    if (u > -6 && u < 2.2 && av < 3.1 && z <= 7.4) {
      if (z > 5.2 && z < 6.6) {
        if (u > 1.6) return mod(v + 9, 2) < 0.35 ? f.dark : GLASS_L;
        if (av > 2.5 && u > -4.6) return mod(u, 2.2) < 0.4 ? f.dark : GLASS_D;
      }
      if (z > 6.8) return g(mix(f.main, f.light, 0.5), u, v, z);
      if (u < -5.4 && av < 0.9 && z < 5.8) return GUN_D; // door
      return g(z < 3.8 ? f.dark : f.main, u, v, z);
    }
    if (cyl(u, v, 1, 0, 0.8) && z <= 8.3) return z > 7.8 ? LAMP : GUN;
    // funnel
    if (cyl(u, v, -3.2, 0, 1.3) && z <= 9.6) return z > 9 ? BLACK : z > 8.2 ? f.main : GUN;
    // mast: a yard, a radar bar and a light
    if (Math.abs(u + 1) < 0.4 && av < 0.4 && z < 13) return z > 12.4 ? RED : GUN_D;
    if (Math.abs(u + 1) < 0.4 && av < 2.2 && Math.abs(z - 10.2) < 0.4) return GUN_D;
    if (Math.abs(u + 1) < 1.6 && av < 0.4 && Math.abs(z - 11.6) < 0.4) return STEEL;
    // gun mount at the bow, on a ring
    const gd = (u - 8) ** 2 + v * v;
    if (gd < 4.4 && z < 3.6) return GUN_D;
    if (gd < 3 && z < 5.2) return g(z > 4.6 ? mix(f.main, f.light, 0.5) : f.main, u, v, z);
    if (u > 8.6 && u < 13.6 && av < 0.5 && Math.abs(z - 4.4) < 0.5) return u > 12.8 ? BLACK : GUN;
    // life raft canisters, depth charge rack and an ensign staff at the stern
    if (u > -8.6 && u < -6.6 && Math.abs(av - 3.4) < 0.75 && z < 4.5) return z > 4 ? WHITE : hex('#d9743a');
    if (u < -8.8 && u > -11.8 && av < 2.2 && z < 4.6) {
      if (z > 4 || av > 1.7) return GUN_D;
      return mod(Math.floor(u * 1.2), 2) ? OLIVE : OLIVE_D;
    }
    if (Math.abs(u + 12.4) < 0.35 && av < 0.35 && z < 7) return z > 5.2 ? f.light : GUN_D;
    return null;
  };
}

function heli(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    // fuselage
    const e = (u - 1) ** 2 / 38 + (v * v) / 7.5 + (z - 3.8) ** 2 / 7.5;
    if (e <= 1) {
      // canopy with frames, nose sensor
      if (u > 3 && z > 3.4) {
        if (Math.abs(u - 4.9) < 0.3 || (av < 0.3 && u > 3.6)) return f.dark;
        return z > 4.9 ? GLASS_L : u > 5 ? GLASS : GLASS_D;
      }
      if (u > 6.4) return BLACK;
      if (z > 5.6 && av < 1.4 && u > -3.4 && u < 2.4) return u > 1.6 ? BLACK : mod(Math.floor(u * 2), 2) ? GUN_D : GUN; // engine cowl and intake
      if (z < 2.4) return shade(f.dark, -0.05);
      if (Math.abs(u + 1.6) < 0.6 && z > 2.6 && z < 4.6) return WHITE; // band
      if (Math.abs(u - 1.4) < 0.3 && z < 4.6) return f.dark; // door seam
      return g(f.main, u, v, z);
    }
    // rotor mast and hub
    if (cyl(u, v, 1, 0, 0.7) && z > 6 && z <= 8.4) return z > 7.8 ? STEEL : GUN_D;
    // exhausts
    if (u > -4.6 && u < -3.2 && Math.abs(av - 1.2) < 0.5 && Math.abs(z - 5.2) < 0.5) return BLACK;
    // tail boom, tapering; fin and tailplane
    const bt = (u + 13) / 9;
    if (u > -13 && u < -4 && av < 0.5 + bt * 0.6 && z > 4 - bt * 0.4 && z < 5 + bt * 0.6) return Math.abs(u + 8) < 0.4 ? WHITE : g(f.main, u, v, z);
    if (u > -15 && u < -12 && av < 0.5 && z > 3.6 && z < 9.6 - (u + 12) * -0.9) return z > 8 ? f.light : g(f.dark, u, v, z);
    if (u > -14.4 && u < -12.4 && av < 2.8 && Math.abs(z - 4.6) < 0.45) return f.dark;
    if (Math.abs(u + 14.6) < 0.4 && av < 0.4 && z < 3.6 && z > 2.4) return GUN_D; // tail skid
    // skids on struts
    if (u > -3.4 && u < 6.4 && av > 2.6 && av < 3.4 && z < 0.8) return u > 5.6 ? GUN : GUN_D;
    if ((Math.abs(u + 1.5) < 0.4 || Math.abs(u - 3.5) < 0.4) && av > 1.6 && av < 3.2 && z < 2.2) return GUN_D;
    // stub wings with rocket pods, a chin gun
    if (u > -0.6 && u < 2 && av > 2.4 && av < 4.8 && Math.abs(z - 3.6) < 0.4) return f.dark;
    if (u > -1.4 && u < 3.6 && av > 3.4 && av < 4.8 && (av - 4.1) ** 2 + (z - 2.7) ** 2 < 0.75) return u > 3 ? BLACK : u < -1 ? GUN_D : Math.abs(u - 1) < 0.3 ? HAZ : OLIVE;
    if (u > 5.6 && u < 8.6 && av < 0.45 && Math.abs(z - 1.7) < 0.45) return GUN_D;
    return null;
  };
}

// The Heron transport: a long tandem-rotor copter with a boxy cabin for five
// soldiers, a rotor pylon at each end (the game draws the blades), a
// loading ramp at the back and a door gun on the side.
function heron(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    // the cabin: a rounded box, the nose rounding down to the cockpit
    if (u > -10 && u < 9 && av < 2.8 && z > 1.2 && z < 6.4) {
      const nose = u > 6 ? (u - 6) * 0.9 : 0;
      const tail = u < -7.5 ? (-7.5 - u) * 0.9 : 0;
      if (z > 6.4 - nose * 0.6 - tail * 0.4 || z < 1.2 + nose * 0.5 + tail * 0.9) return null;
      if (av > 2.8 - nose * 0.25) return null;
      if (u > 6.2 && z > 3.4) return Math.abs(u - 7.4) < 0.3 || av < 0.3 ? f.dark : z > 4.8 ? GLASS_L : GLASS; // cockpit glazing
      if (z > 5.8) return shade(f.main, 0.1);
      if (av > 2.2 && z > 3.4 && z < 4.6 && mod(u, 2.4) < 1.2 && u > -6 && u < 5) return GLASS_D; // cabin windows
      if (av > 2.2 && Math.abs(u - 4) < 1.2 && z < 5) return f.dark; // side door
      if (Math.abs(u + 3) < 0.4) return WHITE; // band
      if (z < 2.2) return shade(f.dark, -0.05);
      return g(f.main, u, v, z);
    }
    // the rotor pylons, the back one tall
    if (u > 4.6 && u < 7.4 && av < 1.3 && z >= 6.4 && z < 7.6) return z > 7.2 ? GUN_D : f.dark;
    if (u > -11 && u < -6.4 && av < 1.4 && z >= 6 && z < 9.4 - (u > -7.4 ? (u + 7.4) * 1.4 : 0)) return z > 9 ? GUN_D : g(f.dark, u, v, z);
    if (cyl(u, v, 6, 0, 0.6) && z >= 7.6 && z < 8.4) return STEEL;
    if (cyl(u, v, -8.6, 0, 0.6) && z >= 9.4 && z < 10.2) return STEEL;
    // engine pods on the back pylon's flanks
    if (u > -10.6 && u < -6.6 && Math.abs(av - 2.2) < 0.8 && Math.abs(z - 7.4) < 0.8) return u > -7.2 ? BLACK : GUN;
    // a door gun, wheels
    if (u > 3.6 && u < 6.4 && Math.abs(v - 3.2) < 0.35 && Math.abs(z - 3.8) < 0.35) return GUN_D;
    for (const [wu, wv] of [[5, 2.2], [5, -2.2], [-6.5, 2.4], [-6.5, -2.4]]) if ((u - wu) ** 2 + (z - 0.8) ** 2 < 0.7 && Math.abs(v - wv) < 0.5) return WHEEL;
    return null;
  };
}

// The Swift jet: a small swept-wing jump jet with a bubble canopy, two
// missile rails under the wings and its landing legs down.
function jet(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    // the fuselage: a long tapering body, pointed nose
    const r = u > 4 ? 1.4 * (1 - (u - 4) / 6) : u < -6 ? 1.4 - (-6 - u) * 0.2 : 1.4;
    if (u > -9 && u < 10 && r > 0 && v * v + (z - 3.4) ** 2 * 1.3 < r * r) {
      if (u > 2 && u < 5.6 && z > 3.8) return z > 4.4 ? GLASS_L : GLASS; // canopy
      if (u > 8.6) return GUN_D; // nose probe
      if (u < -7.6) return BLACK; // exhaust
      if (z < 2.9) return shade(f.dark, -0.05);
      if (Math.abs(u + 2) < 0.35) return WHITE;
      return g(f.main, u, v, z);
    }
    // intakes either side of the cockpit
    if (u > -0.6 && u < 2.6 && Math.abs(av - 1.6) < 0.5 && Math.abs(z - 3.4) < 0.7) return u > 2 ? BLACK : f.dark;
    // swept wings, a little anhedral, tipped in the light color
    const sweep = -av * 0.55;
    if (av < 7 && u < 1.6 + sweep && u > -2.4 + sweep && Math.abs(z - (3.1 - av * 0.06)) < 0.35) return av > 6 ? f.light : Math.abs(av - 4) < 0.3 ? f.dark : g(mix(f.main, f.light, 0.2), u, v, z);
    // missiles under the wings
    if (Math.abs(av - 3.6) < 0.4 && u > -2.6 + sweep * 0.3 && u < 2.4 && Math.abs(z - 2.4) < 0.4) return u > 1.8 ? RED : WHITE;
    // tailplanes and a fin
    if (av < 3.4 && u < -6 - av * 0.3 && u > -8.6 - av * 0.3 && Math.abs(z - 3.6) < 0.3) return f.dark;
    if (av < 0.3 && u < -5.4 && u > -8.6 && z > 4 && z < 7.6 - (u + 5.4) * -0.3 - 0.4 && z < 4 + (u + 9) * 1.2) return z > 6.4 ? f.light : g(f.dark, u, v, z);
    // landing legs and wheels
    for (const [lu, lv] of [[5.4, 0], [-3, 1.8], [-3, -1.8]]) {
      if (Math.abs(u - lu) < 0.3 && Math.abs(v - lv) < 0.3 && z < 2.4 && z > 0.6) return GUN_D;
      if ((u - lu) ** 2 + (z - 0.5) ** 2 < 0.35 && Math.abs(v - lv) < 0.4) return WHEEL;
    }
    return null;
  };
}

// The paratroop plane: a big high-winged four-engined transport (drawn
// overhead, so no wheels), its rear door open.
function cargoPlane(f: Faction): Shape {
  return (u, v, z) => {
    const av = Math.abs(v);
    const r = u > 10 ? 2.6 * Math.sqrt(Math.max(0, 1 - ((u - 10) / 5) ** 2)) : u < -9 ? 2.6 - (-9 - u) * 0.28 : 2.6;
    if (u > -18 && u < 15 && r > 0 && v * v + (z - 3) ** 2 < r * r) {
      if (u > 11.6 && z > 3.6 && av < 1.6) return GLASS_D; // flight deck windows
      if (u < -14 && z < 2.4) return BLACK; // the open door
      if (z < 1.4) return shade(f.dark, -0.06);
      if (Math.abs(u - 2) < 0.4) return WHITE;
      return g(mix(f.main, METAL, 0.45), u, v, z);
    }
    // the high straight wing with four engines under it
    if (av < 20 && u > -2 + av * 0.04 && u < 2.4 + av * -0.02 && Math.abs(z - 5.2) < 0.4) return av > 18.6 ? f.light : g(mix(f.main, METAL, 0.55), u, v, z);
    for (const ev of [6, 11.5]) {
      if (Math.abs(av - ev) < 1 && u > -0.6 && u < 4.4 && Math.abs(z - 4.2) < 0.9) return u > 3.8 ? BLACK : GUN;
      if (Math.abs(av - ev) < 0.25 && Math.abs(u - 4.6) < 0.2 && Math.abs(z - 4.2) < 2.6) return GUN_D; // a blurred propeller
    }
    // the tail: a tall fin and tailplanes
    if (av < 0.4 && u < -12 && u > -18 && z > 3 && z < 3 + (u + 18) * 1.1 && z < 10) return z > 8.6 ? f.light : g(f.dark, u, v, z);
    if (av < 7 && u < -14.6 && u > -18 && Math.abs(z - 4.6) < 0.35) return f.dark;
    return null;
  };
}

// ---------- Foot soldiers ----------
// Each one is built from capsules (limbs, weapons) on a slim torso, about
// eleven units tall: a little over half a tank's height and a third as wide
// as it is tall. frame: 0 standing at the ready, 1 and 2 the two strides of a
// walk, 3 a grenadier's throw (an engineer's wrench swung up), 4 kneeling
// (a G.I. dug in).
export type Trooper = 'gi' | 'rocket' | 'gren' | 'eng' | 'cmdo' | 'flame';
type P3 = [number, number, number];

// ---------- Ships ----------

const HULL = hex('#9ea4a6');
const DECK = hex('#6f7476');
const KEEL = hex('#7a3b33');

// A ship's hull from its stern (u0) to its bow (u1), half beam w, deck at
// z = h: a pointed bow, a square stern, dark red below the waterline under a
// white boot stripe, and the side's color in a band under the deck edge.
// Returns undefined off the hull's span (so the ship's top can be looked
// for), null for empty air beside it.
function hullAt(u: number, v: number, z: number, f: Faction, u0: number, u1: number, w: number, h: number): RGB | null | undefined {
  if (u < u0 || u > u1 || z > h) return undefined;
  const bowL = Math.min(12, (u1 - u0) * 0.35);
  const flare = z < h * 0.7 ? 0.8 + (0.2 * z) / (h * 0.7) : 1;
  const hw = (u > u1 - bowL ? w * Math.sqrt(Math.max(0, (u1 - u) / bowL)) : u < u0 + 1.5 ? w - (u0 + 1.5 - u) * 0.6 : w) * flare;
  const av = Math.abs(v);
  if (av > hw) return null;
  const side = av > hw - 0.8 || u < u0 + 0.6;
  if (z > h - 0.6 && !side) {
    if (av > hw - 1.5) return shade(DECK, -0.2);
    if (mod(u, 3) < 0.4) return shade(DECK, -0.1);
    return g(DECK, u, v, z, 0.06);
  }
  if (!side) return shade(HULL, -0.25);
  if (z < 0.9) return KEEL;
  if (z < 1.4) return WHITE;
  if (z > h - 1.2 && z < h - 0.6 && u < u1 - bowL) return f.main;
  return g(HULL, u, v, z, 0.05);
}

// A rail of stanchions round a deck at height h.
const rail = (u: number, av: number, z: number, h: number, hw: number) => z > h && z <= h + 1.3 && av > hw - 1.3 && av <= hw - 0.5 && (z > h + 0.9 || mod(u, 3) < 0.5);

// The Otter: an amphibious hovercraft on a black rubber skirt, a cabin up
// front with its windows, a cargo well, and two ducted fans at the stern.
function hovercraft(f: Faction): Shape {
  const skirt = hex('#2a2a28');
  return (u, v, z) => {
    const av = Math.abs(v);
    if (u < -11.5 || u > 11 || av > 6.4 || z > 9) return null;
    // the skirt: a fat rounded ring under it all
    const ru = Math.max(0, Math.abs(u + 0.25) - 5.5);
    const rv = Math.max(0, av - 2.4);
    const d = Math.hypot(ru, rv);
    if (z < 2.2) {
      if (d > 5.6 - (z < 1 ? (1 - z) * 0.8 : 0)) return null;
      return mod(u * 0.8 + v * 0.8, 3) < 0.25 ? shade(skirt, -0.3) : g(skirt, u, v, z, 0.1);
    }
    // the deck
    if (z < 3 && d < 5) return av > 5.4 ? f.dark : z > 2.6 && av < 3 && u > -6 && u < 1 ? shade(DECK, -0.3) : g(mix(HULL, f.main, 0.15), u, v, z);
    // the cabin, with a windscreen across its front and side windows
    if (u > 1 && u < 8.2 && av < 4.2 && z < 6.8) {
      if (z > 4.6 && z < 5.9) {
        if (u > 7.6) return mod(v + 9, 2.2) < 0.35 ? f.dark : GLASS_L;
        if (av > 3.6) return mod(u, 2.2) < 0.4 ? f.dark : GLASS_D;
      }
      if (z > 6.3) return g(mix(f.main, f.light, 0.4), u, v, z);
      return g(f.main, u, v, z);
    }
    // a little mast and lamp on the cabin roof
    if (Math.abs(u - 3) < 0.35 && av < 0.35 && z < 8.6) return z > 8.1 ? LAMP : GUN_D;
    // the cargo well's side rails
    if (u > -7 && u <= 1 && Math.abs(av - 4.6) < 0.5 && z < 4.2) return z > 3.7 ? STEEL : GUN;
    // two ducted fans side by side at the stern, facing back, with rudders
    for (const cv of [-3.1, 3.1]) {
      const r = Math.hypot(v - cv, z - 5.6);
      if (u > -10.6 && u < -8.6) {
        if (r > 2 && r < 2.7) return g(f.dark, u, v, z);
        if (r < 2 && u > -9.8 && u < -9.4) return Math.abs(Math.sin(Math.atan2(z - 5.6, v - cv) * 2)) < 0.35 ? GUN_D : null;
      }
      if (u > -11.4 && u < -10.7 && Math.abs(v - cv) < 0.25 && Math.abs(z - 5.6) < 2) return GUN;
      if (u > -9 && u < -7 && Math.abs(v - cv) < 0.5 && z < 3.6) return GUN_D; // its pylon
    }
    return null;
  };
}

// The Destroyer: a long, lean warship with a gun turret on the bow, a
// bridge and mast amidships, a funnel, and a helicopter deck at the stern.
function destroyer(f: Faction): Shape {
  const H = 3;
  return (u, v, z) => {
    const av = Math.abs(v);
    const hull = hullAt(u, v, z, f, -19, 20, 4.4, H);
    if (hull !== undefined) return hull;
    if (u < -19 || u > 20 || z > 15) return null;
    // the helicopter deck: a white ring and H, a hangar in front of it
    if (u < -10 && z <= H + 0.1) return null;
    if (u > -10 && u < -5.6 && av < 3.2 && z < 6) return z > 5.5 ? CONC_L : u < -9.6 ? (av < 2.4 && z < 5.4 ? GUN_D : g(HULL, u, v, z)) : g(HULL, u, v, z);
    // the bridge block, the side's color on top, windows wrapped round its front
    if (u > -5.6 && u < 7 && av < 3 && z < 7.6) {
      if (z > 5.6 && z < 6.8 && u > 3) {
        if (u > 6.4) return mod(v + 9, 2) < 0.35 ? f.dark : GLASS_L;
        if (av > 2.4) return mod(u, 2.2) < 0.4 ? f.dark : GLASS_D;
      }
      if (z > 7) return g(f.main, u, v, z);
      return g(u < 3 && z > 5 ? shade(HULL, 0.08) : HULL, u, v, z);
    }
    // the mast: a radar bar and a light at the top
    if (Math.abs(u - 1.5) < 0.4 && av < 0.4 && z < 14.6) return z > 14 ? RED : GUN_D;
    if (Math.abs(u - 1.5) < 0.5 && av < 2.4 && Math.abs(z - 12) < 0.4) return STEEL;
    if (Math.abs(u - 1.5) < 1.4 && av < 0.5 && Math.abs(z - 10.2) < 0.5) return GUN;
    // the funnel
    if (cyl(u, v, -3.6, 0, 1.4) && z < 10) return z > 9.4 ? BLACK : z > 8.4 ? f.main : GUN_L;
    // the gun turret on the bow, on its ring, with its barrel
    const gd = (u - 12) ** 2 + v * v;
    if (gd < 5 && z < H + 0.7) return GUN_D;
    if (gd < 3.6 && z < H + 2.6) return g(z > H + 2.1 ? mix(f.main, f.light, 0.5) : f.main, u, v, z);
    if (u > 12.5 && u < 18 && av < 0.4 && Math.abs(z - (H + 1.6)) < 0.4) return u > 17.4 ? BLACK : GUN;
    // depth charge racks at the stern corners, and the rail round the bow
    if (u > -18.6 && u < -16.4 && Math.abs(av - 3) < 0.7 && z < H + 1.3) return z > H + 0.9 ? GUN_D : OLIVE;
    if (u > 7 && u < 16 && rail(u, av, z, H, 4.4)) return STEEL;
    return null;
  };
}

// The Skyguard cruiser, styled after the Skyguard battery: two round raised
// launcher rings, fore and aft (the game draws the battery's own turning
// four-tube launcher on each, at CRUISER_LAUNCHERS), and a superstructure
// carrying a big white radar dome. It is drawn in two parts so a launcher
// behind the superstructure is hidden by it: the hull with the rings, and
// the superstructure on its own ('top').
export const CRUISER_LAUNCHERS = [11, -11];
export const CRUISER_RING_Z = 4.6;
function cruiser(f: Faction, part: 'hull' | 'top'): Shape {
  const H = 3.2;
  return (u, v, z) => {
    const av = Math.abs(v);
    if (part === 'hull') {
      const hull = hullAt(u, v, z, f, -18, 19, 5, H);
      if (hull !== undefined) return hull;
      if (u < -18 || u > 19 || z > CRUISER_RING_Z) return null;
      // the launcher rings, like the battery's emplacement
      for (const cu of CRUISER_LAUNCHERS) {
        const d = Math.hypot(u - cu, v);
        const rr = 4 - Math.max(0, z - H - 0.6) * 0.6;
        if (d < rr) {
          const a = Math.atan2(v, u - cu);
          if (z > CRUISER_RING_Z - 0.5) return d > rr - 0.8 ? PLAS_L : d < 2.2 ? GUN : mod(a * 6 / Math.PI, 1) < 0.1 ? GUN_D : TAR;
          if (z > H + 0.4 && z < H + 0.9) return g(f.main, u, v, z);
          return g(PLAS, u, v, z);
        }
      }
      // hazard stripes at the stern, and the rail round the bow
      if (u < -15.4 && u > -17.4 && av < 2.4 && z < H + 0.1) return hazard(u, v);
      if (u > 15 && u < 18 && rail(u, av, z, H, 2.6)) return STEEL;
      return null;
    }
    // the superstructure, narrower as it rises, with the side's color round its top
    const top = 8.4;
    const shrink = Math.max(0, z - H) * 0.14;
    if (z > H - 0.1 && u > -5.5 + shrink && u < 5.2 - shrink && av < 3.6 - shrink && z < top) {
      // bridge windows across the front, a hazard band low down
      if (u > 4.6 - shrink && z > 5.6 && z < 6.7) return mod(v + 9, 2) < 0.35 ? f.dark : GLASS_L;
      if (av > 3.1 - shrink && z > 5.8 && z < 6.5) return mod(u, 2.4) < 0.5 ? f.dark : GLASS_D;
      if (z > top - 0.7) return g(f.main, u, v, z);
      if (z > H + 0.9 && z < H + 1.5) return hazard(u + v, z * 0);
      return g(PLAS, u, v, z);
    }
    // equipment boxes either side, olive with a hazard stripe, like the battery's
    if (u > -4 && u < -1 && Math.abs(av - 4.1) < 0.6 && z > H - 0.1 && z < H + 1.6) return z > H + 1.2 ? OLIVE : Math.abs(u + 2.5) < 0.25 ? HAZ : OLIVE_D;
    // the radar dome on a short round tower: the cruiser's mark, seen from far off
    const dc = Math.hypot(u + 0.5, v);
    if (dc < 1.6 && z >= top - 0.1 && z < 10.6) return PLAS_D;
    const ds = Math.hypot(u + 0.5, v, z - 12.4);
    if (ds < 3.2) return mod(Math.atan2(v, u + 0.5) * 3, 1) < 0.08 || Math.abs(z - 12.4) < 0.2 ? PLAS_D : WHITE;
    // a whip mast behind it, with a light
    if (Math.abs(u + 4.4) < 0.35 && av < 0.35 && z >= top - 0.1 && z < 14.4) return z > 13.8 ? RED : GUN_D;
    return null;
  };
}

// How much bigger the carrier is drawn than the shape below is modelled:
// it is the largest ship afloat, with room on deck for a dozen Swift jets
// (see CARRIER_SLOTS in combat.ts, which must match).
export const CARRIER_SCALE = 2.5;

// The carrier: a long flat flight deck over a broad hull, an island tower
// on the starboard side and deck markings. (The jets it carries park on the
// deck; they are drawn on their own.)
function carrier(f: Faction): Shape {
  const at = carrierAt(f);
  const s = 1 / CARRIER_SCALE;
  return (u, v, z) => at(u * s, v * s, z * s);
}

function carrierAt(f: Faction): Shape {
  const H = 4.6;
  const DK = hex('#55595b');
  return (u, v, z) => {
    const av = Math.abs(v);
    if (u < -27 || u > 28 || av > 10 || z > 17) return null;
    // the hull, narrower than the deck
    if (z < H) {
      const hull = hullAt(u, v, z, f, -26, 27, 7.4, H);
      return hull === undefined ? null : hull;
    }
    // the flight deck: a slab that overhangs the hull, angled to port
    const dw = u > 18 ? 9.4 * Math.sqrt(Math.max(0, (28 - u) / 10)) : 9.4;
    const portCut = v < -6.5 && u > 4; // the angled deck sticks out to port further back
    if (z < H + 1 && av < dw && u > -26.5 && !portCut) {
      if (z < H + 0.6) return av > dw - 0.5 ? f.dark : shade(DK, -0.2);
      // markings: a dashed white centre line, an angled landing line, and a yellow edge
      if (av > dw - 0.5) return HAZ;
      if (av < 0.3 && mod(u, 4) < 2) return WHITE;
      if (Math.abs(v + 2 - (u + 26) * 0.12) < 0.25 && u < 10) return WHITE;
      if (u > 20 && u < 23 && av < 3 && mod(Math.floor(v), 2)) return HAZ; // the bow's number block
      return g(DK, u, v, z, 0.05);
    }
    // the island on the starboard side: a stepped tower with a bridge, a mast and radar
    if (v > 5.6 && v < 8.6 && u > -7 && u < 6 && z < 13) {
      if (z > 10.4 && z < 11.6 && (u > 5.4 || v < 6.2)) return mod(u + v, 2) < 0.4 ? f.dark : GLASS_L;
      if (z > 12.4) return g(f.main, u, v, z);
      if (u < -3 && z > 9) return null;
      return g(shade(HULL, 0.06), u, v, z);
    }
    if (Math.abs(u - 1) < 0.4 && Math.abs(v - 7) < 0.4 && z < 16.6) return z > 16 ? RED : GUN_D;
    if (Math.abs(u - 1) < 0.5 && Math.abs(v - 7) < 2.4 && Math.abs(z - 14.4) < 0.35) return STEEL;
    if (cyl(u, v, -5, 7.1, 1.1) && z < 11.4) return z > 10.8 ? BLACK : GUN;
    return null;
  };
}

// The submarine: a long dark cigar riding low in the water, a sail (its
// tower) with diving planes, and a cross of fins at the tail.
function submarine(f: Faction): Shape {
  const SUBC = hex('#3b4043');
  return (u, v, z) => {
    const av = Math.abs(v);
    if (u < -16.5 || u > 15 || av > 4.4 || z > 8) return null;
    // the hull: round in section, tapering at both ends
    const t = u > 9 ? Math.sqrt(Math.max(0, (15 - u) / 6)) : u < -9 ? Math.max(0, (u + 16) / 7) : 1;
    const R = 2.7 * t;
    const dz = z - 0.6;
    if (v * v + dz * dz < R * R) {
      if (dz > R - 0.5 && av < 0.4 && mod(u, 2) < 1) return shade(SUBC, -0.25); // deck line
      return g(SUBC, u, v, z, 0.06);
    }
    // the sail, with the side's color in a band, and planes on its sides
    if (u > 1.5 && u < 6.4 && av < 0.9 * (1 - Math.max(0, u - 5.4) * 0.6) && z < 7) {
      if (z > 6.4) return GUN_D;
      if (z > 4.6 && z < 5.4) return f.main;
      return g(SUBC, u, v, z);
    }
    if (u > 3 && u < 4.4 && av < 3.2 && Math.abs(z - 5) < 0.25) return GUN_D;
    // the periscope
    if (Math.abs(u - 2.6) < 0.25 && av < 0.25 && z < 7.9) return z > 7.6 ? GLASS : GUN;
    // tail fins and the propeller
    if (u < -12.5 && u > -15.5 && ((av < 0.25 && Math.abs(dz) < 2.6) || (Math.abs(dz) < 0.25 && av < 2.6))) return GUN_D;
    if (u < -15.6 && u > -16.4 && Math.hypot(v, dz) < 1.4) return COPPER;
    return null;
  };
}

// One of the carrier's drones: a little flying wing, seen tiny.
function drone(f: Faction): Shape {
  return (u, v, z) => {
    if (z > 1.2) return null;
    const av = Math.abs(v);
    if (u > 2.4 || u < -2.2) return null;
    // swept wings
    if (av < 3 && u < 1.2 - av * 0.55 && u > -0.6 - av * 0.55) return av > 2.4 ? f.main : GUN;
    if (av < 0.6) return z > 0.6 ? GLASS_D : GUN_D;
    return null;
  };
}

// Distance from (u, v, z) to the segment a-b.
function segD(u: number, v: number, z: number, a: P3, b: P3): number {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const px = u - a[0];
  const py = v - a[1];
  const pz = z - a[2];
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz || 1)));
  return Math.hypot(px - bx * t, py - by * t, pz - bz * t);
}
const limb = (u: number, v: number, z: number, a: P3, b: P3, c: P3, r: number) => Math.min(segD(u, v, z, a, b), segD(u, v, z, b, c)) < r;

const KHAKI = hex('#9a8a62');
const BRASS = hex('#c9a24a');
const GRENADE = hex('#f2f0e6'); // white, so a grenadier's grenades show up
const HARDHAT = hex('#f2c418');
const CASE_D = hex('#a87d0c');
const STRAP = hex('#26241f');
const GEAR = hex('#3b3d34');
const HAZARD = hex('#e0b52e');
const FUEL = hex('#b8452f');
const SUIT = hex('#b8a27a');
const MASK = hex('#4a4a44');

// Where each kind holds its weapon (standing; kneeling drops it KNEEL_DROP),
// for the muzzle flash in combat.ts.
export const KNEEL_DROP = 1.8;
const BAG_H = 3.45;
export const TROOPER_MUZZLE: Record<Trooper, P3> = { gi: [4.6, 0.65, 7.1], rocket: [4, 1.4, 9.1], gren: [-0.3, 1.3, 10.4], eng: [1.2, -1, 9.6], cmdo: [3.5, 0.85, 7.45], flame: [3.9, 0.6, 6.75] };

// bags: how far up the sandbags round a dug-in G.I. have been stacked (0 to 1).
export function soldier(f: Faction, kind: Trooper, frame: number, bags = 0): Shape {
  const body =
    kind === 'rocket' ? mix(f.main, OLIVE, 0.4) : kind === 'gren' ? mix(f.main, KHAKI, 0.5) : kind === 'eng' ? mix(f.main, KHAKI, 0.6) : kind === 'cmdo' ? mix(BLACK, f.main, 0.1) : kind === 'flame' ? mix(f.main, SUIT, 0.55) : f.main;
  const bodyD = shade(body, -0.2);
  const trouser = kind === 'cmdo' ? hex('#1f1e1c') : shade(f.dark, -0.08);
  const helmet = kind === 'rocket' ? OLIVE_D : kind === 'eng' ? HARDHAT : kind === 'cmdo' ? f.main : kind === 'gren' ? f.main : kind === 'flame' ? hex('#7a7a6e') : shade(f.dark, 0.05);
  const vest = mix(OLIVE_D, body, 0.25);
  const kneel = frame === 4;
  const dz = kneel ? -KNEEL_DROP : 0;
  // the stride: how far forward each foot is (+ for the left, - for the right)
  const s = frame === 1 ? 1.1 : frame === 2 || frame === 3 ? -1.1 : 0;
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  // the legs: hip, knee and ankle of each
  const legs: [P3, P3, P3, number][] = kneel
    ? [
        [[0, -0.5, 3.2], [1.7, -0.5, 3.1], [1.6, -0.5, 0.7], -1],
        [[0, 0.5, 3.2], [0.5, 0.5, 0.5], [-1.4, 0.5, 0.5], 1],
      ]
    : [
        [[0, -0.5, 5], [s * 0.55 + 0.2 * Math.abs(s), -0.5, 2.7], [s, -0.5, 0.8], -1],
        [[0, 0.5, 5], [-s * 0.55 + 0.2 * Math.abs(s), 0.5, 2.7], [-s, 0.5, 0.8], 1],
      ];
  const sh = (side: number): P3 => [0, side * 1.2, 7.9 + dz];
  // arms: shoulder, elbow, hand
  let armL: [P3, P3, P3];
  let armR: [P3, P3, P3];
  if (kind === 'gi') {
    armR = [sh(1), [-0.3, 1.45, 6.6 + dz], [0.6, 0.85, 6.9 + dz]];
    armL = [sh(-1), [0.9, -1.15, 6.6 + dz], [2.1, 0.35, 7 + dz]];
  } else if (kind === 'rocket') {
    // the launcher rides on the right shoulder: the right hand on its grip,
    // the left reaching across to steady it
    armR = [sh(1), [0.3, 1.75, 6.9], [1, 1.45, 8.2]];
    armL = [sh(-1), [1, -0.8, 7.1], [2, 0.9, 8.4]];
  } else if (kind === 'cmdo') {
    // a pistol held out in each hand
    armR = [sh(1), [0.9, 1.4, 7.05 + dz], [2.1, 0.85, 7.35 + dz]];
    armL = [sh(-1), [0.9, -1.4, 7.05 + dz], [2.1, -0.85, 7.35 + dz]];
  } else if (kind === 'flame') {
    // both hands on the flame wand, held low and forward
    armR = [sh(1), [0.3, 1.45, 6.5], [1.3, 0.75, 6.35]];
    armL = [sh(-1), [0.9, -1.15, 6.8], [2.3, 0.45, 6.55]];
  } else if (kind === 'eng') {
    // the right hand carries the toolbox; the left swings, or holds the
    // wrench up to work (frame 3)
    armR = [sh(1), [0.05, 1.6, 6.5], [0.15 + swing * 0.25, 1.65, 5.2]];
    armL = frame === 3 ? [sh(-1), [0.9, -1.4, 7.6], [1.3, -1.05, 8.9]] : [sh(-1), [-0.1 - swing * 0.3, -1.45, 6.6], [0.2 - swing * 0.7, -1.35, 5.5]];
  } else if (frame === 3) {
    armR = [sh(1), [-0.9, 1.5, 8.8], [-0.4, 1.3, 10.1]];
    armL = [sh(-1), [0.9, -1.4, 8.2], [1.9, -1, 8.6]];
  } else {
    armR = [sh(1), [0.1 + swing * 0.3, 1.45, 6.6], [0.5 + swing * 0.7, 1.35, 5.6]];
    armL = [sh(-1), [-0.1 - swing * 0.3, -1.45, 6.6], [0.2 - swing * 0.7, -1.35, 5.5]];
  }
  const grenadeAt: P3 | null = kind !== 'gren' ? null : frame === 3 ? [-0.35, 1.3, 10.5] : [armR[2][0] + 0.15, 1.35, 5.3];

  return (u, v, z) => {
    // ----- the sandbag ring (dug in), open at the back
    if (bags > 0 && z < BAG_H * bags) {
      const d = Math.hypot(u, v);
      const lean = z * 0.18;
      if (d > 2.9 + lean && d < 4.4 - lean && !(u < -1.5 && Math.abs(v) < 1.6)) {
        const course = Math.floor(z / 1.15);
        const a = Math.atan2(v, u) * 2.6 + course * 0.5;
        if (mod(a, 1) < 0.14 || z - course * 1.15 < 0.22) return shade(SAND_BAG, -0.32);
        if (z - course * 1.15 > 0.9) return shade(SAND_BAG, 0.08);
        return shade(SAND_BAG, (hash2(Math.floor(a), course, 5) - 0.5) * 0.22);
      }
    }
    return soldierBody(u, v, z, Math.abs(v));
  };

  function soldierBody(u: number, v: number, z: number, av: number): RGB | null {
    // ----- weapons first, so they stand out of the body
    if (kind === 'gi') {
      const y = 0.65;
      const h = 7.1 + dz;
      // a big, dark rifle, so a G.I. reads as one at a glance
      if (segD(u, v, z, [-0.7, y, h + 0.4], [0.4, y, h + 0.05]) < 0.46) return mod(Math.floor(u * 2), 3) === 0 ? shade(WOOD, -0.2) : shade(WOOD, -0.32); // stock
      if (segD(u, v, z, [0.4, y, h], [1.8, y, h]) < 0.5) return z > h + 0.3 ? GUN : GUN_D; // receiver
      if (segD(u, v, z, [1.2, y, h - 0.2], [1.5, y, h - 1.4]) < 0.36) return BLACK; // magazine
      if (segD(u, v, z, [1.8, y, h], [3, y, h]) < 0.42) return z > h + 0.25 ? GUN_D : BLACK; // handguard
      if (segD(u, v, z, [3, y, h], [4.5, y, h]) < 0.32) return BLACK; // barrel
    } else if (kind === 'rocket') {
      // a big, dark tube resting on the right shoulder
      const y = 1.4;
      const h = 9.1;
      const rr = (v - y) ** 2 + (z - h) ** 2;
      if (u > 2.7 && u < 4 && rr < (0.72 - (u - 2.7) * 0.5) ** 2) return z > h + 0.25 ? shade(RED, 0.1) : shade(RED, -0.1); // the warhead
      if (u > -2.8 && u <= 2.7 && rr < 0.5) {
        if (u < -2.4 || (u > 2.3 && rr > 0.3)) return BLACK; // flared ends
        if (Math.abs(u - 1.7) < 0.22 || Math.abs(u + 1.3) < 0.22) return BLACK;
        return z > h + 0.4 ? shade(OLIVE_D, -0.1) : shade(OLIVE_D, -0.35);
      }
      if (inBox(u, v, z, 0.5, 1.5, y + 0.6, y + 1, h - 0.2, h + 0.5)) return u > 1.3 ? GLASS : GUN_D; // the sight, out to the side
      if (segD(u, v, z, [1, y, h - 0.5], [1, y, h - 1]) < 0.25) return GUN_D; // grip
    } else if (kind === 'cmdo') {
      // a pistol in each fist, barrel forward
      for (const arm of [armL, armR]) {
        const [hu, hv, hz] = arm[2];
        if (segD(u, v, z, [hu + 0.1, hv, hz + 0.05], [hu + 1.35, hv, hz + 0.1]) < 0.32) return u > hu + 1.1 ? BLACK : z > hz + 0.2 ? GUN : GUN_D;
        if (segD(u, v, z, [hu, hv, hz], [hu - 0.1, hv, hz - 0.6]) < 0.26) return BLACK;
      }
    } else if (kind === 'flame') {
      // the wand: a steel tube with a nozzle and a pilot flame, its hose back to the tanks
      if (segD(u, v, z, [0.7, 0.6, 6.2], [3.55, 0.6, 6.7]) < 0.32) return u > 3.2 ? BLACK : u < 1.2 ? GUN_D : mod(Math.floor(u * 2), 3) === 0 ? GUN : METAL_D;
      const pf = (u - 3.85) ** 2 + (v - 0.6) ** 2 + (z - 6.85) ** 2;
      if (pf < 0.2) return pf < 0.07 ? hex('#fff1b0') : hex('#ffb347'); // the pilot flame
      if (segD(u, v, z, [0.7, 0.6, 6.1], [-1.1, 0.7, 5.6]) < 0.18) return BLACK;
    } else if (kind === 'eng') {
      // a big yellow briefcase in the right hand, its handle in the fist
      const bu = armR[2][0];
      if (inBox(u, v, z, bu - 1.25, bu + 1.25, 1.4, 2.2, 2.4, 4.75)) {
        if (Math.abs(z - 4.1) < 0.14) return CASE_D; // where the lid closes
        if (z > 4.55 || Math.abs(Math.abs(u - bu) - 1.25) < 0.15) return shade(HARDHAT, z > 4.55 ? 0.15 : -0.12); // rims
        if (Math.abs(z - 4.1) < 0.3 && Math.abs(Math.abs(u - bu) - 0.6) < 0.18) return GUN_L; // clasps
        return g(HARDHAT, u, v, z, 0.06);
      }
      if (segD(u, v, z, [bu - 0.45, 1.8, 5], [bu + 0.45, 1.8, 5]) < 0.18) return BLACK; // its handle
      // a big wrench: held up to work, or slung across the back
      const [w0, w1]: [P3, P3] = frame === 3 ? [[1.3, -1.05, 8.2], [1.25, -1, 10.6]] : [[-1.05, -0.95, 5.4], [-1.05, 0.75, 9.5]];
      if (segD(u, v, z, w0, w1) < 0.22) return GUN_L;
      const jaw = (u - w1[0]) ** 2 + (v - w1[1]) ** 2 + (z - w1[2]) ** 2;
      if (jaw < 0.36 && jaw > 0.08) return z > w1[2] ? shade(GUN_L, 0.15) : GUN;
    }
    if (grenadeAt && (u - grenadeAt[0]) ** 2 + (v - grenadeAt[1]) ** 2 + (z - grenadeAt[2]) ** 2 < 0.45) return z > grenadeAt[2] + 0.45 ? GUN_D : z < grenadeAt[2] - 0.3 ? shade(GRENADE, -0.18) : GRENADE;
    // ----- hands and arms
    for (const arm of [armL, armR]) {
      const hd = (u - arm[2][0]) ** 2 + (v - arm[2][1]) ** 2 + (z - arm[2][2]) ** 2;
      if (hd < 0.2) return SKIN;
      if (limb(u, v, z, arm[0], arm[1], arm[2], 0.42)) return segD(u, v, z, arm[0], arm[0]) < (kind === 'cmdo' ? 0.75 : 0.5) ? (kind === 'cmdo' ? f.main : shade(body, 0.08)) : body;
    }
    // ----- the head: face, and a helmet (a grenadier's cap) over it
    const hz = 9.55 + dz;
    const hr2 = (u - 0.1) ** 2 + v * v + (z - hz) ** 2;
    if (z > hz + 0.05) {
      if (kind === 'eng') {
        // a hard hat: a round dome with a ridge, and a brim all round
        // (big and bright, so an engineer is easy to spot)
        const r = Math.hypot(u - 0.1, v);
        if (z < hz + 0.3 && r < 1.55) return shade(helmet, -0.15);
        if ((r / 1.2) ** 2 + ((z - hz - 0.2) / 1.05) ** 2 < 1.0) return Math.abs(v) < 0.18 ? shade(helmet, 0.22) : z > hz + 0.85 ? shade(helmet, 0.14) : helmet;
      } else if (kind === 'cmdo') {
        // a beret, pulled down to one side
        // (in the side's color, the one bit of it on him besides the shoulders)
        const r2 = (u + 0.05) ** 2 + v * v;
        if (r2 < 1.1 && z < hz + 0.6 - v * 0.14) return z > hz + 0.4 - v * 0.14 ? shade(helmet, 0.12) : helmet;
        if (r2 < 1.1 && z < hz + 0.8 && Math.abs(u + 0.1) < 0.3 && Math.abs(v + 0.5) < 0.3) return BRASS; // its badge
      } else if (kind === 'gren') {
        // a tall grenadier's cap in the side's color, a brass plate on the
        // front and a white grenade badge on top: nobody else is this tall
        const k = z - hz;
        const cr = 0.95 - k * 0.22;
        const cu = (u + 0.05) - k * 0.08;
        if (k < 2.3 && cu * cu + v * v < cr * cr) {
          if (k < 0.3) return shade(helmet, -0.25); // the band
          if (cu > cr * 0.45 && av < 0.5 && k < 1.9) return k > 1.6 ? shade(BRASS, 0.15) : BRASS; // the plate
          return k > 1.8 ? shade(helmet, 0.12) : helmet;
        }
        const tb = (u + 0.05 - 0.2) ** 2 + v * v + (k - 2.55) ** 2;
        if (tb < 0.22) return z > hz + 2.6 ? GRENADE : shade(GRENADE, -0.12);
      } else {
        const r2 = u * u + v * v + (z - hz + 0.15) ** 2;
        if (r2 < 1.2 && z < hz + 0.3 && r2 > 0.7) return shade(helmet, -0.22); // the brim
        if (r2 < 1.12) return z > hz + 0.75 ? shade(helmet, 0.14) : Math.abs(z - hz - 0.35) < 0.12 ? shade(helmet, -0.15) : helmet;
      }
    }
    if (kind === 'flame' && hr2 < 0.8 && u > 0.15) {
      // a gas mask: goggles and a filter on the chin
      if (u > 0.45 && z > hz - 0.05 && z < hz + 0.35 && av > 0.12 && av < 0.5) return GLASS_D;
      return MASK;
    }
    if (kind === 'flame' && (u - 0.95) ** 2 + v * v + (z - hz + 0.45) ** 2 < 0.13) return GUN_D;
    if (kind === 'cmdo' && hr2 < 0.78) {
      // a black balaclava, open only round the eyes
      if (u > 0.4 && z > hz - 0.05 && z < hz + 0.4) return av > 0.15 && av < 0.45 && z < hz + 0.3 ? hex('#e8e4d4') : SKIN;
      return z > hz + 0.3 ? hex('#2a2825') : hex('#1f1e1c');
    }
    if (hr2 < 0.74) {
      if (u < -0.2) return kind === 'gren' || kind === 'eng' || kind === 'cmdo' ? hex('#4a3322') : shade(helmet, -0.1); // back of the head
      if (u > 0.45 && z > hz && z < hz + 0.3 && av > 0.15 && av < 0.45) return BLACK; // eyes
      return z < hz - 0.45 ? shade(SKIN, -0.12) : SKIN;
    }
    if (u * u + v * v < 0.2 && z > 8.3 + dz && z <= hz) return shade(SKIN, -0.15); // neck
    // ----- packs on the back
    if (kind === 'rocket') {
      for (const pv of [-0.45, 0.45]) if ((u + 1.25) ** 2 + (v - pv) ** 2 < 0.13 && z > 6.2 && z < 9.2) return z > 8.8 ? RED : OLIVE_D; // spare rockets
      if (inBox(u, v, z, -1.6, -0.6, -0.8, 0.8, 5.8, 8)) return z > 7.7 ? shade(OLIVE_D, 0.1) : OLIVE_D;
    } else if (kind === 'gi') {
      if (inBox(u, v, z, -1.45, -0.6, -0.75, 0.75, 6.1 + dz, 8 + dz)) return z > 7.7 + dz ? shade(OLIVE, 0.12) : Math.abs(z - 7 - dz) < 0.15 ? OLIVE_D : OLIVE;
      if ((u + 1.05) ** 2 + (z - 8.3 - dz) ** 2 < 0.2 && av < 0.85) return SAND_BAG; // bedroll
    } else if (kind === 'flame') {
      // twin fuel tanks on the back, banded, with valves on top
      // (big ones, standing up past the shoulders so they show from the front too)
      for (const pv of [-0.78, 0.78]) {
        const d2 = (u + 1.45) ** 2 + (v - pv) ** 2;
        const top = 9.7 - d2 * 1.2;
        if (d2 < 0.48 && z > 4.6 && z < top) return z > top - 0.35 ? GUN_D : Math.abs(z - 8.1) < 0.22 || Math.abs(z - 5.6) < 0.2 ? HAZ : d2 < 0.16 && u < -1.6 ? shade(FUEL, 0.18) : FUEL;
        if ((u + 1.45) ** 2 + (v - pv) ** 2 < 0.05 && z < 10.2 && z >= top - 0.35) return GUN_L; // the valve
      }
      if (inBox(u, v, z, -1.3, -0.7, -1.1, 1.1, 5.2, 8.4)) return GUN_D; // the frame
    } else if (kind === 'cmdo') {
      // a radio pack with a tall whip antenna, a coil of rope under it
      if (segD(u, v, z, [-1.2, -0.45, 8.3 + dz], [-1.45, -0.55, 12.6 + dz]) < 0.32) return z > 12.1 + dz ? RED : BLACK;
      if (inBox(u, v, z, -1.6, -0.6, -0.75, 0.75, 6.1 + dz, 8.4 + dz)) return z > 8.1 + dz ? shade(GEAR, 0.15) : Math.abs(z - 7.2 - dz) < 0.15 ? STRAP : GEAR;
      if ((u + 1.1) ** 2 + (z - 5.8 - dz) ** 2 < 0.3 && av < 0.8) return mod(Math.floor(v * 3), 2) ? KHAKI : shade(KHAKI, -0.2); // rope
    } else if (kind === 'eng') {
      if (inBox(u, v, z, -1.35, -0.6, -0.7, 0.7, 6.2, 7.9)) return z > 7.6 ? shade(KHAKI, -0.05) : shade(KHAKI, -0.22); // a tool pack
    } else {
      if (inBox(u, v, z, -1.3, -0.6, -0.65, 0.65, 6.4, 7.9)) return OLIVE;
      if (inBox(u, v, z, -0.5, 0.6, -1.6, -0.95, 4.7, 6.1)) return z > 5.8 ? shade(OLIVE_D, 0.15) : Math.abs(u) < 0.15 ? BLACK : OLIVE_D; // satchel of grenades
      for (const gu of [-0.2, 0.35]) if ((u - gu) ** 2 + (v + 1.3) ** 2 + (z - 6.35) ** 2 < 0.12) return GRENADE; // two peeking out
    }
    // ----- the torso: a jacket under a chest rig, with a belt
    if (z >= 5 + dz && z < 8.4 + dz) {
      const zz = z - dz;
      const w = zz > 7 ? 1.2 : 1.02 + (zz - 5) * 0.09;
      const dd = (u / 0.72) ** 2 + (v / w) ** 2;
      if (dd < 1) {
        if (zz < 5.5) return u > 0.5 && av < 0.25 ? BRASS : BLACK; // belt and buckle
        if (zz > 8.1) return bodyD; // collar
        if (kind === 'cmdo') {
          // a chest rig crammed with pouches, a knife on the strap, C4 on the belt
          if (u > 0.2 && Math.abs(v + 0.75) < 0.15 && zz > 6.4 && zz < 7.7) return zz > 7.5 ? GUN_L : STEEL;
          if (u > 0.25 && zz > 5.6 && zz < 7.4) return zz > 7.15 || mod(Math.floor(v * 2.2 + 0.5), 2) ? shade(GEAR, 0.12) : GEAR;
          if (u < -0.3 && zz > 5.5 && zz < 6.2 && av > 0.6) return hex('#c8b27a'); // C4
          if (Math.abs(av - 0.6) < 0.2) return STRAP;
        }
        if (kind === 'gren' && u > 0 && (Math.abs(zz - (8 - (v + 1.1) * 0.7)) < 0.32 || Math.abs(zz - (8 - (1.1 - v) * 0.7)) < 0.32)) {
          // crossed bandoliers of white grenades
          return mod(Math.floor(v * 2.2), 2) ? GRENADE : STRAP;
        }
        if (kind === 'flame') {
          // the tank harness: black straps over both shoulders, a buckled chest strap
          if (Math.abs(av - 0.6) < 0.24 && zz > 5.6) return STRAP;
          if (u > 0 && Math.abs(zz - 7) < 0.2) return av < 0.22 ? BRASS : STRAP;
        }
        if (Math.abs(av - 0.6) < 0.18 && zz > 6.6) return shade(OLIVE_D, -0.15); // shoulder straps
        if (u > 0.3 && zz > 5.6 && zz < 6.7 && kind !== 'gren' && kind !== 'flame' && kind !== 'cmdo') return mod(Math.floor(v * 2 + 0.5), 2) ? shade(vest, 0.1) : vest; // pouches
        if (zz > 7.6 && av > 0.8) return shade(body, 0.1); // the lit tops of the shoulders
        return g(body, u, v, z, 0.05);
      }
    }
    // ----- legs and boots
    for (const [hip, knee, ankle, side] of legs) {
      // the boot, toe forward
      const fu = ankle[0];
      if (z < 0.95 && Math.abs(v - side * 0.5) < 0.42 && u > fu - 0.45 && u < fu + 0.75) return z > 0.7 ? hex('#3a2e24') : BLACK;
      if (limb(u, v, z, hip, knee, ankle, 0.48)) {
        const kd = Math.hypot(u - knee[0], v - knee[1], z - knee[2]);
        if (kd < 0.5 && u > knee[0]) return shade(trouser, -0.25); // knee pad
        if (z < 1.6 && !kneel) return shade(trouser, -0.12); // tucked into the boot
        if (kind === 'cmdo' && !kneel && z > 3.4 && z < 4.4 && Math.abs(v) > 0.75) return z > 4.2 ? shade(GEAR, 0.15) : GEAR; // thigh pouches
        return g(trouser, u, v, z, 0.05);
      }
    }
    return null;
  }
}

// An attack dog: a big shepherd in a collar of its side's color. frame: 0
// standing, 1 and 2 the two beats of a gallop, 3 lunging, jaws open.
const FUR = hex('#8a6438');
const FUR_D = hex('#2e241c');
const FUR_L = hex('#b58c5a');
function dog(f: Faction, frame: number): Shape {
  const run = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const lunge = frame === 3;
  const lift = lunge ? 0.9 : Math.abs(run) * 0.3;
  // legs: shoulder or hip, and paw
  const legs: [P3, P3][] = [];
  for (const side of [-1, 1]) {
    const fr = lunge ? 1.4 : run * 0.9;
    legs.push([[1.7, side * 0.55, 3.2 + lift], [1.7 + fr + (lunge ? 0.6 : 0), side * 0.55, lunge ? 1.6 : 0.35]]);
    legs.push([[-1.8, side * 0.5, 3.3], [-1.8 - run * 0.9 - (lunge ? 0.5 : 0), side * 0.5, 0.35]]);
  }
  const hx = 3 + (lunge ? 0.5 : 0);
  const hz = 5 + lift * 0.8;
  return (u, v, z) => {
    const av = Math.abs(v);
    // the head and muzzle, ears up; open jaws when it lunges
    const hd = (u - hx) ** 2 + v * v * 1.3 + (z - hz) ** 2;
    if (hd < 0.75) return u > hx + 0.45 && z > hz && av > 0.15 && av < 0.45 ? BLACK : z > hz + 0.4 ? FUR_D : FUR;
    if (u > hx && u < hx + 1.5 && av < 0.4 && z > hz - 0.75 && z < hz - 0.05 + (u - hx) * -0.15) {
      if (lunge && z > hz - 0.5 && z < hz - 0.3) return hex('#9a2a24'); // its mouth
      return u > hx + 1.25 ? BLACK : z > hz - 0.3 ? FUR_D : FUR_L;
    }
    for (const side of [-1, 1]) if (Math.abs(v - side * 0.42) < 0.2 && Math.abs(u - (hx - 0.3)) < 0.3 - (z - hz - 0.6) * 0.3 && z > hz + 0.5 && z < hz + 1.4) return FUR_D;
    // the collar, in its side's color
    if (Math.abs(u - (hx - 0.9)) < 0.25 && av < 0.75 && Math.abs(z - (hz - 0.6)) < 0.75) return mod(Math.floor(v * 3), 3) === 0 ? STEEL : f.main;
    // the neck
    if (segD(u, v, z, [1.6, 0, 3.9 + lift * 0.5], [hx - 0.5, 0, hz - 0.4]) < 0.7) return z > hz - 0.6 ? FUR_D : FUR;
    // the body: deep in the chest, a dark saddle over the back
    const pitch = lunge ? 0.25 : 0;
    const bz = 3.7 + u * pitch;
    const e = (u / 2.6) ** 2 + (v / 0.95) ** 2 + ((z - bz) / (u > 0.6 ? 1.15 : 0.95)) ** 2;
    if (e < 1) return z > bz + 0.45 ? FUR_D : z < bz - 0.6 ? FUR_L : FUR;
    // the tail, up behind it
    if (segD(u, v, z, [-2.4, 0, 4.1], [-3.5, 0, 4.9 + Math.abs(run) * 0.4]) < 0.28) return FUR_D;
    // legs, dark at the paw
    for (const [a, b] of legs) if (segD(u, v, z, a, b) < 0.36) return z < 0.8 ? FUR_D : av > 0.6 ? FUR : FUR_L;
    return null;
  };
}

// The Mobile Foundry: a long tracked carrier with a cab, a boxy works module
// and a crane folded flat along the top. It deploys into the Foundry.
function foundryVehicle(f: Faction): Shape {
  const roof = mix(f.main, f.light, 0.5);
  return (u, v, z) => {
    const t = tracks(u, v, z, 15, 9, 3, 3.5);
    if (t) return t;
    const av = Math.abs(v);
    // fenders with steps and marker lights
    if (av <= 9 && av > 6 && z > 3.5 && z <= 4.2 && Math.abs(u) < 14.5) {
      if (u > 13.4) return HAZ;
      if (u < -13.6) return TAIL;
      return g(mod(u, 5) < 0.5 ? shade(f.dark, -0.15) : shade(f.main, -0.22), u, v, z);
    }
    if (av <= 8.6 && av > 6.4 && z > 4.2 && z <= 5.6 && u > -12 && u < -7) return z > 5 ? shade(OLIVE, 0.12) : Math.abs(u + 9.5) < 0.3 ? OLIVE_D : OLIVE; // lockers
    if (av > 6.2 || z < 1.5 || Math.abs(u) > 15) return null;
    // folded crane: lattice boom along the top, its slewing ring and winch at the back, hook stowed forward
    if (Math.abs(v - 3) < 1.1 && u > -12 && u < 11 && z > 12 && z <= 13.8) {
      const edge = Math.abs(v - 3) > 0.55 || z > 13.3;
      if (!edge) return null;
      return mod(Math.floor(u), 3) === 0 ? GUN_D : HAZ;
    }
    if (cyl(u, v, -9, 3, 2.4) && z > 11.5 && z <= 14.6) return g(z > 14 ? STEEL : mod(Math.floor(Math.atan2(v - 3, u + 9) * 3), 2) ? GUN : GUN_L, u, v, z);
    if (inBox(u, v, z, -12.6, -10.4, -1.4, 1, 12, 14)) return z > 13.4 ? GUN_L : mod(Math.floor(v * 2), 2) ? GUN_D : GUN; // winch drum
    if (inBox(u, v, z, 9.6, 11, 2.4, 3.6, 10.6, 12)) return HAZ;
    // exhaust stacks with heat shields
    for (const eu of [-1, 1.4]) if (cyl(u, v, eu, -4.4, 0.8) && z <= 16) return z > 15.4 ? BLACK : z > 13 && mod(Math.floor(z * 2), 2) ? STEEL : GUN_D;
    // cab
    if (u > 8) {
      if (u > 14 || av > 5 || z > 11) {
        // bumper with lights, and the roof gear
        if (u <= 14.6 && z <= 6 && av <= 6) return z > 5.2 ? hazard(v, 0) : av > 4 && z > 3.4 ? LAMP : g(f.dark, u, v, z);
        if (u <= 13 && av < 4 && z <= 11.8 && (Math.abs(u - 11) < 0.4 || Math.abs(av - 2) < 0.4)) return GUN; // roof rack
        if (cyl(u, v, 12.4, -3.6, 0.6) && z <= 12.4) return HAZ; // beacon
        if (Math.abs(u - 9) < 0.35 && Math.abs(v - 4.2) < 0.35 && z <= 16.5) return z > 16 ? RED : GUN_D; // aerial
        return null;
      }
      if (z > 7 && z < 10) {
        if (u > 13.4) return av < 0.3 ? f.dark : z > 9 ? GLASS_L : GLASS;
        if (av > 4.4) return Math.abs(u - 11) < 0.3 ? f.dark : z > 9 ? GLASS : GLASS_D;
      }
      if (u > 13.4 && z < 6.6 && z > 4.4 && av < 3) return mod(Math.floor(z * 2), 2) ? GUN_D : GUN; // radiator
      if (z > 10.4) return g(roof, u, v, z);
      if (z > 6 && z < 6.7) return WHITE;
      return g(z < 4.6 ? f.dark : f.main, u, v, z);
    }
    if (u > 7) return z <= 9 ? (z > 8.4 ? GUN : GUN_D) : null; // the gap behind the cab, with hoses
    // the works module
    if (u > -14 && av <= 5.6 && z <= 12) {
      if (z > 11.4) {
        if (Math.abs(v + 2.5) < 1.7 && Math.abs(u + 3) < 3.2) return Math.abs(v + 2.5) > 1.2 || Math.abs(u + 3) > 2.7 ? GUN : mod(Math.floor(u * 2), 2) ? GUN_D : TREAD; // roof grille
        if (Math.abs(u - 4) < 1.2 && Math.abs(v + 2.5) < 1.2) return (u - 4) ** 2 + (v + 2.5) ** 2 < 0.8 ? GUN_D : shade(f.dark, 0.1); // hatch
        if (mod(u, 6) < 0.4) return shade(roof, -0.15);
        return g(roof, u, v, z);
      }
      if (z > 8 && z < 9.4) return hazard(u + z, v);
      if (av > 5 && Math.abs(u + 3) < 4 && z > 3 && z < 7.5) return mod(Math.floor(z * 2), 2) ? METAL_D : METAL; // shutter
      if (av > 5 && Math.abs(u - 4) < 1.4 && z > 4.4 && z < 7) return z > 6 ? GLASS_D : f.dark; // access door
      if (u < -13.4) {
        // the back: a ladder and lamps
        if (Math.abs(v) < 1.2 && z > 3) return mod(Math.floor(z * 1.4), 2) ? GUN : shade(f.main, -0.1);
        if (av > 3.6 && z > 9.6 && z < 10.8) return TAIL;
      }
      if (z > 10 && z < 10.6) return shade(f.main, -0.18);
      if (mod(u, 5) < 0.4 && z > 4) return shade(f.main, -0.12); // panel seams
      return g(z < 4 ? f.dark : f.main, u, v, z);
    }
    if (z <= 6) return g(f.dark, u, v, z);
    return null;
  };
}

// How far the hauler's bed tips up as it unloads, in steps (radians).
export const HAULER_TILTS = [0.22, 0.44, 0.64];

export interface V2FactionArt {
  mcv: StackSprite[];
  lightTank: StackSprite[];
  lightTurret: StackSprite[];
  heavyTank: StackSprite[];
  heavyTurret: StackSprite[];
  buggy: StackSprite[];
  apc: StackSprite[];
  hauler: StackSprite[]; // empty
  haulerLoad: StackSprite[][]; // [fill][dir]: empty, partly full, full
  // digging: [(scoop pose - 1) * 3 + fill][dir], the scoop lifting (pose 1)
  // and up, tipping ore into the bed (pose 2)
  haulerDig: StackSprite[][];
  // unloading at a refinery: [(tilt step - 1) * 3 + fill][dir], the bed
  // tipped up a little, more, and all the way (HAULER_TILTS)
  haulerDump: StackSprite[][];
  artillery: StackSprite[];
  comet: StackSprite[]; // loaded, a rocket on the rail
  cometEmpty: StackSprite[]; // fired, the rail bare
  boat: StackSprite[];
  heli: StackSprite[];
  towerGun: StackSprite[];
  scorchTank: StackSprite[];
  scorchTurret: StackSprite[];
  lumenTank: StackSprite[];
  lumenTurret: StackSprite[];
  aaGun: StackSprite[];
  heron: StackSprite[];
  jet: StackSprite[];
  plane: StackSprite[];
  otter: StackSprite[];
  destroyer: StackSprite[];
  cruiser: StackSprite[];
  cruiserTop: StackSprite[];
  skyguardTank: StackSprite[];
  skyguardTurret: StackSprite[];
  carrier: StackSprite[];
  sub: StackSprite[];
  drone: StackSprite[];
  infantry: StackSprite[][]; // [frame][dir]: standing, two strides
  rocket: StackSprite[][];
  gren: StackSprite[][]; // and a throw
  eng: StackSprite[][]; // and a wrench held up to work
  cmdo: StackSprite[][];
  flamer: StackSprite[][];
  dog: StackSprite[][]; // standing, two beats of a gallop, and a lunge
  infantryDug: StackSprite[][]; // [how far dug in][dir]: a G.I. kneeling in a ring of sandbags
}

// Each set of headings is keyed fa:<faction>:<name>[:<frame>], so a worker can
// make the same one (see art-worker.ts and factionSet below).
export function makeFactionArt(f: Faction): V2FactionArt {
  const fi = FACTIONS.indexOf(f);
  const k = (name: string) => (fi >= 0 ? `fa:${fi}:${name}` : undefined);
  const haulerLoad = [0, 1, 2].map((fill) => renderDirs(hauler(f, fill), DIRS, { r: 13, zmax: 11, bakeShadow: true }, k(`haulerLoad:${fill}`)));
  const haulerDig = [1, 2].flatMap((pose) => [0, 1, 2].map((fill) => renderDirs(hauler(f, fill, pose), DIRS, { r: 13, zmax: 11, bakeShadow: true }, k(`haulerDig:${(pose - 1) * 3 + fill}`))));
  const haulerDump = HAULER_TILTS.flatMap((tilt, i) =>
    [0, 1, 2].map((fill) => renderDirs(hauler(f, fill, 0, tilt), DIRS, { r: 15, zmax: 16, bakeShadow: true }, k(`haulerDump:${i * 3 + fill}`))),
  );
  const inf = (kind: Trooper, name: string, frames: number[]) =>
    frames.map((fr) => renderDirs(soldier(f, kind, fr), 16, { r: 4.9, zmax: 13.5, step: 0.5, bakeShadow: true }, k(`${name}:${fr}`)));
  return {
    mcv: renderDirs(foundryVehicle(f), DIRS, { r: 17.5, zmax: 17, bakeShadow: true }, k('mcv')),
    lightTank: renderDirs(tankHull(f, 16, 12, false), DIRS, { r: 10.5, zmax: 7, bakeShadow: true }, k('lightTank')),
    lightTurret: renderDirs(turretShape(f, 3.6, 5, 1, 11), DIRS, { r: 11.5, zmax: 14 }, k('lightTurret')),
    heavyTank: renderDirs(tankHull(f, 20, 15, true), DIRS, { r: 13, zmax: 8, bakeShadow: true }, k('heavyTank')),
    heavyTurret: renderDirs(turretShape(f, 4.8, 6, 2, 13), DIRS, { r: 13.5, zmax: 16 }, k('heavyTurret')),
    buggy: renderDirs(buggy(f), DIRS, { r: 8, zmax: 10, bakeShadow: true }, k('buggy')),
    apc: renderDirs(apc(f), DIRS, { r: 11, zmax: 13, bakeShadow: true }, k('apc')),
    hauler: haulerLoad[0],
    haulerLoad,
    haulerDig,
    haulerDump,
    artillery: renderDirs(artillery(f), DIRS, { r: 13.5, zmax: 13, bakeShadow: true }, k('artillery')),
    comet: renderDirs(comet(f, true), DIRS, { r: 12, zmax: 17, bakeShadow: true }, k('comet')),
    cometEmpty: renderDirs(comet(f, false), DIRS, { r: 12, zmax: 15, bakeShadow: true }, k('cometEmpty')),
    boat: renderDirs(boat(f), DIRS, { r: 15.5, zmax: 13, bakeShadow: true, shadowAlpha: 0.2 }, k('boat')),
    heli: renderDirs(heli(f), DIRS, { r: 15.5, zmax: 10 }, k('heli')),
    towerGun: renderDirs(turretShape(f, 4, 0, 2, 11), DIRS, { r: 11.5, zmax: 9 }, k('towerGun')),
    scorchTank: renderDirs(tankHull(f, 17, 12.5, false), DIRS, { r: 11, zmax: 7, bakeShadow: true }, k('scorchTank')),
    scorchTurret: renderDirs(scorchTurret(f), DIRS, { r: 10, zmax: 10 }, k('scorchTurret')),
    lumenTank: renderDirs(tankHull(f, 17, 13.5, false), DIRS, { r: 11, zmax: 7, bakeShadow: true }, k('lumenTank')),
    lumenTurret: renderDirs(lumenTurret(f), DIRS, { r: 6, zmax: 21 }, k('lumenTurret')),
    aaGun: renderDirs(aaLauncher(f), DIRS, { r: 7.5, zmax: 10 }, k('aaGun')),
    skyguardTank: renderDirs(tankHull(f, 16, 12.5, false), DIRS, { r: 10.5, zmax: 7, bakeShadow: true }, k('skyguardTank')),
    skyguardTurret: renderDirs(skyguardTurret(f), DIRS, { r: 8, zmax: 15 }, k('skyguardTurret')),
    heron: renderDirs(heron(f), DIRS, { r: 13, zmax: 11 }, k('heron')),
    jet: renderDirs(jet(f), DIRS, { r: 11, zmax: 8 }, k('jet')),
    plane: renderDirs(cargoPlane(f), DIRS, { r: 21, zmax: 11 }, k('plane')),
    otter: renderDirs(hovercraft(f), DIRS, { r: 13, zmax: 9, bakeShadow: true, shadowAlpha: 0.2 }, k('otter')),
    destroyer: renderDirs(destroyer(f), DIRS, { r: 21, zmax: 15, bakeShadow: true, shadowAlpha: 0.2 }, k('destroyer')),
    cruiser: renderDirs(cruiser(f, 'hull'), DIRS, { r: 20.5, zmax: 6, bakeShadow: true, shadowAlpha: 0.2 }, k('cruiser')),
    cruiserTop: renderDirs(cruiser(f, 'top'), DIRS, { r: 7, zmax: 16 }, k('cruiserTop')),
    carrier: renderDirs(carrier(f), DIRS, { r: 73, zmax: 43, bakeShadow: true, shadowAlpha: 0.2 }, k('carrier')),
    sub: renderDirs(submarine(f), DIRS, { r: 17, zmax: 8 }, k('sub')),
    drone: renderDirs(drone(f), DIRS, { r: 3.5, zmax: 1.5 }, k('drone')),
    infantry: inf('gi', 'infantry', [0, 1, 2]),
    rocket: inf('rocket', 'rocket', [0, 1, 2]),
    gren: inf('gren', 'gren', [0, 1, 2, 3]),
    eng: inf('eng', 'eng', [0, 1, 2, 3]),
    cmdo: inf('cmdo', 'cmdo', [0, 1, 2]),
    flamer: inf('flame', 'flamer', [0, 1, 2]),
    dog: [0, 1, 2, 3].map((fr) => renderDirs(dog(f, fr), 16, { r: 5, zmax: 8, step: 0.5, bakeShadow: true }, k(`dog:${fr}`))),
    infantryDug: [1, 2, 3].map((n, i) => renderDirs(soldier(f, 'gi', 4, n / 3), 16, { r: 4.8, zmax: 10, step: 0.5, bakeShadow: true }, k(`infantryDug:${i}`))),
  };
}

/** The Skyguard cruiser's sprites, back to front, for a ship at (x, y) and
 * height z facing a with its launchers turned to tur: the hull, the
 * launchers and the superstructure, a launcher behind the superstructure
 * drawn before it and one in front after it. */
export function cruiserParts(art: V2FactionArt, x: number, y: number, z: number, a: number, tur: number): [StackSprite, number, number, number][] {
  const di = dirIndex(a, DIRS);
  const ti = dirIndex(tur, DIRS);
  const out: [StackSprite, number, number, number][] = [[art.cruiser[di], x, y, z]];
  const ls = CRUISER_LAUNCHERS.map((l) => ({ l, x: x + Math.cos(a) * l, y: y + Math.sin(a) * l }));
  const behind = ls.filter((p) => p.x + p.y < x + y);
  const ahead = ls.filter((p) => p.x + p.y >= x + y);
  for (const p of behind) out.push([art.aaGun[ti], p.x, p.y, z + CRUISER_RING_Z]);
  out.push([art.cruiserTop[di], x, y, z]);
  for (const p of ahead) out.push([art.aaGun[ti], p.x, p.y, z + CRUISER_RING_Z]);
  return out;
}

/** The set of headings a key from makeFactionArt names, in a given set of art. */
export function factionSet(art: V2FactionArt, key: string): StackSprite[] | null {
  const [, , name, sub] = key.split(':');
  const v = (art as unknown as Record<string, StackSprite[] | StackSprite[][]>)[name];
  if (!v) return null;
  return (sub !== undefined ? (v as StackSprite[][])[Number(sub)] : (v as StackSprite[])) ?? null;
}

// ---------- Buildings ----------

/** The Air command's layout (u along its length, v from back to front): the
 * hangar at the back with its door on its front wall (HANGAR_DOOR), the
 * parking stands on the apron in front of it (AIR_STAND_U at AIR_STAND_V),
 * and the runway along the front (AIR_RUNWAY: its middle line v and its ends). */
export const HANGAR_DOOR: [number, number, number, number] = [0, -8, 19, 12.5]; // middle u, wall v, half width, height
export const AIR_STAND_U = [-36, -12, 12, 36];
export const AIR_STAND_V = 4;
export const AIR_RUNWAY: [number, number, number] = [19, -46, 46];

/** The Vehicle works' garage door, on its front (+y) wall at v = 18: its middle along the wall, half width and height. */
export const FACTORY_DOOR: [number, number, number] = [0, 12, 17];
/** The Barracks' door, on its end (+x) wall at u = 14: its middle across the wall, half width and height. */
export const BARRACKS_DOOR: [number, number, number] = [0, 2.8, 7];

export type BuildingKind = 'yard' | 'lab' | 'power' | 'barracks' | 'refinery' | 'radar' | 'factory' | 'tower' | 'pillbox' | 'silo' | 'helipad' | 'prism' | 'aa' | 'depot' | 'wall' | 'uplink' | 'navy' | 'derrick';

// The colors of a tech building nobody holds yet (side NEUTRAL_F).
export const NEUTRAL: Faction = { name: 'Neutral', main: hex('#9c9583'), light: hex('#e4ddc8'), dark: hex('#5d584c') };
export const NEUTRAL_F = -1;
/** The colors of side f: one of FACTIONS, or NEUTRAL for a tech building nobody holds. */
export const factionOf = (f: number): Faction => (f < 0 ? NEUTRAL : FACTIONS[f]);

export interface V2BuildingArt {
  spr: StackSprite;
  rx: number; // half footprint in world units
  ry: number;
  fx: { x: number; y: number; z: number }[]; // effect anchors (smoke, lights, dish, gun)
}

// The skin of a box-shaped block that reaches (x1, y1) on its two visible
// sides and stands from z0 to z1: a dark footing, panel joints, rows of framed
// windows (some lit), a pale coping round the roof and streaks of grime.
interface Wall {
  win?: [number, number]; // windows between these heights above z0
  band?: RGB; // a stripe of the faction's color under the coping
  body?: RGB;
  pitch?: number; // spacing of the windows
}
function wallSkin(u: number, v: number, z: number, x1: number, y1: number, z0: number, z1: number, seed: number, o: Wall = {}): RGB {
  const body = o.body ?? CONC;
  const onX = u > x1 - 0.6;
  const onY = v > y1 - 0.6;
  const zz = z - z0;
  const h = z1 - z0;
  if (!onX && !onY) return g(body, u, v, z);
  const along = onX ? v : u;
  if (zz > h - 0.9) return CONC_L; // coping
  if (zz < 1.2) return grime(CONC_D, along, zz, h, seed);
  if (o.band && zz > h - 2.8 && zz < h - 1.5) return g(o.band, u, v, z);
  if (o.win && zz > o.win[0] && zz < o.win[1]) {
    const p = o.pitch ?? 5;
    const a = mod(along + 1.3, p);
    const row = (zz - o.win[0]) % 5;
    if (a < 2.6 && row > 0.8 && row < 3.6) {
      if (row < 1.3) return CONC_L; // sill
      if (a < 0.4 || a > 2.2 || row > 3.2) return WIN; // frame
      const lit = hash2(Math.floor((along + 1.3) / p), Math.floor((zz - o.win[0]) / 5) + (onX ? 50 : 0), seed) < 0.28;
      if (lit) return row > 2.4 ? shade(WIN_LIT, 0.25) : WIN_LIT;
      return row > 2.4 ? WIN_B : WIN;
    }
  }
  if (mod(along, 6) < 0.4) return shade(body, -0.12); // panel joints
  return grime(g(body, u, v, z, 0.05), along, zz, h, seed);
}

// A flat roof: a parapet round the edge and tarred felt laid in strips.
function roofSkin(u: number, v: number, z: number, x0: number, x1: number, y0: number, y1: number): RGB {
  const e = Math.min(u - x0, x1 - u, v - y0, y1 - v);
  if (e < 1) return CONC_L;
  if (e < 1.6) return shade(TAR, -0.2);
  return g(mod(u, 4) < 0.4 ? shade(TAR, -0.14) : hash2(Math.floor(u / 4), Math.floor(v / 5), 3) > 0.7 ? shade(TAR, 0.1) : TAR, u, v, z, 0.07);
}

// An air-conditioning unit: a box with a fan grille on top.
function acUnit(u: number, v: number, z: number, cu: number, cv: number, z0: number): RGB | null {
  if (Math.abs(u - cu) > 2 || Math.abs(v - cv) > 2 || z < z0 || z > z0 + 2.4) return null;
  if (z > z0 + 1.9) {
    const d = (u - cu) ** 2 + (v - cv) ** 2;
    return d < 0.4 ? GUN_D : d < 2.4 ? (mod(Math.floor(Math.atan2(v - cv, u - cu) * 2.6), 2) ? GUN_D : GUN) : METAL;
  }
  return mod(Math.floor(z * 2), 2) ? METAL_D : METAL;
}

// A roller door on the +y face of a wall at v = y1, hazard-striped round the frame.
function rollerDoor(u: number, v: number, z: number, cu: number, hw: number, y1: number, top: number): RGB | null {
  if (v < y1 - 0.6 || Math.abs(u - cu) > hw || z > top) return null;
  if (Math.abs(u - cu) > hw - 0.9 || z > top - 0.9) return hazard(u, z);
  if (z < 0.8) return GUN_D;
  if (z > top - 2.2 && Math.abs(mod(u - cu, 4) - 2) < 1) return GLASS_D; // a row of small panes
  return mod(Math.floor(z * 1.5), 2) ? METAL_D : METAL;
}

// Oil drums standing in a cluster.
function drums(u: number, v: number, z: number, pts: [number, number, RGB][]): RGB | null {
  if (z > 3.4) return null;
  for (const [bu, bv, c] of pts) {
    const d = (u - bu) ** 2 + (v - bv) ** 2;
    if (d < 1.5) return z > 3 ? (d < 0.3 ? BLACK : shade(c, -0.15)) : Math.abs(z - 1.1) < 0.25 || Math.abs(z - 2.2) < 0.25 ? shade(c, -0.28) : c;
  }
  return null;
}

// A lattice mast on a square plan.
function lattice(u: number, v: number, z: number, cu: number, cv: number, hw: number, c: RGB): RGB | null {
  const a = Math.abs(u - cu);
  const b = Math.abs(v - cv);
  if (a > hw || b > hw) return null;
  if (a < hw - 0.6 && b < hw - 0.6) return null;
  const leg = a > hw - 0.6 && b > hw - 0.6;
  const zz = mod(z, 3);
  if (leg || zz < 0.5 || Math.abs((a > b ? b : a) / hw - zz / 3) < 0.22) return leg ? shade(c, -0.12) : c;
  return null;
}

// ---- Round forms, for the buildings ----
// The buildings follow one look: tall rounded blocks, drums and domes in a
// pale rendered concrete, with the side's color in bands and in glowing glass.

const PLAS = hex('#cfcbbf');
const PLAS_D = hex('#a29e92');
const PLAS_L = hex('#e6e3d8');

/** Signed distance (negative inside) from (u, v) to a rounded rectangle in plan. */
function rrect(u: number, v: number, cu: number, cv: number, hx: number, hy: number, r: number): number {
  const qx = Math.abs(u - cu) - hx + r;
  const qy = Math.abs(v - cv) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
/** The top of a block h high whose roof edge is rounded over (radius fr), e in from its edge. */
function shoulder(e: number, h: number, fr: number): number {
  return e >= fr ? h : h - fr + Math.sqrt(Math.max(0, fr * fr - (fr - e) ** 2));
}
/** How high a dome of radius r and height hz stands at d from its middle (-1 outside it). */
function capH(d: number, r: number, hz: number): number {
  return d >= r ? -1 : hz * Math.sqrt(1 - (d / r) ** 2);
}
/** A glowing glass in the side's color. */
function glowOf(f: Faction): RGB {
  return mix(f.light, WHITE, 0.3);
}

// The face of a rounded wall: a dark footing, joints between the courses,
// an optional band of the side's color and a row of windows (some lit).
interface RSkin {
  seed: number;
  body?: RGB;
  band?: [number, number, RGB];
  win?: [number, number];
  pitch?: number;
  lit?: RGB;
}
function rskin(along: number, z: number, h: number, o: RSkin): RGB {
  const body = o.body ?? PLAS;
  if (z < 1.1) return grime(CONC_D, along, z, h, o.seed);
  if (o.band && z > o.band[0] && z < o.band[1]) return g(o.band[2], along, z, 0, 0.05);
  if (o.win && z > o.win[0] && z < o.win[1]) {
    const p = o.pitch ?? 5;
    const a = mod(along, p);
    if (a < 2.4) {
      if (a < 0.4 || a > 2 || z < o.win[0] + 0.45 || z > o.win[1] - 0.45) return WIN;
      const lit = hash2(Math.floor(along / p), Math.floor(o.win[0]), o.seed) < 0.4;
      if (lit) return o.lit ?? WIN_LIT;
      return z > (o.win[0] + o.win[1]) / 2 ? WIN_B : WIN;
    }
  }
  if (Math.abs(mod(z, 4.5) - 0.3) < 0.22) return shade(body, -0.1);
  return grime(g(body, along, z, h, 0.05), along, z, h, o.seed);
}

// A drum standing at (cu, cv): radius r, walls h high, under a dome hz high.
// Returns the angle round it and how far up its wall or dome the point is,
// or null when the point is outside it.
function drum(u: number, v: number, z: number, cu: number, cv: number, r: number, h: number, hz: number): { a: number; d: number; roof: boolean } | null {
  const d = Math.hypot(u - cu, v - cv);
  if (d > r) return null;
  if (z > h + Math.max(0, capH(d, r, hz))) return null;
  return { a: Math.atan2(v - cv, u - cu), d, roof: z > h - 0.2 && d < r - 0.5 };
}

function buildingShape(kind: BuildingKind, f: Faction): { shape: Shape; glow?: Shape; rx: number; ry: number; zmax: number; fx: V2BuildingArt['fx'] } {
  const roofC = mix(f.main, f.light, 0.35);
  const glow = glowOf(f);
  switch (kind) {
    case 'yard': {
      // The Foundry: a tall round-cornered works hall with a big door, a
      // crane turret on its roof whose jib reaches out over the assembly
      // ring, a side shop and two gas tanks. fx[0] is the light on the mast,
      // fx[1] the hook.
      const [mu, mv] = [-6, -4];
      const HU = 17.5; // where the hook hangs
      const shape: Shape = (u, v, z) => {
        // the crane: mast, jib and counter-jib, counterweight, cab, trolley, cable, hook
        if (z >= 22) {
          if (cyl(u, v, mu, mv, 1.4) && z < 36) return z > 35.3 ? GUN_D : mod(Math.floor(z / 1.6), 2) ? HAZ : shade(HAZ, -0.25);
          if (Math.abs(v - mv) < 1 && u > mu - 9 && u < HU + 3.5 && z > 33 && z < 35) {
            if (z > 34.4 || z < 33.6) return mod(Math.floor(u), 2) ? HAZ : shade(HAZ, -0.2);
            return mod(u, 2.2) < 0.6 || Math.abs(v - mv) > 0.6 ? GUN_D : null;
          }
          if (inBox(u, v, z, mu - 10, mu - 6, mv - 1.7, mv + 1.7, 30.6, 33.4)) return z > 32.9 ? CONC_L : mod(Math.floor(u * 1.2), 2) ? CONC_D : shade(CONC_D, -0.15);
          if (inBox(u, v, z, mu + 1.4, mu + 4.6, mv - 1.8, mv + 1.8, 29.4, 33)) {
            if (z > 32.5) return roofC;
            if (u > mu + 4 && z > 30.4) return z > 31.8 ? GLASS_L : GLASS;
            return g(f.main, u, v, z);
          }
          if (Math.abs(u - mu) < 0.35 && Math.abs(v - mv) < 0.35 && z >= 36 && z < 37.6) return z > 37 ? RED : GUN_D;
          if (inBox(u, v, z, HU - 1.4, HU + 1.4, mv - 1, mv + 1, 32, 33)) return GUN;
        }
        if (Math.abs(u - HU) < 0.35 && Math.abs(v - mv) < 0.35 && z > 20 && z < 32) return GUN_D;
        if (inBox(u, v, z, HU - 1, HU + 1, mv - 1, mv + 1, 18.4, 20)) return z > 19.4 ? hazard(u, v) : HAZ;
        // the turret on the roof: a drum with a band of windows under a shallow dome
        const t = drum(u, v, z, mu, mv, 5.6, 22, 2.4);
        if (t && z >= 16) {
          if (t.roof) return mod(t.a * 6 / Math.PI, 1) < 0.1 ? METAL_D : g(roofC, u, v, z);
          if (z > 18.4 && z < 20.6) return mod(t.a * 9 / Math.PI, 1) < 0.18 ? f.dark : z > 19.8 ? GLASS_L : GLASS;
          return z > 21.4 ? f.main : g(PLAS, u, v, z);
        }
        // the hall
        const e = -rrect(u, v, mu, mv, 15, 14, 7);
        if (e >= 0 && z <= shoulder(e, 16, 4)) {
          if (e > 0.6 && z > shoulder(e, 16, 4) - 0.7) {
            if (e < 4.2) return PLAS_L;
            const d = Math.hypot(u - mu, v - mv);
            if (d < 7.4) return mod(Math.atan2(v - mv, u - mu) * 8 / Math.PI, 1) < 0.15 ? STEEL : GLASS_D; // skylight ring
            return g(mod(u + v, 4) < 0.4 ? shade(TAR, -0.14) : TAR, u, v, z, 0.07);
          }
          const door = rollerDoor(u, v, z, mu, 7, 10, 11);
          if (door) return door;
          if (v > 9.4 && z > 11 && z < 12.4 && Math.abs(u - mu) < 7.6) return hazard(u, z);
          if (u > 8.4 && Math.abs(v + 6) < 1.1 && z < 5) return z > 4 ? LAMP : GUN; // side door
          return rskin(u + v, z, 16, { seed: 21, win: [12.8, 15], band: [7, 8.2, f.main], pitch: 4.4, lit: glow });
        }
        // the side shop: a lower rounded block with a barrel roof in the side's color
        const s = -rrect(u, v, 15.5, 12, 7, 7, 4);
        if (s >= 0 && z <= shoulder(s, 10, 3.4)) {
          if (s > 0.6 && z > shoulder(s, 10, 3.4) - 0.7) return s < 3.4 ? PLAS_L : mod(u, 3) < 0.4 ? f.dark : g(roofC, u, v, z);
          if (v > 18.4 && Math.abs(u - 15.5) < 3.2 && z < 6.4) return z > 5.6 ? hazard(u, 0) : mod(Math.floor(z * 1.5), 2) ? METAL_D : METAL;
          return rskin(u + v, z, 10, { seed: 22, win: [4, 7.6], pitch: 4, lit: glow });
        }
        // gas tanks behind
        for (const cu of [12, 17.6]) {
          const k = drum(u, v, z, cu, -16, 2.6, 10, 1.8);
          if (k) return k.roof ? STEEL : Math.abs(z - 6) < 0.6 ? f.main : mod(k.a * 4 / Math.PI, 1) < 0.08 ? METAL_D : g(METAL, u, v, z);
        }
        // the assembly ring under the hook, with a chassis being put together on it
        const ad = Math.hypot(u - HU, v - mv);
        if (inBox(u, v, z, HU - 3, HU + 3, mv - 2, mv + 2, 1, 2.8)) return z > 2.3 ? (mod(u, 1.5) < 0.4 ? GUN_D : g(f.main, u, v, z)) : f.dark;
        if (Math.abs(Math.abs(v - mv) - 1.6) < 0.5 && Math.abs(Math.abs(u - HU) - 2) < 0.8 && z < 1.6) return WHEEL;
        if (ad < 5.4 && z < 1) return ad > 4.7 ? hazard(Math.atan2(v - mv, u - HU) * 8, 0) : ad > 4.2 ? GUN_D : mod(Math.atan2(v - mv, u - HU) * 6 / Math.PI, 1) < 0.08 ? GUN : METAL_D;
        // parts waiting: crates, drums, girders
        if (inBox(u, v, z, -20, -15, 13, 17, 0, 3)) return z > 2.5 ? (mod(u, 2.5) < 0.4 ? shade(WOOD, -0.3) : WOOD_L) : Math.abs(mod(u, 2.5) - 1.2) < 0.3 ? shade(WOOD, -0.3) : WOOD;
        const dr = drums(u, v, z, [[-12, 14, RUST], [-10, 15.6, f.main], [-12.4, 16.6, hex('#3f6f8a')]]);
        if (dr) return dr;
        if (inBox(u, v, z, -4, 4, 15, 15.8, 0, 2) || inBox(u, v, z, -4, 4, 16.8, 17.6, 0, 1.4)) return mod(u, 2.4) < 0.4 ? RUST : GUN_L;
        return null;
      };
      return { shape, rx: 24, ry: 22, zmax: 38, fx: [{ x: mu, y: mv, z: 37.6 }, { x: HU, y: mv, z: 19 }] };
    }
    case 'lab': {
      // The Tech lab: a great geodesic dome of glass panes in steel frames,
      // the panes lit from inside in the side's color, with a vaulted
      // entrance. Its `glow` is the light in the panes alone, which the game
      // pulses over it.
      const AU = 17;
      const AV = 14;
      const AZ = 19;
      const Z0 = 1.4; // the dome stands on a low ring
      const BANDS = 5;
      const pane = (k: number) => {
        // the panes: dark at the foot, glowing higher up, a few brighter ones
        if (k > 0.86) return glow;
        if (k > 0.66) return f.light;
        if (k > 0.36) return mix(f.main, f.light, 0.25);
        return k > 0.14 ? f.main : mix(f.dark, f.main, 0.45);
      };
      // the color at (u, v, z) and how brightly it is lit from inside (0 for frames)
      let lit = 0;
      const shape: Shape = (u, v, z) => {
        lit = 0;
        const nu = u / AU;
        const nv = v / AV;
        const nz = (z - Z0) / AZ;
        const q = nu * nu + nv * nv + nz * nz;
        if (z >= Z0 && q <= 1) {
          const el = Math.asin(Math.min(1, Math.max(0, nz / Math.sqrt(q || 1)))); // 0 at the foot, pi/2 at the top
          const band = Math.min(BANDS - 1, Math.floor((el / (Math.PI / 2)) * BANDS));
          const t = (el / (Math.PI / 2)) * BANDS - band; // 0..1 up the band
          const n = [16, 15, 12, 8, 4][band];
          const s = ((Math.atan2(nv, nu) + Math.PI) / (Math.PI * 2)) * n + (band % 2) * 0.5;
          const w = mod(s, 1);
          const R = Math.sqrt(AU * AV) * Math.cos(el); // the band's radius, roughly
          const seg = (Math.PI * 2 * R) / n || 1;
          const bh = (AZ * Math.PI) / 2 / BANDS;
          // frames: the rings between the bands and the zigzag struts in each
          const ring = Math.min(t, 1 - t) * bh < 0.3;
          const strut = Math.min(Math.abs(w - 0.5 * t), Math.abs(1 - w - 0.5 * t)) * seg < 0.3;
          if (ring || strut || (band === BANDS - 1 && t > 0.7)) return z > Z0 + AZ * 0.7 ? PLAS_L : STEEL;
          // which pane: up-pointing or down-pointing triangle in the cell
          const tri = w < 0.5 * t ? 0 : 1 - w < 0.5 * t ? 2 : 1;
          const id = hash2(Math.floor(s) * 3 + tri, band, 41);
          const k = Math.min(1, id * 0.55 + (el / (Math.PI / 2)) * 0.55);
          lit = 0.35 + k * 0.65;
          return pane(k);
        }
        // the vaulted entrance on the front (+v), a dark doorway with light spilling out
        if (v > 9 && v < 16 && Math.abs(u) < 3.6) {
          const r = Math.hypot(u, z - 1.2);
          if (r < 3.6 && z >= 0) {
            if (v > 15.4) {
              if (r > 2.8) return STEEL;
              if (z < 1.8) return GUN_D;
              lit = r < 1.6 ? 1 : 0.4;
              return r < 1.6 ? glow : mix(f.dark, f.main, 0.4);
            }
            if (mod(v, 2) < 0.5) return STEEL;
            if (r > 3) return STEEL;
            lit = 0.4;
            return z > 3.4 ? pane(0.5) : pane(0.2);
          }
        }
        // the ring the dome stands on
        const e = (u / (AU + 0.8)) ** 2 + (v / (AV + 0.8)) ** 2;
        if (e <= 1 && z < Z0) return z > Z0 - 0.5 ? GUN : mod(Math.atan2(v, u) * 24 / Math.PI, 1) < 0.15 ? GUN_D : METAL_D;
        return null;
      };
      const light = mix(f.light, WHITE, 0.15);
      const glowShape: Shape = (u, v, z) => {
        const c = shape(u, v, z);
        if (!c) return null;
        return lit ? shade(light, (lit - 1) * 0.9) : BLACK;
      };
      return { shape, glow: glowShape, rx: 20, ry: 16, zmax: 22, fx: [{ x: 0, y: 0, z: Z0 + AZ * 0.55 }] };
    }
    case 'power': {
      // The power plant: a tall cooling tower, a domed reactor ringed with
      // glowing ports, and a barrel-roofed turbine hall in front.
      const tower = (u: number, v: number, z: number, cu: number, cv: number) => {
        const d = Math.hypot(u - cu, v - cv);
        const r = 9.5 - 3 * Math.sin((Math.PI * Math.min(z, 34)) / 40);
        if (z > 34 || d > r) return null;
        if (z > 33.4 || d > r - 1.4) {
          if (z > 33.4 && d < r - 1.4) return null;
          const a = Math.atan2(v - cv, u - cu);
          let c = PLAS_L;
          if (z > 33) c = shade(PLAS_L, 0.1);
          else if (z > 26 && z < 29.4) c = z > 28.7 || z < 26.7 ? f.dark : mod(a * 5, 2) < 1 ? f.main : f.light;
          else if (z < 3.4) c = mod(a * 9, 2) < 1.1 ? CONC_D : BLACK;
          else if (mod(a * 7, 1) < 0.1 || Math.abs(mod(z, 5.6) - 2.8) < 0.22) c = shade(PLAS_L, -0.1);
          else if (hash2(Math.floor(a * 9), 3, cu) > 0.7 && z > 29 + hash2(Math.floor(a * 9), 4, cu) * 3) c = shade(PLAS_L, -0.14);
          if (Math.abs(a - 0.9) < 0.11 && z > 3 && d > r - 0.7) c = mod(Math.floor(z * 1.5), 2) ? GUN_D : GUN_L;
          return g(c, u, v, z, 0.05);
        }
        return z > 30 ? hex('#30302c') : null;
      };
      const shape: Shape = (u, v, z) => {
        const t = tower(u, v, z, -8, -5);
        if (t) return t;
        // the reactor: a drum with glowing ports and a dome, a vent on top
        if (cyl(u, v, 9, -6, 1.2) && z < 17.6) return z > 17 ? BLACK : STEEL;
        const r = drum(u, v, z, 9, -6, 7, 9, 7);
        if (r) {
          if (r.roof) {
            if (z > 15) return g(f.main, u, v, z);
            return mod(r.a * 6 / Math.PI, 1) < 0.08 || Math.abs(z - 12.6) < 0.3 ? PLAS_D : g(PLAS_L, u, v, z);
          }
          if (z > 4.6 && z < 7) return mod(r.a * 8 / Math.PI, 1) < 0.3 ? f.dark : z > 6.2 ? WHITE : glow;
          return rskin(r.a * 7, z, 9, { seed: 40 });
        }
        // the turbine hall: walls with a half-round roof
        const e = -rrect(u, v, 0, 10, 18, 5, 5);
        if (e >= 0 && z <= shoulder(e, 11, 5)) {
          if (e > 0.6 && z > 6.4) {
            if (Math.abs(u) < 2.4) return g(f.main, u, v, z);
            return mod(u, 2.4) < 0.5 ? METAL_D : METAL;
          }
          if (v > 14.4 && z < 5.4 && mod(u + 40, 8) < 3.2) {
            const a = mod(u + 40, 8);
            return z > 4.7 ? hazard(u, 0) : a < 0.4 || a > 2.8 ? GUN_D : mod(Math.floor(z * 1.5), 2) ? METAL_D : METAL;
          }
          return rskin(u + v, z, 6.4, { seed: 41, band: [5.4, 6.4, f.main] });
        }
        for (const cu of [-12, -6, 6, 12]) if (cyl(u, v, cu, 10, 1) && z > 10 && z <= 12.6) return z > 12 ? GUN_D : STEEL;
        // lagged steam pipes from the tower and the reactor to the hall
        for (const cu of [-8, 9]) {
          if (Math.abs(u - cu) < 1 && v > 1 && v < 6 && Math.abs(z - 7) < 1) return mod(Math.floor(v * 1.5), 3) === 0 ? METAL_D : STEEL;
        }
        if (Math.abs(v + 6) < 0.9 && u > 0.6 && u < 2.4 && Math.abs(z - 6) < 0.9) return COPPER;
        // transformers behind the reactor
        for (const cv of [-14.5, -11]) {
          if (inBox(u, v, z, 15, 18, cv - 1.4, cv + 1.4, 0, 4)) return z > 3.5 ? GUN_D : mod(Math.floor(v * 2), 2) ? METAL : METAL_D;
          if (cyl(u, v, 16.5, cv, 0.5) && z > 4 && z <= 6.4) return mod(Math.floor(z * 2), 2) ? WHITE : RUST;
        }
        return null;
      };
      return { shape, rx: 19, ry: 17, zmax: 35, fx: [{ x: -8, y: -5, z: 34 }, { x: 9, y: -6, z: 17.6 }] };
    }
    case 'barracks': {
      // A tall round-roofed hut with a brick end wall, a watchtower at the
      // back corner, sandbags and kit outside, and a flag on a tall pole.
      const R = 9;
      const H = 13;
      const skinC = mix(f.main, PLAS, 0.4);
      const shape: Shape = (u, v, z) => {
        if (Math.abs(u) <= 14 && (v / R) ** 2 + (z / H) ** 2 <= 1) {
          if (u > 13.4) {
            const [dv, dhw, dtop] = BARRACKS_DOOR;
            if (Math.abs(v - dv) < dhw && z < dtop) return z > dtop - 0.7 ? hazard(v, 0) : Math.abs(v - dv) > dhw - 0.5 ? CONC_L : Math.abs(v - dv) < 0.2 ? GUN_D : z > 4 && z < 5.6 ? GLASS_D : shade(OLIVE, -0.1);
            if (Math.abs(v - dv) < 0.6 && z > dtop + 0.2 && z < dtop + 1.1) return LAMP;
            if (Math.abs(Math.abs(v) - 5) < 1.4 && z > 2.6 && z < 5.2) return Math.abs(Math.abs(v) - 5) > 1 || z > 4.8 || z < 3 ? CONC_L : glow;
            if (Math.abs(v) < 1.8 && z > 8.6 && z < 10.6) return Math.abs(v) > 1.4 || z < 9 || z > 10.2 ? CONC_L : glow; // round window up in the gable
            return mod(z, 1.4) < 0.3 || mod(v + (Math.floor(z / 1.4) % 2) * 1.2, 2.4) < 0.3 ? shade(BRICK, -0.25) : g(BRICK, u, v, z, 0.1);
          }
          const a = Math.atan2(z / H, v / R);
          if (Math.abs(a - Math.PI / 2) < 0.2 && mod(u + 14, 7) > 2 && mod(u + 14, 7) < 5) return mod(u + 14, 7) < 2.4 || mod(u + 14, 7) > 4.6 ? STEEL : glow;
          if (Math.abs(a - 1.0) < 0.14) return g(f.main, u, v, z); // a stripe in the side's color along each flank
          if (v > 0 && z > 3 && z < 6 && u > -2 && u < 3) return mod(Math.floor(u * 1.4) + Math.floor(z), 2) ? WHITE : skinC;
          const rib = mod(u + 40, 2) < 0.6;
          if (z < 1.2) return CONC_D;
          return g(rib ? shade(skinC, -0.2) : mod(u + 40, 2) < 1.1 ? shade(skinC, 0.1) : skinC, u, v, z, 0.06);
        }
        // the watchtower: a round shaft, a glazed lookout and a pointed roof
        const td = Math.hypot(u + 11, v + 9.4);
        if (z >= 18 && z < 22 && td < 3.4 - (z - 18) * 0.85) return z < 18.5 ? f.dark : g(f.main, u, v, z);
        if (td < 3.2 && z >= 15 && z < 18) return z < 15.5 || z > 17.5 ? PLAS_L : mod(Math.atan2(v + 9.4, u + 11) * 4 / Math.PI, 1) < 0.2 ? PLAS_D : GLASS;
        if (td < 2.3 && z < 15) return rskin(Math.atan2(v + 9.4, u + 11) * 2.3, z, 15, { seed: 5 });
        if (cyl(u, v, -6, -3, 0.8) && z <= 15.4) return z > 14.6 ? BLACK : z > 13.8 ? STEEL : RUST;
        if (v > 10 && v < 12.2 && u > -12 && u < 8 && z < 2.6 && !(u > -3.4 && u < -0.6)) {
          const course = Math.floor(z / 0.9);
          const bag = mod(u + course * 1.1, 2.2);
          return bag < 0.35 ? shade(SAND_BAG, -0.3) : shade(SAND_BAG, (hash2(Math.floor((u + course * 1.1) / 2.2), course, 5) - 0.5) * 0.2 + (z - course * 0.9 > 0.5 ? 0.06 : -0.06));
        }
        if (inBox(u, v, z, -13, -9.4, 9.6, 11.6, 0, 2) || inBox(u, v, z, -12.4, -10, 9.8, 11.4, 2, 3.6)) return Math.abs(mod(z, 2) - 1) < 0.25 ? HAZ : z > 3.2 || (z > 1.6 && z < 2) ? shade(OLIVE, 0.15) : OLIVE;
        if ((u - 11) ** 2 / 6 + (z - 2.6) ** 2 / 2.4 < 1 && Math.abs(v - 10.6) < 1.4) return Math.abs(u - 11) < 0.3 ? OLIVE_D : z > 3.4 ? shade(OLIVE, 0.15) : OLIVE;
        if (Math.abs(v - 10.6) < 1.5 && (Math.abs(u - 9.6) < 0.4 || Math.abs(u - 12.4) < 0.4) && z < 1.4) return WHEEL;
        if (Math.abs(u - 15.5) < 0.4 && Math.abs(v - 9) < 0.4 && z < 27) return z > 26.4 ? HAZ : STEEL;
        if (cyl(u, v, 15.3, 9, 1) && z < 1) return CONC_L;
        return null;
      };
      return { shape, rx: 16, ry: 12, zmax: 27, fx: [{ x: 15.5, y: 9, z: 26 }] };
    }
    case 'derrick': {
      // A tech oil derrick, out in the wilds for anyone to take: a riveted
      // steel storage tank under a shallow dome, ringed by a handrail and
      // banded in the color of whoever holds it, with a ladder up its front;
      // a pumpjack's skid, A-frame and gearbox over the wellhead (its beam,
      // horsehead and cranks are drawn on top, rocking up and down: makePumpBeam); a
      // tin-roofed pump shed; sandbags round the back and a tall flagpole.
      // fx[0] is the beacon on the tank, fx[1] the top of the flagpole.
      const [tu, tv] = DERRICK_TANK;
      const TR = 7.5;
      const TH = 16;
      const shape: Shape = (u, v, z) => {
        // the tank
        const t = drum(u, v, z, tu, tv, TR, TH, 3.4);
        if (t) {
          if (t.roof) {
            if (t.d < 1.5) return z > TH + 3.4 - 0.3 ? GUN_D : METAL_D;
            return mod(t.a * 8 / Math.PI, 1) < 0.05 || Math.abs(t.d - 4.2) < 0.25 ? METAL_D : g(STEEL, u, v, z, 0.05);
          }
          // the ladder, up the side that faces the pumpjack
          const la = Math.abs(t.a - 1.2);
          if (la < 0.17 && z > 0.8) {
            if (la > 0.12) return RUST;
            if (mod(z, 1.3) < 0.35) return shade(RUST, 0.15);
            return shade(METAL_D, -0.18);
          }
          // rivets along the seams
          const along = t.a * TR;
          if (mod(z, 3.6) < 0.3 || mod(along, 6.5) < 0.25) return METAL_D;
          if (mod(z, 3.6) < 0.7 && mod(along, 1.3) < 0.35) return GUN_L;
          return rskin(along, z, TH, { seed: 41, body: STEEL, band: [11.6, 13.4, f.main] });
        }
        // the hatch and beacon on top of the dome
        if (cyl(u, v, tu, tv, 1.1) && z >= TH + 3.2 && z < TH + 4.8) return z > TH + 4.2 ? RED : GUN;
        // the handrail round the edge of the roof
        const rd = Math.hypot(u - tu, v - tv);
        if (rd > TR && rd < TR + 0.5 && z > TH && z < TH + 1.6) {
          if (z > TH + 1.2) return METAL_D;
          if (mod(Math.atan2(v - tv, u - tu) * TR, 3) < 0.45) return METAL_D;
          return null;
        }
        // the pumpjack, standing along the right-hand side
        const jk = pumpBase(...pumpAt(u, v), z);
        if (jk) return jk;
        // the pump shed: corrugated walls under a tin roof that slopes to the front
        const sd = rrect(u, v, -9, 8.4, 4, 3, 0.6);
        const top = 6.6 - (v - 8.4) * 0.22;
        if (sd <= 0.6 && z > top - 0.6 && z <= top) return mod(u + 40, 1.1) < 0.4 ? shade(METAL, -0.14) : g(METAL, u, v, z, 0.08);
        if (sd <= 0 && z <= top - 0.6) {
          if (v > 11.1 && u > -10.6 && u < -8 && z < 4.6) return Math.abs(u + 8.6) < 0.25 && Math.abs(z - 2.4) < 0.3 ? HAZ : z > 4.2 || u < -10.3 || u > -8.3 ? GUN_D : METAL_D;
          if (u > -5.3 && v > 7.4 && v < 9.8 && z > 2.6 && z < 4.4) return z < 2.9 || z > 4.1 || Math.abs(v - 8.6) < 0.2 ? GUN_D : hash2(Math.floor(u), 3, 7) > 0.4 ? WIN_LIT : WIN;
          if (z < 1.2) return CONC_D;
          return mod((u > -5.3 ? v : u) + 40, 1.2) < 0.4 ? shade(GUN_L, -0.16) : g(GUN_L, u, v, z, 0.06);
        }
        // oil drums by the jack
        const dr = drums(u, v, z - 1.1, [[13.4, -9.4, RUST], [12, -11, f.main], [13.6, -7.4, GUN_L]]);
        if (dr && z > 1.1) return dr;
        // the flagpole
        if (Math.abs(u - DERRICK_FLAG[0]) < 0.4 && Math.abs(v - DERRICK_FLAG[1]) < 0.4 && z < 25) return z > 24.4 ? HAZ : STEEL;
        // sandbags along the back
        if (z < 3.6 && z >= 1 && ((u < -12.4 && v < 4 && v > -12.6) || (v < -10.6 && u < 9 && u > -14.6))) {
          const zz = z - 1;
          const course = Math.floor(zz / 0.9);
          const along = u < -12.4 ? v : u;
          const bag = mod(along + course * 1.1, 2.2);
          return bag < 0.35 ? shade(SAND_BAG, -0.3) : shade(SAND_BAG, (hash2(Math.floor((along + course * 1.1) / 2.2), course, 6) - 0.5) * 0.2 + (zz - course * 0.9 > 0.5 ? 0.06 : -0.06));
        }
        // the concrete pad, with an oily stain round the wellhead
        if (z < 1 && Math.abs(u) <= 14.8 && Math.abs(v) <= 12.8) {
          const e = Math.min(14.8 - Math.abs(u), 12.8 - Math.abs(v));
          if (e < 0.7) return CONC_D;
          if (mod(u + 15, 7.4) < 0.25 || mod(v + 13, 6.4) < 0.25) return shade(CONC, -0.1);
          const oil = Math.hypot((u - 9) * 1.3, v - 9.4) + vnoise(u / 2, v / 2, 19) * 2.4;
          if (oil < 3.6) return mix(TAR, BLACK, oil < 2.4 ? 0.4 : 0.1);
          return g(CONC_L, u, v, z, 0.08, 17);
        }
        return null;
      };
      return { shape, rx: 15, ry: 13, zmax: 25, fx: [{ x: tu, y: tv, z: TH + 5 }, { x: DERRICK_FLAG[0], y: DERRICK_FLAG[1], z: 24 }] };
    }
    case 'refinery': {
      // A great domed processing drum with a tall chimney, a round ore tank,
      // and the receiving bay: a hauler backs onto the striped pad in front of
      // the bay's intake and tips its load in, and a covered conveyor carries
      // it up and over to the drum. A furnace glows in the bay's end wall.
      const EMB = hex('#ff8a3a');
      const EMB_L = hex('#ffd27a');
      const shape: Shape = (u, v, z) => {
        // the receiving bay: rounded at the back, a vaulted roof, the intake in its front
        const be = -rrect(u, v, 12, -8, 8, 6, 3);
        if (be >= 0 && z <= 12 + Math.max(0, capH(Math.abs(v + 8), 6.6, 4.6)) && z <= 16.6) {
          if (v > -2.6 && u > 7.4 && u < 17.6 && z < 8) {
            if (u < 8.3 || u > 16.7 || z > 7.1) return hazard(u, z);
            if (v > -2.3) return null;
            return z < 1.2 ? BLACK : mod(Math.floor(u * 1.3), 3) === 0 ? GUN : z > 5.6 ? GUN_D : BLACK;
          }
          if (z > 12) return mod(u, 2.4) < 0.45 ? METAL_D : Math.abs(v + 8) < 1.2 ? g(f.main, u, v, z) : METAL;
          if (u > 19.4 && v > -12 && v < -4) {
            if (z > 2.4 && z < 5.4) {
              if (z < 2.9 || z > 4.9 || mod(v + 12, 2.7) < 0.6) return GUN_D;
              return z > 4 ? EMB : EMB_L;
            }
            if (z > 7 && z < 10) return mod(Math.floor(z * 1.6), 2) ? GUN_D : METAL_D;
          }
          if (v > -2.6 && z > 9 && z < 10.6 && (Math.abs(u - 6) < 0.8 || Math.abs(u - 19) < 0.8)) return LAMP;
          return rskin(u + v, z, 12, { seed: 13, band: [10.6, 11.6, f.main] });
        }
        if (u > 7 && u < 18 && v > -2 && v < 0.6 && z > 8 && z < 9.6 - (v + 2) * 0.35) return z > 9.2 - (v + 2) * 0.35 ? f.main : g(METAL_D, u, v, z);
        // the crusher drum on the bay's roof, where the conveyor starts
        const c = drum(u, v, z, 8, -8, 3.4, 20, 1.4);
        if (c && z > 14) return c.roof ? roofC : z > 17 && z < 18.6 ? (mod(c.a * 4 / Math.PI, 1) < 0.3 ? METAL_D : glow) : mod(Math.floor(z * 1.2), 2) ? METAL : shade(METAL, -0.1);
        // the covered conveyor over to the drum
        if (Math.abs(v + 8) < 1.4 && u > -2 && u < 6 && z > 16.4 && z < 18.4) {
          if (z > 17.8) return Math.abs(v + 8) > 1 ? HAZ : shade(METAL, -0.1);
          return mod(u, 2.4) < 0.5 ? METAL_D : Math.abs(v + 8) > 1 ? METAL : TREAD;
        }
        if (Math.abs(u - 2.6) < 0.4 && Math.abs(Math.abs(v + 8) - 1) < 0.4 && z <= 16.4) return GUN_D;
        // the chimney, on the drum's shoulder
        if (cyl(u, v, -15, -9, 1.6) && z >= 12 && z < 31) return z > 30.2 ? BLACK : z > 28.4 ? f.main : mod(Math.floor(z / 2), 2) ? PLAS_D : shade(PLAS_D, 0.12);
        // the processing drum
        const p = drum(u, v, z, -9, -3, 10, 13, 7.4);
        if (p) {
          if (p.roof) {
            if (p.d < 2.6) return p.d < 1.6 ? GUN_D : f.main;
            return mod(p.a * 8 / Math.PI, 1) < 0.07 || Math.abs(z - 17.6) < 0.3 ? PLAS_D : g(PLAS_L, u, v, z);
          }
          if (Math.abs(p.a - Math.PI / 2) < 0.34 && z < 8.6) {
            // a roller door facing the front
            if (Math.abs(p.a - Math.PI / 2) > 0.29 || z > 8) return hazard(u, z);
            return mod(Math.floor(z * 1.5), 2) ? METAL_D : METAL;
          }
          return rskin(p.a * 10, z, 13, { seed: 11, win: [8.8, 11.4], band: [11.8, 12.8, f.main], pitch: 4.4, lit: glow });
        }
        // the ore tank
        const k = drum(u, v, z, -13.5, 10.5, 4.4, 10, 3.2);
        if (k) return k.roof ? (k.d < 1 ? GUN_D : g(STEEL, u, v, z)) : z > 6 && z < 7.4 ? mod(k.a * 4 / Math.PI, 1) < 0.5 ? f.main : f.light : rskin(k.a * 4.4, z, 10, { seed: 12, body: METAL });
        // the docking pad: hazard border, guide stripes for the tracks, a grille over the pit
        if (inBox(u, v, z, 4.5, 20.5, -2, 16, 0, 1)) {
          if (u > 7.6 && u < 17.4 && v < 2) return mod(Math.floor(u * 1.2), 2) || mod(Math.floor(v * 1.2), 2) ? GUN : BLACK;
          if (u < 5.6 || u > 19.4 || v > 14.9) return hazard(u, v);
          if (Math.abs(u - 6.8) < 0.35 || Math.abs(u - 18.2) < 0.35) return mod(Math.floor(v / 2), 2) ? HAZ : shade(TAR, 0.1);
          return g(hash2(Math.floor(u * 0.8), Math.floor(v * 0.8), 21) > 0.93 ? shade(TAR, -0.2) : shade(TAR, 0.12), u, v, z, 0.08);
        }
        for (const [bu, bv] of [[4.9, 15.6], [20.1, 15.6]]) if (cyl(u, v, bu, bv, 0.7) && z < 3) return mod(Math.floor(z * 1.4), 2) ? HAZ : BLACK;
        if ((u - 1.4) ** 2 + (v - 13) ** 2 + (z * 1.6) ** 2 < 4.5 + hash2(Math.floor(u * 2), Math.floor(v * 2), 9)) return hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 7, 4) > 0.8 ? hex('#f2d06a') : hex('#c09443');
        return null;
      };
      return {
        shape,
        rx: 21,
        ry: 16,
        zmax: 32,
        fx: [
          { x: -15, y: -9, z: 31 },
          { x: 6, y: -1.6, z: 10 },
          { x: 19, y: -1.6, z: 10 },
          { x: 12.5, y: -1.5, z: 4 },
        ],
      };
    }
    case 'radar': {
      // The Air command: a long runway across the front, a paved apron with
      // four parking stands behind it (fx[1..4]), and at the back a big
      // barrel-vaulted hangar whose door faces the apron (HANGAR_DOOR, fx[5];
      // new planes roll out of it), with a control tower and its radar dish
      // (fx[0]) at one end and fuel tanks at the other. fx[6] and fx[7] are
      // the runway's two ends.
      const [hcu, hv, hhw, htop] = HANGAR_DOOR;
      const [rwv, rw0, rw1] = AIR_RUNWAY;
      const HR = 25;
      const vault = (u: number) => 8 + 12 * Math.sqrt(Math.max(0, 1 - (u / HR) ** 2));
      const TU = 36;
      const TV = -17;
      const shape: Shape = (u, v, z) => {
        // the hangar
        if (Math.abs(u) <= HR && v >= -25.5 && v <= hv && z <= vault(u)) {
          const tz = vault(u);
          if (v > hv - 0.6) {
            // the front wall: the big door, an arch of the side's color over it
            const door = rollerDoor(u, v, z, hcu, hhw, hv, htop);
            if (door) return door;
            if (z > tz - 1) return PLAS_L;
            if (z > tz - 2.4) return g(f.main, u, v, z);
            if (z > htop && z < htop + 1.4 && Math.abs(u - hcu) < hhw + 1.5) return mod(Math.floor(u * 1.3), 2) && z > htop + 0.3 && z < htop + 1.1 ? WHITE : f.dark;
            if (Math.abs(Math.abs(u - hcu) - hhw - 2.4) < 0.7 && z > 10 && z < 11.2) return LAMP;
            return rskin(u, z, tz, { seed: 21 });
          }
          if (z > tz - 0.8) {
            // the vault: ribbed sheet, a glazed strip along the crown, bands of the side's color
            if (Math.abs(u) < 2.2) return mod(v, 3) < 0.45 ? STEEL : GLASS_D;
            if (mod(v + 26, 5.5) < 0.6) return PLAS_D;
            if (Math.abs(Math.abs(u) - 11) < 1) return g(f.main, u, v, z);
            return mod(u, 1.6) < 0.4 ? METAL_D : g(METAL, u, v, z, 0.04);
          }
          return rskin(u + v, z, 8, { seed: 22, band: [6.4, 7.4, f.main], win: [3.2, 5.2], pitch: 4.4, lit: glow });
        }
        // the control tower: a low round ops block, a shaft, a glazed cab, the dish's roof
        const td = Math.hypot(u - TU, v - TV);
        if (td < 4.2 && z >= 17 && z < 21) {
          if (z > 20.4) return f.light;
          if (z < 17.6) return f.dark;
          return mod(Math.atan2(v - TV, u - TU) * 6 / Math.PI, 1) < 0.2 ? f.dark : z > 19.6 ? GLASS_L : GLASS;
        }
        if (td < 2.4 && z < 17) return mod(Math.floor(z / 2), 2) ? PLAS_L : PLAS;
        const ops = drum(u, v, z, TU, TV, 7, 5.6, 2.2);
        if (ops) {
          if (ops.roof) return g(roofC, u, v, z);
          if (z > 2.6 && z < 4.6) return mod(ops.a * 8 / Math.PI, 1) < 0.18 ? PLAS_L : hash2(Math.floor(ops.a * 8 / Math.PI), 2, 9) > 0.4 ? hex('#6fe0a0') : WIN_B;
          return rskin(ops.a * 7, z, 5.6, { seed: 23, band: [4.8, 5.4, f.main] });
        }
        // fuel tanks, and a pipe to the apron
        for (const [cu, cv] of [[-36, -20], [-36, -12.5]]) {
          const t = drum(u, v, z, cu, cv, 3.4, 4.6, 1.6);
          if (t) return t.roof ? STEEL : Math.abs(z - 2.4) < 0.3 ? f.dark : mod(Math.floor(t.a * 4), 2) ? STEEL : METAL;
        }
        if (Math.abs(v + 16) < 0.4 && u > -32.6 && u < -22 && z < 1) return GUN_D;
        if (z > 0.6) {
          // edge lights along the runway, and a windsock pole
          if (v > 12 && v < 26 && Math.abs(mod(u + 2, 10) - 5) < 0.4 && (Math.abs(v - 12.6) < 0.4 || Math.abs(v - 25.4) < 0.4) && z < 1.4) return z > 1 ? (v < rwv ? LAMP : hex('#7fe0a0')) : GUN_D;
          if (Math.hypot(u - 47, v - 9) < 0.35 && z < 7) return z > 6.4 ? HAZ : GUN_D;
          if (Math.abs(v - 9) < 0.4 && u > 47 && u < 50 && Math.abs(z - 6.2) < 0.6) return mod(Math.floor(u * 1.5), 2) ? hex('#f0901e') : WHITE;
          return null;
        }
        if (Math.abs(u) > 50 || Math.abs(v) > 26) return null;
        // the runway
        if (v > 12.6 && v < 25.4) {
          const dv = v - rwv;
          if (Math.abs(dv) > 5.6) return Math.abs(dv) > 6 ? shade(TAR, -0.15) : WHITE; // edge lines
          if (u < rw0 + 4 || u > rw1 - 4) return Math.abs(u) > 49 ? shade(TAR, -0.15) : mod(dv + 0.5, 2) < 1 ? WHITE : TAR; // threshold stripes
          if (Math.abs(dv) < 0.4 && mod(u, 8) < 4.5) return WHITE; // centerline
          if ((Math.abs(u - (rw0 + 12)) < 3 || Math.abs(u - (rw1 - 12)) < 3) && Math.abs(Math.abs(dv) - 3) < 0.9) return WHITE; // touchdown marks
          return g(mod(u, 13) < 0.3 ? shade(TAR, -0.1) : TAR, u, v, z, 0.07);
        }
        // the apron: concrete slabs, a taxi line from the hangar door and one up to each stand
        if (Math.abs(v - 12.2) < 0.4) return HAZ;
        if (Math.abs(v + 3) < 0.3 && Math.abs(u) < 40) return HAZ;
        for (const su of AIR_STAND_U) {
          const du = u - su;
          const dv = v - AIR_STAND_V;
          const d = Math.hypot(du, dv);
          if (Math.abs(du) < 0.3 && v > -3 && v < 12) return HAZ;
          if (Math.abs(d - 9) < 0.35 && dv > -6) return WHITE;
          if (Math.abs(dv + 7) < 0.4 && Math.abs(du) < 5) return WHITE; // the stand's stop bar
        }
        if (mod(u + 1, 12) < 0.3 || mod(v + 2, 10) < 0.3) return CONC_D;
        return g(v < -8 ? CONC : CONC_L, u, v, z, 0.06);
      };
      return {
        shape,
        rx: 50,
        ry: 26,
        zmax: 22,
        fx: [
          { x: TU, y: TV, z: 23.4 },
          ...AIR_STAND_U.map((x) => ({ x, y: AIR_STAND_V, z: 0.6 })),
          { x: hcu, y: hv, z: 0 },
          { x: rw0, y: rwv, z: 0 },
          { x: rw1, y: rwv, z: 0 },
        ],
      };
    }
    case 'factory': {
      // The Vehicle works: a great vaulted hangar with one big garage door in
      // its front (+y) wall, which finished vehicles drive out of
      // (FACTORY_DOOR; the game draws it opening), lower rounded wings either
      // side and a stack on each.
      const [dcu, dhw, dtop] = FACTORY_DOOR;
      const VR = 20.5;
      const top = (u: number) => 11 + 15 * Math.sqrt(Math.max(0, 1 - (u / VR) ** 2));
      const shape: Shape = (u, v, z) => {
        if (Math.abs(u) <= VR && Math.abs(v) <= 18 && z <= top(u)) {
          const tz = top(u);
          if (v > 17.4) {
            // the front wall: the door, an arch of the side's color over it
            const door = rollerDoor(u, v, z, dcu, dhw, 18, dtop);
            if (door) return door;
            if (z > tz - 1) return PLAS_L;
            if (z > tz - 2.4) return g(f.main, u, v, z);
            if (z > dtop && z < dtop + 1.6 && Math.abs(u - dcu) < dhw + 1.5) return mod(Math.floor(u * 1.3), 2) && z > dtop + 0.4 && z < dtop + 1.2 ? WHITE : f.dark;
            if (Math.abs(Math.abs(u - dcu) - dhw - 2.2) < 0.7 && z > 13 && z < 14.2) return LAMP;
            // round windows high up either side
            for (const wu of [-16, 16]) {
              const wd = Math.hypot(u - wu, z - 13);
              if (wd < 1.8) return wd > 1.3 ? PLAS_D : glow;
            }
            if (z > 18 && z < tz - 3) {
              const wd = Math.hypot(u - dcu, z - 21.5);
              if (wd < 2.4) return wd > 1.9 ? PLAS_D : mod(Math.atan2(z - 21.5, u - dcu) * 4 / Math.PI, 1) < 0.2 ? PLAS_D : glow;
            }
            return rskin(u, z, tz, { seed: 13 });
          }
          if (z > 11 && z > tz - 0.8) {
            // the vault: ribbed sheet, a glazed strip along the crown, stripes of the side's color
            if (Math.abs(u) < 2.4) return mod(v, 3) < 0.45 ? STEEL : z > tz - 0.4 ? GLASS : GLASS_D;
            if (mod(v + 18, 6) < 0.7) return PLAS_D;
            if (Math.abs(Math.abs(u) - 10) < 1) return g(f.main, u, v, z);
            return mod(u, 1.6) < 0.4 ? METAL_D : g(METAL, u, v, z, 0.04);
          }
          return rskin(u + v, z, 11, { seed: 14, band: [9.2, 10.4, f.main] });
        }
        // the wings, and a stack on each
        for (const s of [-1, 1]) {
          if (cyl(u, v, s * 23.5, -11, 1.5) && z < 25) return z > 24.2 ? BLACK : z > 22.6 ? f.main : mod(Math.floor(z), 3) === 0 ? METAL_D : STEEL;
          const e = -rrect(u, v, s * 23.5, 0, 3.6, 17, 3);
          if (e >= 0 && z <= shoulder(e, 12, 3)) {
            if (e > 0.6 && z > shoulder(e, 12, 3) - 0.7) return e < 3 ? PLAS_L : g(roofC, u, v, z);
            if (v > 16.4 && Math.abs(u - s * 23.5) < 1.2 && z < 5) return z > 4 ? LAMP : GUN;
            return rskin(u + v, z, 12, { seed: 15, win: [5, 8.4], band: [9.6, 10.8, f.main], pitch: 4.6, lit: glow });
          }
        }
        if (v > 18 && v < 19 && Math.abs(u - dcu) < dhw && z < 0.5) return Math.abs(Math.abs(u - dcu) - dhw + 1.5) < 0.5 ? HAZ : CONC_L;
        return null;
      };
      return { shape, rx: 27, ry: 19, zmax: 27, fx: [{ x: -23.5, y: -11, z: 25 }, { x: 23.5, y: -11, z: 25 }] };
    }
    case 'tower': {
      // Turret: a tall round bunker with a sloped skirt, firing slits and
      // a band of the side's color; the game draws the turning guns on top.
      const H = 9;
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        const r = z < 3 ? 7.6 - z * 0.45 : 6.25 - (z - 3) * 0.05;
        if (d < r && z < H) {
          const a = Math.atan2(v, u);
          if (z > H - 0.6) {
            if (d > r - 1) return PLAS_L;
            if (d < 4.4) return d > 3.8 ? GUN_D : mod(a * 4, 2) < 1 ? f.dark : shade(f.dark, 0.14);
            return hazard(a * 7, 0);
          }
          if (z < 3) return z < 1 ? CONC_D : mod(a * 12 / Math.PI, 1) < 0.08 ? PLAS_D : g(PLAS, u, v, z);
          if (z > 4.6 && z < 5.8 && mod(a * 4 / Math.PI + 0.5, 1) < 0.22) return BLACK; // firing slits
          if (z > 7 && z < 7.9) return g(f.main, u, v, z);
          if (Math.abs(a - 2.2) < 0.2 && z < 6) return GUN; // hatch
          return rskin(a * 6.2, z, H, { seed: 9 });
        }
        if (inBox(u, v, z, -7, -4.2, 6.8, 8.4, 0, 1.6)) return z > 1.2 ? shade(OLIVE, 0.15) : Math.abs(u + 5.6) < 0.3 ? HAZ : OLIVE;
        return null;
      };
      return { shape, rx: 8, ry: 8, zmax: 10, fx: [{ x: 0, y: 0, z: H }] };
    }
    case 'pillbox': {
      // Pillbox: a squat eight-sided concrete bunker dug half into the
      // ground, a firing slit on every face with a machine gun poking out of
      // the ones that face the viewer, a thick roof slab over it with a band
      // of the side's color, a round hatch and a periscope on top, and a low
      // curve of sandbags in front. Its guns don't turn: it fires out of
      // whichever slit faces the target. fx[0] is where they fire from.
      const H = 4.6; // top of the roof slab
      const oct = (u: number, v: number) => Math.max(Math.abs(u), Math.abs(v), (Math.abs(u) + Math.abs(v)) * 0.7071);
      const shape: Shape = (u, v, z) => {
        const d = oct(u, v);
        const a = Math.atan2(v, u);
        const face = Math.round(a / (Math.PI / 4));
        const off = a - face * (Math.PI / 4);
        // the walls, sloping in a little as they rise
        if (z < 3.4 && d < 6.6 - z * 0.3) {
          if (z < 0.9) return grime(CONC_D, a * 6, z, H, 19);
          if (z > 1.8 && z < 2.6 && Math.abs(off) < 0.24) return z < 1.95 ? CONC_L : BLACK; // firing slits
          if (Math.abs(off) > 0.36) return shade(g(CONC, u, v, z), -0.06); // the corners
          return grime(g(CONC, u, v, z, 0.07), a * 6, z, H, 19);
        }
        // the machine guns in the slits that face the viewer
        for (const k of [0, 1, 2]) {
          const ga = (k * Math.PI) / 4;
          const along = u * Math.cos(ga) + v * Math.sin(ga);
          const across = -u * Math.sin(ga) + v * Math.cos(ga);
          if (along > 5 && along < 7.6 && Math.hypot(across, z - 2.2) < 0.4) return along > 7.2 ? GUN_D : GUN;
        }
        // the roof slab, a little wider than the walls
        if (z >= 3.4 && z < H && d < 6.2) {
          if (z < 3.7) return d > 5.6 ? CONC_D : CONC;
          if (d > 5.5) return z > H - 0.35 ? CONC_L : g(f.main, u, v, z);
          if (z > H - 0.4) return mod(u + v, 3.2) < 0.3 ? CONC_D : g(CONC_L, u, v, z, 0.08);
          return g(CONC, u, v, z);
        }
        // a round hatch and a periscope on the roof
        const hd = Math.hypot(u + 1.6, v + 1.4);
        if (z >= H && z < H + 0.7 && hd < 1.7) return hd < 1.1 && z > H + 0.4 ? GUN_D : GUN;
        if (inBox(u, v, z, 1.4, 2.4, -2.6, -1.6, H, H + 1.8)) return z > H + 1.2 ? (u > 2.1 ? BLACK : GUN_L) : GUN;
        // a low curve of sandbags in front
        const sd = Math.hypot(u, v);
        if (sd > 7.1 && sd < 8.3 && z < 1.5 && a > -0.15 && a < Math.PI / 2 + 0.15 && Math.abs(a - Math.PI / 4) > 0.14) {
          const course = Math.floor(z / 0.75);
          const along = a * 5 + course * 0.5;
          if (mod(along, 1) < 0.14 || z - course * 0.75 < 0.15) return shade(SAND_BAG, -0.3);
          return shade(SAND_BAG, (hash2(Math.floor(along), course, 19) - 0.5) * 0.22);
        }
        return null;
      };
      return { shape, rx: 8, ry: 8, zmax: 7, fx: [{ x: 0, y: 0, z: 2.2 }] };
    }
    case 'silo': {
      // Ore silos: a tall rounded tank and a smaller one, each with a glowing
      // gauge of the side's color up its front, a pump house between.
      const tank = (u: number, v: number, z: number, cu: number, cv: number, r: number, h: number) => {
        const k = drum(u, v, z, cu, cv, r, h, r * 0.75);
        if (!k) return null;
        if (k.roof) {
          if (k.d < 1) return z > h + r * 0.75 - 0.4 ? GUN_D : GUN;
          return mod(k.a * 4 / Math.PI, 1) < 0.07 ? METAL_D : g(STEEL, u, v, z, 0.05);
        }
        if (Math.abs(k.a - Math.PI / 4) < 0.16 && z > 2.4 && z < h - 1.6) {
          // the gauge: a glass slot, lit as high as the silo is full
          if (Math.abs(k.a - Math.PI / 4) > 0.11) return METAL_D;
          return z < h * 0.62 ? glow : GLASS_D;
        }
        if (z > h - 0.7) return METAL_D;
        if (z > h - 2.8 && z < h - 1.2) return g(f.main, u, v, z);
        if (Math.abs(k.a - 1.5) < 0.12 && k.d > r - 0.7 && z > 1.4) return mod(Math.floor(z * 1.5), 2) ? GUN_D : GUN_L;
        if (mod(z, 3.2) < 0.35) return METAL_D;
        return rskin(k.a * r, z, h, { seed: cu + 9, body: METAL });
      };
      const shape: Shape = (u, v, z) => {
        const s = tank(u, v, z, -4.4, -2.6, 6.4, 18) ?? tank(u, v, z, 6.4, 3.8, 4.4, 12);
        if (s) return s;
        if (Math.abs(v + 2.6 - (u + 4.4) * 0.6) < 0.8 && u > -1 && u < 4 && Math.abs(z - 13.4) < 0.5) return mod(Math.floor(u * 1.4), 2) ? HAZ : GUN;
        const e = -rrect(u, v, -7.4, 6.6, 3, 2.4, 1.6);
        if (e >= 0 && z <= shoulder(e, 5, 1.6)) {
          if (e > 0.6 && z > 4.4) return g(roofC, u, v, z);
          if (v > 8.4 && Math.abs(u + 7.4) < 0.9 && z < 3.4) return GUN;
          return rskin(u + v, z, 5, { seed: 30 });
        }
        if (Math.abs(u + 6) < 0.6 && Math.abs(z - 3) < 0.6 && v > 2 && v < 5) return COPPER;
        const dr = drums(u, v, z, [[9.4, -6, f.main], [10.4, -3.8, RUST]]);
        if (dr) return dr;
        return null;
      };
      return { shape, rx: 12, ry: 10, zmax: 23.4, fx: [] };
    }
    case 'prism': {
      // Lumen tower: a stepped round plinth, a tall column braced by four
      // fins of the side's color that sweep up into it, and the emitter coil
      // at the very top, whose ball the beam leaves from.
      const FOOT = 34.4;
      const S = 1.75;
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        const a = Math.atan2(v, u);
        // the plinth, in two rounded steps
        if (z < 3.4 && d < 7.6 - Math.max(0, z - 2.2) * 0.9) return z < 1 ? CONC_D : z > 2.6 ? PLAS_L : g(PLAS, u, v, z);
        if (z >= 3.4 && z < 6.4 && d < 5.6 - Math.max(0, z - 5.6) * 1.1) {
          if (z > 4.2 && z < 5.2) return mod(a * 8 / Math.PI, 1) < 0.25 ? f.dark : glow;
          return z > 5.6 ? PLAS_L : g(PLAS_D, u, v, z);
        }
        const c = coil(f, u, v, z, FOOT, S);
        if (c) return c;
        // the column, tapering as it rises, with glowing slits between the fins
        if (z >= 6.4 && z < 34) {
          const r = 3 - (z - 6.4) * 0.04;
          if (d < r) {
            const ph = mod(a / (Math.PI / 2) + 0.5, 1);
            if (Math.abs(ph - 0.5) < 0.08 && mod(z, 4) > 0.8) return glow;
            if (mod(z, 4) < 0.4) return METAL_D;
            return g(z > 30 ? GUN_L : STEEL, u, v, z, 0.05);
          }
          // the fins: blades on the diagonals, wide at the foot, sweeping in
          const fr = 7.4 - (z - 6.4) * 0.19;
          const ph = mod(a / (Math.PI / 2), 1);
          const w = Math.min(ph, 1 - ph) * (Math.PI / 2) * d; // distance across the blade
          if (w < 0.7 && d < fr) return d > fr - 0.8 ? f.light : z < 9 ? f.dark : g(f.main, u, v, z);
        }
        // the collar at the top of the column, which the coil stands on
        if (z >= 32.4 && z < FOOT && d < 3.8) return z < 33 ? GUN_D : z > 33.8 ? f.light : g(f.main, u, v, z);
        return null;
      };
      return { shape, rx: 8, ry: 8, zmax: 49, fx: [{ x: 0, y: 0, z: FOOT + COIL_BALL * S }] };
    }
    case 'aa': {
      // Skyguard battery: a round raised emplacement with the launcher's
      // pedestal in the middle (the game draws the launcher, turning, on top
      // of fx[0]) and a radar dome on a short tower at the back.
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        const a = Math.atan2(v, u);
        if (d < 3.2 && z < 5.4) return z > 4.8 ? GUN_D : z > 3.4 ? f.dark : g(PLAS_L, u, v, z);
        const rr = 7.6 - Math.max(0, z - 2) * 0.7;
        if (d < rr && z < 3.6) {
          if (z > 3) return d > rr - 1 ? PLAS_L : d < 4.2 ? GUN : mod(a * 6 / Math.PI, 1) < 0.1 ? GUN_D : TAR;
          if (z > 1.8 && z < 2.6) return g(f.main, u, v, z);
          return z < 1 ? CONC_D : g(PLAS, u, v, z);
        }
        // the radar dome
        const rd = Math.hypot(u + 4.6, v + 4.6);
        if (rd < 1.4 && z >= 3.6 && z < 6) return PLAS_D;
        if (Math.hypot(u + 4.6, v + 4.6, z - 7.6) < 2.2) return mod(Math.atan2(v + 4.6, u + 4.6) * 3, 1) < 0.1 ? PLAS_D : WHITE;
        if (inBox(u, v, z, 3.4, 6, -5.6, -3.4, 3.6, 5)) return z > 4.6 ? OLIVE : Math.abs(u - 4.7) < 0.25 ? HAZ : OLIVE_D;
        return null;
      };
      return { shape, rx: 8, ry: 8, zmax: 10, fx: [{ x: 0, y: 0, z: 5.4 }] };
    }
    case 'depot': {
      // Service depot: a round repair pad that vehicles drive onto, under
      // four curved pylons that meet in a ring overhead holding the hoist.
      const RING = 15;
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        const a = Math.atan2(v, u);
        // the four pylons, arcing in from the rim to the ring
        for (let i = 0; i < 4; i++) {
          const la = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const rho = u * Math.cos(la) + v * Math.sin(la);
          const w = -u * Math.sin(la) + v * Math.cos(la);
          if (rho < 3.6 || Math.abs(w) > 0.9 || z > RING + 1) continue;
          const ell = Math.hypot((rho - 3.8) / 7.8, z / RING);
          if (Math.abs(ell - 1) * 9 < 0.85) return z < 1 ? CONC_D : mod(Math.floor(z * 1.1), 4) === 0 ? HAZ : Math.abs(w) > 0.5 ? GIRDER_D : GIRDER;
        }
        if (z > RING - 0.8 && z < RING + 0.8 && Math.abs(d - 4) < 0.8) return z > RING + 0.3 ? f.light : g(f.main, u, v, z);
        // the hoist and its hook
        if (d < 1.4 && z > 11.6 && z < RING) return z > RING - 0.6 ? GUN_D : g(f.main, u, v, z);
        if (d < 0.25 && z > 7.4 && z <= 11.6) return GUN_D;
        if (Math.abs(u) < 0.6 && Math.abs(v) < 0.3 && z > 6.6 && z <= 7.4) return HAZ;
        // lamps on posts round the rim
        for (let i = 0; i < 4; i++) {
          const la = (i / 4) * Math.PI * 2;
          if (Math.hypot(u - Math.cos(la) * 11.6, v - Math.sin(la) * 11.6) < 0.45 && z < 3.4) return z > 2.8 ? LAMP : GUN_D;
        }
        if (d > 12.6 || z > 0.6) return null;
        if (d > 11.8) return hazard(a * 10, 0);
        if (d > 11) return CONC_L;
        if (Math.abs(d - 7.5) < 0.5) return WHITE;
        if (d < 6 && Math.abs(u - v) < 1 && d > 2.5) return HAZ;
        if (d < 2.8 && d > 1.2 && !(u + v > 1 && Math.abs(u - v) < 1.2)) return HAZ;
        if (hash2(Math.floor(u), Math.floor(v), 31) > 0.95) return shade(TAR, -0.15);
        return g(d < 11 ? shade(TAR, 0.12) : CONC, u, v, z, 0.08);
      };
      return { shape, rx: 13, ry: 13, zmax: 17, fx: [{ x: 0, y: 0, z: 7 }] };
    }
    case 'navy': {
      // Naval yard, built out on the water: two concrete piers with rounded
      // ends either side of an open slip, joined at the back, a domed round
      // control tower, and a tall gantry crane over the slip.
      const CZ = 22;
      const shape: Shape = (u, v, z) => {
        const au = Math.abs(u);
        // the gantry crane: legs braced in an arch, a beam across, a trolley and hook
        if (Math.abs(au - 16) < 0.8 && Math.abs(v - 2) < 0.8 && z < CZ) return z < 2.4 ? CONC_D : mod(Math.floor(z * 1.2), 4) === 0 ? HAZ : GIRDER;
        if (Math.abs(au - 16) < 0.8 && Math.abs(v - 2) < 2.4 && z < 3.2 && z > 1.6) return GIRDER_D;
        if (au < 16.8 && Math.abs(v - 2) < 0.9 && z > CZ - 1.6 && z < CZ) return mod(Math.floor(u * 0.8), 3) ? GIRDER : GIRDER_D;
        if (au < 16 && au > 10 && Math.abs(v - 2) < 0.5) {
          const ar = Math.hypot(au - 10, (CZ - 1.6 - z) * 0.9);
          if (z < CZ - 1.6 && Math.abs(ar - 6) < 0.6) return GIRDER_D; // the arched braces
        }
        if (inBox(u, v, z, 1.6, 4.4, 0.6, 3.4, CZ - 3.4, CZ - 1.6)) return z > CZ - 2 ? GUN_D : f.main;
        if (Math.abs(u - 3) < 0.2 && Math.abs(v - 2) < 0.2 && z > 12 && z < CZ - 3.4) return GUN_D;
        if (Math.abs(u - 3) < 0.7 && Math.abs(v - 2) < 0.3 && z > 11.2 && z <= 12) return HAZ;
        // the control tower on the back pier
        if (Math.abs(u + 13) < 0.3 && Math.abs(v + 12.6) < 0.3 && z < 16.4) return z > 15.8 ? RED : GUN_D;
        const t = drum(u, v, z, -13, -12.6, 3.6, 10, 2.6);
        if (t) {
          if (t.roof) return g(roofC, u, v, z);
          if (z > 7 && z < 9.4) return mod(t.a * 4 / Math.PI, 1) < 0.2 ? f.dark : z > 8.6 ? GLASS_L : GLASS;
          if (z > 9.4) return f.main;
          return rskin(t.a * 3.6, z, 10, { seed: 61 });
        }
        // bollards along the slip, a lamp at each pier's end
        if (Math.abs(au - 13.6) < 0.4 && mod(v, 6) < 0.8 && v > -9 && v < 12 && z < 3) return GUN_D;
        if (Math.abs(au - 16.5) < 0.4 && Math.abs(v - 14.6) < 0.4 && z < 5.4) return z > 4.8 ? LAMP : GUN_D;
        // the piers: the two arms with rounded ends, the back one with rounded corners
        const arm = au > 13 && au < 20 && v > -9.4 && v < 12.5 + Math.sqrt(Math.max(0, 12.25 - (au - 16.5) ** 2));
        const back = rrect(u, v, 0, -12.7, 20, 3.3, 3) < 0;
        if (!(arm || back) || z > 2.2) return null;
        if (z < 1) return shade(CONC_D, -0.15);
        if (z > 1.6 && ((arm && au < 13.8) || (back && v > -10.2 && au < 13.8))) return hazard(u + v, 0);
        if (mod(u, 5) < 0.25 || mod(v, 5) < 0.25) return CONC_D;
        return g(CONC, u, v, z, 0.08);
      };
      return { shape, rx: 20, ry: 16, zmax: 23, fx: [{ x: 0, y: 3, z: 0 }, { x: 3, y: 2, z: CZ - 3 }] };
    }
    case 'uplink': {
      // Satellite uplink: a big dish on a tall pylon, tipped up at the sky,
      // over a domed equipment drum, a feed horn on struts over the bowl.
      const tilt = 0.75;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const DZ = 19;
      const shape: Shape = (u, v, z) => {
        const du = u - 1;
        const dz = z - DZ;
        const a = du * ct - dz * st;
        const n = du * st + dz * ct;
        const r = Math.hypot(a, v);
        if (r < 8 && n > r * r * 0.045 - 0.4 && n < r * r * 0.045 + 0.4) {
          if (Math.abs(r - 7.6) < 0.4) return f.main;
          if (mod(Math.atan2(v, a) * 4 / Math.PI, 1) < 0.08) return METAL_D;
          return n > r * r * 0.045 ? g(WHITE, u, v, z, 0.04) : METAL;
        }
        const hu = 1 + st * 5;
        const hz = DZ + ct * 5;
        if ((u - hu) ** 2 + v * v + (z - hz) ** 2 < 0.9) return glow;
        for (const ang of [0, 2.1, 4.2]) {
          const ax = Math.cos(ang) * 6;
          const k = n / 5;
          if (k > 0.1 && k < 1 && Math.hypot(a - ax * (1 - k), v - Math.sin(ang) * 6 * (1 - k)) < 0.3) return GUN;
        }
        // the pylon, tapering, with a band of the side's color
        if (z >= 8 && z < DZ - 1 && Math.hypot(u, v) < 2.2 - (z - 8) * 0.06) return Math.abs(z - 13) < 0.8 ? f.main : z > DZ - 1.6 ? GUN_D : g(PLAS_L, u, v, z);
        const k = drum(u, v, z, 0, 0, 8.8, 6, 3);
        if (k) {
          if (k.roof) return mod(k.a * 6 / Math.PI, 1) < 0.08 ? PLAS_D : g(roofC, u, v, z);
          if (Math.abs(k.a - Math.PI / 4) < 0.14 && z < 3.6) return z > 3 ? LAMP : GUN;
          return rskin(k.a * 8.8, z, 6, { seed: 23, band: [3.8, 4.8, f.main] });
        }
        if (Math.abs(u + 6.5) < 0.3 && Math.abs(v + 4) < 0.3 && z < 15) return z > 14.4 ? RED : GUN_D;
        return null;
      };
      return { shape, rx: 10, ry: 10, zmax: 28, fx: [{ x: 1, y: 0, z: DZ + 1 }] };
    }
    case 'wall': {
      // A wall segment: a tall concrete block with a rounded coping and a
      // round post on each corner. Segments stand side by side on an 8-unit
      // grid, so a row of them makes one wall.
      const shape: Shape = (u, v, z) => {
        const au = Math.abs(u);
        const av = Math.abs(v);
        if (au > 4 || av > 4) return null;
        const pd = Math.hypot(au - 2.9, av - 2.9);
        if (pd < 1.2 && z < 8.6 - Math.max(0, pd - 0.4) * 0.8) return z > 7.6 ? PLAS_L : g(PLAS, u, v, z, 0.06);
        if (z < 7) {
          if (z < 0.8) return CONC_D;
          if (z > 6.2) return PLAS_L;
          if (mod(z, 1.6) < 0.25) return shade(PLAS, -0.12);
          return grime(g(PLAS, u, v, z, 0.07), u + v, z, 7, 41);
        }
        return null;
      };
      return { shape, rx: 4, ry: 4, zmax: 9, fx: [] };
    }
    case 'helipad': {
      // A round raised landing deck with a hazard rim, a ring of lights and a
      // windsock on a tall pole.
      const DECK = 1.8;
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.39;
          if (cyl(u, v, Math.cos(a) * 10.6, Math.sin(a) * 10.6, 0.55) && z < DECK + 0.8) return z > DECK + 0.3 ? (i % 2 ? LAMP : glow) : GUN_D;
        }
        if (Math.abs(u + 9.6) < 0.35 && Math.abs(v + 9.6) < 0.35 && z < 14) return z > 13.5 ? RED : STEEL;
        if (Math.abs(v + 9.6) < 0.5 && u > -9.4 && u < -5.6 && Math.abs(z - 12.8) < 0.8 - (u + 9.4) * 0.12) return mod(Math.floor(u * 1.2), 2) ? hex('#e8743a') : WHITE;
        if (d > 11.6 || z > DECK - Math.max(0, d - 10.8) * 0.9) return null;
        if (z < DECK - 0.5) return d > 11 ? CONC_D : null;
        if (d > 10.8) return PLAS_L;
        if (d > 10) return hazard(Math.atan2(v, u) * 9, 0);
        if (Math.abs(d - 8.4) < 0.6) return g(f.main, u, v, z);
        if ((Math.abs(u + 3) < 0.8 || Math.abs(u - 3) < 0.8) && Math.abs(v) < 4.2) return HAZ;
        if (Math.abs(u) < 3 && Math.abs(v) < 0.8) return HAZ;
        if (d < 8 && (Math.abs(mod(u + v, 8) - 4) < 0.25 || Math.abs(mod(u - v, 8) - 4) < 0.25)) return shade(TAR, 0.1);
        if (hash2(Math.floor(u * 0.8), Math.floor(v * 0.8), 14) > 0.94) return shade(TAR, -0.2);
        return g(d < 8 ? shade(TAR, 0.16) : CONC, u, v, z, 0.08);
      };
      return { shape, rx: 12, ry: 12, zmax: 15, fx: [] };
    }
  }
}

/** A building's footprint and effect anchors, without drawing it. */
export function buildingFoot(kind: BuildingKind, f: Faction): Omit<V2BuildingArt, 'spr'> {
  const b = buildingShape(kind, f);
  return { rx: b.rx, ry: b.ry, fx: b.fx };
}

/**
 * Where a building stands solid on the ground, for keeping units out: the
 * cells of a grid (BLOCK_CELL world units a side) over its footprint, row
 * by row from (-rx, -ry), that its walls fill somewhere between knee and
 * head height. Flat aprons and pads at ground level, and booms and cables
 * high overhead, don't count, so units can still drive onto a refinery's
 * pad or pass under a crane.
 */
export const BLOCK_CELL = 1;
export interface BuildingBlock {
  nx: number;
  ny: number;
  rx: number;
  ry: number;
  solid: Uint8Array;
}
const blockCache = new Map<BuildingKind, BuildingBlock>();
export function buildingBlock(kind: BuildingKind): BuildingBlock {
  let b = blockCache.get(kind);
  if (b) return b;
  const { shape, rx, ry } = buildingShape(kind, FACTIONS[0]);
  const nx = Math.ceil((2 * rx) / BLOCK_CELL);
  const ny = Math.ceil((2 * ry) / BLOCK_CELL);
  const solid = new Uint8Array(nx * ny);
  const ZS = [1.5, 2.5, 3.5, 5, 6.5, 8];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      hit: for (const [a, c] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        const u = -rx + (i + a) * BLOCK_CELL;
        const v = -ry + (j + c) * BLOCK_CELL;
        for (const z of ZS)
          if (shape(u, v, z)) {
            solid[j * nx + i] = 1;
            break hit;
          }
      }
    }
  // the helipad is all flat pad: the whole of its round deck is solid
  if (kind === 'helipad')
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) solid[j * nx + i] = Math.hypot(-rx + (i + 0.5) * BLOCK_CELL, -ry + (j + 0.5) * BLOCK_CELL) <= 11 ? 1 : 0;
  // lone specks (a crate, a lamp post) would only snag units: drop them
  const seen = new Uint8Array(nx * ny);
  for (let s = 0; s < nx * ny; s++) {
    if (!solid[s] || seen[s]) continue;
    const blob = [s];
    seen[s] = 1;
    for (let q = 0; q < blob.length; q++) {
      const c = blob[q];
      const ci = c % nx;
      const cj = (c - ci) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = ci + di;
        const jj = cj + dj;
        const n = jj * nx + ii;
        if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && solid[n] && !seen[n]) {
          seen[n] = 1;
          blob.push(n);
        }
      }
    }
    if (blob.length < 4) for (const c of blob) solid[c] = 0;
  }
  // and fill in anywhere walled in all round (inside a cooling tower), that
  // no one could get to anyway
  const out = new Uint8Array(nx * ny);
  const q: number[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      if ((i === 0 || j === 0 || i === nx - 1 || j === ny - 1) && !solid[j * nx + i]) {
        out[j * nx + i] = 1;
        q.push(j * nx + i);
      }
  while (q.length) {
    const c = q.pop()!;
    const ci = c % nx;
    const cj = (c - ci) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = ci + di;
      const jj = cj + dj;
      const n = jj * nx + ii;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && !solid[n] && !out[n]) {
        out[n] = 1;
        q.push(n);
      }
    }
  }
  for (let c = 0; c < nx * ny; c++) if (!out[c]) solid[c] = 1;
  blockCache.set(kind, (b = { nx, ny, rx, ry, solid }));
  return b;
}

/**
 * The light in a building's windows alone (black elsewhere), drawn over it
 * with additive blending so it can pulse: only the Tech lab has one.
 */
export function makeBuildingGlow(kind: BuildingKind, f: Faction): StackSprite | null {
  const b = buildingShape(kind, f);
  if (!b.glow) return null;
  return renderStack(b.glow, { r: 0, rx: b.rx, ry: b.ry, zmax: b.zmax, step: 0.5, flat: true, noGroundShadow: true });
}

export function makeBuilding(kind: BuildingKind, f: Faction): V2BuildingArt {
  const b = buildingShape(kind, f);
  const spr = renderStack(b.shape, { r: 0, rx: b.rx, ry: b.ry, zmax: b.zmax, bakeShadow: true, step: 0.5, shadowAlpha: 0.32 });
  return { spr, rx: b.rx, ry: b.ry, fx: b.fx };
}

export function makeDish(): StackSprite[] {
  const dish: Shape = (u, v, z) => {
    // a ribbed parabolic dish facing +u on a yoke, with its feed on struts
    const zz = z - 4.6;
    const r2 = v * v + zz * zz;
    if (r2 > 32) {
      if (Math.abs(u + 0.6) < 0.7 && Math.abs(v) < 0.7 && z < 4) return z < 1 ? GUN : GUN_D; // pedestal
      return null;
    }
    const surf = -2 + r2 * 0.07;
    if (Math.abs(u - surf) < 0.6) {
      if (r2 > 28.5) return METAL_D; // rim
      const a = Math.atan2(zz, v);
      if (u > surf) return mod(a * 2.55, 1) < 0.16 || Math.abs(Math.sqrt(r2) - 2.9) < 0.3 ? METAL_D : shade(WHITE, -Math.sqrt(r2) * 0.025);
      return mod(a * 2.55, 1) < 0.2 ? GUN : METAL_D; // the back, with its ribs
    }
    if (u < surf && u > surf - 1.6 && r2 < 3) return GUN; // hub and counterweight
    if (Math.abs(u - 2.4) < 0.6 && r2 < 0.8) return RED; // feed horn
    if (u > surf && u < 2.4) {
      // three struts from the rim to the feed
      const t = (u - surf) / (2.4 - surf);
      for (const a of [0.5, 2.6, 4.7]) if ((v - Math.cos(a) * 4.6 * (1 - t)) ** 2 + (zz - Math.sin(a) * 4.6 * (1 - t)) ** 2 < 0.2) return GUN_D;
    }
    return null;
  };
  return renderDirs(dish, 16, { r: 6.5, zmax: 11, outline: [30, 30, 28] }, 'dish');
}

// ---------- The oil derrick's pumpjack ----------

// The pumpjack's fixed parts (in its own frame, see pumpAt): the wellhead,
// the skid, the A-frame with the bearing the beam rocks on, and the gearbox.
function pumpBase(u: number, v: number, z: number): RGB | null {
  const [pu, pv] = PUMP_PIVOT;
  // the wellhead: a cellar box, the casing, a red flange and a valve
  if (inBox(u, v, z, -0.6, 2.8, pv - 1.8, pv + 1.8, 1, 1.6)) return CONC_D;
  if (cyl(u, v, 1.1, pv, 0.7) && z < 4.4) return z > 2.6 && z < 3.1 ? RED : METAL;
  if (Math.abs(z - 3.6) < 0.3 && Math.abs(u - 1.1) < 0.3 && Math.abs(v - pv) < 1.4) return RED;
  // the pumpjack's skid
  if (inBox(u, v, z, 3.6, 14.2, pv - 1.6, pv + 1.6, 1, 1.9)) return mod(u, 2.1) < 0.3 ? BLACK : u > 13.6 || u < 4.2 ? hazard(v, z) : GUN;
  // the A-frame (samson post), its cross brace and the bearing on top
  if (z >= 1.9 && z < PUMP_PIVOT[2]) {
    const k = Math.min(1, (z - 1.9) / (PUMP_PIVOT[2] - 1.9));
    const half = 1.7 - 0.8 * k;
    if (Math.abs(Math.abs(v - pv) - half) < 0.45 && z < PUMP_PIVOT[2]) {
      const fu = pu - 2.4 * (1 - k);
      const bu = pu + 2.4 * (1 - k);
      if (Math.abs(u - fu) < 0.5 || Math.abs(u - bu) < 0.5) return k > 0.9 ? GUN_D : GUN_L;
      if (Math.abs(z - 5.2) < 0.3 && u > fu && u < bu) return GUN;
    }
  }
  if (Math.hypot(u - pu, z - PUMP_PIVOT[2]) < 0.9 && Math.abs(v - pv) < 1.1) return GUN_D;
  // the gearbox the cranks turn on
  if (inBox(u, v, z, 10.6, 13.6, pv - 1.4, pv + 1.4, 1.9, 5)) return z > 4.6 ? METAL_D : mod(Math.floor(z * 1.6), 2) ? GUN : shade(GUN, 0.08);
  if (inBox(u, v, z, 10.9, 13.3, pv + 1.4, pv + 2.6, 1.9, 3.4)) return OLIVE; // the motor
  return null;
}


// Where things stand on the oil derrick (from its middle): the tank, the
// flagpole, and the bearing the pumpjack's beam rocks on.
export const DERRICK_TANK: [number, number] = [-4, -3.5];
export const DERRICK_FLAG: [number, number] = [-13.4, 11.6];
export const PUMP_PIVOT: [number, number, number] = [7.5, 6, 11.5];
// The pumpjack is modelled with its beam along u at v = PUMP_PIVOT[1] and
// stands on the derrick turned a quarter round, down its right-hand side with
// the horsehead to the front: this is where derrick point (u, v) is in the
// pumpjack's own frame.
const pumpAt = (u: number, v: number): [number, number] => [11 - v, u - 3];
export const PUMP_FRAMES = 16;

/**
 * The pumpjack's moving parts at step k of a stroke of PUMP_FRAMES steps, drawn over the derrick at its middle: the walking beam in
 * the side's color rocking on its bearing, the horsehead at its front with
 * the polished rod down to the wellhead, and the cranks turning at the back
 * with the pitman arms up to the beam's tail.
 */
export function makePumpBeam(f: Faction, k: number): StackSprite {
  const [pu, pv, pz] = PUMP_PIVOT;
  const CU = 12;
  const CZ = 3.6;
  {
    const ph = (k / PUMP_FRAMES) * Math.PI * 2;
    const th = 0.4 * Math.sin(ph); // the beam rocks this far each way (radians)
    const c = Math.cos(th);
    const s = Math.sin(th);
    // the world point at (lu, lz) along the beam
    const at = (lu: number, lz: number): [number, number] => [pu + lu * c - lz * s, pz + lu * s + lz * c];
    const [hu, hz] = at(-6.2, -0.4); // where the bridle hangs from the horsehead
    const [tu, tz] = at(5, -0.9); // the tail bearing
    const pin: [number, number] = [CU + 2 * Math.cos(ph + Math.PI / 2), CZ + 2 * Math.sin(ph)];
    const seg = (u: number, z: number, a: [number, number], b: [number, number]) => {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const q = Math.max(0, Math.min(1, ((u - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(u - a[0] - q * dx, z - a[1] - q * dz);
    };
    const shape: Shape = (wu, wv, z) => {
      const [u, v] = pumpAt(wu, wv);
      const dv = Math.abs(v - pv);
      const du = u - pu;
      const dz = z - pz;
      const lu = du * c + dz * s;
      const lz = -du * s + dz * c;
      // the walking beam: an I-beam in the side's color
      if (dv < 0.6 && lu > -4.8 && lu < 5.6 && Math.abs(lz) < 0.7) return Math.abs(lz) > 0.45 ? f.dark : g(f.main, lu, v, lz, 0.06);
      // the horsehead: a curved head on the beam's front end
      if (dv < 0.8 && lu <= -4.6 && lu > -6.6 && lz < 1 && lz > -3.4) {
        if (Math.hypot(lu + 3.6, lz + 1.2) > 3.1) return null;
        return lu < -6 ? GUN_D : g(f.light, lu, v, lz, 0.06);
      }
      // the counterweight at the tail
      if (dv < 0.9 && lu > 4.4 && lu < 6 && lz < 0.1 && lz > -1.6) return GUN;
      // the polished rod down to the wellhead
      if (Math.abs(u - 1.1) < 0.3 && dv < 0.3 && z > 4.2 && z < hz) return STEEL;
      // the cranks, either side of the gearbox, and the pitman arms up to the tail
      if (Math.abs(dv - 2) < 0.3) {
        if (seg(u, z, [CU, CZ], pin) < 0.7) return HAZ;
        if (Math.hypot(u - CU, z - CZ) < 0.6) return GUN_D;
      }
      if (Math.abs(dv - 2) < 0.25 && seg(u, z, pin, [tu, tz]) < 0.3) return GUN_L;
      if (dv < 2.2 && Math.abs(lu - 5) < 0.3 && Math.abs(lz + 0.9) < 0.3) return GUN_D; // the equalizer bar
      return null;
    };
    return renderStack(shape, { r: 0, rx: 15, ry: 13, zmax: 17, step: 0.5 });
  }
}

// ---------- Props ----------

export function makeTrees(): StackSprite[] {
  const out: StackSprite[] = [];
  const greens = [hex('#2f5a2c'), hex('#26492a'), hex('#3a6a33'), hex('#335f2e')];
  const trunk = hex('#55402a');
  const trunkL = hex('#75593a');
  for (let vnt = 0; vnt < 8; vnt++) {
    const base = greens[vnt % 4];
    let shape: Shape;
    let zmax: number;
    if (vnt < 5) {
      // conifers: whorls of drooping boughs round a straight trunk, lighter
      // at the tips, with gaps between the tiers low down
      const H = 15 + (vnt % 3) * 3;
      const tiers = 4 + (vnt % 3);
      const lean = (hash2(vnt, 1, 7) - 0.5) * 0.08;
      zmax = H + 1;
      shape = (u, v, z) => {
        const cu = u - z * lean;
        const d = Math.hypot(cu, v);
        if (z < 2.6) {
          if (d < 1.1 && z < 0.8) return shade(trunk, -0.2); // root flare
          return d < 0.8 ? (hash2(Math.floor(z * 2), Math.floor(Math.atan2(v, cu) * 2), vnt) > 0.6 ? trunkL : trunk) : null;
        }
        const tz = (z - 2.6) / (H - 2.6);
        if (tz > 1) return null;
        if (tz > 0.95) return d < 0.5 ? shade(base, 0.2) : null; // leader
        const tf = tz * tiers;
        const within = tf % 1;
        const a = Math.atan2(v, cu);
        // boughs: each tier is a ring of lobes that hang lower at their ends
        const lobes = 5 + (Math.floor(tf) % 3);
        const lobe = 0.72 + 0.28 * Math.abs(Math.cos(a * lobes * 0.5 + Math.floor(tf) * 1.3 + vnt));
        const r = (1 - tz * 0.92) * 5.8 * (0.3 + 0.7 * (1 - within) ** 0.8) * lobe + 0.4;
        const n = hash2(Math.floor(cu * 2), Math.floor(v * 2) + Math.floor(z * 2) * 31, vnt);
        if (d > r + (n - 0.5) * 0.5) return d < 0.6 ? trunk : null;
        const tip = d > r - 0.9;
        if (within < 0.2) return shade(base, tip ? -0.2 : -0.4); // the shaded underside of a tier
        if (tip && n > 0.62) return mix(shade(base, 0.2), hex('#6f9a48'), 0.35); // new growth
        if (vnt === 3 && n > 0.965 && tip) return hex('#8a5a34'); // cones
        return shade(base, (tip ? 0.05 : -0.12) + within * 0.16 + (n - 0.5) * 0.14);
      };
    } else {
      // broadleaves: a forked trunk under a canopy of leafy clumps
      zmax = 15;
      const leaf = vnt === 7 ? mix(base, hex('#8a9a34'), 0.5) : mix(base, hex('#5f7d30'), 0.45);
      const blobs: [number, number, number, number][] = [];
      const nb = 7 + (vnt % 2) * 2;
      for (let i = 0; i < nb; i++) {
        const a = hash2(i, vnt, 51) * Math.PI * 2;
        const dd = i === 0 ? 0 : 1.2 + hash2(i, vnt, 52) * 2.6;
        blobs.push([Math.cos(a) * dd, Math.sin(a) * dd, 7.2 + hash2(i, vnt, 53) * 4 - dd * 0.4, 2.3 + hash2(i, vnt, 54) * 1.5 + (i === 0 ? 1.4 : 0)]);
      }
      shape = (u, v, z) => {
        if (z < 6.4) {
          // trunk, splitting into two limbs
          const sp = Math.max(0, z - 3.2) * 0.42;
          const d1 = Math.hypot(u - sp, v - sp * 0.4);
          const d2 = Math.hypot(u + sp * 0.8, v + sp * 0.7);
          const w = z < 0.8 ? 1.2 : z < 3.2 ? 0.85 : 0.6;
          if (d1 < w || d2 < w) return hash2(Math.floor(z * 2), Math.floor(u * 2), vnt) > 0.62 ? trunkL : trunk;
          if (z < 4.6) return null;
        }
        let best = -1;
        let bq = 9;
        for (let i = 0; i < blobs.length; i++) {
          const [bu, bv, bz, r] = blobs[i];
          const n = (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 17, vnt + i) - 0.5) * 0.9;
          const q = ((u - bu) ** 2 + (v - bv) ** 2 + ((z - bz) * 1.2) ** 2) / (r + n) ** 2;
          if (q < 1 && q < bq) {
            bq = q;
            best = i;
          }
        }
        if (best < 0) return null;
        const n = hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 7, vnt + 3);
        const up = z - blobs[best][2];
        if (vnt === 6 && n > 0.955 && bq > 0.5) return hex('#f0e2ea'); // blossom
        if (vnt === 7 && n > 0.96 && bq > 0.5) return hex('#c9562f'); // fruit
        if (bq > 0.7 && up < -0.6) return shade(leaf, -0.32); // under the clump
        if (n > 0.8 && up > 0) return mix(shade(leaf, 0.18), hex('#9ab84a'), 0.3); // sunlit leaves
        if (n < 0.14) return shade(leaf, -0.24); // gaps
        return shade(leaf, (hash2(best, vnt, 9) - 0.5) * 0.14 + (n - 0.5) * 0.16);
      };
    }
    out.push(renderStack(shape, { r: 6.5, zmax, bakeShadow: true, step: 0.5, outline: [12, 22, 12], shadowAlpha: 0.3 }));
  }
  return out;
}

// Ore: low mounds of rough golden nuggets, packed close so a field reads as a
// lumpy carpet over the ground, [variant][size] with the size going down as it
// is dug. Each clump also has a flat stain of ore-darkened earth under it,
// drawn with the ground so neighboring clumps run together.
export interface OreArt {
  lumps: StackSprite[][];
  stain: StackSprite[][];
}

export function makeOre(): OreArt {
  const low = hex('#6a4614');
  const mid = hex('#ad7c26');
  const hi = hex('#dcab42');
  const glint = hex('#fbe48e');
  const spark = hex('#fff7d6');
  const earth = hex('#5a4520');
  const earthD = hex('#3d2f15');
  const lumps: StackSprite[][] = [];
  const stain: StackSprite[][] = [];
  for (let vnt = 0; vnt < 4; vnt++) {
    const ls: StackSprite[] = [];
    const ss: StackSprite[] = [];
    for (let st = 0; st < 3; st++) {
      const k = 0.5 + st * 0.25;
      // nuggets: small faceted lumps heaped towards the middle, each cut by a
      // couple of flat faces so it catches the light like broken ore
      const ns: { u: number; v: number; r: number; h: number; fa: number; fb: number }[] = [];
      const n = Math.round((11 + (vnt % 3) * 3) * k);
      for (let i = 0; i < n; i++) {
        const a = hash2(i, vnt, 71) * Math.PI * 2;
        const d = i === 0 ? 0 : Math.sqrt(hash2(i, vnt, 72)) * 4.2 * k + 0.6;
        const r = (0.75 + hash2(i, vnt, 73) * 0.6) * (0.8 + k * 0.3) * (d < 1.5 ? 1.3 : 1);
        ns.push({ u: Math.cos(a) * d, v: Math.sin(a) * d, r, h: r * (0.8 + hash2(i, vnt, 74) * 0.4) * (d < 2 ? 1.4 : 1), fa: hash2(i, vnt, 75) * Math.PI * 2, fb: hash2(i, vnt, 76) * Math.PI * 2 });
      }
      ls.push(
        renderStack(
          (u, v, z) => {
            let best: { q: number; t: number; du: number; f: number } | null = null;
            for (const c of ns) {
              const du = u - c.u;
              const dv = v - c.v;
              const q = (du * du + dv * dv) / (c.r * c.r) + (z * z) / (c.h * c.h);
              if (q > 1) continue;
              // two cuts across the lump
              const ca = (du * Math.cos(c.fa) + dv * Math.sin(c.fa)) / c.r + (z / c.h) * 0.5;
              const cb = (du * Math.cos(c.fb) + dv * Math.sin(c.fb)) / c.r + (z / c.h) * 0.8;
              if (ca > 0.62 || cb > 0.78) continue;
              if (!best || z / c.h > best.t) best = { q, t: z / c.h, du, f: ca > 0.45 ? 1 : cb > 0.6 ? 2 : 0 };
            }
            if (!best) return null;
            if (best.q > 0.74 && best.t < 0.45) return low; // the rim
            if (best.f === 1) return best.t > 0.5 ? glint : hi;
            if (best.f === 2) return shade(mid, -0.12);
            if (best.t > 0.6 && best.du < 0) return best.q < 0.2 ? spark : best.q < 0.4 ? glint : hi;
            return best.t > 0.3 ? mid : shade(mid, -0.2);
          },
          { r: 6.5, zmax: 4, step: 0.25, bakeShadow: true, outline: [44, 28, 8], shadowAlpha: 0.32 },
        ),
      );
      // the carpet: a ragged patch of ore-darkened earth, gritty with gold
      const R = 6 + k * 3;
      ss.push(
        renderStack(
          (u, v, z) => {
            if (z > 0.4) return null;
            const ang = Math.atan2(v, u);
            const edge = R * (0.82 + 0.18 * Math.sin(ang * 3 + vnt * 1.7) * Math.cos(ang * 2 - vnt));
            const d = Math.hypot(u, v);
            const hh = hash2(Math.floor(u * 2 + 50), Math.floor(v * 2 + 50), vnt + 95);
            const ragged = edge + (hh - 0.5) * 2.5;
            if (d > ragged) return null;
            // thinner, sparser grit towards the edge
            const inner = 1 - d / ragged;
            if (inner < 0.25 && hh < 0.45) return null;
            const g = hash2(Math.floor(u * 2 + 50), Math.floor(v * 2 + 50), vnt + 97);
            if (g > 0.82 - inner * 0.2) return g > 0.95 ? glint : hh > 0.5 ? hi : mid;
            return hh < 0.35 ? earthD : earth;
          },
          { r: 10, zmax: 1, flat: true, top: 0, left: 0, right: 0 },
        ),
      );
    }
    lumps.push(ls);
    stain.push(ss);
  }
  return { lumps, stain };
}

// An ore generator: a small mossy mound of dark rock split open at the top,
// with a few gold crystals pushing up out of the crack, as if the field grew
// out of it.
export function makeOreGen(): StackSprite {
  const rock = hex('#5e5446');
  const rockD = hex('#3f382e');
  const moss = hex('#4f6b32');
  const gold = hex('#d9a93c');
  const goldD = hex('#9c7224');
  const glint = hex('#fbe48e');
  // crystals: [u, v, lean u, lean v, radius, height]
  const shards: [number, number, number, number, number, number][] = [
    [0, 0, 0.1, -0.15, 0.75, 4.6],
    [0.9, -0.5, 0.35, -0.2, 0.55, 3.4],
    [-0.8, 0.4, -0.3, 0.15, 0.5, 3.1],
    [-0.2, -1, -0.1, -0.35, 0.45, 2.7],
  ];
  return renderStack(
    (u, v, z) => {
      for (const [su, sv, lu, lv, r, h] of shards) {
        if (z > h) continue;
        const k = 1 - z / h;
        const du = u - su - lu * z;
        const dv = v - sv - lv * z;
        // six-sided, tapering to a point
        const hexd = Math.max(Math.abs(du) * 0.87 + Math.abs(dv) * 0.5, Math.abs(dv));
        if (hexd <= r * Math.min(1, k * 2.2)) return du < -r * 0.2 && z > 1 ? glint : du > r * 0.35 ? goldD : gold;
      }
      // the mound: a lumpy dome, cracked open in the middle
      const n = hash2(Math.floor(u * 2 + 20), Math.floor(v * 2 + 20), 41);
      const d = Math.hypot(u * 0.9, v);
      const top = 2.2 * (1 - (d / 3.2) ** 2) + (n - 0.5) * 0.5;
      if (z > top || d > 3.3) return null;
      if (d < 1.4 && z > top - 0.6) return rockD; // the crack
      if (z > top - 0.5 && n > 0.55 && d > 1.6) return shade(moss, (n - 0.7) * 0.3);
      return shade(rock, (n - 0.5) * 0.2 - (z < 0.6 ? 0.1 : 0));
    },
    { r: 3.6, zmax: 5, step: 0.25, bakeShadow: true, outline: [28, 24, 16], shadowAlpha: 0.3 },
  );
}

export function makeRocks(): StackSprite[] {
  const out: StackSprite[] = [];
  const moss = hex('#4c6a34');
  for (let vnt = 0; vnt < 4; vnt++) {
    // boulders: a rounded lump cut by a handful of flat faces, so the light
    // picks out its planes, with moss on top and a chip or two beside it
    const base = mix(hex('#8f8676'), hex('#6c675d'), vnt / 3);
    const s = 1.7 + (vnt % 2) * 1.3;
    const cuts: [number, number, number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = hash2(i, vnt, 61) * Math.PI * 2;
      const up = 0.2 + hash2(i, vnt, 62) * 0.9;
      const l = Math.hypot(1, up);
      cuts.push([Math.cos(a) / l, Math.sin(a) / l, up / l, 0.72 + hash2(i, vnt, 63) * 0.22]);
    }
    const chips: [number, number, number][] = [
      [s * 1.7, -s * 0.5, 0.7],
      [-s * 1.2, s * 1.1, 0.55],
    ];
    out.push(
      renderStack(
        (u, v, z) => {
          for (const [cu, cv, r] of chips) if ((u - cu) ** 2 + (v - cv) ** 2 + (z * 1.3) ** 2 < r * r) return shade(base, -0.08);
          const x = u / (s * 1.4);
          const y = v / s;
          const w = z / (s * 1.25);
          if (x * x + y * y + w * w > 1) return null;
          let face = -1;
          for (let i = 0; i < cuts.length; i++) {
            const dd = x * cuts[i][0] + y * cuts[i][1] + w * cuts[i][2];
            if (dd > cuts[i][3]) return null;
            if (dd > cuts[i][3] - 0.16) face = i;
          }
          const n = hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 5, vnt);
          if (w > 0.5 && vnt % 2 === 0 && n > 0.45) return shade(moss, (n - 0.7) * 0.4);
          if (face >= 0) return shade(base, (hash2(face, vnt, 64) - 0.5) * 0.26);
          // a crack and some lichen
          if (Math.abs(x * 0.8 + y * 0.6 - 0.1 - w * 0.3) < 0.07) return shade(base, -0.38);
          if (n > 0.93) return mix(base, hex('#b8b48a'), 0.6);
          return shade(base, (n - 0.5) * 0.12);
        },
        { r: 4.5, zmax: 5, bakeShadow: true, outline: [30, 28, 24] },
      ),
    );
  }
  return out;
}

export function makeBushes(): StackSprite[] {
  const out: StackSprite[] = [];
  for (let vnt = 0; vnt < 3; vnt++) {
    // a few leafy clumps on twiggy stems; one kind in flower, one with berries
    const base = mix(hex('#3e6a2f'), hex('#5a7a30'), vnt / 2);
    const blobs: [number, number, number, number][] = [];
    for (let i = 0; i < 4 + vnt; i++) {
      const a = hash2(i, vnt, 81) * Math.PI * 2;
      const d = i === 0 ? 0 : 1 + hash2(i, vnt, 82) * 1.3;
      blobs.push([Math.cos(a) * d, Math.sin(a) * d, 1.3 + hash2(i, vnt, 83) * 1.2, 1.3 + hash2(i, vnt, 84) * 0.8]);
    }
    out.push(
      renderStack(
        (u, v, z) => {
          if (z < 0.8 && u * u + v * v < 0.5) return hex('#4a3a26');
          for (let i = 0; i < blobs.length; i++) {
            const [bu, bv, bz, r] = blobs[i];
            const n = (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 9, vnt + 80 + i) - 0.5) * 0.8;
            if ((u - bu) ** 2 + (v - bv) ** 2 + ((z - bz) * 1.3) ** 2 < (r + n) ** 2) {
              const m = hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 3, 4 + vnt);
              if (vnt === 2 && m > 0.9) return hex('#e9d36a');
              if (vnt === 1 && m > 0.93) return hex('#b8402f');
              if (z < bz - 0.5) return shade(base, -0.28);
              return shade(base, m > 0.78 ? 0.18 : m < 0.15 ? -0.2 : (hash2(i, vnt, 85) - 0.5) * 0.12);
            }
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
  const crate = (u: number, v: number, z: number, top: RGB | null): RGB | null => {
    if (Math.abs(u) > 2 || Math.abs(v) > 2 || z < 0 || z > 3.6) return null;
    const eu = Math.abs(u) > 1.5;
    const ev = Math.abs(v) > 1.5;
    if (z > 3.1) return top && !eu && !ev ? top : eu || ev ? WOOD : mod(u, 1.2) < 0.3 ? WOOD : shade(WOOD_L, 0.12);
    if ((eu && ev) || z < 0.5) return shade(WOOD, -0.1); // corner posts and skid
    const along = Math.abs(u) > Math.abs(v) ? v : u;
    if (Math.abs(Math.abs(along) - Math.abs(z - 1.8)) < 0.35) return WOOD; // cross brace
    if (mod(z, 1.1) < 0.25) return WOOD;
    return shade(WOOD_L, (hash2(Math.floor(along * 2), Math.floor(z), 1) - 0.5) * 0.14);
  };
  const crates: Shape = (u, v, z) => crate(u - 1.8, v + 1, z, null) ?? crate(u + 2.4, v - 1.6, z, OLIVE) ?? crate(u - 0.4, v - 0.2, z - 3.6, null);
  const barrels: Shape = (u, v, z) => {
    const cols: RGB[] = [RUST, hex('#3f6f8a'), OLIVE];
    let i = 0;
    for (const [bu, bv] of [
      [0, 0],
      [2.6, 0.8],
      [0.8, 2.6],
    ]) {
      const c = cols[i++];
      const d = Math.hypot(u - bu, v - bv);
      if (d < 1.25 && z < 3.4) {
        if (z > 3) return d < 0.3 ? BLACK : d > 0.95 ? shade(c, -0.3) : shade(c, -0.1);
        if (Math.abs(z - 1.1) < 0.25 || Math.abs(z - 2.2) < 0.25) return shade(c, -0.28);
        return i === 1 && z > 1.4 && z < 2 ? HAZ : c;
      }
    }
    // one on its side, leaking
    if (u > -4.4 && u < -1 && (v - 2) ** 2 + (z - 1.2) ** 2 < 1.5) return u < -4 ? shade(RUST, -0.3) : Math.abs(u + 2.7) < 0.25 ? shade(RUST, -0.28) : RUST;
    if (z < 0.4 && (u + 5.2) ** 2 + (v - 2.4) ** 2 < 1.6) return BLACK;
    return null;
  };
  const sandbags: Shape = (u, v, z) => {
    const d = Math.hypot(u, v);
    if (d < 3.4 || d > 5.6 || z > 2.7 || (u > 2 && Math.abs(v) < 2)) return null;
    const course = Math.floor(z / 0.9);
    const a = Math.atan2(v, u) * 3 + course * 0.5;
    if (mod(a, 1) < 0.16 || z - course * 0.9 < 0.2) return shade(SAND_BAG, -0.3);
    return shade(SAND_BAG, (hash2(Math.floor(a), course, 5) - 0.5) * 0.2);
  };
  return [crates, barrels, sandbags].map((s) => renderStack(s, { r: 6, zmax: 8, bakeShadow: true, outline: [28, 24, 18] }));
}

// ---------- Battle damage ----------

const SOOT = hex('#2b2723');
const ASH = hex('#5a544c');
const EMBER = hex('#d65c28');

export interface BuildingStates {
  damaged: V2BuildingArt; // holed and scorched; its fx are where fires burn
  ruin: V2BuildingArt; // burnt-out rubble; its fx are where smoke rises
}

const B_SEED: Record<BuildingKind, number> = { yard: 1, lab: 2, power: 4, barracks: 5, refinery: 6, radar: 7, factory: 8, tower: 9, silo: 10, helipad: 11, prism: 12, aa: 13, depot: 14, wall: 15, uplink: 16, navy: 17, derrick: 18, pillbox: 19 };

// A building badly hit, and what is left of it once it is destroyed.
export function makeBuildingStates(kind: BuildingKind, f: Faction): BuildingStates {
  const b = buildingShape(kind, f);
  const { shape, rx, ry, zmax } = b;
  const seed = B_SEED[kind] * 31 + 7;
  const rand = rng(seed * 977);
  // the height of the roof at (u, v)
  const topAt = (u: number, v: number) => {
    for (let z = zmax; z >= 0; z -= 0.5) if (shape(u, v, z)) return z;
    return 0;
  };
  // shell holes: a few through the roof (where fires burn) and a few in the
  // two walls that face the viewer
  const holes: { u: number; v: number; z: number; r: number }[] = [];
  const fires: V2BuildingArt['fx'] = [];
  for (let i = 0, t = 0; i < 3 && t < 40; t++) {
    const u = (rand() * 2 - 1) * rx * 0.7;
    const v = (rand() * 2 - 1) * ry * 0.7;
    const z = topAt(u, v);
    if (z < 4 || holes.some((h) => Math.hypot(h.u - u, h.v - v) < 7)) continue;
    const r = Math.min(3 + rand() * 2.5, rx * 0.35, ry * 0.35);
    holes.push({ u, v, z, r });
    fires.push({ x: u, y: v, z: z - r * 0.4 });
    i++;
  }
  for (let i = 0, t = 0; i < 2 && t < 40; t++) {
    const side = rand() < 0.5;
    const u = side ? rx - 0.5 : (rand() * 2 - 1) * rx * 0.7;
    const v = side ? (rand() * 2 - 1) * ry * 0.7 : ry - 0.5;
    const top = topAt(u - (side ? 1.5 : 0), v - (side ? 0 : 1.5));
    if (top < 8) continue;
    const z = 3 + rand() * (top - 7);
    holes.push({ u, v, z, r: 1.8 + rand() * 1.2 });
    i++;
  }
  const damaged: Shape = (u, v, z) => {
    const c = shape(u, v, z);
    if (!c) return null;
    let near = 1e9;
    for (const h of holes) {
      const d = Math.hypot(u - h.u, v - h.v, (z - h.z) * 1.1) - h.r;
      if (d < 0) return null;
      near = Math.min(near, d);
    }
    if (near < 1.4) return mix(c, SOOT, 0.8 - near * 0.2);
    const s = vnoise(u / 3.5 + 3, v / 3.5 + z / 6, seed);
    if (s > 0.6) return mix(c, SOOT, Math.min(0.75, (s - 0.6) * 3.5));
    if (hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 89, seed) > 0.985) return shade(c, -0.35); // pockmarks
    return c;
  };
  // the ruin: knocked down to a heap a few units high, with stumps of wall
  // left standing along the edges
  const capAt = (u: number, v: number) => {
    const base = 1.2 + vnoise(u / 5 + 1, v / 5 + 1, seed + 1) * 3.2;
    const edge = Math.min(rx - Math.abs(u), ry - Math.abs(v));
    if (edge < 2.2 && hash2(Math.floor(u / 3), Math.floor(v / 3), seed + 2) > 0.5) return Math.min(zmax * 0.5, 4 + hash2(Math.floor(u / 3), Math.floor(v / 3), seed + 3) * 9);
    return base;
  };
  const ruin: Shape = (u, v, z) => {
    if (z > capAt(u, v)) return null;
    const c = shape(u, v, z);
    const r = hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 101, seed);
    if (c) {
      if (r > 0.992) return EMBER;
      return shade(mix(c, SOOT, 0.35 + vnoise(u / 2, v / 2 + z, seed + 4) * 0.4), (r - 0.5) * 0.18);
    }
    if (Math.abs(u) > rx - 0.5 || Math.abs(v) > ry - 0.5) return null;
    const heap = 0.6 + vnoise(u / 2.4 + 5, v / 2.4 + 5, seed + 5) * 2.6;
    if (z > heap) return null;
    const pick = hash2(Math.floor(u / 1.5), Math.floor(v / 1.5) + Math.floor(z) * 37, seed + 6);
    const col = pick < 0.25 ? CONC : pick < 0.45 ? CONC_D : pick < 0.6 ? shade(BRICK, -0.2) : pick < 0.68 ? RUST : pick < 0.85 ? ASH : SOOT;
    return shade(col, (r - 0.5) * 0.2);
  };
  const smokes: V2BuildingArt['fx'] = [];
  for (let i = 0; i < 3; i++) {
    const u = (rand() * 2 - 1) * rx * 0.6;
    const v = (rand() * 2 - 1) * ry * 0.6;
    smokes.push({ x: u, y: v, z: capAt(u, v) });
  }
  const o = { r: 0, rx, ry, zmax, bakeShadow: true, step: 0.5, shadowAlpha: 0.32 };
  return {
    damaged: { spr: renderStack(damaged, o), rx, ry, fx: fires },
    ruin: { spr: renderStack(ruin, { ...o, zmax: Math.ceil(Math.min(zmax, Math.max(8, zmax * 0.5 + 1))), shadowAlpha: 0.22 }), rx, ry, fx: smokes },
  };
}

// ---------- Going up ----------

// How high each stage of a building going up stands, as a share of the height
// of its main body (the first is the bare footing). The finished building,
// with its masts and stacks, comes after.
export const BUILD_STAGES = [0, 0.25, 0.5, 0.75, 1];
const GIRDER = hex('#c98a2e');
const GIRDER_D = hex('#8f5e1f');
const SCAFFOLD = 6; // how far the steel frame runs ahead of the walls

// A building part way up: built as far as height h, with a fresh concrete
// deck where it is cut off (rebar showing) and a steel frame rising ahead
// of it over where the rest will stand. h = 0 is the footing: a slab over
// the building's footprint, marked out for the walls.
function partShape(shape: Shape, top: (u: number, v: number) => number, rx: number, ry: number, h: number): Shape {
  if (h <= 0)
    return (u, v, z) => {
      if (z > 1 || top(u, v) < 0) return null;
      if (z > 0.5) {
        // marked out: where the walls go (edges of what stands above), and a grid of rebar
        const e = top(u - 1, v) < 0 || top(u + 1, v) < 0 || top(u, v - 1) < 0 || top(u, v + 1) < 0;
        if (e) return mod(Math.floor((u + v) / 2), 2) ? HAZ : BLACK;
        if (mod(u, 3) < 0.45 || mod(v, 3) < 0.45) return RUST;
      }
      return g(z > 0.5 ? CONC_L : CONC_D, u, v, z, 0.08, 9);
    };
  return (u, v, z) => {
    if (z <= h) {
      const c = shape(u, v, z);
      if (!c) return null;
      if (z <= h - 0.7) return c;
      // the cut: a deck with the rebar showing through
      return mod(u, 3) < 0.45 || mod(v, 3) < 0.45 ? RUST : g(CONC_L, u, v, z, 0.08, 9);
    }
    if (z > h + SCAFFOLD || top(u, v) < z) return null;
    // the steel frame: columns on a grid and a ring of beams at the top
    const cu = mod(u + 0.5, 6) < 1;
    const cv = mod(v + 0.5, 6) < 1;
    const ring = z > h + SCAFFOLD - 0.9;
    if (cu && cv) return ring ? GIRDER : mod(z, 2) < 0.5 ? GIRDER_D : GIRDER;
    if (ring && (cu || cv)) return GIRDER;
    return null;
  };
}

/** The stages of a building going up (BUILD_STAGES), before it is finished. */
export function makeConstruction(kind: BuildingKind, f: Faction): StackSprite[] {
  const { shape, rx, ry, zmax } = buildingShape(kind, f);
  const o: StackOpts = { r: 0, rx, ry, zmax, step: 0.5 };
  const hm = columnMap(shape, o);
  // the top of each column of the finished building (-1: nothing there)
  const top = (u: number, v: number) => (Math.abs(u) > rx || Math.abs(v) > ry ? -1 : hm.at(u, v));
  // the height of the main body (what most of the roof reaches), which the
  // stages are shares of: masts, stacks and flagpoles go up last
  const tops: number[] = [];
  for (let u = -rx; u <= rx; u++) for (let v = -ry; v <= ry; v++) if (top(u, v) >= 0) tops.push(top(u, v));
  tops.sort((a, b) => a - b);
  const body = Math.max(4, tops[Math.floor(tops.length * 0.8)] ?? zmax);
  return BUILD_STAGES.map((k) => {
    const h = Math.round(k * body);
    return renderStack(partShape(shape, top, rx, ry, h), { r: 0, rx, ry, zmax: Math.min(zmax, h + SCAFFOLD) + 1, bakeShadow: true, step: 0.5, shadowAlpha: 0.32 });
  });
}

/** How long a building takes to go up, in seconds (the Foundry unfolding too). */
export function riseTime(kind: BuildingKind, rx: number, ry: number): number {
  return kind === 'yard' ? 2.6 : 1.4 + (rx + ry) / 25;
}
