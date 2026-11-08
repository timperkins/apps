import { MAX_KIDS, TICK } from '../core/config';
import { sanitizeLook, type Look } from '../core/look';
import { NO_INPUT, addKid, createWorld, removeKid, restart, setInput, step, type Fx, type Input, type World } from '../core/sim';
import { makeSnapshot, type Snapshot } from '../core/snapshot';
import { PROTOCOL, clampInput, isInput, type ToHost, type ToPlayer } from './protocol';
import type { HostTransport, JoinRoom, Link } from './transport';

/**
 * The two ends of a game. The host runs the world and sends snapshots; a guest sends its
 * input and draws what it gets. The game screen talks to either through `Session`.
 */
export interface Session {
  readonly isHost: boolean;
  readonly room: string | null;
  myId: number;
  looks: Map<number, Look>;
  started: boolean;
  onSnapshot: (s: Snapshot) => void;
  onLooks: () => void;
  onStart: () => void;
  onLost: (why: string) => void;
  sendInput(i: Input): void;
  start(): void;
  restart(): void;
  update(dt: number): void;
  close(): void;
}

const SNAP_INTERVAL = 0.05;

export class HostSession implements Session {
  readonly isHost = true;
  readonly world: World;
  myId: number;
  looks = new Map<number, Look>();
  started = false;
  onSnapshot: (s: Snapshot) => void = () => {};
  onLooks: () => void = () => {};
  onStart: () => void = () => {};
  onLost: (why: string) => void = () => {};
  private links = new Map<Link, number>();
  private acc = 0;
  private snapAcc = 0;
  private pendingNet: Fx[] = [];

  constructor(
    look: Look,
    private readonly transport: HostTransport | null,
  ) {
    this.world = createWorld();
    const me = addKid(this.world, look);
    this.myId = me.id;
    this.looks.set(me.id, look);
    transport?.onLink((link) => this.accept(link));
  }

  get room(): string | null {
    return this.transport?.room ?? null;
  }

  private accept(link: Link): void {
    link.onMessage((raw) => {
      const msg = raw as ToHost;
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        if (msg.v !== PROTOCOL) {
          link.send({ t: 'version', v: PROTOCOL } satisfies ToPlayer);
          return;
        }
        if (this.links.has(link)) return;
        if (this.world.kids.length >= MAX_KIDS) {
          link.send({ t: 'full' } satisfies ToPlayer);
          return;
        }
        const look = sanitizeLook(msg.look);
        const kid = addKid(this.world, look);
        this.links.set(link, kid.id);
        this.looks.set(kid.id, look);
        link.send({ t: 'welcome', id: kid.id, v: PROTOCOL } satisfies ToPlayer);
        this.broadcastLooks();
        if (this.started) link.send({ t: 'start' } satisfies ToPlayer);
        link.send({ t: 'snap', s: makeSnapshot(this.world, []) } satisfies ToPlayer);
      } else if (msg.t === 'in') {
        const id = this.links.get(link);
        if (id !== undefined && isInput(msg.i)) setInput(this.world, id, clampInput(msg.i));
      } else if (msg.t === 'restart') {
        this.restart();
      }
    });
    link.onClose(() => {
      const id = this.links.get(link);
      this.links.delete(link);
      if (id === undefined) return;
      removeKid(this.world, id);
      this.looks.delete(id);
      this.broadcastLooks();
    });
  }

  private broadcast(msg: ToPlayer): void {
    for (const link of this.links.keys()) link.send(msg);
  }

  private broadcastLooks(): void {
    this.broadcast({ t: 'looks', looks: [...this.looks] });
    this.onLooks();
  }

  sendInput(i: Input): void {
    setInput(this.world, this.myId, i);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.broadcast({ t: 'start' });
    this.onStart();
  }

  restart(): void {
    restart(this.world);
    this.pendingNet = [];
  }

  update(dt: number): void {
    if (!this.started) {
      // Lobby: keep guests' views fresh without running the game.
      this.snapAcc += dt;
      if (this.snapAcc >= 0.25) {
        this.snapAcc = 0;
        this.broadcast({ t: 'snap', s: makeSnapshot(this.world, []) });
      }
      return;
    }
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= TICK) {
      step(this.world, TICK);
      this.acc -= TICK;
    }
    const events = this.world.events;
    this.world.events = [];
    this.pendingNet.push(...events);
    this.onSnapshot(makeSnapshot(this.world, events));
    this.snapAcc += dt;
    if (this.snapAcc >= SNAP_INTERVAL && this.links.size) {
      this.snapAcc = 0;
      this.broadcast({ t: 'snap', s: makeSnapshot(this.world, this.pendingNet) });
      this.pendingNet = [];
    } else if (!this.links.size) {
      this.pendingNet = [];
    }
  }

  close(): void {
    for (const l of this.links.keys()) l.close();
    this.transport?.close();
  }
}

export class GuestSession implements Session {
  readonly isHost = false;
  myId = -1;
  looks = new Map<number, Look>();
  started = false;
  onSnapshot: (s: Snapshot) => void = () => {};
  onLooks: () => void = () => {};
  onStart: () => void = () => {};
  onLost: (why: string) => void = () => {};
  private last: Input = { ...NO_INPUT };
  private sinceSend = 0;
  private dirty = false;

  private constructor(
    readonly room: string,
    private readonly link: Link,
  ) {}

  /** Connects and waits until the host has accepted us. */
  static async join(join: JoinRoom, room: string, look: Look): Promise<GuestSession> {
    const link = await join(room);
    const s = new GuestSession(room, link);
    return new Promise((resolve, reject) => {
      let settled = false;
      link.onMessage((raw) => {
        const msg = raw as ToPlayer;
        if (!msg || typeof msg !== 'object') return;
        switch (msg.t) {
          case 'welcome':
            s.myId = msg.id;
            settled = true;
            resolve(s);
            break;
          case 'full':
            settled = true;
            reject(new Error('That game already has 4 players.'));
            link.close();
            break;
          case 'version':
            settled = true;
            reject(new Error('The host has a newer version. Reload this page and try again.'));
            link.close();
            break;
          case 'looks':
            s.looks = new Map(msg.looks.map(([id, l]) => [id, sanitizeLook(l)]));
            s.onLooks();
            break;
          case 'start':
            s.started = true;
            s.onStart();
            break;
          case 'snap':
            s.onSnapshot(msg.s);
            break;
        }
      });
      link.onClose(() => {
        if (!settled) reject(new Error('Could not join that game.'));
        else s.onLost('Lost the connection to the host.');
      });
      link.send({ t: 'hello', v: PROTOCOL, look } satisfies ToHost);
    });
  }

  sendInput(i: Input): void {
    if (i.mx !== this.last.mx || i.mz !== this.last.mz || i.attack !== this.last.attack || i.jump !== this.last.jump || i.grab !== this.last.grab) {
      this.last = { ...i };
      this.dirty = true;
    }
  }

  start(): void {}

  restart(): void {
    this.link.send({ t: 'restart' } satisfies ToHost);
  }

  update(dt: number): void {
    this.sinceSend += dt;
    // Send changes right away, and repeat now and then in case the host just restarted.
    if (this.dirty || this.sinceSend > 0.25) {
      this.link.send({ t: 'in', i: this.last } satisfies ToHost);
      this.dirty = false;
      this.sinceSend = 0;
    }
  }

  close(): void {
    this.link.close();
  }
}
