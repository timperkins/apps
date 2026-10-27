import { play } from '../audio/sound';
import { Brain, type Difficulty } from '../game/ai';
import { MAX_SNAKES } from '../game/constants';
import { botName, COLORS, PATTERNS, type Look } from '../game/looks';
import { pickWinner, ranking, World, type SnakeInput, type WorldEvent } from '../game/world';
import type { ControllerMessage, DisplayMessage, PlayerStatus } from '../net/protocol';
import { updateRoom, type Phase } from '../net/rooms';
import { DisplayHub } from '../net/rtc';
import type { Burst } from '../render/draw';

const COUNTDOWN_S = 3;
const STATUS_EVERY_S = 0.25;
const VIEW_EVERY_S = 0.5;
// A phone that stays away this long loses its snake; until then a bot flies it.
const DROP_AFTER_S = 120;

export interface Setup {
  bots: number;
  difficulty: Difficulty;
  // Seconds; 0 means no timer.
  timer: number;
}

export const DEFAULT_SETUP: Setup = { bots: 0, difficulty: 'normal', timer: 0 };

export interface Standing {
  id: string;
  name: string;
  color: string;
  bot: boolean;
  connected: boolean;
  alive: boolean;
  mass: number;
  best: number;
  kills: number;
}

export interface HostView {
  phase: Phase | 'countdown';
  countdown: number;
  timeLeft: number | null;
  standings: Standing[];
  humans: number;
  setup: Setup;
  winner: Standing | null;
}

interface Player {
  uid: string;
  connected: boolean;
  goneSince: number;
  input: SnakeInput;
  look: Look | null;
  autopilot: Brain;
}

// Owns everything the display does: players, bots, the WebRTC hub, phases and the world.
export class HostSession {
  world = new World();
  // Death rings for the renderer, which removes them once they fade.
  readonly bursts: Burst[] = [];
  private phase: HostView['phase'] = 'lobby';
  private setup: Setup;
  private players = new Map<string, Player>();
  private bots = new Map<string, Brain>();
  private botSerial = 0;
  private countdown = 0;
  private timeLeft = 0;
  private winnerId: string | null = null;
  private statusTimer = 0;
  private viewTimer = 0;
  private eatSoundTimer = 0;
  private hub: DisplayHub;
  private lastView = '';

  constructor(
    private code: string,
    setup: Setup,
    private onView: (view: HostView) => void,
  ) {
    this.setup = { ...setup };
    this.hub = new DisplayHub(code, {
      onConnected: (uid) => this.connect(uid),
      onDisconnected: (uid) => this.disconnect(uid),
      onMessage: (uid, msg) => this.handleMessage(uid, msg),
    });
    this.syncBots();
    this.emit(true);
  }

  dispose(): void {
    this.hub.close();
  }

  get currentPhase(): HostView['phase'] {
    return this.phase;
  }

  changeSetup(setup: Setup): void {
    this.setup = { ...setup };
    for (const brain of this.bots.values()) brain.difficulty = setup.difficulty;
    this.syncBots();
    this.emit(true);
  }

  start(): void {
    if (this.phase !== 'lobby' && this.phase !== 'over') return;
    this.world.reset();
    this.winnerId = null;
    this.timeLeft = this.setup.timer;
    this.countdown = COUNTDOWN_S;
    this.setPhase('countdown');
    play('tick');
  }

  // Ends a game early (or one with no timer); the biggest living snake wins.
  end(): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return;
    this.winnerId = pickWinner(this.world.snakes)?.id ?? null;
    play('end');
    this.setPhase('over');
  }

  backToLobby(): void {
    this.world.reset();
    this.winnerId = null;
    this.setPhase('lobby');
  }

  update(dt: number): void {
    // Phones that have been gone too long give up their snake.
    for (const p of this.players.values()) {
      if (!p.connected && this.world.time - p.goneSince > DROP_AFTER_S && this.world.get(p.uid)) {
        this.world.removeSnake(p.uid);
        this.players.delete(p.uid);
        this.syncBots();
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

    const events = this.world.step(dt, this.inputs());
    this.handleEvents(events);
    this.eatSoundTimer = Math.max(0, this.eatSoundTimer - dt);

    if (this.phase === 'playing' && this.setup.timer > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.winnerId = pickWinner(this.world.snakes)?.id ?? null;
        play('end');
        this.setPhase('over');
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

  private inputs(): Map<string, SnakeInput> {
    const inputs = new Map<string, SnakeInput>();
    for (const snake of this.world.snakes) {
      if (!snake.alive) continue;
      const brain = this.bots.get(snake.id);
      if (brain) {
        inputs.set(snake.id, brain.decide(this.world, snake));
        continue;
      }
      const player = this.players.get(snake.id);
      if (!player) continue;
      inputs.set(snake.id, player.connected ? player.input : player.autopilot.decide(this.world, snake));
    }
    return inputs;
  }

  private handleEvents(events: WorldEvent[]): void {
    for (const e of events) {
      if (e.type === 'eat') {
        if (this.eatSoundTimer === 0) {
          play('eat');
          this.eatSoundTimer = 0.08;
        }
      } else if (e.type === 'death') {
        play('death');
        this.bursts.push({ x: e.x, y: e.y, color: e.color, at: this.world.time });
        const killer = e.by ? this.world.get(e.by) : undefined;
        this.hub.send(e.id, { t: 'died', by: killer?.name ?? null });
        this.sendStatus(e.id);
      }
    }
  }

  private connect(uid: string): void {
    let player = this.players.get(uid);
    if (!player) {
      player = { uid, connected: true, goneSince: 0, input: { s: 0, boost: false }, look: null, autopilot: new Brain('normal') };
      this.players.set(uid, player);
    }
    player.connected = true;
    player.input = { s: 0, boost: false };
    if (!this.world.get(uid) && this.humanSnakes() < MAX_SNAKES) {
      this.world.addSnake(uid, player.look ?? this.defaultLook(), false);
      if (this.phase === 'countdown' || this.phase === 'over') this.world.get(uid)!.protectedUntil = Infinity;
    }
    this.syncBots();
    this.sendStatus(uid);
    this.emit(true);
  }

  private disconnect(uid: string): void {
    const player = this.players.get(uid);
    if (!player) return;
    player.connected = false;
    player.goneSince = this.world.time;
    // Without a snake there is nothing to keep.
    if (!this.world.get(uid)) this.players.delete(uid);
    this.emit(true);
  }

  private handleMessage(uid: string, msg: ControllerMessage): void {
    const player = this.players.get(uid);
    if (!player) return;
    if (msg.t === 'steer') {
      player.input = { s: msg.s, boost: msg.boost };
    } else if (msg.t === 'look') {
      const color = this.takenBy(msg.color, uid, true) ? this.freeColor(uid) : msg.color;
      const snake = this.world.get(uid);
      const name = msg.name || player.look?.name || snake?.name || this.defaultLook().name;
      player.look = { name, color, pattern: msg.pattern };
      if (snake) Object.assign(snake, player.look);
      // A bot wearing the color steps aside for the human.
      for (const s of this.world.snakes) {
        if (s.bot && s.color === color) s.color = this.freeColor(s.id);
      }
      this.broadcast();
      this.emit(true);
    }
  }

  private humanSnakes(): number {
    return this.world.snakes.filter((s) => !s.bot).length;
  }

  // Bots fill the setup's count, but humans always get a snake first.
  private syncBots(): void {
    const want = Math.max(0, Math.min(this.setup.bots, MAX_SNAKES - this.humanSnakes()));
    const bots = this.world.snakes.filter((s) => s.bot);
    for (let i = bots.length; i < want; i++) {
      const id = `bot-${this.botSerial++}`;
      const look: Look = {
        name: botName(this.botSerial - 1),
        color: this.freeColor(id),
        pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      };
      this.world.addSnake(id, look, true);
      this.bots.set(id, new Brain(this.setup.difficulty));
    }
    for (const bot of bots.slice(want)) {
      this.world.removeSnake(bot.id);
      this.bots.delete(bot.id);
    }
  }

  private takenBy(color: string, except: string, humansOnly = false): boolean {
    return this.world.snakes.some((s) => s.id !== except && s.color === color && (!humansOnly || !s.bot));
  }

  private freeColor(except: string): string {
    return COLORS.find((c) => !this.takenBy(c, except)) ?? COLORS[0];
  }

  private defaultLook(): Look {
    return { name: `Player ${this.players.size}`, color: this.freeColor(''), pattern: 'solid' };
  }

  private setPhase(phase: HostView['phase']): void {
    this.phase = phase;
    if (phase === 'playing') {
      // Snakes that joined during the countdown were held still; release them.
      for (const s of this.world.snakes) {
        if (s.protectedUntil === Infinity) s.protectedUntil = this.world.time + 2;
      }
    }
    if (phase !== 'countdown') void updateRoom(this.code, { phase }).catch(() => {});
    this.broadcast();
    this.emit(true);
  }

  private status(uid: string, order: string[]): PlayerStatus | null {
    const snake = this.world.get(uid);
    if (!snake) return null;
    return {
      name: snake.name,
      color: snake.color,
      pattern: snake.pattern,
      alive: snake.alive,
      mass: Math.floor(snake.mass),
      best: Math.floor(snake.best),
      kills: snake.kills,
      rank: order.indexOf(uid) + 1,
      respawnIn: snake.alive ? 0 : Math.max(0, Math.ceil(snake.respawnAt - this.world.time)),
      protected: snake.alive && this.world.isProtected(snake),
    };
  }

  private message(uid: string, order: string[]): DisplayMessage {
    const winner = this.winnerId ? this.world.get(this.winnerId) : undefined;
    return {
      t: 'state',
      phase: this.phase,
      you: this.status(uid, order),
      full: !this.world.get(uid) && this.humanSnakes() >= MAX_SNAKES,
      snakes: this.world.snakes.length,
      taken: this.world.snakes.filter((s) => s.id !== uid && !s.bot).map((s) => s.color),
      timeLeft: this.setup.timer > 0 && this.phase !== 'lobby' ? Math.ceil(this.timeLeft) : null,
      winner: winner?.name ?? null,
    };
  }

  private sendStatus(uid: string): void {
    const order = ranking(this.world.snakes).map((s) => s.id);
    this.hub.send(uid, this.message(uid, order));
  }

  private broadcast(): void {
    const order = ranking(this.world.snakes).map((s) => s.id);
    for (const p of this.players.values()) {
      if (p.connected) this.hub.send(p.uid, this.message(p.uid, order));
    }
  }

  private standing(id: string): Standing | null {
    const s = this.world.get(id);
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      bot: s.bot,
      connected: s.bot || !!this.players.get(s.id)?.connected,
      alive: s.alive,
      mass: Math.floor(s.mass),
      best: Math.floor(s.best),
      kills: s.kills,
    };
  }

  private emit(force = false): void {
    const view: HostView = {
      phase: this.phase,
      countdown: Math.ceil(this.countdown),
      timeLeft: this.setup.timer > 0 && this.phase !== 'lobby' ? Math.ceil(this.timeLeft) : null,
      standings: ranking(this.world.snakes)
        .map((s) => this.standing(s.id))
        .filter((s): s is Standing => s !== null),
      humans: this.humanSnakes(),
      setup: { ...this.setup },
      winner: this.winnerId ? this.standing(this.winnerId) : null,
    };
    const key = JSON.stringify(view);
    if (!force && key === this.lastView) return;
    this.lastView = key;
    this.onView(view);
  }
}
