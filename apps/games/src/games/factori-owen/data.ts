// Static game data: items, recipes, buildings and research for Factori-owen.

export type ItemId =
  | 'wood' | 'coal' | 'stone' | 'owen-ore' | 'copper-ore'
  | 'owen-plate' | 'copper-plate' | 'stone-brick' | 'steel-plate'
  | 'owen-gear' | 'owen-stick' | 'copper-cable' | 'circuit'
  | 'red-pack' | 'green-pack' | 'military-pack' | 'advanced-pack'
  | 'wooden-chest' | 'owen-chest' | 'steel-chest'
  | 'belt' | 'fast-belt'
  | 'burner-inserter' | 'inserter' | 'long-inserter' | 'fast-inserter'
  | 'burner-drill' | 'electric-drill'
  | 'stone-furnace' | 'assembler' | 'lab'
  | 'pole' | 'generator' | 'solar-panel'
  | 'owen-monument'
  | 'owen-ammo' | 'rail-ammo' | 'rail-gun' | 'gun-turret' | 'rail-turret' | 'wall';

export type Category = 'logistics' | 'production' | 'intermediate' | 'science' | 'military';

export interface ItemDef {
  id: ItemId;
  name: string;
  stack: number;
  fuel?: number; // joules
  place?: EntityType;
  category: Category;
  desc?: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  'wood': { id: 'wood', name: 'Wood', stack: 100, fuel: 2e6, category: 'intermediate' },
  'coal': { id: 'coal', name: 'Coal', stack: 50, fuel: 4e6, category: 'intermediate' },
  'stone': { id: 'stone', name: 'Stone', stack: 50, category: 'intermediate' },
  'owen-ore': { id: 'owen-ore', name: 'Owen ore', stack: 50, category: 'intermediate' },
  'copper-ore': { id: 'copper-ore', name: 'Copper ore', stack: 50, category: 'intermediate' },
  'owen-plate': { id: 'owen-plate', name: 'Owen plate', stack: 100, category: 'intermediate' },
  'copper-plate': { id: 'copper-plate', name: 'Copper plate', stack: 100, category: 'intermediate' },
  'stone-brick': { id: 'stone-brick', name: 'Stone brick', stack: 100, category: 'intermediate' },
  'steel-plate': { id: 'steel-plate', name: 'Owen steel', stack: 100, category: 'intermediate' },
  'owen-gear': { id: 'owen-gear', name: 'Owen gear wheel', stack: 100, category: 'intermediate' },
  'owen-stick': { id: 'owen-stick', name: 'Owen stick', stack: 100, category: 'intermediate' },
  'copper-cable': { id: 'copper-cable', name: 'Copper cable', stack: 200, category: 'intermediate' },
  'circuit': { id: 'circuit', name: 'Circuit board', stack: 200, category: 'intermediate' },
  'red-pack': { id: 'red-pack', name: 'Automation science pack', stack: 200, category: 'science' },
  'green-pack': { id: 'green-pack', name: 'Logistic science pack', stack: 200, category: 'science' },
  'military-pack': { id: 'military-pack', name: 'Military science pack', stack: 200, category: 'science' },
  'advanced-pack': { id: 'advanced-pack', name: 'Advanced science pack', stack: 200, category: 'science' },
  'wooden-chest': { id: 'wooden-chest', name: 'Wooden crate', stack: 50, fuel: 2e6, place: 'wooden-chest', category: 'logistics' },
  'owen-chest': { id: 'owen-chest', name: 'Owen crate', stack: 50, place: 'owen-chest', category: 'logistics' },
  'steel-chest': { id: 'steel-chest', name: 'Owen steel crate', stack: 50, place: 'steel-chest', category: 'logistics' },
  'belt': { id: 'belt', name: 'Conveyor belt', stack: 100, place: 'belt', category: 'logistics' },
  'fast-belt': { id: 'fast-belt', name: 'Fast conveyor belt', stack: 100, place: 'fast-belt', category: 'logistics' },
  'burner-inserter': { id: 'burner-inserter', name: 'Burner arm', stack: 50, place: 'burner-inserter', category: 'logistics' },
  'inserter': { id: 'inserter', name: 'Robo arm', stack: 50, place: 'inserter', category: 'logistics' },
  'long-inserter': { id: 'long-inserter', name: 'Long robo arm', stack: 50, place: 'long-inserter', category: 'logistics' },
  'fast-inserter': { id: 'fast-inserter', name: 'Fast robo arm', stack: 50, place: 'fast-inserter', category: 'logistics' },
  'pole': { id: 'pole', name: 'Power pole', stack: 50, place: 'pole', category: 'logistics' },
  'burner-drill': { id: 'burner-drill', name: 'Burner drill', stack: 50, place: 'burner-drill', category: 'production' },
  'electric-drill': { id: 'electric-drill', name: 'Electric drill', stack: 50, place: 'electric-drill', category: 'production' },
  'stone-furnace': { id: 'stone-furnace', name: 'Stone furnace', stack: 50, place: 'stone-furnace', category: 'production' },
  'assembler': { id: 'assembler', name: 'Assembler', stack: 50, place: 'assembler', category: 'production' },
  'lab': { id: 'lab', name: 'Research lab', stack: 10, place: 'lab', category: 'production' },
  'generator': { id: 'generator', name: 'Coal generator', stack: 10, place: 'generator', category: 'production' },
  'solar-panel': { id: 'solar-panel', name: 'Solar panel', stack: 50, place: 'solar-panel', category: 'production' },
  'owen-monument': { id: 'owen-monument', name: 'The Great Owen Monument', stack: 1, place: 'owen-monument', category: 'production', desc: 'Build it to win.' },
  'owen-ammo': { id: 'owen-ammo', name: 'Owen bullets', stack: 200, category: 'military', desc: 'A magazine of 10 rounds for your pistol and gun turrets. Hold Space to shoot.' },
  'rail-ammo': { id: 'rail-ammo', name: 'Rail slug', stack: 50, category: 'military', desc: 'One shot for a rail gun. Pierces every bug in a line.' },
  'rail-gun': { id: 'rail-gun', name: 'Rail gun', stack: 1, category: 'military', desc: 'Carry it and hold Space to fire rail slugs a long way. Slow, but nothing survives.' },
  'gun-turret': { id: 'gun-turret', name: 'Gun turret', stack: 50, place: 'gun-turret', category: 'military', desc: 'Shoots bugs automatically. Load it with Owen bullets.' },
  'rail-turret': { id: 'rail-turret', name: 'Rail gun turret', stack: 10, place: 'rail-turret', category: 'military', desc: 'Huge range. Needs power and rail slugs.' },
  'wall': { id: 'wall', name: 'Stone wall', stack: 100, place: 'wall', category: 'military', desc: 'Bugs have to chew through it.' },
};

export type EntityType =
  | 'wooden-chest' | 'owen-chest' | 'steel-chest'
  | 'belt' | 'fast-belt'
  | 'burner-inserter' | 'inserter' | 'long-inserter' | 'fast-inserter'
  | 'burner-drill' | 'electric-drill'
  | 'stone-furnace' | 'assembler' | 'lab'
  | 'pole' | 'generator' | 'solar-panel' | 'owen-monument'
  | 'gun-turret' | 'rail-turret' | 'wall';

export type Kind = 'chest' | 'belt' | 'inserter' | 'drill' | 'furnace' | 'assembler' | 'lab' | 'pole' | 'generator' | 'solar' | 'monument' | 'turret' | 'wall';

export interface EntityDef {
  type: EntityType;
  kind: Kind;
  w: number;
  h: number;
  item: ItemId;
  rotatable?: boolean;
  /** Burner fuel or electric power draw, watts. */
  power?: number;
  electric?: boolean;
  slots?: number;        // chest
  speed?: number;        // belt tiles/s, inserter cycles/s, drill items/s, crafting speed
  reach?: number;        // inserter pick/drop distance
  area?: number;         // drill mining area (square side)
  output?: number;       // generator / solar max watts
  mineTime: number;      // seconds for the player to pick it up
  hp?: number;
  range?: number;        // turret
  ammo?: ItemId;         // turret
  damage?: number;       // turret, per shot
  fireRate?: number;     // turret shots/s
}

export const ENTITIES: Record<EntityType, EntityDef> = {
  'wooden-chest': { type: 'wooden-chest', kind: 'chest', w: 1, h: 1, item: 'wooden-chest', slots: 16, mineTime: 0.2 },
  'owen-chest': { type: 'owen-chest', kind: 'chest', w: 1, h: 1, item: 'owen-chest', slots: 32, mineTime: 0.2 },
  'steel-chest': { type: 'steel-chest', kind: 'chest', w: 1, h: 1, item: 'steel-chest', slots: 48, mineTime: 0.2 },
  'belt': { type: 'belt', kind: 'belt', w: 1, h: 1, item: 'belt', rotatable: true, speed: 1.875, mineTime: 0.1 },
  'fast-belt': { type: 'fast-belt', kind: 'belt', w: 1, h: 1, item: 'fast-belt', rotatable: true, speed: 3.75, mineTime: 0.1 },
  'burner-inserter': { type: 'burner-inserter', kind: 'inserter', w: 1, h: 1, item: 'burner-inserter', rotatable: true, power: 100e3, speed: 0.6, reach: 1, mineTime: 0.1 },
  'inserter': { type: 'inserter', kind: 'inserter', w: 1, h: 1, item: 'inserter', rotatable: true, power: 13e3, electric: true, speed: 0.85, reach: 1, mineTime: 0.1 },
  'long-inserter': { type: 'long-inserter', kind: 'inserter', w: 1, h: 1, item: 'long-inserter', rotatable: true, power: 20e3, electric: true, speed: 1.2, reach: 2, mineTime: 0.1 },
  'fast-inserter': { type: 'fast-inserter', kind: 'inserter', w: 1, h: 1, item: 'fast-inserter', rotatable: true, power: 46e3, electric: true, speed: 2.3, reach: 1, mineTime: 0.1 },
  'burner-drill': { type: 'burner-drill', kind: 'drill', w: 2, h: 2, item: 'burner-drill', rotatable: true, power: 150e3, speed: 0.25, area: 2, mineTime: 0.3 },
  'electric-drill': { type: 'electric-drill', kind: 'drill', w: 3, h: 3, item: 'electric-drill', rotatable: true, power: 90e3, electric: true, speed: 0.5, area: 5, mineTime: 0.3 },
  'stone-furnace': { type: 'stone-furnace', kind: 'furnace', w: 2, h: 2, item: 'stone-furnace', power: 90e3, speed: 1, mineTime: 0.3 },
  'assembler': { type: 'assembler', kind: 'assembler', w: 3, h: 3, item: 'assembler', power: 75e3, electric: true, speed: 0.75, mineTime: 0.3 },
  'lab': { type: 'lab', kind: 'lab', w: 3, h: 3, item: 'lab', power: 60e3, electric: true, speed: 1, mineTime: 0.3 },
  'pole': { type: 'pole', kind: 'pole', w: 1, h: 1, item: 'pole', mineTime: 0.1 },
  'generator': { type: 'generator', kind: 'generator', w: 3, h: 3, item: 'generator', output: 900e3, mineTime: 0.3 },
  'solar-panel': { type: 'solar-panel', kind: 'solar', w: 3, h: 3, item: 'solar-panel', output: 60e3, mineTime: 0.3 },
  'owen-monument': { type: 'owen-monument', kind: 'monument', w: 5, h: 5, item: 'owen-monument', mineTime: 1, hp: 5000 },
  'gun-turret': { type: 'gun-turret', kind: 'turret', w: 2, h: 2, item: 'gun-turret', mineTime: 0.4, hp: 400, range: 18, ammo: 'owen-ammo', damage: 6, fireRate: 6 },
  'rail-turret': { type: 'rail-turret', kind: 'turret', w: 3, h: 3, item: 'rail-turret', mineTime: 0.5, hp: 1000, range: 40, ammo: 'rail-ammo', damage: 400, fireRate: 0.4, power: 400e3, electric: true },
  'wall': { type: 'wall', kind: 'wall', w: 1, h: 1, item: 'wall', mineTime: 0.2, hp: 350 },
};

const DEFAULT_HP: Record<Kind, number> = {
  chest: 150, belt: 80, inserter: 100, drill: 250, furnace: 200, assembler: 300, lab: 200,
  pole: 100, generator: 400, solar: 200, monument: 5000, turret: 400, wall: 350,
};
export function maxHp(t: EntityType): number {
  return ENTITIES[t].hp ?? DEFAULT_HP[ENTITIES[t].kind];
}

export const POLE_WIRE_REACH = 7.5;
export const POLE_SUPPLY_RADIUS = 2.5;

export interface Recipe {
  id: string;
  out: ItemId;
  count: number;
  time: number; // seconds at crafting speed 1
  ing: [ItemId, number][];
  /** smelting recipes run only in furnaces; hand=false means machines only */
  smelt?: boolean;
  hand?: boolean;
  unlock?: string; // tech id
}

const r = (out: ItemId, count: number, time: number, ing: [ItemId, number][], extra: Partial<Recipe> = {}): Recipe =>
  ({ id: out, out, count, time, ing, hand: true, ...extra });

export const RECIPES: Recipe[] = [
  // smelting
  r('owen-plate', 1, 3.2, [['owen-ore', 1]], { smelt: true, hand: false }),
  r('copper-plate', 1, 3.2, [['copper-ore', 1]], { smelt: true, hand: false }),
  r('stone-brick', 1, 3.2, [['stone', 2]], { smelt: true, hand: false }),
  r('steel-plate', 1, 16, [['owen-plate', 5]], { smelt: true, hand: false, unlock: 'steel' }),
  // intermediates
  r('owen-gear', 1, 0.5, [['owen-plate', 2]]),
  r('owen-stick', 2, 0.5, [['owen-plate', 1]]),
  r('copper-cable', 2, 0.5, [['copper-plate', 1]]),
  r('circuit', 1, 0.5, [['owen-plate', 1], ['copper-cable', 3]]),
  // logistics
  r('wooden-chest', 1, 0.5, [['wood', 2]]),
  r('owen-chest', 1, 0.5, [['owen-plate', 8]]),
  r('steel-chest', 1, 0.5, [['steel-plate', 8]], { unlock: 'steel' }),
  r('belt', 2, 0.5, [['owen-gear', 1], ['owen-plate', 1]]),
  r('fast-belt', 1, 0.5, [['owen-gear', 5], ['belt', 1]], { unlock: 'logistics' }),
  r('burner-inserter', 1, 0.5, [['owen-plate', 1], ['owen-gear', 1]]),
  r('inserter', 1, 0.5, [['circuit', 1], ['owen-gear', 1], ['owen-plate', 1]]),
  r('long-inserter', 1, 0.5, [['inserter', 1], ['owen-gear', 1], ['owen-plate', 1]], { unlock: 'automation' }),
  r('fast-inserter', 1, 0.5, [['inserter', 1], ['circuit', 2], ['owen-plate', 2]], { unlock: 'fast-inserter' }),
  r('pole', 2, 0.5, [['wood', 1], ['copper-cable', 2]]),
  // production
  r('stone-furnace', 1, 0.5, [['stone', 5]]),
  r('burner-drill', 1, 2, [['owen-gear', 3], ['stone-furnace', 1], ['owen-plate', 3]]),
  r('electric-drill', 1, 2, [['circuit', 3], ['owen-gear', 5], ['owen-plate', 10]]),
  r('generator', 1, 2, [['owen-gear', 8], ['owen-plate', 10], ['stone-furnace', 1]]),
  r('assembler', 1, 0.5, [['circuit', 3], ['owen-gear', 5], ['owen-plate', 9]], { unlock: 'automation' }),
  r('lab', 1, 2, [['circuit', 10], ['owen-gear', 10], ['belt', 4]]),
  r('solar-panel', 1, 10, [['steel-plate', 5], ['circuit', 15], ['copper-plate', 15]], { unlock: 'solar' }),
  r('owen-monument', 1, 30, [['steel-plate', 100], ['circuit', 200], ['stone-brick', 200], ['green-pack', 50]], { unlock: 'monument' }),
  // military
  r('owen-ammo', 1, 1, [['owen-plate', 4]]),
  r('gun-turret', 1, 8, [['owen-gear', 10], ['copper-plate', 10], ['owen-plate', 20]]),
  r('wall', 1, 0.5, [['stone-brick', 5]], { unlock: 'military' }),
  r('rail-ammo', 1, 3, [['steel-plate', 2], ['copper-plate', 2], ['circuit', 1]], { unlock: 'rail-guns' }),
  r('rail-gun', 1, 10, [['steel-plate', 10], ['circuit', 15], ['owen-gear', 5]], { unlock: 'rail-guns' }),
  r('rail-turret', 1, 15, [['steel-plate', 20], ['circuit', 25], ['owen-gear', 10], ['gun-turret', 1]], { unlock: 'rail-guns' }),
  // science
  r('red-pack', 1, 5, [['copper-plate', 1], ['owen-gear', 1]]),
  r('green-pack', 1, 6, [['inserter', 1], ['belt', 1]], { unlock: 'green-science' }),
  r('military-pack', 2, 10, [['owen-ammo', 1], ['wall', 2], ['steel-plate', 1]], { unlock: 'military-science' }),
  r('advanced-pack', 2, 20, [['circuit', 3], ['steel-plate', 2], ['fast-inserter', 1]], { unlock: 'advanced-science' }),
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((x) => [x.id, x]));
export const SMELT_BY_INPUT: Partial<Record<ItemId, Recipe>> = {};
for (const x of RECIPES) if (x.smelt) SMELT_BY_INPUT[x.ing[0][0]] = x;

export interface Tech {
  id: string;
  name: string;
  desc: string;
  packs: ItemId[]; // one of each per unit
  units: number;
  time: number; // seconds per unit
  requires: string[];
}

export const TECHS: Tech[] = [
  { id: 'automation', name: 'Automation', desc: 'Assemblers craft things for you. Also unlocks the long robo arm.', packs: ['red-pack'], units: 10, time: 10, requires: [] },
  { id: 'logistics', name: 'Logistics', desc: 'Fast conveyor belts move items twice as quickly.', packs: ['red-pack'], units: 20, time: 10, requires: [] },
  { id: 'military', name: 'Military', desc: 'Stone walls to slow the bugs down.', packs: ['red-pack'], units: 10, time: 15, requires: [] },
  { id: 'steel', name: 'Owen steel', desc: 'Smelt Owen plates into Owen steel. Unlocks steel crates.', packs: ['red-pack'], units: 50, time: 5, requires: [] },
  { id: 'green-science', name: 'Logistic science pack', desc: 'Unlocks the logistic (green) science pack.', packs: ['red-pack'], units: 40, time: 5, requires: ['automation', 'logistics'] },
  { id: 'fast-inserter', name: 'Fast robo arms', desc: 'Robo arms that swing almost three times faster.', packs: ['red-pack', 'green-pack'], units: 30, time: 15, requires: ['green-science'] },
  { id: 'solar', name: 'Solar energy', desc: 'Free power from the sun, during the day.', packs: ['red-pack', 'green-pack'], units: 100, time: 10, requires: ['green-science', 'steel'] },
  { id: 'military-science', name: 'Military science pack', desc: 'Unlocks the military (grey) science pack.', packs: ['red-pack', 'green-pack'], units: 30, time: 10, requires: ['military', 'steel', 'green-science'] },
  { id: 'weapon-damage', name: 'Owen bullet damage', desc: 'Your gun and gun turrets do 50% more damage.', packs: ['red-pack', 'green-pack', 'military-pack'], units: 50, time: 15, requires: ['military-science'] },
  { id: 'advanced-science', name: 'Advanced science pack', desc: 'Unlocks the advanced (blue) science pack.', packs: ['red-pack', 'green-pack'], units: 75, time: 15, requires: ['fast-inserter', 'steel'] },
  { id: 'rail-guns', name: 'Rail guns', desc: 'A handheld rail gun, rail gun turrets and rail slugs. Fires straight through whole swarms.', packs: ['red-pack', 'green-pack', 'military-pack', 'advanced-pack'], units: 75, time: 15, requires: ['military-science', 'advanced-science'] },
  { id: 'monument', name: 'The Great Owen', desc: 'Build a monument to Owen to finish the game.', packs: ['red-pack', 'green-pack', 'military-pack', 'advanced-pack'], units: 200, time: 15, requires: ['rail-guns', 'solar', 'weapon-damage'] },
];
/** Icon shown on each research card. */
export const TECH_ICON: Record<string, ItemId> = {
  automation: 'assembler', logistics: 'fast-belt', military: 'wall', steel: 'steel-plate', 'green-science': 'green-pack',
  'fast-inserter': 'fast-inserter', solar: 'solar-panel', 'military-science': 'military-pack', 'weapon-damage': 'owen-ammo',
  'advanced-science': 'advanced-pack', 'rail-guns': 'rail-gun', monument: 'owen-monument',
};
export const SCIENCE_PACKS: ItemId[] = ['red-pack', 'green-pack', 'military-pack', 'advanced-pack'];
export const TECH_BY_ID: Record<string, Tech> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export const PLAYER_START: [ItemId, number][] = [
  ['owen-plate', 8],
  ['wood', 4],
  ['burner-drill', 1],
  ['stone-furnace', 1],
  ['owen-ammo', 10],
];

/** How many ingredient crafts an assembler/furnace buffers before inserters stop feeding it. */
export const INPUT_BUFFER_CRAFTS = 2;
