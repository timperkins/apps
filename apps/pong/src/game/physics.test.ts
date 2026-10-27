import { describe, expect, it } from 'vitest';
import { BALL_SIZE, FIELD_H, FIELD_W, MAX_BOUNCE_ANGLE, PADDLE_H, SERVE_DELAY, STEP, WIN_SCORE } from './constants';
import { bounceAngle, inputToPaddle, newGame, paddleX, step, type GameState } from './physics';

function playing(): GameState {
  const s = newGame(0);
  s.serveIn = 0;
  return s;
}

describe('inputToPaddle', () => {
  it('keeps the paddle fully on screen', () => {
    expect(inputToPaddle(0)).toBe(PADDLE_H / 2);
    expect(inputToPaddle(1)).toBe(FIELD_H - PADDLE_H / 2);
    expect(inputToPaddle(-3)).toBe(PADDLE_H / 2);
    expect(inputToPaddle(0.5)).toBe(FIELD_H / 2);
  });
});

describe('bounceAngle', () => {
  it('is symmetric and steepest at the edges', () => {
    expect(bounceAngle(100, 100)).toBeCloseTo(MAX_BOUNCE_ANGLE / 8);
    expect(bounceAngle(100 + PADDLE_H, 100)).toBeCloseTo((MAX_BOUNCE_ANGLE * 7) / 8);
    expect(bounceAngle(100 - PADDLE_H, 100)).toBeCloseTo((-MAX_BOUNCE_ANGLE * 7) / 8);
  });
});

describe('step', () => {
  it('serves after the delay', () => {
    const s = newGame(1);
    for (let t = 0; t < SERVE_DELAY + STEP; t += STEP) step(s, STEP, () => 0.5);
    expect(s.ball.vx).toBeGreaterThan(0);
  });

  it('bounces off the top wall', () => {
    const s = playing();
    s.ball = { x: 150, y: 1, vx: 0, vy: -120, speed: 120 };
    const events = step(s, STEP);
    expect(events).toContainEqual({ type: 'wall' });
    expect(s.ball.vy).toBeGreaterThan(0);
    expect(s.ball.y).toBeGreaterThanOrEqual(0);
  });

  it('returns a ball that hits the left paddle and speeds it up', () => {
    const s = playing();
    s.paddles[0] = 120;
    s.ball = { x: paddleX(0) + 6, y: 120 - BALL_SIZE / 2, vx: -300, vy: 0, speed: 300 };
    const events = step(s, STEP);
    expect(events).toContainEqual({ type: 'paddle', side: 0 });
    expect(s.ball.vx).toBeGreaterThan(0);
    expect(s.ball.speed).toBeGreaterThan(300);
  });

  it('does not let a very fast ball tunnel through the paddle', () => {
    const s = playing();
    s.paddles[1] = 120;
    s.ball = { x: paddleX(1) - 10, y: 118, vx: 2000, vy: 0, speed: 2000 };
    const events = step(s, STEP);
    expect(events).toContainEqual({ type: 'paddle', side: 1 });
    expect(s.ball.vx).toBeLessThan(0);
  });

  it('scores when the paddle misses, and serves to the player who conceded', () => {
    const s = playing();
    s.paddles[1] = 20;
    s.ball = { x: FIELD_W - 2, y: 200, vx: 300, vy: 0, speed: 300 };
    const events = step(s, STEP);
    expect(events).toContainEqual({ type: 'score', side: 0 });
    expect(s.score).toEqual([1, 0]);
    expect(s.serveTo).toBe(1);
    expect(s.serveIn).toBe(SERVE_DELAY);
  });

  it('ends the game at the winning score', () => {
    const s = playing();
    s.score = [WIN_SCORE - 1, 3];
    s.paddles[1] = 20;
    s.ball = { x: FIELD_W - 2, y: 200, vx: 300, vy: 0, speed: 300 };
    const events = step(s, STEP);
    expect(events).toContainEqual({ type: 'win', side: 0 });
    expect(s.winner).toBe(0);
    expect(step(s, STEP)).toEqual([]);
  });
});
