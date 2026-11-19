// Close-up portraits of the foot soldiers for the build menu, in the spirit of
// the old RTS build pictures: a head-and-shoulders model, much more detailed
// than the little soldier on the map, drawn by the same voxel renderer so it
// is lit and outlined like everything else.
//
// The model is built facing the camera. The renderer looks down the world's
// (1, 1, 1) diagonal, so the shape turns each world point into "portrait
// space" first: X to the right of the picture, Y up it and Z towards the
// viewer, with Y stretched to undo the 2:1 squash of the isometric view.
import { RGB, hash2, hex, mix, shade } from '../gfx';
import type { Faction } from '../v1/sprites';
import type { Shape } from './stack';

const SKIN = hex('#d9a47a');
const SKIN_D = hex('#a8714e');
const BLACK = hex('#1c1b19');
const GUN = hex('#4f5356');
const GUN_D = hex('#2b2d2f');
const STEEL = hex('#9aa1a4');
const WOOD = hex('#7a5634');
const WOOD_L = hex('#9c7446');
const OLIVE = hex('#5a6b45');
const OLIVE_D = hex('#3f4c31');
const OLIVE_L = hex('#7a8a5c');
const GLASS = hex('#86cde0');
const GLASS_L = hex('#d8f2f8');
const HAZ = hex('#e0b83c');
const RED = hex('#e2452c');
const BROW = hex('#4a3322');
const KHAKI = hex('#9a8a62');
const GRENADE = hex('#4d5a36');
const GRENADE_L = hex('#6f7f4f');

const sq = (a: number) => a * a;

// Distance from p to the segment a-b, and how far along it (0..1) p is.
function seg(p: [number, number, number], a: [number, number, number], b: [number, number, number]): [number, number] {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L));
  return [Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t), t];
}

// Where the bust's middle is above the ground, and how far it reaches: pass
// these to renderStack as r and zmax.
export const BUST = { zc: 22, r: 21, zmax: 44 };

export function soldierBust(f: Faction, kind: 'gi' | 'rocket' | 'gren'): Shape {
  const rocket = kind === 'rocket';
  const gren = kind === 'gren';
  const body = rocket ? mix(f.main, OLIVE, 0.45) : gren ? mix(f.main, KHAKI, 0.5) : f.main;
  const bodyD = shade(body, -0.28);
  const helmet = rocket ? OLIVE_D : shade(f.dark, 0.08);
  const yaw = rocket ? 0.38 : gren ? 0.15 : -0.32; // turned a little, three-quarters on
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // the weapon
  const gunA: [number, number, number] = [-12, -19, 6.5];
  const gunB: [number, number, number] = [17, -5.2, 9];
  const tubeA: [number, number, number] = [-9, -3.5, -9];
  const tubeB: [number, number, number] = [16, 5.5, 8];
  const n = (x: number, y: number, z: number, s: number) => hash2(Math.floor(x * 1.4), Math.floor(y * 1.4) + Math.floor(z * 1.4) * 57, s);

  const bust = (X: number, Y: number, Z: number): RGB | null => {
    const p: [number, number, number] = [X, Y, Z];

    // ----- the weapon, in front of everything
    if (rocket) {
      const [d, t] = seg(p, tubeA, tubeB);
      if (t > 0.97 && d < 2.6) {
        // the warhead poking out of the front
        if (t > 0.985 && d < 2.6 - (t - 0.985) * 120) return d < 1 ? shade(RED, 0.2) : RED;
      }
      if (d < 2.4 && t <= 0.985) {
        if (t > 0.93) return d > 1.9 ? GUN_D : BLACK; // the muzzle ring
        if (t < 0.05) return d > 1.7 ? GUN_D : BLACK; // the back blast end
        if (Math.abs(t - 0.3) < 0.03 || Math.abs(t - 0.72) < 0.03) return OLIVE_D; // bands
        if (d > 2.0 && t > 0.4 && t < 0.6 && Y > 3) return HAZ; // a stencilled stripe
        return n(X, Y, Z, 3) > 0.85 ? OLIVE_L : OLIVE;
      }
      // the sight box on top, and the grip under it
      const [ds, ts] = seg(p, [3, 4.5, 1.5], [6.5, 5.8, 4.2]);
      if (ds < 1.1 && ts > 0) return ts > 0.85 ? GLASS : GUN_D;
      const [dg] = seg(p, [6, -0.5, 3], [5.4, -3.2, 3.6]);
      if (dg < 0.9) return GUN_D;
      // the hand holding it
      if (sq(X - 5.6) + sq(Y + 2.2) + sq(Z - 4.4) < 3.6) return SKIN;
      const [da] = seg(p, [-9, -12, 1], [4.6, -3.4, 3.4]);
      if (da < 2.4) return n(X, Y, Z, 4) > 0.9 ? bodyD : body; // forearm
    } else if (gren) {
      // a grenade held up by the shoulder, ready to throw: its body, the
      // lever down its side and the ring of the pin
      const gx = 8.6;
      const gy = -5.4;
      const gz = 6.5;
      const gd = sq(X - gx) + sq((Y - gy) / 1.2) + sq(Z - gz);
      if (gd < 7.3) {
        if (Math.abs(X - gx + 0.2) < 0.55 && Y > gy && Z > gz) return STEEL; // lever
        if (Math.abs(Y - gy) < 0.35 || Math.abs(X - gx) < 0.3) return shade(GRENADE, -0.25); // its segments
        return Y > gy + 1 && X < gx ? GRENADE_L : GRENADE;
      }
      if (sq(X - gx + 1.6) + sq(Y - gy - 3.6) + sq(Z - gz - 1) < 1.3 && sq(X - gx + 1.6) + sq(Y - gy - 3.6) + sq(Z - gz - 1) > 0.4) return STEEL; // the pin's ring
      // the hand round it, and the forearm up to it
      if (sq(X - gx - 1.8) + sq(Y - gy + 2.2) + sq(Z - gz - 1.4) < 4.4) return SKIN;
      const [da] = seg(p, [12, -22, 0], [10, -9, 5.4]);
      if (da < 2.5) return n(X, Y, Z, 4) > 0.9 ? bodyD : body;
    } else {
      const [d, t] = seg(p, gunA, gunB);
      const r = t < 0.28 ? 1.5 : t > 0.74 ? 0.65 : 1.15;
      if (d < r) {
        if (t > 0.97) return BLACK;
        if (t < 0.28) return Math.abs(t - 0.2) < 0.02 ? BLACK : n(X, Y, Z, 5) > 0.7 ? WOOD_L : WOOD; // stock
        if (t > 0.74) return t > 0.9 && t < 0.93 ? STEEL : GUN; // barrel and its band
        if (t > 0.5 && t < 0.56) return WOOD; // the fore grip
        return d > r - 0.35 && Y > -12 ? STEEL : GUN_D;
      }
      // the magazine and the sight
      const [dm, tm] = seg(p, [1, -13.6, 7.4], [2.2, -17.4, 7.6]);
      if (dm < 1.1 && tm > 0) return mix(GUN_D, BLACK, 0.4);
      if (sq(X - 0.5) + sq(Y + 11.3) + sq(Z - 8.2) < 1) return BLACK;
      // the hands on it, and the forearms
      if (sq(X + 4.2) + sq(Y + 15.3) + sq(Z - 8.6) < 4.2) return SKIN;
      if (sq(X - 5.2) + sq(Y + 11.7) + sq(Z - 9.6) < 4.2) return SKIN;
      const [da] = seg(p, [-11.5, -12, 2], [-4.6, -15.4, 7.2]);
      if (da < 2.5) return n(X, Y, Z, 4) > 0.9 ? bodyD : body;
      const [db] = seg(p, [11, -13, 1.5], [5.6, -12.4, 7.6]);
      if (db < 2.5) return n(X, Y, Z, 4) > 0.9 ? bodyD : body;
    }

    // ----- the head
    // helmet: a dome over the top, with a band, a brim and goggles
    const hd = sq(X / 6.3) + sq((Y - 5.4) / 4.9) + sq((Z + 0.3) / 6.5);
    if (hd < 1 && Y > 4.3) {
      if (Z > 3.2 && Y > 6.1 && Y < 8.1 && Math.abs(X) < 4.6) {
        const lx = Math.abs(Math.abs(X) - 2) - 1.3;
        if (lx < 0 && Y > 6.4 && Y < 7.8) return lx > -0.4 || Y > 7.5 ? GUN_D : Y > 7.2 && X < 0 ? GLASS_L : GLASS;
        return BLACK; // the strap between and round them
      }
      if (Y < 5.3) return shade(helmet, -0.25); // band
      if (!rocket && Math.abs(X + 3.4) < 0.9 && Math.abs(Y - 8.6) < 0.9 && Z > 0) return f.light; // a unit mark
      return n(X, Y, Z, 6) > 0.86 ? shade(helmet, 0.12) : n(X, Y, Z, 7) > 0.9 ? shade(helmet, -0.12) : helmet;
    }
    if (Y > 3.8 && Y <= 4.5 && sq(X / 6.9) + sq((Z + 0.1) / 7.2) < 1) return shade(helmet, -0.15); // brim
    // nose and ears
    if (sq(X) + sq(Y - 1.3) * 1.4 + sq(Z - 4.6) < 1.3) return shade(SKIN, 0.08);
    if (sq(Math.abs(X) - 4.3) + sq(Y - 1.8) + sq(Z + 0.2) < 1.4) return SKIN_D;
    // the face
    const fd = sq(X / 4.5) + sq((Y - 1.6) / 5.2) + sq((Z - 0.5) / 4.6);
    if (fd < 1) {
      if (Y > 3.6) return SKIN_D; // in the shade of the brim
      if (Math.abs(X) > 3.2 && Y < 3 && Y > -2.4 && Z < 2.2) return OLIVE_D; // chin strap
      if (Z > 2.4) {
        const ex = Math.abs(Math.abs(X) - 1.75);
        if (ex < 0.75 && Y > 2.1 && Y < 3) return ex < 0.35 ? BLACK : hex('#f0e6d6'); // eyes
        if (ex < 1 && Y >= 3 && Y < 3.6) return BROW; // brows
        if (Math.abs(X) < 1.5 && Y > -1.3 && Y < -0.7) return shade(SKIN_D, -0.15); // mouth
        if (Y < -1.6 && n(X, Y, Z, 8) > 0.6) return shade(SKIN, -0.12); // stubble
      }
      return SKIN;
    }
    // neck and collar
    if (sq(X) + sq(Z - 0.2) < 7.5 && Y > -6.5 && Y < -1) return Y > -4.5 ? SKIN_D : bodyD;

    // ----- shoulders and chest
    const ax = Math.abs(X);
    const top = -4.8 - sq(X) / 26 - (ax > 8.5 ? sq(ax - 8.5) * 0.45 : 0);
    const depth = 5.4 * Math.sqrt(Math.max(0, 1 - sq(X / 13.2)));
    if (Y < top && Y > -24 && Math.abs(Z) < depth && ax < 13.2) {
      // radio on the back pokes over the shoulder
      // webbing: two straps over the shoulders, a belt of pouches low down
      if (gren && Z > 0) {
        // a bandolier of grenades from the left shoulder down across the chest
        const bd = Y - (-7.5 + (X + 11) * -0.62);
        if (Math.abs(bd) < 1.8) {
          const k = Math.floor((X + 13) / 2.6);
          const cx = -13 + k * 2.6 + 1.3;
          if (sq(X - cx) + sq(bd * 1.2) < 1.7 && Z > 2.2) return n(X, Y, Z, 11) > 0.6 ? GRENADE_L : GRENADE;
          return OLIVE_D;
        }
      }
      const strap = Math.abs(ax - 4.6 - (Y + 6) * 0.06);
      if (strap < 0.9 && Z > 0) return strap > 0.6 ? shade(OLIVE_D, -0.2) : OLIVE_D;
      if (Y < -19.5 && Z > 1) return Math.abs(Math.floor(X / 3.2) * 3.2 - X + 1.6) < 1.2 ? OLIVE : OLIVE_D;
      // a pocket and a badge on the chest
      if (Z > 3 && Math.abs(X + 7.6) < 1.6 && Y < -9 && Y > -12.5) return Y > -9.8 ? bodyD : shade(body, -0.12);
      if (Z > 3 && sq(X - 7.5) + sq(Y + 10) < 1.4) return HAZ;
      // shoulder patches
      if (ax > 10.8 && Y > top - 4 && Y < top - 1.2) return f.light;
      if (Y > top - 0.8) return shade(body, 0.1); // the lit top of the shoulders
      return n(X, Y, Z, 9) > 0.9 ? bodyD : n(X, Y, Z, 10) > 0.93 ? shade(body, 0.1) : body;
    }
    return null;
  };

  return (u, v, z) => {
    const w = z - BUST.zc;
    const X0 = (u - v) * 0.7071;
    const Y = (-u - v + 2 * w) * 0.4082 * 0.866;
    const Z0 = (u + v + w) * 0.5774;
    const X = X0 * cy + Z0 * sy;
    const Z = -X0 * sy + Z0 * cy;
    return bust(X, Y, Z);
  };
}
