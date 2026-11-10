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
  bearHp: 10.5,
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
  waveStart: 480,       // huge waves start after 8 minutes
  waveEvery: 300,       // then one every 5 minutes (13, 18, 23 minutes...)
  moreGates: 480,       // after 8 minutes gates open on the other 3 sides
  allGates: 1200,       // after 20 minutes 3 more gates open and bears come from everywhere
  gateWaitLate: 40,     // ...and from then on bears take 40 seconds to get in
  spawnerHp: 100,
  spawnerMin: 4, spawnerMax: 6,
  spawnerFar: 4,
  spawnerBack: 30,      // a destroyed spawner comes back somewhere else after 30 seconds        // spawners are 4 times as far out as they first were
  spawnEvery: 5,        // each spawner makes a bear every 5 seconds
  spawnEarly: 50,       // ...but only one every 50 seconds for the first 15 minutes
  earlyTime: 900,
  maxBears: 6,          // ...while there are fewer than 6 bears on the map (huge waves come on top)
  chaseRange: 130,      // a bear outside goes for you when you walk this close
  oreMineCost: { iron: { stone: 100 }, copper: { stone: 100, iron: 75 }, gold: { stone: 125, iron: 100, copper: 50 }, diamond: { stone: 150, iron: 100, copper: 75, gold: 50 } } as Record<Ore, Cost>,
  rapidCost: { stone: 50, iron: 10 } as Cost, // a rapid crossbow
  rapidDamage: .75, rapidReload: .05, rapidUse: .008, // 0.8% of one ammo a shot
  rocketCost: { stone: 40, iron: 20 } as Cost,    // a rocket launcher
  rocketDamage: 70, rocketReload: 3, rocketRange: 620, rocketSpeed: 300,
  rocketStone: 10,      // stone for one rocket in the machine
  waveSize: 12,         // bears in the first huge wave
  waveGrow: 2,          // each wave after that has 2 more
  bearSpeed: 20,        // slow
  bearSpeedInside: 26,
};

/** Things the labs can research, cheapest first. */
export const RESEARCH = [
  { id: 'sharp', name: 'Sharper bolts', desc: 'Your crossbow does 25% more damage', cost: 20 },
  { id: 'string', name: 'Tighter string', desc: 'Your crossbow reloads 20% faster', cost: 25 },
  { id: 'belts', name: 'Quick belts', desc: 'Belts move 50% faster', cost: 30 },
  { id: 'grab', name: 'Nimble grabbers', desc: 'Grabbers move stone twice as fast', cost: 35 },
  { id: 'picks', name: 'Strong picks', desc: 'You and your miners dig 30% faster', cost: 40 },
  { id: 'packed', name: 'Packed ammo', desc: 'Machines make 7 stone ammo per stone instead of 5', cost: 50 },
  { id: 'range', name: 'Long-range turrets', desc: 'Turrets reach 30% farther', cost: 60 },
  { id: 'heavy', name: 'Heavy turret bolts', desc: 'Turrets do 40% more damage', cost: 70 },
  { id: 'armor', name: 'Leather armor', desc: 'Bears hurt you 25% less', cost: 85 },
  { id: 'heal', name: 'Fast healing', desc: 'Heal 2% a second instead of 1.2%', cost: 100 },
  { id: 'rapid', name: 'Rapid crossbow', desc: 'Unlocks the rapid crossbow recipe (10 iron, 50 stone): 0.75 damage every 0.05 s', cost: 60 },
  { id: 'rocket', name: 'Rocket launcher', desc: 'Unlocks the rocket launcher (70 damage) and the rocket ammo recipe in machines', cost: 80 },
] as const;
type ResId = typeof RESEARCH[number]['id'];
/** Numbers that research can change; reset at the start of each run. */
const ST = { beltSpeed: 0, grabTime: 0, mineEvery: 0, minerEvery: 0, batchAmmo: 0, turretRange: 0, turretDamage: 0, heal: 0, boltMul: 1, reloadMul: 1, armor: 1 };
function resetStats() {
  Object.assign(ST, { beltSpeed: SURVIVAL.beltSpeed, grabTime: SURVIVAL.grabTime, mineEvery: SURVIVAL.mineEvery, minerEvery: SURVIVAL.minerEvery, batchAmmo: SURVIVAL.batchAmmo, turretRange: SURVIVAL.turretRange, turretDamage: SURVIVAL.turretDamage, heal: SURVIVAL.heal, boltMul: 1, reloadMul: 1, armor: 1 });
}
function applyResearch(id: ResId) {
  if (id === 'sharp') ST.boltMul = 1.25;
  else if (id === 'string') ST.reloadMul = .8;
  else if (id === 'belts') ST.beltSpeed = SURVIVAL.beltSpeed * 1.5;
  else if (id === 'grab') ST.grabTime = SURVIVAL.grabTime / 2;
  else if (id === 'picks') { ST.mineEvery = SURVIVAL.mineEvery * .7; ST.minerEvery = SURVIVAL.minerEvery * .7; }
  else if (id === 'packed') ST.batchAmmo = 7;
  else if (id === 'range') ST.turretRange = SURVIVAL.turretRange * 1.3;
  else if (id === 'heavy') ST.turretDamage = SURVIVAL.turretDamage * 1.4;
  else if (id === 'armor') ST.armor = .75;
  else if (id === 'heal') ST.heal = .02;
  // rapid and rocket unlock things in the shop and the machine; see this.done
}
resetStats();

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
const insideBase = (x: number, y: number) => x > WALL.x0 && x < WALL.x1 && y > WALL.y0 && y < WALL.y1;
const GUY_R = 13, BEAR_R = 18, STONE = '#a9a59c';
// belts sit on a grid inside the walls
// the grid covers the biggest base; only tiles inside the current walls can be used
const BIGGEST = EXPANSIONS[EXPANSIONS.length - 1];
const TILE = 24, GX0 = BIGGEST.x0 + WALL.t, GY0 = BIGGEST.y0 + WALL.t;
const COLS = Math.floor((BIGGEST.x1 - WALL.t - GX0) / TILE), ROWS = Math.floor((BIGGEST.y1 - WALL.t - GY0) / TILE);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const; // right, down, left, up
/** Something on the ground or a belt: a stone, or (ammo) a piece of stone ammo from the machine. */
export type Ore = 'iron' | 'copper' | 'gold' | 'diamond';
const ORES: Ore[] = ['iron', 'copper', 'gold', 'diamond'];
/** Ammo you can shoot or load into turrets: stone ammo ('ammo') or metal ammo. */
type AmmoKind = 'ammo' | 'ironAmmo' | 'copperAmmo' | 'goldAmmo' | 'diamondAmmo';
type Kind = 'stone' | 'brick' | 'pack' | Ore | AmmoKind | 'rocket';
/** Each metal put in a machine makes this much ammo, and each shot does this much damage. Diamonds are our own guess. */
export const METAL: Record<Ore, { per: number; dmg: number; ammo: AmmoKind; name: string; color: string }> = {
  iron: { per: 6, dmg: 9.5, ammo: 'ironAmmo', name: 'Iron', color: '#c9ccd2' },
  copper: { per: 8, dmg: 8.55, ammo: 'copperAmmo', name: 'Copper', color: '#e08a4a' },
  gold: { per: 12, dmg: 11.5, ammo: 'goldAmmo', name: 'Gold', color: '#ffd34a' },
  diamond: { per: 16, dmg: 15, ammo: 'diamondAmmo', name: 'Diamond', color: '#8ff0ff' },
};
/** Best ammo first: turrets and the auto-pick use them in this order. */
const AMMO_KINDS: AmmoKind[] = ['diamondAmmo', 'goldAmmo', 'ironAmmo', 'copperAmmo', 'ammo'];
const AMMO_NAME: Record<AmmoKind, string> = { ammo: 'Stone', ironAmmo: 'Iron', copperAmmo: 'Copper', goldAmmo: 'Gold', diamondAmmo: 'Diamond' };
const metalOf = (a: AmmoKind) => METAL[ORES.find(o => METAL[o].ammo === a)!];
export const costText = (c: Cost) => (Object.entries(c) as [keyof Cost, number][]).map(([k, n]) => `${n} ${k === 'brick' ? 'bricks' : k === 'diamond' ? 'diamonds' : k}`).join(' + ');
const isAmmoKind = (k: Kind): k is AmmoKind => (AMMO_KINDS as Kind[]).includes(k);
type Cost = Partial<Record<'stone' | 'brick' | Ore, number>>;
type RecCat = 'logistics' | 'production' | 'combat' | 'science';
interface Recipe { id: string; cat: RecCat; name: string; makes: string; desc: string; cost: Cost; ok?: boolean; locked?: boolean; craft: () => void; }
const REC_CATS: Record<RecCat, [string, string]> = { logistics: ['⏩', 'Logistics'], production: ['⛏️', 'Production'], combat: ['🏹', 'Combat'], science: ['🧪', 'Science'] };
interface Item { x: number; y: number; gone?: boolean; k: Kind; skip?: string; }
const KINDS: Kind[] = ['rocket', ...AMMO_KINDS, 'pack', 'brick', ...ORES, 'stone'];
/** A bag of things: your pocket, or what a chest holds. */
type Bag = Record<Kind, number>;
const emptyBag = (): Bag => Object.fromEntries(KINDS.map(k => [k, 0])) as Bag;
type Chest = Bag;
const chestN = (ch: Bag) => KINDS.reduce((a, k) => a + ch[k], 0);
const KIND_NAME: Record<Kind, string> = { stone: 'stone', brick: 'bricks', pack: 'packs', iron: 'iron', copper: 'copper', gold: 'gold', diamond: 'diamonds', ammo: 'stone ammo', ironAmmo: 'iron ammo', copperAmmo: 'copper ammo', goldAmmo: 'gold ammo', diamondAmmo: 'diamond ammo', rocket: 'rockets' };
/** A grabber picks stone up from the tile behind it and puts it down on the tile in front. */
interface Grabber { d: number; t: number; carry: boolean; k: Kind; }
/** A turret shoots the nearest bear or spawner in range (or the one you picked), one ammo a shot.
 *  kind: a plain turret, a brick turret, a rapid crossbow or a rocket launcher (which only takes rockets). */
type TKind = 'turret' | 'brick' | 'rapid' | 'rocket';
interface Turret { ammo: Partial<Record<AmmoKind | 'rocket', number>>; cd: number; face: number; kind: TKind; cool?: boolean; target?: Target | null; }
const TNAME: Record<TKind, string> = { turret: 'turret', brick: 'brick turret', rapid: 'rapid crossbow', rocket: 'rocket launcher' };
const tAmmo = (tu: Turret) => Object.values(tu.ammo).reduce((a, n) => a + (n ?? 0), 0);
type BType = 'furnace' | 'gen' | 'pump' | 'pipe' | 'asm' | 'tunnel' | 'hub';
const KIND_ICON: Record<Kind, string> = { stone: '🪨', brick: '🧱', pack: '🧪', iron: '🔩', copper: '🟠', gold: '🪙', diamond: '💎', ammo: '➶', ironAmmo: '➶', copperAmmo: '➶', goldAmmo: '➶', diamondAmmo: '➶', rocket: '🚀' };
type Placeable = 'belt' | 'short' | 'grab' | 'turret' | 'split' | 'chest' | 'mine' | 'machine' | 'lab' | 'bturret' | 'rapid' | 'rocket' | Ore | BType;
const BTYPES: BType[] = ['furnace', 'gen', 'pump', 'pipe', 'asm', 'tunnel', 'hub'];
const BNAME: Record<BType, string> = { furnace: 'Furnace', gen: 'Generator', pump: 'Pump', pipe: 'Pipe', asm: 'Assembler', tunnel: 'Underground belt', hub: 'Robot hub' };
/** Inventory slots for things you place: icon, name, hotkey (in the order they show). */
const PLACE_INFO: Record<Placeable, [string, string, string]> = {
  belt: ['⏩', 'Long belt', 'E'], short: ['▶️', 'Short belt', 'Q'], grab: ['🦾', 'Grabber', 'G'], split: ['🔀', 'Splitter', 'X'], tunnel: ['🕳️', 'Underground belt', 'D'], chest: ['📦', 'Chest', 'C'],
  hub: ['🤖', 'Robot hub', 'O'], pump: ['🚰', 'Water pump', 'W'], pipe: ['🔧', 'Pipe', 'I'],
  mine: ['⛏️', 'Stone mine', 'N'], iron: ['🔩', 'Iron mine', '1'], copper: ['🟠', 'Copper mine', '2'], gold: ['🪙', 'Gold mine', '3'], diamond: ['💎', 'Diamond mine', '4'],
  machine: ['⚙️', 'Machine', 'K'], furnace: ['🔥', 'Furnace', 'F'], gen: ['⚡', 'Generator', 'V'], asm: ['🏭', 'Assembler', 'A'], lab: ['🔬', 'Lab', 'L'],
  turret: ['🏹', 'Turret', 'U'], bturret: ['🏰', 'Brick turret', 'J'], rapid: ['💨', 'Rapid crossbow', '5'], rocket: ['🚀', 'Rocket launcher', '6'],
};
/** One of the newer one-tile buildings. inp: stone waiting (or fuel stone), out: things made and waiting. */
interface Bld { type: BType; d: number; inp: number; out: number; t: number; fuel: number; recipe: 'pack' | 'belt'; robots: number; }
/** A flying robot that carries one thing from a chest to whatever needs it. */
interface Robot { x: number; y: number; hub: string; k: Kind | null; src: { x: number; y: number; take: () => boolean; kind?: Kind } | null; dst: { x: number; y: number; give: () => boolean; id: string } | null; }
const KIND_DOT: Record<Kind, string> = { stone: '#d0ccc2', ammo: '#7fc8ff', brick: '#d97a5a', pack: '#7fd6c2', iron: METAL.iron.color, copper: METAL.copper.color, gold: METAL.gold.color, diamond: METAL.diamond.color, ironAmmo: METAL.iron.color, copperAmmo: METAL.copper.color, goldAmmo: METAL.gold.color, diamondAmmo: METAL.diamond.color, rocket: '#ff6a4a' };
/** A lab and the science packs in it. */
interface Lab { packs: number; t: number; }
/** A splitter takes stone in and sends it out to its left and right in turn. */
interface Splitter { d: number; buf: Kind[]; side: number; t: number; }
// where hired miners stand, relative to the mine
const MINER_SPOTS = [[-4, 30], [32, 22], [-30, 26], [36, -8], [8, -32], [-32, -14]] as const;
const MINE_R = 24, MACHINE_R = 26, NEAR = 58;
const FIRST_MINE = { x: BASE_WALL.x0 + 62, y: BASE_WALL.y0 + 95 }, FIRST_MACHINE = { x: BASE_WALL.x1 - 62, y: BASE_WALL.y0 + 215 };
interface Spot { x: number; y: number; r: number; }
/** A mine: stone, or one of the metals. */
interface Mine extends Spot { ore: 'stone' | Ore; }
/** A machine and its work: raw stone and metal waiting, the batch timer, things made waiting for a grabber,
 *  and its recipe for stone: stone ammo, or (once researched) a rocket from 10 stone. */
interface Machine extends Spot { queue: Kind[]; batchT: number; out: Kind[]; recipe: 'ammo' | 'rocket'; }
/** Everything big in the camp (shop, mines, machines), which belts can't go on. Kept up to date by the game. */
let structs: Spot[] = [];

/** walk: to a spot outside its gate; wait: there; enter: through the gate; chase: after you, anywhere. */
type BearState = 'walk' | 'wait' | 'enter' | 'chase' | 'dead';
interface Bear { tc: number; id: number; x: number; y: number; hp: number; state: BearState; wait: number; tx: number; ty: number; cd: number; face: number; swipe: number; hurt: number; dead: number; step: number; gate: Gate; wave: boolean; }
/** A bear spawner in the woods: a den that makes bears. */
/** respawn: seconds until a destroyed spawner comes back somewhere else. */
interface Spawner { x: number; y: number; hp: number; t: number; hurt: number; dead: boolean; respawn?: number; }
type Target = Bear | Spawner;
const isBear = (t: Target): t is Bear => 'state' in t;
const alive = (t: Target) => isBear(t) ? t.state !== 'dead' : !t.dead;
const SPAWNER_R = 26;
/** Things that take up a big round spot (mines and machines), not a tile. */
const isBig = (p: Placeable) => p === 'mine' || p === 'machine' || ORES.includes(p as Ore);
/** A gate in the fence: which side, and where along it (0 to 1). */
interface Gate { side: 0 | 1 | 2 | 3; at: number; open: number; }
interface Bolt { stone: boolean; x: number; y: number; vx: number; vy: number; left: number; dmg: number; target: Target | null; color?: string; }
/** A rocket swirls round a loop, then homes in on its target. */
interface Rocket { x: number; y: number; a: number; t: number; spin: number; target: Target; trail: { x: number; y: number }[]; }
interface Rock { x: number; y: number; vx: number; vy: number; left: number; spin: number; }
interface Bubble { x: number; y: number; text: string; t: number; kind: 'loss' | 'dmg' | 'info'; }

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
  private bag: Bag = emptyBag(); private useAmmo: AmmoKind | null = null;
  private invT = { rapid: 0, rocket: 0 }; private invOre: Record<Ore, number> = { iron: 0, copper: 0, gold: 0, diamond: 0 };
  private recipeFor: Machine | null = null;
  private keys = new Set<string>();
  private stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private scale = 1; private ox = 0; private oy = 0; private cw = 0;
  private decor: { x: number; y: number; r: number; k: number }[] = [];
  private noTargetT = 0;
  private rocks: Rock[] = [];
  private gateWait = SURVIVAL.gateWait;
  private mineOn = false; private mining = false; private mineT = 0; private swing = 0;
  private belts = new Map<string, number>(); private items: Item[] = []; private inv = 0; private placing = false; private placeDir = 0;
  private invGrab = 0; private placeType: Placeable = 'belt'; private invTurret = 0; private invShort = 0; private invSplit = 0; private invChest = 0; private splitters = new Map<string, Splitter>(); private chests = new Map<string, Chest>(); private mines: Mine[] = []; private machines: Machine[] = []; private mineAt: Mine | null = null; private expansion = 0; private invMine = 0; private invMachine = 0; private invLab = 0; private labs = new Map<string, Lab>(); private researching: ResId | null = null; private progress: Record<string, number> = {}; private done = new Set<ResId>(); labOpen = false; private blds = new Map<string, Bld>(); private invB: Record<BType, number> = { furnace: 0, gen: 0, pump: 0, pipe: 0, asm: 0, tunnel: 0, hub: 0 }; private invBTurret = 0; private brickGate = false; private robots: Robot[] = []; private robotT = 0; private coolT = 0; private tap: { id: number; x: number; y: number; t: number } | null = null; private turrets = new Map<string, Turret>(); private grabbers = new Map<string, Grabber>();
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
    btn('#svTarget', () => this.shoot(true));
    btn('#svFree', () => this.shoot(false));
    btn('#svPause', () => this.hooks.pause());
    btn('#svMine', () => this.action());
    btn('#svAmmoBtn', () => this.switchAmmo());
    btn('#svHire', () => this.hire());
    btn('#svShopBtn', () => this.openShop());
    btn('#svInv', () => this.togglePlacing('belt'));
    btn('#svInvGrab', () => this.togglePlacing('grab'));
    btn('#svInvTurret', () => this.togglePlacing('turret'));
    btn('#svInvShort', () => this.togglePlacing('short'));
    btn('#svInvSplit', () => this.togglePlacing('split'));
    btn('#svInvChest', () => this.togglePlacing('chest'));
    btn('#svInvMine', () => this.togglePlacing('mine'));
    btn('#svInvMachine', () => this.togglePlacing('machine'));
    btn('#svLoad', () => this.useNear());
    btn('#svInvLab', () => this.togglePlacing('lab'));
    for (const b of [...BTYPES, 'bturret'] as Placeable[]) btn('#svInv-' + b, () => this.togglePlacing(b));
    for (const b of ['rapid', 'rocket', ...ORES] as Placeable[]) btn('#svInv-' + b, () => this.togglePlacing(b));
    pad.querySelector('#svRecAmmo')!.addEventListener('click', e => { e.stopPropagation(); this.setRecipe('ammo'); });
    pad.querySelector('#svRecRocket')!.addEventListener('click', e => { e.stopPropagation(); this.setRecipe('rocket'); });
    pad.querySelector('#svRecPut')!.addEventListener('click', e => { e.stopPropagation(); const m = this.recipeFor; this.closeRecipe(); if (m) this.feedMachine(m); });
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
      if (this.recipeFor) { if (k === 'm' || k === 'Escape') this.closeRecipe(); else if (k === '1') this.setRecipe('ammo'); else if (k === '2') this.setRecipe('rocket'); return; }
      if (this.shopOpen) { if ((k === 'Shift' || k === 'b' || k === 'Escape') && !e.repeat) this.closeShop(); else if (k === 'Enter' && !e.repeat) this.craft(this.invSel); return; }
      if (k === 'Shift' || k === 'b') { if (!e.repeat) this.openShop(); return; }
      if (k === 'e') { if (!e.repeat) this.togglePlacing('belt'); return; }
      if (k === 'g') { if (!e.repeat) this.togglePlacing('grab'); return; }
      if (k === 'u') { if (!e.repeat) this.togglePlacing('turret'); return; }
      if (k === 'q') { if (!e.repeat) this.togglePlacing('short'); return; }
      if (k === 'x') { if (!e.repeat) this.togglePlacing('split'); return; }
      if (k === 'c') { if (!e.repeat) this.togglePlacing('chest'); return; }
      if (k === 'n') { if (!e.repeat) this.togglePlacing('mine'); return; }
      if (k === 'k') { if (!e.repeat) this.togglePlacing('machine'); return; }
      if (k === 'l') { if (!e.repeat) this.togglePlacing('lab'); return; }
      const dk = ({ '1': 'iron', '2': 'copper', '3': 'gold', '4': 'diamond', '5': 'rapid', '6': 'rocket' } as Record<string, Placeable>)[k];
      if (dk) { if (!e.repeat) this.togglePlacing(dk); return; }
      const bk = ({ f: 'furnace', v: 'gen', w: 'pump', i: 'pipe', a: 'asm', d: 'tunnel', o: 'hub', j: 'bturret' } as Record<string, Placeable>)[k];
      if (bk) { if (!e.repeat) this.togglePlacing(bk); return; }
      if (k === 'y') { if (!e.repeat) this.openLab(); return; }
      if (k === 't') { if (!e.repeat) this.useNear(); return; }
      if (k === 'r') { if (!e.repeat) this.rotate(); return; }
      if (this.placing && k === 'Enter') { const t = this.ghost(); if (t) this.placeAt(t.c, t.r); return; }
      if (this.placing && k === 'Escape') { this.placing = false; return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.shoot(true); return; }
      if (k === 'z') { if (!e.repeat) this.shoot(false); return; }
      if (k === 'p' || k === 'Escape') { this.hooks.pause(); return; }
      if (k === 'm') { if (!e.repeat) this.action(); return; }
      if (k === 's') { if (!e.repeat) this.switchAmmo(); return; }
      if (k === 'h') { if (!e.repeat) this.hire(); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); this.keys.add(k); }
    });
    addEventListener('keyup', e => this.keys.delete(e.key));
    addEventListener('blur', () => this.keys.clear());
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
      this.spawners.push({ x, y, hp: SURVIVAL.spawnerHp, t: 1 + i * 1.3, hurt: 0, dead: false });
    }
    this.camX = this.x; this.camY = this.y;
    this.rocks = []; this.gateWait = SURVIVAL.gateWait;
    this.mineOn = false; this.mining = false; this.mineT = 0; this.swing = 0; this.popT = 0; this.miners = [];
    this.belts.clear(); this.items = []; this.inv = 0; this.placing = false; this.placeDir = 0; this.hover = null; this.closeShop();
    this.invGrab = 0; this.placeType = 'belt'; this.grabbers.clear(); this.invTurret = 0; this.turrets.clear(); this.invShort = 0; this.tap = null; this.invSplit = 0; this.invChest = 0; this.splitters.clear(); this.chests.clear();
    this.mines = [{ ...FIRST_MINE, r: MINE_R, ore: 'stone' }]; this.machines = [{ ...FIRST_MACHINE, r: MACHINE_R, queue: [], batchT: 0, out: [], recipe: 'ammo' }]; this.mineAt = null;
    this.expansion = 0; Object.assign(WALL, BASE_WALL); this.rebuildWalls(); this.invMine = 0; this.invMachine = 0; this.updateStructs();
    this.bag = emptyBag(); this.useAmmo = null; this.invT = { rapid: 0, rocket: 0 }; this.invOre = { iron: 0, copper: 0, gold: 0, diamond: 0 }; this.closeRecipe();
    this.blds.clear(); for (const b of BTYPES) this.invB[b] = 0; this.invBTurret = 0; this.brickGate = false; this.robots = []; this.robotT = 0;
    this.invLab = 0; this.labs.clear(); this.researching = null; this.progress = {}; this.done.clear(); this.closeLab(); resetStats();
    this.running = true; this.paused = false;
    this.canvas.hidden = false; this.pad.hidden = false;
    this.say(`Bears are coming from ${n} spawners. Destroyed ones come back, so hold out as long as you can!`, 4);
  }
  /* ---------- save and load ---------- */
  /** Plain fields saved as they are. Maps, sets and things that point at each other are handled below. */
  private static SAVED = ['hp', 'x', 'y', 'face', 'reload', 't', 'healT', 'waveT', 'waveN', 'waveLeft', 'waveGap', 'waveWarned', 'nextId', 'kills', 'shots', 'hits', 'damage',
    'spawners', 'spawnerKills', 'gateStage', 'camX', 'camY', 'bag', 'useAmmo', 'invT', 'invOre', 'gateWait', 'mineOn', 'mineT', 'items', 'inv', 'placeDir',
    'invGrab', 'invTurret', 'invShort', 'invSplit', 'invChest', 'machines', 'expansion', 'invMine', 'invMachine', 'invLab', 'researching', 'progress', 'invB', 'invBTurret',
    'brickGate', 'robotT', 'miners', 'popT', 'load'] as const;
  /** Everything needed to carry on this run later, as plain JSON. */
  save(): SaveData {
    const me = this as unknown as Record<string, unknown>, o: Record<string, unknown> = { v: 1 };
    for (const k of Survival.SAVED) o[k] = me[k];
    o.gates = this.gates.map(g => ({ ...g, open: 0 }));
    o.bears = this.bears.filter(b => b.state !== 'dead').map(b => ({ ...b, gate: this.gates.indexOf(b.gate) }));
    o.mines = this.mines; o.mineAt = this.mineAt ? this.mines.indexOf(this.mineAt) : -1;
    o.done = [...this.done];
    o.turrets = [...this.turrets].map(([k, tu]) => [k, { ...tu, target: !tu.target || !alive(tu.target) ? null : isBear(tu.target) ? { bear: tu.target.id } : { spawner: this.spawners.indexOf(tu.target) } }]);
    for (const k of ['belts', 'splitters', 'chests', 'labs', 'blds', 'grabbers'] as const) o[k] = [...this[k]];
    // robots drop whatever they are carrying into your pocket
    o.robots = this.robots.map(r => ({ x: r.x, y: r.y, hub: r.hub, k: null, src: null, dst: null }));
    for (const r of this.robots) if (r.k) (o.bag as Bag)[r.k]++;
    return JSON.parse(JSON.stringify(o));
  }
  /** Carries on a saved run. */
  restore(d: SaveData) {
    this.start(d.load as Loadout);
    const me = this as unknown as Record<string, unknown>;
    for (const k of Survival.SAVED) if (k in d) me[k] = d[k];
    this.bag = { ...emptyBag(), ...(d.bag as Bag) };
    this.gates = d.gates as Gate[];
    this.bears = (d.bears as (Omit<Bear, 'gate'> & { gate: number })[]).map(b => ({ ...b, gate: this.gates[b.gate] ?? this.gates[0] }));
    this.mines = d.mines as Mine[]; this.mineAt = this.mines[d.mineAt as number] ?? null; this.mining = false;
    this.done = new Set(d.done as ResId[]);
    resetStats(); for (const id of this.done) applyResearch(id);
    this.turrets = new Map((d.turrets as [string, Turret & { target: { bear?: number; spawner?: number } | null }][]).map(([k, tu]) => {
      const tg = tu.target, target = !tg ? null : tg.bear !== undefined ? this.bears.find(b => b.id === tg.bear) ?? null : this.spawners[tg.spawner!] ?? null;
      return [k, { ...tu, target }];
    }));
    this.belts = new Map(d.belts as [string, number][]); this.splitters = new Map(d.splitters as [string, Splitter][]);
    this.chests = new Map((d.chests as [string, Chest][]).map(([k, c]) => [k, { ...emptyBag(), ...c }])); this.labs = new Map(d.labs as [string, Lab][]);
    this.blds = new Map(d.blds as [string, Bld][]); this.grabbers = new Map(d.grabbers as [string, Grabber][]);
    this.robots = d.robots as Robot[];
    Object.assign(WALL, EXPANSIONS[this.expansion]); this.rebuildWalls(); this.updateStructs(); this.coolT = 0;
    this.say('Game loaded', 2);
  }
  stop() { this.running = false; this.paused = false; this.canvas.hidden = true; this.pad.hidden = true; this.keys.clear(); this.stick = null; }

  /* ---------- input ---------- */
  private down(e: PointerEvent) {
    e.preventDefault();
    if (!this.running || this.paused || this.shopOpen || this.labOpen || this.recipeFor) return;
    const wx = (e.offsetX - this.ox) / this.scale, wy = (e.offsetY - this.oy) / this.scale;
    // placing a belt: tap the spot
    if (this.placing) { const t = tileAt(wx, wy); if (t) { this.placeAt(t.c, t.r); return; } }
    // a tap on the machine uses it
    if (this.mineOn) {
      const tm = this.machines.find(m => Math.hypot(wx - m.x, wy - m.y) < m.r + 10);
      if (tm) { this.useMachine(tm); return; }
    }
    // anywhere on the map works as a joystick: drag from where the finger lands
    this.stick = { id: e.pointerId, ox: e.offsetX, oy: e.offsetY, dx: 0, dy: 0 };
    this.tap = { id: e.pointerId, x: e.offsetX, y: e.offsetY, t: e.timeStamp };
  }
  private move(e: PointerEvent) {
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
  /** Space shoots at the nearest bear (or spawner) in range; Z shoots straight ahead with no target. */
  private shoot(targeted: boolean) {
    if (this.reload > 0) { Sound.click(); return; }
    let target: Target | null = null;
    if (targeted) {
      target = this.nearestTarget(this.x, this.y, SURVIVAL.targetRange);
      if (!target) {
        if (this.noTargetT <= 0) { this.bubble(this.x, this.y - 30, 'No bear in range', 'info'); this.noTargetT = 1.2; }
        Sound.denied();
        return;
      }
      this.face = Math.atan2(target.y - this.y, target.x - this.x);
    }
    const a = this.face, ammo = AMMO[this.load.ammo];
    // stone ammo: 1.7x normal damage; metal ammo does its own damage. Each shot uses one up.
    const use = this.useAmmo && this.bag[this.useAmmo] > 0 ? this.useAmmo : null;
    const dmg = (use === 'ammo' ? AMMO.normal.damage * SURVIVAL.stoneDamage : use ? metalOf(use).dmg : ammo.damage) * ST.boltMul;
    if (use) { this.bag[use]--; if (!this.bag[use]) { this.useAmmo = null; this.bubble(this.x, this.y - 30, `Out of ${AMMO_NAME[use].toLowerCase()} ammo`, 'info'); } }
    this.mining = false;
    this.bolts.push({ x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: SURVIVAL.boltRange, dmg, target, stone: !!use, color: use && use !== 'ammo' ? metalOf(use).color : undefined });
    this.reload = ammo.reload * ST.reloadMul;
    this.shots++;
    Sound.tone('triangle', 900, 260, .12, .14); Sound.noise(.08, 'highpass', 2400, .8, .1);
  }

  /** M: start or stop mining when next to the mine, or use the machine when next to it. */
  private action() {
    if (!this.mineOn) return;
    const mine = near(this.mines, this.x, this.y), mach = near(this.machines, this.x, this.y);
    if (mine) {
      this.mining = !this.mining; this.mineT = 0; this.mineAt = mine;
      if (this.mining) this.face = Math.atan2(mine.y - this.y, mine.x - this.x);
      Sound.ui();
    } else if (mach) this.useMachine(mach);
    else this.bubble(this.x, this.y - 30, 'Walk to a mine or a machine', 'info');
  }
  private rebuildWalls() { this.walls = wallRects(this.gates); }
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
  /** Tapping the machine: once rockets are researched it opens the recipe picker; otherwise it takes your stone and metal. */
  private useMachine(m: Machine) {
    if (dist(this.x, this.y, m.x, m.y) > NEAR) { this.bubble(m.x, m.y - 36, 'Walk to the machine', 'info'); Sound.denied(); return; }
    if (this.done.has('rocket')) { this.openRecipe(m); return; }
    this.feedMachine(m);
  }
  /** The machine takes all your stone and metal. Each stone is a batch of stone ammo (or 10 stone make a rocket);
   *  each iron, copper, gold or diamond is a batch of that metal's ammo. */
  private feedMachine(m: Machine) {
    const n = this.bag.stone + ORES.reduce((a, o) => a + this.bag[o], 0);
    if (!n) { this.bubble(m.x, m.y - 36, 'No stone or metal to put in', 'info'); Sound.denied(); return; }
    // a machine works on one material at a time: it only takes more of what is already in it
    const k = (['stone', ...ORES] as Kind[]).find(x => this.bag[x] > 0 && this.machineTakes(m, x));
    if (!k) { const inside = KIND_NAME[m.queue[0]]; this.bubble(m.x, m.y - 36, `This machine is busy with ${inside}. It only takes ${inside} until it's done`, 'info'); Sound.denied(); return; }
    this.bubble(m.x, m.y - 36, `${this.bag[k]} ${KIND_NAME[k]} in`, 'info');
    for (let i = 0; i < this.bag[k]; i++) m.queue.push(k);
    this.bag[k] = 0;
    Sound.thump();
  }
  /** A machine only takes one material at a time: anything while it's empty, then only more of the same. */
  private machineTakes(m: Machine, k: Kind) { return (k === 'stone' || ORES.includes(k as Ore)) && (!m.queue.length || m.queue[0] === k); }
  private openRecipe(m: Machine) {
    this.recipeFor = m; this.stick = null; this.keys.clear(); this.mining = false;
    this.renderRecipe();
    this.pad.querySelector<HTMLElement>('#svRecipe')!.hidden = false;
    Sound.ui();
  }
  private renderRecipe() {
    const m = this.recipeFor; if (!m) return;
    this.pad.querySelector('#svRecAmmo')!.setAttribute('aria-checked', String(m.recipe === 'ammo'));
    this.pad.querySelector('#svRecRocket')!.setAttribute('aria-checked', String(m.recipe === 'rocket'));
    const n = this.bag.stone + ORES.reduce((a, o) => a + this.bag[o], 0);
    (this.pad.querySelector('#svRecPut') as HTMLButtonElement).disabled = !n;
  }
  private setRecipe(r: Machine['recipe']) { if (this.recipeFor) { this.recipeFor.recipe = r; Sound.click(); this.renderRecipe(); } }
  private closeRecipe() { this.recipeFor = null; this.pad.querySelector<HTMLElement>('#svRecipe')!.hidden = true; }
  /** What one batch of this raw thing makes in a machine: [kind, how many]. */
  private batchOf(m: Machine, k: Kind): [Kind, number] {
    if (k === 'stone') return m.recipe === 'rocket' ? ['rocket', 1] : ['ammo', ST.batchAmmo];
    const o = k as Ore; return [METAL[o].ammo, METAL[o].per];
  }
  /* ---------- shop, inventory and belts ---------- */
  /** The inventory screen (Shift): what you carry on the left, crafting recipes in tabs on the right. */
  private openShop() {
    this.shopOpen = true; this.stick = null; this.keys.clear(); this.mining = false; this.placing = false; this.invSig = '';
    const sh = this.pad.querySelector<HTMLElement>('#svShop')!;
    this.renderShop();
    sh.hidden = false;
    Sound.ui();
  }
  private closeShop() { this.shopOpen = false; this.pad.querySelector<HTMLElement>('#svShop')!.hidden = true; }
  private invTab: RecCat = 'logistics'; private invSel = 'belt'; private invSig = '';
  private recipes(): Recipe[] {
    const S = SURVIVAL, st = (n: number): Cost => ({ stone: n });
    const cb = (b: BType | 'bturret' | 'robot' | 'gate'): Cost => { const [s1, br] = this.costB(b), c: Cost = {}; if (s1) c.stone = s1; if (br) c.brick = br; return c; };
    const maxed = this.expansion >= S.expandCosts.length;
    const r: Recipe[] = [
      { id: 'belt', cat: 'logistics', name: 'Long belt', makes: '1 long belt (3 tiles)', desc: 'Carries stone (and you). E to place, R turns it.', cost: st(S.beltCost), craft: () => this.buyBelt() },
      { id: 'short', cat: 'logistics', name: 'Short belts', makes: '3 short belts', desc: 'One-tile belts for corners and gaps. Q to place.', cost: st(S.shortBeltCost), craft: () => this.buyShort() },
      { id: 'grab', cat: 'logistics', name: 'Grabber', makes: '1 grabber', desc: 'Moves things from behind it to in front, e.g. into a chest, or ammo out of a machine. G to place.', cost: st(S.grabberCost), craft: () => this.buyGrabber() },
      { id: 'split', cat: 'logistics', name: 'Splitter', makes: '1 splitter', desc: 'Sends things left and right in turn. X to place.', cost: st(S.splitterCost), craft: () => this.buy('split') },
      { id: 'tunnel', cat: 'logistics', name: 'Underground belts', makes: '2 underground belts', desc: 'Things go in one and come out the next one ahead, up to 6 tiles, under anything. D to place.', cost: cb('tunnel'), craft: () => this.buyB('tunnel') },
      { id: 'chest', cat: 'logistics', name: 'Chest', makes: '1 chest', desc: 'Holds 200 things. T takes them out, or a grabber. C to place.', cost: st(S.chestCost), craft: () => this.buy('chest') },
      { id: 'hub', cat: 'logistics', name: 'Robot hub', makes: '1 robot hub with 2 robots', desc: 'Robots bring things from chests to turrets, labs, machines and buildings. O to place.', cost: cb('hub'), craft: () => this.buyB('hub') },
      { id: 'robot', cat: 'logistics', name: 'Robot', makes: '1 robot', desc: 'One more robot for your emptiest hub. Needs a hub placed first.', cost: cb('robot'), ok: this.canBuyB('robot'), craft: () => this.buyB('robot') },
      { id: 'pump', cat: 'logistics', name: 'Water pump', makes: '1 pump', desc: 'Pumps water into pipes. W to place.', cost: cb('pump'), craft: () => this.buyB('pump') },
      { id: 'pipe', cat: 'logistics', name: 'Pipes', makes: `${S.pipePack} pipes`, desc: 'A turret touching pipes from a pump is cooled and shoots twice as fast. I to place.', cost: cb('pipe'), craft: () => this.buyB('pipe') },
      { id: 'mine', cat: 'production', name: 'Stone mine', makes: '1 mine', desc: 'Another mine to dig at, with room for 6 more miners. N to place.', cost: st(S.mineCost), craft: () => this.buy('mine') },
      ...ORES.map((o, i): Recipe => ({ id: o, cat: 'production', name: `${METAL[o].name} mine`, makes: `1 ${o} mine`, desc: `Dig ${o} with M, or hire miners. ${o === 'diamond' ? 'A diamond' : '1 ' + o} makes ${METAL[o].per} ${o} ammo (${METAL[o].dmg} damage) in a machine. ${i + 1} to place.`, cost: S.oreMineCost[o], craft: () => this.buyX(o) })),
      { id: 'machine', cat: 'production', name: 'Machine', makes: '1 machine', desc: 'Turns stone and metal into ammo (and rockets once researched). K to place.', cost: st(S.machineCost), craft: () => this.buy('machine') },
      { id: 'furnace', cat: 'production', name: 'Furnace', makes: '1 furnace', desc: 'Bakes stone into bricks. Feed it stone; bricks come out the front. F to place, R turns it.', cost: cb('furnace'), craft: () => this.buyB('furnace') },
      { id: 'gen', cat: 'production', name: 'Generator', makes: '1 generator', desc: 'Burns stone for power. Machines, labs, furnaces and assemblers nearby run twice as fast. V to place.', cost: cb('gen'), craft: () => this.buyB('gen') },
      { id: 'asm', cat: 'production', name: 'Assembler', makes: '1 assembler', desc: 'Makes a science pack from 5 stone (T switches it to 3 short belts). A to place, R turns it.', cost: cb('asm'), craft: () => this.buyB('asm') },
      { id: 'turret', cat: 'combat', name: 'Turret', makes: '1 turret', desc: 'Shoots bears. Load ammo with T, or feed it with belts. U to place.', cost: st(S.turretCost), craft: () => this.buyTurret() },
      { id: 'bturret', cat: 'combat', name: 'Brick turret', makes: '1 brick turret', desc: 'Does 60% more damage and reaches farther. J to place.', cost: cb('bturret'), craft: () => this.buyB('bturret') },
      { id: 'rapid', cat: 'combat', name: 'Rapid crossbow', makes: '1 rapid crossbow', desc: '0.75 damage every 0.05 seconds; each shot uses 0.8% of one ammo. 5 to place.', cost: S.rapidCost, locked: !this.done.has('rapid'), craft: () => this.buyX('rapid') },
      { id: 'rocket', cat: 'combat', name: 'Rocket launcher', makes: '1 rocket launcher', desc: 'Fires swirling rockets for 70 damage, far enough to reach spawners. Load rockets with T. 6 to place.', cost: S.rocketCost, locked: !this.done.has('rocket'), craft: () => this.buyX('rocket') },
      { id: 'gate', cat: 'combat', name: 'Brick gate', makes: 'Stronger gates', desc: this.brickGate ? 'Built.' : 'Bears wait 10 seconds longer at the gates.', cost: cb('gate'), ok: this.canBuyB('gate'), craft: () => this.buyB('gate') },
      { id: 'expand', cat: 'combat', name: 'Bigger base', makes: 'Walls move out', desc: maxed ? 'Your base is as big as it gets.' : `Moves your walls out for more room. Step ${this.expansion + 1} of ${S.expandCosts.length}.`, cost: maxed ? {} : st(S.expandCosts[this.expansion]), ok: !maxed && this.bag.stone >= S.expandCosts[this.expansion], craft: () => this.expand() },
      { id: 'pack', cat: 'science', name: 'Science pack', makes: '1 science pack', desc: 'Put packs in a lab with T to research upgrades.', cost: st(S.packCost), craft: () => this.buyPacks(1) },
      { id: 'lab', cat: 'science', name: 'Lab', makes: '1 lab', desc: 'Uses science packs to research. Y picks what. L to place.', cost: st(S.labCost), craft: () => this.buy('lab') },
    ];
    return r;
  }
  private iconCache = new Map<string, string>();
  /** A picture of a thing drawn just as it looks in the world, as an image URL (made once, then kept). */
  private icon(id: string): string {
    const hit = this.iconCache.get(id);
    if (hit) return hit;
    const px = 96, cv = document.createElement('canvas'); cv.width = cv.height = px;
    const g = cv.getContext('2d')!;
    const big = ['mine', 'machine', ...ORES].includes(id), box = id.startsWith('k-') || id === 'pack' ? 17 : big ? 60 : id === 'belt' ? 46 : id === 'gate' || id === 'expand' ? 76 : 30;
    g.translate(px / 2, px / 2); g.scale(px / box, px / box);
    const bld = (type: BType, fuel = 0): Bld => ({ type, d: 0, inp: 0, out: 0, t: 0, fuel, recipe: 'pack', robots: 0 });
    const tur = (kind: TKind): Turret => ({ ammo: { ammo: 1, rocket: 1 }, cd: 0, face: -Math.PI / 4, kind });
    if (id.startsWith('k-')) paintItem(g, 0, 0, id.slice(2) as Kind);
    else if (id === 'pack') paintPack(g, 0, 0);
    else if (id === 'belt') for (const x of [-TILE, 0, TILE]) paintBelt(g, x, 0, 0, 0);
    else if (id === 'short') paintBelt(g, 0, 0, 0, 0);
    else if (id === 'grab') paintGrabber(g, 0, 0, { d: 0, t: 0, carry: false, k: 'stone' });
    else if (id === 'split') paintSplitter(g, 0, 0, 0);
    else if (id === 'chest') paintChest(g, 0, 0);
    else if (id === 'lab') paintLab(g, 0, 0, 0);
    else if (id === 'gen') paintBld(g, 0, 0, bld('gen', 1), 0);
    else if ((BTYPES as string[]).includes(id)) paintBld(g, 0, 0, bld(id as BType), 0);
    else if (id === 'turret' || id === 'rapid' || id === 'rocket') paintTurret(g, 0, 0, tur(id));
    else if (id === 'bturret') paintTurret(g, 0, 0, tur('brick'));
    else if (id === 'mine' || ORES.includes(id as Ore)) {
      const keep = [this.popT, this.mining]; this.popT = 9; this.mining = false;
      this.drawMine(g, { x: 0, y: 0, r: 26, ore: id === 'mine' ? 'stone' : id as Ore });
      [this.popT, this.mining] = keep as [number, boolean];
    } else if (id === 'machine') {
      const keep = this.popT; this.popT = 9;
      g.save(); g.beginPath(); g.rect(-30, -30, 60, 56); g.clip();
      this.drawMachine(g, { x: 0, y: 0, r: 26, queue: [], batchT: 0, out: [], recipe: 'ammo' });
      g.restore(); this.popT = keep;
    } else if (id === 'robot') {
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(4, 10, 5, 2.5, 0, 0, 7); g.fill();
      g.fillStyle = '#d8dee4'; g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill();
      g.fillStyle = '#3a4a52'; g.fillRect(-3, -1.5, 6, 2.5);
      g.strokeStyle = '#9aa6b0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, -5); g.lineTo(8, -5); g.stroke();
    } else if (id === 'gate') {
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
    }
    const url = cv.toDataURL();
    this.iconCache.set(id, url);
    return url;
  }
  private canCraft(rc: Recipe) { return !rc.locked && (rc.ok ?? this.afford(rc.cost)); }
  private craft(id: string, n = 1) {
    const rc = this.recipes().find(x => x.id === id);
    if (!rc) return;
    this.invSel = id;
    if (rc.locked || !this.canCraft(rc)) { Sound.denied(); this.renderShop(); return; }
    for (let i = 0; i < n; i++) { const r2 = this.recipes().find(x => x.id === id)!; if (!this.canCraft(r2)) break; r2.craft(); }
  }
  /** What you carry: raw things first, then things you can place. */
  private invItems(): { id: string; icon: string; color?: string; name: string; n: number; place?: Placeable; key?: string }[] {
    const raw = (['stone', 'brick', ...ORES, 'pack', ...AMMO_KINDS, 'rocket'] as Kind[]).map(k => ({ id: 'k-' + k, icon: KIND_ICON[k], color: isAmmoKind(k) && k !== 'ammo' ? metalOf(k).color : undefined, name: KIND_NAME[k][0].toUpperCase() + KIND_NAME[k].slice(1), n: Math.floor(this.bag[k]) }));
    const pl = (Object.keys(PLACE_INFO) as Placeable[]).map(p => ({ id: 'p-' + p, icon: PLACE_INFO[p][0], name: PLACE_INFO[p][1], key: PLACE_INFO[p][2], n: this.count(p), place: p }));
    return [...raw, ...pl].filter(x => x.n > 0);
  }
  private renderShop() {
    if (!this.shopOpen) return;
    const items = this.invItems(), recs = this.recipes();
    const sig = JSON.stringify([items.map(i => i.id + i.n), recs.map(r => r.id + this.canCraft(r) + !!r.locked + r.desc), this.invTab, this.invSel, Object.values(this.bag)]);
    if (sig === this.invSig) return;
    this.invSig = sig;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const slots = Math.max(30, Math.ceil(items.length / 5) * 5);
    let h = '';
    for (let i = 0; i < slots; i++) {
      const it = items[i];
      h += it ? `<button class="slot${it.place ? ' placeable' : ''}" ${it.place ? `data-place="${it.place}"` : ''} title="${esc(it.name)}${it.place ? ' (tap to place)' : ''}"><img src="${this.icon(it.place ?? it.id)}" alt=""><b>${it.n}</b>${it.key ? `<small>${it.key}</small>` : ''}<span>${esc(it.name)}</span></button>` : '<div class="slot empty"></div>';
    }
    this.pad.querySelector('#svInvGrid')!.innerHTML = h;
    this.pad.querySelector('#svRecTabs')!.innerHTML = (Object.keys(REC_CATS) as RecCat[]).map(c => `<button class="rectab${c === this.invTab ? ' on' : ''}" data-tab="${c}" title="${REC_CATS[c][1]}"><i>${REC_CATS[c][0]}</i></button>`).join('');
    this.pad.querySelector('#svRecCat')!.textContent = REC_CATS[this.invTab][1];
    const mine = recs.filter(r => r.cat === this.invTab && !r.locked);
    if (!mine.some(r => r.id === this.invSel)) this.invSel = mine[0].id;
    this.pad.querySelector('#svRecGrid')!.innerHTML = mine.map(r => `<button class="slot rec${this.canCraft(r) ? '' : ' no'}${r.locked ? ' locked' : ''}${r.id === this.invSel ? ' sel' : ''}" data-rec="${r.id}" title="${esc(r.name)}"><img src="${this.icon(r.id)}" alt=""><span>${esc(r.name)}</span></button>`).join('');
    const r = recs.find(x => x.id === this.invSel)!;
    const cost = (Object.entries(r.cost) as [keyof Cost, number][]).map(([k, n]) => `<span class="chip${this.bag[k] >= n ? '' : ' short'}"><img src="${this.icon('k-' + k)}" alt=""> ${n} ${KIND_NAME[k]} <em>(${Math.floor(this.bag[k])})</em></span>`).join('') || '<span class="chip">Free</span>';
    this.pad.querySelector('#svRecInfo')!.innerHTML = `<b>${esc(r.name)}</b><small>${esc(r.desc)}</small><div class="chips">${cost}<span class="makes">→ ${esc(r.makes)}</span></div>`
      + `<div class="craftbtns"><button class="primary" data-craft="1"${this.canCraft(r) ? '' : ' disabled'}>Craft</button>${['robot', 'gate', 'expand', 'hub'].includes(r.id) ? '' : `<button class="ghost" data-craft="5"${this.canCraft(r) ? '' : ' disabled'}>Craft 5</button>`}</div>`;
  }
  private invClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-place],[data-tab],[data-rec],[data-craft]');
    e.stopPropagation();
    if (!el || !this.running || this.paused) return;
    if (el.dataset.place) { const p = el.dataset.place as Placeable; this.closeShop(); this.togglePlacing(p); return; }
    if (el.dataset.tab) { this.invTab = el.dataset.tab as RecCat; Sound.click(); this.renderShop(); return; }
    if (el.dataset.rec) { if (this.invSel !== el.dataset.rec) { this.invSel = el.dataset.rec; Sound.click(); this.renderShop(); } else this.craft(el.dataset.rec); return; }
    if (el.dataset.craft) this.craft(this.invSel, Number(el.dataset.craft));
  }
  private buyBelt() {
    if (this.bag.stone < SURVIVAL.beltCost) { Sound.denied(); return; }
    this.bag.stone -= SURVIVAL.beltCost; this.inv++;
    Sound.pop(); this.renderShop();
  }
  private buyGrabber() {
    if (this.bag.stone < SURVIVAL.grabberCost) { Sound.denied(); return; }
    this.bag.stone -= SURVIVAL.grabberCost; this.invGrab++;
    Sound.pop(); this.renderShop();
  }
  private buyTurret() {
    if (this.bag.stone < SURVIVAL.turretCost) { Sound.denied(); return; }
    this.bag.stone -= SURVIVAL.turretCost; this.invTurret++;
    Sound.pop(); this.renderShop();
  }
  private buy(type: 'split' | 'chest' | 'mine' | 'machine' | 'lab') {
    const cost = { split: SURVIVAL.splitterCost, chest: SURVIVAL.chestCost, mine: SURVIVAL.mineCost, machine: SURVIVAL.machineCost, lab: SURVIVAL.labCost }[type];
    if (this.bag.stone < cost) { Sound.denied(); return; }
    this.bag.stone -= cost;
    if (type === 'split') this.invSplit++; else if (type === 'chest') this.invChest++; else if (type === 'mine') this.invMine++; else if (type === 'lab') this.invLab++; else this.invMachine++;
    Sound.pop(); this.renderShop();
  }
  private costX(b: 'rapid' | 'rocket' | Ore): Cost { return b === 'rapid' ? SURVIVAL.rapidCost : b === 'rocket' ? SURVIVAL.rocketCost : SURVIVAL.oreMineCost[b]; }
  private afford(c: Cost) { return (Object.entries(c) as [keyof Cost, number][]).every(([k, n]) => this.bag[k] >= n); }
  /** Buys a rapid crossbow, a rocket launcher or a metal mine into your inventory. */
  private buyX(b: 'rapid' | 'rocket' | Ore) {
    const c = this.costX(b);
    if ((b === 'rapid' || b === 'rocket') && !this.done.has(b)) { Sound.denied(); return; }
    if (!this.afford(c)) { Sound.denied(); return; }
    for (const [k, n] of Object.entries(c) as [keyof Cost, number][]) this.bag[k] -= n;
    if (b === 'rapid' || b === 'rocket') this.invT[b]++; else this.invOre[b]++;
    Sound.pop(); this.renderShop();
  }
  private costB(b: BType | 'bturret' | 'robot' | 'gate'): [number, number] {
    return ({ furnace: [SURVIVAL.furnaceCost, 0], gen: [SURVIVAL.genCost, 0], pump: [SURVIVAL.pumpCost, 0], pipe: [SURVIVAL.pipeCost, 0], asm: [SURVIVAL.asmCost, 0], tunnel: [SURVIVAL.tunnelCost, 0], hub: [SURVIVAL.hubCost, 0], bturret: [SURVIVAL.bTurretCost, SURVIVAL.bTurretBricks], robot: [SURVIVAL.robotCost, 0], gate: [0, SURVIVAL.brickGate] } as Record<string, [number, number]>)[b];
  }
  private canBuyB(b: BType | 'bturret' | 'robot' | 'gate') {
    const [st, br] = this.costB(b);
    if (b === 'gate' && this.brickGate) return false;
    if (b === 'robot' && ![...this.blds.values()].some(x => x.type === 'hub')) return false;
    return this.bag.stone >= st && this.bag.brick >= br;
  }
  private buyB(b: BType | 'bturret' | 'robot' | 'gate') {
    if (!this.canBuyB(b)) { Sound.denied(); return; }
    const [st, br] = this.costB(b); this.bag.stone -= st; this.bag.brick -= br;
    if (b === 'gate') { this.brickGate = true; this.say('Brick gate built: bears wait 10 seconds longer'); }
    else if (b === 'robot') { const hk = [...this.blds.entries()].filter(([, x]) => x.type === 'hub').sort((a, c) => a[1].robots - c[1].robots)[0][0]; this.blds.get(hk)!.robots++; this.robots.push(this.newRobot(hk)); }
    else if (b === 'bturret') this.invBTurret++;
    else this.invB[b] += b === 'pipe' ? SURVIVAL.pipePack : b === 'tunnel' ? 2 : 1;
    Sound.pop(); this.renderShop();
  }
  private newRobot(hk: string): Robot { const [c, r] = hk.split(',').map(Number); return { x: tileX(c), y: tileY(r), hub: hk, k: null, src: null, dst: null }; }
  /** Puts a thing in your pocket. */
  private pocket(k: Kind, n = 1) { this.bag[k] += n; }
  /** A belt, grabber or robot hands a building one thing. */
  private feedBld(b: Bld, k: Kind) {
    if (k !== 'stone' || !['furnace', 'gen', 'asm'].includes(b.type)) return false;
    if (b.inp >= (b.type === 'asm' ? SURVIVAL.asmStone * 2 : 10)) return false;
    b.inp++; return true;
  }
  /** Is (x, y) near a generator that's burning? */
  private powered(x: number, y: number) {
    for (const [key, b] of this.blds) { if (b.type !== 'gen' || b.fuel <= 0) continue; const [c, r] = key.split(',').map(Number); if (dist(x, y, tileX(c), tileY(r)) < SURVIVAL.powerRange) return true; }
    return false;
  }
  /** Furnaces, generators, assemblers, pipes and robots. */
  private runBlds(dt: number) {
    for (const [key, b] of this.blds) {
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r), [dx, dy] = DIRS[b.d];
      if (b.type === 'gen') {
        if (b.fuel <= 0 && b.inp > 0) { b.inp--; b.fuel += SURVIVAL.genBurn; }
        b.fuel = Math.max(0, b.fuel - dt);
        continue;
      }
      if (b.type !== 'furnace' && b.type !== 'asm') continue;
      const need = b.type === 'furnace' ? 1 : SURVIVAL.asmStone, time = b.type === 'furnace' ? SURVIVAL.furnaceTime : SURVIVAL.asmTime;
      // things made go out the front, onto a belt or into whatever is there
      if (b.out > 0 && this.deliver(c + dx, r + dy, b.type === 'furnace' ? 'brick' : 'pack')) b.out--;
      if (b.out > 0 && dist(this.x, this.y, x, y) < NEAR) { this.pocket(b.type === 'furnace' ? 'brick' : 'pack', b.out); this.bubble(x, y - 20, `+${b.out} ${b.type === 'furnace' ? 'brick' : 'pack'}${b.out > 1 ? 's' : ''}`, 'info'); b.out = 0; }
      if (b.inp < need || b.out >= 10) { b.t = 0; continue; }
      b.t += dt * (this.powered(x, y) ? 2 : 1);
      if (b.t < time) continue;
      b.t = 0; b.inp -= need;
      if (b.type === 'asm' && b.recipe === 'belt') { this.invShort += 3; this.bubble(x, y - 20, '+3 short belts', 'info'); }
      else b.out++;
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
    for (const [key, lb] of this.labs) if (lb.packs < 10) { const [c, r] = key.split(',').map(Number); needs.push({ id: 'l' + key, x: tileX(c), y: tileY(r), kinds: ['pack'], give: () => { lb.packs++; return true; } }); }
    this.machines.forEach((m, i) => { if (m.queue.length < 3) needs.push({ id: 'm' + i, x: m.x, y: m.y, kinds: ([...ORES, 'stone'] as Kind[]).filter(k => this.machineTakes(m, k)), give: k => { if (!this.machineTakes(m, k)) return false; m.queue.push(k); return true; } }); });
    for (const [key, b] of this.blds) if (['furnace', 'gen', 'asm'].includes(b.type) && b.inp < 3) { const [c, r] = key.split(',').map(Number); needs.push({ id: 'b' + key, x: tileX(c), y: tileY(r), kinds: ['stone'], give: () => this.feedBld(b, 'stone') }); }
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
  private buyPacks(n: number) {
    if (this.bag.stone < SURVIVAL.packCost * n) { Sound.denied(); return; }
    this.bag.stone -= SURVIVAL.packCost * n; this.bag.pack += n;
    Sound.pop(); this.renderShop();
  }
  /* ---------- labs and research ---------- */
  private nearLab() {
    for (const [key, lab] of this.labs) { const [c, r] = key.split(',').map(Number); if (dist(this.x, this.y, tileX(c), tileY(r)) < NEAR) return lab; }
    return null;
  }
  /** T next to a lab: put your science packs in it. */
  private loadLab(lab: Lab) {
    const n = Math.min(this.bag.pack, SURVIVAL.labSize - lab.packs);
    if (!n) { this.bubble(this.x, this.y - 30, this.bag.pack ? 'The lab is full' : 'No science packs. Craft them in your inventory (Shift)', 'info'); Sound.denied(); return; }
    lab.packs += n; this.bag.pack -= n;
    this.bubble(this.x, this.y - 30, `${n} pack${n > 1 ? 's' : ''} in`, 'info'); Sound.thump();
    if (!this.researching) this.bubble(this.x, this.y - 46, 'Pick something to research (Y)', 'info');
  }
  private openLab() {
    if (!this.labs.size && !this.invLab) { this.bubble(this.x, this.y - 30, 'Craft a lab in your inventory first (Shift)', 'info'); Sound.denied(); return; }
    this.labOpen = true; this.stick = null; this.keys.clear();
    this.renderLab();
    this.pad.querySelector<HTMLElement>('#svLab')!.hidden = false;
    Sound.ui();
  }
  private closeLab() { this.labOpen = false; this.pad.querySelector<HTMLElement>('#svLab')!.hidden = true; }
  private pickResearch(id: ResId) {
    if (this.done.has(id)) return;
    this.researching = id; Sound.click(); this.renderLab();
  }
  private renderLab() {
    const inLabs = [...this.labs.values()].reduce((a, l) => a + l.packs, 0);
    this.pad.querySelector('#svLabInfo')!.textContent = `${this.labs.size} lab${this.labs.size === 1 ? '' : 's'} · ${inLabs} packs in labs · ${this.bag.pack} in your pocket`;
    const list = this.pad.querySelector<HTMLElement>('#svResList')!;
    const html = RESEARCH.map(r => {
      const done = this.done.has(r.id), on = this.researching === r.id, p = Math.floor(this.progress[r.id] ?? 0);
      return `<button class="svres${done ? ' done' : ''}${on ? ' on' : ''}" data-res="${r.id}"${done ? ' disabled' : ''}><b>${r.name}</b><small>${r.desc}</small><i>${done ? 'Done' : `${p}/${r.cost} packs`}</i><span style="width:${Math.min(100, p / r.cost * 100)}%"></span></button>`;
    }).join('');
    if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
  }
  /** Labs with packs in them work on the chosen research, one pack every 2 seconds each. */
  private runLabs(dt: number) {
    const id = this.researching;
    for (const [lk, lab] of this.labs) {
      if (!id || !lab.packs) { lab.t = 0; continue; }
      const [lc, lr] = lk.split(',').map(Number), lx = tileX(lc), ly = tileY(lr);
      lab.t += dt * (this.powered(lx, ly) ? 2 : 1);
      if (lab.t < SURVIVAL.labEvery) continue;
      lab.t -= SURVIVAL.labEvery; lab.packs--;
      const r = RESEARCH.find(x => x.id === id)!;
      this.progress[id] = (this.progress[id] ?? 0) + 1;
      if (this.progress[id] >= r.cost && this.researching === id) {
        this.done.add(id); applyResearch(id); this.researching = null;
        this.say(`Research done: ${r.name}!`, 4); Sound.pop();
        return;
      }
    }
  }
  /** The chest next to the guy, if any. */
  private nearChest() {
    for (const key of this.chests.keys()) { const [c, r] = key.split(',').map(Number); if (dist(this.x, this.y, tileX(c), tileY(r)) < NEAR) return key; }
    return null;
  }
  /** T: take the stone out of a chest next to you, or load a turret next to you. */
  private useNear() {
    const lab = this.nearLab();
    if (lab && this.bag.pack) { this.loadLab(lab); return; }
    const ak = [...this.blds.entries()].find(([key, b]) => { if (b.type !== 'asm') return false; const [c, r] = key.split(',').map(Number); return dist(this.x, this.y, tileX(c), tileY(r)) < NEAR; });
    if (ak && !this.nearChest()) { const b = ak[1]; b.recipe = b.recipe === 'pack' ? 'belt' : 'pack'; this.bubble(this.x, this.y - 30, b.recipe === 'pack' ? 'Assembler makes science packs' : 'Assembler makes short belts', 'info'); Sound.click(); return; }
    const fk = [...this.blds.entries()].find(([key, b]) => { if (!['furnace', 'gen', 'asm'].includes(b.type)) return false; const [c, r] = key.split(',').map(Number); return dist(this.x, this.y, tileX(c), tileY(r)) < NEAR; });
    if (fk && this.bag.stone && !this.nearChest() && !this.turretNear()) { const b = fk[1]; let n = 0; while (this.bag.stone && this.feedBld(b, 'stone')) { this.bag.stone--; n++; } this.bubble(this.x, this.y - 30, n ? `${n} stone in` : 'It is full', 'info'); Sound.thump(); return; }
    const ck = this.nearChest();
    const ch = ck ? this.chests.get(ck)! : null;
    if (ch && (chestN(ch) > 0 || !this.loadable())) {
      if (!chestN(ch)) { this.bubble(this.x, this.y - 30, 'The chest is empty', 'info'); Sound.denied(); return; }
      this.bubble(this.x, this.y - 30, KINDS.filter(k => ch[k]).map(k => `+${ch[k]} ${KIND_NAME[k]}`).join(', '), 'info');
      for (const k of KINDS) { this.bag[k] += ch[k]; ch[k] = 0; }
      Sound.thump();
      return;
    }
    this.loadTurret();
  }
  private turretNear() { for (const key of this.turrets.keys()) { const [c, r] = key.split(',').map(Number); if (dist(this.x, this.y, tileX(c), tileY(r)) < NEAR) return true; } return false; }
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
    if (!this.loadable(best)) { this.bubble(this.x, this.y - 30, best.kind === 'rocket' ? 'No rockets. Make them in a machine (rocket recipe)' : 'No ammo to load. Make some in the machine', 'info'); Sound.denied(); return; }
    const kinds: Kind[] = best.kind === 'rocket' ? ['rocket'] : AMMO_KINDS;
    let n = 0;
    for (const k of kinds) { while (this.bag[k] > 0 && this.feedTurret(best, k)) { this.bag[k]--; n++; } }
    if (this.useAmmo && !this.bag[this.useAmmo]) this.useAmmo = null;
    this.bubble(this.x, this.y - 30, `Loaded ${n} ${best.kind === 'rocket' ? 'rocket' : 'ammo'}${best.kind === 'rocket' && n > 1 ? 's' : ''}`, 'info');
    Sound.thump();
  }
  private count(type: Placeable) { return ({ belt: this.inv, short: this.invShort, grab: this.invGrab, turret: this.invTurret, split: this.invSplit, chest: this.invChest, mine: this.invMine, machine: this.invMachine, lab: this.invLab, bturret: this.invBTurret, ...this.invB, ...this.invT, ...this.invOre } as Record<Placeable, number>)[type]; }
  /** Puts one stone into whatever is at (c, r): the machine, a turret, a chest, a splitter or a free belt. False if it can't take it. */
  private deliver(c: number, r: number, k: Kind = 'stone') {
    const x = tileX(c), y = tileY(r), key = c + ',' + r;
    // the machine only takes raw stone and metal
    const m = this.isMachine(c, r);
    if (m) { if (!this.machineTakes(m, k)) return false; m.queue.push(k); this.bubble(m.x, m.y - 36, `${KIND_NAME[k][0].toUpperCase() + KIND_NAME[k].slice(1)} in`, 'info'); return true; }
    const tu = this.turrets.get(key); if (tu) return this.feedTurret(tu, k);
    const lb = this.labs.get(key); if (lb) { if (k !== 'pack' || lb.packs >= SURVIVAL.labSize) return false; lb.packs++; return true; }
    const bd = this.blds.get(key); if (bd && bd.type !== 'tunnel') return this.feedBld(bd, k);
    const ch = this.chests.get(key); if (ch) { if (chestN(ch) >= SURVIVAL.chestSize) return false; ch[k]++; return true; }
    const sp = this.splitters.get(key); if (sp) { if (sp.buf.length >= 4) return false; sp.buf.push(k); return true; }
    if (this.isBelt(key)) { if (this.items.some(o => !o.gone && dist(o.x, o.y, x, y) < 10)) return false; this.items.push({ x, y, k }); return true; }
    return false;
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
  private buyShort() {
    if (this.bag.stone < SURVIVAL.shortBeltCost) { Sound.denied(); return; }
    this.bag.stone -= SURVIVAL.shortBeltCost; this.invShort += SURVIVAL.shortBeltPack;
    Sound.pop(); this.renderShop();
  }
  /** Tap a placed piece to put it back in your inventory. A belt tile comes back as a 1-tile belt. */
  private pickUp(c: number, r: number) {
    const key = c + ',' + r, x = tileX(c), y = tileY(r);
    // stone on that spot goes in your pocket
    const dropStone = () => { for (const it of this.items) { const t = tileAt(it.x, it.y); if (t && t.c === c && t.r === r) { it.gone = true; this.pocket(it.k); } } this.items = this.items.filter(it => !it.gone); };
    if (this.belts.has(key)) { this.belts.delete(key); this.invShort++; dropStone(); this.bubble(x, y - 14, '+1 short belt', 'info'); }
    else if (this.grabbers.has(key)) { const gk = this.grabbers.get(key)!; if (gk.carry) this.pocket(gk.k); this.grabbers.delete(key); this.invGrab++; this.bubble(x, y - 14, '+1 grabber', 'info'); }
    else if (this.splitters.has(key)) { for (const a of this.splitters.get(key)!.buf) this.pocket(a); this.splitters.delete(key); this.invSplit++; this.bubble(x, y - 14, '+1 splitter', 'info'); }
    else if (this.chests.has(key)) { const ch = this.chests.get(key)!, n = chestN(ch); for (const k of KINDS) this.bag[k] += ch[k]; this.chests.delete(key); this.invChest++; this.bubble(x, y - 14, n ? `+1 chest, ${n} things back` : '+1 chest', 'info'); }
    else if (this.blds.has(key)) {
      const b = this.blds.get(key)!;
      if (b.type === 'furnace') this.bag.brick += b.out; if (b.type === 'asm') this.bag.pack += b.out; this.bag.stone += b.inp;
      if (b.type === 'hub') { this.robots = this.robots.filter(rb => { if (rb.hub !== key) return true; if (rb.k) this.pocket(rb.k); return false; }); this.bag.stone += (b.robots - 2) * SURVIVAL.robotCost; }
      this.blds.delete(key); this.invB[b.type]++; this.coolT = 0; this.bubble(x, y - 14, `+1 ${BNAME[b.type].toLowerCase()}`, 'info');
    }
    else if (this.labs.has(key)) { const lb = this.labs.get(key)!; this.bag.pack += lb.packs; this.labs.delete(key); this.invLab++; this.bubble(x, y - 14, lb.packs ? `+1 lab, ${lb.packs} packs back` : '+1 lab', 'info'); }
    else if (this.turrets.has(key)) {
      const tu = this.turrets.get(key)!, n = Math.floor(tAmmo(tu));
      for (const [k, v] of Object.entries(tu.ammo) as [AmmoKind | 'rocket', number][]) this.bag[k] += Math.floor(v);
      this.turrets.delete(key); if (this.picked === key) this.picked = null;
      if (tu.kind === 'brick') this.invBTurret++; else if (tu.kind === 'turret') this.invTurret++; else this.invT[tu.kind]++;
      this.bubble(x, y - 14, n ? `+1 ${TNAME[tu.kind]}, ${n} ${tu.kind === 'rocket' ? 'rockets' : 'ammo'} back` : `+1 ${TNAME[tu.kind]}`, 'info');
    }
    else return;
    Sound.click();
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
    if (t) this.pickUp(t.c, t.r);
  }
  /** The bear or spawner under world point (x, y), if any. */
  private targetAt(x: number, y: number): Target | null {
    let best: Target | null = null, bd = Infinity;
    for (const b of this.bears) { if (b.state === 'dead') continue; const d = dist(b.x, b.y, x, y); if (d < BEAR_R + 14 && d < bd) { bd = d; best = b; } }
    for (const sp of this.spawners) { if (sp.dead) continue; const d = dist(sp.x, sp.y, x, y); if (d < SPAWNER_R + 14 && d < bd) { bd = d; best = sp; } }
    return best;
  }
  private taken(c: number, r: number) { const k = c + ',' + r; return this.belts.has(k) || this.grabbers.has(k) || this.turrets.has(k) || this.splitters.has(k) || this.chests.has(k) || this.labs.has(k) || this.blds.has(k); }
  private togglePlacing(type: Placeable) {
    if (this.placing && this.placeType === type) { this.placing = false; Sound.click(); return; }
    if (!this.count(type)) { this.bubble(this.x, this.y - 30, `No ${({ belt: 'long belts', short: 'short belts', grab: 'grabbers', turret: 'turrets', split: 'splitters', chest: 'chests', mine: 'mines', machine: 'machines', lab: 'labs', bturret: 'brick turrets', rapid: 'rapid crossbows', rocket: 'rocket launchers', iron: 'iron mines', copper: 'copper mines', gold: 'gold mines', diamond: 'diamond mines', furnace: 'furnaces', gen: 'generators', pump: 'pumps', pipe: 'pipes', asm: 'assemblers', tunnel: 'underground belts', hub: 'robot hubs' } as Record<Placeable, string>)[type]}. Craft them in your inventory (Shift)`, 'info'); Sound.denied(); return; }
    this.placing = true; this.placeType = type; this.hover = null;
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
    if (bd && ['furnace', 'asm', 'tunnel'].includes(bd.type)) { bd.d = (bd.d + 1) % 4; Sound.click(); return true; }
    return false;
  }
  /** Where the belt would go: under the mouse, or the tile in front of the guy. */
  private ghost() {
    if (this.hover && performance.now() - this.hover.t < 4000) return this.hover;
    const d = DIRS[Math.round(((this.face % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 4];
    return tileAt(this.x + d[0] * TILE, this.y + d[1] * TILE);
  }
  /** Can a new mine or machine (radius rr) go with its centre on tile (c, r)? */
  private bigFits(c: number, r: number, rr: number) {
    const x = tileX(c), y = tileY(r);
    if (x - rr < WALL.x0 + WALL.t + 4 || x + rr > WALL.x1 - WALL.t - 4 || y - rr < WALL.y0 + WALL.t + 4 || y + rr > WALL.y1 - WALL.t - 4) return false;
    if (structs.some(o => dist(x, y, o.x, o.y) < rr + o.r + 16)) return false;
    for (const m of [this.belts, this.grabbers, this.turrets, this.splitters, this.chests, this.labs, this.blds] as Map<string, unknown>[]) for (const key of m.keys()) { const [cc, rr2] = key.split(',').map(Number); if (dist(x, y, tileX(cc), tileY(rr2)) < rr + 12) return false; }
    return true;
  }
  private placeAt(c: number, r: number) {
    const key = c + ',' + r;
    if (isBig(this.placeType)) {
      if (!this.count(this.placeType)) { this.placing = false; return; }
      const rr = this.placeType === 'machine' ? MACHINE_R : MINE_R;
      if (!this.bigFits(c, r, rr)) { this.bubble(tileX(c), tileY(r) - 30, 'Not enough room there', 'info'); Sound.denied(); return; }
      if (this.placeType === 'mine') { this.mines.push({ x: tileX(c), y: tileY(r), r: rr, ore: 'stone' }); this.invMine--; }
      else if (this.placeType === 'machine') { this.machines.push({ x: tileX(c), y: tileY(r), r: rr, queue: [], batchT: 0, out: [], recipe: 'ammo' }); this.invMachine--; }
      else { const o = this.placeType as Ore; this.mines.push({ x: tileX(c), y: tileY(r), r: rr, ore: o }); this.invOre[o]--; this.say(`${METAL[o].name} mine built. Press M next to it to dig`, 3); }
      this.updateStructs(); Sound.thump();
      if (!this.count(this.placeType)) this.placing = false;
      return;
    }
    if (this.turnTile(key)) return;
    if (!this.count(this.placeType)) { this.placing = false; return; }
    if (this.turrets.has(key) || this.chests.has(key) || this.labs.has(key) || (this.blds.has(key) && !this.turnTile(key))) { this.bubble(tileX(c), tileY(r) - 16, 'Something is there', 'info'); Sound.denied(); return; }
    if (blockedTile(c, r)) { this.bubble(tileX(c), tileY(r) - 16, "Can't put that there", 'info'); Sound.denied(); return; }
    if (this.placeType === 'belt') {
      // one belt is 3 tiles long, laid from the spot in the direction it faces
      const [dx, dy] = DIRS[this.placeDir];
      for (let i = 0; i < SURVIVAL.beltLength; i++) {
        const cc = c + dx * i, rr = r + dy * i;
        if (i && (!tileAt(tileX(cc), tileY(rr)) || cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || blockedTile(cc, rr) || this.taken(cc, rr))) break;
        this.belts.set(cc + ',' + rr, this.placeDir);
      }
      this.inv--;
    } else if (this.placeType === 'short') {
      this.belts.set(key, this.placeDir); this.invShort--;
    } else {
      if (this.placeType === 'grab') { this.grabbers.set(key, { d: this.placeDir, t: 0, carry: false, k: 'stone' }); this.invGrab--; }
      else if (this.placeType === 'split') { this.splitters.set(key, { d: this.placeDir, buf: [], side: 0, t: 0 }); this.invSplit--; }
      else if (this.placeType === 'chest') { this.chests.set(key, emptyBag()); this.invChest--; }
      else if (this.placeType === 'lab') { this.labs.set(key, { packs: 0, t: 0 }); this.invLab--; }
      else if (this.placeType === 'bturret') { this.turrets.set(key, { ammo: {}, cd: 0, face: -Math.PI / 2, kind: 'brick' }); this.invBTurret--; this.coolT = 0; }
      else if (this.placeType === 'rapid' || this.placeType === 'rocket') { this.turrets.set(key, { ammo: {}, cd: 0, face: -Math.PI / 2, kind: this.placeType }); this.invT[this.placeType]--; this.coolT = 0; }
      else if (BTYPES.includes(this.placeType as BType)) {
        const bt = this.placeType as BType;
        this.blds.set(key, { type: bt, d: this.placeDir, inp: 0, out: 0, t: 0, fuel: 0, recipe: 'pack', robots: bt === 'hub' ? 2 : 0 }); this.invB[bt]--; this.coolT = 0;
        if (bt === 'hub') { this.robots.push(this.newRobot(key), this.newRobot(key)); }
      }
      else if (this.placeType === 'turret') { this.turrets.set(key, { ammo: {}, cd: 0, face: -Math.PI / 2, kind: 'turret' }); this.invTurret--; this.coolT = 0; }
      // stone lying on the spot goes back in your pocket
      for (const it of this.items) { const t = tileAt(it.x, it.y); if (t && t.c === c && t.r === r) { it.gone = true; this.pocket(it.k); } } this.items = this.items.filter(it => !it.gone);
    }
    Sound.thump();
    if (!this.count(this.placeType)) this.placing = false;
  }
  /** R: turn the belt being placed, or the belt under (or in front of) the guy. */
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
        const it = this.items.find(o => { if (o.gone) return false; const t = tileAt(o.x, o.y); return !!t && t.c === c - dx && t.r === r - dy; });
        if (it) { it.gone = true; gr.carry = true; gr.k = it.k; gr.t = 0; }
        else {
          // or one out of a chest behind it (ammo first), or stone ammo out of the machine
          const bk = (c - dx) + ',' + (r - dy), ch = this.chests.get(bk);
          const kk = ch ? KINDS.find(x => ch[x] > 0) : undefined, bb = this.blds.get(bk);
          if (ch && kk) { ch[kk]--; gr.carry = true; gr.k = kk; gr.t = 0; }
          else if (bb && bb.out > 0 && (bb.type === 'furnace' || bb.type === 'asm')) { bb.out--; gr.carry = true; gr.k = bb.type === 'furnace' ? 'brick' : 'pack'; gr.t = 0; }
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
  /** S: switch between your loadout ammo and stone ammo. */
  /** S: go through your loadout ammo and each kind of stone or metal ammo you have. */
  private switchAmmo() {
    const have = (['ammo', 'ironAmmo', 'copperAmmo', 'goldAmmo', 'diamondAmmo'] as AmmoKind[]).filter(k => this.bag[k] > 0);
    if (!have.length && !this.useAmmo) { this.bubble(this.x, this.y - 30, 'No stone or metal ammo yet', 'info'); Sound.denied(); return; }
    const i = this.useAmmo ? have.indexOf(this.useAmmo) : -1;
    this.useAmmo = i + 1 < have.length ? have[i + 1] : null;
    this.bubble(this.x, this.y - 30, `${this.ammoName()} ammo`, 'info');
    Sound.click();
  }
  private ammoName() { return this.useAmmo ? AMMO_NAME[this.useAmmo] : AMMO[this.load.ammo].name; }

  /* ---------- rules ---------- */
  update(dt: number) {
    if (!this.running || this.paused || this.labOpen || this.recipeFor) return;
    this.t += dt;
    this.reload = Math.max(0, this.reload - dt);
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
    }
    // a belt under the guy carries him along
    const under = tileAt(this.x, this.y), ud = under ? this.belts.get(under.c + ',' + under.r) : undefined;
    if (ud !== undefined) { this.x += DIRS[ud][0] * ST.beltSpeed * dt; this.y += DIRS[ud][1] * ST.beltSpeed * dt; }
    // the guy can walk out through any gate, but not through the fence, and stays on the map
    this.x = clamp(this.x, GUY_R, W - GUY_R); this.y = clamp(this.y, GUY_R, H - GUY_R);
    const me = { x: this.x, y: this.y }; collide(me, GUY_R, this.walls); this.x = me.x; this.y = me.y;

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
        if (this.mineT >= ST.mineEvery) { this.mineT -= ST.mineEvery; this.giveStone(mineAt.x, mineAt.y - 30, mineAt); Sound.thump(); }
      }
    }
    for (let i = 0; i < this.miners.length; i++) {
      this.miners[i] += dt;
      if (this.miners[i] >= ST.minerEvery) { this.miners[i] -= ST.minerEvery; const [mine, ox, oy] = this.minerSpot(i); this.giveStone(mine.x + ox, mine.y + oy - 18, mine); }
    }
    this.moveItems(dt);
    this.runLabs(dt);
    this.runBlds(dt);
    for (const mc of this.machines) {
      const job = this.machineJob(mc);
      if (job) {
        mc.batchT += dt * (this.powered(mc.x, mc.y) ? 2 : 1);
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
    if (this.gateStage === 0 && this.t >= SURVIVAL.moreGates) {
      this.gateStage = 1; this.gates.push(...MORE_GATES.map(([side, at]) => ({ side, at, open: 0 }))); this.rebuildWalls();
      this.say('Gates opened on the other 3 sides!', 4); Sound.alarm();
    }
    if (this.gateStage === 1 && this.t >= SURVIVAL.allGates) {
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
          Object.assign(sp, { x, y, hp: SURVIVAL.spawnerHp, t: SURVIVAL.spawnEvery, hurt: 0, dead: false, respawn: undefined });
          this.say('A new bear spawner appeared!', 3); Sound.alarm();
        }
        continue;
      }
      sp.hurt = Math.max(0, sp.hurt - dt);
      sp.t -= dt;
      if (sp.t > 0) continue;
      sp.t = this.t < SURVIVAL.earlyTime ? SURVIVAL.spawnEarly : SURVIVAL.spawnEvery / (this.mineOn ? SURVIVAL.mineBears : 1);
      if (steady < SURVIVAL.maxBears) { this.spawnBear(sp, false); steady++; }
    }
    // huge waves at 8, 13 and 18 minutes (then every 5 minutes), out of the spawners, on top of the steady bears
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
    for (const b of this.bears) {
      if (b.state === 'dead') { b.dead += dt; continue; }
      b.hurt = Math.max(0, b.hurt - dt); b.swipe = Math.max(0, b.swipe - dt);
      // a bear outside goes for you if you come close
      if ((b.state === 'walk' || b.state === 'wait') && guyOut && dist(b.x, b.y, this.x, this.y) < SURVIVAL.chaseRange) { b.state = 'chase'; b.cd = .6; b.tc = 2; }
      if (b.state === 'walk') {
        if (this.navTo(b, b.tx, b.ty, SURVIVAL.bearSpeed, dt, 12)) b.state = 'wait';
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
        if (d > reach - 2) this.navTo(b, this.x, this.y, SURVIVAL.bearSpeedInside, dt, reach - 2);
        else b.face = approachAngle(b.face, Math.atan2(this.y - b.y, this.x - b.x), dt * 6);
        if (d <= reach && b.cd <= 0) this.bearHit(b);
        // from further off it throws a rock, every 5 seconds
        b.tc = Math.max(0, b.tc - dt);
        if (d > reach + 20 && d < 420 && b.tc <= 0) this.throwRock(b);
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
        this.rockets.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, a, t: 0, spin: Math.random() < .5 ? 1 : -1, target, trail: [] });
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
        dmg = (k === 'ammo' ? ST.turretDamage : metalOf(k).dmg * mul) * (tu.kind === 'brick' ? 1.6 : 1); tu.ammo[k] = (tu.ammo[k] ?? 0) - 1; tu.cd = SURVIVAL.turretReload * cool;
        Sound.tone('square', 500, 200, .08, .06);
      }
      if ((tu.ammo[k] ?? 0) < 1e-6) delete tu.ammo[k];
      this.bolts.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: range + 80, dmg, target, stone: true, color: k === 'ammo' ? undefined : metalOf(k).color });
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
      const hit = this.hitAt(bo.x, bo.y, 4);
      if (hit) { this.damageTarget(hit, bo.dmg); bo.left = 0; }
    }
    this.bolts = this.bolts.filter(b => b.left > 0);
    // rockets: a swirl (one loop), then they home in on the bear or spawner
    for (const rk of this.rockets) {
      rk.t += dt;
      if (!alive(rk.target)) { const nt = this.nearestTarget(rk.x, rk.y, 400); if (nt) rk.target = nt; else { rk.t = 99; continue; } }
      const swirl = .75;
      if (rk.t < swirl) rk.a += rk.spin * Math.PI * 2 / swirl * dt;
      else rk.a = approachAngle(rk.a, Math.atan2(rk.target.y - rk.y, rk.target.x - rk.x), dt * 8);
      const sp = SURVIVAL.rocketSpeed * (rk.t < swirl ? .55 : 1 + (rk.t - swirl) * .8);
      rk.x += Math.cos(rk.a) * sp * dt; rk.y += Math.sin(rk.a) * sp * dt;
      rk.trail.push({ x: rk.x, y: rk.y }); if (rk.trail.length > 18) rk.trail.shift();
      const hit = this.hitAt(rk.x, rk.y, 6);
      if (hit && (hit === rk.target || rk.t > swirl)) {
        this.damageTarget(hit, SURVIVAL.rocketDamage);
        this.blasts.push({ x: rk.x, y: rk.y, t: 0 });
        Sound.boom(false); rk.t = 99;
      }
    }
    this.rockets = this.rockets.filter(r => r.t < 8);
    for (const bl of this.blasts) bl.t += dt;
    this.blasts = this.blasts.filter(b => b.t < .5);
    for (const r of this.rocks) {
      r.x += r.vx * dt; r.y += r.vy * dt; r.left -= SURVIVAL.throwSpeed * dt; r.spin += dt * 9;
      if (dist(r.x, r.y, this.x, this.y) < GUY_R + 5) { r.left = 0; this.hurt(SURVIVAL.bearThrow); }
    }
    this.rocks = this.rocks.filter(r => r.left > 0);
    this.bears = this.bears.filter(b => b.state !== 'dead' || b.dead < 1.2);
    for (const u of this.bubbles) u.t += dt;
    this.bubbles = this.bubbles.filter(u => u.t < (u.kind === 'loss' ? 1.6 : 1.1));

    if (this.hp <= 0) { this.hp = 0; this.end(false); }

  }
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
    const x = sp.x + (Math.random() - .5) * 20, y = sp.y + (Math.random() - .5) * 20;
    this.bears.push({ tc: 0, id: this.nextId++, x, y, hp: SURVIVAL.bearHp, state: 'walk', wait: 0, tx, ty, cd: 0, face: Math.atan2(ty - y, tx - x), swipe: 0, hurt: 0, dead: 0, step: Math.random() * 6, gate, wave });
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
    for (const b of live) { collide(b, BEAR_R, this.walls); b.x = clamp(b.x, BEAR_R, W - BEAR_R); b.y = clamp(b.y, BEAR_R, H - BEAR_R); }
  }

  private throwRock(b: Bear) {
    b.tc = SURVIVAL.throwCooldown; b.swipe = .25;
    const a = Math.atan2(this.y - b.y, this.x - b.x);
    b.face = a;
    this.rocks.push({ x: b.x + Math.cos(a) * 24, y: b.y + Math.sin(a) * 24, vx: Math.cos(a) * SURVIVAL.throwSpeed, vy: Math.sin(a) * SURVIVAL.throwSpeed, left: 520, spin: 0 });
    Sound.tone('sine', 300, 160, .15, .1);
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
    for (const d of this.decor) if (d.k === 0 && this.seen(d.x, d.y)) { g.beginPath(); g.arc(d.x + 6, d.y + 8, d.r * 1.1, 0, 7); g.fill(); }
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
    // scenery outside
    for (const d of this.decor) {
      if (!this.seen(d.x, d.y)) continue;
      if (d.k !== 2 && d.x > WALL.x0 - 8 && d.x < WALL.x1 + 8 && d.y > WALL.y0 - 8 && d.y < WALL.y1 + 8) continue; // cleared when the base grew
      if (d.k === 0) { // tree
        g.fillStyle = '#2d4a22'; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill();
        g.fillStyle = '#3c5f2c'; g.beginPath(); g.arc(d.x - d.r * .25, d.y - d.r * .25, d.r * .65, 0, 7); g.fill();
      } else if (d.k === 1) { // bush
        g.fillStyle = '#3f6230'; g.beginPath(); g.arc(d.x, d.y, d.r * .55, 0, 7); g.fill();
      }
    }
    for (const sp of this.spawners) if (this.seen(sp.x, sp.y, 60)) this.drawSpawner(g, sp);
    this.drawBelts(g);
    if (this.mineOn) { this.drawMineAndMachine(g); }
    for (const it of this.items) paintItem(g, it.x, it.y, it.k);
    if (this.placing) {
      const t = this.ghost();
      if (t) {
        const big = isBig(this.placeType);
        const taken = !big && this.taken(t.c, t.r);
        const bad = big ? !this.bigFits(t.c, t.r, this.placeType === 'machine' ? MACHINE_R : MINE_R) : taken ? false : blockedTile(t.c, t.r);
        g.globalAlpha = .6;
        if (big) {
          const rr = this.placeType === 'machine' ? MACHINE_R : MINE_R;
          g.fillStyle = bad ? 'rgba(255,90,80,.35)' : 'rgba(255,245,234,.25)'; g.beginPath(); g.arc(tileX(t.c), tileY(t.r), rr, 0, 7); g.fill();
          g.fillStyle = '#fff5ea'; g.font = '600 11px Jost, sans-serif'; g.textAlign = 'center'; g.fillText(this.placeType === 'machine' ? 'Machine' : this.placeType === 'mine' ? 'Mine' : METAL[this.placeType as Ore].name + ' mine', tileX(t.c), tileY(t.r) + 4);
        } else if (!taken) {
          if (this.placeType === 'belt' || this.placeType === 'short') { const [dx, dy] = DIRS[this.placeDir]; for (let i = 0; i < (this.placeType === 'belt' ? SURVIVAL.beltLength : 1); i++) { const cc = t.c + dx * i, rr = t.r + dy * i; if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || (i && (blockedTile(cc, rr) || this.taken(cc, rr)))) break; paintBelt(g, tileX(cc), tileY(rr), this.placeDir, this.t); } }
          else if (this.placeType === 'grab') paintGrabber(g, tileX(t.c), tileY(t.r), { d: this.placeDir, t: 0, carry: false, k: 'stone' });
          else if (this.placeType === 'split') paintSplitter(g, tileX(t.c), tileY(t.r), this.placeDir);
          else if (this.placeType === 'chest') paintChest(g, tileX(t.c), tileY(t.r));
          else if (this.placeType === 'lab') paintLab(g, tileX(t.c), tileY(t.r), 0);
          else if (this.placeType === 'bturret' || this.placeType === 'rapid' || this.placeType === 'rocket') paintTurret(g, tileX(t.c), tileY(t.r), { ammo: {}, cd: 0, face: -Math.PI / 2, kind: this.placeType === 'bturret' ? 'brick' : this.placeType });
          else if (BTYPES.includes(this.placeType as BType)) { paintBld(g, tileX(t.c), tileY(t.r), { type: this.placeType as BType, d: this.placeDir, inp: 0, out: 0, t: 0, fuel: 0, recipe: 'pack', robots: 0 }, 0); if (this.placeType === 'gen') { g.strokeStyle = 'rgba(255,220,120,.6)'; g.setLineDash([5, 6]); g.beginPath(); g.arc(tileX(t.c), tileY(t.r), SURVIVAL.powerRange, 0, 7); g.stroke(); g.setLineDash([]); } }
          else paintTurret(g, tileX(t.c), tileY(t.r), { ammo: {}, cd: 0, face: -Math.PI / 2, kind: 'turret' });
        }
        g.globalAlpha = 1;
        g.strokeStyle = bad ? '#ff6a5a' : '#fff5ea'; g.lineWidth = 2; g.strokeRect(GX0 + t.c * TILE + 1, GY0 + t.r * TILE + 1, TILE - 2, TILE - 2);
      }
    }
    this.drawWalls(g);
    // dead bears fade, then the rest on top
    for (const b of this.bears) if (b.state === 'dead') this.drawBear(g, b);
    for (const b of this.bears) if (b.state !== 'dead') this.drawBear(g, b);
    this.drawGuy(g);
    for (const rb of this.robots) {
      const bob = Math.sin(this.t * 6 + rb.x) * 1.5;
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(rb.x + 4, rb.y + 10, 5, 2.5, 0, 0, 7); g.fill();
      g.fillStyle = '#d8dee4'; g.beginPath(); g.arc(rb.x, rb.y + bob, 5.5, 0, 7); g.fill();
      g.fillStyle = '#3a4a52'; g.fillRect(rb.x - 3, rb.y - 1.5 + bob, 6, 2.5);
      g.strokeStyle = '#9aa6b0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(rb.x - 8, rb.y - 5 + bob); g.lineTo(rb.x + 8, rb.y - 5 + bob); g.stroke();
      if (rb.k) { g.fillStyle = KIND_DOT[rb.k]; g.beginPath(); g.arc(rb.x, rb.y + 7 + bob, 3, 0, 7); g.fill(); }
    }
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

  /** A small map in the top-right corner: the fence, spawners, bears and you. */
  private drawMap(g: CanvasRenderingContext2D, cw: number, top: number) {
    const size = 86, k = size / W, x0 = cw - size - 12, y0 = top + 6;
    g.fillStyle = 'rgba(10,8,24,.6)'; roundRect(g, x0 - 3, y0 - 3, size + 6, size + 6, 6); g.fill();
    g.fillStyle = 'rgba(75,107,55,.85)'; g.fillRect(x0, y0, size, size);
    g.strokeStyle = '#c9a77a'; g.lineWidth = 1.5; g.strokeRect(x0 + WALL.x0 * k, y0 + WALL.y0 * k, (WALL.x1 - WALL.x0) * k, (WALL.y1 - WALL.y0) * k);
    for (const sp of this.spawners) { g.fillStyle = sp.dead ? '#5a5650' : '#ff6a5a'; g.fillRect(x0 + sp.x * k - 3, y0 + sp.y * k - 3, 6, 6); }
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
      for (let c = 0; c <= COLS; c++) { g.beginPath(); g.moveTo(GX0 + c * TILE, GY0); g.lineTo(GX0 + c * TILE, GY0 + ROWS * TILE); g.stroke(); }
      for (let r = 0; r <= ROWS; r++) { g.beginPath(); g.moveTo(GX0, GY0 + r * TILE); g.lineTo(GX0 + COLS * TILE, GY0 + r * TILE); g.stroke(); }
    }
    for (const [key, d] of this.belts) { const [c, r] = key.split(',').map(Number); paintBelt(g, tileX(c), tileY(r), d, this.t); }
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
      const lbl = b.type === 'furnace' ? (b.inp || b.out ? `${b.inp}→${b.out}` : '') : b.type === 'gen' ? (b.fuel > 0 ? `${Math.ceil(b.fuel + b.inp * SURVIVAL.genBurn)}s` : 'no fuel') : b.type === 'asm' ? `${b.recipe === 'pack' ? 'packs' : 'belts'} ${b.inp}/${SURVIVAL.asmStone}` : b.type === 'hub' ? `${b.robots} robots` : '';
      if (lbl) { g.fillStyle = b.type === 'gen' && b.fuel <= 0 ? '#ff8a7a' : '#fff5ea'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center'; g.fillText(lbl, x, y + 21); }
    }
    for (const [key, lb] of this.labs) {
      const [c, r] = key.split(',').map(Number), busy = !!this.researching && lb.packs > 0; paintLab(g, tileX(c), tileY(r), busy ? this.t : 0);
      g.fillStyle = lb.packs ? '#fff5ea' : '#ff8a7a'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(lb.packs ? `${lb.packs} packs` : 'empty', tileX(c), tileY(r) + 21);
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
    this.miners.forEach((mt, i) => paintMiner(g, this.minerSpot(i), mt));
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
    if (mc.recipe === 'rocket') paintRocket(g, -8, -7, -Math.PI / 4, .8);
    g.restore();
    g.fillStyle = '#fff5ea'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    const st = mc.queue.filter(k => k === 'stone').length, n = mc.queue.length;
    const label = !n ? 'Machine' : mc.recipe === 'rocket' && st && st < SURVIVAL.rocketStone && st === n ? `Machine (${st}/${SURVIVAL.rocketStone} stone)` : `Machine (${n} left)`;
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
    if (b.state === 'wait') {
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
    paintGuy(g, L, a + (this.mining ? Math.sin(this.swing * Math.PI) * .5 : 0), bob, this.reload > 0 ? 0 : 1, this.useAmmo === 'ammo' ? STONE : this.useAmmo ? metalOf(this.useAmmo).color : undefined);
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
    g.fillText(`${inside ? `${inside} after you · ` : ''}${waiting} at gates · ${sps} spawner${sps === 1 ? '' : 's'}`, cw - 14, y + h + 20);
    if (this.mineOn) {
      g.textAlign = 'left'; g.fillStyle = '#d9d4ca';
      const res = [`Stone ${this.bag.stone}`, ...ORES.filter(o => this.bag[o]).map(o => `${METAL[o].name} ${this.bag[o]}`), this.bag.rocket ? `Rockets ${this.bag.rocket}` : ''].filter(Boolean).join('  ');
      g.fillText(res, x, y + h + 38);
      g.fillStyle = this.useAmmo ? '#fff' : '#fff5ea';
      g.fillText(`Ammo: ${this.ammoName()}${this.useAmmo ? ` (${this.bag[this.useAmmo]} left)` : ''}`, x, y + h + 56);
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
        g.font = u.kind === 'info' ? '500 12px Jost, sans-serif' : '700 13px Jost, sans-serif'; g.textAlign = 'center';
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
    const r = this.reload / (AMMO[this.load.ammo].reload * ST.reloadMul);
    this.pad.style.setProperty('--reload', String(r));
    this.pad.classList.toggle('loading', this.reload > 0);
    const nearMine = this.mineOn && !!near(this.mines, this.x, this.y), nearMachine = this.mineOn && !!near(this.machines, this.x, this.y);
    const mb = this.pad.querySelector<HTMLElement>('#svMine')!, ab = this.pad.querySelector<HTMLElement>('#svAmmoBtn')!;
    mb.hidden = !nearMine && !nearMachine;
    const label = nearMine ? (this.mining ? 'Stop' : 'Mine') : 'Machine';
    if (mb.firstElementChild!.textContent !== label) mb.firstElementChild!.textContent = label;
    ab.hidden = !AMMO_KINDS.some(k => this.bag[k]) && !this.useAmmo;
    const hb = this.pad.querySelector<HTMLElement>('#svHire')!;
    hb.hidden = !nearMine || this.miners.length >= SURVIVAL.maxMiners * this.mines.length;
    const hl = `H: ${this.minerCost()} stone`;
    if (hb.lastElementChild!.textContent !== hl) hb.lastElementChild!.textContent = hl;
    const hn = this.miners.length ? 'Extra miner' : 'Miner';
    if (hb.firstElementChild!.textContent !== hn) hb.firstElementChild!.textContent = hn;
    this.pad.querySelector<HTMLElement>('#svShopBtn')!.hidden = this.shopOpen;
    const inv = this.pad.querySelector<HTMLElement>('#svInv')!;
    inv.hidden = !this.inv && !(this.placing && this.placeType === 'belt');
    inv.classList.toggle('on', this.placing && this.placeType === 'belt');
    const il = `Belt 3 ×${this.inv}`;
    if (inv.firstElementChild!.textContent !== il) inv.firstElementChild!.textContent = il;
    const ig = this.pad.querySelector<HTMLElement>('#svInvGrab')!;
    ig.hidden = !this.invGrab && !(this.placing && this.placeType === 'grab');
    ig.classList.toggle('on', this.placing && this.placeType === 'grab');
    const gl = `Grabber ×${this.invGrab}`;
    if (ig.firstElementChild!.textContent !== gl) ig.firstElementChild!.textContent = gl;
    const is = this.pad.querySelector<HTMLElement>('#svInvShort')!;
    is.hidden = !this.invShort && !(this.placing && this.placeType === 'short');
    is.classList.toggle('on', this.placing && this.placeType === 'short');
    const sl = `Belt 1 ×${this.invShort}`;
    if (is.firstElementChild!.textContent !== sl) is.firstElementChild!.textContent = sl;
    const it = this.pad.querySelector<HTMLElement>('#svInvTurret')!;
    it.hidden = !this.invTurret && !(this.placing && this.placeType === 'turret');
    it.classList.toggle('on', this.placing && this.placeType === 'turret');
    const tl = `Turret ×${this.invTurret}`;
    if (it.firstElementChild!.textContent !== tl) it.firstElementChild!.textContent = tl;
    for (const [id, type, label] of [['#svInvSplit', 'split', 'Splitter'], ['#svInvChest', 'chest', 'Chest'], ['#svInvMine', 'mine', 'Mine'], ['#svInvMachine', 'machine', 'Machine'], ['#svInvLab', 'lab', 'Lab'], ['#svInv-bturret', 'bturret', 'Brick turret'], ['#svInv-rapid', 'rapid', 'Rapid crossbow'], ['#svInv-rocket', 'rocket', 'Rocket launcher'], ...ORES.map(o => ['#svInv-' + o, o, `${METAL[o].name} mine`] as const), ...BTYPES.map(b => ['#svInv-' + b, b, b === 'tunnel' ? 'Underground' : BNAME[b]] as const)] as const) {
      const el = this.pad.querySelector<HTMLElement>(id)!, n = this.count(type), on = this.placing && this.placeType === type;
      el.hidden = !n && !on; el.classList.toggle('on', on);
      const tx = `${label} ×${n}`;
      if (el.firstElementChild!.textContent !== tx) el.firstElementChild!.textContent = tx;
    }
    // inventory buttons stack in two columns from the bottom left, with no gaps
    let slot = 0;
    for (const el of this.pad.querySelectorAll<HTMLElement>('.svinv')) {
      if (el.hidden) continue;
      const l = (slot % 2 ? 112 : 14) + 'px', bt = (84 + Math.floor(slot / 2) * 52) + 'px';
      if (el.style.left !== l) el.style.left = l;
      if (el.style.bottom !== bt) el.style.bottom = bt;
      slot++;
    }
    let nearTurret = false;
    for (const key of this.turrets.keys()) { const [c, r] = key.split(',').map(Number); if (dist(this.x, this.y, tileX(c), tileY(r)) < NEAR) nearTurret = true; }
    const ck = this.nearChest(), cch = ck ? this.chests.get(ck)! : null, chestFull = !!cch && chestN(cch) > 0;
    const lb = this.pad.querySelector<HTMLElement>('#svLoad')!;
    const labLoad = !!this.nearLab() && this.bag.pack > 0;
    const canLoad = nearTurret && this.loadable() > 0;
    lb.hidden = !(labLoad || chestFull || canLoad);
    const ll = !labLoad && chestFull && !canLoad ? 'Take' : 'Load';
    this.pad.querySelector<HTMLElement>('#svLabBtn')!.hidden = !this.labs.size || this.labOpen || this.shopOpen;
    if (this.labOpen) this.renderLab();
    if (lb.firstElementChild!.textContent !== ll) lb.firstElementChild!.textContent = ll;
    const standing = tileAt(this.x, this.y);
    this.pad.querySelector<HTMLElement>('#svRotate')!.hidden = !this.placing && !(standing && this.belts.has(standing.c + ',' + standing.r));
    const help = this.picked ? 'Tap a bear or spawner for this turret to shoot. Tap the turret again to pick it up.' : this.placing ? (['turret', 'chest', 'mine', 'machine', 'lab', 'gen', 'pump', 'pipe', 'hub', 'bturret', 'rapid', 'rocket', ...ORES].includes(this.placeType) ? `Tap a spot to place the ${({ bturret: 'brick turret', gen: 'generator', hub: 'robot hub', rapid: 'rapid crossbow', rocket: 'rocket launcher', iron: 'iron mine', copper: 'copper mine', gold: 'gold mine', diamond: 'diamond mine' } as Record<string, string>)[this.placeType] ?? this.placeType}.` : `Tap a spot to place the ${({ grab: 'grabber', split: 'splitter', furnace: 'furnace', asm: 'assembler', tunnel: 'underground belt' } as Record<string, string>)[this.placeType] ?? 'belt'}. R turns it.`) : this.helpText;
    const hp = this.pad.querySelector<HTMLElement>('#svHelp')!;
    if (hp.textContent !== help) hp.textContent = help;
    if (this.shopOpen) this.renderShop();
    const al = this.ammoName();
    if (ab.firstElementChild!.textContent !== al) ab.firstElementChild!.textContent = al;
  }
}

/** The little guy, centred on the origin, facing angle a. */
function paintGuy(g: CanvasRenderingContext2D, L: Loadout, a: number, bob: number, pull: number, boltColor = AMMO[L.ammo].color) {
  g.rotate(a);
  // feet
  g.fillStyle = '#3a2c20'; g.beginPath(); g.arc(3 + bob, -6, 3.5, 0, 7); g.arc(3 - bob, 6, 3.5, 0, 7); g.fill();
  // body (shirt colour) and arms holding the crossbow forward
  g.fillStyle = L.color; g.beginPath(); g.ellipse(0, 0, GUY_R * .8, GUY_R, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(12, -5, 3, 0, 7); g.arc(12, 5, 3, 0, 7); g.fill();
  // crossbow: stock, bow and string; a bolt sits on it when loaded
  g.strokeStyle = '#5a3d22'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(4, 0); g.lineTo(26, 0); g.stroke();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, -12); g.quadraticCurveTo(28, 0, 22, 12); g.stroke();
  g.strokeStyle = '#e8e0d0'; g.lineWidth = 1; g.beginPath(); g.moveTo(22, -12); g.lineTo(22 - 8 * pull, 0); g.lineTo(22, 12); g.stroke();
  if (pull) { g.strokeStyle = boltColor; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 0); g.lineTo(30, 0); g.stroke(); }
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
/** A random spot far out in the woods, in direction a from the camp. */
function spawnerSpot(a: number): [number, number] {
  const d = (520 + Math.random() * 260) * SURVIVAL.spawnerFar;
  return [clamp(CX + Math.cos(a) * d, 70, W - 70), clamp(CY + Math.sin(a) * d, 70, H - 70)];
}
const tileX = (c: number) => GX0 + c * TILE + TILE / 2, tileY = (r: number) => GY0 + r * TILE + TILE / 2;
function tileAt(x: number, y: number) {
  const c = Math.floor((x - GX0) / TILE), r = Math.floor((y - GY0) / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
  // only tiles inside the walls as they are now
  const cx = GX0 + c * TILE + TILE / 2, cy = GY0 + r * TILE + TILE / 2;
  return cx >= WALL.x0 + WALL.t + 6 && cx <= WALL.x1 - WALL.t - 6 && cy >= WALL.y0 + WALL.t + 6 && cy <= WALL.y1 - WALL.t - 6 ? { c, r } : null;
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
  if (k === 'pack') { paintPack(g, x, y); return; }
  if (isAmmoKind(k)) {
    // ammo: a bolt with a coloured band (blue for stone ammo, the metal's colour for metal ammo)
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 5, y - 1, 12, 5);
    g.fillStyle = k === 'ammo' ? STONE : KIND_DOT[k]; g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 2, y - 4); g.lineTo(x - 6, y - 3); g.lineTo(x - 6, y + 3); g.lineTo(x + 2, y + 4); g.closePath(); g.fill();
    g.fillStyle = k === 'ammo' ? '#7fc8ff' : '#3a3a3a'; g.fillRect(x - 3, y - 3, 2.5, 6);
    return;
  }
  if (k === 'rocket') { paintRocket(g, x, y, 0, .8); return; }
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
function paintPack(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 1.5, y + 2.5, 5, 0, 7); g.fill();
  g.fillStyle = '#7fd6c2'; g.beginPath(); g.arc(x, y + 1, 5, 0, 7); g.fill();
  g.fillStyle = '#e8e2d6'; g.fillRect(x - 2, y - 7, 4, 4);
  g.fillStyle = '#c4f2e6'; g.beginPath(); g.arc(x - 1.5, y, 1.6, 0, 7); g.fill();
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
    const hot = b.inp > 0 ? .6 + Math.sin(t * 8) * .2 : .15;
    g.fillStyle = `rgba(255,140,60,${hot})`; g.fillRect(-6, -2, 12, 8);
    g.fillStyle = '#3a302a'; g.fillRect(-7, -8, 14, 4);
  } else if (b.type === 'gen') {
    g.fillStyle = b.fuel > 0 ? '#ffd76a' : '#7a7a70';
    g.beginPath(); g.moveTo(2, -8); g.lineTo(-5, 1); g.lineTo(0, 1); g.lineTo(-2, 8); g.lineTo(5, -1); g.lineTo(0, -1); g.closePath(); g.fill();
  } else if (b.type === 'asm') {
    g.save(); g.rotate(b.inp >= SURVIVAL.asmStone ? t * 3 : 0);
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
