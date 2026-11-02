// Game rules and simulation. World space: origin at the turret pivot, x right, y down,
// ground at GROUND_Y. Numbers follow the final mechanics plan and are tuning starting points.
import { BUILDINGS, WAR_POSTS, mockToWorld, GROUND_Y, SC, HALF, type AnyPlaneType, type PlaneType, type BuildingDef, type BuildingId } from './art';
import { paletteForWave, type ColorKey, type PaletteId } from './palettes';
import { Sound } from './audio';

export type PlaneState = 'fly' | 'turn' | 'warn' | 'dive' | 'strafe' | 'climb' | 'chase' | 'falling';
/** 'won' is only reached in war mode, when the level's clock runs out with the base still standing. */
export type Phase = 'idle' | 'intro' | 'combat' | 'clear' | 'over' | 'won';
/** Original: endless waves defending one turret. War: hold out for a fixed time from several turrets, among friendly planes. */
export type GameMode = 'original' | 'war';
/** Special weapons replace the gun until their ammo or time runs out. */
export type WeaponId = 'missiles' | 'laser' | 'rockets' | 'fireballs' | 'sonic' | 'nuke' | 'rapid' | 'lightning' | 'cluster';
/** Perks: permanent gun improvements (dual, triple, reload, flak), leeching and the upgrade shifter (only from a gold pack), and one-off help for the base (repair, rebuild, shield). */
export type PerkId = 'dual' | 'triple' | 'reload' | 'flak' | 'leech' | 'shifter' | 'ghost' | 'drop' | 'repair' | 'rebuild' | 'shield';
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
}
/** A heavy bomber's big bomb, or a light plane's missile (long and skinny, on the old bomb's arc). */
export type BombKind = 'bomb' | 'missile';
export interface Bomb { id: number; kind: BombKind; x: number; y: number; x0: number; y0: number; vx0: number; k: number; g: number; wa: number; t: number; T: number; hp: number; trail: TrailPoint[]; trailT: number; angle: number; dead?: boolean; }
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
  dodgeT?: number; dodgeDir?: number; dodgeX?: number; }
export interface Label { text: string; x: number; y: number; t: number; life: number; color: string; big?: boolean; }
/** `outpost` marks a war mode turret standing on its own away from the base. */
export interface Building { def: BuildingDef; id: BuildingId; name: string; x: number; half: number; hp: number; max: number; ruined: boolean; hit: number; smokeT: number; ruinT: number; outpost?: boolean; }
export interface WaveSpec { count: number; list: PlaneType[]; boss: boolean; }
export interface ClearInfo { bonus: number; health: number; perfect: number; }
export interface Results {
  mode: GameMode; difficulty: Difficulty; score: number; wave: number; accuracy: number; kills: number; intercepts: number;
  /** war mode: whether the level was passed, why it was lost, seconds survived and friendly planes shot down */
  won: boolean; reason: string; time: number; friendlies: number;
}
export interface Hooks {
  tip?: (key: string, text: string) => void;
  hud?: () => void;
  waveStart?: (n: number) => void;
  waveClear?: (info: ClearInfo) => void;
  gameOver?: (r: Results) => void;
  label?: (text: string) => void;
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
const GOLD_ONLY: PerkId[] = ['leech', 'shifter'];
/** A diamond pack holds only these two, and comes from a downed enemy plane 3% of the time. */
const DIAMOND_PACK: PerkId[] = ['ghost', 'drop'];
const DIAMOND_CHANCE = .03;
/** A drop shot falls for at most this long after turning over, and fizzles out this high above the ground so it never touches the base. */
const DROP_LIFE = 4, DROP_FLOOR = GROUND_Y - 40;
const GOLD_PACK: PerkId[] = ['dual', 'triple', 'reload', 'flak', 'leech', 'shifter'];
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
    this.posts = this.buildings.filter(b => b.id === 'turret');
    this.postI = this.posts.findIndex(b => !b.outpost);
    this.gunX = this.viewX = this.post().x;
    this.warT = 0; this.strikes = 0; this.enemyT = 0; this.friendT = 0; this.endReason = '';
    this.score = 0; this.mult = 1;
    this.fireCD = 0; this.recoil = 0; this.flash = 0;
    this.guns = 1; this.fastLoad = false; this.heavyFlak = false; this.leech = false; this.shifter = false; this.ghost = false; this.dropShot = false; this.goldWave = false; this.shieldT = 0; this.shieldFlash = 0;
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
  }

  get D() { return DIFFICULTY[this.difficulty]; }
  /** The base's own building of this kind (in war mode the outposts are turrets too, but never this one). */
  b(id: BuildingId): Building { return this.buildings.find(b => b.id === id && !b.outpost)!; }
  alive(id: BuildingId) { return !this.b(id).ruined; }
  /** The turret the player is using. */
  post(): Building { return this.posts[this.postI]; }
  get war() { return this.mode === 'war'; }
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
    this.goldWave = Math.random() < GOLD_CHANCE;
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
    for (const p of this.planes) if (p.type !== 'cargo' && p.state !== 'falling') n++;
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
  press() { this.firing = true; this.tapEdge = true; }
  tap() { this.tapEdge = true; this.oneShot = true; }
  release() { this.firing = false; }

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
    this.updatePlanes(dt);
    this.updateBombs(dt);
    this.updateShells(dt);
    this.updateMissiles(dt);
    this.updatePulses(dt);
    this.updateShield(dt);
    this.updateCargo(dt);
    this.updateBase(dt);
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
      default: this.fireShell(); this.fireCD = (w === 'rapid' ? FIRE_INTERVAL / 3 : FIRE_INTERVAL) * (this.fastLoad ? 2 / 3 : 1);
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
    const n = this.guns;
    for (let k = 0; k < n; k++) {
      // a pair splits 1.6 degrees each side; a fan of three goes 2.4 degrees out from the middle
      const c = k - (n - 1) / 2;
      const off = c * (n === 3 ? 2.4 : 3.2) * Math.PI / 180;
      const a = this.aim + off;
      const [dx, dy] = this.aimDir(a);
      const side = c * (n === 3 ? 3.4 : 4.4);
      this.shells.push({ x: this.gunX + dx * BARREL + Math.cos(this.aim) * side, y: dy * BARREL + Math.sin(this.aim) * side, vx: dx * SHELL_V0, vy: dy * SHELL_V0, t: 0, px: 0, py: 0, ghost: this.ghost || undefined });
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
      if (c && !cr.landed && !cr.dead && Math.hypot(cr.x - c[0], cr.y - 4 - c[1]) < 7 && !this.dodge(cr)) this.crateLost(cr);
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
      else if (p.type === 'fighter') this.updateFighter(p, dt);
      else this.updateCruise(p, dt);
      if (!p.friend && (p.type === 'light' || p.type === 'heavy' || p.type === 'boss')) this.tryDrop(p, dt);
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
    this.bombs.push({ id: nextId++, kind, x: x0, y: y0, x0, y0, vx0, k, g, wa, t: 0, T, hp: 1, trail: [], trailT: 0, angle: 0 });
    if (kind === 'missile') {
      for (let i = 0; i < 4; i++) this.addPuff(x0 + rand(-2, 2), y0 + rand(-1, 1), 'smokeLight', rand(1.2, 2), 2, .5, rand(-4, 4), rand(-2, 2), 1.4);
      if (p.type !== 'boss') this.tip('enemyMissile', 'Light planes fire missiles at your base. Shoot them down before they land.');
    } else this.tip('bomb', 'Heavy bombs hit very hard. Shoot them before they land.');
  }
  bombX(b: Bomb, t: number) { return b.x0 + b.vx0 * (1 - Math.exp(-b.k * t)) / b.k + .5 * b.wa * t * t; }
  bombLandX(b: Bomb) { return this.bombX(b, b.T); }
  bombR(b: Bomb) { return b.kind === 'bomb' ? 3.2 : 1.8; }
  // the tail, where the smoke trail comes out: the sprite's nose points along the fall, so the tail is behind it
  bombTail(b: Bomb) { const L = b.kind === 'bomb' ? 5.3 : 4.8; return { x: b.x + Math.sin(b.angle) * L, y: b.y - Math.cos(b.angle) * L }; }

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
      this.addScore(TYPES[p.type].points, p.x, p.y);
      this.stats.kills++;
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
      if (this.leech) this.leechHeal();
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
      b.t += dt;
      const nx = this.bombX(b, b.t);
      const ny = b.y0 + .5 * b.g * b.t * b.t;
      const vx = (nx - b.x) / dt, vy = (ny - b.y) / dt;
      b.x = nx; b.y = ny;
      b.angle = Math.atan2(-vx, Math.max(1, vy));
      b.trailT -= dt;
      if (b.trailT <= 0) { b.trailT = .08; const tl = this.bombTail(b); b.trail.push([tl.x, tl.y, this.t]); if (b.trail.length > 90) b.trail.shift(); }
      if (this.shieldT > 0 && this.inDome(b.x, b.y)) { this.domeHit(b); continue; }
      if (b.y >= GROUND_Y - 2) { b.dead = true; this.bombLands(b); }
    }
    this.bombs = this.bombs.filter(b => !b.dead);
    // keep finished trails fading in the sky
    for (const tr of this.trails) tr.t += dt;
    this.trails = this.trails.filter(tr => tr.t < 4);
  }
  bombLands(b: Bomb) {
    this.trails.push({ pts: b.trail, t: 0 });
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
          s.vx = s.vx * drag + this.wind * 14 * h;
          s.vy = s.vy * drag + SHELL_G * h;
        }
        s.x += s.vx * h; s.y += s.vy * h;
        s.t += h;
        const R = this.heavyFlak ? 15 : 9, pad = this.heavyFlak ? 3.5 : 1.5;
        if (s.ghost) this.ghostSweep(s, pad);
        else {
          const hit = this.sweepContact(s.px, s.py, s.x, s.y, pad, !!s.fall);
          if (hit) { this.burst(s, hit, 1, R, false, !!s.fall); break; }
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
        this.burst(s, null, 1, R);
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
      for (const c of this.crates) {
        if (c.landed || c.dead || safe) continue;
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
    if (!safe) for (const c of this.crates) if (!c.landed && !c.dead && Math.hypot(c.x - x, c.y - 4 - y) < R + 5 && !this.dodge(c)) this.crateLost(c);
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
    const big = b.kind === 'bomb';
    const upper = b.y < (b.y0 + GROUND_Y) / 2;
    this.addScore((big ? 50 : 25) * (upper ? 2 : 1), b.x, b.y, upper ? 'High intercept' : null);
    this.stats.intercepts++;
    // the bomb goes off in the air: a bigger blast, which still scorches the base if it was close
    this.explosion(b.x, b.y, big ? 1.7 : 1.25, false);
    Sound.intercept(this.panOf(b.x, b.y));
    Sound.boom(big, this.panOf(b.x, b.y));
    this.blastBase(b.x, b.y, big ? 68 : 52, big ? 24 : 12);
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
    for (const p of this.planes) if (p.type === 'fighter' && p.state === 'fly' && Math.random() < .35) p.chaseCargo = true;
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
    if (isWeapon(id)) { this.weapon = id; this.ammo = AMMO[id]; this.fireCD = 0; }
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
      if (cr.landed) continue;
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
    this.explosion(b.x, b.y, b.kind === 'bomb' ? 1.4 : 1, false);
    this.particles.push({ k: 'ring', x: b.x, y: b.y, r: 4, grow: 90, life: .35, t: 0, vx: 0, vy: 0 });
    Sound.boom(b.kind === 'bomb', this.panOf(b.x, b.y));
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
    b.hp -= amt * this.D.damage; b.hit = 1;
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
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, d = Math.random() * 3 * k; this.addPuff(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, 'flak', (2.6 + Math.random() * 2) * k, 1.2, .9, Math.cos(a) * 4, Math.sin(a) * 4, rand(3, 4.5)); }
    this.particles.push({ k: 'flash', x, y, r: 9 * k, life: .18, t: 0, vx: 0, vy: 0 });
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; this.particles.push({ k: 'spark', x, y, vx: Math.cos(a) * rand(30, 60), vy: Math.sin(a) * rand(30, 60), life: .35, t: 0, r: .5 }); }
  }
  explosion(x: number, y: number, k: number, ground: boolean) {
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
