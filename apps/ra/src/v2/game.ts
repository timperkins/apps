// The game: a sandbox on a small planet, drawn in 2:1 isometric with shaded voxel art.
import type { BotLevel } from './bot';
import { ART, RGB, WorldField, css, dirIndex, hash2, mix, nearestCopy, rng } from '../gfx';
import { CH, Tile, Tiles, drawTiles, windingRoad } from '../tiles';
import { GROUP_COUNT, type Action, type BuildItem, type BuildMenu, type CursorAt, type GameLike, type GroupInfo, type UnitType } from '../types';
import { COMBAT_CREDITS, COMBAT_STORE, DERRICK, ORE, POWER, QUEUE_MAX, START_CREDITS, STORE, TABS, TECH, Tab, Tech, buildTime } from './tech';
import { HP, IsoTerrain, K, OV, Rect } from './terrain';
import { StackSprite, dirSet, drawGoingUp, drawSprite, renderStack, toScreen, toWorld } from './stack';
import { buildingArt as workerBuilding, constructionArt, glowArt, pooled, prefetch } from './art-pool';
import { DOOR_S, Door, clipDoorway, doorOf, drawDoor } from './doors';
import { cameoUrl, tabIconUrl } from './cameo';
import { BURST_CENTER, BURST_FRAME, burstFrames, type BurstKind } from '../cursors';
import { MAPS, combatHome, mapDef, mapPreview, startsFor, worldOf } from './maps';
import { type PathOpts, clearLine, findWay } from './path';
import { SeaNav } from './seanav';
import { riversFor } from './rivers';
import { planBridges } from './bridges';
import { BRIDGE_Z, BridgeStyle, DECK_W, HUT_R, bridgeFromKey, bridgeKey, bridgeLen, deckTop, makeHut } from './bridge-art';
import { bridgeArt as workerBridge } from './art-pool';
import { Shroud } from './shroud';
import { DROP_S, FOLD_S, chuteInAir, drawChute, drawChuteShadow, dropAlt, swingOffset } from './chute';
import { type OreGen, regrowField } from './ore';
import { type UnitLine, type UnitVoice, announce, sayUnit } from '../voice';
import { type Loop, type PlayOpts, type Sfx, level, play, ui } from '../sfx';
import { type Armor, isNaval, BOOM, CARRIER_JETS, CARRIER_LANE, CARRIER_RUNWAY, CARRIER_SLOTS, DECK_Z, BUILDING_DEF, BURN_RUIN, BURN_WRECK, CELL, DIG_S, DUG_ARMOR, DUG_WEAPON, HIT_SPREAD, DAMAGED, UnitKind, type DefenseKind, FIXED_GUN, isDefense, isFoot, Fx, HELI_ALT, JET_ALT, PLANE_ALT, isAir, KNOCK_EASE, QUAKE, QUAKE_S, Shot, UNIT_DEF, VERSUS, versus, WEAPON, Weapon, buildingQuake, drawFlame, drawPuff, knockback, makeShot, muzzles, puffAlpha } from './combat';
import {
  BuildingKind,
  BuildingStates,
  DIRS,
  FACTIONS,
  V2BuildingArt,
  V2FactionArt,
  drawBuggyLights,
  buildingFoot,
  buildingBlock,
  BLOCK_CELL,
  makeBuilding,
  makeBushes,
  makeOreGen,
  makeClutter,
  makeDish,
  makeOre,
  makeFactionArt,
  makeBuildingStates,
  LINK_E,
  LINK_S,
  LINK_W,
  LINK_N,
  LINK_PIER,
  OreArt,
  makeRocks,
  makeTrees,
  makeConstruction,
  makeBuildingGlow,
  riseTime,
  KNEEL_DROP,
  AIR_RUNWAY,
  AIR_STAND_V,
  HANGAR_DOOR,
  cruiserParts,
  NEUTRAL_F,
  PUMP_FRAMES,
  factionOf,
  makePumpBeam,
} from './sprites';

type Kind = UnitKind;
const UNIT: Record<Kind, { name: string; speed: number; turn: number; r: number; hp: number }> = {
  light: { name: 'Lancer tank', speed: 24, turn: 3.2, r: 7, hp: 0.8 },
  heavy: { name: 'Bastion tank', speed: 14, turn: 2, r: 9, hp: 1 },
  buggy: { name: 'Scout buggy', speed: 40, turn: 5, r: 6, hp: 0.6 },
  hauler: { name: 'Ore hauler', speed: 13, turn: 1.8, r: 9, hp: 0.9 },
  arty: { name: 'Howler artillery', speed: 13, turn: 2, r: 8, hp: 0.7 },
  boat: { name: 'Patrol boat', speed: 20, turn: 1.6, r: 10, hp: 0.85 },
  heli: { name: 'Kestrel copter', speed: 34, turn: 3, r: 9, hp: 0.75 },
  inf: { name: 'G.I.', speed: 9, turn: 99, r: 4, hp: 1 },
  rocket: { name: 'Rocketeer', speed: 8, turn: 99, r: 4, hp: 0.9 },
  mcv: { name: 'MCU', speed: 10, turn: 1.3, r: 15, hp: 1 },
  apc: { name: 'Mule APC', speed: 26, turn: 3, r: 9, hp: 1 },
  gren: { name: 'Grenadier', speed: 8.5, turn: 99, r: 4, hp: 1 },
  eng: { name: 'Engineer', speed: 9, turn: 99, r: 4, hp: 1 },
  dog: { name: 'Attack dog', speed: 24, turn: 99, r: 4, hp: 1 },
  cmdo: { name: 'Commando', speed: 11, turn: 99, r: 4, hp: 1 },
  flamer: { name: 'Flame trooper', speed: 8, turn: 99, r: 4, hp: 1 },
  scorch: { name: 'Scorch tank', speed: 20, turn: 2.8, r: 7.5, hp: 1 },
  lumen: { name: 'Lumen tank', speed: 18, turn: 2.6, r: 7.5, hp: 1 },
  comet: { name: 'Comet launcher', speed: 11, turn: 1.6, r: 8.5, hp: 1 },
  skyguard: { name: 'Skyguard tank', speed: 21, turn: 2.8, r: 7.5, hp: 1 },
  heron: { name: 'Heron transport', speed: 30, turn: 2.6, r: 9, hp: 1 },
  jet: { name: 'Swift jet', speed: 52, turn: 3.2, r: 8, hp: 1 },
  plane: { name: 'Paratrooper plane', speed: 60, turn: 0.6, r: 12, hp: 1 },
  otter: { name: 'Otter hovercraft', speed: 26, turn: 2.4, r: 10, hp: 1 },
  destroyer: { name: 'Destroyer', speed: 22, turn: 1.4, r: 15, hp: 1 },
  cruiser: { name: 'Skyguard cruiser', speed: 19, turn: 1.3, r: 15, hp: 1 },
  carrier: { name: 'Carrier', speed: 13, turn: 0.9, r: 55, hp: 1 },
  sub: { name: 'Submarine', speed: 20, turn: 1.7, r: 12, hp: 1 },
};
const BNAME: Record<BuildingKind, string> = {
  yard: 'Construction yard',
  power: 'Power plant',
  barracks: 'Barracks',
  refinery: 'Ore refinery',
  radar: 'Air command',
  factory: 'Vehicle works',
  tower: 'Turret',
  pillbox: 'Pillbox',
  silo: 'Ore silo',
  helipad: 'Helipad',
  lab: 'Tech lab',
  prism: 'Lumen tower',
  aa: 'Skyguard battery',
  depot: 'Service depot',
  wall: 'Wall',
  uplink: 'Satellite uplink',
  navy: 'Naval yard',
  derrick: 'Tech oil derrick',
};
// Where a hauler unloads at a refinery, from its center: backed onto the
// striped pad, facing out (DOCK_A) with its bed's tail at the intake. It
// first pulls up DOCK_RUN in front of the pad, turns and backs on.
const DOCK: [number, number] = [12.5, 10.5];
const DOCK_A = Math.PI / 2;
const DOCK_RUN = 14;
// How long a hauler's bed takes to tip all the way up (or back down), in seconds.
const TIP_S = 0.9;
// Buildings that make units, and so have rally points.
const MAKERS: BuildingKind[] = ['barracks', 'factory', 'helipad', 'navy'];

// Whose voice each kind of unit answers in (src/voice.ts).
const VOICE: Record<Kind, UnitVoice> = {
  inf: 'soldier',
  rocket: 'soldier',
  gren: 'soldier',
  eng: 'engineer',
  light: 'tank',
  heavy: 'tank',
  arty: 'tank',
  mcv: 'tank',
  boat: 'tank',
  buggy: 'scout',
  apc: 'tank',
  heli: 'copter',
  hauler: 'harvester',
  dog: 'dog',
  cmdo: 'commando',
  flamer: 'flamer',
  scorch: 'tank',
  lumen: 'tank',
  comet: 'tank',
  skyguard: 'tank',
  heron: 'pilot',
  plane: 'pilot',
  otter: 'navy',
  destroyer: 'navy',
  cruiser: 'navy',
  carrier: 'navy',
  sub: 'navy',
  jet: 'pilot',
};
// A Comet launcher's rocket shows on its rail this many seconds before it can fire.
const COMET_SHOW = 0.6;
// How far (world units) a new building may stand from the rest of your base.
const BUILD_GAP = 30;
const PACK_S = 1.2;
const PACE_SPEED = 3.5; // a soldier pacing about, in map pixels a second
const PACE_R = 6; // and how far from where it was left
// On a player's screen, how fast a unit closes the gap to where the host has it
// (a little more of it every frame; about 90% in a quarter of a second)
const NET_EASE = 9;
// The Commando swims: in the water she is drawn this far down, only her head
// and shoulders above it.
const SWIM_DROP = 5.5;
// How close the Commando goes to plant a charge on a building (world
// units from its wall), and how long the charge takes to go off.
// Lumen towers: how near another must stand to beam its light into one
// that is firing, how many can, and how much each adds to the blow.
const PRISM_LINK = 9 * CELL;
const PRISM_MAX = 6;
const PRISM_ADD = 0.5;
// ...and how long one charges up before it fires (it starts while still
// reloading, so a tower that keeps firing loses no time to it).
const PRISM_CHARGE = 1.5;
// Walls: the grid their segments snap to (one segment a side) and the
// seconds to make one.
const WALL_GRID = 8;
const WALL_S = 0.6;
// A wall put down in a straight line with another of yours, up to this many
// cells short of it, fills in the gap: one purchase builds the whole run.
const WALL_FILL = 6;
// A Service depot: health a second it gives back to a vehicle standing on its
// pad (as a share of full), and what it costs, as a share of the vehicle's
// price, for a full repair.
const DEPOT_RATE = 0.08;
const DEPOT_COST = 0.25;
// Air commands: how many parking stands each has (one plane to a stand: a
// Swift jet or the Paratrooper plane), and a jet's missile pairs and the
// seconds to load each one back on.
const AIR_PADS = 4;
// Planes on the ground: how fast they taxi, and which stands each kind
// takes first (the big Paratrooper plane an end one, its wings spread wide).
const TAXI_SPEED = 13;
const STAND_ORDER: Record<'jet' | 'plane', number[]> = { jet: [1, 2, 0, 3], plane: [0, 3, 1, 2] };
// The Paratrooper plane: how far out it lines up to land, and how fast it
// gets up to speed down the runway and slows after touching down.
const APPROACH = 190;
const ROLL_ACC = 24;
const ROLL_DEC = 34;
// Repairing your buildings (the Repair button): health a second, and what a
// full repair costs as a share of the building's price; selling one (the Sell
// button) hands back this share of its price (less for a damaged one).
const MEND_RATE = 0.06;
const MEND_COST = 0.5;
const SELL_BACK = 0.5;
const JET_AMMO = 3;
const JET_REARM = 2.5;
const C4_REACH = 5;
const C4_S = 2.2;
// Foot soldiers ride in a Mule APC, up to CARGO of them. They climb out of
// the ramp at the back one every EXIT_S seconds.
const CARGO = 5;
// The transports soldiers can ride in.
const TRANSPORT = new Set<Kind>(['apc', 'heron', 'otter']);
const EXIT_S = 0.22;
const RIDERS = new Set<Kind>(['inf', 'rocket', 'gren', 'eng', 'dog', 'cmdo', 'flamer']);
// The Otter hovercraft is bigger: OTTER_SEATS seats, and it takes vehicles
// too, each one filling HAUL_SEATS of them (so 12 soldiers, or 3 vehicles).
const OTTER_SEATS = 12;
const HAUL_SEATS = 4;
const HAULED = new Set<Kind>(['mcv', 'light', 'heavy', 'buggy', 'arty', 'scorch', 'lumen', 'comet', 'skyguard']);
// The seats transport t has, the seats u takes up, and whether u can ride in t
const seatsOf = (t: { kind: Kind }): number => (t.kind === 'otter' ? OTTER_SEATS : CARGO);
const seatOf = (u: { kind: Kind }): number => (RIDERS.has(u.kind) ? 1 : HAUL_SEATS);
const canRide = (u: { kind: Kind }, t: { kind: Kind }): boolean => RIDERS.has(u.kind) || (t.kind === 'otter' && HAULED.has(u.kind));
const seatsUsed = (t: { cargo?: { kind: Kind }[] }): number => (t.cargo ?? []).reduce((n, p) => n + seatOf(p), 0);
const hasRoom = (t: { kind: Kind; cargo?: { kind: Kind }[] }, u: { kind: Kind }): boolean => seatsUsed(t) + seatOf(u) <= seatsOf(t);

interface Unit {
  id: number; // the same on every player's screen in a multiplayer game
  kind: Kind;
  f: number;
  x: number;
  y: number;
  z: number;
  a: number;
  turret: number;
  turretGoal: number;
  tx: number;
  ty: number;
  moving: boolean;
  sel: boolean;
  // the group you put it in (0 or 1: Group 1 or Group 2), if any
  grp?: number;
  anim: number;
  hp: number;
  idle: number;
  trackAcc: number;
  wakeP?: [number, number]; // a carrier: where it was last frame, and how fast it is going (a share of its top speed), for the water it churns up
  wakeK?: number;
  // Laps around the world: on screen the unit's unwrapped position is
  // (sx + lap * w, sy + lapY * h). They are set to the copy the player picked,
  // so orders go the way they panned.
  lap: number;
  lapY: number;
  deploy?: boolean; // a Foundry on its way to deploying
  // coming out of the door of the building that made it (see outOf)
  exit?: Exit;
  // a G.I. dug in behind sandbags (or told to), and how far it has got:
  // 0 standing, 1 dug in
  dug?: boolean;
  digK?: number;
  // an ore hauler at work: looking for ore, driving to it, digging, taking
  // it home, unloading, or waiting for something to change
  job?: { st: 'seek' | 'go' | 'dig' | 'home' | 'ret' | 'unload' | 'wait' | 'dock'; node?: OreNode; ref?: Building; t: number };
  load?: number;
  // how far its bed is tipped up to unload (0 down, 1 all the way), and the
  // step of its scoop's dig it was last on (both only for the look of it)
  tilt?: number;
  digStep?: number;
  noOre?: Set<OreNode>; // clumps it found it can't get to
  // getting round water: which way it is sliding along the shore, and how
  // long since it last got any closer to where it is going
  slide?: number;
  best?: number;
  stuck?: number;
  goal?: [number, number];
  slideT?: number;
  // the corners to drive past on the way round cliffs and water, in turn
  path?: [number, number][];
  rerouted?: boolean;
  // standing about: soldiers pace round the spot they stopped on (home),
  // stepping to `pace`; artillery shifts on its wheels to `look` (a buggy
  // blinks its aerial light instead: see drawUnit)
  home?: [number, number];
  pace?: [number, number];
  look?: number;
  // on a player's screen: how far it still has to drift to be where the host
  // last had it (eased out over a few frames, not jumped at each update), and
  // which way the host has it facing
  netErr?: [number, number];
  netA?: number;
  face?: number; // the way it was left facing, which it shifts about
  // fighting: what it is firing on, whether it was told to (and so chases
  // it anywhere) or is chasing whoever hit it (and gives up past LEASH from
  // `anchor`), its reload, when it last fired and when it was last hit
  target?: Target;
  forced?: boolean;
  chase?: boolean;
  anchor?: [number, number];
  repath?: number;
  scan?: number;
  cool?: number;
  fired?: number;
  upT?: number; // a submarine: when it was last hit while surfaced
  hitT?: number;
  flashT?: number;
  // when you last ordered an attack on it (or sent units into it): it blinks
  // white so you can see which
  aimT?: number;
  dead?: boolean;
  // where you last sent it (its own coordinates): while it is still on its
  // way there, a faint line shows the way
  dest?: [number, number];
  // the spot you clicked when you sent it there (with dest, its own slot near
  // it): the faint line points here, so a group's lines all meet where you
  // clicked. Only on your own screen.
  aim?: [number, number, number, number];
  // being knocked back by a hit: how far it still has to slide (world units)
  knock?: [number, number];
  // the enemy's guards (Combat stage): which post it holds, and its spot there
  post?: number;
  spot?: [number, number];
  // a soldier on its way to get into one of its side's transports (its id),
  // and how many times it has stopped short of it
  board?: number;
  boardTry?: number;
  // an Engineer on its way to mend a bridge (at one of its huts) or a
  // building of its side's (the id), and how many times it has stopped short
  fix?: number;
  fixTry?: number;
  // a transport's passengers (out of play while they ride), and whether it
  // is letting them out, and when the next one gets out
  cargo?: Unit[];
  // aircraft: how far up it is (0 on the ground, 1 flying), and a Swift
  // jet's missile pairs, its Air command and pad, and its timers
  fly?: number;
  ammo?: number;
  // a cargo plane: how many paratroopers it still has, where it drops them,
  // and when the next one jumps (a paratrooper on the way down has fly set,
  // 1 at the top and 0 on the ground)
  drops?: number;
  dropAt?: [number, number];
  jumpT?: number;
  // a plane on the ground at its Air command: the points it taxis through
  // (world, first copy) and the way it turns to face at the end; and the
  // Paratrooper plane's run (out to the runway, up, off to drop, round to
  // land, down and back to its stand), its speed and how far it has rolled,
  // and where it touches down and which way (x, y, heading)
  taxi?: [number, number][];
  taxiA?: number;
  mission?: 'out' | 'roll' | 'fly' | 'final' | 'rollout' | 'in';
  spd?: number;
  rolled?: number;
  land?: [number, number, number];
  nest?: number; // (not `pad`: isB takes anything with a pad for a building)
  padI?: number; // its stand on its Air command, or its spot on its carrier's deck
  deck?: number; // a jet's carrier (instead of an Air command), by unit id
  // a jet on its carrier's deck (see deckJet): what it is doing (taxiing out
  // to the runway, rolling off the bow, coming round astern, gliding in,
  // pulling up after landing, taxiing back to its spot), where it is on the
  // deck ([along, across, heading], from the ship's middle and way), the
  // points it taxis through (on the deck), and how long it has been gliding in
  dop?: DeckOp;
  dl?: [number, number, number];
  dpath?: [number, number][];
  dtime?: number;
  fireAt?: [number, number, number, number, number]; // a ship's place to fire on its target from: x, y, and where the target was, and its id
  rearm?: number;
  idleAir?: number;
  unloading?: boolean;
  exitT?: number;
  exitN?: number; // how many have come out so far this unload (fans them out)
}

// A bridge (bridges.ts, bridge-art.ts): nobody's, but anyone can fire on it
// (Ctrl or Cmd and click), and an Engineer at one of its huts mends it.
// Destroyed it stays, broken, until it is mended. Its id is the same on
// every screen (BRIDGE_ID + its place in the list).
interface Bridge {
  id: number;
  kind: 'bridge';
  f: number; // -1: nobody's
  style: BridgeStyle;
  axis: 0 | 1;
  x: number; // its middle, on the first copy of the map
  y: number;
  n: number;
  L: number;
  art: { rx: number; ry: number }; // half its size each way (as a building's)
  pad: Rect;
  hp: number;
  huts: [number, number][];
  dead?: boolean; // broken
  hitT?: number;
  flashT?: number;
  aimT?: number;
  fellT?: number; // when it fell (for the splash and the smoke)
  c4?: number; // a Commando's charge is on it, and goes off at this time
}
const BRIDGE_ID = 1_000_000;
const BRIDGE_DEF: Record<BridgeStyle, { strength: number; armor: Armor }> = {
  dirt: { strength: 500, armor: 'concrete' },
  timber: { strength: 450, armor: 'wood' },
  stone: { strength: 1400, armor: 'concrete' },
  steel: { strength: 1100, armor: 'heavy' },
};

type Target = Unit | Building | Bridge;
const isB = (t: Target): t is Building | Bridge => 'pad' in t;
const isBridge = (t: Target): t is Bridge => t.kind === 'bridge';
// A building's or a bridge's strength and armor.
const structDef = (t: Building | Bridge) => (isBridge(t) ? BRIDGE_DEF[t.style] : BUILDING_DEF[t.kind]);
// Milliseconds a frame may spend finding ways round cliffs and water.
const ROUTE_MS = 6;
// How far from the shore a ship keeps its middle (world units): the carrier
// is too big to come in close, or into narrow channels.
const SEA_CLEAR: Partial<Record<Kind, number>> = { carrier: 70 };
// What a jet on a carrier is doing (and its number, for the snapshot): see deckJet.
type DeckOp = 'out' | 'roll' | 'app' | 'final' | 'brake' | 'in';
const DECK_OPS: (DeckOp | undefined)[] = [undefined, 'out', 'roll', 'app', 'final', 'brake', 'in'];
// A carrier's jets: how fast the catapult flings one down the runway, how
// hard the wires pull one up after landing, how far out astern one lines up
// to land, and how fast one is mended on the deck (a share a second).
const CAT_ACC = 46;
const WIRE_DEC = 60;
const DECK_APPROACH = 150;
const DECK_MEND = 0.1;
// Ships cross whole oceans, so they look for their way for longer (and the
// carrier, which keeps well out, on a coarser grid).
const SEA_PATH: PathOpts = { step: 6, maxNodes: 40000 };
const CARRIER_PATH: PathOpts = { step: 16, maxNodes: 60000 };
// How near a Naval yard a carrier counts as parked there (past its edge),
// for new jets to land on it.
const PARK_NEAR = 110;
// How far a unit chases whoever hit it before it gives up and goes back.
const LEASH = 10 * CELL;
// How close a friend has to be to come and help when one of its side is hit.
const HELP = 7 * CELL;
// Music moods (see mood()): how long each holds after it ends, in seconds,
// and how far from your nearest building counts as out away from the base.
const BATTLE_HOLD = 12;
const SHROUD_HOLD = 8;
const AWAY = 24 * CELL;

// A destroyed building: rubble, for good (t < 0 while it is still blowing up).
interface Ruin {
  kind: BuildingKind;
  f: number;
  x: number;
  y: number;
  states: BuildingStates;
  t: number;
  // the fires burning over it after the big bang: where (from its middle,
  // and height), how tall, and when each goes out (seconds after the bang)
  flames: [number, number, number, number, number][];
}

// A destroyed vehicle's wreck burning where it stood: a few flames over a
// scorch mark, dying down over BURN_WRECK seconds.
interface Fire {
  x: number;
  y: number;
  z: number;
  t: number;
  w: number; // how far the flames are spread (world units)
  flames: [number, number, number, number][]; // dx, dy, height, when it goes out
}

interface OreNode {
  x: number;
  y: number;
  amt: number;
  v: number; // art variant
}

// A unit coming out of a door: the building, the door's middle on the
// ground (in the unit's copy of the map) and the door, the depth to draw at (just in front of the building),
// how long since it was made, and on the host what to do once it is out.
interface Exit {
  b: Building;
  x: number;
  y: number;
  d: Door;
  k: number;
  t: number;
  go?: boolean;
  then?: (u: Unit) => void;
}

interface Building {
  id: number;
  kind: BuildingKind;
  f: number;
  x: number;
  y: number;
  art: V2BuildingArt;
  phase: number;
  gun: number;
  gunGoal: number;
  pad: Rect;
  sel: boolean;
  rise: number; // 0..1, how far it has gone up (1 when standing)
  door?: number; // 0..1, how far open its door is (a unit coming out)
  hp: number; // 0..1
  packing?: boolean;
  rally?: [number, number]; // where new units head (world, first copy)
  gift?: boolean; // a refinery's free hauler has been handed over
  busyT?: number; // a refinery: when a hauler was last tipping ore into it
  primary?: boolean; // the one of its kind that makes the units
  fixing?: boolean; // being repaired (the Repair button), for credits
  sold?: boolean; // sold (the Sell button): going down, then gone
  // a gun tower's target and reload, and for any building when it was last hit
  target?: Target;
  scan?: number;
  cool?: number;
  charge?: number; // a Lumen tower: 0..1, how far charged up for its next shot
  hitT?: number;
  flashT?: number;
  // when you last ordered an attack on it (or sent units into it): it blinks
  // white so you can see which
  aimT?: number;
  dead?: boolean;
  c4?: number; // a Commando's charge is on it, and goes off at this time
}

interface Prop {
  spr: StackSprite;
  x: number;
  y: number;
  z: number;
}

interface Particle {
  x: number; // screen space
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: 'smoke' | 'soot' | 'wake' | 'dust' | 'foam' | 'spray';
  size: number;
  v?: number; // which puff texture
}

const BASE_B: BuildingKind[] = ['power', 'factory', 'barracks', 'refinery', 'silo', 'radar', 'tower', 'tower', 'pillbox', 'helipad', 'power'];
// Your base in the Combat stage: one of every building (enough power plants
// to run it all), and a Naval yard out on the nearest water.
const COMBAT_B: BuildingKind[] = ['yard', 'radar', 'factory', 'refinery', 'barracks', 'lab', 'helipad', 'depot', 'silo', 'uplink', 'power', 'power', 'power', 'power', 'power', 'power', 'tower', 'pillbox', 'aa', 'prism', 'wall'];
// ...and one of every unit (as well as the army it starts with): these on
// land, Swift jets and the Paratrooper plane on the Air command's stands,
// and ships by the Naval yard. (The MCU comes already deployed, as the
// Construction yard: pack that up to drive it.)
const COMBAT_EXTRA: [Kind, number][] = [
  ['eng', 1],
  ['cmdo', 1],
  ['apc', 1],
  ['heron', 1],
];
const COMBAT_SHIPS: Kind[] = ['carrier', 'otter', 'destroyer', 'sub', 'cruiser'];

// Height of each unit's visual center above the ground (for picking and brackets).
// Which of the hauler's three pictures to show for a load: empty, partly
// full or full.
function haulerFill(load = 0): number {
  return load < 1 ? 0 : load >= ORE.load * 0.9 ? 2 : 1;
}

// The hauler's scoop as it digs, step by step (0 down, 1 lifting, 2 up and
// tipping), DIG_RATE steps a second.
const DIG_POSES = [0, 1, 2, 2, 1];
const DIG_RATE = 4;

// Is heading d of this set of pictures drawn? If not it is asked for (and
// false), so something else can stand in for it a frame or two. With no
// workers to draw it, it is drawn here when wanted.
function artReady(set: StackSprite[], d: number): boolean {
  const s = dirSet(set);
  if (!s || s.ready(d) || !pooled()) return true;
  void prefetch(s.key, d, true);
  return false;
}

// The key of the BLOCK_CELL square of the map that (x, y) is in.
const blockKey = (x: number, y: number) => (Math.floor(x / BLOCK_CELL) + 32768) * 65536 + (Math.floor(y / BLOCK_CELL) + 32768);

// The key of the DECK_CELL square of the map that (x, y) is in (see refreshDecks).
const DECK_CELL = 3;
const deckKey = (x: number, y: number) => (Math.floor(x / DECK_CELL) + 32768) * 65536 + (Math.floor(y / DECK_CELL) + 32768);

// Can unit u be mended at building b? The Naval yard mends ships, and the
// Otter, in its slip; the Service depot vehicles on its pad.
function servedBy(u: Unit, b: Building): boolean {
  if (b.kind !== 'depot' && b.kind !== 'navy') return false;
  if (isFoot(u.kind) || isAir(u.kind)) return false;
  return (isNaval(u.kind) || u.kind === 'otter') === (b.kind === 'navy');
}

// Where a unit sent to building b for repairs parks: the middle of the
// depot's pad, or out in the Naval yard's slip (world, b's copy of the map).
function bayOf(b: Building): [number, number] {
  return b.kind === 'navy' ? [b.x, b.y + 5] : [b.x, b.y];
}
// and where the second, third... unit sent there with it parks, round it
// (spread out in the Naval yard's slip, closer together on the depot's pad)
const BAY_SLOTS: [number, number][] = [[0, 0], [-6, 0], [6, 0], [0, -5], [0, 5], [-6, 5], [6, 5], [-6, -5], [6, -5]];

// Which click burst an order marker plays.
function markKind(m: { foe?: boolean; ore?: boolean; enter?: boolean; fix?: boolean }): BurstKind {
  return m.foe ? 'attack' : m.fix ? 'repair' : m.enter ? 'enter' : m.ore ? 'harvest' : 'move';
}

const MID: Record<Kind, number> = { mcv: 6, light: 4, heavy: 5, buggy: 4, apc: 5, hauler: 5, arty: 5, boat: 4, heli: 4, inf: 5.5, rocket: 5.5, gren: 5.5, eng: 5.5, dog: 3.5, cmdo: 5.5, flamer: 5.5, scorch: 4, lumen: 4, comet: 6, skyguard: 4, heron: 4, jet: 3, plane: 4, otter: 4, destroyer: 5, cruiser: 6, carrier: 17, sub: 2 };
// How far each of your units sees, in cells: it lifts the shroud that far
// round itself.
const SIGHT: Record<Kind, number> = { mcv: 7, light: 7, heavy: 7, buggy: 9, apc: 7, hauler: 5, arty: 7, boat: 7, heli: 9, inf: 6, rocket: 6, gren: 6, eng: 5, dog: 8, cmdo: 7, flamer: 5, scorch: 6, lumen: 8, comet: 7, skyguard: 8, heron: 8, jet: 8, plane: 6, otter: 6, destroyer: 8, cruiser: 9, carrier: 9, sub: 6 };
// and buildings, past the edge of their footprint (the radar mast further)
const BSIGHT: Partial<Record<BuildingKind, number>> = { radar: 13, tower: 7, pillbox: 6, yard: 6 };
// Play without the shroud, for testing: ?noshroud in the URL.
// Show where buildings keep units out, for testing: ?blocks in the URL.
const SHOW_BLOCKS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('blocks');
const NO_SHROUD = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noshroud');

// Stages to start a game in, for testing: the real start, or straight into a
// fight with a full base each, close together.
export type Stage = 'initial' | 'combat';
const STAGES: { id: Stage; name: string; blurb: string }[] = [
  { id: 'initial', name: 'Initial', blurb: 'An MCU and a few units. The enemy is far away.' },
  { id: 'combat', name: 'Combat', blurb: 'Two full bases close together, an army each and $50000. The enemy rebuilds its losses.' },
];
// The enemy's army in the Combat stage: it keeps this many of each, making
// more (for free) at the building for each kind whenever it is short.
const GARRISON: [Kind, number][] = [
  ['light', 6],
  ['heavy', 3],
  ['buggy', 3],
  ['arty', 2],
  ['heli', 1],
  ['inf', 8],
  ['rocket', 4],
  ['gren', 3],
  ['dog', 2],
  ['flamer', 2],
  ['scorch', 2],
  ['lumen', 2],
  ['comet', 1],
  ['skyguard', 2],
];
// The walk and stand frames of each kind of foot soldier.
const footFrames = (art: V2FactionArt, k: Kind): StackSprite[][] =>
  k === 'rocket' ? art.rocket : k === 'gren' ? art.gren : k === 'eng' ? art.eng : k === 'dog' ? art.dog : k === 'cmdo' ? art.cmdo : k === 'flamer' ? art.flamer : art.infantry;
// The tanks with a turning turret, and the hull and turret each is drawn with.
const TURRETED: ReadonlySet<Kind> = new Set<Kind>(['light', 'heavy', 'scorch', 'lumen', 'skyguard', 'cruiser']);
const tankParts = (art: V2FactionArt, k: Kind): [StackSprite[], StackSprite[]] =>
  k === 'heavy' ? [art.heavyTank, art.heavyTurret] : k === 'scorch' ? [art.scorchTank, art.scorchTurret] : k === 'lumen' ? [art.lumenTank, art.lumenTurret] : k === 'skyguard' ? [art.skyguardTank, art.skyguardTurret] : [art.lightTank, art.lightTurret];
const MAKER: Partial<Record<Kind, BuildingKind>> = { inf: 'barracks', rocket: 'barracks', gren: 'barracks', eng: 'barracks', dog: 'barracks', flamer: 'barracks', light: 'factory', heavy: 'factory', scorch: 'factory', lumen: 'factory', skyguard: 'factory', buggy: 'factory', arty: 'factory', comet: 'factory', heli: 'helipad' };
// ...and it waits in groups of this many at each of its posts round its base.
const SQUAD = 4;
const POSTS = 6;
const ENEMY = 1;


// ---------- Multiplayer: what goes over the wire ----------

interface Job {
  tech: Tech;
  spent: number;
  paused: boolean;
  ready: boolean;
}
// A side's purse and what it is making.
interface Eco {
  credits: number;
  jobs: Map<Tab, Job>;
  queue: Map<Tab, Tech[]>;
  lowPower: boolean;
  paraT: number; // seconds until the Air command's paratroopers are ready
}
const newEco = (credits: number): Eco => ({ credits, jobs: new Map(), queue: new Map(), lowPower: false, paraT: PARA_S });

// Paratroopers: one planeload every few minutes from the Paratrooper plane.
const PARA_S = 240;
const PARA_N = 8;

// A submarine stays surfaced this long after it fires (long enough for the
// ship it hit, and anything nearby that can shoot a ship, to fire back),
// counted again from each hit it takes while it is up; Destroyers hear one
// under the water this far off.
const SUB_UP = 8;
const SONAR = 6 * CELL;

/** A player in a multiplayer game: the side (color) they play and their name. */
export interface Player {
  f: number;
  name: string;
  bot?: BotLevel; // a computer player, run on the host's screen
}

/** Something a player told their side to do. Every order goes through one of
 * these, so the host can carry out a player's orders as if they were its own. */
export type Command =
  | { c: 'move'; m: [number, number, number][]; dig?: number[]; n?: number } // [unit id, tx, ty]; haulers in dig go for ore n
  | { c: 'attack'; u: number[]; t: number }
  | { c: 'deploy'; u: number[] }
  | { c: 'board'; u: number[]; t: number } // soldiers get into transport t
  | { c: 'land'; u: number[]; t: number } // Swift jets go and land on carrier t
  | { c: 'fix'; u: number[]; t: number } // engineers go and mend bridge or building t
  | { c: 'dock'; u: number[]; b: number } // ore haulers go and unload at refinery b
  | { c: 'unload'; u: number[] } // transports let their soldiers out
  | { c: 'entrench'; u: number[]; on: boolean } // G.I.s dig in behind sandbags, or climb out
  | { c: 'pack'; b: number }
  | { c: 'primary'; b: number }
  | { c: 'rally'; b: number; x?: number; y?: number }
  | { c: 'build'; t: string }
  | { c: 'cancel'; t: string }
  | { c: 'place'; t: string; x: number; y: number }
  | { c: 'para'; x: number; y: number } // the Paratrooper plane drops its paratroopers here
  | { c: 'mend'; b: number } // repair building b, or stop repairing it
  | { c: 'sell'; b: number };

// How a unit or building left the game, for the players' screens: destroyed
// (blows up), quietly (a Foundry vehicle unfolding into its yard), razed, or
// a Foundry packing up into its vehicle.
const GONE_KILL = 0;
const GONE_QUIET = 1;
const GONE_RAZE = 2;
const GONE_PACK = 3;
const JOB_STATES = ['seek', 'go', 'dig', 'home', 'ret', 'unload', 'wait', 'dock'] as const;

/** What the host sends everyone, several times a second: every unit and
 * building as it is, what has gone since last time, each player's purse,
 * the ore now and then, messages for players and who is out of the game. */
export interface Snapshot {
  t: number;
  // [id, kind, side, x, y, angle, turret, hp, flags, tx, ty, target id, load, job state, passengers "id:kind:hp,...", unloading, air, carrier id * 100 + deck spot + 12 * what it is doing on the deck]
  u: (number | string)[][];
  // [id, kind, side, x, y, hp, rise, flags, pad x, y, w, h, rally x, rally y, target id]
  b: (number | string)[][];
  gone: [number, number][];
  // [side, credits, low power, jobs [tab, tech, spent, paused, ready][], queue [tab, techs][]]
  eco: [number, number, number, [string, string, number, number, number][], [string, string[]][], number?][];
  ore?: number[]; // x, y, amount, variant, ...
  told: [number, string, string][];
  out: number[];
  br?: number[]; // each bridge's health, in order (0: broken)
}
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

// A sprite as a flat white silhouette (made once per sprite image).
const whites = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function whiteOf(img: HTMLCanvasElement): HTMLCanvasElement {
  let w = whites.get(img);
  if (!w) {
    w = document.createElement('canvas');
    w.width = img.width;
    w.height = img.height;
    const g = w.getContext('2d')!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w.width, w.height);
    whites.set(img, w);
  }
  return w;
}

export class IsoGame implements GameLike {
  readonly fine = true;
  // The side you play: 0 (Cobalt) in single player; your color in a
  // multiplayer game, where players lists everyone and net says whether this
  // screen is the host (which runs the game) or a player's (which shows it).
  me = 0;
  players: Player[] | null = null;
  net: 'solo' | 'host' | 'client' = 'solo';
  // Orders from a player's screen go to the host this way (net: 'client').
  onCommand: (cmd: Command) => void = () => {};
  // Sides that have lost everything, and a message when that changes (you
  // are out, or the last one standing).
  out = new Set<number>();
  onOutcome: (won: boolean) => void = () => {};
  private nextId = 1;
  /** No shroud (the landing page's view of a world). */
  noShroud = false;
  // what has left the game, and messages for other players, since the last snapshot
  private gone: [number, number][] = [];
  private told: [number, string, string][] = [];
  terrain!: IsoTerrain;
  units: Unit[] = [];
  buildings: Building[] = [];
  props: Prop[] = [];
  particles: Particle[] = [];
  // where you tapped an order: the move (or attack, foe) burst plays there
  markers: { x: number; y: number; z: number; t: number; foe?: boolean; ore?: boolean; enter?: boolean; fix?: boolean }[] = [];
  fx = new Fx();
  ruins: Ruin[] = [];
  private fires: Fire[] = [];
  private bStates = new Map<string, BuildingStates>();
  // Mark where a move or attack order goes. main.ts turns it off for the
  // mouse, whose cursor plays the burst instead.
  moveMarks = true;
  sparkles: { x: number; y: number; life: number }[] = [];
  // sparks, and lumps of ore (col: their color, max: how long they last)
  sparks: { x: number; y: number; vx: number; vy: number; life: number; max?: number; col?: string }[] = [];
  art: V2FactionArt[];
  bArt = new Map<string, V2BuildingArt>();
  trees = makeTrees();
  rocks = makeRocks();
  bushes = makeBushes();
  clutter = makeClutter();
  dish = makeDish();
  oreArt: OreArt = makeOre();
  hutArt = makeHut();
  bridges: Bridge[] = [];
  // Ctrl or Cmd held (main.ts keeps it up to date): a click fires on a bridge
  force = false;
  ore: OreNode[] = [];
  private oreGrid = new Map<number, OreNode[]>();
  // a generator in the middle of each ore field, growing its ore back
  oreGens: OreGen<OreNode>[] = [];
  oreGenArt = makeOreGen();
  time = 0;
  onSelect: (names: string[]) => void = () => {};
  // which map generate() makes (see maps.ts), and the stage it starts at
  mapId = MAPS[0].id;
  stage: Stage = 'initial';
  // black over what you haven't seen yet (see shroud.ts)
  shroud: Shroud | null = null;
  // where each unit of yours last lifted it, and the buildings that have
  private looked = new WeakMap<Unit, [number, number]>();
  private lookedB = new WeakSet<Building>();

  stages(): { id: string; name: string; blurb: string }[] {
    return STAGES;
  }

  maps(): { id: string; name: string; blurb: string; players?: [number, number] }[] {
    return MAPS.map(({ id, name, blurb, players }) => ({ id, name, blurb, players }));
  }
  preview(id: string, w: number, h: number): HTMLCanvasElement {
    const def = mapDef(id);
    const ws = worldOf(def, w, h);
    return mapPreview(this.stage === 'combat' ? { ...def, home: combatHome(def) } : def, this.seed, ws.w, ws.h);
  }
  // The planet this map makes, given the usual size (small maps are smaller).
  worldSize(w: number, h: number): { w: number; h: number } {
    return worldOf(mapDef(this.mapId), w, h);
  }

  constructor(
    public ctx: CanvasRenderingContext2D,
    public seed: number,
  ) {
    this.art = FACTIONS.map(makeFactionArt);
  }

  // A building's damaged and ruined looks, drawn the first time they're needed.
  private states(kind: BuildingKind, f: number): BuildingStates {
    const key = `${kind}-${f}`;
    let s = this.bStates.get(key);
    if (!s) {
      s = makeBuildingStates(kind, factionOf(f));
      this.bStates.set(key, s);
    }
    return s;
  }

  get w(): number {
    return this.terrain.w;
  }
  get h(): number {
    return this.terrain.h;
  }

  mapVersion = 0;

  private emit(): void {
    const b = this.selB();
    // units of yours newly picked answer (the most common kind among them)
    const now = new Set(this.units.filter((u) => u.sel && u.f === this.me && !u.dead));
    const fresh = [...now].filter((u) => !this.heard.has(u));
    this.heard = now;
    if (fresh.length) this.speak(fresh, 'select');
    this.onSelect(b ? [MAKERS.includes(b.kind) ? `${BNAME[b.kind]} · tap ground: rally point` : BNAME[b.kind]] : this.selected().map((u) => UNIT[u.kind].name));
  }

  // The units of yours that were selected last time the selection changed.
  private heard = new Set<Unit>();

  // The most common kind among us says a line.
  private speak(us: Unit[], line: UnitLine): void {
    const n = new Map<Kind, number>();
    let best: Kind | null = null;
    for (const u of us) {
      const c = (n.get(u.kind) ?? 0) + 1;
      n.set(u.kind, c);
      if (!best || c > n.get(best)!) best = u.kind;
    }
    if (best) sayUnit(VOICE[best], line);
  }

  private selB(): Building | undefined {
    return this.buildings.find((b) => b.sel);
  }

  // A wall segment's look, which depends on the segments next to it (see
  // wallShape in sprites.ts): small, so drawn here when first wanted.
  private wArt = new Map<string, V2BuildingArt>();
  private wStates = new Map<string, BuildingStates>();
  private wallArt(link: number, f: number): V2BuildingArt {
    const key = `${link}-${f}`;
    let a = this.wArt.get(key);
    if (!a) this.wArt.set(key, (a = makeBuilding('wall', factionOf(f), link)));
    return a;
  }
  private wallHurt(link: number, f: number): BuildingStates {
    const key = `${link}-${f}`;
    let s = this.wStates.get(key);
    if (!s) this.wStates.set(key, (s = makeBuildingStates('wall', factionOf(f), link)));
    return s;
  }

  // Where each side's wall segments stand (grid cells), for joining them up.
  private wallSet(): Set<string> {
    const at = new Set<string>();
    for (const b of this.buildings) if (b.kind === 'wall' && !b.sold) at.add(wallKey(b.f, b.x, b.y));
    return at;
  }

  // How the wall segment of side f at (x, y) joins the ones round it, given
  // where they stand: which neighbors hold wall, and a pier every third
  // segment along a straight run.
  private wallLink(at: Set<string>, f: number, x: number, y: number): number {
    const G = WALL_GRID;
    const bare = (x: number, y: number) =>
      (at.has(wallKey(f, x + G, y)) ? LINK_E : 0) | (at.has(wallKey(f, x, y + G)) ? LINK_S : 0) | (at.has(wallKey(f, x - G, y)) ? LINK_W : 0) | (at.has(wallKey(f, x, y - G)) ? LINK_N : 0);
    const m = bare(x, y);
    // (not right next to a corner or an end, which has a pier of its own)
    const run = m === (LINK_E | LINK_W) ? [x, G, 0] : m === (LINK_S | LINK_N) ? [y, 0, G] : null;
    if (run && ((Math.round(run[0] / G) % 3) + 3) % 3 === 0 && bare(x + run[1], y + run[2]) === m && bare(x - run[1], y - run[2]) === m) return m | LINK_PIER;
    return m;
  }

  // The cells a wall put down by side f at (x, y) would fill: just that one,
  // or, when another of its walls stands in a straight line with it a few
  // cells off, the run up to that wall (the nearest, if there are several),
  // as long as all of the ground between is open.
  private wallRun(f: number, x: number, y: number, at = this.wallSet()): [number, number][] {
    const G = WALL_GRID;
    const one: [number, number][] = [[x, y]];
    if (at.has(wallKey(f, x, y))) return one;
    const art = this.buildingArt('wall', f);
    let best: [number, number][] | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cells: [number, number][] = [[x, y]];
      for (let i = 1; i <= WALL_FILL + 1; i++) {
        const cx = x + dx * i * G;
        const cy = y + dy * i * G;
        if (at.has(wallKey(f, cx, cy))) {
          if (i > 1 && (!best || cells.length < best.length)) best = cells;
          break;
        }
        if (this.placeWhy(padOf('wall', art, cx, cy), f, false, false)) break;
        cells.push([cx, cy]);
      }
    }
    return best ?? one;
  }

  private buildingArt(kind: BuildingKind, f: number): V2BuildingArt {
    const key = `${kind}-${f}`;
    let a = this.bArt.get(key);
    if (!a) {
      a = makeBuilding(kind, factionOf(f));
      this.bArt.set(key, a);
    }
    return a;
  }

  // The stages of a building going up (see makeConstruction), drawn by a
  // worker when first wanted (null until they arrive: it is just revealed
  // from the ground up until then). Without workers they are drawn here, a
  // frame after they are first wanted.
  private stageArt = new Map<string, StackSprite[] | null>();
  riseArt(kind: BuildingKind, f: number, urgent = true): StackSprite[] | null {
    const key = `${kind}-${f}`;
    if (this.stageArt.has(key)) return this.stageArt.get(key)!;
    this.stageArt.set(key, null);
    void constructionArt(kind, f, urgent).then((st) => {
      if (st) this.stageArt.set(key, st);
      else setTimeout(() => this.stageArt.set(key, makeConstruction(kind, factionOf(f))), 0);
    });
    return null;
  }

  // The light in a building's windows (makeBuildingGlow), drawn by a worker
  // when first wanted; null until it arrives, or if the building has none.
  private glowSpr = new Map<string, StackSprite | null>();
  glowOf(kind: BuildingKind, f: number): StackSprite | null {
    const key = `${kind}-${f}`;
    if (this.glowSpr.has(key)) return this.glowSpr.get(key)!;
    this.glowSpr.set(key, null);
    void glowArt(kind, f).then((st) => {
      if (st) this.glowSpr.set(key, st[0] ?? null);
      else setTimeout(() => this.glowSpr.set(key, makeBuildingGlow(kind, factionOf(f))), 0);
    });
    return null;
  }

  // A building's art, drawn by a worker: its footprint is there at once, so
  // generate() can place it, and its picture arrives later (or is drawn here
  // if it is wanted before then).
  private artLater(kind: BuildingKind, f: number, urgent: boolean): Promise<void> {
    const key = `${kind}-${f}`;
    if (this.bArt.has(key)) return Promise.resolve();
    let spr: StackSprite | undefined;
    const a = {
      ...buildingFoot(kind, factionOf(f)),
      get spr(): StackSprite {
        return (spr ??= makeBuilding(kind, factionOf(f)).spr);
      },
    };
    this.bArt.set(key, a);
    return workerBuilding(kind, f, urgent).then((w) => {
      if (w) spr ??= w.spr;
      else if (urgent) void a.spr; // no workers: draw it now, while the loading screen is up
    });
  }

  // ---------- Getting ready (the loading screen, see main.ts) ----------
  // The art is drawn off the main thread (art-pool.ts) while the loading
  // screen is up, so play starts without stutters: first the buildings
  // generate() places, then each unit's heading as it starts out. The rest
  // follow in the background.

  /** Before generate(): the buildings it will place (it needn't wait for them). */
  preload(): Promise<unknown>[] {
    const all: BuildingKind[] = ['yard', 'lab', 'power', 'barracks', 'refinery', 'radar', 'factory', 'tower', 'pillbox', 'silo', 'helipad', 'prism', 'aa', 'depot', 'wall', 'uplink', 'navy', 'derrick'];
    const placed = new Set<BuildingKind>(['yard', ...BASE_B]);
    const now: [BuildingKind, number][] = [...placed].map((k) => [k, ENEMY]);
    if (this.stage === 'combat') now.push(...COMBAT_B.map((k): [BuildingKind, number] => [k, this.me]));
    else now.push(['yard', this.me]);
    const get = (kind: BuildingKind, f: number, urgent: boolean) => this.artLater(kind, f, urgent);
    // the tech oil derricks nobody holds yet, out on every map
    now.push(['derrick', NEUTRAL_F]);
    const waits = now.map(([k, f]) => get(k, f, true));
    // what you can build, for later
    for (const k of all) void get(k, this.me, false);
    return waits;
  }

  // The heading sets a unit is drawn with, and the heading it shows now.
  private unitSets(u: Unit): [StackSprite[], number][] {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    switch (u.kind) {
      case 'mcv':
        return [[art.mcv, di]];
      case 'inf':
      case 'rocket':
      case 'gren':
      case 'eng':
      case 'dog':
      case 'cmdo':
      case 'flamer':
        return [...footFrames(art, u.kind), ...(u.kind === 'inf' ? art.infantryDug : [])].map((s): [StackSprite[], number] => [s, dirIndex(u.a, 16)]);
      case 'light':
      case 'heavy':
      case 'scorch':
      case 'lumen':
      case 'skyguard': {
        const [hull, tur] = tankParts(art, u.kind);
        return [[hull, di], [tur, dirIndex(u.turret, DIRS)]];
      }
      case 'heli':
        return [[art.heli, di]];
      case 'heron':
        return [[art.heron, di]];
      case 'jet':
        return [[art.jet, di]];
      case 'plane':
        return [[art.plane, di]];
      case 'boat':
      case 'otter':
      case 'cruiser':
        return [[art.cruiser, di], [art.cruiserTop, di], [art.aaGun, dirIndex(u.turret, DIRS)]];
      case 'destroyer':
      case 'carrier':
      case 'sub':
        return [[art[u.kind], di]];
      case 'hauler':
        return art.haulerLoad.map((s): [StackSprite[], number] => [s, di]);
      case 'comet':
        return [[art.comet, di], [art.cometEmpty, di]];
      case 'buggy':
        return [[art.buggy, di]];
      case 'apc':
        return [[art.apc, di]];
      default:
        return [[art.artillery, di]];
    }
  }

  /** After generate(): what is in play, as it is now; the rest of it after. */
  warmUp(): Promise<unknown>[] {
    const waits: Promise<unknown>[] = [];
    const sets: StackSprite[][] = [];
    // only what is near where you start is waited for
    const f = this.focus();
    const near = (wx: number, wy: number) => {
      const [sx, sy] = toScreen(wx, wy);
      const dx = Math.abs(sx - f.x) % this.w;
      const dy = Math.abs(sy - f.y) % this.h;
      return Math.min(dx, this.w - dx) < 1400 && Math.min(dy, this.h - dy) < 900;
    };
    const add = (arr: StackSprite[], d: number, now: boolean) => {
      const s = dirSet(arr);
      if (!s) return;
      if (!sets.includes(arr)) sets.push(arr);
      if (s.ready(d)) return;
      const p = prefetch(s.key, d, now);
      if (now) waits.push(p);
    };
    // yours first: they're what you see and move first
    const us = [...this.units].sort((a, b) => (a.f === this.me ? 0 : 1) - (b.f === this.me ? 0 : 1));
    for (const u of us) for (const [arr, d] of this.unitSets(u)) add(arr, d, near(u.x, u.y));
    for (const b of this.buildings) {
      const now = near(b.x, b.y);
      if (b.kind === 'tower') add(this.art[b.f].towerGun, dirIndex(b.gun, DIRS), now);
      if (b.kind === 'aa') add(this.art[b.f].aaGun, dirIndex(b.gun, DIRS), now);
      if (b.kind === 'radar') for (let d = 0; d < 16; d++) add(this.dish, d, now);
    }
    // then every heading of those, and of everything you can make
    const mine = this.art[this.me];
    for (const arr of [mine.mcv, mine.lightTank, mine.lightTurret, mine.heavyTank, mine.heavyTurret, mine.scorchTank, mine.scorchTurret, mine.lumenTank, mine.lumenTurret, mine.skyguardTank, mine.skyguardTurret, mine.buggy, mine.apc, mine.artillery, mine.comet, mine.cometEmpty, mine.heli, mine.boat, ...mine.haulerLoad, ...mine.infantry, ...mine.rocket, ...mine.dog, ...mine.flamer, ...mine.haulerDig])
      if (!sets.includes(arr)) sets.push(arr);
    for (const arr of sets) {
      const s = dirSet(arr);
      if (s) for (let d = 0; d < s.dirs; d++) if (!s.ready(d)) void prefetch(s.key, d);
    }
    // the bridges near you now, the rest in the background
    for (const b of this.bridges) {
      const now = near(b.x, b.y);
      const p = this.bridgeReady(b, false, now);
      if (now) waits.push(p);
    }
    // a hauler only ever tips its bed on a refinery's pad, facing out
    for (const arr of mine.haulerDump) {
      const s = dirSet(arr);
      const d = dirIndex(DOCK_A, DIRS);
      if (s && !s.ready(d)) void prefetch(s.key, d);
    }
    return waits;
  }

  // Single player: two sides, you starting with a Foundry vehicle and a
  // small escort, and the enemy dug in with a full base and an army on the
  // far side of the planet. Multiplayer (players set): every player starts
  // like you, at the map's starts furthest apart. Sites are chosen on the
  // screen-space map and placed on the ground below. Every player's screen
  // makes the same world from the same seed.
  generate(w: number, h: number): void {
    const rand = rng(this.seed * 7919 + 29);
    const def = mapDef(this.mapId);
    const T = (this.terrain = new IsoTerrain(w, h, this.seed, def));
    const rivers = riversFor(def, this.seed, w, h);
    T.setRivers(rivers);
    this.bridges = [];
    this.decks.clear();
    this.units = [];
    this.buildings = [];
    this.props = [];
    this.particles = [];
    this.markers = [];
    this.sparkles = [];
    this.sparks = [];
    this.fx.clear();
    this.ruins = [];
    this.fires = [];
    this.lastTap = null;
    this.mapVersion++;
    this.nextId = 1;
    this.gone = [];
    this.told = [];
    this.out = new Set();
    const mp = !!this.players;
    if (mp) this.stage = 'initial';
    const combat = this.stage === 'combat';
    this.eco = FACTIONS.map(() => newEco(combat ? COMBAT_CREDITS : START_CREDITS));
    this.posts = [];
    this.aiJobs = new Map();
    this.aiT = 0;
    this.ore = [];
    this.oreGrid = new Map();
    this.oreGens = [];
    this.seaCells = new Map();
    this.landCells = new Map();
    this.blocksKey = '';
    this.lowWarned = false;
    this.known = new Set();
    this.fresh = new Set();
    this.ghost = null;
    this.forestF = new WorldField(w, h, 50, this.seed + 500, 2, 10);
    this.ov = null;

    const flat = (sx: number, sy: number) => {
      const [x, y] = T.at(sx, sy);
      return T.k(x, y) === K.Grass && T.k(x + 40, y + 40) === K.Grass && T.k(x - 40, y - 40) === K.Grass;
    };
    const wrapS = (sx: number, sy: number): [number, number] => [sx - Math.floor(sx / w) * w, sy - Math.floor(sy / h) * h];
    // the nearest open, level grass to a screen point, spiralling out
    const findLand = (sx0: number, sy0: number, reach = 3000): [number, number] | null => {
      for (let r = 0; r < reach; r += 16)
        for (let t = 0; t < Math.max(1, r / 8); t++) {
          const a = rand() * Math.PI * 2;
          const sx = sx0 + Math.cos(a) * r;
          const sy = sy0 + Math.sin(a) * r * 0.5;
          if (flat(sx, sy)) return wrapS(sx, sy);
        }
      return null;
    };
    type Site = { sx: number; sy: number; f: number };
    const at = (p: [number, number], f: number): Site => {
      const [sx, sy] = findLand(p[0] * w, p[1] * h) ?? [p[0] * w, p[1] * h];
      return { sx, sy, f };
    };
    // open sea round a world point, with room for a carrier
    const openSea = (x: number, y: number) => {
      if (T.k(x, y) !== K.Water) return false;
      for (const r of [40, 80])
        for (let i = 0; i < 16; i++) if (T.k(x + Math.cos((i / 16) * Math.PI * 2) * r, y + Math.sin((i / 16) * Math.PI * 2) * r) !== K.Water) return false;
      return true;
    };
    // a little water a world point's Naval yard could sit on
    const pondAt = (x: number, y: number) => T.k(x, y) === K.Water && T.k(x + 30, y) === K.Water && T.k(x - 30, y) === K.Water && T.k(x, y + 30) === K.Water && T.k(x, y - 30) === K.Water;
    // ...a short sail from a screen point (in reach of a base round it)
    const bySea = (sx: number, sy: number, wet: (x: number, y: number) => boolean) => {
      const [x, y] = T.at(sx, sy);
      for (let d = 110; d <= 230; d += 24)
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          if (wet(x + Math.cos(a) * d, y + Math.sin(a) * d)) return true;
        }
      return false;
    };
    // In the Combat stage your base goes on the coast nearest its usual spot,
    // so it has a Naval yard and every ship too: open sea with room for the
    // carrier if there's any in reach, or else a lake, no nearer the enemy
    // than about two thirds of the usual way. Back on the usual spot if
    // there's no water at all.
    const coastal = (p: [number, number], foe: Site): Site => {
      const sx0 = p[0] * w;
      const sy0 = p[1] * h;
      const [ex, ey] = nearestCopy(sx0, sy0, foe.sx, foe.sy, w, h);
      const apart = Math.hypot(ex - sx0, ey - sy0);
      for (const [wet, reach] of [
        [openSea, 2400],
        [pondAt, 1600],
      ] as const)
        for (let r = 0; r < reach; r += 24)
          for (let t = 0; t < Math.max(1, r / 12); t++) {
            const a = rand() * Math.PI * 2;
            const [sx, sy] = wrapS(sx0 + Math.cos(a) * r, sy0 + Math.sin(a) * r * 0.5);
            if (!flat(sx, sy) || !bySea(sx, sy, wet)) continue;
            const [nx, ny] = nearestCopy(sx, sy, foe.sx, foe.sy, w, h);
            if (Math.hypot(nx - sx, ny - sy) < apart * 0.65) continue;
            return { sx, sy, f: this.me };
          }
      return at(p, this.me);
    };
    // where each side starts: in single player you, then the enemy base
    const sites: Site[] = mp
      ? startsFor(def, this.players!.length).map((p, i) => at(p, this.players![i].f))
      : combat
        ? (() => {
            const foe = at(def.enemy, ENEMY);
            return [coastal(combatHome(def), foe), foe];
          })()
        : [at(def.home, this.me), at(def.enemy, ENEMY)];
    const homeSite = sites.find((st) => st.f === this.me) ?? sites[0];
    const foe = sites[1] ?? sites[0];

    // roads from each start to the next (in single player, from yours to the
    // enemy base), kept to dry land: each winds between waypoints found on the way
    const lines: [number, number][][] = [];
    const road = (a: Site, b: Site) => {
      const pts: [number, number][] = [[a.sx, a.sy]];
      const steps = 8;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const p = findLand(a.sx + (b.sx - a.sx) * t, a.sy + (b.sy - a.sy) * t, 900);
        if (p) {
          // keep it on the same lap as the line it follows
          const [lx, ly] = pts[pts.length - 1];
          pts.push(nearestCopy(lx, ly, p[0], p[1], w, h));
        }
      }
      {
        const [lx, ly] = pts[pts.length - 1];
        pts.push(nearestCopy(lx, ly, b.sx, b.sy, w, h));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = T.at(...pts[i]);
        const [bx, by] = T.at(...pts[i + 1]);
        lines.push(windingRoad(ax, ay, bx, by, rand));
      }
    };
    if (sites.length > 1) for (let i = 0; i < (sites.length > 2 ? sites.length : 1); i++) road(sites[i], sites[(i + 1) % sites.length]);
    // bridges where the roads cross the rivers, and a few more
    const planned = planBridges(T, rivers, lines, rand);
    T.setRoads(planned.roads);
    planned.bridges.forEach((p, i) => {
      const L = bridgeLen(p.n);
      const [x, y] = T.fold(p.x, p.y);
      const rx = p.axis === 0 ? L / 2 : DECK_W;
      const ry = p.axis === 0 ? DECK_W : L / 2;
      const huts = p.huts.map(([hx, hy]): [number, number] => [x + hx - p.x, y + hy - p.y]);
      for (const [hx, hy] of huts) T.markPad({ x: hx - HUT_R - 1, y: hy - HUT_R - 1, w: HUT_R * 2 + 2, h: HUT_R * 2 + 2 });
      this.bridges.push({ id: BRIDGE_ID + i, kind: 'bridge', f: -1, style: p.style, axis: p.axis, x, y, n: p.n, L, art: { rx, ry }, pad: { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 }, hp: 1, huts });
    });
    this.refreshDecks();

    const pads: Rect[] = [];
    const place = (kinds: BuildingKind[], f: number, sx: number, sy: number) => {
      const [cx, cy] = T.at(sx, sy);
      for (const kind of kinds) {
        const art = this.buildingArt(kind, f);
        let ok = false;
        for (let ring = 0; ring < 70 && !ok; ring++) {
          const tries = ring === 0 ? 1 : 10 + ring * 2;
          for (let t = 0; t < tries && !ok; t++) {
            const ang = rand() * Math.PI * 2;
            const x = Math.round(cx + Math.cos(ang) * ring * 4);
            const y = Math.round(cy + Math.sin(ang) * ring * 4);
            const pad = { x: x - art.rx - 3, y: y - art.ry - 3, w: art.rx * 2 + 6, h: art.ry * 2 + 6 };
            if (!T.clear(pad, 1)) continue;
            if (pads.some((p) => overlap(p, pad, 4))) continue;
            pads.push(pad);
            T.markPad(pad);
            this.addBuilding({ id: 0, kind, f, x, y, art, phase: rand() * 10, gun: rand() * Math.PI * 2, gunGoal: rand() * Math.PI * 2, pad, sel: false, rise: 1, hp: 1 });
            ok = true;
          }
        }
      }
    };
    if (!mp) place(['yard', ...BASE_B], foe.f, foe.sx, foe.sy);
    // in the Combat stage you have a full base too, already built
    if (combat) {
      place(COMBAT_B, this.me, homeSite.sx, homeSite.sy);
      // the Naval yard, on the nearest open water to the base
      const yd = this.buildings.find((b) => b.f === this.me && b.kind === 'yard');
      // (by open sea, with room for the carrier, rather than a pond if there's a choice)
      const seaNear = ([x, y]: [number, number]) => {
        for (let d = 40; d <= 220; d += 20) for (let i = 0; i < 16; i++) if (openSea(x + Math.cos((i / 16) * Math.PI * 2) * d, y + Math.sin((i / 16) * Math.PI * 2) * d)) return true;
        return false;
      };
      let wet: [number, number] | null = null;
      let pond: [number, number] | null = null;
      for (const b of this.buildings) {
        if (wet || b.f !== this.me) continue;
        for (let t = 0; t < 4 && !wet; t++) {
          const p = this.findSite(this.me, 'navy', b.x, b.y, rand);
          if (p && seaNear(p)) wet = p;
          else pond ??= p;
        }
      }
      wet ??= pond;
      if (wet && yd) {
        const art = this.buildingArt('navy', this.me);
        const pad = padOf('navy', art, wet[0], wet[1]);
        // (out on the water: no concrete goes down under it)
        this.addBuilding({ id: 0, kind: 'navy', f: this.me, x: wet[0], y: wet[1], art, phase: 0, gun: 0, gunGoal: 0, pad, sel: false, rise: 1, hp: 1 });
      }
      // what it opens up is already known, not news
      for (const t of this.available()) this.known.add(t.id);
    }

    // tech oil derricks out between the starts, for anyone to capture: two
    // either side of the way between the two starts, or one beside the way
    // between each pair of neighbors when there are more
    const derrickAt = (sx0: number, sy0: number, clear: number): boolean => {
      const [cx, cy] = T.at(sx0, sy0);
      const art = this.buildingArt('derrick', NEUTRAL_F);
      for (let ring = 0; ring < 120; ring++) {
        const tries = ring === 0 ? 1 : 8 + ring;
        for (let t = 0; t < tries; t++) {
          const ang = rand() * Math.PI * 2;
          const x = Math.round(cx + Math.cos(ang) * ring * 6);
          const y = Math.round(cy + Math.sin(ang) * ring * 6);
          const pad = { x: x - art.rx - 3, y: y - art.ry - 3, w: art.rx * 2 + 6, h: art.ry * 2 + 6 };
          if (!T.clear(pad, 1) || pads.some((p) => overlap(p, pad, 40))) continue;
          const [px, py] = toScreen(x, y);
          if (sites.some((st) => {
            const [nx, ny] = nearestCopy(px, py, st.sx, st.sy, w, h);
            return Math.hypot(nx - px, ny - py) < clear;
          })) continue;
          pads.push(pad);
          T.markPad(pad);
          this.addBuilding({ id: 0, kind: 'derrick', f: NEUTRAL_F, x, y, art, phase: rand() * 10, gun: 0, gunGoal: 0, pad, sel: false, rise: 1, hp: 1 });
          return true;
        }
      }
      return false;
    };
    // (on a small or crowded map, closer to the starts if need be)
    const derrickNear = (sx0: number, sy0: number) => [1, 0.7, 0.45].some((k) => derrickAt(sx0, sy0, DERRICK.clear * k));
    if (sites.length > 1) {
      const pairs = sites.length > 2 ? sites.length : 1;
      for (let i = 0; i < pairs; i++) {
        const a = sites[i];
        const b = sites[(i + 1) % sites.length];
        const [mx, my] = nearestCopy(a.sx, a.sy, b.sx, b.sy, w, h);
        const L = Math.hypot(mx - a.sx, my - a.sy) || 1;
        const off = Math.min(DERRICK.off, L * 0.25);
        for (const k of pairs === 1 ? [1, -1] : [i % 2 ? 1 : -1]) derrickNear((a.sx + mx) / 2 - ((my - a.sy) / L) * off * k, (a.sy + my) / 2 + ((mx - a.sx) / L) * off * k);
      }
      // and wherever there is room, if the way between was all water or hills
      const want = pairs === 1 ? 2 : pairs;
      for (let t = 0; t < 40 && this.buildings.filter((b) => b.kind === 'derrick').length < want; t++) derrickAt(rand() * w, rand() * h, DERRICK.clear * 0.7);
    }

    // a little clutter beside some buildings
    for (const b of this.buildings) {
      if (!['factory', 'refinery', 'barracks'].includes(b.kind)) continue;
      const ci = b.kind === 'barracks' ? 2 : Math.floor(rand() * 2);
      const x = b.x + b.art.rx + 4;
      const y = b.y + (rand() - 0.5) * b.art.ry;
      if (T.k(x, y) === K.Pad || T.k(x, y) === K.Grass) this.props.push({ spr: this.clutter[ci], x, y, z: 0 });
    }

    // armies
    const spawn = (kind: Kind, f: number, csx: number, csy: number, spread: number): Unit | null => {
      for (let t = 0; t < 300; t++) {
        const sx = csx + (rand() - 0.5) * spread * 2;
        const sy = csy + (rand() - 0.5) * spread;
        let [x, y] = toWorld(sx, sy, 0);
        const k = T.k(x, y);
        const water = (dx: number, dy: number) => T.k(x + dx, y + dy) === K.Water;
        const ok =
          kind === 'boat'
            ? water(0, 0) && water(12, 0) && water(-12, 0) && water(0, 12) && water(0, -12)
            : isAir(kind) || k === K.Grass || k === K.Road || k === K.Pad;
        if (!ok || T.isHigh(x, y)) continue;
        if (!isAir(kind) && this.buildings.some((b) => Math.abs(b.x - x) < b.art.rx + 3 && Math.abs(b.y - y) < b.art.ry + 3)) continue;
        [x, y] = T.fold(x, y);
        const a = rand() * Math.PI * 2;
        if (kind === 'mcv' && !this.siteOk(this.siteOf(x, y))) continue;
        const u = this.newUnit(kind, f, x, y, a);
        u.anim = rand() * 10;
        u.idle = rand() * 4;
        return u;
      }
      return null;
    };
    const army: [Kind, number][] = [
      ['light', 6],
      ['heavy', 3],
      ['buggy', 3],
      ['hauler', 1],
      ['arty', 2],
      ['heli', 1],
      ['inf', 8],
      ['rocket', 4],
      ['gren', 3],
    ];
    // you start with a handful: the Foundry vehicle and a small escort
    const start: [Kind, number][] = combat
      ? [...GARRISON, ...COMBAT_EXTRA]
      : [
          ['mcv', 1],
          ['light', 2],
          ['buggy', 1],
          ['inf', 3],
        ];
    // each player's Foundry vehicle starts on the nearest open ground to its site
    const starters = mp ? sites : [homeSite];
    const spots = starters.map((st): [number, number] => {
      for (let r = 0; r < (combat ? 0 : 1200); r += 12)
        for (let t = 0; t < Math.max(1, r / 6); t++) {
          const a = rand() * Math.PI * 2;
          const sx = st.sx + Math.cos(a) * r;
          const sy = st.sy + Math.sin(a) * r * 0.5;
          const [x, y] = toWorld(sx, sy, 0);
          if (this.siteOk(this.siteOf(x, y))) return [sx, sy];
        }
      return [st.sx, st.sy];
    });
    // ore fields: two near each start, one by the enemy base, one half way
    // between neighbors, and more scattered round the land
    const startSites = spots.map((ms) => this.siteOf(...toWorld(ms[0], ms[1], 0)));
    const field = (sx: number, sy: number, n: number) => {
      const reach = 6 + Math.sqrt(n) * 5.5;
      // the generator in the middle, the clumps round it
      const [gx, gy] = T.fold(...toWorld(sx, sy, 0));
      const nodes: OreNode[] = [];
      for (let i = 0, t = 0; i < n && t < n * 30; t++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * reach;
        const [x, y] = toWorld(sx + Math.cos(a) * d * 1.6, sy + Math.sin(a) * d * 0.8, 0);
        if (T.k(x, y) !== K.Grass || T.k(x + 5, y + 5) !== K.Grass || T.k(x - 5, y - 5) !== K.Grass) continue;
        if (startSites.some((ss) => inside(x, y, ss, 10))) continue;
        if (this.oreNear(x, y, 5).length) continue;
        const [fx, fy] = T.fold(x, y);
        const [px, py] = this.nearPoint(gx, gy, fx, fy);
        if (Math.hypot(px - gx, py - gy) < 7) continue;
        const node = { x: fx, y: fy, amt: ORE.node * (0.6 + rand() * 0.4), v: Math.floor(rand() * 4) };
        this.addOre(node);
        nodes.push(node);
        i++;
      }
      if (!nodes.length || T.k(gx, gy) !== K.Grass) return;
      const dist = (o: OreNode) => {
        const [px, py] = this.nearPoint(gx, gy, o.x, o.y);
        return Math.hypot(px - gx, py - gy);
      };
      nodes.sort((a, b) => dist(a) - dist(b));
      this.oreGens.push({ x: gx, y: gy, nodes });
    };
    const nearField = (cx: number, cy: number, r0: number, n: number) => {
      for (let t = 0; t < 60; t++) {
        const a = rand() * Math.PI * 2;
        const r = r0 + rand() * 60;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r * 0.5;
        const [x, y] = toWorld(sx, sy, 0);
        if (T.k(x, y) === K.Grass && !startSites.some((ss) => inside(x, y, ss, 40))) {
          field(sx, sy, n);
          return;
        }
      }
    };
    for (const ms of spots) {
      nearField(ms[0], ms[1], 170, 30);
      nearField(ms[0], ms[1], 420, 34);
    }
    if (!mp) nearField(foe.sx, foe.sy, 220, 28);
    for (let i = 0; i < (sites.length > 2 ? sites.length : 1) && sites.length > 1; i++) {
      const a = sites[i];
      const b = sites[(i + 1) % sites.length];
      const [mx, my] = nearestCopy(a.sx, a.sy, b.sx, b.sy, w, h);
      const mid = findLand((a.sx + mx) / 2, (a.sy + my) / 2, 900);
      if (mid) nearField(mid[0], mid[1], 0, 40);
    }
    const extra = Math.max(1, Math.round((w * h * (1 - def.water)) / 1.2e7));
    for (let i = 0; i < extra; i++)
      for (let t = 0; t < 60; t++) {
        const sx = rand() * w;
        const sy = rand() * h;
        if (!flat(sx, sy)) continue;
        nearField(sx, sy, 0, 16 + Math.floor(rand() * 16));
        break;
      }

    const mine: [number, number][] = [];
    starters.forEach((st, si) => {
      const ms = spots[si];
      for (const [kind, c] of start)
        for (let i = 0; i < c; i++) {
          const u =
            kind === 'mcv'
              ? spawn(kind, st.f, ms[0], ms[1], 0.5) ?? this.newUnit('mcv', st.f, ...T.fold(...toWorld(ms[0], ms[1], 0)), 0)
              : combat
                ? spawn(kind, st.f, ms[0] - 60, ms[1] + 140, 220)
                : spawn(kind, st.f, ms[0], ms[1] + 45, 70);
          if (u && st.f === this.me) mine.push(toScreen(u.x, u.y));
        }
    });
    if (combat) {
      // your refinery's hauler is already at work
      for (const b of this.buildings)
        if (b.f === this.me && b.kind === 'refinery') {
          b.gift = true;
          const u = this.newUnit('hauler', this.me, ...this.fold(b.x + DOCK[0], b.y + DOCK[1] + 6), Math.PI / 2);
          u.job = { st: 'seek', t: 0 };
          u.load = 0;
        }
      this.makePosts(foe.sx, foe.sy, homeSite.sx, homeSite.sy, rand);
      // planes parked on the Air command (the paratroopers loaded and ready)
      const air = this.buildings.find((b) => b.f === this.me && b.kind === 'radar');
      if (air)
        (['plane', 'jet', 'jet', 'jet'] as const).forEach((kind) => {
          const fp = this.freePad(this.me, kind, air);
          if (!fp) return;
          const st = air.art.fx[1 + fp[1]];
          const u = this.newUnit(kind, this.me, ...this.fold(air.x + st.x, air.y + st.y), Math.PI / 2);
          Object.assign(u, { fly: 0, nest: air.id, padI: fp[1] });
          if (kind === 'jet') u.ammo = JET_AMMO;
        });
      this.eco[this.me].paraT = 0;
      // ships off the Naval yard
      const yard = this.buildings.find((b) => b.f === this.me && b.kind === 'navy');
      if (yard)
        for (const kind of COMBAT_SHIPS) {
          // (the carrier needs room: well clear of the yard and the rest)
          if (kind === 'carrier') {
            const u = this.newUnit(kind, this.me, yard.x, yard.y, rand() * Math.PI * 2);
            const p = this.launchSpot(u, yard);
            if (p) [u.x, u.y, u.tx, u.ty, u.a] = [p[0], p[1], p[0], p[1], p[2]];
            else this.units.splice(this.units.indexOf(u), 1);
            continue;
          }
          for (let t = 0; t < 200; t++) {
            const a = rand() * Math.PI * 2;
            const d = 30 + rand() * (40 + t);
            const [x, y] = this.fold(yard.x + Math.cos(a) * d, yard.y + Math.sin(a) * d);
            const u = this.newUnit(kind, this.me, x, y, a);
            const ok = this.okAt(u, x, y) && T.k(x, y) === K.Water && this.units.every((o) => o === u || !isNaval(o.kind) || Math.hypot(o.x - x, o.y - y) > Math.max(26, UNIT[o.kind].r + UNIT[kind].r));
            if (ok) break;
            this.units.splice(this.units.indexOf(u), 1);
          }
        }
    }
    if (!mp) {
      for (const [kind, c] of army) for (let i = 0; i < c; i++) spawn(kind, foe.f, foe.sx + 60, foe.sy + 140, 220);
      // enemy patrol boats on the nearest water to their base
      let lake: [number, number] | null = null;
      for (let r = 100; r < 2000 && !lake; r += 100)
        for (let t = 0; t < 40 && !lake; t++) {
          const a = rand() * Math.PI * 2;
          const sx = foe.sx + Math.cos(a) * r;
          const sy = foe.sy + Math.sin(a) * r * 0.5;
          const [x, y] = toWorld(sx, sy, 0);
          if (T.k(x, y) === K.Water && T.k(x + 30, y) === K.Water && T.k(x - 30, y) === K.Water && T.k(x, y + 30) === K.Water && T.k(x, y - 30) === K.Water) lake = [sx, sy];
        }
      if (lake) for (let i = 0; i < 3; i++) spawn('boat', foe.f, lake[0], lake[1], 40);
    }
    for (const u of this.units) u.z = this.groundZ(u);

    const yard = combat && this.buildings.find((b) => b.f === this.me && b.kind === 'yard');
    this.home = yard ? { x: toScreen(yard.x, yard.y)[0], y: toScreen(yard.x, yard.y)[1] } : mine.length ? { x: mine.reduce((a, p) => a + p[0], 0) / mine.length, y: mine.reduce((a, p) => a + p[1], 0) / mine.length } : { x: homeSite.sx, y: homeSite.sy };
    this.tiles = new Tiles(w, h, (tx, ty) => this.buildTile(tx, ty), 220);
    this.shroud = NO_SHROUD || this.noShroud ? null : new Shroud(w, h, (sx, sy) => T.isWater(sx, sy));
    this.looked = new WeakMap();
    this.lookedB = new WeakSet();
    this.lookAround();
    // (no slivers of shroud left between what you can see at the start)
    this.shroud?.clearThin();
    this.emit();
  }

  // ---------- The shroud ----------

  // Where a unit is on screen, for the shroud: its feet, or a copter's body.
  private spot(u: Unit): [number, number] {
    return toScreen(u.x, u.y, u.z + this.alt(u));
  }

  // Can you see this enemy unit (it isn't under the shroud)? Yours always.
  private shown(u: Unit): boolean {
    if (u.f !== this.me && this.under(u) && !this.sonar(u, this.me)) return false;
    // (a submarine that has come up to fire shows to everyone, shroud or not)
    if (u.kind === 'sub' && !this.under(u)) return true;
    return u.f === this.me || !this.shroud || this.shroud.seen(...this.spot(u));
  }

  // Your units and buildings lift the shroud round themselves.
  private satUp = false;
  private lookAround(): void {
    const sh = this.shroud;
    if (!sh) return;
    for (const u of this.units) {
      if (u.f !== this.me || u.dead) continue;
      const last = this.looked.get(u);
      if (last && Math.abs(last[0] - u.x) + Math.abs(last[1] - u.y) < 6) continue;
      this.looked.set(u, [u.x, u.y]);
      sh.reveal(...this.spot(u), SIGHT[u.kind] * CELL);
    }
    // a Satellite uplink shows you the whole world while it stands; lose
    // the last one and the shroud comes back over what you can't see now
    const sat = this.buildings.some((b) => b.f === this.me && b.kind === 'uplink' && b.rise >= 1 && !b.dead);
    if (sat !== this.satUp) {
      this.satUp = sat;
      if (sat) {
        sh.revealAll();
        this.notice('Satellite uplink online: the whole map is revealed');
      } else {
        sh.hideAgain();
        this.looked = new WeakMap();
        this.lookedB = new WeakSet();
        this.notice('Satellite uplink lost: the map goes dark');
        return this.lookAround();
      }
    }
    for (const b of this.buildings) {
      if (b.f !== this.me || this.lookedB.has(b)) continue;
      this.lookedB.add(b);
      const [sx, sy] = toScreen(b.x, b.y);
      sh.reveal(sx, sy, Math.max(b.art.rx, b.art.ry) + (BSIGHT[b.kind] ?? 5) * CELL);
    }
    // (the globe's picture puts the shroud on itself: see shroudMap)
  }

  private home = { x: 0, y: 0 };
  private lastTap: { u: Unit; t: number } | null = null;

  private newUnit(kind: Kind, f: number, x: number, y: number, a: number): Unit {
    const u: Unit = { id: this.nextId++, kind, f, x, y, z: this.terrain.elev(x, y), a, turret: a, turretGoal: a, tx: x, ty: y, moving: false, sel: false, anim: 0, hp: 1, idle: 2, trackAcc: 0, lap: 0, lapY: 0 };
    this.units.push(u);
    return u;
  }

  // A soldier riding in a transport, known only from a snapshot: it is not
  // in play (not in this.units) until it gets out.
  private rider(kind: Kind, f: number, id: number): Unit {
    const u = this.newUnit(kind, f, 0, 0, 0);
    this.units.splice(this.units.indexOf(u), 1);
    u.id = id;
    return u;
  }

  private addBuilding(b: Building): Building {
    b.id = this.nextId++;
    this.buildings.push(b);
    return b;
  }

  // ---------- Building: credits, the build menu and placing ----------

  // Each side's purse and what it is making. In a multiplayer game every
  // player has one, kept by the host (see "Multiplayer" below); yours is
  // eco[me], which is what the build menu shows.
  eco: Eco[] = FACTIONS.map(() => newEco(START_CREDITS));
  get credits(): number {
    return this.eco[this.me].credits;
  }
  // what each tab of your menu is working on (one thing at a time), and the
  // units waiting behind the one being made
  private get jobs(): Map<Tab, Job> {
    return this.eco[this.me].jobs;
  }
  private get queue(): Map<Tab, Tech[]> {
    return this.eco[this.me].queue;
  }
  private known = new Set<string>(); // items that have been on the menu
  private fresh = new Set<string>(); // ...and those not looked at yet
  // (a wall's ghost also has the cells of the run it would fill, see wallRun)
  private ghost: { tech: Tech; x: number; y: number; pad: Rect; why: string; cells?: [number, number][] } | null = null;
  private icons = new Map<string, string>();
  onNotice: (msg: string) => void = () => {};
  private noted = new Map<string, number>();

  // A message for the player, at most every few seconds for the same one.
  private notice(msg: string): void {
    const t = this.noted.get(msg) ?? -1e9;
    if (this.time - t < 4) return;
    this.noted.set(msg, this.time);
    this.onNotice(msg);
  }

  // A message (and an announcement) for side f's player: yours straight
  // away, another player's sent with the host's next update.
  private tell(f: number, msg?: string, line?: Parameters<typeof announce>[0]): void {
    if (f === this.me) {
      if (msg) this.notice(msg);
      if (line) announce(line);
    } else if (this.net === 'host' && this.players?.some((p) => p.f === f)) this.told.push([f, msg ?? '', line ?? '']);
  }

  // Kinds of building side f (you, unless said) has standing.
  private have(f = this.me): Set<BuildingKind> {
    const s = new Set<BuildingKind>();
    for (const b of this.buildings) if (b.f === f && b.rise >= 1 && !b.packing) s.add(b.kind);
    return s;
  }

  private available(have = this.have()): Tech[] {
    return TECH.filter((t) => t.needs.every((k) => have.has(k)));
  }

  // The build menu's picture of something: a photo-like render of it, the
  // same for every faction (src/v2/cameo.ts).
  private icon(t: Tech): string {
    return cameoUrl(t.id);
  }

  // A small picture of a tab's kind of thing for its button: a Power plant,
  // a Gun tower, a soldier's head and shoulders and a tank, cut out of the
  // build menu's renders (src/v2/cameo.ts).
  private tabIcon(tab: Tab): string {
    return tabIconUrl(tab);
  }

  // The sprites a unit is drawn from, facing down and to the left.
  private unitLayers(kind: Kind): StackSprite[] {
    const a = Math.PI * 0.62;
    const art = this.art[this.me];
    const di = dirIndex(a, DIRS);
    return isFoot(kind)
      ? [footFrames(art, kind)[0][dirIndex(a, 16)]]
      : kind === 'cruiser'
        ? cruiserParts(art, 0, 0, 0, a, a).map(([s]) => s)
        : TURRETED.has(kind)
        ? tankParts(art, kind).map((s) => s[di])
        : [{ mcv: art.mcv, buggy: art.buggy, apc: art.apc, hauler: art.hauler, arty: art.artillery, comet: art.comet, heli: art.heli, heron: art.heron, jet: art.jet, plane: art.plane, boat: art.boat, otter: art.otter, destroyer: art.destroyer, cruiser: art.cruiser, carrier: art.carrier, sub: art.sub }[kind as 'mcv'][di]];
  }

  // A unit kind's picture: the unit itself, facing down and to the left,
  // blown up in whole pixels.
  private unitIcon(kind: Kind): string {
    let url = this.icons.get(`unit:${kind}`);
    if (!url) {
      const W = 64;
      const H = 48;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d')!;
      {
        const layers = this.unitLayers(kind);
        const base = layers[0];
        const k = Math.max(1, Math.min(3, Math.floor(Math.min(W / (base.w * 0.55), H / (base.h * 0.65)))));
        c.imageSmoothingEnabled = false;
        c.translate(W / 2, H / 2 + 4);
        c.scale(k, k);
        for (const s of layers) c.drawImage(s.img, -s.cx, -s.cy, s.w, s.h);
      }
      url = cv.toDataURL();
      this.icons.set(`unit:${kind}`, url);
    }
    return url;
  }

  private queued(t: Tech): number {
    return (this.queue.get(t.tab) ?? []).filter((q) => q === t).length;
  }

  buildMenu(): BuildMenu | null {
    const have = this.have();
    const avail = this.available(have);
    if (!avail.length && !this.jobs.size) return null;
    const items: BuildItem[] = [];
    const list = [...avail];
    for (const j of this.jobs.values()) if (!list.includes(j.tech)) list.push(j.tech);
    for (const t of list) {
      const j = this.jobs.get(t.tab);
      const mine = j && j.tech === t;
      let blocked: string | undefined;
      if (t.building && !have.has('yard')) blocked = 'Needs a Construction yard';
      else if (t.building && j && !mine) blocked = `Busy: ${j.tech.name}`;
      else if (!mine && this.credits <= 0) blocked = 'No credits';
      else if (t.unit === 'cmdo' && this.hasCommando(this.me)) blocked = 'One at a time';
      else if (t.unit === 'plane' && !mine && this.hasPlane(this.me)) blocked = 'One at a time';
      items.push({
        id: t.id,
        name: t.name,
        tab: t.tab,
        cost: t.cost,
        icon: this.icon(t),
        blurb: t.blurb,
        state: !mine ? 'idle' : j.ready ? 'ready' : j.paused ? 'paused' : 'building',
        progress: mine ? j.spent / t.cost : 0,
        count: (mine ? 1 : 0) + this.queued(t),
        isNew: this.fresh.has(t.id),
        blocked,
      });
    }
    // the paratroopers, at the top of the Defense tab while you have a
    // Paratrooper plane: loading, ready to call in, or out on a drop
    const plane = this.paraPlane(this.me);
    if (plane) {
      const e = this.eco[this.me];
      const home = !plane.mission && !plane.taxi;
      const ready = home && e.paraT <= 0;
      items.unshift({
        id: 'para',
        name: 'Paratroopers',
        tab: 'defense',
        cost: 0,
        icon: cameoUrl('para'),
        blurb: ready ? 'Tap, then pick where they should drop (the green cursor)' : `${PARA_N} paratroopers, ready every ${PARA_S / 60} minutes while your Paratrooper plane is home`,
        state: !home ? 'idle' : ready ? 'ready' : e.lowPower ? 'paused' : 'building',
        progress: home ? Math.max(0, Math.min(1, 1 - e.paraT / PARA_S)) : 0,
        count: 0,
        isNew: false,
        blocked: home ? undefined : 'In the air',
        aiming: this.paraAim,
      });
    }
    // every tab shows from the start; one with nothing on it yet is grayed out
    const tabs = TABS.map((tb) => ({ ...tb, icon: this.tabIcon(tb.id), disabled: !items.some((i) => i.tab === tb.id) }));
    return { credits: Math.floor(this.credits), store: this.store(), power: this.power(), tabs, items };
  }

  seen(id: string): void {
    this.fresh.delete(id);
  }

  buildTap(id: string): void {
    if (id === 'para') {
      // the paratroopers: pick where they drop (tap again to put it off)
      const p = this.paraPlane(this.me);
      if (this.paraAim) this.paraAim = false;
      else if (p && !p.mission && !p.taxi && this.eco[this.me].paraT <= 0) {
        this.ghost = null;
        this.mode = null;
        this.paraAim = true;
        this.notice('Pick where the paratroopers should drop');
      } else ui('ui_error');
      this.emit();
      return;
    }
    const t = TECH.find((x) => x.id === id);
    if (!t) return;
    this.fresh.delete(id);
    const j = this.jobs.get(t.tab);
    // a finished building: put it down (that's yours alone, until it's
    // placed), or tapped again while it is out, put it away again
    if (t.building && j && j.tech === t && j.ready) {
      if (this.ghost?.tech === t) this.act('unplace');
      else this.startPlace(t);
      return;
    }
    this.command({ c: 'build', t: id });
  }

  buildCancel(id: string): void {
    if (this.ghost?.tech.id === id) this.ghost = null;
    this.command({ c: 'cancel', t: id });
  }

  // Side f starts making something, or puts it on hold or starts it again.
  private startJob(f: number, id: string): void {
    const t = TECH.find((x) => x.id === id);
    if (!t) return;
    const e = this.eco[f];
    const j = e.jobs.get(t.tab);
    const have = this.have(f);
    const open = t.needs.every((k) => have.has(k));
    if (t.unit) {
      // units queue up: tap again for another (a held one starts again)
      if (j && j.tech === t && j.paused) {
        j.paused = false;
        return;
      }
      if (!open) return;
      if (t.unit === 'plane' && this.hasPlane(f)) {
        this.tell(f, 'Only one Paratrooper plane at a time');
        return;
      }
      if (t.unit === 'jet' || t.unit === 'plane') {
        // four planes to an Air command, counting those being made
        const stands = this.buildings.filter((b) => b.f === f && b.kind === 'radar' && b.rise >= 1).length * AIR_PADS;
        const isPlane = (q?: Tech) => q?.unit === 'jet' || q?.unit === 'plane';
        const planes = this.units.filter((u) => u.f === f && (u.kind === 'jet' || u.kind === 'plane') && !u.dead).length + (isPlane(j?.tech) ? 1 : 0) + (e.queue.get(t.tab) ?? []).filter(isPlane).length;
        if (planes >= stands) {
          this.tell(f, 'Every stand is taken: build another Air command');
          return;
        }
      }
      if (t.unit === 'cmdo' && this.hasCommando(f)) {
        this.tell(f, 'Only one Commando at a time');
        return;
      }
      const queued = (e.queue.get(t.tab) ?? []).filter((q) => q === t).length;
      if ((j?.tech === t ? 1 : 0) + queued >= QUEUE_MAX) return;
      if (!j) e.jobs.set(t.tab, { tech: t, spent: 0, paused: false, ready: false });
      else {
        const q = e.queue.get(t.tab) ?? [];
        q.push(t);
        e.queue.set(t.tab, q);
      }
      this.tell(f, undefined, 'training');
      return;
    }
    if (j && j.tech === t) {
      if (!j.ready) j.paused = !j.paused;
      return;
    }
    if (j) {
      this.tell(f, `Busy building ${j.tech.name}`);
      return;
    }
    if (!open || !have.has('yard')) return;
    e.jobs.set(t.tab, { tech: t, spent: 0, paused: false, ready: false });
    this.tell(f, undefined, 'building');
  }

  // Side f calls off one of something: a queued unit goes first (one at a
  // time), then the one being made, and its credits come back.
  private cancelJob(f: number, id: string): void {
    const t = TECH.find((x) => x.id === id);
    if (!t) return;
    const e = this.eco[f];
    const q = e.queue.get(t.tab) ?? [];
    const qi = q.lastIndexOf(t);
    if (qi >= 0) {
      q.splice(qi, 1);
      return;
    }
    const j = e.jobs.get(t.tab);
    if (!j || j.tech !== t) return;
    e.credits += j.spent;
    this.nextJob(e, t.tab);
    if (f === this.me && this.ghost?.tech === t) this.ghost = null;
  }

  // The tab's job is done with: start the next one in its queue.
  private nextJob(e: Eco, tab: Tab): void {
    e.jobs.delete(tab);
    const q = e.queue.get(tab);
    const n = q?.shift();
    if (n) e.jobs.set(tab, { tech: n, spent: 0, paused: false, ready: false });
  }

  // A finished unit comes out of the building of side f that makes it (the
  // one picked as primary, or the newest) and heads for its rally point.
  private deliver(t: Tech, f: number): boolean {
    const makers = this.buildings.filter((b) => b.f === f && b.kind === t.from && b.rise >= 1 && !b.packing);
    if (!makers.length) return false;
    const kind = t.unit as Kind;
    // a jet with a carrier parked at a Naval yard flies off to land on it
    const ship = kind === 'jet' ? this.parkedCarrier(f) : null;
    if (ship) {
      const b = makers[makers.length - 1];
      const d = doorOf('radar')!;
      const [fx, fy] = this.fold(b.x + d.x, b.y + d.y + 4);
      const u = this.newUnit('jet', f, fx, fy, Math.PI / 2);
      u.fly = 0;
      u.ammo = JET_AMMO;
      this.toDeck(u, ship, this.freeSlots(ship)[0]);
      this.sound(b.x, b.y, 'unit_exit');
      return true;
    }
    if (kind === 'jet' || kind === 'plane') {
      // a plane rolls out of the hangar and taxis to a free stand
      const fp = this.freePad(f, kind);
      if (!fp) return false;
      const [b, i] = fp;
      this.rollOut(b, i, kind, f);
      if (kind === 'plane') this.eco[f].paraT = PARA_S;
      return true;
    }
    const b = makers.find((m) => m.primary) ?? makers[makers.length - 1];
    if (b.kind === 'factory') this.sound(b.x, b.y, 'unit_exit');
    // out of the door, or up off the helipad
    this.outOf(b, kind, f, (u) => {
      if (kind === 'hauler') {
        u.job = { st: 'seek', t: 0 };
        u.load = 0;
      } else {
        this.toRally(u, b);
        // ships sail out of the slip, to the rally point only if they can get there by water
        if (b.kind === 'navy' && !this.okAt(u, u.tx, u.ty)) [u.tx, u.ty] = this.fold(b.x, b.y + b.art.ry + 14);
        // (the carrier is far too big for the slip: it is launched out on
        // open water just off the yard)
        if (b.kind === 'navy' && kind === 'carrier') {
          const p = this.launchSpot(u, b);
          if (p) {
            [u.x, u.y, u.a] = p;
            // (it stays there, unless the yard has a rally point it can get to)
            if (!b.rally || !this.seaReach(u, u.tx, u.ty)) [u.tx, u.ty] = [p[0], p[1]];
          }
        }
      }
    });
    return true;
  }

  // A new unit of side f comes out of building b: made just inside its door,
  // it waits for the door to open, comes out and then does `then` (the host
  // and a single-player game only). Without a door (a helipad) it is made on
  // the spot.
  private outOf(b: Building, kind: Kind, f: number, then: (u: Unit) => void): Unit {
    const d = isAir(kind) ? null : doorOf(b.kind);
    if (!d) {
      const [fx, fy] = this.fold(b.x, b.y);
      const u = this.newUnit(kind, f, fx, fy, Math.PI / 2);
      then(u);
      return u;
    }
    const foot = isFoot(kind);
    const r = foot ? 1.5 : UNIT[kind].r;
    // soldiers come out one beside another
    const side = foot ? (Math.random() - 0.5) * d.hw : 0;
    const dx = b.x + d.x - d.ny * side;
    const dy = b.y + d.y + d.nx * side;
    const [fx, fy] = this.fold(dx - d.nx * (r + 1), dy - d.ny * (r + 1));
    const ox = fx - (dx - d.nx * (r + 1));
    const oy = fy - (dy - d.ny * (r + 1));
    const u = this.newUnit(kind, f, fx, fy, Math.atan2(d.ny, d.nx));
    u.exit = { b, x: dx + ox, y: dy + oy, d, k: b.x + ox + b.y + oy + Math.min(b.art.rx, b.art.ry) + 0.01, t: 0, then };
    return u;
  }

  // A new unit heads for its building's rally point (or near its door).
  private toRally(u: Unit, b: Building): void {
    const d = doorOf(b.kind);
    const [rx, ry] = b.rally ?? (d ? [b.x + d.x + d.nx * 22 + (Math.random() - 0.5) * 24, b.y + d.y + d.ny * 22 + (Math.random() - 0.5) * 24] : [b.x + (Math.random() - 0.5) * 30, b.y + b.art.ry + 22 + Math.random() * 14]);
    u.tx = rx + (b.rally ? (Math.random() - 0.5) * 16 : 0);
    u.ty = ry + (b.rally ? (Math.random() - 0.5) * 16 : 0);
    // the rally point is near the building, so go the short way round
    [u.tx, u.ty] = this.nearPoint(u.x, u.y, u.tx, u.ty);
    u.moving = true;
    this.mapVersion++;
  }

  // The copy of world point (x, y) nearest (ax, ay).
  private nearPoint(ax: number, ay: number, x: number, y: number): [number, number] {
    const [asx, asy] = toScreen(ax, ay);
    const [sx, sy] = toScreen(x, y);
    const [nx, ny] = nearestCopy(asx, asy, sx, sy, this.w, this.h);
    return toWorld(nx, ny, 0);
  }

  // Making things: what is newly on your menu and your power, then every
  // side's credits paying for what it is making (the host's job in a
  // multiplayer game: a player's screen just shows what it is told).
  private updateBuild(dt: number): void {
    const have = this.have();
    // newly opened options
    let opened = false;
    for (const t of this.available(have))
      if (!this.known.has(t.id)) {
        this.known.add(t.id);
        this.fresh.add(t.id);
        opened = true;
      }
    if (opened) {
      this.notice('New construction options');
      announce('new_options');
    }
    const pw = this.power();
    const low = pw.used > pw.made;
    if (low && !this.lowWarned) {
      this.notice('Low power: build a power plant');
      announce('low_power');
    } else if (!low && this.lowWarned) announce('power_restored');
    this.lowWarned = low;
    // get the pictures of a building going up drawn while it is being paid for
    for (const f of this.net === 'client' ? [this.me] : this.sides()) for (const j of this.eco[f].jobs.values()) if (j.tech.building) this.riseArt(j.tech.building, f, j.ready);
    if (this.net === 'client') return;
    for (const f of this.sides()) this.payJobs(f, dt);
  }
  private lowWarned = false;

  // The sides with a purse: you (and in a multiplayer game everyone).
  private sides(): number[] {
    return this.players ? this.players.map((p) => p.f) : [this.me];
  }

  private payJobs(f: number, dt: number): void {
    const e = this.eco[f];
    const have = this.have(f);
    const pw = this.power(f);
    e.lowPower = pw.used > pw.made;
    this.paraClock(f, dt);
    let paid = false;
    for (const j of [...e.jobs.values()]) {
      if (j.ready || j.paused) continue;
      if (j.tech.building && !have.has('yard')) continue;
      if (j.tech.unit && !j.tech.needs.every((k) => have.has(k))) continue;
      const want = (j.tech.cost / (j.tech.building === 'wall' ? WALL_S : buildTime(j.tech.cost))) * dt * (e.lowPower ? 0.5 : 1);
      const pay = Math.min(want, e.credits, j.tech.cost - j.spent);
      e.credits -= pay;
      j.spent += pay;
      if (pay > 0) paid = true;
      if (pay < want - 1e-6 && j.spent < j.tech.cost - 1e-6) this.tell(f, 'Not enough credits', 'insufficient_funds');
      if (j.spent >= j.tech.cost - 1e-6) {
        j.spent = j.tech.cost;
        if (j.tech.unit) {
          if (this.deliver(j.tech, f)) {
            this.tell(f, `${j.tech.name} ready`, 'unit_ready');
            this.nextJob(e, j.tech.tab);
          }
        } else {
          j.ready = true;
          this.tell(f, `${j.tech.name} is complete`, 'construction_complete');
          if (f === this.me) ui('ui_ready');
        }
      }
    }
    // the credits tick away while something is being made
    if (paid && f === this.me && this.time - this.tickT > 0.14) {
      this.tickT = this.time;
      ui('credits_tick');
    }
  }
  private tickT = 0;

  // ---------- Placing a finished building ----------

  placing(): boolean {
    return this.ghost !== null;
  }

  // ---------- Repair and Sell (the buttons at the top of the build menu) ----------

  // Repairing or selling: a tap on a building of yours does it.
  private mode: 'repair' | 'sell' | null = null;

  buildMode(): 'repair' | 'sell' | null {
    return this.mode;
  }

  setBuildMode(m: 'repair' | 'sell' | null): void {
    this.mode = m;
    if (m) {
      this.ghost = null;
      this.paraAim = false;
      this.notice(m === 'repair' ? 'Pick a damaged building of yours to repair' : 'Pick a building of yours to sell');
    }
    this.emit();
  }

  /** Waiting for a tap on the map: Repair, Sell, or where the paratroopers drop. */
  targeting(): boolean {
    return !!this.mode || this.paraAim;
  }

  // The building of yours at screen point (x, y) that Repair or Sell would act on.
  private modeAt(x: number, y: number): Building | null {
    const b = this.buildingAt(x, y);
    if (!b || b.f !== this.me || b.rise < 1 || b.packing || b.dead) return null;
    if (this.mode === 'repair' && b.hp >= 1 && !b.fixing) return null;
    if (this.mode === 'sell' && b.kind === 'derrick') return null;
    return b;
  }

  // What building kind b costs (the Construction yard: its vehicle's price).
  private priceOf(kind: BuildingKind): number {
    return TECH.find((t) => t.building === kind)?.cost ?? (kind === 'yard' ? TECH.find((t) => t.unit === 'mcv')?.cost ?? 2500 : 500);
  }

  // Repairing buildings costs credits as they mend (the host's job); out of
  // credits, or mended, it stops.
  private mendAll(dt: number): void {
    if (this.net === 'client') return;
    for (const b of this.buildings) {
      if (!b.fixing) continue;
      if (b.dead || b.packing || b.hp >= 1) {
        b.fixing = false;
        continue;
      }
      const e = this.eco[b.f];
      if (!e) continue;
      const add = Math.min(MEND_RATE * dt, 1 - b.hp);
      const cost = add * this.priceOf(b.kind) * MEND_COST;
      if (e.credits < cost) {
        b.fixing = false;
        this.tell(b.f, 'Not enough credits to repair', 'insufficient_funds');
        continue;
      }
      e.credits -= cost;
      b.hp += add;
      if (b.hp >= 1 - 1e-6) {
        b.hp = 1;
        b.fixing = false;
      }
    }
  }

  private startPlace(t: Tech): void {
    this.ghost = { tech: t, x: 0, y: 0, pad: { x: 0, y: 0, w: 0, h: 0 }, why: '' };
    // until main.ts moves it: next to your Foundry
    const yard = this.buildings.find((b) => b.f === this.me && b.kind === 'yard');
    if (yard) {
      const [sx, sy] = toScreen(yard.x, yard.y + yard.art.ry + 40);
      this.placeAt(sx, sy);
    }
    for (const u of this.units) u.sel = false;
    for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  placeAt(x: number, y: number): void {
    const gh = this.ghost;
    if (!gh) return;
    const art = this.buildingArt(gh.tech.building!, this.me);
    let [wx, wy] = this.fold(...toWorld(x, y, 0));
    // (wall segments snap to their own grid, so a row of them lines up)
    const step = gh.tech.building === 'wall' ? WALL_GRID : 4;
    wx = Math.round(wx / step) * step;
    wy = Math.round(wy / step) * step;
    gh.x = wx;
    gh.y = wy;
    gh.pad = padOf(gh.tech.building!, art, wx, wy);
    gh.why = this.placeWhy(gh.pad, this.me, gh.tech.building === 'navy');
    gh.cells = undefined;
    if (gh.tech.building === 'wall' && !gh.why) {
      // the whole run it would fill, under one outline
      gh.cells = this.wallRun(this.me, wx, wy);
      const xs = gh.cells.map((c) => c[0]);
      const ys = gh.cells.map((c) => c[1]);
      gh.pad = { x: Math.min(...xs) - art.rx, y: Math.min(...ys) - art.ry, w: Math.max(...xs) - Math.min(...xs) + art.rx * 2, h: Math.max(...ys) - Math.min(...ys) + art.ry * 2 };
    }
  }

  // Why a building can't go on pad r ('' if it can): it needs clear, level
  // ground next to the rest of your base.
  // (reach false: for the gap a wall run fills, which needn't be near the base itself)
  private placeWhy(r: Rect, f: number, wet = false, reach = true): string {
    // (a wall's pad has no margin round it, so it may butt up against the next)
    const tight = r.w <= WALL_GRID;
    if (wet) {
      if (!this.waterOk(r)) return 'Blocked: needs open water';
    } else if (!this.siteOk(tight ? { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 } : r, tight ? 0 : 1)) return 'Blocked: needs open, level ground';
    if (!reach) return '';
    const [gsx, gsy] = toScreen(r.x + r.w / 2, r.y + r.h / 2);
    for (const b of this.buildings) {
      if (b.f !== f) continue;
      const [bsx, bsy] = toScreen(b.x, b.y);
      const [nx, ny] = nearestCopy(gsx, gsy, bsx, bsy, this.w, this.h);
      const [bx, by] = toWorld(nx, ny, 0);
      const gx = Math.abs(bx - (r.x + r.w / 2)) - (r.w + b.pad.w) / 2;
      const gy = Math.abs(by - (r.y + r.h / 2)) - (r.h + b.pad.h) / 2;
      // (a Naval yard may reach out across the beach to the water)
      if (Math.max(gx, gy) <= (wet ? BUILD_GAP * 3 : BUILD_GAP)) return '';
    }
    return 'Too far from your base';
  }

  private placeNow(): void {
    const gh = this.ghost;
    if (gh?.why) ui('ui_error');
    if (!gh || gh.why) return;
    this.command({ c: 'place', t: gh.tech.id, x: gh.x, y: gh.y });
    // walls keep coming: the ghost stays up for the next segment
    if (gh.tech.building !== 'wall') this.ghost = null;
    this.emit();
  }

  // Side f puts its finished building down at world point (x, y), if it can go there.
  private placeBuilding(f: number, id: string, x: number, y: number): void {
    const t = TECH.find((q) => q.id === id);
    const j = t && this.eco[f].jobs.get(t.tab);
    if (!t?.building || !j || j.tech !== t || !j.ready) return;
    const art = this.buildingArt(t.building, f);
    const pad = padOf(t.building, art, x, y);
    const why = this.placeWhy(pad, f, t.building === 'navy');
    if (why) {
      this.tell(f, why);
      return;
    }
    // (a wall fills the gap to the next one in line with it, see wallRun)
    const cells = t.building === 'wall' ? this.wallRun(f, x, y) : [[x, y]];
    for (const [cx, cy] of cells) {
      const p = padOf(t.building, art, cx, cy);
      const b = this.addBuilding({ id: 0, kind: t.building, f, x: cx, y: cy, art, phase: 0, gun: 0, gunGoal: 0, pad: p, sel: false, rise: 0, hp: 1 });
      this.clearSite(p, null);
      this.setPad(p, true);
      this.puff(b, cells.length > 1 ? 6 : 12);
    }
    this.sound(x, y, 'build_place');
    this.sound(x, y, 'build_rise', 1, { delay: 0.15, rate: 1.1 });
    const e = this.eco[f];
    e.jobs.delete(t.tab);
    // the next wall segment is ready straight away, while there are credits for it
    if (t.building === 'wall' && e.credits >= t.cost) {
      e.credits -= t.cost;
      e.jobs.set(t.tab, { tech: t, spent: t.cost, paused: false, ready: true });
    }
  }

  // Everyone standing on rect r (but `keep`) drives off it.
  private clearSite(r: Rect, keep: Unit | null): void {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    for (const o of this.units) {
      if (o === keep || isAir(o.kind) || isNaval(o.kind)) continue;
      if (!inside(o.x, o.y, r, 6) && !(o.moving && inside(o.tx, o.ty, r, 6))) continue;
      let dx = o.x - cx;
      let dy = o.y - cy;
      if (Math.hypot(dx, dy) < 1) dx = 1;
      const k = Math.max(Math.abs(dx) / (r.w / 2), Math.abs(dy) / (r.h / 2));
      o.tx = cx + dx / k + Math.sign(dx) * 10;
      o.ty = cy + dy / k + Math.sign(dy) * 10;
      o.moving = true;
    }
  }

  // ---------- Foundry: deploy and pack up ----------

  // The pad a Foundry standing at (x, y) would deploy onto.
  private siteOf(x: number, y: number): Rect {
    const a = this.buildingArt('yard', this.me);
    const cx = Math.round(x);
    const cy = Math.round(y);
    return { x: cx - a.rx - 3, y: cy - a.ry - 3, w: a.rx * 2 + 6, h: a.ry * 2 + 6 };
  }

  // Open, level grass, away from other buildings.
  // Is rect r open water (with a little room round it, and clear water out
  // in front where ships come and go), for a Naval yard?
  private waterOk(r: Rect): boolean {
    for (let y = r.y - 2; y <= r.y + r.h + 24; y += 3)
      for (let x = r.x - 2; x <= r.x + r.w + 2; x += 3) if (this.terrain.k(x, y) !== K.Water || this.blockAt(x, y)) return false;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    return !this.buildings.some((b) => {
      const [bx, by] = this.nearPoint(cx, cy, b.x, b.y);
      return Math.abs(bx - cx) < (r.w + b.pad.w) / 2 + 2 && Math.abs(by - cy) < (r.h + b.pad.h) / 2 + 2;
    });
  }

  private siteOk(r: Rect, margin = 1): boolean {
    if (!this.terrain.clear(r, margin)) return false;
    // not on ore either
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    if (this.oreGens.some((g) => inside(...this.nearPoint(cx, cy, g.x, g.y), r, 5))) return false;
    return !this.oreNear(cx, cy, Math.hypot(r.w, r.h) / 2 + 4).some((n) => n.amt > 1 && inside(...this.nearPoint(cx, cy, n.x, n.y), r, 3));
  }

  // ---------- Ore ----------

  private oreKey(x: number, y: number): [number, number] {
    const [sx, sy] = toScreen(x, y);
    const nx = Math.ceil(this.terrain.w / 64);
    const ny = Math.ceil(this.terrain.h / 64);
    const i = (((Math.floor(sx / 64) % nx) + nx) % nx);
    const j = (((Math.floor(sy / 64) % ny) + ny) % ny);
    return [i, j];
  }

  // Whether a building stands on (or right by) ore clump n.
  private builtOn(n: OreNode): boolean {
    return this.buildings.some((b) => {
      const [bx, by] = this.nearPoint(n.x, n.y, b.x, b.y);
      return Math.abs(bx - n.x) < b.pad.w / 2 + 4 && Math.abs(by - n.y) < b.pad.h / 2 + 4;
    });
  }

  private addOre(n: OreNode): void {
    this.ore.push(n);
    const [i, j] = this.oreKey(n.x, n.y);
    const k = j * 100000 + i;
    let cell = this.oreGrid.get(k);
    if (!cell) this.oreGrid.set(k, (cell = []));
    cell.push(n);
  }

  // Ore clumps within r (world units) of (x, y), on any copy of the map.
  private oreNear(x: number, y: number, r: number): OreNode[] {
    const [i0, j0] = this.oreKey(x, y);
    const nx = Math.ceil(this.terrain.w / 64);
    const ny = Math.ceil(this.terrain.h / 64);
    const reach = Math.ceil((r * 2) / 64) + 1;
    const out: OreNode[] = [];
    for (let dj = -reach; dj <= reach; dj++)
      for (let di = -reach; di <= reach; di++) {
        const cell = this.oreGrid.get(((((j0 + dj) % ny) + ny) % ny) * 100000 + ((((i0 + di) % nx) + nx) % nx));
        if (!cell) continue;
        for (const n of cell) {
          const [px, py] = this.nearPoint(x, y, n.x, n.y);
          if (Math.hypot(px - x, py - y) <= r) out.push(n);
        }
      }
    return out;
  }

  // Ore clumps on this copy of the map within screen rect (x0, y0)-(x1, y1).
  private oreInView(x0: number, y0: number, x1: number, y1: number): OreNode[] {
    const out: OreNode[] = [];
    const nx = Math.ceil(this.terrain.w / 64);
    const ny = Math.ceil(this.terrain.h / 64);
    for (let j = Math.max(0, Math.floor(y0 / 64)); j <= Math.min(ny - 1, Math.floor(y1 / 64)); j++)
      for (let i = Math.max(0, Math.floor(x0 / 64)); i <= Math.min(nx - 1, Math.floor(x1 / 64)); i++)
        for (const n of this.oreGrid.get(j * 100000 + i) ?? []) {
          const [sx, sy] = toScreen(n.x, n.y);
          if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) out.push(n);
        }
    return out;
  }

  // Power made and used by side f's buildings (yours unless said).
  power(f = this.me): { made: number; used: number } {
    let made = 0;
    let used = 0;
    for (const b of this.buildings) {
      if (b.f !== f || b.rise < 1) continue;
      const p = POWER[b.kind] ?? 0;
      if (p > 0) made += p;
      else used -= p;
    }
    return { made, used };
  }
  // The most credits side f can hold.
  private store(f = this.me): number {
    if (this.stage === 'combat') return COMBAT_STORE;
    let s = STORE.base;
    for (const b of this.buildings) if (b.f === f && b.rise >= 1) s += b.kind === 'refinery' ? STORE.refinery : b.kind === 'silo' ? STORE.silo : 0;
    return s;
  }

  // The nearest refinery of side f to (x, y).
  private refineryNear(x: number, y: number, f: number): Building | null {
    let best: Building | null = null;
    let bd = 1e9;
    for (const b of this.buildings) {
      if (b.f !== f || b.kind !== 'refinery' || b.rise < 1 || b.packing) continue;
      const [bx, by] = this.nearPoint(x, y, b.x, b.y);
      const d = Math.hypot(bx - x, by - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // Ore haulers dig ore, carry it home to a refinery and unload it for credits.
  private haul(u: Unit, dt: number): void {
    if (u.exit) return;
    const j = u.job!;
    u.load ??= 0;
    j.t -= dt;
    const goTo = (x: number, y: number) => {
      [u.tx, u.ty] = this.nearPoint(u.x, u.y, x, y);
      u.moving = true;
    };
    switch (j.st) {
      case 'wait':
        if (j.t <= 0) j.st = u.load >= ORE.load * 0.95 ? 'home' : 'seek';
        break;
      case 'seek': {
        // the nearest clump with ore left, looking further out step by step
        // (leaving out any it found it couldn't get to, walled in by cliffs or water)
        let node: OreNode | undefined = j.node && j.node.amt > 20 && !u.noOre?.has(j.node) ? j.node : undefined;
        for (let r = 60; r <= 1500 && !node; r *= 2) {
          let bd = 1e9;
          for (const n of this.oreNear(u.x, u.y, r)) {
            if (n.amt <= 20 || u.noOre?.has(n)) continue;
            const [px, py] = this.nearPoint(u.x, u.y, n.x, n.y);
            const d = Math.hypot(px - u.x, py - u.y);
            if (d < bd) {
              bd = d;
              node = n;
            }
          }
        }
        if (!node) {
          if (u.load > 0) j.st = 'home';
          else {
            this.tell(u.f, 'No ore in reach of your hauler');
            j.st = 'wait';
            j.t = 5;
          }
          break;
        }
        j.node = node;
        goTo(node.x - 4, node.y - 2);
        j.st = 'go';
        break;
      }
      case 'go':
        if (!u.moving) {
          const n = j.node;
          const [nx, ny] = n ? this.nearPoint(u.x, u.y, n.x, n.y) : [u.x, u.y];
          if (n && Math.hypot(nx - u.x, ny - u.y) > 14) {
            // stopped short: there is no way to it
            (u.noOre ??= new Set()).add(n);
            j.node = undefined;
            j.st = 'seek';
            break;
          }
          j.st = 'dig';
          u.turretGoal = 0;
        }
        break;
      case 'dig': {
        const n = j.node;
        if (!n || n.amt <= 1) {
          j.node = undefined;
          j.st = u.load >= ORE.load * 0.8 ? 'home' : 'seek';
          break;
        }
        const take = Math.min(ORE.digRate * dt, n.amt, ORE.load - u.load);
        n.amt -= take;
        u.load += take;
        if (Math.random() < dt * 6) {
          const [sx, sy] = toScreen(n.x, n.y, 2);
          this.particles.push({ x: sx + (Math.random() - 0.5) * 6, y: sy, vx: (Math.random() - 0.5) * 6, vy: -4, life: 0, max: 0.8, kind: 'dust', size: 1 });
        }
        if (u.load >= ORE.load - 0.5) {
          j.st = 'home';
          // a hauler you are looking after says it is heading home
          if (u.sel && u.f === this.me) sayUnit('harvester', 'full');
        }
        break;
      }
      case 'home': {
        const ref = this.refineryNear(u.x, u.y, u.f);
        if (!ref) {
          this.tell(u.f, 'Your hauler needs a refinery');
          j.st = 'wait';
          j.t = 5;
          break;
        }
        j.ref = ref;
        // pull up in front of the pad first
        goTo(ref.x + DOCK[0] + Math.cos(DOCK_A) * DOCK_RUN, ref.y + DOCK[1] + Math.sin(DOCK_A) * DOCK_RUN);
        j.st = 'ret';
        break;
      }
      case 'ret':
        if (!j.ref || !this.buildings.includes(j.ref)) j.st = 'home';
        else if (!u.moving) {
          // (one at a time: wait here while another hauler is on the pad)
          const ref = j.ref;
          const taken = this.units.some((o) => o !== u && o.job?.ref === ref && (o.job.st === 'dock' || o.job.st === 'unload' || (o.job.st === 'wait' && (o.tilt ?? 0) > 0)));
          if (!taken) j.st = 'dock';
        }
        break;
      case 'dock': {
        // turn to face out, then back onto the pad
        const ref = j.ref;
        if (!ref || !this.buildings.includes(ref)) {
          j.st = 'home';
          break;
        }
        const [px, py] = this.nearPoint(u.x, u.y, ref.x + DOCK[0], ref.y + DOCK[1]);
        const diff = angDiff(DOCK_A, u.a);
        const stepA = UNIT.hauler.turn * dt;
        if (Math.abs(diff) > 0.02) {
          u.a = Math.abs(diff) <= stepA ? DOCK_A : u.a + Math.sign(diff) * stepA;
          break;
        }
        u.a = DOCK_A;
        const dx = px - u.x;
        const dy = py - u.y;
        const d = Math.hypot(dx, dy);
        const sp = UNIT.hauler.speed * 0.45 * dt;
        // (if something is in the way, it unloads where it is)
        const nx = u.x + (dx / Math.max(d, 1e-6)) * sp;
        const ny = u.y + (dy / Math.max(d, 1e-6)) * sp;
        if (d <= sp || d > DOCK_RUN + 10 || !this.okAt(u, nx, ny)) {
          if (d <= sp) {
            u.x = px;
            u.y = py;
          }
          j.st = 'unload';
          j.t = 0;
          this.sound(u.x, u.y, 'ore_unload');
        } else {
          u.x = nx;
          u.y = ny;
        }
        u.tx = u.x;
        u.ty = u.y;
        break;
      }
      case 'unload': {
        // (sent to unload with nothing on: straight off again)
        if (u.load <= 0.5) {
          u.load = 0;
          j.st = 'wait';
          j.t = TIP_S;
          break;
        }
        const e = this.eco[u.f];
        const room = this.store(u.f) - e.credits;
        if (room <= 0) {
          this.tell(u.f, 'Credits full: build an ore silo');
          break;
        }
        // (the ore pours out once the bed is tipped up)
        if ((u.tilt ?? 0) < 0.6) break;
        const give = Math.min(ORE.unloadRate * dt, u.load, room);
        u.load -= give;
        e.credits += give;
        if (u.f === this.me && this.time - this.tickT > 0.12) {
          this.tickT = this.time;
          ui('credits_tick', 1.4);
        }
        if (u.load <= 0.5) {
          // empty: let the bed down, then off for more
          u.load = 0;
          j.st = 'wait';
          j.t = TIP_S;
        }
        break;
      }
    }
  }

  // How a hauler looks at work, on every screen: its bed tips up on the pad
  // and pours out its ore into the intake, and digging, its scoop lifts and
  // tips ore back into the bed, kicking up dust.
  private haulerLooks(u: Unit, dt: number): void {
    const st = u.job?.st;
    const want = st === 'unload' && (u.load ?? 0) > 0.5 ? 1 : 0;
    const was = u.tilt ?? 0;
    u.tilt = want > was ? Math.min(1, was + dt / TIP_S) : Math.max(0, was - dt / TIP_S);
    if (u.tilt === 0) u.tilt = undefined;
    const ca = Math.cos(u.a);
    const sa = Math.sin(u.a);
    if ((u.tilt ?? 0) > 0.6 && want) {
      // a stream of ore off the back of the bed, and dust from the intake
      const [bx, by] = toScreen(u.x - ca * 12.5, u.y - sa * 12.5, u.z + 2.5 + u.tilt! * 2);
      for (let i = 0; i < 2; i++)
        if (Math.random() < dt * 22)
          this.sparks.push({ x: bx + (Math.random() - 0.5) * 6, y: by + Math.random() * 2, vx: (Math.random() - 0.5) * 5, vy: 4 + Math.random() * 6, life: 0, max: 0.28, col: Math.random() < 0.25 ? '#f2d06a' : '#b08638' });
      if (Math.random() < dt * 5) {
        const [dx, dy] = toScreen(u.x - ca * 13.5, u.y - sa * 13.5, u.z + 1);
        this.particles.push({ x: dx + (Math.random() - 0.5) * 8, y: dy, vx: (Math.random() - 0.5) * 6, vy: -5, life: 0, max: 1, kind: 'dust', size: 1.4 });
      }
      // the refinery it is unloading into works its lamps
      for (const b of this.buildings)
        if (b.kind === 'refinery' && b.f === u.f) {
          const [px, py] = this.nearPoint(u.x, u.y, b.x + DOCK[0], b.y + DOCK[1]);
          if (Math.hypot(px - u.x, py - u.y) < 4) b.busyT = this.time;
        }
    }
    if (st === 'dig') {
      const step = Math.floor(u.anim * DIG_RATE) % DIG_POSES.length;
      if (step !== u.digStep) {
        const pose = DIG_POSES[step];
        const [fx, fy] = toScreen(u.x + ca * 13, u.y + sa * 13, u.z + 1);
        if (pose === 0) {
          // the scoop bites into the ground
          for (let i = 0; i < 2; i++) this.particles.push({ x: fx + (Math.random() - 0.5) * 8, y: fy, vx: (Math.random() - 0.5) * 7, vy: -4 - Math.random() * 2, life: 0, max: 0.9, kind: 'dust', size: 1.2 });
        } else if (pose === 2 && DIG_POSES[u.digStep ?? 0] !== 2) {
          // up: lumps of ore tumble back into the bed
          const [tx, ty] = toScreen(u.x + ca * 11, u.y + sa * 11, u.z + 7);
          for (let i = 0; i < 4; i++) this.sparks.push({ x: tx + (Math.random() - 0.5) * 5, y: ty, vx: -ca * 8 + sa * 8 * (Math.random() - 0.5) + (Math.random() - 0.5) * 4, vy: -8 - Math.random() * 6, life: 0, max: 0.35, col: Math.random() < 0.3 ? '#f2d06a' : '#c09443' });
        }
        u.digStep = step;
      }
    } else u.digStep = undefined;
  }

  // The hauler's picture at heading di: tipping its bed, its scoop lifting
  // as it digs, or just its load (a picture not drawn yet is asked for, and
  // the plain one stands in for it meanwhile).
  // A Comet launcher shows its rocket on the rail once it is loaded (just
  // before it can fire again), and the bare rail while it loads.
  private cometSprites(u: Unit): StackSprite[] {
    const art = this.art[u.f];
    return (u.cool ?? 0) <= COMET_SHOW ? art.comet : art.cometEmpty;
  }

  private haulerSprite(u: Unit, di: number): StackSprite {
    const art = this.art[u.f];
    const fill = haulerFill(u.load);
    const plain = art.haulerLoad[fill][di];
    const tilt = u.tilt ?? 0;
    if (tilt > 0.05) {
      const k = tilt < 0.4 ? 0 : tilt < 0.75 ? 1 : 2;
      const set = art.haulerDump[k * 3 + fill];
      return artReady(set, di) ? set[di] : plain;
    }
    if (u.job?.st === 'dig') {
      const pose = DIG_POSES[Math.floor(u.anim * DIG_RATE) % DIG_POSES.length];
      if (!pose) return plain;
      const set = art.haulerDig[(pose - 1) * 3 + fill];
      return artReady(set, di) ? set[di] : plain;
    }
    return plain;
  }

  private deployable(u: Unit): boolean {
    return u.kind === 'mcv' && this.siteOk(this.siteOf(u.x, u.y));
  }

  actions(): Action[] {
    // (a building being placed goes down with a tap, and away again with
    // Esc, a right-click or a tap on its picture; the paratroopers drop with
    // a tap on the map)
    if (this.ghost || this.paraAim || this.mode) return [];
    const b = this.selB();
    if (b) {
      if (b.f === this.me && b.kind === 'yard') return [{ id: 'pack', label: 'Pack up', icon: 'pack', disabled: b.rise < 1, title: 'Pack the Construction yard back into a vehicle' }];
      if (b.f === this.me && MAKERS.includes(b.kind)) {
        const acts: Action[] = [];
        if (this.buildings.filter((o) => o.f === this.me && o.kind === b.kind).length > 1)
          acts.push({ id: 'primary', label: b.primary ? 'Primary' : 'Make primary', icon: 'star', disabled: !!b.primary, title: 'New units come out of this one' });
        if (b.rally) acts.push({ id: 'unrally', label: 'Clear rally', icon: 'x', title: 'New units wait by the door' });
        return acts;
      }
      return [];
    }
    const acts: Action[] = [];
    const loaded = this.loaded();
    if (loaded.length) {
      const n = loaded.reduce((s, u) => s + (u.cargo?.length ?? 0), 0);
      const who = loaded.some((u) => u.cargo?.some((p) => !RIDERS.has(p.kind))) ? (n === 1 ? 'the vehicle' : `all ${n}`) : n === 1 ? 'the soldier' : `all ${n} soldiers`;
      acts.push({ id: 'unload', label: 'Unload', icon: 'unload', title: `Let ${who} out (F or Space)` });
    }
    const gis = this.selected().filter((u) => u.kind === 'inf' && u.f === this.me);
    if (gis.length)
      acts.push(
        gis.some((u) => !u.dug)
          ? { id: 'entrench', label: 'Deploy', icon: 'deploy', title: 'Dig in behind sandbags: stronger, longer-range fire, but they stay put (F or Space)' }
          : { id: 'unentrench', label: 'Undeploy', icon: 'pack', title: 'Pick up the sandbags and get moving (F or Space)' },
      );
    const mcvs = this.selected().filter((u) => u.kind === 'mcv' && u.f === this.me);
    // a lone MCU has its Deploy button floating over it instead (deployAt)
    if (!mcvs.length || this.deployAt()) return acts;
    const ok = mcvs.some((u) => !u.deploy && this.deployable(u));
    acts.push({ id: 'deploy', label: 'Deploy', icon: 'deploy', disabled: !ok, title: ok ? 'Deploy into a Construction yard (F or Space)' : 'Needs open, level ground: move somewhere clear' });
    return acts;
  }

  // Selected transports of yours with soldiers in them.
  private loaded(): Unit[] {
    return this.selected().filter((u) => u.f === this.me && !!u.cargo?.length);
  }

  // The selected G.I.s dig in behind sandbags (on), or climb out.
  private entrench(on: boolean): void {
    const gis = this.selected().filter((u) => u.kind === 'inf' && u.f === this.me && !!u.dug !== on);
    if (!gis.length) return;
    this.command({ c: 'entrench', u: gis.map((u) => u.id), on });
    this.sound(gis[0].x, gis[0].y, 'build_place', 0.6, { rate: on ? 1.5 : 1.25 });
    this.emit();
  }

  deployAt(): { x: number; y: number; ok: boolean } | null {
    if (this.ghost || this.selB()) return null;
    const sel = this.selected();
    if (sel.length !== 1) return null;
    const u = sel[0];
    if (u.kind !== 'mcv' || u.f !== this.me || u.deploy) return null;
    const [x, y] = this.screenOf(u);
    return { x, y, ok: this.deployable(u) };
  }

  act(id: string): void {
    const sb = this.selB();
    if (id === 'primary' && sb) this.command({ c: 'primary', b: sb.id });
    if (id === 'unrally' && sb) this.command({ c: 'rally', b: sb.id });
    if (id === 'unpara') this.paraAim = false;
    if (id === 'place') this.placeNow();
    else if (id === 'unplace') {
      // (walls come one after another: stopping hands back the next one's credits)
      if (this.ghost?.tech.building === 'wall') this.buildCancel(this.ghost.tech.id);
      this.ghost = null;
    }
    else if (id === 'unload') {
      const go = this.loaded().filter((u) => !u.unloading);
      if (go.length) this.command({ c: 'unload', u: go.map((u) => u.id) });
    } else if (id === 'entrench' || id === 'unentrench') this.entrench(id === 'entrench');
    else if (id === 'deploy') {
      // (F: Foundry vehicles deploy, G.I.s dig in or climb out, and
      // transports let their soldiers out)
      const go = this.selected().filter((u) => u.kind === 'mcv' && u.f === this.me && !u.deploy && this.deployable(u));
      const gis = this.selected().filter((u) => u.kind === 'inf' && u.f === this.me);
      if (gis.length) this.entrench(gis.some((u) => !u.dug));
      const out = this.loaded().filter((u) => !u.unloading);
      if (out.length) this.command({ c: 'unload', u: out.map((u) => u.id) });
      if (go.length) {
        this.command({ c: 'deploy', u: go.map((u) => u.id) });
        this.deployMarks(go);
      } else if (!gis.length && !out.length) ui('ui_error');
    } else if (id === 'pack' && sb && sb.f === this.me && sb.kind === 'yard' && sb.rise >= 1) this.command({ c: 'pack', b: sb.id });
  }

  // The harvest cursor's triangles drop onto Foundry vehicles told to deploy.
  private deployMarks(us: Unit[]): void {
    for (const u of us) {
      const [mx, my] = this.fold(u.x, u.y);
      this.markers.push({ x: mx, y: my, z: u.z, t: 0, ore: true });
    }
  }

  private startDeploy(u: Unit): void {
    u.deploy = true;
    this.sound(u.x, u.y, 'foundry_unfold');
    u.moving = false;
    u.tx = u.x;
    u.ty = u.y;
    // clear the way: everyone else standing on the site drives off it
    this.clearSite(this.siteOf(u.x, u.y), u);
  }

  // The Foundry vehicle has lined up: it unfolds into the yard.
  private deployNow(u: Unit): void {
    const pad = this.siteOf(u.x, u.y);
    if (!this.siteOk(pad)) {
      u.deploy = false;
      return;
    }
    this.units.splice(this.units.indexOf(u), 1);
    this.gone.push([u.id, GONE_QUIET]);
    const art = this.buildingArt('yard', u.f);
    const b = this.addBuilding({ id: 0, kind: 'yard', f: u.f, x: pad.x + pad.w / 2, y: pad.y + pad.h / 2, art, phase: 0, gun: 0, gunGoal: 0, pad, sel: u.sel, rise: 0, hp: 1 });
    if (u.sel) for (const o of this.units) o.sel = false;
    this.setPad(pad, true);
    this.puff(b, 14);
    this.sound(b.x, b.y, 'build_rise');
    this.emit();
  }

  // A building sold has gone all the way down: gone, and its pad lifted.
  private sellNow(b: Building): void {
    this.buildings.splice(this.buildings.indexOf(b), 1);
    b.dead = true;
    this.gone.push([b.id, GONE_PACK]);
    this.setPad(b.pad, false);
    this.puff(b, 8);
    if (this.selB() === b) b.sel = false;
    this.emit();
  }

  private packNow(b: Building): void {
    this.buildings.splice(this.buildings.indexOf(b), 1);
    this.gone.push([b.id, GONE_PACK]);
    this.setPad(b.pad, false);
    const u = this.newUnit('mcv', b.f, b.x, b.y, 0);
    u.sel = b.sel;
    this.puff(b, 8);
    this.emit();
  }

  // Lay or lift a building's concrete, and repaint the ground under it.
  private setPad(pad: Rect, on: boolean): void {
    // (a Naval yard stands out on the water: no concrete pad goes down under it)
    if (on && this.terrain.k(pad.x + pad.w / 2, pad.y + pad.h / 2) === K.Water) return;
    if (on) this.terrain.markPad(pad);
    else this.terrain.unmarkPad(pad);
    const pts = [toScreen(pad.x, pad.y), toScreen(pad.x + pad.w, pad.y), toScreen(pad.x, pad.y + pad.h), toScreen(pad.x + pad.w, pad.y + pad.h)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this.tiles.redo(Math.min(...xs) - 24, Math.min(...ys) - 24, Math.max(...xs) + 24, Math.max(...ys) + 24);
    this.mapVersion++;
  }

  // A burst of dust round a building's footprint.
  private puff(b: Building, n: number): void {
    for (let i = 0; i < n; i++) {
      const t = Math.random() * 4;
      const s = (t % 1) * 2 - 1;
      const side = Math.floor(t);
      const lx = side < 2 ? (side ? 1 : -1) * b.art.rx : s * b.art.rx;
      const ly = side < 2 ? s * b.art.ry : (side === 3 ? 1 : -1) * b.art.ry;
      const [sx, sy] = toScreen(b.x + lx, b.y + ly, 1);
      this.particles.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 8, vy: -3 - Math.random() * 3, life: 0, max: 1 + Math.random() * 0.8, kind: 'dust', size: 1.5 });
    }
  }
  private forestF!: WorldField;
  tiles!: Tiles<Prop>;
  private view = { x0: 0, y0: 0, x1: 0, y1: 0 };

  // How well you hear something at screen point (sx, sy): full in the middle
  // of the view, a little less at its edges, dying away just past them, and
  // quieter the further out you are zoomed.
  private hear(sx: number, sy: number): number {
    const v = this.view;
    const cx = (v.x0 + v.x1) / 2;
    const cy = (v.y0 + v.y1) / 2;
    const hw = (v.x1 - v.x0) / 2 || 1;
    const hh = (v.y1 - v.y0) / 2 || 1;
    const [qx, qy] = nearestCopy(cx, cy, sx, sy, this.w, this.h);
    const d = Math.max(Math.abs(qx - cx) / hw, Math.abs(qy - cy) / hh);
    const near = d <= 1 ? 1 - 0.3 * d : Math.max(0, 0.7 * (1 - (d - 1) / 0.6));
    const zoom = Math.max(0.35, Math.min(1, 600 / (hw * 2)));
    return near * (0.4 + 0.6 * zoom);
  }

  // A one-shot from world point (x, y, z), as loud as it is near the view.
  private sound(x: number, y: number, n: Sfx, vol = 1, o: PlayOpts = {}, z = 0): void {
    const [sx, sy] = toScreen(x, y, z);
    play(n, vol * this.hear(sx, sy), o);
  }

  // The loops: each as loud as how many of its makers are near the view.
  private surfT = -1;
  private surf = 0;
  private loopSounds(): void {
    const sum: Record<Loop, number> = { tracks_loop: 0, engine_loop: 0, rotor_loop: 0, boat_loop: 0, footsteps: 0, ore_dig: 0, surf_loop: 0, fire_loop: 0 };
    const at = (x: number, y: number, z = 0) => this.hear(...toScreen(x, y, z));
    for (const u of this.units) {
      if (u.dead) continue;
      const k = u.kind;
      if (k === 'heli' || k === 'heron') {
        sum.rotor_loop += at(u.x, u.y, u.z + this.alt(u)) * (u.moving ? 1 : 0.6) * (u.fly ?? 1);
        continue;
      }
      if (k === 'plane') {
        sum.engine_loop += at(u.x, u.y, u.z + this.alt(u)) * 1.2;
        continue;
      }
      if (k === 'jet') {
        // (a jet's engine whines over the rest, up high)
        sum.engine_loop += at(u.x, u.y, u.z + this.alt(u)) * (u.fly ?? 0) * 0.8;
        continue;
      }
      if (u.job?.st === 'dig') sum.ore_dig += at(u.x, u.y);
      if (!u.moving) continue;
      const h = at(u.x, u.y);
      if (isFoot(k)) sum.footsteps += h * 0.5;
      else if (isNaval(k) || (k === 'otter' && this.terrain.k(u.x, u.y) === K.Water)) sum.boat_loop += h * (k === 'carrier' ? 1.4 : 1);
      else if (k === 'buggy' || k === 'arty' || k === 'apc') sum.engine_loop += h;
      else sum.tracks_loop += h;
    }
    for (const f of this.fires) if (f.t < BURN_WRECK) sum.fire_loop += at(f.x, f.y) * (1 - f.t / BURN_WRECK);
    for (const r of this.ruins) if (r.t < BURN_RUIN) sum.fire_loop += at(r.x, r.y) * 1.5 * (1 - r.t / BURN_RUIN);
    for (const b of this.buildings) if (!b.dead && b.hp < 0.5) sum.fire_loop += at(b.x, b.y) * (0.5 - b.hp);
    // surf where the view has both land and water in it (looked at twice a second)
    if (this.time - this.surfT > 0.5 || this.time < this.surfT) {
      this.surfT = this.time;
      const v = this.view;
      let wet = 0;
      let all = 0;
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 6; j++) {
          const [x, y] = toWorld(v.x0 + ((i + 0.5) / 6) * (v.x1 - v.x0), v.y0 + ((j + 0.5) / 6) * (v.y1 - v.y0), 0);
          all++;
          if (this.terrain.k(x, y) === K.Water) wet++;
        }
      const f = all ? wet / all : 0;
      this.surf = Math.min(1, 4 * f * (1 - f) + f * 0.3);
    }
    const zoom = Math.max(0.35, Math.min(1, 600 / Math.max(1, this.view.x1 - this.view.x0)));
    sum.surf_loop = this.surf * (0.4 + 0.6 * zoom);
    for (const n of Object.keys(sum) as Loop[]) level(n, n === 'surf_loop' ? sum[n] : Math.min(1, sum[n] * 0.35 + (sum[n] > 0.02 ? 0.25 : 0)));
  }

  // Paint one tile of ground and scatter its trees, bushes and rocks.
  private *buildTile(tx: number, ty: number): Generator<void, Tile<Prop>> {
    const T = this.terrain;
    const p = yield* T.paintSteps(tx, ty);
    const R = p.region;
    const kAt = (x: number, y: number): K => {
      const i = Math.floor(x) - R.x0;
      const j = Math.floor(y) - R.y0;
      return i < 0 || j < 0 || i >= R.w || j >= R.h ? T.k(x, y) : (R.kind[j * R.w + i] as K);
    };
    const props: Prop[] = [];
    const forestSeed = this.seed + 400;
    const SX0 = tx * CH;
    const SY0 = ty * CH;
    for (let sy = SY0 + ((((6 - SY0) % 5) + 5) % 5); sy < SY0 + CH; sy += 5)
      for (let sx = SX0 + ((((2 - SX0) % 7) + 7) % 7); sx < SX0 + CH; sx += 7) {
        const jx = sx + hash2(sx, sy, forestSeed) * 6;
        const jy = sy + hash2(sy, sx, forestSeed) * 4;
        // a prop may sit on a plateau: test the high ground first
        let [wx, wy] = toWorld(jx, jy, HP);
        let z = HP;
        if (kAt(wx, wy) !== K.High) {
          [wx, wy] = toWorld(jx, jy, 0);
          z = 0;
          if (kAt(wx, wy) === K.High) continue; // that spot is a cliff face
        }
        const k = kAt(wx, wy);
        if (k !== K.Grass && k !== K.High) continue;
        // keep clear of building pads, more so in front of them where a tree would hide them
        if (kAt(wx + 5, wy) === K.Pad || kAt(wx - 9, wy) === K.Pad || kAt(wx, wy + 5) === K.Pad || kAt(wx, wy - 9) === K.Pad || kAt(wx - 8, wy - 8) === K.Pad || kAt(wx - 4, wy + 4) === K.Pad || kAt(wx + 4, wy - 4) === K.Pad) continue;
        if (this.oreNear(wx, wy, 12).length) continue;
        // and clear of the bridges and their ends
        if (this.bridges.some((b) => {
          const [bx, by] = this.nearPoint(wx, wy, b.x, b.y);
          return Math.abs(wx - bx) < b.art.rx + 12 && Math.abs(wy - by) < b.art.ry + 12;
        }))
          continue;
        const forest = (this.forestF.at(jx, jy) - 0.6) * 2.4;
        const roll = hash2(Math.floor(wx), Math.floor(wy), forestSeed + 1);
        let spr: StackSprite | null = null;
        if (roll < forest) spr = this.trees[Math.floor(hash2(sx, sy, 3) * 5)];
        else if (roll < 0.014) spr = this.trees[5 + Math.floor(hash2(sx, sy, 4) * 3)];
        else if (roll < 0.035) spr = this.bushes[Math.floor(hash2(sx, sy, 5) * 3)];
        else if (roll < 0.045 || (z === HP && roll < 0.09)) spr = this.rocks[Math.floor(hash2(sx, sy, 6) * 4)];
        if (spr) props.push({ spr, x: wx, y: wy, z });
      }
    return { canvas: p.canvas, foam: p.foam, foam2: p.foam2, props, used: 0 };
  }

  // Can unit u be at (x, y)? Boats need water, everyone else dry land off
  // the cliffs and out of the buildings (helicopters fly over it all).
  private okAt(u: Unit, x: number, y: number): boolean {
    const w = this.terrain.k(x, y) === K.Water;
    if (isNaval(u.kind)) return w && !this.blockAt(x, y) && this.offShore(u.kind, x, y);
    if (isAir(u.kind)) return !w;
    // (the Otter rides its air cushion over the water too)
    if (u.kind === 'otter' && w) return !this.blockAt(x, y);
    // (over the water on a bridge's deck)
    // (the Commando swims)
    if ((w && u.kind !== 'cmdo' && !this.deckAt(x, y)) || this.terrain.cliff(x, y)) return false;
    if (!this.blocks.size) return true;
    // (its body clear of them too, not just its middle; but the building it
    // is coming out of, or a hauler backing onto its refinery's pad, lets it in)
    const m = isFoot(u.kind) ? 1.5 : u.kind === 'mcv' ? 6 : 4;
    const let1 = u.exit?.b.id ?? 0;
    const let2 = u.job?.st === 'dock' ? (u.job.ref?.id ?? 0) : 0;
    const free = (bx: number, by: number) => {
      const b = this.blockAt(bx, by);
      return b === 0 || b === let1 || b === let2;
    };
    return free(x, y) && free(x + m, y) && free(x - m, y) && free(x, y + m) && free(x, y - m);
  }

  // Is there open water all round (x, y), as far as a ship of this kind
  // keeps from the shore?
  private offShore(kind: Kind, x: number, y: number): boolean {
    const c = SEA_CLEAR[kind];
    if (!c) return true;
    const T = this.terrain;
    for (const r of [c, c * 0.5])
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + (r === c ? 0 : 0.26);
        if (T.k(x + Math.cos(a) * r, y + Math.sin(a) * r) !== K.Water) return false;
      }
    return true;
  }

  // The nearest place to (x, y) that ship u can be (far enough out), within
  // reach, or null.
  private nearestSea(u: Unit, x: number, y: number, far = 160): [number, number] | null {
    if (this.okAt(u, x, y)) return [x, y];
    for (let r = 4; r <= far; r += 4) {
      const n = Math.max(8, Math.round(r / 2));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (this.okAt(u, px, py)) return [px, py];
      }
    }
    return null;
  }

  // Where a new carrier is launched off Naval yard b: the nearest open water
  // it fits in, clear of the yard and of the other ships.
  private launchSpot(u: Unit, b: Building): [number, number, number] | null {
    const r = UNIT[u.kind].r;
    const T = this.terrain;
    const clear = (x: number, y: number, m: number) =>
      T.k(x, y) === K.Water &&
      this.buildings.every((o) => {
        const [ox, oy] = this.nearPoint(x, y, o.x, o.y);
        return Math.abs(ox - x) > o.art.rx + m || Math.abs(oy - y) > o.art.ry + m;
      });
    const free = (x: number, y: number) =>
      this.okAt(u, x, y) &&
      clear(x, y, r * 0.6) &&
      this.units.every((o) => {
        if (o === u || !isNaval(o.kind)) return true;
        const [ox, oy] = this.nearPoint(x, y, o.x, o.y);
        return Math.hypot(ox - x, oy - y) > r + UNIT[o.kind].r * 0.8;
      });
    // (the whole long hull lies on open water, clear of the yard: try
    // lying pointing away from it first, then round from there)
    const lies = (x: number, y: number, a: number) => {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (const s of [-96, -72, -48, 48, 72, 98])
        for (const w of [-22, 0, 22]) if (!clear(x + s * ca - w * sa, y + s * sa + w * ca, 6)) return false;
      return true;
    };
    for (let d = 0; d <= 700; d += 8) {
      const n = Math.max(8, Math.round(d / 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = b.x + Math.cos(a) * d;
        const y = b.y + Math.sin(a) * d;
        if (!free(x, y)) continue;
        if (u.kind !== 'carrier') return [x, y, a];
        for (let k = 0; k < 8; k++) {
          const h = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4);
          if (lies(x, y, h)) return [x, y, h];
        }
      }
    }
    return null;
  }

  // Is (x, y) inside a building that unit u isn't let into?
  private inBuilding(u: Unit, x: number, y: number): boolean {
    const b = this.blockAt(x, y);
    return b !== 0 && b !== u.exit?.b.id && !(u.job?.st === 'dock' && b === u.job.ref?.id);
  }

  // Where the buildings stand solid (see buildingBlock), as the id of the
  // building on each BLOCK_CELL square of the first copy of the map (0 for
  // none). Made again whenever buildings come or go.
  private blocks = new Map<number, number>();
  private blocksKey = '';

  private refreshBlocks(): void {
    const key = this.buildings.map((b) => b.id).join(',');
    if (key === this.blocksKey) return;
    this.blocksKey = key;
    this.blocks.clear();
    for (const b of this.buildings) {
      const k = buildingBlock(b.kind);
      for (let j = 0; j < k.ny; j++)
        for (let i = 0; i < k.nx; i++) {
          if (!k.solid[j * k.nx + i]) continue;
          const [fx, fy] = this.fold(b.x - k.rx + (i + 0.5) * BLOCK_CELL, b.y - k.ry + (j + 0.5) * BLOCK_CELL);
          this.blocks.set(blockKey(fx, fy), b.id);
        }
    }
    // the way-finding grid's open cells have changed
    this.landCells.clear();
    this.seaCells.clear();
    this.carrierCells.clear();
  }

  // The id of the building standing at ground point (x, y), or 0.
  private blockAt(x: number, y: number): number {
    if (!this.blocks.size) return 0;
    const [fx, fy] = this.fold(x, y);
    return this.blocks.get(blockKey(fx, fy)) ?? 0;
  }

  // which grid cells of the way-finding grid are open, for boats and for the rest
  private seaCells = new Map<number, boolean>();
  private carrierCells = new Map<number, boolean>(); // (the carrier keeps further out, on a coarser grid)
  private landCells = new Map<Kind, Map<number, boolean>>(); // (each kind of unit by its size)
  private routeMs = 0; // spent finding ways this frame

  private landFor(k: Kind): Map<number, boolean> {
    let m = this.landCells.get(k);
    if (!m) this.landCells.set(k, (m = new Map()));
    return m;
  }

  // The way for unit u to its destination round cliffs and water (see path.ts).
  private route(u: Unit): void {
    u.path = undefined;
    if (isAir(u.kind)) return;
    const boat = isNaval(u.kind);
    // (a ship too near the shore, as one just out of the Naval yard can be,
    // first heads out to where it can be, and finds its way from there)
    let lead: [number, number] | null = null;
    if (!this.okAt(u, u.x, u.y)) {
      if (!boat || this.terrain.k(u.x, u.y) !== K.Water) return;
      lead = this.nearestSea(u, u.x, u.y);
      if (!lead) return;
    }
    const [sx, sy] = lead ?? [u.x, u.y];
    // a ship sails the sea grid when its goal is somewhere it can get to
    const nav = boat ? this.seaNav() : null;
    const sea = nav?.path(SEA_CLEAR[u.kind] ?? 0, ...toScreen(sx, sy), ...toScreen(u.tx, u.ty));
    if (sea) {
      const pts = sea.map(([px, py]) => toWorld(px, py, 0));
      u.path = lead ? [lead, ...pts] : pts;
      return;
    }
    const okFn = (x: number, y: number) => this.okAt(u, x, y);
    const t0 = performance.now();
    // (a unit let through a building finds its own way: the shared grid is for everyone else)
    const own = !!u.exit || u.job?.st === 'dock';
    // (somewhere a ship can't get to: only as near as it finds close by)
    const p = findWay(okFn, sx, sy, u.tx, u.ty, boat ? this.seaCellsOf(u) : own ? new Map() : this.landFor(u.kind), boat ? (nav ? { ...this.seaPath(u), maxNodes: 3000 } : this.seaPath(u)) : {}).path;
    this.routeMs += performance.now() - t0;
    if (lead) u.path = [lead, ...(p?.length ? p : p ? [[u.tx, u.ty] as [number, number]] : [])];
    else if (p === null) u.moving = false;
    else if (p.length) u.path = p;
  }

  private seaCellsOf(u: Unit): Map<number, boolean> {
    return u.kind === 'carrier' ? this.carrierCells : this.seaCells;
  }
  private seaPath(u: Unit): PathOpts {
    return u.kind === 'carrier' ? CARRIER_PATH : SEA_PATH;
  }

  // The sea grid (see seanav.ts), made from the overview the first time a
  // ship needs it.
  private navGrid: SeaNav | null = null;
  private seaNav(): SeaNav | null {
    if (this.navGrid) return this.navGrid;
    this.mapStep(1e9);
    if (this.navGrid) return this.navGrid;
    const wet = this.terrain.ovWet;
    if (!wet) return null;
    const tw = Math.round(this.w / OV);
    const th = Math.round(this.h / OV);
    // two by two of the overview's pixels to a cell: water if half of them are
    const at = (i: number, j: number) => wet[j * tw + i];
    this.navGrid = new SeaNav(tw >> 1, th >> 1, ((tw >> 1) * 2 * this.w) / tw, ((th >> 1) * 2 * this.h) / th, (i, j) => at(2 * i, 2 * j) + at(2 * i + 1, 2 * j) + at(2 * i, 2 * j + 1) + at(2 * i + 1, 2 * j + 1) >= 2);
    return this.navGrid;
  }

  // Can ship u get to (x, y) by water (and be there, far enough from the
  // shore)?
  private seaReach(u: Unit, x: number, y: number): boolean {
    [x, y] = this.nearPoint(u.x, u.y, x, y);
    if (!this.okAt(u, x, y)) return false;
    const [sx, sy] = this.nearestSea(u, u.x, u.y) ?? [u.x, u.y];
    const nav = this.seaNav();
    if (nav?.joined(SEA_CLEAR[u.kind] ?? 0, ...toScreen(sx, sy), ...toScreen(x, y))) return true;
    // (the grid is coarse: a small boat up a narrow creek is looked for
    // close by too)
    if (nav && SEA_CLEAR[u.kind]) return false;
    const way = findWay((px, py) => this.okAt(u, px, py), sx, sy, x, y, this.seaCellsOf(u), { ...this.seaPath(u), maxNodes: 4000 });
    return way.reached;
  }

  // Where ship u could fire on t from (in reach of it, and somewhere it can
  // get to by water), or null if nowhere.
  private fireSpot(u: Unit, t: Target): [number, number] | null {
    const w = WEAPON[u.kind];
    if (!w) return null;
    if (this.reach(u.x, u.y, t) <= w.range) return [u.x, u.y];
    const [cx, cy] = this.nearPoint(u.x, u.y, t.x, t.y);
    const cands: [number, number][] = [];
    for (const k of [0.85, 0.6, 0.35])
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const px = cx + Math.cos(a) * w.range * k;
        const py = cy + Math.sin(a) * w.range * k;
        const d = this.reach(px, py, t);
        if (d <= w.range && d >= (w.min ?? 0) && this.okAt(u, px, py)) cands.push([px, py]);
      }
    cands.sort((a, b) => Math.hypot(a[0] - u.x, a[1] - u.y) - Math.hypot(b[0] - u.x, b[1] - u.y));
    for (const c of cands) if (this.seaReach(u, c[0], c[1])) return c;
    return null;
  }

  // Can u attack t: it has a weapon for it, and a ship has somewhere on the
  // water to fire from.
  private canAttack(u: Unit, t: Target): boolean {
    if (!this.canHit(WEAPON[u.kind], t)) return false;
    return !isNaval(u.kind) || !!this.fireSpot(u, t);
  }


  private groundZ(u: Unit): number {
    if (isNaval(u.kind) || (u.kind === 'otter' && this.terrain.k(u.x, u.y) === K.Water)) return 0;
    // a jet over its carrier sits on (or comes down to) the deck (and flies
    // round to land at the deck's height, so it doesn't drop onto it)
    if (u.deck !== undefined) {
      const c = this.carrierOf(u);
      if (c) {
        if (u.dop) return DECK_Z;
        const [lu, lv] = this.deckLocal(c, u.x, u.y);
        if (lu > -94 && lu < 99 && Math.abs(lv) < 23) return DECK_Z;
      }
    }
    const dz = this.deckZ(u.x, u.y);
    if (dz >= 0) return dz;
    return this.terrain.elev(u.x, u.y);
  }

  // A soldier with nothing to do: stands a while, then wanders a step or two
  // round the spot it was left on, or just turns to look somewhere else.
  private paceAbout(u: Unit, dt: number): void {
    // on a player's screen the host picks where it paces (by chance, so the two
    // would go different ways and pull it to and fro): just follow it about,
    // turning to face the way the host has it
    if (this.net === 'client') {
      u.pace = undefined;
      if (u.netA === undefined) return;
      const diff = angDiff(u.netA, u.a);
      const stepA = UNIT[u.kind].turn * dt;
      u.a = Math.abs(diff) <= stepA ? u.netA : u.a + Math.sign(diff) * stepA;
      return;
    }
    if (!u.home) u.home = [u.x, u.y];
    if (u.pace) {
      const dx = u.pace[0] - u.x;
      const dy = u.pace[1] - u.y;
      const dist = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      const diff = angDiff(want, u.a);
      const stepA = UNIT[u.kind].turn * dt;
      u.a = Math.abs(diff) <= stepA ? want : u.a + Math.sign(diff) * stepA;
      const sp = Math.min(dist, PACE_SPEED * dt);
      const nx = u.x + Math.cos(want) * sp;
      const ny = u.y + Math.sin(want) * sp;
      if (dist < 0.3 || !this.okAt(u, nx, ny)) {
        u.pace = undefined;
        u.idle = 1.5 + Math.random() * 4;
      } else {
        u.x = nx;
        u.y = ny;
      }
      return;
    }
    u.idle -= dt;
    if (u.idle > 0) return;
    u.idle = 1.5 + Math.random() * 4;
    if (Math.random() < 0.35) {
      u.a += (Math.random() - 0.5) * 2.5; // just look round
      return;
    }
    const r = 2 + Math.random() * (PACE_R - 2);
    const th = Math.random() * Math.PI * 2;
    const px = u.home[0] + Math.cos(th) * r;
    const py = u.home[1] + Math.sin(th) * r;
    if (!this.okAt(u, px, py) || this.buildings.some((b) => Math.abs(b.x - px) < b.art.rx + 1 && Math.abs(b.y - py) < b.art.ry + 1)) return;
    u.pace = [px, py];
  }

  // ---------- Bridges ----------

  // Which bridge's deck covers each DECK_CELL square of the first copy of the
  // map (standing ones only): there the water underneath doesn't stop anyone.
  private decks = new Map<number, Bridge>();
  private refreshDecks(): void {
    this.decks.clear();
    for (const b of this.bridges) {
      if (b.dead) continue;
      for (let s = -b.L / 2 + 1; s < b.L / 2; s += DECK_CELL / 2)
        for (let c = -(DECK_W - 1.5); c <= DECK_W - 1.5; c += DECK_CELL / 2) {
          const [x, y] = this.fold(b.x + (b.axis === 0 ? s : c), b.y + (b.axis === 0 ? c : s));
          this.decks.set(deckKey(x, y), b);
        }
    }
    // the way-finding grid's open cells have changed
    this.landCells.clear();
  }

  // The standing bridge whose deck is at ground point (x, y), if any.
  private deckAt(x: number, y: number): Bridge | undefined {
    if (!this.decks.size) return undefined;
    const [fx, fy] = this.fold(x, y);
    return this.decks.get(deckKey(fx, fy));
  }

  // How high the deck is at (x, y) (it ramps up off each bank), or -1 off it.
  private deckZ(x: number, y: number): number {
    const b = this.deckAt(x, y);
    if (!b) return -1;
    const [bx, by] = this.nearPoint(x, y, b.x, b.y);
    const s = (b.axis === 0 ? x - bx : y - by) + b.L / 2;
    return deckTop(b.style, s, b.L);
  }

  // A bridge's pictures, intact or broken: drawn by a worker (or here, when
  // there are none), and null until they are ready.
  private bridgeSprites = new Map<string, [StackSprite, StackSprite | null] | null>();
  private bridgeWait = new Map<string, Promise<unknown>>();
  private bridgeSeen = new Map<string, number>(); // when each was first wanted on screen
  private bridgePics(b: Bridge, broken = !!b.dead): [StackSprite, StackSprite | null] | null {
    const key = bridgeKey(b.style, b.axis, b.n, broken);
    const had = this.bridgeSprites.get(key);
    if (had) return had;
    void this.bridgeReady(b, broken, true);
    // in view and still not back from the workers (they're busy): draw it here
    const t = (this.bridgeSeen.get(key) ?? this.bridgeSeen.set(key, performance.now()).get(key))!;
    if (performance.now() - t > 1500) this.bridgeSprites.set(key, bridgeFromKey(key));
    return this.bridgeSprites.get(key) ?? null;
  }
  // Have a bridge's pictures drawn ahead of time; resolves when they're ready.
  private bridgeReady(b: Bridge, broken: boolean, now: boolean): Promise<unknown> {
    const key = bridgeKey(b.style, b.axis, b.n, broken);
    if (this.bridgeSprites.get(key)) return Promise.resolve();
    let p = this.bridgeWait.get(key);
    if (!p) {
      if (!pooled()) {
        this.bridgeSprites.set(key, bridgeFromKey(key));
        return Promise.resolve();
      }
      p = workerBridge(key, now).then((pics) => {
        if (!this.bridgeSprites.get(key)) this.bridgeSprites.set(key, pics ?? bridgeFromKey(key));
      });
      this.bridgeWait.set(key, p);
    }
    return p;
  }

  // The bridge under screen point (x, y), on any copy of the map.
  private bridgeAt(x: number, y: number): Bridge | null {
    for (const b of this.bridges) {
      const [bsx, bsy] = toScreen(b.x, b.y);
      const lx = Math.round((x - bsx) / this.w) * this.w;
      const ly = Math.round((y - bsy) / this.h) * this.h;
      if (this.shroud && !this.shroud.seen(x, y)) continue;
      for (let z = 0; z <= BRIDGE_Z[b.style] + 3; z += 1.5) {
        const [wx, wy] = toWorld(x - lx, y - ly, z);
        if (Math.abs(wx - b.x) <= b.art.rx && Math.abs(wy - b.y) <= b.art.ry) return b;
      }
    }
    return null;
  }

  // A bridge comes down: it blows apart along its length into the water,
  // and anything on it goes down with it.
  // (quiet: just broken, as when a saved game is taken up again)
  private breakBridge(b: Bridge, quiet = false): void {
    if (b.dead) return;
    b.dead = true;
    b.hp = 0;
    if (quiet) {
      this.refreshDecks();
      return;
    }
    b.fellT = this.time;
    for (const u of [...this.units]) if (!isAir(u.kind) && !u.exit && this.deckAt(u.x, u.y) === b && this.net !== 'client') this.kill(u, true);
    this.refreshDecks();
    const ex = b.axis === 0 ? 1 : 0;
    const ey = 1 - ex;
    const span = b.L / 2 - 10;
    for (let i = 0; i < 9; i++) {
      const t = (Math.random() * 2 - 1) * span;
      const c = (Math.random() * 2 - 1) * DECK_W * 0.7;
      const [sx, sy] = toScreen(b.x + ex * t + ey * c, b.y + ey * t + ex * c, BRIDGE_Z[b.style] + Math.random() * 3);
      this.fx.boom(sx, sy, 5 + Math.random() * 5, i * 0.07);
      this.fx.dust(sx, sy + 4, 6);
    }
    // spray where it hits the water
    for (let i = 0; i < 16; i++) {
      const t = (Math.random() * 2 - 1) * span;
      const [sx, sy] = toScreen(b.x + ex * t, b.y + ey * t, 0);
      this.particles.push({ x: sx + (Math.random() - 0.5) * 10, y: sy, vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 10, life: 0, max: 1 + Math.random(), kind: 'wake', size: 1 });
    }
    const [cx, cy] = toScreen(b.x, b.y, 4);
    this.quake(cx, cy, 2.2);
    this.sound(b.x, b.y, 'explosion_large', 1, { rate: 0.85 }, 4);
    this.sound(b.x, b.y, 'building_collapse', 1, { delay: 0.25 }, 2);
    this.notice('Bridge destroyed');
    this.mapVersion++;
  }

  // A bridge mended (by an Engineer at one of its huts): it stands again, whole.
  private mendBridge(b: Bridge): void {
    const was = b.dead;
    b.dead = false;
    b.hp = 1;
    b.fellT = undefined;
    if (was) this.refreshDecks();
    const ex = b.axis === 0 ? 1 : 0;
    const ey = 1 - ex;
    for (let i = 0; i < 8; i++) {
      const t = (i / 7 - 0.5) * (b.L - 12);
      const [sx, sy] = toScreen(b.x + ex * t, b.y + ey * t, BRIDGE_Z[b.style]);
      this.fx.dust(sx, sy, 5);
    }
    this.sound(b.x, b.y, 'build_rise', 1, { rate: 1.1 }, 3);
    this.mapVersion++;
  }

  // ---------- Input (screen coordinates) ----------

  private screenOf(u: Unit): [number, number] {
    const alt = this.alt(u);
    return toScreen(u.x, u.y, u.z + alt + MID[u.kind]);
  }

  private groundAt(sx: number, sy: number): [number, number] {
    for (let z = HP; z > 0; z--) {
      const [x, y] = toWorld(sx, sy, z);
      if (this.terrain.isHigh(x, y)) return [x, y];
    }
    return toWorld(sx, sy, 0);
  }

  // The copy of unit u nearest screen point (x, y), as laps across and down.
  private copyNear(u: Unit, x: number, y: number): [number, number] {
    const [sx, sy] = toScreen(u.x, u.y);
    return [Math.round((x - sx) / this.w), Math.round((y - sy) / this.h)];
  }

  // The unit under screen point (x, y), which may be on any copy of the
  // world (each unit's nearest copy is tested), and which copy it is.
  private unitAt(x: number, y: number): { u: Unit; lap: [number, number] } | null {
    let best: Unit | null = null;
    let bestLap: [number, number] = [0, 0];
    let bd = 1e9;
    for (const u of this.units) {
      if (!this.shown(u) || this.noPick(u)) continue;
      const lap = this.copyNear(u, x, y);
      const [sx, sy] = this.screenOf(u);
      const d = Math.hypot(sx + lap[0] * this.w - x, sy + lap[1] * this.h - y);
      if (d < UNIT[u.kind].r + 4 && d < bd) {
        bd = d;
        best = u;
        bestLap = lap;
      }
    }
    return best ? { u: best, lap: bestLap } : null;
  }

  // What a tap at (x, y) would do, for the mouse cursor. Follows click().
  cursorAt(x: number, y: number): CursorAt {
    this.hoverBridge = null;
    // placing a building: the plain arrow, as the ghost itself shows where it goes
    if (this.ghost) return null;
    if (this.paraAim) return 'move';
    if (this.mode) return this.modeAt(x, y) ? (this.mode === 'repair' ? 'fix' : 'sell') : 'blocked';
    const mine = this.mine();
    // Ctrl or Cmd held over a bridge: fire on it
    const fb = this.forceBridge(x, y);
    if (fb) {
      this.hoverBridge = fb;
      return 'attack';
    }
    if (this.rideAt(x, y) || this.carrierAt(x, y)) return 'enter';
    // Engineers selected, over a damaged bridge (or its hut) or building of yours: mend it
    const fix = this.fixAt(x, y);
    if (fix) {
      if (isBridge(fix)) this.hoverBridge = fix;
      // (a tech building to capture: they go in, under the three yellow arrows)
      return !isBridge(fix) && this.capturable(fix, this.me) ? 'enter' : 'repair';
    }
    const hit = this.unitAt(x, y);
    // over a picked unit of yours that can deploy (a Foundry vehicle that
    // can unfold here, a G.I. to dig in or climb out, a transport with
    // soldiers in it): deploy it. A Foundry vehicle gets the three falling
    // triangles ('unfold'); the rest get the orange deploy cursor.
    const h = hit?.u;
    if (h && h.sel && h.f === this.me && this.deploysNow(h)) return h.kind === 'mcv' ? 'unfold' : 'deploy';
    if (hit && (hit.u.f === this.me || !mine.length)) return 'pick';
    if (!mine.length) {
      if (this.buildingAt(x, y)) return null;
      const sb = this.selB();
      return sb && sb.f === this.me && MAKERS.includes(sb.kind) && sb.rise >= 1 ? 'rally' : null;
    }
    const sel = mine.filter((u) => !u.deploy);
    if (!sel.length) return null;
    // over an enemy that one of them can shoot at: attack it
    const foe = this.enemyAt(x, y);
    if (foe && this.armed(sel).some((u) => this.canAttack(u, foe))) return 'attack';
    // over your refinery with a hauler selected: go and unload there
    if (sel.some((u) => u.kind === 'hauler') && this.myRefineryAt(x, y)) return 'enter';
    // over your Naval yard with a ship selected, or your Service depot with a
    // vehicle: go in for repairs
    if (this.bayAt(x, y)) return 'enter';
    // over ore with a hauler selected: dig it (haulers only ever go after ore)
    const [gx, gy] = this.fold(...this.groundAt(x, y));
    if (sel.some((u) => u.kind === 'hauler') && this.oreNear(gx, gy, 16).some((n) => n.amt > 20)) return 'harvest';
    // boats can't go onto land (nor anywhere they can't get to by water),
    // nor anyone else into the water
    return sel.some((u) => this.canGo(u, gx, gy)) ? 'move' : 'blocked';
  }

  // Can u be sent to (x, y)? A ship only where it can get to by water.
  private canGo(u: Unit, x: number, y: number): boolean {
    return isNaval(u.kind) ? this.seaReach(u, x, y) : this.okAt(u, ...this.nearPoint(u.x, u.y, x, y));
  }

  // Units to fight with: these, and the jets parked on any carriers among them.
  private armed(sel: Unit[]): Unit[] {
    const decks = new Set(sel.filter((u) => u.kind === 'carrier').map((u) => u.id));
    if (!decks.size) return sel;
    return [...sel.filter((u) => u.kind !== 'carrier'), ...this.units.filter((j) => j.deck !== undefined && decks.has(j.deck) && !j.dead && !sel.includes(j))];
  }

  private mine(): Unit[] {
    return this.units.filter((u) => u.sel && u.f === this.me);
  }

  // The bridge (standing) under screen point (x, y) that your units would
  // fire on, with Ctrl or Cmd held.
  private hoverBridge: Bridge | null = null;
  private forceBridge(x: number, y: number): Bridge | null {
    if (!this.force) return null;
    const sel = this.mine().filter((u) => !u.deploy);
    if (!sel.length) return null;
    const b = this.bridgeAt(x, y);
    return b && !b.dead && sel.some((u) => this.canHit(WEAPON[u.kind], b)) ? b : null;
  }

  // What the Engineers you have selected would mend at screen point (x, y):
  // a damaged or destroyed bridge (a tap on it or on one of its huts), or a
  // damaged building of yours.
  private fixAt(x: number, y: number): Bridge | Building | null {
    if (this.force) return null;
    if (!this.mine().some((u) => u.kind === 'eng')) return null;
    const b = this.hutAt(x, y) ?? this.bridgeAt(x, y);
    if (b) return b.dead || b.hp < 1 ? b : null;
    const h = this.buildingAt(x, y);
    if (h && this.capturable(h, this.me)) return h;
    return h && h.f === this.me && h.hp < 1 && h.rise >= 1 && !h.packing ? h : null;
  }

  // Can side f's Engineers take tech building b (one nobody holds, or someone else does)?
  private capturable(b: Building, f: number): boolean {
    return b.kind === 'derrick' && b.f !== f && !b.dead && b.rise >= 1;
  }

  // The bridge one of whose huts is under screen point (x, y).
  private hutAt(x: number, y: number): Bridge | null {
    if (this.shroud && !this.shroud.seen(x, y)) return null;
    for (const b of this.bridges)
      for (const [hx, hy] of b.huts) {
        const [sx, sy] = toScreen(hx, hy, 4);
        const lx = Math.round((x - sx) / this.w) * this.w;
        const ly = Math.round((y - sy) / this.h) * this.h;
        if (Math.hypot(x - lx - sx, (y - ly - sy) * 1.4) < 9) return b;
      }
    return null;
  }

  // Send the Engineers you have selected to mend t.
  private fixOrder(t: Bridge | Building): void {
    const go = this.mine().filter((u) => u.kind === 'eng' && !u.deploy);
    this.command({ c: 'fix', u: go.map((u) => u.id), t: t.id });
    t.aimT = this.time;
    const take = !isBridge(t) && this.capturable(t, this.me);
    if (this.moveMarks && go.length) {
      const [px, py] = this.fixPoint(go[0], t);
      const [mx, my] = this.fold(px, py);
      this.markers.push({ x: mx, y: my, z: 0, t: 0, fix: !take, enter: take });
    }
    ui('order_confirm', 1.2);
    this.speak(go, take ? 'move' : 'repair');
  }

  // Where Engineer u goes to mend t: just outside the nearest of a bridge's
  // huts, or the edge of a building nearest it (in u's coordinates).
  private fixPoint(u: Unit, t: Bridge | Building): [number, number] {
    if (isBridge(t)) {
      let best: [number, number] = t.huts[0];
      let bd = 1e9;
      for (const [hx, hy] of t.huts) {
        const [nx, ny] = this.nearPoint(u.x, u.y, hx, hy);
        const d = Math.hypot(nx - u.x, ny - u.y);
        if (d < bd) {
          bd = d;
          best = [nx, ny];
        }
      }
      const [hx, hy] = best;
      const d = Math.hypot(u.x - hx, u.y - hy) || 1;
      const r = HUT_R + 4;
      return [hx + ((u.x - hx) / d) * r, hy + ((u.y - hy) / d) * r];
    }
    const [cx, cy] = this.nearPoint(u.x, u.y, t.x, t.y);
    const rx = t.art.rx + 3;
    const ry = t.art.ry + 3;
    return [Math.max(cx - rx, Math.min(cx + rx, u.x)), Math.max(cy - ry, Math.min(cy + ry, u.y))];
  }

  // Whether act('deploy') (F, Space or the deploy cursor) would do anything
  // for unit u of yours.
  private deploysNow(u: Unit): boolean {
    if (u.kind === 'mcv') return !u.deploy && this.deployable(u);
    if (u.kind === 'inf') return true;
    return !!u.cargo?.length && !u.unloading;
  }

  // A refinery of yours at (x, y) that ore haulers can unload at.
  private myRefineryAt(x: number, y: number): Building | null {
    const b = this.buildingAt(x, y);
    return b && b.f === this.me && b.kind === 'refinery' && b.rise >= 1 && !b.packing ? b : null;
  }

  // Your Naval yard or Service depot at screen point (x, y), with the units
  // you have selected that it can mend (none: null).
  private bayAt(x: number, y: number): { b: Building; go: Unit[] } | null {
    const b = this.buildingAt(x, y);
    if (!b || b.f !== this.me || (b.kind !== 'navy' && b.kind !== 'depot') || b.rise < 1 || b.packing || b.hp <= 0) return null;
    const go = this.mine().filter((u) => !u.deploy && servedBy(u, b));
    return go.length ? { b, go } : null;
  }

  // Send the units you have selected that b can mend into it for repairs:
  // the ones that need it most park nearest the middle, where it mends first.
  private bayOrder(b: Building, go: Unit[]): void {
    const [bx, by] = bayOf(b);
    const moves: [number, number, number][] = [];
    [...go]
      .sort((p, q) => p.hp - q.hp)
      .forEach((u, i) => {
        // (a carrier lies off the yard, on the nearest open water it fits in)
        if (u.kind === 'carrier') {
          const p = this.launchSpot(u, b) ?? [u.x, u.y];
          const [tx, ty] = this.nearPoint(u.x, u.y, p[0], p[1]);
          moves.push([u.id, tx, ty]);
          u.aim = undefined;
          return;
        }
        const k = b.kind === 'navy' ? 1 : 0.6;
        const [dx, dy] = BAY_SLOTS[i % BAY_SLOTS.length].map((v) => v * k);
        // (in the unit's own copy of the map)
        const [tx, ty] = this.nearPoint(u.x, u.y, bx + dx, by + dy);
        moves.push([u.id, tx, ty]);
        u.aim = undefined;
      });
    this.command({ c: 'move', m: moves });
    b.aimT = this.time;
    if (this.moveMarks) {
      const [mx, my] = this.fold(bx, by);
      this.markers.push({ x: mx, y: my, z: 0, t: 0, enter: true });
    }
    ui('order_confirm', 1.3);
    this.speak(go, 'move');
  }

  // A transport of yours at (x, y) that the soldiers you have selected could
  // get into (it has room).
  private rideAt(x: number, y: number): Unit | null {
    const hit = this.unitAt(x, y);
    const t = hit?.u;
    if (!t || t.f !== this.me || !TRANSPORT.has(t.kind)) return null;
    return this.mine().some((u) => u !== t && canRide(u, t) && hasRoom(t, u)) ? t : null;
  }

  // Send the soldiers you have selected to get into transport t.
  private boardOrder(t: Unit): void {
    const go = this.mine().filter((u) => u !== t && canRide(u, t));
    this.command({ c: 'board', u: go.map((u) => u.id), t: t.id });
    t.aimT = this.time;
    if (this.moveMarks) {
      const [mx, my] = this.fold(t.x, t.y);
      this.markers.push({ x: mx, y: my, z: t.z, t: 0, enter: true });
    }
    ui('order_confirm');
    this.speak(go, 'move');
  }

  // A carrier of yours under screen point (x, y) that the Swift jets you
  // have selected could land on (it has room, and they aren't all on it).
  private carrierAt(x: number, y: number): Unit | null {
    const jets = this.mine().filter((u) => u.kind === 'jet');
    if (!jets.length) return null;
    for (const c of this.units) {
      if (c.kind !== 'carrier' || c.f !== this.me || !this.shown(c)) continue;
      const lap = this.copyNear(c, x, y);
      const [sx, sy] = this.screenOf(c);
      if (Math.hypot(sx + lap[0] * this.w - x, (sy + lap[1] * this.h - y) * 1.6) > UNIT[c.kind].r + 4) continue;
      return this.freeSlots(c).length && jets.some((j) => j.deck !== c.id) ? c : null;
    }
    return null;
  }

  // Send the Swift jets you have selected to land on carrier c.
  private landOrder(c: Unit): void {
    const go = this.mine().filter((u) => u.kind === 'jet' && u.deck !== c.id);
    this.command({ c: 'land', u: go.map((u) => u.id), t: c.id });
    c.aimT = this.time;
    if (this.moveMarks) {
      const [mx, my] = this.fold(c.x, c.y);
      this.markers.push({ x: mx, y: my, z: DECK_Z, t: 0, enter: true });
    }
    ui('order_confirm');
    this.speak(go, 'move');
  }

  // You command your own side. Enemy units and buildings can be tapped to
  // look at them (their health), but not ordered about.
  click(x: number, y: number, add: boolean): void {
    if (this.paraAim) {
      // the drop zone for the paratroopers
      this.paraAim = false;
      const [wx, wy] = this.fold(...this.groundAt(x, y));
      this.command({ c: 'para', x: wx, y: wy });
      this.markers.push({ x: wx, y: wy, z: this.terrain.elev(wx, wy), t: 0 });
      ui('order_confirm');
      this.emit();
      return;
    }
    if (this.mode) {
      // Repair or Sell: a tap on a building of yours repairs it (or stops
      // repairing it) or sells it; anywhere else puts the button back up
      const b = this.modeAt(x, y);
      if (!b) {
        this.mode = null;
        this.emit();
        return;
      }
      this.command({ c: this.mode === 'repair' ? 'mend' : 'sell', b: b.id });
      ui('order_confirm');
      return;
    }
    if (this.forceBridge(x, y) || this.fixAt(x, y)) return this.order(x, y);
    // soldiers selected and a tap on a transport of yours: they get in
    const ride = add ? null : this.rideAt(x, y);
    if (ride) return this.boardOrder(ride);
    // jets selected and a tap on a carrier of yours: they land on it
    const deck = add ? null : this.carrierAt(x, y);
    if (deck) return this.landOrder(deck);
    const hitU = this.unitAt(x, y);
    const mine = this.mine();
    if (hitU && (hitU.u.f === this.me || !mine.length)) {
      const best = hitU.u;
      // a second tap on a lone Foundry vehicle deploys it
      const now = performance.now();
      const again = this.lastTap && this.lastTap.u === best && now - this.lastTap.t < 400 && best.sel && !add;
      this.lastTap = { u: best, t: now };
      for (const b of this.buildings) b.sel = false;
      const enemy = best.f !== this.me;
      // enemies are looked at one at a time, never mixed into your selection
      if (!add || enemy || this.units.some((o) => o.sel && o.f !== this.me)) for (const o of this.units) if (o !== best) o.sel = false;
      best.sel = add && !enemy ? !best.sel : true;
      [best.lap, best.lapY] = hitU.lap;
      if (again && best.f === this.me && this.deployable(best) && !best.deploy) {
        this.command({ c: 'deploy', u: [best.id] });
        this.deployMarks([best]);
      }
      // and on a transport with soldiers in it lets them out
      if (again && best.f === this.me && best.cargo?.length && !best.unloading) this.command({ c: 'unload', u: [best.id] });
      this.emit();
      return;
    }
    this.lastTap = null;
    const hit = this.buildingAt(x, y);
    // with units of yours selected, a tap on a building is still a move order
    if (hit && !mine.length) {
      for (const o of this.units) o.sel = false;
      for (const b of this.buildings) b.sel = b === hit;
      this.emit();
      return;
    }
    const sb = this.selB();
    if (sb) {
      // with a barracks, works or helipad selected, a tap on the ground sets
      // where its new units go
      if (sb.f === this.me && MAKERS.includes(sb.kind) && sb.rise >= 1) {
        const [wx, wy] = this.fold(...this.groundAt(x, y));
        this.command({ c: 'rally', b: sb.id, x: wx, y: wy });
        announce('rally_point');
        this.markers.push({ x: wx, y: wy, z: this.terrain.elev(wx, wy), t: 0 });
        return;
      }
      this.deselect();
      return;
    }
    if (!mine.length) {
      if (this.units.some((u) => u.sel)) this.deselect();
      return;
    }
    this.order(x, y);
  }

  // The building under screen point (x, y), on any copy of the map.
  private buildingAt(x: number, y: number): Building | null {
    // enemy buildings under the shroud can't be picked out
    const hidden = this.shroud && !this.shroud.seen(x, y);
    for (const b of this.buildings) {
      if (hidden && b.f !== this.me) continue;
      const [bsx, bsy] = toScreen(b.x, b.y);
      const lx = Math.round((x - bsx) / this.w) * this.w;
      const ly = Math.round((y - bsy) / this.h) * this.h;
      for (let z = 0; z <= 24; z += 3) {
        const [wx, wy] = toWorld(x - lx, y - ly, z);
        if (Math.abs(wx - b.x) <= b.art.rx && Math.abs(wy - b.y) <= b.art.ry) return b;
      }
    }
    return null;
  }

  // Shift a world point by whole laps around the world, across and down.
  private lapped(x: number, y: number, lap: number, lapY: number): [number, number] {
    const k = (lap * this.w) / 2;
    const j = lapY * this.h;
    return [x + k + j, y - k + j];
  }

  // Bring a ground point back onto the first copy of the map.
  private fold(wx: number, wy: number): [number, number] {
    const [sx, sy] = toScreen(wx, wy);
    return this.lapped(wx, wy, -Math.floor(sx / this.w), -Math.floor(sy / this.h));
  }

  order(x: number, y: number, shortest = false): void {
    let sel = this.units.filter((u) => u.sel && !u.deploy && u.f === this.me);
    if (!sel.length) return;
    // Ctrl or Cmd and a click on a bridge: everyone who can, fires on it
    const fb = shortest ? null : this.forceBridge(x, y);
    // onto an enemy: everyone who can, attacks it
    const foe = fb ?? (shortest ? null : this.enemyAt(x, y));
    const ride = shortest || fb ? null : this.rideAt(x, y);
    if (ride) return this.boardOrder(ride);
    const deck = shortest || fb ? null : this.carrierAt(x, y);
    if (deck) return this.landOrder(deck);
    // Engineers onto something to mend: they go and mend it (the rest stay put)
    const fix = shortest || fb ? null : this.fixAt(x, y);
    if (fix) return this.fixOrder(fix);
    // (a carrier sends its jets)
    const fighters = foe ? this.armed(sel).filter((u) => this.canAttack(u, foe)) : [];
    if (foe && fighters.length) {
      this.command({ c: 'attack', u: fighters.map((u) => u.id), t: foe.id });
      foe.aimT = this.time;
      if (this.moveMarks) {
        const [mx, my] = this.fold(foe.x, foe.y);
        this.markers.push({ x: mx, y: my, z: isBridge(foe) ? BRIDGE_Z[foe.style] : isB(foe) ? 0 : foe.z, t: 0, foe: true });
      }
      ui('order_confirm', 0.8);
      this.speak(fighters, 'attack');
      return;
    }
    // onto your refinery: the haulers go and unload there (the rest go to it)
    const ref = shortest ? null : this.myRefineryAt(x, y);
    const haulers = sel.filter((u) => u.kind === 'hauler');
    if (ref && haulers.length) {
      this.command({ c: 'dock', u: haulers.map((u) => u.id), b: ref.id });
      ref.aimT = this.time;
      if (this.moveMarks) {
        const [mx, my] = this.fold(ref.x + DOCK[0], ref.y + DOCK[1]);
        this.markers.push({ x: mx, y: my, z: 0, t: 0, enter: true });
      }
      ui('order_confirm', 1.3);
      this.speak(haulers, 'move');
      sel = sel.filter((u) => u.kind !== 'hauler');
      if (!sel.length) return;
    }
    // onto your Naval yard or Service depot: the ships (or vehicles) go in
    // for repairs (the rest go to it)
    const bay = shortest ? null : this.bayAt(x, y);
    if (bay) {
      this.bayOrder(bay.b, bay.go);
      sel = sel.filter((u) => !bay.go.includes(u));
      if (!sel.length) return;
    }
    // haulers sent onto ore dig there; sent anywhere else they stop work
    let dig: number[] | undefined;
    let node = -1;
    {
      const [gx, gy] = this.fold(...this.groundAt(x, y));
      const near = this.oreNear(gx, gy, 16).filter((n) => n.amt > 20);
      if (near.length) {
        node = this.ore.indexOf(near[0]);
        dig = sel.filter((u) => u.kind === 'hauler').map((u) => u.id);
      }
      if (near.length && sel.every((u) => u.kind === 'hauler')) {
        this.command({ c: 'move', m: [], dig, n: node });
        const [mx, my] = this.fold(...this.groundAt(x, y));
        if (this.moveMarks || shortest) this.markers.push({ x: mx, y: my, z: 0, t: 0, ore: true });
        ui('order_confirm', 1.3);
        this.speak(sel, 'harvest');
        return;
      }
    }
    if (shortest) {
      // from the globe: take the shortest way
      const [rx, ry] = toScreen(sel[0].x, sel[0].y);
      [x, y] = nearestCopy(rx, ry, x, y, this.w, this.h);
      for (const u of sel) [u.lap, u.lapY] = this.copyNear(u, x, y);
    }
    // wx, wy are unwrapped: on the copy of the world the player is looking at
    const [wx, wy] = this.groundAt(x, y);
    // ships only go where they can get to by water: the rest of them stay put
    if (sel.some((u) => isNaval(u.kind))) {
      const go = sel.filter((u) => !isNaval(u.kind) || this.seaReach(u, ...this.lapped(wx, wy, -u.lap, -u.lapY)));
      if (!go.length) {
        ui('ui_error');
        return;
      }
      sel = go;
    }
    const [mx, my] = this.fold(wx, wy);
    if (this.moveMarks || shortest) this.markers.push({ x: mx, y: my, z: this.terrain.elev(wx, wy), t: 0, ore: !!dig?.length });
    const cols = Math.ceil(Math.sqrt(sel.length));
    const rows = Math.ceil(sel.length / cols);
    const gap = 14;
    const slots: [number, number][] = [];
    for (let i = 0; i < sel.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push([wx + (c - (cols - 1) / 2) * gap, wy + (r - (rows - 1) / 2) * gap]);
    }
    const left = [...sel];
    const moves: [number, number, number][] = [];
    slots.sort((a, b) => Math.hypot(a[0] - wx, a[1] - wy) - Math.hypot(b[0] - wx, b[1] - wy));
    for (const [sx, sy] of slots) {
      let bi = 0;
      let bd = 1e9;
      left.forEach((u, i) => {
        const [ux, uy] = this.lapped(u.x, u.y, u.lap, u.lapY);
        const d = Math.hypot(ux - sx, uy - sy);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const u = left.splice(bi, 1)[0];
      // the same move, in the unit's own (folded) coordinates
      const [tx, ty] = this.lapped(sx, sy, -u.lap, -u.lapY);
      moves.push([u.id, tx, ty]);
      u.aim = [tx, ty, tx + (wx - sx), ty + (wy - sy)];
    }
    this.command({ c: 'move', m: moves, dig, n: node });
    ui('order_confirm');
    this.speak(sel, 'move');
  }

  // If your unit u is inside a screen rect, the copy of it there (as laps).
  private inRect(u: Unit, x0: number, y0: number, x1: number, y1: number): [number, number] | null {
    if (u.f !== this.me || u.dead || this.noPick(u)) return null;
    const minx = Math.min(x0, x1);
    const maxx = Math.max(x0, x1);
    const miny = Math.min(y0, y1);
    const maxy = Math.max(y0, y1);
    const lap = this.copyNear(u, (minx + maxx) / 2, (miny + maxy) / 2);
    const [ux, uy] = this.screenOf(u);
    const sx = ux + lap[0] * this.w;
    const sy = uy + lap[1] * this.h;
    return sx >= minx - 3 && sx <= maxx + 3 && sy >= miny - 3 && sy <= maxy + 3 ? lap : null;
  }

  // Your kinds of unit inside a screen rect (the view): how many of each,
  // and how many of those are selected, in build-menu order.
  unitTypes(x0: number, y0: number, x1: number, y1: number): UnitType[] {
    const by = new Map<Kind, UnitType>();
    for (const u of this.units) {
      if (!this.inRect(u, x0, y0, x1, y1)) continue;
      let t = by.get(u.kind);
      if (!t) by.set(u.kind, (t = { kind: u.kind, name: UNIT[u.kind].name, icon: this.unitIcon(u.kind), count: 0, sel: 0 }));
      t.count++;
      if (u.sel) t.sel++;
    }
    const order = TECH.map((t) => t.unit);
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
    return [...by.values()].sort((a, b) => rank(a.kind) - rank(b.kind));
  }

  // The kinds of unit of yours that are selected, wherever they are, and
  // how many of each.
  selectedTypes(): UnitType[] {
    const by = new Map<Kind, UnitType>();
    for (const u of this.units) {
      if (!u.sel || u.f !== this.me || u.dead) continue;
      let t = by.get(u.kind);
      if (!t) by.set(u.kind, (t = { kind: u.kind, name: UNIT[u.kind].name, icon: this.unitIcon(u.kind), count: 0, sel: 0 }));
      t.count++;
      t.sel++;
    }
    const order = TECH.map((t) => t.unit);
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
    return [...by.values()].sort((a, b) => rank(a.kind) - rank(b.kind));
  }

  // Add every unit of yours of one kind inside a screen rect to the
  // selection, or (on false) take every one of that kind out of it.
  selectKind(kind: string, on: boolean, x0: number, y0: number, x1: number, y1: number): void {
    for (const b of this.buildings) b.sel = false;
    for (const u of this.units) {
      if (u.f !== this.me) {
        u.sel = false;
        continue;
      }
      if (u.kind !== kind) continue;
      if (!on) u.sel = false;
      else {
        const lap = this.inRect(u, x0, y0, x1, y1);
        if (lap) {
          u.sel = true;
          [u.lap, u.lapY] = lap;
        }
      }
    }
    this.emit();
  }

  // All (and Ctrl+A): everything of yours in the rect but the ore haulers,
  // which are left at work unless they are all there is.
  selectAll(x0: number, y0: number, x1: number, y1: number, add: boolean): void {
    const army = this.units.some((u) => u.kind !== 'hauler' && this.inRect(u, x0, y0, x1, y1));
    for (const u of this.units) {
      const lap = army && u.kind === 'hauler' ? null : this.inRect(u, x0, y0, x1, y1);
      if (lap) {
        u.sel = true;
        [u.lap, u.lapY] = lap;
      } else if (!add || u.f !== this.me) u.sel = false;
    }
    if (this.units.some((u) => u.sel)) for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void {
    for (const u of this.units) {
      const lap = this.inRect(u, x0, y0, x1, y1);
      if (lap) {
        u.sel = true;
        [u.lap, u.lapY] = lap;
      } else if (!add || u.f !== this.me) u.sel = false;
    }
    if (this.units.some((u) => u.sel)) for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  focus(): { x: number; y: number } {
    return this.home;
  }

  // Your home base: the Foundry if it stands, or else the Foundry vehicle, or
  // else where you started (screen position, on the first copy of the map).
  homeBase(): { x: number; y: number } {
    const yard = this.buildings.find((b) => b.f === this.me && b.kind === 'yard');
    const mcv = this.units.find((u) => u.f === this.me && u.kind === 'mcv');
    const b = yard ?? this.buildings.find((o) => o.f === this.me);
    if (b) {
      const [sx, sy] = toScreen(b.x, b.y);
      return { x: sx, y: sy };
    }
    if (mcv) {
      const [sx, sy] = toScreen(mcv.x, mcv.y);
      return { x: sx, y: sy };
    }
    return this.home;
  }

  // ---------- Groups ----------
  // You can put the selection into Group 1 or Group 2, then pick the group
  // again later from the toolbar (or 1 and 2), wherever its units have gone. A unit is in one group at most; putting it in another moves it.

  // The groups that have any units, with how many, the picture of their most
  // common kind, and whether the selection is exactly that group.
  groups(): GroupInfo[] {
    const out: GroupInfo[] = [];
    for (let g = 0; g < GROUP_COUNT; g++) {
      const us = this.units.filter((u) => u.grp === g && u.f === this.me && !u.dead);
      if (!us.length) continue;
      const kinds = new Map<Kind, number>();
      for (const u of us) kinds.set(u.kind, (kinds.get(u.kind) ?? 0) + 1);
      const top = [...kinds].sort((a, b) => b[1] - a[1])[0][0];
      const sel = us.every((u) => u.sel) && this.mine().length === us.length;
      out.push({ n: g, count: us.length, icon: this.unitIcon(top), sel });
    }
    return out;
  }

  // Put the units of yours that are selected into group g (and out of the
  // one they were in); whoever was in g before and isn't selected leaves it.
  setGroup(g: number): void {
    const mine = this.mine();
    if (!mine.length) return;
    for (const u of this.units) if (u.grp === g) u.grp = undefined;
    for (const u of mine) u.grp = g;
  }

  // Select group g, wherever its units are (each stays on the copy of the
  // world it was last picked on, so orders go the way they went before).
  selectGroup(g: number): boolean {
    const us = this.units.filter((u) => u.grp === g && u.f === this.me && !u.dead);
    if (!us.length) return false;
    for (const b of this.buildings) b.sel = false;
    for (const u of this.units) u.sel = us.includes(u);
    this.emit();
    return true;
  }

  selectedPoints(): [number, number][] {
    const b = this.selB();
    return b ? [toScreen(b.x, b.y)] : this.selected().map((u) => toScreen(u.x, u.y));
  }

  deselect(): void {
    this.paraAim = false;
    for (const u of this.units) u.sel = false;
    for (const b of this.buildings) b.sel = false;
    this.emit();
  }

  selected(): Unit[] {
    return this.units.filter((u) => u.sel);
  }

  // ---------- Simulation ----------

  // ---------- Music ----------

  // When your side last hit or got hit, and when troops were last out moving
  // away from the base: the music holds each mood a while after it ends, so
  // it doesn't flick back and forth.
  private fightT = -1e9;
  private awayT = -1e9;

  mood(): 'battle' | 'shroud' | 'base' {
    if (this.time - this.fightT < BATTLE_HOLD) return 'battle';
    // home is your buildings, or the foundry vehicle before it has set up
    let mine: { x: number; y: number }[] = this.buildings.filter((b) => b.f === this.me && !b.dead);
    if (!mine.length) mine = this.units.filter((u) => u.f === this.me && !u.dead && u.kind === 'mcv');
    const away = (x: number, y: number) =>
      mine.every((b) => {
        const [bx, by] = nearestCopy(x, y, b.x, b.y, this.w, this.h);
        return Math.hypot(bx - x, by - y) > AWAY;
      });
    for (const u of this.units) {
      if (u.f !== this.me || u.dead || !u.moving || u.kind === 'hauler' || u.kind === 'mcv') continue;
      if (away(u.x, u.y)) {
        this.awayT = this.time;
        break;
      }
    }
    return this.time - this.awayT < SHROUD_HOLD ? 'shroud' : 'base';
  }

  update(dt: number): void {
    this.time += dt;
    this.refreshBlocks();
    this.routeMs = 0;
    this.updateBuild(dt);
    this.mendAll(dt);
    this.enemyAI(dt);
    if (this.net !== 'client') for (const u of this.units) if (u.job) this.haul(u, dt);
    if (this.net !== 'client')
      for (const u of [...this.units]) {
        if (u.board !== undefined && !u.dead) this.boarding(u);
        if (u.fix !== undefined && !u.dead) this.fixing(u);
        if (u.unloading && !u.dead) this.letOut(u, dt);
      }
    for (const u of [...this.units]) if (u.kind === 'jet' && u.taxi) this.taxiStep(u, dt);
    for (const u of [...this.units]) if ((u.kind === 'jet' && !u.taxi) || u.kind === 'heron') this.flyAbout(u, dt);
    for (const u of [...this.units]) if (u.kind === 'plane') this.planeAbout(u, dt);
    for (const u of [...this.units]) if (u.fly !== undefined && isFoot(u.kind)) this.paraDrop(u, dt);
    for (const u of [...this.units]) if (!u.dead && !u.exit && !u.dop) this.fight(u, dt);
    // each field's generator slowly grows its ore back, nearest clumps first
    // (on a player's screen the host's ore arrives with the snapshots)
    // (not where a building has gone up on dug-out ground)
    if (this.net !== 'client') for (const g of this.oreGens) regrowField(g, ORE.regrow * dt, ORE.node, (n) => n.amt > 1 || !this.builtOn(n));
    for (const u of [...this.units]) {
      const st = UNIT[u.kind];
      u.anim += dt;
      if (u.kind === 'carrier') this.shipWater(u, dt);
      // on a player's screen: drift a little more of the way to where the host has it
      if (u.netErr) {
        const k = 1 - Math.exp(-NET_EASE * dt);
        const ex = u.netErr[0] * k;
        const ey = u.netErr[1] * k;
        u.x += ex;
        u.y += ey;
        u.netErr[0] -= ex;
        u.netErr[1] -= ey;
        if (Math.abs(u.netErr[0]) + Math.abs(u.netErr[1]) < 0.01) u.netErr = undefined;
      }
      if (u.kind === 'hauler') this.haulerLooks(u, dt);
      if (u.dug || u.digK) {
        u.digK = Math.max(0, Math.min(1, (u.digK ?? 0) + (u.dug ? dt : -dt) / DIG_S));
        if (!u.digK) u.digK = undefined;
      }
      if (u.exit && this.net !== 'client' && !isAir(u.kind)) {
        // coming out of a door (a plane out of its hangar taxis: see taxiStep): wait for it to open, drive out, then go on
        const e = u.exit;
        e.t += dt;
        if (e.b.dead) u.exit = undefined;
        else if (e.t < DOOR_S) continue;
        else {
          const foot = isFoot(u.kind);
          const r = foot ? 1.5 : st.r;
          if (!e.go) {
            e.go = true;
            u.tx = e.x + e.d.nx * (r + 5);
            u.ty = e.y + e.d.ny * (r + 5);
            u.moving = true;
          }
          if ((u.x - e.x) * e.d.nx + (u.y - e.y) * e.d.ny > r + 2 || !u.moving) {
            u.exit = undefined;
            e.then?.(u);
          }
        }
      }
      if (u.deploy) {
        this.riseArt('yard', u.f);
        // line up square with the map, then unfold
        const diff = angDiff(0, u.a);
        const stepA = st.turn * 2.5 * dt;
        u.a = Math.abs(diff) <= stepA ? 0 : u.a + Math.sign(diff) * stepA;
        // (on a player's screen the host says when it has unfolded)
        if (u.a === 0 && this.net !== 'client') {
          this.deployNow(u);
          continue;
        }
      }
      const foot = isFoot(u.kind);
      // (finding ways takes time: past a few milliseconds' worth in a frame,
      // units with somewhere new to go wait for the next)
      const wait = this.routeMs > ROUTE_MS && !isAir(u.kind) && (!u.goal || u.goal[0] !== u.tx || u.goal[1] !== u.ty);
      if (u.moving && !u.deploy && !wait && !u.digK && !u.dop) {
        let dx = u.tx - u.x;
        let dy = u.ty - u.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.8) {
          u.moving = false;
          u.x = u.tx;
          u.y = u.ty;
          u.path = undefined;
        } else {
          // a new destination: start afresh, and find the way round any
          // cliffs or water in between
          if (!u.goal || u.goal[0] !== u.tx || u.goal[1] !== u.ty) {
            u.goal = [u.tx, u.ty];
            u.best = undefined;
            u.rerouted = false;
            u.stuck = 0;
            u.slide = undefined;
            // (a chase nudges the goal along: keep the way it has if the
            // new goal is near the old end and in sight of the last corner)
            const p = u.path;
            const last = p && p[p.length - 1];
            const prev = p && p.length > 1 ? p[p.length - 2] : [u.x, u.y];
            if (p && last && Math.hypot(last[0] - u.tx, last[1] - u.ty) < 16 && clearLine((x, y) => this.okAt(u, x, y), prev[0], prev[1], u.tx, u.ty)) p[p.length - 1] = [u.tx, u.ty];
            else this.route(u);
          }
          // on a way round: head for the next corner of it (and count the
          // distance left as the length of the way, for giving up)
          if (u.path) {
            while (u.path.length > 1 && Math.hypot(u.path[0][0] - u.x, u.path[0][1] - u.y) < 3) u.path.shift();
            const [px, py] = u.path[0];
            if (u.path.length === 1 && Math.hypot(px - u.tx, py - u.ty) > 0.5 && Math.hypot(px - u.x, py - u.y) < 0.8) {
              // got as near as it can to somewhere it can't reach
              u.moving = false;
              u.path = undefined;
            } else {
              dx = px - u.x;
              dy = py - u.y;
              let left = Math.hypot(dx, dy);
              for (let i = 1; i < u.path.length; i++) left += Math.hypot(u.path[i][0] - u.path[i - 1][0], u.path[i][1] - u.path[i - 1][1]);
              dist = left;
              if (u.path.length === 1 && Math.hypot(px - u.tx, py - u.ty) <= 0.5) u.path = undefined;
            }
          }
          u.best ??= dist;
          const want = Math.atan2(dy, dx);
          const free = foot || isAir(u.kind);
          let ang = free ? want : u.a;
          let sp = 0;
          let face = want;
          // Ground units keep out of the water and boats keep to it. Heading
          // into the edge, they slide along it whichever way is nearer to
          // where they are going (and stick to that way, so they don't dither).
          let slideA: number | null = null;
          if (!isAir(u.kind) && this.okAt(u, u.x, u.y)) {
            const ahead = (a: number) =>
              this.okAt(u, u.x + Math.cos(a) * 0.9, u.y + Math.sin(a) * 0.9) && this.okAt(u, u.x + Math.cos(a) * 2, u.y + Math.sin(a) * 2) && this.okAt(u, u.x + Math.cos(a) * 3.5, u.y + Math.sin(a) * 3.5) && this.okAt(u, u.x + Math.cos(a) * 5, u.y + Math.sin(a) * 5);
            if (!ahead(want)) {
              const side = u.slide ?? (hash2(Math.floor(u.x), Math.floor(u.y), 5) < 0.5 ? 1 : -1);
              search: for (const k of [0.35, 0.7, 1.05, 1.4, 1.75, 2.1]) {
                for (const sg of [side, -side]) {
                  if (ahead(want + sg * k)) {
                    slideA = want + sg * k;
                    u.slide = sg;
                    break search;
                  }
                }
              }
              if (slideA === null) u.moving = false;
              else face = slideA;
            }
          }
          // a long slide along the shore means it is trying to get somewhere
          // across the water: give up
          // (as long as a slow soldier takes to slide some 80 units, and
          // first, on a way round a building, look for the way again from here)
          u.slideT = slideA === null ? Math.max(0, (u.slideT ?? 0) - dt * 0.5) : (u.slideT ?? 0) + dt;
          if (u.slideT > Math.max(8, 80 / st.speed)) {
            u.slideT = 0;
            if (!u.rerouted) {
              u.rerouted = true;
              this.route(u);
            } else u.moving = false;
          }
          const diff = angDiff(face, u.a);
          const stepA = st.turn * dt;
          u.a = Math.abs(diff) <= stepA ? face : u.a + Math.sign(diff) * stepA;
          if (slideA !== null) {
            ang = slideA;
            sp = Math.min(dist, st.speed * dt * (free ? 1 : 0.8));
          } else if (u.moving) {
            const go = free ? 1 : Math.max(0, Math.cos(angDiff(want, u.a)) - 0.4) / 0.6;
            ang = free ? want : u.a;
            // (a tank still turning towards dry land waits to get there)
            sp = !isAir(u.kind) && !this.okAt(u, u.x + Math.cos(ang) * 5, u.y + Math.sin(ang) * 5) && this.okAt(u, u.x, u.y) ? 0 : Math.min(dist, st.speed * 1.1 * dt * go);
          }
          // give up if it has got hardly any closer in the last few seconds
          // (it has hit a dead end)
          if ((u.stuck = (u.stuck ?? 0) + dt) > 4) {
            if ((u.best ?? 1e9) - dist < 4) {
              // off its way round somehow: look for the way again, once
              if (u.path && !u.rerouted) {
                u.rerouted = true;
                this.route(u);
              } else u.moving = false;
            }
            u.best = dist;
            u.stuck = 0;
          }
          // never step from dry land into the water (or a boat onto land)
          const nx = u.x + Math.cos(ang) * sp;
          const ny = u.y + Math.sin(ang) * sp;
          // (somewhere it shouldn't be, it can drive out, but not on into a building)
          // (a ship too near the shore can sail out, but never onto it)
          if (isAir(u.kind) || this.okAt(u, nx, ny) || (!this.okAt(u, u.x, u.y) && (!this.inBuilding(u, nx, ny) || this.inBuilding(u, u.x, u.y)) && (!isNaval(u.kind) || this.terrain.k(nx, ny) === K.Water))) {
            u.x = nx;
            u.y = ny;
          } else if (sp > 0) {
            // clipping a corner of rock or shore: slip along it instead
            for (const [ex, ey] of [
              [nx, u.y],
              [u.x, ny],
              [u.x + Math.cos(ang + 0.6) * sp, u.y + Math.sin(ang + 0.6) * sp],
              [u.x + Math.cos(ang - 0.6) * sp, u.y + Math.sin(ang - 0.6) * sp],
            ])
              if (this.okAt(u, ex, ey)) {
                u.x = ex;
                u.y = ey;
                break;
              }
          }
          u.trackAcc += sp;
          if (u.trackAcc > 1.5) {
            u.trackAcc = 0;
            const k = this.terrain.k(u.x, u.y);
            const [sx, sy] = toScreen(u.x, u.y, u.z);
            if (isNaval(u.kind) || (u.kind === 'otter' && k === K.Water)) {
              const back = UNIT[u.kind].r * 0.85;
              const [bx, by] = toScreen(u.x - Math.cos(u.a) * back, u.y - Math.sin(u.a) * back, 0);
              this.particles.push({ x: bx, y: by, vx: 0, vy: 0, life: 0, max: 1.6, kind: 'wake', size: 1 });
            } else if (!foot && !isAir(u.kind) && k !== K.Water && u.z === 0) {
              const hw = u.kind === 'mcv' ? 7.5 : u.kind === 'heavy' || u.kind === 'scorch' || u.kind === 'lumen' ? 6 : u.kind === 'buggy' ? 4 : 5;
              const px = -Math.sin(u.a) * hw;
              const py = Math.cos(u.a) * hw;
              const style = k === K.Road || k === K.Sand ? 'rgba(60,45,25,0.2)' : k === K.Pad ? 'rgba(30,30,30,0.08)' : 'rgba(25,22,12,0.16)';
              const [ax, ay] = toScreen(u.x + px, u.y + py);
              const [bx, by] = toScreen(u.x - px, u.y - py);
              this.stamp(ax, ay, style);
              this.stamp(bx, by, style);
              if ((k === K.Road || k === K.Sand) && Math.random() < 0.4) {
                const [rx, ry] = toScreen(u.x - Math.cos(u.a) * 8, u.y - Math.sin(u.a) * 8, 1);
                this.particles.push({ x: rx, y: ry, vx: (Math.random() - 0.5) * 5, vy: -4, life: 0, max: 0.9, kind: 'dust', size: 1 });
              }
            }
            void sx;
            void sy;
          }
        }
      }
      // wrap around the world, both ways
      const [usx, usy] = toScreen(u.x, u.y);
      const kx = Math.floor(usx / this.w);
      const ky = Math.floor(usy / this.h);
      if (kx || ky) {
        [u.x, u.y] = this.lapped(u.x, u.y, -kx, -ky);
        [u.tx, u.ty] = this.lapped(u.tx, u.ty, -kx, -ky);
        u.lap += kx;
        u.lapY += ky;
      }
      // knocked back by a hit: a quick shove that eases off (never into the water)
      if (u.knock) {
        const k = Math.min(1, KNOCK_EASE * dt);
        const dx = u.knock[0] * k;
        const dy = u.knock[1] * k;
        if (isAir(u.kind) || this.okAt(u, u.x + dx * 3, u.y + dy * 3)) {
          u.x += dx;
          u.y += dy;
          if (!u.moving) {
            u.tx = u.x;
            u.ty = u.y;
          }
        }
        u.knock[0] -= dx;
        u.knock[1] -= dy;
        if (Math.hypot(u.knock[0], u.knock[1]) < 0.05) u.knock = undefined;
      }
      // smoothly follow the ground height
      const gz = this.groundZ(u);
      u.z += (gz - u.z) * Math.min(1, dt * 8);
      if (Math.abs(gz - u.z) < 0.05) u.z = gz;

      if (TURRETED.has(u.kind)) {
        if (u.target) {
          // (fight() aims it)
        } else if (u.moving) u.turretGoal = u.a;
        else {
          u.idle -= dt;
          if (u.idle <= 0) {
            u.idle = 2 + Math.random() * 5;
            u.turretGoal = u.a + (Math.random() - 0.5) * 2.4;
          }
        }
        const d = angDiff(u.turretGoal, u.turret);
        u.turret += Math.sign(d) * Math.min(Math.abs(d), (u.target ? 3.2 : 2.2) * dt);
      }
      // damaged vehicles smoke, more the worse they are
      if (u.hp < 0.66 && !foot) {
        const [sx, sy] = toScreen(u.x, u.y, u.z + this.alt(u) + MID[u.kind] + 2);
        this.fx.damageSmoke(u.hp, sx, sy, dt);
      }
      if (u.moving || u.deploy || u.job || u.target) {
        u.home = u.pace = u.look = u.face = undefined;
      } else if (foot && !u.dug && !u.digK) this.paceAbout(u, dt);
      else if (u.kind === 'arty') {
        // edge round a little now and then, as if the crew were looking about
        if (u.look === undefined) {
          u.idle -= dt;
          if (u.idle <= 0) {
            u.idle = 3 + Math.random() * 6;
            u.face ??= u.a;
            u.look = u.face + (angDiff(u.a, u.face) > 0 ? -1 : 1) * (0.25 + Math.random() * 0.35);
          }
        } else {
          const d = angDiff(u.look, u.a);
          const stepA = st.turn * 0.35 * dt;
          if (Math.abs(d) <= stepA) {
            u.a = u.look;
            u.look = undefined;
          } else u.a += Math.sign(d) * stepA;
        }
      }
    }

    // doors open while a unit is coming out of them, and close behind it
    const exiting = new Set<Building>();
    for (const u of this.units) if (u.exit) exiting.add(u.exit.b);
    for (const b of this.buildings) if (b.door || exiting.has(b)) b.door = exiting.has(b) ? Math.min(1, (b.door ?? 0) + dt / DOOR_S) : Math.max(0, (b.door ?? 0) - dt / (DOOR_S * 1.5));
    for (const b of [...this.buildings]) {
      b.phase += dt;
      // a tech oil derrick pays whoever holds it, a little every moment
      if (b.kind === 'derrick' && b.f >= 0 && !b.dead && this.net !== 'client') {
        this.eco[b.f].credits += DERRICK.rate * dt;
      }
      // a Commando's charge goes off
      if (b.c4 !== undefined && this.time >= b.c4 && this.net !== 'client') {
        this.damage(b, 1e9);
        continue;
      }
      if (b.packing) {
        b.rise = Math.max(0, b.rise - dt / PACK_S);
        if (Math.random() < dt * 12) this.puff(b, 1);
        if (b.rise === 0 && this.net !== 'client') {
          if (b.sold) this.sellNow(b);
          else this.packNow(b);
        }
        continue;
      }
      if (b.rise < 1) {
        b.rise = Math.min(1, b.rise + dt / riseTime(b.kind, b.art.rx, b.art.ry));
        if (Math.random() < dt * 14) this.puff(b, 1);
        if (b.rise === 1) {
          this.mapVersion++;
          if (b.kind === 'refinery' && !b.gift && this.net !== 'client') {
            // a refinery comes with a hauler, which gets straight to work
            b.gift = true;
            const [fx, fy] = this.fold(b.x + DOCK[0], b.y + DOCK[1] + 6);
            const u = this.newUnit('hauler', b.f, fx, fy, Math.PI / 2);
            u.job = { st: 'seek', t: 0 };
            u.load = 0;
          }
        }
        continue;
      }
      if (b.kind === 'yard') {
        // a welding spark under the crane hook now and then
        if (Math.random() < dt * 1.5) {
          const p = b.art.fx[1];
          const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z - 1);
          for (let i = 0; i < 3; i++) this.sparks.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 15, life: 0 });
        }
      }
      if ((b.kind === 'depot' || b.kind === 'navy') && b.rise >= 1 && b.hp > 0) this.serviceAt(b, dt);
      const emit = (i: number, kind: 'smoke' | 'soot', rate: number) => {
        if (!b.art.fx[i] || Math.random() > dt * rate) return;
        const p = b.art.fx[i];
        const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z);
        this.particles.push({ x: sx + (Math.random() - 0.5) * 6, y: sy, vx: 3 + Math.random() * 3, vy: -7 - Math.random() * 4, life: 0, max: 2.6 + Math.random(), kind, size: 1.5 });
      };
      if (b.kind === 'power') {
        emit(0, 'smoke', 3);
        emit(1, 'smoke', 3);
      }
      // (more while a hauler is tipping ore into it)
      if (b.kind === 'refinery') emit(0, 'soot', this.time - (b.busyT ?? -9) < 0.3 ? 5 : 2);
      if (b.kind === 'factory') {
        emit(0, 'smoke', 0.8);
        emit(1, 'smoke', 0.8);
      }
      if (isDefense(b.kind) && b.rise >= 1) {
        this.towerFight(b, dt);
        if (!b.target && Math.random() < dt * 0.3) b.gunGoal = Math.random() * Math.PI * 2;
        const d = angDiff(b.gunGoal, b.gun);
        b.gun += Math.sign(d) * Math.min(Math.abs(d), (b.target ? 2.6 : 1.4) * dt);
      }
      // a badly damaged building burns and smokes
      if (b.hp <= DAMAGED)
        for (const p of this.states(b.kind, b.f).damaged.fx)
          if (Math.random() < dt * 2.5) {
            const [sx, sy] = toScreen(b.x + p.x, b.y + p.y, p.z + 3);
            this.fx.smoke(sx, sy, true, 1.5);
          }
    }
    this.updateRuins(dt);
    this.updateFires(dt);
    // a bridge badly hit smokes, and one just fallen smokes where it was
    for (const b of this.bridges) {
      if (b.c4 !== undefined && (b.dead || (this.time >= b.c4 && this.net !== 'client'))) {
        if (!b.dead) this.damage(b, 1e9);
        b.c4 = undefined;
      }
      const fell = b.dead && b.fellT !== undefined && this.time - b.fellT < 14;
      if (!fell && (b.dead || b.hp >= 0.5)) continue;
      const ex = b.axis === 0 ? 1 : 0;
      for (const t of [-0.22, 0.2]) {
        const [sx, sy] = toScreen(b.x + ex * t * b.L, b.y + (1 - ex) * t * b.L, BRIDGE_Z[b.style] + 1);
        this.fx.damageSmoke(fell ? 0.05 : b.hp, sx, sy, dt);
      }
    }
    this.fx.step(dt);
    this.loopSounds();

    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'soot') p.size += dt * 1.8;
      else if (p.kind === 'spray') p.vy += 70 * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const s of this.sparks) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 60 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life < (s.max ?? 0.5));
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter((m) => m.t < BURST_FRAME * burstFrames(markKind(m)).length);
    for (const q of this.quakes) q.t += dt;
    this.quakes = this.quakes.filter((q) => q.t < QUAKE_S);

    // water sparkles, where you are looking
    const v = this.view;
    const want = Math.floor(((v.x1 - v.x0) * (v.y1 - v.y0)) / 2500);
    for (let i = 0; i < 4 && this.sparkles.length < want; i++) {
      const x = ((Math.floor(v.x0 + Math.random() * (v.x1 - v.x0)) % this.w) + this.w) % this.w;
      const y = ((Math.floor(v.y0 + Math.random() * (v.y1 - v.y0)) % this.h) + this.h) % this.h;
      const [wx, wy] = toWorld(x, y, 0);
      if (this.terrain.k(wx, wy) === K.Water && this.terrain.k(wx - 3, wy - 3) === K.Water && !this.terrain.isHigh(wx, wy)) this.sparkles.push({ x, y, life: 0 });
    }
    for (const s of this.sparkles) s.life += dt;
    this.sparkles = this.sparkles.filter((s) => s.life < 1.2);
    this.lookAround();
    if (this.net === 'host') this.checkOut();
  }

  // ---------- Multiplayer ----------
  // The host's screen runs the game for everyone: it carries out every
  // player's orders (exec) and sends everyone how things stand several times
  // a second (snapshot). A player's screen runs the same game too, so that
  // units move smoothly and guns fire between updates, but only the host
  // decides what is built, who is hit and what is destroyed: each update
  // puts the player's world right (applySnapshot). Orders a player gives
  // their units take effect on their own screen straight away as well.

  // An order of yours: carried out here, and on a player's screen sent to the host too.
  private command(cmd: Command): void {
    if (this.net !== 'client') return this.exec(this.me, cmd);
    this.onCommand(cmd);
    // moving and attacking show at once; the rest waits for the host
    if (cmd.c === 'move' || cmd.c === 'attack') {
      this.exec(this.me, cmd);
      const ids = new Set(cmd.c === 'move' ? [...cmd.m.map((m) => m[0]), ...(cmd.dig ?? [])] : cmd.u);
      for (const u of this.units) if (ids.has(u.id)) this.predicted.set(u.id, this.time);
    }
  }
  // Units of yours you just gave an order on a player's screen: the host's
  // word on where they are going waits until it has had the order.
  private predicted = new Map<number, number>();

  /** Carry out an order from side f's player (ignoring what isn't theirs). */
  exec(f: number, cmd: Command): void {
    const unit = (id: number) => this.units.find((u) => u.id === id && u.f === f && !u.dead);
    const bldg = (id: number) => this.buildings.find((b) => b.id === id && b.f === f && !b.dead);
    switch (cmd.c) {
      case 'move': {
        const dig = new Set(cmd.dig ?? []);
        const node = cmd.n !== undefined && cmd.n >= 0 ? this.ore[cmd.n] : undefined;
        for (const id of dig) {
          const u = unit(id);
          if (!u || u.kind !== 'hauler' || !node) continue;
          u.job = { st: 'seek', node, t: 0 };
          u.load ??= 0;
        }
        for (const [id, tx, ty] of cmd.m) {
          const u = unit(id);
          if (!u || u.deploy) continue;
          if (u.kind === 'hauler' && !dig.has(id)) u.job = undefined;
          u.board = u.fix = undefined;
          u.unloading = false;
          // a dug-in G.I. climbs out of its sandbags, then goes
          u.dug = false;
          u.tx = tx;
          u.ty = ty;
          u.dest = [tx, ty];
          u.moving = true;
          // a move order calls off any fight
          u.target = undefined;
          u.forced = u.chase = false;
        }
        break;
      }
      case 'attack': {
        const t: Target | undefined = this.units.find((o) => o.id === cmd.t) ?? this.buildings.find((o) => o.id === cmd.t) ?? this.bridges.find((o) => o.id === cmd.t);
        if (!t || t.f === f || t.dead) break;
        this.attack(cmd.u.map(unit).filter((u): u is Unit => !!u && !u.deploy), t);
        break;
      }
      case 'entrench':
        for (const id of cmd.u) {
          const u = unit(id);
          if (!u || u.kind !== 'inf') continue;
          u.dug = cmd.on;
          if (cmd.on) {
            // it stops where it is (and keeps up any fight in reach)
            u.moving = false;
            u.tx = u.x;
            u.ty = u.y;
            u.path = undefined;
            u.dest = undefined;
            u.home = u.pace = undefined;
            u.chase = false;
          }
        }
        break;
      case 'deploy':
        for (const id of cmd.u) {
          const u = unit(id);
          if (u && u.kind === 'mcv' && !u.deploy && this.deployable(u)) this.startDeploy(u);
        }
        break;
      case 'board': {
        const t = unit(cmd.t);
        if (!t || !TRANSPORT.has(t.kind)) break;
        for (const id of cmd.u) {
          const u = unit(id);
          if (!u || u === t || !canRide(u, t)) continue;
          u.board = t.id;
          u.boardTry = 0;
          u.dug = false;
          u.target = undefined;
          u.forced = u.chase = false;
          u.dest = u.aim = undefined;
          [u.tx, u.ty] = this.nearPoint(u.x, u.y, t.x, t.y);
          u.moving = true;
        }
        break;
      }
      case 'land': {
        const c = unit(cmd.t);
        if (!c || c.kind !== 'carrier') break;
        const free = this.freeSlots(c);
        // the nearest jets first, until the deck is full
        const jets = cmd.u
          .map(unit)
          .filter((u): u is Unit => !!u && u.kind === 'jet' && u.deck !== c.id && !u.exit)
          .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        for (const u of jets) {
          const i = free.shift();
          if (i === undefined) break;
          u.taxi = u.taxiA = undefined;
          this.toDeck(u, c, i);
        }
        break;
      }
      case 'fix': {
        const t = this.bridges.find((o) => o.id === cmd.t) ?? bldg(cmd.t) ?? this.buildings.find((o) => o.id === cmd.t && this.capturable(o, f));
        if (!t || (!isBridge(t) && (t.rise < 1 || t.packing))) break;
        for (const id of cmd.u) {
          const u = unit(id);
          if (!u || u.kind !== 'eng') continue;
          u.fix = t.id;
          u.fixTry = 0;
          u.board = undefined;
          u.target = undefined;
          u.forced = u.chase = false;
          u.dest = u.aim = undefined;
          u.home = u.pace = undefined;
          [u.tx, u.ty] = this.fixPoint(u, t);
          u.moving = true;
        }
        break;
      }
      case 'dock': {
        const ref = bldg(cmd.b);
        if (!ref || ref.kind !== 'refinery' || ref.rise < 1 || ref.packing) break;
        for (const id of cmd.u) {
          const u = unit(id);
          if (!u || u.kind !== 'hauler') continue;
          // it pulls up in front of the pad, then backs on and unloads
          // (and after that, goes back to the ore it was on)
          u.job = { st: 'ret', ref, node: u.job?.node, t: 0 };
          u.load ??= 0;
          [u.tx, u.ty] = this.nearPoint(u.x, u.y, ref.x + DOCK[0] + Math.cos(DOCK_A) * DOCK_RUN, ref.y + DOCK[1] + Math.sin(DOCK_A) * DOCK_RUN);
          u.dest = undefined;
          u.moving = true;
        }
        break;
      }
      case 'unload':
        for (const id of cmd.u) {
          const u = unit(id);
          if (!u?.cargo?.length || u.unloading) continue;
          // a Heron has to come down on dry land to let them out
          if (u.kind === 'heron' && !this.okAt(u.cargo[0], u.x, u.y)) {
            this.tell(u.f, 'The Heron can only land on open ground');
            continue;
          }
          if (u.kind === 'otter' && this.terrain.k(u.x, u.y) === K.Water) {
            this.tell(u.f, 'The Otter has to come ashore to let them out');
            continue;
          }
          u.unloading = true;
          u.exitT = 0;
          u.exitN = -1;
          // it stops to let them out
          u.moving = false;
          u.tx = u.x;
          u.ty = u.y;
          u.dest = undefined;
        }
        break;
      case 'pack': {
        const b = bldg(cmd.b);
        if (b && b.kind === 'yard' && b.rise >= 1 && !b.packing) {
          b.packing = true;
          this.sound(b.x, b.y, 'build_rise', 1, { reverse: true, rate: 1.3 });
          this.sound(b.x, b.y, 'foundry_unfold', 0.8, { delay: 1, reverse: true });
        }
        break;
      }
      case 'mend': {
        const b = bldg(cmd.b);
        if (b && b.rise >= 1 && !b.packing) b.fixing = !b.fixing && b.hp < 1;
        break;
      }
      case 'sell': {
        const b = bldg(cmd.b);
        // (a tech building can't be sold, only lost)
        if (!b || b.rise < 1 || b.packing || b.kind === 'derrick') break;
        // its credits back (some of them), and it goes down as it went up
        this.eco[f].credits += Math.round(this.priceOf(b.kind) * SELL_BACK * b.hp);
        b.packing = b.sold = true;
        b.fixing = false;
        this.sound(b.x, b.y, 'build_rise', 1, { reverse: true, rate: 1.3 });
        this.sound(b.x, b.y, 'credits_tick', 0.8);
        this.tell(f, `${BNAME[b.kind]} sold`);
        break;
      }
      case 'primary': {
        const b = bldg(cmd.b);
        if (b) for (const o of this.buildings) if (o.f === f && o.kind === b.kind) o.primary = o === b;
        break;
      }
      case 'rally': {
        const b = bldg(cmd.b);
        if (b) b.rally = cmd.x === undefined || cmd.y === undefined ? undefined : [cmd.x, cmd.y];
        if (b && b.rally && f === this.me) this.markers.push({ x: b.rally[0], y: b.rally[1], z: this.terrain.elev(...b.rally), t: 0 });
        break;
      }
      case 'build':
        this.startJob(f, cmd.t);
        break;
      case 'cancel':
        this.cancelJob(f, cmd.t);
        break;
      case 'place':
        this.placeBuilding(f, cmd.t, cmd.x, cmd.y);
        break;
      case 'para':
        this.callPara(f, cmd.x, cmd.y);
        break;
    }
  }

  // Sides out of the game: every player that has nothing left. You are told
  // if it is you, or if you are the last one standing.
  private outT = 0;
  private checkOut(): void {
    if (!this.players || this.time - this.outT < 1) return;
    this.outT = this.time;
    const alive = new Set<number>();
    for (const u of this.units) if (!u.dead) alive.add(u.f);
    for (const b of this.buildings) if (!b.dead && b.kind !== 'derrick') alive.add(b.f);
    for (const p of this.players) if (!alive.has(p.f) && !this.out.has(p.f)) this.setOut([...this.out, p.f]);
  }
  private setOut(out: number[]): void {
    const was = this.out.size;
    this.out = new Set(out);
    if (this.out.size === was || !this.players) return;
    const left = this.players.filter((p) => !this.out.has(p.f));
    for (const p of this.players) if (this.out.has(p.f) && p.f !== this.me) this.notice(`${p.name} is out`);
    if (this.out.has(this.me)) this.onOutcome(false);
    else if (left.length === 1 && this.players.length > 1) this.onOutcome(true);
  }

  /** The host's word on how things stand, for everyone else's screens. */
  snapshot(): Snapshot {
    const tid = (t?: Target) => (t && !t.dead ? t.id : 0);
    const u = this.units.map((o) => [
      o.id,
      o.kind,
      o.f,
      r1(o.x),
      r1(o.y),
      r2(o.a),
      r2(o.turret),
      Math.round(o.hp * 1000) / 1000,
      (o.moving ? 1 : 0) | (o.deploy ? 2 : 0) | (o.forced ? 4 : 0) | (o.chase ? 8 : 0) | (o.dug ? 16 : 0) | (o.exit ? 32 : 0),
      r1(o.tx),
      r1(o.ty),
      tid(o.target),
      Math.round(o.load ?? 0),
      o.job ? JOB_STATES.indexOf(o.job.st) : -1,
      (o.cargo ?? []).map((p) => `${p.id}:${p.kind}:${Math.round(p.hp * 1000) / 1000}`).join(','),
      o.unloading ? 1 : 0,
      o.fly === undefined ? -1 : Math.round(o.fly * 100) + (o.ammo ?? 0) * 1000,
      o.deck === undefined ? 0 : o.deck * 100 + (o.padI ?? 0) + CARRIER_JETS * DECK_OPS.indexOf(o.dop),
    ]);
    const b = this.buildings.map((o) => [
      o.id,
      o.kind,
      o.f,
      o.x,
      o.y,
      Math.round(o.hp * 1000) / 1000,
      r2(o.rise),
      (o.packing ? 1 : 0) | (o.primary ? 2 : 0) | (o.gift ? 4 : 0) | (o.c4 !== undefined ? 8 : 0) | (o.fixing ? 16 : 0),
      o.pad.x,
      o.pad.y,
      o.pad.w,
      o.pad.h,
      o.rally ? r1(o.rally[0]) : 0,
      o.rally ? r1(o.rally[1]) : 0,
      tid(o.target),
    ]);
    const eco: Snapshot['eco'] = this.sides().map((f) => {
      const e = this.eco[f];
      return [
        f,
        Math.round(e.credits),
        e.lowPower ? 1 : 0,
        [...e.jobs].map(([tab, j]): [string, string, number, number, number] => [tab, j.tech.id, Math.round(j.spent), j.paused ? 1 : 0, j.ready ? 1 : 0]),
        [...e.queue].map(([tab, q]): [string, string[]] => [tab, q.map((t) => t.id)]),
        Math.ceil(e.paraT),
      ];
    });
    const snap: Snapshot = { t: r2(this.time), u, b, gone: this.gone, eco, told: this.told, out: [...this.out], br: this.bridges.map((o) => Math.round(o.hp * 1000) / 1000) };
    // the ore, about once a second (it changes slowly)
    if (this.time - this.oreSentT > 1 || !this.oreSentT) {
      this.oreSentT = this.time || 1e-6;
      snap.ore = this.ore.flatMap((n) => [r1(n.x), r1(n.y), Math.round(n.amt), n.v]);
    }
    this.gone = [];
    this.told = [];
    return snap;
  }
  private oreSentT = 0;

  /** A player's screen: put the world right by the host's latest word. */
  applySnapshot(s: Snapshot): void {
    const units = new Map(this.units.map((u) => [u.id, u]));
    const bldgs = new Map(this.buildings.map((b) => [b.id, b]));
    // what has gone: blown up, razed, or quietly
    for (const [id, how] of s.gone) {
      const u = units.get(id);
      if (u) {
        units.delete(id);
        if (how === GONE_KILL) this.kill(u);
        else {
          this.units.splice(this.units.indexOf(u), 1);
          u.dead = true;
          if (u.sel) {
            u.sel = false;
            this.emit();
          }
        }
        continue;
      }
      const b = bldgs.get(id);
      if (!b) continue;
      bldgs.delete(id);
      if (how === GONE_RAZE) this.raze(b);
      else {
        b.dead = true;
        this.buildings.splice(this.buildings.indexOf(b), 1);
        this.setPad(b.pad, false);
        if (how === GONE_PACK) this.puff(b, 8);
      }
    }
    this.gone = [];
    // the bridges: broken, mended, or hit
    s.br?.forEach((hp, i) => {
      const br = this.bridges[i];
      if (!br) return;
      if (hp <= 0) this.breakBridge(br, this.time < 1);
      else {
        if (br.dead) this.mendBridge(br);
        br.hp = hp;
      }
    });
    const bridge = (id: number) => (id >= BRIDGE_ID ? this.bridges[id - BRIDGE_ID] : undefined);
    const target = (id: number): Target | undefined => (id ? units.get(id) ?? bldgs.get(id) ?? bridge(id) : undefined);
    // buildings first (units can be aiming at them)
    const seenB = new Set<number>();
    for (const e of s.b) {
      const [id, kind, f, x, y, hp, rise, flags, px, py, pw, ph, rx, ry] = e as [number, BuildingKind, number, number, number, number, number, number, number, number, number, number, number, number, number];
      seenB.add(id);
      let b = bldgs.get(id);
      if (!b) {
        const pad = { x: px, y: py, w: pw, h: ph };
        b = { id, kind, f, x, y, art: this.buildingArt(kind, f), phase: 0, gun: 0, gunGoal: 0, pad, sel: false, rise, hp };
        this.buildings.push(b);
        bldgs.set(id, b);
        this.setPad(pad, true);
        if (rise < 1) {
          this.clearSite(pad, null);
          this.puff(b, 12);
          this.sound(b.x, b.y, 'build_rise', 1, { rate: 1.1 });
        }
        if (f === this.me) this.emit();
      }
      if (b.f !== f) {
        // a tech building taken: it turns its new owner's color
        b.f = f;
        this.recolor(b);
        if (b.sel && f !== this.me) b.sel = false;
        this.mapVersion++;
      }
      b.hp = hp;
      // (rising and packing go on here between updates)
      if (Math.abs(b.rise - rise) > 0.15 || rise >= 1 || rise <= 0) b.rise = rise;
      b.packing = !!(flags & 1);
      b.primary = !!(flags & 2);
      b.gift = !!(flags & 4);
      b.c4 = flags & 8 ? (b.c4 ?? this.time + C4_S) : undefined;
      b.fixing = !!(flags & 16);
      b.rally = rx || ry ? [rx, ry] : undefined;
    }
    for (const b of [...this.buildings])
      if (!seenB.has(b.id)) {
        this.buildings.splice(this.buildings.indexOf(b), 1);
        this.setPad(b.pad, false);
        bldgs.delete(b.id);
      }
    const seenU = new Set<number>();
    for (const e of s.u) {
      const [id, kind, f, x, y, a, turret, hp, flags, tx, ty, tgt, load, job, riders, unloading, air, deck] = e as [number, Kind, number, number, number, number, number, number, number, number, number, number, number, number, string?, number?, number?, number?];
      seenU.add(id);
      let u = units.get(id);
      if (!u) {
        u = this.newUnit(kind, f, x, y, a);
        u.id = id;
        u.turret = turret;
        units.set(id, u);
        if (f === this.me) this.mapVersion++;
      }
      // the host's copy may be a lap round the world from ours: follow it round
      const [lsx, lsy] = toScreen(u.x, u.y);
      const [hsx, hsy] = toScreen(x, y);
      const kx = Math.round((lsx - hsx) / this.w);
      const ky = Math.round((lsy - hsy) / this.h);
      if (kx || ky) {
        [u.x, u.y] = this.lapped(u.x, u.y, -kx, -ky);
        [u.tx, u.ty] = this.lapped(u.tx, u.ty, -kx, -ky);
        u.lap += kx;
        u.lapY += ky;
      }
      // close enough: drift over the next few frames to where the host has
      // it (see update); far off (or the host's own world): jump
      const d = Math.hypot(x - u.x, y - u.y);
      if (d > 24 || this.net !== 'client') {
        u.x = x;
        u.y = y;
        u.netErr = undefined;
      } else u.netErr = [x - u.x, y - u.y];
      u.netA = a;
      u.hp = hp;
      u.load = load;
      const fresh = this.time - (this.predicted.get(id) ?? -1e9) < 0.5;
      if (!fresh) {
        // (a soldier standing about turns to it in paceAbout)
        const idleFoot = isFoot(kind) && !(flags & 1) && !(flags & 16) && !tgt;
        if (Math.abs(angDiff(a, u.a)) > 0.4 && !idleFoot) u.a = a;
        u.moving = !!(flags & 1);
        u.tx = tx;
        u.ty = ty;
        u.forced = !!(flags & 4);
        u.chase = !!(flags & 8);
        u.target = target(tgt);
      }
      u.deploy = !!(flags & 2);
      if (air !== undefined && (isAir(kind) || isFoot(kind))) {
        u.fly = air < 0 ? undefined : (air % 1000) / 100;
        u.ammo = air < 0 ? undefined : Math.floor(air / 1000);
      }
      // a jet's carrier, and its spot on the deck
      if (kind === 'jet' && deck !== undefined) {
        u.deck = deck ? Math.floor(deck / 100) : undefined;
        if (deck) {
          u.padI = (deck % 100) % CARRIER_JETS;
          u.dop = DECK_OPS[Math.floor((deck % 100) / CARRIER_JETS)];
        } else u.dop = undefined;
      }
      // who is riding in it
      if (riders || u.cargo?.length) {
        const had = new Map((u.cargo ?? []).map((p) => [p.id, p]));
        u.cargo = (riders ? riders.split(',') : []).map((r) => {
          const [pid, pk, php] = r.split(':');
          const p = had.get(Number(pid)) ?? this.rider(pk as Kind, u.f, Number(pid));
          p.hp = Number(php);
          return p;
        });
      }
      u.unloading = !!unloading;
      u.dug = !!(flags & 16);
      // coming out of a door: of the nearest building of its side that makes it
      if (!(flags & 32)) u.exit = undefined;
      else if (!u.exit) {
        let best: Building | null = null;
        let bd = 60;
        for (const b of this.buildings) {
          if (b.f !== f || !doorOf(b.kind) || (b.kind === 'barracks') !== isFoot(kind) || (b.kind === 'radar') !== isAir(kind)) continue;
          const [nx, ny] = this.nearPoint(u.x, u.y, b.x, b.y);
          const dd = Math.hypot(nx - u.x, ny - u.y);
          if (dd < bd) [best, bd] = [b, dd];
        }
        const d = best && doorOf(best.kind);
        if (best && d) {
          const [bx, by] = this.nearPoint(u.x, u.y, best.x, best.y);
          u.exit = { b: best, x: bx + d.x, y: by + d.y, d, k: bx + by + Math.min(best.art.rx, best.art.ry) + 0.01, t: 0, go: true };
        }
      }
      if (job >= 0) {
        const st = JOB_STATES[job];
        if (u.job) u.job.st = st;
        else u.job = { st, t: 0 };
      } else u.job = undefined;
    }
    for (const u of [...this.units])
      if (!seenU.has(u.id)) {
        this.units.splice(this.units.indexOf(u), 1);
        u.dead = true;
      }
    for (const [id, t] of this.predicted) if (this.time - t > 1) this.predicted.delete(id);
    // gun towers aim where the host's do
    for (const e of s.b) {
      const b = bldgs.get(e[0] as number);
      if (b && isDefense(b.kind)) b.target = target(e[14] as number);
    }
    // your purse
    const mine = s.eco.find((e) => e[0] === this.me);
    if (mine) {
      const [, credits, low, jobs, queue, paraT] = mine;
      const e = this.eco[this.me];
      e.credits = credits;
      e.lowPower = !!low;
      if (paraT !== undefined) e.paraT = paraT;
      const tech = (id: string) => TECH.find((t) => t.id === id);
      const nj = new Map<Tab, Job>();
      for (const [tab, id, spent, paused, ready] of jobs) {
        const t = tech(id);
        if (t) nj.set(tab as Tab, { tech: t, spent, paused: !!paused, ready: !!ready });
      }
      e.jobs = nj;
      e.queue = new Map(queue.map(([tab, ids]) => [tab as Tab, ids.map(tech).filter((t): t is Tech => !!t)]));
      if (this.ghost && !nj.get(this.ghost.tech.tab)?.ready) this.ghost = null;
    }
    // the ore, as the host has it
    if (s.ore) {
      const o = s.ore;
      const n = o.length / 4;
      if (n === this.ore.length) for (let i = 0; i < n; i++) this.ore[i].amt = o[i * 4 + 2];
      else {
        this.ore = [];
        this.oreGrid = new Map();
        for (let i = 0; i < n; i++) this.addOre({ x: o[i * 4], y: o[i * 4 + 1], amt: o[i * 4 + 2], v: o[i * 4 + 3] });
      }
    }
    for (const [f, msg, line] of s.told) if (f === this.me) this.tell(f, msg || undefined, (line || undefined) as Parameters<typeof announce>[0] | undefined);
    this.setOut(s.out);
  }

  // ---------- For bots (src/v2/bot.ts) ----------
  // What a computer player sees and can ask; it acts only through exec(), like a player.

  /** Kinds of building side f has standing. */
  standing(f: number): Set<BuildingKind> {
    return this.have(f);
  }
  /** Can this Foundry vehicle deploy where it is? */
  canDeploy(id: number): boolean {
    const u = this.units.find((o) => o.id === id);
    return !!u && !u.deploy && this.deployable(u);
  }
  /** The copy of world point (x, y) nearest (ax, ay) (the world wraps round). */
  nearest(ax: number, ay: number, x: number, y: number): [number, number] {
    return this.nearPoint(ax, ay, x, y);
  }
  /** Somewhere side f's finished building `techId` can go, near (cx, cy) and its base, or null. */
  findSite(f: number, techId: string, cx: number, cy: number, rand: () => number = Math.random): [number, number] | null {
    const t = TECH.find((q) => q.id === techId);
    if (!t?.building) return null;
    const art = this.buildingArt(t.building, f);
    const a0 = rand() * Math.PI * 2;
    for (let r = 50; r <= 260; r += 14)
      for (let i = 0; i < 14; i++) {
        const a = a0 + (i / 14) * Math.PI * 2;
        const [x, y] = this.fold(Math.round((cx + Math.cos(a) * r) / 4) * 4, Math.round((cy + Math.sin(a) * r) / 4) * 4);
        if (!this.placeWhy(padOf(t.building, art, x, y), f, t.building === 'navy')) return [x, y];
      }
    return null;
  }

  /** The host back after a reload: the game as it last saved it, in a world just made. */
  restore(s: Snapshot): void {
    const me = this.me;
    this.applySnapshot({ ...s, gone: [], told: [] });
    // every side's purse, not just yours
    for (const row of s.eco) {
      this.me = row[0];
      this.applySnapshot({ t: s.t, u: s.u, b: s.b, gone: [], eco: [row], told: [], out: s.out });
    }
    this.me = me;
    this.gone = [];
    let top = 0;
    for (const o of [...this.units, ...this.units.flatMap((u) => u.cargo ?? []), ...this.buildings]) top = Math.max(top, o.id);
    this.nextId = top + 1;
    // haulers start their round again (where they were going isn't saved)
    for (const u of this.units)
      if (u.job) {
        u.job = { st: u.job.st === 'ret' || u.job.st === 'unload' || u.job.st === 'home' || u.job.st === 'dock' ? 'home' : 'seek', t: 0 };
        u.moving = false;
      }
    for (const u of this.units) u.z = this.groundZ(u);
    this.mapVersion++;
    this.emit();
  }

  // ---------- The enemy (Combat stage) ----------

  // Posts round the enemy base where its units wait in small groups, in
  // world coordinates (first copy). The last one is the muster point by its
  // Foundry, where new units gather until there are enough to send out.
  private posts: [number, number][] = [];
  // what each of its unit-making buildings is turning out, and how long to go
  private aiJobs = new Map<Building, { kind: Kind; t: number }>();
  private aiT = 0;

  // Posts at a ring round the enemy base (screen point sx, sy), on open
  // ground clear of buildings, and keeping well back from your base (hx, hy).
  private makePosts(sx: number, sy: number, hx: number, hy: number, rand: () => number): void {
    const T = this.terrain;
    const [nhx, nhy] = nearestCopy(sx, sy, hx, hy, this.w, this.h);
    const apart = Math.hypot(nhx - sx, nhy - sy);
    const a0 = rand() * Math.PI * 2;
    for (let i = 0; i < POSTS; i++) {
      let got: [number, number] | null = null;
      for (let t = 0; t < 120 && !got; t++) {
        const a = a0 + (i / POSTS) * Math.PI * 2 + (rand() - 0.5) * 0.6;
        const r = 300 - t * 1.2;
        const px = sx + Math.cos(a) * r;
        const py = sy + Math.sin(a) * r * 0.5;
        if (Math.hypot(px - nhx, py - nhy) < apart * 0.6) continue;
        const [x, y] = toWorld(px, py, 0);
        const ok = (dx: number, dy: number) => {
          const k = T.k(x + dx, y + dy);
          return (k === K.Grass || k === K.Road) && !T.isHigh(x + dx, y + dy);
        };
        if (!ok(0, 0) || !ok(14, 0) || !ok(-14, 0) || !ok(0, 14) || !ok(0, -14)) continue;
        if (this.buildings.some((b) => inside(x, y, b.pad, 14))) continue;
        got = T.fold(x, y);
      }
      if (got) this.posts.push(got);
    }
    const yard = this.buildings.find((b) => b.f === ENEMY && b.kind === 'yard');
    this.posts.push(yard ? this.fold(yard.x + 10, yard.y + yard.art.ry + 24) : this.fold(...toWorld(sx, sy, 0)));
  }

  // Units that stand guard: not boats (they keep to their lake) or haulers.
  private guard(u: Unit): boolean {
    return u.f === ENEMY && !isNaval(u.kind) && u.kind !== 'hauler' && u.kind !== 'mcv';
  }

  private sendTo(u: Unit, p: [number, number]): void {
    [u.tx, u.ty] = this.nearPoint(u.x, u.y, p[0], p[1]);
    u.moving = true;
    u.target = undefined;
    u.forced = u.chase = false;
    u.anchor = undefined;
  }

  // The enemy never goes looking for a fight: it keeps its army up to
  // strength and its posts manned, and its units fight whatever comes near.
  private enemyAI(dt: number): void {
    if (this.stage !== 'combat' || !this.posts.length) return;
    // replace what has been lost, one at a time at each building
    for (const [b, j] of [...this.aiJobs]) {
      if (b.dead) {
        this.aiJobs.delete(b);
        continue;
      }
      if ((j.t -= dt) > 0) continue;
      this.aiJobs.delete(b);
      this.enemyUnit(b, j.kind);
    }
    const count = new Map<Kind, number>();
    for (const u of this.units) if (u.f === ENEMY) count.set(u.kind, (count.get(u.kind) ?? 0) + 1);
    for (const j of this.aiJobs.values()) count.set(j.kind, (count.get(j.kind) ?? 0) + 1);
    for (const b of this.buildings) {
      if (b.f !== ENEMY || b.dead || b.rise < 1 || !MAKERS.includes(b.kind) || this.aiJobs.has(b)) continue;
      let best: Kind | null = null;
      let short = 0;
      for (const [k, n] of GARRISON) {
        if (MAKER[k] !== b.kind) continue;
        const s = (n - (count.get(k) ?? 0)) / n;
        if (s > short) {
          short = s;
          best = k;
        }
      }
      if (!best) continue;
      const cost = TECH.find((t) => t.unit === best)?.cost ?? 500;
      this.aiJobs.set(b, { kind: best, t: buildTime(cost) * 0.8 });
      count.set(best, (count.get(best) ?? 0) + 1);
    }

    if ((this.aiT -= dt) > 0) return;
    this.aiT = 1;
    const out = this.posts.length - 1; // posts out round the base (the last is the muster point)
    const fill = this.posts.map(() => 0);
    const free: Unit[] = [];
    for (const u of this.units) {
      if (!this.guard(u)) continue;
      if (u.post !== undefined && u.post < out) fill[u.post]++;
      else if (!u.moving && !u.target) free.push(u);
      // one that has wandered off its spot (after a chase) goes back to it
      if (u.spot && !u.moving && !u.target && Math.hypot(u.x - u.spot[0], u.y - u.spot[1]) > 20 && Math.random() < 0.3) this.sendTo(u, this.nearPoint(u.x, u.y, ...u.spot));
    }
    // the post most short of its group gets a group from the muster point,
    // once there are enough there to fill it
    let pi = -1;
    for (let i = 0; i < out; i++) if (fill[i] < SQUAD && (pi < 0 || fill[i] < fill[pi])) pi = i;
    if (pi < 0) return;
    const need = SQUAD - fill[pi];
    if (free.length < need) return;
    const p = this.posts[pi];
    const dist = (u: Unit) => {
      const [x, y] = this.nearPoint(p[0], p[1], u.x, u.y);
      return Math.hypot(x - p[0], y - p[1]);
    };
    free.sort((a, b) => dist(a) - dist(b));
    for (let i = 0; i < need; i++) {
      const u = free[i];
      const a = ((fill[pi] + i) / SQUAD) * Math.PI * 2;
      u.post = pi;
      u.spot = [p[0] + Math.cos(a) * 9, p[1] + Math.sin(a) * 9];
      this.sendTo(u, u.spot);
    }
  }

  // A new enemy unit comes out of b and goes to the muster point.
  private enemyUnit(b: Building, kind: Kind): void {
    this.outOf(b, kind, ENEMY, (u) => {
      const m = this.posts[this.posts.length - 1];
      u.post = this.posts.length - 1;
      u.spot = [m[0] + (Math.random() - 0.5) * 30, m[1] + (Math.random() - 0.5) * 30];
      this.sendTo(u, u.spot);
    });
    this.mapVersion++;
  }

  // ---------- Combat ----------

  // The enemy unit or building under screen point (x, y), if any.
  private enemyAt(x: number, y: number): Target | null {
    const h = this.unitAt(x, y);
    if (h && h.u.f !== this.me) return h.u;
    const b = this.buildingAt(x, y);
    return b && b.f !== this.me ? b : null;
  }

  private canHit(w: Weapon | undefined, t: Target): boolean {
    if (!w || t.dead) return false;
    // (the Commando blows up buildings and bridges with a charge; a dog's
    // bite and her pistols only hurt foot soldiers)
    // (torpedoes only reach a building on the water: a naval yard)
    if (isB(t)) return w.c4 ? true : w.sea ? t.kind === 'navy' : !w.foot && w.ground;
    if (w.foot && !isFoot(t.kind)) return false;
    // torpedoes only find ships; a submarine under the water only depth charges find
    if (w.sea && !isNaval(t.kind)) return false;
    if (t.kind === 'sub' && this.under(t) && !w.deep) return false;
    return this.aloft(t) && this.alt(t) > 4 ? w.air : w.ground;
  }

  // How far (x, y) is from target t: to a building's nearest wall.
  private reach(x: number, y: number, t: Target): number {
    const [tx, ty] = this.nearPoint(x, y, t.x, t.y);
    if (!isB(t)) return Math.hypot(tx - x, ty - y);
    return Math.hypot(Math.max(0, Math.abs(x - tx) - t.art.rx), Math.max(0, Math.abs(y - ty) - t.art.ry));
  }

  // Where to aim at t from (x, y): its middle, or the near side of a building.
  private aimPoint(x: number, y: number, t: Target): [number, number, number] {
    const [tx, ty] = this.nearPoint(x, y, t.x, t.y);
    if (isB(t)) {
      const cx = Math.max(tx - t.art.rx * 0.6, Math.min(tx + t.art.rx * 0.6, x));
      const cy = Math.max(ty - t.art.ry * 0.6, Math.min(ty + t.art.ry * 0.6, y));
      return [cx, cy, 6];
    }
    return [tx, ty, t.z + this.alt(t) + MID[t.kind] * 0.7];
  }

  // The nearest enemy of side f within range of (x, y) that weapon w can hit:
  // units first, then gun towers (other buildings only when told to).
  private acquire(f: number, x: number, y: number, w: Weapon, range: number): Target | undefined {
    let best: Target | undefined;
    let bd = range;
    for (const o of this.units) {
      if (o.f === f || !this.canHit(w, o)) continue;
      const d = this.reach(x, y, o);
      if (d <= bd && d >= (w.min ?? 0)) {
        bd = d;
        best = o;
      }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (b.f === f || !isDefense(b.kind) || b.rise < 1 || w.foot || !this.canHit(w, b)) continue;
      const d = this.reach(x, y, b);
      if (d <= bd && d >= (w.min ?? 0)) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // Your units go for t: all of them that can hit it.
  private attack(sel: Unit[], t: Target): void {
    for (const u of sel) {
      if (!this.canAttack(u, t)) continue;
      u.target = t;
      u.board = undefined;
      u.forced = true;
      u.chase = false;
      u.anchor = undefined;
      u.repath = 0;
      u.pace = undefined;
    }
  }

  // One unit's fighting, each frame: pick a target if it is standing about,
  // close in on one it was told to attack (or that hit it), turn its gun on
  // it and fire when loaded.
  private fight(u: Unit, dt: number): void {
    const w = this.weaponOf(u);
    if (!w || this.noPick(u)) return;
    u.cool = Math.max(0, (u.cool ?? 0) - dt);
    let t = u.target;
    if (t && !this.canHit(w, t)) {
      t = u.target = undefined;
      u.forced = u.chase = false;
    }
    // (a jet only goes looking with missiles left, and not from its pad)
    const grounded = u.kind === 'jet' && (!u.ammo || (u.fly ?? 0) < 0.9);
    if (!t && !u.moving && !u.deploy && !grounded) {
      u.scan = (u.scan ?? Math.random() * 0.4) - dt;
      if (u.scan <= 0) {
        u.scan = 0.4 + Math.random() * 0.3;
        t = u.target = this.acquire(u.f, u.x, u.y, w, w.range);
      }
    }
    if (!t) return;
    const d = this.reach(u.x, u.y, t);
    // the Commando walks right up to a building to plant her charge
    const c4 = !!w.c4 && isB(t);
    if (d > (c4 ? C4_REACH : w.range)) {
      if (u.dug) {
        // dug in: it only fires on what comes in reach
        u.target = undefined;
        u.forced = u.chase = false;
        return;
      }
      if (u.chase && u.anchor && Math.hypot(u.x - u.anchor[0], u.y - u.anchor[1]) > LEASH) {
        // too far from where it was: give up and go back
        [u.tx, u.ty] = u.anchor;
        u.moving = true;
        u.target = u.anchor = undefined;
        u.chase = false;
        return;
      }
      if (!u.forced && !u.chase) {
        u.target = undefined;
        return;
      }
      if (isNaval(u.kind)) return this.sailToFire(u, t);
      if ((u.repath = (u.repath ?? 0) - dt) <= 0 || !u.moving) {
        u.repath = 0.5;
        const [ax, ay] = this.aimPoint(u.x, u.y, t);
        u.tx = ax;
        u.ty = ay;
        u.moving = true;
      }
      return;
    }
    if (u.moving) {
      if (!u.forced && !u.chase) return; // on its way somewhere: no stopping
      u.moving = false;
      u.tx = u.x;
      u.ty = u.y;
    }
    if (c4) return this.plant(u, t as Building | Bridge);
    if (w.min && d < w.min) {
      // too close to fire on: let it go (one it was told to hit, it waits on)
      if (!u.forced) u.target = undefined;
      return;
    }
    const [ax, ay] = this.aimPoint(u.x, u.y, t);
    const want = Math.atan2(ay - u.y, ax - u.x);
    let off: number;
    if (TURRETED.has(u.kind)) {
      u.turretGoal = want;
      off = angDiff(want, u.turret);
    } else {
      // no turret: the whole thing turns to face it
      const diff = angDiff(want, u.a);
      const stepA = Math.min(UNIT[u.kind].turn, 6) * dt;
      u.a = Math.abs(diff) <= stepA ? want : u.a + Math.sign(diff) * stepA;
      off = angDiff(want, u.a);
    }
    if (Math.abs(off) > 0.12 || u.cool > 0) return;
    if (u.kind === 'jet') {
      // a pair of missiles each pass, until they are gone
      if (!u.ammo || (u.fly ?? 0) < 0.9) return;
      u.ammo--;
    }
    u.cool = w.rof * (0.9 + Math.random() * 0.2);
    u.fired = this.time;
    const z = u.z + (isAir(u.kind) ? this.alt(u) + Math.sin(u.anim * 2) * 1.2 * (u.fly ?? 1) : 0) - (u.digK ? KNEEL_DROP : 0);
    this.shoot(u, w, t, muzzles(u.kind, u.x, u.y, z, u.a, u.turret));
  }

  // A ship closing in on t: it sails for a place on the water it can fire
  // from (found again when t moves off), or gives up if there is none.
  private sailToFire(u: Unit, t: Target): void {
    const [ax, ay] = this.nearPoint(u.x, u.y, t.x, t.y);
    let f = u.fireAt;
    if (!f || f[4] !== t.id || Math.hypot(f[2] - ax, f[3] - ay) > 24) {
      const p = this.fireSpot(u, t);
      if (!p) {
        u.target = u.fireAt = undefined;
        u.forced = u.chase = false;
        u.moving = false;
        u.tx = u.x;
        u.ty = u.y;
        return;
      }
      f = u.fireAt = [p[0], p[1], ax, ay, t.id];
    }
    if (!u.moving || u.tx !== f[0] || u.ty !== f[1]) {
      u.tx = f[0];
      u.ty = f[1];
      u.moving = true;
    }
  }

  // The Commando plants a charge on building or bridge t: it goes off a
  // couple of seconds later and destroys it outright (the host's call).
  private plant(u: Unit, t: Building | Bridge): void {
    u.target = undefined;
    u.forced = u.chase = false;
    if (this.net === 'client' || t.c4 !== undefined) return;
    t.c4 = this.time + C4_S;
    this.sound(t.x, t.y, 'build_place', 0.7, { rate: 1.9 });
    if (!isBridge(t)) this.tell(t.f, `Charge planted on your ${BNAME[t.kind]}!`);
  }

  // How high an aircraft is flying over the ground under it (0 for anything
  // on the ground, or a jet sitting on its pad).
  private alt(u: { kind: Kind; fly?: number }): number {
    if (u.kind === 'heli') return HELI_ALT;
    if (u.kind === 'heron') return HELI_ALT * (u.fly ?? 1);
    if (u.kind === 'jet') return JET_ALT * (u.fly ?? 1);
    if (u.kind === 'plane') return PLANE_ALT * (u.fly ?? 1);
    if (u.fly !== undefined && isFoot(u.kind)) return dropAlt(u.fly);
    return 0;
  }

  // A submarine under the water: it comes up to fire, and stays up a while
  // after (longer if it is hit while it is up).
  private under(u: { kind: Kind; fired?: number; upT?: number }): boolean {
    return u.kind === 'sub' && this.time - Math.max(u.fired ?? -99, u.upT ?? -99) > SUB_UP;
  }

  // A submerged submarine's shadow: its hull seen from above, one flat dark
  // color on the water.
  private subShadow(u: Unit): void {
    const c = this.ctx;
    const ca = Math.cos(u.a);
    const sa = Math.sin(u.a);
    const pt = (a: number, b: number): [number, number] => toScreen(u.x + ca * a - sa * b, u.y + sa * a + ca * b, 0);
    // (the hull's half width along its length, as in sprites.ts's submarine)
    const half = (a: number) => 2.7 * (a > 9 ? Math.sqrt(Math.max(0, (15 - a) / 6)) : a < -9 ? Math.max(0, (a + 16) / 7) : 1);
    const side: [number, number][] = [];
    const other: [number, number][] = [];
    for (let a = -16; a <= 15; a += 1) {
      side.push(pt(a, half(a)));
      other.push(pt(a, -half(a)));
    }
    c.fillStyle = 'rgba(8,18,24,0.62)';
    c.beginPath();
    for (const [i, [x, y]] of [...side, ...other.reverse()].entries()) {
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
  }

  // Can side f see submarine u under the water? Only with a ship, or one
  // of its Destroyers' sonar, close by.
  private sonar(u: Unit, f: number): boolean {
    for (const o of this.units) {
      if (o.f !== f || o.dead || !isNaval(o.kind)) continue;
      const [ox, oy] = this.nearPoint(u.x, u.y, o.x, o.y);
      if (Math.hypot(ox - u.x, oy - u.y) < (o.kind === 'destroyer' ? SONAR : 2.5 * CELL)) return true;
    }
    return false;
  }

  // Up in the air: an aircraft, or a paratrooper still on the way down.
  private aloft(u: { kind: Kind; fly?: number }): boolean {
    return isAir(u.kind) || (u.fly !== undefined && isFoot(u.kind));
  }

  // Can't be picked or given orders: the Paratrooper plane, and paratroopers
  // until they are down.
  private noPick(u: Unit): boolean {
    return u.kind === 'plane' || (u.fly !== undefined && isFoot(u.kind));
  }

  // The stand a plane belongs on: its Air command and where on it.
  private padOfJet(u: Unit): [number, number] | null {
    if (u.deck !== undefined) {
      const c = this.carrierOf(u);
      if (c) return this.nearPoint(u.x, u.y, ...this.slotPoint(c, u.padI ?? 0));
      if (this.net !== 'client') u.deck = undefined;
      return null;
    }
    const b = this.buildings.find((o) => o.id === u.nest && !o.dead && o.f === u.f);
    const p = b?.art.fx[1 + (u.padI ?? 0)];
    if (!b || !p) return null;
    return this.nearPoint(u.x, u.y, b.x + p.x, b.y + p.y);
  }

  // The carrier jet u belongs on, if it is still afloat.
  private carrierOf(u: Unit): Unit | undefined {
    return u.deck === undefined ? undefined : this.units.find((c) => c.id === u.deck && c.kind === 'carrier' && !c.dead && c.f === u.f);
  }

  // Where spot i on carrier c's deck is, on the water (it turns with the ship).
  private slotPoint(c: Unit, i: number): [number, number] {
    const [au, av] = CARRIER_SLOTS[i] ?? [0, 0];
    const ca = Math.cos(c.a);
    const sa = Math.sin(c.a);
    return [c.x + au * ca - av * sa, c.y + au * sa + av * ca];
  }

  // The spots on carrier c's deck with no jet on (or on its way to) them.
  private freeSlots(c: Unit): number[] {
    const used = new Set(this.units.filter((j) => j.deck === c.id && !j.dead).map((j) => j.padI));
    const out: number[] = [];
    for (let i = 0; i < CARRIER_JETS; i++) if (!used.has(i)) out.push(i);
    return out;
  }

  // Send jet u to land on carrier c, on spot i (it takes off if it is down,
  // and comes straight round to land: see deckJet).
  private toDeck(u: Unit, c: Unit, i: number): void {
    u.deck = c.id;
    u.padI = i;
    u.nest = undefined;
    u.target = u.board = undefined;
    u.forced = u.chase = false;
    u.dest = u.aim = undefined;
    u.moving = false;
    u.tx = u.x;
    u.ty = u.y;
    u.dop = u.dl = u.dpath = undefined;
    u.idleAir = 99;
  }

  // A carrier under way churns up the sea: a bow wave peeling off either side
  // (left behind as a V as the ship sails on), spray thrown up off the bow,
  // water washing along its sides and a broad wake churning out astern. The
  // faster it goes, the more.
  private shipWater(u: Unit, dt: number): void {
    const [px, py] = u.wakeP ?? [u.x, u.y];
    u.wakeP = [u.x, u.y];
    if (dt <= 0) return;
    const v = Math.min(1, Math.hypot(u.x - px, u.y - py) / dt / UNIT[u.kind].speed);
    const k = (u.wakeK = (u.wakeK ?? 0) + (v - (u.wakeK ?? 0)) * Math.min(1, dt * 3));
    if (k < 0.08 || !this.shown(u)) return;
    const ca = Math.cos(u.a);
    const sa = Math.sin(u.a);
    // a point on the water ([along, across] the ship), and a way to go along
    // the water, on the screen
    const at = (lu: number, lv: number, z = 0) => toScreen(u.x + lu * ca - lv * sa, u.y + lu * sa + lv * ca, z);
    const vel = (lu: number, lv: number): [number, number] => {
      const wx = lu * ca - lv * sa;
      const wy = lu * sa + lv * ca;
      return [wx - wy, (wx + wy) / 2];
    };
    const n = (rate: number) => {
      // how many to make this frame, at so many a second
      const m = rate * k * dt;
      return Math.floor(m) + (Math.random() < m % 1 ? 1 : 0);
    };
    for (const sd of [-1, 1]) {
      for (let i = n(45); i--; ) {
        const [x, y] = at(86 + Math.random() * 6, sd * (3 + Math.random() * 5));
        const [vx, vy] = vel(-2, sd * (11 + Math.random() * 6) * k);
        this.particles.push({ x, y, vx, vy, life: 0, max: 2.6 + Math.random(), kind: 'foam', size: 1.1 });
      }
      for (let i = n(50); i--; ) {
        const [x, y] = at(-86 + Math.random() * 160, sd * (21 + Math.random() * 3));
        const [vx, vy] = vel(0, sd * 6);
        this.particles.push({ x, y, vx, vy, life: 0, max: 1.2 + Math.random() * 0.8, kind: 'foam', size: 0.9 });
      }
      for (let i = n(22); i--; ) {
        const [x, y] = at(88 + Math.random() * 6, sd * (2 + Math.random() * 3), 1);
        const [vx, vy] = vel(4, sd * (14 + Math.random() * 14));
        this.particles.push({ x, y, vx, vy: vy - 22 - Math.random() * 18, life: 0, max: 0.5 + Math.random() * 0.4, kind: 'spray', size: 1 });
      }
    }
    for (let i = n(30); i--; ) {
      const [x, y] = at(-92 - Math.random() * 8, (Math.random() - 0.5) * 24);
      this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 2.4 + Math.random(), kind: Math.random() < 0.5 ? 'wake' : 'foam', size: 1.6 });
    }
  }

  // Where (x, y) is on carrier c's deck: [along, across] from its middle.
  private deckLocal(c: Unit, x: number, y: number): [number, number] {
    const [px, py] = this.nearPoint(c.x, c.y, x, y);
    const ca = Math.cos(c.a);
    const sa = Math.sin(c.a);
    return [(px - c.x) * ca + (py - c.y) * sa, -(px - c.x) * sa + (py - c.y) * ca];
  }

  // A carrier's jet each frame (the host moves it about; a player's screen
  // keeps one sitting at its spot riding along with the ship). It sits at its
  // spot on the starboard side, rearming and being mended; given somewhere to
  // go, it taxis across to the stern end of the runway down the port side,
  // is flung down it and off the bow. Done, it comes round astern, lines up
  // with the runway and glides in, lands, pulls up on the wires and taxis
  // back to its spot.
  private deckJet(u: Unit, c: Unit, dt: number): void {
    const host = this.net !== 'client';
    const cc = Math.cos(c.a);
    const cs = Math.sin(c.a);
    const at = (lu: number, lv: number): [number, number] => [c.x + lu * cc - lv * cs, c.y + lu * cs + lv * cc];
    const [lu, lv] = this.deckLocal(c, u.x, u.y);
    const [su, sv, sa] = CARRIER_SLOTS[u.padI ?? 0] ?? CARRIER_SLOTS[0];
    const [rv, ru0, ru1] = CARRIER_RUNWAY;
    const LANE = CARRIER_LANE;
    // the ways out to the runway (from its spot, or from the lane) and back
    // in to its spot from the lane (in from aft of it, nose first: it turns
    // round on the spot at the end)
    const toRunway = (from: [number, number][]): [number, number][] => [...from, [ru0 + 8, LANE], [ru0, rv]];
    const outOfSpot = (): [number, number][] => {
      if (!sa) return [[su + 10, sv], [su + 16, LANE]];
      const k = (LANE - sv) / Math.sin(sa);
      return [[su + Math.cos(sa) * k, LANE]];
    };
    const intoSpot = (): [number, number][] => [[su - (sa ? 8 : 10), LANE], [su, sv]];
    const busy = u.moving || !!u.target;
    const fly = u.fly ?? 0;
    // at its spot
    const parked = !u.dop && fly < 0.05 && Math.hypot(lu - su, lv - sv) < 6;
    if (parked && !(busy && host)) {
      [u.x, u.y] = at(su, sv);
      if (!u.moving) [u.tx, u.ty] = [u.x, u.y];
      u.a = c.a + sa;
      u.fly = 0;
      // (being mended: sparks fly)
      if (u.hp < 1 && Math.random() < dt * 5) {
        const [sx, sy] = toScreen(u.x + (Math.random() - 0.5) * 8, u.y + (Math.random() - 0.5) * 8, u.z + MID.jet);
        this.fx.sparks(sx, sy, 2);
      }
      if (!host) return;
      if ((u.ammo ?? 0) < JET_AMMO && (u.rearm = (u.rearm ?? JET_REARM) - dt) <= 0) {
        u.ammo = (u.ammo ?? 0) + 1;
        u.rearm = JET_REARM;
      }
      u.hp = Math.min(1, u.hp + DECK_MEND * dt);
      return;
    }
    if (!host) return;
    // given somewhere to go: off to the runway
    if (parked) {
      u.dop = 'out';
      u.dl = [su, sv, sa];
      u.dpath = toRunway(outOfSpot());
    }
    // on the deck: everything is in the ship's own terms, so it rides along
    // as the ship sails and turns
    if (u.dop === 'out' || u.dop === 'roll' || u.dop === 'brake' || u.dop === 'in') {
      const L = (u.dl ??= [lu, lv, u.a - c.a]);
      // (told to go while taxiing back, or the order called off on the way out)
      if (u.dop === 'in' && busy) {
        u.dop = 'out';
        u.dpath = toRunway([[L[0], LANE]]);
      } else if (u.dop === 'out' && !busy) {
        u.dop = 'in';
        u.dpath = [[L[0], LANE], ...intoSpot()];
      }
      const turnTo = (want: number, rate: number) => {
        const diff = angDiff(want, L[2]);
        L[2] += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
        return Math.abs(diff) < 0.02;
      };
      if (u.dop === 'out' || u.dop === 'in') {
        u.fly = 0;
        const p = u.dpath?.[0];
        // (it waits short of the runway while another jet is on it, taking
        // off or coming in to land)
        const hold =
          u.dop === 'out' &&
          u.dpath?.length === 1 &&
          this.units.some((o) => o !== u && o.deck === c.id && !o.dead && ((o.dop === 'roll' && (o.dl?.[0] ?? 0) < ru0 + 90) || o.dop === 'final' || o.dop === 'brake' || (o.dop === 'out' && o.dpath?.length === 0) || (o.dop === 'out' && o.dpath?.length === 1 && o.id < u.id)));
        if (p && hold) {
          // (lined up, waiting its turn)
        } else if (p) {
          // roll from point to point, turning on the spot onto each new way
          const dx = p[0] - L[0];
          const dy = p[1] - L[1];
          const d = Math.hypot(dx, dy);
          if (d < 0.6) u.dpath!.shift();
          else {
            const want = Math.atan2(dy, dx);
            turnTo(want, 2.4);
            const go = Math.max(0, Math.cos(angDiff(want, L[2])) - 0.5) * 2;
            const sp = Math.min(d, TAXI_SPEED * go * dt);
            L[0] += Math.cos(want) * sp;
            L[1] += Math.sin(want) * sp;
          }
        } else if (turnTo(u.dop === 'out' ? 0 : sa, 1.6)) {
          // there, facing the bow down the runway (off it goes), or parked
          if (u.dop === 'out') {
            u.dop = 'roll';
            u.spd = 0;
            this.sound(u.x, u.y, 'build_place', 0.4, { rate: 1.4 });
          } else u.dop = u.dl = u.dpath = undefined;
        }
      } else if (u.dop === 'roll') {
        // flung down the runway, lifting off as it goes, and away off the bow
        u.spd = Math.min(UNIT.jet.speed * 1.2, (u.spd ?? 0) + CAT_ACC * dt);
        L[0] += u.spd * dt;
        L[1] += Math.sign(rv - L[1]) * Math.min(Math.abs(rv - L[1]), 4 * dt);
        L[2] = 0;
        u.fly = Math.max(0, Math.min(1, (L[0] - ru0 - 50) / 120));
        if (L[0] > ru1) u.dop = u.dl = u.dpath = undefined;
      } else {
        // down: the wires pull it up, then it taxis back to its spot
        u.fly = 0;
        L[1] = rv;
        L[2] = 0;
        u.spd = Math.max(TAXI_SPEED, (u.spd ?? 30) - WIRE_DEC * dt);
        L[0] += u.spd * dt;
        if (u.spd <= TAXI_SPEED) {
          u.dop = 'in';
          u.dpath = [[L[0] + 6, LANE], ...intoSpot()];
        }
      }
      if (u.dl) {
        [u.x, u.y] = at(u.dl[0], u.dl[1]);
        u.a = c.a + u.dl[2];
      }
      if (!u.moving) [u.tx, u.ty] = [u.x, u.y];
      return;
    }
    // in the air (or down somewhere else, about to take off)
    if (!u.ammo && u.target) {
      u.target = undefined;
      u.forced = u.chase = false;
    }
    if (busy) {
      // given something to do: it breaks off landing and goes
      u.dop = undefined;
      u.idleAir = 0;
      u.fly = Math.min(1, fly + dt * 0.7);
      return;
    }
    u.idleAir = (u.idleAir ?? 0) + dt;
    if (!u.dop) {
      // hanging about (or out of missiles): up, and round to land
      u.fly = Math.min(1, fly + dt * 0.7);
      if ((!u.ammo || u.idleAir > 1.5 || u.hp < 1) && u.fly > 0.5) {
        u.dop = 'app';
        u.dtime = 0;
      }
      return;
    }
    const steer = (x: number, y: number, turn: number) => {
      const diff = angDiff(Math.atan2(y - u.y, x - u.x), u.a);
      u.a += Math.sign(diff) * Math.min(Math.abs(diff), turn * dt);
      return Math.abs(diff);
    };
    const ahead = (d: number) => {
      u.x += Math.cos(u.a) * d;
      u.y += Math.sin(u.a) * d;
    };
    const [tx, ty] = this.nearPoint(u.x, u.y, ...at(ru0 + 6, rv));
    if (u.dop === 'app') {
      // round to a point well out astern, in line with the runway
      u.fly = Math.min(1, fly + dt * 0.7);
      // (one at a time: while another is coming in, it circles out there,
      // each jet round its own spot so they don't bunch up)
      const busyRunway = this.units.some((o) => o !== u && o.deck === c.id && !o.dead && (o.dop === 'final' || o.dop === 'brake'));
      const k = u.padI ?? 0;
      const [ax, ay] = this.nearPoint(u.x, u.y, ...at(ru0 + 6 - DECK_APPROACH - (busyRunway ? 40 + (k % 3) * 45 : 0), rv + (busyRunway ? ((k % 4) - 1.5) * 55 : 0)));
      const off = steer(ax, ay, 2.4);
      ahead(UNIT.jet.speed * dt);
      const d = Math.hypot(ax - u.x, ay - u.y);
      if (!busyRunway && (d < 24 || (d < 90 && off > 1.6))) {
        u.dop = 'final';
        u.dtime = 0;
      }
    } else {
      // gliding in to the stern end of the runway, coming down as it nears
      steer(tx, ty, 3);
      const d = Math.hypot(tx - u.x, ty - u.y);
      const sp = Math.max(34, Math.min(UNIT.jet.speed, 34 + d * 0.12));
      ahead(Math.min(sp * dt, d));
      u.fly = Math.min(fly, Math.max(0, (d - 4) / DECK_APPROACH));
      u.dtime = (u.dtime ?? 0) + dt;
      if (d < 4) {
        u.dop = 'brake';
        u.dl = [ru0 + 6, rv, 0];
        u.spd = sp;
        u.fly = 0;
        this.sound(u.x, u.y, 'build_place', 0.5, { rate: 0.6 });
      } else if (u.dtime > 12) u.dop = 'app'; // (it missed: round again)
    }
    u.tx = u.x;
    u.ty = u.y;
  }

  // A carrier of side f lying idle at one of its Naval yards with room on
  // deck: new jets land on it rather than at an Air command.
  private parkedCarrier(f: number): Unit | null {
    for (const c of this.units) {
      if (c.f !== f || c.kind !== 'carrier' || c.dead || c.moving || c.target) continue;
      const near = this.buildings.some((b) => {
        if (b.f !== f || b.kind !== 'navy' || b.rise < 1 || b.dead) return false;
        const [bx, by] = this.nearPoint(c.x, c.y, b.x, b.y);
        return Math.hypot(bx - c.x, by - c.y) < Math.max(b.art.rx, b.art.ry) + PARK_NEAR;
      });
      if (near && this.freeSlots(c).length) return c;
    }
    return null;
  }

  // A carrier of side f with room on deck, nearest (x, y), for a jet that
  // has lost its home.
  private carrierWithRoom(f: number, x: number, y: number): Unit | null {
    let best: Unit | null = null;
    let bd = 1e9;
    for (const c of this.units) {
      if (c.f !== f || c.kind !== 'carrier' || c.dead || !this.freeSlots(c).length) continue;
      const [cx, cy] = this.nearPoint(x, y, c.x, c.y);
      const d = Math.hypot(cx - x, cy - y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  // A free stand of side f's Air commands, for a new plane of this kind (or
  // one that has lost its own): [building, stand].
  private freePad(f: number, kind: 'jet' | 'plane', only?: Building): [Building, number] | null {
    for (const b of this.buildings) {
      if (b.f !== f || b.kind !== 'radar' || b.rise < 1 || b.dead || (only && b !== only)) continue;
      for (const i of STAND_ORDER[kind]) if (!this.units.some((u) => (u.kind === 'jet' || u.kind === 'plane') && u.nest === b.id && u.padI === i && !u.dead)) return [b, i];
    }
    return null;
  }

  // A new plane of side f comes out of Air command b's hangar door and taxis
  // across the apron to stand i, ending up facing the runway.
  private rollOut(b: Building, i: number, kind: 'jet' | 'plane', f: number): Unit {
    const d = doorOf('radar')!;
    const r = UNIT[kind].r;
    const [fx, fy] = this.fold(b.x + d.x, b.y + d.y - r - 1);
    const ox = fx - (b.x + d.x);
    const oy = fy - (b.y + d.y - r - 1);
    const u = this.newUnit(kind, f, fx, fy, Math.PI / 2);
    Object.assign(u, { fly: 0, nest: b.id, padI: i });
    if (kind === 'jet') u.ammo = JET_AMMO;
    u.exit = { b, x: b.x + d.x + ox, y: b.y + d.y + oy, d, k: b.x + ox + b.y + oy + Math.min(b.art.rx, b.art.ry) + 0.01, t: 0 };
    const st = b.art.fx[1 + i];
    u.taxi = [
      [b.x + d.x + ox, b.y + d.y + oy + r + 3],
      [b.x + st.x + ox, b.y + AIR_STAND_V - 7 + oy],
      [b.x + st.x + ox, b.y + st.y + oy],
    ];
    u.taxiA = Math.PI / 2;
    this.sound(b.x, b.y, 'unit_exit');
    return u;
  }

  // A plane on the ground taxiing (the host's job): wait for the hangar
  // door, then roll from point to point, turning as it goes, and at the end
  // turn to face the way it should. A jet told to go somewhere takes off
  // from wherever it is instead.
  private taxiStep(u: Unit, dt: number): void {
    if (this.net === 'client' || !u.taxi) return;
    if (u.kind === 'jet' && (u.moving || u.target)) {
      u.taxi = u.taxiA = u.exit = undefined;
      return;
    }
    const e = u.exit;
    if (e) {
      e.t += dt;
      if (e.b.dead) u.exit = undefined;
      else if (e.t < DOOR_S) return;
      // out past the door
      else if ((u.x - e.x) * e.d.nx + (u.y - e.y) * e.d.ny > UNIT[u.kind].r + 2) u.exit = undefined;
    }
    const next = u.taxi[0];
    if (!next) {
      // there: turn to face the way it parks
      const diff = angDiff(u.taxiA ?? u.a, u.a);
      const stepA = 1.6 * dt;
      u.a = Math.abs(diff) <= stepA ? (u.taxiA ?? u.a) : u.a + Math.sign(diff) * stepA;
      if (Math.abs(diff) <= stepA) u.taxi = u.taxiA = undefined;
      return;
    }
    const [tx, ty] = this.nearPoint(u.x, u.y, next[0], next[1]);
    const dx = tx - u.x;
    const dy = ty - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.6) {
      u.taxi.shift();
      return;
    }
    const want = Math.atan2(dy, dx);
    const diff = angDiff(want, u.a);
    const stepA = 2.4 * dt;
    u.a = Math.abs(diff) <= stepA ? want : u.a + Math.sign(diff) * stepA;
    // (it turns on the spot before rolling off a new way)
    const go = Math.max(0, Math.cos(angDiff(want, u.a)) - 0.5) * 2;
    const sp = Math.min(dist, TAXI_SPEED * go * dt);
    u.x += Math.cos(want) * sp;
    u.y += Math.sin(want) * sp;
  }

  // Waiting for a tap on the map: where the paratroopers go.
  private paraAim = false;

  // Side f's Paratrooper plane, if it has one.
  private paraPlane(f: number): Unit | undefined {
    return this.units.find((u) => u.kind === 'plane' && u.f === f && !u.dead);
  }

  // Side f has its one Paratrooper plane: out, or being made.
  private hasPlane(f: number): boolean {
    if (this.paraPlane(f)) return true;
    const e = this.eco[f];
    return e.jobs.get('veh')?.tech.unit === 'plane' || (e.queue.get('veh') ?? []).some((t) => t.unit === 'plane');
  }

  /** Side f's paratroopers are ready to call in: its plane is home and loaded. */
  paraReady(f: number): boolean {
    const p = this.paraPlane(f);
    return !!p && !p.mission && !p.taxi && this.eco[f].paraT <= 0;
  }

  // The paratroopers load up while side f's plane waits on its stand (and
  // the power holds out); without a plane they start again from nothing.
  private paraClock(f: number, dt: number): void {
    const e = this.eco[f];
    const p = this.paraPlane(f);
    if (!p) {
      e.paraT = PARA_S;
      return;
    }
    if (p.mission || p.taxi || e.lowPower || e.paraT <= 0) return;
    if ((e.paraT -= dt) <= 0) {
      e.paraT = 0;
      this.tell(f, 'Paratroopers ready: call them in from the Defense tab', 'para_ready');
    }
  }

  // Side f calls in its paratroopers on (x, y): its plane taxis out to the
  // end of the runway that points their way, takes off, drops them over the
  // spot and comes back round to land.
  private callPara(f: number, x: number, y: number): void {
    const p = this.paraPlane(f);
    const home = p && this.buildings.find((o) => o.id === p.nest && !o.dead && o.f === f);
    if (!p || !home || !this.paraReady(f)) return;
    const [hx, hy] = this.nearPoint(x, y, home.x, home.y);
    const east = x >= hx;
    const [rwv, rw0, rw1] = AIR_RUNWAY;
    const st = home.art.fx[1 + (p.padI ?? 0)];
    const start = east ? rw0 + 3 : rw1 - 3;
    const [bx, by] = this.nearPoint(p.x, p.y, home.x, home.y);
    p.taxi = [
      [bx + st.x, by + rwv - 8],
      [bx + start + (east ? 6 : -6), by + rwv - 4],
      [bx + start, by + rwv],
    ];
    p.taxiA = east ? 0 : Math.PI;
    p.mission = 'out';
    p.drops = PARA_N;
    p.dropAt = [x, y];
    this.eco[f].paraT = PARA_S;
    this.tell(f, 'Paratroopers on the way');
    this.sound(p.x, p.y, 'order_confirm', 0.6);
  }

  // The Paratrooper plane on its run (the host's job): taxi out, roll down
  // the runway and climb away, fly to the drop and let its soldiers jump,
  // come round to line up with the runway, land, slow down and taxi home.
  private planeAbout(u: Unit, dt: number): void {
    if (this.net === 'client') return;
    if (u.taxi) {
      this.taxiStep(u, dt);
      if (!u.taxi && u.mission === 'out') {
        u.mission = 'roll';
        u.spd = 0;
        u.rolled = 0;
      } else if (!u.taxi && u.mission === 'in') u.mission = undefined;
      return;
    }
    const st = UNIT.plane;
    const ahead = (sp: number) => {
      u.x += Math.cos(u.a) * sp * dt;
      u.y += Math.sin(u.a) * sp * dt;
    };
    const steer = (tx: number, ty: number, turn: number) => {
      const diff = angDiff(Math.atan2(ty - u.y, tx - u.x), u.a);
      u.a += Math.sign(diff) * Math.min(Math.abs(diff), turn * dt);
      return Math.abs(diff);
    };
    const home = this.buildings.find((o) => o.id === u.nest && !o.dead && o.f === u.f);
    switch (u.mission) {
      case 'roll': {
        // down the runway, lifting off past half way and climbing on out
        u.spd = Math.min(st.speed, (u.spd ?? 0) + ROLL_ACC * dt);
        ahead(u.spd);
        u.rolled = (u.rolled ?? 0) + u.spd * dt;
        u.fly = Math.max(0, Math.min(1, (u.rolled - 55) / 90));
        if (u.fly >= 1) u.mission = 'fly';
        return;
      }
      case 'fly': {
        u.fly = 1;
        if (u.drops && u.dropAt) {
          const [dx, dy] = this.nearPoint(u.x, u.y, ...u.dropAt);
          steer(dx, dy, 1.1);
          ahead(st.speed);
          this.jump(u, dt, Math.hypot(dx - u.x, dy - u.y));
          return;
        }
        if (!home) {
          // nowhere to land: find another Air command with a stand, or circle
          const fp = this.freePad(u.f, 'plane');
          if (fp) [u.nest, u.padI] = [fp[0].id, fp[1]];
          else {
            u.a += 0.5 * dt;
            ahead(st.speed * 0.8);
          }
          return;
        }
        // line up to land: the runway end nearer the plane, from well out
        const [bx, by] = this.nearPoint(u.x, u.y, home.x, home.y);
        const [rwv, rw0, rw1] = AIR_RUNWAY;
        if (!u.land) {
          const east = u.x < bx;
          u.land = [bx + (east ? rw0 + 4 : rw1 - 4), by + rwv, east ? 0 : Math.PI];
        }
        const [lx, ly] = this.nearPoint(u.x, u.y, u.land[0], u.land[1]);
        const ax = lx - Math.cos(u.land[2]) * APPROACH;
        const ay = ly - Math.sin(u.land[2]) * APPROACH;
        const off = steer(ax, ay, 1.1);
        ahead(st.speed);
        const d = Math.hypot(ax - u.x, ay - u.y);
        if (d < 30 || (d < 120 && off > 1.7)) u.mission = 'final';
        return;
      }
      case 'final': {
        // gliding in: straight for the end of the runway, coming down
        if (!u.land || !home) {
          u.mission = 'fly';
          u.land = undefined;
          return;
        }
        const [lx, ly] = this.nearPoint(u.x, u.y, u.land[0], u.land[1]);
        steer(lx, ly, 2);
        const d = Math.hypot(lx - u.x, ly - u.y);
        u.spd = Math.max(40, Math.min(st.speed, 40 + d * 0.12));
        ahead(Math.min(u.spd, d / dt));
        u.fly = Math.min(u.fly ?? 1, d / APPROACH);
        if (d < 1.5) {
          u.mission = 'rollout';
          u.a = u.land[2];
          u.fly = 0;
          this.sound(u.x, u.y, 'build_place', 0.5, { rate: 0.6 });
        }
        return;
      }
      case 'rollout': {
        // down: slow to a crawl along the runway, then taxi back to its stand
        u.fly = 0;
        u.spd = Math.max(TAXI_SPEED, (u.spd ?? 40) - ROLL_DEC * dt);
        ahead(u.spd);
        if (u.spd <= TAXI_SPEED && home) {
          const [bx, by] = this.nearPoint(u.x, u.y, home.x, home.y);
          const stand = home.art.fx[1 + (u.padI ?? 0)];
          const [rwv] = AIR_RUNWAY;
          u.taxi = [
            [bx + stand.x, by + rwv],
            [bx + stand.x, by + stand.y],
          ];
          u.taxiA = Math.PI / 2;
          u.mission = 'in';
          u.land = undefined;
        } else if (!home) u.mission = 'fly';
        return;
      }
    }
  }

  // The plane over the drop (d away from the spot): a paratrooper jumps
  // every moment, each where he can land.
  private jump(u: Unit, dt: number, d: number): void {
    if (!u.drops || d > 70 || (u.jumpT = (u.jumpT ?? 0) - dt) > 0) return;
    const side = (Math.random() - 0.5) * 14;
    const jx = u.x - Math.sin(u.a) * side;
    const jy = u.y + Math.cos(u.a) * side;
    const s = this.newUnit('inf', u.f, jx, jy, u.a + Math.PI * 0.5);
    if (this.okAt(s, jx, jy)) {
      s.fly = 1;
      u.drops--;
      u.jumpT = 0.18;
    } else this.units.splice(this.units.indexOf(s), 1);
  }

  // A paratrooper coming down.
  private paraDrop(u: Unit, dt: number): void {
    u.fly = Math.max(0, (u.fly ?? 0) - dt / DROP_S);
    if (u.fly > 0 || this.net === 'client') return;
    // down: a soldier again (and lost if he came down in the water)
    u.fly = undefined;
    u.z = this.terrain.elev(u.x, u.y);
    u.tx = u.x;
    u.ty = u.y;
    if (!this.okAt(u, u.x, u.y)) this.kill(u, this.terrain.k(u.x, u.y) === K.Water);
  }

  // A paratrooper on the way down, under his canopy: it bursts open, swings
  // him to and fro, and (see foldChutes) folds up on the grass once he's down.
  private drawChute(u: Unit): void {
    const z = u.z + this.alt(u);
    const st = chuteInAir((1 - (u.fly ?? 0)) * DROP_S, u.id * 0.37);
    const [ox, oy] = swingOffset(st);
    // his swing, in screen pixels, back into the map (sideways on the screen is +x -y)
    this.blit(this.footSprite(u), u.x + ox / 2, u.y - ox / 2, z - oy);
    const [sx, sy] = toScreen(u.x, u.y, z);
    drawChute(this.ctx, sx, sy, st, factionOf(u.f), this.time);
  }

  // Paratroopers who just came down: their canopies fold over and sink
  // (only to look at: each screen sees them land for itself).
  private chuteWatch = new Map<number, { x: number; y: number; z: number; f: number }>();
  private chuteFolds: { x: number; y: number; z: number; f: number; t0: number }[] = [];
  private foldChutes(): void {
    const here = new Set<number>();
    for (const u of this.units) {
      if (!isFoot(u.kind)) continue;
      here.add(u.id);
      if (u.fly !== undefined) this.chuteWatch.set(u.id, { x: u.x, y: u.y, z: u.z, f: u.f });
      else {
        const w = this.chuteWatch.get(u.id);
        if (w) {
          this.chuteWatch.delete(u.id);
          if (this.terrain.k(u.x, u.y) !== K.Water) this.chuteFolds.push({ ...w, z: u.z, t0: this.time });
        }
      }
    }
    for (const id of this.chuteWatch.keys()) if (!here.has(id)) this.chuteWatch.delete(id);
    this.chuteFolds = this.chuteFolds.filter((p) => this.time - p.t0 < FOLD_S && this.time >= p.t0);
  }

  // Jets and Herons each frame: taking off and landing, and jets going home
  // to rearm when they are out of missiles or have nothing to do.
  private flyAbout(u: Unit, dt: number): void {
    if (u.kind === 'heron') {
      // it settles onto the ground to let its riders out
      const want = u.unloading ? 0 : 1;
      u.fly = (u.fly ?? 1) + Math.sign(want - (u.fly ?? 1)) * Math.min(Math.abs(want - (u.fly ?? 1)), dt * 0.8);
      return;
    }
    if (u.exit) return;
    let home = this.padOfJet(u);
    if (!home && this.net !== 'client') {
      // its Air command (or carrier) is gone: another one's free stand, or
      // room on a carrier, if there is any
      const fp = this.freePad(u.f, 'jet');
      const c = fp ? null : this.carrierWithRoom(u.f, u.x, u.y);
      if (fp) [u.nest, u.padI, u.deck] = [fp[0].id, fp[1], undefined];
      else if (c) [u.nest, u.padI, u.deck] = [undefined, this.freeSlots(c)[0], c.id];
      home = this.padOfJet(u);
    }
    // a carrier's jet takes off and lands on its runway
    const ship = this.carrierOf(u);
    if (ship) {
      this.deckJet(u, ship, dt);
      return;
    }
    const atHome = !!home && Math.hypot(home[0] - u.x, home[1] - u.y) < 2;
    const busy = u.moving || !!u.target;
    // up when it has somewhere to be; down on its pad
    const up = busy || !atHome;
    u.fly = Math.max(0, Math.min(1, (u.fly ?? 0) + (up ? 1 : -1) * dt * 0.7));
    if (atHome && !busy && (u.fly ?? 0) < 0.05) {
      // on its stand: turn to face the runway, and rearm, one missile pair at a time
      const diff = angDiff(Math.PI / 2, u.a);
      u.a += Math.sign(diff) * Math.min(Math.abs(diff), dt);
      if ((u.ammo ?? 0) < JET_AMMO && (u.rearm = (u.rearm ?? JET_REARM) - dt) <= 0) {
        u.ammo = (u.ammo ?? 0) + 1;
        u.rearm = JET_REARM;
      }
      return;
    }
    if (this.net === 'client') return;
    // out of missiles, or done and hanging about: back to its pad
    if (!u.ammo && u.target) {
      u.target = undefined;
      u.forced = u.chase = false;
    }
    if (!busy) u.idleAir = (u.idleAir ?? 0) + dt;
    else u.idleAir = 0;
    if (home && !atHome && (!u.ammo || (u.idleAir ?? 0) > 1.5) && !u.moving) {
      [u.tx, u.ty] = home;
      u.moving = true;
    }
  }

  // Is u swimming (the Commando, in the water off a bridge)?
  private swimming(u: Unit): boolean {
    return u.kind === 'cmdo' && this.terrain.k(u.x, u.y) === K.Water && !this.deckAt(u.x, u.y);
  }

  // A swimmer: only what is above the water shows, with ripples round it.
  private drawSwimmer(u: Unit): void {
    const c = this.ctx;
    const [sx, sy] = toScreen(u.x, u.y, u.z);
    c.save();
    c.beginPath();
    c.rect(sx - 12, sy - 24, 24, 24);
    c.clip();
    this.blit(this.footSprite(u), u.x, u.y, u.z - SWIM_DROP);
    c.restore();
    const k = (u.anim * (u.moving ? 3 : 1.2)) % 1;
    const r = 2 + k * 3;
    c.fillStyle = `rgba(225,240,245,${0.7 * (1 - k)})`;
    c.fillRect(Math.round(sx - r), Math.round(sy), 1, 0.5);
    c.fillRect(Math.round(sx + r), Math.round(sy), 1, 0.5);
    c.fillRect(Math.round(sx), Math.round(sy + r * 0.4), 1, 0.5);
  }

  // A Commando's charge on a building or bridge, blinking red.
  private drawCharge(x: number, y: number, z: number): void {
    if (Math.floor(this.time * 6) % 2) return;
    const [sx, sy] = toScreen(x, y, z);
    const c = this.ctx;
    c.fillStyle = 'rgba(255,60,40,0.45)';
    c.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
    c.fillStyle = '#ff6a4a';
    c.fillRect(Math.round(sx), Math.round(sy), 1, 1);
  }

  // Side f already has its one Commando: out, riding in a transport, or being trained.
  private hasCommando(f: number): boolean {
    if (this.units.some((u) => u.f === f && !u.dead && (u.kind === 'cmdo' || u.cargo?.some((p) => p.kind === 'cmdo')))) return true;
    const e = this.eco[f];
    return e.jobs.get('inf')?.tech.unit === 'cmdo' || (e.queue.get('inf') ?? []).some((t) => t.unit === 'cmdo');
  }

  // What a unit fires with: a G.I. dug in has a steadier aim, and none
  // while it is digging in or climbing out.
  private weaponOf(u: Unit): Weapon | undefined {
    if (u.kind === 'inf' && u.digK) return u.digK >= 1 ? DUG_WEAPON : undefined;
    return WEAPON[u.kind];
  }

  // The picture of a foot soldier now: standing, walking, throwing, or dug in.
  private footSprite(u: Unit): StackSprite {
    const art = this.art[u.f];
    const d = dirIndex(u.a, 16);
    if (u.kind === 'inf' && u.digK) return art.infantryDug[Math.min(2, Math.floor(u.digK * 3))][d];
    const frames = footFrames(art, u.kind);
    if (u.kind === 'gren' && this.time - (u.fired ?? -9) < 0.35) return frames[3][d];
    if (u.kind === 'dog') {
      // a gallop, two beats; a lunge as it bites
      if (this.time - (u.fired ?? -9) < 0.3) return frames[3][d];
      const beat = u.moving ? Math.floor(u.anim * 12) : u.pace ? Math.floor(u.anim * 6) : -1;
      return frames[beat < 0 ? 0 : 1 + (beat % 2)][d];
    }
    // a four-beat walk: stride, pass, the other stride, pass
    const beat = u.moving ? Math.floor(u.anim * 9) : u.pace ? Math.floor(u.anim * 5) : -1;
    return frames[beat < 0 ? 0 : [1, 0, 2, 0][beat % 4]][d];
  }

  // A defense (Turret, Pillbox, Lumen tower, Skyguard battery) picks the nearest enemy unit in range, turns and fires.
  private towerFight(b: Building, dt: number): void {
    const kind = b.kind as DefenseKind;
    const w = WEAPON[kind]!;
    const p = b.art.fx[0];
    const gx = b.x + p.x;
    const gy = b.y + p.y;
    b.cool = Math.max(0, (b.cool ?? 0) - dt);
    let t = b.target;
    if (t && (!this.canHit(w, t) || this.reach(gx, gy, t) > w.range)) t = b.target = undefined;
    if (kind === 'prism') this.prismGlow(b, gx, gy, p.z, dt);
    if (!t) {
      b.scan = (b.scan ?? 0) - dt;
      if (b.scan > 0) return;
      b.scan = 0.4;
      t = b.target = this.acquire(b.f, gx, gy, w, w.range);
      if (!t) return;
    }
    const [ax, ay] = this.aimPoint(gx, gy, t);
    const want = Math.atan2(ay - gy, ax - gx);
    b.gunGoal = want;
    // (a Lumen tower or a Pillbox has nothing to turn: it fires any way)
    const fixed = FIXED_GUN.has(kind);
    if (kind === 'prism' && !this.prismCharge(b, gx, gy, p.z, dt)) return;
    if ((!fixed && Math.abs(angDiff(want, b.gun)) > 0.1) || b.cool > 0) return;
    b.cool = w.rof * (0.9 + Math.random() * 0.2);
    const from = muzzles(kind, gx, gy, p.z, 0, fixed ? want : b.gun);
    this.shoot(b, kind === 'prism' ? this.prismBoost(b, w, from[0]) : w, t, from);
  }

  // A Lumen tower with something to shoot charges up over PRISM_CHARGE
  // seconds (with a rising whine) before it can fire; true once it is full
  // and reloaded, ready to fire now.
  private prismCharge(b: Building, gx: number, gy: number, gz: number, dt: number): boolean {
    if ((b.cool ?? 0) > PRISM_CHARGE) return false;
    const k = b.charge ?? 0;
    if (k === 0) this.sound(gx, gy, 'beam_charge', 1, {}, gz);
    b.charge = Math.min(1, k + dt / PRISM_CHARGE);
    if (b.charge < 1 || (b.cool ?? 0) > 0) return false;
    b.charge = 0;
    return true;
  }

  // The light gathering at a Lumen tower's coil as it charges (and fading
  // away again if it loses its target first).
  private prismGlow(b: Building, gx: number, gy: number, gz: number, dt: number): void {
    if (!b.target && b.charge) b.charge = Math.max(0, b.charge - (2 * dt) / PRISM_CHARGE);
    if (!b.charge) return;
    const [sx, sy] = toScreen(gx, gy, gz);
    this.fx.charge(sx, sy, b.charge, dt);
  }

  // A Lumen tower about to fire draws on the others of its side nearby that
  // are free (not reloading and with nothing of their own to shoot): each
  // beams its light into this one, using up its own shot, and adds to the
  // blow. Returns the weapon to fire with.
  private prismBoost(b: Building, w: Weapon, at: [number, number, number]): Weapon {
    let n = 0;
    const [ax, ay] = toScreen(...at);
    for (const o of this.buildings) {
      if (n >= PRISM_MAX || o === b || o.f !== b.f || o.kind !== 'prism' || o.dead || o.rise < 1 || (o.cool ?? 0) > 0 || o.target) continue;
      const [ox, oy] = this.nearPoint(b.x, b.y, o.x, o.y);
      if (Math.hypot(ox - b.x, oy - b.y) > PRISM_LINK) continue;
      o.cool = w.rof;
      const q = o.art.fx[0];
      const [sx, sy] = toScreen(ox + q.x, oy + q.y, q.z);
      this.fx.beam(sx, sy, ax, ay, 0.5);
      n++;
    }
    return n ? { ...w, dmg: w.dmg * (1 + n * PRISM_ADD) } : w;
  }

  // A Service depot mends one vehicle of its side standing on its pad at a
  // time, a little each second, for credits (the host's call; a player's
  // screen only shows the sparks).
  private serviceAt(b: Building, dt: number): void {
    const u = this.units.find((o) => {
      if (o.f !== b.f || o.dead || o.hp >= 1 || o.moving || !servedBy(o, b)) return false;
      const [ox, oy] = this.nearPoint(b.x, b.y, o.x, o.y);
      // (the carrier is far too big for the slip: it is mended lying off the yard)
      if (o.kind === 'carrier') return Math.hypot(ox - b.x, oy - b.y) < Math.max(b.art.rx, b.art.ry) + PARK_NEAR;
      // (anywhere on the depot's pad: a vehicle driving in can stop short of
      // the middle, at a corner post)
      return b.kind === 'navy' ? Math.abs(ox - b.x) < 13 && oy - b.y > -10 && oy - b.y < 24 : Math.abs(ox - b.x) < 13 && Math.abs(oy - b.y) < 13;
    });
    if (!u) return;
    if (Math.random() < dt * 6) {
      const [sx, sy] = toScreen(u.x + (Math.random() - 0.5) * 6, u.y + (Math.random() - 0.5) * 6, u.z + MID[u.kind]);
      this.fx.sparks(sx, sy, 3);
    }
    if (this.net === 'client') return;
    const price = TECH.find((t) => t.unit === u.kind)?.cost ?? 500;
    const add = Math.min(DEPOT_RATE * dt, 1 - u.hp);
    const pay = add * price * DEPOT_COST;
    const e = this.eco[b.f];
    if (e.credits < pay) return;
    e.credits -= pay;
    u.hp += add;
  }

  // Rounds leave the muzzles (a flash at each) for t.
  private shoot(src: Unit | Building, w: Weapon, t: Target, from: [number, number, number][]): void {
    this.gunSound(isB(src) ? (src.kind as DefenseKind) : src.kind, from[0], from.length);
    for (const m of from) {
      const [sx, sy] = toScreen(...m);
      if (w.shot !== 'grenade' && w.shot !== 'beam') this.fx.muzzle(sx, sy, w.shot !== 'bullet');
      let aim = this.aimPoint(m[0], m[1], t);
      let track: Shot['track'];
      if (w.shot === 'missile') {
        // smoke billows round the launcher as the rocket goes
        this.fx.dust(sx, sy + 4, 10);
        this.fx.muzzle(sx + (Math.random() - 0.5) * 4, sy + 3, true);
      }
      if (w.shot === 'arc' || w.shot === 'grenade' || w.shot === 'missile') {
        // a shell lobbed at where the target is now, landing near it
        const sc = w.scatter ?? 0;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * sc;
        const ax = aim[0] + Math.cos(ang) * r;
        const ay = aim[1] + Math.sin(ang) * r;
        aim = [ax, ay, isB(t) ? 2 : this.terrain.elev(ax, ay)];
      } else {
        // each round lands somewhere on it, not always dead center
        const ang = Math.random() * Math.PI * 2;
        let ox: number, oy: number, oz: number;
        if (isB(t)) {
          ox = (Math.random() - 0.5) * t.art.rx * 0.9;
          oy = (Math.random() - 0.5) * t.art.ry * 0.9;
          oz = Math.random() * 6 - 2;
        } else {
          const r = Math.sqrt(Math.random()) * HIT_SPREAD[t.kind];
          ox = Math.cos(ang) * r;
          oy = Math.sin(ang) * r;
          oz = (Math.random() - 0.5) * MID[t.kind] * 0.8;
        }
        track = () => {
          if (t.dead) return null;
          const p = this.aimPoint(m[0], m[1], t);
          return [p[0] + ox, p[1] + oy, w.shot === 'torpedo' ? 0 : Math.max(p[2] - 6, p[2] + oz)];
        };
        aim = track()!;
      }
      const shot = makeShot(w.shot, m, aim, w.speed, (s) => this.impact(s, w, t, src), track);
      if (w.shot === 'missile') shot.color = css(FACTIONS[src.f].main);
      this.fx.fire(shot);
      if (w.shot === 'beam') {
        const [ex, ey] = toScreen(...aim);
        this.fx.beam(sx, sy, ex, ey, w.dmg > 120 ? 1.5 : 1);
      }
      // a lobbed shell whistles down the last moment or so of its flight
      if (w.shot === 'arc' || w.shot === 'missile') this.sound(aim[0], aim[1], 'shell_whistle', 1, { delay: Math.max(0, shot.dur - 1.2), rate: w.shot === 'missile' ? 0.75 : 1.1 }, aim[2]);
    }
  }

  // The sound of a gun going off: kind is who is firing, at muzzle m, with n barrels.
  private gunSound(kind: Kind | DefenseKind, m: [number, number, number], n: number): void {
    const [x, y, z] = m;
    const twin = (s: Sfx, rate: number, vol = 1) => {
      this.sound(x, y, s, vol, { rate }, z);
      if (n > 1) this.sound(x, y, s, vol * 0.8, { rate: rate * 0.97, delay: 0.05 }, z);
    };
    switch (kind) {
      case 'inf':
        return twin('rifle_shot', 1);
      case 'cmdo':
        // a quick double tap from each pistol
        for (let i = 0; i < 2; i++) this.sound(x, y, 'rifle_shot', 0.75, { rate: 1.55, delay: i * 0.09 }, z);
        return;
      case 'flamer':
        return this.sound(x, y, 'flame_burst', 0.9, { rate: 1.05 }, z);
      case 'dog':
        return this.sound(x, y, 'dog_attack', 1, {}, z);
      case 'buggy':
      case 'apc':
        // a machine gun: three quick rounds
        for (let i = 0; i < 3; i++) this.sound(x, y, 'rifle_shot', 0.7, { rate: 1.35, delay: i * 0.07 }, z);
        return;
      case 'light':
        return twin('cannon_shot', 1);
      case 'heavy':
        return twin('cannon_shot', 0.8, 1.1);
      case 'tower':
        return twin('cannon_shot', 0.92);
      case 'pillbox':
        // a heavy machine gun: four quick rounds
        for (let i = 0; i < 4; i++) this.sound(x, y, 'rifle_shot', 0.75, { rate: 1.2, delay: i * 0.06 }, z);
        return;
      case 'scorch':
        return this.sound(x, y, 'flame_burst', 1, { rate: 0.85 }, z);
      case 'lumen':
      case 'prism':
        return this.sound(x, y, 'beam_fire', 1, { rate: kind === 'prism' ? 0.9 : 1.05 }, z);
      case 'aa':
      case 'skyguard':
        return twin('rocket_launch', 1.3, 0.9);
      case 'boat':
        return twin('cannon_shot', 1.2, 0.8);
      case 'destroyer':
        return twin('cannon_shot', 0.7, 1.1);
      case 'cruiser':
        return twin('rocket_launch', 0.9, 1);
      case 'carrier':
        return twin('rocket_launch', 1.6, 0.5);
      case 'sub':
        return this.sound(x, y, 'rocket_launch', 0.6, { rate: 0.55 }, z);
      case 'arty':
        return twin('howitzer_shot', 1);
      case 'comet':
        // a deep roar as the big rocket lifts off its rail
        this.sound(x, y, 'rocket_launch', 1.2, { rate: 0.5 }, z);
        return this.sound(x, y, 'howitzer_shot', 0.6, { rate: 0.7, delay: 0.04 }, z);
      case 'rocket':
        return twin('rocket_launch', 1);
      case 'heli':
        return twin('rocket_launch', 1.15, 0.8);
    }
  }

  private impact(s: Shot, w: Weapon, t: Target, src: Unit | Building): void {
    const [sx, sy] = toScreen(s.x, s.y, s.z);
    if (w.splash) {
      // a shell bursting: everything of the other side near it is hit, less further out
      const nade = w.shot === 'grenade';
      if (w.shot === 'flame') this.fx.scorch(sx, sy, w.splash * 0.7);
      else if (w.shot === 'beam') this.fx.boom(sx, sy, 3);
      else if (w.shot === 'missile') {
        // the Comet's rocket: one huge blast, a ring of smaller ones, the ground shaking
        this.fx.boom(sx, sy, 14);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.random();
          this.fx.boom(sx + Math.cos(a) * 9, sy + Math.sin(a) * 4.5, 5 + Math.random() * 3, 0.08 + i * 0.05);
        }
        this.fx.dust(sx, sy, 14);
        this.fx.scorch(sx, sy, 9);
        this.quake(sx, sy, 2.4);
        this.sound(s.x, s.y, 'explosion_large', 1, { rate: 0.75 }, s.z);
      } else {
        this.fx.boom(sx, sy, nade ? 4 : 6);
        if (nade) this.fx.dust(sx, sy, 6);
        this.sound(s.x, s.y, nade ? 'explosion_small' : 'explosion_large', nade ? 0.9 : 0.8, nade ? { rate: 0.9 + Math.random() * 0.2 } : {}, s.z);
      }
      const R = w.splash;
      for (const o of [...this.units]) {
        if (o.f === src.f || isAir(o.kind) || o.dead) continue;
        const d = this.reach(s.x, s.y, o);
        if (d >= R) continue;
        this.shove(o, knockback(w, o.kind, 1 - d / R), o.x - s.x, o.y - s.y);
        this.damage(o, w.dmg * versus(w, UNIT_DEF[o.kind].armor) * (1 - (d / R) * 0.6), src);
      }
      for (const b of [...this.buildings]) {
        if (b.f === src.f || b.dead) continue;
        const d = this.reach(s.x, s.y, b);
        if (d < R) this.damage(b, w.dmg * versus(w, BUILDING_DEF[b.kind].armor) * (1 - (d / R) * 0.6), src);
      }
      return;
    }
    const soft = !isB(t) && UNIT_DEF[t.kind].armor === 'none';
    if (w.shot === 'bullet' || w.shot === 'bite') {
      if (soft) this.fx.dust(sx, sy);
      else this.fx.sparks(sx, sy, 4);
      if (!soft) this.sound(s.x, s.y, 'bullet_hit', 0.8, { rate: 0.9 + Math.random() * 0.4 }, s.z);
    } else if (w.shot === 'beam') {
      this.fx.boom(sx, sy, 2.5);
    } else {
      this.fx.boom(sx, sy, w.shot === 'rocket' ? 3.5 : 3);
      this.fx.sparks(sx, sy, 6);
      this.sound(s.x, s.y, 'explosion_small', 0.6, { rate: w.big ? 0.85 : 1.1 }, s.z);
    }
    if (t.dead) return;
    if (!isB(t)) this.shove(t, knockback(w, t.kind), s.x1 - s.x0, s.y1 - s.y0);
    const arm = isB(t) ? structDef(t).armor : UNIT_DEF[t.kind].armor;
    this.damage(t, w.dmg * versus(w, arm), src);
  }

  // Knock u back by d world units along (dx, dy), on top of any knock it is already taking.
  private shove(u: Unit, d: number, dx: number, dy: number): void {
    const n = Math.hypot(dx, dy);
    if (d <= 0 || n < 1e-6) return;
    const [kx, ky] = u.knock ?? [0, 0];
    u.knock = [kx + (dx / n) * d, ky + (dy / n) * d];
  }

  // The screen shakes when something big is destroyed: a shake of s map
  // pixels at screen point (x, y), felt less the further it is from the
  // middle of the view (see shake()).
  private quakes: { x: number; y: number; s: number; t: number }[] = [];
  private quake(x: number, y: number, s: number): void {
    this.quakes.push({ x, y, s, t: 0 });
  }

  // How far to shake the view this frame, in map pixels: the shakes going
  // on, each strongest in the middle of the view and gone a little way off
  // its edge, so one somewhere else on the map isn't felt at all.
  shake(): [number, number] {
    const v = this.view;
    const cx = (v.x0 + v.x1) / 2;
    const cy = (v.y0 + v.y1) / 2;
    const half = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) / 2 || 1;
    let amp = 0;
    for (const q of this.quakes) {
      const [qx, qy] = nearestCopy(cx, cy, q.x, q.y, this.w, this.h);
      const d = Math.hypot(qx - cx, qy - cy) / half;
      const near = Math.max(0, Math.min(1, (1.2 - d) / 0.8));
      amp += q.s * near * (1 - q.t / QUAKE_S) ** 2;
    }
    if (amp < 0.05) return [0, 0];
    amp = Math.min(amp, 4);
    const t = this.time;
    return [amp * (Math.sin(t * 71) * 0.6 + Math.sin(t * 43 + 1.3) * 0.4), amp * 0.7 * (Math.sin(t * 59 + 2.1) * 0.6 + Math.sin(t * 37 + 0.4) * 0.4)];
  }

  private damage(t: Target, amt: number, src?: Unit | Building): void {
    if (t.dead) return;
    // a surfaced submarine that is hit has to stay up longer
    if (!isB(t) && t.kind === 'sub' && !this.under(t)) t.upT = this.time;
    if (!isB(t) && t.digK !== undefined && t.digK >= 1) amt *= DUG_ARMOR; // behind its sandbags
    if (t.f === this.me || src?.f === this.me) this.fightT = this.time;
    // on a player's screen a hit only shows: the host keeps the score
    if (this.net === 'client') {
      t.hitT = this.time;
      if (!isB(t) || amt >= 12) t.flashT = this.time;
      if (t.f === this.me && src && isB(t)) announce('base_under_attack');
      return;
    }
    const max = isB(t) ? structDef(t).strength : UNIT_DEF[t.kind].strength;
    t.hp = Math.max(0, t.hp - amt / max);
    t.hitT = this.time;
    // a flash of light where a big round lands (buildings shrug off bullets)
    if (!isB(t) || amt >= 12) t.flashT = this.time;
    if (t.hp <= 0) {
      if (isBridge(t)) this.breakBridge(t);
      else if (isB(t)) this.raze(t);
      else this.kill(t);
      return;
    }
    if (isBridge(t)) {
      // (its broken look, ready for when it falls)
      if (t.hp < 0.6) void this.bridgeReady(t, true, false);
      return;
    }
    if (t.f === this.me && src) {
      if (isB(t)) announce('base_under_attack');
      else if (t.kind === 'hauler') announce('harvester_under_attack');
    }
    if (!src || src.dead) return;
    // it fights back, and its friends nearby come to help
    if (!isB(t)) this.retaliate(t, src);
    for (const o of this.units) if (o.f === t.f && o !== t && this.reach(o.x, o.y, t) < HELP) this.retaliate(o, src);
  }

  private retaliate(u: Unit, src: Unit | Building): void {
    if (u.target || u.moving || u.deploy || u.job || !this.canHit(WEAPON[u.kind], src)) return;
    // (the Commando only goes to blow up a building when told to)
    if (isB(src) && WEAPON[u.kind]?.c4) return;
    u.target = src;
    u.chase = true;
    u.forced = false;
    u.anchor = [u.x, u.y];
    u.repath = 0;
  }

  // ---------- Engineers ----------

  // An Engineer on its way to mend something: when it gets there it goes in
  // and mends it, and is used up. It gives up if the thing is gone or no
  // longer needs it, or after stopping short of it a few times.
  private fixing(u: Unit): void {
    const t: Bridge | Building | undefined = this.bridges.find((o) => o.id === u.fix) ?? this.buildings.find((o) => o.id === u.fix && (o.f === u.f || this.capturable(o, u.f)) && !o.dead);
    const stop = () => {
      u.fix = undefined;
      if (u.moving) {
        u.moving = false;
        u.tx = u.x;
        u.ty = u.y;
      }
    };
    const take = !!t && !isBridge(t) && this.capturable(t, u.f);
    if (!t || (!t.dead && t.hp >= 1 && !take) || (!isBridge(t) && t.packing)) return stop();
    const [px, py] = this.fixPoint(u, t);
    let there: boolean;
    if (isBridge(t)) there = t.huts.some(([hx, hy]) => {
      const [nx, ny] = this.nearPoint(u.x, u.y, hx, hy);
      return Math.hypot(nx - u.x, ny - u.y) < HUT_R + 7;
    });
    else {
      const [cx, cy] = this.nearPoint(u.x, u.y, t.x, t.y);
      there = Math.abs(u.x - cx) <= t.art.rx + 6 && Math.abs(u.y - cy) <= t.art.ry + 6;
    }
    if (there) return this.mend(u, t);
    if (!u.moving) {
      if ((u.fixTry = (u.fixTry ?? 0) + 1) > 3) return stop();
    }
    if (!u.moving || Math.hypot(u.tx - px, u.ty - py) > 3) {
      u.tx = px;
      u.ty = py;
      u.moving = true;
    }
  }

  // Engineer u goes into t and mends it: a bridge stands again whole, a
  // building is back to full strength. The Engineer is used up.
  private mend(u: Unit, t: Bridge | Building): void {
    this.units.splice(this.units.indexOf(u), 1);
    this.gone.push([u.id, GONE_QUIET]);
    const was = u.sel;
    u.sel = false;
    u.grp = undefined;
    u.fix = undefined;
    if (this.lastTap?.u === u) this.lastTap = null;
    if (isBridge(t)) {
      this.mendBridge(t);
      if (u.f === this.me) this.notice('Bridge repaired');
    } else if (this.capturable(t, u.f)) this.capture(t, u.f);
    else {
      t.hp = 1;
      const [sx, sy] = toScreen(t.x, t.y, 8);
      for (let i = 0; i < 5; i++) this.fx.dust(sx + (Math.random() - 0.5) * t.art.rx * 1.6, sy + (Math.random() - 0.5) * 8, 4);
      this.sound(t.x, t.y, 'build_place', 0.8, { rate: 1.2 });
      if (u.f === this.me) this.notice('Building repaired');
    }
    this.sound(u.x, u.y, 'build_place', 0.4, { rate: 1.6 }, u.z);
    this.mapVersion++;
    if (was) this.emit();
  }

  // ---------- Tech buildings ----------

  // Side f takes tech building b (an Engineer went in): it turns their color,
  // pays them a bonus at once and from then on a steady income (see update),
  // neither of which needs room in their silos. Whoever held it before loses it.
  private capture(b: Building, f: number): void {
    const was = b.f;
    b.f = f;
    this.recolor(b);
    b.fixing = false;
    b.target = undefined;
    if (b.sel && f !== this.me) {
      b.sel = false;
      this.emit();
    }
    const e = this.eco[f];
    e.credits += DERRICK.bonus;
    const [sx, sy] = toScreen(b.x, b.y, 8);
    for (let i = 0; i < 6; i++) this.fx.dust(sx + (Math.random() - 0.5) * b.art.rx * 1.6, sy + (Math.random() - 0.5) * 8, 4);
    this.sound(b.x, b.y, 'build_place', 0.9, { rate: 0.9 });
    this.tell(f, `Tech building captured: +$${DERRICK.bonus}, then $${DERRICK.rate} a second`, 'tech_captured');
    if (was >= 0) this.tell(was, 'Tech building lost', 'building_lost');
    this.mapVersion++;
  }

  // Building b in its (new) side's colors: drawn by a worker, keeping the old
  // look for the moment that takes rather than stalling a frame.
  private recolor(b: Building): void {
    const f = b.f;
    const key = `${b.kind}-${f}`;
    const have = this.bArt.get(key);
    if (have) {
      b.art = have;
      return;
    }
    void this.artLater(b.kind, f, true).then(() => {
      if (b.f === f) b.art = this.bArt.get(key) ?? b.art;
    });
  }

  // A tech building's moving parts (the pumpjack), side by side's color:
  // drawn a picture at a time as they are first wanted, so a capture doesn't
  // stall a frame.
  private pumpArt = new Map<number, StackSprite[]>();
  private pumpFrame(f: number, k: number): StackSprite | null {
    let set = this.pumpArt.get(f);
    if (!set) this.pumpArt.set(f, (set = []));
    if (set.length < PUMP_FRAMES) set.push(makePumpBeam(factionOf(f), set.length));
    return set[Math.min(k, set.length - 1)] ?? null;
  }

  // ---------- Transports ----------

  // A soldier on its way to a transport: it follows it, and gets in when it
  // is close (or gives up if the transport is gone or full, or it can't get there).
  private boarding(u: Unit): void {
    const t = this.units.find((o) => o.id === u.board && !o.dead);
    if (!t || t.f !== u.f || !hasRoom(t, u) || t.unloading) {
      u.board = undefined;
      if (u.moving) {
        u.moving = false;
        u.tx = u.x;
        u.ty = u.y;
      }
      return;
    }
    const [tx, ty] = this.nearPoint(u.x, u.y, t.x, t.y);
    const reach = UNIT[t.kind].r + 4 + (RIDERS.has(u.kind) ? 0 : UNIT[u.kind].r);
    if (Math.hypot(tx - u.x, ty - u.y) < reach) return this.embark(u, t);
    if (!u.moving) {
      // it stopped short (a dead end): try again a few times, then give up
      if ((u.boardTry = (u.boardTry ?? 0) + 1) > 3) {
        u.board = undefined;
        return;
      }
    }
    if (!u.moving || Math.hypot(u.tx - tx, u.ty - ty) > 3) {
      u.tx = tx;
      u.ty = ty;
      u.moving = true;
    }
  }

  // u climbs into transport t: it is out of play until it is let out.
  private embark(u: Unit, t: Unit): void {
    this.units.splice(this.units.indexOf(u), 1);
    this.gone.push([u.id, GONE_QUIET]);
    const was = u.sel;
    u.sel = false;
    u.grp = undefined;
    u.board = u.target = u.dest = u.aim = u.path = u.goal = u.knock = undefined;
    u.home = u.pace = u.anchor = undefined;
    u.moving = u.forced = u.chase = u.dug = false;
    u.digK = undefined;
    (t.cargo ??= []).push(u);
    if (this.lastTap?.u === u) this.lastTap = null;
    this.sound(t.x, t.y, 'build_place', 0.4, { rate: 1.5 }, t.z);
    this.mapVersion++;
    if (was) this.emit();
  }

  // A transport letting its soldiers out: one at a time down the ramp at
  // the back, each walking a few steps clear of it, fanned out behind.
  private letOut(t: Unit, dt: number): void {
    const cargo = t.cargo ?? [];
    if (!cargo.length) {
      t.unloading = false;
      return;
    }
    if ((t.exitT = (t.exitT ?? 0) - dt) > 0) return;
    const s = cargo.shift()!;
    const big = !RIDERS.has(s.kind);
    // a vehicle takes longer to drive off than a soldier takes to hop out
    t.exitT = big ? EXIT_S * 4 : EXIT_S;
    const i = (t.exitN = (t.exitN ?? -1) + 1);
    const back = t.a + Math.PI;
    // the ramp, or the middle of it if the back is up against water or a cliff
    let [rx, ry] = [t.x + Math.cos(back) * 9, t.y + Math.sin(back) * 9];
    if (!this.okAt(s, rx, ry)) [rx, ry] = [t.x, t.y];
    // where it walks to: a fan behind, or anywhere round it that is open
    let spot: [number, number] = [rx, ry];
    const fan = [0, -0.55, 0.55, -1.1, 1.1][i % 5];
    for (const k of [0, 0.9, -0.9, 1.8, -1.8, 2.7, -2.7, Math.PI]) {
      const a = back + fan + k;
      const d = big ? 26 + UNIT[s.kind].r * 1.5 : 18 + (i % 2) * 4;
      const p: [number, number] = [t.x + Math.cos(a) * d, t.y + Math.sin(a) * d];
      if (this.okAt(s, ...p) && clearLine((x, y) => this.okAt(s, x, y), rx, ry, ...p)) {
        spot = p;
        break;
      }
    }
    Object.assign(s, { x: rx, y: ry, z: t.z, a: back + fan, lap: t.lap, lapY: t.lapY, dead: false, sel: false });
    [s.tx, s.ty] = spot;
    s.moving = true;
    s.goal = s.path = s.best = s.slide = undefined;
    s.stuck = s.slideT = 0;
    this.units.push(s);
    this.sound(t.x, t.y, 'unit_exit', 0.5, { rate: 1.3 }, t.z);
    this.mapVersion++;
    if (!cargo.length) t.unloading = false;
  }

  // A transport is destroyed: about half of its soldiers scramble out, hurt.
  private bailOut(t: Unit): void {
    for (const s of t.cargo ?? []) {
      if (Math.random() < 0.5) continue;
      const a = Math.random() * Math.PI * 2;
      const [x, y] = this.fold(t.x + Math.cos(a) * 4, t.y + Math.sin(a) * 4);
      if (!this.okAt(s, x, y)) continue;
      Object.assign(s, { x, y, z: t.z, a, lap: t.lap, lapY: t.lapY, dead: false, sel: false });
      s.hp = Math.max(0.08, s.hp * (0.2 + Math.random() * 0.25));
      const go = 12 + Math.random() * 8;
      [s.tx, s.ty] = this.nearPoint(x, y, x + Math.cos(a) * go, y + Math.sin(a) * go);
      s.moving = true;
      s.goal = s.path = undefined;
      this.units.push(s);
    }
    t.cargo = [];
    this.mapVersion++;
  }

  // A unit is destroyed: it blows up and flies to pieces, which land round
  // where it was and fade away (a copter's rain down from the sky).
  // (drowned: it went down with a bridge, so nobody gets out)
  private kill(u: Unit, drowned = false): void {
    u.dead = true;
    this.units.splice(this.units.indexOf(u), 1);
    // a carrier going down takes the jets sitting on its deck with it
    // (those in the air look for somewhere else to land)
    if (u.kind === 'carrier' && this.net !== 'client')
      for (const j of [...this.units])
        if (j.deck === u.id) {
          if ((j.fly ?? 0) < 0.5) this.kill(j, true);
          else j.deck = j.dop = j.dl = j.dpath = undefined;
        }
    this.gone.push([u.id, GONE_KILL]);
    if (u.f === this.me) announce('unit_lost');
    if (this.lastTap?.u === u) this.lastTap = null;
    const air = this.alt(u);
    const [sx, sy] = toScreen(u.x, u.y, u.z + air + MID[u.kind] * 0.5);
    const [, gy] = toScreen(u.x, u.y, u.z);
    this.fx.wreck(
      u.kind,
      this.layers(u).map(([spr, x, y, z]) => [spr, ...toScreen(x, y, z)]),
      sx,
      sy,
      gy,
    );
    const q = QUAKE[u.kind];
    if (q) this.quake(sx, sy, q);
    this.deathSound(u, air);
    if (!isFoot(u.kind)) {
      const r = BOOM[u.kind] ?? 6;
      // the blast hurts whatever is close by, on either side
      if (!isAir(u.kind)) this.blast(u.x, u.y, 0, 0, CELL * (1 + r / 12), 18 + r * 1.5);
      // the wreck burns where it stood (a copter falls and burns too; a boat sinks)
      if (!isNaval(u.kind) && this.terrain.k(u.x, u.y) !== K.Water) this.burn(u.x, u.y, u.z, r);
      // and a few of the crew crawl out, hurt
      if (!isAir(u.kind) && !isNaval(u.kind) && this.net !== 'client' && !drowned) this.survivors(u);
      // (nobody gets out of a transport shot down in the air)
      if (u.cargo?.length && this.net !== 'client' && !drowned && this.alt(u) < 3) this.bailOut(u);
    }
    if (u.sel) this.emit();
  }

  private deathSound(u: Unit, air: number): void {
    const z = u.z + air;
    if (u.kind === 'dog') return this.sound(u.x, u.y, 'dog_yelp', 1, { rate: 0.95 + Math.random() * 0.1 }, z);
    if (isFoot(u.kind)) return this.sound(u.x, u.y, 'infantry_death', 1, { rate: 0.9 + Math.random() * 0.25 }, z);
    if (u.kind === 'buggy' || u.kind === 'arty' || isAir(u.kind)) {
      this.sound(u.x, u.y, 'explosion_small', 1, { rate: 0.85 }, z);
    } else {
      // tracked armor cooks off in a string of blasts
      this.sound(u.x, u.y, 'explosion_large', 1, {}, z);
      for (let i = 1; i < 3; i++) this.sound(u.x, u.y, 'explosion_small', 0.7, { delay: i * (0.25 + Math.random() * 0.2), rate: 0.8 + Math.random() * 0.3 }, z);
    }
    this.sound(u.x, u.y, 'debris', 0.8, { delay: 0.35 }, z);
  }

  // An explosion at world point (x, y) hurts everything on the ground within
  // R world units of it (or of the box rx by ry round it), on any side, less
  // further out, and knocks soldiers off their feet.
  private blast(x: number, y: number, rx: number, ry: number, R: number, dmg: number): void {
    for (const o of [...this.units]) {
      if (isAir(o.kind) || o.dead) continue;
      const [ox, oy] = this.nearPoint(x, y, o.x, o.y);
      const d = Math.hypot(Math.max(0, Math.abs(ox - x) - rx), Math.max(0, Math.abs(oy - y) - ry));
      if (d >= R) continue;
      const k = 1 - d / R;
      if (isFoot(o.kind)) this.shove(o, 5 * k, ox - x, oy - y);
      this.damage(o, dmg * VERSUS.HE[UNIT_DEF[o.kind].armor] * (1 - (d / R) * 0.6));
    }
  }

  // A wreck on fire at world point (x, y), its blast r map pixels across.
  private burn(x: number, y: number, z: number, r: number): void {
    const n = 2 + Math.round(r / 4);
    const w = 1.5 + r * 0.3;
    const flames: Fire['flames'] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i ? Math.sqrt(Math.random()) * w : 0;
      // the middle burns tallest and longest
      flames.push([Math.cos(a) * d, Math.sin(a) * d, (i ? 3 + Math.random() * 2 : 5) + r * 0.12, BURN_WRECK * (i ? 0.5 + Math.random() * 0.5 : 1)]);
    }
    flames.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    this.fires.push({ x, y, z, t: 0, w, flames });
  }

  // 0 to 2 soldiers crawl out of a destroyed vehicle, badly hurt, and stagger
  // a little way off from it.
  private survivors(u: Unit): void {
    const n = Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const [x, y] = this.fold(u.x + Math.cos(a) * 3, u.y + Math.sin(a) * 3);
      // not into water, nor up or down a cliff
      if (this.terrain.k(x, y) === K.Water || this.terrain.elev(x, y) !== u.z) continue;
      const s = this.newUnit('inf', u.f, x, y, a);
      s.hp = 0.12 + Math.random() * 0.23;
      const go = 10 + Math.random() * 8;
      [s.tx, s.ty] = this.nearPoint(s.x, s.y, s.x + Math.cos(a) * go, s.y + Math.sin(a) * go);
      s.moving = true;
    }
    if (n) this.mapVersion++;
  }

  private updateFires(dt: number): void {
    for (const f of this.fires) {
      f.t += dt;
      for (const [dx, dy, h, end] of f.flames) {
        const k = 1 - f.t / end;
        if (k <= 0) continue;
        // smoke and the odd ember off each flame, less as it dies down
        if (Math.random() < dt * 3 * k) {
          const [sx, sy] = toScreen(f.x + dx, f.y + dy, f.z + h * 0.8);
          this.fx.smoke(sx, sy, true, 1.2 + h * 0.3 * k);
        }
        if (Math.random() < dt * 1.5 * k) this.fx.ember(...toScreen(f.x + dx, f.y + dy, f.z + h * 0.6));
      }
    }
    // (the scorch mark fades for a few seconds after the last flame)
    this.fires = this.fires.filter((f) => f.t < BURN_WRECK + 6);
  }

  private drawFire(f: Fire, i: number): void {
    const c = this.ctx;
    const [sx, sy] = toScreen(f.x, f.y, f.z);
    // a scorch mark on the ground
    const a = 0.45 * Math.min(1, (BURN_WRECK + 6 - f.t) / 6);
    c.fillStyle = `rgba(20,16,12,${a})`;
    c.beginPath();
    c.ellipse(sx, sy, f.w * 1.7 + 1.5, f.w * 0.85 + 0.8, 0, 0, Math.PI * 2);
    c.fill();
    for (const [j, [dx, dy, h, end]] of f.flames.entries()) {
      const k = 1 - f.t / end;
      if (k <= 0) continue;
      // it flares up, then dies down with a flicker
      const flare = Math.min(1, f.t * 4) * k ** 0.6 * (0.85 + 0.15 * Math.sin(this.time * 9 + j * 2.3));
      const [fx, fy] = toScreen(f.x + dx, f.y + dy, f.z);
      drawFlame(c, fx, fy, Math.max(0.8, h * flare), this.time + j * 0.37, i * 7 + j);
    }
  }

  // The sprites a unit is drawn with, and where (world point and height).
  private layers(u: Unit): [StackSprite, number, number, number][] {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    switch (u.kind) {
      case 'inf':
      case 'rocket':
      case 'gren':
      case 'eng':
      case 'dog':
      case 'cmdo':
      case 'flamer':
        return [[this.footSprite(u), u.x, u.y, u.z + this.alt(u) - (this.swimming(u) ? SWIM_DROP : 0)]];
      case 'light':
      case 'heavy':
      case 'scorch':
      case 'lumen':
      case 'skyguard': {
        const [hull, tur] = tankParts(art, u.kind);
        return [
          [hull[di], u.x, u.y, u.z],
          [tur[dirIndex(u.turret, DIRS)], u.x - Math.cos(u.a) * 1.2, u.y - Math.sin(u.a) * 1.2, u.z],
        ];
      }
      case 'heli':
        return [[art.heli[di], u.x, u.y, u.z + HELI_ALT]];
      case 'heron':
      case 'jet':
      case 'plane':
        return [[art[u.kind][di], u.x, u.y, u.z + this.alt(u)]];
      case 'cruiser':
        return cruiserParts(art, u.x, u.y, 0, u.a, u.turret);
      case 'boat':
      case 'destroyer':
      case 'carrier':
      case 'sub':
        return [[art[u.kind][di], u.x, u.y, 0]];
      case 'otter':
        return [[art.otter[di], u.x, u.y, u.z]];
      case 'hauler':
        return [[this.haulerSprite(u, di), u.x, u.y, u.z]];
      case 'comet':
        return [[this.cometSprites(u)[di], u.x, u.y, u.z]];
      default:
        return [[{ mcv: art.mcv, buggy: art.buggy, apc: art.apc, hauler: art.hauler, arty: art.artillery }[u.kind][di], u.x, u.y, u.z]];
    }
  }

  // A building is destroyed: it goes up in a string of explosions and leaves a ruin.
  private raze(b: Building): void {
    b.dead = true;
    this.buildings.splice(this.buildings.indexOf(b), 1);
    const { rx, ry } = b.art;
    // a power plant goes up far bigger than anything else
    const power = b.kind === 'power';
    const n = (power ? 12 : 6) + Math.round((rx + ry) / 5);
    for (let i = 0; i < n; i++) {
      const [sx, sy] = toScreen(b.x + (Math.random() * 2 - 1) * rx * 0.8, b.y + (Math.random() * 2 - 1) * ry * 0.8, 2 + Math.random() * 12);
      this.fx.boom(sx, sy, 6 + Math.random() * 6, i * (power ? 0.06 : 0.1));
    }
    const [cx, cy] = toScreen(b.x, b.y, 8);
    this.fx.boom(cx, cy, (rx + ry) * 0.7, 0.4);
    if (power) {
      // the cooling towers go: one huge fireball, then more bursting round it
      this.fx.boom(cx, cy - 4, (rx + ry) * 1.3, 0.45);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const [sx, sy] = toScreen(b.x + Math.cos(a) * rx * 1.3, b.y + Math.sin(a) * ry * 1.3, 4 + Math.random() * 10);
        this.fx.boom(sx, sy, 10 + Math.random() * 6, 0.6 + Math.random() * 0.5);
      }
    }
    this.quake(cx, cy, buildingQuake(rx, ry) * (power ? 1 : 0.6));
    for (let i = 0; i < (power ? 4 : 3); i++) this.sound(b.x, b.y, i ? 'explosion_small' : 'explosion_large', 1, { delay: i * 0.12, rate: 0.75 + Math.random() * 0.3 }, 8);
    const states = this.states(b.kind, b.f);
    // fires over the ruin: on its smoking spots and scattered across it
    const ruin = states.ruin;
    const spots: [number, number, number][] = ruin.fx.map((p) => [p.x, p.y, p.z]);
    const more = 4 + Math.round((ruin.rx + ruin.ry) / 5);
    for (let i = 0; i < more; i++) spots.push([(Math.random() * 2 - 1) * ruin.rx * 0.7, (Math.random() * 2 - 1) * ruin.ry * 0.7, 1 + Math.random() * 2]);
    const flames: Ruin['flames'] = spots.map(([x, y, z], i) => [x, y, z, (i < ruin.fx.length ? 7 : 4 + Math.random() * 3) * (power ? 1.3 : 1), BURN_RUIN * (0.55 + Math.random() * 0.45)]);
    flames.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    this.ruins.push({ kind: b.kind, f: b.f, x: b.x, y: b.y, states, t: -0.45, flames });
    if (b.f === this.me) {
      this.notice(`${BNAME[b.kind]} destroyed`);
      announce('building_lost');
    }
    this.gone.push([b.id, GONE_RAZE]);
    this.mapVersion++;
    if (b.sel) this.emit();
  }

  private updateRuins(dt: number): void {
    for (const r of this.ruins) {
      const was = r.t;
      r.t += dt;
      if (was < 0 && r.t >= 0) {
        // the big bang: the building flies to pieces over the ruin
        const [sx, sy] = toScreen(r.x, r.y, 0);
        const [ox, oy] = toScreen(r.x, r.y, 10);
        const { rx, ry } = r.states.damaged;
        const power = r.kind === 'power';
        this.fx.collapse(r.states.damaged.spr, sx, sy, ox, oy, rx + ry, (rx + ry) * 0.5, power ? 2.2 : 1);
        this.quake(ox, oy, power ? 4 : buildingQuake(rx, ry));
        this.sound(r.x, r.y, 'explosion_large', 1, { rate: power ? 0.7 : 0.85 }, 8);
        this.sound(r.x, r.y, 'building_collapse', 1, { delay: 0.1, rate: power ? 0.85 : 1 });
        // the blast hurts whatever is close by, on either side
        this.blast(r.x, r.y, rx, ry, power ? 3.5 * CELL : 1.6 * CELL, power ? 90 : 35);
      }
      // smoke pours off it for a while, thins out and stops (the ruin stays)
      const rate = r.t < BURN_RUIN ? 7 : 7 * Math.max(0, 1 - (r.t - BURN_RUIN) / 20);
      if (r.t > 0 && rate > 0)
        for (const p of r.states.ruin.fx)
          if (Math.random() < (dt * rate) / 2) {
            const [sx, sy] = toScreen(r.x + p.x, r.y + p.y, p.z + 1);
            this.fx.smoke(sx, sy, true, 2.6 + Math.random());
          }
    }
  }

  // An ore field's generator.
  private drawOreGen(g: OreGen<OreNode>): void {
    this.blit(this.oreGenArt, g.x, g.y, 0);
  }

  private drawRuin(r: Ruin): void {
    if (r.t < 0) {
      // still going up in smoke: the damaged building until the big bang
      this.blit(r.states.damaged.spr, r.x, r.y, 0);
      return;
    }
    this.blit(r.states.ruin.spr, r.x, r.y, 0);
    for (const [i, [x, y, z, h, end]] of r.flames.entries()) {
      const k = 1 - r.t / end;
      if (k <= 0) continue;
      const flare = k ** 0.5 * (0.85 + 0.15 * Math.sin(this.time * 8 + i * 1.7));
      const [sx, sy] = toScreen(r.x + x, r.y + y, z);
      drawFlame(this.ctx, sx, sy, Math.max(0.8, h * flare), this.time + i * 0.41, i + 3);
    }
  }

  // ---------- Rendering ----------

  private blit(spr: StackSprite, wx: number, wy: number, z: number, shadowOnly = false): void {
    const [sx, sy] = toScreen(wx, wy, z);
    const c = shadowOnly ? spr.shadow : spr.img;
    if (!c) return;
    drawSprite(this.ctx, c, spr, sx, sy);
    if (this.lit && !shadowOnly) {
      // just hit: a flash of light over it
      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.lit;
      drawSprite(ctx, c, spr, sx, sy);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (this.aimed && !shadowOnly) {
      // just ordered to attack: a white silhouette over it
      this.ctx.globalAlpha = this.aimed;
      drawSprite(this.ctx, whiteOf(c), spr, sx, sy);
      this.ctx.globalAlpha = 1;
    }
  }
  // the white silhouette's strength while drawing an attack target
  private aimed = 0;
  // Ordered to attack lately: three quick white blinks over 0.6s.
  private aimFlash = (t: { aimT?: number }) => {
    const dt = this.time - (t.aimT ?? -9);
    return dt >= 0 && dt < 0.6 && Math.floor(dt / 0.1) % 2 === 0 ? 0.85 : 0;
  };
  // true while drawing something that has just been hit
  private lit = 0;
  private justHit = (t: { flashT?: number }) => this.time - (t.flashT ?? -9) < 0.07;

  // A tread mark at screen point (x, y), if that bit of ground is painted.
  private stamp(x: number, y: number, style: string): void {
    const t = this.tiles.at(x, y);
    if (!t) return;
    const c = t.canvas.getContext('2d')!;
    c.fillStyle = style;
    const X = Math.round(x * ART);
    const Y = Math.round(y * ART);
    const n = CH * ART;
    c.fillRect(X - Math.floor(X / n) * n, Y - Math.floor(Y / n) * n, 1, 1);
  }

  // The ground for screen rect (x0, y0)-(x1, y1), in unwrapped map pixels,
  // painted a few tiles at a time (`budget` milliseconds each frame).
  renderGround(x0: number, y0: number, x1: number, y1: number, budget: number): void {
    this.view = { x0, y0, x1, y1 };
    this.tiles.begin();
    drawTiles(this.ctx, this.tiles, this.ov, OV, x0, y0, x1, y1, this.time);
    this.gaps = this.tiles.missing;
    this.tiles.pump(budget);
  }
  private gaps = false;
  // Whether the last ground drawn had tiles in it still to be painted.
  groundPending(): boolean {
    return this.gaps;
  }

  private ov: HTMLCanvasElement | null = null;
  // Build the overview a little at a time; true once it is ready.
  mapStep(ms: number): boolean {
    if (!this.ov) {
      this.ov = this.terrain.overview((x, y, c) => this.forestTint(x, y, c), ms);
      // and the sea grid the ships find their way on, made from it
      if (this.ov) this.seaNav();
    }
    return this.ov !== null;
  }
  private forestTint(sx: number, sy: number, c: RGB): RGB {
    const f = (this.forestF.at(sx, sy) - 0.6) * 2.4;
    return f > 0 ? mix(c, [18, 40, 16], Math.min(0.75, 0.25 + f * 0.6)) : c;
  }

  // Everything standing on this copy of the map within screen rect
  // (x0, y0)-(x1, y1), in this copy's coordinates.
  renderObjects(x0: number, y0: number, x1: number, y1: number): void {
    const c = this.ctx;
    const pad = 56;
    const inView = (sx: number, sy: number) => sx > x0 - pad && sx < x1 + pad && sy > y0 - pad && sy < y1 + pad * 1.5;
    const seen = (wx: number, wy: number, z = 0) => {
      const [sx, sy] = toScreen(wx, wy, z);
      return inView(sx, sy);
    };

    for (const s of this.sparkles) {
      const a = Math.sin((s.life / 1.2) * Math.PI);
      c.fillStyle = `rgba(225,242,250,${a * 0.85})`;
      c.fillRect(s.x, s.y, 2, 1);
    }
    for (const p of this.particles) {
      if (p.kind === 'foam') {
        // a patch of foam spreading and fading on the water
        const k = p.life / p.max;
        const r = p.size * (1 + k * 2.5);
        c.fillStyle = `rgba(236,247,250,${0.8 * (1 - k) ** 1.5})`;
        c.fillRect(Math.round(p.x - r), Math.round(p.y - r * 0.5), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r)));
        continue;
      }
      if (p.kind !== 'wake') continue;
      const k = p.life / p.max;
      c.fillStyle = `rgba(225,240,245,${0.75 * (1 - k)})`;
      const r = (1 + k * 7) * p.size;
      c.fillRect(Math.round(p.x - r), Math.round(p.y), 1, 1);
      c.fillRect(Math.round(p.x + r), Math.round(p.y), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y - r * 0.5), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y + r * 0.5), 1, 1);
    }

    // ore fields stain the ground under their nuggets
    c.globalAlpha = 0.9;
    for (const n of this.oreInView(x0 - pad, y0 - pad, x1 + pad, y1 + pad * 1.5))
      if (n.amt >= 10) this.blit(this.oreArt.stain[n.v][n.amt > ORE.node * 0.6 ? 2 : n.amt > ORE.node * 0.25 ? 1 : 0], n.x, n.y, 0);
    c.globalAlpha = 1;

    // where a selected MCU would deploy: a plain tinted box, no outline
    for (const u of this.units) {
      if (!u.sel || u.kind !== 'mcv' || u.f !== this.me || u.deploy || !seen(u.x, u.y)) continue;
      const r = this.siteOf(u.x, u.y);
      this.drawFoot(r, this.siteOk(r) ? '#9dff9d' : '#ff6a5a', 1.5, true, false);
    }

    // aircraft shadows on the ground
    for (const u of this.units) {
      if (!this.aloft(u) || !seen(u.x, u.y)) continue;
      if (!isAir(u.kind)) {
        // a paratrooper's shadow, and his canopy's, darker as he comes down
        const fly = u.fly ?? 0;
        const [sx, sy] = toScreen(u.x, u.y, u.z);
        drawChuteShadow(c, sx + 3 * fly, sy + 1.5 * fly, 1 - fly, chuteInAir((1 - fly) * DROP_S, 0).open);
        c.fillStyle = `rgba(0,0,0,${0.35 - 0.2 * fly})`;
        c.fillRect(Math.round(sx) - 1, Math.round(sy), 2, 1);
        continue;
      }
      const spr = this.art[u.f][u.kind as 'heli' | 'heron' | 'jet' | 'plane'][dirIndex(u.a, DIRS)];
      const k = this.alt(u) / HELI_ALT;
      const [sx, sy] = toScreen(u.x + 4 * k, u.y - 2 * k, u.z);
      if (spr.shadow) drawSprite(c, spr.shadow, spr, sx, sy);
    }

    type Item = { k: number; draw: () => void };
    const items: Item[] = [];
    const tx0 = Math.max(0, Math.floor((x0 - pad) / CH));
    const tx1 = Math.min(this.tiles.nx - 1, Math.floor((x1 + pad) / CH));
    const ty0 = Math.max(0, Math.floor((y0 - pad) / CH));
    const ty1 = Math.min(this.tiles.ny - 1, Math.floor((y1 + pad * 1.5) / CH));
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles.at(tx * CH, ty * CH);
        if (t) for (const p of t.props) if (seen(p.x, p.y, p.z)) items.push({ k: p.x + p.y + p.z * 2, draw: () => this.blit(p.spr, p.x, p.y, p.z) });
      }
    for (const p of this.props) if (seen(p.x, p.y, p.z)) items.push({ k: p.x + p.y + p.z * 2, draw: () => this.blit(p.spr, p.x, p.y, p.z) });
    // bridges: the deck and the far side before anything on it, the near rail after
    for (const b of this.bridges) {
      const ex = b.axis === 0 ? b.L / 2 : 0;
      const ey = b.axis === 0 ? 0 : b.L / 2;
      if (!seen(b.x - ex, b.y - ey) && !seen(b.x + ex, b.y + ey) && !seen(b.x, b.y)) continue;
      // the huts' lamps blink while the bridge wants mending
      const blink = b.hp < 1 && Math.floor(this.time * 2.5) % 2 === 0;
      for (const [hx, hy] of b.huts) items.push({ k: hx + hy, draw: () => this.blit(this.hutArt[blink ? 1 : 0], hx, hy, 0) });
      const pics = this.bridgePics(b);
      if (!pics) continue;
      const [back, front] = pics;
      const k = b.x + b.y;
      const r = b.art.rx + b.art.ry;
      const draw = (spr: StackSprite) => () => {
        this.lit = !b.dead && this.justHit(b) ? 0.55 : 0;
        this.aimed = this.aimFlash(b);
        this.blit(spr, b.x, b.y, 0);
        this.lit = this.aimed = 0;
      };
      items.push({ k: k - r, draw: draw(back) });
      if (front) items.push({ k: k + r, draw: draw(front) });
      if (b.c4 !== undefined && !b.dead) items.push({ k: k + r + 1, draw: () => this.drawCharge(b.x, b.y, BRIDGE_Z[b.style] + 1) });
    }
    const walls = this.wallSet();
    for (const b of this.buildings) if (seen(b.x, b.y, 10)) items.push({ k: b.x + b.y + Math.min(b.art.rx, b.art.ry), draw: () => this.drawBuilding(b, walls) });
    for (const r of this.ruins) if (seen(r.x, r.y, 4)) items.push({ k: r.x + r.y + Math.min(r.states.ruin.rx, r.states.ruin.ry), draw: () => this.drawRuin(r) });
    for (const [i, f] of this.fires.entries()) if (seen(f.x, f.y, f.z)) items.push({ k: f.x + f.y + f.z * 2, draw: () => this.drawFire(f, i) });
    const ore = this.oreInView(x0 - pad, y0 - pad, x1 + pad, y1 + pad * 1.5).filter((n) => n.amt >= 10);
    const oreSize = (n: OreNode) => (n.amt > ORE.node * 0.6 ? 2 : n.amt > ORE.node * 0.25 ? 1 : 0);
    for (const n of ore) {
      const spr = this.oreArt.lumps[n.v][oreSize(n)];
      items.push({ k: n.x + n.y, draw: () => this.blit(spr, n.x, n.y, 0) });
    }
    for (const g of this.oreGens) if (seen(g.x, g.y, 3)) items.push({ k: g.x + g.y, draw: () => this.drawOreGen(g) });
    this.foldChutes();
    for (const p of this.chuteFolds)
      if (seen(p.x, p.y, p.z)) {
        const [sx, sy] = toScreen(p.x, p.y, p.z);
        const fold = (this.time - p.t0) / FOLD_S;
        items.push({ k: p.x + p.y + p.z * 2 + 0.5, draw: () => drawChute(this.ctx, sx, sy, { open: 1, tilt: 0, fold }, factionOf(p.f), this.time) });
      }
    for (const u of this.units) if ((!this.aloft(u) || u.exit) && seen(u.x, u.y, u.z)) items.push({ k: u.exit ? u.exit.k : u.x + u.y + u.z * 2, draw: () => (u.exit ? this.drawExiting(u, u.exit) : this.drawUnit(u)) });
    items.sort((a, b) => a.k - b.k);
    for (const it of items) it.draw();

    for (const p of this.particles) {
      if (p.kind === 'spray') {
        // drops thrown up off the bow
        c.fillStyle = `rgba(238,248,252,${0.85 * (1 - p.life / p.max)})`;
        c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        continue;
      }
      if (p.kind === 'wake' || p.kind === 'foam' || !inView(p.x, p.y)) continue;
      const k = p.life / p.max;
      p.v ??= (Math.random() * 64) | 0;
      drawPuff(c, p.kind, p.x, p.y, p.size * 1.8, (p.kind === 'smoke' ? 0.65 : p.kind === 'soot' ? 0.6 : 0.55) * puffAlpha(k), k * 0.6, p.v);
    }

    this.fx.drawBelow(c);
    for (const u of this.units) if (this.aloft(u) && !u.exit && seen(u.x, u.y, u.z)) this.drawUnit(u);
    this.fx.drawAbove(c);

    for (const s of this.sparks) {
      if (!inView(s.x, s.y)) continue;
      c.fillStyle = s.col ?? (s.life < 0.2 ? '#fff6c8' : '#ffb347');
      c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }

    for (const u of this.units) if (u.sel && seen(u.x, u.y, u.z)) this.drawSelection(u);
    for (const b of this.buildings) if (b.sel && seen(b.x, b.y, 10)) this.drawBuildingSel(b);
    // (for testing, ?blocks in the URL: where each building keeps units out)
    if (SHOW_BLOCKS)
      for (const b of this.buildings) {
        if (!seen(b.x, b.y, 10)) continue;
        const k = buildingBlock(b.kind);
        c.fillStyle = 'rgba(255,60,60,0.35)';
        for (let j = 0; j < k.ny; j++)
          for (let i = 0; i < k.nx; i++) {
            if (!k.solid[j * k.nx + i]) continue;
            const x0 = b.x - k.rx + i * BLOCK_CELL;
            const y0 = b.y - k.ry + j * BLOCK_CELL;
            c.beginPath();
            for (const [px, py] of [[x0, y0], [x0 + BLOCK_CELL, y0], [x0 + BLOCK_CELL, y0 + BLOCK_CELL], [x0, y0 + BLOCK_CELL]]) c.lineTo(...toScreen(px, py));
            c.fill();
          }
      }
    // anything hit lately shows its health for a moment
    for (const u of this.units)
      if (!u.sel && this.time - (u.hitT ?? -9) < 2.5 && seen(u.x, u.y, u.z)) {
        const { x, y, rx, ry } = this.unitBox(u);
        const bw = Math.max(8, rx * 2);
        healthBar(c, Math.round(x - bw / 2), y - ry - 4, bw, u.hp);
      }
    for (const b of this.buildings) if (!b.sel && (this.time - (b.hitT ?? -9) < 2.5 || b.fixing) && seen(b.x, b.y, 10)) this.buildingBar(b);
    for (const b of this.buildings) if (b.fixing && seen(b.x, b.y, 10)) this.drawWrench(b);
    for (const b of this.bridges)
      if (!b.dead && (this.time - (b.hitT ?? -9) < 2.5 || b === this.hoverBridge) && seen(b.x, b.y, 4)) {
        const [sx, sy] = toScreen(b.x, b.y, BRIDGE_Z[b.style] + 9);
        const bw = Math.max(16, Math.round(b.L * 0.5));
        healthBar(c, Math.round(sx - bw / 2), Math.round(sy), bw, b.hp);
      }

    // the building being placed: a see-through ghost over its footprint
    const gh = this.ghost;
    if (gh && seen(gh.x, gh.y, 10)) {
      const col = gh.why ? '#ff6a5a' : '#9dff9d';
      // (a wall run gets an outline too, round all of what one purchase will build)
      this.drawFoot(gh.pad, col, 1.5, true, !!gh.cells);
      c.globalAlpha = 0.65;
      if (gh.cells) {
        // a wall run: each segment joined to the rest and to the walls it meets
        const at = this.wallSet();
        for (const [x, y] of gh.cells) at.add(wallKey(this.me, x, y));
        const order = [...gh.cells].sort((p, q) => p[0] + p[1] - q[0] - q[1]);
        for (const [x, y] of order) this.blit(this.wallArt(this.wallLink(at, this.me, x, y), this.me).spr, x, y, 0);
      } else this.blit(this.buildingArt(gh.tech.building!, this.me).spr, gh.x, gh.y, 0);
      c.globalAlpha = 1;
    }
  }

  // Drawn once over every copy of the map, in unwrapped map pixels: the
  // shroud, then where you have sent your units, which shows over it.
  renderOver(x0: number, y0: number, x1: number, y1: number): void {
    const c = this.ctx;
    this.shroud?.draw(c, x0, y0, x1, y1);
    const pad = 80;
    for (let j = Math.floor((y0 - pad) / this.h); j <= Math.floor((y1 + pad) / this.h); j++)
      for (let k = Math.floor((x0 - pad) / this.w); k <= Math.floor((x1 + pad) / this.w); k++) {
        c.save();
        c.translate(k * this.w, j * this.h);
        this.drawOrders(x0 - k * this.w, y0 - j * this.h, x1 - k * this.w, y1 - j * this.h);
        c.restore();
      }
  }

  // Lines out to where your units are going, and the order markers, on this
  // copy of the map within screen rect (x0, y0)-(x1, y1).
  private drawOrders(x0: number, y0: number, x1: number, y1: number): void {
    const c = this.ctx;
    const pad = 56;
    const inView = (sx: number, sy: number) => sx > x0 - pad && sx < x1 + pad && sy > y0 - pad && sy < y1 + pad * 1.5;
    // faint lines out to where your units were sent, until they get there
    c.save();
    c.strokeStyle = 'rgba(157,255,157,0.3)';
    c.fillStyle = 'rgba(157,255,157,0.6)';
    c.lineWidth = 0.7;
    c.beginPath();
    const ends: [number, number][] = [];
    for (const u of this.units) {
      if (u.f !== this.me || !u.moving || !u.dest || u.dest[0] !== u.tx || u.dest[1] !== u.ty || u.deploy) continue;
      const [ax, ay] = this.screenOf(u);
      const a = u.aim && Math.abs(u.aim[0] - u.tx) < 1 && Math.abs(u.aim[1] - u.ty) < 1 ? u.aim : null;
      const [ex, ey] = a ? [a[2], a[3]] : [u.tx, u.ty];
      const [bx, by] = toScreen(ex, ey, this.terrain.elev(ex, ey));
      if (Math.max(ax, bx) < x0 - pad || Math.min(ax, bx) > x1 + pad || Math.max(ay, by) < y0 - pad || Math.min(ay, by) > y1 + pad) continue;
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      ends.push([bx, by]);
    }
    c.stroke();
    for (const [bx, by] of ends) c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
    c.restore();

    // order markers: the cursor's click burst, on top of everything
    for (const m of this.markers) {
      const frames = burstFrames(markKind(m));
      const img = frames[Math.min(frames.length - 1, Math.floor(m.t / BURST_FRAME))];
      const [sx, sy] = toScreen(m.x, m.y, m.z);
      if (!inView(sx, sy)) continue;
      c.drawImage(img, Math.round(sx) - BURST_CENTER, Math.round(sy) - BURST_CENTER);
    }
  }

  // A footprint outline on the ground, dashed round its edge.
  private drawFoot(r: Rect, color: string, alpha: number, fill = true, line = true): void {
    const c = this.ctx;
    const pts: [number, number][] = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x + r.w, r.y + r.h],
      [r.x, r.y + r.h],
    ];
    c.fillStyle = color;
    if (fill) {
      c.globalAlpha = alpha * 0.2;
      c.beginPath();
      pts.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(x, y);
        if (i) c.lineTo(sx, sy);
        else c.moveTo(sx, sy);
      });
      c.fill();
    }
    c.globalAlpha = alpha;
    for (let i = 0; i < 4 && line; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % 4];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let k = 0; k <= n; k++) {
        if (k % 4 === 3) continue;
        const [sx, sy] = toScreen(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
        c.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  // Brackets round the corners of a selected building's footprint.
  private drawBuildingSel(b: Building): void {
    const c = this.ctx;
    if (b.rally) {
      // a dotted line out to a little flag
      const [rx, ry] = this.nearPoint(b.x, b.y, ...b.rally);
      const [ax, ay] = toScreen(b.x, b.y + b.art.ry);
      const [bx, by] = toScreen(rx, ry, this.terrain.elev(rx, ry));
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
      c.fillStyle = 'rgba(157,255,157,0.85)';
      for (let i = 0; i < n; i += 1) if (i % 2 === 0) c.fillRect(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), 1, 1);
      const X = Math.round(bx);
      const Y = Math.round(by);
      c.fillStyle = '#e9f0d8';
      c.fillRect(X, Y - 9, 1, 10);
      c.fillStyle = '#9dff9d';
      c.fillRect(X + 1, Y - 9, 4, 3);
      c.fillStyle = '#3c7a3c';
      c.fillRect(X + 1, Y - 7, 4, 1);
    }
    const { rx, ry } = b.art;
    c.fillStyle = b.f === this.me ? '#ffffff' : b.f === NEUTRAL_F ? '#f2e6b8' : '#ff6a5a';
    // dots one art pixel across, stepped along each edge at the art grid
    const L = 7;
    const t = 1 / ART;
    const dot = (wx: number, wy: number) => {
      const [sx, sy] = toScreen(wx, wy);
      c.fillRect(Math.round(sx * ART) / ART, Math.round(sy * ART) / ART, t, t);
    };
    for (const [cx, cy, dx, dy] of [
      [-rx, -ry, 1, 1],
      [rx, -ry, -1, 1],
      [rx, ry, -1, -1],
      [-rx, ry, 1, -1],
    ]) {
      for (let k = 0; k <= L * ART; k++) {
        dot(b.x + cx + (dx * k) / ART, b.y + cy);
        dot(b.x + cx, b.y + cy + (dy * k) / ART);
      }
    }
    this.buildingBar(b);
  }

  // A building's health, over the top of it.
  private buildingBar(b: Building): void {
    const c = this.ctx;
    const { rx, ry } = b.art;
    const spr = b.art.spr;
    const [sx, sy] = toScreen(b.x, b.y);
    const top = this.spriteTop(b);
    const bw = Math.max(16, Math.round((rx + ry) * 1.1));
    healthBar(c, Math.round(sx - bw / 2), Math.round(Math.min(sy - spr.cy + top, sy - 8) - 5), bw, b.hp);
  }

  // A building being repaired: a wrench over it, blinking.
  private drawWrench(b: Building): void {
    if (Math.floor(this.time * 2.5) % 2) return;
    const c = this.ctx;
    const [sx, sy] = toScreen(b.x, b.y);
    const top = Math.round(Math.min(sy - b.art.spr.cy + this.spriteTop(b), sy - 8) - 16);
    const x0 = Math.round(sx) - 4;
    const rows = ['.kkk..kk', 'kwwk.kwk', 'kwk.kwwk', 'kwwkwwk.', '.kwwwk..', '..kwwk..', '.kwwk...', 'kwwk....', 'kwk.....', '.k......'];
    for (const [j, row] of rows.entries())
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        c.fillStyle = ch === 'k' ? '#10140c' : '#f2c94c';
        c.fillRect(x0 + i, top + j, 1, 1);
      }
  }

  // How far down a building's sprite its first solid pixel is.
  private tops = new Map<V2BuildingArt, number>();
  private spriteTop(b: Building): number {
    let t = this.tops.get(b.art);
    if (t === undefined) {
      const img = b.art.spr.img;
      const d = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
      t = 0;
      find: for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          if (d[(y * img.width + x) * 4 + 3] > 200) {
            t = y / ART;
            break find;
          }
      this.tops.set(b.art, t);
    }
    return t;
  }

  // The shroud, for the globe to put over the map's picture itself.
  shroudMap(): Shroud | null {
    return this.shroud;
  }

  // The whole map for the globe, one pixel per OV screen pixels: the overview
  // with forests darkened, and the bases on it (not the shroud: the globe
  // puts that on itself).
  mapImage(): HTMLCanvasElement {
    this.mapStep(1e9);
    const src = this.ov!;
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    // the globe reads it back (planet.ts setMap), which from a GPU canvas
    // stalls the frame, and this is redone every few seconds as the shroud lifts
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(src, 0, 0);
    c.scale(1 / OV, 1 / OV);
    c.imageSmoothingEnabled = true;
    const ctx = this.ctx;
    this.ctx = c;
    try {
      for (const b of this.buildings.filter((b) => b.rise >= 1).sort((p, q) => p.x + p.y - q.x - q.y)) {
        // on the copy of the map that holds the building's foot
        const [sx, sy] = toScreen(b.x, b.y);
        const [fx, fy] = this.lapped(b.x, b.y, -Math.floor(sx / this.w), -Math.floor(sy / this.h));
        this.blit(b.art.spr, fx, fy, 0);
      }
      for (const r of this.ruins) {
        const [sx, sy] = toScreen(r.x, r.y);
        const [fx, fy] = this.lapped(r.x, r.y, -Math.floor(sx / this.w), -Math.floor(sy / this.h));
        this.blit(r.states.ruin.spr, fx, fy, 0);
      }
    } finally {
      this.ctx = ctx;
    }
    return cv;
  }

  // Units as dots of their faction's color, for the globe (screen positions).
  mapDots(): [number, number, RGB][] {
    return this.units.filter((u) => this.shown(u)).map((u) => {
      const [sx, sy] = toScreen(u.x, u.y);
      return [sx, sy, FACTIONS[u.f].light];
    });
  }

  // A unit coming out of a door: only what is through the open doorway shows.
  private drawExiting(u: Unit, e: Exit): void {
    const open = e.b.door ?? 0;
    if (open <= 0) return;
    this.ctx.save();
    clipDoorway(this.ctx, e.d, e.x, e.y, open);
    this.drawUnit(u);
    this.ctx.restore();
  }

  private drawUnit(u: Unit): void {
    if (!this.shown(u)) return;
    this.lit = this.justHit(u) ? 0.45 : 0;
    this.aimed = this.aimFlash(u);
    try {
      this.drawUnitNow(u);
    } finally {
      this.lit = 0;
      this.aimed = 0;
    }
  }

  private drawUnitNow(u: Unit): void {
    const art = this.art[u.f];
    const di = dirIndex(u.a, DIRS);
    // a gun kicks back as it fires
    const kick = this.time - (u.fired ?? -9) < 0.1 ? 1 : 0;
    switch (u.kind) {
      case 'mcv':
        this.blit(art.mcv[di], u.x, u.y, u.z);
        break;
      case 'inf':
      case 'rocket':
      case 'gren':
      case 'eng':
      case 'dog':
      case 'cmdo':
      case 'flamer':
        if (this.swimming(u)) this.drawSwimmer(u);
        else if (u.fly !== undefined) this.drawChute(u);
        else this.blit(this.footSprite(u), u.x, u.y, u.z);
        break;
      case 'light':
      case 'heavy':
      case 'scorch':
      case 'lumen':
      case 'skyguard': {
        const [hull, tur] = tankParts(art, u.kind);
        this.blit(hull[di], u.x, u.y, u.z);
        this.blit(tur[dirIndex(u.turret, DIRS)], u.x - Math.cos(u.a) * 1.2 - Math.cos(u.turret) * kick, u.y - Math.sin(u.a) * 1.2 - Math.sin(u.turret) * kick, u.z);
        break;
      }
      case 'heli': {
        const alt = HELI_ALT + Math.sin(u.anim * 2) * 1.2;
        const z = u.z + alt;
        this.blit(art.heli[di], u.x, u.y, z);
        const c = this.ctx;
        const hx = u.x + Math.cos(u.a) * 1;
        const hy = u.y + Math.sin(u.a) * 1;
        const ra = u.anim * 26;
        c.fillStyle = 'rgba(28,28,28,0.5)';
        for (let b = 0; b < 2; b++) {
          const ang = ra + b * Math.PI * 0.5;
          const [x0, y0] = toScreen(hx - Math.cos(ang) * 12, hy - Math.sin(ang) * 12, z + 8);
          const [x1, y1] = toScreen(hx + Math.cos(ang) * 12, hy + Math.sin(ang) * 12, z + 8);
          pxLine(c, x0, y0, x1, y1);
        }
        const [mx, my] = toScreen(hx, hy, z + 8);
        c.fillStyle = '#222';
        c.fillRect(Math.round(mx), Math.round(my), 1, 1);
        // tail rotor blur
        const [tx, ty] = toScreen(u.x - Math.cos(u.a) * 13.5, u.y - Math.sin(u.a) * 13.5, z + 6.5);
        c.fillStyle = 'rgba(28,28,28,0.45)';
        const s = Math.floor(u.anim * 20) % 2 ? 2 : 1;
        c.fillRect(Math.round(tx), Math.round(ty) - s, 1, s * 2 + 1);
        break;
      }
      case 'heron': {
        const z = u.z + this.alt(u) + Math.sin(u.anim * 2) * 1.2 * (u.fly ?? 1);
        this.blit(art.heron[di], u.x, u.y, z);
        // two rotors turning opposite ways, fore and aft
        const c = this.ctx;
        c.fillStyle = 'rgba(28,28,28,0.5)';
        for (const [ru, rz, sg] of [[6, 8.4, 1], [-8.6, 10.2, -1]]) {
          const hx = u.x + Math.cos(u.a) * ru;
          const hy = u.y + Math.sin(u.a) * ru;
          for (let b = 0; b < 3; b++) {
            const ang = sg * u.anim * 24 + (b * Math.PI * 2) / 3;
            const [x0, y0] = toScreen(hx, hy, z + rz);
            const [x1, y1] = toScreen(hx + Math.cos(ang) * 9.5, hy + Math.sin(ang) * 9.5, z + rz);
            pxLine(c, x0, y0, x1, y1);
          }
        }
        break;
      }
      case 'jet': {
        // a little wobble in the hover, none on its pad; a hot exhaust
        const z = u.z + this.alt(u) + Math.sin(u.anim * 2.6) * 0.6 * (u.fly ?? 0);
        // (on a carrier's deck, parked or taxiing, its wings are folded up)
        const folded = u.deck !== undefined && (u.fly ?? 0) < 0.05 && u.dop !== 'roll' && u.dop !== 'brake';
        this.blit((folded ? art.jetFolded : art.jet)[di], u.x, u.y, z);
        if ((u.fly ?? 0) > 0.02) {
          const [ex, ey] = toScreen(u.x - Math.cos(u.a) * 9.6, u.y - Math.sin(u.a) * 9.6, z + 3.4);
          const c = this.ctx;
          c.fillStyle = Math.floor(u.anim * 30) % 2 ? '#ffd65a' : '#ff8a3a';
          c.fillRect(Math.round(ex * 2) / 2, Math.round(ey * 2) / 2, 1, 0.5);
        }
        break;
      }
      case 'plane': {
        const z = u.z + this.alt(u);
        this.blit(art.plane[di], u.x, u.y, z);
        // four props turning
        const c = this.ctx;
        c.fillStyle = 'rgba(28,28,28,0.45)';
        const ca = Math.cos(u.a);
        const sa = Math.sin(u.a);
        for (const side of [-12.5, -6.5, 6.5, 12.5]) {
          const [px, py] = toScreen(u.x + ca * 2.4 - sa * side, u.y + sa * 2.4 + ca * side, z + 3.2);
          const s = Math.floor(u.anim * 24 + side) % 2 ? 2 : 1;
          c.fillRect(Math.round(px) - s, Math.round(py), s * 2 + 1, 1);
        }
        break;
      }
      case 'cruiser':
        for (const [spr, x, y, z] of cruiserParts(art, u.x, u.y, Math.sin(u.anim * 1.4) * 0.4, u.a, u.turret)) this.blit(spr, x, y, z);
        break;
      case 'destroyer':
      case 'carrier': {
        // big ships roll slowly
        this.blit(art[u.kind][di], u.x, u.y, Math.sin(u.anim * 1.4) * 0.4);
        break;
      }
      case 'sub': {
        // under the water only a flat dark shadow of it shows (to its own
        // side, or to a ship that hears it), so you can tell it is hidden,
        // with a ripple at the periscope; up, it rides low with the sea
        // washing over it
        const c = this.ctx;
        const down = this.under(u);
        if (down) this.subShadow(u);
        else this.blit(art.sub[di], u.x, u.y, -0.6);
        if (down && u.moving && Math.floor(u.anim * 4) % 2) {
          const [px, py] = toScreen(u.x + Math.cos(u.a) * 2.6, u.y + Math.sin(u.a) * 2.6, 0);
          c.fillStyle = 'rgba(230,245,250,0.7)';
          c.fillRect(Math.round(px), Math.round(py), 1, 0.5);
        }
        break;
      }
      case 'otter': {
        // a hovercraft bobs on its cushion, on land or water, fans whirring
        const z = u.z + Math.sin(u.anim * 5) * 0.25;
        this.blit(art.otter[di], u.x, u.y, z);
        if (u.moving && Math.random() < 0.3) {
          const wet = this.terrain.k(u.x, u.y) === K.Water;
          const [px, py] = toScreen(u.x - Math.cos(u.a) * 11 + (Math.random() - 0.5) * 6, u.y - Math.sin(u.a) * 11 + (Math.random() - 0.5) * 6, u.z + 1);
          this.particles.push({ x: px, y: py, vx: (Math.random() - 0.5) * 6, vy: -3, life: 0, max: 0.6, kind: wet ? 'wake' : 'dust', size: 1 });
        }
        break;
      }
      case 'boat': {
        const bob = Math.sin(u.anim * 2.2) * 0.6;
        this.blit(art.boat[di], u.x, u.y, bob);
        break;
      }
      case 'comet': {
        // it rocks back on its tracks as the rocket goes
        const back = this.time - (u.fired ?? -9) < 0.25 ? 1 : 0;
        this.blit(this.cometSprites(u)[di], u.x - Math.cos(u.a) * back, u.y - Math.sin(u.a) * back, u.z);
        break;
      }
      default: {
        const back = u.kind === 'arty' ? kick : 0;
        const spr = u.kind === 'hauler' ? this.haulerSprite(u, di) : (u.kind === 'buggy' ? art.buggy : u.kind === 'apc' ? art.apc : art.artillery)[di];
        this.blit(spr, u.x - Math.cos(u.a) * back, u.y - Math.sin(u.a) * back, u.z);
        if (u.kind === 'buggy' && !u.moving) drawBuggyLights(this.ctx, u.x, u.y, u.z, u.a, u.anim);
      }
    }
  }

  // The box round a unit: half-size and center on the screen.
  private unitBox(u: Unit): { x: number; y: number; rx: number; ry: number } {
    const st = UNIT[u.kind];
    const [sx, sy] = this.screenOf(u);
    const foot = isFoot(u.kind);
    return { x: Math.round(sx), y: Math.round(sy), rx: foot ? (u.digK ? 6 : 4) : st.r + 4, ry: foot ? 7.5 : Math.round(st.r * 0.75) + 2 };
  }

  private drawSelection(u: Unit): void {
    const c = this.ctx;
    const { x, y, rx, ry } = this.unitBox(u);
    c.fillStyle = u.f === this.me ? '#ffffff' : '#ff6a5a';
    corners(c, x, y, rx, ry, 2);
    const bw = Math.max(8, rx * 2);
    const hx = Math.round(x - bw / 2);
    healthBar(c, hx, y - ry - 4, bw, u.hp);
    // in a group: its number just left of the health bar
    if (u.f === this.me && u.grp !== undefined) groupDigit(c, hx - 5, y - ry - 6, u.grp + 1);
    // a transport's seats under its health bar: lit for each soldier riding in it
    if (TRANSPORT.has(u.kind) && u.f === this.me) {
      const n = seatsUsed(u);
      const seats = seatsOf(u);
      const px = Math.round(x - (seats * 3 - 1) / 2);
      const py = y - ry - 9;
      c.fillStyle = '#111';
      c.fillRect(px - 1, py - 1, seats * 3 + 1, 4);
      for (let i = 0; i < seats; i++) {
        c.fillStyle = i < n ? '#ffd93b' : '#3a3d36';
        c.fillRect(px + i * 3, py, 2, 2);
      }
    }
  }

  private drawBuilding(b: Building, walls?: Set<string>): void {
    const c = this.ctx;
    const link = b.kind === 'wall' ? this.wallLink(walls ?? this.wallSet(), b.f, b.x, b.y) : null;
    if (b.rise < 1) {
      // going up (or coming down): revealed from the ground up, inside the
      // site's outline
      // going up (or coming down): the footing, then built up stage by
      // stage, inside the site's outline
      const [sx, sy] = toScreen(b.x, b.y, 0);
      this.drawFoot(b.pad, '#ffe08a', 0.8);
      // (a wall segment is too small to need stages: it just goes up)
      if (link !== null) drawGoingUp(c, null, this.wallArt(link, b.f).spr, b.rise, sx, sy);
      else drawGoingUp(c, this.riseArt(b.kind, b.f), b.art.spr, b.rise, sx, sy);
      return;
    }
    const hurt = b.hp <= DAMAGED ? (link !== null ? this.wallHurt(link, b.f) : this.states(b.kind, b.f)).damaged : null;
    this.lit = this.justHit(b) ? 0.22 : 0;
    this.aimed = this.aimFlash(b);
    this.blit(hurt ? hurt.spr : link !== null ? this.wallArt(link, b.f).spr : b.art.spr, b.x, b.y, 0);
    this.lit = 0;
    this.aimed = 0;
    const door = b.door ? doorOf(b.kind) : null;
    if (door) drawDoor(c, door, b.x, b.y, b.door!);
    if (b.c4 !== undefined) this.drawCharge(b.x + b.art.rx * 0.8, b.y + b.art.ry, 3);
    if (hurt)
      for (const [i, p] of hurt.fx.entries()) {
        const [x, y] = toScreen(b.x + p.x, b.y + p.y, p.z);
        drawFlame(c, x, y, b.hp < 0.25 ? 5 : 3.5, this.time + i * 0.37, i + 11);
      }
    const f = factionOf(b.f);
    const fx = (i: number) => {
      const p = b.art.fx[i];
      return toScreen(b.x + p.x, b.y + p.y, p.z).map(Math.round) as [number, number];
    };
    switch (b.kind) {
      case 'yard': {
        if (Math.floor(b.phase * 1.2) % 2 === 0) {
          const [x, y] = fx(0);
          c.fillStyle = 'rgba(255,90,60,0.35)';
          c.fillRect(x - 1, y - 1, 3, 3);
          c.fillStyle = '#ff7a5c';
          c.fillRect(x, y, 1, 1);
        }
        break;
      }
      case 'lab': {
        // the dome's panes brighten and dim with the light inside
        const glow = hurt ? null : this.glowOf('lab', b.f);
        if (!glow) break;
        const [sx, sy] = toScreen(b.x, b.y, 0);
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.18 + 0.14 * Math.sin(b.phase * 2.4);
        drawSprite(c, glow.img, glow, sx, sy);
        c.restore();
        break;
      }
      case 'barracks': {
        const [x, y] = fx(0);
        const wave = Math.floor(b.phase * 5) % 4;
        for (let i = 0; i < 7; i++) {
          const dy = Math.round(Math.sin(i * 0.9 - wave * 1.6) * 0.8);
          c.fillStyle = css(i < 2 ? f.light : i === 6 ? f.dark : f.main);
          c.fillRect(x - 1 - i, y + dy, 1, 4);
        }
        break;
      }
      case 'refinery': {
        // a hauler unloading: the amber lamps by the intake flash in turn
        if (this.time - (b.busyT ?? -9) >= 0.3 || b.art.fx.length < 3) break;
        const on = Math.floor(this.time * 3) % 2;
        const [x, y] = fx(1 + on);
        c.fillStyle = 'rgba(255,190,60,0.4)';
        c.fillRect(x - 2, y - 2, 5, 5);
        c.fillStyle = '#fff1a8';
        c.fillRect(x - 1, y - 1, 3, 2);
        break;
      }
      case 'derrick': {
        // the pumpjack's beam rocks up and down (it stops once badly hit)
        const going = !hurt;
        const spr = this.pumpFrame(b.f, going ? Math.floor(b.phase * DERRICK.strokes * PUMP_FRAMES) % PUMP_FRAMES : 0);
        if (spr) this.blit(spr, b.x, b.y, 0);
        // the flag of whoever holds it (a pale one when nobody does)
        const [x, y] = fx(1);
        const wave = Math.floor(b.phase * 5) % 4;
        for (let i = 0; i < 7; i++) {
          const dy = Math.round(Math.sin(i * 0.9 - wave * 1.6) * 0.8);
          c.fillStyle = css(i < 2 ? f.light : i === 6 ? f.dark : f.main);
          c.fillRect(x - 1 - i, y + dy, 1, 4);
        }
        // and a beacon blinking on top of the tank
        if (Math.floor(b.phase * 1.4) % 2 === 0) {
          const [bx, by] = fx(0);
          c.fillStyle = 'rgba(255,90,60,0.35)';
          c.fillRect(bx - 1, by - 1, 3, 3);
          c.fillStyle = '#ff7a5c';
          c.fillRect(bx, by, 1, 1);
        }
        break;
      }
      case 'radar': {
        const p = b.art.fx[0];
        const frame = Math.floor(((b.phase * 0.5) % 1) * 16);
        this.blit(this.dish[frame], b.x + p.x, b.y + p.y, p.z - 3);
        break;
      }
      case 'tower': {
        const p = b.art.fx[0];
        this.blit(this.art[b.f].towerGun[dirIndex(b.gun, DIRS)], b.x + p.x, b.y + p.y, p.z);
        break;
      }
      case 'aa': {
        const p = b.art.fx[0];
        this.blit(this.art[b.f].aaGun[dirIndex(b.gun, DIRS)], b.x + p.x, b.y + p.y, p.z);
        break;
      }
    }
  }
}

// The ground a building of this kind standing at (x, y) takes up: its
// footprint and a margin round it (none for a wall segment, which lines up
// with the next).
// The key a wall segment of side f at (x, y) is found by, cell by cell.
function wallKey(f: number, x: number, y: number): string {
  return `${f}:${Math.round(x / WALL_GRID)},${Math.round(y / WALL_GRID)}`;
}

function padOf(kind: BuildingKind, art: { rx: number; ry: number }, x: number, y: number): Rect {
  const m = kind === 'wall' ? 0 : 3;
  return { x: x - art.rx - m, y: y - art.ry - m, w: art.rx * 2 + m * 2, h: art.ry * 2 + m * 2 };
}

function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function overlap(a: Rect, b: Rect, m: number): boolean {
  return a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;
}

function inside(x: number, y: number, r: Rect, m: number): boolean {
  return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
}

// A health bar: a dark frame, green to red by how much is left, in segments.
// The frame and the gaps between segments are one art pixel (1 / ART of a map
// pixel), the same fine grain as the sprites.
function healthBar(c: CanvasRenderingContext2D, bx: number, by: number, bw: number, hp: number): void {
  const t = 1 / ART;
  c.fillStyle = '#111';
  c.fillRect(bx - t, by - t, bw + 2 * t, 2 + 2 * t);
  c.fillStyle = hp > 0.66 ? '#5ee05e' : hp > 0.33 ? '#e8d24a' : '#e85a4a';
  c.fillRect(bx, by, Math.round(bw * hp * ART) / ART, 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 3; i < bw; i += 3) c.fillRect(bx + i, by, t, 2);
}

// A group's number (1 or 2) as a tiny 3 x 5 pixel digit with a dark edge,
// top left at (x, y).
const DIGITS: Record<number, string[]> = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
};
function groupDigit(c: CanvasRenderingContext2D, x: number, y: number, n: number): void {
  const rows = DIGITS[n];
  if (!rows) return;
  c.fillStyle = '#111';
  c.fillRect(x - 1, y - 1, 5, 7);
  c.fillStyle = '#ffe08a';
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (rows[j][i] === '#') c.fillRect(x + i, y + j, 1, 1);
}

// Selection brackets, one art pixel thick (1 / ART of a map pixel) to match
// the grain of the sprites, with arms len + 1 map pixels long.
function corners(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, len: number): void {
  const t = 1 / ART;
  const L = len + 1;
  const x0 = x - rx;
  const y0 = y - ry;
  const x1 = x + rx + 1 - t;
  const y1 = y + ry + 1 - t;
  c.fillRect(x0, y0, L, t);
  c.fillRect(x0, y0, t, L);
  c.fillRect(x1 - L + t, y0, L, t);
  c.fillRect(x1, y0, t, L);
  c.fillRect(x0, y1, L, t);
  c.fillRect(x0, y1 - L + t, t, L);
  c.fillRect(x1 - L + t, y1, L, t);
  c.fillRect(x1, y1 - L + t, t, L);
}

function pxLine(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

