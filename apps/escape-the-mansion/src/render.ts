// Draws the level, the cast, the lighting and the in-world overlays.
import type { Game } from './game';
import { isWall, type LevelData, type Pt } from './level';
import { Rng } from './rng';
import { dogSprite, guardSprite, itemSprite, jeffSprite, lennyPose, lennySprite, type Dir } from './sprites';
import { TILE, themeFor, type Theme } from './themes';
import { drawProp, GLOWING } from './props';

const T = TILE;
const FONT = '"VT323", ui-monospace, monospace';

export interface View {
  cssW: number;
  cssH: number;
  dpr: number;
  scale: number; // world px -> css px
  camX: number;
  camY: number;
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  cv: HTMLCanvasElement;
  dark: HTMLCanvasElement;
  dctx: CanvasRenderingContext2D;
  staticLayer: HTMLCanvasElement | null = null;
  level: LevelData | null = null;
  theme: Theme | null = null;
  explored: Uint8Array | null = null;
  view: View = { cssW: 1, cssH: 1, dpr: 1, scale: 2, camX: 0, camY: 0 };
  mini: HTMLCanvasElement;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.ctx = cv.getContext('2d')!;
    this.dark = document.createElement('canvas');
    this.dctx = this.dark.getContext('2d')!;
    this.mini = document.createElement('canvas');
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.cv.clientWidth || window.innerWidth;
    const h = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    const short = Math.min(w, h);
    const long = Math.max(w, h);
    // about 10 tiles across the short side, but not absurdly zoomed on a wide desktop window
    const scale = Math.max(1.4, Math.min(short / (10 * T), long / (15 * T)));
    this.view = { ...this.view, cssW: w, cssH: h, dpr, scale };
    this.dark.width = Math.ceil(w / 2);
    this.dark.height = Math.ceil(h / 2);
  }

  setLevel(L: LevelData) {
    this.level = L;
    this.theme = themeFor(L.level);
    this.staticLayer = buildStatic(L, this.theme);
    this.explored = new Uint8Array(L.w * L.h);
    this.mini.width = L.w;
    this.mini.height = L.h;
  }

  // ---------------------------------------------------------------- frame

  draw(g: Game, t: number) {
    const L = g.L;
    if (this.level !== L) this.setLevel(L);
    const theme = this.theme!;
    const ctx = this.ctx;
    const v = this.view;
    const s = v.scale;

    // camera follows Lenny, clamped to the level
    const vw = v.cssW / s;
    const vh = v.cssH / s;
    let cx = g.p.x - vw / 2;
    let cy = g.p.y - 10 - vh / 2;
    const maxX = L.w * T - vw;
    const maxY = L.h * T - vh;
    cx = maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, cx));
    cy = maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, cy));
    if (g.shake > 0) {
      cx += (Math.random() - 0.5) * g.shake * 8;
      cy += (Math.random() - 0.5) * g.shake * 8;
    }
    v.camX = cx;
    v.camY = cy;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s * v.dpr, 0, 0, s * v.dpr, -cx * s * v.dpr, -cy * s * v.dpr);

    // static map (only the visible part)
    const sx = Math.max(0, Math.floor(cx));
    const sy = Math.max(0, Math.floor(cy));
    const sw = Math.min(L.w * T - sx, Math.ceil(vw) + 2);
    const sh = Math.min(L.h * T - sy, Math.ceil(vh) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(this.staticLayer!, sx, sy, sw, sh, sx, sy, sw, sh);

    this.drawExit(g, t);
    this.drawSpikes(g);
    this.drawCones(g);
    this.drawItems(g, t);
    this.drawLasers(g, t);
    this.drawCameras(g, t);

    // y-sorted cast
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    list.push({ y: g.p.y, draw: () => this.drawLenny(g, t) });
    for (const gd of g.guards) list.push({ y: gd.y, draw: () => this.drawGuard(g, gd, t) });
    for (const d of g.dogs) list.push({ y: d.y, draw: () => this.drawDog(d, t) });
    if (g.jeff) {
      const j = g.jeff;
      list.push({ y: j.y, draw: () => this.drawJeff(g, t) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    this.drawProjectiles(g);
    this.drawClouds(g, t);
    this.drawRings(g);
    this.drawLighting(g, t);
    this.drawPoofs(g);
    this.drawIcons(g, t);
    this.drawPopups(g);
    this.drawBubbles(g);
    this.updateExplored(g);
  }

  // ---------------------------------------------------------------- pieces

  private drawExit(g: Game, t: number) {
    const ctx = this.ctx;
    const L = g.L;
    const x = L.exitTile.x * T;
    const y = L.exitTile.y * T;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const th = this.theme!;
    if (th.lightKind === 'moon' && L.level >= 46) {
      // the front gate
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x + 4, y + 6, 56, 54);
      ctx.fillStyle = `rgba(150,220,150,${0.25 + pulse * 0.2})`;
      ctx.fillRect(x + 8, y + 10, 48, 50);
      ctx.fillStyle = '#0c0c0c';
      for (let i = 0; i < 8; i++) ctx.fillRect(x + 8 + i * 7, y + 6, 2, 54);
      ctx.fillRect(x + 4, y + 20, 56, 2);
      ctx.fillStyle = '#3a3a3a';
      for (let i = 0; i < 8; i++) ctx.fillRect(x + 7 + i * 7, y + 3, 4, 3);
    } else if (th.lightKind === 'moon') {
      ctx.fillStyle = `rgba(120,200,120,${0.25 + pulse * 0.2})`;
      ctx.fillRect(x + 6, y + 6, 52, 52);
      ctx.fillStyle = '#4a3a20';
      ctx.fillRect(x + 22, y + 10, 20, 44);
      ctx.fillStyle = '#6a5a30';
      ctx.fillRect(x + 24, y + 12, 16, 40);
    } else {
      // stairs going up
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#5a5048' : '#6e6258';
        ctx.fillRect(x + 6, y + 6 + i * 9, 52, 9);
        ctx.fillStyle = '#3a342e';
        ctx.fillRect(x + 6, y + 6 + i * 9, 52, 1);
      }
      ctx.fillStyle = `rgba(255,230,150,${0.15 + pulse * 0.2})`;
      ctx.fillRect(x + 6, y + 6, 52, 54);
    }
    // bobbing arrow + sign
    const by = y - 2 + Math.sin(t * 4) * 3;
    ctx.fillStyle = '#7dff9a';
    ctx.beginPath();
    ctx.moveTo(x + 32, by + 14);
    ctx.lineTo(x + 24, by + 4);
    ctx.lineTo(x + 40, by + 4);
    ctx.fill();
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dff9a';
    ctx.fillText('EXIT', x + 32, by + 1);
  }

  private drawSpikes(g: Game) {
    const ctx = this.ctx;
    for (const s of g.spikes) {
      const x = s.tx * T;
      const y = s.ty * T;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) {
          const px = x + 7 + i * 9;
          const py = y + 8 + j * 9;
          ctx.fillStyle = '#111';
          ctx.fillRect(px, py, 4, 3);
          if (s.state >= 1) {
            const h = s.state === 2 ? 8 : 3;
            ctx.fillStyle = s.state === 2 ? '#d8d8e0' : '#8a8a92';
            ctx.beginPath();
            ctx.moveTo(px, py + 3);
            ctx.lineTo(px + 2, py + 3 - h);
            ctx.lineTo(px + 4, py + 3);
            ctx.fill();
          }
        }
    }
  }

  private drawCones(g: Game) {
    const ctx = this.ctx;
    const gv = g.guardVision();
    for (const gd of g.guards) {
      if (gd.state === 'ko') continue;
      const pts = g.cone(gd.x, gd.y - 12, gd.ang, gv.range, gv.fov);
      const col = gd.state === 'chase' ? '255,50,40' : gd.alert > 0.35 ? '255,150,40' : '255,235,140';
      fillPoly(ctx, pts, `rgba(${col},${gd.state === 'chase' ? 0.28 : 0.18})`);
    }
    const cvn = g.cameraVision();
    for (const c of g.cameras) {
      if (c.disabled > 0) continue;
      const pts = g.cone(c.x, c.y, c.ang, cvn.range, cvn.fov);
      fillPoly(ctx, pts, c.alert > 0.4 ? 'rgba(255,60,40,0.25)' : 'rgba(120,200,255,0.16)');
    }
  }

  private drawItems(g: Game, t: number) {
    const ctx = this.ctx;
    for (const it of g.items) {
      const bob = Math.sin(t * 3 + it.bob) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(it.x - 6, it.y + 5, 12, 3);
      ctx.drawImage(itemSprite(it.kind), Math.round(it.x - 8), Math.round(it.y - 9 + bob));
      if (it.count > 1) {
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(`x${it.count}`, it.x + 6, it.y - 4);
      }
    }
    for (const m of g.meats) ctx.drawImage(itemSprite('meat'), Math.round(m.x - 8), Math.round(m.y - 8));
    for (const toy of g.toys) {
      const j = Math.sin(t * 40) * 1.5;
      ctx.drawImage(itemSprite('toy'), Math.round(toy.x - 8 + j), Math.round(toy.y - 8));
    }
  }

  private drawLasers(g: Game, t: number) {
    const ctx = this.ctx;
    for (const l of g.lasers) {
      // emitters
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(l.a.x - 4, l.a.y - 4, 8, 8);
      ctx.fillRect(l.b.x - 4, l.b.y - 4, 8, 8);
      ctx.fillStyle = l.on ? '#ff3030' : l.warn ? '#ff9090' : '#602020';
      ctx.fillRect(l.a.x - 2, l.a.y - 2, 4, 4);
      ctx.fillRect(l.b.x - 2, l.b.y - 2, 4, 4);
      if (l.on) {
        ctx.strokeStyle = 'rgba(255,40,40,0.35)';
        ctx.lineWidth = 6;
        line(ctx, l.a, l.b);
        ctx.strokeStyle = '#ff5050';
        ctx.lineWidth = 2;
        line(ctx, l.a, l.b);
        ctx.strokeStyle = '#ffd0d0';
        ctx.lineWidth = 0.8;
        line(ctx, l.a, l.b);
      } else if (l.warn && Math.floor(t * 20) % 2) {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,80,80,0.6)';
        ctx.lineWidth = 1;
        line(ctx, l.a, l.b);
        ctx.setLineDash([]);
      }
    }
  }

  private drawCameras(g: Game, t: number) {
    const ctx = this.ctx;
    for (const c of g.cameras) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#222';
      ctx.fillRect(-3, -8, 6, 6);
      ctx.rotate(c.ang);
      ctx.fillStyle = c.disabled > 0 ? '#444' : '#ddd';
      ctx.fillRect(-4, -4, 12, 8);
      ctx.fillStyle = c.disabled > 0 ? '#222' : c.alert > 0.4 || Math.floor(t * 2) % 2 ? '#ff3030' : '#601010';
      ctx.fillRect(7, -2, 3, 4);
      ctx.restore();
      if (c.disabled > 0 && Math.random() < 0.15) {
        ctx.fillStyle = '#ffe080';
        ctx.fillRect(c.x + (Math.random() - 0.5) * 12, c.y + (Math.random() - 0.5) * 8, 2, 2);
      }
    }
  }

  private drawLenny(g: Game, t: number) {
    const ctx = this.ctx;
    const p = g.p;
    if (p.invuln > 0 && Math.floor(t * 14) % 2) return;
    shadow(ctx, p.x, p.y + 4, 10);
    const dir: Dir = p.face === 'up' ? 'up' : p.face === 'down' ? 'down' : 'side';
    const pose = lennyPose(g.level);
    // tiptoeing takes small, slow steps; the swagger is bouncier
    const step = Math.floor(p.anim * (pose === 0 ? 0.75 : 1));
    const frame = p.moving ? (step % 2 ? 1 : 2) : 0;
    const twitch = g.stage <= 2 && p.twitchT < 0 && dir !== 'up';
    // nervous shiver when something is onto him (fades as he gains confidence)
    const shiver = p.danger > 0.3 && g.stage <= 2 ? (Math.random() - 0.5) * (2.2 - g.stage * 0.7) : 0;
    const bob = 0;
    const spr = lennySprite(g.stage, dir, frame, twitch, pose);
    drawSprite(ctx, spr, p.x + shiver, p.y + 6 + bob, p.face === 'left');
    if (p.danger > 0.4 && g.stage <= 2) {
      ctx.fillStyle = '#8fd0ff';
      ctx.fillRect(p.x + 9, p.y - 22 + ((t * 20) % 6), 2, 3);
    }
    if (p.inSmoke) {
      ctx.fillStyle = 'rgba(200,200,210,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.held) {
      // what he's holding, in his hand
      const hx = p.face === 'left' ? p.x - 14 : p.x + 6;
      ctx.save();
      ctx.translate(hx, p.y - 6);
      ctx.scale(0.6, 0.6);
      ctx.drawImage(itemSprite(p.held), 0, 0);
      ctx.restore();
    }
  }

  private drawGuard(g: Game, gd: Game['guards'][number], t: number) {
    const ctx = this.ctx;
    shadow(ctx, gd.x, gd.y + 4, 10);
    if (gd.state === 'ko' && gd.armored) {
      // armour only staggers
      const wob = Math.sin(t * 30) * 1.5;
      drawSprite(ctx, guardSprite('down', 0, gd.variant, true), gd.x + wob, gd.y + 6, false);
      stars(ctx, gd.x, gd.y - 30, t);
      return;
    }
    if (gd.state === 'ko') {
      ctx.save();
      ctx.translate(gd.x, gd.y);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(guardSprite('down', 0, gd.variant), -24, -16);
      ctx.restore();
      stars(ctx, gd.x, gd.y - 14, t);
      return;
    }
    const f = faceDir(gd.ang);
    const frame = gd.moving ? (Math.floor(gd.anim) % 2 ? 1 : 2) : 0;
    drawSprite(ctx, guardSprite(f.dir, frame, gd.variant, gd.armored), gd.x, gd.y + 6, f.flip);
    void g;
  }

  private drawDog(d: Game['dogs'][number], t: number) {
    const ctx = this.ctx;
    shadow(ctx, d.x, d.y + 3, 12);
    const flip = Math.cos(d.ang) < 0;
    if (d.state === 'ko') {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(flip ? -1 : 1, -1);
      ctx.drawImage(dogSprite(0), -16, -20);
      ctx.restore();
      stars(ctx, d.x, d.y - 10, t);
      return;
    }
    const frame = d.moving ? (Math.floor(d.anim) % 2 ? 1 : 2) : 0;
    drawSprite(ctx, dogSprite(frame), d.x, d.y + 9, flip);
    if (d.state === 'eat' && Math.floor(t * 3) % 2) {
      ctx.fillStyle = '#ff8aa0';
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('♥', d.x, d.y - 22);
    }
  }

  private drawJeff(g: Game, t: number) {
    const j = g.jeff!;
    const ctx = this.ctx;
    shadow(ctx, j.x, j.y + 4, 10);
    const f = faceDir(j.ang);
    const frame = j.moving ? (Math.floor(j.anim) % 2 ? 1 : 2) : 0;
    const shake = g.jstage >= 3 ? (Math.random() - 0.5) * (g.jstage - 2) : 0;
    drawSprite(ctx, jeffSprite(g.jstage, f.dir, frame), j.x + shake, j.y + 6, f.flip);
    if (j.stun > 0) stars(ctx, j.x, j.y - 30, t);
  }

  private drawProjectiles(g: Game) {
    const ctx = this.ctx;
    for (const pr of g.projs) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(pr.x - 4, pr.y + 6, 8, 2);
      ctx.save();
      ctx.translate(pr.x, pr.y - pr.z);
      ctx.rotate(pr.spin);
      ctx.drawImage(itemSprite(pr.kind), -8, -8);
      ctx.restore();
    }
  }

  private drawClouds(g: Game, t: number) {
    const ctx = this.ctx;
    for (const c of g.clouds) {
      const life = Math.min(1, c.t * 3, (c.max - c.t) * 1.5 + 0.2);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + t * 0.3;
        const r = c.r * 0.55 * life;
        ctx.fillStyle = `rgba(${170 + i * 4},${170 + i * 4},${180 + i * 3},${0.55 * life})`;
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(a) * r * 0.7, c.y + Math.sin(a) * r * 0.5, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawRings(g: Game) {
    const ctx = this.ctx;
    for (const r of g.rings) {
      const k = r.t / 0.8;
      ctx.strokeStyle = r.color.replace(/[\d.]+\)$/, `${(1 - k) * 0.7})`);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * Math.sqrt(k), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawPoofs(g: Game) {
    const ctx = this.ctx;
    for (const pf of g.poofs) {
      const k = pf.t / 0.7;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = `rgba(90,60,110,${1 - k})`;
        ctx.beginPath();
        ctx.arc(pf.x + Math.cos(a) * 18 * k, pf.y + Math.sin(a) * 14 * k, 7 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawLighting(g: Game, t: number) {
    const th = this.theme!;
    const v = this.view;
    const d = this.dctx;
    const W = this.dark.width;
    const H = this.dark.height;
    const k = (0.5 * v.scale); // world px -> dark canvas px
    const wx = (x: number) => (x - v.camX) * k;
    const wy = (y: number) => (y - v.camY) * k;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    const tint = th.lightKind === 'moon' ? '8,14,34' : th.name.includes('Conservatory') ? '6,12,24' : '4,3,6';
    d.fillStyle = `rgba(${tint},${th.darkness})`;
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const glow = (x: number, y: number, r: number, a: number) => {
      const gx = wx(x);
      const gy = wy(y);
      const gr = r * k;
      if (gx < -gr || gy < -gr || gx > W + gr || gy > H + gr) return;
      const grad = d.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, `rgba(0,0,0,${a})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grad;
      d.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    };
    const L = g.L;
    glow(g.p.x, g.p.y - 10, th.playerLight * T, 1);
    for (const l of L.lights) {
      const flick = 0.85 + 0.15 * Math.sin(t * 9 + l.x * 3.1) * Math.sin(t * 13 + l.y);
      glow((l.x + 0.5) * T, (l.y + 1.2) * T, 3.4 * T * flick, 0.95);
    }
    glow(L.exit.x, L.exit.y, 2.2 * T, 0.9);
    for (const pr of L.props) if (GLOWING[pr.kind]) glow((pr.x + 0.5) * T, (pr.y + 0.4) * T, 1.6 * T, 0.7);
    for (const it of g.items) glow(it.x, it.y, 0.7 * T, 0.5);
    for (const l of g.lasers) if (l.on) glow((l.a.x + l.b.x) / 2, (l.a.y + l.b.y) / 2, 1.3 * T, 0.6);
    // guards' lanterns light up what they see
    d.globalCompositeOperation = 'destination-out';
    const gv = g.guardVision();
    for (const gd of g.guards) {
      if (gd.state === 'ko') continue;
      const pts = g.cone(gd.x, gd.y - 12, gd.ang, gv.range, gv.fov, 14);
      d.beginPath();
      d.moveTo(wx(pts[0].x), wy(pts[0].y));
      for (const p of pts) d.lineTo(wx(p.x), wy(p.y));
      d.closePath();
      d.fillStyle = 'rgba(0,0,0,0.55)';
      d.fill();
      glow(gd.x, gd.y - 10, 1.2 * T, 0.7);
    }
    for (const dg of g.dogs) glow(dg.x, dg.y, 0.9 * T, 0.5);
    if (g.jeff) glow(g.jeff.x, g.jeff.y - 12, 1.6 * T, 0.8);
    for (const c of g.cameras) if (c.disabled <= 0) glow(c.x, c.y, 0.6 * T, 0.6);

    // warm colour over the lit areas
    d.globalCompositeOperation = 'source-over';
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.dark, 0, 0, this.cv.width, this.cv.height);
    // torch tint
    if (th.lightKind === 'torch' || th.lightKind === 'candle' || th.lightKind === 'lamp') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(${th.lightColor},0.12)`;
      ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    }
    ctx.restore();

    // torch flames are drawn above the darkness so they glow
    for (const l of L.lights) this.drawLight(l, t, th);
    // the armoured guards' red eyes glow in the dark
    const c2 = this.ctx;
    for (const gd of g.guards) {
      if (!gd.armored || gd.state === 'ko') continue;
      const f = faceDir(gd.ang);
      if (f.dir === 'up') continue;
      const ex = f.dir === 'side' ? gd.x + (f.flip ? -4 : 4) : gd.x;
      const ey = gd.y - 19;
      const pulse = 0.6 + 0.4 * Math.sin(t * 5 + gd.variant);
      const grad = c2.createRadialGradient(ex, ey, 0, ex, ey, 10);
      grad.addColorStop(0, `rgba(255,40,40,${0.55 * pulse})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      c2.fillStyle = grad;
      c2.fillRect(ex - 10, ey - 10, 20, 20);
      c2.fillStyle = '#ff3030';
      if (f.dir === 'down') {
        c2.fillRect(gd.x - 3, ey, 2, 1);
        c2.fillRect(gd.x + 1, ey, 2, 1);
      } else c2.fillRect(ex - 1, ey, 2, 1);
    }
  }

  private drawLight(l: Pt, t: number, th: Theme) {
    const ctx = this.ctx;
    const x = (l.x + 0.5) * T;
    const y = l.y * T + 16;
    const f = Math.sin(t * 12 + l.x) * 1.5;
    if (th.lightKind === 'torch') {
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(x - 2, y, 4, 9);
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 4 + f * 0.3, 6 + f, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.ellipse(x, y - 1, 2, 3.5 + f * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (th.lightKind === 'candle') {
      ctx.fillStyle = '#b08a2a';
      ctx.fillRect(x - 7, y + 6, 14, 2);
      for (const dx of [-6, 0, 6]) {
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(x + dx - 1, y + 1, 2, 5);
        ctx.fillStyle = '#ffcf5a';
        ctx.fillRect(x + dx - 1, y - 2 + (f > 0 ? 0 : 1), 2, 3);
      }
    } else if (th.lightKind === 'lamp') {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x - 1, y - 6, 2, 4);
      ctx.fillStyle = '#ffe6a0';
      ctx.fillRect(x - 4, y - 2, 8, 7);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x - 5, y - 3, 10, 1);
      ctx.fillRect(x - 5, y + 5, 10, 1);
    }
  }

  private drawIcons(g: Game, t: number) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const gd of g.guards) {
      if (gd.state === 'ko') continue;
      if (gd.state === 'chase') {
        ctx.font = `bold 20px ${FONT}`;
        ctx.fillStyle = '#ff3b3b';
        ctx.fillText('!', gd.x, gd.y - 32 + Math.sin(t * 12) * 1.5);
      } else if (gd.alert > 0.12 || gd.state === 'investigate' || gd.state === 'search') {
        ctx.font = `bold 18px ${FONT}`;
        ctx.fillStyle = '#ffd34d';
        ctx.fillText('?', gd.x, gd.y - 32);
        // alert meter
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(gd.x - 9, gd.y - 30, 18, 3);
        ctx.fillStyle = gd.alert > 0.6 ? '#ff6b3b' : '#ffd34d';
        ctx.fillRect(gd.x - 9, gd.y - 30, 18 * gd.alert, 3);
      }
    }
    for (const c of g.cameras) {
      if (c.alert > 0.05 && c.disabled <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(c.x - 9, c.y - 16, 18, 3);
        ctx.fillStyle = '#ff6b3b';
        ctx.fillRect(c.x - 9, c.y - 16, 18 * c.alert, 3);
      }
    }
  }

  private drawPopups(g: Game) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const pp of g.popups) {
      const a = Math.min(1, 2 - pp.t * 1.4);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = '#000';
      ctx.fillText(pp.text, pp.x + 1, pp.y - pp.t * 18 + 1);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, pp.x, pp.y - pp.t * 18);
    }
    ctx.globalAlpha = 1;
  }

  private drawBubbles(g: Game) {
    const ctx = this.ctx;
    for (const b of g.bubbles) {
      const who = b.who === 'jeff' ? g.jeff : g.p;
      if (!who) continue;
      const a = Math.min(1, b.t * 6, (3.6 - b.t) * 3);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `13px ${FONT}`;
      const lines = wrap(ctx, b.text, 120);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10;
      const h = lines.length * 12 + 6;
      const x = who.x - w / 2;
      const y = who.y - 40 - h;
      ctx.fillStyle = b.who === 'jeff' ? '#1a1018' : '#f4f0e8';
      ctx.strokeStyle = b.who === 'jeff' ? '#c0a0ff' : '#212121';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(who.x - 3, y + h);
      ctx.lineTo(who.x + 3, y + h);
      ctx.lineTo(who.x, y + h + 5);
      ctx.fill();
      ctx.fillStyle = b.who === 'jeff' ? '#e8d8ff' : '#212121';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => ctx.fillText(l, who.x, y + 12 + i * 12));
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- minimap

  private updateExplored(g: Game) {
    const L = g.L;
    const ex = this.explored!;
    const tx = Math.floor(g.p.x / T);
    const ty = Math.floor(g.p.y / T);
    const r = 4;
    for (let y = ty - r; y <= ty + r; y++)
      for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < L.w && y < L.h) ex[y * L.w + x] = 1;
  }

  /** Draws the explored-map overlay into a canvas element. */
  drawMinimap(g: Game, target: HTMLCanvasElement, t: number) {
    const L = g.L;
    const ex = this.explored;
    if (!ex) return;
    const px = 3;
    if (target.width !== L.w * px) {
      target.width = L.w * px;
      target.height = L.h * px;
    }
    const c = target.getContext('2d')!;
    c.clearRect(0, 0, target.width, target.height);
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(0, 0, target.width, target.height);
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        if (!ex[y * L.w + x]) continue;
        c.fillStyle = isWall(L, x, y) ? 'rgba(200,190,170,0.55)' : 'rgba(70,60,60,0.7)';
        c.fillRect(x * px, y * px, px, px);
      }
    c.fillStyle = Math.floor(t * 3) % 2 ? '#7dff9a' : '#3a8a4a';
    c.fillRect(L.exitTile.x * px, L.exitTile.y * px, px * 2, px * 2);
    c.fillStyle = '#ffffff';
    c.fillRect(Math.floor(g.p.x / T) * px - 1, Math.floor(g.p.y / T) * px - 1, px + 2, px + 2);
  }
}

// ---------------------------------------------------------------- static layer

function buildStatic(L: LevelData, th: Theme): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = L.w * T;
  cv.height = L.h * T;
  const ctx = cv.getContext('2d')!;
  const rng = new Rng(L.seed + 5);
  // pre-paint tile variants
  const mk = (paint: (c: CanvasRenderingContext2D) => void) => {
    const t = document.createElement('canvas');
    t.width = T;
    t.height = T;
    paint(t.getContext('2d')!);
    return t;
  };
  const floors = [0, 1, 2, 0, 1].map((v) => mk((c) => th.floor(c, rng, v)));
  const tops = [0, 1].map(() => mk((c) => th.wallTop(c, rng)));
  const faces = [0, 0, 0, 1, 0, 2].map((v) => mk((c) => th.wallFace(c, rng, v)));
  for (let y = 0; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      const wall = isWall(L, x, y);
      if (!wall) ctx.drawImage(floors[rng.int(0, floors.length - 1)], x * T, y * T);
      else if (!isWall(L, x, y + 1) && y + 1 < L.h) ctx.drawImage(faces[rng.int(0, faces.length - 1)], x * T, y * T);
      else ctx.drawImage(tops[rng.int(0, tops.length - 1)], x * T, y * T);
    }
  // wall tops: darken them and add a lit rim so the maze reads clearly in the dark
  const FACE_TOP = 9;
  for (let y = 0; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      if (!isWall(L, x, y)) continue;
      const face = y + 1 < L.h && !isWall(L, x, y + 1);
      const h = face ? FACE_TOP : T;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x * T, y * T, T, h);
      ctx.fillStyle = 'rgba(255,240,220,0.22)';
      if (y > 0 && !isWall(L, x, y - 1)) ctx.fillRect(x * T, y * T, T, 2);
      if (!isWall(L, x - 1, y)) ctx.fillRect(x * T, y * T, 2, h);
      if (!isWall(L, x + 1, y)) ctx.fillRect(x * T + T - 2, y * T, 2, h);
      if (face) ctx.fillRect(x * T, y * T + h - 2, T, 2);
    }
  // soft shadow along the base of walls and their sides
  for (let y = 0; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      if (isWall(L, x, y)) continue;
      if (isWall(L, x, y - 1)) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x * T, y * T, T, 5);
      }
      if (isWall(L, x - 1, y)) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x * T, y * T, 3, T);
      }
    }
  for (const d of L.decor) {
    ctx.save();
    ctx.translate(d.x * T, d.y * T);
    th.decor(ctx, rng);
    ctx.restore();
  }
  const indoor = L.level <= 40;
  for (let y = 1; y < L.h; y++)
    for (let x = 0; x < L.w; x++) {
      if (!isWall(L, x, y) || isWall(L, x, y + 1) || y + 1 >= L.h) continue;
      // grime along the base of each wall face
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x * T, y * T + T - 3, T, 3);
      // cobwebs in the corners indoors
      if (indoor && rng.chance(0.12)) {
        const left = isWall(L, x - 1, y) && !isWall(L, x - 1, y + 1) ? rng.chance(0.5) : true;
        cobweb(ctx, x * T + (left ? 0 : T), (y + 1) * T, left ? 1 : -1);
      }
    }
  for (const p of L.props) {
    ctx.save();
    ctx.translate(p.x * T, p.y * T);
    drawProp(ctx, p.kind, rng);
    ctx.restore();
  }
  return cv;
}

// ---------------------------------------------------------------- helpers

function cobweb(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  ctx.strokeStyle = 'rgba(220,220,230,0.35)';
  ctx.lineWidth = 0.6;
  const r = 12;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * dir, y + Math.sin(a) * r);
  }
  for (const rr of [4, 8, 11]) {
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * (Math.PI / 2);
      const a1 = ((i + 1) / 4) * (Math.PI / 2);
      ctx.moveTo(x + Math.cos(a0) * rr * dir, y + Math.sin(a0) * rr);
      ctx.lineTo(x + Math.cos(a1) * rr * 0.85 * dir, y + Math.sin(a1) * rr * 0.85);
    }
  }
  ctx.stroke();
}

function drawSprite(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement, x: number, y: number, flip: boolean) {
  const dx = Math.round(x - spr.width / 2);
  const dy = Math.round(y - spr.height);
  if (!flip) ctx.drawImage(spr, dx, dy);
  else {
    ctx.save();
    ctx.translate(dx + spr.width, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0);
    ctx.restore();
  }
}

function faceDir(ang: number): { dir: Dir; flip: boolean } {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  if (Math.abs(c) > Math.abs(s)) return { dir: 'side', flip: c < 0 };
  return { dir: s > 0 ? 'down' : 'up', flip: false };
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stars(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + (i * Math.PI * 2) / 3;
    ctx.fillStyle = '#ffe14d';
    const sx = x + Math.cos(a) * 9;
    const sy = y + Math.sin(a) * 3;
    ctx.fillRect(sx - 1, sy - 3, 2, 6);
    ctx.fillRect(sx - 3, sy - 1, 6, 2);
  }
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}
