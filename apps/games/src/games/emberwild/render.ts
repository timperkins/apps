// Draws Emberwild: a 3/4 top-down view with block faces, day and night, and a fogged map.
import { B, G, ITEMS, RECIPES, isWater, type ItemId } from './data';
import { drawItem } from './art';
import type { Creature, Game } from './game';
import { DX, DY, type Machine } from './sim';
import { hash2 } from './world';
import { PLAYER_COLORS } from '../coop/session';

type C = CanvasRenderingContext2D;

const GROUND: Record<number, [string, string]> = {
  [G.WATER]: ['#3f8fc9', '#4a9bd3'],
  [G.DEEP]: ['#2a6aa8', '#2f72b0'],
  [G.GRASS]: ['#72b54e', '#7bbd55'],
  [G.SAND]: ['#e3cc8a', '#e8d396'],
  [G.SNOW]: ['#eef4f8', '#e3edf3'],
  [G.FOREST]: ['#4f9440', '#549a45'],
  [G.ROCKY]: ['#8c8a80', '#93918a'],
  [G.V_COAL]: ['#5b5852', '#625f58'],
  [G.V_COPPER]: ['#8c7466', '#937a6b'],
  [G.V_IRON]: ['#8a8784', '#918e8a'],
  [G.V_CRYSTAL]: ['#7f97b0', '#859db6'],
  [G.PATH]: ['#a09a8e', '#a8a296'],
  [G.RUIN]: ['#a7a08f', '#b0a998'],
};
const VEIN_FLECK: Record<number, string> = { [G.V_COAL]: '#1f1d1c', [G.V_COPPER]: '#e07a3e', [G.V_IRON]: '#d8cbbd', [G.V_CRYSTAL]: '#bff0ff' };
const MAP_COL: Record<number, [number, number, number]> = {
  [G.WATER]: [63, 143, 201], [G.DEEP]: [42, 106, 168], [G.GRASS]: [114, 181, 78], [G.SAND]: [227, 204, 138], [G.SNOW]: [238, 244, 248],
  [G.FOREST]: [60, 120, 52], [G.ROCKY]: [140, 138, 128], [G.V_COAL]: [60, 58, 55], [G.V_COPPER]: [200, 120, 70], [G.V_IRON]: [190, 180, 170],
  [G.V_CRYSTAL]: [120, 200, 240], [G.PATH]: [160, 154, 142], [G.RUIN]: [180, 160, 120],
};

const H = 0.38; // block height, in tiles

export class Renderer {
  c: C;
  w = 0;
  h = 0;
  ts = 40;
  dpr = 1;
  camX = 0;
  camY = 0;
  dark: HTMLCanvasElement;
  dc: C;
  map: HTMLCanvasElement;
  mc: C;
  mapImg: ImageData | null = null;
  mapTimer = 0;
  mapSeed = -1;

  constructor(public cv: HTMLCanvasElement) {
    this.c = cv.getContext('2d')!;
    this.dark = document.createElement('canvas');
    this.dc = this.dark.getContext('2d')!;
    this.map = document.createElement('canvas');
    this.mc = this.map.getContext('2d')!;
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width * this.dpr));
    this.h = Math.max(1, Math.round(r.height * this.dpr));
    this.cv.width = this.w;
    this.cv.height = this.h;
    this.dark.width = Math.ceil(this.w / 4);
    this.dark.height = Math.ceil(this.h / 4);
    this.ts = Math.round(Math.max(30 * this.dpr, Math.min(58 * this.dpr, Math.min(this.w, this.h) / 13)));
  }

  /** screen px -> world tiles */
  toWorld(sx: number, sy: number) {
    return { x: (sx * this.dpr - this.w / 2) / this.ts + this.camX, y: (sy * this.dpr - this.h / 2) / this.ts + this.camY };
  }

  // ---------- fog map ----------
  private ensureMap(g: Game) {
    const W = g.world.W;
    if (this.mapSeed !== g.world.seed || !this.mapImg) {
      this.map.width = this.map.height = W;
      this.mapImg = this.mc.createImageData(W, W);
      this.mapSeed = g.world.seed;
      this.paintMap(g, 0, 0, W - 1, W - 1);
    }
  }
  paintMap(g: Game, x0: number, y0: number, x1: number, y1: number) {
    const w = g.world, W = w.W, d = this.mapImg!.data;
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(W - 1, x1);
    y1 = Math.min(W - 1, y1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, o = i * 4;
        if (!w.fog[i]) {
          d[o] = 26;
          d[o + 1] = 30;
          d[o + 2] = 44;
          d[o + 3] = 255;
          continue;
        }
        let [r, gg, b] = MAP_COL[w.ground[i]] ?? [100, 100, 100];
        const blk = w.block[i];
        if (blk === B.TREE || blk === B.PINE || blk === B.PALM) [r, gg, b] = [44, 98, 42];
        else if (blk === B.ROCK || blk === B.SNOWROCK || blk === B.COBBLE) [r, gg, b] = [112, 110, 104];
        else if (blk === B.PLANK || blk === B.BRICK || blk === B.RUINWALL) [r, gg, b] = [150, 110, 70];
        if (g.fac.machines.has(i)) [r, gg, b] = [240, 190, 80];
        d[o] = r;
        d[o + 1] = gg;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
    this.mc.putImageData(this.mapImg!, 0, 0);
  }
  /** Draws the whole map (for the M screen) into the given canvas. */
  drawBigMap(g: Game, cv: HTMLCanvasElement, opts: { sel?: number }) {
    this.ensureMap(g);
    this.paintMap(g, 0, 0, g.world.W - 1, g.world.W - 1);
    const c = cv.getContext('2d')!;
    const W = g.world.W;
    const s = cv.width / W;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.map, 0, 0, cv.width, cv.height);
    this.mapMarkers(c, g, s, 0, 0, opts.sel);
  }
  private mapMarkers(c: C, g: Game, s: number, ox: number, oy: number, sel?: number) {
    const w = g.world;
    const pin = (x: number, y: number, col: string, r: number, ring?: string) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, r, 0, Math.PI * 2);
      c.fill();
      if (ring) {
        c.strokeStyle = ring;
        c.lineWidth = Math.max(1.5, r * 0.35);
        c.stroke();
      }
    };
    const R = Math.max(3, s * 2.4);
    w.stones.forEach((st, i) => {
      if (!w.fog[st.y * w.W + st.x]) return;
      pin(st.x, st.y, st.found ? '#6fd8ff' : '#56606e', R, i === sel ? '#fff' : '#132');
    });
    for (const b of w.beacons) {
      // beacons glow on the map from the start, so there's always somewhere to head for
      pin(b.x, b.y, b.lit ? '#ffb347' : '#a05a2a', R * 1.4, '#2a1408');
    }
    for (const ch of w.chests) if (!ch.opened && w.fog[ch.y * w.W + ch.x]) pin(ch.x, ch.y, '#ffe27a', R * 0.6);
    pin(w.home.x, w.home.y, '#fff', R * 0.7, '#4a3');
    pin(g.px - 0.5, g.py - 0.5, '#ff4f6a', R, '#fff');
  }

  // ---------- main frame ----------
  frame(g: Game, view: { hover: { x: number; y: number } | null; ghost: ItemId | null; ghostDir: number; ghostOk: boolean; minimap: boolean; mapTop: number }) {
    const { c, ts, w: SW, h: SH } = this;
    const time = g.t;
    // smooth camera
    this.camX += (g.px - this.camX) * 0.2;
    this.camY += (g.py - this.camY) * 0.2;
    if (Math.abs(g.px - this.camX) > 20 || Math.abs(g.py - this.camY) > 20) {
      this.camX = g.px;
      this.camY = g.py;
    }
    const ox = SW / 2 - this.camX * ts, oy = SH / 2 - this.camY * ts;
    const x0 = Math.floor(this.camX - SW / 2 / ts) - 1, x1 = Math.ceil(this.camX + SW / 2 / ts) + 1;
    const y0 = Math.floor(this.camY - SH / 2 / ts) - 1, y1 = Math.ceil(this.camY + SH / 2 / ts) + 2;
    const w = g.world;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a6aa8';
    c.fillRect(0, 0, SW, SH);
    c.setTransform(ts, 0, 0, ts, ox, oy);

    // ground
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const gr = w.g(x, y);
        const pal = GROUND[gr] ?? GROUND[G.GRASS];
        const r = hash2(x, y, 5);
        c.fillStyle = pal[r < 0.5 ? 0 : 1];
        c.fillRect(x, y, 1.02, 1.02);
        if (isWater(gr)) {
          const sh = Math.sin(time * 1.6 + x * 0.9 + y * 0.6);
          if (sh > 0.6) {
            c.fillStyle = 'rgba(255,255,255,.18)';
            c.fillRect(x + 0.2 + r * 0.3, y + 0.4, 0.3, 0.05);
          }
          // shore foam
          if (!isWater(w.g(x, y - 1))) {
            c.fillStyle = 'rgba(255,255,255,.35)';
            c.fillRect(x, y, 1, 0.07);
          }
          continue;
        }
        if (VEIN_FLECK[gr]) {
          c.fillStyle = VEIN_FLECK[gr];
          for (let k = 0; k < 4; k++) c.fillRect(x + hash2(x, y, 20 + k) * 0.8, y + hash2(x, y, 30 + k) * 0.8, 0.12, 0.1);
        } else if (gr === G.GRASS || gr === G.FOREST) {
          if (r < 0.3) {
            c.fillStyle = 'rgba(30,80,20,.35)';
            c.fillRect(x + r * 2, y + 0.5, 0.06, 0.16);
            c.fillRect(x + r * 2 + 0.1, y + 0.45, 0.06, 0.2);
          } else if (gr === G.GRASS && r > 0.96) {
            c.fillStyle = r > 0.98 ? '#ffe36b' : '#f4f4ff';
            c.beginPath();
            c.arc(x + 0.5, y + 0.5, 0.07, 0, Math.PI * 2);
            c.fill();
          }
        } else if (gr === G.SAND && r < 0.15) {
          c.fillStyle = 'rgba(160,120,60,.35)';
          c.fillRect(x + r * 5, y + 0.6, 0.08, 0.06);
        } else if (gr === G.RUIN || gr === G.PATH) {
          c.strokeStyle = 'rgba(70,60,50,.25)';
          c.lineWidth = 0.03;
          c.strokeRect(x + 0.02, y + 0.02, 0.96, 0.96);
        }
        // water edge shading
        if (isWater(w.g(x, y + 1))) {
          c.fillStyle = 'rgba(90,60,30,.55)';
          c.fillRect(x, y + 0.88, 1, 0.14);
        }
      }

    // belts and flat things
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const m = g.fac.at(x, y);
        if (m?.kind === 'belt') this.belt(m, time);
      }
    // target highlight on the ground
    if (view.hover) {
      const { x, y } = view.hover;
      c.strokeStyle = view.ghost ? (view.ghostOk ? 'rgba(140,255,150,.9)' : 'rgba(255,110,110,.9)') : 'rgba(255,255,255,.8)';
      c.lineWidth = 0.06;
      c.strokeRect(x + 0.03, y + 0.03, 0.94, 0.94);
    }

    // rows: blocks, machines, things and creatures, back to front
    const byRow = new Map<number, Creature[]>();
    for (const cr of g.creatures) {
      const ry = Math.floor(cr.y);
      if (ry < y0 || ry > y1 || cr.x < x0 || cr.x > x1 + 1) continue;
      if (!byRow.has(ry)) byRow.set(ry, []);
      byRow.get(ry)!.push(cr);
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = w.b(x, y);
        if (b) this.block(b, x, y, time);
        const m = g.fac.at(x, y);
        if (m && m.kind !== 'belt') this.machine(m, time);
      }
      for (const b of w.beacons) if (b.y === y && b.x >= x0 && b.x <= x1) this.beacon(b.x, b.y, b.lit, time);
      for (const s of w.stones) if (s.y === y && s.x >= x0 && s.x <= x1) this.waystone(s.x, s.y, s.found, time);
      for (const ch of w.chests) if (!ch.opened && ch.y === y && ch.x >= x0 && ch.x <= x1) this.treasure(ch.x, ch.y, time);
      for (const cr of byRow.get(y) ?? []) this.creature(cr, time);
      for (const h of g.heroes) {
        const hy = h === g.active ? g.py : h.py;
        if (Math.floor(hy) === y) g.as(h, () => this.player(g, time));
      }
    }

    // placement ghost
    if (view.hover && view.ghost) {
      c.globalAlpha = 0.55;
      const { x, y } = view.hover;
      c.save();
      c.translate(x + 0.5, y + 0.5);
      c.scale(0.8, 0.8);
      drawItem(c, view.ghost);
      c.restore();
      if (ITEMS[view.ghost].machine && ITEMS[view.ghost].machine !== 'campfire' && ITEMS[view.ghost].machine !== 'lamp' && ITEMS[view.ghost].machine !== 'chest') this.arrow(x, y, view.ghostDir, '#8dff9a');
      c.globalAlpha = 1;
    }

    // mining crack
    if (g.mining && g.mining.need < 50) {
      const { x, y, prog, need } = g.mining;
      const f = Math.min(1, prog / need);
      c.fillStyle = 'rgba(0,0,0,.55)';
      c.fillRect(x + 0.1, y - 0.25, 0.8, 0.14);
      c.fillStyle = '#ffe27a';
      c.fillRect(x + 0.12, y - 0.23, 0.76 * f, 0.1);
    }

    // shots
    for (const s of g.shots) {
      if (s.enemy) {
        c.fillStyle = '#ffcf5a';
        c.beginPath();
        c.arc(s.x, s.y - 0.4, 0.14 + Math.sin(time * 30) * 0.03, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,120,40,.4)';
        c.beginPath();
        c.arc(s.x, s.y - 0.4, 0.28, 0, Math.PI * 2);
        c.fill();
      } else {
        c.save();
        c.translate(s.x, s.y - 0.4);
        c.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 4 + Math.PI / 2);
        c.scale(0.8, 0.8);
        drawItem(c, 'arrow');
        c.restore();
      }
    }
    // particles
    for (const p of g.parts) {
      c.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2 - 0.3, p.size, p.size);
    }
    c.globalAlpha = 1;

    // night
    const dk = g.darkness;
    if (dk > 0.01) this.night(g, dk * 0.82, ox, oy);

    // floating text
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.textAlign = 'center';
    c.font = `900 ${Math.round(ts * 0.34)}px ui-rounded, system-ui, sans-serif`;
    for (const f of g.floats) {
      const sx = ox + f.x * ts, sy = oy + f.y * ts;
      c.globalAlpha = Math.min(1, f.life * 1.5);
      c.lineWidth = 4 * this.dpr;
      c.strokeStyle = 'rgba(0,0,0,.6)';
      c.strokeText(f.text, sx, sy);
      c.fillStyle = f.color;
      c.fillText(f.text, sx, sy);
    }
    c.globalAlpha = 1;
    if (g.others.length) {
      // a numbered dot over each hero when playing together
      c.font = `900 ${Math.round(ts * 0.3)}px ui-rounded, system-ui, sans-serif`;
      c.textBaseline = 'middle';
      for (const h of g.heroes) {
        const hx = h === g.active ? g.px : h.px, hy = h === g.active ? g.py : h.py;
        if ((h === g.active ? g.dead : h.dead) > 0) continue;
        const sx = ox + hx * ts, sy = oy + (hy - 1.25) * ts;
        c.fillStyle = PLAYER_COLORS[h.slot] ?? '#fff';
        c.beginPath();
        c.arc(sx, sy, ts * 0.2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#111';
        c.fillText(String(h.slot + 1), sx, sy + 1);
      }
      c.textBaseline = 'alphabetic';
    }

    if (g.dead) {
      c.fillStyle = `rgba(20,0,10,${Math.min(0.7, (2.2 - g.dead) * 0.6)})`;
      c.fillRect(0, 0, SW, SH);
    }

    // minimap
    if (view.minimap) this.minimap(g, view.mapTop);
  }

  private minimap(g: Game, top: number) {
    this.ensureMap(g);
    this.mapTimer++;
    if (this.mapTimer % 20 === 0) this.paintMap(g, Math.floor(g.px) - 18, Math.floor(g.py) - 18, Math.floor(g.px) + 18, Math.floor(g.py) + 18);
    const c = this.c;
    const size = Math.round(Math.min(150 * this.dpr, this.w * 0.28));
    const view = 70; // tiles across
    const x = this.w - size - 10 * this.dpr, y = top * this.dpr;
    c.save();
    c.beginPath();
    c.roundRect(x, y, size, size, 12 * this.dpr);
    c.fillStyle = '#1a1e2c';
    c.fill();
    c.clip();
    c.imageSmoothingEnabled = false;
    const s = size / view;
    const mx = g.px - view / 2, my = g.py - view / 2;
    c.drawImage(this.map, mx, my, view, view, x, y, size, size);
    this.mapMarkers(c, g, s, x - mx * s, y - my * s);
    c.restore();
    c.strokeStyle = 'rgba(255,230,180,.8)';
    c.lineWidth = 2 * this.dpr;
    c.beginPath();
    c.roundRect(x, y, size, size, 12 * this.dpr);
    c.stroke();
  }

  private night(g: Game, alpha: number, ox: number, oy: number) {
    const d = this.dc, dw = this.dark.width, dh = this.dark.height;
    const k = this.ts / 4;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, dw, dh);
    d.fillStyle = `rgba(8,10,34,${alpha})`;
    d.fillRect(0, 0, dw, dh);
    d.globalCompositeOperation = 'destination-out';
    for (const l of g.lights()) {
      const sx = (ox + l.x * this.ts) / 4, sy = (oy + l.y * this.ts) / 4;
      const r = l.r * k * (1 + Math.sin(g.t * 7 + l.x) * 0.02);
      if (sx < -r || sy < -r || sx > dw + r || sy > dh + r) continue;
      const grd = d.createRadialGradient(sx, sy, 0, sx, sy, r);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.55, 'rgba(0,0,0,.75)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.beginPath();
      d.arc(sx, sy, r, 0, Math.PI * 2);
      d.fill();
    }
    const c = this.c;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.dark, 0, 0, this.w, this.h);
    c.restore();
  }

  // ---------- pieces ----------
  private cube(x: number, y: number, top: string, front: string, h = H) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.fillRect(x + 0.05, y + 0.9, 1, 0.16);
    c.fillStyle = front;
    c.fillRect(x, y + 1 - h, 1, h);
    c.fillStyle = top;
    c.fillRect(x, y - h, 1, 1);
  }
  private arrow(x: number, y: number, dir: number, col: string) {
    const c = this.c;
    c.save();
    c.translate(x + 0.5 + DX[dir] * 0.55, y + 0.5 + DY[dir] * 0.55 - 0.1);
    c.rotate((dir * Math.PI) / 2);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0.16, 0);
    c.lineTo(-0.08, -0.13);
    c.lineTo(-0.08, 0.13);
    c.fill();
    c.restore();
  }

  private block(b: number, x: number, y: number, t: number) {
    const c = this.c;
    const r = hash2(x, y, 77);
    switch (b) {
      case B.TREE:
      case B.PINE:
      case B.PALM: {
        c.fillStyle = 'rgba(0,0,0,.2)';
        c.beginPath();
        c.ellipse(x + 0.5, y + 0.85, 0.45, 0.16, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#6b4424';
        c.fillRect(x + 0.42, y + 0.2, 0.16, 0.68);
        const sway = Math.sin(t * 1.2 + x * 0.7) * 0.03;
        if (b === B.TREE) {
          const col = r < 0.5 ? '#3f8a3a' : '#468f3c';
          c.fillStyle = '#2f6e2c';
          c.beginPath();
          c.arc(x + 0.5 + sway, y + 0.0, 0.52, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = col;
          c.beginPath();
          c.arc(x + 0.45 + sway, y - 0.1, 0.42, 0, Math.PI * 2);
          c.arc(x + 0.7 + sway, y + 0.05, 0.3, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,.12)';
          c.beginPath();
          c.arc(x + 0.36 + sway, y - 0.24, 0.16, 0, Math.PI * 2);
          c.fill();
          if (r > 0.75) {
            c.fillStyle = '#d93b2e';
            c.beginPath();
            c.arc(x + 0.66 + sway, y - 0.02, 0.06, 0, Math.PI * 2);
            c.fill();
          }
        } else if (b === B.PINE) {
          const snow = r > 0.55;
          for (let k = 0; k < 3; k++) {
            const yy = y + 0.45 - k * 0.32, wd = 0.55 - k * 0.13;
            c.fillStyle = k % 2 ? '#2c6b3e' : '#265f37';
            c.beginPath();
            c.moveTo(x + 0.5 - wd + sway * k, yy);
            c.lineTo(x + 0.5 + wd + sway * k, yy);
            c.lineTo(x + 0.5 + sway * k * 1.5, yy - 0.55);
            c.fill();
            if (snow) {
              c.fillStyle = '#f4f8fb';
              c.beginPath();
              c.moveTo(x + 0.5 - wd * 0.35 + sway * k, yy - 0.36);
              c.lineTo(x + 0.5 + wd * 0.35 + sway * k, yy - 0.36);
              c.lineTo(x + 0.5 + sway * k * 1.5, yy - 0.55);
              c.fill();
            }
          }
        } else {
          c.fillStyle = '#2f8a3a';
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + 0.3;
            c.beginPath();
            c.ellipse(x + 0.5 + Math.cos(a) * 0.3 + sway, y - 0.05 + Math.sin(a) * 0.15, 0.32, 0.1, a, 0, Math.PI * 2);
            c.fill();
          }
        }
        break;
      }
      case B.ROCK:
      case B.SNOWROCK:
      case B.COAL:
      case B.COPPER:
      case B.IRON:
      case B.CRYSTAL: {
        const top = b === B.SNOWROCK ? '#e8eef2' : r < 0.5 ? '#9d9a92' : '#a39f97';
        this.cube(x, y, top, b === B.SNOWROCK ? '#8f97a0' : '#6f6c66');
        c.strokeStyle = 'rgba(0,0,0,.12)';
        c.lineWidth = 0.03;
        c.beginPath();
        c.moveTo(x + 0.2, y - 0.2);
        c.lineTo(x + 0.45, y + 0.1);
        c.lineTo(x + 0.8, y + 0.0);
        c.stroke();
        const fleck = ({ [B.COAL]: '#1f1d1c', [B.COPPER]: '#e8803e', [B.IRON]: '#efe1cf', [B.CRYSTAL]: '#9ff0ff' } as Record<number, string>)[b];
        if (fleck) {
          c.fillStyle = fleck;
          for (let k = 0; k < 5; k++) {
            const fx = x + 0.12 + hash2(x, y, k) * 0.72, fy = y - H + 0.12 + hash2(x, y, k + 9) * 0.72;
            if (b === B.CRYSTAL) {
              c.beginPath();
              c.moveTo(fx, fy - 0.12);
              c.lineTo(fx + 0.06, fy);
              c.lineTo(fx, fy + 0.08);
              c.lineTo(fx - 0.06, fy);
              c.fill();
            } else c.fillRect(fx, fy, 0.13, 0.1);
          }
          if (b === B.CRYSTAL) {
            c.fillStyle = `rgba(180,240,255,${0.15 + Math.sin(t * 2 + x) * 0.1})`;
            c.fillRect(x, y - H, 1, 1);
          }
        }
        break;
      }
      case B.CACTUS:
        c.fillStyle = 'rgba(0,0,0,.18)';
        c.beginPath();
        c.ellipse(x + 0.5, y + 0.86, 0.3, 0.1, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4d9a4a';
        c.beginPath();
        c.roundRect(x + 0.38, y - 0.1, 0.24, 0.96, 0.12);
        c.roundRect(x + 0.16, y + 0.15, 0.16, 0.35, 0.08);
        c.roundRect(x + 0.68, y + 0.05, 0.16, 0.32, 0.08);
        c.fill();
        c.fillRect(x + 0.3, y + 0.4, 0.1, 0.08);
        c.fillRect(x + 0.6, y + 0.3, 0.1, 0.08);
        break;
      case B.BUSH:
        c.fillStyle = '#3c7d34';
        c.beginPath();
        c.arc(x + 0.35, y + 0.55, 0.26, 0, Math.PI * 2);
        c.arc(x + 0.62, y + 0.5, 0.28, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#d43a5a';
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.arc(x + 0.25 + hash2(x, y, k) * 0.5, y + 0.35 + hash2(x, y, k + 4) * 0.35, 0.06, 0, Math.PI * 2);
          c.fill();
        }
        break;
      case B.MUSHROOM:
        c.fillStyle = '#efe6d2';
        c.fillRect(x + 0.45, y + 0.5, 0.1, 0.25);
        c.fillStyle = '#c8452f';
        c.beginPath();
        c.ellipse(x + 0.5, y + 0.52, 0.2, 0.14, 0, Math.PI, 0);
        c.fill();
        c.fillStyle = '#fff';
        c.fillRect(x + 0.42, y + 0.44, 0.05, 0.05);
        break;
      case B.PLANK:
        this.cube(x, y, '#c99355', '#9a6a36');
        c.strokeStyle = 'rgba(90,50,20,.45)';
        c.lineWidth = 0.03;
        for (const yy of [0.0, 0.33]) {
          c.beginPath();
          c.moveTo(x, y - H + 0.33 + yy);
          c.lineTo(x + 1, y - H + 0.33 + yy);
          c.stroke();
        }
        break;
      case B.BRICK:
      case B.RUINWALL:
        this.cube(x, y, b === B.RUINWALL ? '#b3ab98' : '#b1aca3', b === B.RUINWALL ? '#7e7766' : '#7d7972');
        c.strokeStyle = 'rgba(60,55,50,.4)';
        c.lineWidth = 0.03;
        c.beginPath();
        c.moveTo(x, y - H + 0.5);
        c.lineTo(x + 1, y - H + 0.5);
        c.moveTo(x + 0.5, y - H);
        c.lineTo(x + 0.5, y - H + 0.5);
        c.moveTo(x + 0.25, y - H + 0.5);
        c.lineTo(x + 0.25, y - H + 1);
        c.moveTo(x + 0.75, y - H + 0.5);
        c.lineTo(x + 0.75, y - H + 1);
        c.stroke();
        if (b === B.RUINWALL && r > 0.6) {
          c.fillStyle = '#5f8a3a';
          c.fillRect(x + 0.1, y + 0.5, 0.3, 0.12);
        }
        break;
      case B.GLASS:
        c.fillStyle = 'rgba(190,235,255,.35)';
        c.fillRect(x, y - H, 1, 1 + H);
        c.strokeStyle = 'rgba(240,252,255,.9)';
        c.lineWidth = 0.04;
        c.strokeRect(x + 0.02, y - H + 0.02, 0.96, 0.96);
        c.beginPath();
        c.moveTo(x + 0.2, y - H + 0.6);
        c.lineTo(x + 0.6, y - H + 0.2);
        c.stroke();
        break;
      case B.COBBLE:
        this.cube(x, y, '#8f8c86', '#66635e');
        c.fillStyle = 'rgba(0,0,0,.15)';
        for (let k = 0; k < 4; k++) c.fillRect(x + 0.1 + hash2(x, y, k) * 0.7, y - H + 0.1 + hash2(x, y, k + 3) * 0.7, 0.18, 0.12);
        break;
    }
  }

  private belt(m: Machine, t: number) {
    const c = this.c;
    const { x, y, dir } = m;
    c.fillStyle = '#33383e';
    c.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
    c.fillStyle = '#23272c';
    if (dir % 2 === 0) {
      c.fillRect(x, y + 0.04, 1, 0.1);
      c.fillRect(x, y + 0.86, 1, 0.1);
    } else {
      c.fillRect(x + 0.04, y, 0.1, 1);
      c.fillRect(x + 0.86, y, 0.1, 1);
    }
    c.save();
    c.translate(x + 0.5, y + 0.5);
    c.rotate((dir * Math.PI) / 2);
    c.beginPath();
    c.rect(-0.5, -0.4, 1, 0.8);
    c.clip();
    c.strokeStyle = '#d9a632';
    c.lineWidth = 0.06;
    const off = (t * 1.6) % 0.5;
    for (let k = -1; k < 3; k++) {
      const px = -0.5 + k * 0.5 + off;
      c.beginPath();
      c.moveTo(px - 0.08, -0.2);
      c.lineTo(px + 0.08, 0);
      c.lineTo(px - 0.08, 0.2);
      c.stroke();
    }
    c.restore();
    for (const it of m.items!) {
      const p = Math.min(1, it.p);
      const ix = x + 0.5 + DX[dir] * (p - 0.5), iy = y + 0.5 + DY[dir] * (p - 0.5);
      c.save();
      c.translate(ix, iy);
      c.scale(0.45, 0.45);
      drawItem(c, it.id);
      c.restore();
    }
  }

  private machine(m: Machine, t: number) {
    const c = this.c;
    const { x, y } = m;
    switch (m.kind) {
      case 'drill': {
        this.cube(x, y, '#d39a3a', '#9a6a22', 0.45);
        c.fillStyle = '#5a5f66';
        c.beginPath();
        c.arc(x + 0.5, y + 0.05, 0.26, 0, Math.PI * 2);
        c.fill();
        c.save();
        c.translate(x + 0.5, y + 0.05);
        c.rotate(m.working ? t * 8 : 0);
        c.strokeStyle = '#2c2f33';
        c.lineWidth = 0.07;
        c.beginPath();
        c.moveTo(-0.2, 0);
        c.lineTo(0.2, 0);
        c.moveTo(0, -0.2);
        c.lineTo(0, 0.2);
        c.stroke();
        c.restore();
        this.arrow(x, y, m.dir, '#ffe27a');
        if (m.working && Math.random() < 0.1) {
          c.fillStyle = 'rgba(160,150,140,.6)';
          c.fillRect(x + Math.random(), y + 0.6 + Math.random() * 0.3, 0.08, 0.08);
        }
        break;
      }
      case 'furnace': {
        this.cube(x, y, '#a19b92', '#77726b', 0.5);
        c.fillStyle = '#4a4540';
        c.fillRect(x + 0.3, y - 0.42, 0.4, 0.3);
        c.fillStyle = m.working ? `rgba(255,${140 + Math.sin(t * 12) * 30},40,1)` : '#3a2a20';
        c.beginPath();
        c.roundRect(x + 0.3, y + 0.58, 0.4, 0.3, 0.1);
        c.fill();
        if (m.working && Math.random() < 0.2) {
          c.fillStyle = 'rgba(200,200,200,.5)';
          c.fillRect(x + 0.45 + Math.random() * 0.1, y - 0.6 - Math.random() * 0.3, 0.1, 0.1);
        }
        this.arrow(x, y, m.dir, '#ffe27a');
        break;
      }
      case 'assembler': {
        this.cube(x, y, '#7c93b8', '#4f6488', 0.5);
        c.save();
        c.translate(x + 0.5, y);
        c.rotate(m.working ? t * 2 : 0);
        c.fillStyle = '#c4cfe0';
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, rad = i % 2 ? 0.26 : 0.34;
          c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        c.fill();
        c.restore();
        const r = RECIPES[m.recipe ?? -1];
        if (r) {
          c.save();
          c.translate(x + 0.5, y);
          c.scale(0.38, 0.38);
          drawItem(c, r.out);
          c.restore();
        }
        this.arrow(x, y, m.dir, '#ffe27a');
        break;
      }
      case 'chest':
        this.cube(x + 0.1, y + 0.1, '#b07a40', '#7c4f24', 0.4);
        c.fillStyle = '#e8c35a';
        c.fillRect(x + 0.53, y + 0.5, 0.14, 0.16);
        break;
      case 'campfire': {
        c.fillStyle = '#7a7670';
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          c.beginPath();
          c.arc(x + 0.5 + Math.cos(a) * 0.34, y + 0.62 + Math.sin(a) * 0.2, 0.08, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = '#6b4424';
        c.fillRect(x + 0.24, y + 0.56, 0.52, 0.1);
        const f = Math.sin(t * 14 + x) * 0.04;
        c.fillStyle = '#ff7a1a';
        c.beginPath();
        c.moveTo(x + 0.3, y + 0.62);
        c.quadraticCurveTo(x + 0.28, y + 0.25, x + 0.5 + f, y + 0.0);
        c.quadraticCurveTo(x + 0.72, y + 0.25, x + 0.7, y + 0.62);
        c.fill();
        c.fillStyle = '#ffd34a';
        c.beginPath();
        c.moveTo(x + 0.4, y + 0.62);
        c.quadraticCurveTo(x + 0.4, y + 0.38, x + 0.5 - f, y + 0.22);
        c.quadraticCurveTo(x + 0.6, y + 0.38, x + 0.6, y + 0.62);
        c.fill();
        break;
      }
      case 'lamp':
        c.fillStyle = 'rgba(0,0,0,.2)';
        c.beginPath();
        c.ellipse(x + 0.5, y + 0.85, 0.2, 0.08, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4a4a52';
        c.fillRect(x + 0.45, y - 0.1, 0.1, 0.95);
        c.fillStyle = '#ffe9a0';
        c.beginPath();
        c.roundRect(x + 0.32, y - 0.42, 0.36, 0.38, 0.08);
        c.fill();
        c.strokeStyle = '#3a3a42';
        c.lineWidth = 0.05;
        c.stroke();
        break;
      case 'sky_engine': {
        this.cube(x - 0.1, y, '#4a4466', '#2e2a42', 0.4);
        c.save();
        c.translate(x + 0.4, y - 0.4);
        for (let k = 0; k < 3; k++) {
          c.strokeStyle = ['#ffb347', '#9fe4ff', '#ffe27a'][k];
          c.lineWidth = 0.05;
          c.beginPath();
          c.ellipse(0, 0, 0.7 - k * 0.12, 0.22, t * (1 + k * 0.6), 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = '#c9f2ff';
        c.beginPath();
        c.moveTo(0, -0.5 + Math.sin(t * 2) * 0.05);
        c.lineTo(0.18, -0.05);
        c.lineTo(0, 0.25);
        c.lineTo(-0.18, -0.05);
        c.fill();
        c.restore();
        break;
      }
    }
  }

  private beacon(x: number, y: number, lit: boolean, t: number) {
    const c = this.c;
    this.cube(x - 0.15, y + 0.1, '#b9b1a0', '#857d6b', 0.5);
    c.fillStyle = '#6e5a3a';
    c.fillRect(x + 0.1, y - 0.9, 0.8, 0.5);
    c.fillStyle = '#3a2e22';
    c.fillRect(x + 0.2, y - 0.95, 0.6, 0.12);
    if (lit) {
      c.fillStyle = 'rgba(255,190,80,.18)';
      c.beginPath();
      c.moveTo(x + 0.2, y - 0.9);
      c.lineTo(x + 0.8, y - 0.9);
      c.lineTo(x + 1.1, y - 6);
      c.lineTo(x - 0.1, y - 6);
      c.fill();
      const f = Math.sin(t * 10) * 0.06;
      c.fillStyle = '#ff7a1a';
      c.beginPath();
      c.moveTo(x + 0.15, y - 0.9);
      c.quadraticCurveTo(x + 0.15, y - 1.5, x + 0.5 + f, y - 1.9);
      c.quadraticCurveTo(x + 0.85, y - 1.5, x + 0.85, y - 0.9);
      c.fill();
      c.fillStyle = '#ffe27a';
      c.beginPath();
      c.moveTo(x + 0.3, y - 0.9);
      c.quadraticCurveTo(x + 0.3, y - 1.3, x + 0.5 - f, y - 1.5);
      c.quadraticCurveTo(x + 0.7, y - 1.3, x + 0.7, y - 0.9);
      c.fill();
    } else {
      c.fillStyle = 'rgba(80,70,60,.8)';
      c.fillRect(x + 0.3, y - 1.0, 0.4, 0.1);
      c.fillStyle = `rgba(255,150,60,${0.25 + Math.sin(t * 2) * 0.15})`;
      c.beginPath();
      c.arc(x + 0.5, y - 0.95, 0.08, 0, Math.PI * 2);
      c.fill();
    }
  }

  private waystone(x: number, y: number, found: boolean, t: number) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.beginPath();
    c.ellipse(x + 0.5, y + 0.86, 0.4, 0.14, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6f7480';
    c.beginPath();
    c.moveTo(x + 0.22, y + 0.88);
    c.lineTo(x + 0.3, y - 0.8);
    c.lineTo(x + 0.5, y - 1.0);
    c.lineTo(x + 0.7, y - 0.8);
    c.lineTo(x + 0.78, y + 0.88);
    c.fill();
    c.fillStyle = '#565a64';
    c.fillRect(x + 0.6, y - 0.75, 0.15, 1.6);
    const glow = found ? `rgba(110,216,255,${0.7 + Math.sin(t * 3) * 0.3})` : 'rgba(40,50,60,.8)';
    c.fillStyle = glow;
    c.beginPath();
    c.moveTo(x + 0.45, y - 0.5);
    c.lineTo(x + 0.55, y - 0.3);
    c.lineTo(x + 0.45, y - 0.1);
    c.lineTo(x + 0.35, y - 0.3);
    c.fill();
    c.fillRect(x + 0.42, y + 0.05, 0.06, 0.4);
  }

  private treasure(x: number, y: number, t: number) {
    const c = this.c;
    this.cube(x + 0.08, y + 0.12, '#8a5a2e', '#6a4220', 0.42);
    c.strokeStyle = '#e8c35a';
    c.lineWidth = 0.06;
    c.strokeRect(x + 0.1, y - 0.28, 0.82, 0.86);
    c.fillStyle = '#e8c35a';
    c.fillRect(x + 0.42, y + 0.52, 0.18, 0.18);
    if (Math.sin(t * 3 + x) > 0.7) {
      c.fillStyle = '#fff6c8';
      c.fillRect(x + 0.75, y - 0.35, 0.08, 0.08);
    }
  }

  private creature(cr: Creature, t: number) {
    const c = this.c;
    const { x, y } = cr;
    c.save();
    if (cr.fade) c.globalAlpha = Math.max(0, 1 - cr.fade / 1.5);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath();
    c.ellipse(x, y + 0.25, 0.34, 0.12, 0, 0, Math.PI * 2);
    c.fill();
    const hurt = cr.hurt > 0;
    if (cr.kind === 'bramble') {
      const bob = Math.abs(Math.sin(t * 8 + x)) * 0.06;
      c.fillStyle = hurt ? '#fff' : '#6a4a2e';
      c.beginPath();
      c.ellipse(x, y - 0.1 - bob, 0.38, 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = hurt ? '#fff' : '#4d7a2e';
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + (k / 5) * Math.PI;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 0.28, y - 0.1 - bob + Math.sin(a) * 0.22);
        c.lineTo(x + Math.cos(a) * 0.5, y - 0.1 - bob + Math.sin(a) * 0.42);
        c.lineTo(x + Math.cos(a + 0.3) * 0.28, y - 0.1 - bob + Math.sin(a + 0.3) * 0.22);
        c.fill();
      }
      c.fillStyle = '#ffde5a';
      c.fillRect(x - 0.16, y - 0.16 - bob, 0.09, 0.09);
      c.fillRect(x + 0.07, y - 0.16 - bob, 0.09, 0.09);
      if ((cr.charge ?? 0) > 0) {
        c.fillStyle = '#ff5a3a';
        c.fillRect(x - 0.03, y - 0.65, 0.06, 0.16);
      }
    } else if (cr.kind === 'gloom') {
      const fl = Math.sin(t * 5 + x * 3) * 0.08;
      c.fillStyle = hurt ? 'rgba(255,255,255,.9)' : 'rgba(60,30,120,.85)';
      c.beginPath();
      c.moveTo(x - 0.32, y + 0.15);
      c.quadraticCurveTo(x - 0.4, y - 0.7 + fl, x, y - 0.72 + fl);
      c.quadraticCurveTo(x + 0.4, y - 0.7 + fl, x + 0.32, y + 0.15);
      for (let k = 0; k < 4; k++) c.lineTo(x + 0.32 - (k + 0.5) * 0.16, y + (k % 2 ? 0.15 : 0.02));
      c.fill();
      c.fillStyle = '#d6c4ff';
      c.beginPath();
      c.arc(x - 0.11, y - 0.35 + fl, 0.06, 0, Math.PI * 2);
      c.arc(x + 0.11, y - 0.35 + fl, 0.06, 0, Math.PI * 2);
      c.fill();
    } else {
      const step = Math.sin(t * 6 + x) * 0.04;
      c.fillStyle = hurt ? '#fff' : '#8a5a34';
      c.fillRect(x - 0.3, y - 0.2, 0.6, 0.45);
      c.fillStyle = hurt ? '#fff' : '#a86a3a';
      c.fillRect(x - 0.24, y - 0.62 + step, 0.48, 0.42);
      c.fillStyle = '#3a2a1e';
      c.fillRect(x - 0.28, y + 0.22, 0.18, 0.08);
      c.fillRect(x + 0.1, y + 0.22, 0.18, 0.08);
      c.fillStyle = `rgba(255,${180 + Math.sin(t * 6) * 40},60,1)`;
      c.fillRect(x - 0.12, y - 0.48 + step, 0.24, 0.08);
      c.fillStyle = '#5a3a22';
      c.fillRect(x - 0.42, y - 0.15, 0.12, 0.3);
      c.fillRect(x + 0.3, y - 0.15, 0.12, 0.3);
    }
    if (cr.hp < cr.max) {
      c.fillStyle = 'rgba(0,0,0,.6)';
      c.fillRect(x - 0.35, y - 0.95, 0.7, 0.09);
      c.fillStyle = cr.kind === 'gloom' ? '#b9a4ff' : '#ff6a5a';
      c.fillRect(x - 0.34, y - 0.94, 0.68 * Math.max(0, cr.hp / cr.max), 0.07);
    }
    c.restore();
  }

  private player(g: Game, t: number) {
    if (g.dead) return;
    const c = this.c;
    const x = g.px, y = g.py;
    const blink = g.invuln > 0 && Math.floor(t * 16) % 2 === 0;
    if (blink) return;
    const walk = g.moving ? Math.sin(t * 14) : 0;
    const fx = Math.cos(g.face), fy = Math.sin(g.face);
    c.save();
    if (g.swimming) {
      c.fillStyle = 'rgba(255,255,255,.4)';
      c.beginPath();
      c.ellipse(x, y + 0.05, 0.42 + Math.sin(t * 4) * 0.04, 0.16, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.rect(x - 1, y - 2, 2, 2.05);
      c.clip();
    } else {
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath();
      c.ellipse(x, y + 0.25, 0.3, 0.1, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (g.gliding) {
      c.fillStyle = '#e85a4a';
      c.beginPath();
      c.moveTo(x - 0.7, y - 1.1);
      c.quadraticCurveTo(x, y - 1.5, x + 0.7, y - 1.1);
      c.lineTo(x, y - 0.9);
      c.fill();
      c.strokeStyle = '#eee';
      c.lineWidth = 0.02;
      c.beginPath();
      c.moveTo(x - 0.6, y - 1.1);
      c.lineTo(x, y - 0.5);
      c.lineTo(x + 0.6, y - 1.1);
      c.stroke();
    }
    // cape behind when facing down/sideways
    c.fillStyle = '#c4462f';
    if (fy > -0.3) {
      c.beginPath();
      c.moveTo(x - 0.2, y - 0.5);
      c.lineTo(x + 0.2, y - 0.5);
      c.lineTo(x + 0.26 - fx * 0.15, y + 0.08);
      c.lineTo(x - 0.26 - fx * 0.15, y + 0.08);
      c.fill();
    }
    // legs
    c.fillStyle = '#3e3a5a';
    c.fillRect(x - 0.15, y - 0.05, 0.12, 0.26 + walk * 0.05);
    c.fillRect(x + 0.03, y - 0.05, 0.12, 0.26 - walk * 0.05);
    // body (friends wear their own color)
    c.fillStyle = g.active.slot ? PLAYER_COLORS[g.active.slot] : '#2f8a74';
    c.beginPath();
    c.roundRect(x - 0.22, y - 0.5, 0.44, 0.5, 0.1);
    c.fill();
    c.fillStyle = '#7a5130';
    c.fillRect(x - 0.22, y - 0.12, 0.44, 0.07);
    if (fy <= -0.3) {
      c.fillStyle = '#c4462f';
      c.beginPath();
      c.moveTo(x - 0.22, y - 0.5);
      c.lineTo(x + 0.22, y - 0.5);
      c.lineTo(x + 0.26, y + 0.1);
      c.lineTo(x - 0.26, y + 0.1);
      c.fill();
    }
    // head
    c.fillStyle = '#f0c7a0';
    c.beginPath();
    c.arc(x, y - 0.7, 0.22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e0b04a';
    c.beginPath();
    if (fy <= -0.3) c.arc(x, y - 0.72, 0.23, 0, Math.PI * 2);
    else {
      c.arc(x, y - 0.78, 0.23, Math.PI, 0);
      c.lineTo(x + 0.23, y - 0.7);
      c.lineTo(x - 0.23, y - 0.7);
    }
    c.fill();
    if (fy > -0.3) {
      c.fillStyle = '#2a2a2a';
      c.fillRect(x - 0.1 + fx * 0.07, y - 0.7, 0.05, 0.06);
      c.fillRect(x + 0.05 + fx * 0.07, y - 0.7, 0.05, 0.06);
    }
    c.restore();
    // swing
    if (g.swing > 0) {
      const p = 1 - g.swing / 0.22;
      const a0 = g.swingDir - 1.1, a = a0 + p * 2.2;
      c.strokeStyle = `rgba(255,255,255,${0.6 * (1 - p)})`;
      c.lineWidth = 0.18;
      c.beginPath();
      c.arc(x, y - 0.35, 1.2, a0, a);
      c.stroke();
      c.save();
      c.translate(x + Math.cos(a) * 0.7, y - 0.35 + Math.sin(a) * 0.7);
      c.rotate(a + Math.PI / 2 + Math.PI / 4);
      c.scale(0.9, 0.9);
      const sw = g.has('sword_crystal') ? 'sword_crystal' : g.has('sword_iron') ? 'sword_iron' : g.has('sword_stone') ? 'sword_stone' : null;
      if (sw) drawItem(c, sw);
      c.restore();
    }
  }
}
