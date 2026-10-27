import './ui/styles.css';
import { CpuDriver, aiShop } from './ai/ai';
import { Sound } from './audio/sound';
import type { Battle, BattleEvent } from './core/battle';
import qrcode from 'qrcode-generator';
import { defaultConfig, validateConfig, validateSettings, type GameConfig } from './core/config';
import { STEP, WORLD_H, WORLD_W } from './core/constants';
import { Match } from './core/match';
import { Rng, randomSeed } from './core/rng';
import { type ShopId } from './core/weapons';
import { openPeerRoom } from './net/peer';
import { Room } from './net/room';
import { openTabsRoom, useTabs } from './net/tabs';
import { Renderer } from './render/renderer';
import { fullscreenSupported, initFullscreen, isFullscreen, toggleFullscreen } from './ui/fullscreen';
import {
  describePurchases,
  esc,
  renderFinal,
  renderLobby,
  renderResults,
  renderSetup,
  renderShopWait,
  renderTitle,
} from './ui/screens';

const CONFIG_KEY = 'scorched.config.v1';
const MUTE_KEY = 'scorched.muted';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const screenEl = $('screen');
const gameEl = $('game');
const hudEl = $('hud');
const controlsEl = $('controls');
const bannerEl = $('banner');
const menuEl = $('menu');
const canvas = $<HTMLCanvasElement>('canvas');
const labelsCanvas = $<HTMLCanvasElement>('labels');
const fsCornerBtn = $<HTMLButtonElement>('fs-btn');

const sound = new Sound();
const renderer = new Renderer(canvas);
const uiRng = new Rng(randomSeed());

let match: Match | null = null;
let paused = false;
let fast = false;
let roundOverTimer = -1;

let cpus: CpuDriver | null = null;
/** The phones' room. Kept from match to match until the host goes back to the title. */
let room: Room | null = null;
let roomError: string | null = null;
let config: GameConfig = defaultConfig();
type ScreenName = 'title' | 'setup' | 'lobby' | 'shop' | 'battle' | 'results' | 'final';
let current: ScreenName = 'title';
let resultsTimer = 0;
const RESULTS_SECONDS = 12;

function loadConfig(): GameConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const c = { ...defaultConfig(), ...JSON.parse(raw) } as GameConfig;
    // Humans join from phones now; only computer players are part of a saved setup.
    c.players = c.players.filter((p) => p.kind === 'cpu');
    return validateSettings(c).length ? null : c;
  } catch {
    return null;
  }
}

function saveConfig(c: GameConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, seed: undefined }));
  } catch {
    /* storage unavailable */
  }
}

try {
  sound.muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage unavailable */
}

function toggleMute(): void {
  sound.muted = !sound.muted;
  try {
    localStorage.setItem(MUTE_KEY, sound.muted ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  drawHud();
}

function fullscreenLabel(): string {
  return isFullscreen() ? 'Exit full screen' : 'Full screen';
}

function fullscreenButton(): string {
  return fullscreenSupported() ? `<button class="btn" data-act="fullscreen">${fullscreenLabel()}</button>` : '';
}

function onFullscreenChange(): void {
  fsCornerBtn.textContent = fullscreenLabel();
  if (paused && menuEl.querySelector('[data-act="fullscreen"]')) openMenu();
}

fsCornerBtn.hidden = !fullscreenSupported();
fsCornerBtn.addEventListener('click', toggleFullscreen);
initFullscreen(onFullscreenChange);
onFullscreenChange();

// ---- Screens ----------------------------------------------------------------------

function showScreen(): void {
  gameEl.hidden = true;
  screenEl.hidden = false;
  fsCornerBtn.hidden = !fullscreenSupported();
  window.scrollTo(0, 0);
}

function cpuOnly(c: GameConfig): GameConfig {
  return { ...c, players: c.players.filter((p) => p.kind === 'cpu') };
}

function closeRoom(): void {
  room?.close();
  room = null;
  roomError = null;
}

function showTitle(): void {
  match = null;
  current = 'title';
  closeRoom();
  showScreen();
  const saved = loadConfig();
  renderTitle(screenEl, {
    canContinue: saved !== null,
    onNew: () => {
      sound.unlock();
      showSetup(saved ?? cpuOnly(defaultConfig()));
    },
    onQuick: () => {
      sound.unlock();
      config = saved ?? cpuOnly(defaultConfig());
      showLobby();
    },
  });
}

function showSetup(c: GameConfig): void {
  current = 'setup';
  showScreen();
  renderSetup(screenEl, c, {
    onStart: (next) => {
      sound.unlock();
      saveConfig(next);
      config = next;
      showLobby();
    },
    onBack: showTitle,
  });
}

// ---- Lobby ---------------------------------------------------------------------------

function joinUrl(code: string): string {
  const url = new URL('controller.html', window.location.href);
  url.search = `?room=${code}${useTabs() ? '&net=tabs' : ''}`;
  url.hash = '';
  return url.toString();
}

function drawQr(c: HTMLCanvasElement, text: string): void {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = Math.floor(c.width / (n + quiet * 2));
  const offset = Math.floor((c.width - cell * n) / 2);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect(offset + x * cell, offset + y * cell, cell, cell);
}

let opening = false;
async function openRoom(): Promise<void> {
  if (room || opening) return;
  opening = true;
  roomError = null;
  try {
    const transport = await (useTabs() ? openTabsRoom : openPeerRoom)();
    room = new Room(transport, config.players);
    room.onChange = onRoomChange;
    room.onAllReady = () => {
      if (current === 'shop') startBattle();
    };
  } catch {
    roomError = "Couldn't open a room for phones to join. Check this computer's internet connection, then try again.";
  } finally {
    opening = false;
  }
  if (current === 'lobby') drawLobby();
}

function onRoomChange(): void {
  if (current === 'lobby') drawLobby();
  else if (current === 'shop') drawShopWait();
  else if (current === 'battle') drawControls();
}

function showLobby(): void {
  current = 'lobby';
  match = null;
  showScreen();
  if (room) {
    room.setCpus(config.players);
    if (room.phase !== 'lobby') room.enterLobby();
  }
  drawLobby();
  void openRoom();
}

function drawLobby(): void {
  const players = room ? room.lobbyPlayers(null) : [];
  renderLobby(
    screenEl,
    {
      room: room?.room ?? null,
      joinUrl: room ? joinUrl(room.room) : null,
      error: roomError,
      players,
      canStart: !!room && room.seats.length > 0 && room.playerCount() >= 2,
    },
    {
      onStart: () => {
        if (!room) return;
        sound.unlock();
        const c = room.configFor(config);
        if (validateConfig(c).length) return;
        match = new Match({ ...c, seed: undefined });
        room.attach(match);
        startShopping();
      },
      onBack: () => showSetup(config),
      onRetry: () => {
        roomError = null;
        drawLobby();
        void openRoom();
      },
      drawQr,
    },
  );
}

// ---- Match flow -----------------------------------------------------------------------

let shopNote = '';

function startShopping(): void {
  const m = match!;
  m.nextRound();
  const bought = new Map<number, ShopId[]>();
  for (const p of m.players) if (p.kind === 'cpu') bought.set(p.index, aiShop(m, p.index, uiRng));
  shopNote = describePurchases(m, bought);
  current = 'shop';
  showScreen();
  drawShopWait();
  // Starts the battle straight away if no phone needs to shop.
  room!.enterShop();
}

function drawShopWait(): void {
  const m = match;
  if (!m || !room) return;
  renderShopWait(
    screenEl,
    m,
    room.seats.map((s) => ({ name: s.name, color: s.color, ready: s.ready, connected: !!s.link })),
    shopNote,
    room.room,
  );
}

function startBattle(): void {
  const m = match!;
  const battle = m.startBattle();
  current = 'battle';
  renderer.setBattle(battle, uiRng);
  screenEl.hidden = true;
  screenEl.innerHTML = '';
  gameEl.hidden = false;
  fsCornerBtn.hidden = true;
  paused = false;
  menuEl.hidden = true;
  cpus = new CpuDriver(uiRng);
  if (room && room.seats.length > 0) fast = false;
  roundOverTimer = -1;
  fitCanvas();
  room?.enterBattle();
  showBanner(`ROUND ${m.round} OF ${m.config.rounds}`, 1.6);
  handleEvents(battle);
  drawHud();
  drawControls();
}

function finishRound(): void {
  const m = match!;
  const summary = m.finishRound();
  current = 'results';
  room?.enterResults(summary);
  showScreen();
  const next = () => {
    window.clearInterval(resultsTimer);
    if (current !== 'results') return;
    if (m.isOver) showFinal(m);
    else startShopping();
  };
  renderResults(screenEl, m, summary, next);
  // The host screen is for watching, so move on by itself.
  const btn = screenEl.querySelector<HTMLButtonElement>('#next-btn')!;
  const label = btn.textContent!;
  let left = RESULTS_SECONDS;
  btn.textContent = `${label} (${left})`;
  window.clearInterval(resultsTimer);
  resultsTimer = window.setInterval(() => {
    left--;
    if (left <= 0) next();
    else btn.textContent = `${label} (${left})`;
  }, 1000);
}

function showFinal(m: Match): void {
  current = 'final';
  renderFinal(screenEl, m, {
    onAgain: () => showLobby(),
    onSetup: () => {
      room?.enterLobby();
      showSetup(config);
    },
  });
}

// ---- Banner and pause menu ----------------------------------------------------------

let bannerTimer = 0;
function showBanner(text: string, seconds: number): void {
  bannerEl.textContent = text;
  bannerEl.hidden = false;
  bannerTimer = seconds;
}

function openMenu(): void {
  if (!match?.battle) return;
  paused = true;
  menuEl.hidden = false;
  menuEl.innerHTML = `
    <div class="panel" role="dialog" aria-label="Paused">
      <h2>Paused</h2>
      <button class="btn primary" data-act="resume">Resume</button>
      <button class="btn" data-act="mute">${sound.muted ? 'Turn sound on' : 'Turn sound off'}</button>
      ${fullscreenButton()}
      <button class="btn" data-act="quit">Quit to title</button>
    </div>`;
  menuEl.querySelector<HTMLButtonElement>('[data-act="resume"]')!.focus();
  menuEl.onclick = (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'resume') closeMenu();
    if (act === 'mute') {
      toggleMute();
      openMenu();
    }
    if (act === 'fullscreen') toggleFullscreen();
    if (act === 'quit') {
      menuEl.innerHTML = `
        <div class="panel" role="dialog" aria-label="Quit">
          <h2>Quit this game?</h2>
          <p style="margin:0">Scores from this match will be lost.</p>
          <button class="btn primary" data-act="confirm-quit">Quit to title</button>
          <button class="btn" data-act="resume">Keep playing</button>
        </div>`;
    }
    if (act === 'confirm-quit') {
      fast = false;
      closeMenu();
      showTitle();
    }
  };
}

function closeMenu(): void {
  paused = false;
  menuEl.hidden = true;
  menuEl.innerHTML = '';
}

// ---- HUD and status strip -----------------------------------------------------------

function windText(w: number): string {
  if (w === 0) return 'None';
  return `${w < 0 ? '◀' : ''}${Math.abs(w)}${w > 0 ? '▶' : ''}`;
}

function drawText(b: Battle): string {
  if (!b.drawOpen) return '';
  const { votes, needed } = b.drawTally();
  return `<span class="stat draw-stat"><span class="label">Draw vote</span><span class="value">${votes}/${needed}</span></span>`;
}

let hudKey = '';
function drawHud(): void {
  const b = match?.battle;
  if (!b || !match) return;
  const { votes, needed } = b.drawTally();
  const key = `${b.wind}|${match.round}|${b.drawOpen}|${votes}/${needed}|${sound.muted}`;
  if (key === hudKey && hudEl.childElementCount) return;
  hudKey = key;
  hudEl.innerHTML = `
    <span class="stat"><span class="label">Wind</span><span class="value wind-arrow">${windText(b.wind)}</span></span>
    <span class="stat"><span class="label">Round</span><span class="value">${match.round}/${match.config.rounds}</span></span>
    ${drawText(b)}
    <button class="btn small" data-act="mute" aria-label="${sound.muted ? 'Turn sound on' : 'Turn sound off'}">${sound.muted ? 'Unmute' : 'Mute'}</button>
    <button class="btn small" data-act="menu">Menu</button>`;
}

/** Bottom strip: who is connected, the room code for rejoining, and fast forward for CPU-only games. */
function drawControls(): void {
  const m = match;
  if (!m?.battle) return;
  const seats = room?.seats ?? [];
  const chips = seats
    .map((s) => `<span class="chip ${s.link ? '' : 'offline'}" title="${s.link ? 'Connected' : 'Disconnected'}"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}${s.link ? '' : ' (away)'}</span>`)
    .join('');
  controlsEl.innerHTML = `${chips}
    ${room ? `<span class="status">Rejoin: <b>${esc(room.room)}</b></span>` : ''}
    ${seats.length === 0 ? `<button class="btn small ${fast ? 'pressed' : ''}" data-act="fast" aria-pressed="${fast}">Fast forward</button>` : ''}`;
}

function toggleFast(): void {
  if (room && room.seats.length > 0) return;
  fast = !fast;
  drawControls();
}

controlsEl.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'fast') toggleFast();
});
hudEl.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'mute') toggleMute();
  if (act === 'menu') openMenu();
});

window.addEventListener('keydown', (e) => {
  const b = match?.battle;
  if (!b || gameEl.hidden) return;
  sound.unlock();
  if (e.key === 'Escape') {
    if (paused) closeMenu();
    else openMenu();
    e.preventDefault();
    return;
  }
  if (paused) return;
  const k = e.key.toLowerCase();
  if (k === 'm') toggleMute();
  if (k === 'f') toggleFast();
});

// ---- Events -> sound and effects ----------------------------------------------------

function handleEvents(b: Battle): void {
  if (!b.events.length) return;
  const events: BattleEvent[] = b.events;
  b.events = [];
  room?.battleEvents(events);
  let hudDirty = false;
  for (const ev of events) {
    switch (ev.type) {
      case 'fire':
        sound.fire();
        hudDirty = true;
        break;
      case 'explosion':
        if (ev.dirt) sound.thud();
        else sound.explosion(ev.radius);
        if (ev.radius >= 18) renderer.addShake(Math.min(10, ev.radius / 6));
        break;
      case 'damage': {
        const t = b.tanks[ev.tank];
        renderer.addText(t.x, t.y - 16, `-${ev.amount}`, '#ff7060');
        hudDirty = true;
        break;
      }
      case 'destroyed': {
        const t = b.tanks[ev.tank];
        const who = b.players[t.player].name;
        const by = ev.killer !== null && ev.killer !== t.player ? b.players[ev.killer].name : null;
        renderer.addText(t.x, t.y - 26, by ? `${who} destroyed by ${by}` : `${who} destroyed`, '#ffd040');
        hudDirty = true;
        break;
      }
      case 'planeDown': {
        const who = ev.by !== null ? b.players[ev.by] : null;
        if (who) renderer.addText(ev.x, ev.y - 8, `${who.name} +$${ev.reward.toLocaleString('en-US')}`, who.color);
        sound.chime();
        hudDirty = true;
        break;
      }
      case 'chuteCut': {
        const t = b.tanks[ev.tank];
        const by = ev.by !== null && ev.by !== t.player ? b.players[ev.by] : null;
        renderer.addText(t.x, t.y - 26, by ? `${by.name} cut the chute!` : 'Chute cut!', by?.color ?? '#ffd040');
        sound.thud();
        break;
      }
      case 'parachute':
      case 'move':
        sound.click();
        break;
      case 'repair': {
        const t = b.tanks[ev.tank];
        renderer.addText(t.x, t.y - 16, '+30', '#52d46a');
        sound.chime();
        hudDirty = true;
        break;
      }
      case 'powerCell': {
        const t = b.tanks[ev.tank];
        renderer.addText(t.x, t.y - 16, 'Full power', '#ffd040');
        sound.chime();
        hudDirty = true;
        break;
      }
      case 'wind':
        hudDirty = true;
        break;
      case 'drawVote':
        if (ev.open) showBanner('NO HITS FOR A MINUTE: DRAW VOTE OPEN', 2.4);
        hudDirty = true;
        break;
      case 'roundOver': {
        const w = ev.winner !== null ? b.players[ev.winner].name : null;
        showBanner(w ? `${w.toUpperCase()} WINS!` : 'DRAW', 2.4);
        sound.fanfare();
        roundOverTimer = 2.6;
        hudDirty = true;
        break;
      }
    }
  }
  if (hudDirty) drawHud();
}

// ---- Main loop ---------------------------------------------------------------------

const viewportEl = canvas.closest<HTMLElement>('.viewport')!;
function fitCanvas(): void {
  const vp = viewportEl;
  const w = vp.clientWidth;
  const h = vp.clientHeight;
  if (!w || !h) return;
  const scale = Math.min(w / WORLD_W, h / WORLD_H);
  canvas.style.width = `${Math.floor(WORLD_W * scale)}px`;
  canvas.style.height = `${Math.floor(WORLD_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
new ResizeObserver(fitCanvas).observe(viewportEl);

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const b = match?.battle;
  if (b && !gameEl.hidden) {
    if (!paused) {
      const speed = fast ? 3 : 1;
      acc += dt * speed;
      cpus?.update(b, dt * speed);
      room?.tick(dt);
      let steps = 0;
      while (acc >= STEP && steps < 12) {
        b.update(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 12) acc = 0;
      handleEvents(b);
      drawHud();
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) bannerEl.hidden = true;
      }
      if (roundOverTimer > 0) {
        roundOverTimer -= dt;
        if (roundOverTimer <= 0) {
          roundOverTimer = -1;
          bannerEl.hidden = true;
          finishRound();
        }
      }
    }
    renderer.draw(paused ? 0 : dt, match!.players);
    renderer.drawLabels(labelsCanvas, match!.players);
  }
  requestAnimationFrame(frame);
}

// Browsers stop animating hidden tabs, so pause rather than let the battle stall mid-shot.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && current === 'battle' && !paused) openMenu();
  if (document.visibilityState === 'visible' && current === 'battle' && room && room.seats.length > 0) {
    showBanner('KEEP THIS TAB ON SCREEN DURING A GAME', 2.4);
  }
});

showTitle();
requestAnimationFrame(frame);
