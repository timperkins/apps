import { describe, expect, it } from 'vitest';
import { Bot } from './bot';
import * as K from './constants';
import { seeded } from '../render/pix';
import { World, type BoatInput, type FishInput, type WorldEvent } from './world';

function run(world: World, bots: Bot[], seconds: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let i = 0; i < seconds / K.STEP; i++) {
    const fish = new Map<string, FishInput>();
    const boats = new Map<string, BoatInput>();
    for (const b of bots) {
      const out = b.step(world);
      if (world.boat(b.id)) boats.set(b.id, { x: out.x, reel: out.hold });
      else fish.set(b.id, { x: out.x, y: out.y });
      for (const a of out.acts) {
        if (a === 'cast') world.cast(b.id);
        else if (a === 'tap' || a === 'heave') world.reelTap(b.id, a === 'heave');
        else if (a === 'pull') world.pullTap(b.id);
        else if (a === 'dash') world.dash(b.id);
      }
    }
    events.push(...world.step(K.STEP, fish, boats));
  }
  return events;
}

describe('easy bots', () => {
  it('a boat bot sails, casts and lands fish', () => {
    const w = new World(seeded(3));
    w.reset();
    w.addRaider('b', 'Bot', '#ff4f4f');
    const events = run(w, [new Bot('b', seeded(5))], 120);
    expect(events.some((e) => e.type === 'cast')).toBe(true);
    expect(events.some((e) => e.type === 'catch')).toBe(true);
  });

  it('a fish bot swims and eats', () => {
    const w = new World(seeded(4));
    w.reset();
    w.addSwimmer('f', 'Bot', '#45e3ff', 'fish');
    const start = { ...w.get('f')! };
    const events = run(w, [new Bot('f', seeded(6))], 60);
    const f = w.get('f')!;
    expect(Math.hypot(f.x - start.x, f.y - start.y)).toBeGreaterThan(10);
    expect(events.some((e) => e.type === 'eat' && e.by === 'f')).toBe(true);
  });
});
