// App shell: layout (portrait lock), screens, the game loop and saved settings.
import './style.css';
import { loadArt } from './art';
import { Renderer } from './render';
import { Game, UPGRADES, WAR_STRIKES, WAR_TIME, type Difficulty, type GameMode, type Results, type UpgradeId } from './game';
import { Tilt } from './input';
import { Sound } from './audio';

type Mode = 'loading' | 'start' | 'play' | 'paused' | 'cards' | 'countdown' | 'results' | 'recal' | 'nosensor' | 'menu';
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
const scoreKey = (m: GameMode, d: Difficulty) => (m === 'war' ? 'scores.war' : 'scores') + (d === 'hard' ? (m === 'war' ? '.hard' : '.expert') : '');
const savedDiff = store.get<string>('difficulty', 'normal');
let difficulty: Difficulty = savedDiff === 'hard' || savedDiff === 'expert' ? 'hard' : 'normal';
let gameMode: GameMode = store.get<string>('mode', 'original') === 'war' ? 'war' : 'original';
let scores = store.get<ScoreEntry[]>(scoreKey(gameMode, difficulty), []);

let mode: Mode = 'loading';   // loading | start | play | paused | cards | countdown | results | recal | nosensor
let toastTimer = 0;
const toastQueue: string[] = [];
let flatT = 0;
let hintState: { fire: number; tilt: number } | null = null;

const renderer = new Renderer(canvas);
const game = new Game({
  tip: showTip,
  hud: () => { },
  waveStart: n => { if (n === 1 && !store.get('hinted', false)) startHint(); },
  waveClear: () => { if (hintState) endHint(); },
  gameOver: showResults,
  label: () => { },
});
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
    : d === 'hard' ? hard : 'The standard game.';
  const b = best();
  $('bestLine').textContent = b ? `Best ${b.toLocaleString('en-US')}` : '';
}
document.querySelectorAll<HTMLElement>('[data-mode]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  setChoice(b.dataset.mode === 'war' ? 'war' : 'original', difficulty);
}));
document.querySelectorAll<HTMLElement>('[data-diff]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  setChoice(gameMode, b.dataset.diff === 'hard' ? 'hard' : 'normal');
}));
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function renderScores() {
  $('scoresTitle').textContent = `${gameMode === 'war' ? 'War' : 'Original'}${difficulty === 'hard' ? ', hard' : ''}: high scores`;
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
  const r = await Tilt.start();
  if (r !== 'ok') {
    $('nosensorMsg').textContent = r === 'denied'
      ? 'Sky Defender 2 is aimed by turning your phone. Motion access was turned down; allow it and try again (on iPhone you may need to reload the page first).'
      : 'Sky Defender 2 is aimed by turning your phone, so it needs a phone or tablet with motion sensors.';
    show('nosensor'); mode = 'nosensor';
    return;
  }
  tryLockPortrait();
  Tilt.calibrate();
  game.start();
  show(null);
  setHud(true);
  mode = 'play';
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
  if (tapsCrate(e)) { openCards(); return; }
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
  if (e.code === 'Space' && mode === 'play') { if (!e.repeat) game.press(); e.preventDefault(); }
  if (e.key === 'p' || e.key === 'Escape') { if (mode === 'play') pause(); }
  // war mode: z and x move to the turret on the left and right
  if ((e.key === 'z' || e.key === 'x') && mode === 'play' && !e.repeat) game.move(e.key === 'z' ? -1 : 1);
});
addEventListener('keyup', e => { if (e.code === 'Space') game.release(); });

/* ---------- HUD buttons ---------- */
function setHud(on: boolean) { $('pauseBtn').hidden = !on; }
$('pauseBtn').addEventListener('click', e => { e.stopPropagation(); if (mode === 'play') pause(); });

/* ---------- upgrade crate ---------- */
// A landed crate waits on the landing zone beside the turret; a tap near it opens it.
function tapsCrate(e: PointerEvent) {
  const c = game.readyCrate();
  if (!c) return false;
  const [x, y] = renderer.worldToScreen(game, c.x, c.y - 3);
  return Math.hypot(e.offsetX - x, e.offsetY - y) < 26 + 10 * renderer.s;
}
function openCards() {
  mode = 'cards';
  game.release(); pointers.clear();
  Sound.ui();
  const list = $('cardList');
  list.innerHTML = '';
  for (const id of game.offers()) {
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
  game.chooseUpgrade(id);
  show(null); mode = 'play'; last = performance.now();
}
$('cardsBack').addEventListener('click', e => { e.stopPropagation(); show(null); mode = 'play'; last = performance.now(); });

/* ---------- pause, recalibrate, countdown ---------- */
function pause(reason?: 'flat' | 'sensor') {
  if (mode !== 'play') return;
  mode = 'paused';
  game.release(); pointers.clear();
  Sound.stopAllEngines();
  $('pauseTitle').textContent = reason === 'flat' ? 'Paused' : 'Paused';
  $('pauseReason').textContent = reason === 'flat' ? 'Your phone is lying flat. Hold it upright to keep aiming.' : reason === 'sensor' ? 'Motion sensors stopped reporting.' : '';
  show('pause');
}
$('resumeBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); countdown(); });
$('recalBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); mode = 'recal'; show('recal'); });
$('recal').addEventListener('click', () => { if (mode !== 'recal') return; Tilt.calibrate(); Sound.pop(); countdown(); });
$('quitBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); Sound.stopAllEngines(); startScreen(); });
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
    if (n <= 0) { show(null); mode = 'play'; last = performance.now(); return; }
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
  $('rTitle').textContent = !war ? 'Base lost' : r.won ? 'Level 1 complete' : 'Mission failed';
  $('rReason').textContent = war && !r.won ? r.reason : '';
  $('rReason').hidden = !(war && !r.won && r.reason);
  const tags = [war ? 'War, level 1' : '', r.difficulty === 'hard' ? 'Hard' : ''].filter(Boolean);
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
  $('rStats').innerHTML = stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('newBest').hidden = !(r.score > prevBest && r.score > 0);
  Sound.stopAllEngines();
  setHud(false);
  show('results'); mode = 'results';
}
$('againBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); Tilt.calibrate(); game.start(); show(null); setHud(true); mode = 'play'; });
$('titleBtn').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); startScreen(); });

/* ---------- tips and first-run hint ---------- */
function showTip(key: string, text: string) {
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
  const roll = Tilt.update(now / 1000, dt);
  if (mode === 'play') {
    if (!Tilt.debug && Tilt.flatness > .9) { flatT += dt; if (flatT > .4) pause('flat'); } else flatT = 0;
    if (Tilt.stale()) pause('sensor');
    if (hintState && Math.abs(roll) > .26) hintProgress('tilt');
    game.update(dt, roll);
    if (game.phase === 'over') setHud(false);
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
