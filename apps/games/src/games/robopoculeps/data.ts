// Robopoculeps: numbers and names in one place.

export type OreId = 'stone' | 'coal' | 'iron' | 'gold' | 'diamond';
export const ORE_IDS: OreId[] = ['stone', 'coal', 'iron', 'gold', 'diamond'];

export interface OreInfo {
  name: string;
  /** What the shopkeeper (and a payer) pays for one. */
  price: number;
  /** Cost of a flying robot that mines this ore. */
  robot: number;
  /** Rock body and the coloured flecks in it. */
  rock: string;
  fleck: string;
  /** Seconds per ore when you mine by hand / when a robot mines. */
  handTime: number;
  robotTime: number;
  /** How many ores one rock holds. */
  amt: number;
}

export const ORES: Record<OreId, OreInfo> = {
  stone: { name: 'Stone', price: 5, robot: 50, rock: '#8b8580', fleck: '#b9b3ad', handTime: 0.5, robotTime: 1.0, amt: 25 },
  coal: { name: 'Coal', price: 12, robot: 300, rock: '#5b5652', fleck: '#16120f', handTime: 0.8, robotTime: 1.3, amt: 20 },
  iron: { name: 'Iron', price: 30, robot: 1000, rock: '#7b6f66', fleck: '#d9a07a', handTime: 1.1, robotTime: 1.6, amt: 18 },
  gold: { name: 'Gold', price: 80, robot: 3500, rock: '#6f665c', fleck: '#ffd23f', handTime: 1.5, robotTime: 2.0, amt: 14 },
  diamond: { name: 'Diamond', price: 300, robot: 12000, rock: '#5d6670', fleck: '#7ff3ff', handTime: 2.0, robotTime: 2.5, amt: 10 },
};

/** The mine is five caves in a row. Cave i holds mostly ore i; blasting its boulders costs dynamite. */
export const ZONES = [
  { name: 'Stone Hollow', floor: '#3e332b', dynamite: 0 },
  { name: 'Coal Cavern', floor: '#2f2b2a', dynamite: 150 },
  { name: 'Iron Depths', floor: '#3b2f2a', dynamite: 600 },
  { name: 'Gold Grotto', floor: '#3d3526', dynamite: 2000 },
  { name: 'Diamond Deep', floor: '#26323a', dynamite: 6000 },
];

export type Kind = 'belt' | 'grabber' | 'payer' | 'crate';
export const KINDS: Kind[] = ['belt', 'grabber', 'payer', 'crate'];
export const KIND_INFO: Record<Kind, { name: string; price: number; about: string }> = {
  belt: { name: 'Belt', price: 5, about: 'Moves things along the way it points.' },
  grabber: { name: 'Grabber', price: 20, about: 'Picks things up from behind it and drops them in front.' },
  payer: { name: 'Payer', price: 40, about: 'Pays you the store price for every thing it gets.' },
  crate: { name: 'Crate', price: 30, about: 'Robots bring what they mine to the nearest crate.' },
};

/** Robot upgrades: speed multiplier and how much a robot carries, by level. */
export const SPEED_LV = [1, 1.35, 1.7, 2.1];
export const SPEED_COST = [250, 1000, 4000];
export const BAG_LV = [4, 6, 9, 12];
export const BAG_COST = [200, 800, 3200];

export const GOLDEN_ROBOT = 50000;

export const SHOPKEEPER_LINE = 'Stars and the moon, sun in the sky, hey baby hey, what do you want?';
