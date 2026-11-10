import { css, dirIndex, hash2, rng } from '../gfx';
import {
  BuildingArt,
  BuildingKind,
  DIRS,
  FACTIONS,
  FactionArt,
  RotSprite,
  makeBuilding,
  makeBushes,
  makeFactionArt,
  makeRocks,
  makeTrees,
} from './sprites';
import { K, Rect, Terrain } from './terrain';

export type UnitKind = 'light' | 'heavy' | 'buggy' | 'hauler' | 'arty' | 'boat' | 'heli' | 'inf' | 'rocket';

const STATS: Record<UnitKind, { name: string; speed: number; turn: number; r: number; hp: number }> = {
  light: { name: 'Lancer tank', speed: 24, turn: 3.2, r: 7, hp: 0.8 },
  heavy: { name: 'Bastion tank', speed: 14, turn: 2, r: 9, hp: 1 },
  buggy: { name: 'Scout buggy', speed: 40, turn: 5, r: 6, hp: 0.6 },
  hauler: { name: 'Ore hauler', speed: 13, turn: 1.8, r: 9, hp: 0.9 },
  arty: { name: 'Howler artillery', speed: 13, turn: 2, r: 8, hp: 0.7 },
  boat: { name: 'Patrol boat', speed: 20, turn: 1.6, r: 10, hp: 0.85 },
  heli: { name: 'Kestrel copter', speed: 34, turn: 3, r: 9, hp: 0.75 },
  inf: { name: 'Rifleman', speed: 9, turn: 99, r: 4, hp: 1 },
  rocket: { name: 'Rocketeer', speed: 8, turn: 99, r: 4, hp: 0.9 },
};

interface Unit {
  kind: UnitKind;
  f: number;
  x: number;
  y: number;
  a: number;
  turret: number;
  turretGoal: number;
  tx: number;
  ty: number;
  moving: boolean;
  sel: boolean;
  anim: number;
  hp: number;
  idle: number;
  trackAcc: number;
}

interface Building {
  kind: BuildingKind;
  f: number;
  x: number;
  y: number;
  art: BuildingArt;
  phase: number;
  gun: number;
  gunGoal: number;
}

interface Prop {
  img: HTMLCanvasElement;
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: 'smoke' | 'wake' | 'dust';
  size: number;
}

interface Marker {
  x: number;
  y: number;
  t: number;
}

const BASE_A: BuildingKind[] = ['hq', 'factory', 'power', 'barracks', 'refinery', 'radar', 'power', 'helipad', 'silo', 'tower', 'tower', 'tower'];
const BASE_B: BuildingKind[] = ['hq', 'power', 'factory', 'barracks', 'refinery', 'silo', 'radar', 'tower', 'tower', 'helipad', 'power'];

const WIN_LIT = '#e8d77c';

export class Game {
  terrain!: Terrain;
  units: Unit[] = [];
  buildings: Building[] = [];
  props: Prop[] = [];
  particles: Particle[] = [];
  markers: Marker[] = [];
  sparkles: { x: number; y: number; life: number }[] = [];
  art: FactionArt[];
  bArt = new Map<string, BuildingArt>();
  trees = makeTrees();
  rocks = makeRocks();
  bushes = makeBushes();
  time = 0;
  box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  onSelect: (names: string[]) => void = () => {};

  private emit(): void {
    this.onSelect(this.selected().map((u) => STATS[u.kind].name));
  }

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    public seed: number,
  ) {
    this.art = FACTIONS.map(makeFactionArt);
  }

  get w(): number {
    return this.terrain.w;
  }
  get h(): number {
    return this.terrain.h;
  }

  generate(w: number, h: number): void {
    const rand = rng(this.seed * 7919 + 13);
    this.terrain = new Terrain(w, h, this.seed);
    this.units = [];
    this.buildings = [];
    this.props = [];
    this.particles = [];
    this.markers = [];
    this.sparkles = [];

    // Bases: Cobalt in the upper-left half, Ember towards the right.
    const padRects: Rect[] = [];
    const bodies: Rect[] = [];
    const place = (kinds: BuildingKind[], f: number, cx: number, cy: number) => {
      for (const kind of kinds) {
        const art = this.buildingArt(kind, f);
        let placed = false;
        for (let ring = 0; ring < 60 && !placed; ring++) {
          const tries = ring === 0 ? 1 : 10 + ring * 2;
          for (let t = 0; t < tries && !placed; t++) {
            const ang = rand() * Math.PI * 2;
            const dist = ring * 4;
            const x = Math.round(cx + Math.cos(ang) * dist * 1.4);
            const y = Math.round(cy + Math.sin(ang) * dist);
            const pad = { x: x + art.pad.x, y: y + art.pad.y, w: art.pad.w, h: art.pad.h };
            const body = { x: x - art.w / 2, y: y - art.h, w: art.w, h: art.h };
            // building art must fit on-screen too
            if (y - art.h < 2 || x - art.w / 2 < 2 || x + art.w / 2 > w - 2 || y + 6 > h) continue;
            if (!this.terrain.clear(pad, 2)) continue;
            if (bodies.some((p) => overlap(p, body, 4))) continue;
            bodies.push(body);
            padRects.push(pad);
            this.terrain.markPad(pad);
            this.buildings.push({ kind, f, x, y, art, phase: rand() * 10, gun: rand() * Math.PI * 2, gunGoal: rand() * Math.PI * 2 });
            placed = true;
          }
        }
      }
    };
    const portrait = h > w * 1.1;
    const area = (w * h) / (640 * 360);
    const take = (list: BuildingKind[]) => list.slice(0, Math.max(5, Math.round(list.length * Math.min(1, area * 1.1))));
    place(take(BASE_A), 0, w * (portrait ? 0.32 : 0.24), h * (portrait ? 0.2 : 0.42));
    place(take(BASE_B), 1, w * (portrait ? 0.5 : 0.74), h * (portrait ? 0.56 : 0.28));

    // Trees, rocks and bushes
    const forestSeed = this.seed + 400;
    for (let y = 4; y < h + 10; y += 5)
      for (let x = 2; x < w; x += 5) {
        const jx = x + Math.floor(hash2(x, y, forestSeed) * 5);
        const jy = y + Math.floor(hash2(y, x, forestSeed) * 5);
        const k = this.terrain.k(jx, jy);
        if (k !== K.Grass || jy >= h + 4) continue;
        if (padRects.some((p) => inside(jx, jy, p, 6))) continue;
        const forest = (this.forestValue(jx, jy) - 0.55) * 3;
        const roll = hash2(jx, jy, forestSeed + 1);
        if (roll < forest) {
          this.props.push({ img: this.trees[Math.floor(hash2(jx, jy, 3) * 4.99)], x: jx, y: jy });
        } else if (roll < 0.012) {
          this.props.push({ img: this.trees[4 + Math.floor(hash2(jx, jy, 4) * 1.99)], x: jx, y: jy });
        } else if (roll < 0.03) {
          this.props.push({ img: this.bushes[Math.floor(hash2(jx, jy, 5) * 2.99)], x: jx, y: jy });
        } else if (roll < 0.033 || (this.terrain.k(jx - 3, jy) === K.Cliff && roll < 0.2)) {
          this.props.push({ img: this.rocks[Math.floor(hash2(jx, jy, 6) * 3.99)], x: jx, y: jy });
        }
      }

    this.terrain.paint();

    // Units near each base
    const spawn = (kind: UnitKind, f: number, cx: number, cy: number, spread: number) => {
      for (let t = 0; t < 200; t++) {
        const x = cx + (rand() - 0.5) * spread * 2;
        const y = cy + (rand() - 0.5) * spread * 1.4;
        const k = this.terrain.k(x, y);
        const ok = kind === 'boat' ? k === K.Water && this.terrain.k(x + 10, y) === K.Water && this.terrain.k(x - 10, y) === K.Water : kind === 'heli' ? true : k === K.Grass || k === K.Road || k === K.Pad;
        if (!ok || x < 8 || y < 10 || x > w - 8 || y > h - 6) continue;
        if (kind !== 'heli' && this.buildings.some((b) => inside(x, y, { x: b.x - b.art.w / 2, y: b.y - b.art.h, w: b.art.w, h: b.art.h }, 2))) continue;
        const a = rand() * Math.PI * 2;
        this.units.push({ kind, f, x, y, a, turret: a, turretGoal: a, tx: x, ty: y, moving: false, sel: false, anim: rand() * 10, hp: STATS[kind].hp, idle: rand() * 4, trackAcc: 0 });
        return;
      }
    };
    const n = (k: number) => Math.max(1, Math.round(k * Math.min(1.4, Math.max(0.5, area))));
    const army: [UnitKind, number][] = [
      ['light', 4],
      ['heavy', 2],
      ['buggy', 2],
      ['hauler', 1],
      ['arty', 1],
      ['heli', 1],
      ['inf', 6],
      ['rocket', 3],
    ];
    const spreadR = Math.min(w, h) * 0.22;
    const centres: [number, number][] = portrait
      ? [
          [w * 0.4, h * 0.36],
          [w * 0.4, h * 0.72],
        ]
      : [
          [w * 0.3, h * 0.6],
          [w * 0.62, h * 0.45],
        ];
    for (let f = 0; f < 2; f++) for (const [kind, c] of army) for (let i = 0; i < n(c); i++) spawn(kind, f, centres[f][0], centres[f][1], spreadR);
    for (let f = 0; f < 2; f++) for (let i = 0; i < n(1); i++) spawn('boat', f, w * 0.85, h * 0.85, Math.min(w, h) * 0.3);
    this.emit();
  }

  private forestValue(x: number, y: number): number {
    // reuse the terrain noise style: clumps of forest
    let v = 0;
    let amp = 0.5;
    let f = 1 / 60;
    let norm = 0;
    for (let i = 0; i < 3; i++) {
      v += amp * smoothNoise(x * f, y * f, this.seed + 500 + i);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return v / norm;
  }

  private buildingArt(kind: BuildingKind, f: number): BuildingArt {
    const key = `${kind}-${f}`;
    let a = this.bArt.get(key);
    if (!a) {
      a = makeBuilding(kind, FACTIONS[f]);
      this.bArt.set(key, a);
    }
    return a;
  }

  // ---------- Input ----------

  unitAt(x: number, y: number): Unit | null {
    let best: Unit | null = null;
    let bd = 1e9;
    for (const u of this.units) {
      const uy = u.kind === 'heli' ? u.y - 12 : u.y;
      const d = Math.hypot(u.x - x, uy - y);
      if (d < STATS[u.kind].r + 3 && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  click(x: number, y: number, add: boolean): void {
    const u = this.unitAt(x, y);
    if (u) {
      if (!add) for (const o of this.units) o.sel = false;
      u.sel = add ? !u.sel : true;
      this.emit();
      return;
    }
    this.order(x, y);
  }

  order(x: number, y: number): void {
    const sel = this.selected();
    if (!sel.length) return;
    this.markers.push({ x, y, t: 0 });
    // Simple formation: grid slots around the target, nearest unit to nearest slot.
    const cols = Math.ceil(Math.sqrt(sel.length));
    const gap = 13;
    const slots: [number, number][] = [];
    for (let i = 0; i < sel.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push([x + (c - (cols - 1) / 2) * gap, y + (r - (Math.ceil(sel.length / cols) - 1) / 2) * gap]);
    }
    const left = [...sel];
    for (const [sx, sy] of slots.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y))) {
      let bi = 0;
      let bd = 1e9;
      left.forEach((u, i) => {
        const d = Math.hypot(u.x - sx, u.y - sy);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const u = left.splice(bi, 1)[0];
      u.tx = sx;
      u.ty = u.kind === 'heli' ? sy + 12 : sy;
      u.moving = true;
    }
  }

  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void {
    const minx = Math.min(x0, x1);
    const maxx = Math.max(x0, x1);
    const miny = Math.min(y0, y1);
    const maxy = Math.max(y0, y1);
    for (const u of this.units) {
      const uy = u.kind === 'heli' ? u.y - 12 : u.y;
      const hit = u.x >= minx - 2 && u.x <= maxx + 2 && uy >= miny - 2 && uy <= maxy + 2;
      if (hit) u.sel = true;
      else if (!add) u.sel = false;
    }
    this.emit();
  }

  deselect(): void {
    for (const u of this.units) u.sel = false;
    this.emit();
  }

  selected(): Unit[] {
    return this.units.filter((u) => u.sel);
  }

  // ---------- Simulation ----------

  update(dt: number): void {
    this.time += dt;
    const tctx = this.terrain.ctx;
    for (const u of this.units) {
      const st = STATS[u.kind];
      u.anim += dt;
      if (u.moving) {
        const dx = u.tx - u.x;
        const dy = u.ty - u.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.8) {
          u.moving = false;
          u.x = u.tx;
          u.y = u.ty;
        } else {
          const want = Math.atan2(dy, dx);
          let diff = angDiff(want, u.a);
          const step = st.turn * dt;
          if (Math.abs(diff) <= step) u.a = want;
          else u.a += Math.sign(diff) * step;
          diff = angDiff(want, u.a);
          const isFoot = u.kind === 'inf' || u.kind === 'rocket';
          const go = isFoot || u.kind === 'heli' ? 1 : Math.max(0, Math.cos(diff) - 0.4) / 0.6;
          const sp = Math.min(dist, st.speed * dt * go);
          const mx = isFoot || u.kind === 'heli' ? Math.cos(want) : Math.cos(u.a);
          const my = isFoot || u.kind === 'heli' ? Math.sin(want) : Math.sin(u.a);
          u.x += mx * sp;
          u.y += my * sp;
          u.trackAcc += sp;
          // tread marks, boat wakes and dust
          if (u.trackAcc > 1.5) {
            u.trackAcc = 0;
            const k = this.terrain.k(u.x, u.y);
            if (u.kind === 'boat') {
              this.particles.push({ x: u.x - Math.cos(u.a) * 11, y: u.y - Math.sin(u.a) * 11, vx: 0, vy: 0, life: 0, max: 1.4, kind: 'wake', size: 1 });
            } else if (!isFoot && u.kind !== 'heli' && k !== K.Water) {
              const hw = u.kind === 'heavy' ? 6 : u.kind === 'buggy' ? 3.5 : 4.5;
              const px = -Math.sin(u.a) * hw;
              const py = Math.cos(u.a) * hw;
              tctx.fillStyle = k === K.Road || k === K.Sand ? 'rgba(60,45,25,0.18)' : 'rgba(30,25,15,0.14)';
              tctx.fillRect(Math.round(u.x + px), Math.round(u.y + py), 1, 1);
              tctx.fillRect(Math.round(u.x - px), Math.round(u.y - py), 1, 1);
              if ((k === K.Road || k === K.Sand) && Math.random() < 0.35)
                this.particles.push({ x: u.x - Math.cos(u.a) * 7, y: u.y - Math.sin(u.a) * 7, vx: (Math.random() - 0.5) * 4, vy: -3, life: 0, max: 0.8, kind: 'dust', size: 1 });
            }
          }
        }
      }
      // turrets: follow the hull while moving, scan lazily when idle
      if (u.kind === 'light' || u.kind === 'heavy') {
        if (u.moving) u.turretGoal = u.a;
        else {
          u.idle -= dt;
          if (u.idle <= 0) {
            u.idle = 2 + Math.random() * 5;
            u.turretGoal = u.a + (Math.random() - 0.5) * 2.4;
          }
        }
        const d = angDiff(u.turretGoal, u.turret);
        u.turret += Math.sign(d) * Math.min(Math.abs(d), 2.2 * dt);
      }
    }

    for (const b of this.buildings) {
      b.phase += dt;
      if (b.kind === 'power' && Math.random() < dt * 5) {
        const stack = Math.random() < 0.5 ? 13 : 33;
        this.particles.push({ x: b.x - b.art.w / 2 + stack + (Math.random() - 0.5) * 6, y: b.y - b.art.h + 6, vx: 3 + Math.random() * 3, vy: -6 - Math.random() * 4, life: 0, max: 2.5 + Math.random(), kind: 'smoke', size: 1.5 });
      }
      if (b.kind === 'tower') {
        if (Math.random() < dt * 0.3) b.gunGoal = Math.random() * Math.PI * 2;
        const d = angDiff(b.gunGoal, b.gun);
        b.gun += Math.sign(d) * Math.min(Math.abs(d), 1.4 * dt);
      }
    }

    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') p.size += dt * 1.6;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter((m) => m.t < 0.7);

    // water sparkles
    const want = Math.floor((this.w * this.h) / 2500);
    for (let i = 0; i < 4 && this.sparkles.length < want; i++) {
      const x = Math.floor(Math.random() * this.w);
      const y = Math.floor(Math.random() * this.h);
      if (this.terrain.k(x, y) === K.Water && this.terrain.k(x, y - 3) === K.Water) this.sparkles.push({ x, y, life: 0 });
    }
    for (const s of this.sparkles) s.life += dt;
    this.sparkles = this.sparkles.filter((s) => s.life < 1.2);
  }

  // ---------- Rendering ----------

  render(): void {
    const c = this.ctx;
    const t = this.time;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#263f1e';
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.drawImage(this.terrain.canvas, 0, 0);

    // shimmering shoreline foam
    c.globalAlpha = 0.45 + 0.35 * Math.sin(t * 1.6);
    c.drawImage(this.terrain.foam, 0, 0);
    c.globalAlpha = 0.35 + 0.3 * Math.sin(t * 1.6 + 2.2);
    c.drawImage(this.terrain.foam2, 0, 0);
    c.globalAlpha = 1;
    for (const s of this.sparkles) {
      const a = Math.sin((s.life / 1.2) * Math.PI);
      c.fillStyle = `rgba(220,240,250,${a * 0.85})`;
      c.fillRect(s.x, s.y, 2, 1);
    }

    // wakes sit on the water surface
    for (const p of this.particles) {
      if (p.kind !== 'wake') continue;
      const k = p.life / p.max;
      c.fillStyle = `rgba(225,240,245,${0.7 * (1 - k)})`;
      const r = 1 + k * 5;
      c.fillRect(Math.round(p.x - r), Math.round(p.y), 1, 1);
      c.fillRect(Math.round(p.x + r), Math.round(p.y), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y - r * 0.6), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y + r * 0.6), 1, 1);
    }

    // move markers
    for (const m of this.markers) {
      const k = m.t / 0.7;
      const r = Math.round(7 - k * 5);
      c.fillStyle = `rgba(120,255,120,${1 - k * 0.6})`;
      corners(c, Math.round(m.x), Math.round(m.y), r, r, 2);
    }

    // ground shadows of aircraft
    for (const u of this.units) {
      if (u.kind !== 'heli') continue;
      const spr = this.art[u.f].heli.body;
      const di = dirIndex(u.a, DIRS);
      c.drawImage(spr.shadow[di], Math.round(u.x - spr.size / 2 + 4), Math.round(u.y - spr.size / 2 + 2));
    }

    // depth-sorted ground objects
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const p of this.props) items.push({ y: p.y, draw: () => c.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y - p.img.height + 2)) });
    for (const b of this.buildings) items.push({ y: b.y - 4, draw: () => this.drawBuilding(b) });
    for (const u of this.units) if (u.kind !== 'heli') items.push({ y: u.y, draw: () => this.drawUnit(u) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // smoke and dust drift above the ground objects
    for (const p of this.particles) {
      if (p.kind === 'wake') continue;
      const k = p.life / p.max;
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle = p.kind === 'smoke' ? `rgba(215,215,210,${0.55 * (1 - k)})` : `rgba(160,140,100,${0.5 * (1 - k)})`;
      c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }

    // aircraft on top
    for (const u of this.units) if (u.kind === 'heli') this.drawUnit(u);

    // drag box
    if (this.box) {
      const { x0, y0, x1, y1 } = this.box;
      const x = Math.round(Math.min(x0, x1));
      const y = Math.round(Math.min(y0, y1));
      const w = Math.round(Math.abs(x1 - x0));
      const h = Math.round(Math.abs(y1 - y0));
      c.fillStyle = 'rgba(140,255,140,0.12)';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#9dff9d';
      c.fillRect(x, y, w, 1);
      c.fillRect(x, y + h, w + 1, 1);
      c.fillRect(x, y, 1, h);
      c.fillRect(x + w, y, 1, h);
    }
  }

  private drawRot(spr: RotSprite, x: number, y: number, a: number, shadow = true): void {
    const di = dirIndex(a, DIRS);
    const ox = Math.round(x - spr.size / 2);
    const oy = Math.round(y - spr.size / 2);
    if (shadow) this.ctx.drawImage(spr.shadow[di], ox + 1, oy + 2);
    this.ctx.drawImage(spr.img[di], ox, oy);
  }

  private drawUnit(u: Unit): void {
    const c = this.ctx;
    const art = this.art[u.f];
    const st = STATS[u.kind];
    let topY = u.y - st.r;
    switch (u.kind) {
      case 'inf':
      case 'rocket': {
        const frames = u.kind === 'inf' ? art.infantry : art.rocket;
        const dx = Math.cos(u.a);
        const dy = Math.sin(u.a);
        const dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? 2 : dy > 0 ? 0 : 1;
        const fr = u.moving ? 1 + (Math.floor(u.anim * 7) % 2) : 0;
        const img = frames[dir][fr];
        const x = Math.round(u.x - 4);
        const y = Math.round(u.y - 10);
        if (dir === 2 && dx < 0) {
          c.save();
          c.translate(x + 9, y);
          c.scale(-1, 1);
          c.drawImage(img, 0, 0);
          c.restore();
        } else c.drawImage(img, x, y);
        topY = u.y - 11;
        break;
      }
      case 'light':
      case 'heavy': {
        const v = art[u.kind === 'light' ? 'lightTank' : 'heavyTank'];
        this.drawRot(v.body, u.x, u.y, u.a);
        this.drawRot(v.turret!, u.x - Math.cos(u.a) * 1, u.y - Math.sin(u.a) * 1 - 1, u.turret, false);
        break;
      }
      case 'heli': {
        const alt = 12 + Math.sin(u.anim * 2) * 1.2;
        const y = u.y - alt;
        this.drawRot(art.heli.body, u.x, y, u.a, false);
        // spinning rotor blades
        const ra = u.anim * 28;
        const L = 11;
        c.fillStyle = 'rgba(30,30,30,0.55)';
        for (let b = 0; b < 2; b++) {
          const ang = ra + b * Math.PI * 0.5;
          pxLine(c, u.x + 1.5 * Math.cos(u.a) - Math.cos(ang) * L, y + 1.5 * Math.sin(u.a) - Math.sin(ang) * L * 0.8, u.x + 1.5 * Math.cos(u.a) + Math.cos(ang) * L, y + 1.5 * Math.sin(u.a) + Math.sin(ang) * L * 0.8);
        }
        c.fillStyle = '#222';
        c.fillRect(Math.round(u.x + 1.5 * Math.cos(u.a)), Math.round(y + 1.5 * Math.sin(u.a)), 1, 1);
        topY = y - 9;
        break;
      }
      case 'boat': {
        const bob = Math.sin(u.anim * 2.2) * 0.6;
        this.drawRot(art.boat.body, u.x, u.y + bob, u.a, false);
        break;
      }
      default: {
        const key = u.kind === 'buggy' ? 'buggy' : u.kind === 'hauler' ? 'hauler' : 'artillery';
        this.drawRot(art[key].body, u.x, u.y, u.a);
      }
    }
    if (u.sel) {
      const r = st.r + 1;
      const cy = u.kind === 'heli' ? topY + 9 : u.kind === 'inf' || u.kind === 'rocket' ? u.y - 5 : u.y;
      c.fillStyle = '#ffffff';
      corners(c, Math.round(u.x), Math.round(cy), r, u.kind === 'inf' || u.kind === 'rocket' ? 7 : r, 2);
      // health pips
      const bw = Math.max(8, r * 2);
      const bx = Math.round(u.x - bw / 2);
      const by = Math.round(cy - (u.kind === 'inf' || u.kind === 'rocket' ? 7 : r) - 4);
      c.fillStyle = '#111';
      c.fillRect(bx - 1, by - 1, bw + 2, 4);
      const fill = Math.round(bw * u.hp);
      c.fillStyle = u.hp > 0.66 ? '#5ee05e' : u.hp > 0.33 ? '#e8d24a' : '#e85a4a';
      c.fillRect(bx, by, fill, 2);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 3; i < bw; i += 3) c.fillRect(bx + i, by, 1, 2);
    }
  }

  private drawBuilding(b: Building): void {
    const c = this.ctx;
    const ox = Math.round(b.x - b.art.w / 2);
    const oy = Math.round(b.y - b.art.h);
    // soft shadow to the bottom-right
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(ox + 4, oy + Math.round(b.art.h * 0.3), b.art.w - 2, Math.round(b.art.h * 0.7));
    c.drawImage(b.art.img, ox, oy);
    const f = FACTIONS[b.f];
    switch (b.kind) {
      case 'hq':
        if (Math.floor(b.phase * 1.5) % 2 === 0) {
          c.fillStyle = '#ff5a3c';
          c.fillRect(ox + 35, oy, 1, 1);
          c.fillStyle = 'rgba(255,90,60,0.35)';
          c.fillRect(ox + 34, oy - 1, 3, 3);
        }
        break;
      case 'radar': {
        const s = Math.cos(b.phase * 1.8);
        const half = Math.max(1, Math.round(Math.abs(s) * 6));
        const cx = ox + 18;
        const cy = oy + 5;
        c.fillStyle = '#20262a';
        c.fillRect(cx - half - 1, cy - 3, half * 2 + 2, 6);
        c.fillStyle = s > 0 ? '#c8cfd1' : '#8a9295';
        c.fillRect(cx - half, cy - 2, half * 2, 4);
        c.fillStyle = s > 0 ? '#e9eef0' : '#a3abae';
        c.fillRect(cx - half, cy - 2, half * 2, 1);
        c.fillStyle = css(f.light);
        c.fillRect(cx, cy - 1, 1, 2);
        break;
      }
      case 'barracks': {
        const px = ox + 37;
        const py = oy;
        c.fillStyle = '#2a2c2e';
        c.fillRect(px, py, 1, 22);
        const wave = Math.floor(b.phase * 4) % 3;
        for (let i = 0; i < 6; i++) {
          const dy = Math.round(Math.sin(i * 0.9 + wave * 2) * 0.8);
          c.fillStyle = css(i < 2 ? f.light : f.main);
          c.fillRect(px - 1 - i, py + 1 + dy, 1, 4);
        }
        break;
      }
      case 'tower': {
        const spr = this.art[b.f].towerGun;
        this.drawRot(spr, ox + 11, oy + 8, b.gun, false);
        break;
      }
      case 'factory':
      case 'refinery':
        if (Math.floor(b.phase * 0.7) % 3 === 0) {
          c.fillStyle = WIN_LIT;
          c.fillRect(ox + (b.kind === 'factory' ? 54 : 4), oy + (b.kind === 'factory' ? 38 : 22), 3, 2);
        }
        break;
    }
  }
}

function smoothNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function overlap(a: Rect, b: Rect, m: number): boolean {
  return a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;
}

function inside(x: number, y: number, r: Rect, m: number): boolean {
  return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
}

function corners(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, len: number): void {
  const L = len + 1;
  c.fillRect(x - rx, y - ry, L, 1);
  c.fillRect(x - rx, y - ry, 1, L);
  c.fillRect(x + rx - L + 1, y - ry, L, 1);
  c.fillRect(x + rx, y - ry, 1, L);
  c.fillRect(x - rx, y + ry, L, 1);
  c.fillRect(x - rx, y + ry - L + 1, 1, L);
  c.fillRect(x + rx - L + 1, y + ry, L, 1);
  c.fillRect(x + rx, y + ry - L + 1, 1, L);
}

function pxLine(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

export { STATS };
export type { Unit };
