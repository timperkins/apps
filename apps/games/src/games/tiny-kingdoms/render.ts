// Draws the island from snapshots with the Tiny Swords art by Pixel Frog.
import { ANIMS, BLACK, BUILD, BUILD_KINDS, COLORS, MH, MW, TILE, UNIT_KINDS, makeLand, rng, type Anim, type BuildKind, type Fx, type Snap, type UnitKind } from './game';

const urls = import.meta.glob('./assets/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const imgs = new Map<string, HTMLImageElement>();
/** Loads every picture once. */
export function loadArt(): Promise<void> {
  const all = Object.entries(urls).map(([path, url]) => new Promise<void>(res => {
    const key = path.replace('./assets/', '').replace('.png', '');
    if (imgs.has(key)) return res();
    const im = new Image();
    im.onload = () => res();
    im.onerror = () => res();
    im.src = url;
    imgs.set(key, im);
  }));
  return Promise.all(all).then(() => undefined);
}
export const artUrl = (key: string) => urls[`./assets/${key}.png`];
const img = (key: string) => imgs.get(key);

interface Sheet { file: string; n: number; fps: number; size: number; ax: number; ay: number; once?: boolean }
const S = (file: string, n: number, fps = 10, once = false, size = 192, ax = 96, ay = 132): Sheet => ({ file, n, fps, size, ax, ay, once });
const L = (file: string, n: number, fps = 10, once = false): Sheet => ({ file, n, fps, size: 320, ax: 160, ay: 196, once });

const SHEETS: Record<string, Sheet> = {
  'warrior.idle': S('warrior_idle', 8), 'warrior.run': S('warrior_run', 6, 12), 'warrior.attack': S('warrior_attack1', 4, 12, true),
  'warrior.attack2': S('warrior_attack2', 4, 12, true), 'warrior.guard': S('warrior_guard', 6, 8),
  'archer.idle': S('archer_idle', 6), 'archer.run': S('archer_run', 4), 'archer.shoot': S('archer_shoot', 8, 12, true),
  'pawn.idle': S('pawn_idle', 8), 'pawn.run': S('pawn_run', 6, 12), 'pawn.chop': S('pawn_axe', 6, 9), 'pawn.mine': S('pawn_pickaxe', 6, 9),
  'pawn.stab': S('pawn_knife', 4, 10, true), 'pawn.run.wood': S('pawn_run_wood', 6, 12), 'pawn.run.gold': S('pawn_run_gold', 6, 12), 'pawn.run.meat': S('pawn_run_meat', 6, 12),
  'lancer.idle': L('lancer_idle', 12), 'lancer.run': L('lancer_run', 6, 12),
  'lancer.right': L('lancer_right', 3, 9, true), 'lancer.upright': L('lancer_upright', 3, 9, true), 'lancer.downright': L('lancer_downright', 3, 9, true),
  'monk.idle': S('monk_idle', 6), 'monk.run': S('monk_run', 4), 'monk.heal': S('monk_heal', 11, 10, true),
  'sheep.idle': S('sheep_idle', 6, 8, false, 128, 64, 84), 'sheep.run': S('sheep_move', 4, 10, false, 128, 64, 84), 'sheep.graze': S('sheep_grass', 12, 8, false, 128, 64, 84),
};
const FX_SHEET: Sheet[] = [
  S('explosion1', 8, 14, true, 192, 96, 96), S('dust1', 8, 14, true, 64, 32, 40), S('heal', 11, 14, true, 192, 96, 110),
  S('water_splash', 9, 14, true, 192, 96, 96), S('explosion2', 10, 12, true, 192, 96, 110),
];

const WATER = '#47aba9';
const PLAYER_RING = ['#4b8ed9', '#d9534b', '#e0c341', '#a66ad1', '#333'];

interface Seen { seq: number; start: number }
interface Ent { id: number; kind: number; team: number; x: number; y: number; anim: number; seq: number; flags: number; hp: number; aim: number }

export interface Overlay {
  me: number; // my slot
  /** The building you're about to put down, where it would go. */
  ghost: { kind: BuildKind; tx: number; ty: number; ok: boolean } | null;
  nearBuilding: number; // id of a building you can use
  names: Map<number, string>; // hero id -> label
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private land: Uint8Array;
  private seed: number;
  private decor: { key: string; x: number; y: number; n: number; size: number; off: number }[] = [];
  private shoreTiles: number[] = [];
  private trees = new Map<number, { tx: number; ty: number; v: number; wood: number }>();
  private golds = new Map<number, { tx: number; ty: number; gold: number }>();
  private seen = new Map<number, Seen>();
  private prev = new Map<number, Ent>();
  private cur = new Map<number, Ent>();
  private snapAt = 0;
  private snapGap = 1000 / 12;
  private effects: { k: number; x: number; y: number; t: number }[] = [];
  /** When each tree or gold rock was last hit (by tile), for the shake. */
  private hits = new Map<number, number>();
  /** Chips and little logs or nuggets that fly off a hit. */
  private bits: { x: number; y: number; vx: number; vy: number; t: number; wood: boolean; icon: boolean }[] = [];
  snap: Snap | null = null;
  camX = 0; camY = 0; zoom = 1;
  private w = 0; private h = 0; private dpr = 1;

  constructor(canvas: HTMLCanvasElement, seed: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.seed = seed;
    this.land = makeLand(seed);
    this.makeDecor();
  }

  setNodes(n: { trees: number[][]; golds: number[][] }) {
    this.trees.clear(); this.golds.clear();
    for (const [id, tx, ty, v, wood] of n.trees) this.trees.set(id, { tx, ty, v, wood });
    for (const [id, tx, ty, gold] of n.golds) this.golds.set(id, { tx, ty, gold });
  }

  /** A new snapshot. `smooth` is for friends, who get one about 12 times a second. */
  push(s: Snap, now: number, smooth: boolean) {
    for (const [id, amt] of s.n) {
      const t = this.trees.get(id); if (t) { t.wood = amt; continue; }
      const g = this.golds.get(id); if (g) g.gold = amt;
    }
    for (const f of s.fx) {
      if (f[0] === 5 || f[0] === 6) this.nodeHit(f[0] === 5, f[1], f[2], now);
      else this.effects.push({ k: f[0], x: f[1], y: f[2], t: now });
    }
    if (smooth) { this.snapGap = Math.max(40, Math.min(250, now - this.snapAt)); this.prev = this.cur; }
    this.snapAt = now;
    const cur = new Map<number, Ent>();
    for (const e of s.e) {
      const ent: Ent = { id: e[0], kind: e[1], team: e[2], x: e[3], y: e[4], anim: e[5], seq: e[6], flags: e[7], hp: e[8], aim: e[9] };
      cur.set(ent.id, ent);
      const sn = this.seen.get(ent.id);
      if (!sn || sn.seq !== ent.seq) this.seen.set(ent.id, { seq: ent.seq, start: now });
    }
    if (!smooth) this.prev = cur;
    this.cur = cur;
    if (this.seen.size > cur.size * 2 + 200) for (const id of this.seen.keys()) if (!cur.has(id)) this.seen.delete(id);
    this.snap = s;
  }

  private nodeHit(tree: boolean, tx: number, ty: number, now: number) {
    // far off-screen hits (pawns across the map) only need the shake
    this.hits.set(ty * MW + tx, now);
    const x = (tx + 0.5) * TILE, y = (ty + (tree ? 0.2 : 0.4)) * TILE;
    if (Math.abs(x - this.camX) > 1400 || Math.abs(y - this.camY) > 1000) return;
    for (let i = 0; i < 5; i++) this.bits.push({ x, y: y + (tree ? -20 : 0), vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 160, t: now, wood: tree, icon: false });
    this.bits.push({ x, y: y - 40, vx: 0, vy: -70, t: now, wood: tree, icon: true });
    if (this.bits.length > 300) this.bits.splice(0, this.bits.length - 300);
  }
  /** Sideways wobble for a tree or rock that was just hit. */
  private shake(tx: number, ty: number, now: number) {
    const t = this.hits.get(ty * MW + tx);
    if (t === undefined) return 0;
    const a = (now - t) / 1000;
    if (a > 0.4) { this.hits.delete(ty * MW + tx); return 0; }
    return Math.sin(a * 55) * 6 * (1 - a / 0.4);
  }

  /** Where something is right now (smoothed between snapshots). */
  pos(id: number, now: number): { x: number; y: number } | null {
    const c = this.cur.get(id);
    if (!c) return null;
    const p = this.prev.get(id);
    if (!p || c.kind >= 100) return { x: c.x, y: c.y };
    const a = Math.min(1, (now - this.snapAt) / this.snapGap);
    if (Math.hypot(c.x - p.x, c.y - p.y) > 200) return { x: c.x, y: c.y };
    return { x: p.x + (c.x - p.x) * a, y: p.y + (c.y - p.y) * a };
  }
  ent(id: number) { return this.cur.get(id); }
  ents() { return this.cur.values(); }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    // about 13 tiles tall on any screen, a little closer on small ones
    this.zoom = Math.max(0.42, Math.min(1.1, Math.min(r.height / (13 * TILE), r.width / (15 * TILE))));
  }

  private makeDecor() {
    const r = rng(this.seed * 13 + 5);
    const L = this.land;
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < MW && y < MH && L[y * MW + x] === 1;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (at(x, y) && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))) this.shoreTiles.push(y * MW + x);
    }
    for (let i = 0; i < 600; i++) {
      const x = Math.floor(r() * MW), y = Math.floor(r() * MH), roll = r();
      const px = (x + 0.2 + r() * 0.6) * TILE, py = (y + 0.3 + r() * 0.5) * TILE;
      if (at(x, y) && at(x - 1, y) && at(x + 1, y) && at(x, y + 1) && at(x, y - 1)) {
        if (roll < 0.45) this.decor.push({ key: `terrain/bush${1 + Math.floor(r() * 4)}`, x: px, y: py, n: 8, size: 128, off: r() * 8 });
        else if (roll < 0.7) this.decor.push({ key: `terrain/rock${1 + Math.floor(r() * 4)}`, x: px, y: py, n: 1, size: 64, off: 0 });
      } else if (!at(x, y) && x > 0 && y > 0 && x < MW - 1 && y < MH - 1 && (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1) || r() < 0.2)) {
        if (roll < 0.25) this.decor.push({ key: `terrain/waterrock${1 + Math.floor(r() * 4)}`, x: px, y: py, n: 16, size: 64, off: r() * 16 });
      }
    }
    // one rubber duck, somewhere in the sea
    this.decor.push({ key: 'terrain/duck', x: 1.2 * TILE, y: (MH / 2 + 3) * TILE, n: 3, size: 32, off: 0 });
  }

  /** Tile from the 3 × 3 grass set (plus its one-wide strips), picked from which sides are water. */
  private grassTile(x: number, y: number): [number, number] {
    const at = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < MW && yy < MH && this.land[yy * MW + xx] === 1;
    const l = !at(x - 1, y), r = !at(x + 1, y), u = !at(x, y - 1), d = !at(x, y + 1);
    const col = l && r ? 3 : l ? 0 : r ? 2 : 1;
    const row = u && d ? 3 : u ? 0 : d ? 2 : 1;
    if (col === 3 && row === 3) return [3, 3];
    if (col === 3) return [3, row];
    if (row === 3) return [col, 3];
    return [col, row];
  }

  private sheetFor(e: Ent): Sheet | undefined {
    const kind = UNIT_KINDS[e.kind] as UnitKind;
    const anim = ANIMS[e.anim] as Anim;
    const k = kind === 'hero' || kind === 'fighter' ? 'warrior' : kind;
    if (k === 'pawn' && (e.flags & 6)) return SHEETS[`pawn.run.${['wood', 'gold', 'meat'][((e.flags >> 1) & 3) - 1]}`];
    if (k === 'lancer' && anim === 'attack') return SHEETS[e.aim < -60 ? 'lancer.upright' : e.aim > 60 ? 'lancer.downright' : 'lancer.right'];
    return SHEETS[`${k}.${anim}`] ?? SHEETS[`${k}.idle`];
  }

  private drawSheet(sh: Sheet, file: string, x: number, y: number, t: number, flip: boolean, scale = 1, alpha = 1) {
    let f = Math.floor(t * sh.fps);
    if (sh.once) f = Math.min(f, sh.n - 1); else f %= sh.n;
    const im = img(file);
    if (!im || !im.complete) return;
    const c = this.ctx;
    c.save();
    if (alpha < 1) c.globalAlpha = alpha;
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    c.drawImage(im, f * sh.size, 0, sh.size, sh.size, -sh.ax * scale, -sh.ay * scale, sh.size * scale, sh.size * scale);
    c.restore();
  }

  draw(now: number, o: Overlay, focus: { x: number; y: number }) {
    const c = this.ctx, z = this.zoom, s = this.snap;
    // camera eases toward the focus, kept inside the map
    const vw = this.w / z, vh = this.h / z;
    const tx = Math.max(vw / 2, Math.min(MW * TILE - vw / 2, focus.x)), ty = Math.max(vh / 2, Math.min(MH * TILE - vh / 2, focus.y - 30));
    if (!this.camX && !this.camY) { this.camX = tx; this.camY = ty; }
    this.camX += (tx - this.camX) * 0.15; this.camY += (ty - this.camY) * 0.15;
    const ox = Math.round(this.camX - vw / 2), oy = Math.round(this.camY - vh / 2);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = WATER;
    c.fillRect(0, 0, this.w, this.h);
    c.setTransform(this.dpr * z, 0, 0, this.dpr * z, -ox * z * this.dpr, -oy * z * this.dpr);
    const sec = now / 1000;
    const x0 = Math.max(0, Math.floor(ox / TILE) - 2), x1 = Math.min(MW - 1, Math.ceil((ox + vw) / TILE) + 2);
    const y0 = Math.max(0, Math.floor(oy / TILE) - 2), y1 = Math.min(MH - 1, Math.ceil((oy + vh) / TILE) + 3);
    const inView = (x: number, y: number, m = 200) => x > ox - m && x < ox + vw + m && y > oy - m && y < oy + vh + m * 1.5;

    // water rocks and the duck sit in the water, under the foam
    for (const d of this.decor) if (d.key.includes('water') || d.key.includes('duck')) {
      if (!inView(d.x, d.y)) continue;
      const im = img(d.key); if (!im) continue;
      const f = Math.floor(sec * 8 + d.off) % d.n;
      const bob = d.key.includes('duck') ? Math.sin(sec * 2) * 3 : 0;
      c.drawImage(im, f * d.size, 0, d.size, d.size, d.x - d.size / 2, d.y - d.size / 2 + bob, d.size, d.size);
    }
    // foam around the shore
    const foam = img('terrain/foam');
    if (foam) for (const i of this.shoreTiles) {
      const x = i % MW, y = (i / MW) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const f = (Math.floor(sec * 8) + x * 3 + y * 5) % 16;
      c.drawImage(foam, f * 192, 0, 192, 192, x * TILE - 64, y * TILE - 64, 192, 192);
    }
    // grass
    const tm = img('terrain/tilemap');
    if (tm) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.land[y * MW + x]) continue;
      const [tc, tr] = this.grassTile(x, y);
      c.drawImage(tm, tc * 64, tr * 64, 64, 64, x * TILE, y * TILE, TILE, TILE);
    }
    // flat things on the grass: rocks, bushes, building spots, rings under heroes
    for (const d of this.decor) if (!d.key.includes('water') && !d.key.includes('duck') && inView(d.x, d.y)) {
      const im = img(d.key); if (!im) continue;
      const f = Math.floor(sec * 7 + d.off) % d.n;
      c.drawImage(im, f * d.size, 0, d.size, d.size, d.x - d.size / 2, d.y - d.size * 0.6, d.size, d.size);
    }
    // everything that stands up, back to front
    type D = { y: number; f: () => void };
    const list: D[] = [];
    for (const t of this.trees.values()) {
      const px = (t.tx + 0.5) * TILE, py = (t.ty + 0.85) * TILE;
      if (!inView(px, py)) continue;
      const tall = t.v < 2;
      if (t.wood > 0) list.push({ y: py, f: () => {
        const im = img(`terrain/tree${t.v + 1}`);
        if (!im) return;
        const sh = this.shake(t.tx, t.ty, now), fr = (Math.floor(sec * 6 + t.tx * 0.7 + t.ty) % 8) * 192;
        c.drawImage(im, fr, 0, 192, tall ? 256 : 192, px - 96 + sh, py - (tall ? 232 : 166), 192, tall ? 256 : 192);
        if (sh) { c.save(); c.globalAlpha = 0.25 * Math.abs(sh) / 6; c.globalCompositeOperation = 'lighter'; c.drawImage(im, fr, 0, 192, tall ? 256 : 192, px - 96 + sh, py - (tall ? 232 : 166), 192, tall ? 256 : 192); c.restore(); }
      } });
      else list.push({ y: py - 30, f: () => { const im = img(`terrain/stump${t.v + 1}`); if (im) c.drawImage(im, px - 96, py - 226, 192, 256); } });
    }
    for (const g of this.golds.values()) {
      if (g.gold <= 0) continue;
      const px = (g.tx + 0.5) * TILE, py = (g.ty + 0.6) * TILE;
      if (!inView(px, py)) continue;
      const n = Math.max(1, Math.min(6, Math.ceil(g.gold / 14)));
      list.push({ y: py, f: () => { const im = img(`terrain/gold${n}`); if (im) c.drawImage(im, px - 64 + this.shake(g.tx, g.ty, now) * 0.6, py - 84, 128, 128); } });
    }
    for (const e of this.cur.values()) {
      const p = this.pos(e.id, now)!;
      if (!inView(p.x, p.y, 320)) continue;
      if (e.kind >= 100) list.push({ y: p.y, f: () => this.drawBuilding(e, now, o) });
      else list.push({ y: p.y, f: () => this.drawUnit(e, p.x, p.y, now, o) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();

    if (o.ghost) this.drawGhost(o.ghost, o.me, sec);
    // arrows
    const ar = img('fx/arrow');
    if (s && ar) for (const [x, y, a] of s.a) {
      if (!inView(x, y)) continue;
      c.save(); c.translate(x, y); c.rotate(a / 100); c.drawImage(ar, -32, -32, 64, 64); c.restore();
    }
    // chips and the little log or nugget that pops up
    const wood = img('ui/wood'), gold = img('ui/gold');
    this.bits = this.bits.filter(b => now - b.t < (b.icon ? 750 : 500));
    for (const b of this.bits) {
      const a = (now - b.t) / 1000;
      const x = b.x + b.vx * a, y = b.y + b.vy * a + (b.icon ? 0 : 700 * a * a);
      if (b.icon) {
        const im = b.wood ? wood : gold;
        if (!im) continue;
        c.save(); c.globalAlpha = Math.max(0, 1 - a / 0.75); c.drawImage(im, x - 18, y - 18, 36, 36); c.restore();
      } else {
        c.fillStyle = b.wood ? (b.vx > 0 ? '#c58b4a' : '#7a4a24') : (b.vx > 0 ? '#f6d14a' : '#a9a9a9');
        c.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    // effects
    this.effects = this.effects.filter(f => (now - f.t) / 1000 < FX_SHEET[f.k].n / FX_SHEET[f.k].fps);
    for (const f of this.effects) {
      const sh = FX_SHEET[f.k];
      this.drawSheet(sh, `fx/${sh.file}`, f.x, f.y, (now - f.t) / 1000, false, f.k === 4 ? 1.6 : 1);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawUnit(e: Ent, x: number, y: number, now: number, o: Overlay) {
    const c = this.ctx;
    const kind = UNIT_KINDS[e.kind] as UnitKind;
    const color = kind === 'sheep' ? '' : COLORS[e.team];
    const sh = this.sheetFor(e);
    if (!sh) return;
    const seen = this.seen.get(e.id);
    let t = seen ? (now - seen.start) / 1000 : 0;
    let use = sh;
    // a swing plays once, then back to standing
    if (sh.once && t > sh.n / sh.fps + 0.05) { use = this.sheetFor({ ...e, anim: 0 })!; t = now / 1000; }
    const scale = kind === 'hero' ? 1.15 : kind === 'fighter' ? 0.72 : 1;
    if (kind === 'hero') {
      c.save();
      c.fillStyle = PLAYER_RING[e.team] + '88'; c.strokeStyle = PLAYER_RING[e.team]; c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, y + 2, 30, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.restore();
    }
    const file = kind === 'sheep' ? `terrain/${use.file}` : `units/${color}/${use.file}`;
    this.drawSheet(use, file, x, y, t, !!(e.flags & 1), scale);
    // health bar when hurt
    if (e.hp < 100 && kind !== 'sheep') this.bar(x, y - (kind === 'lancer' ? 92 : kind === 'hero' ? 96 : 82), kind === 'hero' ? 56 : 40, e.hp, e.team === BLACK ? '#e04a3a' : '#5bd15b');
    const name = o.names.get(e.id);
    if (name) {
      c.save();
      c.font = '700 18px system-ui, sans-serif'; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(name, x, y - 104);
      c.fillStyle = '#fff'; c.fillText(name, x, y - 104);
      c.restore();
    }
  }

  private drawBuilding(e: Ent, now: number, o: Overlay) {
    const c = this.ctx;
    const kind = BUILD_KINDS[e.kind - 100] as BuildKind;
    if (kind === 'wall') {
      this.drawWall(e.x, e.y, e.team, 1);
      if (e.hp < 100) this.bar(e.x, e.y - 92, 44, e.hp, e.team === BLACK ? '#e04a3a' : '#5bd15b');
      return;
    }
    const size = this.drawBuildingArt(kind, e.team, e.x, e.y, e.seq);
    if (!size) return;
    const im = { width: size.w, height: size.h };
    if (e.id === o.nearBuilding) {
      c.save(); c.strokeStyle = 'rgba(255,240,170,.9)'; c.lineWidth = 4; c.setLineDash([12, 8]);
      const s = BUILD[kind];
      c.beginPath(); c.ellipse(e.x, e.y - 10, s.w * TILE * 0.6, 34, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    // burning when badly hurt
    if (e.hp < 50) {
      const sec = now / 1000;
      for (let i = 0; i < (e.hp < 25 ? 3 : 1); i++) {
        const fx = e.x + ((e.id * 37 + i * 61) % 100 - 50) * (im.width / 140), fy = e.y - im.height * 0.45 + ((i * 29) % 40);
        const fire = img(`fx/fire${1 + (i % 3)}`);
        const n = [8, 10, 12][i % 3];
        if (fire) c.drawImage(fire, (Math.floor(sec * 12 + i * 3) % n) * 64, 0, 64, 64, fx - 32, fy - 48, 64, 64);
      }
    }
    if (e.hp < 100) this.bar(e.x, e.y - im.height + 30, Math.min(160, im.width * 0.6), e.hp, e.team === BLACK ? '#e04a3a' : '#5bd15b');
  }

  /** Building art for a kind (mansions and double towers are made from the pack's houses and towers). Returns its size. */
  private drawBuildingArt(kind: BuildKind, team: number, x: number, y: number, seq = 0, alpha = 1) {
    const c = this.ctx, col = COLORS[team];
    c.save();
    if (alpha < 1) c.globalAlpha = alpha;
    let out: { w: number; h: number } | null = null;
    if (kind === 'mansion') {
      const im = img(`buildings/${col}/house3`);
      if (im) { const w = im.width * 1.6, h = im.height * 1.6; c.drawImage(im, x - w / 2, y - h + 12, w, h); out = { w, h }; }
    } else if (kind === 'tower2') {
      const im = img(`buildings/${col}/tower`);
      if (im) { for (const dx of [-56, 56]) c.drawImage(im, x + dx - im.width / 2, y - im.height + 8); out = { w: im.width + 112, h: im.height }; }
    } else if (kind === 'wall') {
      this.drawWall(x, y, team, alpha); out = { w: 64, h: 90 };
    } else {
      const im = img(kind === 'house' ? `buildings/${col}/house${(seq % 3) + 1}` : `buildings/${col}/${kind}`);
      if (im) { c.drawImage(im, x - im.width / 2, y - im.height + 8); out = { w: im.width, h: im.height }; }
    }
    c.restore();
    return out;
  }

  /** A little stone wall block in the castle colors, with the kingdom's color on top. */
  private drawWall(x: number, y: number, team: number, alpha: number) {
    const c = this.ctx;
    const trim = ['#3f86a8', '#c4544a', '#d0a93a', '#8f5bb0', '#4a4a5a'][team] ?? '#888';
    c.save();
    if (alpha < 1) c.globalAlpha = alpha;
    const x0 = x - 32, top = y - 84;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x0 + 4, y - 8, 64, 10);
    c.fillStyle = '#2a2a3a'; c.fillRect(x0, top + 14, 64, 72);
    c.fillStyle = '#d9cca4'; c.fillRect(x0 + 3, top + 17, 58, 52);
    c.fillStyle = '#9c917a'; c.fillRect(x0 + 3, top + 69, 58, 14);
    c.strokeStyle = '#a89c7c'; c.lineWidth = 2;
    c.beginPath();
    for (const ry of [30, 43, 56]) { c.moveTo(x0 + 3, top + ry); c.lineTo(x0 + 61, top + ry); }
    for (const [ry, xs] of [[17, [22, 44]], [30, [12, 34, 54]], [43, [22, 44]], [56, [12, 34, 54]]] as [number, number[]][])
      for (const bx of xs) { c.moveTo(x0 + bx, top + ry); c.lineTo(x0 + bx, top + ry + 13); }
    c.stroke();
    // battlements in the kingdom's color
    c.fillStyle = '#2a2a3a';
    for (const mx of [0, 24, 46]) c.fillRect(x0 + mx, top, 18, 18);
    c.fillStyle = trim;
    for (const mx of [0, 24, 46]) c.fillRect(x0 + mx + 3, top + 3, 12, 13);
    c.restore();
  }

  private drawGhost(gh: NonNullable<Overlay['ghost']>, me: number, sec: number) {
    const c = this.ctx, st = BUILD[gh.kind];
    const x0 = gh.tx * TILE, y0 = gh.ty * TILE, w = st.w * TILE, h = st.h * TILE;
    c.save();
    c.fillStyle = gh.ok ? 'rgba(120,230,120,.35)' : 'rgba(240,80,70,.4)';
    c.strokeStyle = gh.ok ? 'rgba(200,255,200,.95)' : 'rgba(255,170,160,.95)';
    c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -sec * 20;
    c.beginPath(); c.roundRect(x0 + 2, y0 + 2, w - 4, h - 4, 8); c.fill(); c.stroke();
    c.restore();
    this.drawBuildingArt(gh.kind, me, x0 + w / 2, y0 + h, 0, 0.55);
  }

  /** What's on a tile for building, from what this player can see: 0 open, 1 water, 2 building, 3 tree or gold. */
  tileCode(x: number, y: number) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || !this.land[y * MW + x]) return 1;
    for (const e of this.cur.values()) {
      if (e.kind < 100) continue;
      const s = BUILD[BUILD_KINDS[e.kind - 100]];
      const bx0 = Math.floor((e.x - s.w * TILE / 2 + 8) / TILE), bx1 = Math.floor((e.x + s.w * TILE / 2 - 9) / TILE);
      const by0 = Math.floor((e.y - s.h * TILE + 4) / TILE), by1 = Math.floor((e.y - 7) / TILE);
      if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) return 2;
    }
    for (const t of this.trees.values()) if (t.wood > 0 && t.tx === x && t.ty === y) return 3;
    for (const g of this.golds.values()) if (g.gold > 0 && g.tx === x && g.ty === y) return 3;
    return 0;
  }

  private bar(x: number, y: number, w: number, pct: number, color: string) {
    const c = this.ctx;
    c.fillStyle = 'rgba(20,20,30,.8)'; c.fillRect(x - w / 2 - 2, y - 2, w + 4, 9);
    c.fillStyle = color; c.fillRect(x - w / 2, y, w * Math.max(0, pct) / 100, 5);
  }

  /** The little map in the corner. */
  minimap(cv: HTMLCanvasElement, me: number) {
    const c = cv.getContext('2d')!;
    const sx = cv.width / (MW * TILE), sy = cv.height / (MH * TILE);
    c.fillStyle = WATER; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#9fbf55';
    const tw = cv.width / MW, th = cv.height / MH;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (this.land[y * MW + x]) c.fillRect(x * tw, y * th, tw + 0.5, th + 0.5);
    c.fillStyle = '#2f6b45';
    for (const t of this.trees.values()) if (t.wood > 0) c.fillRect(t.tx * tw, t.ty * th, tw, th);
    c.fillStyle = '#f2c23a';
    for (const g of this.golds.values()) if (g.gold > 0) c.fillRect(g.tx * tw, g.ty * th, tw, th);
    for (const e of this.cur.values()) {
      if (e.kind >= 100) {
        const s = BUILD[BUILD_KINDS[e.kind - 100]];
        c.fillStyle = PLAYER_RING[e.team];
        c.fillRect((e.x - s.w * 32) * sx, (e.y - s.h * 64) * sy, Math.max(3, s.w * 64 * sx), Math.max(3, s.h * 64 * sy));
      } else if (UNIT_KINDS[e.kind] !== 'sheep') {
        const hero = UNIT_KINDS[e.kind] === 'hero';
        c.fillStyle = hero && e.team === me ? '#fff' : PLAYER_RING[e.team];
        const r = hero ? 3 : 1.5;
        c.fillRect(e.x * sx - r, e.y * sy - r, r * 2, r * 2);
      }
    }
    // the view box
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1;
    const vw = this.w / this.zoom, vh = this.h / this.zoom;
    c.strokeRect((this.camX - vw / 2) * sx, (this.camY - vh / 2) * sy, vw * sx, vh * sy);
  }

  /** The screen point for a world point (for hints that float over things). */
  toScreen(x: number, y: number) {
    const vw = this.w / this.zoom, vh = this.h / this.zoom;
    return { x: (x - (this.camX - vw / 2)) * this.zoom, y: (y - (this.camY - vh / 2)) * this.zoom };
  }
}

export type { Fx };
