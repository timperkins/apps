import { describe, expect, it } from 'vitest';
import { CpuDriver, aiShop, planShot } from '../src/ai/ai';
import { STEP } from '../src/core/constants';
import type { Difficulty, PlayerSetup } from '../src/core/config';
import { Rng } from '../src/core/rng';
import { flatBattle, makeMatch, runUntilQuiet } from './helpers';

const cpus = (d: Difficulty): PlayerSetup[] => [
  { name: 'A', color: '#f00', kind: 'cpu', difficulty: d },
  { name: 'B', color: '#00f', kind: 'cpu', difficulty: d },
];

describe('Computer players', () => {
  it('expert usually damages its target within two shots on open ground', () => {
    let hits = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const match = makeMatch({ players: cpus('expert'), seed, wind: 'breezy' });
      const battle = flatBattle(match);
      battle.wind = 6;
      const rng = new Rng(seed);
      const shooter = battle.tanks[0];
      const target = battle.tanks[1];
      const plan = planShot(battle, shooter, rng);
      expect(plan.target).toBe(target.id);
      battle.setAngle(shooter.id, plan.angle);
      battle.setPower(shooter.id, plan.power);
      battle.fire(shooter.id);
      runUntilQuiet(battle);
      if (target.health < 100) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(4);
  });

  it('never plans a shot that is out of range of the controls', () => {
    for (const d of ['easy', 'normal', 'hard', 'expert'] as Difficulty[]) {
      const match = makeMatch({ players: cpus(d) });
      const battle = flatBattle(match);
      const plan = planShot(battle, battle.tanks[0], new Rng(3));
      expect(plan.angle).toBeGreaterThanOrEqual(0);
      expect(plan.angle).toBeLessThanOrEqual(180);
      expect(plan.power).toBeLessThanOrEqual(battle.maxPower(battle.tanks[0]));
    }
  });

  it('shops within its budget', () => {
    const match = makeMatch({ players: cpus('expert'), startingCoins: 30000 });
    const bought = aiShop(match, 0, new Rng(1));
    expect(bought.length).toBeGreaterThan(0);
    expect(match.players[0].coins).toBeGreaterThanOrEqual(0);
    expect(match.players[0].inventory.shield).toBe(1);
  });
});

describe('All-computer rounds', () => {
  it.each([1, 2, 3])('finish without getting stuck (seed %i)', (seed) => {
    const match = makeMatch({
      seed,
      wind: 'gale',
      startingCoins: 50000,
      players: (['easy', 'normal', 'hard', 'expert', 'expert'] as Difficulty[]).map((d, i) => ({
        name: `P${i}`, color: '#fff', kind: 'cpu' as const, difficulty: d,
      })),
    });
    const rng = new Rng(seed);
    match.nextRound();
    for (const p of match.players) aiShop(match, p.index, rng);
    const battle = match.startBattle();
    const driver = new CpuDriver(rng);
    // Ten minutes of game time is far more than a round of five CPUs needs.
    for (let i = 0; i < 36000 && battle.phase !== 'over'; i++) {
      driver.update(battle, STEP);
      battle.update(STEP);
    }
    expect(battle.tanks.some((t) => t.shots > 0)).toBe(true);
    expect(battle.phase).toBe('over');
  });
});

describe('Realtime computer players', () => {
  it('fire on their own, no faster than the reload allows', () => {
    const match = makeMatch({ players: cpus('expert') });
    const battle = flatBattle(match);
    const driver = new CpuDriver(new Rng(5));
    const fired: number[][] = [[], []];
    for (let i = 0; i < 20 * 60 && battle.phase === 'playing'; i++) {
      driver.update(battle, STEP);
      battle.update(STEP);
      for (const e of battle.events) if (e.type === 'fire') fired[e.tank].push(battle.time);
      battle.events = [];
    }
    expect(fired[0].length + fired[1].length).toBeGreaterThan(1);
    for (const times of fired) {
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(3 - 1e-6);
    }
  });
});
