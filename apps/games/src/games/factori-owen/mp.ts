// Multiplayer sessions on top of net.ts. The host's game is the real one; guests mirror it.
import { ENTITIES, ITEMS, type EntityType, type ItemId } from './data';
import { BUG_NAMES, playerFireFrom, PLAYER_HP, type Fx } from './combat';
import { doMine, doSetRecipe, doTake, type Actions, type Items, type TakeWhat } from './actions';
import { DEFAULT_LOOK, type PlayerLook } from './art';
import { Host, joinHost, type Pipe } from './net';
import { Game, type Dir, type Entity } from './sim';

const FULL_EVERY = 60; // ticks between full building snapshots
const FAST_EVERY = 6; // ticks between bug/player updates

export interface PeerView {
  x: number;
  y: number;
  dir: number;
  moving: boolean;
  look: PlayerLook;
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = any;

function bugsOut(g: Game) {
  return g.cs.bugs.map((b) => [b.id, +b.x.toFixed(2), +b.y.toFixed(2), b.kind, Math.round(b.hp), BUG_NAMES.indexOf(b.name), +b.angle.toFixed(2), b.mode === 'idle' ? 0 : 1]);
}

// ---------- host ----------

export class HostSession {
  host = new Host();
  guests = new Map<string, { pipe: Pipe; name: string; look: PlayerLook }>();
  private newFx: Fx[] = [];
  status = 'Opening…';

  constructor(private game: () => Game, private me: () => { name: string; look: PlayerLook }) {
    this.host.onGuest = (id, pipe) => this.addGuest(id, pipe);
    this.host.onGuestLeft = (id) => this.dropGuest(id);
  }

  async open(world: string) {
    await this.host.open(this.me().name, world);
    this.game().world.changed = new Set();
    this.status = 'Open: other players can join from the title screen';
  }

  private addGuest(id: string, pipe: Pipe) {
    const g = this.game();
    this.guests.set(id, { pipe, name: 'Player', look: DEFAULT_LOOK });
    g.others.set(id, { x: g.spawnX + 1, y: g.spawnY, dir: 2, moving: false, hp: PLAYER_HP, name: 'Player', dead: false });
    pipe.onMessage = (m) => this.onMessage(id, m);
    // the whole world, once
    pipe.send({ t: 'world', save: g.serialize(), x: g.spawnX + 1, y: g.spawnY });
    this.host.players = this.guests.size + 1;
    void this.host.touch();
  }

  private dropGuest(id: string) {
    const gst = this.guests.get(id);
    if (!gst) return;
    this.guests.delete(id);
    this.game().others.delete(id);
    this.game().toast(`${gst.name} left`);
    this.host.players = this.guests.size + 1;
  }

  private reply(id: string, rid: number, data: object) {
    this.guests.get(id)?.pipe.send({ t: 'reply', rid, ...data });
  }

  private onMessage(id: string, m: Msg) {
    const g = this.game();
    const gst = this.guests.get(id);
    if (!gst) return;
    const o = g.others.get(id);
    switch (m.t) {
      case 'hello':
        gst.name = String(m.name || 'Player').slice(0, 20);
        gst.look = { ...DEFAULT_LOOK, ...(m.look ?? {}) };
        if (o) o.name = gst.name;
        g.toast(`${gst.name} joined the game`, 4);
        break;
      case 'pos':
        if (o) {
          o.x = m.x;
          o.y = m.y;
          o.dir = m.dir;
          o.moving = m.moving;
          o.dead = !!m.dead;
        }
        break;
      case 'cmd':
        this.command(id, m);
        break;
    }
  }

  private command(id: string, m: Msg) {
    const g = this.game();
    const at = (): Entity | null => g.entAt(m.x, m.y);
    let items: Items = [];
    let ok = false;
    switch (m.op) {
      case 'place':
        ok = !!(ENTITIES[m.type as EntityType] && g.place(m.type, m.x, m.y, m.dir));
        break;
      case 'remove': {
        const e = at();
        if (e) items = g.remove(e);
        break;
      }
      case 'rotate': {
        const e = at();
        if (e && e.def.rotatable) {
          e.dir = m.dir;
          if (e.def.kind === 'belt') g.updateCurves(e.x, e.y);
        }
        break;
      }
      case 'give': {
        const e = at();
        const n = e && ITEMS[m.item as ItemId] ? g.insert(e, m.item, m.n, true) : 0;
        if (n < m.n) items = [[m.item, m.n - n]];
        break;
      }
      case 'take': {
        const e = at();
        if (e) items = doTake(g, e, m.what as TakeWhat, m.key);
        break;
      }
      case 'recipe': {
        const e = at();
        if (e) items = doSetRecipe(g, e, m.id);
        break;
      }
      case 'research':
        if (g.canResearch(m.id)) g.research = m.id;
        break;
      case 'mine':
        doMine(g, m.x, m.y);
        break;
      case 'fire': {
        const o = g.others.get(id);
        if (o) playerFireFrom(g, o.x, o.y, m.weapon, m.aim);
        break;
      }
    }
    if (m.rid) this.reply(id, m.rid, { ok, items });
  }

  /** Call after every game tick. */
  tick() {
    const g = this.game();
    for (const f of g.cs.fx) if (f.t === f.life) this.newFx.push(f);
    for (const [id, dmg, by] of g.hurtOthers) this.guests.get(id)?.pipe.send({ t: 'hurt', dmg, by });
    g.hurtOthers.length = 0;
    if (!this.guests.size) {
      this.newFx.length = 0;
      g.world.changed?.clear();
      return;
    }
    const me = this.me();
    if (g.tick % FAST_EVERY === 0) {
      const players = (skip: string) => [
        ...(g.playerDead ? [] : [{ id: 'host', x: g.px, y: g.py, dir: g.pdir, moving: g.pmoving, name: me.name, look: me.look }]),
        ...[...g.others].filter(([id, o]) => id !== skip && !o.dead).map(([id, o]) => ({
          id, x: o.x, y: o.y, dir: o.dir, moving: o.moving, name: o.name, look: this.guests.get(id)?.look ?? DEFAULT_LOOK,
        })),
      ];
      const tiles = [...(g.world.changed ?? [])].map((i) => [i, g.world.res[i], g.world.amount[i], g.world.tree[i]]);
      g.world.changed?.clear();
      const fx = this.newFx.splice(0);
      for (const [id, gst] of this.guests)
        gst.pipe.send({ t: 'fast', bugs: bugsOut(g), nests: g.cs.nests, players: players(id), fx, tiles, toasts: g.toasts.map((t) => t.text) });
    }
    if (g.tick % FULL_EVERY === 0) {
      const full = {
        t: 'full', tick: g.tick, ents: g.serializeEnts(), researched: [...g.researched], research: g.research,
        units: g.researchUnits, evo: g.cs.evolution, won: g.won,
      };
      for (const gst of this.guests.values()) gst.pipe.send(full);
    }
  }

  views(): PeerView[] {
    const g = this.game();
    return [...g.others].filter(([, o]) => !o.dead).map(([id, o]) => ({ x: o.x, y: o.y, dir: o.dir, moving: o.moving, name: o.name, look: this.guests.get(id)?.look ?? DEFAULT_LOOK }));
  }

  async close() {
    for (const gst of this.guests.values()) gst.pipe.send({ t: 'bye' });
    this.guests.clear();
    this.game().others.clear();
    await this.host.close();
  }
}

// ---------- guest ----------

export class GuestSession {
  game: Game | null = null;
  others: PeerView[] = [];
  private rid = 1;
  private pending = new Map<number, (r: Msg) => void>();
  private closeConn: () => void = () => {};
  pipe: Pipe | null = null;
  onWorld: (g: Game) => void = () => {};
  onLost: () => void = () => {};
  private hostToasts = new Set<string>();

  async join(hostId: string, me: { name: string; look: PlayerLook }) {
    const { pipe, close } = await joinHost(hostId);
    this.pipe = pipe;
    this.closeConn = close;
    pipe.onClose = () => this.onLost();
    pipe.onMessage = (m) => this.onMessage(m);
    pipe.send({ t: 'hello', name: me.name, look: me.look });
  }

  private onMessage(m: Msg) {
    if (m.t === 'world') {
      const g = Game.load(m.save);
      g.remote = true;
      g.px = g.spawnX = m.x;
      g.py = g.spawnY = m.y;
      g.inv.slots.fill(null);
      for (const [it, n] of [['owen-plate', 8], ['wood', 4], ['burner-drill', 1], ['stone-furnace', 1], ['owen-ammo', 10]] as Items) g.inv.add(it, n);
      g.craftQueue = [];
      g.onFire = (weapon, aim) => this.fire(weapon, aim);
      this.game = g;
      this.onWorld(g);
      return;
    }
    const g = this.game;
    if (!g) return;
    switch (m.t) {
      case 'full':
        g.loadEnts(m.ents);
        g.researched = new Set(m.researched);
        g.research = m.research;
        g.researchUnits = m.units;
        g.cs.evolution = m.evo;
        if (m.won && !g.won) {
          g.won = true;
          g.events.push('win');
        }
        break;
      case 'fast': {
        const old = new Map(g.cs.bugs.map((b) => [b.id, b]));
        g.cs.bugs = m.bugs.map((a: number[]) => {
          const prev = old.get(a[0]);
          return {
            id: a[0], x: a[1], y: a[2], kind: a[3], hp: a[4], name: BUG_NAMES[a[5]] ?? 'Roger', angle: a[6],
            mode: a[7] ? 'attack' : 'idle', tx: a[1], ty: a[2], nest: 0, cd: 0, anim: (prev?.anim ?? 0) + 6, stuck: 0,
          };
        });
        g.cs.nests = m.nests;
        for (const f of m.fx) g.cs.fx.push(f);
        for (const [i, res, amount, tree] of m.tiles) {
          const was = g.world.res[i];
          g.world.res[i] = res;
          g.world.amount[i] = amount;
          g.world.tree[i] = tree;
          if (was && !res) g.world.dirtyChunks.add((((i / 256) | 0) >> 5) * 256 + ((i % 256) >> 5));
        }
        this.others = m.players;
        for (const t of m.toasts as string[]) {
          if (!this.hostToasts.has(t)) g.toast(t);
        }
        this.hostToasts = new Set(m.toasts);
        if (m.fx.some((f: Fx) => f.kind === 'rail')) g.events.push('rail');
        break;
      }
      case 'hurt':
        g.cs.playerHp -= m.dmg;
        g.cs.lastHurt = g.tick;
        g.events.push('hurt');
        if (g.cs.playerHp <= 0) g.killPlayer(m.by);
        break;
      case 'reply': {
        const cb = this.pending.get(m.rid);
        this.pending.delete(m.rid);
        cb?.(m);
        break;
      }
      case 'bye':
        g.toast('The host closed the game', 6);
        this.onLost();
        break;
    }
  }

  private cmd(op: string, data: object, cb?: (r: Msg) => void) {
    const rid = cb ? this.rid++ : 0;
    if (cb) this.pending.set(rid, cb);
    this.pipe?.send({ t: 'cmd', op, rid, ...data });
  }

  private addItems(items: Items) {
    const g = this.game!;
    for (const [it, n] of items) {
      const k = g.inv.add(it, n);
      if (k < n) g.toast('Inventory full: some items were lost');
    }
  }

  /** Call every tick. */
  tick() {
    const g = this.game;
    if (!g || !this.pipe) return;
    if (g.tick % 3 === 0) this.pipe.send({ t: 'pos', x: +g.px.toFixed(2), y: +g.py.toFixed(2), dir: g.pdir, moving: g.pmoving, dead: !!g.playerDead });
  }

  fire(weapon: string, aim?: { x: number; y: number }) {
    this.cmd('fire', { weapon, aim });
  }

  actions(): Actions {
    return {
      place: (type, x, y, dir, item) => {
        const g = this.game!;
        if (g.inv.count(item) <= 0 || !g.canPlace(type, x, y)) return false;
        g.place(type, x, y, dir); // show it straight away; the next snapshot confirms it
        g.inv.remove(item, 1);
        this.cmd('place', { type, x, y, dir }, (r) => {
          if (!r.ok) g.inv.add(item, 1);
        });
        return true;
      },
      remove: (e) => {
        const g = this.game!;
        const x = e.x, y = e.y;
        g.remove(e);
        this.cmd('remove', { x, y }, (r) => this.addItems(r.items));
      },
      rotate: (e, dir) => {
        const d = (dir ?? (e.dir + 1) % 4) as Dir;
        e.dir = d;
        this.cmd('rotate', { x: e.x, y: e.y, dir: d });
      },
      give: (e, slot, n) => {
        const g = this.game!;
        const s = g.inv.slots[slot];
        if (!s) return false;
        const k = Math.min(n, s.n, g.accepts(e, s.item, true));
        if (k <= 0) return false;
        const item = s.item;
        g.inv.remove(item, k);
        g.insert(e, item, k, true);
        this.cmd('give', { x: e.x, y: e.y, item, n: k }, (r) => this.addItems(r.items));
        return true;
      },
      take: (e, what, key) => {
        doTake(this.game!, e, what, key);
        this.cmd('take', { x: e.x, y: e.y, what, key }, (r) => this.addItems(r.items));
      },
      setRecipe: (e, id) => {
        doSetRecipe(this.game!, e, id);
        this.cmd('recipe', { x: e.x, y: e.y, id }, (r) => this.addItems(r.items));
      },
      research: (id) => {
        this.game!.research = id;
        this.cmd('research', { id });
      },
      mine: (x, y) => {
        const items = doMine(this.game!, x, y);
        for (const [it, n] of items) this.game!.inv.add(it, n);
        this.cmd('mine', { x, y });
      },
    };
  }

  close() {
    this.closeConn();
    this.pipe = null;
  }
}
