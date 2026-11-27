// Archenimys play-together (up to 4 players). The host's game is the real one: guests move their own
// body and send where they are, where they aim and whether they're shooting; the host runs
// everything else and sends the whole tower floor back about 15 times a second.
import { MAX_PLAYERS } from './data';
import type { Act, Fx, Game, State } from './game';
import { Host, joinHost, type Pipe } from './net';

const SNAP_EVERY = 1 / 15;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = any;

export class HostSession {
  host = new Host();
  private pipes = new Map<string, Pipe>();
  private snapT = 0;
  private fx: Fx[] = [];
  onJoin: (name: string) => void = () => {};
  onLeave: (name: string) => void = () => {};

  constructor(private game: Game, private myName: () => string) {
    this.host.onGuest = (id, pipe) => this.addGuest(id, pipe);
    this.host.onGuestLeft = (id) => this.dropGuest(id);
  }

  get count() {
    return this.pipes.size + 1;
  }

  async open() {
    this.host.world = this.where();
    await this.host.open(this.myName(), this.host.world);
  }

  where() {
    const s = this.game.s;
    return s.phase === 'lobby' ? 'Getting ready' : s.phase === 'play' ? `Stage ${s.stage} of 50` : 'Between climbs';
  }
  /** tell the host list what stage we're on */
  touch() {
    this.host.world = this.where();
    this.host.players = this.count;
    void this.host.touch();
  }

  private addGuest(id: string, pipe: Pipe) {
    if (!this.pipes.has(id) && this.game.s.players.length >= MAX_PLAYERS) {
      pipe.send({ t: 'full' });
      return;
    }
    this.pipes.set(id, pipe);
    pipe.onMessage = (m) => this.onMessage(id, m);
    if (!this.game.player(id)) this.game.addPlayer(id, 'Friend');
    pipe.send({ t: 'welcome', id });
    this.touch();
  }

  private dropGuest(id: string) {
    if (!this.pipes.has(id)) return;
    this.pipes.delete(id);
    const name = this.game.player(id)?.name ?? 'A friend';
    this.game.removePlayer(id);
    this.touch();
    this.onLeave(name);
  }

  private onMessage(id: string, m: Msg) {
    const g = this.game;
    const p = g.player(id);
    if (!p) return;
    if (m.t === 'hello') {
      p.name = String(m.name || 'Friend').slice(0, 16);
      this.onJoin(p.name);
    } else if (m.t === 'in') {
      // their own screen moves them; take it unless we just moved them somewhere new
      if (m.tp === p.tp && !p.dead && g.s.phase === 'play') {
        p.x = Number(m.x) || p.x;
        p.y = Number(m.y) || p.y;
        p.moving = !!m.mv;
      }
      g.inputs.set(id, { aim: Number(m.aim) || 0, fire: !!m.fire, block: !!m.block });
    } else if (m.t === 'act') {
      g.act(id, m.a as Act);
    }
  }

  /** call every frame after the game updates, with what happened this frame */
  tick(dt: number, fx: Fx[]) {
    if (!this.pipes.size) return;
    this.fx.push(...fx);
    this.snapT -= dt;
    if (this.snapT > 0) return;
    this.snapT = SNAP_EVERY;
    const msg = { t: 'snap', s: this.game.s, fx: this.fx.splice(0, 80) };
    this.fx = [];
    for (const pipe of this.pipes.values()) pipe.send(msg);
  }

  async close() {
    for (const pipe of this.pipes.values()) pipe.send({ t: 'bye' });
    for (const id of [...this.pipes.keys()]) this.game.removePlayer(id);
    this.pipes.clear();
    await this.host.close();
  }
}

export class GuestSession {
  pipe: Pipe | null = null;
  myId = '';
  state: State | null = null;
  private closeConn: () => void = () => {};
  onState: (s: State, fx: Fx[]) => void = () => {};
  onLost: (why: string) => void = () => {};

  async join(hostId: string, name: string) {
    const { pipe, close } = await joinHost(hostId);
    this.pipe = pipe;
    this.closeConn = close;
    pipe.onMessage = (m: Msg) => {
      if (m.t === 'welcome') this.myId = m.id;
      else if (m.t === 'full') this.onLost('That game is full (4 players).');
      else if (m.t === 'bye') this.onLost('The host closed their game.');
      else if (m.t === 'snap') {
        this.state = m.s as State;
        this.onState(this.state, (m.fx ?? []) as Fx[]);
      }
    };
    pipe.onClose = () => this.onLost('Lost the connection to the host.');
    pipe.send({ t: 'hello', name });
  }

  send(m: object) {
    this.pipe?.send(m);
  }
  act(a: Act) {
    this.send({ t: 'act', a });
  }

  close() {
    if (this.pipe) this.pipe.onClose = () => {};
    this.closeConn();
    this.pipe = null;
  }
}
