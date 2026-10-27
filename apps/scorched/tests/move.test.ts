import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/core/config';
import { MOVE_DISTANCE, MOVE_TIME, TANK_HALF_W, WORLD_W } from '../src/core/constants';
import { Terrain } from '../src/core/terrain';
import type { Battle } from '../src/core/battle';
import { flatBattle, makeMatch, runFor, runUntilQuiet } from './helpers';

const twoHumans = defaultConfig().players.slice(0, 2).map((p) => ({ ...p, kind: 'human' as const }));

function setGround(battle: Battle, heights: number[]): void {
  const t = Terrain.fromHeights(heights, battle.terrain.width, battle.terrain.height);
  battle.terrain.mask.set(t.mask);
  battle.terrain.version++;
}

describe('Moving tanks', () => {
  it('drives 5% of the screen width over about 5 seconds', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    expect(MOVE_DISTANCE).toBe(32);
    expect(battle.move(0, 1)).toBe(true);
    runFor(battle, MOVE_TIME / 2);
    expect(battle.tanks[0].x).toBeGreaterThan(150 + 10);
    expect(battle.tanks[0].x).toBeLessThan(150 + 22);
    runFor(battle, MOVE_TIME / 2 + 0.1);
    expect(battle.tanks[0].x).toBe(150 + MOVE_DISTANCE);
    expect(battle.tanks[0].moveLeft).toBe(0);
    expect(battle.move(0, -1)).toBe(true);
    runFor(battle, MOVE_TIME + 0.1);
    expect(battle.tanks[0].x).toBe(150);
  });

  it('uses up the turn: no firing, repairing or moving until the drive is over', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.players[battle.tanks[0].player].inventory.repairKit = 1;
    battle.tanks[0].health = 50;
    expect(battle.move(0, 1)).toBe(true);
    expect(battle.fire(0)).toBe(false);
    expect(battle.useRepair(0)).toBe(false);
    expect(battle.move(0, -1)).toBe(false);
    runFor(battle, MOVE_TIME - 0.2);
    expect(battle.canFire(0)).toBe(false);
    runFor(battle, 0.3);
    expect(battle.fire(0)).toBe(true);
    // And a shot's reload stops a move too.
    expect(battle.move(0, 1)).toBe(false);
  });

  it("can't start while reloading", () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.setPower(0, 150);
    battle.fire(0);
    expect(battle.move(0, 1)).toBe(false);
  });

  it('drives off one side of the map and comes back on the other', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }), [TANK_HALF_W + 10, 300]);
    expect(battle.move(0, -1)).toBe(true);
    runFor(battle, MOVE_TIME + 0.1);
    expect(battle.tanks[0].x).toBe(WORLD_W + TANK_HALF_W + 10 - MOVE_DISTANCE);
    expect(battle.tanks[0].y).toBe(300);
    expect(battle.move(0, 1)).toBe(true);
    runFor(battle, MOVE_TIME + 0.1);
    expect(battle.tanks[0].x).toBe(TANK_HALF_W + 10);
  });

  it('climbs gentle slopes but stops at steep ones', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    // A gentle ramp up to the right of tank 0 (1px up per 2px across)...
    const heights = new Array(WORLD_W).fill(300).map((h, x) => (x > 160 && x < 260 ? h - Math.floor((x - 160) / 2) : h));
    setGround(battle, heights);
    expect(battle.move(0, 1)).toBe(true);
    runFor(battle, MOVE_TIME + 0.1);
    expect(battle.tanks[0].x).toBe(150 + MOVE_DISTANCE);
    expect(battle.tanks[0].y).toBeLessThan(300);

    // ...and a cliff to the left of tank 1.
    const cliff = new Array(WORLD_W).fill(300).map((h, x) => (x < 440 ? 270 : h));
    setGround(battle, cliff);
    battle.tanks[1].x = 450;
    expect(battle.move(1, -1)).toBe(true);
    runFor(battle, MOVE_TIME + 0.1);
    expect(battle.tanks[1].x).toBe(440 + TANK_HALF_W);
    expect(battle.tanks[1].y).toBe(300);
  });

  it('drives off ledges and falls', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    setGround(battle, new Array(WORLD_W).fill(300).map((h, x) => (x > 165 ? 310 : h)));
    expect(battle.move(0, 1)).toBe(true);
    runFor(battle, MOVE_TIME + 1);
    runUntilQuiet(battle);
    expect(battle.tanks[0].x).toBe(150 + MOVE_DISTANCE);
    expect(battle.tanks[0].y).toBe(310);
  });

  it("can't drive through another tank", () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }), [150, 175]);
    expect(battle.move(0, 1)).toBe(true);
    runFor(battle, MOVE_TIME + 0.1);
    expect(battle.tanks[0].x).toBe(175 - TANK_HALF_W * 2 - 1);
  });
});
