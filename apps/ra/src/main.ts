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

// ---------- Sizing, camera and zoom ----------

// `base` is the default number of CSS pixels per art pixel (roughly a 640-720
// pixel wide view); `scale` is the current one, after zooming.
let base = 2;
let scale = 2;
let zoom = 1; // scale / base
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

// The world is larger than the screen so there is somewhere to pan to.
const worldFor = (w: number, h: number) => ({ w: Math.max(Math.ceil(w * 1.6), 900), h: Math.max(Math.ceil(h * 1.6), 640) });

function clampCam(): void {
  cam.x = Math.max(0, Math.min(built.w - canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(built.h - canvas.height, cam.y));
}

// Size the canvas for the current scale. Zooming out is capped so the view
// never gets bigger than the world.
function applyScale(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (built.w) zoom = Math.max(zoom, vw / built.w / base, vh / built.h / base);
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  if (built.w) zoom = Math.max(zoom, vw / built.w / base, vh / built.h / base);
  scale = base * zoom;
  const w = Math.ceil(vw / scale);
  const h = Math.ceil(vh / scale);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  clampCam();
}

// Zoom to `z`, keeping the world point under client position (cx, cy) still.
function zoomTo(z: number, cx: number, cy: number): void {
  const wx = cx / scale + cam.x;
  const wy = cy / scale + cam.y;
  zoom = z;
  applyScale();
  cam.x = wx - cx / scale;
  cam.y = wy - cy / scale;
  clampCam();
}

function fit(force = false): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  base = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / 680));
  const w = Math.ceil(vw / base);
  const h = Math.ceil(vh / base);
  // Only rebuild the world when the screen outgrows it (or on request).
  if (force || w > built.w || h > built.h) {
    const world = worldFor(w, h);
    game.generate(world.w, world.h);
    built = world;
    zoom = 1;
    applyScale();
    const f = game.focus();
    cam.x = f.x - canvas.width / 2;
    cam.y = f.y - canvas.height / 2;
  }
  applyScale();
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

// Every finger or mouse button currently down, for pinch zoom.
const pointers = new Map<number, { x: number; y: number }>();
// True from the moment a second finger lands until every finger has lifted.
let multi = false;
let pinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;
let down: { x: number; y: number; cx: number; cy: number; lx: number; ly: number; id: number; pan: boolean } | null = null;
let dragging = false;

// Pinch zoom runs on touch events, which every phone browser delivers for
// multi-touch. Cancelling them stops iOS Safari from zooming the page itself
// (it ignores user-scalable=no and would otherwise cancel our pointers).
const pinchState = (t: TouchList) => {
  const a = t[0];
  const b = t[1];
  return { dist: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
};
const startPinch = (t: TouchList) => {
  const p = pinchState(t);
  pinch = { dist: p.dist, zoom, wx: p.mx / scale + cam.x, wy: p.my / scale + cam.y };
};
canvas.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    if (e.touches.length >= 2) {
      multi = true;
      down = null;
      dragging = false;
      if (game) game.box = null;
      startPinch(e.touches);
    }
  },
  { passive: false },
);
canvas.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
    if (!pinch || e.touches.length < 2) return;
    // zoom with the finger spread, pan with the midpoint
    const p = pinchState(e.touches);
    zoom = pinch.zoom * (p.dist / pinch.dist);
    applyScale();
    cam.x = pinch.wx - p.mx / scale;
    cam.y = pinch.wy - p.my / scale;
    clampCam();
  },
  { passive: false },
);
const touchEnd = (e: TouchEvent) => {
  if (e.touches.length >= 2) startPinch(e.touches); // one of three fingers lifted
  else pinch = null;
  if (e.touches.length === 0) {
    multi = false;
    pointers.clear();
  }
};
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (!game) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size >= 2) {
    // A second finger turns the gesture into a pinch: drop any tap or box.
    multi = true;
    down = null;
    dragging = false;
    game.box = null;
    return;
  }
  if (multi || down) return;
  const p = toWorld(e);
  if (e.button === 2) {
    game.order(p.x, p.y);
    return;
  }
  down = { ...p, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, pan: mode === 'pan' || e.button === 1 };
  dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (multi) return;
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
  pointers.delete(e.pointerId);
  if (multi) {
    // stay in pinch mode until every finger has lifted, so no stray tap fires
    if (pointers.size === 0) multi = false;
    return;
  }
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

// Scroll wheel or trackpad pinch zooms around the cursor.
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomTo(zoom * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
  },
  { passive: false },
);
// Stop Safari's own page pinch from fighting ours.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// ---------- Keyboard: S / P switch modes, arrow keys pan, +/- zoom, Esc clears ----------

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (!game || (e.target as HTMLElement).tagName === 'SELECT') return;
  keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') game.deselect();
  if (e.key === 's' && !e.ctrlKey && !e.metaKey) setMode('select');
  if (e.key === 'p') setMode('pan');
  if (e.key === '+' || e.key === '=') zoomTo(zoom * 1.25, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === '-' || e.key === '_') zoomTo(zoom / 1.25, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === '0') zoomTo(1, window.innerWidth / 2, window.innerHeight / 2);
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
    const sp = (320 * dt) / zoom;
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
Object.defineProperty(window, 'zoom', { get: () => zoom });
