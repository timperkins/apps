import { describe, expect, it } from 'vitest';
import { GAP, step, type Body } from './physics';
import { arc, laneOffset, pointAt, shifted } from './curves';
import { Player } from './player';
import { Timeline } from '../engine/timeline';
import { monthIndex } from '../engine/time';
import type { LifeEvent, Person } from '../data/types';

function body(id: string, x: number, y: number, family = id, r = 22): Body {
  return { id, x, y, vx: 0, vy: 0, r, ax: x, ay: y, family, flying: false, active: true };
}

function overlaps(bodies: Body[]): number {
  let worst = 0;
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      worst = Math.max(worst, a.r + b.r + GAP - Math.hypot(a.x - b.x, a.y - b.y));
    }
  return worst;
}

describe('physics', () => {
  it('never leaves bubbles overlapping, even when everyone is in one city', () => {
    const bodies = Array.from({ length: 30 }, (_, i) => body(`p${i}`, 400, 300, `f${i % 10}`, i % 3 ? 22 : 13));
    for (let frame = 0; frame < 240; frame++) {
      step(bodies, 1 / 60);
      expect(overlaps(bodies)).toBeLessThan(0.5);
    }
  });

  it('settles near the anchor when alone, after a little bounce', () => {
    const b = body('a', 0, 0);
    b.ax = 100;
    let maxX = 0;
    for (let frame = 0; frame < 300; frame++) {
      step([b], 1 / 60);
      maxX = Math.max(maxX, b.x);
    }
    expect(maxX).toBeGreaterThan(100); // overshoots
    expect(Math.abs(b.x - 100)).toBeLessThan(0.5);
  });
});

describe('curves', () => {
  it('arcs upward and passes through both ends', () => {
    const a = arc({ x: 0, y: 200 }, { x: 400, y: 200 });
    expect(pointAt(a, 0)).toEqual({ x: 0, y: 200 });
    expect(pointAt(a, 1)).toEqual({ x: 400, y: 200 });
    expect(pointAt(a, 0.5).y).toBeLessThan(200);
  });

  it('puts couple lanes side by side', () => {
    const a = arc({ x: 0, y: 200 }, { x: 400, y: 200 });
    const left = shifted(a, laneOffset(0, 2, 4));
    const right = shifted(a, laneOffset(1, 2, 4));
    expect(Math.abs(pointAt(left, 0.5).y - pointAt(right, 0.5).y)).toBeCloseTo(4);
  });
});

describe('Player', () => {
  const people: Person[] = [{ id: 'a', name: 'A', kind: 'friend', color: '#E5484D', photo: '', order: 0 }];
  const events: LifeEvent[] = [
    { id: '1', type: 'birth', date: '2000-01', people: ['a'], place: { name: 'X', lat: 0, lng: 0 } },
    { id: '2', type: 'move', date: '2000-03', people: ['a'], place: { name: 'Y', lat: 1, lng: 1 } },
  ];
  const tl = new Timeline(people, events, monthIndex('2002-01'));

  it('plays 6 seconds per year by default', () => {
    const p = new Player(tl);
    p.pauseForEvents = false;
    p.seek(monthIndex('2000-06'));
    p.play();
    p.advance(3);
    expect(p.t).toBeCloseTo(monthIndex('2000-06') + 6);
  });

  it('holds on births and marriages when asked to', () => {
    const p = new Player(tl);
    p.play();
    const crossed = p.advance(10);
    expect(crossed.map((e) => e.event.id)).toEqual(['1']);
    const t = p.t;
    p.advance(1);
    expect(p.t).toBe(t);
    p.advance(1);
    expect(p.t).toBeGreaterThan(t);
  });

  it('stops at the end', () => {
    const p = new Player(tl);
    p.pauseForEvents = false;
    p.play();
    p.advance(1000);
    expect(p.t).toBe(tl.end);
    expect(p.playing).toBe(false);
  });
});
