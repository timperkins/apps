import * as K from '../game/constants';
import { symbolFor } from '../game/looks';
import { fishLen, rodTip, type Boat, type Fish, type World, type WorldEvent } from '../game/world';
import { paintBackground } from './background';
import { Grid, css, makeCanvas, mix, seeded, type Color } from './pix';
import {
  BOAT_CX,
  BOAT_WL,
  CREWS,
  PETE_WL,
  PIRATE_HEAD,
  SPECIES,
  boatGrid,
  clownLook,
  coinGrid,
  eggGrid,
  fishGrid,
  meatGrid,
  peteGrid,
  playerLook,
} from './sprites';
import { textSprite, textWidth } from './text';

// Draws the whole TV scene into a 640x360 canvas; CSS scales it up with crisp pixels.

interface Sprite {
  c: HTMLCanvasElement;
  // Where the sprite's anchor (body center, or waterline center for boats) sits inside it.
  ax: number;
  ay: number;
}

interface Popup {
  sprite: HTMLCanvasElement;
  icon?: HTMLCanvasElement;
  x: number;
  y: number;
  at: number;
}

interface Splash {
  x: number;
  y: number;
  at: number;
  color: Color;
  big: boolean;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
}

export interface HudInfo {
  crew: number;
  school: number;
  timeLeft: number | null;
  code: string;
}

const SYM: Record<string, string[]> = {
  star: ['..#..', '.###.', '#####', '.#.#.', '#...#'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
  dot: ['.###.', '#####', '#####', '#####', '.###.'],
  triangle: ['..#..', '..#..', '.###.', '.###.', '#####'],
  square: ['#####', '#####', '#####', '#####', '#####'],
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  plus: ['..#..', '..#..', '#####', '..#..', '..#..'],
  ring: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  moon: ['.###.', '##...', '##...', '##...', '.###.'],
  bolt: ['...##', '..##.', '.####', '.##..', '##...'],
  flower: ['.#.#.', '#####', '.###.', '#####', '.#.#.'],
};

const hashId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export class Scene {
  private bg = paintBackground();
  private sprites = new Map<string, Sprite>();
  private popups: Popup[] = [];
  private splashes: Splash[] = [];
  private bubbles: Bubble[] = [];
  private plankton: { x: number; y: number; a: number; s: number }[] = [];
  private sunkAt = new Map<string, number>();

  constructor() {
    const r = seeded(44);
    for (let i = 0; i < 160; i++) this.plankton.push({ x: r() * K.SCENE_W, y: K.SURF + 8 + r() * 220, a: 0.25 + r() * 0.45, s: 2 + r() * 4 });
  }

  // Turns simulation events into effects.
  event(e: WorldEvent, world: World): void {
    const t = world.time;
    switch (e.type) {
      case 'cast':
        this.splashes.push({ x: e.x, y: K.SURF, at: t, color: '#ffffff', big: false });
        break;
      case 'catch': {
        const b = world.boat(e.boat);
        const icon = e.reward.kind === 'meat' ? this.meat() : this.coinIcon();
        const label = e.reward.kind === 'meat' ? `+${e.reward.amount} meat` : `+${e.reward.amount}`;
        this.popups.push({ sprite: textSprite(label, e.reward.kind === 'meat' ? '#ffb4a0' : '#ffe27a', '#1a1030'), icon, x: b ? b.x : e.x, y: K.SURF - 58, at: t });
        this.splashes.push({ x: e.x, y: K.SURF, at: t, color: '#ffffff', big: true });
        break;
      }
      case 'eat':
        this.splashes.push({ x: e.x, y: e.y, at: t, color: e.color || '#ffffff', big: e.player });
        break;
      case 'ram':
        this.splashes.push({ x: e.x, y: K.SURF + 2, at: t, color: '#ffffff', big: false });
        break;
      case 'sink':
        this.sunkAt.set(e.boat, t);
        this.splashes.push({ x: e.x, y: K.SURF, at: t, color: '#ffffff', big: true });
        break;
      case 'levelUp': {
        const f = world.get(e.id);
        if (f?.player) this.popups.push({ sprite: textSprite('Level up!', '#ffffff', '#1a1030'), x: f.x, y: f.y - fishLen(f) * 0.5 - 18, at: t });
        break;
      }
      case 'sell': {
        const b = world.boat(e.boat);
        if (b) this.popups.push({ sprite: textSprite(`+${K.MEAT_PRICE}`, '#ffe27a', '#1a1030'), icon: this.coinIcon(), x: b.x, y: K.SURF - 58, at: t });
        break;
      }
      case 'hatch':
        this.splashes.push({ x: e.x, y: e.y, at: t, color: '#fff0c8', big: false });
        break;
      default:
    }
  }

  draw(ctx: CanvasRenderingContext2D, world: World, hud: HudInfo): void {
    const t = world.time;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0);
    this.drawPlankton(ctx, t);
    for (const c of world.coins) {
      const s = this.sprite(`coin|${Math.floor(t * 6 + c.phase) % 4}`, () => ({ c: coinGrid(Math.floor(t * 6 + c.phase) % 4).toCanvas(), ax: 4, ay: 4 }));
      this.put(ctx, s, c.x, c.y);
    }
    for (const e of world.eggs) {
      const s = this.sprite(`egg|${e.color}`, () => ({ c: eggGrid(e.color).toCanvas(), ax: 4, ay: 4 }));
      const wob = e.hatchAt - t < 2 ? Math.round(Math.sin(t * 30)) : 0;
      this.put(ctx, s, e.x + wob, e.y);
    }
    // Small fish behind big ones.
    const fish = world.fish.filter((f) => f.alive).sort((a, b) => fishLen(a) - fishLen(b) || Number(a.player) - Number(b.player));
    for (const f of fish) this.drawFish(ctx, f, t);
    this.drawPete(ctx, world, t);
    for (const b of world.boats) this.drawBoat(ctx, b, t);
    for (const b of world.boats) this.drawLine(ctx, b, world);
    this.drawSplashes(ctx, t);
    this.drawBubbles(ctx, world, t);
    // Labels go on top of everything in the water.
    for (const f of fish) if (f.player) this.drawFishLabels(ctx, f, t);
    for (const b of world.boats) this.drawBoatLabels(ctx, b, world, t);
    this.drawPopups(ctx, t);
    this.drawHud(ctx, hud);
  }

  // ---------- fish ----------

  private fishSprite(f: Fish, frame: number): Sprite {
    const len = Math.round(fishLen(f));
    const kind = f.player ? f.kind : f.baby ? (f.kind === 'clown' ? 'clown' : 'baby') : `npc${f.species}`;
    const key = `fish|${kind}|${len}|${f.player || f.baby ? f.color : ''}|${frame}|${f.dir}`;
    return this.sprite(key, () => {
      let look;
      if (kind === 'clown') look = clownLook();
      else if (f.player || f.baby) look = playerLook(f.color);
      else look = SPECIES[f.species % SPECIES.length];
      const tall = 'tall' in look && look.tall;
      let g: Grid = fishGrid({ ...look, len, hgt: len * (tall ? 0.72 : 0.55) }, frame, seeded(hashId(f.id) % 1000));
      const tw = Math.max(3, Math.round(len * 0.3));
      let ax = tw + 1 + len * 0.5;
      let ay = Math.floor(g.h / 2) + 1;
      if (f.player || f.baby) {
        g = g.glow(f.player ? f.color : mix(f.color, '#ffffff', 0.3));
        ax += 2;
        ay += 2;
      }
      const flip = f.dir < 0;
      return { c: g.toCanvas(flip), ax: flip ? g.w - 1 - ax : ax, ay };
    });
  }

  private drawFish(ctx: CanvasRenderingContext2D, f: Fish, t: number): void {
    const h = hashId(f.id);
    const frame = Math.floor(t * (f.hookedBy ? 10 : 4) + (h % 7)) % 2;
    const s = this.fishSprite(f, frame);
    const bob = f.hookedBy ? Math.round(Math.sin(t * 40)) : Math.round(Math.sin(t * 2.4 + h) * 0.8);
    const blink = t < f.safeUntil && Math.floor(t * 8) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : f.player || f.baby ? 1 : 0.92;
    this.put(ctx, s, f.x, f.y + bob);
    ctx.globalAlpha = 1;
  }

  private drawFishLabels(ctx: CanvasRenderingContext2D, f: Fish, t: number): void {
    const half = fishLen(f) * 0.36 + 4;
    const tag = this.tag(f.name, f.color);
    const tx = Math.round(f.x - tag.width / 2);
    const ty = Math.round(f.y - half - tag.height - 2);
    ctx.drawImage(tag, tx, ty);
    if (t < f.tauntUntil) this.bubble(ctx, K.TAUNT_LINE, f.x, ty - 2, '#fffdf4');
    if (t < f.findUntil) this.findRing(ctx, f.x, f.y, f.color, t, fishLen(f) * 0.6 + 6, ty);
  }

  // ---------- boats ----------

  private boatSprite(b: Boat, index: number): Sprite {
    const key = `boat|${b.color}|${index}|${b.dir}`;
    return this.sprite(key, () => {
      const g = boatGrid(b.color, CREWS[index % CREWS.length]);
      const flip = b.dir < 0;
      return { c: g.toCanvas(flip), ax: flip ? g.w - 1 - BOAT_CX : BOAT_CX, ay: BOAT_WL };
    });
  }

  private drawBoat(ctx: CanvasRenderingContext2D, b: Boat, t: number): void {
    const index = hashId(b.id) % CREWS.length;
    const s = this.boatSprite(b, index);
    const bob = Math.round(Math.sin(t * 1.8 + index) * 0.8);
    if (b.sunk) {
      const since = t - (this.sunkAt.get(b.id) ?? b.respawnAt - K.BOAT_RESPAWN_S);
      const left = b.respawnAt - t;
      if (since < 2.2) {
        ctx.globalAlpha = Math.max(0, 1 - since / 2.2);
        this.put(ctx, s, b.x, K.SURF + since * 18);
      } else if (left < 1.2) {
        ctx.globalAlpha = 1 - left / 1.2;
        this.put(ctx, s, b.x, K.SURF + left * 14);
      }
      ctx.globalAlpha = 1;
      return;
    }
    this.put(ctx, s, b.x, K.SURF + bob);
    // Wake while moving.
    if (Math.abs(b.vx) > 20) {
      const back = b.x - Math.sign(b.vx) * 44;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 26; i++) {
        const x = Math.round(back - Math.sign(b.vx) * i * 1.4);
        ctx.globalAlpha = (1 - i / 26) * Math.min(1, Math.abs(b.vx) / 60);
        ctx.fillRect(x, K.SURF + 1 + (i % 3 ? 1 : 0), 2, 1);
        if (i % 2 === 0) ctx.fillRect(x, K.SURF + 3 + Math.round(i * 0.1), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawBoatLabels(ctx: CanvasRenderingContext2D, b: Boat, world: World, t: number): void {
    if (b.sunk) {
      const left = Math.ceil(b.respawnAt - t);
      const sp = textSprite(`Fixing ${left}`, '#ffffff', '#1a1030');
      ctx.drawImage(sp, Math.round(b.x - sp.width / 2), K.SURF - 20);
      return;
    }
    const headX = b.x + (b.dir > 0 ? PIRATE_HEAD[0] - BOAT_CX : BOAT_CX - PIRATE_HEAD[0]);
    const tag = this.tag(b.name, b.color);
    ctx.drawImage(tag, Math.round(headX - tag.width / 2), K.SURF - BOAT_WL + PIRATE_HEAD[1] - tag.height - 6);
    // Health bar under the boat.
    const w = 34;
    const x = Math.round(b.x - w / 2);
    const y = K.SURF + 12;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#0b1836';
    ctx.fillRect(x, y, w, 5);
    ctx.globalAlpha = 1;
    const frac = Math.max(0, b.health / K.BOAT_HEALTH);
    ctx.fillStyle = frac > 0.5 ? '#5be36a' : frac > 0.25 ? '#ffb03a' : '#ff4f4f';
    ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * frac), 3);
    if (t < b.findUntil) this.findRing(ctx, b.x, K.SURF - 20, b.color, t, 50, K.SURF - 70);
    if (b.hook.state === 'fight') {
      const f = b.hook.fishId ? world.get(b.hook.fishId) : undefined;
      if (f) this.tugBar(ctx, f.x, f.y - fishLen(f) * 0.36 - 28, b.hook.knot / K.KNOT_LANDED);
    }
  }

  private drawLine(ctx: CanvasRenderingContext2D, b: Boat, world: World): void {
    if (b.sunk || b.hook.state === 'ready') return;
    const tip = rodTip(b);
    const h = b.hook;
    const color = css(mix(b.color, '#ffffff', 0.45));
    this.pixLine(ctx, tip.x, tip.y, h.x, h.y, color, 0.9);
    // Bobber where the line meets the water.
    if (h.state === 'down') {
      const k = (K.SURF - tip.y) / Math.max(1, h.y - tip.y);
      const bx = Math.round(tip.x + (h.x - tip.x) * Math.min(1, k));
      ctx.fillStyle = b.color;
      ctx.fillRect(bx - 1, K.SURF - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - 1, K.SURF - 1, 3, 1);
      ctx.fillStyle = '#c8d0da';
      ctx.fillRect(Math.round(h.x), Math.round(h.y) - 2, 1, 4);
      ctx.fillRect(Math.round(h.x) - 1, Math.round(h.y) + 1, 1, 1);
      ctx.fillStyle = '#b5523a';
      ctx.fillRect(Math.round(h.x) - 1, Math.round(h.y) + 2, 3, 3);
    }
    void world;
  }

  // ---------- Pete ----------

  private drawPete(ctx: CanvasRenderingContext2D, world: World, t: number): void {
    if (!world.peteHere) return;
    const since = t - world.peteSince;
    const enter = Math.max(0, 1 - since / 1.2);
    const leave = Math.max(0, 1 - (K.PETE_STAY_S - since) / 1.2);
    const x = 320 + enter * 360 - leave * 400;
    const s = this.sprite('pete', () => ({ c: peteGrid().toCanvas(), ax: 30, ay: PETE_WL }));
    this.put(ctx, s, x, K.SURF + Math.round(Math.sin(t * 2) * 0.8));
    if (enter === 0 && leave === 0) this.bubble(ctx, K.PETE_LINE, x + 2, K.SURF - 40, '#fffdf4');
  }

  // ---------- labels and UI ----------

  private tag(name: string, color: string): HTMLCanvasElement {
    const key = `tag|${name}|${color}`;
    return this.sprite(key, () => {
      const w = textWidth(name) + 16;
      const c = makeCanvas(w, 14);
      const g = c.getContext('2d')!;
      const dk = css(mix(color, '#000000', 0.55));
      g.fillStyle = dk;
      g.fillRect(1, 0, w - 2, 12);
      g.fillRect(0, 1, w, 10);
      g.fillStyle = color;
      g.fillRect(1, 1, w - 2, 10);
      g.fillStyle = css(mix(color, '#ffffff', 0.5));
      g.fillRect(2, 1, w - 4, 1);
      g.fillStyle = dk;
      const cx = Math.floor(w / 2);
      g.fillRect(cx - 2, 11, 5, 1);
      g.fillRect(cx - 1, 12, 3, 1);
      g.fillRect(cx, 13, 1, 1);
      g.fillStyle = '#10142a';
      SYM[symbolFor(color)].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && g.fillRect(3 + i, 3 + j, 1, 1)));
      g.drawImage(textSprite(name, '#10142a'), 10, 2);
      return { c, ax: 0, ay: 0 };
    }).c;
  }

  private bubble(ctx: CanvasRenderingContext2D, line: string, cx: number, bottom: number, bg: string): void {
    const s = this.sprite(`bubble|${line}`, () => {
      const words = line.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (textWidth(next) > 130 && cur) {
          lines.push(cur);
          cur = w;
        } else cur = next;
      }
      lines.push(cur);
      const w = Math.max(...lines.map((l) => textWidth(l))) + 12;
      const h = lines.length * 10 + 7;
      const c = makeCanvas(w + 2, h + 8);
      const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(10,26,51,0.3)';
      g.fillRect(2, 2, w, h);
      g.fillStyle = '#2a1a10';
      g.fillRect(1, 0, w - 2, h);
      g.fillRect(0, 1, w, h - 2);
      g.fillStyle = bg;
      g.fillRect(1, 1, w - 2, h - 2);
      g.fillStyle = '#ece2c6';
      g.fillRect(1, h - 3, w - 2, 2);
      const tx = Math.floor(w / 2) - 2;
      for (let k = 0; k < 6; k++) {
        const ww = Math.max(1, 5 - k);
        g.fillStyle = '#2a1a10';
        g.fillRect(tx + k * 0.3 - 1, h - 1 + k, ww + 2, 1);
        g.fillStyle = k < 2 ? '#ece2c6' : bg;
        g.fillRect(tx + k * 0.3, h - 1 + k, ww, 1);
      }
      lines.forEach((l, i) => g.drawImage(textSprite(l, '#2a1a10'), 6, 4 + i * 10));
      return { c, ax: Math.floor(w / 2), ay: h + 6 };
    });
    const x = Math.max(2, Math.min(K.SCENE_W - s.c.width - 2, Math.round(cx - s.ax)));
    ctx.drawImage(s.c, x, Math.max(2, Math.round(bottom - s.ay)));
  }

  private findRing(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number, r: number, arrowY: number): void {
    const rr = r + (Math.sin(t * 10) + 1) * 3;
    ctx.fillStyle = color;
    for (let a = 0; a < Math.PI * 2; a += 0.05) ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.8), 2, 2);
    const ay = Math.round(arrowY - 12 + Math.sin(t * 8) * 2);
    for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x) - 5 + k, ay + k, 11 - k * 2, 1);
  }

  private tugBar(ctx: CanvasRenderingContext2D, cx: number, y: number, frac: number): void {
    const w = 60;
    const x = Math.round(cx - w / 2);
    y = Math.max(K.SURF + 4, Math.round(y));
    ctx.drawImage(this.panel(w + 8, 12), x - 4, y - 3);
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = '#3fa9f5';
    ctx.fillRect(x + 1, y + 1, w - 2, 4);
    const fw = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
    ctx.fillStyle = '#e5533d';
    ctx.fillRect(x + 1, y + 1, fw, 4);
    ctx.fillStyle = '#ff9a7a';
    ctx.fillRect(x + 1, y + 1, fw, 1);
    const m = x + 1 + fw;
    ctx.fillStyle = '#2e1a0c';
    ctx.fillRect(m - 2, y - 3, 5, 12);
    ctx.fillStyle = '#fff6dc';
    ctx.fillRect(m - 1, y - 2, 3, 10);
  }

  private panel(w: number, h: number): HTMLCanvasElement {
    return this.sprite(`panel|${w}|${h}`, () => {
      const c = makeCanvas(w, h + 1);
      const g = c.getContext('2d')!;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          let col = j % 6 === 5 ? '#7a4b25' : (i * 7 + j * 13) % 23 < 2 ? '#8f5a2e' : '#a46a37';
          if (j === 1) col = '#d39a5e';
          if (j === 2) col = '#b47a44';
          g.fillStyle = col;
          g.fillRect(i, j, 1, 1);
        }
      g.fillStyle = '#2e1a0c';
      g.fillRect(0, 0, w, 1);
      g.fillRect(0, h - 1, w, 1);
      g.fillRect(0, 0, 1, h);
      g.fillRect(w - 1, 0, 1, h);
      g.fillStyle = '#5e3a1c';
      g.fillRect(1, h - 2, w - 2, 1);
      if (h > 14)
        for (const [a, b] of [[2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]]) {
          g.fillStyle = '#6c7480';
          g.fillRect(a, b, 2, 2);
          g.fillStyle = '#c9d2dc';
          g.fillRect(a, b, 1, 1);
        }
      g.fillStyle = 'rgba(8,20,40,0.35)';
      g.fillRect(1, h, w, 1);
      return { c, ax: 0, ay: 0 };
    }).c;
  }

  private drawHud(ctx: CanvasRenderingContext2D, hud: HudInfo): void {
    const box = (x: number, y: number, w: number, left: string, right: string, rc: string) => {
      ctx.drawImage(this.panel(w, 20), x, y);
      ctx.drawImage(textSprite(left, '#fff3d6', '#3b2414'), x + 7, y + 6);
      const r = textSprite(right, rc, '#3b2414');
      ctx.drawImage(r, x + w - r.width - 5, y + 6);
    };
    box(6, 6, 118, 'Crew', hud.crew.toLocaleString('en-US'), '#ffe27a');
    box(K.SCENE_W - 124, 6, 118, 'School', hud.school.toLocaleString('en-US'), '#9be8ff');
    if (hud.timeLeft !== null) {
      const m = Math.floor(hud.timeLeft / 60);
      const s = String(hud.timeLeft % 60).padStart(2, '0');
      const urgent = hud.timeLeft <= 10;
      ctx.drawImage(this.panel(56, 20), K.SCENE_W / 2 - 28, K.SCENE_H - 26);
      const sp = textSprite(`${m}:${s}`, urgent ? '#ff7a6a' : '#fff3d6', '#3b2414');
      ctx.drawImage(sp, Math.round(K.SCENE_W / 2 - sp.width / 2), K.SCENE_H - 20);
    }
    const room = `Room ${hud.code}`;
    ctx.drawImage(this.panel(textWidth(room) + 14, 20), 6, K.SCENE_H - 26);
    ctx.drawImage(textSprite(room, '#fff3d6', '#3b2414'), 13, K.SCENE_H - 20);
  }

  // ---------- effects ----------

  private drawPlankton(ctx: CanvasRenderingContext2D, t: number): void {
    ctx.fillStyle = '#d9fbff';
    for (const p of this.plankton) {
      const x = (p.x + t * p.s) % K.SCENE_W;
      const y = p.y + Math.sin(t * 0.7 + p.x) * 3;
      ctx.globalAlpha = p.a;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawSplashes(ctx: CanvasRenderingContext2D, t: number): void {
    this.splashes = this.splashes.filter((s) => t - s.at < 0.7);
    for (const s of this.splashes) {
      const k = (t - s.at) / 0.7;
      const n = s.big ? 14 : 8;
      ctx.fillStyle = css(s.color);
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = (s.big ? 16 : 9) * k + 2;
        const surf = s.y <= K.SURF + 3;
        const yy = surf ? s.y - Math.abs(Math.sin(a)) * r * 1.4 + k * k * 18 : s.y + Math.sin(a) * r;
        ctx.fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(yy), 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBubbles(ctx: CanvasRenderingContext2D, world: World, t: number): void {
    if (this.bubbles.length < 30 && Math.random() < 0.25) {
      const src = world.fish[Math.floor(Math.random() * world.fish.length)];
      if (src?.alive) this.bubbles.push({ x: src.x + src.dir * fishLen(src) * 0.4, y: src.y - 2, r: Math.random() < 0.3 ? 2 : 1, vy: 12 + Math.random() * 10 });
    }
    ctx.fillStyle = '#d8fbff';
    for (const b of this.bubbles) {
      b.y -= b.vy / 60;
      const x = Math.round(b.x + Math.sin(t * 3 + b.y * 0.1));
      const y = Math.round(b.y);
      ctx.globalAlpha = 0.8;
      if (b.r === 1) ctx.fillRect(x, y, 1, 1);
      else {
        ctx.fillRect(x - 1, y - 2, 3, 1);
        ctx.fillRect(x - 1, y + 2, 3, 1);
        ctx.fillRect(x - 2, y - 1, 1, 3);
        ctx.fillRect(x + 2, y - 1, 1, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y - 1, 1, 1);
        ctx.fillStyle = '#d8fbff';
      }
    }
    ctx.globalAlpha = 1;
    this.bubbles = this.bubbles.filter((b) => b.y > K.SURF + 3);
  }

  private drawPopups(ctx: CanvasRenderingContext2D, t: number): void {
    this.popups = this.popups.filter((p) => t - p.at < 1.4);
    for (const p of this.popups) {
      const k = (t - p.at) / 1.4;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const w = p.sprite.width + (p.icon ? p.icon.width + 2 : 0);
      const x = Math.round(p.x - w / 2);
      const y = Math.round(p.y - k * 16);
      if (p.icon) ctx.drawImage(p.icon, x, y);
      ctx.drawImage(p.sprite, x + (p.icon ? p.icon.width + 2 : 0), y + 1);
    }
    ctx.globalAlpha = 1;
  }

  private coinIcon(): HTMLCanvasElement {
    return this.sprite('coinIcon', () => ({ c: coinGrid(0).toCanvas(), ax: 0, ay: 0 })).c;
  }

  private meat(): HTMLCanvasElement {
    return this.sprite('meatIcon', () => ({ c: meatGrid().toCanvas(), ax: 0, ay: 0 })).c;
  }

  // ---------- helpers ----------

  private sprite(key: string, make: () => Sprite): Sprite {
    let s = this.sprites.get(key);
    if (!s) {
      s = make();
      if (this.sprites.size > 1500) this.sprites.clear();
      this.sprites.set(key, s);
    }
    return s;
  }

  private put(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number): void {
    ctx.drawImage(s.c, Math.round(x - s.ax), Math.round(y - s.ay));
  }

  private pixLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, alpha: number): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
