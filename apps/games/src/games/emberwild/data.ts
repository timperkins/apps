// Emberwild: items, blocks, recipes and the beacons' requests.

export type ItemId =
  | 'wood' | 'stone' | 'coal' | 'copper_ore' | 'iron_ore' | 'crystal' | 'sand'
  | 'plank' | 'brick' | 'glass' | 'copper' | 'iron' | 'steel' | 'gear' | 'wire' | 'circuit' | 'lens'
  | 'arrow' | 'berries' | 'apple' | 'mushroom' | 'meat' | 'roast' | 'stew' | 'gloom' | 'ember_core'
  | 'campfire' | 'lamp' | 'belt' | 'drill' | 'furnace' | 'assembler' | 'chest' | 'sky_engine'
  | 'pick_stone' | 'pick_iron' | 'pick_crystal' | 'sword_stone' | 'sword_iron' | 'sword_crystal' | 'bow';

export interface ItemDef {
  name: string;
  /** what it places: a block id or a machine kind */
  block?: number;
  machine?: MachineKind;
  heal?: number; // half hearts
  fuel?: number; // smelts per item
  tool?: boolean; // tools are owned, not stacked into the hotbar
}

export type MachineKind = 'belt' | 'drill' | 'furnace' | 'assembler' | 'chest' | 'campfire' | 'lamp' | 'sky_engine';

// ---- ground ----
export const G = {
  WATER: 0, GRASS: 1, SAND: 2, SNOW: 3, FOREST: 4, ROCKY: 5, DEEP: 6,
  V_COAL: 7, V_COPPER: 8, V_IRON: 9, V_CRYSTAL: 10, PATH: 11, RUIN: 12,
} as const;
export const VEIN_ORE: Record<number, ItemId> = { 7: 'coal', 8: 'copper_ore', 9: 'iron_ore', 10: 'crystal' };
export const isWater = (g: number) => g === G.WATER || g === G.DEEP;

// ---- blocks (things standing on a tile) ----
export const B = {
  NONE: 0, TREE: 1, PINE: 2, ROCK: 3, COAL: 4, COPPER: 5, IRON: 6, CRYSTAL: 7, CACTUS: 8, BUSH: 9,
  PLANK: 10, BRICK: 11, GLASS: 12, COBBLE: 13, MUSHROOM: 14, PALM: 15, SNOWROCK: 16, RUINWALL: 17,
} as const;

export interface BlockDef {
  name: string;
  hard: number; // seconds to mine with bare hands
  tier: number; // pickaxe tier needed (0 hands, 1 stone, 2 iron, 3 crystal)
  drops: [ItemId, number][];
  solid: boolean;
  item?: ItemId; // the item that placed it, given back
  vein?: number; // ground left behind
  unbreakable?: boolean;
}

export const BLOCKS: Record<number, BlockDef> = {
  [B.TREE]: { name: 'Oak', hard: 1.6, tier: 0, drops: [['wood', 3]], solid: true },
  [B.PINE]: { name: 'Pine', hard: 1.8, tier: 0, drops: [['wood', 3]], solid: true },
  [B.PALM]: { name: 'Palm', hard: 1.4, tier: 0, drops: [['wood', 2]], solid: true },
  [B.ROCK]: { name: 'Rock', hard: 2.4, tier: 0, drops: [['stone', 2]], solid: true },
  [B.SNOWROCK]: { name: 'Frosted rock', hard: 2.8, tier: 0, drops: [['stone', 2]], solid: true },
  [B.COAL]: { name: 'Coal seam', hard: 2.6, tier: 0, drops: [['coal', 3]], solid: true, vein: G.V_COAL },
  [B.COPPER]: { name: 'Copper seam', hard: 3, tier: 1, drops: [['copper_ore', 3]], solid: true, vein: G.V_COPPER },
  [B.IRON]: { name: 'Iron seam', hard: 3.4, tier: 1, drops: [['iron_ore', 3]], solid: true, vein: G.V_IRON },
  [B.CRYSTAL]: { name: 'Sky crystal', hard: 4, tier: 2, drops: [['crystal', 2]], solid: true, vein: G.V_CRYSTAL },
  [B.CACTUS]: { name: 'Cactus', hard: 0.8, tier: 0, drops: [['sand', 1]], solid: true },
  [B.BUSH]: { name: 'Berry bush', hard: 0.4, tier: 0, drops: [['berries', 2]], solid: false },
  [B.MUSHROOM]: { name: 'Mushroom', hard: 0.3, tier: 0, drops: [['mushroom', 1]], solid: false },
  [B.PLANK]: { name: 'Plank block', hard: 1, tier: 0, drops: [['plank', 1]], solid: true, item: 'plank' },
  [B.BRICK]: { name: 'Stone brick', hard: 1.8, tier: 0, drops: [['brick', 1]], solid: true, item: 'brick' },
  [B.GLASS]: { name: 'Glass block', hard: 0.8, tier: 0, drops: [['glass', 1]], solid: true, item: 'glass' },
  [B.COBBLE]: { name: 'Cobblestone', hard: 1.6, tier: 0, drops: [['stone', 1]], solid: true, item: 'stone' },
  [B.RUINWALL]: { name: 'Old wall', hard: 99, tier: 9, drops: [], solid: true, unbreakable: true },
};

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { name: 'Wood', fuel: 1 },
  stone: { name: 'Stone', block: B.COBBLE },
  coal: { name: 'Coal', fuel: 4 },
  copper_ore: { name: 'Copper ore' },
  iron_ore: { name: 'Iron ore' },
  crystal: { name: 'Sky crystal' },
  sand: { name: 'Sand' },
  plank: { name: 'Planks', block: B.PLANK, fuel: 1 },
  brick: { name: 'Stone brick', block: B.BRICK },
  glass: { name: 'Glass', block: B.GLASS },
  copper: { name: 'Copper plate' },
  iron: { name: 'Iron plate' },
  steel: { name: 'Steel' },
  gear: { name: 'Gear' },
  wire: { name: 'Copper wire' },
  circuit: { name: 'Circuit' },
  lens: { name: 'Crystal lens' },
  arrow: { name: 'Arrows' },
  berries: { name: 'Berries', heal: 1 },
  apple: { name: 'Apple', heal: 1 },
  mushroom: { name: 'Mushroom', heal: 1 },
  meat: { name: 'Raw meat', heal: 1 },
  roast: { name: 'Roast', heal: 4 },
  stew: { name: 'Forest stew', heal: 8 },
  gloom: { name: 'Gloom dust' },
  ember_core: { name: 'Ember core' },
  campfire: { name: 'Campfire', machine: 'campfire' },
  lamp: { name: 'Lamp', machine: 'lamp' },
  belt: { name: 'Belt', machine: 'belt' },
  drill: { name: 'Drill', machine: 'drill' },
  furnace: { name: 'Furnace', machine: 'furnace' },
  assembler: { name: 'Assembler', machine: 'assembler' },
  chest: { name: 'Chest', machine: 'chest' },
  sky_engine: { name: 'Sky Engine', machine: 'sky_engine' },
  pick_stone: { name: 'Stone pickaxe', tool: true },
  pick_iron: { name: 'Iron pickaxe', tool: true },
  pick_crystal: { name: 'Crystal pickaxe', tool: true },
  sword_stone: { name: 'Stone sword', tool: true },
  sword_iron: { name: 'Iron sword', tool: true },
  sword_crystal: { name: 'Crystal blade', tool: true },
  bow: { name: 'Bow', tool: true },
};

export const PICKS: [ItemId, number, number][] = [
  // item, tier, speed multiplier
  ['pick_crystal', 3, 4],
  ['pick_iron', 2, 2.6],
  ['pick_stone', 1, 1.7],
];
export const SWORDS: [ItemId, number][] = [
  ['sword_crystal', 9],
  ['sword_iron', 5],
  ['sword_stone', 3],
];
export const FIST_DAMAGE = 1;

// ---- recipes ----
export interface Recipe {
  out: ItemId;
  n: number;
  inp: [ItemId, number][];
  time: number; // seconds in an assembler
  hand?: boolean; // false: assembler only
  needs?: 'campfire';
  locked?: 'engine';
}

export const RECIPES: Recipe[] = [
  { out: 'plank', n: 2, inp: [['wood', 1]], time: 0.5 },
  { out: 'campfire', n: 1, inp: [['wood', 4], ['stone', 2]], time: 1 },
  { out: 'pick_stone', n: 1, inp: [['wood', 3], ['stone', 4]], time: 2 },
  { out: 'sword_stone', n: 1, inp: [['wood', 2], ['stone', 5]], time: 2 },
  { out: 'furnace', n: 1, inp: [['stone', 10]], time: 2 },
  { out: 'chest', n: 1, inp: [['plank', 8]], time: 1 },
  { out: 'bow', n: 1, inp: [['wood', 5], ['wire', 4]], time: 2 },
  { out: 'arrow', n: 8, inp: [['wood', 1], ['stone', 1]], time: 1 },
  { out: 'gear', n: 1, inp: [['iron', 2]], time: 1 },
  { out: 'wire', n: 2, inp: [['copper', 1]], time: 0.5 },
  { out: 'circuit', n: 1, inp: [['iron', 1], ['wire', 3]], time: 1.5 },
  { out: 'lens', n: 1, inp: [['crystal', 1], ['glass', 2]], time: 2 },
  { out: 'belt', n: 4, inp: [['gear', 1], ['iron', 1]], time: 1 },
  { out: 'drill', n: 1, inp: [['gear', 3], ['iron', 5], ['stone', 6]], time: 3 },
  { out: 'assembler', n: 1, inp: [['circuit', 3], ['gear', 5], ['iron', 8]], time: 4 },
  { out: 'lamp', n: 1, inp: [['copper', 2], ['glass', 1], ['coal', 1]], time: 1 },
  { out: 'pick_iron', n: 1, inp: [['wood', 2], ['iron', 6]], time: 3 },
  { out: 'sword_iron', n: 1, inp: [['wood', 2], ['iron', 8]], time: 3 },
  { out: 'pick_crystal', n: 1, inp: [['steel', 4], ['crystal', 6]], time: 4 },
  { out: 'sword_crystal', n: 1, inp: [['steel', 6], ['crystal', 8], ['gloom', 4]], time: 4 },
  { out: 'roast', n: 1, inp: [['meat', 1]], time: 2, needs: 'campfire' },
  { out: 'stew', n: 1, inp: [['mushroom', 2], ['berries', 2], ['meat', 1]], time: 3, needs: 'campfire' },
  { out: 'sky_engine', n: 1, inp: [['ember_core', 4], ['circuit', 60], ['steel', 40], ['lens', 20]], time: 10, locked: 'engine' },
];

// furnace: input -> output (amount of input used)
export const SMELT: Partial<Record<ItemId, { out: ItemId; use: number; time: number }>> = {
  copper_ore: { out: 'copper', use: 1, time: 2 },
  iron_ore: { out: 'iron', use: 1, time: 2.4 },
  iron: { out: 'steel', use: 3, time: 5 },
  sand: { out: 'glass', use: 2, time: 2 },
  stone: { out: 'brick', use: 2, time: 2 },
};

// ---- the four beacons ----
export interface BeaconDef {
  id: string;
  name: string;
  biome: string;
  dx: number;
  dy: number; // target offset from the centre (tiles)
  want: [ItemId, number][];
  hint: string;
}
export const BEACONS: BeaconDef[] = [
  {
    id: 'meadow', name: 'Meadow Beacon', biome: 'meadows', dx: -46, dy: 6,
    want: [['brick', 20], ['copper', 20]],
    hint: 'Smelt stone into bricks and copper ore into plates in a furnace.',
  },
  {
    id: 'grove', name: 'Grove Beacon', biome: 'deep forest', dx: 84, dy: -12,
    want: [['gear', 40], ['iron', 40]],
    hint: 'Lots of iron: drills on an iron vein, belts into a furnace.',
  },
  {
    id: 'dune', name: 'Dune Beacon', biome: 'desert', dx: 12, dy: 112,
    want: [['circuit', 40], ['glass', 30]],
    hint: 'Circuits need wire and iron. An assembler can make them for you.',
  },
  {
    id: 'frost', name: 'Frost Beacon', biome: 'snowy peaks', dx: -20, dy: -120,
    want: [['lens', 20], ['steel', 30]],
    hint: 'Sky crystal grows in the snowy peaks. Steel is iron plates smelted again.',
  },
];

export const WORLD = 340; // tiles per side
export const DAY_LEN = 360; // seconds for a full day
export const BELT_SPEED = 1.6; // tiles per second
export const DRILL_TIME = 3; // seconds per ore
