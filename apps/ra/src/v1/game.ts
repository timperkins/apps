import { RGB, WorldField, nearestCopy, css, dirIndex, hash2, mix, rng } from '../gfx';
import { CH, Tile, Tiles, drawTiles, windingRoad } from '../tiles';
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
import { K, OV, Rect, Terrain } from './terrain';

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
  // Laps around the world: the unit's unwrapped position is (x + lap * w,
  // y + lapY * h). They are set to the copy the player picked, so orders travel
  // the way the player panned.
  lap: number;
  lapY: number;
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
  onSelect: (names: string[]) => void = () => {};

  private emit(): void {
    this.onSelect(this.selected().map((u) => STATS[u.kind].name));
  }

  constructor(
    public ctx: CanvasRenderingContext2D,
    public seed: number,
  ) {
    this.art = FACTIONS.slice(0, 2).map(makeFactionArt);
  }

  get w(): number {
    return this.terrain.w;
  }
  get h(): number {
    return this.terrain.h;
  }

  // The planet is big, so there are several bases round it: the two home
  // bases near each other where the camera starts, and outposts further out.
  generate(w: number, h: number): void {
    const rand = rng(this.seed * 7919 + 13);
    const T = (this.terrain = new Terrain(w, h, this.seed));
    this.units = [];
    this.buildings = [];
    this.props = [];
    this.particles = [];
    this.markers = [];
    this.sparkles = [];
    this.ov = null;
    this.forest = new WorldField(w, h, 60, this.seed + 500, 3, 12);

    const wrapD = (ax: number, ay: number, bx: number, by: number) => {
      const [x, y] = nearestCopy(ax, ay, bx, by, w, h);
      return Math.hypot(x - ax, y - ay);
    };
    type Site = { x: number; y: number; f: number; home: boolean };
    const sites: Site[] = [
      { x: 1440 * 0.24, y: 720 * 0.42, f: 0, home: true },
      { x: 1440 * 0.74, y: 720 * 0.28, f: 1, home: true },
    ];
    const want = Math.max(2, Math.round((w * h) / 9e6));
    const gap = Math.sqrt((w * h) / want) * 0.6;
    for (let i = 0; i < 3000 && sites.length < want + 2; i++) {
      const x = rand() * w;
      const y = rand() * h;
      if (sites.some((s) => wrapD(s.x, s.y, x, y) < gap)) continue;
      if (T.k(x, y) !== K.Grass || T.k(x + 60, y) !== K.Grass || T.k(x - 60, y) !== K.Grass) continue;
      sites.push({ x, y, f: sites.length % 2, home: false });
    }
    // roads from each base to its two nearest neighbors
    const lines: [number, number][][] = [];
    const done = new Set<string>();
    sites.forEach((a, i) => {
      const near = sites
        .map((b, j) => ({ j, d: wrapD(a.x, a.y, b.x, b.y) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 2);
      for (const { j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (done.has(key)) continue;
        done.add(key);
        const [bx, by] = nearestCopy(a.x, a.y, sites[j].x, sites[j].y, w, h);
        lines.push(windingRoad(a.x, a.y, bx, by, rand));
      }
    });
    T.setRoads(lines);

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
            if (!T.clear(pad, 2)) continue;
            if (bodies.some((p) => overlap(p, body, 4))) continue;
            bodies.push(body);
            T.markPad(pad);
            this.buildings.push({ kind, f, x, y, art, phase: rand() * 10, gun: rand() * Math.PI * 2, gunGoal: rand() * Math.PI * 2 });
            placed = true;
          }
        }
      }
    };
    const OUTPOST: BuildingKind[] = ['hq', 'power', 'barracks', 'refinery', 'silo', 'tower', 'tower', 'radar', 'factory', 'helipad'];
    for (const s of sites) place(s.home ? (s.f ? BASE_B : BASE_A) : OUTPOST.slice(0, 5 + Math.floor(rand() * 5)), s.f, s.x, s.y);

    // Units round each base
    const spawn = (kind: UnitKind, f: number, cx: number, cy: number, spread: number): Unit | null => {
      for (let t = 0; t < 200; t++) {
        let x = cx + (rand() - 0.5) * spread * 2;
        let y = cy + (rand() - 0.5) * spread * 1.4;
        const k = T.k(x, y);
        const ok = kind === 'boat' ? k === K.Water && T.k(x + 10, y) === K.Water && T.k(x - 10, y) === K.Water : kind === 'heli' ? true : k === K.Grass || k === K.Road || k === K.Pad;
        if (!ok) continue;
        if (kind !== 'heli' && this.buildings.some((b) => inside(x, y, { x: b.x - b.art.w / 2, y: b.y - b.art.h, w: b.art.w, h: b.art.h }, 2))) continue;
        x = ((x % w) + w) % w;
        y = ((y % h) + h) % h;
        const a = rand() * Math.PI * 2;
        const u: Unit = { kind, f, x, y, a, turret: a, turretGoal: a, tx: x, ty: y, moving: false, sel: false, anim: rand() * 10, hp: STATS[kind].hp, idle: rand() * 4, trackAcc: 0, lap: 0, lapY: 0 };
        this.units.push(u);
        return u;
      }
      return null;
    };
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
    const mine: Unit[] = [];
    for (const s of sites)
      for (const [kind, c] of army)
        for (let i = 0; i < Math.max(1, Math.round(c * (s.home ? 1.4 : 0.6))); i++) {
          const u = spawn(kind, s.f, s.x + (s.home ? 60 : 0), s.y + (s.home ? 120 : 60), s.home ? 160 : 110);
          if (u && s.home && s.f === 0) mine.push(u);
        }
    // boats on the nearest lake to home
    const hx = (sites[0].x + sites[1].x) / 2;
    const hy = (sites[0].y + sites[1].y) / 2;
    let lake: [number, number] | null = null;
    for (let r = 100; r < 3000 && !lake; r += 100)
      for (let t = 0; t < 40 && !lake; t++) {
        const a = rand() * Math.PI * 2;
        const x = hx + Math.cos(a) * r;
        const y = hy + Math.sin(a) * r;
        if (T.k(x, y) === K.Water && T.k(x + 30, y) === K.Water && T.k(x - 30, y) === K.Water) lake = [x, y];
      }
    if (lake) for (let f = 0; f < 2; f++) for (let i = 0; i < 2; i++) spawn('boat', f, lake[0], lake[1], 60);

    this.home = mine.length
      ? { x: mine.reduce((s, u) => s + u.x, 0) / mine.length, y: mine.reduce((s, u) => s + u.y, 0) / mine.length }
      : { x: sites[0].x, y: sites[0].y };
    this.tiles = new Tiles(w, h, (tx, ty) => this.buildTile(tx, ty));
    this.emit();
  }

  private home = { x: 0, y: 0 };
  tiles!: Tiles<Prop>;
  // the map rect last drawn, so sparkles appear where you are looking
  private view = { x0: 0, y0: 0, x1: 0, y1: 0 };

  // Paint one tile of ground and scatter its trees, rocks and bushes.
  private buildTile(tx: number, ty: number): Tile<Prop> {
    const T = this.terrain;
    const p = T.paintTile(tx, ty);
    const R = p.region;
    const kAt = (x: number, y: number): K => {
      const i = Math.floor(x) - R.x0;
      const j = Math.floor(y) - R.y0;
      return i < 0 || j < 0 || i >= R.w || j >= R.h ? T.k(x, y) : (R.kind[j * R.w + i] as K);
    };
    const props: Prop[] = [];
    const forestSeed = this.seed + 400;
    const X0 = tx * CH;
    const Y0 = ty * CH;
    const pads = T.pads.filter((q) => q.x < X0 + CH + 12 && q.x + q.w > X0 - 12 && q.y < Y0 + CH + 12 && q.y + q.h > Y0 - 12);
    for (let y = Y0 + ((((4 - Y0) % 5) + 5) % 5); y < Y0 + CH; y += 5)
      for (let x = X0 + ((((2 - X0) % 5) + 5) % 5); x < X0 + CH; x += 5) {
        const jx = x + Math.floor(hash2(x, y, forestSeed) * 5);
        const jy = y + Math.floor(hash2(y, x, forestSeed) * 5);
        const k = kAt(jx, jy);
        if (k !== K.Grass) continue;
        if (pads.some((q) => inside(jx, jy, q, 6))) continue;
        const forest = (this.forest.at(jx, jy) - 0.55) * 3;
        const roll = hash2(jx, jy, forestSeed + 1);
        if (roll < forest) {
          props.push({ img: this.trees[Math.floor(hash2(jx, jy, 3) * 4.99)], x: jx, y: jy });
        } else if (roll < 0.012) {
          props.push({ img: this.trees[4 + Math.floor(hash2(jx, jy, 4) * 1.99)], x: jx, y: jy });
        } else if (roll < 0.03) {
          props.push({ img: this.bushes[Math.floor(hash2(jx, jy, 5) * 2.99)], x: jx, y: jy });
        } else if (roll < 0.033 || (kAt(jx - 3, jy) === K.Cliff && roll < 0.2)) {
          props.push({ img: this.rocks[Math.floor(hash2(jx, jy, 6) * 3.99)], x: jx, y: jy });
        }
      }
    return { canvas: p.canvas, foam: p.foam, foam2: p.foam2, props, used: 0 };
  }

  private forest!: WorldField;
  private forestValue(x: number, y: number): number {
    // clumps of forest
    return this.forest.at(x, y);
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

  // (x, y) may be on any copy of the world; the nearest copy of each unit is tested.
  private copyNear(u: Unit, x: number, y: number): [number, number] {
    return [Math.round((x - u.x) / this.w), Math.round((y - u.y) / this.h)];
  }

  unitAt(x: number, y: number): { u: Unit; lap: [number, number] } | null {
    let best: { u: Unit; lap: [number, number] } | null = null;
    let bd = 1e9;
    for (const u of this.units) {
      const lap = this.copyNear(u, x, y);
      const uy = u.y + lap[1] * this.h - (u.kind === 'heli' ? 12 : 0);
      const d = Math.hypot(u.x + lap[0] * this.w - x, uy - y);
      if (d < STATS[u.kind].r + 3 && d < bd) {
        bd = d;
        best = { u, lap };
      }
    }
    return best;
  }

  click(x: number, y: number, add: boolean): void {
    const hit = this.unitAt(x, y);
    if (hit) {
      const u = hit.u;
      if (!add) for (const o of this.units) o.sel = false;
      u.sel = add ? !u.sel : true;
      [u.lap, u.lapY] = hit.lap;
      this.emit();
      return;
    }
    this.order(x, y);
  }

  order(x: number, y: number, shortest = false): void {
    const sel = this.selected();
    if (!sel.length) return;
    const W = this.w;
    const H = this.h;
    if (shortest) {
      // from the globe: take the shortest way
      const r = sel[0];
      [x, y] = nearestCopy(r.x, r.y, x, y, W, H);
      for (const u of sel) [u.lap, u.lapY] = this.copyNear(u, x, y);
    }
    this.markers.push({ x: ((x % W) + W) % W, y: ((y % H) + H) % H, t: 0 });
    // Work in unwrapped coordinates: each unit is where the player last saw it.
    const ux = (u: Unit) => u.x + u.lap * W;
    const uy = (u: Unit) => u.y + u.lapY * H;
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
        const d = Math.hypot(ux(u) - sx, uy(u) - sy);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const u = left.splice(bi, 1)[0];
      u.tx = u.x + (sx - ux(u));
      u.ty = u.y + (sy - uy(u)) + (u.kind === 'heli' ? 12 : 0);
      u.moving = true;
    }
  }

  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void {
    const minx = Math.min(x0, x1);
    const maxx = Math.max(x0, x1);
    const miny = Math.min(y0, y1);
    const maxy = Math.max(y0, y1);
    for (const u of this.units) {
      const lap = this.copyNear(u, (minx + maxx) / 2, (miny + maxy) / 2);
      const x = u.x + lap[0] * this.w;
      const y = u.y + lap[1] * this.h - (u.kind === 'heli' ? 12 : 0);
      const hit = x >= minx - 2 && x <= maxx + 2 && y >= miny - 2 && y <= maxy + 2;
      if (hit) {
        u.sel = true;
        [u.lap, u.lapY] = lap;
      } else if (!add) u.sel = false;
    }
    this.emit();
  }

  // Where to point the camera at the start: the middle of the first army.
  focus(): { x: number; y: number } {
    return this.home;
  }

  selectedPoints(): [number, number][] {
    return this.selected().map((u) => [u.x, u.y]);
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
              const style = k === K.Road || k === K.Sand ? 'rgba(60,45,25,0.18)' : 'rgba(30,25,15,0.14)';
              this.stamp(u.x + px, u.y + py, style);
              this.stamp(u.x - px, u.y - py, style);
              if ((k === K.Road || k === K.Sand) && Math.random() < 0.35)
                this.particles.push({ x: u.x - Math.cos(u.a) * 7, y: u.y - Math.sin(u.a) * 7, vx: (Math.random() - 0.5) * 4, vy: -3, life: 0, max: 0.8, kind: 'dust', size: 1 });
            }
          }
        }
      }
      // wrap around the world, both ways
      if (u.x < 0 || u.x >= this.w) {
        const k = Math.floor(u.x / this.w);
        u.x -= k * this.w;
        u.tx -= k * this.w;
        u.lap += k;
      }
      if (u.y < 0 || u.y >= this.h) {
        const k = Math.floor(u.y / this.h);
        u.y -= k * this.h;
        u.ty -= k * this.h;
        u.lapY += k;
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

    // water sparkles, where you are looking
    const v = this.view;
    const want = Math.floor(((v.x1 - v.x0) * (v.y1 - v.y0)) / 2500);
    for (let i = 0; i < 4 && this.sparkles.length < want; i++) {
      const x = (((Math.floor(v.x0 + Math.random() * (v.x1 - v.x0)) % this.w) + this.w) % this.w);
      const y = (((Math.floor(v.y0 + Math.random() * (v.y1 - v.y0)) % this.h) + this.h) % this.h);
      if (this.terrain.k(x, y) === K.Water && this.terrain.k(x, y - 3) === K.Water) this.sparkles.push({ x, y, life: 0 });
    }
    for (const s of this.sparkles) s.life += dt;
    this.sparkles = this.sparkles.filter((s) => s.life < 1.2);
  }

  // ---------- Rendering ----------

  // A tread mark on the ground, if that bit of ground is painted.
  private stamp(x: number, y: number, style: string): void {
    const t = this.tiles.at(x, y);
    if (!t) return;
    const c = t.canvas.getContext('2d')!;
    c.fillStyle = style;
    c.fillRect(Math.floor(x) - Math.floor(x / CH) * CH, Math.floor(y) - Math.floor(y / CH) * CH, 1, 1);
  }

  // The ground for map rect (x0, y0)-(x1, y1), in unwrapped map pixels, painted
  // a few tiles at a time (`budget` milliseconds each frame).
  renderGround(x0: number, y0: number, x1: number, y1: number, budget: number): void {
    this.view = { x0, y0, x1, y1 };
    this.tiles.begin();
    drawTiles(this.ctx, this.tiles, this.ov, OV, x0, y0, x1, y1, this.time);
    this.tiles.pump(budget);
  }

  private ov: HTMLCanvasElement | null = null;
  // Build the overview a little at a time; true once it is ready.
  mapStep(ms: number): boolean {
    if (!this.ov) this.ov = this.terrain.overview((x, y, c) => this.forestTint(x, y, c), ms);
    return this.ov !== null;
  }
  private forestTint(x: number, y: number, c: RGB): RGB {
    const f = (this.forest.at(x, y) - 0.55) * 3;
    return f > 0 ? mix(c, [18, 40, 16], Math.min(0.75, 0.25 + f * 0.6)) : c;
  }

  // Everything standing on this copy of the map within rect (x0, y0)-(x1, y1),
  // in this copy's coordinates.
  renderObjects(x0: number, y0: number, x1: number, y1: number): void {
    const c = this.ctx;
    const pad = 48;
    const inView = (x: number, y: number) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad * 1.5;

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
      if (u.kind !== 'heli' || !inView(u.x, u.y)) continue;
      const spr = this.art[u.f].heli.body;
      const di = dirIndex(u.a, DIRS);
      c.drawImage(spr.shadow[di], Math.round(u.x - spr.size / 2 + 4), Math.round(u.y - spr.size / 2 + 2));
    }

    // depth-sorted ground objects
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    const tx0 = Math.max(0, Math.floor((x0 - pad) / CH));
    const tx1 = Math.min(this.tiles.nx - 1, Math.floor((x1 + pad) / CH));
    const ty0 = Math.max(0, Math.floor((y0 - pad) / CH));
    const ty1 = Math.min(this.tiles.ny - 1, Math.floor((y1 + pad * 1.5) / CH));
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles.at(tx * CH, ty * CH);
        if (t) for (const p of t.props) if (inView(p.x, p.y)) items.push({ y: p.y, draw: () => c.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y - p.img.height + 2)) });
      }
    for (const b of this.buildings) if (inView(b.x, b.y - b.art.h / 2)) items.push({ y: b.y - 4, draw: () => this.drawBuilding(b) });
    for (const u of this.units) if (u.kind !== 'heli' && inView(u.x, u.y)) items.push({ y: u.y, draw: () => this.drawUnit(u) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // smoke and dust drift above the ground objects
    for (const p of this.particles) {
      if (p.kind === 'wake' || !inView(p.x, p.y)) continue;
      const k = p.life / p.max;
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle = p.kind === 'smoke' ? `rgba(215,215,210,${0.55 * (1 - k)})` : `rgba(160,140,100,${0.5 * (1 - k)})`;
      c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }

    // aircraft on top
    for (const u of this.units) if (u.kind === 'heli' && inView(u.x, u.y)) this.drawUnit(u);
  }

  // The whole map for the globe, one pixel per OV map pixels: the overview
  // with forests darkened, and the bases on it.
  mapImage(): HTMLCanvasElement {
    this.mapStep(1e9);
    const src = this.ov!;
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const c = cv.getContext('2d')!;
    c.drawImage(src, 0, 0);
    c.scale(1 / OV, 1 / OV);
    c.imageSmoothingEnabled = true;
    for (const b of [...this.buildings].sort((p, q) => p.y - q.y)) {
      const x = b.x - Math.floor(b.x / this.w) * this.w;
      const y = b.y - Math.floor(b.y / this.h) * this.h;
      c.drawImage(b.art.img, Math.round(x - b.art.w / 2), Math.round(y - b.art.h));
    }
    return cv;
  }

  // Units as dots of their faction's color, for the globe.
  mapDots(): [number, number, RGB][] {
    return this.units.map((u) => [u.x, u.y, FACTIONS[u.f].light]);
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
