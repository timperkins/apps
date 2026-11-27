// Bugs, their nests, pollution, turrets and the player's guns.
import { ENTITIES, maxHp, type ItemId } from './data';
import type { Entity, Game } from './sim';
import { WORLD } from './world';
import { bulletMult, fireRate, healing, railMult, turretRange } from './bonus';
import { absorb, lasersReady, LASER_DAMAGE, LASER_RANGE, LASER_SHOT_J } from './armor';
import { addGhost } from './robots';

export const BUG_NAMES = ['Calvin', 'Archie', 'Mom', 'Dad', 'Roger'];
/** The player walks 6 tiles/s; bugs run at 95% of that. */
export const PLAYER_SPEED = 6;
export const BUG_SPEED = PLAYER_SPEED * 0.95;
/** Bugs attack anyone inside a 20 by 20 tile square around them. */
export const AGGRO_HALF = 10;
/** Seconds to put a new magazine in the gun. */
export const RELOAD_TICKS = Math.round(1.45 * 60);
export const MAG_SIZE = 10;
/** After shooting while walking you stand still this long. */
export const SHOOT_STOP_TICKS = 60;

export interface BugKind {
  name: string;
  hp: number;
  speed: number; // tiles/s
  damage: number;
  size: number;
  color: string;
  shell: string;
}

export const BUG_KINDS: BugKind[] = [
  { name: 'Small bug', hp: 15, speed: BUG_SPEED, damage: 7, size: 0.32, color: '#7fbf3f', shell: '#4e8a22' },
  { name: 'Big bug', hp: 80, speed: BUG_SPEED, damage: 16, size: 0.48, color: '#e08a2e', shell: '#a8561a' },
  { name: 'Huge bug', hp: 380, speed: BUG_SPEED, damage: 35, size: 0.7, color: '#a35ad8', shell: '#6a2c9a' },
];

export interface Bug {
  id: number;
  x: number;
  y: number;
  kind: number;
  hp: number;
  name: string;
  mode: 'idle' | 'attack' | 'chase';
  tx: number;
  ty: number;
  nest: number;
  cd: number;
  angle: number;
  anim: number;
  stuck: number;
}

export interface Nest {
  id: number;
  x: number; // centre
  y: number;
  hp: number;
  anger: number;
  spawnCd: number;
  pulse: number;
}

export interface Fx {
  kind: 'bullet' | 'rail' | 'splat' | 'boom' | 'bite' | 'laser' | 'grenade' | 'drone' | 'rocket' | 'flame';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number; // ticks left
  life: number;
  color?: string;
}

export const NEST_HP = 400;
export const NEST_R = 1.4;
export const PLAYER_HP = 250;
const GRACE_TICKS = 60 * 60 * 10; // ten quiet minutes before the first attack
/** At least this long between two attack waves. */
const WAVE_GAP_TICKS = 60 * 60 * 3;
/** Pollution a nest must soak up before it sends a wave. */
const ANGER_PER_WAVE = 60;
const CELL = 32;
const CELLS = WORLD / CELL;
/** Advanced mode's finer pollution: 4 by 4 tile cells that spread one cell each cycle. */
export const APC = 4;
export const AN = WORLD / APC;
const CYCLE_TICKS = 120;
/** Pollution you can see on the map. */
export const POLLUTION_SEEN = 0.1;
/** Nests only get angry when this much pollution reaches them. */
const NEST_SMELLS = 0.5;
/** At least this long between a raid on a nest and the next wave. */
const RAID_GAP_TICKS = 60 * 60;
/** Bugs answer a raid on their nest this many ticks later. */
const RAID_DELAY = 60 * 15;

export type WeaponId = 'pistol' | 'rail' | 'sniper' | 'rocket' | 'flame';
export const WEAPONS: Record<WeaponId, { name: string; range: number; cooldown: number; damage: number; ammo: ItemId; gun?: ItemId }> = {
  pistol: { name: 'Gun', range: 16, cooldown: 12, damage: 6, ammo: 'owen-ammo' },
  rail: { name: 'Rail gun', range: 34, cooldown: 100, damage: 600, ammo: 'rail-ammo', gun: 'rail-gun' },
  sniper: { name: 'Sniper rifle', range: 32, cooldown: 75, damage: 90, ammo: 'owen-ammo', gun: 'sniper' },
  rocket: { name: 'Rocket launcher', range: 22, cooldown: 60, damage: 140, ammo: 'rocket', gun: 'rocket-launcher' },
  flame: { name: 'Flamethrower', range: 9, cooldown: 5, damage: 6, ammo: 'flame-ammo', gun: 'flamethrower' },
};
/** Shots in one flame ammo. */
export const FLAME_SHOTS = 40;

/** Pollution each working machine gives off per second. */
const POLLUTION: Partial<Record<string, number>> = {
  drill: 0.18, furnace: 0.04, generator: 0.5, assembler: 0.06, lab: 0.02,
};
/** Advanced mode: pollution each working machine gives off per second. */
const ADV_POLLUTION: Partial<Record<string, number>> = {
  'burner-drill': 3, 'electric-drill': 2, 'stone-furnace': 1, 'steel-furnace': 0.8, 'electric-furnace': 0.6,
  generator: 5, 'steam-engine': 3, crafter: 0.6, refinery: 2, pumpjack: 1, 'big-lab': 0.2, 'rocket-silo': 1,
};
const pollutes = (g: Game, e: Entity) => (g.advanced ? ADV_POLLUTION[e.type] : POLLUTION[e.def.kind]) ?? 0;

export function newCombatState() {
  return {
    bugs: [] as Bug[],
    nests: [] as Nest[],
    fx: [] as Fx[],
    pollution: new Float32Array(CELLS * CELLS),
    /** advanced mode's pollution */
    apol: new Float32Array(AN * AN),
    absorb: null as Float32Array | null,
    raidAt: 0,
    raidNest: 0,
    /** the weapon you picked with X */
    weapon: null as WeaponId | null,
    flameShots: 0,
    /** the magazine in your gun is red bullets */
    pierce: false,
    evolution: 0,
    nextBug: 1,
    playerHp: PLAYER_HP,
    lastHurt: 0,
    gunCd: 0,
    lastWave: -1e9,
    reload: 0,
    shootStop: 0,
    muzzle: 0,
    aimAngle: Math.PI / 2,
    railShots: 0,
    /** grenades in the air */
    grenades: [] as { x: number; y: number; t: number; r?: number; dmg?: number }[],
    /** the helper drone, when you carry one */
    drone: null as null | { x: number; y: number; cd: number; angle: number },
  };
}
export type CombatState = ReturnType<typeof newCombatState>;

export function spawnNests(g: Game, clusters = Math.round((14 * WORLD * WORLD) / (256 * 256))) {
  const w = g.world;
  const c = WORLD / 2;
  let id = 1;
  for (let tries = 0; tries < clusters * 40 && clusters > 0; tries++) {
    const x = 8 + Math.floor(w.rand(tries, 77, 3) * (WORLD - 16));
    const y = 8 + Math.floor(w.rand(tries, 78, 3) * (WORLD - 16));
    if (Math.hypot(x - c, y - c) < (g.advanced ? 124 : 62)) continue;
    const n = 2 + Math.floor(w.rand(tries, 79, 3) * 3);
    let placed = 0;
    for (let k = 0; k < n * 4 && placed < n; k++) {
      const nx = x + Math.round((w.rand(tries, k, 5) - 0.5) * 10);
      const ny = y + Math.round((w.rand(tries, k, 6) - 0.5) * 10);
      if (!clearFor(g, nx, ny)) continue;
      g.cs.nests.push({ id: id++, x: nx + 0.5, y: ny + 0.5, hp: NEST_HP, anger: 0, spawnCd: 0, pulse: w.rand(nx, ny, 7) * 6 });
      placed++;
    }
    if (placed) clusters--;
  }
}

function clearFor(g: Game, x: number, y: number) {
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const tx = x + i, ty = y + j;
      if (!g.world.inside(tx, ty) || g.world.ground[ty * WORLD + tx] === 4) return false;
    }
  for (const n of g.cs.nests) if (Math.hypot(n.x - x - 0.5, n.y - y - 0.5) < 3.2) return false;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) g.world.tree[(y + j) * WORLD + x + i] = 0;
  return true;
}

export function nestBlocks(g: Game, x: number, y: number, w: number, h: number) {
  for (const n of g.cs.nests) {
    if (n.x + NEST_R > x && n.x - NEST_R < x + w && n.y + NEST_R > y && n.y - NEST_R < y + h) return true;
  }
  return false;
}

export function spawnBug(g: Game, x: number, y: number, kind: number, nest: number, mode: Bug['mode'], tx = x, ty = y): Bug {
  const cs = g.cs;
  const b: Bug = {
    id: cs.nextBug++, x, y, kind, hp: BUG_KINDS[kind].hp,
    name: BUG_NAMES[Math.floor(Math.random() * BUG_NAMES.length)],
    mode, tx, ty, nest, cd: 0, angle: Math.random() * 6.28, anim: Math.random() * 10, stuck: 0,
  };
  cs.bugs.push(b);
  return b;
}

function pickKind(evo: number): number {
  const r = Math.random();
  if (evo > 0.55 && r < (evo - 0.5) * 0.8) return 2;
  if (evo > 0.2 && r < (evo - 0.15) * 1.3) return 1;
  return 0;
}

function damageEntity(g: Game, e: Entity, dmg: number) {
  e.hp -= dmg;
  if (e.hp <= 0) {
    g.cs.fx.push({ kind: 'boom', x0: e.cx, y0: e.cy, x1: e.cx, y1: e.cy, t: 30, life: 30 });
    addGhost(g, e);
    g.remove(e);
    g.events.push('destroyed');
    g.toast(`A ${ENTITIES[e.type].item.replace(/-/g, ' ')} was destroyed!`, 3);
  }
}

export function damageBug(g: Game, b: Bug, dmg: number) {
  b.hp -= dmg;
  if (b.mode === 'idle') b.mode = 'chase';
  if (b.hp <= 0) killBug(g, b);
}

function killBug(g: Game, b: Bug) {
  const i = g.cs.bugs.indexOf(b);
  if (i >= 0) g.cs.bugs.splice(i, 1);
  g.cs.fx.push({ kind: 'splat', x0: b.x, y0: b.y, x1: b.x, y1: b.y, t: 240, life: 240, color: BUG_KINDS[b.kind].color });
  g.kills++;
}

export function damageNest(g: Game, n: Nest, dmg: number) {
  n.hp -= dmg;
  // advanced mode: raiding a nest is the only thing that makes the bugs come sooner
  if (g.advanced && g.enemies && !g.cs.raidAt) {
    g.cs.raidAt = g.tick + RAID_DELAY;
    g.cs.raidNest = n.id;
  }
  // the nest calls for help
  for (const b of g.cs.bugs) if (b.nest === n.id && b.mode === 'idle') b.mode = 'chase';
  if (n.hp <= 0) {
    const i = g.cs.nests.indexOf(n);
    if (i >= 0) g.cs.nests.splice(i, 1);
    g.cs.fx.push({ kind: 'boom', x0: n.x, y0: n.y, x1: n.x, y1: n.y, t: 40, life: 40 });
    g.cs.fx.push({ kind: 'splat', x0: n.x, y0: n.y, x1: n.x, y1: n.y, t: 600, life: 600, color: '#6a2c9a' });
    g.cs.evolution = Math.min(1, g.cs.evolution + 0.003);
    g.nestsDestroyed++;
    g.toast('Bug nest destroyed!', 3);
    g.events.push('nest');
  }
}

type Target = { x: number; y: number; bug?: Bug; nest?: Nest };

function nearestTarget(g: Game, x: number, y: number, range: number, nests = true): Target | null {
  let best: Target | null = null, bd = range;
  for (const b of g.cs.bugs) {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bd) {
      bd = d;
      best = { x: b.x, y: b.y, bug: b };
    }
  }
  if (nests && !best)
    for (const n of g.cs.nests) {
      const d = Math.hypot(n.x - x, n.y - y) - NEST_R;
      if (d < bd) {
        bd = d;
        best = { x: n.x, y: n.y, nest: n };
      }
    }
  return best;
}

/** A piercing rail shot: hits every bug and nest along the line. */
function railShot(g: Game, x: number, y: number, tx: number, ty: number, range: number, dmg: number) {
  const a = Math.atan2(ty - y, tx - x);
  const ex = x + Math.cos(a) * range, ey = y + Math.sin(a) * range;
  const near = (px: number, py: number, r: number) => {
    const vx = ex - x, vy = ey - y;
    const t = Math.max(0, Math.min(1, ((px - x) * vx + (py - y) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x + vx * t - px, y + vy * t - py) < r;
  };
  for (const b of [...g.cs.bugs]) if (near(b.x, b.y, 0.6 + BUG_KINDS[b.kind].size * 0.5)) damageBug(g, b, dmg);
  for (const n of [...g.cs.nests]) if (near(n.x, n.y, NEST_R)) damageNest(g, n, dmg);
  g.cs.fx.push({ kind: 'rail', x0: x, y0: y, x1: ex, y1: ey, t: 26, life: 26 });
  g.events.push('rail');
}

function shoot(g: Game, x: number, y: number, t: Target, dmg: number) {
  if (t.bug) damageBug(g, t.bug, dmg);
  else if (t.nest) damageNest(g, t.nest, dmg);
  const jx = (Math.random() - 0.5) * 0.4, jy = (Math.random() - 0.5) * 0.4;
  g.cs.fx.push({ kind: 'bullet', x0: x, y0: y, x1: t.x + jx, y1: t.y + jy, t: 4, life: 4 });
}

// ---------- player guns ----------

const hasBullets = (g: Game) => g.inv.count('owen-ammo') > 0 || g.inv.count('piercing-ammo') > 0 || g.pistolRounds > 0 || g.cs.reload > 0;

/** Weapons you could fire right now. */
export function readyWeapons(g: Game): WeaponId[] {
  const out: WeaponId[] = [];
  const has = (it: ItemId) => g.inv.count(it) > 0;
  if (has('rail-gun') && has('rail-ammo')) out.push('rail');
  if (has('rocket-launcher') && has('rocket')) out.push('rocket');
  if (has('flamethrower') && (has('flame-ammo') || g.cs.flameShots > 0)) out.push('flame');
  if (has('sniper') && hasBullets(g)) out.push('sniper');
  if (hasBullets(g)) out.push('pistol');
  return out;
}

export function playerWeapon(g: Game): WeaponId | null {
  const ready = readyWeapons(g);
  if (g.cs.weapon && ready.includes(g.cs.weapon)) return g.cs.weapon;
  return ready.find((w) => w === 'rail' || w === 'pistol') ?? ready[0] ?? null;
}

/** X: switch to the next weapon you can fire. */
export function cycleWeapon(g: Game): WeaponId | null {
  const ready = readyWeapons(g);
  if (!ready.length) return null;
  const cur = playerWeapon(g);
  g.cs.weapon = ready[(ready.indexOf(cur!) + 1) % ready.length];
  return g.cs.weapon;
}

/** A cone of fire: burns every bug and nest in front. */
function flameShot(g: Game, x: number, y: number, tx: number, ty: number, dmg: number) {
  const a = Math.atan2(ty - y, tx - x);
  const R = WEAPONS.flame.range;
  const inCone = (px: number, py: number, pad: number) => {
    const d = Math.hypot(px - x, py - y);
    if (d > R + pad) return false;
    let da = Math.abs(Math.atan2(py - y, px - x) - a);
    if (da > Math.PI) da = Math.PI * 2 - da;
    return da < 0.4 || d < 1 + pad;
  };
  for (const b of [...g.cs.bugs]) if (inCone(b.x, b.y, 0.3)) damageBug(g, b, dmg);
  for (const n of [...g.cs.nests]) if (inCone(n.x, n.y, NEST_R)) damageNest(g, n, dmg);
  g.cs.fx.push({ kind: 'flame', x0: x, y0: y - 0.1, x1: x + Math.cos(a) * R, y1: y + Math.sin(a) * R, t: 14, life: 14 });
}

/** Fires a weapon from (x, y) at the nearest target (or at `aim`). Returns false if nothing to shoot. */
export function playerFireFrom(g: Game, x: number, y: number, wk: WeaponId | 'grenade', aim?: { x: number; y: number }, pierce = false): boolean {
  if (wk === 'grenade') {
    if (aim) throwGrenade(g, x, y, aim.x, aim.y);
    return !!aim;
  }
  const wpn = WEAPONS[wk];
  if (!wpn) return false;
  let t = nearestTarget(g, aim?.x ?? x, aim?.y ?? y, aim ? 4 : wpn.range);
  if (t && Math.hypot(t.x - x, t.y - y) > wpn.range + NEST_R) t = null;
  if (!t && !aim) return false;
  if (!t && aim) t = { x: aim.x, y: aim.y };
  if (wk === 'rail') railShot(g, x, y - 0.1, t!.x, t!.y, wpn.range, wpn.damage * railMult(g));
  else if (wk === 'rocket') {
    const d = Math.hypot(t!.x - x, t!.y - y);
    const flight = Math.max(6, Math.round(d * 1.6));
    g.cs.grenades.push({ x: t!.x, y: t!.y, t: flight, r: 2.6, dmg: wpn.damage });
    g.cs.fx.push({ kind: 'rocket', x0: x, y0: y - 0.2, x1: t!.x, y1: t!.y, t: flight, life: flight });
  } else if (wk === 'flame') flameShot(g, x, y, t!.x, t!.y, wpn.damage * damageMult(g));
  else {
    const dmg = wpn.damage * damageMult(g) * (pierce ? 2 : 1);
    if (t!.bug || t!.nest) shoot(g, x, y - 0.1, t!, dmg);
    else g.cs.fx.push({ kind: 'bullet', x0: x, y0: y - 0.1, x1: t!.x, y1: t!.y, t: 4, life: 4 });
    g.events.push('shot');
  }
  return true;
}

export function playerFire(g: Game, aim?: { x: number; y: number }) {
  const cs = g.cs;
  if (cs.gunCd > 0) return;
  const wk = playerWeapon(g);
  if (!wk) {
    if (g.tick % 90 === 0) g.toast('No ammo! Craft Owen bullets (E, Military tab)');
    return;
  }
  const wpn = WEAPONS[wk];
  // only spend ammo when there is something to hit
  let t = nearestTarget(g, aim?.x ?? g.px, aim?.y ?? g.py, aim ? 4 : wpn.range);
  if (t && Math.hypot(t.x - g.px, t.y - g.py) > wpn.range + NEST_R) t = null;
  if (!t && !aim) return;
  const mags = () => g.inv.count('owen-ammo') + g.inv.count('piercing-ammo');
  if (wk === 'rail') g.inv.remove('rail-ammo', 1);
  else if (wk === 'rocket') g.inv.remove('rocket', 1);
  else if (wk === 'flame') {
    if (cs.flameShots <= 0) {
      if (g.inv.remove('flame-ammo', 1) < 1) return;
      cs.flameShots = FLAME_SHOTS;
    }
    cs.flameShots--;
  } else {
    if (g.pistolRounds <= 0) {
      // empty: put a new magazine in (takes 1.45 s)
      if (cs.reload === 0 && mags() > 0) {
        cs.reload = RELOAD_TICKS;
        g.events.push('reload');
      }
      return;
    }
    g.pistolRounds--;
    if (g.pistolRounds === 0 && mags() > 0) {
      cs.reload = RELOAD_TICKS;
      g.events.push('reload');
    }
  }
  if (g.pmoving) cs.shootStop = SHOOT_STOP_TICKS;
  cs.muzzle = 5;
  if (g.onFire) {
    g.onFire(wk, aim);
    const tx = t?.x ?? aim!.x, ty = t?.y ?? aim!.y;
    if (wk === 'rail') {
      const a = Math.atan2(ty - g.py, tx - g.px);
      cs.fx.push({ kind: 'rail', x0: g.px, y0: g.py - 0.1, x1: g.px + Math.cos(a) * wpn.range, y1: g.py + Math.sin(a) * wpn.range, t: 26, life: 26 });
      g.events.push('rail');
    } else if (wk === 'flame') {
      cs.fx.push({ kind: 'flame', x0: g.px, y0: g.py - 0.1, x1: tx, y1: ty, t: 14, life: 14 });
    } else if (wk === 'rocket') {
      cs.fx.push({ kind: 'rocket', x0: g.px, y0: g.py - 0.2, x1: tx, y1: ty, t: 20, life: 20 });
    } else {
      cs.fx.push({ kind: 'bullet', x0: g.px, y0: g.py - 0.1, x1: tx, y1: ty, t: 4, life: 4 });
      g.events.push('shot');
    }
  } else playerFireFrom(g, g.px, g.py, wk, aim, cs.pierce);
  if (wk === 'flame') g.events.push('flame');
  if (wk === 'rocket') g.events.push('rocket');
  cs.gunCd = Math.round(wpn.cooldown / fireRate(g));
  const tx = t?.x ?? aim?.x, ty = t?.y ?? aim?.y;
  if (tx !== undefined && ty !== undefined) {
    cs.aimAngle = Math.atan2(ty - g.py, tx - g.px);
    g.pdir = Math.abs(tx - g.px) > Math.abs(ty - g.py) ? (tx > g.px ? 1 : 3) : ty > g.py ? 2 : 0;
  }
}

// ---------- the big update ----------

export function updateCombat(g: Game) {
  const cs = g.cs;
  if (cs.gunCd > 0) cs.gunCd--;
  if (cs.shootStop > 0) cs.shootStop--;
  if (cs.muzzle > 0) cs.muzzle--;
  if (cs.reload === 0 && g.pistolRounds === 0 && !g.playerDead && (g.inv.count('owen-ammo') > 0 || g.inv.count('piercing-ammo') > 0)) {
    // an empty gun loads itself as soon as you have bullets
    cs.reload = RELOAD_TICKS;
    g.events.push('reload');
  }
  if (cs.reload > 0) {
    cs.reload--;
    if (cs.reload === 0) {
      // red bullets go in first
      if (g.inv.remove('piercing-ammo', 1) === 1) {
        g.pistolRounds = MAG_SIZE;
        cs.pierce = true;
      } else if (g.inv.remove('owen-ammo', 1) === 1) {
        g.pistolRounds = MAG_SIZE;
        cs.pierce = false;
      }
    }
  }
  // player regenerates after a while
  const heal = healing(g);
  const max = g.maxHp();
  if (g.tick - cs.lastHurt > (heal ? 180 : 600) && cs.playerHp < max) cs.playerHp = Math.min(max, cs.playerHp + (heal ? 1 : 0.25));
  updateGrenades(g);
  for (const f of cs.fx) f.t--;
  if (cs.fx.length) cs.fx = cs.fx.filter((f) => f.t > 0);

  if (g.remote) return;
  updateTurrets(g);
  updateHelpers(g);
  if (!g.enemies) return;

  if (g.advanced) {
    if (g.tick % CYCLE_TICKS === 0) advancedCycle(g);
  } else if (g.tick % 60 === 0) secondly(g);
  for (const b of [...cs.bugs]) updateBug(g, b);
}

/** How much each pollution cell soaks up per cycle: trees soak up a lot, water a little. */
function absorbMap(g: Game): Float32Array {
  const a = new Float32Array(AN * AN);
  const w = g.world;
  for (let cy = 0; cy < AN; cy++)
    for (let cx = 0; cx < AN; cx++) {
      let trees = 0, water = 0;
      for (let j = 0; j < APC; j++)
        for (let i = 0; i < APC; i++) {
          const t = (cy * APC + j) * WORLD + cx * APC + i;
          if (w.tree[t]) trees++;
          if (w.ground[t] === 4) water++;
        }
      a[cy * AN + cx] = 0.012 + trees * 0.004 - water * 0.0004;
    }
  return a;
}

/**
 * Advanced mode, every 2 seconds: machines pollute, pollution spreads one cell (4 tiles) further,
 * and nests it reaches get angry. Bugs only attack when your pollution reaches their nest, at most
 * once every 3 minutes, unless you raid them.
 */
function advancedCycle(g: Game) {
  const cs = g.cs;
  const p = cs.apol;
  const secs = CYCLE_TICKS / 60;
  if (!cs.absorb || g.tick % (CYCLE_TICKS * 30) === 0) cs.absorb = absorbMap(g);
  const ab = cs.absorb;
  for (const e of g.ents.values()) {
    if (!e.working) continue;
    const k = pollutes(g, e);
    if (k) p[Math.floor(e.cy / APC) * AN + Math.floor(e.cx / APC)] += k * secs;
  }
  const next = new Float32Array(p.length);
  for (let y = 0; y < AN; y++)
    for (let x = 0; x < AN; x++) {
      const i = y * AN + x;
      const v = p[i];
      if (v <= 0) continue;
      let kept = v;
      if (v > POLLUTION_SEEN) {
        const share = v * 0.18;
        if (x > 0) { next[i - 1] += share; kept -= share; }
        if (x < AN - 1) { next[i + 1] += share; kept -= share; }
        if (y > 0) { next[i - AN] += share; kept -= share; }
        if (y < AN - 1) { next[i + AN] += share; kept -= share; }
      }
      next[i] += kept;
    }
  for (let i = 0; i < next.length; i++) next[i] = Math.max(0, next[i] * 0.997 - ab[i]);
  p.set(next);
  cs.evolution = Math.min(1, cs.evolution + secs / (60 * 60 * 4));

  for (const n of cs.nests) {
    const i = Math.floor(n.y / APC) * AN + Math.floor(n.x / APC);
    if (p[i] > NEST_SMELLS) {
      const take = Math.min(p[i], 3);
      p[i] -= take;
      n.anger += take;
      cs.evolution = Math.min(1, cs.evolution + take * 0.00002);
    }
    n.spawnCd -= secs;
    const guards = cs.bugs.filter((b) => b.nest === n.id && b.mode === 'idle').length;
    if (n.spawnCd <= 0 && guards < 3 && cs.bugs.length < 220) {
      spawnBug(g, n.x + (Math.random() - 0.5) * 3, n.y + 1.6, pickKind(cs.evolution), n.id, 'idle');
      n.spawnCd = 25;
    }
    if (n.anger >= ANGER_PER_WAVE * 2) {
      if (g.tick > GRACE_TICKS && g.tick - cs.lastWave >= WAVE_GAP_TICKS) {
        n.anger = 0;
        if (sendAttack(g, n)) cs.lastWave = g.tick;
      } else n.anger = ANGER_PER_WAVE * 2;
    }
  }
  // a raided nest answers back
  if (cs.raidAt && g.tick >= cs.raidAt) {
    const n = cs.nests.find((q) => q.id === cs.raidNest) ?? nearestNest(g, g.px, g.py);
    cs.raidAt = 0;
    if (n && g.tick - cs.lastWave >= RAID_GAP_TICKS && sendAttack(g, n, true)) cs.lastWave = g.tick;
  }
}

function nearestNest(g: Game, x: number, y: number): Nest | null {
  let best: Nest | null = null, bd = 1e9;
  for (const n of g.cs.nests) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

/** Saves only the polluted cells: [cell, amount ×100, …]. */
export function packPollution(p: Float32Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < p.length; i++) if (p[i] > 0.02) out.push(i, Math.round(p[i] * 100));
  return out;
}

export function unpackPollution(d: number[], into: Float32Array) {
  if (!Array.isArray(d)) return;
  for (let k = 0; k + 1 < d.length; k += 2) if (d[k] < into.length) into[d[k]] = d[k + 1] / 100;
}

function secondly(g: Game) {
  const cs = g.cs;
  const p = cs.pollution;
  for (const e of g.ents.values()) {
    if (!e.working) continue;
    const k = POLLUTION[e.def.kind];
    if (k) p[Math.floor(e.cy / CELL) * CELLS + Math.floor(e.cx / CELL)] += k;
  }
  // spread and fade
  const next = new Float32Array(p.length);
  for (let y = 0; y < CELLS; y++)
    for (let x = 0; x < CELLS; x++) {
      const i = y * CELLS + x;
      const v = p[i] * 0.995;
      const share = v * 0.02;
      let kept = v;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CELLS || ny >= CELLS) continue;
        next[ny * CELLS + nx] += share;
        kept -= share;
      }
      next[i] += kept;
    }
  p.set(next);
  cs.evolution = Math.min(1, cs.evolution + 1 / (60 * 60 * 3)); // slowly, over hours

  for (const n of cs.nests) {
    const i = Math.floor(n.y / CELL) * CELLS + Math.floor(n.x / CELL);
    const take = Math.min(p[i], 1.5);
    p[i] -= take;
    n.anger += take;
    cs.evolution = Math.min(1, cs.evolution + take * 0.00004);
    // keep a few guards around home
    n.spawnCd--;
    const guards = cs.bugs.filter((b) => b.nest === n.id && b.mode === 'idle').length;
    if (n.spawnCd <= 0 && guards < 3 && cs.bugs.length < 220) {
      spawnBug(g, n.x + (Math.random() - 0.5) * 3, n.y + 1.6, pickKind(cs.evolution), n.id, 'idle');
      n.spawnCd = 25;
    }
    if (n.anger >= ANGER_PER_WAVE) {
      if (g.tick > GRACE_TICKS && g.tick - cs.lastWave >= WAVE_GAP_TICKS) {
        n.anger -= ANGER_PER_WAVE;
        if (sendAttack(g, n)) cs.lastWave = g.tick;
      } else n.anger = ANGER_PER_WAVE; // don't store up waves while waiting
    }
  }
}

function sendAttack(g: Game, n: Nest, raid = false): boolean {
  // go for the dirtiest machine within reach (advanced: anywhere your pollution came from)
  let best: Entity | null = null, bd = g.advanced ? 1e9 : 150;
  for (const e of g.ents.values()) {
    if (!pollutes(g, e) || (!e.working && !raid)) continue;
    const d = Math.hypot(e.cx - n.x, e.cy - n.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  const tx = best ? best.cx : g.px, ty = best ? best.cy : g.py;
  if (!best && !raid) return false;
  const size = Math.min(14, 2 + Math.round(g.cs.evolution * 10 + Math.random() * 3));
  for (let i = 0; i < size; i++) {
    spawnBug(g, n.x + (Math.random() - 0.5) * 3, n.y + (Math.random() - 0.5) * 3, pickKind(g.cs.evolution), n.id, 'attack', tx, ty);
  }
  g.events.push('attack');
  g.toast(raid ? 'You raided their nest: the bugs are coming for you!' : 'The bugs are coming!', 4);
  return true;
}

function updateBug(g: Game, b: Bug) {
  const k = BUG_KINDS[b.kind];
  const cs = g.cs;
  b.anim += 1;
  if (b.cd > 0) b.cd--;
  // the closest living player, local or remote
  let px = g.px, py = g.py, who = '';
  let pd = g.playerDead ? 1e9 : Math.hypot(g.px - b.x, g.py - b.y);
  for (const [id, o] of g.others) {
    if (o.dead) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d < pd) {
      pd = d;
      px = o.x;
      py = o.y;
      who = id;
    }
  }
  if (Math.abs(px - b.x) <= AGGRO_HALF && Math.abs(py - b.y) <= AGGRO_HALF) b.mode = 'chase';

  let tx = b.tx, ty = b.ty;
  if (b.mode === 'chase') {
    if (pd > AGGRO_HALF * 3) {
      b.mode = b.nest && cs.nests.some((n) => n.id === b.nest) ? 'idle' : 'attack';
      const n = cs.nests.find((q) => q.id === b.nest);
      if (n) {
        b.tx = n.x;
        b.ty = n.y;
      }
      return;
    }
    tx = px;
    ty = py;
    if (pd < 0.7 + k.size * 0.5) {
      if (b.cd <= 0) {
        b.cd = g.advanced ? 60 : 40;
        cs.fx.push({ kind: 'bite', x0: px, y0: py, x1: px, y1: py, t: 10, life: 10 });
        if (who) g.hurtOthers.push([who, k.damage, b.name]);
        else hurtPlayer(g, k.damage, b.name);
      }
      b.angle = Math.atan2(py - b.y, px - b.x);
      return;
    }
  } else if (b.mode === 'idle') {
    // wander around the nest
    if (Math.random() < 0.01 || Math.hypot(b.tx - b.x, b.ty - b.y) < 0.3) {
      const n = cs.nests.find((q) => q.id === b.nest);
      const cx = n ? n.x : b.x, cy = n ? n.y : b.y;
      b.tx = cx + (Math.random() - 0.5) * 8;
      b.ty = cy + (Math.random() - 0.5) * 8;
    }
    tx = b.tx;
    ty = b.ty;
  } else {
    // attacking: when near the target, chew on whatever is closest
    if (Math.hypot(tx - b.x, ty - b.y) < 2.5) {
      let best: Entity | null = null, bd = 10;
      for (const e of g.ents.values()) {
        if (e.def.kind === 'floor' || e.def.kind === 'mine') continue;
        const d = Math.hypot(e.cx - b.x, e.cy - b.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        b.tx = best.cx;
        b.ty = best.cy;
        tx = b.tx;
        ty = b.ty;
        // close enough to the building's edge: bite it
        const ex = Math.max(best.x, Math.min(b.x, best.x + best.w));
        const ey = Math.max(best.y, Math.min(b.y, best.y + best.h));
        if (Math.hypot(ex - b.x, ey - b.y) < 0.35 + k.size * 0.5) {
          if (b.cd <= 0) {
            damageEntity(g, best, k.damage);
            b.cd = g.advanced ? 60 : 40;
            cs.fx.push({ kind: 'bite', x0: ex, y0: ey, x1: ex, y1: ey, t: 10, life: 10 });
          }
          b.angle = Math.atan2(best.cy - b.y, best.cx - b.x);
          return;
        }
      } else {
        b.mode = 'idle';
        return;
      }
    }
  }

  const a = Math.atan2(ty - b.y, tx - b.x);
  const speed = (k.speed * (b.mode === 'idle' ? 0.4 : 1)) / 60;
  for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const aa = a + off * (b.id % 2 ? 1 : -1);
    const nx = b.x + Math.cos(aa) * speed, ny = b.y + Math.sin(aa) * speed;
    const tx2 = Math.floor(nx + Math.cos(aa) * k.size * 0.5), ty2 = Math.floor(ny + Math.sin(aa) * k.size * 0.5);
    if (!g.world.inside(tx2, ty2)) continue;
    const e = g.entAt(tx2, ty2);
    if (e && !passable(e) && b.mode !== 'idle') {
      // something in the way: bite it
      if (b.cd <= 0) {
        damageEntity(g, e, k.damage);
        b.cd = g.advanced ? 60 : 40;
        cs.fx.push({ kind: 'bite', x0: nx, y0: ny, x1: nx, y1: ny, t: 10, life: 10 });
      }
      b.angle = aa;
      return;
    }
    if (e && !passable(e)) continue;
    const i = ty2 * WORLD + tx2;
    if (g.world.ground[i] === 4 || g.world.tree[i]) continue;
    b.x = nx;
    b.y = ny;
    b.angle = aa;
    return;
  }
  b.stuck++;
}

function updateTurrets(g: Game) {
  for (const e of g.ents.values()) {
    if (e.def.kind !== 'turret') continue;
    const d = e.def;
    if (e.anim > 0) e.anim--; // reuse as cooldown
    const ammo = d.ammo!;
    const rail = e.type === 'rail-turret';
    if (rail) {
      // charge from the grid
      if (e.progress < 1) e.progress = Math.min(1, e.progress + (e.sat * d.fireRate!) / 60);
      e.working = e.progress < 1 && e.sat > 0;
    }
    const pierceIn = !rail && ammo === 'owen-ammo' ? e.input['piercing-ammo'] ?? 0 : 0;
    const have = (e.input[ammo] ?? 0) + pierceIn + (rail ? 0 : e.burn);
    if (have <= 0) {
      e.status = 'Out of ammo';
      continue;
    }
    if (rail && e.net < 0) {
      e.status = 'Not connected to power';
      continue;
    }
    e.status = rail ? (e.progress < 1 ? `Charging ${Math.round(e.progress * 100)}%` : 'Ready') : 'Ready';
    if (e.anim > 0 || g.tick % 4 !== e.id % 4) continue;
    if (rail && e.progress < 1) continue;
    const t = nearestTarget(g, e.cx, e.cy, d.range! * turretRange(g));
    if (!t) continue;
    e.t = Math.atan2(t.y - e.cy, t.x - e.cx); // head angle
    if (rail) {
      e.input[ammo]! -= 1;
      if (!e.input[ammo]) delete e.input[ammo];
      e.progress = 0;
      railShot(g, e.cx, e.cy - 0.3, t.x, t.y, d.range! * turretRange(g), d.damage! * railMult(g));
    } else {
      if (e.burn <= 0) {
        // red bullets first; e.cursor remembers which kind is loaded
        const use: ItemId = pierceIn > 0 ? 'piercing-ammo' : ammo;
        e.input[use]! -= 1;
        if (!e.input[use]) delete e.input[use];
        e.burn = 10; // rounds in the loaded magazine
        e.cursor = use === 'piercing-ammo' ? 1 : 0;
      }
      e.burn--;
      shoot(g, e.cx, e.cy - 0.3, t, d.damage! * damageMult(g) * (e.cursor === 1 ? 2 : 1));
      e.anim = Math.round(60 / d.fireRate! / fireRate(g));
      e.status = 'Firing';
      g.events.push('turret');
    }
  }
}

export function healthFrac(e: Entity) {
  return e.hp / maxHp(e.type);
}

export function damageMult(g: Game) {
  return bulletMult(g);
}

/** Bugs walk over belts, paths, splitters and mines. */
function passable(e: Entity) {
  const k = e.def.kind;
  return k === 'belt' || k === 'floor' || k === 'splitter' || k === 'mine';
}

/** Damage to the local player, after the energy shield and armor. */
export function hurtPlayer(g: Game, dmg: number, by: string) {
  const cs = g.cs;
  cs.playerHp -= absorb(g, dmg);
  cs.lastHurt = g.tick;
  g.events.push('hurt');
  if (cs.playerHp <= 0) g.killPlayer(by);
}

export const GRENADE_RADIUS = 3.2;
const GRENADE_DAMAGE = 90;
const GRENADE_FLIGHT = 36;

export function throwGrenade(g: Game, x: number, y: number, tx: number, ty: number) {
  // can't throw farther than 14 tiles
  const d = Math.hypot(tx - x, ty - y);
  if (d > 14) {
    tx = x + ((tx - x) / d) * 14;
    ty = y + ((ty - y) / d) * 14;
  }
  g.cs.grenades.push({ x: tx, y: ty, t: GRENADE_FLIGHT });
  g.cs.fx.push({ kind: 'grenade', x0: x, y0: y - 0.2, x1: tx, y1: ty, t: GRENADE_FLIGHT, life: GRENADE_FLIGHT });
}

function explode(g: Game, x: number, y: number, r: number, dmg: number) {
  g.cs.fx.push({ kind: 'boom', x0: x, y0: y, x1: x, y1: y, t: 30, life: 30 });
  g.events.push('destroyed');
  if (g.remote) return;
  for (const b of [...g.cs.bugs]) if (Math.hypot(b.x - x, b.y - y) < r) damageBug(g, b, dmg);
  for (const n of [...g.cs.nests]) if (Math.hypot(n.x - x, n.y - y) < r + NEST_R) damageNest(g, n, dmg);
}

function updateGrenades(g: Game) {
  const cs = g.cs;
  if (!cs.grenades.length) return;
  for (const gr of cs.grenades) if (--gr.t <= 0) explode(g, gr.x, gr.y, gr.r ?? GRENADE_RADIUS, gr.dmg ?? GRENADE_DAMAGE);
  cs.grenades = cs.grenades.filter((gr) => gr.t > 0);
}

/** Land mines, personal lasers and the helper drone. */
function updateHelpers(g: Game) {
  const cs = g.cs;
  // land mines go off when a bug steps close
  if (g.tick % 6 === 0 && cs.bugs.length) {
    for (const e of [...g.ents.values()]) {
      if (e.def.kind !== 'mine') continue;
      if (cs.bugs.some((b) => Math.abs(b.x - e.cx) < 1 && Math.abs(b.y - e.cy) < 1)) {
        g.remove(e);
        explode(g, e.cx, e.cy, 3, 150);
      }
    }
  }
  if (g.playerDead) return;
  // personal lasers
  const n = lasersReady(g);
  if (n > 0) {
    const t = nearestTarget(g, g.px, g.py, LASER_RANGE, false);
    if (t?.bug) {
      for (let i = 0; i < n; i++) g.suit.energy -= LASER_SHOT_J;
      damageBug(g, t.bug, LASER_DAMAGE * n);
      cs.fx.push({ kind: 'laser', x0: g.px, y0: g.py - 0.5, x1: t.x, y1: t.y, t: 8, life: 8 });
      g.suit.laserCd = 30;
      g.events.push('laser');
    }
  }
  // the helper drone floats next to you and shoots bugs
  if (g.inv.count('helper-drone') > 0) {
    if (!cs.drone) cs.drone = { x: g.px, y: g.py, cd: 0, angle: 0 };
    const dr = cs.drone;
    dr.angle += 0.03;
    const hx = g.px + Math.cos(dr.angle) * 1.3, hy = g.py - 0.8 + Math.sin(dr.angle) * 0.5;
    dr.x += (hx - dr.x) * 0.12;
    dr.y += (hy - dr.y) * 0.12;
    if (dr.cd > 0) dr.cd--;
    else {
      const t = nearestTarget(g, dr.x, dr.y, 11, false);
      if (t?.bug) {
        shoot(g, dr.x, dr.y, t, 7);
        dr.cd = 18;
        g.events.push('turret');
      }
    }
  } else cs.drone = null;
}
