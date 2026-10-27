import { describe, expect, it } from 'vitest';
import { MIN_MASS, SPACING, START_MASS, WORLD_W, lengthFor } from './constants';
import type { Look } from './looks';
import { pickWinner, ranking, World, type Snake, type SnakeInput } from './world';

const LOOK: Look = { name: 'A', color: '#ff5a5f', pattern: 'solid' };

// A world with no food and snakes placed by hand.
function emptyWorld(): World {
  const world = new World(1);
  world.food = [];
  world.foodTarget = 0;
  return world;
}

function place(snake: Snake, x: number, y: number, heading: number, mass = START_MASS): void {
  snake.mass = mass;
  snake.heading = heading;
  snake.protectedUntil = 0;
  const count = Math.ceil(lengthFor(mass) / SPACING) + 1;
  snake.points = Array.from({ length: count }, (_, i) => ({
    x: x - Math.cos(heading) * SPACING * i,
    y: y - Math.sin(heading) * SPACING * i,
  }));
}

const steps = (world: World, n: number, inputs = new Map<string, SnakeInput>()) => {
  const events = [];
  for (let i = 0; i < n; i++) events.push(...world.step(1 / 60, inputs));
  return events;
};

describe('World', () => {
  it('wraps a snake off the right edge back onto the left', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    place(a, WORLD_W - 2, 300, 0);
    steps(world, 3);
    expect(a.points[0].x).toBeLessThan(10);
    expect(a.alive).toBe(true);
  });

  it('grows when it eats', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    place(a, 400, 300, 0);
    world.addFood(420, 300, 3, '#fff', false);
    const events = steps(world, 20);
    expect(events.some((e) => e.type === 'eat' && e.id === 'a')).toBe(true);
    expect(a.mass).toBeCloseTo(START_MASS + 3);
  });

  it('kills a snake whose head hits another body and drops food', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    const b = world.addSnake('b', { ...LOOK, color: '#3ddc84' }, false);
    // b lies across a's path, heading down.
    place(b, 500, 400, Math.PI / 2, 60);
    place(a, 440, 300, 0);
    const events = steps(world, 40);
    const death = events.find((e) => e.type === 'death');
    expect(death).toMatchObject({ id: 'a', by: 'b' });
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(true);
    expect(b.kills).toBe(1);
    const dropped = world.food.reduce((sum, f) => sum + f.value, 0);
    expect(dropped).toBeGreaterThan(START_MASS * 0.7);
  });

  it('kills both snakes in a head-on crash', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    const b = world.addSnake('b', LOOK, false);
    place(a, 400, 300, 0);
    place(b, 460, 300, Math.PI);
    steps(world, 30);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
  });

  it('never kills a snake that touches its own body', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    place(a, 400, 300, 0, 200);
    steps(world, 240, new Map([['a', { s: 1, boost: false }]]));
    expect(a.alive).toBe(true);
  });

  it('leaves protected snakes alone', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    const b = world.addSnake('b', LOOK, false);
    place(b, 500, 400, Math.PI / 2, 60);
    place(a, 440, 300, 0);
    a.protectedUntil = Infinity;
    steps(world, 40);
    expect(a.alive).toBe(true);
  });

  it('respawns a dead snake at starting size', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    world.kill(a, null, []);
    steps(world, 60 * 3 + 5);
    expect(a.alive).toBe(true);
    expect(a.mass).toBe(START_MASS);
  });

  it('boosts faster, spends mass, and stops at the minimum size', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    const b = world.addSnake('b', LOOK, false);
    place(a, 100, 100, 0);
    place(b, 100, 600, 0);
    const before = { a: a.points[0].x, b: b.points[0].x };
    steps(
      world,
      10,
      new Map([
        ['a', { s: 0, boost: true }],
        ['b', { s: 0, boost: false }],
      ]),
    );
    expect(a.points[0].x - before.a).toBeGreaterThan(1.8 * (b.points[0].x - before.b));
    steps(world, 120, new Map([['a', { s: 0, boost: true }]]));
    expect(a.mass).toBe(MIN_MASS);
    expect(a.boosting).toBe(false);
    // Most of the spent mass was dropped behind as food.
    expect(world.food.length).toBeGreaterThan(0);
  });

  it('picks the biggest living snake as the winner', () => {
    const world = emptyWorld();
    const a = world.addSnake('a', LOOK, false);
    const b = world.addSnake('b', LOOK, false);
    const c = world.addSnake('c', LOOK, false);
    a.mass = 50;
    b.mass = 80;
    c.mass = 200;
    c.alive = false;
    expect(pickWinner(world.snakes)?.id).toBe('b');
    expect(ranking(world.snakes).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });
});
