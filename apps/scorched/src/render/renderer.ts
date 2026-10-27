import type { Battle, Tank } from '../core/battle';
import { BARREL_LEN, MAX_HEALTH, SHIELD_STRENGTH, TANK_H, TANK_HALF_W, WORLD_H, WORLD_W } from '../core/constants';
import type { Player } from '../core/player';
import type { Rng } from '../core/rng';
import { drawPlaneSprite, drawTankSprite } from './tanks';

interface SkyTheme {
  bands: string[];
  dirt: [number, number, number][];
  crust: [number, number, number];
  stars: boolean;
}

const THEMES: SkyTheme[] = [
  {
    // Dusk
    bands: ['#140c2e', '#241444', '#3a1c5a', '#5a2468', '#82306c', '#a8406a', '#cc5a60', '#e8805a'],
    dirt: [[122, 88, 44], [104, 72, 36], [86, 58, 30], [68, 46, 26]],
    crust: [150, 116, 60],
    stars: true,
  },
  {
    // Night
    bands: ['#02030c', '#040818', '#081026', '#0c1834', '#122244', '#182c54', '#203864', '#284474'],
    dirt: [[70, 86, 110], [58, 72, 94], [46, 58, 78], [36, 46, 64]],
    crust: [110, 130, 160],
    stars: true,
  },
  {
    // Desert noon
    bands: ['#1c4ca8', '#2458b4', '#2c64c0', '#3a72ca', '#4a80d2', '#5c90da', '#72a0e2', '#8ab2ea'],
    dirt: [[204, 150, 84], [184, 130, 70], [160, 110, 58], [134, 90, 48]],
    crust: [232, 190, 120],
    stars: false,
  },
  {
    // Toxic
    bands: ['#061208', '#0a1c0e', '#0e2614', '#12321a', '#183e20', '#1e4a26', '#26582c', '#306632'],
    dirt: [[92, 70, 104], [78, 58, 90], [64, 46, 76], [52, 36, 62]],
    crust: [150, 210, 90],
    stars: true,
  },
];

interface Puff {
  x: number;
  y: number;
  age: number;
  drift: number;
}

/** Seconds a puff of rocket smoke lasts. */
const SMOKE_LIFE = 1.4;

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

/**
 * Calls `draw` at x, and again one map width over when something within `margin` of a side
 * would also show on the other side of the wrapped map.
 */
function wrapped(x: number, margin: number, draw: (x: number) => void): void {
  draw(x);
  if (x < margin) draw(x + WORLD_W);
  if (x > WORLD_W - margin) draw(x - WORLD_W);
}

const FIRE_COLORS = ['#ffffff', '#fff3a0', '#ffd040', '#ff9a20', '#ff5a10', '#c02808', '#601004'];
const DIRT_COLORS = ['#d8b070', '#b08850', '#8a6838', '#6a4c28'];

/** Draws a battle onto a low-resolution canvas that CSS scales up with crisp pixels. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sky: HTMLCanvasElement;
  private readonly ground: ImageData;
  private readonly groundCanvas: HTMLCanvasElement;
  private theme: SkyTheme = THEMES[0];
  private groundVersion = -1;
  private battle: Battle | null = null;
  private texts: FloatText[] = [];
  /** Exhaust left behind by rocketing Torpedo tanks. */
  private smoke: Puff[] = [];
  private shake = 0;
  private time = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = WORLD_W;
    canvas.height = WORLD_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.sky = document.createElement('canvas');
    this.sky.width = WORLD_W;
    this.sky.height = WORLD_H;
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = WORLD_W;
    this.groundCanvas.height = WORLD_H;
    this.ground = this.groundCanvas.getContext('2d')!.createImageData(WORLD_W, WORLD_H);
  }

  /** Picks a look for a new round and resets effects. */
  setBattle(battle: Battle, rng: Rng): void {
    this.battle = battle;
    this.theme = rng.pick(THEMES);
    this.groundVersion = -1;
    this.texts = [];
    this.smoke = [];
    this.shake = 0;
    this.paintSky(rng);
  }

  addText(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, text, color, age: 0 });
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  draw(dt: number, players: Player[]): void {
    const battle = this.battle;
    const ctx = this.ctx;
    this.time += dt;
    if (!battle) return;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
      this.shake *= 0.88;
    } else {
      this.shake = 0;
    }
    ctx.drawImage(this.sky, 0, 0);
    if (this.groundVersion !== battle.terrain.version) this.paintGround();
    ctx.drawImage(this.groundCanvas, 0, 0);

    this.drawSmoke(battle, dt);
    for (const t of battle.tanks) if (t.alive) this.drawTank(t, players[t.player]);
    this.drawPlanes(battle);
    this.drawProjectiles(battle);
    this.drawFires(battle);
    this.drawExplosions(battle);
    this.drawTexts(dt);
    ctx.restore();
  }

  private paintSky(rng: Rng): void {
    const ctx = this.sky.getContext('2d')!;
    const bands = this.theme.bands;
    const bandH = Math.ceil(WORLD_H / bands.length);
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * bandH, WORLD_W, bandH);
      // Dithered seam between bands for that VGA look.
      if (i > 0) {
        ctx.fillStyle = bands[i - 1];
        for (let x = 0; x < WORLD_W; x += 2) {
          ctx.fillRect(x + ((i & 1) as number), i * bandH, 1, 1);
          ctx.fillRect(x, i * bandH + 2, 1, 1);
        }
      }
    });
    if (this.theme.stars) {
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = rng.chance(0.2) ? '#ffffff' : '#9aa0c8';
        ctx.fillRect(rng.int(0, WORLD_W - 1), rng.int(0, WORLD_H * 0.5), 1, 1);
      }
    }
  }

  private paintGround(): void {
    const battle = this.battle!;
    const { mask, width: w, height: h } = battle.terrain;
    const data = this.ground.data;
    const { dirt, crust } = this.theme;
    for (let x = 0; x < w; x++) {
      let depth = -1;
      for (let y = 0; y < h; y++) {
        const i = y * w + x;
        const o = i * 4;
        if (!mask[i]) {
          depth = -1;
          data[o + 3] = 0;
          continue;
        }
        depth++;
        let c: [number, number, number];
        if (depth < 2) c = crust;
        else {
          const band = Math.min(dirt.length - 1, Math.floor((y / h) * 1.6 * dirt.length) - 1);
          const b = Math.max(0, band);
          // Checkerboard dither between neighbouring bands.
          const alt = ((x + y) & 1) === 0 && b + 1 < dirt.length && (y / h) * 1.6 * dirt.length - 1 - b > 0.6;
          c = dirt[alt ? b + 1 : b];
        }
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }
    this.groundCanvas.getContext('2d')!.putImageData(this.ground, 0, 0);
    this.groundVersion = battle.terrain.version;
  }

  private drawTank(t: Tank, player: Player): void {
    wrapped(t.x, 24, (x) => this.drawTankAt(t, player, Math.round(x), Math.round(t.y)));
    if (t.y < 0) {
      // Launched above the top of the screen: point at where it will come back down.
      const ctx = this.ctx;
      const x = Math.round(t.x);
      ctx.fillStyle = player.color;
      ctx.fillRect(x - 2, 1, 5, 1);
      ctx.fillRect(x - 1, 2, 3, 1);
      ctx.fillRect(x, 3, 1, 1);
    }
  }

  private drawTankAt(t: Tank, player: Player, x: number, y: number): void {
    const ctx = this.ctx;
    if (t.flight === 'launch') {
      // Rocket flames out of the bottom of the tank.
      for (let dx = -TANK_HALF_W + 2; dx <= TANK_HALF_W - 2; dx++) {
        const len = 3 + Math.floor(Math.random() * (Math.abs(dx) < 3 ? 7 : 4));
        for (let k = 0; k < len; k++) {
          ctx.fillStyle = FIRE_COLORS[Math.min(FIRE_COLORS.length - 1, 1 + Math.floor((k / len) * 5))];
          ctx.fillRect(x + dx, y + k, 1, 1);
        }
      }
    }
    if (t.spin) {
      // Turn the whole tank about the middle of its hull.
      const cy = y - TANK_H / 2;
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(t.spin);
      ctx.translate(-x, -cy);
      drawTankSprite(ctx, x, y, t.angle, player.color, player.design, this.time);
      ctx.restore();
    } else {
      drawTankSprite(ctx, x, y, t.angle, player.color, player.design, this.time);
    }

    if (t.shield > 0) {
      ctx.strokeStyle = `rgba(120, 220, 255, ${0.35 + (t.shield / 60) * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + 0.5, y - 3.5, 12, Math.PI, 0);
      ctx.stroke();
    }
    if (t.parachute) {
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(x - 7, y - 20, 15, 2);
      ctx.fillRect(x - 5, y - 21, 11, 1);
      ctx.fillStyle = '#bbbbbb';
      for (const dx of [-6, 0, 6]) {
        for (let k = 0; k < 10; k++) ctx.fillRect(Math.round(x + dx * (1 - k / 10)), y - 18 + k, 1, 1);
      }
    }
  }

  /**
   * Draws each tank's name, health and reload above it on a full-resolution overlay canvas,
   * so the text stays sharp however much the battlefield is scaled up.
   */
  drawLabels(overlay: HTMLCanvasElement, players: Player[]): void {
    const battle = this.battle;
    const ctx = overlay.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const cssW = overlay.clientWidth;
    const cssH = overlay.clientHeight;
    if (overlay.width !== Math.round(cssW * dpr) || overlay.height !== Math.round(cssH * dpr)) {
      overlay.width = Math.round(cssW * dpr);
      overlay.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!battle || !cssW) return;
    ctx.scale(dpr, dpr);

    const scale = cssW / WORLD_W;
    const font = Math.max(9, Math.round(scale * 5));
    const barW = Math.max(36, Math.round(scale * 24));
    const barH = Math.max(3, Math.round(scale * 1.6));
    const gap = Math.max(2, Math.round(scale));
    ctx.font = `${font}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    interface Label { tank: Tank; x: number; y: number; w: number; h: number }
    const labels: Label[] = [];
    for (const t of battle.tanks) {
      if (!t.alive) continue;
      const name = players[t.player].name;
      const w = Math.max(barW, ctx.measureText(name).width) + 4;
      const h = font + gap + barH * 2 + gap * 2;
      labels.push({ tank: t, x: t.x * scale, y: (t.y - TANK_H - BARREL_LEN - 4) * scale - h, w, h });
    }
    // Nudge labels upward until none overlap.
    labels.sort((a, b) => a.x - b.x);
    const placed: Label[] = [];
    for (const l of labels) {
      for (let tries = 0; tries < 8; tries++) {
        const hit = placed.find((p) => Math.abs(p.x - l.x) < (p.w + l.w) / 2 && Math.abs(p.y - l.y) < (p.h + l.h) / 2);
        if (!hit) break;
        l.y = hit.y - l.h - gap;
      }
      l.y = Math.max(2, l.y);
      placed.push(l);
    }

    for (const l of placed) {
      const t = l.tank;
      const p = players[t.player];
      const cx = Math.round(l.x);
      let y = Math.round(l.y) + font;
      ctx.fillStyle = '#000000';
      ctx.fillText(p.name, cx + 1, y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.name, cx, y);
      y += gap;
      const left = Math.round(cx - barW / 2);
      // Health, with any shield as a cyan segment on top of it.
      ctx.fillStyle = '#000000';
      ctx.fillRect(left - 1, y - 1, barW + 2, barH + 2);
      const hw = Math.round((barW * t.health) / MAX_HEALTH);
      ctx.fillStyle = t.health > 50 ? '#52d46a' : t.health > 25 ? '#f2c230' : '#e8483a';
      ctx.fillRect(left, y, Math.max(t.health > 0 ? 1 : 0, hw), barH);
      if (t.shield > 0) {
        ctx.fillStyle = '#78dcff';
        ctx.fillRect(left, y, Math.max(1, Math.round((barW * t.shield) / SHIELD_STRENGTH)), Math.max(1, Math.round(barH / 2)));
      }
      y += barH + gap;
      // Reload, only while it is refilling.
      if (t.reload > 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(left - 1, y - 1, barW + 2, barH + 1);
        ctx.fillStyle = '#ff8a2a';
        ctx.fillRect(left, y, Math.round(barW * (1 - t.reload / t.reloadTotal)), barH - 1);
      }
    }
  }

  /** Puffs smoke out behind rocketing tanks and draws it thinning out. */
  private drawSmoke(battle: Battle, dt: number): void {
    const ctx = this.ctx;
    for (const t of battle.tanks) {
      if (!t.alive || t.flight !== 'launch') continue;
      for (let i = 0; i < 3; i++) {
        this.smoke.push({ x: t.x + (Math.random() - 0.5) * 8, y: t.y + 6 + Math.random() * 4, age: 0, drift: Math.random() - 0.5 });
      }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i];
      p.age += dt;
      if (p.age >= SMOKE_LIFE) {
        this.smoke.splice(i, 1);
        continue;
      }
      const k = p.age / SMOKE_LIFE;
      p.x += p.drift * 6 * dt;
      p.y -= 4 * dt;
      const size = 1 + Math.floor(k * 4);
      const shade = Math.round(150 - k * 50);
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.75 * (1 - k)})`;
      wrapped(p.x, size, (x) => ctx.fillRect(Math.round(x - size / 2), Math.round(p.y - size / 2), size, size));
    }
  }

  private drawProjectiles(battle: Battle): void {
    const ctx = this.ctx;
    for (const p of battle.projectiles) {
      const tr = p.trail;
      for (let i = 0; i < tr.length; i += 2) {
        ctx.fillStyle = `rgba(255, 220, 160, ${(i / tr.length) * 0.6})`;
        ctx.fillRect(Math.round(tr[i]), Math.round(tr[i + 1]), 1, 1);
      }
      ctx.fillStyle = p.digging ? '#d8b070' : '#ffffff';
      wrapped(p.x, 2, (x) => ctx.fillRect(Math.round(x) - 1, Math.round(p.y) - 1, 2, 2));
    }
  }

  private drawPlanes(battle: Battle): void {
    const ctx = this.ctx;
    for (const p of battle.planes) {
      const tr = p.trail;
      for (let i = 0; i < tr.length; i += 2) {
        const k = i / tr.length;
        ctx.fillStyle = `rgba(90, 90, 90, ${k * 0.7})`;
        const s = k > 0.6 ? 2 : 1;
        ctx.fillRect(Math.round(tr[i] + Math.sin(i + this.time * 3)), Math.round(tr[i + 1] - (1 - k) * 4), s, s);
      }
      const tilt = p.flying ? 0 : Math.atan2(p.vy, Math.abs(p.vx));
      if (p.flying) drawPlaneSprite(ctx, Math.round(p.x), Math.round(p.y), p.dir, tilt, this.time, false);
      else wrapped(p.x, 12, (x) => drawPlaneSprite(ctx, Math.round(x), Math.round(p.y), p.dir, tilt, this.time, true));
    }
  }

  private drawFires(battle: Battle): void {
    const ctx = this.ctx;
    for (const f of battle.fires) {
      const flick = Math.random();
      ctx.fillStyle = flick < 0.3 ? '#fff3a0' : flick < 0.7 ? '#ff9a20' : '#ff5a10';
      const hgt = 1 + Math.floor(Math.random() * 3);
      ctx.fillRect(f.x, f.y - hgt + 1, 1, hgt);
    }
  }

  private drawExplosions(battle: Battle): void {
    const ctx = this.ctx;
    for (const e of battle.explosions) {
      const k = e.age / e.duration;
      const grow = Math.min(1, k * 3);
      const r = Math.max(1, e.radius * grow);
      const palette = e.dirt ? DIRT_COLORS : FIRE_COLORS;
      const rings = palette.length;
      for (let i = rings - 1; i >= 0; i--) {
        const idx = Math.min(palette.length - 1, i + Math.floor(k * 4));
        ctx.fillStyle = palette[idx];
        ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        wrapped(e.x, r, (x) => {
          ctx.beginPath();
          ctx.arc(Math.round(x), Math.round(e.y), (r * (i + 1)) / rings, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawTexts(dt: number): void {
    const ctx = this.ctx;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age += dt;
      if (t.age > 1.4) {
        this.texts.splice(i, 1);
        continue;
      }
      const y = Math.round(t.y - t.age * 18);
      ctx.fillStyle = '#000000';
      ctx.fillText(t.text, Math.round(t.x) + 1, y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.round(t.x), y);
    }
  }
}
