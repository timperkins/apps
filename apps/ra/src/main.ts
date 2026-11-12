import './style.css';
import type { GameLike } from './types';
import { Globe, View } from './planet';
import { CH } from './tiles';
import { ART } from './gfx';
import { Game } from './v1/game';
import { IsoGame } from './v2/game';
import { initBuild } from './build-ui';
import { ATTACK_CLICK_CSS, ATTACK_CLICK_FRAMES, ATTACK_FRAMES, CORNER_FRAMES, CURSORS, MOVE_CLICK_FRAMES, MOVE_STEPS, initCursors, moveCursor, type CursorKind } from './cursors';

initCursors();

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const mini = document.querySelector<HTMLCanvasElement>('#mini')!;
const mctx = mini.getContext('2d')!;
const regen = document.querySelector<HTMLButtonElement>('#regen')!;
const versionEl = document.querySelector<HTMLSelectElement>('#version')!;
const menuBtn = document.querySelector<HTMLButtonElement>('#menuBtn')!;
const menu = document.querySelector<HTMLDivElement>('#menu')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;
const selectBtn = document.querySelector<HTMLButtonElement>('#selectBtn')!;
const selBar = document.querySelector<HTMLDivElement>('#selBar')!;
const selMenu = document.querySelector<HTMLDivElement>('#selMenu')!;
const typesEl = document.querySelector<HTMLSpanElement>('#types')!;
const noTypes = document.querySelector<HTMLSpanElement>('#noTypes')!;
const allBtn = document.querySelector<HTMLButtonElement>('#allBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const actsEl = document.querySelector<HTMLDivElement>('#acts')!;
const confirmEl = document.querySelector<HTMLDivElement>('#confirm')!;
const okBtn = document.querySelector<HTMLButtonElement>('#okBtn')!;
const noBtn = document.querySelector<HTMLButtonElement>('#noBtn')!;
const homeBtn = document.querySelector<HTMLButtonElement>('#homeBtn')!;
const picker = document.querySelector<HTMLDivElement>('#picker')!;
const pickMaps = picker.querySelector<HTMLDivElement>('.maps')!;
const rerollBtn = document.querySelector<HTMLButtonElement>('#reroll')!;
const pickClose = document.querySelector<HTMLButtonElement>('#pickClose')!;
const pickStages = picker.querySelector<HTMLDivElement>('.stages')!;

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

// ---------- Toolbar and the selection menu ----------
// Select opens the selection menu above the toolbar (so does tapping a unit):
// a button for each kind of unit of yours on screen, with how many there are,
// which adds them all to the selection or takes them out of it, then All and
// Clear. A drag on a touch screen pans; with a mouse it draws a box.

let lastNames: string[] = [];
let selOpen = false;

function setSelOpen(open: boolean): void {
  selOpen = open;
  selectBtn.setAttribute('aria-pressed', String(open));
  typesKey = '';
  updateSelBar();
}
selectBtn.addEventListener('click', () => setSelOpen(!selOpen));
allBtn.addEventListener('click', () => selectView(true));
clearBtn.addEventListener('click', () => game?.deselect());

// Commands for the selection (Deploy, Pack up...), drawn as buttons before
// More and Clear. They are refreshed every frame, but the buttons are only
// rebuilt when something about them changes.
const ICONS: Record<string, string> = {
  // arrows pushing out from a box
  deploy: '<rect x="4" y="4" width="3" height="3"/><rect x="5" y="0" width="1" height="3"/><rect x="4" y="1" width="3" height="1"/><rect x="5" y="8" width="1" height="3"/><rect x="4" y="9" width="3" height="1"/><rect x="0" y="5" width="3" height="1"/><rect x="1" y="4" width="1" height="3"/><rect x="8" y="5" width="3" height="1"/><rect x="9" y="4" width="1" height="3"/>',
  // arrows folding in
  ok: '<rect x="1" y="5" width="2" height="2"/><rect x="3" y="7" width="2" height="2"/><rect x="5" y="5" width="2" height="2"/><rect x="7" y="3" width="2" height="2"/><rect x="9" y="1" width="1" height="2"/>',
  x: '<rect x="1" y="1" width="2" height="2"/><rect x="3" y="3" width="2" height="2"/><rect x="5" y="5" width="1" height="1"/><rect x="6" y="6" width="2" height="2"/><rect x="8" y="8" width="2" height="2"/><rect x="8" y="1" width="2" height="2"/><rect x="6" y="3" width="2" height="2"/><rect x="3" y="6" width="2" height="2"/><rect x="1" y="8" width="2" height="2"/>',
  star: '<rect x="5" y="0" width="1" height="3"/><rect x="4" y="3" width="3" height="1"/><rect x="0" y="4" width="11" height="1"/><rect x="2" y="5" width="7" height="1"/><rect x="3" y="6" width="5" height="1"/><rect x="2" y="7" width="7" height="2"/><rect x="1" y="9" width="2" height="2"/><rect x="8" y="9" width="2" height="2"/>',
  ore: '<rect x="2" y="5" width="2" height="5"/><rect x="5" y="2" width="2" height="8"/><rect x="8" y="4" width="2" height="6"/><rect x="3" y="4" width="1" height="1"/><rect x="5" y="1" width="1" height="1"/><rect x="8" y="3" width="1" height="1"/><rect x="0" y="10" width="11" height="1"/>',
  pack: '<rect x="4" y="4" width="3" height="3"/><rect x="5" y="0" width="1" height="3"/><rect x="4" y="2" width="3" height="1"/><rect x="5" y="8" width="1" height="3"/><rect x="4" y="8" width="3" height="1"/><rect x="0" y="5" width="3" height="1"/><rect x="2" y="4" width="1" height="3"/><rect x="8" y="5" width="3" height="1"/><rect x="8" y="4" width="1" height="3"/>',
};
let actsKey = '';
let hasActs = false;
// The bar above the toolbar: commands for the selection, and the selection menu.
function updateSelBar(): void {
  const menuOn = selOpen && !placingNow();
  selMenu.hidden = !menuOn;
  actsEl.hidden = !hasActs;
  selBar.hidden = !menuOn && !hasActs;
}

// The map rect that counts as on screen: the view, or from space the near
// side of the world.
function viewRect(): [number, number, number, number] {
  if (planet) return [cen.x - built.w / 4, cen.y - built.h / 4, cen.x + built.w / 4, cen.y + built.h / 4];
  return [camX(), camY(), camX() + view.w, camY() + view.h];
}

// The selection menu's buttons, checked every frame as units come and go
// from the view, and only rebuilt when something about them changes.
let typesKey = '';
function refreshTypes(): void {
  if (!selOpen || selMenu.hidden || !game) return;
  const r = viewRect();
  const types = game.unitTypes?.(...r) ?? [];
  const key = JSON.stringify([types.map((t) => [t.kind, t.count, t.sel]), lastNames.length]);
  if (key === typesKey) return;
  typesKey = key;
  noTypes.hidden = types.length > 0 || !game.unitTypes;
  allBtn.hidden = types.length > 0 ? types.every((t) => t.sel === t.count) : !!game.unitTypes;
  clearBtn.disabled = lastNames.length === 0;
  typesEl.replaceChildren(
    ...types.map((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'type';
      const all = t.sel === t.count;
      b.classList.toggle('part', t.sel > 0 && !all);
      b.setAttribute('aria-pressed', String(all));
      b.title = `${t.name}: ${t.sel ? `${t.sel} of ${t.count} selected` : `${t.count} on screen`}`;
      b.setAttribute('aria-label', b.title);
      const img = document.createElement('img');
      img.src = t.icon;
      img.alt = '';
      const n = document.createElement('span');
      n.className = 'count';
      n.textContent = t.sel && !all ? `${t.sel}/${t.count}` : String(t.count);
      const pic = document.createElement('span');
      pic.className = 'pic';
      pic.append(img);
      b.append(pic, n);
      // a kind not all selected: add the rest; all selected: drop them
      b.addEventListener('click', () => game.selectKind?.(t.kind, !all, ...viewRect()));
      return b;
    }),
  );
}
function refreshActions(): void {
  const acts = (!planet && game?.actions?.()) || [];
  const key = JSON.stringify(acts);
  if (key === actsKey) return;
  actsKey = key;
  hasActs = acts.length > 0;
  updateSelBar();
  actsEl.replaceChildren(
    ...acts.map((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act';
      b.disabled = !!a.disabled;
      if (a.title) b.title = a.title;
      b.innerHTML = `<svg viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true">${ICONS[a.icon] ?? ''}</svg>`;
      b.append(a.label);
      b.addEventListener('click', () => game.act?.(a.id));
      return b;
    }),
  );
}

// Everything on screen; from space, everything on the near side of the world.
function selectView(add: boolean): void {
  if (!game) return;
  game.boxSelect(...viewRect(), add);
}

function showSelection(names: string[]): void {
  // picking something opens the menu, so you can add other kinds to it
  if (names.length && !lastNames.length && !selOpen) setSelOpen(true);
  lastNames = names;
  typesKey = '';
  if (!names.length) setPending(null);
  updateSelBar();
}

// ---------- Confirming orders on a touch screen ----------
// With units selected, a tap on the ground (or an enemy) doesn't send them
// straight away: a green check comes up where you tapped, with a red X next
// to it. The check sends them, the X calls it off, and another tap moves it.
let pending: { x: number; y: number } | null = null;
function setPending(p: { x: number; y: number } | null): void {
  pending = p;
  confirmEl.hidden = !p;
  if (p) placeConfirm();
}
// Keep the check over the map point as the camera moves.
function placeConfirm(): void {
  if (!pending) return;
  if (planet) {
    setPending(null);
    return;
  }
  const r = canvas.getBoundingClientRect();
  confirmEl.style.transform = `translate(${Math.round(r.left + (pending.x - camX()) * scale)}px, ${Math.round(r.top + (pending.y - camY()) * scale)}px)`;
}
okBtn.addEventListener('click', () => {
  if (!pending || !game) return;
  const p = pending;
  setPending(null);
  game.click(p.x, p.y, false);
});
noBtn.addEventListener('click', () => setPending(null));

// Home: back to your base (the Foundry, or the vehicle that will become one),
// on the copy of the world nearest the camera, down from space if need be.
function goHome(): void {
  if (!game || !built.w) return;
  const p = game.homeBase?.() ?? game.focus();
  cen.x = p.x + Math.round((cen.x - p.x) / built.w) * built.w;
  cen.y = p.y + Math.round((cen.y - p.y) / built.h) * built.h;
  if (planet) {
    zoom = 1;
    applyScale();
  }
  clampCen();
}
homeBtn.addEventListener('click', goHome);

// ---------- Sizing, camera and zoom ----------

// `base` is the default number of CSS pixels per art pixel (roughly a 640-720
// pixel wide view); `scale` is the current one, after zooming.
let base = 2;
let scale = 2;
let zoom = 1; // scale / base
const ZOOM_MAX = 3;
// Zooming out past Z_SPACE takes you up into space, where the world is a
// globe. It starts out far bigger than the screen and keeps shrinking as you
// zoom out, down to zMin, where it fits the screen with room to spare.
const Z_SPACE = 0.5;
let zMin = 0.03;
let planet = false;

// The map is twice as wide as it is tall (it wraps round both ways), and
// planet-sized: about fourteen screens across. Its sides are whole numbers of
// ground tiles.
const WORLD = { w: CH * 80, h: CH * 40 };

const TAU = Math.PI * 2;
// Things in the middle of the globe come out a bit smaller than on the flat map
// at the same zoom, so the jump into space always shrinks them.
const GLOBE_K = 0.75;

// The view's size in map pixels, and how many canvas pixels each one gets.
const view = { w: 1, h: 1 };
let dens = 1;
const camX = () => cen.x - view.w / 2;
const camY = () => cen.y - view.h / 2;

// The camera can go anywhere; just keep its numbers from growing without end.
function clampCen(): void {
  if (built.h && Math.abs(cen.y) > built.h * 8) cen.y -= Math.round(cen.y / built.h) * built.h;
}

// Size the canvas for the current zoom. In space the canvas stays at the
// default scale and the globe shrinks instead.
function applyScale(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // smallest globe: about 0.55 of the shorter side of the screen across
  if (built.w) zMin = Math.min(Z_SPACE * 0.9, (0.275 * Math.min(vw, vh) * TAU) / base / (GLOBE_K * built.w));
  zoom = Math.max(zMin, Math.min(ZOOM_MAX, zoom));
  const wasPlanet = planet;
  planet = zoom < Z_SPACE - 1e-6;
  scale = planet ? base : base * zoom;
  const w = Math.ceil(vw / scale);
  const h = Math.ceil(vh / scale);
  view.w = w;
  view.h = h;
  // On the map the canvas holds ART pixels for each map pixel, so the art can
  // be finer than the map's grid; in space the globe is drawn one for one.
  dens = planet || !game?.fine ? 1 : ART;
  if (canvas.width !== w * dens) canvas.width = w * dens;
  if (canvas.height !== h * dens) canvas.height = h * dens;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  mini.hidden = planet;
  if (planet !== wasPlanet) {
    lastSnap = -Infinity; // refresh the globe straight away
    showSelection(lastNames);
    if (built.w) whoosh = { t0: performance.now(), up: planet };
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
    cen.x = m.x - (cx / scale - view.w / 2);
    cen.y = m.y - (cy / scale - view.h / 2);
  }
  clampCen();
}

function fit(force = false): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  base = Math.max(2, Math.round(Math.min(vw, vh * 1.6) / 680));
  if (force || !built.w) {
    game.generate(WORLD.w, WORLD.h);
    built = { ...WORLD };
    globe.clear();
    zoom = 1;
    planet = false;
    applyScale();
    const f = game.focus();
    cen.x = f.x;
    cen.y = f.y;
    lastSnap = -Infinity;
  }
  applyScale();
}

// Building sprites takes a moment, so show a note and yield a frame first.
// Versions with a choice of maps ask which one first.
function start(v: string): void {
  loading.hidden = false;
  requestAnimationFrame(() =>
    setTimeout(() => {
      game = VERSIONS[v](seed);
      game.onSelect = showSelection;
      build.reset();
      built = { w: 0, h: 0 };
      loading.hidden = true;
      if (game.maps) showPicker();
      else makeWorld();
    }, 0),
  );
}

// Generate the world (a fresh one each time) and paint the first view while
// the note is up.
function makeWorld(): void {
  build.reset();
  game.seed = seed;
  loading.hidden = false;
  requestAnimationFrame(() =>
    setTimeout(() => {
      fit(true);
      draw(performance.now(), true);
      loading.hidden = true;
    }, 0),
  );
}

// ---------- Map picker ----------

function showPicker(): void {
  if (!game.maps) return makeWorld();
  setMenu(false);
  pickClose.hidden = !built.w;
  picker.hidden = false;
  // previews are of the seed the new world will be made from
  const was = game.seed;
  game.seed = seed;
  // which stage to start in (for testing), remembered
  const stages = game.stages?.() ?? [];
  pickStages.hidden = !stages.length;
  if (stages.length) {
    const want = load('ra-stage');
    game.stage = stages.some((s) => s.id === want) ? want! : stages[0].id;
    const seg = pickStages.querySelector('.seg')!;
    const blurb = pickStages.querySelector('.blurb')!;
    seg.replaceChildren(
      ...stages.map((st) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.role = 'radio';
        b.textContent = st.name;
        b.setAttribute('aria-checked', String(st.id === game.stage));
        if (st.id === game.stage) blurb.textContent = st.blurb;
        b.addEventListener('click', () => {
          if (st.id === game.stage) return;
          save('ra-stage', st.id);
          showPicker(); // the previews show where you start
        });
        return b;
      }),
    );
  }
  const cards = game.maps().map((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map';
    b.append(game.preview?.(m.id, WORLD.w, WORLD.h) ?? document.createElement('canvas'));
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.name;
    if (i === 0) {
      const tag = document.createElement('span');
      tag.className = 'first';
      tag.textContent = 'Test';
      name.append(tag);
    }
    const blurb = document.createElement('span');
    blurb.className = 'blurb';
    blurb.textContent = m.blurb;
    b.append(name, blurb);
    b.addEventListener('click', () => {
      picker.hidden = true;
      game.mapId = m.id;
      makeWorld();
    });
    return b;
  });
  game.seed = was;
  pickMaps.replaceChildren(...cards);
}
rerollBtn.addEventListener('click', () => {
  seed = Math.floor(Math.random() * 100000);
  showPicker();
});
// back to the game in progress
pickClose.addEventListener('click', () => {
  picker.hidden = true;
});
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
  resizeTimer = window.setTimeout(() => game && built.w && fit(), 150);
});

// New map: a fresh seed, and (where there is a choice) pick the map again.
regen.addEventListener('click', () => {
  setMenu(false);
  seed = Math.floor(Math.random() * 100000);
  if (game.maps) showPicker();
  else makeWorld();
});

// ---------- The globe (space view and minimap) ----------

function spaceView(): View {
  const r = (GLOBE_K * built.w * zoom) / TAU;
  return { cx: view.w / 2, cy: view.h / 2, r, x: cen.x, y: cen.y };
}
function miniView(): View {
  return { cx: mini.width / 2, cy: mini.height / 2, r: mini.width / 2 - 3, x: cen.x, y: cen.y };
}

// Refresh the globe's picture of the map now and then: often enough to see
// armies move, rarely enough to stay cheap.
let lastSnap = -Infinity;
function snapshot(now: number): void {
  if (now - lastSnap < (planet ? 300 : 700)) return;
  lastSnap = now;
  globe.setDots(game.mapDots());
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
  const w = view.w;
  const h = view.h;
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

// ---------- Build menu and placing buildings ----------

const build = initBuild(() => game);
const placingNow = () => !planet && !!game?.placing?.();
// The ghost of the building being placed, in map pixels (on the copy of the
// map in view). Mice move it by hovering and put it down with a click; on a
// touch screen a tap moves it, a drag that starts on it carries it, and the
// Place button puts it down.
let ghostP: { x: number; y: number } | null = null;
function moveGhost(x: number, y: number): void {
  ghostP = { x, y };
  game.placeAt?.(x, y);
}
let wasPlacing = false;
function syncGhost(): void {
  const on = placingNow();
  if (on !== wasPlacing) {
    wasPlacing = on;
    showSelection(lastNames);
  }
  if (!on) {
    ghostP = null;
    return;
  }
  if (!ghostP) moveGhost(cen.x, cen.y + 20);
}
let ghostDrag: { dx: number; dy: number } | null = null;

// ---------- Pointer input ----------
// A tap selects a unit or sends the selection (on a touch screen, once you
// confirm it). A drag pans on a touch screen and draws a selection box with a
// mouse; the middle mouse button pans. In space, a drag spins the world and a
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
      cen.x = pinch.wx - (p.mx / scale - view.w / 2);
      cen.y = pinch.wy - (p.my / scale - view.h / 2);
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
  if (game.moveMarks !== undefined) game.moveMarks = e.pointerType !== 'mouse';
  const p = toMap(e.clientX, e.clientY);
  if (placingNow()) {
    if (e.button === 2) {
      game.act?.('unplace');
      return;
    }
    // a drag that starts on the ghost carries it; anywhere else it pans
    ghostDrag = null;
    if (ghostP && e.pointerType !== 'mouse' && Math.hypot(p.x - ghostP.x, p.y - (ghostP.y - 12)) < 34) ghostDrag = { dx: ghostP.x - p.x, dy: ghostP.y - p.y };
    down = { ...p, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, pan: !ghostDrag };
    dragging = false;
    return;
  }
  if (e.button === 2) {
    if (planet) spaceTap(e, true);
    else {
      clicked();
      game.order(p.x, p.y);
    }
    return;
  }
  down = { ...p, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, pan: planet || e.pointerType !== 'mouse' || e.button === 1 };
  dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (multi) return;
  if (placingNow() && e.pointerType === 'mouse' && (!down || !dragging)) {
    const p = toMap(e.clientX, e.clientY);
    moveGhost(p.x, p.y);
  }
  if (!down || e.pointerId !== down.id) return;
  if (!dragging && Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 8) dragging = true;
  if (dragging && ghostDrag && placingNow()) {
    const p = toMap(e.clientX, e.clientY);
    moveGhost(p.x + ghostDrag.dx, p.y + ghostDrag.dy);
    down.lx = e.clientX;
    down.ly = e.clientY;
    return;
  }
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

// A tap on the map with a finger: orders wait for the check.
function touchTap(x: number, y: number): void {
  const what = game.cursorAt?.(x, y);
  if (what === 'move' || what === 'attack') setPending({ x, y });
  else {
    setPending(null);
    game.click(x, y, false);
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
  const add = e.shiftKey || e.ctrlKey || e.metaKey;
  if (!cancel && placingNow()) {
    if (!dragging) {
      moveGhost(p.x, p.y);
      if (e.pointerType === 'mouse') game.act?.('place');
    }
  } else if (!cancel) {
    if (planet) {
      if (!dragging) spaceTap(e);
    } else if (!dragging) {
      if (e.pointerType === 'mouse') {
        clicked();
        game.click(down.x, down.y, add);
      } else touchTap(down.x, down.y);
    } else if (!down.pan) game.boxSelect(down.x, down.y, p.x, p.y, add);
  }
  box = null;
  down = null;
  dragging = false;
  ghostDrag = null;
};
canvas.addEventListener('pointerup', (e) => finish(e, false));

// With a mouse, the pointer shows what a click would do: pick a unit (white
// corners, breathing), send your units there (green arrowheads, slowly
// turning, with a burst when clicked), set a rally point, place a building,
// or can't. Checked every frame, as the units and the camera move under a
// still mouse too.
let mouse: { x: number; y: number } | null = null;
let cursor = '';
let cursorKind: CursorKind = 'arrow';
// when the last move or attack order was clicked, for the cursor's burst
let movedAt = -Infinity;
let attackedAt = -Infinity;
// A click with the move or attack cursor showing: play its burst.
function clicked(): void {
  if (cursorKind === 'move') movedAt = performance.now();
  else if (cursorKind === 'attack') attackedAt = performance.now();
}
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => (mouse = null));
function hoverNow(now: number): void {
  const m = mouse && toMap(mouse.x, mouse.y);
  let k: CursorKind = 'arrow';
  if (down && (down.pan || ghostDrag) && (dragging || planet)) k = 'grabbing';
  else if (m && !planet && !(dragging && box) && picker.hidden) {
    const what = game.cursorAt?.(m.x, m.y);
    if (what === 'pick') k = 'corners';
    else if (what) k = what;
  } else if (planet) k = 'grab';
  const burst = Math.floor((now - movedAt) / 55);
  if (burst >= 0 && burst < MOVE_CLICK_FRAMES && k !== 'grabbing') k = 'move';
  const shot = Math.floor((now - attackedAt) / 55);
  const shooting = shot >= 0 && shot < ATTACK_CLICK_FRAMES && k !== 'grabbing';
  if (shooting) k = 'attack';
  cursorKind = k;
  canvas.dataset.cursor = k;
  let css = CURSORS[k];
  if (k === 'corners') css = CORNER_FRAMES[Math.floor(now / 140) % CORNER_FRAMES.length];
  else if (k === 'attack') css = shooting ? ATTACK_CLICK_CSS[shot] : ATTACK_FRAMES[Math.floor(now / 140) % ATTACK_FRAMES.length];
  else if (k === 'move') css = moveCursor(Math.floor(now / 150) % MOVE_STEPS, burst < MOVE_CLICK_FRAMES ? burst : -1);
  if (css !== cursor) {
    cursor = css;
    canvas.style.cursor = css;
  }
}
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

// ---------- Keyboard: WASD or the arrow keys pan, Q opens the selection menu, +/- zoom, Esc clears ----------

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (!game || (e.target as HTMLElement).tagName === 'SELECT') return;
  if (!picker.hidden) {
    if (e.key === 'Escape' && !pickClose.hidden) pickClose.click();
    return;
  }
  // (with ctrl or cmd held, letters are the browser's: ctrl+S, ctrl+D...)
  if (!e.ctrlKey && !e.metaKey && !e.altKey) keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') {
    if (!menu.hidden) setMenu(false);
    else if (placingNow()) game.act?.('unplace');
    else if (pending) setPending(null);
    else if (lastNames.length) game.deselect();
    else setSelOpen(false);
  }
  if (e.key === 'b') document.querySelector<HTMLButtonElement>('#buildBtn:not([hidden])')?.click();
  if (e.key === 'q') setSelOpen(!selOpen);
  if (e.key === 'f') game.act?.('deploy');
  if (e.key === 'h') goHome();
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

// Crossing between the map and space: a bright haze and wisps of cloud
// rushing past, outwards as you fall into the atmosphere, inwards as you rise.
let whoosh: { t0: number; up: boolean } | null = null;
const WHOOSH_MS = 700;
function drawWhoosh(now: number): void {
  if (!whoosh) return;
  // (a frame's timestamp can be a moment older than the zoom that started it)
  const t = Math.max(0, (now - whoosh.t0) / WHOOSH_MS);
  if (t >= 1) {
    whoosh = null;
    return;
  }
  const w = view.w;
  const h = view.h;
  const R = Math.hypot(w, h) / 2;
  const fade = Math.sin(Math.PI * t);
  ctx.setTransform(dens, 0, 0, dens, 0, 0);
  ctx.fillStyle = `rgba(205,228,255,${0.5 * fade})`;
  ctx.fillRect(0, 0, w, h);
  // soft wisps of cloud, stretched along their path
  for (let i = 0; i < 46; i++) {
    const a = hashf(i, 1) * TAU;
    let p = (hashf(i, 2) + t * 1.2) % 1;
    if (whoosh.up) p = 1 - p;
    const d = (0.05 + p * 1.05) * R;
    const len = (0.1 + 0.35 * p) * R;
    const wid = (0.03 + 0.07 * hashf(i, 3)) * R * (0.5 + p);
    const alpha = (0.3 + 0.5 * hashf(i, 4)) * fade * Math.min(1, p * 4);
    ctx.save();
    ctx.translate(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.8);
    ctx.rotate(a);
    ctx.scale(len, wid);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.5, `rgba(235,244,255,${alpha * 0.45})`);
    g.addColorStop(1, 'rgba(235,244,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
const hashf = (i: number, k: number) => {
  let x = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 40503);
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};

let last = performance.now();
let mapVersion = 0;
let lastMap = -Infinity;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game && built.w) {
    const sp = (320 * dt) / zoom;
    if (keys.has('arrowleft') || keys.has('a')) cen.x -= sp;
    if (keys.has('arrowright') || keys.has('d')) cen.x += sp;
    if (keys.has('arrowup') || keys.has('w')) cen.y -= sp / 2;
    if (keys.has('arrowdown') || keys.has('s')) cen.y += sp / 2;
    clampCen();
    game.update(dt);
    hoverNow(now);
    draw(now, false);
  }
  requestAnimationFrame(frame);
}

// Draw a frame. `first` paints every ground tile in view straight away.
function draw(now: number, first: boolean): void {
  globe.time = now / 1000;
  // the globe's picture of the map is built in the background, or at once if
  // it is needed now
  if (!globe.ready && game.mapStep(planet ? 1e9 : first ? 0 : 12)) {
    globe.setMap(built.w, built.h, game.mapImage());
    mapVersion = game.mapVersion ?? 0;
  }
  // a base changed: redraw the globe's picture of the map
  if (globe.ready && (game.mapVersion ?? 0) !== mapVersion && now - lastMap > 500) {
    lastMap = now;
    mapVersion = game.mapVersion ?? 0;
    globe.setMap(built.w, built.h, game.mapImage());
    lastSnap = -Infinity;
  }
  refreshActions();
  syncGhost();
  refreshTypes();
  placeConfirm();
  build.update(now);
  if (first) lastSnap = -Infinity;
  snapshot(now);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (planet) {
    const v = spaceView();
    globe.draw(ctx, v, true);
    drawSelected(ctx, v, 2);
  } else {
    // the view shakes when something big is destroyed near the middle of it:
    // less zoomed out, and not at all by the time you are near space
    const [shx, shy] = game.shake?.() ?? [0, 0];
    const shk = Math.max(0, Math.min(1, (zoom - Z_SPACE) / 0.4)) / Math.sqrt(Math.max(1, zoom));
    const ox = Math.round(shx * shk * dens) / dens;
    const oy = Math.round(shy * shk * dens) / dens;
    const x0 = Math.round(camX()) + ox;
    const y0 = Math.round(camY()) + oy;
    const x1 = x0 + view.w;
    const y1 = y0 + view.h;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dens, 0, 0, dens, -x0 * dens, -y0 * dens);
    // (a whole-pixel rect a little bigger, so a shake shows no unpainted edge)
    const m = ox || oy ? 5 : 0;
    game.renderGround(Math.floor(x0) - m, Math.floor(y0) - m, Math.ceil(x1) + m, Math.ceil(y1) + m, first ? 1e5 : 10);
    // Objects for every copy of the map in view (sprites hang over the edges).
    const W = built.w;
    const H = built.h;
    const pad = 80;
    for (let j = Math.floor((y0 - pad) / H); j <= Math.floor((y1 + pad) / H); j++)
      for (let k = Math.floor((x0 - pad) / W); k <= Math.floor((x1 + pad) / W); k++) {
        ctx.setTransform(dens, 0, 0, dens, (k * W - x0) * dens, (j * H - y0) * dens);
        game.renderObjects(x0 - k * W, y0 - j * H, x1 - k * W, y1 - j * H);
      }
    ctx.setTransform(dens, 0, 0, dens, 0, 0);
    drawBox();
    if (globe.ready) drawMini();
  }
  drawWhoosh(now);
}
requestAnimationFrame(frame);

// Handy for poking at the scene from the console.
Object.defineProperty(window, 'game', { get: () => game });
Object.defineProperty(window, 'cam', { get: () => ({ x: camX(), y: camY(), cx: cen.x, cy: cen.y }) });
Object.defineProperty(window, 'zoom', { get: () => zoom });
if (import.meta.env.DEV) Object.assign(window, { cen }); // to move the camera from the console
Object.defineProperty(window, 'planet', { get: () => planet });
Object.defineProperty(window, 'look', {
  value: (x: number, y: number) => {
    cen.x = x;
    cen.y = y;
  },
});
