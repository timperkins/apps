// App shell: layout (portrait lock), screens, the game loop and saved settings.
import './style.css';
import { loadArt } from './art';
import { Renderer } from './render';
import { Game, UPGRADES, WAR_STRIKES, WAR_TIME, type Difficulty, type GameMode, type Results, type UpgradeId, type Crate, type PackKind, type BomberAct, PROTECT, SNIPER_PERKS, SHOP, PARTS, newAdventure, type ShopId, type Adventure } from './game';
import { Tilt, isComputer } from './input';
import { Sound } from './audio';
import qrcode from 'qrcode-generator';
import { CoopHost, LOCAL, MAX_PLAYERS, type Player } from './coop/host';
import { BomberPad } from './coop/pad';
import { randomName } from './coop/names';
import type { ClientMsg, Role } from './coop/protocol';
import { takeSnap } from './coop/mirror';

type Mode = 'loading' | 'start' | 'play' | 'paused' | 'cards' | 'shop' | 'countdown' | 'results' | 'recal' | 'nosensor' | 'menu' | 'lobby';
interface Settings { sound: boolean; music: boolean; vibration: boolean; reduceMotion: boolean; }
/** `wave` is the wave reached; war mode keeps the level instead, and `time` is the seconds survived. */
interface ScoreEntry { score: number; wave: number; date: number; time?: number; won?: boolean; }

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};
const stage = $('stage'), canvas = $<HTMLCanvasElement>('c');
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('skydef.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('skydef.' + k, JSON.stringify(v)); } catch { } },
};

const settings: Settings = Object.assign({ sound: true, music: true, vibration: true, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }, store.get('settings', {}));
const seenTips = new Set<string>(store.get<string[]>('tips', []));
// every mode and difficulty keeps its own high scores; hard was once called expert, and its scores keep that key
const scoreKey = (m: GameMode, d: Difficulty) => m === 'adventure' ? 'scores.adventure' + (d === 'hard' ? '.hard' : '') : m === 'coop' ? 'scores.coop' + (d === 'hard' ? '.hard' : '') : (m === 'war' ? 'scores.war' : 'scores') + (d === 'hard' ? (m === 'war' ? '.hard' : '.expert') : '');
const savedDiff = store.get<string>('difficulty', 'normal');
let difficulty: Difficulty = savedDiff === 'hard' || savedDiff === 'expert' ? 'hard' : 'normal';
const savedMode = store.get<string>('mode', 'original');
const isMode = (m: unknown): m is GameMode => m === 'original' || m === 'war' || m === 'coop' || m === 'adventure';
let gameMode: GameMode = isMode(savedMode) ? savedMode : 'original';
let scores = store.get<ScoreEntry[]>(scoreKey(gameMode, difficulty), []);

let mode: Mode = 'loading';   // loading | start | play | paused | cards | countdown | results | recal | nosensor
let toastTimer = 0;
const toastQueue: string[] = [];
let flatT = 0;
let hintState: { fire: number; tilt: number } | null = null;

const renderer = new Renderer(canvas);
const game = new Game({
  // in co-op, tips are for the Base, so they only show when this device plays the Base
  tip: (key, text) => { if (!game.coop || localRole === 'base') showTip(key, text); },
  hud: () => { },
  waveStart: n => { if (n === 1 && !game.coop && !store.get('hinted', false)) startHint(); },
  waveClear: () => { if (hintState) endHint(); },
  gameOver: showResults,
  label: () => { },
  iron: () => { saveAdventure(); ironHud(); },
});
// adventure: iron and shop levels are kept on this device between games
game.adv = Object.assign(newAdventure(), store.get<Partial<Adventure>>('adventure', {}));
if (!Array.isArray(game.adv.parts)) game.adv.parts = [];
function saveAdventure() { store.set('adventure', game.adv); }
applySettings();
game.difficulty = difficulty;
game.mode = gameMode;
if (Tilt.debug) (window as unknown as { __sd: unknown }).__sd = { game, Tilt, renderer };

/* ---------- layout: keep the game physically portrait even if the screen rotates ---------- */
/** Height of iOS 26's soft edge effect at the top of an installed app, in CSS px. iOS
 *  fades and blurs this band even below an opaque status bar, so it is a solid header strip. */
const GLASS_BAND = 44;
/** Top corner radius of the game card below the strip, in CSS px. */
const CARD_RADIUS = 14;
const iosApp = (navigator as { standalone?: boolean }).standalone === true;
function layout() {
  const W = innerWidth, H = innerHeight;
  let angle = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0);
  angle = ((angle % 360) + 360) % 360;
  let sw = W, sh = H, rot = 0;
  if (W > H) {
    if (angle === 90 || angle === 270) { sw = H; sh = W; rot = -angle; }
    else { sh = H; sw = Math.round(Math.min(W, H * .5)); } // desktop window: a phone-shaped column
  }
  const safe = getComputedStyle($('safe'));
  const inset = rot ? 0 : parseFloat(safe.paddingTop) || 0;
  // A solid header strip at the top for whatever iOS draws over: the status bar if the page
  // runs under it, plus the edge fade below.
  const band = rot ? 0 : inset > 0 ? inset + GLASS_BAND : iosApp ? GLASS_BAND : 0;
  sh -= rot ? 0 : band;
  stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
  stage.style.left = (W - sw) / 2 + 'px'; stage.style.top = (H - sh - band) / 2 + band + 'px';
  stage.style.transform = rot ? `rotate(${rot}deg)` : '';
  $('topbar').style.height = band + 'px';
  // With the strip, the game reads as a card on black: round its top corners, black behind them.
  stage.style.borderRadius = band ? `${CARD_RADIUS}px ${CARD_RADIUS}px 0 0` : '';
  document.body.style.background = band ? '#000' : '';
  renderer.resize(sw, sh);
  $('pauseBtn').style.top = '6px';
  const mode = ['fullscreen', 'standalone', 'browser'].find(m => matchMedia(`(display-mode: ${m})`).matches) ?? '?';
  $('version').textContent = __VERSION__;
  $('buildInfo').textContent = `${__VERSION__} · ${mode} · status bar inset ${Math.round(inset)}px · band ${band}px`;
}
addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 120));
if (screen.orientation) screen.orientation.addEventListener?.('change', () => setTimeout(layout, 60));
layout();

/* ---------- screens ---------- */
function show(id: string | null) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
}
let returnTo: 'start' | 'results' = 'start';
document.querySelectorAll<HTMLElement>('[data-open]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  returnTo = mode === 'start' ? 'start' : 'results';
  if (b.dataset.open === 'scores') renderScores();
  show(b.dataset.open ?? null);
  mode = 'menu';
}));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); Sound.ui(); show(returnTo); mode = returnTo; }));

function buildSettings() {
  const items: [keyof Settings, string][] = [['sound', 'Sound'], ['music', 'Music'], ['reduceMotion', 'Reduce motion']];
  if ('vibrate' in navigator) items.splice(2, 0, ['vibration', 'Vibration']);
  document.querySelectorAll('.settings-inline').forEach(box => {
    box.innerHTML = '';
    for (const [k, label] of items) {
      const row = document.createElement('div');
      row.className = 'toggle'; row.setAttribute('role', 'switch'); row.tabIndex = 0;
      row.setAttribute('aria-checked', String(!!settings[k]));
      row.innerHTML = `<span>${label}</span><span class="switch"></span>`;
      row.addEventListener('click', e => { e.stopPropagation(); settings[k] = !settings[k]; store.set('settings', settings); applySettings(); buildSettings(); Sound.ui(); });
      box.appendChild(row);
    }
  });
}
function applySettings() {
  Sound.soundOn = settings.sound; Sound.musicOn = settings.music; Sound.apply();
  game.settings.reduceMotion = settings.reduceMotion; game.settings.vibration = settings.vibration;
}
buildSettings();

/** Picks the game mode and difficulty for the next game; the title screen's backdrop shows that mode's map. */
function setChoice(m: GameMode, d: Difficulty) {
  const remap = m !== gameMode;
  gameMode = m; game.mode = m;
  difficulty = d; game.difficulty = d;
  store.set('mode', m); store.set('difficulty', d);
  scores = store.get<ScoreEntry[]>(scoreKey(m, d), []);
  if (remap && mode === 'start') { game.reset(); game.phase = 'idle'; }
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
  document.querySelectorAll<HTMLElement>('[data-diff]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.diff === d)));
  const hard = 'About twice the planes, firing more often and hitting harder. Points are worth 1.5x.';
  $('diffNote').textContent = m === 'war'
    ? `Hold out for ${WAR_TIME / 60} minutes. Swipe left or right to move between three turrets, and don't shoot down ${WAR_STRIKES} friendly planes.` + (d === 'hard' ? ' Hard: more enemy planes, hitting harder.' : '')
    : m === 'adventure' ? 'Just you and one turret, starting at 20% health. Every plane you shoot down earns 1 iron; spend it in the iron shop on upgrades that you keep between games.' + (d === 'hard' ? ' Hard: more planes, hitting harder.' : '')
    : m === 'coop' ? 'Two players: one defends the base, the other flies the enemy planes as the Bomber. Phones join with a QR code.' + (d === 'hard' ? ' Hard: more planes, hitting harder.' : '')
    : d === 'hard' ? hard : 'The standard game.';
  $('startShop').hidden = m !== 'adventure';
  const b = best();
  $('bestLine').textContent = b ? `Best ${b.toLocaleString('en-US')}` : '';
}
document.querySelectorAll<HTMLElement>('[data-mode]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  const m = b.dataset.mode;
  setChoice(isMode(m) ? m : 'original', difficulty);
}));
document.querySelectorAll<HTMLElement>('[data-diff]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  setChoice(gameMode, b.dataset.diff === 'hard' ? 'hard' : 'normal');
}));
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function renderScores() {
  $('scoresTitle').textContent = `${gameMode === 'war' ? 'War' : gameMode === 'coop' ? 'Co-op' : gameMode === 'adventure' ? 'Adventure' : 'Original'}${difficulty === 'hard' ? ', hard' : ''}: high scores`;
  const ol = $('scoreList');
  const detail = (s: ScoreEntry) => gameMode === 'war' ? (s.won ? 'passed' : clock(s.time ?? 0)) : `wave ${s.wave}`;
  ol.innerHTML = scores.length ? scores.map((s: ScoreEntry) => `<li><span>${s.score.toLocaleString('en-US')}</span><span>${detail(s)}</span></li>`).join('') : '<li class="empty">No scores yet</li>';
}
function best() { return scores.length ? scores[0].score : 0; }
function startScreen() {
  mode = 'start';
  game.reset();
  game.phase = 'idle';
  setChoice(gameMode, difficulty);
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('installTip').textContent = standalone ? (ios ? 'Tip: turn on Portrait Orientation Lock in Control Center so the screen never turns while you aim.' : '')
    : ios ? 'Tip: tap Share, then Add to Home Screen to play full screen. Turn on Portrait Orientation Lock too.'
      : 'Tip: install the app from your browser menu to play full screen.';
  show('start');
  setHud(false);
}

/* ---------- starting and sensors ---------- */
$('start').addEventListener('click', begin);
$('retrySensor').addEventListener('click', e => { e.stopPropagation(); begin(); });
async function begin() {
  if (mode !== 'start' && mode !== 'nosensor') return;
  Sound.init();
  if (gameMode === 'coop') { openLobby(); return; }
  const r = await Tilt.start();
  if (r !== 'ok') {
    $('nosensorMsg').textContent = r === 'denied'
      ? 'Sky Defender 2 is aimed by turning your phone. Motion access was turned down; allow it and try again (on iPhone you may need to reload the page first).'
      : 'Sky Defender 2 is aimed by turning your phone, so it needs a phone or tablet with motion sensors.';
    show('nosensor'); mode = 'nosensor';
    return;
  }
  if (Tilt.keyboard) keyboardText(); else tryLockPortrait();
  Tilt.calibrate();
  startGame();
}
function startGame() {
  ironAtStart = game.adv.iron;
  game.start(); show(null); setHud(true); mode = 'play';
}
/** On a computer the on-screen help talks about keys, not tilting and tapping. */
function keyboardText() {
  document.querySelector('#hint .hint-tilt span:last-child')!.textContent = 'Left and right arrow keys to aim';
  document.querySelector('#hint .hint-fire span:last-child')!.textContent = 'Space bar to fire';
  document.querySelector<SVGElement>('#hint .phone')!.style.display = 'none';
}
if (isComputer()) {
  document.querySelector('#start .lead')!.textContent = 'Click to start. Arrow keys aim, space bar fires.';
  document.querySelector('#recal .lead')!.textContent = 'Click to continue';
}
async function tryLockPortrait() {
  // Android: a fullscreen page or installed app can lock portrait. iOS relies on the layout counter-rotation.
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen && !matchMedia('(display-mode: fullscreen)').matches && !matchMedia('(display-mode: standalone)').matches && /Android/.test(navigator.userAgent)) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch { }
  try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('portrait-primary'); } catch { }
}

/* ---------- firing, and swiping between turrets in war mode ---------- */
const pointers = new Set<number>();
const fz = $('firezone');
/** In war mode a touch waits this long (ms) before it fires, so the start of a swipe doesn't loose a shot at a friendly plane. */
const SWIPE_HOLD = 90, SWIPE_DIST = 40, SWIPE_TIME = 500;
let swipe: { id: number; x: number; y: number; t: number; timer: number; fired: boolean; sliding: boolean } | null = null;
fz.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (mode !== 'play') return;
  // co-op: the Bomber on this screen clicks a falling pack to grab it; only the Base fires from here
  if (game.coop && localRole !== 'base') {
    if (localRole === 'bomber') { const c = tappedFalling(e); if (c) game.bomberAct('grab', c); }
    // the Sniper on this screen points the laser wherever they click
    if (localRole === 'sniper') { const c = tappedFalling(e); if (c && game.sniperAct('grab', c)) return; const [x, y] = renderer.screenToWorld(game, e.offsetX, e.offsetY); game.snipe(x, y); }
    return;
  }
  const tapped = tappedCrate(e);
  if (tapped) { openCrate(tapped); return; }
  pointers.add(e.pointerId);
  if (game.phase === 'clear') game.skipClear();
  if (game.war) {
    if (swipe) clearTimeout(swipe.timer);
    const s = { id: e.pointerId, x: e.offsetX, y: e.offsetY, t: e.timeStamp, fired: false, sliding: false, timer: 0 };
    s.timer = window.setTimeout(() => { if (swipe === s && !s.sliding && pointers.has(s.id)) { s.fired = true; game.press(); hintProgress('fire'); } }, SWIPE_HOLD);
    swipe = s;
    return;
  }
  game.press();
  hintProgress('fire');
});
fz.addEventListener('pointermove', e => {
  const s = swipe;
  if (!s || e.pointerId !== s.id || mode !== 'play') return;
  const dx = e.offsetX - s.x, dy = e.offsetY - s.y;
  if (!s.fired && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { s.sliding = true; clearTimeout(s.timer); }
  if (Math.abs(dx) > SWIPE_DIST && Math.abs(dx) > Math.abs(dy) * 1.5 && e.timeStamp - s.t < SWIPE_TIME) {
    clearTimeout(s.timer); swipe = null;
    game.release();
    // drag the view: swiping right pulls the scene along, bringing up the turret on the left
    game.move(-Math.sign(dx));
  }
});
const up = (e: PointerEvent) => {
  const s = swipe;
  if (s && s.id === e.pointerId) {
    // a quick tap, over before its shot was due: fire it now
    clearTimeout(s.timer); swipe = null;
    if (!s.fired && !s.sliding && mode === 'play') { game.tap(); hintProgress('fire'); }
  }
  pointers.delete(e.pointerId); if (!pointers.size) game.release();
};
fz.addEventListener('pointerup', up); fz.addEventListener('pointercancel', up); fz.addEventListener('pointerleave', up);
// iOS shows a magnifier or zooms on a double tap even with user-scalable=no and
// user-select: none. Swallowing the touch itself stops that; pointer events still fire.
const noTouchDefault = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
fz.addEventListener('touchstart', noTouchDefault, { passive: false });
// Elsewhere (screens, toasts), drop the second tap of a quick pair unless it lands on a control.
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = e.timeStamp;
  if (now - lastTouchEnd < 350 && !(e.target as Element).closest('button, input, select, label, a')) noTouchDefault(e);
  lastTouchEnd = now;
}, { passive: false });
for (const ev of ['gesturestart', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
// keyboard for desktop testing
addEventListener('keydown', e => {
  if (game.coop && localRole === 'bomber') { bomberKey(e, true); return; }
  // co-op: the Sniper on this screen sends the arm with G and uses an upgrade with U
  if (game.coop && localRole === 'sniper' && mode === 'play' && !e.repeat) { const k = e.key.toLowerCase(); if (k === 'g') game.sniperAct('grab'); else if (k === 'u') game.sniperAct('use'); else if (k === 'm') game.sniperAct('missile'); else if (k === 'n') game.sniperAct('nuke'); }
  if (game.coop && localRole !== 'base') { if ((e.key === 'p' || e.key === 'Escape') && mode === 'play') pause(); return; }
  // co-op: Q is the Base's Protection
  if (game.coop && (e.key === 'q' || e.key === 'Q') && mode === 'play' && !e.repeat) game.baseProtect();
  if (e.code === 'Space' && mode === 'play') { if (!e.repeat) { game.press(); hintProgress('fire'); } e.preventDefault(); }
  // Enter opens a crate waiting on the pad
  if (e.key === 'Enter' && mode === 'play' && !e.repeat && game.readyCrate()) openCrate();
  if (e.key === 'p' || e.key === 'Escape') { if (mode === 'play') pause(); }
  // war mode: z and x move to the turret on the left and right
  if ((e.key === 'z' || e.key === 'x') && mode === 'play' && !e.repeat) game.move(e.key === 'z' ? -1 : 1);
});
addEventListener('keyup', e => {
  if (game.coop && localRole === 'bomber') { bomberKey(e, false); return; }
  if (e.code === 'Space' && (!game.coop || localRole === 'base')) game.release();
});
/** Co-op, with this screen playing the Bomber: arrow keys climb and dive, S changes planes, and a letter for each button. */
const BOMBER_KEYS: Record<string, BomberAct> = { s: 'switch', m: 'missile', '1': 'missile', n: 'nuke', '2': 'nuke', d: 'dive', '3': 'dive', g: 'grab', '4': 'grab', u: 'use', '5': 'use', r: 'protect', '6': 'protect' };
function bomberKey(e: KeyboardEvent, down: boolean) {
  if (e.key === 'p' || e.key === 'Escape') { if (down && mode === 'play') pause(); return; }
  if (mode !== 'play') return;
  const dir = e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' ? 'up' : e.key === 'ArrowDown' ? 'down' : null;
  if (dir) { e.preventDefault(); if (!e.repeat) game.bomberHold(dir, down); return; }
  const a = BOMBER_KEYS[e.key.toLowerCase()];
  if (a && down && !e.repeat) { e.preventDefault(); game.bomberAct(a); }
}

/* ---------- HUD buttons ---------- */
function setHud(on: boolean) { $('pauseBtn').hidden = !on; $('protectBtn').hidden = !on || !game.coop || localRole !== 'base'; $('ironBtn').hidden = !on || !game.adventure; ironHud(); }
$('ironBtn').addEventListener('click', e => { e.stopPropagation(); if (mode === 'play') openShop('play'); });

/* ---------- adventure: iron and the iron shop ---------- */
let ironAtStart = 0;
let shopFrom: 'play' | 'start' | 'results' = 'start';
const BUILDING_NAMES: Record<string, string> = { search: 'Searchlight', radar: 'Radar', repair: 'Repair yard', depot: 'Weapons depot', hangar: 'Resupply hangar' };
function ironHud() { $('ironCount').textContent = String(game.adv.iron); }
function openShop(from: typeof shopFrom) {
  shopFrom = from;
  if (from === 'play') { game.release(); pointers.clear(); Sound.stopAllEngines(); }
  Sound.ui();
  mode = 'shop';
  renderShop();
  show('shop');
}
function renderShop() {
  $('shopIron').textContent = String(game.adv.iron);
  const list = $('shopList');
  list.innerHTML = '';
  for (const id of Object.keys(SHOP) as ShopId[]) {
    const it = SHOP[id];
    if (id === 'repair' && shopFrom !== 'play') continue;
    const block = game.shopBlock(id);
    const lv = id === 'repair' ? '' : `<span class="kind">Level ${game.adv[id]} of ${it.max}</span>`;
    const b = document.createElement('button');
    b.className = 'card shopitem';
    b.disabled = !!block;
    b.innerHTML = `${lv}<b>${it.name}</b><span class="desc">${it.desc}</span><span class="price">${block === 'Maxed' || block === 'Full health' || block === 'During a game' ? block : `${game.shopCost(id)} iron`}</span>`;
    b.addEventListener('click', e => { e.stopPropagation(); if (game.buy(id)) { Sound.pop(); saveAdventure(); ironHud(); renderShop(); } });
    list.appendChild(b);
  }
  const head = document.createElement('h3');
  head.className = 'shophead'; head.textContent = 'Base parts';
  list.appendChild(head);
  for (const p of PARTS) {
    const block = game.partBlock(p.id);
    const b = document.createElement('button');
    b.className = 'card shopitem';
    b.disabled = !!block;
    b.innerHTML = `<span class="kind">Base part</span><b>${BUILDING_NAMES[p.id]}</b><span class="desc">${p.desc}</span><span class="price">${block === 'Built' ? 'Built' : `${p.cost} iron`}</span>`;
    b.addEventListener('click', e => { e.stopPropagation(); if (game.buyPart(p.id)) { Sound.pop(); saveAdventure(); ironHud(); renderShop(); } });
    list.appendChild(b);
  }
  $('shopNote').textContent = shopFrom === 'play'
    ? `Turret health ${game.turretPct()}% (max ${Math.round(game.advHpShare * 100)}%). The game is paused.`
    : `Your turret starts games at ${Math.round(game.advHpShare * 100)}% health.`;
}
function closeShop() {
  Sound.ui();
  if (shopFrom === 'play') { show(null); mode = 'play'; last = performance.now(); return; }
  show(shopFrom); mode = shopFrom;
}
$('shopDone').addEventListener('click', e => { e.stopPropagation(); closeShop(); });
$('shopReset').addEventListener('click', e => {
  e.stopPropagation();
  if (!confirm('Start adventure over? This sets iron and every upgrade back to 0.')) return;
  game.adv = newAdventure(); saveAdventure(); ironHud(); renderShop();
});
$('startShop').addEventListener('click', e => { e.stopPropagation(); if (mode === 'start') openShop('start'); });
$('resultsShop').addEventListener('click', e => { e.stopPropagation(); if (mode === 'results') openShop('results'); });
$('protectBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (mode === 'play') game.baseProtect(); });
$('pauseBtn').addEventListener('click', e => { e.stopPropagation(); if (mode === 'play') pause(); });

/* ---------- upgrade crate ---------- */
// A landed crate waits on the landing zone beside the turret; a tap near it opens it.
/** The landed crate a tap is on, if any. */
function tappedCrate(e: PointerEvent) {
  for (const c of game.readyCrates()) {
    const [x, y] = renderer.worldToScreen(game, c.x, c.y - 3);
    if (Math.hypot(e.offsetX - x, e.offsetY - y) < 26 + 10 * renderer.s) return c;
  }
  return null;
}
/** Co-op: a pack (falling or on the pad) a tap is on, for the Bomber's arm. */
function tappedFalling(e: PointerEvent) {
  for (const c of game.crates) {
    if (c.dead || c.held) continue;
    const [x, y] = renderer.worldToScreen(game, c.x, c.y - 3);
    if (Math.hypot(e.offsetX - x, e.offsetY - y) < 30 + 10 * renderer.s) return c;
  }
  return null;
}
/** The crate whose cards are showing. */
let opening: Crate | null = null;
/** Opens a crate waiting on the pad. A gold pack lets you pick any permanent upgrade you don't have yet; a diamond pack, Ghost shot or Drop shot. */
function openCrate(c = game.readyCrate()) {
  if (!c || game.coop && localRole !== 'base') return;
  opening = c;
  const pack: PackKind = c.diamond ? 'diamond' : c.gold ? 'gold' : 'plain';
  mode = 'cards';
  game.release(); pointers.clear();
  Sound.ui();
  $('cardsTitle').textContent = pack === 'diamond' ? 'Diamond pack' : pack === 'gold' ? 'Gold pack' : 'Choose an upgrade';
  $('cards').classList.toggle('gold', pack === 'gold');
  $('cards').classList.toggle('diamond', pack === 'diamond');
  // every pack upgrade is permanent, so the line under the title says so instead of each card
  $('cards').querySelector('.lead')!.textContent = pack === 'plain' ? 'It takes effect right away.' : 'Choose a permanent upgrade. It takes effect right away.';
  const list = $('cardList');
  list.innerHTML = '';
  for (const id of game.offers(pack)) {
    const u = UPGRADES[id];
    const b = document.createElement('button');
    b.className = 'card';
    b.style.setProperty('--weapon', u.color);
    b.innerHTML = `<span class="kind">${u.kind}</span><b>${u.name}</b><span class="desc">${u.desc}</span>`;
    b.addEventListener('click', e => { e.stopPropagation(); pickUpgrade(id); });
    list.appendChild(b);
  }
  show('cards');
}
function pickUpgrade(id: UpgradeId) {
  Sound.ui();
  game.chooseUpgrade(id, opening);
  opening = null;
  show(null); mode = 'play'; last = performance.now();
}
$('cardsBack').addEventListener('click', e => { e.stopPropagation(); show(null); mode = 'play'; last = performance.now(); });

/* ---------- pause, recalibrate, countdown ---------- */
function pause(reason?: 'flat' | 'sensor' | string) {
  if (mode !== 'play') return;
  mode = 'paused';
  game.release(); pointers.clear();
  coop?.broadcast({ t: 'paused', on: true });
  Sound.stopAllEngines();
  $('pauseTitle').textContent = reason === 'flat' ? 'Paused' : 'Paused';
  $('pauseReason').textContent = reason === 'flat' ? 'Your phone is lying flat. Hold it upright to keep aiming.' : reason === 'sensor' ? 'Motion sensors stopped reporting.' : reason ?? '';
  show('pause');
}
$('resumeBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); countdown(); });
$('recalBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); mode = 'recal'; show('recal'); });
$('recal').addEventListener('click', () => { if (mode !== 'recal') return; Tilt.calibrate(); Sound.pop(); countdown(); });
$('quitBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); Sound.stopAllEngines(); if (coop) backToLobby(); else startScreen(); });
function countdown() {
  mode = 'countdown';
  Sound.resume();
  show('countdown');
  let n = 3;
  $('countNum').textContent = String(n);
  Sound.lockStep(0);
  const tick = () => {
    n--;
    if (mode !== 'countdown') return;
    if (n <= 0) { show(null); mode = 'play'; last = performance.now(); coop?.broadcast({ t: 'paused', on: false }); return; }
    $('countNum').textContent = String(n); Sound.lockStep(.3 * (3 - n));
    setTimeout(tick, 800);
  };
  setTimeout(tick, 800);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); Sound.suspend(); }
  else Sound.resume();
});

/* ---------- results ---------- */
function showResults(r: Results) {
  if (mode === 'start') return;
  const prevBest = best();
  const war = r.mode === 'war';
  scores.push({ score: r.score, wave: r.wave, date: Date.now(), ...(war ? { time: Math.round(r.time), won: r.won } : {}) });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 5);
  store.set(scoreKey(r.mode, r.difficulty), scores);
  const sniper = coop?.byRole('sniper');
  const attackers = r.mode === 'coop' ? [r.bomber?.name, sniper?.name].filter(Boolean) : [];
  $('rTitle').textContent = attackers.length ? (attackers.length > 1 ? `${attackers.join(' and ')} win` : `${attackers[0]} wins`) : !war ? 'Base lost' : r.won ? 'Level 1 complete' : 'Mission failed';
  $('rReason').textContent = war && !r.won ? r.reason : '';
  $('rReason').hidden = !(war && !r.won && r.reason);
  const tags = [war ? 'War, level 1' : r.mode === 'coop' ? 'Co-op' : r.mode === 'adventure' ? 'Adventure' : '', r.difficulty === 'hard' ? 'Hard' : ''].filter(Boolean);
  $('rMode').textContent = tags.join(' · ');
  $('rMode').hidden = !tags.length;
  $('rScore').textContent = r.score.toLocaleString('en-US');
  const stats: [string, string][] = [
    war ? ['Time survived', clock(r.time)] : ['Wave reached', String(r.wave)],
    ['Accuracy', Math.round(r.accuracy * 100) + '%'],
    ['Planes downed', String(r.kills)],
    war ? ['Friendly planes hit', `${r.friendlies} of ${WAR_STRIKES}`] : ['Bombs intercepted', String(r.intercepts)],
    ['Best score', best().toLocaleString('en-US')],
  ];
  if (r.mode === 'adventure') stats.splice(4, 0, ['Iron earned', String(game.adv.iron - ironAtStart)], ['Iron', String(game.adv.iron)]);
  if (r.bomber) stats.splice(4, 0, ['Bomber damage', String(r.bomber.damage)], ['Bomber planes lost', String(r.bomber.deaths)], ['Upgrades stolen', String(r.bomber.steals)]);
  if (sniper) stats.splice(r.bomber ? 7 : 4, 0, ['Sniper damage', String(Math.round(game.sniperDamage))]);
  $('rStats').innerHTML = stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('newBest').hidden = !(r.score > prevBest && r.score > 0);
  Sound.stopAllEngines();
  setHud(false);
  show('results'); mode = 'results';
  $('titleBtn').textContent = coop ? 'Back to lobby' : 'Title screen';
  $('resultsShop').hidden = r.mode !== 'adventure';
  padHost.el.hidden = true;
  coop?.broadcast({ t: 'over', title: $('rTitle').textContent ?? '', score: r.score, wave: r.wave });
}
$('againBtn').addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  if (coop) { if (coop.canStart()) void startCoop(); else backToLobby(); return; }
  Tilt.calibrate(); startGame();
});
$('titleBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); if (coop) backToLobby(); else startScreen(); });

/* ---------- co-op: the lobby, and the players' phones ---------- */
let coop: CoopHost | null = null;
/** What this device plays in co-op (null: it only shows the game). */
let localRole: Role | null = null;
/** The Base's aim from its phone, when the Base plays on a phone. */
let remoteRoll = 0;
/** The second Base's aim from its phone. */
let remoteRoll2 = 0;
/** A crate the Base's phone is choosing from, and its choices. */
let pendingCards: { crate: Crate; ids: UpgradeId[] } | null = null;
let snapT = 0, mapT = 0, drawnQr = '';
const padHost = new BomberPad({ hold: (d, on) => game.bomberHold(d, on), act: a => game.bomberAct(a) }, { keys: isComputer(), compact: true });
padHost.el.hidden = true;
// under the menus and the pause screen
stage.insertBefore(padHost.el, $('pauseBtn'));

function joinUrl(code: string) {
  const u = new URL(location.href);
  u.search = `?join=${code}`; u.hash = '';
  return u.toString();
}
function drawQr(c: HTMLCanvasElement, text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text); qr.make();
  const n = qr.getModuleCount(), quiet = 2;
  const cell = Math.floor(c.width / (n + quiet * 2)), off = Math.floor((c.width - cell * n) / 2);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect(off + x * cell, off + y * cell, cell, cell);
}
function openLobby() {
  if (!coop) {
    drawnQr = '';
    coop = new CoopHost({ change: renderLobby, input: coopInput, lost: p => { if (mode === 'play') pause(`${p.name} lost the connection. Resume once they have rejoined with the QR code.`); } });
    void coop.open();
  }
  mode = 'lobby';
  setHud(false);
  renderLobby();
  show('lobby');
}
function backToLobby() {
  Sound.stopAllEngines();
  game.fxLog = null;
  game.reset(); game.phase = 'idle';
  localRole = null; padHost.el.hidden = true;
  coop?.stop();
  openLobby();
}
function closeLobby() { coop?.close(); coop = null; startScreen(); }
function renderLobby() {
  if (!coop || mode !== 'lobby') return;
  const code = coop.room?.code ?? '';
  $('lobbyCode').textContent = coop.error ? `Could not open a room (${coop.error}). Check the connection and try again.` : code ? `Room ${code}` : 'Opening a room…';
  $<HTMLCanvasElement>('qr').style.visibility = code ? 'visible' : 'hidden';
  if (code && drawnQr !== code) { drawnQr = code; drawQr($<HTMLCanvasElement>('qr'), joinUrl(code)); }
  const list = $('lobbyPlayers');
  list.innerHTML = '';
  for (const p of coop.players) {
    const li = document.createElement('li');
    const where = p.id === LOCAL ? 'this screen' : p.link ? 'phone' : 'reconnecting…';
    li.innerHTML = `<span><b>${p.name}</b><small>${where}</small></span><div class="seg small" role="radiogroup" aria-label="Role"><button role="radio" data-role="base" aria-checked="${p.role === 'base'}">Base</button><button role="radio" data-role="bomber" aria-checked="${p.role === 'bomber'}">Bomber</button><button role="radio" data-role="sniper" aria-checked="${p.role === 'sniper'}">Sniper</button></div>`;
    li.querySelectorAll<HTMLElement>('[data-role]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); Sound.ui(); coop?.setRole(p.id, b.dataset.role as Role); }));
    list.appendChild(li);
  }
  if (!coop.players.length) list.innerHTML = '<li class="empty">No players yet</li>';
  $('joinHere').textContent = coop.local ? 'Leave' : 'Join';
  $<HTMLButtonElement>('joinHere').disabled = !coop.local && coop.players.length >= MAX_PLAYERS;
  $('diceHere').hidden = !coop.local;
  $<HTMLButtonElement>('coopStart').disabled = !coop.canStart();
  $('lobbyNote').textContent = coop.players.length < 2 ? 'Two or three players: a Base against a Bomber, a Sniper, or both, or two Bases with an extra turret. Tap Join to play on this screen.' : 'Pick a role for each player, then start.';
}
$('joinHere').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); if (!coop) return; if (coop.local) coop.leaveLocal(); else coop.joinLocal(randomName(store.get('coopName', ''))); });
$('diceHere').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); const n = coop?.renameLocal(); if (n) store.set('coopName', n); });
$('coopStart').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); void startCoop(); });
$('lobbyBack').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); closeLobby(); });

async function startCoop() {
  if (!coop || !coop.canStart()) return;
  const bomber = coop.byRole('bomber'), sniper = coop.byRole('sniper'), second = coop.secondBase();
  localRole = coop.local?.role ?? null;
  Sound.init();
  if (localRole === 'base') {
    const r = await Tilt.start();
    if (r !== 'ok') { $('lobbyNote').textContent = 'This screen needs motion access to aim. Allow it, or give the Base to a phone.'; return; }
    if (Tilt.keyboard) keyboardText(); else tryLockPortrait();
    Tilt.calibrate();
  }
  game.bomberName = bomber?.name ?? null;
  game.sniperName = sniper?.name ?? null;
  game.secondBaseName = second?.name ?? null;
  game.localGun = second && second === coop.local ? 2 : 1;
  game.start();
  game.fxLog = [];
  remoteRoll = remoteRoll2 = 0; pendingCards = null;
  coop.start();
  show(null); setHud(true); mode = 'play';
  padHost.el.hidden = localRole !== 'bomber';
}
/** A button on a player's phone. */
function coopInput(p: Player, m: ClientMsg) {
  if (p.role === 'base') {
    const gun = p === coop?.secondBase() ? 2 : 1;
    if (m.t === 'protect') { if (mode === 'play') game.baseProtect(); }
    else if (m.t === 'tilt' && Number.isFinite(m.r)) { const r = Math.max(-2, Math.min(2, m.r)); if (gun === 2) remoteRoll2 = r; else remoteRoll = r; }
    else if (m.t === 'fire') {
      if (mode !== 'play') return;
      if (m.on) { game.press(gun); if (game.phase === 'clear') game.skipClear(); } else game.release(gun);
    } else if (gun === 2) return; // crates are opened from the main turret
    else if (m.t === 'open') {
      const c = game.readyCrate();
      if (!c || mode !== 'play') return;
      const pack: PackKind = c.diamond ? 'diamond' : c.gold ? 'gold' : 'plain';
      const ids = game.offers(pack);
      pendingCards = { crate: c, ids };
      coop?.send(p, { t: 'cards', title: pack === 'diamond' ? 'Diamond pack' : pack === 'gold' ? 'Gold pack' : 'Choose an upgrade', cards: ids.map(id => ({ id, ...UPGRADES[id] })) });
    } else if (m.t === 'pick') {
      const pc = pendingCards;
      pendingCards = null;
      if (pc && m.id && pc.ids.includes(m.id) && !pc.crate.dead && !game.ended) game.chooseUpgrade(m.id, pc.crate);
    }
  } else if (p.role === 'sniper' && mode === 'play') {
    if (m.t === 'snipe') game.snipe(Number(m.x), Number(m.y));
    else if (m.t === 'act' && (m.a === 'grab' || m.a === 'use' || m.a === 'missile' || m.a === 'nuke')) game.sniperAct(m.a);
  } else if (p.role === 'bomber' && mode === 'play') {
    if (m.t === 'hold' && (m.dir === 'up' || m.dir === 'down')) game.bomberHold(m.dir, !!m.on);
    else if (m.t === 'act') game.bomberAct(m.a);
  }
}
/** About ten times a second, each phone hears how its side is doing. */
function coopSnapshots(dt: number) {
  if (!coop) return;
  // the map, for both phones, about 20 times a second
  mapT -= dt;
  if (mapT <= 0) {
    mapT = .05;
    const phones = coop.players.filter(p => p.link);
    if (phones.length) { const s = takeSnap(game); for (const p of phones) coop.send(p, { t: 'snap', s }); }
    else game.fxLog = [];
  }
  snapT -= dt;
  if (snapT > 0) return;
  snapT = .1;
  const v = game.bomberView();
  if (v) padHost.update(v);
  if (localRole === 'base') {
    const pb = $('protectBtn');
    pb.innerHTML = game.protectT > 0 ? `Protected<br><small>${Math.ceil(game.protectT)}</small>` : game.protectCD > 0 ? `Protect<br><small>${Math.ceil(game.protectCD)}</small>` : 'Protect<br><small>Q</small>';
    pb.classList.toggle('off', game.protectCD > 0 && game.protectT <= 0);
  }
  const bomber = coop.byRole('bomber'), base = coop.byRole('base');
  if (v && bomber?.link) coop.send(bomber, { t: 'bomber', v });
  const base2 = coop.secondBase();
  if (base2?.link) coop.send(base2, { t: 'base', crate: false, weapon: null, score: game.score, wave: game.wave, protect: Math.min(1, game.protectCD / PROTECT.cd), protectT: game.protectT });
  if (base?.link) coop.send(base, { t: 'base', crate: !!game.readyCrate(), weapon: game.weapon ? `${UPGRADES[game.weapon].name} (${Math.ceil(game.ammo)})` : null, score: game.score, wave: game.wave, protect: Math.min(1, game.protectCD / PROTECT.cd), protectT: game.protectT });
  const sn = coop.byRole('sniper');
  const sp = game.sniper;
  if (sn?.link && sp) coop.send(sn, { t: 'sniper', ready: !game.snipes.length, damage: Math.round(game.sniperDamage), canGrab: !sp.arm && sp.grabCD <= 0 && !!game.sniperGrabbable(), arming: !!sp.arm, grabCD: Math.ceil(sp.grabCD),
    perk: sp.perk ? SNIPER_PERKS[sp.perk].name : null, perkDesc: sp.perk ? SNIPER_PERKS[sp.perk].desc : '', status: game.sniperStatus(), missile: Math.ceil(sp.missileCD), nuke: Math.ceil(sp.nukeCD) });
}

/* ---------- tips and first-run hint ---------- */
/** Tips that read differently when playing on a computer. */
const KEYBOARD_TIPS: Record<string, string> = { crate: 'Click the crate on the pad, or press Enter, to open it.' };
function showTip(key: string, text: string) {
  if (Tilt.keyboard && KEYBOARD_TIPS[key]) { key += '.keys'; text = KEYBOARD_TIPS[key.slice(0, -5)]; }
  if (seenTips.has(key)) return;
  seenTips.add(key); store.set('tips', [...seenTips]);
  toastQueue.push(text);
  if (!toastTimer) nextToast();
}
function nextToast() {
  const t = $('toast');
  const text = toastQueue.shift();
  if (!text) { t.classList.remove('show'); toastTimer = 0; return; }
  t.textContent = text; t.classList.add('show');
  toastTimer = setTimeout(() => { t.classList.remove('show'); toastTimer = setTimeout(nextToast, 400); }, 3200);
}
function startHint() { hintState = { fire: 0, tilt: 0 }; $('hint').hidden = false; }
function hintProgress(kind: 'fire' | 'tilt') {
  if (!hintState) return;
  hintState[kind]++;
  if (hintState.fire >= 2 && hintState.tilt) endHint();
}
function endHint() { hintState = null; $('hint').hidden = true; store.set('hinted', true); }

/* ---------- loop ---------- */
let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  last = now;
  if (mode === 'loading') return;
  const tiltRoll = Tilt.update(now / 1000, dt);
  // co-op: the Base aims from its phone unless it plays on this screen
  const localAim = !game.coop || localRole === 'base';
  // with two Bases, this screen's player may be on the second turret
  const localSecond = localAim && game.localGun === 2;
  const roll = localAim && !localSecond ? tiltRoll : remoteRoll;
  if (game.gun2) game.gun2.roll = localSecond ? tiltRoll : remoteRoll2;
  if (mode === 'play') {
    if (localAim && !Tilt.keyboard && Tilt.flatness > .9) { flatT += dt; if (flatT > .4) pause('flat'); } else flatT = 0;
    if (localAim && Tilt.stale()) pause('sensor');
    if (hintState && Math.abs(roll) > .26) hintProgress('tilt');
    game.update(dt, roll);
    if (game.phase === 'over') setHud(false);
    if (game.coop) coopSnapshots(dt);
  } else if (mode === 'start' || mode === 'menu' && returnTo === 'start') {
    // the title screen gently follows the phone once sensors are on
    game.cam = game.aim = Math.max(-1, Math.min(1, roll * 1.4)) * (Tilt.available ? 1 : 0);
  }
  renderer.frame(game, mode === 'play' ? dt : 0);
}

(async function boot() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  await loadArt(p => { $('loadbar').style.width = Math.round(p * 100) + '%'; });
  try { await document.fonts.load('500 16px Jost'); } catch { }
  startScreen();
  requestAnimationFrame(frame);
})();
