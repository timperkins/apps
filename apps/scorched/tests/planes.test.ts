import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/core/config';
import {
  MAX_HEALTH,
  PLANE_CRASH_DAMAGE,
  PLANE_REWARD_MAX,
  PLANE_REWARD_MIN,
  WORLD_W,
} from '../src/core/constants';
import type { Battle } from '../src/core/battle';
import { flatBattle, makeMatch, runFor, runUntilQuiet } from './helpers';

const twoHumans = defaultConfig().players.slice(0, 2).map((p) => ({ ...p, kind: 'human' as const }));

function addPlane(battle: Battle, x: number, y: number): void {
  battle.planes.push({ id: 99, x, y, vx: 0, vy: 0, dir: 1, flying: true, shotBy: null, trail: [] });
}

describe('Planes', () => {
  it('are on by default', () => {
    expect(defaultConfig().planes).not.toBe('off');
  });

  it('fly across the screen in about 20 seconds', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans, planes: 'many' }));
    for (let i = 0; i < 60 * 30 && battle.planes.length === 0; i++) battle.update();
    expect(battle.planes.length).toBe(1);
    const plane = battle.planes[0];
    const startX = plane.x;
    runFor(battle, 10);
    expect(Math.abs(plane.x - startX)).toBeGreaterThan(WORLD_W * 0.45);
    expect(Math.abs(plane.x - startX)).toBeLessThan(WORLD_W * 0.55);
    runFor(battle, 10.5);
    expect(battle.planes).not.toContain(plane);
  });

  it('stay away when turned off', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans, planes: 'off' }));
    runFor(battle, 120);
    expect(battle.planes.length).toBe(0);
  });

  it('crash when hit, explode like a weaker Baby Nuke and pay the shooter', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match, [150, 180]);
    addPlane(battle, 150, 200);
    const shooter = match.players[battle.tanks[0].player];
    const victim = battle.tanks[1];
    const coinsBefore = shooter.coins;
    battle.setAngle(0, 90);
    battle.setPower(0, 500);
    expect(battle.fire(0)).toBe(true);

    let down: { reward: number; by: number | null } | null = null;
    let crashRadius = 0;
    for (let i = 0; i < 60 * 10 && battle.planes.length > 0; i++) {
      battle.update();
      for (const ev of battle.events) {
        if (ev.type === 'planeDown') down = ev;
        if (ev.type === 'explosion' && down) crashRadius = Math.max(crashRadius, ev.radius);
      }
      battle.events = [];
    }
    expect(down).not.toBeNull();
    expect(down!.by).toBe(shooter.index);
    expect(down!.reward).toBeGreaterThanOrEqual(PLANE_REWARD_MIN);
    expect(down!.reward).toBeLessThanOrEqual(PLANE_REWARD_MAX);
    expect(battle.planes.length).toBe(0);
    expect(crashRadius).toBe(38);
    runUntilQuiet(battle);
    expect(victim.health).toBeLessThan(MAX_HEALTH);
    expect(victim.health).toBeGreaterThanOrEqual(MAX_HEALTH - PLANE_CRASH_DAMAGE - 1);
    expect(shooter.coins).toBeGreaterThan(coinsBefore + down!.reward);
  });

  it('can be brought down by a nearby blast', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match);
    battle.players[battle.tanks[0].player].inventory.babyNuke = 1;
    battle.selectWeapon(0, 'babyNuke');
    // A plane hanging low beside the tank, clear of the shell going straight up and back down.
    addPlane(battle, 150 + 25, 280);
    battle.setAngle(0, 90);
    battle.setPower(0, 150);
    battle.fire(0);
    let down = false;
    for (let i = 0; i < 60 * 6 && !down; i++) {
      battle.update();
      down = battle.events.some((ev) => ev.type === 'planeDown');
    }
    expect(down).toBe(true);
  });
});
