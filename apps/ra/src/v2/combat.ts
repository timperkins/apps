// Combat for v2: what each unit and building is armed with and armored in,
// the shots in flight, and the flashes, sparks, explosions, fire and smoke.
//
// The rules follow the classic RTS scheme: every weapon has a warhead, every
// target an armor type, and a table says how much of the damage gets through
// (small arms shred infantry and barely scratch tanks, armor-piercing rounds
// are the other way round, high explosive is good against buildings). Units
// with nothing to do pick the nearest enemy in range and fire on it, and a
// unit that is hit turns on whoever hit it. All the numbers are our own.
import { ART, RGB, hash2, vnoise } from '../gfx';
import { COMET_NOSE, CRUISER_LAUNCHERS, CRUISER_RING_Z, TROOPER_MUZZLE, type BuildingKind } from './sprites';
import { StackSprite, toScreen } from './stack';

export type Armor = 'none' | 'wood' | 'light' | 'heavy' | 'concrete';
// FL: fire, from flamethrowers: it roasts soldiers and wooden buildings and
// does little to armor or concrete.
// EN: a Lumen beam's light, which burns through most things fairly evenly.
export type Warhead = 'SA' | 'AP' | 'HE' | 'FL' | 'EN';
// bite: an attack dog's jaws (nothing flies); flame: a jet of burning fuel.
// beam: a Lumen lens's bolt of light, there at once.
// torpedo: runs along the water to a ship; drone: a carrier's little
// flying wing, out to the target and down onto it. missile: the Comet
// launcher's one big rocket, up high on a trail of smoke and down on the spot.
export type ShotKind = 'bullet' | 'shell' | 'rocket' | 'arc' | 'grenade' | 'flame' | 'bite' | 'beam' | 'torpedo' | 'drone' | 'missile';

// How much of each warhead's damage gets through each armor.
export const VERSUS: Record<Warhead, Record<Armor, number>> = {
  SA: { none: 1, wood: 0.5, light: 0.6, heavy: 0.25, concrete: 0.25 },
  AP: { none: 0.3, wood: 0.75, light: 0.75, heavy: 1, concrete: 0.5 },
  HE: { none: 0.9, wood: 0.75, light: 0.6, heavy: 0.25, concrete: 1 },
  FL: { none: 1.1, wood: 1, light: 0.55, heavy: 0.3, concrete: 0.45 },
  EN: { none: 0.9, wood: 0.8, light: 0.8, heavy: 0.6, concrete: 0.7 },
};

// One cell of range, in world units (about a tank's length).
export const CELL = 16;

export interface Weapon {
  name: string;
  dmg: number; // per round, before armor
  rof: number; // seconds between shots
  range: number; // world units
  wh: Warhead;
  shot: ShotKind;
  speed: number; // world units a second (bullets arrive at once)
  barrels: number; // rounds per shot, one from each barrel
  air: boolean; // can hit aircraft
  ground: boolean; // can hit things on the ground or water
  splash?: number; // radius of an area hit (artillery)
  scatter?: number; // how far off the aim point a round may land
  big?: boolean; // heavy rounds: they shove tanks about, not just soldiers
  foot?: boolean; // only hits foot soldiers (a dog's bite, the Commando's pistols)
  c4?: boolean; // walks up to buildings and blows them up with a charge (the Commando)
  sea?: boolean; // only hits ships (torpedoes)
  deep?: boolean; // reaches a submarine under the water (depth charges)
  min?: number; // can't fire on anything nearer than this (world units)
}

export type UnitKind = 'mcv' | 'light' | 'heavy' | 'buggy' | 'apc' | 'hauler' | 'arty' | 'boat' | 'heli' | 'inf' | 'rocket' | 'gren' | 'eng' | 'dog' | 'cmdo' | 'flamer' | 'scorch' | 'lumen' | 'comet' | 'skyguard' | 'heron' | 'jet' | 'plane' | 'otter' | 'destroyer' | 'cruiser' | 'carrier' | 'sub';
// The aircraft: they fly over everything and only some weapons reach them.
export const AIR: ReadonlySet<string> = new Set<UnitKind>(['heli', 'heron', 'jet', 'plane']);
export const isAir = (k: string): boolean => AIR.has(k);
// The ships: they keep to the water. (The Otter hovercraft goes on land
// and water both, so it isn't one of them.)
export const NAVAL: ReadonlySet<string> = new Set<UnitKind>(['boat', 'destroyer', 'cruiser', 'carrier', 'sub']);
export const isNaval = (k: string): boolean => NAVAL.has(k);
// The buildings that fight back on their own.
export type DefenseKind = 'tower' | 'prism' | 'aa';
export const DEFENSE: ReadonlySet<string> = new Set<DefenseKind>(['tower', 'prism', 'aa']);
export const isDefense = (k: string): k is DefenseKind => DEFENSE.has(k);

// The foot soldiers.
export const FOOT: ReadonlySet<UnitKind> = new Set<UnitKind>(['inf', 'rocket', 'gren', 'eng', 'dog', 'cmdo', 'flamer']);
export const isFoot = (k: string): boolean => FOOT.has(k as UnitKind);

export const WEAPON: Partial<Record<UnitKind | DefenseKind, Weapon>> = {
  inf: { name: 'Rifle', dmg: 15, rof: 1.1, range: 3.5 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true },
  gren: { name: 'Grenades', dmg: 45, rof: 2.4, range: 4.25 * CELL, wh: 'HE', shot: 'grenade', speed: 55, barrels: 1, air: false, ground: true, splash: 8, scatter: 3 },
  dog: { name: 'Bite', dmg: 400, rof: 1.3, range: 1.1 * CELL, wh: 'SA', shot: 'bite', speed: 0, barrels: 1, air: false, ground: true, foot: true },
  cmdo: { name: 'Twin pistols', dmg: 90, rof: 0.8, range: 5 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 2, air: false, ground: true, foot: true, c4: true },
  flamer: { name: 'Flamethrower', dmg: 38, rof: 1, range: 2.5 * CELL, wh: 'FL', shot: 'flame', speed: 50, barrels: 1, air: false, ground: true, splash: 6, scatter: 1.5 },
  rocket: { name: 'Rocket launcher', dmg: 35, rof: 2.6, range: 5 * CELL, wh: 'AP', shot: 'rocket', speed: 120, barrels: 1, air: true, ground: true },
  buggy: { name: 'Machine gun', dmg: 15, rof: 0.5, range: 4 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true },
  apc: { name: 'Pintle machine gun', dmg: 12, rof: 0.6, range: 4 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true },
  light: { name: '75mm gun', dmg: 25, rof: 1.6, range: 4.75 * CELL, wh: 'AP', shot: 'shell', speed: 260, barrels: 1, air: false, ground: true },
  heavy: { name: 'Twin 105mm', dmg: 30, rof: 2.2, range: 4.75 * CELL, wh: 'AP', shot: 'shell', speed: 260, barrels: 2, air: true, ground: true, big: true },
  arty: { name: '155mm howitzer', dmg: 150, rof: 4.5, range: 6.5 * CELL, wh: 'HE', shot: 'arc', speed: 95, barrels: 1, air: false, ground: true, splash: 14, scatter: 8, big: true },
  // one huge rocket from far off, then a long wait to load the next; it
  // can't fire on anything close, so it needs guarding
  comet: { name: 'Comet rocket', dmg: 340, rof: 11, range: 10.5 * CELL, wh: 'HE', shot: 'missile', speed: 72, barrels: 1, air: false, ground: true, splash: 22, scatter: 4, big: true, min: 3 * CELL },
  heli: { name: 'Rocket pods', dmg: 40, rof: 1.6, range: 4 * CELL, wh: 'AP', shot: 'rocket', speed: 150, barrels: 2, air: true, ground: true },
  boat: { name: 'Deck gun', dmg: 25, rof: 1.4, range: 5 * CELL, wh: 'HE', shot: 'shell', speed: 240, barrels: 1, air: false, ground: true },
  scorch: { name: 'Twin flame projectors', dmg: 42, rof: 1.3, range: 3 * CELL, wh: 'FL', shot: 'flame', speed: 85, barrels: 2, air: false, ground: true, splash: 7, scatter: 2 },
  lumen: { name: 'Lumen lens', dmg: 100, rof: 3.6, range: 7 * CELL, wh: 'EN', shot: 'beam', speed: 4000, barrels: 1, air: false, ground: true, splash: 10 },
  prism: { name: 'Lumen crystal', dmg: 85, rof: 2.8, range: 7.5 * CELL, wh: 'EN', shot: 'beam', speed: 4000, barrels: 1, air: false, ground: true },
  aa: { name: 'Skyguard missiles', dmg: 45, rof: 1, range: 8 * CELL, wh: 'AP', shot: 'rocket', speed: 190, barrels: 2, air: true, ground: false },
  heron: { name: 'Door gun', dmg: 14, rof: 0.5, range: 4 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true },
  jet: { name: 'Swift missiles', dmg: 70, rof: 0.9, range: 5 * CELL, wh: 'AP', shot: 'rocket', speed: 200, barrels: 2, air: false, ground: true },
  destroyer: { name: 'Naval gun', dmg: 50, rof: 2, range: 6.5 * CELL, wh: 'HE', shot: 'shell', speed: 260, barrels: 1, air: false, ground: true, deep: true, big: true },
  skyguard: { name: 'Skyguard missiles', dmg: 35, rof: 1.1, range: 7 * CELL, wh: 'AP', shot: 'rocket', speed: 190, barrels: 2, air: true, ground: false },
  cruiser: { name: 'Skyguard missiles', dmg: 60, rof: 1.2, range: 10 * CELL, wh: 'AP', shot: 'rocket', speed: 230, barrels: 2, air: true, ground: false },
  carrier: { name: 'Drone strike', dmg: 45, rof: 4, range: 12 * CELL, wh: 'HE', shot: 'drone', speed: 90, barrels: 3, air: false, ground: true, splash: 6 },
  sub: { name: 'Torpedoes', dmg: 130, rof: 3, range: 6 * CELL, wh: 'AP', shot: 'torpedo', speed: 70, barrels: 1, air: false, ground: true, sea: true },
  tower: { name: 'Twin cannon', dmg: 25, rof: 1.5, range: 6 * CELL, wh: 'AP', shot: 'shell', speed: 260, barrels: 2, air: false, ground: true },
};

// A G.I. dug in behind sandbags: a steadier, longer and harder-hitting
// stream of fire, and it takes half the damage (see DUG_ARMOR).
export const DUG_WEAPON: Weapon = { name: 'Rifle, dug in', dmg: 22, rof: 0.7, range: 4.5 * CELL, wh: 'SA', shot: 'bullet', speed: 0, barrels: 1, air: false, ground: true };
export const DUG_ARMOR = 0.5;
// Seconds to dig in (or to climb out and pick up the bags).
export const DIG_S = 0.18;

export const UNIT_DEF: Record<UnitKind, { strength: number; armor: Armor }> = {
  inf: { strength: 50, armor: 'none' },
  gren: { strength: 55, armor: 'none' },
  eng: { strength: 40, armor: 'none' },
  rocket: { strength: 45, armor: 'none' },
  dog: { strength: 100, armor: 'none' },
  cmdo: { strength: 125, armor: 'none' },
  flamer: { strength: 60, armor: 'none' },
  scorch: { strength: 320, armor: 'heavy' },
  lumen: { strength: 180, armor: 'light' },
  skyguard: { strength: 260, armor: 'light' },
  heron: { strength: 175, armor: 'light' },
  plane: { strength: 400, armor: 'light' },
  jet: { strength: 150, armor: 'light' },
  buggy: { strength: 150, armor: 'light' },
  apc: { strength: 280, armor: 'heavy' },
  light: { strength: 300, armor: 'heavy' },
  heavy: { strength: 450, armor: 'heavy' },
  hauler: { strength: 600, armor: 'heavy' },
  arty: { strength: 75, armor: 'light' },
  comet: { strength: 110, armor: 'light' },
  mcv: { strength: 600, armor: 'light' },
  heli: { strength: 120, armor: 'heavy' },
  boat: { strength: 200, armor: 'heavy' },
  otter: { strength: 300, armor: 'heavy' },
  destroyer: { strength: 600, armor: 'heavy' },
  cruiser: { strength: 700, armor: 'heavy' },
  carrier: { strength: 900, armor: 'heavy' },
  sub: { strength: 450, armor: 'heavy' },
};

export const BUILDING_DEF: Record<BuildingKind, { strength: number; armor: Armor }> = {
  yard: { strength: 1000, armor: 'heavy' },
  factory: { strength: 1000, armor: 'heavy' },
  power: { strength: 400, armor: 'wood' },
  barracks: { strength: 500, armor: 'wood' },
  refinery: { strength: 900, armor: 'wood' },
  silo: { strength: 300, armor: 'wood' },
  radar: { strength: 1000, armor: 'wood' },
  helipad: { strength: 800, armor: 'wood' },
  lab: { strength: 600, armor: 'wood' },
  tower: { strength: 400, armor: 'heavy' },
  prism: { strength: 600, armor: 'heavy' },
  aa: { strength: 500, armor: 'heavy' },
  depot: { strength: 800, armor: 'heavy' },
  wall: { strength: 300, armor: 'concrete' },
  uplink: { strength: 1000, armor: 'wood' },
  navy: { strength: 1000, armor: 'heavy' },
};

// A building is shown damaged (scorched, holed, on fire) at or below this much health.
export const DAMAGED = 0.5;
// How long the pieces of something destroyed fly about before they're gone.
export const PIECE_S = 1.3;
export const HELI_ALT = 20;
// Jets fly higher than copters.
export const JET_ALT = 30;
// The cargo plane that drops paratroopers flies higher still, and they
// come down from a little under it.
export const PLANE_ALT = 48;
export const DROP_ALT = 42;

// The size of the explosion when each kind of vehicle is destroyed (map pixels).
export const BOOM: Partial<Record<UnitKind, number>> = { buggy: 6, apc: 9, light: 9.5, heavy: 12, scorch: 10, lumen: 9, skyguard: 9, heron: 9, jet: 7, plane: 11, hauler: 10.5, arty: 7, comet: 8, mcv: 13, heli: 8, boat: 9, otter: 9, destroyer: 13, cruiser: 13, carrier: 20, sub: 10 };
// Tracked armor: these cook off in a string of explosions when destroyed.
const TANKS = new Set<UnitKind>(['light', 'heavy', 'scorch', 'lumen', 'comet', 'skyguard', 'mcv', 'hauler']);

// How long a destroyed vehicle's wreck burns, and a destroyed building's ruin (seconds).
export const BURN_WRECK = 10;
export const BURN_RUIN = 20;

// How hard the screen shakes (in map pixels) when something big is
// destroyed nearby: tanks and the like, and every building, by its size.
export const QUAKE: Partial<Record<UnitKind, number>> = { apc: 1.3, light: 1.5, heavy: 2, scorch: 1.6, lumen: 1.4, comet: 1.4, skyguard: 1.4, mcv: 2, hauler: 1.6, boat: 1.2, destroyer: 2, cruiser: 2, carrier: 3, sub: 1.5 };
export const buildingQuake = (rx: number, ry: number) => Math.min(3.5, 1.8 + (rx + ry) * 0.04);
// How long a shake lasts, in seconds.
export const QUAKE_S = 0.5;

// How far (world units) a round shoves what it hits, away from where it came
// from: soldiers are knocked back by anything, tanks only by heavy rounds.
// k is how much of the round's force reaches it (less further from a burst).
export function knockback(w: Weapon, kind: UnitKind, k = 1): number {
  if (FOOT.has(kind)) return k * (w.shot === 'bullet' ? 1.6 : w.shot === 'arc' || w.shot === 'missile' ? 6 : w.shot === 'rocket' ? 3.5 : w.shot === 'grenade' ? 4.5 : 3);
  if ((kind === 'light' || kind === 'heavy' || kind === 'scorch' || kind === 'lumen' || kind === 'skyguard') && w.big) return k * (w.shot === 'arc' || w.shot === 'missile' ? 2.8 : 1.6);
  return 0;
}
// A knock in progress slides it this far each second, as a share of what is
// left (so the shove is quick and eases off).
export const KNOCK_EASE = 12;

// Where a weapon's rounds leave from, in world units: one point per barrel.
// a is the way the body faces, tur the turret's (tanks and towers). For a
// tank the turret turns about a point 1.2 behind the hull's middle. z is the
// ground (or flying) height under the unit.
export function muzzles(kind: UnitKind | DefenseKind, x: number, y: number, z: number, a: number, tur: number): [number, number, number][] {
  const at = (px: number, py: number, ang: number, u: number, v: number, h: number): [number, number, number] => [
    px + Math.cos(ang) * u - Math.sin(ang) * v,
    py + Math.sin(ang) * u + Math.cos(ang) * v,
    z + h,
  ];
  const px = x - Math.cos(a) * 1.2;
  const py = y - Math.sin(a) * 1.2;
  switch (kind) {
    case 'inf':
    case 'rocket':
    case 'gren':
    case 'eng':
    case 'flamer': {
      const [mu, mv, mz] = TROOPER_MUZZLE[kind === 'inf' ? 'gi' : kind === 'flamer' ? 'flame' : kind];
      return [at(x, y, a, mu, mv, mz)];
    }
    case 'cmdo': {
      // a pistol in each hand
      const [mu, mv, mz] = TROOPER_MUZZLE.cmdo;
      return [at(x, y, a, mu, mv, mz), at(x, y, a, mu, -mv, mz)];
    }
    case 'dog':
      return [at(x, y, a, 4.2, 0, 4.4)];
    case 'buggy':
      return [at(x, y, a, 1.4, 0, 6.7)];
    case 'apc':
      return [at(x, y, a, 5.6, -1.4, 9.4)];
    case 'light':
      return [at(px, py, tur, 11.2, 0, 6.3)];
    case 'heavy':
      return [at(px, py, tur, 13.2, 1.15, 7.7), at(px, py, tur, 13.2, -1.15, 7.7)];
    case 'arty':
      return [at(x, y, a, 13.4, 0, 12)];
    case 'comet':
      return [at(x, y, a, COMET_NOSE[0], 0, COMET_NOSE[1])];
    case 'heli':
      return [at(x, y, a, 3.8, 4.1, 2.7), at(x, y, a, 3.8, -4.1, 2.7)];
    case 'boat':
      return [at(x, y, a, 13.8, 0, 4.4)];
    case 'destroyer':
      return [at(x, y, a, 18, 0, 4.6)];
    case 'cruiser': {
      // one tube from each launcher (CRUISER_LAUNCHERS on CRUISER_RING_Z in
      // sprites.ts), as the battery's: 5.4 out and 4.6 up from its turntable
      const [f, b] = CRUISER_LAUNCHERS.map((l): [number, number] => [x + Math.cos(a) * l, y + Math.sin(a) * l]);
      return [at(f[0], f[1], tur, 5.4, 1.5, CRUISER_RING_Z + 4.6), at(b[0], b[1], tur, 5.4, -1.5, CRUISER_RING_Z + 4.6)];
    }
    case 'carrier':
      return [at(x, y, a, 25, -4, 8.4), at(x, y, a, 17, 4, 8.4), at(x, y, a, 8.5, -4, 8.4)];
    case 'sub':
      return [at(x, y, a, 15, 0, 0)];
    case 'heron':
      return [at(x, y, a, 5, 3.2, 3.8)];
    case 'jet':
      return [at(x, y, a, 2.4, 3.6, 2.4), at(x, y, a, 2.4, -3.6, 2.4)];
    case 'scorch':
      return [at(px, py, tur, 9.2, 1.3, 6.6), at(px, py, tur, 9.2, -1.3, 6.6)];
    case 'skyguard':
      // the battery's launcher, set 0.6 back and 5.6 up on the turret
      return [at(px, py, tur, 4.8, 1.5, 10.2), at(px, py, tur, 4.8, -1.5, 10.2)];
    case 'lumen':
      return [at(px, py, tur, 0, 0, 19.1)]; // the coil's ball (LUMEN_Z in sprites.ts)
    case 'tower':
      return [at(x, y, tur, 11.2, 1.15, 1.45), at(x, y, tur, 11.2, -1.15, 1.45)];
    case 'prism':
      return [[x, y, z]];
    case 'aa':
      return [at(x, y, tur, 5.4, 1.5, 4.6), at(x, y, tur, 5.4, -1.5, 4.6)];
    default:
      return [[x, y, z + 4]];
  }
}

// How long a Lumen beam glows.
const BEAM_S = 0.35;

// ---------- Shots in flight ----------

export interface Shot {
  kind: ShotKind;
  x0: number;
  y0: number;
  z0: number;
  x1: number; // where it is going (moved along each frame to follow a target)
  y1: number;
  z1: number;
  t: number;
  dur: number;
  peak: number; // how high an artillery shell arcs
  x: number; // where it is now
  y: number;
  z: number;
  track?: () => [number, number, number] | null;
  hit: (s: Shot) => void;
  puffT: number;
}

export function makeShot(kind: ShotKind, from: [number, number, number], to: [number, number, number], speed: number, hit: (s: Shot) => void, track?: Shot['track']): Shot {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const dur = kind === 'bullet' || kind === 'bite' ? 0.06 : d / speed;
  return {
    kind,
    x0: from[0],
    y0: from[1],
    z0: from[2],
    x1: to[0],
    y1: to[1],
    z1: to[2],
    t: 0,
    dur: Math.max(0.04, dur),
    peak: kind === 'missile' ? 36 + d * 0.22 : kind === 'drone' ? 14 + d * 0.08 : kind === 'arc' ? 10 + d * 0.32 : kind === 'grenade' ? 5 + d * 0.2 : kind === 'rocket' ? 2 : kind === 'flame' ? 1.2 : 0,
    x: from[0],
    y: from[1],
    z: from[2],
    track,
    hit,
    puffT: 0,
  };
}

// ---------- Effects, in screen pixels ----------

type PKind = 'smoke' | 'soot' | 'spark' | 'ember' | 'dust' | 'debris';
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: PKind;
  size: number;
  g: number; // gravity
  v: number; // which puff texture
}
interface Boom {
  x: number;
  y: number;
  r: number; // size in map pixels
  t: number; // < 0 while waiting to go off
  seed: number;
}
// A chunk of a sprite thrown off when it is destroyed: the patch of the
// picture at (px, py), pw by ph art pixels, flying about and landing on its
// own bit of ground (floor).
interface Piece {
  img: HTMLCanvasElement;
  px: number;
  py: number;
  pw: number;
  ph: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  life: number;
  max: number;
}
const alphaOf = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();
// A sprite's picture burnt black: its shape in near-black, for the pieces
// thrown off when it is destroyed.
const charOf = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function charred(img: HTMLCanvasElement): HTMLCanvasElement {
  let cv = charOf.get(img);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    // solid: every pixel that is solid in the picture is pure black, the rest
    // (soft shadow and edges) is left out
    const src = img.getContext('2d')!.getImageData(0, 0, img.width, img.height);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = d[i + 3] > 200 ? 255 : 0;
    }
    cv.getContext('2d')!.putImageData(src, 0, 0);
    charOf.set(img, cv);
  }
  return cv;
}

// How far round its middle a round may land on each kind of unit (world
// units): rounds hit all over it, not just dead center.
export const HIT_SPREAD: Record<UnitKind, number> = { mcv: 8, light: 5, heavy: 6, buggy: 3.5, apc: 5.5, hauler: 6, arty: 5, comet: 5.5, boat: 6, heli: 4.5, inf: 1, rocket: 1, gren: 1, eng: 1, dog: 1.5, cmdo: 1, flamer: 1, scorch: 5, lumen: 5, skyguard: 5, heron: 6, jet: 5, plane: 9, otter: 6, destroyer: 10, cruiser: 10, carrier: 19, sub: 8 };

interface Flash {
  x: number;
  y: number;
  t: number;
  r: number;
}

const FIRE: RGB[] = [
  [255, 250, 226],
  [255, 230, 120],
  [255, 176, 58],
  [236, 106, 36],
  [176, 52, 26],
  [96, 30, 20],
];
const rgb = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// A pixel-art fireball r map pixels across at time k (0 at the bang, 1 when
// it has gone to smoke), drawn in half pixels. It flares white-hot, swells
// into lumpy orange and red, then darkens and lifts away as smoke.
export function drawBoom(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, seed: number): void {
  if (k < 0 || k >= 1) return;
  const grow = 1 - (1 - Math.min(1, k * 2.6)) ** 3;
  const R = r * (0.35 + 0.65 * grow);
  const lift = k * r * 0.55;
  const frame = Math.floor(k * 14); // flickers at a steady pixel-art rate
  const cy = y - lift;
  const step = 0.5;
  for (let dy = -R; dy <= R * 0.8; dy += step)
    for (let dx = -R * 1.15; dx <= R * 1.15; dx += step) {
      const nx = dx / 1.15;
      const ny = dy < 0 ? dy : dy * 1.25;
      const n = vnoise((dx + 40) / 2.2, (dy + 40) / 2.2 + frame * 0.7, seed) - 0.5;
      const d = Math.hypot(nx, ny) / R + n * 0.55;
      if (d > 1) continue;
      const heat = (1 - d) * 1.6 - k * 1.9 + (dy < 0 ? 0.1 : 0);
      let col: string;
      if (heat > 1.05) col = rgb(FIRE[0]);
      else if (heat > 0.8) col = rgb(FIRE[1]);
      else if (heat > 0.55) col = rgb(FIRE[2]);
      else if (heat > 0.3) col = rgb(FIRE[3]);
      else if (heat > 0.08) col = rgb(FIRE[4]);
      else if (heat > -0.15) col = rgb(FIRE[5], 0.95);
      else {
        const a = 0.75 * (1 - k) * Math.min(1, 1 - d + 0.3);
        if (a < 0.08) continue;
        col = `rgba(${52 + (n > 0 ? 10 : 0)},${46 + (n > 0 ? 8 : 0)},${42},${a})`;
      }
      c.fillStyle = col;
      c.fillRect(Math.round((x + dx) * 2) / 2, Math.round((cy + dy) * 2) / 2, step, step);
    }
}

// A little flickering flame, h map pixels tall, its foot at (x, y).
export function drawFlame(c: CanvasRenderingContext2D, x: number, y: number, h: number, t: number, seed: number): void {
  const fr = Math.floor(t * 12);
  const w = Math.max(2, h * 0.7);
  for (let i = 0; i < w * 2; i++) {
    const dx = i / 2 - w / 2;
    const edge = 1 - Math.abs(dx) / (w / 2 + 0.25);
    const top = h * edge * (0.55 + 0.6 * hash2(i, fr, seed));
    for (let j = 0; j < top * 2; j++) {
      const k = j / 2 / Math.max(0.5, top);
      const col = k > 0.75 ? FIRE[4] : k > 0.5 ? FIRE[3] : k > 0.25 || Math.abs(dx) > w * 0.25 ? FIRE[2] : FIRE[1];
      c.fillStyle = rgb(col, k > 0.85 ? 0.7 : 1);
      c.fillRect(Math.round((x + dx) * 2) / 2, Math.round((y - j / 2) * 2) / 2 - 0.5, 0.5, 0.5);
    }
  }
}

// ---------- Soft puffs of smoke ----------
// Smoke is drawn as soft, lumpy blobs rather than squares: a few textures of
// a cloudy puff (soft edge, mottled middle), one set per color, drawn
// smoothly at whatever size the puff has grown to. Overlapping puffs blend
// into a cloud.
const PUFF_N = 4;
const PUFF_PX = 32;
const puffTex = new Map<string, HTMLCanvasElement[]>();
function puffs(col: RGB): HTMLCanvasElement[] {
  const key = col.join(',');
  let out = puffTex.get(key);
  if (!out) {
    out = [];
    for (let v = 0; v < PUFF_N; v++) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = PUFF_PX;
      const g = cv.getContext('2d')!;
      const img = g.createImageData(PUFF_PX, PUFF_PX);
      const d = img.data;
      const h = PUFF_PX / 2;
      for (let y = 0; y < PUFF_PX; y++)
        for (let x = 0; x < PUFF_PX; x++) {
          const dx = (x + 0.5 - h) / h;
          const dy = (y + 0.5 - h) / h;
          // a lumpy edge and a mottled body, lighter towards the top
          const n = vnoise(x / 5 + v * 17, y / 5, 91 + v) * 0.6 + vnoise(x / 2.5, y / 2.5 + v * 9, 37 + v) * 0.4;
          const r = Math.hypot(dx, dy) + (n - 0.5) * 0.45;
          const a = Math.max(0, Math.min(1, (1 - r) * 1.8)) * (0.7 + 0.3 * n);
          const lit = 1 + (0.5 - (dy + 1) / 2) * 0.18 + (n - 0.5) * 0.14;
          const i = (y * PUFF_PX + x) * 4;
          d[i] = Math.min(255, col[0] * lit);
          d[i + 1] = Math.min(255, col[1] * lit);
          d[i + 2] = Math.min(255, col[2] * lit);
          d[i + 3] = a * 255;
        }
      g.putImageData(img, 0, 0);
      out.push(cv);
    }
    puffTex.set(key, out);
  }
  return out;
}

// Colors of smoke: pale, sooty (which grays as it rises and thins) and dust.
const SMOKE: RGB = [218, 216, 208];
const SOOT: RGB = [44, 40, 37];
const SOOT_OLD: RGB = [112, 108, 102];
const DUST: RGB = [168, 148, 108];

// A puff of smoke `d` map pixels across at (x, y), at strength a. kind picks
// the color; age (0..1) grays soot as it rises; v picks one of the puff
// textures (any whole number).
export function drawPuff(c: CanvasRenderingContext2D, kind: 'smoke' | 'soot' | 'dust', x: number, y: number, d: number, a: number, age: number, v: number): void {
  if (a <= 0.01 || d <= 0) return;
  const i = ((v % PUFF_N) + PUFF_N) % PUFF_N;
  const smooth = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  const was = c.globalAlpha;
  if (kind === 'soot') {
    // dark smoke graying with age: the dark puff fading into the gray one
    c.globalAlpha = was * a * (1 - age * 0.7);
    c.drawImage(puffs(SOOT)[i], x - d / 2, y - d / 2, d, d);
    c.globalAlpha = was * a * age * 0.6;
    c.drawImage(puffs(SOOT_OLD)[i], x - d / 2, y - d / 2, d, d);
  } else {
    c.globalAlpha = was * a;
    c.drawImage(puffs(kind === 'smoke' ? SMOKE : DUST)[i], x - d / 2, y - d / 2, d, d);
  }
  c.globalAlpha = was;
  c.imageSmoothingEnabled = smooth;
}

// How strong a puff is through its life k (0..1): it swells in quickly, then
// thins away.
export const puffAlpha = (k: number) => Math.min(1, k * 7) * (1 - k) ** 1.3;

// Everything that flies about in a fight: shots, explosions, muzzle flashes,
// sparks, embers, debris and smoke. Screen coordinates, except the shots,
// which are in world coordinates and drawn through toScreen.
export class Fx {
  shots: Shot[] = [];
  private ps: P[] = [];
  private booms: Boom[] = [];
  private flashes: Flash[] = [];
  private tracers: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  // Lumen beams: a bright bolt between two screen points, fading out
  private beams: { x0: number; y0: number; x1: number; y1: number; t: number; w: number }[] = [];
  private pieces: Piece[] = [];
  // columns of smoke rising from wrecks: `rate` puffs a second, thinning out
  // over `dur` seconds
  private plumes: { x: number; y: number; t: number; dur: number; rate: number; size: number; w: number }[] = [];

  clear(): void {
    this.pieces = [];
    this.plumes = [];
    this.shots = [];
    this.ps = [];
    this.booms = [];
    this.flashes = [];
    this.tracers = [];
    this.beams = [];
  }

  // A bolt of light from one screen point to another (w: how thick; a
  // tower boosted by others fires a fatter one), a flare where it lands.
  beam(x0: number, y0: number, x1: number, y1: number, w = 1): void {
    this.beams.push({ x0, y0, x1, y1, t: 0, w });
    this.flashes.push({ x: x1, y: y1, t: 0, r: 1.5 + w });
    this.flashes.push({ x: x0, y: y0, t: 0, r: 1 + w * 0.5 });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 10 + Math.random() * 20;
      this.p(x1, y1, 'spark', { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, max: 0.3 + Math.random() * 0.2, g: 40 });
    }
  }

  private p(x: number, y: number, kind: PKind, o: Partial<P>): void {
    this.ps.push({ x, y, vx: 0, vy: 0, life: 0, max: 1, kind, size: 1, g: 0, v: (Math.random() * 64) | 0, ...o });
  }

  fire(s: Shot): void {
    this.shots.push(s);
  }

  // The flash at a gun's muzzle (screen point), for a moment.
  muzzle(x: number, y: number, big = false): void {
    this.flashes.push({ x, y, t: 0, r: big ? 2.5 : 1.5 });
    if (big) for (let i = 0; i < 3; i++) this.p(x, y, 'smoke', { vx: (Math.random() - 0.5) * 8, vy: -3 - Math.random() * 4, max: 0.9 + Math.random() * 0.5, size: 1.5 });
  }

  // Rounds hitting something hard: a spray of sparks.
  sparks(x: number, y: number, n = 5): void {
    this.flashes.push({ x, y, t: 0, r: 1 });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const v = 14 + Math.random() * 26;
      this.p(x, y, 'spark', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.25 + Math.random() * 0.25, g: 90 });
    }
  }

  // Rounds hitting soft ground or a soldier: a little kick of dust.
  dust(x: number, y: number, n = 3): void {
    for (let i = 0; i < n; i++) this.p(x + (Math.random() - 0.5) * 2, y, 'dust', { vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 8, max: 0.5 + Math.random() * 0.4, g: 20 });
  }

  // An explosion r map pixels across, after `delay` seconds: the fireball,
  // then debris and embers thrown out, and smoke rolling up after it.
  boom(x: number, y: number, r: number, delay = 0): void {
    this.booms.push({ x, y, r, t: -delay, seed: Math.floor(Math.random() * 1e6) });
  }

  // Blow a sprite drawn with its ground origin at screen point (sx, sy) to
  // pieces: it is cut into chunks of `chunk` art pixels which fly out from
  // (ox, oy), fall back to the ground round gy and fade (PIECE_S seconds).
  // Chunks that are mostly shadow are left out; at most `cap` are thrown.
  shatter(spr: StackSprite, sx: number, sy: number, ox: number, oy: number, gy: number, chunk: number, force: number, cap = 160): void {
    const img = spr.img;
    let a = alphaOf.get(img);
    if (!a) {
      a = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
      alphaOf.set(img, a);
    }
    const W = img.width;
    const H = img.height;
    const out: Piece[] = [];
    for (let py = 0; py < H; py += chunk)
      for (let px = 0; px < W; px += chunk) {
        let solid = 0;
        let n = 0;
        for (let y = py; y < Math.min(H, py + chunk); y++)
          for (let x = px; x < Math.min(W, px + chunk); x++) {
            n++;
            if (a[(y * W + x) * 4 + 3] > 200) solid++;
          }
        if (solid * 2 < n) continue;
        const x = sx - spr.cx + px / ART;
        const y = sy - spr.cy + py / ART;
        const dx = x + chunk / ART / 2 - ox;
        const dy = y + chunk / ART / 2 - oy;
        const d = Math.hypot(dx, dy) || 1;
        const v = force * (0.5 + Math.random() * 0.8);
        out.push({
          img: charred(img),
          px,
          py,
          pw: Math.min(chunk, W - px),
          ph: Math.min(chunk, H - py),
          x,
          y,
          vx: (dx / d) * v + (Math.random() - 0.5) * force * 0.4,
          vy: (dy / d) * v * 0.6 - force * (0.5 + Math.random() * 0.7),
          floor: gy + (Math.random() - 0.3) * (6 + force * 0.12),
          life: 0,
          max: PIECE_S * (0.6 + Math.random() * 0.5),
        });
      }
    // too many: keep an even spread of them
    while (out.length > cap) out.splice(Math.floor(Math.random() * out.length), 1);
    this.pieces.push(...out);
  }

  // A column of dark smoke rising from (x, y) for dur seconds, w pixels wide.
  plume(x: number, y: number, dur: number, rate: number, size: number, w = 3): void {
    this.plumes.push({ x, y, t: 0, dur, rate, size, w });
  }

  // A thick cloud of smoke rolling up over an area w by h pixels round (x, y).
  billow(x: number, y: number, w: number, h: number, n: number, size: number): void {
    for (let i = 0; i < n; i++)
      this.p(x + (Math.random() - 0.5) * w, y + (Math.random() - 0.5) * h, i % 4 ? 'soot' : 'smoke', {
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 7,
        max: 2.4 + Math.random() * 1.8,
        size: size * (0.7 + Math.random() * 0.6),
      });
  }

  // Smoke off a damaged vehicle, each frame, from screen point (x, y) at its
  // top: wisps from two thirds health, thickening to a dark column near the end.
  damageSmoke(hp: number, x: number, y: number, dt: number): void {
    if (hp >= 0.66) return;
    const k = Math.min(1, (0.66 - hp) / 0.5); // 0 just hurt .. 1 nearly gone
    if (Math.random() < dt * (4 + 18 * k)) this.smoke(x, y, k > 0.3 || Math.random() < 0.5, 1.2 + k * 1.8);
  }

  // A unit is destroyed: it blows up, breaks into a few big chunks and leaves
  // a column of smoke (tanks cook off in a string of explosions, the turret
  // thrown high). parts are the sprites it is drawn with and the screen
  // points they are drawn at, (ox, oy) is its middle and gy the ground under it.
  wreck(kind: UnitKind, parts: [StackSprite, number, number][], ox: number, oy: number, gy: number): void {
    const foot = FOOT.has(kind);
    const tank = TANKS.has(kind);
    const r = BOOM[kind] ?? 3;
    parts.forEach(([spr, px, py], i) => {
      if (foot) this.shatter(spr, px, py, ox, oy, gy, 2, 13, 7);
      else this.shatter(spr, px, py, ox, oy, gy, 3, 20 + r * 1.3 + (tank && i ? 16 : 0), i ? 7 : 16);
    });
    if (foot) {
      this.boom(ox, oy, 3);
      this.billow(ox, oy, 4, 2, 9, 1.8);
      return;
    }
    this.boom(ox, oy, r);
    this.boom(ox + (Math.random() - 0.5) * r, oy - r * 0.3, r * 0.6, 0.15);
    if (tank) {
      // it cooks off: more bangs round it, and a fountain of embers
      for (const [d, k] of [
        [0.3, 0.55],
        [0.5, 0.7],
        [0.8, 0.5],
      ])
        this.boom(ox + (Math.random() - 0.5) * r * 1.2, oy - Math.random() * r * 0.5, r * k, d);
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const v = 30 + Math.random() * 40;
        this.p(ox, oy, i % 2 ? 'ember' : 'spark', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.6 + Math.random() * 0.7, g: 70 });
      }
    }
    this.billow(ox, oy - r * 0.2, r * 1.6, r * 0.7, Math.round(r * 3), 2.4 + r * 0.22);
    this.plume(ox, gy - 2, BURN_WRECK, tank ? 16 : 11, 1.8 + r * 0.14, r * 0.6);
  }

  // A building's big bang: it breaks into a few big chunks over its ruin and
  // smoke rolls up over the whole of it. (sx, sy) is where its sprite is drawn,
  // (ox, oy) where the pieces fly out from, w by h its size on screen.
  // It breaks into small chunks; `big` scales the blast (a power plant's is
  // far bigger than anything else's).
  collapse(spr: StackSprite, sx: number, sy: number, ox: number, oy: number, w: number, h: number, big = 1): void {
    this.shatter(spr, sx, sy, ox, oy, sy, 3, 48 * Math.sqrt(big), Math.round(110 * big));
    // a cloud of smoke rolling up over all of it, and a second, darker one higher up
    this.billow(ox, (oy + sy) / 2, w * 1.2, h * 1.2, Math.round((40 + w * 1.5) * big), 4.5 + big);
    this.billow(ox, oy - h * 0.6, w * 0.9, h, Math.round((20 + w) * big), 6 + big * 1.5);
    // a hot fountain of embers and sparks
    for (let i = 0; i < 30 * big; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      const v = (35 + Math.random() * 55) * Math.sqrt(big);
      this.p(ox + (Math.random() - 0.5) * w * 0.5, oy, i % 2 ? 'ember' : 'spark', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.7 + Math.random() * 0.9, g: 70 });
    }
    // smoke keeps pouring off the burning ruin while it burns (BURN_RUIN seconds)
    this.plume(ox, sy - 2, BURN_RUIN, 26 * big, 3.6 + big * 0.6, w * 0.5);
  }

  // Fire splashing over what a flamethrower hits: a lick of flame, embers and soot.
  scorch(x: number, y: number, r = 3): void {
    this.boom(x, y, r);
    for (let i = 0; i < 6; i++) this.p(x + (Math.random() - 0.5) * r * 2, y, i % 3 ? 'ember' : 'soot', { vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 10, max: 0.6 + Math.random() * 0.5, g: i % 3 ? -6 : 0, size: 1.2 });
  }

  smoke(x: number, y: number, dark = true, size = 1.5): void {
    this.p(x + (Math.random() - 0.5) * 3, y, dark ? 'soot' : 'smoke', { vx: 2 + Math.random() * 3, vy: -6 - Math.random() * 4, max: 2.2 + Math.random() * 1.2, size });
  }

  ember(x: number, y: number): void {
    this.p(x + (Math.random() - 0.5) * 3, y, 'ember', { vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 8, max: 0.6 + Math.random() * 0.6, g: -4 });
  }

  // Shots move on; each one that arrives calls its hit().
  step(dt: number): void {
    for (const s of this.shots) {
      if (s.track) {
        const p = s.track();
        if (p) [s.x1, s.y1, s.z1] = p;
      }
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.x = s.x0 + (s.x1 - s.x0) * k;
      s.y = s.y0 + (s.y1 - s.y0) * k;
      s.z = s.z0 + (s.z1 - s.z0) * k + s.peak * 4 * k * (1 - k);
      if (s.kind === 'rocket' && (s.puffT -= dt) <= 0) {
        s.puffT = 0.03;
        const [sx, sy] = toScreen(s.x, s.y, s.z);
        this.p(sx, sy, 'smoke', { vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 2, max: 0.5 + Math.random() * 0.3, size: 1 });
      }
      if (s.kind === 'missile' && (s.puffT -= dt) <= 0) {
        // a thick white trail, hanging in the air a while
        s.puffT = 0.02;
        const [sx, sy] = toScreen(s.x, s.y, s.z);
        this.p(sx + (Math.random() - 0.5), sy + (Math.random() - 0.5), 'smoke', { vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 1.5, max: 1.4 + Math.random() * 0.8, size: 1.6 });
      }
      if (s.kind === 'flame' && Math.random() < dt * 70) {
        // burning fuel drips and sparks off the jet
        const [sx, sy] = toScreen(s.x, s.y, s.z);
        this.p(sx + (Math.random() - 0.5) * 4, sy - 1, Math.random() < 0.35 ? 'soot' : 'ember', { vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 8, max: 0.45 + Math.random() * 0.4, g: -4, size: 1.4 });
      }
      if (s.kind === 'bullet' && s.t <= dt) {
        const [ax, ay] = toScreen(s.x0, s.y0, s.z0);
        const [bx, by] = toScreen(s.x1, s.y1, s.z1);
        this.tracers.push({ x0: ax, y0: ay, x1: bx, y1: by, t: 0 });
      }
    }
    const done = this.shots.filter((s) => s.t >= s.dur);
    this.shots = this.shots.filter((s) => s.t < s.dur);
    for (const s of done) s.hit(s);

    for (const b of this.booms) {
      const was = b.t;
      b.t += dt;
      if (was < 0 && b.t >= 0) {
        // the bang: debris and embers fly out, smoke follows
        const n = Math.round(b.r * 1.2);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
          const v = (16 + Math.random() * 34) * Math.sqrt(b.r / 6);
          this.p(b.x, b.y - b.r * 0.2, i % 5 ? 'spark' : 'debris', { vx: Math.cos(a) * v, vy: Math.sin(a) * v, max: 0.4 + Math.random() * 0.6, g: 110 });
        }
        for (let i = 0; i < Math.round(b.r * 0.6); i++)
          this.p(b.x + (Math.random() - 0.5) * b.r, b.y - Math.random() * b.r * 0.5, 'soot', { vx: (Math.random() - 0.5) * 6, vy: -5 - Math.random() * 6, max: 1.8 + Math.random() * 1.4, size: 1.5 + b.r * 0.15 });
      }
    }
    this.booms = this.booms.filter((b) => b.t < this.boomLen(b));
    for (const m of this.plumes) {
      m.t += dt;
      const k = 1 - m.t / m.dur;
      if (Math.random() < m.rate * dt * k)
        this.p(m.x + (Math.random() - 0.5) * m.w, m.y, Math.random() < 0.8 ? 'soot' : 'smoke', {
          vx: 2 + Math.random() * 4,
          vy: -7 - Math.random() * 5,
          max: 2 + Math.random() * 1.4,
          size: m.size * (0.6 + 0.4 * k),
        });
    }
    this.plumes = this.plumes.filter((m) => m.t < m.dur);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.07);
    for (const t of this.tracers) t.t += dt;
    this.tracers = this.tracers.filter((t) => t.t < 0.06);
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < BEAM_S);
    for (const p of this.ps) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'soot') {
        p.size += dt * 2.4;
        // it slows as it rises and spreads
        p.vy *= 1 - dt * 0.35;
      }
      if (p.kind === 'debris' || p.kind === 'spark') {
        p.vx *= 1 - dt * 1.5;
      }
    }
    this.ps = this.ps.filter((p) => p.life < p.max);
    for (const p of this.pieces) {
      p.life += dt;
      if (p.y < p.floor || p.vy < 0) {
        p.vy += 140 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y >= p.floor && p.vy > 0) {
          // land with a little bounce, then lie there
          p.y = p.floor;
          p.vy = Math.abs(p.vy) > 25 ? -p.vy * 0.3 : 0;
          p.vx *= 0.5;
        }
      }
    }
    this.pieces = this.pieces.filter((p) => p.life < p.max);
  }

  private boomLen(b: Boom): number {
    return 0.55 + b.r * 0.035;
  }

  // Smoke and dust, under the fire.
  drawBelow(c: CanvasRenderingContext2D): void {
    for (const p of this.ps) {
      if (p.kind !== 'smoke' && p.kind !== 'soot' && p.kind !== 'dust') continue;
      const k = p.life / p.max;
      drawPuff(c, p.kind, p.x, p.y, p.size * 1.8, (p.kind === 'smoke' ? 0.6 : p.kind === 'soot' ? 0.8 : 0.6) * puffAlpha(k), k, p.v);
    }
  }

  // Shots, flying pieces, fireballs, flashes and sparks, over everything.
  drawAbove(c: CanvasRenderingContext2D): void {
    for (const p of this.pieces) {
      // solid black, shrinking away at the end instead of fading
      const k = p.life / p.max;
      const sc = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      const w = Math.max(1, Math.round(p.pw * sc));
      const h = Math.max(1, Math.round(p.ph * sc));
      const X = Math.round(p.x * ART + (p.pw - w) / 2) / ART;
      const Y = Math.round(p.y * ART + (p.ph - h)) / ART;
      if (sc > 0) c.drawImage(p.img, p.px, p.py, p.pw, p.ph, X, Y, w / ART, h / ART);
    }
    for (const b of this.beams) {
      // a white core in a pale blue glow, flickering, thinning as it fades
      const k = b.t / BEAM_S;
      const n = Math.ceil(Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * 2);
      const glow = Math.max(0.5, Math.round(b.w * (1 - k) * 2 + 1) / 2);
      for (let i = 0; i <= n; i++) {
        const q = i / n;
        const x = Math.round((b.x0 + (b.x1 - b.x0) * q) * 2) / 2;
        const y = Math.round((b.y0 + (b.y1 - b.y0) * q) * 2) / 2;
        c.fillStyle = `rgba(150,215,255,${0.55 * (1 - k)})`;
        c.fillRect(x - glow / 2, y - glow / 2, glow, glow);
        if (k < 0.6 && (i + Math.floor(b.t * 60)) % 7) {
          c.fillStyle = '#f4fcff';
          c.fillRect(x, y, 0.5, 0.5);
        }
      }
    }
    for (const t of this.tracers) {
      c.fillStyle = 'rgba(255,236,150,0.9)';
      const n = Math.ceil(Math.hypot(t.x1 - t.x0, t.y1 - t.y0) * 2);
      // a short bright streak traveling down the line
      const k0 = t.t / 0.06;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        if (k < k0 - 0.1 || k > k0 + 0.55) continue;
        c.fillRect(Math.round((t.x0 + (t.x1 - t.x0) * k) * 2) / 2, Math.round((t.y0 + (t.y1 - t.y0) * k) * 2) / 2, 0.5, 0.5);
      }
    }
    for (const s of this.shots) {
      const [x, y] = toScreen(s.x, s.y, s.z);
      const X = Math.round(x * 2) / 2;
      const Y = Math.round(y * 2) / 2;
      if (s.kind === 'shell') {
        // a hot round with a short streak behind it
        const [px, py] = toScreen(s.x - (s.x1 - s.x0) * 0.04, s.y - (s.y1 - s.y0) * 0.04, s.z - (s.z1 - s.z0) * 0.04);
        c.fillStyle = 'rgba(255,200,90,0.6)';
        c.fillRect(Math.round(px * 2) / 2, Math.round(py * 2) / 2, 0.5, 0.5);
        c.fillStyle = '#fff4c2';
        c.fillRect(X, Y, 1, 0.5);
      } else if (s.kind === 'rocket') {
        c.fillStyle = '#d8d4c8';
        c.fillRect(X, Y, 1, 1);
        c.fillStyle = Math.floor(s.t * 30) % 2 ? '#ffd65a' : '#ff8a3a';
        const [px, py] = toScreen(s.x - (s.x1 - s.x0) * 0.03, s.y - (s.y1 - s.y0) * 0.03, s.z);
        c.fillRect(Math.round(px * 2) / 2, Math.round(py * 2) / 2, 0.5, 0.5);
      } else if (s.kind === 'grenade') {
        // a grenade tumbling through the air, its shadow on the ground
        const [gx, gy] = toScreen(s.x, s.y, s.z0 + (s.z1 - s.z0) * (s.t / s.dur));
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(Math.round(gx * 2) / 2, Math.round(gy * 2) / 2, 0.5, 0.5);
        c.fillStyle = '#8a8880';
        c.fillRect(X, Y, 1, 1);
        c.fillStyle = Math.floor(s.t * 16) % 2 ? '#ffffff' : '#e6e2d4';
        c.fillRect(X, Y, 0.5, 0.5);
      } else if (s.kind === 'flame') {
        // a roaring jet of fire: white-hot at the nozzle, swelling into a
        // ragged orange plume that curls upwards and darkens to red and soot
        // at its far end
        const k = s.t / s.dur;
        const N = 16;
        const fl = Math.floor(s.t * 30);
        for (const layer of [0, 1, 2]) {
          for (let i = N; i >= 0; i--) {
            const b = (k * i) / N;
            const [fx, fy0] = toScreen(s.x0 + (s.x1 - s.x0) * b, s.y0 + (s.y1 - s.y0) * b, s.z0 + (s.z1 - s.z0) * b + s.peak * 4 * b * (1 - b));
            const wob = hash2(i, fl, 7) - 0.5;
            const fy = fy0 - b * b * 3 + wob * b * 1.5;
            const r = (1.2 + b * 5.6) * (layer === 0 ? 1 : layer === 1 ? 0.68 : 0.36) * (0.85 + 0.3 * hash2(i, fl, 11 + layer));
            if (layer === 2 && b > 0.75) continue;
            c.fillStyle =
              layer === 0 ? (b > 0.7 ? (hash2(i, fl, 3) > 0.5 ? '#9a2f18' : '#b8401e') : '#e0602c') : layer === 1 ? (b > 0.8 ? '#e0602c' : '#ffb347') : b < 0.25 ? '#fffbe6' : '#ffe27a';
            const w = Math.max(0.5, Math.round(r * 2) / 2);
            const h = Math.max(0.5, Math.round(r * 1.6) / 2);
            c.fillRect(Math.round((fx - w / 2) * 2) / 2, Math.round((fy - h / 2) * 2) / 2, w, h);
          }
        }
      } else if (s.kind === 'torpedo') {
        // a dark fish under the surface, a line of white water behind it
        for (let i = 1; i < 6; i++) {
          const b = Math.max(0, s.t / s.dur - i * 0.03);
          const [wx, wy] = toScreen(s.x0 + (s.x1 - s.x0) * b, s.y0 + (s.y1 - s.y0) * b, 0);
          c.fillStyle = `rgba(235,245,250,${0.7 - i * 0.11})`;
          c.fillRect(Math.round(wx * 2) / 2, Math.round(wy * 2) / 2, 0.5, 0.5);
        }
        c.fillStyle = '#1f2a2e';
        c.fillRect(X, Y, 1, 0.5);
      } else if (s.kind === 'drone') {
        // a little flying wing, and its shadow on the ground
        const [gx, gy] = toScreen(s.x, s.y, s.z0 + (s.z1 - s.z0) * (s.t / s.dur));
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(Math.round(gx * 2) / 2 - 0.5, Math.round(gy * 2) / 2, 1.5, 0.5);
        c.fillStyle = '#5c6266';
        c.fillRect(X - 1, Y, 2.5, 0.5);
        c.fillStyle = '#2e3133';
        c.fillRect(X, Y - 0.5, 0.5, 1);
        if (Math.floor(s.t * 8) % 2) {
          c.fillStyle = '#ff5a3c';
          c.fillRect(X - 1, Y, 0.5, 0.5);
        }
      } else if (s.kind === 'missile') {
        // the rocket itself, pointing the way it is going, its flame behind
        // it and its shadow far below
        const k = s.t / s.dur;
        const [gx, gy] = toScreen(s.x, s.y, s.z0 + (s.z1 - s.z0) * k);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(Math.round(gx * 2) / 2 - 0.5, Math.round(gy * 2) / 2, 1.5, 0.5);
        const kb = Math.max(0, k - 0.02);
        const [bx, by] = toScreen(s.x0 + (s.x1 - s.x0) * kb, s.y0 + (s.y1 - s.y0) * kb, s.z0 + (s.z1 - s.z0) * kb + s.peak * 4 * kb * (1 - kb));
        const dx = x - bx;
        const dy = y - by;
        const n = Math.hypot(dx, dy) || 1;
        const ux = dx / n;
        const uy = dy / n;
        for (let i = 0; i <= 6; i++) {
          const b = i / 2 - 1.5; // from the tail (-1.5) to the nose (1.5)
          c.fillStyle = i === 6 ? '#3a3a36' : i < 2 ? '#8a8880' : '#e6e2d4';
          c.fillRect(Math.round((x + ux * b) * 2) / 2, Math.round((y + uy * b) * 2) / 2, i === 6 ? 0.5 : 1, i === 6 ? 0.5 : 1);
        }
        c.fillStyle = Math.floor(s.t * 30) % 2 ? '#fff4c2' : '#ffb347';
        c.fillRect(Math.round((x - ux * 2.5) * 2) / 2, Math.round((y - uy * 2.5) * 2) / 2, 1, 1);
        c.fillStyle = '#ff8a3a';
        c.fillRect(Math.round((x - ux * 3.5) * 2) / 2, Math.round((y - uy * 3.5) * 2) / 2, 0.5, 0.5);
      } else if (s.kind === 'arc') {
        // the shell high up, and its shadow sliding along the ground
        const [gx, gy] = toScreen(s.x, s.y, s.z0 + (s.z1 - s.z0) * (s.t / s.dur));
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(Math.round(gx), Math.round(gy), 1, 0.5);
        c.fillStyle = '#2a2a26';
        c.fillRect(X - 0.5, Y, 1.5, 1);
        c.fillStyle = '#ffb347';
        c.fillRect(X, Y + 0.5, 0.5, 0.5);
      }
    }
    for (const b of this.booms) drawBoom(c, b.x, b.y, b.r, b.t / this.boomLen(b), b.seed);
    for (const f of this.flashes) {
      const r = f.r * (f.t < 0.035 ? 1 : 0.6);
      c.fillStyle = 'rgba(255,214,110,0.55)';
      c.fillRect(Math.round((f.x - r) * 2) / 2, Math.round((f.y - r * 0.8) * 2) / 2, r * 2, r * 1.6);
      c.fillStyle = '#fffbe6';
      c.fillRect(Math.round((f.x - r / 2) * 2) / 2, Math.round((f.y - r / 2) * 2) / 2, Math.max(0.5, r), Math.max(0.5, r * 0.8));
    }
    for (const p of this.ps) {
      if (p.kind === 'spark') {
        c.fillStyle = p.life < 0.12 ? '#fff6c8' : '#ffb347';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5);
      } else if (p.kind === 'ember') {
        const k = p.life / p.max;
        c.fillStyle = k < 0.5 ? '#ffcf5a' : '#e0602c';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5);
      } else if (p.kind === 'debris') {
        c.fillStyle = '#2a2622';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 1, 1);
        c.fillStyle = '#6a5a48';
        c.fillRect(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, 0.5, 0.5);
      }
    }
  }
}
