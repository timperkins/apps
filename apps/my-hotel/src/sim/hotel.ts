// The hotel simulation: plain data plus functions that advance it. No DOM or three.js here,
// so it can be tested and saved as JSON.
import { BAG_COLORS, FIRST_NAMES, HAIR_COLORS, HATS, LAST_INITIALS, OUTFIT_COLORS, REVIEWS, SKIN_TONES, type Hat } from '../content/guests';
import {
  COIN_PILE,
  DESK_ZONE,
  LOT,
  PILE_RADIUS,
  QUEUE_CELLS,
  RECEPTIONIST_SPOT,
  SPAWN,
  START_LOTS,
  buildGrid,
  enclosedLots,
  inRect,
  isBlocked,
  lotCenter,
  lotKey,
  lotsForSale,
  parseLot,
  roomGeom,
  type Grid,
} from './layout';
import { findPath, type Point } from './path';
import { nextRandom, pick } from './rng';

export const MAP_IDS = ['seaside', 'city', 'lodge'] as const;
export type MapId = (typeof MAP_IDS)[number];

export const PLAYER_SPEED = 6;
export const PLAYER_RADIUS = 0.35;
export const GUEST_SPEED = 3.2;
export const STAFF_SPEED = 2.6;
export const START_GUESTS = 3;
export const MAX_QUEUE = QUEUE_CELLS.length;
export const CHECKIN_TIME = { player: 0.6, staff: 1.8 };
export const CLEAN_TIME = { player: 1.5, staff: 4 };
export const PAD_SIZE = 2.4;
export const LOT_PAD_SIZE = 3.4;
export const CLERK_PRICE = 250;
export const CLEANER_PRICE = 150; // each extra cleaner costs CLEANER_STEP more
export const CLEANER_STEP = 50;
/** Cleaner pads in the lobby; every other lot gets one more. */
export const LOBBY_CLEANER_SPOTS: Point[] = [{ x: 5.5, z: 1.8 }, { x: 10.4, z: 7.4 }];
export const RESTOCKER_PRICE = 200;
export const RESTOCKER_PAD = { x: 8.2, z: 3.3 };
export const SODA_PRICE = 50;
export const MACHINE_STOCK = 6;
export const RESTOCK_TIME = 1.5; // seconds the restocker spends at a machine
export const SODA_CHANCE = 0.7; // share of guests who grab a soda on the way out
export type StaffRole = 'receptionist' | 'housekeeper' | 'restocker';

/** A vending machine fills one grid cell; guests and the player use it from the front. */
export interface Vending {
  id: number;
  cell: [number, number];
  face: number; // heading the front faces, 0 = +z
  stock: number;
  cash: number; // soda money waiting inside
}

/** Where to stand to use a machine. */
export function machineFront(m: Vending): Point {
  return { x: m.cell[0] + 0.5 + Math.sin(m.face) * 1.1, z: m.cell[1] + 0.5 + Math.cos(m.face) * 1.1 };
}
export const MACHINE_REACH = 1.2;

export interface Room {
  id: number;
  i: number;
  j: number;
  side: 0 | 1;
  built: boolean;
  state: 'ready' | 'occupied' | 'dirty';
  guestId: number | null;
  clean: number; // 0..1 cleaning progress
}

export type GuestState = 'arriving' | 'queued' | 'toRoom' | 'sleeping' | 'toSoda' | 'leaving';

export interface Guest {
  id: number;
  name: string;
  look: { outfit: string; skin: string; hair: string; hat: Hat; bag: string | null };
  state: GuestState;
  pos: Point;
  path: Point[];
  heading: number; // radians, 0 = facing +z
  waited: number;
  queueIndex: number;
  roomId: number | null;
  stayLeft: number;
  angry: boolean;
  vendId: number | null; // the machine a guest is heading to
}

export interface Staff {
  id: string;
  role: StaffRole;
  home: Point; // where they wait when there's nothing to do
  pos: Point;
  path: Point[];
  heading: number;
  roomId: number | null; // housekeeper's current job
  vendId?: number | null; // restocker's current job
  busy?: number; // seconds spent at the current job
}

export interface Hotel {
  version: 4;
  map: MapId;
  time: number;
  coins: number;
  pile: number; // coins waiting at the desk
  xp: number;
  served: number;
  reviews: number[];
  lots: string[];
  lotsBought: number;
  rooms: Room[];
  guests: Guest[];
  staff: Staff[];
  cleanerSpots: { id: number; x: number; z: number; hired: boolean }[];
  vending: Vending[];
  padPaid: Record<string, number>;
  checkin: number; // 0..1 progress on the guest at the front
  player: { pos: Point; heading: number; moving: boolean };
  nextGuestId: number;
  nextRoomId: number;
  nextArrival: number;
  layoutVersion: number;
  rng: { seed: number };
}

export interface Input {
  x: number; // -1..1, +x = right
  z: number; // -1..1, +z = towards the camera
}

export type HotelEvent =
  | { kind: 'collect'; amount: number }
  | { kind: 'paid'; amount: number; tip: number }
  | { kind: 'review'; name: string; stars: number; text: string }
  | { kind: 'cleaned'; roomId: number }
  | { kind: 'soda'; machineId: number }
  | { kind: 'restocked'; machineId: number; cash: number; byPlayer: boolean }
  | { kind: 'unlocked'; what: string }
  | { kind: 'levelUp'; level: number };

export interface Pad {
  id: string;
  kind: 'room' | 'lot' | 'staff';
  x: number;
  z: number;
  size: number;
  price: number;
  paid: number;
  label: string;
}

// ---------- setup ----------

export function createHotel(map: MapId, seed = Date.now()): Hotel {
  const h: Hotel = {
    version: 4,
    map,
    time: 0,
    coins: 0,
    pile: 0,
    xp: 0,
    served: 0,
    reviews: [],
    lots: [],
    lotsBought: 0,
    rooms: [],
    guests: [],
    staff: [],
    cleanerSpots: [],
    vending: [],
    padPaid: {},
    checkin: 0,
    player: { pos: { x: 0.9, z: 9.5 }, heading: 0, moving: false },
    nextGuestId: 1,
    nextRoomId: 1,
    nextArrival: 1,
    layoutVersion: 0,
    rng: { seed: seed | 0 },
  };
  for (const spot of LOBBY_CLEANER_SPOTS) addCleanerSpot(h, spot);
  addMachine(h, LOBBY_MACHINE);
  for (const [i, j] of START_LOTS) addLot(h, i, j, false); // the lobby's machine is the only one at first
  // the left wing starts with both rooms built
  h.rooms.filter((r) => r.i === -1).forEach((r) => (r.built = true));
  h.layoutVersion++;
  // a few guests are already in line, so there's something to do right away
  for (let k = 0; k < START_GUESTS; k++) {
    const [cx, cz] = QUEUE_CELLS[k];
    const g = newGuest(h, { x: cx + 0.5, z: cz + 0.5 });
    g.state = 'queued';
    g.queueIndex = k;
    g.heading = -Math.PI / 2;
    h.guests.push(g);
  }
  h.nextArrival = 4;
  return h;
}

function addCleanerSpot(h: Hotel, p: Point) {
  h.cleanerSpots.push({ id: h.cleanerSpots.length + 1, x: p.x, z: p.z, hired: false });
}

/** Every lot except the lobby has a cleaner pad in its front corridor. */
export const lotCleanerSpot = (i: number, j: number): Point => ({ x: i * LOT + 6, z: j * LOT + 9.5 });

/** The lobby's machine stands against the back wall; every lot bought later has one in its front-right corner. */
export const LOBBY_MACHINE = { cell: [3, 1] as [number, number], face: 0 };
export const lotMachine = (i: number, j: number) => ({ cell: [i * LOT + 10, j * LOT + 10] as [number, number], face: -Math.PI / 2 });

export function addMachine(h: Hotel, m: { cell: [number, number]; face: number }) {
  h.vending.push({ id: h.vending.length + 1, cell: [...m.cell], face: m.face, stock: MACHINE_STOCK, cash: 0 });
}

function addLot(h: Hotel, i: number, j: number, withMachine = true) {
  h.lots.push(lotKey(i, j));
  if (i === 0 && j === 0) return;
  addCleanerSpot(h, lotCleanerSpot(i, j));
  if (withMachine) addMachine(h, lotMachine(i, j));
  for (const side of [0, 1] as const) {
    h.rooms.push({ id: h.nextRoomId++, i, j, side, built: false, state: 'ready', guestId: null, clean: 0 });
  }
}

// ---------- derived data ----------

const gridCache = new WeakMap<Hotel, { version: number; grid: Grid }>();
export function grid(h: Hotel): Grid {
  const c = gridCache.get(h);
  if (c && c.version === h.layoutVersion) return c.grid;
  const g = buildGrid({ owned: new Set(h.lots), builtRooms: h.rooms.filter((r) => r.built), blockedCells: h.vending.map((m) => m.cell) });
  gridCache.set(h, { version: h.layoutVersion, grid: g });
  return g;
}

export const builtRoomCount = (h: Hotel) => h.rooms.filter((r) => r.built).length;

export function roomPrice(h: Hotel): number {
  return Math.round((40 * 1.55 ** Math.max(0, builtRoomCount(h) - 2)) / 10) * 10;
}

export function lotPrice(h: Hotel): number {
  return Math.round((300 * 1.6 ** h.lotsBought) / 50) * 50;
}

export function cleanerPrice(h: Hotel): number {
  return CLEANER_PRICE + CLEANER_STEP * h.cleanerSpots.filter((c) => c.hired).length;
}

export function levelInfo(xp: number) {
  let level = 1, need = 10, floor = 0;
  while (xp >= floor + need) {
    floor += need;
    level++;
    need = Math.round(need * 1.45);
  }
  return { level, into: xp - floor, need };
}

export const roomRate = (h: Hotel) => 20 + 5 * (levelInfo(h.xp).level - 1);

export function rating(h: Hotel): number | null {
  if (!h.reviews.length) return null;
  return h.reviews.reduce((a, b) => a + b, 0) / h.reviews.length;
}

export function pads(h: Hotel): Pad[] {
  const out: Pad[] = [];
  const paid = (id: string) => h.padPaid[id] ?? 0;
  const rp = roomPrice(h);
  for (const r of h.rooms) {
    if (r.built) continue;
    const g = roomGeom(r.i, r.j, r.side);
    const id = `room:${r.id}`;
    out.push({ id, kind: 'room', x: g.pad.x, z: g.pad.z, size: PAD_SIZE, price: rp, paid: paid(id), label: 'ROOM' });
  }
  const owned = new Set(h.lots);
  const lp = lotPrice(h);
  for (const [i, j] of lotsForSale(owned)) {
    const c = lotCenter(i, j);
    const id = `lot:${i},${j}`;
    out.push({ id, kind: 'lot', x: c.x, z: c.z, size: LOT_PAD_SIZE, price: lp, paid: paid(id), label: 'LAND' });
  }
  const cp = cleanerPrice(h);
  for (const c of h.cleanerSpots) {
    if (c.hired) continue;
    const id = `staff:cleaner:${c.id}`;
    out.push({ id, kind: 'staff', x: c.x, z: c.z, size: PAD_SIZE, price: cp, paid: paid(id), label: 'CLEANER' });
  }
  if (!h.staff.some((s) => s.role === 'restocker')) {
    const id = 'staff:restocker';
    out.push({ id, kind: 'staff', x: RESTOCKER_PAD.x, z: RESTOCKER_PAD.z, size: PAD_SIZE, price: RESTOCKER_PRICE, paid: paid(id), label: 'RESTOCKER' });
  }
  if (!h.staff.some((s) => s.role === 'receptionist')) {
    out.push({ id: 'staff:receptionist', kind: 'staff', x: 1, z: 2, size: PAD_SIZE, price: CLERK_PRICE, paid: paid('staff:receptionist'), label: 'CLERK' });
  }
  return out;
}

export function padUnderPlayer(h: Hotel): Pad | null {
  const p = h.player.pos;
  return pads(h).find((pad) => Math.abs(p.x - pad.x) < pad.size / 2 && Math.abs(p.z - pad.z) < pad.size / 2) ?? null;
}

export const playerAtDesk = (h: Hotel) => inRect(DESK_ZONE, h.player.pos.x, h.player.pos.z);

// ---------- simulation ----------

export function tick(h: Hotel, dt: number, input: Input = { x: 0, z: 0 }): HotelEvent[] {
  const ev: HotelEvent[] = [];
  h.time += dt;
  movePlayer(h, dt, input);
  spawnGuests(h);
  arrangeQueue(h);
  for (const g of h.guests) updateGuest(h, g, dt, ev);
  h.guests = h.guests.filter((g) => !(g.state === 'leaving' && g.path.length === 0));
  checkIn(h, dt, ev);
  cleanRooms(h, dt, ev);
  playerRestock(h, ev);
  for (const s of h.staff) updateStaff(h, s, dt, ev);
  collectPile(h, ev);
  payPads(h, dt, ev);
  return ev;
}

function movePlayer(h: Hotel, dt: number, input: Input) {
  let { x, z } = input;
  const len = Math.hypot(x, z);
  h.player.moving = len > 0.05;
  if (!h.player.moving) return;
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const g = grid(h);
  const p = h.player.pos;
  const step = PLAYER_SPEED * dt;
  const nx = p.x + x * step;
  if (!hits(g, nx, p.z)) p.x = nx;
  const nz = p.z + z * step;
  if (!hits(g, p.x, nz)) p.z = nz;
  h.player.heading = Math.atan2(x, z);
}

function hits(g: Grid, x: number, z: number): boolean {
  const r = PLAYER_RADIUS;
  for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
    for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) {
      if (!isBlocked(g, cx + 0.5, cz + 0.5)) continue;
      // circle vs cell box
      const dx = x - Math.max(cx, Math.min(x, cx + 1));
      const dz = z - Math.max(cz, Math.min(z, cz + 1));
      if (dx * dx + dz * dz < r * r) return true;
    }
  }
  return false;
}

function spawnGuests(h: Hotel) {
  const waitingNow = h.guests.filter((g) => g.state === 'arriving' || g.state === 'queued').length;
  if (waitingNow === 0) h.nextArrival = Math.min(h.nextArrival, h.time + 1);
  if (h.time < h.nextArrival) return;
  const lvl = levelInfo(h.xp).level;
  const interval = Math.max(2.5, 10 - builtRoomCount(h) * 0.7 - lvl * 0.3);
  h.nextArrival = h.time + interval * (0.75 + nextRandom(h.rng) * 0.5);
  const waiting = h.guests.filter((g) => g.state === 'arriving' || g.state === 'queued').length;
  if (waiting >= MAX_QUEUE) return;
  h.guests.push(newGuest(h, { x: SPAWN.x + (nextRandom(h.rng) - 0.5) * 6, z: SPAWN.z }));
}

function newGuest(h: Hotel, pos: Point): Guest {
  return {
    id: h.nextGuestId++,
    name: `${pick(h.rng, FIRST_NAMES)} ${pick(h.rng, LAST_INITIALS)}.`,
    look: {
      outfit: pick(h.rng, OUTFIT_COLORS),
      skin: pick(h.rng, SKIN_TONES),
      hair: pick(h.rng, HAIR_COLORS),
      hat: pick(h.rng, HATS),
      bag: pick(h.rng, BAG_COLORS),
    },
    state: 'arriving',
    pos,
    path: [],
    heading: Math.PI,
    waited: 0,
    queueIndex: -1,
    roomId: null,
    stayLeft: 0,
    angry: false,
    vendId: null,
  };
}

/** Give each waiting guest a spot in line and send them to it. */
function arrangeQueue(h: Hotel) {
  const line = h.guests.filter((g) => g.state === 'arriving' || g.state === 'queued');
  line.forEach((g, index) => {
    if (g.queueIndex === index) return;
    g.queueIndex = index;
    const [cx, cz] = QUEUE_CELLS[index];
    const target = { x: cx + 0.5, z: cz + 0.5 };
    if (g.state === 'queued') {
      g.path = [target]; // the line is straight and open
    } else {
      g.path = findPath(grid(h), g.pos, target) ?? [target];
    }
  });
}

function updateGuest(h: Hotel, g: Guest, dt: number, ev: HotelEvent[]) {
  walk(g, GUEST_SPEED, dt);
  switch (g.state) {
    case 'arriving':
    case 'queued':
      g.waited += dt;
      if (g.state === 'arriving' && g.path.length === 0) {
        g.state = 'queued';
        g.heading = -Math.PI / 2;
      }
      break;
    case 'toRoom':
      if (g.path.length === 0) {
        g.state = 'sleeping';
        g.heading = 0;
      }
      break;
    case 'sleeping':
      g.stayLeft -= dt;
      if (g.stayLeft <= 0) {
        const room = h.rooms.find((r) => r.id === g.roomId);
        if (room) {
          room.state = 'dirty';
          room.guestId = null;
          room.clean = 0;
        }
        if (!goForSoda(h, g)) sendHome(h, g);
      }
      break;
    case 'toSoda':
      if (g.path.length === 0) {
        const m = h.vending.find((x) => x.id === g.vendId);
        if (m) turnTo(g, m);
        g.stayLeft -= dt;
        if (g.stayLeft > 0) break;
        if (m && m.stock > 0) {
          m.stock--;
          m.cash += SODA_PRICE;
          ev.push({ kind: 'soda', machineId: m.id });
        }
        g.vendId = null;
        sendHome(h, g);
      }
      break;
    case 'leaving':
      break;
  }
}

/** Sodas a machine can still promise: its stock minus guests already on their way to it. */
export function sodasLeft(h: Hotel, m: Vending): number {
  return m.stock - h.guests.filter((g) => g.state === 'toSoda' && g.vendId === m.id).length;
}

function goForSoda(h: Hotel, g: Guest): boolean {
  if (nextRandom(h.rng) > SODA_CHANCE) return false;
  const near = h.vending
    .filter((m) => sodasLeft(h, m) > 0)
    .map((m) => ({ m, d: Math.hypot(machineFront(m).x - g.pos.x, machineFront(m).z - g.pos.z) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!near) return false;
  const path = findPath(grid(h), g.pos, machineFront(near.m));
  if (!path) return false;
  g.state = 'toSoda';
  g.vendId = near.m.id;
  g.stayLeft = 0.8; // time spent picking a drink
  g.path = path;
  return true;
}

function turnTo(m: { pos: Point; heading: number }, v: Vending) {
  m.heading = Math.atan2(v.cell[0] + 0.5 - m.pos.x, v.cell[1] + 0.5 - m.pos.z);
}

function restock(h: Hotel, m: Vending, byPlayer: boolean, ev: HotelEvent[]) {
  const cash = m.cash;
  m.stock = MACHINE_STOCK;
  m.cash = 0;
  if (byPlayer) {
    h.coins += cash;
    if (cash) ev.push({ kind: 'collect', amount: cash });
  } else {
    h.pile += cash; // the restocker brings the money to the desk
  }
  ev.push({ kind: 'restocked', machineId: m.id, cash, byPlayer });
}

/** Walking up to a machine refills it and takes out the soda money. */
function playerRestock(h: Hotel, ev: HotelEvent[]) {
  const p = h.player.pos;
  for (const m of h.vending) {
    if (m.stock >= MACHINE_STOCK && m.cash === 0) continue;
    const f = machineFront(m);
    if (Math.hypot(p.x - f.x, p.z - f.z) <= MACHINE_REACH) restock(h, m, true, ev);
  }
}

function sendHome(h: Hotel, g: Guest) {
  g.state = 'leaving';
  g.queueIndex = -1;
  const out = { x: SPAWN.x + (g.id % 2 ? 4 : -4), z: SPAWN.z + 1 };
  g.path = findPath(grid(h), g.pos, out) ?? [out];
}

function checkIn(h: Hotel, dt: number, ev: HotelEvent[]) {
  const front = h.guests.find((g) => g.state === 'queued' && g.queueIndex === 0 && g.path.length === 0);
  const room = h.rooms.find((r) => r.built && r.state === 'ready');
  const byPlayer = playerAtDesk(h);
  const byStaff = h.staff.some((s) => s.role === 'receptionist' && s.path.length === 0);
  if (!front || !room || (!byPlayer && !byStaff)) {
    h.checkin = Math.max(0, h.checkin - dt);
    return;
  }
  h.checkin += dt / (byPlayer ? CHECKIN_TIME.player : CHECKIN_TIME.staff);
  if (h.checkin < 1) return;
  h.checkin = 0;

  const stars = starsForWait(front.waited);
  const tip = stars >= 5 ? 5 : stars === 4 ? 2 : 0;
  const amount = roomRate(h) + tip;
  h.pile += amount;
  ev.push({ kind: 'paid', amount, tip });
  addReview(h, stars, front.name, ev);
  h.served++;

  room.state = 'occupied';
  room.guestId = front.id;
  front.roomId = room.id;
  front.state = 'toRoom';
  front.queueIndex = -1;
  front.stayLeft = 14 + nextRandom(h.rng) * 12;
  const bed = roomGeom(room.i, room.j, room.side).bed;
  front.path = findPath(grid(h), front.pos, bed) ?? [bed];
}

/** Guests wait as long as it takes; a quick check-in just earns a better review and tip. */
export function starsForWait(waited: number): number {
  if (waited < 15) return 5;
  if (waited < 35) return 4;
  return 3;
}

function addReview(h: Hotel, stars: number, name: string, ev: HotelEvent[]) {
  const before = levelInfo(h.xp).level;
  h.reviews.push(stars);
  if (h.reviews.length > 20) h.reviews.shift();
  h.xp += stars;
  const after = levelInfo(h.xp).level;
  ev.push({ kind: 'review', name, stars, text: pick(h.rng, REVIEWS[stars as 1 | 2 | 3 | 4 | 5]) });
  if (after > before) ev.push({ kind: 'levelUp', level: after });
}

function cleanRooms(h: Hotel, dt: number, ev: HotelEvent[]) {
  for (const room of h.rooms) {
    if (!room.built || room.state !== 'dirty') continue;
    const g = roomGeom(room.i, room.j, room.side);
    let rate = 0;
    if (inRect(g.clean, h.player.pos.x, h.player.pos.z)) rate += 1 / CLEAN_TIME.player;
    for (const s of h.staff) {
      if (s.role === 'housekeeper' && s.roomId === room.id && s.path.length === 0) rate += 1 / CLEAN_TIME.staff;
    }
    if (!rate) continue;
    room.clean += rate * dt;
    if (room.clean >= 1) {
      room.state = 'ready';
      room.clean = 0;
      ev.push({ kind: 'cleaned', roomId: room.id });
      for (const s of h.staff) if (s.roomId === room.id) s.roomId = null;
    }
  }
}

function updateStaff(h: Hotel, s: Staff, dt: number, ev: HotelEvent[]) {
  walk(s, STAFF_SPEED, dt);
  if (s.role === 'restocker') return updateRestocker(h, s, dt, ev);
  if (s.role !== 'housekeeper') return;
  if (s.roomId !== null) {
    const room = h.rooms.find((r) => r.id === s.roomId);
    if (!room || room.state !== 'dirty') s.roomId = null;
    return;
  }
  const taken = new Set(h.staff.map((o) => o.roomId));
  const job = h.rooms.find((r) => r.built && r.state === 'dirty' && !taken.has(r.id));
  if (job) {
    const g = roomGeom(job.i, job.j, job.side);
    const spot = { x: g.bed.x + 0.5, z: g.bed.z + 2 };
    const path = findPath(grid(h), s.pos, spot);
    if (path) {
      s.roomId = job.id;
      s.path = path;
    }
    return;
  }
  if (s.path.length === 0 && Math.hypot(s.pos.x - s.home.x, s.pos.z - s.home.z) > 0.5) {
    s.path = findPath(grid(h), s.pos, s.home) ?? [];
  }
}

/** The restocker refills any machine that is running low, emptiest first. */
function updateRestocker(h: Hotel, s: Staff, dt: number, ev: HotelEvent[]) {
  if (s.vendId != null) {
    const m = h.vending.find((x) => x.id === s.vendId);
    if (!m || m.stock >= MACHINE_STOCK) {
      s.vendId = null;
      return;
    }
    if (s.path.length) return;
    turnTo(s, m);
    s.busy = (s.busy ?? 0) + dt;
    if (s.busy < RESTOCK_TIME) return;
    s.busy = 0;
    s.vendId = null;
    restock(h, m, false, ev);
    return;
  }
  const job = h.vending.filter((m) => m.stock <= MACHINE_STOCK / 2).sort((a, b) => a.stock - b.stock)[0];
  if (job) {
    const path = findPath(grid(h), s.pos, machineFront(job));
    if (path) {
      s.vendId = job.id;
      s.busy = 0;
      s.path = path;
      return;
    }
  }
  if (s.path.length === 0 && Math.hypot(s.pos.x - s.home.x, s.pos.z - s.home.z) > 0.5) {
    s.path = findPath(grid(h), s.pos, s.home) ?? [];
  }
}

function collectPile(h: Hotel, ev: HotelEvent[]) {
  if (h.pile <= 0) return;
  const p = h.player.pos;
  if (Math.hypot(p.x - COIN_PILE.x, p.z - COIN_PILE.z) > PILE_RADIUS) return;
  ev.push({ kind: 'collect', amount: h.pile });
  h.coins += h.pile;
  h.pile = 0;
}

function payPads(h: Hotel, dt: number, ev: HotelEvent[]) {
  const pad = padUnderPlayer(h);
  if (!pad || h.coins <= 0) return;
  const rate = Math.max(pad.price / 1.5, 40);
  const pay = Math.min(h.coins, pad.price - pad.paid, Math.ceil(rate * dt));
  h.coins -= pay;
  h.padPaid[pad.id] = pad.paid + pay;
  if (h.padPaid[pad.id] >= pad.price) {
    delete h.padPaid[pad.id];
    unlock(h, pad, ev);
  }
}

function unlock(h: Hotel, pad: Pad, ev: HotelEvent[]) {
  const [kind, arg, extra] = pad.id.split(':');
  if (kind === 'room') {
    const room = h.rooms.find((r) => r.id === Number(arg));
    if (room) room.built = true;
    ev.push({ kind: 'unlocked', what: 'New room!' });
  } else if (kind === 'lot') {
    const [i, j] = parseLot(arg);
    addLot(h, i, j);
    h.lotsBought++;
    for (const [ei, ej] of enclosedLots(new Set(h.lots))) addLot(h, ei, ej);
    ev.push({ kind: 'unlocked', what: 'More land! Build rooms on it.' });
  } else if (kind === 'staff' && arg === 'restocker') {
    const home = { x: RESTOCKER_PAD.x, z: RESTOCKER_PAD.z };
    h.staff.push({ id: 'restocker', role: 'restocker', home, pos: { ...home }, path: [], heading: 0, roomId: null, vendId: null, busy: 0 });
    ev.push({ kind: 'unlocked', what: 'Hired a restocker! They keep the soda machines full.' });
  } else if (kind === 'staff') {
    const clerk = arg === 'receptionist';
    const spotId = Number(extra);
    if (!clerk) {
      const c = h.cleanerSpots.find((x) => x.id === spotId);
      if (c) c.hired = true;
    }
    // cleaners wait a step back from their pad so it doesn't look like a pad is still there
    const home = clerk ? { ...RECEPTIONIST_SPOT } : { x: pad.x, z: pad.z - 1.5 };
    if (isBlocked(grid(h), home.x, home.z)) Object.assign(home, { x: pad.x, z: pad.z });
    const s: Staff = {
      id: clerk ? 'clerk' : `cleaner-${spotId}`,
      role: clerk ? 'receptionist' : 'housekeeper',
      home,
      pos: { x: pad.x, z: pad.z },
      path: [],
      heading: 0,
      roomId: null,
    };
    s.path = findPath(grid(h), s.pos, home) ?? [{ ...home }];
    h.staff.push(s);
    ev.push({ kind: 'unlocked', what: clerk ? 'Hired a desk clerk!' : 'Hired a cleaner!' });
  }
  h.layoutVersion++;
  // anyone whose route crossed new walls gets a fresh one
  const g = grid(h);
  for (const m of [...h.guests, ...h.staff]) {
    if (!m.path.length) continue;
    const dest = m.path[m.path.length - 1];
    m.path = findPath(g, m.pos, dest) ?? m.path;
  }
  if (isBlocked(g, h.player.pos.x, h.player.pos.z)) h.player.pos = { x: pad.x, z: pad.z + pad.size };
}

function walk(m: { pos: Point; path: Point[]; heading: number }, speed: number, dt: number) {
  let budget = speed * dt;
  while (budget > 0 && m.path.length) {
    const t = m.path[0];
    const dx = t.x - m.pos.x, dz = t.z - m.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) m.heading = Math.atan2(dx, dz);
    if (d <= budget) {
      m.pos = { x: t.x, z: t.z };
      m.path.shift();
      budget -= d;
    } else {
      m.pos = { x: m.pos.x + (dx / d) * budget, z: m.pos.z + (dz / d) * budget };
      budget = 0;
    }
  }
}

export { LOT };
