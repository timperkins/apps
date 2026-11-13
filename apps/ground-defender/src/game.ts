// Ground Defender: a top-down survival game. A little guy with a crossbow defends a walled base
// in a big map. Bears come out of bear spawners in the woods and gather at the gates; a bear that
// has waited long enough at a gate comes in. A destroyed spawner comes back elsewhere 30 seconds later.
import { Sound } from './audio';

/** Tim's numbers. Damage and healing are shares of max health. */
export const SURVIVAL = {
  maxHp: 1_000_000,
  bearHit: .08,         // a bear hit takes 8% of max health
  bearCooldown: 5,      // seconds between one bear's hits
  heal: .012,           // the guy heals 1.2% of max health every second
  bearHp: 5,
  gateWait: 30,         // seconds a bear waits at the gate before it comes in
  gateWaitLater: 20,    // ...and after the first 4 bears are defeated
  rushKills: 4,         // bears to defeat before the gate wait drops and the mine and machine appear
  bearThrow: .09,       // a bear inside throws a rock that takes 9% of max health
  throwCooldown: 5,
  throwSpeed: 170,
  mineEvery: 2,         // mining gives a stone every 2 seconds
  minerCost: 10,        // stone to hire the first miner
  extraMinerCost: 20,   // stone for each extra miner
  maxMiners: 6,
  minerEvery: 5,        // the miner digs a stone every 5 seconds
  beltCost: 5,          // stone for a belt in the shop
  beltLength: 3,        // one belt from the shop lays 3 tiles
  shortBeltCost: 5,     // 3 one-tile belts for 5 stone
  shortBeltPack: 3,
  splitterCost: 4,      // stone for a splitter
  splitTime: .3,        // seconds between stones out of a splitter
  chestCost: 10,        // stone for a chest
  chestSize: 200,       // a chest holds 200 stone
  packCost: 5,          // stone for a science pack
  labCost: 20,          // stone for a lab
  labSize: 40,          // packs a lab holds
  labEvery: 2,          // a working lab uses one pack every 2 seconds
  furnaceCost: 12,      // stone for a furnace
  furnaceTime: 3,       // seconds to bake a stone into a brick
  genCost: 20,          // stone for a generator
  genBurn: 10,          // seconds of power from one stone
  powerRange: 130,      // machines, labs, furnaces and assemblers this close to a burning generator run twice as fast
  pumpCost: 15,         // stone for a water pump
  pipeCost: 3, pipePack: 3, // 3 pipes for 3 stone
  asmCost: 35,          // stone for an assembler
  asmStone: 5,          // stone per science pack (or per 3 short belts)
  asmTime: 4,
  tunnelCost: 6,        // a pair of underground belts
  tunnelReach: 6,       // tiles an underground belt can jump
  hubCost: 40,          // a robot hub, with 2 robots
  robotCost: 10,        // an extra robot
  robotSpeed: 110,
  bTurretCost: 15, bTurretBricks: 10, // a brick turret: 15 stone and 10 bricks
  brickGate: 30,        // bricks for the brick gate: bears wait 10 s longer
  mineCost: 30,         // stone for an extra mine
  machineCost: 45,      // stone for an extra machine
  expandCosts: [40, 60], // stone to make the base bigger, step by step
  turretCost: 15,       // stone for a turret in the shop
  turretDamage: 5.25,
  turretReload: 2,
  turretShot: 1, turretEvery: .2, turretUse: .16, // a turret: 1 damage a shot, a shot every 0.2 s, 16% of an ammo a shot
  turretRange: 280,
  grabberCost: 3,       // stone for a grabber in the shop
  grabTime: 1,          // seconds for a grabber to move one stone
  mineBears: .6,        // after the mine checkpoint, 40% fewer bears
  beltSpeed: 45,        // how fast a belt carries stone (and you)
  batchTime: 4,         // the machine turns each stone into stone ammo in 4 seconds
  batchAmmo: 5,         // stone ammo per stone
  stoneDamage: 1.7,     // stone ammo does 1.7x normal ammo damage
  targetRange: 300,     // space bar only fires if a bear is this close (world units)
  boltRange: 420,
  boltSpeed: 520,
  guySpeed: 120,
  bearEvery: 10,        // seconds between bears
  waveStart: 720,       // huge waves start after 12 minutes
  waveEvery: 480,       // then one every 8 minutes (20, 28, 36 minutes...)
  moreGates: 480,       // after 8 minutes gates open on the other 3 sides
  allGates: 1200,       // after 20 minutes 3 more gates open and bears come from everywhere
  gateWaitLate: 40,     // ...and from then on bears take 40 seconds to get in
  spawnerHp: 55.5,
  fishChance: .099,     // a spawner makes an acid fish 9.90% of the time, a bear otherwise
  fishRange: 240,       // an acid fish spits from 10 tiles away
  fishSpitEvery: 3, acidHit: 10000, acidBurn: 10000, acidBurnTime: 5, puddleTime: 10, puddleBurn: 20000, puddleR: 24,
  spawnerMin: 4, spawnerMax: 6,
  spawnerFar: 4,
  spawnerDelay: 600,    // no spawners for the first 10 minutes
  startStone: 10, startOre: 5, // you start on a 10 x 10 tile stone patch, with 5 x 5 iron and copper patches touching it
  spawnerBack: 30,      // a destroyed spawner comes back somewhere else after 30 seconds        // spawners are 4 times as far out as they first were
  spawnEvery: 12,       // each spawner makes a bear every 12 seconds
  spawnEarly: 100,      // ...but only one every 100 seconds for the first 15 minutes
  earlyTime: 900,
  maxBears: 14,         // ...while there are fewer than 14 bears on the map (huge waves come on top)
  groupMin: 6, groupMax: 10, // bears gather by their spawners until there are 6 to 10 of them, then all attack together
  chaseRange: 130,      // a bear outside goes for you when you walk this close
  oreMineCost: { iron: { stone: 100 }, copper: { stone: 100, iron: 75 }, gold: { stone: 125, iron: 100, copper: 50 }, diamond: { stone: 150, iron: 100, copper: 75, gold: 50 } } as Record<Ore, Cost>,
  rapidCost: { stone: 50, iron: 10 } as Cost, // a rapid crossbow
  rapidDamage: .75, rapidReload: .05, rapidUse: .008, // 0.8% of one ammo a shot
  rocketCost: { stone: 40, iron: 20 } as Cost,    // a rocket launcher
  rocketDamage: 70, rocketReload: 3, rocketRange: 620, rocketSpeed: 300,
  rocketStone: 10,
  rgunReload: 1.5,
  ammoPoints: 100,      // each ammo (or rocket) has 100 usage points; a crossbow shot or a rocket uses all of them
  mgunEvery: .2, mgunUse: .5, mgunDamage: { ammo: 1.4, copperAmmo: 1.5, ironAmmo: 1.8, goldAmmo: 2, diamondAmmo: 2.25 } as Record<string, number>, // the machine gun
  rxDamage: .3, rxEvery: .1, rxUse: 4.62, // rapid crossbow: 0.3 damage every 0.1 s, 4.62 usage points a second of firing
  furnaceMax: 50,       // ore a furnace holds
  wallHp: 150, gateHp: 200, // your own walls and gates: bears bite them
  wallBite: 15, wallBiteEvery: 1, // damage a bear does to a wall in its way, and how often      // seconds between shots with the handheld rocket gun      // stone for one rocket in the machine
  waveSize: 12,         // bears in the first huge wave
  waveGrow: 2,          // each wave after that has 2 more
  bearSpeed: 20,        // slow
  bearSpeedInside: 26,
  digEvery: 1,          // digging an ore patch by hand gives one ore a second
  drillEvery: 2,        // a drill digs one ore every 2 seconds
  poleReach: 7,         // power poles connect up to 7 tiles apart (and to generators that close)
  poleSupply: 2,        // buildings up to 2 tiles from a pole get its power
  pollution: { drill: 1, furnace: .6, asm: .4, gen: 1.5, machine: .5 } as Record<string, number>, // pollution a second while working
  pollutionFade: .02,   // 2% of the pollution clears every second
  queueMax: 30,         // crafts you can line up
};

/** The research tree. cost: research units; packs 1 = each unit takes a red science pack, 2 = a red and a green one.
 *  needs: research that has to be done first. */
export const RESEARCH = [
  { id: 'automation', name: 'Automation', desc: 'Leads on to nimble grabbers, green science and packed ammo', cost: 10, packs: 1, needs: [] },
  { id: 'craftspd', name: 'Crafting speed', desc: 'You and crafting machines craft 1.25x faster each level', cost: 30, packs: 1, needs: [] },
  { id: 'furnspd', name: 'Furnace speed', desc: 'Furnaces smelt 1.25x faster each level', cost: 30, packs: 1, needs: [] },
  { id: 'logistics', name: 'Logistics', desc: 'Leads on to quick belts and green science', cost: 15, packs: 1, needs: [] },
  { id: 'bricks', name: 'Brickwork', desc: 'Unlocks the brick turret and the brick gate', cost: 15, packs: 1, needs: [] },
  { id: 'sharp', name: 'Sharper bolts', desc: 'Your crossbow does 25% more damage', cost: 20, packs: 1, needs: [] },
  { id: 'walls', name: 'Bigger base', desc: 'Lets you move your walls out for more room', cost: 20, packs: 1, needs: [] },
  { id: 'picks', name: 'Strong picks', desc: 'You, your miners and drills dig 30% faster', cost: 25, packs: 1, needs: [] },
  { id: 'string', name: 'Tighter string', desc: 'Your crossbow reloads 20% faster', cost: 25, packs: 1, needs: ['sharp'] },
  { id: 'belts', name: 'Quick belts', desc: 'Belts move 50% faster', cost: 30, packs: 1, needs: ['logistics'] },
  { id: 'grab', name: 'Nimble grabbers', desc: 'Grabbers move things twice as fast', cost: 30, packs: 1, needs: ['automation'] },
  { id: 'logsci', name: 'Green science', desc: 'Unlocks green science packs, which the later research needs', cost: 30, packs: 1, needs: ['automation', 'logistics'] },
  { id: 'packed', name: 'Packed ammo', desc: 'Ammo machines make 7 stone ammo per stone instead of 5', cost: 40, packs: 1, needs: ['automation'] },
  { id: 'range', name: 'Long-range turrets', desc: 'Turrets reach 30% farther', cost: 40, packs: 2, needs: ['logsci'] },
  { id: 'cooling', name: 'Water cooling', desc: 'Unlocks pumps and pipes: turrets touching water pipes shoot twice as fast', cost: 30, packs: 2, needs: ['logsci'] },
  { id: 'armor', name: 'Leather armor', desc: 'Bears hurt you 25% less', cost: 40, packs: 2, needs: ['logsci'] },
  { id: 'heavy', name: 'Heavy turret bolts', desc: 'Turrets do 40% more damage', cost: 50, packs: 2, needs: ['range'] },
  { id: 'robots', name: 'Robots', desc: 'Unlocks robot hubs and robots, which carry things from chests', cost: 60, packs: 2, needs: ['logsci'] },
  { id: 'heal', name: 'Fast healing', desc: 'Heal 2% a second instead of 1.2%', cost: 60, packs: 2, needs: ['armor'] },
  { id: 'rapid', name: 'Rapid crossbow', desc: 'Unlocks the rapid crossbow: 0.75 damage every 0.05 s', cost: 60, packs: 2, needs: ['range'] },
  { id: 'rocket', name: 'Rocket launcher', desc: 'Unlocks the rocket launcher (70 damage) and the rocket recipe in ammo machines', cost: 80, packs: 2, needs: ['rapid'] },
] as const;
type ResId = typeof RESEARCH[number]['id'];
/** Research you can do again and again: each level costs 20 more packs, up to 980. */
const LEVELED: ResId[] = ['craftspd', 'furnspd'];
const levelCost = (lv: number) => Math.min(980, 30 + 20 * lv);
const LEVEL_MAX = 49; // the 49th level costs 980
/** Numbers that research can change; reset at the start of each run. */
const ST = { beltSpeed: 0, grabTime: 0, mineEvery: 0, minerEvery: 0, batchAmmo: 0, turretRange: 0, turretDamage: 0, heal: 0, boltMul: 1, reloadMul: 1, armor: 1, digMul: 1 };
function resetStats() {
  Object.assign(ST, { beltSpeed: SURVIVAL.beltSpeed, grabTime: SURVIVAL.grabTime, mineEvery: SURVIVAL.mineEvery, minerEvery: SURVIVAL.minerEvery, batchAmmo: SURVIVAL.batchAmmo, turretRange: SURVIVAL.turretRange, turretDamage: SURVIVAL.turretDamage, heal: SURVIVAL.heal, boltMul: 1, reloadMul: 1, armor: 1, digMul: 1 });
}
function applyResearch(id: ResId) {
  if (id === 'sharp') ST.boltMul = 1.25;
  else if (id === 'string') ST.reloadMul = .8;
  else if (id === 'belts') ST.beltSpeed = SURVIVAL.beltSpeed * 1.5;
  else if (id === 'grab') ST.grabTime = SURVIVAL.grabTime / 2;
  else if (id === 'picks') { ST.mineEvery = SURVIVAL.mineEvery * .7; ST.minerEvery = SURVIVAL.minerEvery * .7; ST.digMul = 1 / .7; }
  else if (id === 'packed') ST.batchAmmo = 7;
  else if (id === 'range') ST.turretRange = SURVIVAL.turretRange * 1.3;
  else if (id === 'heavy') ST.turretDamage = SURVIVAL.turretDamage * 1.4;
  else if (id === 'armor') ST.armor = .75;
  else if (id === 'heal') ST.heal = .02;
  // the rest unlock recipes; see RECIPES[].unlock
}
resetStats();

/** Crafting tabs. */
type RecCat = 'logistics' | 'production' | 'parts' | 'combat';
const REC_CATS: Record<RecCat, [string, string]> = { logistics: ['⏩', 'Logistics'], production: ['⛏️', 'Production'], parts: ['⚙️', 'Parts'], combat: ['🏹', 'Combat'] };
/** A recipe: what goes in, what comes out (n of it), and how many seconds it takes. hand: you can make it yourself;
 *  asm: an assembler can make it. unlock: the research it needs. Recipes without an out are special (done at once). */
interface Rec { id: string; cat: RecCat; out?: Kind; n: number; time: number; in: Cost; unlock?: ResId; asm: boolean; desc: string; }
/** Every recipe costs half what is written below (rounded up) and takes half the time. */
const half = (c: Cost) => Object.fromEntries((Object.entries(c) as [Kind, number][]).map(([k, q]) => [k, Math.ceil(q / 2)])) as Cost;
const R = (id: string, cat: RecCat, inp: Cost, time: number, n: number, desc: string, unlock?: ResId, asm = true): Rec => ({ id, cat, out: id as Kind, n, time: time / 2, in: half(inp), unlock, asm, desc });
const RECIPES: Rec[] = [
  // logistics
  R('belt', 'logistics', { stone: 4, gear: 2 }, .5, 2, 'Carries things (and you) along. Place it, then drag to lay a line. R turns it.'),
  R('grab', 'logistics', { circuit: 1, gear: 1, ironPlate: 1 }, .5, 1, 'Moves things from the tile behind it to the tile in front: off belts, into furnaces, out of chests.'),
  R('split', 'logistics', { circuit: 5, ironPlate: 5, belt: 4 }, 1, 1, 'Sends things left and right in turn, half each way.'),
  R('tunnel', 'logistics', { ironPlate: 10, belt: 5 }, 1, 2, 'Things go in one and come out the next one ahead, up to 6 tiles, under anything.'),
  R('chest', 'logistics', { stone: 8 }, .5, 1, 'Holds 200 things. T takes them out, or a grabber.'),
  R('pole', 'logistics', { stone: 1, wire: 2 }, .5, 2, 'Carries power from a generator. Buildings next to a pole get power; poles connect up to 7 tiles apart.'),
  R('pipe', 'logistics', { ironPlate: 1 }, .5, 1, 'Carries water from a pump to turrets.', 'cooling'),
  R('pump', 'logistics', { circuit: 2, gear: 1, pipe: 1 }, 2, 1, 'Pumps water into pipes. A turret touching wet pipes shoots twice as fast.', 'cooling'),
  R('hub', 'logistics', { circuit: 20, gear: 20, ironPlate: 20 }, 5, 1, 'Robots live here and bring things from chests to turrets, labs, machines and buildings. Comes with 2 robots.', 'robots'),
  R('robot', 'logistics', { circuit: 3, gear: 2, ironPlate: 2 }, 2, 1, 'One more robot. Press T next to a robot hub to put it in.', 'robots'),
  // production
  R('drill', 'production', { circuit: 3, gear: 5, ironPlate: 10 }, 2, 1, 'Put it on an ore patch and it digs by itself, dropping the ore in front. Needs power.'),
  R('furnace', 'production', { stone: 5 }, .5, 1, 'Smelts ore: iron and copper into plates, gold into bars, diamonds into cut diamonds, stone into bricks.'),
  R('machine', 'production', { gear: 10, circuit: 5, stone: 20 }, 3, 1, 'Makes ammo out of stone, plates, gold bars and cut diamonds (or rockets once researched).'),
  { ...R('asm', 'production', {}, .5, 1, 'Tap it to pick a recipe, then put the ingredients in (or let grabbers bring them). It keeps crafting that recipe, 4 times slower than by hand, until you change it. Needs power.'), in: { ironPlate: 10, stone: 5 } },
  R('gen', 'production', { gear: 8, ironPlate: 10, stone: 5 }, 2, 1, 'Burns stone for power, which poles carry to drills, assemblers and labs.'),
  R('lab', 'production', { circuit: 10, gear: 10, belt: 4 }, 2, 1, 'Uses science packs to research. Y picks what. Needs power.'),
  // parts
  R('gear', 'parts', { ironPlate: 2 }, .5, 2, 'A part for belts, grabbers, drills, turrets and lots more.'),
  R('wire', 'parts', { copperPlate: 1 }, .5, 4, 'A part for circuits and power poles.'),
  R('circuit', 'parts', { ironPlate: 1, wire: 3 }, .5, 1, 'A part for grabbers, drills, assemblers and labs.'),
  R('pack', 'parts', { copperPlate: 1, gear: 1 }, 5, 1, 'Red science. Labs use it for research.'),
  R('pack2', 'parts', { grab: 1, belt: 1 }, 6, 1, 'Green science. The later research needs it as well as red.', 'logsci'),
  // combat
  R('turret', 'combat', { gear: 5, ironPlate: 5, stone: 10 }, 3, 1, 'Shoots bears and spawners: 1 damage a shot, a shot every 0.2 s, using 16% of an ammo a shot. Load ammo with T, or feed it with belts and grabbers.'),
  R('bturret', 'combat', { turret: 1, brick: 10 }, 2, 1, 'A turret that reaches farther.', 'bricks'),
  R('rapid', 'combat', { ironPlate: 10, stone: 50 }, 3, 1, '0.75 damage every 0.05 seconds; each shot uses 0.8% of one ammo.', 'rapid'),
  R('wall', 'combat', { stone: 5 }, .5, 1, 'Build your own base: you can walk through it, bears can\'t. Bears bite walls in their way. Drag to place a row.', undefined, true),
  R('pgate', 'combat', { wall: 1, gear: 2 }, 1, 1, 'A stronger piece of wall (200 health instead of 150).', undefined, true),
  { ...R('ammo', 'combat', { stone: 1 }, 2, SURVIVAL.batchAmmo - 1, 'Stone ammo made by hand: 1 less than an ammo machine makes.', undefined, false), time: .5 },
  { ...R('ironAmmo', 'combat', { ironPlate: 1 }, 2, 5, 'Iron ammo made by hand: 1 less than an ammo machine makes.', undefined, false), time: .5 },
  { ...R('copperAmmo', 'combat', { copperPlate: 1 }, 2, 7, 'Copper ammo made by hand: 1 less than an ammo machine makes.', undefined, false), time: .5 },
  { ...R('goldAmmo', 'combat', { goldBar: 1 }, 2, 11, 'Gold ammo made by hand: 1 less than an ammo machine makes.', undefined, false), time: .5 },
  { ...R('diamondAmmo', 'combat', { gem: 1 }, 2, 15, 'Diamond ammo made by hand: 1 less than an ammo machine makes.', undefined, false), time: .5 },
  { ...R('mgun', 'combat', {}, 6, 1, 'A machine gun you hold: while you hold Space it shoots every 0.2 s, using 0.5% of an ammo a shot. Damage a shot: 1.4 stone, 1.5 copper, 1.8 iron, 2 gold, 2.25 diamond. Put it in a weapon slot.', undefined, false), in: { stone: 1000, ironPlate: 500 } },
  R('rxbow', 'combat', { stone: 200, ironPlate: 20 }, 6, 1, 'A crossbow you hold that fires very fast while you hold Space: 0.3 damage every 0.1 s. It uses ammo slowly (4.62 of an ammo\'s 100 usage points a second). Put it in a weapon slot.', undefined, false),
  R('xbow', 'combat', { stone: 20 }, 2, 1, 'A plain crossbow you hold. One ammo a shot; with no ammo it fires your loadout bolts.', undefined, false),
  R('rgun', 'combat', { ironPlate: 10, gear: 5, circuit: 3 }, 4, 1, 'A rocket launcher you hold: 70 damage a rocket. Put it in a weapon slot and rockets in an ammo slot.', 'rocket', false),
  R('launcher', 'combat', { ironPlate: 20, stone: 40 }, 4, 1, 'Fires swirling rockets for 70 damage, far enough to reach spawners. Load rockets with T.', 'rocket'),
  { id: 'gate', cat: 'combat', n: 1, time: 0, in: { brick: 30 }, unlock: 'bricks', asm: false, desc: 'Bears wait 10 seconds longer at the gates.' },
  { id: 'expand', cat: 'combat', n: 1, time: 0, in: { stone: 40 }, unlock: 'walls', asm: false, desc: 'Moves your walls out for more room.' },
];
const REC = Object.fromEntries(RECIPES.map(r => [r.id, r])) as Record<string, Rec>;
/** The recipe that makes a thing, if you can make it. */
const recFor = (k: Kind) => RECIPES.find(r => r.out === k);

export type AmmoId = 'normal' | 'quick' | 'heavy';
export const AMMO: Record<AmmoId, { name: string; reload: number; damage: number; color: string; desc: string }> = {
  normal: { name: 'Normal', reload: 3, damage: 3.5, color: '#e8d9b8', desc: '3 s reload, 3.5 damage' },
  quick: { name: 'Quick', reload: 1.5, damage: 2.1, color: '#9fe6ff', desc: '1.5 s reload, 2.1 damage' },
  heavy: { name: 'Heavy', reload: 5, damage: 5.25, color: '#ff9a6a', desc: '5 s reload, 5.25 damage' },
};
export type HatId = 'none' | 'cap' | 'helmet' | 'crown';
export const HATS: Record<HatId, string> = { none: 'No hat', cap: 'Cap', helmet: 'Helmet', crown: 'Crown' };
export const COLORS = ['#3f7fd6', '#d64545', '#3ea860', '#e0a32e', '#8e5bd6', '#e06aa8', '#30b8b0', '#f2f2f2'];
export interface Loadout { name: string; color: string; hat: HatId; ammo: AmmoId; }
export interface SurvivalResult { time: number; kills: number; shots: number; hits: number; damage: number; won: boolean; spawners: number; }

// world layout (world units). The map is much bigger than the screen; the camera follows the guy.
const W = 6600, H = 6600;
/** The middle of the map, where the camp is. The old map was 1800 wide with the camp at 900; everything is offset by OFF. */
const CX = W / 2, CY = H / 2, OFF = CX - 900;
/** How much of the map the screen shows at once (it is scaled to fit). */
const VIEW_W = 640, VIEW_H = 800;
/** The base's walls. They move out when the base is expanded, so this object changes during a run. */
const BASE_WALL = { x0: 710 + OFF, x1: 1090 + OFF, y0: 670 + OFF, y1: 1130 + OFF };
const EXPANSIONS = [BASE_WALL, { x0: 665 + OFF, x1: 1135 + OFF, y0: 670 + OFF, y1: 1153 + OFF }, { x0: 620 + OFF, x1: 1180 + OFF, y0: 670 + OFF, y1: 1176 + OFF }];
const WALL = { ...BASE_WALL, t: 14 };
const GATE = { x: CX, w: 74 };
/** Gates: the first one at the top; 3 more (one per other side) after 8 minutes; 3 more after 20 minutes. */
const FIRST_GATES: [Gate['side'], number][] = [[0, .5]];
const MORE_GATES: [Gate['side'], number][] = [[1, .5], [2, .5], [3, .5]]; // sides: 0 top, 1 right, 2 bottom, 3 left
const LAST_GATES: [Gate['side'], number][] = [[1, .2], [3, .2], [2, .25]];
/** The middle of a gate, the way out from it, and points just outside and inside it. */
function gateAt(g: Gate) {
  const { x0, x1, y0, y1, t } = WALL;
  const pos = [[x0 + (x1 - x0) * g.at, y0 + t / 2], [x1 - t / 2, y0 + (y1 - y0) * g.at], [x0 + (x1 - x0) * g.at, y1 - t / 2], [x0 + t / 2, y0 + (y1 - y0) * g.at]][g.side];
  const [nx, ny] = [[0, -1], [1, 0], [0, 1], [-1, 0]][g.side];
  const [x, y] = pos, k = BEAR_R + 20;
  return { x, y, nx, ny, ox: x + nx * k, oy: y + ny * k, ix: x - nx * k, iy: y - ny * k };
}
/** Is (x, y) inside the fence? */
/** No camp: no fence, no gates; bears come straight for you. (false brings the old walled camp back.) */
const NO_BASE = true;
const insideBase = (x: number, y: number) => !NO_BASE && x > WALL.x0 && x < WALL.x1 && y > WALL.y0 && y < WALL.y1;
const GUY_R = 13, BEAR_R = 18, STONE = '#a9a59c';
// belts sit on a grid inside the walls
// the grid covers the biggest base; only tiles inside the current walls can be used
const BIGGEST = EXPANSIONS[EXPANSIONS.length - 1];
// the tile grid covers the whole map; it lines up with the old camp-only grid, which started OLD_C columns and OLD_R rows in
const TILE = 24, OLD_C = Math.floor((BIGGEST.x0 + WALL.t) / TILE), OLD_R = Math.floor((BIGGEST.y0 + WALL.t) / TILE);
const GX0 = BIGGEST.x0 + WALL.t - OLD_C * TILE, GY0 = BIGGEST.y0 + WALL.t - OLD_R * TILE;
const COLS = Math.floor((W - GX0) / TILE), ROWS = Math.floor((H - GY0) / TILE);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const; // right, down, left, up
/** Raw ore you dig, and what it smelts into in a furnace. */
export type Ore = 'iron' | 'copper' | 'gold' | 'diamond';
const ORES: Ore[] = ['iron', 'copper', 'gold', 'diamond'];
/** Ammo you can shoot or load into turrets: stone ammo ('ammo') or metal ammo. */
type AmmoKind = 'ammo' | 'ironAmmo' | 'copperAmmo' | 'goldAmmo' | 'diamondAmmo';
/** Everything you can carry, in the order the inventory shows it. Buildings are things too. */
const ITEMS = ['stone', 'iron', 'copper', 'gold', 'diamond', 'brick', 'ironPlate', 'copperPlate', 'goldBar', 'gem', 'gear', 'wire', 'circuit', 'pack', 'pack2',
  'ammo', 'ironAmmo', 'copperAmmo', 'goldAmmo', 'diamondAmmo', 'rocket', 'rgun', 'xbow', 'rxbow', 'mgun',
  'belt', 'grab', 'split', 'tunnel', 'chest', 'pole', 'drill', 'mine', 'furnace', 'machine', 'asm', 'lab', 'gen', 'pump', 'pipe', 'hub', 'robot', 'turret', 'bturret', 'rapid', 'launcher', 'wall', 'pgate'] as const;
type Kind = typeof ITEMS[number];
/** Things you can put down on the map. */
type Placeable = 'belt' | 'grab' | 'split' | 'tunnel' | 'chest' | 'pole' | 'drill' | 'mine' | 'furnace' | 'machine' | 'asm' | 'lab' | 'gen' | 'pump' | 'pipe' | 'hub' | 'turret' | 'bturret' | 'rapid' | 'launcher' | 'wall' | 'pgate';
const PLACEABLES: Placeable[] = ['belt', 'grab', 'split', 'tunnel', 'chest', 'pole', 'drill', 'mine', 'furnace', 'machine', 'asm', 'lab', 'gen', 'pump', 'pipe', 'hub', 'turret', 'bturret', 'rapid', 'launcher', 'wall', 'pgate'];
const isPlaceable = (k: string): k is Placeable => (PLACEABLES as string[]).includes(k);
/** Each metal: its smelted form, and how much ammo one of those makes in a machine (and its damage). Diamonds are our own guess. */
export const METAL: Record<Ore, { per: number; dmg: number; ammo: AmmoKind; plate: Kind; name: string; color: string }> = {
  iron: { per: 6, dmg: 9.5, ammo: 'ironAmmo', plate: 'ironPlate', name: 'Iron', color: '#c9ccd2' },
  copper: { per: 8, dmg: 8.55, ammo: 'copperAmmo', plate: 'copperPlate', name: 'Copper', color: '#e08a4a' },
  gold: { per: 12, dmg: 11.5, ammo: 'goldAmmo', plate: 'goldBar', name: 'Gold', color: '#ffd34a' },
  diamond: { per: 16, dmg: 15, ammo: 'diamondAmmo', plate: 'gem', name: 'Diamond', color: '#8ff0ff' },
};
/** What a furnace makes out of each thing. */
const SMELT: Partial<Record<Kind, Kind>> = { stone: 'brick', iron: 'ironPlate', copper: 'copperPlate', gold: 'goldBar', diamond: 'gem' };
/** What goes into the ammo machine: stone, or a smelted metal. */
const plateOre = (k: Kind): Ore | null => ORES.find(o => METAL[o].plate === k) ?? null;
const MACHINE_IN: Kind[] = ['stone', 'ironPlate', 'copperPlate', 'goldBar', 'gem'];
/** What an ammo machine can be set to make. It takes nothing until a recipe is picked, then only that recipe's input. */
type MRec = 'stone' | 'iron' | 'copper' | 'gold' | 'diamond' | 'rocket';
const MRECS: MRec[] = ['stone', 'iron', 'copper', 'gold', 'diamond', 'rocket'];
const MREC_IN: Record<MRec, Kind> = { stone: 'stone', iron: 'ironPlate', copper: 'copperPlate', gold: 'goldBar', diamond: 'gem', rocket: 'stone' };
const MREC_OUT: Record<MRec, Kind> = { stone: 'ammo', iron: 'ironAmmo', copper: 'copperAmmo', gold: 'goldAmmo', diamond: 'diamondAmmo', rocket: 'rocket' };
/** Best ammo first: turrets and the auto-pick use them in this order. */
const AMMO_KINDS: AmmoKind[] = ['diamondAmmo', 'goldAmmo', 'ironAmmo', 'copperAmmo', 'ammo'];
const AMMO_NAME: Record<AmmoKind, string> = { ammo: 'Stone', ironAmmo: 'Iron', copperAmmo: 'Copper', goldAmmo: 'Gold', diamondAmmo: 'Diamond' };
const metalOf = (a: AmmoKind) => METAL[ORES.find(o => METAL[o].ammo === a)!];
const isAmmoKind = (k: Kind): k is AmmoKind => (AMMO_KINDS as Kind[]).includes(k);
/** Weapons you hold, and what they shoot. */
type Weapon = 'xbow' | 'rxbow' | 'rgun' | 'mgun';
const WEAPONS: Weapon[] = ['xbow', 'rxbow', 'mgun', 'rgun'];
const isWeapon = (k: Kind | null): k is Weapon => !!k && (WEAPONS as Kind[]).includes(k);
type Shot = AmmoKind | 'rocket';
const isShot = (k: Kind | null): k is Shot => !!k && (k === 'rocket' || isAmmoKind(k));
const fits = (w: Weapon, k: Shot) => (w === 'rgun') === (k === 'rocket');
/** An ammo slot: one kind of ammo, as usage points (100 for each ammo in it). */
interface AmmoSlot { k: Shot; pts: number; }
type Cost = Partial<Record<Kind, number>>;
export const costText = (c: Cost) => (Object.entries(c) as [Kind, number][]).map(([k, n]) => `${n} ${KIND_NAME[k]}`).join(' + ');
interface Item { x: number; y: number; gone?: boolean; k: Kind; skip?: string; }
const KINDS: Kind[] = [...ITEMS];
/** A bag of things: your pocket, or what a chest holds. */
type Bag = Record<Kind, number>;
const emptyBag = (): Bag => Object.fromEntries(KINDS.map(k => [k, 0])) as Bag;
type Chest = Bag;
const chestN = (ch: Bag) => KINDS.reduce((a, k) => a + (ch[k] || 0), 0);
const KIND_NAME: Record<Kind, string> = {
  stone: 'stone', iron: 'iron ore', copper: 'copper ore', gold: 'gold ore', diamond: 'rough diamonds', brick: 'bricks', ironPlate: 'iron plates', copperPlate: 'copper plates', goldBar: 'gold bars', gem: 'cut diamonds',
  gear: 'gears', wire: 'wire', circuit: 'circuits', pack: 'red science packs', pack2: 'green science packs',
  ammo: 'stone ammo', ironAmmo: 'iron ammo', copperAmmo: 'copper ammo', goldAmmo: 'gold ammo', diamondAmmo: 'diamond ammo', rocket: 'rockets', rgun: 'rocket guns', xbow: 'crossbows', rxbow: 'rapid crossbows', mgun: 'machine guns',
  belt: 'belts', grab: 'grabbers', split: 'splitters', tunnel: 'underground belts', chest: 'chests', pole: 'power poles', drill: 'drills', mine: 'stone mines', furnace: 'furnaces', machine: 'ammo machines', asm: 'crafting machines', lab: 'labs', gen: 'generators', pump: 'water pumps', pipe: 'pipes', hub: 'robot hubs', robot: 'robots', turret: 'turrets', bturret: 'brick turrets', rapid: 'rapid crossbow turrets', launcher: 'rocket launchers', wall: 'walls', pgate: 'gates',
};
/** One of a thing, for labels: "Iron plate". */
const ONE_NAME: Record<Kind, string> = {
  stone: 'Stone', iron: 'Iron ore', copper: 'Copper ore', gold: 'Gold ore', diamond: 'Rough diamond', brick: 'Brick', ironPlate: 'Iron plate', copperPlate: 'Copper plate', goldBar: 'Gold bar', gem: 'Cut diamond',
  gear: 'Gear', wire: 'Wire', circuit: 'Circuit', pack: 'Red science pack', pack2: 'Green science pack',
  ammo: 'Stone ammo', ironAmmo: 'Iron ammo', copperAmmo: 'Copper ammo', goldAmmo: 'Gold ammo', diamondAmmo: 'Diamond ammo', rocket: 'Rocket', rgun: 'Rocket gun', xbow: 'Crossbow', rxbow: 'Rapid crossbow', mgun: 'The machine gun',
  belt: 'Belt', grab: 'Grabber', split: 'Splitter', tunnel: 'Underground belt', chest: 'Chest', pole: 'Power pole', drill: 'Drill', mine: 'Stone mine', furnace: 'Furnace', machine: 'Ammo machine', asm: 'Crafting machine', lab: 'Lab', gen: 'Generator', pump: 'Water pump', pipe: 'Pipe', hub: 'Robot hub', robot: 'Robot', turret: 'Turret', bturret: 'Brick turret', rapid: 'Rapid crossbow turret', launcher: 'Rocket launcher', wall: 'Wall', pgate: 'Gate',
};
/** A grabber picks a thing up from the tile behind it and puts it down on the tile in front. */
interface Grabber { d: number; t: number; carry: boolean; k: Kind; }
/** A turret shoots the nearest bear or spawner in range (or the one you picked), one ammo a shot.
 *  kind: a plain turret, a brick turret, a rapid crossbow or a rocket launcher (which only takes rockets). */
type TKind = 'turret' | 'brick' | 'rapid' | 'rocket';
interface Turret { ammo: Partial<Record<AmmoKind | 'rocket', number>>; cd: number; face: number; kind: TKind; cool?: boolean; target?: Target | null; }
const T_ITEM: Record<TKind, Placeable> = { turret: 'turret', brick: 'bturret', rapid: 'rapid', rocket: 'launcher' };
const ITEM_T: Partial<Record<Placeable, TKind>> = { turret: 'turret', bturret: 'brick', rapid: 'rapid', launcher: 'rocket' };
const tAmmo = (tu: Turret) => Object.values(tu.ammo).reduce((a, n) => a + (n ?? 0), 0);
/** One-tile buildings. */
type BType = 'furnace' | 'gen' | 'pump' | 'pipe' | 'asm' | 'tunnel' | 'hub' | 'drill' | 'pole';
const BTYPES: BType[] = ['furnace', 'gen', 'pump', 'pipe', 'asm', 'tunnel', 'hub', 'drill', 'pole'];
const BNAME: Record<BType, string> = { furnace: 'Furnace', gen: 'Generator', pump: 'Pump', pipe: 'Pipe', asm: 'Crafting machine', tunnel: 'Underground belt', hub: 'Robot hub', drill: 'Drill', pole: 'Power pole' };
/** Buildings that need power to run. */
const ELECTRIC: BType[] = ['drill', 'asm'];
/** Hotkeys for placing things (the quickbar also has 1 to 0). */
const PLACE_KEY: Partial<Record<Placeable, string>> = { belt: 'E', grab: 'G', split: 'X', tunnel: 'Q', chest: 'C', pole: 'O', drill: 'N', furnace: 'F', machine: 'K', asm: 'A', lab: 'L', gen: 'V', pump: 'W', pipe: 'I', turret: 'U', bturret: 'J' };
/** A one-tile building. inp/inpK: what's waiting to go in (one kind at a time), out/outK: what it made.
 *  buf: an assembler's ingredients. recipe: what an assembler makes. pi: the ore patch a drill sits on. */
interface Bld { on?: boolean; type: BType; d: number; inp: number; inpK?: Kind; out: number; outK?: Kind; t: number; fuel: number; recipe: string; robots: number; buf?: Cost; pi?: number; }
/** A flying robot that carries one thing from a chest to whatever needs it. */
interface Robot { x: number; y: number; hub: string; k: Kind | null; src: { x: number; y: number; take: () => boolean; kind?: Kind } | null; dst: { x: number; y: number; give: () => boolean; id: string } | null; }
const KIND_DOT: Record<Kind, string> = Object.fromEntries(KINDS.map(k => [k, '#d0ccc2'])) as Record<Kind, string>;
Object.assign(KIND_DOT, { ammo: '#7fc8ff', brick: '#d97a5a', pack: '#e0524a', pack2: '#5fbf86', iron: METAL.iron.color, copper: METAL.copper.color, gold: METAL.gold.color, diamond: METAL.diamond.color, ironPlate: METAL.iron.color, copperPlate: METAL.copper.color, goldBar: METAL.gold.color, gem: METAL.diamond.color, ironAmmo: METAL.iron.color, copperAmmo: METAL.copper.color, goldAmmo: METAL.gold.color, diamondAmmo: METAL.diamond.color, rocket: '#ff6a4a', gear: '#9aa0a6', wire: '#e08a4a', circuit: '#4caf50' });
/** A lab and the science packs in it. */
interface Lab { packs: number; packs2?: number; t: number; }
/** A splitter takes things in and sends them out to its left and right in turn. */
interface Splitter { d: number; buf: Kind[]; side: number; t: number; }
// where hired miners stand, relative to the mine
const MINER_SPOTS = [[-4, 30], [32, 22], [-30, 26], [36, -8], [8, -32], [-32, -14]] as const;
const MINE_R = 24, MACHINE_R = 26, NEAR = 58;
const FIRST_MINE = { x: BASE_WALL.x0 + 62, y: BASE_WALL.y0 + 95 }, FIRST_MACHINE = { x: BASE_WALL.x1 - 62, y: BASE_WALL.y0 + 215 };
interface Spot { x: number; y: number; r: number; }
/** A mine: stone, or one of the metals (metal mines only come from old saves). */
interface Mine extends Spot { ore: 'stone' | Ore; }
/** An ammo machine and its work: stone or smelted metal waiting, the batch timer, things made waiting for a grabber,
 *  and its recipe for stone: stone ammo, or (once researched) a rocket from 10 stone. */
interface Machine extends Spot { queue: Kind[]; batchT: number; out: Kind[]; recipe: MRec | null; }
/** A patch of ore out in the woods: dig it by hand or put drills on it. It runs out. */
interface Patch { sq?: number; x: number; y: number; r: number; ore: 'stone' | Ore; left: number; max: number; seed: number; }
/** Everything big in the camp (mines, machines), which belts can't go on. Kept up to date by the game. */
let structs: Spot[] = [];

/** walk: to a spot outside its gate; wait: there; enter: through the gate; chase: after you, anywhere. */
type BearState = 'walk' | 'wait' | 'enter' | 'chase' | 'dead';
/** A wall or gate you built on a tile: bears can't pass either, you can pass a gate. */
interface PWall { hp: number; gate: boolean; }
interface Bear { fish?: boolean; gr?: number; wb?: number; tc: number; id: number; x: number; y: number; hp: number; state: BearState; wait: number; tx: number; ty: number; cd: number; face: number; swipe: number; hurt: number; dead: number; step: number; gate: Gate; wave: boolean; }
/** A bear spawner in the woods: a den that makes bears. */
/** respawn: seconds until a destroyed spawner comes back somewhere else. */
interface Spawner { pre?: boolean; x: number; y: number; hp: number; t: number; hurt: number; dead: boolean; respawn?: number; }
type Target = Bear | Spawner;
const isBear = (t: Target): t is Bear => 'state' in t;
const alive = (t: Target) => isBear(t) ? t.state !== 'dead' : !t.dead;
const SPAWNER_R = 26;
/** Things that take up a big round spot (mines and machines), not a tile. */
const isBig = (p: Placeable) => p === 'mine' || p === 'machine';
/** A gate in the fence: which side, and where along it (0 to 1). */
interface Gate { side: 0 | 1 | 2 | 3; at: number; open: number; }
interface Bolt { from?: string; stone: boolean; x: number; y: number; vx: number; vy: number; left: number; dmg: number; target: Target | null; color?: string; }
/** A rocket swirls round a loop, then homes in on its target. */
interface Rocket { from?: string; x: number; y: number; a: number; t: number; spin: number; target: Target | null; trail: { x: number; y: number }[]; }
interface Rock { x: number; y: number; vx: number; vy: number; left: number; spin: number; }
interface Bubble { x: number; y: number; text: string; t: number; kind: 'loss' | 'dmg' | 'info' | 'tiny'; }

/** A saved run, as plain JSON. */
export type SaveData = Record<string, unknown>;

export interface SurvivalHooks { over(r: SurvivalResult): void; pause(): void; }

export class Survival {
  running = false;
  paused = false;
  private ctx: CanvasRenderingContext2D;
  private load!: Loadout;
  private hp = SURVIVAL.maxHp;
  private x = CX; private y = CY + 40; private face = -Math.PI / 2;
  private reload = 0;
  private bears: Bear[] = [];
  private bolts: Bolt[] = [];
  private bubbles: Bubble[] = [];
  private t = 0; private healT = 0; private waveT = 0; private waveN = 0; private waveLeft = 0; private waveGap = 0; private waveWarned = false; private nextId = 1; private kills = 0;
  private shots = 0; private hits = 0; private damage = 0;
  private hurtFlash = 0; private walk = 0;
  private gates: Gate[] = []; private spawners: Spawner[] = []; private rockets: Rocket[] = []; private spawnerKills = 0;
  private gateStage = 0; private camX = CX; private camY = CY; private walls: Rect[] = [];
  /** The turret you tapped: tap a bear or spawner next to make it the turret's target. */
  private picked: string | null = null;
  private bag: Bag = emptyBag();
  /** The weapon and ammo slots at the bottom left: 3 weapons on top, 3 kinds of ammo under them; the picked one of each is used. */
  private weapons: (Weapon | null)[] = ['xbow', null, null]; private wSel = 0;
  private ammoSlots: (AmmoSlot | null)[] = [null, null, null]; private aSel = 0;
  /** Space (or the Shoot bear button) held down: keep firing. */
  private fireHeld = false; private rxT = 0; private firingAt: Target | null = null; private firingEnd: { x: number; y: number } | null = null;
  private sparks: { x: number; y: number; t: number }[] = []; private noAmmoT = 0;
  /** How many bears gather before they all attack. */
  private groupSize = 8;
  /** Acid: slime in the air, puddles on the ground, and the burn you have (damage a second, seconds left). */
  private slimes: { x: number; y: number; tx: number; ty: number; t: number }[] = [];
  private puddles: { x: number; y: number; t: number }[] = [];
  private acidRate = 0; private acidT = 0; private acidShown = 0; private acidShowT = 0; private stepT = 0;
  private recipeFor: Machine | null = null;
  private keys = new Set<string>();
  private stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private scale = 1; private ox = 0; private oy = 0; private cw = 0;
  private decor: { x: number; y: number; r: number; k: number }[] = [];
  /** Trees and bushes standing on this run's ore patches aren't drawn. */
  private decorOff: { of: Patch[]; set: Set<number> } | null = null;
  private noTargetT = 0;
  private rocks: Rock[] = [];
  private gateWait = SURVIVAL.gateWait;
  private mineOn = false; private mining = false; private mineT = 0; private swing = 0;
  private belts = new Map<string, number>(); private items: Item[] = []; private placing = false; private placeDir = 0;
  private placeType: Placeable = 'belt'; private splitters = new Map<string, Splitter>(); private chests = new Map<string, Chest>(); private pwalls = new Map<string, PWall>(); private mines: Mine[] = []; private machines: Machine[] = []; private mineAt: Mine | null = null; private expansion = 0;
  private labs = new Map<string, Lab>(); private researching: ResId | null = null; private progress: Record<string, number> = {}; private lv: Record<string, number> = {}; private done = new Set<ResId>(); labOpen = false;
  private blds = new Map<string, Bld>(); private brickGate = false; private robots: Robot[] = []; private robotT = 0; private coolT = 0; private tap: { id: number; x: number; y: number; t: number } | null = null;
  private turrets = new Map<string, Turret>(); private grabbers = new Map<string, Grabber>();
  /** Ore patches out in the woods, and the one you're digging by hand. */
  private patches: Patch[] = []; private digAt: Patch | null = null;
  /** Things being crafted, first one first. Each has the raw things it took (given back if cancelled). */
  private queue: { id: string; b: number; t: number; internal: number; raw: Cost; job: number; top: boolean }[] = []; private jobN = 0;
  /** The quickbar: 10 slots of things to place. */
  private quick: (Kind | null)[] = Array(10).fill(null);
  /** The thing in your hand (picked in the inventory or the quickbar): D puts one of it into whatever is in front of you. */
  private hand: Kind | null = null;
  /** Pollution from your factory; the more there is, the more bears come and the tougher they are. */
  private pollution = 0;
  /** Which tiles have power, worked out every half second. */
  private powerT = 0; private poweredSet = new Set<string>(); private poleLinks: [string, string][] = [];
  /** The building whose panel is open (an assembler or a furnace). */
  private bldOpen: string | null = null;
  private dragPlace: { id: number; last: string } | null = null;
  private hover: { c: number; r: number; t: number } | null = null; shopOpen = false; helpText = 'Drag anywhere to walk';
  private miners: number[] = []; private popT = 0;

  constructor(private canvas: HTMLCanvasElement, private pad: HTMLElement, private hooks: SurvivalHooks) {
    this.ctx = canvas.getContext('2d')!;
    // fixed scenery: trees and bushes outside the walls, tufts inside
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const big = EXPANSIONS[EXPANSIONS.length - 1];
    for (let i = 0; i < 420 * (W * H) / (1800 * 1800); i++) {
      const x = rnd() * W, y = rnd() * H;
      const inBase = x > big.x0 - 40 && x < big.x1 + 40 && y > big.y0 - 40 && y < big.y1 + 40;
      const nearGate = Math.abs(x - GATE.x) < 120 && y < WALL.y0;
      if (inBase) { if (x > WALL.x0 + 30 && x < WALL.x1 - 30 && y > WALL.y0 + 30 && y < WALL.y1 - 30) this.decor.push({ x, y, r: 3 + rnd() * 3, k: 2 }); continue; }
      if (nearGate) continue;
      this.decor.push({ x, y, r: 10 + rnd() * 14, k: rnd() < .55 ? 0 : 1 });
    }
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    const up = (e: PointerEvent) => {
      if (this.stick && this.stick.id === e.pointerId) this.stick = null;
      if (this.dragPlace && this.dragPlace.id === e.pointerId) this.dragPlace = null;
      // a quick tap (not a drag): on a turret it picks the turret (tap a bear or spawner next to aim it,
      // or the turret again to pick it up); on a belt, grabber or anything else you placed, picks it up
      const tp = this.tap; this.tap = null;
      if (tp && tp.id === e.pointerId && e.type === 'pointerup' && Math.hypot(e.offsetX - tp.x, e.offsetY - tp.y) < 10 && e.timeStamp - tp.t < 400 && this.running && !this.paused && !this.shopOpen && !this.labOpen && !this.recipeFor) {
        this.tapAt((e.offsetX - this.ox) / this.scale, (e.offsetY - this.oy) / this.scale);
      }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    const btn = (id: string, f: () => void) => pad.querySelector<HTMLElement>(id)!.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (this.running && !this.paused) f(); });
    btn('#svTarget', () => { this.fireHeld = true; this.shoot(true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) pad.querySelector('#svTarget')!.addEventListener(ev, () => { this.fireHeld = false; });
    pad.querySelector('#svArms')!.addEventListener('click', e => this.armsClick(e));
    pad.querySelector('#svArms')!.addEventListener('pointerdown', e => e.stopPropagation());
    btn('#svFree', () => this.shoot(false));
    btn('#svPause', () => this.hooks.pause());
    btn('#svMine', () => this.action());
    btn('#svAmmoBtn', () => this.switchAmmo());
    btn('#svHire', () => this.hire());
    btn('#svShopBtn', () => this.openShop());
    btn('#svLoad', () => this.useNear());
    btn('#svDrop', () => this.dropOne());
    pad.querySelector('#svQuick')!.addEventListener('pointerdown', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-q]'); e.preventDefault(); e.stopPropagation();
      if (el && this.running && !this.paused) this.useQuick(Number(el.dataset.q));
    });
    pad.querySelector('#svQueue')!.addEventListener('pointerdown', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-job]'); e.preventDefault(); e.stopPropagation();
      if (el && this.running && !this.paused) this.cancelJob(Number(el.dataset.job));
    });
    pad.querySelector('#svBld')!.addEventListener('click', e => this.bldClick(e as MouseEvent));
    pad.querySelector('#svBld')!.addEventListener('pointerdown', e => e.stopPropagation());
    pad.querySelector('#svRecSeg')!.addEventListener('click', e => { e.stopPropagation(); const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mrec]'); if (b) this.setRecipe(b.dataset.mrec as MRec); });
    pad.querySelector('#svRecPut')!.addEventListener('click', e => { e.stopPropagation(); const m = this.recipeFor; this.closeRecipe(); if (m) this.useMachine(m); });
    pad.querySelector('#svRecPick')!.addEventListener('click', e => { e.stopPropagation(); const m = this.recipeFor; this.closeRecipe(); if (!m) return; if (dist(this.x, this.y, m.x, m.y) > NEAR * 1.6) { this.bubble(m.x, m.y - 36, 'Walk to the machine to pick it up', 'info'); Sound.denied(); return; } this.pickUpBig(m); });
    pad.querySelector('#svRecClose')!.addEventListener('click', e => { e.stopPropagation(); this.closeRecipe(); });
    btn('#svLabBtn', () => this.openLab());
    btn('#svRotate', () => this.rotate());
    pad.querySelector('#svLabClose')!.addEventListener('click', e => { e.stopPropagation(); this.closeLab(); });
    pad.querySelector('#svResList')!.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-res]'); if (b) { e.stopPropagation(); this.pickResearch(b.dataset.res as ResId); } });
    pad.querySelector('#svShopClose')!.addEventListener('click', e => { e.stopPropagation(); this.closeShop(); });
    pad.querySelector('#svShop')!.addEventListener('click', e => this.invClick(e as MouseEvent));
    pad.querySelector('#svShop')!.addEventListener('pointerdown', e => e.stopPropagation());
    addEventListener('keydown', e => {
      if (!this.running || this.paused) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (this.labOpen) { if (k === 'y' || k === 'Escape') this.closeLab(); return; }
      if (this.bldOpen) { if (k === 't' || k === 'Escape') this.closeBld(); return; }
      if (this.recipeFor) { const n = '123456'.indexOf(k); if (k === 'm' || k === 'Escape') this.closeRecipe(); else if (n >= 0 && this.mrecs()[n]) this.setRecipe(this.mrecs()[n]); return; }
      if (this.shopOpen) { if ((k === 'Shift' || k === 'b' || k === 'Escape') && !e.repeat) this.closeShop(); else if (k === 'Enter' && !e.repeat) this.craft(this.invSel); return; }
      if (k === 'Shift' || k === 'b') { if (!e.repeat) this.openShop(); return; }
      const qn = '1234567890'.indexOf(k);
      if (qn >= 0) { if (!e.repeat) this.useQuick(qn); return; }
      if (k === 'g' && this.hand && (isShot(this.hand) || isWeapon(this.hand)) && !this.placing) { if (!e.repeat) { if (this.bag[this.hand] > 0) this.armsPut(this.hand); else { this.bubble(this.x, this.y - 30, `No ${KIND_NAME[this.hand]} left`, 'info'); Sound.denied(); } } return; }
      const pk = (Object.entries(PLACE_KEY) as [Placeable, string][]).find(([, key]) => key.toLowerCase() === k);
      if (pk) { if (!e.repeat) this.togglePlacing(pk[0]); return; }
      if (k === 'y') { if (!e.repeat) this.openLab(); return; }
      if (k === 'd') { this.dropOne(); return; }
      if (k === 't') { if (!e.repeat) this.useNear(); return; }
      if (k === 'r') { if (!e.repeat) this.rotate(); return; }
      if (this.placing && k === 'Enter') { const t = this.ghost(); if (t) this.placeAt(t.c, t.r); return; }
      if (this.placing && k === 'Escape') { this.placing = false; return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { this.fireHeld = true; this.shoot(true); } return; }
      if (k === 'Tab') { e.preventDefault(); if (!e.repeat) this.switchWeapon(); return; }
      if (k === 'z') { if (!e.repeat) this.shoot(false); return; }
      if (k === 'p' || k === 'Escape') { this.hooks.pause(); return; }
      if (k === 'm') { if (!e.repeat) this.action(); return; }
      if (k === 's') { if (!e.repeat) this.switchAmmo(); return; }
      if (k === 'h') { if (!e.repeat) this.hire(); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); this.keys.add(k); }
    });
    addEventListener('keyup', e => { this.keys.delete(e.key); if (e.code === 'Space') this.fireHeld = false; });
    addEventListener('blur', () => { this.keys.clear(); this.fireHeld = false; });
  }

  start(load: Loadout) {
    this.load = load;
    this.hp = SURVIVAL.maxHp; this.x = CX; this.y = CY + 60; this.face = -Math.PI / 2; this.reload = 0;
    this.bears = []; this.bolts = []; this.bubbles = [];
    this.t = 0; this.healT = 0; this.waveT = SURVIVAL.waveStart; this.waveN = 0; this.waveLeft = 0; this.waveGap = 0; this.waveWarned = false; this.kills = 0; this.shots = 0; this.hits = 0; this.damage = 0;
    this.hurtFlash = 0; this.keys.clear(); this.stick = null;
    this.gateStage = 0; this.gates = FIRST_GATES.map(([side, at]) => ({ side, at, open: 0 })); this.rockets = []; this.picked = null; this.spawnerKills = 0;
    // 4 to 6 bear spawners spread round the woods
    const n = SURVIVAL.spawnerMin + Math.floor(Math.random() * (SURVIVAL.spawnerMax - SURVIVAL.spawnerMin + 1)), a0 = Math.random() * Math.PI * 2;
    this.spawners = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = spawnerSpot(a0 + (i + (Math.random() - .5) * .5) / n * Math.PI * 2);
      // they only show up after the first 10 minutes
      this.spawners.push({ x, y, hp: SURVIVAL.spawnerHp, t: 1 + i * 1.3, hurt: 0, dead: true, pre: true, respawn: SURVIVAL.spawnerDelay + i * .5 });
    }
    this.camX = this.x; this.camY = this.y;
    this.rocks = []; this.gateWait = SURVIVAL.gateWait;
    this.mineOn = false; this.mining = false; this.mineT = 0; this.swing = 0; this.popT = 0; this.miners = []; this.digAt = null;
    this.belts.clear(); this.items = []; this.placing = false; this.placeDir = 0; this.hover = null; this.closeShop(); this.closeBld();
    this.placeType = 'belt'; this.grabbers.clear(); this.turrets.clear(); this.tap = null; this.splitters.clear(); this.chests.clear(); this.pwalls.clear();
    this.mines = [{ ...FIRST_MINE, r: MINE_R, ore: 'stone' }]; this.machines = [{ ...FIRST_MACHINE, r: MACHINE_R, queue: [], batchT: 0, out: [], recipe: null }]; this.mineAt = null;
    this.expansion = 0; Object.assign(WALL, BASE_WALL); this.rebuildWalls(); this.updateStructs();
    // you start with a furnace and a few iron plates, like a new settler
    this.bag = emptyBag(); this.bag.furnace = 1; this.bag.ironPlate = 8;
    Object.assign(this.bag, { drill: 1, pole: 10, machine: 1, turret: 2, gen: 1 }); this.closeRecipe();
    this.weapons = ['xbow', null, null]; this.wSel = 0; this.ammoSlots = [{ k: 'ammo', pts: 100 * SURVIVAL.ammoPoints }, null, null]; this.aSel = 0;
    this.fireHeld = false; this.firingAt = null; this.firingEnd = null; this.sparks = []; this.slimes = []; this.puddles = []; this.acidRate = 0; this.acidT = 0; this.groupSize = this.newGroup(); this.armsSig = '';
    this.quick = Array(10).fill(null); this.hand = null; this.syncQuick();
    this.blds.clear(); this.brickGate = false; this.robots = []; this.robotT = 0;
    this.labs.clear(); this.researching = null; this.progress = {}; this.lv = {}; this.done.clear(); this.closeLab(); resetStats();
    this.patches = genPatches(this.spawners, startPatches(this.x, this.y)); this.queue = []; this.pollution = 0; this.powerT = 0; this.poweredSet.clear(); this.poleLinks = [];
    this.running = true; this.paused = false;
    this.canvas.hidden = false; this.pad.hidden = false;
    this.say(`No bears for ${SURVIVAL.spawnerDelay / 60} minutes: dig, smelt and build. Then ${n} bear spawners appear in the woods!`, 5);
  }
  /* ---------- save and load ---------- */
  /** Plain fields saved as they are. Maps, sets and things that point at each other are handled below. */
  private static SAVED = ['hp', 'x', 'y', 'face', 'reload', 't', 'healT', 'waveT', 'waveN', 'waveLeft', 'waveGap', 'waveWarned', 'nextId', 'kills', 'shots', 'hits', 'damage',
    'spawners', 'spawnerKills', 'gateStage', 'camX', 'camY', 'bag', 'weapons', 'wSel', 'ammoSlots', 'aSel', 'groupSize', 'gateWait', 'mineOn', 'mineT', 'items', 'placeDir',
    'machines', 'expansion', 'researching', 'progress', 'lv', 'brickGate', 'robotT', 'miners', 'popT', 'load', 'patches', 'queue', 'jobN', 'quick', 'pollution'] as const;
  /** Everything needed to carry on this run later, as plain JSON. */
  save(): SaveData {
    const me = this as unknown as Record<string, unknown>, o: Record<string, unknown> = { v: 2 };
    for (const k of Survival.SAVED) o[k] = me[k];
    o.gates = this.gates.map(g => ({ ...g, open: 0 }));
    o.bears = this.bears.filter(b => b.state !== 'dead').map(b => ({ ...b, gate: this.gates.indexOf(b.gate) }));
    o.mines = this.mines; o.mineAt = this.mineAt ? this.mines.indexOf(this.mineAt) : -1;
    o.done = [...this.done];
    o.turrets = [...this.turrets].map(([k, tu]) => [k, { ...tu, target: !tu.target || !alive(tu.target) ? null : isBear(tu.target) ? { bear: tu.target.id } : { spawner: this.spawners.indexOf(tu.target) } }]);
    for (const k of ['belts', 'splitters', 'chests', 'labs', 'blds', 'grabbers', 'pwalls'] as const) o[k] = [...this[k]];
    // robots drop whatever they are carrying into your pocket
    o.robots = this.robots.map(r => ({ x: r.x, y: r.y, hub: r.hub, k: null, src: null, dst: null }));
    for (const r of this.robots) if (r.k) (o.bag as Bag)[r.k]++;
    return JSON.parse(JSON.stringify(o));
  }
  /** Carries on a saved run. */
  restore(d: SaveData) {
    if ((d.v as number) < 2) d = migrateSave(d);
    this.start(d.load as Loadout);
    const me = this as unknown as Record<string, unknown>;
    for (const k of Survival.SAVED) if (k in d) me[k] = d[k];
    this.bag = { ...emptyBag(), ...(d.bag as Bag) };
    this.quick = ((d.quick as (Kind | null)[]) ?? Array(10).fill(null)).slice(0, 10); this.syncQuick();
    this.gates = d.gates as Gate[];
    this.bears = (d.bears as (Omit<Bear, 'gate'> & { gate: number })[]).map(b => ({ ...b, gate: this.gates[b.gate] ?? this.gates[0] }));
    for (const m of this.machines as (Machine & { recipe: string | null })[]) if (m.recipe && !(MRECS as string[]).includes(m.recipe)) m.recipe = m.queue.length ? (m.queue[0] === 'stone' ? 'stone' : MRECS.find(r => MREC_IN[r] === m.queue[0]) ?? null) : null;
    this.mines = d.mines as Mine[]; this.mineAt = this.mines[d.mineAt as number] ?? null; this.mining = false;
    this.done = new Set(d.done as ResId[]);
    resetStats(); for (const id of this.done) applyResearch(id);
    this.turrets = new Map((d.turrets as [string, Turret & { target: { bear?: number; spawner?: number } | null }][]).map(([k, tu]) => {
      const tg = tu.target, target = !tg ? null : tg.bear !== undefined ? this.bears.find(b => b.id === tg.bear) ?? null : this.spawners[tg.spawner!] ?? null;
      return [k, { ...tu, target }];
    }));
    this.belts = new Map(d.belts as [string, number][]); this.splitters = new Map(d.splitters as [string, Splitter][]);
    this.chests = new Map((d.chests as [string, Chest][]).map(([k, c]) => [k, { ...emptyBag(), ...c }])); this.labs = new Map(d.labs as [string, Lab][]);
    this.blds = new Map(d.blds as [string, Bld][]); this.grabbers = new Map(d.grabbers as [string, Grabber][]); this.pwalls = new Map((d.pwalls ?? []) as [string, PWall][]);
    this.robots = d.robots as Robot[];
    Object.assign(WALL, EXPANSIONS[this.expansion]); this.rebuildWalls(); this.updateStructs(); this.coolT = 0; this.powerT = 0;
    this.say('Game loaded', 2);
  }
  stop() { this.running = false; this.paused = false; this.canvas.hidden = true; this.pad.hidden = true; this.keys.clear(); this.stick = null; }

  /* ---------- input ---------- */
  private down(e: PointerEvent) {
    e.preventDefault();
    if (!this.running || this.paused || this.shopOpen || this.labOpen || this.recipeFor) return;
    const wx = (e.offsetX - this.ox) / this.scale, wy = (e.offsetY - this.oy) / this.scale;
    // placing a belt: tap the spot
    if (this.placing) {
      const t = tileAt(wx, wy);
      if (t) {
        this.placeAt(t.c, t.r);
        // keep the finger down and drag to lay a line of belts (or poles, pipes...)
        if (this.placing) this.dragPlace = { id: e.pointerId, last: t.c + ',' + t.r };
        return;
      }
    }
    // a tap on the machine uses it
    if (this.mineOn) {
      const tm = this.machines.find(m => Math.hypot(wx - m.x, wy - m.y) < m.r + 10);
      if (tm) { this.openRecipe(tm); return; }
    }
    // anywhere on the map works as a joystick: drag from where the finger lands
    this.stick = { id: e.pointerId, ox: e.offsetX, oy: e.offsetY, dx: 0, dy: 0 };
    this.tap = { id: e.pointerId, x: e.offsetX, y: e.offsetY, t: e.timeStamp };
  }
  private move(e: PointerEvent) {
    const dp = this.dragPlace;
    if (dp && dp.id === e.pointerId && this.placing && !isBig(this.placeType)) {
      const t = tileAt((e.offsetX - this.ox) / this.scale, (e.offsetY - this.oy) / this.scale);
      if (t && t.c + ',' + t.r !== dp.last) {
        const [lc, lr] = dp.last.split(',').map(Number), dc = t.c - lc, dr = t.r - lr;
        // a belt points the way you drag; only one step at a time, straight
        if (Math.abs(dc) + Math.abs(dr) === 1) {
          if (this.placeType === 'belt') {
            const d = DIRS.findIndex(([x, y]) => x === dc && y === dr);
            this.placeDir = d; if (this.belts.has(dp.last)) this.belts.set(dp.last, d);
          }
          if (!this.taken(t.c, t.r)) this.placeAt(t.c, t.r);
        }
        dp.last = t.c + ',' + t.r;
      }
      return;
    }
    // with a mouse, the belt being placed follows the pointer
    if (this.placing && e.pointerType === 'mouse') {
      const t = tileAt((e.offsetX - this.ox) / this.scale, (e.offsetY - this.oy) / this.scale);
      this.hover = t ? { ...t, t: performance.now() } : null;
    }
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    s.dx = e.offsetX - s.ox; s.dy = e.offsetY - s.oy;
    const m = Math.hypot(s.dx, s.dy), max = 46;
    if (m > max) { s.ox += s.dx * (1 - max / m); s.oy += s.dy * (1 - max / m); s.dx *= max / m; s.dy *= max / m; }
  }

  /** The nearest bear (or, if no bear is close, spawner) within range of (x, y). */
  private nearestTarget(x: number, y: number, range: number): Target | null {
    let target: Target | null = null, best = range;
    for (const b of this.bears) { if (b.state === 'dead') continue; const d = dist(b.x, b.y, x, y); if (d < best) { best = d; target = b; } }
    if (target) return target;
    for (const sp of this.spawners) { if (sp.dead) continue; const d = dist(sp.x, sp.y, x, y) - SPAWNER_R; if (d < best) { best = d; target = sp; } }
    return target;
  }
  /** The weapon in hand (the picked weapon slot). */
  private weapon(): Weapon | null { return this.weapons[this.wSel] ?? null; }
  /** The ammo slot this weapon shoots from: the picked one if it fits, else the first that does. */
  private ammoSlot(w: Weapon) {
    const ok = (i: number) => { const a = this.ammoSlots[i]; return !!a && a.pts > 0 && fits(w, a.k); };
    if (ok(this.aSel)) return this.aSel;
    return [0, 1, 2].find(ok) ?? -1;
  }
  private useUp(i: number, pts: number) {
    const a = this.ammoSlots[i]; if (!a) return;
    a.pts -= pts;
    if (a.pts <= 1e-6) { this.ammoSlots[i] = null; this.bubble(this.x, this.y - 30, `Out of ${a.k === 'rocket' ? 'rockets' : AMMO_NAME[a.k].toLowerCase() + ' ammo'}`, 'info'); }
  }
  /** Space shoots at the nearest bear (or spawner) in range; Z shoots straight ahead with no target. Holding Space keeps firing. */
  private shoot(targeted: boolean) {
    const w = this.weapon();
    if (!w) { this.bubble(this.x, this.y - 30, 'No weapon: put one in a weapon slot', 'info'); Sound.denied(); return; }
    if (w === 'rxbow') return; // fires while Space is held (see update)
    if (this.reload > 0) { if (!this.fireHeld) Sound.click(); return; }
    let target: Target | null = null;
    if (targeted) {
      target = this.nearestTarget(this.x, this.y, w === 'rgun' ? SURVIVAL.rocketRange : SURVIVAL.targetRange);
      if (!target) {
        if (this.noTargetT <= 0) { this.bubble(this.x, this.y - 30, 'No bear in range', 'info'); this.noTargetT = 1.2; if (!this.fireHeld) Sound.denied(); }
        return;
      }
      this.face = Math.atan2(target.y - this.y, target.x - this.x);
    }
    const a = this.face, ammo = AMMO[this.load.ammo], i = this.ammoSlot(w);
    // the rocket gun: one rocket a shot, it swirls and then homes in like a launcher's
    if (w === 'rgun') {
      if (i < 0) { if (this.noAmmoT <= 0) { this.bubble(this.x, this.y - 30, 'Put rockets in an ammo slot', 'info'); this.noAmmoT = 1.5; } Sound.denied(); return; }
      this.useUp(i, SURVIVAL.ammoPoints); this.mining = false;
      this.rockets.push({ from: this.wallAt(this.x, this.y) ?? undefined, x: this.x + Math.cos(a) * 22, y: this.y + Math.sin(a) * 22, a, t: 0, spin: Math.random() < .5 ? 1 : -1, target, trail: [] });
      this.reload = SURVIVAL.rgunReload * ST.reloadMul; this.shots++;
      Sound.rocket();
      return;
    }
    // the machine gun: a small bolt every 0.2 s, 0.5 of an ammo's 100 usage points a shot; with no ammo it still fires, for no damage
    if (w === 'mgun') {
      const k = i >= 0 ? this.ammoSlots[i]!.k as AmmoKind : null;
      const dmg = k ? SURVIVAL.mgunDamage[k] * ST.boltMul : 0;
      if (i >= 0) this.useUp(i, SURVIVAL.mgunUse);
      else if (this.noAmmoT <= 0) { this.bubble(this.x + 18, this.y - 22, 'No Ammo', 'tiny'); this.noAmmoT = .8; }
      this.mining = false;
      const j = (Math.random() - .5) * .06;
      this.bolts.push({ from: this.wallAt(this.x, this.y) ?? undefined, x: this.x + Math.cos(a + j) * 20, y: this.y + Math.sin(a + j) * 20, vx: Math.cos(a + j) * SURVIVAL.boltSpeed * 1.3, vy: Math.sin(a + j) * SURVIVAL.boltSpeed * 1.3, left: SURVIVAL.boltRange, dmg, target, stone: true, color: k && k !== 'ammo' ? metalOf(k).color : '#ffd27a' });
      this.reload = SURVIVAL.mgunEvery * ST.reloadMul; this.shots++;
      Sound.mgun();
      return;
    }
    // the crossbow: stone ammo does 1.7x normal damage, metal ammo its own; one ammo a shot. With no ammo it fires loadout bolts.
    const use = i >= 0 ? this.ammoSlots[i]!.k as AmmoKind : null;
    const dmg = (use === 'ammo' ? AMMO.normal.damage * SURVIVAL.stoneDamage : use ? metalOf(use).dmg : ammo.damage) * ST.boltMul;
    if (use) this.useUp(i, SURVIVAL.ammoPoints);
    this.mining = false;
    this.bolts.push({ from: this.wallAt(this.x, this.y) ?? undefined, x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: SURVIVAL.boltRange, dmg, target, stone: !!use, color: use && use !== 'ammo' ? metalOf(use).color : undefined });
    this.reload = ammo.reload * ST.reloadMul;
    this.shots++;
    Sound.tone('triangle', 900, 260, .12, .14); Sound.noise(.08, 'highpass', 2400, .8, .1);
  }
  /** Holding fire: the rapid crossbow streams at the nearest bear in range, other weapons fire each time they're ready. */
  private holdFire(dt: number) {
    this.firingAt = null; this.firingEnd = null; this.noAmmoT -= dt;
    if (!this.fireHeld) { this.rxT = 0; return; }
    const w = this.weapon();
    if (w !== 'rxbow') { if (this.reload <= 0) this.shoot(true); return; }
    const target = this.nearestTarget(this.x, this.y, SURVIVAL.targetRange), i = this.ammoSlot('rxbow');
    if (!target) { if (this.noTargetT <= 0) { this.bubble(this.x, this.y - 30, 'No bear in range', 'info'); this.noTargetT = 1.2; } this.rxT = 0; return; }
    this.mining = false; this.digAt = null;
    this.face = Math.atan2(target.y - this.y, target.x - this.x);
    this.firingAt = target;
    // a wall in the way stops the stream there
    this.firingEnd = this.wallLine(this.x, this.y, target.x, target.y);
    // with no ammo it still fires, but does no damage
    if (i < 0) { if (this.noAmmoT <= 0) { this.bubble(this.x + 18, this.y - 22, 'No Ammo', 'tiny'); this.noAmmoT = .8; } }
    else this.useUp(i, SURVIVAL.rxUse * dt);
    this.rxT += dt;
    while (this.rxT >= SURVIVAL.rxEvery) {
      this.rxT -= SURVIVAL.rxEvery; this.shots++;
      if (alive(target) && i >= 0 && !this.firingEnd) this.damageTarget(target, SURVIVAL.rxDamage * ST.boltMul);
      Sound.rattle();
    }
  }
  /** Tab: the next weapon slot with a weapon in it. */
  private switchWeapon() {
    const has = [0, 1, 2].filter(i => this.weapons[i]);
    if (!has.length) { Sound.denied(); return; }
    this.wSel = has[(has.indexOf(this.wSel) + 1) % has.length]; this.armsSig = '';
    this.bubble(this.x, this.y - 30, ONE_NAME[this.weapons[this.wSel]!], 'info'); Sound.click();
  }
  /** A tap on a weapon or ammo slot: put in what you hold (if it fits there), pick it, or (tapped again) take it out. */
  private armsClick(e: Event) {
    e.stopPropagation();
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-w],[data-a]');
    if (!el || !this.running || this.paused) return;
    const h = this.hand && this.bag[this.hand] >= 1 ? this.hand : null;
    if (el.dataset.w) {
      const i = Number(el.dataset.w), cur = this.weapons[i];
      if (isWeapon(h)) { if (cur) this.bag[cur]++; this.weapons[i] = h; this.bag[h]--; this.wSel = i; if (!this.bag[h]) this.hand = null; Sound.thump(); }
      else if (cur && i === this.wSel) { this.bag[cur]++; this.weapons[i] = null; this.bubble(this.x, this.y - 30, `${ONE_NAME[cur]} back in your inventory`, 'info'); Sound.click(); }
      else { this.wSel = i; Sound.click(); }
    } else {
      const i = Number(el.dataset.a), cur = this.ammoSlots[i];
      if (isShot(h)) {
        if (cur && cur.k !== h) this.bag[cur.k] += Math.floor(cur.pts / SURVIVAL.ammoPoints);
        const n = Math.floor(this.bag[h]);
        this.ammoSlots[i] = { k: h, pts: (cur && cur.k === h ? cur.pts : 0) + n * SURVIVAL.ammoPoints }; this.bag[h] -= n; this.hand = null; this.aSel = i;
        this.bubble(this.x, this.y - 30, `${n} ${KIND_NAME[h]} in`, 'info'); Sound.thump();
      } else if (cur && i === this.aSel) {
        const n = Math.floor(cur.pts / SURVIVAL.ammoPoints); this.bag[cur.k] += n; this.ammoSlots[i] = null;
        this.bubble(this.x, this.y - 30, `${n} ${KIND_NAME[cur.k]} back in your inventory`, 'info'); Sound.click();
      } else { this.aSel = i; Sound.click(); }
    }
    this.armsSig = ''; this.invSig = ''; this.quickSig = '';
  }
  /** D with ammo or a weapon in hand: one ammo goes into its ammo slot (or the first empty one); a weapon into the first empty weapon slot. */
  private armsPut(k: Kind) {
    if (isShot(k)) {
      let i = this.ammoSlots.findIndex(a => a?.k === k); if (i < 0) i = this.ammoSlots.indexOf(null);
      if (i < 0) { this.bubble(this.x, this.y - 30, 'The ammo slots are full of other ammo', 'info'); Sound.denied(); return true; }
      const a = this.ammoSlots[i] ?? (this.ammoSlots[i] = { k, pts: 0 }); a.pts += SURVIVAL.ammoPoints; this.bag[k]--;
      this.bubble(this.x, this.y - 30, `1 ${ONE_NAME[k].toLowerCase()} in (${Math.ceil(a.pts / SURVIVAL.ammoPoints)})`, 'info'); Sound.click(); this.armsSig = '';
      return true;
    }
    if (isWeapon(k)) {
      const i = this.weapons.indexOf(null);
      if (i < 0) { this.bubble(this.x, this.y - 30, 'The weapon slots are full', 'info'); Sound.denied(); return true; }
      this.weapons[i] = k; this.bag[k]--; this.wSel = i; this.bubble(this.x, this.y - 30, `${ONE_NAME[k]} in a weapon slot`, 'info'); Sound.thump(); this.armsSig = '';
      return true;
    }
    return false;
  }
  private armsSig = '';
  private newGroup() { return SURVIVAL.groupMin + Math.floor(Math.random() * (SURVIVAL.groupMax - SURVIVAL.groupMin + 1)); }
  /** The colour of the bolt on the crossbow: the ammo it will shoot. */
  private ammoTint() { const i = this.ammoSlot('xbow'), k = i >= 0 ? this.ammoSlots[i]!.k : null; return k === 'ammo' ? STONE : k && k !== 'rocket' ? metalOf(k).color : undefined; }
  /** Draws the weapon and ammo slots (only when they change). */
  private renderArms() {
    const sig = JSON.stringify([this.weapons, this.wSel, this.ammoSlots.map(a => a && [a.k, Math.ceil(a.pts / 5)]), this.aSel]);
    if (sig === this.armsSig) return;
    this.armsSig = sig;
    const w = this.weapons.map((k, i) => `<button class="aslot w${i === this.wSel && k ? ' on' : ''}${k ? '' : ' empty'}" data-w="${i}" title="${k ? ONE_NAME[k] + (i === this.wSel ? ' (tap again to take it out)' : '') : 'Weapon slot'}">${k ? `<img src="${this.icon(k)}" alt="">` : '<i>⚔</i>'}</button>`).join('');
    const am = this.ammoSlots.map((a, i) => {
      if (!a) return `<button class="aslot empty" data-a="${i}" title="Ammo slot"><i>•</i></button>`;
      const n = Math.ceil(a.pts / SURVIVAL.ammoPoints - 1e-9), top = a.pts - (n - 1) * SURVIVAL.ammoPoints;
      return `<button class="aslot${i === this.aSel ? ' on' : ''}" data-a="${i}" title="${ONE_NAME[a.k]}: ${n} (${Math.round(top)} usage points left in this one)"><img src="${this.icon(a.k)}" alt=""><b>${n}</b><span class="pts" style="width:${Math.max(0, Math.min(100, top / SURVIVAL.ammoPoints * 100))}%"></span></button>`;
    }).join('');
    this.pad.querySelector('#svArms')!.innerHTML = w + am;
  }

  /** M: start or stop digging at the mine or an ore patch, or use the ammo machine when next to it. */
  private action() {
    const mine = this.mineOn ? near(this.mines, this.x, this.y) : null, mach = this.mineOn ? near(this.machines, this.x, this.y) : null, patch = this.nearPatch();
    if (this.mining || this.digAt) { this.mining = false; this.digAt = null; Sound.ui(); return; }
    if (mine) {
      this.mining = true; this.mineT = 0; this.mineAt = mine;
      this.face = Math.atan2(mine.y - this.y, mine.x - this.x);
      Sound.ui();
    } else if (mach) this.useMachine(mach);
    else if (patch) {
      this.digAt = patch; this.mineT = 0; this.face = Math.atan2(patch.y - this.y, patch.x - this.x);
      Sound.ui();
    } else this.bubble(this.x, this.y - 30, 'Walk to an ore patch, the mine or the ammo machine', 'info');
  }
  /** The ore patch you're standing on or next to, if it has ore left. */
  private nearPatch() { return this.patches.find(p => p.left > 0 && inPatch(p, this.x, this.y, 20)) ?? null; }
  private rebuildWalls() { this.walls = NO_BASE ? [] : wallRects(this.gates); fence = this.walls; }
  /** Keeps the list of big things (for where belts can go) up to date. */
  private updateStructs() { structs = [...this.mines, ...this.machines]; }
  /** Bigger base: the walls move out. */
  private expand() {
    if (this.expansion >= SURVIVAL.expandCosts.length) return;
    const cost = SURVIVAL.expandCosts[this.expansion];
    if (this.bag.stone < cost) { Sound.denied(); return; }
    this.bag.stone -= cost; this.expansion++;
    Object.assign(WALL, EXPANSIONS[this.expansion]); this.rebuildWalls();
    // anything that was outside but is now inside the bigger walls gets pushed back out
    for (const b of this.bears) if (b.state === 'walk' || b.state === 'wait') collide(b, BEAR_R, this.walls);
    this.say('Your base got bigger!'); Sound.pop(); this.renderShop();
  }
  /** M next to an ammo machine: put your stone or plates in. */
  private useMachine(m: Machine) {
    if (dist(this.x, this.y, m.x, m.y) > NEAR) { this.bubble(m.x, m.y - 36, 'Walk to the machine', 'info'); Sound.denied(); return; }
    this.feedMachine(m);
  }
  /** The ammo machine takes your stone, or one smelted metal (plates, gold bars, cut diamonds). Each stone is a batch of
   *  stone ammo (or 10 stone make a rocket); each plate is a batch of that metal's ammo. */
  private feedMachine(m: Machine) {
    if (!m.recipe) { this.bubble(m.x, m.y - 36, 'Pick a recipe first', 'info'); Sound.denied(); this.openRecipe(m); return; }
    const ins = MACHINE_IN.filter(k => this.bag[k] > 0);
    // it only takes what its recipe uses
    const k = ins.find(x => this.machineTakes(m, x));
    if (!k) { this.bubble(m.x, m.y - 36, `This machine is set to ${KIND_NAME[MREC_OUT[m.recipe]]}. It needs ${KIND_NAME[MREC_IN[m.recipe]]}`, 'info'); Sound.denied(); return; }
    this.bubble(m.x, m.y - 36, `${this.bag[k]} ${KIND_NAME[k]} in`, 'info');
    for (let i = 0; i < this.bag[k]; i++) m.queue.push(k);
    this.bag[k] = 0;
    Sound.thump();
  }
  /** A machine only takes one material at a time: anything while it's empty, then only more of the same. */
  private machineTakes(m: Machine, k: Kind) { return !!m.recipe && MREC_IN[m.recipe] === k; }
  /** The recipes this machine can be set to (rockets once researched). */
  private mrecs() { return MRECS.filter(r => r !== 'rocket' || this.done.has('rocket')); }
  private openRecipe(m: Machine) {
    this.recipeFor = m; this.stick = null; this.keys.clear(); this.mining = false;
    this.renderRecipe();
    this.pad.querySelector<HTMLElement>('#svRecipe')!.hidden = false;
    Sound.ui();
  }
  private renderRecipe() {
    const m = this.recipeFor; if (!m) return;
    this.pad.querySelector('#svRecSeg')!.innerHTML = this.mrecs().map((r, i) => {
      const inp = MREC_IN[r], out = MREC_OUT[r], n = r === 'rocket' ? 1 : this.batchOf({ ...m, recipe: r }, inp)[1];
      return `<button role="radio" data-mrec="${r}" aria-checked="${m.recipe === r}"><img src="${this.icon(out)}" alt="">${ONE_NAME[out]}<small>${r === 'rocket' ? SURVIVAL.rocketStone : 1} ${r === 'rocket' ? KIND_NAME[inp] : ONE_NAME[inp].toLowerCase()} → ${n} · ${i + 1}</small></button>`;
    }).join('');
    this.pad.querySelector('#svRecInfoM')!.textContent = m.recipe ? `Set to ${KIND_NAME[MREC_OUT[m.recipe]]}: it takes only ${KIND_NAME[MREC_IN[m.recipe]]}.` : 'Pick a recipe first. The machine takes nothing until you do.';
    const put = this.pad.querySelector('#svRecPut') as HTMLButtonElement;
    put.disabled = !m.recipe || !(this.bag[MREC_IN[m.recipe]] > 0);
    put.textContent = m.recipe ? `Put your ${KIND_NAME[MREC_IN[m.recipe]]} in` : 'Pick a recipe first';
  }
  private setRecipe(r: MRec) {
    const m = this.recipeFor; if (!m || m.recipe === r) return;
    // what was waiting for the old recipe comes back to you
    for (const k of m.queue) this.bag[k]++; m.queue = []; m.batchT = 0;
    m.recipe = r; Sound.click(); this.renderRecipe();
  }
  private closeRecipe() { this.recipeFor = null; this.pad.querySelector<HTMLElement>('#svRecipe')!.hidden = true; }
  /** What one batch of this thing makes in a machine: [kind, how many]. */
  private batchOf(m: Machine, k: Kind): [Kind, number] {
    if (m.recipe === 'rocket') return ['rocket', 1];
    if (k === 'stone') return ['ammo', ST.batchAmmo];
    const o = plateOre(k) ?? (ORES.includes(k as Ore) ? k as Ore : 'iron'); return [METAL[o].ammo, METAL[o].per];
  }
  /* ---------- inventory, crafting and the crafting queue ---------- */
  /** The inventory screen (Shift): what you carry on the left, crafting recipes in tabs on the right. */
  private openShop() {
    this.shopOpen = true; this.stick = null; this.keys.clear(); this.mining = false; this.digAt = null; this.placing = false; this.invSig = '';
    this.renderShop();
    this.pad.querySelector<HTMLElement>('#svShop')!.hidden = false;
    Sound.ui();
  }
  private closeShop() { this.shopOpen = false; this.pad.querySelector<HTMLElement>('#svShop')!.hidden = true; }
  private invTab: RecCat = 'logistics'; private invSel = 'belt'; private invSig = '';
  private unlocked(r: Rec) { if (NO_BASE && (r.id === 'gate' || r.id === 'expand')) return false; return !r.unlock || this.done.has(r.unlock); }
  /** What a recipe takes right now (the bigger base costs more each step). */
  private recCost(r: Rec): Cost {
    if (r.id === 'expand') return this.expansion >= SURVIVAL.expandCosts.length ? {} : { stone: SURVIVAL.expandCosts[this.expansion] };
    return r.in;
  }
  private afford(c: Cost) { return (Object.entries(c) as [Kind, number][]).every(([k, n]) => this.bag[k] >= n); }
  /** Works out how to make `want` of recipe id from what's in `real` (which it takes things out of), making missing parts
   *  first if you know how. Adds the crafting steps to `steps`, parts first; returns the step that makes it, or null. */
  private plan(id: string, want: number, real: Bag, steps: Survival['queue'], job: number, depth = 0): Survival['queue'][number] | null {
    const r = REC[id];
    if (!r || !r.out || !this.unlocked(r) || depth > 6) return null;
    const b = Math.ceil(want / r.n), raw: Cost = {};
    for (const [k, q] of Object.entries(r.in) as [Kind, number][]) {
      const need = q * b, take = Math.min(real[k], need);
      real[k] -= take; if (take) raw[k] = take;
      const short = need - take;
      if (short > 0) {
        const sub = recFor(k);
        if (!sub) return null;
        const st = this.plan(sub.id, short, real, steps, job, depth + 1);
        if (!st) return null;
        st.internal += short;
      }
    }
    const step = { id, b, t: 0, internal: 0, raw, job, top: depth === 0 };
    steps.push(step);
    return step;
  }
  /** Can you make n of this (making parts on the way if needed)? 'have': everything's in your pocket already. */
  private canMake(r: Rec, n = 1): 'have' | 'parts' | false {
    if (!this.unlocked(r)) return false;
    if (!r.out) return r.id === 'gate' && this.brickGate ? false : r.id === 'expand' && this.expansion >= SURVIVAL.expandCosts.length ? false : this.afford(this.recCost(r)) ? 'have' : false;
    if ((Object.entries(r.in) as [Kind, number][]).every(([k, q]) => this.bag[k] >= q * Math.ceil(n / r.n))) return 'have';
    return this.plan(r.id, n, { ...this.bag }, [], 0) ? 'parts' : false;
  }
  /** Craft: special recipes happen at once; the rest go in the crafting queue (taking their things now). */
  private craft(id: string, n = 1) {
    const r = REC[id];
    if (!r) return;
    this.invSel = id;
    if (!r.out) {
      if (!this.canMake(r)) { Sound.denied(); this.renderShop(); return; }
      if (id === 'expand') this.expand();
      else if (id === 'gate') { for (const [k, q] of Object.entries(r.in) as [Kind, number][]) this.bag[k] -= q; this.brickGate = true; this.say('Brick gate built: bears wait 10 seconds longer'); Sound.pop(); }
      this.renderShop(); return;
    }
    let made = 0;
    for (let i = 0; i < n; i++) {
      if (this.queue.length >= SURVIVAL.queueMax) { this.bubble(this.x, this.y - 30, 'The crafting queue is full', 'info'); break; }
      const real = { ...this.bag }, steps: Survival['queue'] = [], job = ++this.jobN;
      if (!this.plan(id, r.n, real, steps, job)) break;
      this.bag = real; this.queue.push(...steps); made++;
    }
    if (!made) { Sound.denied(); this.bubble(this.x, this.y - 30, `Not enough to make a ${ONE_NAME[r.out].toLowerCase()}`, 'info'); }
    else Sound.click();
    this.renderShop();
  }
  /** The crafting queue: one step at a time. Parts made for something else in the queue go straight into it. */
  private runQueue(dt: number) {
    const st = this.queue[0];
    if (!st) return;
    const r = REC[st.id];
    st.t += dt;
    if (st.t < r.time * st.b / this.craftMul()) return;
    this.queue.shift();
    const n = r.n * st.b - st.internal;
    if (n > 0) this.bag[r.out!] += n;
    if (st.internal > 0) { const m = this.madeFor.get(st.job) ?? {}; m[r.out!] = (m[r.out!] ?? 0) + st.internal; this.madeFor.set(st.job, m); }
    if (st.top) this.madeFor.delete(st.job);
    if (st.top) { this.bubble(this.x, this.y - 30, `+${r.n * st.b} ${r.n * st.b === 1 ? ONE_NAME[r.out!].toLowerCase() : KIND_NAME[r.out!]}`, 'info'); Sound.pop(); }
    if (isPlaceable(r.out!)) this.syncQuick();
  }
  /** Tap a job in the queue to cancel it: you get back what it took (and any parts it already made). */
  private cancelJob(job: number) {
    const steps = this.queue.filter(q => q.job === job);
    if (!steps.length) return;
    for (const st of steps) for (const [k, n] of Object.entries(st.raw) as [Kind, number][]) this.bag[k] += n;
    // parts this job already made were kept for it; they come back too
    this.queue = this.queue.filter(q => q.job !== job);
    const made = this.madeFor.get(job); if (made) { for (const [k, n] of Object.entries(made) as [Kind, number][]) this.bag[k] += n; this.madeFor.delete(job); }
    this.bubble(this.x, this.y - 30, 'Crafting cancelled', 'info'); Sound.click();
  }
  /** Parts finished for a job that's still in the queue (so cancelling can give them back). */
  private madeFor = new Map<number, Cost>();
  /** What you carry, in inventory order. */
  private invItems() { return KINDS.filter(k => this.bag[k] > 0).map(k => ({ k, n: Math.floor(this.bag[k]) })); }
  private renderShop() {
    if (!this.shopOpen) return;
    const items = this.invItems(), recs = RECIPES.filter(r => r.cat === this.invTab && this.unlocked(r));
    const state = recs.map(r => this.canMake(r));
    const sig = JSON.stringify([items, state, this.invTab, this.invSel, this.expansion, this.brickGate, [...this.done], this.hand, this.quick]);
    if (sig === this.invSig) return;
    this.invSig = sig;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const slots = Math.max(30, Math.ceil(items.length / 5) * 5);
    let h = '';
    for (let i = 0; i < slots; i++) {
      const it = items[i], pl = it && isPlaceable(it.k);
      h += it ? `<button class="slot${pl ? ' placeable' : ''}${this.hand === it.k ? ' sel' : ''}" data-item="${it.k}" title="${esc(ONE_NAME[it.k])}"><img src="${this.icon(it.k)}" alt=""><b>${it.n}</b>${pl && PLACE_KEY[it.k as Placeable] ? `<small>${PLACE_KEY[it.k as Placeable]}</small>` : ''}<span>${esc(ONE_NAME[it.k])}</span></button>` : '<div class="slot empty"></div>';
    }
    this.pad.querySelector('#svInvGrid')!.innerHTML = h;
    const hd = this.hand;
    this.pad.querySelector('#svInvHand')!.innerHTML = (hd ? `<div class="hand"><img src="${this.icon(hd)}" alt=""><span><b>${esc(ONE_NAME[hd])}</b> in your hand. Tap a quickbar slot to keep it there. D puts one into whatever is in front of you.</span>${isPlaceable(hd) && this.bag[hd] ? `<button class="primary small" data-handplace="${hd}">Place</button>` : ''}</div>` : '<p class="fine">Tap a thing to hold it. Then tap a quickbar slot to keep it there, or press D to put one into whatever is in front of you.</p>')
      + `<div class="invquick">${this.quick.map((q, i) => `<button class="qslot${q && q === hd ? ' on' : ''}${q && !this.bag[q] ? ' none' : ''}" data-iq="${i}" title="${q ? esc(ONE_NAME[q]) : 'Empty'}">${q ? `<img src="${this.icon(q)}" alt=""><b>${Math.floor(this.bag[q])}</b>` : ''}<small>${(i + 1) % 10}</small></button>`).join('')}</div>`;
    this.pad.querySelector('#svRecTabs')!.innerHTML = (Object.keys(REC_CATS) as RecCat[]).map(c => `<button class="rectab${c === this.invTab ? ' on' : ''}" data-tab="${c}" title="${REC_CATS[c][1]}"><i>${REC_CATS[c][0]}</i></button>`).join('');
    this.pad.querySelector('#svRecCat')!.textContent = REC_CATS[this.invTab][1];
    if (!recs.some(r => r.id === this.invSel)) this.invSel = recs[0]?.id ?? 'belt';
    this.pad.querySelector('#svRecGrid')!.innerHTML = recs.map((r, i) => `<button class="slot rec${state[i] === 'have' ? '' : state[i] === 'parts' ? ' parts' : ' no'}${r.id === this.invSel ? ' sel' : ''}" data-rec="${r.id}" title="${esc(this.recName(r))}"><img src="${this.icon(r.out ?? r.id)}" alt="">${r.n > 1 ? `<b>${r.n}</b>` : ''}</button>`).join('');
    const r = REC[this.invSel], can = this.canMake(r), cost = this.recCost(r);
    const chips = (Object.entries(cost) as [Kind, number][]).map(([k, n]) => `<span class="chip${this.bag[k] >= n ? '' : recFor(k) ? ' part' : ' short'}"><img src="${this.icon(k)}" alt=""> ${n} ${KIND_NAME[k]} <em>(${Math.floor(this.bag[k])})</em></span>`).join('') || '<span class="chip">Nothing</span>';
    const done = (r.id === 'gate' && this.brickGate) || (r.id === 'expand' && this.expansion >= SURVIVAL.expandCosts.length);
    this.pad.querySelector('#svRecInfo')!.innerHTML = `<b>${esc(this.recName(r))}</b><small>${done ? 'Done.' : esc(r.desc)}</small><div class="chips">${chips}<span class="makes">→ ${r.out ? `${r.n} ${r.n === 1 ? ONE_NAME[r.out].toLowerCase() : KIND_NAME[r.out]}${r.time ? `, ${+(r.time / this.craftMul()).toFixed(2)} s` : ''}` : 'at once'}</span></div>`
      + (can === 'parts' ? '<small class="partsnote">Missing parts get made first.</small>' : '')
      + `<div class="craftbtns"><button class="primary" data-craft="1"${can ? '' : ' disabled'}>Craft</button>${r.out ? `<button class="ghost" data-craft="5"${can ? '' : ' disabled'}>Craft 5</button>` : ''}</div>`;
  }
  private recName(r: Rec) { return r.out ? ONE_NAME[r.out] : r.id === 'gate' ? 'Brick gate' : 'Bigger base'; }
  private invClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-item],[data-iq],[data-handplace],[data-tab],[data-rec],[data-craft]');
    e.stopPropagation();
    if (!el || !this.running || this.paused) return;
    if (el.dataset.item) { const k = el.dataset.item as Kind; this.hand = this.hand === k ? null : k; Sound.click(); this.invSig = ''; this.renderShop(); return; }
    if (el.dataset.iq) {
      // a quickbar slot: the thing in your hand goes there (and stays, even when you run out); with nothing in hand it's cleared
      const i = Number(el.dataset.iq);
      if (this.hand) { const was = this.quick.indexOf(this.hand); if (was >= 0) this.quick[was] = this.quick[i]; this.quick[i] = this.hand; }
      else this.quick[i] = null;
      Sound.click(); this.invSig = ''; this.quickSig = ''; this.renderShop(); return;
    }
    if (el.dataset.handplace) { const p = el.dataset.handplace as Placeable; this.closeShop(); this.togglePlacing(p); return; }
    if (el.dataset.tab) { this.invTab = el.dataset.tab as RecCat; Sound.click(); this.renderShop(); return; }
    if (el.dataset.rec) { if (this.invSel !== el.dataset.rec) { this.invSel = el.dataset.rec; Sound.click(); this.renderShop(); } else this.craft(el.dataset.rec); return; }
    if (el.dataset.craft) this.craft(this.invSel, Number(el.dataset.craft));
  }
  private iconCache = new Map<string, string>();
  /** A picture of a thing drawn just as it looks in the world, as an image URL (made once, then kept). */
  private icon(id: string): string {
    const hit = this.iconCache.get(id);
    if (hit) return hit;
    const px = 96, cv = document.createElement('canvas'); cv.width = cv.height = px;
    const g = cv.getContext('2d')!;
    const pl = isPlaceable(id), box = id === 'machine' ? 60 : id === 'gate' || id === 'expand' ? 76 : pl || id === 'robot' ? 30 : 17;
    g.translate(px / 2, px / 2); g.scale(px / box, px / box);
    if (id === 'machine') {
      const keep = this.popT; this.popT = 9;
      g.save(); g.beginPath(); g.rect(-30, -30, 60, 56); g.clip();
      this.drawMachine(g, { x: 0, y: 0, r: 26, queue: [], batchT: 0, out: [], recipe: null });
      g.restore(); this.popT = keep;
    } else if (pl) paintPlaceable(g, 0, 0, id as Placeable, 0, 0);
    else if (id === 'robot') paintRobot(g, 0, 0, 0);
    else if (id === 'gate') {
      // the gate's two doors and posts, in brick
      g.fillStyle = '#a8503a'; g.fillRect(-26, -5, 52, 10);
      g.strokeStyle = '#7a3526'; g.lineWidth = 1; for (const x of [-13, 0, 13]) { g.beginPath(); g.moveTo(x, -5); g.lineTo(x, 5); g.stroke(); }
      g.fillStyle = '#4a3219'; for (const x of [-28, 28]) { g.beginPath(); g.arc(x, 0, 9, 0, 7); g.fill(); }
    } else if (id === 'expand') {
      // a corner of the log fence with arrows pushing it out
      const t = WALL.t;
      for (let i = 0; i < 5; i++) for (const [x, y] of [[-16 + i * 9, -8], [-16, -8 + i * 9]]) { g.fillStyle = i % 2 ? '#6d4a2a' : '#7c5631'; g.beginPath(); g.arc(x, y, t * .55, 0, 7); g.fill(); g.fillStyle = '#a07a4c'; g.beginPath(); g.arc(x - 1, y - 1, t * .28, 0, 7); g.fill(); }
      g.strokeStyle = '#ffcf8c'; g.lineWidth = 3; g.beginPath(); g.moveTo(-6, 2); g.lineTo(-26, -18); g.stroke();
      g.fillStyle = '#ffcf8c'; g.beginPath(); g.moveTo(-30, -22); g.lineTo(-18, -20); g.lineTo(-28, -10); g.fill();
    } else paintItem(g, 0, 0, id as Kind);
    const url = cv.toDataURL();
    this.iconCache.set(id, url);
    return url;
  }
  /* ---------- the panel for a furnace or an assembler ---------- */
  private openBld(key: string) {
    if (!this.blds.has(key)) return;
    this.bldOpen = key; this.stick = null; this.keys.clear(); this.mining = false; this.digAt = null; this.bldSig = '';
    this.renderBld();
    this.pad.querySelector<HTMLElement>('#svBld')!.hidden = false;
    Sound.ui();
  }
  private closeBld() { this.bldOpen = null; this.pad.querySelector<HTMLElement>('#svBld')!.hidden = true; }
  private bldSig = '';
  private renderBld() {
    const key = this.bldOpen, b = key ? this.blds.get(key) : undefined;
    if (!key || !b) { this.closeBld(); return; }
    const [c, r] = key.split(',').map(Number), near = dist(this.x, this.y, tileX(c), tileY(r)) < NEAR * 1.6;
    const rc = REC[b.recipe], power = this.hasPower(key);
    const items = this.invItems();
    const sig = JSON.stringify([key, b.recipe, b.inp, b.inpK, b.out, b.outK, b.buf, power, near, Math.floor(b.t * 4), [...this.done], items]);
    if (sig === this.bldSig) return;
    this.bldSig = sig;
    const chip = (k: Kind, n: number, of?: number) => `<span class="chip"><img src="${this.icon(k)}" alt=""> ${n}${of !== undefined ? `/${of}` : ''} ${KIND_NAME[k]}</span>`;
    let h = `<h3>${BNAME[b.type]}</h3>`;
    if (b.type === 'asm') {
      h += `<p class="fine">${power ? 'Powered.' : '<b class="warn">No power.</b> Put a power pole next to it, joined to a generator with stone in it.'} Pick what it makes; grabbers bring the parts in and take what it makes out the front.</p>`;
      h += '<div class="slots">' + RECIPES.filter(x => x.out && x.asm && this.unlocked(x)).map(x => `<button class="slot rec${x.id === b.recipe ? ' sel' : ''}" data-asm="${x.id}" title="${ONE_NAME[x.out!]}"><img src="${this.icon(x.out!)}" alt="">${x.n > 1 ? `<b>${x.n}</b>` : ''}</button>`).join('') + '</div>';
      if (rc) {
        h += `<div class="recinfo"><b>Makes ${rc.n} ${rc.n === 1 ? ONE_NAME[rc.out!].toLowerCase() : KIND_NAME[rc.out!]} every ${+this.asmTime(rc).toFixed(2)} s, until you change the recipe</b><div class="chips">${(Object.entries(rc.in) as [Kind, number][]).map(([k, q]) => chip(k, b.buf?.[k] ?? 0, q)).join('')}</div>`;
        h += `<div class="bar"><span style="width:${Math.min(100, b.t / this.asmTime(rc) * 100)}%"></span></div>${b.out ? `<div class="chips">Made: ${chip(b.outK!, b.out)}</div>` : ''}</div>`;
      }
    } else {
      h += `<p class="fine">Smelts iron and copper ore into plates, gold ore into bars, rough diamonds into cut diamonds and stone into bricks. Grabbers can fill and empty it.</p>`;
      h += `<div class="recinfo"><div class="chips">In: ${b.inp && b.inpK ? chip(b.inpK, b.inp) : '<span class="chip">nothing</span>'} → Out: ${b.out && b.outK ? chip(b.outK, b.out) : '<span class="chip">nothing</span>'}</div><div class="bar"><span style="width:${b.inp ? Math.min(100, b.t / (SURVIVAL.furnaceTime / this.furnMul()) * 100) : 0}%"></span></div></div>`;
    }
    // your inventory: tap a thing to put it in (things it can't use stay faded and do nothing)
    const takes = (k: Kind) => { const t = { ...b, buf: { ...b.buf } }; return this.feedBld(t, k); };
    h += `<h4 class="invh">Your inventory <small>(tap to put in)</small></h4><div class="slots">${items.map(it => `<button class="slot${takes(it.k) ? '' : ' no'}" data-bitem="${it.k}" title="${ONE_NAME[it.k]}"><img src="${this.icon(it.k)}" alt=""><b>${it.n}</b></button>`).join('') || '<p class="fine">Empty</p>'}</div>`;
    h += `<div class="craftbtns"><button class="primary" data-bld="fill"${near ? '' : ' disabled'}>${b.type === 'asm' ? 'Put parts in' : 'Put ore in'}${b.out ? ' and take out' : ''}</button><button class="ghost" data-bld="pick"${near ? '' : ' disabled'}>Pick up</button><button class="ghost" data-bld="close">Close</button></div>`;
    if (!near) h += '<p class="fine">Walk closer to put things in or pick it up.</p>';
    this.pad.querySelector('#svBld')!.innerHTML = h;
  }
  private bldClick(e: MouseEvent) {
    e.stopPropagation();
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-asm],[data-bld],[data-bitem]'), key = this.bldOpen;
    if (!el || !key || !this.running || this.paused) return;
    const b = this.blds.get(key); if (!b) { this.closeBld(); return; }
    if (el.dataset.bitem) {
      // put all of that thing in that fits; anything it can't use does nothing
      const k = el.dataset.bitem as Kind, [c, r] = key.split(',').map(Number);
      if (dist(this.x, this.y, tileX(c), tileY(r)) > NEAR * 1.6) { this.bubble(tileX(c), tileY(r) - 20, 'Walk closer to put things in', 'info'); Sound.denied(); return; }
      let n = 0; while (this.bag[k] >= 1 && this.feedBld(b, k)) { this.bag[k]--; n++; }
      if (n) Sound.thump(); else Sound.click();
      this.bldSig = ''; this.renderBld(); return;
    }
    if (el.dataset.asm) {
      if (b.recipe !== el.dataset.asm) {
        // switching recipe gives back the old parts
        for (const [k, n] of Object.entries(b.buf ?? {}) as [Kind, number][]) this.bag[k] += n;
        if (b.out && b.outK) this.bag[b.outK] += b.out;
        b.buf = {}; b.out = 0; b.outK = undefined; b.t = 0; b.recipe = el.dataset.asm;
        Sound.click();
      }
    } else if (el.dataset.bld === 'fill') this.fillBld(key);
    else if (el.dataset.bld === 'pick') { const [c, r] = key.split(',').map(Number); this.closeBld(); this.pickUp(c, r); return; }
    else if (el.dataset.bld === 'close') { this.closeBld(); return; }
    this.bldSig = ''; this.renderBld();
  }
  /* ---------- the quickbar ---------- */
  /** Anything placeable you have that isn't on the quickbar goes in the first empty slot. */
  private syncQuick() {
    for (const p of PLACEABLES) if (this.bag[p] > 0 && !this.quick.includes(p)) { const i = this.quick.indexOf(null); if (i >= 0) this.quick[i] = p; }
  }
  private quickSig = '';
  /** Draws the quickbar and the crafting queue (only when they change). */
  private renderQuick() {
    const q0 = this.queue[0], qr = q0 ? REC[q0.id] : undefined, prog = q0 && qr ? Math.floor(q0.t / (qr.time * q0.b / this.craftMul()) * 20) : 0;
    const jobs = [...new Map(this.queue.filter(q => q.top).map(q => [q.job, q])).values()];
    const sig = JSON.stringify([this.quick, this.quick.map(p => p ? this.bag[p] : 0), this.placing && this.placeType, this.hand, jobs.map(j => j.job), prog]);
    if (sig === this.quickSig) return;
    this.quickSig = sig;
    this.pad.querySelector('#svQuick')!.innerHTML = this.quick.map((p, i) => p
      ? `<button class="qslot${(this.placing && this.placeType === p) || (!this.placing && this.hand === p) ? ' on' : ''}${this.bag[p] ? '' : ' none'}" data-q="${i}" title="${ONE_NAME[p]}"><img src="${this.icon(p)}" alt=""><b>${Math.floor(this.bag[p])}</b><small>${(i + 1) % 10}</small></button>`
      : `<div class="qslot empty"><small>${(i + 1) % 10}</small></div>`).join('');
    const firstJob = q0?.job;
    this.pad.querySelector('#svQueue')!.innerHTML = jobs.slice(0, 8).map(j => {
      const r = REC[j.id], cur = j.job === firstJob;
      return `<button class="qjob" data-job="${j.job}" title="Tap to cancel"><img src="${this.icon(r.out!)}" alt="">${cur ? `<span style="height:${prog * 5}%"></span>` : ''}</button>`;
    }).join('') + (jobs.length > 8 ? `<i>+${jobs.length - 8}</i>` : '');
  }
  /** 1 to 0 or a tap on a quickbar slot: pick that thing up to place it (again to put it away). */
  private useQuick(i: number) {
    const p = this.quick[i];
    if (!p) { Sound.denied(); return; }
    if (this.shopOpen) this.closeShop();
    if (isPlaceable(p)) { this.togglePlacing(p); this.hand = this.placing ? p : null; return; }
    // anything else goes in your hand (tap again to put it away)
    this.placing = false;
    this.hand = this.hand === p ? null : p;
    if (this.hand) this.bubble(this.x, this.y - 30, isShot(p) ? `${ONE_NAME[p]} in hand. G puts one in your gun, D drops one` : `${ONE_NAME[p]} in hand. D puts one in`, 'info');
    Sound.click();
  }
  /** D: put one of the thing in your hand (or being placed) into whatever is at the tile in front of you (or under the mouse):
   *  a furnace, assembler, generator, chest, turret, lab or ammo machine. A placeable thing on an empty tile gets put down; anything else lands on the ground. */
  private dropOne() {
    const k = this.placing ? this.placeType as Kind : this.hand;
    if (!k) { this.bubble(this.x, this.y - 30, 'Pick something in your inventory or quickbar first', 'info'); Sound.denied(); return; }
    if (this.bag[k] < 1) { this.bubble(this.x, this.y - 30, `No ${KIND_NAME[k]} left`, 'info'); Sound.denied(); return; }
    // ammo gets dropped where you point (G puts it in your gun); a weapon still goes in a weapon slot
    if (!this.placing && !isShot(k) && this.armsPut(k)) return;
    const t = this.ghost(); if (!t) { Sound.denied(); return; }
    const key = t.c + ',' + t.r, x = tileX(t.c), y = tileY(t.r), nm = ONE_NAME[k].toLowerCase();
    const ok = (what: string) => { this.bag[k]--; this.bubble(x, y - 18, `1 ${nm} → ${what}`, 'info'); Sound.thump(); this.bldSig = ''; };
    const no = (what: string) => { this.bubble(x, y - 18, `The ${what} won't take ${KIND_NAME[k]}`, 'info'); Sound.denied(); };
    const b = this.blds.get(key);
    if (b) {
      if (b.type === 'hub' && k === 'robot') { b.robots++; this.robots.push(this.newRobot(key)); return ok('robot hub'); }
      return b.type !== 'hub' && this.feedBld(b, k) ? ok(BNAME[b.type].toLowerCase()) : no(BNAME[b.type].toLowerCase());
    }
    const ch = this.chests.get(key);
    if (ch) { if (chestN(ch) >= SURVIVAL.chestSize) { this.bubble(x, y - 18, 'The chest is full', 'info'); Sound.denied(); return; } ch[k]++; return ok('chest'); }
    const tu = this.turrets.get(key); if (tu) return this.feedTurret(tu, k) ? ok(ONE_NAME[T_ITEM[tu.kind]].toLowerCase()) : no(ONE_NAME[T_ITEM[tu.kind]].toLowerCase());
    const lb = this.labs.get(key); if (lb) return this.feedLab(lb, k) ? ok('lab') : no('lab');
    const mc = this.machines.find(m => dist(x, y, m.x, m.y) < m.r + 14);
    if (mc) { if (!this.machineTakes(mc, k)) return no('ammo machine'); mc.queue.push(k); return ok('ammo machine'); }
    if (this.taken(t.c, t.r) || blockedTile(t.c, t.r)) { this.bubble(x, y - 18, "Can't put that there", 'info'); Sound.denied(); return; }
    if (isPlaceable(k) && !this.belts.has(key)) { const was = this.placing, pt = this.placeType; this.placeType = k; this.placing = true; this.placeAt(t.c, t.r); this.placing = was && this.bag[k] > 0; this.placeType = pt; return; }
    // on a belt it rides along; on the ground it waits for a grabber
    this.items.push({ x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, k }); this.bag[k]--; Sound.thump();
  }
  private newRobot(hk: string): Robot { const [c, r] = hk.split(',').map(Number); return { x: tileX(c), y: tileY(r), hub: hk, k: null, src: null, dst: null }; }
  /** Puts a thing in your pocket. */
  private pocket(k: Kind, n = 1) { this.bag[k] += n; }
  /** A belt, grabber or robot hands a building one thing. False if it can't take it. */
  private feedBld(b: Bld, k: Kind) {
    if (b.type === 'furnace') {
      if (!SMELT[k] || b.inp >= SURVIVAL.furnaceMax || (b.inp > 0 && b.inpK !== k)) return false;
      b.inpK = k; b.inp++; return true;
    }
    if (b.type === 'gen') { if (k !== 'stone' || b.inp >= 10) return false; b.inp++; return true; }
    if (b.type === 'asm') {
      const r = REC[b.recipe]; if (!r) return false;
      const q = r.in[k]; if (!q) return false;
      b.buf ??= {};
      if ((b.buf[k] ?? 0) >= q * 2) return false;
      b.buf[k] = (b.buf[k] ?? 0) + 1; return true;
    }
    if (b.type === 'hub') { if (k !== 'robot') return false; return true; }
    return false;
  }
  /** What a building wants brought to it, for robots. */
  private bldWants(b: Bld): Kind[] {
    if (b.type === 'furnace') return b.inp >= 3 ? [] : b.inp ? [b.inpK!] : ['iron', 'copper', 'gold', 'diamond', 'stone'];
    if (b.type === 'gen') return b.inp < 3 ? ['stone'] : [];
    if (b.type === 'asm') { const r = REC[b.recipe]; if (!r) return []; return (Object.entries(r.in) as [Kind, number][]).filter(([k, q]) => (b.buf?.[k] ?? 0) < q).map(([k]) => k); }
    return [];
  }
  /** Is this tile's building getting power? */
  private hasPower(key: string) { return this.poweredSet.has(key); }
  /** Works out the power: poles join up (and to generators) within reach; a network with a burning generator powers
   *  drills, assemblers and labs near its poles. */
  private updatePower() {
    const nodes: { key: string; c: number; r: number; gen: boolean }[] = [];
    for (const [key, b] of this.blds) if (b.type === 'pole' || b.type === 'gen') { const [c, r] = key.split(',').map(Number); nodes.push({ key, c, r, gen: b.type === 'gen' }); }
    const parent = nodes.map((_, i) => i), find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
    this.poleLinks = [];
    for (let i = 0; i < nodes.length; i++) for (let j = 0; j < i; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.gen && b.gen) continue;
      if (Math.hypot(a.c - b.c, a.r - b.r) > SURVIVAL.poleReach + .01) continue;
      parent[find(i)] = find(j); this.poleLinks.push([a.key, b.key]);
    }
    const fuel = new Map<number, boolean>(), gens = new Map<number, string[]>();
    nodes.forEach((n, i) => { if (!n.gen) return; const b = this.blds.get(n.key)!, root = find(i); if (b.fuel > 0 || b.inp > 0) fuel.set(root, true); gens.set(root, [...(gens.get(root) ?? []), n.key]); });
    this.poweredSet.clear(); this.genLoad.clear();
    const consumers: string[] = [...this.labs.keys()];
    for (const [key, b] of this.blds) if (ELECTRIC.includes(b.type)) consumers.push(key);
    const load = new Map<number, number>();
    for (const key of consumers) {
      const [c, r] = key.split(',').map(Number);
      const i = nodes.findIndex(n => !n.gen && Math.max(Math.abs(n.c - c), Math.abs(n.r - r)) <= SURVIVAL.poleSupply);
      if (i < 0) continue;
      const root = find(i);
      if (!fuel.get(root)) continue;
      this.poweredSet.add(key); load.set(root, (load.get(root) ?? 0) + 1);
    }
    // generators burn fuel faster the more they power
    for (const [root, n] of load) { const gs = gens.get(root) ?? []; for (const g of gs) this.genLoad.set(g, Math.max(.5, n / (4 * gs.length))); }
  }
  private genLoad = new Map<string, number>();
  /** Furnaces, drills, assemblers, generators, pipes and robots. */
  private runBlds(dt: number) {
    this.powerT -= dt;
    if (this.powerT <= 0) { this.powerT = .5; this.updatePower(); }
    const P = SURVIVAL.pollution;
    for (const [key, b] of this.blds) {
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r), [dx, dy] = DIRS[b.d];
      if (b.type === 'gen') {
        const rate = this.genLoad.get(key) ?? 0;
        if (!rate) continue;
        if (b.fuel <= 0 && b.inp > 0) { b.inp--; b.fuel += SURVIVAL.genBurn; }
        if (b.fuel > 0) { b.fuel = Math.max(0, b.fuel - dt * rate); this.pollution += P.gen * dt; }
        continue;
      }
      if (b.type !== 'furnace' && b.type !== 'asm' && b.type !== 'drill') continue;
      // things made go out the front, onto a belt or into whatever is there
      if (b.out > 0 && b.outK && this.deliver(c + dx, r + dy, b.outK)) { b.out--; if (!b.out) b.outK = undefined; }
      if (b.type === 'drill') {
        const p = b.pi !== undefined ? this.patches[b.pi] : undefined;
        b.on = false;
        if (!p || p.left <= 0 || b.out >= 5 || !this.hasPower(key)) continue;
        b.on = true; b.t += dt * ST.digMul;
        this.pollution += P.drill * dt;
        if (b.t < SURVIVAL.drillEvery) continue;
        b.t = 0; p.left--; b.out++; b.outK = p.ore;
        if (p.left <= 0) this.bubble(x, y - 20, 'This ore patch has run out', 'info');
        continue;
      }
      if (b.type === 'furnace') {
        const mk = b.inpK ? SMELT[b.inpK] : undefined;
        if (!b.inp || !mk || b.out >= 10 || (b.out > 0 && b.outK !== mk)) { b.t = 0; continue; }
        b.t += dt; this.pollution += P.furnace * dt;
        if (b.t < SURVIVAL.furnaceTime / this.furnMul()) continue;
        b.t = 0; b.inp--; b.out++; b.outK = mk;
        if (!b.inp) b.inpK = undefined;
        continue;
      }
      // an assembler: when it has everything for its recipe (and power), it makes it
      const rc = REC[b.recipe];
      if (!rc || !rc.out || !this.hasPower(key) || b.out >= rc.n * 10 || (Object.entries(rc.in) as [Kind, number][]).some(([k, q]) => (b.buf?.[k] ?? 0) < q)) { b.t = 0; continue; }
      b.t += dt; this.pollution += P.asm * dt;
      if (b.t < this.asmTime(rc)) continue;
      b.t = 0;
      for (const [k, q] of Object.entries(rc.in) as [Kind, number][]) b.buf![k] = (b.buf![k] ?? 0) - q;
      b.out += rc.n; b.outK = rc.out;
    }
    // water: a turret touching pipes that lead to a pump is cooled and reloads twice as fast
    this.coolT -= dt;
    if (this.coolT <= 0) {
      this.coolT = .5;
      const wet = new Set<string>(), todo: string[] = [];
      for (const [key, b] of this.blds) if (b.type === 'pump') { wet.add(key); todo.push(key); }
      while (todo.length) {
        const [c, r] = todo.pop()!.split(',').map(Number);
        for (const [dx, dy] of DIRS) { const k2 = (c + dx) + ',' + (r + dy), b2 = this.blds.get(k2); if (b2 && (b2.type === 'pipe' || b2.type === 'pump') && !wet.has(k2)) { wet.add(k2); todo.push(k2); } }
      }
      for (const [key, tu] of this.turrets) { const [c, r] = key.split(',').map(Number); tu.cool = DIRS.some(([dx, dy]) => wet.has((c + dx) + ',' + (r + dy))); }
    }
    this.runRobots(dt);
  }
  /** Robots take things out of chests and bring them to turrets, labs, machines and buildings that are running low. */
  private runRobots(dt: number) {
    this.robotT -= dt;
    const findJob = this.robotT <= 0;
    if (findJob) this.robotT = .5;
    const busy = new Set(this.robots.map(r => r.dst?.id).filter(Boolean));
    for (const rb of this.robots) {
      const hub = this.blds.get(rb.hub);
      if (!hub) { rb.k = null; rb.src = null; rb.dst = null; continue; }
      const [hc, hr] = rb.hub.split(',').map(Number);
      if (!rb.dst && findJob) {
        const job = this.robotJob(busy);
        if (job) { rb.src = job.src; rb.dst = job.dst; rb.k = null; busy.add(job.dst.id); }
      }
      let tx = tileX(hc), ty = tileY(hr);
      if (rb.dst && rb.src && !rb.k) { tx = rb.src.x; ty = rb.src.y; }
      else if (rb.dst) { tx = rb.dst.x; ty = rb.dst.y; }
      const d = dist(rb.x, rb.y, tx, ty), st = SURVIVAL.robotSpeed * dt;
      if (d > st) { rb.x += (tx - rb.x) / d * st; rb.y += (ty - rb.y) / d * st; continue; }
      rb.x = tx; rb.y = ty;
      if (rb.dst && rb.src && !rb.k) { if (rb.src.take()) { rb.k = (rb.src as { kind?: Kind }).kind ?? 'stone'; rb.src = null; } else { rb.src = null; rb.dst = null; } }
      else if (rb.dst) { if (!rb.dst.give() && rb.k) this.pocket(rb.k); rb.dst = null; rb.k = null; }
    }
  }
  private robotJob(busy: Set<string | undefined>): { src: NonNullable<Robot['src']>; dst: NonNullable<Robot['dst']> } | null {
    // what needs something, and what kind
    const needs: { id: string; x: number; y: number; kinds: Kind[]; give: (k: Kind) => boolean }[] = [];
    for (const [key, tu] of this.turrets) if (tAmmo(tu) < (tu.kind === 'rocket' ? 3 : 10)) { const [c, r] = key.split(',').map(Number); needs.push({ id: 't' + key, x: tileX(c), y: tileY(r), kinds: tu.kind === 'rocket' ? ['rocket'] : [...AMMO_KINDS, 'stone'], give: k => this.feedTurret(tu, k) }); }
    for (const [key, lb] of this.labs) if (lb.packs < 10 || (lb.packs2 ?? 0) < 10) { const [c, r] = key.split(',').map(Number); needs.push({ id: 'l' + key, x: tileX(c), y: tileY(r), kinds: [...(lb.packs < 10 ? ['pack'] : []), ...((lb.packs2 ?? 0) < 10 ? ['pack2'] : [])] as Kind[], give: k => this.feedLab(lb, k) }); }
    this.machines.forEach((m, i) => { if (m.recipe && m.queue.length < 3) needs.push({ id: 'm' + i, x: m.x, y: m.y, kinds: MACHINE_IN.filter(k => this.machineTakes(m, k)), give: k => { if (!this.machineTakes(m, k)) return false; m.queue.push(k); return true; } }); });
    for (const [key, b] of this.blds) { const kinds = this.bldWants(b); if (kinds.length) { const [c, r] = key.split(',').map(Number); needs.push({ id: 'b' + key, x: tileX(c), y: tileY(r), kinds, give: k => this.feedBld(b, k) }); } }
    for (const n of needs) {
      if (busy.has(n.id)) continue;
      for (const k of n.kinds) for (const [ck, ch] of this.chests) {
        if (ch[k] <= 0) continue;
        const [c, r] = ck.split(',').map(Number);
        let got: Kind | null = null;
        return {
          src: { kind: k, x: tileX(c), y: tileY(r), take: () => { if (ch[k] <= 0) return false; ch[k]--; got = k; return true; } },
          dst: { id: n.id, x: n.x, y: n.y, give: () => n.give(got ?? k) },
        };
      }
    }
    return null;
  }
  /** A turret takes ammo (raw stone counts as stone ammo); a rocket launcher only takes rockets. */
  private feedTurret(tu: Turret, k: Kind) {
    if (tu.kind === 'rocket') { if (k !== 'rocket') return false; tu.ammo.rocket = (tu.ammo.rocket ?? 0) + 1; return true; }
    const a: AmmoKind | null = k === 'stone' ? 'ammo' : isAmmoKind(k) ? k : null;
    if (!a) return false;
    tu.ammo[a] = (tu.ammo[a] ?? 0) + 1; return true;
  }

  /** A lab takes red and green science packs, up to the lab's size of each. */
  private feedLab(lb: Lab, k: Kind) {
    if (k === 'pack' && lb.packs < SURVIVAL.labSize) { lb.packs++; return true; }
    if (k === 'pack2' && (lb.packs2 ?? 0) < SURVIVAL.labSize) { lb.packs2 = (lb.packs2 ?? 0) + 1; return true; }
    return false;
  }
  /* ---------- labs and research ---------- */

  /** T next to a lab: put your science packs in it. */
  private loadLab(lab: Lab) {
    let n = 0;
    for (const k of ['pack', 'pack2'] as Kind[]) while (this.bag[k] > 0 && this.feedLab(lab, k)) { this.bag[k]--; n++; }
    if (!n) { this.bubble(this.x, this.y - 30, this.bag.pack || this.bag.pack2 ? 'The lab is full' : 'No science packs. Craft them in your inventory (Shift)', 'info'); Sound.denied(); return; }
    this.bubble(this.x, this.y - 30, `${n} pack${n > 1 ? 's' : ''} in`, 'info'); Sound.thump();
    if (!this.researching) this.bubble(this.x, this.y - 46, 'Pick something to research (Y)', 'info');
  }
  private openLab() {
    if (!this.labs.size && !this.bag.lab) { this.bubble(this.x, this.y - 30, 'Craft a lab in your inventory first (Shift)', 'info'); Sound.denied(); return; }
    this.labOpen = true; this.stick = null; this.keys.clear();
    this.renderLab();
    this.pad.querySelector<HTMLElement>('#svLab')!.hidden = false;
    Sound.ui();
  }
  private closeLab() { this.labOpen = false; this.pad.querySelector<HTMLElement>('#svLab')!.hidden = true; }
  private canResearch(id: ResId) { const r = RESEARCH.find(x => x.id === id)!; return !this.done.has(id) && (!LEVELED.includes(id) || (this.lv[id] ?? 0) < LEVEL_MAX) && (r.needs as readonly ResId[]).every(n => this.done.has(n)); }
  /** What research costs: its own cost, or for levelled research, 30 packs plus 20 for each level done. */
  private resCost(id: ResId) { return LEVELED.includes(id) ? levelCost(this.lv[id] ?? 0) : RESEARCH.find(x => x.id === id)!.cost; }
  /** A crafting machine takes 4 times as long as crafting by hand. */
  private asmTime(r: Rec) { return r.time * 4 / this.craftMul(); }
  private craftMul() { return 1.25 ** (this.lv.craftspd ?? 0); }
  private furnMul() { return 1.25 ** (this.lv.furnspd ?? 0); }
  private pickResearch(id: ResId) {
    if (!this.canResearch(id)) { Sound.denied(); return; }
    this.researching = id; Sound.click(); this.renderLab();
  }
  private renderLab() {
    const red = [...this.labs.values()].reduce((a, l) => a + l.packs, 0), green = [...this.labs.values()].reduce((a, l) => a + (l.packs2 ?? 0), 0);
    const unpowered = [...this.labs.keys()].filter(k => !this.hasPower(k)).length;
    this.pad.querySelector('#svLabInfo')!.textContent = `${this.labs.size} lab${this.labs.size === 1 ? '' : 's'}${unpowered ? ` (${unpowered} without power)` : ''} · in labs: ${red} red, ${green} green packs · in your pocket: ${this.bag.pack} red, ${this.bag.pack2} green`;
    const list = this.pad.querySelector<HTMLElement>('#svResList')!;
    const name = (id: string) => RESEARCH.find(x => x.id === id)!.name;
    // what you can research now first, then what needs something else first, then what's done
    const order = RESEARCH.filter(x => !(NO_BASE && x.id === 'walls')).sort((a, b) => (this.done.has(a.id) ? 2 : this.canResearch(a.id) ? 0 : 1) - (this.done.has(b.id) ? 2 : this.canResearch(b.id) ? 0 : 1));
    const html = order.map(r => {
      const done = this.done.has(r.id), on = this.researching === r.id, p = Math.floor(this.progress[r.id] ?? 0), can = this.canResearch(r.id), cost = this.resCost(r.id);
      const lvd = LEVELED.includes(r.id) ? this.lv[r.id] ?? 0 : -1, nm = lvd >= 0 ? `${r.name} ${Math.min(lvd + 1, LEVEL_MAX)}` : r.name, ds = lvd >= 0 ? `${r.desc} (now ${(1.25 ** lvd).toFixed(2)}x)` : r.desc;
      const packs = r.packs === 2 ? '<em class="pk red"></em><em class="pk green"></em>' : '<em class="pk red"></em>';
      const sub = done || (lvd >= LEVEL_MAX) ? 'Done' : can ? `${p}/${cost} ${packs}` : `Needs ${(r.needs as readonly string[]).filter(n => !this.done.has(n as ResId)).map(name).join(' and ')}`;
      return `<button class="svres${done ? ' done' : ''}${on ? ' on' : ''}${!done && !can ? ' locked' : ''}" data-res="${r.id}"${done || !can ? ' disabled' : ''}><b>${nm}</b><small>${ds}</small><i>${sub}</i><span style="width:${Math.min(100, p / cost * 100)}%"></span></button>`;
    }).join('');
    if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
  }
  /** Powered labs with the right packs work on the chosen research: one unit (a red pack, plus a green one if it
   *  needs it) every 2 seconds each. */
  private runLabs(dt: number) {
    const id = this.researching;
    if (!id) { for (const lab of this.labs.values()) lab.t = 0; return; }
    const r = RESEARCH.find(x => x.id === id)!;
    for (const [lk, lab] of this.labs) {
      if (!lab.packs || (r.packs === 2 && !lab.packs2) || !this.hasPower(lk)) { lab.t = 0; continue; }
      lab.t += dt;
      if (lab.t < SURVIVAL.labEvery) continue;
      lab.t -= SURVIVAL.labEvery; lab.packs--; if (r.packs === 2) lab.packs2!--;
      this.progress[id] = (this.progress[id] ?? 0) + 1;
      if (LEVELED.includes(id) && this.progress[id] >= this.resCost(id)) {
        // a level done: the next one starts straight away (until the last)
        this.lv[id] = (this.lv[id] ?? 0) + 1; this.progress[id] = 0;
        if (this.lv[id] >= LEVEL_MAX) this.researching = null;
        this.say(`Research done: ${r.name} ${this.lv[id]}! Now ${(1.25 ** this.lv[id]).toFixed(2)}x`, 4); Sound.pop();
        return;
      }
      if (this.progress[id] >= r.cost && this.researching === id) {
        this.done.add(id); applyResearch(id); this.researching = null;
        const un = RECIPES.filter(x => x.unlock === id).map(x => this.recName(x).toLowerCase());
        this.say(`Research done: ${r.name}!${un.length ? ` You can now make: ${un.join(', ')}` : ''}`, 5); Sound.pop();
        return;
      }
    }
  }

  /** The nearest thing within reach that T works on: a lab, chest, turret or building. */
  private nearUsable(): { kind: 'lab' | 'chest' | 'turret' | 'bld'; key: string } | null {
    let best: { kind: 'lab' | 'chest' | 'turret' | 'bld'; key: string } | null = null, bd = NEAR;
    const look = (kind: 'lab' | 'chest' | 'turret' | 'bld', keys: Iterable<string>) => {
      for (const key of keys) {
        if (kind === 'bld' && ['pipe', 'pump', 'pole', 'tunnel'].includes(this.blds.get(key)!.type)) continue;
        const [c, r] = key.split(',').map(Number), d = dist(this.x, this.y, tileX(c), tileY(r)); if (d < bd) { bd = d; best = { kind, key }; }
      }
    };
    look('lab', this.labs.keys()); look('chest', this.chests.keys()); look('turret', this.turrets.keys()); look('bld', this.blds.keys());
    return best;
  }
  /** T: use the nearest thing: load a lab or turret, empty a chest, or fill and empty a furnace, generator, drill,
   *  robot hub or assembler. */
  private useNear() {
    const u = this.nearUsable();
    if (!u) { const m = this.mineOn ? near(this.machines, this.x, this.y) : null; if (m) { this.feedMachine(m); return; } this.bubble(this.x, this.y - 30, 'Walk up to something to use it', 'info'); Sound.denied(); return; }
    if (u.kind === 'lab') { this.loadLab(this.labs.get(u.key)!); return; }
    if (u.kind === 'turret') { this.loadTurret(); return; }
    if (u.kind === 'chest') {
      const ch = this.chests.get(u.key)!;
      if (!chestN(ch)) { this.bubble(this.x, this.y - 30, 'The chest is empty', 'info'); Sound.denied(); return; }
      this.bubble(this.x, this.y - 30, KINDS.filter(k => ch[k]).map(k => `+${ch[k]} ${KIND_NAME[k]}`).join(', '), 'info');
      for (const k of KINDS) { this.bag[k] += ch[k]; ch[k] = 0; }
      this.syncQuick(); Sound.thump();
      return;
    }
    const b = this.blds.get(u.key)!;
    if (b.type === 'asm' || b.type === 'furnace') { this.openBld(u.key); return; }
    this.fillBld(u.key);
  }
  /** Takes out what a building made, then puts in what it can use from your pocket. */
  private fillBld(key: string) {
    const b = this.blds.get(key)!, [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r);
    const said: string[] = [];
    if (b.out > 0 && b.outK) { this.bag[b.outK] += b.out; said.push(`+${b.out} ${KIND_NAME[b.outK]}`); b.out = 0; b.outK = undefined; }
    if (b.type === 'hub') {
      const n = this.bag.robot;
      if (n) { b.robots += n; for (let i = 0; i < n; i++) this.robots.push(this.newRobot(key)); this.bag.robot = 0; said.push(`${n} robot${n > 1 ? 's' : ''} in`); }
    } else if (b.type === 'asm') {
      const rc = REC[b.recipe];
      if (rc) for (const k of Object.keys(rc.in) as Kind[]) { let n = 0; while (this.bag[k] > 0 && this.feedBld(b, k)) { this.bag[k]--; n++; } if (n) said.push(`${n} ${KIND_NAME[k]} in`); }
    } else {
      const order: Kind[] = b.type === 'gen' ? ['stone'] : b.type === 'furnace' ? [...(b.inpK ? [b.inpK] : []), 'iron', 'copper', 'gold', 'diamond', 'stone'] : [];
      for (const k of order) { let n = 0; while (this.bag[k] > 0 && this.feedBld(b, k)) { this.bag[k]--; n++; } if (n) { said.push(`${n} ${KIND_NAME[k]} in`); break; } }
    }
    if (said.length) { this.bubble(x, y - 20, said.join(', '), 'info'); Sound.thump(); }
    else { this.bubble(x, y - 20, b.type === 'furnace' ? 'Bring ore or stone to smelt' : b.type === 'gen' ? 'It burns stone' : b.type === 'hub' ? 'Craft robots to put in it' : b.type === 'drill' ? 'Nothing dug yet' : 'Nothing to put in', 'info'); Sound.denied(); }
    if (this.bldOpen) this.renderBld();
  }

  /** The turret next to the guy, if any. */
  private nearTurret() {
    let best: Turret | null = null, bd = NEAR;
    for (const [key, tu] of this.turrets) { const [c, r] = key.split(',').map(Number), d = dist(this.x, this.y, tileX(c), tileY(r)); if (d < bd) { bd = d; best = tu; } }
    return best;
  }
  /** What you could load into this turret (or any turret): rockets for a rocket launcher, ammo for the rest. */
  private loadable(tu: Turret | null = this.nearTurret()) {
    if (tu?.kind === 'rocket') return this.bag.rocket;
    return AMMO_KINDS.reduce((a, k) => a + this.bag[k], 0);
  }
  /** T next to a turret: put all your ammo in it (all your rockets in a rocket launcher). */
  private loadTurret() {
    const best = this.nearTurret();
    if (!best) { this.bubble(this.x, this.y - 30, 'Walk to a turret to load it', 'info'); Sound.denied(); return; }
    if (!this.loadable(best)) { this.bubble(this.x, this.y - 30, best.kind === 'rocket' ? 'No rockets. Make them in an ammo machine (rocket recipe)' : 'No ammo to load. Make some in the ammo machine', 'info'); Sound.denied(); return; }
    const kinds: Kind[] = best.kind === 'rocket' ? ['rocket'] : AMMO_KINDS;
    let n = 0;
    for (const k of kinds) { while (this.bag[k] > 0 && this.feedTurret(best, k)) { this.bag[k]--; n++; } }
    this.bubble(this.x, this.y - 30, `Loaded ${n} ${best.kind === 'rocket' ? 'rocket' : 'ammo'}${best.kind === 'rocket' && n > 1 ? 's' : ''}`, 'info');
    Sound.thump();
  }
  private count(type: Placeable) { return this.bag[type]; }
  /** Puts one thing into whatever is at (c, r): a machine, turret, lab, building, chest, splitter or a free belt. False if it can't take it. */
  private deliver(c: number, r: number, k: Kind = 'stone') {
    const x = tileX(c), y = tileY(r), key = c + ',' + r;
    const m = this.isMachine(c, r);
    if (m) { if (!this.machineTakes(m, k)) return false; m.queue.push(k); this.bubble(m.x, m.y - 36, `${ONE_NAME[k]} in`, 'info'); return true; }
    const tu = this.turrets.get(key); if (tu) return this.feedTurret(tu, k);
    const lb = this.labs.get(key); if (lb) return this.feedLab(lb, k);
    const bd = this.blds.get(key);
    if (bd && bd.type === 'hub' && k === 'robot') { bd.robots++; this.robots.push(this.newRobot(key)); return true; }
    if (bd && bd.type !== 'tunnel') return this.feedBld(bd, k);
    const ch = this.chests.get(key); if (ch) { if (chestN(ch) >= SURVIVAL.chestSize) return false; ch[k]++; return true; }
    const sp = this.splitters.get(key); if (sp) { if (sp.buf.length >= 4) return false; sp.buf.push(k); return true; }
    if (this.isBelt(key)) { if (this.items.some(o => !o.gone && dist(o.x, o.y, x, y) < 10)) return false; this.items.push({ x, y, k }); return true; }
    return false;
  }
  /** Would whatever is at (c, r) take this thing? (Grabbers only pick up what the thing in front of them can use.) */
  private canTake(c: number, r: number, k: Kind) {
    const key = c + ',' + r;
    const m = this.isMachine(c, r); if (m) return this.machineTakes(m, k);
    const tu = this.turrets.get(key); if (tu) return tu.kind === 'rocket' ? k === 'rocket' : k === 'stone' || isAmmoKind(k);
    const lb = this.labs.get(key); if (lb) return (k === 'pack' && lb.packs < SURVIVAL.labSize) || (k === 'pack2' && (lb.packs2 ?? 0) < SURVIVAL.labSize);
    const b = this.blds.get(key);
    if (b && b.type !== 'tunnel') {
      if (b.type === 'furnace') return !!SMELT[k] && b.inp < 10 && (!b.inp || b.inpK === k);
      if (b.type === 'gen') return k === 'stone' && b.inp < 10;
      if (b.type === 'asm') { const q = REC[b.recipe]?.in[k]; return !!q && (b.buf?.[k] ?? 0) < q * 2; }
      if (b.type === 'hub') return k === 'robot';
      return false;
    }
    const ch = this.chests.get(key); if (ch) return chestN(ch) < SURVIVAL.chestSize;
    return true;
  }
  /** The tile at (c, r) is the machine's side, where belts and grabbers meet it. */
  private isMachine(c: number, r: number) {
    if (this.taken(c, r)) return null;
    return this.machines.find(m => dist(tileX(c), tileY(r), m.x, m.y) < m.r + 24) ?? null;
  }
  /** A grabber with the machine behind it pulls the things it made out of it. */
  private machineGrabbed(m: Machine) {
    for (const [key, gr] of this.grabbers) { const [c, r] = key.split(',').map(Number), [dx, dy] = DIRS[gr.d]; if (this.isMachine(c - dx, r - dy) === m) return true; }
    return false;
  }
  /** Tap a placed thing to put it back in your inventory, with whatever was in it. */
  private pickUp(c: number, r: number) {
    const key = c + ',' + r, x = tileX(c), y = tileY(r);
    // things lying on that spot go in your pocket
    const dropStone = () => { for (const it of this.items) { const t = tileAt(it.x, it.y); if (t && t.c === c && t.r === r) { it.gone = true; this.pocket(it.k); } } this.items = this.items.filter(it => !it.gone); };
    let got: Placeable, extra = 0;
    if (this.belts.has(key)) { this.belts.delete(key); dropStone(); got = 'belt'; }
    else if (this.grabbers.has(key)) { const gk = this.grabbers.get(key)!; if (gk.carry) this.pocket(gk.k); this.grabbers.delete(key); got = 'grab'; }
    else if (this.splitters.has(key)) { for (const a of this.splitters.get(key)!.buf) this.pocket(a); this.splitters.delete(key); got = 'split'; }
    else if (this.pwalls.has(key)) { got = this.pwalls.get(key)!.gate ? 'pgate' : 'wall'; this.pwalls.delete(key); this.wallRects = null; }
    else if (this.chests.has(key)) { const ch = this.chests.get(key)!; extra = chestN(ch); for (const k of KINDS) this.bag[k] += ch[k]; this.chests.delete(key); got = 'chest'; }
    else if (this.blds.has(key)) {
      const b = this.blds.get(key)!;
      if (b.out && b.outK) { this.bag[b.outK] += b.out; extra += b.out; }
      if (b.inp) { this.bag[b.type === 'gen' ? 'stone' : b.inpK ?? 'stone'] += b.inp; extra += b.inp; }
      for (const [k, n] of Object.entries(b.buf ?? {}) as [Kind, number][]) { this.bag[k] += n; extra += n; }
      if (b.type === 'hub') { this.robots = this.robots.filter(rb => { if (rb.hub !== key) return true; if (rb.k) this.pocket(rb.k); return false; }); this.bag.robot += Math.max(0, b.robots - 2); }
      this.blds.delete(key); this.coolT = 0; this.powerT = 0; got = b.type;
      if (this.bldOpen === key) this.closeBld();
    }
    else if (this.labs.has(key)) { const lb = this.labs.get(key)!; this.bag.pack += lb.packs; this.bag.pack2 += lb.packs2 ?? 0; extra = lb.packs + (lb.packs2 ?? 0); this.labs.delete(key); got = 'lab'; }
    else if (this.turrets.has(key)) {
      const tu = this.turrets.get(key)!; extra = Math.floor(tAmmo(tu));
      for (const [k, v] of Object.entries(tu.ammo) as [AmmoKind | 'rocket', number][]) this.bag[k] += Math.floor(v);
      this.turrets.delete(key); if (this.picked === key) this.picked = null;
      got = T_ITEM[tu.kind];
    }
    else return;
    this.bag[got]++; this.syncQuick();
    this.bubble(x, y - 14, `+1 ${ONE_NAME[got].toLowerCase()}${extra ? `, ${extra} things back` : ''}`, 'info');
    Sound.click();
  }
  /** Picks up an ammo machine or a mine (a big round thing), with what's in it. */
  private pickUpBig(s: Machine | Mine) {
    if ('queue' in s) {
      for (const k of [...s.queue, ...s.out]) this.bag[k]++;
      this.machines = this.machines.filter(m => m !== s); this.bag.machine++;
      if (this.recipeFor === s) this.closeRecipe();
    } else {
      if (this.mineAt === s) { this.mining = false; this.mineAt = null; }
      this.mines = this.mines.filter(m => m !== s);
      if (s.ore === 'stone') this.bag.mine++; else this.bag.drill++;
    }
    this.updateStructs(); this.syncQuick();
    this.bubble(s.x, s.y - 30, `+1 ${'queue' in s ? 'ammo machine' : s.ore === 'stone' ? 'stone mine' : 'drill'}`, 'info'); Sound.click();
  }
  /** A quick tap on the map at world point (x, y). */
  private tapAt(x: number, y: number) {
    const t = tileAt(x, y), key = t ? t.c + ',' + t.r : '';
    if (this.picked) {
      const tu = this.turrets.get(this.picked);
      // tap the picked turret again: pick it up
      if (key === this.picked) { this.picked = null; if (t) this.pickUp(t.c, t.r); return; }
      // tap a bear or spawner: that's the turret's target until it is destroyed
      const hit = this.targetAt(x, y);
      if (tu && hit) { tu.target = hit; this.picked = null; this.bubble(hit.x, hit.y - 34, 'Target!', 'info'); Sound.locked(); return; }
      this.picked = null;
      if (!this.turrets.has(key)) { Sound.click(); return; }
    }
    if (t && this.turrets.has(key)) { this.picked = key; Sound.click(); return; }
    // tap a spawner: it makes a bear right away
    const sp = this.spawners.find(s => !s.dead && dist(s.x, s.y, x, y) < SPAWNER_R + 12);
    if (sp) { this.spawnBear(sp, false); this.bubble(sp.x, sp.y - 40, 'A bear!', 'info'); Sound.tone('sawtooth', 160, 90, .3, .1); return; }
    // a mine: pick it up
    const mn = this.mines.find(m => dist(m.x, m.y, x, y) < m.r + 4);
    if (mn) { this.pickUpBig(mn); return; }
    // furnaces and assemblers open their panel (which has Pick up)
    const b = t ? this.blds.get(key) : undefined;
    if (b && (b.type === 'asm' || b.type === 'furnace')) { this.openBld(key); return; }
    if (t) this.pickUp(t.c, t.r);
  }
  /** The bear or spawner under world point (x, y), if any. */
  private targetAt(x: number, y: number): Target | null {
    let best: Target | null = null, bd = Infinity;
    for (const b of this.bears) { if (b.state === 'dead') continue; const d = dist(b.x, b.y, x, y); if (d < BEAR_R + 14 && d < bd) { bd = d; best = b; } }
    for (const sp of this.spawners) { if (sp.dead) continue; const d = dist(sp.x, sp.y, x, y); if (d < SPAWNER_R + 14 && d < bd) { bd = d; best = sp; } }
    return best;
  }
  private taken(c: number, r: number) { const k = c + ',' + r; return this.belts.has(k) || this.grabbers.has(k) || this.turrets.has(k) || this.splitters.has(k) || this.chests.has(k) || this.labs.has(k) || this.blds.has(k) || this.pwalls.has(k); }
  private togglePlacing(type: Placeable) {
    if (this.placing && this.placeType === type) { this.placing = false; Sound.click(); return; }
    if (!this.count(type)) { this.bubble(this.x, this.y - 30, `No ${KIND_NAME[type]}. Craft them in your inventory (Shift)`, 'info'); Sound.denied(); return; }
    this.placing = true; this.placeType = type; this.hover = null; this.closeBld();
    Sound.click();
  }
  /** Turns whatever is on a tile; false if nothing is there. */
  private turnTile(key: string) {
    if (this.belts.has(key)) { this.belts.set(key, (this.belts.get(key)! + 1) % 4); Sound.click(); return true; }
    const gr = this.grabbers.get(key);
    if (gr) { gr.d = (gr.d + 1) % 4; Sound.click(); return true; }
    const sp = this.splitters.get(key);
    if (sp) { sp.d = (sp.d + 1) % 4; Sound.click(); return true; }
    const bd = this.blds.get(key);
    if (bd && ['furnace', 'asm', 'tunnel', 'drill'].includes(bd.type)) { bd.d = (bd.d + 1) % 4; Sound.click(); return true; }
    return false;
  }
  /** Where the thing would go: under the mouse, or the tile in front of the guy. */
  private ghost() {
    if (this.hover && performance.now() - this.hover.t < 4000) return this.hover;
    const d = DIRS[Math.round(((this.face % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 4];
    return tileAt(this.x + d[0] * TILE, this.y + d[1] * TILE);
  }
  /** Can a new mine or ammo machine (radius rr) go with its centre on tile (c, r)? Anywhere off the fence and clear of other things. */
  private bigFits(c: number, r: number, rr: number) {
    const x = tileX(c), y = tileY(r);
    if (x < rr || y < rr || x > W - rr || y > H - rr) return false;
    if (this.walls.some(([ax, ay, bx, by]) => x > ax - rr - 4 && x < bx + rr + 4 && y > ay - rr - 4 && y < by + rr + 4)) return false;
    if (structs.some(o => dist(x, y, o.x, o.y) < rr + o.r + 16)) return false;
    for (const m of [this.belts, this.grabbers, this.turrets, this.splitters, this.chests, this.labs, this.blds, this.pwalls] as Map<string, unknown>[]) for (const key of m.keys()) { const [cc, rr2] = key.split(',').map(Number); if (dist(x, y, tileX(cc), tileY(rr2)) < rr + 12) return false; }
    return true;
  }
  /** The ore patch under tile (c, r), if it has ore left. */
  private patchAt(c: number, r: number) { const x = tileX(c), y = tileY(r); const i = this.patches.findIndex(p => p.left > 0 && inPatch(p, x, y, 0)); return i; }
  private placeAt(c: number, r: number) {
    const key = c + ',' + r, type = this.placeType;
    if (!this.count(type)) { this.placing = false; return; }
    if (isBig(type)) {
      const rr = type === 'machine' ? MACHINE_R : MINE_R;
      if (!this.bigFits(c, r, rr)) { this.bubble(tileX(c), tileY(r) - 30, 'Not enough room there', 'info'); Sound.denied(); return; }
      if (type === 'mine') this.mines.push({ x: tileX(c), y: tileY(r), r: rr, ore: 'stone' });
      else this.machines.push({ x: tileX(c), y: tileY(r), r: rr, queue: [], batchT: 0, out: [], recipe: null });
      this.bag[type]--; this.updateStructs(); Sound.thump();
      if (!this.count(type)) this.placing = false;
      return;
    }
    if (this.turnTile(key)) return;
    if (this.taken(c, r)) { this.bubble(tileX(c), tileY(r) - 16, 'Something is there', 'info'); Sound.denied(); return; }
    if (blockedTile(c, r)) { this.bubble(tileX(c), tileY(r) - 16, "Can't put that there", 'info'); Sound.denied(); return; }
    if (type === 'drill' && this.patchAt(c, r) < 0) { this.bubble(tileX(c), tileY(r) - 16, 'Put drills on an ore patch', 'info'); Sound.denied(); return; }
    const tk = ITEM_T[type];
    if (type === 'belt') this.belts.set(key, this.placeDir);
    else if (type === 'grab') this.grabbers.set(key, { d: this.placeDir, t: 0, carry: false, k: 'stone' });
    else if (type === 'split') this.splitters.set(key, { d: this.placeDir, buf: [], side: 0, t: 0 });
    else if (type === 'chest') this.chests.set(key, emptyBag());
    else if (type === 'wall' || type === 'pgate') {
      const x = tileX(c), y = tileY(r);
            if (this.bears.some(b => b.state !== 'dead' && dist(b.x, b.y, x, y) < BEAR_R + 12)) { this.bubble(x, y - 16, 'A bear is in the way', 'info'); Sound.denied(); return; }
      this.pwalls.set(key, { hp: type === 'pgate' ? SURVIVAL.gateHp : SURVIVAL.wallHp, gate: type === 'pgate' }); this.wallRects = null;
    }
    else if (type === 'lab') { this.labs.set(key, { packs: 0, packs2: 0, t: 0 }); this.powerT = 0; }
    else if (tk) { this.turrets.set(key, { ammo: {}, cd: 0, face: -Math.PI / 2, kind: tk }); this.coolT = 0; }
    else {
      const bt = type as BType;
      this.blds.set(key, { type: bt, d: this.placeDir, inp: 0, out: 0, t: 0, fuel: 0, recipe: '', robots: bt === 'hub' ? 2 : 0, pi: bt === 'drill' ? this.patchAt(c, r) : undefined });
      this.coolT = 0; this.powerT = 0;
      if (bt === 'hub') this.robots.push(this.newRobot(key), this.newRobot(key));
      if (bt === 'asm') this.bubble(tileX(c), tileY(r) - 20, 'Tap it to pick a recipe', 'info');
      if (ELECTRIC.includes(bt) && !this.blds.size) this.bubble(tileX(c), tileY(r) - 34, 'Needs power: a generator and poles', 'info');
    }
    this.bag[type]--;
    // things lying on the spot go back in your pocket
    if (type !== 'belt') { for (const it of this.items) { const t = tileAt(it.x, it.y); if (t && t.c === c && t.r === r) { it.gone = true; this.pocket(it.k); } } this.items = this.items.filter(it => !it.gone); }
    Sound.thump();
    if (!this.count(type)) this.placing = false;
  }
  /** R: turn the thing being placed, or the belt under (or in front of) the guy. */
  private rotate() {
    if (this.placing) { this.placeDir = (this.placeDir + 1) % 4; Sound.click(); return; }
    for (const t of [tileAt(this.x, this.y), this.ghost()]) {
      if (!t) continue;
      if (this.turnTile(t.c + ',' + t.r)) return;
    }
    this.bubble(this.x, this.y - 30, 'Stand on a belt or face a grabber to turn it', 'info');
  }
  /** New stone (or metal, from a metal mine) goes onto a belt that touches the mine, or into your pocket. */
  private giveStone(x: number, y: number, mine: Mine) {
    const k: Kind = mine.ore;
    let best: { c: number; r: number } | null = null, bd = mine.r + 34;
    for (const key of this.belts.keys()) {
      const [c, r] = key.split(',').map(Number), d = dist(tileX(c), tileY(r), mine.x, mine.y);
      if (d < bd) { bd = d; best = { c, r }; }
    }
    if (best && this.items.length < 80) { this.items.push({ x: tileX(best.c), y: tileY(best.r), k }); this.bubble(x, y, `+1 ${k} on the belt`, 'info'); }
    else { this.bag[k]++; this.bubble(x, y, `+1 ${k}`, 'info'); }
  }
  private isBelt(k: string) { return this.belts.has(k) || this.blds.get(k)?.type === 'tunnel'; }
  /** Belts move stone along; stone that runs into the machine goes in as a batch. */
  private moveItems(dt: number) {
    const step = ST.beltSpeed * dt;
    for (const it of this.items) {
      const t = tileAt(it.x, it.y);
      const tk = t ? t.c + ',' + t.r : '', tb = this.blds.get(tk), tun = tb && tb.type === 'tunnel' ? tb : null;
      const d = t ? (tun ? tun.d : this.belts.get(tk)) : undefined;
      if (!t || d === undefined) continue;
      const [dx, dy] = DIRS[d];
      if (it.skip && it.skip !== tk) it.skip = undefined;
      // an underground belt sends things under to the next one ahead facing the same way
      if (tun && it.skip !== tk && (it.x - tileX(t.c)) * dx + (it.y - tileY(t.r)) * dy >= 0) {
        let jumped = false;
        for (let j = 1; j <= SURVIVAL.tunnelReach; j++) {
          const ek = (t.c + dx * j) + ',' + (t.r + dy * j), eb = this.blds.get(ek);
          if (eb && eb.type === 'tunnel' && eb.d === d) {
            const ex = tileX(t.c + dx * j), ey = tileY(t.r + dy * j);
            if (!this.items.some(o => o !== it && !o.gone && dist(o.x, o.y, ex, ey) < 10)) { it.x = ex; it.y = ey; it.skip = ek; }
            jumped = true; break;
          }
        }
        if (jumped) continue;
      }
      // anything just ahead on the belt holds it up
      if (this.items.some(o => { const a = (o.x - it.x) * dx + (o.y - it.y) * dy; return o !== it && !o.gone && a > 0 && a < 11 && Math.abs((o.x - it.x) * dy - (o.y - it.y) * dx) < 6; })) continue;
      // keep to the middle of the belt
      if (dx) it.y += clamp(tileY(t.r) - it.y, -step, step); else it.x += clamp(tileX(t.c) - it.x, -step, step);
      const nx = it.x + dx * step, ny = it.y + dy * step, nt = tileAt(nx + dx * 6, ny + dy * 6);
      const onward = nt && (nt.c !== t.c || nt.r !== t.r) ? this.isBelt(nt.c + ',' + nt.r) : !!nt;
      if (onward) { it.x = nx; it.y = ny; continue; }
      if (!this.isBelt((t.c + dx) + ',' + (t.r + dy)) && this.deliver(t.c + dx, t.r + dy, it.k)) {
        it.gone = true;
      } else {
        // end of the line: it waits at the edge
        it.x = clamp(nx, tileX(t.c) - 9, tileX(t.c) + 9); it.y = clamp(ny, tileY(t.r) - 9, tileY(t.r) + 9);
      }
    }
    // grabbers: pick a stone up from behind, swing, put it down in front
    for (const [key, gr] of this.grabbers) {
      const [c, r] = key.split(',').map(Number), [dx, dy] = DIRS[gr.d];
      if (!gr.carry) {
        const it = this.items.find(o => { if (o.gone) return false; const t = tileAt(o.x, o.y); return !!t && t.c === c - dx && t.r === r - dy && this.canTake(c + dx, r + dy, o.k); });
        if (it) { it.gone = true; gr.carry = true; gr.k = it.k; gr.t = 0; }
        else {
          // or one out of a chest behind it (ammo first), or stone ammo out of the machine
          const bk = (c - dx) + ',' + (r - dy), ch = this.chests.get(bk);
          const kk = ch ? KINDS.find(x => ch[x] > 0 && this.canTake(c + dx, r + dy, x)) : undefined, bb = this.blds.get(bk);
          if (ch && kk) { ch[kk]--; gr.carry = true; gr.k = kk; gr.t = 0; }
          else if (bb && bb.out > 0 && bb.outK && this.canTake(c + dx, r + dy, bb.outK)) { gr.k = bb.outK; bb.out--; if (!bb.out) bb.outK = undefined; gr.carry = true; gr.t = 0; }
          else { const bm = this.isMachine(c - dx, r - dy); if (bm && bm.out.length) { gr.k = bm.out.shift()!; gr.carry = true; gr.t = 0; } }
        }
        continue;
      }
      gr.t += dt;
      if (gr.t < ST.grabTime) continue;
      const fx = tileX(c + dx), fy = tileY(r + dy);
      if (this.deliver(c + dx, r + dy, gr.k)) { gr.carry = false; continue; }
      const ft = tileAt(fx, fy);
      if (!ft || this.taken(ft.c, ft.r) || this.grabbers.has(ft.c + ',' + ft.r) || blockedTile(ft.c, ft.r)) continue; // nowhere to put it: hold on
      // wait for room on the tile in front
      if (this.items.some(o => !o.gone && dist(o.x, o.y, fx, fy) < 10)) continue;
      this.items.push({ x: fx, y: fy, k: gr.k }); gr.carry = false;
    }
    // splitters: send stone out to the left and right in turn, so it splits evenly
    for (const [key, sp] of this.splitters) {
      sp.t = Math.max(0, sp.t - dt);
      if (!sp.buf.length || sp.t > 0) continue;
      const [c, r] = key.split(',').map(Number);
      for (let k = 0; k < 2; k++) {
        const [dx, dy] = DIRS[(sp.d + (sp.side ? 3 : 1)) % 4];
        sp.side ^= 1;
        if (this.deliver(c + dx, r + dy, sp.buf[0])) { sp.buf.shift(); sp.t = SURVIVAL.splitTime; break; }
      }
    }
    this.items = this.items.filter(it => !it.gone);
    // walk over stone to pick it up
    let got = false;
    for (const it of this.items) if (dist(it.x, it.y, this.x, this.y) <= GUY_R + 4) { it.gone = true; got = true; this.pocket(it.k); }
    if (got) { this.items = this.items.filter(it => !it.gone); Sound.click(); }
  }

  /** Miners are shared out between the mines: the mine and the spot round it for miner i. */
  private minerSpot(i: number): [Mine, number, number] {
    const n = this.mines.length, [ox, oy] = MINER_SPOTS[Math.floor(i / n) % MINER_SPOTS.length];
    return [this.mines[i % n], ox, oy];
  }
  private minerCost() { return this.miners.length ? SURVIVAL.extraMinerCost : SURVIVAL.minerCost; }
  /** H next to the mine: hire a miner (30 stone, then 20 for each extra one), who digs a stone every 5 seconds for you. */
  private hire() {
    if (!this.mineOn) return;
    if (this.miners.length >= SURVIVAL.maxMiners * this.mines.length) { this.bubble(this.x, this.y - 30, 'No room for more miners. Buy another mine', 'info'); Sound.denied(); return; }
    if (!near(this.mines, this.x, this.y)) { this.bubble(this.x, this.y - 30, 'Walk to the mine to hire a miner', 'info'); Sound.denied(); return; }
    const cost = this.minerCost();
    if (this.bag.stone < cost) { this.bubble(this.x, this.y - 30, `${this.miners.length ? 'An extra' : 'A'} miner costs ${cost} stone`, 'info'); Sound.denied(); return; }
    this.bag.stone -= cost; this.miners.push(Math.random() * ST.minerEvery * .5);
    this.say(this.miners.length > 1 ? `You hired miner ${this.miners.length}!` : 'You hired a miner!'); Sound.pop();
  }
  /** S: the next ammo slot with ammo in it. */
  private switchAmmo() {
    const has = [0, 1, 2].filter(i => this.ammoSlots[i]);
    if (!has.length) { this.bubble(this.x, this.y - 30, 'No ammo in your ammo slots', 'info'); Sound.denied(); return; }
    this.aSel = has[(has.indexOf(this.aSel) + 1) % has.length]; this.armsSig = '';
    this.bubble(this.x, this.y - 30, ONE_NAME[this.ammoSlots[this.aSel]!.k], 'info'); Sound.click();
  }
  private ammoName() { const w = this.weapon(), i = w ? this.ammoSlot(w) : -1, a = i >= 0 ? this.ammoSlots[i]! : null; return a ? `${a.k === 'rocket' ? 'Rockets' : AMMO_NAME[a.k]} (${Math.ceil(a.pts / SURVIVAL.ammoPoints - 1e-9)})` : w === 'xbow' ? AMMO[this.load.ammo].name : 'none'; }

  /* ---------- rules ---------- */
  update(dt: number) {
    if (!this.running || this.paused || this.labOpen || this.recipeFor) return;
    this.t += dt;
    this.reload = Math.max(0, this.reload - dt);
    this.holdFire(dt);
    this.runAcid(dt);
    this.noTargetT -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // walking: arrow keys or the drag stick
    let mx = 0, my = 0;
    if (this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('ArrowDown')) my += 1;
    if (this.stick) { const m = Math.hypot(this.stick.dx, this.stick.dy); if (m > 6) { mx = this.stick.dx / 46; my = this.stick.dy / 46; } }
    const m = Math.hypot(mx, my);
    if (m > 0) {
      if (m > 1) { mx /= m; my /= m; }
      this.x += mx * SURVIVAL.guySpeed * dt; this.y += my * SURVIVAL.guySpeed * dt;
      this.face = Math.atan2(my, mx);
      this.walk += dt * 10 * Math.min(1, m);
      this.stepT -= dt * Math.min(1, m); if (this.stepT <= 0) { this.stepT = .3; Sound.step(); }
    }
    // a belt under the guy carries him along
    const under = tileAt(this.x, this.y), ud = under ? this.belts.get(under.c + ',' + under.r) : undefined;
    if (ud !== undefined) { this.x += DIRS[ud][0] * ST.beltSpeed * dt; this.y += DIRS[ud][1] * ST.beltSpeed * dt; }
    // the guy can walk out through any gate, but not through the fence, and stays on the map
    this.x = clamp(this.x, GUY_R, W - GUY_R); this.y = clamp(this.y, GUY_R, H - GUY_R);
    const me = { x: this.x, y: this.y }; collide(me, GUY_R, this.walls); this.x = me.x; this.y = me.y;
    // walking over a furnace picks up what it has smelted
    { const ft = tileAt(this.x, this.y), fb = ft ? this.blds.get(ft.c + ',' + ft.r) : undefined;
      if (fb && fb.type === 'furnace' && fb.out >= 1 && fb.outK) { const n = Math.floor(fb.out); this.bag[fb.outK] += n; fb.out -= n; this.bubble(this.x, this.y - 30, `+${n} ${n === 1 ? ONE_NAME[fb.outK].toLowerCase() : KIND_NAME[fb.outK]}`, 'info'); Sound.pop(); this.bldSig = ''; } }

    // healing: 1.2% of max health every second
    this.healT += dt;
    while (this.healT >= 1) { this.healT -= 1; this.hp = Math.min(SURVIVAL.maxHp, this.hp + SURVIVAL.maxHp * ST.heal); }

    // mining: a stone every 4 seconds while next to the mine
    this.swing = Math.max(0, this.swing - dt);
    if (this.mineOn) this.popT += dt;
    const mineAt = this.mineAt;
    if (this.mining && mineAt) {
      if (m > 0 || dist(this.x, this.y, mineAt.x, mineAt.y) > NEAR) this.mining = false;
      else {
        this.face = Math.atan2(mineAt.y - this.y, mineAt.x - this.x);
        if (this.swing <= 0) { this.swing = 1; Sound.click(); }
        this.mineT += dt;
        if (this.mineT >= ST.mineEvery) { this.mineT -= ST.mineEvery; this.giveStone(mineAt.x, mineAt.y - 30, mineAt); Sound.dink(); }
      }
    }
    // digging an ore patch by hand
    const dg = this.digAt;
    if (dg) {
      if (m > 0 || dg.left <= 0 || dist(this.x, this.y, dg.x, dg.y) > dg.r + 30) { this.digAt = null; if (dg.left <= 0) this.bubble(dg.x, dg.y - dg.r, 'This patch has run out', 'info'); }
      else {
        this.face = Math.atan2(dg.y - this.y, dg.x - this.x);
        if (this.swing <= 0) { this.swing = 1; Sound.click(); }
        this.mineT += dt * ST.digMul;
        if (this.mineT >= SURVIVAL.digEvery) { this.mineT -= SURVIVAL.digEvery; dg.left--; this.bag[dg.ore]++; this.bubble(this.x, this.y - 30, `+1 ${dg.ore === 'stone' ? 'stone' : ONE_NAME[dg.ore].toLowerCase()}`, 'info'); Sound.dink(); }
      }
    }
    this.runQueue(dt);
    // pollution fades away slowly; the factory adds to it (in runBlds and the ammo machines)
    this.pollution = Math.max(0, this.pollution - this.pollution * SURVIVAL.pollutionFade * dt);
    for (let i = 0; i < this.miners.length && this.mines.length; i++) {
      this.miners[i] += dt;
      if (this.miners[i] >= ST.minerEvery) { this.miners[i] -= ST.minerEvery; const [mine, ox, oy] = this.minerSpot(i); this.giveStone(mine.x + ox, mine.y + oy - 18, mine); }
    }
    this.moveItems(dt);
    this.runLabs(dt);
    this.runBlds(dt);
    for (const mc of this.machines) {
      const job = this.machineJob(mc);
      if (job) {
        mc.batchT += dt; this.pollution += SURVIVAL.pollution.machine * dt;
        if (mc.batchT >= SURVIVAL.batchTime) {
          mc.batchT -= SURVIVAL.batchTime;
          const [out, n] = this.batchOf(mc, job);
          // a rocket uses 10 stone; everything else is one thing in
          let take = out === 'rocket' ? SURVIVAL.rocketStone : 1;
          mc.queue = mc.queue.filter(k => { if (take > 0 && k === job) { take--; return false; } return true; });
          // with a grabber pulling from the machine, what it makes waits in the machine for it; otherwise it's yours
          if (this.machineGrabbed(mc)) for (let i = 0; i < n; i++) mc.out.push(out); else this.bag[out] += n;
          this.bubble(mc.x, mc.y - 36, `+${n} ${n === 1 && out === 'rocket' ? 'rocket' : KIND_NAME[out]}`, 'info'); Sound.pop();
        }
      } else mc.batchT = 0;
      if (mc.out.length && !this.machineGrabbed(mc)) { for (const k of mc.out) this.bag[k]++; mc.out = []; }
    }

    // gates: 3 more after 8 minutes (one on each other side), 3 more after 20 minutes
    if (!NO_BASE && this.gateStage === 0 && this.t >= SURVIVAL.moreGates) {
      this.gateStage = 1; this.gates.push(...MORE_GATES.map(([side, at]) => ({ side, at, open: 0 }))); this.rebuildWalls();
      this.say('Gates opened on the other 3 sides!', 4); Sound.alarm();
    }
    if (!NO_BASE && this.gateStage === 1 && this.t >= SURVIVAL.allGates) {
      this.gateStage = 2; this.gates.push(...LAST_GATES.map(([side, at]) => ({ side, at, open: 0 }))); this.rebuildWalls();
      this.gateWait = SURVIVAL.gateWaitLate;
      this.say('3 more gates! Bears now take 40 seconds to get in', 5); Sound.alarm();
    }

    // bear spawners: each makes a bear every 5 seconds while there are fewer than 6 on the map
    let steady = this.bears.filter(b => b.state !== 'dead' && !b.wave).length;
    for (const sp of this.spawners) {
      if (sp.dead) {
        // a destroyed spawner comes back 30 seconds later, somewhere else in the woods
        sp.respawn = (sp.respawn ?? SURVIVAL.spawnerBack) - dt;
        if (sp.respawn <= 0) {
          let [x, y] = spawnerSpot(Math.random() * Math.PI * 2);
          for (let i = 0; i < 20 && this.spawners.some(o => o !== sp && !o.dead && dist(o.x, o.y, x, y) < 600); i++) [x, y] = spawnerSpot(Math.random() * Math.PI * 2);
          const first = sp.pre;
          Object.assign(sp, { x, y, hp: SURVIVAL.spawnerHp, t: first ? 5 : SURVIVAL.spawnEvery, hurt: 0, dead: false, respawn: undefined, pre: undefined });
          if (!first) { this.say('A new bear spawner appeared!', 3); Sound.alarm(); }
          else if (!this.spawners.some(o => o.pre)) { this.say(`${this.spawners.length} bear spawners have appeared in the woods! Bears are coming`, 5); Sound.alarm(); }
        }
        continue;
      }
      sp.hurt = Math.max(0, sp.hurt - dt);
      sp.t -= dt;
      if (sp.t > 0) continue;
      sp.t = (this.t < SURVIVAL.earlyTime ? SURVIVAL.spawnEarly : SURVIVAL.spawnEvery / (this.mineOn ? SURVIVAL.mineBears : 1)) / (1 + this.smog() * .5);
      if (steady < SURVIVAL.maxBears + Math.floor(this.smog() * 2)) { this.spawnBear(sp, false); steady++; }
    }
    // huge waves at 12, 20 and 28 minutes (then every 8 minutes), out of the spawners, on top of the steady bears
    this.waveT -= dt;
    if (!this.waveWarned && this.waveT <= 5) { this.waveWarned = true; this.say('A huge wave of bears is coming!', 4); Sound.boom(false); }
    if (this.waveT <= 0) {
      this.waveLeft += SURVIVAL.waveSize + this.waveN * SURVIVAL.waveGrow; this.waveN++;
      this.waveT = SURVIVAL.waveEvery; this.waveWarned = false;
      this.say(`Huge wave ${this.waveN}!`, 3);
    }
    if (this.waveLeft > 0) {
      this.waveGap -= dt;
      const live = this.spawners.filter(s => !s.dead);
      if (this.waveGap <= 0 && live.length) { this.spawnBear(live[this.waveLeft % live.length], true); this.waveLeft--; this.waveGap = .25; }
    }

    const entering = new Set<Gate>();
    const guyOut = !insideBase(this.x, this.y);
    // no camp: bears gather by their spawners, and once there are enough of them they all come at once
    if (NO_BASE) {
      const gathering = this.bears.filter(b => b.state === 'walk' || b.state === 'wait');
      if (gathering.length >= this.groupSize) {
        for (const b of gathering) { b.state = 'chase'; b.cd = .6; b.tc = 2; }
        this.say(`${gathering.length} bears are coming for you!`, 3); Sound.alarm();
        this.groupSize = this.newGroup();
      }
    }
    for (const b of this.bears) {
      if (b.state === 'dead') { b.dead += dt; continue; }
      b.hurt = Math.max(0, b.hurt - dt); b.swipe = Math.max(0, b.swipe - dt);
      // bears growl when you're near
      b.gr = (b.gr ?? Math.random() * 3) - dt;
      if (!b.fish && b.gr <= 0 && dist(b.x, b.y, this.x, this.y) < 260) { b.gr = 4 + Math.random() * 4; Sound.growl(clamp((b.x - this.x) / 260, -1, 1)); }
      // a bear outside goes for you if you come close
      if ((b.state === 'walk' || b.state === 'wait') && guyOut && dist(b.x, b.y, this.x, this.y) < SURVIVAL.chaseRange) { b.state = 'chase'; b.cd = .6; b.tc = 2; }
      if (b.state === 'walk') {
        if (this.navTo(b, b.tx, b.ty, SURVIVAL.bearSpeed, dt, 12)) b.state = 'wait';
      } else if (b.state === 'wait' && NO_BASE) {
        // gathering by its spawner: it looks your way until the group is big enough
        b.face = approachAngle(b.face, Math.atan2(this.y - b.y, this.x - b.x), dt * 1.5);
      } else if (b.state === 'wait') {
        b.wait += dt;
        const G = gateAt(b.gate);
        b.face = approachAngle(b.face, Math.atan2(G.y - b.y, G.x - b.x), dt * 2);
        if (b.wait >= this.gateWait + (this.brickGate ? 10 : 0)) b.state = 'enter';
      } else if (b.state === 'enter') {
        // through its gate, then after you
        const G = gateAt(b.gate);
        if (dist(b.x, b.y, G.x, G.y) < 90) entering.add(b.gate);
        if (this.navTo(b, G.ix, G.iy, SURVIVAL.bearSpeedInside, dt)) {
          b.state = 'chase'; b.cd = .8; b.tc = 2;
          this.say('A bear got in!');
          Sound.tone('sawtooth', 160, 90, .5, .12);
        }
      } else {
        // chasing: go for the guy (through a gate if the fence is in the way) and swipe every 5 seconds
        b.cd = Math.max(0, b.cd - dt);
        const d = Math.hypot(this.x - b.x, this.y - b.y), reach = GUY_R + BEAR_R + 6;
        if (b.fish) {
          // an acid fish keeps its distance and spits acid slime from 10 tiles away
          if (d > SURVIVAL.fishRange * .7) this.navTo(b, this.x, this.y, SURVIVAL.bearSpeedInside, dt, SURVIVAL.fishRange * .7);
          else b.face = approachAngle(b.face, Math.atan2(this.y - b.y, this.x - b.x), dt * 6);
          b.tc = Math.max(0, b.tc - dt);
          if (d <= SURVIVAL.fishRange && b.tc <= 0) this.spit(b);
          continue;
        }
        if (d > reach - 2) this.navTo(b, this.x, this.y, SURVIVAL.bearSpeedInside, dt, reach - 2);
        else b.face = approachAngle(b.face, Math.atan2(this.y - b.y, this.x - b.x), dt * 6);
        if (d <= reach && b.cd <= 0) this.bearHit(b);
        // bears don't throw rocks (only acid fish spit)
      }
    }
    for (const g of this.gates) g.open = clamp(g.open + (entering.has(g) ? dt : -dt) * 1.5, 0, 1);
    // turrets shoot the bear or spawner you picked for them, or else the nearest one in range, while they have ammo
    this.rapidSnd -= dt;
    for (const [key, tu] of this.turrets) {
      tu.cd = Math.max(0, tu.cd - dt);
      if (tu.target && !alive(tu.target)) tu.target = null;
      if (tAmmo(tu) < 1e-6 || tu.cd > 0) continue;
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r);
      const range = tu.kind === 'rocket' ? SURVIVAL.rocketRange : ST.turretRange * (tu.kind === 'brick' ? 1.2 : 1);
      let target: Target | null;
      if (tu.target) target = dist(x, y, tu.target.x, tu.target.y) - (isBear(tu.target) ? 0 : SPAWNER_R) <= range ? tu.target : null;
      else target = this.nearestTarget(x, y, range);
      if (!target) continue;
      const a = Math.atan2(target.y - y, target.x - x), cool = tu.cool ? .5 : 1;
      tu.face = a;
      if (tu.kind === 'rocket') {
        tu.ammo.rocket = (tu.ammo.rocket ?? 0) - 1; tu.cd = SURVIVAL.rocketReload * cool;
        this.rockets.push({ from: key, x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, a, t: 0, spin: Math.random() < .5 ? 1 : -1, target, trail: [] });
        Sound.rocket();
        continue;
      }
      const k = AMMO_KINDS.find(k => (tu.ammo[k] ?? 0) > 1e-6)!;
      const mul = ST.turretDamage / SURVIVAL.turretDamage;
      let dmg: number;
      if (tu.kind === 'rapid') {
        // a rapid crossbow: 0.75 damage every 0.05 seconds, using 0.8% of one ammo a shot
        dmg = SURVIVAL.rapidDamage * mul; tu.ammo[k] = (tu.ammo[k] ?? 0) - SURVIVAL.rapidUse; tu.cd = SURVIVAL.rapidReload * cool;
        if (this.rapidSnd <= 0) { this.rapidSnd = .12; Sound.tone('square', 900, 600, .03, .03); }
      } else {
        // every turret shot does 1 damage (more with the heavy turret research), whatever the ammo, and uses 16% of an ammo
        dmg = SURVIVAL.turretShot * mul; tu.ammo[k] = (tu.ammo[k] ?? 0) - SURVIVAL.turretUse; tu.cd = SURVIVAL.turretEvery * cool;
        if (this.rapidSnd <= 0) { this.rapidSnd = .18; Sound.turret(); }
      }
      if ((tu.ammo[k] ?? 0) < 1e-6) delete tu.ammo[k];
      this.bolts.push({ from: key, x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: range + 80, dmg, target, stone: true, color: k === 'ammo' ? undefined : metalOf(k).color });
    }
    this.separate(dt);

    // bolts
    for (const bo of this.bolts) {
      if (bo.target && alive(bo.target)) {
        // a targeted bolt curves onto its bear
        const a = Math.atan2(bo.target.y - bo.y, bo.target.x - bo.x), s = SURVIVAL.boltSpeed;
        const cur = Math.atan2(bo.vy, bo.vx), na = approachAngle(cur, a, dt * 9);
        bo.vx = Math.cos(na) * s; bo.vy = Math.sin(na) * s;
      }
      bo.x += bo.vx * dt; bo.y += bo.vy * dt; bo.left -= SURVIVAL.boltSpeed * dt;
      // your walls and gates stop bolts (the tile it was shot from doesn't count); the wall takes no damage
      const wk = this.wallAt(bo.x, bo.y); if (wk && wk !== bo.from) { bo.left = 0; this.sparks.push({ x: bo.x, y: bo.y, t: 0 }); continue; }
      const hit = this.hitAt(bo.x, bo.y, 4);
      if (hit) { this.damageTarget(hit, bo.dmg); bo.left = 0; }
    }
    this.bolts = this.bolts.filter(b => b.left > 0);
    // rockets: a swirl (one loop), then they home in on the bear or spawner
    for (const rk of this.rockets) {
      rk.t += dt;
      if (!rk.target || !alive(rk.target)) { const nt = this.nearestTarget(rk.x, rk.y, 400); if (nt) rk.target = nt; else { rk.t = 99; continue; } }
      const swirl = .75;
      if (rk.t < swirl) rk.a += rk.spin * Math.PI * 2 / swirl * dt;
      else if (rk.target) rk.a = approachAngle(rk.a, Math.atan2(rk.target.y - rk.y, rk.target.x - rk.x), dt * 8);
      const sp = SURVIVAL.rocketSpeed * (rk.t < swirl ? .55 : 1 + (rk.t - swirl) * .8);
      rk.x += Math.cos(rk.a) * sp * dt; rk.y += Math.sin(rk.a) * sp * dt;
      rk.trail.push({ x: rk.x, y: rk.y }); if (rk.trail.length > 18) rk.trail.shift();
      const rw = this.wallAt(rk.x, rk.y); if (rw && rw !== rk.from) { this.blasts.push({ x: rk.x, y: rk.y, t: 0 }); Sound.boom(false); rk.t = 99; continue; }
      const hit = this.hitAt(rk.x, rk.y, 6);
      if (hit && (hit === rk.target || rk.t > swirl)) {
        this.damageTarget(hit, SURVIVAL.rocketDamage);
        this.blasts.push({ x: rk.x, y: rk.y, t: 0 });
        Sound.boom(false); rk.t = 99;
      }
    }
    this.rockets = this.rockets.filter(r => r.t < 8);
    for (const bl of this.blasts) bl.t += dt;
    for (const sp of this.sparks) sp.t += dt;
    this.sparks = this.sparks.filter(s => s.t < .25);
    this.blasts = this.blasts.filter(b => b.t < .5);
    for (const r of this.rocks) {
      r.x += r.vx * dt; r.y += r.vy * dt; r.left -= SURVIVAL.throwSpeed * dt; r.spin += dt * 9;
      if (this.wallAt(r.x, r.y)) { r.left = 0; this.sparks.push({ x: r.x, y: r.y, t: 0 }); continue; }
      if (dist(r.x, r.y, this.x, this.y) < GUY_R + 5) { r.left = 0; this.hurt(SURVIVAL.bearThrow); }
    }
    this.rocks = this.rocks.filter(r => r.left > 0);
    this.bears = this.bears.filter(b => b.state !== 'dead' || b.dead < 1.2);
    for (const u of this.bubbles) u.t += dt;
    this.bubbles = this.bubbles.filter(u => u.t < (u.kind === 'loss' ? 1.6 : 1.1));

    if (this.hp <= 0) { this.hp = 0; this.end(false); }

  }
  /** How polluted it is: 0 is clean, 1 for every 100 pollution (up to 10). */
  private smog() { return Math.min(10, this.pollution / 100); }
  private rapidSnd = 0;
  private blasts: { x: number; y: number; t: number }[] = [];
  private end(won: boolean) {
    this.running = false;
    Sound.boom(!won);
    this.mining = false;
    if (won) this.say('You destroyed every bear spawner!', 5);
    this.hooks.over({ time: this.t, kills: this.kills, shots: this.shots, hits: this.hits, damage: this.damage, won, spawners: this.spawnerKills });
  }
  /** The next thing a machine works on: 10 stone for a rocket (if that's the recipe and it has them), else what's first in. */
  private machineJob(mc: Machine): Kind | null {
    if (!mc.queue.length) return null;
    // in the order things went in; stone for rockets waits until there are 10, letting metal behind it go first
    if (mc.recipe === 'rocket' && mc.queue[0] === 'stone' && mc.queue.filter(k => k === 'stone').length < SURVIVAL.rocketStone) return mc.queue.find(k => k !== 'stone') ?? null;
    return mc.queue[0];
  }
  /** The bear or spawner a bolt or rocket at (x, y) hits, if any. */
  private hitAt(x: number, y: number, pad: number): Target | null {
    for (const b of this.bears) if (b.state !== 'dead' && dist(b.x, b.y, x, y) < BEAR_R + pad) return b;
    for (const sp of this.spawners) if (!sp.dead && dist(sp.x, sp.y, x, y) < SPAWNER_R + pad) return sp;
    return null;
  }
  private damageTarget(t: Target, dmg: number) {
    if (isBear(t)) { this.boltHit(t, dmg); return; }
    t.hp -= dmg; t.hurt = .25;
    this.hits++; this.damage += Math.min(dmg, t.hp + dmg);
    if (dmg >= 1) { this.bubble(t.x, t.y - 34, '-' + trim(dmg), 'dmg'); Sound.hitPlane(); }
    if (t.hp <= 1e-6) {
      t.hp = 0; t.dead = true; this.spawnerKills++;
      this.blasts.push({ x: t.x, y: t.y, t: 0 });
      const left = this.spawners.filter(s => !s.dead).length;
      this.say(`Spawner destroyed! A new one comes in ${SURVIVAL.spawnerBack} seconds${left ? '' : '. No spawners left for now'}`, 3);
      t.respawn = SURVIVAL.spawnerBack;
      Sound.boom(true);
    }
  }

  private spawnBear(sp: Spawner, wave: boolean) {
    // bears come out of a spawner and make for a spot outside the nearest gate (before 8 minutes, the top gate)
    let gate = this.gates[0], bd = Infinity;
    for (const g of this.gates) { const G = gateAt(g), d = dist(sp.x, sp.y, G.ox, G.oy); if (d < bd) { bd = d; gate = g; } }
    const G = gateAt(gate);
    const waiting = this.bears.filter(b => (b.state === 'walk' || b.state === 'wait') && b.gate === gate).length;
    const ring = 70 + Math.min(4, Math.floor(waiting / 5)) * 42;
    const a = Math.atan2(G.ny, G.nx) + (Math.random() - .5) * (Math.PI - .5);
    let tx = clamp(G.ox + Math.cos(a) * ring * (G.nx ? 1 : 1.4), 40, W - 40), ty = clamp(G.oy + Math.sin(a) * ring * (G.ny ? 1 : 1.4), 40, H - 40);
    // keep the spot clear of the fence
    for (let i = 0; i < 40 && nearFence(tx, ty, BEAR_R + 12); i++) { tx += G.nx * 10; ty += G.ny * 10; }
    if (NO_BASE) { const ga = Math.random() * Math.PI * 2, gr = SPAWNER_R + 40 + Math.random() * 70; tx = clamp(sp.x + Math.cos(ga) * gr, 40, W - 40); ty = clamp(sp.y + Math.sin(ga) * gr, 40, H - 40); }
    const x = sp.x + (Math.random() - .5) * 20, y = sp.y + (Math.random() - .5) * 20;
    this.bears.push({ fish: Math.random() < SURVIVAL.fishChance || undefined, tc: 0, id: this.nextId++, x, y, hp: SURVIVAL.bearHp * (1 + Math.min(2, this.smog() * .15)), state: NO_BASE && wave ? 'chase' : 'walk', wait: 0, tx, ty, cd: 0, face: Math.atan2(ty - y, tx - x), swipe: 0, hurt: 0, dead: 0, step: Math.random() * 6, gate, wave });
  }

  /** Moves a bear toward a point; returns true once it is there. */
  private stepTo(b: Bear, tx: number, ty: number, speed: number, dt: number, stopAt = 2) {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d <= stopAt) return true;
    const s = Math.min(d - stopAt + .01, speed * dt);
    b.x += dx / d * s; b.y += dy / d * s;
    b.face = approachAngle(b.face, Math.atan2(dy, dx), dt * 4);
    b.step += dt * 6;
    return false;
  }
  /** Like stepTo, but finds a way: round the fence outside, and through the nearest gate to get in or out. */
  private navTo(b: Bear, tx: number, ty: number, speed: number, dt: number, stopAt = 2) {
    const inB = insideBase(b.x, b.y), inT = insideBase(tx, ty);
    let wx = tx, wy = ty, final = true;
    if (inB !== inT) {
      let G = gateAt(this.gates[0]), bd = Infinity;
      for (const g of this.gates) { const P = gateAt(g), d = dist(b.x, b.y, P.x, P.y) + dist(P.x, P.y, tx, ty); if (d < bd) { bd = d; G = P; } }
      const rx = b.x - G.x, ry = b.y - G.y, along = Math.abs(rx * G.ny - ry * G.nx), perp = Math.abs(rx * G.nx + ry * G.ny);
      final = false;
      // in the gateway: straight through; otherwise to the near side of the gate first
      if (along < GATE.w / 2 - BEAR_R + 3 && perp < BEAR_R + 22) { wx = inB ? G.ox : G.ix; wy = inB ? G.oy : G.iy; }
      else if (inB) { wx = G.ix; wy = G.iy; }
      else [wx, wy] = around(b.x, b.y, G.ox, G.oy);
    } else if (!inB) {
      [wx, wy] = around(b.x, b.y, tx, ty);
      final = wx === tx && wy === ty;
    }
    return this.stepTo(b, wx, wy, speed, dt, final ? stopAt : .5) && final;
  }

  /** Bears don't stand on each other, and only cross the fence at a gate. */
  private separate(dt: number) {
    const live = this.bears.filter(b => b.state !== 'dead');
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, min = BEAR_R * 2;
      if (d < min) {
        const push = Math.min(min - d, 40 * dt) / 2;
        // a bear going through the gate holds its line
        const wa = a.state === 'enter' ? 0 : 1, wb = b.state === 'enter' ? 0 : 1;
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * wb; b.y += dy / d * push * wb;
      }
    }
    const mw = this.myWalls();
    for (const b of live) {
      // your walls and gates stop bears; a bear pushing on one bites it
      b.wb = Math.max(0, (b.wb ?? 0) - dt);
      for (const w of mw) {
        if (b.x < w[0] - BEAR_R || b.x > w[2] + BEAR_R || b.y < w[1] - BEAR_R || b.y > w[3] + BEAR_R) continue;
        const ox = b.x, oy = b.y; collide(b, BEAR_R, [w as unknown as Rect]);
        if ((ox !== b.x || oy !== b.y) && b.wb <= 0) this.biteWall(b, w[5]);
      }
    }
    for (const b of live) { collide(b, BEAR_R, this.walls); b.x = clamp(b.x, BEAR_R, W - BEAR_R); b.y = clamp(b.y, BEAR_R, H - BEAR_R); }
  }

  /** The key of your wall or gate at this point, if there is one. */
  private wallAt(x: number, y: number) {
    if (!this.pwalls.size) return null;
    const k = Math.floor((x - GX0) / TILE) + ',' + Math.floor((y - GY0) / TILE);
    return this.pwalls.has(k) ? k : null;
  }
  /** Where a straight line from (x0, y0) to (x1, y1) first runs into your wall (not counting the tile it starts on), or null. */
  private wallLine(x0: number, y0: number, x1: number, y1: number) {
    if (!this.pwalls.size) return null;
    const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 6), from = this.wallAt(x0, y0);
    for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, k = this.wallAt(x, y); if (k && k !== from) return { x, y }; }
    return null;
  }
  /** Your walls and gates as rectangles: [x0, y0, x1, y1, isGate, key]. */
  private wallRects: [number, number, number, number, boolean, string][] | null = null;
  private myWalls() {
    if (!this.wallRects) this.wallRects = [...this.pwalls].map(([k, w]) => { const [c, r] = k.split(',').map(Number), x = tileX(c), y = tileY(r); return [x - TILE / 2, y - TILE / 2, x + TILE / 2, y + TILE / 2, w.gate, k]; });
    return this.wallRects;
  }
  /** A bear bites the wall or gate in its way; it breaks at no health. */
  private biteWall(b: Bear, key: string) {
    const w = this.pwalls.get(key); if (!w) return;
    b.wb = SURVIVAL.wallBiteEvery; b.swipe = .35;
    w.hp -= SURVIVAL.wallBite;
    const [c, r] = key.split(',').map(Number);
    if (w.hp <= 0) { this.pwalls.delete(key); this.wallRects = null; this.bubble(tileX(c), tileY(r) - 16, `${w.gate ? 'Gate' : 'Wall'} broken!`, 'loss'); Sound.boom(false); }
    else Sound.thump();
  }
  /** An acid fish spits a blob of slime at where you are now. */
  private spit(b: Bear) {
    b.tc = SURVIVAL.fishSpitEvery; b.swipe = .3; b.face = Math.atan2(this.y - b.y, this.x - b.x);
    this.slimes.push({ x: b.x + Math.cos(b.face) * 20, y: b.y + Math.sin(b.face) * 20, tx: this.x, ty: this.y, t: 0 });
    Sound.spit();
  }
  /** Damage in health points (not a share of your health), shown as a number. */
  private hurtAbs(dmg: number, quiet = false) {
    dmg *= ST.armor; this.hp -= dmg;
    if (quiet) { this.acidShown += dmg; return; }
    this.hurtFlash = .4;
    this.bubble(this.x + (Math.random() - .5) * 16, this.y - 24, '-' + fmt(dmg), 'loss');
    Sound.noise(.25, 'lowpass', 700, .8, .4);
  }
  /** Slime flies to where it was aimed; a hit burns you, and wherever it lands it leaves a puddle. Puddles burn you while you stand in them. */
  private runAcid(dt: number) {
    for (const sl of this.slimes) {
      const dx = sl.tx - sl.x, dy = sl.ty - sl.y, d = Math.hypot(dx, dy), step = 300 * dt;
      sl.t += dt;
      const hitMe = dist(sl.x, sl.y, this.x, this.y) < GUY_R + 6;
      if (d > step && !hitMe) { sl.x += dx / d * step; sl.y += dy / d * step; if (this.wallAt(sl.x, sl.y)) { sl.t = -1; Sound.sizzle(); } continue; }
      if (!hitMe) { sl.x = sl.tx; sl.y = sl.ty; }
      sl.t = -1;
      this.puddles.push({ x: sl.x, y: sl.y, t: SURVIVAL.puddleTime });
      if (hitMe || dist(sl.x, sl.y, this.x, this.y) < GUY_R + 8) {
        this.hurtAbs(SURVIVAL.acidHit);
        this.acidRate = Math.max(this.acidRate, SURVIVAL.acidBurn); this.acidT = SURVIVAL.acidBurnTime;
        this.say('Acid! You are burning', 1.5);
      }
      Sound.sizzle();
    }
    this.slimes = this.slimes.filter(s => s.t >= 0);
    let inside = 0;
    for (const pd of this.puddles) { pd.t -= dt; if (pd.t > 0 && dist(pd.x, pd.y, this.x, this.y) < SURVIVAL.puddleR + GUY_R * .5) inside++; }
    this.puddles = this.puddles.filter(p => p.t > 0);
    if (inside) {
      // each puddle you stand in burns you, and gives you the acid burn at half strength
      this.hurtAbs(SURVIVAL.puddleBurn * inside * dt, true);
      if (this.acidRate <= SURVIVAL.acidBurn / 2 || this.acidT <= 0) { this.acidRate = Math.max(this.acidRate, SURVIVAL.acidBurn / 2); }
      this.acidT = Math.max(this.acidT, SURVIVAL.acidBurnTime);
    }
    if (this.acidT > 0) { this.acidT -= dt; this.hurtAbs(this.acidRate * dt, true); if (this.acidT <= 0) this.acidRate = 0; }
    // the burn shows as one number every half second
    this.acidShowT -= dt;
    if (this.acidShown > 0 && this.acidShowT <= 0) { this.bubble(this.x + (Math.random() - .5) * 16, this.y - 24, '-' + fmt(this.acidShown), 'loss'); this.acidShown = 0; this.acidShowT = .5; this.hurtFlash = .25; }
  }


  private bearHit(b: Bear) {
    b.cd = SURVIVAL.bearCooldown; b.swipe = .35;
    this.hurt(SURVIVAL.bearHit);
  }

  private hurt(share: number) {
    const dmg = SURVIVAL.maxHp * share * ST.armor;
    this.hp -= dmg;
    this.hurtFlash = .4;
    this.bubble(this.x + (Math.random() - .5) * 16, this.y - 24, '-' + fmt(dmg), 'loss');
    Sound.noise(.25, 'lowpass', 700, .8, .4); Sound.tone('sine', 120, 50, .25, .3);
    if (navigator.vibrate) try { navigator.vibrate(60); } catch { }
  }

  private boltHit(b: Bear, dmg: number) {
    b.hp -= dmg; b.hurt = .25;
    this.hits++; this.damage += Math.min(dmg, b.hp + dmg);
    // a rapid crossbow's tiny hits don't each get a number
    if (dmg >= 1) { this.bubble(b.x, b.y - 26, '-' + trim(dmg), 'dmg'); Sound.hitPlane(); }
    if (b.hp <= 1e-6) {
      b.state = 'dead'; b.dead = 0; this.kills++;
      if (this.kills === SURVIVAL.rushKills) {
        // the bears get impatient, and a mine and a machine pop up in the camp
        if (this.gateStage < 2) this.gateWait = SURVIVAL.gateWaitLater;
        this.say('Bears in base in 20 seconds', 4);
        this.mineOn = true;
        Sound.alarm();
      }
      Sound.tone('sine', 200, 70, .4, .18);
    }
  }

  private bubble(x: number, y: number, text: string, kind: Bubble['kind']) { this.bubbles.push({ x, y, text, t: 0, kind }); }
  private sayT = 0; private sayText = '';
  private say(text: string, secs = 3) { this.sayText = text; this.sayT = secs; }

  /* ---------- drawing ---------- */
  draw(dt: number) {
    const c = this.canvas, cw = c.clientWidth, ch = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    this.cw = cw;
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the camera follows the guy round the big map; the view sits between the health bar (top) and the buttons (bottom)
    const top = this.mineOn ? 100 : 64, bottom = 96, avail = ch - top - bottom;
    this.scale = Math.min(cw / VIEW_W, avail / VIEW_H);
    const k = Math.min(1, dt * 6);
    this.camX += (this.x - this.camX) * k; this.camY += (this.y - this.camY) * k;
    const hw = cw / 2 / this.scale, hh = avail / 2 / this.scale;
    this.camX = clamp(this.camX, Math.min(hw, W / 2), Math.max(W - hw, W / 2)); this.camY = clamp(this.camY, Math.min(hh, H / 2), Math.max(H - hh, H / 2));
    this.ox = cw / 2 - this.camX * this.scale; this.oy = top + avail / 2 - this.camY * this.scale;
    this.view = { x0: this.camX - hw - 40, x1: this.camX + hw + 40, y0: this.camY - hh - top / this.scale - 40, y1: this.camY + hh + bottom / this.scale + 40 };
    g.fillStyle = '#2f4426'; g.fillRect(0, 0, cw, ch);
    g.save();
    g.translate(this.ox, this.oy); g.scale(this.scale, this.scale);
    this.drawWorld(g);
    g.restore();
    this.drawHud(g, dt);
    this.drawMap(g, cw, top);
  }

  private view = { x0: 0, x1: W, y0: 0, y1: H };
  private seen(x: number, y: number, r = 40) { const v = this.view; return x > v.x0 - r && x < v.x1 + r && y > v.y0 - r && y < v.y1 + r; }
  private drawWorld(g: CanvasRenderingContext2D) {
    // ground
    g.fillStyle = '#4b6b37'; g.fillRect(0, 0, W, H);
    // the edge of the map
    g.strokeStyle = 'rgba(20,30,15,.6)'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    g.fillStyle = 'rgba(30,50,20,.25)';
    if (this.decorOff?.of !== this.patches) this.decorOff = { of: this.patches, set: new Set(this.decor.flatMap((d, i) => d.k !== 2 && this.patches.some(p => inPatch(p, d.x, d.y, d.r * .6)) ? [i] : [])) };
    const off = this.decorOff.set;
    for (const [i, d] of this.decor.entries()) if (d.k === 0 && !off.has(i) && this.seen(d.x, d.y)) { g.beginPath(); g.arc(d.x + 6, d.y + 8, d.r * 1.1, 0, 7); g.fill(); }
    if (!NO_BASE) {
    // worn paths out from each gate
    g.fillStyle = '#6f6a45';
    for (const gt of this.gates) {
      const G = gateAt(gt), tx = -G.ny, ty = G.nx;
      g.beginPath(); g.moveTo(G.x + tx * 30, G.y + ty * 30); g.lineTo(G.x + tx * 44 + G.nx * 170, G.y + ty * 44 + G.ny * 170); g.lineTo(G.x - tx * 44 + G.nx * 170, G.y - ty * 44 + G.ny * 170); g.lineTo(G.x - tx * 30, G.y - ty * 30); g.fill();
    }
    // inside the base: packed earth, with the wall's shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(WALL.x0 + 4, WALL.y0 + 6, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.fillStyle = '#8b7651'; g.fillRect(WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.fillStyle = 'rgba(60,45,25,.18)';
    for (const d of this.decor) if (d.k === 2) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill(); }
    // a campfire and a tent so it reads as a camp
    this.drawCamp(g);
    }
    // scenery outside
    for (const [i, d] of this.decor.entries()) {
      if (off.has(i) || !this.seen(d.x, d.y)) continue;
      if (d.k !== 2 && d.x > WALL.x0 - 8 && d.x < WALL.x1 + 8 && d.y > WALL.y0 - 8 && d.y < WALL.y1 + 8) continue; // cleared when the base grew
      if (d.k === 0) { // tree
        g.fillStyle = '#2d4a22'; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill();
        g.fillStyle = '#3c5f2c'; g.beginPath(); g.arc(d.x - d.r * .25, d.y - d.r * .25, d.r * .65, 0, 7); g.fill();
      } else if (d.k === 1) { // bush
        g.fillStyle = '#3f6230'; g.beginPath(); g.arc(d.x, d.y, d.r * .55, 0, 7); g.fill();
      }
    }
    for (const p of this.patches) if (p.left > 0 && this.seen(p.x, p.y, p.r * 1.15)) paintPatch(g, p, this.t);
    for (const sp of this.spawners) if (this.seen(sp.x, sp.y, 60)) this.drawSpawner(g, sp);
    this.drawBelts(g);
    if (this.mineOn) { this.drawMineAndMachine(g); }
    // power lines between poles
    g.strokeStyle = 'rgba(40,30,20,.75)'; g.lineWidth = 1.2;
    for (const [a, b] of this.poleLinks) { const [ac, ar] = a.split(',').map(Number), [bc, br] = b.split(',').map(Number); g.beginPath(); g.moveTo(tileX(ac), tileY(ar) - 9); g.quadraticCurveTo((tileX(ac) + tileX(bc)) / 2, (tileY(ar) + tileY(br)) / 2 - 3, tileX(bc), tileY(br) - 9); g.stroke(); }
    for (const it of this.items) paintItem(g, it.x, it.y, it.k);
    if (this.placing) {
      const t = this.ghost();
      if (t) {
        const big = isBig(this.placeType), x = tileX(t.c), y = tileY(t.r);
        const taken = !big && this.taken(t.c, t.r);
        const bad = big ? !this.bigFits(t.c, t.r, this.placeType === 'machine' ? MACHINE_R : MINE_R) : taken ? false : blockedTile(t.c, t.r) || (this.placeType === 'drill' && this.patchAt(t.c, t.r) < 0);
        g.globalAlpha = .6;
        if (big) {
          const rr = this.placeType === 'machine' ? MACHINE_R : MINE_R;
          g.fillStyle = bad ? 'rgba(255,90,80,.35)' : 'rgba(255,245,234,.25)'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
          g.fillStyle = '#fff5ea'; g.font = '600 11px Jost, sans-serif'; g.textAlign = 'center'; g.fillText(ONE_NAME[this.placeType], x, y + 4);
        } else if (!taken) paintPlaceable(g, x, y, this.placeType, this.placeDir, this.t);
        g.globalAlpha = 1;
        // where power reaches: round a pole (or a pole's reach to other poles)
        if (this.placeType === 'pole' || this.placeType === 'gen') {
          const sup = (SURVIVAL.poleSupply + .5) * TILE;
          g.strokeStyle = 'rgba(255,220,120,.7)'; g.setLineDash([5, 6]); g.lineWidth = 1.5;
          if (this.placeType === 'pole') g.strokeRect(x - sup, y - sup, sup * 2, sup * 2);
          g.beginPath(); g.arc(x, y, SURVIVAL.poleReach * TILE, 0, 7); g.stroke(); g.setLineDash([]);
        }
        g.strokeStyle = bad ? '#ff6a5a' : '#fff5ea'; g.lineWidth = 2; g.strokeRect(GX0 + t.c * TILE + 1, GY0 + t.r * TILE + 1, TILE - 2, TILE - 2);
      }
    }
    if (!NO_BASE) this.drawWalls(g);
    // dead bears fade, then the rest on top
    // acid puddles under everything that walks
    for (const pd of this.puddles) {
      const f = Math.min(1, pd.t / 1.5), r = SURVIVAL.puddleR;
      g.save(); g.translate(pd.x, pd.y); g.globalAlpha = .55 * f;
      g.fillStyle = '#4fd14a'; g.beginPath();
      g.ellipse(0, 0, r * .85, r * .62, 0, 0, 7); g.moveTo(r * .95, r * .1); g.ellipse(r * .45, r * .12, r * .5, r * .38, .4, 0, 7);
      g.moveTo(-r * .2, -r * .2); g.ellipse(-r * .5, -r * .18, r * .45, r * .35, -.3, 0, 7); g.fill();
      g.fillStyle = '#b8ff7a'; g.globalAlpha = .5 * f;
      const bub = (this.t * 2 + pd.x) % 1;
      g.beginPath(); g.arc(-6, -3, 2.5 + bub * 2, 0, 7); g.arc(7, 4, 2 + (1 - bub) * 2, 0, 7); g.fill();
      g.restore();
    }
    for (const b of this.bears) if (b.state === 'dead') this.drawBear(g, b);
    for (const b of this.bears) if (b.state !== 'dead') this.drawBear(g, b);
    this.drawGuy(g);
    // acid slime in flight
    for (const sl of this.slimes) {
      g.fillStyle = '#2f8a2a'; g.beginPath(); g.arc(sl.x, sl.y, 7, 0, 7); g.fill();
      g.fillStyle = '#7dea52'; g.beginPath(); g.arc(sl.x - 1.5, sl.y - 1.5, 5, 0, 7); g.fill();
      g.fillStyle = 'rgba(220,255,180,.8)'; g.beginPath(); g.arc(sl.x - 3, sl.y - 3, 1.6, 0, 7); g.fill();
    }
    for (const rb of this.robots) paintRobot(g, rb.x, rb.y, Math.sin(this.t * 6 + rb.x) * 1.5, rb.k);
    for (const bo of this.bolts) {
      const a = Math.atan2(bo.vy, bo.vx);
      g.save(); g.translate(bo.x, bo.y); g.rotate(a);
      g.strokeStyle = '#5a3d22'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = bo.color ?? (bo.stone ? STONE : AMMO[this.load.ammo].color); g.beginPath(); g.moveTo(10, 0); g.lineTo(4, -3.5); g.lineTo(4, 3.5); g.fill();
      g.fillStyle = '#f0e6d0'; g.fillRect(-15, -3, 4, 6);
      g.restore();
    }
    // rocks thrown by bears
    for (const r of this.rocks) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(r.x + 3, r.y + 4, 6, 0, 7); g.fill();
      g.save(); g.translate(r.x, r.y); g.rotate(r.spin);
      g.fillStyle = '#8d8a84'; g.beginPath(); g.moveTo(-6, -3); g.lineTo(-1, -7); g.lineTo(6, -4); g.lineTo(7, 3); g.lineTo(1, 7); g.lineTo(-6, 4); g.closePath(); g.fill();
      g.fillStyle = '#b5b1a8'; g.beginPath(); g.arc(-1, -2, 2.5, 0, 7); g.fill();
      g.restore();
    }
    // the rapid crossbow: a flickering yellow line to what it's shooting
    if (this.firingAt) {
      const tg = this.firingEnd ?? this.firingAt, j = () => (Math.random() - .5) * 10;
      if (this.firingEnd) this.sparks.push({ x: tg.x, y: tg.y, t: .15 });
      g.strokeStyle = 'rgba(255,225,74,.9)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(this.x + Math.cos(this.face) * 24, this.y + Math.sin(this.face) * 24); g.lineTo(tg.x + j(), tg.y + j()); g.stroke();
      g.strokeStyle = 'rgba(255,255,200,.5)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(this.x + Math.cos(this.face) * 24, this.y + Math.sin(this.face) * 24); g.lineTo(tg.x + j(), tg.y + j()); g.stroke();
    }
    // a bolt or rock stopped by a wall: a quick spark
    for (const sp of this.sparks) {
      const k = 1 - sp.t / .25; g.strokeStyle = `rgba(255,236,170,${k})`; g.lineWidth = 1.5;
      g.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 1.257 + sp.x, r0 = 2, r1 = 4 + (1 - k) * 6; g.moveTo(sp.x + Math.cos(a) * r0, sp.y + Math.sin(a) * r0); g.lineTo(sp.x + Math.cos(a) * r1, sp.y + Math.sin(a) * r1); } g.stroke();
    }
    // rockets: a smoke trail, then the rocket
    for (const rk of this.rockets) {
      for (let i = 0; i < rk.trail.length; i++) { const p = rk.trail[i], k = i / rk.trail.length; g.fillStyle = `rgba(220,220,220,${k * .45})`; g.beginPath(); g.arc(p.x, p.y, 2 + k * 3, 0, 7); g.fill(); }
      paintRocket(g, rk.x, rk.y, rk.a, 1);
    }
    for (const bl of this.blasts) {
      const k = bl.t / .5;
      g.fillStyle = `rgba(255,170,60,${1 - k})`; g.beginPath(); g.arc(bl.x, bl.y, 10 + k * 34, 0, 7); g.fill();
      g.fillStyle = `rgba(255,240,180,${1 - k})`; g.beginPath(); g.arc(bl.x, bl.y, 6 + k * 14, 0, 7); g.fill();
    }
    // the turret you picked: its range, and a line to its target; other turrets' targets get a faint line
    for (const [key, tu] of this.turrets) {
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r), on = key === this.picked;
      if (on) {
        const range = tu.kind === 'rocket' ? SURVIVAL.rocketRange : ST.turretRange * (tu.kind === 'brick' ? 1.2 : 1);
        g.strokeStyle = 'rgba(255,207,140,.9)'; g.lineWidth = 2.5; g.strokeRect(x - 14, y - 14, 28, 28);
        g.strokeStyle = 'rgba(255,207,140,.35)'; g.lineWidth = 2; g.setLineDash([8, 8]); g.beginPath(); g.arc(x, y, range, 0, 7); g.stroke(); g.setLineDash([]);
      }
      if (tu.target && alive(tu.target)) {
        g.strokeStyle = on ? 'rgba(255,90,80,.8)' : 'rgba(255,90,80,.35)'; g.lineWidth = 1.5; g.setLineDash([4, 6]);
        g.beginPath(); g.moveTo(x, y); g.lineTo(tu.target.x, tu.target.y); g.stroke(); g.setLineDash([]);
        const rr = (isBear(tu.target) ? BEAR_R : SPAWNER_R) + 9;
        g.strokeStyle = '#ff6a5a'; g.lineWidth = 2; g.beginPath(); g.arc(tu.target.x, tu.target.y, rr, 0, 7); g.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(tu.target.x + Math.cos(a) * (rr - 4), tu.target.y + Math.sin(a) * (rr - 4)); g.lineTo(tu.target.x + Math.cos(a) * (rr + 5), tu.target.y + Math.sin(a) * (rr + 5)); g.stroke(); }
      }
    }
    // targeting range when a bear is close: a faint ring
    g.strokeStyle = 'rgba(255,245,234,.10)'; g.lineWidth = 1.5; g.setLineDash([6, 8]);
    g.beginPath(); g.arc(this.x, this.y, SURVIVAL.targetRange, 0, 7); g.stroke(); g.setLineDash([]);
  }

  /** A bear spawner: a dark den in a rocky mound, with a health bar once hit. */
  private drawSpawner(g: CanvasRenderingContext2D, sp: Spawner) {
    g.save(); g.translate(sp.x, sp.y);
    if (sp.pre) { g.restore(); return; }
    if (sp.dead) {
      g.fillStyle = 'rgba(40,30,20,.5)'; g.beginPath(); g.ellipse(0, 4, 30, 20, 0, 0, 7); g.fill();
      g.fillStyle = '#5a5650'; for (const [x, y] of [[-14, 2], [8, -6], [12, 10], [-4, 12]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
      g.restore(); return;
    }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(5, 8, 34, 24, 0, 0, 7); g.fill();
    g.fillStyle = sp.hurt > 0 ? '#a07c60' : '#6a5a48'; g.beginPath(); g.ellipse(0, 0, 32, 25, 0, 0, 7); g.fill();
    g.fillStyle = '#7d6c58'; g.beginPath(); g.ellipse(-6, -6, 20, 13, 0, 0, 7); g.fill();
    // the den's mouth, glowing a little as a bear is about to come out
    const glow = Math.max(0, 1 - sp.t / 1.5);
    g.fillStyle = '#1a120c'; g.beginPath(); g.ellipse(2, 6, 16, 11, 0, Math.PI, 0); g.lineTo(18, 10); g.lineTo(-14, 10); g.fill();
    if (glow > 0) { g.fillStyle = `rgba(255,120,60,${glow * .6})`; g.beginPath(); g.arc(-3, 4, 2.2, 0, 7); g.arc(7, 4, 2.2, 0, 7); g.fill(); }
    // paw print sign
    g.fillStyle = '#c9a77a'; g.beginPath(); g.arc(0, -12, 4, 0, 7); g.fill();
    for (const [x, y] of [[-5, -18], [-1.5, -20], [2, -20], [5.5, -18]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    g.restore();
    const w = 48, k = sp.hp / SURVIVAL.spawnerHp, y = sp.y + 32;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(sp.x - w / 2 - 1, y - 1, w + 2, 7);
    g.fillStyle = '#ff6a5a'; g.fillRect(sp.x - w / 2, y, w * k, 5);
    g.fillStyle = '#fff5ea'; g.font = '600 11px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText(`Bear spawner ${Math.ceil(sp.hp)}`, sp.x, y + 18);
  }

  /** A small map in the top-right corner: ore patches, the fence, spawners, bears and you. */
  private drawMap(g: CanvasRenderingContext2D, cw: number, top: number) {
    const size = 104, k = size / W, x0 = cw - size - 12, y0 = top + 6;
    g.fillStyle = 'rgba(10,8,24,.6)'; roundRect(g, x0 - 3, y0 - 3, size + 6, size + 6, 6); g.fill();
    g.fillStyle = 'rgba(75,107,55,.85)'; g.fillRect(x0, y0, size, size);
    // ore patches in their ore's colour, smaller as they run out
    for (const p of this.patches) {
      if (p.left <= 0) continue;
      const L = PATCH_LOOK[p.ore], r = Math.max(2.2, p.r * k * (.55 + .45 * p.left / p.max)), px = x0 + p.x * k, py = y0 + p.y * k;
      g.fillStyle = L.dark; g.beginPath(); g.arc(px, py, r + .8, 0, 7); g.fill();
      g.fillStyle = L.ore; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
    }
    if (!NO_BASE) g.strokeStyle = '#c9a77a', g.lineWidth = 1.5, g.strokeRect(x0 + WALL.x0 * k, y0 + WALL.y0 * k, (WALL.x1 - WALL.x0) * k, (WALL.y1 - WALL.y0) * k);
    for (const sp of this.spawners) { if (sp.pre) continue; g.fillStyle = sp.dead ? '#5a5650' : '#ff6a5a'; g.fillRect(x0 + sp.x * k - 3, y0 + sp.y * k - 3, 6, 6); }
    g.fillStyle = '#e8c49a';
    for (const b of this.bears) if (b.state !== 'dead') g.fillRect(x0 + b.x * k - 1, y0 + b.y * k - 1, 2, 2);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + this.x * k, y0 + this.y * k, 2.5, 0, 7); g.fill();
    // what the screen shows
    const v = this.view;
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(x0 + Math.max(0, v.x0 + 40) * k, y0 + Math.max(0, v.y0 + 40) * k, (Math.min(W, v.x1 - 40) - Math.max(0, v.x0 + 40)) * k, (Math.min(H, v.y1 - 40) - Math.max(0, v.y0 + 40)) * k);
  }

  private drawBelts(g: CanvasRenderingContext2D) {
    if (this.placing) {
      // a faint grid while placing
      g.strokeStyle = 'rgba(255,245,234,.12)'; g.lineWidth = 1;
      const v = this.view, c0 = Math.max(0, Math.floor((v.x0 - GX0) / TILE)), c1 = Math.min(COLS, Math.ceil((v.x1 - GX0) / TILE)), r0 = Math.max(0, Math.floor((v.y0 - GY0) / TILE)), r1 = Math.min(ROWS, Math.ceil((v.y1 - GY0) / TILE));
      for (let c = c0; c <= c1; c++) { g.beginPath(); g.moveTo(GX0 + c * TILE, GY0 + r0 * TILE); g.lineTo(GX0 + c * TILE, GY0 + r1 * TILE); g.stroke(); }
      for (let r = r0; r <= r1; r++) { g.beginPath(); g.moveTo(GX0 + c0 * TILE, GY0 + r * TILE); g.lineTo(GX0 + c1 * TILE, GY0 + r * TILE); g.stroke(); }
    }
    for (const [key, d] of this.belts) { const [c, r] = key.split(',').map(Number); paintBelt(g, tileX(c), tileY(r), d, this.t); }
    for (const [key, w] of this.pwalls) {
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r), max = w.gate ? SURVIVAL.gateHp : SURVIVAL.wallHp;
      paintWall(g, x, y, w.gate, (k: string) => this.pwalls.get(k)?.gate === false, c, r, Math.hypot(this.x - x, this.y - y) < 30);
      if (w.hp < max) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - 10, y + 8, 20, 3); g.fillStyle = w.hp / max > .4 ? '#7fd36a' : '#ff6a5a'; g.fillRect(x - 10, y + 8, 20 * w.hp / max, 3); }
    }
    for (const [key, gr] of this.grabbers) { const [c, r] = key.split(',').map(Number); paintGrabber(g, tileX(c), tileY(r), gr); }
    for (const [key, sp] of this.splitters) { const [c, r] = key.split(',').map(Number); paintSplitter(g, tileX(c), tileY(r), sp.d); }
    for (const [key, ch] of this.chests) {
      const [c, r] = key.split(',').map(Number), n = chestN(ch); paintChest(g, tileX(c), tileY(r));
      g.fillStyle = n >= SURVIVAL.chestSize ? '#ff8a7a' : '#fff5ea'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(`${n}/${SURVIVAL.chestSize}`, tileX(c), tileY(r) + 21);
    }
    for (const [key, b] of this.blds) {
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r);
      if (b.type === 'gen' && b.fuel > 0) { g.fillStyle = 'rgba(255,220,120,.06)'; g.beginPath(); g.arc(x, y, SURVIVAL.powerRange, 0, 7); g.fill(); }
      paintBld(g, x, y, b, this.t);
      const rc = REC[b.recipe];
      const lbl = b.type === 'furnace' ? (b.inp || b.out ? `${b.inp}→${b.out}` : '') : b.type === 'gen' ? (b.fuel > 0 || b.inp ? `${Math.ceil(b.fuel + b.inp * SURVIVAL.genBurn)}s` : 'no fuel') : b.type === 'asm' ? (rc ? ONE_NAME[rc.out!] : 'tap me') : b.type === 'hub' ? `${b.robots} robots` : b.type === 'drill' ? (b.pi === undefined || (this.patches[b.pi]?.left ?? 0) <= 0 ? 'ran out' : '') : '';
      if (lbl) { g.fillStyle = (b.type === 'gen' && b.fuel <= 0 && !b.inp) || lbl === 'ran out' ? '#ff8a7a' : '#fff5ea'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center'; g.fillText(lbl, x, y + 21); }
      if (ELECTRIC.includes(b.type) && !this.hasPower(key)) paintNoPower(g, x + 8, y - 9, this.t);
    }
    for (const [key, lb] of this.labs) {
      const [c, r] = key.split(',').map(Number), busy = !!this.researching && lb.packs > 0 && this.hasPower(key); paintLab(g, tileX(c), tileY(r), busy ? this.t : 0);
      if (!this.hasPower(key)) paintNoPower(g, tileX(c) + 8, tileY(r) - 9, this.t);
      g.fillStyle = lb.packs ? '#fff5ea' : '#ff8a7a'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(lb.packs || lb.packs2 ? `${lb.packs}${lb.packs2 ? ` + ${lb.packs2}` : ''} packs` : 'empty', tileX(c), tileY(r) + 21);
    }
    for (const [key, tu] of this.turrets) {
      const [c, r] = key.split(',').map(Number), n = tAmmo(tu); paintTurret(g, tileX(c), tileY(r), tu);
      g.fillStyle = n > 1e-6 ? '#fff5ea' : '#ff8a7a'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(n > 1e-6 ? (tu.kind === 'rapid' && n < 10 ? n.toFixed(2) : String(Math.floor(n))) + (tu.kind === 'rocket' ? ' 🚀' : '') : 'empty', tileX(c), tileY(r) + 21);
    }
  }


  private drawMineAndMachine(g: CanvasRenderingContext2D) {
    for (const mine of this.mines) this.drawMine(g, mine);
    for (const mc of this.machines) this.drawMachine(g, mc);
    // hired miners stand round the mines, swinging picks
    if (this.mines.length) this.miners.forEach((mt, i) => paintMiner(g, this.minerSpot(i), mt));
    g.fillStyle = '#fff5ea'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    this.mines.forEach((mine, j) => {
      const n = this.miners.filter((_, i) => i % this.mines.length === j).length;
      const nm = mine.ore === 'stone' ? 'Mine' : `${METAL[mine.ore].name} mine`;
      g.fillText(n ? `${nm} (${n} miner${n > 1 ? 's' : ''})` : nm, mine.x + (n ? 40 : 0), mine.y + (n ? 52 : 34));
    });
    // mining progress ring
    if (this.mining && this.mineAt) {
      g.strokeStyle = '#c7c2b8'; g.lineWidth = 3;
      g.beginPath(); g.arc(this.mineAt.x, this.mineAt.y, this.mineAt.r + 8, -Math.PI / 2, -Math.PI / 2 + this.mineT / ST.mineEvery * Math.PI * 2); g.stroke();
    }
  }

  private drawMine(g: CanvasRenderingContext2D, mine: Mine) {
    const pop = mine.ore === 'stone' ? Math.min(1, this.popT * 2) : 1;
    // a heap of grey rock
    g.save(); g.translate(mine.x, mine.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(4, 6, 28, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#6f6c66'; g.beginPath(); g.moveTo(-26, 10); g.lineTo(-18, -12); g.lineTo(-4, -22); g.lineTo(14, -16); g.lineTo(26, 2); g.lineTo(18, 16); g.lineTo(-12, 18); g.closePath(); g.fill();
    g.fillStyle = '#8f8b84'; g.beginPath(); g.moveTo(-14, -8); g.lineTo(-3, -17); g.lineTo(10, -12); g.lineTo(4, 0); g.lineTo(-10, 2); g.closePath(); g.fill();
    // a metal mine has veins of its metal in the rock
    g.fillStyle = mine.ore === 'stone' ? '#c7c2b8' : METAL[mine.ore].color; g.beginPath(); g.arc(12, 6, 3, 0, 7); g.arc(-8, 10, 2.5, 0, 7); g.fill();
    if (mine.ore !== 'stone') { g.beginPath(); g.arc(-12, -4, 3.5, 0, 7); g.arc(6, -10, 3, 0, 7); g.arc(18, -2, 2.5, 0, 7); g.arc(-2, 6, 2.8, 0, 7); g.fill(); }
    if (this.mining && this.mineAt === mine && this.swing > .7) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * 1.6 + this.t * 3; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); g.stroke(); } }
    g.restore();
  }

  /** A metal box with a hopper, a light while it works and a progress bar. */
  private drawMachine(g: CanvasRenderingContext2D, mc: Machine) {
    const pop = Math.min(1, this.popT * 2);
    g.save(); g.translate(mc.x, mc.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-22, -18, 50, 44);
    g.fillStyle = '#5b6670'; g.fillRect(-26, -22, 52, 44);
    g.fillStyle = '#7d8a95'; g.fillRect(-20, -16, 24, 18);
    g.fillStyle = '#3a4249'; g.beginPath(); g.moveTo(8, -18); g.lineTo(22, -18); g.lineTo(18, -6); g.lineTo(12, -6); g.closePath(); g.fill();
    const busy = !!this.machineJob(mc);
    g.fillStyle = busy ? (Math.sin(this.t * 10) > 0 ? '#ffcf4a' : '#a07a20') : '#3c4a3c'; g.beginPath(); g.arc(16, 10, 4, 0, 7); g.fill();
    if (busy) { g.fillStyle = '#222'; g.fillRect(-20, 8, 26, 6); g.fillStyle = '#9fe0b0'; g.fillRect(-20, 8, 26 * mc.batchT / SURVIVAL.batchTime, 6); }
    if (mc.recipe === 'rocket') paintRocket(g, -8, -7, -Math.PI / 4, .8); else if (mc.recipe) paintItem(g, -8, -7, MREC_OUT[mc.recipe]);
    g.restore();
    g.fillStyle = '#fff5ea'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    const st = mc.queue.filter(k => k === 'stone').length, n = mc.queue.length;
    const label = !mc.recipe ? 'Machine (tap: pick a recipe)' : !n ? `Machine: ${KIND_NAME[MREC_OUT[mc.recipe]]}` : mc.recipe === 'rocket' && st && st < SURVIVAL.rocketStone && st === n ? `Machine (${st}/${SURVIVAL.rocketStone} stone)` : `Machine (${n} left)`;
    g.fillText(label, mc.x, mc.y + 38);
    if (mc.out.length) { g.fillStyle = '#7fc8ff'; g.fillText(`${mc.out.length} ready`, mc.x, mc.y + 51); }
  }

  private drawCamp(g: CanvasRenderingContext2D) {
    // tent
    const tx = BASE_WALL.x0 + 70, ty = BASE_WALL.y1 - 90;
    g.fillStyle = '#b88a4a'; g.beginPath(); g.moveTo(tx - 38, ty + 30); g.lineTo(tx, ty - 30); g.lineTo(tx + 38, ty + 30); g.closePath(); g.fill();
    g.fillStyle = '#8f6633'; g.beginPath(); g.moveTo(tx, ty - 30); g.lineTo(tx + 38, ty + 30); g.lineTo(tx, ty + 30); g.closePath(); g.fill();
    // fire pit
    const fx = GATE.x + 70, fy = BASE_WALL.y1 - 130, f = .8 + Math.sin(this.t * 13) * .15;
    g.fillStyle = '#5d5148'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.arc(fx + Math.cos(a) * 15, fy + Math.sin(a) * 15, 4.5, 0, 7); g.fill(); }
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.arc(fx, fy, 9 * f, 0, 7); g.fill();
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(fx, fy, 4.5 * f, 0, 7); g.fill();
    // crates
    const W1 = BASE_WALL.x1, Y0 = BASE_WALL.y0;
    g.fillStyle = '#9a6a3a'; g.fillRect(W1 - 70, Y0 + 40, 34, 34); g.fillRect(W1 - 50, Y0 + 80, 30, 30);
    g.strokeStyle = '#6a4626'; g.lineWidth = 2; g.strokeRect(W1 - 70, Y0 + 40, 34, 34); g.strokeRect(W1 - 50, Y0 + 80, 30, 30);
  }

  private drawWalls(g: CanvasRenderingContext2D) {
    const t = WALL.t;
    const logs = (ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 13));
      for (let i = 0; i < n; i++) {
        const k = (i + .5) / n, x = ax + (bx - ax) * k, y = ay + (by - ay) * k;
        g.fillStyle = i % 2 ? '#6d4a2a' : '#7c5631'; g.beginPath(); g.arc(x, y, t * .55, 0, 7); g.fill();
        g.fillStyle = '#a07a4c'; g.beginPath(); g.arc(x - 1, y - 1, t * .28, 0, 7); g.fill();
      }
    };
    // each piece of fence between the gates is a row of logs along its long side
    for (const [ax, ay, bx, by] of this.walls) {
      if (bx - ax >= by - ay) logs(ax + t / 2, (ay + by) / 2, bx - t / 2, (ay + by) / 2);
      else logs((ax + bx) / 2, ay + t / 2, (ax + bx) / 2, by - t / 2);
    }
    // gate posts and the two doors, which swing in while a bear comes through
    for (const gt of this.gates) {
      const G = gateAt(gt), tx = -G.ny, ty = G.nx, open = easeInOut(gt.open) * 1.35;
      for (const dir of [1, -1]) {
        const px = G.x - tx * dir * GATE.w / 2, py = G.y - ty * dir * GATE.w / 2;
        g.save(); g.translate(px, py); g.rotate(Math.atan2(ty, tx) + dir * open);
        g.fillStyle = '#5e3f22'; g.fillRect(dir > 0 ? 0 : -GATE.w / 2, -4, GATE.w / 2, 8);
        g.fillStyle = '#3e2a16'; g.fillRect(dir > 0 ? GATE.w / 2 - 5 : -GATE.w / 2, -4, 5, 8);
        g.restore();
        g.fillStyle = '#4a3219'; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill();
      }
    }
  }

  private drawBear(g: CanvasRenderingContext2D, b: Bear) {
    g.save(); g.translate(b.x, b.y);
    if (b.state === 'dead') g.globalAlpha = Math.max(0, 1 - b.dead / 1.2);
    // shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(3, 5, BEAR_R * 1.1, BEAR_R * .9, 0, 0, 7); g.fill();
    g.rotate(b.face);
    if (b.fish) {
      // an acid fish: green body, dark green fins and tail, a big eye and a dripping mouth
      if (b.state === 'dead') g.rotate(.6);
      const lite = b.hurt > 0 ? '#c8f59a' : '#5cc94a', dk = '#1f6b28', wag = Math.sin(b.step * 1.4) * .35;
      g.fillStyle = dk;
      g.save(); g.translate(-15, 0); g.rotate(wag); g.beginPath(); g.moveTo(2, 0); g.lineTo(-13, -11); g.lineTo(-9, 0); g.lineTo(-13, 11); g.closePath(); g.fill(); g.restore();
      g.beginPath(); g.moveTo(-4, -9); g.quadraticCurveTo(2, -20, 9, -10); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-2, 9); g.quadraticCurveTo(3, 17, 8, 9); g.closePath(); g.fill();
      g.fillStyle = lite; g.beginPath(); g.ellipse(0, 0, 19, 11, 0, 0, 7); g.fill();
      g.fillStyle = dk; g.globalAlpha *= .55;
      for (const sx of [-8, -2, 4]) { g.beginPath(); g.arc(sx, 0, 5, -1.1, 1.1); g.lineWidth = 1.6; g.strokeStyle = dk; g.stroke(); }
      g.globalAlpha = b.state === 'dead' ? Math.max(0, 1 - b.dead / 1.2) : 1;
      g.fillStyle = '#9be86c'; g.beginPath(); g.ellipse(3, 4, 11, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(10, -4, 3.6, 0, 7); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(11, -4, 1.8, 0, 7); g.fill();
      g.strokeStyle = dk; g.lineWidth = 1.8; g.beginPath(); g.moveTo(19, 1); g.lineTo(14, 3); g.stroke();
      if (b.swipe > 0) { g.fillStyle = `rgba(125,234,82,${b.swipe / .35})`; g.beginPath(); g.arc(22, 2, 4, 0, 7); g.fill(); }
      g.restore();
      if (b.state === 'dead') return;
      if (b.hp < SURVIVAL.bearHp) {
        const w = 34, k = Math.max(0, b.hp / SURVIVAL.bearHp), y = b.y + BEAR_R + 8;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(b.x - w / 2 - 1, y - 1, w + 2, 6);
        g.fillStyle = '#ff6a5a'; g.fillRect(b.x - w / 2, y, w * k, 4);
      }
      return;
    }
    const fur = b.hurt > 0 ? '#c9875a' : '#6b4a2e', dark = '#4f3520';
    // paws, stepping
    const st = Math.sin(b.step) * 4;
    g.fillStyle = dark;
    for (const [px, py, s] of [[8, -13, st], [8, 13, -st], [-9, -13, -st], [-9, 13, st]]) { g.beginPath(); g.arc(px + s, py, 5.5, 0, 7); g.fill(); }
    if (b.state === 'dead') { g.rotate(.6); }
    g.fillStyle = fur; g.beginPath(); g.ellipse(-2, 0, BEAR_R * 1.05, BEAR_R * .85, 0, 0, 7); g.fill();
    // head with ears and a snout
    g.fillStyle = fur; g.beginPath(); g.arc(15, 0, 10, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(11, -9, 4, 0, 7); g.arc(11, 9, 4, 0, 7); g.fill();
    g.fillStyle = '#b08a62'; g.beginPath(); g.ellipse(23, 0, 5, 4.2, 0, 0, 7); g.fill();
    g.fillStyle = '#1e140c'; g.beginPath(); g.arc(27, 0, 2, 0, 7); g.fill();
    g.beginPath(); g.arc(17, -4.5, 1.5, 0, 7); g.arc(17, 4.5, 1.5, 0, 7); g.fill();
    // a swipe: claw marks in front
    if (b.swipe > 0) {
      g.strokeStyle = `rgba(255,255,255,${b.swipe / .35})`; g.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(26, i * 6, 10, -.6, .6); g.stroke(); }
    }
    g.restore();
    if (b.state === 'dead') return;
    // waiting at the gate: a ring that fills over 30 seconds, and the seconds left
    if (b.state === 'wait' && !NO_BASE) {
      const k = b.wait / (this.gateWait + (this.brickGate ? 10 : 0));
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, BEAR_R + 7, 0, 7); g.stroke();
      g.strokeStyle = k > .8 ? '#ff6a5a' : '#ffcf8c'; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, BEAR_R + 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      g.fillStyle = '#fff5ea'; g.font = '600 13px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(String(Math.ceil(this.gateWait + (this.brickGate ? 10 : 0) - b.wait)), b.x, b.y - BEAR_R - 12);
    }
    // health bar once hurt
    if (b.hp < SURVIVAL.bearHp) {
      const w = 34, k = Math.max(0, b.hp / SURVIVAL.bearHp), y = b.y + BEAR_R + 8;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(b.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle = '#ff6a5a'; g.fillRect(b.x - w / 2, y, w * k, 4);
    }
  }

  private drawGuy(g: CanvasRenderingContext2D) {
    const L = this.load, a = this.face, bob = Math.sin(this.walk) * 2;
    g.save(); g.translate(this.x, this.y);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(2, 4, GUY_R + 2, GUY_R, 0, 0, 7); g.fill();
    if (this.hurtFlash > 0) { g.fillStyle = `rgba(255,60,50,${this.hurtFlash})`; g.beginPath(); g.arc(0, 0, GUY_R + 10, 0, 7); g.fill(); }
    if (this.acidT > 0) { g.fillStyle = `rgba(90,220,70,${.25 + .15 * Math.sin(this.t * 10)})`; g.beginPath(); g.arc(0, 0, GUY_R + 8, 0, 7); g.fill(); }
    paintGuy(g, L, a + (this.mining ? Math.sin(this.swing * Math.PI) * .5 : 0), bob, this.reload > 0 && this.weapon() !== 'rxbow' ? 0 : 1, this.weapon() === 'rxbow' ? '#ffe14a' : this.weapon() === 'mgun' ? '#3a3f45' : this.weapon() === 'rgun' ? '#d64545' : this.ammoTint(), this.weapon() === 'rgun', !this.weapon());
    g.restore();
    // reload ring around the guy
    if (this.reload > 0) {
      const k = 1 - this.reload / (AMMO[L.ammo].reload * ST.reloadMul);
      g.strokeStyle = 'rgba(255,245,234,.75)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(this.x, this.y, GUY_R + 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
    }
  }

  private drawHud(g: CanvasRenderingContext2D, dt: number) {
    const cw = this.cw, s = this.scale;
    // the guy's name over his head
    g.font = '500 12px Jost, sans-serif'; g.textAlign = 'center';
    const nx = this.ox + this.x * s, ny = this.oy + (this.y - GUY_R - 14) * s - 4;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(this.load.name, nx + 1, ny + 1);
    g.fillStyle = '#fff5ea'; g.fillText(this.load.name, nx, ny);

    // health bar
    const x = 14, y = 12, w = cw - 28 - 46, h = 18, k = this.hp / SURVIVAL.maxHp;
    g.fillStyle = 'rgba(10,8,24,.7)'; roundRect(g, x - 2, y - 2, w + 4, h + 4, 8); g.fill();
    g.fillStyle = k > .5 ? '#5fbf86' : k > .25 ? '#e0b43a' : '#e0524a';
    roundRect(g, x, y, Math.max(0, w * k), h, 6); g.fill();
    g.fillStyle = '#fff'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText(`${fmt(Math.ceil(this.hp))} / ${fmt(SURVIVAL.maxHp)}`, x + w / 2, y + 13.5);
    g.textAlign = 'left'; g.font = '500 13px Jost, sans-serif'; g.fillStyle = '#fff5ea';
    const waiting = this.bears.filter(b => b.state === 'wait' || b.state === 'walk').length, inside = this.bears.filter(b => b.state === 'chase' || b.state === 'enter').length;
    g.fillText(`${clock(this.t)}   Bears defeated ${this.kills}`, x, y + h + 20);
    g.textAlign = 'right';
    g.fillStyle = inside ? '#ff8a7a' : '#fff5ea';
    const sps = this.spawners.filter(sp => !sp.dead).length;
    g.fillText(NO_BASE ? `${inside} after you · ${waiting}/${this.groupSize} gathering` : `${inside ? `${inside} after you · ` : ''}${waiting} at gates · ${sps} spawner${sps === 1 ? '' : 's'}`, cw - 14, y + h + 20);
    // pollution: a small bar under the counts on the right
    if (this.pollution > 1) {
      const k2 = this.smog() / 10, pw = 90;
      g.textAlign = 'right'; g.fillStyle = this.smog() > 3 ? '#ffb07a' : '#d9d4ca'; g.font = '500 12px Jost, sans-serif';
      g.fillText(`Pollution ${Math.round(this.pollution)}`, cw - 14 - pw - 8, y + h + 38);
      g.fillStyle = 'rgba(10,8,24,.6)'; roundRect(g, cw - 14 - pw, y + h + 29, pw, 10, 5); g.fill();
      g.fillStyle = '#a8865a'; roundRect(g, cw - 14 - pw, y + h + 29, Math.max(6, pw * k2), 10, 5); g.fill();
      g.font = '500 13px Jost, sans-serif';
    }
    if (this.mineOn) {
      g.textAlign = 'left'; g.fillStyle = '#d9d4ca';
      const res = [`Stone ${this.bag.stone}`, this.bag.ironPlate ? `Iron plates ${this.bag.ironPlate}` : '', this.bag.copperPlate ? `Copper plates ${this.bag.copperPlate}` : '', this.bag.rocket ? `Rockets ${this.bag.rocket}` : ''].filter(Boolean).join('  ');
      g.fillText(res, x, y + h + 38);
      g.fillStyle = '#fff5ea';
      const wp = this.weapon(); g.fillText(`${wp ? ONE_NAME[wp] : 'No weapon'} · ammo: ${this.ammoName()}`, x, y + h + 56);
    }

    // bubbles: red for health lost, small white numbers on bears
    for (const u of this.bubbles) {
      const life = u.kind === 'loss' ? 1.6 : 1.1, p = u.t / life;
      const bx = this.ox + u.x * s, by = this.oy + u.y * s - p * 38;
      g.globalAlpha = p < .75 ? 1 : 1 - (p - .75) / .25;
      if (u.kind === 'loss') {
        g.font = '700 14px Jost, sans-serif'; const tw = g.measureText(u.text).width;
        const pop = 1 + Math.max(0, .25 - u.t) * 1.6;
        g.save(); g.translate(bx, by); g.scale(pop, pop);
        g.fillStyle = '#d8312a'; roundRect(g, -tw / 2 - 9, -13, tw + 18, 24, 12); g.fill();
        g.strokeStyle = '#ff9a90'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(u.text, 0, 4);
        g.restore();
      } else {
        if (u.kind === 'tiny') g.globalAlpha *= .8;
        g.font = u.kind === 'tiny' ? '600 9px Jost, sans-serif' : u.kind === 'info' ? '500 12px Jost, sans-serif' : '700 13px Jost, sans-serif'; g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(u.text, bx + 1, by + 1);
        g.fillStyle = u.kind === 'info' ? '#fff5ea' : '#ffe9b0'; g.fillText(u.text, bx, by);
      }
      g.globalAlpha = 1;
    }

    // a short message in the middle
    if (this.sayT > 0) {
      this.sayT -= dt;
      g.globalAlpha = Math.min(1, this.sayT);
      // shrink long messages to fit the screen
      let fs = 14; g.font = `500 ${fs}px Jost, sans-serif`; g.textAlign = 'center';
      while (fs > 10 && g.measureText(this.sayText).width > cw - 48) { fs--; g.font = `500 ${fs}px Jost, sans-serif`; }
      const tw = g.measureText(this.sayText).width, my = (this.mineOn ? 100 : 64) + 118;
      g.fillStyle = 'rgba(20,16,34,.78)'; roundRect(g, cw / 2 - tw / 2 - 12, my - 17, tw + 24, 28, 14); g.fill();
      g.fillStyle = '#fff5ea'; g.fillText(this.sayText, cw / 2, my + 2);
      g.globalAlpha = 1;
    }

    // drag stick
    if (this.stick) {
      g.strokeStyle = 'rgba(255,245,234,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(this.stick.ox, this.stick.oy, 46, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,245,234,.35)'; g.beginPath(); g.arc(this.stick.ox + this.stick.dx, this.stick.oy + this.stick.dy, 20, 0, 7); g.fill();
    }

    // reload shown on the buttons
    const r = Math.min(1, this.reload / ((this.weapon() === 'rgun' ? SURVIVAL.rgunReload : AMMO[this.load.ammo].reload) * ST.reloadMul));
    this.pad.style.setProperty('--reload', String(r));
    this.pad.classList.toggle('loading', this.reload > 0);
    const nearMine = this.mineOn && !!near(this.mines, this.x, this.y), nearMachine = this.mineOn && !!near(this.machines, this.x, this.y);
    const mb = this.pad.querySelector<HTMLElement>('#svMine')!, ab = this.pad.querySelector<HTMLElement>('#svAmmoBtn')!;
    const onPatch = !nearMine && !nearMachine && (!!this.digAt || !!this.nearPatch());
    mb.hidden = !nearMine && !nearMachine && !onPatch;
    const label = nearMine ? (this.mining ? 'Stop' : 'Mine') : onPatch ? (this.digAt ? 'Stop' : 'Mine') : 'Machine';
    if (mb.firstElementChild!.textContent !== label) mb.firstElementChild!.textContent = label;
    ab.hidden = true; // the weapon and ammo slots do this now
    this.renderArms();
    const hb = this.pad.querySelector<HTMLElement>('#svHire')!;
    hb.hidden = !nearMine || this.miners.length >= SURVIVAL.maxMiners * this.mines.length;
    const hl = `H: ${this.minerCost()} stone`;
    if (hb.lastElementChild!.textContent !== hl) hb.lastElementChild!.textContent = hl;
    const hn = this.miners.length ? 'Extra miner' : 'Miner';
    if (hb.firstElementChild!.textContent !== hn) hb.firstElementChild!.textContent = hn;
    this.pad.querySelector<HTMLElement>('#svShopBtn')!.hidden = this.shopOpen;
    this.renderQuick();
    const db = this.pad.querySelector<HTMLElement>('#svDrop')!; db.hidden = !(this.placing || (this.hand && this.bag[this.hand] > 0));
    const lb = this.pad.querySelector<HTMLElement>('#svLoad')!, use = this.nearUsable();
    lb.hidden = !use || (use.kind === 'turret' && !this.loadable());
    const ub = use?.kind === 'bld' ? this.blds.get(use.key) : undefined;
    const ll = !use ? 'Use' : use.kind === 'chest' ? 'Take' : use.kind === 'lab' || use.kind === 'turret' ? 'Load' : ub && (ub.type === 'asm' || ub.type === 'furnace') ? 'Open' : 'Use';
    this.pad.querySelector<HTMLElement>('#svLabBtn')!.hidden = !this.labs.size || this.labOpen || this.shopOpen;
    if (this.labOpen) this.renderLab();
    if (lb.firstElementChild!.textContent !== ll) lb.firstElementChild!.textContent = ll;
    const standing = tileAt(this.x, this.y);
    this.pad.querySelector<HTMLElement>('#svRotate')!.hidden = !this.placing && !(standing && this.belts.has(standing.c + ',' + standing.r));
    const pt = this.placeType, turns = ['belt', 'grab', 'split', 'furnace', 'asm', 'tunnel', 'drill'].includes(pt);
    const help = this.picked ? 'Tap a bear or spawner for this turret to shoot. Tap the turret again to pick it up.'
      : this.placing ? `Tap to place the ${ONE_NAME[pt].toLowerCase()} (${this.bag[pt]} left)${pt === 'belt' || pt === 'pole' || pt === 'pipe' ? ', or drag to lay a line' : ''}.${turns ? ' R turns it.' : ''}${pt === 'drill' ? ' Drills go on ore patches.' : ''}`
      : this.digAt ? `Digging ${this.digAt.ore === 'stone' ? 'stone' : ONE_NAME[this.digAt.ore].toLowerCase()} (${this.digAt.left} left). Walk away to stop.` : this.helpText;
    const hp = this.pad.querySelector<HTMLElement>('#svHelp')!;
    if (hp.textContent !== help) hp.textContent = help;
    if (this.shopOpen) this.renderShop();
    const al = this.ammoName();
    if (ab.firstElementChild!.textContent !== al) ab.firstElementChild!.textContent = al;
  }
}

/** The little guy, centred on the origin, facing angle a. */
function paintGuy(g: CanvasRenderingContext2D, L: Loadout, a: number, bob: number, pull: number, boltColor = AMMO[L.ammo].color, tube = false, bare = false) {
  g.rotate(a);
  // feet
  g.fillStyle = '#3a2c20'; g.beginPath(); g.arc(3 + bob, -6, 3.5, 0, 7); g.arc(3 - bob, 6, 3.5, 0, 7); g.fill();
  // body (shirt colour) and arms holding the crossbow forward
  g.fillStyle = L.color; g.beginPath(); g.ellipse(0, 0, GUY_R * .8, GUY_R, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(12, -5, 3, 0, 7); g.arc(12, 5, 3, 0, 7); g.fill();
  if (bare) { /* nothing in hand */ } else if (tube) {
    // the rocket gun: a green tube on the shoulder, with a rocket tip showing when loaded
    g.fillStyle = '#4a5a4a'; g.fillRect(-6, -4.5, 30, 9); g.fillStyle = '#3a463a'; g.fillRect(4, 4, 4, 6);
    g.fillStyle = '#2a2a2a'; g.fillRect(22, -5.5, 4, 11); g.fillRect(-8, -5.5, 3, 11);
    if (pull) { g.fillStyle = boltColor; g.beginPath(); g.moveTo(26, -3.5); g.lineTo(31, 0); g.lineTo(26, 3.5); g.fill(); }
  } else {
  // crossbow: stock, bow and string; a bolt sits on it when loaded
  g.strokeStyle = '#5a3d22'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(4, 0); g.lineTo(26, 0); g.stroke();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, -12); g.quadraticCurveTo(28, 0, 22, 12); g.stroke();
  g.strokeStyle = '#e8e0d0'; g.lineWidth = 1; g.beginPath(); g.moveTo(22, -12); g.lineTo(22 - 8 * pull, 0); g.lineTo(22, 12); g.stroke();
  if (pull) { g.strokeStyle = boltColor; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 0); g.lineTo(30, 0); g.stroke(); }
  }
  // head and hat
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, 0, 7.5, 0, 7); g.fill();
  if (L.hat === 'cap') { g.fillStyle = shade(L.color, -.25); g.beginPath(); g.arc(0, 0, 7.8, 0, 7); g.fill(); g.beginPath(); g.ellipse(7, 0, 5, 6, 0, -Math.PI / 2, Math.PI / 2); g.fill(); }
  else if (L.hat === 'helmet') { g.fillStyle = '#6b7a52'; g.beginPath(); g.arc(0, 0, 9.5, 0, 7); g.fill(); g.fillStyle = '#7f8f63'; g.beginPath(); g.arc(-1.5, -1.5, 5.5, 0, 7); g.fill(); }
  else if (L.hat === 'crown') {
    g.fillStyle = '#ffd34a'; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 8.5, an = i / 10 * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    g.closePath(); g.fill(); g.fillStyle = '#ff5a6a'; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill();
  }
}

/** Draws the little guy on the loadout screen. */
export function drawPreview(c: HTMLCanvasElement, L: Loadout) {
  const g = c.getContext('2d')!, dpr = Math.min(2, devicePixelRatio || 1), size = c.clientWidth || 96;
  c.width = c.height = Math.round(size * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
  g.fillStyle = '#8b7651'; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 7); g.fill();
  g.translate(size / 2 - 6, size / 2); g.scale(size / 52, size / 52);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(2, 4, GUY_R + 2, GUY_R, 0, 0, 7); g.fill();
  paintGuy(g, L, -.5, 0, 1);
}

type Rect = [number, number, number, number];
/** The fence as rectangles, with gaps at the gates. */
function wallRects(gates: Gate[]): Rect[] {
  const { x0, x1, y0, y1, t } = WALL, out: Rect[] = [];
  for (const s of [0, 1, 2, 3] as const) {
    const horiz = s % 2 === 0, lo = horiz ? x0 : y0, hi = horiz ? x1 : y1;
    const gaps = gates.filter(g => g.side === s).map(g => { const c = lo + (hi - lo) * g.at; return [c - GATE.w / 2, c + GATE.w / 2]; }).sort((a, b) => a[0] - b[0]);
    let a = lo;
    for (const [g0, g1] of [...gaps, [hi, hi]]) {
      if (g0 > a) out.push(horiz ? [a, s === 0 ? y0 : y1 - t, g0, s === 0 ? y0 + t : y1] : [s === 3 ? x0 : x1 - t, a, s === 3 ? x0 + t : x1, g0]);
      a = Math.max(a, g1);
    }
  }
  return out;
}
/** Pushes a circle out of the rectangles. */
function collide(p: { x: number; y: number }, r: number, rects: Rect[]) {
  for (const [ax, ay, bx, by] of rects) {
    const cx = clamp(p.x, ax, bx), cy = clamp(p.y, ay, by), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d > 1e-6) { p.x = cx + dx / d * r; p.y = cy + dy / d * r; continue; }
    const l = p.x - ax, rr = bx - p.x, u = p.y - ay, dn = by - p.y, m = Math.min(l, rr, u, dn);
    if (m === l) p.x = ax - r; else if (m === rr) p.x = bx + r; else if (m === u) p.y = ay - r; else p.y = by + r;
  }
}
/** Is (x, y) within m of the fence's outline (or inside it)? */
const nearFence = (x: number, y: number, m: number) => x > WALL.x0 - m && x < WALL.x1 + m && y > WALL.y0 - m && y < WALL.y1 + m;
/** Does the segment from (ax, ay) to (bx, by) pass through the rectangle? */
function segHits(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1;
}
/** Where to head for (tx, ty) from outside the fence: straight there, or round a corner of the fence first. */
function around(x: number, y: number, tx: number, ty: number): [number, number] {
  if (NO_BASE) return [tx, ty];
  const m = BEAR_R + 8, x0 = WALL.x0 - m, x1 = WALL.x1 + m, y0 = WALL.y0 - m, y1 = WALL.y1 + m;
  // hugging the fence: step straight out first
  if (x > x0 + 2 && x < x1 - 2 && y > y0 + 2 && y < y1 - 2) {
    const l = x - x0, r = x1 - x, u = y - y0, d = y1 - y, k = Math.min(l, r, u, d);
    if (!insideBase(tx, ty) && !segHits(x, y, tx, ty, WALL.x0, WALL.y0, WALL.x1, WALL.y1)) return [tx, ty];
    return k === l ? [x0 - 1, y] : k === r ? [x1 + 1, y] : k === u ? [x, y0 - 1] : [x, y1 + 1];
  }
  const hit = (ax: number, ay: number, bx: number, by: number) => segHits(ax, ay, bx, by, x0 + 3, y0 + 3, x1 - 3, y1 - 3);
  if (!hit(x, y, tx, ty)) return [tx, ty];
  // shortest way round: nodes are the four corners and the target; edges are lines that miss the fence
  const pts: [number, number][] = [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [x0 - 1, y1 + 1], [tx, ty]];
  const cost = [Infinity, Infinity, Infinity, Infinity, Infinity], first = [-1, -1, -1, -1, -1], done = [false, false, false, false, false];
  for (let i = 0; i < 4; i++) if (dist(x, y, pts[i][0], pts[i][1]) >= 3 && !hit(x, y, pts[i][0], pts[i][1])) { cost[i] = dist(x, y, pts[i][0], pts[i][1]); first[i] = i; }
  for (;;) {
    let u = -1;
    for (let i = 0; i < 5; i++) if (!done[i] && cost[i] < Infinity && (u < 0 || cost[i] < cost[u])) u = i;
    if (u < 0 || u === 4) break;
    done[u] = true;
    for (let v = 0; v < 5; v++) {
      if (done[v] || hit(pts[u][0], pts[u][1], pts[v][0], pts[v][1])) continue;
      const c = cost[u] + dist(pts[u][0], pts[u][1], pts[v][0], pts[v][1]);
      if (c < cost[v]) { cost[v] = c; first[v] = first[u]; }
    }
  }
  return first[4] >= 0 ? pts[first[4]] : [tx, ty];
}
/** Ore patches round the camp: stone, iron and copper close in, gold further out, diamonds out by the spawners. */
/** Where you start: a square stone patch under you, with a square iron patch touching its right side and a copper one its left, lined up with the tiles. */
function startPatches(x: number, y: number): Patch[] {
  const c = Math.floor((x - GX0) / TILE), r = Math.floor((y - GY0) / TILE), S = SURVIVAL.startStone, O = SURVIVAL.startOre;
  const amount = { stone: 2500, iron: 2200, copper: 2200 } as const, unit = Math.PI * 95 * 95;
  const sq = (ore: 'stone' | 'iron' | 'copper', c0: number, r0: number, n: number): Patch => {
    const h = n * TILE / 2, left = Math.round(amount[ore] * (2 * h) ** 2 / unit);
    return { sq: h, x: GX0 + c0 * TILE + h, y: GY0 + r0 * TILE + h, r: h * Math.SQRT2, ore, left, max: left, seed: Math.floor(Math.random() * 1e9) + 1 };
  };
  const c0 = c - Math.floor(S / 2), r0 = r - Math.floor(S / 2), mid = r0 + Math.floor((S - O) / 2);
  return [sq('stone', c0, r0, S), sq('iron', c0 + S, mid, O), sq('copper', c0 - O, mid, O)];
}
function genPatches(spawners: Spawner[], start: Patch[] = []): Patch[] {
  const out: Patch[] = [...start], big = EXPANSIONS[EXPANSIONS.length - 1];
  const plan: ['stone' | Ore, number, number][] = [['stone', 420, 800], ['iron', 420, 800], ['copper', 420, 800], ['iron', 800, 1400], ['copper', 800, 1400], ['stone', 800, 1400],
    ['iron', 1300, 2000], ['copper', 1300, 2000], ['gold', 1100, 1800], ['gold', 1700, 2400], ['diamond', 2000, 2800], ['diamond', 2300, 3000], ['stone', 1600, 2600], ['iron', 2000, 2900], ['copper', 2000, 2900]];
  const amount = { stone: 2500, iron: 2200, copper: 2200, gold: 1400, diamond: 900 };
  for (const [ore, lo, hi] of plan) {
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * Math.PI * 2, d = lo + Math.random() * (hi - lo), r = 70 + Math.random() * 50;
      const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
      if (x < r + 40 || y < r + 40 || x > W - r - 40 || y > H - r - 40) continue;
      if (x > big.x0 - r - 150 && x < big.x1 + r + 150 && y > big.y0 - r - 150 && y < big.y1 + r + 150) continue;
      if (Math.abs(x - GATE.x) < r + 90 && y < big.y0) continue; // keep the path to the top gate clear
      if (out.some(p => dist(p.x, p.y, x, y) < p.r + r + 60) || spawners.some(sp => dist(sp.x, sp.y, x, y) < r + 90)) continue;
      const n = Math.round(amount[ore] * (r / 95) ** 2);
      out.push({ x, y, r, ore, left: n, max: n, seed: Math.floor(Math.random() * 1e9) });
      break;
    }
  }
  return out;
}
/** Turns a save from before the big inventory change into the new shape. */
function migrateSave(d: SaveData): SaveData {
  const o = { ...d } as Record<string, any>, bag = { ...(o.bag ?? {}) } as Record<string, number>;
  const add = (k: string, n: number) => { if (n) bag[k] = (bag[k] ?? 0) + n; };
  add('belt', (o.inv ?? 0) * 3 + (o.invShort ?? 0)); add('grab', o.invGrab ?? 0); add('turret', o.invTurret ?? 0); add('split', o.invSplit ?? 0); add('chest', o.invChest ?? 0);
  add('machine', o.invMachine ?? 0); add('lab', o.invLab ?? 0); add('bturret', o.invBTurret ?? 0); add('rapid', o.invT?.rapid ?? 0); add('launcher', o.invT?.rocket ?? 0);
  add('drill', (o.invMine ?? 0) + Object.values(o.invOre ?? {}).reduce((a: number, n) => a + (n as number), 0));
  for (const [k, n] of Object.entries(o.invB ?? {})) add(k, n as number);
  o.bag = bag;
  // the tile grid now covers the whole map, so every tile moved over
  const shift = (key: string) => { const [c, r] = key.split(',').map(Number); return (c + OLD_C) + ',' + (r + OLD_R); };
  for (const k of ['belts', 'splitters', 'chests', 'labs', 'blds', 'grabbers', 'turrets']) o[k] = (o[k] ?? []).map(([key, v]: [string, unknown]) => [shift(key), v]);
  o.robots = (o.robots ?? []).map((r: Robot) => ({ ...r, hub: shift(r.hub) }));
  for (const [, b] of o.blds as [string, Bld][]) if (typeof b.recipe !== 'string' || b.recipe === 'belt') b.recipe = b.type === 'asm' ? 'pack' : '';
  o.v = 2;
  return o;
}
/** A random spot far out in the woods, in direction a from the camp. */
function spawnerSpot(a: number): [number, number] {
  const d = (520 + Math.random() * 260) * SURVIVAL.spawnerFar;
  return [clamp(CX + Math.cos(a) * d, 70, W - 70), clamp(CY + Math.sin(a) * d, 70, H - 70)];
}
const tileX = (c: number) => GX0 + c * TILE + TILE / 2, tileY = (r: number) => GY0 + r * TILE + TILE / 2;
/** The fence as it is now (kept up to date by the game), so nothing gets built on it. */
let fence: Rect[] = [];
function tileAt(x: number, y: number) {
  const c = Math.floor((x - GX0) / TILE), r = Math.floor((y - GY0) / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
  // anywhere on the map except on the fence
  const cx = GX0 + c * TILE + TILE / 2, cy = GY0 + r * TILE + TILE / 2, m = TILE / 2 - 2;
  return fence.some(([ax, ay, bx, by]) => cx > ax - m && cx < bx + m && cy > ay - m && cy < by + m) ? null : { c, r };
}
/** Belts can't go on the mine, the machine or the shop. */
function blockedTile(c: number, r: number) {
  const x = tileX(c), y = tileY(r);
  return structs.some(o => dist(x, y, o.x, o.y) < o.r + 10);
}
/** A hired miner at its spot by a mine, swinging a pick at it. */
function paintMiner(g: CanvasRenderingContext2D, [mine, ox, oy]: [Spot, number, number], mt: number) {
  const sw = Math.sin(mt / ST.minerEvery * Math.PI * 10) * .6;
  g.save(); g.translate(mine.x + ox, mine.y + oy);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2, 3, 11, 9, 0, 0, 7); g.fill();
  g.rotate(Math.atan2(-oy, -ox));
  g.fillStyle = '#7a5a3a'; g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, 7); g.fill();
  g.save(); g.rotate(sw);
  g.strokeStyle = '#5a3d22'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(4, 2); g.lineTo(18, 2); g.stroke();
  g.strokeStyle = '#9aa0a6'; g.lineWidth = 3; g.beginPath(); g.moveTo(18, -6); g.quadraticCurveTo(22, 2, 18, 10); g.stroke();
  g.restore();
  g.fillStyle = '#e0b43a'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(4, 0, 1.8, 0, 7); g.fill();
  g.restore();
}
/** The nearest spot in a list within reach of (x, y), if any. */
function near<T extends Spot>(list: T[], x: number, y: number): T | null {
  let best: T | null = null, bd = NEAR;
  for (const o of list) { const d = dist(x, y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
/** One thing lying on a belt (or in an inventory slot). */
function paintItem(g: CanvasRenderingContext2D, x: number, y: number, k: Kind) {
  if (k === 'brick') {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 5, y - 2, 12, 7);
    g.fillStyle = '#b5523a'; g.fillRect(x - 6, y - 4, 12, 7); g.fillStyle = '#d97a5a'; g.fillRect(x - 6, y - 4, 12, 2);
    return;
  }
  if (k === 'pack' || k === 'pack2') { paintPack(g, x, y, k === 'pack' ? '#e0524a' : '#5fbf86'); return; }
  if (k === 'ironPlate' || k === 'copperPlate') {
    // a flat square plate with a shine
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 4.5, y - 3, 11, 9);
    g.fillStyle = KIND_DOT[k]; g.fillRect(x - 5.5, y - 4.5, 11, 9);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x - 5.5, y - 4.5, 11, 2); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .8; g.strokeRect(x - 5.5, y - 4.5, 11, 9);
    return;
  }
  if (k === 'goldBar') {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 5, y - 1, 12, 6);
    g.fillStyle = '#e8b92e'; g.beginPath(); g.moveTo(x - 6, y + 4); g.lineTo(x - 3.5, y - 3); g.lineTo(x + 3.5, y - 3); g.lineTo(x + 6, y + 4); g.closePath(); g.fill();
    g.fillStyle = '#fff0a0'; g.fillRect(x - 3, y - 2.5, 6, 1.6);
    return;
  }
  if (k === 'gem') {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 1.5, y + 2, 5, 0, 7); g.fill();
    g.fillStyle = '#8ff0ff'; g.beginPath(); g.moveTo(x - 6, y - 2); g.lineTo(x - 3, y - 5); g.lineTo(x + 3, y - 5); g.lineTo(x + 6, y - 2); g.lineTo(x, y + 6); g.closePath(); g.fill();
    g.strokeStyle = '#3fb8d0'; g.lineWidth = .8; g.beginPath(); g.moveTo(x - 6, y - 2); g.lineTo(x + 6, y - 2); g.moveTo(x - 2, y - 2); g.lineTo(x, y + 6); g.lineTo(x + 2, y - 2); g.stroke();
    return;
  }
  if (k === 'gear') {
    g.save(); g.translate(x, y); g.fillStyle = '#9aa0a6';
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-1.5, -6.5, 3, 3); }
    g.beginPath(); g.arc(0, 0, 4.6, 0, 7); g.fill(); g.fillStyle = '#5a6066'; g.beginPath(); g.arc(0, 0, 1.8, 0, 7); g.fill();
    g.restore(); return;
  }
  if (k === 'wire') {
    g.strokeStyle = '#e08a4a'; g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x - 3 + i * 3, y, 2.4, 5, 0, 0, 7); g.stroke(); }
    return;
  }
  if (k === 'circuit') {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 4.5, y - 3, 11, 9);
    g.fillStyle = '#3f8f45'; g.fillRect(x - 5.5, y - 4.5, 11, 9);
    g.fillStyle = '#ffd34a'; g.fillRect(x - 3.5, y - 2.5, 3, 2); g.fillRect(x + 1, y + .5, 3, 2);
    g.strokeStyle = '#c9e8b0'; g.lineWidth = .8; g.beginPath(); g.moveTo(x - 2, y - .5); g.lineTo(x - 2, y + 2.5); g.lineTo(x + 1, y + 2.5); g.stroke();
    return;
  }
  if (k === 'robot') { g.save(); g.translate(x, y); g.scale(.85, .85); paintRobot(g, 0, 0, 0); g.restore(); return; }
  if (isPlaceable(k)) { g.save(); g.translate(x, y); g.scale(.5, .5); if (k === 'machine' || k === 'mine') { g.fillStyle = k === 'machine' ? '#5b6670' : '#6f6c66'; g.fillRect(-11, -11, 22, 22); } else paintPlaceable(g, 0, 0, k, 0, 0); g.restore(); return; }
  if (isAmmoKind(k)) {
    // ammo: a bolt with a coloured band (blue for stone ammo, the metal's colour for metal ammo)
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 5, y - 1, 12, 5);
    g.fillStyle = k === 'ammo' ? STONE : KIND_DOT[k]; g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 2, y - 4); g.lineTo(x - 6, y - 3); g.lineTo(x - 6, y + 3); g.lineTo(x + 2, y + 4); g.closePath(); g.fill();
    g.fillStyle = k === 'ammo' ? '#7fc8ff' : '#3a3a3a'; g.fillRect(x - 3, y - 3, 2.5, 6);
    return;
  }
  if (k === 'rocket') { paintRocket(g, x, y, 0, .8); return; }
  if (k === 'xbow' || k === 'rxbow') {
    // a crossbow lying flat: stock, bow and string (the rapid one has a yellow magazine on top)
    g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
    g.strokeStyle = '#5a3d22'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, -7); g.quadraticCurveTo(9, 0, 5, 7); g.stroke();
    g.strokeStyle = '#e8e0d0'; g.lineWidth = .8; g.beginPath(); g.moveTo(5, -7); g.lineTo(0, 0); g.lineTo(5, 7); g.stroke();
    if (k === 'rxbow') { g.fillStyle = '#ffe14a'; g.fillRect(-5, -4.5, 6, 3); g.fillStyle = '#c9a020'; g.fillRect(-5, -2, 6, 1.2); }
    g.restore(); return;
  }
  if (k === 'mgun') {
    // a machine gun lying flat: stock, body, a box magazine, a barrel with a cooling sleeve and a front grip
    g.save(); g.translate(x, y); g.rotate(-Math.PI / 6);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-9, -1, 20, 6);
    g.fillStyle = '#5a3d22'; g.beginPath(); g.moveTo(-10, -2); g.lineTo(-4, -3); g.lineTo(-4, 2); g.lineTo(-10, 3); g.closePath(); g.fill();
    g.fillStyle = '#3a3f45'; g.fillRect(-4, -3.2, 8, 5);
    g.fillStyle = '#2a2d31'; g.fillRect(4, -2.4, 3.5, 3.4);
    g.fillStyle = '#4c535b'; g.fillRect(7.5, -1.3, 4.5, 1.6);
    g.fillStyle = '#1e2124'; for (let i = 0; i < 3; i++) g.fillRect(4.5 + i * 1.1, -2.4, .5, 3.4);
    g.fillStyle = '#c9a43a'; g.fillRect(-2, 1.8, 3, 4);
    g.fillStyle = '#2a2d31'; g.fillRect(3, 1.6, 1.6, 3);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-4, -3.2, 8, 1);
    g.restore(); return;
  }
  if (k === 'rgun') {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 7, y - 1, 16, 6);
    g.fillStyle = '#4a5a4a'; g.fillRect(x - 8, y - 3, 16, 6); g.fillStyle = '#2a2a2a'; g.fillRect(x + 6, y - 4, 3, 8); g.fillRect(x - 9, y - 4, 2, 8);
    g.fillStyle = '#3a463a'; g.fillRect(x - 2, y + 3, 3, 4); g.fillStyle = '#d64545'; g.beginPath(); g.moveTo(x + 9, y - 2); g.lineTo(x + 12, y); g.lineTo(x + 9, y + 2); g.fill();
    return;
  }
  if (ORES.includes(k as Ore)) {
    // a nugget of metal (a diamond is a little gem)
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 1.5, y + 2, 5, 0, 7); g.fill();
    g.fillStyle = KIND_DOT[k]; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5.5, y - 1); g.lineTo(x + 3, y + 5); g.lineTo(x - 3.5, y + 5); g.lineTo(x - 5.5, y - 1); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 1.6, 0, 7); g.fill();
    return;
  }
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 1.5, y + 2, 5.5, 0, 7); g.fill();
  g.fillStyle = STONE; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill();
  g.fillStyle = '#d0ccc2'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2, 0, 7); g.fill();
}
/** A small rocket pointing along angle a, with a flame. */
function paintRocket(g: CanvasRenderingContext2D, x: number, y: number, a: number, k: number) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
  g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-7, -2.5); g.lineTo(-13 - Math.random() * 3, 0); g.lineTo(-7, 2.5); g.fill();
  g.fillStyle = '#e8e2d6'; g.fillRect(-7, -3, 11, 6);
  g.fillStyle = '#d64545'; g.beginPath(); g.moveTo(4, -3); g.lineTo(9, 0); g.lineTo(4, 3); g.fill();
  g.fillStyle = '#d64545'; g.beginPath(); g.moveTo(-7, -3); g.lineTo(-9, -6); g.lineTo(-4, -3); g.moveTo(-7, 3); g.lineTo(-9, 6); g.lineTo(-4, 3); g.fill();
  g.restore();
}
/** A splitter: stone comes in, and goes out to the left and right in turn. */
function paintSplitter(g: CanvasRenderingContext2D, x: number, y: number, d: number) {
  g.save(); g.translate(x, y); g.rotate(d * Math.PI / 2);
  g.fillStyle = '#4a4f7a'; g.fillRect(-11, -11, 22, 22);
  g.strokeStyle = '#e0b43a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(0, 0); g.lineTo(0, -8); g.moveTo(0, 0); g.lineTo(0, 8); g.stroke();
  g.fillStyle = '#e0b43a';
  g.beginPath(); g.moveTo(0, -11); g.lineTo(-3.5, -6); g.lineTo(3.5, -6); g.fill();
  g.beginPath(); g.moveTo(0, 11); g.lineTo(-3.5, 6); g.lineTo(3.5, 6); g.fill();
  g.restore();
}
/** A lab: a bench with a bubbling flask. t > 0 makes it bubble. */
function paintLab(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-9, -7, 22, 20);
  g.fillStyle = '#e8e2d6'; g.fillRect(-11, -10, 22, 20);
  g.strokeStyle = '#7d8a95'; g.lineWidth = 1.5; g.strokeRect(-11, -10, 22, 20);
  g.fillStyle = '#7fd6c2'; g.beginPath(); g.moveTo(-2.5, -7); g.lineTo(2.5, -7); g.lineTo(2.5, -2); g.lineTo(7, 6); g.lineTo(-7, 6); g.lineTo(-2.5, -2); g.closePath(); g.fill();
  g.strokeStyle = '#3a4a52'; g.lineWidth = 1.2; g.stroke();
  if (t > 0) { g.fillStyle = '#fff5ea'; for (let i = 0; i < 3; i++) { const k = (t * .8 + i / 3) % 1; g.globalAlpha = 1 - k; g.beginPath(); g.arc(Math.sin(i * 2 + t * 3) * 2, 2 - k * 14, 1.6, 0, 7); g.fill(); } g.globalAlpha = 1; }
  g.restore();
}
/** A science pack: a little teal bottle. */
function paintPack(g: CanvasRenderingContext2D, x: number, y: number, color = '#e0524a') {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 1.5, y + 2.5, 5, 0, 7); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(x, y + 1, 5, 0, 7); g.fill();
  g.fillStyle = '#e8e2d6'; g.fillRect(x - 2, y - 7, 4, 4);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x - 1.5, y, 1.6, 0, 7); g.fill();
}
/** A robot hovering, with a thing in its claws if it carries one. */
function paintRobot(g: CanvasRenderingContext2D, x: number, y: number, bob: number, k: Kind | null = null) {
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + 4, y + 10, 5, 2.5, 0, 0, 7); g.fill();
  g.fillStyle = '#d8dee4'; g.beginPath(); g.arc(x, y + bob, 5.5, 0, 7); g.fill();
  g.fillStyle = '#3a4a52'; g.fillRect(x - 3, y - 1.5 + bob, 6, 2.5);
  g.strokeStyle = '#9aa6b0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 8, y - 5 + bob); g.lineTo(x + 8, y - 5 + bob); g.stroke();
  if (k) { g.fillStyle = KIND_DOT[k]; g.beginPath(); g.arc(x, y + 7 + bob, 3, 0, 7); g.fill(); }
}
/** Any one-tile thing you can place, facing direction d (for the ghost while placing, and for icons). */
function paintPlaceable(g: CanvasRenderingContext2D, x: number, y: number, p: Placeable, d: number, t: number) {
  if (p === 'belt') paintBelt(g, x, y, d, t);
  else if (p === 'grab') paintGrabber(g, x, y, { d, t: 0, carry: false, k: 'stone' });
  else if (p === 'split') paintSplitter(g, x, y, d);
  else if (p === 'chest') paintChest(g, x, y);
  else if (p === 'wall' || p === 'pgate') paintWall(g, x, y, p === 'pgate', () => false, 0, 0, false);
  else if (p === 'lab') paintLab(g, x, y, 0);
  else if (ITEM_T[p]) paintTurret(g, x, y, { ammo: { ammo: 1, rocket: 1 }, cd: 0, face: -Math.PI / 4, kind: ITEM_T[p]! });
  else if ((BTYPES as string[]).includes(p)) paintBld(g, x, y, { type: p as BType, d, inp: 0, out: 0, t: 0, fuel: p === 'gen' ? 1 : 0, recipe: '', robots: 0 }, 0);
}
/** One of your walls (stone blocks, joined to the walls next to it) or a gate (wooden doors in a stone frame; open when you're close). */
function paintWall(g: CanvasRenderingContext2D, x: number, y: number, gate: boolean, wallAt: (k: string) => boolean, c: number, r: number, open: boolean) {
  const h = TILE / 2;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - h + 2, y - h + 3, TILE, TILE);
  if (gate) {
    g.fillStyle = '#8f8a80'; g.fillRect(x - h, y - h, TILE, TILE);
    g.fillStyle = '#5a3d22'; if (open) { g.fillRect(x - h + 2, y - h + 2, 4, TILE - 4); g.fillRect(x + h - 6, y - h + 2, 4, TILE - 4); }
    else { g.fillRect(x - h + 3, y - h + 3, TILE - 6, TILE - 6); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - h + 3); g.lineTo(x, y + h - 3); g.moveTo(x - h + 3, y); g.lineTo(x + h - 3, y); g.stroke(); g.fillStyle = '#e0b43a'; g.fillRect(x - 3, y - 1.5, 2, 3); g.fillRect(x + 1, y - 1.5, 2, 3); }
    return;
  }
  g.fillStyle = '#9a958b'; g.fillRect(x - h, y - h, TILE, TILE);
  g.fillStyle = '#b4afa4'; g.fillRect(x - h + 1, y - h + 1, 10, 6); g.fillRect(x - h + 12, y - h + 1, 11, 6); g.fillRect(x - h + 1, y - h + 8, 5, 7); g.fillRect(x - h + 7, y - h + 8, 10, 7); g.fillRect(x - h + 18, y - h + 8, 5, 7); g.fillRect(x - h + 1, y - h + 16, 10, 7); g.fillRect(x - h + 12, y - h + 16, 11, 7);
  // an edge where there is no wall next to it
  g.strokeStyle = '#5f5b54'; g.lineWidth = 2; g.beginPath();
  if (!wallAt(c + ',' + (r - 1))) { g.moveTo(x - h, y - h + 1); g.lineTo(x + h, y - h + 1); }
  if (!wallAt(c + ',' + (r + 1))) { g.moveTo(x - h, y + h - 1); g.lineTo(x + h, y + h - 1); }
  if (!wallAt((c - 1) + ',' + r)) { g.moveTo(x - h + 1, y - h); g.lineTo(x - h + 1, y + h); }
  if (!wallAt((c + 1) + ',' + r)) { g.moveTo(x + h - 1, y - h); g.lineTo(x + h - 1, y + h); }
  g.stroke();
}
/** A little blinking red lightning bolt: this needs power. */
function paintNoPower(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  if (Math.sin(t * 5) < -.3) return;
  g.fillStyle = '#ff5a4a'; g.beginPath(); g.moveTo(x + 1.5, y - 5); g.lineTo(x - 3, y + 1); g.lineTo(x, y + 1); g.lineTo(x - 1.5, y + 5); g.lineTo(x + 3, y - 1); g.lineTo(x, y - 1); g.closePath(); g.fill();
}
/** An ore patch: a cluster of rocks in its colour, fewer as it runs out. */
/** A patch's edge is a wobbly blob, not a circle: its radius at angle a (between about 0.72 and 1.08 of p.r). */
function patchEdge(p: Patch, a: number) {
  if (p.sq) return p.sq / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  const s = p.seed || 1, f = (k: number) => ((s * (k * 7919 + 13)) % 1000) / 1000;
  return p.r * (.9 + .09 * Math.sin(2 * a + f(1) * 6.3) + .06 * Math.sin(3 * a + f(2) * 6.3) + .04 * Math.sin(5 * a + f(3) * 6.3));
}
const inPatch = (p: Patch, x: number, y: number, m: number) => dist(x, y, p.x, p.y) < patchEdge(p, Math.atan2(y - p.y, x - p.x)) + m;
/** Each patch is drawn once into its own little picture, and again only when it has visibly run down. */
const patchArt = new WeakMap<Patch, { show: number; c: HTMLCanvasElement }>();
const PATCH_LOOK: Record<'stone' | Ore, { ore: string; dark: string; light: string; rock: number; glint: boolean }> = {
  stone: { ore: '#a9a59c', dark: '#6f6b63', light: '#cfcac0', rock: 0, glint: false },
  iron: { ore: '#8c939c', dark: '#4e545c', light: '#c5ccd6', rock: .15, glint: false },
  copper: { ore: '#c46a35', dark: '#7a3a1c', light: '#f0a070', rock: .2, glint: false },
  gold: { ore: '#e8b830', dark: '#8a6416', light: '#fff0a0', rock: .45, glint: true },
  diamond: { ore: '#7fe6f5', dark: '#3a8a9a', light: '#e8ffff', rock: .6, glint: true },
};
/** An ore patch: a dark stain of dug-up earth with jagged chunks of ore, thick in the middle and thinning out at the edge. As it runs out the chunks go from the outside in. */
function paintPatch(g: CanvasRenderingContext2D, p: Patch, t = 0) {
  const R = Math.ceil(p.r * 1.15) + 8, S = 2;
  const n = Math.round(p.r * p.r / 55), show = Math.ceil(n * p.left / p.max);
  let art = patchArt.get(p);
  if (!art || art.show !== show) {
    const c = art?.c ?? document.createElement('canvas'); c.width = c.height = R * 2 * S;
    const q = c.getContext('2d')!; q.setTransform(S, 0, 0, S, R * S, R * S);
    let seed = p.seed || 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const L = PATCH_LOOK[p.ore];
    // the stain: a few soft blobby layers, darker towards the middle
    for (const [k, al] of [[1.08, .10], [.95, .12], [.75, .12], [.5, .1]] as [number, number][]) {
      q.fillStyle = `rgba(52,38,24,${al})`; q.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, rr = patchEdge(p, a) * k; i ? q.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : q.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      q.fill();
    }
    // grit: tiny specks of ore colour in the dirt
    for (let i = 0; i < n * 2; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * patchEdge(p, a) * .95;
      q.fillStyle = rnd() < .5 ? L.dark : L.ore; q.globalAlpha = .55; q.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.4, 1.4);
    }
    q.globalAlpha = 1;
    // chunks: spread with more in the middle (d is biased inwards), bigger in the middle, sorted so the outer ones go first
    const chunks: { x: number; y: number; r: number; d: number; rock: boolean; pts: number[]; tilt: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, f = Math.pow(rnd(), .8), d = f * (patchEdge(p, a) - 5);
      const r = (2.2 + rnd() * 3.2) * (1.35 - f * .6), m = 5 + Math.floor(rnd() * 3), pts: number[] = [];
      for (let j = 0; j < m; j++) pts.push(.65 + rnd() * .45);
      chunks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r, d: f, rock: rnd() < L.rock, pts, tilt: rnd() * 6.3 });
    }
    chunks.sort((A, B) => A.d - B.d);
    const vis = chunks.slice(0, show).sort((A, B) => A.y - B.y);
    const poly = (ch: typeof chunks[0], ox: number, oy: number, k: number) => {
      q.beginPath();
      ch.pts.forEach((v, j) => { const a = ch.tilt + j / ch.pts.length * Math.PI * 2, rr = ch.r * v * k; j ? q.lineTo(ch.x + ox + Math.cos(a) * rr, ch.y + oy + Math.sin(a) * rr * .85) : q.moveTo(ch.x + ox + Math.cos(a) * rr, ch.y + oy + Math.sin(a) * rr * .85); });
      q.closePath();
    };
    for (const ch of vis) {
      const base = ch.rock ? '#8a857c' : L.ore, dk = ch.rock ? '#55514a' : L.dark, lt = ch.rock ? '#b2ada3' : L.light;
      // shadow, body, a lit top face and a dark lower edge, like a lump of rock lit from the top left
      q.fillStyle = 'rgba(20,14,8,.4)'; poly(ch, 1.2, 1.8, 1); q.fill();
      q.fillStyle = dk; poly(ch, 0, .6, 1); q.fill();
      q.fillStyle = base; poly(ch, 0, 0, .92); q.fill();
      q.fillStyle = lt; q.globalAlpha = .55; poly(ch, -ch.r * .22, -ch.r * .26, .45); q.fill(); q.globalAlpha = 1;
      if (ch.rock && (p.ore === 'gold' || p.ore === 'diamond')) {
        // ore showing through a plain rock: a vein or a crystal
        q.fillStyle = L.ore; q.beginPath(); q.arc(ch.x + ch.r * .15, ch.y + ch.r * .1, ch.r * .32, 0, 7); q.fill();
      }
    }
    art = { show, c }; patchArt.set(p, art);
  }
  g.drawImage(art.c, p.x - R, p.y - R, R * 2, R * 2);
  // gold and diamonds glint now and then
  const L = PATCH_LOOK[p.ore];
  if (L.glint && t) {
    let seed = (p.seed || 1) + 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * p.r * .7 * Math.min(1, p.left / p.max + .2), ph = rnd() * 10, k = Math.max(0, Math.sin(t * 1.7 + ph));
      if (k < .85) continue;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, z = (k - .85) / .15 * 4;
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - z, y); g.lineTo(x + z, y); g.moveTo(x, y - z); g.lineTo(x, y + z); g.stroke();
    }
  }
}
/** The newer buildings, each on one tile. t > 0 animates them. */
function paintBld(g: CanvasRenderingContext2D, x: number, y: number, b: Bld, t: number) {
  g.save(); g.translate(x, y);
  const [dx, dy] = DIRS[b.d];
  if (b.type === 'pipe' || b.type === 'pump') {
    g.fillStyle = '#4f7fa6'; g.beginPath(); g.arc(0, 0, b.type === 'pump' ? 10 : 5, 0, 7); g.fill();
    if (b.type === 'pump') { g.fillStyle = '#9fd4ff'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); g.strokeStyle = '#2d4e6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); g.stroke(); }
    else { g.fillStyle = '#9fd4ff'; g.beginPath(); g.arc(0, 0, 2.5, 0, 7); g.fill(); }
    g.restore(); return;
  }
  if (b.type === 'pole') {
    // a wooden pole with a cross-arm
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(3, 5, 5, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#7c5631'; g.fillRect(-2, -10, 4, 16);
    g.fillStyle = '#5e3f22'; g.fillRect(-8, -9, 16, 3);
    g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(-6.5, -10, 1.6, 0, 7); g.arc(6.5, -10, 1.6, 0, 7); g.fill();
    g.restore(); return;
  }
  if (b.type === 'drill') { paintDrill(g, dx, dy, b.on === false ? 0 : t, b.on !== false && t > 0); g.restore(); return; }
  if (b.type === 'tunnel') {
    g.fillStyle = '#3a3330'; g.fillRect(-11, -11, 22, 22);
    g.fillStyle = '#15110f'; g.beginPath(); g.arc(dx * 3, dy * 3, 7, 0, 7); g.fill();
    g.strokeStyle = '#ffcf8c'; g.lineWidth = 2; g.beginPath(); g.moveTo(-dx * 8 - dy * 4, -dy * 8 - dx * 4); g.lineTo(-dx * 3, -dy * 3); g.lineTo(-dx * 8 + dy * 4, -dy * 8 + dx * 4); g.stroke();
    g.restore(); return;
  }
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-9, -7, 22, 20);
  const body = { furnace: '#6e5e55', gen: '#4a4f58', asm: '#5a6a7a', hub: '#55606a' } as Record<string, string>;
  g.fillStyle = body[b.type] ?? '#666'; g.fillRect(-11, -11, 22, 22);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.strokeRect(-11, -11, 22, 22);
  if (b.type === 'furnace') {
    // a stone furnace: rough stone blocks, a dark top and an arched mouth that glows while it smelts
    g.fillStyle = '#8a7b6c'; g.fillRect(-11, -11, 22, 22);
    g.strokeStyle = 'rgba(40,30,24,.55)'; g.lineWidth = 1;
    for (let r = 0; r < 4; r++) {
      const yy = -11 + r * 5.5; g.beginPath(); g.moveTo(-11, yy); g.lineTo(11, yy); g.stroke();
      for (let c = r % 2 ? -5.5 : -8; c < 11; c += 7) { g.beginPath(); g.moveTo(c, yy); g.lineTo(c, yy + 5.5); g.stroke(); }
    }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-11, -11, 22, 2);
    g.strokeStyle = '#3c3229'; g.lineWidth = 1.5; g.strokeRect(-11, -11, 22, 22);
    const hot = b.inp > 0 ? .7 + Math.sin(t * 8) * .25 : .12;
    g.fillStyle = '#231a14'; g.beginPath(); g.moveTo(-6, 9); g.lineTo(-6, 1); g.arc(0, 1, 6, Math.PI, 0); g.lineTo(6, 9); g.closePath(); g.fill();
    const fire = g.createRadialGradient(0, 6, 1, 0, 5, 8); fire.addColorStop(0, `rgba(255,230,120,${hot})`); fire.addColorStop(.6, `rgba(255,120,40,${hot * .8})`); fire.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = fire; g.beginPath(); g.moveTo(-5, 9); g.lineTo(-5, 2); g.arc(0, 2, 5, Math.PI, 0); g.lineTo(5, 9); g.closePath(); g.fill();
    g.fillStyle = '#4a3d33'; g.fillRect(-4, -9, 8, 4);
    if (b.inp > 0) { g.fillStyle = 'rgba(200,200,200,.35)'; g.beginPath(); g.arc(Math.sin(t * 2) * 2, -12 - (t * 8) % 6, 2.5, 0, 7); g.fill(); }
  } else if (b.type === 'gen') {
    g.fillStyle = b.fuel > 0 ? '#ffd76a' : '#7a7a70';
    g.beginPath(); g.moveTo(2, -8); g.lineTo(-5, 1); g.lineTo(0, 1); g.lineTo(-2, 8); g.lineTo(5, -1); g.lineTo(0, -1); g.closePath(); g.fill();
  } else if (b.type === 'asm') {
    g.save(); g.rotate(b.t > 0 ? t * 3 : 0);
    g.fillStyle = '#c9d3dc'; for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillRect(-1.8, -8, 3.6, 4); }
    g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); g.fillStyle = '#5a6a7a'; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill();
    g.restore();
  } else if (b.type === 'hub') {
    g.fillStyle = '#ffcf8c'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
    g.fillStyle = '#55606a'; g.font = '700 9px Jost, sans-serif'; g.textAlign = 'center'; g.fillText('R', 0, 3.5);
  }
  if (b.type === 'furnace' || b.type === 'asm') { g.fillStyle = '#ffcf8c'; g.beginPath(); g.moveTo(dx * 12, dy * 12); g.lineTo(dx * 8 - dy * 4, dy * 8 - dx * 4); g.lineTo(dx * 8 + dy * 4, dy * 8 + dx * 4); g.fill(); }
  g.restore();
}
/** A mining drill, drawn at the origin facing (dx, dy): a heavy weathered housing with bolted corners, two pumping
 *  pistons, a spiral cutter turning in a dark well, an output chute with hazard stripes, and dust while it digs. */
function paintDrill(g: CanvasRenderingContext2D, dx: number, dy: number, t: number, on: boolean) {
  const S = 12, cut = 3.5;
  const oct = (r: number, c: number) => { g.beginPath(); g.moveTo(-r + c, -r); g.lineTo(r - c, -r); g.lineTo(r, -r + c); g.lineTo(r, r - c); g.lineTo(r - c, r); g.lineTo(-r + c, r); g.lineTo(-r, r - c); g.lineTo(-r, -r + c); g.closePath(); };
  // shadow
  g.fillStyle = 'rgba(0,0,0,.32)'; g.save(); g.translate(2.5, 3); oct(S, cut); g.fill(); g.restore();
  // the chute, under the housing, pointing out the front
  g.save(); g.rotate(Math.atan2(dy, dx));
  g.fillStyle = '#3b3a35'; g.beginPath(); g.moveTo(8, -6); g.lineTo(15, -4.5); g.lineTo(15, 4.5); g.lineTo(8, 6); g.closePath(); g.fill();
  g.save(); g.beginPath(); g.rect(12, -4.5, 3, 9); g.clip();
  for (let i = -3; i < 4; i++) { g.fillStyle = i % 2 ? '#e2b12f' : '#1c1b18'; g.beginPath(); g.moveTo(12, i * 2.6); g.lineTo(15, i * 2.6 - 2); g.lineTo(15, i * 2.6 + .6); g.lineTo(12, i * 2.6 + 2.6); g.fill(); }
  g.restore();
  g.fillStyle = '#16150f'; g.fillRect(14.2, -3, .8, 6);
  // pistons on both sides, pumping while it digs
  const pump = on ? Math.sin(t * 9) * 1.4 : 0;
  for (const sd of [-1, 1]) {
    g.fillStyle = '#2d2c28'; g.fillRect(-7, sd * 11 - 2.2, 12, 4.4);
    g.fillStyle = '#b9b6a8'; g.fillRect(-4 + pump * sd, sd * 11 - 1.1, 7, 2.2);
    g.fillStyle = '#5c5a50'; g.fillRect(-8, sd * 11 - 2.6, 3, 5.2);
  }
  g.restore();
  // the housing: weathered metal plate with chamfered corners
  const hg = g.createLinearGradient(-S, -S, S, S); hg.addColorStop(0, '#8e8b78'); hg.addColorStop(.55, '#6f6c5c'); hg.addColorStop(1, '#4c4a3f');
  g.fillStyle = hg; oct(S - 1, cut); g.fill();
  g.strokeStyle = '#26251f'; g.lineWidth = 1.4; g.stroke();
  // panel seams and a lighter top edge
  g.strokeStyle = 'rgba(30,28,22,.45)'; g.lineWidth = .8;
  g.beginPath(); g.moveTo(-S + 1, -4); g.lineTo(-7.5, -4); g.moveTo(7.5, -4); g.lineTo(S - 1, -4); g.moveTo(-S + 1, 4); g.lineTo(-7.5, 4); g.moveTo(7.5, 4); g.lineTo(S - 1, 4); g.stroke();
  g.strokeStyle = 'rgba(255,255,240,.18)'; g.beginPath(); g.moveTo(-S + cut, -S + 1.6); g.lineTo(S - cut, -S + 1.6); g.stroke();
  // rust and wear
  g.fillStyle = 'rgba(150,80,30,.28)'; g.beginPath(); g.ellipse(-7, 7.5, 2.6, 1.4, .5, 0, 7); g.ellipse(8, -8, 1.8, 1, -.4, 0, 7); g.ellipse(7.5, 8.5, 1.2, .8, 0, 0, 7); g.fill();
  // corner bolts
  for (const [bx, by] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
    g.fillStyle = '#2a2924'; g.beginPath(); g.arc(bx, by, 1.6, 0, 7); g.fill();
    g.fillStyle = '#b3af9c'; g.beginPath(); g.arc(bx - .4, by - .4, .8, 0, 7); g.fill();
  }
  // the well with a ring of teeth and the turning spiral cutter
  g.fillStyle = '#1b1a16'; g.beginPath(); g.arc(0, 0, 7.4, 0, 7); g.fill();
  g.strokeStyle = '#3e3c34'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 7.4, 0, 7); g.stroke();
  g.save(); g.rotate(t * 5);
  for (let i = 0; i < 3; i++) {
    g.rotate(Math.PI * 2 / 3);
    g.fillStyle = '#a7a493'; g.beginPath(); g.moveTo(1.2, -1); g.quadraticCurveTo(4.5, -4.2, 6.6, -1.2); g.lineTo(6.2, .6); g.quadraticCurveTo(4, -1.6, 1.2, 1.2); g.closePath(); g.fill();
    g.fillStyle = '#d8d4c0'; g.beginPath(); g.arc(6.4, -.4, .9, 0, 7); g.fill();
  }
  g.fillStyle = '#e2b12f'; g.beginPath(); g.arc(0, 0, 2.3, 0, 7); g.fill();
  g.fillStyle = '#5a4510'; g.beginPath(); g.arc(0, 0, .9, 0, 7); g.fill();
  g.restore();
  // dust kicked up at the ore while it digs
  if (on) for (let i = 0; i < 6; i++) {
    const ph = (t * 1.6 + i / 6) % 1, a = i * 2.1 + t * .7, r = 4 + ph * 9;
    g.fillStyle = `rgba(170,150,115,${.45 * (1 - ph)})`; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 1 + ph * 1.8, 0, 7); g.fill();
  }
}
/** A chest: a wooden box with a metal band. */
function paintChest(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-9, -7, 22, 20);
  g.fillStyle = '#8a5a2e'; g.fillRect(-11, -10, 22, 20);
  g.fillStyle = '#6a4222'; g.fillRect(-11, -3, 22, 3);
  g.fillStyle = '#c9a24a'; g.fillRect(-2.5, -4, 5, 6);
  g.strokeStyle = '#4a2e16'; g.lineWidth = 1.5; g.strokeRect(-11, -10, 22, 20);
  g.restore();
}
/** A turret: a round base with a barrel pointing at its last target. */
function paintTurret(g: CanvasRenderingContext2D, x: number, y: number, tu: Turret) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(2, 3, 11, 0, 7); g.fill();
  const brick = tu.kind === 'brick';
  g.fillStyle = brick ? '#a8503a' : tu.kind === 'rapid' ? '#6a5a3a' : tu.kind === 'rocket' ? '#4a5a4a' : '#5b6670'; g.fillRect(-11, -11, 22, 22);
  if (brick) { g.strokeStyle = '#7a3526'; g.lineWidth = 1; for (const yy of [-4, 3]) { g.beginPath(); g.moveTo(-11, yy); g.lineTo(11, yy); g.stroke(); } }
  if (tu.cool) { g.strokeStyle = '#9fd4ff'; g.lineWidth = 1.5; g.strokeRect(-12, -12, 24, 24); }
  g.fillStyle = '#7d8a95'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
  g.rotate(tu.face);
  const has = tAmmo(tu) > 1e-6;
  if (tu.kind === 'rapid') {
    // a crossbow on a turntable: a stock and a wide bow
    g.strokeStyle = '#5a3d22'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(15, 0); g.stroke();
    g.strokeStyle = '#2a1e12'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(11, -9); g.quadraticCurveTo(17, 0, 11, 9); g.stroke();
  } else if (tu.kind === 'rocket') {
    // two launch tubes
    g.fillStyle = '#2f363c'; g.fillRect(-2, -6, 17, 5); g.fillRect(-2, 1, 17, 5);
    if (has) { g.fillStyle = '#d64545'; g.fillRect(13, -5, 3, 3); g.fillRect(13, 2, 3, 3); }
  } else { g.fillStyle = '#2f363c'; g.fillRect(2, -2.5, 14, 5); }
  g.fillStyle = has ? '#e0b43a' : '#8a3a30'; g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.fill();
  g.restore();
}
/** A grabber: a turntable with an arm that swings from the back tile to the front tile. */
function paintGrabber(g: CanvasRenderingContext2D, x: number, y: number, gr: Grabber) {
  const s = TILE;
  g.save(); g.translate(x, y); g.rotate(gr.d * Math.PI / 2);
  g.fillStyle = '#4a5560'; g.fillRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
  g.strokeStyle = '#e0b43a'; g.lineWidth = 1.5; g.strokeRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
  // arm: points back while it waits, swings forward with a stone
  const k = gr.carry ? Math.min(1, gr.t / ST.grabTime) : 0, a = Math.PI * (1 - k);
  g.fillStyle = '#2a3036'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
  g.strokeStyle = '#c9d3dc'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); g.stroke();
  g.strokeStyle = '#e0b43a'; g.lineWidth = 2;
  const hx = Math.cos(a) * 15, hy = Math.sin(a) * 15;
  g.beginPath(); g.arc(hx, hy, 4, a - 1.2, a + 1.2); g.stroke();
  if (gr.carry) { g.fillStyle = STONE; g.beginPath(); g.arc(hx, hy, 4.5, 0, 7); g.fill(); if (gr.k !== 'stone') { g.fillStyle = KIND_DOT[gr.k]; g.beginPath(); g.arc(hx, hy, 2, 0, 7); g.fill(); } }
  // a small arrow showing which way it moves stone
  g.fillStyle = '#e0b43a'; g.beginPath(); g.moveTo(s / 2 - 3, 0); g.lineTo(s / 2 - 8, -4); g.lineTo(s / 2 - 8, 4); g.fill();
  g.restore();
}
/** A conveyor tile with moving chevrons pointing along direction d. */
function paintBelt(g: CanvasRenderingContext2D, x: number, y: number, d: number, t: number, k = 1) {
  const s = TILE * k;
  g.save(); g.translate(x, y); g.rotate(d * Math.PI / 2);
  g.fillStyle = '#3b3f45'; g.fillRect(-s / 2, -s / 2, s, s);
  g.fillStyle = '#2a2d31'; g.fillRect(-s / 2, -s / 2, s, s * .14); g.fillRect(-s / 2, s / 2 - s * .14, s, s * .14);
  g.beginPath(); g.rect(-s / 2, -s / 2, s, s); g.clip();
  g.strokeStyle = '#e0b43a'; g.lineWidth = 2 * k;
  const off = (t * ST.beltSpeed * k) % (s / 2);
  for (let i = -1; i < 2; i++) { const cx = -s / 2 + i * s / 2 + off; g.beginPath(); g.moveTo(cx - s * .12, -s * .2); g.lineTo(cx + s * .08, 0); g.lineTo(cx - s * .12, s * .2); g.stroke(); }
  g.restore();
}
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const trim = (n: number) => String(Math.round(n * 100) / 100);
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const easeInOut = (k: number) => k * k * (3 - 2 * k);
function approachAngle(a: number, b: number, step: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
