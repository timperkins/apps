// Bugs, their nests, pollution, turrets and the player's guns.
import { ENTITIES, maxHp, type ItemId } from './data';
import type { Entity, Game } from './sim';
import { WORLD } from './world';

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
  kind: 'bullet' | 'rail' | 'splat' | 'boom' | 'bite';
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
const GRACE_TICKS = 60 * 60 * 6; // six quiet minutes before the first attack
const CELL = 32;
const CELLS = WORLD / CELL;

export const WEAPONS = {
  pistol: { name: 'Gun', range: 16, cooldown: 12, damage: 6, ammo: 'owen-ammo' as ItemId },
  rail: { name: 'Rail gun', range: 34, cooldown: 100, damage: 600, ammo: 'rail-ammo' as ItemId },
};

/** Pollution each working machine gives off per second. */
const POLLUTION: Partial<Record<string, number>> = {
  drill: 0.18, furnace: 0.04, generator: 0.5, assembler: 0.06, lab: 0.02,
};

export function newCombatState() {
  return {
    bugs: [] as Bug[],
    nests: [] as Nest[],
    fx: [] as Fx[],
    pollution: new Float32Array(CELLS * CELLS),
    evolution: 0,
    nextBug: 1,
    playerHp: PLAYER_HP,
    lastHurt: 0,
    gunCd: 0,
    reload: 0,
    shootStop: 0,
    muzzle: 0,
    aimAngle: Math.PI / 2,
    railShots: 0,
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
    if (Math.hypot(x - c, y - c) < 62) continue;
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

export function playerWeapon(g: Game): keyof typeof WEAPONS | null {
  if (g.inv.count('rail-gun') > 0 && g.inv.count('rail-ammo') > 0) return 'rail';
  if (g.inv.count('owen-ammo') > 0 || g.pistolRounds > 0 || g.cs.reload > 0) return 'pistol';
  return null;
}

/** Fires a weapon from (x, y) at the nearest target (or at `aim`). Returns false if nothing to shoot. */
export function playerFireFrom(g: Game, x: number, y: number, wk: keyof typeof WEAPONS, aim?: { x: number; y: number }): boolean {
  const wpn = WEAPONS[wk];
  if (!wpn) return false;
  let t = nearestTarget(g, aim?.x ?? x, aim?.y ?? y, aim ? 4 : wpn.range);
  if (t && Math.hypot(t.x - x, t.y - y) > wpn.range + NEST_R) t = null;
  if (!t && !aim) return false;
  if (!t && aim) t = { x: aim.x, y: aim.y };
  if (wk === 'rail') railShot(g, x, y - 0.1, t!.x, t!.y, wpn.range, wpn.damage);
  else {
    if (t!.bug || t!.nest) shoot(g, x, y - 0.1, t!, wpn.damage * damageMult(g));
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
  if (wk === 'rail') g.inv.remove('rail-ammo', 1);
  else {
    if (g.pistolRounds <= 0) {
      // empty: put a new magazine in (takes 1.45 s)
      if (cs.reload === 0 && g.inv.count('owen-ammo') > 0) {
        cs.reload = RELOAD_TICKS;
        g.events.push('reload');
      }
      return;
    }
    g.pistolRounds--;
    if (g.pistolRounds === 0 && g.inv.count('owen-ammo') > 0) {
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
    } else {
      cs.fx.push({ kind: 'bullet', x0: g.px, y0: g.py - 0.1, x1: tx, y1: ty, t: 4, life: 4 });
      g.events.push('shot');
    }
  } else playerFireFrom(g, g.px, g.py, wk, aim);
  cs.gunCd = wpn.cooldown;
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
  if (cs.reload === 0 && g.pistolRounds === 0 && !g.playerDead && g.inv.count('owen-ammo') > 0) {
    // an empty gun loads itself as soon as you have bullets
    cs.reload = RELOAD_TICKS;
    g.events.push('reload');
  }
  if (cs.reload > 0) {
    cs.reload--;
    if (cs.reload === 0 && g.inv.remove('owen-ammo', 1) === 1) g.pistolRounds = MAG_SIZE;
  }
  // player regenerates after a while
  if (g.tick - cs.lastHurt > 600 && cs.playerHp < PLAYER_HP) cs.playerHp = Math.min(PLAYER_HP, cs.playerHp + 0.25);
  for (const f of cs.fx) f.t--;
  if (cs.fx.length) cs.fx = cs.fx.filter((f) => f.t > 0);

  if (g.remote) return;
  updateTurrets(g);
  if (!g.enemies) return;

  if (g.tick % 60 === 0) secondly(g);
  for (const b of [...cs.bugs]) updateBug(g, b);
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
    if (n.anger >= 25 && g.tick > GRACE_TICKS) {
      n.anger -= 25;
      sendAttack(g, n);
    }
  }
}

function sendAttack(g: Game, n: Nest) {
  // go for the dirtiest machine within reach
  let best: Entity | null = null, bd = 150;
  for (const e of g.ents.values()) {
    if (!POLLUTION[e.def.kind] || !e.working) continue;
    const d = Math.hypot(e.cx - n.x, e.cy - n.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (!best) return;
  const size = Math.min(14, 2 + Math.round(g.cs.evolution * 10 + Math.random() * 3));
  for (let i = 0; i < size; i++) {
    spawnBug(g, n.x + (Math.random() - 0.5) * 3, n.y + (Math.random() - 0.5) * 3, pickKind(g.cs.evolution), n.id, 'attack', best.cx, best.cy);
  }
  g.events.push('attack');
  g.toast('The bugs are coming!', 4);
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
        b.cd = 40;
        cs.fx.push({ kind: 'bite', x0: px, y0: py, x1: px, y1: py, t: 10, life: 10 });
        if (who) g.hurtOthers.push([who, k.damage, b.name]);
        else {
          cs.playerHp -= k.damage;
          cs.lastHurt = g.tick;
          g.events.push('hurt');
          if (cs.playerHp <= 0) g.killPlayer(b.name);
        }
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
        const ex = Math.max(best.x, Math.min(b.x, best.x + best.def.w));
        const ey = Math.max(best.y, Math.min(b.y, best.y + best.def.h));
        if (Math.hypot(ex - b.x, ey - b.y) < 0.35 + k.size * 0.5) {
          if (b.cd <= 0) {
            damageEntity(g, best, k.damage);
            b.cd = 40;
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
    if (e && e.def.kind !== 'belt' && b.mode !== 'idle') {
      // something in the way: bite it
      if (b.cd <= 0) {
        damageEntity(g, e, k.damage);
        b.cd = 40;
        cs.fx.push({ kind: 'bite', x0: nx, y0: ny, x1: nx, y1: ny, t: 10, life: 10 });
      }
      b.angle = aa;
      return;
    }
    if (e && e.def.kind !== 'belt') continue;
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
    const have = (e.input[ammo] ?? 0) + (rail ? 0 : e.burn);
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
    const t = nearestTarget(g, e.cx, e.cy, d.range!);
    if (!t) continue;
    e.t = Math.atan2(t.y - e.cy, t.x - e.cx); // head angle
    if (rail) {
      e.input[ammo]! -= 1;
      if (!e.input[ammo]) delete e.input[ammo];
      e.progress = 0;
      railShot(g, e.cx, e.cy - 0.3, t.x, t.y, d.range!, d.damage!);
    } else {
      if (e.burn <= 0) {
        e.input[ammo]! -= 1;
        if (!e.input[ammo]) delete e.input[ammo];
        e.burn = 10; // rounds in the loaded magazine
      }
      e.burn--;
      shoot(g, e.cx, e.cy - 0.3, t, d.damage! * damageMult(g));
      e.anim = Math.round(60 / d.fireRate!);
      e.status = 'Firing';
      g.events.push('turret');
    }
  }
}

export function healthFrac(e: Entity) {
  return e.hp / maxHp(e.type);
}

export function damageMult(g: Game) {
  return g.researched.has('weapon-damage') ? 1.5 : 1;
}
