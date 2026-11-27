// Static game data: items, recipes, buildings and research for Factori-owen.
import { ADV_RECIPES, ADV_START, ADV_TECH_ICON, ADV_TECHS } from './advanced';

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
  | 'owen-ammo' | 'rail-ammo' | 'rail-gun' | 'gun-turret' | 'rail-turret' | 'wall'
  | 'stone-path' | 'steel-furnace' | 'electric-furnace' | 'splitter' | 'underground-belt' | 'lamp'
  | 'express-belt' | 'assembler-2' | 'big-pole' | 'battery-bank' | 'filter-inserter' | 'steel-wall'
  | 'grenade' | 'land-mine' | 'helper-drone'
  | 'armor-1' | 'armor-2' | 'armor-3' | 'armor-4' | 'armor-5'
  | 'eq-solar' | 'eq-battery' | 'eq-core' | 'eq-laser' | 'eq-shield' | 'eq-legs' | 'eq-night'
  // advanced mode
  | 'water' | 'crude-oil' | 'heavy-oil' | 'light-oil' | 'lubricant' | 'sulfuric-acid'
  | 'pipe' | 'underground-pipe' | 'offshore-pump' | 'steam-engine' | 'pumpjack' | 'refinery' | 'storage-tank'
  | 'crafter' | 'big-lab' | 'plastic' | 'sulfur' | 'solid-fuel' | 'rocket-fuel' | 'adv-circuit'
  | 'rocket-part' | 'rocket-silo' | 'rocket' | 'rocket-launcher' | 'flamethrower' | 'flame-ammo' | 'sniper' | 'piercing-ammo'
  | 'fast-underground' | 'fast-splitter' | 'roboport' | 'robot' | 'armor-0' | 'eq-goggles'
  | 'platform-kit' | 'catcher' | 'crusher' | 'thruster' | 'ice' | 'cryser-crystal';

export type Category = 'logistics' | 'production' | 'intermediate' | 'science' | 'military' | 'armor';

export interface ItemDef {
  id: ItemId;
  name: string;
  stack: number;
  fuel?: number; // joules
  place?: EntityType;
  category: Category;
  desc?: string;
  /** Lives only in pipes and machines, never in your hands. */
  fluid?: boolean;
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
  'stone-path': { id: 'stone-path', name: 'Stone path', stack: 100, place: 'stone-path', category: 'logistics', desc: 'Walk 30% faster on it.' },
  'steel-furnace': { id: 'steel-furnace', name: 'Steel furnace', stack: 50, place: 'steel-furnace', category: 'production', desc: 'Smelts twice as fast as a stone furnace.' },
  'electric-furnace': { id: 'electric-furnace', name: 'Electric furnace', stack: 50, place: 'electric-furnace', category: 'production', desc: 'Smelts twice as fast, using power instead of fuel.' },
  'splitter': { id: 'splitter', name: 'Belt splitter', stack: 50, place: 'splitter', category: 'logistics', desc: 'Two tiles wide. Takes items from the belts behind it and hands them out in turn to the two belts in front.' },
  'underground-belt': { id: 'underground-belt', name: 'Underground belt', stack: 50, place: 'underground-belt', category: 'logistics', desc: 'Place two facing the same way, up to 4 tiles apart. Items go in the first and come out the second.' },
  'lamp': { id: 'lamp', name: 'Lamp', stack: 50, place: 'lamp', category: 'logistics', desc: 'Lights up the area at night. Needs power.' },
  'express-belt': { id: 'express-belt', name: 'Express belt', stack: 100, place: 'express-belt', category: 'logistics', desc: 'Three times as fast as a normal belt.' },
  'assembler-2': { id: 'assembler-2', name: 'Assembler 2', stack: 50, place: 'assembler-2', category: 'production', desc: 'Crafts twice as fast as an assembler.' },
  'big-pole': { id: 'big-pole', name: 'Big power pole', stack: 50, place: 'big-pole', category: 'logistics', desc: 'Wires reach 28 tiles to other big poles.' },
  'battery-bank': { id: 'battery-bank', name: 'Battery bank', stack: 50, place: 'battery-bank', category: 'production', desc: 'Stores spare power and gives it back when you need it, like at night.' },
  'filter-inserter': { id: 'filter-inserter', name: 'Filter arm', stack: 50, place: 'filter-inserter', category: 'logistics', desc: 'A fast robo arm that only moves the item you pick.' },
  'steel-wall': { id: 'steel-wall', name: 'Steel wall', stack: 100, place: 'steel-wall', category: 'military', desc: 'Three times as tough as a stone wall.' },
  'grenade': { id: 'grenade', name: 'Grenade', stack: 50, category: 'military', desc: 'Press G to throw one at the mouse. Blows up every bug nearby.' },
  'land-mine': { id: 'land-mine', name: 'Land mine', stack: 100, place: 'land-mine', category: 'military', desc: 'Hidden trap that blows up bugs that walk over it.' },
  'helper-drone': { id: 'helper-drone', name: 'Helper drone', stack: 1, category: 'military', desc: 'Keep it in your inventory and it flies along with you, shooting bugs.' },
  'armor-1': { id: 'armor-1', name: 'Owen vest', stack: 1, category: 'armor', desc: 'Armor: blocks 15% of damage. 2×2 personal grid.' },
  'armor-2': { id: 'armor-2', name: 'Owen plate armor', stack: 1, category: 'armor', desc: 'Armor: blocks 30% of damage. 3×3 personal grid.' },
  'armor-3': { id: 'armor-3', name: 'Steel armor', stack: 1, category: 'armor', desc: 'Armor: blocks 45% of damage. 4×4 personal grid.' },
  'armor-4': { id: 'armor-4', name: 'Power suit', stack: 1, category: 'armor', desc: 'Armor: blocks 55% of damage. 5×5 personal grid.' },
  'armor-5': { id: 'armor-5', name: 'Power suit Mk2', stack: 1, category: 'armor', desc: 'Armor: blocks 65% of damage. 7×7 personal grid.' },
  'eq-solar': { id: 'eq-solar', name: 'Personal solar panel', stack: 20, category: 'armor', desc: 'Grid 1×1. Makes 30 kW for your suit in daylight.' },
  'eq-battery': { id: 'eq-battery', name: 'Personal battery', stack: 20, category: 'armor', desc: 'Grid 1×2. Stores 20 MJ for your suit.' },
  'eq-core': { id: 'eq-core', name: 'Owen power core', stack: 20, category: 'armor', desc: 'Grid 2×2. Makes 750 kW for your suit, day and night.' },
  'eq-laser': { id: 'eq-laser', name: 'Personal laser', stack: 20, category: 'armor', desc: 'Grid 2×2. Zaps the nearest bug within 12 tiles, using suit power.' },
  'eq-shield': { id: 'eq-shield', name: 'Energy shield', stack: 20, category: 'armor', desc: 'Grid 2×2. Soaks up 60 damage before it reaches you, and recharges from suit power.' },
  'eq-legs': { id: 'eq-legs', name: 'Exo legs', stack: 20, category: 'armor', desc: 'Grid 2×3. Walk 30% faster while your suit has power.' },
  'eq-night': { id: 'eq-night', name: 'Night vision', stack: 20, category: 'armor', desc: 'Grid 2×2. See clearly at night while your suit has power.' },
  // ---------- advanced mode ----------
  'water': { id: 'water', name: 'Water', stack: 1, category: 'intermediate', fluid: true, desc: 'Pumped out of a lake by an offshore pump. Flows through pipes.' },
  'crude-oil': { id: 'crude-oil', name: 'Crude oil', stack: 1, category: 'intermediate', fluid: true, desc: 'Pumped out of an oil patch by a pump jack. An oil refinery turns it into heavy and light oil.' },
  'heavy-oil': { id: 'heavy-oil', name: 'Heavy oil', stack: 1, category: 'intermediate', fluid: true, desc: 'Made from crude oil in an oil refinery.' },
  'light-oil': { id: 'light-oil', name: 'Light oil', stack: 1, category: 'intermediate', fluid: true, desc: 'Made from crude oil in an oil refinery.' },
  'lubricant': { id: 'lubricant', name: 'Lubricant', stack: 1, category: 'intermediate', fluid: true, desc: 'Slippery! Express belts need it.' },
  'sulfuric-acid': { id: 'sulfuric-acid', name: 'Sulfuric acid', stack: 1, category: 'intermediate', fluid: true, desc: 'Robots need it.' },
  'pipe': { id: 'pipe', name: 'Pipe', stack: 100, place: 'pipe', category: 'logistics', desc: 'Carries water and oil. Pipes next to each other join up, so keep different liquids apart.' },
  'underground-pipe': { id: 'underground-pipe', name: 'Underground pipe', stack: 50, place: 'underground-pipe', category: 'logistics', desc: 'Place two in a line, up to 10 tiles apart: the liquid goes under everything between them.' },
  'offshore-pump': { id: 'offshore-pump', name: 'Offshore pump', stack: 20, place: 'offshore-pump', category: 'production', desc: 'Build it on the shore, next to water. It pumps water into the pipes beside it. No power needed.' },
  'steam-engine': { id: 'steam-engine', name: 'Steam engine', stack: 10, place: 'steam-engine', category: 'production', desc: 'Makes power from water and fuel. Uses half the coal a coal generator does. Connect a water pipe to it.' },
  'pumpjack': { id: 'pumpjack', name: 'Pump jack', stack: 20, place: 'pumpjack', category: 'production', desc: 'Build it on an oil patch. Pumps crude oil into the pipes beside it. Needs power.' },
  'refinery': { id: 'refinery', name: 'Oil refinery', stack: 10, place: 'refinery', category: 'production', desc: 'Turns crude oil into heavy and light oil, then into plastic, sulfur, sulfuric acid, lubricant and solid fuel. Liquids go in and out through pipes beside it.' },
  'storage-tank': { id: 'storage-tank', name: 'Pipe container', stack: 20, place: 'storage-tank', category: 'logistics', desc: 'A big tank that holds 2,500 of one liquid. It joins the pipes beside it.' },
  'crafter': { id: 'crafter', name: 'Crafter', stack: 50, place: 'crafter', category: 'production', desc: 'A 2×2 machine that crafts things for you. Pick a recipe and feed it with robo arms. It can take liquids from pipes too.' },
  'big-lab': { id: 'big-lab', name: 'Science lab', stack: 10, place: 'big-lab', category: 'production', desc: 'A 2×2 lab. Feed it science packs to research.' },
  'plastic': { id: 'plastic', name: 'Plastic bar', stack: 100, category: 'intermediate', desc: 'Made in an oil refinery from light oil and coal.' },
  'sulfur': { id: 'sulfur', name: 'Sulfur', stack: 50, category: 'intermediate', desc: 'Made in an oil refinery from heavy oil and water.' },
  'solid-fuel': { id: 'solid-fuel', name: 'Solid fuel', stack: 50, fuel: 12e6, category: 'intermediate', desc: 'Burns three times as long as coal.' },
  'rocket-fuel': { id: 'rocket-fuel', name: 'Rocket fuel', stack: 10, fuel: 100e6, category: 'intermediate', desc: 'A rocket needs 10 to fly. It also burns for a very long time.' },
  'adv-circuit': { id: 'adv-circuit', name: 'Advanced circuit', stack: 200, category: 'intermediate', desc: 'The red chip.' },
  'rocket-part': { id: 'rocket-part', name: 'Rocket part', stack: 10, category: 'intermediate', desc: 'Put 10 in a rocket silo, with 10 rocket fuel, to build a rocket.' },
  'rocket-silo': { id: 'rocket-silo', name: 'Rocket silo', stack: 1, place: 'rocket-silo', category: 'production', desc: 'Builds rockets from 10 rocket parts and 10 rocket fuel, and launches them with whatever you put in the payload.' },
  'rocket': { id: 'rocket', name: 'Rocket', stack: 100, category: 'military', desc: 'Ammo for the rocket launcher. Blows up everything where it lands.' },
  'rocket-launcher': { id: 'rocket-launcher', name: 'Rocket launcher', stack: 1, category: 'military', desc: 'Carry it with rockets and pick it with X. Hold Space to fire.' },
  'flamethrower': { id: 'flamethrower', name: 'Flamethrower', stack: 1, category: 'military', desc: 'Short range, but it burns every bug in front of you. Carry flame ammo and pick it with X.' },
  'flame-ammo': { id: 'flame-ammo', name: 'Flame ammo', stack: 100, category: 'military', desc: 'Fuel for the flamethrower. Made in a crafter from crude oil.' },
  'sniper': { id: 'sniper', name: 'Sniper rifle', stack: 1, category: 'military', desc: 'Very long range and hits hard, but slow. Uses the bullets in your gun. Pick it with X.' },
  'piercing-ammo': { id: 'piercing-ammo', name: 'Red bullets', stack: 200, category: 'military', desc: 'A magazine of 10 bullets that do twice the damage. Your gun and gun turrets use them first.' },
  'fast-underground': { id: 'fast-underground', name: 'Fast underground belt', stack: 50, place: 'fast-underground', category: 'logistics', desc: 'A twice-as-fast underground belt. Place two facing the same way, up to 4 tiles apart.' },
  'fast-splitter': { id: 'fast-splitter', name: 'Fast splitter', stack: 50, place: 'fast-splitter', category: 'logistics', desc: 'A splitter for fast belts.' },
  'roboport': { id: 'roboport', name: 'Roboport', stack: 10, place: 'roboport', category: 'logistics', desc: 'Put robots in it. They fix damaged buildings within 25 tiles, and rebuild ones the bugs destroy using items from crates nearby.' },
  'robot': { id: 'robot', name: 'Robot', stack: 50, category: 'logistics', desc: 'A little flying helper. Put it in a roboport.' },
  'armor-0': { id: 'armor-0', name: 'Owen armor', stack: 1, category: 'armor', desc: 'Armor: blocks 10% of damage. Room for one tile of equipment, like night vision goggles.' },
  'eq-goggles': { id: 'eq-goggles', name: 'Night vision goggles', stack: 20, category: 'armor', desc: 'Grid 1×1. See clearly at night. No power needed.' },
  'platform-kit': { id: 'platform-kit', name: 'Space platform starter pack', stack: 1, category: 'production', desc: 'Put it in a rocket silo payload and launch it to start a space platform.' },
  'catcher': { id: 'catcher', name: 'Asteroid catcher', stack: 20, category: 'production', desc: 'Goes on the space platform and catches little asteroids that fly past.' },
  'crusher': { id: 'crusher', name: 'Crusher', stack: 20, category: 'production', desc: 'Goes on the space platform and turns caught asteroids into ore, ice and crystals.' },
  'thruster': { id: 'thruster', name: 'Thruster', stack: 20, category: 'production', desc: 'Goes on the space platform and burns ice to fly it into deep space, where cryser asteroids are common.' },
  'ice': { id: 'ice', name: 'Ice', stack: 50, category: 'intermediate', desc: 'Crushed out of cryser asteroids. Thrusters burn it.' },
  'cryser-crystal': { id: 'cryser-crystal', name: 'Cryser crystal', stack: 50, category: 'intermediate', desc: 'A glowing crystal from cryser asteroids. Only found in space.' },
};

export type EntityType =
  | 'wooden-chest' | 'owen-chest' | 'steel-chest'
  | 'belt' | 'fast-belt'
  | 'burner-inserter' | 'inserter' | 'long-inserter' | 'fast-inserter'
  | 'burner-drill' | 'electric-drill'
  | 'stone-furnace' | 'assembler' | 'lab'
  | 'pole' | 'generator' | 'solar-panel' | 'owen-monument'
  | 'gun-turret' | 'rail-turret' | 'wall'
  | 'stone-path' | 'steel-furnace' | 'electric-furnace' | 'splitter' | 'underground-belt' | 'lamp'
  | 'express-belt' | 'assembler-2' | 'big-pole' | 'battery-bank' | 'filter-inserter' | 'steel-wall' | 'land-mine'
  | 'pipe' | 'underground-pipe' | 'offshore-pump' | 'steam-engine' | 'pumpjack' | 'refinery' | 'storage-tank'
  | 'crafter' | 'big-lab' | 'rocket-silo' | 'fast-underground' | 'fast-splitter' | 'roboport';

export type Kind = 'chest' | 'belt' | 'inserter' | 'drill' | 'furnace' | 'assembler' | 'lab' | 'pole' | 'generator' | 'solar' | 'monument' | 'turret' | 'wall'
  | 'floor' | 'splitter' | 'lamp' | 'battery' | 'mine' | 'pipe' | 'pump' | 'pumpjack' | 'silo' | 'roboport';

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
  /** underground belt */
  ug?: boolean;
  /** pole wire reach and supply radius */
  wireReach?: number;
  supply?: number;
  /** battery: joules stored, watts in or out */
  capacity?: number;
  rate?: number;
  /** filter arm */
  filter?: boolean;
  /** pipes and tanks: how much liquid one holds */
  fcap?: number;
  /** underground pipe */
  ugPipe?: boolean;
  /** steam engine: a generator that also needs water */
  steam?: boolean;
  /** oil refinery: only refinery recipes */
  refinery?: boolean;
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
  'burner-drill': { type: 'burner-drill', kind: 'drill', w: 1, h: 1, item: 'burner-drill', rotatable: true, power: 150e3, speed: 0.25, area: 1, mineTime: 0.3 },
  'electric-drill': { type: 'electric-drill', kind: 'drill', w: 1, h: 1, item: 'electric-drill', rotatable: true, power: 90e3, electric: true, speed: 0.5, area: 3, mineTime: 0.3 },
  'stone-furnace': { type: 'stone-furnace', kind: 'furnace', w: 1, h: 1, item: 'stone-furnace', power: 90e3, speed: 1, mineTime: 0.3 },
  'assembler': { type: 'assembler', kind: 'assembler', w: 1, h: 1, item: 'assembler', power: 75e3, electric: true, speed: 0.75, mineTime: 0.3 },
  'lab': { type: 'lab', kind: 'lab', w: 1, h: 1, item: 'lab', power: 60e3, electric: true, speed: 1, mineTime: 0.3 },
  'pole': { type: 'pole', kind: 'pole', w: 1, h: 1, item: 'pole', mineTime: 0.1 },
  'generator': { type: 'generator', kind: 'generator', w: 1, h: 1, item: 'generator', output: 900e3, mineTime: 0.3 },
  'solar-panel': { type: 'solar-panel', kind: 'solar', w: 1, h: 1, item: 'solar-panel', output: 60e3, mineTime: 0.3 },
  'owen-monument': { type: 'owen-monument', kind: 'monument', w: 1, h: 1, item: 'owen-monument', mineTime: 1, hp: 5000 },
  'gun-turret': { type: 'gun-turret', kind: 'turret', w: 1, h: 1, item: 'gun-turret', mineTime: 0.4, hp: 400, range: 18, ammo: 'owen-ammo', damage: 6, fireRate: 6 },
  'rail-turret': { type: 'rail-turret', kind: 'turret', w: 1, h: 1, item: 'rail-turret', mineTime: 0.5, hp: 1000, range: 40, ammo: 'rail-ammo', damage: 400, fireRate: 0.4, power: 400e3, electric: true },
  'wall': { type: 'wall', kind: 'wall', w: 1, h: 1, item: 'wall', mineTime: 0.2, hp: 350 },
  'stone-path': { type: 'stone-path', kind: 'floor', w: 1, h: 1, item: 'stone-path', mineTime: 0.1, hp: 200 },
  'steel-furnace': { type: 'steel-furnace', kind: 'furnace', w: 1, h: 1, item: 'steel-furnace', power: 90e3, speed: 2, mineTime: 0.3, hp: 350 },
  'electric-furnace': { type: 'electric-furnace', kind: 'furnace', w: 1, h: 1, item: 'electric-furnace', power: 180e3, electric: true, speed: 2, mineTime: 0.3, hp: 350 },
  'splitter': { type: 'splitter', kind: 'splitter', w: 2, h: 1, item: 'splitter', rotatable: true, speed: 7.5, mineTime: 0.1 },
  'underground-belt': { type: 'underground-belt', kind: 'belt', w: 1, h: 1, item: 'underground-belt', rotatable: true, speed: 1.875, mineTime: 0.1, ug: true },
  'lamp': { type: 'lamp', kind: 'lamp', w: 1, h: 1, item: 'lamp', power: 5e3, electric: true, mineTime: 0.1 },
  'express-belt': { type: 'express-belt', kind: 'belt', w: 1, h: 1, item: 'express-belt', rotatable: true, speed: 5.625, mineTime: 0.1 },
  'assembler-2': { type: 'assembler-2', kind: 'assembler', w: 1, h: 1, item: 'assembler-2', power: 150e3, electric: true, speed: 1.5, mineTime: 0.3, hp: 400 },
  'big-pole': { type: 'big-pole', kind: 'pole', w: 1, h: 1, item: 'big-pole', mineTime: 0.2, wireReach: 28, supply: 1.5, hp: 200 },
  'battery-bank': { type: 'battery-bank', kind: 'battery', w: 1, h: 1, item: 'battery-bank', mineTime: 0.3, capacity: 5e6, rate: 300e3 },
  'filter-inserter': { type: 'filter-inserter', kind: 'inserter', w: 1, h: 1, item: 'filter-inserter', rotatable: true, power: 46e3, electric: true, speed: 2.3, reach: 1, mineTime: 0.1, filter: true },
  'steel-wall': { type: 'steel-wall', kind: 'wall', w: 1, h: 1, item: 'steel-wall', mineTime: 0.2, hp: 1050 },
  'land-mine': { type: 'land-mine', kind: 'mine', w: 1, h: 1, item: 'land-mine', mineTime: 0.1, hp: 50 },
  'pipe': { type: 'pipe', kind: 'pipe', w: 1, h: 1, item: 'pipe', mineTime: 0.1, fcap: 100 },
  'underground-pipe': { type: 'underground-pipe', kind: 'pipe', w: 1, h: 1, item: 'underground-pipe', rotatable: true, mineTime: 0.1, fcap: 100, ugPipe: true },
  'storage-tank': { type: 'storage-tank', kind: 'pipe', w: 2, h: 2, item: 'storage-tank', mineTime: 0.4, fcap: 2500, hp: 500 },
  'offshore-pump': { type: 'offshore-pump', kind: 'pump', w: 1, h: 1, item: 'offshore-pump', mineTime: 0.2, speed: 600 },
  'steam-engine': { type: 'steam-engine', kind: 'generator', w: 2, h: 2, item: 'steam-engine', output: 900e3, mineTime: 0.4, steam: true, hp: 400 },
  'pumpjack': { type: 'pumpjack', kind: 'pumpjack', w: 2, h: 2, item: 'pumpjack', power: 90e3, electric: true, speed: 10, mineTime: 0.4, hp: 300 },
  'refinery': { type: 'refinery', kind: 'assembler', w: 3, h: 3, item: 'refinery', power: 420e3, electric: true, speed: 1, mineTime: 0.5, hp: 500, refinery: true },
  'crafter': { type: 'crafter', kind: 'assembler', w: 2, h: 2, item: 'crafter', power: 75e3, electric: true, speed: 0.75, mineTime: 0.3, hp: 300 },
  'big-lab': { type: 'big-lab', kind: 'lab', w: 2, h: 2, item: 'big-lab', power: 60e3, electric: true, speed: 1, mineTime: 0.3 },
  'rocket-silo': { type: 'rocket-silo', kind: 'silo', w: 5, h: 5, item: 'rocket-silo', power: 1e6, electric: true, mineTime: 1, hp: 3000 },
  'fast-underground': { type: 'fast-underground', kind: 'belt', w: 1, h: 1, item: 'fast-underground', rotatable: true, speed: 3.75, mineTime: 0.1, ug: true },
  'fast-splitter': { type: 'fast-splitter', kind: 'splitter', w: 2, h: 1, item: 'fast-splitter', rotatable: true, speed: 15, mineTime: 0.1 },
  'roboport': { type: 'roboport', kind: 'roboport', w: 2, h: 2, item: 'roboport', power: 50e3, electric: true, mineTime: 0.4, hp: 500 },
};

const DEFAULT_HP: Record<Kind, number> = {
  chest: 150, belt: 80, inserter: 100, drill: 250, furnace: 200, assembler: 300, lab: 200,
  pole: 100, generator: 400, solar: 200, monument: 5000, turret: 400, wall: 350,
  floor: 200, splitter: 100, lamp: 80, battery: 250, mine: 50,
  pipe: 100, pump: 150, pumpjack: 300, silo: 3000, roboport: 500,
};
export function maxHp(t: EntityType): number {
  return ENTITIES[t].hp ?? DEFAULT_HP[ENTITIES[t].kind];
}

/**
 * Tiles an entity covers when facing `dir`. Sizes in ENTITIES are for facing up; a rotatable
 * entity that isn't square (the splitter) swaps width and height when it faces sideways.
 */
export function footprint(type: EntityType, dir: number): [number, number] {
  const d = ENTITIES[type];
  return d.rotatable && dir % 2 === 1 ? [d.h, d.w] : [d.w, d.h];
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
  /** only an oil refinery makes it */
  machine?: 'refinery';
  /** more things it makes besides `out` */
  extra?: [ItemId, number][];
}

const r = (out: ItemId, count: number, time: number, ing: [ItemId, number][], extra: Partial<Recipe> = {}): Recipe =>
  ({ id: out, out, count, time, ing, hand: true, ...extra });

const CLASSIC_RECIPES: Recipe[] = [
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
  // new buildings
  r('stone-path', 4, 0.5, [['stone-brick', 2]], { unlock: 'stone-paths' }),
  r('steel-furnace', 1, 3, [['steel-plate', 6], ['stone-brick', 10]], { unlock: 'steel-furnace' }),
  r('electric-furnace', 1, 5, [['steel-plate', 10], ['circuit', 5], ['stone-brick', 10]], { unlock: 'electric-furnace' }),
  r('splitter', 1, 1, [['circuit', 5], ['owen-plate', 5], ['belt', 4]], { unlock: 'splitter' }),
  r('underground-belt', 2, 1, [['owen-plate', 10], ['belt', 5]], { unlock: 'underground' }),
  r('lamp', 1, 0.5, [['circuit', 1], ['copper-cable', 3], ['owen-plate', 1]], { unlock: 'lamps' }),
  r('express-belt', 1, 0.5, [['owen-gear', 10], ['fast-belt', 1], ['circuit', 2]], { unlock: 'express-belt' }),
  r('assembler-2', 1, 0.5, [['assembler', 1], ['circuit', 5], ['owen-gear', 5], ['steel-plate', 2]], { unlock: 'assembler-2' }),
  r('big-pole', 1, 0.5, [['steel-plate', 5], ['copper-plate', 5], ['owen-stick', 8]], { unlock: 'big-pole' }),
  r('battery-bank', 1, 10, [['steel-plate', 4], ['copper-plate', 10], ['circuit', 5]], { unlock: 'batteries' }),
  r('filter-inserter', 1, 0.5, [['fast-inserter', 1], ['circuit', 4]], { unlock: 'filter-arm' }),
  r('steel-wall', 1, 0.5, [['wall', 1], ['steel-plate', 2]], { unlock: 'steel-walls' }),
  r('grenade', 1, 4, [['coal', 10], ['owen-plate', 5]], { unlock: 'grenades' }),
  r('land-mine', 4, 3, [['steel-plate', 1], ['coal', 4]], { unlock: 'land-mines' }),
  r('helper-drone', 1, 10, [['circuit', 20], ['steel-plate', 10], ['owen-gear', 10]], { unlock: 'helper-drone' }),
  // armor
  r('armor-1', 1, 3, [['owen-plate', 30], ['copper-plate', 10]], { unlock: 'armor-1' }),
  r('armor-2', 1, 6, [['armor-1', 1], ['steel-plate', 20], ['owen-plate', 20]], { unlock: 'armor-2' }),
  r('armor-3', 1, 10, [['armor-2', 1], ['steel-plate', 40], ['circuit', 20]], { unlock: 'armor-3' }),
  r('armor-4', 1, 15, [['armor-3', 1], ['steel-plate', 50], ['circuit', 60]], { unlock: 'armor-4' }),
  r('armor-5', 1, 20, [['armor-4', 1], ['steel-plate', 120], ['circuit', 150]], { unlock: 'armor-5' }),
  r('eq-solar', 1, 5, [['circuit', 4], ['steel-plate', 2], ['copper-plate', 5]], { unlock: 'eq-solar' }),
  r('eq-battery', 1, 5, [['circuit', 5], ['steel-plate', 3], ['copper-plate', 10]], { unlock: 'eq-battery' }),
  r('eq-night', 1, 5, [['circuit', 6], ['steel-plate', 5], ['copper-cable', 10]], { unlock: 'eq-night' }),
  r('eq-shield', 1, 8, [['circuit', 10], ['steel-plate', 10], ['copper-cable', 20]], { unlock: 'eq-shield' }),
  r('eq-laser', 1, 10, [['circuit', 25], ['steel-plate', 15], ['copper-plate', 20]], { unlock: 'eq-laser' }),
  r('eq-legs', 1, 10, [['circuit', 20], ['steel-plate', 20], ['owen-gear', 30]], { unlock: 'eq-legs' }),
  r('eq-core', 1, 20, [['circuit', 80], ['steel-plate', 60], ['copper-plate', 60]], { unlock: 'eq-core' }),
];


export interface Tech {
  id: string;
  name: string;
  desc: string;
  packs: ItemId[]; // one of each per unit
  units: number;
  time: number; // seconds per unit
  requires: string[];
  /** can be researched again and again, costing more each time */
  infinite?: boolean;
}

const CLASSIC_TECHS: Tech[] = [
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
  { id: 'fast-hands', name: "Fast hands", desc: "You craft things by hand 50% faster.", packs: ['red-pack'], units: 30, time: 10, requires: ['automation'] },
  { id: 'backpack', name: "Bigger backpack", desc: "20 more inventory slots.", packs: ['red-pack'], units: 40, time: 10, requires: ['automation'] },
  { id: 'long-arms', name: "Long arms", desc: "Build and pick things up from 5 tiles farther away.", packs: ['red-pack'], units: 30, time: 10, requires: ['logistics'] },
  { id: 'stone-paths', name: "Stone paths", desc: "Floor tiles that make you walk 30% faster.", packs: ['red-pack'], units: 20, time: 10, requires: ['military'] },
  { id: 'steel-furnace', name: "Steel furnace", desc: "A furnace that smelts twice as fast.", packs: ['red-pack'], units: 60, time: 10, requires: ['steel'] },
  { id: 'splitter', name: "Belt splitter", desc: "Split one belt into two.", packs: ['red-pack'], units: 40, time: 10, requires: ['logistics'] },
  { id: 'underground', name: "Underground belt", desc: "Belts that go under up to 4 tiles.", packs: ['red-pack'], units: 40, time: 10, requires: ['logistics'] },
  { id: 'lamps', name: "Lamps", desc: "Light up your base at night.", packs: ['red-pack'], units: 20, time: 10, requires: ['automation'] },
  { id: 'express-belt', name: "Express belt", desc: "Belts three times as fast as normal ones.", packs: ['red-pack',  'green-pack'], units: 80, time: 15, requires: ['green-science',  'splitter'] },
  { id: 'assembler-2', name: "Assembler 2", desc: "An assembler that crafts twice as fast.", packs: ['red-pack',  'green-pack'], units: 60, time: 15, requires: ['green-science'] },
  { id: 'electric-furnace', name: "Electric furnace", desc: "Smelts twice as fast using power, no fuel needed.", packs: ['red-pack',  'green-pack'], units: 80, time: 15, requires: ['green-science',  'steel-furnace'] },
  { id: 'big-pole', name: "Big power pole", desc: "Poles whose wires reach 28 tiles.", packs: ['red-pack',  'green-pack'], units: 50, time: 15, requires: ['green-science',  'steel'] },
  { id: 'mining-prod-1', name: "Mining productivity 1", desc: "Drills dig 10% extra ore without using up the patch.", packs: ['red-pack',  'green-pack'], units: 60, time: 15, requires: ['green-science'] },
  { id: 'mining-prod-2', name: "Mining productivity 2", desc: "Another 10% extra ore from drills.", packs: ['red-pack',  'green-pack'], units: 120, time: 15, requires: ['mining-prod-1'] },
  { id: 'lab-speed', name: "Faster labs", desc: "Labs research 50% faster.", packs: ['red-pack',  'green-pack'], units: 60, time: 15, requires: ['green-science'] },
  { id: 'better-gen', name: "Better generators", desc: "Coal generators make 50% more power.", packs: ['red-pack',  'green-pack'], units: 60, time: 15, requires: ['green-science'] },
  { id: 'batteries', name: "Batteries", desc: "Battery banks save spare power for later, like solar power for the night.", packs: ['red-pack',  'green-pack'], units: 80, time: 15, requires: ['solar'] },
  { id: 'filter-arm', name: "Filter arm", desc: "A fast robo arm that only moves the item you pick.", packs: ['red-pack',  'green-pack'], units: 50, time: 15, requires: ['fast-inserter'] },
  { id: 'bullet-damage-2', name: "Owen bullet damage 2", desc: "Your gun and gun turrets do another 50% more damage.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 80, time: 20, requires: ['weapon-damage'] },
  { id: 'fire-rate', name: "Fire rate", desc: "Your gun and gun turrets shoot 30% faster.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 60, time: 20, requires: ['military-science'] },
  { id: 'toughness', name: "Toughness", desc: "You have 50% more health.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 60, time: 20, requires: ['military-science'] },
  { id: 'healing', name: "Healing", desc: "You start healing sooner and heal four times as fast.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 60, time: 20, requires: ['toughness'] },
  { id: 'steel-walls', name: "Steel walls", desc: "Walls three times as tough as stone ones.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 50, time: 20, requires: ['military-science'] },
  { id: 'turret-range', name: "Turret range", desc: "Turrets reach 25% farther.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 60, time: 20, requires: ['military-science'] },
  { id: 'grenades', name: "Grenades", desc: "Throw one (G) to blow up a crowd of bugs.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 50, time: 20, requires: ['military-science'] },
  { id: 'land-mines', name: "Land mines", desc: "Hidden traps that blow up bugs.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 60, time: 20, requires: ['grenades'] },
  { id: 'rail-damage', name: "Rail damage", desc: "Rail guns and rail turrets hit 50% harder.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 100, time: 20, requires: ['rail-guns'] },
  { id: 'helper-drone', name: "Helper drone", desc: "A little flying robot that follows you and shoots bugs.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 120, time: 20, requires: ['advanced-science',  'military-science'] },
  { id: 'speed-boots', name: "Speed boots", desc: "You walk 25% faster.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 80, time: 20, requires: ['advanced-science'] },
  { id: 'prod-module', name: "Productivity module", desc: "Assemblers make 10% extra of whatever they craft.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 150, time: 20, requires: ['advanced-science',  'assembler-2'] },
  { id: 'armor-1', name: "Owen vest", desc: "Your first armor: blocks 15% of damage and has a 2\u00d72 personal grid.", packs: ['red-pack'], units: 30, time: 10, requires: ['military'] },
  { id: 'armor-2', name: "Owen plate armor", desc: "Blocks 30% of damage. 3\u00d73 personal grid.", packs: ['red-pack',  'green-pack'], units: 60, time: 15, requires: ['armor-1',  'green-science'] },
  { id: 'armor-3', name: "Steel armor", desc: "Blocks 45% of damage. 4\u00d74 personal grid.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 80, time: 20, requires: ['armor-2',  'military-science'] },
  { id: 'armor-4', name: "Power suit", desc: "Blocks 55% of damage. 5\u00d75 personal grid.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 120, time: 20, requires: ['armor-3',  'advanced-science'] },
  { id: 'armor-5', name: "Power suit Mk2", desc: "Blocks 65% of damage. 7\u00d77 personal grid.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 250, time: 25, requires: ['armor-4'] },
  { id: 'eq-solar', name: "Personal solar panel", desc: "A 1\u00d71 solar panel for your armor grid.", packs: ['red-pack',  'green-pack'], units: 40, time: 15, requires: ['armor-1',  'solar'] },
  { id: 'eq-battery', name: "Personal battery", desc: "Stores power in your armor grid.", packs: ['red-pack',  'green-pack'], units: 40, time: 15, requires: ['armor-1',  'green-science'] },
  { id: 'eq-night', name: "Night vision", desc: "See clearly at night.", packs: ['red-pack',  'green-pack'], units: 40, time: 15, requires: ['armor-2'] },
  { id: 'eq-shield', name: "Energy shield", desc: "Soaks up damage before it hits you, then recharges.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 60, time: 20, requires: ['armor-2',  'military-science'] },
  { id: 'eq-laser', name: "Personal laser", desc: "Zaps bugs near you all by itself, using suit power.", packs: ['red-pack',  'green-pack',  'military-pack'], units: 100, time: 20, requires: ['eq-shield',  'armor-3'] },
  { id: 'eq-legs', name: "Exo legs", desc: "Walk 30% faster while your suit has power.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 80, time: 20, requires: ['armor-3',  'advanced-science'] },
  { id: 'eq-core', name: "Owen power core", desc: "Makes lots of suit power, day and night.", packs: ['red-pack',  'green-pack',  'military-pack',  'advanced-pack'], units: 150, time: 25, requires: ['armor-4'] },
  { id: 'monument', name: 'The Great Owen', desc: 'Build a monument to Owen to finish the game.', packs: ['red-pack', 'green-pack', 'military-pack', 'advanced-pack'], units: 200, time: 15, requires: ['rail-guns', 'solar', 'weapon-damage'] },
];
/** Icon shown on each research card. */
const CLASSIC_TECH_ICON: Record<string, ItemId> = {
  automation: 'assembler', logistics: 'fast-belt', military: 'wall', steel: 'steel-plate', 'green-science': 'green-pack',
  'fast-inserter': 'fast-inserter', solar: 'solar-panel', 'military-science': 'military-pack', 'weapon-damage': 'owen-ammo',
  'advanced-science': 'advanced-pack', 'rail-guns': 'rail-gun', monument: 'owen-monument',
  'fast-hands': 'owen-gear',
  'backpack': 'wooden-chest',
  'long-arms': 'long-inserter',
  'stone-paths': 'stone-path',
  'steel-furnace': 'steel-furnace',
  'splitter': 'splitter',
  'underground': 'underground-belt',
  'lamps': 'lamp',
  'express-belt': 'express-belt',
  'assembler-2': 'assembler-2',
  'electric-furnace': 'electric-furnace',
  'big-pole': 'big-pole',
  'mining-prod-1': 'electric-drill',
  'mining-prod-2': 'electric-drill',
  'lab-speed': 'lab',
  'better-gen': 'generator',
  'batteries': 'battery-bank',
  'filter-arm': 'filter-inserter',
  'bullet-damage-2': 'owen-ammo',
  'fire-rate': 'gun-turret',
  'toughness': 'armor-1',
  'healing': 'red-pack',
  'steel-walls': 'steel-wall',
  'turret-range': 'rail-turret',
  'grenades': 'grenade',
  'land-mines': 'land-mine',
  'rail-damage': 'rail-ammo',
  'helper-drone': 'helper-drone',
  'speed-boots': 'eq-legs',
  'prod-module': 'assembler-2',
  'armor-1': 'armor-1',
  'armor-2': 'armor-2',
  'armor-3': 'armor-3',
  'armor-4': 'armor-4',
  'armor-5': 'armor-5',
  'eq-solar': 'eq-solar',
  'eq-battery': 'eq-battery',
  'eq-night': 'eq-night',
  'eq-shield': 'eq-shield',
  'eq-laser': 'eq-laser',
  'eq-legs': 'eq-legs',
  'eq-core': 'eq-core',
};
export const SCIENCE_PACKS: ItemId[] = ['red-pack', 'green-pack', 'military-pack', 'advanced-pack'];
const CLASSIC_START: [ItemId, number][] = [
  ['owen-plate', 8],
  ['wood', 4],
  ['burner-drill', 1],
  ['stone-furnace', 1],
  ['owen-ammo', 10],
];

// ---------- rules: the classic game or advanced mode ----------
// Everything reads these shared tables; useRules swaps what is in them when a game starts.

export const RECIPES: Recipe[] = [];
export const RECIPE_BY_ID: Record<string, Recipe> = {};
export const SMELT_BY_INPUT: Partial<Record<ItemId, Recipe>> = {};
export const TECHS: Tech[] = [];
export const TECH_BY_ID: Record<string, Tech> = {};
export const TECH_ICON: Record<string, ItemId> = {};
export const PLAYER_START: [ItemId, number][] = [];
export const RULES = { advanced: false, version: 0 };

function fill<T>(into: Record<string, T>, from: Record<string, T>) {
  for (const k of Object.keys(into)) delete into[k];
  Object.assign(into, from);
}

export function useRules(advanced: boolean) {
  if (RULES.version && RULES.advanced === advanced) return;
  RULES.advanced = advanced;
  RULES.version++;
  const recipes = advanced ? ADV_RECIPES : CLASSIC_RECIPES;
  const techs = advanced ? ADV_TECHS : CLASSIC_TECHS;
  RECIPES.splice(0, RECIPES.length, ...recipes);
  TECHS.splice(0, TECHS.length, ...techs);
  PLAYER_START.splice(0, PLAYER_START.length, ...(advanced ? ADV_START : CLASSIC_START));
  fill(RECIPE_BY_ID, Object.fromEntries(recipes.map((x) => [x.id, x])));
  const smelt: Partial<Record<ItemId, Recipe>> = {};
  for (const x of recipes) if (x.smelt) smelt[x.ing[0][0]] = x;
  fill(SMELT_BY_INPUT as Record<string, Recipe>, smelt as Record<string, Recipe>);
  fill(TECH_BY_ID, Object.fromEntries(techs.map((t) => [t.id, t])));
  fill(TECH_ICON, advanced ? ADV_TECH_ICON : CLASSIC_TECH_ICON);
}

/** Units of research a technology needs now (infinite ones cost more each level). */
export function techUnits(t: Tech, level: number) {
  return t.infinite ? t.units * (level + 1) : t.units;
}

/** How many ingredient crafts an assembler/furnace buffers before inserters stop feeding it. */
export const INPUT_BUFFER_CRAFTS = 2;

useRules(false);
