import { describe, expect, it } from 'vitest';
import { gapBetween, step, type Body } from './physics';
import { arc, laneOffset, pointAt, shifted } from './curves';
import { ANIMATION_SECONDS, EVENT_PAUSE, FLIGHT_SECONDS, MOVE_PAUSE, Player } from './player';
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
      worst = Math.max(worst, a.r + b.r + gapBetween(a, b) - Math.hypot(a.x - b.x, a.y - b.y));
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

  it('makes room for someone landing without flinging anyone', () => {
    const bodies = Array.from({ length: 8 }, (_, i) => body(`p${i}`, 400 + i, 300 + (i % 3), `f${i}`));
    for (const b of bodies) [b.ax, b.ay] = [400, 300];
    for (let frame = 0; frame < 600; frame++) step(bodies, 1 / 60);
    const lander = { ...body('new', 100, 300), ax: 100, ay: 300, flying: true, ghost: true };
    let fastest = 0;
    for (let frame = 0; frame < 300; frame++) {
      const s = Math.min(1, frame / 144);
      lander.ax = 100 + 300 * (s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) ** 2);
      lander.flying = s < 0.85;
      lander.ghost = s < 0.6;
      step([...bodies, lander], 1 / 60);
      for (const b of bodies) fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
    }
    // Before, neighbors shot off at well over 1000 px/s and sprang back.
    expect(fastest).toBeLessThan(250);
  });

  it('comes to rest when a crowd is pressed around one spot', () => {
    const bodies = Array.from({ length: 31 }, (_, i) => body(`p${i}`, 400 + (i % 5), 300 + (i % 7), `f${i % 9}`, i < 17 ? 22 : 13));
    for (const b of bodies) {
      b.ax = 400;
      b.ay = 300;
    }
    for (let frame = 0; frame < 600; frame++) step(bodies, 1 / 60);
    const before = bodies.map((b) => [b.x, b.y]);
    for (let frame = 0; frame < 60; frame++) step(bodies, 1 / 60);
    const drift = Math.max(...bodies.map((b, i) => Math.hypot(b.x - before[i][0], b.y - before[i][1])));
    expect(drift).toBeLessThan(0.05);
  });

  it('keeps family members touching and other families a little apart', () => {
    expect(gapBetween(body('a', 0, 0, 'f'), body('b', 0, 0, 'f'))).toBeLessThan(gapBetween(body('a', 0, 0, 'f'), body('c', 0, 0, 'g')));
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
    { id: '2', type: 'move', date: '2000-03', people: ['a'], place: { name: 'Y', lat: 10, lng: 10 } },
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

  it('stops on every event until its animation is done, then 3 more seconds (1 for moves)', () => {
    const p = new Player(tl);
    p.play();
    expect(p.advance(10).map((e) => e.event.id)).toEqual(['1']);
    const born = p.t;
    p.advance(ANIMATION_SECONDS.birth + EVENT_PAUSE - 0.1);
    expect(p.t).toBe(born);
    // Time resumes and stops again at the move.
    expect(p.advance(10).map((e) => e.event.id)).toEqual(['2']);
    const moved = p.t;
    p.advance(FLIGHT_SECONDS + MOVE_PAUSE - 0.1);
    expect(p.t).toBe(moved);
    p.advance(0.5);
    expect(p.t).toBeGreaterThan(moved);
  });

  it("doesn't stop for events it is told to skip", () => {
    const p = new Player(tl);
    p.skip = (e) => e.event.id === '1';
    p.play();
    expect(p.advance(10).map((e) => e.event.id)).toEqual(['1', '2']);
  });

  it("doesn't stop for moves under 500 miles", () => {
    const hops: LifeEvent[] = [
      { id: '1', type: 'birth', date: '2000-01', people: ['a'], place: { name: 'X', lat: 0, lng: 0 } },
      { id: '2', type: 'move', date: '2000-03', people: ['a'], place: { name: 'Near', lat: 5, lng: 0 } },
      { id: '3', type: 'move', date: '2000-05', people: ['a'], place: { name: 'Far', lat: 15, lng: 0 } },
    ];
    const short = new Timeline(people, hops, monthIndex('2002-01'));
    expect(short.moveMiles('2')).toBeCloseTo(345, 0);
    const p = new Player(short);
    p.seek(monthIndex('2000-02'));
    p.play();
    // Time runs straight through the 345-mile move and stops at the 690-mile one.
    expect(p.advance(10).map((e) => e.event.id)).toEqual(['2', '3']);
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
