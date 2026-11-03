// A phone that joined a co-op game by QR code. It plays the Base (tilt to aim, fire button) or
// the Bomber (up, down, missile, nuke, dive, switch plane, grab, upgrade); the game itself runs
// on the host screen.
import '../style.css';
import { joinRoom, type Link } from './net';
import { PROTOCOL, type ClientMsg, type HostMsg, type Role, type LobbyPlayer } from './protocol';
import { cleanName, randomName } from './names';
import { BomberPad } from './pad';
import { Tilt } from '../input';

const store = {
  get(k: string) { try { return localStorage.getItem('skydef.coop.' + k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem('skydef.coop.' + k, v); } catch { } },
};

export function runController(code: string) {
  document.title = 'Sky Defender 2 · Co-op';
  document.body.innerHTML = `
  <div id="ctl">
    <header><b>Sky Defender 2</b><span>Co-op · room ${code}</span></header>
    <section data-s="status"><p class="lead" id="cStatus">Joining…</p><button class="primary" id="cRetry" hidden>Try again</button></section>
    <section data-s="lobby">
      <p class="fine">Your name</p>
      <div class="namebox"><b id="cName"></b><button class="ghost" id="cDice" aria-label="Random name">🎲 New name</button></div>
      <ul class="plist" id="cPlayers"></ul>
      <p class="lead" id="cRole"></p>
      <p class="fine">The host picks the roles and starts the game.</p>
    </section>
    <section data-s="base">
      <h2>You are the Base</h2>
      <p class="lead" id="cBaseLead">Turn your phone like a steering wheel to aim the gun on the big screen.</p>
      <button class="primary" id="cAim">Start aiming</button>
      <div id="cBaseLive" hidden>
        <p class="fine" id="cBaseInfo"></p>
        <div class="row"><button class="ghost" id="cRecal">Recenter</button><button class="ghost gold" id="cOpen" hidden>Open crate</button></div>
        <button id="cFire">FIRE</button>
      </div>
    </section>
    <section data-s="cards"><h2 id="cCardsTitle">Choose an upgrade</h2><div class="cards" id="cCards"></div><button class="ghost small" id="cCardsBack">Not now</button></section>
    <section data-s="bomber"><div id="cPad"></div></section>
    <section data-s="over"><h2 id="cOverTitle"></h2><div class="big" id="cOverScore"></div><p class="fine">Waiting for the host…</p></section>
    <div id="cPaused" hidden>Paused on the big screen</div>
  </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const show = (s: string) => document.querySelectorAll<HTMLElement>('#ctl section').forEach(el => el.classList.toggle('show', el.dataset.s === s));

  let id = store.get('id');
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('id', id); }
  let name = cleanName(store.get('name') || randomName());
  store.set('name', name);
  let link: Link | null = null, role: Role | null = null, aiming = false, screen = 'status';
  const go = (s: string) => { screen = s; show(s); };
  const send = (m: ClientMsg) => link?.send(m);

  function status(text: string, retry = false) { $('cStatus').textContent = text; $('cRetry').hidden = !retry; go('status'); }
  async function connect() {
    status('Joining…');
    try {
      const l = await joinRoom(code);
      link = l;
      l.onMessage(m => onMsg(m as HostMsg));
      l.onClose(() => { if (link === l) { link = null; status('Lost the connection to the big screen.', true); } });
      send({ t: 'hello', v: PROTOCOL, id: id!, name });
    } catch {
      status(`Could not join room ${code}. Check the code on the big screen and that it is still open.`, true);
    }
  }
  $('cRetry').addEventListener('click', connect);
  $('cName').textContent = name;
  $('cDice').addEventListener('click', () => {
    name = randomName(name); store.set('name', name);
    $('cName').textContent = name;
    send({ t: 'name', name });
  });

  function lobby(players: LobbyPlayer[], you: string) {
    const roleName = (r: Role | null) => r === 'base' ? 'Base' : r === 'bomber' ? 'Bomber' : '…';
    $('cPlayers').innerHTML = players.map(p => `<li${p.id === you ? ' class="me"' : ''}><span>${p.name}${p.id === you ? ' (you)' : ''}</span><b>${roleName(p.role)}</b></li>`).join('');
    const me = players.find(p => p.id === you);
    $('cRole').textContent = me?.role === 'base' ? 'You will defend the base.' : me?.role === 'bomber' ? 'You will fly the Bomber.' : '';
  }

  // ---- Bomber ----
  const pad = new BomberPad({ hold: (dir, on) => send({ t: 'hold', dir, on }), act: a => { send({ t: 'act', a }); buzz(12); } });
  $('cPad').appendChild(pad.el);
  const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { } };

  // ---- Base ----
  $('cAim').addEventListener('click', async () => {
    const r = await Tilt.start();
    if (r !== 'ok') { $('cBaseLead').textContent = r === 'denied' ? 'Motion access was turned down. Allow it (you may need to reload) and try again.' : 'This phone has no motion sensors, so it cannot aim.'; return; }
    Tilt.calibrate();
    aiming = true;
    $('cAim').hidden = true; $('cBaseLive').hidden = false;
    $('cBaseLead').textContent = Tilt.keyboard ? 'Arrow keys aim, space bar fires.' : 'Turn your phone like a steering wheel to aim.';
  });
  $('cRecal').addEventListener('click', () => Tilt.calibrate());
  const fire = $('cFire');
  const fireOn = (e: Event) => { e.preventDefault(); fire.classList.add('down'); send({ t: 'fire', on: true }); buzz(8); };
  const fireOff = () => { if (!fire.classList.contains('down')) return; fire.classList.remove('down'); send({ t: 'fire', on: false }); };
  fire.addEventListener('pointerdown', fireOn);
  fire.addEventListener('pointerup', fireOff); fire.addEventListener('pointercancel', fireOff); fire.addEventListener('pointerleave', fireOff);
  addEventListener('keydown', e => { if (e.code === 'Space' && role === 'base' && !e.repeat) { send({ t: 'fire', on: true }); e.preventDefault(); } });
  addEventListener('keyup', e => { if (e.code === 'Space' && role === 'base') send({ t: 'fire', on: false }); });
  $('cOpen').addEventListener('click', () => send({ t: 'open' }));
  $('cCardsBack').addEventListener('click', () => { send({ t: 'pick', id: null }); go('base'); });

  // the Bomber can play from a computer's keyboard too
  const KEYS: Record<string, ClientMsg> = { s: { t: 'act', a: 'switch' }, m: { t: 'act', a: 'missile' }, n: { t: 'act', a: 'nuke' }, d: { t: 'act', a: 'dive' }, g: { t: 'act', a: 'grab' }, u: { t: 'act', a: 'use' } };
  addEventListener('keydown', e => {
    if (role !== 'bomber' || e.repeat) return;
    if (e.key === 'ArrowUp' || e.key === 'w') send({ t: 'hold', dir: 'up', on: true });
    else if (e.key === 'ArrowDown') send({ t: 'hold', dir: 'down', on: true });
    else if (KEYS[e.key.toLowerCase()]) send(KEYS[e.key.toLowerCase()]);
  });
  addEventListener('keyup', e => {
    if (role !== 'bomber') return;
    if (e.key === 'ArrowUp' || e.key === 'w') send({ t: 'hold', dir: 'up', on: false });
    if (e.key === 'ArrowDown') send({ t: 'hold', dir: 'down', on: false });
  });

  let wasAlive = true;
  function onMsg(m: HostMsg) {
    switch (m.t) {
      case 'old': status('The big screen runs a newer version. Reload this page.', true); break;
      case 'full': status('This game already has two players.', true); break;
      case 'lobby': lobby(m.players, m.you); if (!m.playing) { role = null; go('lobby'); } break;
      case 'start':
        role = m.role;
        go(m.role);
        break;
      case 'bomber':
        if (screen !== 'bomber') go('bomber');
        pad.update(m.v);
        if (wasAlive && !m.v.alive) buzz(300);
        wasAlive = m.v.alive;
        break;
      case 'base':
        $('cOpen').hidden = !m.crate;
        $('cBaseInfo').textContent = `Wave ${m.wave} · ${m.score.toLocaleString('en-US')} points${m.weapon ? ' · ' + m.weapon : ''}`;
        break;
      case 'cards': {
        $('cCardsTitle').textContent = m.title;
        const list = $('cCards');
        list.innerHTML = '';
        for (const c of m.cards) {
          const b = document.createElement('button');
          b.className = 'card';
          b.style.setProperty('--weapon', c.color);
          b.innerHTML = `<span class="kind">${c.kind}</span><b>${c.name}</b><span class="desc">${c.desc}</span>`;
          b.addEventListener('click', () => { send({ t: 'pick', id: c.id }); go('base'); });
          list.appendChild(b);
        }
        go('cards');
        break;
      }
      case 'paused': $('cPaused').hidden = !m.on; break;
      case 'over':
        $('cOverTitle').textContent = m.title;
        $('cOverScore').textContent = `${m.score.toLocaleString('en-US')} · wave ${m.wave}`;
        go('over');
        break;
    }
  }

  // the Base's aim goes to the big screen about 30 times a second
  let last = performance.now(), sent = 0, lastR = NaN;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (role !== 'base' || !aiming) return;
    const r = Tilt.update(now / 1000, dt);
    if (now - sent > 33 && (Math.abs(r - lastR) > .001 || now - sent > 250)) { sent = now; lastR = r; send({ t: 'tilt', r }); }
  }
  requestAnimationFrame(frame);
  show('status');
  void connect();
}
