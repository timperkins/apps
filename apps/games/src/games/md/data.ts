// M.D. (Monster Dungeons): weapons, armor, monsters, dungeon levels and traders.
// Everything here is original: names, stats and the blocky looks in models.ts.

export type MeleeId = 'rusty-sword' | 'twin-daggers' | 'battle-axe' | 'long-spear' | 'thunder-hammer' | 'frost-glaive' | 'ember-blade';
export type RangedId = 'shortbow' | 'crossbow' | 'fan-bow' | 'starlight-bow';
export type ArmorId = 'tunic' | 'jerkin' | 'chainmail' | 'mossguard' | 'obsidian-plate';
export type GearId = MeleeId | RangedId | ArmorId;

export interface Melee {
  kind: 'melee';
  name: string;
  desc: string;
  dmg: number;
  /** seconds between swings */
  rate: number;
  /** reach in tiles */
  reach: number;
  /** swing arc in degrees (360 = all around) */
  arc: number;
  knock: number;
  effect?: 'slow' | 'burn' | 'stun';
  price: number;
  color: string;
  blade: string;
}
export interface Ranged {
  kind: 'ranged';
  name: string;
  desc: string;
  dmg: number;
  rate: number;
  speed: number;
  shots: number;
  spread: number;
  pierce: number;
  price: number;
  color: string;
}
export interface Armor {
  kind: 'armor';
  name: string;
  desc: string;
  /** share of damage blocked, 0..1 */
  block: number;
  speed: number;
  regen: number;
  price: number;
  color: string;
  trim: string;
}

export const MELEE: Record<MeleeId, Melee> = {
  'rusty-sword': { kind: 'melee', name: 'Rusty Sword', desc: 'Old but honest. A quick, even swing.', dmg: 10, rate: 0.42, reach: 1.35, arc: 110, knock: 3, price: 0, color: '#6b4424', blade: '#b0a090' },
  'twin-daggers': { kind: 'melee', name: 'Twin Daggers', desc: 'Very fast stabs at close range.', dmg: 6, rate: 0.2, reach: 1.05, arc: 70, knock: 1.5, price: 60, color: '#2b2b33', blade: '#d8e2ee' },
  'battle-axe': { kind: 'melee', name: 'Battle Axe', desc: 'Slow, heavy sweeps that hit everything in front.', dmg: 20, rate: 0.72, reach: 1.45, arc: 170, knock: 6, price: 140, color: '#5a3820', blade: '#9aa4ae' },
  'long-spear': { kind: 'melee', name: 'Long Spear', desc: 'Pokes enemies from twice as far away.', dmg: 13, rate: 0.5, reach: 2.3, arc: 36, knock: 4, price: 110, color: '#8a6a3a', blade: '#cfd6dc' },
  'thunder-hammer': { kind: 'melee', name: 'Thunder Hammer', desc: 'Slams the floor: a shock ring that hits all around and stuns.', dmg: 28, rate: 1.0, reach: 1.9, arc: 360, knock: 7, effect: 'stun', price: 320, color: '#3b3f5a', blade: '#ffe066' },
  'frost-glaive': { kind: 'melee', name: 'Frost Glaive', desc: 'A wide icy arc that slows what it cuts.', dmg: 15, rate: 0.55, reach: 1.85, arc: 150, knock: 4, effect: 'slow', price: 260, color: '#2f5f8a', blade: '#aee8ff' },
  'ember-blade': { kind: 'melee', name: 'Ember Blade', desc: 'A glowing blade that sets enemies on fire.', dmg: 16, rate: 0.4, reach: 1.45, arc: 120, knock: 3, effect: 'burn', price: 480, color: '#5a1d10', blade: '#ff8a3a' },
};

export const RANGED: Record<RangedId, Ranged> = {
  shortbow: { kind: 'ranged', name: 'Shortbow', desc: 'A light bow. One arrow at a time.', dmg: 8, rate: 0.5, speed: 13, shots: 1, spread: 0, pierce: 0, price: 0, color: '#8a5a2b' },
  crossbow: { kind: 'ranged', name: 'Heavy Crossbow', desc: 'Slow to load; bolts punch through two enemies.', dmg: 22, rate: 1.1, speed: 18, shots: 1, spread: 0, pierce: 2, price: 150, color: '#4a3a2a' },
  'fan-bow': { kind: 'ranged', name: 'Fan Bow', desc: 'Looses three arrows in a fan.', dmg: 7, rate: 0.7, speed: 12, shots: 3, spread: 0.22, pierce: 0, price: 180, color: '#6b8a3a' },
  'starlight-bow': { kind: 'ranged', name: 'Starlight Bow', desc: 'Fast glowing arrows that pass through everything.', dmg: 14, rate: 0.32, speed: 17, shots: 1, spread: 0, pierce: 9, price: 520, color: '#e8e0ff' },
};

export const ARMOR: Record<ArmorId, Armor> = {
  tunic: { kind: 'armor', name: "Traveler's Tunic", desc: 'Comfy. Blocks nothing.', block: 0, speed: 1, regen: 0, price: 0, color: '#3f7a5a', trim: '#2c4f3c' },
  jerkin: { kind: 'armor', name: 'Leather Jerkin', desc: 'Blocks 15% of damage.', block: 0.15, speed: 1, regen: 0, price: 70, color: '#8a5a32', trim: '#5a3418' },
  chainmail: { kind: 'armor', name: 'Chainmail', desc: 'Blocks 30% of damage, a little heavy.', block: 0.3, speed: 0.95, regen: 0, price: 170, color: '#8c939c', trim: '#5b6169' },
  mossguard: { kind: 'armor', name: 'Mossguard Plate', desc: 'Blocks 40% and slowly heals you.', block: 0.4, speed: 0.95, regen: 1.2, price: 300, color: '#4d7a3a', trim: '#a8c46a' },
  'obsidian-plate': { kind: 'armor', name: 'Obsidian Plate', desc: 'Blocks 55% of damage.', block: 0.55, speed: 0.92, regen: 0, price: 560, color: '#2a2238', trim: '#9b6ad6' },
};

export function gear(id: GearId): Melee | Ranged | Armor {
  return (MELEE as Record<string, Melee>)[id] ?? (RANGED as Record<string, Ranged>)[id] ?? ARMOR[id as ArmorId];
}

export type SupplyId = 'potion' | 'arrows' | 'bomb' | 'mystery';
export const SUPPLIES: Record<SupplyId, { name: string; desc: string; price: number }> = {
  potion: { name: 'Healing Draught', desc: 'Heals 60% of your health (Q).', price: 25 },
  arrows: { name: 'Bundle of 20 Arrows', desc: 'For any bow.', price: 12 },
  bomb: { name: 'Fizz Bomb', desc: 'Throw it (R) and it bursts after a moment.', price: 30 },
  mystery: { name: 'Mystery Crate', desc: 'A random weapon or armor you don’t own yet.', price: 200 },
};

// ---------- monsters ----------
export type MonsterKind = 'mossling' | 'lantern-monk' | 'sporecap' | 'rustknight' | 'gloomwing' | 'frost-wisp' | 'cinder-hound' | 'hollow-crown';

export interface MonsterDef {
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  /** melee: hits when close; ranged: keeps distance and shoots; flier: swoops */
  style: 'melee' | 'ranged' | 'flier' | 'boss';
  range: number;
  windup: number;
  cooldown: number;
  radius: number;
  coins: [number, number];
  shot?: 'ember' | 'spore' | 'ice';
  blurb: string;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  mossling: { name: 'Mossling', hp: 26, speed: 2.4, dmg: 8, style: 'melee', range: 0.9, windup: 0.35, cooldown: 0.9, radius: 0.32, coins: [1, 3], blurb: 'A hopping block of mossy stone with glowing eyes.' },
  'lantern-monk': { name: 'Lantern Monk', hp: 22, speed: 2.0, dmg: 9, style: 'ranged', range: 5.5, windup: 0.6, cooldown: 1.6, radius: 0.3, coins: [2, 4], shot: 'ember', blurb: 'A hooded robe with a lantern for a head. Throws embers.' },
  sporecap: { name: 'Sporecap', hp: 38, speed: 1.4, dmg: 7, style: 'ranged', range: 4.5, windup: 0.8, cooldown: 2.2, radius: 0.38, coins: [2, 5], shot: 'spore', blurb: 'A waddling mushroom that lobs clouds of spores.' },
  rustknight: { name: 'Rustknight', hp: 90, speed: 1.6, dmg: 20, style: 'melee', range: 1.25, windup: 0.75, cooldown: 1.5, radius: 0.45, coins: [5, 9], blurb: 'A big empty suit of horned armor. Slow, but it hits hard.' },
  gloomwing: { name: 'Gloomwing', hp: 14, speed: 4.2, dmg: 6, style: 'flier', range: 0.8, windup: 0.2, cooldown: 1.1, radius: 0.28, coins: [1, 2], blurb: 'A cube with leathery wings that swoops in fast.' },
  'frost-wisp': { name: 'Frost Wisp', hp: 34, speed: 2.2, dmg: 10, style: 'ranged', range: 6, windup: 0.55, cooldown: 1.7, radius: 0.32, coins: [3, 6], shot: 'ice', blurb: 'A floating ice crystal. Its bolts slow you down.' },
  'cinder-hound': { name: 'Cinder Hound', hp: 40, speed: 3.6, dmg: 12, style: 'melee', range: 1.0, windup: 0.3, cooldown: 1.0, radius: 0.36, coins: [3, 6], blurb: 'A blocky dog of cooling lava that charges you down.' },
  'hollow-crown': { name: 'The Hollow Crown', hp: 1400, speed: 1.5, dmg: 24, style: 'boss', range: 1.8, windup: 0.9, cooldown: 1.4, radius: 0.9, coins: [150, 200], blurb: 'An obsidian golem king who rules the deepest dungeon.' },
};

// ---------- levels ----------
export interface LevelDef {
  id: string;
  name: string;
  blurb: string;
  floor: [string, string];
  wall: [string, string];
  accent: string;
  ambient: string;
  light: number;
  monsters: MonsterKind[];
  /** the guardian in the last room: a bigger, tougher version of a monster (or the final boss) */
  guardian: { kind: MonsterKind; name: string; scale: number; hp: number };
  rooms: number;
  hazard?: 'lava' | 'water' | 'ice';
  /** where it sits on the camp's mission map (0..100) */
  map: { x: number; y: number };
  reward: number;
}

export const LEVELS: LevelDef[] = [
  {
    id: 'crypt', name: 'Mossy Crypt', blurb: 'Old tombs gone green. Mind the hopping stones.',
    floor: ['#56605a', '#4a534d'], wall: ['#6d7a68', '#3d4a3a'], accent: '#8fd16a', ambient: '#0b1410', light: 0.8,
    monsters: ['mossling', 'mossling', 'lantern-monk', 'gloomwing'],
    guardian: { kind: 'mossling', name: 'Old Boulderback', scale: 2.2, hp: 260 }, rooms: 9, hazard: 'water', map: { x: 18, y: 72 }, reward: 40,
  },
  {
    id: 'shroom', name: 'Shroom Hollow', blurb: 'Caves full of giant glowing mushrooms, and some that walk.',
    floor: ['#5a4a5e', '#4c3e50'], wall: ['#7a5a7e', '#3e2c44'], accent: '#e06ad6', ambient: '#140b16', light: 0.85,
    monsters: ['sporecap', 'mossling', 'gloomwing', 'sporecap'],
    guardian: { kind: 'sporecap', name: 'Queen Puffshroom', scale: 2.4, hp: 420 }, rooms: 10, map: { x: 36, y: 40 }, reward: 60,
  },
  {
    id: 'frost', name: 'Frostdeep Halls', blurb: 'Frozen halls where wisps drift and old armor walks.',
    floor: ['#9fb6c8', '#8aa2b6'], wall: ['#d8eaf6', '#7896b0'], accent: '#aee8ff', ambient: '#0a1220', light: 0.95,
    monsters: ['frost-wisp', 'rustknight', 'gloomwing', 'frost-wisp'],
    guardian: { kind: 'rustknight', name: 'The Frozen Warden', scale: 2.0, hp: 700 }, rooms: 11, hazard: 'ice', map: { x: 60, y: 22 }, reward: 85,
  },
  {
    id: 'forge', name: 'Cinder Forge', blurb: 'A forge built over lava. Hounds of ember guard it.',
    floor: ['#4a3a36', '#3e302c'], wall: ['#6e4a3e', '#38221c'], accent: '#ff7a2a', ambient: '#1a0806', light: 0.9,
    monsters: ['cinder-hound', 'rustknight', 'lantern-monk', 'cinder-hound'],
    guardian: { kind: 'cinder-hound', name: 'Magmajaw', scale: 2.3, hp: 900 }, rooms: 12, hazard: 'lava', map: { x: 78, y: 52 }, reward: 110,
  },
  {
    id: 'throne', name: 'Obsidian Throne', blurb: 'The deepest dungeon, where the Hollow Crown waits.',
    floor: ['#2e2838', '#262030'], wall: ['#4a3e5e', '#1c1626'], accent: '#b07aff', ambient: '#08050e', light: 0.75,
    monsters: ['rustknight', 'frost-wisp', 'cinder-hound', 'lantern-monk', 'sporecap', 'gloomwing'],
    guardian: { kind: 'hollow-crown', name: 'The Hollow Crown', scale: 1, hp: 1400 }, rooms: 13, hazard: 'lava', map: { x: 88, y: 16 }, reward: 300,
  },
];

// ---------- traders ----------
export interface Trader {
  id: 'smith' | 'armorer' | 'peddler';
  name: string;
  title: string;
  hello: string;
  /** where they stand in camp */
  x: number;
  y: number;
  look: { robe: string; trim: string; hat: string; skin: string };
}
export const TRADERS: Trader[] = [
  { id: 'smith', name: 'Bram', title: 'Weaponsmith', hello: 'Sharp steel and strong string! What will it be?', x: 9.5, y: 7.5, look: { robe: '#7a4a2a', trim: '#3a2010', hat: '#c0392b', skin: '#c98e5e' } },
  { id: 'armorer', name: 'Tilda', title: 'Armorer', hello: 'Can’t win if you can’t take a hit, friend.', x: 16.5, y: 7.5, look: { robe: '#4a5a7a', trim: '#2a3450', hat: '#9aa4ae', skin: '#f0c7a0' } },
  { id: 'peddler', name: 'Old Pip', title: 'Peddler', hello: 'Potions, arrows, bombs… and a crate of surprises!', x: 13, y: 15.5, look: { robe: '#6a3a7a', trim: '#f0c040', hat: '#3a2a5a', skin: '#e0b088' } },
];

export const SMITH_STOCK: GearId[] = ['twin-daggers', 'long-spear', 'battle-axe', 'frost-glaive', 'thunder-hammer', 'ember-blade', 'crossbow', 'fan-bow', 'starlight-bow'];
export const ARMOR_STOCK: ArmorId[] = ['jerkin', 'chainmail', 'mossguard', 'obsidian-plate'];
export const PEDDLER_STOCK: SupplyId[] = ['potion', 'arrows', 'bomb', 'mystery'];
