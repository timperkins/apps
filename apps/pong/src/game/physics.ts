import {
  BALL_MAX_SPEED,
  BALL_SIZE,
  BALL_SPEEDUP,
  BALL_START_SPEED,
  FIELD_H,
  FIELD_W,
  MAX_BOUNCE_ANGLE,
  PADDLE_H,
  PADDLE_INSET,
  PADDLE_W,
  PADDLE_ZONES,
  SERVE_DELAY,
  WIN_SCORE,
} from './constants';

export type Side = 0 | 1;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
}

export interface GameState {
  // Paddle centres in pixels; index 0 is the left player.
  paddles: [number, number];
  ball: Ball;
  score: [number, number];
  // Seconds until the next serve; the ball waits at centre while this is positive.
  serveIn: number;
  serveTo: Side;
  winner: Side | null;
}

export type GameEvent = { type: 'paddle'; side: Side } | { type: 'wall' } | { type: 'score'; side: Side } | { type: 'win'; side: Side };

export function paddleX(side: Side): number {
  return side === 0 ? PADDLE_INSET : FIELD_W - PADDLE_INSET - PADDLE_W;
}

// Maps controller input (0 = top, 1 = bottom) to a paddle centre that stays on screen.
export function inputToPaddle(y: number): number {
  const clamped = Math.min(1, Math.max(0, y));
  return PADDLE_H / 2 + clamped * (FIELD_H - PADDLE_H);
}

function centredBall(): Ball {
  return { x: (FIELD_W - BALL_SIZE) / 2, y: (FIELD_H - BALL_SIZE) / 2, vx: 0, vy: 0, speed: 0 };
}

export function newGame(serveTo: Side = Math.random() < 0.5 ? 0 : 1): GameState {
  return {
    paddles: [FIELD_H / 2, FIELD_H / 2],
    ball: centredBall(),
    score: [0, 0],
    serveIn: SERVE_DELAY,
    serveTo,
    winner: null,
  };
}

export function serve(state: GameState, rand: () => number = Math.random): void {
  const angle = (rand() - 0.5) * (Math.PI / 3);
  const dir = state.serveTo === 0 ? -1 : 1;
  state.ball = centredBall();
  state.ball.y = BALL_SIZE + rand() * (FIELD_H - 3 * BALL_SIZE);
  state.ball.speed = BALL_START_SPEED;
  state.ball.vx = Math.cos(angle) * BALL_START_SPEED * dir;
  state.ball.vy = Math.sin(angle) * BALL_START_SPEED;
}

// Bounce angle from where the ball hit the paddle, quantised into zones like the original.
export function bounceAngle(ballCentre: number, paddleCentre: number): number {
  const offset = (ballCentre - paddleCentre) / (PADDLE_H / 2 + BALL_SIZE / 2);
  const clamped = Math.min(1, Math.max(-1, offset));
  const zone = Math.min(PADDLE_ZONES - 1, Math.floor(((clamped + 1) / 2) * PADDLE_ZONES));
  const zoneCentre = ((zone + 0.5) / PADDLE_ZONES) * 2 - 1;
  return zoneCentre * MAX_BOUNCE_ANGLE;
}

// Advances the game by dt seconds and returns what happened, for sounds and haptics.
export function step(state: GameState, dt: number, rand: () => number = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.winner !== null) return events;

  if (state.serveIn > 0) {
    state.serveIn -= dt;
    if (state.serveIn <= 0) serve(state, rand);
    return events;
  }

  const ball = state.ball;
  const prevX = ball.x;
  const prevY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y < 0) {
    ball.y = -ball.y;
    ball.vy = Math.abs(ball.vy);
    events.push({ type: 'wall' });
  } else if (ball.y > FIELD_H - BALL_SIZE) {
    ball.y = 2 * (FIELD_H - BALL_SIZE) - ball.y;
    ball.vy = -Math.abs(ball.vy);
    events.push({ type: 'wall' });
  }

  for (const side of [0, 1] as const) {
    if (collidePaddle(state, side, prevX, prevY)) {
      events.push({ type: 'paddle', side });
      break;
    }
  }

  if (ball.x + BALL_SIZE < 0 || ball.x > FIELD_W) {
    const scorer: Side = ball.x > FIELD_W ? 0 : 1;
    state.score[scorer] += 1;
    events.push({ type: 'score', side: scorer });
    if (state.score[scorer] >= WIN_SCORE) {
      state.winner = scorer;
      events.push({ type: 'win', side: scorer });
    }
    state.ball = centredBall();
    // The player who conceded receives the next serve.
    state.serveTo = scorer === 0 ? 1 : 0;
    state.serveIn = SERVE_DELAY;
  }

  return events;
}

// Swept test against the paddle's front face so a fast ball cannot tunnel through.
function collidePaddle(state: GameState, side: Side, prevX: number, prevY: number): boolean {
  const ball = state.ball;
  const movingToward = side === 0 ? ball.vx < 0 : ball.vx > 0;
  if (!movingToward) return false;

  const px = paddleX(side);
  const face = side === 0 ? px + PADDLE_W : px;
  const prevEdge = side === 0 ? prevX : prevX + BALL_SIZE;
  const edge = side === 0 ? ball.x : ball.x + BALL_SIZE;
  const crossed = side === 0 ? prevEdge >= face && edge <= face : prevEdge <= face && edge >= face;
  if (!crossed) return false;

  const t = (face - prevEdge) / (edge - prevEdge || 1);
  const yAtFace = prevY + (ball.y - prevY) * t;
  const ballCentre = yAtFace + BALL_SIZE / 2;
  const paddleCentre = state.paddles[side];
  if (Math.abs(ballCentre - paddleCentre) > PADDLE_H / 2 + BALL_SIZE / 2) return false;

  const angle = bounceAngle(ballCentre, paddleCentre);
  ball.speed = Math.min(BALL_MAX_SPEED, ball.speed * BALL_SPEEDUP);
  const dir = side === 0 ? 1 : -1;
  ball.vx = Math.cos(angle) * ball.speed * dir;
  ball.vy = Math.sin(angle) * ball.speed;
  ball.x = side === 0 ? face : face - BALL_SIZE;
  return true;
}
