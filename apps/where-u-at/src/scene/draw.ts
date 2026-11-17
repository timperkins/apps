// Canvas drawing helpers: bubbles, labels and the little shapes used by the animations.
import { withAlpha } from '../engine/color';

export function circleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, r: number, fallback: string, initials: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = fallback;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(r * 0.8)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x, y + 1);
  }
  ctx.restore();
}

export function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.4, x, y - s * 0.5);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  ctx.fillStyle = color;
  ctx.fill();
}

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? size * 0.42 : size;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(0, 0, size, 0);
  ctx.quadraticCurveTo(0, 0, 0, size);
  ctx.quadraticCurveTo(0, 0, -size, 0);
  ctx.quadraticCurveTo(0, 0, 0, -size);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** A gold wedding ring with a little diamond. */
export function weddingRing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.15, size * 0.62, size * 0.58, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#D4A72C';
  ctx.lineWidth = size * 0.17;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  const top = y - size * 0.45;
  ctx.moveTo(x, top - size * 0.35);
  ctx.lineTo(x + size * 0.28, top);
  ctx.lineTo(x, top + size * 0.25);
  ctx.lineTo(x - size * 0.28, top);
  ctx.closePath();
  ctx.fillStyle = '#E8F6FF';
  ctx.strokeStyle = '#9CC9E0';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A rounded label beside a bubble, with a dot in the person's color. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  alpha: number,
  theme: { labelBg: string; ink: string },
  side: 'right' | 'left' = 'right',
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 30;
  const h = 26;
  const left = side === 'right' ? x : x - w;
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, left, y - h / 2, w, h, h / 2);
  ctx.fillStyle = theme.labelBg;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.arc(left + 13, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = theme.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 22, y + 0.5);
  ctx.restore();
}

export function babySvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" fill="${color}"/>
<circle cx="50" cy="56" r="30" fill="#FBE3D0"/>
<circle cx="21" cy="58" r="6" fill="#FBE3D0"/><circle cx="79" cy="58" r="6" fill="#FBE3D0"/>
<path d="M46 27 C42 18 54 14 56 22 C57 27 50 29 49 25" fill="none" stroke="#8a5a3c" stroke-width="3.5" stroke-linecap="round"/>
<path d="M36 54 Q40 50 44 54" fill="none" stroke="#3a2a22" stroke-width="3" stroke-linecap="round"/>
<path d="M56 54 Q60 50 64 54" fill="none" stroke="#3a2a22" stroke-width="3" stroke-linecap="round"/>
<circle cx="34" cy="64" r="5" fill="${withAlpha(color, 0.45)}"/><circle cx="66" cy="64" r="5" fill="${withAlpha(color, 0.45)}"/>
<circle cx="50" cy="70" r="7" fill="${color}" stroke="#ffffff" stroke-width="3"/>
<rect x="45" y="66" width="10" height="5" rx="2" fill="#ffffff"/>
</svg>`;
}

/** A party balloon with its string running down to (tieX, tieY). */
export function balloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, tieX: number, tieY: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.05);
  ctx.quadraticCurveTo((x + tieX) / 2 + 6, (y + r + tieY) / 2, tieX, tieY);
  ctx.strokeStyle = 'rgba(120,120,130,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.84, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.92);
  ctx.lineTo(x + r * 0.2, y + r * 1.15);
  ctx.lineTo(x - r * 0.2, y + r * 1.15);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

/** Spinning beams of light fanning out from a point. */
export function rays(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, n: number, rot: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, outer);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.35, withAlpha(color, alpha * 0.7));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * Math.PI * 2) / n;
    ctx.moveTo(x, y);
    ctx.arc(x, y, outer, a0, a0 + (Math.PI / n) * 0.9);
    ctx.closePath();
  }
  ctx.fillStyle = g;
  ctx.fill();
}

/** Dims everything except a soft circle around (x, y), like a stage spotlight. */
export function spotlight(ctx: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, r, x, y, r * 3.2);
  g.addColorStop(0, 'rgba(12,10,24,0)');
  g.addColorStop(1, `rgba(12,10,24,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Big headline text with a white outline, for births and weddings. */
export function banner(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fill: string, alpha: number, scale: number, rot: number) {
  if (alpha <= 0 || scale <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
