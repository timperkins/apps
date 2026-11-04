import {
  COMBO, ENEMIES, GRAVITY, HALF_VIEW, ITEMS, JUMP_KICK, JUMP_V, KID_HP, KID_SPEED, PICKUP_RANGE, REVIVE_RANGE,
  REVIVE_TIME, SECTIONS, WEAPON_DROPS, Z_MAX, Z_MIN,
  type EnemyKind, type ItemKind, type ProjKind,
} from './config';
import type { Look } from './look';

/**
 * The whole game, with no rendering or networking. The host runs it; everyone else only draws
 * snapshots of it. Inputs carry press counters rather than booleans, so a press is never lost
 * between two network messages.
 */

export interface Input {
  mx: number;
  mz: number;
  attack: number;
  jump: number;
  grab: number;
}

export const NO_INPUT: Input = { mx: 0, mz: 0, attack: 0, jump: 0, grab: 0 };

export type KidState = 'idle' | 'walk' | 'attack' | 'throw' | 'hurt' | 'down';
export type AttackKind = 'punch1' | 'punch2' | 'kick' | 'swing' | 'jumpkick' | 'blast';

export interface Held {
  kind: ItemKind;
  uses: number;
}

export interface Kid {
  id: number;
  look: Look;
  x: number;
  y: number;
  z: number;
  vy: number;
  face: 1 | -1;
  hp: number;
  state: KidState;
  stateT: number;
  stateLen: number;
  attack: AttackKind;
  hitDone: boolean;
  combo: number;
  comboT: number;
  held: Held | null;
  revive: number;
  score: number;
  invuln: number;
  stun: number;
  air: boolean;
  moving: boolean;
  last: { attack: number; jump: number; grab: number };
  input: Input;
}

export type EnemyState = 'walk' | 'windup' | 'attack' | 'throwWind' | 'throw' | 'hurt' | 'down' | 'whistle' | 'enter';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  vx: number;
  face: 1 | -1;
  hp: number;
  maxHp: number;
  state: EnemyState;
  stateT: number;
  stateLen: number;
  throwCd: number;
  meleeCd: number;
  specialCd: number;
  target: number;
  hover: number;
  flash: number;
  speedMul: number;
}

export interface Proj {
  id: number;
  kind: ProjKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fromKid: boolean;
  owner: number;
  dmg: number;
  stun: number;
  pierce: boolean;
  hits: number[];
  ttl: number;
  spin: number;
}

export interface Pickup {
  id: number;
  kind: ItemKind;
  x: number;
  z: number;
  uses: number;
  /** Seconds since it appeared; items dropped by kids can't be picked up instantly by the same kid. */
  age: number;
}

export type Fx =
  | { t: 'hit'; x: number; y: number; z: number; big: boolean; word: string }
  | { t: 'ko'; id: number }
  | { t: 'splat'; x: number; y: number; z: number; kind: ProjKind }
  | { t: 'pickup'; id: number; kind: ItemKind }
  | { t: 'heal'; id: number }
  | { t: 'break'; id: number; kind: ItemKind }
  | { t: 'revive'; id: number }
  | { t: 'down'; id: number }
  | { t: 'say'; id: number; text: string }
  | { t: 'whistle'; id: number }
  | { t: 'swing'; id: number }
  | { t: 'throw'; id: number }
  | { t: 'go' }
  | { t: 'section'; i: number }
  | { t: 'boss' }
  | { t: 'won' }
  | { t: 'lost' };

export type Phase = 'walk' | 'fight' | 'won' | 'lost';

export interface World {
  time: number;
  kids: Kid[];
  enemies: Enemy[];
  projs: Proj[];
  pickups: Pickup[];
  nextId: number;
  section: number;
  phase: Phase;
  wave: number;
  waveDelay: number;
  camX: number;
  bossPhase: number;
  rainT: number;
  events: Fx[];
  rng: () => number;
}

const HIT_WORDS = ['WHAM!', 'BONK!', 'POW!', 'THWACK!', 'BOP!', 'SMACK!', 'KAPOW!'];

export function createWorld(rng: () => number = Math.random): World {
  const w: World = {
    time: 0, kids: [], enemies: [], projs: [], pickups: [], nextId: 1, section: 0, phase: 'walk', wave: 0, waveDelay: 0,
    camX: HALF_VIEW - 1, bossPhase: 0, rainT: 0, events: [], rng,
  };
  for (const s of SECTIONS) for (const p of s.pickups) addPickup(w, p.kind, p.x, p.z);
  return w;
}

export function addKid(w: World, look: Look): Kid {
  const i = w.kids.length;
  const k: Kid = {
    id: w.nextId++, look, x: w.camX - HALF_VIEW + 2 + i * 1.1, y: 0, z: -0.5 + (i % 2) * 1.6, vy: 0, face: 1, hp: KID_HP,
    state: 'idle', stateT: 0, stateLen: 0, attack: 'punch1', hitDone: true, combo: 0, comboT: 9, held: null, revive: 0,
    score: 0, invuln: 1.5, stun: 0, air: false, moving: false, last: { attack: 0, jump: 0, grab: 0 }, input: { ...NO_INPUT },
  };
  w.kids.push(k);
  return k;
}

export function removeKid(w: World, id: number): void {
  const k = w.kids.find((q) => q.id === id);
  if (!k) return;
  if (k.held) dropHeld(w, k);
  w.kids = w.kids.filter((q) => q.id !== id);
  checkLost(w);
}

export function setInput(w: World, id: number, input: Input): void {
  const k = w.kids.find((q) => q.id === id);
  if (k) k.input = input;
}

export function addPickup(w: World, kind: ItemKind, x: number, z: number, uses = ITEMS[kind].uses): Pickup {
  const p: Pickup = { id: w.nextId++, kind, x, z: clamp(z, Z_MIN + 0.3, Z_MAX - 0.3), uses, age: 0 };
  w.pickups.push(p);
  return p;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const alive = (k: Kid) => k.state !== 'down';

function center(i: number): number {
  const s = SECTIONS[i];
  return (s.x0 + s.x1) / 2;
}

// ---------------------------------------------------------------- step

export function step(w: World, dt: number): void {
  w.time += dt;
  if (w.kids.length === 0) return;
  updateCamera(w, dt);
  for (const k of w.kids) stepKid(w, k, dt);
  for (const e of w.enemies) stepEnemy(w, e, dt);
  separateEnemies(w);
  stepProjs(w, dt);
  for (const p of w.pickups) p.age += dt;
  w.enemies = w.enemies.filter((e) => !(e.state === 'down' && e.stateT > 2.2));
  if (w.phase === 'fight') stepWaves(w, dt);
  if (w.kids.some((k) => k.state !== 'down') && w.phase === 'fight') stepBoss(w, dt);
}

function updateCamera(w: World, dt: number): void {
  if (w.phase !== 'walk') return;
  const live = w.kids.filter(alive);
  if (!live.length) return;
  const lead = Math.max(...live.map((k) => k.x));
  const avg = live.reduce((a, k) => a + k.x, 0) / live.length;
  const want = Math.min(center(w.section), Math.max(avg, lead - HALF_VIEW + 2));
  if (want > w.camX) w.camX = Math.min(want, w.camX + 9 * dt);
  if (w.camX >= center(w.section) - 0.01) {
    w.camX = center(w.section);
    w.phase = 'fight';
    w.wave = 0;
    w.waveDelay = 0.6;
    w.events.push({ t: 'section', i: w.section });
  }
}

function stepWaves(w: World, dt: number): void {
  const sec = SECTIONS[w.section];
  const fighting = w.enemies.some((e) => e.state !== 'down');
  if (fighting) return;
  w.waveDelay -= dt;
  if (w.waveDelay > 0) return;
  if (w.wave < sec.waves.length) {
    spawnWave(w, sec.waves[w.wave]);
    w.wave++;
    w.waveDelay = 1.2;
    return;
  }
  // Stretch cleared.
  w.section++;
  if (w.section >= SECTIONS.length) {
    w.phase = 'won';
    w.events.push({ t: 'won' });
  } else {
    w.phase = 'walk';
    w.events.push({ t: 'go' });
  }
}

function spawnWave(w: World, kinds: EnemyKind[]): void {
  const list = [...kinds];
  const extra = Math.max(0, w.kids.length - 1);
  const pool = kinds.filter((k) => k !== 'boss');
  for (let i = 0; i < extra && pool.length; i++) list.push(pool[Math.floor(w.rng() * pool.length)]);
  list.forEach((kind, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = w.camX + side * (HALF_VIEW + 2 + Math.floor(i / 2) * 1.6);
    spawnEnemy(w, kind, x, Z_MIN + 0.6 + w.rng() * (Z_MAX - Z_MIN - 1.2));
  });
  if (kinds.includes('boss')) w.events.push({ t: 'boss' });
}

export function spawnEnemy(w: World, kind: EnemyKind, x: number, z: number): Enemy {
  const def = ENEMIES[kind];
  const hpMul = 1 + 0.35 * Math.max(0, w.kids.length - 1);
  const e: Enemy = {
    id: w.nextId++, kind, x, z, vx: 0, face: x > w.camX ? -1 : 1, hp: def.hp * hpMul, maxHp: def.hp * hpMul, state: 'enter',
    stateT: 0, stateLen: 0, throwCd: 1.5 + w.rng() * 2, meleeCd: 0.5, specialCd: 4, target: 0, hover: (w.rng() - 0.5) * 1.2,
    flash: 0, speedMul: 0.9 + w.rng() * 0.2,
  };
  w.enemies.push(e);
  if (w.rng() < 0.5 || kind === 'boss') w.events.push({ t: 'say', id: e.id, text: def.lines[Math.floor(w.rng() * def.lines.length)] });
  return e;
}

// ---------------------------------------------------------------- kids

function stepKid(w: World, k: Kid, dt: number): void {
  const inp = k.input;
  const pressAttack = inp.attack !== k.last.attack;
  const pressJump = inp.jump !== k.last.jump;
  const pressGrab = inp.grab !== k.last.grab;
  k.last = { attack: inp.attack, jump: inp.jump, grab: inp.grab };
  k.invuln = Math.max(0, k.invuln - dt);
  k.comboT += dt;
  k.stateT += dt;
  k.moving = false;

  if (k.state === 'down') {
    const helper = w.kids.find((o) => o !== k && alive(o) && Math.hypot(o.x - k.x, (o.z - k.z) * 1.4) < REVIVE_RANGE);
    if (helper) {
      k.revive += dt / REVIVE_TIME;
      if (k.revive >= 1) {
        k.state = 'idle';
        k.hp = KID_HP * 0.5;
        k.invuln = 2;
        k.revive = 0;
        w.events.push({ t: 'revive', id: k.id });
      }
    } else {
      k.revive = Math.max(0, k.revive - dt * 0.15);
    }
    gravity(k, dt);
    return;
  }

  if (k.stun > 0) {
    k.stun -= dt;
    gravity(k, dt);
    return;
  }

  if (k.state === 'hurt') {
    if (k.stateT >= k.stateLen) k.state = 'idle';
    gravity(k, dt);
    return;
  }

  if (k.state === 'attack' || k.state === 'throw') {
    if (k.attack === 'jumpkick') {
      if (!k.hitDone) meleeHit(w, k, JUMP_KICK.dmg, JUMP_KICK.reach, JUMP_KICK.knock, 0, 0.8);
      // Keep drifting in the air during a jump kick.
      k.x += inp.mx * KID_SPEED * dt;
      k.z += inp.mz * KID_SPEED * 0.7 * dt;
      if (!k.air) k.state = 'idle';
    } else if (!k.hitDone && k.stateT >= k.stateLen * 0.45) {
      resolveAttack(w, k);
    }
    if (k.state !== 'idle' && k.stateT >= k.stateLen && k.attack !== 'jumpkick') k.state = 'idle';
    gravity(k, dt);
    clampKid(w, k);
    return;
  }

  // Free to act.
  const mag = Math.hypot(inp.mx, inp.mz);
  const mx = mag > 1 ? inp.mx / mag : inp.mx;
  const mz = mag > 1 ? inp.mz / mag : inp.mz;
  if (mag > 0.15) {
    k.x += mx * KID_SPEED * dt;
    k.z += mz * KID_SPEED * 0.72 * dt;
    if (Math.abs(mx) > 0.2) k.face = mx > 0 ? 1 : -1;
    k.moving = true;
  }
  k.state = k.moving ? 'walk' : 'idle';

  if (pressJump && !k.air) {
    k.vy = JUMP_V;
    k.air = true;
  }

  if (pressGrab) {
    if (k.held) throwHeld(w, k);
    else grab(w, k);
  } else if (pressAttack) {
    startAttack(w, k);
  }

  gravity(k, dt);
  clampKid(w, k);
}

function gravity(k: Kid, dt: number): void {
  if (!k.air && k.y <= 0) return;
  k.vy += GRAVITY * dt;
  k.y += k.vy * dt;
  if (k.y <= 0) {
    k.y = 0;
    k.vy = 0;
    k.air = false;
  }
}

function clampKid(w: World, k: Kid): void {
  k.x = clamp(k.x, w.camX - HALF_VIEW, w.camX + HALF_VIEW);
  k.z = clamp(k.z, Z_MIN, Z_MAX);
}

function startAttack(w: World, k: Kid): void {
  k.hitDone = false;
  k.stateT = 0;
  if (k.air) {
    k.state = 'attack';
    k.attack = 'jumpkick';
    k.stateLen = 0.6;
    w.events.push({ t: 'swing', id: k.id });
    return;
  }
  if (k.held) {
    const def = ITEMS[k.held.kind];
    if (def.swing <= 0) {
      throwHeld(w, k);
      return;
    }
    k.state = 'attack';
    k.attack = k.held.kind === 'blower' ? 'blast' : 'swing';
    k.stateLen = def.speed;
    w.events.push({ t: 'swing', id: k.id });
    return;
  }
  k.combo = k.comboT < 0.55 ? (k.combo + 1) % COMBO.length : 0;
  k.comboT = 0;
  k.state = 'attack';
  k.attack = k.combo === 0 ? 'punch1' : k.combo === 1 ? 'punch2' : 'kick';
  k.stateLen = COMBO[k.combo].time;
  w.events.push({ t: 'swing', id: k.id });
}

function resolveAttack(w: World, k: Kid): void {
  k.hitDone = true;
  if (k.attack === 'swing' || k.attack === 'blast') {
    if (!k.held) return;
    const def = ITEMS[k.held.kind];
    const hit = meleeHit(w, k, def.swing, def.reach, def.knock ?? 1.5, def.stun ?? 0, k.attack === 'blast' ? 1.8 : 0.85);
    if (hit) {
      k.held.uses--;
      if (k.held.uses <= 0) {
        w.events.push({ t: 'break', id: k.id, kind: k.held.kind });
        k.held = null;
      }
    }
    return;
  }
  const c = COMBO[k.combo];
  meleeHit(w, k, c.dmg, c.reach, c.knock ?? 0.8, 0, 0.8);
}

/** Hits every grown-up in front of the kid. Returns whether anything was hit. */
function meleeHit(w: World, k: Kid, dmg: number, reach: number, knock: number, stun: number, zTol: number): boolean {
  let any = false;
  for (const e of w.enemies) {
    if (e.state === 'down') continue;
    const def = ENEMIES[e.kind];
    const ahead = (e.x - k.x) * k.face;
    if (ahead < -0.3 || ahead > reach + def.radius * 0.6) continue;
    if (Math.abs(e.z - k.z) > zTol + def.radius * 0.3) continue;
    if (k.y > def.height) continue;
    damageEnemy(w, e, dmg, knock * k.face, stun, k);
    any = true;
  }
  if (any) k.hitDone = true;
  return any;
}

function damageEnemy(w: World, e: Enemy, dmg: number, knock: number, stun: number, by: Kid | undefined): void {
  const def = ENEMIES[e.kind];
  e.hp -= dmg;
  e.flash = 0.15;
  const big = dmg >= 18;
  w.events.push({ t: 'hit', x: e.x, y: def.height * 0.6, z: e.z, big, word: HIT_WORDS[Math.floor(w.rng() * HIT_WORDS.length)] });
  if (by) by.score += Math.round(dmg * 10);
  if (e.hp <= 0) {
    e.hp = 0;
    e.state = 'down';
    e.stateT = 0;
    e.vx = Math.sign(knock || 1) * 5;
    w.events.push({ t: 'ko', id: e.id });
    if (by) by.score += def.score;
    if (e.kind !== 'boss') maybeDrop(w, e);
    return;
  }
  if (e.kind === 'boss') {
    // The boss shrugs off small hits; big ones make him stagger.
    if (big && e.state !== 'windup') {
      e.state = 'hurt';
      e.stateT = 0;
      e.stateLen = 0.3;
      e.vx = knock * 0.4;
    }
    return;
  }
  e.state = 'hurt';
  e.stateT = 0;
  e.stateLen = 0.32 + stun;
  e.vx = knock;
  if (w.rng() < 0.08) w.events.push({ t: 'say', id: e.id, text: ['Ow!', 'Hey!', 'Kids these days!', "I'm too old for this!"][Math.floor(w.rng() * 4)] });
}

function maybeDrop(w: World, e: Enemy): void {
  const r = w.rng();
  if (r < 0.16) addPickup(w, w.rng() < 0.7 ? 'apple' : 'pizza', e.x, e.z);
  else if (r < 0.4) addPickup(w, WEAPON_DROPS[Math.floor(w.rng() * WEAPON_DROPS.length)], e.x, e.z);
}

function grab(w: World, k: Kid): void {
  let best: Pickup | null = null;
  let bestD = PICKUP_RANGE;
  for (const p of w.pickups) {
    const d = Math.hypot(p.x - k.x, (p.z - k.z) * 1.3);
    if (d < bestD && p.age > 0.4) {
      best = p;
      bestD = d;
    }
  }
  if (!best) {
    startAttack(w, k);
    return;
  }
  w.pickups = w.pickups.filter((p) => p !== best);
  const def = ITEMS[best.kind];
  if (def.heal) {
    k.hp = Math.min(KID_HP, k.hp + def.heal);
    w.events.push({ t: 'heal', id: k.id });
    return;
  }
  k.held = { kind: best.kind, uses: best.uses };
  w.events.push({ t: 'pickup', id: k.id, kind: best.kind });
}

function throwHeld(w: World, k: Kid): void {
  if (!k.held) return;
  const kind = k.held.kind;
  const def = ITEMS[kind];
  const multi = kind === 'balloons' || kind === 'confetti';
  const projKind: ProjKind = kind === 'confetti' ? 'confettiShot' : kind === 'balloons' ? 'balloons' : kind;
  const speed = kind === 'confetti' ? 16 : 13;
  w.projs.push({
    id: w.nextId++, kind: projKind, x: k.x + k.face * 0.4, y: k.y + 1.1, z: k.z, vx: k.face * speed, vy: kind === 'confetti' ? 0.5 : 2.2, vz: 0,
    fromKid: true, owner: k.id, dmg: def.throwDmg, stun: def.stun ?? 0, pierce: kind === 'confetti', hits: [], ttl: 2.5, spin: 12,
  });
  if (multi) {
    k.held.uses--;
    if (k.held.uses <= 0) k.held = null;
  } else {
    k.held = null;
  }
  k.state = 'throw';
  k.stateT = 0;
  k.stateLen = 0.3;
  k.hitDone = true;
  w.events.push({ t: 'throw', id: k.id });
}

function dropHeld(w: World, k: Kid): void {
  if (!k.held) return;
  addPickup(w, k.held.kind, k.x, k.z + 0.4, k.held.uses);
  k.held = null;
}

function damageKid(w: World, k: Kid, dmg: number, knock: number, stun = 0): void {
  if (k.state === 'down' || k.invuln > 0) return;
  k.hp -= dmg;
  w.events.push({ t: 'hit', x: k.x, y: 1.0, z: k.z, big: dmg >= 14, word: '' });
  if (k.hp <= 0) {
    k.hp = 0;
    k.state = 'down';
    k.stateT = 0;
    k.revive = 0;
    k.stun = 0;
    dropHeld(w, k);
    w.events.push({ t: 'down', id: k.id });
    checkLost(w);
    return;
  }
  k.state = 'hurt';
  k.stateT = 0;
  k.stateLen = 0.35;
  k.invuln = 0.8;
  k.stun = stun;
  k.x += knock * 0.25;
}

function checkLost(w: World): void {
  if (w.kids.length && w.kids.every((k) => k.state === 'down') && w.phase !== 'won' && w.phase !== 'lost') {
    w.phase = 'lost';
    w.events.push({ t: 'lost' });
  }
}

// ---------------------------------------------------------------- grown-ups

function stepEnemy(w: World, e: Enemy, dt: number): void {
  const def = ENEMIES[e.kind];
  e.stateT += dt;
  e.flash = Math.max(0, e.flash - dt);
  e.throwCd -= dt;
  e.meleeCd -= dt;
  e.specialCd -= dt;

  if (e.state === 'down') {
    e.x += e.vx * dt;
    e.vx *= Math.pow(0.02, dt);
    return;
  }
  if (e.state === 'hurt') {
    e.x += e.vx * dt;
    e.vx *= Math.pow(0.01, dt);
    if (e.stateT >= e.stateLen) e.state = 'walk';
    return;
  }

  const live = w.kids.filter(alive);
  if (!live.length) return;
  let target = live.find((k) => k.id === e.target);
  if (!target || e.stateT > 3 || e.state === 'enter') {
    target = live.reduce((a, b) => (Math.abs(b.x - e.x) + Math.abs(b.z - e.z) < Math.abs(a.x - e.x) + Math.abs(a.z - e.z) ? b : a));
    e.target = target.id;
  }
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const speed = def.speed * e.speedMul * (e.kind === 'boss' && w.bossPhase >= 2 ? 1.45 : 1);

  switch (e.state) {
    case 'enter':
      // Walk onto the screen before doing anything else.
      e.face = dx > 0 ? 1 : -1;
      e.x += e.face * speed * dt;
      if (Math.abs(e.x - w.camX) < HALF_VIEW - 0.5) {
        e.state = 'walk';
        e.stateT = 0;
      }
      return;
    case 'windup':
      if (e.stateT >= e.stateLen) {
        e.state = 'attack';
        e.stateT = 0;
        e.stateLen = 0.35;
        for (const k of live) {
          const ahead = (k.x - e.x) * e.face;
          if (ahead > -0.2 && ahead < def.meleeReach + 0.3 && Math.abs(k.z - e.z) < 0.75 + (e.kind === 'boss' ? 0.5 : 0) && k.y < 1.2) {
            damageKid(w, k, def.melee, e.face * (e.kind === 'guard' || e.kind === 'boss' ? 6 : 3));
          }
        }
      }
      return;
    case 'attack':
    case 'throw':
    case 'whistle':
      if (e.stateT >= e.stateLen) {
        e.state = 'walk';
        e.stateT = 0;
      }
      return;
    case 'throwWind':
      if (e.stateT >= e.stateLen) {
        throwAt(w, e, target);
        e.state = 'throw';
        e.stateT = 0;
        e.stateLen = 0.35;
      }
      return;
  }

  // Walking: decide what to do next.
  e.face = dx > 0 ? 1 : -1;
  const adx = Math.abs(dx);
  if (e.kind === 'coach' && e.specialCd <= 0 && adx < 3.2 && Math.abs(dz) < 2) {
    e.state = 'whistle';
    e.stateT = 0;
    e.stateLen = 0.8;
    e.specialCd = 7 + w.rng() * 3;
    w.events.push({ t: 'whistle', id: e.id });
    for (const k of live) if (Math.hypot(k.x - e.x, k.z - e.z) < 3.5) damageKid(w, k, 2, 0, 0.9);
    return;
  }
  if (e.throwCd <= 0 && adx > def.throwRange[0] && adx < def.throwRange[1] && Math.abs(dz) < 2.2) {
    e.state = 'throwWind';
    e.stateT = 0;
    e.stateLen = e.kind === 'boss' ? 0.7 : 0.55;
    e.throwCd = def.throwCooldown * (0.8 + w.rng() * 0.5);
    return;
  }
  // Only two grown-ups crowd one kid at a time; the rest hang back.
  const crowd = w.enemies.filter(
    (o) => o !== e && o.state !== 'down' && o.target === target!.id && Math.abs(o.x - target!.x) < Math.abs(e.x - target!.x),
  ).length;
  const standOff = crowd >= 2 ? 3.4 : 0.75 + def.radius * 0.7;
  const wantX = target.x - e.face * standOff;
  const wantZ = target.z + (crowd >= 2 ? e.hover * 2 : 0);
  const mx = wantX - e.x;
  const mz = wantZ - e.z;
  const d = Math.hypot(mx, mz * 1.5);
  if (d > 0.2) {
    e.x += (mx / d) * speed * dt;
    e.z += ((mz * 1.5) / d) * speed * 0.7 * dt;
  }
  e.z = clamp(e.z, Z_MIN, Z_MAX);
  if (crowd < 2 && Math.abs(mx) < 0.45 && Math.abs(dz) < 0.5 && e.meleeCd <= 0) {
    e.state = 'windup';
    e.stateT = 0;
    e.stateLen = e.kind === 'boss' ? 0.65 : 0.42;
    e.meleeCd = 1.1 + w.rng() * 0.8;
  }
}

function throwAt(w: World, e: Enemy, k: Kid): void {
  const def = ENEMIES[e.kind];
  const kind = def.throws[Math.floor(w.rng() * def.throws.length)];
  const sx = e.x + e.face * 0.5;
  const sy = def.height * 0.85;
  const dx = k.x - sx;
  const dz = k.z - e.z;
  const T = clamp(Math.abs(dx) / 9, 0.35, 1.1);
  const ty = 0.9;
  w.projs.push({
    id: w.nextId++, kind, x: sx, y: sy, z: e.z, vx: dx / T, vz: dz / T, vy: (ty - sy - 0.5 * GRAVITY * T * T) / T,
    fromKid: false, owner: e.id, dmg: def.throwDmg * (kind === 'cabinet' ? 1.5 : 1), stun: 0, pierce: false, hits: [], ttl: 3, spin: 8,
  });
}

function separateEnemies(w: World): void {
  const list = w.enemies.filter((e) => e.state !== 'down');
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const min = (ENEMIES[a.kind].radius + ENEMIES[b.kind].radius) * 0.8;
      const dx = b.x - a.x;
      const dz = (b.z - a.z) * 1.6;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 0.0001) {
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        b.x += (dx / d) * push;
        a.z -= (dz / d) * push * 0.5;
        b.z += (dz / d) * push * 0.5;
      }
    }
  }
}

function stepBoss(w: World, dt: number): void {
  const boss = w.enemies.find((e) => e.kind === 'boss' && e.state !== 'down');
  if (!boss) return;
  const frac = boss.hp / boss.maxHp;
  if (w.bossPhase === 0 && frac < 0.66) {
    w.bossPhase = 1;
    w.events.push({ t: 'say', id: boss.id, text: 'COACH! Get in here!' });
    spawnEnemy(w, 'coach', w.camX + HALF_VIEW + 2, -1);
    spawnEnemy(w, 'coach', w.camX - HALF_VIEW - 2, 1.5);
  } else if (w.bossPhase === 1 && frac < 0.33) {
    w.bossPhase = 2;
    w.events.push({ t: 'say', id: boss.id, text: 'THAT IS IT! DETENTION FOR EVERYONE!' });
  }
  if (w.bossPhase >= 2) {
    w.rainT -= dt;
    if (w.rainT <= 0) {
      w.rainT = 3.2;
      for (let i = 0; i < 5; i++) {
        w.projs.push({
          id: w.nextId++, kind: 'slip', x: w.camX + (w.rng() - 0.5) * HALF_VIEW * 2, y: 9 + w.rng() * 3, z: Z_MIN + w.rng() * (Z_MAX - Z_MIN),
          vx: 0, vy: -2, vz: 0, fromKid: false, owner: boss.id, dmg: 8, stun: 0, pierce: false, hits: [], ttl: 4, spin: 3,
        });
      }
    }
  }
}

// ---------------------------------------------------------------- projectiles

function stepProjs(w: World, dt: number): void {
  const keep: Proj[] = [];
  for (const p of w.projs) {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    if (p.kind !== 'slip') p.vy += GRAVITY * (p.kind === 'confettiShot' ? 0.15 : 0.55) * dt;
    else p.vy = Math.max(p.vy - 4 * dt, -5);
    p.y += p.vy * dt;
    let gone = false;
    if (p.fromKid) {
      for (const e of w.enemies) {
        if (e.state === 'down' || p.hits.includes(e.id)) continue;
        const def = ENEMIES[e.kind];
        if (Math.abs(e.x - p.x) < def.radius + 0.25 && Math.abs(e.z - p.z) < 0.7 && p.y < def.height + 0.2) {
          const thrower = w.kids.find((k) => k.id === p.owner);
          damageEnemy(w, e, p.dmg, Math.sign(p.vx) * 3, p.stun, thrower);
          p.hits.push(e.id);
          if (p.kind === 'balloons') splash(w, p);
          if (!p.pierce) {
            gone = true;
            break;
          }
        }
      }
    } else {
      for (const k of w.kids) {
        if (k.state === 'down' || k.invuln > 0) continue;
        if (Math.abs(k.x - p.x) < 0.5 && Math.abs(k.z - p.z) < 0.55 && p.y < 1.5 + k.y && p.y > k.y - 0.2) {
          damageKid(w, k, p.dmg, Math.sign(p.vx) * 3);
          w.events.push({ t: 'splat', x: p.x, y: p.y, z: p.z, kind: p.kind });
          gone = true;
          break;
        }
      }
    }
    if (!gone && p.y <= 0) {
      if (p.kind === 'balloons') splash(w, p);
      w.events.push({ t: 'splat', x: p.x, y: 0.05, z: p.z, kind: p.kind });
      gone = true;
    }
    if (!gone && p.ttl > 0 && Math.abs(p.x - w.camX) < HALF_VIEW + 6) keep.push(p);
  }
  w.projs = keep;
}

function splash(w: World, p: Proj): void {
  w.events.push({ t: 'splat', x: p.x, y: Math.max(0.05, p.y), z: p.z, kind: 'balloons' });
  for (const e of w.enemies) {
    if (e.state === 'down' || p.hits.includes(e.id)) continue;
    if (Math.hypot(e.x - p.x, e.z - p.z) < 1.4) {
      damageEnemy(w, e, p.dmg * 0.5, 0, 0.9, w.kids.find((k) => k.id === p.owner));
      p.hits.push(e.id);
    }
  }
}

// ---------------------------------------------------------------- restart

/** Puts everyone back at the start of the level, keeping the same kids. */
export function restart(w: World): void {
  const looks = w.kids.map((k) => ({ id: k.id, look: k.look, input: k.input, last: k.last }));
  const fresh = createWorld(w.rng);
  Object.assign(w, fresh, { nextId: Math.max(fresh.nextId, w.nextId) });
  w.kids = [];
  for (const l of looks) {
    const k = addKid(w, l.look);
    k.id = l.id;
    k.input = l.input;
    k.last = { ...l.last };
  }
  w.pickups.forEach((p) => (p.id = w.nextId++));
}
