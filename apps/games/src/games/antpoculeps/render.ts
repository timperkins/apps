// Draws the yard and the ants on a canvas. All art is drawn in code (original).
import { FOOD, PLAYER_COLORS, STAGES, WORLD, type FoodKind } from './data';
import type { World } from './world';

export interface ViewAnt {
  id: number;
  slot: number;
  name: string;
  level: number;
  rebirths: number;
  x: number;
  y: number;
  a: number;
  moving: boolean;
  bite: number;
  hurt: number;
  hp: number; // 0..1
  dead: boolean;
}
export interface ViewFood { id: number; x: number; y: number; k: FoodKind; v: number }
interface Pop { x: number; y: number; t: number; text?: string; color: string; size: number; kind: 'puff' | 'text' | 'snap' | 'ring' }

const CHUNK = 512;
const RES = 1.25;

export class Renderer {
  ctx: CanvasRenderingContext2D;
  private chunks = new Map<string, HTMLCanvasElement>();
  private canopies = new Map<number, HTMLCanvasElement>();
  private walk = new Map<number, number>();
  private pops: Pop[] = [];
  camX = WORLD / 2;
  camY = WORLD / 2;
  scale = 1;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(public canvas: HTMLCanvasElement, public world: World) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  pop(p: Omit<Pop, 't'>) {
    this.pops.push({ ...p, t: 0 });
  }

  /** world point -> screen point */
  toScreen(x: number, y: number): [number, number] {
    return [(x - this.camX) * this.scale + this.w / 2, (y - this.camY) * this.scale + this.h / 2];
  }

  draw(ants: ViewAnt[], food: Iterable<ViewFood>, me: ViewAnt | undefined, dt: number, time: number) {
    const { ctx } = this;
    if (this.canvas.width !== Math.round(this.canvas.clientWidth * this.dpr)) this.resize();
    // zoom out as the ant grows
    const size = me ? STAGES[me.level].size : 40;
    const want = Math.min(this.w, this.h) / (300 + size * 5);
    this.scale += (want - this.scale) * Math.min(1, dt * 3);
    if (me) {
      this.camX += (me.x - this.camX) * Math.min(1, dt * 8);
      this.camY += (me.y - this.camY) * Math.min(1, dt * 8);
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#2f5a24';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.camX, -this.camY);
    const vw = this.w / 2 / this.scale, vh = this.h / 2 / this.scale;
    const x0 = this.camX - vw, x1 = this.camX + vw, y0 = this.camY - vh, y1 = this.camY + vh;

    // ground
    for (let cy = Math.max(0, Math.floor(y0 / CHUNK)); cy <= Math.min(Math.floor((WORLD - 1) / CHUNK), Math.floor(y1 / CHUNK)); cy++) {
      for (let cx = Math.max(0, Math.floor(x0 / CHUNK)); cx <= Math.min(Math.floor((WORLD - 1) / CHUNK), Math.floor(x1 / CHUNK)); cx++) {
        ctx.drawImage(this.chunk(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
      }
    }
    // water shimmer
    for (const p of this.world.puddles) {
      if (p.x + p.r < x0 || p.x - p.r > x1 || p.y + p.r < y0 || p.y - p.r > y1) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const ph = (time * 0.5 + i / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.ellipse(p.x - p.r * 0.2, p.y - p.r * 0.15, p.r * 0.3 * (0.4 + ph), p.r * 0.15 * (0.4 + ph), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // world edge
    ctx.strokeStyle = 'rgba(20,40,10,.8)';
    ctx.lineWidth = 30;
    ctx.strokeRect(-15, -15, WORLD + 30, WORLD + 30);
    ctx.lineWidth = 1;

    // food
    for (const f of food) {
      if (f.x < x0 - 30 || f.x > x1 + 30 || f.y < y0 - 30 || f.y > y1 + 30) continue;
      drawFood(ctx, f, time);
    }

    // ants, small ones first so big ones walk over them
    const sorted = ants.filter((a) => !a.dead && a.x > x0 - 150 && a.x < x1 + 150 && a.y > y0 - 150 && a.y < y1 + 150).sort((p, q) => p.level - q.level);
    for (const a of sorted) {
      const ph = (this.walk.get(a.id) ?? Math.random() * 10) + (a.moving ? dt * (9 + 120 / STAGES[a.level].size) : 0);
      this.walk.set(a.id, ph);
      if (a.slot >= 0) {
        ctx.fillStyle = PLAYER_COLORS[a.slot % PLAYER_COLORS.length];
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, STAGES[a.level].size * 0.55, STAGES[a.level].size * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      drawAnt(ctx, a, ph, time);
    }

    // pops: bite snaps, puffs, numbers
    for (const p of this.pops) {
      p.t += dt;
      const k = p.t / (p.kind === 'text' ? 1.1 : 0.5);
      if (k >= 1) continue;
      ctx.globalAlpha = 1 - k;
      if (p.kind === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `900 ${p.size}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.lineWidth = p.size / 6;
        ctx.strokeText(p.text!, p.x, p.y - k * 40);
        ctx.fillText(p.text!, p.x, p.y - k * 40);
      } else if (p.kind === 'snap') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size / 6;
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(ang) * p.size * (0.3 + k), p.y + Math.sin(ang) * p.size * (0.3 + k));
          ctx.lineTo(p.x + Math.cos(ang) * p.size * (0.6 + k), p.y + Math.sin(ang) * p.size * (0.6 + k));
          ctx.stroke();
        }
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.3 + k * 1.4), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2 + p.x;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(ang) * p.size * k, p.y + Math.sin(ang) * p.size * k, p.size * 0.22 * (1 - k), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    this.pops = this.pops.filter((p) => p.t < (p.kind === 'text' ? 1.1 : 0.5));

    // tree canopies over everything; see-through when you're under one
    for (const t of this.world.trees) {
      if (t.x + t.canopy * 1.3 < x0 || t.x - t.canopy * 1.3 > x1 || t.y + t.canopy * 1.3 < y0 || t.y - t.canopy * 1.3 > y1) continue;
      const under = me && Math.hypot(me.x - t.x, me.y - t.y) < t.canopy * 1.1;
      ctx.globalAlpha = under ? 0.3 : 0.9;
      const c = this.canopy(t.x, t.y, this.world.trees.indexOf(t));
      ctx.drawImage(c, t.x - c.width / 2, t.y - c.height / 2);
    }
    ctx.globalAlpha = 1;

    // names and health bars
    for (const a of sorted) {
      const st = STAGES[a.level];
      const top = a.y - st.size * 0.62 - 10 / this.scale;
      const bw = Math.max(34, st.size * 0.9), bh = Math.max(5, 6 / this.scale);
      if (a.slot >= 0 || a.hp < 0.999) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(a.x - bw / 2 - 1, top - 1, bw + 2, bh + 2);
        ctx.fillStyle = a.hp > 0.5 ? '#6ee34f' : a.hp > 0.25 ? '#ffc93a' : '#ff4a3a';
        ctx.fillRect(a.x - bw / 2, top, bw * Math.max(0, a.hp), bh);
      }
      const fs = Math.max(11, 13 / this.scale);
      ctx.font = `800 ${fs}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = fs / 4;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      const label = a.slot >= 0 ? `${a.name}${a.rebirths ? ' ' + '★' + a.rebirths : ''}` : `L${a.level}`;
      ctx.fillStyle = a.slot >= 0 ? PLAYER_COLORS[a.slot % PLAYER_COLORS.length] : me && a.level > me.level ? '#ff9a8a' : '#f2f2e8';
      ctx.strokeText(label, a.x, top - 4 / this.scale);
      ctx.fillText(label, a.x, top - 4 / this.scale);
    }
    ctx.restore();
  }

  private chunk(cx: number, cy: number): HTMLCanvasElement {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) {
      this.chunks.delete(key);
      this.chunks.set(key, c); // most recently used last
      return c;
    }
    c = document.createElement('canvas');
    c.width = c.height = Math.round(CHUNK * RES);
    const g = c.getContext('2d')!;
    g.scale(RES, RES);
    g.translate(-cx * CHUNK, -cy * CHUNK);
    paintGround(g, this.world, cx * CHUNK, cy * CHUNK, CHUNK);
    this.chunks.set(key, c);
    if (this.chunks.size > 48) this.chunks.delete(this.chunks.keys().next().value!);
    return c;
  }

  private canopy(x: number, y: number, i: number): HTMLCanvasElement {
    let c = this.canopies.get(i);
    if (c) return c;
    const t = this.world.trees[i];
    const size = Math.ceil(t.canopy * 2.6);
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.translate(size / 2, size / 2);
    const dark = `hsl(${t.hue} 45% 22%)`, mid = `hsl(${t.hue} 48% 32%)`, light = `hsl(${t.hue} 55% 42%)`;
    // shadow ring then blobs
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (const b of t.blobs) { g.beginPath(); g.arc(Math.cos(b.a) * b.d + 12, Math.sin(b.a) * b.d + 16, b.r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = dark;
    for (const b of t.blobs) { g.beginPath(); g.arc(Math.cos(b.a) * b.d, Math.sin(b.a) * b.d, b.r, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(0, 0, t.canopy * 0.65, 0, Math.PI * 2); g.fill();
    g.fillStyle = mid;
    for (const b of t.blobs) { g.beginPath(); g.arc(Math.cos(b.a) * b.d * 0.92 - 6, Math.sin(b.a) * b.d * 0.92 - 8, b.r * 0.8, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = light;
    for (const b of t.blobs) { g.beginPath(); g.arc(Math.cos(b.a) * b.d * 0.8 - 14, Math.sin(b.a) * b.d * 0.8 - 16, b.r * 0.42, 0, Math.PI * 2); g.fill(); }
    // little leaf ticks
    g.strokeStyle = `hsl(${t.hue} 50% 18%)`;
    g.lineWidth = 3;
    for (let k = 0; k < 90; k++) {
      const a = (k * 2.39996) % (Math.PI * 2), d = Math.sqrt((k + 0.5) / 90) * t.canopy * 1.05;
      g.beginPath(); g.moveTo(Math.cos(a) * d, Math.sin(a) * d); g.lineTo(Math.cos(a) * d + 6, Math.sin(a) * d + 4); g.stroke();
    }
    void x; void y;
    this.canopies.set(i, c);
    return c;
  }
}

function paintGround(g: CanvasRenderingContext2D, w: World, ox: number, oy: number, n: number) {
  const pad = 260;
  const inside = (x: number, y: number, r: number) => x + r > ox - 2 && x - r < ox + n + 2 && y + r > oy - 2 && y - r < oy + n + 2;
  g.fillStyle = '#4c8a34';
  g.fillRect(ox, oy, n, n);
  // soft light/dark patches
  for (const d of w.dirt) {
    if (!inside(d.x, d.y, d.r)) continue;
    const grad = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    grad.addColorStop(0, 'rgba(120,92,52,.75)');
    grad.addColorStop(0.7, 'rgba(120,92,52,.35)');
    grad.addColorStop(1, 'rgba(120,92,52,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
  }
  // grass blades
  for (const t of w.tufts) {
    if (!inside(t.x, t.y, 14)) continue;
    g.strokeStyle = t.c < 0.33 ? '#3e7a2a' : t.c < 0.66 ? '#5c9e3c' : '#6fb046';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let k = -1; k <= 1; k++) {
      g.moveTo(t.x + k * 2, t.y);
      g.lineTo(t.x + k * 4 + t.a * t.s, t.y - t.s * (k === 0 ? 1 : 0.75));
    }
    g.stroke();
  }
  // beaches and puddles
  for (const p of w.puddles) {
    if (!inside(p.x, p.y, p.r + p.beach + 10)) continue;
    const shape = (scale: number, extra: number) => {
      g.beginPath();
      const m = p.pts.length;
      for (let k = 0; k <= m; k++) {
        const a = (k / m) * Math.PI * 2, rr = p.r * p.pts[k % m] * scale + extra;
        const px = p.x + Math.cos(a) * rr, py = p.y + Math.sin(a) * rr;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
    };
    if (p.beach) {
      g.fillStyle = '#e6d39a'; shape(1, p.beach); g.fill();
      g.fillStyle = 'rgba(160,130,80,.35)';
      for (let k = 0; k < 40; k++) {
        const a = k * 2.4, d = p.r + (k % 7) / 7 * p.beach;
        g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.5, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#d4bd7c'; shape(1, 10); g.fill();
    } else {
      g.fillStyle = '#5a4630'; shape(1, 8); g.fill();
    }
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.1);
    grad.addColorStop(0, '#2a6fb0');
    grad.addColorStop(0.75, '#3f8fd0');
    grad.addColorStop(1, '#79c3ec');
    g.fillStyle = grad; shape(1, 0); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; shape(0.5, 0); g.fill();
  }
  // big leaves on the ground
  for (const l of w.leaves) {
    if (!inside(l.x, l.y, l.len)) continue;
    g.save();
    g.translate(l.x, l.y);
    g.rotate(l.a);
    g.fillStyle = 'rgba(0,0,0,.18)';
    leafPath(g, l.len, 4, 5); g.fill();
    g.fillStyle = l.color;
    leafPath(g, l.len, 0, 0); g.fill();
    g.strokeStyle = l.vein;
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(-l.len / 2 - 10, 0); g.lineTo(l.len / 2, 0); g.stroke();
    g.lineWidth = 1.5;
    for (let k = -3; k <= 3; k++) {
      const x = (k / 4) * l.len * 0.4;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + l.len * 0.12, -l.len * 0.16); g.moveTo(x, 0); g.lineTo(x + l.len * 0.12, l.len * 0.16); g.stroke();
    }
    g.restore();
  }
  // plants
  for (const p of w.plants) {
    if (!inside(p.x, p.y, p.s * 1.2)) continue;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.a);
    if (p.kind === 'clover') {
      g.fillStyle = '#3f9a3a';
      for (let k = 0; k < 3; k++) {
        g.rotate((Math.PI * 2) / 3);
        g.beginPath(); g.arc(p.s * 0.32, 0, p.s * 0.3, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.25)';
      for (let k = 0; k < 3; k++) { g.rotate((Math.PI * 2) / 3); g.beginPath(); g.arc(p.s * 0.3, 0, p.s * 0.1, 0, Math.PI * 2); g.fill(); }
    } else if (p.kind === 'fern') {
      g.strokeStyle = '#2f7a2c';
      g.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        g.rotate((Math.PI * 2) / 5);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(p.s, 0); g.stroke();
        for (let j = 1; j < 5; j++) {
          const x = (j / 5) * p.s;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, -p.s * 0.18 * (1 - j / 6)); g.moveTo(x, 0); g.lineTo(x + 4, p.s * 0.18 * (1 - j / 6)); g.stroke();
        }
      }
    } else if (p.kind === 'mushroom') {
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(4, 5, p.s * 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c8402e'; g.beginPath(); g.arc(0, 0, p.s * 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff4e0';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(Math.cos(k * 1.3) * p.s * 0.28, Math.sin(k * 1.3) * p.s * 0.28, p.s * 0.08, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(3, 4, p.s * 0.45, p.s * 0.32, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8f8a80'; g.beginPath(); g.ellipse(0, 0, p.s * 0.45, p.s * 0.32, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b4afa4'; g.beginPath(); g.ellipse(-p.s * 0.1, -p.s * 0.08, p.s * 0.22, p.s * 0.14, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // flowers
  for (const f of w.flowers) {
    if (!inside(f.x, f.y, f.r * 1.3)) continue;
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.a);
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.arc(3, 4, f.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = f.color;
    for (let k = 0; k < f.petals; k++) {
      g.rotate((Math.PI * 2) / f.petals);
      g.beginPath(); g.ellipse(f.r * 0.55, 0, f.r * 0.5, f.r * 0.28, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = f.center;
    g.beginPath(); g.arc(0, 0, f.r * 0.3, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // tree trunks and roots (the canopy is drawn later, on top)
  for (const t of w.trees) {
    if (!inside(t.x, t.y, t.trunk * 2.2)) continue;
    g.strokeStyle = '#5a3c22';
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + t.hue;
      g.lineWidth = t.trunk * 0.35;
      g.beginPath(); g.moveTo(t.x, t.y); g.quadraticCurveTo(t.x + Math.cos(a + 0.3) * t.trunk * 1.4, t.y + Math.sin(a + 0.3) * t.trunk * 1.4, t.x + Math.cos(a) * t.trunk * 2, t.y + Math.sin(a) * t.trunk * 2); g.stroke();
    }
    g.fillStyle = '#6b4728';
    g.beginPath(); g.arc(t.x, t.y, t.trunk, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a2f18';
    g.lineWidth = 3;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(t.x, t.y, t.trunk * k / 4, 0, Math.PI * 2); g.stroke(); }
  }
  void pad;
}

function leafPath(g: CanvasRenderingContext2D, len: number, dx: number, dy: number) {
  g.beginPath();
  g.moveTo(-len / 2 + dx, dy);
  g.quadraticCurveTo(dx, -len * 0.38 + dy, len / 2 + dx, dy);
  g.quadraticCurveTo(dx, len * 0.38 + dy, -len / 2 + dx, dy);
  g.closePath();
}

function drawFood(g: CanvasRenderingContext2D, f: ViewFood, time: number) {
  const r = f.k === 'meat' ? Math.min(20, 6 + Math.sqrt(f.v) * 1.3) : FOOD[f.k].r;
  const bob = Math.sin(time * 3 + f.id) * 0.08 + 1;
  g.save();
  g.translate(f.x, f.y);
  g.scale(bob, bob);
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(2, 3, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
  switch (f.k) {
    case 'crumb':
      g.fillStyle = '#e0b46a'; g.beginPath(); g.moveTo(-r, -r * 0.3); g.lineTo(-r * 0.2, -r); g.lineTo(r, -r * 0.2); g.lineTo(r * 0.4, r); g.lineTo(-r * 0.8, r * 0.6); g.closePath(); g.fill();
      break;
    case 'seed':
      g.rotate(f.id);
      g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e8e0c8'; g.lineWidth = 1; g.beginPath(); g.moveTo(-r * 0.7, 0); g.lineTo(r * 0.7, 0); g.stroke();
      break;
    case 'berry':
      g.fillStyle = '#c0204a'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(-r * 0.35, -r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a8a2a'; g.fillRect(-1, -r - 3, 2, 4);
      break;
    case 'sugar':
      g.fillStyle = '#ffffff'; g.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      g.fillStyle = '#e4ecf4'; g.fillRect(-r * 0.8, r * 0.2, r * 1.6, r * 0.6);
      g.strokeStyle = '#c8d4e0'; g.lineWidth = 1; g.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      break;
    case 'cookie':
      g.fillStyle = '#c98a3e'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a2a14';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(Math.cos(k * 2.1) * r * 0.55, Math.sin(k * 2.1) * r * 0.55, r * 0.14, 0, Math.PI * 2); g.fill(); }
      break;
    case 'apple':
      g.fillStyle = '#f4e6c0'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d0342a'; g.lineWidth = r * 0.22; g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#5a3a1a';
      g.beginPath(); g.ellipse(-r * 0.2, 0, r * 0.12, r * 0.2, 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(r * 0.2, 0, r * 0.12, r * 0.2, -0.3, 0, Math.PI * 2); g.fill();
      break;
    case 'meat':
      g.rotate(f.id * 0.7);
      g.fillStyle = '#c4443a'; g.beginPath(); g.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e88a7a'; g.beginPath(); g.ellipse(-r * 0.2, -r * 0.15, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f8f0e0'; g.beginPath(); g.arc(r * 0.45, r * 0.2, r * 0.18, 0, Math.PI * 2); g.fill();
      void time;
      break;
  }
  g.restore();
}

/** Draw one ant (or egg), facing +x, with six walking legs. */
export function drawAnt(g: CanvasRenderingContext2D, a: ViewAnt, walk: number, time: number) {
  const st = STAGES[a.level];
  const L = st.size;
  g.save();
  g.translate(a.x, a.y);
  if (a.level === 0) {
    // the egg: wobbles as it rolls
    g.rotate(a.moving ? Math.sin(walk * 0.8) * 0.35 : Math.sin(time * 2) * 0.05);
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.ellipse(2, 4, L * 0.42, L * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = a.hurt > 0 ? '#ffb0a0' : st.body;
    g.beginPath(); g.ellipse(0, 0, L * 0.42, L * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = st.belly;
    g.beginPath(); g.ellipse(L * 0.08, L * 0.12, L * 0.3, L * 0.38, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath(); g.ellipse(-L * 0.14, -L * 0.22, L * 0.1, L * 0.15, -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9b48a';
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(Math.cos(k * 1.9) * L * 0.22, Math.sin(k * 1.9) * L * 0.3, L * 0.035, 0, Math.PI * 2); g.fill(); }
    if (a.rebirths) {
      g.strokeStyle = '#ffd84a'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, 0, L * 0.5, L * 0.63, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
    return;
  }
  g.rotate(a.a);
  const lunge = a.bite > 0 ? Math.sin((a.bite / 0.22) * Math.PI) * L * 0.08 : 0;
  g.translate(lunge, 0);

  // aura for the late stages
  if (st.fx === 'shadow' || st.fx === 'galaxy' || st.fx === 'cosmic' || st.fx === 'lava' || st.fx === 'fire' || st.fx === 'spark' || st.fx === 'crystal') {
    const col = { shadow: 'rgba(90,40,160,', galaxy: 'rgba(150,90,255,', cosmic: 'rgba(120,200,255,', lava: 'rgba(255,110,20,', fire: 'rgba(255,140,30,', spark: 'rgba(120,170,255,', crystal: 'rgba(160,240,255,' }[st.fx];
    const pulse = 0.25 + Math.sin(time * 3) * 0.08;
    const grad = g.createRadialGradient(-L * 0.1, 0, L * 0.1, -L * 0.1, 0, L * 0.85);
    grad.addColorStop(0, col + pulse + ')');
    grad.addColorStop(1, col + '0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(-L * 0.1, 0, L * 0.85, 0, Math.PI * 2); g.fill();
  }
  // shadow
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(-L * 0.05 + 3, 4, L * 0.55, L * 0.2, 0, 0, Math.PI * 2); g.fill();

  // legs: three pairs from the thorax, tripod gait
  g.strokeStyle = st.legs;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1.4, L * 0.035);
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const phase = walk + (i % 2 === 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0);
      const swing = a.moving ? Math.sin(phase) * 0.35 : 0;
      const baseX = L * (0.06 - i * 0.07);
      const ang = (i - 1) * 0.75 + swing;
      const kx = baseX + Math.sin(ang) * L * 0.2, ky = side * L * 0.2;
      const fx = baseX + Math.sin(ang) * L * 0.42 + (i - 1) * L * 0.08, fy = side * L * (0.36 - Math.abs(i - 1) * 0.02);
      g.beginPath(); g.moveTo(baseX, side * L * 0.04); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    }
  }
  const hurt = a.hurt > 0;
  const body = hurt ? '#ff6a5a' : st.body;
  const belly = hurt ? '#ff8a7a' : st.belly;
  // abdomen
  g.fillStyle = belly;
  g.beginPath(); g.ellipse(-L * 0.3, 0, L * 0.23, L * 0.17, 0, 0, Math.PI * 2); g.fill();
  if (st.fx === 'stripe') {
    g.strokeStyle = 'rgba(255,230,160,.45)';
    g.lineWidth = L * 0.03;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(-L * (0.22 + k * 0.08), 0, L * 0.02, L * 0.15 - k * L * 0.02, 0, 0, Math.PI * 2); g.stroke(); }
  }
  if (st.fx === 'lava') {
    g.strokeStyle = `rgba(255,${180 + Math.sin(time * 4) * 60 | 0},40,.95)`;
    g.lineWidth = L * 0.02;
    g.beginPath(); g.moveTo(-L * 0.45, -L * 0.05); g.lineTo(-L * 0.35, L * 0.04); g.lineTo(-L * 0.24, -L * 0.06); g.lineTo(-L * 0.14, L * 0.03); g.stroke();
    g.fillStyle = body;
    g.beginPath(); g.ellipse(-L * 0.3, -L * 0.1, L * 0.18, L * 0.06, 0, 0, Math.PI * 2); g.fill();
  }
  if (st.fx === 'galaxy' || st.fx === 'cosmic') {
    g.save();
    g.beginPath(); g.ellipse(-L * 0.3, 0, L * 0.23, L * 0.17, 0, 0, Math.PI * 2); g.clip();
    for (let k = 0; k < 18; k++) {
      const sx = -L * 0.5 + ((k * 37 + time * 8) % (L * 0.4)), sy = -L * 0.16 + ((k * 53) % (L * 0.32));
      g.fillStyle = k % 3 === 0 ? '#ffe9a8' : k % 3 === 1 ? '#a8d8ff' : '#ffffff';
      g.globalAlpha = 0.5 + 0.5 * Math.sin(time * 4 + k);
      g.beginPath(); g.arc(sx, sy, L * 0.012 + (k % 4) * 0.4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }
  // waist
  g.fillStyle = body;
  g.beginPath(); g.ellipse(-L * 0.07, 0, L * 0.045, L * 0.04, 0, 0, Math.PI * 2); g.fill();
  // thorax
  g.beginPath(); g.ellipse(L * 0.03, 0, L * 0.12, L * 0.075, 0, 0, Math.PI * 2); g.fill();
  if (st.fx === 'armor') {
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = L * 0.015;
    g.beginPath(); g.ellipse(L * 0.03, 0, L * 0.09, L * 0.055, 0, 0, Math.PI * 2); g.stroke();
  }
  // head (bigger for soldiers and jaw ants)
  const hr = L * (st.fx === 'armor' || st.fx === 'jaw' ? 0.13 : 0.105);
  const hx = L * 0.24;
  // mandibles: open while biting
  const open = a.bite > 0 ? 0.6 : 0.25;
  const jaw = st.fx === 'jaw' || st.fx === 'armor' ? 1.6 : 1;
  g.strokeStyle = st.fx === 'cosmic' ? '#9fe8ff' : st.legs;
  g.lineWidth = Math.max(1.5, L * 0.03);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(hx + hr * 0.7, side * hr * 0.4);
    g.quadraticCurveTo(hx + hr * (1.2 + 0.4 * jaw), side * hr * (0.4 + open * jaw), hx + hr * (1.25 + 0.6 * jaw), side * hr * 0.05);
    g.stroke();
  }
  g.fillStyle = body;
  g.beginPath(); g.ellipse(hx, 0, hr, hr * 0.9, 0, 0, Math.PI * 2); g.fill();
  // shine
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.beginPath(); g.ellipse(-L * 0.34, -L * 0.07, L * 0.09, L * 0.05, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(hx - hr * 0.2, -hr * 0.4, hr * 0.35, hr * 0.2, 0, 0, Math.PI * 2); g.fill();
  // eyes
  const glow = st.fx === 'shadow' ? '#c070ff' : st.fx === 'cosmic' ? '#7ff0ff' : st.fx === 'lava' || st.fx === 'fire' ? '#ffd040' : st.fx === 'spark' ? '#d8f0ff' : '#111';
  g.fillStyle = glow;
  for (const side of [-1, 1]) { g.beginPath(); g.arc(hx + hr * 0.35, side * hr * 0.55, Math.max(1.2, hr * 0.22), 0, Math.PI * 2); g.fill(); }
  // antennae
  g.strokeStyle = st.legs;
  g.lineWidth = Math.max(1, L * 0.022);
  const wig = Math.sin(time * 6 + a.id) * 0.15;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(hx + hr * 0.5, side * hr * 0.6);
    g.lineTo(hx + hr * 1.3, side * hr * (1.6 + wig));
    g.lineTo(hx + hr * 2.4, side * hr * (1.3 + wig * 2));
    g.stroke();
  }
  // extras
  if (st.fx === 'leaf') {
    g.save();
    g.translate(hx + hr * 0.6, 0);
    g.rotate(-0.4 + Math.sin(walk) * 0.05);
    g.fillStyle = '#4caa3a';
    leafPath(g, L * 0.7, L * 0.1, -L * 0.15); g.fill();
    g.strokeStyle = '#2e7a22'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-L * 0.25, -L * 0.15); g.lineTo(L * 0.45, -L * 0.15); g.stroke();
    g.restore();
  }
  if (st.fx === 'fire') {
    for (let k = 0; k < 4; k++) {
      const fx = -L * (0.45 - k * 0.1), fl = L * (0.12 + 0.06 * Math.sin(time * 12 + k * 2));
      g.fillStyle = k % 2 ? 'rgba(255,210,60,.85)' : 'rgba(255,110,20,.85)';
      g.beginPath(); g.moveTo(fx - L * 0.04, -L * 0.08); g.quadraticCurveTo(fx - L * 0.02, -L * 0.08 - fl, fx + L * 0.03, -L * 0.1 - fl * 1.1); g.quadraticCurveTo(fx + L * 0.02, -L * 0.06, fx + L * 0.04, -L * 0.06); g.fill();
    }
  }
  if (st.fx === 'crystal') {
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let k = 0; k < 4; k++) {
      const cx = -L * (0.42 - k * 0.07), cy = (k % 2 ? 1 : -1) * L * 0.06;
      g.beginPath(); g.moveTo(cx, cy - L * 0.06); g.lineTo(cx + L * 0.03, cy); g.lineTo(cx, cy + L * 0.06); g.lineTo(cx - L * 0.03, cy); g.closePath(); g.fill();
    }
    const tw = (time * 1.5 + a.id) % 3;
    if (tw < 0.4) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; const s = L * 0.08 * Math.sin((tw / 0.4) * Math.PI);
      g.beginPath(); g.moveTo(-L * 0.3 - s, -L * 0.1); g.lineTo(-L * 0.3 + s, -L * 0.1); g.moveTo(-L * 0.3, -L * 0.1 - s); g.lineTo(-L * 0.3, -L * 0.1 + s); g.stroke();
    }
  }
  if (st.fx === 'spark' && (time * 5 + a.id) % 2 < 0.5) {
    g.strokeStyle = '#e8f4ff'; g.lineWidth = 2;
    g.beginPath();
    let px = -L * 0.5, py = 0;
    g.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += L * 0.14; py = (k % 2 ? 1 : -1) * L * (0.15 + Math.random() * 0.1); g.lineTo(px, py); }
    g.stroke();
  }
  if (st.fx === 'cosmic') {
    g.strokeStyle = 'rgba(160,230,255,.7)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(-L * 0.05, 0, L * 0.62, L * 0.2, time * 0.6, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 3; k++) {
      const ang = time * 1.4 + (k * Math.PI * 2) / 3;
      g.fillStyle = ['#ffe17a', '#9fe8ff', '#ff9ae0'][k];
      g.beginPath(); g.arc(Math.cos(ang) * L * 0.6, Math.sin(ang) * L * 0.6, L * 0.035, 0, Math.PI * 2); g.fill();
    }
  }
  if (a.rebirths) {
    // little gold stars circle reborn ants
    for (let k = 0; k < Math.min(5, a.rebirths); k++) {
      const ang = time * 2 + (k * Math.PI * 2) / Math.min(5, a.rebirths);
      g.fillStyle = '#ffd84a';
      star(g, Math.cos(ang) * L * 0.5 - L * 0.05, Math.sin(ang) * L * 0.35, Math.max(2.5, L * 0.04));
    }
  }
  g.restore();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 ? r * 0.45 : r, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** A small picture of a stage, for the title screen and the HUD. */
export function stageIcon(level: number, px = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px * 2;
  const g = c.getContext('2d')!;
  const L = STAGES[level].size;
  const k = (px * 2 * 0.8) / (L * 1.2);
  g.translate(px, px);
  g.scale(k, k);
  drawAnt(g, { id: 1, slot: -1, name: '', level, rebirths: 0, x: 0, y: 0, a: -Math.PI / 2, moving: false, bite: 0, hurt: 0, hp: 1, dead: false }, 0, 1);
  c.style.width = c.style.height = px + 'px';
  return c;
}

export function drawMinimap(c: HTMLCanvasElement, w: World, ants: ViewAnt[], me: ViewAnt | undefined) {
  const g = c.getContext('2d')!;
  const s = c.width / WORLD;
  g.fillStyle = '#3f7a2c';
  g.fillRect(0, 0, c.width, c.height);
  for (const p of w.puddles) {
    if (p.beach) { g.fillStyle = '#e6d39a'; g.beginPath(); g.arc(p.x * s, p.y * s, (p.r + p.beach) * s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#3f8fd0'; g.beginPath(); g.arc(p.x * s, p.y * s, p.r * s, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(20,60,20,.85)';
  for (const t of w.trees) { g.beginPath(); g.arc(t.x * s, t.y * s, t.canopy * 0.9 * s, 0, Math.PI * 2); g.fill(); }
  for (const a of ants) {
    if (a.dead) continue;
    if (a.slot >= 0) {
      g.fillStyle = PLAYER_COLORS[a.slot % PLAYER_COLORS.length];
      g.beginPath(); g.arc(a.x * s, a.y * s, a === me ? 4 : 3, 0, Math.PI * 2); g.fill();
      if (a === me) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
    } else if (me && a.level > me.level + 2) {
      g.fillStyle = 'rgba(255,80,60,.8)';
      g.fillRect(a.x * s - 1.5, a.y * s - 1.5, 3, 3);
    }
  }
}
