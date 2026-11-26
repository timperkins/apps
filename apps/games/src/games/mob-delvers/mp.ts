// Mob Delvers team play (up to 4 players), built like Factori-owen's: the host's game is the real one.
// Each guest moves their own hero and sends what they do (swings, arrows, artifacts, chests, the
// portal); the host runs monsters, allies, loot and the level, and sends snapshots back.
import { MONSTERS, type MonsterKind } from './data';
import { Host, joinHost, type Pipe } from './net';
import type { Act, Game, MobEnch, Monster, Peer, Shot } from './game';
import type { ModeId } from './data';

const KINDS = Object.keys(MONSTERS) as MonsterKind[];
const STATES: Monster['state'][] = ['idle', 'chase', 'wind', 'recover', 'special'];
const SHOTS: Shot['kind'][] = ['arrow', 'bolt', 'star', 'ember', 'spore', 'ice', 'firework', 'soul', 'spit', 'bone', 'mbolt', 'void', 'sonic'];
const DROPS = ['soul', 'arrows'] as const;
const ENCH: (MobEnch | undefined)[] = [undefined, 'swift', 'shield', 'strong'];
const MODES: ModeId[] = ['easy', 'normal', 'hard', 'nightmare'];
const SNAP_EVERY = 1 / 15;
const POS_EVERY = 1 / 20;
/** the host and up to 3 guests */
export const MAX_TEAM = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = any;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** what a player looks like to the other one */
export function peerOf(g: Game, id: string, name: string): Peer {
  return {
    id, name, x: r2(g.x), y: r2(g.y), face: r2(g.face), moving: g.moving, walk: r2(g.walk), dead: g.dead, rolling: g.rollT > 0,
    swingT: r2(g.swingT), swingDur: r2(g.swingDur), drawT: r2(g.drawT), hp: Math.round(g.hp), maxHp: g.maxHp,
    armor: g.save.armor, melee: g.save.melee, ranged: g.save.ranged,
  };
}

// ---------- host ----------

interface Guest { id: string; pipe: Pipe; name: string; ready: boolean }

export class HostSession {
  host = new Host();
  guests = new Map<string, Guest>();
  /** everyone on the team but you, as one entry (for the menus): null while nobody has joined */
  get guest(): { name: string } | null {
    const names = [...this.guests.values()].map((x) => x.name);
    return names.length ? { name: names.join(', ') } : null;
  }
  private snapT = 0;
  onJoin: (name: string) => void = () => {};
  onLeave: (name: string) => void = () => {};

  constructor(private game: () => Game, private myName: () => string) {
    this.host.onGuest = (id, pipe) => this.addGuest(id, pipe);
    this.host.onGuestLeft = (id) => this.dropGuest(id);
  }

  async open() {
    this.host.world = this.game().def.name;
    await this.host.open(this.myName(), this.game().def.name);
  }

  private addGuest(id: string, pipe: Pipe) {
    if (!this.guests.has(id) && this.guests.size >= MAX_TEAM - 1) {
      // a team is up to four players
      pipe.send({ t: 'full' });
      return;
    }
    const g = this.game();
    // Player 2, 3 or 4: the lowest number nobody is using
    const used = new Set([...this.guests.values()].map((x) => x.name));
    let n = 2;
    while (used.has(`Player ${n}`)) n++;
    const name = `Player ${n}`;
    this.guests.set(id, { id, pipe, name, ready: false });
    pipe.onMessage = (m) => this.onMessage(id, m);
    g.peers = [...g.peers.filter((p) => p.id !== id), { ...peerOf(g, id, name), dead: false }];
    g.fxOut ??= [];
    // the level is sent once the guest says hello (their game may not be listening before that)
    this.host.players = this.guests.size + 1;
    void this.host.touch();
  }

  private dropGuest(id: string) {
    const gu = this.guests.get(id);
    if (!gu) return;
    this.guests.delete(id);
    const g = this.game();
    g.peers = g.peers.filter((p) => p.id !== id);
    if (!this.guests.size) g.fxOut = null;
    this.host.players = this.guests.size + 1;
    void this.host.touch();
    this.onLeave(gu.name);
  }

  private onMessage(id: string, m: Msg) {
    const g = this.game();
    const gu = this.guests.get(id);
    if (!gu) return;
    if (m.t === 'hello') {
      const typed = String(m.name || '').slice(0, 20);
      // keep "Player N" unless they picked a name of their own
      if (typed && !/^Player \d$/.test(typed)) gu.name = typed;
      const p = g.peers.find((q) => q.id === id);
      if (p) p.name = gu.name;
      gu.ready = true;
      this.sendLevel(id);
      this.onJoin(gu.name);
    } else if (m.t === 'sync') {
      // the guest is on a different map than us: send it again
      this.sendLevel(id);
    } else if (m.t === 'pos') {
      const p = g.peers.find((q) => q.id === id);
      if (p) Object.assign(p, m.p, { id, name: gu.name });
    } else if (m.t === 'act') g.peerAct(id, m.a as Act);
  }

  /** to every guest, or to one */
  send(m: object, to?: string) {
    if (to) this.guests.get(to)?.pipe.send(m);
    else for (const gu of this.guests.values()) gu.pipe.send(m);
  }
  private sendLevel(to?: string) {
    const g = this.game();
    this.send({ t: 'level', mode: g.mode, idx: g.levelIdx, seed: g.seed, diff: g.diff, pm: g.playMode, x: g.x, y: g.y }, to);
  }

  // hooks the game calls (wired up in index.ts)
  entered(mode: 'camp' | 'dungeon', idx: number, seed: number) {
    this.host.world = mode === 'camp' ? 'Camp' : this.game().def.name;
    void this.host.touch();
    const g = this.game();
    this.send({ t: 'level', mode, idx, seed, diff: g.diff, pm: g.playMode, x: g.x, y: g.y });
  }
  finished() {
    this.send({ t: 'done' });
  }
  hurtPeer(id: string, dmg: number, fx: number, fy: number, effect?: string) {
    this.send({ t: 'hurt', dmg, fx, fy, effect }, id);
  }
  gain(id: string, g: object) {
    this.send({ t: 'gain', g }, id);
  }
  /** `id` was revived by `by` */
  revive(id: string, by: string) {
    this.send({ t: 'revive', by: by || this.myName() }, id);
  }
  bothDown() {
    this.send({ t: 'fail' });
  }

  /** call every frame after the game updates */
  tick(dt: number) {
    if (!this.guests.size) return;
    this.snapT -= dt;
    if (this.snapT > 0) return;
    this.snapT = SNAP_EVERY;
    const g = this.game();
    const L = g.L;
    const gone: number[] = [], opened: number[] = [];
    L.props.forEach((p, i) => {
      if (p.hp <= 0) gone.push(i);
      if (p.open) opened.push(i);
    });
    const snap = {
      t: 'snap',
      // which map we're on, so the guest can tell if it's on the same one
      lv: [g.mode === 'camp' ? 0 : 1, g.levelIdx, g.seed],
      me: peerOf(g, 'host', this.myName()),
      m: g.monsters.map((m) => [
        m.id, KINDS.indexOf(m.kind), r2(m.x), r2(m.y), Math.round(m.hp), m.maxHp, STATES.indexOf(m.state), r2(m.face), m.scale,
        m.guardian ? 1 : 0, m.awake ? 1 : 0, m.flash > 0 ? 1 : 0, m.slowT > 0 ? 1 : 0, m.stunT > 0 ? 1 : 0, m.burnT > 0 ? 1 : 0, m.guardian ? m.name : 0,
        ENCH.indexOf(m.ench), (m.charmT ?? 0) > 0 ? 1 : 0, (m.poisonT ?? 0) > 0 ? 1 : 0, m.small ? 1 : 0,
      ]),
      s: g.shots.map((s) => [r2(s.x), r2(s.y), r2(s.z), r2(s.vx), r2(s.vy), SHOTS.indexOf(s.kind), s.color ?? 0, s.from === 'hero' ? 0 : 1]),
      d: g.drops.map((d) => [r2(d.x), r2(d.y), DROPS.indexOf(d.kind), d.n]),
      al: g.allies.map((a) => [a.id, a.kind === 'wolf' ? 0 : 1, r2(a.x), r2(a.y), r2(a.face), r2(a.t)]),
      bm: g.beams.map((b) => [r2(b.x), r2(b.y), r2(b.face), r2(b.t)]),
      tt: g.totems.map((t) => [r2(t.x), r2(t.y), r2(t.t)]),
      gone, opened,
      portal: L.portal.open ? 1 : 0,
      boss: g.bossAwake ? 1 : 0,
      fx: g.fxOut?.splice(0) ?? [],
    };
    // each guest also gets the other guests
    for (const gu of this.guests.values()) gu.pipe.send({ ...snap, o: g.peers.filter((p) => p.id !== gu.id) });
  }

  async close() {
    this.send({ t: 'bye' });
    const g = this.game();
    g.peers = [];
    g.fxOut = null;
    this.guests.clear();
    await this.host.close();
  }
}

// ---------- guest ----------

export class GuestSession {
  pipe: Pipe | null = null;
  private closeConn: () => void = () => {};
  private posT = 0;
  /** where each monster is heading (for smooth movement between snapshots) */
  private goal = new Map<number, { x: number; y: number }>();
  onLost: (why: string) => void = () => {};
  onFail: () => void = () => {};

  constructor(private game: () => Game, private myName: () => string) {}

  async join(hostId: string) {
    const { pipe, close } = await joinHost(hostId);
    this.pipe = pipe;
    this.closeConn = close;
    pipe.onClose = () => this.onLost('The connection to the host was lost.');
    pipe.onMessage = (m) => this.onMessage(m);
    pipe.send({ t: 'hello', name: this.myName() });
    const g = this.game();
    g.remote = true;
    g.onAct = (a) => pipe.send({ t: 'act', a });
  }

  private onMessage(m: Msg) {
    const g = this.game();
    switch (m.t) {
      case 'full':
        this.onLost(`That game already has ${MAX_TEAM} players.`);
        break;
      case 'level':
        if (typeof m.diff === 'number') g.diff = Math.max(0, Math.min(9, m.diff));
        if (MODES.includes(m.pm)) g.playMode = m.pm;
        if (m.mode === 'camp') {
          if (g.mode !== 'camp') g.enterCamp();
        } else g.enterLevel(m.idx, m.seed);
        g.x = m.x + 0.6;
        g.y = m.y + 0.3;
        if (!g.walkable(g.x, g.y)) {
          g.x = m.x;
          g.y = m.y;
        }
        g.unstick();
        this.goal.clear();
        break;
      case 'done':
        if (g.mode === 'dungeon') g.finishLevel();
        break;
      case 'hurt':
        g.hurtHero(m.dmg, m.fx, m.fy, m.effect);
        break;
      case 'gain': {
        const x = m.g;
        if (x.souls) g.gainSouls(Math.min(20, +x.souls || 0));
        if (x.arrows) {
          g.save.arrows = Math.min(999, g.save.arrows + (+x.arrows || 0));
          g.float(g.x, g.y, `+${x.arrows} arrows`, '#e8d8b0');
          g.onSound('pickup');
        }
        if (x.heal && !g.dead) g.hp = Math.min(g.maxHp, g.hp + (+x.heal || 0));
        if (x.xp) g.gainXp(Math.min(5000, +x.xp || 0));
        if (x.gear) g.grantDrop('gear', 'New gear!');
        if (x.art) g.grantDrop('art', 'New artifact!');
        break;
      }
      case 'revive':
        g.revived(typeof m.by === 'string' && m.by ? m.by : g.mate?.name ?? 'Your teammate');
        break;
      case 'fail':
        this.onFail();
        break;
      case 'snap':
        this.snap(m);
        break;
      case 'bye':
        this.onLost('The host closed their game.');
        break;
    }
  }

  private syncAsked = -Infinity;
  private snap(m: Msg) {
    const g = this.game();
    if (Array.isArray(m.lv)) {
      const [mode, idx, seed] = m.lv;
      const same = mode === 0 ? g.mode === 'camp' : g.mode === 'dungeon' && g.levelIdx === idx && g.seed === seed;
      if (!same) {
        // we missed a level change: ask the host for it, and don't use this snapshot's map data
        if (performance.now() - this.syncAsked > 1500) {
          this.syncAsked = performance.now();
          this.pipe?.send({ t: 'sync' });
        }
        g.mate = m.me;
        g.others = Array.isArray(m.o) ? m.o : [];
        return;
      }
    }
    g.mate = m.me;
    g.others = Array.isArray(m.o) ? m.o : [];
    const old = new Map(g.monsters.map((x) => [x.id, x]));
    const seen = new Set<number>();
    g.monsters = m.m.map((a: (number | string)[]) => {
      const [id, k, x, y, hp, maxHp, st, face, scale, gd, awake, flash, slow, stun, burn, name, en, charm, poison, small] = a as number[];
      const kind = KINDS[k];
      seen.add(id);
      let mo = old.get(id);
      if (!mo) {
        mo = {
          id, kind, def: MONSTERS[kind], name: MONSTERS[kind].name, x, y, hp, maxHp, dmg: 0, scale, guardian: !!gd, state: 'idle', t: 0, cd: 0, special: 0,
          face, awake: !!awake, slowT: 0, burnT: 0, stunT: 0, flash: 0, kx: 0, ky: 0, walk: Math.random() * 10, hover: Math.random() * 6, dead: false,
        };
      }
      const moved = Math.hypot(x - (this.goal.get(id)?.x ?? x), y - (this.goal.get(id)?.y ?? y));
      this.goal.set(id, { x, y });
      mo.walk += moved * 3;
      Object.assign(mo, { hp, maxHp, state: STATES[st], face, scale, guardian: !!gd, awake: !!awake, flash: flash ? 0.1 : 0, slowT: slow ? 1 : 0, stunT: stun ? 1 : 0, burnT: burn ? 1 : 0, ench: ENCH[en] ?? undefined, charmT: charm ? 1 : 0, poisonT: poison ? 1 : 0, small: !!small });
      if (gd && typeof (a as unknown[])[15] === 'string') mo.name = (a as string[])[15];
      void name;
      return mo;
    });
    for (const id of [...this.goal.keys()]) if (!seen.has(id)) this.goal.delete(id);
    g.guardian = g.monsters.find((x) => x.guardian) ?? null;
    g.bossAwake = !!m.boss;
    g.shots = m.s.map((a: (number | string)[]) => ({
      x: a[0], y: a[1], z: a[2], vx: a[3], vy: a[4], kind: SHOTS[a[5] as number], color: a[6] || undefined, from: a[7] ? 'monster' : 'hero',
      dmg: 0, pierce: 0, hit: new Set(), life: 1,
    }));
    g.drops = m.d.map((a: number[]) => ({ x: a[0], y: a[1], kind: DROPS[a[2]], n: a[3], t: 1 }));
    const oldAl = new Map(g.allies.map((a) => [a.id, a]));
    g.allies = (m.al ?? []).map((a: number[]) => {
      const was = oldAl.get(a[0]);
      const walk = (was?.walk ?? 0) + (was ? Math.hypot(a[2] - was.x, a[3] - was.y) * 3 : 0);
      return { id: a[0], kind: a[1] ? 'llama' : 'wolf', owner: '', x: a[2], y: a[3], face: a[4], walk, t: a[5], cd: 0, dmg: 0 };
    });
    g.beams = (m.bm ?? []).map((a: number[]) => ({ owner: '', x: a[0], y: a[1], face: a[2], t: a[3], dmg: 0, tick: 0 }));
    g.totems = m.tt.map((a: number[]) => ({ x: a[0], y: a[1], t: a[2] }));
    const gone = new Set<number>(m.gone), opened = new Set<number>(m.opened);
    g.L.props.forEach((p, i) => {
      if (gone.has(i) && p.hp > 0) p.hp = 0;
      if (opened.has(i)) p.open = true;
    });
    g.propsDirty();
    g.L.portal.open = !!m.portal;
    for (const e of m.fx) g.playFx(e);
  }

  /** call every frame after the game updates */
  tick(dt: number) {
    const g = this.game();
    if (!this.pipe) return;
    // glide monsters and shots between snapshots
    const k = Math.min(1, dt * 12);
    for (const mo of g.monsters) {
      const goal = this.goal.get(mo.id);
      if (!goal) continue;
      mo.x += (goal.x - mo.x) * k;
      mo.y += (goal.y - mo.y) * k;
      mo.hover += dt;
      mo.flash -= dt;
    }
    for (const s of g.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.posT -= dt;
    if (this.posT <= 0) {
      this.posT = POS_EVERY;
      this.pipe.send({ t: 'pos', p: peerOf(g, 'guest', this.myName()) });
    }
  }

  close() {
    this.pipe?.send({ t: 'bye' });
    this.closeConn();
    this.pipe = null;
    const g = this.game();
    g.remote = false;
    g.mate = null;
    g.others = [];
    g.onAct = () => {};
  }
}
