// Gear, outfits and enemies for Survivle.

export interface Outfit {
  id: string;
  name: string;
  shirt: string;
  pants: string;
  hood: string;
  price: number;
}

/** The first one is what every new hero starts in: green shirt, green pants, dark green hood. */
export const OUTFITS: Outfit[] = [
  { id: 'forest', name: 'Forest Green', shirt: '#3e9b3a', pants: '#2f7d31', hood: '#1b4a20', price: 0 },
  { id: 'ember', name: 'Ember Red', shirt: '#cc4430', pants: '#7d2c22', hood: '#561a14', price: 25 },
  { id: 'river', name: 'River Blue', shirt: '#3b7acb', pants: '#2a4f88', hood: '#1a3361', price: 25 },
  { id: 'sun', name: 'Sunny Yellow', shirt: '#eac43c', pants: '#8c6e2b', hood: '#6a4d1d', price: 30 },
  { id: 'snow', name: 'Snow White', shirt: '#eef2f6', pants: '#b7c1cd', hood: '#7f8a9a', price: 35 },
  { id: 'royal', name: 'Royal Purple', shirt: '#7b4bc4', pants: '#4a2c7a', hood: '#e0b53c', price: 45 },
  { id: 'night', name: 'Night Black', shirt: '#30333d', pants: '#1c1e25', hood: '#0d0e12', price: 50 },
];

export const outfitById = (id: string) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];

export const MAX_SWORD = 15;
export const MAX_BOW = 12;
/** A sword or bow from a chest is at most this much better than your best one. */
export const MAX_UPGRADE = 5;

export function swordName(d: number): string {
  if (d <= 1) return 'Wooden Sword';
  if (d <= 3) return 'Stone Sword';
  if (d <= 5) return 'Bronze Sword';
  if (d <= 7) return 'Iron Sword';
  if (d <= 9) return 'Steel Sword';
  if (d <= 11) return 'Silver Sword';
  if (d <= 13) return 'Crystal Sword';
  if (d <= 14) return 'Sunsteel Sword';
  return 'Starfall Blade';
}

export function bowName(d: number): string {
  if (d <= 2) return 'Wooden Bow';
  if (d <= 4) return "Hunter's Bow";
  if (d <= 6) return 'Strong Bow';
  if (d <= 8) return 'Silver Bow';
  if (d <= 10) return 'Crystal Bow';
  return 'Starfall Bow';
}

/** Blade colour for a sword of this damage. */
export function swordColor(d: number): string {
  if (d <= 1) return '#b98b52';
  if (d <= 3) return '#9a9a9a';
  if (d <= 5) return '#cd8a4a';
  if (d <= 7) return '#c7ccd4';
  if (d <= 9) return '#dfe6ee';
  if (d <= 11) return '#f2f6ff';
  if (d <= 13) return '#8fe6ff';
  if (d <= 14) return '#ffd25a';
  return '#ffb8ff';
}

export interface EnemyKind {
  name: string;
  body: string;
  dark: string;
  /** Damage in quarter hearts. */
  dmg: number;
  hp: number;
  speed: number;
  size: number;
  coins: number;
}

// 95% orange, 4% blue, 1% green.
export const ENEMY_KINDS: EnemyKind[] = [
  { name: 'Orange Murk', body: '#f08a2c', dark: '#a8520f', dmg: 1, hp: 10, speed: 2.4, size: 0.8, coins: 1 },
  { name: 'Blue Murk', body: '#4a86e8', dark: '#22479a', dmg: 2, hp: 25, speed: 2.8, size: 0.95, coins: 5 },
  { name: 'Green Murk', body: '#45c45a', dark: '#1f7a34', dmg: 3, hp: 35, speed: 3.1, size: 1.1, coins: 10 },
];

export function rollEnemyKind(r: number): number {
  if (r < 0.95) return 0;
  if (r < 0.99) return 1;
  return 2;
}

export const PRICES = {
  woodSell: 2,
  arrows10: 6,
  apple: 5,
};

export const CAMPFIRE_WOOD = 3;
export const BOSS_HP = 500;
/** 4 hours of play, in seconds. */
export const TIME_LIMIT = 4 * 60 * 60;
/** Hearts are counted in quarters: 3 hearts = 12. */
export const MAX_HP = 12;
