import './style.css';
import './theme.css';
import { applyTheme } from './theme';
import { lineIcon, type IconName } from './line-icons';
import { GROUP_COUNT, type GameLike } from './types';
import { Globe, View } from './planet';
import { CH } from './tiles';
import { ART } from './gfx';
import { IsoGame } from './v2/game';
import { setMood, setMusicPaused } from './music';
import { play, setWorldLevel, ui } from './sfx';
import { onSettings, resetSettings, setSetting, settings, type Settings } from './settings';
import { initBuild } from './build-ui';
import { Lobby, type Match } from './lobby';
import { Bot } from './v2/bot';
import { startArtPool } from './v2/art-pool';
import { ATTACK_CLICK_CSS, ATTACK_CLICK_FRAMES, ATTACK_FRAMES, CORNER_FRAMES, CURSORS, DEPLOY_CLICK_CSS, DEPLOY_FRAMES, ENTER_CLICK_CSS, ENTER_CLICK_FRAMES, ENTER_FRAMES, ENTER_RING_SIZE, MOVE_CLICK_FRAMES, REPAIR_CLICK_CSS, REPAIR_CLICK_FRAMES, REPAIR_FRAMES, UNLOAD_CLICK_CSS, UNLOAD_FRAMES, repairRingFrames, DROP_CLICK_CSS, DROP_CLICK_FRAMES, DROP_FRAMES, dropRingFrames, MOVE_RING_SIZE, MOVE_STEPS, attackRingFrames, enterRingFrames, harvestRingFrames, initCursors, moveCursor, moveRingFrames, type CursorKind } from './cursors';

initCursors();

// The newest PR in this build (set by CI), as a tiny label in the corner.
applyTheme();

const prNo = import.meta.env.VITE_PR_NUMBER;
if (prNo) {
  const el = document.querySelector<HTMLDivElement>('#build-no')!;
  el.textContent = `#${prNo}`;
  el.hidden = false;
}

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const mini = document.querySelector<HTMLCanvasElement>('#mini')!;
const mctx = mini.getContext('2d')!;
const regen = document.querySelector<HTMLButtonElement>('#regen')!;
const menuBtn = document.querySelector<HTMLButtonElement>('#menuBtn')!;
const menu = document.querySelector<HTMLDivElement>('#menu')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;
const selectBtn = document.querySelector<HTMLButtonElement>('#selectBtn')!;
const selBar = document.querySelector<HTMLDivElement>('#selBar')!;
const selMenu = document.querySelector<HTMLDivElement>('#selMenu')!;
const typesEl = document.querySelector<HTMLSpanElement>('#types')!;
const groupBtns = [...document.querySelectorAll<HTMLButtonElement>('#toolbar button.grp')];
const noTypes = document.querySelector<HTMLSpanElement>('#noTypes')!;
const allBtn = document.querySelector<HTMLButtonElement>('#allBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const actsEl = document.querySelector<HTMLDivElement>('#acts')!;
const confirmEl = document.querySelector<HTMLDivElement>('#confirm')!;
const okBtn = document.querySelector<HTMLButtonElement>('#okBtn')!;
const okRing = document.querySelector<HTMLDivElement>('#okRing')!;
const deployBtn = document.querySelector<HTMLButtonElement>('#deployBtn')!;
const homeBtn = document.querySelector<HTMLButtonElement>('#homeBtn')!;
const picker = document.querySelector<HTMLDivElement>('#picker')!;
const pickMaps = picker.querySelector<HTMLDivElement>('.maps')!;
const rerollBtn = document.querySelector<HTMLButtonElement>('#reroll')!;
const pickClose = document.querySelector<HTMLButtonElement>('#pickClose')!;
const pickStages = picker.querySelector<HTMLDivElement>('.stages')!;

const params = new URLSearchParams(location.search);

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
// The camera is the map point at the center of the screen. The map wraps
// round both ways, and the camera's x and y keep counting as you go round,
// which is how orders know which way round to send units.
const cen = { x: 0, y: 0 };
const globe = new Globe();

// ---------- Menu ----------

function setMenu(open: boolean): void {
  menu.hidden = !open;
  if (!open) menu.classList.remove('settings-open', 'keys-open');
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) setMenu(false);
});

// ---------- Toolbar and the selection menu ----------
// Select (touch screens only: with a mouse you drag a box, and the menu never
// shows) opens the selection menu above the toolbar (so does tapping a unit):
// a button for each kind of unit of yours on screen, with how many there are,
// which adds them all to the selection or takes them out of it, then All and
// Clear. A drag on a touch screen pans; with a mouse it draws a box.

let lastNames: string[] = [];
let selOpen = false;
// Once you order the selection somewhere it is locked as a group: the menu
// shows just those units, as one button with how many there are, and taps
// send them rather than pick others, until you clear it. A selection made
// with the menu's buttons is locked too as soon as you pan away or tap the
// map, so it doesn't drop the units that go off screen.
let locked = false;
// A mouse (and no touch screen as the main pointer): no Select button, and no
// selection menu either (you drag a box, Shift+click and Ctrl+A instead).
const mouseOnly = window.matchMedia('(hover: hover) and (pointer: fine)');
// the selection was made with the menu, at this camera position
let menuPick: { x: number; y: number } | null = null;
function lockGroup(): void {
  menuPick = null;
  if (!game || !game.selectedPoints().length || !game.selectedTypes) return;
  if (!game.selectedTypes().length) return; // a building: nothing to lock
  locked = true;
  typesKey = '';
  if (!selOpen) setSelOpen(true);
}
function pickedWithMenu(): void {
  if (!locked && lastNames.length) menuPick = { x: cen.x, y: cen.y };
}
// Every frame: a menu selection is locked once the view moves.
function lockOnPan(): void {
  if (menuPick && !locked && Math.hypot(cen.x - menuPick.x, cen.y - menuPick.y) > 2) lockGroup();
}

// ---------- Groups ----------
// Group 1 and Group 2 show on the toolbar while units are selected (and
// while a group has units in it). With the group empty, tapping it puts the
// selection in it; once it has units, tapping it selects them again,
// wherever they are, and tapping it again takes you to them. A long press
// (or Shift+click, or Shift+1 and Shift+2) puts the selection in it instead.
function assignGroup(g: number): void {
  if (g >= GROUP_COUNT || !game?.setGroup || !game.selectedTypes?.().length) return;
  game.setGroup(g);
  groupsKey = '';
  play('order_confirm', 0.6, { ui: true });
  lockGroup();
}
function pickGroup(g: number): void {
  if (g >= GROUP_COUNT || !game?.selectGroup || !game.groups) return;
  const was = game.groups().find((x) => x.n === g)?.sel;
  setPending(null);
  if (!game.selectGroup(g)) return;
  lockGroup();
  if (was) goToSelection();
}
for (const [g, b] of groupBtns.entries()) {
  let press = 0;
  let held = false;
  b.addEventListener('pointerdown', () => {
    held = false;
    clearTimeout(press);
    press = window.setTimeout(() => {
      held = true;
      assignGroup(g);
    }, 500);
  });
  const stop = () => clearTimeout(press);
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointerleave', stop);
  b.addEventListener('pointercancel', stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', (e) => {
    if (held) return; // a long press already did it
    const has = game?.groups?.().some((x) => x.n === g);
    if (e.shiftKey || e.ctrlKey || e.metaKey || !has) assignGroup(g);
    else pickGroup(g);
  });
}
// Every frame: which group buttons show, and how many units are in each.
let groupsKey = '';
function refreshGroups(): void {
  const groups = game?.groups ? game.groups() : [];
  const canSet = !!game?.setGroup && (game.selectedTypes?.().length ?? 0) > 0;
  const key = JSON.stringify([groups.map((g) => [g.n, g.count, g.sel]), canSet]);
  if (key === groupsKey) return;
  groupsKey = key;
  for (const [i, b] of groupBtns.entries()) {
    const g = groups.find((x) => x.n === i);
    b.hidden = !g && !canSet;
    b.setAttribute('aria-pressed', String(!!g?.sel));
    b.querySelector('.count')!.textContent = g ? String(g.count) : '';
    b.title = g
      ? `Group ${i + 1}: ${g.count} unit${g.count === 1 ? '' : 's'} (${i + 1})${g.sel ? ', tap again to go to them' : ''}. Hold (or Shift+${i + 1}) to put the selection in it`
      : `Put the selection in Group ${i + 1} (Shift+${i + 1})`;
    b.setAttribute('aria-label', b.title);
  }
}

// Center the view on the selection (the copy of it nearest the camera).
function goToSelection(): void {
  const pts = game?.selectedPoints() ?? [];
  if (!pts.length || !built.w) return;
  const [rx, ry] = pts[0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x - Math.round((x - rx) / built.w) * built.w;
    sy += y - Math.round((y - ry) / built.h) * built.h;
  }
  const px = sx / pts.length;
  const py = sy / pts.length;
  cen.x = px + Math.round((cen.x - px) / built.w) * built.w;
  cen.y = py + Math.round((cen.y - py) / built.h) * built.h;
  if (planet) {
    zoom = 1;
    applyScale();
  }
  clampCen();
}

function setSelOpen(open: boolean): void {
  selOpen = open && !mouseOnly.matches;
  selectBtn.setAttribute('aria-pressed', String(open));
  typesKey = '';
  updateSelBar();
}
selectBtn.addEventListener('click', () => setSelOpen(!selOpen));
allBtn.addEventListener('click', () => {
  selectView(true);
  pickedWithMenu();
});
clearBtn.addEventListener('click', () => game?.deselect());

// Commands for the selection (Deploy, Pack up...), drawn as buttons before
// More and Clear. They are refreshed every frame, but the buttons are only
// rebuilt when something about them changes.
// the icons on the selection's command buttons (types.ts Act.icon)
const ICONS: Record<string, IconName> = { deploy: 'deploy', ok: 'check', x: 'close', star: 'star', pack: 'pack', unload: 'unload', chute: 'chute' };
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
  const types = locked ? (game.selectedTypes?.() ?? []) : (game.unitTypes?.(...viewRect()) ?? []);
  const key = JSON.stringify([locked, types.map((t) => [t.kind, t.count, t.sel]), lastNames.length]);
  if (key === typesKey) return;
  typesKey = key;
  noTypes.hidden = locked || types.length > 0 || !game.unitTypes;
  // All and Clear share one slot, so the bar doesn't shift: All while nothing
  // is selected (grayed out with nothing on screen), Clear once something is
  const any = lastNames.length > 0;
  allBtn.hidden = any;
  allBtn.disabled = !!game.unitTypes && types.length === 0;
  clearBtn.hidden = !any;
  typesEl.classList.toggle('group', locked);
  typesEl.hidden = false;
  if (locked) {
    // the group as one button: the picture of its most common kind and how
    // many there are in all; tap it to go to them
    const total = types.reduce((n, t) => n + t.count, 0);
    const top = [...types].sort((a, b) => b.count - a.count)[0];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'type whole';
    b.setAttribute('aria-pressed', 'true');
    b.title = `${types.map((t) => `${t.count} ${t.name}`).join(', ')}: tap to go to them (Clear to pick again)`;
    b.setAttribute('aria-label', b.title);
    if (top) b.append(pictureOf(top.icon));
    b.append(countOf(String(total)));
    b.addEventListener('click', goToSelection);
    typesEl.replaceChildren(b);
    return;
  }
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
      b.append(pictureOf(t.icon), countOf(t.sel && !all ? `${t.sel}/${t.count}` : String(t.count)));
      // a kind not all selected: add the rest; all selected: drop them
      b.addEventListener('click', () => {
        game.selectKind?.(t.kind, !all, ...viewRect());
        pickedWithMenu();
      });
      return b;
    }),
  );
}
function pictureOf(src: string): HTMLSpanElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  const pic = document.createElement('span');
  pic.className = 'pic';
  pic.append(img);
  return pic;
}
function countOf(text: string): HTMLSpanElement {
  const n = document.createElement('span');
  n.className = 'count';
  n.textContent = text;
  return n;
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
      b.innerHTML = ICONS[a.icon] ? lineIcon(ICONS[a.icon]) : '';
      b.append(a.label);
      b.addEventListener('click', () => game.act?.(a.id));
      return b;
    }),
  );
}

// Everything on screen; from space, everything on the near side of the world.
function selectView(add: boolean): void {
  if (!game) return;
  if (game.selectAll) game.selectAll(...viewRect(), add);
  else game.boxSelect(...viewRect(), add);
}

function showSelection(names: string[]): void {
  // picking something opens the menu, so you can add other kinds to it
  if (names.length && !lastNames.length && !selOpen) setSelOpen(true);
  lastNames = names;
  typesKey = '';
  if (!names.length) {
    setPending(null);
    locked = false;
    menuPick = null;
    // with a mouse there is no Select button to close it: it goes with the selection
    if (selOpen && mouseOnly.matches) {
      selOpen = false;
      selectBtn.setAttribute('aria-pressed', 'false');
    }
  }
  updateSelBar();
}

// ---------- Confirming orders on a touch screen ----------
// With units selected, a tap on the ground (or an enemy) doesn't send them
// straight away: a round green check comes up where you tapped, with the move
// cursor's arrowheads turning round it. The check sends them, another tap
// moves it, and clearing the selection calls it off.
// kind: attack is a tap on an enemy (red, with a gunsight), harvest a tap on
// ore with an ore hauler selected (gold, inside the harvest cursor's gold
// arrowheads), enter a tap on a transport of yours with soldiers selected
// (they get in) or on your refinery with an ore hauler selected (it unloads
// there), gold under the enter cursor's triangles
type Order = 'move' | 'attack' | 'harvest' | 'enter' | 'repair' | 'drop';
let pending: { x: number; y: number; kind: Order } | null = null;
let ringFrame = -1;
function setPending(p: { x: number; y: number; kind: Order } | null): void {
  pending = p;
  confirmEl.hidden = !p;
  confirmEl.classList.toggle('foe', p?.kind === 'attack');
  confirmEl.classList.toggle('ore', p?.kind === 'harvest' || p?.kind === 'enter' || p?.kind === 'repair');
  confirmEl.classList.toggle('sky', p?.kind === 'drop');
  okBtn.title = p?.kind === 'attack' ? 'Attack it' : p?.kind === 'harvest' ? 'Dig this ore' : p?.kind === 'enter' ? 'Go in' : p?.kind === 'repair' ? 'Repair it' : p?.kind === 'drop' ? 'Drop them here' : 'Send them here';
  okBtn.setAttribute('aria-label', `${okBtn.title} (clear the selection to call it off)`);
  ringFrame = -1;
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
  // the arrowheads at the game's pixel size, turning as the cursor does
  const px = Math.max(3, Math.round(base) + 1);
  const size = `${(pending.kind === 'enter' || pending.kind === 'repair' || pending.kind === 'drop' ? ENTER_RING_SIZE : MOVE_RING_SIZE) * px}px`;
  if (okRing.style.width !== size) {
    okRing.style.width = okRing.style.height = size;
    okRing.style.backgroundSize = size;
  }
  const frames = pending.kind === 'attack' ? attackRingFrames() : pending.kind === 'harvest' ? harvestRingFrames() : pending.kind === 'enter' ? enterRingFrames() : pending.kind === 'repair' ? repairRingFrames() : pending.kind === 'drop' ? dropRingFrames() : moveRingFrames();
  const i = Math.floor(performance.now() / 150) % frames.length;
  if (i !== ringFrame) {
    ringFrame = i;
    okRing.style.backgroundImage = `url(${frames[i]})`;
  }
  confirmEl.style.transform = `translate(${Math.round(r.left + (pending.x - camX()) * scale)}px, ${Math.round(r.top + (pending.y - camY()) * scale)}px)`;
}
// A lone selected MCU gets a Deploy button floating just above it. With a
// mouse the deploy cursor over it does that job (and F or Space), so the
// button only shows there to say why it can't deploy where it is.
deployBtn.innerHTML = `${lineIcon('deploy')}Deploy`;
deployBtn.addEventListener('click', () => game?.act?.('deploy'));
let deployKey = '';
function placeDeploy(): void {
  let d = (!planet && game?.deployAt?.()) || null;
  if (d?.ok && mouseOnly.matches) d = null;
  deployBtn.hidden = !d;
  if (!d) {
    deployKey = '';
    return;
  }
  const key = String(d.ok);
  if (key !== deployKey) {
    deployKey = key;
    deployBtn.disabled = !d.ok;
    deployBtn.title = d.ok ? 'Deploy into a Construction yard (F or Space)' : 'Needs open, level ground: move somewhere clear';
  }
  const r = canvas.getBoundingClientRect();
  const lift = 22 * scale;
  deployBtn.style.transform = `translate(${Math.round(r.left + (d.x - camX()) * scale)}px, ${Math.round(r.top + (d.y - camY()) * scale - lift)}px) translate(-50%, -100%)`;
}
okBtn.addEventListener('click', () => {
  if (!pending || !game) return;
  const p = pending;
  setPending(null);
  // the paratroopers' drop zone: no units of yours go, so nothing to lock
  if (p.kind === 'drop') game.click(p.x, p.y, false);
  else sendTo(p.x, p.y);
});

// Send the selection to map point (x, y) (or attack what is there) and lock
// it as a group. A locked group goes onto its own units too, rather than
// picking them.
// Put the Repair or Sell button back up, or put off the paratroopers.
function stopTargeting(): void {
  game.setBuildMode?.(null);
  game.act?.('unpara');
}

function sendTo(x: number, y: number): void {
  if (locked && game.cursorAt?.(x, y) === 'pick') game.order(x, y);
  else game.click(x, y, false);
  lockGroup();
}


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
// paused from the menu (single player): see setPaused
let userPaused = false;

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
// The landing page's drift draws one map pixel more each way than fits, so
// the canvas can slide by part of a pixel (see drawAttract).
let attractPad = 0;
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
  const w = Math.ceil(vw / scale) + attractPad;
  const h = Math.ceil(vh / scale) + attractPad;
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
  setWorldLevel(userPaused ? 0 : planet ? 0.15 : 1);
  if (planet !== wasPlanet) {
    lastSnap = -Infinity; // refresh the globe straight away
    showSelection(lastNames);
    if (built.w) {
      whoosh = { t0: performance.now(), up: planet };
      // out to space with a rush, and the same rush backwards coming down
      play('whoosh_space', 1, { ui: true, reverse: !planet });
    }
  }
  clampCen();
}

// Zoom to `z`, keeping the map point under client position (cx, cy) still.
// In space the globe always zooms about its center.
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
    const ws = game.worldSize?.(WORLD.w, WORLD.h) ?? WORLD;
    game.generate(ws.w, ws.h);
    built = { w: ws.w, h: ws.h };
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

// ---------- Loading screen ----------
// Making a world takes a few seconds, and so does drawing its art. Done
// while you play, that is a stuttery start, so it all happens behind the
// loading screen: the art is drawn off the main thread (src/v2/art-pool.ts)
// and the screen comes down once the bases, the map of the planet and the
// units as they start out are ready.

const ldBar = loading.querySelector<HTMLElement>('.ld')!;
const ldText = loading.querySelector<HTMLElement>('.ld-text')!;
const SEGS = 24;
function showLoading(p: number, text: string): void {
  loading.hidden = false;
  ldBar.style.setProperty('--p', String(Math.round(Math.min(1, p) * SEGS) / SEGS));
  ldText.textContent = text;
}
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
// Wait for a batch of work, moving the bar from p0 to p1 as it finishes.
async function track(work: Promise<unknown>[], p0: number, p1: number, text: string, live = () => true): Promise<void> {
  let done = 0;
  if (live()) showLoading(p0, text);
  await Promise.all(work.map((w) => w.then(() => live() && showLoading(p0 + ((p1 - p0) * ++done) / work.length, text))));
}

// A game with a choice of maps asks which one first.
function start(): void {
  stopAttract();
  showLoading(0.05, 'Loading');
  startArtPool();
  requestAnimationFrame(() =>
    setTimeout(() => {
      game = new IsoGame(ctx, seed);
      game.onSelect = showSelection;
      build.reset();
      built = { w: 0, h: 0 };
      loading.hidden = true;
      if (game.maps) showPicker();
      else makeWorld();
    }, 0),
  );
}

// Generate the world (a fresh one each time) and get it ready to play while
// the loading screen is up.
let making = 0;
async function makeWorld(): Promise<void> {
  const me = ++making;
  build.reset();
  game.seed = seed;
  const g = game;
  // (not if the game was left, by the Back button, while it was being made)
  const live = () => me === making && g === game;
  showLoading(0.02, 'Shaping the land');
  await nextFrame();
  if (me !== making || g !== game) return;
  // the art for the bases is drawn by workers while the land is made here
  const bases = g.preload?.() ?? [];
  fit(true);
  // the host back after a reload: the game as it was
  if (match?.resume && g instanceof IsoGame) {
    g.restore(match.resume);
    const f = g.focus();
    cen.x = f.x;
    cen.y = f.y;
  }
  const units = g.warmUp?.() ?? [];
  // the globe's picture of the whole map, a little each frame
  let p = 0.2;
  showLoading(p, 'Mapping the planet');
  await nextFrame();
  while (!g.mapStep(30)) {
    if (!live()) return;
    p += (0.5 - p) * 0.15;
    showLoading(p, 'Mapping the planet');
    await nextFrame();
  }
  await track(bases, 0.5, 0.75, 'Raising the bases', live);
  if (me !== making || g !== game) return;
  globe.setMap(built.w, built.h, g.mapImage(), g.shroudMap?.());
  g.shroudMap?.()?.changed();
  mapVersion = g.mapVersion ?? 0;
  await track(units, 0.75, 0.98, 'Rolling out', live);
  if (me !== making || g !== game) return;
  // one step and a frame drawn behind the screen, so the first one you see
  // isn't the one that looks up the ground under everyone and sends every
  // picture to the screen for the first time
  g.update(1 / 60);
  draw(performance.now(), true);
  ctx.getImageData(0, 0, 1, 1); // (makes the canvas really draw it now)
  showLoading(1, 'Ready');
  await nextFrame();
  if (me !== making) return;
  // a multiplayer game waits until everyone's world is ready
  if (match) {
    showLoading(1, 'Waiting for the others');
    match.ready();
    return;
  }
  loading.hidden = true;
}

// ---------- Multiplayer ----------
// The landing page is the multiplayer lobby (src/lobby.ts). When a game
// starts every screen makes the same world; the host's runs the game and
// sends the others how it stands, and their orders go to the host.

let match: Match | null = null;
// a player's game waits while the host is away
let netPaused = false;
// the host runs the computer players
let bots: Bot[] = [];
const lobby = new Lobby({
  start: (m) => startMatch(m),
  showing: (on) => (on ? startAttract() : stopAttract()),
  quit: () => leaveGame(),
});
// Another page of the game (test mode at /test, the lobby at /), keeping ?localnet and the like.
function goTo(path: string): void {
  location.assign(path + location.search);
}

// ---------- Behind the lobby ----------
// The landing page shows a world drifting by: a single-player world (both
// bases built, no shroud) that is drawn but never run, so it stays quiet.
let attract = false;
let attractReady = false;
let attractN = 0;
let attractT = 0;
let attractY = 0;
const ATTRACT_MAPS = ['pangaea', 'continents', 'lakes', 'high', 'atoll', 'crater', 'badlands', 'inland', 'rivers', 'wetlands'];
function startAttract(): void {
  if (attract) return;
  attract = true;
  attractAt = '';
  document.body.classList.add('attract');
  // still the one from before: carry on
  if (game instanceof IsoGame && game.noShroud && built.w) {
    attractPad = 1;
    applyScale();
    attractReady = true;
    document.body.classList.add('attract-on');
    return;
  }
  attractReady = false;
  const me = ++attractN;
  startArtPool();
  setTimeout(async () => {
    if (me !== attractN) return;
    const g = new IsoGame(ctx, Math.floor(Math.random() * 100000));
    g.stage = 'combat';
    g.mapId = ATTRACT_MAPS[Math.floor(Math.random() * ATTRACT_MAPS.length)];
    g.noShroud = true;
    game = g;
    build.reset();
    built = { w: 0, h: 0 };
    const bases = g.preload();
    attractPad = 1;
    fit(true);
    const units = g.warmUp();
    // Everything it will show for the first minutes is ready before it fades
    // in, so the drift doesn't stutter: the art for the bases and the units
    // near them (drawn by workers), then the ground along the way, painted
    // a little each frame behind the scenes.
    await Promise.race([Promise.all([...bases, ...units]), new Promise((r) => setTimeout(r, 12000))]);
    if (me !== attractN || game !== g) return;
    attractY = cen.y;
    const x0 = Math.floor(camX()) - 64;
    const y0 = Math.floor(camY()) - ATTRACT_SWAY - 64;
    const x1 = x0 + view.w + ATTRACT_SPEED * 240 + 128;
    const y1 = y0 + view.h + ATTRACT_SWAY * 2 + 128;
    for (let x = x0; x < x1; x += 256) {
      ctx.setTransform(dens, 0, 0, dens, 0, 0);
      g.renderGround(x, y0, Math.min(x1, x + 256), y1, 1e5);
      await nextFrame();
      if (me !== attractN || game !== g) return;
    }
    attractT = 0;
    drawAttract(true);
    await nextFrame();
    if (me !== attractN || game !== g) return;
    attractReady = true;
    document.body.classList.add('attract-on');
  }, 30);
}
// how fast the view drifts (map pixels a second), and how far it sways up and down
const ATTRACT_SPEED = 7;
const ATTRACT_SWAY = 140;
// Just the world (none of the game's controls, the globe or the minimap).
// The canvas only holds whole canvas pixels, and at this speed a step to the
// next one comes every few frames and jumps a few screen pixels at once (the
// stutter the drift had). So the world is drawn at the whole canvas pixel
// just up and to the left of the camera, and the canvas itself is slid the
// rest of the way by a CSS transform, which the compositor places on any
// screen pixel. The picture only changes every few frames, so it is only
// redrawn then: between, just the transform moves.
let attractAt = '';
function drawAttract(first: boolean): void {
  const cx = camX();
  const cy = camY();
  const x0 = Math.floor(cx * dens) / dens;
  const y0 = Math.floor(cy * dens) / dens;
  const k = scale;
  canvas.style.transform = `translate3d(${(-(cx - x0) * k).toFixed(3)}px, ${(-(cy - y0) * k).toFixed(3)}px, 0)`;
  const at = `${x0},${y0},${view.w},${view.h}`;
  if (!first && at === attractAt && !game.groundPending?.()) return;
  attractAt = at;
  const x1 = x0 + view.w;
  const y1 = y0 + view.h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(dens, 0, 0, dens, -x0 * dens, -y0 * dens);
  game.renderGround(Math.floor(x0) - 1, Math.floor(y0) - 1, Math.ceil(x1) + 1, Math.ceil(y1) + 1, first ? 1e5 : 4);
  const W = built.w;
  const H = built.h;
  const pad = 80;
  for (let j = Math.floor((y0 - pad) / H); j <= Math.floor((y1 + pad) / H); j++)
    for (let k = Math.floor((x0 - pad) / W); k <= Math.floor((x1 + pad) / W); k++) {
      ctx.setTransform(dens, 0, 0, dens, (k * W - x0) * dens, (j * H - y0) * dens);
      game.renderObjects(x0 - k * W, y0 - j * H, x1 - k * W, y1 - j * H);
    }
  ctx.setTransform(dens, 0, 0, dens, -x0 * dens, -y0 * dens);
  game.renderOver?.(x0, y0, x1, y1);
}
function stopAttract(): void {
  if (!attract) return;
  attract = false;
  attractReady = false;
  attractN++;
  document.body.classList.remove('attract', 'attract-on');
  canvas.style.transform = '';
  if (attractPad) {
    attractPad = 0;
    applyScale();
  }
}
const leaveBtn = document.querySelector<HTMLButtonElement>('#leaveBtn')!;
const lobbyBtn = document.querySelector<HTMLButtonElement>('#lobbyBtn')!;
const banner = document.querySelector<HTMLDivElement>('#banner')!;
// the menu has New map in single player, Leave game in multiplayer
function showMpMenu(): void {
  const mp = !!match;
  regen.hidden = mp;
  pauseBtn.hidden = mp;
  if (mp) setPaused(false);
  leaveBtn.hidden = !mp;
  lobbyBtn.hidden = mp;
}
function showBanner(text: string, sub: string, watch = true): void {
  banner.replaceChildren();
  const b = document.createElement('div');
  b.className = 'card';
  const t = document.createElement('div');
  t.className = 't';
  t.textContent = text;
  const p = document.createElement('div');
  p.className = 's';
  p.textContent = sub;
  const keep = document.createElement('button');
  keep.type = 'button';
  keep.textContent = 'Keep watching';
  keep.addEventListener('click', () => (banner.hidden = true));
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = watch ? 'Back to the lobby' : 'Leave game';
  back.addEventListener('click', () => leaveGame());
  b.append(t, p);
  if (watch) b.append(keep);
  b.append(back);
  banner.append(b);
  banner.hidden = false;
}
function leaveGame(): void {
  // (single player is its own page, /test)
  if (!match) return goTo('/');
  banner.hidden = true;
  netPaused = false;
  setMenu(false);
  const m = match;
  match = null;
  // (stops a world still being made)
  making++;
  bots = [];
  built = { w: 0, h: 0 };
  loading.hidden = true;
  picker.hidden = true;
  setSelOpen(false);
  showMpMenu();
  if (m) m.leave();
  else lobby.show();
}
leaveBtn.addEventListener('click', () => leaveGame());

// ---------- Pause (single player) ----------
// Everything stops: the battle, the computer players and the sounds of the
// world, and the music fades out. A screen over the game says so and takes any
// taps, so nothing can be ordered while the clock is stopped.
const pauseBtn = document.querySelector<HTMLButtonElement>('#pauseBtn')!;
const pauseScreen = document.querySelector<HTMLDivElement>('#pauseScreen')!;
const resumeBtn = document.querySelector<HTMLButtonElement>('#resumeBtn')!;
function canPause(): boolean {
  return !match && !!game && !!built.w && loading.hidden && !attract;
}
function setPaused(on: boolean): void {
  if (on && !canPause()) return;
  if (on === userPaused) return;
  userPaused = on;
  pauseScreen.hidden = !on;
  keys.clear();
  setWorldLevel(on ? 0 : planet ? 0.15 : 1);
  setMusicPaused(on);
  if (on) {
    setMenu(false);
    play('ui_panel', 1, { ui: true });
    resumeBtn.focus();
  } else {
    // (no catching up on the time spent paused)
    last = performance.now();
  }
}
pauseBtn.addEventListener('click', () => setPaused(true));
resumeBtn.addEventListener('click', () => setPaused(false));
lobbyBtn.addEventListener('click', () => goTo('/'));

function startMatch(m: Match): void {
  stopAttract();
  match = m;
  netPaused = false;
  showMpMenu();
  banner.hidden = true;
  showLoading(0.05, 'Loading');
  startArtPool();
  seed = m.seed;
  const g = new IsoGame(ctx, m.seed);
  g.players = m.players;
  g.me = m.me;
  g.net = m.host ? 'host' : 'client';
  g.mapId = m.mapId;
  g.onSelect = showSelection;
  g.onCommand = (cmd) => m.sendCommand(cmd);
  bots = m.host ? m.players.filter((p) => p.bot).map((p) => new Bot(g, p.f, p.bot!)) : [];
  g.onOutcome = (won) => (won ? showBanner('Victory', 'Everyone else is out.') : showBanner('Defeated', 'You have nothing left.'));
  m.onCommand = (f, cmd) => g.exec(f, cmd);
  m.onSnapshot = (snap) => {
    if (game === g && built.w) g.applySnapshot(snap);
  };
  m.onGo = () => {
    if (game !== g) return;
    loading.hidden = true;
    if (netPaused) banner.hidden = true;
    netPaused = false;
  };
  m.onLeft = (name) => g.onNotice?.(`${name} left the game`);
  m.onBack = (name) => g.onNotice?.(`${name} is back`);
  // the host reloaded, or lost touch: the game waits for it
  m.onHostLost = () => {
    netPaused = true;
    showBanner('Paused', 'Waiting for the host to come back.', false);
  };
  m.onHostGone = () => {
    netPaused = true;
    showBanner('The host has gone', 'The game stopped when the host left.', false);
  };
  game = g;
  build.reset();
  built = { w: 0, h: 0 };
  void makeWorld();
}

// The host sends everyone how things stand ten times a second.
let lastNet = 0;
function sendNet(now: number): void {
  if (!match?.host || !(game instanceof IsoGame) || now - lastNet < 100) return;
  lastNet = now;
  match.sendSnapshot(game.snapshot());
}

// ---------- Map picker ----------

function showPicker(): void {
  if (!game.maps) return void makeWorld();
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
    if (m.players) {
      const pl = document.createElement('span');
      pl.className = 'players';
      pl.textContent = m.players[0] === m.players[1] ? `${m.players[0]}P` : `${m.players[0]}-${m.players[1]}P`;
      pl.title = `Made for ${m.players[0] === m.players[1] ? m.players[0] : `${m.players[0]} to ${m.players[1]}`} players`;
      name.append(pl);
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
// Test mode (single player) at /test, or with ?solo (or the old ?v=) in the
// URL; a room at /CODE (back into it after a reload); the lobby otherwise.
const atPath = location.pathname.replace(/\/+$/, '');
showMpMenu();
if (atPath === '/test' || params.has('solo') || params.has('v')) start();
else if (Lobby.pathCode()) void lobby.enter(Lobby.pathCode());
else showPlayGate();

// The landing page opens on a big Play button over the drifting world.
// Browsers keep a page silent until it is tapped, so this is that tap: it
// starts the sound (src/voice.ts listens for it) and the music comes in as
// the lobby appears. Test mode and its pages are in the top right corner.
function showPlayGate(): void {
  startAttract();
  const gate = document.createElement('div');
  gate.id = 'playGate';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'play';
  btn.innerHTML =
    `${lineIcon('play')}<span>Play</span>`;
  const go = (): void => {
    if (!gate.isConnected) return;
    gate.remove();
    window.removeEventListener('keydown', key);
    lobby.show();
  };
  // (Enter or Space works too, from the keyboard)
  const key = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target === test) return;
    e.preventDefault();
    go();
  };
  const test = document.createElement('a');
  test.className = 'testMode';
  test.href = '/test' + location.search;
  test.title = 'Play alone against the computer, with the test stages';
  test.textContent = 'Test mode';
  btn.addEventListener('click', go);
  window.addEventListener('keydown', key);
  gate.append(btn, test);
  document.body.append(gate);
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => game && built.w && fit(), 150);
});

// Settings: how loud the music, sounds and voices are, and how fast the keys
// scroll and the wheel zooms (src/settings.ts). They open in place of the
// menu's buttons.
const settingsBtn = document.querySelector<HTMLButtonElement>('#settingsBtn')!;
const settingsEl = document.querySelector<HTMLDivElement>('#settings')!;
function setSettingsOpen(open: boolean): void {
  menu.classList.toggle('settings-open', open);
  settingsBtn.setAttribute('aria-expanded', String(open));
  if (open) settingsEl.querySelector<HTMLButtonElement>('#setBack')!.focus({ preventScroll: true });
}
settingsBtn.addEventListener('click', () => setSettingsOpen(true));
settingsEl.querySelector('#setBack')!.addEventListener('click', () => setSettingsOpen(false));
settingsEl.querySelector('#setReset')!.addEventListener('click', () => resetSettings());

// Hotkeys: every key the game listens to, in place of the menu's buttons too.
const keysBtn = document.querySelector<HTMLButtonElement>('#keysBtn')!;
const keysEl = document.querySelector<HTMLDivElement>('#keys')!;
function setKeysOpen(open: boolean): void {
  menu.classList.toggle('keys-open', open);
  keysBtn.setAttribute('aria-expanded', String(open));
  if (open) keysEl.querySelector<HTMLButtonElement>('#keysBack')!.focus({ preventScroll: true });
}
keysBtn.addEventListener('click', () => setKeysOpen(true));
keysEl.querySelector('#keysBack')!.addEventListener('click', () => setKeysOpen(false));
const sliders = [...settingsEl.querySelectorAll<HTMLInputElement>('input[type=range]')];
const VOLUMES = new Set(['music', 'sfx', 'voice']);
function showSettings(): void {
  const s = settings();
  for (const el of sliders) {
    const k = el.dataset.k as keyof Settings;
    const v = s[k];
    if (document.activeElement !== el) el.value = String(Math.round(v * 100));
    el.closest('label')!.querySelector('output')!.textContent = VOLUMES.has(k) ? (v ? `${Math.round(v * 100)}%` : 'Off') : `${+v.toFixed(2)}×`;
  }
}
for (const el of sliders) {
  el.addEventListener('input', () => setSetting(el.dataset.k as keyof Settings, +el.value / 100));
  // let go of the Sounds slider: a click at the new level
  if (el.dataset.k === 'sfx') el.addEventListener('change', () => ui('ui_click'));
}
onSettings(showSettings);
showSettings();

// A panel (the menu, the build sheet, the selection menu) slides as it opens
// or shuts, when a tap did it; every other button clicks.
let lastTap = -1e9;
let panelT = -1e9;
document.addEventListener('pointerdown', () => (lastTap = performance.now()), true);
document.addEventListener('keydown', () => (lastTap = performance.now()), true);
const panels = new MutationObserver((ms) => {
  if (performance.now() - lastTap > 500) return;
  for (const m of ms) {
    const el = m.target as HTMLElement;
    if ((m.oldValue !== null) === el.hidden) continue;
    ui('ui_panel', el.hidden ? 0.85 : 1);
    panelT = performance.now();
    return;
  }
});
for (const el of [menu, selMenu, document.querySelector('#build')]) if (el) panels.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
document.addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest?.('button, select, a');
  if (!b || performance.now() - panelT < 100) return;
  ui('ui_click');
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
// touch screen a drag that starts on it carries it, and a tap puts it down
// where you tapped. Esc, a right-click or a tap on its picture in the build
// menu puts it away.
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
  if (!ghostP) {
    const p = ghostStart();
    moveGhost(p.x, p.y);
  }
}
// Where a new ghost first shows: by the pointer (on the map side of the build
// menu and toolbar if the pointer is over them), or mid-screen if no pointer
// has been seen yet.
let lastPtr: { x: number; y: number } | null = null;
window.addEventListener('pointermove', (e) => (lastPtr = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });
window.addEventListener('pointerdown', (e) => (lastPtr = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });
function ghostStart(): { x: number; y: number } {
  if (!lastPtr) return { x: cen.x, y: cen.y + 20 };
  const r = canvas.getBoundingClientRect();
  const m = 48;
  let x0 = r.left + m;
  let x1 = r.right - m;
  let y0 = r.top + m;
  let y1 = r.bottom - m;
  for (const sel of ['#build', '#toolbar']) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el || el.hidden || !el.offsetParent) continue;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    // a panel down one side: keep to the map side of it
    if (b.height > r.height * 0.6 && b.left > r.left + r.width / 2) x1 = Math.min(x1, b.left - m);
    else if (b.height > r.height * 0.6 && b.right < r.left + r.width / 2) x0 = Math.max(x0, b.right + m);
    else if (b.top > r.top + r.height / 2) y1 = Math.min(y1, b.top - m);
    else if (b.bottom < r.top + r.height / 2) y0 = Math.max(y0, b.bottom + m);
  }
  const cx = x1 > x0 ? Math.min(x1, Math.max(x0, lastPtr.x)) : (r.left + r.right) / 2;
  const cy = y1 > y0 ? Math.min(y1, Math.max(y0, lastPtr.y)) : (r.top + r.bottom) / 2;
  return toMap(cx, cy);
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
  // the first tap after picking with the menu locks the selection as a group
  if (menuPick && !locked && !placingNow()) lockGroup();
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
    else if (!planet && game.targeting?.()) stopTargeting();
    else {
      clicked();
      game.order(p.x, p.y);
      lockGroup();
    }
    return;
  }
  down = { ...p, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, pan: planet || e.pointerType !== 'mouse' || e.button === 1 || locked };
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
  if (game.selectedPoints().length) {
    game.order(p.x, p.y, true);
    lockGroup();
  }
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
  if (what === 'move' || what === 'attack' || what === 'harvest' || what === 'enter' || what === 'repair' || what === 'drop' || (locked && what === 'pick')) setPending({ x, y, kind: what === 'pick' ? 'move' : what });
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
  game.force = e.ctrlKey || e.metaKey;
  if (!cancel && placingNow()) {
    // a tap or click puts it down there (if it can go there)
    if (!dragging) {
      moveGhost(p.x, p.y);
      game.act?.('place');
    }
  } else if (!cancel) {
    if (planet) {
      if (!dragging) spaceTap(e);
    } else if (!dragging) {
      if (e.pointerType === 'mouse') {
        clicked();
        const what = game.cursorAt?.(down.x, down.y);
        if (what === 'move' || what === 'attack' || what === 'harvest' || what === 'enter' || what === 'repair' || (locked && what === 'pick')) sendTo(down.x, down.y);
        else if (what === 'deploy' || what === 'unfold') game.act?.('deploy');
        else game.click(down.x, down.y, add);
      } else touchTap(down.x, down.y);
    } else if (!down.pan && !locked) game.boxSelect(down.x, down.y, p.x, p.y, add);
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
let dugAt = -Infinity;
let unloadedAt = -Infinity;
let enteredAt = -Infinity;
let fixedAt = -Infinity;
let droppedAt = -Infinity;
// A click with the move, attack, harvest, deploy, unload, enter, repair or drop cursor showing: play its burst.
function clicked(): void {
  if (cursorKind === 'move') movedAt = performance.now();
  else if (cursorKind === 'attack') attackedAt = performance.now();
  else if (cursorKind === 'unload') unloadedAt = performance.now();
  else if (cursorKind === 'harvest' || cursorKind === 'deploy') dugAt = performance.now();
  else if (cursorKind === 'enter') enteredAt = performance.now();
  else if (cursorKind === 'repair') fixedAt = performance.now();
  else if (cursorKind === 'drop') droppedAt = performance.now();
}
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  if (game) game.force = e.ctrlKey || e.metaKey;
});
// Ctrl or Cmd held: clicks fire on bridges (see GameLike.force)
for (const ev of ['keydown', 'keyup'] as const) window.addEventListener(ev, (e) => game && (game.force = e.ctrlKey || e.metaKey));
window.addEventListener('blur', () => game && (game.force = false));
canvas.addEventListener('pointerleave', () => (mouse = null));
function hoverNow(now: number): void {
  const m = mouse && toMap(mouse.x, mouse.y);
  let k: CursorKind = 'arrow';
  if (down && (down.pan || ghostDrag) && (dragging || planet)) k = 'grabbing';
  else if (m && !planet && !(dragging && box) && picker.hidden) {
    const what = game.cursorAt?.(m.x, m.y);
    if (what === 'pick') k = locked ? 'move' : 'corners';
    else if (what === 'fix') k = 'repair';
    // a selected Foundry vehicle that can deploy: the enter cursor's triangles
    else if (what === 'unfold') k = 'enter';
    else if (what) k = what;
  } else if (planet) k = 'grab';
  const burst = Math.floor((now - movedAt) / 55);
  if (burst >= 0 && burst < MOVE_CLICK_FRAMES && k !== 'grabbing') k = 'move';
  const shot = Math.floor((now - attackedAt) / 55);
  const shooting = shot >= 0 && shot < ATTACK_CLICK_FRAMES && k !== 'grabbing';
  if (shooting) k = 'attack';
  const dig = Math.floor((now - dugAt) / 55);
  const digging = dig >= 0 && dig < MOVE_CLICK_FRAMES && k !== 'grabbing';
  if (digging && k !== 'deploy') k = 'harvest';
  const drop = Math.floor((now - unloadedAt) / 55);
  const dropping = drop >= 0 && drop < MOVE_CLICK_FRAMES && k !== 'grabbing';
  if (dropping) k = 'unload';
  const ent = Math.floor((now - enteredAt) / 55);
  const entering = ent >= 0 && ent < ENTER_CLICK_FRAMES && k !== 'grabbing';
  if (entering) k = 'enter';
  const fix = Math.floor((now - fixedAt) / 55);
  const fixing = fix >= 0 && fix < REPAIR_CLICK_FRAMES && k !== 'grabbing';
  if (fixing) k = 'repair';
  const para = Math.floor((now - droppedAt) / 55);
  const paraing = para >= 0 && para < DROP_CLICK_FRAMES && k !== 'grabbing';
  if (paraing) k = 'drop';
  cursorKind = k;
  canvas.dataset.cursor = k;
  let css = CURSORS[k];
  if (k === 'corners') css = CORNER_FRAMES[Math.floor(now / 140) % CORNER_FRAMES.length];
  else if (k === 'attack') css = shooting ? ATTACK_CLICK_CSS[shot] : ATTACK_FRAMES[Math.floor(now / 150) % ATTACK_FRAMES.length];
  else if (k === 'harvest' || k === 'deploy') css = digging ? DEPLOY_CLICK_CSS[dig] : DEPLOY_FRAMES[Math.floor(now / 150) % DEPLOY_FRAMES.length];
  else if (k === 'unload') css = dropping ? UNLOAD_CLICK_CSS[drop] : UNLOAD_FRAMES[Math.floor(now / 150) % UNLOAD_FRAMES.length];
  else if (k === 'enter') css = entering ? ENTER_CLICK_CSS[ent] : ENTER_FRAMES[Math.floor(now / 150) % ENTER_FRAMES.length];
  else if (k === 'repair') css = fixing ? REPAIR_CLICK_CSS[fix] : REPAIR_FRAMES[Math.floor(now / 120) % REPAIR_FRAMES.length];
  else if (k === 'drop') css = paraing ? DROP_CLICK_CSS[para] : DROP_FRAMES[Math.floor(now / 150) % DROP_FRAMES.length];
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
    zoomTo(zoom * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015) * settings().zoom), e.clientX, e.clientY);
  },
  { passive: false },
);
// Stop Safari's own page pinch from fighting ours.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// ---------- Keyboard: WASD or the arrow keys pan, +/- zoom, F or Space deploys, Esc clears (all listed in the menu's Hotkeys) ----------

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (!game || tag === 'SELECT') return;
  if (userPaused) {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
      e.preventDefault();
      setPaused(false);
    }
    return;
  }
  // (a focused slider in Settings takes the arrow keys; Esc still goes back)
  if (tag === 'INPUT' && e.key !== 'Escape') return;
  if (!picker.hidden) {
    if (e.key === 'Escape' && !pickClose.hidden) pickClose.click();
    return;
  }
  // (with ctrl or cmd held, letters are the browser's: ctrl+S, ctrl+D...)
  if (!e.ctrlKey && !e.metaKey && !e.altKey) keys.add(e.key.toLowerCase());
  const digit = /^Digit([12])$/.exec(e.code);
  if (digit && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.shiftKey) assignGroup(+digit[1] - 1);
    else pickGroup(+digit[1] - 1);
  }
  if (e.key === 'Escape') {
    if (menu.classList.contains('settings-open')) menu.querySelector<HTMLButtonElement>('#setBack')!.click();
    else if (menu.classList.contains('keys-open')) setKeysOpen(false);
    else if (!menu.hidden) setMenu(false);
    else if (placingNow()) game.act?.('unplace');
    else if (game.targeting?.()) stopTargeting();
    else if (pending) setPending(null);
    else if (lastNames.length) game.deselect();
    else setSelOpen(false);
  }
  if (e.key === 'b') document.querySelector<HTMLButtonElement>('#buildBtn:not([hidden])')?.click();
  if (e.key === 'q') setSelOpen(!selOpen);
  if (e.key === 'f') game.act?.('deploy');
  // Space deploys too (and doesn't scroll the page or press a focused button)
  if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (!e.repeat) game.act?.('deploy');
  }
  if (e.key === 'h') goHome();
  if (e.key === 'p' || e.key === 'Pause') setPaused(true);
  if (e.key === '+' || e.key === '=') zoomTo(zoom * 1.25, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === '-' || e.key === '_') zoomTo(zoom / 1.25, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === '0') zoomTo(1, window.innerWidth / 2, window.innerHeight / 2);
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (!locked) selectView(false);
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
let lastShade = -Infinity;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // (not while the loading screen is up: nothing moves until you can see it)
  if (attract) {
    if (game && built.w && attractReady) {
      // the landing page: a slow drift across the world
      attractT += dt;
      cen.x += ATTRACT_SPEED * dt;
      cen.y = attractY + Math.sin(attractT / 70) * ATTRACT_SWAY;
      drawAttract(false);
    }
  } else if (game && built.w && loading.hidden) {
    const sp = (320 * settings().scroll * dt) / zoom; // Scroll speed in Settings
    if (keys.has('arrowleft') || keys.has('a')) cen.x -= sp;
    if (keys.has('arrowright') || keys.has('d')) cen.x += sp;
    // up and down go as fast across the screen as left and right
    if (keys.has('arrowup') || keys.has('w')) cen.y -= sp;
    if (keys.has('arrowdown') || keys.has('s')) cen.y += sp;
    clampCen();
    if (!netPaused && !userPaused) {
      game.update(dt);
      if (match?.host) for (const b of bots) b.update(dt);
      sendNet(now);
    }
    setMood(game.mood?.() ?? 'base');
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
    globe.setMap(built.w, built.h, game.mapImage(), game.shroudMap?.());
    game.shroudMap?.()?.changed();
    mapVersion = game.mapVersion ?? 0;
  }
  // a base changed: redraw the globe's picture of the map
  if (globe.ready && (game.mapVersion ?? 0) !== mapVersion && now - lastMap > 500) {
    lastMap = now;
    mapVersion = game.mapVersion ?? 0;
    globe.setMap(built.w, built.h, game.mapImage(), game.shroudMap?.());
    game.shroudMap?.()?.changed();
    lastSnap = -Infinity;
  }
  // more of the map seen: darken just that part of the globe's picture again
  if (globe.ready && now - lastShade > 250) {
    const sh = game.shroudMap?.();
    const box = sh?.changed();
    if (sh && box) {
      lastShade = now;
      globe.shade(sh, ...box);
    }
  }
  refreshActions();
  syncGhost();
  lockOnPan();
  refreshTypes();
  refreshGroups();
  placeConfirm();
  placeDeploy();
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
    ctx.setTransform(dens, 0, 0, dens, -x0 * dens, -y0 * dens);
    game.renderOver?.(x0, y0, x1, y1);
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
Object.defineProperty(window, 'bots', { get: () => bots });
