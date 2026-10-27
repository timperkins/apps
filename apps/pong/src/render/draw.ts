import { BALL_SIZE, FIELD_H, FIELD_W, PADDLE_H, PADDLE_W } from '../game/constants';
import { paddleX, type GameState } from '../game/physics';
import { drawNumber, numberWidth } from './font';

const FG = '#fff';
const BG = '#000';

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = FG;

  // Dashed net.
  const dash = 6;
  for (let y = 2; y < FIELD_H; y += dash * 2) ctx.fillRect(FIELD_W / 2 - 1, y, 2, dash);

  drawNumber(ctx, state.score[0], FIELD_W / 2 - 24, 12, 4);
  drawNumber(ctx, state.score[1], FIELD_W / 2 + 24 + numberWidth(state.score[1], 4), 12, 4);

  for (const side of [0, 1] as const) {
    ctx.fillRect(paddleX(side), Math.round(state.paddles[side] - PADDLE_H / 2), PADDLE_W, PADDLE_H);
  }

  if (state.serveIn <= 0 && state.winner === null) {
    ctx.fillRect(Math.round(state.ball.x), Math.round(state.ball.y), BALL_SIZE, BALL_SIZE);
  }
}
