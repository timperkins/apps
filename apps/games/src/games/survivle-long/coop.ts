// Co-op: up to 8 heroes in one world. The host's game runs the world (enemies, bosses, chests,
// challenges, time) and sends it out about 12 times a second. Each friend runs their own hero and
// sends where they are; their hits and arrows go to the host, who applies them.
import { Game, pvpQuarters, type Arrow, type Enemy, type NetHooks, type Other } from './game';
import { openRoom, joinRoom, MAX_PLAYERS, type Host, type Link } from './net';
import { sfx } from './audio';
import { MAX_HP_CAP } from './data';
import { VILLAGES, setVillageCount } from './world';

const SNAP_HZ = 12;
const ME_HZ = 15;

/** One hero as sent over the link. */
interface HeroMsg {
  id: string;
  name: string;
  outfit: string;
  x: number;
  y: number;
  z: number;
  face: number;
  moving: boolean;
  swingT: number;
  climbing: boolean;
  hp: number;
  maxHp: number;
  ko: boolean;
  /** Just got hit (flashes for everyone). */
  hurt?: boolean;
  swordD: number;
}

type Msg =
  | { t: 'hello'; name: string; outfit: string }
  | { t: 'welcome'; id: string; seed: number; elapsed: number; chopped: number[]; x: number; y: number; stones: string[]; minis: number[]; won: boolean; vc: number }
  | { t: 'full' }
  | { t: 'me'; h: HeroMsg }
  | { t: 'hit'; id: number; dmg: number; nx: number; ny: number }
  | { t: 'boss'; dmg: number }
  | { t: 'mini'; kind: number; dmg: number }
  | { t: 'shoot'; a: Arrow }
  | { t: 'chop'; key: number }
  | { t: 'chest'; x: number; y: number }
  | { t: 'stone'; x: number; y: number }
  | { t: 'build'; x: number; y: number }
  | { t: 'pvp'; target: string; q: number }
  | { t: 'hitwall'; id: number; q: number }
  | { t: 'snap'; s: Snap }
  | { t: 'hurt'; q: number; fx?: number; fy?: number; by?: string; pvp?: boolean }
  | { t: 'reward'; coins: number; arrows: number }
  | { t: 'bonus'; kind: 'mini' | 'challenge'; value: string };

interface Snap {
  el: number;
  pl: HeroMsg[];
  /** id, kind, x, y, z, aggro, hurt, ch, minion, frozen, hp */
  en: [number, number, number, number, number, number, number, number, number, number, number][];
  ar: [number, number, number, number, number, number, number][];
  chests: [number, number][];
  boss: { x: number; y: number; hp: number; active: boolean; state: string; dead: boolean; deadT: number; hurtT: number; rings: Game['boss']['rings']; orbs: Game['boss']['orbs']; clones: Game['boss']['clones']; split: number; dash: Game['boss']['dash'] };
  minis: { x: number; y: number; lift: number; hp: number; active: boolean; dead: boolean; hurtT: number; flash: number }[];
  shots: Game['minis']['shots'];
  hazards: Game['minis']['hazards'];
  ch: Game['challenge'];
  rocks: Game['rocks'];
  rl: number;
  vc: number;
  /** id, x, y, owner, hp */
  walls: [number, number, number, string, number][];
  sealed: boolean;
  won: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function heroOf(g: Game, id: string): HeroMsg {
  const p = g.p;
  return {
    id, name: p.name, outfit: p.outfit, x: r2(p.x), y: r2(p.y), z: r2(p.z), face: r2(p.face), moving: p.moving,
    swingT: r2(p.swingT), climbing: p.climbing, hp: p.hp, maxHp: g.maxHp, ko: g.knockedOut > 0, swordD: g.swordDmg, hurt: p.hurtT > 0,
  };
}

/** Puts a hero we heard about into the game's list of friends. */
function setOther(g: Game, h: HeroMsg) {
  let o = g.others.find((q) => q.id === h.id);
  if (!o) {
    o = { ...h, tx: h.x, ty: h.y, tz: h.z, walkT: 0, hurtT: 0 } as Other;
    g.others.push(o);
  }
  // a big jump (a warp pad or a wake-up) snaps instead of sliding
  if (Math.hypot(h.x - o.x, h.y - o.y) > 8) {
    o.x = h.x;
    o.y = h.y;
    o.z = h.z;
  }
  o.tx = h.x;
  o.ty = h.y;
  o.tz = h.z;
  o.name = h.name;
  o.outfit = h.outfit;
  o.face = h.face;
  o.moving = h.moving;
  if (h.swingT > o.swingT) o.swingT = h.swingT;
  o.climbing = h.climbing;
  o.hp = h.hp;
  o.maxHp = h.maxHp;
  o.ko = h.ko;
  if (h.hurt && o.hurtT <= 0) o.hurtT = 0.6;
  o.swordD = h.swordD;
}

let lastHitToast = 0;
/** Tell you who is hitting you (not on every single hit). */
function hitBy(g: Game, name: string) {
  const now = performance.now();
  if (now - lastHitToast < 3000) return;
  lastHitToast = now;
  g.toast(`${name} hit you!`);
}

export interface Session {
  role: 'host' | 'guest';
  code: string;
  /** Call every frame. */
  tick(dt: number): void;
  close(): void;
}

/** Opens the host's game to friends. */
export async function hostGame(g: Game, onChange: () => void): Promise<Session> {
  const room: Host = await openRoom();
  const links = new Map<string, Link>();
  let nextId = 1;
  let snapT = 0;
  g.role = 'host';

  const sendAll = (m: Msg, except?: string) => {
    for (const [id, l] of links) if (id !== except) l.send(m);
  };
  const to = (id: string, m: Msg) => links.get(id)?.send(m);

  const hooks: NetHooks = {
    hurtRemote: (id, q, fx, fy, pvp) => to(id, { t: 'hurt', q, fx, fy, pvp }),
    hitEnemy: () => {},
    hitBoss: () => {},
    hitMini: () => {},
    shoot: () => {},
    chop: (key) => sendAll({ t: 'chop', key }),
    chest: () => {},
    stone: () => {},
    reward: (owner, coins, arrows) => to(owner, { t: 'reward', coins, arrows }),
    bonus: (kind, value) => sendAll({ t: 'bonus', kind, value }),
    build: () => {},
    hitWall: () => {},
    pvp: (target, q) => to(target, { t: 'hurt', q, fx: g.p.x, fy: g.p.y, by: g.p.name, pvp: true }),
  };
  g.net = hooks;

  room.onLink((link) => {
    if (links.size >= MAX_PLAYERS - 1) {
      link.send({ t: 'full' } satisfies Msg);
      setTimeout(() => link.close(), 500);
      return;
    }
    const id = `p${nextId++}`;
    let named = false;
    link.onMessage((raw) => {
      const m = raw as Msg;
      switch (m.t) {
        case 'hello': {
          if (named) return;
          named = true;
          links.set(id, link);
          // one more village for every friend who joins
          const added = setVillageCount(Math.max(VILLAGES.length, 2 + links.size), g.world);
          link.send({
            t: 'welcome', id, seed: g.world.seed, elapsed: g.elapsed, chopped: [...g.world.chopped], x: g.p.x + 1.5, y: g.p.y + 1,
            stones: [...g.stonesDone], minis: g.minis.defeated(), won: g.won, vc: VILLAGES.length,
          } satisfies Msg);
          g.toast(`${m.name || 'A friend'} joined! Fight them: 4 weapon damage = 1 heart${added ? `. A new village appeared: ${VILLAGES[VILLAGES.length - 1].name}!` : ''}`);
          sfx.coin();
          onChange();
          return;
        }
        case 'me':
          if (links.has(id)) setOther(g, { ...m.h, id });
          return;
        case 'hit': {
          const e = g.enemies.find((q) => q.id === m.id);
          if (e) g.hurtEnemy(e, m.dmg, m.nx, m.ny, id);
          return;
        }
        case 'boss':
          if (g.boss.active && !g.boss.dead) g.hurtBoss(m.dmg);
          return;
        case 'mini':
          g.minis.hurtKind(g, m.kind, m.dmg);
          return;
        case 'shoot':
          g.arrowsFlying.push({ ...m.a, owner: id });
          return;
        case 'chop':
          g.world.chopped.add(m.key);
          sendAll({ t: 'chop', key: m.key }, id);
          return;
        case 'chest':
          g.chests = g.chests.filter((c) => c.x !== m.x || c.y !== m.y);
          return;
        case 'pvp': {
          // a friend hit someone with their sword
          const from = g.others.find((o) => o.id === id);
          if (!from || from.ko) return;
          const q = pvpQuarters(m.q);
          if (m.target === 'host') {
            hitBy(g, from.name);
            g.hurtPlayer(q, from.x, from.y, true);
          } else to(m.target, { t: 'hurt', q, fx: from.x, fy: from.y, by: from.name, pvp: true });
          return;
        }
        case 'build':
          if (g.canWall(m.x, m.y, null)) g.addWall(m.x, m.y, id);
          return;
        case 'hitwall': {
          const w = g.walls.find((q) => q.id === m.id);
          // friends can only take down their own walls; Murks and the Dark Beast hit walls on the host
          if (w && w.owner === id) g.hurtWall(w, m.q);
          return;
        }
        case 'stone':
          if (!g.challenge && g.rocks.some((r) => r.x === m.x && r.y === m.y)) g.startChallenge({ x: m.x, y: m.y });
          return;
      }
    });
    link.onClose(() => {
      if (!links.has(id)) return;
      links.delete(id);
      const o = g.others.find((q) => q.id === id);
      g.others = g.others.filter((q) => q.id !== id);
      g.toast(`${o?.name || 'A friend'} left the game`);
      onChange();
    });
  });

  return {
    role: 'host',
    code: room.code,
    tick(dt) {
      snapT -= dt;
      if (snapT > 0 || !links.size) return;
      snapT = 1 / SNAP_HZ;
      const b = g.boss;
      const s: Snap = {
        el: g.elapsed,
        pl: [heroOf(g, 'host'), ...g.others.map((o) => ({
          id: o.id, name: o.name, outfit: o.outfit, x: o.tx, y: o.ty, z: o.tz, face: o.face, moving: o.moving, swingT: o.swingT,
          climbing: o.climbing, hp: o.hp, maxHp: o.maxHp, ko: o.ko, swordD: o.swordD, hurt: o.hurtT > 0,
        }))],
        en: g.enemies.map((e) => [e.id, e.kind, r2(e.x), r2(e.y), r2(e.z), e.aggro ? 1 : 0, r2(e.hurtT), e.ch ? 1 : 0, e.minion ? 1 : 0, r2(e.frozen ?? 0), e.hp]),
        ar: g.arrowsFlying.map((a) => [r2(a.x), r2(a.y), r2(a.z), r2(a.dx), r2(a.dy), r2(a.life), a.ice ? 1 : 0]),
        chests: g.chests.map((c) => [c.x, c.y]),
        boss: { x: r2(b.x), y: r2(b.y), hp: b.hp, active: b.active, state: b.state, dead: b.dead, deadT: b.deadT, hurtT: b.hurtT, rings: b.rings, orbs: b.orbs, clones: b.clones, split: b.split, dash: b.dash },
        minis: g.minis.list.map((q) => ({ x: r2(q.x), y: r2(q.y), lift: r2(q.lift), hp: q.hp, active: q.active, dead: q.dead, hurtT: q.hurtT, flash: q.flash })),
        shots: g.minis.shots,
        hazards: g.minis.hazards,
        ch: g.challenge,
        rocks: g.rocks,
        rl: g.rockLevel,
        vc: VILLAGES.length,
        walls: g.walls.map((w) => [w.id, w.x, w.y, w.owner === 'me' ? 'host' : w.owner, w.hp]),
        sealed: g.world.sealed,
        won: g.won,
      };
      sendAll({ t: 'snap', s });
    },
    close() {
      for (const l of links.values()) l.close();
      links.clear();
      room.close();
      g.others = [];
      g.net = null;
      g.role = 'solo';
    },
  };
}

/** Joins a friend's game. Resolves with the new game once the host says hello back. */
export async function joinGame(code: string, name: string, outfit: string, onLeft: (why: string) => void): Promise<{ game: Game; session: Session }> {
  const link = await joinRoom(code);
  link.send({ t: 'hello', name, outfit } satisfies Msg);
  const welcome = await new Promise<Extract<Msg, { t: 'welcome' }>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The host did not answer')), 10000);
    link.onMessage((raw) => {
      const m = raw as Msg;
      if (m.t === 'welcome') {
        clearTimeout(timer);
        resolve(m);
      } else if (m.t === 'full') {
        clearTimeout(timer);
        reject(new Error('That game is full (8 heroes)'));
      }
    });
    link.onClose(() => reject(new Error('The link closed')));
  });

  setVillageCount(welcome.vc || 2);
  const g = new Game(name, welcome.seed, `guest-${Date.now().toString(36)}`);
  g.p.outfit = outfit;
  g.role = 'guest';
  g.elapsed = welcome.elapsed;
  for (const k of welcome.chopped) g.world.chopped.add(k);
  g.stonesDone = new Set(welcome.stones);
  for (const k of welcome.minis) g.minis.list[k].dead = true;
  g.won = welcome.won;
  g.p.x = welcome.x;
  g.p.y = welcome.y;
  g.p.z = g.world.heightAt(g.p.x, g.p.y);
  g.coopLabel = `Co-op · code ${code}`;
  const myId = welcome.id;
  g.myId = myId;
  let left = false;
  const gotMini = new Set<number>(welcome.minis);

  g.net = {
    hurtRemote: () => {},
    hitEnemy: (id, dmg, nx, ny) => link.send({ t: 'hit', id, dmg, nx, ny } satisfies Msg),
    hitBoss: (dmg) => link.send({ t: 'boss', dmg } satisfies Msg),
    hitMini: (kind, dmg) => link.send({ t: 'mini', kind, dmg } satisfies Msg),
    shoot: (a) => link.send({ t: 'shoot', a } satisfies Msg),
    chop: (key) => link.send({ t: 'chop', key } satisfies Msg),
    chest: (x, y) => link.send({ t: 'chest', x, y } satisfies Msg),
    stone: (x, y) => link.send({ t: 'stone', x, y } satisfies Msg),
    reward: () => {},
    bonus: () => {},
    build: (x, y) => link.send({ t: 'build', x, y } satisfies Msg),
    hitWall: (id, q) => link.send({ t: 'hitwall', id, q } satisfies Msg),
    pvp: (target, q) => link.send({ t: 'pvp', target, q } satisfies Msg),
  };

  link.onMessage((raw) => {
    const m = raw as Msg;
    switch (m.t) {
      case 'snap':
        applySnap(g, m.s, myId);
        return;
      case 'hurt':
        if (m.by) hitBy(g, m.by);
        g.hurtPlayer(m.q, m.fx, m.fy, m.pvp);
        return;
      case 'reward':
        g.coins += m.coins;
        g.arrows += m.arrows;
        g.lx.en.addXp(g, 1 + m.coins);
        g.float(g.p.x, g.p.y, g.p.z + 1.5, `+${m.coins} coin${m.coins > 1 ? 's' : ''}`, '#ffd34d');
        if (g.job === 'grocer') g.addMeat(g.p.x, g.p.y, g.p.z + 0.5);
        if (g.job === 'guard') {
          g.coins += 3;
          g.float(g.p.x, g.p.y, g.p.z + 2, '+3 pay', '#ffd34d');
        }
        sfx.coin();
        return;
      case 'chop':
        g.world.chopped.add(m.key);
        return;
      case 'bonus':
        if (m.kind === 'challenge') {
          if (g.stonesDone.has(m.value)) return;
          g.stonesDone.add(m.value);
          if (g.maxHp < MAX_HP_CAP) g.maxHp++;
          g.p.hp = Math.min(g.maxHp, g.p.hp + 4);
          g.toast(`Challenge won! +¼ heart forever (${g.maxHp / 4} hearts)`);
          sfx.win();
        } else {
          const q = g.minis.list[Number(m.value)];
          if (q && !gotMini.has(q.kind)) {
            gotMini.add(q.kind);
            g.minis.reward(g, q);
          }
        }
        return;
    }
  });
  link.onClose(() => {
    if (left) return;
    left = true;
    onLeft('The host left the game');
  });

  let meT = 0;
  const session: Session = {
    role: 'guest',
    code,
    tick(dt) {
      meT -= dt;
      if (meT > 0) return;
      meT = 1 / ME_HZ;
      link.send({ t: 'me', h: heroOf(g, myId) } satisfies Msg);
    },
    close() {
      left = true;
      link.close();
    },
  };
  return { game: g, session };
}

function applySnap(g: Game, s: Snap, myId: string) {
  g.elapsed = s.el;
  // friends
  const seen = new Set<string>();
  for (const h of s.pl) {
    if (h.id === myId) continue;
    seen.add(h.id);
    setOther(g, h);
  }
  g.others = g.others.filter((o) => seen.has(o.id));
  // enemies: keep where we drew them, and slide toward where the host has them
  const old = new Map(g.enemies.map((e) => [e.id, e]));
  g.enemies = s.en.map(([id, kind, x, y, z, aggro, hurt, ch, minion, frozen, hp]) => {
    const e: Enemy = old.get(id) ?? { id, kind, x, y, z, hp: 1, aggro: false, atkCd: 0, hurtT: 0, kx: 0, ky: 0, wanderA: 0, wanderT: 0, hop: Math.random() * 6 };
    if (Math.hypot(e.x - x, e.y - y) > 6) {
      e.x = x;
      e.y = y;
    }
    e.tx = x;
    e.ty = y;
    e.z = z;
    e.aggro = !!aggro;
    if (hurt > e.hurtT) e.hurtT = hurt;
    e.ch = !!ch;
    e.minion = !!minion;
    e.frozen = frozen;
    e.hp = hp;
    return e;
  });
  g.arrowsFlying = s.ar.map(([x, y, z, dx, dy, life, ice]) => ({ x, y, z, dx, dy, life, dmg: 0, ice: !!ice }));
  g.chests = s.chests.map(([x, y]) => ({ x, y }));
  // the Dark Beast
  const b = g.boss;
  b.x = s.boss.x;
  b.y = s.boss.y;
  b.hp = s.boss.hp;
  b.active = s.boss.active;
  b.state = s.boss.state as typeof b.state;
  b.dead = s.boss.dead;
  if (b.dead && s.boss.deadT > b.deadT) b.deadT = s.boss.deadT;
  if (s.boss.hurtT > b.hurtT) b.hurtT = s.boss.hurtT;
  b.rings = s.boss.rings;
  b.orbs = s.boss.orbs;
  b.clones = s.boss.clones;
  b.split = s.boss.split;
  b.dash = s.boss.dash;
  // mini bosses
  s.minis.forEach((q, i) => {
    const m = g.minis.list[i];
    if (!m) return;
    m.x = q.x;
    m.y = q.y;
    m.lift = q.lift;
    m.hp = q.hp;
    m.active = q.active;
    if (q.dead) m.dead = true;
    if (q.hurtT > m.hurtT) m.hurtT = q.hurtT;
    m.flash = q.flash;
  });
  g.minis.shots = s.shots;
  g.minis.hazards = s.hazards;
  g.challenge = s.ch;
  g.rocks = s.rocks;
  g.rockLevel = s.rl;
  const oldWalls = new Map(g.walls.map((w) => [w.id, w]));
  g.walls = s.walls.map(([id, x, y, owner, hp]) => {
    const o = oldWalls.get(id);
    return { id, x, y, owner, hp, hurtT: o && o.hp > hp ? 0.2 : o?.hurtT ?? 0 };
  });
  if (s.vc && setVillageCount(s.vc, g.world)) g.toast(`A new village appeared: ${VILLAGES[VILLAGES.length - 1].name}!`);
  g.world.sealed = s.sealed;
  if (s.won && !g.won) {
    g.won = true;
    sfx.win();
    g.coins += 50;
    g.toast('The Dark Beast is defeated! +50 coins');
    g.say('won', 'You did it! The Dark Beast is gone and the land is saved!', 999);
  }
}
