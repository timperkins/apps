import { Battle } from '../src/core/battle';
import { STEP } from '../src/core/constants';
import { defaultConfig, type GameConfig } from '../src/core/config';
import { Match } from '../src/core/match';
import { Terrain } from '../src/core/terrain';

export function makeMatch(overrides: Partial<GameConfig> = {}): Match {
  return new Match({ ...defaultConfig(), seed: 1234, wind: 'off', planes: 'off', ...overrides });
}

/** A battle on flat ground with two tanks at fixed spots. */
export function flatBattle(match: Match, xs = [150, 450], ground = 300): Battle {
  match.nextRound();
  const battle = match.startBattle();
  const heights = new Array(battle.terrain.width).fill(ground);
  const flat = Terrain.fromHeights(heights, battle.terrain.width, battle.terrain.height);
  battle.terrain.mask.set(flat.mask);
  battle.terrain.version++;
  battle.tanks.forEach((t, i) => {
    t.x = xs[i] ?? 50 + i * 60;
    t.y = ground;
  });
  battle.wind = 0;
  return battle;
}

/** Steps until nothing is flying, burning or falling (or the round ends). */
export function runUntilQuiet(battle: Battle, maxSteps = 20000): void {
  for (let i = 0; i < maxSteps; i++) {
    battle.update();
    if (battle.phase === 'over' || battle.isQuiet()) return;
  }
  throw new Error('battle never settled');
}

/** Steps the battle for a number of seconds. */
export function runFor(battle: Battle, seconds: number): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) battle.update();
}

/** Finds an angle and power for `from` that lands on `to`, using the same physics the AI uses. */
export function aimAt(battle: Battle, from: number, to: number): boolean {
  const shooter = battle.tanks[from];
  for (let a = 10; a <= 170; a += 1) {
    for (let p = 100; p <= battle.maxPower(shooter); p += 5) {
      if (battle.traceShot(shooter, a, p, true).tank === to) {
        battle.setAngle(from, a);
        battle.setPower(from, p);
        return true;
      }
    }
  }
  return false;
}
