// v2: the same sandbox as v1, drawn in 2:1 isometric with shaded voxel art.
import { ART, RGB, WorldField, css, dirIndex, hash2, mix, nearestCopy, rng } from '../gfx';
import { CH, Tile, Tiles, drawTiles, windingRoad } from '../tiles';
import { STATS, UnitKind } from '../v1/game';
import type { Action, BuildItem, BuildMenu, GameLike } from '../types';
import { COMBAT_CREDITS, COMBAT_STORE, ORE, POWER, QUEUE_MAX, START_CREDITS, STORE, TABS, TECH, Tab, Tech, buildTime } from './tech';
import { HP, IsoTerrain, K, OV, Rect } from './terrain';
import { StackSprite, drawSprite, toScreen, toWorld } from './stack';
import { BURST_CENTER, BURST_FRAME, burstFrames } from '../cursors';
import { MAPS, combatHome, mapDef, mapPreview } from './maps';
import { BUILDING_DEF, CELL, DAMAGED, Fx, HELI_ALT, Shot, UNIT_DEF, VERSUS, WEAPON, Weapon, drawFlame, makeShot, muzzles } from './combat';
import {
  BuildingKind,
  BuildingStates,
  DIRS,
  FACTIONS,
  V2BuildingArt,
  V2FactionArt,
  drawBuggyLights,
  makeBuilding,
  makeBushes,
  makeClutter,
  makeDish,
  makeOre,
  makeFactionArt,
  makeBuildingStates,
  OreArt,
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
// Where a hauler unloads at a refinery (its striped pad), from its centre.
const DOCK: [number, number] = [12, 11];
// Buildings that make units, and so have rally points.
const MAKERS: BuildingKind[] = ['barracks', 'factory', 'helipad'];
// How far (world units) a new building may stand from the rest of your base.
const BUILD_GAP = 30;
const PACK_S = 1.2;
const PACE_SPEED = 3.5; // a soldier pacing about, in map pixels a second
const PACE_R = 6; // and how far from where it was left

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
  // an ore hauler at work: looking for ore, driving to it, digging, taking
  // it home, unloading, or waiting for something to change
  job?: { st: 'seek' | 'go' | 'dig' | 'home' | 'ret' | 'unload' | 'wait'; node?: OreNode; ref?: Building; t: number };
  load?: number;
  // getting round water: which way it is sliding along the shore, and how
  // long since it last got any closer to where it is going
  slide?: number;
  best?: number;
  stuck?: number;
  goal?: [number, number];
  slideT?: number;
  // standing about: soldiers pace round the spot they stopped on (home),
  // stepping to `pace`; artillery shifts on its wheels to `look` (a buggy
  // blinks its aerial light instead: see drawUnit)
  home?: [number, number];
  pace?: [number, number];
  look?: number;
  face?: number; // the way it was left facing, which it shifts about
  // fighting: what it is firing on, whether it was told to (and so chases
  // it anywhere) or is chasing whoever hit it (and gives up past LEASH from
  // `anchor`), its reload, when it last fired and when it was last hit
  target?: Target;
  forced?: boolean;
  chase?: boolean;
  anchor?: [number, number];
  repath?: number;
  scan?: number;
  cool?: number;
  fired?: number;
  hitT?: number;
  flashT?: number;
  // when you last ordered an attack on it: it blinks white so you can see which
  aimT?: number;
  dead?: boolean;
  // the enemy's guards (Combat stage): which post it holds, and its spot there
  post?: number;
  spot?: [number, number];
}

type Target = Unit | Building;
const isB = (t: Target): t is Building => 'pad' in t;
// How far a unit chases whoever hit it before it gives up and goes back.
const LEASH = 10 * CELL;
// How close a friend has to be to come and help when one of its side is hit.
const HELP = 7 * CELL;
// The size of the explosion when each kind of vehicle is destroyed.
const BOOM: Partial<Record<Kind, number>> = { buggy: 6, light: 8, heavy: 10, hauler: 10, arty: 7, mcv: 12, heli: 8, boat: 9 };

// A destroyed building: rubble, for good (t < 0 while it is still blowing up).
interface Ruin {
  kind: BuildingKind;
  f: number;
  x: number;
  y: number;
  states: BuildingStates;
  t: number;
}

interface OreNode {
  x: number;
  y: number;
  amt: number;
  v: number; // art variant
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
  hp: number; // 0..1
  packing?: boolean;
  rally?: [number, number]; // where new units head (world, first copy)
  gift?: boolean; // a refinery's free hauler has been handed over
  primary?: boolean; // the one of its kind that makes the units
  // a gun tower's target and reload, and for any building when it was last hit
  target?: Target;
  scan?: number;
  cool?: number;
  hitT?: number;
  flashT?: number;
  // when you last ordered an attack on it: it blinks white so you can see which
  aimT?: number;
  dead?: boolean;
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

// Stages to start a game in, for testing: the real start, or straight into a
// fight with a full base each, close together.
export type Stage = 'initial' | 'combat';
const STAGES: { id: Stage; name: string; blurb: string }[] = [
  { id: 'initial', name: 'Initial', blurb: 'A Foundry vehicle and a few units. The enemy is far away.' },
  { id: 'combat', name: 'Combat', blurb: 'Two full bases close together, an army each and $50000. The enemy rebuilds its losses.' },
];
// The enemy's army in the Combat stage: it keeps this many of each, making
// more (for free) at the building for each kind whenever it is short.
const GARRISON: [Kind, number][] = [
  ['light', 6],
  ['heavy', 3],
  ['buggy', 3],
  ['arty', 2],
  ['heli', 1],
  ['inf', 8],
  ['rocket', 4],
];
const MAKER: Partial<Record<Kind, BuildingKind>> = { inf: 'barracks', rocket: 'barracks', light: 'factory', heavy: 'factory', buggy: 'factory', arty: 'factory', heli: 'helipad' };
// ...and it waits in groups of this many at each of its posts round its base.
const SQUAD = 4;
const POSTS = 6;
const ENEMY = 1;


// A sprite as a flat white silhouette (made once per sprite image).
const whites = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function whiteOf(img: HTMLCanvasElement): HTMLCanvasElement {
  let w = whites.get(img);
  if (!w) {
    w = document.createElement('canvas');
    w.width = img.width;
    w.height = img.height;
    const g = w.getContext('2d')!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w.width, w.height);
    whites.set(img, w);
  }
  return w;
}

export class IsoGame implements GameLike {
  readonly fine = true;
  terrain!: IsoTerrain;
  units: Unit[] = [];
  buildings: Building[] = [];
  props: Prop[] = [];
  particles: Particle[] = [];
  // where you tapped an order: the move (or attack, foe) burst plays there
  markers: { x: number; y: number; z: number; t: number; foe?: boolean }[] = [];
  fx = new Fx();
  ruins: Ruin[] = [];
  private bStates = new Map<string, BuildingStates>();
  // Mark where a move or attack order goes. main.ts turns it off for the
  // mouse, whose cursor plays the burst instead.
  moveMarks = true;
  sparkles: { x: number; y: number; life: number }[] = [];
  sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  art: V2FactionArt[];
  bArt = new Map<string, V2BuildingArt>();
  trees = makeTrees();
  rocks = makeRocks();
  bushes = makeBushes();
  clutter = makeClutter();
  dish = makeDish();
  oreArt: OreArt = makeOre();
  ore: OreNode[] = [];
  private oreGrid = new Map<number, OreNode[]>();
  time = 0;
  onSelect: (names: string[]) => void = () => {};
  // which map generate() makes (see maps.ts), and the stage it starts at
  mapId = MAPS[0].id;
  stage: Stage = 'initial';

  stages(): { id: string; name: string; blurb: string }[] {
    return STAGES;
  }

  maps(): { id: string; name: string; blurb: string }[] {
    return MAPS.map(({ id, name, blurb }) => ({ id, name, blurb }));
  }
  preview(id: string, w: number, h: number): HTMLCanvasElement {
    const def = mapDef(id);
    return mapPreview(this.stage === 'combat' ? { ...def, home: combatHome(def) } : def, this.seed, w, h);
  }

  constructor(
    public ctx: CanvasRenderingContext2D,
    public seed: number,
  ) {
    this.art = FACTIONS.map(makeFactionArt);
  }

  // A building's damaged and ruined looks, drawn the first time they're needed.
  private states(kind: BuildingKind, f: number): BuildingStates {
    const key = `${kind}-${f}`;
    let s = this.bStates.get(key);
    if (!s) {
      s = makeBuildingStates(kind, FACTIONS[f]);
      this.bStates.set(key, s);
    }
    return s;
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
    const def = mapDef(this.mapId);
    const T = (this.terrain = new IsoTerrain(w, h, this.seed, def));
    this.units = [];
    this.buildings = [];
    this.props = [];
    this.particles = [];
    this.markers = [];
    this.sparkles = [];
    this.sparks = [];
    this.fx.clear();
    this.ruins = [];
    this.lastTap = null;
    this.mapVersion++;
    const combat = this.stage === 'combat';
    this.credits = combat ? COMBAT_CREDITS : START_CREDITS;
    this.posts = [];
    this.aiJobs = new Map();
    this.aiT = 0;
    this.jobs = new Map();
    this.queue = new Map();
    this.ore = [];
    this.oreGrid = new Map();
    this.lowPower = false;
    this.known = new Set();
    this.fresh = new Set();
    this.ghost = null;
    this.forestF = new WorldField(w, h, 50, this.seed + 500, 2, 10);
    this.ov = null;

    const flat = (sx: number, sy: number) => {
      const [x, y] = T.at(sx, sy);
      return T.k(x, y) === K.Grass && T.k(x + 40, y + 40) === K.Grass && T.k(x - 40, y - 40) === K.Grass;
    };
    const wrapS = (sx: number, sy: number): [number, number] => [sx - Math.floor(sx / w) * w, sy - Math.floor(sy / h) * h];
    // the nearest open, level grass to a screen point, spiralling out
    const findLand = (sx0: number, sy0: number, reach = 3000): [number, number] | null => {
      for (let r = 0; r < reach; r += 16)
        for (let t = 0; t < Math.max(1, r / 8); t++) {
          const a = rand() * Math.PI * 2;
          const sx = sx0 + Math.cos(a) * r;
          const sy = sy0 + Math.sin(a) * r * 0.5;
          if (flat(sx, sy)) return wrapS(sx, sy);
        }
      return null;
    };
    // Two sides: you, starting with a Foundry vehicle and a small escort,
    // and the enemy, dug in with a full base and an army on the far side of
    // the planet.
    type Site = { sx: number; sy: number; f: number };
    const at = (p: [number, number], f: number): Site => {
      const [sx, sy] = findLand(p[0] * w, p[1] * h) ?? [p[0] * w, p[1] * h];
      return { sx, sy, f };
    };
    const homeSite = at(combat ? combatHome(def) : def.home, ME);
    const foe = at(def.enemy, 1);

    // a road from your start to the enemy base, kept to dry land: it winds
    // between waypoints found on the way
    const pts: [number, number][] = [[homeSite.sx, homeSite.sy]];
    const steps = 8;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = findLand(homeSite.sx + (foe.sx - homeSite.sx) * t, homeSite.sy + (foe.sy - homeSite.sy) * t, 900);
      if (p) {
        // keep it on the same lap as the line it follows
        const [lx, ly] = pts[pts.length - 1];
        pts.push(nearestCopy(lx, ly, p[0], p[1], w, h));
      }
    }
    {
      const [lx, ly] = pts[pts.length - 1];
      pts.push(nearestCopy(lx, ly, foe.sx, foe.sy, w, h));
    }
    const lines: [number, number][][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = T.at(...pts[i]);
      const [bx, by] = T.at(...pts[i + 1]);
      lines.push(windingRoad(ax, ay, bx, by, rand));
    }
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
            this.buildings.push({ kind, f, x, y, art, phase: rand() * 10, gun: rand() * Math.PI * 2, gunGoal: rand() * Math.PI * 2, pad, own: false, sel: false, rise: 1, hp: 1 });
            ok = true;
          }
        }
      }
    };
    place(['yard', ...BASE_B], foe.f, foe.sx, foe.sy);
    // in the Combat stage you have a full base too, already built
    if (combat) {
      place(['yard', ...BASE_B, 'lab', 'power'], ME, homeSite.sx, homeSite.sy);
      for (const b of this.buildings) if (b.f === ME) b.own = true;
      // what it opens up is already known, not news
      for (const t of this.available()) this.known.add(t.id);
    }

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
      ['light', 6],
      ['heavy', 3],
      ['buggy', 3],
      ['hauler', 1],
      ['arty', 2],
      ['heli', 1],
      ['inf', 8],
      ['rocket', 4],
    ];
    // you start with a handful: the Foundry vehicle and a small escort
    const start: [Kind, number][] = combat
      ? GARRISON
      : [
          ['mcv', 1],
          ['light', 2],
          ['buggy', 1],
          ['inf', 3],
        ];
    // the Foundry vehicle starts on the nearest open ground to your home site
    let ms: [number, number] = [homeSite.sx, homeSite.sy];
    found: for (let r = 0; r < (combat ? 0 : 1200); r += 12)
      for (let t = 0; t < Math.max(1, r / 6); t++) {
        const a = rand() * Math.PI * 2;
        const sx = homeSite.sx + Math.cos(a) * r;
        const sy = homeSite.sy + Math.sin(a) * r * 0.5;
        const [x, y] = toWorld(sx, sy, 0);
        if (this.siteOk(this.siteOf(x, y))) {
          ms = [sx, sy];
          break found;
        }
      }
    // ore fields: two near where you start, one by the enemy base, one
    // half way, and more scattered round the land
    const startSite = this.siteOf(...toWorld(ms[0], ms[1], 0));
    const field = (sx: number, sy: number, n: number) => {
      const reach = 6 + Math.sqrt(n) * 5.5;
      for (let i = 0, t = 0; i < n && t < n * 30; t++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * reach;
        const [x, y] = toWorld(sx + Math.cos(a) * d * 1.6, sy + Math.sin(a) * d * 0.8, 0);
        if (T.k(x, y) !== K.Grass || T.k(x + 5, y + 5) !== K.Grass || T.k(x - 5, y - 5) !== K.Grass) continue;
        if (inside(x, y, startSite, 10)) continue;
        if (this.oreNear(x, y, 5).length) continue;
        const [fx, fy] = T.fold(x, y);
        this.addOre({ x: fx, y: fy, amt: ORE.node * (0.6 + rand() * 0.4), v: Math.floor(rand() * 4) });
        i++;
      }
    };
    const nearField = (cx: number, cy: number, r0: number, n: number) => {
      for (let t = 0; t < 60; t++) {
        const a = rand() * Math.PI * 2;
        const r = r0 + rand() * 60;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r * 0.5;
        const [x, y] = toWorld(sx, sy, 0);
        if (T.k(x, y) === K.Grass && !inside(x, y, startSite, 40)) {
          field(sx, sy, n);
          return;
        }
      }
    };
    nearField(ms[0], ms[1], 170, 30);
    nearField(ms[0], ms[1], 420, 34);
    nearField(foe.sx, foe.sy, 220, 28);
    {
      const [mx, my] = nearestCopy(homeSite.sx, homeSite.sy, foe.sx, foe.sy, w, h);
      const mid = findLand((homeSite.sx + mx) / 2, (homeSite.sy + my) / 2, 900);
      if (mid) nearField(mid[0], mid[1], 0, 40);
    }
    const extra = Math.max(1, Math.round((w * h * (1 - def.water)) / 1.2e7));
    for (let i = 0; i < extra; i++)
      for (let t = 0; t < 60; t++) {
        const sx = rand() * w;
        const sy = rand() * h;
        if (!flat(sx, sy)) continue;
        nearField(sx, sy, 0, 16 + Math.floor(rand() * 16));
        break;
      }

    const mine: [number, number][] = [];
    for (const [kind, c] of start)
      for (let i = 0; i < c; i++) {
        const u =
          kind === 'mcv'
            ? spawn(kind, ME, ms[0], ms[1], 0.5) ?? this.newUnit('mcv', ME, ...T.fold(...toWorld(ms[0], ms[1], 0)), 0)
            : combat
              ? spawn(kind, ME, ms[0] - 60, ms[1] + 140, 220)
              : spawn(kind, ME, ms[0], ms[1] + 45, 70);
        if (u) mine.push(toScreen(u.x, u.y));
      }
    if (combat) {
      // your refinery's hauler is already at work
      for (const b of this.buildings)
        if (b.own && b.kind === 'refinery') {
          b.gift = true;
          const u = this.newUnit('hauler', ME, ...this.fold(b.x + DOCK[0], b.y + DOCK[1] + 6), Math.PI / 2);
          u.job = { st: 'seek', t: 0 };
          u.load = 0;
        }
      this.makePosts(foe.sx, foe.sy, homeSite.sx, homeSite.sy, rand);
    }
    for (const [kind, c] of army) for (let i = 0; i < c; i++) spawn(kind, foe.f, foe.sx + 60, foe.sy + 140, 220);
    // enemy patrol boats on the nearest water to their base
    let lake: [number, number] | null = null;
    for (let r = 100; r < 2000 && !lake; r += 100)
      for (let t = 0; t < 40 && !lake; t++) {
        const a = rand() * Math.PI * 2;
        const sx = foe.sx + Math.cos(a) * r;
        const sy = foe.sy + Math.sin(a) * r * 0.5;
        const [x, y] = toWorld(sx, sy, 0);
        if (T.k(x, y) === K.Water && T.k(x + 30, y) === K.Water && T.k(x - 30, y) === K.Water && T.k(x, y + 30) === K.Water && T.k(x, y - 30) === K.Water) lake = [sx, sy];
      }
    if (lake) for (let i = 0; i < 3; i++) spawn('boat', foe.f, lake[0], lake[1], 40);
    for (const u of this.units) u.z = this.groundZ(u);

    const yard = combat && this.buildings.find((b) => b.own && b.kind === 'yard');
    this.home = yard ? { x: toScreen(yard.x, yard.y)[0], y: toScreen(yard.x, yard.y)[1] } : mine.length ? { x: mine.reduce((a, p) => a + p[0], 0) / mine.length, y: mine.reduce((a, p) => a + p[1], 0) / mine.length } : { x: homeSite.sx, y: homeSite.sy };
    this.tiles = new Tiles(w, h, (tx, ty) => this.buildTile(tx, ty), 220);
    this.emit();
  }

  private home = { x: 0, y: 0 };
  private lastTap: { u: Unit; t: number } | null = null;

  private newUnit(kind: Kind, f: number, x: number, y: number, a: number): Unit {
    const u: Unit = { kind, f, x, y, z: this.terrain.elev(x, y), a, turret: a, turretGoal: a, tx: x, ty: y, moving: false, sel: false, anim: 0, hp: 1, idle: 2, trackAcc: 0, lap: 0, lapY: 0 };
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
        const k = Math.max(1, Math.min(3, Math.floor(Math.min(W / (base.w * 0.55), H / (base.h * 0.65)))));
        c.imageSmoothingEnabled = false;
        c.translate(W / 2, H / 2 + 4);
        c.scale(k, k);
        for (const s of layers) c.drawImage(s.img, -s.cx, -s.cy, s.w, s.h);
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
    return { credits: Math.floor(this.credits), store: this.store(), power: this.power(), tabs, items };
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
    if (kind === 'hauler') {
      u.job = { st: 'seek', t: 0 };
      u.load = 0;
      return true;
    }
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
    const pw = this.power();
    const low = pw.used > pw.made;
    if (low && !this.lowPower) this.notice('Low power: build a generator');
    this.lowPower = low;
    for (const j of this.jobs.values()) {
      if (j.ready || j.paused) continue;
      if (j.tech.building && !have.has('yard')) continue;
      if (j.tech.unit && !j.tech.needs.every((k) => have.has(k))) continue;
      const want = (j.tech.cost / buildTime(j.tech.cost)) * dt * (this.lowPower ? 0.5 : 1);
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
    const b: Building = { kind: t.building!, f: ME, x: gh.x, y: gh.y, art, phase: 0, gun: 0, gunGoal: 0, pad: gh.pad, own: true, sel: false, rise: 0, hp: 1 };
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
    if (!this.terrain.clear(r, 1)) return false;
    // not on ore either
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    return !this.oreNear(cx, cy, Math.hypot(r.w, r.h) / 2 + 4).some((n) => n.amt > 1 && inside(...this.nearPoint(cx, cy, n.x, n.y), r, 3));
  }

  // ---------- Ore ----------

  private oreKey(x: number, y: number): [number, number] {
    const [sx, sy] = toScreen(x, y);
    const nx = Math.ceil(this.terrain.w / 64);
    const ny = Math.ceil(this.terrain.h / 64);
    const i = (((Math.floor(sx / 64) % nx) + nx) % nx);
    const j = (((Math.floor(sy / 64) % ny) + ny) % ny);
    return [i, j];
  }

  private addOre(n: OreNode): void {
    this.ore.push(n);
    const [i, j] = this.oreKey(n.x, n.y);
    const k = j * 100000 + i;
    let cell = this.oreGrid.get(k);
    if (!cell) this.oreGrid.set(k, (cell = []));
    cell.push(n);
  }

  // Ore clumps within r (world units) of (x, y), on any copy of the map.
  private oreNear(x: number, y: number, r: number): OreNode[] {
    const [i0, j0] = this.oreKey(x, y);
    const nx = Math.ceil(this.terrain.w / 64);
    const ny = Math.ceil(this.terrain.h / 64);
    const reach = Math.ceil((r * 2) / 64) + 1;
    const out: OreNode[] = [];
    for (let dj = -reach; dj <= reach; dj++)
      for (let di = -reach; di <= reach; di++) {
        const cell = this.oreGrid.get(((((j0 + dj) % ny) + ny) % ny) * 100000 + ((((i0 + di) % nx) + nx) % nx));
        if (!cell) continue;
        for (const n of cell) {
          const [px, py] = this.nearPoint(x, y, n.x, n.y);
          if (Math.hypot(px - x, py - y) <= r) out.push(n);
        }
      }
    return out;
  }

  // Ore clumps on this copy of the map within screen rect (x0, y0)-(x1, y1).
  private oreInView(x0: number, y0: number, x1: number, y1: number): OreNode[] {
    const out: OreNode[] = [];
    const nx = Math.ceil(this.terrain.w / 64);
    const ny = Math.ceil(this.terrain.h / 64);
    for (let j = Math.max(0, Math.floor(y0 / 64)); j <= Math.min(ny - 1, Math.floor(y1 / 64)); j++)
      for (let i = Math.max(0, Math.floor(x0 / 64)); i <= Math.min(nx - 1, Math.floor(x1 / 64)); i++)
        for (const n of this.oreGrid.get(j * 100000 + i) ?? []) {
          const [sx, sy] = toScreen(n.x, n.y);
          if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) out.push(n);
        }
    return out;
  }

  // Power made and used by your buildings.
  private power(): { made: number; used: number } {
    let made = 0;
    let used = 0;
    for (const b of this.buildings) {
      if (!b.own || b.rise < 1) continue;
      const p = POWER[b.kind] ?? 0;
      if (p > 0) made += p;
      else used -= p;
    }
    return { made, used };
  }
  private lowPower = false;

  private store(): number {
    if (this.stage === 'combat') return COMBAT_STORE;
    let s = STORE.base;
    for (const b of this.buildings) if (b.own && b.rise >= 1) s += b.kind === 'refinery' ? STORE.refinery : b.kind === 'silo' ? STORE.silo : 0;
    return s;
  }

  // The nearest refinery of yours to (x, y).
  private refineryNear(x: number, y: number): Building | null {
    let best: Building | null = null;
    let bd = 1e9;
    for (const b of this.buildings) {
      if (!b.own || b.kind !== 'refinery' || b.rise < 1 || b.packing) continue;
      const [bx, by] = this.nearPoint(x, y, b.x, b.y);
      const d = Math.hypot(bx - x, by - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // Ore haulers dig ore, carry it home to a refinery and unload it for credits.
  private haul(u: Unit, dt: number): void {
    const j = u.job!;
    u.load ??= 0;
    j.t -= dt;
    const goTo = (x: number, y: number) => {
      [u.tx, u.ty] = this.nearPoint(u.x, u.y, x, y);
      u.moving = true;
    };
    switch (j.st) {
      case 'wait':
        if (j.t <= 0) j.st = u.load >= ORE.load * 0.95 ? 'home' : 'seek';
        break;
      case 'seek': {
        // the nearest clump with ore left, looking further out step by step
        let node: OreNode | undefined = j.node && j.node.amt > 20 ? j.node : undefined;
        for (let r = 60; r <= 1500 && !node; r *= 2) {
          let bd = 1e9;
          for (const n of this.oreNear(u.x, u.y, r)) {
            if (n.amt <= 20) continue;
            const [px, py] = this.nearPoint(u.x, u.y, n.x, n.y);
            const d = Math.hypot(px - u.x, py - u.y);
            if (d < bd) {
              bd = d;
              node = n;
            }
          }
        }
        if (!node) {
          if (u.load > 0) j.st = 'home';
          else {
            this.notice('No ore in reach of your hauler');
            j.st = 'wait';
            j.t = 5;
          }
          break;
        }
        j.node = node;
        goTo(node.x - 4, node.y - 2);
        j.st = 'go';
        break;
      }
      case 'go':
        if (!u.moving) {
          j.st = 'dig';
          u.turretGoal = 0;
        }
        break;
      case 'dig': {
        const n = j.node;
        if (!n || n.amt <= 1) {
          j.node = undefined;
          j.st = u.load >= ORE.load * 0.8 ? 'home' : 'seek';
          break;
        }
        const take = Math.min(ORE.digRate * dt, n.amt, ORE.load - u.load);
        n.amt -= take;
        u.load += take;
        if (Math.random() < dt * 6) {
          const [sx, sy] = toScreen(n.x, n.y, 2);
          this.particles.push({ x: sx + (Math.random() - 0.5) * 6, y: sy, vx: (Math.random() - 0.5) * 6, vy: -4, life: 0, max: 0.8, kind: 'dust', size: 1 });
        }
        if (u.load >= ORE.load - 0.5) j.st = 'home';
        break;
      }
      case 'home': {
        const ref = this.refineryNear(u.x, u.y);
        if (!ref) {
          this.notice('Your hauler needs a refinery');
          j.st = 'wait';
          j.t = 5;
          break;
        }
        j.ref = ref;
        goTo(ref.x + DOCK[0], ref.y + DOCK[1]);
        j.st = 'ret';
        break;
      }
      case 'ret':
        if (!j.ref || !this.buildings.includes(j.ref)) j.st = 'home';
        else if (!u.moving) j.st = 'unload';
        break;
      case 'unload': {
        const room = this.store() - this.credits;
        if (room <= 0) {
          this.notice('Credits full: build an ore silo');
          break;
        }
        const give = Math.min(ORE.unloadRate * dt, u.load, room);
        u.load -= give;
        this.credits += give;
        if (u.load <= 0.5) {
          u.load = 0;
          j.st = 'seek';
        }
        break;
      }
    }
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
    const haulers = this.selected().filter((u) => u.kind === 'hauler' && u.f === ME);
    const idle = haulers.filter((u) => !u.job);
    const mcvs = this.selected().filter((u) => u.kind === 'mcv' && u.f === ME);
    if (!mcvs.length) return idle.length ? [{ id: 'harvest', label: 'Harvest', icon: 'ore', title: 'Go back to gathering ore' }] : [];
    const ok = mcvs.some((u) => !u.deploy && this.deployable(u));
    return [{ id: 'deploy', label: 'Deploy', icon: 'deploy', disabled: !ok, title: ok ? 'Deploy into a Foundry (F)' : 'Needs open, level ground: move somewhere clear' }];
  }

  act(id: string): void {
    const sb = this.selB();
    if (id === 'primary' && sb) for (const o of this.buildings) o.primary = o.own && o.kind === sb.kind ? o === sb : o.primary;
    if (id === 'unrally' && sb) sb.rally = undefined;
    if (id === 'harvest')
      for (const u of this.selected())
        if (u.kind === 'hauler' && u.f === ME && !u.job) {
          u.job = { st: 'seek', t: 0 };
          u.load ??= 0;
        }
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
    const b: Building = { kind: 'yard', f: u.f, x: pad.x + pad.w / 2, y: pad.y + pad.h / 2, art, phase: 0, gun: 0, gunGoal: 0, pad, own: true, sel: u.sel, rise: 0, hp: 1 };
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
  private *buildTile(tx: number, ty: number): Generator<void, Tile<Prop>> {
    const T = this.terrain;
    const p = yield* T.paintSteps(tx, ty);
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
        if (this.oreNear(wx, wy, 12).length) continue;
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

  // Can unit u be at (x, y)? Boats need water, everyone else dry land.
  private okAt(u: Unit, x: number, y: number): boolean {
    const w = this.terrain.k(x, y) === K.Water;
    return u.kind === 'boat' ? w : !w;
  }

  private groundZ(u: Unit): number {
    if (u.kind === 'boat') return 0;
    return this.terrain.elev(u.x, u.y);
  }

  // A soldier with nothing to do: stands a while, then wanders a step or two
  // round the spot it was left on, or just turns to look somewhere else.
  private paceAbout(u: Unit, dt: number): void {
    if (!u.home) u.home = [u.x, u.y];
    if (u.pace) {
      const dx = u.pace[0] - u.x;
      const dy = u.pace[1] - u.y;
      const dist = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      const diff = angDiff(want, u.a);
      const stepA = UNIT[u.kind].turn * dt;
      u.a = Math.abs(diff) <= stepA ? want : u.a + Math.sign(diff) * stepA;
      const sp = Math.min(dist, PACE_SPEED * dt);
      const nx = u.x + Math.cos(want) * sp;
      const ny = u.y + Math.sin(want) * sp;
      if (dist < 0.3 || !this.okAt(u, nx, ny)) {
        u.pace = undefined;
        u.idle = 1.5 + Math.random() * 4;
      } else {
        u.x = nx;
        u.y = ny;
      }
      return;
    }
    u.idle -= dt;
    if (u.idle > 0) return;
    u.idle = 1.5 + Math.random() * 4;
    if (Math.random() < 0.35) {
      u.a += (Math.random() - 0.5) * 2.5; // just look round
      return;
    }
    const r = 2 + Math.random() * (PACE_R - 2);
    const th = Math.random() * Math.PI * 2;
    const px = u.home[0] + Math.cos(th) * r;
    const py = u.home[1] + Math.sin(th) * r;
    if (!this.okAt(u, px, py) || this.buildings.some((b) => Math.abs(b.x - px) < b.art.rx + 1 && Math.abs(b.y - py) < b.art.ry + 1)) return;
    u.pace = [px, py];
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

  // The unit under screen point (x, y), which may be on any copy of the
  // world (each unit's nearest copy is tested), and which copy it is.
  private unitAt(x: number, y: number): { u: Unit; lap: [number, number] } | null {
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
    return best ? { u: best, lap: bestLap } : null;
  }

  // What a tap at (x, y) would do, for the mouse cursor. Follows click().
  cursorAt(x: number, y: number): 'pick' | 'move' | 'attack' | 'rally' | 'build' | 'blocked' | null {
    if (this.ghost) return this.ghost.why ? 'blocked' : 'build';
    const mine = this.mine();
    const hit = this.unitAt(x, y);
    if (hit && (hit.u.f === ME || !mine.length)) return 'pick';
    if (!mine.length) {
      if (this.buildingAt(x, y)) return null;
      const sb = this.selB();
      return sb && sb.own && MAKERS.includes(sb.kind) && sb.rise >= 1 ? 'rally' : null;
    }
    const sel = mine.filter((u) => !u.deploy);
    if (!sel.length) return null;
    // over an enemy that one of them can shoot at: attack it
    const foe = this.enemyAt(x, y);
    if (foe && sel.some((u) => this.canHit(WEAPON[u.kind], foe))) return 'attack';
    // boats can't go onto land, nor anyone else into the water
    const [gx, gy] = this.fold(...this.groundAt(x, y));
    return sel.some((u) => this.okAt(u, gx, gy)) ? 'move' : 'blocked';
  }

  private mine(): Unit[] {
    return this.units.filter((u) => u.sel && u.f === ME);
  }

  // You command your own side. Enemy units and buildings can be tapped to
  // look at them (their health), but not ordered about.
  click(x: number, y: number, add: boolean): void {
    const hitU = this.unitAt(x, y);
    const mine = this.mine();
    if (hitU && (hitU.u.f === ME || !mine.length)) {
      const best = hitU.u;
      // a second tap on a lone Foundry vehicle deploys it
      const now = performance.now();
      const again = this.lastTap && this.lastTap.u === best && now - this.lastTap.t < 400 && best.sel && !add;
      this.lastTap = { u: best, t: now };
      for (const b of this.buildings) b.sel = false;
      const enemy = best.f !== ME;
      // enemies are looked at one at a time, never mixed into your selection
      if (!add || enemy || this.units.some((o) => o.sel && o.f !== ME)) for (const o of this.units) if (o !== best) o.sel = false;
      best.sel = add && !enemy ? !best.sel : true;
      [best.lap, best.lapY] = hitU.lap;
      if (again && this.deployable(best) && !best.deploy) this.startDeploy(best);
      this.emit();
      return;
    }
    this.lastTap = null;
    const hit = this.buildingAt(x, y);
    // with units of yours selected, a tap on a building is still a move order
    if (hit && !mine.length) {
      for (const o of this.units) o.sel = false;
      for (const b of this.buildings) b.sel = b === hit;
      this.emit();
      return;
    }
    const sb = this.selB();
    if (sb) {
      // with a barracks, works or helipad selected, a tap on the ground sets
      // where its new units go
      if (sb.own && MAKERS.includes(sb.kind) && sb.rise >= 1) {
        const [wx, wy] = this.fold(...this.groundAt(x, y));
        sb.rally = [wx, wy];
        this.markers.push({ x: wx, y: wy, z: this.terrain.elev(wx, wy), t: 0 });
        return;
      }
      this.deselect();
      return;
    }
    if (!mine.length) {
      if (this.units.some((u) => u.sel)) this.deselect();
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
    const sel = this.units.filter((u) => u.sel && !u.deploy && u.f === ME);
    if (!sel.length) return;
    // onto an enemy: everyone who can, attacks it
    const foe = shortest ? null : this.enemyAt(x, y);
    if (foe && sel.some((u) => this.canHit(WEAPON[u.kind], foe))) {
      this.attack(sel, foe);
      return;
    }
    // haulers sent onto ore dig there; sent anywhere else they stop work
    {
      const [gx, gy] = this.fold(...this.groundAt(x, y));
      const near = this.oreNear(gx, gy, 16).filter((n) => n.amt > 20);
      for (const u of sel)
        if (u.kind === 'hauler' && u.f === ME) {
          if (near.length) {
            u.job = { st: 'seek', node: near[0], t: 0 };
            u.load ??= 0;
          } else u.job = undefined;
        }
      if (near.length && sel.every((u) => u.kind === 'hauler' && u.f === ME)) {
        const [mx, my] = this.fold(...this.groundAt(x, y));
        if (this.moveMarks || shortest) this.markers.push({ x: mx, y: my, z: 0, t: 0 });
        return;
      }
    }
    if (shortest) {
      // from the globe: take the shortest way
      const [rx, ry] = toScreen(sel[0].x, sel[0].y);
      [x, y] = nearestCopy(rx, ry, x, y, this.w, this.h);
      for (const u of sel) [u.lap, u.lapY] = this.copyNear(u, x, y);
    }
    // wx, wy are unwrapped: on the copy of the world the player is looking at
    const [wx, wy] = this.groundAt(x, y);
    const [mx, my] = this.fold(wx, wy);
    if (this.moveMarks || shortest) this.markers.push({ x: mx, y: my, z: this.terrain.elev(wx, wy), t: 0 });
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
      // a move order calls off any fight
      u.target = undefined;
      u.forced = u.chase = false;
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
      const hit = u.f === ME && sx >= minx - 3 && sx <= maxx + 3 && sy >= miny - 3 && sy <= maxy + 3;
      if (hit) {
        u.sel = true;
        [u.lap, u.lapY] = lap;
      } else if (!add || u.f !== ME) u.sel = false;
    }
    if (this.units.some((u) => u.sel)) for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  focus(): { x: number; y: number } {
    return this.home;
  }

  // Your home base: the Foundry if it stands, or else the Foundry vehicle, or
  // else where you started (screen position, on the first copy of the map).
  homeBase(): { x: number; y: number } {
    const yard = this.buildings.find((b) => b.own && b.kind === 'yard');
    const mcv = this.units.find((u) => u.f === ME && u.kind === 'mcv');
    const b = yard ?? this.buildings.find((o) => o.own);
    if (b) {
      const [sx, sy] = toScreen(b.x, b.y);
      return { x: sx, y: sy };
    }
    if (mcv) {
      const [sx, sy] = toScreen(mcv.x, mcv.y);
      return { x: sx, y: sy };
    }
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
    this.enemyAI(dt);
    for (const u of this.units) if (u.job) this.haul(u, dt);
    for (const u of [...this.units]) if (!u.dead) this.fight(u, dt);
    // ore creeps back slowly, as long as a clump isn't dug out completely
    for (const n of this.ore) if (n.amt > 1 && n.amt < ORE.node) n.amt = Math.min(ORE.node, n.amt + ORE.regrow * dt);
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
          // a new destination: start afresh
          if (!u.goal || u.goal[0] !== u.tx || u.goal[1] !== u.ty) {
            u.goal = [u.tx, u.ty];
            u.best = dist;
            u.stuck = 0;
            u.slide = undefined;
          }
          const want = Math.atan2(dy, dx);
          const free = foot || u.kind === 'heli';
          let ang = free ? want : u.a;
          let sp = 0;
          let face = want;
          // Ground units keep out of the water and boats keep to it. Heading
          // into the edge, they slide along it whichever way is nearer to
          // where they are going (and stick to that way, so they don't dither).
          let slideA: number | null = null;
          if (u.kind !== 'heli' && this.okAt(u, u.x, u.y)) {
            const ahead = (a: number) =>
              this.okAt(u, u.x + Math.cos(a) * 2, u.y + Math.sin(a) * 2) && this.okAt(u, u.x + Math.cos(a) * 3.5, u.y + Math.sin(a) * 3.5) && this.okAt(u, u.x + Math.cos(a) * 5, u.y + Math.sin(a) * 5);
            if (!ahead(want)) {
              const side = u.slide ?? (hash2(Math.floor(u.x), Math.floor(u.y), 5) < 0.5 ? 1 : -1);
              search: for (const k of [0.35, 0.7, 1.05, 1.4, 1.75, 2.1]) {
                for (const sg of [side, -side]) {
                  if (ahead(want + sg * k)) {
                    slideA = want + sg * k;
                    u.slide = sg;
                    break search;
                  }
                }
              }
              if (slideA === null) u.moving = false;
              else face = slideA;
            }
          }
          // a long slide along the shore means it is trying to get somewhere
          // across the water: give up
          u.slideT = slideA === null ? Math.max(0, (u.slideT ?? 0) - dt * 0.5) : (u.slideT ?? 0) + dt;
          if (u.slideT > 8) u.moving = false;
          const diff = angDiff(face, u.a);
          const stepA = st.turn * dt;
          u.a = Math.abs(diff) <= stepA ? face : u.a + Math.sign(diff) * stepA;
          if (slideA !== null) {
            ang = slideA;
            sp = Math.min(dist, st.speed * dt * (free ? 1 : 0.8));
          } else if (u.moving) {
            const go = free ? 1 : Math.max(0, Math.cos(angDiff(want, u.a)) - 0.4) / 0.6;
            ang = free ? want : u.a;
            // (a tank still turning towards dry land waits to get there)
            sp = u.kind !== 'heli' && !this.okAt(u, u.x + Math.cos(ang) * 5, u.y + Math.sin(ang) * 5) && this.okAt(u, u.x, u.y) ? 0 : Math.min(dist, st.speed * 1.1 * dt * go);
          }
          // give up if it has got hardly any closer in the last few seconds
          // (it has hit a dead end)
          if ((u.stuck = (u.stuck ?? 0) + dt) > 4) {
            if ((u.best ?? 1e9) - dist < 4) u.moving = false;
            u.best = dist;
            u.stuck = 0;
          }
          // never step from dry land into the water (or a boat onto land)
          const nx = u.x + Math.cos(ang) * sp;
          const ny = u.y + Math.sin(ang) * sp;
          if (u.kind === 'heli' || this.okAt(u, nx, ny) || !this.okAt(u, u.x, u.y)) {
            u.x = nx;
            u.y = ny;
          }
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
        if (u.target) {
          // (fight() aims it)
        } else if (u.moving) u.turretGoal = u.a;
        else {
          u.idle -= dt;
          if (u.idle <= 0) {
            u.idle = 2 + Math.random() * 5;
            u.turretGoal = u.a + (Math.random() - 0.5) * 2.4;
          }
        }
        const d = angDiff(u.turretGoal, u.turret);
        u.turret += Math.sign(d) * Math.min(Math.abs(d), (u.target ? 3.2 : 2.2) * dt);
      }
      // badly damaged vehicles smoke
      if (u.hp < 0.5 && !foot && Math.random() < dt * (u.hp < 0.25 ? 6 : 3)) {
        const [sx, sy] = toScreen(u.x, u.y, u.z + (u.kind === 'heli' ? HELI_ALT : 0) + MID[u.kind] + 2);
        this.fx.smoke(sx, sy, true, 1);
      }
      if (u.moving || u.deploy || u.job || u.target) {
        u.home = u.pace = u.look = u.face = undefined;
      } else if (foot) this.paceAbout(u, dt);
      else if (u.kind === 'arty') {
        // edge round a little now and then, as if the crew were looking about
        if (u.look === undefined) {
          u.idle -= dt;
          if (u.idle <= 0) {
            u.idle = 3 + Math.random() * 6;
            u.face ??= u.a;
            u.look = u.face + (angDiff(u.a, u.face) > 0 ? -1 : 1) * (0.25 + Math.random() * 0.35);
          }
        } else {
          const d = angDiff(u.look, u.a);
          const stepA = st.turn * 0.35 * dt;
          if (Math.abs(d) <= stepA) {
            u.a = u.look;
            u.look = undefined;
          } else u.a += Math.sign(d) * stepA;
        }
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
        if (b.rise === 1) {
          this.mapVersion++;
          if (b.own && b.kind === 'refinery' && !b.gift) {
            // a refinery comes with a hauler, which gets straight to work
            b.gift = true;
            const [fx, fy] = this.fold(b.x + DOCK[0], b.y + DOCK[1] + 6);
            const u = this.newUnit('hauler', ME, fx, fy, Math.PI / 2);
            u.job = { st: 'seek', t: 0 };
            u.load = 0;
          }
        }
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
        this.towerFight(b, dt);
        if (!b.target && Math.random() < dt * 0.3) b.gunGoal = Math.random() * Math.PI * 2;
        const d = angDiff(b.gunGoal, b.gun);
        b.gun += Math.sign(d) * Math.min(Math.abs(d), (b.target ? 2.6 : 1.4) * dt);
      }
      // a badly damaged building burns and smokes
      if (b.hp <= DAMAGED)
        for (const p of this.states(b.kind, b.f).damaged.fx)
          if (Math.random() < dt * 2.5) {
            const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z + 3);
            this.fx.smoke(sx, sy, true, 1.5);
          }
    }
    this.updateRuins(dt);
    this.fx.step(dt);

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
    this.markers = this.markers.filter((m) => m.t < BURST_FRAME * burstFrames(m.foe ? 'attack' : 'move').length);

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

  // ---------- The enemy (Combat stage) ----------

  // Posts round the enemy base where its units wait in small groups, in
  // world coordinates (first copy). The last one is the muster point by its
  // Foundry, where new units gather until there are enough to send out.
  private posts: [number, number][] = [];
  // what each of its unit-making buildings is turning out, and how long to go
  private aiJobs = new Map<Building, { kind: Kind; t: number }>();
  private aiT = 0;

  // Posts at a ring round the enemy base (screen point sx, sy), on open
  // ground clear of buildings, and keeping well back from your base (hx, hy).
  private makePosts(sx: number, sy: number, hx: number, hy: number, rand: () => number): void {
    const T = this.terrain;
    const [nhx, nhy] = nearestCopy(sx, sy, hx, hy, this.w, this.h);
    const apart = Math.hypot(nhx - sx, nhy - sy);
    const a0 = rand() * Math.PI * 2;
    for (let i = 0; i < POSTS; i++) {
      let got: [number, number] | null = null;
      for (let t = 0; t < 120 && !got; t++) {
        const a = a0 + (i / POSTS) * Math.PI * 2 + (rand() - 0.5) * 0.6;
        const r = 300 - t * 1.2;
        const px = sx + Math.cos(a) * r;
        const py = sy + Math.sin(a) * r * 0.5;
        if (Math.hypot(px - nhx, py - nhy) < apart * 0.6) continue;
        const [x, y] = toWorld(px, py, 0);
        const ok = (dx: number, dy: number) => {
          const k = T.k(x + dx, y + dy);
          return (k === K.Grass || k === K.Road) && !T.isHigh(x + dx, y + dy);
        };
        if (!ok(0, 0) || !ok(14, 0) || !ok(-14, 0) || !ok(0, 14) || !ok(0, -14)) continue;
        if (this.buildings.some((b) => inside(x, y, b.pad, 14))) continue;
        got = T.fold(x, y);
      }
      if (got) this.posts.push(got);
    }
    const yard = this.buildings.find((b) => b.f === ENEMY && b.kind === 'yard');
    this.posts.push(yard ? this.fold(yard.x + 10, yard.y + yard.art.ry + 24) : this.fold(...toWorld(sx, sy, 0)));
  }

  // Units that stand guard: not boats (they keep to their lake) or haulers.
  private guard(u: Unit): boolean {
    return u.f === ENEMY && u.kind !== 'boat' && u.kind !== 'hauler' && u.kind !== 'mcv';
  }

  private sendTo(u: Unit, p: [number, number]): void {
    [u.tx, u.ty] = this.nearPoint(u.x, u.y, p[0], p[1]);
    u.moving = true;
    u.target = undefined;
    u.forced = u.chase = false;
    u.anchor = undefined;
  }

  // The enemy never goes looking for a fight: it keeps its army up to
  // strength and its posts manned, and its units fight whatever comes near.
  private enemyAI(dt: number): void {
    if (this.stage !== 'combat' || !this.posts.length) return;
    // replace what has been lost, one at a time at each building
    for (const [b, j] of [...this.aiJobs]) {
      if (b.dead) {
        this.aiJobs.delete(b);
        continue;
      }
      if ((j.t -= dt) > 0) continue;
      this.aiJobs.delete(b);
      this.enemyUnit(b, j.kind);
    }
    const count = new Map<Kind, number>();
    for (const u of this.units) if (u.f === ENEMY) count.set(u.kind, (count.get(u.kind) ?? 0) + 1);
    for (const j of this.aiJobs.values()) count.set(j.kind, (count.get(j.kind) ?? 0) + 1);
    for (const b of this.buildings) {
      if (b.f !== ENEMY || b.dead || b.rise < 1 || !MAKERS.includes(b.kind) || this.aiJobs.has(b)) continue;
      let best: Kind | null = null;
      let short = 0;
      for (const [k, n] of GARRISON) {
        if (MAKER[k] !== b.kind) continue;
        const s = (n - (count.get(k) ?? 0)) / n;
        if (s > short) {
          short = s;
          best = k;
        }
      }
      if (!best) continue;
      const cost = TECH.find((t) => t.unit === best)?.cost ?? 500;
      this.aiJobs.set(b, { kind: best, t: buildTime(cost) * 0.8 });
      count.set(best, (count.get(best) ?? 0) + 1);
    }

    if ((this.aiT -= dt) > 0) return;
    this.aiT = 1;
    const out = this.posts.length - 1; // posts out round the base (the last is the muster point)
    const fill = this.posts.map(() => 0);
    const free: Unit[] = [];
    for (const u of this.units) {
      if (!this.guard(u)) continue;
      if (u.post !== undefined && u.post < out) fill[u.post]++;
      else if (!u.moving && !u.target) free.push(u);
      // one that has wandered off its spot (after a chase) goes back to it
      if (u.spot && !u.moving && !u.target && Math.hypot(u.x - u.spot[0], u.y - u.spot[1]) > 20 && Math.random() < 0.3) this.sendTo(u, this.nearPoint(u.x, u.y, ...u.spot));
    }
    // the post most short of its group gets a group from the muster point,
    // once there are enough there to fill it
    let pi = -1;
    for (let i = 0; i < out; i++) if (fill[i] < SQUAD && (pi < 0 || fill[i] < fill[pi])) pi = i;
    if (pi < 0) return;
    const need = SQUAD - fill[pi];
    if (free.length < need) return;
    const p = this.posts[pi];
    const dist = (u: Unit) => {
      const [x, y] = this.nearPoint(p[0], p[1], u.x, u.y);
      return Math.hypot(x - p[0], y - p[1]);
    };
    free.sort((a, b) => dist(a) - dist(b));
    for (let i = 0; i < need; i++) {
      const u = free[i];
      const a = ((fill[pi] + i) / SQUAD) * Math.PI * 2;
      u.post = pi;
      u.spot = [p[0] + Math.cos(a) * 9, p[1] + Math.sin(a) * 9];
      this.sendTo(u, u.spot);
    }
  }

  // A new enemy unit comes out of b and goes to the muster point.
  private enemyUnit(b: Building, kind: Kind): void {
    const air = kind === 'heli';
    const [fx, fy] = this.fold(air ? b.x : b.x + (Math.random() - 0.5) * 6, air ? b.y : b.y + b.art.ry - 2);
    const u = this.newUnit(kind, ENEMY, fx, fy, Math.PI / 2);
    const m = this.posts[this.posts.length - 1];
    u.post = this.posts.length - 1;
    u.spot = [m[0] + (Math.random() - 0.5) * 30, m[1] + (Math.random() - 0.5) * 30];
    this.sendTo(u, u.spot);
    this.mapVersion++;
  }

  // ---------- Combat ----------

  // The enemy unit or building under screen point (x, y), if any.
  private enemyAt(x: number, y: number): Target | null {
    const h = this.unitAt(x, y);
    if (h && h.u.f !== ME) return h.u;
    const b = this.buildingAt(x, y);
    return b && b.f !== ME ? b : null;
  }

  private canHit(w: Weapon | undefined, t: Target): boolean {
    if (!w || t.dead) return false;
    return !isB(t) && t.kind === 'heli' ? w.air : w.ground;
  }

  // How far (x, y) is from target t: to a building's nearest wall.
  private reach(x: number, y: number, t: Target): number {
    const [tx, ty] = this.nearPoint(x, y, t.x, t.y);
    if (!isB(t)) return Math.hypot(tx - x, ty - y);
    return Math.hypot(Math.max(0, Math.abs(x - tx) - t.art.rx), Math.max(0, Math.abs(y - ty) - t.art.ry));
  }

  // Where to aim at t from (x, y): its middle, or the near side of a building.
  private aimPoint(x: number, y: number, t: Target): [number, number, number] {
    const [tx, ty] = this.nearPoint(x, y, t.x, t.y);
    if (isB(t)) {
      const cx = Math.max(tx - t.art.rx * 0.6, Math.min(tx + t.art.rx * 0.6, x));
      const cy = Math.max(ty - t.art.ry * 0.6, Math.min(ty + t.art.ry * 0.6, y));
      return [cx, cy, 6];
    }
    return [tx, ty, t.z + (t.kind === 'heli' ? HELI_ALT : 0) + MID[t.kind] * 0.7];
  }

  // The nearest enemy of side f within range of (x, y) that weapon w can hit:
  // units first, then gun towers (other buildings only when told to).
  private acquire(f: number, x: number, y: number, w: Weapon, range: number): Target | undefined {
    let best: Target | undefined;
    let bd = range;
    for (const o of this.units) {
      if (o.f === f || !this.canHit(w, o)) continue;
      const d = this.reach(x, y, o);
      if (d <= bd) {
        bd = d;
        best = o;
      }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (b.f === f || b.kind !== 'tower' || b.rise < 1 || !this.canHit(w, b)) continue;
      const d = this.reach(x, y, b);
      if (d <= bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // Your units go for t: all of them that can hit it.
  private attack(sel: Unit[], t: Target): void {
    for (const u of sel) {
      if (!this.canHit(WEAPON[u.kind], t)) continue;
      u.target = t;
      u.forced = true;
      u.chase = false;
      u.anchor = undefined;
      u.repath = 0;
      u.pace = undefined;
    }
    t.aimT = this.time;
    if (this.moveMarks) {
      const [mx, my] = this.fold(t.x, t.y);
      this.markers.push({ x: mx, y: my, z: isB(t) ? 0 : t.z, t: 0, foe: true });
    }
  }

  // One unit's fighting, each frame: pick a target if it is standing about,
  // close in on one it was told to attack (or that hit it), turn its gun on
  // it and fire when loaded.
  private fight(u: Unit, dt: number): void {
    const w = WEAPON[u.kind];
    if (!w) return;
    u.cool = Math.max(0, (u.cool ?? 0) - dt);
    let t = u.target;
    if (t && !this.canHit(w, t)) {
      t = u.target = undefined;
      u.forced = u.chase = false;
    }
    if (!t && !u.moving && !u.deploy) {
      u.scan = (u.scan ?? Math.random() * 0.4) - dt;
      if (u.scan <= 0) {
        u.scan = 0.4 + Math.random() * 0.3;
        t = u.target = this.acquire(u.f, u.x, u.y, w, w.range);
      }
    }
    if (!t) return;
    const d = this.reach(u.x, u.y, t);
    if (d > w.range) {
      if (u.chase && u.anchor && Math.hypot(u.x - u.anchor[0], u.y - u.anchor[1]) > LEASH) {
        // too far from where it was: give up and go back
        [u.tx, u.ty] = u.anchor;
        u.moving = true;
        u.target = u.anchor = undefined;
        u.chase = false;
        return;
      }
      if (!u.forced && !u.chase) {
        u.target = undefined;
        return;
      }
      if ((u.repath = (u.repath ?? 0) - dt) <= 0 || !u.moving) {
        u.repath = 0.5;
        const [ax, ay] = this.aimPoint(u.x, u.y, t);
        u.tx = ax;
        u.ty = ay;
        u.moving = true;
      }
      return;
    }
    if (u.moving) {
      if (!u.forced && !u.chase) return; // on its way somewhere: no stopping
      u.moving = false;
      u.tx = u.x;
      u.ty = u.y;
    }
    const [ax, ay] = this.aimPoint(u.x, u.y, t);
    const want = Math.atan2(ay - u.y, ax - u.x);
    let off: number;
    if (u.kind === 'light' || u.kind === 'heavy') {
      u.turretGoal = want;
      off = angDiff(want, u.turret);
    } else {
      // no turret: the whole thing turns to face it
      const diff = angDiff(want, u.a);
      const stepA = Math.min(UNIT[u.kind].turn, 6) * dt;
      u.a = Math.abs(diff) <= stepA ? want : u.a + Math.sign(diff) * stepA;
      off = angDiff(want, u.a);
    }
    if (Math.abs(off) > 0.12 || u.cool > 0) return;
    u.cool = w.rof * (0.9 + Math.random() * 0.2);
    u.fired = this.time;
    const z = u.z + (u.kind === 'heli' ? HELI_ALT + Math.sin(u.anim * 2) * 1.2 : 0);
    this.shoot(u, w, t, muzzles(u.kind, u.x, u.y, z, u.a, u.turret));
  }

  // A gun tower picks the nearest enemy unit in range, turns and fires.
  private towerFight(b: Building, dt: number): void {
    const w = WEAPON.tower!;
    const p = b.art.fx[0];
    const gx = b.x + p.x;
    const gy = b.y + p.y;
    b.cool = Math.max(0, (b.cool ?? 0) - dt);
    let t = b.target;
    if (t && (!this.canHit(w, t) || this.reach(gx, gy, t) > w.range)) t = b.target = undefined;
    if (!t) {
      b.scan = (b.scan ?? 0) - dt;
      if (b.scan > 0) return;
      b.scan = 0.4;
      t = b.target = this.acquire(b.f, gx, gy, w, w.range);
      if (!t) return;
    }
    const [ax, ay] = this.aimPoint(gx, gy, t);
    const want = Math.atan2(ay - gy, ax - gx);
    b.gunGoal = want;
    if (Math.abs(angDiff(want, b.gun)) > 0.1 || b.cool > 0) return;
    b.cool = w.rof * (0.9 + Math.random() * 0.2);
    this.shoot(b, w, t, muzzles('tower', gx, gy, p.z, 0, b.gun));
  }

  // Rounds leave the muzzles (a flash at each) for t.
  private shoot(src: Unit | Building, w: Weapon, t: Target, from: [number, number, number][]): void {
    for (const m of from) {
      const [sx, sy] = toScreen(...m);
      this.fx.muzzle(sx, sy, w.shot !== 'bullet');
      let aim = this.aimPoint(m[0], m[1], t);
      let track: Shot['track'];
      if (w.shot === 'arc') {
        // a shell lobbed at where the target is now, landing near it
        const sc = w.scatter ?? 0;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * sc;
        const ax = aim[0] + Math.cos(ang) * r;
        const ay = aim[1] + Math.sin(ang) * r;
        aim = [ax, ay, isB(t) ? 2 : this.terrain.elev(ax, ay)];
      } else track = () => (t.dead ? null : this.aimPoint(m[0], m[1], t));
      this.fx.fire(makeShot(w.shot, m, aim, w.speed, (s) => this.impact(s, w, t, src), track));
    }
  }

  private impact(s: Shot, w: Weapon, t: Target, src: Unit | Building): void {
    const [sx, sy] = toScreen(s.x, s.y, s.z);
    if (w.splash) {
      // a shell bursting: everything of the other side near it is hit, less further out
      this.fx.boom(sx, sy, 6);
      const R = w.splash;
      for (const o of [...this.units]) {
        if (o.f === src.f || o.kind === 'heli' || o.dead) continue;
        const d = this.reach(s.x, s.y, o);
        if (d < R) this.damage(o, w.dmg * VERSUS[w.wh][UNIT_DEF[o.kind].armor] * (1 - (d / R) * 0.6), src);
      }
      for (const b of [...this.buildings]) {
        if (b.f === src.f || b.dead) continue;
        const d = this.reach(s.x, s.y, b);
        if (d < R) this.damage(b, w.dmg * VERSUS[w.wh][BUILDING_DEF[b.kind].armor] * (1 - (d / R) * 0.6), src);
      }
      return;
    }
    const soft = !isB(t) && UNIT_DEF[t.kind].armor === 'none';
    if (w.shot === 'bullet') {
      if (soft) this.fx.dust(sx, sy);
      else this.fx.sparks(sx, sy, 4);
    } else {
      this.fx.boom(sx, sy, w.shot === 'rocket' ? 3.5 : 3);
      this.fx.sparks(sx, sy, 6);
    }
    if (t.dead) return;
    const arm = isB(t) ? BUILDING_DEF[t.kind].armor : UNIT_DEF[t.kind].armor;
    this.damage(t, w.dmg * VERSUS[w.wh][arm], src);
  }

  private damage(t: Target, amt: number, src: Unit | Building): void {
    if (t.dead) return;
    const max = isB(t) ? BUILDING_DEF[t.kind].strength : UNIT_DEF[t.kind].strength;
    t.hp = Math.max(0, t.hp - amt / max);
    t.hitT = this.time;
    // a flash of light where a big round lands (buildings shrug off bullets)
    if (!isB(t) || amt >= 12) t.flashT = this.time;
    if (t.hp <= 0) {
      if (isB(t)) this.raze(t);
      else this.kill(t);
      return;
    }
    if (src.dead) return;
    // it fights back, and its friends nearby come to help
    if (!isB(t)) this.retaliate(t, src);
    for (const o of this.units) if (o.f === t.f && o !== t && this.reach(o.x, o.y, t) < HELP) this.retaliate(o, src);
  }

  private retaliate(u: Unit, src: Unit | Building): void {
    if (u.target || u.moving || u.deploy || u.job || !this.canHit(WEAPON[u.kind], src)) return;
    u.target = src;
    u.chase = true;
    u.forced = false;
    u.anchor = [u.x, u.y];
    u.repath = 0;
  }

  // A unit is destroyed: it blows up and flies to pieces, which land round
  // where it was and fade away (a copter's rain down from the sky).
  private kill(u: Unit): void {
    u.dead = true;
    this.units.splice(this.units.indexOf(u), 1);
    if (this.lastTap?.u === u) this.lastTap = null;
    const air = u.kind === 'heli' ? HELI_ALT : 0;
    const r = BOOM[u.kind] ?? 3;
    const [sx, sy] = toScreen(u.x, u.y, u.z + air + MID[u.kind] * 0.5);
    const [, gy] = toScreen(u.x, u.y, u.z);
    const foot = u.kind === 'inf' || u.kind === 'rocket';
    for (const [spr, x, y, z] of this.layers(u)) {
      const [px, py] = toScreen(x, y, z);
      this.fx.shatter(spr, px, py, sx, sy, gy, foot ? 2 : 4, foot ? 22 : 30 + r * 2);
    }
    this.fx.boom(sx, sy, r);
    if (!foot) this.fx.boom(sx + (Math.random() - 0.5) * r, sy - r * 0.3, r * 0.6, 0.15);
    if (u.sel) this.emit();
  }

  // The sprites a unit is drawn with, and where (world point and height).
  private layers(u: Unit): [StackSprite, number, number, number][] {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    switch (u.kind) {
      case 'inf':
      case 'rocket':
        return [[(u.kind === 'inf' ? art.infantry : art.rocket)[0][dirIndex(u.a, 16)], u.x, u.y, u.z]];
      case 'light':
      case 'heavy':
        return [
          [(u.kind === 'light' ? art.lightTank : art.heavyTank)[di], u.x, u.y, u.z],
          [(u.kind === 'light' ? art.lightTurret : art.heavyTurret)[dirIndex(u.turret, DIRS)], u.x - Math.cos(u.a) * 1.2, u.y - Math.sin(u.a) * 1.2, u.z],
        ];
      case 'heli':
        return [[art.heli[di], u.x, u.y, u.z + HELI_ALT]];
      case 'boat':
        return [[art.boat[di], u.x, u.y, 0]];
      default:
        return [[{ mcv: art.mcv, buggy: art.buggy, hauler: art.hauler, arty: art.artillery }[u.kind][di], u.x, u.y, u.z]];
    }
  }

  // A building is destroyed: it goes up in a string of explosions and leaves a ruin.
  private raze(b: Building): void {
    b.dead = true;
    this.buildings.splice(this.buildings.indexOf(b), 1);
    const { rx, ry } = b.art;
    const n = 4 + Math.round((rx + ry) / 6);
    for (let i = 0; i < n; i++) {
      const [sx, sy] = toScreen(b.x + (Math.random() * 2 - 1) * rx * 0.8, b.y + (Math.random() * 2 - 1) * ry * 0.8, 2 + Math.random() * 12);
      this.fx.boom(sx, sy, 5 + Math.random() * 5, i * 0.12);
    }
    const [cx, cy] = toScreen(b.x, b.y, 8);
    this.fx.boom(cx, cy, (rx + ry) * 0.45, 0.4);
    this.ruins.push({ kind: b.kind, f: b.f, x: b.x, y: b.y, states: this.states(b.kind, b.f), t: -0.45 });
    if (b.own) this.notice(`${BNAME[b.kind]} destroyed`);
    this.mapVersion++;
    if (b.sel) this.emit();
  }

  private updateRuins(dt: number): void {
    for (const r of this.ruins) {
      const was = r.t;
      r.t += dt;
      if (was < 0 && r.t >= 0) {
        // the big bang: the building flies to pieces over the ruin
        const [sx, sy] = toScreen(r.x, r.y, 0);
        const [ox, oy] = toScreen(r.x, r.y, 10);
        this.fx.shatter(r.states.damaged.spr, sx, sy, ox, oy, sy, 6, 55, 260);
      }
      // smoke pours off it for a while, thins out and stops (the ruin stays)
      const rate = r.t < 15 ? 3 : 3 * Math.max(0, 1 - (r.t - 15) / 25);
      if (r.t > 0 && rate > 0)
        for (const p of r.states.ruin.fx)
          if (Math.random() < (dt * rate) / 2) {
            const [sx, sy] = toScreen(r.x + p.x, r.y + p.y, p.z + 1);
            this.fx.smoke(sx, sy, true, 2);
          }
    }
  }

  private drawRuin(r: Ruin): void {
    if (r.t < 0) {
      // still going up in smoke: the damaged building until the big bang
      this.blit(r.states.damaged.spr, r.x, r.y, 0);
      return;
    }
    this.blit(r.states.ruin.spr, r.x, r.y, 0);
    if (r.t < 8)
      for (const [i, p] of r.states.ruin.fx.entries()) {
        const [sx, sy] = toScreen(r.x + p.x, r.y + p.y, p.z);
        drawFlame(this.ctx, sx, sy, 4 * (1 - r.t / 9), this.time + i, i + 3);
      }
  }

  // ---------- Rendering ----------

  private blit(spr: StackSprite, wx: number, wy: number, z: number, shadowOnly = false): void {
    const [sx, sy] = toScreen(wx, wy, z);
    const c = shadowOnly ? spr.shadow : spr.img;
    if (!c) return;
    drawSprite(this.ctx, c, spr, sx, sy);
    if (this.lit && !shadowOnly) {
      // just hit: a flash of light over it
      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.lit;
      drawSprite(ctx, c, spr, sx, sy);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (this.aimed && !shadowOnly) {
      // just ordered to attack: a white silhouette over it
      this.ctx.globalAlpha = this.aimed;
      drawSprite(this.ctx, whiteOf(c), spr, sx, sy);
      this.ctx.globalAlpha = 1;
    }
  }
  // the white silhouette's strength while drawing an attack target
  private aimed = 0;
  // Ordered to attack lately: three quick white blinks over 0.6s.
  private aimFlash = (t: { aimT?: number }) => {
    const dt = this.time - (t.aimT ?? -9);
    return dt >= 0 && dt < 0.6 && Math.floor(dt / 0.1) % 2 === 0 ? 0.85 : 0;
  };
  // true while drawing something that has just been hit
  private lit = 0;
  private justHit = (t: { flashT?: number }) => this.time - (t.flashT ?? -9) < 0.07;

  // A tread mark at screen point (x, y), if that bit of ground is painted.
  private stamp(x: number, y: number, style: string): void {
    const t = this.tiles.at(x, y);
    if (!t) return;
    const c = t.canvas.getContext('2d')!;
    c.fillStyle = style;
    const X = Math.round(x * ART);
    const Y = Math.round(y * ART);
    const n = CH * ART;
    c.fillRect(X - Math.floor(X / n) * n, Y - Math.floor(Y / n) * n, 1, 1);
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

    // ore fields stain the ground under their nuggets
    c.globalAlpha = 0.9;
    for (const n of this.oreInView(x0 - pad, y0 - pad, x1 + pad, y1 + pad * 1.5))
      if (n.amt >= 10) this.blit(this.oreArt.stain[n.v][n.amt > ORE.node * 0.6 ? 2 : n.amt > ORE.node * 0.25 ? 1 : 0], n.x, n.y, 0);
    c.globalAlpha = 1;

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
      if (spr.shadow) drawSprite(c, spr.shadow, spr, sx, sy);
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
    for (const r of this.ruins) if (seen(r.x, r.y, 4)) items.push({ k: r.x + r.y + Math.min(r.states.ruin.rx, r.states.ruin.ry), draw: () => this.drawRuin(r) });
    const ore = this.oreInView(x0 - pad, y0 - pad, x1 + pad, y1 + pad * 1.5).filter((n) => n.amt >= 10);
    const oreSize = (n: OreNode) => (n.amt > ORE.node * 0.6 ? 2 : n.amt > ORE.node * 0.25 ? 1 : 0);
    for (const n of ore) {
      const spr = this.oreArt.lumps[n.v][oreSize(n)];
      items.push({ k: n.x + n.y, draw: () => this.blit(spr, n.x, n.y, 0) });
    }
    for (const u of this.units) if (u.kind !== 'heli' && seen(u.x, u.y, u.z)) items.push({ k: u.x + u.y + u.z * 2, draw: () => this.drawUnit(u) });
    items.sort((a, b) => a.k - b.k);
    for (const it of items) it.draw();

    for (const p of this.particles) {
      if (p.kind === 'wake' || !inView(p.x, p.y)) continue;
      const k = p.life / p.max;
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle =
        p.kind === 'smoke' ? `rgba(222,222,216,${0.6 * (1 - k)})` : p.kind === 'soot' ? `rgba(70,66,60,${0.55 * (1 - k)})` : `rgba(165,145,105,${0.5 * (1 - k)})`;
      const X = Math.round(p.x - s / 2);
      const Y = Math.round(p.y - s / 2);
      if (s > 1) {
        // a puff with its corners knocked off
        c.fillRect(X + 0.5, Y, s - 1, s);
        c.fillRect(X, Y + 0.5, 0.5, s - 1);
        c.fillRect(X + s - 0.5, Y + 0.5, 0.5, s - 1);
      } else c.fillRect(X, Y, s, s);
      if (s > 2) {
        c.fillStyle = p.kind === 'smoke' ? `rgba(255,255,255,${0.35 * (1 - k)})` : 'rgba(0,0,0,0)';
        c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s / 2), 1);
      }
    }

    this.fx.drawBelow(c);
    for (const u of this.units) if (u.kind === 'heli' && seen(u.x, u.y, u.z)) this.drawUnit(u);
    this.fx.drawAbove(c);

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
    // anything hit lately shows its health for a moment
    for (const u of this.units)
      if (!u.sel && this.time - (u.hitT ?? -9) < 2.5 && seen(u.x, u.y, u.z)) {
        const { x, y, rx, ry } = this.unitBox(u);
        const bw = Math.max(8, rx * 2);
        healthBar(c, Math.round(x - bw / 2), y - ry - 4, bw, u.hp);
      }
    for (const b of this.buildings) if (!b.sel && this.time - (b.hitT ?? -9) < 2.5 && seen(b.x, b.y, 10)) this.buildingBar(b);

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

    // order markers: the cursor's click burst, on top of everything
    for (const m of this.markers) {
      const frames = burstFrames(m.foe ? 'attack' : 'move');
      const img = frames[Math.min(frames.length - 1, Math.floor(m.t / BURST_FRAME))];
      const [sx, sy] = toScreen(m.x, m.y, m.z);
      if (!inView(sx, sy)) continue;
      c.drawImage(img, Math.round(sx) - BURST_CENTER, Math.round(sy) - BURST_CENTER);
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
    c.fillStyle = b.own ? '#ffffff' : '#ff6a5a';
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
    this.buildingBar(b);
  }

  // A building's health, over the top of it.
  private buildingBar(b: Building): void {
    const c = this.ctx;
    const { rx, ry } = b.art;
    const spr = b.art.spr;
    const [sx, sy] = toScreen(b.x, b.y);
    const top = this.spriteTop(b);
    const bw = Math.max(16, Math.round((rx + ry) * 1.1));
    healthBar(c, Math.round(sx - bw / 2), Math.round(Math.min(sy - spr.cy + top, sy - 8) - 5), bw, b.hp);
  }

  // How far down a building's sprite its first solid pixel is.
  private tops = new Map<V2BuildingArt, number>();
  private spriteTop(b: Building): number {
    let t = this.tops.get(b.art);
    if (t === undefined) {
      const img = b.art.spr.img;
      const d = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
      t = 0;
      find: for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          if (d[(y * img.width + x) * 4 + 3] > 200) {
            t = y / ART;
            break find;
          }
      this.tops.set(b.art, t);
    }
    return t;
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
      for (const r of this.ruins) {
        const [sx, sy] = toScreen(r.x, r.y);
        const [fx, fy] = this.lapped(r.x, r.y, -Math.floor(sx / this.w), -Math.floor(sy / this.h));
        this.blit(r.states.ruin.spr, fx, fy, 0);
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
    this.lit = this.justHit(u) ? 0.45 : 0;
    this.aimed = this.aimFlash(u);
    try {
      this.drawUnitNow(u);
    } finally {
      this.lit = 0;
      this.aimed = 0;
    }
  }

  private drawUnitNow(u: Unit): void {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    // a gun kicks back as it fires
    const kick = this.time - (u.fired ?? -9) < 0.1 ? 1 : 0;
    switch (u.kind) {
      case 'mcv':
        this.blit(art.mcv[di], u.x, u.y, u.z);
        break;
      case 'inf':
      case 'rocket': {
        const frames = u.kind === 'inf' ? art.infantry : art.rocket;
        const fr = u.moving ? 1 + (Math.floor(u.anim * 7) % 2) : u.pace ? 1 + (Math.floor(u.anim * 4) % 2) : 0;
        this.blit(frames[fr][dirIndex(u.a, 16)], u.x, u.y, u.z);
        break;
      }
      case 'light':
      case 'heavy': {
        const hull = u.kind === 'light' ? art.lightTank : art.heavyTank;
        const tur = u.kind === 'light' ? art.lightTurret : art.heavyTurret;
        this.blit(hull[di], u.x, u.y, u.z);
        this.blit(tur[dirIndex(u.turret, DIRS)], u.x - Math.cos(u.a) * 1.2 - Math.cos(u.turret) * kick, u.y - Math.sin(u.a) * 1.2 - Math.sin(u.turret) * kick, u.z);
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
        const back = u.kind === 'arty' ? kick : 0;
        this.blit(spr[di], u.x - Math.cos(u.a) * back, u.y - Math.sin(u.a) * back, u.z);
        if (u.kind === 'buggy' && !u.moving) drawBuggyLights(this.ctx, u.x, u.y, u.z, u.a, u.anim);
      }
    }
  }

  // The box round a unit: half-size and centre on the screen.
  private unitBox(u: Unit): { x: number; y: number; rx: number; ry: number } {
    const st = UNIT[u.kind];
    const [sx, sy] = this.screenOf(u);
    const foot = u.kind === 'inf' || u.kind === 'rocket';
    return { x: Math.round(sx), y: Math.round(sy), rx: foot ? 5 : st.r + 4, ry: foot ? 7 : Math.round(st.r * 0.75) + 2 };
  }

  private drawSelection(u: Unit): void {
    const c = this.ctx;
    const { x, y, rx, ry } = this.unitBox(u);
    c.fillStyle = u.f === ME ? '#ffffff' : '#ff6a5a';
    corners(c, x, y, rx, ry, 2);
    const bw = Math.max(8, rx * 2);
    healthBar(c, Math.round(x - bw / 2), y - ry - 4, bw, u.hp);
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
      if (H - top > 0) c.drawImage(spr.img, 0, top, W, H - top, x, y + top / ART, spr.w, (H - top) / ART);
      return;
    }
    const hurt = b.hp <= DAMAGED ? this.states(b.kind, b.f).damaged : null;
    this.lit = this.justHit(b) ? 0.22 : 0;
    this.aimed = this.aimFlash(b);
    this.blit(hurt ? hurt.spr : b.art.spr, b.x, b.y, 0);
    this.lit = 0;
    this.aimed = 0;
    if (hurt)
      for (const [i, p] of hurt.fx.entries()) {
        const [x, y] = toScreen(b.x + p.x, b.y + p.y, p.z);
        drawFlame(c, x, y, b.hp < 0.25 ? 5 : 3.5, this.time + i * 0.37, i + 11);
      }
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

// A health bar: a dark frame, green to red by how much is left, in segments.
function healthBar(c: CanvasRenderingContext2D, bx: number, by: number, bw: number, hp: number): void {
  c.fillStyle = '#111';
  c.fillRect(bx - 1, by - 1, bw + 2, 4);
  c.fillStyle = hp > 0.66 ? '#5ee05e' : hp > 0.33 ? '#e8d24a' : '#e85a4a';
  c.fillRect(bx, by, Math.round(bw * hp), 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 3; i < bw; i += 3) c.fillRect(bx + i, by, 1, 2);
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
