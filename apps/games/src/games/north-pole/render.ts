// North Pole Village: drawing the world on a canvas.
import { BASE_TILE, DX, DY, Game, H, T, TOWER_RANGE, W, type Bear, type Dir, type Item, type Obj, type Tool, type Villager } from './game';

export interface Ghost {
  tool: Tool;
  x: number;
  y: number;
  dir: Dir;
  ok: boolean;
}

interface Flake {
  x: number;
  y: number;
  r: number;
  s: number;
  w: number;
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  camX = 0;
  camY = 0;
  zoom = 1;
  vw = 0;
  vh = 0;
  flakes: Flake[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 90; i++) this.flakes.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.2, s: 20 + Math.random() * 40, w: Math.random() * 6 });
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.vw = r.width;
    this.vh = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    // phones see a little less of the world, bigger
    this.zoom = Math.min(r.width, r.height) < 520 ? 0.8 : 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  toWorld(sx: number, sy: number) {
    return { x: sx / this.zoom + this.camX, y: sy / this.zoom + this.camY };
  }

  draw(g: Game, ghost: Ghost | null, t: number, dt: number) {
    const { ctx } = this;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const vw = this.vw / this.zoom;
    const vh = this.vh / this.zoom;
    // camera follows the player, stays inside the world
    const tx = Math.max(0, Math.min(W * T - vw, g.p.x - vw / 2));
    const ty = Math.max(0, Math.min(H * T - vh, g.p.y - vh / 2));
    this.camX += (tx - this.camX) * Math.min(1, dt * 8);
    this.camY += (ty - this.camY) * Math.min(1, dt * 8);
    if (Math.abs(tx - this.camX) > vw) {
      this.camX = tx;
      this.camY = ty;
    }
    ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, -Math.round(this.camX * this.zoom * dpr), -Math.round(this.camY * this.zoom * dpr));

    const x0 = Math.max(0, Math.floor(this.camX / T) - 1);
    const y0 = Math.max(0, Math.floor(this.camY / T) - 1);
    const x1 = Math.min(W - 1, Math.ceil((this.camX + vw) / T) + 1);
    const y1 = Math.min(H - 1, Math.ceil((this.camY + vh) / T) + 2);

    // snow
    ctx.fillStyle = '#eaf2fa';
    ctx.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const h = hash(x, y);
        if (h < 0.35) {
          ctx.fillStyle = 'rgba(160,185,215,.25)';
          ctx.beginPath();
          ctx.ellipse(x * T + h * 90, y * T + hash(y, x) * T, 10 + h * 20, 4 + h * 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (h > 0.8) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * T + (h * 997) % T, y * T + (h * 571) % T, 2, 2);
        }
      }
    // world edge
    ctx.strokeStyle = 'rgba(90,120,160,.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, W * T, H * T);

    // trampled snow in the village
    const hx = (BASE_TILE.x + 1.5) * T;
    const hy = (BASE_TILE.y + 0.5) * T;
    const grad = ctx.createRadialGradient(hx, hy, 20, hx, hy, 300);
    grad.addColorStop(0, 'rgba(200,214,232,.55)');
    grad.addColorStop(1, 'rgba(200,214,232,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(hx - 300, hy - 300, 600, 600);

    // tower ranges (faint) when placing a tower
    if (ghost?.tool === 'tower') {
      ctx.strokeStyle = 'rgba(60,90,140,.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((ghost.x + 0.5) * T, (ghost.y + 0.5) * T, TOWER_RANGE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // flat things first: belts, then grabbers
    for (const o of g.objs.values()) if (o.kind === 'belt' && this.vis(o, x0, y0, x1, y1)) this.belt(o, t);
    for (const m of g.meats) this.meat(m.x, m.y, m.t);

    // everything that stands up, sorted by y so things overlap nicely
    const items: { y: number; f: () => void }[] = [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = g.treeAt[y * W + x];
        if (i < 0) continue;
        const tr = g.trees[i];
        if (tr.regrow > 0) items.push({ y: (y + 0.5) * T, f: () => this.stump(x, y) });
        else items.push({ y: (y + 0.8) * T, f: () => this.tree(x, y, tr.size, tr.shake > 0 ? Math.sin(t * 60) * 2 : 0) });
      }
    for (const o of g.objs.values()) {
      if (o.kind === 'belt' || !this.vis(o, x0, y0, x1, y1)) continue;
      items.push({ y: (o.y + o.h) * T - 4, f: () => this.obj(g, o, t) });
    }
    for (const b of g.bears) items.push({ y: b.y + 10, f: () => this.bear(b) });
    for (const v of g.villagers) items.push({ y: v.y + 10, f: () => this.villager(v, g) });
    items.push({ y: g.p.y + (g.p.down ? 12 : 10), f: () => this.player(g) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();

    // arrows in the air
    ctx.lineCap = 'round';
    for (const s of g.shots) {
      const a = Math.atan2(s.vy, s.vx);
      ctx.strokeStyle = '#6b4626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(a) * 14, s.y - Math.sin(a) * 14);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.fillStyle = '#9aa4b0';
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(a) * 5, s.y + Math.sin(a) * 5);
      ctx.lineTo(s.x + Math.cos(a + 2.4) * 5, s.y + Math.sin(a + 2.4) * 5);
      ctx.lineTo(s.x + Math.cos(a - 2.4) * 5, s.y + Math.sin(a - 2.4) * 5);
      ctx.fill();
    }

    if (ghost) this.ghost(ghost);

    // particles and floating text
    for (const f of g.fx) {
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = Math.min(1, a * 1.5);
      if (f.text) {
        ctx.font = `800 ${f.size}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(20,30,50,.8)';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      } else {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // falling snow on top, in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of this.flakes) {
      f.y += (f.s * dt) / this.vh;
      if (f.y > 1.02) {
        f.y = -0.02;
        f.x = Math.random();
      }
      const x = ((f.x * this.vw + Math.sin(t * 0.8 + f.w) * 14 - this.camX * 0.3) % this.vw + this.vw) % this.vw;
      ctx.beginPath();
      ctx.arc(x, f.y * this.vh, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // red flash when hurt
    if (g.p.hurt > 0) {
      ctx.fillStyle = `rgba(255,40,40,${g.p.hurt * 0.4})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    this.homeArrow(g);
  }

  vis(o: Obj, x0: number, y0: number, x1: number, y1: number) {
    return o.x + o.w >= x0 && o.x <= x1 && o.y + o.h >= y0 && o.y <= y1;
  }

  /** When the village is off screen, a little arrow at the edge points home. */
  homeArrow(g: Game) {
    const { ctx } = this;
    const hx = ((BASE_TILE.x + 1.5) * T - this.camX) * this.zoom;
    const hy = ((BASE_TILE.y + 1.5) * T - this.camY) * this.zoom;
    const m = 40;
    if (hx > m && hx < this.vw - m && hy > m && hy < this.vh - m) return;
    const cx = this.vw / 2;
    const cy = this.vh / 2;
    const a = Math.atan2(hy - cy, hx - cx);
    const k = Math.min(Math.abs((cx - m) / Math.cos(a) || 1e9), Math.abs((cy - m - 30) / Math.sin(a) || 1e9));
    const x = cx + Math.cos(a) * k;
    const y = cy + Math.sin(a) * k;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(30,40,70,.75)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.hasBase ? '🏠' : '⛺', 0, 1);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(19, -7);
    ctx.lineTo(19, 7);
    ctx.fill();
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  shadow(x: number, y: number, rx: number, ry: number) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(60,80,120,.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  tree(x: number, y: number, size: number, shake: number) {
    const { ctx } = this;
    const cx = (x + 0.5) * T + shake;
    const by = (y + 0.85) * T;
    this.shadow(cx + 4, by, 16 * size, 6 * size);
    ctx.fillStyle = '#6b4626';
    ctx.fillRect(cx - 4, by - 10 * size, 8, 10 * size);
    const layers = [
      { w: 22, top: 30, y: 8, c: '#245c43' },
      { w: 18, top: 24, y: 22, c: '#2c6c4f' },
      { w: 13, top: 18, y: 34, c: '#357d5b' },
    ];
    for (const l of layers) {
      const w = l.w * size;
      const yb = by - l.y * size;
      const yt = yb - l.top * size;
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(cx - w, yb);
      ctx.lineTo(cx + w, yb);
      ctx.lineTo(cx, yt);
      ctx.fill();
      // snow on the branches
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx, yt);
      ctx.lineTo(cx + w * 0.45, yt + (yb - yt) * 0.45);
      ctx.quadraticCurveTo(cx + w * 0.15, yt + (yb - yt) * 0.35, cx, yt + (yb - yt) * 0.5);
      ctx.quadraticCurveTo(cx - w * 0.2, yt + (yb - yt) * 0.35, cx - w * 0.45, yt + (yb - yt) * 0.45);
      ctx.fill();
    }
  }

  stump(x: number, y: number) {
    const { ctx } = this;
    const cx = (x + 0.5) * T;
    const cy = (y + 0.6) * T;
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c99a62';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6036';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  obj(g: Game, o: Obj, t: number) {
    switch (o.kind) {
      case 'fence':
        return this.fence(g, o);
      case 'tower':
        return this.tower(o);
      case 'grabber':
        return this.grabber(o);
      case 'machine':
        return this.machine(o, t);
      case 'sticks':
        return this.sticks(o);
      case 'base':
        return this.base(o, t);
    }
  }

  fence(g: Game, o: Obj) {
    const { ctx } = this;
    const cx = (o.x + 0.5) * T;
    const cy = (o.y + 0.5) * T;
    const isF = (x: number, y: number) => {
      const n = g.at(x, y);
      return !!n && n.kind !== 'belt' && n.kind !== 'grabber';
    };
    ctx.lineCap = 'butt';
    const rail = (x2: number, y2: number) => {
      ctx.strokeStyle = '#5a3a20';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(x2, y2 - 10);
      ctx.moveTo(cx, cy - 1);
      ctx.lineTo(x2, y2 - 1);
      ctx.stroke();
      ctx.strokeStyle = '#9a6a3e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11);
      ctx.lineTo(x2, y2 - 11);
      ctx.moveTo(cx, cy - 2);
      ctx.lineTo(x2, y2 - 2);
      ctx.stroke();
    };
    const r = isF(o.x + 1, o.y);
    const l = isF(o.x - 1, o.y);
    const d = isF(o.x, o.y + 1);
    const u = isF(o.x, o.y - 1);
    this.shadow(cx + 2, cy + 6, 10, 4);
    if (u) rail(cx, cy - T / 2);
    if (l) rail(cx - T / 2, cy);
    if (r) rail(cx + T / 2, cy);
    if (d) rail(cx, cy + T / 2);
    if (!r && !l && !u && !d) {
      rail(cx - 12, cy);
      rail(cx + 12, cy);
    }
    // post
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(cx - 5, cy - 20, 10, 24);
    ctx.fillStyle = '#8a5a32';
    ctx.fillRect(cx - 4, cy - 19, 8, 22);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 20, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  tower(o: Obj) {
    const { ctx } = this;
    const cx = (o.x + 0.5) * T;
    const cy = (o.y + 0.5) * T;
    this.shadow(cx + 3, cy + 12, 18, 7);
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 14);
    ctx.lineTo(cx - 9, cy - 16);
    ctx.moveTo(cx + 14, cy + 14);
    ctx.lineTo(cx + 9, cy - 16);
    ctx.moveTo(cx - 12, cy + 4);
    ctx.lineTo(cx + 12, cy - 8);
    ctx.stroke();
    // platform
    ctx.fillStyle = '#8a5a32';
    ctx.fillRect(cx - 16, cy - 26, 32, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 16, cy - 27, 32, 3);
    // crossbow
    ctx.save();
    ctx.translate(cx, cy - 22);
    ctx.rotate(o.aim);
    ctx.fillStyle = '#4a2e1d';
    ctx.fillRect(-4, -3, 22, 6);
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(12, 0, 11, -1.2, 1.2);
    ctx.stroke();
    ctx.restore();
    this.label(cx, cy + 22, `${o.arrows}`, o.arrows > 0 ? '#ffe9a8' : '#ff8080');
  }

  label(x: number, y: number, s: string, color: string) {
    const { ctx } = this;
    ctx.font = '800 11px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(s).width + 8;
    ctx.fillStyle = 'rgba(20,30,50,.75)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 10, w, 14, 7);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(s, x, y + 1);
  }

  belt(o: Obj, t: number) {
    const { ctx } = this;
    const x = o.x * T;
    const y = o.y * T;
    ctx.fillStyle = '#3a4050';
    ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
    ctx.fillStyle = '#4c5466';
    ctx.fillRect(x + 5, y + 5, T - 10, T - 10);
    ctx.save();
    ctx.translate(x + T / 2, y + T / 2);
    ctx.rotate((o.dir * Math.PI) / 2);
    ctx.beginPath();
    ctx.rect(-T / 2 + 5, -T / 2 + 5, T - 10, T - 10);
    ctx.clip();
    ctx.strokeStyle = '#f0b440';
    ctx.lineWidth = 3;
    const off = ((t * 1.6 * T) % 14) - 14;
    for (let i = -2; i < 4; i++) {
      const cx = -T / 2 + off + i * 14;
      ctx.beginPath();
      ctx.moveTo(cx, -8);
      ctx.lineTo(cx + 6, 0);
      ctx.lineTo(cx, 8);
      ctx.stroke();
    }
    ctx.restore();
    if (o.carry) {
      const p = o.carry.p - 0.5;
      this.item(x + T / 2 + DX[o.dir] * p * T, y + T / 2 + DY[o.dir] * p * T, o.carry.item);
    }
  }

  item(x: number, y: number, it: Item) {
    const { ctx } = this;
    ctx.lineCap = 'round';
    if (it === 'stick') {
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 4);
      ctx.lineTo(x + 9, y - 4);
      ctx.moveTo(x + 2, y - 1);
      ctx.lineTo(x + 5, y - 7);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#a0703e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 5);
      ctx.lineTo(x + 8, y - 4);
      ctx.stroke();
      ctx.fillStyle = '#c8d0da';
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 6);
      ctx.lineTo(x + 5, y - 6);
      ctx.lineTo(x + 9, y);
      ctx.fill();
      ctx.strokeStyle = '#e05050';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 5);
      ctx.lineTo(x - 13, y + 2);
      ctx.moveTo(x - 10, y + 5);
      ctx.lineTo(x - 10, y + 9);
      ctx.stroke();
    }
  }

  grabber(o: Obj) {
    const { ctx } = this;
    const cx = (o.x + 0.5) * T;
    const cy = (o.y + 0.5) * T;
    ctx.fillStyle = '#5c6474';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0a526';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    // arm swings from the back tile (0) to the front tile (1)
    const back = ((o.dir + 2) % 4) * (Math.PI / 2);
    const a = back + o.swing * Math.PI;
    const ex = cx + Math.cos(a) * 18;
    const ey = cy + Math.sin(a) * 18;
    ctx.strokeStyle = '#e0a526';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = '#2a2f3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.stroke();
    if (o.held) this.item(ex, ey, o.held);
    // arrow showing which way it moves things
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    const fa = o.dir * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(fa) * 18, cy + Math.sin(fa) * 18);
    ctx.lineTo(cx + Math.cos(fa + 0.4) * 12, cy + Math.sin(fa + 0.4) * 12);
    ctx.lineTo(cx + Math.cos(fa - 0.4) * 12, cy + Math.sin(fa - 0.4) * 12);
    ctx.fill();
  }

  machine(o: Obj, t: number) {
    const { ctx } = this;
    const x = o.x * T;
    const y = o.y * T;
    const w = o.w * T;
    const h = o.h * T;
    this.shadow(x + w / 2 + 4, y + h - 4, w / 2, 10);
    ctx.fillStyle = '#5c6474';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 10, w - 8, h - 16, 8);
    ctx.fill();
    ctx.fillStyle = '#7a8496';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 4, w - 16, h - 28, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 2, w - 16, 6, 3);
    ctx.fill();
    // gear
    const spin = o.prog > 0 ? t * 4 : 0;
    ctx.save();
    ctx.translate(x + w / 2, y + 28);
    ctx.rotate(spin);
    ctx.fillStyle = '#e0a526';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -15, 6, 6);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5c6474';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // light
    ctx.fillStyle = o.prog > 0 ? '#7cff8a' : '#2f4a35';
    ctx.beginPath();
    ctx.arc(x + w - 16, y + h - 20, 4, 0, Math.PI * 2);
    ctx.fill();
    // arrows waiting
    if (o.aOut > 0) this.item(x + 22, y + h - 18, 'arrow');
    this.label(x + w / 2, y + h + 8, `🥢${o.sIn} → 🏹${o.aOut}`, '#ffe9a8');
  }

  sticks(o: Obj) {
    const { ctx } = this;
    const x = o.x * T;
    const y = o.y * T;
    const w = o.w * T;
    const h = o.h * T;
    this.shadow(x + w / 2, y + h - 10, w / 2 - 4, 12);
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const hx = hash(i, 7);
      const hy = hash(3, i);
      const sx = x + 12 + hx * (w - 24);
      const sy = y + 24 + hy * (h - 40) - (1 - Math.abs(hx - 0.5) * 2) * 14;
      const a = (hash(i, i) - 0.5) * 2.4;
      ctx.strokeStyle = i % 3 ? '#7a5230' : '#946a40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(a) * 14, sy - Math.sin(a) * 14);
      ctx.lineTo(sx + Math.cos(a) * 14, sy + Math.sin(a) * 14);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 22, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    this.label(x + w / 2, y + h + 4, 'Sticks ∞', '#e8c99a');
  }

  base(o: Obj, t: number) {
    const { ctx } = this;
    const x = o.x * T;
    const y = o.y * T;
    const w = o.w * T;
    const h = o.h * T;
    this.shadow(x + w / 2 + 6, y + h - 4, w / 2 + 6, 14);
    // log walls
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(x + 6, y + 40, w - 12, h - 44);
    ctx.strokeStyle = '#5a3418';
    ctx.lineWidth = 2;
    for (let ly = y + 46; ly < y + h - 4; ly += 9) {
      ctx.beginPath();
      ctx.moveTo(x + 6, ly);
      ctx.lineTo(x + w - 6, ly);
      ctx.stroke();
    }
    // door and windows
    ctx.fillStyle = '#3e2412';
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 12, y + h - 34, 24, 30, [10, 10, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x + 16, y + 58, 18, 16);
    ctx.fillRect(x + w - 34, y + 58, 18, 16);
    ctx.strokeStyle = '#5a3418';
    ctx.strokeRect(x + 16, y + 58, 18, 16);
    ctx.strokeRect(x + w - 34, y + 58, 18, 16);
    // chimney and roof
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(x + w - 34, y - 6, 14, 26);
    ctx.fillStyle = '#b8362c';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 46);
    ctx.lineTo(x + w / 2, y - 4);
    ctx.lineTo(x + w + 4, y + 46);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 46);
    ctx.lineTo(x + w / 2, y - 4);
    ctx.lineTo(x + w + 4, y + 46);
    ctx.lineTo(x + w - 6, y + 40);
    ctx.lineTo(x + w / 2, y + 8);
    ctx.lineTo(x + 6, y + 40);
    ctx.fill();
    // smoke
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.4 + i / 4) % 1;
      ctx.fillStyle = `rgba(200,205,215,${0.6 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(x + w - 27 + k * 20, y - 10 - k * 60, 5 + k * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  meat(x: number, y: number, t: number) {
    const { ctx } = this;
    const bob = Math.sin(t * 4) * 2;
    this.shadow(x, y + 8, 10, 4);
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.arc(x + 9, y - 6 + bob, 3.5, 0, Math.PI * 2);
    ctx.arc(x + 12, y - 3 + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f4f0e6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + bob);
    ctx.lineTo(x + 10, y - 4 + bob);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(x - 2, y + 1 + bob, 9, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8706a';
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 1 + bob, 4, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  bear(b: Bear) {
    const { ctx } = this;
    this.shadow(b.x + 3, b.y + 10, 22, 9);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.ang);
    const legs = Math.sin(b.step) * 5;
    ctx.fillStyle = b.hurt > 0 ? '#ffb0b0' : '#dcdcd4';
    for (const [lx, ly, s] of [
      [10, -11, 1],
      [10, 11, -1],
      [-10, -11, -1],
      [-10, 11, 1],
    ])
      ctx.beginPath(), ctx.ellipse(lx + legs * s, ly, 6, 5, 0, 0, Math.PI * 2), ctx.fill();
    ctx.fillStyle = b.hurt > 0 ? '#ffd0d0' : '#f6f6f0';
    ctx.strokeStyle = '#b8bcc4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // head
    ctx.beginPath();
    ctx.ellipse(20, 0, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(16, -8, 3.5, 0, Math.PI * 2);
    ctx.arc(16, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(29, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(22, -4, 1.6, 0, Math.PI * 2);
    ctx.arc(22, 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (b.hp < b.max) {
      ctx.fillStyle = 'rgba(20,30,50,.6)';
      ctx.fillRect(b.x - 16, b.y - 26, 32, 5);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(b.x - 16, b.y - 26, (32 * b.hp) / b.max, 5);
    }
  }

  person(x: number, y: number, color: string, face: number, step: number, hat: string) {
    const { ctx } = this;
    const bob = Math.abs(Math.sin(step)) * 2;
    this.shadow(x + 2, y + 10, 12, 5);
    // boots
    ctx.fillStyle = '#2a2f3a';
    const sw = Math.sin(step) * 4;
    ctx.fillRect(x - 7, y + 4 + sw * 0.3, 5, 7);
    ctx.fillRect(x + 2, y + 4 - sw * 0.3, 5, 7);
    // coat
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 12 - bob, 20, 20, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 10, y + 3 - bob, 20, 4);
    // face in a fur hood
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.arc(x, y - 18 - bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(x + Math.cos(face) * 1.5, y - 17 - bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a10';
    const lx = Math.cos(face) * 2.5;
    if (Math.sin(face) > -0.6 || Math.abs(Math.cos(face)) > 0.4) {
      ctx.beginPath();
      ctx.arc(x - 2.5 + lx, y - 18 - bob, 1.3, 0, Math.PI * 2);
      ctx.arc(x + 2.5 + lx, y - 18 - bob, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff9a9a';
    ctx.beginPath();
    ctx.arc(x - 4 + lx, y - 15 - bob, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 4 + lx, y - 15 - bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // hat
    ctx.fillStyle = hat;
    ctx.beginPath();
    ctx.arc(x, y - 23 - bob, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y - 32 - bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  villager(v: Villager, g: Game) {
    if (v.state === 'carry') return this.person(v.x, v.y, v.color, v.face, v.step, '#c0392b');
    this.person(v.x, v.y, v.color, v.face, v.state === 'chop' ? 0 : v.step, v.jack ? '#2e7d4f' : '#c0392b');
    const { ctx } = this;
    if (v.state === 'chop') {
      // axe
      const sw = Math.sin(v.timer * 10) * 0.8;
      ctx.save();
      ctx.translate(v.x + 8, v.y - 8);
      ctx.rotate(-0.6 + sw);
      ctx.fillStyle = '#6b4626';
      ctx.fillRect(0, -2, 16, 4);
      ctx.fillStyle = '#9aa4b0';
      ctx.fillRect(12, -7, 6, 10);
      ctx.restore();
    }
    if (v.wood > 0) {
      ctx.fillStyle = '#8a5a32';
      ctx.fillRect(v.x - 10, v.y - 44, 20, 6);
      ctx.fillRect(v.x - 8, v.y - 50, 16, 6);
    }
    // little coin bubble when you have meat to sell
    const p = g.p;
    if (g.inv.meat > 0 && Math.hypot(v.x - p.x, v.y - p.y) < 160 && v.state !== 'rescue') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(v.x + 6, v.y - 58, 26, 20, 8);
      ctx.fill();
      ctx.fillStyle = '#ffc928';
      ctx.beginPath();
      ctx.arc(v.x + 19, v.y - 48, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = '800 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', v.x + 19, v.y - 45);
    }
  }

  player(g: Game) {
    const { ctx } = this;
    const p = g.p;
    if (p.down) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.85;
      this.person(0, 0, '#d0342c', 0, 0, '#2a4a8a');
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.font = '18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', p.x, p.y - 26 + Math.sin(performance.now() / 200) * 3);
      return;
    }
    this.person(p.x, p.y, '#d0342c', p.aim, p.step, '#2a4a8a');
    // crossbow
    ctx.save();
    ctx.translate(p.x, p.y - 4);
    ctx.rotate(p.aim);
    if (p.swing > 0) {
      ctx.rotate(-1 + (1 - p.swing) * 2);
      ctx.fillStyle = '#6b4626';
      ctx.fillRect(4, -2, 18, 4);
      ctx.fillStyle = '#9aa4b0';
      ctx.fillRect(18, -8, 7, 12);
    } else {
      ctx.fillStyle = '#4a2e1d';
      ctx.fillRect(6, -2.5, 18, 5);
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(14, 0, 9, -1.3, 1.3);
      ctx.stroke();
    }
    ctx.restore();
    if (p.hp < 100) {
      ctx.fillStyle = 'rgba(20,30,50,.6)';
      ctx.fillRect(p.x - 16, p.y - 46, 32, 5);
      ctx.fillStyle = p.hp > 40 ? '#5ad86a' : '#ff5a5a';
      ctx.fillRect(p.x - 16, p.y - 46, (32 * p.hp) / 100, 5);
    }
  }

  ghost(gh: Ghost) {
    const { ctx } = this;
    const x = gh.x * T;
    const y = gh.y * T;
    ctx.fillStyle = gh.ok ? 'rgba(80,200,120,.3)' : 'rgba(230,70,70,.3)';
    ctx.strokeStyle = gh.ok ? '#3aa860' : '#d04040';
    ctx.lineWidth = 2;
    ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
    ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    if (gh.tool === 'belt' || gh.tool === 'grabber') {
      const cx = x + T / 2;
      const cy = y + T / 2;
      const a = (gh.dir * Math.PI) / 2;
      ctx.fillStyle = gh.ok ? '#2a7a48' : '#a03030';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
      ctx.lineTo(cx + Math.cos(a + 2.5) * 10, cy + Math.sin(a + 2.5) * 10);
      ctx.lineTo(cx + Math.cos(a - 2.5) * 10, cy + Math.sin(a - 2.5) * 10);
      ctx.fill();
    }
  }
}
