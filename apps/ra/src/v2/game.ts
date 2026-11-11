// v2: the same sandbox as v1, drawn in 2:1 isometric with shaded voxel art.
import { RGB, WorldField, css, dirIndex, hash2, mix, nearestCopy, rng } from '../gfx';
import { CH, Tile, Tiles, drawTiles, windingRoad } from '../tiles';
import { STATS, UnitKind } from '../v1/game';
import type { Action, BuildItem, BuildMenu, GameLike } from '../types';
import { QUEUE_MAX, START_CREDITS, TABS, TECH, Tab, Tech, buildTime } from './tech';
import { HP, IsoTerrain, K, OV, Rect } from './terrain';
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

// v2 adds the Mobile Foundry to v1's units.
type Kind = UnitKind | 'mcv';
const UNIT: Record<Kind, { name: string; speed: number; turn: number; r: number; hp: number }> = {
  ...STATS,
  mcv: { name: 'Mobile Foundry', speed: 10, turn: 1.3, r: 15, hp: 1 },
};
const BNAME: Record<BuildingKind, string> = {
  yard: 'Foundry',
  hq: 'Command post',
  power: 'Generator',
  barracks: 'Barracks',
  refinery: 'Ore refinery',
  radar: 'Radar mast',
  factory: 'Vehicle works',
  tower: 'Gun tower',
  silo: 'Ore silo',
  helipad: 'Helipad',
  lab: 'Tech lab',
};
// The faction you play.
const ME = 0;
// Deploying: the Foundry vehicle turns to line up, then the yard rises.
const RISE_S = 1.8;
// Buildings that make units, and so have rally points.
const MAKERS: BuildingKind[] = ['barracks', 'factory', 'helipad'];
// How far (world units) a new building may stand from the rest of your base.
const BUILD_GAP = 30;
const PACK_S = 1.2;

interface Unit {
  kind: Kind;
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
  // Laps around the world: on screen the unit's unwrapped position is
  // (sx + lap * w, sy + lapY * h). They are set to the copy the player picked,
  // so orders go the way they panned.
  lap: number;
  lapY: number;
  deploy?: boolean; // a Foundry on its way to deploying
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
  pad: Rect;
  own: boolean; // built (or deployed) by the player
  sel: boolean;
  rise: number; // 0..1, how far it has gone up (1 when standing)
  packing?: boolean;
  rally?: [number, number]; // where new units head (world, first copy)
  primary?: boolean; // the one of its kind that makes the units
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
}

const BASE_B: BuildingKind[] = ['hq', 'power', 'factory', 'barracks', 'refinery', 'silo', 'radar', 'tower', 'tower', 'helipad', 'power'];

// Height of each unit's visual centre above the ground (for picking and brackets).
const MID: Record<Kind, number> = { mcv: 6, light: 4, heavy: 5, buggy: 4, hauler: 5, arty: 5, boat: 4, heli: 4, inf: 4, rocket: 4 };
const HELI_ALT = 20;

export class IsoGame implements GameLike {
  terrain!: IsoTerrain;
  units: Unit[] = [];
  buildings: Building[] = [];
  props: Prop[] = [];
  particles: Particle[] = [];
  markers: { x: number; y: number; z: number; t: number }[] = [];
  sparkles: { x: number; y: number; life: number }[] = [];
  sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
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

  mapVersion = 0;

  private emit(): void {
    const b = this.selB();
    this.onSelect(b ? [MAKERS.includes(b.kind) ? `${BNAME[b.kind]} · tap ground: rally point` : BNAME[b.kind]] : this.selected().map((u) => UNIT[u.kind].name));
  }

  private selB(): Building | undefined {
    return this.buildings.find((b) => b.sel);
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

  // The planet is big, so there are several bases round it: the two home
  // bases near each other where the camera starts, and outposts further out.
  // Sites are chosen on the screen-space map and placed on the ground below.
  generate(w: number, h: number): void {
    const rand = rng(this.seed * 7919 + 29);
    const T = (this.terrain = new IsoTerrain(w, h, this.seed));
    this.units = [];
    this.buildings = [];
    this.props = [];
    this.particles = [];
    this.markers = [];
    this.sparkles = [];
    this.sparks = [];
    this.lastTap = null;
    this.mapVersion++;
    this.credits = START_CREDITS;
    this.jobs = new Map();
    this.queue = new Map();
    this.known = new Set();
    this.fresh = new Set();
    this.ghost = null;
    this.forestF = new WorldField(w, h, 50, this.seed + 500, 2, 10);
    this.ov = null;

    const wrapD = (ax: number, ay: number, bx: number, by: number) => {
      const [x, y] = nearestCopy(ax, ay, bx, by, w, h);
      return Math.hypot(x - ax, (y - ay) * 2);
    };
    type Site = { sx: number; sy: number; f: number; home: boolean };
    const sites: Site[] = [
      { sx: 1440 * 0.24, sy: 720 * 0.44, f: 0, home: true },
      { sx: 1440 * 0.74, sy: 720 * 0.3, f: 1, home: true },
    ];
    const want = Math.max(2, Math.round((w * h) / 9e6));
    const gap = Math.sqrt((w * h) / want) * 0.6;
    const flat = (sx: number, sy: number) => {
      const [x, y] = T.at(sx, sy);
      return T.k(x, y) === K.Grass && T.k(x + 40, y + 40) === K.Grass && T.k(x - 40, y - 40) === K.Grass;
    };
    for (let i = 0; i < 3000 && sites.length < want + 2; i++) {
      const sx = rand() * w;
      const sy = rand() * h;
      if (sites.some((o) => wrapD(o.sx, o.sy, sx, sy) < gap)) continue;
      if (!flat(sx, sy)) continue;
      sites.push({ sx, sy, f: sites.length % 2, home: false });
    }
    // roads from each base to its two nearest neighbours
    const lines: [number, number][][] = [];
    const done = new Set<string>();
    sites.forEach((a, i) => {
      const near = sites
        .map((b, j) => ({ j, d: wrapD(a.sx, a.sy, b.sx, b.sy) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 2);
      for (const { j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (done.has(key)) continue;
        done.add(key);
        const [bsx, bsy] = nearestCopy(a.sx, a.sy, sites[j].sx, sites[j].sy, w, h);
        const [ax, ay] = T.at(a.sx, a.sy);
        const [bx, by] = T.at(bsx, bsy);
        lines.push(windingRoad(ax, ay, bx, by, rand));
      }
    });
    T.setRoads(lines);

    const pads: Rect[] = [];
    const place = (kinds: BuildingKind[], f: number, sx: number, sy: number) => {
      const [cx, cy] = T.at(sx, sy);
      for (const kind of kinds) {
        const art = this.buildingArt(kind, f);
        let ok = false;
        for (let ring = 0; ring < 70 && !ok; ring++) {
          const tries = ring === 0 ? 1 : 10 + ring * 2;
          for (let t = 0; t < tries && !ok; t++) {
            const ang = rand() * Math.PI * 2;
            const x = Math.round(cx + Math.cos(ang) * ring * 4);
            const y = Math.round(cy + Math.sin(ang) * ring * 4);
            const pad = { x: x - art.rx - 3, y: y - art.ry - 3, w: art.rx * 2 + 6, h: art.ry * 2 + 6 };
            if (!T.clear(pad, 1)) continue;
            if (pads.some((p) => overlap(p, pad, 4))) continue;
            pads.push(pad);
            T.markPad(pad);
            this.buildings.push({ kind, f, x, y, art, phase: rand() * 10, gun: rand() * Math.PI * 2, gunGoal: rand() * Math.PI * 2, pad, own: false, sel: false, rise: 1 });
            ok = true;
          }
        }
      }
    };
    const OUTPOST: BuildingKind[] = ['hq', 'power', 'barracks', 'refinery', 'silo', 'tower', 'tower', 'radar', 'factory', 'helipad'];
    // your home base is still to be built: you start with a Foundry vehicle
    for (const st of sites) if (!(st.home && st.f === ME)) place(st.home ? BASE_B : OUTPOST.slice(0, 5 + Math.floor(rand() * 5)), st.f, st.sx, st.sy);

    // a little clutter beside some buildings
    for (const b of this.buildings) {
      if (!['factory', 'refinery', 'barracks', 'hq'].includes(b.kind)) continue;
      const ci = b.kind === 'barracks' ? 2 : Math.floor(rand() * 2);
      const x = b.x + b.art.rx + 4;
      const y = b.y + (rand() - 0.5) * b.art.ry;
      if (T.k(x, y) === K.Pad || T.k(x, y) === K.Grass) this.props.push({ spr: this.clutter[ci], x, y, z: 0 });
    }

    // armies
    const spawn = (kind: Kind, f: number, csx: number, csy: number, spread: number): Unit | null => {
      for (let t = 0; t < 300; t++) {
        const sx = csx + (rand() - 0.5) * spread * 2;
        const sy = csy + (rand() - 0.5) * spread;
        let [x, y] = toWorld(sx, sy, 0);
        const k = T.k(x, y);
        const water = (dx: number, dy: number) => T.k(x + dx, y + dy) === K.Water;
        const ok =
          kind === 'boat'
            ? water(0, 0) && water(12, 0) && water(-12, 0) && water(0, 12) && water(0, -12)
            : kind === 'heli' || k === K.Grass || k === K.Road || k === K.Pad;
        if (!ok || T.isHigh(x, y)) continue;
        if (kind !== 'heli' && this.buildings.some((b) => Math.abs(b.x - x) < b.art.rx + 3 && Math.abs(b.y - y) < b.art.ry + 3)) continue;
        [x, y] = T.fold(x, y);
        const a = rand() * Math.PI * 2;
        if (kind === 'mcv' && !this.siteOk(this.siteOf(x, y))) continue;
        const u = this.newUnit(kind, f, x, y, a);
        u.anim = rand() * 10;
        u.idle = rand() * 4;
        return u;
      }
      return null;
    };
    const army: [Kind, number][] = [
      ['light', 4],
      ['heavy', 2],
      ['buggy', 2],
      ['hauler', 1],
      ['arty', 1],
      ['heli', 1],
      ['inf', 6],
      ['rocket', 3],
    ];
    // you start with a handful: the Foundry vehicle and a small escort
    const start: [Kind, number][] = [
      ['mcv', 1],
      ['light', 2],
      ['buggy', 1],
      ['inf', 3],
    ];
    // the Foundry vehicle starts on the nearest open ground to your home site
    const hs = sites[0];
    let ms: [number, number] = [hs.sx, hs.sy];
    found: for (let r = 0; r < 1200; r += 12)
      for (let t = 0; t < Math.max(1, r / 6); t++) {
        const a = rand() * Math.PI * 2;
        const sx = hs.sx + Math.cos(a) * r;
        const sy = hs.sy + Math.sin(a) * r * 0.5;
        const [x, y] = toWorld(sx, sy, 0);
        if (this.siteOk(this.siteOf(x, y))) {
          ms = [sx, sy];
          break found;
        }
      }
    const mine: [number, number][] = [];
    for (const st of sites)
      for (const [kind, c] of st.home && st.f === ME ? start : army)
        for (let i = 0; i < (st.home && st.f === ME ? c : Math.max(1, Math.round(c * (st.home ? 1.4 : 0.6)))); i++) {
          const own = st.home && st.f === ME;
          const u = own ? (kind === 'mcv' ? spawn(kind, st.f, ms[0], ms[1], 0.5) ?? this.newUnit('mcv', ME, ...T.fold(...toWorld(ms[0], ms[1], 0)), 0) : spawn(kind, st.f, ms[0], ms[1] + 45, 70)) : spawn(kind, st.f, st.sx + (st.home ? 60 : 0), st.sy + (st.home ? 140 : 70), st.home ? 220 : 150);
          if (u && own) mine.push(toScreen(u.x, u.y));
        }
    // boats on the nearest lake to home
    const hx = (sites[0].sx + sites[1].sx) / 2;
    const hy = (sites[0].sy + sites[1].sy) / 2;
    let lake: [number, number] | null = null;
    for (let r = 100; r < 3000 && !lake; r += 100)
      for (let t = 0; t < 40 && !lake; t++) {
        const a = rand() * Math.PI * 2;
        const sx = hx + Math.cos(a) * r;
        const sy = hy + Math.sin(a) * r * 0.5;
        const [x, y] = toWorld(sx, sy, 0);
        if (T.k(x, y) === K.Water && T.k(x + 30, y) === K.Water && T.k(x - 30, y) === K.Water && T.k(x, y + 30) === K.Water && T.k(x, y - 30) === K.Water) lake = [sx, sy];
      }
    if (lake) for (let f = 0; f < 2; f++) for (let i = 0; i < 2; i++) spawn('boat', f, lake[0], lake[1], 40);
    for (const u of this.units) u.z = this.groundZ(u);

    this.home = mine.length ? { x: mine.reduce((a, p) => a + p[0], 0) / mine.length, y: mine.reduce((a, p) => a + p[1], 0) / mine.length } : { x: sites[0].sx, y: sites[0].sy };
    this.tiles = new Tiles(w, h, (tx, ty) => this.buildTile(tx, ty));
    this.emit();
  }

  private home = { x: 0, y: 0 };
  private lastTap: { u: Unit; t: number } | null = null;

  private newUnit(kind: Kind, f: number, x: number, y: number, a: number): Unit {
    const u: Unit = { kind, f, x, y, z: this.terrain.elev(x, y), a, turret: a, turretGoal: a, tx: x, ty: y, moving: false, sel: false, anim: 0, hp: UNIT[kind].hp, idle: 2, trackAcc: 0, lap: 0, lapY: 0 };
    this.units.push(u);
    return u;
  }

  // ---------- Building: credits, the build menu and placing ----------

  credits = START_CREDITS;
  // what each tab of the menu is working on (one thing at a time)
  private jobs = new Map<Tab, { tech: Tech; spent: number; paused: boolean; ready: boolean }>();
  // units waiting behind the one being made, per tab
  private queue = new Map<Tab, Tech[]>();
  private known = new Set<string>(); // items that have been on the menu
  private fresh = new Set<string>(); // ...and those not looked at yet
  private ghost: { tech: Tech; x: number; y: number; pad: Rect; why: string } | null = null;
  private icons = new Map<string, string>();
  onNotice: (msg: string) => void = () => {};
  private noted = new Map<string, number>();

  // A message for the player, at most every few seconds for the same one.
  private notice(msg: string): void {
    const t = this.noted.get(msg) ?? -1e9;
    if (this.time - t < 4) return;
    this.noted.set(msg, this.time);
    this.onNotice(msg);
  }

  // Kinds of building you have standing.
  private have(): Set<BuildingKind> {
    const s = new Set<BuildingKind>();
    for (const b of this.buildings) if (b.own && b.rise >= 1 && !b.packing) s.add(b.kind);
    return s;
  }

  private available(have = this.have()): Tech[] {
    return TECH.filter((t) => t.needs.every((k) => have.has(k)));
  }

  private icon(t: Tech): string {
    let url = this.icons.get(t.id);
    if (!url) {
      const W = 64;
      const H = 48;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d')!;
      if (t.building) {
        const spr = this.buildingArt(t.building, ME).spr.img;
        const k = Math.min(W / spr.width, H / spr.height) * 1.15;
        c.imageSmoothingQuality = 'high';
        c.drawImage(spr, (W - spr.width * k) / 2, (H - spr.height * k) / 2 + 2, spr.width * k, spr.height * k);
      } else {
        // the unit itself, facing down and to the left, blown up in whole pixels
        const kind = t.unit as Kind;
        const a = Math.PI * 0.62;
        const art = this.art[ME];
        const di = dirIndex(a, DIRS);
        const layers: StackSprite[] =
          kind === 'inf' || kind === 'rocket'
            ? [(kind === 'inf' ? art.infantry : art.rocket)[0][dirIndex(a, 16)]]
            : kind === 'light'
              ? [art.lightTank[di], art.lightTurret[di]]
              : kind === 'heavy'
                ? [art.heavyTank[di], art.heavyTurret[di]]
                : [{ mcv: art.mcv, buggy: art.buggy, hauler: art.hauler, arty: art.artillery, heli: art.heli, boat: art.boat }[kind as 'mcv'][di]];
        const base = layers[0];
        const k = Math.max(1, Math.min(3, Math.floor(Math.min(W / (base.img.width * 0.55), H / (base.img.height * 0.65)))));
        c.imageSmoothingEnabled = false;
        c.translate(W / 2, H / 2 + 4);
        c.scale(k, k);
        for (const s of layers) c.drawImage(s.img, -s.cx, -s.cy);
      }
      url = cv.toDataURL();
      this.icons.set(t.id, url);
    }
    return url;
  }

  private queued(t: Tech): number {
    return (this.queue.get(t.tab) ?? []).filter((q) => q === t).length;
  }

  buildMenu(): BuildMenu | null {
    const have = this.have();
    const avail = this.available(have);
    if (!avail.length && !this.jobs.size) return null;
    const items: BuildItem[] = [];
    const list = [...avail];
    for (const j of this.jobs.values()) if (!list.includes(j.tech)) list.push(j.tech);
    for (const t of list) {
      const j = this.jobs.get(t.tab);
      const mine = j && j.tech === t;
      let blocked: string | undefined;
      if (t.building && !have.has('yard')) blocked = 'Needs a Foundry';
      else if (t.building && j && !mine) blocked = `Busy: ${j.tech.name}`;
      else if (!mine && this.credits <= 0) blocked = 'No credits';
      items.push({
        id: t.id,
        name: t.name,
        tab: t.tab,
        cost: t.cost,
        icon: this.icon(t),
        blurb: t.blurb,
        state: !mine ? 'idle' : j.ready ? 'ready' : j.paused ? 'paused' : 'building',
        progress: mine ? j.spent / t.cost : 0,
        count: (mine ? 1 : 0) + this.queued(t),
        isNew: this.fresh.has(t.id),
        blocked,
      });
    }
    const tabs = TABS.filter((tb) => items.some((i) => i.tab === tb.id));
    return { credits: Math.floor(this.credits), tabs, items };
  }

  seen(id: string): void {
    this.fresh.delete(id);
  }

  buildTap(id: string): void {
    const t = TECH.find((x) => x.id === id);
    if (!t) return;
    this.fresh.delete(id);
    const j = this.jobs.get(t.tab);
    if (t.unit) {
      // units queue up: tap again for another (a held one starts again)
      if (j && j.tech === t && j.paused) {
        j.paused = false;
        return;
      }
      if (!this.available().includes(t)) return;
      if ((j?.tech === t ? 1 : 0) + this.queued(t) >= QUEUE_MAX) return;
      if (!j) this.jobs.set(t.tab, { tech: t, spent: 0, paused: false, ready: false });
      else {
        const q = this.queue.get(t.tab) ?? [];
        q.push(t);
        this.queue.set(t.tab, q);
      }
      return;
    }
    if (j && j.tech === t) {
      if (j.ready) this.startPlace(t);
      else j.paused = !j.paused;
      return;
    }
    if (j) {
      this.notice(`Busy building ${j.tech.name}`);
      return;
    }
    if (!this.available().includes(t)) return;
    if (t.building && !this.have().has('yard')) return;
    this.jobs.set(t.tab, { tech: t, spent: 0, paused: false, ready: false });
  }

  buildCancel(id: string): void {
    const t = TECH.find((x) => x.id === id);
    if (!t) return;
    // a queued unit goes first (one at a time), then the one being made
    const q = this.queue.get(t.tab) ?? [];
    const qi = q.lastIndexOf(t);
    if (qi >= 0) {
      q.splice(qi, 1);
      return;
    }
    const j = this.jobs.get(t.tab);
    if (!j || j.tech !== t) return;
    this.credits += j.spent;
    this.nextJob(t.tab);
    if (this.ghost?.tech === t) this.ghost = null;
  }

  // The tab's job is done with: start the next one in its queue.
  private nextJob(tab: Tab): void {
    this.jobs.delete(tab);
    const q = this.queue.get(tab);
    const n = q?.shift();
    if (n) this.jobs.set(tab, { tech: n, spent: 0, paused: false, ready: false });
  }

  // A finished unit comes out of the building that makes it (the one picked
  // as primary, or the newest) and heads for its rally point.
  private deliver(t: Tech): boolean {
    const makers = this.buildings.filter((b) => b.own && b.kind === t.from && b.rise >= 1 && !b.packing);
    if (!makers.length) return false;
    const b = makers.find((m) => m.primary) ?? makers[makers.length - 1];
    const kind = t.unit as Kind;
    const air = kind === 'heli';
    // out of the door on the near (+y) side, or up off the helipad
    const x = air ? b.x : b.x + (Math.random() - 0.5) * 6;
    const y = air ? b.y : b.y + b.art.ry - 2;
    const [fx, fy] = this.fold(x, y);
    const u = this.newUnit(kind, ME, fx, fy, Math.PI / 2);
    const [rx, ry] = b.rally ?? [b.x + (Math.random() - 0.5) * 30, b.y + b.art.ry + 22 + Math.random() * 14];
    u.tx = rx + (b.rally ? (Math.random() - 0.5) * 16 : 0);
    u.ty = ry + (b.rally ? (Math.random() - 0.5) * 16 : 0);
    // the rally point is near the building, so go the short way round
    [u.tx, u.ty] = this.nearPoint(u.x, u.y, u.tx, u.ty);
    u.moving = true;
    this.mapVersion++;
    return true;
  }

  // The copy of world point (x, y) nearest (ax, ay).
  private nearPoint(ax: number, ay: number, x: number, y: number): [number, number] {
    const [asx, asy] = toScreen(ax, ay);
    const [sx, sy] = toScreen(x, y);
    const [nx, ny] = nearestCopy(asx, asy, sx, sy, this.w, this.h);
    return toWorld(nx, ny, 0);
  }

  private updateBuild(dt: number): void {
    const have = this.have();
    // newly opened options
    let opened = false;
    for (const t of this.available(have))
      if (!this.known.has(t.id)) {
        this.known.add(t.id);
        this.fresh.add(t.id);
        opened = true;
      }
    if (opened) this.notice('New construction options');
    for (const j of this.jobs.values()) {
      if (j.ready || j.paused) continue;
      if (j.tech.building && !have.has('yard')) continue;
      if (j.tech.unit && !j.tech.needs.every((k) => have.has(k))) continue;
      const want = (j.tech.cost / buildTime(j.tech.cost)) * dt;
      const pay = Math.min(want, this.credits, j.tech.cost - j.spent);
      this.credits -= pay;
      j.spent += pay;
      if (pay < want - 1e-6 && j.spent < j.tech.cost - 1e-6) this.notice('Not enough credits');
      if (j.spent >= j.tech.cost - 1e-6) {
        j.spent = j.tech.cost;
        if (j.tech.unit) {
          if (this.deliver(j.tech)) {
            this.notice(`${j.tech.name} ready`);
            this.nextJob(j.tech.tab);
          }
        } else {
          j.ready = true;
          this.notice(`${j.tech.name} ready: tap it to place`);
        }
      }
    }
  }

  // ---------- Placing a finished building ----------

  placing(): boolean {
    return this.ghost !== null;
  }

  private startPlace(t: Tech): void {
    this.ghost = { tech: t, x: 0, y: 0, pad: { x: 0, y: 0, w: 0, h: 0 }, why: '' };
    // until main.ts moves it: next to your Foundry
    const yard = this.buildings.find((b) => b.own && b.kind === 'yard');
    if (yard) {
      const [sx, sy] = toScreen(yard.x, yard.y + yard.art.ry + 40);
      this.placeAt(sx, sy);
    }
    for (const u of this.units) u.sel = false;
    for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  placeAt(x: number, y: number): void {
    const gh = this.ghost;
    if (!gh) return;
    const art = this.buildingArt(gh.tech.building!, ME);
    let [wx, wy] = this.fold(...toWorld(x, y, 0));
    wx = Math.round(wx / 4) * 4;
    wy = Math.round(wy / 4) * 4;
    gh.x = wx;
    gh.y = wy;
    gh.pad = { x: wx - art.rx - 3, y: wy - art.ry - 3, w: art.rx * 2 + 6, h: art.ry * 2 + 6 };
    gh.why = this.placeWhy(gh.pad);
  }

  // Why a building can't go on pad r ('' if it can): it needs clear, level
  // ground next to the rest of your base.
  private placeWhy(r: Rect): string {
    if (!this.siteOk(r)) return 'Blocked: needs open, level ground';
    const [gsx, gsy] = toScreen(r.x + r.w / 2, r.y + r.h / 2);
    for (const b of this.buildings) {
      if (!b.own) continue;
      const [bsx, bsy] = toScreen(b.x, b.y);
      const [nx, ny] = nearestCopy(gsx, gsy, bsx, bsy, this.w, this.h);
      const [bx, by] = toWorld(nx, ny, 0);
      const gx = Math.abs(bx - (r.x + r.w / 2)) - (r.w + b.pad.w) / 2;
      const gy = Math.abs(by - (r.y + r.h / 2)) - (r.h + b.pad.h) / 2;
      if (Math.max(gx, gy) <= BUILD_GAP) return '';
    }
    return 'Too far from your base';
  }

  private placeNow(): void {
    const gh = this.ghost;
    if (!gh || gh.why) return;
    const t = gh.tech;
    const art = this.buildingArt(t.building!, ME);
    const b: Building = { kind: t.building!, f: ME, x: gh.x, y: gh.y, art, phase: 0, gun: 0, gunGoal: 0, pad: gh.pad, own: true, sel: false, rise: 0 };
    this.buildings.push(b);
    this.clearSite(gh.pad, null);
    this.setPad(gh.pad, true);
    this.puff(b, 12);
    this.jobs.delete(t.tab);
    this.ghost = null;
    this.emit();
  }

  // Everyone standing on rect r (but `keep`) drives off it.
  private clearSite(r: Rect, keep: Unit | null): void {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    for (const o of this.units) {
      if (o === keep || o.kind === 'heli' || o.kind === 'boat') continue;
      if (!inside(o.x, o.y, r, 6) && !(o.moving && inside(o.tx, o.ty, r, 6))) continue;
      let dx = o.x - cx;
      let dy = o.y - cy;
      if (Math.hypot(dx, dy) < 1) dx = 1;
      const k = Math.max(Math.abs(dx) / (r.w / 2), Math.abs(dy) / (r.h / 2));
      o.tx = cx + dx / k + Math.sign(dx) * 10;
      o.ty = cy + dy / k + Math.sign(dy) * 10;
      o.moving = true;
    }
  }

  // ---------- Foundry: deploy and pack up ----------

  // The pad a Foundry standing at (x, y) would deploy onto.
  private siteOf(x: number, y: number): Rect {
    const a = this.buildingArt('yard', ME);
    const cx = Math.round(x);
    const cy = Math.round(y);
    return { x: cx - a.rx - 3, y: cy - a.ry - 3, w: a.rx * 2 + 6, h: a.ry * 2 + 6 };
  }

  // Open, level grass, away from other buildings.
  private siteOk(r: Rect): boolean {
    return this.terrain.clear(r, 1);
  }

  private deployable(u: Unit): boolean {
    return u.kind === 'mcv' && u.f === ME && this.siteOk(this.siteOf(u.x, u.y));
  }

  actions(): Action[] {
    if (this.ghost) {
      const why = this.ghost.why;
      return [
        { id: 'place', label: 'Place', icon: 'ok', disabled: !!why, title: why || `Put the ${this.ghost.tech.name} here` },
        { id: 'unplace', label: 'Cancel', icon: 'x', title: 'Keep it for later' },
      ];
    }
    const b = this.selB();
    if (b) {
      if (b.own && b.kind === 'yard') return [{ id: 'pack', label: 'Pack up', icon: 'pack', disabled: b.rise < 1, title: 'Pack the Foundry back into a vehicle' }];
      if (b.own && MAKERS.includes(b.kind)) {
        const acts: Action[] = [];
        if (this.buildings.filter((o) => o.own && o.kind === b.kind).length > 1)
          acts.push({ id: 'primary', label: b.primary ? 'Primary' : 'Make primary', icon: 'star', disabled: !!b.primary, title: 'New units come out of this one' });
        if (b.rally) acts.push({ id: 'unrally', label: 'Clear rally', icon: 'x', title: 'New units wait by the door' });
        return acts;
      }
      return [];
    }
    const mcvs = this.selected().filter((u) => u.kind === 'mcv' && u.f === ME);
    if (!mcvs.length) return [];
    const ok = mcvs.some((u) => !u.deploy && this.deployable(u));
    return [{ id: 'deploy', label: 'Deploy', icon: 'deploy', disabled: !ok, title: ok ? 'Deploy into a Foundry (D)' : 'Needs open, level ground: move somewhere clear' }];
  }

  act(id: string): void {
    const sb = this.selB();
    if (id === 'primary' && sb) for (const o of this.buildings) o.primary = o.own && o.kind === sb.kind ? o === sb : o.primary;
    if (id === 'unrally' && sb) sb.rally = undefined;
    if (id === 'place') this.placeNow();
    else if (id === 'unplace') this.ghost = null;
    else if (id === 'deploy') {
      for (const u of this.selected()) if (!u.deploy && this.deployable(u)) this.startDeploy(u);
    } else if (id === 'pack') {
      const b = this.selB();
      if (b && b.own && b.kind === 'yard' && b.rise >= 1) b.packing = true;
    }
  }

  private startDeploy(u: Unit): void {
    u.deploy = true;
    u.moving = false;
    u.tx = u.x;
    u.ty = u.y;
    // clear the way: everyone else standing on the site drives off it
    this.clearSite(this.siteOf(u.x, u.y), u);
  }

  // The Foundry vehicle has lined up: it unfolds into the yard.
  private deployNow(u: Unit): void {
    const pad = this.siteOf(u.x, u.y);
    if (!this.siteOk(pad)) {
      u.deploy = false;
      return;
    }
    this.units.splice(this.units.indexOf(u), 1);
    const art = this.buildingArt('yard', u.f);
    const b: Building = { kind: 'yard', f: u.f, x: pad.x + pad.w / 2, y: pad.y + pad.h / 2, art, phase: 0, gun: 0, gunGoal: 0, pad, own: true, sel: u.sel, rise: 0 };
    this.buildings.push(b);
    if (u.sel) for (const o of this.units) o.sel = false;
    this.setPad(pad, true);
    this.puff(b, 14);
    this.emit();
  }

  private packNow(b: Building): void {
    this.buildings.splice(this.buildings.indexOf(b), 1);
    this.setPad(b.pad, false);
    const u = this.newUnit('mcv', b.f, b.x, b.y, 0);
    u.sel = b.sel;
    this.puff(b, 8);
    this.emit();
  }

  // Lay or lift a building's concrete, and repaint the ground under it.
  private setPad(pad: Rect, on: boolean): void {
    if (on) this.terrain.markPad(pad);
    else this.terrain.unmarkPad(pad);
    const pts = [toScreen(pad.x, pad.y), toScreen(pad.x + pad.w, pad.y), toScreen(pad.x, pad.y + pad.h), toScreen(pad.x + pad.w, pad.y + pad.h)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this.tiles.redo(Math.min(...xs) - 24, Math.min(...ys) - 24, Math.max(...xs) + 24, Math.max(...ys) + 24);
    this.mapVersion++;
  }

  // A burst of dust round a building's footprint.
  private puff(b: Building, n: number): void {
    for (let i = 0; i < n; i++) {
      const t = Math.random() * 4;
      const s = (t % 1) * 2 - 1;
      const side = Math.floor(t);
      const lx = side < 2 ? (side ? 1 : -1) * b.art.rx : s * b.art.rx;
      const ly = side < 2 ? s * b.art.ry : (side === 3 ? 1 : -1) * b.art.ry;
      const [sx, sy] = toScreen(b.x + lx, b.y + ly, 1);
      this.particles.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 8, vy: -3 - Math.random() * 3, life: 0, max: 1 + Math.random() * 0.8, kind: 'dust', size: 1.5 });
    }
  }
  private forestF!: WorldField;
  tiles!: Tiles<Prop>;
  private view = { x0: 0, y0: 0, x1: 0, y1: 0 };

  // Paint one tile of ground and scatter its trees, bushes and rocks.
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
    const SX0 = tx * CH;
    const SY0 = ty * CH;
    for (let sy = SY0 + ((((6 - SY0) % 5) + 5) % 5); sy < SY0 + CH; sy += 5)
      for (let sx = SX0 + ((((2 - SX0) % 7) + 7) % 7); sx < SX0 + CH; sx += 7) {
        const jx = sx + hash2(sx, sy, forestSeed) * 6;
        const jy = sy + hash2(sy, sx, forestSeed) * 4;
        // a prop may sit on a plateau: test the high ground first
        let [wx, wy] = toWorld(jx, jy, HP);
        let z = HP;
        if (kAt(wx, wy) !== K.High) {
          [wx, wy] = toWorld(jx, jy, 0);
          z = 0;
          if (kAt(wx, wy) === K.High) continue; // that spot is a cliff face
        }
        const k = kAt(wx, wy);
        if (k !== K.Grass && k !== K.High) continue;
        // keep clear of building pads, more so in front of them where a tree would hide them
        if (kAt(wx + 5, wy) === K.Pad || kAt(wx - 9, wy) === K.Pad || kAt(wx, wy + 5) === K.Pad || kAt(wx, wy - 9) === K.Pad || kAt(wx - 8, wy - 8) === K.Pad || kAt(wx - 4, wy + 4) === K.Pad || kAt(wx + 4, wy - 4) === K.Pad) continue;
        const forest = (this.forestF.at(jx, jy) - 0.6) * 2.4;
        const roll = hash2(Math.floor(wx), Math.floor(wy), forestSeed + 1);
        let spr: StackSprite | null = null;
        if (roll < forest) spr = this.trees[Math.floor(hash2(sx, sy, 3) * 5)];
        else if (roll < 0.014) spr = this.trees[5 + Math.floor(hash2(sx, sy, 4) * 3)];
        else if (roll < 0.035) spr = this.bushes[Math.floor(hash2(sx, sy, 5) * 3)];
        else if (roll < 0.045 || (z === HP && roll < 0.09)) spr = this.rocks[Math.floor(hash2(sx, sy, 6) * 4)];
        if (spr) props.push({ spr, x: wx, y: wy, z });
      }
    return { canvas: p.canvas, foam: p.foam, foam2: p.foam2, props, used: 0 };
  }

  private groundZ(u: Unit): number {
    if (u.kind === 'boat') return 0;
    return this.terrain.elev(u.x, u.y);
  }

  // ---------- Input (screen coordinates) ----------

  private screenOf(u: Unit): [number, number] {
    const alt = u.kind === 'heli' ? HELI_ALT : 0;
    return toScreen(u.x, u.y, u.z + alt + MID[u.kind]);
  }

  private groundAt(sx: number, sy: number): [number, number] {
    for (let z = HP; z > 0; z--) {
      const [x, y] = toWorld(sx, sy, z);
      if (this.terrain.isHigh(x, y)) return [x, y];
    }
    return toWorld(sx, sy, 0);
  }

  // The copy of unit u nearest screen point (x, y), as laps across and down.
  private copyNear(u: Unit, x: number, y: number): [number, number] {
    const [sx, sy] = toScreen(u.x, u.y);
    return [Math.round((x - sx) / this.w), Math.round((y - sy) / this.h)];
  }

  // Screen (x, y) may be on any copy of the world; each unit's nearest copy is tested.
  click(x: number, y: number, add: boolean): void {
    let best: Unit | null = null;
    let bestLap: [number, number] = [0, 0];
    let bd = 1e9;
    for (const u of this.units) {
      const lap = this.copyNear(u, x, y);
      const [sx, sy] = this.screenOf(u);
      const d = Math.hypot(sx + lap[0] * this.w - x, sy + lap[1] * this.h - y);
      if (d < UNIT[u.kind].r + 4 && d < bd) {
        bd = d;
        best = u;
        bestLap = lap;
      }
    }
    if (best) {
      // a second tap on a lone Foundry vehicle deploys it
      const now = performance.now();
      const again = this.lastTap && this.lastTap.u === best && now - this.lastTap.t < 400 && best.sel && !add;
      this.lastTap = { u: best, t: now };
      for (const b of this.buildings) b.sel = false;
      if (!add) for (const o of this.units) o.sel = false;
      best.sel = add ? !best.sel : true;
      [best.lap, best.lapY] = bestLap;
      if (again && this.deployable(best) && !best.deploy) this.startDeploy(best);
      this.emit();
      return;
    }
    this.lastTap = null;
    const hit = this.buildingAt(x, y);
    // with units selected, a tap on a building is still a move order
    if (hit && hit.own && !this.selected().length) {
      for (const b of this.buildings) b.sel = b === hit;
      this.emit();
      return;
    }
    const sb = this.selB();
    if (sb) {
      // with a barracks, works or helipad selected, a tap on the ground sets
      // where its new units go
      if (MAKERS.includes(sb.kind) && sb.rise >= 1) {
        const [wx, wy] = this.fold(...this.groundAt(x, y));
        sb.rally = [wx, wy];
        this.markers.push({ x: wx, y: wy, z: this.terrain.elev(wx, wy), t: 0 });
        return;
      }
      this.deselect();
      return;
    }
    this.order(x, y);
  }

  // The building under screen point (x, y), on any copy of the map.
  private buildingAt(x: number, y: number): Building | null {
    for (const b of this.buildings) {
      const [bsx, bsy] = toScreen(b.x, b.y);
      const lx = Math.round((x - bsx) / this.w) * this.w;
      const ly = Math.round((y - bsy) / this.h) * this.h;
      for (let z = 0; z <= 24; z += 3) {
        const [wx, wy] = toWorld(x - lx, y - ly, z);
        if (Math.abs(wx - b.x) <= b.art.rx && Math.abs(wy - b.y) <= b.art.ry) return b;
      }
    }
    return null;
  }

  // Shift a world point by whole laps around the world, across and down.
  private lapped(x: number, y: number, lap: number, lapY: number): [number, number] {
    const k = (lap * this.w) / 2;
    const j = lapY * this.h;
    return [x + k + j, y - k + j];
  }

  // Bring a ground point back onto the first copy of the map.
  private fold(wx: number, wy: number): [number, number] {
    const [sx, sy] = toScreen(wx, wy);
    return this.lapped(wx, wy, -Math.floor(sx / this.w), -Math.floor(sy / this.h));
  }

  order(x: number, y: number, shortest = false): void {
    const sel = this.units.filter((u) => u.sel && !u.deploy);
    if (!sel.length) return;
    if (shortest) {
      // from the globe: take the shortest way
      const [rx, ry] = toScreen(sel[0].x, sel[0].y);
      [x, y] = nearestCopy(rx, ry, x, y, this.w, this.h);
      for (const u of sel) [u.lap, u.lapY] = this.copyNear(u, x, y);
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
        const [ux, uy] = this.lapped(u.x, u.y, u.lap, u.lapY);
        const d = Math.hypot(ux - sx, uy - sy);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const u = left.splice(bi, 1)[0];
      // the same move, in the unit's own (folded) coordinates
      [u.tx, u.ty] = this.lapped(sx, sy, -u.lap, -u.lapY);
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
      const [ux, uy] = this.screenOf(u);
      const sx = ux + lap[0] * this.w;
      const sy = uy + lap[1] * this.h;
      const hit = sx >= minx - 3 && sx <= maxx + 3 && sy >= miny - 3 && sy <= maxy + 3;
      if (hit) {
        u.sel = true;
        [u.lap, u.lapY] = lap;
      } else if (!add) u.sel = false;
    }
    if (this.units.some((u) => u.sel)) for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  focus(): { x: number; y: number } {
    return this.home;
  }

  selectedPoints(): [number, number][] {
    const b = this.selB();
    return b ? [toScreen(b.x, b.y)] : this.selected().map((u) => toScreen(u.x, u.y));
  }

  deselect(): void {
    for (const u of this.units) u.sel = false;
    for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  selected(): Unit[] {
    return this.units.filter((u) => u.sel);
  }

  // ---------- Simulation ----------

  update(dt: number): void {
    this.time += dt;
    this.updateBuild(dt);
    for (const u of [...this.units]) {
      const st = UNIT[u.kind];
      u.anim += dt;
      if (u.deploy) {
        // line up square with the map, then unfold
        const diff = angDiff(0, u.a);
        const stepA = st.turn * 2.5 * dt;
        u.a = Math.abs(diff) <= stepA ? 0 : u.a + Math.sign(diff) * stepA;
        if (u.a === 0) {
          this.deployNow(u);
          continue;
        }
      }
      const foot = u.kind === 'inf' || u.kind === 'rocket';
      if (u.moving && !u.deploy) {
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
              const hw = u.kind === 'mcv' ? 7.5 : u.kind === 'heavy' ? 6 : u.kind === 'buggy' ? 4 : 5;
              const px = -Math.sin(u.a) * hw;
              const py = Math.cos(u.a) * hw;
              const style = k === K.Road || k === K.Sand ? 'rgba(60,45,25,0.2)' : k === K.Pad ? 'rgba(30,30,30,0.08)' : 'rgba(25,22,12,0.16)';
              const [ax, ay] = toScreen(u.x + px, u.y + py);
              const [bx, by] = toScreen(u.x - px, u.y - py);
              this.stamp(ax, ay, style);
              this.stamp(bx, by, style);
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
      // wrap around the world, both ways
      const [usx, usy] = toScreen(u.x, u.y);
      const kx = Math.floor(usx / this.w);
      const ky = Math.floor(usy / this.h);
      if (kx || ky) {
        [u.x, u.y] = this.lapped(u.x, u.y, -kx, -ky);
        [u.tx, u.ty] = this.lapped(u.tx, u.ty, -kx, -ky);
        u.lap += kx;
        u.lapY += ky;
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

    for (const b of [...this.buildings]) {
      b.phase += dt;
      if (b.packing) {
        b.rise = Math.max(0, b.rise - dt / PACK_S);
        if (Math.random() < dt * 12) this.puff(b, 1);
        if (b.rise === 0) this.packNow(b);
        continue;
      }
      if (b.rise < 1) {
        b.rise = Math.min(1, b.rise + dt / (b.kind === 'yard' ? RISE_S : 1 + (b.art.rx + b.art.ry) / 30));
        if (Math.random() < dt * 14) this.puff(b, 1);
        if (b.rise === 1) this.mapVersion++;
        continue;
      }
      if (b.kind === 'yard') {
        // a welding spark under the crane hook now and then
        if (Math.random() < dt * 1.5) {
          const p = b.art.fx[1];
          const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z - 1);
          for (let i = 0; i < 3; i++) this.sparks.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 15, life: 0 });
        }
      }
      const emit = (i: number, kind: 'smoke' | 'soot', rate: number) => {
        if (!b.art.fx[i] || Math.random() > dt * rate) return;
        const p = b.art.fx[i];
        const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z);
        this.particles.push({ x: sx + (Math.random() - 0.5) * 6, y: sy, vx: 3 + Math.random() * 3, vy: -7 - Math.random() * 4, life: 0, max: 2.6 + Math.random(), kind, size: 1.5 });
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
    for (const s of this.sparks) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 60 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life < 0.5);
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter((m) => m.t < 0.7);

    // water sparkles, where you are looking
    const v = this.view;
    const want = Math.floor(((v.x1 - v.x0) * (v.y1 - v.y0)) / 2500);
    for (let i = 0; i < 4 && this.sparkles.length < want; i++) {
      const x = ((Math.floor(v.x0 + Math.random() * (v.x1 - v.x0)) % this.w) + this.w) % this.w;
      const y = ((Math.floor(v.y0 + Math.random() * (v.y1 - v.y0)) % this.h) + this.h) % this.h;
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

  // A tread mark at screen point (x, y), if that bit of ground is painted.
  private stamp(x: number, y: number, style: string): void {
    const t = this.tiles.at(x, y);
    if (!t) return;
    const c = t.canvas.getContext('2d')!;
    c.fillStyle = style;
    c.fillRect(Math.round(x) - Math.floor(Math.round(x) / CH) * CH, Math.round(y) - Math.floor(Math.round(y) / CH) * CH, 1, 1);
  }

  // The ground for screen rect (x0, y0)-(x1, y1), in unwrapped map pixels,
  // painted a few tiles at a time (`budget` milliseconds each frame).
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
  private forestTint(sx: number, sy: number, c: RGB): RGB {
    const f = (this.forestF.at(sx, sy) - 0.6) * 2.4;
    return f > 0 ? mix(c, [18, 40, 16], Math.min(0.75, 0.25 + f * 0.6)) : c;
  }

  // Everything standing on this copy of the map within screen rect
  // (x0, y0)-(x1, y1), in this copy's coordinates.
  renderObjects(x0: number, y0: number, x1: number, y1: number): void {
    const c = this.ctx;
    const pad = 56;
    const inView = (sx: number, sy: number) => sx > x0 - pad && sx < x1 + pad && sy > y0 - pad && sy < y1 + pad * 1.5;
    const seen = (wx: number, wy: number, z = 0) => {
      const [sx, sy] = toScreen(wx, wy, z);
      return inView(sx, sy);
    };

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

    const feet: [Rect, string][] = [];
    for (const u of this.units) {
      if (!u.sel || u.kind !== 'mcv' || u.f !== ME || u.deploy || !seen(u.x, u.y)) continue;
      const r = this.siteOf(u.x, u.y);
      feet.push([r, this.siteOk(r) ? '#9dff9d' : '#ff6a5a']);
      this.drawFoot(r, feet[feet.length - 1][1], 1, true, false);
    }

    // aircraft shadows on the ground
    for (const u of this.units) {
      if (u.kind !== 'heli' || !seen(u.x, u.y)) continue;
      const spr = this.art[u.f].heli[dirIndex(u.a, DIRS)];
      const [sx, sy] = toScreen(u.x + 4, u.y - 2, u.z);
      if (spr.shadow) c.drawImage(spr.shadow, Math.round(sx - spr.cx), Math.round(sy - spr.cy));
    }

    type Item = { k: number; draw: () => void };
    const items: Item[] = [];
    const tx0 = Math.max(0, Math.floor((x0 - pad) / CH));
    const tx1 = Math.min(this.tiles.nx - 1, Math.floor((x1 + pad) / CH));
    const ty0 = Math.max(0, Math.floor((y0 - pad) / CH));
    const ty1 = Math.min(this.tiles.ny - 1, Math.floor((y1 + pad * 1.5) / CH));
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles.at(tx * CH, ty * CH);
        if (t) for (const p of t.props) if (seen(p.x, p.y, p.z)) items.push({ k: p.x + p.y + p.z * 2, draw: () => this.blit(p.spr, p.x, p.y, p.z) });
      }
    for (const p of this.props) if (seen(p.x, p.y, p.z)) items.push({ k: p.x + p.y + p.z * 2, draw: () => this.blit(p.spr, p.x, p.y, p.z) });
    for (const b of this.buildings) if (seen(b.x, b.y, 10)) items.push({ k: b.x + b.y + Math.min(b.art.rx, b.art.ry), draw: () => this.drawBuilding(b) });
    for (const u of this.units) if (u.kind !== 'heli' && seen(u.x, u.y, u.z)) items.push({ k: u.x + u.y + u.z * 2, draw: () => this.drawUnit(u) });
    items.sort((a, b) => a.k - b.k);
    for (const it of items) it.draw();

    for (const p of this.particles) {
      if (p.kind === 'wake' || !inView(p.x, p.y)) continue;
      const k = p.life / p.max;
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle =
        p.kind === 'smoke' ? `rgba(222,222,216,${0.6 * (1 - k)})` : p.kind === 'soot' ? `rgba(70,66,60,${0.55 * (1 - k)})` : `rgba(165,145,105,${0.5 * (1 - k)})`;
      c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      if (s > 2) {
        c.fillStyle = p.kind === 'smoke' ? `rgba(255,255,255,${0.35 * (1 - k)})` : 'rgba(0,0,0,0)';
        c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s / 2), 1);
      }
    }

    for (const u of this.units) if (u.kind === 'heli' && seen(u.x, u.y, u.z)) this.drawUnit(u);

    for (const s of this.sparks) {
      if (!inView(s.x, s.y)) continue;
      c.fillStyle = s.life < 0.2 ? '#fff6c8' : '#ffb347';
      c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }

    // where a selected Foundry vehicle would deploy: its outline over the
    // trees (they get cleared)
    for (const [r, col] of feet) this.drawFoot(r, col, 0.75 + 0.25 * Math.sin(this.time * 6), false, true);

    for (const u of this.units) if (u.sel && seen(u.x, u.y, u.z)) this.drawSelection(u);
    for (const b of this.buildings) if (b.sel && seen(b.x, b.y, 10)) this.drawBuildingSel(b);

    // the building being placed: a see-through ghost over its footprint
    const gh = this.ghost;
    if (gh && seen(gh.x, gh.y, 10)) {
      const col = gh.why ? '#ff6a5a' : '#9dff9d';
      this.drawFoot(gh.pad, col, 1, true, false);
      c.globalAlpha = 0.65;
      this.blit(this.buildingArt(gh.tech.building!, ME).spr, gh.x, gh.y, 0);
      c.globalAlpha = 1;
      this.drawFoot(gh.pad, col, 0.8 + 0.2 * Math.sin(this.time * 6), false, true);
    }
  }

  // A footprint outline on the ground, dashed round its edge.
  private drawFoot(r: Rect, color: string, alpha: number, fill = true, line = true): void {
    const c = this.ctx;
    const pts: [number, number][] = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x + r.w, r.y + r.h],
      [r.x, r.y + r.h],
    ];
    c.fillStyle = color;
    if (fill) {
      c.globalAlpha = alpha * 0.2;
      c.beginPath();
      pts.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(x, y);
        if (i) c.lineTo(sx, sy);
        else c.moveTo(sx, sy);
      });
      c.fill();
    }
    c.globalAlpha = alpha;
    for (let i = 0; i < 4 && line; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % 4];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let k = 0; k <= n; k++) {
        if (k % 4 === 3) continue;
        const [sx, sy] = toScreen(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
        c.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  // Brackets round the corners of a selected building's footprint.
  private drawBuildingSel(b: Building): void {
    const c = this.ctx;
    if (b.rally) {
      // a dotted line out to a little flag
      const [rx, ry] = this.nearPoint(b.x, b.y, ...b.rally);
      const [ax, ay] = toScreen(b.x, b.y + b.art.ry);
      const [bx, by] = toScreen(rx, ry, this.terrain.elev(rx, ry));
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
      c.fillStyle = 'rgba(157,255,157,0.85)';
      for (let i = 0; i < n; i += 1) if (i % 2 === 0) c.fillRect(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), 1, 1);
      const X = Math.round(bx);
      const Y = Math.round(by);
      c.fillStyle = '#e9f0d8';
      c.fillRect(X, Y - 9, 1, 10);
      c.fillStyle = '#9dff9d';
      c.fillRect(X + 1, Y - 9, 4, 3);
      c.fillStyle = '#3c7a3c';
      c.fillRect(X + 1, Y - 7, 4, 1);
    }
    const { rx, ry } = b.art;
    c.fillStyle = '#ffffff';
    const L = 7;
    for (const [cx, cy, dx, dy] of [
      [-rx, -ry, 1, 1],
      [rx, -ry, -1, 1],
      [rx, ry, -1, -1],
      [-rx, ry, 1, -1],
    ]) {
      for (let k = 0; k <= L; k++) {
        const [ax, ay] = toScreen(b.x + cx + dx * k, b.y + cy);
        c.fillRect(Math.round(ax), Math.round(ay), 1, 1);
        const [bx, by] = toScreen(b.x + cx, b.y + cy + dy * k);
        c.fillRect(Math.round(bx), Math.round(by), 1, 1);
      }
    }
  }

  // The whole map for the globe, one pixel per OV screen pixels: the overview
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
    const ctx = this.ctx;
    this.ctx = c;
    try {
      for (const b of this.buildings.filter((b) => b.rise >= 1).sort((p, q) => p.x + p.y - q.x - q.y)) {
        // on the copy of the map that holds the building's foot
        const [sx, sy] = toScreen(b.x, b.y);
        const [fx, fy] = this.lapped(b.x, b.y, -Math.floor(sx / this.w), -Math.floor(sy / this.h));
        this.blit(b.art.spr, fx, fy, 0);
      }
    } finally {
      this.ctx = ctx;
    }
    return cv;
  }

  // Units as dots of their faction's colour, for the globe (screen positions).
  mapDots(): [number, number, RGB][] {
    return this.units.map((u) => {
      const [sx, sy] = toScreen(u.x, u.y);
      return [sx, sy, FACTIONS[u.f].light];
    });
  }

  private drawUnit(u: Unit): void {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    switch (u.kind) {
      case 'mcv':
        this.blit(art.mcv[di], u.x, u.y, u.z);
        break;
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
    const st = UNIT[u.kind];
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
    if (b.rise < 1) {
      // going up (or coming down): revealed from the ground up, inside the
      // site's outline
      const spr = b.art.spr;
      const [sx, sy] = toScreen(b.x, b.y, 0);
      const x = Math.round(sx - spr.cx);
      const y = Math.round(sy - spr.cy);
      const W = spr.img.width;
      const H = spr.img.height;
      const top = Math.round(H * (1 - b.rise));
      this.drawFoot(b.pad, '#ffe08a', 0.8);
      if (H - top > 0) c.drawImage(spr.img, 0, top, W, H - top, x, y + top, W, H - top);
      return;
    }
    this.blit(b.art.spr, b.x, b.y, 0);
    const f = FACTIONS[b.f];
    const fx = (i: number) => {
      const p = b.art.fx[i];
      return toScreen(b.x + p.x, b.y + p.y, p.z).map(Math.round) as [number, number];
    };
    switch (b.kind) {
      case 'yard': {
        if (Math.floor(b.phase * 1.2) % 2 === 0) {
          const [x, y] = fx(0);
          c.fillStyle = 'rgba(255,90,60,0.35)';
          c.fillRect(x - 1, y - 1, 3, 3);
          c.fillStyle = '#ff7a5c';
          c.fillRect(x, y, 1, 1);
        }
        break;
      }
      case 'lab': {
        const [x, y] = fx(0);
        c.fillStyle = `rgba(160,240,255,${0.25 + 0.2 * Math.sin(b.phase * 3)})`;
        c.fillRect(x - 3, y - 5, 7, 9);
        break;
      }
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
