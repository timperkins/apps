// Robopoculeps: you're in a mine. Dig stone, sell it to the shopkeeper in the wall, and buy flying robots
// that mine for you. Belts, grabbers and payers turn what the robots bring into money on their own.
import './style.css';
import type { GameModule } from '../types';
import { Game, type RobotKind, type SaveData } from './game';
import { Renderer } from './render';
import { isMuted, setMuted, sfx } from './audio';
import {
  BAG_COST, BAG_LV, GOLDEN_ROBOT, KINDS, KIND_INFO, ORES, ORE_IDS, SHOPKEEPER_LINE, SPEED_COST, SPEED_LV, ZONES,
  type Kind, type OreId,
} from './data';

const SAVE_KEY = 'robopoculeps-save-v1';
const MUTE_KEY = 'robopoculeps-muted';

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

const fmt = (n: number) => '$' + Math.floor(n).toLocaleString('en-US');
function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const ICON: Record<Kind, string> = {
  belt: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="#3a3f45"/><path d="M6 8l4 4-4 4M12 8l4 4-4 4" stroke="#e8b33a" stroke-width="2.4" fill="none"/></svg>`,
  grabber: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#3b3f52"/><path d="M12 12L20 6" stroke="#f0a43a" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="6" r="2.4" fill="#c9ced8"/></svg>`,
  payer: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#2f8a4c"/><text x="12" y="17" font-size="14" font-weight="900" text-anchor="middle" fill="#d4ffda" font-family="sans-serif">$</text></svg>`,
  crate: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" fill="#9c6a36" stroke="#5e3c1a" stroke-width="2"/><path d="M3 3l18 18M21 3L3 21" stroke="#5e3c1a" stroke-width="2"/></svg>`,
};
const oreDot = (o: OreId) =>
  `<i class="rp-ore rp-ore-${o}" style="--c:${o === 'stone' ? ORES[o].rock : ORES[o].fleck}"></i>`;

const CONTROLS = `
  <div class="rp-keys">
    <div><b>Arrows / WASD</b> walk</div>
    <div><b>Hold E or Space</b> mine the rock in front of you</div>
    <div><b>E</b> by the shop: shop · by a crate: take what's in it · by boulders: dynamite</div>
    <div><b>1–4</b> pick belt, grabber, payer, crate · <b>5</b> remove · <b>R</b> turn</div>
    <div><b>Click</b> to place (drag to lay belts) · <b>right-click</b> removes</div>
    <div><b>Esc</b> menu · 💾 saves your game</div>
  </div>`;

const LOGO = `<svg class="rp-logo-bot" viewBox="0 0 120 90" aria-hidden="true">
  <ellipse cx="60" cy="84" rx="26" ry="5" fill="rgba(0,0,0,.35)"/>
  <path d="M60 18v-8" stroke="#d9dde3" stroke-width="3"/><ellipse cx="60" cy="9" rx="30" ry="3" fill="#d9dde3"/>
  <ellipse cx="60" cy="44" rx="30" ry="26" fill="#b8c0cc"/><path d="M32 52a28 12 0 0 0 56 0z" fill="#7f8896"/>
  <ellipse cx="62" cy="40" rx="18" ry="11" fill="#16222c"/><rect x="52" y="36" width="6" height="6" fill="#7ff3ff"/><rect x="66" y="36" width="6" height="6" fill="#7ff3ff"/>
  <path d="M50 68l-6 12M70 68l6 12" stroke="#ff7a50" stroke-width="2.5" stroke-dasharray="3 2"/>
</svg>`;

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'rp';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="rp-canvas"></canvas>
      <div class="rp-hud" hidden>
        <div class="rp-top">
          <div class="rp-money"></div>
          <div class="rp-bag"></div>
          <div class="rp-btns">
            <button class="rp-ib" data-a="save" title="Save">💾</button>
            <button class="rp-ib" data-a="mute" title="Sound"></button>
            <button class="rp-ib" data-a="menu" title="Menu">☰</button>
          </div>
        </div>
        <div class="rp-tip"></div>
      </div>
      <div class="rp-say" hidden></div>
      <div class="rp-toast" hidden></div>
      <div class="rp-bar" hidden></div>
      <div class="rp-touch" hidden>
        <div class="rp-stick"><div class="rp-knob"></div></div>
        <button class="rp-mine" data-t="mine">⛏️</button>
      </div>
      <div class="rp-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const hud = el.querySelector<HTMLDivElement>('.rp-hud')!;
    const moneyEl = el.querySelector<HTMLDivElement>('.rp-money')!;
    const bagEl = el.querySelector<HTMLDivElement>('.rp-bag')!;
    const tipEl = el.querySelector<HTMLDivElement>('.rp-tip')!;
    const muteBtn = el.querySelector<HTMLButtonElement>('[data-a="mute"]')!;
    const sayEl = el.querySelector<HTMLDivElement>('.rp-say')!;
    const toastEl = el.querySelector<HTMLDivElement>('.rp-toast')!;
    const barEl = el.querySelector<HTMLDivElement>('.rp-bar')!;
    const touchEl = el.querySelector<HTMLDivElement>('.rp-touch')!;
    const ui = el.querySelector<HTMLDivElement>('.rp-ui')!;
    const R = new Renderer(cv);

    try {
      setMuted(localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      /* ignore */
    }

    let g = new Game();
    let mode: 'title' | 'play' = 'title';
    let overlay: 'none' | 'shop' | 'menu' | 'win' = 'none';
    let tool: Kind | 'remove' | null = null;
    let dir = 0;
    let hover: { x: number; y: number } | null = null;
    let wasNearShop = false;
    let lastLine = -99;
    let touchMode = !!window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;

    // ---------- messages ----------
    let toastTimer = 0;
    function toast(text: string) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), 3200);
    }
    let sayTimer = 0;
    function shopkeeperSays() {
      // the shop panel shows his words; the bubble is for when the panel is closed
      if (overlay !== 'shop') {
        sayEl.innerHTML = `<b>Shopkeeper:</b> “${SHOPKEEPER_LINE}”`;
        sayEl.hidden = false;
        clearTimeout(sayTimer);
        sayTimer = window.setTimeout(() => (sayEl.hidden = true), 5000);
      }
      if (g.time - lastLine < 6 || isMuted() || !('speechSynthesis' in window)) return;
      lastLine = g.time;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(SHOPKEEPER_LINE);
        u.pitch = 1.3;
        u.rate = 1.05;
        speechSynthesis.speak(u);
      } catch {
        /* no voice */
      }
    }
    function wire(gm: Game) {
      gm.onSound = sfx;
      gm.onMsg = toast;
    }

    // ---------- screens ----------
    function title() {
      mode = 'title';
      overlay = 'none';
      const s = readSave();
      ui.innerHTML = `<div class="rp-screen">
        <div class="rp-logo">${LOGO}<h1>Robopoculeps</h1></div>
        <p class="rp-tag">You're deep in a mine. Dig stone, trade it to the shopkeeper in the wall, and build flying robots that mine for you.</p>
        <div class="rp-menu">
          ${s ? `<button class="rp-btn big" data-a="continue">Continue <small>${fmt(s.money)} · ${s.robots.length} robots · ${fmtTime(s.time)}</small></button>` : ''}
          <button class="rp-btn ${s ? '' : 'big'}" data-a="new">${s ? 'New game' : 'Start mining'}</button>
          <button class="rp-btn ghost" data-a="exit">Back to games</button>
        </div>
        ${CONTROLS}
        <p class="rp-note">On a phone: drag the stick to walk, hold ⛏️ to mine, and tap the ground to build.</p>
      </div>`;
    }

    function startGame(save: SaveData | null) {
      g = new Game(save ?? undefined);
      wire(g);
      mode = 'play';
      overlay = 'none';
      ui.innerHTML = '';
      tool = null;
      wasNearShop = g.nearShop();
      renderBar();
      el.focus();
      if (!save) toast('Hold E (or ⛏️) next to a rock to mine it. The shop is up in the wall.');
    }

    function doSave() {
      if (writeSave(g.save())) toast('Game saved!');
      else toast("Couldn't save in this browser.");
    }

    function menu() {
      overlay = 'menu';
      ui.innerHTML = `<div class="rp-dim"><div class="rp-panel">
        <h2>Paused</h2>
        <p class="rp-dim-t">${fmt(g.earned)} earned · ${g.robots.length} robots · ${fmtTime(g.time)} played</p>
        <div class="rp-menu">
          <button class="rp-btn big" data-a="resume">Keep mining</button>
          <button class="rp-btn" data-a="save">💾 Save</button>
          <button class="rp-btn" data-a="savequit">Save and quit</button>
          <button class="rp-btn ghost" data-a="quit">Quit without saving</button>
        </div>
        ${CONTROLS}
      </div></div>`;
    }

    function resume() {
      overlay = 'none';
      ui.innerHTML = '';
      el.focus();
    }

    function win() {
      overlay = 'win';
      sfx('win');
      ui.innerHTML = `<div class="rp-dim win"><div class="rp-panel">
        ${LOGO.replace('#b8c0cc', '#f2c230').replace('#7f8896', '#c99410')}
        <h2>The Golden Robot King!</h2>
        <p>You built the greatest robot in the whole mine in ${fmtTime(g.time)}. It mines every kind of ore, three times faster than the rest. You beat Robopoculeps!</p>
        <div class="rp-menu"><button class="rp-btn big" data-a="resume">Keep mining</button></div>
      </div></div>`;
    }

    // ---------- shop ----------
    function shop() {
      overlay = 'shop';
      sayEl.hidden = true;
      toastEl.hidden = true;
      renderShop();
    }

    function row(label: string, sub: string, price: string, act: string, ok: boolean, extra = '') {
      return `<button class="rp-item" data-buy="${act}" ${ok ? '' : 'disabled'}>${extra}<span><b>${label}</b><small>${sub}</small></span><em>${price}</em></button>`;
    }

    function renderShop() {
      const scroll = ui.querySelector('.rp-panel')?.scrollTop ?? 0;
      const sells = ORE_IDS.filter((o) => g.bag[o] > 0)
        .map((o) => row(`Sell ${g.bag[o]} ${ORES[o].name}`, `${fmt(ORES[o].price)} each`, '+' + fmt(g.bag[o] * ORES[o].price), `sell:${o}`, true, oreDot(o)))
        .join('');
      const robots = ORE_IDS.map((o, z) => {
        const owned = g.robots.filter((r) => r.kind === o).length;
        const open = z <= g.unlocked;
        return row(`${ORES[o].name} robot`, open ? `Flies out and mines ${ORES[o].name.toLowerCase()} · you have ${owned}` : `Open the ${ZONES[z].name} first`,
          fmt(ORES[o].robot), `robot:${o}`, open && g.money >= ORES[o].robot, oreDot(o));
      }).join('');
      const machines = KINDS.map((k) => {
        const p = KIND_INFO[k].price;
        const ten = k === 'belt' ? row('10 belts', 'A bundle', fmt(p * 10), `tool:${k}:10`, g.money >= p * 10, `<i class="rp-ico">${ICON[k]}</i>`) : '';
        return row(KIND_INFO[k].name, `${KIND_INFO[k].about} · you have ${g.tools[k]}`, fmt(p), `tool:${k}:1`, g.money >= p, `<i class="rp-ico">${ICON[k]}</i>`) + ten;
      }).join('');
      const next = g.unlocked + 1;
      const dyn = next <= 4
        ? row(`Dynamite`, g.tools.dynamite ? 'You have it! Walk to the boulders and press E.' : `Blasts the boulders into the ${ZONES[next].name}`,
          fmt(ZONES[next].dynamite), 'dynamite', !g.tools.dynamite && g.money >= ZONES[next].dynamite, '<i class="rp-emo">🧨</i>')
        : '';
      const sp = SPEED_COST[g.speed], bg = BAG_COST[g.bagLv];
      const ups =
        row('Turbo propellers', sp !== undefined ? `Robots fly faster (×${SPEED_LV[g.speed + 1]})` : 'All the way up!', sp !== undefined ? fmt(sp) : 'MAX', 'up:speed', sp !== undefined && g.money >= sp, '<i class="rp-emo">🌀</i>') +
        row('Bigger robot bags', bg !== undefined ? `Robots carry ${BAG_LV[g.bagLv + 1]} instead of ${BAG_LV[g.bagLv]}` : 'All the way up!', bg !== undefined ? fmt(bg) : 'MAX', 'up:bag', bg !== undefined && g.money >= bg, '<i class="rp-emo">🎒</i>') +
        row('Golden Robot King', g.golden ? 'Already flying around your mine!' : 'Mines every ore 3× faster. Win the game!', fmt(GOLDEN_ROBOT), 'robot:king', !g.golden && g.money >= GOLDEN_ROBOT, '<i class="rp-emo">👑</i>');
      ui.innerHTML = `<div class="rp-dim shop"><div class="rp-panel wide">
        <div class="rp-shop-head">
          <svg viewBox="0 0 60 60" class="rp-keeper" aria-hidden="true"><rect x="16" y="36" width="28" height="24" fill="#7d3b8f"/><circle cx="30" cy="30" r="12" fill="#f1c9a0"/>
            <path d="M14 22h32L34 0z" fill="#1b2a6b"/><circle cx="24" cy="15" r="2" fill="#ffe36b"/><circle cx="32" cy="9" r="2" fill="#ffe36b"/><circle cx="37" cy="17" r="3" fill="#fff3c4"/><circle cx="38" cy="16" r="2.5" fill="#1b2a6b"/>
            <rect x="24" y="27" width="3" height="3" fill="#111"/><rect x="33" y="27" width="3" height="3" fill="#111"/><path d="M22 34q4-3 8 0q4-3 8 0" stroke="#5a3418" stroke-width="3" fill="none"/></svg>
          <div><p class="rp-quote">“${SHOPKEEPER_LINE}”</p><p class="rp-cash">You have <b>${fmt(g.money)}</b></p></div>
          <button class="rp-x" data-a="close">✕</button>
        </div>
        <div class="rp-cols">
          <div>
            <h3>Sell</h3>
            ${sells ? sells + (ORE_IDS.filter((o) => g.bag[o]).length > 1 ? row('Sell everything', '', '+' + fmt(g.sellValue()), 'sell:all', true, '<i class="rp-emo">💰</i>') : '') : '<p class="rp-dim-t">Your bag is empty. Mine rocks or take things out of a crate, then come back.</p>'}
            <h3>Robots</h3>${robots}
          </div>
          <div>
            <h3>Machines</h3>${machines}
            <h3>Big stuff</h3>${dyn}${ups}
          </div>
        </div>
        <button class="rp-btn" data-a="close">Bye!</button>
      </div></div>`;
      const panel = ui.querySelector('.rp-panel');
      if (panel) panel.scrollTop = scroll;
    }

    function buy(what: string) {
      const [a, b, c] = what.split(':');
      let ok = false;
      if (a === 'sell') ok = g.sell(b === 'all' ? undefined : (b as OreId)) > 0;
      else if (a === 'robot') {
        ok = g.buyRobot(b as RobotKind);
        if (ok && b === 'king') return win();
      } else if (a === 'tool') ok = g.buyTool(b as Kind, Number(c));
      else if (a === 'dynamite') ok = g.buyTool('dynamite');
      else if (a === 'up') ok = g.buyUpgrade(b as 'speed' | 'bag');
      if (!ok) sfx('nope');
      renderShop();
      renderBar();
    }

    // ---------- build bar ----------
    function renderBar() {
      const btn = (t: string, inner: string, n: number | null, on: boolean, label: string) =>
        `<button class="rp-tool ${on ? 'on' : ''}" data-tool="${t}" title="${label}">${inner}${n !== null ? `<b>${n}</b>` : ''}</button>`;
      barEl.innerHTML =
        btn('hand', '✋', null, tool === null, 'Hands (mine)') +
        KINDS.map((k, i) => btn(k, ICON[k], g.tools[k], tool === k, `${KIND_INFO[k].name} (${i + 1})`)).join('') +
        btn('remove', '🗑️', null, tool === 'remove', 'Remove (5)') +
        `<button class="rp-tool" data-tool="rotate" title="Turn (R)"><span class="rp-arrow" style="transform:rotate(${dir * 90}deg)">➜</span></button>`;
    }

    function selectTool(t: string) {
      if (t === 'rotate') {
        dir = (dir + 1) % 4;
        sfx('click');
      } else if (t === 'hand') tool = null;
      else if (t === 'remove') tool = tool === 'remove' ? null : 'remove';
      else {
        const k = t as Kind;
        if (tool === k) tool = null;
        else if (g.tools[k] <= 0) {
          toast(`You don't have any ${KIND_INFO[k].name.toLowerCase()}s. Buy them at the shop.`);
          tool = null;
        } else tool = k;
      }
      renderBar();
    }

    function useTool(x: number, y: number) {
      if (!tool) return false;
      if (tool === 'remove') {
        if (g.remove(x, y)) renderBar();
        return true;
      }
      if (g.place(x, y, tool, dir)) {
        if (g.tools[tool] <= 0 && !g.bldAt(x, y)) tool = null;
        renderBar();
      }
      return true;
    }

    // ---------- input ----------
    const keys = new Set<string>();
    let actHeld = false;
    let stick = { x: 0, y: 0 };
    function pressAct() {
      if (mode !== 'play' || overlay !== 'none') return;
      if (g.act() === 'shop') {
        shop();
        shopkeeperSays();
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'play') return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === 'escape') {
        if (overlay === 'none' && tool) {
          tool = null;
          renderBar();
        } else if (overlay === 'none') menu();
        else resume();
        return;
      }
      if (overlay !== 'none') return;
      keys.add(k);
      if (e.repeat) return;
      if (k === 'e' || k === ' ') {
        actHeld = true;
        pressAct();
      } else if (k >= '1' && k <= '4') selectTool(KINDS[Number(k) - 1]);
      else if (k === '5' || k === 'x') selectTool('remove');
      else if (k === 'r') selectTool('rotate');
      else if (k === 'q' || k === '0') selectTool('hand');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.delete(k);
      if (k === 'e' || k === ' ') actHeld = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    const onBlur = () => {
      keys.clear();
      actHeld = false;
    };
    window.addEventListener('blur', onBlur);

    // canvas: build with click/tap, drag to lay belts
    let dragId: number | null = null;
    let dragLast: { x: number; y: number } | null = null;
    const tileAt = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return R.screenToTile(R.cam(g), e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener('pointerdown', (e) => {
      if (mode !== 'play' || overlay !== 'none') return;
      if (e.pointerType === 'touch') touchMode = true;
      const t = tileAt(e);
      hover = t;
      if (e.button === 2) {
        if (g.remove(t.x, t.y)) renderBar();
        return;
      }
      if (!tool) return;
      e.preventDefault();
      dragId = e.pointerId;
      dragLast = t;
      cv.setPointerCapture(e.pointerId);
      useTool(t.x, t.y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (mode !== 'play') return;
      const t = tileAt(e);
      if (e.pointerType === 'mouse' || dragId !== null) hover = t;
      if (e.pointerId !== dragId || !dragLast || !tool) return;
      if (t.x === dragLast.x && t.y === dragLast.y) return;
      if (tool === 'belt' && Math.abs(t.x - dragLast.x) + Math.abs(t.y - dragLast.y) === 1) {
        // drag lays a line of belts pointing the way you drag
        dir = t.x > dragLast.x ? 0 : t.y > dragLast.y ? 1 : t.x < dragLast.x ? 2 : 3;
        const prev = g.bldAt(dragLast.x, dragLast.y);
        if (prev?.k === 'belt') prev.dir = dir;
      }
      useTool(t.x, t.y);
      dragLast = t;
    });
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId === dragId) {
        dragId = null;
        dragLast = null;
        renderBar();
      }
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') hover = null;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch stick and mine button
    const stickEl = touchEl.querySelector<HTMLDivElement>('.rp-stick')!;
    const knob = touchEl.querySelector<HTMLDivElement>('.rp-knob')!;
    let stickId: number | null = null;
    const setStick = (cx: number, cy: number) => {
      const r = stickEl.getBoundingClientRect();
      const rad = r.width / 2;
      let dx = (cx - r.left - rad) / rad, dy = (cy - r.top - rad) / rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
      stick = Math.hypot(dx, dy) < 0.2 ? { x: 0, y: 0 } : { x: dx, y: dy };
    };
    const releaseStick = () => {
      stickId = null;
      knob.style.transform = '';
      stick = { x: 0, y: 0 };
    };
    stickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stickId = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      setStick(e.clientX, e.clientY);
    });
    stickEl.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) setStick(e.clientX, e.clientY);
    });
    stickEl.addEventListener('pointerup', releaseStick);
    stickEl.addEventListener('pointercancel', releaseStick);
    const mineBtn = touchEl.querySelector<HTMLButtonElement>('.rp-mine')!;
    mineBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      mineBtn.setPointerCapture(e.pointerId);
      actHeld = true;
      pressAct();
    });
    const mineUp = () => (actHeld = false);
    mineBtn.addEventListener('pointerup', mineUp);
    mineBtn.addEventListener('pointercancel', mineUp);
    const onTouch = () => (touchMode = true);
    window.addEventListener('touchstart', onTouch, { passive: true });

    barEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (b) selectTool(b.dataset.tool!);
    });
    hud.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (a === 'save') doSave();
      else if (a === 'menu') overlay === 'none' ? menu() : resume();
      else if (a === 'mute') {
        setMuted(!isMuted());
        try {
          localStorage.setItem(MUTE_KEY, isMuted() ? '1' : '0');
        } catch {
          /* ignore */
        }
        if (isMuted() && 'speechSynthesis' in window) speechSynthesis.cancel();
      }
    });
    ui.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLElement>('[data-buy]');
      if (b) return buy(b.dataset.buy!);
      const a = t.closest<HTMLElement>('[data-a]')?.dataset.a;
      if (a === 'continue') startGame(readSave());
      else if (a === 'new') startGame(null);
      else if (a === 'exit') onExit();
      else if (a === 'resume' || a === 'close') resume();
      else if (a === 'save') {
        doSave();
        menu();
      } else if (a === 'savequit') {
        doSave();
        title();
      } else if (a === 'quit') title();
    });

    // ---------- loop ----------
    let hudKey = '';
    let hudT = 0;
    function updateHud(dt: number) {
      const show = mode === 'play';
      hud.hidden = !show;
      barEl.hidden = !show || overlay !== 'none';
      touchEl.hidden = !(show && touchMode && overlay === 'none');
      el.classList.toggle('touch', touchMode);
      if (!show) return;
      hudT -= dt;
      if (hudT > 0) return;
      hudT = 0.15;
      const bag = ORE_IDS.filter((o) => g.bag[o] > 0).map((o) => `<span>${oreDot(o)}${g.bag[o]}</span>`).join('');
      let tip: string;
      if (!g.robots.length) tip = g.money >= 50 ? 'You can buy a robot! Go to the shop.' : 'Mine rocks, then sell the stone at the shop in the wall. A robot costs $50.';
      else if (!g.tools.payer && ![...g.blds.values()].some((b) => b.k === 'payer')) tip = 'Robots fill the crate. Take it out (E), or buy a grabber, belts and a payer to sell by themselves.';
      else if (g.unlocked < 4) tip = g.tools.dynamite ? `Take the dynamite to the boulders of the ${ZONES[g.unlocked + 1].name}.` : `Save up ${fmt(ZONES[g.unlocked + 1].dynamite)} for dynamite to open the ${ZONES[g.unlocked + 1].name}.`;
      else tip = g.golden ? 'You beat Robopoculeps! Keep building.' : `Save up ${fmt(GOLDEN_ROBOT)} for the Golden Robot King.`;
      const key = `${Math.floor(g.money)}|${bag}|${g.robots.length}|${tip}|${isMuted()}`;
      if (key === hudKey) return;
      hudKey = key;
      moneyEl.textContent = fmt(g.money);
      bagEl.innerHTML = `${bag}<span class="rp-bots">🤖 ${g.robots.length}</span>`;
      tipEl.textContent = tip;
      muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (R.w !== cv.clientWidth || R.h !== cv.clientHeight) R.resize();
      if (mode === 'play' && overlay !== 'menu' && overlay !== 'win') {
        let mx = stick.x, my = stick.y;
        if (overlay === 'none') {
          if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
          if (keys.has('arrowright') || keys.has('d')) mx += 1;
          if (keys.has('arrowup') || keys.has('w')) my -= 1;
          if (keys.has('arrowdown') || keys.has('s')) my += 1;
        } else mx = my = 0;
        g.step(dt, mx, my, actHeld && overlay === 'none');
        const near = g.nearShop();
        if (near && !wasNearShop && overlay === 'none') {
          shop();
          shopkeeperSays();
        }
        wasNearShop = near;
      } else if (mode === 'title') {
        // the title screen shows the mine with robots buzzing about
        g.step(dt, 0, 0, false);
      }
      const ghost = mode === 'play' && tool && hover && overlay === 'none'
        ? { ...hover, k: tool, dir, ok: tool === 'remove' ? !!g.bldAt(hover.x, hover.y) : g.canPlace(hover.x, hover.y) || g.bldAt(hover.x, hover.y)?.k === tool }
        : null;
      R.draw(g, now / 1000, ghost);
      updateHud(dt);
    };

    // a little demo mine behind the title screen
    function demo() {
      g = new Game();
      g.onSound = () => {};
      g.money = 1000;
      g.buyRobot('stone');
      g.buyRobot('stone');
      g.buyRobot('stone');
      g.player.x = 12;
      g.player.y = 8;
    }
    demo();
    title();
    if (import.meta.env.DEV) (window as unknown as { __rp: () => Game }).__rp = () => g;
    R.resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      clearTimeout(sayTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('touchstart', onTouch);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      el.remove();
    };
  },
};

export default game;
