import '../ui/styles.css';
import './controller.css';
import { MAX_POWER, MOVE_TIME, RELOAD_TIME, SELL_RATE } from '../core/constants';
import { PLAYER_COLORS, TANK_DESIGNS, TANK_DESIGN_NAMES, type TankDesign } from '../core/config';
import { ITEMS, ITEM_ORDER, WEAPONS, WEAPON_ORDER, shopDef, type ShopId } from '../core/weapons';
import { enterFullscreen, keepAwake, lockLandscape } from './device';
import { joinPeerRoom } from '../net/peer';
import { joinTabsRoom, useTabs } from '../net/tabs';
import {
  NAME_MAX,
  PROTOCOL_VERSION,
  normalizeRoomCode,
  type BattleStatus,
  type ClientMsg,
  type HostMsg,
  type LobbyPlayer,
  type RoundResult,
  type ShopState,
} from '../net/protocol';
import type { Link } from '../net/transport';
import { drawTankPreview, esc, fmt } from '../ui/screens';

/**
 * The phone controller. It never simulates anything: it sends what the player does to the
 * host and shows what the host reports back.
 */

const app = document.getElementById('app')!;
const NAME_KEY = 'scorched.name';
const tokenKey = (room: string) => `scorched.token.${room}`;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

type Screen = 'join' | 'connecting' | 'lobby' | 'shop' | 'battle' | 'results' | 'rejected' | 'lost';

const state = {
  screen: 'join' as Screen,
  room: normalizeRoomCode(new URLSearchParams(location.search).get('room') ?? '') ?? '',
  name: load(NAME_KEY) ?? '',
  token: null as string | null,
  color: PLAYER_COLORS[0],
  design: 'classic' as TankDesign,
  lobby: [] as LobbyPlayer[],
  taken: [] as string[],
  shop: null as ShopState | null,
  round: 0,
  rounds: 0,
  result: null as RoundResult | null,
  message: '',
  /** True once the host has accepted us; a drop after that means rejoin automatically. */
  joined: false,
};
if (state.room) state.token = load(tokenKey(state.room));

let link: Link | null = null;

function send(msg: ClientMsg): void {
  link?.send(msg);
}

// ---- Connection ------------------------------------------------------------------------

let reconnectTimer = 0;
/** When the current run of reconnect attempts started; after a minute the phone stops trying. */
let lostSince = 0;
const GIVE_UP_MS = 60000;

function retryLater(): void {
  showLost();
  if (!lostSince) lostSince = Date.now();
  if (Date.now() - lostSince > GIVE_UP_MS) {
    lostSince = 0;
    state.joined = false;
    state.message = `Lost game ${state.room}. If it's still running, join again with the code on the big screen.`;
    setScreen('join');
    return;
  }
  reconnectTimer = window.setTimeout(connect, 2000);
}

async function connect(): Promise<void> {
  window.clearTimeout(reconnectTimer);
  if (!state.joined) setScreen('connecting');
  try {
    const l = await (useTabs() ? joinTabsRoom : joinPeerRoom)(state.room);
    link = l;
    l.onMessage((m) => onHostMessage(m as HostMsg));
    l.onClose(() => {
      if (link !== l) return;
      link = null;
      if (state.screen === 'rejected') return;
      if (state.joined) {
        retryLater();
      } else {
        state.message = 'Lost the connection to the game.';
        setScreen('join');
      }
    });
    l.send({ t: 'hello', v: PROTOCOL_VERSION, name: state.name, token: state.token } satisfies ClientMsg);
  } catch {
    if (state.joined) {
      retryLater();
    } else {
      state.message = `Couldn't find game ${state.room}. Check the code on the big screen and that you're on the same wifi.`;
      setScreen('join');
    }
  }
}

function showLost(): void {
  if (state.screen !== 'lost') setScreen('lost');
}

function onHostMessage(msg: HostMsg): void {
  switch (msg.t) {
    case 'welcome':
      state.joined = true;
      lostSince = 0;
      state.token = msg.token;
      state.color = msg.color;
      state.design = msg.design;
      save(tokenKey(state.room), msg.token);
      if (state.screen === 'lobby') drawLobby();
      return;
    case 'reject':
      state.message = msg.reason;
      state.joined = false;
      setScreen('rejected');
      return;
    case 'phase':
      switch (msg.phase) {
        case 'lobby':
          state.lobby = msg.players;
          state.taken = msg.taken;
          return setScreen('lobby');
        case 'shop':
          state.shop = msg.shop;
          return setScreen('shop');
        case 'battle':
          state.round = msg.round;
          state.rounds = msg.rounds;
          return setScreen('battle');
        case 'results':
          state.result = msg.result;
          return setScreen('results');
      }
      return;
    case 'status':
      onStatus(msg);
      return;
    case 'event':
      if (msg.kind === 'hit') buzz(60);
      else if (msg.kind === 'destroyed') buzz([80, 60, 200]);
      else if (msg.kind === 'fired') buzz(25);
      return;
  }
}

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

// ---- Screens -------------------------------------------------------------------------

function setScreen(s: Screen): void {
  const changed = state.screen !== s;
  state.screen = s;
  document.body.dataset.screen = s;
  keepAwake(s === 'lobby' || s === 'shop' || s === 'battle' || s === 'results' || s === 'lost');
  if (changed) lockLandscape(s === 'battle');
  switch (s) {
    case 'join':
      return drawJoin();
    case 'connecting':
      return drawMessage('Joining…', `Connecting to game <b>${esc(state.room)}</b>.`);
    case 'lost':
      return drawMessage('Reconnecting…', 'Lost the connection to the big screen. Trying again.');
    case 'rejected':
      return drawMessage("Can't join", esc(state.message), true);
    case 'lobby':
      return drawLobby();
    case 'shop':
      return drawShop();
    case 'battle':
      if (changed || !app.querySelector('.ctl')) buildBattle();
      return;
    case 'results':
      return drawResults();
  }
}

function drawMessage(title: string, body: string, retry = false): void {
  app.innerHTML = `
    <div class="pad-screen">
      <h1 class="pad-title">${title}</h1>
      <div class="panel"><p style="margin:0">${body}</p>
      ${retry ? '<div class="footer-actions"><button class="btn primary" data-act="restart">Back</button></div>' : ''}</div>
    </div>`;
  app.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-act="restart"]')) {
      state.message = '';
      setScreen('join');
    }
  };
}

function drawJoin(): void {
  app.innerHTML = `
    <div class="pad-screen">
      <h1 class="pad-title logo">SCORCHED</h1>
      <form class="panel join-form" id="join-form" novalidate>
        <div class="field"><label for="room">Game code</label>
          <input id="room" autocomplete="off" autocapitalize="characters" maxlength="4" value="${esc(state.room)}" placeholder="ABCD" inputmode="text"></div>
        <div class="field"><label for="name">Your name</label>
          <input id="name" autocomplete="nickname" maxlength="${NAME_MAX}" value="${esc(state.name)}" placeholder="Name"></div>
        <p class="errors" role="alert">${esc(state.message)}</p>
        <button type="submit" class="btn primary">Join game</button>
      </form>
    </div>`;
  const form = app.querySelector<HTMLFormElement>('#join-form')!;
  const nameEl = form.querySelector<HTMLInputElement>('#name')!;
  if (state.room && !state.name) nameEl.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normalizeRoomCode(form.querySelector<HTMLInputElement>('#room')!.value);
    const name = nameEl.value.trim().slice(0, NAME_MAX);
    if (!code) return showJoinError('Enter the 4-letter code from the big screen.');
    if (!name) return showJoinError('Enter a name for your tank.');
    if (code !== state.room) state.token = load(tokenKey(code));
    state.room = code;
    state.name = name;
    state.message = '';
    save(NAME_KEY, name);
    enterFullscreen();
    history.replaceState(null, '', `?room=${code}${useTabs() ? '&net=tabs' : ''}`);
    void connect();
  });
}

function showJoinError(text: string): void {
  app.querySelector('.errors')!.textContent = text;
}

function drawLobby(): void {
  const taken = new Set(state.taken);
  app.innerHTML = `
    <div class="pad-screen">
      <h1 class="pad-title">YOU'RE IN</h1>
      <div class="panel">
        <h2>Color</h2>
        <div class="swatches">${PLAYER_COLORS.map(
          (c) => `<button class="swatch ${c === state.color ? 'picked' : ''}" style="background:${c}" data-color="${c}"
              ${taken.has(c) ? 'disabled aria-label="Taken"' : `aria-label="Pick color ${c}"`} aria-pressed="${c === state.color}"></button>`,
        ).join('')}</div>
        <h2 style="margin-top:14px">Tank</h2>
        <div class="designs">${TANK_DESIGNS.map(
          (d) => `<button class="design ${d === state.design ? 'picked' : ''}" data-design="${d}" aria-pressed="${d === state.design}">
              <canvas width="72" height="54" data-preview="${d}" aria-hidden="true"></canvas><span>${TANK_DESIGN_NAMES[d]}</span></button>`,
        ).join('')}</div>
      </div>
      <div class="panel">
        <h2>Tanks</h2>
        <ul class="lobby-list">${state.lobby
          .map((p) => `<li><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.you ? ' (you)' : p.cpu ? ' <span class="desc">CPU</span>' : ''}</li>`)
          .join('')}</ul>
        <p class="note">Waiting for the big screen to start the battle. Hold your phone sideways when it does.</p>
      </div>
    </div>`;
  app.querySelectorAll<HTMLCanvasElement>('canvas[data-preview]').forEach((c) =>
    drawTankPreview(c, state.color, c.dataset.preview as TankDesign),
  );
  app.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    if (b.dataset.color) send({ t: 'look', color: b.dataset.color, design: state.design });
    if (b.dataset.design) send({ t: 'look', color: state.color, design: b.dataset.design as TankDesign });
  };
}

function drawShop(): void {
  const shop = state.shop!;
  const row = (id: ShopId) => {
    const def = shopDef(id);
    const free = def.bundle === 0;
    const owned = free ? '∞' : String(shop.inventory[id]);
    const sellPrice = free ? 0 : Math.floor((def.price / def.bundle) * SELL_RATE);
    return `<li class="shop-item">
      <div class="shop-info"><b>${esc(def.name)}</b> <span class="owned">×${owned}</span><br>
        <span class="desc">${esc(def.description)}</span></div>
      ${
        free
          ? '<span class="desc">Free</span>'
          : `<div class="shop-buttons">
              <button class="btn small" data-buy="${id}" ${shop.ready || shop.coins < def.price ? 'disabled' : ''}>Buy ${def.bundle} · $${fmt(def.price)}</button>
              <button class="btn small" data-sell="${id}" ${shop.ready || shop.inventory[id] <= 0 ? 'disabled' : ''}>Sell 1 · $${fmt(sellPrice)}</button>
            </div>`
      }
    </li>`;
  };
  const scroll = app.querySelector('.shop-scroll')?.scrollTop ?? 0;
  app.innerHTML = `
    <div class="pad-screen shop-screen">
      <div class="shop-head panel">
        <span>Round ${shop.round} of ${shop.rounds}</span>
        <span class="coins">$${fmt(shop.coins)}</span>
        <button class="btn ${shop.ready ? '' : 'primary'}" data-act="ready">${shop.ready ? 'Keep shopping' : 'Ready'}</button>
      </div>
      <div class="panel shop-scroll">
        ${shop.ready ? '<p class="note" style="margin-top:0">Ready. Waiting for everyone else to finish shopping.</p>' : ''}
        <h2>Weapons</h2>
        <ul class="shop-list">${WEAPON_ORDER.map(row).join('')}</ul>
        <h2>Items</h2>
        <ul class="shop-list">${ITEM_ORDER.map(row).join('')}</ul>
      </div>
    </div>`;
  app.querySelector('.shop-scroll')!.scrollTop = scroll;
  app.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    if (b.dataset.buy) send({ t: 'buy', item: b.dataset.buy as ShopId });
    if (b.dataset.sell) send({ t: 'sell', item: b.dataset.sell as ShopId });
    if (b.dataset.act === 'ready') send({ t: 'ready', ready: !shop.ready });
  };
}

function drawResults(): void {
  const r = state.result!;
  app.innerHTML = `
    <div class="pad-screen">
      <h1 class="pad-title">${r.final ? 'GAME OVER' : `ROUND ${r.round}`}</h1>
      <div class="panel">
        <h2>${r.youWon ? 'You won the round!' : r.winner ? `${esc(r.winner)} won the round` : 'The round was a draw'}</h2>
        <dl class="help">
          <dt>Damage</dt><dd>${fmt(r.damage)}</dd>
          <dt>Kills</dt><dd>${r.kills}</dd>
          <dt>Earned</dt><dd>$${fmt(r.earned)}</dd>
          <dt>Cash</dt><dd>$${fmt(r.coins)}</dd>
          <dt>Standing</dt><dd>${ordinal(r.place)}</dd>
        </dl>
        <p class="note">${r.final ? 'Check the big screen for the final standings.' : 'The shop opens here when the big screen moves on.'}</p>
      </div>
    </div>`;
  app.onclick = null;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---- Battle controller -----------------------------------------------------------------

let status: BattleStatus | null = null;
let angle = 90;
let power = 500;
/** Until this time the phone's own aim wins over what the host reports. */
let localUntil = 0;
let reloadEnds = 0;
let reloadTotal = RELOAD_TIME;
let aimDirty = false;
let lastAimSent = 0;
const AIM_SEND_MS = 50;

function onStatus(s: BattleStatus): void {
  const first = !status;
  status = s;
  if (first || performance.now() > localUntil) {
    angle = s.angle;
    power = s.power;
  }
  power = Math.min(power, s.maxPower);
  reloadEnds = performance.now() + s.reload * 1000;
  reloadTotal = s.reloadTotal;
  if (state.screen === 'battle') updateBattle();
}

function setAim(a: number, p: number): void {
  angle = Math.max(0, Math.min(180, a));
  power = Math.max(0, Math.min(status?.maxPower ?? MAX_POWER, Math.round(p)));
  localUntil = performance.now() + 400;
  aimDirty = true;
  flushAim();
  updateBattle();
}

function flushAim(): void {
  const now = performance.now();
  if (!aimDirty || now - lastAimSent < AIM_SEND_MS) return;
  aimDirty = false;
  lastAimSent = now;
  send({ t: 'aim', angle: Math.round(angle * 10) / 10, power });
}

function buildBattle(): void {
  app.innerHTML = `
    <div class="ctl">
      <div class="panel ctl-aim" data-drag="angle">
        <span class="ctl-label">ANGLE</span>
        <div class="ctl-row">
          <button class="btn hold" data-hold="angle+1" aria-label="Turn barrel left">◀</button>
          <span class="ctl-val" id="angle-val"></span>
          <button class="btn hold" data-hold="angle-1" aria-label="Turn barrel right">▶</button>
        </div>
        <span class="ctl-label" style="margin-top:6px">POWER</span>
        <div class="ctl-row">
          <button class="btn hold" data-hold="power-1" aria-label="Less power">▼</button>
          <span class="ctl-val" id="power-val"></span>
          <button class="btn hold" data-hold="power+1" aria-label="More power">▲</button>
        </div>
        <span class="ctl-hint">hold, or drag here</span>
      </div>
      <div class="panel ctl-mid">
        <div class="ctl-name"><span class="dot" style="background:${state.color}"></span>${esc(state.name)}</div>
        <div class="meter"><i id="health-bar"></i><i id="shield-bar" class="shield"></i></div>
        <div id="info-line" class="ctl-info"></div>
        <div class="ctl-row">
          <button class="btn" data-act="weapon-1" aria-label="Previous weapon">‹</button>
          <span id="weapon" class="ctl-weapon"></span>
          <button class="btn" data-act="weapon+1" aria-label="Next weapon">›</button>
        </div>
        <div class="ctl-row">
          <button class="btn small" data-act="repair" id="repair"></button>
          <button class="btn small" data-act="cell" id="cell"></button>
        </div>
        <button class="btn small" data-act="draw" id="draw" hidden></button>
      </div>
      <div class="panel ctl-fire">
        <button class="fire-btn" data-act="fire" id="fire">FIRE</button>
        <div class="ctl-row">
          <button class="btn move-btn" data-act="move-1" id="move-left" aria-label="Drive left">◀ MOVE</button>
          <button class="btn move-btn" data-act="move+1" id="move-right" aria-label="Drive right">MOVE ▶</button>
        </div>
        <span class="ctl-label">RELOAD</span>
        <div class="meter"><i id="reload-bar" class="reload"></i></div>
      </div>
      <div class="ctl-dead" id="dead" hidden><div class="panel"><h2>Destroyed</h2><p style="margin:0">Watch the big screen. You'll be back next round.</p></div></div>
    </div>
    <div class="rotate"><div class="panel"><h2>Turn your phone sideways</h2><p style="margin:0">The controller works in landscape.</p></div></div>`;
  app.onclick = null;
  bindBattle();
  updateBattle();
}

function updateBattle(): void {
  if (state.screen !== 'battle') return;
  const s = status;
  const $ = (id: string) => document.getElementById(id);
  const angleEl = $('angle-val');
  if (!angleEl) return;
  angleEl.textContent = `${Math.round(angle)}°`;
  $('power-val')!.textContent = String(power);
  if (!s) return;
  $('health-bar')!.style.width = `${Math.max(0, Math.min(100, s.health))}%`;
  $('shield-bar')!.style.width = `${Math.min(100, (s.shield / 60) * 100)}%`;
  const wind = s.wind === 0 ? 'none' : `${s.wind < 0 ? '◀' : ''}${Math.abs(s.wind)}${s.wind > 0 ? '▶' : ''}`;
  setText($('info-line')!, `Health ${s.health} · $${fmt(s.coins)} · Wind ${wind} · Max ${s.maxPower}`);
  setText($('weapon')!, `${WEAPONS[s.weapon].name} ${s.ammo < 0 ? '∞' : `×${s.ammo}`}`);
  const repair = $('repair') as HTMLButtonElement;
  setText(repair, `Repair ×${s.repairKits}`);
  const cell = $('cell') as HTMLButtonElement;
  setText(cell, `${ITEMS.powerCell.name} ×${s.powerCells}`);
  cell.disabled = s.powerCells <= 0 || s.maxPower >= MAX_POWER;
  const draw = $('draw') as HTMLButtonElement;
  draw.hidden = !s.drawOpen;
  setText(draw, s.drawVoted ? `Draw agreed (${s.drawVotes}/${s.drawNeeded}) · undo` : `Vote draw (${s.drawVotes}/${s.drawNeeded})`);
  draw.classList.toggle('pressed', s.drawVoted);
  $('dead')!.hidden = s.alive;
  updateReload();
}

function updateReload(): void {
  const s = status;
  const fire = document.getElementById('fire') as HTMLButtonElement | null;
  if (!s || !fire) return;
  const left = Math.max(0, (reloadEnds - performance.now()) / 1000);
  const ready = left <= 0 && s.alive && !s.moving && !s.flying;
  fire.disabled = !ready;
  // Under a parachute the move buttons steer instead, for as long as they're held.
  const moveLeft = document.getElementById('move-left') as HTMLButtonElement;
  const moveRight = document.getElementById('move-right') as HTMLButtonElement;
  moveLeft.disabled = moveRight.disabled = !ready && !s.parachuting;
  setText(moveLeft, s.parachuting ? '◀ STEER' : '◀ MOVE');
  setText(moveRight, s.parachuting ? 'STEER ▶' : 'MOVE ▶');
  (document.getElementById('repair') as HTMLButtonElement).disabled = !ready || s.repairKits <= 0 || s.fullHealth;
  document.getElementById('reload-bar')!.style.width = `${(1 - left / reloadTotal) * 100}%`;
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

let holdTimer = 0;
/** Which way the player is steering a parachuting tank, while a move button is held. */
let steering: -1 | 0 | 1 = 0;
/** The last press steered, so its click isn't also a drive. */
let steerPress = false;
function applyHold(action: string, ticks: number): void {
  const big = ticks > 12;
  const dir = action.endsWith('-1') ? -1 : 1;
  if (action.startsWith('angle')) setAim(Math.round(angle) + dir * (big ? 3 : 1), power);
  else setAim(angle, power + dir * (big ? 25 : 5));
}

function bindBattle(): void {
  const root = app.querySelector<HTMLElement>('.ctl')!;
  root.addEventListener('pointerdown', (e) => {
    // A rejoining phone skipped the Join tap; the first touch in battle goes full screen instead.
    if (!document.fullscreenElement) {
      enterFullscreen();
      lockLandscape(true);
    }
    const hold = (e.target as HTMLElement).closest<HTMLElement>('[data-hold]');
    if (hold) {
      e.preventDefault();
      const action = hold.dataset.hold!;
      let ticks = 0;
      applyHold(action, ticks);
      const repeat = () => {
        ticks++;
        applyHold(action, ticks);
        holdTimer = window.setTimeout(repeat, 60);
      };
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(repeat, 300);
      return;
    }
    const moveBtn = (e.target as HTMLElement).closest<HTMLElement>('.move-btn');
    steerPress = !!moveBtn && !!status?.parachuting;
    if (moveBtn && steerPress) {
      e.preventDefault();
      steering = moveBtn.dataset.act === 'move-1' ? -1 : 1;
      send({ t: 'steer', dir: steering });
      return;
    }
    const drag = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
    if (drag && !(e.target as HTMLElement).closest('button')) startDrag(e, drag);
  });
  const stop = () => {
    window.clearTimeout(holdTimer);
    if (steering !== 0) send({ t: 'steer', dir: 0 });
    steering = 0;
  };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'fire') {
      aimDirty = true;
      lastAimSent = 0;
      flushAim();
      send({ t: 'fire' });
      // Assume the shot went out; the host's next status corrects this if not.
      reloadEnds = performance.now() + RELOAD_TIME * 1000;
      reloadTotal = RELOAD_TIME;
      updateReload();
    }
    // A press that steered a parachute isn't also a drive.
    if ((act === 'move-1' || act === 'move+1') && !steerPress) {
      send({ t: 'move', dir: act === 'move-1' ? -1 : 1 });
      // Moving uses up the turn; the host's next status corrects this if the way was blocked.
      reloadEnds = performance.now() + MOVE_TIME * 1000;
      reloadTotal = MOVE_TIME;
      updateReload();
    }
    if (act === 'weapon-1') send({ t: 'weapon', dir: -1 });
    if (act === 'weapon+1') send({ t: 'weapon', dir: 1 });
    if (act === 'repair') send({ t: 'repair' });
    if (act === 'cell') send({ t: 'powerCell' });
    if (act === 'draw') send({ t: 'draw', agree: !status?.drawVoted });
  });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** Dragging sideways turns the barrel; dragging up and down changes power. */
function startDrag(e: PointerEvent, el: HTMLElement): void {
  const startX = e.clientX;
  const startY = e.clientY;
  const a0 = angle;
  const p0 = power;
  el.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    setAim(a0 - dx * 0.25, p0 - dy * 2.5);
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function loop(): void {
  if (state.screen === 'battle') {
    flushAim();
    updateReload();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Reopening the page with a saved seat goes straight back into the game.
if (state.room && state.token && state.name) void connect();
else setScreen('join');
