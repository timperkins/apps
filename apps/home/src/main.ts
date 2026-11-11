import './style.css';

// "TROM" drawn as a field of glowing particles. Each particle springs back to
// its spot in the letters; the pointer (or a finger) pushes them away.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
  hue: number;
  size: number;
}

const canvas = document.querySelector<HTMLCanvasElement>('#trom')!;
const ctx = canvas.getContext('2d')!;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let width = 0;
let height = 0;
let dpr = 1;
let particles: Particle[] = [];
const pointer = { x: -9999, y: -9999, active: false };

function layout(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Render the word off screen and sample its pixels for particle homes.
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const o = off.getContext('2d')!;
  let fontSize = Math.min(width / 3.1, height / 2.2);
  o.font = `900 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const measured = o.measureText('TROM').width;
  fontSize *= Math.min(1, (width * 0.86) / measured);
  o.font = `900 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  o.fillStyle = '#fff';
  o.fillText('TROM', width / 2, height / 2);

  const data = o.getImageData(0, 0, width, height).data;
  const step = Math.max(3, Math.round(fontSize / 34));
  const old = particles;
  particles = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      const prev = old[particles.length];
      particles.push({
        x: prev ? prev.x : Math.random() * width,
        y: prev ? prev.y : Math.random() * height,
        vx: 0,
        vy: 0,
        hx: x,
        hy: y,
        hue: 0,
        size: step * (0.42 + Math.random() * 0.28),
      });
    }
  }
  if (reduceMotion) for (const p of particles) ((p.x = p.hx), (p.y = p.hy));
}

function frame(t: number): void {
  // Trailing fade gives the moving particles a light streak.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(7, 6, 11, 0.32)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';

  const radius = Math.max(70, Math.min(width, height) * 0.16);
  const time = t / 1000;

  for (const p of particles) {
    if (!reduceMotion) {
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (pointer.active && d2 < radius * radius) {
        const d = Math.sqrt(d2) || 1;
        const force = (1 - d / radius) * 6;
        p.vx += (dx / d) * force;
        p.vy += (dy / d) * force;
      }
      // A slow shimmer so the letters feel alive even when untouched.
      const wobble = Math.sin(time * 1.6 + p.hx * 0.02 + p.hy * 0.015) * 0.6;
      p.vx += (p.hx - p.x) * 0.045;
      p.vy += (p.hy + wobble - p.y) * 0.045;
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;
    }

    // Colour sweeps across the word from magenta through violet to cyan.
    const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 8);
    p.hue = 285 - (p.hx / width) * 110 + Math.sin(time * 0.7 + p.hx * 0.006) * 25;
    const light = 55 + speed * 25;
    ctx.fillStyle = `hsl(${p.hue}, 95%, ${light}%)`;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }

  if (!reduceMotion) requestAnimationFrame(frame);
}

function setPointer(e: PointerEvent): void {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
}

canvas.addEventListener('pointermove', setPointer);
canvas.addEventListener('pointerdown', setPointer);
const release = (): void => {
  pointer.active = false;
};
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') release();
});
canvas.addEventListener('pointerleave', release);
canvas.addEventListener('pointercancel', release);

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    layout();
    if (reduceMotion) requestAnimationFrame(frame);
  }, 120);
});

layout();
requestAnimationFrame(frame);
