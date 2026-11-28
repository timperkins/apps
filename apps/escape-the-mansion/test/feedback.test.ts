import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { generateLevel } from '../src/level';
import { itemWeights } from '../src/powerups';
import { trackForLevel } from '../src/audio';
import { freshLine, JEFF_CAMEO } from '../src/story';
import { lennyPose, lennyStage } from '../src/sprites';
import { Bonus } from '../src/bonus';

describe('feedback round 1', () => {
  it('plays the right music per level', () => {
    expect([1, 5, 6, 14, 15, 25, 26, 36, 37, 49, 50].map(trackForLevel)).toEqual(['main', 'main', 'loop', 'loop', 'hall', 'hall', 'manor', 'manor', 'loop', 'loop', 'main']);
  });

  it('keeps Lenny terrified until level 20, then changes step by step', () => {
    expect(lennyStage(1)).toBe(0);
    expect(lennyStage(20)).toBe(0);
    expect(lennyStage(21)).toBe(1);
    expect(lennyStage(50)).toBe(6);
    expect(lennyPose(10)).toBe(0);
    expect(lennyPose(25)).toBe(0);
    expect(lennyPose(50)).toBe(2);
  });

  it('adds armoured guards only after level 35', () => {
    for (let n = 1; n <= 35; n++) expect(generateLevel(n, itemWeights({}, n)).guards.some((g) => g.armored)).toBe(false);
    const late = Array.from({ length: 15 }, (_, i) => generateLevel(36 + i, itemWeights({}, 36 + i)));
    expect(late.some((L) => L.guards.some((g) => g.armored))).toBe(true);
  });

  it('a rock only staggers an armoured guard', () => {
    const lvl = Array.from({ length: 15 }, (_, i) => 36 + i).find((n) => generateLevel(n, itemWeights({}, n)).guards.some((g) => g.armored))!;
    const g = new Game(lvl, {});
    const k = g.guards.find((x) => x.armored)!;
    g.p.x = g.L.start.x;
    g.p.y = g.L.start.y;
    g.projs.push({ x: k.x - 20, y: k.y - 10, vx: 400, vy: 0, kind: 'rock', dist: 0, max: 200, z: 0, spin: 0 });
    g.update(1 / 60, { mx: 0, my: 0, action: false });
    expect(k.state).toBe('ko');
    expect(k.ko).toBeLessThan(2);
  });

  it("doesn't repeat Jeff's lines until the pool runs out", () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
    const pool = JEFF_CAMEO[0];
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) seen.add(freshLine(pool, 'test'));
    expect(seen.size).toBe(pool.length);
    expect(JEFF_CAMEO.flat().length).toBeGreaterThan(90);
  });

  it('the getaway bonus can be finished', () => {
    const b = new Bonus();
    let done = false;
    for (let i = 0; i < 60 * 120 && !done; i++) {
      b.update(1 / 60, { mx: Math.max(-1, Math.min(1, (roadCentre(b) - b.x) / 30)), my: 1, action: i % 120 === 0 });
      done = b.events.some((e) => e.type === 'done');
    }
    expect(done).toBe(true);
  });
});

import { roadX } from '../src/bonus';
function roadCentre(b: Bonus) {
  return roadX(b.y + 60);
}
