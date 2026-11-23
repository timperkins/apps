import { play } from '../audio/sound';
import { Bot } from '../game/bot';
import * as K from '../game/constants';
import { COLORS, defaultName, type FishKind, type Role } from '../game/looks';
import { World, teamTotals, type BoatInput, type FishInput, type WorldEvent } from '../game/world';
import type { Action, ControllerMessage, DisplayMessage, YouStatus } from '../net/protocol';
import { updateRoom, type Phase } from '../net/rooms';
import { DisplayHub } from '../net/rtc';

const STATUS_EVERY_S = 0.2;
const VIEW_EVERY_S = 0.5;
// A phone that stays away this long loses its boat or fish.
const DROP_AFTER_S = 120;
// The player who uses the display itself (a phone hosting and playing at once).
export const LOCAL_ID = 'local';
const BOT_IDS: Record<Role, string> = { raider: 'bot-raider', swimmer: 'bot-swimmer' };
const BOT_NAMES: Record<Role, string> = { raider: 'Bot Barnacle', swimmer: 'Bot Guppy' };

export interface PlayerRow {
  id: string;
  name: string;
  color: string;
  role: Role;
  connected: boolean;
  bot: boolean;
  local: boolean;
  score: number;
  detail: string;
}

export interface HostView {
  phase: Phase | 'countdown';
  countdown: number;
  timeLeft: number | null;
  players: PlayerRow[];
  waiting: number;
  crew: number;
  school: number;
  winner: 'crew' | 'school' | 'tie' | null;
  botsOn: boolean;
}

interface Player {
  uid: string;
  connected: boolean;
  goneSince: number;
  role: Role | null;
  name: string;
  color: string;
  kind: FishKind;
  input: { x: number; y: number; hold: boolean };
  diedBy: string | null;
  thrashedFight: number;
  bot?: Bot;
}

// Owns everything the display does: players, the WebRTC hub, round phases and the world.
export class HostSession {
  world = new World();
  private phase: HostView['phase'] = 'lobby';
  private players = new Map<string, Player>();
  private countdown = 0;
  private timeLeft = 0;
  private winner: HostView['winner'] = null;
  private statusTimer = 0;
  private viewTimer = 0;
  private hub: DisplayHub;
  private lastView = '';
  private soundGate = new Map<string, number>();
  private botsOn = true;
  // Status for the local player, who has no data channel.
  onLocalStatus: ((msg: DisplayMessage) => void) | null = null;

  constructor(
    private code: string,
    private onView: (view: HostView) => void,
    private onEvent: (e: WorldEvent) => void,
  ) {
    this.hub = new DisplayHub(code, {
      onConnected: (uid) => this.connect(uid),
      onDisconnected: (uid) => this.disconnect(uid),
      onMessage: (uid, msg) => this.handleMessage(uid, msg),
    });
    this.world.reset();
    this.emit(true);
  }

  dispose(): void {
    this.hub.close();
  }

  // ---- The local player and bots ----

  local(msg: ControllerMessage): void {
    if (!this.players.has(LOCAL_ID)) {
      this.connect(LOCAL_ID);
    }
    this.handleMessage(LOCAL_ID, msg);
  }

  setBots(on: boolean): void {
    this.botsOn = on;
    this.syncBots();
    this.emit(true);
  }

  // With bots on, an easy bot fills in for a side that has no people.
  private syncBots(): void {
    const humans = [...this.players.values()].filter((p) => p.role && !p.bot);
    for (const role of ['raider', 'swimmer'] as Role[]) {
      const id = BOT_IDS[role];
      const want = this.botsOn && humans.length > 0 && !humans.some((p) => p.role === role);
      const have = this.players.has(id);
      if (want && !have) {
        const taken = this.takenColors(id);
        const color = COLORS.find((c) => !taken.includes(c)) ?? COLORS[0];
        const p: Player = {
          uid: id,
          connected: true,
          goneSince: 0,
          role,
          name: BOT_NAMES[role],
          color,
          kind: 'fish',
          input: { x: 0, y: 0, hold: false },
          diedBy: null,
          thrashedFight: -1,
          bot: new Bot(id),
        };
        this.players.set(id, p);
        if (role === 'raider') this.world.addRaider(id, p.name, color);
        else this.world.addSwimmer(id, p.name, color, 'fish');
      } else if (!want && have) {
        this.world.removePlayer(id);
        this.players.delete(id);
      } else if (have) {
        const p = this.players.get(id)!;
        const used = [...this.players.values()].filter((o) => o !== p && o.role).map((o) => o.color);
        if (used.includes(p.color)) {
          p.color = COLORS.find((c) => !used.includes(c)) ?? p.color;
          this.world.setLook(id, p.name, p.color);
        }
      }
    }
  }

  private runBots(): void {
    for (const p of this.players.values()) {
      if (!p.bot) continue;
      const out = p.bot.step(this.world);
      p.input = { x: out.x, y: out.y, hold: out.hold };
      for (const a of out.acts) this.act(p, a);
    }
  }

  start(): void {
    if (this.phase !== 'lobby' && this.phase !== 'over') return;
    this.world.reset();
    this.winner = null;
    this.timeLeft = K.ROUND_S;
    this.countdown = K.COUNTDOWN_S;
    this.setPhase('countdown');
    play('tick');
  }

  end(): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return;
    this.finish();
  }

  backToLobby(): void {
    this.world.reset();
    this.winner = null;
    this.setPhase('lobby');
  }

  update(dt: number): void {
    for (const p of [...this.players.values()]) {
      if (!p.connected && this.world.time - p.goneSince > DROP_AFTER_S) {
        this.world.removePlayer(p.uid);
        this.players.delete(p.uid);
        this.syncBots();
        this.emit(true);
      }
    }

    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (this.countdown <= 0) {
        play('go');
        this.setPhase('playing');
      } else if (Math.ceil(this.countdown) !== before) {
        play('tick');
        this.emit(true);
      }
      return;
    }
    if (this.phase === 'over') return;

    this.runBots();
    const humans = this.players.size;
    this.world.npcTarget = Math.max(K.NPC_MIN, Math.round(K.NPC_TARGET - humans * K.NPC_PER_PLAYER));
    const events = this.world.step(dt, this.fishInputs(), this.boatInputs());
    for (const e of events) this.handleEvent(e);

    if (this.phase === 'playing') {
      this.timeLeft -= dt;
      this.world.deep = this.timeLeft <= K.DEEP_LINE_AT_S;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finish();
        return;
      }
    }

    this.statusTimer -= dt;
    if (this.statusTimer <= 0) {
      this.statusTimer = STATUS_EVERY_S;
      this.broadcast();
    }
    this.viewTimer -= dt;
    if (this.viewTimer <= 0) {
      this.viewTimer = VIEW_EVERY_S;
      this.emit();
    }
  }

  get hud(): { crew: number; school: number; timeLeft: number | null } {
    const totals = teamTotals(this.world);
    return { ...totals, timeLeft: this.phase === 'playing' || this.phase === 'countdown' ? Math.ceil(this.timeLeft) : null };
  }

  private finish(): void {
    const { crew, school } = teamTotals(this.world);
    this.winner = crew > school ? 'crew' : school > crew ? 'school' : 'tie';
    play('end');
    this.setPhase('over');
  }

  private fishInputs(): Map<string, FishInput> {
    const m = new Map<string, FishInput>();
    for (const p of this.players.values()) if (p.role === 'swimmer' && p.connected) m.set(p.uid, { x: p.input.x, y: p.input.y });
    return m;
  }

  private boatInputs(): Map<string, BoatInput> {
    const m = new Map<string, BoatInput>();
    for (const p of this.players.values()) if (p.role === 'raider' && p.connected) m.set(p.uid, { x: p.input.x, reel: p.input.hold });
    return m;
  }

  private sound(name: Parameters<typeof play>[0], gap = 0.06): void {
    const last = this.soundGate.get(name) ?? -1;
    if (this.world.time - last < gap) return;
    this.soundGate.set(name, this.world.time);
    play(name);
  }

  private handleEvent(e: WorldEvent): void {
    this.onEvent(e);
    switch (e.type) {
      case 'eat':
        this.sound(e.player ? 'chomp' : 'eat');
        break;
      case 'cast':
        this.sound('cast');
        break;
      case 'bite':
        this.sound('bite');
        this.sendStatus(e.boat);
        this.sendStatus(e.fish);
        break;
      case 'catch':
        this.sound('catch');
        this.sendStatus(e.boat);
        break;
      case 'escape':
        this.sound('escape');
        this.sendStatus(e.boat);
        this.sendStatus(e.fish);
        break;
      case 'coin':
        this.sound('coin');
        break;
      case 'ram':
        this.sound('ram');
        break;
      case 'sink':
        this.sound('sink');
        this.sendStatus(e.boat);
        break;
      case 'levelUp':
        if (this.players.has(e.id)) this.sound('level');
        break;
      case 'peteArrive':
        this.sound('pete');
        this.broadcast();
        break;
      case 'peteLeave':
        this.broadcast();
        break;
      case 'sell':
        this.sound('sell', 0.03);
        this.sendStatus(e.boat);
        break;
      case 'taunt':
        this.sound('taunt');
        break;
      case 'died': {
        const p = this.players.get(e.id);
        if (p) {
          const by = e.by ? (this.world.get(e.by)?.name ?? this.world.boat(e.by)?.name ?? null) : null;
          p.diedBy = by;
          this.sendStatus(e.id);
        }
        break;
      }
      default:
    }
  }

  private connect(uid: string): void {
    let p = this.players.get(uid);
    if (!p) {
      p = { uid, connected: true, goneSince: 0, role: null, name: '', color: '', kind: 'fish', input: { x: 0, y: 0, hold: false }, diedBy: null, thrashedFight: -1 };
      this.players.set(uid, p);
    }
    p.connected = true;
    p.input = { x: 0, y: 0, hold: false };
    this.sendStatus(uid);
    this.emit(true);
  }

  private disconnect(uid: string): void {
    const p = this.players.get(uid);
    if (!p) return;
    p.connected = false;
    p.goneSince = this.world.time;
    if (!p.role) {
      this.players.delete(uid);
      this.syncBots();
    }
    this.emit(true);
  }

  private count(role: Role, except?: string): number {
    return [...this.players.values()].filter((p) => p.role === role && p.uid !== except && !p.bot).length;
  }

  private handleMessage(uid: string, msg: ControllerMessage): void {
    const p = this.players.get(uid);
    if (!p) return;
    if (msg.t === 'in') {
      p.input = { x: msg.x, y: msg.y, hold: msg.hold };
      return;
    }
    if (msg.t === 'join') {
      const between = this.phase === 'lobby' || this.phase === 'over';
      // Switching sides mid-round is not allowed; a look change is.
      const role = p.role && !between ? p.role : msg.role;
      const max = role === 'raider' ? K.MAX_RAIDERS : K.MAX_SWIMMERS;
      if (role !== p.role && this.count(role, uid) >= max) {
        this.sendStatus(uid);
        return;
      }
      const taken = this.takenColors(uid);
      const color = msg.color && !taken.includes(msg.color) ? msg.color : (COLORS.find((c) => !taken.includes(c)) ?? COLORS[0]);
      const name = msg.name || p.name || defaultName(role, this.count(role, uid));
      const changedRole = role !== p.role || (role === 'swimmer' && msg.kind !== p.kind);
      Object.assign(p, { role, name, color, kind: msg.kind });
      if (changedRole) {
        if (role === 'raider') this.world.addRaider(uid, name, color);
        else this.world.addSwimmer(uid, name, color, msg.kind);
      } else this.world.setLook(uid, name, color);
      this.syncBots();
      this.broadcast();
      this.emit(true);
      return;
    }
    this.act(p, msg.a);
  }

  private act(p: Player, a: Action): void {
    if (this.phase === 'countdown' || this.phase === 'over') return;
    const w = this.world;
    const uid = p.uid;
    switch (a) {
      case 'cast':
        w.cast(uid);
        break;
      case 'tap':
        w.reelTap(uid, false);
        break;
      case 'heave':
        w.reelTap(uid, true);
        break;
      case 'pull':
        w.pullTap(uid);
        break;
      case 'thrash': {
        const f = w.get(uid);
        const b = f?.hookedBy ? w.boat(f.hookedBy) : undefined;
        if (b && p.thrashedFight !== b.hook.fightStart) {
          p.thrashedFight = b.hook.fightStart;
          w.thrash(uid);
        }
        break;
      }
      case 'dash':
        w.dash(uid);
        break;
      case 'egg':
        w.layEgg(uid);
        break;
      case 'taunt':
        w.taunt(uid);
        break;
      case 'sell':
        w.sell(uid);
        break;
      case 'find':
        w.findMe(uid);
        break;
    }
  }

  private takenColors(except: string): string[] {
    // Bots give way: their color changes if a person picks it.
    return [...this.players.values()].filter((p) => p.uid !== except && p.role && p.color && !p.bot).map((p) => p.color);
  }

  private setPhase(phase: HostView['phase']): void {
    this.phase = phase;
    if (phase !== 'countdown') void updateRoom(this.code, { phase }).catch(() => {});
    this.broadcast();
    this.emit(true);
  }

  private you(uid: string): YouStatus | null {
    const w = this.world;
    const t = w.time;
    const p = this.players.get(uid);
    const b = w.boat(uid);
    if (b) {
      return {
        role: 'raider',
        name: b.name,
        color: b.color,
        score: b.score,
        coins: b.coins,
        meat: b.meat,
        catches: b.catches,
        health: Math.max(0, Math.round(b.health)),
        sunk: b.sunk,
        fixIn: b.sunk ? Math.max(0, Math.ceil(b.respawnAt - t)) : 0,
        hook: b.hook.state,
        knot: Math.round(b.hook.knot),
        fightStart: b.hook.fightStart,
        depth: b.hook.state === 'ready' ? 0 : Math.round(((b.hook.y - K.SURF) / (w.lineDepth() - K.SURF)) * 100),
      };
    }
    const f = w.get(uid);
    if (f) {
      const hb = f.hookedBy ? w.boat(f.hookedBy) : undefined;
      return {
        role: 'swimmer',
        name: f.name,
        color: f.color,
        kind: f.kind === 'clown' ? 'clown' : 'fish',
        score: f.score,
        coins: f.coins,
        level: f.level,
        food: Math.min(1, f.food / K.foodToLevel(f.level)),
        alive: f.alive,
        respawnIn: f.alive ? 0 : Math.max(0, Math.ceil(f.respawnAt - t)),
        hooked: !!hb,
        knot: hb ? Math.round(hb.hook.knot) : 0,
        dashIn: Math.max(0, f.dashReadyAt - t),
        eggIn: Math.max(0, f.eggReadyAt - t),
        tauntIn: Math.max(0, f.tauntReadyAt - t),
        diedBy: p?.diedBy ?? null,
      };
    }
    return null;
  }

  private message(uid: string): DisplayMessage {
    const totals = teamTotals(this.world);
    return {
      t: 'state',
      phase: this.phase,
      you: this.you(uid),
      raiders: this.count('raider'),
      swimmers: this.count('swimmer'),
      taken: this.takenColors(uid),
      timeLeft: this.phase === 'playing' ? Math.ceil(this.timeLeft) : null,
      pete: this.world.peteHere,
      crew: totals.crew,
      school: totals.school,
      winner: this.winner,
      now: this.world.time,
    };
  }

  private sendStatus(uid: string): void {
    const p = this.players.get(uid);
    if (!p?.connected || p.bot) return;
    if (uid === LOCAL_ID) this.onLocalStatus?.(this.message(uid));
    else this.hub.send(uid, this.message(uid));
  }

  private broadcast(): void {
    for (const p of this.players.values()) this.sendStatus(p.uid);
  }

  private emit(force = false): void {
    const w = this.world;
    const rows: PlayerRow[] = [];
    for (const p of this.players.values()) {
      if (!p.role) continue;
      const b = w.boat(p.uid);
      const f = w.get(p.uid);
      rows.push({
        id: p.uid,
        name: p.name,
        color: p.color,
        role: p.role,
        connected: p.connected,
        bot: !!p.bot,
        local: p.uid === LOCAL_ID,
        score: b?.score ?? f?.score ?? 0,
        detail: b ? `${b.catches} caught` : f ? `level ${f.best}, ${f.eats} eaten` : '',
      });
    }
    rows.sort((a, b) => b.score - a.score);
    const totals = teamTotals(w);
    const view: HostView = {
      phase: this.phase,
      countdown: Math.ceil(this.countdown),
      timeLeft: this.phase === 'playing' ? Math.ceil(this.timeLeft) : null,
      players: rows,
      waiting: [...this.players.values()].filter((p) => !p.role).length,
      crew: totals.crew,
      school: totals.school,
      winner: this.winner,
      botsOn: this.botsOn,
    };
    const key = JSON.stringify(view);
    if (!force && key === this.lastView) return;
    this.lastView = key;
    this.onView(view);
  }
}
