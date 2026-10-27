import type { BattleEvent } from '../core/battle';
import {
  CPU_NAMES,
  MAX_PLAYERS,
  PLAYER_COLORS,
  TANK_DESIGNS,
  type GameConfig,
  type PlayerSetup,
  type TankDesign,
} from '../core/config';
import { MAX_HEALTH } from '../core/constants';
import type { Match, RoundSummary } from '../core/match';
import { ammo } from '../core/weapons';
import {
  PROTOCOL_VERSION,
  parseClientMsg,
  type BattleStatus,
  type ClientMsg,
  type HostMsg,
  type LobbyPlayer,
} from './protocol';
import type { HostTransport, Link } from './transport';

/** How often each phone gets a battle status update, in seconds. */
const STATUS_INTERVAL = 0.1;

export type RoomPhase = 'lobby' | 'shop' | 'battle' | 'results';

/** A phone's place in the game. Survives the phone disconnecting and coming back. */
export interface Seat {
  token: string;
  name: string;
  color: string;
  design: TankDesign;
  link: Link | null;
  /** Index into match.players once the match has started. */
  player: number;
  ready: boolean;
}

function makeToken(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return s;
}

/**
 * The host's side of a phone game: who has joined, what each phone sees, and how phone input
 * reaches the match. DOM-free, so it can be tested with the loopback transport.
 */
export class Room {
  readonly seats: Seat[] = [];
  phase: RoomPhase = 'lobby';
  match: Match | null = null;
  /** Called whenever something the host screen shows has changed. */
  onChange: () => void = () => {};
  /** Called once every connected phone has finished shopping. */
  onAllReady: () => void = () => {};

  private statusTimer = 0;
  private lastSummary: RoundSummary | null = null;

  constructor(
    readonly transport: HostTransport,
    /** Computer players, set up on the host. Their colors are re-picked around the humans'. */
    public cpus: PlayerSetup[] = [],
  ) {
    transport.onLink((link) => this.accept(link));
  }

  get room(): string {
    return this.transport.room;
  }

  close(): void {
    for (const s of this.seats) s.link?.close();
    this.transport.close();
  }

  /** Human seats plus CPUs, as the match will see them. */
  playerCount(): number {
    return this.seats.length + this.cpus.length;
  }

  /** CPUs, recolored to avoid every color a phone has picked. */
  cpuSetups(): PlayerSetup[] {
    const taken = new Set(this.seats.map((s) => s.color));
    const free = PLAYER_COLORS.filter((c) => !taken.has(c));
    const names = new Set(this.seats.map((s) => s.name.toLowerCase()));
    const spareNames = CPU_NAMES.filter((n) => !names.has(n.toLowerCase()));
    return this.cpus.map((c, i) => ({
      ...c,
      color: free[i % free.length],
      name: names.has(c.name.toLowerCase()) ? (spareNames[i] ?? `CPU ${i + 1}`) : c.name,
      design: c.design ?? TANK_DESIGNS[(i * 2 + 1) % TANK_DESIGNS.length],
    }));
  }

  // ---- Lobby -----------------------------------------------------------------------

  private accept(link: Link): void {
    let seat: Seat | null = null;
    link.onMessage((raw) => {
      const msg = parseClientMsg(raw);
      if (!msg) return;
      if (!seat) {
        if (msg.t === 'hello') seat = this.hello(link, msg);
        return;
      }
      this.handle(seat, msg);
    });
    link.onClose(() => {
      if (!seat || seat.link !== link) return;
      seat.link = null;
      if (this.phase === 'lobby') this.seats.splice(this.seats.indexOf(seat), 1);
      else if (this.phase === 'shop') this.checkReady();
      this.broadcastLobby();
      this.onChange();
    });
  }

  private hello(link: Link, msg: Extract<ClientMsg, { t: 'hello' }>): Seat | null {
    const reject = (reason: string) => {
      this.send(link, { t: 'reject', reason });
      setTimeout(() => link.close(), 500);
      return null;
    };
    if (msg.v !== PROTOCOL_VERSION) return reject('This game was updated. Reload the page to join.');

    // A phone coming back after dropping out keeps its tank.
    const existing = msg.token ? this.seats.find((s) => s.token === msg.token) : undefined;
    if (existing) {
      // Swap links first, so closing the stale one isn't mistaken for the player leaving.
      const stale = existing.link;
      existing.link = link;
      stale?.close();
      this.welcome(existing);
      this.onChange();
      return existing;
    }
    if (this.phase !== 'lobby') return reject('This game has already started.');
    if (this.playerCount() >= MAX_PLAYERS) return reject(`This game is full (${MAX_PLAYERS} tanks).`);
    if (!msg.name) return reject('Enter a name to join.');

    const taken = new Set(this.seats.map((s) => s.color));
    const seat: Seat = {
      token: makeToken(),
      name: this.uniqueName(msg.name),
      color: PLAYER_COLORS.find((c) => !taken.has(c)) ?? PLAYER_COLORS[0],
      design: TANK_DESIGNS[this.seats.length % TANK_DESIGNS.length],
      link,
      player: -1,
      ready: false,
    };
    this.seats.push(seat);
    this.welcome(seat);
    this.broadcastLobby();
    this.onChange();
    return seat;
  }

  private uniqueName(name: string): string {
    const used = new Set(this.seats.map((s) => s.name.toLowerCase()));
    if (!used.has(name.toLowerCase())) return name;
    for (let n = 2; ; n++) {
      const candidate = `${name.slice(0, 10)} ${n}`;
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
  }

  private welcome(seat: Seat): void {
    this.sendTo(seat, { t: 'welcome', token: seat.token, color: seat.color, design: seat.design });
    this.sendPhase(seat);
  }

  private broadcastLobby(): void {
    if (this.phase !== 'lobby') return;
    for (const s of this.seats) this.sendPhase(s);
  }

  lobbyPlayers(viewer: Seat | null): LobbyPlayer[] {
    return [
      ...this.seats.map((s) => ({ name: s.name, color: s.color, design: s.design, cpu: false, you: s === viewer })),
      ...this.cpuSetups().map((c) => ({ name: c.name, color: c.color, design: c.design ?? 'classic', cpu: true, you: false })),
    ];
  }

  setCpus(cpus: PlayerSetup[]): void {
    this.cpus = cpus;
    this.broadcastLobby();
    this.onChange();
  }

  // ---- Match flow ------------------------------------------------------------------

  /** The match's player list: phones first, in the order they joined, then CPUs. */
  buildPlayers(): PlayerSetup[] {
    return [
      ...this.seats.map((s) => ({ name: s.name, color: s.color, design: s.design, kind: 'human' as const, difficulty: 'normal' as const })),
      ...this.cpuSetups(),
    ];
  }

  /** Binds seats to the match's players. Call right after creating the match from buildPlayers(). */
  attach(match: Match): void {
    this.match = match;
    this.seats.forEach((s, i) => (s.player = i));
  }

  enterShop(): void {
    this.phase = 'shop';
    for (const s of this.seats) {
      s.ready = false;
      this.sendPhase(s);
    }
    this.onChange();
    this.checkReady();
  }

  enterBattle(): void {
    this.phase = 'battle';
    this.statusTimer = 0;
    for (const s of this.seats) this.sendPhase(s);
    this.sendStatus();
    this.onChange();
  }

  enterResults(summary: RoundSummary): void {
    this.phase = 'results';
    this.lastSummary = summary;
    for (const s of this.seats) this.sendPhase(s);
    this.onChange();
  }

  /** Back to the lobby for a new match with the same phones. */
  enterLobby(): void {
    this.phase = 'lobby';
    this.match = null;
    // Phones that left during the match give up their seat now.
    for (let i = this.seats.length - 1; i >= 0; i--) if (!this.seats[i].link) this.seats.splice(i, 1);
    for (const s of this.seats) {
      s.player = -1;
      s.ready = false;
    }
    this.broadcastLobby();
    this.onChange();
  }

  private checkReady(): void {
    if (this.phase !== 'shop') return;
    if (this.seats.every((s) => s.ready || !s.link)) this.onAllReady();
  }

  // ---- Battle ------------------------------------------------------------------------

  /** Sends status updates on a timer. Call every frame during a battle. */
  tick(dt: number): void {
    if (this.phase !== 'battle') return;
    this.statusTimer -= dt;
    if (this.statusTimer > 0) return;
    this.statusTimer = STATUS_INTERVAL;
    this.sendStatus();
  }

  /** Forwards what happened to each phone's tank, for buzzes and sounds. */
  battleEvents(events: BattleEvent[]): void {
    const battle = this.match?.battle;
    if (!battle) return;
    for (const ev of events) {
      if (ev.type === 'roundOver') {
        for (const s of this.seats) this.sendTo(s, { t: 'event', kind: 'roundOver' });
        continue;
      }
      if (ev.type !== 'fire' && ev.type !== 'damage' && ev.type !== 'destroyed') continue;
      const player = battle.tanks[ev.tank].player;
      const seat = this.seats.find((s) => s.player === player);
      if (!seat) continue;
      const kind = ev.type === 'fire' ? 'fired' : ev.type === 'damage' ? 'hit' : 'destroyed';
      this.sendTo(seat, { t: 'event', kind });
    }
  }

  private sendStatus(): void {
    for (const s of this.seats) {
      const status = this.status(s);
      if (status) this.sendTo(s, { t: 'status', ...status });
    }
  }

  status(seat: Seat): BattleStatus | null {
    const battle = this.match?.battle;
    if (!battle) return null;
    const tank = battle.tankOf(seat.player);
    const p = this.match!.players[seat.player];
    if (!tank || !p) return null;
    const qty = ammo(p.inventory, tank.weapon);
    const { votes, needed } = battle.drawTally();
    return {
      alive: tank.alive,
      health: Math.ceil(tank.health),
      shield: Math.ceil(tank.shield),
      angle: Math.round(tank.angle * 10) / 10,
      power: tank.power,
      maxPower: battle.maxPower(tank),
      weapon: tank.weapon,
      ammo: qty === Infinity ? -1 : qty,
      repairKits: p.inventory.repairKit,
      fullHealth: tank.health >= MAX_HEALTH,
      powerCells: p.inventory.powerCell,
      coins: Math.floor(p.coins),
      reload: Math.round(tank.reload * 100) / 100,
      reloadTotal: tank.reloadTotal,
      moving: tank.moveLeft > 0,
      flying: tank.flight !== null,
      parachuting: tank.flight === 'chute',
      wind: battle.wind,
      drawOpen: battle.drawOpen,
      drawVoted: battle.drawVotes.has(seat.player),
      drawVotes: votes,
      drawNeeded: needed,
    };
  }

  // ---- Input -------------------------------------------------------------------------

  private handle(seat: Seat, msg: ClientMsg): void {
    switch (msg.t) {
      case 'look':
        return this.look(seat, msg.color, msg.design);
      case 'buy':
      case 'sell':
        if (this.phase !== 'shop' || !this.match || seat.ready) return;
        if (msg.t === 'buy') this.match.buy(seat.player, msg.item);
        else this.match.sell(seat.player, msg.item);
        this.sendPhase(seat);
        this.onChange();
        return;
      case 'ready':
        if (this.phase !== 'shop') return;
        seat.ready = msg.ready;
        this.sendPhase(seat);
        this.onChange();
        this.checkReady();
        return;
    }
    const battle = this.match?.battle;
    if (this.phase !== 'battle' || !battle) return;
    const tank = battle.tankOf(seat.player);
    if (!tank) return;
    const id = tank.id;
    switch (msg.t) {
      case 'aim':
        battle.setAngle(id, msg.angle);
        battle.setPower(id, msg.power);
        break;
      case 'weapon':
        battle.cycleWeapon(id, msg.dir);
        break;
      case 'fire':
        battle.fire(id);
        break;
      case 'move':
        battle.move(id, msg.dir);
        break;
      case 'steer':
        battle.steer(id, msg.dir);
        break;
      case 'repair':
        battle.useRepair(id);
        break;
      case 'powerCell':
        battle.usePowerCell(id);
        break;
      case 'draw':
        battle.voteDraw(id, msg.agree);
        break;
      default:
        return;
    }
    // Answer at once so the phone sees the effect without waiting for the next tick.
    const status = this.status(seat);
    if (status && msg.t !== 'aim') this.sendTo(seat, { t: 'status', ...status });
    this.onChange();
  }

  private look(seat: Seat, color: string, design: TankDesign): void {
    if (this.phase !== 'lobby') return;
    if (!this.seats.some((s) => s !== seat && s.color === color)) seat.color = color;
    seat.design = design;
    this.sendTo(seat, { t: 'welcome', token: seat.token, color: seat.color, design: seat.design });
    this.broadcastLobby();
    this.onChange();
  }

  // ---- Sending -------------------------------------------------------------------------

  private sendPhase(seat: Seat): void {
    const m = this.match;
    switch (this.phase) {
      case 'lobby':
        this.sendTo(seat, {
          t: 'phase',
          phase: 'lobby',
          players: this.lobbyPlayers(seat),
          taken: this.seats.filter((s) => s !== seat).map((s) => s.color),
        });
        return;
      case 'shop': {
        if (!m) return;
        const p = m.players[seat.player];
        this.sendTo(seat, {
          t: 'phase',
          phase: 'shop',
          shop: { round: m.round, rounds: m.config.rounds, coins: Math.floor(p.coins), inventory: { ...p.inventory }, ready: seat.ready },
        });
        return;
      }
      case 'battle':
        if (!m) return;
        this.sendTo(seat, { t: 'phase', phase: 'battle', round: m.round, rounds: m.config.rounds });
        return;
      case 'results': {
        const sum = this.lastSummary;
        if (!m || !sum) return;
        const p = m.players[seat.player];
        const st = sum.stats[seat.player];
        const place = m.standings().indexOf(p) + 1;
        this.sendTo(seat, {
          t: 'phase',
          phase: 'results',
          result: {
            round: sum.round,
            rounds: m.config.rounds,
            winner: sum.winner !== null ? m.players[sum.winner].name : null,
            youWon: sum.winner === seat.player,
            damage: st.damageDealt,
            kills: st.kills,
            earned: st.coinsEarned,
            coins: Math.floor(p.coins),
            final: m.isOver,
            place,
          },
        });
        return;
      }
    }
  }

  private sendTo(seat: Seat, msg: HostMsg): void {
    if (seat.link) this.send(seat.link, msg);
  }

  private send(link: Link, msg: HostMsg): void {
    link.send(msg);
  }

  /** Config for a match: the host's settings with the room's players. */
  configFor(base: GameConfig): GameConfig {
    return { ...base, players: this.buildPlayers() };
  }
}
