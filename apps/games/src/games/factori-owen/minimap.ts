// The map in the top right: shows every tile the player has seen, plus buildings and bug nests there.
// Click it to open the whole explored world.

import { Ground, Res, WORLD, type World } from './world';
import type { Game } from './sim';

/** Tiles you can see around you while walking. */
export const REVEAL_RADIUS = 18;

const GROUND: Record<number, [number, number, number]> = {
  [Ground.Grass]: [70, 104, 56],
  [Ground.Dry]: [100, 110, 62],
  [Ground.Dirt]: [104, 86, 60],
  [Ground.Sand]: [170, 154, 110],
  [Ground.Water]: [40, 78, 122],
};
const RES: Record<number, [number, number, number]> = {
  [Res.Owen]: [110, 135, 230],
  [Res.Copper]: [214, 120, 64],
  [Res.Coal]: [26, 26, 30],
  [Res.Stone]: [176, 160, 136],
};
const TREE: [number, number, number] = [36, 66, 34];
const BUILDING: [number, number, number] = [196, 200, 208];
const BELT: [number, number, number] = [226, 180, 60];
const FOG: [number, number, number] = [12, 16, 24];

/** Marks tiles around (x, y) as explored. Cheap to call every frame: it only works when you step onto a new tile. */
export function explore(g: Game, x: number, y: number, r = REVEAL_RADIUS) {
  const tx = Math.floor(x), ty = Math.floor(y);
  const key = ty * WORLD + tx;
  if (key === g.exploredAt) return;
  g.exploredAt = key;
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy++) {
    const yy = ty + dy;
    if (yy < 0 || yy >= WORLD) continue;
    for (let dx = -r; dx <= r; dx++) {
      const xx = tx + dx;
      if (xx < 0 || xx >= WORLD || dx * dx + dy * dy > r2) continue;
      g.explored[yy * WORLD + xx] = 1;
    }
  }
}

export function packExplored(a: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length >> 3);
  for (let i = 0; i < a.length; i++) if (a[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}

export function unpackExplored(bits: Uint8Array, into: Uint8Array) {
  for (let i = 0; i < into.length; i++) into[i] = (bits[i >> 3] >> (i & 7)) & 1;
}

function tileColor(w: World, i: number): [number, number, number] {
  if (w.tree[i]) return TREE;
  if (w.res[i] && w.amount[i] > 0) return RES[w.res[i]];
  return GROUND[w.ground[i]];
}

export class Minimap {
  /** One pixel per tile, the whole world. */
  private full = document.createElement('canvas');
  private fctx: CanvasRenderingContext2D;
  private img: ImageData;
  private last = -1;
  private lastGame: Game | null = null;
  /** Explored area: centre and size in tiles, for the big map. */
  private box = { x: WORLD / 2, y: WORLD / 2, span: WORLD };

  constructor(private canvas: HTMLCanvasElement, private big: HTMLCanvasElement) {
    this.full.width = this.full.height = WORLD;
    this.fctx = this.full.getContext('2d')!;
    this.img = this.fctx.createImageData(WORLD, WORLD);
  }

  /** Rebuilds the world image (about every half second). */
  private rebuild(g: Game) {
    const w = g.world;
    const d = this.img.data;
    let x0 = WORLD, y0 = WORLD, x1 = 0, y1 = 0;
    for (let i = 0; i < WORLD * WORLD; i++) {
      if (g.explored[i]) {
        const x = i % WORLD, y = (i / WORLD) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const c = g.explored[i] ? tileColor(w, i) : FOG;
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }
    for (const e of g.ents.values()) {
      const col = e.def.kind === 'belt' ? BELT : BUILDING;
      for (let y = e.y; y < e.y + e.h; y++) {
        for (let x = e.x; x < e.x + e.w; x++) {
          const i = y * WORLD + x;
          if (i < 0 || i >= WORLD * WORLD || !g.explored[i]) continue;
          d[i * 4] = col[0];
          d[i * 4 + 1] = col[1];
          d[i * 4 + 2] = col[2];
        }
      }
    }
    for (const n of g.cs.nests) {
      const nx = Math.floor(n.x), ny = Math.floor(n.y);
      for (let y = ny - 1; y <= ny + 1; y++) {
        for (let x = nx - 1; x <= nx + 1; x++) {
          const i = y * WORLD + x;
          if (x < 0 || y < 0 || x >= WORLD || y >= WORLD || !g.explored[i]) continue;
          d[i * 4] = 230;
          d[i * 4 + 1] = 60;
          d[i * 4 + 2] = 50;
        }
      }
    }
    this.fctx.putImageData(this.img, 0, 0);
    this.box = x1 < x0
      ? { x: g.px, y: g.py, span: 64 }
      : { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2, span: Math.min(WORLD, Math.max(64, x1 - x0 + 17, y1 - y0 + 17)) };
  }

  draw(g: Game, others: { x: number; y: number }[], frame: number, bigOpen: boolean) {
    if (g !== this.lastGame || frame - this.last >= 60) {
      this.lastGame = g;
      this.rebuild(g);
      this.last = frame;
    }
    this.drawInto(this.canvas, g, others, 80, g.px, g.py);
    if (bigOpen) this.drawInto(this.big, g, others, this.box.span, this.box.x, this.box.y);
  }

  /** Draws `span` tiles around (cx, cy) into a canvas. */
  private drawInto(cv: HTMLCanvasElement, g: Game, others: { x: number; y: number }[], span: number, cx: number, cy: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = `rgb(${FOG.join(',')})`;
    c.fillRect(0, 0, W, H);
    const scale = Math.min(W, H) / span;
    const ox = W / 2 - cx * scale, oy = H / 2 - cy * scale;
    c.drawImage(this.full, ox, oy, WORLD * scale, WORLD * scale);
    const dot = (x: number, y: number, col: string, r: number) => {
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(ox + x * scale, oy + y * scale, r + dpr, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.arc(ox + x * scale, oy + y * scale, r, 0, Math.PI * 2);
      c.fill();
    };
    for (const o of others) dot(o.x, o.y, '#7fe0ff', 2.5 * dpr);
    dot(g.px, g.py, '#ffe066', 3 * dpr);
  }
}
