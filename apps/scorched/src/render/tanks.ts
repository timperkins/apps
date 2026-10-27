import type { TankDesign } from '../core/config';
import { BARREL_LEN, TANK_H, TANK_HALF_W } from '../core/constants';

/**
 * Draws a tank whose treads rest on row `y`, in world pixels. Every design fits the same
 * footprint and fires from the same barrel tip, so the choice is purely cosmetic.
 */
export function drawTankSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number,
  color: string,
  design: TankDesign,
  time = 0,
): void {
  const W = TANK_HALF_W;
  const px = (dx: number, dy: number, w = 1, h = 1) => ctx.fillRect(x + dx, y + dy, w, h);

  // Barrel, pivoting from the top of the hull like the physics expects.
  const a = (angleDeg * Math.PI) / 180;
  const thick = design === 'heavy' || design === 'artillery';
  ctx.fillStyle = design === 'artillery' ? '#c8c8b0' : '#e8e8e8';
  for (let i = 0; i <= BARREL_LEN; i++) {
    const bx = Math.round(x + Math.cos(a) * i);
    const by = Math.round(y - TANK_H - Math.sin(a) * i);
    ctx.fillRect(bx, by, thick ? 2 : 1, thick ? 2 : 1);
  }

  const shine = 'rgba(255,255,255,0.45)';
  const shade = 'rgba(0,0,0,0.3)';
  switch (design) {
    case 'heavy':
      ctx.fillStyle = '#202020';
      px(-W, -2, W * 2 + 1, 2);
      ctx.fillStyle = '#5a5a5a';
      for (let i = -W + 1; i < W; i += 2) px(i, -2);
      ctx.fillStyle = color;
      px(-W, -5, W * 2 + 1, 3);
      px(-4, -7, 9, 2);
      ctx.fillStyle = shade;
      px(-W, -3, W * 2 + 1, 1);
      ctx.fillStyle = shine;
      px(-W + 1, -5, 5, 1);
      break;
    case 'rover':
      ctx.fillStyle = '#202020';
      for (const dx of [-5, 0, 5]) {
        px(dx - 1, -2, 3, 2);
        px(dx, -3, 1, 1);
      }
      ctx.fillStyle = '#8a8a8a';
      for (const dx of [-5, 0, 5]) px(dx, -1);
      ctx.fillStyle = color;
      px(-W + 1, -5, W * 2 - 1, 2);
      px(-2, -7, 6, 2);
      ctx.fillStyle = shine;
      px(-1, -7, 2, 1);
      break;
    case 'hover': {
      const glow = Math.floor(time * 8) % 2 === 0;
      ctx.fillStyle = glow ? '#78dcff' : '#3aa0f0';
      px(-W + 2, -1, W * 2 - 3, 1);
      ctx.fillStyle = color;
      px(-W + 1, -4, W * 2 - 1, 2);
      px(-W, -3, 1, 1);
      px(W, -3, 1, 1);
      px(-3, -6, 7, 2);
      ctx.fillStyle = shade;
      px(-W + 1, -2, W * 2 - 1, 1);
      ctx.fillStyle = shine;
      px(-2, -6, 3, 1);
      break;
    }
    case 'dome':
      ctx.fillStyle = '#202020';
      px(-W, -2, W * 2 + 1, 2);
      ctx.fillStyle = '#5a5a5a';
      for (let i = -W + 1; i < W; i += 3) px(i, -2);
      ctx.fillStyle = color;
      px(-W + 1, -4, W * 2 - 1, 2);
      px(-5, -6, 11, 2);
      px(-4, -7, 9, 1);
      px(-2, -8, 5, 1);
      ctx.fillStyle = shine;
      px(-3, -7, 2, 1);
      px(-1, -8, 1, 1);
      break;
    case 'artillery':
      ctx.fillStyle = '#202020';
      px(-W, -2, W * 2 + 1, 2);
      ctx.fillStyle = '#5a5a5a';
      for (let i = -W + 1; i < W; i += 3) px(i, -2);
      ctx.fillStyle = color;
      px(-W, -3, W * 2 + 1, 1);
      px(-W + 2, -4, W * 2 - 3, 1);
      // Gun mount
      px(-2, -6, 5, 2);
      ctx.fillStyle = shade;
      px(-2, -5, 5, 1);
      ctx.fillStyle = shine;
      px(-W + 2, -4, 4, 1);
      break;
    default:
      // classic
      ctx.fillStyle = '#202020';
      px(-W, -2, W * 2 + 1, 2);
      ctx.fillStyle = '#5a5a5a';
      for (let i = -W + 1; i < W; i += 3) px(i, -2);
      ctx.fillStyle = color;
      px(-W + 1, -4, W * 2 - 1, 2);
      px(-4, -6, 9, 2);
      px(-2, -7, 5, 1);
      ctx.fillStyle = shine;
      px(-3, -6, 3, 1);
  }
}

/**
 * Draws a plane centered on (x, y), in world pixels, in the same chunky style as the tanks.
 * `tilt` turns the nose down (radians) while it falls; `burning` flickers flames on it.
 */
export function drawPlaneSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: -1 | 1,
  tilt = 0,
  time = 0,
  burning = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  if (tilt) ctx.rotate(tilt);
  const px = (dx: number, dy: number, w = 1, h = 1) => ctx.fillRect(dx, dy, w, h);
  const body = '#8a9a5a';
  const shine = 'rgba(255,255,255,0.45)';
  const shade = 'rgba(0,0,0,0.3)';

  // Tail fin and tailplane
  ctx.fillStyle = body;
  px(-9, -4, 2, 3);
  px(-8, -5, 1, 1);
  // Fuselage, tapering to the nose
  px(-8, -1, 15, 3);
  px(7, -1, 1, 2);
  ctx.fillStyle = '#5a6a3a';
  px(-10, 0, 3, 1);
  // Wing, seen edge-on below the fuselage
  ctx.fillStyle = '#5a6a3a';
  px(-3, 1, 7, 1);
  px(-2, 2, 5, 1);
  // Cockpit
  ctx.fillStyle = '#78dcff';
  px(1, -2, 3, 1);
  ctx.fillStyle = '#202020';
  px(0, -2, 1, 1);
  // Roundel
  ctx.fillStyle = '#e8483a';
  px(-5, 0, 2, 1);
  ctx.fillStyle = shade;
  px(-8, 1, 15, 1);
  ctx.fillStyle = shine;
  px(-6, -1, 7, 1);
  // Nose and spinning propeller
  ctx.fillStyle = '#202020';
  px(8, -1, 1, 2);
  ctx.fillStyle = '#d0d0d0';
  if (Math.floor(time * 20) % 2 === 0) px(9, -3, 1, 6);
  else px(9, -1, 1, 2);
  if (burning) {
    const f = Math.floor(time * 12) % 3;
    ctx.fillStyle = f === 0 ? '#fff3a0' : f === 1 ? '#ffd040' : '#ff5a10';
    px(-4 + f, -3, 2, 2);
    ctx.fillStyle = '#ff9a20';
    px(2 - f, -2, 1, 1);
  }
  ctx.restore();
}
