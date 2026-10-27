import { WORLD_H, WORLD_W } from '../game/constants';
import type { World } from '../game/world';
import { drawSnake } from './snakeArt';

export interface Burst {
  x: number;
  y: number;
  color: string;
  at: number;
}

const BURST_S = 0.6;
const WRAP = { w: WORLD_W, h: WORLD_H };

const sprites = new Map<string, HTMLCanvasElement>();

// A soft glowing dot per color, drawn once and stamped for every piece of food.
function foodSprite(color: string): HTMLCanvasElement {
  let sprite = sprites.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const g = sprite.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.4, color + '88');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, sprite);
  return sprite;
}

let background: HTMLCanvasElement | null = null;

function backgroundTile(): HTMLCanvasElement {
  if (background) return background;
  background = document.createElement('canvas');
  background.width = WORLD_W;
  background.height = WORLD_H;
  const g = background.getContext('2d')!;
  const grad = g.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 100, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.7);
  grad.addColorStop(0, '#141b2d');
  grad.addColorStop(1, '#0b0f1a');
  g.fillStyle = grad;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // Hex dots, spaced so they tile across the wrapped edges.
  g.fillStyle = 'rgba(255,255,255,0.05)';
  const step = 40;
  for (let y = 0; y < WORLD_H; y += step * 0.866) {
    const row = Math.round(y / (step * 0.866));
    for (let x = (row % 2) * (step / 2); x < WORLD_W; x += step) {
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  return background;
}

// Fits the world into the canvas, letterboxed, and draws one frame.
export function drawWorld(ctx: CanvasRenderingContext2D, world: World, bursts: Burst[]): void {
  const { width, height } = ctx.canvas;
  const scale = Math.min(width / WORLD_W, height / WORLD_H);
  const ox = (width - WORLD_W * scale) / 2;
  const oy = (height - WORLD_H * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, WORLD_H);
  ctx.clip();
  ctx.drawImage(backgroundTile(), 0, 0);

  const t = world.time;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < world.food.length; i++) {
    const f = world.food[i];
    const pulse = 1 + 0.15 * Math.sin(t * 3 + i);
    const size = f.radius * (f.rich ? 4.2 : 3.4) * pulse;
    ctx.drawImage(foodSprite(f.color), f.x - size / 2, f.y - size / 2, size, size);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Smaller snakes first so big ones are drawn over them.
  const order = world.snakes.filter((s) => s.alive).sort((a, b) => a.mass - b.mass);
  for (const s of order) {
    const ghost = world.isProtected(s);
    const alpha = ghost ? 0.45 + 0.25 * Math.sin(t * 12) : 1;
    drawSnake(ctx, s.points, s.radius, s, { alpha, wrap: WRAP, time: t });
  }

  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const age = (t - b.at) / BURST_S;
    if (age > 1 || age < 0) {
      bursts.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 1 - age;
    ctx.lineWidth = 6 * (1 - age);
    ctx.beginPath();
    ctx.arc(b.x, b.y, 20 + age * 90, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const s of order) {
    const head = s.points[0];
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(s.name, head.x + 1, head.y - s.radius - 9);
    ctx.fillStyle = '#fff';
    ctx.fillText(s.name, head.x, head.y - s.radius - 10);
  }
  ctx.restore();
}
