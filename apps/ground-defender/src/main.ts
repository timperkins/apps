// App shell: layout (portrait column), screens, the game loop and saved settings.
import './style.css';
import { Survival, AMMO, HATS, COLORS, SURVIVAL, drawPreview, type Loadout, type AmmoId, type HatId, type SurvivalResult, type SaveData } from './game';
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
};
const game = new Survival($<HTMLCanvasElement>('sv'), $('svPad'), { over: gameOver, pause });
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
}
$('svName').addEventListener('input', () => { loadout.name = cleanName($<HTMLInputElement>('svName').value); renderLoadout(); });
$('svName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); });
$('svDice').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); Sound.ui(); loadout.name = randomName(loadout.name); $<HTMLInputElement>('svName').value = loadout.name; renderLoadout(); });
$('survSetup').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-c], [data-h], [data-a], [data-mode]');
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
  { icon: '🏹', title: 'Walk and shoot', lines: [
    'Walk with the <kbd>arrow keys</kbd>, or drag anywhere on the screen on a phone. The map is big: the small map in the corner shows where everything is.',
    '<kbd>Space</kbd> (Shoot bear) fires at the nearest bear (or bear spawner) in range. <kbd>Z</kbd> (Shoot) fires straight ahead.',
    'Bottom left: your weapons on top, your ammo underneath. Tap one to use it (tap again to take it out). Hold something from your inventory and tap a slot to put it in, or press <kbd>G</kbd> to put one ammo in your gun (<kbd>D</kbd> drops it where the mouse is). <kbd>Tab</kbd> switches weapon, <kbd>S</kbd> ammo. Hold <kbd>Space</kbd> to keep firing.',
    '<b>The machine gun</b> (1000 stone and 500 iron plates, Combat tab) shoots every 0.2 s while you hold <kbd>Space</kbd>, using 0.5% of an ammo a shot: 1.4 damage with stone ammo, 1.5 copper, 1.8 iron, 2 gold, 2.25 diamond.',
    'The rapid crossbow keeps firing with no ammo, but does no damage ("No Ammo").',
    'There is no camp. Bears wait by their spawners and only come for you if you hurt their spawner or one of their bears (then that base attacks), or if pollution gets high: from 50 a base might attack, and at 100 one surely does. Build walls and turrets to make your own base.'] },
  { icon: '🐻', title: 'Bear spawners', lines: [
    `You start on a 10 by 10 stone patch, with a 5 by 5 iron patch and a 5 by 5 copper patch touching it. There are no bear spawners for the first ${SURVIVAL.spawnerDelay / 60} minutes, so use the time to build.`,
    `Bears only come from bear spawners out in the woods. There are ${SURVIVAL.spawnerMin} to ${SURVIVAL.spawnerMax}, each with ${SURVIVAL.spawnerHp} health.`,
    `For the first ${min(SURVIVAL.earlyTime)} minutes each spawner makes a bear every ${SURVIVAL.spawnEarly} seconds, then every ${SURVIVAL.spawnEvery} seconds, up to ${SURVIVAL.maxBears} bears on the map. Tap a spawner to make it send a bear right away. A destroyed spawner comes back somewhere else ${SURVIVAL.spawnerBack} seconds later, so the bears never stop: survive as long as you can.`,
    'Pick <b>Cheat</b> as the mode before you start. Then press <kbd>Esc</kbd> (or pause) to choose Survival or Creative: in Creative everything is free, crafting is instant and nothing hurts you.',
    'Press <kbd>Esc</kbd> (or the pause button) to pause. From there you can <b>Save</b> your game and <b>Load</b> any save.',
    'Each bear you destroy gives you 5 stone, and each acid fish 1 iron ore.',
    'A bear swipes for 8% of your health. Bears never throw or shoot anything. Bears growl when they are close.'] },
  { icon: '🐟', title: 'Acid fish', lines: [
    `About 1 in 10 things a spawner makes (${(SURVIVAL.fishChance * 100).toFixed(2)}%) is a green <b>acid fish</b> instead of a bear. It keeps away from you and spits green acid slime from up to 10 tiles away.`,
    `A hit does ${SURVIVAL.acidHit.toLocaleString()} damage and burns you for ${SURVIVAL.acidBurn.toLocaleString()} a second for ${SURVIVAL.acidBurnTime} seconds (you glow green).`,
    `Slime leaves a puddle for ${SURVIVAL.puddleTime} seconds. Standing in one does ${SURVIVAL.puddleBurn.toLocaleString()} a second (more puddles, more damage) and burns you at half strength. Keep moving!`] },
  { icon: '🌊', title: 'Huge waves', lines: [
    `Huge waves of bears come at ${min(SURVIVAL.waveStart)}, ${min(SURVIVAL.waveStart + SURVIVAL.waveEvery)} and ${min(SURVIVAL.waveStart + SURVIVAL.waveEvery * 2)} minutes (then every ${min(SURVIVAL.waveEvery)} minutes).`,
    'You start with a drill, 10 power poles, a generator, an ammo machine, 2 turrets, 100 stone ammo, a furnace and 8 iron plates.'] },
  { icon: '⛏️', title: 'Ore, furnaces and plates', lines: [
    'Ore patches lie out in the woods: stone, iron, copper, gold and diamonds (the best ones far out, near the spawners). They never run out. Stand on one and press <kbd>M</kbd> (or the Mine button) to dig by hand.',
    'Put ore in a furnace (<kbd>T</kbd> next to it, or tap it): iron and copper become plates, gold becomes bars, diamonds get cut and stone becomes bricks. ',
    'After 4 bears, a stone mine and an ammo machine pop up. Hire miners at the mine with <kbd>H</kbd>. Tap the ammo machine and pick a recipe first, then put in stone, plates, bars or cut diamonds: 1 iron plate makes 6 (9.5 damage), copper 8 (8.55), gold 12 (11.5), diamond 16 (15). You can also craft ammo by hand in the Combat tab, but you get 1 less. Put ammo in your ammo slots to shoot it.'] },
  { icon: '⚙️', title: 'Crafting', lines: [
    'Press <kbd>Shift</kbd> (or the Inventory button) for your inventory on the left and crafting on the right, in tabs: Logistics, Production, Parts and Combat.',
    'Crafting takes time: things line up in the queue at the top left (tap one to cancel it). If you are missing parts like gears, wire or circuits, they get made first.',
    'Anything you can place goes on the quickbar at the bottom left: tap it or press <kbd>1</kbd> to <kbd>0</kbd>, then tap the map. Drag to lay a line of belts. <kbd>R</kbd> turns things. Tap anything you placed to pick it back up, machines and mines too.'] },
  { icon: '🏭', title: 'Your factory', lines: [
    'Tap a drill to see what it is digging, how fast, and whether it has power.',
    'Drills go on ore patches and dig by themselves, dropping ore in front onto a belt. Grabbers move things off belts into furnaces, assemblers, chests and turrets, and back out.',
    'Drills, assemblers and labs need power: a generator burning stone, and power poles (each one powers what is next to it and joins other poles up to 7 tiles away). A red lightning bolt means no power.',
    'A <b>crafting machine</b> costs 10 iron plates and 5 stone, no research needed. Tap one to set a recipe (like gears) and put in what it needs. It crafts 4 times slower than you, but keeps going until you change the recipe. Grabbers can feed it too.',
    'Your factory makes pollution (top right). The more pollution, the more often bears come, and the tougher they get.'] },
  { icon: '🎯', title: 'Turrets and research', lines: [
    'Turrets shoot bears and spawners. Load them with <kbd>T</kbd>, or feed them ammo with belts and grabbers.',
    'A turret shoots every 0.2 seconds for 1 damage a shot, using 16% of an ammo each shot (about 6 shots an ammo).',
    'Tapping a turret also opens a panel where you set the most ammo it will hold, from 0 to 10,000.',
    'Tap a turret, then tap a bear or spawner: the turret shoots that one until it is destroyed. Tap the turret twice to pick it up.',
    'Labs use red science packs (and green ones later) to research. <kbd>Y</kbd> picks what: assemblers, splitters, faster belts, stronger turrets, robots, the <b>rapid crossbow</b> and the <b>rocket launcher</b>. Some research needs other research first.',
    '<b>Crafting speed</b> and <b>Furnace speed</b> can be researched again and again: each level makes it 1.25 times faster. The first level costs 30 packs and each one after costs 20 more, up to 980.'] },
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
    try { localStorage.setItem('grounddef.saves', JSON.stringify(kept)); break; }
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
  mode = 'play'; last = performance.now();
});

function gameOver(r: SurvivalResult) {
  const best = store.get<number>('best', 0);
  const isBest = r.time > best;
  if (isBest) store.set('best', r.time);
  $('svOverTitle').textContent = 'The bears got you';
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
