import { describe, expect, it } from 'vitest';
import { findPath, generateLevel, isWall } from '../src/level';
import { itemWeights } from '../src/powerups';
import { Game } from '../src/game';
import { TILE } from '../src/themes';

const levels = Array.from({ length: 50 }, (_, i) => i + 1);

describe('level generation', () => {
  it.each(levels)('level %i is solvable and well formed', (n) => {
    const L = generateLevel(n, itemWeights({}, n));
    expect(findPath(L, L.start.x, L.start.y, L.exit.x, L.exit.y, 1e6)).not.toBeNull();
    const floor = (x: number, y: number) => !isWall(L, Math.floor(x / TILE), Math.floor(y / TILE));
    for (const g of L.guards) for (const p of g.route) expect(floor(p.x, p.y)).toBe(true);
    for (const it of L.items) expect(floor(it.x, it.y)).toBe(true);
    for (const d of L.dogs) expect(floor(d.home.x, d.home.y)).toBe(true);
    expect(L.items.some((i) => i.kind === 'rock')).toBe(true);
    expect(L.guards.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const a = generateLevel(17, itemWeights({}, 17));
    const b = generateLevel(17, itemWeights({}, 17));
    expect(Array.from(a.grid)).toEqual(Array.from(b.grid));
    expect(a.guards).toEqual(b.guards);
  });

  it('powerups change item odds but not the maze', () => {
    const a = generateLevel(20, itemWeights({}, 20));
    const b = generateLevel(20, itemWeights({ meat: 4, smoke: 4 }, 20));
    expect(Array.from(a.grid)).toEqual(Array.from(b.grid));
    expect(b.items.filter((i) => i.kind === 'smoke').length).toBeGreaterThan(0);
  });
});

describe('simulation', () => {
  it.each(levels)('level %i runs and Lenny is safe for the first seconds', (n) => {
    const g = new Game(n, {});
    for (let i = 0; i < 60 * 2; i++) g.update(1 / 60, { mx: 0, my: 0, action: false });
    expect(g.over).toBeNull();
    // keep running a while with random wandering; nothing should throw
    for (let i = 0; i < 60 * 20; i++) g.update(1 / 60, { mx: Math.sin(i / 40), my: Math.cos(i / 53), action: i % 90 === 0 });
  });

  it('a rock knocks out a guard', () => {
    const g = new Game(5, {});
    const gd = g.guards[0];
    g.p.x = gd.x - 60;
    g.p.y = gd.y + 8;
    g.p.held = 'rock';
    g.p.count = 1;
    g.p.ang = 0;
    gd.ang = 0; // facing away
    g.update(1 / 60, { mx: 0, my: 0, action: true });
    for (let i = 0; i < 30 && gd.state !== 'ko'; i++) g.update(1 / 60, { mx: 0, my: 0, action: false });
    expect(gd.state).toBe('ko');
  });

  it('reaching the exit completes the level', () => {
    const g = new Game(1, {});
    g.p.x = g.L.exit.x;
    g.p.y = g.L.exit.y;
    g.update(1 / 60, { mx: 0, my: 0, action: false });
    expect(g.over).toBe('complete');
  });
});
