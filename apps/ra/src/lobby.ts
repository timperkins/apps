// The landing page: multiplayer first. You enter a name, then host a game
// (and get a four-letter room code) or join one with its code. Everyone in
// the room sees who else is there and gets a color of their own, which they
// can change; the host picks one of the maps made for that many players and
// starts the game. "Test mode" (top right) goes to the single-player game
// and its test stages at /test instead.
//
// A room has its own address (/CODE), so reloading the page brings you
// back into it: a player joins again, and the host takes the room back up
// with the game as it last saved it. While the host is away everyone else's
// game is paused.
//
// The host runs the game for everyone (see "Multiplayer" in src/v2/game.ts);
// here is the lobby and the messages that carry the game once it starts.
import { FACTIONS } from './v1/sprites';
import { MAPS, mapPreview, mapsFor, worldOf } from './v2/maps';
import type { Command, Player, Snapshot } from './v2/game';
import { BOT_LEVELS, type BotLevel } from './v2/bot';
import { isValidCode, normalizeCode } from './net/codes';
import type { Signaling } from './net/signal';
import type { Hub, Link } from './net/link';

const MAX_PLAYERS = 8;
// how long the host waits for everyone's world to be ready before starting anyway
const READY_WAIT_MS = 45000;
// how long a player keeps trying to get back to a host that has gone
const REJOIN_MS = 3 * 60 * 1000;
const REJOIN_GAP_MS = 2000;
// how often the host saves the game, so a reload can carry on from there
const SAVE_MS = 2000;
// saved rooms older than this are forgotten
const SAVE_LIFE_MS = 6 * 60 * 60 * 1000;

interface LobbyPlayer {
  id: string;
  name: string;
  color: number; // a side in FACTIONS
  host?: boolean;
  bot?: BotLevel; // a computer player the host added
  away?: boolean; // in a game: lost touch, may be back
}

type StartMsg = { t: 'start'; seed: number; mapId: string; players: (Player & { id: string })[] };
type ToHost = { t: 'hello'; name: string; color: number } | { t: 'ready' } | { t: 'cmd'; cmd: Command };
type ToPlayer =
  | { t: 'lobby'; players: LobbyPlayer[]; mapId: string; seed: number; you: string }
  | StartMsg
  | { t: 'go' }
  | { t: 'snap'; s: Snapshot }
  | { t: 'left'; name: string }
  | { t: 'back'; name: string }
  | { t: 'no'; why: string };

/** What the host keeps in local storage so a reload can pick the room up again. */
interface HostSave {
  uid: string;
  at: number;
  players: LobbyPlayer[];
  mapId: string;
  seed: number;
  started?: StartMsg;
  snap?: Snapshot;
}

/** A game that is starting: what main.ts needs to make the world and run it. */
export interface Match {
  seed: number;
  mapId: string;
  players: Player[];
  me: number; // your side
  host: boolean;
  /** The host back after a reload: the game as it was. */
  resume?: Snapshot;
  /** Your world is made: tell the host. */
  ready(): void;
  /** Everyone is ready (or the host is back): play. */
  onGo: () => void;
  // the host: a player's order, and sending everyone the latest
  onCommand: (f: number, cmd: Command) => void;
  sendSnapshot(s: Snapshot): void;
  // a player: an order for the host, and its updates
  sendCommand(cmd: Command): void;
  onSnapshot: (s: Snapshot) => void;
  // someone left or came back
  onLeft: (name: string) => void;
  onBack: (name: string) => void;
  // a player: the host has gone (the game waits), or isn't coming back
  onHostLost: () => void;
  onHostGone: () => void;
  leave(): void;
}

export interface LobbyHooks {
  solo(): void;
  start(m: Match): void;
  /** The landing page shows (true) or goes (false): main.ts shows a world behind it. */
  showing(on: boolean): void;
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* private mode, or full */
  }
}
function loadJson<T>(key: string): T | null {
  try {
    return JSON.parse(load(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
const hostKey = (code: string) => `ra-host-${code}`;
// the room you were last in, as a player
const ROOM_KEY = 'ra-room';

// Forget saved rooms from long ago.
function tidySaves(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith('ra-host-')) continue;
      const s = loadJson<HostSave>(k);
      if (!s || Date.now() - s.at > SAVE_LIFE_MS) localStorage.removeItem(k);
    }
  } catch {
    /* no storage */
  }
}

// The page's address: /CODE in a room, / otherwise (keeping ?localnet and the like).
function setPath(path: string): void {
  const q = new URLSearchParams(location.search);
  q.delete('join');
  // (?localnet, not ?localnet=)
  const s = q.toString().replace(/=(?=&|$)/g, '');
  const url = path + (s ? `?${s}` : '') + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(null, '', url);
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
  private name = load('ra-name') ?? '';
  private color = -1; // given by the host when you join
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
  private started: StartMsg | null = null; // the host: the game being played
  private busy = '';
  private error = '';
  private joinCode = '';
  // a player who has lost the host: trying to get back until then
  private rejoinUntil = 0;
  private previews = new Map<string, HTMLCanvasElement>();

  constructor(private hooks: LobbyHooks) {
    this.root.id = 'lobby';
    this.root.hidden = true;
    document.body.append(this.root);
    tidySaves();
    // a link with ?join=CODE fills in the code
    this.joinCode = normalizeCode(new URLSearchParams(location.search).get('join') ?? '');
    window.addEventListener('pagehide', () => this.saveNow());
  }

  /** The room code in the page's address, if there is one. */
  static pathCode(): string {
    const c = normalizeCode(location.pathname.replace(/\//g, ''));
    return location.pathname.replace(/\//g, '').length === 4 && isValidCode(c) ? c : '';
  }

  show(): void {
    if (!this.root.hidden) return this.render();
    this.root.hidden = false;
    this.hooks.showing(true);
    this.render();
  }
  hide(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.hooks.showing(false);
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

  /** Back into the room in the page's address: as its host if it was yours, otherwise as a player. */
  async enter(code: string): Promise<void> {
    this.show();
    this.setBusy(`Joining ${code}`);
    try {
      const sig = await this.signaling();
      const uid = await sig.me();
      const saved = loadJson<HostSave>(hostKey(code));
      if (saved && saved.uid === uid && (await sig.reopenRoom(code, saved.started ? 'playing' : 'lobby'))) return void (await this.rehost(code, saved));
    } catch (err) {
      return this.fail(err);
    }
    // a player: keep trying for a while if this is the room you were in
    const was = loadJson<{ code: string; at: number }>(ROOM_KEY);
    this.joinCode = code;
    void this.join(was?.code === code && Date.now() - was.at < SAVE_LIFE_MS);
  }

  // ---------- The host ----------

  private async host(): Promise<void> {
    this.setBusy('Making a room');
    try {
      const sig = await this.signaling();
      this.code = await sig.createRoom();
      this.you = await sig.me();
      this.mode = 'host';
      this.players = [{ id: this.you, name: this.name || 'Host', color: 0, host: true }];
      this.color = 0;
      this.fitMap();
      await this.openHub();
      setPath(`/${this.code}`);
      this.saveNow();
      this.setBusy('');
    } catch (err) {
      this.fail(err);
    }
  }

  private async openHub(): Promise<void> {
    const { Hub } = await import('./net/link');
    this.hub = new Hub(this.sig!, this.code, {
      onOpen: () => {},
      onClose: (uid) => this.playerGone(uid),
      onMessage: (uid, m) => this.fromPlayer(uid, m as ToHost),
    });
  }

  // The host reloaded the page: the room again, and the game if one was on.
  private async rehost(code: string, saved: HostSave): Promise<void> {
    this.code = code;
    this.you = saved.uid;
    this.mode = 'host';
    this.mapId = saved.mapId;
    this.seed = saved.seed;
    const me = saved.players.find((p) => p.host);
    // everyone else comes back by joining again
    this.players = saved.started ? saved.players.map((p) => ({ ...p, away: !p.host && !p.bot })) : saved.players.filter((p) => p.host || p.bot);
    if (me) {
      me.name = this.name || me.name;
      this.color = me.color;
    }
    await this.openHub();
    setPath(`/${code}`);
    this.setBusy('');
    if (saved.started) {
      this.started = saved.started;
      this.waiting.clear();
      this.begin(saved.started, true, saved.snap);
    } else this.sendLobby();
  }

  private fromPlayer(uid: string, m: ToHost): void {
    if (m.t === 'hello') {
      if (this.started) return this.helloInGame(uid, m);
      let p = this.players.find((q) => q.id === uid);
      if (!p) {
        if (this.players.length >= MAX_PLAYERS) {
          this.hub?.send(uid, { t: 'no', why: `That room is full (${MAX_PLAYERS} players).` } satisfies ToPlayer);
          return;
        }
        p = { id: uid, name: '', color: -1 };
        this.players.push(p);
      }
      p.name = String(m.name).slice(0, 16) || `Player ${this.players.indexOf(p) + 1}`;
      p.color = this.freeColor(Number(m.color), uid);
      this.fitMap();
      this.sendLobby();
      return;
    }
    if (!this.match) return;
    if (m.t === 'ready') this.readyFrom(uid);
    else if (m.t === 'cmd') {
      const p = this.players.find((q) => q.id === uid);
      if (p && !p.away) this.match.onCommand(p.color, m.cmd);
    }
  }

  // Someone in the game coming back (they reloaded, or the host did): the game
  // to make their world from, then they play on once it is made.
  // the host's game is going (not still being made)
  private live = false;
  private goLive(): void {
    this.live = true;
    this.match?.onGo();
    for (const uid of [...this.readied]) this.readyFrom(uid);
    this.readied.clear();
  }
  // players back and ready while the host's game was still being made
  private readied = new Set<string>();

  private helloInGame(uid: string, m: Extract<ToHost, { t: 'hello' }>): void {
    const p = this.players.find((q) => q.id === uid);
    if (!p || !this.started) {
      this.hub?.send(uid, { t: 'no', why: 'That game has already started.' } satisfies ToPlayer);
      return;
    }
    if (m.name) p.name = String(m.name).slice(0, 16);
    this.hub?.send(uid, this.started);
    this.rejoining.add(uid);
  }
  // players back in a game, making their world again
  private rejoining = new Set<string>();

  // The color a player asked for, or the first one nobody else has.
  private freeColor(want: number, uid: string): number {
    const taken = new Set(this.players.filter((p) => p.id !== uid).map((p) => p.color));
    if (want >= 0 && want < FACTIONS.length && !taken.has(want)) return want;
    for (let c = 0; c < FACTIONS.length; c++) if (!taken.has(c)) return c;
    return 0;
  }

  private playerGone(uid: string): void {
    const p = this.players.find((q) => q.id === uid);
    if (!p) return;
    if (this.match) {
      // (they may be back)
      p.away = true;
      this.rejoining.delete(uid);
      this.hub?.broadcast({ t: 'left', name: p.name } satisfies ToPlayer);
      this.match.onLeft(p.name);
      this.waiting.delete(uid);
      this.maybeGo();
    } else {
      this.players = this.players.filter((q) => q !== p);
      this.fitMap();
      this.sendLobby();
    }
  }

  private sendLobby(): void {
    if (this.mode !== 'host') return;
    for (const p of this.players)
      if (!p.host && !p.bot) this.hub?.send(p.id, { t: 'lobby', players: this.players, mapId: this.mapId, seed: this.seed, you: p.id } satisfies ToPlayer);
    this.saveNow();
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
    const players = this.players.map((p) => ({ id: p.id, f: p.color, name: p.name, ...(p.bot ? { bot: p.bot } : {}) }));
    const start: StartMsg = { t: 'start', seed: this.seed, mapId: this.mapId, players };
    this.started = start;
    this.hub?.broadcast(start);
    void this.sig?.setPhase(this.code, 'playing').catch(() => {});
    this.waiting = new Set(this.players.filter((p) => !p.host && !p.bot).map((p) => p.id));
    this.hostReady = false;
    this.saveNow();
    this.begin(start, true);
  }

  private readyFrom(uid: string): void {
    const p = this.players.find((q) => q.id === uid);
    if (this.rejoining.has(uid)) {
      // back in: play on (once the host's own game is going again)
      if (!this.live) return void this.readied.add(uid);
      this.rejoining.delete(uid);
      this.hub?.send(uid, { t: 'go' } satisfies ToPlayer);
      if (p) {
        p.away = false;
        this.hub?.broadcast({ t: 'back', name: p.name } satisfies ToPlayer);
        this.match?.onBack(p.name);
      }
      return;
    }
    if (p) p.away = false;
    this.waiting.delete(uid);
    this.maybeGo();
  }

  private maybeGo(): void {
    if (!this.match || !this.hostReady || this.waiting.size) return;
    clearTimeout(this.readyWait);
    this.waiting.clear();
    this.hub?.broadcast({ t: 'go' } satisfies ToPlayer);
    this.goLive();
  }

  // ---------- Bots (the host) ----------

  private botN = 0;
  private addBot(): void {
    if (this.mode !== 'host' || this.started || this.players.length >= MAX_PLAYERS) return;
    const used = new Set(this.players.map((p) => p.name));
    let n = 1;
    while (used.has(`Bot ${n}`)) n++;
    this.players.push({ id: `bot-${Date.now().toString(36)}-${this.botN++}`, name: `Bot ${n}`, color: this.freeColor(-1, ''), bot: 'normal' });
    this.fitMap();
    this.sendLobby();
  }
  private setBot(id: string, change: { bot?: BotLevel; color?: number } | null): void {
    const p = this.players.find((q) => q.id === id && q.bot);
    if (!p || this.started) return;
    if (!change) this.players = this.players.filter((q) => q !== p);
    else {
      if (change.bot) p.bot = change.bot;
      if (change.color !== undefined) p.color = this.freeColor(change.color, p.id);
    }
    this.fitMap();
    this.sendLobby();
  }

  // ---------- Saving (the host) ----------

  private lastSnap: Snapshot | null = null;
  private lastOre: number[] | undefined;
  private savedAt = 0;

  private keepSnapshot(s: Snapshot): void {
    if (s.ore) this.lastOre = s.ore;
    this.lastSnap = s;
    if (performance.now() - this.savedAt > SAVE_MS) this.saveNow();
  }

  private saveNow(): void {
    if (this.mode !== 'host' || !this.code) return;
    this.savedAt = performance.now();
    const snap = this.lastSnap && this.started ? { ...this.lastSnap, gone: [], told: [], ore: this.lastOre } : undefined;
    const s: HostSave = { uid: this.you, at: Date.now(), players: this.players, mapId: this.mapId, seed: this.seed, started: this.started ?? undefined, snap };
    save(hostKey(this.code), JSON.stringify(s));
  }

  // ---------- A player ----------

  // Join the room in the code box. Again and again for a while if `keepTrying`
  // (you were in it, and the host may be away for a moment).
  private async join(keepTrying = false): Promise<void> {
    const code = normalizeCode(this.joinCode);
    if (!isValidCode(code)) {
      this.error = 'Room codes are four letters.';
      this.render();
      return;
    }
    this.setBusy(keepTrying ? `Waiting for the host of ${code}` : `Joining ${code}`);
    if (keepTrying) {
      this.code = code;
      this.rejoinUntil = Date.now() + REJOIN_MS;
      return this.rejoin();
    }
    try {
      const sig = await this.signaling();
      const phase = await sig.roomPhase(code);
      if (!phase) throw new Error(`There is no room ${code}.`);
      await this.connect(code);
      this.setBusy('');
    } catch (err) {
      this.fail(err);
    }
  }

  private async connect(code: string): Promise<void> {
    const sig = await this.signaling();
    const { join } = await import('./net/link');
    this.link = await join(sig, code, (m) => this.fromHost(m as ToPlayer), () => this.hostGone());
    this.code = code;
    this.mode = 'player';
    this.you = this.link.uid;
    save(ROOM_KEY, JSON.stringify({ code, at: Date.now() }));
    setPath(`/${code}`);
    this.link.send({ t: 'hello', name: this.name, color: this.color } satisfies ToHost);
  }

  // Back to the host after losing it: try until it answers, or until it's clear it won't.
  private rejoining_ = false;
  private async rejoin(): Promise<void> {
    if (this.rejoining_) return;
    this.rejoining_ = true;
    const code = this.code;
    try {
      while (this.code === code && Date.now() < this.rejoinUntil) {
        try {
          await this.connect(code);
          this.setBusy('');
          return;
        } catch (err) {
          console.info('host not back yet', err);
          await new Promise((r) => setTimeout(r, REJOIN_GAP_MS));
        }
      }
      if (this.code !== code) return;
      // the host isn't coming back
      if (this.match) this.match.onHostGone();
      else {
        this.toHome();
        this.error = `Lost touch with the host of ${code}.`;
        this.render();
      }
    } finally {
      this.rejoining_ = false;
    }
  }

  private fromHost(m: ToPlayer): void {
    switch (m.t) {
      case 'lobby':
        this.players = m.players;
        this.mapId = m.mapId;
        this.seed = m.seed;
        this.you = m.you;
        // the host gives you a color nobody else has
        this.color = m.players.find((p) => p.id === m.you)?.color ?? this.color;
        this.render();
        break;
      case 'start':
        // back with the host in a game you are already playing: say you're ready
        if (this.match && this.match.seed === m.seed && this.match.mapId === m.mapId) this.link?.send({ t: 'ready' } satisfies ToHost);
        else this.begin(m, false);
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
      case 'back':
        this.match?.onBack(m.name);
        break;
      case 'no':
        this.link?.close();
        this.link = null;
        this.toHome();
        save(ROOM_KEY, null);
        this.fail(new Error(m.why));
        break;
    }
  }

  private hostGone(): void {
    this.link = null;
    if (this.mode !== 'player') return;
    this.rejoinUntil = Date.now() + REJOIN_MS;
    if (this.match) this.match.onHostLost();
    else this.setBusy('Waiting for the host');
    void this.rejoin();
  }

  // ---------- Starting ----------

  private begin(m: StartMsg, host: boolean, resume?: Snapshot): void {
    const me = m.players.find((p) => p.id === this.you)?.f ?? 0;
    const match: Match = {
      seed: m.seed,
      mapId: m.mapId,
      players: m.players.map(({ f, name, bot }) => (bot ? { f, name, bot } : { f, name })),
      me,
      host,
      resume,
      ready: () => {
        if (!host) return this.link?.send({ t: 'ready' } satisfies ToHost);
        // the host back after a reload: carry on (the others are let in as they come back)
        if (resume) return this.goLive();
        this.hostReady = true;
        // nobody holds the game up for long
        this.readyWait = window.setTimeout(() => {
          this.waiting.clear();
          this.maybeGo();
        }, READY_WAIT_MS);
        this.maybeGo();
      },
      onGo: () => {},
      onCommand: () => {},
      sendSnapshot: (s) => {
        this.hub?.broadcast({ t: 'snap', s } satisfies ToPlayer, true);
        this.keepSnapshot(s);
      },
      sendCommand: (cmd) => this.link?.send({ t: 'cmd', cmd } satisfies ToHost),
      onSnapshot: () => {},
      onLeft: () => {},
      onBack: () => {},
      onHostLost: () => {},
      onHostGone: () => {},
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
      save(hostKey(this.code), null);
    }
    this.link?.close();
    save(ROOM_KEY, null);
    this.toHome();
    this.error = '';
    this.show();
  }

  private toHome(): void {
    clearTimeout(this.readyWait);
    this.hub = null;
    this.link = null;
    this.match = null;
    this.started = null;
    this.lastSnap = null;
    this.lastOre = undefined;
    this.rejoining.clear();
    this.readied.clear();
    this.live = false;
    this.mode = 'home';
    this.players = [];
    this.code = '';
    this.color = -1;
    this.busy = '';
    setPath('/');
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
    if (this.mode === 'home') setPath('/');
    this.render();
  }

  private setName(v: string): void {
    this.name = v.slice(0, 16);
    save('ra-name', this.name);
    this.sendMe();
  }
  private setColor(c: number): void {
    if (this.players.some((p) => p.color === c && p.id !== this.you)) return;
    this.color = c;
    this.sendMe();
    this.render();
  }
  // tell the room your name and color
  private sendTimer = 0;
  private sendMe(): void {
    if (this.mode === 'home') return;
    clearTimeout(this.sendTimer);
    this.sendTimer = window.setTimeout(() => {
      if (this.mode === 'player') this.link?.send({ t: 'hello', name: this.name, color: this.color } satisfies ToHost);
      if (this.mode === 'host' && !this.started) {
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

  private preview(id: string): HTMLCanvasElement {
    const key = `${id}:${this.seed}`;
    let c = this.previews.get(key);
    if (!c) {
      const def = MAPS.find((m) => m.id === id)!;
      const ws = worldOf(def, 128 * 80, 128 * 40);
      c = mapPreview(def, this.seed, ws.w, ws.h, 120, 60, true);
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

    if (this.mode === 'home') box.append(this.homeView());
    else box.append(this.roomView());

    if (this.busy) box.append(el('div', 'busy', `${this.busy}…`));
    if (this.error) box.append(el('div', 'err', this.error));

    const kids: HTMLElement[] = [box];
    if (this.mode === 'home') {
      const test = el('button', 'testMode', 'Test mode');
      test.type = 'button';
      test.title = 'Play alone against the computer, with the test stages';
      test.addEventListener('click', () => this.hooks.solo());
      kids.push(test);
    }
    this.root.replaceChildren(...kids);
    if (focused) {
      const f = document.getElementById(focused) as HTMLInputElement | null;
      if (f) {
        f.focus();
        f.setSelectionRange?.(f.value.length, f.value.length);
      }
    }
  }

  private nameInput(): HTMLElement {
    const nameLab = el('label', 'field');
    nameLab.append(el('span', 'lab', 'Name'));
    const input = el('input');
    input.id = 'lobbyName';
    input.maxLength = 16;
    input.value = this.name;
    input.placeholder = 'Your name';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => this.setName(input.value));
    nameLab.append(input);
    return nameLab;
  }

  // A bot's difficulty and color, and taking it out (the host).
  private botControls(p: LobbyPlayer): HTMLElement {
    const box = el('span', 'botCtl');
    const level = el('select');
    level.setAttribute('aria-label', `${p.name} difficulty`);
    for (const l of BOT_LEVELS) {
      const o = el('option', '', l.name);
      o.value = l.id;
      o.selected = l.id === p.bot;
      level.append(o);
    }
    level.addEventListener('change', () => this.setBot(p.id, { bot: level.value as BotLevel }));
    const color = el('select');
    color.setAttribute('aria-label', `${p.name} color`);
    const taken = new Set(this.players.filter((q) => q !== p).map((q) => q.color));
    FACTIONS.forEach((f, i) => {
      if (taken.has(i)) return;
      const o = el('option', '', f.name);
      o.value = String(i);
      o.selected = i === p.color;
      color.append(o);
    });
    color.addEventListener('change', () => this.setBot(p.id, { color: Number(color.value) }));
    const rm = el('button', 'rm', '×');
    rm.type = 'button';
    rm.title = `Remove ${p.name}`;
    rm.setAttribute('aria-label', `Remove ${p.name}`);
    rm.addEventListener('click', () => this.setBot(p.id, null));
    box.append(level, color, rm);
    return box;
  }

  private homeView(): HTMLElement {
    const v = el('div', 'home');
    v.append(this.nameInput());
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
    return v;
  }

  private roomView(): HTMLElement {
    const v = el('div', 'room');
    const code = el('div', 'code', this.code);
    code.setAttribute('aria-label', `Room code ${this.code.split('').join(' ')}`);
    v.append(code);

    // you: name and color
    const you = el('div', 'you');
    you.append(this.nameInput());
    const colors = el('div', 'field');
    colors.append(el('span', 'lab', 'Color'));
    const sw = el('div', 'swatches');
    sw.setAttribute('role', 'radiogroup');
    sw.setAttribute('aria-label', 'Your color');
    const taken = new Set(this.players.filter((p) => p.id !== this.you).map((p) => p.color));
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
    v.append(you);

    const list = el('ul', 'players');
    for (const p of this.players) {
      const li = el('li');
      const dot = el('i', 'dot');
      dot.style.setProperty('--c', p.color >= 0 ? hexOf(p.color) : 'transparent');
      li.append(dot, el('span', 'pname', p.name || 'Player'));
      if (p.bot && this.mode === 'host') {
        li.classList.add('bot');
        li.append(this.botControls(p));
        list.append(li);
        continue;
      }
      if (p.bot) li.append(el('span', 'tag', BOT_LEVELS.find((l) => l.id === p.bot)?.name ?? 'bot'));
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
    if (this.mode === 'host' && this.players.length < MAX_PLAYERS) {
      const add = el('button', 'small addBot', '+ Add bot');
      add.type = 'button';
      add.addEventListener('click', () => this.addBot());
      v.append(add);
    }

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
      card.append(this.preview(m.id));
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

    const row = el('div', 'actions');
    const leave = el('button', 'small', this.mode === 'host' ? 'Close room' : 'Leave');
    leave.type = 'button';
    leave.addEventListener('click', () => this.leave());
    row.append(leave);
    if (this.mode === 'host') {
      const go = el('button', 'big', this.players.length < 2 ? 'Start alone' : `Start · ${this.players.length} players`);
      go.type = 'button';
      go.addEventListener('click', () => this.startGame());
      row.append(go);
    } else row.append(el('span', 'hint', 'Waiting for the host to start'));
    v.append(row);
    return v;
  }
}
