import './style.css';
import type { GameLike } from './types';
import { Game } from './v1/game';
import { IsoGame } from './v2/game';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const selEl = document.querySelector<HTMLDivElement>('#sel')!;
const regen = document.querySelector<HTMLButtonElement>('#regen')!;
const versionEl = document.querySelector<HTMLSelectElement>('#version')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;

const HINT = 'Drag: select · Tap: move';
const VERSIONS: Record<string, (seed: number) => GameLike> = {
  '1': (seed) => new Game(ctx, seed),
  '2': (seed) => new IsoGame(ctx, seed),
};

// Version comes from ?v=, then the last one picked, then the newest.
const params = new URLSearchParams(location.search);
let version = params.get('v') ?? load('ra-version') ?? '2';
if (!VERSIONS[version]) version = '2';
versionEl.value = version;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

let seed = Math.floor(Math.random() * 100000);
let game: GameLike;
let built = { w: 0, h: 0 };

const showSelection = (names: string[]) => {
  if (!names.length) {
    selEl.textContent = HINT;
    return;
  }
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
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
  if (force || w > built.w || h > built.h) {
    game.generate(w, h);
    built = { w, h };
  }
}

// Building sprites takes a moment, so show a note and yield a frame first.
function start(v: string): void {
  loading.hidden = false;
  requestAnimationFrame(() =>
    setTimeout(() => {
      game = VERSIONS[v](seed);
      game.onSelect = showSelection;
      built = { w: 0, h: 0 };
      fit(true);
      loading.hidden = true;
    }, 0),
  );
}
start(version);

versionEl.addEventListener('change', () => {
  version = versionEl.value;
  save('ra-version', version);
  const url = new URL(location.href);
  url.searchParams.set('v', version);
  history.replaceState(null, '', url);
  start(version);
  versionEl.blur();
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => game && fit(), 150);
});

regen.addEventListener('click', () => {
  seed = Math.floor(Math.random() * 100000);
  game.seed = seed;
  fit(true);
});

// ---------- Input: tap/click to select or move, drag for a selection box ----------

const toArt = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
};

let down: { x: number; y: number; cx: number; cy: number; id: number } | null = null;
let dragging = false;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (down || !game) return;
  const p = toArt(e);
  if (e.button === 2) {
    game.order(p.x, p.y);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  down = { ...p, cx: e.clientX, cy: e.clientY, id: e.pointerId };
  dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (!down || e.pointerId !== down.id) return;
  if (!dragging && Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 8) dragging = true;
  if (dragging) {
    const p = toArt(e);
    game.box = { x0: down.x, y0: down.y, x1: p.x, y1: p.y };
  }
});
const finish = (e: PointerEvent, cancel: boolean) => {
  if (!down || e.pointerId !== down.id) return;
  const p = toArt(e);
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
  if (!game) return;
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
  if (game && built.w) {
    game.update(dt);
    game.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the scene from the console.
Object.defineProperty(window, 'game', { get: () => game });
