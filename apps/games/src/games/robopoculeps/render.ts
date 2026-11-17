// Robopoculeps drawing: a top-down mine lit by lanterns, the shop in the wall, robots and machines.
import { ORES, ZONES, type Kind, type OreId } from './data';
import { DIVIDERS, DOOR_H, DOOR_Y0, DX, DY, Game, H, SHOP_X, Tile, W, zoneOf, type Building, type Robot } from './game';

export interface Cam { x: number; y: number; T: number; w: number; h: number }

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export class Renderer {
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  w = 0;
  h = 0;
  private light = document.createElement('canvas');
  private lctx = this.light.getContext('2d')!;

  constructor(public cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.cv.clientWidth;
    this.h = this.cv.clientHeight;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.light.width = Math.ceil(this.w / 3);
    this.light.height = Math.ceil(this.h / 3);
  }

  cam(g: Game): Cam {
    const T = Math.round(Math.max(34, Math.min(58, Math.min(this.w, this.h) / 10)));
    const vw = this.w / T, vh = this.h / T;
    const clamp = (v: number, size: number, view: number) => (view >= size ? size / 2 : Math.max(view / 2, Math.min(size - view / 2, v)));
    return { x: clamp(g.player.x, W, vw), y: clamp(g.player.y, H, vh), T, w: this.w, h: this.h };
  }

  screenToTile(c: Cam, sx: number, sy: number) {
    return { x: Math.floor((sx - c.w / 2) / c.T + c.x), y: Math.floor((sy - c.h / 2) / c.T + c.y) };
  }

  draw(g: Game, t: number, ghost: { x: number; y: number; k: Kind | 'remove'; dir: number; ok: boolean } | null) {
    const { ctx } = this;
    const c = this.cam(g);
    const T = c.T;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0807';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(Math.round(this.w / 2 - c.x * T), Math.round(this.h / 2 - c.y * T));
    ctx.scale(T, T);
    const x0 = Math.max(0, Math.floor(c.x - c.w / T / 2) - 1), x1 = Math.min(W - 1, Math.ceil(c.x + c.w / T / 2) + 1);
    const y0 = Math.max(0, Math.floor(c.y - c.h / T / 2) - 1), y1 = Math.min(H - 1, Math.ceil(c.y + c.h / T / 2) + 1);

    // floor
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (g.tile(x, y) === Tile.Wall) continue;
        const r = hash(x, y);
        ctx.fillStyle = ZONES[zoneOf(x)].floor;
        ctx.fillRect(x, y, 1.02, 1.02);
        ctx.fillStyle = r < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,240,220,.04)';
        ctx.fillRect(x, y, 1.02, 1.02);
        if (r > 0.7) {
          ctx.fillStyle = 'rgba(0,0,0,.25)';
          ctx.beginPath();
          ctx.arc(x + hash(y, x) * 0.8 + 0.1, y + r * 0.7 + 0.1, 0.06 + r * 0.05, 0, 7);
          ctx.fill();
        }
      }
    // walls
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (g.tile(x, y) !== Tile.Wall) continue;
        ctx.fillStyle = '#1d1714';
        ctx.fillRect(x, y, 1.02, 1.02);
        const r = hash(x, y);
        ctx.fillStyle = '#28201b';
        ctx.beginPath();
        ctx.arc(x + 0.3 + r * 0.4, y + 0.35, 0.28, 0, 7);
        ctx.fill();
        if (g.tile(x, y + 1) !== Tile.Wall) {
          // wall face you can see from the floor
          ctx.fillStyle = '#4a3c33';
          ctx.fillRect(x, y + 0.62, 1.02, 0.4);
          ctx.fillStyle = '#5c4a3f';
          ctx.fillRect(x, y + 0.62, 1.02, 0.07);
          ctx.fillStyle = 'rgba(0,0,0,.25)';
          ctx.fillRect(x + r * 0.7, y + 0.72, 0.18, 0.05);
        }
      }
    this.drawShop(ctx, g, t);
    for (const l of g.lanterns) this.lantern(ctx, l.x, l.y, t);
    // boulders
    for (let k = 0; k < DIVIDERS.length; k++) {
      const d = DIVIDERS[k];
      if (g.tile(d, DOOR_Y0) !== Tile.Boulder) continue;
      for (let y = DOOR_Y0; y < DOOR_Y0 + DOOR_H; y++) {
        ctx.fillStyle = '#6b5a4c';
        ctx.beginPath();
        ctx.ellipse(d + 0.5, y + 0.52, 0.55, 0.5, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#816d5c';
        ctx.beginPath();
        ctx.ellipse(d + 0.42, y + 0.4, 0.35, 0.28, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = '#3b3029';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(d + 0.3, y + 0.3);
        ctx.lineTo(d + 0.5, y + 0.55);
        ctx.lineTo(d + 0.7, y + 0.5);
        ctx.stroke();
      }
      // sign
      const sy = DOOR_Y0 - 1.4;
      ctx.fillStyle = '#5a3d22';
      ctx.fillRect(d + 0.45, sy + 0.5, 0.1, 0.9);
      ctx.fillStyle = '#c99b5d';
      ctx.fillRect(d - 0.9, sy - 0.2, 2.8, 0.8);
      ctx.fillStyle = '#2a1a0c';
      ctx.font = 'bold 0.26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ZONES[k + 1].name, d + 0.5, sy + 0.12);
      ctx.fillStyle = k === g.unlocked ? '#a01818' : '#5a4a3a';
      ctx.font = 'bold 0.22px system-ui, sans-serif';
      ctx.fillText(`🧨 $${ZONES[k + 1].dynamite}`, d + 0.5, sy + 0.42);
    }
    // rocks
    for (const rock of g.rocks.values()) {
      if (rock.x < x0 || rock.x > x1 || rock.y < y0 || rock.y > y1) continue;
      this.rock(ctx, rock.x, rock.y, rock.ore, rock.amt / rock.max, g.miningRock === rock.y * W + rock.x ? Math.sin(t * 40) * 0.03 : 0);
    }
    // buildings
    const items: [number, number, OreId][] = [];
    for (const [i, b] of g.blds) {
      const x = i % W, y = (i / W) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      this.building(ctx, b, x, y, t);
      if (b.k === 'belt') for (const it of b.items) items.push([x + 0.5 + DX[b.dir] * (it.p - 0.5), y + 0.5 + DY[b.dir] * (it.p - 0.5), it.ore]);
      if (b.k === 'grabber' && b.held) {
        const a = b.swing > 0 ? 1 - b.swing : 0;
        items.push([x + 0.5 + DX[b.dir] * (a - 0.5) * 0.7, y + 0.5 + DY[b.dir] * (a - 0.5) * 0.7, b.held]);
      }
    }
    for (const [x, y, o] of items) this.oreChunk(ctx, x, y, o, 0.16);
    if (ghost) this.ghost(ctx, ghost);
    // player and robots, back to front
    const actors: { y: number; draw: () => void }[] = [{ y: g.player.y, draw: () => this.miner(ctx, g, t) }];
    for (const r of g.robots) actors.push({ y: r.y + 0.6, draw: () => this.robot(ctx, r, t, g.robotCap(r)) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();
    for (const q of g.particles) {
      ctx.globalAlpha = 1 - q.t / q.life;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    this.lighting(g, c, t);

    // floating text on top of the darkness
    ctx.save();
    ctx.translate(this.w / 2 - c.x * T, this.h / 2 - c.y * T);
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(T * 0.32)}px system-ui, sans-serif`;
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.min(1, 2.2 - f.t * 2);
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, f.x * T + 1.5, f.y * T + 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * T, f.y * T);
    }
    ctx.restore();
    return c;
  }

  private lighting(g: Game, c: Cam, t: number) {
    const L = this.lctx, s = 1 / 3, T = c.T;
    const lw = this.light.width, lh = this.light.height;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = 'rgba(6,3,2,.72)';
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = 'destination-out';
    const hole = (wx: number, wy: number, rad: number, k: number) => {
      const sx = (this.w / 2 + (wx - c.x) * T) * s, sy = (this.h / 2 + (wy - c.y) * T) * s, r = rad * T * s;
      if (sx < -r || sy < -r || sx > lw + r || sy > lh + r) return;
      const gr = L.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, `rgba(0,0,0,${k})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr;
      L.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    hole(g.player.x, g.player.y, 6.5, 1);
    hole(SHOP_X + 0.5, 1.8, 4.5, 1);
    for (const l of g.lanterns) hole(l.x, l.y + 0.5, 3.6 + Math.sin(t * 3 + l.x) * 0.15, 0.9);
    for (const r of g.robots) hole(r.x, r.y, 2.2, 0.7);
    for (const [i, b] of g.blds) if (b.k === 'payer') hole((i % W) + 0.5, ((i / W) | 0) + 0.5, 1.6, 0.6);
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.light, 0, 0, this.w, this.h);
  }

  private lantern(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.fillStyle = '#2a1c10';
    ctx.fillRect(x - 0.03, y - 0.35, 0.06, 0.2);
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(x - 0.13, y - 0.17, 0.26, 0.3);
    ctx.fillStyle = `rgba(255,${190 + Math.sin(t * 7 + x) * 20},90,1)`;
    ctx.fillRect(x - 0.08, y - 0.12, 0.16, 0.2);
  }

  private drawShop(ctx: CanvasRenderingContext2D, g: Game, t: number) {
    const x = SHOP_X - 1, y = 0.15;
    // the hole in the wall
    ctx.fillStyle = '#5b3a1f';
    ctx.fillRect(x - 0.15, y, 3.3, 1.9);
    ctx.fillStyle = '#2b1b10';
    ctx.fillRect(x, y + 0.15, 3, 1.6);
    // shelves with ores
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(x + 0.1, y + 0.55, 2.8, 0.06);
    ['stone', 'coal', 'iron', 'gold', 'diamond'].forEach((o, n) => this.oreChunk(ctx, x + 0.35 + n * 0.58, y + 0.45, o as OreId, 0.11));
    // shopkeeper (a cheerful fellow in a starry night-sky hat)
    const sx = SHOP_X + 0.5, sy = 1.15 + Math.sin(t * 2) * 0.02;
    ctx.fillStyle = '#7d3b8f';
    ctx.fillRect(sx - 0.3, sy + 0.05, 0.6, 0.5);
    ctx.fillStyle = '#f1c9a0';
    ctx.beginPath();
    ctx.arc(sx, sy - 0.08, 0.24, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#5a3418';
    ctx.beginPath();
    ctx.ellipse(sx - 0.09, sy + 0.02, 0.1, 0.04, -0.3, 0, 7);
    ctx.ellipse(sx + 0.09, sy + 0.02, 0.1, 0.04, 0.3, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(sx - 0.1, sy - 0.13, 0.05, 0.06);
    ctx.fillRect(sx + 0.05, sy - 0.13, 0.05, 0.06);
    ctx.fillStyle = '#1b2a6b';
    ctx.beginPath();
    ctx.moveTo(sx - 0.32, sy - 0.22);
    ctx.lineTo(sx + 0.32, sy - 0.22);
    ctx.lineTo(sx + 0.08, sy - 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe36b';
    for (const [dx, dy] of [[-0.12, -0.32], [0.1, -0.4], [0.02, -0.58]]) {
      ctx.beginPath();
      ctx.arc(sx + dx, sy + dy, 0.035 + Math.sin(t * 4 + dx * 20) * 0.01, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sx + 0.15, sy - 0.27, 0.06, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1b2a6b';
    ctx.beginPath();
    ctx.arc(sx + 0.17, sy - 0.29, 0.05, 0, 7);
    ctx.fill();
    // counter
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x - 0.1, 1.55, 3.2, 0.45);
    ctx.fillStyle = '#b07a40';
    ctx.fillRect(x - 0.1, 1.55, 3.2, 0.08);
    // sign
    ctx.fillStyle = '#d8a548';
    ctx.fillRect(x + 0.6, -0.05, 1.8, 0.36);
    ctx.fillStyle = '#3a220c';
    ctx.font = 'bold 0.26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHOP', SHOP_X + 0.5, 0.22);
    if (g.nearShop()) {
      ctx.fillStyle = 'rgba(255,230,120,.25)';
      ctx.fillRect(x - 0.15, y, 3.3, 1.9);
    }
  }

  private rock(ctx: CanvasRenderingContext2D, x: number, y: number, ore: OreId, frac: number, shake: number) {
    const info = ORES[ore];
    const s = 0.62 + frac * 0.38;
    const cx = x + 0.5 + shake, cy = y + 0.55;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.3 * s, 0.45 * s, 0.15 * s, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = info.rock;
    ctx.beginPath();
    ctx.moveTo(cx - 0.45 * s, cy + 0.25 * s);
    ctx.lineTo(cx - 0.38 * s, cy - 0.2 * s);
    ctx.lineTo(cx - 0.1 * s, cy - 0.42 * s);
    ctx.lineTo(cx + 0.28 * s, cy - 0.34 * s);
    ctx.lineTo(cx + 0.46 * s, cy + 0.02 * s);
    ctx.lineTo(cx + 0.4 * s, cy + 0.3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath();
    ctx.moveTo(cx - 0.38 * s, cy - 0.2 * s);
    ctx.lineTo(cx - 0.1 * s, cy - 0.42 * s);
    ctx.lineTo(cx + 0.28 * s, cy - 0.34 * s);
    ctx.lineTo(cx + 0.05 * s, cy - 0.1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = info.fleck;
    const fl = ore === 'stone' ? 3 : 5;
    for (let n = 0; n < fl; n++) {
      const a = hash(x * 7 + n, y * 3 + n);
      const b = hash(y * 5 + n, x * 11 + n);
      const px = cx + (a - 0.5) * 0.55 * s, py = cy + (b - 0.55) * 0.45 * s;
      ctx.beginPath();
      if (ore === 'diamond') {
        ctx.moveTo(px, py - 0.07);
        ctx.lineTo(px + 0.05, py);
        ctx.lineTo(px, py + 0.07);
        ctx.lineTo(px - 0.05, py);
      } else ctx.arc(px, py, ore === 'stone' ? 0.05 : 0.06, 0, 7);
      ctx.fill();
    }
  }

  oreChunk(ctx: CanvasRenderingContext2D, x: number, y: number, ore: OreId, r: number) {
    const info = ORES[ore];
    ctx.fillStyle = ore === 'stone' ? info.rock : info.fleck;
    ctx.beginPath();
    if (ore === 'diamond') {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.8, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.8, y);
    } else {
      ctx.moveTo(x - r, y + r * 0.6);
      ctx.lineTo(x - r * 0.7, y - r * 0.6);
      ctx.lineTo(x + r * 0.4, y - r);
      ctx.lineTo(x + r, y + r * 0.2);
      ctx.lineTo(x + r * 0.5, y + r * 0.8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 0.025;
    ctx.stroke();
  }

  private building(ctx: CanvasRenderingContext2D, b: Building, x: number, y: number, t: number) {
    const cx = x + 0.5, cy = y + 0.5;
    if (b.k === 'belt') {
      ctx.fillStyle = '#232629';
      ctx.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((b.dir * Math.PI) / 2);
      ctx.fillStyle = '#3a3f45';
      ctx.fillRect(-0.5, -0.38, 1, 0.76);
      ctx.beginPath();
      ctx.rect(-0.5, -0.38, 1, 0.76);
      ctx.clip();
      ctx.strokeStyle = '#e8b33a';
      ctx.lineWidth = 0.07;
      const off = (t * 2) % 0.5;
      for (let k = -1; k < 3; k++) {
        const px = -0.5 + off + k * 0.5;
        ctx.beginPath();
        ctx.moveTo(px - 0.1, -0.18);
        ctx.lineTo(px + 0.05, 0);
        ctx.lineTo(px - 0.1, 0.18);
        ctx.stroke();
      }
      ctx.restore();
    } else if (b.k === 'crate') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(x + 0.1, y + 0.2, 0.86, 0.8);
      ctx.fillStyle = '#9c6a36';
      ctx.fillRect(x + 0.08, y + 0.1, 0.84, 0.8);
      ctx.strokeStyle = '#5e3c1a';
      ctx.lineWidth = 0.06;
      ctx.strokeRect(x + 0.08, y + 0.1, 0.84, 0.8);
      ctx.beginPath();
      ctx.moveTo(x + 0.08, y + 0.1);
      ctx.lineTo(x + 0.92, y + 0.9);
      ctx.moveTo(x + 0.92, y + 0.1);
      ctx.lineTo(x + 0.08, y + 0.9);
      ctx.stroke();
      const n = Object.values(b.store).reduce((s, v) => s + (v ?? 0), 0);
      if (n) {
        ctx.fillStyle = 'rgba(0,0,0,.65)';
        ctx.fillRect(x + 0.18, y - 0.18, 0.64, 0.28);
        ctx.fillStyle = '#ffe6a8';
        ctx.font = 'bold 0.22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(n), cx, y + 0.03);
      }
    } else if (b.k === 'payer') {
      const pop = b.swing * 0.06;
      ctx.fillStyle = '#1d5e33';
      ctx.fillRect(x + 0.08 - pop, y + 0.1 - pop, 0.84 + pop * 2, 0.82 + pop * 2);
      ctx.fillStyle = '#2f8a4c';
      ctx.fillRect(x + 0.14, y + 0.16, 0.72, 0.5);
      ctx.fillStyle = '#111';
      ctx.fillRect(x + 0.25, y + 0.74, 0.5, 0.07);
      ctx.fillStyle = b.swing > 0 ? '#fff6a0' : '#d4ffda';
      ctx.font = 'bold 0.42px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', cx, y + 0.57);
    } else if (b.k === 'grabber') {
      ctx.fillStyle = '#3b3f52';
      ctx.beginPath();
      ctx.arc(cx, cy, 0.3, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#5c6380';
      ctx.beginPath();
      ctx.arc(cx, cy, 0.18, 0, 7);
      ctx.fill();
      // arm swings from the back to the front
      const a = b.held ? (b.swing > 0 ? 1 - b.swing : 0) : b.swing;
      const reach = (a - 0.5) * 0.7;
      const ex = cx + DX[b.dir] * reach, ey = cy + DY[b.dir] * reach;
      ctx.strokeStyle = '#f0a43a';
      ctx.lineWidth = 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#c9ced8';
      ctx.beginPath();
      ctx.arc(ex, ey, 0.08, 0, 7);
      ctx.fill();
      // direction arrow
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      const ax = cx + DX[b.dir] * 0.4, ay = cy + DY[b.dir] * 0.4;
      ctx.moveTo(ax + DX[b.dir] * 0.08, ay + DY[b.dir] * 0.08);
      ctx.lineTo(ax - DY[b.dir] * 0.08, ay + DX[b.dir] * 0.08);
      ctx.lineTo(ax + DY[b.dir] * 0.08, ay - DX[b.dir] * 0.08);
      ctx.fill();
    }
  }

  private ghost(ctx: CanvasRenderingContext2D, gh: { x: number; y: number; k: Kind | 'remove'; dir: number; ok: boolean }) {
    ctx.globalAlpha = 0.55;
    if (gh.k !== 'remove' && gh.ok) {
      this.building(ctx, { k: gh.k, dir: gh.dir, store: {}, items: [], t: 0, swing: 0, held: null }, gh.x, gh.y, 0);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gh.k === 'remove' ? '#ff6a6a' : gh.ok ? '#8dff9a' : '#ff6a6a';
    ctx.lineWidth = 0.06;
    ctx.strokeRect(gh.x + 0.03, gh.y + 0.03, 0.94, 0.94);
    if (gh.k !== 'remove' && gh.k !== 'crate' && gh.k !== 'payer') {
      const cx = gh.x + 0.5 + DX[gh.dir] * 0.75, cy = gh.y + 0.5 + DY[gh.dir] * 0.75;
      ctx.fillStyle = '#8dff9a';
      ctx.beginPath();
      ctx.moveTo(cx + DX[gh.dir] * 0.15, cy + DY[gh.dir] * 0.15);
      ctx.lineTo(cx - DY[gh.dir] * 0.15, cy + DX[gh.dir] * 0.15);
      ctx.lineTo(cx + DY[gh.dir] * 0.15, cy - DX[gh.dir] * 0.15);
      ctx.fill();
    }
  }

  private robot(ctx: CanvasRenderingContext2D, r: Robot, t: number, cap: number) {
    const king = r.kind === 'king';
    const s = king ? 1.4 : 1;
    const bob = Math.sin(r.phase * 4) * 0.06;
    const x = r.x, y = r.y - 0.45 + bob;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 0.3, 0.26 * s, 0.09 * s, 0, 0, 7);
    ctx.fill();
    // laser while mining
    if (r.state === 'mine') {
      ctx.strokeStyle = `rgba(255,${120 + Math.sin(t * 30) * 60},80,.85)`;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(x, y + 0.15 * s);
      ctx.lineTo(r.x + Math.sin(t * 9) * 0.12, r.y + 0.35);
      ctx.stroke();
    }
    // propeller
    ctx.strokeStyle = '#d9dde3';
    ctx.lineWidth = 0.04;
    const pa = t * 30;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.25 * s);
    ctx.lineTo(x, y - 0.33 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y - 0.34 * s, Math.abs(Math.cos(pa)) * 0.3 * s + 0.04, 0.03, 0, 0, 7);
    ctx.stroke();
    // body
    ctx.fillStyle = king ? '#f2c230' : '#b8c0cc';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.26 * s, 0.22 * s, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = king ? '#c99410' : '#7f8896';
    ctx.beginPath();
    ctx.ellipse(x, y + 0.1 * s, 0.24 * s, 0.1 * s, 0, 0, Math.PI);
    ctx.fill();
    // face screen
    ctx.fillStyle = '#16222c';
    ctx.beginPath();
    ctx.ellipse(x + r.face * 0.04 * s, y - 0.03 * s, 0.15 * s, 0.09 * s, 0, 0, 7);
    ctx.fill();
    const eye = r.kind === 'king' ? '#fff' : r.kind === 'stone' ? '#e0e0e0' : ORES[r.kind].fleck;
    ctx.fillStyle = eye;
    ctx.fillRect(x + r.face * 0.04 * s - 0.08 * s, y - 0.06 * s, 0.05 * s, 0.05 * s);
    ctx.fillRect(x + r.face * 0.04 * s + 0.03 * s, y - 0.06 * s, 0.05 * s, 0.05 * s);
    if (king) {
      ctx.fillStyle = '#ffe36b';
      ctx.beginPath();
      ctx.moveTo(x - 0.15, y - 0.28);
      ctx.lineTo(x - 0.15, y - 0.42);
      ctx.lineTo(x - 0.07, y - 0.33);
      ctx.lineTo(x, y - 0.46);
      ctx.lineTo(x + 0.07, y - 0.33);
      ctx.lineTo(x + 0.15, y - 0.42);
      ctx.lineTo(x + 0.15, y - 0.28);
      ctx.fill();
    }
    // cargo
    if (r.carry.length) {
      const n = Math.min(r.carry.length, 6);
      for (let k = 0; k < n; k++) this.oreChunk(ctx, x - 0.15 + (k % 3) * 0.15, y + 0.25 + Math.floor(k / 3) * 0.1, r.carry[k], 0.06);
      if (r.carry.length >= cap) {
        ctx.fillStyle = '#7dff8a';
        ctx.fillRect(x + 0.2 * s, y - 0.2 * s, 0.05, 0.05);
      }
    }
  }

  private miner(ctx: CanvasRenderingContext2D, g: Game, t: number) {
    const p = g.player;
    const x = p.x, y = p.y;
    const step = p.moving ? Math.sin(p.walk) * 0.06 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 0.3, 0.26, 0.09, 0, 0, 7);
    ctx.fill();
    // legs
    ctx.fillStyle = '#2f3a5a';
    ctx.fillRect(x - 0.15, y + 0.05 + step, 0.12, 0.25);
    ctx.fillRect(x + 0.03, y + 0.05 - step, 0.12, 0.25);
    // body (overalls)
    ctx.fillStyle = '#c8562d';
    ctx.fillRect(x - 0.2, y - 0.3, 0.4, 0.4);
    ctx.fillStyle = '#3d5aa8';
    ctx.fillRect(x - 0.17, y - 0.12, 0.34, 0.24);
    // pickaxe
    const swing = g.miningRock >= 0 ? Math.sin(p.swing * Math.PI * 2) : 0.3;
    ctx.save();
    ctx.translate(x + p.face * 0.2, y - 0.15);
    ctx.rotate(p.face * (0.4 + swing * 0.9));
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(-0.025, -0.45, 0.05, 0.45);
    ctx.fillStyle = '#b8c0cc';
    ctx.beginPath();
    ctx.moveTo(-0.2 * p.face, -0.38);
    ctx.quadraticCurveTo(0, -0.52, 0.2 * p.face, -0.38);
    ctx.lineTo(0, -0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // head
    ctx.fillStyle = '#f1c9a0';
    ctx.beginPath();
    ctx.arc(x, y - 0.45, 0.17, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#222';
    if (p.dir !== 3) {
      ctx.fillRect(x + p.face * 0.06 - 0.02, y - 0.47, 0.035, 0.05);
      ctx.fillRect(x + p.face * 0.06 + 0.06 * (p.face > 0 ? -1 : 1) - 0.02, y - 0.47, 0.035, 0.05);
    }
    // helmet with lamp
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(x, y - 0.5, 0.19, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 0.22, y - 0.52, 0.44, 0.05);
    ctx.fillStyle = `rgba(255,250,200,${0.85 + Math.sin(t * 5) * 0.1})`;
    ctx.beginPath();
    ctx.arc(x + p.face * 0.07, y - 0.6, 0.05, 0, 7);
    ctx.fill();
  }
}
