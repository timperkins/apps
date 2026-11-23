import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { Fx, Game, Hero, IDLE, Input, Person, PersonKind, Shot, Vehicle, VehicleKind, makePerson, makeVehicle } from './game';
import { T, buildBank } from './map';
import { sfx, sfxTap } from './audio';

/*
 * 2 player mode over WebRTC. The host's phone runs the whole game; the friend's phone sends
 * its joystick and buttons and gets back what is near it about 20 times a second.
 * The free public PeerJS server only connects the two phones; after that they talk directly.
 */

// ---------- connection ----------

export interface Link {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export interface Room {
  code: string;
  onLink(cb: (link: Link) => void): void;
  close(): void;
}

/** Prefix so our room codes don't collide with other apps on the shared PeerJS server. */
const PREFIX = 'od-heist-room-';
const OPEN_TIMEOUT = 12000;
export const CODE_LENGTH = 4;

export function randomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += Math.floor(random() * 10);
  return code;
}

export function normalizeCode(raw: string): string | null {
  const code = raw.replace(/\D/g, '');
  return code.length === CODE_LENGTH ? code : null;
}

/** Test hook: `?peerhost=localhost:9000` points at a local PeerJS server instead of the public one. */
function peerOptions(): PeerOptions {
  const host = new URLSearchParams(location.search).get('peerhost');
  if (!host) return {};
  const [hostname, port] = host.split(':');
  return { host: hostname, port: Number(port) || 9000, path: '/', secure: false };
}

function wrap(conn: DataConnection): Link {
  const closeCbs: (() => void)[] = [];
  let closed = false;
  const fireClose = () => {
    if (closed) return;
    closed = true;
    for (const cb of closeCbs) cb();
  };
  conn.on('close', fireClose);
  conn.on('error', fireClose);
  // A phone that locks its screen can drop without a close event; ICE state catches that.
  conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
    const s = conn.peerConnection?.iceConnectionState;
    if (s === 'failed' || s === 'closed' || s === 'disconnected') fireClose();
  });
  return {
    send: (msg) => {
      if (!closed && conn.open) conn.send(msg);
    },
    onMessage: (cb) => conn.on('data', cb),
    onClose: (cb) => closeCbs.push(cb),
    close: () => {
      conn.close();
      fireClose();
    },
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function tryOpen(code: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PREFIX + code, peerOptions());
    peer.once('open', () => resolve(peer));
    peer.once('error', (err) => {
      peer.destroy();
      reject(err);
    });
  });
}

export async function openRoom(): Promise<Room> {
  let peer: Peer | null = null;
  let code = '';
  for (let attempt = 0; attempt < 5 && !peer; attempt++) {
    code = randomCode();
    try {
      peer = await withTimeout(tryOpen(code), OPEN_TIMEOUT, 'Opening the game');
    } catch (err) {
      // Someone else has this code; try another. Anything else is a real failure.
      if ((err as { type?: string }).type !== 'unavailable-id') throw err;
    }
  }
  if (!peer) throw new Error('Could not find a free code');
  const p = peer;
  const linkCbs: ((link: Link) => void)[] = [];
  p.on('connection', (conn) => {
    conn.on('open', () => {
      const link = wrap(conn);
      for (const cb of linkCbs) cb(link);
    });
  });
  // Losing the signaling server only stops new friends from joining; reconnect quietly.
  p.on('disconnected', () => {
    if (!p.destroyed) setTimeout(() => !p.destroyed && p.reconnect(), 1000);
  });
  p.on('error', () => {
    /* individual connection errors are handled per link */
  });
  return { code, onLink: (cb) => linkCbs.push(cb), close: () => p.destroy() };
}

export function joinRoom(code: string): Promise<Link> {
  return withTimeout(
    new Promise<Link>((resolve, reject) => {
      const peer = new Peer(peerOptions());
      peer.once('error', (err) => {
        peer.destroy();
        reject(err);
      });
      peer.once('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.once('open', () => {
          const link = wrap(conn);
          link.onClose(() => peer.destroy());
          resolve(link);
        });
        conn.once('error', (err) => {
          peer.destroy();
          reject(err);
        });
      });
    }),
    OPEN_TIMEOUT,
    'Joining the game',
  );
}

// ---------- messages ----------

const r2 = (n: number) => Math.round(n * 100) / 100;

type PersonRow = [
  number, // id
  PersonKind,
  number, // x
  number, // y
  number, // z
  number, // fx
  number, // fy
  number, // walk
  number, // flags: moving 1, hostile 2, tired 4, sleeping 8, onShip 16
  number, // ko
  number, // hit
  number, // punch
  string, // say
  number, // sayT
  number, // hp
  number, // maxHp
  string, // shirt
  string, // pants
  string, // skin
  string, // hair
];

type VehicleRow = [
  number, // id
  VehicleKind,
  number, // x
  number, // y
  number, // angle
  string, // color
  Vehicle['driver'],
  number, // broken
  number, // hit
  number, // turret
  number, // flags: mine 1, lot 2
  number, // rental
  number, // hp
  number, // maxHp
];

type HeroRow = [
  number, // id
  number, // x
  number, // y
  number, // z
  number, // fx
  number, // fy
  number, // walk
  number, // flags: moving 1, inVent 2, overlay 4
  number, // punch
  number, // hit
  number, // hp
  number, // maxHp
  number, // vehicle id or -1
  number, // ground
  string, // wearing
  number, // carried driver id or -1
];

type ShotRow = [Shot['kind'], number, number, number, number, number, number, number];

interface Snapshot {
  t: 's';
  sc: 0 | 1; // city or bank
  bid: string;
  open: boolean; // the bank's locked door has been opened
  h: HeroRow[];
  p: PersonRow[];
  v: VehicleRow[];
  sh: ShotRow[];
  fx: Fx[];
  sfx: string[];
  bn: Game['banners'];
  m: number; // money
  w: number; // wanted
  tm: number;
  o: string[];
  u: Record<string, number>;
  cd: boolean;
  car: boolean;
  my: number; // my car id or -1
  ship: number;
  hint: { text: string; label: string; act: boolean } | null;
  menu: 'shop' | 'lot' | null;
  ov: Hero['overlay'];
}

type GuestMsg =
  | ({ t: 'i' } & Input)
  | { t: 'a'; a: 'buy' | 'rent' | 'deal' | 'wear' | 'call'; id: string };

type HostReply = { t: 'r'; text: string } | Snapshot;

function personRow(p: Person): PersonRow {
  const flags = (p.moving ? 1 : 0) | (p.hostile ? 2 : 0) | (p.tired ? 4 : 0) | (p.sleeping ? 8 : 0) | (p.onShip ? 16 : 0);
  return [p.id, p.kind, r2(p.x), r2(p.y), r2(p.z), r2(p.fx), r2(p.fy), r2(p.walk), flags, r2(p.ko), r2(p.hit), r2(p.punch), p.sayT > 0 ? p.say : '', r2(p.sayT), Math.round(p.hp), Math.round(p.maxHp), p.shirt, p.pants, p.skin, p.hair];
}

function vehicleRow(v: Vehicle): VehicleRow {
  return [v.id, v.kind, r2(v.x), r2(v.y), r2(v.angle), v.color, v.driver, r2(v.broken), r2(v.hit), r2(v.turret), (v.mine ? 1 : 0) | (v.lot ? 2 : 0), Math.ceil(v.rental), Math.round(v.hp), Math.round(v.maxHp)];
}

function heroRow(h: Hero): HeroRow {
  const p = h.player;
  const flags = (p.moving ? 1 : 0) | (h.inVent ? 2 : 0) | (h.overlay ? 4 : 0);
  return [h.id, r2(p.x), r2(p.y), r2(p.z), r2(p.fx), r2(p.fy), r2(p.walk), flags, r2(p.punch), r2(p.hit), Math.round(p.hp), Math.round(p.maxHp), h.vehicle?.id ?? -1, r2(h.ground), h.wearing ?? '', h.lift?.driver.id ?? -1];
}

export function snapshot(g: Game, guest: Hero, fx: Fx[], sounds: string[]): Snapshot {
  const me = g.heroPos(guest);
  const near = (o: { x: number; y: number }, r: number) => g.scene === g.bank || Math.hypot(o.x - me.x, o.y - me.y) < r;
  const hint = guest.hint;
  const snap: Snapshot = {
    t: 's',
    sc: g.scene === g.bank ? 1 : 0,
    bid: g.bankId,
    open: g.scene === g.bank && !g.bank.map.tiles.includes(T.Locked),
    h: g.heroes.map(heroRow),
    p: g.scene.people.filter((p) => near(p, 30)).map(personRow),
    v: g.scene.vehicles.filter((v) => v === g.ship || v === g.myCar || near(v, 34)).map(vehicleRow),
    sh: g.scene.shots.filter((s) => near(s, 30)).map((s) => [s.kind, r2(s.x), r2(s.y), r2(s.z), r2(s.vx), r2(s.vy), r2(s.vz), r2(s.t)]),
    fx: fx.filter((f) => near(f, 30)),
    sfx: sounds,
    bn: g.banners,
    m: Math.floor(g.money),
    w: g.wanted,
    tm: Math.floor(g.time),
    o: [...g.owned],
    u: g.upgrades,
    cd: g.captainDown,
    car: g.ownsCar,
    my: g.myCar && !g.myCar.gone ? g.myCar.id : -1,
    ship: g.ship.id,
    hint: hint ? { text: hint.text, label: hint.label, act: !!hint.act } : null,
    menu: guest.menuReq,
    ov: guest.overlay,
  };
  guest.menuReq = null;
  return snap;
}

// ---------- host side ----------

export class HostNet {
  link: Link | null = null;
  hero: Hero | null = null;
  input: Input = { ...IDLE };
  sendT = 0;
  quiet = 0; // seconds since the other phone last said anything
  onChange: (() => void) | null = null;

  constructor(
    public g: Game,
    public room: Room,
  ) {
    room.onLink((link) => this.attach(link));
  }

  attach(link: Link) {
    if (this.link) {
      // only one friend at a time
      link.close();
      return;
    }
    const g = this.g;
    this.link = link;
    this.hero = g.addHero();
    this.input = { ...IDLE };
    g.fxLog = [];
    sfxTap.log = [];
    this.quiet = 0;
    link.onMessage((raw) => {
      this.quiet = 0;
      this.handle(raw as GuestMsg);
    });
    link.onClose(() => {
      if (this.link !== link) return;
      if (this.hero) g.removeHero(this.hero);
      this.link = null;
      this.hero = null;
      g.fxLog = null;
      sfxTap.log = null;
      this.onChange?.();
    });
    this.onChange?.();
  }

  handle(msg: GuestMsg) {
    const g = this.g;
    const h = this.hero;
    if (!h || !msg || typeof msg !== 'object') return;
    if (msg.t === 'i') {
      const prev = this.input;
      this.input = {
        mx: Number(msg.mx) || 0,
        my: Number(msg.my) || 0,
        mag: Math.min(1, Number(msg.mag) || 0),
        fire: !!msg.fire,
        // button presses stay pressed until the game has seen them
        punch: prev.punch || !!msg.punch,
        jump: prev.jump || !!msg.jump,
        use: prev.use || !!msg.use,
      };
    } else if (msg.t === 'a') {
      const id = String(msg.id ?? '');
      const text = g.as(h, () => {
        if (msg.a === 'buy') return g.buy(id);
        if (msg.a === 'deal') return g.lotDeal(id === 'buy' ? 'buy' : 'rent');
        if (msg.a === 'wear') g.setOutfit(id || null);
        if (msg.a === 'call') g.callMyCar();
        return '';
      });
      this.link?.send({ t: 'r', text } satisfies HostReply);
    }
  }

  /** The inputs for this frame: the host's own and the friend's. */
  inputs(local: Input): Input[] {
    return this.hero ? [local, this.input] : [local];
  }

  /** Call after each game update. */
  afterUpdate(dt: number) {
    if (!this.link || !this.hero) return;
    this.quiet += dt;
    if (this.quiet > 6) {
      this.link.close(); // their phone went to sleep or lost the internet
      return;
    }
    this.input.punch = this.input.jump = this.input.use = false;
    this.sendT += dt;
    if (this.sendT < 0.05) return;
    this.sendT = 0;
    const g = this.g;
    this.link.send(snapshot(g, this.hero, g.fxLog ?? [], sfxTap.log ?? []));
    g.fxLog = [];
    sfxTap.log = [];
  }

  close() {
    this.link?.close();
    this.room.close();
  }
}

// ---------- friend's side ----------

export class GuestNet {
  people = new Map<number, Person>();
  vehicles = new Map<number, Vehicle>();
  targets = new Map<object, { x: number; y: number; a?: number }>();
  sendT = 0;
  quiet = 0; // seconds since the other phone last said anything
  edges = { punch: false, jump: false, use: false };
  got = false;
  onReply: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(
    public g: Game,
    public link: Link,
  ) {
    // the friend is player 2 on this phone
    g.addHero();
    g.select(g.heroes[1]);
    g.banners = [];
    link.onMessage((raw) => {
      this.quiet = 0;
      const msg = raw as HostReply;
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 's') this.apply(msg);
      else if (msg.t === 'r') this.onReply?.(String(msg.text ?? ''));
    });
    link.onClose(() => this.onClose?.());
  }

  action(a: 'buy' | 'deal' | 'wear' | 'call', id = '') {
    this.link.send({ t: 'a', a, id } satisfies GuestMsg);
  }

  /** Call every frame with this phone's controls. */
  tick(dt: number, inp: Input) {
    const g = this.g;
    this.quiet += dt;
    if (this.quiet > 6) {
      this.quiet = -1e9;
      this.link.close();
      return;
    }
    this.edges.punch ||= inp.punch;
    this.edges.jump ||= inp.jump;
    this.edges.use ||= inp.use;
    this.sendT += dt;
    if (this.sendT >= 0.033) {
      this.sendT = 0;
      this.link.send({ t: 'i', mx: r2(inp.mx), my: r2(inp.my), mag: r2(inp.mag), fire: inp.fire, ...this.edges } satisfies GuestMsg);
      this.edges = { punch: false, jump: false, use: false };
    }
    // glide everything towards where the host says it is
    const k = 1 - Math.exp(-dt * 16);
    for (const [o, t] of this.targets) {
      const obj = o as { x: number; y: number; angle?: number };
      obj.x += (t.x - obj.x) * k;
      obj.y += (t.y - obj.y) * k;
      if (t.a !== undefined && obj.angle !== undefined) {
        let d = t.a - obj.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        obj.angle += d * k;
      }
    }
    for (const s of g.scene.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.kind === 'grenade') {
        s.vz -= 12 * dt;
        s.z = Math.max(0, s.z + s.vz * dt);
      }
    }
    for (const f of g.scene.fx) f.t += dt;
    g.scene.fx = g.scene.fx.filter((f) => f.t < f.life);
    for (const p of g.scene.people) p.sayT = Math.max(0, p.sayT - dt);
    const c = g.vehicle ?? g.player;
    const ck = Math.min(1, dt * 6);
    g.cam.x += (c.x - g.cam.x) * ck;
    g.cam.y += (c.y - g.cam.y) * ck;
  }

  private glide(o: object & { x: number; y: number }, x: number, y: number, a?: number) {
    if (Math.hypot(o.x - x, o.y - y) > 4) {
      o.x = x;
      o.y = y;
      if (a !== undefined) (o as unknown as { angle: number }).angle = a;
    }
    this.targets.set(o, { x, y, a });
  }

  apply(s: Snapshot) {
    const g = this.g;
    const first = !this.got;
    this.got = true;
    // where are we?
    if (s.sc === 1) {
      if (g.scene !== g.bank || g.bankId !== s.bid) {
        g.bank = { map: buildBank(), people: [], vehicles: [], shots: [], fx: [] };
        g.bankId = s.bid;
        g.scene = g.bank;
        this.targets.clear();
        this.people.clear();
      }
      if (s.open) {
        const m = g.bank.map;
        for (let i = 0; i < m.tiles.length; i++)
          if (m.tiles[i] === T.Locked) {
            m.tiles[i] = T.Floor;
            m.heights[i] = 0;
          }
      }
    } else if (g.scene !== g.city) {
      g.scene = g.city;
      this.targets.clear();
      this.people.clear();
    }
    const sc = g.scene;
    const teleport = first || this.lastScene !== s.sc + s.bid;
    this.lastScene = s.sc + s.bid;

    // people
    const seenP = new Map<number, Person>();
    sc.people = s.p.map((row) => {
      const [id, kind, x, y, z, fx, fy, walk, flags, ko, hit, punch, say, sayT, hp, maxHp, shirt, pants, skin, hair] = row;
      let p = this.people.get(id);
      if (!p || p.kind !== kind) {
        p = makePerson(kind, x, y);
        p.id = id;
      }
      seenP.set(id, p);
      if (teleport) {
        p.x = x;
        p.y = y;
      }
      this.glide(p, x, y);
      Object.assign(p, { z, fx, fy, walk, ko, hit, punch, hp, maxHp, shirt, pants, skin, hair });
      p.moving = !!(flags & 1);
      p.hostile = !!(flags & 2);
      p.tired = !!(flags & 4);
      p.sleeping = !!(flags & 8);
      p.onShip = !!(flags & 16);
      if (say) {
        p.say = say;
        p.sayT = sayT;
      }
      return p;
    });
    for (const [id, p] of this.people) if (!seenP.has(id)) this.targets.delete(p);
    this.people = seenP;

    // vehicles
    const seenV = new Map<number, Vehicle>();
    sc.vehicles = s.v.map((row) => {
      const [id, kind, x, y, angle, color, driver, broken, hit, turret, flags, rental, hp, maxHp] = row;
      let v = id === s.ship ? g.ship : this.vehicles.get(id);
      if (!v || v.kind !== kind) {
        v = makeVehicle(kind, x, y, angle);
      }
      v.id = id;
      seenV.set(id, v);
      if (teleport) {
        v.x = x;
        v.y = y;
        v.angle = angle;
      }
      this.glide(v, x, y, angle);
      Object.assign(v, { color, driver, broken, hit, turret, rental, hp, maxHp });
      v.mine = !!(flags & 1);
      v.lot = !!(flags & 2);
      return v;
    });
    for (const [id, v] of this.vehicles) if (!seenV.has(id)) this.targets.delete(v);
    this.vehicles = seenV;
    if (s.sc === 0 && !sc.vehicles.includes(g.ship)) sc.vehicles.push(g.ship);
    g.myCar = s.my >= 0 ? (seenV.get(s.my) ?? null) : null;

    // the two robbers
    for (const row of s.h) {
      const [id, x, y, z, fx, fy, walk, flags, punch, hit, hp, maxHp, veh, ground, wearing, carried] = row;
      const h = g.heroes.find((q) => q.id === id);
      if (!h) continue;
      const p = h.player;
      if (teleport) {
        p.x = x;
        p.y = y;
      }
      this.glide(p, x, y);
      Object.assign(p, { z, fx, fy, walk, punch, hit, hp, maxHp });
      p.moving = !!(flags & 1);
      h.inVent = !!(flags & 2);
      h.ground = ground;
      h.wearing = wearing || null;
      h.vehicle = veh >= 0 ? (seenV.get(veh) ?? null) : null;
      const d = carried >= 0 ? seenP.get(carried) : undefined;
      h.lift = d ? { t: 0, driver: d, car: h.vehicle ?? g.ship } : null;
      if (h !== g.cur) h.overlay = flags & 4 ? { title: '', sub: '', t: 1 } : null;
    }
    g.cur.overlay = s.ov;
    const hint = s.hint;
    g.cur.hint = hint ? { text: hint.text, label: hint.label, act: hint.act ? () => {} : null } : null;

    // shots, effects, sounds
    sc.shots = s.sh.map(([kind, x, y, z, vx, vy, vz, t]) => ({ kind, x, y, z, vx, vy, vz, t, dmg: 0 }));
    for (const f of s.fx) sc.fx.push(f);
    for (const n of s.sfx) sfx(n);

    // shared team stuff
    g.banners = s.bn;
    g.money = s.m;
    g.wanted = s.w;
    g.time = s.tm;
    g.owned = new Set(s.o);
    g.upgrades = s.u;
    g.captainDown = s.cd;
    g.ownsCar = s.car;
    if (s.menu) g.menu = s.menu;
    if (first) {
      g.cam.x = g.player.x;
      g.cam.y = g.player.y;
    }
  }

  lastScene = '';

  close() {
    this.link.close();
  }
}
