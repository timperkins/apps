// The build menu's pictures: each building or unit drawn big and close up,
// like a photo taken in the field, in front of its own landscape from the
// game (meadow, pine forest, rocky ridge, lakeshore, dusk, ore field, dry
// highlands or a smoky battlefield), with a little action: dust kicked up,
// smoke rising, tracers, a spinning rotor.
//
// The landscape is painted at half the picture's resolution (chunky, and
// dimmed a little) and the game's own trees, rocks and ore are stood in it,
// so the subject, drawn crisp at full resolution with a dark outline, stands
// out in front.
import { RGB, hash2, hex, mix, rng, shade } from '../gfx';
import type { OreArt } from './sprites';
import type { StackSprite } from './stack';

export const CAMEO_W = 240;
export const CAMEO_H = 180;
const LW = CAMEO_W / 2;
const LH = CAMEO_H / 2;

export type Scene = 'meadow' | 'forest' | 'ridge' | 'lake' | 'dusk' | 'ore' | 'dry' | 'battle';

// Which landscape each picture gets: neighbors on the menu all differ.
export const SCENES: Record<string, Scene> = {
  power: 'dusk',
  barracks: 'forest',
  refinery: 'ore',
  silo: 'dry',
  factory: 'battle',
  radar: 'ridge',
  helipad: 'lake',
  lab: 'meadow',
  tower: 'forest',
  inf: 'battle',
  rocket: 'dusk',
  gren: 'ridge',
  buggy: 'dry',
  light: 'meadow',
  hauler: 'ore',
  arty: 'ridge',
  heavy: 'battle',
  heli: 'lake',
  mcv: 'forest',
};

interface SceneDef {
  sky: [RGB, RGB]; // top, horizon
  far: RGB; // distant hills
  mid: RGB; // nearer hills
  ground: [RGB, RGB]; // foreground, light and dark
  horizon: number; // where the land starts, as a share of the height
  clouds?: RGB;
  sun?: RGB;
  far2?: 'mesa' | 'peaks' | 'hills';
  water?: boolean;
}

const DEFS: Record<Scene, SceneDef> = {
  meadow: { sky: [hex('#5d97cf'), hex('#c4e2ee')], far: hex('#7b9cb0'), mid: hex('#4f7d3b'), ground: [hex('#4f8236'), hex('#3d6a2c')], horizon: 0.5, clouds: hex('#f4f6f2'), far2: 'hills' },
  forest: { sky: [hex('#86a8b8'), hex('#dbe6dc')], far: hex('#5f7f70'), mid: hex('#2f4d31'), ground: [hex('#45703a'), hex('#34592c')], horizon: 0.46, far2: 'hills' },
  ridge: { sky: [hex('#7393bf'), hex('#e6d9c2')], far: hex('#8d887a'), mid: hex('#6c675a'), ground: [hex('#5f7c3d'), hex('#4b6631')], horizon: 0.52, clouds: hex('#efe9df'), far2: 'peaks' },
  lake: { sky: [hex('#4f92d0'), hex('#d4ecf6')], far: hex('#6c8e7c'), mid: hex('#3f78a8'), ground: [hex('#d5c189'), hex('#b9a46e')], horizon: 0.44, clouds: hex('#ffffff'), water: true, far2: 'hills' },
  dusk: { sky: [hex('#2c2a55'), hex('#f39550')], far: hex('#4b3a5e'), mid: hex('#2c3529'), ground: [hex('#3c4d2c'), hex('#2c3a22')], horizon: 0.55, sun: hex('#ffd77e'), far2: 'hills' },
  ore: { sky: [hex('#9fb0c2'), hex('#f0dfb4')], far: hex('#9b8a68'), mid: hex('#7c6a48'), ground: [hex('#7b6340'), hex('#5f4a2c')], horizon: 0.5, far2: 'mesa' },
  dry: { sky: [hex('#86b0d6'), hex('#f3e3bd')], far: hex('#b38d5e'), mid: hex('#987650'), ground: [hex('#b99b63'), hex('#9f8453')], horizon: 0.52, clouds: hex('#fbf3e2'), far2: 'mesa' },
  battle: { sky: [hex('#454543'), hex('#a28e76')], far: hex('#5d5952'), mid: hex('#403d37'), ground: [hex('#4b4732'), hex('#3a3627')], horizon: 0.5, far2: 'hills' },
};

export interface CameoProps {
  trees: StackSprite[];
  rocks: StackSprite[];
  bushes: StackSprite[];
  ore: OreArt;
}

// A subject to put in the picture: its image, drawn at the size it is shown,
// and how it should sit.
export interface Subject {
  img: HTMLCanvasElement;
  kind: 'building' | 'vehicle' | 'air' | 'portrait';
  rotor?: [number, number]; // a rotor hub, in image pixels
}

// Trim an image to its solid pixels: [x, y, w, h].
export function trimBox(img: HTMLCanvasElement): [number, number, number, number] {
  const c = img.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = img;
  const px = c.getImageData(0, 0, w, h).data;
  let l = w, r = -1, t = h, b = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 200) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
  if (r < l) return [0, 0, w, h];
  return [l, t, r - l + 1, b - t + 1];
}

// How big the subject should be drawn, in image pixels per picture pixel, so
// that it fills the picture and runs off its edges a little.
export function cameoFit(kind: Subject['kind'], tw: number, th: number): number {
  if (kind === 'portrait') return (CAMEO_H * 1.18) / th;
  if (kind === 'air') return Math.min((CAMEO_W * 1.0) / tw, (CAMEO_H * 0.86) / th);
  return Math.min((CAMEO_W * 1.04) / tw, (CAMEO_H * 0.92) / th);
}

function painter(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(w, h);
  const d = img.data;
  const set = (x: number, y: number, col: RGB, a = 1) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    d[i] += (col[0] - d[i]) * a;
    d[i + 1] += (col[1] - d[i + 1]) * a;
    d[i + 2] += (col[2] - d[i + 2]) * a;
    d[i + 3] = 255;
  };
  return { cv, c, set, flush: () => c.putImageData(img, 0, 0) };
}

// A ragged line of hills: the height at x.
function ridgeLine(seed: number, base: number, amp: number, kind: 'hills' | 'peaks' | 'mesa') {
  const r = rng(seed);
  const waves = [0, 1, 2, 3].map(() => ({ f: 0.02 + r() * 0.07, p: r() * 7, a: 0.4 + r() * 0.6 }));
  return (x: number) => {
    let s = 0;
    for (const wv of waves) s += Math.sin(x * wv.f + wv.p) * wv.a;
    s /= 2.2;
    if (kind === 'peaks') s = 1 - Math.abs(s) * 2.2;
    if (kind === 'mesa') s = s > 0.1 ? 0.55 : s < -0.3 ? -0.4 : s;
    return base - s * amp;
  };
}

// Paint the far part of the landscape (sky, hills, the ground's color) at
// half resolution.
function paintLand(scene: Scene, seed: number): HTMLCanvasElement {
  const D = DEFS[scene];
  const p = painter(LW, LH);
  const hz = Math.round(LH * D.horizon);
  const r = rng(seed * 31 + 7);
  // sky: bands with a dither between them
  for (let y = 0; y < LH; y++)
    for (let x = 0; x < LW; x++) {
      const t = Math.min(1, y / (hz + 4));
      const band = Math.floor(t * 7);
      const frac = t * 7 - band;
      const dith = ((x + y) & 1 ? 0.25 : 0.75) < frac ? 1 : 0;
      p.set(x, y, mix(D.sky[0], D.sky[1], Math.min(1, (band + dith) / 7)));
    }
  // a low sun with a glow
  if (D.sun) {
    const sx = LW * (0.62 + r() * 0.2);
    const sy = hz - 6;
    for (let y = 0; y < LH; y++)
      for (let x = 0; x < LW; x++) {
        const dd = Math.hypot(x - sx, (y - sy) * 1.2);
        if (dd < 9) p.set(x, y, dd < 7 ? D.sun : shade(D.sun, -0.1));
        else if (dd < 26 && ((x + y) & 1 || dd < 16)) p.set(x, y, D.sun, 0.18);
      }
  }
  // clouds: lumpy, flat-bottomed
  if (D.clouds) {
    const n = 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const cx = r() * LW;
      const cy = 6 + r() * (hz * 0.45);
      const len = 14 + r() * 18;
      for (let i = 0; i < 6; i++) {
        const bx = cx + (i / 5 - 0.5) * len;
        const br = 2.5 + Math.sin((i / 5) * Math.PI) * 4 * (0.7 + r() * 0.5);
        for (let y = -br; y <= 1; y++)
          for (let x = -br * 1.4; x <= br * 1.4; x++)
            if ((x / 1.4) ** 2 + y * y <= br * br) p.set(bx + x, cy + y, y < -br * 0.5 ? D.clouds : shade(D.clouds, -0.08));
      }
    }
  }
  // battle: tall columns of smoke on the skyline, a glow of fire under them
  if (scene === 'battle')
    for (let k = 0; k < 3; k++) {
      const bx = 10 + r() * (LW - 20);
      for (let y = hz; y > 0; y--) {
        const t = (hz - y) / hz;
        const wdt = 2 + t * 9;
        const off = Math.sin(y * 0.15 + k) * 3 + t * 10;
        for (let x = -wdt; x <= wdt; x++) {
          const e = hash2(Math.floor(bx + x + off), y, k + 40);
          if (Math.abs(x) < wdt - e * 3) p.set(bx + x + off, y, mix(hex('#2a2826'), hex('#6a6460'), t * 0.7 + e * 0.2), 0.8 - t * 0.4);
        }
      }
      for (let x = -6; x <= 6; x++) for (let y = 0; y < 3; y++) if (hash2(x, y, k) > 0.3) p.set(bx + x, hz - y, y ? hex('#e8743a') : hex('#ffd060'), 0.8);
    }
  // far hills, then nearer ones, each lit along the top
  const far = ridgeLine(seed + 1, hz - 3, D.far2 === 'peaks' ? 16 : D.far2 === 'mesa' ? 10 : 7, D.far2 ?? 'hills');
  const mid = ridgeLine(seed + 2, hz + 1, D.far2 === 'mesa' ? 6 : 4, 'hills');
  for (let x = 0; x < LW; x++) {
    const fy = Math.round(far(x));
    for (let y = fy; y < LH; y++) {
      let col = D.far;
      if (y === fy) col = shade(D.far, 0.14);
      else if (D.far2 !== 'hills' && (y - fy) % 4 === 0 && hash2(x >> 2, y, 3) > 0.4) col = shade(D.far, -0.12); // courses of rock
      p.set(x, y, mix(col, D.sky[1], 0.25));
    }
    const my = Math.round(mid(x));
    for (let y = my; y < LH; y++) p.set(x, y, y === my ? shade(D.mid, 0.12) : hash2(x, y, 5) > 0.93 ? shade(D.mid, -0.1) : D.mid);
  }
  // the ground: from the hills to the bottom, getting a little lighter nearer
  const g0 = hz + 4;
  for (let y = g0; y < LH; y++) {
    const t = (y - g0) / (LH - g0);
    for (let x = 0; x < LW; x++) {
      if (D.water && y < g0 + 10) {
        // a strip of lake, with glints, then a wet edge to the beach
        const sh = hash2(x >> 1, y, 9);
        p.set(x, y, y > g0 + 8 ? hex('#e6f2f4') : sh > 0.9 ? hex('#a6d6f0') : (y + (x >> 3)) % 3 === 0 ? shade(D.mid, 0.08) : D.mid);
        continue;
      }
      const n = hash2(x, y, 11);
      const base = mix(D.ground[1], D.ground[0], 0.35 + t * 0.5);
      p.set(x, y, n > 0.86 ? shade(base, 0.1) : n < 0.12 ? shade(base, -0.12) : base);
    }
  }
  p.flush();
  return p.cv;
}

// Sprites from the game stood about in the landscape: tree lines, rocks,
// bushes, ore. Positions are in picture pixels.
function dressLand(c: CanvasRenderingContext2D, scene: Scene, seed: number, props: CameoProps): void {
  const D = DEFS[scene];
  const hz = CAMEO_H * D.horizon;
  const r = rng(seed * 17 + 3);
  const put = (s: StackSprite, x: number, y: number, k = 1) => {
    const w = s.img.width * k;
    const h = s.img.height * k;
    c.drawImage(s.img, Math.round(x - s.cx * 2 * k), Math.round(y - s.cy * 2 * k), Math.round(w), Math.round(h));
  };
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  if (scene === 'forest' || scene === 'meadow' || scene === 'ridge' || scene === 'lake') {
    // a line of trees along the foot of the hills, thicker in the forest
    const n = scene === 'forest' ? 22 : scene === 'lake' ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * CAMEO_W + r() * 14 - 4;
      if (scene !== 'forest' && r() < 0.35) continue;
      const conifer = scene === 'forest' || scene === 'ridge' || r() < 0.4;
      put(conifer ? props.trees[Math.floor(r() * 5)] : props.trees[5 + Math.floor(r() * 3)], x, hz + (scene === 'lake' ? 4 : 10) + r() * 3, 0.6);
    }
  }
  if (scene === 'forest')
    for (let i = 0; i < 6; i++) put(props.trees[Math.floor(r() * 5)], r() * CAMEO_W, hz + 22 + r() * 10, 0.85);
  if (scene === 'ridge' || scene === 'dry' || scene === 'battle')
    for (let i = 0; i < 5; i++) put(pick(props.rocks), r() * CAMEO_W, hz + 16 + r() * (CAMEO_H - hz - 20), 0.8 + r() * 0.3);
  if (scene === 'meadow' || scene === 'lake')
    for (let i = 0; i < 4; i++) put(pick(props.bushes), r() * CAMEO_W, hz + 24 + r() * (CAMEO_H - hz - 30), 0.8);
  if (scene === 'ore') {
    for (let i = 0; i < 10; i++) {
      const v = Math.floor(r() * 4);
      const x = r() * CAMEO_W;
      const y = hz + 14 + r() * (CAMEO_H - hz - 14);
      put(props.ore.stain[v][2], x, y, 1);
      put(props.ore.lumps[v][Math.floor(r() * 3)], x, y, 1);
    }
  }
  if (scene === 'battle') {
    // scorch marks and craters
    for (let i = 0; i < 4; i++) {
      const x = r() * CAMEO_W;
      const y = hz + 20 + r() * (CAMEO_H - hz - 24);
      c.fillStyle = 'rgba(20,18,14,0.45)';
      c.beginPath();
      c.ellipse(x, y, 16 + r() * 10, 5 + r() * 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(10,9,8,0.5)';
      c.fillRect(Math.round(x - 6), Math.round(y - 1), 12, 3);
    }
  }
}

// Puffs of dust or smoke, drawn as chunky round pixel clouds.
function puffs(c: CanvasRenderingContext2D, seed: number, x: number, y: number, n: number, spread: number, col: RGB, alpha: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * spread;
    const py = y - r() * spread * 0.45;
    const rad = 5 + r() * 10;
    const sh = shade(col, (r() - 0.5) * 0.2);
    for (let yy = -rad; yy <= rad; yy += 2)
      for (let xx = -rad; xx <= rad; xx += 2) {
        if (xx * xx + yy * yy > rad * rad) continue;
        const lit = xx + yy < -rad * 0.3;
        c.fillStyle = `rgba(${sh.map((v) => Math.round(lit ? v + (255 - v) * 0.15 : v)).join(',')},${alpha})`;
        c.fillRect(Math.round(px + xx), Math.round(py + yy), 2, 2);
      }
  }
}

// Dim and cool the background a touch and darken its corners, so the subject
// reads first.
function recede(c: CanvasRenderingContext2D): void {
  const id = c.getImageData(0, 0, CAMEO_W, CAMEO_H);
  const d = id.data;
  for (let y = 0; y < CAMEO_H; y++)
    for (let x = 0; x < CAMEO_W; x++) {
      const i = (y * CAMEO_W + x) * 4;
      const dx = (x / CAMEO_W - 0.5) * 2;
      const dy = (y / CAMEO_H - 0.45) * 2;
      const vig = Math.min(1, Math.max(0, Math.hypot(dx, dy) - 0.55)) * 0.45;
      const k = 0.8 - vig;
      const gray = (d[i] + d[i + 1] + d[i + 2]) / 3;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = (d[i + ch] * 0.78 + gray * 0.22) * k;
    }
  c.putImageData(id, 0, 0);
}

// The finished picture.
export function composeCameo(id: string, subject: Subject, props: CameoProps): HTMLCanvasElement {
  const scene = SCENES[id] ?? 'meadow';
  const seed = [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const out = document.createElement('canvas');
  out.width = CAMEO_W;
  out.height = CAMEO_H;
  const c = out.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(paintLand(scene, seed), 0, 0, CAMEO_W, CAMEO_H);
  dressLand(c, scene, seed, props);

  // where the subject goes
  const [tx, ty, tw, th] = trimBox(subject.img);
  const k = 1; // the image is already drawn at the size it is shown
  const sw = tw * k;
  const sh = th * k;
  let dx = (CAMEO_W - sw) / 2;
  let dy: number;
  if (subject.kind === 'portrait') {
    dx += CAMEO_W * 0.02;
    dy = CAMEO_H * 0.05;
  } else if (subject.kind === 'air') dy = CAMEO_H * 0.08;
  else dy = CAMEO_H - sh - CAMEO_H * 0.01 + (sh > CAMEO_H * 0.95 ? sh * 0.05 : 0);

  // action behind it
  const dusty = scene === 'dry' || scene === 'ore' ? hex('#c8a46a') : scene === 'battle' ? hex('#5a544c') : hex('#a89c80');
  if (subject.kind === 'vehicle') puffs(c, seed, dx + sw * 0.82, dy + sh * 0.55, 7, sw * 0.5, dusty, 0.55);
  if (subject.kind === 'building' && (scene === 'battle' || scene === 'dusk')) puffs(c, seed + 1, dx + sw * 0.85, dy + sh * 0.25, 4, sw * 0.3, hex('#6a6460'), 0.35);
  if (subject.kind === 'portrait') {
    puffs(c, seed + 2, CAMEO_W * 0.2, CAMEO_H * 0.62, 5, CAMEO_W * 0.4, scene === 'dusk' ? hex('#8a6a6a') : hex('#6a6460'), 0.45);
    // tracers streaking across the sky
    const r = rng(seed + 5);
    for (let i = 0; i < 3; i++) {
      const y0 = 8 + r() * CAMEO_H * 0.4;
      const x0 = r() * CAMEO_W * 0.6;
      const len = 18 + r() * 20;
      for (let j = 0; j < len; j += 1) {
        c.fillStyle = j > len - 4 ? '#fff6c0' : `rgba(255,${180 + j * 2},90,${0.25 + (j / len) * 0.6})`;
        c.fillRect(Math.round(x0 + j * 2), Math.round(y0 - j * 0.6), 2, 2);
      }
    }
  }
  recede(c);
  if (subject.kind === 'air') {
    // its shadow on the ground far below
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.ellipse(CAMEO_W * 0.5, CAMEO_H * 0.9, sw * 0.32, 6, 0, 0, Math.PI * 2);
    c.fill();
  }

  // a dark outline round the subject, two pixels thick, then the subject
  const sil = document.createElement('canvas');
  sil.width = Math.ceil(sw) + 4;
  sil.height = Math.ceil(sh) + 4;
  const s = sil.getContext('2d')!;
  s.imageSmoothingEnabled = false;
  s.drawImage(subject.img, tx, ty, tw, th, 2, 2, sw, sh);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = 'rgba(10,8,6,0.85)';
  s.fillRect(0, 0, sil.width, sil.height);
  const X = Math.round(dx);
  const Y = Math.round(dy);
  for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.drawImage(sil, X - 2 + ox, Y - 2 + oy);
  c.drawImage(subject.img, tx, ty, tw, th, X, Y, Math.round(sw), Math.round(sh));

  // a spinning rotor, as a blur
  if (subject.rotor) {
    const rx = X + (subject.rotor[0] - tx) * k;
    const ry = Y + (subject.rotor[1] - ty) * k;
    const R = sw * 0.62;
    for (let yy = -R * 0.5; yy <= R * 0.5; yy += 2)
      for (let xx = -R; xx <= R; xx += 2) {
        const q = (xx / R) ** 2 + (yy / (R * 0.5)) ** 2;
        if (q > 1) continue;
        const a = (Math.atan2(yy * 2, xx) + Math.PI) / (Math.PI * 2);
        const blade = (a * 4) % 1 < 0.1 ? 0.55 : 0.2;
        c.fillStyle = `rgba(36,38,40,${q > 0.86 ? blade + 0.15 : blade})`;
        c.fillRect(Math.round(rx + xx), Math.round(ry + yy), 2, 2);
      }
  }
  return out;
}
