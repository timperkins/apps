import { describe, expect, it } from 'vitest';
import {
  createHotel,
  grid,
  lotPrice,
  pads,
  playerAtDesk,
  starsForWait,
  tick,
  type Hotel,
  type HotelEvent,
  type Input,
} from '../src/sim/hotel';
import { COIN_PILE, DESK_ZONE, enclosedLots, lotKey, lotsForSale, roomGeom } from '../src/sim/layout';
import { findPath } from '../src/sim/path';

const DT = 1 / 30;

function run(h: Hotel, seconds: number, input?: Input): HotelEvent[] {
  const ev: HotelEvent[] = [];
  for (let t = 0; t < seconds; t += DT) ev.push(...tick(h, DT, input));
  return ev;
}

/** Steer the player to a point by walking the A* path, like a person holding the keys. */
function walkTo(h: Hotel, target: { x: number; z: number }, maxSeconds = 30) {
  const path = findPath(grid(h), h.player.pos, target);
  if (!path) throw new Error(`no path to ${target.x},${target.z}`);
  for (const p of path) {
    for (let t = 0; t < maxSeconds; t += DT) {
      const dx = p.x - h.player.pos.x, dz = p.z - h.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) break;
      tick(h, DT, { x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) });
    }
  }
  const d = Math.hypot(target.x - h.player.pos.x, target.z - h.player.pos.z);
  if (d > 0.3) throw new Error(`stuck at ${h.player.pos.x.toFixed(2)},${h.player.pos.z.toFixed(2)}`);
}

const deskSpot = { x: (DESK_ZONE.x0 + DESK_ZONE.x1) / 2, z: (DESK_ZONE.z0 + DESK_ZONE.z1) / 2 };

describe('a new hotel', () => {
  it('starts with two rooms, a lobby and land for sale', () => {
    const h = createHotel('seaside', 1);
    expect(h.rooms.filter((r) => r.built)).toHaveLength(2);
    expect(h.lots).toHaveLength(3);
    const p = pads(h);
    expect(p.filter((x) => x.kind === 'room')).toHaveLength(2);
    expect(p.filter((x) => x.kind === 'lot').length).toBeGreaterThanOrEqual(3);
    expect(p.filter((x) => x.kind === 'staff')).toHaveLength(2);
  });

  it('every pad and every room can be reached on foot', () => {
    const h = createHotel('city', 1);
    const g = grid(h);
    for (const pad of pads(h)) expect(findPath(g, h.player.pos, pad), pad.id).not.toBeNull();
    for (const r of h.rooms.filter((x) => x.built)) {
      expect(findPath(g, h.player.pos, roomGeom(r.i, r.j, r.side).bed)).not.toBeNull();
    }
  });
});

describe('moving', () => {
  it('walls stop the player', () => {
    const h = createHotel('seaside', 1);
    run(h, 5, { x: 0, z: -1 }); // walk straight back towards the rear wall
    expect(h.player.pos.z).toBeGreaterThan(0.3);
    expect(h.player.pos.z).toBeLessThan(4);
  });

  it('the player can walk out the front door', () => {
    const h = createHotel('seaside', 1);
    walkTo(h, { x: 6, z: 18 });
    expect(h.player.pos.z).toBeGreaterThan(17);
  });
});

describe('the core loop', () => {
  it('checks in a guest at the desk, then collects their coins', () => {
    const h = createHotel('seaside', 3);
    walkTo(h, deskSpot);
    expect(playerAtDesk(h)).toBe(true);
    let paid = false;
    for (let t = 0; t < 40 && !paid; t += DT) paid = tick(h, DT).some((e) => e.kind === 'paid');
    expect(paid).toBe(true);
    expect(h.pile).toBeGreaterThan(0);
    expect(h.rooms.some((r) => r.state === 'occupied')).toBe(true);
    const pile = h.pile;
    walkTo(h, COIN_PILE);
    expect(h.coins).toBeGreaterThanOrEqual(pile);
    expect(h.pile).toBe(0);
  });

  it('a guest who stayed leaves a dirty room that the player can clean', () => {
    const h = createHotel('seaside', 3);
    walkTo(h, deskSpot);
    run(h, 60);
    const dirty = h.rooms.find((r) => r.state === 'dirty');
    expect(dirty).toBeDefined();
    const g = roomGeom(dirty!.i, dirty!.j, dirty!.side);
    walkTo(h, { x: g.bed.x, z: g.bed.z + 2 });
    run(h, 2);
    expect(h.rooms.find((r) => r.id === dirty!.id)!.state).not.toBe('dirty');
  });

  it('guests left waiting give up', () => {
    const h = createHotel('seaside', 5);
    const ev = run(h, 60);
    expect(ev.some((e) => e.kind === 'gaveUp')).toBe(true);
    expect(h.reviews).toContain(1);
  });

  it('fewer stars the longer the wait', () => {
    expect(starsForWait(2)).toBe(5);
    expect(starsForWait(20)).toBe(3);
    expect(starsForWait(60)).toBe(1);
  });
});

describe('buying', () => {
  it('standing on a room pad spends coins and builds the room', () => {
    const h = createHotel('seaside', 2);
    const pad = pads(h).find((p) => p.kind === 'room')!;
    h.coins = 500;
    walkTo(h, pad);
    run(h, 3);
    expect(h.coins).toBe(500 - pad.price);
    expect(h.rooms.filter((r) => r.built)).toHaveLength(3);
    // the new room has walls now
    expect(grid(h).walls.size).toBeGreaterThan(0);
  });

  it('a pad keeps partial payments', () => {
    const h = createHotel('seaside', 2);
    const pad = pads(h).find((p) => p.kind === 'room')!;
    h.coins = 10;
    walkTo(h, pad);
    run(h, 1);
    expect(h.coins).toBe(0);
    expect(pads(h).find((p) => p.id === pad.id)!.paid).toBe(10);
  });

  it('buying land opens up the next plot beyond it', () => {
    const h = createHotel('seaside', 2);
    const before = lotsForSale(new Set(h.lots)).map(([i, j]) => lotKey(i, j));
    expect(before).not.toContain(lotKey(-3, 0));
    const pad = pads(h).find((p) => p.id === 'lot:-2,0')!;
    h.coins = 10_000;
    walkTo(h, pad);
    run(h, 3);
    expect(h.lots).toContain(lotKey(-2, 0));
    const after = lotsForSale(new Set(h.lots)).map(([i, j]) => lotKey(i, j));
    expect(after).toContain(lotKey(-3, 0));
    expect(lotPrice(h)).toBeGreaterThan(pad.price);
    // the new lot comes with two room pads
    expect(pads(h).filter((p) => p.kind === 'room')).toHaveLength(4);
  });

  it('land that ends up walled in comes with the purchase', () => {
    const owned = new Set([lotKey(-1, 0), lotKey(0, 0), lotKey(1, 0), lotKey(-1, -1), lotKey(1, -1), lotKey(-1, -2), lotKey(0, -2), lotKey(1, -2)]);
    expect(enclosedLots(owned)).toEqual([[0, -1]]);
  });

  it('hiring a clerk checks guests in without the player', () => {
    const h = createHotel('seaside', 4);
    h.coins = 1000;
    walkTo(h, pads(h).find((p) => p.id === 'staff:receptionist')!);
    run(h, 3);
    expect(h.staff.map((s) => s.role)).toContain('receptionist');
    walkTo(h, { x: 6, z: 18 }); // go outside
    const ev = run(h, 40);
    expect(ev.some((e) => e.kind === 'paid')).toBe(true);
  });

  it('a hired cleaner cleans dirty rooms', () => {
    const h = createHotel('seaside', 4);
    h.coins = 1000;
    walkTo(h, pads(h).find((p) => p.id === 'staff:housekeeper')!);
    run(h, 3);
    h.rooms[0].state = 'dirty';
    walkTo(h, { x: 6, z: 18 });
    const ev = run(h, 30);
    expect(ev.some((e) => e.kind === 'cleaned')).toBe(true);
  });
});

describe('determinism', () => {
  it('the same seed and inputs play out the same way', () => {
    const a = createHotel('lodge', 42);
    const b = createHotel('lodge', 42);
    run(a, 20, { x: 0.3, z: -0.2 });
    run(b, 20, { x: 0.3, z: -0.2 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
