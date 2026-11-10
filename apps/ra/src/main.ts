import './style.css';
import type { GameLike } from './types';
import { Globe, View } from './planet';
import { Game } from './v1/game';
import { IsoGame } from './v2/game';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const mini = document.querySelector<HTMLCanvasElement>('#mini')!;
const mctx = mini.getContext('2d')!;
const selEl = document.querySelector<HTMLDivElement>('#sel')!;
const regen = document.querySelector<HTMLButtonElement>('#regen')!;
const versionEl = document.querySelector<HTMLSelectElement>('#version')!;
const menuBtn = document.querySelector<HTMLButtonElement>('#menuBtn')!;
const menu = document.querySelector<HTMLDivElement>('#menu')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;
const modeBtns = [...document.querySelectorAll<HTMLButtonElement>('#toolbar [data-mode]')];
const moreBtn = document.querySelector<HTMLButtonElement>('#moreBtn')!;
const selBar = document.querySelector<HTMLDivElement>('#selBar')!;
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
let built = { w: 0, h: 0 }; // map size in art pixels
// The camera is the map point at the centre of the screen. The map wraps
// round both ways, and the camera's x and y keep counting as you go round,
// which is how orders know which way round to send units.
const cen = { x: 0, y: 0 };
const globe = new Globe();

// ---------- Menu ----------

function setMenu(open: boolean): void {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) setMenu(false);
});

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
// "More" and "Clear" only show while something is selected; when on, taps and
// boxes add to the selection instead of replacing it.
function setAdditive(on: boolean): void {
  additive = on;
  moreBtn.setAttribute('aria-pressed', String(on));
}
moreBtn.addEventListener('click', () => setAdditive(!additive));
allBtn.addEventListener('click', () => selectView(additive));
clearBtn.addEventListener('click', () => game?.deselect());

// Everything on screen; from space, everything on the near side of the world.
function selectView(add: boolean): void {
  if (!game) return;
  if (planet) game.boxSelect(cen.x - built.w / 4, cen.y - built.h / 4, cen.x + built.w / 4, cen.y + built.h / 4, add);
  else game.boxSelect(camX(), camY(), camX() + canvas.width, camY() + canvas.height, add);
}

function showSelection(names: string[]): void {
  lastNames = names;
  selBar.hidden = names.length === 0;
  if (!names.length) setAdditive(false);
  if (!names.length) {
    selEl.textContent = planet ? 'Drag: spin · Tap: fly down' : mode === 'pan' ? 'Drag: pan · Tap: move' : 'Drag: select · Tap: move';
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
const ZOOM_MAX = 3;
// Zooming out until the whole map is in view from top to bottom (zFlat) and
// then further takes you up into space, where the world is a globe. Below
// zFlat the globe shrinks until it is SPACE_MIN of its starting size.
let zFlat = 0.5;
const SPACE_MIN = 0.3;
let planet = false;

// The map is a longitude/latitude grid twice as wide as it is tall, large
// enough that there is plenty of world beyond the screen.
const worldFor = (w: number, h: number) => {
  const H = Math.ceil(Math.max(h * 1.5, w, 720) / 2) * 2;
  return { w: H * 2, h: H };
};

const camX = () => cen.x - canvas.width / 2;
const camY = () => cen.y - canvas.height / 2;

// The camera can go anywhere; just keep its numbers from growing without end.
function clampCen(): void {
  if (built.h && Math.abs(cen.y) > built.h * 8) cen.y -= Math.round(cen.y / built.h) * built.h;
}

// Size the canvas for the current zoom. In space the canvas stays at the
// default scale and the globe shrinks instead.
function applyScale(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  zFlat = built.h ? Math.min(1, vh / built.h / base) : 0.5;
  zoom = Math.max(zFlat * SPACE_MIN, Math.min(ZOOM_MAX, zoom));
  const wasPlanet = planet;
  planet = zoom < zFlat - 1e-6;
  scale = planet ? base : base * zoom;
  const w = Math.ceil(vw / scale);
  const h = Math.ceil(vh / scale);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  mini.hidden = planet;
  if (planet !== wasPlanet) {
    lastSnap = 0; // refresh the globe straight away
    showSelection(lastNames);
  }
  clampCen();
}

// Zoom to `z`, keeping the map point under client position (cx, cy) still.
// In space the globe always zooms about its centre.
function zoomTo(z: number, cx: number, cy: number): void {
  const before = planet;
  const m = toMap(cx, cy);
  zoom = z;
  applyScale();
  if (!planet && !before) {
    cen.x = m.x - (cx / scale - canvas.width / 2);
    cen.y = m.y - (cy / scale - canvas.height / 2);
  }
  clampCen();
}

function fit(force = false): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  base = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / 680));
  const want = worldFor(Math.ceil(vw / base), Math.ceil(vh / base));
  // Only rebuild the world when the screen outgrows it (or on request).
  if (force || want.w > built.w || want.h > built.h) {
    game.generate(want.w, want.h);
    built = want;
    zoom = 1;
    planet = false;
    applyScale();
    const f = game.focus();
    cen.x = f.x;
    cen.y = f.y;
    lastSnap = 0;
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
  setMenu(false);
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
  setMenu(false);
  loading.hidden = false;
  requestAnimationFrame(() =>
    setTimeout(() => {
      fit(true);
      loading.hidden = true;
    }, 0),
  );
});

// ---------- The globe (space view and minimap) ----------

const TAU = Math.PI * 2;

function spaceView(): View {
  const r0 = 0.5 * Math.max(canvas.width, canvas.height);
  return { cx: canvas.width / 2, cy: canvas.height / 2, r: r0 * (zoom / zFlat), x: cen.x, y: cen.y };
}
function miniView(): View {
  return { cx: mini.width / 2, cy: mini.height / 2, r: mini.width / 2 - 3, x: cen.x, y: cen.y };
}

// Refresh the globe's picture of the map now and then: often enough to see
// armies move, rarely enough to stay cheap.
let lastSnap = 0;
function snapshot(now: number): void {
  if (now - lastSnap < (planet ? 300 : 700)) return;
  lastSnap = now;
  globe.capture(built.w, built.h, (c) => {
    game.ctx = c;
    try {
      game.renderGround();
      // objects near the seam hang over the edge, so draw the neighbours too
      for (const k of [-1, 0, 1]) {
        c.setTransform(1, 0, 0, 1, k * built.w, 0);
        game.renderObjects();
      }
    } finally {
      game.ctx = ctx;
    }
  });
}

// Selected units as green specks, so you can see what you are about to order.
function drawSelected(c: CanvasRenderingContext2D, v: View, size: number): void {
  c.fillStyle = '#9dff9d';
  for (const [x, y] of game.selectedPoints()) {
    const p = globe.project(v, x, y);
    if (p) c.fillRect(Math.round(p[0] - size / 2), Math.round(p[1] - size / 2), size, size);
  }
}

function drawMini(): void {
  const css = mini.clientWidth || 128;
  const px = Math.round(css / 2);
  if (mini.width !== px) {
    mini.width = px;
    mini.height = px;
  }
  const v = miniView();
  globe.draw(mctx, v, false);
  // the part of the world on screen, traced round the edge of the view
  const x0 = camX();
  const y0 = camY();
  const w = canvas.width;
  const h = canvas.height;
  mctx.fillStyle = '#ffffff';
  const n = 48;
  for (let i = 0; i < n * 4; i++) {
    const t = (i % n) / n;
    const side = Math.floor(i / n);
    const x = side === 0 ? x0 + t * w : side === 1 ? x0 + w : side === 2 ? x0 + w - t * w : x0;
    const y = side === 0 ? y0 : side === 1 ? y0 + t * h : side === 2 ? y0 + h : y0 + h - t * h;
    const p = globe.project(v, x, y);
    if (p) mctx.fillRect(Math.floor(p[0]), Math.floor(p[1]), 1, 1);
  }
  drawSelected(mctx, v, 2);
}

// Minimap: drag to spin the world under the camera, tap to jump there.
let miniDrag: { id: number; x: number; y: number; moved: boolean } | null = null;
mini.addEventListener('pointerdown', (e) => {
  if (!game) return;
  e.preventDefault();
  mini.setPointerCapture(e.pointerId);
  miniDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
});
mini.addEventListener('pointermove', (e) => {
  if (!miniDrag || e.pointerId !== miniDrag.id) return;
  const dx = e.clientX - miniDrag.x;
  const dy = e.clientY - miniDrag.y;
  if (!miniDrag.moved && Math.hypot(dx, dy) < 4) return;
  miniDrag.moved = true;
  const r = (miniView().r * mini.clientWidth) / mini.width;
  cen.x -= (dx / r) * (built.w / TAU);
  cen.y -= (dy / r) * (built.h / Math.PI);
  clampCen();
  miniDrag.x = e.clientX;
  miniDrag.y = e.clientY;
});
const miniUp = (e: PointerEvent) => {
  if (!miniDrag || e.pointerId !== miniDrag.id) return;
  if (!miniDrag.moved) {
    const b = mini.getBoundingClientRect();
    const k = mini.width / b.width;
    const p = globe.pick(miniView(), (e.clientX - b.left) * k, (e.clientY - b.top) * k);
    if (p) {
      cen.x = p.x; // already on the lap nearest the camera
      cen.y = p.y;
      clampCen();
    }
  }
  miniDrag = null;
};
mini.addEventListener('pointerup', miniUp);
mini.addEventListener('pointercancel', (e) => {
  if (miniDrag && e.pointerId === miniDrag.id) miniDrag = null;
});
mini.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

// ---------- Pointer input ----------
// Select mode: tap selects a unit or sends the selection, drag draws a box.
// Pan mode: drag moves the camera, tap still selects or sends units.
// The middle mouse button always pans. In space, a drag spins the world and a
// tap sends the selection there the shortest way (or flies down if nothing is
// selected).

const toMap = (cx: number, cy: number) => {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left) / scale + camX(), y: (cy - r.top) / scale + camY() };
};

// Every finger or mouse button currently down, for pinch zoom.
const pointers = new Map<number, { x: number; y: number }>();
// True from the moment a second finger lands until every finger has lifted.
let multi = false;
let pinch: { dist: number; zoom: number; mx: number; my: number; wx: number; wy: number } | null = null;
let down: { x: number; y: number; cx: number; cy: number; lx: number; ly: number; id: number; pan: boolean } | null = null;
let dragging = false;
let box: { x0: number; y0: number; x1: number; y1: number } | null = null;

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
  const m = toMap(p.mx, p.my);
  pinch = { dist: p.dist, zoom, mx: p.mx, my: p.my, wx: m.x, wy: m.y };
};
canvas.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    if (e.touches.length >= 2) {
      multi = true;
      down = null;
      dragging = false;
      box = null;
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
    const was = planet;
    zoom = pinch.zoom * (p.dist / pinch.dist);
    applyScale();
    if (planet !== was) {
      startPinch(e.touches); // crossed between map and space: start afresh
      return;
    }
    if (planet) {
      spin(p.mx - pinch.mx, p.my - pinch.my);
      pinch.mx = p.mx;
      pinch.my = p.my;
    } else {
      cen.x = pinch.wx - (p.mx / scale - canvas.width / 2);
      cen.y = pinch.wy - (p.my / scale - canvas.height / 2);
    }
    clampCen();
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

// Spin the globe by a drag of (dx, dy) client pixels.
function spin(dx: number, dy: number): void {
  const r = spaceView().r * scale;
  cen.x -= (dx / r) * (built.w / TAU);
  cen.y -= (dy / r) * (built.h / Math.PI);
  clampCen();
}

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
    box = null;
    return;
  }
  if (multi || down) return;
  const p = toMap(e.clientX, e.clientY);
  if (e.button === 2) {
    if (planet) spaceTap(e, true);
    else {
      game.order(p.x, p.y);
    }
    return;
  }
  down = { ...p, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, pan: planet || mode === 'pan' || e.button === 1 };
  dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (multi) return;
  if (!down || e.pointerId !== down.id) return;
  if (!dragging && Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 8) dragging = true;
  if (dragging) {
    if (planet) spin(e.clientX - down.lx, e.clientY - down.ly);
    else if (down.pan) {
      cen.x -= (e.clientX - down.lx) / scale;
      cen.y -= (e.clientY - down.ly) / scale;
      clampCen();
    } else {
      const p = toMap(e.clientX, e.clientY);
      box = { x0: down.x, y0: down.y, x1: p.x, y1: p.y };
    }
  }
  down.lx = e.clientX;
  down.ly = e.clientY;
});

// A tap on the globe: send the selection there, or fly down to it.
function spaceTap(e: PointerEvent, orderOnly = false): void {
  const r = canvas.getBoundingClientRect();
  const p = globe.pick(spaceView(), (e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
  if (!p) return;
  if (game.selectedPoints().length) game.order(p.x, p.y, true);
  else if (!orderOnly) {
    cen.x = p.x;
    cen.y = p.y;
    zoom = 1;
    applyScale();
  }
}

const finish = (e: PointerEvent, cancel: boolean) => {
  pointers.delete(e.pointerId);
  if (multi) {
    // stay in pinch mode until every finger has lifted, so no stray tap fires
    if (pointers.size === 0) multi = false;
    return;
  }
  if (!down || e.pointerId !== down.id) return;
  const p = toMap(e.clientX, e.clientY);
  const add = additive || e.shiftKey || e.ctrlKey || e.metaKey;
  if (!cancel) {
    if (planet) {
      if (!dragging) spaceTap(e);
    } else if (!dragging) {
      game.click(down.x, down.y, add);
    } else if (!down.pan) game.boxSelect(down.x, down.y, p.x, p.y, add);
  }
  box = null;
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
  if (e.key === 'Escape') {
    if (!menu.hidden) setMenu(false);
    else game.deselect();
  }
  if (e.key === 's' && !e.ctrlKey && !e.metaKey) setMode('select');
  if (e.key === 'p') setMode('pan');
  if (e.key === '+' || e.key === '=') zoomTo(zoom * 1.25, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === '-' || e.key === '_') zoomTo(zoom / 1.25, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === '0') zoomTo(1, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    selectView(false);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ---------- Loop ----------

function drawBox(): void {
  if (!box) return;
  const x = Math.round(Math.min(box.x0, box.x1) - camX());
  const y = Math.round(Math.min(box.y0, box.y1) - camY());
  const w = Math.round(Math.abs(box.x1 - box.x0));
  const h = Math.round(Math.abs(box.y1 - box.y0));
  ctx.fillStyle = 'rgba(140,255,140,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9dff9d';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h, w + 1, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w, y, 1, h);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game && built.w) {
    const sp = planet ? built.w * 0.25 * dt : (320 * dt) / zoom;
    if (keys.has('arrowleft')) cen.x -= sp;
    if (keys.has('arrowright')) cen.x += sp;
    if (keys.has('arrowup')) cen.y -= sp / 2;
    if (keys.has('arrowdown')) cen.y += sp / 2;
    clampCen();
    game.update(dt);
    snapshot(now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (planet) {
      const v = spaceView();
      globe.draw(ctx, v, true);
      drawSelected(ctx, v, 2);
    } else {
      // One copy of the map for every lap of the world in view, across and
      // down. Ground first, then objects, since sprites hang over the edges.
      const W = built.w;
      const H = built.h;
      const ox = -Math.round(camX());
      const oy = -Math.round(camY());
      ctx.fillStyle = '#22391b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const pad of [0, 80]) {
        const k0 = Math.floor((camX() - pad) / W);
        const k1 = Math.floor((camX() + canvas.width + pad) / W);
        const j0 = Math.floor((camY() - pad) / H);
        const j1 = Math.floor((camY() + canvas.height + pad) / H);
        for (let j = j0; j <= j1; j++)
          for (let k = k0; k <= k1; k++) {
            ctx.setTransform(1, 0, 0, 1, ox + k * W, oy + j * H);
            if (pad) game.renderObjects();
            else game.renderGround();
          }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawBox();
      if (globe.ready) drawMini();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the scene from the console.
Object.defineProperty(window, 'game', { get: () => game });
Object.defineProperty(window, 'cam', { get: () => ({ x: camX(), y: camY(), cx: cen.x, cy: cen.y }) });
Object.defineProperty(window, 'zoom', { get: () => zoom });
Object.defineProperty(window, 'planet', { get: () => planet });
