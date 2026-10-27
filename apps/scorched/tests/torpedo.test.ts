import { describe, expect, it } from 'vitest';
import { aiShop, planShot } from '../src/ai/ai';
import { defaultConfig } from '../src/core/config';
import { CHUTE_TOP, MAX_HEALTH, STEP, WORLD_W } from '../src/core/constants';
import { wrapDx, wrapX } from '../src/core/physics';
import { Rng } from '../src/core/rng';
import { WEAPONS } from '../src/core/weapons';
import type { Battle } from '../src/core/battle';
import { flatBattle, makeMatch, runFor, runUntilQuiet } from './helpers';

const twoHumans = defaultConfig().players.slice(0, 2).map((p) => ({ ...p, kind: 'human' as const }));

function torpedoBattle(xs = [150, 450]): Battle {
  const match = makeMatch({ players: twoHumans });
  const battle = flatBattle(match, xs);
  match.players[battle.tanks[0].player].inventory.torpedo = 1;
  battle.selectWeapon(0, 'torpedo');
  return battle;
}

/** Steps until tank 0 reaches the given flight stage, or fails. */
function runUntilFlight(battle: Battle, flight: string | null, maxSeconds = 30): void {
  for (let i = 0; i < maxSeconds / STEP; i++) {
    if (battle.tanks[0].flight === flight) return;
    battle.update();
  }
  throw new Error(`tank never reached ${flight}`);
}

describe('Torpedo', () => {
  it('costs $1,000', () => {
    expect(WEAPONS.torpedo.price).toBe(1000);
    expect(WEAPONS.torpedo.bundle).toBeGreaterThan(0);
  });

  it('rockets the firing tank straight up, drifting the way it was aimed, without spinning or a shell', () => {
    const battle = torpedoBattle();
    battle.setAngle(0, 60);
    expect(battle.fire(0)).toBe(true);
    expect(battle.projectiles.length).toBe(0);
    const t = battle.tanks[0];
    runFor(battle, 0.5);
    expect(t.flight).toBe('launch');
    expect(t.y).toBeLessThan(300 - 40);
    expect(t.x).toBeGreaterThan(150);
    expect(300 - t.y).toBeGreaterThan(2 * (t.x - 150));
    expect(t.spin).toBe(0);

    const left = torpedoBattle();
    left.setAngle(0, 120);
    left.fire(0);
    runFor(left, 0.5);
    expect(left.tanks[0].x).toBeLessThan(150);
    expect(left.tanks[0].spin).toBe(0);
  });

  it('goes all the way to the top of the screen whatever the power', () => {
    for (const power of [100, 1000]) {
      const battle = torpedoBattle();
      battle.setAngle(0, 90);
      battle.setPower(0, power);
      battle.fire(0);
      runUntilFlight(battle, 'chute', 5);
      expect(battle.tanks[0].y).toBeLessThanOrEqual(CHUTE_TOP + 4);
      expect(battle.tanks[0].y - CHUTE_TOP).toBeGreaterThanOrEqual(0);
    }
  });

  it('opens a parachute at the top and drifts down at 11px a second', () => {
    const battle = torpedoBattle();
    battle.setAngle(0, 80);
    battle.fire(0);
    const t = battle.tanks[0];
    runUntilFlight(battle, 'chute', 5);
    expect(t.parachute).toBe(true);
    const y0 = t.y;
    runFor(battle, 2);
    expect(t.y - y0).toBeCloseTo(22, 0);
    expect(battle.canFire(0)).toBe(false);
    expect(battle.move(0, 1)).toBe(false);
    runUntilQuiet(battle);
    expect(t.flight).toBeNull();
    expect(t.y).toBe(300);
    expect(t.health).toBe(MAX_HEALTH);
    expect(battle.canFire(0)).toBe(true);
  });

  it('steers left and right while parachuting', () => {
    const drift = (dir: -1 | 0 | 1): number => {
      const battle = torpedoBattle();
      battle.setAngle(0, 90);
      battle.setPower(0, 800);
      battle.fire(0);
      runUntilFlight(battle, 'chute');
      const x0 = battle.tanks[0].x;
      expect(battle.steer(0, dir)).toBe(true);
      runFor(battle, 2);
      return wrapDx(x0, battle.tanks[0].x);
    };
    expect(drift(0)).toBeCloseTo(0, 5);
    expect(drift(1)).toBeGreaterThan(10);
    expect(drift(-1)).toBeLessThan(-10);
    // Only under a parachute.
    const grounded = torpedoBattle();
    expect(grounded.steer(0, 1)).toBe(false);
  });

  it('drops the tank hard when another player shoots its parachute', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match, [150, 450]);
    const t = battle.tanks[0];
    const shooter = battle.tanks[1].player;
    match.players[t.player].inventory.parachute = 3;
    // Hang tank 0 under a parachute high over the field.
    t.flight = 'chute';
    t.parachute = true;
    t.y = 100;
    // A shell coming straight down onto the canopy.
    battle.projectiles.push({
      x: 150, y: 100 - CHUTE_TOP - 10, vx: 0, vy: 60, weapon: 'babyMissile', owner: shooter, kind: 'shell',
      age: 0, hopsLeft: 0, rolling: false, rollDir: 0, rollDist: 0, digging: false, digLeft: 0, trail: [],
    });
    let cut = false;
    for (let i = 0; i < 60 && !cut; i++) {
      battle.update();
      cut = battle.events.some((e) => e.type === 'chuteCut' && e.by === shooter);
    }
    expect(cut).toBe(true);
    expect(t.flight).toBe('tumble');
    expect(t.parachute).toBe(false);
    runUntilQuiet(battle);
    // A 200px drop with no parachute (the spare in the inventory isn't used) is fatal.
    expect(t.alive).toBe(false);
    expect(match.players[t.player].inventory.parachute).toBe(3);
    expect(match.players[shooter].round.kills).toBe(1);
  });

  it('flies up through dirt in its way without digging it out', () => {
    const battle = torpedoBattle();
    // An overhang right above the tank.
    for (let y = 200; y < 230; y++) for (let x = 120; x < 200; x++) battle.terrain.mask[y * WORLD_W + x] = 1;
    battle.setAngle(0, 90);
    battle.fire(0);
    runUntilFlight(battle, 'chute', 5);
    expect(battle.tanks[0].y).toBeLessThanOrEqual(CHUTE_TOP + 4);
    expect(battle.terrain.isSolid(150, 215)).toBe(true);
    // It comes down on top of the overhang.
    runUntilQuiet(battle);
    expect(battle.tanks[0].y).toBe(200);
    expect(battle.tanks[0].health).toBe(MAX_HEALTH);
  });

  it('wraps a tank launched off one side of the map onto the other', () => {
    const battle = torpedoBattle([WORLD_W - 30, 300]);
    battle.setAngle(0, 30);
    battle.setPower(0, 1000);
    battle.fire(0);
    runUntilQuiet(battle);
    const t = battle.tanks[0];
    expect(t.alive).toBe(true);
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x).toBeLessThan(150);
    expect(t.y).toBe(300);
  });

  it('is bought and used by computer players that have no shot', () => {
    const match = makeMatch({
      players: [
        { ...twoHumans[0], kind: 'cpu', difficulty: 'hard' },
        { ...twoHumans[1] },
      ],
    });
    match.nextRound();
    aiShop(match, 0, new Rng(1));
    expect(match.players[0].inventory.torpedo).toBeGreaterThan(0);

    const battle = flatBattle(match, [150, 450]);
    // Shut the target in a tunnel so nothing can reach it from here.
    for (let y = 0; y < 290; y++) for (let x = 380; x < 520; x++) battle.terrain.mask[y * WORLD_W + x] = 1;
    for (let y = 290; y < 300; y++) for (const x of [380, 381, 518, 519]) battle.terrain.mask[y * WORLD_W + x] = 1;
    const plan = planShot(battle, battle.tanks[0], new Rng(2));
    expect(plan.weapon).toBe('torpedo');
  });
});

describe('Wrapping map', () => {
  it('measures distance the short way around', () => {
    expect(wrapX(-5)).toBe(WORLD_W - 5);
    expect(wrapX(WORLD_W + 3)).toBe(3);
    expect(wrapDx(WORLD_W - 5, 5)).toBe(10);
    expect(wrapDx(5, WORLD_W - 5)).toBe(-10);
  });

  it('brings a shot that leaves one side back on the other', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match, [WORLD_W - 40, 40]);
    battle.setAngle(0, 50);
    battle.setPower(0, 300);
    let wrapped = false;
    battle.fire(0);
    for (let i = 0; i < 60 * 10 && battle.projectiles.length; i++) {
      battle.update();
      const p = battle.projectiles[0];
      if (p && p.x < 100) wrapped = true;
    }
    expect(wrapped).toBe(true);
  });

  it('lets the AI aim across the edge', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match, [WORLD_W - 40, 40]);
    const shot = battle.traceShot(battle.tanks[0], 45, 300, false);
    expect(shot.lost).toBe(false);
    expect(shot.x).toBeLessThan(WORLD_W / 2);
  });

  it('carves craters across the edge', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match, [200, 400]);
    battle.terrain.carve(0, 300, 10);
    expect(battle.terrain.isSolid(WORLD_W - 3, 302)).toBe(false);
    expect(battle.terrain.isSolid(3, 302)).toBe(false);
    expect(battle.terrain.isSolid(-3, 302)).toBe(false);
  });
});
