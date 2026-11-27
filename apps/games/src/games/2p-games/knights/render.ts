// Draws Knight Battle from snapshots. Units and buildings use the Tiny Swords pictures that Tiny Kingdoms
// already ships (Pixel Frog's free pack); hearts, gold blocks, the mystery box and ghosts are drawn in code.
// Red players see the field upside down, so everyone's own heart sits at the bottom of their screen.
import { ANIMS, BKINDS, BUILD, CLASSES, ENCHANTS, FX, TAUNTS, TEAM_FILES, TILE, UKINDS, type BKind, type Snap, type UKind } from './sim';

const urls = import.meta.glob('../../tiny-kingdoms/assets/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const imgs = new Map<string, HTMLImageElement>();
export function loadArt(): Promise<void> {
  const all = Object.entries(urls).map(([path, url]) => new Promise<void>((res) => {
    const key = path.replace(/^.*\/assets\//, '').replace('.png', '');
    if (imgs.has(key)) return res();
    const im = new Image();
    im.onload = () => res();
    im.onerror = () => res();
    im.src = url;
    imgs.set(key, im);
  }));
  return Promise.all(all).then(() => undefined);
}
export const artUrl = (key: string) => Object.entries(urls).find(([p]) => p.endsWith(`/assets/${key}.png`))?.[1] ?? '';
const img = (key: string) => imgs.get(key);

interface Sheet { file: string; n: number; fps: number; size: number; ax: number; ay: number; once?: boolean }
const S = (file: string, n: number, fps = 10, once = false, size = 192, ax = 96, ay = 132): Sheet => ({ file, n, fps, size, ax, ay, once });
const L = (file: string, n: number, fps = 10, once = false): Sheet => ({ file, n, fps, size: 320, ax: 160, ay: 196, once });
const SHEETS: Record<string, Sheet> = {
  'warrior.idle': S('warrior_idle', 8), 'warrior.run': S('warrior_run', 6, 12), 'warrior.attack': S('warrior_attack1', 4, 12, true), 'warrior.attack2': S('warrior_attack2', 4, 12, true),
  'archer.idle': S('archer_idle', 6), 'archer.run': S('archer_run', 4), 'archer.shoot': S('archer_shoot', 8, 16, true),
  'lancer.idle': L('lancer_idle', 12), 'lancer.run': L('lancer_run', 6, 12),
  'lancer.right': L('lancer_right', 3, 9, true), 'lancer.upright': L('lancer_upright', 3, 9, true), 'lancer.downright': L('lancer_downright', 3, 9, true),
  'lancer.up': L('lancer_up', 3, 9, true), 'lancer.down': L('lancer_down', 3, 9, true),
  'monk.idle': S('monk_idle', 6), 'monk.run': S('monk_run', 4), 'monk.heal': S('monk_heal', 11, 18, true),
  'sheep.idle': S('sheep_idle', 6, 8, false, 128, 64, 84), 'sheep.run': S('sheep_move', 4, 10, false, 128, 64, 84),
};
const FX_SHEETS: Partial<Record<number, Sheet>> = {
  [FX.boom]: S('explosion1', 8, 14, true, 192, 96, 96),
  [FX.dust]: S('dust1', 8, 14, true, 64, 32, 40),
  [FX.heal]: S('heal', 11, 16, true, 192, 96, 110),
};
const WATER = '#47aba9';
export const RING = ['#4b8ed9', '#d9534b'];
const ENCH_COLOR = ['#9fe6ff', '#ff8a3a', '#ffe94a', '#8fe36b'];

interface Ent { id: number; kind: number; team: number; x: number; y: number; anim: number; seq: number; flags: number; hp: number; owner: number; cls: number; aim: number }
interface Bld { id: number; kind: number; team: number; x: number; y: number; hp: number; owner: number; variant: number; tx: number; ty: number }

export interface Overlay {
  me: number;
  myHero: number;
  ghost: { kind: BKind; tx: number; ty: number; ok: boolean } | null;
  near: number; // building you can use
  names: Map<number, { name: string; slot: number }>; // hero id -> name
  taunts: Map<number, { text: string; age: number }>; // hero id -> taunt
  hearts: Map<number, { owner: string; team: number }>;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private decor: { key: string; x: number; y: number; n: number; size: number; off: number }[] = [];
  private seen = new Map<number, { seq: number; start: number }>();
  private prev = new Map<number, Ent>();
  private cur = new Map<number, Ent>();
  private blds = new Map<number, Bld>();
  /** Hearts that broke, so they stay on the field in pieces. */
  private broken = new Map<number, Bld>();
  private snapAt = 0;
  private snapGap = 1000 / 15;
  private effects: { k: number; x: number; y: number; x2: number; y2: number; t: number }[] = [];
  snap: Snap | null = null;
  camX = 0; camY = 0; zoom = 1;
  private w = 0; private h = 0; private dpr = 1;
  readonly WH: number;

  constructor(canvas: HTMLCanvasElement, readonly W: number, readonly H: number, readonly flip: boolean, seed: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.WH = H * TILE;
    let s = seed >>> 0 || 7;
    const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    for (let i = 0; i < W * H / 14; i++) {
      const x = (1.5 + r() * (W - 3)) * TILE, y = (1.5 + r() * (H - 3)) * TILE, roll = r();
      if (roll < 0.55) this.decor.push({ key: `terrain/bush${1 + Math.floor(r() * 4)}`, x, y, n: 8, size: 128, off: r() * 8 });
      else if (roll < 0.8) this.decor.push({ key: `terrain/rock${1 + Math.floor(r() * 4)}`, x, y, n: 1, size: 64, off: 0 });
    }
  }

  /** World y to the y on this player's (maybe flipped) field. */
  vy(y: number) { return this.flip ? this.WH - y : y; }

  push(s: Snap, now: number, smooth: boolean) {
    for (const f of s.fx) this.effects.push({ k: f[0], x: f[1], y: f[2], x2: f[3], y2: f[4], t: now });
    if (this.effects.length > 200) this.effects.splice(0, this.effects.length - 200);
    if (smooth) { this.snapGap = Math.max(40, Math.min(250, now - this.snapAt)); this.prev = this.cur; }
    this.snapAt = now;
    const cur = new Map<number, Ent>();
    for (const e of s.e) {
      const ent: Ent = { id: e[0], kind: e[1], team: e[2], x: e[3], y: e[4], anim: e[5], seq: e[6], flags: e[7], hp: e[8], owner: e[9], cls: e[10], aim: e[11] };
      cur.set(ent.id, ent);
      const sn = this.seen.get(ent.id);
      if (!sn || sn.seq !== ent.seq) this.seen.set(ent.id, { seq: ent.seq, start: now });
    }
    if (!smooth) this.prev = cur;
    this.cur = cur;
    const nb = new Map<number, Bld>();
    for (const b of s.b) nb.set(b[0], { id: b[0], kind: b[1], team: b[2], x: b[3], y: b[4], hp: b[5], owner: b[6], variant: b[7], tx: b[8], ty: b[9] });
    for (const [id, b] of this.blds) if (!nb.has(id) && BKINDS[b.kind] === 'heart') this.broken.set(id, b);
    this.blds = nb;
    if (this.seen.size > cur.size * 2 + 200) for (const id of this.seen.keys()) if (!cur.has(id)) this.seen.delete(id);
    this.snap = s;
  }

  pos(id: number, now: number): { x: number; y: number } | null {
    const c = this.cur.get(id);
    if (!c) return null;
    const p = this.prev.get(id);
    if (!p) return { x: c.x, y: c.y };
    const a = Math.min(1, (now - this.snapAt) / this.snapGap);
    if (Math.hypot(c.x - p.x, c.y - p.y) > 200) return { x: c.x, y: c.y };
    return { x: p.x + (c.x - p.x) * a, y: p.y + (c.y - p.y) * a };
  }
  ent(id: number) { return this.cur.get(id); }
  ents() { return this.cur.values(); }
  buildings() { return this.blds.values(); }
  building(id: number) { return this.blds.get(id); }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.zoom = Math.max(0.4, Math.min(1.1, Math.min(r.height / (12 * TILE), r.width / (14 * TILE))));
  }

  /** Screen point → world point (undoing the flip). */
  toWorld(sx: number, sy: number) {
    const vw = this.w / this.zoom, vh = this.h / this.zoom;
    const x = sx / this.zoom + this.camX - vw / 2, y = sy / this.zoom + this.camY - vh / 2;
    return { x, y: this.vy(y) };
  }
  toScreen(x: number, y: number) {
    const vw = this.w / this.zoom, vh = this.h / this.zoom;
    return { x: (x - (this.camX - vw / 2)) * this.zoom, y: (this.vy(y) - (this.camY - vh / 2)) * this.zoom };
  }
  /** Is a world point on screen? */
  onScreen(x: number, y: number) {
    const p = this.toScreen(x, y);
    return p.x > -40 && p.y > -40 && p.x < this.w + 40 && p.y < this.h + 40;
  }

  private sheetFor(e: Ent): Sheet | undefined {
    const kind = UKINDS[e.kind] as UKind;
    const anim = ANIMS[e.anim];
    const k = kind === 'hero' ? ['warrior', 'archer', 'monk', 'lancer'][e.cls] : kind;
    if (k === 'lancer' && (anim === 'attack' || anim === 'attack2')) {
      // the spear points where they aimed (on this player's view)
      let a = e.aim / 100;
      if (this.flip) a = -a;
      const dx = Math.cos(a), dy = Math.sin(a);
      const n = dy < -0.8 ? 'up' : dy > 0.8 ? 'down' : dy < -0.35 ? 'upright' : dy > 0.35 ? 'downright' : 'right';
      return SHEETS[`lancer.${n}`];
      void dx;
    }
    return SHEETS[`${k}.${anim}`] ?? SHEETS[`${k}.idle`];
  }

  private drawSheet(sh: Sheet, file: string, x: number, y: number, t: number, flip: boolean, scale = 1, alpha = 1) {
    let f = Math.floor(t * sh.fps);
    if (sh.once) f = Math.min(f, sh.n - 1); else f %= sh.n;
    const im = img(file);
    if (!im || !im.complete || !im.naturalWidth) return;
    const c = this.ctx;
    c.save();
    if (alpha < 1) c.globalAlpha = alpha;
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    c.drawImage(im, f * sh.size, 0, sh.size, sh.size, -sh.ax * scale, -sh.ay * scale, sh.size * scale, sh.size * scale);
    c.restore();
  }

  private land(x: number, y: number) { return x >= 1 && y >= 1 && x < this.W - 1 && y < this.H - 1; }
  private grassTile(x: number, y: number): [number, number] {
    const l = !this.land(x - 1, y), r = !this.land(x + 1, y), u = !this.land(x, y - 1), d = !this.land(x, y + 1);
    return [l ? 0 : r ? 2 : 1, u ? 0 : d ? 2 : 1];
  }

  draw(now: number, o: Overlay, focus: { x: number; y: number }) {
    const c = this.ctx, z = this.zoom, s = this.snap;
    const vw = this.w / z, vh = this.h / z;
    const MW = this.W * TILE, MH = this.H * TILE;
    const fx = focus.x, fy = this.vy(focus.y) - 40;
    const tx = vw >= MW ? MW / 2 : Math.max(vw / 2, Math.min(MW - vw / 2, fx));
    const ty = vh >= MH ? MH / 2 : Math.max(vh / 2, Math.min(MH - vh / 2, fy));
    if (!this.camX && !this.camY) { this.camX = tx; this.camY = ty; }
    this.camX += (tx - this.camX) * 0.15; this.camY += (ty - this.camY) * 0.15;
    const ox = this.camX - vw / 2, oy = this.camY - vh / 2;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = WATER;
    c.fillRect(0, 0, this.w, this.h);
    c.setTransform(this.dpr * z, 0, 0, this.dpr * z, -ox * z * this.dpr, -oy * z * this.dpr);
    const sec = now / 1000;
    const inView = (x: number, y: number, m = 200) => x > ox - m && x < ox + vw + m && y > oy - m && y < oy + vh + m * 1.5;
    // foam, then grass (tile rows are drawn in view space; the field is symmetric so the flip is free)
    const foam = img('terrain/foam');
    const x0 = Math.max(0, Math.floor(ox / TILE) - 1), x1 = Math.min(this.W - 1, Math.ceil((ox + vw) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(oy / TILE) - 1), y1 = Math.min(this.H - 1, Math.ceil((oy + vh) / TILE) + 1);
    if (foam) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.land(x, y)) continue;
      if (this.land(x - 1, y) && this.land(x + 1, y) && this.land(x, y - 1) && this.land(x, y + 1)) continue;
      const f = (Math.floor(sec * 8) + x * 3 + y * 5) % 16;
      c.drawImage(foam, f * 192, 0, 192, 192, x * TILE - 64, y * TILE - 64, 192, 192);
    }
    const tm = img('terrain/tilemap');
    if (tm) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.land(x, y)) continue;
      const [tc, tr] = this.grassTile(x, y);
      c.drawImage(tm, tc * 64, tr * 64, 64, 64, x * TILE, y * TILE, TILE, TILE);
    }
    // my side is a touch brighter; the middle line
    const myTeam = this.flip ? 1 : 0;
    void myTeam;
    c.fillStyle = 'rgba(255,255,255,.05)';
    c.fillRect(TILE, MH / 2, MW - 2 * TILE, MH / 2 - TILE);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 4; c.setLineDash([24, 18]);
    c.beginPath(); c.moveTo(TILE, MH / 2); c.lineTo(MW - TILE, MH / 2); c.stroke(); c.setLineDash([]);
    // the drop spot in the middle
    c.strokeStyle = 'rgba(255,240,180,.45)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(MW / 2, this.vy(MH / 2 + 20), 60, 26, 0, 0, Math.PI * 2); c.stroke();
    for (const d of this.decor) {
      const dy = this.vy(d.y);
      if (!inView(d.x, dy)) continue;
      const im = img(d.key); if (!im) continue;
      const f = Math.floor(sec * 7 + d.off) % d.n;
      c.drawImage(im, f * d.size, 0, d.size, d.size, d.x - d.size / 2, dy - d.size * 0.6, d.size, d.size);
    }
    if (o.ghost) this.drawGhost(o.ghost, sec);

    type D = { y: number; f: () => void };
    const list: D[] = [];
    if (s) for (const [, rtx, rty, gold] of s.rocks) {
      if (gold <= 0) continue;
      const px = (rtx + 0.5) * TILE, py = this.vy((rty + 0.6) * TILE);
      if (!inView(px, py)) continue;
      const n = Math.max(1, Math.min(6, Math.ceil(gold / 7)));
      list.push({ y: py, f: () => { const im = img(`terrain/gold${n}`); if (im) c.drawImage(im, px - 64, py - 84, 128, 128); } });
    }
    for (const b of this.broken.values()) {
      const s0 = BUILD.heart, fy0 = this.flip ? this.WH - (b.y - s0.h * TILE) : b.y;
      list.push({ y: fy0 - 1, f: () => this.drawHeart(b.x, fy0, 0, b.team, sec, o.hearts.get(b.id)?.owner ?? '', true) });
    }
    for (const b of this.blds.values()) {
      const kind = BKINDS[b.kind];
      const st = BUILD[kind];
      const foot = this.flip ? this.WH - (b.y - st.h * TILE) : b.y;
      if (!inView(b.x, foot, 340)) continue;
      list.push({ y: kind === 'goldblock' ? foot - TILE + 2 : foot, f: () => this.drawBuilding(b, kind, foot, now, o) });
    }
    for (const e of this.cur.values()) {
      const p = this.pos(e.id, now)!;
      const py = this.vy(p.y);
      if (!inView(p.x, py, 320)) continue;
      list.push({ y: py, f: () => this.drawUnit(e, p.x, py, now, o) });
    }
    if (s && s.box[0]) {
      const bx = s.box[1], by = this.vy(s.box[2]);
      list.push({ y: by, f: () => this.drawBox(bx, by, s.box[0], s.box[3], sec) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();

    // arrows
    const ar = img('fx/arrow');
    if (s && ar) for (const [x, y, a] of s.a) {
      const yy = this.vy(y);
      if (!inView(x, yy)) continue;
      c.save(); c.translate(x, yy); c.rotate(this.flip ? -a / 100 : a / 100); c.drawImage(ar, -32, -32, 64, 64); c.restore();
    }
    this.drawEffects(now);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawEffects(now: number) {
    const c = this.ctx;
    this.effects = this.effects.filter((f) => now - f.t < 1200);
    for (const f of this.effects) {
      const a = (now - f.t) / 1000;
      const x = f.x, y = this.vy(f.y);
      const sh = FX_SHEETS[f.k];
      if (sh) {
        if (a > sh.n / sh.fps) continue;
        this.drawSheet(sh, `fx/${sh.file}`, x, y, a, false, f.k === FX.heal && f.x2 ? 1.7 : 1);
        continue;
      }
      c.save();
      switch (f.k) {
        case FX.hit: {
          if (a > 0.2) break;
          c.strokeStyle = `rgba(255,255,255,${1 - a / 0.2})`; c.lineWidth = 4;
          for (let i = 0; i < 6; i++) { const an = i * 1.05 + f.x; c.beginPath(); c.moveTo(x + Math.cos(an) * 8, y + Math.sin(an) * 8); c.lineTo(x + Math.cos(an) * (14 + a * 90), y + Math.sin(an) * (14 + a * 90)); c.stroke(); }
          break;
        }
        case FX.swing: {
          if (a > 0.18) break;
          let an = f.x2 / 100; if (this.flip) an = -an;
          c.strokeStyle = `rgba(255,255,240,${0.85 * (1 - a / 0.18)})`; c.lineWidth = 10; c.lineCap = 'round';
          c.beginPath(); c.arc(x - Math.cos(an) * 50, y - Math.sin(an) * 30, 70, an - 1 + a * 6, an + 0.2 + a * 6); c.stroke();
          break;
        }
        case FX.zap: {
          if (a > 0.3) break;
          const x2 = f.x2, y2 = this.vy(f.y2);
          c.strokeStyle = `rgba(255,240,90,${1 - a / 0.3})`; c.lineWidth = 5; c.shadowColor = '#fff6a0'; c.shadowBlur = 12;
          c.beginPath(); c.moveTo(x, y);
          for (let i = 1; i < 6; i++) { const t = i / 6; c.lineTo(x + (x2 - x) * t + (Math.random() - 0.5) * 30, y + (y2 - y) * t + (Math.random() - 0.5) * 30); }
          c.lineTo(x2, y2); c.stroke();
          break;
        }
        case FX.freeze: {
          if (a > 0.6) break;
          c.fillStyle = `rgba(190,240,255,${1 - a / 0.6})`;
          for (let i = 0; i < 8; i++) { const an = i * 0.785; const d = 10 + a * 80; c.fillRect(x + Math.cos(an) * d - 4, y - 30 + Math.sin(an) * d - 4, 8, 8); }
          break;
        }
        case FX.burn: {
          if (a > 0.5) break;
          const fire = img('fx/fire1');
          if (fire) { c.globalAlpha = 1 - a / 0.5; c.drawImage(fire, (Math.floor(a * 16) % 8) * 64, 0, 64, 64, x - 32 + (f.t % 20) - 10, y - 70 - a * 30, 64, 64); }
          break;
        }
        case FX.poison: {
          if (a > 0.8) break;
          c.fillStyle = `rgba(120,220,80,${0.8 * (1 - a / 0.8)})`;
          for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + (i - 1) * 12 + Math.sin(a * 8 + i) * 4, y - 50 - a * 50 - i * 6, 5 + i, 0, Math.PI * 2); c.fill(); }
          break;
        }
        case FX.gold: case FX.meat: {
          if (a > 0.9) break;
          if (f.y2 === 1) { c.fillStyle = `rgba(255,230,90,${1 - a / 0.9})`; c.beginPath(); c.arc(x, y, 6 + a * 40, 0, Math.PI * 2); c.fill(); break; }
          const icon = img(f.k === FX.gold ? 'ui/gold' : 'ui/meat');
          c.globalAlpha = Math.max(0, 1 - a / 0.9);
          if (icon) c.drawImage(icon, x - 20, y - 60 - a * 60, 40, 40);
          if (f.x2) { c.font = '900 22px system-ui, sans-serif'; c.textAlign = 'left'; c.lineWidth = 4; c.strokeStyle = '#3b2a1a'; c.strokeText(`+${f.x2}`, x + 18, y - 32 - a * 60); c.fillStyle = f.k === FX.gold ? '#ffe066' : '#ffb0a0'; c.fillText(`+${f.x2}`, x + 18, y - 32 - a * 60); }
          break;
        }
        case FX.box: {
          if (a > 1.1) break;
          const col = ENCH_COLOR[f.x2] ?? '#fff';
          c.strokeStyle = col; c.globalAlpha = 1 - a / 1.1; c.lineWidth = 6;
          c.beginPath(); c.arc(x, y - 30, 20 + a * 160, 0, Math.PI * 2); c.stroke();
          for (let i = 0; i < 12; i++) { const an = i * 0.52 + a * 2; c.fillStyle = col; c.fillRect(x + Math.cos(an) * a * 140 - 4, y - 30 + Math.sin(an) * a * 140 - 4, 8, 8); }
          break;
        }
      }
      c.restore();
    }
  }

  private drawUnit(e: Ent, x: number, y: number, now: number, o: Overlay) {
    const c = this.ctx;
    const kind = UKINDS[e.kind] as UKind;
    const ghost = !!(e.flags & 16);
    if (ghost) { this.drawGhostHero(x, y, e.team, now / 1000, e.id); this.label(e, x, y, o, now); return; }
    const sh = this.sheetFor(e);
    if (!sh) return;
    const seen = this.seen.get(e.id);
    let t = seen ? (now - seen.start) / 1000 : 0;
    let use = sh;
    if (sh.once && t > sh.n / sh.fps + 0.05) { use = this.sheetFor({ ...e, anim: 0 })!; t = now / 1000; }
    const hero = kind === 'hero';
    const scale = hero ? 1.12 : kind === 'sheep' ? 1 : 0.86;
    if (hero) {
      c.save();
      c.fillStyle = RING[e.team] + '88'; c.strokeStyle = e.id === o.myHero ? '#fff' : RING[e.team]; c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, y + 2, 30, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.restore();
    }
    const file = kind === 'sheep' ? `terrain/${use.file}` : `units/${TEAM_FILES[e.team] ?? 'blue'}/${use.file}`;
    this.drawSheet(use, file, x, y, t, !!(e.flags & 1), scale);
    // frozen: an ice block around them
    if (e.flags & 2) {
      c.save(); c.fillStyle = 'rgba(170,230,255,.45)'; c.strokeStyle = 'rgba(230,250,255,.9)'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(x - 30 * scale, y - 92 * scale, 60 * scale, 96 * scale, 8); c.fill(); c.stroke(); c.restore();
    } else if (e.flags & 32) {
      c.save(); c.fillStyle = 'rgba(170,230,255,.25)'; c.beginPath(); c.ellipse(x, y, 26, 10, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (e.flags & 4) { const fire = img('fx/fire2'); if (fire) c.drawImage(fire, (Math.floor(now / 70) % 10) * 64, 0, 64, 64, x - 30, y - 80, 60, 60); }
    if (e.flags & 8) { c.save(); c.fillStyle = 'rgba(120,220,80,.8)'; for (let i = 0; i < 3; i++) { const a = (now / 600 + i / 3) % 1; c.beginPath(); c.arc(x - 12 + i * 12, y - 70 - a * 30, 4, 0, Math.PI * 2); c.fill(); } c.restore(); }
    if (kind !== 'sheep' && (e.hp < 100 || hero)) this.bar(x, y - (hero ? 100 : 80), hero ? 60 : 40, e.hp, e.team === (this.flip ? 1 : 0) ? '#5bd15b' : '#e04a3a');
    this.label(e, x, y, o, now);
  }

  private label(e: Ent, x: number, y: number, o: Overlay, now: number) {
    const c = this.ctx;
    const nm = o.names.get(e.id);
    if (!nm) return;
    c.save();
    c.font = '700 18px system-ui, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(nm.name, x, y - 110);
    c.fillStyle = e.flags & 16 ? '#e8f0ff' : '#fff'; c.fillText(nm.name, x, y - 110);
    const tn = o.taunts.get(e.id);
    if (tn) {
      const a = Math.min(1, (2.2 - tn.age) * 3);
      c.globalAlpha = Math.max(0, a);
      c.font = '800 20px system-ui, sans-serif';
      const w = c.measureText(tn.text).width + 24, by = y - 160 - Math.min(10, tn.age * 40);
      c.fillStyle = '#fff'; c.strokeStyle = '#3b2a1a'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(x - w / 2, by - 22, w, 34, 12); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 8, by + 12); c.lineTo(x, by + 24); c.lineTo(x + 8, by + 12); c.fill();
      c.fillStyle = '#3b2a1a'; c.fillText(tn.text, x, by + 2);
    }
    c.restore();
    void now;
  }

  private drawBuilding(b: Bld, kind: BKind, foot: number, now: number, o: Overlay) {
    const c = this.ctx, sec = now / 1000;
    const col = TEAM_FILES[b.team] ?? 'blue';
    const st = BUILD[kind];
    if (kind === 'heart') { this.drawHeart(b.x, foot, b.hp, b.team, sec, o.hearts.get(b.id)?.owner ?? '', false); return; }
    if (kind === 'goldblock') { this.drawGoldBlock(b.x, foot, sec, b.id); this.nearRing(b, foot, o, st.w); return; }
    if (kind === 'wall') { this.drawWall(b.x, foot, b.team); if (b.hp < 100) this.bar(b.x, foot - 92, 44, b.hp, '#d9cca4'); this.nearRing(b, foot, o, st.w); return; }
    const file = kind === 'house' ? `buildings/${col}/house${(b.variant % 3) + 1}` : `buildings/${col}/${kind}`;
    const im = img(file);
    if (!im) return;
    c.drawImage(im, b.x - im.width / 2, foot - im.height + 8);
    this.nearRing(b, foot, o, st.w);
    if (kind !== 'castle' && b.hp < 50) {
      for (let i = 0; i < (b.hp < 25 ? 3 : 1); i++) {
        const fire = img(`fx/fire${1 + (i % 3)}`);
        const n = [8, 10, 12][i % 3];
        if (fire) c.drawImage(fire, (Math.floor(sec * 12 + i * 3) % n) * 64, 0, 64, 64, b.x - 40 + i * 30, foot - im.height * 0.5, 64, 64);
      }
    }
    if (kind !== 'castle' && b.hp < 100) this.bar(b.x, foot - im.height + 30, Math.min(140, im.width * 0.6), b.hp, '#d9cca4');
  }

  private nearRing(b: Bld, foot: number, o: Overlay, w: number) {
    if (b.id !== o.near) return;
    const c = this.ctx;
    c.save(); c.strokeStyle = 'rgba(255,240,170,.95)'; c.lineWidth = 4; c.setLineDash([12, 8]);
    c.beginPath(); c.ellipse(b.x, foot - 10, Math.max(40, w * TILE * 0.6), 30, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }

  /** A big beating heart on a stone stand in the team's color, with its health underneath. */
  drawHeart(x: number, foot: number, hp: number, team: number, sec: number, owner: string, broken: boolean) {
    const c = this.ctx;
    const beat = broken ? 1 : 1 + Math.max(0, Math.sin(sec * (hp < 300 ? 9 : 5))) * 0.06;
    c.save();
    // stand
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, foot - 6, 96, 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6d6a74'; c.beginPath(); c.roundRect(x - 80, foot - 44, 160, 38, 10); c.fill();
    c.fillStyle = RING[team]; c.beginPath(); c.roundRect(x - 72, foot - 40, 144, 12, 6); c.fill();
    c.fillStyle = '#8c8994'; c.beginPath(); c.roundRect(x - 80, foot - 26, 160, 18, 8); c.fill();
    // heart
    const cy = foot - 104;
    c.translate(x, cy);
    if (broken) {
      // two gray halves split along a zigzag crack
      for (const side of [-1, 1]) {
        c.save(); c.translate(side * 16, 10); c.rotate(side * 0.25);
        c.beginPath(); c.moveTo(0, -80); c.lineTo(0, -36); c.lineTo(-10, -10); c.lineTo(6, 10); c.lineTo(-6, 34); c.lineTo(0, 58); c.lineTo(0, 90); c.lineTo(side * 100, 90); c.lineTo(side * 100, -80); c.closePath(); c.clip();
        this.heartPath();
        c.fillStyle = '#7c7480'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#3b343e'; c.stroke();
        c.restore();
      }
    } else {
      c.scale(beat, beat);
      this.heartPath();
      const g = c.createLinearGradient(0, -60, 0, 60);
      g.addColorStop(0, '#ff6b7d'); g.addColorStop(1, '#c81e3a');
      c.fillStyle = g; c.fill();
      c.lineWidth = 6; c.strokeStyle = '#6e0f1f'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.ellipse(-28, -26, 14, 9, -0.6, 0, Math.PI * 2); c.fill();
      if (hp < 600) { c.strokeStyle = '#6e0f1f'; c.lineWidth = 4; c.beginPath(); c.moveTo(4, -40); c.lineTo(-6, -14); c.lineTo(8, 4); if (hp < 300) { c.lineTo(-4, 26); } c.stroke(); }
    }
    c.restore();
    // health and owner
    c.save();
    c.font = '800 18px system-ui, sans-serif'; c.textAlign = 'center';
    if (!broken) {
      const w = 140;
      c.fillStyle = 'rgba(20,20,30,.85)'; c.beginPath(); c.roundRect(x - w / 2 - 3, foot - 200, w + 6, 20, 6); c.fill();
      c.fillStyle = hp > 500 ? '#5bd15b' : hp > 250 ? '#f0c040' : '#e04a3a'; c.beginPath(); c.roundRect(x - w / 2, foot - 197, w * Math.max(0, hp) / 1000, 14, 5); c.fill();
      c.fillStyle = '#fff'; c.font = '800 13px system-ui, sans-serif'; c.fillText(`${Math.max(0, Math.ceil(hp))} / 1000`, x, foot - 185);
    }
    if (owner) { c.font = '800 17px system-ui, sans-serif'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(owner, x, foot - 210); c.fillStyle = '#fff'; c.fillText(owner, x, foot - 210); }
    c.restore();
  }

  private heartPath() {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(0, 58);
    c.bezierCurveTo(-30, 30, -78, 6, -74, -28);
    c.bezierCurveTo(-70, -62, -22, -72, 0, -36);
    c.bezierCurveTo(22, -72, 70, -62, 74, -28);
    c.bezierCurveTo(78, 6, 30, 30, 0, 58);
    c.closePath();
  }

  /** A shiny block of gold that never breaks. */
  private drawGoldBlock(x: number, foot: number, sec: number, id: number) {
    const c = this.ctx;
    const x0 = x - 30, top = foot - 64;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x0 + 4, foot - 6, 60, 8);
    c.fillStyle = '#b07d10'; c.fillRect(x0, top + 14, 60, 50);
    c.fillStyle = '#f6c945'; c.fillRect(x0, top, 60, 18);
    c.fillStyle = '#e3a920'; c.fillRect(x0 + 3, top + 18, 54, 42);
    c.fillStyle = '#ffe48a'; c.fillRect(x0 + 6, top + 3, 30, 6);
    c.strokeStyle = '#8a5d06'; c.lineWidth = 3; c.strokeRect(x0, top, 60, 64);
    c.font = '900 22px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff2b0'; c.fillText('∞', x, top + 48);
    const t = (sec * 0.6 + id * 0.37) % 1;
    if (t < 0.3) { c.globalAlpha = 0.7 * (1 - t / 0.3); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x0 + t * 200, top); c.lineTo(x0 + t * 200 + 12, top); c.lineTo(x0 + t * 200 - 18, top + 64); c.lineTo(x0 + t * 200 - 30, top + 64); c.fill(); }
    c.restore();
  }

  private drawWall(x: number, foot: number, team: number) {
    const c = this.ctx;
    const trim = RING[team];
    const x0 = x - 32, top = foot - 84;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x0 + 4, foot - 8, 64, 10);
    c.fillStyle = '#2a2a3a'; c.fillRect(x0, top + 14, 64, 72);
    c.fillStyle = '#d9cca4'; c.fillRect(x0 + 3, top + 17, 58, 52);
    c.fillStyle = '#9c917a'; c.fillRect(x0 + 3, top + 69, 58, 14);
    c.strokeStyle = '#a89c7c'; c.lineWidth = 2;
    c.beginPath();
    for (const ry of [30, 43, 56]) { c.moveTo(x0 + 3, top + ry); c.lineTo(x0 + 61, top + ry); }
    c.stroke();
    c.fillStyle = '#2a2a3a';
    for (const mx of [0, 24, 46]) c.fillRect(x0 + mx, top, 18, 18);
    c.fillStyle = trim;
    for (const mx of [0, 24, 46]) c.fillRect(x0 + mx + 3, top + 3, 12, 13);
    c.restore();
  }

  /** A little sheet ghost in the team's color. */
  private drawGhostHero(x: number, y: number, team: number, sec: number, id: number) {
    const c = this.ctx;
    const bob = Math.sin(sec * 3 + id) * 6;
    c.save();
    c.globalAlpha = 0.7;
    c.translate(x, y - 50 + bob);
    c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(0, 50 - bob, 20, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4f7ff'; c.strokeStyle = RING[team]; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-24, 30); c.lineTo(-24, -8); c.arc(0, -8, 24, Math.PI, 0); c.lineTo(24, 30);
    for (let i = 0; i < 4; i++) { const xx = 24 - (i + 1) * 12; c.quadraticCurveTo(xx + 6, 22 + (i % 2 ? 12 : 0), xx, 30); }
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2a2a3a'; c.beginPath(); c.ellipse(-8, -8, 4, 6, 0, 0, Math.PI * 2); c.ellipse(8, -8, 4, 6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, 6, 5, 4, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /** The mystery box: falls under a parachute, then sits glowing until someone grabs it. */
  private drawBox(x: number, y: number, state: number, left: number, sec: number) {
    const c = this.ctx;
    const h = state === 1 ? left * 260 : 0;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.25)';
    const sr = state === 1 ? 14 + (1 - left / 3) * 22 : 36;
    c.beginPath(); c.ellipse(x, y, sr, sr * 0.4, 0, 0, Math.PI * 2); c.fill();
    c.translate(x, y - h);
    if (state === 2) {
      const glow = 0.5 + 0.5 * Math.sin(sec * 5);
      c.fillStyle = `rgba(255,230,120,${0.25 + glow * 0.25})`; c.beginPath(); c.arc(0, -26, 48 + glow * 8, 0, Math.PI * 2); c.fill();
    } else {
      // parachute
      c.strokeStyle = '#eee'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-26, -50); c.lineTo(-48, -110); c.moveTo(26, -50); c.lineTo(48, -110); c.moveTo(0, -50); c.lineTo(0, -116); c.stroke();
      const sway = Math.sin(sec * 2) * 0.08;
      c.save(); c.rotate(sway);
      c.fillStyle = '#e8534a'; c.beginPath(); c.arc(0, -110, 56, Math.PI, 0); c.closePath(); c.fill();
      c.fillStyle = '#fff'; for (const a of [-0.75, 0.25]) { c.beginPath(); c.moveTo(0, -110); c.arc(0, -110, 56, Math.PI * (1 + a + 0.5) - 0.3, Math.PI * (1 + a + 0.5)); c.closePath(); c.fill(); }
      c.restore();
    }
    c.fillStyle = '#7a4ac9'; c.fillRect(-26, -52, 52, 48);
    c.fillStyle = '#9a6ae6'; c.fillRect(-26, -52, 52, 10);
    c.fillStyle = '#f2c23a'; c.fillRect(-5, -52, 10, 48); c.fillRect(-26, -32, 52, 8);
    c.strokeStyle = '#3d2170'; c.lineWidth = 3; c.strokeRect(-26, -52, 52, 48);
    c.font = '900 26px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
    c.lineWidth = 4; c.strokeStyle = '#3d2170'; c.strokeText('?', 0, -64); c.fillText('?', 0, -64);
    c.restore();
  }

  private drawGhost(gh: NonNullable<Overlay['ghost']>, sec: number) {
    const c = this.ctx, st = BUILD[gh.kind];
    const x0 = gh.tx * TILE, w = st.w * TILE, h = st.h * TILE;
    const ytop = this.flip ? this.WH - (gh.ty + st.h) * TILE : gh.ty * TILE;
    c.save();
    c.fillStyle = gh.ok ? 'rgba(120,230,120,.35)' : 'rgba(240,80,70,.4)';
    c.strokeStyle = gh.ok ? 'rgba(200,255,200,.95)' : 'rgba(255,170,160,.95)';
    c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -sec * 20;
    c.beginPath(); c.roundRect(x0 + 2, ytop + 2, w - 4, h - 4, 8); c.fill(); c.stroke();
    c.restore();
    c.save(); c.globalAlpha = 0.55;
    const fake: Bld = { id: -1, kind: BKINDS.indexOf(gh.kind), team: this.flip ? 1 : 0, x: x0 + w / 2, y: 0, hp: 100, owner: -1, variant: 0, tx: gh.tx, ty: gh.ty };
    this.drawBuilding(fake, gh.kind, ytop + h, performance.now(), { near: 0 } as Overlay);
    c.restore();
  }

  private bar(x: number, y: number, w: number, pct: number, color: string) {
    const c = this.ctx;
    c.fillStyle = 'rgba(20,20,30,.8)'; c.fillRect(x - w / 2 - 2, y - 2, w + 4, 9);
    c.fillStyle = color; c.fillRect(x - w / 2, y, w * Math.max(0, pct) / 100, 5);
  }

  minimap(cv: HTMLCanvasElement, myHero: number) {
    const c = cv.getContext('2d')!;
    const MW = this.W * TILE, MH = this.H * TILE;
    const sx = cv.width / MW, sy = cv.height / MH;
    c.fillStyle = WATER; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#9fbf55'; c.fillRect(TILE * sx, TILE * sy, (MW - 2 * TILE) * sx, (MH - 2 * TILE) * sy);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(TILE * sx, cv.height / 2 - 0.5, (MW - 2 * TILE) * sx, 1);
    const Y = (y: number) => this.vy(y) * sy;
    for (const b of this.blds.values()) {
      const k = BKINDS[b.kind], st = BUILD[k];
      const ytop = this.flip ? this.WH - b.y : b.y - st.h * TILE;
      c.fillStyle = k === 'heart' ? '#ff5d73' : k === 'goldblock' ? '#f2c23a' : RING[b.team];
      c.fillRect(b.tx * TILE * sx, ytop * sy, Math.max(2, st.w * TILE * sx), Math.max(2, st.h * TILE * sy));
    }
    for (const e of this.cur.values()) {
      if (UKINDS[e.kind] === 'sheep' || e.flags & 16) continue;
      const hero = UKINDS[e.kind] === 'hero';
      c.fillStyle = e.id === myHero ? '#fff' : RING[e.team];
      const r = hero ? 3 : 1.5;
      c.fillRect(e.x * sx - r, Y(e.y) - r, r * 2, r * 2);
    }
    const s = this.snap;
    if (s && s.box[0]) { c.fillStyle = '#c38bff'; c.fillRect(s.box[1] * sx - 3, Y(s.box[2]) - 3, 6, 6); }
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1;
    const vw = this.w / this.zoom, vh = this.h / this.zoom;
    c.strokeRect((this.camX - vw / 2) * sx, (this.camY - vh / 2) * sy, vw * sx, vh * sy);
  }
}

export { CLASSES, ENCHANTS, TAUNTS };
