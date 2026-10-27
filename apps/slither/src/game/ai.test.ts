import { describe, expect, it } from 'vitest';
import { SPACING, lengthFor } from './constants';
import { Brain, dangerAlong } from './ai';
import { World, type Snake, type SnakeInput } from './world';

const LOOK = { name: 'Bot', color: '#3fa7ff', pattern: 'solid' as const };

function place(snake: Snake, x: number, y: number, heading: number, mass: number): void {
  snake.mass = mass;
  snake.heading = heading;
  snake.protectedUntil = 0;
  const count = Math.ceil(lengthFor(mass) / SPACING) + 1;
  snake.points = Array.from({ length: count }, (_, i) => ({
    x: x - Math.cos(heading) * SPACING * i,
    y: y - Math.sin(heading) * SPACING * i,
  }));
}

describe('Brain', () => {
  it('sees a body straight ahead as danger', () => {
    const world = new World(2);
    world.food = [];
    world.foodTarget = 0;
    const bot = world.addSnake('bot', LOOK, true);
    const wall = world.addSnake('wall', LOOK, false);
    place(wall, 500, 500, Math.PI / 2, 150);
    place(bot, 420, 300, 0, 12);
    world.step(1 / 60, new Map());
    expect(dangerAlong(world, bot, 0, 130)).toBeGreaterThan(0);
    expect(dangerAlong(world, bot, -Math.PI / 2, 130)).toBe(0);
  });

  it('heads for food', () => {
    const world = new World(3);
    world.food = [];
    world.foodTarget = 0;
    const bot = world.addSnake('bot', LOOK, true);
    place(bot, 300, 300, 0, 12);
    world.addFood(420, 420, 4, '#fff', false);
    const brain = new Brain('hard');
    const input = brain.decide(world, bot);
    expect(input.s).toBeGreaterThan(0);
  });

  it('keeps hard bots alive among other bots for a while', () => {
    const world = new World(4);
    const brains = new Map<string, Brain>();
    for (let i = 0; i < 6; i++) {
      world.addSnake(`b${i}`, { ...LOOK, name: `b${i}` }, true);
      brains.set(`b${i}`, new Brain('hard'));
    }
    let deaths = 0;
    for (let step = 0; step < 60 * 20; step++) {
      const inputs = new Map<string, SnakeInput>();
      for (const s of world.snakes) inputs.set(s.id, brains.get(s.id)!.decide(world, s));
      deaths += world.step(1 / 60, inputs).filter((e) => e.type === 'death').length;
    }
    // Six bots for 20 seconds in a small arena: some crashes are fine, constant crashing is not.
    expect(deaths).toBeLessThan(12);
    expect(Math.max(...world.snakes.map((s) => s.best))).toBeGreaterThan(20);
  });
});
