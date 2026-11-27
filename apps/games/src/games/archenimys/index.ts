// Archenimys: climb a 50-stage tower as an archer. Every stage has monsters (Boom Pots, Sharp Cacti,
// Acid Stews and Snapping Crabs), every 5th stage has a boss, and the stage before each boss has a
// loot chest and a health chest. Level up to pick 1 of 3 upgrades. Up to 4 players: each one is an
// archer or a monster.
import './style.css';
import type { GameModule } from '../types';
import {
  BOSSES, MONSTERS, MONSTER_KINDS, PLAYER_COLORS, QUALITIES, Q_COLORS, STAGES, UPGRADES, UP_IDS,
  isBossStage, upValue, xpNeed, type MonsterKind, type Offer,
} from './data';
import { Game, moveSelf, newPlayer, newState, type Act, type Fx, type Player, type Role, type State } from './game';
import { GuestSession, HostSession } from './mp';
import { listHosts, type HostInfo } from './net';
import { Renderer, archerPicture, monsterPicture } from './render';
import { isMuted, setMuted, sfx } from './audio';

const NAME_KEY = 'archenimys-name';
const BEST_KEY = 'archenimys-best';
const MUTE_KEY = 'archenimys-muted';

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const read = (k: string, d = '') => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

const HELP = `
  <h3>How to play</h3>
  <p>You're an archer climbing to the top of a tower: 50 stages. Beat every monster on a stage and the stairs at the top open. Walk onto them to go up.</p>
  <p><b>WASD</b> or arrows: move · <b>Mouse</b>: aim · <b>Hold click</b> or <b>Space</b>: shoot · <b>Esc</b>: menu · <b>Shift+Esc</b>: host a game right away</p>
  <p>Every 5 stages there's a boss. Before each boss you'll find a <b>loot chest</b> (a lucky upgrade) and a <b>health chest</b> (heal to full, or +½ health and +25 max health).</p>
  <p>Beating monsters levels you up. Pick 1 of 3 upgrades: Common, Uncommon, Rare, Epic, Legendary or Mythical. They last the whole climb and stack. You can't be hurt while you choose.</p>
  <ul class="ar-mons">
    ${MONSTER_KINDS.map((k) => `<li><img src="${monsterPicture(k, 56)}" alt=""><span><b>${MONSTERS[k].name}</b> ${MONSTERS[k].blurb}</span></li>`).join('')}
  </ul>
  <p><b>Play together</b> (up to 4): each player picks archer or monster. Monsters attack the archers with click or Space; <b>Q</b> or <b>1</b>–<b>4</b> switches monster. A monster that gets knocked out comes back 5 seconds later as a different monster.</p>
  <p>On a phone: drag on the left to move; the button on the right shoots at the closest monster.</p>`;

type Screen = 'title' | 'join' | 'lobby' | 'play' | 'help';

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'ar';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="ar-canvas"></canvas>
      <div class="ar-hud" hidden>
        <div class="ar-tl">
          <div class="ar-hp"><i></i><span></span></div>
          <div class="ar-xp"><i></i><span></span></div>
          <div class="ar-ups"></div>
        </div>
        <div class="ar-top">
          <div class="ar-stage"></div>
          <div class="ar-tower"><i></i></div>
          <div class="ar-boss" hidden><b></b><div class="ar-bossbar"><i></i></div></div>
        </div>
        <div class="ar-tr">
          <button data-a="mute" title="Sound"></button>
          <button data-a="menu" title="Menu (Esc)">☰</button>
        </div>
        <div class="ar-msg" hidden></div>
        <div class="ar-mon" hidden></div>
        <div class="ar-team"></div>
      </div>
      <div class="ar-touch" hidden>
        <div class="ar-stick"><div class="ar-knob"></div></div>
        <div class="ar-tbtns">
          <button data-t="switch" class="ar-tsw" hidden>🔄</button>
          <button data-t="fire" class="ar-tfire">🏹</button>
        </div>
      </div>
      <div class="ar-toast" hidden></div>
      <div class="ar-banner" hidden></div>
      <div class="ar-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const hud = $('.ar-hud'), hpEl = $('.ar-hp'), xpEl = $('.ar-xp'), upsEl = $('.ar-ups'), stageEl = $('.ar-stage');
    const towerEl = $('.ar-tower'), bossEl = $('.ar-boss'), msgEl = $('.ar-msg'), monEl = $('.ar-mon'), teamEl = $('.ar-team');
    const toastEl = $('.ar-toast'), bannerEl = $('.ar-banner'), ui = $('.ar-ui'), touchEl = $('.ar-touch');
    const muteBtn = $<HTMLButtonElement>('[data-a="mute"]');
    const R = new Renderer(cv);
    const touchMode = !!window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    setMuted(read(MUTE_KEY) === '1');
    const syncMute = () => (muteBtn.textContent = isMuted() ? '🔇' : '🔊');
    syncMute();

    let myName = read(NAME_KEY, 'Archer');
    let screen: Screen = 'title';
    let g: Game | null = null; // solo or host
    let host: HostSession | null = null;
    let guest: GuestSession | null = null;
    let paused = false;
    let menuOpen = false;
    let myId = 'me';
    // what you see: the host's own game, or the latest snapshot from the host
    const view = (): State | null => (guest ? guest.state : g?.s ?? null);
    const me = (): Player | undefined => view()?.players.find((p) => p.id === myId);
    const act = (a: Act) => {
      if (guest) guest.act(a);
      else g?.act(myId, a);
    };

    // ---------- toasts and banners ----------
    let toastTimer = 0;
    const toast = (t: string, ms = 2600) => {
      toastEl.textContent = t;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), ms);
    };
    let bannerTimer = 0;
    const banner = (big: string, small = '') => {
      bannerEl.innerHTML = `<b>${esc(big)}</b>${small ? `<span>${esc(small)}</span>` : ''}`;
      bannerEl.hidden = false;
      bannerEl.style.animation = 'none';
      void bannerEl.offsetWidth;
      bannerEl.style.animation = '';
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => (bannerEl.hidden = true), 2400);
    };

    // ---------- screens ----------
    let hostsTimer = 0;
    const stopHostSearch = () => {
      clearInterval(hostsTimer);
      hostsTimer = 0;
    };

    function show(sc: Screen) {
      screen = sc;
      stopHostSearch();
      hud.hidden = sc !== 'play';
      touchEl.hidden = !(sc === 'play' && touchMode);
      if (sc === 'title') titleScreen();
      else if (sc === 'join') joinScreen();
      else if (sc === 'lobby') lobbyScreen();
      else if (sc === 'help') {
        ui.innerHTML = `<div class="ar-panel ar-help">${HELP}<div class="ar-row"><button class="ar-btn" data-b="back">Back</button></div></div>`;
        ui.querySelector('[data-b="back"]')!.addEventListener('click', () => show('title'));
      } else ui.innerHTML = '';
      el.focus();
    }

    function titleScreen() {
      const best = Number(read(BEST_KEY, '0'));
      ui.innerHTML = `<div class="ar-panel ar-title">
        <h1>Archenimys</h1>
        <p class="ar-sub">Climb the tower. 50 stages. Don't get pinched.</p>
        <div class="ar-pics">${['pot', 'cactus'].map((k) => `<img src="${monsterPicture(k as MonsterKind, 80)}" alt="">`).join('')}<img src="${archerPicture(PLAYER_COLORS[0], 96)}" alt="" class="ar-big">${['stew', 'crab'].map((k) => `<img src="${monsterPicture(k as MonsterKind, 80)}" alt="">`).join('')}</div>
        <label class="ar-name">Your name <input maxlength="16" value="${esc(myName)}"></label>
        <div class="ar-col">
          <button class="ar-btn ar-go" data-b="solo">▶ Play</button>
          <button class="ar-btn" data-b="host">👥 Host a game <small>Shift+Esc</small></button>
          <button class="ar-btn" data-b="join">🔍 Join a game</button>
          <button class="ar-btn" data-b="help">❓ How to play</button>
          <button class="ar-btn ar-dim" data-b="exit">← Back to games</button>
        </div>
        ${best ? `<p class="ar-best">Best climb: stage ${best} of ${STAGES}</p>` : ''}
      </div>`;
      const inp = ui.querySelector('input')!;
      inp.addEventListener('input', () => {
        myName = inp.value.trim().slice(0, 16) || 'Archer';
        write(NAME_KEY, myName);
      });
      inp.addEventListener('keydown', (e) => {
        // typing a name shouldn't move anyone, but Shift+Esc still hosts
        if (e.key !== 'Escape') e.stopPropagation();
      });
      ui.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('click');
          const w = b.dataset.b;
          if (w === 'solo') startSolo();
          else if (w === 'host') void startHost();
          else if (w === 'join') show('join');
          else if (w === 'help') show('help');
          else onExit();
        }),
      );
    }

    function joinScreen() {
      ui.innerHTML = `<div class="ar-panel ar-join">
        <h2>Join a game</h2>
        <p class="ar-searching"><span class="ar-spin"></span> Searching for hosts…</p>
        <div class="ar-hosts"></div>
        <div class="ar-row"><button class="ar-btn ar-dim" data-b="back">Back</button></div>
      </div>`;
      ui.querySelector('[data-b="back"]')!.addEventListener('click', () => show('title'));
      const list = ui.querySelector<HTMLElement>('.ar-hosts')!;
      const status = ui.querySelector<HTMLElement>('.ar-searching')!;
      const refresh = async () => {
        let hosts: HostInfo[] = [];
        try {
          hosts = await listHosts();
        } catch (err) {
          console.warn(err);
          status.innerHTML = `Couldn't search for hosts. Check the internet connection.`;
          return;
        }
        if (screen !== 'join') return;
        status.innerHTML = `<span class="ar-spin"></span> Searching for hosts… ${hosts.length ? `found ${hosts.length}` : ''}`;
        list.innerHTML = hosts.length
          ? hosts.map((h) => `<button class="ar-host" data-id="${esc(h.id)}" ${h.players >= 4 ? 'disabled' : ''}><b>${esc(h.name)}</b><span>${esc(h.world)} · ${h.players}/4 players</span></button>`).join('')
          : `<p class="ar-dimtext">No games yet. Ask a friend to press Host a game (or Shift+Esc).</p>`;
        list.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((b) => b.addEventListener('click', () => void joinGame(b.dataset.id!)));
      };
      void refresh();
      hostsTimer = window.setInterval(() => void refresh(), 3000);
    }

    function lobbyScreen() {
      ui.innerHTML = `<div class="ar-panel ar-lobby"><h2>Getting ready</h2><div class="ar-lobbybody"></div></div>`;
      renderLobby();
    }

    let lobbyKey = '';
    function renderLobby() {
      const s = view();
      const body = ui.querySelector<HTMLElement>('.ar-lobbybody');
      if (!s || !body) return;
      const mine = me();
      const key = JSON.stringify([s.players.map((p) => [p.id, p.name, p.role, p.kind, p.slot]), !!guest, myId]);
      if (key === lobbyKey) return;
      lobbyKey = key;
      const archers = s.players.filter((p) => p.role === 'archer').length;
      body.innerHTML = `
        <div class="ar-players">${s.players
          .map((p) => {
            const pic = p.role === 'monster' ? monsterPicture(p.kind, 48) : archerPicture(PLAYER_COLORS[p.slot], 48);
            return `<div class="ar-pl" style="--c:${PLAYER_COLORS[p.slot]}"><img src="${pic}" alt=""><b>${p.slot + 1}. ${esc(p.name)}${p.id === myId ? ' (you)' : ''}</b><span>${p.role === 'archer' ? 'Archer' : p.role === 'monster' ? MONSTERS[p.kind].name : 'Choosing…'}</span></div>`;
          })
          .join('')}</div>
        ${rolePicker(mine)}
        <div class="ar-row">
          ${guest ? `<p class="ar-dimtext">Waiting for the host to start…</p>` : `<button class="ar-btn ar-go" data-b="start" ${archers ? '' : 'disabled'}>▶ Start the climb</button>`}
          <button class="ar-btn ar-dim" data-b="leave">Leave</button>
        </div>
        ${!guest && !archers ? `<p class="ar-dimtext">Someone has to be an archer.</p>` : ''}
        ${!guest ? `<p class="ar-dimtext">Friends find this game under Join a game.</p>` : ''}`;
      wireRolePicker(body);
      body.querySelector('[data-b="start"]')?.addEventListener('click', () => {
        if (!g) return;
        g.start();
        host?.touch();
        show('play');
      });
      body.querySelector('[data-b="leave"]')!.addEventListener('click', () => void leave());
    }

    function rolePicker(p: Player | undefined) {
      const sel = (r: Role, k?: MonsterKind) => (p?.role === r && (!k || p.kind === k) ? ' sel' : '');
      return `<div class="ar-roles">
        <button class="ar-role${sel('archer')}" data-role="archer"><img src="${archerPicture(PLAYER_COLORS[p?.slot ?? 0], 64)}" alt=""><b>Archer</b><span>Climb the tower</span></button>
        ${MONSTER_KINDS.map((k) => `<button class="ar-role ar-mrole${sel('monster', k)}" data-role="monster" data-kind="${k}"><img src="${monsterPicture(k, 64)}" alt=""><b>${MONSTERS[k].name}</b><span>Monster</span></button>`).join('')}
      </div>`;
    }
    function wireRolePicker(box: HTMLElement) {
      box.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('click');
          act({ t: 'role', role: b.dataset.role as Role, kind: b.dataset.kind as MonsterKind | undefined });
          lobbyKey = '';
          if (g) setTimeout(renderLobby, 0);
        }),
      );
    }

    // ---------- starting and leaving ----------
    function freshGame() {
      g = new Game();
      g.onStage = (st) => {
        host?.touch();
        void st;
      };
      myId = 'me';
      g.addPlayer(myId, myName);
      return g;
    }

    function startSolo() {
      const gm = freshGame();
      gm.act(myId, { t: 'role', role: 'archer' });
      gm.start();
      show('play');
    }

    async function startHost() {
      if (guest) return;
      if (!g || screen === 'title' || screen === 'join' || screen === 'help') {
        const gm = freshGame();
        gm.act(myId, { t: 'role', role: 'archer' });
      }
      if (host) return;
      const gm = g!;
      host = new HostSession(gm, () => myName);
      host.onJoin = (n) => {
        toast(`${n} joined!`);
        lobbyKey = '';
      };
      host.onLeave = (n) => {
        toast(`${n} left.`);
        lobbyKey = '';
      };
      try {
        // the host's own id is their sign-in id, the same one guests see
        await host.open();
        const uid = host.host.uid;
        const mine = gm.player(myId);
        if (mine) mine.id = uid;
        gm.inputs.delete(myId);
        myId = uid;
      } catch (err) {
        console.warn(err);
        toast("Couldn't open the game for friends. Check the internet connection.");
        host = null;
        return;
      }
      if (gm.s.phase === 'lobby') show('lobby');
      else {
        paused = false;
        closeMenu();
        toast('Your game is open! Friends can find it under Join a game.', 4000);
      }
    }

    async function joinGame(hostId: string) {
      stopHostSearch();
      ui.innerHTML = `<div class="ar-panel"><p><span class="ar-spin"></span> Joining…</p></div>`;
      const gs = new GuestSession();
      try {
        await gs.join(hostId, myName);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not join.');
        show('join');
        return;
      }
      guest = gs;
      g = null;
      gs.onLost = (why) => {
        if (guest !== gs) return;
        guest.close();
        guest = null;
        toast(why, 4000);
        show('title');
      };
      gs.onState = (s, fx) => {
        if (gs.myId) myId = gs.myId;
        for (const f of fx) handleFx(f);
        if (s.phase === 'lobby' && screen !== 'lobby') show('lobby');
        else if (s.phase !== 'lobby' && screen === 'lobby') show('play');
        if (screen === 'lobby') renderLobby();
      };
      show('lobby');
    }

    async function leave() {
      closeMenu();
      paused = false;
      if (host) {
        const h = host;
        host = null;
        await h.close();
      }
      if (guest) {
        guest.close();
        guest = null;
      }
      g = null;
      myId = 'me';
      show('title');
    }

    function backToLobby() {
      if (!g) return;
      const old = g.s.players;
      g.s = newState();
      g.s.players = old.map((p) => ({ ...newPlayer(p.id, p.name, p.slot), role: p.role, kind: p.kind }));
      host?.touch();
      if (host) show('lobby');
      else startSolo();
    }

    // ---------- menu ----------
    function openMenu() {
      if (screen !== 'play') return;
      menuOpen = true;
      if (!host && !guest) paused = true;
      const s = view();
      ui.innerHTML = `<div class="ar-panel ar-menu">
        <h2>${paused ? 'Paused' : 'Menu'}</h2>
        <div class="ar-col">
          <button class="ar-btn ar-go" data-b="resume">Resume</button>
          ${!guest && !host ? `<button class="ar-btn" data-b="host">👥 Let friends join <small>Shift+Esc</small></button>` : ''}
          ${host ? `<p class="ar-dimtext">Your game is open: friends find it under Join a game (${host.count}/4 players).</p>` : ''}
          ${me()?.role === 'monster' || (s && s.players.length > 1) ? `<button class="ar-btn" data-b="role">Change archer / monster</button>` : ''}
          <button class="ar-btn" data-b="help">How to play</button>
          <button class="ar-btn ar-dim" data-b="quit">${guest ? 'Leave game' : 'Quit to title'}</button>
        </div>
      </div>`;
      ui.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('click');
          const w = b.dataset.b;
          if (w === 'resume') closeMenu();
          else if (w === 'host') void startHost();
          else if (w === 'role') {
            ui.innerHTML = `<div class="ar-panel"><h2>Be an archer or a monster</h2>${rolePicker(me())}<div class="ar-row"><button class="ar-btn ar-dim" data-b="back">Back</button></div></div>`;
            wireRolePicker(ui);
            ui.querySelectorAll('[data-role]').forEach((x) => x.addEventListener('click', () => closeMenu()));
            ui.querySelector('[data-b="back"]')!.addEventListener('click', () => openMenu());
          } else if (w === 'help') {
            ui.innerHTML = `<div class="ar-panel ar-help">${HELP}<div class="ar-row"><button class="ar-btn" data-b="back">Back</button></div></div>`;
            ui.querySelector('[data-b="back"]')!.addEventListener('click', () => openMenu());
          } else void leave();
        }),
      );
    }
    function closeMenu() {
      menuOpen = false;
      paused = false;
      ui.innerHTML = '';
      overlayKey = '';
      el.focus();
    }

    // ---------- overlays during play (upgrades, health chest, joining, game over) ----------
    let overlayKey = '';
    let revealStart = 0;
    function syncOverlay(s: State) {
      if (menuOpen || screen !== 'play') return;
      const p = me();
      let key = 'none';
      if (s.phase === 'over' || s.phase === 'won') key = `end:${s.phase}`;
      else if (!p) key = 'wait';
      else if (!p.role) key = 'role';
      else if (p.offers) key = `offers:${JSON.stringify(p.offers)}`;
      else if (p.healChoice) key = 'heal';
      if (key === overlayKey) return;
      overlayKey = key;
      if (key === 'none' || key === 'wait') {
        ui.innerHTML = '';
        return;
      }
      if (key === 'role') {
        ui.innerHTML = `<div class="ar-panel"><h2>Jump in as an archer or a monster</h2>${rolePicker(p)}</div>`;
        wireRolePicker(ui);
        return;
      }
      if (key === 'heal') {
        sfx('chest');
        ui.innerHTML = `<div class="ar-panel ar-chest">
          <h2>❤️ Health chest</h2><p class="ar-dimtext">Pick one. You can't be hurt while choosing.</p>
          <div class="ar-cards">
            <button class="ar-card" data-h="0" style="--q:#5aff7a"><em>1</em><i>❤️</i><b>Heal</b><span>Heals to full health</span></button>
            <button class="ar-card" data-h="1" style="--q:#ff5a7a"><em>2</em><i>💗</i><b>+ Health</b><span>+½ full health<br>+25 max health</span></button>
          </div></div>`;
        ui.querySelectorAll<HTMLButtonElement>('[data-h]').forEach((b) => b.addEventListener('click', () => pickHeal(Number(b.dataset.h) as 0 | 1)));
        return;
      }
      if (key.startsWith('offers')) {
        revealStart = performance.now();
        sfx(p!.offerLucky ? 'chest' : 'level');
        ui.innerHTML = `<div class="ar-panel ar-level">
          <h2>${p!.offerLucky ? '🎁 Loot chest!' : `⭐ Level ${p!.level}!`} Pick an upgrade</h2>
          <p class="ar-dimtext">Upgrades last the whole climb. You can't be hurt while choosing.</p>
          <div class="ar-cards">${p!.offers!.map((o, i) => offerCard(o, i, p!)).join('')}</div>
          ${p!.queue.length ? `<p class="ar-dimtext">${p!.queue.length} more to pick after this one</p>` : ''}
        </div>`;
        ui.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => pickOffer(Number(b.dataset.i))));
        return;
      }
      if (key.startsWith('end')) {
        const won = s.phase === 'won';
        const best = Math.max(Number(read(BEST_KEY, '0')), won ? STAGES : s.stage);
        write(BEST_KEY, String(best));
        const archers = s.players.filter((x) => x.role === 'archer');
        ui.innerHTML = `<div class="ar-panel ar-end">
          <h1>${won ? '🏆 You reached the top!' : 'The tower wins this time'}</h1>
          <p>${won ? `All ${STAGES} stages climbed. The Archenemy is beaten!` : `You made it to stage ${s.stage} of ${STAGES}.`}</p>
          <div class="ar-endstats">${archers.map((a) => `<div style="--c:${PLAYER_COLORS[a.slot]}"><b>${esc(a.name)}</b><span>Level ${a.level} · ${a.kills} monsters</span></div>`).join('')}</div>
          <p class="ar-best">Best climb: stage ${best}</p>
          <div class="ar-row">
            ${guest ? '<p class="ar-dimtext">Waiting for the host…</p>' : `<button class="ar-btn ar-go" data-b="again">Climb again</button>`}
            <button class="ar-btn ar-dim" data-b="quit">${guest ? 'Leave' : 'Title'}</button>
          </div></div>`;
        ui.querySelector('[data-b="again"]')?.addEventListener('click', () => backToLobby());
        ui.querySelector('[data-b="quit"]')!.addEventListener('click', () => void leave());
      }
    }

    const REVEAL_STEP = 160; // ms per quality word while the card counts up
    function offerCard(o: Offer, i: number, p: Player) {
      const d = UPGRADES[o.up];
      const now = p.ups[o.up] ?? 0;
      const v = upValue(o);
      const after = Math.round((now + v) * 100) / 100;
      return `<button class="ar-card ar-offer" data-i="${i}" data-q="${o.q}" style="--q:${Q_COLORS[0]}">
        <em>${i + 1}</em>
        <u class="ar-q">${QUALITIES[0]}</u>
        <i>${d.icon}</i><b>${d.name}</b><span>${d.text(v)}</span>
        ${now ? `<small>Now ${d.text(now).replace(/^.*?(\d+(\.\d+)?)/, '$1')} → ${after}</small>` : ''}
      </button>`;
    }
    /** quality words count up: Common, then Uncommon, then Rare... until they land */
    function animateReveal() {
      const cards = ui.querySelectorAll<HTMLElement>('.ar-offer');
      if (!cards.length) return;
      const step = Math.floor((performance.now() - revealStart) / REVEAL_STEP);
      cards.forEach((c, i) => {
        const q = Number(c.dataset.q);
        const shown = Math.min(q, Math.max(0, step - i));
        const u = c.querySelector<HTMLElement>('.ar-q')!;
        if (u.textContent !== QUALITIES[shown]) {
          u.textContent = QUALITIES[shown];
          c.style.setProperty('--q', Q_COLORS[shown]);
          sfx('reveal');
          if (shown === q && q >= 3) c.classList.add('ar-shine');
        }
        c.classList.toggle('ar-ready', shown === q && step - i >= q);
      });
    }
    const revealDone = () => {
      const p = me();
      if (!p?.offers) return false;
      const most = Math.max(...p.offers.map((o, i) => o.q + i));
      return performance.now() - revealStart > (most + 1) * REVEAL_STEP;
    };
    function pickOffer(i: number) {
      if (!revealDone()) return;
      sfx('upgrade');
      act({ t: 'pick', i });
      overlayKey = '';
      ui.innerHTML = '';
    }
    function pickHeal(opt: 0 | 1) {
      sfx('heal');
      act({ t: 'heal', opt });
      overlayKey = '';
      ui.innerHTML = '';
    }

    // ---------- input ----------
    const keys = new Set<string>();
    let mouse = { x: 0, y: 0, down: false };
    let touchFire = false;
    const stick = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault();
        // Shift+Esc: host right away
        if (!host && !guest) void startHost();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (screen === 'play') {
          if (menuOpen) closeMenu();
          else openMenu();
        } else if (screen === 'join' || screen === 'help') show('title');
        return;
      }
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (screen !== 'play' || menuOpen) return;
      const p = me();
      if (!p) return;
      if (p.offers && ['1', '2', '3'].includes(k)) pickOffer(Number(k) - 1);
      else if (p.healChoice && ['1', '2'].includes(k)) pickHeal((Number(k) - 1) as 0 | 1);
      else if (p.role === 'monster' && !p.dead) {
        if (k === 'q') act({ t: 'switch' });
        else if (['1', '2', '3', '4'].includes(k)) act({ t: 'switch', kind: MONSTER_KINDS[Number(k) - 1] });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => {
      keys.clear();
      mouse.down = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') mouse = { ...mouse, x: e.offsetX, y: e.offsetY };
    });
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        mouse = { x: e.offsetX, y: e.offsetY, down: e.button === 0 };
        el.focus();
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') mouse.down = false;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch: a stick on the left, buttons on the right
    const stickEl = $('.ar-stick'), knob = $('.ar-knob');
    touchEl.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest<HTMLButtonElement>('[data-t]');
      if (btn) {
        if (btn.dataset.t === 'fire') touchFire = true;
        else act({ t: 'switch' });
        btn.setPointerCapture(e.pointerId);
        btn.addEventListener('pointerup', () => (btn.dataset.t === 'fire' ? (touchFire = false) : 0), { once: true });
        btn.addEventListener('pointercancel', () => (touchFire = false), { once: true });
        return;
      }
      if (e.clientX < window.innerWidth * 0.55 && stick.id < 0) {
        stick.id = e.pointerId;
        stick.x0 = e.clientX;
        stick.y0 = e.clientY;
        stickEl.style.left = `${e.clientX - 60}px`;
        stickEl.style.top = `${e.clientY - 60}px`;
        stickEl.classList.add('on');
      }
    });
    touchEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stick.id) return;
      let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
      const l = Math.hypot(dx, dy);
      if (l > 50) {
        dx = (dx / l) * 50;
        dy = (dy / l) * 50;
      }
      stick.dx = dx / 50;
      stick.dy = dy / 50;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== stick.id) return;
      stick.id = -1;
      stick.dx = stick.dy = 0;
      knob.style.transform = '';
      stickEl.classList.remove('on');
    };
    touchEl.addEventListener('pointerup', endStick);
    touchEl.addEventListener('pointercancel', endStick);

    hud.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'mute') {
        setMuted(!isMuted());
        write(MUTE_KEY, isMuted() ? '1' : '0');
        syncMute();
      } else if (b.dataset.a === 'menu') openMenu();
    });
    monEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-k]');
      if (b) act({ t: 'switch', kind: b.dataset.k as MonsterKind });
    });

    /** touch aiming: the closest thing to shoot at */
    function autoAim(s: State, p: Player): number {
      let best: { x: number; y: number } | null = null, bd = Infinity;
      const targets: { x: number; y: number }[] = p.role === 'archer'
        ? [...s.enemies, ...s.players.filter((q) => q.role === 'monster' && !q.dead)]
        : s.players.filter((q) => q.role === 'archer' && !q.dead);
      for (const t of targets) {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      return best ? Math.atan2(best.y - p.y, best.x - p.x) : p.aim;
    }

    // ---------- fx from the game ----------
    function handleFx(f: Fx) {
      R.addFx(f, myId);
      const s = view();
      const mine = f.who === myId;
      switch (f.k) {
        case 'shoot':
          if (mine) sfx('shoot');
          break;
        case 'stage':
          sfx('stage');
          if (s) {
            const st = f.v ?? s.stage;
            banner(`Stage ${st}`, isBossStage(st) ? `Boss: ${BOSSES[bossNameFor(s)]?.name ?? ''}` : st === STAGES - 1 ? 'One more to the top!' : `${STAGES - st} to go`);
          }
          break;
        case 'clear':
          sfx('clear');
          break;
        case 'chest':
          if (mine) sfx('chest');
          break;
        case 'hurt':
          if (mine) sfx('hurt');
          break;
        case 'die':
          sfx('die');
          if (mine && f.c === 'monster') toast('Knocked out! Back in 5 seconds as a different monster.');
          else if (mine && s && s.phase === 'play') toast('You are down! You come back on the next stage if a friend makes it there.', 4000);
          break;
        case 'level':
          break;
        default:
          if (['boom', 'pop', 'thorns', 'spit', 'splat', 'fuse', 'pinch', 'dash', 'bossdie', 'phoenix', 'over', 'win', 'thud', 'heal', 'upgrade'].includes(f.k)) {
            if ((f.k === 'heal' || f.k === 'upgrade') && !mine) break;
            sfx(f.k);
          }
      }
    }
    const bossNameFor = (s: State) => {
      const b = s.enemies.find((e) => e.boss);
      return b?.boss ?? 'crabKing';
    };

    // ---------- HUD ----------
    let hudKey = '';
    function syncHud(s: State) {
      const p = me();
      stageEl.textContent = `Stage ${s.stage} / ${STAGES}`;
      (towerEl.firstElementChild as HTMLElement).style.width = `${(s.stage / STAGES) * 100}%`;
      const boss = s.enemies.find((e) => e.boss);
      bossEl.hidden = !boss;
      if (boss) {
        bossEl.querySelector('b')!.textContent = BOSSES[boss.boss!].name;
        (bossEl.querySelector('.ar-bossbar i') as HTMLElement).style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      }
      if (p) {
        hpEl.querySelector('i')!.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
        hpEl.querySelector('span')!.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
        hpEl.classList.toggle('low', p.hp < p.maxHp * 0.3);
        xpEl.hidden = p.role !== 'archer';
        if (p.role === 'archer') {
          xpEl.querySelector('i')!.style.width = `${(p.xp / xpNeed(p.level)) * 100}%`;
          xpEl.querySelector('span')!.textContent = `Level ${p.level}`;
        }
      }
      // upgrades list and team (only rebuilt when they change)
      const key = JSON.stringify([p?.ups, p?.role, p?.kind, p?.dead, s.players.map((q) => [q.name, q.role, q.kind, q.dead, Math.round((q.hp / q.maxHp) * 10)])]);
      if (key !== hudKey) {
        hudKey = key;
        upsEl.innerHTML = p?.role === 'archer'
          ? UP_IDS.filter((u) => (p.ups[u] ?? 0) > 0).map((u) => `<span title="${UPGRADES[u].name}: ${UPGRADES[u].text(p.ups[u]!)}">${UPGRADES[u].icon}<b>${u === 'phoenix' ? `×${p.ups[u]}` : p.ups[u]}</b></span>`).join('')
          : '';
        monEl.hidden = p?.role !== 'monster';
        if (p?.role === 'monster') {
          monEl.innerHTML = `<div>${MONSTER_KINDS.map((k, i) => `<button data-k="${k}" class="${p.kind === k ? 'sel' : ''}" title="${MONSTERS[k].name} (${i + 1})"><img src="${monsterPicture(k, 44)}" alt=""><em>${i + 1}</em></button>`).join('')}</div><span>${MONSTERS[p.kind].name}: ${p.kind === 'pot' ? 'click to light your fuse and blow up' : p.kind === 'cactus' ? 'click to shoot thorns' : p.kind === 'stew' ? 'click to spit acid' : 'click to pinch'} · Q switches</span>`;
        }
        teamEl.innerHTML = s.players.length > 1
          ? s.players.map((q) => `<div style="--c:${PLAYER_COLORS[q.slot]}" class="${q.dead ? 'dead' : ''}"><b>${q.slot + 1}</b>${esc(q.name)} <small>${q.role === 'archer' ? '🏹' : q.role === 'monster' ? '👾' : '…'}</small></div>`).join('')
          : '';
        $<HTMLButtonElement>('.ar-tsw').hidden = p?.role !== 'monster';
        $<HTMLButtonElement>('.ar-tfire').textContent = p?.role === 'monster' ? '💥' : '🏹';
      }
      // message line
      let msg = '';
      if (s.phase !== 'play') msg = '';
      else if (p?.dead && p.role === 'monster') msg = `Back in ${Math.ceil(p.respawnT)}… as a different monster`;
      else if (p?.dead) msg = 'You are down. You come back on the next stage.';
      else if (s.cleared) {
        const left = s.chests.filter((c) => !p?.opened.includes(c.id));
        if (s.stairsT >= 0) msg = `Going up in ${Math.ceil(s.stairsT)}…`;
        else if (left.length && p?.role === 'archer') msg = 'Stage clear! Open the chests, then take the stairs ▲';
        else msg = s.stage >= STAGES ? '' : 'Stage clear! Take the stairs at the top ▲';
      } else if (!s.cleared && s.bannerT <= 0 && boss && s.stage === STAGES) msg = 'The Archenemy guards the top of the tower!';
      msgEl.hidden = !msg;
      if (msg && msgEl.textContent !== msg) msgEl.textContent = msg;
    }

    // ---------- loop ----------
    let raf = 0;
    let last = performance.now();
    let sendT = 0;
    // guests: where things are drawn, eased toward each snapshot
    const shown = new Map<string, { x: number; y: number }>();
    const local = { x: 0, y: 0, tp: -1 };
    let lastSnap: State | null = null;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = view();
      if (!s || (screen !== 'play' && screen !== 'lobby')) {
        // title screens: draw a calm empty floor behind the menus
        R.c.setTransform(1, 0, 0, 1, 0, 0);
        R.resize();
        R.c.fillStyle = '#0d0b1a';
        R.c.fillRect(0, 0, cv.width, cv.height);
        return;
      }
      const p = s.players.find((q) => q.id === myId);
      // input
      let mx = 0, my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      if (stick.id >= 0) {
        mx = stick.dx;
        my = stick.dy;
      }
      const blocked = menuOpen || screen !== 'play';
      if (blocked) mx = my = 0;
      let aim = p?.aim ?? 0;
      let fire = false;
      if (p && !blocked) {
        if (touchMode && !mouse.x) {
          aim = autoAim(s, p);
          fire = touchFire;
        } else {
          const w = R.toWorld(mouse.x, mouse.y);
          const px = guest ? local.x : p.x, py = guest ? local.y : p.y;
          aim = Math.atan2(w.y - py, w.x - px);
          fire = mouse.down || keys.has(' ') || touchFire;
        }
      }

      if (g && !guest) {
        // solo or host
        if (p) {
          moveSelf(s, p, mx, my, dt);
          g.inputs.set(myId, { aim, fire });
        }
        if (!paused && screen === 'play') g.update(dt);
        const fx = g.fx.splice(0);
        for (const f of fx) handleFx(f);
        host?.tick(dt, fx);
        R.draw(s, myId, now / 1000, dt, (_k, _id, x, y) => ({ x, y }));
      } else if (guest && p) {
        // guest: move ourselves here and tell the host
        if (local.tp !== p.tp || lastSnap === null) {
          local.x = p.x;
          local.y = p.y;
          local.tp = p.tp;
        }
        const body = { ...p, x: local.x, y: local.y };
        moveSelf(s, body, mx, my, dt);
        local.x = body.x;
        local.y = body.y;
        sendT -= dt;
        if (sendT <= 0) {
          sendT = 1 / 30;
          guest.send({ t: 'in', x: local.x, y: local.y, aim, fire, mv: body.moving, tp: local.tp });
        }
        // shots keep flying between snapshots
        for (const sh of s.shots) {
          if (sh.kind === 'glob') {
            sh.t += dt;
            const k = Math.min(1, sh.t / sh.dur);
            sh.x = sh.sx + (sh.tx - sh.sx) * k;
            sh.y = sh.sy + (sh.ty - sh.sy) * k;
          } else {
            sh.x += sh.vx * dt;
            sh.y += sh.vy * dt;
          }
        }
        s.time += dt;
        p.x = local.x;
        p.y = local.y;
        p.aim = aim;
        p.moving = body.moving;
        lastSnap = s;
        const ease = 1 - Math.exp(-dt * 14);
        R.draw(s, myId, now / 1000, dt, (k, id, x, y) => {
          if (k === 'p' && id === myId) return { x, y };
          const key = `${k}${id}`;
          let d = shown.get(key);
          if (!d || Math.hypot(d.x - x, d.y - y) > 120) {
            d = { x, y };
            shown.set(key, d);
          }
          d.x += (x - d.x) * ease;
          d.y += (y - d.y) * ease;
          return d;
        });
        if (shown.size > 400) shown.clear();
      } else {
        R.draw(s, myId, now / 1000, dt, (_k, _id, x, y) => ({ x, y }));
      }

      if (screen === 'lobby') {
        renderLobby();
        return;
      }
      syncHud(s);
      syncOverlay(s);
      animateReveal();
    }
    raf = requestAnimationFrame(frame);

    show('title');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (import.meta.env.DEV) (window as any).__ar = { game: () => g, act };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      clearTimeout(toastTimer);
      clearTimeout(bannerTimer);
      stopHostSearch();
      void host?.close();
      guest?.close();
      el.remove();
    };
  },
};

export default game;
