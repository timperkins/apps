import type { Battle, Tank } from '../core/battle';
import type { Difficulty } from '../core/config';
import { MAX_POWER, RELOAD_TIME, TANK_H } from '../core/constants';
import type { Match } from '../core/match';
import { wrapDx } from '../core/physics';
import type { Rng } from '../core/rng';
import { ITEMS, WEAPONS, ammo, type ShopId, type WeaponId } from '../core/weapons';

export interface ShotPlan {
  weapon: WeaponId;
  angle: number;
  power: number;
  /** Tank index being aimed at, or -1. */
  target: number;
  /** Use a repair kit instead of shooting. */
  repair: boolean;
}

interface Skill {
  useWind: boolean;
  angleStep: number;
  powerStep: number;
  refine: boolean;
  angleError: number;
  powerError: number;
  /** Error multiplier applied per repeated shot at the same target. */
  learn: number;
}

const SKILL: Record<Difficulty, Skill> = {
  easy: { useWind: false, angleStep: 6, powerStep: 60, refine: false, angleError: 7, powerError: 70, learn: 0.9 },
  normal: { useWind: true, angleStep: 3, powerStep: 30, refine: true, angleError: 3.5, powerError: 40, learn: 0.7 },
  hard: { useWind: true, angleStep: 2, powerStep: 20, refine: true, angleError: 1.2, powerError: 14, learn: 0.6 },
  expert: { useWind: true, angleStep: 2, powerStep: 20, refine: true, angleError: 0.4, powerError: 5, learn: 0.5 },
};

/** A computer player whose best shot misses by more than this many pixels relocates with a Torpedo if it has one. */
const TORPEDO_MISS = 60;

interface Candidate {
  angle: number;
  power: number;
  miss: number;
}

/** Whether a computer player should use a Power Cell before aiming. */
export function wantsPowerCell(battle: Battle, tank: Tank): boolean {
  const player = battle.players[tank.player];
  return player.difficulty !== 'easy' && player.inventory.powerCell > 0 && battle.maxPower(tank) < MAX_POWER * 0.6;
}

/** Decides a computer player's next shot for one tank. */
export function planShot(battle: Battle, tank: Tank, rng: Rng): ShotPlan {
  const player = battle.players[tank.player];
  const skill = SKILL[player.difficulty];

  if (player.inventory.repairKit > 0 && tank.health <= 45 && player.difficulty !== 'easy') {
    return { weapon: tank.weapon, angle: tank.angle, power: tank.power, target: -1, repair: true };
  }

  const target = chooseTarget(battle, tank, player.difficulty, rng);
  if (!target) {
    return { weapon: 'babyMissile', angle: tank.angle, power: tank.power, target: -1, repair: false };
  }

  const weapon = chooseWeapon(battle, tank, target, player.difficulty, rng);
  const safeRadius = WEAPONS[weapon].radius + 12;
  const best = searchShot(battle, tank, target, skill, safeRadius);

  // No decent shot from here: take off with a Torpedo and land somewhere better.
  if (best.miss > TORPEDO_MISS && ammo(player.inventory, 'torpedo') > 0) {
    const right = wrapDx(tank.x, target.x) >= 0;
    return {
      weapon: 'torpedo',
      angle: right ? 65 : 115,
      power: Math.round(Math.min(battle.maxPower(tank), MAX_POWER * 0.7)),
      target: -1,
      repair: false,
    };
  }

  // Accuracy improves while the AI keeps shooting at the same tank.
  if (player.ai.lastTarget === target.id) player.ai.streak++;
  else player.ai.streak = 0;
  player.ai.lastTarget = target.id;
  const factor = Math.pow(skill.learn, Math.min(player.ai.streak, 4));

  const angle = clamp(best.angle + rng.gauss() * skill.angleError * factor, 0, 180);
  const power = clamp(best.power + rng.gauss() * skill.powerError * factor, 50, battle.maxPower(tank));
  return {
    weapon,
    angle: Math.round(angle * 10) / 10,
    power: Math.round(power),
    target: target.id,
    repair: false,
  };
}

function chooseTarget(battle: Battle, tank: Tank, difficulty: Difficulty, rng: Rng): Tank | null {
  const enemies = battle.aliveTanks().filter((t) => t.id !== tank.id);
  if (enemies.length === 0) return null;
  const players = battle.players;
  switch (difficulty) {
    case 'easy':
      return rng.pick(enemies);
    case 'normal':
      return enemies.reduce((a, b) => (Math.abs(wrapDx(tank.x, a.x)) <= Math.abs(wrapDx(tank.x, b.x)) ? a : b));
    case 'hard':
      return enemies.reduce((a, b) => (a.health + a.shield <= b.health + b.shield ? a : b));
    case 'expert':
      // Go after the leader, finishing off weak tanks when there is a chance.
      return enemies.reduce((a, b) => {
        const sa = players[a.player].score * 40 - (a.health + a.shield);
        const sb = players[b.player].score * 40 - (b.health + b.shield);
        return sa >= sb ? a : b;
      });
  }
}

const ATTACK_WEAPONS: WeaponId[] = ['nuke', 'babyNuke', 'mirv', 'funkyBomb', 'napalm', 'leapfrog', 'missile', 'roller', 'babyMissile'];

function chooseWeapon(battle: Battle, tank: Tank, target: Tank, difficulty: Difficulty, rng: Rng): WeaponId {
  const inv = battle.players[tank.player].inventory;
  const distance = Math.abs(wrapDx(tank.x, target.x));
  const safe = ATTACK_WEAPONS.filter((id) => ammo(inv, id) > 0 && WEAPONS[id].radius * 1.3 + 10 < distance);
  if (safe.length === 0) return 'babyMissile';
  if (difficulty === 'easy') return rng.pick(safe);

  const need = target.health + target.shield;
  if (difficulty === 'normal') {
    // Mostly uses its best weapon, sometimes saves it.
    return rng.chance(0.7) ? safe[0] : safe[safe.length - 1];
  }
  // Hard and expert pick the cheapest weapon that should finish the job.
  const finishing = [...safe].reverse().find((id) => WEAPONS[id].damage >= need);
  if (finishing) return finishing;
  if (difficulty === 'expert' && ammo(inv, 'dirtClod') > 0 && target.health > 70 && rng.chance(0.15)) {
    return 'dirtClod';
  }
  return safe[0];
}

function searchShot(battle: Battle, tank: Tank, target: Tank, skill: Skill, safeRadius: number): Candidate {
  const tx = target.x;
  const ty = target.y - TANK_H / 2;
  const maxPower = battle.maxPower(tank);
  const right = wrapDx(tank.x, tx) >= 0;

  const evaluate = (angle: number, power: number): number => {
    const r = battle.traceShot(tank, angle, power, skill.useWind);
    if (r.lost) return 1e6;
    if (r.tank === target.id) return 0;
    const selfDist = Math.hypot(wrapDx(tank.x, r.x), r.y - (tank.y - TANK_H / 2));
    if (selfDist < safeRadius) return 5e5 + (safeRadius - selfDist);
    return Math.hypot(wrapDx(tx, r.x), (r.y - ty) * 0.5);
  };

  let best: Candidate = { angle: right ? 45 : 135, power: maxPower * 0.6, miss: Infinity };
  const lo = right ? 10 : 95;
  const hi = right ? 85 : 170;
  for (let angle = lo; angle <= hi; angle += skill.angleStep) {
    for (let power = 100; power <= maxPower; power += skill.powerStep) {
      const miss = evaluate(angle, power);
      if (miss < best.miss) best = { angle, power, miss };
    }
  }
  if (skill.refine) {
    const a0 = best.angle;
    const p0 = best.power;
    for (let angle = a0 - skill.angleStep; angle <= a0 + skill.angleStep; angle += 0.5) {
      for (let power = p0 - skill.powerStep; power <= p0 + skill.powerStep; power += 4) {
        if (power < 50 || power > maxPower || angle < 0 || angle > 180) continue;
        const miss = evaluate(angle, power);
        if (miss < best.miss) best = { angle, power, miss };
      }
    }
  }
  return best;
}

interface ShopPlan {
  budget: number;
  wishlist: ShopId[];
}

const SHOPPING: Record<Difficulty, ShopPlan> = {
  easy: { budget: 0.5, wishlist: [] },
  normal: { budget: 0.7, wishlist: ['parachute', 'missile', 'babyNuke', 'torpedo', 'missile', 'roller'] },
  hard: { budget: 0.85, wishlist: ['shield', 'parachute', 'babyNuke', 'mirv', 'torpedo', 'missile', 'repairKit', 'powerCell', 'babyNuke'] },
  expert: { budget: 0.9, wishlist: ['shield', 'parachute', 'nuke', 'babyNuke', 'mirv', 'torpedo', 'repairKit', 'powerCell', 'dirtClod', 'babyNuke', 'funkyBomb'] },
};

/** Spends a computer player's cash. Returns what was bought, for display. */
export function aiShop(match: Match, playerIndex: number, rng: Rng): ShopId[] {
  const p = match.players[playerIndex];
  const plan = SHOPPING[p.difficulty];
  const floor = p.coins * (1 - plan.budget);
  const bought: ShopId[] = [];
  const tryBuy = (id: ShopId): boolean => {
    const price = id in WEAPONS ? WEAPONS[id as WeaponId].price : ITEMS[id as keyof typeof ITEMS].price;
    if (p.coins - price < floor) return false;
    if (id === 'shield' && p.inventory.shield > 0) return false;
    if (id === 'parachute' && p.inventory.parachute >= 3) return false;
    if (!match.buy(playerIndex, id)) return false;
    bought.push(id);
    return true;
  };

  if (p.difficulty === 'easy') {
    const cheap: ShopId[] = ['missile', 'dirtClod', 'roller', 'digger', 'parachute', 'babyNuke', 'torpedo'];
    for (let i = 0; i < 6; i++) tryBuy(rng.pick(cheap));
    return bought;
  }
  for (const id of plan.wishlist) tryBuy(id);
  // Spend what is left of the budget on missiles.
  while (tryBuy('missile')) {
    /* keep buying */
  }
  return bought;
}

/** Seconds a computer waits after reloading before it starts its next shot. */
const THINK: Record<Difficulty, [number, number]> = {
  easy: [2, 3.5],
  normal: [1, 2],
  hard: [0.5, 1.2],
  expert: [0.3, 0.8],
};

/** Degrees per second and power per second a computer moves its controls, so people can follow it. */
const AIM_SPEED = 90;
const POWER_SPEED = 700;

interface CpuState {
  plan: ShotPlan | null;
  wait: number;
}

/**
 * Drives every computer tank in realtime: each one waits for its reload, thinks for a moment,
 * plans a shot, swings its barrel toward it and fires.
 */
export class CpuDriver {
  private readonly state = new Map<number, CpuState>();

  constructor(private readonly rng: Rng) {}

  update(battle: Battle, dt: number): void {
    if (battle.phase !== 'playing') return;
    // Planning traces hundreds of shots, so at most one tank plans per update.
    let planned = false;
    for (const tank of battle.tanks) {
      // A tank up in the air after a Torpedo just rides it out; it doesn't steer.
      if (!tank.alive || tank.flight !== null || battle.players[tank.player].kind !== 'cpu') continue;
      let s = this.state.get(tank.id);
      if (!s) {
        s = { plan: null, wait: this.think(battle, tank) };
        this.state.set(tank.id, s);
      }
      if (s.wait > 0) {
        s.wait -= dt;
        continue;
      }
      if (!s.plan) {
        if (planned || tank.reload > 0.5) continue;
        planned = true;
        if (wantsPowerCell(battle, tank)) battle.usePowerCell(tank.id);
        s.plan = planShot(battle, tank, this.rng);
        if (!s.plan.repair) battle.selectWeapon(tank.id, s.plan.weapon);
        continue;
      }
      if (s.plan.target >= 0 && !battle.tanks[s.plan.target].alive) {
        s.plan = null;
        continue;
      }
      if (this.act(battle, tank, s.plan, dt)) {
        s.plan = null;
        s.wait = this.think(battle, tank) + RELOAD_TIME;
      }
    }
  }

  /** Moves toward the plan and fires once lined up. Returns true when the shot is done. */
  private act(battle: Battle, tank: Tank, plan: ShotPlan, dt: number): boolean {
    if (plan.repair) return battle.useRepair(tank.id) || tank.reload <= 0;
    const power = Math.min(plan.power, battle.maxPower(tank));
    const da = plan.angle - tank.angle;
    const dp = power - tank.power;
    const aStep = AIM_SPEED * dt;
    const pStep = POWER_SPEED * dt;
    if (Math.abs(da) > 0.01) battle.setAngle(tank.id, Math.abs(da) <= aStep ? plan.angle : tank.angle + Math.sign(da) * aStep);
    if (dp !== 0) battle.setPower(tank.id, Math.abs(dp) <= pStep ? power : tank.power + Math.sign(dp) * pStep);
    if (Math.abs(plan.angle - tank.angle) > 0.01 || tank.power !== power) return false;
    if (tank.reload > 0) return false;
    return battle.fire(tank.id);
  }

  private think(battle: Battle, tank: Tank): number {
    const [lo, hi] = THINK[battle.players[tank.player].difficulty];
    return this.rng.range(lo, hi);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
