// Armor and the personal grid: armor blocks part of the damage you take, and its grid holds
// equipment that runs on suit power (solar panels, batteries, a power core, a laser, a shield,
// exo legs and night vision). Better armor has a bigger grid.

import type { ItemId } from './data';
import type { Game } from './sim';

const TPS = 60;

export interface ArmorDef { reduce: number; w: number; h: number }
export const ARMORS: Partial<Record<ItemId, ArmorDef>> = {
  'armor-1': { reduce: 0.15, w: 2, h: 2 },
  'armor-2': { reduce: 0.3, w: 3, h: 3 },
  'armor-3': { reduce: 0.45, w: 4, h: 4 },
  'armor-4': { reduce: 0.55, w: 5, h: 5 },
  'armor-5': { reduce: 0.65, w: 7, h: 7 },
};

export interface EquipDef {
  w: number;
  h: number;
  /** watts made (solar scales with daylight) */
  makes?: number;
  /** joules stored */
  stores?: number;
  /** watts used while working */
  uses?: number;
  color: string;
}
export const EQUIP: Partial<Record<ItemId, EquipDef>> = {
  'eq-solar': { w: 1, h: 1, makes: 30e3, color: '#1d3566' },
  'eq-battery': { w: 1, h: 2, stores: 20e6, color: '#3f8f63' },
  'eq-core': { w: 2, h: 2, makes: 750e3, color: '#e3b341' },
  'eq-laser': { w: 2, h: 2, uses: 0, color: '#d6455d' },
  'eq-shield': { w: 2, h: 2, uses: 120e3, color: '#5aa9ff' },
  'eq-legs': { w: 2, h: 3, uses: 200e3, color: '#7d8a9b' },
  'eq-night': { w: 2, h: 2, uses: 10e3, color: '#57d38c' },
};

export const SHIELD_HP = 60;
export const LASER_SHOT_J = 50e3;
export const LASER_RANGE = 12;
export const LASER_DAMAGE = 12;
/** A suit with no batteries still holds a little charge. */
const BASE_STORE = 1e6;

export interface Placed { item: ItemId; x: number; y: number }

export interface Suit {
  armor: ItemId | null;
  grid: Placed[];
  energy: number;
  shield: number;
  laserCd: number;
  /** set each tick: whether legs and night vision have power */
  legsOn: boolean;
  nightOn: boolean;
}

export function newSuit(): Suit {
  return { armor: null, grid: [], energy: 0, shield: 0, laserCd: 0, legsOn: false, nightOn: false };
}

export const isArmor = (item: ItemId) => !!ARMORS[item];
export const isEquip = (item: ItemId) => !!EQUIP[item];

export function gridSize(s: Suit): [number, number] {
  const a = s.armor ? ARMORS[s.armor] : null;
  return a ? [a.w, a.h] : [0, 0];
}

const has = (s: Suit, item: ItemId) => s.grid.filter((p) => p.item === item).length;

export function capacity(s: Suit) {
  return BASE_STORE + s.grid.reduce((t, p) => t + (EQUIP[p.item]?.stores ?? 0), 0);
}

/** First free spot for a piece of equipment, or null. */
export function freeSpot(s: Suit, item: ItemId): [number, number] | null {
  const d = EQUIP[item];
  if (!d) return null;
  const [W, H] = gridSize(s);
  const used = (x: number, y: number) =>
    s.grid.some((p) => {
      const q = EQUIP[p.item]!;
      return x >= p.x && x < p.x + q.w && y >= p.y && y < p.y + q.h;
    });
  for (let y = 0; y + d.h <= H; y++)
    for (let x = 0; x + d.w <= W; x++) {
      let ok = true;
      for (let j = 0; j < d.h && ok; j++) for (let i = 0; i < d.w && ok; i++) if (used(x + i, y + j)) ok = false;
      if (ok) return [x, y];
    }
  return null;
}

/** Puts armor on (from the inventory slot). The old armor and all its equipment go back to the inventory. */
export function wear(g: Game, item: ItemId): boolean {
  if (!isArmor(item) || g.inv.count(item) <= 0) return false;
  g.inv.remove(item, 1);
  takeOff(g);
  g.suit.armor = item;
  return true;
}

export function takeOff(g: Game) {
  const s = g.suit;
  if (s.armor) g.inv.add(s.armor, 1);
  for (const p of s.grid) g.inv.add(p.item, 1);
  s.armor = null;
  s.grid = [];
  s.shield = 0;
  s.energy = 0;
}

export function equip(g: Game, item: ItemId): boolean {
  const s = g.suit;
  if (!s.armor || g.inv.count(item) <= 0) return false;
  const at = freeSpot(s, item);
  if (!at) return false;
  g.inv.remove(item, 1);
  s.grid.push({ item, x: at[0], y: at[1] });
  return true;
}

export function unequip(g: Game, index: number) {
  const s = g.suit;
  const p = s.grid[index];
  if (!p) return;
  if (g.inv.add(p.item, 1) < 1) return;
  s.grid.splice(index, 1);
  s.energy = Math.min(s.energy, capacity(s));
  if (!has(s, 'eq-shield')) s.shield = 0;
}

export function shieldMax(s: Suit) {
  return has(s, 'eq-shield') * SHIELD_HP;
}

/** Runs the suit for one tick: makes power, charges the shield, powers legs and night vision. */
export function updateSuit(g: Game) {
  const s = g.suit;
  if (s.laserCd > 0) s.laserCd--;
  if (!s.armor) {
    s.legsOn = s.nightOn = false;
    return;
  }
  const light = g.daylight();
  let made = 0;
  for (const p of s.grid) {
    const d = EQUIP[p.item]!;
    if (d.makes) made += p.item === 'eq-solar' ? d.makes * light : d.makes;
  }
  s.energy = Math.min(capacity(s), s.energy + made / TPS);
  const use = (watts: number) => {
    const j = watts / TPS;
    if (s.energy < j) return false;
    s.energy -= j;
    return true;
  };
  const max = shieldMax(s);
  if (s.shield < max && use(EQUIP['eq-shield']!.uses! * has(s, 'eq-shield'))) s.shield = Math.min(max, s.shield + 0.15 * has(s, 'eq-shield'));
  s.legsOn = has(s, 'eq-legs') > 0 && (!g.pmoving || use(EQUIP['eq-legs']!.uses!));
  s.nightOn = has(s, 'eq-night') > 0 && use(EQUIP['eq-night']!.uses!);
}

/** Damage after the shield and armor; also drains the shield. */
export function absorb(g: Game, dmg: number): number {
  const s = g.suit;
  if (s.shield > 0) {
    const k = Math.min(s.shield, dmg);
    s.shield -= k;
    dmg -= k;
  }
  const a = s.armor ? ARMORS[s.armor] : null;
  return dmg * (1 - (a?.reduce ?? 0));
}

/** Lasers in the grid: one shot per laser, sharing a cooldown. Returns how many may fire now. */
export function lasersReady(g: Game): number {
  const s = g.suit;
  const n = has(s, 'eq-laser');
  if (!n || s.laserCd > 0 || s.energy < LASER_SHOT_J) return 0;
  return Math.min(n, Math.floor(s.energy / LASER_SHOT_J));
}

export function legsMult(g: Game) {
  return g.suit.legsOn ? 1 + 0.3 * Math.min(2, has(g.suit, 'eq-legs')) : 1;
}

export function suitToJSON(s: Suit) {
  return { a: s.armor, g: s.grid, e: Math.round(s.energy), sh: s.shield };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function suitFromJSON(d: any): Suit {
  const s = newSuit();
  if (!d) return s;
  s.armor = d.a && ARMORS[d.a as ItemId] ? d.a : null;
  s.grid = Array.isArray(d.g) ? d.g.filter((p: Placed) => EQUIP[p.item]) : [];
  s.energy = d.e ?? 0;
  s.shield = d.sh ?? 0;
  return s;
}
