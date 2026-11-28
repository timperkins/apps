import './style.css';
import { Game, type GameEvent } from './game';
import { Renderer } from './render';
import { Controls } from './input';
import { isMuted, pauseMusic, playMusic, resumeMusic, setMuted, sfx, trackForLevel, unlockAudio } from './audio';
import { itemSprite, jeffSprite, jeffStage, lennySprite, lennyStage } from './sprites';
import { themeFor } from './themes';
import { POWERUPS, offer, rank, xpForLevel, type Powerup, type Ranks } from './powerups';
import { Rng } from './rng';
import { Bonus } from './bonus';
import { ENDING, JEFF_CAUGHT, JEFF_INTRO, LENNY_INTRO, freshLine, stageLines } from './story';

declare const __VERSION__: string;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- save data

interface Save {
  level: number;
  xp: number;
  plevel: number;
  ranks: Ranks;
  muted: boolean;
  best: number;
}
const SAVE_KEY = 'escape-the-mansion/save/v1';
function load(): Save | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (s && typeof s.level === 'number') return s as Save;
  } catch {
    /* ignore */
  }
  return null;
}
function store() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}
let save: Save = load() ?? { level: 1, xp: 0, plevel: 1, ranks: {}, muted: false, best: 0 };
setMuted(save.muted);

// ---------------------------------------------------------------- setup

const canvas = $<HTMLCanvasElement>('game');
const renderer = new Renderer(canvas);
const controls = new Controls($('stage'), $('stick'), $('knob'), $('action'));
const coarse = window.matchMedia('(pointer: coarse)').matches;
if (coarse) {
  document.body.classList.add('touch');
  controls.touch = true;
}
$('version').textContent = __VERSION__;
$('howTo').textContent = coarse
  ? 'Drag anywhere to sneak. Tap the round button to throw or use what you are holding.'
  : 'Arrow keys or WASD to sneak. Space to throw or use what you are holding.';

type Mode = 'title' | 'dialog' | 'play' | 'caught' | 'complete' | 'powerups' | 'pause' | 'ending' | 'bonus';
let bonus: Bonus | null = null;
let bonusResult: { coins: number; time: number; bumps: number } | null = null;
let mode: Mode = 'title';
let game: Game | null = null;
let attemptXp = 0;
let levelStartXp = 0;
let pendingPicks = 0;
let caughtTimer = 0;
let lastT = performance.now();
let clock = 0;
const flavour = new Rng(Date.now() & 0xffff);

function showScreen(id: string | null) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('show', el.id === id);
  document.body.classList.toggle('playing', mode === 'play');
  $('hud').hidden = !game || mode === 'title' || mode === 'ending';
}

function resize() {
  renderer.resize();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- menus (move + action)

let menuButtons: HTMLElement[] = [];
let menuSel = 0;
function setMenu(buttons: HTMLElement[], sel = 0) {
  menuButtons = buttons.filter((b) => !b.hidden);
  menuSel = Math.min(sel, menuButtons.length - 1);
  paintMenu();
}
function paintMenu() {
  menuButtons.forEach((b, i) => b.classList.toggle('sel', i === menuSel && !controls.touch));
}
controls.onDir = (dx, dy) => {
  if (mode === 'play' || !menuButtons.length) return;
  const step = mode === 'powerups' && window.innerWidth >= 900 ? dx || dy : mode === 'powerups' ? dx + dy * 2 : dy || dx;
  menuSel = (menuSel + step + menuButtons.length) % menuButtons.length;
  sfx('blip');
  paintMenu();
};
controls.onAction = () => {
  unlockAudio();
  if (mode === 'dialog') {
    advanceDialog();
    return;
  }
  if (mode === 'play' || mode === 'caught') return;
  const b = menuButtons[menuSel];
  if (b) b.click();
};

// ---------------------------------------------------------------- title

function toTitle() {
  mode = 'title';
  game = null;
  playMusic('main');
  const s = load();
  const cont = $('continueBtn');
  cont.hidden = !s || s.level <= 1;
  if (s) cont.textContent = `Continue · Level ${s.level}`;
  $('muteBtn').textContent = `Sound: ${isMuted() ? 'off' : 'on'}`;
  showScreen('title');
  setMenu([cont, $('newBtn'), $('muteBtn')]);
}

$('continueBtn').addEventListener('click', () => {
  unlockAudio();
  sfx('click');
  save = load() ?? save;
  startLevel(save.level, true);
});
$('newBtn').addEventListener('click', () => {
  unlockAudio();
  sfx('click');
  const muted = save.muted;
  save = { level: 1, xp: 0, plevel: 1, ranks: {}, muted, best: save.best };
  store();
  startLevel(1, true);
});
const toggleMute = () => {
  unlockAudio();
  save.muted = !save.muted;
  setMuted(save.muted);
  store();
  $('muteBtn').textContent = $('muteBtn2').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
  if (!save.muted) sfx('click');
};
$('muteBtn').addEventListener('click', toggleMute);
$('muteBtn2').addEventListener('click', toggleMute);

// ---------------------------------------------------------------- levels

function startLevel(n: number, withIntro: boolean) {
  game = new Game(n, save.ranks);
  renderer.setLevel(game.L);
  attemptXp = 0;
  levelStartXp = save.xp;
  save.level = n;
  store();
  playMusic(trackForLevel(n));
  updateHud(true);
  const intro = JEFF_INTRO[n];
  if (withIntro && intro) {
    const lines: DialogLine[] = intro.map((text) => ({ who: 'jeff' as const, text }));
    if (LENNY_INTRO[n]) lines.push({ who: 'lenny', text: LENNY_INTRO[n] });
    runDialog(lines, () => beginPlay(n));
  } else beginPlay(n);
}

function beginPlay(n: number) {
  mode = 'play';
  controls.clear();
  showScreen(null);
  const th = themeFor(n);
  const card = $('levelCard');
  card.innerHTML = `<div class="n">Level ${n}</div><div class="a">${th.name}</div>`;
  card.classList.add('show');
  setTimeout(() => card.classList.remove('show'), 1800);
  const tip = tutorial(n);
  if (tip) setTimeout(() => toast(tip, 5200), 1900);
}

function tutorial(n: number): string | null {
  const move = coarse ? 'Drag anywhere to sneak' : 'Arrow keys or WASD to sneak';
  const act = coarse ? 'tap the round button' : 'press Space';
  switch (n) {
    case 1:
      return `${move} to the glowing EXIT. Stay out of the guard's light. Grab the rock and ${act} to throw it: a hit knocks a guard out.`;
    case 2:
      return 'Red lasers flick on and off. Time your run, or they sound the alarm. Bottles make a racket that pulls guards away.';
    case 3:
      return 'Watch the floor for spike traps. Bandages heal a heart.';
    case 4:
      return 'Dogs sniff you out up close. Throw meat and they forget all about you. A rock works too, for a bit.';
    case 6:
      return 'Each level-up lets you pick a powerup. Some change what you find lying around.';
    case 11:
      return 'Wind-up toys rattle for a while and keep guards busy.';
    case 14:
      return 'Security cameras! Stay out of their sweep, or crack one with a rock.';
    case 50:
      return 'Jeff is coming for you himself. A rock will slow him down. Reach the gate!';
  }
  return null;
}

let toastTimer = 0;
function toast(text: string, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

// ---------------------------------------------------------------- dialog

interface DialogLine {
  who: 'jeff' | 'lenny';
  text: string;
}
let dialogLines: DialogLine[] = [];
let dialogIdx = 0;
let dialogChars = 0;
let dialogDone: (() => void) | null = null;
let dialogLevel = 1;

function runDialog(lines: DialogLine[], done: () => void) {
  mode = 'dialog';
  dialogLines = lines;
  dialogIdx = 0;
  dialogChars = 0;
  dialogDone = done;
  dialogLevel = game?.level ?? 1;
  showScreen('dialog');
  setMenu([]);
  paintDialog();
  if (lines[0]?.who === 'jeff') sfx('jeff');
}
function paintDialog() {
  const l = dialogLines[dialogIdx];
  const sp = $('speaker');
  sp.textContent = l.who === 'jeff' ? 'Jeff' : 'Lenny';
  sp.className = l.who;
  drawPortrait($<HTMLCanvasElement>('portrait'), l.who, dialogLevel);
}
function advanceDialog() {
  const l = dialogLines[dialogIdx];
  if (!l) return;
  if (dialogChars < l.text.length) {
    dialogChars = l.text.length;
    return;
  }
  dialogIdx++;
  dialogChars = 0;
  if (dialogIdx >= dialogLines.length) {
    const d = dialogDone;
    dialogDone = null;
    d?.();
    return;
  }
  sfx('click');
  paintDialog();
}
$('dialog').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  unlockAudio();
  advanceDialog();
});

const lennyImg = new Image();
lennyImg.src = 'lenny.png';
function drawPortrait(cv: HTMLCanvasElement, who: 'jeff' | 'lenny', level: number) {
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = who === 'jeff' ? '#20142a' : '#2a1a12';
  c.fillRect(0, 0, cv.width, cv.height);
  if (who === 'lenny' && lennyStage(level) === 0 && lennyImg.complete && lennyImg.naturalWidth) {
    c.drawImage(lennyImg, 0, 0, cv.width, cv.height);
    return;
  }
  // head and shoulders, zoomed
  const spr = who === 'jeff' ? jeffSprite(jeffStage(level), 'down', 0) : lennySprite(lennyStage(level), 'down', 0, false);
  if (who === 'jeff') c.drawImage(spr, 4, 0, 24, 24, 0, 0, cv.width, cv.height);
  else c.drawImage(spr, 0, 0, 32, 32, 0, 0, cv.width, cv.height);
}

// ---------------------------------------------------------------- events from the game

function handle(e: GameEvent) {
  if (!game) return;
  switch (e.type) {
    case 'sfx':
      sfx(e.name);
      break;
    case 'xp':
      attemptXp += e.amount;
      updateHud(true);
      break;
    case 'hint':
      toast(e.text, 1600);
      break;
    case 'intercom':
      sfx('intercom');
      toast(`📢 Jeff, over the intercom: “${e.text}”`, 5500);
      break;
    case 'spotted':
      break;
    case 'caught': {
      mode = 'caught';
      caughtTimer = 0;
      sfx('caught');
      document.body.classList.remove('playing');
      setTimeout(() => {
        if (mode !== 'caught') return;
        $('caughtTitle').textContent = e.reason === 'health' ? 'Knocked out!' : e.reason === 'jeff' ? 'Jeff got you!' : 'Caught!';
        const taunt = e.reason === 'jeff' || flavour.chance(0.55);
        $('caughtJeff').hidden = !taunt;
        if (taunt && game) {
          drawPortrait($<HTMLCanvasElement>('caughtPortrait'), 'jeff', game.level);
          $('caughtLine').textContent = freshLine(stageLines(JEFF_CAUGHT, game.jstage), `caught${game.jstage}`);
        }
        showScreen('caught');
      }, 700);
      break;
    }
    case 'complete': {
      mode = 'complete';
      document.body.classList.remove('playing');
      sfx('complete');
      setTimeout(() => finishLevel(e.ghost, e.time), 600);
      break;
    }
  }
}

$('caught').addEventListener('pointerdown', (e) => e.stopPropagation());

function retry() {
  if (!game) return;
  game.reset();
  attemptXp = 0;
  mode = 'play';
  controls.clear();
  showScreen(null);
  updateHud(true);
}

function finishLevel(ghost: boolean, time: number) {
  if (!game) return;
  const n = game.level;
  const bonus = 30 + (ghost ? 20 : 0);
  const gained = attemptXp + bonus;
  save.xp += gained;
  attemptXp = 0;
  let ups = 0;
  while (save.xp >= xpForLevel(save.plevel)) {
    save.xp -= xpForLevel(save.plevel);
    save.plevel++;
    ups++;
  }
  pendingPicks += ups;
  save.level = Math.min(50, n + 1);
  save.best = Math.max(save.best, n);
  if (n === 50) save.level = 50;
  store();
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  $('completeTitle').textContent = n === 50 ? 'You made it!' : `Level ${n} complete`;
  $('completeStats').innerHTML = [
    ['Time', `${mins}:${String(secs).padStart(2, '0')}`],
    ['Unseen', ghost ? 'Yes! +20 XP' : 'No'],
    ['XP earned', `+${gained}`],
    ups ? ['Level up', `Lv ${save.plevel}!`] : null,
  ]
    .filter(Boolean)
    .map((r) => `<dt>${r![0]}</dt><dd>${r![1]}</dd>`)
    .join('');
  $('nextBtn').textContent = pendingPicks ? 'Choose powerup' : n === 50 ? 'Escape!' : 'Next level';
  showScreen('complete');
  setMenu([$('nextBtn')]);
  updateHud(true);
}

$('nextBtn').addEventListener('click', () => {
  sfx('click');
  afterComplete();
});

function afterComplete() {
  if (!game) return;
  if (pendingPicks > 0) {
    showPowerups();
    return;
  }
  if (game.level === 50) {
    startBonus();
    return;
  }
  startLevel(game.level + 1, true);
}

// ---------------------------------------------------------------- powerups

function showPowerups() {
  mode = 'powerups';
  sfx('levelup');
  const choices = offer(save.ranks, new Rng(save.plevel * 31 + save.level * 7 + pendingPicks * 101));
  if (!choices.length) {
    pendingPicks = 0;
    afterComplete();
    return;
  }
  $('puLead').textContent = `Lenny is now level ${save.plevel - pendingPicks + 1}. Choose a powerup${pendingPicks > 1 ? ` (${pendingPicks} to pick)` : ''}.`;
  const box = $('cards');
  box.innerHTML = '';
  const buttons = choices.map((p) => cardFor(p));
  buttons.forEach((b) => box.appendChild(b));
  showScreen('powerups');
  setMenu(buttons);
}

function cardFor(p: Powerup): HTMLElement {
  const b = document.createElement('button');
  b.className = 'card';
  const r = rank(save.ranks, p.id);
  b.innerHTML = `<span class="icon">${p.icon}</span><span class="name">${p.name}</span><span class="kind">${p.kind === 'odds' ? 'Item odds' : 'Stat boost'}</span><span class="desc">${p.desc}</span><span class="pips">${'●'.repeat(r + 1)}${'○'.repeat(p.max - r - 1)}</span>`;
  b.addEventListener('click', () => {
    save.ranks[p.id] = r + 1;
    pendingPicks--;
    store();
    sfx('heal');
    toast(`${p.name} ${r + 1 > 1 ? `rank ${r + 1}` : ''}`.trim(), 1400);
    afterComplete();
  });
  return b;
}

// ---------------------------------------------------------------- pause

function pause() {
  if (mode !== 'play') return;
  mode = 'pause';
  $('muteBtn2').textContent = `Sound: ${isMuted() ? 'off' : 'on'}`;
  const owned = POWERUPS.filter((p) => rank(save.ranks, p.id) > 0);
  $('powerList').innerHTML = owned.length
    ? owned.map((p) => `<span>${p.icon} ${p.name}${rank(save.ranks, p.id) > 1 ? ' ×' + rank(save.ranks, p.id) : ''}</span>`).join('')
    : '';
  showScreen('pause');
  setMenu([$('resumeBtn'), $('restartBtn'), $('muteBtn2'), $('quitBtn')]);
}
$('pauseBtn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  pause();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (mode === 'play') pause();
    else if (mode === 'pause') resume();
  }
});
function resume() {
  mode = 'play';
  controls.clear();
  showScreen(null);
}
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => {
  retry();
});
$('quitBtn').addEventListener('click', () => {
  sfx('click');
  toTitle();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    pauseMusic();
  } else resumeMusic();
});
// browsers only start audio after a tap or key press
const firstGesture = () => {
  unlockAudio();
  window.removeEventListener('pointerdown', firstGesture);
  window.removeEventListener('keydown', firstGesture);
};
window.addEventListener('pointerdown', firstGesture);
window.addEventListener('keydown', firstGesture);
for (const id of ['title', 'complete', 'powerups', 'pause', 'ending'])
  $(id).addEventListener('pointerdown', (e) => {
    controls.touch = e.pointerType !== 'mouse';
    paintMenu();
    e.stopPropagation();
  });

// ---------------------------------------------------------------- bonus: the getaway

function startBonus() {
  mode = 'bonus';
  bonus = new Bonus();
  bonusResult = null;
  game = null;
  playMusic('main');
  showScreen(null);
  document.body.classList.add('playing');
  $('hud').hidden = true;
  $('actionIcon').textContent = '📯';
  $('actionCount').textContent = '';
  const card = $('levelCard');
  card.innerHTML = '<div class="n">Bonus</div><div class="a">The Getaway</div>';
  card.classList.add('show');
  setTimeout(() => card.classList.remove('show'), 2200);
  setTimeout(
    () => toast(coarse ? 'Steer by dragging. Drag down to floor it. Tap the button to honk.' : 'Left and right to steer, down to floor it, up to brake. Space honks.', 4500),
    6000,
  );
}

function bonusFrame(dt: number) {
  if (!bonus) return;
  const m = controls.move();
  bonus.update(dt, { mx: m.x, my: m.y, action: controls.takeAction() });
  for (const e of bonus.events) {
    if (e.type === 'sfx') sfx(e.name);
    else if (e.type === 'say') toast((e.who === 'jeff' ? 'Jeff' : 'Lenny') + ': “' + e.text + '”', 3000);
    else if (e.type === 'done') {
      bonusResult = { coins: e.coins, time: e.time, bumps: e.bumps };
      setTimeout(showEnding, 1200);
    }
  }
  const v = renderer.view;
  bonus.draw(canvas.getContext('2d')!, v.cssW, v.cssH, v.dpr);
}

// ---------------------------------------------------------------- ending

function showEnding() {
  mode = 'ending';
  playMusic('main');
  sfx('levelup');
  const cv = $<HTMLCanvasElement>('endingArt');
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const g = c.createLinearGradient(0, 0, 0, 140);
  g.addColorStop(0, '#0a1430');
  g.addColorStop(1, '#2a3a5a');
  c.fillStyle = g;
  c.fillRect(0, 0, 320, 140);
  c.fillStyle = '#f0f0d8';
  c.beginPath();
  c.arc(260, 30, 16, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 30; i++) {
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillRect((i * 97) % 320, (i * 53) % 70, 1, 1);
  }
  c.fillStyle = '#1e2a1a';
  c.fillRect(0, 110, 320, 30);
  // the gate behind
  c.fillStyle = '#0c0c0c';
  for (let x = 20; x < 150; x += 8) c.fillRect(x, 40, 3, 72);
  c.fillRect(16, 56, 136, 3);
  // Jeff, defeated, by the gate; Lenny walking away
  c.drawImage(jeffSprite(4, 'down', 0), 70, 50, 64, 64);
  c.drawImage(lennySprite(4, 'side', 1, false), 200, 46, 64, 64);
  const loot = bonusResult ? ` He drove off in Jeff's limo with ${bonusResult.coins} of Jeff's gold coins and left the mansion in flames.` : '';
  $('endingText').innerHTML = `<b>Jeff:</b> “${ENDING.jeff}”<br><br><b>Lenny:</b> “${ENDING.lenny}”<br><br>Lenny escaped the mansion.${loot} Lv ${save.plevel}.`;
  bonus = null;
  document.body.classList.remove('playing');
  save.level = 1;
  save.xp = 0;
  save.plevel = 1;
  save.ranks = {};
  store();
  game = null;
  showScreen('ending');
  setMenu([$('endingBtn')]);
}
$('endingBtn').addEventListener('click', toTitle);

// ---------------------------------------------------------------- HUD

let hudKey = '';
const actionCanvas = document.createElement('canvas');
actionCanvas.width = 16;
actionCanvas.height = 16;
function updateHud(force = false) {
  if (!game) return;
  const p = game.p;
  const need = xpForLevel(save.plevel);
  const xpNow = save.xp + attemptXp;
  const key = `${p.hearts}|${game.st.maxHearts}|${p.held}|${p.count}|${xpNow}|${save.plevel}|${game.level}`;
  if (!force && key === hudKey) return;
  hudKey = key;
  $('hearts').innerHTML = Array.from({ length: game.st.maxHearts }, (_, i) => `<span class="${i < p.hearts ? 'h' : 'e'}">♥</span>`).join('');
  $('levelName').textContent = `Level ${game.level} · ${themeFor(game.level).name}`;
  $('plevel').textContent = `Lv ${save.plevel}`;
  $('xpbar').style.width = `${Math.min(100, (xpNow / need) * 100)}%`;
  const icon = $('actionIcon');
  const count = $('actionCount');
  icon.innerHTML = '';
  if (p.held) {
    const c = actionCanvas.getContext('2d')!;
    c.clearRect(0, 0, 16, 16);
    c.drawImage(itemSprite(p.held), 0, 0);
    const img = document.createElement('canvas');
    img.width = 16;
    img.height = 16;
    img.getContext('2d')!.drawImage(actionCanvas, 0, 0);
    icon.appendChild(img);
    count.textContent = p.count > 1 ? String(p.count) : '';
  } else {
    icon.textContent = '✋';
    count.textContent = '';
  }
  void levelStartXp;
}

// ---------------------------------------------------------------- loop

function frame(now: number) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  clock += dt;
  if (mode === 'bonus' && bonus) {
    bonusFrame(dt);
  } else if (game) {
    if (mode === 'play') {
      const m = controls.move();
      game.update(dt, { mx: m.x, my: m.y, action: controls.takeAction() });
      for (const e of game.events.slice()) handle(e);
      updateHud();
    } else if (mode === 'caught' || mode === 'complete') {
      game.update(dt, { mx: 0, my: 0, action: false });
      if (mode === 'caught') {
        caughtTimer += dt;
        if (caughtTimer > 2.8) retry();
      }
    }
    renderer.draw(game, clock);
    if (mode !== 'title') renderer.drawMinimap(game, $<HTMLCanvasElement>('minimap'), clock);
  } else {
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // typewriter
  if (mode === 'dialog') {
    const l = dialogLines[dialogIdx];
    if (l && dialogChars < l.text.length) {
      const before = Math.floor(dialogChars);
      dialogChars = Math.min(l.text.length, dialogChars + dt * 45);
      if (Math.floor(dialogChars) !== before && before % 2 === 0) sfx('blip');
      $('line').textContent = l.text.slice(0, Math.floor(dialogChars));
    } else if (l) $('line').textContent = l.text;
  }
  requestAnimationFrame(frame);
}

toTitle();
requestAnimationFrame(frame);

// dev hook: ?level=N jumps straight to a level
const qLevel = Number(new URLSearchParams(location.search).get('level'));
if (qLevel >= 1 && qLevel <= 50) startLevel(qLevel, new URLSearchParams(location.search).has('intro'));
if (new URLSearchParams(location.search).has('bonus')) startBonus();
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __renderer: renderer, __getGame: () => game });
