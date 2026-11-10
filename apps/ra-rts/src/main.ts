import './style.css';
import { Game, STATS } from './game';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const selEl = document.querySelector<HTMLDivElement>('#sel')!;
const regen = document.querySelector<HTMLButtonElement>('#regen')!;

const HINT = 'Drag: select · Tap: move';
let seed = Math.floor(Math.random() * 100000);
const game = new Game(ctx, seed);
game.onSelect = (units) => {
  if (!units.length) {
    selEl.textContent = HINT;
    return;
  }
  const counts = new Map<string, number>();
  for (const u of units) counts.set(STATS[u.kind].name, (counts.get(STATS[u.kind].name) ?? 0) + 1);
  selEl.textContent = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(' · ');
};

// One art pixel = `scale` CSS pixels. Aim for roughly a 640-720 pixel wide world.
let scale = 2;
function size(): { w: number; h: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  scale = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / 680));
  return { w: Math.ceil(vw / scale), h: Math.ceil(vh / scale) };
}

function fit(force = false): void {
  const { w, h } = size();
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  // Only rebuild the world when the screen outgrows it (or on request).
  if (force || !game.terrain || w > game.w || h > game.h) game.generate(w, h);
}
fit(true);

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => fit(), 150);
});

regen.addEventListener('click', () => {
  seed = Math.floor(Math.random() * 100000);
  game.seed = seed;
  fit(true);
});

// ---------- Input: tap/click to select or move, drag for a selection box ----------

const toWorld = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
};

let down: { x: number; y: number; cx: number; cy: number; id: number; button: number } | null = null;
let dragging = false;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (down) return;
  const p = toWorld(e);
  if (e.button === 2) {
    game.order(p.x, p.y);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  down = { ...p, cx: e.clientX, cy: e.clientY, id: e.pointerId, button: e.button };
  dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (!down || e.pointerId !== down.id) return;
  if (!dragging && Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 8) dragging = true;
  if (dragging) {
    const p = toWorld(e);
    game.box = { x0: down.x, y0: down.y, x1: p.x, y1: p.y };
  }
});
const finish = (e: PointerEvent, cancel: boolean) => {
  if (!down || e.pointerId !== down.id) return;
  const p = toWorld(e);
  const add = e.shiftKey || e.ctrlKey || e.metaKey;
  if (!cancel) {
    if (dragging) game.boxSelect(down.x, down.y, p.x, p.y, add);
    else game.click(down.x, down.y, add);
  }
  game.box = null;
  down = null;
  dragging = false;
};
canvas.addEventListener('pointerup', (e) => finish(e, false));
canvas.addEventListener('pointercancel', (e) => finish(e, true));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') game.deselect();
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    game.boxSelect(0, 0, game.w, game.h, false);
  }
});

// ---------- Loop ----------

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the scene from the console.
(window as unknown as { game: Game }).game = game;
