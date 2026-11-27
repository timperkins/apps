// 2p Games: a little collection of party games for up to 8 players, hosted the Factori-owen way.
// This file is the menu, the host/join lobby and the glue between the network and each mini game.
import './style.css';
import type { GameModule } from '../types';
import { isMuted, play, setMuted, unlockAudio } from './audio';
import { MAX_PLAYERS, hostWorld, joinWorld, listHosts, type FriendSession, type HostInfo, type HostSession } from './net';
import { esc, type Match, type Mode, type Player } from './match';

const MODES: Record<Mode, { title: string; icon: string; blurb: string; bots: boolean }> = {
  factory: {
    title: 'Factory',
    icon: '🏭',
    blurb: 'Bananas, apples, cats and more make gold. Buy crates, pick one of 3 makers, upgrade them 8 times, and be the first to buy the Golden Trophy.',
    bots: false,
  },
  knights: {
    title: 'Knight Battle',
    icon: '⚔️',
    blurb: 'Blue team against red team. Every player has a big heart with 1000 health. Build a base, train warriors, switch classes at the castle and grab the mystery box.',
    bots: true,
  },
};

type Lobby = { slot: number; name: string; team: number; bot: boolean }[];
type LobbyMsg =
  | { t: '_lob'; mode: Mode; players: Lobby }
  | { t: '_go'; mode: Mode; players: Player[]; seed: number }
  | { t: '_hi'; name: string }
  | { t: '_bye' };

const BOT_NAMES = ['Sir Bolt', 'Lady Pip', 'Sir Crumb', 'Dame Rook', 'Sir Wobble', 'Lady Fern', 'Sir Tumble', 'Dame Moss'];

const game: GameModule = {
  mount(root, { onExit }) {
    root.innerHTML = `<div class="pg"><div class="pg-screen"></div><div class="pg-game"></div></div>`;
    const screen = root.querySelector<HTMLElement>('.pg-screen')!;
    const gameRoot = root.querySelector<HTMLElement>('.pg-game')!;
    let name = '';
    try { name = localStorage.getItem('2p-name') ?? ''; } catch { /* ignore */ }
    if (!name) name = `Player ${1 + Math.floor(Math.random() * 99)}`;

    let net: HostSession | FriendSession | null = null;
    let mode: Mode = 'factory';
    let lobby: Lobby = [];
    let started = false;
    let stopGame: (() => void) | null = null;
    let alive = true;
    // the running mini game's listeners
    let gMsg: ((from: number, m: any) => void)[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    let gJoin: ((p: Player) => void)[] = [];
    let gLeave: ((s: number) => void)[] = [];
    let early: [number, unknown][] = [];
    let joinList: HostInfo[] | null = null;
    let busy = false;
    let error = '';
    let view: 'home' | 'mode' | 'lobby' | 'game' = 'home';

    const saveName = () => { try { localStorage.setItem('2p-name', name); } catch { /* ignore */ } };

    // ---------- screens ----------
    function home() {
      leaveNet();
      view = 'home';
      screen.hidden = false;
      screen.innerHTML = `
        <div class="pg-home">
          <button class="pg-back" data-a="exit">← Back to games</button>
          <button class="pg-mute" data-a="mute">${isMuted() ? '🔇' : '🔊'}</button>
          <h1><span>2p</span> Games</h1>
          <p class="pg-tag">Mini games for you and your friends, up to ${MAX_PLAYERS} players.</p>
          <label class="pg-name">Your name <input maxlength="16" value="${esc(name)}"></label>
          <div class="pg-cards">
            ${(Object.keys(MODES) as Mode[]).map((m) => `
              <button class="pg-card pg-card-${m}" data-mode="${m}">
                <span class="pg-card-ic">${MODES[m].icon}</span>
                <b>${MODES[m].title}</b>
                <small>${MODES[m].blurb}</small>
              </button>`).join('')}
          </div>
        </div>`;
      const inp = screen.querySelector('input')!;
      inp.oninput = () => { name = inp.value.trim().slice(0, 16) || 'Player'; saveName(); };
      screen.querySelector<HTMLElement>('[data-a="exit"]')!.onclick = () => onExit();
      screen.querySelector<HTMLElement>('[data-a="mute"]')!.onclick = (e) => { setMuted(!isMuted()); (e.currentTarget as HTMLElement).textContent = isMuted() ? '🔇' : '🔊'; };
      screen.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.onclick = () => { unlockAudio(); play('click'); mode = b.dataset.mode as Mode; modeScreen(); });
    }

    function modeScreen() {
      view = 'mode';
      const M = MODES[mode];
      screen.innerHTML = `
        <div class="pg-home">
          <button class="pg-back" data-a="home">← 2p Games</button>
          <h1 class="pg-h1-small">${M.icon} ${M.title}</h1>
          <p class="pg-tag">${M.blurb}</p>
          ${error ? `<p class="pg-err">${esc(error)}</p>` : ''}
          <div class="pg-row">
            <button class="pg-btn" data-a="solo">${M.bots ? '🤖 Play against bots' : '🙂 Play solo'}</button>
            <button class="pg-btn blue" data-a="host">🌐 Host a game</button>
          </div>
          <h2>Join a game</h2>
          <div class="pg-list">${joinList === null ? '<p>Looking for games…</p>'
            : joinList.length ? joinList.map((h) => `<div class="pg-li"><span>${h.world.startsWith('Knight') ? '⚔️' : '🏭'}</span><b>${esc(h.name)}</b><small>${esc(h.world)} · ${h.players}/${MAX_PLAYERS}</small><button data-join="${esc(h.id)}" ${h.players >= MAX_PLAYERS || busy ? 'disabled' : ''}>${h.players >= MAX_PLAYERS ? 'Full' : 'Join'}</button></div>`).join('')
            : `<p>Nobody is hosting ${M.title} right now. Ask a friend to press <b>Host a game</b>.</p>`}</div>
          <button class="pg-link" data-a="refresh">↻ Look again</button>
        </div>`;
      error = '';
      const on = (a: string, f: () => void) => { const el = screen.querySelector<HTMLElement>(`[data-a="${a}"]`); if (el) el.onclick = () => { unlockAudio(); play('click'); f(); }; };
      on('home', home);
      on('solo', () => { lobby = [{ slot: 0, name, team: 0, bot: false }]; if (mode === 'knights') lobby.push({ slot: 8, name: BOT_NAMES[0], team: 1, bot: true }); lobbyScreen(true); });
      on('host', () => void host());
      on('refresh', () => void refresh());
      screen.querySelectorAll<HTMLElement>('[data-join]').forEach((b) => b.onclick = () => void join(joinList!.find((h) => h.id === b.dataset.join)!));
      if (joinList === null) void refresh();
    }

    async function refresh() {
      joinList = null;
      if (!alive) return;
      try {
        const all = await listHosts();
        joinList = all.filter((h) => h.world.startsWith(MODES[mode].title));
      } catch (err) {
        console.warn(err);
        joinList = [];
        error = 'Could not look for games. Check your connection.';
      }
      if (alive && view === 'mode' && !net && !busy) modeScreen();
    }

    async function host() {
      busy = true;
      screen.querySelector('.pg-row')!.innerHTML = '<p>Opening your game…</p>';
      try {
        const s = await hostWorld(name, `${MODES[mode].title} · Lobby`);
        net = s;
        lobby = [{ slot: 0, name, team: 0, bot: false }];
        s.onJoin((slot) => {
          if (!started) {
            lobby.push({ slot, name: 'Joining…', team: teamFor(), bot: false });
            // too many with bots: drop a bot
            while (lobby.length > MAX_PLAYERS) { const i = lobby.findIndex((p) => p.bot); if (i < 0) break; lobby.splice(i, 1); }
            sendLobby();
            lobbyScreen(false);
          }
        });
        s.onLeave((slot) => {
          if (!started) { lobby = lobby.filter((p) => p.slot !== slot); sendLobby(); lobbyScreen(false); }
          else for (const cb of gLeave) cb(slot);
        });
        s.onMessage((slot, raw) => {
          const m = raw as LobbyMsg;
          if (m?.t === '_hi') {
            const nm = String(m.name || 'Player').slice(0, 16);
            const p = lobby.find((q) => q.slot === slot);
            if (!started) { if (p) p.name = nm; sendLobby(); lobbyScreen(false); }
            else {
              const np: Player = { slot, name: nm, team: teamFor(), bot: false };
              s.send(slot, { t: '_go', mode, players: [...currentPlayers, np], seed: currentSeed, late: true });
              currentPlayers.push(np);
              for (const cb of gJoin) cb(np);
            }
            return;
          }
          if (started) dispatch(slot, raw);
        });
        busy = false;
        lobbyScreen(false);
      } catch (err) {
        console.warn(err);
        busy = false;
        error = 'Could not open your game. Check your connection and try again.';
        modeScreen();
      }
    }

    async function join(info: HostInfo) {
      busy = true;
      modeScreen();
      try {
        const s = await joinWorld(info);
        net = s;
        s.onMessage((raw) => {
          const m = raw as LobbyMsg & { late?: boolean };
          if (m?.t === '_lob') { mode = m.mode; lobby = m.players; if (!started) lobbyScreen(false); return; }
          if (m?.t === '_go') { start(m.mode, m.players, m.seed, s.slot); return; }
          if (started) dispatch(0, raw); else early.push([0, raw]);
        });
        s.onClose(() => {
          if (started) for (const cb of gLeave) cb(0);
          else { net = null; error = 'The host closed the game.'; joinList = null; modeScreen(); }
        });
        s.send({ t: '_hi', name } satisfies LobbyMsg);
        busy = false;
        screen.innerHTML = '<div class="pg-home"><p>Joining…</p></div>';
      } catch (err) {
        busy = false;
        error = (err as Error).message || 'Could not join.';
        joinList = null;
        modeScreen();
      }
    }

    const teamFor = () => {
      const blue = lobby.filter((p) => p.team === 0).length, red = lobby.filter((p) => p.team === 1).length;
      return blue <= red ? 0 : 1;
    };
    const sendLobby = () => { if (net?.role === 'host') net.broadcast({ t: '_lob', mode, players: lobby } satisfies LobbyMsg); };

    function lobbyScreen(solo: boolean) {
      view = 'lobby';
      const amHost = solo || net?.role === 'host';
      const M = MODES[mode];
      const team = (p: Lobby[number]) => mode === 'knights'
        ? `<button class="pg-team t${p.team}" data-team="${p.slot}" ${amHost ? '' : 'disabled'}>${p.team === 0 ? 'Blue' : 'Red'}</button>` : '';
      const myslot = net?.role === 'friend' ? net.slot : 0;
      screen.innerHTML = `
        <div class="pg-home">
          <button class="pg-back" data-a="leave">← Leave</button>
          <h1 class="pg-h1-small">${M.icon} ${M.title}</h1>
          <p class="pg-tag">${solo ? (M.bots ? 'Pick your bots and teams, then start.' : 'Just you. Start when you’re ready.')
            : amHost ? `Your game is open. Friends pick <b>${M.title}</b> → <b>Join a game</b> to come in (up to ${MAX_PLAYERS}).` : 'Waiting for the host to start…'}</p>
          <div class="pg-lobby">
            ${lobby.map((p) => `<div class="pg-pl${p.slot === myslot && !p.bot ? ' me' : ''}"><span>${p.bot ? '🤖' : p.slot === 0 ? '👑' : '🙂'}</span><b>${esc(p.name)}</b>${team(p)}${amHost && p.bot ? `<button class="pg-x" data-kick="${p.slot}">✕</button>` : ''}</div>`).join('')}
          </div>
          ${amHost && M.bots && lobby.length < MAX_PLAYERS ? '<button class="pg-link" data-a="bot">＋ Add a bot</button>' : ''}
          ${amHost ? `<button class="pg-btn big" data-a="start" ${mode === 'knights' && (!lobby.some((p) => p.team === 0) || !lobby.some((p) => p.team === 1)) ? 'disabled' : ''}>▶ Start</button>` : ''}
          ${amHost && mode === 'knights' && (!lobby.some((p) => p.team === 0) || !lobby.some((p) => p.team === 1)) ? '<p class="pg-sub">Each team needs at least one player or bot.</p>' : ''}
        </div>`;
      const on = (a: string, f: () => void) => { const el = screen.querySelector<HTMLElement>(`[data-a="${a}"]`); if (el) el.onclick = () => { play('click'); f(); }; };
      on('leave', () => { leaveNet(); joinList = null; modeScreen(); });
      on('bot', () => {
        let slot = 8; while (lobby.some((p) => p.slot === slot)) slot++;
        lobby.push({ slot, name: BOT_NAMES[(slot - 8) % BOT_NAMES.length], team: teamFor(), bot: true });
        sendLobby(); lobbyScreen(solo);
      });
      on('start', () => {
        const players: Player[] = lobby.map((p) => ({ ...p }));
        const seed = Math.floor(Math.random() * 1e9);
        if (net?.role === 'host') { net.broadcast({ t: '_go', mode, players, seed } satisfies LobbyMsg); net.setWorld(`${MODES[mode].title} · Playing`); }
        start(mode, players, seed, 0);
      });
      screen.querySelectorAll<HTMLElement>('[data-team]').forEach((b) => b.onclick = () => {
        const p = lobby.find((q) => q.slot === Number(b.dataset.team)); if (!p) return;
        p.team = 1 - p.team; play('click'); sendLobby(); lobbyScreen(solo);
      });
      screen.querySelectorAll<HTMLElement>('[data-kick]').forEach((b) => b.onclick = () => {
        lobby = lobby.filter((p) => p.slot !== Number(b.dataset.kick)); sendLobby(); lobbyScreen(solo);
      });
    }

    // ---------- the match ----------
    let currentPlayers: Player[] = [];
    let currentSeed = 0;
    function dispatch(from: number, m: unknown) {
      if (!gMsg.length) { early.push([from, m]); return; }
      for (const cb of gMsg) cb(from, m);
    }

    function start(m: Mode, players: Player[], seed: number, me: number) {
      started = true;
      view = 'game';
      mode = m;
      currentPlayers = players;
      currentSeed = seed;
      screen.hidden = true;
      gMsg = []; gJoin = []; gLeave = [];
      const match: Match = {
        mode: m, me, host: net?.role !== 'friend', solo: !net, players, seed,
        send: (msg) => { if (net?.role === 'friend') net.send(msg); },
        sendTo: (slot, msg) => { if (net?.role === 'host') net.send(slot, msg); },
        broadcast: (msg) => { if (net?.role === 'host') net.broadcast(msg); },
        onMsg: (cb) => { gMsg.push(cb); for (const [f, x] of early.splice(0)) cb(f, x); },
        onJoin: (cb) => gJoin.push(cb),
        onLeave: (cb) => gLeave.push(cb),
        quit: () => { endGame(); home(); },
      };
      const load = m === 'factory' ? import('./factory') : import('./knights/ui');
      void load.then((mod) => {
        if (!alive || !started) return;
        stopGame = mod.startGame(gameRoot, match);
      });
    }

    function endGame() {
      stopGame?.();
      stopGame = null;
      gameRoot.innerHTML = '';
      started = false;
      gMsg = []; gJoin = []; gLeave = []; early = [];
    }

    function leaveNet() {
      if (started) endGame();
      if (net) {
        if (net.role === 'friend') net.send({ t: '_bye' });
        net.close();
      }
      net = null;
      lobby = [];
    }

    // the hub opens us straight on the menu
    home();
    return () => {
      alive = false;
      leaveNet();
      root.innerHTML = '';
    };
  },
};

export default game;
