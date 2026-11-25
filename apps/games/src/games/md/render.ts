// Isometric block renderer: textured cube sprites for the level, box models for characters,
// a light map for the dungeon dark, and the minimap / full map.
import { LEVELS, TRADERS, type LevelDef } from './data';
import { T, tileAt, type Level, type Prop } from './dungeon';
import type { Game, Monster } from './game';
import { heroParts, monsterParts, traderParts, type Part } from './models';

export const TW = 64;
export const HW = TW / 2;
export const HH = TW / 4;
export const TZ = 34;

// ---------- colors ----------
const shadeCache = new Map<string, string>();
export function shade(hex: string, k: number): string {
  const key = hex + k;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  v = '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0');
  shadeCache.set(key, v);
  return v;
}
function mix(a: string, b: string, t: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

// ---------- textures ----------
type Pattern = 'brick' | 'cobble' | 'grass' | 'dirt' | 'leaf' | 'plank' | 'roof' | 'water' | 'lava' | 'ice' | 'grassSide' | 'path' | 'pillar';
function hash(i: number) {
  i = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
  i = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
  return ((i ^ (i >>> 16)) >>> 0) / 4294967296;
}
function texture(p: Pattern, a: string, b: string, seed: number, frame = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d')!;
  const px = (i: number, j: number, col: string) => {
    x.fillStyle = col;
    x.fillRect(i, j, 1, 1);
  };
  for (let j = 0; j < 16; j++)
    for (let i = 0; i < 16; i++) {
      const n = hash(seed * 977 + j * 16 + i);
      let col = n < 0.55 ? a : n < 0.88 ? mix(a, b, 0.3) : mix(a, b, 0.6);
      if (n < 0.06) col = shade(a, 1.08);
      switch (p) {
        case 'brick': {
          const row = j >> 2;
          const off = row % 2 ? 4 : 0;
          if (j % 4 === 3 || (i + off) % 8 === 7) col = mix(a, b, 0.85);
          break;
        }
        case 'pillar':
          if (i === 0 || i === 15 || j % 8 === 7) col = shade(b, 0.8);
          break;
        case 'cobble': {
          const cx = (i + (j >> 3) * 4) % 8, cy = j % 8;
          if (cx === 0 || cy === 0) col = shade(b, 0.82);
          break;
        }
        case 'grass':
          if (n > 0.92) col = shade(a, 1.2);
          break;
        case 'grassSide':
          col = j < 3 + (hash(seed + i) > 0.5 ? 1 : 0) ? (n > 0.5 ? a : shade(a, 0.9)) : n < 0.5 ? '#7a5636' : '#6a4a2e';
          break;
        case 'path':
          col = n < 0.4 ? '#b89a6a' : n < 0.8 ? '#a88a5c' : '#c8aa78';
          break;
        case 'dirt':
          col = n < 0.5 ? '#7a5636' : '#6a4a2e';
          break;
        case 'leaf':
          col = n < 0.4 ? a : n < 0.75 ? b : n < 0.9 ? shade(a, 1.2) : shade(b, 0.7);
          break;
        case 'plank':
          col = j % 5 === 4 ? shade(b, 0.7) : n < 0.6 ? a : b;
          if (i === 0 || i === 15) col = shade(b, 0.6);
          break;
        case 'roof':
          col = (j + (i >> 2)) % 4 === 0 ? shade(b, 0.8) : n < 0.6 ? a : b;
          break;
        case 'water': {
          const w = Math.sin((i + j) * 0.8 + frame * 1.6) + Math.sin(i * 0.5 - frame);
          col = w > 1.2 ? '#7ac8e8' : n < 0.5 ? '#2e6a9a' : '#2a5e8a';
          break;
        }
        case 'lava': {
          const w = Math.sin(i * 0.7 + frame) + Math.sin(j * 0.9 - frame * 0.7) + n;
          col = w > 1.6 ? '#ffe066' : w > 0.6 ? '#ff9a2a' : w > -0.4 ? '#e0581a' : '#a8300e';
          break;
        }
        case 'ice':
          col = n < 0.5 ? '#cfefff' : '#b8e0f4';
          if ((i - j + 16) % 9 === 0) col = '#ffffff';
          break;
      }
      px(i, j, col);
    }
  return c;
}

// ---------- cube sprites ----------
interface CubeSpec {
  top: HTMLCanvasElement;
  left: HTMLCanvasElement;
  right: HTMLCanvasElement;
  h: number;
}
/** Bakes a textured cube (top, +y face, +x face) into one sprite. Its anchor is the top-back vertex. */
function bakeCube(s: CubeSpec): HTMLCanvasElement {
  const hpx = Math.ceil(s.h * TZ);
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TW / 2 + hpx + 1;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  const face = (img: HTMLCanvasElement, ax: number, ay: number, ux: number, uy: number, vx: number, vy: number, reps: number, dark: number, poly: number[]) => {
    x.save();
    x.beginPath();
    x.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) x.lineTo(poly[i], poly[i + 1]);
    x.closePath();
    x.clip();
    for (let k = 0; k < reps; k++) {
      x.setTransform(ux / 16, uy / 16, vx / 16, vy / 16, ax + vx * k, ay + vy * k);
      x.drawImage(img, 0, 0);
      x.drawImage(img, -0.5, -0.5, 17, 17);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (dark) {
      x.fillStyle = `rgba(0,0,0,${dark})`;
      x.fillRect(0, 0, c.width, c.height);
    }
    x.restore();
  };
  const reps = Math.ceil(s.h);
  // left face (+y): from (0,1,h) along +x, down z
  face(s.left, 0, HH, HW, HH, 0, TZ, reps, 0.22, [0, HH, HW, HH * 2, HW, HH * 2 + hpx, 0, HH + hpx]);
  // right face (+x): from (1,1,h) along -y
  face(s.right, HW, HH * 2, HW, -HH, 0, TZ, reps, 0.4, [HW, HH * 2, TW, HH, TW, HH + hpx, HW, HH * 2 + hpx]);
  // top
  face(s.top, HW, 0, HW, HH, -HW, HH, 1, 0, [HW, 0, TW, HH, HW, HH * 2, 0, HH]);
  // crisp top edge highlight
  x.strokeStyle = 'rgba(255,255,255,.12)';
  x.beginPath();
  x.moveTo(0.5, HH);
  x.lineTo(HW, 0.5);
  x.lineTo(TW - 0.5, HH);
  x.stroke();
  return c;
}
function bakeFlat(img: HTMLCanvasElement, dark = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = HH * 2;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.beginPath();
  x.moveTo(HW, -0.6);
  x.lineTo(TW + 0.8, HH);
  x.lineTo(HW, HH * 2 + 0.6);
  x.lineTo(-0.8, HH);
  x.closePath();
  x.clip();
  x.setTransform(HW / 16, HH / 16, -HW / 16, HH / 16, HW, 0);
  x.drawImage(img, -0.6, -0.6, 17.2, 17.2);
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (dark) {
    x.fillStyle = `rgba(0,0,0,${dark})`;
    x.fillRect(0, 0, TW, HH * 2);
  }
  return c;
}

interface Tileset {
  floor: HTMLCanvasElement[];
  wall: HTMLCanvasElement[];
  pillar: HTMLCanvasElement;
  hazard: HTMLCanvasElement[];
  path: HTMLCanvasElement[];
  hedge: HTMLCanvasElement;
  house: HTMLCanvasElement[];
  wallH: number;
}

function makeTileset(def: LevelDef): Tileset {
  const camp = def.id === 'camp';
  const [fa, fb] = def.floor, [wa, wb] = def.wall;
  const floor = [0, 1, 2, 3].map((k) =>
    bakeFlat(texture(camp ? 'grass' : 'cobble', k === 3 && !camp ? mix(fa, def.accent, 0.18) : fa, fb, 10 + k)),
  );
  const wallH = 1.25;
  const wall = [0, 1, 2].map((k) => {
    const side = texture('brick', k === 2 ? mix(wa, def.accent, 0.15) : wa, wb, 30 + k);
    return bakeCube({ top: texture('grass', shade(wa, 0.9), shade(wa, 0.8), 40 + k), left: side, right: side, h: wallH });
  });
  const pt = texture('pillar', shade(wa, 1.05), wb, 50);
  const pillar = bakeCube({ top: texture('cobble', wa, wb, 51), left: pt, right: pt, h: 2.2 });
  const hz = def.hazard === 'lava' ? 'lava' : def.hazard === 'ice' ? 'ice' : 'water';
  const hazard = [0, 1, 2, 3].map((f) => bakeFlat(texture(hz, '#000000', '#000000', 60, f * 1.6)));
  const path = [0, 1].map((k) => bakeFlat(texture('path', '#b89a6a', '#a88a5c', 70 + k)));
  const leafA = '#3f8a3a', leafB = '#2f6e2c';
  const hedge = bakeCube({ top: texture('leaf', leafA, leafB, 80), left: texture('leaf', leafA, leafB, 81), right: texture('leaf', leafA, leafB, 82), h: 1 });
  const house = [0, 1].map((k) =>
    bakeCube({
      top: texture('roof', k ? '#3f6aa1' : '#b5483a', k ? '#2f5080' : '#8a3428', 90 + k),
      left: texture('plank', '#a0713f', '#8a5a32', 92),
      right: texture('plank', '#a0713f', '#8a5a32', 93),
      h: 2,
    }),
  );
  return { floor, wall, pillar, hazard, path, hedge, house, wallH };
}

// ---------- prop sprites ----------
function propBox(x: CanvasRenderingContext2D, cx: number, cy: number, f: Part) {
  // used only for baking small props in local screen space
  drawPart(x, cx, cy, f, 0, false);
}

/** Draws one box (in world units relative to an origin already projected to sx, sy). */
function drawPart(x: CanvasRenderingContext2D, sx: number, sy: number, p: Part, dir: number, flash: boolean, scale = 1) {
  const [f, r, z, sf, sr, sz, col] = p;
  // forward / right vectors for the 4 facings
  const F = DIRS[dir], Rv = [-F[1], F[0]];
  const cx = (F[0] * f + Rv[0] * r) * scale, cy = (F[1] * f + Rv[1] * r) * scale;
  const w = (Math.abs(F[0]) * sf + Math.abs(Rv[0]) * sr) * scale;
  const d = (Math.abs(F[1]) * sf + Math.abs(Rv[1]) * sr) * scale;
  const h = sz * scale, z0 = z * scale;
  const x0 = cx - w / 2, y0 = cy - d / 2, x1 = x0 + w, y1 = y0 + d, zt = z0 + h;
  const P = (wx: number, wy: number, wz: number): [number, number] => [sx + (wx - wy) * HW, sy + (wx + wy) * HH - wz * TZ];
  const base = flash ? '#ffffff' : col;
  const quad = (a: [number, number], b: [number, number], c: [number, number], e: [number, number], color: string) => {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(a[0], a[1]);
    x.lineTo(b[0], b[1]);
    x.lineTo(c[0], c[1]);
    x.lineTo(e[0], e[1]);
    x.closePath();
    x.fill();
  };
  quad(P(x0, y1, zt), P(x1, y1, zt), P(x1, y1, z0), P(x0, y1, z0), shade(base, 0.78));
  quad(P(x1, y0, zt), P(x1, y1, zt), P(x1, y1, z0), P(x1, y0, z0), shade(base, 0.6));
  quad(P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt), shade(base, 1));
}
/** guardians are bigger versions of a monster, washed in their dungeon's color */
export function tintParts(parts: Part[], tint: string): Part[] {
  return parts.map((p) => (p[7] ? p : ([p[0], p[1], p[2], p[3], p[4], p[5], mix(p[6], tint, 0.35)] as Part)));
}
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const dir4 = (a: number) => (((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4);

/** Draws a list of parts sorted back to front. */
export function drawModel(x: CanvasRenderingContext2D, sx: number, sy: number, parts: Part[], face: number, flash = false, scale = 1) {
  const dir = dir4(face);
  const F = DIRS[dir], Rv = [-F[1], F[0]];
  const sorted = parts
    .map((p) => ({ p, k: (F[0] * p[0] + Rv[0] * p[1] + F[1] * p[0] + Rv[1] * p[1]) * 1 + (p[2] + p[5] * 0.5) * 0.001 }))
    .sort((a, b) => a.k - b.k);
  // boxes higher up should still draw after the ones they sit on
  sorted.sort((a, b) => {
    const da = a.k - b.k;
    if (Math.abs(da) > 0.12) return da;
    return a.p[2] - b.p[2];
  });
  for (const { p } of sorted) {
    if (p[7] && !flash) {
      x.save();
      x.shadowColor = p[6];
      x.shadowBlur = 12;
      drawPart(x, sx, sy, p, dir, flash, scale);
      x.restore();
    } else drawPart(x, sx, sy, p, dir, flash, scale);
  }
}

function bakeProp(kind: Prop['kind'], v: number, def: LevelDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TW * 2;
  c.height = TW * 3;
  const x = c.getContext('2d')!;
  const ox = TW, oy = TW * 2; // the tile's center on the ground
  const parts: Part[] = [];
  switch (kind) {
    case 'crate':
      parts.push([0, 0, 0, 0.7, 0.7, 0.62, '#a0713f'], [0, 0, 0.62, 0.72, 0.72, 0.04, '#6b4626'], [0.36, 0, 0.1, 0.01, 0.7, 0.08, '#6b4626'], [0, 0.36, 0.1, 0.7, 0.01, 0.08, '#6b4626']);
      break;
    case 'barrel':
      parts.push([0, 0, 0, 0.56, 0.56, 0.7, '#7a4a28'], [0, 0, 0.1, 0.6, 0.6, 0.06, '#4a4a52'], [0, 0, 0.56, 0.6, 0.6, 0.06, '#4a4a52'], [0, 0, 0.7, 0.5, 0.5, 0.02, '#5a3418']);
      break;
    case 'chest':
      parts.push([0, 0, 0, 0.7, 0.52, 0.4, '#8a5a2b'], [0, 0, 0.4, 0.72, 0.54, 0.16, v ? '#5a3418' : '#a0713f'], [0.36, 0, 0.3, 0.02, 0.12, 0.16, '#f0c040', true], [0, 0, 0.18, 0.72, 0.54, 0.05, '#e0b040']);
      break;
    case 'torch':
      break;
    case 'shroom':
      parts.push([0, 0, 0, 0.1, 0.1, 0.22, '#efe6d0'], [0, 0, 0.22, 0.3, 0.3, 0.1, v % 2 ? '#e06ad6' : '#6ad6e0', true], [0.2, 0.2, 0, 0.06, 0.06, 0.12, '#efe6d0'], [0.2, 0.2, 0.12, 0.16, 0.16, 0.06, '#c8387a', true]);
      break;
    case 'crystal':
      parts.push([0, 0, 0, 0.16, 0.16, 0.4, '#bfefff', true], [0.16, 0.1, 0, 0.1, 0.1, 0.24, '#8fd0f0', true], [-0.12, 0.14, 0, 0.08, 0.08, 0.18, '#e6fbff', true]);
      break;
    case 'bones':
      parts.push([0, 0, 0, 0.4, 0.07, 0.05, '#ddd5c0'], [0.1, 0.1, 0, 0.07, 0.3, 0.05, '#cfc6b0'], [-0.2, -0.1, 0, 0.16, 0.16, 0.14, '#e6dfcc']);
      break;
    case 'tree': {
      const big = 1 + v * 0.15;
      parts.push([0, 0, 0, 0.3, 0.3, 1.1 * big, '#6b4424'], [0, 0, 0.9 * big, 1.1, 1.1, 0.7, '#3f8a3a'], [0, 0, 1.6 * big, 0.7, 0.7, 0.4, '#4f9a44'], [0.3, 0.3, 1.2 * big, 0.3, 0.3, 0.3, '#2f6e2c']);
      if (v === 1) parts.push([0.5, -0.1, 1.2, 0.12, 0.12, 0.12, '#e0402a']);
      break;
    }
    case 'campfire':
      parts.push([0.2, 0, 0, 0.4, 0.14, 0.12, '#6b4424'], [0, 0.2, 0.04, 0.14, 0.4, 0.12, '#5a3820'], [-0.25, -0.25, 0, 0.16, 0.16, 0.12, '#888'], [0.25, -0.25, 0, 0.16, 0.16, 0.12, '#888'], [-0.25, 0.25, 0, 0.16, 0.16, 0.12, '#888'], [0.28, 0.28, 0, 0.14, 0.14, 0.1, '#777']);
      break;
    case 'table':
      parts.push([0.3, 0.3, 0, 0.1, 0.1, 0.5, '#5a3418'], [-0.3, 0.3, 0, 0.1, 0.1, 0.5, '#5a3418'], [0.3, -0.3, 0, 0.1, 0.1, 0.5, '#5a3418'], [-0.3, -0.3, 0, 0.1, 0.1, 0.5, '#5a3418'], [0, 0, 0.5, 0.9, 0.9, 0.08, '#8a5a32'], [0, 0, 0.58, 0.74, 0.74, 0.01, '#e8d8a8'], [0.1, -0.15, 0.59, 0.12, 0.12, 0.02, '#b5483a']);
      break;
    case 'stall': {
      const awn = ['#c0392b', '#3f6aa1', '#8a3aa0'][v];
      parts.push([0, 0, 0, 0.9, 0.5, 0.5, '#8a5a32'], [0, 0, 0.5, 0.95, 0.55, 0.05, '#a0713f'], [0.4, 0.4, 0, 0.07, 0.07, 1.2, '#5a3418'], [0.4, -0.4, 0, 0.07, 0.07, 1.2, '#5a3418'], [-0.4, 0.4, 0, 0.07, 0.07, 1.2, '#5a3418'], [-0.4, -0.4, 0, 0.07, 0.07, 1.2, '#5a3418'], [0, 0, 1.2, 1, 1, 0.08, awn], [0, 0, 1.28, 0.7, 0.7, 0.06, '#f0ead8']);
      if (v === 0) parts.push([0.1, 0.15, 0.55, 0.5, 0.06, 0.04, '#b0b8c0'], [-0.1, -0.1, 0.55, 0.06, 0.4, 0.04, '#8a5a2b']);
      if (v === 1) parts.push([0.05, 0.1, 0.55, 0.22, 0.26, 0.24, '#8c939c'], [0.05, -0.22, 0.55, 0.2, 0.2, 0.12, '#9aa4ae']);
      if (v === 2) parts.push([0.05, 0.2, 0.55, 0.1, 0.1, 0.16, '#ff5a8a', true], [0.05, 0, 0.55, 0.1, 0.1, 0.16, '#5ad6ff', true], [0.05, -0.2, 0.55, 0.14, 0.14, 0.14, '#3a3a3a']);
      break;
    }
    case 'anvil':
      parts.push([0, 0, 0, 0.36, 0.3, 0.2, '#3a3a42'], [0, 0, 0.2, 0.18, 0.18, 0.12, '#3a3a42'], [0, 0, 0.32, 0.56, 0.3, 0.14, '#4a4a54']);
      break;
    case 'banner': {
      const col = v ? '#3f6aa1' : '#c0392b';
      parts.push([0, 0, 0, 0.1, 0.1, 1.8, '#5a3418'], [0.05, 0, 1.0, 0.04, 0.5, 0.7, col], [0.06, 0, 1.25, 0.04, 0.2, 0.2, '#f0c040']);
      break;
    }
    case 'door':
      parts.push([0, -0.47, 0, 0.36, 0.05, 0.74, '#5a3418'], [0, -0.48, 0.05, 0.28, 0.05, 0.62, '#7a4a28'], [0.1, -0.5, 0.34, 0.05, 0.03, 0.05, '#f0c040'], [0, -0.47, 0.74, 0.44, 0.06, 0.06, '#3a2410']);
      break;
    case 'flowers':
      parts.push([0.1, 0.1, 0, 0.08, 0.08, 0.1, ['#ff6a8a', '#ffe066', '#a06aff', '#ffffff'][v]], [-0.2, 0.05, 0, 0.08, 0.08, 0.12, ['#ffe066', '#ff6a8a', '#ffffff', '#ff9a40'][v]], [0.05, -0.22, 0, 0.08, 0.08, 0.09, '#ff9a40'], [-0.05, 0.25, 0, 0.06, 0.06, 0.07, '#ffffff']);
      break;
  }
  void def;
  const dir = 0;
  const sorted = parts.map((p) => ({ p, k: p[0] + p[1] })).sort((a, b) => (Math.abs(a.k - b.k) > 0.1 ? a.k - b.k : a.p[2] - b.p[2]));
  for (const { p } of sorted) {
    if (p[7]) {
      x.save();
      x.shadowColor = p[6];
      x.shadowBlur = 10;
      drawPart(x, ox, oy, p, dir, false);
      x.restore();
    } else propBox(x, ox, oy, p);
  }
  return c;
}

// ---------- weapon drawing (screen space, in the hero's hand) ----------
export function drawHeldWeapon(x: CanvasRenderingContext2D, hx: number, hy: number, ang: number, len: number, handle: string, blade: string, kind: string, glow = false) {
  // ang is a screen-space angle; draw a chunky pixel blade
  const ex = hx + Math.cos(ang) * len, ey = hy + Math.sin(ang) * len;
  const gx = hx + Math.cos(ang) * len * 0.28, gy = hy + Math.sin(ang) * len * 0.28;
  x.lineCap = 'square';
  x.strokeStyle = 'rgba(0,0,0,.45)';
  x.lineWidth = kind === 'battle-axe' || kind === 'thunder-hammer' ? 9 : 7;
  x.beginPath();
  x.moveTo(hx, hy);
  x.lineTo(ex, ey);
  x.stroke();
  x.strokeStyle = handle;
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(hx, hy);
  x.lineTo(gx, gy);
  x.stroke();
  if (glow) {
    x.save();
    x.shadowColor = blade;
    x.shadowBlur = 14;
  }
  x.strokeStyle = blade;
  if (kind === 'battle-axe' || kind === 'thunder-hammer') {
    x.lineWidth = 4;
    x.strokeStyle = handle;
    x.beginPath();
    x.moveTo(gx, gy);
    x.lineTo(ex, ey);
    x.stroke();
    x.fillStyle = blade;
    x.save();
    x.translate(ex, ey);
    x.rotate(ang);
    if (kind === 'battle-axe') {
      x.beginPath();
      x.moveTo(-6, -2);
      x.lineTo(4, -12);
      x.lineTo(8, 0);
      x.lineTo(4, 12);
      x.lineTo(-6, 2);
      x.fill();
    } else {
      x.fillRect(-8, -9, 16, 18);
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.fillRect(-8, 3, 16, 6);
    }
    x.restore();
  } else if (kind === 'long-spear' || kind === 'frost-glaive') {
    x.lineWidth = 3;
    x.strokeStyle = handle;
    x.beginPath();
    x.moveTo(gx, gy);
    x.lineTo(ex, ey);
    x.stroke();
    x.fillStyle = blade;
    x.save();
    x.translate(ex, ey);
    x.rotate(ang);
    x.beginPath();
    if (kind === 'long-spear') {
      x.moveTo(12, 0);
      x.lineTo(0, -4);
      x.lineTo(0, 4);
    } else {
      x.moveTo(10, 0);
      x.quadraticCurveTo(4, -12, -6, -10);
      x.lineTo(-2, 0);
      x.lineTo(-6, 4);
    }
    x.fill();
    x.restore();
  } else {
    x.lineWidth = kind === 'twin-daggers' ? 4 : 5;
    x.beginPath();
    x.moveTo(gx, gy);
    x.lineTo(ex, ey);
    x.stroke();
    // cross guard
    x.strokeStyle = '#c9a040';
    x.lineWidth = 3;
    const px = -Math.sin(ang) * 6, py = Math.cos(ang) * 6;
    x.beginPath();
    x.moveTo(gx - px, gy - py);
    x.lineTo(gx + px, gy + py);
    x.stroke();
  }
  if (glow) x.restore();
}

// ---------- the renderer ----------
export class Renderer {
  cv: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
  light: HTMLCanvasElement;
  lx: CanvasRenderingContext2D;
  tiles: Tileset | null = null;
  tilesFor = '';
  props = new Map<string, HTMLCanvasElement>();
  W = 0;
  H = 0;
  dpr = 1;
  zoom = 1;
  camX = 0;
  camY = 0;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.x = cv.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lx = this.light.getContext('2d')!;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (w * dpr !== this.cv.width || h * dpr !== this.cv.height) {
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(h * dpr);
    }
    this.dpr = dpr;
    this.W = w;
    this.H = h;
    // show roughly the same amount of dungeon on any screen
    this.zoom = Math.max(0.6, Math.min(1.5, Math.min(w / 1100, h / 700) * 1.15));
    this.light.width = Math.ceil(w / 3);
    this.light.height = Math.ceil(h / 3);
  }

  /** world → screen (css px) */
  toScreen(wx: number, wy: number, wz = 0): [number, number] {
    const sx = (wx - wy) * HW, sy = (wx + wy) * HH - wz * TZ;
    return [(sx - this.camX) * this.zoom + this.W / 2, (sy - this.camY) * this.zoom + this.H / 2];
  }
  /** screen (css px) → world on the floor */
  toWorld(px: number, py: number) {
    const sx = (px - this.W / 2) / this.zoom + this.camX, sy = (py - this.H / 2) / this.zoom + this.camY;
    const a = sx / HW, b = sy / HH;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }

  private prop(p: Prop, def: LevelDef) {
    const key = `${p.kind}:${p.kind === 'chest' ? (p.open ? 1 : 0) : (p.v ?? 0)}:${def.id}`;
    let s = this.props.get(key);
    if (!s) {
      s = bakeProp(p.kind, p.kind === 'chest' ? (p.open ? 1 : 0) : (p.v ?? 0), def);
      this.props.set(key, s);
    }
    return s;
  }

  draw(g: Game, opts: { minimap: boolean; title?: boolean }) {
    const x = this.x;
    const def = g.def;
    if (this.tilesFor !== def.id) {
      this.tiles = makeTileset(def);
      this.tilesFor = def.id;
    }
    const ts = this.tiles!;
    const L = g.L;
    const camp = g.mode === 'camp';
    // camera follows the hero, with a little shake
    const [hsx, hsy] = [(g.x - g.y) * HW, (g.x + g.y) * HH - 0.5 * TZ];
    const sh = g.shake * 6;
    this.camX = hsx + (Math.random() - 0.5) * sh;
    this.camY = hsy + (Math.random() - 0.5) * sh;
    const z = this.zoom * this.dpr;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = camp ? '#2c5a26' : def.ambient;
    x.fillRect(0, 0, this.cv.width, this.cv.height);
    x.setTransform(z, 0, 0, z, this.W / 2 * this.dpr - this.camX * z, this.H / 2 * this.dpr - this.camY * z);
    x.imageSmoothingEnabled = false;

    // visible tile range
    const c0 = this.toWorld(0, 0), c1 = this.toWorld(this.W, 0), c2 = this.toWorld(0, this.H), c3 = this.toWorld(this.W, this.H);
    const minX = Math.max(0, Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - 2), maxX = Math.min(L.w - 1, Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + 3);
    const minY = Math.max(0, Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - 2), maxY = Math.min(L.h - 1, Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + 3);
    const frame = Math.floor(g.time * 3) % 4;
    const seen = (tx: number, ty: number) => camp || L.explored[ty * L.w + tx] === 1;

    // 1. floors
    for (let ty = minY; ty <= maxY; ty++)
      for (let tx = minX; tx <= maxX; tx++) {
        const t = L.tiles[ty * L.w + tx];
        if (!seen(tx, ty)) continue;
        const sx = (tx - ty) * HW - HW, sy = (tx + ty) * HH;
        const v = L.vary[ty * L.w + tx];
        if (t === T.FLOOR || t === T.PORTAL) x.drawImage(ts.floor[v % 7 === 0 ? 3 : v % 3], sx, sy);
        else if (t === T.PATH) x.drawImage(ts.path[v % 2], sx, sy);
        else if (t === T.HAZARD) x.drawImage(ts.hazard[(frame + v) % 4], sx, sy);
      }

    // warning circles, bomb shadows and rings sit on the floor
    for (const w of g.warns) this.floorCircle(w.x, w.y, w.r, `rgba(255,60,60,${0.18 + 0.25 * (1 - w.t / w.total)})`, 'rgba(255,90,90,.9)');
    if (g.L.portal.open) this.portal(g);
    // swing arc
    if (g.swingT > 0) this.swingArc(g);

    // 2. everything with height, sorted back to front
    type D = { k: number; f: () => void };
    const list: D[] = [];
    const heroK = g.x + g.y;
    for (let ty = minY; ty <= maxY; ty++)
      for (let tx = minX; tx <= maxX; tx++) {
        const t = L.tiles[ty * L.w + tx];
        if (t === T.FLOOR || t === T.VOID || t === T.PATH || t === T.HAZARD || t === T.PORTAL) continue;
        if (!camp && !this.nearSeen(L, tx, ty)) continue;
        const v = L.vary[ty * L.w + tx];
        const spr = t === T.WALL ? ts.wall[v % 9 === 0 ? 2 : v % 2] : t === T.PILLAR ? ts.pillar : t === T.HEDGE ? ts.hedge : ts.house[tx > 16 && ty < 8 ? 1 : 0];
        const hgt = t === T.WALL ? ts.wallH : t === T.PILLAR ? 2.2 : t === T.HOUSE ? 2 : 1;
        const k = tx + ty + 1;
        // fade walls that hide the hero
        const front = k > heroK && k - heroK < 3.2 && Math.abs(tx - ty - (g.x - g.y)) < 2.2;
        list.push({
          k,
          f: () => {
            if (front) x.globalAlpha = 0.35;
            x.drawImage(spr, (tx - ty) * HW - HW, (tx + ty) * HH - hgt * TZ);
            x.globalAlpha = 1;
          },
        });
      }
    for (const p of L.props) {
      if (p.hp <= 0 || (!camp && !seen(p.x, p.y))) continue;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      if (p.kind === 'torch') {
        list.push({ k: p.x + p.y + 1.05, f: () => this.torch(p, g.time) });
        continue;
      }
      const spr = this.prop(p, def);
      list.push({ k: p.x + p.y + 1, f: () => x.drawImage(spr, (p.x - p.y) * HW - TW, (p.x + p.y + 1) * HH - TW * 2) });
      if (p.kind === 'campfire') list.push({ k: p.x + p.y + 1.01, f: () => this.flame(p.x + 0.5, p.y + 0.5, g.time, 1) });
    }
    if (camp)
      for (const t of TRADERS)
        list.push({
          k: t.x + t.y,
          f: () => {
            const [sx, sy] = this.iso(t.x, t.y);
            this.shadow(t.x, t.y, 0.32);
            const face = Math.atan2(g.y - t.y, g.x - t.x);
            drawModel(x, sx, sy, traderParts(t, Math.abs(Math.sin(g.time * 2 + t.x)) * 0.02), Math.hypot(g.y - t.y, g.x - t.x) < 4 ? face : Math.PI / 2);
          },
        });
    for (const d of g.drops) list.push({ k: d.x + d.y, f: () => this.drop(d.kind, d.x, d.y, g.time + d.x) });
    for (const m of g.monsters) if (seen(Math.floor(m.x), Math.floor(m.y))) list.push({ k: m.x + m.y, f: () => this.monster(m, g) });
    if (!g.dead || g.deadT < 0.6) list.push({ k: heroK, f: () => this.hero(g) });
    for (const s of g.shots) list.push({ k: s.x + s.y, f: () => this.shot(s.x, s.y, s.z, s.vx, s.vy, s.kind, g) });
    for (const b of g.bombs) list.push({ k: b.x + b.y, f: () => this.bomb(b.x, b.y, b.t, b.fuse) });
    list.sort((a, b) => a.k - b.k);
    for (const d of list) d.f();

    // 3. particles and rings
    for (const p of g.parts) {
      const [sx, sy] = this.iso(p.x, p.y, p.z);
      x.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      x.fillStyle = p.color;
      const s = p.size * TW * 0.5;
      x.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    x.globalAlpha = 1;
    for (const r of g.rings) this.floorCircle(r.x, r.y, r.r, 'rgba(0,0,0,0)', r.color, 4 * (r.life / r.total) + 1);

    // 4. light
    if (!camp && !opts.title) this.lighting(g);
    else if (!camp) this.lighting(g);
    x.setTransform(z, 0, 0, z, this.W / 2 * this.dpr - this.camX * z, this.H / 2 * this.dpr - this.camY * z);

    // 5. health bars and floating numbers
    x.textAlign = 'center';
    for (const m of g.monsters) {
      if (m.guardian || !m.awake || m.hp >= m.maxHp) continue;
      const [sx, sy] = this.iso(m.x, m.y, (m.kind === 'rustknight' ? 1.5 : m.kind === 'sporecap' ? 1.05 : 1.1) * m.scale);
      x.fillStyle = 'rgba(0,0,0,.6)';
      x.fillRect(sx - 17, sy - 4, 34, 6);
      x.fillStyle = '#e8404a';
      x.fillRect(sx - 16, sy - 3, 32 * Math.max(0, m.hp / m.maxHp), 4);
    }
    x.font = 'bold 15px ui-rounded, system-ui, sans-serif';
    for (const f of g.floats) {
      const [sx, sy] = this.iso(f.x, f.y, f.z);
      x.globalAlpha = Math.min(1, f.life * 2);
      x.fillStyle = 'rgba(0,0,0,.6)';
      x.fillText(f.text, sx + 1.5, sy + 1.5);
      x.fillStyle = f.color;
      x.fillText(f.text, sx, sy);
    }
    x.globalAlpha = 1;
    // use prompt over what you can use
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (g.hurtT > 0.25) {
      x.fillStyle = `rgba(200,0,0,${(g.hurtT - 0.25) * 0.8})`;
      x.fillRect(0, 0, this.cv.width, this.cv.height);
    }
    if (opts.minimap && !camp) this.minimap(g);
  }

  iso(wx: number, wy: number, wz = 0): [number, number] {
    return [(wx - wy) * HW, (wx + wy) * HH - wz * TZ];
  }

  private nearSeen(L: Level, tx: number, ty: number) {
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const xx = tx + i, yy = ty + j;
        if (xx >= 0 && yy >= 0 && xx < L.w && yy < L.h && L.explored[yy * L.w + xx]) return true;
      }
    return false;
  }

  private shadow(wx: number, wy: number, r: number) {
    const [sx, sy] = this.iso(wx, wy);
    this.x.fillStyle = 'rgba(0,0,0,.28)';
    this.x.beginPath();
    this.x.ellipse(sx, sy, r * HW * 1.4, r * HH * 1.4, 0, 0, Math.PI * 2);
    this.x.fill();
  }

  private floorCircle(wx: number, wy: number, r: number, fill: string, stroke: string, lw = 2) {
    const [sx, sy] = this.iso(wx, wy);
    const x = this.x;
    x.beginPath();
    x.ellipse(sx, sy, r * HW * Math.SQRT2, r * HH * Math.SQRT2, 0, 0, Math.PI * 2);
    x.fillStyle = fill;
    x.fill();
    x.strokeStyle = stroke;
    x.lineWidth = lw;
    x.stroke();
  }

  private swingArc(g: Game) {
    const w = g.melee;
    const k = 1 - g.swingT / g.swingDur;
    const x = this.x;
    const [sx, sy] = this.iso(g.x, g.y, 0.05);
    x.save();
    x.translate(sx, sy);
    x.scale(1, 0.5);
    x.rotate(Math.PI / 4);
    const R = w.reach * HW * Math.SQRT2;
    const half = (Math.min(w.arc, 359) * Math.PI) / 360;
    x.globalAlpha = 0.5 * (1 - k);
    x.fillStyle = g.save.melee === 'ember-blade' ? '#ff8a3a' : g.save.melee === 'frost-glaive' ? '#aee8ff' : g.save.melee === 'thunder-hammer' ? '#ffe066' : '#ffffff';
    x.beginPath();
    x.moveTo(0, 0);
    x.arc(0, 0, R, g.face - half, g.face - half + half * 2 * Math.min(1, k * 1.6));
    x.closePath();
    x.fill();
    x.restore();
    x.globalAlpha = 1;
  }

  private portal(g: Game) {
    const P = g.L.portal;
    const x = this.x;
    const [sx, sy] = this.iso(P.x + 0.5, P.y + 0.5);
    const t = g.time;
    x.save();
    for (let i = 0; i < 3; i++) {
      x.globalAlpha = 0.5 - i * 0.12;
      x.fillStyle = i ? g.def.accent : '#ffffff';
      x.beginPath();
      x.ellipse(sx, sy, HW * (0.9 - i * 0.25 + Math.sin(t * 3 + i) * 0.06), HH * (0.9 - i * 0.25), 0, 0, Math.PI * 2);
      x.fill();
    }
    // a beam of light
    const grd = x.createLinearGradient(0, sy - TZ * 3, 0, sy);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(1, g.def.accent);
    x.globalAlpha = 0.45 + Math.sin(t * 4) * 0.1;
    x.fillStyle = grd;
    x.fillRect(sx - HW * 0.6, sy - TZ * 3, HW * 1.2, TZ * 3);
    x.restore();
    if (Math.random() < 0.3) g.parts.push({ x: P.x + 0.2 + Math.random() * 0.6, y: P.y + 0.2 + Math.random() * 0.6, z: 0, vx: 0, vy: 0, vz: 2.5, life: 0.8, max: 0.8, color: g.def.accent, size: 0.06 });
  }

  private torch(p: Prop, t: number) {
    // on the inner face of the wall block: just above it
    const x = this.x;
    const wx = p.x + 0.5, wy = p.y + 1.02;
    const [sx, sy] = this.iso(wx, wy, 0.9);
    x.fillStyle = '#5a3418';
    x.fillRect(sx - 2, sy - 2, 4, 12);
    this.flame(wx, wy, t, 0.5, 1.05);
    void sx;
  }

  private flame(wx: number, wy: number, t: number, s: number, z = 0.12) {
    const x = this.x;
    const [sx, sy] = this.iso(wx, wy, z);
    const f = Math.sin(t * 13 + wx * 7) * 0.12;
    x.save();
    x.shadowColor = '#ffb347';
    x.shadowBlur = 18;
    x.fillStyle = '#ff7a1a';
    x.fillRect(sx - 7 * s, sy - (18 + f * 20) * s, 14 * s, (18 + f * 20) * s);
    x.fillStyle = '#ffd040';
    x.fillRect(sx - 4 * s, sy - (13 + f * 14) * s, 8 * s, (13 + f * 14) * s);
    x.fillStyle = '#fff6c0';
    x.fillRect(sx - 2 * s, sy - 6 * s, 4 * s, 6 * s);
    x.restore();
  }

  private drop(kind: string, wx: number, wy: number, t: number) {
    const x = this.x;
    const bob = Math.abs(Math.sin(t * 4)) * 0.12 + 0.1;
    this.shadow(wx, wy, 0.12);
    const [sx, sy] = this.iso(wx, wy, bob);
    x.save();
    if (kind === 'coin') {
      x.shadowColor = '#ffe066';
      x.shadowBlur = 8;
      const w = Math.abs(Math.cos(t * 3)) * 7 + 2;
      x.fillStyle = '#c8901a';
      x.fillRect(sx - w, sy - 8, w * 2, 12);
      x.fillStyle = '#ffd84a';
      x.fillRect(sx - w + 1.5, sy - 7, w * 2 - 3, 10);
    } else if (kind === 'potion') {
      x.fillStyle = '#e8e0d0';
      x.fillRect(sx - 3, sy - 16, 6, 5);
      x.fillStyle = '#ff4a7a';
      x.shadowColor = '#ff4a7a';
      x.shadowBlur = 10;
      x.fillRect(sx - 7, sy - 11, 14, 13);
    } else {
      x.strokeStyle = '#d8c8a0';
      x.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        x.beginPath();
        x.moveTo(sx - 9 + i * 3, sy + 2);
        x.lineTo(sx + 9 + i * 3, sy - 12);
        x.stroke();
      }
      x.fillStyle = '#e8e8f0';
      x.fillRect(sx + 7, sy - 15, 5, 5);
    }
    x.restore();
  }

  private hero(g: Game) {
    const x = this.x;
    const a = g.armor;
    this.shadow(g.x, g.y, 0.3);
    const [sx, sy] = this.iso(g.x, g.y, g.rollT > 0 ? -0.1 : 0);
    const parts = heroParts({ armor: a.color, trim: a.trim, walk: g.walk, moving: g.moving });
    if (g.rollT > 0) {
      // tuck into a ball-ish block
      x.save();
      x.globalAlpha = 0.85;
      drawModel(x, sx, sy + 8, parts.map((p) => [p[0] * 0.7, p[1] * 0.7, p[2] * 0.55, p[3], p[4], p[5] * 0.7, p[6]] as Part), g.walk, false);
      x.restore();
      return;
    }
    const flicker = g.hurtT > 0 && Math.floor(g.time * 20) % 2 === 0;
    const dir = dir4(g.face);
    // which side the weapon hand is on, in screen space
    const fx = Math.cos(g.face), fy = Math.sin(g.face);
    const scrA = Math.atan2((fx + fy) * HH, (fx - fy) * HW);
    const handBehind = dir === 2 || dir === 3;
    const weapon = () => this.heroWeapon(g, sx, sy, scrA);
    if (handBehind) weapon();
    drawModel(x, sx, sy, parts, g.face, flicker);
    if (!handBehind) weapon();
  }

  private heroWeapon(g: Game, sx: number, sy: number, scrA: number) {
    const x = this.x;
    const id = g.save.melee;
    const w = g.melee;
    const hy = sy - TZ * 0.45;
    if (g.drawT > 0 || (g.rangedCd > 0 && g.rangedCd > g.ranged.rate - 0.25)) {
      // bow out, pointing where you aim
      const bx = sx + Math.cos(scrA) * 14, by = hy + Math.sin(scrA) * 8;
      x.save();
      x.translate(bx, by);
      x.rotate(scrA);
      x.strokeStyle = g.ranged.color;
      x.lineWidth = 4;
      x.beginPath();
      if (g.save.ranged === 'crossbow') {
        x.moveTo(-10, 0);
        x.lineTo(10, 0);
        x.moveTo(6, -11);
        x.lineTo(6, 11);
      } else x.arc(-6, 0, 14, -1.1, 1.1);
      x.stroke();
      x.strokeStyle = '#e8e0d0';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(0, -12);
      x.lineTo(-8 + (g.drawT > 0 ? -4 : 0), 0);
      x.lineTo(0, 12);
      x.stroke();
      x.restore();
      return;
    }
    const len = 18 + Math.min(2.3, w.reach) * 10;
    let ang = scrA - 1.1;
    if (g.swingT > 0) {
      const k = 1 - g.swingT / g.swingDur;
      const half = Math.min(w.arc, 220) * (Math.PI / 360);
      ang = id === 'long-spear' ? scrA : scrA - half + half * 2 * k;
      if (id === 'thunder-hammer') ang = scrA - 2.2 + 2.2 * k;
    }
    const reachOut = g.swingT > 0 && id === 'long-spear' ? 10 * Math.sin((1 - g.swingT / g.swingDur) * Math.PI) : 0;
    const hx = sx + Math.cos(scrA + 1.2) * 10 + Math.cos(scrA) * reachOut, hyy = hy + Math.sin(scrA + 1.2) * 5;
    drawHeldWeapon(x, hx, hyy, ang, len, w.color, w.blade, id, w.effect === 'burn' || w.effect === 'slow');
    if (id === 'twin-daggers') drawHeldWeapon(x, sx - Math.cos(scrA + 1.2) * 10, hy - Math.sin(scrA + 1.2) * 5, ang + 2.2, len * 0.9, w.color, w.blade, id);
  }

  private monster(m: Monster, g: Game) {
    const x = this.x;
    const flier = m.kind === 'gloomwing' || m.kind === 'frost-wisp';
    this.shadow(m.x, m.y, m.def.radius * m.scale * (flier ? 0.7 : 1));
    const [sx, sy] = this.iso(m.x, m.y);
    let parts = monsterParts(m.kind, g.time + m.id, m.walk, m.state);
    if (m.guardian && m.kind !== 'hollow-crown') parts = tintParts(parts, g.def.accent);
    if (m.state === 'wind' || m.state === 'special') {
      // glow red while winding up a hit
      x.save();
      x.shadowColor = '#ff2020';
      x.shadowBlur = 16;
      drawModel(x, sx, sy, parts, m.face, m.flash > 0, m.scale);
      x.restore();
    } else drawModel(x, sx, sy, parts, m.face, m.flash > 0, m.scale);
    if (m.stunT > 0) {
      const [a, b] = this.iso(m.x, m.y, 1.2 * m.scale);
      x.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        const ang = g.time * 6 + (i * Math.PI * 2) / 3;
        x.fillRect(a + Math.cos(ang) * 12 - 2, b + Math.sin(ang) * 5 - 2, 5, 5);
      }
    }
    if (m.slowT > 0) {
      x.globalAlpha = 0.25;
      x.fillStyle = '#aee8ff';
      const [a, b] = this.iso(m.x, m.y, 0.4 * m.scale);
      x.fillRect(a - 14 * m.scale, b - 14 * m.scale, 28 * m.scale, 28 * m.scale);
      x.globalAlpha = 1;
    }
  }

  private shot(wx: number, wy: number, wz: number, vx: number, vy: number, kind: string, g: Game) {
    const x = this.x;
    const [sx, sy] = this.iso(wx, wy, wz);
    const l = Math.hypot(vx, vy) || 1;
    const dx = ((vx - vy) / l) * HW, dy = ((vx + vy) / l) * HH;
    x.save();
    if (kind === 'arrow' || kind === 'bolt' || kind === 'star') {
      if (kind === 'star') {
        x.shadowColor = '#fff3a0';
        x.shadowBlur = 14;
      }
      x.strokeStyle = kind === 'star' ? '#fff8d0' : '#d8c8a0';
      x.lineWidth = kind === 'bolt' ? 4 : 3;
      x.beginPath();
      x.moveTo(sx - dx * 0.5, sy - dy * 0.5);
      x.lineTo(sx + dx * 0.25, sy + dy * 0.25);
      x.stroke();
      x.fillStyle = kind === 'star' ? '#ffffff' : '#c0c8d0';
      x.fillRect(sx + dx * 0.25 - 2.5, sy + dy * 0.25 - 2.5, 5, 5);
    } else {
      const col = g.shotColor(kind as 'ember');
      x.shadowColor = col;
      x.shadowBlur = 14;
      x.fillStyle = col;
      const s = kind === 'spore' ? 10 + Math.sin(g.time * 10) * 2 : 8;
      x.fillRect(sx - s / 2, sy - s / 2, s, s);
      x.fillStyle = '#ffffff';
      x.fillRect(sx - 2, sy - 2, 4, 4);
    }
    x.restore();
  }

  private bomb(wx: number, wy: number, t: number, fuse: number) {
    const x = this.x;
    const k = Math.min(1, t / 0.45);
    const z = Math.sin(k * Math.PI) * 1.4 + 0.15;
    this.shadow(wx, wy, 0.15);
    const [sx, sy] = this.iso(wx, wy, z);
    x.fillStyle = '#2a2a33';
    x.fillRect(sx - 8, sy - 8, 16, 16);
    x.fillStyle = Math.floor(t * (fuse - t < 0.4 ? 20 : 8)) % 2 ? '#ff4040' : '#ffe066';
    x.fillRect(sx - 3, sy - 13, 6, 6);
  }

  private lighting(g: Game) {
    const lx = this.lx, L = g.L;
    const lw = this.light.width, lh = this.light.height;
    const s = lw / this.W;
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, lw, lh);
    lx.fillStyle = `rgba(0,0,0,${g.def.light})`;
    lx.fillRect(0, 0, lw, lh);
    lx.globalCompositeOperation = 'destination-out';
    const hole = (wx: number, wy: number, r: number, a = 1) => {
      const [px, py] = this.toScreen(wx, wy, 0.4);
      const R = r * HW * this.zoom * s * 1.5;
      if (px * s < -R || py * s < -R || px * s > lw + R || py * s > lh + R) return;
      const gr = lx.createRadialGradient(px * s, py * s, 0, px * s, py * s, R);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.65})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = gr;
      lx.fillRect(px * s - R, py * s - R, R * 2, R * 2);
    };
    hole(g.x, g.y, 6.5);
    for (const p of L.props) {
      if (p.kind === 'torch') hole(p.x + 0.5, p.y + 1, 3.6 + Math.sin(g.time * 9 + p.x) * 0.15, 0.85);
      else if ((p.kind === 'shroom' || p.kind === 'crystal') && p.hp > 0) hole(p.x + 0.5, p.y + 0.5, 1.6, 0.5);
    }
    if (L.portal.open) hole(L.portal.x + 0.5, L.portal.y + 0.5, 4, 1);
    for (const sh of g.shots) if (sh.from === 'monster' || sh.kind === 'star') hole(sh.x, sh.y, 1.2, 0.6);
    for (const m of g.monsters) if (m.kind === 'lantern-monk' || m.kind === 'frost-wisp' || m.kind === 'cinder-hound' || m.kind === 'hollow-crown') hole(m.x, m.y, 1.8 * m.scale, 0.6);
    if (g.def.hazard === 'lava') {
      const cx = Math.floor(g.x), cy = Math.floor(g.y);
      for (let y = cy - 9; y <= cy + 9; y++)
        for (let x = cx - 9; x <= cx + 9; x++) if (tileAt(L, x, y) === T.HAZARD && L.explored[y * L.w + x]) hole(x + 0.5, y + 0.5, 1.4, 0.45);
    }
    for (const r of g.rings) hole(r.x, r.y, r.max, 0.5 * (r.life / r.total));
    lx.globalCompositeOperation = 'source-over';
    const x = this.x;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.light, 0, 0, this.cv.width, this.cv.height);
    // a soft tint of the level's color
    x.globalCompositeOperation = 'soft-light';
    x.fillStyle = g.def.accent;
    x.globalAlpha = 0.12;
    x.fillRect(0, 0, this.cv.width, this.cv.height);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.imageSmoothingEnabled = false;
  }

  /** The dungeon map, drawn as a diamond so it matches the view. */
  drawMap(x: CanvasRenderingContext2D, g: Game, w: number, h: number, full: boolean) {
    const L = g.L;
    const cell = full ? Math.min(w / (L.w + L.h) * 2, h / (L.w + L.h) * 4) * 0.95 : 6;
    const P = (tx: number, ty: number): [number, number] => {
      if (full) return [w / 2 + (tx - ty - (L.w - L.h) / 2) * cell * 0.5, h / 2 + (tx + ty - (L.w + L.h) / 2) * cell * 0.25];
      return [w / 2 + (tx - g.x - (ty - g.y)) * cell * 0.5, h / 2 + (tx - g.x + ty - g.y) * cell * 0.25];
    };
    x.save();
    for (let ty = 0; ty < L.h; ty++)
      for (let tx = 0; tx < L.w; tx++) {
        if (!L.explored[ty * L.w + tx]) continue;
        const t = L.tiles[ty * L.w + tx];
        if (t === T.VOID) continue;
        const [px, py] = P(tx, ty);
        if (px < -cell || py < -cell || px > w + cell || py > h + cell) continue;
        x.fillStyle = t === T.WALL || t === T.PILLAR ? shade(g.def.wall[0], 0.95) : t === T.HAZARD ? (g.def.hazard === 'lava' ? '#e0581a' : g.def.hazard === 'ice' ? '#cfefff' : '#2e6a9a') : shade(g.def.floor[0], 0.75);
        x.beginPath();
        x.moveTo(px, py - cell * 0.25);
        x.lineTo(px + cell * 0.5, py);
        x.lineTo(px, py + cell * 0.25);
        x.lineTo(px - cell * 0.5, py);
        x.fill();
      }
    const dot = (tx: number, ty: number, col: string, r: number, outline = '#000') => {
      const [px, py] = P(tx, ty);
      x.fillStyle = outline;
      x.fillRect(px - r - 1, py - r - 1, r * 2 + 2, r * 2 + 2);
      x.fillStyle = col;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    };
    const big = full ? 1.6 : 1;
    for (const p of L.props) if (p.kind === 'chest' && L.explored[p.y * L.w + p.x]) dot(p.x + 0.5, p.y + 0.5, p.open ? '#7a6a4a' : '#ffd040', 2.5 * big);
    if (L.portal.open) dot(L.portal.x + 0.5, L.portal.y + 0.5, g.def.accent, 3.5 * big, '#fff');
    for (const m of g.monsters) if (m.awake && L.explored[Math.floor(m.y) * L.w + Math.floor(m.x)]) dot(m.x, m.y, m.guardian ? '#ff3a5a' : '#e05050', (m.guardian ? 3.5 : 1.6) * big);
    const boss = L.rooms[L.bossRoom];
    if (full && boss && L.explored[boss.cy * L.w + boss.cx] && !L.portal.open) {
      const [px, py] = P(boss.cx + 0.5, boss.cy + 0.5);
      x.font = `${Math.round(14 * big)}px sans-serif`;
      x.textAlign = 'center';
      x.fillText('💀', px, py + 5);
    }
    dot(g.x, g.y, '#ffffff', 3 * big, '#2a6aff');
    x.restore();
  }

  private minimap(g: Game) {
    const x = this.x;
    const size = Math.round(Math.min(190, this.W * 0.3));
    const px = (this.W - size - 10) * this.dpr, py = 58 * this.dpr;
    x.save();
    x.setTransform(this.dpr, 0, 0, this.dpr, px, py);
    x.fillStyle = 'rgba(10,8,14,.7)';
    x.strokeStyle = 'rgba(255,220,150,.5)';
    x.lineWidth = 2;
    x.beginPath();
    x.roundRect(0, 0, size, size * 0.62, 10);
    x.fill();
    x.stroke();
    x.clip();
    this.drawMap(x, g, size, size * 0.62, false);
    x.restore();
  }
}

/** Renders a standalone portrait of a model into a small canvas (shop and gear screens). */
export function portrait(parts: Part[], face: number, w: number, h: number, scale = 1, zoom = 1.6): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const x = c.getContext('2d')!;
  x.setTransform(dpr * zoom, 0, 0, dpr * zoom, (w * dpr) / 2, h * dpr * 0.86);
  drawModel(x, 0, 0, parts, face, false, scale);
  return c;
}

export { heroParts, traderParts, monsterParts, LEVELS };
