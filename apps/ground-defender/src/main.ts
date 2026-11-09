// App shell: layout (portrait column), screens, the game loop and saved settings.
import './style.css';
import { Survival, AMMO, HATS, COLORS, SURVIVAL, drawPreview, type Loadout, type AmmoId, type HatId, type SurvivalResult } from './game';
import { Sound } from './audio';
import { randomName, cleanName } from './names';

type Mode = 'menu' | 'play' | 'paused';
interface Settings { sound: boolean; music: boolean; vibration: boolean; }

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};
const stage = $('stage');
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('grounddef.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('grounddef.' + k, JSON.stringify(v)); } catch { } },
};
const settings: Settings = Object.assign({ sound: true, music: false, vibration: true }, store.get('settings', {}));
const isComputer = () => matchMedia('(pointer: fine)').matches && !matchMedia('(any-pointer: coarse)').matches && navigator.maxTouchPoints === 0;
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let mode: Mode = 'menu';

/* ---------- layout: a phone-shaped column, below iOS's status bar strip ---------- */
/** Height of iOS 26's soft edge effect at the top of an installed app, in CSS px (see Sky Defender 2's README). */
const GLASS_BAND = 44;
const CARD_RADIUS = 14;
const iosApp = (navigator as { standalone?: boolean }).standalone === true;
function layout() {
  const W = innerWidth, H = innerHeight;
  let sw = W, sh = H;
  if (W > H) sw = Math.round(Math.min(W, H * .62)); // a wide window or a turned phone: a portrait column
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
};
const game = new Survival($<HTMLCanvasElement>('sv'), $('svPad'), { over: gameOver, pause });
if (isComputer()) game.helpText = 'Arrow keys to walk';
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __gd: unknown }).__gd = game;

function renderLoadout() {
  const name = $<HTMLInputElement>('svName');
  if (document.activeElement !== name) name.value = loadout.name;
  $('svColors').innerHTML = COLORS.map(c => `<button role="radio" aria-label="Colour ${c}" aria-checked="${c === loadout.color}" data-c="${c}" style="background:${c}"></button>`).join('');
  $('svHats').innerHTML = (Object.keys(HATS) as HatId[]).map(h => `<button role="radio" aria-checked="${h === loadout.hat}" data-h="${h}">${HATS[h]}</button>`).join('');
  $('svAmmo').innerHTML = (Object.keys(AMMO) as AmmoId[]).map(a => `<button role="radio" aria-checked="${a === loadout.ammo}" data-a="${a}">${AMMO[a].name}<small>${AMMO[a].desc}</small></button>`).join('');
  const b = store.get<number>('best', 0), wins = store.get<number>('wins', 0);
  $('svBest').textContent = [b ? `Best ${clock(b)} survived` : '', wins ? `${wins} win${wins > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  drawPreview($<HTMLCanvasElement>('svPreview'), loadout);
  store.set('loadout', loadout);
}
function openLoadout() {
  game.stop();
  mode = 'menu';
  renderLoadout();
  show('survSetup');
}
$('svName').addEventListener('input', () => { loadout.name = cleanName($<HTMLInputElement>('svName').value); renderLoadout(); });
$('svName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); });
$('svDice').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); Sound.ui(); loadout.name = randomName(loadout.name); $<HTMLInputElement>('svName').value = loadout.name; renderLoadout(); });
$('survSetup').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-c], [data-h], [data-a]');
  if (!t) return;
  Sound.init(); Sound.ui();
  if (t.dataset.c) loadout.color = t.dataset.c;
  if (isHat(t.dataset.h)) loadout.hat = t.dataset.h;
  if (isAmmo(t.dataset.a)) loadout.ammo = t.dataset.a;
  renderLoadout();
});

// the intro before the first run (and from "How to play" on the title screen)
const min = (s: number) => s / 60;
const INTRO: { icon: string; title: string; lines: string[] }[] = [
  { icon: '🏹', title: 'Walk and shoot', lines: [
    'Walk with the <kbd>arrow keys</kbd>, or drag anywhere on the screen on a phone. The map is big: the small map in the corner shows where everything is.',
    '<kbd>Space</kbd> (Shoot bear) fires at the nearest bear (or bear spawner) in range. <kbd>Z</kbd> (Shoot) fires straight ahead.',
    'You can walk out of your camp through any open gate, but bears outside will come for you.'] },
  { icon: '🐻', title: 'Bear spawners', lines: [
    `Bears only come from bear spawners out in the woods. There are ${SURVIVAL.spawnerMin} to ${SURVIVAL.spawnerMax}, each with ${SURVIVAL.spawnerHp} health.`,
    `Each spawner makes a bear every ${SURVIVAL.spawnEvery} seconds, up to ${SURVIVAL.maxBears} bears on the map. Destroy every spawner to win!`,
    'Bears wait outside a gate. The ring over each one counts down, then it comes in. Inside, a bear swipes for 8% of your health and throws rocks for 9%.'] },
  { icon: '🚪', title: 'Gates and huge waves', lines: [
    `Huge waves of bears come at ${min(SURVIVAL.waveStart)}, ${min(SURVIVAL.waveStart + SURVIVAL.waveEvery)} and ${min(SURVIVAL.waveStart + SURVIVAL.waveEvery * 2)} minutes (then every ${min(SURVIVAL.waveEvery)} minutes).`,
    `At ${min(SURVIVAL.moreGates)} minutes gates open on the other 3 sides of your camp.`,
    `At ${min(SURVIVAL.allGates)} minutes 3 more gates open and bears come from everywhere, but they take ${SURVIVAL.gateWaitLate} seconds to get in.`] },
  { icon: '⛏️', title: 'Mines and the machine', lines: [
    'After 4 bears, a mine, a machine and a shop pop up. Press <kbd>M</kbd> next to the mine to dig stone, or hire miners with <kbd>H</kbd>.',
    'Click the machine (or press <kbd>M</kbd>) to put your stone in: each stone makes 5 stone ammo. <kbd>S</kbd> switches ammo.',
    'Buy an iron mine (100 stone), a copper mine (75 iron, 100 stone), a gold mine (125 stone, 100 iron, 50 copper) or a diamond mine. Put metal in a machine for strong ammo: 1 iron makes 6 ammo (9.5 damage), 1 copper 8 (8.55), 1 gold 12 (11.5), 1 diamond 16 (15).'] },
  { icon: '🎯', title: 'Turrets', lines: [
    'Buy turrets in the shop (<kbd>B</kbd>), place them with <kbd>U</kbd> and load them with <kbd>T</kbd>, or feed them with belts and grabbers.',
    'Tap a turret, then tap a bear or spawner: the turret shoots that one until it is destroyed. Tap the turret twice to pick it up.',
    'Research (labs and science packs, <kbd>Y</kbd>) unlocks the <b>rapid crossbow</b> (10 iron, 50 stone: 0.75 damage every 0.05 s, 0.8% of an ammo a shot) and the <b>rocket launcher</b> (70 damage). Once rockets are researched, click a machine to pick its recipe: ammo, or rocket ammo for 10 stone.'] },
  { icon: '🛒', title: 'Building', lines: [
    'Belts (<kbd>E</kbd>, <kbd>Q</kbd>) carry stone, metal and you. <kbd>R</kbd> turns things. Grabbers (<kbd>G</kbd>), splitters (<kbd>X</kbd>) and chests (<kbd>C</kbd>) move and store it.',
    'Later: furnaces (<kbd>F</kbd>) make bricks, generators (<kbd>V</kbd>) speed things up, pumps and pipes (<kbd>W</kbd>, <kbd>I</kbd>) cool turrets, assemblers (<kbd>A</kbd>), underground belts (<kbd>D</kbd>) and robot hubs (<kbd>O</kbd>).',
    'Metal mines go anywhere inside your walls: <kbd>1</kbd> iron, <kbd>2</kbd> copper, <kbd>3</kbd> gold, <kbd>4</kbd> diamond. <kbd>5</kbd> places a rapid crossbow and <kbd>6</kbd> a rocket launcher.'] },
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
  mode = 'play'; last = performance.now();
}
$('svGo').addEventListener('click', e => { e.stopPropagation(); if (store.get('intro', false)) start(); else showIntro(start); });
function pause() {
  if (mode !== 'play') return;
  game.paused = true; mode = 'paused'; show('survPause');
}
$('svResume').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); game.paused = false; show(null); mode = 'play'; last = performance.now(); });
$('svQuit').addEventListener('click', e => { e.stopPropagation(); Sound.ui(); openLoadout(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function gameOver(r: SurvivalResult) {
  const best = store.get<number>('best', 0);
  const isBest = r.time > best;
  if (isBest) store.set('best', r.time);
  if (r.won) store.set('wins', store.get<number>('wins', 0) + 1);
  $('svOverTitle').textContent = r.won ? 'You destroyed every bear spawner!' : 'The bears got you';
  $('svNewBest').hidden = !isBest || best === 0;
  $('svTime').textContent = clock(r.time);
  const stats: [string, string][] = [['Survived', clock(r.time)], ['Bears defeated', String(r.kills)], ['Spawners destroyed', String(r.spawners)], ['Shots', String(r.shots)], ['Hits', String(r.hits)], ['Best', clock(Math.max(best, r.time))]];
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

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !import.meta.env.DEV) navigator.serviceWorker.register('sw.js').catch(() => { });
openLoadout();
requestAnimationFrame(frame);
