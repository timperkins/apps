import type { Look } from '../game/looks';
import type { Vec } from '../game/math';

// Hex color nudged toward white (amount > 0) or black (amount < 0).
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

function hueShift(hex: string, degrees: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return `hsl(${(h * 60 + degrees + 360) % 360},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
}

export interface DrawOptions {
  alpha?: number;
  // World size for drawing copies of circles that cross an edge; omit on the phone preview.
  wrap?: { w: number; h: number };
  // Seconds, for the glow's pulse.
  time?: number;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, wrap: DrawOptions['wrap']): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (!wrap) return;
  const xs = [x];
  const ys = [y];
  if (x < r) xs.push(x + wrap.w);
  else if (x > wrap.w - r) xs.push(x - wrap.w);
  if (y < r) ys.push(y + wrap.h);
  else if (y > wrap.h - r) ys.push(y - wrap.h);
  for (const cx of xs) {
    for (const cy of ys) {
      if (cx === x && cy === y) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draws a snake tail first, so the head sits on top. Points are head first.
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  points: Vec[],
  radius: number,
  look: Look,
  opts: DrawOptions = {},
): void {
  if (points.length === 0) return;
  const { wrap, time = 0 } = opts;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  const n = points.length;
  const dark = shade(look.color, -0.45);
  const darker = shade(look.color, -0.25);
  const light = shade(look.color, 0.45);

  if (look.pattern === 'glow') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = look.color;
    const pulse = 0.12 + 0.05 * Math.sin(time * 4);
    ctx.globalAlpha = (opts.alpha ?? 1) * pulse;
    for (let i = n - 1; i >= 0; i -= 3) circle(ctx, points[i].x, points[i].y, radius * 1.9, wrap);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = opts.alpha ?? 1;
  }

  // Outline pass, then the body.
  ctx.fillStyle = dark;
  for (let i = n - 1; i >= 0; i -= 2) circle(ctx, points[i].x, points[i].y, radius + 1.5, wrap);
  for (let i = n - 1; i >= 0; i--) {
    // Taper the last stretch of tail.
    const taper = Math.min(1, 0.55 + (n - 1 - i) / 12);
    const r = radius * taper;
    switch (look.pattern) {
      case 'stripes':
        ctx.fillStyle = Math.floor(i / 5) % 2 === 0 ? look.color : darker;
        break;
      case 'gradient':
        ctx.fillStyle = hueShift(look.color, (i / Math.max(1, n)) * 140);
        break;
      case 'glow':
        ctx.fillStyle = i % 6 < 3 ? look.color : light;
        break;
      default:
        ctx.fillStyle = look.color;
    }
    circle(ctx, points[i].x, points[i].y, r, wrap);
  }
  if (look.pattern === 'dots') {
    ctx.fillStyle = light;
    for (let i = 6; i < n - 3; i += 7) circle(ctx, points[i].x, points[i].y, radius * 0.35, wrap);
  }

  // Eyes look the way the head is going.
  const head = points[0];
  const next = points[Math.min(2, n - 1)];
  let angle = Math.atan2(head.y - next.y, head.x - next.x);
  if (n < 2 || (head.x === next.x && head.y === next.y)) angle = 0;
  // A neighbor across the wrap would point the wrong way; fall back to straight right.
  if (wrap && Math.hypot(head.x - next.x, head.y - next.y) > radius * 4) angle = 0;
  const side = angle + Math.PI / 2;
  for (const dir of [-1, 1]) {
    const ex = head.x + Math.cos(angle) * radius * 0.35 + Math.cos(side) * dir * radius * 0.45;
    const ey = head.y + Math.sin(angle) * radius * 0.35 + Math.sin(side) * dir * radius * 0.45;
    ctx.fillStyle = '#fff';
    circle(ctx, ex, ey, radius * 0.32, undefined);
    ctx.fillStyle = '#111';
    circle(ctx, ex + Math.cos(angle) * radius * 0.12, ey + Math.sin(angle) * radius * 0.12, radius * 0.17, undefined);
  }
  ctx.restore();
}

// A wavy snake for the phone's style picker.
export function previewPoints(width: number, height: number, time: number): Vec[] {
  const points: Vec[] = [];
  const count = 70;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    points.push({
      x: width * (0.85 - t * 0.7),
      y: height / 2 + Math.sin(t * 9 - time * 3) * height * 0.18,
    });
  }
  return points;
}
