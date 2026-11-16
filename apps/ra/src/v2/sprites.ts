// Isometric art for v2: units, buildings and props as shaded voxel shapes.
// Everything is modelled in world units (one unit is one pixel across the
// ground) down to half a unit, which is the finest the renderer samples.
import { RGB, hash2, hex, mix, rng, shade, vnoise } from '../gfx';
import { FACTIONS, Faction } from '../v1/sprites';
import { Shape, StackOpts, StackSprite, inBox, renderDirs, renderStack, toScreen } from './stack';
import { BUST, soldierBust } from './portrait';

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
      // glacis: the driver's hatch and vision block, spare links (or armour blocks)
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
function hauler(f: Faction, fill = 2): Shape {
  const ore = hex('#c09443');
  const oreL = hex('#f2d06a');
  return (u, v, z) => {
    const t = tracks(u, v, z, 11, 6, 2.2, 3);
    if (t) return t;
    const av = Math.abs(v);
    // exhaust stack behind the cab and an amber beacon on its roof
    if (cyl(u, v, 4, -3.2, 0.7) && z > 3 && z <= 11) return z > 10.3 ? BLACK : z > 9.6 ? STEEL : GUN_D;
    if (cyl(u, v, 7.6, 0, 0.75) && z > 9 && z <= 10.2) return HAZ;
    // the scoop across the front, with teeth
    if (u > 10.6 && u <= 12.4 && av < 5 && z < 3.4) {
      if (z < 1.2 && u > 11.6) return mod(Math.floor(av * 1.4), 2) ? STEEL : GUN_D;
      return z > 2.7 ? HAZ : g(METAL_D, u, v, z);
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
    // the ore bed: ribbed steel walls with a hazard lip and a heap of ore
    if (u < -10.5) return null;
    const wall = av > 3.4 || u < -9.6 || u > 2.8;
    if (wall && z <= 6.6) {
      if (z > 6) return hazard(u, v);
      const along = av > 3.4 ? u : v;
      if (z < 2.2) return f.dark;
      return g(mod(along, 3) < 0.6 ? METAL_D : z < 3 ? shade(METAL, -0.12) : METAL, u, v, z, 0.08);
    }
    // the floor of the bed, ribbed across, seen when it is empty
    if (z <= 2.6) return mod(u, 2.4) < 0.5 ? METAL_D : g(shade(METAL, -0.22), u, v, z, 0.06);
    if (!fill) return null;
    const lumpy = (hash2(Math.floor(u * 1.2), Math.floor(v * 1.2), 3) - 0.5) * 1.2;
    // partly full: a low heap slumped to the back of the bed
    const heap = fill === 2 ? 5.6 + 2.2 * Math.cos((u + 3.5) / 7) * Math.cos(v / 4) + lumpy : 3.4 + 2.4 * Math.max(0, Math.cos((u + 6) / 5)) * Math.cos(v / 4.5) + lumpy * 0.8;
    if (z <= heap) {
      const n = hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 77, 9);
      return n > 0.9 ? oreL : shade(ore, (n - 0.5) * 0.55);
    }
    return null;
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

function soldier(f: Faction, rocket: boolean, frame: number): Shape {
  const body = rocket ? mix(f.main, OLIVE, 0.4) : f.main;
  const step = frame === 0 ? 0 : frame === 1 ? 0.9 : -0.9;
  const helmet = rocket ? OLIVE_D : shade(f.dark, 0.05);
  return (u, v, z) => {
    const av = Math.abs(v);
    // legs, with boots and knee pads
    if (z < 3.2) {
      const legU = v > 0 ? step : -step;
      if (Math.abs(u - legU * (z < 1.6 ? 1 : 0.5)) < 0.6 && av > 0.2 && av < 1.3) return z < 0.9 ? BLACK : Math.abs(z - 1.9) < 0.3 ? shade(f.dark, 0.15) : shade(f.dark, -0.15);
      return null;
    }
    // weapons first, so they aren't hidden in the body
    if (rocket) {
      if (u > -2.8 && u < 3.2 && (v - 1.5) ** 2 + (z - 7) ** 2 < 0.55) return u > 2.5 ? RED : u < -2.2 ? BLACK : Math.abs(u) < 0.3 ? OLIVE_D : OLIVE;
    } else {
      if (u > 0.4 && u < 4 && Math.abs(v - 1) < 0.45 && Math.abs(z - 5.2) < 0.45) return u > 3 ? BLACK : u < 1.2 ? WOOD : GUN_D;
    }
    // pack on the back
    if (u < -0.8 && u > -1.9 && av < 1.1 && z > 3.8 && z < 6) return rocket ? OLIVE_D : z > 5.4 ? SAND_BAG : OLIVE;
    // torso with a belt and webbing
    if (z < 6.3 && Math.abs(u) < 0.9 && av < 1.4) {
      if (z < 3.8) return BLACK;
      if (Math.abs(av - 0.7) < 0.25 && z > 4.4) return shade(body, -0.25);
      return z > 5.7 ? shade(body, 0.12) : body;
    }
    // arms: the sleeve, then a hand
    if (z < 6 && z > 4 && Math.abs(u - 0.4 - (frame ? step * 0.4 * Math.sign(v) : 0)) < 0.6 && av >= 1.4 && av < 2) return z < 4.6 ? SKIN : body;
    // head: a helmet with a band over the face
    if (z >= 6.3 && z < 8.5 && u * u + v * v < 1.15) {
      if (z > 7.4) return z < 7.8 ? shade(helmet, -0.25) : helmet;
      return u < -0.3 ? helmet : SKIN;
    }
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

export interface V2FactionArt {
  mcv: StackSprite[];
  lightTank: StackSprite[];
  lightTurret: StackSprite[];
  heavyTank: StackSprite[];
  heavyTurret: StackSprite[];
  buggy: StackSprite[];
  hauler: StackSprite[]; // empty
  haulerLoad: StackSprite[][]; // [fill][dir]: empty, partly full, full
  artillery: StackSprite[];
  boat: StackSprite[];
  heli: StackSprite[];
  towerGun: StackSprite[];
  infantry: StackSprite[][]; // [frame][dir]
  rocket: StackSprite[][];
}

// Each set of headings is keyed fa:<faction>:<name>[:<frame>], so a worker can
// make the same one (see art-worker.ts and factionSet below).
export function makeFactionArt(f: Faction): V2FactionArt {
  const fi = FACTIONS.indexOf(f);
  const k = (name: string) => (fi >= 0 ? `fa:${fi}:${name}` : undefined);
  const haulerLoad = [0, 1, 2].map((fill) => renderDirs(hauler(f, fill), DIRS, { r: 13, zmax: 11, bakeShadow: true }, k(`haulerLoad:${fill}`)));
  const inf = (rocket: boolean) =>
    [0, 1, 2].map((fr) => renderDirs(soldier(f, rocket, fr), 16, { r: 4, zmax: 9, step: 0.5, bakeShadow: true }, k(`${rocket ? 'rocket' : 'infantry'}:${fr}`)));
  return {
    mcv: renderDirs(foundryVehicle(f), DIRS, { r: 17.5, zmax: 17, bakeShadow: true }, k('mcv')),
    lightTank: renderDirs(tankHull(f, 16, 12, false), DIRS, { r: 10.5, zmax: 7, bakeShadow: true }, k('lightTank')),
    lightTurret: renderDirs(turretShape(f, 3.6, 5, 1, 11), DIRS, { r: 11.5, zmax: 14 }, k('lightTurret')),
    heavyTank: renderDirs(tankHull(f, 20, 15, true), DIRS, { r: 13, zmax: 8, bakeShadow: true }, k('heavyTank')),
    heavyTurret: renderDirs(turretShape(f, 4.8, 6, 2, 13), DIRS, { r: 13.5, zmax: 16 }, k('heavyTurret')),
    buggy: renderDirs(buggy(f), DIRS, { r: 8, zmax: 10, bakeShadow: true }, k('buggy')),
    hauler: haulerLoad[0],
    haulerLoad,
    artillery: renderDirs(artillery(f), DIRS, { r: 13.5, zmax: 13, bakeShadow: true }, k('artillery')),
    boat: renderDirs(boat(f), DIRS, { r: 15.5, zmax: 13, bakeShadow: true, shadowAlpha: 0.2 }, k('boat')),
    heli: renderDirs(heli(f), DIRS, { r: 15.5, zmax: 10 }, k('heli')),
    towerGun: renderDirs(turretShape(f, 4, 0, 2, 11), DIRS, { r: 11.5, zmax: 9 }, k('towerGun')),
    infantry: inf(false),
    rocket: inf(true),
  };
}

/** The set of headings a key from makeFactionArt names, in a given set of art. */
export function factionSet(art: V2FactionArt, key: string): StackSprite[] | null {
  const [, , name, sub] = key.split(':');
  const v = (art as unknown as Record<string, StackSprite[] | StackSprite[][]>)[name];
  if (!v) return null;
  return (sub !== undefined ? (v as StackSprite[][])[Number(sub)] : (v as StackSprite[])) ?? null;
}

// ---------- Buildings ----------

export type BuildingKind = 'yard' | 'lab' | 'hq' | 'power' | 'barracks' | 'refinery' | 'radar' | 'factory' | 'tower' | 'silo' | 'helipad';

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
  band?: RGB; // a stripe of the faction's colour under the coping
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

function buildingShape(kind: BuildingKind, f: Faction): { shape: Shape; rx: number; ry: number; zmax: number; fx: V2BuildingArt['fx'] } {
  const roofC = mix(f.main, f.light, 0.35);
  switch (kind) {
    case 'yard': {
      // The Foundry: a works hall with a big door, a tower crane over the
      // apron and stacks of parts waiting to be put together.
      const shape: Shape = (u, v, z) => {
        // tower crane: lattice mast, cab, boom with a trolley, counterweight, cable and hook
        if (z < 29) {
          const m = lattice(u, v, z, 13, -13, 1.6, HAZ);
          if (m) return m;
        }
        if (inBox(u, v, z, 11, 15.5, -15, -11, 26, 29.5)) {
          if (z > 29) return roofC;
          if (u > 15 && z > 27) return Math.abs(v + 13) < 0.3 ? f.dark : z > 28.4 ? GLASS_L : GLASS;
          if (v > -11.6 && z > 27.2) return u > 13.4 ? GLASS : f.main;
          return g(f.main, u, v, z);
        }
        if (Math.abs(v + 13) < 0.9 && u > 3 && u < 24 && z > 29.5 && z < 31.2) {
          if (z > 30.7 || z < 30) return mod(Math.floor(u), 2) ? HAZ : shade(HAZ, -0.2);
          return mod(u, 2.5) < 0.6 || Math.abs(v + 13) > 0.5 ? GUN_D : null;
        }
        if (inBox(u, v, z, 3, 7, -14.6, -11.4, 26.8, 29.6)) return z > 29 ? CONC_L : mod(Math.floor(u * 1.2), 2) ? CONC_D : shade(CONC_D, -0.15);
        if (Math.abs(u - 13) < 0.35 && Math.abs(v + 13) < 0.35 && z >= 31.2 && z < 33.6) return z > 33 ? RED : GUN_D;
        if (inBox(u, v, z, 19.8, 22.2, -13.9, -12.1, 28.6, 29.6)) return GUN; // trolley
        if (Math.abs(u - 21) < 0.5 && Math.abs(v + 13) < 0.5 && z > 17 && z < 29) return GUN_D;
        if (inBox(u, v, z, 20, 22, -14, -12, 15.4, 17)) return z > 16.4 ? hazard(u, v) : HAZ;
        if (Math.abs(u - 21) < 0.4 && Math.abs(v + 13) < 0.7 && z > 13.8 && z <= 15.4) return GUN_D; // hook
        // roof gear on the hall
        if (z > 15) {
          const ac = acUnit(u, v, z, -17, 0.4, 15);
          if (ac) return ac;
          for (const [cu, cv] of [[-17, -15], [2, -15]]) {
            if (cyl(u, v, cu, cv, 1.5) && z <= 18.6) return z > 18 ? GUN_D : z > 17.2 ? STEEL : METAL_D;
          }
          if (cyl(u, v, 2.6, 0.6, 0.8) && z <= 21) return z > 20.4 ? BLACK : mod(Math.floor(z), 3) === 0 ? STEEL : RUST; // flue
          // ridge skylight
          if (Math.abs(u + 7) < 9.5 && Math.abs(v + 7.5) < 5 && z <= 16.6 + (5 - Math.abs(v + 7.5)) * 0.25) {
            if (Math.abs(u + 7) > 9 || Math.abs(v + 7.5) > 4.5 || mod(u + 7, 3.2) < 0.45 || Math.abs(v + 7.5) < 0.3) return STEEL;
            return hash2(Math.floor((u + 7) / 3.2), v > -7.5 ? 1 : 0, 5) > 0.75 ? GLASS : GLASS_D;
          }
          return null;
        }
        // office lean-to on the side of the hall
        if (inBox(u, v, z, 6, 10.5, -17, -5, 0, 8.5)) {
          if (z > 7.9) return roofSkin(u, v, z, 6, 10.5, -17, -5);
          if (v > -5.6 && Math.abs(u - 8.2) < 1.1 && z < 5.4) return z > 4.4 ? GLASS_D : shade(f.dark, 0.1); // door
          return wallSkin(u, v, z, 10.5, -5, 0, 8.5, 22, { win: [2, 7], pitch: 4 });
        }
        if (inBox(u, v, z, 6.9, 9.6, -5, -3.4, 0, 0.8)) return CONC_L; // step
        // works hall
        if (inBox(u, v, z, -21, 6, -19, 4, 0, 15)) {
          const door = rollerDoor(u, v, z, -7, 7.5, 4, 10.5);
          if (door) return door;
          if (z > 14.4) return roofSkin(u, v, z, -21, 6, -19, 4);
          if (v > 3.4 && z > 11 && z < 12.6 && Math.abs(u + 7) < 3) return mod(Math.floor(u * 1.4), 2) ? WHITE : f.dark; // sign
          if (v > 3.4 && Math.abs(u - 3.2) < 1 && z < 5) return z > 4 ? GLASS_D : GUN; // side door
          if (v > 3.4 && Math.abs(u - 3.2) < 1.2 && z > 5.4 && z < 6.4) return LAMP;
          if (u > 5.4 && Math.abs(v + 1.4) < 0.45 && z > 1) return METAL_D; // downpipe
          return wallSkin(u, v, z, 6, 4, 0, 15, 21, { win: [8.6, 13.2], band: f.main });
        }
        // on the apron: parts, a pallet of plate, crates, drums and gas bottles
        if (inBox(u, v, z, 10, 16, 7, 13, 0, 4)) return z > 3.4 ? (mod(u, 3) < 0.4 || mod(v, 3) < 0.4 ? f.dark : g(shade(f.main, 0.1), u, v, z)) : mod(Math.floor(z * 1.4), 2) ? f.dark : shade(f.dark, 0.15);
        if (inBox(u, v, z, 11, 15, 8, 12, 4, 7)) {
          if (z > 6.4) return (u - 13) ** 2 + (v - 10) ** 2 < 1.6 ? GUN_D : STEEL;
          return mod(Math.floor(u + v), 2) ? GUN : GUN_L;
        }
        if (inBox(u, v, z, 17, 22.4, 8.6, 13.4, 0, 3.2)) {
          if (z < 0.7) return mod(Math.floor(u * 0.9), 2) ? WOOD : null;
          return z > 2.7 ? (mod(u, 2.7) < 0.4 ? shade(WOOD, -0.3) : WOOD_L) : Math.abs(mod(u, 2.7) - 1.3) < 0.3 ? shade(WOOD, -0.3) : WOOD;
        }
        if (inBox(u, v, z, 18, 21, 9.6, 12.4, 3.2, 5.4)) return z > 4.9 ? shade(OLIVE, 0.15) : Math.abs(z - 4.2) < 0.3 ? WHITE : OLIVE;
        const dr = drums(u, v, z, [[-19, 8, RUST], [-16.4, 8.6, f.main], [-18, 10.6, hex('#3f6f8a')], [-15.6, 11.4, RUST]]);
        if (dr) return dr;
        for (const bv of [16, 17.6, 19.2]) if (cyl(u, v, -19.4, bv, 0.7) && z < 5.4) return z > 4.6 ? GUN_D : bv === 17.6 ? hex('#3f8a5a') : hex('#b9462f');
        if (inBox(u, v, z, 1.4, 9, 15.6, 16.4, 0, 2.4) || inBox(u, v, z, 1.4, 9, 17.6, 18.4, 0, 1.6)) return mod(u, 2.4) < 0.4 ? RUST : GUN_L; // girders
        // floodlight mast at the corner of the apron
        if (Math.abs(u - 21.6) < 0.4 && Math.abs(v - 19.6) < 0.4 && z < 15) return GUN_D;
        if (inBox(u, v, z, 20.4, 22.8, 18.6, 20.6, 15, 16.4)) return v > 20 || u > 22.2 ? LAMP : GUN;
        // the apron: concrete with painted bays and a hazard edge
        if (Math.abs(u) <= 24 && Math.abs(v) <= 22 && z < 1) {
          if (Math.abs(u) > 23 || Math.abs(v) > 21) return hazard(u, v);
          if (v > 4 && Math.abs(Math.abs(u + 7) - 8.4) < 0.35 && mod(v, 3) < 2) return WHITE; // lane to the door
          if (mod(u, 8) < 0.4 || mod(v, 8) < 0.4) return CONC_D;
          return g(hash2(Math.floor(u * 0.7), Math.floor(v * 0.7), 8) > 0.93 ? shade(CONC, -0.14) : CONC, u, v, z, 0.07);
        }
        return null;
      };
      return { shape, rx: 24, ry: 22, zmax: 34, fx: [{ x: 13, y: -13, z: 33.6 }, { x: 21, y: -13, z: 17 }] };
    }
    case 'lab': {
      // The Tech lab: a domed research block with antenna masts, a walkway
      // and a glowing test cell beside it.
      const glow = hex('#9ff0ff');
      const shape: Shape = (u, v, z) => {
        // dome in ribbed panels with an observation slot and a ring at its foot
        const d = Math.hypot(u + 4, v + 3);
        if (d < 11.6 && z >= 10 && z < 11) return mod(Math.atan2(v + 3, u + 4) * 6, 2) < 1 ? METAL_D : GUN;
        if (d < 11 && z >= 10 && z <= 10 + Math.sqrt(Math.max(0, 121 - d * d)) * 0.8) {
          if (Math.abs(v + 3) < 1.3 && z > 13 && u > -6) return Math.abs(v + 3) > 0.8 ? GUN : u > 2 ? glow : GLASS_D;
          const a = mod(Math.atan2(v + 3, u + 4) * 3.2, 1);
          if (a < 0.1) return METAL_D;
          if (Math.abs(z - 14.5) < 0.3 || Math.abs(z - 17.2) < 0.25) return METAL_D;
          return g(z > 17.4 ? STEEL : METAL, u, v, z, 0.05);
        }
        if (d < 1.2 && z <= 20.6) return z > 20 ? RED : GUN;
        // block under the dome
        if (inBox(u, v, z, -17, 9, -16, 10, 0, 10)) {
          if (z > 9.4) return roofSkin(u, v, z, -17, 9, -16, 10);
          if (v > 9.4 && Math.abs(u + 4) < 2.2 && z < 6.4) return z > 5.6 ? f.light : Math.abs(u + 4) < 0.25 ? f.dark : z > 2.4 ? GLASS : GLASS_D; // glass doors
          return wallSkin(u, v, z, 9, 10, 0, 10, 31, { win: [2.2, 7.2], band: f.main });
        }
        // entrance canopy on posts, and steps
        if (inBox(u, v, z, -7, -1, 10, 13, 6.6, 7.4)) return z > 7 ? f.light : f.main;
        if ((Math.abs(u + 6.4) < 0.4 || Math.abs(u + 1.6) < 0.4) && Math.abs(v - 12.4) < 0.4 && z < 6.6) return STEEL;
        if (inBox(u, v, z, -7, -1, 10, 12, 0, 1.2)) return v > 11 && z > 0.6 ? null : CONC_L;
        const ac = acUnit(u, v, z, 5.5, 6.5, 10) ?? acUnit(u, v, z, -14, 7, 10);
        if (ac) return ac;
        // antenna masts with cross arms, a small dish on one
        for (const [au, av] of [
          [12, -12],
          [12, 2],
        ]) {
          if (Math.abs(u - au) < 0.5 && Math.abs(v - av) < 0.5 && z < 24) return z > 23 ? RED : mod(Math.floor(z / 3), 2) ? WHITE : RED;
          if (Math.abs(u - au) < 0.4 && Math.abs(v - av) < 2 && (Math.abs(z - 20) < 0.35 || Math.abs(z - 17) < 0.35)) return GUN_D;
          if (inBox(u, v, z, au - 1.5, au + 1.5, av - 1.5, av + 1.5, 0, 1.4)) return CONC_D;
        }
        if ((u - 12.8) ** 2 + (v + 12) ** 2 + (z - 12) ** 2 < 4 && u > 12.6) return (u - 12.8) ** 2 + (v + 12) ** 2 + (z - 12) ** 2 < 0.6 ? GUN_D : WHITE;
        // test cell: a glass cylinder with something glowing in it, pipes back to the block
        if (cyl(u, v, 14, 10, 4.2) && z < 9.4) {
          if (z < 1.6 || z > 8.2) return z > 8.9 ? (cyl(u, v, 14, 10, 1.4) ? GUN_D : f.main) : g(f.dark, u, v, z);
          if (!cyl(u, v, 14, 10, 3.6)) return mod(Math.atan2(v - 10, u - 14) * 2.5, 2) < 0.35 ? STEEL : z > 6.4 ? GLASS_L : GLASS;
          return cyl(u, v, 14, 10, 1.8) ? (mod(Math.floor(z), 2) ? glow : WHITE) : GLASS;
        }
        if (Math.abs(v - 8) < 0.6 && u > 9 && u < 11 && Math.abs(z - 4) < 0.6) return COPPER;
        if (Math.abs(v - 8) < 0.6 && u > 9 && u < 11 && Math.abs(z - 6) < 0.6) return STEEL;
        // coolant tanks along the side wall
        for (const cv of [-12, -8.4]) if (cyl(u, v, 11.4, cv, 1.5) && z < 6 + Math.sqrt(Math.max(0, 2.25 - (u - 11.4) ** 2 - (v - cv) ** 2)) * 0.6) return Math.abs(z - 3.4) < 0.5 ? f.main : WHITE;
        // the plinth, with a painted walkway to the door
        if (inBox(u, v, z, -20, 20, -16, 16, 0, 0.6)) {
          if (Math.abs(u) > 19.2 || Math.abs(v) > 15.2) return CONC_L;
          if (v > 12 && Math.abs(Math.abs(u + 4) - 3) < 0.3) return HAZ;
          return mod(u, 6) < 0.4 || mod(v, 6) < 0.4 ? shade(CONC_D, -0.12) : g(CONC_D, u, v, z, 0.08);
        }
        return null;
      };
      return { shape, rx: 20, ry: 16, zmax: 25, fx: [{ x: 14, y: 10, z: 5 }] };
    }
    case 'hq': {
      const shape: Shape = (u, v, z) => {
        // antenna mast with stays and cross arms, and a dish on the tower roof
        if (Math.abs(u - 4) < 0.5 && Math.abs(v + 6) < 0.5 && z < 36) return z > 35 ? RED : mod(Math.floor(z / 2.5), 2) ? WHITE : RED;
        for (const az of [27, 30, 33]) if (Math.abs(u - 4) < (az === 30 ? 2.4 : 1.4) && Math.abs(v + 6) < 0.4 && Math.abs(z - az) < 0.35) return GUN_D;
        if (inBox(u, v, z, 2.6, 5.4, -7.4, -4.6, 22, 23)) return GUN;
        const dd = Math.hypot(u + 9, v + 9);
        if (dd < 3.4 && z > 22 && z < 25.6) {
          if (dd < 0.5) return z > 25 ? RED : GUN_D;
          if (Math.abs(z - (23 + dd * 0.7)) < 0.45) return dd > 2.9 ? METAL_D : WHITE;
        }
        // tower block with a glazed control room round the top
        if (inBox(u, v, z, -14, 8, -14, 0, 0, 22)) {
          if (z > 21.4) {
            const e = Math.min(u + 14, 8 - u, v + 14, -v);
            return e < 1 ? f.light : g(roofC, u, v, z);
          }
          if (z > 16.4 && z < 19.6 && (u > 7.4 || v > -0.6)) {
            const along = u > 7.4 ? v : u;
            return mod(along, 3) < 0.4 ? f.dark : z > 18.6 ? GLASS_L : GLASS;
          }
          if (z > 19.6 || (z > 15.6 && z <= 16.4)) return g(f.dark, u, v, z);
          return wallSkin(u, v, z, 8, 0, 12, 22, 4, { win: [0.4, 4.6], body: CONC_L, pitch: 4.4 });
        }
        // main block
        if (inBox(u, v, z, -20, 20, -16, 16, 0, 12)) {
          // entrance on the +y face: double doors under a lit sign
          if (v > 15.4 && Math.abs(u - 4) < 4 && z < 7.4) {
            if (z > 6.3) return mod(Math.floor(u * 1.3), 2) ? WHITE : f.main;
            if (Math.abs(u - 4) > 3.4) return CONC_L;
            return Math.abs(u - 4) < 0.3 || z < 0.8 ? GUN_D : z > 3 ? GLASS : GLASS_D;
          }
          if (z > 11.4) return roofSkin(u, v, z, -20, 20, -16, 16);
          if (u > 19.4 && Math.abs(v - 9) < 1.2 && z < 5) return z > 4 ? GLASS_D : GUN; // side door
          return wallSkin(u, v, z, 20, 16, 0, 12, 3, { win: [1.6, 9.4], band: f.main });
        }
        // awning over the door on posts, steps, planters and a flag
        if (inBox(u, v, z, -0.6, 8.6, 16, 19.4, 7.4, 8.3)) return z > 7.9 ? f.light : mod(Math.floor(u * 1.2), 2) ? f.main : f.dark;
        if ((Math.abs(u) < 0.4 || Math.abs(u - 8) < 0.4) && Math.abs(v - 18.8) < 0.4 && z < 7.4) return STEEL;
        if (inBox(u, v, z, 0.4, 7.6, 16, 18.4, 0, 1.2)) return v > 17.2 && z > 0.6 ? null : CONC_L;
        for (const pu of [-3, 11]) if (inBox(u, v, z, pu - 1.6, pu + 1.6, 16.4, 18.8, 0, 2.6)) return z > 1.4 ? (hash2(Math.floor(u * 2), Math.floor(v * 2), 6) > 0.5 ? hex('#3e7a35') : hex('#2f5a2c')) : CONC_D;
        if (Math.abs(u + 16) < 0.4 && Math.abs(v - 18) < 0.4 && z < 17) return STEEL;
        if (Math.abs(v - 18) < 0.35 && u > -15.6 && u < -11.4 && z > 13.4 && z < 16.6) return z > 15.4 ? f.light : z > 14.5 ? WHITE : f.main;
        // roof clutter: air conditioning, a stair head, vents, a water tank, a helipad H
        if (z > 12) {
          const ac = acUnit(u, v, z, 12.5, 6.5, 12) ?? acUnit(u, v, z, 12.5, 11, 12) ?? acUnit(u, v, z, -15, 9, 12);
          if (ac) return ac;
          if (inBox(u, v, z, 12, 17, -11, -6, 12, 15.4)) {
            if (z > 14.9) return CONC_L;
            return v > -6.6 && Math.abs(u - 14.5) < 1 && z < 14.6 ? GUN : g(CONC, u, v, z);
          }
          if (cyl(u, v, -6, 8, 2.6) && z <= 16.2 + Math.sqrt(Math.max(0, 6.8 - (u + 6) ** 2 - (v - 8) ** 2)) * 0.5) return z < 13 ? GUN_D : Math.abs(z - 14.6) < 0.3 ? METAL_D : g(z > 16.2 ? STEEL : METAL, u, v, z);
          for (const [cu, cv] of [[2, 4], [5, 4], [2, 12]]) if (cyl(u, v, cu, cv, 0.8) && z <= 13.8) return z > 13.2 ? GUN_D : STEEL;
          if (z <= 12.5 && Math.abs(v - 8) < 0.5 && u > 1 && u < 11) return COPPER; // pipe run
        }
        return null;
      };
      return { shape, rx: 21, ry: 20, zmax: 37, fx: [{ x: 4, y: -6, z: 36 }] };
    }
    case 'power': {
      // The power plant: two cooling towers, a turbine hall and a transformer yard.
      const tower = (u: number, v: number, z: number, cu: number, cv: number) => {
        const d = Math.hypot(u - cu, v - cv);
        const r = 8 - 2.2 * Math.sin((Math.PI * Math.min(z, 26)) / 30);
        if (z > 26 || d > r) return null;
        if (z > 25.4 || d > r - 1.4) {
          if (z > 25.4 && d < r - 1.4) return null;
          const a = Math.atan2(v - cv, u - cu);
          let c = CONC_L;
          if (z > 25) c = shade(CONC_L, 0.12);
          else if (z > 18 && z < 21) c = mod(a * 5, 2) < 1 || z > 20.3 || z < 18.7 ? f.main : f.light;
          else if (z < 3.4) c = mod(a * 9, 2) < 1.1 ? CONC_D : BLACK; // legs round the air inlet
          else if (mod(a * 7, 1) < 0.12 || Math.abs(mod(z, 5.6) - 2.8) < 0.22) c = shade(CONC_L, -0.1); // shuttering lines
          else if (hash2(Math.floor(a * 9), 3, cu) > 0.7 && z > 21 + hash2(Math.floor(a * 9), 4, cu) * 3) c = shade(CONC_L, -0.14); // stains under the rim
          // ladder with hoops up the side facing the camera
          if (Math.abs(a - 0.9) < 0.11 && z > 3 && d > r - 0.7) c = mod(Math.floor(z * 1.5), 2) ? GUN_D : GUN_L;
          return g(c, u, v, z, 0.05);
        }
        return z > 22 ? hex('#30302c') : null;
      };
      const shape: Shape = (u, v, z) => {
        const t = tower(u, v, z, -7, -5) ?? tower(u, v, z, 10, -5);
        if (t) return t;
        // turbine hall with a ribbed roof and vents
        if (inBox(u, v, z, -18, 18, 3, 13, 0, 9)) {
          if (v > 12.4 && z < 6.4 && mod(u + 40, 7) < 3.2) {
            const a = mod(u + 40, 7);
            return z > 5.6 ? hazard(u, 0) : a < 0.4 || a > 2.8 ? GUN_D : mod(Math.floor(z * 1.5), 2) ? METAL_D : METAL;
          }
          if (z > 8.4) {
            const e = Math.min(u + 18, 18 - u, v - 3, 13 - v);
            if (e < 0.9) return CONC_L;
            if (Math.abs(u) < 3) return g(f.main, u, v, z);
            return mod(u, 2.4) < 0.5 ? METAL_D : METAL;
          }
          return wallSkin(u, v, z, 18, 13, 0, 9, 41, { band: f.main, win: [5.4, 8], pitch: 7 });
        }
        for (const cu of [-13, -9, 9, 13]) if (cyl(u, v, cu, 8, 1.1) && z > 9 && z <= 11.2) return z > 10.6 ? GUN_D : STEEL;
        // steam pipes from the towers down to the hall, lagged and banded
        for (const cu of [-7, 10]) {
          if (Math.abs(u - cu) < 1 && v > -1 && v < 3.4 && Math.abs(z - 7) < 1) return mod(Math.floor(v * 1.5), 3) === 0 ? METAL_D : STEEL;
          if (Math.abs(u - cu) < 1 && Math.abs(v - 2.6) < 1 && z > 7 && z < 9.6) return STEEL;
        }
        if (Math.abs(v + 5) < 0.9 && u > 0.4 && u < 2.6 && Math.abs(z - 6) < 0.9) return COPPER;
        // transformer yard: finned transformers, insulators, a fence
        for (const cu of [14.5, 9.5]) {
          if (inBox(u, v, z, cu - 2, cu + 2, 14, 17, 0, 4.6)) return z > 4 ? GUN_D : mod(Math.floor(u * 2), 2) ? METAL : METAL_D;
          for (const du of [-1, 1]) if (cyl(u, v, cu + du, 15.5, 0.5) && z > 4.6 && z <= 7) return mod(Math.floor(z * 2), 2) ? WHITE : hex('#8a5a3a');
        }
        if (z > 6.6 && z < 7.2 && Math.abs(v - 15.5) < 0.3 && u > 8.5 && u < 15.5) return GUN_D; // busbar
        if (inBox(u, v, z, 6, 18.6, 13.4, 17.6, 0, 3.2) && (u > 18 || v > 17 || u < 6.6) && (z > 2.8 || mod(u + v, 2) < 0.4)) return STEEL;
        if (inBox(u, v, z, -17.4, -14.6, 13.6, 16.4, 0, 2.6)) return z > 2 ? hazard(u, v) : HAZ; // a warning-striped cabinet
        const dr = drums(u, v, z, [[-11, 15, RUST], [-8.6, 15.4, hex('#3f6f8a')]]);
        if (dr) return dr;
        return null;
      };
      return { shape, rx: 19, ry: 17, zmax: 27, fx: [{ x: -7, y: -5, z: 26 }, { x: 10, y: -5, z: 26 }] };
    }
    case 'barracks': {
      // A corrugated hut with a brick end wall, a chimney, sandbags and kit outside.
      const R = 9;
      const skinC = mix(f.main, CONC, 0.35);
      const shape: Shape = (u, v, z) => {
        if (Math.abs(u) <= 14 && v * v + z * z <= R * R) {
          if (u > 13.4) {
            // end wall with a door, a window and a lamp over the door
            if (Math.abs(v) < 2.4 && z < 6.2) return z > 5.5 ? hazard(v, 0) : Math.abs(v) > 1.9 ? CONC_L : Math.abs(v) < 0.2 ? GUN_D : z > 3.4 && z < 4.8 ? GLASS_D : shade(OLIVE, -0.1);
            if (Math.abs(v) < 0.6 && z > 6.4 && z < 7.3) return LAMP;
            if (Math.abs(Math.abs(v) - 5) < 1.4 && z > 2.6 && z < 5.2) return Math.abs(Math.abs(v) - 5) > 1 || z > 4.8 || z < 3 ? CONC_L : v > 0 ? WIN_LIT : WIN_B;
            return mod(z, 1.4) < 0.3 || mod(v + (Math.floor(z / 1.4) % 2) * 1.2, 2.4) < 0.3 ? shade(BRICK, -0.25) : g(BRICK, u, v, z, 0.1);
          }
          const a = Math.atan2(z, v);
          // skylights along the crown, a painted number, corrugations
          if (Math.abs(a - Math.PI / 2) < 0.2 && mod(u + 14, 7) > 2 && mod(u + 14, 7) < 5) return mod(u + 14, 7) < 2.4 || mod(u + 14, 7) > 4.6 ? STEEL : GLASS_D;
          if (v > 0 && z > 3 && z < 6 && u > -2 && u < 3) return mod(Math.floor(u * 1.4) + Math.floor(z), 2) ? WHITE : skinC;
          const rib = mod(u + 40, 2) < 0.6;
          if (z < 1.2) return CONC_D;
          return g(rib ? shade(skinC, -0.2) : mod(u + 40, 2) < 1.1 ? shade(skinC, 0.1) : skinC, u, v, z, 0.06);
        }
        // stove pipe with a cowl
        if (cyl(u, v, -8, -3, 0.8) && z <= 13) return z > 12.2 ? BLACK : z > 11.4 ? STEEL : RUST;
        // sandbags along the front in courses, with a gap for the path
        if (v > 10 && v < 12.2 && u > -12 && u < 8 && z < 2.6 && !(u > -3.4 && u < -0.6)) {
          const course = Math.floor(z / 0.9);
          const bag = mod(u + course * 1.1, 2.2);
          return bag < 0.35 ? shade(SAND_BAG, -0.3) : shade(SAND_BAG, (hash2(Math.floor((u + course * 1.1) / 2.2), course, 5) - 0.5) * 0.2 + (z - course * 0.9 > 0.5 ? 0.06 : -0.06));
        }
        // ammunition boxes, a water bowser and a rifle rack
        if (inBox(u, v, z, -13, -9.4, 9.6, 11.6, 0, 2) || inBox(u, v, z, -12.4, -10, 9.8, 11.4, 2, 3.6)) return Math.abs(mod(z, 2) - 1) < 0.25 ? HAZ : z > 3.2 || (z > 1.6 && z < 2) ? shade(OLIVE, 0.15) : OLIVE;
        if ((u - 11) ** 2 / 6 + (z - 2.6) ** 2 / 2.4 < 1 && Math.abs(v - 10.6) < 1.4) return Math.abs(u - 11) < 0.3 ? OLIVE_D : z > 3.4 ? shade(OLIVE, 0.15) : OLIVE;
        if (Math.abs(v - 10.6) < 1.5 && (Math.abs(u - 9.6) < 0.4 || Math.abs(u - 12.4) < 0.4) && z < 1.4) return WHEEL;
        // flagpole on a base
        if (Math.abs(u - 15.5) < 0.4 && Math.abs(v - 9) < 0.4 && z < 22) return z > 21.4 ? HAZ : STEEL;
        if (inBox(u, v, z, 14.6, 16, 8.2, 9.8, 0, 1)) return CONC_L;
        return null;
      };
      return { shape, rx: 16, ry: 12, zmax: 22, fx: [{ x: 15.5, y: 9, z: 21 }] };
    }
    case 'refinery': {
      const shape: Shape = (u, v, z) => {
        // big storage tank: plate courses, a domed lid, a spiral stair and a railing
        const d = Math.hypot(u - 12, v + 4);
        if (d <= 9 && z <= 20 + Math.sqrt(Math.max(0, 81 - d * d)) * 0.35) {
          const a = Math.atan2(v + 4, u - 12);
          if (z > 20) {
            if (d < 1.3) return GUN_D;
            if (Math.abs(d - 4.5) < 0.25 || mod(a * 4, Math.PI) < 0.1) return METAL_D;
            return g(STEEL, u, v, z, 0.05);
          }
          if (z > 12 && z < 15) return mod(a * 3, 2) < 0.25 ? f.dark : g(f.main, u, v, z);
          if (z < 1.4) return CONC_D;
          // the stair winds up the side facing the camera
          const st = mod(a - 0.2, Math.PI * 2);
          if (d > 8.3 && st < 1.9 && Math.abs(z - (2 + st * 9.4)) < 0.9) return Math.abs(z - (2 + st * 9.4)) < 0.4 ? GUN_D : mod(Math.floor(st * 14), 2) ? GUN_L : GUN;
          if (mod(z, 3.6) < 0.35 || mod(a * 5 + Math.floor(z / 3.6) * 0.5, 1) < 0.07) return METAL_D;
          return grime(g(METAL, u, v, z, 0.05), a * 9, z, 20, 12);
        }
        if (d > 8.4 && d < 9.2 && z > 20 && z < 21.8 && (z > 21.4 || mod(Math.atan2(v + 4, u - 12) * 8, 2) < 0.4)) return STEEL;
        // processing hall with a hopper over the unloading bay
        if (inBox(u, v, z, -20, 3, -14, 14, 0, 12)) {
          const door = rollerDoor(u, v, z, -10, 6, 14, 8.6);
          if (door) return door;
          if (z > 11.4) {
            const e = Math.min(u + 20, 3 - u, v + 14, 14 - v);
            if (e < 1) return CONC_L;
            if (Math.abs(v) < 2) return g(f.main, u, v, z);
            return mod(v, 2.6) < 0.5 ? METAL_D : shade(METAL, -0.06);
          }
          if (u > 2.4 && Math.abs(v - 10) < 1.1 && z < 5) return z > 4 ? GLASS_D : GUN;
          return wallSkin(u, v, z, 3, 14, 0, 12, 11, { win: [7, 11], band: f.main });
        }
        // crusher tower on the roof, with a conveyor running down to the hall's far end
        if (inBox(u, v, z, -17, -10, -11, -4, 12, 18)) {
          if (z > 17.4) return g(roofC, u, v, z);
          if (z > 14 && z < 16 && (u > -10.6 || v > -4.6)) return mod(u > -10.6 ? v : u, 2.4) < 1.2 ? WIN_B : METAL_D;
          return mod(u + v, 2) < 0.5 ? METAL_D : METAL;
        }
        if (Math.abs(v + 7.5) < 1.4 && u > -10 && u < 2 && Math.abs(z - (17 - (u + 10) * 0.42)) < 0.9) return Math.abs(v + 7.5) > 1 ? HAZ : mod(Math.floor(u * 1.5), 2) ? BLACK : TREAD;
        for (const cu of [-4, 1]) if (Math.abs(u - cu) < 0.4 && Math.abs(Math.abs(v + 7.5) - 1.2) < 0.4 && z >= 12 && z < 17 - (cu + 10) * 0.42) return GUN_D;
        // chimney with bands and a soot-black lip, guyed vents beside it
        if (cyl(u, v, -16, -10.4, 1.6) && z >= 18 && z < 27) return z > 26.2 ? BLACK : z > 24.6 ? f.main : mod(Math.floor(z / 2), 2) ? CONC_D : shade(CONC_D, 0.12);
        const ac = acUnit(u, v, z, -5, 8, 12) ?? acUnit(u, v, z, -15, 8, 12);
        if (ac) return ac;
        // pipes between the hall and the tank, with a valve wheel
        for (const pz of [4, 7, 10]) if (Math.abs(v + 4 - (pz - 7) * 0.9) < 0.7 && u > 2.4 && u < 4.4 && Math.abs(z - pz) < 0.7) return pz === 7 ? COPPER : STEEL;
        if (Math.abs(u - 3.6) < 0.4 && (v + 1.6) ** 2 + (z - 5.5) ** 2 < 1.4) return RED;
        // ore unloading pad with a grille over the pit, bollards at its corners
        if (inBox(u, v, z, 5, 20, 7, 15, 0, 1)) {
          if (u > 8 && u < 17 && v > 9 && v < 13) return mod(Math.floor(u * 1.2), 2) || mod(Math.floor(v * 1.2), 2) ? GUN : BLACK;
          return hazard(u, v);
        }
        for (const [bu, bv] of [[5.6, 15.4], [19.6, 15.4], [19.6, 6.8]]) if (cyl(u, v, bu, bv, 0.7) && z < 3) return mod(Math.floor(z * 1.4), 2) ? HAZ : BLACK;
        // spilt ore by the pad
        if ((u - 18.4) ** 2 + (v - 3.6) ** 2 + (z * 1.6) ** 2 < 5 + hash2(Math.floor(u * 2), Math.floor(v * 2), 9)) return hash2(Math.floor(u * 2), Math.floor(v * 2) + Math.floor(z * 2) * 7, 4) > 0.8 ? hex('#f2d06a') : hex('#c09443');
        return null;
      };
      return { shape, rx: 21, ry: 16, zmax: 28, fx: [{ x: -16, y: -10.4, z: 27 }] };
    }
    case 'radar': {
      const shape: Shape = (u, v, z) => {
        if (inBox(u, v, z, -10, 10, -8, 8, 0, 9)) {
          if (z > 8.4) {
            const e = Math.min(u + 10, 10 - u, v + 8, 8 - v);
            if (e < 1) return f.light;
            if (Math.abs(u) < 3 && Math.abs(v) < 3) return Math.abs(u) > 2.4 || Math.abs(v) > 2.4 ? GUN : GUN_D;
            return g(roofC, u, v, z);
          }
          if (v > 7.4 && Math.abs(u + 5) < 1.3 && z < 5.4) return z > 4.4 ? GLASS_D : Math.abs(u + 5) > 0.9 ? CONC_L : GUN;
          if (v > 7.4 && u > 0 && u < 7 && z > 3.4 && z < 6.4) {
            // a wide operations window, screens glowing inside
            if (u < 0.5 || u > 6.5 || z > 6 || z < 3.9) return CONC_L;
            return mod(u, 2) < 0.3 ? WIN : hash2(Math.floor(u / 2), 1, 7) > 0.4 ? hex('#6fe0a0') : WIN_B;
          }
          return wallSkin(u, v, z, 10, 8, 0, 9, 7, { win: [2.4, 7.4], pitch: 4.6 });
        }
        // lattice mast with a platform under the dish
        if (z >= 9 && z < 19) {
          const m = lattice(u, v, z, 0, 0, 1.7, GUN_L);
          if (m) return m;
        }
        if (inBox(u, v, z, -2.4, 2.4, -2.4, 2.4, 18.4, 19)) return Math.abs(u) > 1.9 || Math.abs(v) > 1.9 ? HAZ : GUN;
        // roof aerials, a small relay dish, a generator set by the wall
        if (Math.abs(u - 7.6) < 0.35 && Math.abs(v + 5.6) < 0.35 && z >= 9 && z < 15) return z > 14.4 ? RED : GUN_D;
        if (Math.abs(u + 7.6) < 0.35 && Math.abs(v + 5.6) < 0.35 && z >= 9 && z < 13) return GUN_D;
        const ac = acUnit(u, v, z, -6.4, 4.6, 9);
        if (ac) return ac;
        if ((u - 7) ** 2 + (v - 5) ** 2 + (z - 10.8) ** 2 < 3 && z > 9.6 && v > 4.6) return WHITE;
        if (inBox(u, v, z, -10.8, -10, -4, 2, 0, 4)) return z > 3.4 ? GUN_D : mod(Math.floor(v * 1.5), 2) ? OLIVE : OLIVE_D;
        return null;
      };
      return { shape, rx: 11, ry: 9, zmax: 20, fx: [{ x: 0, y: 0, z: 21 }] };
    }
    case 'factory': {
      // The Vehicle works: a long hall under a saw-tooth roof with a big door,
      // an overhead gantry, stacks and vehicle parts outside.
      const shape: Shape = (u, v, z) => {
        if (inBox(u, v, z, -26, 26, -18, 18, 0, 22)) {
          // saw-tooth roof: glazed on the steep side, ribbed sheet on the slope
          const s = mod(u + 26, 10) / 10;
          const roof = 16 + s * 5;
          if (z > roof) return null;
          if (z > 16) {
            if (Math.abs(v) > 16.6) return z > roof - 0.7 ? CONC_L : g(CONC_D, u, v, z);
            if (s > 0.86) return mod(v, 4) < 0.5 ? STEEL : z > 19 ? GLASS : GLASS_D;
            if (z > roof - 0.7) return mod(v, 2) < 0.4 ? METAL_D : s < 0.1 ? GUN : shade(METAL, -0.1 + s * 0.16);
            return METAL_D;
          }
          const door = rollerDoor(u, v, z, -2, 9, 18, 12.4);
          if (door) return door;
          if (v > 17.4 && z > 13 && z < 15.5 && Math.abs(u + 2) < 5) return mod(Math.floor(u * 1.3), 2) && z > 13.5 && z < 15 ? WHITE : f.dark; // sign over the door
          if (v > 17.4 && Math.abs(u - 14) < 1.1 && z < 5.2) return z > 4.2 ? GLASS_D : GUN; // side door
          if (v > 17.4 && Math.abs(u - 14) < 1.3 && z > 5.6 && z < 6.5) return LAMP;
          if (u > 25.4 && Math.abs(v) < 6 && z < 9) return Math.abs(v) > 5.2 || z > 8.2 ? hazard(v, z) : mod(Math.floor(z * 1.5), 2) ? METAL_D : METAL; // loading door on the end
          if ((u > 25.4 && Math.abs(Math.abs(v) - 12) < 0.45) || (v > 17.4 && Math.abs(Math.abs(u + 2) - 20) < 0.45)) return z > 1 ? METAL_D : CONC_D; // downpipes
          return wallSkin(u, v, z, 26, 18, 0, 16, 13, { win: [6.4, 11.4], band: f.main, pitch: 5.2 });
        }
        // roof vents and a row of stacks
        for (const cu of [-18, 12]) if (cyl(u, v, cu, -8, 1.7) && z < 25.4) return z > 24.6 ? BLACK : z > 23.4 ? f.main : mod(Math.floor(z), 3) === 0 ? METAL_D : STEEL;
        for (const cu of [-13, -3, 7, 17]) if (cyl(u, v, cu, 6, 1) && z > 16 && z < 20 + mod(cu + 26, 10) * 0.5) return METAL_D;
        // out front: a gantry crane over the door lane, a hull on blocks, tyres, crates
        for (const gu of [-12.5, 8.5]) if (Math.abs(u - gu) < 0.5 && Math.abs(v - 18.6) < 0.5 && z < 14) return z > 13.2 || mod(Math.floor(z / 2), 2) ? HAZ : BLACK;
        return null;
      };
      return { shape, rx: 27, ry: 19, zmax: 26, fx: [{ x: -18, y: -8, z: 25.4 }, { x: 12, y: -8, z: 25.4 }] };
    }
    case 'tower': {
      // Gun tower: an eight-sided concrete emplacement with a sandbagged rim.
      const shape: Shape = (u, v, z) => {
        const oct = Math.max(Math.abs(u), Math.abs(v), (Math.abs(u) + Math.abs(v)) * 0.72);
        if (oct < 7.5 && z < 5) {
          if (z > 4.4) {
            if (oct > 6.6) return CONC_L;
            if (oct < 4.6) return oct > 4 ? GUN_D : mod(Math.atan2(v, u) * 4, 2) < 1 ? f.dark : shade(f.dark, 0.14); // turret ring
            return hazard(Math.atan2(v, u) * 7, 0);
          }
          if (z < 1) return CONC_D;
          const onX = u > v;
          const along = onX ? v : u;
          if (Math.abs(along) < 1.6 && z > 2.2 && z < 3.4 && oct > 6.8) return BLACK; // firing slit
          if (v > 6.8 && Math.abs(u + 4) < 1.1 && z < 3.6) return GUN; // hatch
          if (Math.abs(z - 2) < 0.2) return shade(CONC, -0.14);
          return grime(g(CONC, u, v, z, 0.06), along, z, 5, 5);
        }
        // sandbags on the rim to either side
        if (oct < 7.6 && oct > 5.8 && z >= 5 && z < 6.4 && (Math.abs(u) > 3.4 && Math.abs(v) > 3.4)) return mod(Math.atan2(v, u) * 6, 2) < 0.4 ? shade(SAND_BAG, -0.3) : shade(SAND_BAG, z > 5.7 ? 0.06 : -0.06);
        // ammunition by the hatch
        if (inBox(u, v, z, -6.4, -3.6, 7.6, 9, 0, 1.6)) return z > 1.2 ? shade(OLIVE, 0.15) : Math.abs(u + 5) < 0.3 ? HAZ : OLIVE;
        return null;
      };
      return { shape, rx: 8, ry: 8, zmax: 7, fx: [{ x: 0, y: 0, z: 5 }] };
    }
    case 'silo': {
      const silo = (u: number, v: number, z: number, cu: number, cv: number, h: number) => {
        const d = Math.hypot(u - cu, v - cv);
        if (d > 5.5 || z > h + Math.sqrt(Math.max(0, 30 - d * d)) * 0.6) return null;
        const a = Math.atan2(v - cv, u - cu);
        if (z > h) {
          if (d < 1) return z > h + 3 ? GUN_D : GUN; // filler hatch
          return mod(a * 4, Math.PI) < 0.12 ? METAL_D : g(STEEL, u, v, z, 0.05);
        }
        if (z > h - 0.7) return METAL_D; // eaves ring
        if (z > h * 0.5 && z < h * 0.5 + 2.5) return mod(Math.floor(a * 3.2) + Math.floor(z * 0.8), 2) ? f.main : f.light; // chequered band
        if (z < 1.6) return CONC_D;
        if (Math.abs(a - 0.85) < 0.13 && d > 4.9) return mod(Math.floor(z * 1.5), 2) ? GUN_D : GUN_L; // ladder
        if (mod(z, 2.6) < 0.35) return METAL_D; // hoops
        if (mod(a * 4, 1) < 0.07) return shade(METAL, -0.1);
        return grime(g(METAL, u, v, z, 0.05), a * 8, z, h, cu + 9);
      };
      const shape: Shape = (u, v, z) => {
        const s = silo(u, v, z, -5, -3, 18) ?? silo(u, v, z, 6, 3, 14);
        if (s) return s;
        // a gantry between the tops, feed pipes down to a pump house, a slab under it all
        if (Math.abs(v - u * 0.55) < 0.8 && u > -3 && u < 4 && Math.abs(z - 15.4) < 0.5) return mod(Math.floor(u * 1.4), 2) ? HAZ : GUN;
        if (inBox(u, v, z, -10.6, -6.4, 4.4, 8.6, 0, 4.4)) {
          if (z > 3.8) return g(roofC, u, v, z);
          if (v > 8 && Math.abs(u + 8.5) < 0.9 && z < 3.2) return GUN;
          return mod(u + v, 3) < 0.4 ? CONC_D : CONC;
        }
        if (Math.abs(u + 8.5) < 0.6 && Math.abs(z - 5) < 0.6 && v > -1 && v < 6) return COPPER;
        if (Math.abs(v - 8.6) < 0.6 && Math.abs(z - 2.2) < 0.6 && u > -6.4 && u < 2.4) return STEEL;
        const dr = drums(u, v, z, [[9.4, -6, f.main], [10.4, -3.8, RUST]]);
        if (dr) return dr;
        if (Math.abs(u) <= 12 && Math.abs(v) <= 10 && z < 0.6) return Math.abs(u) > 11.2 || Math.abs(v) > 9.2 ? CONC_L : mod(u, 6) < 0.4 || mod(v, 6) < 0.4 ? shade(CONC_D, -0.12) : g(CONC_D, u, v, z, 0.08);
        return null;
      };
      return { shape, rx: 12, ry: 10, zmax: 23, fx: [] };
    }
    case 'helipad': {
      const shape: Shape = (u, v, z) => {
        const d = Math.hypot(u, v);
        // landing lights, a windsock on a pole and a fuel bowser at the edge
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.39;
          if (cyl(u, v, Math.cos(a) * 11.2, Math.sin(a) * 11.2, 0.6) && z < 1.8) return z > 1.1 ? (i % 2 ? LAMP : hex('#7fe0a0')) : GUN_D;
        }
        if (Math.abs(u + 9.6) < 0.35 && Math.abs(v + 9.6) < 0.35 && z < 9) return STEEL;
        if (Math.abs(v + 9.6) < 0.5 && u > -9.4 && u < -5.6 && Math.abs(z - 8.2) < 0.8 - (u + 9.4) * 0.12) return mod(Math.floor(u * 1.2), 2) ? hex('#e8743a') : WHITE;
        if (d > 12 || z > 1) return null;
        if (d > 11) return CONC_D;
        if (d > 10.2) return hazard(Math.atan2(v, u) * 9, 0);
        if (Math.abs(d - 8.4) < 0.6) return WHITE;
        if ((Math.abs(u + 3) < 0.8 || Math.abs(u - 3) < 0.8) && Math.abs(v) < 4.2) return HAZ;
        if (Math.abs(u) < 3 && Math.abs(v) < 0.8) return HAZ;
        if (d < 8 && (Math.abs(mod(u + v, 8) - 4) < 0.25 || Math.abs(mod(u - v, 8) - 4) < 0.25)) return shade(TAR, 0.1); // tie-down grid
        if (hash2(Math.floor(u * 0.8), Math.floor(v * 0.8), 14) > 0.94) return shade(TAR, -0.2); // scorch and oil
        return g(d < 8 ? shade(TAR, 0.16) : CONC, u, v, z, 0.08);
      };
      return { shape, rx: 12, ry: 12, zmax: 10, fx: [] };
    }
  }
}

/** A building's footprint and effect anchors, without drawing it. */
export function buildingFoot(kind: BuildingKind, f: Faction): Omit<V2BuildingArt, 'spr'> {
  const b = buildingShape(kind, f);
  return { rx: b.rx, ry: b.ry, fx: b.fx };
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
// drawn with the ground so neighbouring clumps run together.
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

const B_SEED: Record<BuildingKind, number> = { yard: 1, lab: 2, hq: 3, power: 4, barracks: 5, refinery: 6, radar: 7, factory: 8, tower: 9, silo: 10, helipad: 11 };

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

// ---------- Build menu pictures ----------

// The model of a building or unit for the build menu's close-up picture, with
// the renderer settings it needs (without a scale). Foot soldiers get a
// head-and-shoulders portrait instead of their tiny map figure.
export function subjectModel(id: string, f: Faction): { shape: Shape; o: StackOpts } | null {
  const both = (a: Shape, b: Shape): Shape => (u, v, z) => b(u, v, z) ?? a(u, v, z);
  switch (id) {
    case 'inf':
    case 'rocket':
      return { shape: soldierBust(f, id === 'rocket'), o: { r: BUST.r, zmax: BUST.zmax, noGroundShadow: true, outline: [14, 12, 10] } };
    case 'light':
      return { shape: both(tankHull(f, 16, 12, false), turretShape(f, 3.6, 5, 1, 11)), o: { r: 11.5, zmax: 14, bakeShadow: true } };
    case 'heavy':
      return { shape: both(tankHull(f, 20, 15, true), turretShape(f, 4.8, 6, 2, 13)), o: { r: 13.5, zmax: 16, bakeShadow: true } };
    case 'buggy':
      return { shape: buggy(f), o: { r: 8, zmax: 10, bakeShadow: true } };
    case 'hauler':
      return { shape: hauler(f, 2), o: { r: 13, zmax: 11, bakeShadow: true } };
    case 'arty':
      return { shape: artillery(f), o: { r: 13.5, zmax: 13, bakeShadow: true } };
    case 'heli':
      return { shape: heli(f), o: { r: 15.5, zmax: 10, noGroundShadow: true } };
    case 'mcv':
      return { shape: foundryVehicle(f), o: { r: 17.5, zmax: 17, bakeShadow: true } };
    case 'boat':
      return { shape: boat(f), o: { r: 15.5, zmax: 13, bakeShadow: true, shadowAlpha: 0.2 } };
  }
  const kinds: BuildingKind[] = ['yard', 'lab', 'hq', 'power', 'barracks', 'refinery', 'radar', 'factory', 'tower', 'silo', 'helipad'];
  const kind = kinds.find((k) => k === id);
  if (!kind) return null;
  const b = buildingShape(kind, f);
  const o: StackOpts = { r: 0, rx: b.rx, ry: b.ry, zmax: b.zmax, bakeShadow: true, step: 0.5, shadowAlpha: 0.32 };
  if (kind === 'tower') {
    // the gun turret sits on top, swung round towards the viewer
    const gun = turretShape(f, 4, 0, 2, 11);
    const p = b.fx[0];
    const a = Math.PI * 0.3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    return {
      shape: (u, v, z) => gun(ca * (u - p.x) + sa * (v - p.y), -sa * (u - p.x) + ca * (v - p.y), z - p.z) ?? b.shape(u, v, z),
      o: { ...o, rx: 12, ry: 12, zmax: p.z + 9 },
    };
  }
  return { shape: b.shape, o };
}
