// Advanced mode: recipes that cost what they do in the big factory games, oil, pipes, rockets
// and space, and Tim's research tree. data.ts swaps these in with useRules(true).
import type { ItemId, Recipe, Tech } from './data';

const r = (out: ItemId, count: number, time: number, ing: [ItemId, number][], extra: Partial<Recipe> = {}): Recipe =>
  ({ id: out, out, count, time, ing, hand: true, ...extra });
/** A machine-only recipe (it uses liquids, or is made in a refinery). */
const m = (id: string, out: ItemId, count: number, time: number, ing: [ItemId, number][], extra: Partial<Recipe> = {}): Recipe =>
  ({ id, out, count, time, ing, hand: false, ...extra });

const RED: ItemId = 'red-pack', GREEN: ItemId = 'green-pack', GRAY: ItemId = 'military-pack', BLUE: ItemId = 'advanced-pack';

export const ADV_RECIPES: Recipe[] = [
  // smelting
  r('owen-plate', 1, 3.2, [['owen-ore', 1]], { smelt: true, hand: false }),
  r('copper-plate', 1, 3.2, [['copper-ore', 1]], { smelt: true, hand: false }),
  r('stone-brick', 1, 3.2, [['stone', 2]], { smelt: true, hand: false }),
  r('steel-plate', 1, 16, [['owen-plate', 5]], { smelt: true, hand: false, unlock: 'steel' }),
  // parts
  r('owen-gear', 1, 0.5, [['owen-plate', 2]]),
  r('owen-stick', 2, 0.5, [['owen-plate', 1]]),
  r('copper-cable', 2, 0.5, [['copper-plate', 1]]),
  r('circuit', 1, 0.5, [['owen-plate', 1], ['copper-cable', 3]]),
  r('adv-circuit', 1, 6, [['circuit', 2], ['plastic', 2], ['copper-cable', 4]], { unlock: 'adv-circuit' }),
  r('rocket-part', 1, 3, [['plastic', 10], ['circuit', 10], ['owen-plate', 10]]),
  // logistics
  r('wooden-chest', 1, 0.5, [['wood', 2]]),
  r('owen-chest', 1, 0.5, [['owen-plate', 8]]),
  r('belt', 2, 0.5, [['owen-gear', 1], ['owen-plate', 1]]),
  r('underground-belt', 2, 1, [['owen-plate', 10], ['belt', 5]]),
  r('splitter', 1, 1, [['circuit', 5], ['owen-plate', 5], ['belt', 4]]),
  r('fast-belt', 1, 0.5, [['owen-gear', 5], ['belt', 1]], { unlock: 'fast-logistics' }),
  r('fast-underground', 2, 2, [['owen-gear', 40], ['underground-belt', 2]], { unlock: 'fast-logistics' }),
  r('fast-splitter', 1, 2, [['splitter', 1], ['circuit', 10], ['owen-gear', 10]], { unlock: 'fast-logistics' }),
  m('express-belt', 'express-belt', 1, 0.5, [['owen-gear', 10], ['fast-belt', 1], ['lubricant', 20]], { unlock: 'express-belts' }),
  r('burner-inserter', 1, 0.5, [['owen-plate', 1], ['owen-gear', 1]]),
  r('inserter', 1, 0.5, [['circuit', 1], ['owen-gear', 1], ['owen-plate', 1]]),
  r('long-inserter', 1, 0.5, [['inserter', 1], ['owen-gear', 1], ['owen-plate', 1]], { unlock: 'fast-grabbers' }),
  r('fast-inserter', 1, 0.5, [['inserter', 1], ['circuit', 2], ['owen-plate', 2]], { unlock: 'fast-grabbers' }),
  r('pole', 2, 0.5, [['wood', 1], ['copper-cable', 2]]),
  r('pipe', 1, 0.5, [['owen-plate', 1]]),
  r('underground-pipe', 2, 0.5, [['pipe', 10], ['owen-plate', 5]]),
  r('storage-tank', 1, 3, [['owen-plate', 25], ['pipe', 5]]),
  r('lamp', 1, 0.5, [['circuit', 1], ['copper-cable', 3], ['owen-plate', 1]], { unlock: 'lamps' }),
  r('roboport', 1, 5, [['steel-plate', 20], ['owen-gear', 20], ['adv-circuit', 20]], { unlock: 'robots' }),
  m('robot', 'robot', 1, 5, [['circuit', 2], ['steel-plate', 2], ['owen-gear', 1], ['sulfuric-acid', 20]], { unlock: 'robots' }),
  // production
  r('stone-furnace', 1, 0.5, [['stone', 5]]),
  r('burner-drill', 1, 2, [['owen-gear', 3], ['stone-furnace', 1], ['owen-plate', 3]]),
  r('electric-drill', 1, 2, [['circuit', 3], ['owen-gear', 5], ['owen-plate', 10]]),
  r('generator', 1, 2, [['owen-gear', 8], ['owen-plate', 10], ['stone-furnace', 1]]),
  r('steam-engine', 1, 3, [['owen-gear', 8], ['owen-plate', 10], ['pipe', 5], ['stone-furnace', 1]]),
  r('offshore-pump', 1, 0.5, [['circuit', 2], ['pipe', 1], ['owen-gear', 1]]),
  r('pumpjack', 1, 5, [['owen-plate', 10], ['owen-gear', 10], ['circuit', 5], ['pipe', 10]]),
  r('refinery', 1, 8, [['owen-plate', 25], ['owen-gear', 10], ['circuit', 10], ['pipe', 10], ['stone-brick', 10]]),
  r('crafter', 1, 0.5, [['circuit', 3], ['owen-gear', 5], ['owen-plate', 9]]),
  r('big-lab', 1, 2, [['circuit', 10], ['owen-gear', 10], ['belt', 4]]),
  r('rocket-silo', 1, 30, [['steel-plate', 100], ['adv-circuit', 50], ['pipe', 50], ['stone-brick', 200], ['owen-gear', 50]], { unlock: 'rocket-silo' }),
  r('platform-kit', 1, 10, [['steel-plate', 20], ['adv-circuit', 20], ['plastic', 20]], { unlock: 'space-platform' }),
  r('catcher', 1, 5, [['steel-plate', 10], ['adv-circuit', 5], ['owen-gear', 10]], { unlock: 'catchers' }),
  r('crusher', 1, 5, [['steel-plate', 10], ['adv-circuit', 5], ['owen-gear', 10]], { unlock: 'crushers' }),
  r('thruster', 1, 5, [['steel-plate', 10], ['adv-circuit', 10], ['pipe', 10]], { unlock: 'thrusters' }),
  r('owen-monument', 1, 30, [['steel-plate', 100], ['adv-circuit', 100], ['stone-brick', 200], ['rocket-fuel', 20], ['cryser-crystal', 20]], { unlock: 'monument' }),
  // oil refinery
  m('oil-processing', 'heavy-oil', 30, 5, [['crude-oil', 100]], { machine: 'refinery', extra: [['light-oil', 70]] }),
  m('plastic', 'plastic', 2, 1, [['light-oil', 20], ['coal', 1]], { machine: 'refinery' }),
  m('sulfur', 'sulfur', 2, 1, [['heavy-oil', 30], ['water', 30]], { machine: 'refinery' }),
  m('sulfuric-acid', 'sulfuric-acid', 50, 1, [['sulfur', 5], ['owen-plate', 1], ['water', 100]], { machine: 'refinery' }),
  m('lubricant', 'lubricant', 10, 1, [['heavy-oil', 10]], { machine: 'refinery' }),
  m('solid-fuel-light', 'solid-fuel', 1, 2, [['light-oil', 10]], { machine: 'refinery', unlock: 'solid-fuel' }),
  m('solid-fuel-heavy', 'solid-fuel', 1, 2, [['heavy-oil', 20]], { machine: 'refinery', unlock: 'solid-fuel' }),
  m('rocket-fuel', 'rocket-fuel', 1, 15, [['solid-fuel', 10], ['light-oil', 10], ['heavy-oil', 10], ['steel-plate', 1]], { unlock: 'rocket-fuel' }),
  // military
  r('owen-ammo', 1, 1, [['owen-plate', 1]]),
  r('piercing-ammo', 1, 3, [['owen-ammo', 1], ['steel-plate', 1], ['copper-plate', 5]], { unlock: 'adv-ammo' }),
  r('gun-turret', 1, 8, [['owen-gear', 10], ['copper-plate', 10], ['owen-plate', 20]]),
  r('wall', 1, 0.5, [['stone-brick', 5]]),
  r('rocket-launcher', 1, 10, [['owen-plate', 5], ['owen-gear', 5], ['circuit', 5]]),
  r('rocket', 1, 8, [['circuit', 1], ['coal', 1], ['sulfur', 1], ['owen-plate', 2]]),
  r('flamethrower', 1, 10, [['owen-plate', 10], ['owen-gear', 10]]),
  m('flame-ammo', 'flame-ammo', 1, 6, [['crude-oil', 10], ['owen-plate', 5]]),
  r('sniper', 1, 10, [['steel-plate', 10], ['owen-gear', 5], ['circuit', 5]], { unlock: 'sniper' }),
  r('rail-ammo', 1, 3, [['steel-plate', 2], ['copper-plate', 2], ['adv-circuit', 1]], { unlock: 'rail-guns' }),
  r('rail-gun', 1, 10, [['steel-plate', 10], ['adv-circuit', 10], ['owen-gear', 5]], { unlock: 'rail-guns' }),
  r('rail-turret', 1, 15, [['steel-plate', 20], ['adv-circuit', 20], ['owen-gear', 10], ['gun-turret', 1]], { unlock: 'rail-guns' }),
  // armor
  r('armor-0', 1, 3, [['owen-plate', 40]]),
  r('eq-goggles', 1, 5, [['circuit', 10], ['owen-plate', 10]]),
  // science
  r('red-pack', 1, 5, [['copper-plate', 1], ['owen-gear', 1]]),
  r('green-pack', 1, 6, [['inserter', 1], ['belt', 1]], { unlock: 'green-science' }),
  r('military-pack', 2, 10, [['owen-ammo', 1], ['wall', 2], ['steel-plate', 1]], { unlock: 'military-science' }),
  r('advanced-pack', 2, 20, [['adv-circuit', 3], ['steel-plate', 2], ['sulfur', 1]], { unlock: 'advanced-science' }),
];

const T = (id: string, name: string, desc: string, packs: ItemId[], units: number, time: number, requires: string[], infinite = false): Tech =>
  ({ id, name, desc, packs, units, time, requires, infinite });

/** Tim's research tree (page 2 of his notes). */
export const ADV_TECHS: Tech[] = [
  T('green-science', 'Green science', 'Unlocks the logistic (green) science pack.', [RED], 30, 5, []),
  T('fast-logistics', 'Fast belts', 'Fast belts, fast underground belts and fast splitters: twice as quick.', [RED], 40, 10, []),
  T('mining-speed', 'Faster mining', 'Drills and your hands mine 20% faster. You can research it again and again.', [RED], 30, 10, [], true),
  T('lamps', 'Lamps', 'Light up your base at night.', [RED], 10, 10, []),
  T('steel', 'Steel', 'Smelt 5 Owen plates into 1 Owen steel in a furnace.', [RED, GREEN], 50, 5, ['green-science']),
  T('mining-prod', 'Mining productivity', 'Drills dig 10% extra ore without using up the patch. You can research it again and again.', [RED, GREEN], 50, 15, ['green-science'], true),
  T('solid-fuel', 'Solid fuel', 'An oil refinery can make solid fuel from light oil or heavy oil.', [RED, GREEN], 50, 10, ['green-science']),
  T('adv-circuit', 'Advanced circuit', 'The red chip: circuits, plastic and copper cable.', [RED, GREEN], 75, 15, ['green-science']),
  T('fast-grabbers', 'Fast and long grabbers', 'Fast robo arms and long robo arms.', [RED, GREEN], 50, 15, ['green-science']),
  T('express-belts', 'Express belts', 'Blue belts, three times as fast. A crafter makes them with lubricant.', [RED, GREEN], 75, 15, ['fast-logistics', 'green-science']),
  T('military-science', 'Military science', 'Unlocks the military (gray) science pack.', [RED, GREEN], 50, 10, ['steel']),
  T('rocket-fuel', 'Rocket fuel', 'Made in a crafter from solid fuel, light oil, heavy oil and steel.', [RED, GREEN], 75, 15, ['solid-fuel', 'steel']),
  T('robots', 'Robots and roboports', 'Robots fix your buildings and rebuild the ones bugs destroy.', [RED, GREEN], 100, 15, ['adv-circuit', 'fast-grabbers']),
  T('sniper', 'Sniper', 'A sniper rifle that shoots very far.', [RED, GREEN, GRAY], 50, 15, ['military-science']),
  T('adv-ammo', 'Advanced ammo', 'Red bullets do twice the damage, in your gun and in turrets.', [RED, GREEN, GRAY], 50, 15, ['military-science']),
  T('advanced-science', 'Advanced science', 'Unlocks the advanced (blue) science pack.', [RED, GREEN, GRAY], 75, 15, ['adv-circuit', 'military-science']),
  T('rocket-silo', 'Rocket silo', 'Build rockets and launch them into space.', [RED, GREEN, GRAY], 200, 20, ['rocket-fuel', 'advanced-science']),
  T('rail-guns', 'Railguns', 'A handheld rail gun, rail gun turrets and rail slugs. Fires straight through whole swarms.', [RED, GREEN, GRAY, BLUE], 150, 20, ['advanced-science', 'sniper']),
  T('space-platform', 'Space platform', 'Launch a starter pack in a rocket to make a space platform.', [RED, GREEN], 150, 20, ['rocket-silo']),
  T('catchers', 'Asteroid catchers', 'Catch the little asteroids that fly past your platform.', [RED, GREEN], 100, 20, ['space-platform']),
  T('thrusters', 'Thrusters', 'Fly your space platform into deep space.', [RED, GREEN], 100, 20, ['space-platform']),
  T('crushers', 'Crushers', 'Turn caught asteroids into ore, ice and cryser crystals.', [RED, GREEN], 100, 20, ['catchers']),
  T('monument', 'Great Owen Monument', 'Build a monument to Owen to finish the game. It needs cryser crystals from deep space.', [RED, GREEN, GRAY, BLUE], 300, 20, ['rocket-silo', 'rail-guns', 'crushers', 'thrusters']),
];

export const ADV_TECH_ICON: Record<string, ItemId> = {
  'green-science': 'green-pack', 'fast-logistics': 'fast-belt', 'mining-speed': 'electric-drill', lamps: 'lamp',
  steel: 'steel-plate', 'mining-prod': 'burner-drill', 'solid-fuel': 'solid-fuel', 'adv-circuit': 'adv-circuit',
  'fast-grabbers': 'fast-inserter', 'express-belts': 'express-belt', 'military-science': 'military-pack',
  'rocket-fuel': 'rocket-fuel', robots: 'robot', sniper: 'sniper', 'adv-ammo': 'piercing-ammo',
  'advanced-science': 'advanced-pack', 'rocket-silo': 'rocket-silo', 'rail-guns': 'rail-gun',
  'space-platform': 'platform-kit', catchers: 'catcher', thrusters: 'thruster', crushers: 'crusher', monument: 'owen-monument',
};

export const ADV_START: [ItemId, number][] = [
  ['owen-plate', 8],
  ['wood', 4],
  ['burner-drill', 1],
  ['stone-furnace', 1],
  ['owen-ammo', 10],
];
