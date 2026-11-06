// Game rules and simulation. World space: origin at the turret pivot, x right, y down,
// ground at GROUND_Y. Numbers follow the final mechanics plan and are tuning starting points.
import { BUILDINGS, WAR_POSTS, mockToWorld, GROUND_Y, SC, HALF, type AnyPlaneType, type PlaneType, type BuildingDef, type BuildingId } from './art';
import { paletteForWave, type ColorKey, type PaletteId } from './palettes';
import { Sound } from './audio';

export type PlaneState = 'fly' | 'turn' | 'warn' | 'dive' | 'strafe' | 'climb' | 'chase' | 'falling';
/** 'won' is only reached in war mode, when the level's clock runs out with the base still standing. */
export type Phase = 'idle' | 'intro' | 'combat' | 'clear' | 'over' | 'won';
/** Original: endless waves defending one turret. War: hold out for a fixed time from several turrets, among friendly planes.
 *  Co-op: the original waves for two players, one on the base and one flying the enemy planes as the Bomber.
 *  Adventure: the original waves with a weak turret; every enemy plane shot down earns 1 iron, spent in the iron shop. */
export type GameMode = 'original' | 'war' | 'coop' | 'adventure';
/** Special weapons replace the gun until their ammo or time runs out. */
export type WeaponId = 'missiles' | 'laser' | 'rockets' | 'fireballs' | 'sonic' | 'nuke' | 'rapid' | 'lightning' | 'cluster';
/** Perks: permanent gun improvements (dual, triple, reload, flak), leeching and the upgrade shifter (only from a gold pack), and one-off help for the base (repair, rebuild, shield). */
export type PerkId = 'dual' | 'triple' | 'reload' | 'flak' | 'leech' | 'shifter' | 'ghost' | 'drop' | GoldPerk | DiamondPerk | 'repair' | 'rebuild' | 'shield';
/** More permanent upgrades that only come in a gold pack, and in a diamond pack. */
export type GoldPerk = 'armor' | 'bounty' | 'swift' | 'mend' | 'lucky' | 'clean' | 'slowbomb' | 'laststand';
export type DiamondPerk = 'homing' | 'spark' | 'wreck' | 'headwind' | 'mirror' | 'breaker' | 'sweeper' | 'overcharge';
/** A plain crate, a gold pack from the gold plane, or a diamond pack that a downed plane sometimes drops. */
export type PackKind = 'plain' | 'gold' | 'diamond';
export type UpgradeId = PerkId | WeaponId;
export type Difficulty = 'normal' | 'hard';
type TrailPoint = [number, number, number];

export interface Plane {
  id: number; type: AnyPlaneType; dir: number;
  x: number; y: number; alt: number; speed: number;
  hp: number; max: number; state: PlaneState; stateT: number;
  /** visual nose-down angle, radians */
  pitch: number;
  /** horizontal scale during a U-turn or spin: 1 facing dir, -1 facing back */
  flip: number;
  turnT: number; turnX?: number; turnR?: number; turnDur?: number;
  /** where shells hit, in the plane's own frame (u along the body, v across) */
  hits: { u: number; v: number }[];
  trail: TrailPoint[]; trailT: number;
  dropCD: number; diveCD: number; burnT: number; burning: boolean; smokeT: number; hitFlash: number;
  vx: number; vy: number; spin: number; lightPhase: number;
  dead?: boolean; diveTo?: [number, number]; strafeDone?: Set<Building>; chaseCargo?: boolean;
  // cargo plane only
  dropped?: boolean; hitByPlayer?: boolean; gone?: boolean;
  /** a gold resupply plane, whose crate is a gold pack */
  gold?: boolean;
  /** upgrade shifter: seconds left of a dodge, and which way (-1 up, 1 down) */
  dodgeT?: number; dodgeDir?: number;
  // war mode: a friendly plane, the turret it means to drop a crate at, and the short bursts planes fire at each other
  friend?: boolean; dropAt?: Building | null; gunCD?: number; gunT?: number; gunAt?: Plane | null;
  /** co-op: the plane the Bomber is flying */
  player?: boolean;
}
/** A heavy bomber's big bomb, or a light plane's missile (long and skinny, on the old bomb's arc). In co-op the Bomber can also drop a nuke. */
export type BombKind = 'bomb' | 'missile' | 'nuke';
export interface Bomb { id: number; kind: BombKind; x: number; y: number; x0: number; y0: number; vx0: number; k: number; g: number; wa: number; t: number; T: number; hp: number; trail: TrailPoint[]; trailT: number; angle: number; dead?: boolean;
  /** co-op: dropped by the Bomber (so its damage counts for the Bomber), and a mega nuke */
  byBomber?: boolean; bySniper?: boolean; mega?: boolean; }
/** `ghost`: passes through enemy planes, hitting each once (the ones in `hit`). `fall`: a drop shot on its way back down. */
export interface Shell { x: number; y: number; vx: number; vy: number; t: number; px: number; py: number; dead?: boolean; counted?: boolean; ghost?: boolean; fall?: boolean; hit?: Set<Plane | Bomb>; }
export type ShotKind = 'missile' | 'rocket' | 'fireball' | 'nuke' | 'cluster' | 'bomblet';
export interface Missile { kind: ShotKind; x: number; y: number; vx: number; vy: number; t: number; target: Plane | null; smokeT: number; dead?: boolean; counted?: boolean; fuse?: number; }
/** A sonic pulse: an arc that spreads out from the gun along the aim it was fired at. */
export interface Pulse { x: number; a: number; r: number; hit: Set<Plane | Bomb>; hitAny: boolean; }
export type ParticleKind = 'puff' | 'fire' | 'flash' | 'spark' | 'debris' | 'ring';
export interface Particle { k: ParticleKind; x: number; y: number; vx: number; vy: number; r: number; life: number; t: number; grow?: number; a?: number; color?: ColorKey; ground?: boolean; }
export interface Tracer { x0: number; y0: number; x1: number; y1: number; life: number; }
/** A chain lightning bolt: a jagged line through the points it jumped between. */
export interface Bolt { pts: [number, number][]; life: number; }
/** `lz` is the x of the landing zone the crate steers to. */
/** A gold crate is a gold pack: opening it gives every permanent upgrade at once. */
export interface Crate { x: number; y: number; vx: number; vy: number; lz: number; landed: boolean; t: number; sway: number; dead?: boolean; gold?: boolean; diamond?: boolean;
  /** upgrade shifter: seconds left of a sideways dodge, which way, and how far it is off its path right now */
  dodgeT?: number; dodgeDir?: number; dodgeX?: number;
  /** co-op: held by the Bomber's metal arm, which is reeling it in */
  held?: boolean; }
export interface Label { text: string; x: number; y: number; t: number; life: number; color: string; big?: boolean; }
/** `outpost` marks a war mode turret standing on its own away from the base. */
export interface Building { def: BuildingDef; id: BuildingId; name: string; x: number; half: number; hp: number; max: number; ruined: boolean; hit: number; smokeT: number; ruinT: number; outpost?: boolean; }
export interface WaveSpec { count: number; list: PlaneType[]; boss: boolean; }
export interface ClearInfo { bonus: number; health: number; perfect: number; }
export interface Results {
  mode: GameMode; difficulty: Difficulty; score: number; wave: number; accuracy: number; kills: number; intercepts: number;
  /** war mode: whether the level was passed, why it was lost, seconds survived and friendly planes shot down */
  won: boolean; reason: string; time: number; friendlies: number;
  /** co-op: how the Bomber did */
  bomber?: { name: string; damage: number; deaths: number; steals: number };
}
export interface Hooks {
  tip?: (key: string, text: string) => void;
  hud?: () => void;
  waveStart?: (n: number) => void;
  waveClear?: (info: ClearInfo) => void;
  gameOver?: (r: Results) => void;
  label?: (text: string) => void;
  /** adventure: the iron count changed */
  iron?: () => void;
}
interface Lock { target: Plane | null; t: number; step: number; locked: boolean; }

export const XE = 620;                 // planes U-turn at the edge of the playable sky
const AIM_GAIN = 1.4;
const AIM_MAX = 95 * Math.PI / 180;
const SHELL_V0 = 480, SHELL_K = .583, SHELL_G = 22, SHELL_LIFE = 3.3;
/** Horizontal drag on a light plane's missile, and on a heavy bomb, which straightens out to fall almost straight down. */
const MISSILE_DRAG = .06, BOMB_DRAG = 1.1;
const BARREL = 48;
const FIRE_INTERVAL = 1 / 3;

/* ---------- adventure mode ---------- */
/** Iron shop items. Levels are kept between games; repair is a one-off during a game. */
export type ShopId = 'health' | 'damage' | 'rate' | 'repair';
export interface ShopItem { name: string; desc: string; max: number; cost: (lv: number) => number; }
/** The adventure turret starts at this share of the normal turret's health; each Max health level adds ADV_HP_STEP more. */
export const ADV_HP_START = .2, ADV_HP_STEP = .1;
export const SHOP: Record<ShopId, ShopItem> = {
  health: { name: 'Max health', desc: `+${ADV_HP_STEP * 100}% turret health (of a normal turret).`, max: 10, cost: lv => 3 + lv * 2 },
  damage: { name: 'Damage', desc: 'Shells hit 25% harder. Helps against bosses and nukes.', max: 8, cost: lv => 5 + lv * 3 },
  rate: { name: 'Fire rate', desc: 'The gun fires 15% faster.', max: 6, cost: lv => 4 + lv * 3 },
  repair: { name: 'Repair turret', desc: 'Patch the turret back to full health now.', max: Infinity, cost: () => 3 },
};
export interface Adventure { iron: number; health: number; damage: number; rate: number; }
export const newAdventure = (): Adventure => ({ iron: 0, health: 0, damage: 0, rate: 0 });
/** Where the crate can land on the pad: the gap left of the depot or right of the hangar, picked at random each drop. */
const LZ_SPOTS = [-77, 86];
export const LZ_Y = GROUND_Y - 3.4;
const CRATE_FALL = 14;                 // seconds from drop to landing
/** A falling plane can be hit once more, which blows it apart before it reaches the ground; not in the first moment, so one burst can't do both. */
const FALL_GRACE = .25;
const LASER_LEN = 1100;
const SONIC_SPREAD = .24, SONIC_SPEED = 480, SONIC_RANGE = 1000;
const NUKE_R = 280;
/** Chain lightning: how far off the aim it finds its first target, and how far it jumps after that. */
const BOLT_CONE = 14 * Math.PI / 180, BOLT_RANGE = 1000, BOLT_JUMP = 230, BOLT_CHAIN = 5;
/** The shield dome over the base, an ellipse on the ground. */
export const DOME_RX = 190, DOME_RY = 115;
const SHIELD_TIME = 25;
/** The chance each wave that the resupply plane is a gold plane; leeching heals each standing building by this share of its full strength per kill. */
const GOLD_CHANCE = .2, LEECH_HEAL = .02;
/** The permanent upgrades a gold pack offers; dual or triple shot is whichever comes next. Leeching and the shifter only come in a gold pack. */
const GOLD_ONLY: PerkId[] = ['leech', 'shifter', 'armor', 'bounty', 'swift', 'mend', 'lucky', 'clean', 'slowbomb', 'laststand'];
/** A diamond pack holds only these two, and comes from a downed enemy plane 3% of the time. */
const DIAMOND_PACK: PerkId[] = ['ghost', 'drop', 'homing', 'spark', 'wreck', 'headwind', 'mirror', 'breaker', 'sweeper', 'overcharge'];
const DIAMOND_CHANCE = .03;
/** A drop shot falls for at most this long after turning over, and fizzles out this high above the ground so it never touches the base. */
const DROP_LIFE = 4, DROP_FLOOR = GROUND_Y - 40;
const GOLD_PACK: PerkId[] = ['dual', 'triple', 'reload', 'flak', 'leech', 'shifter', 'armor', 'bounty', 'swift', 'mend', 'lucky', 'clean', 'slowbomb', 'laststand'];
/** The perks below are kept in `Game.perks`; the older ones have their own fields. */
const SET_PERKS: PerkId[] = ['armor', 'bounty', 'swift', 'mend', 'lucky', 'clean', 'slowbomb', 'laststand', 'homing', 'spark', 'wreck', 'headwind', 'mirror', 'breaker', 'sweeper', 'overcharge'];
/** Point defense fires this often while a bomb or missile is in the air; Mending heals this share of full strength a second. */
const SWEEP_EVERY = 6, MEND_RATE = .005;
/** How long an upgrade shifter dodge lasts, and how close a shot gets (past touching) before the cargo moves. */
const DODGE_TIME = .7, DODGE_PAD = 14;
/** A boss plane comes in the middle of every fourth wave. It takes many hits, and the laser and nuke wear it down by the amount below. */
const BOSS_EVERY = 4, LASER_DPS = 8, NUKE_DMG = 12;

/** Hard: about twice the planes, arriving faster and in bigger groups, that fire more
 *  often and hit harder. Scores are worth half as much again. */
export const DIFFICULTY: Record<Difficulty, { planes: number; group: number; gap: number; fire: number; damage: number; score: number }> = {
  normal: { planes: 1, group: 0, gap: 1, fire: 1, damage: 1, score: 1 },
  hard: { planes: 2.1, group: 2, gap: .6, fire: .6, damage: 1.6, score: 1.5 },
};

/** War mode, level 1. The player starts at the middle turret (see WAR_POSTS). The sky is wider,
 *  so planes can be shot on their way in. */
const WAR_XE = 960;
/** Survive this many seconds to pass; shooting down this many friendly planes loses the level. */
export const WAR_TIME = 180, WAR_STRIKES = 3;
/** Friendly plane types, and the share of them that carry an upgrade crate. */
const FRIEND_TYPES: PlaneType[] = ['fighter', 'fighter', 'light', 'light', 'heavy'];
const FRIEND_CARRY = .3;
/** Seconds to slide over to another turret; the gun fires again once it has arrived. */
const MOVE_TIME = .35;
export const TYPES: Record<AnyPlaneType, { speed: number; points: number; alts: number[]; r: number }> = {
  recon: { speed: 1240 / 35, points: 50, alts: [-600, -570, -540], r: 3.4 },
  light: { speed: 1240 / 30, points: 100, alts: [-440, -380, -320], r: 3.8 },
  heavy: { speed: 1240 / 45, points: 250, alts: [-560, -510, -460], r: 5 },
  fighter: { speed: 1240 / 18, points: 150, alts: [-470, -400, -330], r: 3.4 },
  cargo: { speed: 30, points: 0, alts: [-520], r: 5 },
  boss: { speed: 1240 / 55, points: 2000, alts: [-520, -480, -440], r: 8 },
};
/** The boss's health: more for each boss in the game, and half as much again on hard. */
export function bossHp(wave: number, d: Difficulty) { return Math.round((20 + 8 * (wave / BOSS_EVERY - 1)) * (d === 'hard' ? 1.5 : 1)); }

/** Ammo for each weapon; seconds for the laser (only while firing) and rapid fire. */
export const AMMO: Record<WeaponId, number> = { missiles: 6, laser: 12, rockets: 14, fireballs: 18, sonic: 10, nuke: 1, rapid: 30, lightning: 10, cluster: 12 };
export const UPGRADES: Record<UpgradeId, { name: string; kind: string; desc: string; hud: string; color: string }> = {
  dual: { name: 'Dual shot', kind: 'Permanent', desc: 'A second barrel. Every shot fires a pair of shells.', hud: 'DUAL', color: '#fff1c8' },
  triple: { name: 'Triple shot', kind: 'Permanent', desc: 'A third barrel. Every shot fires a fan of three shells.', hud: 'TRIPLE', color: '#fff1c8' },
  reload: { name: 'Fast loader', kind: 'Permanent', desc: 'The gun fires half as fast again, for the rest of the game.', hud: 'LOADER', color: '#fff1c8' },
  flak: { name: 'Heavy flak', kind: 'Permanent', desc: 'Bigger shells with a much wider burst. Near misses count.', hud: 'FLAK', color: '#fff1c8' },
  shifter: { name: 'Upgrade shifter', kind: 'Permanent', desc: 'Cargo planes and their crates dodge your shots, so you never shoot down an upgrade by accident.', hud: 'SHIFTER', color: '#ffd34a' },
  ghost: { name: 'Ghost shot', kind: 'Permanent', desc: 'Light blue shells that pass straight through enemy planes, hitting every one in their path. They never harm friendly planes.', hud: 'GHOST', color: '#9fe6ff' },
  // gold pack only
  armor: { name: 'Armor plating', kind: 'Permanent', desc: 'Every building takes a quarter less damage.', hud: 'ARMOR', color: '#ffd34a' },
  bounty: { name: 'Bounty', kind: 'Permanent', desc: 'Every plane you shoot down is worth double points.', hud: 'BOUNTY', color: '#ffd34a' },
  swift: { name: 'Swift shells', kind: 'Permanent', desc: 'Shells leave the barrel a third faster, so they reach planes sooner and fly farther.', hud: 'SWIFT', color: '#ffd34a' },
  mend: { name: 'Mending', kind: 'Permanent', desc: 'Standing buildings slowly repair themselves, a little every second.', hud: 'MEND', color: '#ffd34a' },
  lucky: { name: 'Lucky star', kind: 'Permanent', desc: 'Gold planes come twice as often: a 40% chance every wave.', hud: 'LUCKY', color: '#ffd34a' },
  clean: { name: 'Clean intercepts', kind: 'Permanent', desc: 'Bombs and missiles you shoot out of the air no longer scorch the base below.', hud: 'CLEAN', color: '#ffd34a' },
  slowbomb: { name: 'Heavy air', kind: 'Permanent', desc: 'Enemy bombs and missiles fall 30% slower, giving you more time to shoot them.', hud: 'HEAVY AIR', color: '#ffd34a' },
  laststand: { name: 'Last stand', kind: 'Permanent', desc: 'Once per game, when your turret would be destroyed it holds on at half strength.', hud: 'LAST STAND', color: '#ffd34a' },
  // diamond pack only
  homing: { name: 'Homing shells', kind: 'Permanent', desc: 'Shells curve toward the nearest enemy plane in front of them.', hud: 'HOMING', color: '#9fe6ff' },
  spark: { name: 'Spark jump', kind: 'Permanent', desc: 'Every plane you shoot down sends a spark to the nearest enemy plane and hits it too.', hud: 'SPARK', color: '#9fe6ff' },
  wreck: { name: 'Exploding wrecks', kind: 'Permanent', desc: 'A plane you shoot down blows up in the air and hits every enemy plane close by.', hud: 'WRECKS', color: '#9fe6ff' },
  headwind: { name: 'Headwind', kind: 'Permanent', desc: 'Enemy planes fly a fifth slower.', hud: 'HEADWIND', color: '#9fe6ff' },
  mirror: { name: 'Mirror gun', kind: 'Permanent', desc: 'Every shot also fires a twin shell on the other side of the sky, mirrored across the middle.', hud: 'MIRROR', color: '#9fe6ff' },
  breaker: { name: 'Boss breaker', kind: 'Permanent', desc: 'Everything you fire hits a boss three times as hard.', hud: 'BREAKER', color: '#9fe6ff' },
  sweeper: { name: 'Point defense', kind: 'Permanent', desc: `Every ${SWEEP_EVERY} seconds a zap from the base destroys the bomb or missile closest to landing.`, hud: 'POINT DEF', color: '#9fe6ff' },
  overcharge: { name: 'Overcharge', kind: 'Permanent', desc: 'Every special weapon you pick up comes with double ammo.', hud: 'OVERCHARGE', color: '#9fe6ff' },
  drop: { name: 'Drop shot', kind: 'Permanent', desc: 'At the top of their flight your shells fall back down through the sky. They never harm friendly planes or your base.', hud: 'DROP', color: '#9fe6ff' },
  leech: { name: 'Leeching', kind: 'Permanent', desc: 'Every plane you shoot down heals each standing building by 2% of its full strength.', hud: 'LEECH', color: '#ffd34a' },
  repair: { name: 'Repair crew', kind: 'Right away', desc: 'Every standing building back to full strength, and ruined ones rebuilt to half.', hud: 'REPAIR', color: '#9fe0b0' },
  rebuild: { name: 'Rebuild', kind: 'Right away', desc: 'Every destroyed building rebuilt to full strength.', hud: 'REBUILD', color: '#9fe0b0' },
  shield: { name: 'Shield dome', kind: `${SHIELD_TIME} seconds`, desc: 'A dome over the base. Bombs and missiles burst on it, and nothing gets through.', hud: 'SHIELD', color: '#7fe9ff' },
  missiles: { name: 'Guided missiles', kind: `${AMMO.missiles} missiles`, desc: 'Hold a plane in your sights to lock on, then tap. Your gun waits until they are spent.', hud: 'MISSILES', color: '#ffcf7a' },
  laser: { name: 'Laser', kind: `${AMMO.laser} seconds of beam`, desc: 'A solid beam for as long as your finger is down. It cuts through everything in its path.', hud: 'LASER', color: '#ff5a5a' },
  rockets: { name: 'Rockets', kind: `${AMMO.rockets} rockets`, desc: 'Fast rockets that leave a smoke trail and hit with a big blast.', hud: 'ROCKETS', color: '#e9e4d6' },
  fireballs: { name: 'Fireballs', kind: `${AMMO.fireballs} fireballs`, desc: 'Lobbed balls of fire with a wide burst.', hud: 'FIREBALLS', color: '#ff8a2a' },
  sonic: { name: 'Sonic pulse', kind: `${AMMO.sonic} pulses`, desc: 'A wide wave of sound that tears through every plane and bomb in front of the gun.', hud: 'SONIC', color: '#8fd8ff' },
  nuke: { name: 'Nuke', kind: '1 shot', desc: 'One slow shell with a huge blast. It clears most of the sky.', hud: 'NUKE', color: '#ffe14a' },
  rapid: { name: 'Rapid fire', kind: `${AMMO.rapid} seconds`, desc: 'Triple fire rate. Hold to keep firing.', hud: 'RAPID', color: '#fff1c8' },
  lightning: { name: 'Chain lightning', kind: `${AMMO.lightning} bolts`, desc: 'Strikes the plane nearest your aim, then jumps to up to four more planes or bombs close by.', hud: 'LIGHTNING', color: '#c9b6ff' },
  cluster: { name: 'Cluster shells', kind: `${AMMO.cluster} shells`, desc: 'Each shell bursts into a spray of small bomblets that fill the sky around it.', hud: 'CLUSTER', color: '#ffd36a' },
};
const isWeapon = (id: UpgradeId): id is WeaponId => id in AMMO;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
let nextId = 1;

function waveSpec(wave: number, d: Difficulty = 'normal'): WaveSpec {
  const D = DIFFICULTY[d];
  // every plane goes down with one hit, so waves make up for it in numbers; a boss wave sends fewer of them
  const boss = wave % BOSS_EVERY === 0;
  const count = Math.round((4 + wave + Math.floor(wave / 2)) * D.planes * (boss ? .7 : 1));
  // hard skips ahead to the mix of later waves; the scripted first sightings below stay put
  const n = d === 'hard' ? wave + 3 : wave;
  let w: Partial<Record<PlaneType, number>>;
  if (n === 1) w = { recon: 1, light: 2 };
  else if (n === 2) w = { recon: .25, light: .45, fighter: .3 };
  else if (n <= 4) w = { recon: .2, light: .4, fighter: .2, heavy: .2 };
  else if (n <= 8) w = { recon: .15, light: .35, fighter: .25, heavy: .25 };
  else if (n <= 12) w = { recon: .1, light: .3, fighter: .3, heavy: .3 };
  else w = { recon: .05, light: .25, fighter: .35, heavy: .35 };
  const list: PlaneType[] = [];
  if (wave === 1) list.push('recon', 'light', 'light');
  if (wave === 2) list.push('fighter');
  if (wave === 3) list.push('heavy');
  if (wave >= 5 && wave <= 6) list.push('recon', 'light', 'fighter', 'heavy');
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  const keys = Object.keys(w) as PlaneType[];
  while (list.length < count) {
    let r = Math.random() * tot;
    for (const k of keys) { r -= w[k] ?? 0; if (r <= 0) { list.push(k); break; } }
  }
  list.sort(() => Math.random() - .5);
  return { count: list.length + (boss ? 1 : 0), list, boss };
}

/* ---------- co-op: the Bomber ---------- */
/** What the Bomber can do; up and down are held, the rest are taps. */
export type BomberAct = 'missile' | 'nuke' | 'dive' | 'switch' | 'grab' | 'use' | 'protect';
/** Protection: for a few seconds the Base's buildings, or the Bomber's plane, take 65% less damage. */
export const PROTECT = { time: 5, cd: 20, cut: .65 };
/** The Sniper (on the Bomber's side) points a harmless laser anywhere; after 3 seconds it hits there for 8% of a building's full strength. */
export const SNIPER = { delay: 3, share: .08, radius: 16 };
/** A laser: where it points, seconds until it hits, how long it waits in all, and the share of a building it takes */
export interface Snipe { x: number; y: number; t: number; d: number; share: number; }
/** Upgrades the Sniper's own metal arm can bring in: all of them make the laser better. */
export type SniperPerk = 'quick' | 'heavy' | 'volley';
export const SNIPER_PERKS: Record<SniperPerk, { name: string; desc: string }> = {
  quick: { name: 'Quick laser', desc: 'The next 3 lasers hit after 1 second' },
  heavy: { name: 'Heavy laser', desc: 'The next 3 lasers take 20%' },
  volley: { name: 'Laser volley', desc: 'The next laser is 5 lasers in a row' },
};
const SNIPER_PACKS: Record<'plain' | 'gold' | 'diamond', SniperPerk> = { plain: 'quick', gold: 'heavy', diamond: 'volley' };
export interface Sniper {
  name: string; arm: Arm | null; perk: SniperPerk | null; quickN: number; heavyN: number; volley: boolean; steals: number; grabCD: number;
  /** Missile and Nuke from the top of the sky, at the last spot the laser pointed */
  missileCD: number; nukeCD: number; aimX: number | null;
}
export type ArmOwner = 'bomber' | 'sniper';
/** Co-op with two Base players: a second turret just east of the base, with its own aim and the plain gun. */
export interface Gun2 { name: string; x: number; roll: number; aim: number; firing: boolean; oneShot: boolean; fireCD: number; recoil: number; flash: number; }
export const GUN2_X = 168;
/** where the Sniper's arm hangs from: the top of the sky, straight above where it caught the pack */
const SNIPER_ARM_Y = -720;
/** Upgrades the Bomber can steal with the metal arm. */
export type BomberPerk = 'shield' | 'barrage' | 'reload' | 'turbo' | 'armor' | 'rapid' | 'mega' | 'storm';
export const BOMBER_PERKS: Record<BomberPerk, { name: string; desc: string }> = {
  shield: { name: 'Plane shield', desc: 'Your plane cannot be hurt for 10 seconds.' },
  barrage: { name: 'Missile barrage', desc: 'Five missiles at once, spread across the base.' },
  reload: { name: 'Quick reload', desc: 'Missile, nuke and dive are ready again at once.' },
  armor: { name: 'Heavy armor', desc: 'Your plane is repaired and takes twice as many hits.' },
  turbo: { name: 'Turbo', desc: 'Your plane flies and climbs much faster for 15 seconds.' },
  rapid: { name: 'Rapid missiles', desc: 'A missile every 2 seconds for 20 seconds.' },
  mega: { name: 'Mega nuke', desc: 'A nuke from any height, with twice the blast.' },
  storm: { name: 'Firestorm', desc: 'A mega nuke and eight missiles at once, behind a 10 second shield.' },
};
/** What a stolen pack turns into: a plain crate, a gold pack and a diamond pack each have their own, better the rarer the pack. */
export const BOMBER_PACKS: Record<PackKind, BomberPerk[]> = { plain: ['shield', 'barrage', 'reload', 'turbo'], gold: ['armor', 'rapid', 'mega'], diamond: ['storm'] };
/** The metal arm that reels in a falling upgrade pack. */
export interface Arm { crate: Crate; hp: number; max: number; t: number; x0: number; y0: number; }
export interface Bomber {
  name: string; plane: Plane | null;
  /** seconds until a new plane after being shot down (0 while flying) */
  deadT: number;
  up: boolean; down: boolean;
  missileCD: number; nukeCD: number; diveCD: number; switchCD: number;
  /** a dive or strafing run in progress: seconds left, and whether it is the high strafe or the low dive */
  diveT: number; dive: 'high' | 'low' | null;
  /** after a low dive the plane climbs back to where it started, unless the player steers */
  returnY: number | null;
  arm: Arm | null; perk: BomberPerk | null; shieldT: number;
  /** seconds before the arm can go out again, after it brought a pack in or was shot off */
  grabCD: number;
  /** seconds left of Turbo and Rapid missiles */
  turboT: number; rapidT: number;
  /** Protection: seconds left, and until it can be used again */
  protectT: number; protectCD: number;
  damage: number; deaths: number; steals: number;
}
/** The Bomber's numbers: heights are shares of the sky from the ground (0) to SKY_TOP (1). */
export const BOMBER = {
  climb: 55, hp: 6, respawn: 5, missileCD: 8, nukeCD: 22, nukeAlt: 3 / 4, diveCD: 15, diveTime: 6, diveAlt: 7 / 15,
  armTime: 12, grabCD: 10, armRange: Infinity, touch: 24, cargoDps: 10, highDps: 4, lowDps: 8, shield: 10,
};
/** The top of the sky the Bomber can fly to, and the lowest it can go. */
export const SKY_TOP = -680, SKY_LOW = -50;
/** How high a point is, as a share of the sky: 0 on the ground, 1 at the top. */
export const heightOf = (y: number) => (GROUND_Y - y) / (GROUND_Y - SKY_TOP);
/** A snapshot of the Bomber for the controls (on a phone or on this screen). */
export interface BomberView {
  name: string; alive: boolean; deadT: number; height: number; hp: number; max: number;
  missile: number; nuke: number; dive: number; diving: boolean; canNuke: boolean;
  /** 0..1 of the arm's reel-in while one is out, else -1; whether a pack is in reach to grab */
  arm: number; canGrab: boolean; grabCD: number; perk: BomberPerk | null; shieldT: number; turboT: number; rapidT: number;
  /** Protection: cooldown share left, and seconds left while it is on */
  protect: number; protectT: number;
}

export class Game {
  settings = { reduceMotion: false, vibration: true };
  /** set before start() (and before reset(), for the title screen's backdrop); they hold for the whole game */
  difficulty: Difficulty = 'normal';
  mode: GameMode = 'original';
  t = 0; wave = 0; phase: Phase = 'idle'; phaseT = 0;
  aim = 0; cam = 0;
  /** where the gun in use stands, and where the camera is (it slides to the gun after a move) */
  gunX = 0; viewX = 0;
  /** war mode: the turrets from left to right and the one in use; seconds survived; friendly planes shot down;
   *  countdowns to the next enemy group and the next friendly plane; why the game ended */
  posts: Building[] = []; postI = 0; warT = 0; strikes = 0; enemyT = 0; friendT = 0; endReason = '';
  planes: Plane[] = []; bombs: Bomb[] = []; shells: Shell[] = []; missiles: Missile[] = []; pulses: Pulse[] = []; particles: Particle[] = [];
  tracers: Tracer[] = []; bolts: Bolt[] = []; crates: Crate[] = []; labels: Label[] = []; trails: { pts: TrailPoint[]; t: number }[] = [];
  cargo: Plane | null = null;
  /** when this wave's resupply plane takes off (seconds into combat), or null once it has flown */
  cargoAt: number | null = null;
  /** whether this wave's resupply plane is a gold plane */
  goldWave = false;
  /** where this drop's crate lands */
  lzX = LZ_SPOTS[1];
  buildings: Building[] = [];
  score = 0; mult = 1;
  fireCD = 0; recoil = 0; flash = 0;
  /** barrels on the gun: 1, 2 with dual shot, 3 with triple shot */
  guns = 1; fastLoad = false; heavyFlak = false; leech = false; shifter = false; ghost = false; dropShot = false; shieldT = 0; shieldFlash = 0;
  /** the gold and diamond perks owned, whether Last stand has been used, the point defense countdown, and a guard so a spark or wreck can't set off another */
  perks = new Set<PerkId>(); lastStandUsed = false; sweepT = SWEEP_EVERY; chaining = false;
  weapon: WeaponId | null = null; ammo = 0;
  lasing = false; laserSnd = 0; nukeFlash = 0;
  lock: Lock = { target: null, t: 0, step: 0, locked: false };
  stats = { shots: 0, hitShots: 0, kills: 0, intercepts: 0 };
  wind = 0;
  spawnQueue: { t: number; types: (PlaneType | 'boss')[] }[] = [];
  spec: WaveSpec = waveSpec(1);
  /** oneShot: a tap that ended before the next frame still fires once (war mode holds a tap back briefly to tell it from a swipe) */
  shake = 0; firing = false; tapEdge = false; oneShot = false; waveDamaged = false;
  palFrom: PaletteId = paletteForWave(1); palTo: PaletteId = this.palFrom; palT = 1;
  timeScale = 1; overT = 0; clearInfo: ClearInfo | null = null; lastVibe = 0;
  /** co-op: the Bomber's name (set before start) and its state during a game */
  bomberName: string | null = 'Bomber'; bomber: Bomber | null = null;
  /** co-op: the Sniper's lasers waiting to hit, and the damage they have done; the Base's Protection */
  sniperName: string | null = null; sniper: Sniper | null = null;
  /** co-op: the second Base player's name (set before start) and turret */
  secondBaseName: string | null = null; gun2: Gun2 | null = null;
  /** which gun this screen's own fire button works: the second turret when the second Base plays here */
  localGun: 1 | 2 = 1;
  snipes: Snipe[] = []; sniperDamage = 0; protectT = 0; protectCD = 0;
  /** set while the Bomber's own attacks hurt the base, so the damage is credited to the Bomber */
  blame = false; blameSniper = false;
  /** adventure: iron and shop levels (main.ts loads and saves them) */
  adv: Adventure = newAdventure();
  /** co-op: flak bursts and explosions since the last snapshot, so the phones can draw them too ([0 flak | 1 air | 2 ground, x, y, size]) */
  fxLog: [number, number, number, number][] | null = null;

  constructor(private hooks: Hooks) {
    this.reset();
  }

  reset() {
    this.t = 0;
    this.wave = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.aim = 0; this.cam = 0;
    this.planes = []; this.bombs = []; this.shells = []; this.missiles = []; this.pulses = []; this.particles = [];
    this.tracers = []; this.bolts = []; this.crates = []; this.labels = []; this.trails = [];
    this.cargo = null; this.cargoAt = null; this.lzX = LZ_SPOTS[1];
    const make = (d: BuildingDef, x: number, name = d.name): Building => ({ def: d, id: d.id, name, x, half: d.half, hp: d.hp, max: d.hp, ruined: false, hit: 0, smokeT: 0, ruinT: 0 });
    this.buildings = BUILDINGS.map(d => make(d, mockToWorld(d.mx, 800)[0]));
    if (this.mode === 'war') {
      // a turret out on its own either side of the base
      const def = BUILDINGS.find(d => d.id === 'turret')!;
      const out = WAR_POSTS.filter(x => x !== 0).map(x => ({ ...make(def, x, x < 0 ? 'West turret' : 'East turret'), outpost: true }));
      this.buildings = [...out.filter(b => b.x < 0), ...this.buildings, ...out.filter(b => b.x > 0)];
    }
    // adventure: the turret stands on its own, weak to start
    if (this.adventure) { this.buildings = this.buildings.filter(b => b.id === 'turret'); const t = this.b('turret'); t.max = t.hp = t.def.hp * this.advHpShare; }
    this.gun2 = null;
    if (!this.coop) this.localGun = 1;
    if (this.coop && this.secondBaseName !== null) {
      const def = BUILDINGS.find(d => d.id === 'turret')!;
      this.buildings.push({ ...make(def, GUN2_X, 'Second turret'), outpost: true });
      this.gun2 = { name: this.secondBaseName, x: GUN2_X, roll: 0, aim: 0, firing: false, oneShot: false, fireCD: 0, recoil: 0, flash: 0 };
    }
    this.posts = this.buildings.filter(b => b.id === 'turret' && (this.war || !b.outpost));
    this.postI = this.posts.findIndex(b => !b.outpost);
    this.gunX = this.viewX = this.post().x;
    this.warT = 0; this.strikes = 0; this.enemyT = 0; this.friendT = 0; this.endReason = '';
    this.score = 0; this.mult = 1;
    this.fireCD = 0; this.recoil = 0; this.flash = 0;
    this.guns = 1; this.fastLoad = false; this.heavyFlak = false; this.leech = false; this.shifter = false; this.ghost = false; this.dropShot = false; this.perks = new Set(); this.lastStandUsed = false; this.sweepT = SWEEP_EVERY; this.chaining = false; this.goldWave = false; this.shieldT = 0; this.shieldFlash = 0;
    this.weapon = null; this.ammo = 0;
    this.lasing = false; this.laserSnd = 0; this.nukeFlash = 0;
    this.lock = { target: null, t: 0, step: 0, locked: false };
    this.stats = { shots: 0, hitShots: 0, kills: 0, intercepts: 0 };
    this.wind = 0;
    this.spawnQueue = [];
    this.spec = waveSpec(1, this.difficulty);
    this.shake = 0;
    this.firing = false; this.tapEdge = false;
    this.waveDamaged = false;
    this.palFrom = paletteForWave(1); this.palTo = this.palFrom; this.palT = 1;
    this.timeScale = 1;
    this.overT = 0;
    this.clearInfo = null;
    this.lastVibe = 0;
    this.bomber = this.coop && this.bomberName !== null ? {
      name: this.bomberName, plane: null, deadT: 0, up: false, down: false, missileCD: 2, nukeCD: 4, diveCD: 4, switchCD: 0,
      diveT: 0, dive: null, returnY: null, arm: null, perk: null, shieldT: 0, grabCD: 0, turboT: 0, rapidT: 0, protectT: 0, protectCD: 0, damage: 0, deaths: 0, steals: 0,
    } : null;
    this.sniper = this.coop && this.sniperName !== null ? { name: this.sniperName, arm: null, perk: null, quickN: 0, heavyN: 0, volley: false, steals: 0, grabCD: 0, missileCD: 2, nukeCD: 4, aimX: null } : null;
    this.snipes = []; this.protectT = 0; this.protectCD = 0; this.sniperDamage = 0;
  }

  get D() { return DIFFICULTY[this.difficulty]; }
  /** The base's own building of this kind (in war mode the outposts are turrets too, but never this one). */
  b(id: BuildingId): Building { return this.buildings.find(b => b.id === id && !b.outpost)!; }
  has(id: BuildingId) { return this.buildings.some(b => b.id === id && !b.outpost); }
  /** Whether a building is standing. In adventure only the turret is built: radar warnings and supply drops still work, but there is no searchlight. */
  alive(id: BuildingId) { return this.has(id) ? !this.b(id).ruined : this.adventure && id !== 'search'; }
  /** The turret's health as a share of a normal turret's (in adventure it starts at 20%). */
  turretPct() { const t = this.b('turret'); return t.ruined ? 0 : Math.max(1, Math.round(t.hp / t.def.hp * 100)); }
  /** The turret the player is using. */
  post(): Building { return this.posts[this.postI]; }
  get war() { return this.mode === 'war'; }
  get coop() { return this.mode === 'coop'; }
  get adventure() { return this.mode === 'adventure'; }
  get advHpShare() { return ADV_HP_START + ADV_HP_STEP * this.adv.health; }
  /** adventure: shell damage and the gun's reload with the shop's levels (1 elsewhere) */
  get shellDmg() { return this.adventure ? 1 + .25 * this.adv.damage : 1; }
  get rateMul() { return this.adventure ? 1 / (1 + .15 * this.adv.rate) : 1; }
  /** Whether a shop item can be bought now, and why not. */
  shopBlock(id: ShopId): string | null {
    const it = SHOP[id];
    if (id === 'repair') {
      const t = this.b('turret');
      if (this.phase === 'idle' || this.ended) return 'During a game';
      if (t.hp >= t.max) return 'Full health';
    } else if (this.adv[id] >= it.max) return 'Maxed';
    return this.adv.iron < this.shopCost(id) ? 'Not enough iron' : null;
  }
  shopCost(id: ShopId) { return SHOP[id].cost(id === 'repair' ? 0 : this.adv[id]); }
  buy(id: ShopId) {
    if (this.shopBlock(id)) return false;
    this.adv.iron -= this.shopCost(id);
    const t = this.b('turret');
    if (id === 'repair') t.hp = t.max;
    else {
      this.adv[id]++;
      // more max health also adds that much health to a standing turret
      if (id === 'health' && this.adventure && !t.ruined) { const m = t.def.hp * this.advHpShare; t.hp += m - t.max; t.max = m; }
    }
    return true;
  }
  get ended() { return this.phase === 'over' || this.phase === 'won'; }
  /** Planes U-turn (or, if friendly, leave) past this x. */
  get xe() { return this.war ? WAR_XE : XE; }
  /** Whether the gun has finished sliding over to the turret in use. */
  get settled() { return Math.abs(this.viewX - this.gunX) < 12; }

  start() {
    this.reset();
    if (this.war) this.startWar(); else this.startWave(1);
  }

  /* ---------- war mode ---------- */
  startWar() {
    this.wave = 1;
    this.phase = 'intro'; this.phaseT = 0;
    this.enemyT = 3; this.friendT = .5;
    this.wind = 0; Sound.setWind(0);
    this.palFrom = this.palTo = paletteForWave(1); this.palT = 1;
    this.hooks.waveStart && this.hooks.waveStart(1);
    this.tip('swipe', 'Swipe left or right to move to another turret.');
  }
  /** Moves to the next standing turret in that direction (-1 left, 1 right). Returns whether it moved. */
  move(dir: number) {
    if (!this.war || this.ended || this.phase === 'idle') return false;
    for (let i = this.postI + dir; i >= 0 && i < this.posts.length; i += dir) {
      if (this.posts[i].ruined) continue;
      this.goTo(i);
      return true;
    }
    Sound.denied();
    return false;
  }
  goTo(i: number) {
    this.postI = i; this.gunX = this.posts[i].x;
    this.firing = false; this.lasing = false;
    this.lock = { target: null, t: 0, step: 0, locked: false };
    Sound.click();
  }
  updateWar(dt: number) {
    if (this.phase !== 'combat') return;
    this.warT += dt;
    if (this.warT >= WAR_TIME) { this.levelWon(); return; }
    // the pressure builds over the level
    const k = this.warT / WAR_TIME, D = this.D;
    let enemies = 0, friends = 0;
    for (const p of this.planes) if (p.state !== 'falling' && p.type !== 'cargo') p.friend ? friends++ : enemies++;
    this.enemyT -= dt;
    if (this.enemyT <= 0 && enemies < (5 + 5 * k) * D.planes) {
      const w: [PlaneType, number][] = k < .12 ? [['recon', 1], ['light', 2]] : [['recon', .15], ['light', .4], ['fighter', .25 + .1 * k], ['heavy', .15 + .1 * k]];
      const tot = w.reduce((a, [, v]) => a + v, 0);
      const n = 1 + D.group + (Math.random() < .25 + .35 * k ? 1 : 0);
      for (let i = 0; i < n; i++) {
        let r = Math.random() * tot;
        const type = w.find(([, v]) => (r -= v) <= 0)?.[0] ?? 'light';
        this.spawnPlane(type, i);
      }
      this.enemyT = rand(5, 8) * (1 - .4 * k) * D.gap;
    }
    // friendly planes come through often, crossing the line of fire
    this.friendT -= dt;
    if (this.friendT <= 0) {
      if (friends < 5) this.spawnFriend();
      this.friendT = rand(2.5, 5);
    }
  }
  spawnFriend() {
    const type = pick(FRIEND_TYPES), T = TYPES[type];
    const dir = Math.random() < .5 ? 1 : -1;
    const alt = rand(-580, -320);
    const p: Plane = {
      id: nextId++, type, dir, x: -dir * (this.xe + 60), y: alt, alt, speed: T.speed * (type === 'heavy' ? 1.4 : 1.05) * rand(.95, 1.05),
      hp: 1, max: 1, state: 'fly', pitch: 0, flip: 1, turnT: 0, hits: [], trail: [], trailT: 0,
      dropCD: 0, diveCD: 0, stateT: 0, burnT: 0, burning: false, smokeT: 0, hitFlash: 0,
      vx: 0, vy: 0, spin: 0, lightPhase: Math.random() * 6, friend: true,
      dropAt: Math.random() < FRIEND_CARRY ? pick(this.posts) : null, gunCD: rand(2, 6),
    };
    this.planes.push(p);
    this.tip('friendly', 'Planes marked green are friendly. Shoot down three and the level is lost.');
    return p;
  }
  /** A friendly plane flies straight across and leaves; one carrying a crate lets it go near its turret. */
  updateFriend(p: Plane, dt: number) {
    p.x += p.dir * p.speed * dt;
    const climb = clamp(p.alt - p.y, -18 * dt, 18 * dt);
    p.y += climb;
    p.pitch += ((climb / dt) / p.speed * .8 - p.pitch) * Math.min(1, dt * 3);
    const t = p.dropAt;
    if (t && !this.ended && (t.x - p.x) * p.dir <= 60) {
      // one crate at a time per turret; otherwise try the next turret ahead
      const lz = this.lzFor(t);
      if (!t.ruined && !this.crates.some(c => Math.abs(c.lz - lz) < 100)) {
        this.crates.push({ x: p.x, y: p.y + 6, vx: p.dir * p.speed, vy: (LZ_Y - p.y - 6) / CRATE_FALL, lz, landed: false, t: 0, sway: 0 });
        this.tip('friendDrop', 'A friendly plane dropped an upgrade. Move to that turret to open it.');
        p.dropAt = null;
      } else p.dropAt = this.posts.find(b => (b.x - t.x) * p.dir > 0) ?? null;
    }
    if (Math.abs(p.x) > this.xe + 120) { p.dead = true; Sound.stopEngine(p.id); }
  }
  /** Where a crate dropped for this turret lands: beside it, on the side with room. */
  lzFor(b: Building) { return b.outpost ? b.x + (b.x < 0 ? 44 : -44) : pick(LZ_SPOTS); }
  /** Friendly and enemy planes trade short bursts of fire. It looks the part but does no real harm. */
  dogfight(p: Plane, dt: number) {
    if (p.gunT && p.gunT > 0) {
      p.gunT -= dt;
      const t = p.gunAt;
      if (!t || t.dead || t.state === 'falling' || p.state === 'falling') { p.gunT = 0; return; }
      if (Math.random() < dt * 18) {
        const [nx, ny] = this.planePoint(p, 1, 0);
        this.tracers.push({ x0: nx, y0: ny, x1: t.x + rand(-9, 9), y1: t.y + rand(-4, 4), life: .12 });
        if (Math.random() < .4) this.particles.push({ k: 'spark', x: t.x + rand(-4, 4), y: t.y + rand(-2, 2), vx: rand(-30, 30), vy: rand(-30, 30), life: .3, t: 0, r: .5 });
      }
      if (p.gunT <= 0 && Math.random() < .35 && !t.hits.length) { t.hits.push({ u: rand(-.6, .3), v: rand(-1, 1) }); t.hitFlash = .6; }
      return;
    }
    p.gunCD = (p.gunCD ?? rand(3, 8)) - dt;
    if (p.gunCD > 0 || p.state !== 'fly' || this.ended) return;
    p.gunCD = rand(4, 9);
    for (const q of this.planes) {
      if (!q.friend === !p.friend || q.type === 'cargo' || q.dead || q.state === 'falling') continue;
      const dx = q.x - p.x;
      if (Math.sign(dx) === p.dir && Math.abs(dx) < 220 && Math.abs(q.y - p.y) < 90) {
        p.gunT = rand(.6, 1); p.gunAt = q;
        Sound.minigun(this.panOf(p.x, p.y));
        return;
      }
    }
  }
  /** Shooting down a friendly plane: it goes down, and three of them lose the level. */
  friendlyDown(p: Plane) {
    if (p.state === 'falling' || p.dead) return;
    p.vx = p.dir * p.speed * .9; p.vy = 0; p.spin = 0;
    p.state = 'falling'; p.stateT = 0;
    if (!p.hits.length) p.hits.push({ u: 0, v: 0 });
    this.strikes++;
    this.explosion(p.x, p.y, .8, false);
    Sound.boom(false, this.panOf(p.x, p.y)); Sound.denied();
    this.addScore(-500, p.x, p.y, 'Friendly fire');
    this.labels.push({ text: `Friendly down ${this.strikes}/${WAR_STRIKES}`, x: this.gunX, y: GROUND_Y - 70, t: 0, life: 2.6, color: '#ff8a7a', big: true });
    this.vibrate(120);
    if (this.strikes >= WAR_STRIKES) this.gameOver('You shot down three friendly planes.');
  }
  levelWon() {
    this.phase = 'won'; this.phaseT = 0;
    this.firing = false;
    const k = this.D.score;
    this.score += Math.round(2000 * k) + Math.round(1000 * this.baseHealth() * k);
    this.labels.push({ text: 'Level complete', x: this.gunX, y: GROUND_Y - 80, t: 0, life: 3, color: '#bff5cf', big: true });
    Sound.pop();
    const done = this.hooks.gameOver;
    if (done) setTimeout(() => done(this.results()), 3200);
  }

  /* ---------- co-op: the Bomber ---------- */
  /** Holding the up or down button. */
  bomberHold(dir: 'up' | 'down', on: boolean) {
    const b = this.bomber;
    if (!b) return;
    b[dir] = on;
    if (on) b.returnY = null;
  }
  /** A Bomber button. `crate` is a falling pack that was clicked; otherwise grab takes the nearest one in reach. Returns whether anything happened. */
  bomberAct(a: BomberAct, crate: Crate | null = null): boolean {
    const b = this.bomber, p = b?.plane;
    if (!b || !p || this.ended || this.phase === 'idle') return false;
    switch (a) {
      case 'missile':
        if (b.missileCD > 0) return false;
        b.missileCD = b.rapidT > 0 ? 2 : BOMBER.missileCD; this.bomberMissile(p);
        return true;
      case 'nuke':
        if (b.nukeCD > 0 || heightOf(p.y) < BOMBER.nukeAlt) return false;
        b.nukeCD = BOMBER.nukeCD; this.bomberNuke(p, false);
        return true;
      case 'dive': return this.bomberDive(p);
      case 'switch': return this.bomberSwitch();
      case 'grab': return this.bomberGrab(p, crate);
      case 'use': return this.bomberUse(p);
      case 'protect':
        if (b.protectCD > 0) return false;
        b.protectT = PROTECT.time; b.protectCD = PROTECT.cd + PROTECT.time; Sound.shield();
        this.labels.push({ text: 'Protection', x: p.x, y: p.y - 24, t: 0, life: 1.6, color: '#ffd34a', big: true });
        return true;
    }
    return false;
  }
  /** Where the Bomber's shots go: the standing building nearest to where a drop from here would come down, so every attack lands on the base. */
  bomberTarget(p: Plane, T: number) {
    const land = p.x + p.dir * Math.max(45, p.speed) / 2 * (1 - Math.exp(-MISSILE_DRAG * T)) / MISSILE_DRAG;
    let tx = 0, best = Infinity;
    for (const bb of this.buildings) {
      if (bb.ruined) continue;
      const d = Math.abs(land - bb.x);
      if (d < best) { best = d; tx = bb.x; }
    }
    return tx;
  }
  /** The throw that brings a drop from the plane down on `tx`. */
  bomberThrow(p: Plane, tx: number, T: number, wa: number) { return (tx - p.x - .5 * wa * T * T) * MISSILE_DRAG / (1 - Math.exp(-MISSILE_DRAG * T)); }
  /** A normal missile at the base (or at `aimX`). */
  bomberMissile(p: Plane, aimX: number | null = null) {
    const T = clamp(24 * (GROUND_Y - p.y) / 460, 7, 24), wa = this.wind;
    const tx = aimX ?? this.bomberTarget(p, T);
    this.dropBomb(p, 'missile', T, this.bomberThrow(p, tx, T, wa), MISSILE_DRAG, wa).byBomber = true;
    Sound.missile();
  }
  /** A nuke: a big slow bomb that takes three hits to shoot down (five for a mega nuke) and wrecks most of the base if it lands. */
  bomberNuke(p: Plane, mega: boolean) {
    const T = clamp(16 * (GROUND_Y - p.y) / 520, 6, 16), wa = this.wind * .04;
    // it glides down onto the base, aimed at the building nearest its path
    const bomb = this.dropBomb(p, 'nuke', T, this.bomberThrow(p, this.bomberTarget(p, T), T, wa), MISSILE_DRAG, wa);
    bomb.byBomber = true; bomb.hp = mega ? 5 : 3; bomb.mega = mega;
    this.labels.push({ text: mega ? 'Mega nuke incoming!' : 'Nuke incoming!', x: this.gunX, y: GROUND_Y - 80, t: 0, life: 2.6, color: '#ff8a7a', big: true });
    this.tip('bomberNuke', 'The Bomber dropped a nuke. It takes three hits: shoot it down before it lands.');
    Sound.missile(); Sound.whine(1.5, this.panOf(p.x, p.y));
  }
  nukeLands(b: Bomb) {
    const k = b.mega ? 2 : 1, R = b.mega ? 280 : 200;
    this.explosion(b.x, GROUND_Y - 3, b.mega ? 4.5 : 3.5, true);
    this.particles.push({ k: 'ring', x: b.x, y: GROUND_Y - 10, r: 10, grow: R / .55, life: .7, t: 0, vx: 0, vy: 0 });
    this.particles.push({ k: 'flash', x: b.x, y: GROUND_Y - 10, r: R * .6, life: .9, t: 0, vx: 0, vy: 0 });
    this.nukeFlash = 1;
    if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, 14);
    Sound.nuke(this.panOf(b.x, GROUND_Y));
    this.vibrate(250);
    for (const bb of this.buildings) {
      const d = Math.max(0, Math.abs(b.x - bb.x) - bb.half);
      if (d < R) this.damageBuilding(bb, (d <= 0 ? 300 : 150 * (1 - .5 * d / R)) * k);
    }
  }
  /** Above 7/15 of the sky: six seconds of strafing the base from up high. Below: a dive down close to the base, firing. */
  bomberDive(p: Plane) {
    const b = this.bomber!;
    if (b.diveCD > 0 || b.diveT > 0) return false;
    b.diveT = BOMBER.diveTime;
    b.diveCD = BOMBER.diveCD + BOMBER.diveTime;
    b.dive = heightOf(p.y) >= BOMBER.diveAlt ? 'high' : 'low';
    if (b.dive === 'low') { b.returnY = p.y; Sound.whine(1.2, this.panOf(p.x, p.y)); }
    Sound.minigun(this.panOf(p.x, p.y));
    this.tip('bomberDive', b.dive === 'high' ? 'The Bomber is strafing your base from high up. Shoot it down!' : 'The Bomber is diving at your base. Now it is close: shoot it!');
    return true;
  }
  /** A line of tracer fire walking along the base under the plane; every building it reaches takes damage. */
  bomberStrafe(p: Plane, dt: number, impact: number, dps: number) {
    if (Math.random() < dt * 20) {
      const [nx, ny] = this.planePoint(p, 1, 0);
      this.tracers.push({ x0: nx, y0: ny, x1: impact + rand(-8, 8), y1: GROUND_Y - rand(0, 6), life: .14 });
      if (Math.random() < .5) this.addPuff(impact + rand(-8, 8), GROUND_Y - 2, 'dust', rand(1.5, 3), 3, .55, rand(-4, 4), -8);
    }
    const b = this.bomber!;
    if (Math.floor(b.diveT / .45) !== Math.floor((b.diveT + dt) / .45)) Sound.minigun(this.panOf(p.x, p.y));
    this.blame = true;
    for (const bb of this.buildings) if (!bb.ruined && Math.abs(bb.x - impact) < bb.half + 10) this.damageBuilding(bb, dps * dt, true);
    this.blame = false;
  }
  /** S: fly the next enemy plane along instead (to the right, wrapping round). */
  bomberSwitch() {
    const b = this.bomber!, cur = b.plane;
    if (!cur || b.switchCD > 0) return false;
    const foes = this.planes.filter(q => q !== cur && q.type !== 'cargo' && !q.friend && !q.dead && q.state !== 'falling').sort((a, c) => a.x - c.x);
    if (!foes.length) return false;
    this.possess(foes.find(q => q.x > cur.x) ?? foes[0]);
    b.switchCD = .4;
    return true;
  }
  possess(p: Plane) {
    const b = this.bomber!;
    if (b.plane && b.plane !== p) this.unpossess(b.plane);
    this.dropArm();
    p.player = true; p.chaseCargo = false; p.burning = false;
    // a plane the Bomber flies takes six hits (a boss keeps its own health)
    if (p.max === 1) p.max = p.hp = BOMBER.hp;
    if (p.state !== 'turn') { p.state = 'fly'; p.stateT = 0; }
    p.alt = p.y;
    b.plane = p; b.dive = null; b.diveT = 0; b.returnY = null;
  }
  /** A plane the Bomber leaves goes back to flying itself. */
  unpossess(p: Plane) {
    p.player = false;
    if (p.state !== 'turn' && p.state !== 'falling') { p.state = 'fly'; p.stateT = 0; }
    p.alt = pick(TYPES[p.type].alts);
    p.diveCD = rand(4, 9) * this.D.fire; p.dropCD = rand(2, 5) * this.D.fire;
  }
  /** A new plane for the Bomber, flying in from one side. */
  spawnBomber() {
    const b = this.bomber!;
    const p = this.spawnPlane('light', 0);
    p.y = p.alt = -450; p.speed = 55;
    this.possess(p);
    this.labels.push({ text: `${b.name} is back`, x: 0, y: GROUND_Y - 70, t: 0, life: 2, color: '#ff8a7a', big: true });
  }
  bomberDown(p: Plane) {
    const b = this.bomber;
    if (!b || b.plane !== p) return;
    this.dropArm();
    p.player = false;
    b.plane = null; b.deadT = BOMBER.respawn; b.deaths++; b.dive = null; b.diveT = 0; b.returnY = null; b.shieldT = 0; b.turboT = 0;
    this.labels.push({ text: `${b.name} shot down`, x: p.x, y: p.y - 26, t: 0, life: 2.4, color: '#bff5cf', big: true });
  }
  /** The falling pack the arm can reach from the plane, nearest first. */
  grabbable(p: Plane): Crate | null {
    let best: Crate | null = null, bd = BOMBER.armRange;
    for (const c of this.crates) {
      if (c.dead || c.held) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  bomberGrab(p: Plane, crate: Crate | null) {
    const b = this.bomber!;
    if (b.arm || b.grabCD > 0) return false;
    const c = crate ? (!crate.dead && !crate.held ? crate : null) : this.grabbable(p);
    if (!c) return false;
    this.startArm(c, 'bomber');
    return true;
  }
  /** The pack the Sniper's arm goes for: the best one anywhere (diamond, then gold), the newest first. */
  sniperGrabbable(): Crate | null {
    let best: Crate | null = null, bv = -1;
    for (const c of this.crates) {
      if (c.dead || c.held) continue;
      const v = c.diamond ? 2 : c.gold ? 1 : 0;
      if (v >= bv) { bv = v; best = c; }
    }
    return best;
  }
  /** The Sniper's buttons: send the arm down for a pack, or use the upgrade it brought in. */
  sniperAct(a: BomberAct, crate: Crate | null = null): boolean {
    const s = this.sniper;
    if (!s || this.ended || this.phase === 'idle') return false;
    if (a === 'grab') {
      if (s.arm || s.grabCD > 0) return false;
      const c = crate && !crate.dead && !crate.held ? crate : this.sniperGrabbable();
      if (!c) return false;
      this.startArm(c, 'sniper');
      return true;
    }
    if (a === 'missile' || a === 'nuke') {
      const nuke = a === 'nuke';
      if (nuke ? s.nukeCD > 0 : s.missileCD > 0) return false;
      if (nuke) s.nukeCD = BOMBER.nukeCD; else s.missileCD = BOMBER.missileCD;
      // it falls from high up to one side of the last laser spot (or the middle of the base)
      const tx = s.aimX ?? 0, side = Math.random() < .5 ? -1 : 1;
      const from = { x: clamp(tx + side * rand(80, 160), -this.xe, this.xe), y: SKY_TOP, type: 'light', player: true, dir: -side, speed: 0 } as unknown as Plane;
      if (nuke) {
        const T = 16, wa = this.wind * .04;
        const bomb = this.dropBomb(from, 'nuke', T, this.bomberThrow(from, this.nearestBuildingX(tx), T, wa), MISSILE_DRAG, wa);
        bomb.bySniper = true; bomb.hp = 3;
        this.labels.push({ text: 'Nuke incoming!', x: this.gunX, y: GROUND_Y - 80, t: 0, life: 2.6, color: '#ff8a7a', big: true });
        this.tip('sniperNuke', 'The Sniper called in a nuke. It takes three hits: shoot it down before it lands.');
        Sound.missile(); Sound.whine(1.5, this.panOf(from.x, from.y));
      } else {
        const T = 24, wa = this.wind;
        this.dropBomb(from, 'missile', T, this.bomberThrow(from, tx, T, wa), MISSILE_DRAG, wa).bySniper = true;
        Sound.missile();
      }
      return true;
    }
    if (a === 'use' && s.perk) {
      const k = s.perk;
      s.perk = null;
      if (k === 'quick') s.quickN = 3; else if (k === 'heavy') s.heavyN = 3; else s.volley = true;
      Sound.pop();
      this.labels.push({ text: SNIPER_PERKS[k].name, x: this.gunX, y: GROUND_Y - 90, t: 0, life: 2, color: '#ff8a7a', big: true });
      return true;
    }
    return false;
  }
  /** The metal arm closes on a falling pack. It has a fifth of a boss's health, and takes 12 seconds to reel the pack in. */
  startArm(c: Crate, who: ArmOwner) {
    const owner = who === 'sniper' ? this.sniper : this.bomber;
    if (!owner) return;
    const hp = Math.max(3, Math.round(bossHp(Math.max(BOSS_EVERY, this.wave), this.difficulty) / 5));
    // a pack already waiting on the pad is lifted back off it
    c.held = true; c.landed = false;
    owner.arm = { crate: c, hp, max: hp, t: 0, x0: c.x, y0: c.y };
    this.labels.push({ text: who === 'sniper' ? 'Sniper arm!' : 'Metal arm!', x: c.x, y: c.y - 16, t: 0, life: 2, color: '#ff8a7a', big: true });
    this.tip('arm', `The ${who === 'sniper' ? 'Sniper' : 'Bomber'} has a metal arm on your upgrade. Shoot the arm to make it let go.`);
    Sound.whine(.6, this.panOf(c.x, c.y));
  }
  /** An arm that is out: the Bomber's (while it has a plane) or the Sniper's. */
  armOf(who: ArmOwner): Arm | null {
    if (who === 'sniper') return this.sniper?.arm ?? null;
    return this.bomber?.plane ? this.bomber.arm : null;
  }
  /** Where an arm hangs from: under the Bomber's plane, or from the top of the sky for the Sniper's. */
  armHead(who: ArmOwner): [number, number] | null {
    const a = this.armOf(who);
    if (!a) return null;
    if (who === 'sniper') return [a.x0, SNIPER_ARM_Y];
    const p = this.bomber!.plane!;
    return [p.x, p.y + 4];
  }
  /** A point along the arm: 0 at the plane (or sky), 1 at the pack. */
  armPoint(k: number, who: ArmOwner = 'bomber'): [number, number] {
    const a = this.armOf(who), h = this.armHead(who);
    if (!a || !h) return [NaN, NaN];
    const [hx, hy] = h;
    return [hx + (a.crate.x - hx) * k, hy + (a.crate.y - 4 - hy) * k];
  }
  /** which arm the last armDist was nearest to */
  private armNear: ArmOwner = 'bomber';
  /** How far (x, y) is from the nearest arm, or Infinity when there is no arm out. */
  armDist(x: number, y: number) {
    let best = Infinity;
    for (const who of ['bomber', 'sniper'] as const) {
      if (!this.armOf(who)) continue;
      const [x0, y0] = this.armPoint(0, who), [x1, y1] = this.armPoint(1, who);
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1);
      const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
      if (d < best) { best = d; this.armNear = who; }
    }
    return best;
  }
  hitArm(dmg: number, who: ArmOwner = this.armNear) {
    const a = this.armOf(who);
    if (!a) return;
    a.hp -= dmg;
    // the Sniper's arm is hit low down, near the pack, where the gun can see it
    const [mx, my] = this.armPoint(who === 'sniper' ? .9 : .5, who);
    this.particles.push({ k: 'spark', x: mx, y: my, vx: rand(-40, 40), vy: rand(-40, 40), life: .3, t: 0, r: .6 });
    if (a.hp > 0) { if (dmg >= 1) Sound.hitPlane(this.panOf(mx, my)); return; }
    this.addScore(150, mx, my, 'Arm destroyed');
    this.explosion(mx, my, .7, false);
    Sound.boom(false, this.panOf(mx, my));
    this.dropArm(who);
  }
  /** The arm lets go (it was shot off, or the plane went down or changed): the pack floats on down to the pad. */
  dropArm(who: ArmOwner = 'bomber') {
    const b = who === 'sniper' ? this.sniper : this.bomber, a = b?.arm;
    if (!b || !a) return;
    b.arm = null; b.grabCD = BOMBER.grabCD;
    const c = a.crate;
    c.held = false;
    if (!c.dead && !c.landed) { const left = clamp((LZ_Y - c.y) / 45, 3, CRATE_FALL); c.vy = (LZ_Y - c.y) / left; c.vx = 0; }
  }
  updateArm(dt: number) {
    const b = this.bomber!, a = b.arm, p = b.plane;
    if (!a || !p) return;
    const c = a.crate;
    if (c.dead) { b.arm = null; return; }
    a.t += dt;
    // the pack is reeled in from where the arm caught it up to the plane
    const k = Math.min(1, a.t / BOMBER.armTime), e = k * k * (3 - 2 * k);
    c.x = a.x0 + (p.x - a.x0) * e; c.y = a.y0 + (p.y + 9 - a.y0) * e;
    c.sway = Math.sin(this.t * 2.3) * .25;
    if (a.t < BOMBER.armTime) return;
    c.dead = true; b.arm = null; b.steals++; b.grabCD = BOMBER.grabCD;
    b.perk = pick(BOMBER_PACKS[c.diamond ? 'diamond' : c.gold ? 'gold' : 'plain']);
    this.labels.push({ text: `${b.name} stole the upgrade`, x: p.x, y: p.y - 26, t: 0, life: 2.6, color: '#ff8a7a', big: true });
    Sound.denied();
  }
  nearestBuildingX(x: number) {
    let tx = x, best = Infinity;
    for (const bb of this.buildings) if (!bb.ruined && Math.abs(bb.x - x) < best) { best = Math.abs(bb.x - x); tx = bb.x; }
    return tx;
  }
  /** The Sniper's arm reels its pack up into the sky in the same 12 seconds. */
  updateSniperArm(dt: number) {
    const s = this.sniper;
    if (s) { s.grabCD = Math.max(0, s.grabCD - dt); s.missileCD = Math.max(0, s.missileCD - dt); s.nukeCD = Math.max(0, s.nukeCD - dt); }
    const a = s?.arm;
    if (!s || !a) return;
    const c = a.crate;
    if (c.dead) { s.arm = null; return; }
    a.t += dt;
    const k = Math.min(1, a.t / BOMBER.armTime), e = k * k * (3 - 2 * k);
    c.x = a.x0; c.y = a.y0 + (SNIPER_ARM_Y + 40 - a.y0) * e;
    c.sway = Math.sin(this.t * 2.3) * .25;
    if (a.t < BOMBER.armTime) return;
    c.dead = true; s.arm = null; s.steals++; s.grabCD = BOMBER.grabCD;
    s.perk = SNIPER_PACKS[c.diamond ? 'diamond' : c.gold ? 'gold' : 'plain'];
    this.labels.push({ text: `${s.name} stole the upgrade`, x: this.gunX, y: GROUND_Y - 90, t: 0, life: 2.6, color: '#ff8a7a', big: true });
    Sound.denied();
  }
  /** Uses the upgrade the arm brought in. */
  bomberUse(p: Plane) {
    const b = this.bomber!, k = b.perk;
    if (!k) return false;
    b.perk = null;
    switch (k) {
      case 'shield': b.shieldT = BOMBER.shield; Sound.shield(); break;
      case 'barrage': {
        const aims = this.buildings.filter(bb => !bb.ruined).map(bb => bb.x);
        for (let i = 0; i < 5; i++) this.bomberMissile(p, (aims.length ? aims[i % aims.length] : 0) + rand(-6, 6));
        break;
      }
      case 'reload': b.missileCD = b.nukeCD = b.diveCD = 0; Sound.pop(); break;
      case 'armor': p.max = BOMBER.hp * 2; p.hp = p.max; p.hits = []; Sound.shield(); break;
      case 'mega': this.bomberNuke(p, true); break;
      case 'turbo': b.turboT = 15; Sound.whine(1, this.panOf(p.x, p.y)); break;
      case 'rapid': b.rapidT = 20; b.missileCD = 0; Sound.pop(); break;
      case 'storm': {
        b.shieldT = BOMBER.shield; Sound.shield();
        this.bomberNuke(p, true);
        const aims = this.buildings.filter(bb => !bb.ruined).map(bb => bb.x);
        for (let i = 0; i < 8; i++) this.bomberMissile(p, (aims.length ? aims[i % aims.length] : 0) + rand(-8, 8));
        break;
      }
    }
    this.labels.push({ text: BOMBER_PERKS[k].name, x: p.x, y: p.y - 24, t: 0, life: 2, color: '#ff8a7a', big: true });
    return true;
  }
  /** The Bomber's plane flies itself left and right (turning at the edges); the player only climbs and dives. */
  updateBomberPlane(p: Plane, dt: number) {
    const b = this.bomber;
    if (!b || b.plane !== p) { p.player = false; return; }
    if (p.state === 'turn') { p.alt = p.y; this.updateTurn(p, dt); return; }
    const turbo = b.turboT > 0 ? 1.7 : 1;
    const v = Math.max(45, p.speed) * (b.arm ? .5 : 1) * turbo;
    let climb = 0;
    if (b.dive === 'low') {
      // down close to the base, firing as it goes
      const ty = GROUND_Y - 90;
      climb = clamp(ty - p.y, -160 * dt, 160 * dt);
      p.x += p.dir * v * 1.3 * dt;
      if (Math.abs(p.y + climb - ty) < 60) this.bomberStrafe(p, dt, p.x + p.dir * 55, BOMBER.lowDps);
    } else {
      p.x += p.dir * v * dt;
      const steer = (b.down ? 1 : 0) - (b.up ? 1 : 0);
      if (steer) climb = steer * BOMBER.climb * turbo * dt;
      else if (b.returnY !== null) { climb = clamp(b.returnY - p.y, -80 * dt, 80 * dt); if (Math.abs(b.returnY - p.y) < 1) b.returnY = null; }
      if (b.dive === 'high') this.bomberStrafe(p, dt, p.x + p.dir * 30, BOMBER.highDps);
    }
    const ny = clamp(p.y + climb, SKY_TOP, SKY_LOW);
    climb = ny - p.y; p.y = ny; p.alt = ny;
    p.pitch += (clamp((climb / dt) / v * .8, -.6, .7) - p.pitch) * Math.min(1, dt * 3);
    if (p.dir > 0 ? p.x > this.xe : p.x < -this.xe) { this.beginTurn(p); p.alt = p.y; }
  }
  updateBomber(dt: number) {
    const b = this.bomber!;
    b.missileCD = Math.max(0, b.missileCD - dt); b.nukeCD = Math.max(0, b.nukeCD - dt); b.diveCD = Math.max(0, b.diveCD - dt);
    b.switchCD = Math.max(0, b.switchCD - dt); b.grabCD = Math.max(0, b.grabCD - dt); b.shieldT = Math.max(0, b.shieldT - dt);
    b.turboT = Math.max(0, b.turboT - dt); b.rapidT = Math.max(0, b.rapidT - dt);
    b.protectT = Math.max(0, b.protectT - dt); b.protectCD = Math.max(0, b.protectCD - dt);
    if (b.diveT > 0) { b.diveT -= dt; if (b.diveT <= 0) { b.diveT = 0; b.dive = null; } }
    const p = b.plane;
    if (p && (p.dead || p.state === 'falling' || !p.player)) { this.dropArm(); b.plane = null; }
    if (!b.plane) {
      if (b.deadT > 0) b.deadT = Math.max(0, b.deadT - dt);
      else if (!this.ended && this.phase !== 'idle') this.spawnBomber();
      return;
    }
    const q = b.plane;
    // touching the cargo plane slowly wears it down
    const c = this.cargo;
    if (c && !c.dead && !c.hitByPlayer && c.state !== 'falling' && Math.hypot(c.x - q.x, c.y - q.y) < BOMBER.touch + 10) {
      c.hp -= BOMBER.cargoDps * dt; c.hitFlash = .5;
      if (Math.random() < dt * 8) this.particles.push({ k: 'spark', x: (c.x + q.x) / 2 + rand(-4, 4), y: (c.y + q.y) / 2 + rand(-3, 3), vx: rand(-30, 30), vy: rand(-30, 30), life: .3, t: 0, r: .5 });
      this.tip('bomberCargo', 'The Bomber is ramming your cargo plane!');
      if (c.hp <= 0) this.cargoLost(false);
    }
    // touching a falling pack puts the arm on it
    if (!b.arm && b.grabCD <= 0) for (const cr of this.crates) {
      if (!cr.landed && !cr.dead && !cr.held && Math.hypot(cr.x - q.x, cr.y - q.y) < BOMBER.touch) { this.startArm(cr, 'bomber'); break; }
    }
    this.updateArm(dt);
  }
  /** A snapshot of the Bomber for the controls. */
  bomberView(): BomberView | null {
    const b = this.bomber;
    if (!b) return null;
    const p = b.plane;
    return {
      name: b.name, alive: !!p, deadT: b.deadT, height: p ? heightOf(p.y) : 0, hp: p ? Math.max(0, p.hp) : 0, max: p?.max ?? BOMBER.hp,
      missile: b.missileCD / BOMBER.missileCD, nuke: b.nukeCD / BOMBER.nukeCD, dive: Math.min(1, b.diveCD / BOMBER.diveCD), diving: b.diveT > 0,
      canNuke: !!p && heightOf(p.y) >= BOMBER.nukeAlt, arm: b.arm ? Math.min(1, b.arm.t / BOMBER.armTime) : -1, canGrab: !!p && !b.arm && b.grabCD <= 0 && !!this.grabbable(p), grabCD: b.grabCD,
      perk: b.perk, shieldT: b.shieldT, turboT: b.turboT, rapidT: b.rapidT,
      protect: Math.min(1, b.protectCD / PROTECT.cd), protectT: b.protectT,
    };
  }
  /** A few words on the Sniper's arm and upgrades, or '' when there is nothing to say. */
  sniperStatus(): string {
    const s = this.sniper;
    if (!s) return '';
    if (s.arm) return `stealing an upgrade (${Math.round(Math.min(1, s.arm.t / BOMBER.armTime) * 100)}%)`;
    const on = [s.quickN ? `quick laser ×${s.quickN}` : '', s.heavyN ? `heavy laser ×${s.heavyN}` : '', s.volley ? 'volley ready' : ''].filter(Boolean);
    if (on.length) return on.join(' · ');
    return s.perk ? `has ${SNIPER_PERKS[s.perk].name}` : '';
  }
  /** The Base's Protection button. */
  baseProtect() {
    if (!this.coop || this.protectCD > 0 || this.ended || this.phase === 'idle') return false;
    this.protectT = PROTECT.time; this.protectCD = PROTECT.cd + PROTECT.time;
    Sound.shield();
    this.labels.push({ text: 'Protection', x: this.gunX, y: GROUND_Y - 70, t: 0, life: 1.8, color: '#ffd34a', big: true });
    return true;
  }
  /** The Sniper points the laser at (x, y). One laser at a time. */
  snipe(x: number, y: number) {
    if (!this.coop || this.snipes.length || this.ended || this.phase === 'idle' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const s = this.sniper;
    if (s) s.aimX = clamp(x, -this.xe, this.xe);
    const d = s && s.quickN > 0 ? 1 : SNIPER.delay, share = s && s.heavyN > 0 ? .2 : SNIPER.share;
    if (s) { s.quickN = Math.max(0, s.quickN - 1); s.heavyN = Math.max(0, s.heavyN - 1); }
    const xs = s?.volley ? [-48, -24, 0, 24, 48] : [0];
    if (s) s.volley = false;
    for (const dx of xs) this.snipes.push({ x: clamp(x + dx, -this.xe, this.xe), y: clamp(y, SKY_TOP - 100, GROUND_Y), t: d, d, share });
    this.tip('sniper', "A red dot is the Sniper's laser. Three seconds later it hits that spot.");
    return true;
  }
  updateCoop(dt: number) {
    this.protectT = Math.max(0, this.protectT - dt); this.protectCD = Math.max(0, this.protectCD - dt);
    for (const s of this.snipes) {
      s.t -= dt;
      if (s.t > 0) continue;
      // the shot: 8% of full strength off any building at the spot, and off the cargo plane if it is there
      this.particles.push({ k: 'flash', x: s.x, y: s.y, r: 14, life: .25, t: 0, vx: 0, vy: 0 });
      this.flak(s.x, s.y, 1);
      for (const b of this.buildings) {
        if (b.ruined || Math.abs(s.x - b.x) > b.half + SNIPER.radius || s.y < GROUND_Y - 60) continue;
        const before = b.hp;
        this.damageBuilding(b, b.max * s.share / this.D.damage);
        this.sniperDamage += Math.max(0, before - Math.max(0, b.hp));
      }
      const c = this.cargo;
      if (c && !c.dead && !c.hitByPlayer && this.planeDist(c, s.x, s.y) < SNIPER.radius) { c.hp -= 100 * s.share; c.hitFlash = 1; if (c.hp <= 0) this.cargoLost(false); }
      Sound.flak(.5, this.panOf(s.x, s.y));
    }
    this.snipes = this.snipes.filter(s => s.t > 0);
    this.updateSniperArm(dt);
  }

  /* ---------- waves ---------- */
  startWave(n: number) {
    this.wave = n;
    this.phase = 'intro'; this.phaseT = 0;
    this.spec = waveSpec(n, this.difficulty);
    const D = this.D;
    const q: { t: number; types: (PlaneType | 'boss')[] }[] = [];
    let t = 1.5, i = 0, boss = this.spec.boss;
    while (i < this.spec.list.length) {
      // the boss flies in on its own once about a third of the wave is in the air
      if (boss && i >= this.spec.list.length / 3) { boss = false; q.push({ t, types: ['boss'] }); t += rand(6, 9) * D.gap; continue; }
      const g = Math.min(this.spec.list.length - i, 1 + D.group + Math.floor(Math.random() * (n < 3 ? 2 : 3)));
      q.push({ t, types: this.spec.list.slice(i, i + g) });
      i += g; t += rand(4, 8) * D.gap;
    }
    if (boss) q.push({ t, types: ['boss'] });
    this.spawnQueue = q;
    // one resupply plane every wave
    this.cargoAt = rand(6, 14);
    this.goldWave = Math.random() < GOLD_CHANCE * (this.perks.has('lucky') ? 2 : 1);
    this.waveDamaged = false;
    this.wind = n >= 4 ? rand(-1, 1) : 0;
    Sound.setWind(this.wind);
    const target = paletteForWave(n);
    if (target !== this.palTo) { this.palFrom = this.currentPalId(); this.palTo = target; this.palT = 0; }
    this.hooks.waveStart && this.hooks.waveStart(n);
    if (n === 4) this.tip('wind', 'Wind now drifts your shells. Watch the windsock.');
    if (target === 'night' && paletteForWave(n - 1) !== 'night') this.tip('night', 'Night. Your searchlight follows your aim.');
  }
  currentPalId(): PaletteId { return this.palT >= .5 ? this.palTo : this.palFrom; }
  planesLeft() {
    let n = 0;
    for (const p of this.planes) if (p.type !== 'cargo' && p.state !== 'falling' && !p.player) n++;
    for (const g of this.spawnQueue) n += g.types.length;
    return n;
  }

  spawnPlane(type: PlaneType | 'boss', i: number) {
    const T = TYPES[type];
    const dir = Math.random() < .5 ? 1 : -1;
    const alt = pick(T.alts) + rand(-15, 15);
    const p: Plane = {
      id: nextId++, type, dir, x: -dir * (this.xe + 60 + i * 70), y: alt, alt, speed: T.speed * rand(.95, 1.05),
      hp: 1, max: 1, state: 'fly', pitch: 0, flip: 1, turnT: 0, hits: [], trail: [], trailT: 0,
      dropCD: rand(2, 5) * this.D.fire, diveCD: rand(4, 9) * this.D.fire, stateT: 0, burnT: 0, burning: false, smokeT: 0, hitFlash: 0,
      vx: 0, vy: 0, spin: 0, lightPhase: Math.random() * 6,
    };
    if (type === 'boss') {
      p.hp = p.max = bossHp(this.wave, this.difficulty);
      p.dropCD = rand(3, 4);
      this.labels.push({ text: 'Boss incoming', x: 0, y: GROUND_Y - 70, t: 0, life: 2.6, color: '#ff8a7a', big: true });
      this.tip('boss', 'A boss! It takes a lot of hits and fires two missiles at a time.');
    }
    this.planes.push(p);
    if (type === 'fighter') this.tip('fighter', 'Fighters dive at your base. That is the best moment to shoot them.');
    if (type === 'heavy') this.tip('heavy', 'Heavy bombers drop big bombs on the middle of your base. Stop them first.');
    return p;
  }

  /* ---------- input ---------- */
  press(gun = this.localGun) { if (gun === 2) { if (this.gun2) this.gun2.firing = true; return; } this.firing = true; this.tapEdge = true; }
  tap(gun = this.localGun) { if (gun === 2) { if (this.gun2) this.gun2.oneShot = true; return; } this.tapEdge = true; this.oneShot = true; }
  release(gun = this.localGun) { if (gun === 2) { if (this.gun2) this.gun2.firing = false; return; } this.firing = false; }
  /** The second turret's building. */
  gun2Post(): Building | null { return this.gun2 ? this.buildings.find(b => b.outpost && b.x === this.gun2!.x) ?? null : null; }
  /** The second turret: it turns with its player's phone and fires the plain gun. */
  updateGun2(dt: number) {
    const g = this.gun2;
    if (!g) return;
    g.aim = clamp(g.roll * AIM_GAIN, -AIM_MAX, AIM_MAX);
    g.fireCD -= dt; g.recoil = Math.max(0, g.recoil - dt * 6); g.flash = Math.max(0, g.flash - dt * 8);
    if (this.ended || this.gun2Post()?.ruined || !this.settled) return;
    if ((!g.firing && !g.oneShot) || g.fireCD > 0) return;
    g.oneShot = false; g.fireCD = FIRE_INTERVAL;
    const [dx, dy] = this.aimDir(g.aim);
    this.shells.push({ x: g.x + dx * BARREL, y: dy * BARREL, vx: dx * SHELL_V0, vy: dy * SHELL_V0, t: 0, px: 0, py: 0 });
    this.stats.shots++;
    g.recoil = 1; g.flash = 1;
    Sound.thump();
    for (let i = 0; i < 3; i++) this.addPuff(g.x + dx * (BARREL + 2) + rand(-3, 3), dy * (BARREL + 2) + rand(-3, 3), 'smokeLight', rand(2, 3.5), 1.1, .45, dx * 15 + rand(-5, 5), dy * 15 + rand(-5, 5));
  }

  /* ---------- main update ---------- */
  update(dtReal: number, tiltRoll: number) {
    const over = this.phase === 'over';
    // the camera slides over to the turret in use
    this.viewX += (this.gunX - this.viewX) * Math.min(1, dtReal * 3 / MOVE_TIME);
    if (over) { this.overT += dtReal; this.timeScale = this.overT < 2.6 ? .28 : .6; }
    const dt = dtReal * this.timeScale;
    // a zero-length frame (e.g. the first frame after resuming) would divide by zero in
    // the flight model and leave planes with a NaN pitch, which makes them unhittable
    if (!(dt > 0)) return;
    this.t += dt;
    this.phaseT += dt;

    // aim: 1.4x the phone's roll, smoothed upstream
    const target = clamp(tiltRoll * AIM_GAIN, -AIM_MAX, AIM_MAX);
    this.aim = target;
    this.cam = over ? this.cam * Math.pow(.2, dtReal) : this.aim;

    if (this.palT < 1) this.palT = Math.min(1, this.palT + dt / 7);

    if (this.phase === 'intro' && this.phaseT >= 3) { this.phase = 'combat'; this.phaseT = 0; }
    if (this.phase === 'combat' || this.phase === 'intro') {
      while (this.phase === 'combat' && this.spawnQueue.length && this.spawnQueue[0].t <= this.phaseT) {
        const g = this.spawnQueue.shift()!;
        g!.types.forEach((ty, i) => this.spawnPlane(ty, i));
      }
      if (this.phase === 'combat' && !this.war && this.planesLeft() === 0) this.waveCleared();
    } else if (this.phase === 'clear') {
      if (this.phaseT >= 10) this.startWave(this.wave + 1);
    }
    if (this.cargoAt !== null && this.phase === 'combat' && this.phaseT >= this.cargoAt && this.canLaunchCargo()) this.launchCargo();

    if (this.war) this.updateWar(dt);
    this.lasing = false;
    if (!this.ended) this.updateGun(dt);
    this.updateGun2(dt);
    this.updatePlanes(dt);
    if (this.bomber) this.updateBomber(dt);
    if (this.coop) this.updateCoop(dt);
    this.updateBombs(dt);
    this.updateShells(dt);
    this.updateMissiles(dt);
    this.updatePulses(dt);
    this.updateShield(dt);
    this.updateCargo(dt);
    this.updateBase(dt);
    this.updateSweeper(dt);
    this.updateParticles(dt);
    if (this.weapon === 'rapid' && !this.ended) this.useAmmo(dt);
    this.nukeFlash = Math.max(0, this.nukeFlash - dtReal * 1.6);
    this.shake = Math.max(0, this.shake - dtReal * 10);
    this.flash = Math.max(0, this.flash - dt * 8);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    for (const l of this.labels) l.t += dtReal;
    this.labels = this.labels.filter(l => l.t < l.life);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter(t => t.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    this.updateEngines();
    this.tapEdge = false; this.oneShot = false;
  }

  /* ---------- gun ---------- */
  updateGun(dt: number) {
    this.fireCD -= dt;
    if (this.post().ruined || !this.settled) return;
    this.updateLock(dt);
    const w = this.weapon;
    // guided missiles are the only thing that fires until they are spent
    if (w === 'missiles') {
      if (this.tapEdge && this.lock.locked && this.fireCD <= 0) { this.fireMissile(); this.fireCD = .3; }
      return;
    }
    if (w === 'laser') { if (this.firing) this.fireLaser(dt); return; }
    if ((!this.firing && !this.oneShot) || this.fireCD > 0) return;
    this.oneShot = false;
    switch (w) {
      case 'rockets': this.fireRocket(); this.fireCD = .45; break;
      case 'fireballs': this.fireFireball(); this.fireCD = .28; break;
      case 'sonic': this.fireSonic(); this.fireCD = .75; break;
      case 'nuke': this.fireNuke(); this.fireCD = 1; break;
      case 'lightning': this.fireLightning(); this.fireCD = .4; break;
      case 'cluster': this.fireCluster(); this.fireCD = .5; break;
      default: this.fireShell(); this.fireCD = (w === 'rapid' ? FIRE_INTERVAL / 3 : FIRE_INTERVAL) * (this.fastLoad ? 2 / 3 : 1) * this.rateMul;
    }
  }
  /** Spend ammo (or seconds) of the special weapon; the plain gun comes back when it runs out. */
  useAmmo(n = 1) {
    if (!this.weapon) return;
    this.ammo -= n;
    if (this.ammo > 1e-6) return;
    this.ammo = 0; this.weapon = null;
    this.lock = { target: null, t: 0, step: 0, locked: false };
    this.hooks.hud && this.hooks.hud();
  }

  aimDir(a = this.aim): [number, number] { return [Math.sin(a), -Math.cos(a)]; }

  fireShell() {
    const n = this.guns, v0 = SHELL_V0 * (this.perks.has('swift') ? 1.33 : 1);
    // Mirror gun: the same volley again, aimed the other way across the middle (none when aiming straight up)
    const aims = this.perks.has('mirror') && Math.abs(this.aim) > .04 ? [this.aim, -this.aim] : [this.aim];
    for (const aim of aims) for (let k = 0; k < n; k++) {
      // a pair splits 1.6 degrees each side; a fan of three goes 2.4 degrees out from the middle
      const c = k - (n - 1) / 2;
      const off = c * (n === 3 ? 2.4 : 3.2) * Math.PI / 180;
      const a = aim + off;
      const [dx, dy] = this.aimDir(a);
      const side = c * (n === 3 ? 3.4 : 4.4);
      this.shells.push({ x: this.gunX + dx * BARREL + Math.cos(aim) * side, y: dy * BARREL + Math.sin(aim) * side, vx: dx * v0, vy: dy * v0, t: 0, px: 0, py: 0, ghost: this.ghost || undefined });
    }
    this.stats.shots++;
    this.recoil = 1; this.flash = 1;
    Sound.thump();
    this.vibrate(8);
    const [dx, dy] = this.aimDir();
    for (let i = 0; i < 4; i++) this.addPuff(this.gunX + dx * (BARREL + 2) + rand(-3, 3), dy * (BARREL + 2) + rand(-3, 3), 'smokeLight', rand(2, 3.5), 1.1, .45, dx * 15 + rand(-5, 5), dy * 15 + rand(-5, 5));
  }

  launch(kind: ShotKind, v: number, target: Plane | null = null) {
    const [dx, dy] = this.aimDir();
    this.missiles.push({ kind, x: this.gunX + dx * BARREL, y: dy * BARREL, vx: dx * v, vy: dy * v, t: 0, target, smokeT: 0 });
    this.stats.shots++;
  }
  fireMissile() {
    this.launch('missile', 160, this.lock.target);
    this.lock = { target: null, t: 0, step: 0, locked: false };
    this.useAmmo();
    Sound.missile();
    this.vibrate(15);
  }
  fireRocket() {
    this.launch('rocket', 240);
    this.useAmmo();
    this.recoil = .7; this.flash = .8;
    const [dx, dy] = this.aimDir();
    for (let i = 0; i < 6; i++) this.addPuff(this.gunX + dx * BARREL + rand(-3, 3), dy * BARREL + rand(-3, 3), 'smokeLight', rand(2.5, 4), 2, .6, -dx * 20 + rand(-8, 8), -dy * 20 + rand(-8, 8), 2.4);
    Sound.rocket();
    this.vibrate(14);
  }
  fireFireball() {
    this.launch('fireball', 330);
    this.useAmmo();
    this.recoil = .5; this.flash = .7;
    Sound.fireball();
    this.vibrate(8);
  }
  fireNuke() {
    this.launch('nuke', 210);
    this.useAmmo();
    this.recoil = 1.4; this.flash = 1;
    if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, 3);
    Sound.missile(); Sound.thump();
    this.vibrate(40);
  }
  fireSonic() {
    this.pulses.push({ x: this.gunX, a: this.aim, r: BARREL, hit: new Set(), hitAny: false });
    this.stats.shots++;
    this.useAmmo();
    this.recoil = .6;
    Sound.sonic();
    this.vibrate(18);
  }
  /** Chain lightning: hits the plane nearest the aim, then jumps on to whatever hostile is closest. */
  fireLightning() {
    const [dx, dy] = this.aimDir(), x0 = this.gunX + dx * BARREL, y0 = dy * BARREL;
    let first: Plane | null = null, bd = BOLT_CONE;
    for (const p of this.planes) {
      if (p.type === 'cargo' || p.friend || !this.hittable(p)) continue;
      const d = Math.abs(Math.atan2(p.x - this.gunX, -p.y) - this.aim);
      if (d < bd && Math.hypot(p.x - this.gunX, p.y) < BOLT_RANGE) { bd = d; first = p; }
    }
    const pts: [number, number][] = [[x0, y0]];
    let hit = false;
    if (first) {
      const done = new Set<Plane | Bomb>();
      let at: Plane | Bomb = first;
      for (let k = 0; k < BOLT_CHAIN; k++) {
        done.add(at);
        pts.push([at.x, at.y]);
        if ('kind' in at) this.killBomb(at); else this.damagePlane(at, 1, [at.x, at.y]);
        hit = true;
        let next: Plane | Bomb | null = null, nd = BOLT_JUMP;
        for (const p of this.planes) {
          if (p.type === 'cargo' || p.friend || done.has(p) || !this.hittable(p)) continue;
          const d = Math.hypot(p.x - at.x, p.y - at.y);
          if (d < nd) { nd = d; next = p; }
        }
        for (const b of this.bombs) {
          if (b.dead || done.has(b)) continue;
          const d = Math.hypot(b.x - at.x, b.y - at.y);
          if (d < nd) { nd = d; next = b; }
        }
        if (!next) break;
        at = next;
      }
    } else pts.push([x0 + dx * 472, dy * 520]);
    this.bolts.push({ pts, life: .32 });
    for (const [x, y] of pts.slice(1)) this.particles.push({ k: 'flash', x, y, r: 12, life: .22, t: 0, vx: 0, vy: 0 });
    this.stats.shots++;
    this.scoreShot(hit);
    this.useAmmo();
    this.recoil = .4; this.flash = .9;
    Sound.lightning();
    this.vibrate(16);
  }
  fireCluster() {
    this.launch('cluster', 400);
    this.useAmmo();
    this.recoil = .8; this.flash = 1;
    Sound.thump();
    this.vibrate(10);
  }
  /** A cluster shell comes apart into bomblets that spread out and go off a moment later. */
  scatter(m: Missile, at: [number, number] | null) {
    const [x, y] = at || [m.x, m.y];
    this.burst(m, at, 1, 12);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + rand(-.2, .2), v = rand(70, 120);
      this.missiles.push({ kind: 'bomblet', x, y, vx: Math.cos(a) * v + m.vx * .15, vy: Math.sin(a) * v + m.vy * .15, t: 0, target: null, smokeT: 0, counted: false, fuse: rand(.35, .65) });
    }
  }

  // A solid beam along the aim for as long as the finger is down. It passes through
  // everything, and any plane it touches is hit at once.
  fireLaser(dt: number) {
    this.lasing = true;
    const [dx, dy] = this.aimDir(), x0 = this.gunX + dx * BARREL, y0 = dy * BARREL;
    const near = (x: number, y: number): [number, number] | null => {
      const t = (x - x0) * dx + (y - y0) * dy;
      return t < 0 || t > LASER_LEN ? null : [x0 + dx * t, y0 + dy * t];
    };
    for (const p of this.planes) {
      if (!this.hittable(p)) continue;
      const c = near(p.x, p.y);
      if (!c || this.planeDist(p, c[0], c[1]) > 1.5) continue;
      if (p.type === 'cargo') { if (!this.dodge(p)) this.cargoLost(true); continue; }
      if (p.friend) { this.friendlyDown(p); continue; }
      // a one-hit plane goes at once; the boss burns down while the beam stays on it
      this.damagePlane(p, p.max > 1 && p.state !== 'falling' ? LASER_DPS * dt : 1, c);
    }
    for (const b of this.bombs) {
      const c = near(b.x, b.y);
      if (!c || b.dead || Math.hypot(b.x - c[0], b.y - c[1]) > this.bombR(b) + 1) continue;
      b.hp -= dt * 6;
      if (b.hp <= 0) this.killBomb(b);
    }
    for (const cr of this.crates) {
      const c = near(cr.x, cr.y - 4);
      if (c && !cr.landed && !cr.dead && !cr.held && Math.hypot(cr.x - c[0], cr.y - 4 - c[1]) < 7 && !this.dodge(cr)) this.crateLost(cr);
    }
    for (const who of ['bomber', 'sniper'] as const) if (this.armOf(who)) for (let k = .2; k < 1; k += .2) {
      const [ax, ay] = this.armPoint(k, who), c = near(ax, ay);
      if (c && Math.hypot(ax - c[0], ay - c[1]) < 4) { this.hitArm(LASER_DPS * dt, who); break; }
    }
    this.laserSnd -= dt;
    if (this.laserSnd <= 0) { this.laserSnd = .09; Sound.laser(); }
    this.useAmmo(dt);
  }

  updateLock(dt: number) {
    const L = this.lock;
    if (this.weapon !== 'missiles') { L.target = null; L.t = 0; L.locked = false; return; }
    let best = null, bd = 5 * Math.PI / 180;
    for (const p of this.planes) {
      if (p.type === 'cargo' || p.friend || p.state === 'falling') continue;
      const a = Math.atan2(p.x - this.gunX, -p.y), d = Math.abs(a - this.aim), dist = Math.hypot(p.x - this.gunX, p.y);
      if (d < bd && dist < 950) { bd = d; best = p; }
    }
    if (best && best === L.target) L.t += dt; else { L.target = best; L.t = 0; L.step = 0; }
    const was = L.locked;
    L.locked = !!best && L.t >= .7;
    if (best && !L.locked) { const s = Math.floor(L.t / .7 * 4); if (s > L.step) { L.step = s; Sound.lockStep(s / 4); } }
    if (L.locked && !was) Sound.locked();
  }

  /* ---------- planes ---------- */
  updatePlanes(dt: number) {
    for (const p of this.planes) {
      p.stateT += dt;
      p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
      if (p.state === 'falling') { this.updateFalling(p, dt); continue; }
      if (p.type === 'cargo') continue;
      if (p.burning) {
        p.burnT += dt;
        if (p.burnT >= 2) { p.burnT = 0; this.damagePlane(p, 1, null); if ((p.state as PlaneState) === 'falling') continue; }
      }
      if (p.friend) { this.updateFriend(p, dt); if (p.dead) continue; }
      else if (p.player) this.updateBomberPlane(p, dt);
      else {
        // Headwind: enemy planes fly (and so drop and dive) a fifth slower
        const pdt = this.perks.has('headwind') ? dt * .8 : dt;
        if (p.type === 'fighter') this.updateFighter(p, pdt);
        else this.updateCruise(p, pdt);
        if (p.type === 'light' || p.type === 'heavy' || p.type === 'boss') this.tryDrop(p, pdt);
      }
      if (this.war && p.type !== 'boss') this.dogfight(p, dt);
      // contrails and damage smoke
      p.trailT -= dt;
      // contrails only form up high, and not on a diving fighter
      if (p.trailT <= 0 && p.y < -360 && (p.state === 'fly' || p.state === 'turn')) {
        p.trailT = .1;
        const tx = p.x - p.dir * p.flip * HALF[p.type] * SC[p.type] * .85;
        p.trail.push([tx, p.y + 1, this.t]);
        if (p.trail.length > 45) p.trail.shift();
      }
      if (p.hits.length) {
        p.smokeT -= dt;
        if (p.smokeT <= 0) {
          const dmg = 1 - p.hp / p.max;
          p.smokeT = .07 - dmg * .04;
          for (const h of p.hits) {
            const [hx, hy] = this.planePoint(p, h.u, h.v);
            this.addPuff(hx, hy, dmg > .5 ? 'smokeDark' : 'smokeLight', 1.4 + dmg * 2.2, 2.2, .55 + dmg * .35, -p.dir * p.speed * .1, -6, .9 + dmg);
          }
        }
      }
    }
    this.planes = this.planes.filter(p => !p.dead);
  }

  planePoint(p: Plane, u: number, v: number): [number, number] {
    const L = HALF[p.type] * SC[p.type] * .85;
    const ca = Math.cos(p.pitch * p.dir), sa = Math.sin(p.pitch * p.dir);
    const lx = u * L * p.dir * p.flip, ly = v;
    return [p.x + lx * ca - ly * sa, p.y + lx * sa + ly * ca];
  }

  updateCruise(p: Plane, dt: number) {
    if (p.state === 'turn') { this.updateTurn(p, dt); return; }
    p.x += p.dir * p.speed * dt;
    const dy = p.alt - p.y;
    const climb = clamp(dy, -18 * dt, 18 * dt);
    p.y += climb;
    p.pitch += ((climb / dt) / p.speed * .8 - p.pitch) * Math.min(1, dt * 3);
    if (p.dir > 0 ? p.x > this.xe : p.x < -this.xe) this.beginTurn(p);
  }
  beginTurn(p: Plane) {
    p.state = 'turn'; p.turnT = 0; p.turnX = p.x; p.turnR = 30 + p.speed * .5;
    p.turnDur = Math.PI * p.turnR / p.speed;
    const T = TYPES[p.type];
    if (Math.random() < .55) p.alt = pick(T.alts) + rand(-15, 15);
  }
  updateTurn(p: Plane, dt: number) {
    p.turnT += dt / (p.turnDur ?? 1);
    const k = Math.min(1, p.turnT);
    p.x = (p.turnX ?? p.x) + p.dir * (p.turnR ?? 40) * Math.sin(Math.PI * k) * .7;
    p.flip = Math.cos(Math.PI * k);
    p.y += clamp(p.alt - p.y, -12 * dt, 12 * dt);
    p.pitch *= .95;
    if (k >= 1) { p.dir = -p.dir; p.flip = 1; p.state = p.type === 'fighter' ? 'fly' : 'fly'; p.stateT = 0; }
  }

  updateFighter(p: Plane, dt: number) {
    const S = p.speed;
    switch (p.state) {
      case 'turn': this.updateTurn(p, dt); return;
      case 'fly': {
        this.updateCruise(p, dt);
        p.diveCD -= dt;
        if (p.state !== 'fly') return;
        if (this.cargo && !this.cargo.dead && !this.cargo.hitByPlayer && p.chaseCargo) { p.state = 'chase'; p.stateT = 0; return; }
        const toward = Math.sign(-p.x) === p.dir;
        const ax = Math.abs(p.x);
        if (p.diveCD <= 0 && toward && ax > 260 && ax < 460 && !this.ended) {
          p.state = 'warn'; p.stateT = 0;
          Sound.whine(2, this.panOf(p.x, p.y));
          Sound.enginePitch(p.id, 1.35);
        }
        return;
      }
      case 'warn': // engine whine, nose drops for about 2 seconds
        p.x += p.dir * S * dt;
        p.pitch += (.32 - p.pitch) * Math.min(1, dt * 2);
        if (p.stateT >= 2) {
          p.state = 'dive'; p.stateT = 0;
          // in war mode the base comes first, but a turret out on its own is fair game too
          const standing = this.buildings.filter(b => !b.ruined), base = standing.filter(b => !b.outpost);
          const targets = base.length && Math.random() < .7 ? base : standing;
          const tb = targets.length ? pick(targets) : this.post();
          p.diveTo = [tb.x - p.dir * 110, GROUND_Y - 95];
          this.tip('dive', 'A diving fighter is closer and bigger. Shoot it now!');
        }
        return;
      case 'dive': {
        const [tx, ty] = p.diveTo ?? [0, GROUND_Y - 95];
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        const v = S * 1.8;
        if (d < v * dt * 1.5 || Math.sign(dx) !== p.dir) { p.state = 'strafe'; p.stateT = 0; p.strafeDone = new Set(); Sound.minigun(0); return; }
        p.x += dx / d * v * dt; p.y += dy / d * v * dt;
        const pitch = Math.atan2(dy, Math.abs(dx));
        p.pitch += (pitch - p.pitch) * Math.min(1, dt * 4);
        return;
      }
      case 'strafe': {
        const v = S * 1.6;
        p.x += p.dir * v * dt;
        p.y += 6 * dt;
        p.pitch += (.42 - p.pitch) * Math.min(1, dt * 3);
        const impact = p.x + p.dir * (70 - p.stateT * 10);
        if (Math.random() < dt * 22) {
          const [nx, ny] = this.planePoint(p, 1, 0);
          this.tracers.push({ x0: nx, y0: ny, x1: impact + rand(-6, 6), y1: GROUND_Y - rand(0, 6), life: .14 });
          if (Math.random() < .5) this.addPuff(impact + rand(-8, 8), GROUND_Y - 2, 'dust', rand(1.5, 3), 3, .55, rand(-4, 4), -8);
        }
        if (Math.floor(p.stateT / .45) !== Math.floor((p.stateT - dt) / .45)) Sound.minigun(this.panOf(p.x, p.y));
        // the tracer line walks across the base; every building it has reached takes about 5 HP a second
        const done = p.strafeDone ??= new Set();
        for (const b of this.buildings) if (!b.ruined && Math.abs(b.x - impact) < b.half + 10) done.add(b);
        for (const b of done) this.damageBuilding(b, 5 * dt, true);
        if (p.stateT >= 1.8) { p.state = 'climb'; p.stateT = 0; Sound.enginePitch(p.id, 1.1); }
        return;
      }
      case 'climb': {
        const v = S * 1.3;
        p.pitch += (-.5 - p.pitch) * Math.min(1, dt * 2.5);
        p.x += p.dir * v * Math.cos(p.pitch) * dt;
        p.y += v * Math.sin(p.pitch) * dt;
        if (p.y <= p.alt) { p.y = p.alt; p.state = 'fly'; p.diveCD = rand(12, 18) * this.D.fire; Sound.enginePitch(p.id, 1); }
        if (p.dir > 0 ? p.x > this.xe : p.x < -this.xe) { p.alt = p.y; this.beginTurn(p); p.diveCD = rand(10, 16) * this.D.fire; Sound.enginePitch(p.id, 1); }
        return;
      }
      case 'chase': {
        const c = this.cargo;
        if (!c || c.dead || c.hitByPlayer || c.gone) { p.state = 'climb'; p.chaseCargo = false; p.alt = pick(TYPES.fighter.alts); return; }
        const tx = c.x - c.dir * 70, ty = c.y - 4;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        const v = Math.min(S * 1.4, Math.max(c.speed, d * 1.5));
        if (Math.sign(dx) !== p.dir && d > 40) { this.beginTurn(p); return; }
        if (d > 1) { p.x += dx / d * v * dt; p.y += dy / d * v * dt; }
        p.pitch += (Math.atan2(dy, Math.abs(dx) + 20) * .5 - p.pitch) * Math.min(1, dt * 3);
        if (d < 30) {
          c.hp -= 22 * dt;
          if (Math.random() < dt * 16) { const [nx, ny] = this.planePoint(p, 1, 0); this.tracers.push({ x0: nx, y0: ny, x1: c.x + rand(-8, 8), y1: c.y + rand(-3, 3), life: .12 }); }
          if (Math.floor(p.stateT / .45) !== Math.floor((p.stateT - dt) / .45)) Sound.minigun(this.panOf(c.x, c.y));
          if (c.hp <= 0) this.cargoLost(false);
        }
        return;
      }
    }
  }

  tryDrop(p: Plane, dt: number) {
    p.dropCD -= dt;
    if (p.dropCD > 0 || p.state !== 'fly' || this.ended) return;
    if (p.type === 'heavy') {
      // a heavy bomber lets go over the middle of the base; the bomb soon straightens out and falls almost straight down
      if (Math.abs(p.x) > 40) return;
      this.dropBomb(p, 'bomb', 30, p.dir * p.speed / 2, BOMB_DRAG, this.wind * .04);
      p.dropCD = rand(13, 17) * this.D.fire;
      return;
    }
    if (p.type === 'boss') { this.bossVolley(p); return; }
    // a light plane fires a missile on the old bomb's arc: half its speed forward, with wind and a little drag
    const T = 24;
    const vx = p.dir * p.speed / 2, wa = this.wind;
    const land = p.x + vx * (1 - Math.exp(-MISSILE_DRAG * T)) / MISSILE_DRAG + .5 * wa * T * T;
    // only let go when the missile would come down near a standing building, then trim the throw to hit its middle
    let target: Building | null = null, best = 30;
    for (const bb of this.buildings) {
      if (bb.ruined) continue;
      const d = Math.abs(land - bb.x) - bb.half;
      if (d < best) { best = d; target = bb; }
    }
    // a turret out on its own is only an occasional target
    if (target?.outpost && Math.random() < .65) { p.dropCD = rand(2, 4); return; }
    if (target) {
      const vx0 = (target.x - p.x - .5 * wa * T * T) * MISSILE_DRAG / (1 - Math.exp(-MISSILE_DRAG * T));
      this.dropBomb(p, 'missile', T, vx0, MISSILE_DRAG, wa);
      p.dropCD = rand(6, 9) * this.D.fire;
    }
  }
  /** The boss fires two missiles at once, one from under each wing, at the two standing buildings nearest where they would come down. */
  bossVolley(p: Plane) {
    const T = 22, wa = this.wind, vx = p.dir * p.speed / 2;
    const land = p.x + vx * (1 - Math.exp(-MISSILE_DRAG * T)) / MISSILE_DRAG + .5 * wa * T * T;
    const near = this.buildings.filter(b => !b.ruined && Math.abs(land - b.x) - b.half < 140).sort((a, b) => Math.abs(land - a.x) - Math.abs(land - b.x));
    if (!near.length) return;
    const aims = near.length > 1 ? [near[0].x, near[1].x] : [near[0].x - 6, near[0].x + 6];
    aims.sort((a, b) => a - b);
    [-9, 9].forEach((off, k) => {
      const x0 = p.x + off;
      const vx0 = (aims[k] - x0 - .5 * wa * T * T) * MISSILE_DRAG / (1 - Math.exp(-MISSILE_DRAG * T));
      this.dropBomb(p, 'missile', T, vx0, MISSILE_DRAG, wa, off);
    });
    p.dropCD = rand(5, 7) * this.D.fire;
  }
  dropBomb(p: Plane, kind: Bomb['kind'], T: number, vx0: number, k: number, wa: number, dx = 0) {
    const x0 = p.x + dx, y0 = p.y + 1.5 + (p.type === 'boss' ? 3 : 0);
    const g = 2 * (GROUND_Y - y0) / (T * T);
    const bomb: Bomb = { id: nextId++, kind, x: x0, y: y0, x0, y0, vx0, k, g, wa, t: 0, T, hp: 1, trail: [], trailT: 0, angle: 0 };
    this.bombs.push(bomb);
    if (kind === 'missile') {
      for (let i = 0; i < 4; i++) this.addPuff(x0 + rand(-2, 2), y0 + rand(-1, 1), 'smokeLight', rand(1.2, 2), 2, .5, rand(-4, 4), rand(-2, 2), 1.4);
      if (p.type !== 'boss' && !p.player) this.tip('enemyMissile', 'Light planes fire missiles at your base. Shoot them down before they land.');
    } else if (kind === 'bomb') this.tip('bomb', 'Heavy bombs hit very hard. Shoot them before they land.');
    return bomb;
  }
  bombX(b: Bomb, t: number) { return b.x0 + b.vx0 * (1 - Math.exp(-b.k * t)) / b.k + .5 * b.wa * t * t; }
  bombLandX(b: Bomb) { return this.bombX(b, b.T); }
  bombR(b: Bomb) { return b.kind === 'nuke' ? 5 : b.kind === 'bomb' ? 3.2 : 1.8; }
  // the tail, where the smoke trail comes out: the sprite's nose points along the fall, so the tail is behind it
  bombTail(b: Bomb) { const L = b.kind === 'nuke' ? 8 : b.kind === 'bomb' ? 5.3 : 4.8; return { x: b.x + Math.sin(b.angle) * L, y: b.y - Math.cos(b.angle) * L }; }

  updateFalling(p: Plane, dt: number) {
    p.vx *= Math.pow(.85, dt);
    p.vy = Math.min(150, p.vy + 55 * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.spin += dt * 1.6;
    p.pitch = Math.min(1.35, p.pitch + dt * .6);
    p.flip = Math.cos(p.spin * 2.2);
    p.smokeT -= dt;
    if (p.smokeT <= 0) {
      p.smokeT = .025;
      this.addPuff(p.x + rand(-1, 1), p.y, 'smokeBlack', 2, 3.2, .85, rand(-3, 3), -5, 1.6);
      this.addFire(p.x, p.y, .7);
    }
    if (p.y >= GROUND_Y - 3) {
      p.dead = true;
      const boss = p.type === 'boss';
      this.explosion(p.x, GROUND_Y - 2, boss ? 2.6 : 1.4, true);
      Sound.boom(true, this.panOf(p.x, p.y));
      if (boss && !this.settings.reduceMotion) this.shake = Math.max(this.shake, 9);
      // a downed plane that comes down on the base still does a little damage
      if (p.type !== 'cargo' && !p.friend) this.blastBase(p.x, GROUND_Y - 3, boss ? 40 : 22, boss ? 30 : p.type === 'heavy' ? 14 : 8);
      Sound.stopEngine(p.id);
    }
  }

  /** Whether a shot can touch this plane: anything flying, and a falling enemy plane once it has started to fall. */
  hittable(p: Plane) {
    if (p.dead) return false;
    return p.state !== 'falling' || (p.type !== 'cargo' && !p.friend && p.stateT >= FALL_GRACE);
  }
  damagePlane(p: Plane, dmg: number, at: [number, number] | null) {
    if (p.dead) return false;
    if (p.state === 'falling') { this.disintegrate(p); return true; }
    // co-op: the Bomber's plane shield turns every hit away
    if (p.player && this.bomber && this.bomber.shieldT > 0) { this.particles.push({ k: 'ring', x: p.x, y: p.y, r: 6, grow: 40, life: .25, t: 0, vx: 0, vy: 0 }); return true; }
    if (p.type === 'boss' && this.perks.has('breaker')) dmg *= 3;
    if (p.player && this.bomber && this.bomber.protectT > 0) dmg *= 1 - PROTECT.cut;
    p.hp -= dmg; p.hitFlash = 1;
    if (at && p.hits.length < 3) {
      // remember where it was hit, in the plane's own frame, so smoke trails from there
      const L = HALF[p.type] * SC[p.type] * .85;
      const ca = Math.cos(p.pitch * p.dir), sa = Math.sin(p.pitch * p.dir);
      const dx = at[0] - p.x, dy = at[1] - p.y;
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      p.hits.push({ u: clamp(lx / (L * p.dir * (p.flip || 1)), -1, 1), v: clamp(ly, -3, 3) });
    } else if (!at && !p.hits.length) p.hits.push({ u: 0, v: 0 });
    if (p.hp <= 0) {
      p.vx = p.state === 'turn' ? 0 : p.dir * p.speed * (p.type === 'fighter' ? 1.2 : .9);
      p.state = 'falling'; p.stateT = 0; p.spin = 0;
      p.vy = 0;
      if (!p.hits.length) p.hits.push({ u: 0, v: 0 });
      this.addScore(TYPES[p.type].points * (this.perks.has('bounty') ? 2 : 1), p.x, p.y);
      this.stats.kills++;
      if (this.adventure) { this.adv.iron++; this.labels.push({ text: '+1 iron', x: p.x, y: p.y + 4, t: 0, life: 1.3, color: '#c9d3dc' }); this.hooks.iron?.(); }
      const boss = p.type === 'boss';
      this.explosion(p.x, p.y, boss ? 2 : .8, false);
      Sound.boom(boss, this.panOf(p.x, p.y));
      Sound.enginePitch(p.id, .7);
      if (boss) {
        this.labels.push({ text: 'Boss down', x: 0, y: GROUND_Y - 70, t: 0, life: 2.6, color: '#fff1c8', big: true });
        if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, 6);
        this.vibrate(120);
      }
      if (this.lock.target === p) this.lock = { target: null, t: 0, step: 0, locked: false };
      if (p.player) this.bomberDown(p);
      if (this.leech) this.leechHeal();
      if (!this.chaining) this.chainKill(p);
      this.maybeDiamond(p);
    } else if (dmg >= 1) Sound.hitPlane(this.panOf(p.x, p.y));
    return true;
  }
  // A second hit on a falling plane blows it apart in the air, so it never lands on the base.
  disintegrate(p: Plane) {
    p.dead = true;
    this.explosion(p.x, p.y, 1.3, false);
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.particles.push({ k: 'debris', x: p.x, y: p.y, vx: Math.cos(a) * rand(30, 90), vy: Math.sin(a) * rand(30, 90), life: rand(.8, 1.4), t: 0, r: rand(.5, 1) }); }
    Sound.boom(true, this.panOf(p.x, p.y));
    Sound.stopEngine(p.id);
    if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, 2.5);
  }

  /* ---------- bombs ---------- */
  updateBombs(dt: number) {
    for (const b of this.bombs) {
      b.t += this.perks.has('slowbomb') ? dt * .7 : dt;
      const nx = this.bombX(b, b.t);
      const ny = b.y0 + .5 * b.g * b.t * b.t;
      const vx = (nx - b.x) / dt, vy = (ny - b.y) / dt;
      b.x = nx; b.y = ny;
      b.angle = Math.atan2(-vx, Math.max(1, vy));
      b.trailT -= dt;
      if (b.trailT <= 0) { b.trailT = .08; const tl = this.bombTail(b); b.trail.push([tl.x, tl.y, this.t]); if (b.trail.length > 90) b.trail.shift(); }
      if (this.shieldT > 0 && this.inDome(b.x, b.y)) { this.domeHit(b); continue; }
      if (b.y >= GROUND_Y - 2) { b.dead = true; this.blame = !!b.byBomber; this.blameSniper = !!b.bySniper; this.bombLands(b); this.blame = this.blameSniper = false; }
    }
    this.bombs = this.bombs.filter(b => !b.dead);
    // keep finished trails fading in the sky
    for (const tr of this.trails) tr.t += dt;
    this.trails = this.trails.filter(tr => tr.t < 4);
  }
  bombLands(b: Bomb) {
    this.trails.push({ pts: b.trail, t: 0 });
    if (b.kind === 'nuke') { this.nukeLands(b); return; }
    const big = b.kind === 'bomb';
    // the heavy bomb hits twice as hard as it used to; the missile hits like the old small bomb
    const direct = big ? 320 : 70, splash = big ? 140 : 30, radius = big ? 90 : 52;
    this.explosion(b.x, GROUND_Y - 3, big ? 3.2 : 1.8, true);
    Sound.boom(big, this.panOf(b.x, GROUND_Y));
    if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, big ? 12 : 6);
    // the building under the bomb takes the full hit; everything else in the blast takes splash, less with distance
    for (const bb of this.buildings) {
      const d = Math.abs(b.x - bb.x) - bb.half;
      if (d <= 0) this.damageBuilding(bb, direct);
      else if (d < radius) this.damageBuilding(bb, splash * (1 - .5 * d / radius));
    }
  }

  // Small blast damage to every building within radius of (x, y), less with distance.
  blastBase(x: number, y: number, radius: number, dmg: number) {
    for (const bb of this.buildings) {
      const dx = Math.max(0, Math.abs(x - bb.x) - bb.half), dy = Math.max(0, (GROUND_Y - 16) - y);
      const d = Math.hypot(dx, dy);
      if (d < radius) this.damageBuilding(bb, dmg * (1 - .5 * d / radius), true);
    }
  }

  /* ---------- shells ---------- */
  updateShells(dt: number) {
    const steps = 2;
    const h = dt / steps;
    for (const s of this.shells) {
      for (let k = 0; k < steps && !s.dead; k++) {
        s.px = s.x; s.py = s.y;
        if (s.fall) {
          // a drop shot comes straight back down, picking up speed
          s.vx *= Math.pow(.15, h); s.vy = Math.min(300, s.vy + 240 * h);
        } else {
          const drag = Math.exp(-SHELL_K * h);
          if (this.perks.has('homing')) this.home(s, h);
          s.vx = s.vx * drag + this.wind * 14 * h;
          s.vy = s.vy * drag + SHELL_G * h;
        }
        s.x += s.vx * h; s.y += s.vy * h;
        s.t += h;
        const R = this.heavyFlak ? 15 : 9, pad = this.heavyFlak ? 3.5 : 1.5;
        if (s.ghost) this.ghostSweep(s, pad);
        else {
          const hit = this.sweepContact(s.px, s.py, s.x, s.y, pad, !!s.fall);
          if (hit) { this.burst(s, hit, this.shellDmg, R, false, !!s.fall); break; }
        }
        // drop shot: where the shell would have burst at the top of its flight, it turns over and falls
        if (this.dropShot && !s.fall && s.t >= SHELL_LIFE && s.y < DROP_FLOOR) {
          s.fall = true; s.vy = Math.max(0, s.vy * .2);
          this.particles.push({ k: 'flash', x: s.x, y: s.y, r: 4, life: .15, t: 0, vx: 0, vy: 0 });
          continue;
        }
        const end = s.fall ? s.t >= SHELL_LIFE + DROP_LIFE || s.y > DROP_FLOOR : s.t >= SHELL_LIFE || s.y > GROUND_Y - 4;
        if (!end) continue;
        // a falling drop shot or a ghost shell fades out without a burst, so it can't touch the base or a friendly plane
        if (s.ghost || s.fall) { this.fizzle(s); break; }
        this.burst(s, null, this.shellDmg, R);
        break;
      }
    }
    this.shells = this.shells.filter(s => !s.dead);
  }
  /** A ghost shell flies on through enemy planes and bombs, hitting each one once, and passes friendly planes and crates by. */
  ghostSweep(s: Shell, pad: number) {
    const hit = s.hit ??= new Set();
    for (let i = 1; i <= 3; i++) {
      const x = s.px + (s.x - s.px) * i / 3, y = s.py + (s.y - s.py) * i / 3;
      for (const p of this.planes) {
        if (p.type === 'cargo' || p.friend || hit.has(p) || !this.hittable(p)) continue;
        if (this.planeDist(p, x, y) >= pad) continue;
        hit.add(p);
        this.damagePlane(p, 1, [x, y]);
        this.particles.push({ k: 'flash', x, y, r: 7, life: .18, t: 0, vx: 0, vy: 0 });
      }
      for (const b of this.bombs) {
        if (b.dead || hit.has(b) || Math.hypot(b.x - x, b.y - y) - this.bombR(b) >= pad) continue;
        hit.add(b);
        this.killBomb(b);
      }
    }
  }
  /** A shell that ends without a burst: a ghost shell, or a drop shot that has fallen as far as it may. */
  fizzle(s: Shell) {
    s.dead = true;
    if (s.counted !== false) this.scoreShot(!!s.hit?.size);
    this.addPuff(s.x, s.y, 'smokeLight', 1.4, 1.5, .4, 0, -3, 1.2);
  }
  // Returns the burst point if a shot moving from (px, py) to (x, y) touched something. A `safe` shot (a falling drop shot) passes friendly planes and crates by.
  sweepContact(px: number, py: number, x1: number, y1: number, pad: number, safe = false): [number, number] | null {
    const segs = 3;
    for (let i = 1; i <= segs; i++) {
      const x = px + (x1 - px) * i / segs, y = py + (y1 - py) * i / segs;
      for (const p of this.planes) {
        if (!this.hittable(p) || safe && (p.type === 'cargo' || p.friend)) continue;
        // with the upgrade shifter, a cargo plane moves out of the way just before a shot gets to it, and the shot flies on
        if (p.type === 'cargo' && this.shifter) { if (this.planeDist(p, x, y) < pad + DODGE_PAD) this.dodge(p); continue; }
        if (this.planeDist(p, x, y) < pad) return [x, y];
      }
      for (const b of this.bombs) if (Math.hypot(b.x - x, b.y - y) - this.bombR(b) < pad) return [x, y];
      if (!safe && this.armDist(x, y) < pad + 1.5) return [x, y];
      for (const c of this.crates) {
        if (c.landed || c.dead || c.held || safe) continue;
        if (this.shifter) { if (Math.hypot(c.x - x, c.y - 4 - y) < 6 + pad + DODGE_PAD) this.dodge(c); continue; }
        if (Math.hypot(c.x - x, c.y - 4 - y) < 6 + pad) return [x, y];
      }
    }
    return null;
  }
  planeDist(p: Plane, x: number, y: number) {
    const L = HALF[p.type] * SC[p.type] * .85 * Math.max(.25, Math.abs(p.flip));
    const ca = Math.cos(p.pitch * p.dir), sa = Math.sin(p.pitch * p.dir);
    const dx = x - p.x, dy = y - p.y;
    const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
    const cx = clamp(lx, -L, L);
    return Math.hypot(lx - cx, ly) - TYPES[p.type].r;
  }
  burst(s: Shell | Missile, at: [number, number] | null, dmg = 1, radius = 9, fire = false, safe = false) {
    s.dead = true;
    const [x, y] = at || [s.x, s.y];
    const R = radius;
    let hitEnemy = false;
    for (const p of this.planes) {
      if (!this.hittable(p)) continue;
      if (this.planeDist(p, x, y) < R) {
        if (safe && (p.type === 'cargo' || p.friend)) continue;
        if (p.type === 'cargo') { if (!this.dodge(p)) this.cargoLost(true); continue; }
        if (p.friend) { this.friendlyDown(p); continue; }
        const flying = p.state !== 'falling';
        this.damagePlane(p, dmg, [x, y]); hitEnemy = true;
        if (fire && flying) p.burning = true;
      }
    }
    for (const b of this.bombs) {
      if (b.dead) continue;
      if (Math.hypot(b.x - x, b.y - y) < R + this.bombR(b)) {
        b.hp -= dmg; hitEnemy = true;
        if (b.hp <= 0) this.killBomb(b);
      }
    }
    if (!safe) for (const c of this.crates) if (!c.landed && !c.dead && !c.held && Math.hypot(c.x - x, c.y - 4 - y) < R + 5 && !this.dodge(c)) this.crateLost(c);
    if (!safe && this.armDist(x, y) < R) { this.hitArm(dmg); hitEnemy = true; }
    if (s.counted !== false) this.scoreShot(hitEnemy);
    this.flak(x, y, R / 9);
    Sound.flak(Math.min(1, Math.hypot(x, y) / 800), this.panOf(x, y));
  }
  scoreShot(hit: boolean) {
    if (hit) { this.stats.hitShots++; this.mult = Math.min(4, this.mult + 1); }
    else this.mult = Math.max(1, this.mult - 1);
  }
  // A bomb shot out of the air goes off where it is.
  killBomb(b: Bomb) {
    b.dead = true;
    this.trails.push({ pts: b.trail, t: 0 });
    const big = b.kind !== 'missile';
    const upper = b.y < (b.y0 + GROUND_Y) / 2;
    this.addScore((b.kind === 'nuke' ? 200 : big ? 50 : 25) * (upper ? 2 : 1), b.x, b.y, b.kind === 'nuke' ? 'Nuke stopped' : upper ? 'High intercept' : null);
    this.stats.intercepts++;
    // the bomb goes off in the air: a bigger blast, which still scorches the base if it was close
    this.explosion(b.x, b.y, big ? 1.7 : 1.25, false);
    Sound.intercept(this.panOf(b.x, b.y));
    Sound.boom(big, this.panOf(b.x, b.y));
    if (!this.perks.has('clean')) this.blastBase(b.x, b.y, big ? 68 : 52, big ? 24 : 12);
    if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, big ? 5 : 3.5);
    // and it catches any plane flying close by
    const pr = big ? 40 : 30;
    for (const p of this.planes) if (p.type !== 'cargo' && !p.friend && this.hittable(p) && this.planeDist(p, b.x, b.y) < pr) this.damagePlane(p, 1, [b.x, b.y]);
  }
  // The nuke: everything hostile in a huge radius takes a crushing hit. It spares the cargo plane and friendly planes.
  detonateNuke(m: Missile) {
    m.dead = true;
    const { x, y } = m;
    let hit = false;
    for (const p of this.planes) {
      if (p.type === 'cargo' || p.friend || !this.hittable(p)) continue;
      if (this.planeDist(p, x, y) < NUKE_R) { this.damagePlane(p, NUKE_DMG, [p.x, p.y]); hit = true; }
    }
    for (const b of this.bombs) if (!b.dead && Math.hypot(b.x - x, b.y - y) < NUKE_R) { this.killBomb(b); hit = true; }
    this.scoreShot(hit);
    this.explosion(x, y, 3.5, false);
    this.particles.push({ k: 'ring', x, y, r: 10, grow: NUKE_R / .55, life: .7, t: 0, vx: 0, vy: 0 });
    this.particles.push({ k: 'flash', x, y, r: NUKE_R * .6, life: .9, t: 0, vx: 0, vy: 0 });
    this.nukeFlash = 1;
    if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, 14);
    Sound.nuke(this.panOf(x, y));
    this.vibrate(250);
  }

  updateMissiles(dt: number) {
    for (const m of this.missiles) {
      m.t += dt;
      const px = m.x, py = m.y;
      if (m.kind === 'missile') {
        const tg = m.target && !m.target.dead && m.target.state !== 'falling' ? m.target : null;
        const sp = Math.hypot(m.vx, m.vy), v = Math.min(420, sp + 260 * dt);
        let ang = Math.atan2(m.vy, m.vx);
        if (tg) {
          const want = Math.atan2(tg.y - m.y, tg.x - m.x);
          let d = want - ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          ang += clamp(d, -3.2 * dt, 3.2 * dt);
        }
        m.vx = Math.cos(ang) * v; m.vy = Math.sin(ang) * v;
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.smokeT -= dt;
        if (m.smokeT <= 0) { m.smokeT = .02; this.addPuff(m.x, m.y, 'contrail', 1.2, 2.6, .5, 0, -3, 1.4); }
        if (tg && this.planeDist(tg, m.x, m.y) < 3) this.burst(m, [m.x, m.y], 1, 12);
        else if (m.t > 4.5 || m.y > GROUND_Y) this.burst(m, null, 1, 12);
        continue;
      }
      const sp = Math.hypot(m.vx, m.vy) || 1, ux = m.vx / sp, uy = m.vy / sp;
      if (m.kind === 'rocket') {
        // speeds up hard, leaving a thick trail of smoke that hangs in the sky
        const v = Math.min(560, sp + 520 * dt);
        m.vx = ux * v; m.vy = uy * v + 8 * dt;
        m.smokeT -= dt;
        while (m.smokeT <= 0) {
          m.smokeT += .012;
          const k = Math.random();
          this.addPuff(m.x - m.vx * dt * k - ux * 4, m.y - m.vy * dt * k - uy * 4, 'smokeLight', rand(1.2, 1.8), 2.6, .62, rand(-2, 2), rand(-3, 1), rand(2.6, 3.6));
        }
        if (Math.random() < .5) this.addFire(m.x - ux * 4, m.y - uy * 4, .45);
      } else if (m.kind === 'fireball') {
        m.vy += 70 * dt;
        this.addFire(m.x + rand(-1.5, 1.5), m.y + rand(-1.5, 1.5), rand(.7, 1));
        m.smokeT -= dt;
        if (m.smokeT <= 0) { m.smokeT = .04; this.addPuff(m.x, m.y, 'smokeDark', 1.2, 2, .35, 0, -4, 1.2); }
      } else if (m.kind === 'cluster') {
        const drag = Math.exp(-SHELL_K * dt);
        m.vx = m.vx * drag + this.wind * 14 * dt; m.vy = m.vy * drag + SHELL_G * dt;
      } else if (m.kind === 'bomblet') {
        m.vx *= Math.pow(.3, dt); m.vy = m.vy * Math.pow(.3, dt) + 30 * dt;
        if (Math.random() < .4) this.addFire(m.x, m.y, .35);
      } else {
        m.vy += 18 * dt;
        m.smokeT -= dt;
        if (m.smokeT <= 0) { m.smokeT = .02; this.addPuff(m.x - ux * 6, m.y - uy * 6, 'smokeLight', 1.8, 3, .55, 0, -2, 2.2); }
      }
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.kind === 'bomblet') {
        // each bomblet goes off on its own short fuse, or on anything it touches
        const hit = this.sweepContact(px, py, m.x, m.y, 2);
        if (hit || m.t > (m.fuse ?? .5) || m.y > GROUND_Y - 4) this.burst(m, hit, 1, 11);
        continue;
      }
      const pad = m.kind === 'nuke' ? 6 : m.kind === 'fireball' ? 4 : 2.5;
      const hit = this.sweepContact(px, py, m.x, m.y, pad);
      const out = m.t > (m.kind === 'nuke' ? 2.6 : m.kind === 'cluster' ? 1.6 : 3.2) || m.y > GROUND_Y - 4;
      if (!hit && !out) continue;
      if (m.kind === 'nuke') { this.detonateNuke(m); continue; }
      if (m.kind === 'cluster') { this.scatter(m, hit); continue; }
      if (m.kind === 'rocket') {
        this.burst(m, hit, 1, 26);
        this.explosion(m.x, m.y, .9, false);
        Sound.boom(false, this.panOf(m.x, m.y));
        if (!this.settings.reduceMotion) this.shake = Math.max(this.shake, 2.5);
      } else this.burst(m, hit, 1, 16, true);
    }
    this.missiles = this.missiles.filter(m => !m.dead);
  }

  updatePulses(dt: number) {
    for (const s of this.pulses) {
      s.r += SONIC_SPEED * dt;
      const inArc = (x: number, y: number, pad: number) => {
        const d = Math.hypot(x - s.x, y);
        let da = Math.atan2(x - s.x, -y) - s.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        return Math.abs(d - s.r) < pad && Math.abs(da) < SONIC_SPREAD + pad / Math.max(d, 1);
      };
      for (const p of this.planes) {
        if (p.type === 'cargo' || p.friend || !this.hittable(p) || s.hit.has(p)) continue;
        if (!inArc(p.x, p.y, 14 + HALF[p.type] * SC[p.type] * .5)) continue;
        s.hit.add(p); s.hitAny = true;
        this.damagePlane(p, 1, [p.x, p.y]);
      }
      for (const b of this.bombs) {
        if (b.dead || s.hit.has(b) || !inArc(b.x, b.y, 12)) continue;
        s.hit.add(b); s.hitAny = true;
        this.killBomb(b);
      }
    }
    for (const s of this.pulses) if (s.r > SONIC_RANGE) this.scoreShot(s.hitAny);
    this.pulses = this.pulses.filter(s => s.r <= SONIC_RANGE);
  }

  /* ---------- upgrades and resupply ---------- */
  // Once a wave the cargo plane flies over on its own. It drops a crate onto a landing zone
  // on one side of the base or the other; tapping the landed crate opens the upgrade choice.
  canLaunchCargo() { return !this.war && this.alive('hangar') && !this.cargo && !this.crates.length; }
  launchCargo() {
    this.cargoAt = null;
    this.lzX = pick(LZ_SPOTS);
    const dir = Math.random() < .5 ? 1 : -1;
    const T = TYPES.cargo;
    this.cargo = {
      id: nextId++, type: 'cargo', dir, x: -dir * (this.xe + 80), y: T.alts[0], alt: T.alts[0], speed: T.speed, hp: 100, max: 100,
      state: 'fly', stateT: 0, pitch: 0, flip: 1, turnT: 0, hits: [], trail: [], trailT: 0, smokeT: 0, dropped: false, lightPhase: 0,
      dropCD: 0, diveCD: 0, burnT: 0, burning: false, hitFlash: 0, vx: 0, vy: 0, spin: 0, gold: this.goldWave,
    };
    this.planes.push(this.cargo);
    if (this.goldWave) {
      this.labels.push({ text: 'Gold plane incoming', x: 0, y: GROUND_Y - 70, t: 0, life: 2.6, color: '#ffd34a', big: true });
      this.tip('gold', "A gold plane! Its gold pack lets you choose any permanent upgrade, even the gold-only ones. Don't shoot it.");
    }
    for (const p of this.planes) if (p.type === 'fighter' && p.state === 'fly' && !p.player && Math.random() < .35) p.chaseCargo = true;
    this.tip('cargo', "An upgrade is on its way. Don't shoot the cargo plane or its crate.");
    this.hooks.hud && this.hooks.hud();
  }
  /** The crate waiting on the landing zone, if there is one (in war mode, the one beside the turret in use). */
  readyCrate() { return this.readyCrates()[0] ?? null; }
  /** Every crate waiting to be opened (there can be two: a diamond pack beside another crate). */
  readyCrates() { return this.ended ? [] : this.crates.filter(c => c.landed && !c.dead && (!this.war || Math.abs(c.lz - this.gunX) < 150)); }
  /** Whether this upgrade would do anything right now. */
  offerable(id: UpgradeId) {
    switch (id) {
      case 'dual': return this.guns === 1;
      case 'triple': return this.guns === 2;
      case 'reload': return !this.fastLoad;
      case 'flak': return !this.heavyFlak;
      case 'leech': return !this.leech;
      case 'shifter': return !this.shifter;
      case 'ghost': return !this.ghost;
      case 'drop': return !this.dropShot;
      case 'laststand': return !this.perks.has(id) && !this.lastStandUsed;
      case 'repair': return this.baseHealth() < .9;
      case 'rebuild': return this.buildings.some(b => b.ruined);
      case 'shield': return this.shieldT <= 0;
      default: return true;
    }
  }
  /** The choice in a crate. A gold pack offers every permanent upgrade not yet owned; a plain crate a random three of the rest. */
  offers(pack: PackKind = 'plain'): UpgradeId[] {
    if (pack !== 'plain') {
      const g = (pack === 'gold' ? GOLD_PACK : DIAMOND_PACK).filter(k => this.offerable(k));
      if (g.length) return g;
    }
    const ids = (Object.keys(UPGRADES) as UpgradeId[]).filter(k => this.offerable(k) && !GOLD_ONLY.includes(k as PerkId) && !DIAMOND_PACK.includes(k as PerkId));
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    // a badly damaged base always gets the chance to repair
    const out = ids.slice(0, 3);
    if (this.baseHealth() < .5 && ids.includes('repair') && !out.includes('repair')) out[2] = 'repair';
    return out;
  }
  /** Opens the waiting crate with the chosen upgrade, which takes effect at once. */
  chooseUpgrade(id: UpgradeId, crate: Crate | null = null) {
    const c = crate && !crate.dead ? crate : this.readyCrate();
    if (c) c.dead = true;
    this.crates = this.crates.filter(cr => !cr.dead);
    if (isWeapon(id)) { this.weapon = id; this.ammo = AMMO[id] * (this.perks.has('overcharge') ? 2 : 1); this.fireCD = 0; }
    else if (SET_PERKS.includes(id as PerkId)) this.perks.add(id as PerkId);
    else if (id === 'dual' || id === 'triple') this.guns = id === 'dual' ? 2 : 3;
    else if (id === 'reload') this.fastLoad = true;
    else if (id === 'flak') this.heavyFlak = true;
    else if (id === 'leech') this.leech = true;
    else if (id === 'shifter') this.shifter = true;
    else if (id === 'ghost') this.ghost = true;
    else if (id === 'drop') this.dropShot = true;
    else if (id === 'repair') this.repairBase();
    else if (id === 'rebuild') this.rebuildBase();
    else if (id === 'shield') { this.shieldT = SHIELD_TIME; Sound.shield(); }
    this.lock = { target: null, t: 0, step: 0, locked: false };
    this.firing = false;
    if (id === 'missiles') this.tip('missile', 'Hold a plane in your sights to lock on, then tap to fire a missile.');
    if (id === 'laser') this.tip('laser', 'Hold your finger down to keep the laser on.');
    if (id === 'lightning') this.tip('lightning', 'Aim near a plane and tap. The bolt jumps to whatever is close by.');
    if (id === 'leech') this.tip('leech', 'Leeching: every plane you shoot down heals your standing buildings a little.');
    if (c?.gold || c?.diamond) for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28; this.particles.push({ k: 'spark', x: c.x, y: c.y - 3, vx: Math.cos(a) * rand(20, 60), vy: Math.sin(a) * rand(20, 60) - 20, life: rand(.5, .9), t: 0, r: .6 }); }
    this.labels.push({ text: UPGRADES[id].name, x: this.gunX, y: GROUND_Y - 70, t: 0, life: 2.4, color: '#bff5cf', big: true });
    if (c) for (let i = 0; i < 6; i++) this.addPuff(c.x + rand(-4, 4), LZ_Y - rand(0, 4), 'dust', rand(1.5, 2.5), 2, .5, rand(-6, 6), -6);
    Sound.pop();
    this.vibrate(20);
    this.hooks.hud && this.hooks.hud();
  }
  updateCargo(dt: number) {
    const c = this.cargo;
    if (c && c.dead) this.cargo = null;
    else if (c) {
      c.x += c.dir * c.speed * dt;
      // an upgrade shifter dodge: a quick hop off its line and back
      if (c.dodgeT && c.dodgeT > 0) { c.dodgeT = Math.max(0, c.dodgeT - dt); c.y = c.alt + (c.dodgeDir ?? 1) * 22 * Math.sin(Math.PI * (1 - c.dodgeT / DODGE_TIME)); }
      c.trailT -= dt;
      if (c.trailT <= 0) { c.trailT = .1; c.trail.push([c.x - c.dir * 17, c.y + 1, this.t]); if (c.trail.length > 45) c.trail.shift(); }
      if (c.hitByPlayer || c.hp < 100) {
        c.smokeT -= dt;
        if (c.smokeT <= 0) { c.smokeT = .05; this.addPuff(c.x - c.dir * 6, c.y, 'smokeDark', 1.6, 2.4, .7, 0, -5, 1.2); }
      }
      // let go a little before the landing zone; the chute steers the rest of the way
      if (!c.dropped && !c.hitByPlayer && (this.lzX - c.x) * c.dir <= 70) {
        c.dropped = true;
        this.crates.push({ x: c.x, y: c.y + 6, vx: c.dir * c.speed, vy: (LZ_Y - c.y - 6) / CRATE_FALL, lz: this.lzX, landed: false, t: 0, sway: 0, gold: c.gold });
      }
      if (Math.abs(c.x) > this.xe + 120) { c.dead = true; c.gone = true; Sound.stopEngine(c.id); this.planes = this.planes.filter(p => p !== c); this.cargo = null; }
    }
    for (const cr of this.crates) {
      cr.t += dt;
      if (cr.dodgeT && cr.dodgeT > 0) { cr.dodgeT = Math.max(0, cr.dodgeT - dt); cr.dodgeX = (cr.dodgeDir ?? 1) * 16 * Math.sin(Math.PI * (1 - cr.dodgeT / DODGE_TIME)); }
      // a crate in the Bomber's metal arm goes where the arm takes it
      if (cr.landed || cr.held) continue;
      // fall at a steady rate and steer toward the landing zone, arriving as it touches down
      cr.y = Math.min(LZ_Y, cr.y + cr.vy * dt);
      const left = Math.max(.3, (LZ_Y - cr.y) / cr.vy);
      cr.vx += ((cr.lz - cr.x) / left - cr.vx) * Math.min(1, dt * 1.2);
      cr.x += cr.vx * dt;
      cr.sway = Math.sin(cr.t * 1.3) * .12 - cr.vx * .004;
      if (cr.y >= LZ_Y) this.crateLanded(cr);
    }
    this.crates = this.crates.filter(cr => !cr.dead);
  }
  /** Spark jump and exploding wrecks: a kill reaches out to other enemy planes. Their kills don't chain on. */
  chainKill(p: Plane) {
    const spark = this.perks.has('spark'), wreck = this.perks.has('wreck');
    if (!spark && !wreck) return;
    this.chaining = true;
    const foes = this.planes.filter(q => q !== p && q.type !== 'cargo' && !q.friend && q.state !== 'falling' && this.hittable(q));
    if (wreck) {
      this.particles.push({ k: 'ring', x: p.x, y: p.y, r: 4, grow: 110, life: .4, t: 0, vx: 0, vy: 0 });
      for (const q of foes) if (Math.hypot(q.x - p.x, q.y - p.y) < 50) this.damagePlane(q, 1, [q.x, q.y]);
    }
    if (spark) {
      let best: Plane | null = null, bd = 280;
      for (const q of foes) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd && q.state !== 'falling') { bd = d; best = q; } }
      if (best) {
        this.bolts.push({ pts: [[p.x, p.y], [(p.x + best.x) / 2 + rand(-12, 12), (p.y + best.y) / 2 + rand(-12, 12)], [best.x, best.y]], life: .3 });
        this.damagePlane(best, 1, [best.x, best.y]);
        Sound.lightning();
      }
    }
    this.chaining = false;
  }
  /** Homing shells: a shell turns gently toward the nearest enemy plane ahead of it. */
  home(s: Shell, h: number) {
    const sp = Math.hypot(s.vx, s.vy) || 1;
    let best: Plane | null = null, bd = 180;
    for (const p of this.planes) {
      if (p.type === 'cargo' || p.friend || p.state === 'falling' || p.dead) continue;
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      if (d < bd && (dx * s.vx + dy * s.vy) / sp > d * .5) { bd = d; best = p; }
    }
    if (!best) return;
    const a = Math.atan2(s.vy, s.vx), want = Math.atan2(best.y - s.y, best.x - s.x);
    let da = want - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const na = a + clamp(da, -2.2 * h, 2.2 * h);
    s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
  }
  /** Point defense: now and then a zap from the base takes out the bomb or missile closest to landing. */
  updateSweeper(dt: number) {
    if (!this.perks.has('sweeper') || this.ended) return;
    this.sweepT -= dt;
    if (this.sweepT > 0) return;
    let low: Bomb | null = null;
    for (const b of this.bombs) if (!b.dead && b.y > -500 && (!low || b.y > low.y)) low = b;
    if (!low) { this.sweepT = 0; return; }
    this.sweepT = SWEEP_EVERY;
    const x0 = this.gunX, y0 = GROUND_Y - 20;
    this.bolts.push({ pts: [[x0, y0], [(x0 + low.x) / 2 + rand(-15, 15), (y0 + low.y) / 2], [low.x, low.y]], life: .3 });
    this.killBomb(low);
    Sound.lightning();
  }
  /** Sometimes a downed enemy plane lets go of a diamond pack, which floats down to an empty spot on the pad. */
  maybeDiamond(p: Plane) {
    if (this.ended || p.friend || p.type === 'cargo' || Math.random() >= DIAMOND_CHANCE) return;
    if (!DIAMOND_PACK.some(k => this.offerable(k)) || this.crates.some(c => c.diamond)) return;
    const post = this.post();
    let lz: number;
    if (this.war && post.outpost) lz = this.lzFor(post);
    else {
      const used = [...this.crates.map(c => c.lz), ...(this.cargo ? [this.lzX] : [])];
      const base = this.war ? post.x : 0;
      lz = base + (LZ_SPOTS.find(x => !used.some(u => Math.abs(u - (base + x)) < 20)) ?? LZ_SPOTS[0]);
    }
    const y = p.y + 4, fall = clamp((LZ_Y - y) / 45, 3, CRATE_FALL);
    this.crates.push({ x: p.x, y, vx: p.dir * p.speed * .3, vy: (LZ_Y - y) / fall, lz, landed: false, t: 0, sway: 0, diamond: true });
    this.labels.push({ text: 'Diamond pack!', x: p.x, y: p.y - 26, t: 0, life: 2.4, color: '#9fe6ff', big: true });
    this.tip('diamond', 'A diamond pack! It holds Ghost shot and Drop shot. Let it land, then open it.');
    Sound.pop();
  }
  /** Upgrade shifter: a cargo plane or falling crate about to be hit dodges, and the shot misses it. Returns whether it dodged. */
  dodge(o: Plane | Crate) {
    if (!this.shifter) return false;
    if (!(o.dodgeT && o.dodgeT > 0)) {
      o.dodgeT = DODGE_TIME;
      o.dodgeDir = Math.random() < .5 ? -1 : 1;
      this.labels.push({ text: 'Dodged', x: o.x, y: o.y - 14, t: 0, life: 1, color: '#ffd34a' });
      Sound.whine(.4, this.panOf(o.x, o.y));
    }
    return true;
  }
  crateLanded(c: Crate) {
    c.landed = true; c.t = 0; c.x = c.lz; c.y = LZ_Y; c.sway = 0;
    for (let i = 0; i < 5; i++) this.addPuff(c.x + rand(-5, 5), GROUND_Y - 1, 'dust', rand(1.2, 2), 2, .45, rand(-8, 8), -4, 1.6);
    this.labels.push({ text: c.diamond ? 'Diamond pack ready' : c.gold ? 'Gold pack ready' : 'Upgrade ready', x: c.x, y: GROUND_Y - 34, t: 0, life: 2.6, color: c.diamond ? '#9fe6ff' : c.gold ? '#ffd34a' : '#bff5cf', big: true });
    if (!this.war || Math.abs(c.lz - this.gunX) < 150) this.tip('crate', 'Tap the crate on the pad to open it.');
    Sound.pop();
    this.vibrate(20);
    this.hooks.hud && this.hooks.hud();
  }
  cargoLost(byPlayer: boolean) {
    const c = this.cargo;
    if (!c || c.hitByPlayer) return;
    // either way the plane goes down and its upgrade is lost
    c.hitByPlayer = byPlayer;
    c.state = 'falling'; c.stateT = 0; c.vx = c.dir * c.speed; c.vy = 0; c.spin = 0;
    this.cargo = null;
    this.explosion(c.x, c.y, .8, false);
    Sound.boom(false, this.panOf(c.x, c.y));
    if (byPlayer) {
      this.addScore(-500, c.x, c.y, 'Friendly fire');
      this.hooks.label && this.hooks.label('Upgrade lost');
      Sound.denied();
    } else this.labels.push({ text: 'Cargo plane shot down', x: c.x, y: c.y - 20, t: 0, life: 2.2, color: '#ff8a7a' });
  }
  crateLost(c: Crate) {
    c.dead = true;
    this.explosion(c.x, c.y, .7, false);
    this.addScore(-500, c.x, c.y, 'Friendly fire');
    Sound.denied();
  }

  /* ---------- base ---------- */
  repairBase() {
    for (const b of this.buildings) {
      if (b.ruined) { b.ruined = false; b.ruinT = 0; b.hp = b.max / 2; }
      else b.hp = b.max;
      for (let i = 0; i < 4; i++) this.addPuff(b.x + rand(-b.half, b.half), GROUND_Y - rand(2, 12), 'dust', rand(1.5, 2.5), 2.4, .5, rand(-5, 5), -8);
    }
    this.labels.push({ text: 'Base repaired', x: this.gunX, y: GROUND_Y - 50, t: 0, life: 2.4, color: '#9fe0b0' });
  }
  /** Every destroyed building rebuilt to full strength. */
  rebuildBase() {
    for (const b of this.buildings) {
      if (!b.ruined) continue;
      b.ruined = false; b.ruinT = 0; b.hp = b.max;
      for (let i = 0; i < 6; i++) this.addPuff(b.x + rand(-b.half, b.half), GROUND_Y - rand(2, 12), 'dust', rand(1.5, 2.5), 2.4, .5, rand(-5, 5), -8);
    }
    this.labels.push({ text: 'Base rebuilt', x: this.gunX, y: GROUND_Y - 50, t: 0, life: 2.4, color: '#9fe0b0' });
  }
  /** Leeching: a kill heals every standing building by 2% of its full strength. */
  leechHeal() {
    for (const b of this.buildings) {
      if (b.ruined || b.hp >= b.max) continue;
      b.hp = Math.min(b.max, b.hp + b.max * LEECH_HEAL);
      this.particles.push({ k: 'flash', x: b.x, y: GROUND_Y - 10, r: 6, life: .3, t: 0, vx: 0, vy: 0 });
    }
  }
  inDome(x: number, y: number) { const dx = x / DOME_RX, dy = (y - GROUND_Y) / DOME_RY; return dx * dx + dy * dy < 1; }
  /** A bomb or missile that reaches the shield bursts on it, harmlessly. */
  domeHit(b: Bomb) {
    b.dead = true;
    this.trails.push({ pts: b.trail, t: 0 });
    this.explosion(b.x, b.y, b.kind !== 'missile' ? 1.4 : 1, false);
    this.particles.push({ k: 'ring', x: b.x, y: b.y, r: 4, grow: 90, life: .35, t: 0, vx: 0, vy: 0 });
    Sound.boom(b.kind !== 'missile', this.panOf(b.x, b.y));
    this.shieldFlash = 1;
  }
  updateShield(dt: number) {
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 3);
    if (this.shieldT <= 0) return;
    this.shieldT -= dt;
    if (this.shieldT <= 0) { this.shieldT = 0; this.labels.push({ text: 'Shield down', x: 0, y: GROUND_Y - DOME_RY - 10, t: 0, life: 2, color: '#7fe9ff' }); }
  }
  baseHealth() { let h = 0, m = 0; for (const b of this.buildings) { h += b.ruined ? 0 : b.hp; m += b.max; } return h / m; }
  damageBuilding(b: Building, amt: number, quiet = false) {
    if (b.ruined || this.phase === 'idle') return;
    if (this.shieldT > 0) { this.shieldFlash = Math.max(this.shieldFlash, .5); return; }
    const dealt = amt * this.D.damage * (this.perks.has('armor') ? .75 : 1) * (this.protectT > 0 ? 1 - PROTECT.cut : 1);
    if (this.blame && this.bomber) this.bomber.damage += Math.min(Math.max(0, b.hp), dealt);
    if (this.blameSniper) this.sniperDamage += Math.min(Math.max(0, b.hp), dealt);
    b.hp -= dealt; b.hit = 1;
    // Last stand: once a game, the turret in use holds on at half strength instead of falling
    if (b.hp <= 0 && b.id === 'turret' && b === this.post() && this.perks.has('laststand') && !this.lastStandUsed) {
      this.lastStandUsed = true; this.perks.delete('laststand');
      b.hp = b.max / 2;
      this.labels.push({ text: 'Last stand!', x: b.x, y: GROUND_Y - 60, t: 0, life: 2.4, color: '#ffd34a', big: true });
      this.particles.push({ k: 'ring', x: b.x, y: GROUND_Y - 14, r: 6, grow: 120, life: .5, t: 0, vx: 0, vy: 0 });
      Sound.shield();
    }
    this.waveDamaged = true;
    if (b === this.post() && !this.settings.reduceMotion) this.shake = Math.max(this.shake, quiet ? 1.2 : 4);
    if (!quiet) this.vibrate(30);
    if (b.hp <= 0) {
      b.hp = 0; b.ruined = true; b.ruinT = 0;
      this.explosion(b.x, GROUND_Y - 10, 1.4, true);
      Sound.boom(true, this.panOf(b.x, GROUND_Y));
      this.vibrate(80);
      if (b.id === 'turret' && !this.war) { this.gameOver(); return; }
      this.labels.push({ text: `${b.name} destroyed`, x: b.x, y: GROUND_Y - 45, t: 0, life: 2.4, color: '#ff8a7a' });
      if (b.id === 'radar') this.tip('radar', 'Radar is down. No bomb shadows or plane arrows.');
      if (b.id === 'hangar') this.tip('hangar', 'Hangar is down. No more supply drops.');
      if (b.id === 'search' && !b.outpost) this.tip('search', 'Searchlight is down. At night, look for running lights.');
      if (this.war) {
        // the base is lost once all of its buildings are down; a lost turret sends the player to the nearest one left
        if (this.buildings.every(o => o.outpost || o.id === 'turret' || o.ruined)) { this.gameOver('The base was destroyed.'); return; }
        if (b === this.post()) {
          const left = this.posts.map((o, i) => [o, i] as const).filter(([o]) => !o.ruined).sort(([a], [c]) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x));
          if (!left.length) { this.gameOver('Every turret was destroyed.'); return; }
          this.goTo(left[0][1]);
        }
      }
      this.hooks.hud && this.hooks.hud();
    }
  }
  updateBase(dt: number) {
    for (const b of this.buildings) {
      b.hit = Math.max(0, b.hit - dt * 3);
      // Mending: standing buildings slowly repair themselves during play
      if (this.perks.has('mend') && !b.ruined && b.hp < b.max && !this.ended && this.phase !== 'idle') b.hp = Math.min(b.max, b.hp + b.max * MEND_RATE * dt);
      if (b.ruined) b.ruinT += dt;
      const frac = b.hp / b.max;
      const smoking = b.ruined ? b.ruinT < 25 : frac < .5;
      if (smoking) {
        b.smokeT -= dt;
        if (b.smokeT <= 0) {
          const heavy = b.ruined || frac < .25;
          b.smokeT = heavy ? .09 : .2;
          this.addPuff(b.x + rand(-6, 6), GROUND_Y - (b.ruined ? 4 : 14), heavy ? 'smokeDark' : 'smokeLight', rand(1.6, 2.4), 3.6, heavy ? .75 : .5, this.wind * 8 + rand(4, 9), rand(-16, -11), 4.5);
        }
      }
    }
  }

  waveCleared() {
    this.phase = 'clear'; this.phaseT = 0;
    const k = this.D.score;
    const bonus = Math.round(200 * this.wave * k);
    const health = Math.round(500 * this.baseHealth() * k);
    const perfect = this.waveDamaged ? 0 : Math.round(1000 * k);
    this.score += bonus + health + perfect;
    this.clearInfo = { bonus, health, perfect };
    for (const p of this.planes) p.burning = false;
    const next = paletteForWave(this.wave + 1);
    if (next !== this.palTo) { this.palFrom = this.currentPalId(); this.palTo = next; this.palT = 0; }
    this.hooks.waveClear && this.hooks.waveClear(this.clearInfo);
  }
  skipClear() { if (this.phase === 'clear' && this.phaseT > 1.2) this.phaseT = 10; }

  gameOver(reason = '') {
    if (this.ended) return;
    this.phase = 'over'; this.phaseT = 0; this.overT = 0;
    this.endReason = reason;
    this.firing = false;
    this.explosion(this.gunX, GROUND_Y - 14, 2.2, true);
    Sound.boom(true, 0);
    if (!this.settings.reduceMotion) this.shake = 8;
    const done = this.hooks.gameOver;
    if (done) setTimeout(() => done(this.results()), 3200);
  }
  results(): Results {
    return {
      mode: this.mode, difficulty: this.difficulty, score: this.score, wave: this.wave, accuracy: this.stats.shots ? this.stats.hitShots / this.stats.shots : 0, kills: this.stats.kills, intercepts: this.stats.intercepts,
      won: this.phase === 'won', reason: this.endReason, time: Math.min(WAR_TIME, this.warT), friendlies: this.strikes,
      bomber: this.bomber ? { name: this.bomber.name, damage: Math.round(this.bomber.damage), deaths: this.bomber.deaths, steals: this.bomber.steals } : undefined,
    };
  }

  /* ---------- scoring ---------- */
  addScore(base: number, x: number, y: number, note?: string | null) {
    const pts = base > 0 ? Math.round(base * this.mult * this.D.score) : base;
    this.score = Math.max(0, this.score + pts);
    this.labels.push({ text: (pts > 0 ? '+' : '') + pts + (note ? ' ' + note : ''), x, y: y - 14, t: 0, life: 1.3, color: pts > 0 ? '#fff1c8' : '#ff8a7a' });
  }
  /* ---------- effects ---------- */
  addPuff(x: number, y: number, color: ColorKey, r: number, grow: number, alpha: number, vx = 0, vy = 0, life = 2.5) {
    if (this.particles.length > 900) return;
    this.particles.push({ k: 'puff', x, y, r, grow, a: alpha, vx, vy, life, t: 0, color });
  }
  addFire(x: number, y: number, s: number) { this.particles.push({ k: 'fire', x, y, r: s, life: .35, t: 0, vx: rand(-4, 4), vy: -12 }); }
  flak(x: number, y: number, k: number) {
    this.fxLog?.push([0, x, y, k]);
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, d = Math.random() * 3 * k; this.addPuff(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, 'flak', (2.6 + Math.random() * 2) * k, 1.2, .9, Math.cos(a) * 4, Math.sin(a) * 4, rand(3, 4.5)); }
    this.particles.push({ k: 'flash', x, y, r: 9 * k, life: .18, t: 0, vx: 0, vy: 0 });
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; this.particles.push({ k: 'spark', x, y, vx: Math.cos(a) * rand(30, 60), vy: Math.sin(a) * rand(30, 60), life: .35, t: 0, r: .5 }); }
  }
  explosion(x: number, y: number, k: number, ground: boolean) {
    this.fxLog?.push([ground ? 2 : 1, x, y, k]);
    this.particles.push({ k: 'flash', x, y, r: 16 * k, life: .3, t: 0, vx: 0, vy: 0 });
    for (let i = 0; i < 10 * k; i++) this.addFire(x + rand(-5, 5) * k, y + rand(-4, 2) * k, rand(.6, 1.1) * k);
    for (let i = 0; i < 14 * k; i++) this.addPuff(x + rand(-6, 6) * k, y + rand(-5, 2) * k, i % 3 ? 'smokeDark' : 'smokeBlack', rand(2, 4) * k, 3, .8, rand(-10, 10) + this.wind * 6, rand(-18, -4), rand(2.5, 4.5));
    for (let i = 0; i < 10 * k; i++) { const a = -Math.PI * rand(.1, .9); this.particles.push({ k: 'debris', x, y, vx: Math.cos(a) * rand(20, 70) * k, vy: Math.sin(a) * rand(30, 80) * k, life: rand(.8, 1.6), t: 0, r: rand(.6, 1.2), ground }); }
  }
  updateParticles(dt: number) {
    const wind = this.wind * 10;
    for (const p of this.particles) {
      p.t += dt;
      if (p.k === 'puff') { p.x += (p.vx + wind * .6) * dt; p.y += p.vy * dt; p.vx *= Math.pow(.6, dt); p.vy *= Math.pow(.7, dt); p.r += (p.grow ?? 0) * dt; }
      else if (p.k === 'debris') { p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > GROUND_Y) { p.y = GROUND_Y; p.vx *= .5; p.vy *= -.25; } }
      else if (p.k === 'ring') p.r += (p.grow ?? 0) * dt;
      else if (p.k === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9; p.vy *= .9; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; }
    }
    this.particles = this.particles.filter(p => p.t < p.life);
  }

  panOf(x: number, y: number) { return clamp(Math.sin(Math.atan2(x - this.gunX, -y) - this.aim) * 1.4, -1, 1); }
  updateEngines() {
    for (const p of this.planes) {
      if (p.dead) continue;
      const a = Math.atan2(p.x - this.gunX, -p.y), diff = a - this.aim, dist = Math.hypot(p.x - this.gunX, p.y);
      const g = (p.type === 'boss' ? .1 : p.type === 'heavy' ? .07 : p.type === 'fighter' ? .06 : .05) * Math.max(.3, Math.cos(diff)) * clamp(1.25 - dist / 1100, .15, 1) * (p.state === 'falling' ? .6 : 1);
      Sound.engine(p.id, p.type, g, clamp(Math.sin(diff) * 1.5, -1, 1));
    }
  }

  vibrate(ms: number) {
    if (!this.settings.vibration || !navigator.vibrate) return;
    const now = performance.now();
    if (ms < 20 || now - this.lastVibe > 150) { this.lastVibe = now; try { navigator.vibrate(ms); } catch { } }
  }
  tip(key: string, text: string) { this.hooks.tip && this.hooks.tip(key, text); }
}
