import { Grid, bay, mix, rgb, type Color } from './pix';

// Every character is generated in code as pixel art and cached as a canvas.

export interface FishLook {
  len: number;
  hgt: number;
  base: Color;
  dark: Color;
  light: Color;
  belly: Color;
  fin: Color;
  finDark: Color;
  tall?: boolean;
  scales?: boolean;
  stripes?: number[];
  spots?: number;
  spotCol?: Color;
  eye?: boolean;
  noOutline?: boolean;
}

// Computer fish species (the World picks an index).
export const SPECIES: Omit<FishLook, 'len' | 'hgt'>[] = [
  { base: '#ffd93b', dark: '#e8a91c', light: '#fff09a', belly: '#fff8d0', fin: '#3fa0ff', finDark: '#2a70d0', tall: true },
  { base: '#ff5a5a', dark: '#d93a3a', light: '#ff9a8a', belly: '#ffd6cc', fin: '#ff8a6a', finDark: '#c83a3a' },
  { base: '#57d6a0', dark: '#2fa877', light: '#a4f0cc', belly: '#e0fff0', fin: '#2fa877', finDark: '#1f8058', spots: 6 },
  { base: '#e8d38a', dark: '#b89a4a', light: '#fff0b8', belly: '#ffffff', fin: '#d9b85a', finDark: '#a8883a', spots: 10, spotCol: '#8a6a2a' },
  { base: '#9fb6c8', dark: '#6a8298', light: '#d4e2ec', belly: '#f2f7fa', fin: '#8aa0b4', finDark: '#5d7488', scales: true },
  { base: '#ff9ed8', dark: '#d867b0', light: '#ffd0ee', belly: '#fff0fa', fin: '#c77dff', finDark: '#9150d8' },
];

const CLOWN: Omit<FishLook, 'len' | 'hgt'> = {
  base: '#ff7a1f',
  dark: '#d9531a',
  light: '#ffa24a',
  belly: '#ffc98a',
  fin: '#ff9a3c',
  finDark: '#2a1206',
  stripes: [0.3, 0.64],
};

// A player's fish is drawn in their own color.
export function playerLook(color: Color): Omit<FishLook, 'len' | 'hgt'> {
  const c = rgb(color);
  const lum = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
  const base = lum > 0.9 ? mix(c, '#a8c4e0', 0.25) : c;
  return {
    base,
    dark: mix(base, '#1a2050', 0.38),
    light: mix(base, '#ffffff', 0.4),
    belly: mix(base, '#ffffff', 0.72),
    fin: mix(base, '#ffffff', 0.2),
    finDark: mix(base, '#1a2050', 0.3),
    scales: true,
  };
}

export const clownLook = () => CLOWN;

// A fish facing right. `frame` wags the tail.
export function fishGrid(o: FishLook, frame = 0, rand: () => number = Math.random): Grid {
  const len = Math.round(o.len);
  const hgt = Math.max(3, Math.round(o.hgt));
  const tw = Math.max(3, Math.round(len * 0.3));
  const W = len + tw + 4;
  const H = hgt + Math.round(hgt * 0.7) + 6;
  const g = new Grid(W, H);
  const bx = tw + 1;
  const cy = Math.floor(H / 2) + 1;
  const cx = bx + len * 0.5;
  const rx = len / 2;
  const wag = frame === 1 ? 1 : 0;
  // tail
  for (let i = 0; i < tw; i++) {
    const x = bx - i;
    const t = i / (tw - 1 || 1);
    const sp = Math.round(1 + t * hgt * (o.tall ? 0.55 : 0.45));
    const shift = Math.round(t * wag * 1.5);
    for (let y = -sp; y <= sp; y++) {
      if (t > 0.6 && Math.abs(y) < (t - 0.6) * hgt * 0.9) continue;
      g.set(x, cy + y + shift, i > 1 && Math.abs(y) % 3 === 0 ? o.finDark : o.fin);
    }
  }
  // dorsal fin
  const da = cx - len * 0.22;
  const db = cx + len * 0.2;
  const dh = hgt * (o.tall ? 0.5 : 0.38);
  for (let x = Math.floor(da); x <= db; x++) {
    const t = (x - da) / (db - da);
    const h = Math.round(dh * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (1 - t * 0.5));
    for (let y = 1; y <= h; y++) g.set(x, cy - hgt / 2 + 1 - y, x % 3 === 0 && y < h ? o.finDark : o.fin);
  }
  // lower fin
  for (let x = Math.floor(cx - len * 0.18); x < cx - len * 0.02; x++) {
    const h = Math.round((x - (cx - len * 0.18)) * 0.35) + 1;
    for (let y = 0; y < Math.min(h, hgt * 0.25); y++) g.set(x, cy + hgt / 2 - 1 + y, o.finDark);
  }
  // body with banded, dithered shading
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const ryE = (hgt / 2) * (dx < 0 ? 1 - 0.38 * dx * dx * 1.2 : 1 - 0.1 * dx * dx);
      const half = ryE * Math.sqrt(1 - dx * dx);
      const dy = y + 0.5 - cy;
      if (Math.abs(dy) > half) continue;
      const t = dy / half;
      const v = t * 0.9 - dx * 0.12 + (bay(x, y) - 0.5) * 0.22;
      let c: Color = v < -0.6 ? o.dark : v < 0.28 ? o.base : v < 0.7 ? o.light : o.belly;
      if (t > -0.62 && t < -0.38 && dx > -0.4 && dx < 0.55 && len > 10) c = mix(o.light, '#ffffff', 0.35);
      if (o.scales && v > -0.6 && v < 0.3 && (x + (y % 2) * 2) % 4 === 0 && y % 2 === 0) c = mix(o.base, o.dark, 0.45);
      g.set(x, y, c);
    }
  if (o.stripes) {
    const fin = rgb(o.fin);
    const finDark = rgb(o.finDark);
    const same = (a: number[] | null, b: number[]) => !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    for (const sr of o.stripes) {
      const sx = bx + len * sr;
      for (let y = 0; y < H; y++) {
        const dy = (y - cy) / (hgt / 2);
        const xs = Math.round(sx + dy * dy * 1.5);
        const w = len > 14 ? 1 : 0;
        for (let k = -w; k <= w; k++) {
          const c = g.get(xs + k, y);
          if (!c || same(c, fin) || same(c, finDark)) continue;
          g.set(xs + k, y, k === 1 ? '#e6edf5' : '#ffffff');
        }
        if (len > 14 && Math.abs(dy) < 1) {
          if (g.get(xs - 2, y)) g.set(xs - 2, y, '#2a1206');
          if (g.get(xs + 2, y)) g.set(xs + 2, y, '#2a1206');
        }
      }
    }
  }
  if (o.spots)
    for (let k = 0; k < o.spots; k++) {
      const x = Math.floor(bx + len * (0.15 + rand() * 0.5));
      const y = Math.floor(cy - hgt * 0.3 + rand() * hgt * 0.35);
      if (g.get(x, y)) g.set(x, y, o.spotCol ?? o.dark);
    }
  if (len > 9) {
    // gill
    const gx = bx + len * 0.68;
    for (let y = -hgt * 0.3; y <= hgt * 0.3; y++) {
      const xx = Math.round(gx + (y / (hgt * 0.3)) ** 2 * 1.5);
      if (g.get(xx, cy + y)) g.set(xx, cy + y, mix(o.base, o.dark, 0.7));
    }
    // pectoral fin
    for (let k = 0; k < Math.max(3, len * 0.15); k++) {
      const yy = cy + 1 + Math.round(k * 0.45) + (frame === 1 && k > 1 ? 1 : 0);
      g.set(gx - 1 - k, yy, mix(o.fin, '#ffffff', 0.25));
      g.set(gx - 2 - k, yy, o.fin);
      if (k > 1) g.set(gx - 1 - k, yy + 1, o.finDark);
    }
  }
  if (o.eye !== false) {
    const big = hgt >= 12;
    const ex = Math.round(bx + len * 0.8);
    const ey = Math.round(cy - hgt * 0.12);
    if (big) {
      g.rect(ex - 1, ey - 1, 4, 4, '#ffffff');
      g.rect(ex, ey, 2, 2, '#141414');
      g.set(ex + 1, ey + 1, '#141414');
      g.set(ex, ey, '#ffffff');
    } else if (len > 6) {
      g.rect(ex - 1, ey - 1, 2, 2, '#ffffff');
      g.set(ex, ey, '#141414');
    } else g.set(ex, ey, '#141414');
    const mx = Math.round(bx + len - 1);
    const my = Math.round(cy + hgt * 0.14);
    g.set(mx, my, mix(o.dark, '#000000', 0.4));
  }
  if (!o.noOutline) g.outlineAuto(0.36);
  return g;
}

// ---------- boats ----------

export interface PirateLook {
  hat: 'tri' | string;
  shirt: string;
  stripe?: boolean;
  beard?: string | null;
  parrot?: boolean;
}

export function pirate(g: Grid, x: number, y: number, o: PirateLook): void {
  g.rect(x + 1, y - 1, 2, 1, '#2a1a10');
  g.rect(x + 4, y - 1, 2, 1, '#2a1a10');
  g.rect(x + 1, y - 4, 2, 3, '#2b3a6b');
  g.rect(x + 4, y - 4, 2, 3, '#2b3a6b');
  g.rect(x + 1, y - 5, 5, 1, '#4a2a14');
  g.set(x + 3, y - 5, '#e6b84a');
  for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) g.set(x + 1 + i, y - 9 + j, o.stripe && j % 2 ? '#ffffff' : o.shirt);
  g.set(x + 5, y - 9, mix(o.shirt, '#000', 0.3));
  g.set(x + 5, y - 8, mix(o.shirt, '#000', 0.3));
  g.rect(x, y - 8, 1, 3, '#f2c49b');
  g.rect(x + 6, y - 8, 1, 3, '#f2c49b');
  g.rect(x + 1, y - 13, 5, 4, '#f2c49b');
  g.set(x + 4, y - 12, '#141414');
  g.set(x + 5, y - 11, '#d9957a');
  if (o.beard) {
    g.rect(x + 1, y - 10, 5, 1, o.beard);
    g.set(x + 2, y - 11, o.beard);
  }
  if (o.hat === 'tri') {
    g.rect(x - 1, y - 14, 9, 1, '#222233');
    g.rect(x + 1, y - 16, 5, 2, '#222233');
    g.set(x + 3, y - 15, '#ffffff');
    g.set(x - 1, y - 15, '#222233');
    g.set(x + 7, y - 15, '#222233');
  } else {
    g.rect(x + 1, y - 14, 5, 1, o.hat);
    g.rect(x + 1, y - 15, 4, 1, o.hat);
    g.set(x, y - 13, o.hat);
    g.set(x - 1, y - 12, o.hat);
    g.set(x + 2, y - 14, mix(o.hat, '#fff', 0.4));
  }
  if (o.parrot) {
    g.rect(x + 6, y - 13, 2, 3, '#3fbf4a');
    g.set(x + 7, y - 14, '#3fbf4a');
    g.set(x + 8, y - 13, '#ffb030');
    g.set(x + 7, y - 13, '#141414');
    g.set(x + 6, y - 10, '#e53d3d');
  }
}

// Boat sprite geometry, facing right. The waterline is row BOAT_WL; the center is column BOAT_CX.
export const BOAT_W = 106;
export const BOAT_H = 72;
export const BOAT_WL = 56;
export const BOAT_CX = 53;
export const ROD_TIP: [number, number] = [100, 24];
export const PIRATE_HEAD: [number, number] = [67, 26];

const boatTop = (x: number) => Math.round(42 - ((x - 52) / 44) ** 2 * 5);
const boatBot = (x: number) => Math.round(60 - Math.pow(Math.abs(x - 48) / 46, 3.2) * 16);

export function boatGrid(color: Color, crew: PirateLook): Grid {
  const g = new Grid(BOAT_W, BOAT_H);
  const c = rgb(color);
  const cd = mix(color, '#000', 0.35);
  const cl = mix(color, '#fff', 0.4);
  const L = 8;
  const R = 94;
  g.rect(46, 4, 2, 40, '#6b4426');
  g.rect(47, 4, 1, 40, '#8f5d35');
  g.line(47, 6, 12, boatTop(12) - 10, '#4a3220');
  g.line(47, 6, 103, boatTop(94) - 6, '#4a3220');
  for (let y = 9; y <= 36; y++) {
    const t = (y - 9) / 27;
    const bul = Math.round(Math.sin(t * Math.PI) * 4);
    const x0 = 22 - bul;
    const x1 = 45;
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const band = Math.floor((y - 9) / 5) % 2 === 0;
      let cc: Color = band ? c : '#f8edd2';
      if (u < 0.15) cc = band ? cd : '#d8c59a';
      else if (u > 0.4 && u < 0.78 && t > 0.12 && t < 0.62) cc = band ? cl : '#fffaee';
      g.set(x, y, cc);
    }
  }
  g.rect(19, 8, 30, 2, '#5b3a20');
  g.rect(19, 36, 30, 1, '#5b3a20');
  for (let y = 10; y < 38; y++) {
    const t = (y - 10) / 28;
    for (let x = 50; x < 50 + t * 26; x++) g.set(x, y, x > 50 + t * 26 - 3 ? '#d8c59a' : '#f8edd2');
  }
  g.line(48, 7, 100, boatTop(94) - 5, '#5b3a20');
  for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) g.set(48 + x, y + Math.round(Math.sin(x * 0.6)), x < 1 ? cd : y < 1 ? cl : c);
  g.rect(52, 2, 3, 2, '#ffffff');
  g.set(52, 4, '#ffffff');
  g.set(54, 4, '#ffffff');
  pirate(g, 64, boatTop(64), crew);
  g.line(71, boatTop(64) - 8, ROD_TIP[0], ROD_TIP[1], '#7a5230');
  for (let x = L; x <= R; x++) {
    const t0 = boatTop(x);
    const b0 = boatBot(x);
    for (let y = t0; y <= b0; y++) {
      const k = y - t0;
      const pl = k % 4;
      let cc: Color = pl === 0 ? '#6a4224' : pl === 1 ? '#a46b3c' : '#8e5a32';
      const vy = (y - t0) / (b0 - t0 + 1);
      if (vy > 0.7 && pl !== 0) cc = mix(cc, '#3a2414', 0.3);
      if (k < 2) cc = '#c99055';
      if (k === 2) cc = '#5a361c';
      if (k === 6) cc = cl;
      if (k === 7 || k === 8) cc = c;
      if (k === 9) cc = cd;
      if (x < L + 2) cc = mix(cc, '#2e1a0c', 0.35);
      g.set(x, y, cc);
    }
  }
  const st = boatTop(L);
  for (let y = st - 10; y < st; y++)
    for (let x = L; x <= L + 18; x++) {
      const k = y - (st - 10);
      g.set(x, y, k < 1 ? '#c99055' : k % 3 === 0 ? '#6a4224' : '#8e5a32');
    }
  for (const wx of [L + 4, L + 11]) {
    g.rect(wx, st - 8, 4, 5, '#3a2414');
    g.rect(wx + 1, st - 7, 2, 3, '#ffd77a');
    g.set(wx + 1, st - 7, '#fff3c0');
  }
  for (let x = L + 20; x < R - 2; x += 3) g.rect(x, boatTop(x) - 3, 1, 3, '#8e5a32');
  for (let x = L + 19; x < R - 1; x++) g.set(x, boatTop(x) - 4, '#c99055');
  for (const x of [28, 46, 64]) {
    const y = boatTop(x) + 11;
    g.rect(x, y, 4, 3, '#2b1d14');
    g.rect(x, y - 1, 4, 1, '#c4952f');
  }
  g.line(90, boatTop(90) - 1, 104, boatTop(90) - 7, '#6b4426');
  g.line(90, boatTop(90), 104, boatTop(90) - 6, '#8f5d35');
  g.outlineAuto(0.42, '#1c1008');
  return g.submerge(BOAT_WL + 1);
}

export const CREWS: PirateLook[] = [
  { hat: 'tri', shirt: '#3d3d5c', beard: '#6b4a3a', parrot: true },
  { hat: '#c0392b', shirt: '#f2f2f2', stripe: true },
  { hat: '#2f6fd8', shirt: '#e8c04a' },
  { hat: 'tri', shirt: '#2f9e57', stripe: true },
];

// ---------- Gristle Pete ----------

export const PETE_W = 60;
export const PETE_H = 46;
export const PETE_WL = 38;

export function peteGrid(): Grid {
  const g = new Grid(PETE_W, PETE_H);
  g.rect(18, 18, 20, 14, '#f4f1ea');
  g.rect(18, 18, 20, 2, '#ffffff');
  g.rect(36, 18, 2, 14, '#d9d2c4');
  for (const [x, y] of [[22, 23], [30, 26], [25, 28], [33, 21]]) g.set(x, y, '#c0392b');
  g.rect(15, 18, 3, 10, '#7a4a8a');
  g.rect(38, 18, 3, 8, '#7a4a8a');
  g.rect(14, 27, 3, 3, '#e9b48a');
  g.rect(19, 5, 16, 13, '#e9b48a');
  g.rect(19, 5, 2, 13, '#d9a07a');
  g.rect(19, 12, 16, 7, '#dcd6cc');
  g.rect(21, 16, 12, 3, '#c2bbb0');
  g.rect(24, 12, 7, 1, '#9b5040');
  g.rect(22, 8, 2, 2, '#141414');
  g.rect(30, 8, 2, 2, '#141414');
  g.set(22, 8, '#ffffff');
  g.set(30, 8, '#ffffff');
  g.rect(21, 6, 4, 1, '#6b4a3a');
  g.rect(29, 6, 4, 1, '#6b4a3a');
  g.rect(26, 9, 3, 3, '#e09a7e');
  g.rect(15, 3, 25, 2, '#5a3a22');
  g.rect(19, 0, 17, 3, '#6e4a2e');
  g.rect(19, 2, 17, 1, '#c0392b');
  g.rect(41, 8, 4, 2, '#fff4e0');
  g.set(41, 7, '#fff4e0');
  g.set(44, 7, '#fff4e0');
  g.rect(43, 10, 6, 6, '#b5523a');
  g.rect(44, 10, 3, 2, '#d9785a');
  g.rect(39, 13, 3, 4, '#e9b48a');
  for (let r = 30; r < 40; r++) {
    const ins = Math.round(Math.pow((r - 30) / 10, 1.8) * 9);
    for (let x = 4 + ins; x < 56 - ins; x++) g.set(x, r, x < 6 + ins ? '#6a4224' : r < 32 ? '#d39a5e' : r % 3 === 0 ? '#7a4a28' : '#a8703f');
  }
  g.rect(44, 23, 9, 7, '#7a4a28');
  g.rect(44, 23, 9, 1, '#a86a3c');
  g.rect(46, 21, 2, 2, '#b5523a');
  g.rect(49, 20, 3, 3, '#d9785a');
  g.line(8, 29, 0, 40, '#7a5230');
  g.outlineAuto(0.42, '#1c1008');
  return g.submerge(PETE_WL + 1);
}

// ---------- small things ----------

export function coinGrid(frame: number): Grid {
  const g = new Grid(8, 8);
  const w = [4, 3, 1, 3][frame % 4];
  const x0 = 1 + Math.floor((4 - w) / 2);
  g.rect(x0, 2, w, 4, '#ffd54a');
  g.rect(x0 + (w > 2 ? 1 : 0), 1, Math.max(1, w - 2), 6, '#ffd54a');
  if (w > 2) {
    g.set(x0 + 1, 2, '#fff6b0');
    g.rect(x0 + w - 1, 3, 1, 3, '#d9a02a');
  }
  return g.outlineAuto(0.45);
}

export function eggGrid(color: Color): Grid {
  const g = new Grid(9, 9);
  const light = mix(color, '#ffffff', 0.5);
  for (let j = -3; j <= 3; j++)
    for (let k = -3; k <= 3; k++) {
      const d = Math.hypot(j, k);
      if (d < 3.2) g.set(4 + j, 4 + k, d > 2.4 ? mix(color, '#000', 0.25) : d < 1.2 ? mix(light, '#fff', 0.5) : light, d > 2.4 ? 1 : 0.92);
    }
  g.set(3, 3, '#ffffff');
  g.set(5, 5, '#3a2414');
  return g;
}

export function meatGrid(): Grid {
  const g = new Grid(10, 9);
  g.rect(1, 1, 3, 2, '#fff4e0');
  g.set(0, 0, '#fff4e0');
  g.rect(3, 3, 6, 5, '#b5523a');
  g.rect(4, 3, 3, 2, '#d9785a');
  return g.outlineAuto(0.45);
}
