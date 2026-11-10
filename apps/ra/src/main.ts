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
const modeBtns = [...document.querySelectorAll<HTMLButtonElement>('#toolbar [data-mode]')];
const addBtn = document.querySelector<HTMLButtonElement>('#addBtn')!;
const allBtn = document.querySelector<HTMLButtonElement>('#allBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;

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
let built = { w: 0, h: 0 }; // world size in art pixels
const cam = { x: 0, y: 0 };

// ---------- Toolbar: select / pan modes, additive selection, all, clear ----------

type Mode = 'select' | 'pan';
let mode: Mode = 'select';
let additive = false;
let lastNames: string[] = [];

function setMode(m: Mode): void {
  mode = m;
  for (const b of modeBtns) {
    const on = b.dataset.mode === m;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }
  canvas.classList.toggle('panning', m === 'pan');
  showSelection(lastNames);
}
for (const b of modeBtns) b.addEventListener('click', () => setMode(b.dataset.mode as Mode));
addBtn.addEventListener('click', () => {
  additive = !additive;
  addBtn.setAttribute('aria-pressed', String(additive));
});
allBtn.addEventListener('click', () => game?.boxSelect(cam.x, cam.y, cam.x + canvas.width, cam.y + canvas.height, additive));
clearBtn.addEventListener('click', () => game?.deselect());

function showSelection(names: string[]): void {
  lastNames = names;
  if (!names.length) {
    selEl.textContent = mode === 'pan' ? 'Drag: pan · Tap: move' : 'Drag: select · Tap: move';
    return;
  }
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  selEl.textContent = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(' · ');
}

// ---------- Sizing and camera ----------

// One art pixel = `scale` CSS pixels. Aim for roughly a 640-720 pixel wide view.
let scale = 2;
function size(): { w: number; h: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  scale = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / 680));
  return { w: Math.ceil(vw / scale), h: Math.ceil(vh / scale) };
}

// The world is larger than the screen so there is somewhere to pan to.
const worldFor = (w: number, h: number) => ({ w: Math.max(Math.ceil(w * 1.6), 900), h: Math.max(Math.ceil(h * 1.6), 640) });

function clampCam(): void {
  cam.x = Math.max(0, Math.min(built.w - canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(built.h - canvas.height, cam.y));
}

function fit(force = false): void {
  const { w, h } = size();
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  // Only rebuild the world when the screen outgrows it (or on request).
  if (force || w > built.w || h > built.h) {
    const world = worldFor(w, h);
    game.generate(world.w, world.h);
    built = world;
    const f = game.focus();
    cam.x = f.x - w / 2;
    cam.y = f.y - h / 2;
  }
  clampCam();
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
  loading.hidden = false;
  requestAnimationFrame(() =>
    setTimeout(() => {
      fit(true);
      loading.hidden = true;
    }, 0),
  );
});

// ---------- Pointer input ----------
// Select mode: tap selects a unit or sends the selection, drag draws a box.
// Pan mode: drag moves the camera, tap still selects or sends units.
// The middle mouse button always pans.

const toWorld = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale + cam.x, y: (e.clientY - r.top) / scale + cam.y };
};

let down: { x: number; y: number; cx: number; cy: number; lx: number; ly: number; id: number; pan: boolean } | null = null;
let dragging = false;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (down || !game) return;
  const p = toWorld(e);
  if (e.button === 2) {
    game.order(p.x, p.y);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  down = { ...p, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, pan: mode === 'pan' || e.button === 1 };
  dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (!down || e.pointerId !== down.id) return;
  if (!dragging && Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 8) dragging = true;
  if (dragging) {
    if (down.pan) {
      cam.x -= (e.clientX - down.lx) / scale;
      cam.y -= (e.clientY - down.ly) / scale;
      clampCam();
    } else {
      const p = toWorld(e);
      game.box = { x0: down.x, y0: down.y, x1: p.x, y1: p.y };
    }
  }
  down.lx = e.clientX;
  down.ly = e.clientY;
});
const finish = (e: PointerEvent, cancel: boolean) => {
  if (!down || e.pointerId !== down.id) return;
  const p = toWorld(e);
  const add = additive || e.shiftKey || e.ctrlKey || e.metaKey;
  if (!cancel) {
    if (!dragging) game.click(down.x, down.y, add);
    else if (!down.pan) game.boxSelect(down.x, down.y, p.x, p.y, add);
  }
  game.box = null;
  down = null;
  dragging = false;
};
canvas.addEventListener('pointerup', (e) => finish(e, false));
canvas.addEventListener('pointercancel', (e) => finish(e, true));

// ---------- Keyboard: S / P switch modes, arrow keys pan, Esc clears ----------

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (!game || (e.target as HTMLElement).tagName === 'SELECT') return;
  keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') game.deselect();
  if (e.key === 's' && !e.ctrlKey && !e.metaKey) setMode('select');
  if (e.key === 'p') setMode('pan');
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    game.boxSelect(cam.x, cam.y, cam.x + canvas.width, cam.y + canvas.height, false);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ---------- Loop ----------

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game && built.w) {
    const sp = 320 * dt;
    if (keys.has('arrowleft')) cam.x -= sp;
    if (keys.has('arrowright')) cam.x += sp;
    if (keys.has('arrowup')) cam.y -= sp;
    if (keys.has('arrowdown')) cam.y += sp;
    clampCam();
    game.update(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#22391b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, -Math.round(cam.x), -Math.round(cam.y));
    game.render();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the scene from the console.
Object.defineProperty(window, 'game', { get: () => game });
Object.defineProperty(window, 'cam', { get: () => cam });
