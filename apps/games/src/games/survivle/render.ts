// Isometric drawing for Survivle: terrain with cliffs, trees, the hero, Murks, chests, traders,
// campfires, the castle, the Dark Beast, the spreading darkness and the HUD.
import { CROP_TIME, ENEMY_KINDS, jobById, outfitById, swordColor, swordName, bowName, type Outfit } from './data';
import type { Game, Particle } from './game';
import { MINI_KINDS, type Mini } from './minis';
import { BOARD, CX, CY, FLOOR_H, G, OVEN, SIZE, T, VILLAGES, gen, hash, tG, tH, tT } from './world';

export const TW = 48;
export const TH = 24;
const HW = TW / 2;
const HH = TH / 2;
export const STEP = 14;
const MAXH = 28;
const SPR = 2; // sprite resolution multiplier

const TOP: Record<number, string> = {
  [G.Grass]: '#63b04b', [G.Forest]: '#4c9641', [G.Sand]: '#e3d08f', [G.Water]: '#3b7fc6', [G.Rock]: '#918c84',
  [G.Snow]: '#eef3f8', [G.Dirt]: '#a8895a', [G.Path]: '#cda86c', [G.Bridge]: '#9b6b3c', [G.Gloom]: '#5e5373',
  [G.Stone]: '#8c8996', [G.Floor]: '#6e6b78', [G.Dark]: '#2b2039', [G.Roof]: '#c4533a', [G.Farm]: '#7a5230',
};
const SIDE: Record<number, string> = {
  [G.Grass]: '#8a6c4c', [G.Forest]: '#7d6045', [G.Sand]: '#c7ad6a', [G.Water]: '#2c5f96', [G.Rock]: '#77726b',
  [G.Snow]: '#b7c2cf', [G.Dirt]: '#866945', [G.Path]: '#a5814e', [G.Bridge]: '#6d4823', [G.Gloom]: '#463c58',
  [G.Stone]: '#74717f', [G.Floor]: '#5a5764', [G.Dark]: '#1d1528', [G.Roof]: '#d8b98a', [G.Farm]: '#5e3d22',
};

const SIDE_L: Record<number, string> = {};
const SIDE_R: Record<number, string> = {};
for (const k of Object.keys(SIDE)) {
  SIDE_L[+k] = shadeHex(SIDE[+k], 0.95);
  SIDE_R[+k] = shadeHex(SIDE[+k], 0.72);
}

function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  return [c, x];
}

const tileCache = new Map<number, HTMLCanvasElement>();
function tileSprite(g: number, shade: number, variant: number): HTMLCanvasElement {
  const key = g * 10000 + shade * 10 + variant;
  let c = tileCache.get(key);
  if (c) return c;
  const [cv, x] = mkCanvas(TW * SPR, (TH + 1) * SPR);
  x.scale(SPR, SPR);
  const f = 0.84 + shade * 0.012;
  const base = TOP[g];
  x.beginPath();
  x.moveTo(HW, 0);
  x.lineTo(TW, HH);
  x.lineTo(HW, TH);
  x.lineTo(0, HH);
  x.closePath();
  x.fillStyle = shadeHex(base, f);
  x.fill();
  x.save();
  x.clip();
  // little details baked in
  let seed = variant * 977 + g * 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (g === G.Grass || g === G.Forest || g === G.Gloom) {
    for (let i = 0; i < 7; i++) {
      x.fillStyle = shadeHex(base, f * (rnd() < 0.5 ? 0.85 : 1.12));
      const px = 6 + rnd() * 36, py = 3 + rnd() * 18;
      x.fillRect(px, py, 1.5, 2.5);
      x.fillRect(px + 2, py + 0.5, 1.5, 2);
    }
    if (g === G.Grass && variant === 2) {
      x.fillStyle = rnd() < 0.5 ? '#ffe36b' : '#ff9ad1';
      x.beginPath();
      x.arc(14 + rnd() * 20, 8 + rnd() * 8, 1.4, 0, 7);
      x.fill();
    }
  } else if (g === G.Sand || g === G.Dirt || g === G.Path || g === G.Snow || g === G.Rock) {
    for (let i = 0; i < 6; i++) {
      x.fillStyle = shadeHex(base, f * (rnd() < 0.5 ? 0.9 : 1.08));
      x.fillRect(6 + rnd() * 36, 3 + rnd() * 18, 2, 1.4);
    }
  } else if (g === G.Water) {
    x.strokeStyle = 'rgba(255,255,255,.28)';
    x.lineWidth = 1;
    const ox = variant * 7;
    x.beginPath();
    x.moveTo(8 + ox, 10);
    x.quadraticCurveTo(13 + ox, 8, 18 + ox, 10);
    x.moveTo(24 - ox / 2, 15);
    x.quadraticCurveTo(29 - ox / 2, 13, 34 - ox / 2, 15);
    x.stroke();
  } else if (g === G.Bridge) {
    x.strokeStyle = 'rgba(60,35,15,.6)';
    x.lineWidth = 1;
    for (let i = -2; i < 6; i++) {
      x.beginPath();
      x.moveTo(i * 9, 0);
      x.lineTo(i * 9 + 24, TH);
      x.stroke();
    }
  } else if (g === G.Stone || g === G.Floor) {
    x.strokeStyle = 'rgba(0,0,0,.18)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(HW / 2, HH / 2);
    x.lineTo(HW / 2 + HW, HH / 2 + HH);
    x.moveTo(HW + HW / 2, HH / 2);
    x.lineTo(HW / 2, HH / 2 + HH);
    x.stroke();
  } else if (g === G.Farm) {
    x.strokeStyle = 'rgba(40,20,5,.5)';
    x.lineWidth = 1.5;
    for (let i = -2; i < 6; i++) {
      x.beginPath();
      x.moveTo(i * 10, 0);
      x.lineTo(i * 10 + 24, TH);
      x.stroke();
    }
  } else if (g === G.Roof) {
    x.strokeStyle = 'rgba(90,20,10,.35)';
    x.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      x.beginPath();
      x.moveTo(i * 6, HH - i * 3);
      x.lineTo(i * 6 + HW, HH - i * 3 + HH);
      x.stroke();
    }
  } else if (g === G.Dark) {
    if (variant === 0) {
      x.strokeStyle = 'rgba(190,90,255,.35)';
      x.beginPath();
      x.arc(HW, HH, 5, 0, 7);
      x.stroke();
    }
  }
  x.restore();
  // light top-left edges
  x.strokeStyle = 'rgba(255,255,255,.13)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(0, HH);
  x.lineTo(HW, 0);
  x.lineTo(TW, HH);
  x.stroke();
  tileCache.set(key, cv);
  return cv;
}

const treeCache = new Map<string, HTMLCanvasElement>();
function treeSprite(kind: number, snowy: boolean, gloomy: boolean, v: number): HTMLCanvasElement {
  const key = `${kind}-${snowy}-${gloomy}-${v}`;
  let c = treeCache.get(key);
  if (c) return c;
  const W = 60, H = 84;
  const [cv, x] = mkCanvas(W * SPR, H * SPR);
  x.scale(SPR, SPR);
  const cx = W / 2, by = H - 6;
  // shadow
  x.fillStyle = 'rgba(0,0,0,.22)';
  x.beginPath();
  x.ellipse(cx, by, 15, 6, 0, 0, 7);
  x.fill();
  if (kind === T.Oak) {
    x.fillStyle = '#6b4424';
    x.fillRect(cx - 3.5, by - 26, 7, 26);
    const leaf = gloomy ? ['#4a3d5e', '#5d4f74', '#6d5f86'] : v ? ['#2f7a34', '#3f9440', '#55ad4e'] : ['#357a2e', '#479a3a', '#62b54c'];
    const blobs = [[0, -40, 17], [-11, -33, 12], [11, -33, 12], [-5, -50, 11], [7, -48, 10]];
    blobs.forEach(([dx, dy, r], i) => {
      x.fillStyle = leaf[i === 0 ? 1 : i < 3 ? 0 : 2];
      x.beginPath();
      x.arc(cx + dx, by + dy, r, 0, 7);
      x.fill();
    });
    x.fillStyle = 'rgba(255,255,255,.12)';
    x.beginPath();
    x.arc(cx - 4, by - 50, 6, 0, 7);
    x.fill();
  } else if (kind === T.Pine) {
    x.fillStyle = '#5b3a20';
    x.fillRect(cx - 3, by - 16, 6, 16);
    const cols = gloomy ? ['#3c3350', '#4b4063', '#5a4e75'] : ['#1f5a32', '#28703d', '#338548'];
    for (let i = 0; i < 3; i++) {
      const w = 19 - i * 4.5, top = by - 30 - i * 15, bot = by - 10 - i * 14;
      x.fillStyle = cols[i];
      x.beginPath();
      x.moveTo(cx, top - 10);
      x.lineTo(cx + w, bot);
      x.lineTo(cx - w, bot);
      x.closePath();
      x.fill();
      if (snowy) {
        x.fillStyle = '#f4f8fc';
        x.beginPath();
        x.moveTo(cx, top - 10);
        x.lineTo(cx + w * 0.45, top + (bot - top) * 0.35);
        x.lineTo(cx - w * 0.45, top + (bot - top) * 0.35);
        x.closePath();
        x.fill();
      }
    }
  } else {
    // bush
    const cols = gloomy ? ['#4a3d5e', '#5d4f74'] : ['#3d8a3a', '#58a84a'];
    x.fillStyle = cols[0];
    x.beginPath();
    x.arc(cx - 6, by - 6, 7, 0, 7);
    x.arc(cx + 6, by - 6, 7, 0, 7);
    x.fill();
    x.fillStyle = cols[1];
    x.beginPath();
    x.arc(cx, by - 10, 8, 0, 7);
    x.fill();
    if (v) {
      x.fillStyle = '#e8394a';
      [[-4, -11], [3, -7], [6, -13]].forEach(([dx, dy]) => {
        x.beginPath();
        x.arc(cx + dx, by + dy, 1.6, 0, 7);
        x.fill();
      });
    }
  }
  treeCache.set(key, cv);
  return cv;
}

export interface Cam {
  x: number;
  y: number;
  z: number;
}

interface Drawable {
  s: number;
  depth: number;
  draw: () => void;
}

export function drawHero(x: CanvasRenderingContext2D, o: Outfit, face: number, walk: number, opts: { swing?: number; swordD?: number; climbing?: boolean; scale?: number; name?: string; hurt?: boolean }) {
  // face is a world angle; convert to screen direction
  const sdx = Math.cos(face) - Math.sin(face); // screen x component
  const sdy = Math.cos(face) + Math.sin(face); // screen y component (down is +)
  const front = sdy > -0.2; // showing the face
  const side = Math.sign(sdx) || 1;
  const s = opts.scale ?? 1;
  x.save();
  x.scale(s, s);
  const legSwing = Math.sin(walk * 12) * (opts.climbing ? 2 : 3);
  if (opts.hurt) x.globalAlpha *= 0.55;
  // legs
  x.fillStyle = o.pants;
  x.fillRect(-5, -14 + Math.max(0, legSwing) * 0.3, 4, 10);
  x.fillRect(1, -14 + Math.max(0, -legSwing) * 0.3, 4, 10);
  x.fillStyle = '#4a2e1a';
  x.fillRect(-5.5, -4 - legSwing * 0.3, 5, 3.5);
  x.fillRect(0.5, -4 + legSwing * 0.3, 5, 3.5);
  // bow on back
  if (!front) {
    x.strokeStyle = '#8a5a2b';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(0, -22, 8, -1.2, 1.2);
    x.stroke();
  }
  // body
  x.fillStyle = o.shirt;
  x.beginPath();
  x.roundRect(-7, -27, 14, 15, 4);
  x.fill();
  x.fillStyle = '#5a3a1e';
  x.fillRect(-7, -16, 14, 2.5);
  x.fillStyle = '#d9b44a';
  x.fillRect(-1.5, -16, 3, 2.5);
  // arms
  const arm = opts.climbing ? -8 + Math.sin(walk * 12) * 3 : Math.sin(walk * 12) * 2;
  x.fillStyle = o.shirt;
  x.fillRect(-10, -26 + arm, 4, 10);
  x.fillRect(6, -26 - arm, 4, 10);
  x.fillStyle = '#f0c7a0';
  x.fillRect(-10, -17 + arm, 4, 3);
  x.fillRect(6, -17 - arm, 4, 3);
  // head
  x.fillStyle = '#f0c7a0';
  x.beginPath();
  x.arc(0, -34, 7, 0, 7);
  x.fill();
  // hood
  x.fillStyle = o.hood;
  x.beginPath();
  if (front) {
    x.moveTo(-8, -31);
    x.quadraticCurveTo(-9, -44, 0, -43);
    x.quadraticCurveTo(9, -44, 8, -31);
    x.lineTo(6, -36);
    x.quadraticCurveTo(0, -40, -6, -36);
    x.closePath();
  } else {
    x.arc(0, -35, 8, 0, 7);
  }
  x.fill();
  // hood tip
  x.beginPath();
  x.moveTo(-side * 4, -41);
  x.quadraticCurveTo(-side * 13, -40, -side * 14, -30);
  x.quadraticCurveTo(-side * 9, -36, -side * 2, -37);
  x.fill();
  if (front) {
    x.fillStyle = '#1d1d24';
    const ex = sdx * 2;
    x.fillRect(-3.5 + ex, -34, 2, 2.5);
    x.fillRect(1.5 + ex, -34, 2, 2.5);
  }
  // sword
  if (opts.swordD !== undefined && !opts.climbing) {
    const col = swordColor(opts.swordD);
    x.save();
    if (opts.swing && opts.swing > 0) {
      const t = 1 - opts.swing / 0.28;
      const base = Math.atan2(sdy, sdx);
      const a = base - 1.3 + t * 2.6;
      x.translate(0, -20);
      x.strokeStyle = 'rgba(255,255,255,.55)';
      x.lineWidth = 6;
      x.beginPath();
      x.ellipse(0, 0, 26, 15, 0, base - 1.3, a);
      x.stroke();
      x.rotate(Math.atan2(Math.sin(a) * 0.6, Math.cos(a)));
      x.fillStyle = '#5a3a1e';
      x.fillRect(4, -1.5, 6, 3);
      x.fillStyle = col;
      x.fillRect(10, -2, 18, 4);
      x.fillStyle = '#d9b44a';
      x.fillRect(9, -4, 2, 8);
    } else {
      x.translate(side * 8, -18);
      x.rotate(side * 0.5);
      x.fillStyle = col;
      x.fillRect(-1.5, -18, 3, 16);
      x.fillStyle = '#d9b44a';
      x.fillRect(-4, -2, 8, 2);
      x.fillStyle = '#5a3a1e';
      x.fillRect(-1.5, 0, 3, 5);
    }
    x.restore();
  }
  x.restore();
  if (opts.name) {
    x.font = 'bold 11px ui-rounded, system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillStyle = 'rgba(0,0,0,.5)';
    x.fillText(opts.name, 1, -50 * s + 1);
    x.fillStyle = '#fff';
    x.fillText(opts.name, 0, -50 * s);
  }
}

export function drawBeast(x: CanvasRenderingContext2D, r: number, t: number, glow: number, hurt: boolean) {
  // gloom wisps
  for (let i = 0; i < 7; i++) {
    const a = t * 0.9 + (i * Math.PI * 2) / 7;
    x.strokeStyle = `rgba(${150 + i * 10},60,220,${0.35 + 0.15 * Math.sin(t * 3 + i)})`;
    x.lineWidth = 4;
    x.beginPath();
    x.arc(0, 0, r * (1.1 + 0.12 * Math.sin(t * 2 + i)), a, a + 1.1);
    x.stroke();
  }
  const gr = x.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  gr.addColorStop(0, hurt ? '#c08af0' : '#6a3a9a');
  gr.addColorStop(0.45, '#3a1a5a');
  gr.addColorStop(1, '#07030c');
  x.fillStyle = gr;
  x.beginPath();
  x.arc(0, 0, r, 0, 7);
  x.fill();
  if (glow > 0) {
    x.fillStyle = `rgba(220,80,255,${glow * 0.5})`;
    x.beginPath();
    x.arc(0, 0, r * (1 + glow * 0.2), 0, 7);
    x.fill();
  }
  // eyes
  const blink = Math.sin(t * 0.7) > 0.97 ? 0.2 : 1;
  x.fillStyle = '#ff4fd8';
  x.shadowColor = '#ff4fd8';
  x.shadowBlur = 12;
  x.beginPath();
  x.ellipse(-r * 0.32, -r * 0.1, r * 0.14, r * 0.09 * blink, -0.3, 0, 7);
  x.ellipse(r * 0.32, -r * 0.1, r * 0.14, r * 0.09 * blink, 0.3, 0, 7);
  x.fill();
  x.shadowBlur = 0;
}

export class Renderer {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  zoom = 1;
  W = 0;
  H = 0;
  private dark: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private mini: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private miniCenter = { x: -1e9, y: -1e9 };
  private miniBuild: { x: number; y: number; row: number; img: ImageData } | null = null;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.ctx = cv.getContext('2d')!;
    [this.dark, this.dctx] = mkCanvas(10, 10);
    [this.mini, this.mctx] = mkCanvas(128, 128);
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    this.zoom = Math.max(0.7, Math.min(1.3, Math.min(w / 1150, h / 720)));
    this.W = w / this.zoom;
    this.H = h / this.zoom;
    this.dark.width = Math.ceil(w / 2);
    this.dark.height = Math.ceil(h / 2);
  }

  /** World point -> screen (in zoomed units). */
  sx(cam: Cam, x: number, y: number) {
    return (x - y - (cam.x - cam.y)) * HW + this.W / 2;
  }
  sy(cam: Cam, x: number, y: number, z: number) {
    return (x + y - (cam.x + cam.y)) * HH - (z - cam.z) * STEP + this.H / 2;
  }
  /** Screen point -> world point on the plane at height z. */
  toWorld(cam: Cam, px: number, py: number, z: number) {
    const a = (px - this.W / 2) / HW + (cam.x - cam.y); // x - y
    const b = (py - this.H / 2 + (z - cam.z) * STEP) / HH + (cam.x + cam.y); // x + y
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }

  draw(game: Game, cam: Cam, opts: { beastForm?: number; beastZ?: number; hideHero?: boolean; hud: boolean }) {
    const ctx = this.ctx;
    const t = game.time;
    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const shake = game.shake;
    const shx = shake ? (Math.random() - 0.5) * shake : 0, shy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.fillStyle = '#1c2a3a';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.translate(shx, shy);

    const W = this.W, H = this.H;
    const camD = cam.x - cam.y, camS = cam.x + cam.y;
    const dMin = Math.floor(camD - W / 2 / HW) - 2, dMax = Math.ceil(camD + W / 2 / HW) + 2;
    const sMin = Math.floor(camS - H / 2 / HH - (cam.z * STEP) / HH) - 3;
    const sMax = Math.ceil(camS + H / 2 / HH + ((MAXH - cam.z) * STEP) / HH) + 3;
    const world = game.world;

    // entities bucketed by diagonal
    const buckets = new Map<number, Drawable[]>();
    const add = (wx: number, wy: number, draw: () => void) => {
      const s = Math.floor(wx) + Math.floor(wy);
      if (s < sMin || s > sMax) return;
      let b = buckets.get(s);
      if (!b) buckets.set(s, (b = []));
      b.push({ s, depth: wx + wy, draw });
    };
    this.collect(game, cam, add, opts);

    const waterFrame = Math.floor(t * 1.5);
    const lowGfx = W * H > 2400 * 1400;
    for (let s = sMin; s <= sMax; s++) {
      const xLo = Math.ceil((s + dMin) / 2), xHi = Math.floor((s + dMax) / 2);
      for (let ix = xLo; ix <= xHi; ix++) {
        const iy = s - ix;
        const v = world.tile(ix, iy);
        const h = tH(v), g = tG(v);
        const px = (ix - iy - camD) * HW + W / 2;
        const py = (s - camS) * HH - (h - cam.z) * STEP + H / 2;
        if (py > H + 4 || px < -TW || px > W + TW) continue;
        // cliff faces toward the viewer
        const hx = tH(world.tile(ix + 1, iy)), hy = tH(world.tile(ix, iy + 1));
        if (hx < h || hy < h) {
          const sideCol = g;
          if (hy < h) {
            const dh = (h - hy) * STEP;
            ctx.fillStyle = SIDE_L[sideCol];
            ctx.beginPath();
            ctx.moveTo(px - HW, py + HH);
            ctx.lineTo(px, py + TH);
            ctx.lineTo(px, py + TH + dh);
            ctx.lineTo(px - HW, py + HH + dh);
            ctx.closePath();
            ctx.fill();
          }
          if (hx < h) {
            const dh = (h - hx) * STEP;
            ctx.fillStyle = SIDE_R[sideCol];
            ctx.beginPath();
            ctx.moveTo(px + HW, py + HH);
            ctx.lineTo(px, py + TH);
            ctx.lineTo(px, py + TH + dh);
            ctx.lineTo(px + HW, py + HH + dh);
            ctx.closePath();
            ctx.fill();
          }
          if (g === G.Roof && hy < h && (ix + iy) % 2 === 0) {
            ctx.fillStyle = (ix * 7 + iy) % 3 === 0 ? '#5a3a1e' : '#ffe08a';
            ctx.fillRect(px - HW / 2 - 4, py + HH + 10, 8, (ix * 7 + iy) % 3 === 0 ? 18 : 8);
          }
          if (!lowGfx && g !== G.Roof && (h - Math.min(hx, hy) >= 2)) {
            // rock layers
            ctx.strokeStyle = 'rgba(0,0,0,.13)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let k = 1; k < h - Math.min(hx, hy); k++) {
              const yy = py + k * STEP;
              if (hy < h - k + 1) {
                ctx.moveTo(px - HW, yy + HH);
                ctx.lineTo(px, yy + TH);
              }
              if (hx < h - k + 1) {
                ctx.moveTo(px, yy + TH);
                ctx.lineTo(px + HW, yy + HH);
              }
            }
            ctx.stroke();
          }
        }
        const variant = g === G.Water ? (Math.floor(hash(ix, iy, 3) * 3) + waterFrame) % 3 : Math.floor(hash(ix, iy, 1) * 3);
        ctx.drawImage(tileSprite(g, Math.min(h, 24), variant), px - HW, py, TW, TH + 1);
        // trees
        const tt = tT(v);
        if (tt) {
          const sp = treeSprite(tt, g === G.Snow, g === G.Gloom, hash(ix, iy, 2) < 0.4 ? 1 : 0);
          const rec = game.treeHits.get(ix * SIZE + iy);
          const wob = rec && rec.t > 0 ? Math.sin(t * 60) * 2 : 0;
          const tw = 60, th = 84;
          ctx.drawImage(sp, px - tw / 2 + wob, py + HH - th + 6, tw, th);
        }
      }
      const b = buckets.get(s);
      if (b) {
        b.sort((a, c) => a.depth - c.depth);
        for (const d of b) d.draw();
      }
    }

    // see-through hero when hidden behind cliffs
    if (!opts.hideHero && !game.knockedOut) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      this.heroAt(game, cam);
      ctx.restore();
    }

    // particles
    for (const q of game.particles) this.particle(q, cam);

    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, 0, 0);
    this.drawGloom(game, cam);
    if (opts.hud) this.hud(game, cam);
  }

  private heroAt(game: Game, cam: Cam) {
    const p = game.p;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.sx(cam, p.x, p.y), this.sy(cam, p.x, p.y, p.z));
    drawHero(ctx, outfitById(p.outfit), p.face, p.moving || p.climbing ? p.walkT : 0, {
      swing: p.swingT, swordD: game.swordDmg, climbing: p.climbing, hurt: p.hurtT > 0 && Math.floor(p.hurtT * 12) % 2 === 0,
    });
    ctx.restore();
  }

  private collect(game: Game, cam: Cam, add: (x: number, y: number, d: () => void) => void, opts: { beastForm?: number; beastZ?: number; hideHero?: boolean }) {
    const ctx = this.ctx;
    const t = game.time;
    const p = game.p;
    // campfires
    for (const f of game.fires) {
      const h = game.world.heightAt(f.x, f.y);
      add(f.x + 0.5, f.y + 0.5, () => {
        const X = this.sx(cam, f.x + 0.5, f.y + 0.5), Y = this.sy(cam, f.x + 0.5, f.y + 0.5, h);
        ctx.save();
        ctx.translate(X, Y);
        ctx.fillStyle = '#5b3a1e';
        ctx.save();
        ctx.rotate(0.4);
        ctx.fillRect(-10, -2, 20, 4);
        ctx.rotate(-0.8);
        ctx.fillRect(-10, -2, 20, 4);
        ctx.restore();
        for (let i = 0; i < 3; i++) {
          const fl = 1 + 0.25 * Math.sin(t * 13 + i * 2);
          ctx.fillStyle = ['#ff6a1f', '#ffa530', '#ffe27a'][i];
          ctx.beginPath();
          ctx.ellipse(0, -6 - i * 2, (7 - i * 2) * fl, (11 - i * 3) * fl, 0, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      });
    }
    // the trader who follows you
    {
      const tr = game.trader;
      add(tr.x, tr.y, () => {
        const X = this.sx(cam, tr.x, tr.y), Y = this.sy(cam, tr.x, tr.y, tr.z);
        ctx.save();
        ctx.translate(X, Y);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 5, 0, 0, 7);
        ctx.fill();
        // big backpack
        ctx.fillStyle = '#8a5a2b';
        ctx.beginPath();
        ctx.roundRect(-13, -40, 26, 26, 5);
        ctx.fill();
        ctx.fillStyle = '#c9473a';
        ctx.fillRect(-13, -32, 26, 4);
        ctx.fillStyle = '#d9b44a';
        ctx.beginPath();
        ctx.arc(9, -44, 5, 0, 7);
        ctx.fill();
        drawHero(ctx, { id: '', name: '', shirt: '#8a5ab8', pants: '#4a3a2a', hood: '#d6a43c', price: 0 }, tr.face, tr.walkT, { scale: 0.95 });
        ctx.font = 'bold 11px ui-rounded, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillText('Trader', 1, -51);
        ctx.fillStyle = '#fff3c4';
        ctx.fillText('Trader', 0, -52);
        ctx.restore();
      });
    }
    // glowing challenge rocks
    for (const st of game.stones()) {
      const h = game.world.heightAt(st.x, st.y);
      const done = game.stoneDone(st);
      add(st.x + 0.5, st.y + 0.5, () => {
        const X = this.sx(cam, st.x + 0.5, st.y + 0.5), Y = this.sy(cam, st.x + 0.5, st.y + 0.5, h);
        ctx.save();
        ctx.translate(X, Y);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 26, 10, 0, 0, 7);
        ctx.fill();
        if (!done) {
          const gl = ctx.createRadialGradient(0, -24, 4, 0, -24, 46);
          gl.addColorStop(0, `rgba(90,200,255,${0.35 + 0.15 * Math.sin(t * 3)})`);
          gl.addColorStop(1, 'rgba(90,200,255,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(-46, -70, 92, 92);
        }
        ctx.fillStyle = '#5d6270';
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(-20, -30);
        ctx.lineTo(-8, -48);
        ctx.lineTo(10, -46);
        ctx.lineTo(22, -26);
        ctx.lineTo(24, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a4e5a';
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(10, -46);
        ctx.lineTo(22, -26);
        ctx.lineTo(24, 0);
        ctx.closePath();
        ctx.fill();
        // blue pattern
        ctx.strokeStyle = done ? '#7a8090' : `rgba(110,215,255,${0.75 + 0.25 * Math.sin(t * 4)})`;
        ctx.lineWidth = 2.5;
        if (!done) {
          ctx.shadowColor = '#5ad0ff';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.moveTo(-12, -8);
        ctx.lineTo(-12, -30);
        ctx.lineTo(0, -38);
        ctx.lineTo(12, -30);
        ctx.lineTo(12, -8);
        ctx.moveTo(-6, -14);
        ctx.lineTo(0, -24);
        ctx.lineTo(6, -14);
        ctx.moveTo(0, -24);
        ctx.lineTo(0, -32);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -20, 3, 0, 7);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      });
    }
    // villages: job board, oven, villagers
    VILLAGES.forEach((v, vi) => {
      if (Math.abs(v.x - cam.x) > 60 || Math.abs(v.y - cam.y) > 60) return;
      const bh = game.world.heightAt(v.x + BOARD.x, v.y + BOARD.y);
      add(v.x + BOARD.x + 0.5, v.y + BOARD.y + 0.5, () => {
        const X = this.sx(cam, v.x + BOARD.x + 0.5, v.y + BOARD.y + 0.5), Y = this.sy(cam, v.x + BOARD.x + 0.5, v.y + BOARD.y + 0.5, bh);
        ctx.save();
        ctx.translate(X, Y);
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(-14, -30, 4, 30);
        ctx.fillRect(10, -30, 4, 30);
        ctx.fillStyle = '#9b6b3c';
        ctx.fillRect(-18, -46, 36, 22);
        ctx.fillStyle = '#f2e6c9';
        ctx.fillRect(-14, -43, 12, 9);
        ctx.fillRect(1, -42, 13, 8);
        ctx.fillRect(-6, -33, 12, 6);
        ctx.font = 'bold 11px ui-rounded, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillText('Jobs', 1, -51);
        ctx.fillStyle = '#fff3c4';
        ctx.fillText('Jobs', 0, -52);
        ctx.restore();
      });
      const oh = game.world.heightAt(v.x + OVEN.x, v.y + OVEN.y);
      add(v.x + OVEN.x + 0.5, v.y + OVEN.y + 0.5, () => {
        const X = this.sx(cam, v.x + OVEN.x + 0.5, v.y + OVEN.y + 0.5), Y = this.sy(cam, v.x + OVEN.x + 0.5, v.y + OVEN.y + 0.5, oh);
        ctx.save();
        ctx.translate(X, Y);
        ctx.fillStyle = '#9a8f86';
        ctx.beginPath();
        ctx.arc(0, -10, 16, Math.PI, 0);
        ctx.lineTo(16, 0);
        ctx.lineTo(-16, 0);
        ctx.fill();
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.arc(0, -4, 7, Math.PI, 0);
        ctx.lineTo(7, 0);
        ctx.lineTo(-7, 0);
        ctx.fill();
        ctx.fillStyle = `rgba(255,140,40,${0.6 + 0.3 * Math.sin(t * 9)})`;
        ctx.beginPath();
        ctx.ellipse(0, -2, 4, 2.5, 0, 0, 7);
        ctx.fill();
        ctx.restore();
      });
      const looks: Outfit[] = [
        { id: '', name: '', shirt: '#d98a3a', pants: '#5a4a3a', hood: '#7a3a1a', price: 0 },
        { id: '', name: '', shirt: '#4aa0b8', pants: '#3a3a4a', hood: '#20506a', price: 0 },
        { id: '', name: '', shirt: '#e0d0b0', pants: '#6a5a3a', hood: '#a07040', price: 0 },
        { id: '', name: '', shirt: '#b04a6a', pants: '#3a2a3a', hood: '#602040', price: 0 },
      ];
      looks.forEach((lk, k) => {
        const a = t * 0.25 + k * 1.7 + vi;
        const r = 6 + (k % 2) * 3;
        const wx = v.x + 0.5 + Math.cos(a) * r, wy = v.y + 0.5 + Math.sin(a) * r * 0.8;
        const hz = game.world.heightAt(wx, wy);
        add(wx, wy, () => {
          ctx.save();
          ctx.translate(this.sx(cam, wx, wy), this.sy(cam, wx, wy, hz));
          ctx.fillStyle = 'rgba(0,0,0,.22)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 9, 4, 0, 0, 7);
          ctx.fill();
          drawHero(ctx, lk, a + Math.PI / 2, t, { scale: 0.9 });
          ctx.restore();
        });
      });
    });
    // crops on the farm
    for (const [key, at] of game.farm) {
      const fx = Math.floor(key / SIZE), fy = key % SIZE;
      if (Math.abs(fx - cam.x) > 50 || Math.abs(fy - cam.y) > 50) continue;
      const k = Math.min(1, (game.elapsed - at) / CROP_TIME);
      const h = game.world.heightAt(fx, fy);
      add(fx + 0.5, fy + 0.5, () => {
        const X = this.sx(cam, fx + 0.5, fy + 0.5), Y = this.sy(cam, fx + 0.5, fy + 0.5, h);
        ctx.save();
        ctx.translate(X, Y);
        for (let i = -1; i <= 1; i++) {
          ctx.strokeStyle = '#5fc048';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(i * 8, 2);
          ctx.lineTo(i * 8, 2 - 5 - k * 16);
          ctx.stroke();
          if (k >= 1) {
            ctx.fillStyle = '#f2c43a';
            ctx.beginPath();
            ctx.ellipse(i * 8, -16, 3, 6, 0, 0, 7);
            ctx.fill();
          }
        }
        ctx.restore();
      });
    }
    // chests
    for (const c of game.chests) {
      const h = game.world.heightAt(c.x, c.y);
      add(c.x + 0.5, c.y + 0.5, () => {
        const X = this.sx(cam, c.x + 0.5, c.y + 0.5), Y = this.sy(cam, c.x + 0.5, c.y + 0.5, h);
        ctx.save();
        ctx.translate(X, Y);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath();
        ctx.ellipse(0, 1, 14, 6, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(-12, -14, 24, 14);
        ctx.fillStyle = '#9b6232';
        ctx.beginPath();
        ctx.roundRect(-12, -22, 24, 9, [6, 6, 0, 0]);
        ctx.fill();
        ctx.fillStyle = '#e4b84a';
        ctx.fillRect(-12, -14, 24, 2);
        ctx.fillRect(-2.5, -16, 5, 7);
        ctx.fillRect(-12, -22, 2, 22);
        ctx.fillRect(10, -22, 2, 22);
        // sparkle now and then
        const sp = (t * 0.7 + hash(c.x, c.y, 9) * 10) % 3;
        if (sp < 0.5) {
          const a = sp / 0.5;
          ctx.fillStyle = `rgba(255,250,200,${1 - Math.abs(a - 0.5) * 2})`;
          ctx.translate(8, -24);
          ctx.rotate(t * 3);
          ctx.fillRect(-1, -6, 2, 12);
          ctx.fillRect(-6, -1, 12, 2);
        }
        ctx.restore();
      });
    }
    // corner mini bosses, their shots and the warning circles on the ground
    for (const hz of game.minis.hazards) {
      const h = game.world.heightAt(hz.x, hz.y);
      add(hz.x - 2, hz.y - 2, () => {
        const X = this.sx(cam, hz.x, hz.y), Y = this.sy(cam, hz.x, hz.y, h);
        const rx = hz.r * TW * 0.707, ry = hz.r * TH * 0.707;
        ctx.save();
        if (!hz.hit) {
          const k = hz.t / hz.max;
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = hz.color;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.ellipse(X, Y, rx, ry, 0, 0, 7);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = hz.color;
          ctx.beginPath();
          ctx.ellipse(X, Y, rx * k, ry * k, 0, 0, 7);
          ctx.fill();
        } else {
          const k = (hz.t - hz.max) / hz.after;
          ctx.globalAlpha = Math.max(0, 1 - k);
          ctx.fillStyle = hz.color;
          ctx.beginPath();
          ctx.ellipse(X, Y, rx, ry, 0, 0, 7);
          ctx.fill();
          if (hz.color === '#6fbf4a') {
            // roots
            ctx.fillStyle = '#5a3a1e';
            for (let i = -1; i <= 1; i++) {
              ctx.beginPath();
              ctx.moveTo(X + i * 10 - 4, Y);
              ctx.lineTo(X + i * 10, Y - 26 + Math.abs(i) * 8);
              ctx.lineTo(X + i * 10 + 4, Y);
              ctx.fill();
            }
          } else if (hz.color === '#fff36b') {
            ctx.strokeStyle = '#fffbd0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(X, Y - 120);
            ctx.lineTo(X + 8, Y - 80);
            ctx.lineTo(X - 6, Y - 50);
            ctx.lineTo(X + 4, Y);
            ctx.stroke();
          }
        }
        ctx.restore();
      });
    }
    for (const sh of game.minis.shots) {
      const h = game.world.heightAt(sh.x, sh.y);
      add(sh.x, sh.y, () => {
        const X = this.sx(cam, sh.x, sh.y), Y = this.sy(cam, sh.x, sh.y, h + 0.9);
        const gr = ctx.createRadialGradient(X, Y, 1, X, Y, 9);
        gr.addColorStop(0, '#fff');
        gr.addColorStop(0.45, sh.color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(X, Y, 9, 0, 7);
        ctx.fill();
      });
    }
    for (const m of game.minis.list) {
      if (m.dead || Math.abs(m.x - cam.x) > 60 || Math.abs(m.y - cam.y) > 60) continue;
      add(m.x, m.y, () => this.miniBoss(game, m, cam));
    }
    // enemies
    for (const e of game.enemies) {
      add(e.x, e.y, () => this.murk(game, e, cam));
    }
    // arrows
    for (const a of game.arrowsFlying) {
      add(a.x, a.y, () => {
        const X = this.sx(cam, a.x, a.y), Y = this.sy(cam, a.x, a.y, a.z);
        const ddx = (a.dx - a.dy) * HW, ddy = (a.dx + a.dy) * HH;
        const l = Math.hypot(ddx, ddy) || 1;
        ctx.strokeStyle = '#6b4424';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X - (ddx / l) * 14, Y - (ddy / l) * 14);
        ctx.lineTo(X, Y);
        ctx.stroke();
        ctx.fillStyle = '#ddd';
        ctx.beginPath();
        ctx.arc(X, Y, 2, 0, 7);
        ctx.fill();
      });
    }
    // the Dark Beast
    const b = game.boss;
    if (!b.dead || b.deadT < 2) {
      const form = opts.beastForm ?? 1;
      const bz = opts.beastZ ?? FLOOR_H + 1.6 + Math.sin(t * 2) * 0.25;
      if (form > 0) {
        // rings on the floor
        for (const r of b.rings) {
          add(r.x - 3, r.y - 3, () => {
            const X = this.sx(cam, r.x, r.y), Y = this.sy(cam, r.x, r.y, FLOOR_H);
            const k = r.t / r.max;
            ctx.save();
            if (r.heavy) {
              ctx.strokeStyle = `rgba(255,60,140,${0.4 + 0.4 * Math.sin(t * 12)})`;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.ellipse(X, Y, r.r * TW * 0.707, r.r * TH * 0.707, 0, 0, 7);
              ctx.stroke();
              ctx.fillStyle = 'rgba(180,40,200,.28)';
              ctx.beginPath();
              ctx.ellipse(X, Y, r.r * TW * 0.707 * k, r.r * TH * 0.707 * k, 0, 0, 7);
              ctx.fill();
            } else {
              ctx.strokeStyle = `rgba(210,120,255,${1 - k})`;
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.ellipse(X, Y, r.r * TW * 0.707 * (0.4 + k * 0.6), r.r * TH * 0.707 * (0.4 + k * 0.6), 0, 0, 7);
              ctx.stroke();
            }
            ctx.restore();
          });
        }
        add(b.x, b.y, () => {
          const X = this.sx(cam, b.x, b.y), Y = this.sy(cam, b.x, b.y, bz);
          const fy = this.sy(cam, b.x, b.y, FLOOR_H);
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.beginPath();
          ctx.ellipse(X, fy, 34 * form, 13 * form, 0, 0, 7);
          ctx.fill();
          ctx.translate(X, Y);
          if (b.dead) {
            ctx.globalAlpha = Math.max(0, 1 - b.deadT / 2);
            ctx.scale(1 + b.deadT, 1 + b.deadT);
          }
          const glow = b.state === 'wind' ? 1 - b.t / 0.6 : b.state === 'heavy' ? 1 - b.t / 2.4 : 0;
          drawBeast(ctx, 38 * form, t, glow, b.hurtT > 0);
          ctx.restore();
        });
        for (const o of b.orbs) {
          add(o.x, o.y, () => {
            const X = this.sx(cam, o.x, o.y), Y = this.sy(cam, o.x, o.y, FLOOR_H + 1);
            const gr = ctx.createRadialGradient(X, Y, 1, X, Y, 11);
            gr.addColorStop(0, '#f6c4ff');
            gr.addColorStop(0.5, '#9b3ad6');
            gr.addColorStop(1, 'rgba(40,0,60,0)');
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(X, Y, 11, 0, 7);
            ctx.fill();
          });
        }
      }
    }
    // the hero
    if (!opts.hideHero && !game.knockedOut) {
      add(p.x, p.y, () => {
        const g = game.world.heightAt(p.x, p.y);
        const X = this.sx(cam, p.x, p.y);
        // shadow on the ground
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.beginPath();
        ctx.ellipse(X, this.sy(cam, p.x, p.y, p.climbing ? p.z : g) - 1, 10, 4.5, 0, 0, 7);
        ctx.fill();
        if (p.inWater) {
          ctx.strokeStyle = 'rgba(255,255,255,.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(X, this.sy(cam, p.x, p.y, p.z) - 2, 12 + Math.sin(t * 5) * 2, 5, 0, 0, 7);
          ctx.stroke();
        }
        this.heroAt(game, cam);
        ctx.save();
        ctx.translate(X, this.sy(cam, p.x, p.y, p.z));
        ctx.font = 'bold 11px ui-rounded, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillText(p.name, 1, -51);
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, 0, -52);
        ctx.restore();
      });
    }
  }

  private miniBoss(game: Game, m: Mini, cam: Cam) {
    const ctx = this.ctx;
    const t = game.time;
    const g = game.world.heightAt(m.x, m.y);
    const X = this.sx(cam, m.x, m.y);
    const gy = this.sy(cam, m.x, m.y, g);
    const Y = this.sy(cam, m.x, m.y, g + m.lift);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(X, gy, 30 - Math.min(14, m.lift * 2), 12 - Math.min(5, m.lift), 0, 0, 7);
    ctx.fill();
    ctx.translate(X, Y);
    ctx.scale(1.3, 1.3);
    const hurt = m.hurtT > 0;
    if (m.kind === 0) {
      // Frost Golem: a big blocky ice giant
      const bob = Math.sin(t * 3) * 1.5;
      ctx.fillStyle = hurt ? '#fff' : '#5aa7c9';
      ctx.fillRect(-18, -24, 13, 24);
      ctx.fillRect(5, -24, 13, 24);
      ctx.fillStyle = hurt ? '#fff' : '#7fcbe8';
      ctx.beginPath();
      ctx.roundRect(-26, -64 + bob, 52, 44, 8);
      ctx.fill();
      ctx.fillStyle = hurt ? '#fff' : '#5aa7c9';
      ctx.fillRect(-38, -60 + bob, 13, 34);
      ctx.fillRect(25, -60 + bob, 13, 34);
      ctx.fillStyle = hurt ? '#fff' : '#a8e6ff';
      ctx.beginPath();
      ctx.roundRect(-14, -86 + bob, 28, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#e8fbff';
      [[-30, -66], [-22, -70], [22, -70], [30, -66]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(dx - 4, dy + 6 + bob);
        ctx.lineTo(dx, dy - 8 + bob);
        ctx.lineTo(dx + 4, dy + 6 + bob);
        ctx.fill();
      });
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.fillRect(-9, -78 + bob, 6, 4);
      ctx.fillRect(3, -78 + bob, 6, 4);
      ctx.shadowBlur = 0;
    } else if (m.kind === 1) {
      // Ember Toad: a wide, glowing orange toad
      const puff = 1 + Math.sin(t * 4) * 0.04;
      ctx.fillStyle = hurt ? '#fff' : '#c9471f';
      ctx.beginPath();
      ctx.ellipse(-22, -6, 12, 7, 0, 0, 7);
      ctx.ellipse(22, -6, 12, 7, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = hurt ? '#fff' : '#ff6a2a';
      ctx.beginPath();
      ctx.ellipse(0, -22, 32 * puff, 22 * puff, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#ffc070';
      ctx.beginPath();
      ctx.ellipse(0, -14, 20, 10, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = `rgba(255,230,90,${0.6 + 0.4 * Math.sin(t * 6)})`;
      [[-16, -32], [12, -36], [20, -24], [-6, -38]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, 7);
        ctx.fill();
      });
      ctx.fillStyle = '#ffde3a';
      ctx.beginPath();
      ctx.arc(-13, -44, 8, 0, 7);
      ctx.arc(13, -44, 8, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#1b1b22';
      ctx.fillRect(-15, -48, 4, 8);
      ctx.fillRect(11, -48, 4, 8);
      ctx.strokeStyle = '#7a1f0a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -24, 16, 0.3, Math.PI - 0.3);
      ctx.stroke();
    } else if (m.kind === 2) {
      // Thorn King: a walking tree with a crown of thorns
      const sway = Math.sin(t * 2) * 3;
      ctx.fillStyle = hurt ? '#fff' : '#6b4424';
      ctx.fillRect(-14, -16, 9, 16);
      ctx.fillRect(5, -16, 9, 16);
      ctx.beginPath();
      ctx.roundRect(-18, -62, 36, 50, 10);
      ctx.fill();
      ctx.strokeStyle = hurt ? '#fff' : '#4a2e17';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-16, -48);
      ctx.quadraticCurveTo(-36, -50 + sway, -40, -30 + sway);
      ctx.moveTo(16, -48);
      ctx.quadraticCurveTo(36, -50 - sway, 40, -30 - sway);
      ctx.stroke();
      ctx.fillStyle = '#3f8f3a';
      [[-24, -76, 16], [0, -86, 20], [24, -76, 16]].forEach(([dx, dy, r]) => {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, 7);
        ctx.fill();
      });
      ctx.fillStyle = '#2a5a24';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 20 - 4, -96 + Math.sin(a) * 4);
        ctx.lineTo(Math.cos(a) * 24, -112 + Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 20 + 4, -96 + Math.sin(a) * 4);
        ctx.fill();
      }
      ctx.fillStyle = '#ffde3a';
      ctx.fillRect(-10, -48, 6, 5);
      ctx.fillRect(4, -48, 6, 5);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(-7, -36, 14, 4);
    } else {
      // Storm Eye: a floating eyeball crackling with lightning
      ctx.strokeStyle = `rgba(255,243,107,${0.5 + 0.5 * Math.sin(t * 20)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = t * 3 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 26, -30 + Math.sin(a) * 26);
        ctx.lineTo(Math.cos(a + 0.3) * 34, -30 + Math.sin(a + 0.3) * 30);
        ctx.lineTo(Math.cos(a + 0.15) * 40, -30 + Math.sin(a + 0.15) * 38);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(120,110,150,.85)';
      ctx.beginPath();
      ctx.arc(-14, 0, 10, 0, 7);
      ctx.arc(0, 4, 12, 0, 7);
      ctx.arc(14, 0, 10, 0, 7);
      ctx.fill();
      ctx.fillStyle = hurt ? '#ffd0d0' : '#f4f1ff';
      ctx.beginPath();
      ctx.arc(0, -30, 24, 0, 7);
      ctx.fill();
      const p = game.p;
      const ldx = (p.x - m.x) - (p.y - m.y), ldy = (p.x - m.x) + (p.y - m.y), ll = Math.hypot(ldx, ldy) || 1;
      ctx.fillStyle = '#8a4ae0';
      ctx.beginPath();
      ctx.arc((ldx / ll) * 8, -30 + (ldy / ll) * 6, 11, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#120a1e';
      ctx.beginPath();
      ctx.arc((ldx / ll) * 10, -30 + (ldy / ll) * 7, 5, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#d06a8a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-22, -24);
      ctx.lineTo(-14, -26);
      ctx.moveTo(20, -38);
      ctx.lineTo(13, -36);
      ctx.stroke();
    }
    if (m.flash > 0) {
      ctx.globalAlpha = m.flash;
      ctx.fillStyle = MINI_KINDS[m.kind].color;
      ctx.beginPath();
      ctx.arc(0, -40, 44, 0, 7);
      ctx.globalAlpha = m.flash * 0.35;
      ctx.fill();
    }
    ctx.restore();
  }

  private murk(game: Game, e: Game['enemies'][number], cam: Cam) {
    const ctx = this.ctx;
    const k = ENEMY_KINDS[e.kind];
    const X = this.sx(cam, e.x, e.y), Y = this.sy(cam, e.x, e.y, e.z);
    const hop = Math.abs(Math.sin(e.hop)) * 5;
    const s = k.size;
    ctx.save();
    ctx.translate(X, Y);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * s, 5 * s, 0, 0, 7);
    ctx.fill();
    ctx.translate(0, -hop);
    ctx.scale(s, s);
    const squash = 1 + Math.sin(e.hop * 2) * 0.06;
    // horns
    ctx.fillStyle = k.dark;
    ctx.beginPath();
    ctx.moveTo(-9, -22);
    ctx.lineTo(-12, -34);
    ctx.lineTo(-4, -25);
    ctx.moveTo(9, -22);
    ctx.lineTo(12, -34);
    ctx.lineTo(4, -25);
    ctx.fill();
    // body
    ctx.fillStyle = e.hurtT > 0 ? '#fff' : k.body;
    ctx.beginPath();
    ctx.ellipse(0, -12, 14 / squash, 13 * squash, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = k.dark;
    ctx.beginPath();
    ctx.ellipse(0, -4, 12, 5, 0, 0, Math.PI);
    ctx.fill();
    // eyes look at the hero
    const p = game.p;
    const ldx = (p.x - e.x) - (p.y - e.y), ldy = (p.x - e.x) + (p.y - e.y);
    const ll = Math.hypot(ldx, ldy) || 1;
    const ex = (ldx / ll) * 2, ey = (ldy / ll) * 1.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -15, 4, 0, 7);
    ctx.arc(5, -15, 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = e.aggro ? '#c4001a' : '#1b1b22';
    ctx.beginPath();
    ctx.arc(-5 + ex, -15 + ey, 2, 0, 7);
    ctx.arc(5 + ex, -15 + ey, 2, 0, 7);
    ctx.fill();
    if (e.aggro) {
      ctx.strokeStyle = '#1b1b22';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-9, -21);
      ctx.lineTo(-2, -18);
      ctx.moveTo(9, -21);
      ctx.lineTo(2, -18);
      ctx.stroke();
    }
    ctx.restore();
    if (e.hp < k.hp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(X - 15, Y - 42 * s - hop, 30, 4);
      ctx.fillStyle = k.body;
      ctx.fillRect(X - 15, Y - 42 * s - hop, (30 * e.hp) / k.hp, 4);
    }
  }

  private particle(q: Particle, cam: Cam) {
    const ctx = this.ctx;
    const X = this.sx(cam, q.x, q.y), Y = this.sy(cam, q.x, q.y, q.z);
    const a = Math.max(0, q.life / q.max);
    if (q.gas) {
      ctx.globalAlpha = Math.min(0.45, a * 0.5);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(X, Y, q.size, 0, 7);
      ctx.fill();
    } else if (q.text) {
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `900 ${q.size}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillText(q.text, X + 1, Y + 1);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, X, Y);
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.fillRect(X - q.size / 2, Y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  /** The spreading darkness, the purple gloom near the castle, and light from fires. */
  private drawGloom(game: Game, cam: Cam) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const d = game.won ? Math.max(0, game.gloom * (1 - Math.min(1, game.boss.deadT / 4))) : game.gloom;
    const near = Math.max(0, 1 - Math.hypot(cam.x - CX, cam.y - CY) / 320);
    const left = game.timeLeft;
    let a = 0.04 + 0.6 * Math.pow(d, 1.5) + near * 0.25;
    if (!game.won && left < 300) a += (1 - left / 300) * 0.35;
    a = Math.min(0.97, a);
    if (a < 0.02) return;
    const dc = this.dctx;
    const dw = this.dark.width, dh = this.dark.height;
    dc.setTransform(1, 0, 0, 1, 0, 0);
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, dw, dh);
    dc.fillStyle = `rgba(${Math.round(12 + near * 30)},4,${Math.round(24 + near * 30)},${a})`;
    dc.fillRect(0, 0, dw, dh);
    dc.globalCompositeOperation = 'destination-out';
    const sc = dw / W;
    const hole = (X: number, Y: number, r: number, strength: number) => {
      const gr = dc.createRadialGradient(X * sc, Y * sc, 0, X * sc, Y * sc, r * sc);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gr;
      dc.fillRect((X - r) * sc, (Y - r) * sc, r * 2 * sc, r * 2 * sc);
    };
    const p = game.p;
    hole(this.sx(cam, p.x, p.y), this.sy(cam, p.x, p.y, p.z) - 20, 200, 0.55);
    for (const f of game.fires) {
      const X = this.sx(cam, f.x + 0.5, f.y + 0.5);
      if (X < -300 || X > W + 300) continue;
      const Y = this.sy(cam, f.x + 0.5, f.y + 0.5, game.world.heightAt(f.x, f.y));
      hole(X, Y, 170 + Math.sin(game.time * 9) * 6, 0.85);
    }
    ctx.drawImage(this.dark, 0, 0, W, H);
  }

  // ---------- HUD ----------

  private hud(game: Game, cam: Cam) {
    const ctx = this.ctx;
    const p = game.p;
    const W = this.W, H = this.H;
    // hearts
    const slots = Math.ceil(game.maxHp / 4);
    for (let i = 0; i < slots; i++) {
      const cap = Math.min(4, game.maxHp - i * 4);
      const fill = Math.max(0, Math.min(cap, p.hp - i * 4)) / 4;
      this.heart(18 + (i % 10) * 30, 18 + Math.floor(i / 10) * 28, 11.5, fill, cap / 4);
    }
    ctx.font = 'bold 13px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const rowsY = 18 + Math.floor((slots - 1) / 10) * 28;
    const job = jobById(game.job);
    this.shadowText(job ? `${p.name} · ${job.icon} ${job.name}` : p.name, 14, rowsY + 36, '#fff');
    if (game.challenge) {
      ctx.textAlign = 'center';
      ctx.font = '900 15px ui-rounded, system-ui, sans-serif';
      this.shadowText(`Challenge: ${game.challenge.name} · ${game.enemies.filter((e) => e.ch).length} left`, this.W / 2, 100, '#7fdcff');
    }
    if (game.work) {
      const w = game.work;
      const X = this.sx(cam, p.x, p.y), Y = this.sy(cam, p.x, p.y, p.z) - 78;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(X - 30, Y, 60, 8);
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(X - 29, Y + 1, 58 * Math.min(1, w.t / w.max), 6);
      ctx.font = 'bold 12px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      this.shadowText(`${w.label}…`, X, Y - 4, '#fff');
    }

    // timer
    const left = game.timeLeft;
    const hh = Math.floor(left / 3600), mm = Math.floor((left % 3600) / 60), ss = Math.floor(left % 60);
    const txt = game.won ? 'The gloom is lifting!' : `Darkness in ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    ctx.textAlign = 'center';
    ctx.font = '900 18px ui-rounded, system-ui, sans-serif';
    this.shadowText(txt, W / 2, 28, left < 600 && !game.won ? '#ff7ad9' : '#e9d8ff');
    // compass to the castle
    if (!game.won) {
      const dx = CX + 0.5 - p.x, dy = CY + 0.5 - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        const sdx = dx - dy, sdy = (dx + dy) / 2;
        const a = Math.atan2(sdy, sdx);
        ctx.save();
        ctx.translate(W / 2, 52);
        ctx.rotate(a);
        ctx.fillStyle = '#b77cff';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.font = 'bold 12px ui-rounded, system-ui, sans-serif';
        this.shadowText(`Castle ${Math.round(dist).toLocaleString()} tiles`, W / 2, 76, '#d9c6ff');
      }
    }
    if (game.job === 'courier' && game.letterTo !== null) {
      const v = VILLAGES[game.letterTo];
      const dx = v.x + 0.5 - p.x, dy = v.y + 0.5 - p.y;
      const a = Math.atan2((dx + dy) / 2, dx - dy);
      ctx.save();
      ctx.translate(W / 2 + 150, 52);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 12px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      this.shadowText(`✉ ${v.name} ${Math.round(Math.hypot(dx, dy))}`, W / 2 + 150, 76, '#ffe9a0');
    }
    // boss bar
    const b = game.boss;
    if (b.active && !b.dead) {
      const bw = Math.min(440, W - 60);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(W / 2 - bw / 2 - 3, H - 182, bw + 6, 18);
      const gr = ctx.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0);
      gr.addColorStop(0, '#5a1a8a');
      gr.addColorStop(1, '#c03ad6');
      ctx.fillStyle = gr;
      ctx.fillRect(W / 2 - bw / 2, H - 179, (bw * b.hp) / 500, 12);
      ctx.font = '900 13px ui-rounded, system-ui, sans-serif';
      this.shadowText(`The Dark Beast  ${b.hp} / 500`, W / 2, H - 188, '#f0d8ff');
    }

    const mb = game.minis.current();
    if (mb) {
      const k = MINI_KINDS[mb.kind];
      const bw = Math.min(360, W - 60);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(W / 2 - bw / 2 - 3, H - 182, bw + 6, 16);
      ctx.fillStyle = k.color;
      ctx.fillRect(W / 2 - bw / 2, H - 179, (bw * mb.hp) / k.hp, 10);
      ctx.font = '900 13px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      this.shadowText(`${k.name}  ${mb.hp} / ${k.hp}`, W / 2, H - 188, '#fff');
    }

    // stamina ring next to the hero
    if (p.stamina < 0.999 || p.climbing) {
      const X = this.sx(cam, p.x, p.y) + 22, Y = this.sy(cam, p.x, p.y, p.z) - 40;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath();
      ctx.arc(X, Y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = p.stamina < 0.25 ? (Math.floor(game.time * 8) % 2 ? '#ff4d4d' : '#ffb03a') : '#5fe07a';
      ctx.beginPath();
      ctx.arc(X, Y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.stamina);
      ctx.stroke();
    }

    // gear bar
    const items: [string, string][] = [
      ['⚔', `${swordName(game.swordDmg)} · ${game.swordDmg}`],
      ['🏹', `${bowName(game.bowDmg)} · ${game.bowDmg}  (${game.arrows} arrows)`],
      ['🪵', `${game.wood}`],
      ['🪙', `${game.coins}`],
      ['🍎', `${game.apples}`],
      ['🌰', `${game.acorns}`],
    ];
    ctx.font = 'bold 13px ui-rounded, system-ui, sans-serif';
    let total = 0;
    const widths = items.map(([i, s]) => ctx.measureText(`${i} ${s}`).width + 22);
    widths.forEach((w) => (total += w + 6));
    let xx = Math.max(8, W / 2 - total / 2);
    const yy = H - 44;
    items.forEach(([i, s], k) => {
      ctx.fillStyle = 'rgba(15,12,25,.72)';
      ctx.beginPath();
      ctx.roundRect(xx, yy, widths[k], 30, 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`${i} ${s}`, xx + 11, yy + 20);
      xx += widths[k] + 6;
    });

    // prompt
    const near = game.nearSomething();
    if (near) {
      ctx.font = '900 14px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      this.shadowText(`[E] ${near}`, this.sx(cam, p.x, p.y), this.sy(cam, p.x, p.y, p.z) - 66, '#ffe27a');
    }

    // toasts
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px ui-rounded, system-ui, sans-serif';
    game.toasts.forEach((tt, i) => {
      const w = ctx.measureText(tt.text).width + 30;
      const y = (game.challenge ? 112 : 100) + i * 36;
      ctx.globalAlpha = Math.min(1, tt.t * 2);
      ctx.fillStyle = 'rgba(20,14,34,.88)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - w / 2, y, w, 28, 14);
      ctx.fill();
      ctx.strokeStyle = '#b77cff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(tt.text, W / 2, y + 19);
      ctx.globalAlpha = 1;
    });

    this.minimap(game, cam);

    if (game.knockedOut > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, (2.2 - game.knockedOut) * 0.6)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = '900 30px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      this.shadowText('Knocked out…', W / 2, H / 2, '#fff');
    }
  }

  private shadowText(s: string, x: number, y: number, col: string) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillText(s, x + 1.5, y + 1.5);
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  }

  heart(x: number, y: number, r: number, fill: number, part = 1) {
    const ctx = this.ctx;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.95);
      ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.2, x, y - r * 0.45);
      ctx.bezierCurveTo(x + r * 0.75, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.95);
      ctx.closePath();
    };
    if (part < 1) {
      // a heart you have only part of: draw just that slice of the outline
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r * 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * part);
      ctx.closePath();
      ctx.clip();
    }
    path();
    ctx.fillStyle = 'rgba(40,10,20,.7)';
    ctx.fill();
    if (fill > 0) {
      ctx.save();
      path();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r * 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
      ctx.closePath();
      ctx.fillStyle = '#ff3b55';
      ctx.fill();
      ctx.restore();
    }
    path();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (part < 1) ctx.restore();
  }

  /** Small map in the corner, built a few rows per frame so it never stutters. */
  private minimap(game: Game, cam: Cam) {
    const ctx = this.ctx;
    const p = game.p;
    const N = 128, SCALE = 2;
    if (!this.miniBuild && (Math.abs(p.x - this.miniCenter.x) > 40 || Math.abs(p.y - this.miniCenter.y) > 40)) {
      this.miniBuild = { x: Math.floor(p.x), y: Math.floor(p.y), row: 0, img: this.mctx.createImageData(N, N) };
    }
    const mb = this.miniBuild;
    if (mb) {
      const seed = game.world.seed;
      const rows = this.miniCenter.x < -1e8 ? N : 6;
      for (let r = 0; r < rows && mb.row < N; r++, mb.row++) {
        for (let c = 0; c < N; c++) {
          const wx = mb.x + (c - N / 2) * SCALE, wy = mb.y + (mb.row - N / 2) * SCALE;
          const v = gen(wx, wy, seed);
          const col = MINI_COL[tG(v)] ?? [0, 0, 0];
          const f = 0.75 + Math.min(tH(v), 24) * 0.018;
          const tree = tT(v) === T.Oak || tT(v) === T.Pine ? 0.8 : 1;
          const i = (mb.row * N + c) * 4;
          mb.img.data[i] = col[0] * f * tree;
          mb.img.data[i + 1] = col[1] * f * tree;
          mb.img.data[i + 2] = col[2] * f * tree;
          mb.img.data[i + 3] = 255;
        }
      }
      if (mb.row >= N) {
        this.mctx.putImageData(mb.img, 0, 0);
        this.miniCenter = { x: mb.x, y: mb.y };
        this.miniBuild = null;
      }
    }
    const size = 150;
    const X0 = this.W - size - 14, Y0 = 14;
    ctx.save();
    ctx.beginPath();
    ctx.arc(X0 + size / 2, Y0 + size / 2, size / 2, 0, 7);
    ctx.fillStyle = '#10141c';
    ctx.fill();
    ctx.clip();
    // map is drawn north-up in world axes, rotated 45° so it matches the isometric view
    ctx.translate(X0 + size / 2, Y0 + size / 2);
    ctx.scale(1, 0.62);
    ctx.rotate(Math.PI / 4);
    const k = 1.15;
    const ox = (this.miniCenter.x - p.x) / SCALE, oy = (this.miniCenter.y - p.y) / SCALE;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mini, (-N / 2 + ox) * k, (-N / 2 + oy) * k, N * k, N * k);
    ctx.imageSmoothingEnabled = true;
    const dot = (wx: number, wy: number, col: string, r: number) => {
      const dx = ((wx - p.x) / SCALE) * k, dy = ((wy - p.y) / SCALE) * k;
      if (Math.abs(dx) > 90 || Math.abs(dy) > 90) return;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, 7);
      ctx.fill();
    };
    for (const st of game.stones()) if (!game.stoneDone(st)) dot(st.x, st.y, '#5ad0ff', 3);
    for (const v of VILLAGES) dot(v.x, v.y, '#ff9a5a', 5);
    for (const m of game.minis.list) if (!m.dead) dot(m.homeX, m.homeY, MINI_KINDS[m.kind].color, 6);
    for (const f of game.fires) dot(f.x, f.y, '#ff7a2a', 2.5);
    dot(CX, CY, '#b03ad6', 6);
    ctx.restore();
    // hero at centre
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(X0 + size / 2, Y0 + size / 2, 3.5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X0 + size / 2, Y0 + size / 2, size / 2, 0, 7);
    ctx.stroke();
  }
}

const MINI_COL: Record<number, [number, number, number]> = {
  [G.Grass]: [99, 176, 75], [G.Forest]: [60, 130, 52], [G.Sand]: [227, 208, 143], [G.Water]: [59, 127, 198],
  [G.Rock]: [145, 140, 132], [G.Snow]: [238, 243, 248], [G.Dirt]: [168, 137, 90], [G.Path]: [215, 180, 120],
  [G.Bridge]: [155, 107, 60], [G.Gloom]: [94, 83, 115], [G.Stone]: [140, 137, 150], [G.Floor]: [110, 107, 120], [G.Dark]: [60, 30, 80],
  [G.Roof]: [196, 83, 58], [G.Farm]: [122, 82, 48],
};
