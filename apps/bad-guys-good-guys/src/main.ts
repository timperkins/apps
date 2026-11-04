import qrcode from 'qrcode-generator';
import './style.css';
import { playEvents, unlockAudio } from './audio';
import type { Look } from './core/look';
import { joinPeerRoom, openPeerRoom } from './net/peer';
import { normalizeRoomCode } from './net/protocol';
import { GuestSession, HostSession, type Session } from './net/session';
import { GameView, portrait } from './render/view';
import { Creator } from './ui/creator';
import { Hud } from './ui/hud';
import { Controls } from './ui/input';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<div class="stage"></div><div class="ui"></div><div class="rotate">Turn your phone sideways to play</div>`;
const stage = app.querySelector<HTMLElement>('.stage')!;
const ui = app.querySelector<HTMLElement>('.ui')!;

let view: GameView | null = null;
let session: Session | null = null;
let controls: Controls | null = null;
let hud: Hud | null = null;
let raf = 0;
let menuRaf = 0;

// Test hook: advance the game by a fixed step per frame, for slow headless browsers.
const FIXED_STEP = new URLSearchParams(location.search).has('fixedstep');
const joinParam = normalizeRoomCode(new URLSearchParams(location.search).get('join') ?? '');

function getView(): GameView {
  if (!view) {
    view = new GameView(stage);
    (window as unknown as { __view: GameView }).__view = view;
  }
  return view;
}

function clearUi(): void {
  ui.innerHTML = '';
}

// ---------------------------------------------------------------- title

function title(): void {
  clearUi();
  const v = getView();
  menuBackdrop(v);
  const el = document.createElement('div');
  el.className = 'screen title';
  el.innerHTML = `
    <div class="logo"><span class="bad">BAD GUYS</span><span class="and">and</span><span class="good">GOOD GUYS</span></div>
    <p class="tag">The last bell rang. The grown-ups are not happy about it.</p>
    <button class="btn primary big play">${joinParam ? `Join game ${joinParam}` : 'Play'}</button>
    <p class="hint">1 to 4 players · phone or computer</p>`;
  ui.appendChild(el);
  el.querySelector('.play')!.addEventListener('click', () => {
    unlockAudio();
    creator();
  });
}

/** Slow pan along the street behind the menus. */
function menuBackdrop(v: GameView): void {
  cancelAnimationFrame(menuRaf);
  let x = 6;
  let last = performance.now();
  v.apply({ t: 0, ph: 'walk', sec: 0, wave: 0, cam: x, kids: [], en: [], pr: [], pk: [], ev: [] }, true);
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    x += dt * 1.2;
    if (x > 100) x = 6;
    v.apply({ t: 0, ph: 'walk', sec: 0, wave: 0, cam: x, kids: [], en: [], pr: [], pk: [], ev: [] }, true);
    v.render(dt);
    menuRaf = requestAnimationFrame(loop);
  };
  menuRaf = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- character

function creator(): void {
  clearUi();
  const c = new Creator(
    ui,
    (look, mode) => {
      c.destroy();
      if (joinParam) void join(look, joinParam);
      else if (mode === 'host') void host(look);
      else joinPrompt(look);
    },
    joinParam,
  );
  const back = document.createElement('button');
  back.className = 'btn small back';
  back.textContent = '‹ Back';
  back.addEventListener('click', () => {
    c.destroy();
    title();
  });
  c.el.appendChild(back);
}

// ---------------------------------------------------------------- lobby

function lobbyShell(): HTMLElement {
  clearUi();
  const el = document.createElement('div');
  el.className = 'screen lobby';
  ui.appendChild(el);
  return el;
}

function rosterHtml(s: Session): string {
  return [...s.looks]
    .map(([id, look]) => `<li><img src="${portrait(look, 64)}" alt=""><span>${look.name}${id === s.myId ? ' (you)' : ''}</span></li>`)
    .join('') + Array.from({ length: 4 - s.looks.size }, () => '<li class="empty"><span>Open spot</span></li>').join('');
}

async function host(look: Look): Promise<void> {
  const el = lobbyShell();
  el.innerHTML = `<div class="panel"><h2>Opening a game…</h2></div>`;
  let s: HostSession;
  try {
    const transport = await openPeerRoom();
    s = new HostSession(look, transport);
  } catch {
    el.innerHTML = `<div class="panel"><h2>Couldn't open an online game</h2><p>The connection service didn't answer. You can still play on your own.</p>
      <div class="row"><button class="btn primary solo">Play solo</button><button class="btn back">Back</button></div></div>`;
    el.querySelector('.solo')!.addEventListener('click', () => {
      const solo = new HostSession(look, null);
      session = solo;
      solo.start();
      game(solo);
    });
    el.querySelector('.back')!.addEventListener('click', creator);
    return;
  }
  session = s;
  const url = new URL(location.href);
  const peerhost = new URLSearchParams(location.search).get('peerhost');
  url.search = `?join=${s.room}${peerhost ? `&peerhost=${peerhost}` : ''}`;
  url.hash = '';
  const qr = qrcode(0, 'M');
  qr.addData(url.toString());
  qr.make();
  const draw = () => {
    el.innerHTML = `<div class="panel host">
      <div class="join-info">
        <p>Friends join at <b>${location.host}</b> with code</p>
        <div class="code">${s.room}</div>
        <div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
        <p class="small">or scan to join</p>
      </div>
      <div class="side">
        <h2>Your crew</h2>
        <ul class="roster">${rosterHtml(s)}</ul>
        <div class="row"><button class="btn primary big start">Start${s.looks.size > 1 ? '' : ' solo'}</button></div>
        <button class="btn small back">‹ Back</button>
      </div></div>`;
    el.querySelector('.start')!.addEventListener('click', () => {
      s.start();
    });
    el.querySelector('.back')!.addEventListener('click', () => {
      s.close();
      session = null;
      creator();
    });
  };
  draw();
  s.onLooks = draw;
  s.onStart = () => game(s);
  const tick = () => {
    if (session !== s || s.started) return;
    s.update(0.1);
    setTimeout(tick, 100);
  };
  tick();
}

function joinPrompt(look: Look): void {
  const el = lobbyShell();
  el.innerHTML = `<div class="panel"><h2>Join a game</h2><p>Type the 4-digit code on the host's screen.</p>
    <input class="codein" inputmode="numeric" maxlength="4" placeholder="1234" autocomplete="off">
    <p class="err"></p>
    <div class="row"><button class="btn primary go">Join</button><button class="btn back">Back</button></div></div>`;
  const input = el.querySelector<HTMLInputElement>('.codein')!;
  input.focus();
  const go = () => {
    const code = normalizeRoomCode(input.value);
    if (!code) {
      el.querySelector('.err')!.textContent = 'Codes are 4 digits.';
      return;
    }
    void join(look, code);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  el.querySelector('.go')!.addEventListener('click', go);
  el.querySelector('.back')!.addEventListener('click', creator);
}

async function join(look: Look, code: string): Promise<void> {
  const el = lobbyShell();
  el.innerHTML = `<div class="panel"><h2>Joining ${code}…</h2></div>`;
  let s: GuestSession;
  try {
    s = await GuestSession.join(joinPeerRoom, code, look);
  } catch (e) {
    el.innerHTML = `<div class="panel"><h2>Couldn't join</h2><p>${(e as Error).message ?? 'Check the code and try again.'}</p>
      <div class="row"><button class="btn primary again">Try another code</button></div></div>`;
    el.querySelector('.again')!.addEventListener('click', () => joinPrompt(look));
    return;
  }
  session = s;
  const draw = () => {
    if (s.started) return;
    el.innerHTML = `<div class="panel"><h2>You're in! Game ${code}</h2><p>Waiting for the host to start…</p><ul class="roster">${rosterHtml(s)}</ul>
      <button class="btn small back">Leave</button></div>`;
    el.querySelector('.back')!.addEventListener('click', () => leave());
  };
  draw();
  s.onLooks = draw;
  s.onLost = (why) => {
    alert(why);
    leave();
  };
  if (s.started) game(s);
  else s.onStart = () => game(s);
  const keepAlive = () => {
    if (session !== s || s.started) return;
    s.update(0.1);
    setTimeout(keepAlive, 250);
  };
  keepAlive();
}

// ---------------------------------------------------------------- game

function game(s: Session): void {
  cancelAnimationFrame(menuRaf);
  clearUi();
  document.body.classList.add('playing');
  const v = getView();
  v.setLooks(s.looks);
  controls = new Controls();
  const h = new Hud(ui, v, () => s.myId, s.isHost);
  hud = h;
  h.setLooks(s.looks);
  if (controls.touch) controls.mount(ui);
  h.onRestart = () => s.restart();
  h.onLeave = () => leave();
  s.onLooks = () => {
    v.setLooks(s.looks);
    h.setLooks(s.looks);
  };
  let first = true;
  s.onSnapshot = (snap) => {
    const evs = v.apply(snap, first);
    first = false;
    h.events(evs);
    playEvents(evs, s.myId);
  };
  if (!s.isHost) s.onLost = (why) => {
    alert(why);
    leave();
  };
  let last = performance.now();
  const loop = (now: number) => {
    const dt = FIXED_STEP ? 1 / 30 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (controls) s.sendInput(controls.read());
    s.update(dt);
    v.render(dt);
    h.update(dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  // Try for full screen and landscape on phones; both are optional.
  if (controls.touch) {
    void document.documentElement.requestFullscreen?.().catch(() => {});
    void (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
  }
}

function leave(): void {
  cancelAnimationFrame(raf);
  session?.close();
  session = null;
  controls?.destroy();
  controls = null;
  hud?.destroy();
  hud = null;
  if (joinParam) history.replaceState(null, '', location.pathname);
  location.reload();
}

await Promise.all([document.fonts.load('700 20px Fredoka'), document.fonts.load('20px "Lilita One"')]).catch(() => {});
title();
