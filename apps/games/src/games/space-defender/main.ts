// App shell: layout (portrait column), screens, the game loop and saved settings.
import './style.css';
import { Survival, AMMO, HATS, COLORS, drawPreview, type Loadout, type AmmoId, type HatId, type SurvivalResult, type SaveData } from './game';
import { Sound } from './audio';
import { randomName, cleanName } from './names';
import { openRoom, joinRoom, cleanCode, MAX_PLAYERS, type Host } from './net';

type Mode = 'menu' | 'play' | 'paused';
interface Settings { sound: boolean; music: boolean; vibration: boolean; }

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};
const stage = $('stage');
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('spacedef.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('spacedef.' + k, JSON.stringify(v)); } catch { } },
};
const settings: Settings = Object.assign({ sound: true, music: false, vibration: true }, store.get('settings', {}));
const isComputer = () => matchMedia('(pointer: fine)').matches && !matchMedia('(any-pointer: coarse)').matches && navigator.maxTouchPoints === 0;
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let mode: Mode = 'menu';

/* ---------- layout: the whole window, below iOS's status bar strip ---------- */
/** Height of iOS 26's soft edge effect at the top of an installed app, in CSS px (see Sky Defender 2's README). */
const GLASS_BAND = 44;
const CARD_RADIUS = 14;
const iosApp = (navigator as { standalone?: boolean }).standalone === true;
function layout() {
  const W = innerWidth, H = innerHeight;
  let sw = W, sh = H;
  const inset = parseFloat(getComputedStyle($('safe')).paddingTop) || 0;
  const band = inset > 0 ? inset + GLASS_BAND : iosApp ? GLASS_BAND : 0;
  sh -= band;
  stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
  stage.style.left = (W - sw) / 2 + 'px'; stage.style.top = band + 'px';
  $('topbar').style.height = band + 'px';
  stage.style.borderRadius = band ? `${CARD_RADIUS}px ${CARD_RADIUS}px 0 0` : '';
  document.body.style.background = band ? '#000' : '';
  const dm = ['fullscreen', 'standalone', 'browser'].find(m => matchMedia(`(display-mode: ${m})`).matches) ?? '?';
  $('version').textContent = __VERSION__;
  $('buildInfo').textContent = `${__VERSION__} · ${dm} · status bar inset ${Math.round(inset)}px · band ${band}px`;
}
addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 120));
layout();

/* ---------- screens ---------- */
function show(id: string | null) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
}
let returnTo = 'survSetup';
document.querySelectorAll<HTMLElement>('[data-open]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  returnTo = document.querySelector('.screen.show')?.id ?? 'survSetup';
  show(b.dataset.open ?? null);
}));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); Sound.ui(); show(returnTo); }));

function buildSettings() {
  const items: [keyof Settings, string][] = [['sound', 'Sound'], ['music', 'Music']];
  if ('vibrate' in navigator) items.push(['vibration', 'Vibration']);
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
function applySettings() { Sound.soundOn = settings.sound; Sound.musicOn = settings.music; Sound.apply(); }
applySettings();
buildSettings();

/* ---------- the game ---------- */
const isAmmo = (a: unknown): a is AmmoId => typeof a === 'string' && a in AMMO;
const isHat = (h: unknown): h is HatId => typeof h === 'string' && h in HATS;
const savedLoad = store.get<Partial<Loadout>>('loadout', {});
const loadout: Loadout = {
  name: typeof savedLoad.name === 'string' && savedLoad.name.trim() ? cleanName(savedLoad.name) : randomName(),
  color: typeof savedLoad.color === 'string' && COLORS.includes(savedLoad.color) ? savedLoad.color : COLORS[0],
  hat: isHat(savedLoad.hat) ? savedLoad.hat : 'none',
  ammo: isAmmo(savedLoad.ammo) ? savedLoad.ammo : 'normal',
  space: true, // Space Defender is always the space platform
};
const game = new Survival($<HTMLCanvasElement>('sv'), $('svPad'), { over: gameOver, pause, netEnd });
if (isComputer()) game.helpText = 'Arrow keys to walk';
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __gd: unknown }).__gd = game;

function renderLoadout() {
  const name = $<HTMLInputElement>('svName');
  if (document.activeElement !== name) name.value = loadout.name;
  $('svColors').innerHTML = COLORS.map(c => `<button role="radio" aria-label="Colour ${c}" aria-checked="${c === loadout.color}" data-c="${c}" style="background:${c}"></button>`).join('');
  $('svHats').innerHTML = (Object.keys(HATS) as HatId[]).map(h => `<button role="radio" aria-checked="${h === loadout.hat}" data-h="${h}">${HATS[h]}</button>`).join('');
  $('svMode').innerHTML = [['normal', 'Survival'], ['cheat', 'Cheat']].map(([m, l]) => `<button role="radio" aria-checked="${(m === 'cheat') === !!loadout.cheat}" data-mode="${m}">${l}</button>`).join('');
  $('svAmmo').innerHTML = (Object.keys(AMMO) as AmmoId[]).map(a => `<button role="radio" aria-checked="${a === loadout.ammo}" data-a="${a}">${AMMO[a].name}<small>${AMMO[a].desc}</small></button>`).join('');
  const b = store.get<number>('best', 0);
  $('svBest').textContent = b ? `Best ${clock(b)} survived` : '';
  drawPreview($<HTMLCanvasElement>('svPreview'), loadout);
  store.set('loadout', loadout);
}
function openLoadout() {
  game.stop();
  mode = 'menu';
  renderLoadout();
  show('survSetup');
  if (room) showCode(); else void ensureRoom();
}
$('svName').addEventListener('input', () => { loadout.name = cleanName($<HTMLInputElement>('svName').value); renderLoadout(); });
$('svName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); });
$('svDice').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); Sound.ui(); loadout.name = randomName(loadout.name); $<HTMLInputElement>('svName').value = loadout.name; renderLoadout(); });
$('survSetup').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-c], [data-h], [data-a], [data-mode], [data-world]');
  if (!t) return;
  Sound.init(); Sound.ui();
  if (t.dataset.c) loadout.color = t.dataset.c;
  if (isHat(t.dataset.h)) loadout.hat = t.dataset.h;
  if (isAmmo(t.dataset.a)) loadout.ammo = t.dataset.a;
  if (t.dataset.mode) loadout.cheat = t.dataset.mode === 'cheat';
  renderLoadout();
});

// the intro before the first run (and from "How to play" on the title screen)
const min = (s: number) => s / 60;
const INTRO: { icon: string; title: string; lines: string[] }[] = [
  { icon: '🚀', title: 'Your platform', lines: [
    'You start on a 10 by 10 tile platform floating among the stars. You can\'t walk off it, and you can only build on it.',
    'Walk with the <kbd>arrow keys</kbd>, or drag anywhere on the screen on a phone.',
    'In the middle is a big chest: tap it to open it. It holds 100 stacks of up to 100 of a thing. Tap something of yours to put it all in, or tap a stack to take it out.',
    'A <b>platform tile</b> costs 15 stone. Put it next to the platform to make it bigger.'] },
  { icon: '☄️', title: 'Asteroids', lines: [
    'Asteroids fly in from all round. <kbd>Space</kbd> (Shoot asteroid) aims at the nearest one; <kbd>Z</kbd> (Shoot) fires straight ahead. Hold <kbd>Space</kbd> to keep firing.',
    'A shot asteroid breaks into little asteroids that drift. One that drifts onto the platform stops there: walk over it to pick it up (1 stone). The rest float away after a while.',
    'After 10 minutes, about 1 in 3 asteroids is <b>big</b>: slower, 4 shots to break, and it breaks into 8 little ones. Big ones hurt you and crack the platform, and a second hit breaks a tile off with whatever is built on it.'] },
  { icon: '🦾', title: 'Catchers', lines: [
    'A <b>catcher</b> (20 stone, Production tab) shoots out a long grabby arm that reaches 20 tiles, grabs the nearest little asteroid and pulls it back.',
    'Each one gives 1 stone, 2 copper and usually 1 iron. They go out the front (<kbd>R</kbd> turns it) onto a belt or into a chest, or tap the catcher to take them. It holds 30 things before it stops catching.'] },
  { icon: '⚙️', title: 'Crafting and building', lines: [
    'Press <kbd>Shift</kbd> (or the Inventory button) for your inventory on the left and crafting on the right, in tabs: Logistics, Production, Parts and Combat.',
    'Crafting takes time: things line up in the queue at the top left (tap one to cancel it). Missing parts like gears, wire or circuits get made first.',
    'Anything you can place goes on the quickbar at the bottom left: tap it or press <kbd>1</kbd> to <kbd>0</kbd>, then tap the platform. Drag to lay a line of belts. <kbd>R</kbd> turns things. Double-tap anything you built to pick it up.',
    'Furnaces turn ore into plates. Belts, grabbers, crafting machines, turrets and labs all work on the platform, so you can build a whole factory out here.',
    'Bottom left: your weapons on top, your ammo underneath. Tap one to use it. Hold something from your inventory and tap a slot to put it in, or press <kbd>G</kbd> to put one ammo in your gun.'] },
  { icon: '🧑‍🚀', title: 'Saving and friends', lines: [
    'Press <kbd>Esc</kbd> (or the pause button) to pause. From there you can <b>Save</b> your game and <b>Load</b> any save.',
    'Pick <b>Cheat</b> as the mode before you start. Then the pause menu lets you choose Survival or Creative: in Creative everything is free, crafting is instant and nothing hurts you.',
    '<b>Play together</b> (up to 4): your code is on the start screen and top left in the game; friends type it in and tap Join. Everyone has their own inventory. If you get knocked out, you drop your things and come back in 10 seconds.'] },
];
let introPage = 0, introThen: (() => void) | null = null;
function showIntro(then: (() => void) | null) { introPage = 0; introThen = then; renderIntro(); show('survIntro'); }
function renderIntro() {
  const p = INTRO[introPage];
  $('svIntroStep').textContent = `How to play · ${introPage + 1} of ${INTRO.length}`;
  $('svIntroIcon').textContent = p.icon;
  $('svIntroTitle').textContent = p.title;
  $('svIntroText').innerHTML = p.lines.map(l => `<li>${l}</li>`).join('');
  $('svIntroBack').style.visibility = introPage ? 'visible' : 'hidden';
  $('svIntroNext').textContent = introPage < INTRO.length - 1 ? 'Next' : introThen ? 'Start' : 'Done';
}
function endIntro() {
  store.set('intro', true);
  if (introThen) introThen(); else { renderLoadout(); show('survSetup'); }
}
$('svIntroNext').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); if (introPage < INTRO.length - 1) { introPage++; renderIntro(); } else endIntro(); });
$('svIntroBack').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); if (introPage) { introPage--; renderIntro(); } });
$('svIntroSkip').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); endIntro(); });
$('svHow').addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.ui(); showIntro(null); });

function start() {
  Sound.init(); Sound.ui();
  (document.activeElement as HTMLElement | null)?.blur?.();
  show(null);
  game.start({ ...loadout });
  // friends with the code join this game (if the code is still coming, it joins when it's ready)
  hostRoom(); netNote = '';
  mode = 'play'; last = performance.now();
}
/* ---------- playing together ---------- */
let room: Host | null = null, joining = false, opening = false, lastCode = '', netNote = '';
const netMsg = (html: string) => { $('svNetMsg').innerHTML = html; };
const showCode = () => { if (room) netMsg(`${netNote ? escMsg(netNote) + '<br>' : ''}Your code: <b>${room.code}</b> · friends type it in and tap Join, before or after you press Start.`); };
/** Every game has a code friends can join with: get one as soon as the start screen shows. */
async function ensureRoom() {
  if (room || opening || joining || game.net !== 'solo') return;
  opening = true; $('svLink').hidden = true; netMsg(`${netNote ? escMsg(netNote) + '<br>' : ''}Getting your code…`);
  try {
    room = await openRoom(lastCode || undefined); lastCode = room.code;
    if (joining) { room.close(); room = null; return; }
    if (mode === 'menu') showCode(); else hostRoom();
  } catch (err) { netMsg(`Could not get a code: ${escMsg((err as Error).message)}`); $('svLink').hidden = false; }
  finally { opening = false; }
}
/** The game you're playing takes the code, if there is one and you're not in someone else's game. */
function hostRoom() { if (room && game.running && game.net === 'solo') { game.hostGame(room); room = null; } }
$('svLink').addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.ui(); void ensureRoom(); });
async function join() {
  const code = cleanCode($<HTMLInputElement>('svJoinCode').value);
  if (!code) { netMsg('Type your friend\'s code'); return; }
  if (joining) return;
  joining = true; netMsg(`Joining ${code}…`);
  if (room) { room.close(); room = null; }
  try {
    const link = await joinRoom(code);
    netMsg('Linked! Waiting for the game…');
    game.joinGame(link, { ...loadout }, () => {
      joining = false; netNote = ''; netMsg('');
      (document.activeElement as HTMLElement | null)?.blur?.();
      show(null); mode = 'play'; last = performance.now();
    });
  } catch (err) { joining = false; netMsg((err as Error).message); netNote = (err as Error).message; void ensureRoom(); }
}
const escMsg = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
$('svJoin').addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.ui(); void join(); });
$('svJoinCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') void join(); });
$('svJoinCode').addEventListener('input', () => { const i = $<HTMLInputElement>('svJoinCode'), v = cleanCode(i.value); if (i.value !== v) i.value = v; });
/** Playing in a friend's game ended (they left, or the link dropped). */
function netEnd(why: string) {
  joining = false;
  netNote = why;
  openLoadout();
  if (!room) netMsg(escMsg(why));
}
$('svGo').addEventListener('click', e => { e.stopPropagation(); if (store.get('intro', false)) start(); else showIntro(start); });
/** Cheat mode: the pause menu has Survival / Creative. */
function renderPauseMode() {
  const on = game.cheat;
  $('svPauseMode').hidden = !on; $('svPauseModeInfo').hidden = !on;
  for (const b of $('svPauseMode').querySelectorAll<HTMLElement>('[data-pmode]')) b.setAttribute('aria-checked', String((b.dataset.pmode === 'creative') === game.isCreative));
}
$('svPauseMode').addEventListener('click', e => {
  e.stopPropagation();
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pmode]'); if (!b) return;
  Sound.ui(); game.setCreative(b.dataset.pmode === 'creative'); renderPauseMode();
});
function pause() {
  if (mode !== 'play') return;
  game.paused = true; mode = 'paused'; $('svSaved').textContent = ''; show('survPause'); pausedAt = performance.now();
  renderPauseMode();
  $('svPauseCode').innerHTML = game.netCode ? `Code to join: <b>${game.netCode}</b> · ${game.players}/${MAX_PLAYERS} players` : '';
  const guest = game.net === 'guest';
  $('svSave').hidden = guest; $('svLoadGame').hidden = guest;
  if (guest) { $('svPauseMode').hidden = true; $('svPauseModeInfo').hidden = true; }
}
let pausedAt = 0;
// Esc on the pause screen carries on
addEventListener('keydown', e => { if (e.key === 'Escape' && mode === 'paused' && performance.now() - pausedAt > 150 && $('survPause').classList.contains('show')) { game.paused = false; show(null); mode = 'play'; last = performance.now(); } });
$('svResume').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); game.paused = false; show(null); mode = 'play'; last = performance.now(); });
$('svQuit').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); openLoadout(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
/* ---------- save and load ---------- */
// Saves live on this device, newest first. Esc (or the pause button) pauses; the pause screen has Save and Load.
interface Save { id: number; date: number; time: number; name: string; data: SaveData; }
const MAX_SAVES = 12;
const saves = () => store.get<Save[]>('saves', []);
$('svSave').addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  const data = game.save(), list = saves(), time = Number(data.t) || 0;
  const n = (list.reduce((m, s) => Math.max(m, s.id), 0)) + 1;
  list.unshift({ id: n, date: Date.now(), time, name: `Save ${n}`, data });
  let kept = list.slice(0, MAX_SAVES);
  // if the device is out of room, drop the oldest saves until it fits
  for (;;) {
    try { localStorage.setItem('spacedef.saves', JSON.stringify(kept)); break; }
    catch { if (kept.length <= 1) { $('svSaved').textContent = 'Not enough room on this device to save'; return; } kept = kept.slice(0, -1); }
  }
  $('svSaved').textContent = `Saved as Save ${n} (${clock(time)} in)`;
});
let savesFrom = 'survPause';
function openSaves(from: string) {
  savesFrom = from;
  const list = saves();
  $('saveList').innerHTML = list.length ? list.map(s => `<li><div><b>${s.name}</b><small>${clock(s.time)} in · ${new Date(s.date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div><button class="primary small" data-load="${s.id}">Load</button><button class="ghost small" data-del="${s.id}" aria-label="Delete ${s.name}">✕</button></li>`).join('') : '<li class="empty">No saves yet. Pause with Esc and press Save.</li>';
  show('saves');
}
$('svLoadGame').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); openSaves('survPause'); });
$('svLoadTitle').addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.ui(); openSaves('survSetup'); });
$('svSavesBack').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); show(savesFrom); });
$('saveList').addEventListener('click', e => {
  const t = e.target as HTMLElement, load = t.closest<HTMLElement>('[data-load]'), del = t.closest<HTMLElement>('[data-del]');
  if (del) { e.stopPropagation(); Sound.ui(); store.set('saves', saves().filter(s => s.id !== Number(del.dataset.del))); openSaves(savesFrom); return; }
  if (!load) return;
  e.stopPropagation();
  const s = saves().find(s => s.id === Number(load.dataset.load));
  if (!s) return;
  Sound.init(); Sound.ui();
  show(null); $('svSaved').textContent = '';
  game.restore(s.data);
  hostRoom();
  mode = 'play'; last = performance.now();
});

function gameOver(r: SurvivalResult) {
  const best = store.get<number>('best', 0);
  const isBest = r.time > best;
  if (isBest) store.set('best', r.time);
  $('svOverTitle').textContent = 'Lost in space';
  $('svNewBest').hidden = !isBest || best === 0;
  $('svTime').textContent = clock(r.time);
  const stats: [string, string][] = [['Survived', clock(r.time)], ['Shots', String(r.shots)], ['Hits', String(r.hits)], ['Best', clock(Math.max(best, r.time))]];
  $('svStats').innerHTML = stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  // give the last hit a moment on screen before the results
  setTimeout(() => { if (mode === 'play') { mode = 'menu'; $('svPad').hidden = true; show('survOver'); } }, 1200);
}
$('svAgain').addEventListener('click', e => { e.stopPropagation(); start(); });
$('svChange').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); openLoadout(); });

/* ---------- loop ---------- */
let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  last = now;
  if (mode === 'play' || mode === 'paused') { game.update(dt); game.draw(dt); }
}

// Back to the games hub: this game runs in a frame inside the hub (or on its own page).
$('svHub').addEventListener('click', e => {
  e.stopPropagation(); Sound.ui();
  if (parent !== window) parent.postMessage({ type: 'games:exit' }, location.origin); else location.href = './';
});
openLoadout();
requestAnimationFrame(frame);
