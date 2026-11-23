import { describe, expect, it } from 'vitest';
import * as K from './constants';
import { World, fishLen, mouthOf, rodTip, teamTotals } from './world';

const none = new Map();

function quietWorld(): World {
  const w = new World(() => 0.5);
  w.npcTarget = 0;
  w.fillNpcs(true);
  return w;
}

describe('swimmers', () => {
  it('a bigger fish eats a smaller one and grows', () => {
    const w = quietWorld();
    const big = w.addSwimmer('a', 'A', '#ff4f4f', 'fish');
    const small = w.addSwimmer('b', 'B', '#ffd23f', 'fish');
    big.level = 5;
    big.safeUntil = small.safeUntil = 0;
    big.dir = 1;
    big.x = 200;
    big.y = 200;
    const m = mouthOf(big);
    small.x = m.x;
    small.y = m.y;
    const events = w.step(K.STEP, none, none);
    expect(events.some((e) => e.type === 'eat' && e.by === 'a' && e.victim === 'b')).toBe(true);
    expect(small.alive).toBe(false);
    expect(big.score).toBeGreaterThan(0);
  });

  it('a fish that is not 25% bigger cannot eat', () => {
    const w = quietWorld();
    const a = w.addSwimmer('a', 'A', '#ff4f4f', 'fish');
    const b = w.addSwimmer('b', 'B', '#ffd23f', 'fish');
    a.safeUntil = b.safeUntil = 0;
    a.x = 200;
    a.y = 200;
    b.x = mouthOf(a).x;
    b.y = mouthOf(a).y;
    w.step(K.STEP, none, none);
    expect(b.alive).toBe(true);
  });

  it('levels up after enough food, and size grows with level', () => {
    const w = quietWorld();
    const f = w.addSwimmer('a', 'A', '#ff4f4f', 'fish');
    w.feed(f, K.foodToLevel(1) + K.foodToLevel(2));
    expect(f.level).toBe(3);
    expect(fishLen(f)).toBeGreaterThan(K.fishLength(1));
  });

  it('only a clownfish can taunt', () => {
    const w = quietWorld();
    const fish = w.addSwimmer('a', 'A', '#ff4f4f', 'fish');
    const clown = w.addSwimmer('b', 'B', '#ffd23f', 'clown');
    w.taunt('a');
    w.taunt('b');
    expect(fish.tauntUntil).toBe(0);
    expect(clown.tauntUntil).toBeGreaterThan(w.time);
  });

  it('eggs hatch into babies that feed their parent', () => {
    const w = quietWorld();
    const f = w.addSwimmer('a', 'A', '#ff4f4f', 'fish');
    f.safeUntil = Infinity;
    w.layEgg('a');
    expect(w.eggs.length).toBe(1);
    for (let t = 0; t < K.EGG_HATCH_S + K.BABY_FEED_S + 0.5; t += K.STEP) w.step(K.STEP, none, none);
    expect(w.fish.filter((x) => x.baby).length).toBe(K.BABIES_PER_EGG);
    expect(f.food + f.level).toBeGreaterThan(1);
  });
});

describe('raiders', () => {
  it('boats steer and never overlap', () => {
    const w = quietWorld();
    const a = w.addRaider('r1', 'R1', '#ff4f4f');
    const b = w.addRaider('r2', 'R2', '#45e3ff');
    a.x = 200;
    b.x = 260;
    const inputs = new Map([
      ['r1', { x: 1, reel: false }],
      ['r2', { x: -1, reel: false }],
    ]);
    for (let i = 0; i < 120; i++) w.step(K.STEP, none, inputs);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(K.BOAT_GAP - 0.01);
  });

  it('a hooked computer fish is landed when the Raider reels', () => {
    const w = new World(() => 0.99);
    w.npcTarget = 0;
    const boat = w.addRaider('r', 'R', '#ff4f4f');
    w.npcTarget = 1;
    w.fillNpcs(true);
    const fish = w.fish[0];
    w.cast('r');
    expect(boat.hook.state).toBe('down');
    w.step(K.STEP, none, none);
    fish.dir = 1;
    fish.level = 1;
    const len = fishLen(fish);
    fish.x = boat.hook.x - len * 0.45;
    fish.y = boat.hook.y;
    fish.tx = fish.x;
    fish.ty = fish.y;
    w.step(K.STEP, none, none);
    expect(boat.hook.state).toBe('fight');
    let landed = false;
    for (let i = 0; i < 60 * 15 && !landed; i++) {
      if (i % 8 === 0) w.reelTap('r', i % 32 === 0);
      landed = w.step(K.STEP, none, none).some((e) => e.type === 'catch');
    }
    expect(landed).toBe(true);
    expect(boat.score).toBeGreaterThan(0);
    expect(boat.meat + boat.coins).toBeGreaterThan(0);
  });

  it('a Swimmer who pulls hard enough escapes', () => {
    const w = quietWorld();
    const boat = w.addRaider('r', 'R', '#ff4f4f');
    const f = w.addSwimmer('s', 'S', '#ffd23f', 'fish');
    f.safeUntil = 0;
    w.cast('r');
    w.step(K.STEP, none, none);
    f.dir = 1;
    f.x = boat.hook.x - fishLen(f) * 0.45;
    f.y = boat.hook.y - fishLen(f) * 0.06;
    w.step(K.STEP, none, none);
    expect(f.hookedBy).toBe('r');
    w.thrash('s');
    let escaped = false;
    for (let i = 0; i < 600 && !escaped; i++) {
      if (i % 6 === 0) w.pullTap('s');
      escaped = w.step(K.STEP, none, none).some((e) => e.type === 'escape');
    }
    expect(escaped).toBe(true);
    expect(f.alive).toBe(true);
  });

  it('fish ram a boat until it sinks, and it comes back after 8 seconds', () => {
    const w = quietWorld();
    const boat = w.addRaider('r', 'R', '#ff4f4f');
    const f = w.addSwimmer('s', 'S', '#ffd23f', 'fish');
    f.level = 10;
    let sunk = false;
    for (let i = 0; i < 60 * 30 && !sunk; i++) {
      f.x = boat.x;
      f.y = K.SURF + 8;
      sunk = w.step(K.STEP, none, none).some((e) => e.type === 'sink');
    }
    expect(sunk).toBe(true);
    expect(f.score).toBeGreaterThanOrEqual(K.SINK_SCORE);
    f.y = 250;
    for (let t = 0; t < K.BOAT_RESPAWN_S + 0.1; t += K.STEP) {
      f.y = 250;
      w.step(K.STEP, none, none);
    }
    expect(boat.sunk).toBe(false);
    expect(boat.health).toBe(K.BOAT_HEALTH);
  });

  it('Gristle Pete buys meat one tap at a time', () => {
    const w = quietWorld();
    const boat = w.addRaider('r', 'R', '#ff4f4f');
    boat.meat = 2;
    w.sell('r');
    expect(boat.meat).toBe(2);
    for (let t = 0; t < K.PETE_FIRST_S + 0.1; t += K.STEP) w.step(K.STEP, none, none);
    expect(w.peteHere).toBe(true);
    w.sell('r');
    w.sell('r');
    w.sell('r');
    expect(boat.meat).toBe(0);
    expect(boat.coins).toBe(2 * K.MEAT_PRICE);
  });

  it('the rod tip is on the side the boat faces', () => {
    const w = quietWorld();
    const b = w.addRaider('r', 'R', '#ff4f4f');
    b.dir = -1;
    expect(rodTip(b).x).toBeLessThan(b.x);
  });
});

describe('teams', () => {
  it('scales the Crew total by the Swimmer to Raider ratio', () => {
    const w = quietWorld();
    const b = w.addRaider('r', 'R', '#ff4f4f');
    w.addSwimmer('s1', 'S', '#ffd23f', 'fish');
    w.addSwimmer('s2', 'T', '#45e3ff', 'fish');
    b.score = 100;
    expect(teamTotals(w).crew).toBe(200);
  });
});
