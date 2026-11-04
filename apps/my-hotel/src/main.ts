import './style.css';
import { Controls } from './input';
import { isValidCode, normalizeCode } from './net/codes';
import type { Guest, OnlineHost } from './net/online';
import { Renderer } from './render/renderer';
import { loadHotel, saveHotel } from './save/save';
import { players, setTwoPlayer, tick, type Hotel, type HotelEvent, type MapId } from './sim/hotel';
import { Hud } from './ui/hud';
import type { InviteCard } from './ui/invite';
import { showStart } from './ui/start';

const STEP = 1 / 60;
const STILL = { x: 0, z: 0 };

/** Canvas, renderer, controls and the "+coins" pop-ups shared by host and guest screens. */
function makeScreen(first: Hotel) {
  const canvas = document.createElement('canvas');
  canvas.className = 'game';
  document.body.appendChild(canvas);
  const renderer = new Renderer(canvas, first);
  const controls = new Controls(canvas);
  const resize = () => renderer.resize(innerWidth, innerHeight);
  resize();
  addEventListener('resize', resize);
  const popAt = (h: Hotel, text: string, by = 0) => {
    const who = players(h)[by] ?? h.player;
    const p = renderer.project(who.pos.x, 2.6, who.pos.z);
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  };
  const dispose = () => {
    removeEventListener('resize', resize);
    controls.dispose();
    renderer.dispose();
    canvas.remove();
  };
  return { renderer, controls, popAt, dispose };
}

function play(map: MapId, twoPlayer: boolean) {
  const hotel: Hotel = loadHotel(map);
  setTwoPlayer(hotel, twoPlayer);
  const screen = makeScreen(hotel);
  const { renderer, controls } = screen;
  let running = true;

  // the online code (Firebase, QR codes) only loads once someone opens the invite
  let online: OnlineHost | null = null;
  let invite: InviteCard | null = null;
  const openInvite = async () => {
    if (!invite) {
      const [{ OnlineHost }, { InviteCard }] = await Promise.all([import('./net/online'), import('./ui/invite')]);
      if (!running) return;
      online = new OnlineHost(() => hotel, {
        onJoined: () => {
          renderer.follow = 0;
          hud.toast('📱 Player 2 joined!', 'They play on their own device.');
          invite?.refresh();
        },
        onLeft: () => {
          renderer.follow = 'all';
          hud.toast('📱 Player 2 left', 'You can invite them again any time.');
          invite?.refresh();
        },
      });
      invite = new InviteCard(online);
    }
    await invite.show();
  };

  const save = () => saveHotel(hotel);
  const quit = () => {
    running = false;
    save();
    online?.close();
    invite?.hide();
    clearInterval(saver);
    document.removeEventListener('visibilitychange', save);
    removeEventListener('pagehide', save);
    hud.dispose();
    screen.dispose();
    start();
  };
  const hud = new Hud(hotel, quit, { onInvite: () => void openInvite() });

  const saver = setInterval(save, 3000);
  document.addEventListener('visibilitychange', save);
  addEventListener('pagehide', save);

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    // with a friend on another device, this keyboard is all player 1's
    const remote = online?.connected ?? false;
    const local2 = !!hotel.player2 && !remote;
    const input = controls.read(local2 ? 'p1' : 'all');
    const input2 = local2 ? controls.read('p2') : STILL;
    while (acc >= STEP) {
      online?.applyRemote();
      const ev = tick(hotel, STEP, input, input2);
      online?.applyRemote();
      hud.events(ev, (text, by) => screen.popAt(hotel, text, by));
      acc -= STEP;
    }
    online?.update(now);
    hud.update(hotel, controls.used);
    renderer.render(hotel, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // for checking the game from a script
  (window as unknown as { __hotel: Hotel }).__hotel = hotel;
}

/** A message card with one button, used while joining and when the link drops. */
function notice(title: string, body: string, button?: { label: string; onClick: () => void }) {
  const el = document.createElement('div');
  el.className = 'notice';
  el.innerHTML = `<div class="card"><h2></h2><p></p></div>`;
  el.querySelector('h2')!.textContent = title;
  el.querySelector('p')!.textContent = body;
  if (button) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = button.label;
    b.addEventListener('click', () => {
      el.remove();
      button.onClick();
    });
    el.querySelector('.card')!.appendChild(b);
  }
  document.body.appendChild(el);
  return el;
}

/** Join someone else's hotel as player 2. Their device runs the hotel; this one shows it. */
function join(code: string) {
  history.replaceState(null, '', `${location.pathname}?join=${code}`);
  const joining = notice(`Joining ${code}…`, 'Connecting to the other device.');
  let hotel: Hotel | null = null;
  let guest: Guest | null = null;
  let game: { stop: () => void } | null = null;
  let ended = false;

  const leave = (title?: string, body?: string) => {
    if (ended) return;
    ended = true;
    guest?.close();
    game?.stop();
    joining.remove();
    history.replaceState(null, '', location.pathname);
    if (title) notice(title, body ?? '', { label: 'OK', onClick: start });
    else start();
  };

  const begin = (first: Hotel) => {
    const screen = makeScreen(first);
    const { renderer, controls } = screen;
    renderer.follow = 1;
    const hud = new Hud(first, () => leave(), { guest: true });
    hud.toast('📱 You joined!', "You're player 2. Walk with the arrows or drag on the screen.");
    let running = true;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      if (!running || !hotel) return;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      const input = controls.read('all');
      const ev: HotelEvent[] = [];
      // play on between snapshots so everything keeps moving smoothly
      while (acc >= STEP) {
        ev.push(...tick(hotel, STEP, STILL, input));
        acc -= STEP;
      }
      hud.events(
        ev.filter((e) => e.kind !== 'review' && e.kind !== 'levelUp'),
        (text, by) => screen.popAt(hotel!, text, by),
      );
      if (hotel.player2) guest?.sendMe(hotel.player2);
      hud.update(hotel, controls.used);
      renderer.render(hotel, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    game = {
      stop: () => {
        running = false;
        hud.dispose();
        screen.dispose();
      },
    };
    (window as unknown as { __hotel: () => Hotel | null }).__hotel = () => hotel;
  };

  const onState = (h: Hotel) => {
    if (ended) return;
    // this device is in charge of where player 2 is
    if (hotel?.player2 && h.player2) h.player2 = hotel.player2;
    const firstState = !hotel;
    hotel = h;
    if (firstState) {
      joining.remove();
      begin(h);
    }
  };

  import('./net/online')
    .then(({ joinOnline }) =>
      joinOnline(code, onState, () => leave('Disconnected', 'The other device closed the game or lost its connection.')),
    )
    .then((g) => {
      if (ended) g.close();
      else guest = g;
    })
    .catch((err) => {
      console.error(err);
      leave("Couldn't join", `Make sure the other device has the 📱 Invite card open with the code ${code}, and both are online.`);
    });
}

function start() {
  showStart(play, join);
}

const code = normalizeCode(new URLSearchParams(location.search).get('join') ?? '');
if (isValidCode(code)) join(code);
else start();
