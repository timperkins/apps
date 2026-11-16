// The landing page: multiplayer first. You pick a name and a colour, then
// host a game (and get a four-letter room code to share) or join one with
// its code. Everyone in the room sees who else is there; the host picks one
// of the maps made for that many players and starts the game. One button
// goes to the single-player game and its test stages instead.
//
// The host runs the game for everyone (see "Multiplayer" in src/v2/game.ts);
// here is the lobby and the messages that carry the game once it starts.
import { FACTIONS } from './v1/sprites';
import { MAPS, mapPreview, mapsFor, START_DOTS } from './v2/maps';
import type { Command, Player, Snapshot } from './v2/game';
import { isValidCode, normalizeCode } from './net/codes';
import type { Signaling } from './net/signal';
import type { Hub, Link } from './net/link';

const MAX_PLAYERS = 8;
// how long the host waits for everyone's world to be ready before starting anyway
const READY_WAIT_MS = 45000;

interface LobbyPlayer {
  id: string;
  name: string;
  color: number; // a side in FACTIONS
  host?: boolean;
}

type ToHost = { t: 'hello'; name: string; color: number } | { t: 'ready' } | { t: 'cmd'; cmd: Command };
type ToPlayer =
  | { t: 'lobby'; players: LobbyPlayer[]; mapId: string; seed: number; you: string }
  | { t: 'start'; seed: number; mapId: string; players: (Player & { id: string })[] }
  | { t: 'go' }
  | { t: 'snap'; s: Snapshot }
  | { t: 'left'; name: string }
  | { t: 'no'; why: string };

/** A game that is starting: what main.ts needs to make the world and run it. */
export interface Match {
  seed: number;
  mapId: string;
  players: Player[];
  me: number; // your side
  host: boolean;
  /** Your world is made: tell the host. */
  ready(): void;
  /** Everyone is ready: play. */
  onGo: () => void;
  // the host: a player's order, and sending everyone the latest
  onCommand: (f: number, cmd: Command) => void;
  sendSnapshot(s: Snapshot): void;
  // a player: an order for the host, and its updates
  sendCommand(cmd: Command): void;
  onSnapshot: (s: Snapshot) => void;
  // someone left, or (a player) the host has gone
  onLeft: (name: string) => void;
  onHostLost: () => void;
  leave(): void;
}

export interface LobbyHooks {
  solo(): void;
  start(m: Match): void;
}

const NAMES = ['Ace', 'Badger', 'Comet', 'Dingo', 'Falcon', 'Gecko', 'Hawk', 'Ibex', 'Jackal', 'Kestrel', 'Lynx', 'Marten', 'Otter', 'Puma', 'Raven', 'Viper'];

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

const hexOf = (f: number) => {
  const [r, g, b] = FACTIONS[f].main;
  return `rgb(${r}, ${g}, ${b})`;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Lobby {
  private root = el('div');
  private name = load('ra-name') || NAMES[Math.floor(Math.random() * NAMES.length)];
  private color = Math.min(FACTIONS.length - 1, Math.max(0, Number(load('ra-color') ?? 0) || 0));
  private sig: Signaling | null = null;
  // in a room
  private mode: 'home' | 'host' | 'player' = 'home';
  private code = '';
  private players: LobbyPlayer[] = [];
  private you = '';
  private mapId = MAPS[0].id;
  private seed = Math.floor(Math.random() * 100000);
  private hub: Hub | null = null;
  private link: Link | null = null;
  private match: Match | null = null;
  private busy = '';
  private error = '';
  private previews = new Map<string, HTMLCanvasElement>();

  constructor(private hooks: LobbyHooks) {
    this.root.id = 'lobby';
    document.body.append(this.root);
    // a link with ?join=CODE fills in the code
    const j = normalizeCode(new URLSearchParams(location.search).get('join') ?? '');
    this.joinCode = j;
    this.render();
  }
  private joinCode = '';

  show(): void {
    this.root.hidden = false;
    this.render();
  }
  hide(): void {
    this.root.hidden = true;
  }
  get open(): boolean {
    return !this.root.hidden;
  }

  private async signaling(): Promise<Signaling> {
    if (!this.sig) {
      const m = await import('./net/signal');
      this.sig = new URLSearchParams(location.search).has('localnet') ? m.localSignaling() : await m.firestoreSignaling();
    }
    return this.sig;
  }

  // ---------- The host ----------

  private async host(): Promise<void> {
    this.setBusy('Making a room');
    try {
      const sig = await this.signaling();
      const { Hub } = await import('./net/link');
      this.code = await sig.createRoom();
      this.you = await sig.me();
      this.mode = 'host';
      this.players = [{ id: this.you, name: this.name, color: this.color, host: true }];
      this.fitMap();
      this.hub = new Hub(sig, this.code, {
        onOpen: () => {},
        onClose: (uid) => this.playerGone(uid),
        onMessage: (uid, m) => this.fromPlayer(uid, m as ToHost),
      });
      this.setBusy('');
    } catch (err) {
      this.fail(err);
    }
  }

  private fromPlayer(uid: string, m: ToHost): void {
    if (m.t === 'hello') {
      if (this.match) {
        this.hub?.send(uid, { t: 'no', why: 'That game has already started.' } satisfies ToPlayer);
        return;
      }
      let p = this.players.find((q) => q.id === uid);
      if (!p) {
        if (this.players.length >= MAX_PLAYERS) {
          this.hub?.send(uid, { t: 'no', why: 'That room is full (8 players).' } satisfies ToPlayer);
          return;
        }
        p = { id: uid, name: '', color: 0 };
        this.players.push(p);
      }
      p.name = String(m.name).slice(0, 16) || 'Player';
      p.color = this.freeColor(m.color, uid);
      this.fitMap();
      this.sendLobby();
      return;
    }
    if (!this.match) return;
    if (m.t === 'ready') this.readyFrom(uid);
    else if (m.t === 'cmd') {
      const p = this.players.find((q) => q.id === uid);
      if (p) this.match.onCommand(p.color, m.cmd);
    }
  }

  // The colour a player asked for, or the first one nobody else has.
  private freeColor(want: number, uid: string): number {
    const taken = new Set(this.players.filter((p) => p.id !== uid).map((p) => p.color));
    if (want >= 0 && want < FACTIONS.length && !taken.has(want)) return want;
    for (let c = 0; c < FACTIONS.length; c++) if (!taken.has(c)) return c;
    return 0;
  }

  private playerGone(uid: string): void {
    const p = this.players.find((q) => q.id === uid);
    if (!p) return;
    this.players = this.players.filter((q) => q !== p);
    if (this.match) {
      this.hub?.broadcast({ t: 'left', name: p.name } satisfies ToPlayer);
      this.match.onLeft(p.name);
      this.waiting.delete(uid);
      this.maybeGo();
    } else {
      this.fitMap();
      this.sendLobby();
    }
  }

  private sendLobby(): void {
    if (this.mode !== 'host') return;
    for (const p of this.players)
      if (!p.host) this.hub?.send(p.id, { t: 'lobby', players: this.players, mapId: this.mapId, seed: this.seed, you: p.id } satisfies ToPlayer);
    this.render();
  }

  // The map picked still fits how many there are, or the first one that does.
  private fitMap(): void {
    const n = Math.max(2, this.players.length);
    const fits = mapsFor(n);
    if (!fits.some((m) => m.id === this.mapId) && fits.length) this.mapId = fits[0].id;
  }

  private waiting = new Set<string>();
  private readyWait = 0;
  private hostReady = false;

  private startGame(): void {
    if (this.mode !== 'host' || this.match) return;
    const players = this.players.map((p) => ({ id: p.id, f: p.color, name: p.name }));
    const start: ToPlayer = { t: 'start', seed: this.seed, mapId: this.mapId, players };
    this.hub?.broadcast(start);
    void this.sig?.setPhase(this.code, 'playing').catch(() => {});
    this.waiting = new Set(this.players.filter((p) => !p.host).map((p) => p.id));
    this.hostReady = false;
    this.begin(start, true);
  }

  private readyFrom(uid: string): void {
    this.waiting.delete(uid);
    this.maybeGo();
  }

  private maybeGo(): void {
    if (!this.match || !this.hostReady || this.waiting.size) return;
    clearTimeout(this.readyWait);
    this.waiting.clear();
    this.hub?.broadcast({ t: 'go' } satisfies ToPlayer);
    this.match.onGo();
  }

  // ---------- A player ----------

  private async join(): Promise<void> {
    const code = normalizeCode(this.joinCode);
    if (!isValidCode(code)) {
      this.error = 'Room codes are four letters.';
      this.render();
      return;
    }
    this.setBusy(`Joining ${code}`);
    try {
      const sig = await this.signaling();
      const phase = await sig.roomPhase(code);
      if (!phase) throw new Error(`There is no room ${code}.`);
      if (phase === 'playing') throw new Error(`The game in ${code} has already started.`);
      const { join } = await import('./net/link');
      this.link = await join(sig, code, (m) => this.fromHost(m as ToPlayer), () => this.hostGone());
      this.code = code;
      this.mode = 'player';
      this.you = this.link.uid;
      this.link.send({ t: 'hello', name: this.name, color: this.color } satisfies ToHost);
      this.setBusy('');
    } catch (err) {
      this.fail(err);
    }
  }

  private fromHost(m: ToPlayer): void {
    switch (m.t) {
      case 'lobby':
        this.players = m.players;
        this.mapId = m.mapId;
        this.seed = m.seed;
        this.you = m.you;
        // the host may have given you another colour (yours was taken)
        this.color = m.players.find((p) => p.id === m.you)?.color ?? this.color;
        this.render();
        break;
      case 'start':
        this.begin(m, false);
        break;
      case 'go':
        this.match?.onGo();
        break;
      case 'snap':
        this.match?.onSnapshot(m.s);
        break;
      case 'left':
        this.match?.onLeft(m.name);
        break;
      case 'no':
        this.link?.close();
        this.link = null;
        this.mode = 'home';
        this.fail(new Error(m.why));
        break;
    }
  }

  private hostGone(): void {
    this.link = null;
    if (this.match) this.match.onHostLost();
    else {
      this.mode = 'home';
      this.error = 'Lost touch with the host.';
      this.render();
    }
  }

  // ---------- Starting ----------

  private begin(m: Extract<ToPlayer, { t: 'start' }>, host: boolean): void {
    const me = m.players.find((p) => p.id === this.you)?.f ?? 0;
    const match: Match = {
      seed: m.seed,
      mapId: m.mapId,
      players: m.players.map(({ f, name }) => ({ f, name })),
      me,
      host,
      ready: () => {
        if (host) {
          this.hostReady = true;
          // nobody holds the game up for long
          this.readyWait = window.setTimeout(() => {
            this.waiting.clear();
            this.maybeGo();
          }, READY_WAIT_MS);
          this.maybeGo();
        } else this.link?.send({ t: 'ready' } satisfies ToHost);
      },
      onGo: () => {},
      onCommand: () => {},
      sendSnapshot: (s) => this.hub?.broadcast({ t: 'snap', s } satisfies ToPlayer, true),
      sendCommand: (cmd) => this.link?.send({ t: 'cmd', cmd } satisfies ToHost),
      onSnapshot: () => {},
      onLeft: () => {},
      onHostLost: () => {},
      leave: () => this.leave(),
    };
    this.match = match;
    this.hide();
    this.hooks.start(match);
  }

  /** Leave the room (or close it, as host) and go back to the landing page. */
  leave(): void {
    if (this.mode === 'host') {
      this.hub?.close();
      void this.sig?.closeRoom(this.code);
    }
    this.link?.close();
    this.hub = null;
    this.link = null;
    this.match = null;
    this.mode = 'home';
    this.players = [];
    this.code = '';
    this.error = '';
    this.show();
  }

  // ---------- Drawing it ----------

  private setBusy(s: string): void {
    this.busy = s;
    if (s) this.error = '';
    this.render();
  }
  private fail(err: unknown): void {
    console.warn(err);
    this.busy = '';
    this.error = err instanceof Error ? err.message : String(err);
    if (/permission|unavailable|network|offline/i.test(this.error)) this.error = `Couldn't reach the room server (${this.error}).`;
    this.render();
  }

  private setName(v: string): void {
    this.name = v.slice(0, 16);
    save('ra-name', this.name);
    this.sendMe();
  }
  private setColor(c: number): void {
    if (this.mode !== 'home' && this.players.some((p) => p.color === c && p.id !== this.you)) return;
    this.color = c;
    save('ra-color', String(c));
    this.sendMe();
    this.render();
  }
  // tell the room your name and colour
  private sendTimer = 0;
  private sendMe(): void {
    clearTimeout(this.sendTimer);
    this.sendTimer = window.setTimeout(() => {
      if (this.mode === 'player') this.link?.send({ t: 'hello', name: this.name || 'Player', color: this.color } satisfies ToHost);
      if (this.mode === 'host') {
        const me = this.players.find((p) => p.host);
        if (me) {
          me.name = this.name || 'Host';
          me.color = this.freeColor(this.color, me.id);
          this.color = me.color;
        }
        this.sendLobby();
      }
    }, 250);
  }

  private preview(id: string, n: number): HTMLCanvasElement {
    const key = `${id}:${this.seed}:${n}`;
    let c = this.previews.get(key);
    if (!c) {
      c = mapPreview(MAPS.find((m) => m.id === id)!, this.seed, 128 * 80, 128 * 40, 120, 60, n);
      this.previews.set(key, c);
    }
    // a canvas can only be in one place: draw a copy
    const out = el('canvas');
    out.width = c.width;
    out.height = c.height;
    out.getContext('2d')!.drawImage(c, 0, 0);
    return out;
  }

  private render(): void {
    if (this.root.hidden) return;
    // (keep the typing caret where it is when the name box is redrawn)
    const focused = document.activeElement?.id;
    const box = el('div', 'box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Multiplayer lobby');

    const head = el('div', 'head');
    head.append(el('span', 'title', 'RA'), el('span', 'sub', 'Multiplayer · same network'));
    box.append(head);

    // you: name and colour
    const you = el('div', 'you');
    const nameLab = el('label', 'field');
    nameLab.append(el('span', 'lab', 'Name'));
    const input = el('input');
    input.id = 'lobbyName';
    input.maxLength = 16;
    input.value = this.name;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => this.setName(input.value));
    nameLab.append(input);
    you.append(nameLab);
    const colors = el('div', 'field');
    colors.append(el('span', 'lab', 'Colour'));
    const sw = el('div', 'swatches');
    sw.setAttribute('role', 'radiogroup');
    const taken = new Set(this.mode === 'home' ? [] : this.players.filter((p) => p.id !== this.you).map((p) => p.color));
    FACTIONS.forEach((f, i) => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.style.setProperty('--c', hexOf(i));
      b.title = taken.has(i) ? `${f.name} (taken)` : f.name;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', f.name);
      b.setAttribute('aria-checked', String(i === this.color));
      b.disabled = taken.has(i);
      b.addEventListener('click', () => this.setColor(i));
      sw.append(b);
    });
    colors.append(sw);
    you.append(colors);
    box.append(you);

    if (this.mode === 'home') box.append(this.homeView());
    else box.append(this.roomView());

    if (this.busy) box.append(el('div', 'busy', `${this.busy}…`));
    if (this.error) box.append(el('div', 'err', this.error));

    const foot = el('div', 'foot');
    const solo = el('button', 'solo', 'Single player / test mode');
    solo.type = 'button';
    solo.title = 'Play against the computer, with the test stages';
    solo.addEventListener('click', () => {
      if (this.mode !== 'home') this.leave();
      this.hide();
      this.hooks.solo();
    });
    foot.append(solo);
    box.append(foot);
    this.root.replaceChildren(box);
    if (focused) {
      const f = document.getElementById(focused) as HTMLInputElement | null;
      if (f) {
        f.focus();
        f.setSelectionRange?.(f.value.length, f.value.length);
      }
    }
  }

  private homeView(): HTMLElement {
    const v = el('div', 'home');
    const hostBtn = el('button', 'big', 'Host a game');
    hostBtn.type = 'button';
    hostBtn.disabled = !!this.busy;
    hostBtn.addEventListener('click', () => void this.host());
    const joinRow = el('div', 'joinRow');
    const code = el('input');
    code.id = 'lobbyCode';
    code.placeholder = 'CODE';
    code.maxLength = 4;
    code.value = this.joinCode;
    code.autocomplete = 'off';
    code.spellcheck = false;
    code.setAttribute('aria-label', 'Room code');
    code.addEventListener('input', () => {
      this.joinCode = normalizeCode(code.value);
      code.value = this.joinCode;
    });
    code.addEventListener('keydown', (e) => e.key === 'Enter' && void this.join());
    const joinBtn = el('button', 'big', 'Join');
    joinBtn.type = 'button';
    joinBtn.disabled = !!this.busy;
    joinBtn.addEventListener('click', () => void this.join());
    joinRow.append(code, joinBtn);
    v.append(hostBtn, el('div', 'or', 'or join with a room code'), joinRow);
    v.append(el('p', 'note', 'Everyone needs to be on the same Wi-Fi. Up to 8 players.'));
    return v;
  }

  private roomView(): HTMLElement {
    const v = el('div', 'room');
    const codeRow = el('div', 'codeRow');
    codeRow.append(el('span', 'lab', 'Room'), el('span', 'code', this.code));
    codeRow.append(el('span', 'hint', this.mode === 'host' ? 'Tell the others this code' : 'Waiting for the host to start'));
    v.append(codeRow);

    const list = el('ul', 'players');
    for (const p of this.players) {
      const li = el('li');
      const dot = el('i', 'dot');
      dot.style.setProperty('--c', hexOf(p.color));
      li.append(dot, el('span', 'pname', p.name || 'Player'));
      if (p.host) li.append(el('span', 'tag', 'host'));
      if (p.id === this.you) li.append(el('span', 'tag', 'you'));
      list.append(li);
    }
    for (let i = this.players.length; i < Math.max(2, this.players.length + 1) && i < MAX_PLAYERS; i++) {
      const li = el('li', 'empty');
      li.append(el('i', 'dot'), el('span', 'pname', 'waiting…'));
      list.append(li);
    }
    v.append(list);

    const n = Math.max(2, this.players.length);
    const mapHead = el('div', 'mapHead');
    mapHead.append(el('span', 'lab', this.mode === 'host' ? `Map · ${n} players` : 'Map'));
    if (this.mode === 'host') {
      const shuffle = el('button', 'small', 'Shuffle');
      shuffle.type = 'button';
      shuffle.title = 'Other versions of these maps';
      shuffle.addEventListener('click', () => {
        this.seed = Math.floor(Math.random() * 100000);
        this.sendLobby();
      });
      mapHead.append(shuffle);
    }
    v.append(mapHead);
    const maps = el('div', 'maps');
    const shown = this.mode === 'host' ? mapsFor(n) : MAPS.filter((m) => m.id === this.mapId);
    for (const m of shown) {
      const card = el('button', 'map');
      card.type = 'button';
      card.setAttribute('aria-pressed', String(m.id === this.mapId));
      card.append(this.preview(m.id, this.players.length));
      const nm = el('span', 'name', m.name);
      nm.append(el('span', 'pcount', m.players[0] === m.players[1] ? `${m.players[0]}P` : `${m.players[0]}-${m.players[1]}P`));
      card.append(nm);
      if (m.id === this.mapId) card.append(el('span', 'blurb', m.blurb));
      if (this.mode === 'host')
        card.addEventListener('click', () => {
          this.mapId = m.id;
          this.sendLobby();
        });
      else card.disabled = true;
      maps.append(card);
    }
    v.append(maps);
    const legend = el('div', 'legend');
    this.players.forEach((p, i) => {
      const d = el('i', 'dot');
      d.style.setProperty('--c', START_DOTS[i] ?? '#e8e2c8');
      legend.append(d);
    });
    if (this.players.length) legend.append(el('span', '', 'starts, in join order'));
    v.append(legend);

    const row = el('div', 'actions');
    const leave = el('button', 'small', this.mode === 'host' ? 'Close room' : 'Leave');
    leave.type = 'button';
    leave.addEventListener('click', () => this.leave());
    row.append(leave);
    if (this.mode === 'host') {
      const go = el('button', 'big', this.players.length < 2 ? 'Start alone (test)' : `Start · ${this.players.length} players`);
      go.type = 'button';
      go.addEventListener('click', () => this.startGame());
      row.append(go);
    }
    v.append(row);
    return v;
  }
}
