// Emberwild: roam a wild land, mine and build with blocks, and automate a workshop
// to relight the four old Ember Beacons.
import './style.css';
import type { GameModule } from '../types';
import { BEACONS, ITEMS, RECIPES, SMELT, type ItemId } from './data';
import { Game, RELICS, type SaveData } from './game';
import { Renderer } from './render';
import { icon } from './art';
import { isMuted, setMuted, sfx, startMusic, stopMusic } from './audio';
import { add, stockSum, take, type Machine } from './sim';

const SAVE_KEY = 'emberwild-save-v1';
const MUTE_KEY = 'emberwild-muted';

function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? (JSON.parse(raw) as SaveData) : null;
    return s && s.v === 1 ? s : null;
  } catch {
    return null;
  }
}
function writeSave(s: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const name = (id: ItemId) => ITEMS[id].name;

const CONTROLS = `
  <div class="ew-keys">
    <div><b>WASD / arrows</b> walk · <b>Shift</b> sprint (and swim faster)</div>
    <div><b>Hold click</b> mine or chop · with a block or machine picked: <b>click</b> places it (drag to lay belts)</div>
    <div><b>Space</b> sword · <b>F</b> bow · <b>E</b> or <b>right-click</b> open, talk, eat</div>
    <div><b>1–9</b> or scroll: pick from the hotbar · <b>R</b> turn machines · <b>Tab</b> bag and crafting · <b>M</b> map · <b>Esc</b> menu</div>
  </div>`;

const LOGO = `<svg class="ew-logo-art" viewBox="0 0 160 90" aria-hidden="true">
  <path d="M0 70L40 48L80 66L120 40L160 60V90H0Z" fill="#3f7a3a"/>
  <path d="M0 80L50 62L100 78L160 66V90H0Z" fill="#2c5a2c"/>
  <rect x="68" y="40" width="24" height="26" fill="#a8a08e"/><rect x="64" y="36" width="32" height="6" fill="#857d6b"/>
  <path d="M70 36q0-14 10-22q10 8 10 22z" fill="#ff7a1a"/><path d="M75 36q0-8 5-13q5 5 5 13z" fill="#ffe27a"/>
  <path d="M72 36L66 0H94L88 36Z" fill="rgba(255,190,80,.18)"/>
  <rect x="18" y="56" width="12" height="12" fill="#d39a3a"/><rect x="30" y="60" width="30" height="5" fill="#33383e"/>
  <rect x="100" y="54" width="14" height="14" fill="#a19b92"/><rect x="104" y="61" width="6" height="4" fill="#ff8a2a"/>
</svg>`;

type Overlay = 'none' | 'title' | 'menu' | 'bag' | 'map' | 'machine' | 'beacon' | 'loot' | 'win';

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'ew';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="ew-canvas"></canvas>
      <div class="ew-hud" hidden>
        <div class="ew-top">
          <div class="ew-hearts"></div>
          <div class="ew-btns">
            <button class="ew-ib" data-a="bag" title="Bag and crafting (Tab)">🎒</button>
            <button class="ew-ib" data-a="map" title="Map (M)">🗺️</button>
            <button class="ew-ib" data-a="mute" title="Sound"></button>
            <button class="ew-ib" data-a="menu" title="Menu (Esc)">☰</button>
          </div>
        </div>
        <div class="ew-stam"><i></i></div>
        <div class="ew-info"></div>
        <div class="ew-goal"><span class="ew-compass">➤</span><span class="ew-goal-t"></span></div>
      </div>
      <div class="ew-toast" hidden></div>
      <div class="ew-banner" hidden></div>
      <div class="ew-bar" hidden></div>
      <div class="ew-touch" hidden>
        <div class="ew-stick"><div class="ew-knob"></div></div>
        <div class="ew-tbtns">
          <button data-t="attack">⚔️</button>
          <button data-t="bow">🏹</button>
          <button data-t="use">⛏️</button>
          <button data-t="act">✋</button>
          <button data-t="turn">↻</button>
          <button data-t="sprint">💨</button>
        </div>
      </div>
      <div class="ew-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const hud = el.querySelector<HTMLDivElement>('.ew-hud')!;
    const heartsEl = el.querySelector<HTMLDivElement>('.ew-hearts')!;
    const stamEl = el.querySelector<HTMLDivElement>('.ew-stam')!;
    const infoEl = el.querySelector<HTMLDivElement>('.ew-info')!;
    const goalT = el.querySelector<HTMLSpanElement>('.ew-goal-t')!;
    const compass = el.querySelector<HTMLSpanElement>('.ew-compass')!;
    const muteBtn = el.querySelector<HTMLButtonElement>('[data-a="mute"]')!;
    const toastEl = el.querySelector<HTMLDivElement>('.ew-toast')!;
    const bannerEl = el.querySelector<HTMLDivElement>('.ew-banner')!;
    const barEl = el.querySelector<HTMLDivElement>('.ew-bar')!;
    const touchEl = el.querySelector<HTMLDivElement>('.ew-touch')!;
    const ui = el.querySelector<HTMLDivElement>('.ew-ui')!;
    const R = new Renderer(cv);

    try {
      setMuted(localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      /* ignore */
    }

    let g = new Game(undefined, 7);
    let overlay: Overlay = 'title';
    let playing = false;
    let bagTab: 'bag' | 'craft' | 'journal' = 'craft';
    let openMachine: Machine | null = null;
    let openBeacon = '';
    let dir = 0;
    let saveTimer = 0;
    const touchMode = !!window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;

    // ---------- messages ----------
    let toastTimer = 0;
    function toast(text: string) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), 3200);
    }
    let bannerTimer = 0;
    function banner(html: string) {
      bannerEl.innerHTML = html;
      bannerEl.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => (bannerEl.hidden = true), 4200);
    }
    function wire(gm: Game) {
      gm.onSound = sfx;
      gm.onMsg = toast;
      gm.onWin = () => {
        sfx('win');
        showWin();
      };
      gm.onBeaconLit = (n) => {
        banner(`<b>${n} relit!</b><span>+1 heart · an Ember core · the land around it is on your map</span>`);
        const left = g.world.beacons.filter((b) => !b.lit).length;
        if (!left) window.setTimeout(() => banner('<b>All four beacons burn!</b><span>The Sky Engine recipe is open in your bag.</span>'), 4400);
        if (overlay === 'beacon') beaconPanel();
      };
    }

    // ---------- input ----------
    const keys = new Set<string>();
    const stick = { x: 0, y: 0, id: -1 };
    let touchSprint = false;
    let aim: { x: number; y: number } | null = null; // world position of the pointer
    let mouseSeen = false;
    let pointerDown = false;
    let pressMode: 'place' | 'mine' | 'none' = 'none';
    let lastPlaced: { x: number; y: number } | null = null;
    let touchUse = false;

    function moveInput() {
      let mx = 0, my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      if (stick.id >= 0) {
        mx += stick.x;
        my += stick.y;
      }
      return { mx, my, sprint: keys.has('shift') || touchSprint };
    }
    function faceAim() {
      if (aim && mouseSeen) g.face = Math.atan2(aim.y - g.py, aim.x - g.px);
    }
    function currentTarget() {
      return g.target(mouseSeen ? aim : null);
    }

    function startUse() {
      if (!playing || overlay !== 'none') return;
      const t = currentTarget();
      const sel = g.selected;
      if (sel && ITEMS[sel].heal) {
        g.eat(sel);
        pressMode = 'none';
        return;
      }
      if (!t) {
        pressMode = 'none';
        return;
      }
      const occupied = g.world.b(t.x, t.y) !== 0 || !!g.fac.at(t.x, t.y);
      if (sel && (ITEMS[sel].block || ITEMS[sel].machine) && !occupied) {
        pressMode = 'place';
        if (g.place(t.x, t.y, sel, dir)) lastPlaced = t;
      } else pressMode = 'mine';
    }
    function holdUse(dt: number) {
      const t = currentTarget();
      if (!t) return;
      if (pressMode === 'mine') {
        if (!g.mineTick(t.x, t.y, dt)) g.mining = g.mining && g.mining.need > 50 ? g.mining : null;
      } else if (pressMode === 'place') {
        const sel = g.selected;
        if (!sel || (lastPlaced && lastPlaced.x === t.x && lastPlaced.y === t.y)) return;
        if (g.world.b(t.x, t.y) !== 0 || g.fac.at(t.x, t.y) || g.poiAt(t.x, t.y)) return;
        if (lastPlaced && Math.abs(lastPlaced.x - t.x) + Math.abs(lastPlaced.y - t.y) === 1 && ITEMS[sel].machine === 'belt') {
          const dx = t.x - lastPlaced.x, dy = t.y - lastPlaced.y;
          dir = dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
          const prev = g.fac.at(lastPlaced.x, lastPlaced.y);
          if (prev?.kind === 'belt') prev.dir = dir;
          renderBar();
        }
        if (g.canPlaceAt(t.x, t.y, sel)) return;
        if (g.place(t.x, t.y, sel, dir)) lastPlaced = t;
      }
    }
    function endUse() {
      pressMode = 'none';
      lastPlaced = null;
      if (g.mining && g.mining.need < 50) g.mining = null;
      else g.mining = null;
    }

    function interact(at?: { x: number; y: number }) {
      if (!playing || overlay !== 'none') return;
      let spot = at && Math.hypot(at.x + 0.5 - g.px, at.y + 0.5 - g.py) < 2.4 ? at : null;
      if (spot && !g.poiAt(spot.x, spot.y) && !g.fac.at(spot.x, spot.y)) spot = null;
      const near = spot ?? g.nearbyThing();
      if (!near) {
        const sel = g.selected;
        if (sel && ITEMS[sel].heal) return g.eat(sel);
        return;
      }
      const poi = g.poiAt(near.x, near.y);
      if (poi?.kind === 'chest') {
        const got = g.openChest(poi.i);
        lootPanel(got);
        return;
      }
      if (poi?.kind === 'stone') {
        g.findStone(poi.i);
        mapPanel(poi.i);
        return;
      }
      if (poi?.kind === 'beacon') {
        openBeacon = poi.b.id;
        beaconPanel();
        return;
      }
      const m = g.fac.at(near.x, near.y);
      if (m && m.kind !== 'belt' && m.kind !== 'lamp') {
        if (m.kind === 'sky_engine') return showWin();
        if (m.kind === 'campfire') g.spawn = [m.x + 0.5, m.y + 1.5];
        openMachine = m;
        machinePanel();
      }
    }

    function selectSlot(i: number) {
      g.sel = i;
      renderBar();
      sfx('click');
    }
    function turn() {
      dir = (dir + 1) % 4;
      // turning while aiming at a machine turns that machine
      const t = currentTarget();
      const m = t && g.fac.at(t.x, t.y);
      if (m && m.kind !== 'chest' && m.kind !== 'campfire' && m.kind !== 'lamp') m.dir = (m.dir + 1) % 4;
      renderBar();
    }

    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === 'tab') e.preventDefault();
      if (overlay === 'title') return;
      if (k === 'escape') {
        if (overlay === 'none') menu();
        else closeOverlay();
        return;
      }
      if (overlay === 'bag' && (k === 'tab' || k === 'i')) return closeOverlay();
      if (overlay === 'map' && k === 'm') return closeOverlay();
      if ((overlay === 'machine' || overlay === 'beacon' || overlay === 'loot') && k === 'e') return closeOverlay();
      if (overlay !== 'none') return;
      if (e.repeat && k !== ' ') return;
      keys.add(k);
      if (k === ' ') {
        e.preventDefault();
        faceAim();
        g.attack();
      } else if (k === 'f') {
        faceAim();
        g.shoot();
      } else if (k === 'e') interact(mouseSeen ? currentTarget() ?? undefined : undefined);
      else if (k === 'tab' || k === 'i') bag();
      else if (k === 'm') mapPanel();
      else if (k === 'r') turn();
      else if (k >= '1' && k <= '9') selectSlot(+k - 1);
      else if (k.startsWith('arrow')) e.preventDefault();
    }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => {
      keys.clear();
      pointerDown = false;
      endUse();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointermove', (e) => {
      aim = R.toWorld(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') mouseSeen = true;
    });
    cv.addEventListener('pointerdown', (e) => {
      el.focus();
      aim = R.toWorld(e.clientX, e.clientY);
      mouseSeen = true;
      if (e.button === 2) {
        const t = g.target(aim);
        interact(t ?? { x: Math.floor(aim.x), y: Math.floor(aim.y) });
        return;
      }
      pointerDown = true;
      cv.setPointerCapture(e.pointerId);
      startUse();
    });
    const up = () => {
      pointerDown = false;
      endUse();
      if (touchMode) mouseSeen = false;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener(
      'wheel',
      (e) => {
        if (overlay !== 'none') return;
        e.preventDefault();
        selectSlot((g.sel + (e.deltaY > 0 ? 1 : 8)) % 9);
      },
      { passive: false },
    );

    // touch stick and buttons
    const stickEl = el.querySelector<HTMLDivElement>('.ew-stick')!;
    const knob = el.querySelector<HTMLDivElement>('.ew-knob')!;
    stickEl.addEventListener('pointerdown', (e) => {
      stick.id = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    function moveStick(e: PointerEvent) {
      if (e.pointerId !== stick.id) return;
      const r = stickEl.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        dx /= l;
        dy /= l;
      }
      stick.x = Math.abs(dx) < 0.15 ? 0 : dx;
      stick.y = Math.abs(dy) < 0.15 ? 0 : dy;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    }
    stickEl.addEventListener('pointermove', moveStick);
    const stickUp = () => {
      stick.id = -1;
      stick.x = stick.y = 0;
      knob.style.transform = '';
    };
    stickEl.addEventListener('pointerup', stickUp);
    stickEl.addEventListener('pointercancel', stickUp);
    for (const b of el.querySelectorAll<HTMLButtonElement>('.ew-tbtns button')) {
      const t = b.dataset.t!;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (t === 'attack') g.attack();
        else if (t === 'bow') g.shoot();
        else if (t === 'act') interact();
        else if (t === 'turn') turn();
        else if (t === 'sprint') {
          touchSprint = !touchSprint;
          b.classList.toggle('on', touchSprint);
        } else if (t === 'use') {
          mouseSeen = false;
          touchUse = true;
          startUse();
        }
      });
      if (t === 'use') {
        const stop = () => {
          touchUse = false;
          endUse();
        };
        b.addEventListener('pointerup', stop);
        b.addEventListener('pointercancel', stop);
        b.addEventListener('pointerleave', stop);
      }
    }

    // ---------- hud ----------
    let heartsKey = '';
    function renderHearts() {
      const key = `${g.hp}/${g.maxHp}`;
      if (key === heartsKey) return;
      heartsKey = key;
      let h = '';
      for (let i = 0; i < g.maxHp / 2; i++) {
        const v = g.hp - i * 2;
        h += `<i class="ew-heart ${v >= 2 ? 'full' : v === 1 ? 'half' : ''}"></i>`;
      }
      heartsEl.innerHTML = h;
    }
    let barKey = '';
    function renderBar(force = false) {
      const key = g.hot.map((id) => (id ? `${id}:${g.inv[id] ?? 0}` : '-')).join(',') + g.sel + dir;
      if (key === barKey && !force) return;
      barKey = key;
      barEl.innerHTML =
        g.hot
          .map((id, i) => {
            const n = id ? g.inv[id] ?? 0 : 0;
            return `<button class="ew-slot ${i === g.sel ? 'on' : ''} ${id && !n ? 'empty' : ''}" data-slot="${i}">
              ${id ? icon(id) : ''}${id && n ? `<b>${n}</b>` : ''}<em>${i + 1}</em></button>`;
          })
          .join('') + `<button class="ew-slot ew-dir" data-a="turn" title="Turn (R)"><span style="transform:rotate(${dir * 90}deg)">➜</span></button>`;
    }
    barEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.slot) selectSlot(+b.dataset.slot);
      else if (b.dataset.a === 'turn') turn();
    });

    function updateHud() {
      renderHearts();
      renderBar();
      const s = g.stamina;
      stamEl.style.setProperty('--s', String(s));
      stamEl.classList.toggle('tired', g.tired);
      stamEl.hidden = s >= 1 && !g.swimming;
      const ph = g.dayPhase;
      const clock = ph < 0.6 ? '☀️' : ph < 0.7 ? '🌅' : '🌙';
      infoEl.textContent = `${clock} Day ${g.day} · ${g.world.biomeName(Math.floor(g.px), Math.floor(g.py))}${g.swimming ? ' · swimming' : g.gliding ? ' · gliding' : ''}`;
      const o = g.objective();
      const text = touchMode ? o.text.replace('Hold click on', 'Tap and hold').replace('(Tab)', '🎒').replace(' with E', ' with ✋') : o.text;
      if (goalT.textContent !== text) goalT.textContent = text;
      if (o.x !== undefined) {
        compass.hidden = false;
        const a = Math.atan2(o.y! + 0.5 - g.py, o.x + 0.5 - g.px);
        compass.style.transform = `rotate(${a}rad)`;
        compass.title = `${Math.round(Math.hypot(o.x - g.px, o.y! - g.py))} steps`;
      } else compass.hidden = true;
      muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    }

    // ---------- screens ----------
    function closeOverlay() {
      if (overlay === 'title') return;
      overlay = 'none';
      openMachine = null;
      ui.innerHTML = '';
      el.focus();
    }
    function title() {
      overlay = 'title';
      playing = false;
      hud.hidden = true;
      barEl.hidden = true;
      touchEl.hidden = true;
      stopMusic();
      const s = readSave();
      ui.innerHTML = `<div class="ew-screen">
        <div class="ew-logo">${LOGO}<h1>Emberwild</h1></div>
        <p class="ew-tag">The four Ember Beacons have gone out. Roam a wild land, mine and build with blocks,
          and set up drills, belts, furnaces and assemblers to make what each beacon needs to burn again.</p>
        <div class="ew-menu">
          ${s ? `<button class="ew-btn big" data-a="continue">Continue <small>${s.beacons.filter((b) => b.lit).length}/4 beacons · day ${Math.floor(s.t / 360) + 1}</small></button>` : ''}
          <button class="ew-btn ${s ? '' : 'big'}" data-a="new">${s ? 'New world' : 'Start exploring'}</button>
          <button class="ew-btn ghost" data-a="exit">Back to games</button>
        </div>
        ${touchMode ? '<p class="ew-note">On a phone: drag the stick to walk, tap the ground to mine or build (hold to keep mining), and use the buttons to fight.</p>' : CONTROLS}
      </div>`;
    }
    function startGame(save: SaveData | null) {
      if (!save && readSave() && !confirmNew) {
        confirmNew = true;
        const b = ui.querySelector<HTMLButtonElement>('[data-a="new"]');
        if (b) b.innerHTML = 'Start over? <small>Your saved world will be replaced. Click again.</small>';
        return;
      }
      confirmNew = false;
      g = new Game(save ?? undefined);
      wire(g);
      R.camX = g.px;
      R.camY = g.py;
      R.mapSeed = -1;
      overlay = 'none';
      playing = true;
      ui.innerHTML = '';
      hud.hidden = false;
      barEl.hidden = false;
      touchEl.hidden = !touchMode;
      heartsKey = '';
      renderBar(true);
      el.focus();
      startMusic(() => g.isNight);
      if (!save) {
        g.give('campfire', 1);
        banner('<b>Emberwild</b><span>Chop trees and mine rocks. Your first goal is a stone pickaxe.</span>');
        if (!writeSave(g.save())) toast("This browser won't keep saves.");
      }
    }
    let confirmNew = false;
    function doSave(quiet = false) {
      const ok = writeSave(g.save());
      if (!quiet) toast(ok ? 'Game saved!' : "Couldn't save in this browser.");
    }
    function menu() {
      overlay = 'menu';
      ui.innerHTML = `<div class="ew-dim"><div class="ew-panel">
        <h2>Paused</h2>
        <p class="ew-sub">Day ${g.day} · ${g.world.beacons.filter((b) => b.lit).length}/4 beacons lit · ${fmtTime(g.t - 108)} played</p>
        <div class="ew-menu">
          <button class="ew-btn big" data-a="resume">Keep playing</button>
          <button class="ew-btn" data-a="save">💾 Save</button>
          <button class="ew-btn" data-a="savequit">Save and quit</button>
        </div>
        ${CONTROLS}
      </div></div>`;
    }
    function showWin() {
      overlay = 'win';
      ui.innerHTML = `<div class="ew-dim win"><div class="ew-panel">
        ${LOGO}
        <h2>The Sky Engine wakes!</h2>
        <p>With all four beacons burning and the Sky Engine humming, warm light pours back over the whole land. You did it in ${g.day} days.</p>
        <div class="ew-menu"><button class="ew-btn big" data-a="resume">Keep playing</button><button class="ew-btn ghost" data-a="savequit">Save and quit</button></div>
      </div></div>`;
    }

    // ---- bag: items, crafting, journal ----
    function bag(tab = bagTab) {
      bagTab = tab;
      overlay = 'bag';
      const tabs = (['craft', 'bag', 'journal'] as const)
        .map((t) => `<button class="ew-tab ${t === tab ? 'on' : ''}" data-tab="${t}">${{ craft: '🔨 Craft', bag: '🎒 Bag', journal: '📜 Journal' }[t]}</button>`)
        .join('');
      let body = '';
      if (tab === 'bag') {
        const ids = (Object.keys(g.inv) as ItemId[]).filter((id) => (g.inv[id] ?? 0) > 0);
        const tools = ids.filter((id) => ITEMS[id].tool);
        const stuff = ids.filter((id) => !ITEMS[id].tool);
        body = `<p class="ew-sub">Click a block, machine or food to put it in hotbar slot ${g.sel + 1}.</p>
          <div class="ew-grid">${stuff.map((id) => `<button class="ew-cell" data-hot="${id}" title="${name(id)}">${icon(id)}<b>${g.inv[id]}</b><span>${name(id)}</span></button>`).join('') || '<p>Your bag is empty.</p>'}</div>
          <h3>Gear</h3><div class="ew-gear">${tools.map((id) => `<span>${icon(id)} ${name(id)}</span>`).join('') || '<span>Bare hands for now.</span>'}
          ${[...g.relics].map((r) => `<span class="relic" title="${RELICS[r].text}">✨ ${RELICS[r].name}</span>`).join('')}</div>`;
      } else if (tab === 'craft') {
        const camp = g.nearCampfire();
        body = `<div class="ew-recipes">${RECIPES.map((r, i) => {
          if (!g.recipeOpen(r)) return '';
          const owned = ITEMS[r.out].tool && g.has(r.out);
          const ok = g.canCraft(r);
          const ins = r.inp.map(([id, n]) => `<span class="${g.has(id, n) ? '' : 'miss'}">${icon(id)}${g.inv[id] ?? 0}/${n}</span>`).join('');
          const note = r.needs === 'campfire' && !camp ? '<em>near a campfire</em>' : owned ? '<em>owned</em>' : '';
          return `<div class="ew-rec ${ok ? 'ok' : ''}">
            <div class="ew-rec-out">${icon(r.out)}<b>${name(r.out)}${r.n > 1 ? ` ×${r.n}` : ''}</b></div>
            <div class="ew-rec-in">${ins}${note}</div>
            <div class="ew-rec-btns"><button class="ew-btn sm" data-craft="${i}" ${ok ? '' : 'disabled'}>Craft</button>
            ${ITEMS[r.out].tool || r.out === 'sky_engine' ? '' : `<button class="ew-btn sm ghost" data-craft5="${i}" ${ok ? '' : 'disabled'}>×5</button>`}</div>
          </div>`;
        }).join('')}</div>
        <p class="ew-sub">Smelting happens in a furnace: ${Object.entries(SMELT).map(([k, v]) => `${v!.use > 1 ? v!.use + ' ' : ''}${name(k as ItemId).toLowerCase()} → ${name(v!.out).toLowerCase()}`).join(' · ')}.</p>`;
      } else {
        body = `<div class="ew-journal">${BEACONS.map((def) => {
          const b = g.world.beacons.find((q) => q.id === def.id)!;
          const guards = g.guards[def.id] ?? 0;
          const wants = def.want.map(([id, n]) => `<span>${icon(id)} ${Math.min(n, b.given[id] ?? 0)}/${n}</span>`).join('');
          return `<div class="ew-jb ${b.lit ? 'lit' : ''}"><h3>${b.lit ? '🔥' : '🕯️'} ${def.name} <small>${def.biome}</small></h3>
            <div class="ew-wants">${wants}</div>
            <p>${b.lit ? 'Burning bright.' : guards ? `${guards} Rustguard${guards > 1 ? 's' : ''} guard it.` : def.hint}</p></div>`;
        }).join('')}</div>
        <h3>Tips</h3>
        <ul class="ew-tips">
          <li>Mine a seam to uncover its <b>vein</b>. A drill on a vein digs forever and pushes ore out of its arrow side.</li>
          <li>Belts carry things into furnaces, assemblers and chests. A furnace takes fuel (coal or wood) from belts too.</li>
          <li>Glowing <b>waystones</b> let you travel from the map. Gloomlings come out at night, but stay away from lamps and fires.</li>
          <li>Treasure chests hide all over the land: hearts, gear and relics.</li>
        </ul>${CONTROLS}`;
      }
      ui.innerHTML = `<div class="ew-dim"><div class="ew-panel wide">
        <button class="ew-x" data-a="close">✕</button>
        <div class="ew-tabs">${tabs}</div>${body}</div></div>`;
    }

    // ---- machines ----
    function stockRow(s: Record<string, number> | undefined, takeAttr = '') {
      const ids = Object.keys(s ?? {}) as ItemId[];
      if (!ids.length) return '<span class="ew-faint">empty</span>';
      return ids.map((id) => `<button class="ew-chip" ${takeAttr ? `data-${takeAttr}="${id}"` : 'disabled'}>${icon(id)}${s![id]}</button>`).join('');
    }
    function machinePanel() {
      const m = openMachine;
      if (!m) return;
      overlay = 'machine';
      let body = '';
      const prog = (total: number) => `<div class="ew-prog"><i style="width:${Math.min(100, ((m.prog ?? 0) / total) * 100)}%"></i></div>`;
      if (m.kind === 'furnace') {
        const k = Object.keys(m.inp!)[0] as ItemId | undefined;
        const smeltables = (Object.keys(SMELT) as ItemId[]).filter((id) => g.has(id));
        const fuels = (['coal', 'wood', 'plank'] as ItemId[]).filter((id) => g.has(id));
        body = `<p class="ew-sub">Smelts ore into plates, sand into glass, stone into bricks and iron into steel. One kind at a time.</p>
          <div class="ew-mrow"><b>In</b>${stockRow(m.inp, 'mtakein')}</div>
          <div class="ew-mrow"><b>Fuel</b><span>🔥 ${m.fuelStock} smelts</span></div>
          ${k && SMELT[k] ? prog(SMELT[k]!.time) : ''}
          <div class="ew-mrow"><b>Out</b>${stockRow(m.out, 'mtake')}</div>
          <h3>Put in</h3><div class="ew-chips">${smeltables.map((id) => `<button class="ew-chip" data-put="${id}" ${k && k !== id ? 'disabled' : ''}>${icon(id)}${name(id)} (${g.inv[id]})</button>`).join('')}
          ${fuels.map((id) => `<button class="ew-chip fuel" data-fuel="${id}">${icon(id)}${name(id)} as fuel (${g.inv[id]})</button>`).join('')}
          ${!smeltables.length && !fuels.length ? '<span class="ew-faint">Nothing in your bag fits.</span>' : ''}</div>`;
      } else if (m.kind === 'drill') {
        body = `<p class="ew-sub">Digs the vein under it and pushes ore out of its arrow side onto a belt, furnace or chest. Press R while pointing at it to turn it.</p>
          ${prog(3)}<div class="ew-mrow"><b>Holding</b>${stockRow(m.out, 'mtake')}</div>`;
      } else if (m.kind === 'assembler') {
        const r = RECIPES[m.recipe ?? -1];
        const pick = RECIPES.map((rr, i) => (rr.needs || rr.locked || ITEMS[rr.out].tool ? '' : `<button class="ew-chip ${i === m.recipe ? 'on' : ''}" data-recipe="${i}" title="${name(rr.out)}">${icon(rr.out)}</button>`)).join('');
        body = `<p class="ew-sub">Pick what to make. Feed it by belt, or fill it from your bag. It pushes what it makes out of its arrow side.</p>
          <div class="ew-chips">${pick}</div>
          ${r ? `<div class="ew-mrow"><b>Makes</b>${icon(r.out)} ${name(r.out)} ×${r.n} from ${r.inp.map(([id, n]) => `${n} ${name(id).toLowerCase()}`).join(' + ')}</div>
          <div class="ew-mrow"><b>In</b>${stockRow(m.inp, 'mtakein')}</div>${prog(r.time * 1.5)}
          <div class="ew-mrow"><b>Out</b>${stockRow(m.out, 'mtake')}</div>
          <button class="ew-btn sm" data-a="fill">Fill from bag</button>` : ''}`;
      } else if (m.kind === 'chest') {
        const mine = (Object.keys(g.inv) as ItemId[]).filter((id) => !ITEMS[id].tool && (g.inv[id] ?? 0) > 0);
        body = `<p class="ew-sub">Belts pointing into a chest fill it up. Click to move things.</p>
          <div class="ew-mrow"><b>Chest</b>${stockRow(m.out, 'mtake')}</div>
          ${stockSum(m.out) ? '<button class="ew-btn sm" data-a="takeall">Take everything</button>' : ''}
          <h3>Your bag</h3><div class="ew-chips">${mine.map((id) => `<button class="ew-chip" data-store="${id}">${icon(id)}${g.inv[id]}</button>`).join('') || '<span class="ew-faint">empty</span>'}</div>`;
      } else if (m.kind === 'campfire') {
        const cook = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => r.needs === 'campfire');
        body = `<p class="ew-sub">You'll wake up here if you get knocked out. Gloomlings stay away from its light.</p>
          <div class="ew-recipes">${cook.map(({ r, i }) => `<div class="ew-rec ${g.canCraft(r) ? 'ok' : ''}"><div class="ew-rec-out">${icon(r.out)}<b>${name(r.out)}</b></div>
          <div class="ew-rec-in">${r.inp.map(([id, n]) => `<span class="${g.has(id, n) ? '' : 'miss'}">${icon(id)}${g.inv[id] ?? 0}/${n}</span>`).join('')}</div>
          <div class="ew-rec-btns"><button class="ew-btn sm" data-craft="${i}" ${g.canCraft(r) ? '' : 'disabled'}>Cook</button></div></div>`).join('')}</div>`;
      }
      ui.innerHTML = `<div class="ew-side"><div class="ew-panel">
        <button class="ew-x" data-a="close">✕</button>
        <h2>${icon(m.kind as ItemId)} ${name(m.kind as ItemId)}</h2>${body}</div></div>`;
    }
    function machineClick(b: HTMLElement) {
      const m = openMachine!;
      const d = b.dataset;
      const takeAll = (src: Record<string, number>, id: ItemId) => {
        const n = src[id] ?? 0;
        if (!n) return;
        take(src, id, n);
        g.give(id, n);
      };
      if (d.mtake) takeAll(m.out!, d.mtake as ItemId);
      else if (d.mtakein) takeAll(m.inp!, d.mtakein as ItemId);
      else if (d.put) {
        const id = d.put as ItemId;
        let n = 0;
        while (g.has(id) && g.fac.accept(m, id, -9)) {
          g.use(id, 1);
          n++;
        }
        if (!n) toast('It is full.');
      } else if (d.fuel) {
        const id = d.fuel as ItemId;
        while (g.has(id) && m.fuelStock! < 40) {
          g.use(id, 1);
          m.fuelStock! += ITEMS[id].fuel ?? 1;
        }
      } else if (d.recipe) {
        // switching recipe hands back what was loaded
        for (const k in m.inp) g.give(k as ItemId, m.inp[k as ItemId]!);
        m.inp = {};
        m.prog = 0;
        m.recipe = +d.recipe;
      } else if (d.a === 'fill') {
        const r = RECIPES[m.recipe ?? -1];
        if (r)
          for (const [id, n] of r.inp) {
            const want = n * 4 - (m.inp![id] ?? 0);
            const can = Math.min(want, g.inv[id] ?? 0);
            if (can > 0) {
              g.use(id, can);
              add(m.inp!, id, can);
            }
          }
      } else if (d.a === 'takeall') {
        for (const k of Object.keys(m.out!)) takeAll(m.out!, k as ItemId);
      } else if (d.store) {
        const id = d.store as ItemId;
        const n = g.inv[id] ?? 0;
        g.use(id, n);
        add(m.out!, id, n);
      } else if (d.craft) g.craft(+d.craft);
      sfx('click');
      machinePanel();
    }

    // ---- beacons ----
    function beaconPanel() {
      const def = BEACONS.find((q) => q.id === openBeacon)!;
      const b = g.world.beacons.find((q) => q.id === openBeacon)!;
      overlay = 'beacon';
      const guards = g.guards[def.id] ?? 0;
      const wants = def.want
        .map(([id, n]) => {
          const have = b.given[id] ?? 0;
          return `<div class="ew-mrow">${icon(id)} <b>${name(id)}</b><div class="ew-prog"><i style="width:${(Math.min(n, have) / n) * 100}%"></i></div><span>${Math.min(n, have)}/${n}</span><span class="ew-faint">you have ${g.inv[id] ?? 0}</span></div>`;
        })
        .join('');
      ui.innerHTML = `<div class="ew-side"><div class="ew-panel">
        <button class="ew-x" data-a="close">✕</button>
        <h2>${b.lit ? '🔥' : '🕯️'} ${def.name}</h2>
        ${b.lit ? '<p>It burns bright again. Its light keeps gloomlings away, and you can travel here from the map.</p>' : guards ? `<p>${guards} Rustguard${guards > 1 ? 's' : ''} still guard this beacon. Beat them first.</p>` : `<p>The old beacon is cold. ${def.hint}</p>${wants}<button class="ew-btn big" data-a="givebeacon">Give what I have</button>`}
      </div></div>`;
    }

    // ---- loot ----
    function lootPanel(got: string[]) {
      overlay = 'loot';
      ui.innerHTML = `<div class="ew-dim"><div class="ew-panel">
        <h2>🎁 Treasure!</h2><ul class="ew-loot">${got.map((s) => `<li>${s}</li>`).join('')}</ul>
        <button class="ew-btn big" data-a="close">Nice!</button></div></div>`;
      renderBar(true);
    }

    // ---- map ----
    let mapSel = -1;
    function mapPanel(sel = -1) {
      overlay = 'map';
      mapSel = sel;
      const size = Math.floor(Math.min(window.innerWidth - 40, window.innerHeight - 150, 680));
      ui.innerHTML = `<div class="ew-dim"><div class="ew-panel map">
        <button class="ew-x" data-a="close">✕</button>
        <h2>🗺️ Map</h2>
        <canvas class="ew-map" width="${g.world.W * 2}" height="${g.world.W * 2}" style="width:${size}px;height:${size}px"></canvas>
        <p class="ew-sub"><i class="dot me"></i>you <i class="dot bc"></i>beacon <i class="dot ws"></i>waystone (click a glowing one to travel) <i class="dot tr"></i>treasure</p>
      </div></div>`;
      const mc = ui.querySelector<HTMLCanvasElement>('.ew-map')!;
      R.drawBigMap(g, mc, { sel: mapSel });
      mc.addEventListener('click', (e) => {
        const r = mc.getBoundingClientRect();
        const tx = ((e.clientX - r.left) / r.width) * g.world.W, ty = ((e.clientY - r.top) / r.height) * g.world.W;
        const spots = [
          ...g.world.stones.filter((s) => s.found),
          ...g.world.beacons.filter((b) => b.lit),
          g.world.home,
        ];
        let best: { x: number; y: number } | null = null, bd = 9;
        for (const s of spots) {
          const d = Math.hypot(s.x - tx, s.y - ty);
          if (d < bd) {
            bd = d;
            best = s;
          }
        }
        if (best) {
          g.travel(best.x, best.y);
          R.camX = g.px;
          R.camY = g.py;
          closeOverlay();
        }
      });
    }

    // ---------- clicks in panels ----------
    ui.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'continue') startGame(readSave());
      else if (a === 'new') startGame(null);
      else if (a === 'exit') onExit();
      else if (a === 'resume' || a === 'close') closeOverlay();
      else if (a === 'save') doSave();
      else if (a === 'savequit') {
        doSave(true);
        title();
      } else if (b.dataset.tab) bag(b.dataset.tab as typeof bagTab);
      else if (overlay === 'bag' && b.dataset.craft) {
        g.craft(+b.dataset.craft);
        bag();
      } else if (overlay === 'bag' && b.dataset.craft5) {
        g.craft(+b.dataset.craft5, 5);
        bag();
      } else if (b.dataset.hot) {
        const id = b.dataset.hot as ItemId;
        const def = ITEMS[id];
        if (!def.block && !def.machine && !def.heal) return toast(`${name(id)} can't go in the hotbar.`);
        const old = g.hot.indexOf(id);
        if (old >= 0) g.hot[old] = g.hot[g.sel];
        g.hot[g.sel] = id;
        renderBar(true);
        toast(`${name(id)} is in slot ${g.sel + 1}.`);
      } else if (a === 'givebeacon') {
        g.giveToBeacon(openBeacon);
        beaconPanel();
      } else if (overlay === 'machine') machineClick(b);
    });
    hud.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || overlay !== 'none') return;
      const a = b.dataset.a;
      if (a === 'bag') bag();
      else if (a === 'map') mapPanel();
      else if (a === 'menu') menu();
      else if (a === 'mute') {
        setMuted(!isMuted());
        try {
          localStorage.setItem(MUTE_KEY, isMuted() ? '1' : '0');
        } catch {
          /* ignore */
        }
        if (!isMuted()) startMusic(() => g.isNight);
      }
    });

    // ---------- loop ----------
    let raf = 0;
    let last = performance.now();
    let panelTick = 0;
    let demoT = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!playing) {
        // title backdrop: drift slowly over the land
        demoT += dt;
        g.px = g.world.home.x + Math.cos(demoT * 0.05) * 30;
        g.py = g.world.home.y + Math.sin(demoT * 0.05) * 20;
        g.dead = 2.2; // hides the hero (no knocked-out tint at 2.2)
        R.camX = g.px;
        R.camY = g.py;
        R.frame(g, { mapTop: 58, hover: null, ghost: null, ghostDir: 0, ghostOk: false, minimap: false });
        return;
      }
      const paused = overlay === 'menu' || overlay === 'bag' || overlay === 'map' || overlay === 'loot' || overlay === 'win';
      if (!paused) {
        g.update(dt, overlay === 'none' ? moveInput() : { mx: 0, my: 0, sprint: false });
        if (overlay === 'none' && (pointerDown || touchUse)) holdUse(dt);
        saveTimer += dt;
        if (saveTimer > 45) {
          saveTimer = 0;
          doSave(true);
        }
        if (overlay === 'machine') {
          panelTick += dt;
          if (panelTick > 0.4) {
            panelTick = 0;
            if (!ui.matches(':hover') || touchMode) machinePanel();
            const m = openMachine;
            if (m && Math.hypot(m.x + 0.5 - g.px, m.y + 0.5 - g.py) > 4) closeOverlay();
          }
        }
        if (overlay === 'beacon') {
          const b = g.world.beacons.find((q) => q.id === openBeacon)!;
          if (Math.hypot(b.x + 0.5 - g.px, b.y + 0.5 - g.py) > 5) closeOverlay();
        }
      }
      const t = playing && overlay === 'none' ? currentTarget() : null;
      const sel = g.selected;
      const ghost = sel && (ITEMS[sel].block || ITEMS[sel].machine) && t && pressMode !== 'mine' && g.world.b(t.x, t.y) === 0 && !g.fac.at(t.x, t.y) ? sel : null;
      R.frame(g, {
        mapTop: touchMode || window.innerWidth < 700 ? 132 : 58,
        hover: t && (mouseSeen || touchUse || ghost) ? t : null,
        ghost,
        ghostDir: dir,
        ghostOk: !!(ghost && t && !g.canPlaceAt(t.x, t.y, ghost)),
        minimap: true,
      });
      updateHud();
    }

    const onResize = () => R.resize();
    window.addEventListener('resize', onResize);
    const onHide = () => {
      if (document.hidden && playing) doSave(true);
    };
    document.addEventListener('visibilitychange', onHide);

    wire(g);
    title();
    if (import.meta.env.DEV) (window as unknown as { __ew: () => Game }).__ew = () => g;
    R.resize();
    raf = requestAnimationFrame(frame);

    return () => {
      if (playing) doSave(true);
      cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      clearTimeout(bannerTimer);
      stopMusic();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onHide);
      el.remove();
    };
  },
};

export default game;
