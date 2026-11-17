// Gear, outfits and enemies for Survivle (Long Edition).

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
  // Raiders live in camps. 3 sword, 4 archer, 5 spear, 6 shield, 7 captain. 8 is a wolf.
  { name: 'Raider', body: '#b0734a', dark: '#6b3f22', dmg: 2, hp: 30, speed: 2.7, size: 1, coins: 4 },
  { name: 'Raider Archer', body: '#a07850', dark: '#5e4127', dmg: 2, hp: 22, speed: 2.5, size: 0.95, coins: 4 },
  { name: 'Raider Spearman', body: '#9c6a48', dark: '#5a3a24', dmg: 3, hp: 32, speed: 2.6, size: 1, coins: 5 },
  { name: 'Raider Shieldbearer', body: '#8e6d58', dark: '#4f3a2c', dmg: 2, hp: 34, speed: 2.4, size: 1.05, coins: 6 },
  { name: 'Raider Captain', body: '#7a4a6a', dark: '#40243a', dmg: 5, hp: 140, speed: 2.6, size: 1.35, coins: 30 },
  { name: 'Wolf', body: '#8a8f99', dark: '#4a4e57', dmg: 2, hp: 18, speed: 4.4, size: 0.9, coins: 2 },
];
export const RAIDER = 3;
export const WOLF = 8;
export const isRaider = (k: number) => k >= 3 && k <= 7;
/** Shield strength a raider starts with (0 = no shield). */
export const raiderShield = (k: number) => (k === 6 ? 40 : k === 7 ? 70 : 0);
/** Armor: how much of each hit it soaks up (0 to 1). */
export const raiderArmor = (k: number) => (k === 7 ? 0.35 : k === 6 ? 0.15 : 0);
export const raiderWeapon = (k: number): 'sword' | 'bow' | 'spear' | 'claws' => (k === 4 ? 'bow' : k === 5 ? 'spear' : k === 8 ? 'claws' : 'sword');

export function rollEnemyKind(r: number): number {
  if (r < 0.95) return 0;
  if (r < 0.99) return 1;
  return 2;
}

export const PRICES = {
  woodSell: 2,
  arrows10: 6,
  apple: 5,
  ice10: 20,
  fire10: 25,
  bomb: 12,
  glider: 80,
  starSell: 40,
  gemSell: 25,
};

export const CAMPFIRE_WOOD = 3;
/** Long Edition: the Dark Beast has three times the health (it was 500). */
export const BOSS_HP = 1500;
/** 4 hours of play, in seconds. */
export const TIME_LIMIT = 4 * 60 * 60;
/** Hearts are counted in quarters: 3 hearts = 12. */
export const MAX_HP = 12;

/** Most permanent health you can reach from challenge rocks: 20 hearts. */
export const MAX_HP_CAP = 80;
export const ACORN_HEAL = 1;
export const FOOD_HEAL = 4;
/** Seconds for a farm crop to grow. */
export const CROP_TIME = 40;

export interface Job {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const JOBS: Job[] = [
  { id: 'farmer', name: 'Farmer', icon: '🌾', desc: 'You get the village farm. Press E on a farm tile to plant, wait for it to grow, then press E again to harvest for 3 coins.' },
  { id: 'lumberjack', name: 'Lumberjack', icon: '🪓', desc: 'Earn 2 coins for every tree you chop down.' },
  { id: 'guard', name: 'Guard', icon: '🛡', desc: 'Earn 3 coins for every Murk you defeat.' },
  { id: 'fisher', name: 'Fisher', icon: '🎣', desc: 'Stand next to water and press E to fish. Each fish sells for 4 coins.' },
  { id: 'miner', name: 'Miner', icon: '⛏', desc: 'Stand on or next to gray rock and press E to mine. 3 coins, and sometimes a gem worth 20.' },
  { id: 'baker', name: 'Baker', icon: '🍞', desc: 'Press E at the village oven to bake bread. Earn 2 coins a loaf and keep one to eat (heals 1 heart).' },
  { id: 'grocer', name: 'Grocery store', icon: '🛒', desc: 'Run the village store. Farm, mine, chop trees and beat Murks for meat, then press E at the store to stock the shelves. Villagers come in, pick things off the shelves and pay you.' },
  { id: 'courier', name: 'Courier', icon: '✉', desc: 'Carry a letter to the other village. Walk into it to deliver for 15 coins, then take the next letter back.' },
];
/** What the grocery store sells, and what villagers pay. */
export const GOODS = [
  { id: 'veg', name: 'veggies', icon: '🥕', price: 4, color: '#f08a2c' },
  { id: 'ore', name: 'ore', icon: '🪨', price: 5, color: '#9aa3ad' },
  { id: 'wood', name: 'wood', icon: '🪵', price: 3, color: '#9b6b3c' },
  { id: 'meat', name: 'meat', icon: '🍖', price: 6, color: '#c8574a' },
] as const;
export type GoodId = (typeof GOODS)[number]['id'];
export const jobById = (id: string | null) => JOBS.find((j) => j.id === id) ?? null;

/** Challenges at the glowing rocks: which Murks you have to beat (0 orange, 1 blue, 2 green). */
export const CHALLENGES: { name: string; kinds: number[] }[] = [
  { name: 'Two greens', kinds: [2, 2] },
  { name: 'A bunch of oranges', kinds: [0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Three blues', kinds: [1, 1, 1] },
  { name: 'A green and four oranges', kinds: [2, 0, 0, 0, 0] },
  { name: 'Two blues and three oranges', kinds: [1, 1, 0, 0, 0] },
];

// ---------- Long Edition ----------

/** The Sword of Light: 30 damage to enemies, twice that to bosses. You need 10 full hearts to pull it out. */
export const LIGHT_DMG = 30;
export const LIGHT_HEARTS = 40;
export const SPEAR_DMG = 8;

export type Weapon = 'sword' | 'bow' | 'spear' | 'light';
export const WEAPON_NAMES: Record<Weapon, string> = { sword: 'Sword', bow: 'Bow', spear: 'Spear', light: 'The Sword of Light' };

export type ArmorSlot = 'head' | 'body' | 'legs';
export interface ArmorPiece {
  id: string;
  slot: ArmorSlot;
  name: string;
  /** How much of each hit it soaks up, added across pieces. */
  def: number;
  price: number;
  color: string;
  /** Keeps you warm in the snow. */
  warm?: boolean;
}
export const ARMOR: ArmorPiece[] = [
  { id: 'leather-cap', slot: 'head', name: 'Leather Cap', def: 0.05, price: 30, color: '#8a5a2b' },
  { id: 'iron-helm', slot: 'head', name: 'Iron Helm', def: 0.1, price: 70, color: '#aab3bd' },
  { id: 'knight-helm', slot: 'head', name: 'Knight Helm', def: 0.15, price: 140, color: '#e3e8ef' },
  { id: 'fur-hood', slot: 'head', name: 'Fur Hood', def: 0.04, price: 40, color: '#e8dccb', warm: true },
  { id: 'leather-vest', slot: 'body', name: 'Leather Vest', def: 0.08, price: 40, color: '#7a4a24' },
  { id: 'chain-shirt', slot: 'body', name: 'Chain Shirt', def: 0.14, price: 90, color: '#9aa3ad' },
  { id: 'knight-plate', slot: 'body', name: 'Knight Plate', def: 0.2, price: 180, color: '#dfe5ec' },
  { id: 'fur-coat', slot: 'body', name: 'Fur Coat', def: 0.06, price: 50, color: '#d8c8b0', warm: true },
  { id: 'leather-boots', slot: 'legs', name: 'Leather Boots', def: 0.04, price: 25, color: '#5a3a1e' },
  { id: 'iron-greaves', slot: 'legs', name: 'Iron Greaves', def: 0.08, price: 60, color: '#9aa3ad' },
  { id: 'knight-greaves', slot: 'legs', name: 'Knight Greaves', def: 0.12, price: 120, color: '#dfe5ec' },
];
export const armorById = (id: string | null | undefined) => ARMOR.find((a) => a.id === id) ?? null;

export interface ShieldKind {
  id: string;
  name: string;
  hp: number;
  price: number;
  color: string;
  rim: string;
}
export const SHIELDS: ShieldKind[] = [
  { id: 'wood', name: 'Wooden Shield', hp: 30, price: 20, color: '#9b6b3c', rim: '#5a3a1e' },
  { id: 'raider', name: 'Raider Shield', hp: 45, price: 0, color: '#7a5a3a', rim: '#3a2a1a' },
  { id: 'iron', name: 'Iron Shield', hp: 70, price: 60, color: '#9aa3ad', rim: '#5a626b' },
  { id: 'knight', name: 'Knight Shield', hp: 120, price: 130, color: '#3b6fcb', rim: '#e0b53c' },
];
export const shieldById = (id: string | null | undefined) => SHIELDS.find((s) => s.id === id) ?? null;

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  needs: Partial<Record<'apple' | 'acorn' | 'red' | 'blue' | 'meat', number>>;
  desc: string;
}
export const RECIPES: Recipe[] = [
  { id: 'skewer', name: 'Mushroom Skewer', icon: '🍢', needs: { red: 2 }, desc: 'Heals 3 hearts.' },
  { id: 'roast', name: 'Roast Meat', icon: '🍖', needs: { meat: 1 }, desc: 'Heals 4 hearts.' },
  { id: 'soup', name: 'Energy Soup', icon: '🥣', needs: { blue: 2 }, desc: 'Full stamina, and stamina drains half as fast for 2 minutes.' },
  { id: 'chili', name: 'Warm Chili', icon: '🌶', needs: { red: 1, acorn: 2 }, desc: 'Stay warm in the snow for 4 minutes.' },
  { id: 'pie', name: 'Apple Pie', icon: '🥧', needs: { apple: 2, acorn: 1 }, desc: 'Heals 3 hearts and fills your stamina.' },
  { id: 'feast', name: "Hero's Feast", icon: '🍲', needs: { meat: 1, apple: 1, red: 1 }, desc: 'All hearts back, and you hit 50% harder for 90 seconds.' },
];

export interface Quest {
  id: string;
  text: string;
  /** What counts: mushrooms brought, camps cleared, raiders beaten, meat brought. */
  kind: 'mushrooms' | 'camp' | 'raiders' | 'meat' | 'shrine';
  need: number;
  coins: number;
}
export const QUESTS: Quest[] = [
  { id: 'mush', text: 'Bring me 3 mushrooms for my soup.', kind: 'mushrooms', need: 3, coins: 30 },
  { id: 'camp', text: 'Raiders keep stealing our apples! Clear out a raider camp.', kind: 'camp', need: 1, coins: 60 },
  { id: 'raid', text: 'Beat 8 raiders to keep the roads safe.', kind: 'raiders', need: 8, coins: 45 },
  { id: 'meat', text: 'Wolves took our sheep. Bring me 2 pieces of wolf meat.', kind: 'meat', need: 2, coins: 35 },
  { id: 'shrine', text: 'Find 2 shrines I have never seen.', kind: 'shrine', need: 2, coins: 40 },
];

/** The 25 extra open-world things in the Long Edition, shown on the title screen. */
export const LONG_FEATURES = [
  'Shrines with spirit orbs (4 orbs = a heart or more stamina)',
  'Fast travel between shrines you found',
  'Watchtowers to climb that show camps and shrines on your map',
  'A big map (M)',
  'A glider from the trader: jump in the air to glide',
  'Sprint (hold X)',
  'Wild horses to ride (E)',
  'Day and night',
  'Rain storms that make cliffs slippery',
  'Bombs (G) that break shields and ore rocks',
  'Fire arrows that burn',
  'Red and blue mushrooms to pick',
  'Cooking at any fire',
  'A loot chest when you clear a raider camp',
  'Raider captains with armor and big shields',
  'Raiders sound the alarm and the whole camp comes for you',
  'Raiders sleep at night: sneak attacks do 3× damage',
  'Raiders drop their swords, shields and spears',
  'A blacksmith in every village for armor and shields',
  'Healing springs',
  'Cold in the snow: wear fur or eat chili',
  'Ore rocks with gems inside',
  'Falling stars at night',
  'Village elders with quests',
  'Wolf packs in the forests',
];
