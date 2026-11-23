import { describe, expect, it } from 'vitest';
import { Game, IDLE } from '../src/game';
import { normalizeCode, randomCode } from '../src/net';

describe('2 players', () => {
  it('moves each robber with their own controls', () => {
    const g = new Game(null);
    const p2 = g.addHero();
    expect(g.heroes.length).toBe(2);
    const start1 = { x: g.heroes[0].player.x, y: g.heroes[0].player.y };
    const start2 = { x: p2.player.x, y: p2.player.y };
    for (let i = 0; i < 20; i++) g.update(0.03, [IDLE, { ...IDLE, mx: -1, my: 0, mag: 1 }]);
    expect(g.heroes[0].player.x).toBeCloseTo(start1.x);
    expect(g.heroes[0].player.y).toBeCloseTo(start1.y);
    expect(Math.hypot(p2.player.x - start2.x, p2.player.y - start2.y)).toBeGreaterThan(0.5);
    expect(g.cur).toBe(g.heroes[0]); // the camera stays on player 1
  });

  it('takes both robbers into the bank and back out', () => {
    const g = new Game(null);
    const p2 = g.addHero();
    const m = g.city.map;
    const door = [...m.places].find(([, p]) => p === 'bank')![0];
    g.enterBank(door % m.w, Math.floor(door / m.w));
    expect(g.scene).toBe(g.bank);
    expect(Math.hypot(p2.player.x - g.player.x, p2.player.y - g.player.y)).toBeLessThan(1.5);
    g.leaveBank();
    expect(g.scene).toBe(g.city);
    g.removeHero(p2);
    expect(g.heroes.length).toBe(1);
  });

  it('shares the money', () => {
    const g = new Game(null);
    const p2 = g.addHero();
    g.money = 500;
    expect(g.as(p2, () => g.buy('screwdriver'))).toMatch(/Bought/);
    expect(g.money).toBe(400);
    expect(g.owned.has('screwdriver')).toBe(true);
  });

  it('makes 4 number join codes', () => {
    expect(randomCode()).toMatch(/^\d{4}$/);
    expect(normalizeCode(' 12-34 ')).toBe('1234');
    expect(normalizeCode('123')).toBeNull();
  });
});
