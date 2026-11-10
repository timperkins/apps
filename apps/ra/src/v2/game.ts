// v2: the same sandbox as v1, drawn in 2:1 isometric with shaded voxel art.
import { SphereField, css, dirIndex, hash2, nearestCopy, overPole, rng } from '../gfx';
import { STATS, UnitKind } from '../v1/game';
import type { GameLike } from '../types';
import { HP, IsoTerrain, K, Rect } from './terrain';
import { StackSprite, toScreen, toWorld } from './stack';
import {
  BuildingKind,
  DIRS,
  FACTIONS,
  V2BuildingArt,
  V2FactionArt,
  makeBuilding,
  makeBushes,
  makeClutter,
  makeDish,
  makeFactionArt,
  makeRocks,
  makeTrees,
} from './sprites';

interface Unit {
  kind: UnitKind;
  f: number;
  x: number;
  y: number;
  z: number;
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
  // Laps around the world: on screen the unit's unwrapped x is sx + lap * w.
  // It is set to the copy the player picked, so orders go the way they panned.
  lap: number;
}

interface Building {
  kind: BuildingKind;
  f: number;
  x: number;
  y: number;
  art: V2BuildingArt;
  phase: number;
  gun: number;
  gunGoal: number;
}

interface Prop {
  spr: StackSprite;
  x: number;
  y: number;
  z: number;
}

interface Particle {
  x: number; // screen space
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: 'smoke' | 'soot' | 'wake' | 'dust';
  size: number;
  g?: number; // ground screen y it rose from, if not where it started
}

const BASE_A: BuildingKind[] = ['hq', 'factory', 'power', 'barracks', 'refinery', 'radar', 'power', 'helipad', 'silo', 'tower', 'tower', 'tower'];
const BASE_B: BuildingKind[] = ['hq', 'power', 'factory', 'barracks', 'refinery', 'silo', 'radar', 'tower', 'tower', 'helipad', 'power'];

// Height of each unit's visual centre above the ground (for picking and brackets).
const MID: Record<UnitKind, number> = { light: 4, heavy: 5, buggy: 4, hauler: 5, arty: 5, boat: 4, heli: 4, inf: 4, rocket: 4 };
const HELI_ALT = 20;

export class IsoGame implements GameLike {
  terrain!: IsoTerrain;
  units: Unit[] = [];
  buildings: Building[] = [];
  props: Prop[] = [];
  particles: Particle[] = [];
  markers: { x: number; y: number; z: number; t: number }[] = [];
  sparkles: { x: number; y: number; life: number }[] = [];
  art: V2FactionArt[];
  bArt = new Map<string, V2BuildingArt>();
  trees = makeTrees();
  rocks = makeRocks();
  bushes = makeBushes();
  clutter = makeClutter();
  dish = makeDish();
  time = 0;
    onSelect: (names: string[]) => void = () => {};

  constructor(
    public ctx: CanvasRenderingContext2D,
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

  private emit(): void {
    this.onSelect(this.selected().map((u) => STATS[u.kind].name));
  }

  private buildingArt(kind: BuildingKind, f: number): V2BuildingArt {
    const key = `${kind}-${f}`;
    let a = this.bArt.get(key);
    if (!a) {
      a = makeBuilding(kind, FACTIONS[f]);
      this.bArt.set(key, a);
    }
    return a;
  }

  generate(w: number, h: number): void {
    const rand = rng(this.seed * 7919 + 29);
    const T = (this.terrain = new IsoTerrain(w, h, this.seed));
    this.units = [];
    this.buildings = [];
    this.props = [];
    this.particles = [];
    this.markers = [];
    this.sparkles = [];

    const portrait = h > w * 1.1;
    const area = (w * h) / (640 * 360);
    const take = (list: BuildingKind[]) => list.slice(0, Math.max(5, Math.round(list.length * Math.min(1, area * 1.1))));
    const pads: Rect[] = [];
    const onScreen = (spr: StackSprite, x: number, y: number) => {
      const [sx, sy] = toScreen(x, y);
      const left = sx - spr.cx;
      const top = sy - spr.cy;
      return left > 0 && top > 26 && left + spr.img.width - 10 < w && sy + 8 < h;
    };
    const place = (kinds: BuildingKind[], f: number, fx: number, fy: number) => {
      const [cx, cy] = T.at(fx, fy);
      for (const kind of kinds) {
        const art = this.buildingArt(kind, f);
        let done = false;
        for (let ring = 0; ring < 70 && !done; ring++) {
          const tries = ring === 0 ? 1 : 10 + ring * 2;
          for (let t = 0; t < tries && !done; t++) {
            const ang = rand() * Math.PI * 2;
            const x = Math.round(cx + Math.cos(ang) * ring * 4);
            const y = Math.round(cy + Math.sin(ang) * ring * 4);
            const pad = { x: x - art.rx - 3, y: y - art.ry - 3, w: art.rx * 2 + 6, h: art.ry * 2 + 6 };
            if (!onScreen(art.spr, x, y)) continue;
            if (!T.clear(pad, 1)) continue;
            if (pads.some((p) => overlap(p, pad, 4))) continue;
            pads.push(pad);
            T.markPad(pad);
            this.buildings.push({ kind, f, x, y, art, phase: rand() * 10, gun: rand() * Math.PI * 2, gunGoal: rand() * Math.PI * 2 });
            done = true;
          }
        }
      }
    };
    place(take(BASE_A), 0, portrait ? 0.32 : 0.24, portrait ? 0.22 : 0.44);
    place(take(BASE_B), 1, portrait ? 0.55 : 0.74, portrait ? 0.56 : 0.3);

    // a little clutter beside some buildings
    for (const b of this.buildings) {
      if (!['factory', 'refinery', 'barracks', 'hq'].includes(b.kind)) continue;
      const ci = b.kind === 'barracks' ? 2 : Math.floor(rand() * 2);
      const x = b.x + b.art.rx + 4;
      const y = b.y + (rand() - 0.5) * b.art.ry;
      if (T.k(x, y) === K.Pad || T.k(x, y) === K.Grass) this.props.push({ spr: this.clutter[ci], x, y, z: 0 });
    }

    // trees, bushes and rocks over the visible world
    const forestSeed = this.seed + 400;
    const forestF = new SphereField(w, h, 50, this.seed + 500, 2);
    for (let sy = 6; sy < h + 20; sy += 5)
      for (let sx = 2; sx < w; sx += 7) {
        const jx = sx + hash2(sx, sy, forestSeed) * 6;
        const jy = sy + hash2(sy, sx, forestSeed) * 4;
        // a prop may sit on a plateau: test the high ground first
        let [wx, wy] = toWorld(jx, jy, HP);
        let z = HP;
        if (!T.isHigh(wx, wy)) {
          [wx, wy] = toWorld(jx, jy, 0);
          z = 0;
          if (T.isHigh(wx, wy)) continue; // that spot is a cliff face
        }
        const k = T.k(wx, wy);
        if (k !== K.Grass && k !== K.High) continue;
        if (pads.some((p) => inside(wx, wy, p, 5))) continue;
        const forest = (forestF.at(jx, jy) - 0.6) * 2.4;
        const roll = hash2(Math.floor(wx), Math.floor(wy), forestSeed + 1);
        let spr: StackSprite | null = null;
        if (roll < forest) spr = this.trees[Math.floor(hash2(sx, sy, 3) * 5)];
        else if (roll < 0.014) spr = this.trees[5 + Math.floor(hash2(sx, sy, 4) * 3)];
        else if (roll < 0.035) spr = this.bushes[Math.floor(hash2(sx, sy, 5) * 3)];
        else if (roll < 0.045 || (z === HP && roll < 0.09)) spr = this.rocks[Math.floor(hash2(sx, sy, 6) * 4)];
        if (spr) this.props.push({ spr, x: wx, y: wy, z });
      }

    T.paint();

    // armies
    const spawn = (kind: UnitKind, f: number, fx: number, fy: number, spread: number) => {
      for (let t = 0; t < 300; t++) {
        const sx = (fx + (rand() - 0.5) * spread * 1.4) * w;
        const sy = (fy + (rand() - 0.5) * spread * 1.6) * h;
        const [x, y] = toWorld(sx, sy, 0);
        const k = T.k(x, y);
        const water = (dx: number, dy: number) => T.k(x + dx, y + dy) === K.Water;
        const ok =
          kind === 'boat'
            ? water(0, 0) && water(12, 0) && water(-12, 0) && water(0, 12) && water(0, -12)
            : kind === 'heli' || k === K.Grass || k === K.Road || k === K.Pad;
        if (!ok || T.isHigh(x, y) || sx < 10 || sy < 30 || sx > w - 10 || sy > h - 8) continue;
        if (kind !== 'heli' && this.buildings.some((b) => Math.abs(b.x - x) < b.art.rx + 3 && Math.abs(b.y - y) < b.art.ry + 3)) continue;
        const a = rand() * Math.PI * 2;
        this.units.push({ kind, f, x, y, z: 0, a, turret: a, turretGoal: a, tx: x, ty: y, moving: false, sel: false, anim: rand() * 10, hp: STATS[kind].hp, idle: rand() * 4, trackAcc: 0, lap: 0 });
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
    const centres: [number, number][] = portrait
      ? [
          [0.42, 0.38],
          [0.42, 0.74],
        ]
      : [
          [0.3, 0.64],
          [0.8, 0.5],
        ];
    for (let f = 0; f < 2; f++) for (const [kind, c] of army) for (let i = 0; i < n(c); i++) spawn(kind, f, centres[f][0], centres[f][1], 0.16);
    for (let f = 0; f < 2; f++) for (let i = 0; i < n(1); i++) spawn('boat', f, 0.84, 0.84, 0.16);
    for (const u of this.units) u.z = this.groundZ(u);
    this.emit();
  }

  private groundZ(u: Unit): number {
    if (u.kind === 'boat') return 0;
    return this.terrain.elev(u.x, u.y);
  }

  // ---------- Input (screen coordinates) ----------

  // mirrored: as seen past a pole, where the map is flipped north-south but
  // objects stay upright, so heights go down the screen instead of up.
  private screenOf(u: Unit, mirrored = false): [number, number] {
    const alt = u.kind === 'heli' ? HELI_ALT : 0;
    const h = u.z + alt + MID[u.kind];
    return toScreen(u.x, u.y, mirrored ? -h : h);
  }

  private groundAt(sx: number, sy: number): [number, number] {
    for (let z = HP; z > 0; z--) {
      const [x, y] = toWorld(sx, sy, z);
      if (this.terrain.isHigh(x, y)) return [x, y];
    }
    return toWorld(sx, sy, 0);
  }

  // Screen x may be on any copy of the world; each unit's nearest copy is tested.
  click(x: number, y: number, add: boolean, mirrored = false): void {
    let best: Unit | null = null;
    let bestLap = 0;
    let bd = 1e9;
    for (const u of this.units) {
      const [sx, sy] = this.screenOf(u, mirrored);
      const lap = Math.round((x - sx) / this.w);
      const d = Math.hypot(sx + lap * this.w - x, sy - y);
      if (d < STATS[u.kind].r + 4 && d < bd) {
        bd = d;
        best = u;
        bestLap = lap;
      }
    }
    if (best) {
      if (!add) for (const o of this.units) o.sel = false;
      best.sel = add ? !best.sel : true;
      best.lap = bestLap;
      this.emit();
      return;
    }
    this.order(x, y, mirrored);
  }

  // Bring a ground point back onto the map: over a pole if it is past one,
  // then round to the first lap.
  private fold(wx: number, wy: number): [number, number] {
    let [sx, sy] = toScreen(wx, wy);
    [sx, sy] = overPole(sx, sy, this.w, this.h);
    sx = ((sx % this.w) + this.w) % this.w;
    return toWorld(sx, sy);
  }

  // Shift a world point by whole laps around the world.
  private lapped(x: number, y: number, lap: number): [number, number] {
    const k = (lap * this.w) / 2;
    return [x + k, y - k];
  }

  order(x: number, y: number, shortest = false): void {
    const sel = this.units.filter((u) => u.sel);
    if (!sel.length) return;
    if (shortest) {
      // from the globe: take the shortest way, which may be over a pole
      const [rx, ry] = toScreen(sel[0].x, sel[0].y);
      [x, y] = nearestCopy(rx, ry, x, y, this.w, this.h);
      for (const u of sel) u.lap = Math.round((x - (u.x - u.y)) / this.w);
    }
    // wx, wy are unwrapped: on the copy of the world the player is looking at
    const [wx, wy] = this.groundAt(x, y);
    const [mx, my] = this.fold(wx, wy);
    this.markers.push({ x: mx, y: my, z: this.terrain.elev(wx, wy), t: 0 });
    const cols = Math.ceil(Math.sqrt(sel.length));
    const rows = Math.ceil(sel.length / cols);
    const gap = 14;
    const slots: [number, number][] = [];
    for (let i = 0; i < sel.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push([wx + (c - (cols - 1) / 2) * gap, wy + (r - (rows - 1) / 2) * gap]);
    }
    const left = [...sel];
    slots.sort((a, b) => Math.hypot(a[0] - wx, a[1] - wy) - Math.hypot(b[0] - wx, b[1] - wy));
    for (const [sx, sy] of slots) {
      let bi = 0;
      let bd = 1e9;
      left.forEach((u, i) => {
        const [ux, uy] = this.lapped(u.x, u.y, u.lap);
        const d = Math.hypot(ux - sx, uy - sy);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const u = left.splice(bi, 1)[0];
      // the same move, in the unit's own (folded) coordinates
      [u.tx, u.ty] = this.lapped(sx, sy, -u.lap);
      u.moving = true;
    }
  }

  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean, mirrored = false): void {
    const minx = Math.min(x0, x1);
    const maxx = Math.max(x0, x1);
    const miny = Math.min(y0, y1);
    const maxy = Math.max(y0, y1);
    const mid = (minx + maxx) / 2;
    for (const u of this.units) {
      const [ux, sy] = this.screenOf(u, mirrored);
      const lap = Math.round((mid - ux) / this.w);
      const sx = ux + lap * this.w;
      const hit = sx >= minx - 3 && sx <= maxx + 3 && sy >= miny - 3 && sy <= maxy + 3;
      if (hit) {
        u.sel = true;
        u.lap = lap;
      } else if (!add) u.sel = false;
    }
    this.emit();
  }

  focus(): { x: number; y: number } {
    const mine = this.units.filter((u) => u.f === 0 && u.kind !== 'boat');
    if (!mine.length) return { x: this.w / 2, y: this.h / 2 };
    const pts = mine.map((u) => toScreen(u.x, u.y, u.z));
    return { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length };
  }

  selectedPoints(): [number, number][] {
    return this.selected().map((u) => toScreen(u.x, u.y));
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
      const foot = u.kind === 'inf' || u.kind === 'rocket';
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
          const diff = angDiff(want, u.a);
          const stepA = st.turn * dt;
          u.a = Math.abs(diff) <= stepA ? want : u.a + Math.sign(diff) * stepA;
          const free = foot || u.kind === 'heli';
          const go = free ? 1 : Math.max(0, Math.cos(angDiff(want, u.a)) - 0.4) / 0.6;
          const sp = Math.min(dist, st.speed * 1.1 * dt * go);
          const ang = free ? want : u.a;
          u.x += Math.cos(ang) * sp;
          u.y += Math.sin(ang) * sp;
          u.trackAcc += sp;
          if (u.trackAcc > 1.5) {
            u.trackAcc = 0;
            const k = this.terrain.k(u.x, u.y);
            const [sx, sy] = toScreen(u.x, u.y, u.z);
            if (u.kind === 'boat') {
              const [bx, by] = toScreen(u.x - Math.cos(u.a) * 13, u.y - Math.sin(u.a) * 13, 0);
              this.particles.push({ x: bx, y: by, vx: 0, vy: 0, life: 0, max: 1.6, kind: 'wake', size: 1 });
            } else if (!foot && u.kind !== 'heli' && k !== K.Water && u.z === 0) {
              const hw = u.kind === 'heavy' ? 6 : u.kind === 'buggy' ? 4 : 5;
              const px = -Math.sin(u.a) * hw;
              const py = Math.cos(u.a) * hw;
              tctx.fillStyle = k === K.Road || k === K.Sand ? 'rgba(60,45,25,0.2)' : k === K.Pad ? 'rgba(30,30,30,0.08)' : 'rgba(25,22,12,0.16)';
              const [ax, ay] = toScreen(u.x + px, u.y + py);
              const [bx, by] = toScreen(u.x - px, u.y - py);
              tctx.fillRect(Math.round(ax), Math.round(ay), 1, 1);
              tctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
              if ((k === K.Road || k === K.Sand) && Math.random() < 0.4) {
                const [rx, ry] = toScreen(u.x - Math.cos(u.a) * 8, u.y - Math.sin(u.a) * 8, 1);
                this.particles.push({ x: rx, y: ry, vx: (Math.random() - 0.5) * 5, vy: -4, life: 0, max: 0.9, kind: 'dust', size: 1 });
              }
            }
            void sx;
            void sy;
          }
        }
      }
      // over a pole: come down the far side of the globe, still heading for the target
      const gy = (u.x + u.y) / 2;
      if (gy < 0 || gy > this.h) {
        const pole = (wx: number, wy: number) => {
          const [sx, sy] = overPole(wx - wy, (wx + wy) / 2, this.w, this.h);
          return toWorld(sx, sy);
        };
        [u.x, u.y] = pole(u.x, u.y);
        [u.tx, u.ty] = pole(u.tx, u.ty);
        u.a = Math.atan2(u.ty - u.y, u.tx - u.x);
        u.turret = u.turretGoal = u.a;
      }
      // wrap around the world
      const k = Math.floor((u.x - u.y) / this.w);
      if (k) {
        [u.x, u.y] = this.lapped(u.x, u.y, -k);
        [u.tx, u.ty] = this.lapped(u.tx, u.ty, -k);
        u.lap += k;
      }
      // smoothly follow the ground height (units climb plateaus freely)
      const gz = this.groundZ(u);
      u.z += (gz - u.z) * Math.min(1, dt * 8);
      if (Math.abs(gz - u.z) < 0.05) u.z = gz;

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
      const emit = (i: number, kind: 'smoke' | 'soot', rate: number) => {
        if (!b.art.fx[i] || Math.random() > dt * rate) return;
        const p = b.art.fx[i];
        const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z);
        const g = (b.x + b.y) / 2;
        this.particles.push({ x: sx + (Math.random() - 0.5) * 6, y: sy, vx: 3 + Math.random() * 3, vy: -7 - Math.random() * 4, life: 0, max: 2.6 + Math.random(), kind, size: 1.5, g });
      };
      if (b.kind === 'power') {
        emit(0, 'smoke', 3);
        emit(1, 'smoke', 3);
      }
      if (b.kind === 'refinery') emit(0, 'soot', 2);
      if (b.kind === 'factory') {
        emit(0, 'smoke', 0.8);
        emit(1, 'smoke', 0.8);
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
      if (p.kind === 'smoke' || p.kind === 'soot') p.size += dt * 1.8;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter((m) => m.t < 0.7);

    const want = Math.floor((this.w * this.h) / 2500);
    for (let i = 0; i < 4 && this.sparkles.length < want; i++) {
      const x = Math.floor(Math.random() * this.w);
      const y = Math.floor(Math.random() * this.h);
      const [wx, wy] = toWorld(x, y, 0);
      if (this.terrain.k(wx, wy) === K.Water && this.terrain.k(wx - 3, wy - 3) === K.Water && !this.terrain.isHigh(wx, wy)) this.sparkles.push({ x, y, life: 0 });
    }
    for (const s of this.sparkles) s.life += dt;
    this.sparkles = this.sparkles.filter((s) => s.life < 1.2);
  }

  // ---------- Rendering ----------

  private blit(spr: StackSprite, wx: number, wy: number, z: number, shadowOnly = false): void {
    const [sx, sy] = toScreen(wx, wy, z);
    const c = shadowOnly ? spr.shadow : spr.img;
    if (c) this.ctx.drawImage(c, Math.round(sx - spr.cx), Math.round(sy - spr.cy));
  }

  // The ground layer and the objects on it are drawn separately so main.ts can
  // lay down the ground for every visible copy of the wrapped world first.
  renderGround(): void {
    const c = this.ctx;
    const t = this.time;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.terrain.canvas, 0, 0);

    c.globalAlpha = 0.45 + 0.35 * Math.sin(t * 1.6);
    c.drawImage(this.terrain.foam, 0, 0);
    c.globalAlpha = 0.35 + 0.3 * Math.sin(t * 1.6 + 2.2);
    c.drawImage(this.terrain.foam2, 0, 0);
    c.globalAlpha = 1;
    for (const s of this.sparkles) {
      const a = Math.sin((s.life / 1.2) * Math.PI);
      c.fillStyle = `rgba(225,242,250,${a * 0.85})`;
      c.fillRect(s.x, s.y, 2, 1);
    }
    for (const p of this.particles) {
      if (p.kind !== 'wake') continue;
      const k = p.life / p.max;
      c.fillStyle = `rgba(225,240,245,${0.75 * (1 - k)})`;
      const r = 1 + k * 7;
      c.fillRect(Math.round(p.x - r), Math.round(p.y), 1, 1);
      c.fillRect(Math.round(p.x + r), Math.round(p.y), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y - r * 0.5), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y + r * 0.5), 1, 1);
    }

    // move markers: shrinking iso diamond
    for (const m of this.markers) {
      const k = m.t / 0.7;
      const r = 9 - k * 6;
      c.fillStyle = `rgba(120,255,120,${1 - k * 0.6})`;
      for (const [ax, ay] of [
        [r, 0],
        [0, r],
        [-r, 0],
        [0, -r],
      ]) {
        const [sx, sy] = toScreen(m.x + ax, m.y + ay, m.z);
        c.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1);
      }
    }

    // aircraft shadows on the ground
    for (const u of this.units) {
      if (u.kind !== 'heli') continue;
      const spr = this.art[u.f].heli[dirIndex(u.a, DIRS)];
      const [sx, sy] = toScreen(u.x + 4, u.y - 2, u.z);
      if (spr.shadow) this.ctx.drawImage(spr.shadow, Math.round(sx - spr.cx), Math.round(sy - spr.cy));
    }

  }

  // mirror: draw the map flipped north-south about y = mirror / 2 (the far
  // side of a pole) with every object still upright: each one is moved, whole,
  // so its foot point lands where the flipped ground puts it.
  renderObjects(mirror?: number): void {
    const c = this.ctx;
    const at = (a: number, draw: () => void) => {
      if (mirror === undefined) return draw();
      c.save();
      c.translate(0, Math.round(mirror - 2 * a));
      draw();
      c.restore();
    };
    type Item = { k: number; a: number; draw: () => void };
    const items: Item[] = [];
    for (const p of this.props) items.push({ k: p.x + p.y + p.z * 2, a: (p.x + p.y) / 2, draw: () => this.blit(p.spr, p.x, p.y, p.z) });
    for (const b of this.buildings) items.push({ k: b.x + b.y + Math.min(b.art.rx, b.art.ry), a: (b.x + b.y) / 2, draw: () => this.drawBuilding(b) });
    for (const u of this.units) if (u.kind !== 'heli') items.push({ k: u.x + u.y + u.z * 2, a: (u.x + u.y) / 2, draw: () => this.drawUnit(u) });
    items.sort(mirror === undefined ? (a, b) => a.k - b.k : (a, b) => b.k - a.k);
    for (const it of items) at(it.a, it.draw);

    for (const p of this.particles) {
      if (p.kind === 'wake') continue;
      const k = p.life / p.max;
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle =
        p.kind === 'smoke' ? `rgba(222,222,216,${0.6 * (1 - k)})` : p.kind === 'soot' ? `rgba(70,66,60,${0.55 * (1 - k)})` : `rgba(165,145,105,${0.5 * (1 - k)})`;
      at(p.g ?? p.y - p.vy * p.life, () => {
        c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        if (s > 2) {
          c.fillStyle = p.kind === 'smoke' ? `rgba(255,255,255,${0.35 * (1 - k)})` : 'rgba(0,0,0,0)';
          c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s / 2), 1);
        }
      });
    }

    for (const u of this.units) if (u.kind === 'heli') at((u.x + u.y) / 2, () => this.drawUnit(u));

    for (const u of this.units) if (u.sel) at((u.x + u.y) / 2, () => this.drawSelection(u));
  }

  private drawUnit(u: Unit): void {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    switch (u.kind) {
      case 'inf':
      case 'rocket': {
        const frames = u.kind === 'inf' ? art.infantry : art.rocket;
        const fr = u.moving ? 1 + (Math.floor(u.anim * 7) % 2) : 0;
        this.blit(frames[fr][dirIndex(u.a, 16)], u.x, u.y, u.z);
        break;
      }
      case 'light':
      case 'heavy': {
        const hull = u.kind === 'light' ? art.lightTank : art.heavyTank;
        const tur = u.kind === 'light' ? art.lightTurret : art.heavyTurret;
        this.blit(hull[di], u.x, u.y, u.z);
        this.blit(tur[dirIndex(u.turret, DIRS)], u.x - Math.cos(u.a) * 1.2, u.y - Math.sin(u.a) * 1.2, u.z);
        break;
      }
      case 'heli': {
        const alt = HELI_ALT + Math.sin(u.anim * 2) * 1.2;
        const z = u.z + alt;
        this.blit(art.heli[di], u.x, u.y, z);
        const c = this.ctx;
        const hx = u.x + Math.cos(u.a) * 1;
        const hy = u.y + Math.sin(u.a) * 1;
        const ra = u.anim * 26;
        c.fillStyle = 'rgba(28,28,28,0.5)';
        for (let b = 0; b < 2; b++) {
          const ang = ra + b * Math.PI * 0.5;
          const [x0, y0] = toScreen(hx - Math.cos(ang) * 12, hy - Math.sin(ang) * 12, z + 8);
          const [x1, y1] = toScreen(hx + Math.cos(ang) * 12, hy + Math.sin(ang) * 12, z + 8);
          pxLine(c, x0, y0, x1, y1);
        }
        const [mx, my] = toScreen(hx, hy, z + 8);
        c.fillStyle = '#222';
        c.fillRect(Math.round(mx), Math.round(my), 1, 1);
        // tail rotor blur
        const [tx, ty] = toScreen(u.x - Math.cos(u.a) * 13.5, u.y - Math.sin(u.a) * 13.5, z + 6.5);
        c.fillStyle = 'rgba(28,28,28,0.45)';
        const s = Math.floor(u.anim * 20) % 2 ? 2 : 1;
        c.fillRect(Math.round(tx), Math.round(ty) - s, 1, s * 2 + 1);
        break;
      }
      case 'boat': {
        const bob = Math.sin(u.anim * 2.2) * 0.6;
        this.blit(art.boat[di], u.x, u.y, bob);
        break;
      }
      default: {
        const spr = u.kind === 'buggy' ? art.buggy : u.kind === 'hauler' ? art.hauler : art.artillery;
        this.blit(spr[di], u.x, u.y, u.z);
      }
    }
  }

  private drawSelection(u: Unit): void {
    const c = this.ctx;
    const st = STATS[u.kind];
    const [sx, sy] = this.screenOf(u);
    const foot = u.kind === 'inf' || u.kind === 'rocket';
    const rx = foot ? 5 : st.r + 4;
    const ry = foot ? 7 : Math.round(st.r * 0.75) + 2;
    c.fillStyle = '#ffffff';
    corners(c, Math.round(sx), Math.round(sy), rx, ry, 2);
    const bw = Math.max(8, rx * 2);
    const bx = Math.round(sx - bw / 2);
    const by = Math.round(sy - ry - 4);
    c.fillStyle = '#111';
    c.fillRect(bx - 1, by - 1, bw + 2, 4);
    c.fillStyle = u.hp > 0.66 ? '#5ee05e' : u.hp > 0.33 ? '#e8d24a' : '#e85a4a';
    c.fillRect(bx, by, Math.round(bw * u.hp), 2);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 3; i < bw; i += 3) c.fillRect(bx + i, by, 1, 2);
  }

  private drawBuilding(b: Building): void {
    const c = this.ctx;
    this.blit(b.art.spr, b.x, b.y, 0);
    const f = FACTIONS[b.f];
    const fx = (i: number) => {
      const p = b.art.fx[i];
      return toScreen(b.x + p.x, b.y + p.y, p.z).map(Math.round) as [number, number];
    };
    switch (b.kind) {
      case 'hq': {
        if (Math.floor(b.phase * 1.5) % 2 === 0) {
          const [x, y] = fx(0);
          c.fillStyle = 'rgba(255,90,60,0.35)';
          c.fillRect(x - 1, y - 1, 3, 3);
          c.fillStyle = '#ff7a5c';
          c.fillRect(x, y, 1, 1);
        }
        break;
      }
      case 'barracks': {
        const [x, y] = fx(0);
        const wave = Math.floor(b.phase * 5) % 4;
        for (let i = 0; i < 7; i++) {
          const dy = Math.round(Math.sin(i * 0.9 - wave * 1.6) * 0.8);
          c.fillStyle = css(i < 2 ? f.light : i === 6 ? f.dark : f.main);
          c.fillRect(x - 1 - i, y + dy, 1, 4);
        }
        break;
      }
      case 'radar': {
        const p = b.art.fx[0];
        const frame = Math.floor(((b.phase * 0.5) % 1) * 16);
        this.blit(this.dish[frame], b.x + p.x, b.y + p.y, p.z - 3);
        break;
      }
      case 'tower': {
        const p = b.art.fx[0];
        this.blit(this.art[b.f].towerGun[dirIndex(b.gun, DIRS)], b.x + p.x, b.y + p.y, p.z);
        break;
      }
    }
  }
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
