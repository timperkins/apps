import { describe, expect, it } from 'vitest';
import { HALF_VIEW, KID_HP, SECTIONS } from '../src/core/config';
import { randomLook, sanitizeLook } from '../src/core/look';
import { addPickup, removeKid, restart, spawnEnemy, type World } from '../src/core/sim';
import { makeSnapshot } from '../src/core/snapshot';
import { bot, run, world } from './helpers';

const walkRight = (w: World) => w.kids.forEach((k) => (k.input = { ...k.input, mx: 1, mz: 0 }));

describe('level flow', () => {
  it('starts the first stretch once the kids walk in, and spawns grown-ups', () => {
    const w = world(1);
    expect(w.phase).toBe('walk');
    run(w, 3, walkRight);
    expect(w.phase).toBe('fight');
    expect(w.camX).toBeCloseTo((SECTIONS[0].x0 + SECTIONS[0].x1) / 2);
    run(w, 1.5);
    expect(w.enemies.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps kids inside the screen', () => {
    const w = world(1);
    run(w, 10, walkRight);
    for (const k of w.kids) expect(Math.abs(k.x - w.camX)).toBeLessThanOrEqual(HALF_VIEW + 1e-6);
  });

  it('adds a grown-up per wave for each extra kid', () => {
    const one = world(1);
    const three = world(3);
    run(one, 3.5, walkRight);
    run(three, 3.5, walkRight);
    expect(three.enemies.length - one.enemies.length).toBe(2);
  });

  it('a bot team can finish the whole level', () => {
    const w = world(2, 7);
    for (const k of w.kids) k.hp = KID_HP;
    const frames = new Map<number, { n: number }>();
    let secs = 0;
    while (w.phase !== 'won' && w.phase !== 'lost' && secs < 900) {
      run(w, 1, (ww) => {
        for (const k of ww.kids) {
          if (!frames.has(k.id)) frames.set(k.id, { n: k.id });
          k.input = bot(ww, k, frames.get(k.id)!);
          // Keep the test about level flow, not about how good the bot is.
          if (k.state !== 'down') k.hp = Math.max(k.hp, 40);
        }
      });
      secs++;
    }
    expect(w.phase).toBe('won');
  });
});

describe('combat', () => {
  it('punching knocks out a grown-up, who then disappears', () => {
    const w = world(1);
    const k = w.kids[0];
    const e = spawnEnemy(w, 'watch', k.x + 0.9, k.z);
    e.state = 'walk';
    e.meleeCd = 99;
    e.throwCd = 99;
    let n = 0;
    run(w, 6, () => {
      n++;
      if (n % 20 === 0) k.input = { ...k.input, attack: k.input.attack + 1 };
      e.x = Math.max(e.x, k.x + 0.6);
    });
    expect(w.enemies.find((q) => q.id === e.id)).toBeUndefined();
    expect(k.score).toBeGreaterThan(0);
  });

  it('a knocked-out kid is revived by a friend standing nearby', () => {
    const w = world(2);
    const [a, b] = w.kids;
    a.hp = 1;
    a.invuln = 0;
    const e = spawnEnemy(w, 'dad', a.x + 1, a.z);
    e.state = 'windup';
    e.stateLen = 0;
    e.face = -1;
    run(w, 0.1);
    expect(a.state).toBe('down');
    w.enemies = [];
    b.x = a.x + 0.5;
    b.z = a.z;
    run(w, 3);
    expect(a.state).not.toBe('down');
    expect(a.hp).toBe(KID_HP / 2);
  });

  it('the game is lost when every kid is down', () => {
    const w = world(1);
    const k = w.kids[0];
    k.invuln = 0;
    k.hp = 1;
    const e = spawnEnemy(w, 'coach', k.x + 1, k.z);
    e.state = 'windup';
    e.stateLen = 0;
    e.face = -1;
    run(w, 0.1);
    expect(w.phase).toBe('lost');
  });

  it('picking up a bat and swinging it uses it up', () => {
    const w = world(1);
    const k = w.kids[0];
    addPickup(w, 'bat', k.x, k.z);
    run(w, 0.5);
    k.input = { ...k.input, grab: 1 };
    run(w, 0.1);
    expect(k.held?.kind).toBe('bat');
    const e = spawnEnemy(w, 'boss', k.x + 1.2, k.z);
    e.state = 'walk';
    e.meleeCd = 99;
    e.throwCd = 99;
    const before = k.held!.uses;
    k.input = { ...k.input, attack: 1 };
    run(w, 0.6);
    expect(k.held?.uses ?? 0).toBe(before - 1);
  });

  it('snacks heal instead of being held', () => {
    const w = world(1);
    const k = w.kids[0];
    k.hp = 30;
    addPickup(w, 'pizza', k.x, k.z);
    run(w, 0.5);
    k.input = { ...k.input, grab: 1 };
    run(w, 0.1);
    expect(k.hp).toBe(80);
    expect(k.held).toBeNull();
  });

  it('thrown items fly and hit', () => {
    const w = world(1);
    const k = w.kids[0];
    k.held = { kind: 'balloons', uses: 3 };
    const e = spawnEnemy(w, 'lunch', k.x + 4, k.z);
    e.state = 'walk';
    e.meleeCd = 99;
    e.throwCd = 99;
    const hp = e.hp;
    k.input = { ...k.input, grab: 1 };
    run(w, 0.8);
    expect(e.hp).toBeLessThan(hp);
    expect(k.held?.uses).toBe(2);
  });
});

describe('players coming and going', () => {
  it('removing a kid drops what they held', () => {
    const w = world(2);
    const k = w.kids[1];
    k.held = { kind: 'skateboard', uses: 4 };
    const n = w.pickups.length;
    removeKid(w, k.id);
    expect(w.kids.length).toBe(1);
    expect(w.pickups.length).toBe(n + 1);
  });

  it('restart keeps the same kids and ids', () => {
    const w = world(3);
    const ids = w.kids.map((k) => k.id);
    run(w, 5, walkRight);
    restart(w);
    expect(w.kids.map((k) => k.id)).toEqual(ids);
    expect(w.phase).toBe('walk');
    expect(w.enemies.length).toBe(0);
  });

  it('cleans up looks from the network', () => {
    const l = sanitizeLook({ ...randomLook(), name: 'bobby<script>', hair: 'evil', skin: 'red' });
    expect(l.name).toBe('BOBBYSCR');
    expect(l.hair).not.toBe('evil');
    expect(l.skin).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('snapshots survive JSON', () => {
    const w = world(2);
    run(w, 4, walkRight);
    const s = makeSnapshot(w, w.events);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
