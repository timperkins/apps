// Advanced mode: the rocket silo and the space platform. A rocket needs 10 rocket parts and 10
// rocket fuel. The first one has to carry a space platform starter pack; after that rockets carry
// whatever is in the payload up to the platform's cargo bay. On the platform, asteroid catchers
// grab little asteroids as they drift by, crushers turn them into ore, ice and crystals, and
// thrusters burn ice to fly into deep space, where cryser asteroids (and their crystals) are common.
// The asteroids are the same three kinds as in the Explorer game: rusty, carbon and cryser.
import { ITEMS, type ItemId } from './data';
import { Inventory } from './inventory';
import type { Entity, Game } from './sim';

const TPS = 60;
export const ROCKET_PARTS = 10;
export const ROCKET_FUEL = 10;
const BUILD_SECONDS = 20;
export const LAUNCH_TICKS = 60 * 6;
/** Distance where deep space starts. */
export const DEEP_KM = 5000;
const KM_PER_THRUSTER = 25;
const ICE_SECONDS = 20;
const CRUSH_SECONDS = 3;
export const MODULE_MAX = 8;

export type RockKind = 0 | 1 | 2; // rusty, carbon, cryser
export const ROCK_NAMES = ['Rusty', 'Carbon', 'Cryser'];
export const ROCK_COLOR = ['#a55a33', '#35363b', '#7fc8ef'];
export const ROCK_LIGHT = ['#d98a5e', '#5c5e66', '#d2f0ff'];

export interface Rock {
  id: number;
  kind: RockKind;
  size: number; // 0 little, 1 medium, 2 big
  x: number; // 0..100 across the view
  y: number; // 0..100 down the view
  vx: number;
  vy: number;
  rot: number;
  catchable: boolean;
  /** ticks left being reeled in by a catcher */
  reel: number;
  cx: number; // catcher it goes to
}

export interface Space {
  built: boolean;
  cargo: Inventory;
  catchers: number;
  crushers: number;
  thrusters: number;
  dist: number;
  flying: boolean;
  speed: number;
  /** caught asteroids waiting for a crusher */
  chunks: [number, number, number];
  crush: number;
  fuelT: number;
  launches: number;
  rocks: Rock[];
  nextRock: number;
  /** what the crushers last made, for the panel */
  last: string;
}

export function newSpace(): Space {
  return {
    built: false, cargo: new Inventory(30), catchers: 0, crushers: 0, thrusters: 0, dist: 0, flying: false, speed: 0,
    chunks: [0, 0, 0], crush: 0, fuelT: 0, launches: 0, rocks: [], nextRock: 1, last: '',
  };
}

export function spaceToJSON(s: Space) {
  return {
    b: s.built, c: s.cargo.toJSON(), m: [s.catchers, s.crushers, s.thrusters], d: Math.round(s.dist), f: s.flying,
    ch: s.chunks, ft: s.fuelT, l: s.launches,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function spaceFromJSON(d: any): Space {
  const s = newSpace();
  if (!d) return s;
  s.built = !!d.b;
  if (d.c) s.cargo.load(d.c);
  [s.catchers, s.crushers, s.thrusters] = Array.isArray(d.m) ? d.m : [0, 0, 0];
  s.dist = d.d ?? 0;
  s.flying = !!d.f;
  s.chunks = Array.isArray(d.ch) ? d.ch : [0, 0, 0];
  s.fuelT = d.ft ?? 0;
  s.launches = d.l ?? 0;
  return s;
}

export const deepSpace = (s: Space) => s.dist >= DEEP_KM;

// ---------- the silo ----------

/** e.crafting = 'rocket' while building; e.recipe = 'ready' once a rocket stands in the silo; e.t counts the launch. */
export function updateSilo(g: Game, e: Entity) {
  if (e.t > 0) {
    e.t++;
    e.working = true;
    e.status = 'Launching!';
    if (e.t >= LAUNCH_TICKS && !g.remote) finishLaunch(g, e);
    return;
  }
  if (e.recipe === 'ready') {
    e.working = false;
    e.status = g.space.built || e.inv!.count('platform-kit') ? 'Rocket ready: press Launch' : 'Rocket ready: put a space platform starter pack in the payload';
    return;
  }
  if (!e.crafting) {
    const parts = e.input['rocket-part'] ?? 0, fuel = e.input['rocket-fuel'] ?? 0;
    if (parts < ROCKET_PARTS || fuel < ROCKET_FUEL) {
      e.working = false;
      e.status = `Needs ${Math.max(0, ROCKET_PARTS - parts)} more rocket parts and ${Math.max(0, ROCKET_FUEL - fuel)} more rocket fuel`;
      return;
    }
    if (g.remote) return;
    e.input['rocket-part'] = parts - ROCKET_PARTS;
    e.input['rocket-fuel'] = fuel - ROCKET_FUEL;
    e.crafting = 'rocket';
    e.progress = 0;
  }
  if (e.net < 0 || e.sat <= 0) {
    e.working = false;
    e.status = e.net < 0 ? 'Not connected to power' : 'No power';
    return;
  }
  e.working = true;
  e.status = 'Building a rocket';
  e.anim += e.sat;
  e.progress += e.sat / TPS / BUILD_SECONDS;
  if (e.progress >= 1) {
    e.crafting = null;
    e.progress = 0;
    e.recipe = 'ready';
    g.toast('A rocket is ready in the silo!', 4);
  }
}

function finishLaunch(g: Game, e: Entity) {
  e.t = 0;
  const s = g.space;
  const pay = e.inv!;
  s.launches++;
  if (!s.built && pay.count('platform-kit') > 0) {
    pay.remove('platform-kit', 1);
    s.built = true;
    g.toast('Your space platform is in orbit! Open it with the Space button.', 6);
  } else g.toast('The rocket made it to your space platform.', 4);
  let lost = false;
  for (let i = 0; i < pay.slots.length; i++) {
    const st = pay.slots[i];
    if (!st) continue;
    const k = s.cargo.add(st.item, st.n);
    if (k < st.n) lost = true;
    pay.slots[i] = null;
  }
  if (lost) g.toast('The platform cargo bay was full: some payload floated away', 4);
  g.events.push('launched');
}

// ---------- the platform ----------

export function updateSpace(g: Game) {
  const s = g.space;
  if (!s.built) return;
  const host = !g.remote;
  // thrusters burn ice
  s.speed = 0;
  if (s.flying && s.thrusters > 0) {
    if (s.fuelT <= 0 && host && s.cargo.remove('ice', 1) === 1) s.fuelT += ICE_SECONDS;
    if (s.fuelT > 0) {
      s.speed = KM_PER_THRUSTER * s.thrusters;
      s.fuelT -= s.thrusters / TPS;
    }
  }
  s.dist += s.speed / TPS;
  // asteroids drift by: more when you fly, and bigger ones only while you're moving
  const moving = s.speed > 0;
  const rate = (moving ? 1.6 : 0.5) / TPS;
  if (Math.random() < rate && s.rocks.length < 40) {
    const mix = deepSpace(s) ? [0.3, 0.3, 0.4] : [0.45, 0.45, 0.1];
    const q = Math.random();
    const kind = (q < mix[0] ? 0 : q < mix[0] + mix[1] ? 1 : 2) as RockKind;
    const z = Math.random();
    const size = moving ? (z < 0.6 ? 0 : z < 0.88 ? 1 : 2) : 0;
    s.rocks.push({
      id: s.nextRock++, kind, size, x: 5 + Math.random() * 90, y: -8, vx: (Math.random() - 0.5) * 3,
      vy: (moving ? 14 : 5) + Math.random() * 4, rot: Math.random() * 6, catchable: size === 0 && Math.random() < Math.min(0.95, 0.3 * s.catchers),
      reel: 0, cx: 50,
    });
  }
  const PY = 50; // platform's top edge, in view units
  for (const r of s.rocks) {
    r.rot += 0.01 + r.size * 0.004;
    if (r.reel > 0) {
      // pulled in by a catcher
      r.x += (r.cx - r.x) * 0.08;
      r.y += (PY - r.y) * 0.08;
      if (--r.reel <= 0) {
        r.y = 999;
        if (host) s.chunks[r.kind]++;
      }
      continue;
    }
    r.x += r.vx / TPS;
    r.y += r.vy / TPS;
    if (r.catchable && r.y > PY - 22 && s.catchers > 0) {
      r.reel = 40;
      r.cx = catcherX(s, Math.floor(Math.random() * s.catchers));
      g.events.push('catch');
    }
  }
  s.rocks = s.rocks.filter((r) => r.y < 110);
  // crushers
  const total = s.chunks[0] + s.chunks[1] + s.chunks[2];
  if (host && s.crushers > 0 && total > 0) {
    s.crush += s.crushers / TPS / CRUSH_SECONDS;
    while (s.crush >= 1 && s.chunks[0] + s.chunks[1] + s.chunks[2] > 0) {
      s.crush -= 1;
      // the kind with the most waiting goes next
      const k = ([0, 1, 2] as RockKind[]).reduce((m, i) => (s.chunks[i] > s.chunks[m] ? i : m), 0 as RockKind);
      s.chunks[k]--;
      const made = crushRock(k);
      for (const [it, n] of made) s.cargo.add(it, n);
      s.last = made.map(([it, n]) => `${n} ${ITEMS[it].name.toLowerCase()}`).join(', ');
    }
  } else if (!total) s.crush = 0;
}

/** What a crusher makes from one asteroid (the Explorer game's odds). */
function crushRock(k: RockKind): [ItemId, number][] {
  const roll = (p: number, n: number) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (Math.random() < p) c++;
    return c;
  };
  const out: [ItemId, number][] =
    k === 0 ? [['copper-ore', roll(0.96, 5)], ['owen-ore', roll(0.8, 5)]]
      : k === 1 ? [['coal', roll(0.98, 5)], ['stone', 3]]
        : [['ice', 3], ['cryser-crystal', roll(0.8, 1)]];
  return out.filter(([, n]) => n > 0);
}

/** Where a catcher sits along the top of the platform, in view units. */
export function catcherX(s: Space, i: number) {
  const w = platformWidth(s);
  const n = Math.max(1, s.catchers);
  return 50 - w / 2 + (w * (i + 0.5)) / n;
}

export function platformWidth(s: Space) {
  return 26 + Math.max(s.catchers, s.crushers, s.thrusters) * 5;
}

const MODULES = { catcher: 'catchers', crusher: 'crushers', thruster: 'thrusters' } as const;

/**
 * Space-platform commands from the panel. `e` is the silo for launch and drop.
 * Returns items for the player (none so far) and a message when it can't be done.
 */
export function doSpace(g: Game, op: string, e: Entity | null): string {
  const s = g.space;
  const [cmd, arg] = op.split(':');
  if (cmd === 'launch') {
    if (!e || e.def.kind !== 'silo') return 'No silo';
    if (e.recipe !== 'ready' || e.t > 0) return 'No rocket is ready yet';
    if (!s.built && !e.inv!.count('platform-kit')) return 'The first rocket has to carry a space platform starter pack';
    e.recipe = null;
    e.t = 1;
    g.events.push('launch');
    return '';
  }
  if (!s.built) return 'You have no space platform yet';
  if (cmd === 'fly') {
    s.flying = !s.flying;
    if (s.flying && !s.thrusters) return 'Install a thruster first';
    if (s.flying && !s.cargo.count('ice') && s.fuelT <= 0) return 'Thrusters need ice in the cargo bay';
    return '';
  }
  if (cmd === 'add' || cmd === 'remove') {
    const key = MODULES[arg as keyof typeof MODULES];
    if (!key) return '';
    const item = arg as ItemId;
    if (cmd === 'add') {
      if (s[key] >= MODULE_MAX) return `The platform holds up to ${MODULE_MAX}`;
      if (s.cargo.remove(item, 1) < 1) return `Send a ${ITEMS[item].name.toLowerCase()} up in a rocket first`;
      s[key]++;
    } else if (s[key] > 0 && s.cargo.add(item, 1) === 1) s[key]--;
    return '';
  }
  if (cmd === 'drop') {
    if (!e || e.def.kind !== 'silo') return 'Open a rocket silo to bring cargo down';
    let moved = 0;
    for (let i = 0; i < s.cargo.slots.length; i++) {
      const st = s.cargo.slots[i];
      if (!st || (arg && st.item !== arg)) continue;
      const k = e.inv2!.add(st.item, st.n);
      moved += k;
      st.n -= k;
      if (st.n <= 0) s.cargo.slots[i] = null;
    }
    if (!moved) return 'Nothing came down: the landing bay is full or the cargo is empty';
    g.events.push('landed');
    return '';
  }
  return '';
}

// ---------- drawing the platform view ----------

function rockShape(c: CanvasRenderingContext2D, r: Rock, x: number, y: number, rad: number) {
  c.save();
  c.translate(x, y);
  c.rotate(r.rot);
  c.fillStyle = ROCK_COLOR[r.kind];
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const k = 0.78 + 0.22 * Math.sin(r.id * 3.1 + i * 2.3);
    c.lineTo(Math.cos(a) * rad * k, Math.sin(a) * rad * k);
  }
  c.closePath();
  c.fill();
  c.fillStyle = ROCK_LIGHT[r.kind];
  c.beginPath();
  c.arc(-rad * 0.3, -rad * 0.3, rad * 0.3, 0, Math.PI * 2);
  c.fill();
  if (r.kind === 2) {
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.fillRect(rad * 0.1, -rad * 0.1, rad * 0.25, rad * 0.25);
  }
  c.restore();
}

export function drawSpace(cv: HTMLCanvasElement, g: Game, time: number) {
  const s = g.space;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const c = cv.getContext('2d')!;
  const u = W / 100;
  const vy = (y: number) => (y / 100) * H;
  c.fillStyle = deepSpace(s) ? '#0b0718' : '#060b18';
  c.fillRect(0, 0, W, H);
  // stars stream past faster when flying
  const flow = time * (s.speed > 0 ? 40 : 4);
  for (let i = 0; i < 70; i++) {
    const sx = ((i * 37.7) % 100) * u;
    const sy = (((i * 61.3 + flow * (0.5 + (i % 3) * 0.3)) % 100) / 100) * H;
    c.fillStyle = `rgba(255,255,255,${0.3 + (i % 4) * 0.15})`;
    c.fillRect(sx, sy, dpr * (1 + (i % 2)), dpr * (1 + (i % 2)) * (s.speed > 0 ? 3 : 1));
  }
  // the planet below, shrinking as you fly away
  const pr = Math.max(0, 1 - s.dist / DEEP_KM);
  if (pr > 0) {
    const R = W * (0.5 + pr * 0.6);
    const grd = c.createRadialGradient(W / 2, H + R * 0.75, R * 0.6, W / 2, H + R * 0.75, R);
    grd.addColorStop(0, '#2c6bc4');
    grd.addColorStop(0.9, '#5aa0e8');
    grd.addColorStop(1, 'rgba(120,180,255,0)');
    c.fillStyle = grd;
    c.beginPath();
    c.arc(W / 2, H + R * 0.75, R, 0, Math.PI * 2);
    c.fill();
  }
  // platform
  const pw = platformWidth(s) * u, px = W / 2 - pw / 2, py = vy(50), ph = vy(24);
  c.fillStyle = '#3a4250';
  c.fillRect(px, py, pw, ph);
  c.strokeStyle = '#596476';
  c.lineWidth = dpr;
  for (let x = px; x <= px + pw + 0.5; x += 4 * u) {
    c.beginPath();
    c.moveTo(x, py);
    c.lineTo(x, py + ph);
    c.stroke();
  }
  for (let y = py; y <= py + ph + 0.5; y += vy(6)) {
    c.beginPath();
    c.moveTo(px, y);
    c.lineTo(px + pw, y);
    c.stroke();
  }
  // hub in the middle with the Owen O
  c.fillStyle = '#c9ced8';
  c.fillRect(W / 2 - 5 * u, py + vy(6), 10 * u, vy(10));
  c.strokeStyle = '#5466a8';
  c.lineWidth = u * 1.2;
  c.beginPath();
  c.arc(W / 2, py + vy(11), u * 2.4, 0, Math.PI * 2);
  c.stroke();
  // catchers along the top
  for (let i = 0; i < s.catchers; i++) {
    const x = catcherX(s, i) * u;
    c.fillStyle = '#e3b341';
    c.fillRect(x - u * 1.2, py - u * 3, u * 2.4, u * 3);
    c.strokeStyle = '#e3b341';
    c.lineWidth = u * 0.7;
    c.beginPath();
    c.moveTo(x, py - u * 3);
    c.lineTo(x - u * 2, py - u * 5.5);
    c.moveTo(x, py - u * 3);
    c.lineTo(x + u * 2, py - u * 5.5);
    c.stroke();
  }
  // crushers on the deck
  for (let i = 0; i < s.crushers; i++) {
    const x = px + ((i + 0.5) / s.crushers) * pw;
    const yy = py + ph - vy(6);
    c.fillStyle = '#7b6a58';
    c.fillRect(x - u * 2, yy - u * 1.6, u * 4, u * 3.2);
    c.fillStyle = '#2b2f36';
    c.beginPath();
    c.arc(x, yy, u * 1.1, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#c9b79c';
    c.lineWidth = u * 0.35;
    const a = s.crush > 0 ? time * 8 : 0;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * u, yy + Math.sin(a) * u);
    c.lineTo(x - Math.cos(a) * u, yy - Math.sin(a) * u);
    c.stroke();
  }
  // thrusters underneath, with flames while flying
  for (let i = 0; i < s.thrusters; i++) {
    const x = px + ((i + 0.5) / s.thrusters) * pw;
    c.fillStyle = '#8d939e';
    c.beginPath();
    c.moveTo(x - u * 1.6, py + ph);
    c.lineTo(x + u * 1.6, py + ph);
    c.lineTo(x + u * 2.2, py + ph + u * 2.5);
    c.lineTo(x - u * 2.2, py + ph + u * 2.5);
    c.closePath();
    c.fill();
    if (s.speed > 0) {
      const f = 1 + Math.sin(time * 30 + i) * 0.2;
      const grd = c.createLinearGradient(0, py + ph + u * 2.5, 0, py + ph + u * 10 * f);
      grd.addColorStop(0, '#fff3b0');
      grd.addColorStop(0.4, '#ff9a3c');
      grd.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = grd;
      c.beginPath();
      c.moveTo(x - u * 1.8, py + ph + u * 2.5);
      c.lineTo(x + u * 1.8, py + ph + u * 2.5);
      c.lineTo(x, py + ph + u * 10 * f);
      c.closePath();
      c.fill();
    }
  }
  // asteroids
  for (const r of s.rocks) {
    const rad = u * (1.2 + r.size * 1.6);
    if (r.reel > 0) {
      c.strokeStyle = 'rgba(227,179,65,.8)';
      c.lineWidth = dpr * 1.5;
      c.beginPath();
      c.moveTo(r.cx * u, py - u * 4);
      c.lineTo(r.x * u, vy(r.y));
      c.stroke();
    }
    rockShape(c, r, r.x * u, vy(r.y), rad);
  }
}
