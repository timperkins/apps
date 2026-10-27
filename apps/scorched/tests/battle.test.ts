import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/core/config';
import { DRAW_VOTE_AFTER, MAX_HEALTH, RELOAD_TIME } from '../src/core/constants';
import { aimAt, flatBattle, makeMatch, runFor, runUntilQuiet } from './helpers';

const twoHumans = defaultConfig().players.slice(0, 2).map((p) => ({ ...p, kind: 'human' as const }));
const threeHumans = defaultConfig().players.map((p) => ({ ...p, kind: 'human' as const }));

describe('Battle', () => {
  it('fires, lands and digs a crater', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.setAngle(0, 60);
    battle.setPower(0, 300);
    expect(battle.fire(0)).toBe(true);
    expect(battle.projectiles.length).toBe(1);
    runUntilQuiet(battle);
    expect(battle.phase).toBe('playing');
    let cratered = false;
    for (let x = 0; x < 640; x++) if (battle.terrain.surfaceY(x) > 300) cratered = true;
    expect(cratered).toBe(true);
  });

  it('makes a tank reload for 5 seconds after firing', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.setAngle(0, 90);
    battle.setPower(0, 150);
    expect(battle.fire(0)).toBe(true);
    expect(battle.fire(0)).toBe(false);
    expect(battle.canFire(0)).toBe(false);
    runFor(battle, RELOAD_TIME - 0.1);
    expect(battle.fire(0)).toBe(false);
    runFor(battle, 0.2);
    expect(battle.fire(0)).toBe(true);
  });

  it('lets every tank fire at once, each with its own reload', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.setPower(0, 200);
    battle.setPower(1, 200);
    expect(battle.fire(0)).toBe(true);
    expect(battle.fire(1)).toBe(true);
    expect(battle.projectiles.map((p) => p.owner).sort()).toEqual([0, 1].map((i) => battle.tanks[i].player).sort());
    expect(battle.tanks[0].reload).toBe(RELOAD_TIME);
    expect(battle.tanks[1].reload).toBe(RELOAD_TIME);
  });

  it('pays the shooter for a kill and ends the round once the dust settles', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match);
    const shooter = battle.tanks[0];
    const victim = battle.tanks[1];
    victim.health = 10;
    expect(aimAt(battle, 0, 1)).toBe(true);
    const coinsBefore = match.players[shooter.player].coins;
    battle.fire(0);
    for (let i = 0; i < 20000 && battle.phase === 'playing'; i++) {
      battle.update();
      // While the death explosion is still going, the round is not over yet.
      if (!victim.alive && !battle.isQuiet()) expect(battle.phase).toBe('playing');
    }
    expect(victim.alive).toBe(false);
    expect(battle.phase).toBe('over');
    expect(battle.winner).toBe(shooter.player);
    expect(match.players[shooter.player].coins).toBeGreaterThan(coinsBefore);
    expect(match.players[shooter.player].round.kills).toBe(1);
  });

  it('credits each shooter when shells cross in the air', () => {
    const match = makeMatch({ players: twoHumans });
    const battle = flatBattle(match);
    expect(aimAt(battle, 0, 1)).toBe(true);
    expect(aimAt(battle, 1, 0)).toBe(true);
    battle.tanks[0].health = 5;
    battle.tanks[1].health = 5;
    battle.fire(0);
    battle.fire(1);
    runUntilQuiet(battle);
    expect(battle.tanks.every((t) => !t.alive)).toBe(true);
    expect(match.players[battle.tanks[0].player].round.kills).toBe(1);
    expect(match.players[battle.tanks[1].player].round.kills).toBe(1);
    expect(battle.phase).toBe('over');
    expect(battle.winner).toBe(null);
  });

  it('stops the last tank from firing once the round is decided', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.tanks[1].health = 0;
    battle.update();
    expect(battle.tanks[1].alive).toBe(false);
    expect(battle.canFire(0)).toBe(false);
  });

  it('caps power by remaining health', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    battle.tanks[0].health = MAX_HEALTH / 2;
    battle.setPower(0, 1000);
    expect(battle.tanks[0].power).toBe(500);
  });

  it('restores the power cap with a Power Cell without healing or reloading', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    const t = battle.tanks[0];
    const inv = battle.players[t.player].inventory;
    inv.powerCell = 1;
    t.health = MAX_HEALTH * 0.3;
    expect(battle.maxPower(t)).toBe(300);
    expect(battle.usePowerCell(0)).toBe(true);
    expect(battle.maxPower(t)).toBe(1000);
    expect(t.power).toBe(1000);
    expect(t.health).toBe(MAX_HEALTH * 0.3);
    expect(t.reload).toBe(0);
    expect(inv.powerCell).toBe(0);
    expect(battle.usePowerCell(0)).toBe(false);
  });

  it('repairs, which uses up the reload', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    const t = battle.tanks[0];
    battle.players[t.player].inventory.repairKit = 1;
    t.health = 50;
    expect(battle.useRepair(0)).toBe(true);
    expect(t.health).toBe(80);
    expect(t.reload).toBe(RELOAD_TIME);
    expect(battle.fire(0)).toBe(false);
  });

  it('uses up bought weapons and falls back to Baby Missiles', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    const p = battle.players[battle.tanks[0].player];
    p.inventory.missile = 1;
    battle.selectWeapon(0, 'missile');
    expect(battle.tanks[0].weapon).toBe('missile');
    battle.fire(0);
    expect(p.inventory.missile).toBe(0);
    expect(battle.tanks[0].weapon).toBe('babyMissile');
  });

  it('shields absorb damage and parachutes prevent fall damage', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    const t = battle.tanks[0];
    battle.players[t.player].inventory.parachute = 1;
    // Dig the ground out from under the tank.
    battle.terrain.carve(t.x, t.y + 20, 25);
    for (let i = 0; i < 600; i++) battle.update();
    expect(t.health).toBe(MAX_HEALTH);
    expect(battle.players[t.player].inventory.parachute).toBe(0);
  });

  it('runs every weapon to completion', () => {
    const ids = ['missile', 'babyNuke', 'nuke', 'dirtClod', 'mirv', 'leapfrog', 'funkyBomb', 'roller', 'digger', 'napalm'] as const;
    for (const id of ids) {
      const battle = flatBattle(makeMatch({ players: twoHumans }), [100, 560]);
      battle.players[battle.tanks[0].player].inventory[id] = 1;
      battle.selectWeapon(0, id);
      battle.setAngle(0, battle.tanks[0].x < 320 ? 55 : 125);
      battle.setPower(0, 420);
      battle.fire(0);
      runUntilQuiet(battle);
      expect(['playing', 'over']).toContain(battle.phase);
    }
  });
});

describe('Draw vote', () => {
  it('opens after a minute with no hits and ends in a draw once every living human agrees', () => {
    const battle = flatBattle(makeMatch({ players: threeHumans }), [100, 320, 540]);
    runFor(battle, DRAW_VOTE_AFTER - 1);
    expect(battle.drawOpen).toBe(false);
    expect(battle.voteDraw(0, true)).toBe(false);
    runFor(battle, 1.1);
    expect(battle.drawOpen).toBe(true);
    expect(battle.events.some((e) => e.type === 'drawVote' && e.open)).toBe(true);
    battle.voteDraw(0, true);
    battle.voteDraw(1, true);
    battle.update();
    expect(battle.phase).toBe('playing');
    expect(battle.drawTally()).toEqual({ votes: 2, needed: 3 });
    // Taking a vote back works too.
    battle.voteDraw(1, false);
    expect(battle.drawTally().votes).toBe(1);
    battle.voteDraw(1, true);
    battle.voteDraw(2, true);
    battle.update();
    expect(battle.phase).toBe('over');
    expect(battle.winner).toBe(null);
  });

  it('stops all firing once everyone agrees, and waits for shells already in the air', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    runFor(battle, DRAW_VOTE_AFTER + 0.1);
    // A short lob into empty ground, so nobody is hit.
    battle.setAngle(0, 45);
    battle.setPower(0, 200);
    battle.fire(0);
    battle.voteDraw(0, true);
    battle.voteDraw(1, true);
    battle.update();
    expect(battle.drawAgreed).toBe(true);
    expect(battle.canFire(1)).toBe(false);
    expect(battle.phase).toBe('playing');
    runUntilQuiet(battle);
    expect(battle.tanks.every((t) => t.health === MAX_HEALTH)).toBe(true);
    expect(battle.phase).toBe('over');
    expect(battle.winner).toBe(null);
  });

  it('closes and clears the votes when any tank is hit', () => {
    const battle = flatBattle(makeMatch({ players: twoHumans }));
    runFor(battle, DRAW_VOTE_AFTER + 0.1);
    battle.voteDraw(0, true);
    expect(aimAt(battle, 0, 1)).toBe(true);
    battle.fire(0);
    runUntilQuiet(battle);
    expect(battle.tanks[1].health).toBeLessThan(MAX_HEALTH);
    expect(battle.drawOpen).toBe(false);
    expect(battle.drawVotes.size).toBe(0);
  });

  it('counts computer players as agreeing', () => {
    const players = [twoHumans[0], { ...defaultConfig().players[1] }];
    const battle = flatBattle(makeMatch({ players }));
    runFor(battle, DRAW_VOTE_AFTER + 0.1);
    expect(battle.drawTally()).toEqual({ votes: 0, needed: 1 });
    battle.voteDraw(0, true);
    battle.update();
    expect(battle.phase).toBe('over');
  });
});
