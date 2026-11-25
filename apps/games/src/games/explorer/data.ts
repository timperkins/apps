// Everything Explorer knows about: items, recipes, buildings, animals and shops.
// Designed by Tim on two handwritten pages; numbers in quotes come straight from them.

export const WORLD = 1_000_000; // tiles around, both ways: go straight for a million tiles and you're back
export const CHUNK = 32;
export const WATER_LEVEL = 0;
export const DAY_LEN = 600; // seconds for a whole day (7 min day, 3 min night)
export const MONTH_DAYS = 30;

export type ItemId = string;

export interface ItemDef {
  name: string;
  icon: string; // emoji
  stack: number;
  /** Building it places. */
  build?: BuildId;
  weapon?: WeaponId;
  food?: number; // health it gives back
  fuel?: number; // seconds of burning
  sell?: number; // what the store pays
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { name: 'Wood', icon: '🪵', stack: 100, fuel: 4, sell: 2 },
  stone: { name: 'Stone', icon: '🪨', stack: 100, sell: 2 },
  coal: { name: 'Coal', icon: '⚫', stack: 100, fuel: 8, sell: 4 },
  iron_ore: { name: 'Iron ore', icon: '🟫', stack: 100, sell: 4 },
  copper_ore: { name: 'Copper ore', icon: '🟧', stack: 100, sell: 4 },
  sand: { name: 'Sand', icon: '🟨', stack: 100, sell: 1 },
  dirt: { name: 'Dirt', icon: '🟤', stack: 100, sell: 1 },
  snow: { name: 'Snowball', icon: '⚪', stack: 100, sell: 1 },
  iron: { name: 'Iron plate', icon: '⬜', stack: 100, sell: 7 },
  copper: { name: 'Copper plate', icon: '🟠', stack: 100, sell: 7 },
  steel: { name: 'Steel', icon: '🔩', stack: 100, sell: 20 },
  brick: { name: 'Brick', icon: '🧱', stack: 100, sell: 5 },
  gear: { name: 'Gear', icon: '⚙️', stack: 100, sell: 16 },
  copper_cable: { name: 'Copper cable', icon: '〰️', stack: 200, sell: 4 },
  iron_stick: { name: 'Iron stick', icon: '🥢', stack: 100, sell: 4 },
  circuit: { name: 'Circuit', icon: '🟩', stack: 100, sell: 22 },
  advanced_circuit: { name: 'Advanced circuit', icon: '🟥', stack: 100, sell: 60 },
  motor: { name: 'Electric motor', icon: '🌀', stack: 50, sell: 40 },
  engine_unit: { name: 'Engine', icon: '🔧', stack: 50, sell: 55 },
  battery: { name: 'Battery', icon: '🔋', stack: 100, sell: 25 },
  robot: { name: 'Flying robot', icon: '🛸', stack: 50, sell: 150 },
  plastic: { name: 'Plastic', icon: '🟪', stack: 100, sell: 12 },
  fuel: { name: 'Fuel', icon: '🛢️', stack: 50, fuel: 30, sell: 15 },
  oil: { name: 'Crude oil', icon: '🛢️', stack: 50, sell: 8 },
  carbon: { name: 'Carbon', icon: '◾', stack: 100, fuel: 10, sell: 6 },
  ice: { name: 'Ice', icon: '🧊', stack: 100, sell: 3 },
  crystal: { name: 'Crystal', icon: '💎', stack: 100, sell: 30 },
  water: { name: 'Water', icon: '💧', stack: 2000, sell: 0 },
  fur: { name: 'Fur', icon: '🧶', stack: 50, sell: 10 },
  bone: { name: 'Bone', icon: '🦴', stack: 50, sell: 6 },
  bug_shell: { name: 'Bug shell', icon: '🐚', stack: 50, sell: 25 },
  apple: { name: 'Apple', icon: '🍎', stack: 20, food: 10, sell: 2 },
  burger: { name: 'Burger', icon: '🍔', stack: 10, food: 35 },
  pizza: { name: 'Pizza', icon: '🍕', stack: 10, food: 60 },
  soup: { name: 'Soup', icon: '🍲', stack: 10, food: 20 },
  icecream: { name: 'Ice cream', icon: '🍦', stack: 10, food: 12 },
  // space
  space_unit: { name: 'Space unit', icon: '🛰️', stack: 50, sell: 60 },
  space_starter: { name: 'Space starter', icon: '🗝️', stack: 5 },
  thruster_fuel: { name: 'Thruster fuel', icon: '🧪', stack: 50 },
  rusty_rock: { name: 'Little rusty asteroid', icon: '🟤', stack: 50 },
  carbon_rock: { name: 'Little carbon asteroid', icon: '⚫', stack: 50 },
  cryser_rock: { name: 'Little cryser asteroid', icon: '🔷', stack: 50 },
  // weapons and ammo
  gun: { name: 'Gun', icon: '🔫', stack: 1, weapon: 'gun' },
  sniper: { name: 'Sniper', icon: '🎯', stack: 1, weapon: 'sniper' },
  flamethrower: { name: 'Flamethrower', icon: '🔥', stack: 1, weapon: 'flamethrower' },
  rocket_launcher: { name: 'Rocket launcher', icon: '🚀', stack: 1, weapon: 'rocket_launcher' },
  grenade: { name: 'Grenade', icon: '💣', stack: 20, weapon: 'grenade' },
  ammo: { name: 'Ammo', icon: '🟡', stack: 200 },
  advanced_ammo: { name: 'Advanced ammo', icon: '🔴', stack: 200 },
  rocket: { name: 'Rocket', icon: '🧨', stack: 50 },
  steel_pickaxe: { name: 'Steel pickaxe', icon: '⛏️', stack: 1 },
};

/** Things you can put down. Sizes are in tiles. */
export type BuildId =
  | 'chest' | 'furnace' | 'steel_furnace' | 'miner' | 'belt' | 'underground_belt' | 'grabber' | 'long_grabber' | 'bulk_grabber'
  | 'assembler' | 'power_pole' | 'big_power_pole' | 'substation' | 'steam_engine' | 'water_pump' | 'pipe' | 'underground_pipe'
  | 'pumpjack' | 'oil_refinery' | 'turret' | 'road' | 'roundabout' | 'stop_light' | 'house' | 'rocket_silo'
  | 'space_platform' | 'thruster' | 'crusher' | 'asteroid_grabber' | 'wall' | 'campfire' | 'torch' | 'roboport';

export interface BuildDef {
  name: string;
  size: number;
  hp: number;
  /** Uses electricity to run. */
  power?: number;
  /** Burns fuel (coal, wood...) to run. */
  burns?: boolean;
  /** Can go on a space platform. */
  space?: boolean;
  /** Only in space. */
  spaceOnly?: boolean;
  /** Walk over it (roads, belts, pipes). */
  flat?: boolean;
  /** Supply reach for power poles: wires reach `wire`, machines inside `area` get power. */
  wire?: number;
  area?: number;
  slots?: number;
  /** Roboports: robots build ghosts this many tiles around it. */
  robo?: number;
}

export const BUILDS: Record<BuildId, BuildDef> = {
  chest: { name: 'Chest', size: 1, hp: 100, slots: 32, space: true },
  furnace: { name: 'Furnace', size: 1, hp: 150, burns: true, space: true },
  steel_furnace: { name: 'Steel furnace', size: 1, hp: 300, burns: true, space: true },
  miner: { name: 'Miner (drill)', size: 1, hp: 200, power: 90, burns: true },
  belt: { name: 'Belt', size: 1, hp: 60, flat: true, space: true },
  underground_belt: { name: 'Underground belt', size: 1, hp: 100, flat: true, space: true },
  grabber: { name: 'Grabber', size: 1, hp: 60, power: 15, space: true },
  long_grabber: { name: 'Long grabber', size: 1, hp: 60, power: 20, space: true },
  bulk_grabber: { name: 'Bulk grabber', size: 1, hp: 80, power: 40, space: true },
  assembler: { name: 'Assembling machine', size: 1, hp: 250, power: 75, space: true },
  power_pole: { name: 'Power pole', size: 1, hp: 50, wire: 8, area: 3, space: true },
  big_power_pole: { name: 'Big power pole', size: 1, hp: 120, wire: 20, area: 2 },
  substation: { name: 'Substation (huge power pole)', size: 1, hp: 200, wire: 18, area: 9 },
  steam_engine: { name: 'Steam engine', size: 1, hp: 300, burns: true },
  water_pump: { name: 'Water pump', size: 1, hp: 100 },
  pipe: { name: 'Pipe', size: 1, hp: 60, flat: true },
  underground_pipe: { name: 'Underground pipe', size: 1, hp: 100, flat: true },
  pumpjack: { name: 'Pumpjack', size: 1, hp: 200, power: 90 },
  oil_refinery: { name: 'Oil refinery', size: 2, hp: 400, power: 200, space: true },
  turret: { name: 'Turret', size: 1, hp: 400, space: true, slots: 1 },
  road: { name: 'Road', size: 1, hp: 200, flat: true },
  roundabout: { name: 'Roundabout', size: 3, hp: 400, flat: true },
  stop_light: { name: 'Stop light', size: 1, hp: 80 },
  house: { name: 'House', size: 3, hp: 800, slots: 32 },
  rocket_silo: { name: 'Rocket silo', size: 3, hp: 2000 },
  space_platform: { name: 'Space platform', size: 1, hp: 200, flat: true, space: true, spaceOnly: true },
  thruster: { name: 'Thruster', size: 1, hp: 300, space: true, spaceOnly: true },
  crusher: { name: 'Crusher', size: 1, hp: 300, space: true },
  asteroid_grabber: { name: 'Asteroid grabber', size: 1, hp: 120, space: true, spaceOnly: true },
  wall: { name: 'Stone wall', size: 1, hp: 350, space: true },
  campfire: { name: 'Campfire', size: 1, hp: 50 },
  torch: { name: 'Torch', size: 1, hp: 30, space: true },
  roboport: { name: 'Roboport', size: 2, hp: 500, power: 50, space: true, slots: 10, robo: 25 },
};

// every building is also an item you carry
for (const [id, b] of Object.entries(BUILDS)) {
  const icons: Record<string, string> = {
    chest: '📦', furnace: '🔥', steel_furnace: '🏭', miner: '⛏️', belt: '➡️', underground_belt: '⤵️', grabber: '🦾', long_grabber: '🦿',
    bulk_grabber: '🤖', assembler: '🛠️', power_pole: '🔌', big_power_pole: '🗼', substation: '⚡', steam_engine: '♨️', water_pump: '🚰',
    pipe: '🪈', underground_pipe: '↘️', pumpjack: '🛢️', oil_refinery: '🏗️', turret: '🔫', road: '🛣️', roundabout: '⭕', stop_light: '🚦',
    house: '🏠', rocket_silo: '🚀', space_platform: '⬛', thruster: '🔥', crusher: '🪓', asteroid_grabber: '🧲', wall: '🧱', campfire: '🏕️', torch: '🕯️', roboport: '📡',
  };
  ITEMS[id] = { name: b.name, icon: icons[id] ?? '📦', stack: id === 'road' || id === 'belt' || id === 'pipe' || id === 'space_platform' || id === 'wall' ? 100 : 50, build: id as BuildId };
}

export interface Recipe {
  id: string;
  out: ItemId;
  n: number;
  inp: [ItemId, number][];
  time: number; // seconds by hand
  group: 'basics' | 'parts' | 'logistics' | 'power' | 'production' | 'town' | 'combat' | 'space';
}

const R = (out: ItemId, n: number, inp: [ItemId, number][], time: number, group: Recipe['group']): Recipe => ({ id: out, out, n, inp, time, group });

/** No research needed for anything. */
export const RECIPES: Recipe[] = [
  R('gear', 1, [['iron', 2]], 0.5, 'parts'),
  R('copper_cable', 2, [['copper', 1]], 0.4, 'parts'),
  R('iron_stick', 2, [['iron', 1]], 0.4, 'parts'),
  R('circuit', 1, [['iron', 1], ['copper_cable', 3]], 0.6, 'parts'),
  R('motor', 1, [['gear', 1], ['iron', 1], ['copper_cable', 3]], 1, 'parts'),
  R('engine_unit', 1, [['steel', 1], ['gear', 1], ['pipe', 2]], 1.5, 'parts'),
  R('battery', 1, [['iron', 1], ['copper', 1], ['coal', 1]], 1, 'parts'),
  R('advanced_circuit', 1, [['circuit', 2], ['plastic', 2], ['copper_cable', 4]], 2, 'parts'),
  R('chest', 1, [['wood', 8]], 0.5, 'basics'),
  R('furnace', 1, [['stone', 5]], 0.5, 'basics'),
  R('campfire', 1, [['wood', 5], ['stone', 3]], 0.5, 'basics'),
  R('torch', 2, [['wood', 1], ['coal', 1]], 0.3, 'basics'),
  R('wall', 2, [['stone', 5]], 0.5, 'basics'),
  R('steel_pickaxe', 1, [['steel', 5], ['wood', 2]], 1, 'basics'),
  R('steel_furnace', 1, [['brick', 20], ['iron', 10], ['circuit', 5]], 2, 'production'),
  R('miner', 1, [['circuit', 3], ['gear', 3], ['motor', 1], ['iron', 10]], 2, 'production'),
  R('assembler', 1, [['circuit', 3], ['gear', 3], ['motor', 1], ['iron', 9]], 2, 'production'),
  R('pumpjack', 1, [['steel', 5], ['engine_unit', 2], ['circuit', 5], ['pipe', 10]], 3, 'production'),
  R('oil_refinery', 1, [['steel', 15], ['gear', 10], ['circuit', 10], ['brick', 10], ['pipe', 10]], 5, 'production'),
  R('belt', 2, [['gear', 1], ['iron', 1]], 0.5, 'logistics'),
  R('underground_belt', 2, [['iron', 10], ['belt', 5]], 1, 'logistics'),
  R('grabber', 1, [['circuit', 1], ['gear', 1], ['iron', 1]], 0.5, 'logistics'),
  R('long_grabber', 1, [['grabber', 1], ['gear', 1], ['iron', 1]], 0.5, 'logistics'),
  R('bulk_grabber', 1, [['grabber', 1], ['gear', 5], ['circuit', 5]], 1, 'logistics'),
  R('pipe', 1, [['iron', 1]], 0.3, 'logistics'),
  R('robot', 1, [['motor', 1], ['battery', 2], ['circuit', 3], ['steel', 2]], 2, 'logistics'),
  R('roboport', 1, [['steel', 20], ['gear', 10], ['circuit', 10], ['battery', 5], ['motor', 4]], 4, 'logistics'),
  R('underground_pipe', 2, [['pipe', 5], ['iron', 5]], 1, 'logistics'),
  R('power_pole', 2, [['wood', 1], ['copper_cable', 2]], 0.5, 'power'),
  R('big_power_pole', 1, [['iron_stick', 4], ['steel', 2], ['copper_cable', 5]], 1, 'power'),
  R('substation', 1, [['steel', 10], ['circuit', 5], ['copper_cable', 10]], 2, 'power'),
  R('steam_engine', 1, [['gear', 8], ['pipe', 10], ['iron', 5]], 2, 'power'),
  R('water_pump', 1, [['circuit', 2], ['pipe', 1], ['gear', 1]], 1, 'power'),
  R('road', 4, [['stone', 2]], 0.3, 'town'),
  R('roundabout', 1, [['stone', 10]], 1, 'town'),
  R('stop_light', 1, [['iron', 2], ['circuit', 1]], 0.5, 'town'),
  R('house', 1, [['wood', 40], ['brick', 20]], 4, 'town'),
  R('turret', 1, [['gear', 10], ['copper', 10], ['iron', 20]], 2, 'combat'),
  R('ammo', 1, [['iron', 1]], 0.2, 'combat'),
  R('advanced_ammo', 1, [['ammo', 1], ['steel', 1], ['copper', 2]], 0.5, 'combat'),
  R('gun', 1, [['iron', 5], ['copper', 5]], 1, 'combat'),
  R('sniper', 1, [['steel', 10], ['gear', 5], ['circuit', 5]], 2, 'combat'),
  R('flamethrower', 1, [['steel', 5], ['gear', 10]], 2, 'combat'),
  R('rocket_launcher', 1, [['iron', 5], ['gear', 5], ['circuit', 5]], 2, 'combat'),
  R('rocket', 1, [['stone', 10], ['iron', 1]], 0.5, 'combat'),
  R('grenade', 1, [['coal', 5], ['iron', 5]], 0.8, 'combat'),
  R('rocket_silo', 1, [['stone', 1000], ['iron', 1000]], 10, 'space'),
  R('space_unit', 1, [['iron', 10], ['copper', 1]], 1, 'space'),
  R('space_starter', 1, [['steel', 10], ['advanced_circuit', 5], ['battery', 5]], 3, 'space'),
  R('space_platform', 1, [['steel', 2], ['iron', 5]], 0.5, 'space'),
  R('thruster', 1, [['steel', 10], ['engine_unit', 3], ['circuit', 5], ['pipe', 5]], 2, 'space'),
  R('thruster_fuel', 1, [['crystal', 1], ['water', 100]], 1, 'space'),
  R('crusher', 1, [['steel', 10], ['gear', 5], ['circuit', 5]], 2, 'space'),
  R('asteroid_grabber', 1, [['steel', 5], ['gear', 5], ['circuit', 5]], 1, 'space'),
];
export const RECIPE: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** What furnaces make. Steel only in the steel furnace. */
export const SMELT: Record<ItemId, { out: ItemId; n: number; time: number; steelOnly?: boolean }> = {
  iron_ore: { out: 'iron', n: 1, time: 2.4 },
  copper_ore: { out: 'copper', n: 1, time: 2.4 },
  stone: { out: 'brick', n: 1, time: 2.4 },
  sand: { out: 'brick', n: 1, time: 3 },
  iron: { out: 'steel', n: 1, time: 5, steelOnly: true },
};

/** Crusher results: "rusty little asteroids in a crusher make 96% chance copper, 80% chance iron" (as ore you smelt). */
export const CRUSH: Record<ItemId, [ItemId, number][]> = {
  rusty_rock: [['copper_ore', 0.96], ['iron_ore', 0.8]],
  carbon_rock: [['carbon', 0.98], ['stone', 1]],
  cryser_rock: [['ice', 1], ['crystal', 0.8]],
};

export type WeaponId = 'fist' | 'gun' | 'sniper' | 'flamethrower' | 'rocket_launcher' | 'grenade';
export interface WeaponDef { ammo: ItemId[]; dmg: number; range: number; cool: number; splash?: number; spread?: number; }
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fist: { ammo: [], dmg: 6, range: 2.6, cool: 0.45 },
  gun: { ammo: ['ammo', 'advanced_ammo'], dmg: 10, range: 30, cool: 0.22 },
  sniper: { ammo: ['advanced_ammo', 'ammo'], dmg: 70, range: 80, cool: 1.2 },
  flamethrower: { ammo: ['fuel'], dmg: 5, range: 9, cool: 0.08, spread: 0.35 },
  rocket_launcher: { ammo: ['rocket'], dmg: 60, range: 50, cool: 1, splash: 4 },
  grenade: { ammo: ['grenade'], dmg: 45, range: 18, cool: 0.8, splash: 4 },
};
export const AMMO_BONUS: Record<ItemId, number> = { advanced_ammo: 2.2 };

// ---------- biomes ----------
export type Biome = 'ocean' | 'beach' | 'plains' | 'forest' | 'desert' | 'snow' | 'pole' | 'mountain';
export const BIOME_NAME: Record<Biome, string> = {
  ocean: 'Ocean', beach: 'Beach', plains: 'Grassland', forest: 'Forest', desert: 'Desert', snow: 'Snowy land', pole: 'North Pole ice', mountain: 'Mountains',
};

// ---------- animals and other moving things ----------
export type MobShape = 'quad' | 'bug' | 'bird' | 'fish' | 'person' | 'bat' | 'snake';
export interface MobDef {
  name: string;
  shape: MobShape;
  hp: number;
  speed: number;
  dmg: number; // 0 = never attacks
  hostile: boolean; // attacks you on sight
  size: number;
  colors: [string, string, string?]; // body, details, extra
  biomes: Biome[] | 'cave' | 'none';
  night?: boolean; // only comes out at night
  drops: [ItemId, number, number][]; // item, min, max
  coins?: number;
  /** Fights alien bugs (and the bugs fight back). */
  huntsBugs?: boolean;
  sound: 'growl' | 'roar' | 'chirp' | 'squeak' | 'moo' | 'chitter' | 'hiss' | 'bark' | 'meow' | 'voice';
}

export const MOBS: Record<string, MobDef> = {
  panda: { name: 'Panda', shape: 'quad', hp: 40, speed: 1.6, dmg: 0, hostile: false, size: 1.2, colors: ['#f4f4f0', '#1d1d1d'], biomes: ['forest'], drops: [['fur', 1, 2]], sound: 'squeak' },
  deer: { name: 'Deer', shape: 'quad', hp: 25, speed: 4.5, dmg: 0, hostile: false, size: 1.1, colors: ['#a26b3c', '#f0dcc0'], biomes: ['forest', 'plains'], drops: [['fur', 1, 1], ['bone', 0, 1]], sound: 'squeak' },
  rabbit: { name: 'Rabbit', shape: 'quad', hp: 8, speed: 5, dmg: 0, hostile: false, size: 0.45, colors: ['#c9b49a', '#ffffff'], biomes: ['plains', 'forest', 'snow'], drops: [['fur', 0, 1]], sound: 'squeak' },
  cow: { name: 'Cow', shape: 'quad', hp: 35, speed: 1.4, dmg: 0, hostile: false, size: 1.3, colors: ['#ffffff', '#2a2a2a', '#f4a6b0'], biomes: ['plains'], drops: [['fur', 1, 2]], sound: 'moo' },
  camel: { name: 'Camel', shape: 'quad', hp: 45, speed: 2.2, dmg: 0, hostile: false, size: 1.5, colors: ['#d8b06a', '#a07c3e'], biomes: ['desert'], drops: [['fur', 1, 2]], sound: 'moo' },
  penguin: { name: 'Penguin', shape: 'bird', hp: 15, speed: 1.6, dmg: 0, hostile: false, size: 0.7, colors: ['#1d2330', '#ffffff', '#ffa31a'], biomes: ['snow', 'pole'], drops: [['bone', 0, 1]], sound: 'chirp' },
  goat: { name: 'Mountain goat', shape: 'quad', hp: 30, speed: 3, dmg: 0, hostile: false, size: 0.9, colors: ['#e9e4da', '#6b5a48'], biomes: ['mountain'], drops: [['fur', 1, 1]], sound: 'moo' },
  dolphin: { name: 'Dolphin', shape: 'fish', hp: 30, speed: 4, dmg: 0, hostile: false, size: 1.4, colors: ['#7d9bb5', '#dfe8ef'], biomes: ['ocean'], drops: [], sound: 'chirp' },
  bat: { name: 'Bat', shape: 'bat', hp: 6, speed: 4, dmg: 0, hostile: false, size: 0.5, colors: ['#3a2d38', '#d24b4b'], biomes: 'cave', drops: [], sound: 'squeak' },
  lion: { name: 'Lion', shape: 'quad', hp: 60, speed: 4.2, dmg: 10, hostile: true, size: 1.3, colors: ['#d9a54a', '#8a4b1a'], biomes: ['desert', 'plains'], drops: [['fur', 1, 3], ['bone', 1, 2]], coins: 12, huntsBugs: true, sound: 'roar' },
  polar_bear: { name: 'Polar bear', shape: 'quad', hp: 90, speed: 3.6, dmg: 14, hostile: true, size: 1.6, colors: ['#f5f7fa', '#c9d2dc'], biomes: ['pole', 'snow'], drops: [['fur', 2, 4], ['bone', 1, 2]], coins: 15, huntsBugs: true, sound: 'roar' },
  wolf: { name: 'Wolf', shape: 'quad', hp: 35, speed: 5, dmg: 7, hostile: true, size: 1, colors: ['#7a7f87', '#c7ccd2'], biomes: ['forest', 'plains', 'mountain'], night: true, drops: [['fur', 1, 2], ['bone', 0, 2]], coins: 8, huntsBugs: true, sound: 'growl' },
  snow_wolf: { name: 'Snow wolf', shape: 'quad', hp: 40, speed: 5.2, dmg: 8, hostile: true, size: 1, colors: ['#e8ecf0', '#9aa8b8'], biomes: ['snow', 'pole'], night: true, drops: [['fur', 1, 3]], coins: 9, huntsBugs: true, sound: 'growl' },
  bear: { name: 'Bear', shape: 'quad', hp: 80, speed: 3.6, dmg: 13, hostile: true, size: 1.5, colors: ['#5a3a22', '#2e1d10'], biomes: ['forest', 'mountain'], night: true, drops: [['fur', 2, 4], ['bone', 1, 2]], coins: 14, huntsBugs: true, sound: 'roar' },
  scorpion: { name: 'Giant scorpion', shape: 'bug', hp: 45, speed: 3.4, dmg: 9, hostile: true, size: 1.1, colors: ['#3b2a1a', '#c08a3e'], biomes: ['desert'], night: true, drops: [['bug_shell', 0, 1]], coins: 10, huntsBugs: true, sound: 'hiss' },
  shark: { name: 'Shark', shape: 'fish', hp: 70, speed: 4.5, dmg: 12, hostile: true, size: 2, colors: ['#5f6f7d', '#e7ecef'], biomes: ['ocean'], drops: [['bone', 1, 3]], coins: 14, sound: 'hiss' },
  cave_spider: { name: 'Cave spider', shape: 'bug', hp: 30, speed: 4, dmg: 6, hostile: true, size: 0.8, colors: ['#2a2230', '#c03a8a'], biomes: 'cave', drops: [['bug_shell', 0, 1]], coins: 7, sound: 'hiss' },
  snake: { name: 'Snake', shape: 'snake', hp: 20, speed: 2.6, dmg: 6, hostile: true, size: 0.9, colors: ['#5c8a2c', '#e0c040'], biomes: ['desert', 'forest'], night: true, drops: [], coins: 6, sound: 'hiss' },
  // alien bugs: leave you alone until you get close, hurt your base, and defend themselves
  bug: { name: 'Alien bug', shape: 'bug', hp: 30, speed: 3.6, dmg: 6, hostile: true, size: 0.9, colors: ['#5b2a7a', '#5ef2c4'], biomes: 'none', drops: [['bug_shell', 1, 1]], coins: 6, sound: 'chitter' },
  big_bug: { name: 'Big alien bug', shape: 'bug', hp: 90, speed: 3, dmg: 14, hostile: true, size: 1.6, colors: ['#7a2a4a', '#f2e45e'], biomes: 'none', drops: [['bug_shell', 2, 3], ['crystal', 0, 1]], coins: 18, sound: 'chitter' },
  // people
  villager: { name: 'Villager', shape: 'person', hp: 40, speed: 1.4, dmg: 0, hostile: false, size: 1, colors: ['#3d7fd9', '#f1c9a0', '#5a3a22'], biomes: 'none', drops: [], sound: 'voice' },
  cop: { name: 'Cop', shape: 'person', hp: 120, speed: 3.4, dmg: 12, hostile: false, size: 1, colors: ['#1d2a5a', '#e9c29c', '#111111'], biomes: 'none', drops: [], sound: 'voice' },
  // pets
  dog: { name: 'Dog', shape: 'quad', hp: 80, speed: 6, dmg: 9, hostile: false, size: 0.8, colors: ['#b07a3e', '#3b2410'], biomes: 'none', drops: [], sound: 'bark' },
  cat: { name: 'Cat', shape: 'quad', hp: 50, speed: 6, dmg: 5, hostile: false, size: 0.55, colors: ['#f0a040', '#fff4e0'], biomes: 'none', drops: [], sound: 'meow' },
  parrot: { name: 'Parrot', shape: 'bird', hp: 40, speed: 6, dmg: 6, hostile: false, size: 0.5, colors: ['#2fbf4a', '#e83a2a', '#ffd23f'], biomes: 'none', drops: [], sound: 'chirp' },
  tiger: { name: 'Tiger', shape: 'quad', hp: 200, speed: 6.5, dmg: 20, hostile: false, size: 1.3, colors: ['#f08a24', '#1d1d1d'], biomes: 'none', drops: [], sound: 'roar' },
  robo_dog: { name: 'Robot dog', shape: 'quad', hp: 350, speed: 7, dmg: 28, hostile: false, size: 0.9, colors: ['#b9c4cf', '#3fd2ff'], biomes: 'none', drops: [], sound: 'bark' },
};

// ---------- village shops ----------
export type ShopKind = 'store' | 'restaurant' | 'cars' | 'homes' | 'pets' | 'police';
export const SHOP_NAME: Record<ShopKind, string> = {
  store: 'General Store', restaurant: 'Restaurant', cars: 'Car Rental & Sales', homes: 'Houses for Sale', pets: 'Pet Shop', police: 'Police Station',
};
/** What the general store sells you (price each). It buys anything with a `sell` price. */
export const STORE_STOCK: [ItemId, number][] = [
  ['wood', 5], ['stone', 5], ['coal', 8], ['iron', 14], ['copper', 14], ['gear', 32], ['circuit', 45], ['ammo', 4], ['torch', 6],
  ['chest', 20], ['furnace', 20], ['gun', 120], ['grenade', 25], ['belt', 18], ['power_pole', 12], ['apple', 4],
];
export const FOOD_MENU: [ItemId, number][] = [['burger', 15], ['pizza', 25], ['soup', 10], ['icecream', 8]];

export type CarId = 'buggy' | 'hatchback' | 'truck' | 'sports';
export const CARS: Record<CarId, { name: string; speed: number; color: string; buy: number; rent: number }> = {
  buggy: { name: 'Dune buggy', speed: 14, color: '#e8b62c', buy: 1200, rent: 120 },
  hatchback: { name: 'Hatchback', speed: 18, color: '#3a7bd5', buy: 2000, rent: 180 },
  truck: { name: 'Pickup truck', speed: 17, color: '#c0392b', buy: 3500, rent: 260 },
  sports: { name: 'Sports car', speed: 28, color: '#ff2e7e', buy: 8000, rent: 600 },
};

export const HOMES = [
  { id: 'cabin', name: 'Little cabin', size: 3, price: 1500, color: '#a0703c' },
  { id: 'cottage', name: 'Cottage', size: 4, price: 4500, color: '#e3d7b8' },
  { id: 'family', name: 'Family house', size: 5, price: 10000, color: '#7fb2d9' },
  { id: 'mansion', name: 'Mansion', size: 7, price: 30000, color: '#f2f0ea' },
] as const;
export type HomeId = (typeof HOMES)[number]['id'];

export const PETS: [string, number][] = [['cat', 300], ['dog', 500], ['parrot', 800], ['tiger', 3000], ['robo_dog', 6000]];

// ---------- space ----------
export type RockKind = 'rusty' | 'carbon' | 'cryser';
export type RockSize = 0 | 1 | 2 | 3; // little, medium, big, huge
export const ROCK_SIZE_NAME = ['Little', 'Medium', 'Big', 'Huge'];
export const ROCK_HP = [1, 40, 120, 400];
export const ROCK_ITEM: Record<RockKind, ItemId> = { rusty: 'rusty_rock', carbon: 'carbon_rock', cryser: 'cryser_rock' };
export const ROCK_COLOR: Record<RockKind, string> = { rusty: '#a55a33', carbon: '#35363b', cryser: '#7fc8ef' };

export const DESTINATIONS = [
  { id: 'orbit', name: 'Earth orbit', dist: 0, mix: [0.4, 0.4, 0.2], planet: '#3f7fd9' },
  { id: 'moon', name: 'The Moon', dist: 3000, mix: [0.3, 0.5, 0.2], planet: '#c8c8c8' },
  { id: 'mars', name: 'Mars', dist: 9000, mix: [0.7, 0.2, 0.1], planet: '#c1502e' },
  { id: 'belt', name: 'Asteroid belt', dist: 18000, mix: [0.35, 0.35, 0.3], planet: '#8a7d70' },
  { id: 'jupiter', name: 'Jupiter', dist: 40000, mix: [0.2, 0.3, 0.5], planet: '#d9a066' },
] as const;
export const SPACE_UNITS_TO_LAUNCH = 10;
export const SILO_CARGO = 100;
export const THRUSTER_SPEED = 40; // km a second per thruster, up to 8 thrusters
export const FUEL_KM = 400; // how far one thruster fuel goes

export const START_MONEY = 150;
export const MAX_HP = 100;
