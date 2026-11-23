import './style.css';
import { Game, Input, SaveData } from './game';
import { drawMinimap, render } from './draw';
import { screenDirToWorld, copLevel } from './iso';
import { BUY_PRICE, RENT_PRICE, RENT_SECONDS, SHOP_ITEMS } from './data';
import { isMuted, setMuted, sfx, unlockAudio } from './audio';

const SAVE_KEY = 'od-save-v1';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}
function writeSave(g: Game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g.save()));
  } catch {
    /* storage may be blocked */
  }
}

// ---------- canvas ----------
const canvas = $<HTMLCanvasElement>('c');
const ctx = canvas.getContext('2d')!;
let W = 0;
let H = 0;
let dpr = 1;
let zoom = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  zoom = Math.max(0.6, Math.min(1.25, Math.min(W, H) / 560));
}
window.addEventListener('resize', resize);
resize();

// ---------- input ----------
const keys = new Set<string>();
let punchPressed = false;
let usePressed = false;
let stick = { x: 0, y: 0, active: false, id: -1 };
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touchy');

window.addEventListener('keydown', (e) => {
  if (e.repeat) {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    return;
  }
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'shift') punchPressed = true;
  if (k === 'e' || k === 'enter' || k === ' ') usePressed = true;
  if (k === 'p' || k === 'm' || k === 'tab') {
    e.preventDefault();
    if (game) togglePhone();
  }
  if (k === 'escape') closeModals();
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
  unlockAudio();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const stickEl = $('stick');
const knob = $('knob');
function stickMove(cx: number, cy: number) {
  const r = stickEl.getBoundingClientRect();
  const ox = r.left + r.width / 2;
  const oy = r.top + r.height / 2;
  let dx = cx - ox;
  let dy = cy - oy;
  const max = r.width / 2;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  stick.x = dx / max;
  stick.y = dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
// The joystick follows any touch on the left half of the screen.
window.addEventListener(
  'touchstart',
  (e) => {
    unlockAudio();
    for (const t of Array.from(e.changedTouches)) {
      if (!stick.active && t.clientX < W * 0.5 && !(t.target as HTMLElement).closest('button, .modal, #start')) {
        stick.active = true;
        stick.id = t.identifier;
        stickMove(t.clientX, t.clientY);
      }
    }
  },
  { passive: true },
);
window.addEventListener(
  'touchmove',
  (e) => {
    for (const t of Array.from(e.changedTouches)) if (t.identifier === stick.id) stickMove(t.clientX, t.clientY);
  },
  { passive: true },
);
const endTouch = (e: TouchEvent) => {
  for (const t of Array.from(e.changedTouches))
    if (t.identifier === stick.id) {
      stick = { x: 0, y: 0, active: false, id: -1 };
      knob.style.transform = '';
    }
};
window.addEventListener('touchend', endTouch);
window.addEventListener('touchcancel', endTouch);

function tapButton(el: HTMLElement, fn: () => void) {
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    unlockAudio();
    fn();
  });
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    unlockAudio();
    fn();
  });
}
tapButton($('punchBtn'), () => (punchPressed = true));
tapButton($('useBtn'), () => (usePressed = true));
tapButton($('phoneBtn'), () => togglePhone());
tapButton($('muteBtn'), () => {
  setMuted(!isMuted());
  $('muteBtn').textContent = isMuted() ? '🔇' : '🔊';
});

function readInput(): Input {
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  let mag = dx || dy ? 1 : 0;
  if (stick.active && Math.hypot(stick.x, stick.y) > 0.15) {
    dx = stick.x;
    dy = stick.y;
    mag = Math.min(1, Math.hypot(dx, dy) * 1.2);
  }
  const w = screenDirToWorld(dx, dy);
  const inp: Input = { mx: w.x, my: w.y, mag, punch: punchPressed, use: usePressed };
  punchPressed = false;
  usePressed = false;
  return inp;
}

// ---------- game ----------
let game: Game | null = null;

function startGame(fresh: boolean) {
  if (fresh) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
  game = new Game(fresh ? null : loadSave());
  const g = game;
  g.onSave = () => writeSave(g);
  (window as unknown as { od: Game }).od = g; // handy for debugging in the console
  $('start').hidden = true;
  $('hud').hidden = false;
  unlockAudio();
  sfx('cash');
}

if (loadSave()) {
  $('playBtn').textContent = 'Keep playing';
  $('newBtn').hidden = false;
}
$('playBtn').addEventListener('click', () => startGame(false));
$('newBtn').addEventListener('click', () => {
  if ($('newBtn').dataset.sure) startGame(true);
  else {
    $('newBtn').dataset.sure = '1';
    $('newBtn').textContent = 'Tap again to wipe your save';
  }
});

// ---------- phone ----------
let phoneTab = 'map';
function togglePhone() {
  if (!game) return;
  const ph = $('phone');
  if (ph.hidden) {
    ph.hidden = false;
    game.menu = null;
    $('menu').hidden = true;
    renderPhone();
  } else ph.hidden = true;
}
function closeModals() {
  $('phone').hidden = true;
  $('menu').hidden = true;
  if (game) game.menu = null;
}
document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
document.querySelectorAll<HTMLElement>('.modal').forEach((m) =>
  m.addEventListener('click', (e) => {
    if (e.target === m) closeModals();
  }),
);
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    phoneTab = b.dataset.tab!;
    renderPhone();
  }),
);

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function renderPhone() {
  const g = game!;
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === phoneTab));
  document.querySelectorAll<HTMLElement>('.tab').forEach((p) => (p.hidden = p.dataset.pane !== phoneTab));
  const pane = document.querySelector<HTMLElement>(`[data-pane="${phoneTab}"]`)!;
  if (phoneTab === 'map') {
    drawMinimap($<HTMLCanvasElement>('minimap'), g);
    $('where').textContent = g.scene === g.bank ? "You're inside the Bank." : g.vehicle?.kind === 'ship' ? "You're sailing the ship!" : 'The red dot is you.';
  } else if (phoneTab === 'outfits') {
    const ds = SHOP_ITEMS.filter((i) => i.kind === 'disguise');
    pane.innerHTML =
      `<p style="margin:2px 4px 8px;font-size:13px;opacity:.8">Change outfits when no cop can see you to make the cops lose you.</p>` +
      ds
        .map((d) => {
          const own = g.owned.has(d.id);
          const on = g.wearing === d.id;
          return `<div class="row"><div class="name"><b>${d.name}</b><small>${own ? (on ? 'Wearing it' : 'In your bag') : `Buy at the Shop ($${d.price})`}</small></div>${
            own ? `<button class="pill ${on ? 'red' : 'green'}" data-wear="${d.id}">${on ? 'Take off' : 'Put on'}</button>` : ''
          }</div>`;
        })
        .join('');
    pane.querySelectorAll<HTMLButtonElement>('[data-wear]').forEach((b) =>
      b.addEventListener('click', () => {
        g.setOutfit(b.dataset.wear!);
        renderPhone();
      }),
    );
  } else if (phoneTab === 'car') {
    const car = g.myCar && !g.myCar.gone ? g.myCar : null;
    pane.innerHTML = g.ownsCar
      ? `<div class="row"><div class="name"><b>Your sports car</b><small>${car && car.broken === 0 ? 'Parked somewhere (pink square on the map)' : 'Broken. Call a new one!'}</small></div><button class="pill green" id="callCar">Call it</button></div>`
      : `<p style="font-size:14px;margin:6px">You don't own a car yet. Buy one at the <b>Car lot</b> for $${BUY_PRICE}, rent one for $${RENT_PRICE}, or just borrow one from the street...</p>`;
    pane.innerHTML += `<div class="row"><div class="name"><b>Stats</b><small>Money $${Math.floor(g.money)} · Played ${fmtTime(g.time)} · Cop level ${copLevel(g.time)}</small></div></div>`;
    $('callCar')?.addEventListener('click', () => {
      g.callMyCar();
      closeModals();
    });
  } else {
    pane.innerHTML = `<div class="help">
      <p><b>Move</b> with WASD/arrows or the joystick. <b>Punch</b> with Shift or the red button. <b>Use</b> with E or the blue button.</p>
      <p><b>The Bank:</b> buy a screwdriver or wrench at the Shop. Inside, guards chase you if they see you in the back rooms. Open the vent grate in the lobby, crawl through, and climb out by the vault.</p>
      <p><b>Cars:</b> walk up to a car to pick up the driver, put them down and drive away. Buses and cars can bonk you, so watch out!</p>
      <p><b>The ship:</b> walk down the dock, beat the captain, then take the wheel and sail.</p>
      <p><b>Cops</b> get tired if they chase you too long. Every 10 minutes they get 25% tougher. At 4 stars the army shows up with Greniders, Heaters and Lazors. At 5 stars, tanks!</p>
      <p><b>Lose the cops</b> by staying out of sight, or change your disguise when nobody is looking.</p>
    </div>`;
  }
}

// ---------- shop / lot ----------
function renderMenu(msg = '') {
  const g = game!;
  const menu = $('menu');
  menu.hidden = !g.menu;
  if (!g.menu) return;
  $('menuMoney').textContent = `You have $${Math.floor(g.money)}`;
  $('menuMsg').textContent = msg;
  const body = $('menuBody');
  if (g.menu === 'shop') {
    $('menuTitle').textContent = '🛒 Shop';
    body.innerHTML = SHOP_ITEMS.map((it) => {
      const lvl = g.upgrades[it.id] ?? 0;
      const maxed = it.kind === 'upgrade' && lvl >= (it.max ?? 1);
      const owned = (it.kind === 'tool' || it.kind === 'disguise') && g.owned.has(it.id);
      const label = maxed ? 'Maxed' : owned ? 'Owned' : `$${g.priceOf(it.id)}`;
      const extra = it.kind === 'upgrade' ? ` (level ${lvl}/${it.max})` : '';
      return `<div class="row"><div class="name"><b>${it.name}${extra}</b><small>${it.desc}</small></div><button class="pill ${maxed || owned ? 'off' : g.money >= g.priceOf(it.id) ? 'green' : ''}" data-buy="${it.id}">${label}</button></div>`;
    }).join('');
    body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = g.buy(b.dataset.buy!);
        renderMenu(r);
        $('menuMsg').style.color = r.startsWith('Bought') ? '#2e7d32' : '#c62828';
      }),
    );
  } else {
    $('menuTitle').textContent = '🚗 Car lot';
    body.innerHTML = `
      <div class="row"><div class="name"><b>Rent a car</b><small>Yours for ${RENT_SECONDS / 60} minutes.</small></div><button class="pill" data-deal="rent">$${RENT_PRICE}</button></div>
      <div class="row"><div class="name"><b>Buy a sports car</b><small>Super fast. Call it any time from your phone.</small></div><button class="pill ${g.ownsCar ? 'off' : ''}" data-deal="buy">${g.ownsCar ? 'Owned' : `$${BUY_PRICE}`}</button></div>
      <p style="font-size:13px;opacity:.7;margin:10px 4px 0">Or you could just... take one of the cars on the lot. The cops won't like that.</p>`;
    body.querySelectorAll<HTMLButtonElement>('[data-deal]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = g.lotDeal(b.dataset.deal as 'rent' | 'buy');
        if (r) renderMenu(r);
        else closeModals();
      }),
    );
  }
}

// ---------- HUD ----------
let lastMenu: Game['menu'] = null;
let hudCache = '';
function updateHud(g: Game) {
  const key = [Math.floor(g.money), Math.round(g.player.hp), g.player.maxHp, g.wanted, copLevel(g.time), Math.floor(g.time), g.hint?.text, g.hint?.label, g.banners.map((b) => b.text).join('|'), !!g.overlay].join('/');
  if (key === hudCache) return;
  hudCache = key;
  $('money').textContent = `$${Math.floor(g.money).toLocaleString()}`;
  $('hp').style.width = `${Math.max(0, (g.player.hp / g.player.maxHp) * 100)}%`;
  $('stars').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < g.wanted ? 'on' : ''}">★</span>`).join('');
  $('stars').classList.toggle('flash', g.wanted > 0);
  $('level').textContent = `Cop level ${copLevel(g.time)} · ${fmtTime(g.time)}`;
  $('banners').innerHTML = g.banners.map((b) => `<div class="banner" style="color:${b.color}">${b.text}</div>`).join('');
  const h = g.hint;
  const keyHint = h?.label ? (isTouch ? '' : ` (E: ${h.label})`) : '';
  $('hint').textContent = h ? `${h.text}${keyHint}` : '';
  const use = $('useBtn');
  use.textContent = h?.label || 'USE';
  use.classList.toggle('dim', !h?.act);
  $('punchBtn').classList.toggle('dim', !!g.vehicle);
  const ov = $('overlay');
  ov.hidden = !g.overlay;
  if (g.overlay) {
    $('ovTitle').textContent = g.overlay.title;
    $('ovSub').textContent = g.overlay.sub;
  }
}

// ---------- loop ----------
let last = performance.now();
let saveT = 0;
let phoneT = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    const g = game;
    const paused = !$('phone').hidden;
    const inp = readInput();
    if (!paused) g.update(dt, inp);
    if (g.menu !== lastMenu) {
      lastMenu = g.menu;
      renderMenu();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(ctx, g, W, H, zoom, now / 1000);
    updateHud(g);
    phoneT += dt;
    if (paused && phoneTab === 'map' && phoneT > 0.1) {
      phoneT = 0;
      drawMinimap($<HTMLCanvasElement>('minimap'), g);
    }
    $('phoneClock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    saveT += dt;
    if (saveT > 10) {
      saveT = 0;
      writeSave(g);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game) writeSave(game);
});
