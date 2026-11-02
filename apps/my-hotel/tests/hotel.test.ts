import { describe, expect, it } from 'vitest';
import {
  MACHINE_STOCK,
  SODA_PRICE,
  createHotel,
  machineFront,
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
    // a clerk, two cleaners in the lobby and one in each wing
    expect(p.filter((x) => x.id === 'staff:receptionist')).toHaveLength(1);
    expect(p.filter((x) => x.id.startsWith('staff:cleaner:'))).toHaveLength(4);
    // one soda machine, and a restocker to hire
    expect(h.vending).toHaveLength(1);
    expect(p.filter((x) => x.id === 'staff:restocker')).toHaveLength(1);
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

  it('starts with guests already in line', () => {
    const h = createHotel('seaside', 5);
    expect(h.guests.filter((g) => g.state === 'queued')).toHaveLength(3);
  });

  it('guests wait as long as it takes and never leave', () => {
    const h = createHotel('seaside', 5);
    run(h, 120);
    expect(h.guests.some((g) => g.state === 'leaving' && !g.vip)).toBe(false);
    expect(h.guests.filter((g) => g.state === 'queued').length).toBeGreaterThanOrEqual(3);
    expect(h.reviews).toHaveLength(0);
  });

  it('fewer stars the longer the wait', () => {
    expect(starsForWait(2)).toBe(5);
    expect(starsForWait(20)).toBe(4);
    expect(starsForWait(600)).toBe(3);
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

  it('a built room gets an alarm clock pad for half its price, and guests there sleep 5 seconds', () => {
    const h = createHotel('seaside', 2);
    const pad = pads(h).find((p) => p.kind === 'room')!;
    h.coins = 500;
    walkTo(h, pad);
    run(h, 3);
    const alarm = pads(h).find((p) => p.id === `alarm:${pad.id.split(':')[1]}`)!;
    expect(alarm.price).toBe(Math.max(20, Math.round(pad.price / 20) * 10));
    // standing still on the new pad doesn't buy it
    expect(h.coins).toBe(500 - pad.price);
    walkTo(h, { x: pad.x, z: pad.z - 1.9 });
    walkTo(h, alarm);
    run(h, 2);
    expect(h.coins).toBe(500 - pad.price - alarm.price);
    const room = h.rooms.find((r) => r.id === Number(pad.id.split(':')[1]))!;
    expect(room.alarm).toBe(true);
    // fill every other room so the next guest goes to this one
    h.rooms.forEach((r) => {
      if (r.id !== room.id && r.built) r.state = 'occupied';
    });
    walkTo(h, deskSpot);
    let t = 0;
    while (room.state !== 'occupied' && t < 20) {
      tick(h, DT);
      t += DT;
    }
    const guest = h.guests.find((g) => g.id === room.guestId)!;
    expect(guest.stayLeft).toBeLessThanOrEqual(5);
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
    // ...and a cleaner pad of its own
    expect(pads(h).filter((p) => p.id.startsWith('staff:cleaner:'))).toHaveLength(5);
    // ...and a soda machine
    expect(h.vending).toHaveLength(2);
    expect(findPath(grid(h), h.player.pos, machineFront(h.vending[1]))).not.toBeNull();
  });

  it('land for sale can be reached from inside, through a doorway', () => {
    const h = createHotel('seaside', 2);
    for (const pad of pads(h).filter((p) => p.kind === 'lot')) {
      const path = findPath(grid(h), h.player.pos, pad)!;
      // never goes out the front door onto the street
      expect(path.every((p) => p.z < 11), pad.id).toBe(true);
    }
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
    // free rooms for the clerk to hand out (the player checked guests in on the way past the desk)
    h.rooms.forEach((r) => {
      if (r.state !== 'occupied') r.state = 'ready';
    });
    h.rooms.filter((r) => !r.built).forEach((r) => (r.built = true));
    h.layoutVersion++;
    walkTo(h, { x: 6, z: 18 }); // go outside
    const ev = run(h, 40);
    expect(ev.some((e) => e.kind === 'paid')).toBe(true);
  });

  it('a hired cleaner cleans dirty rooms', () => {
    const h = createHotel('seaside', 4);
    h.coins = 1000;
    walkTo(h, pads(h).find((p) => p.id === 'staff:cleaner:1')!);
    run(h, 3);
    h.rooms[0].state = 'dirty';
    walkTo(h, { x: 6, z: 18 });
    const ev = run(h, 30);
    expect(ev.some((e) => e.kind === 'cleaned')).toBe(true);
  });
});

describe('cleaners', () => {
  it('a cleaner pad stays after you hire, so you can hire more there', () => {
    const h = createHotel('seaside', 6);
    h.coins = 5000;
    const pad = pads(h).find((p) => p.id === 'staff:cleaner:1')!;
    walkTo(h, pad);
    run(h, 3);
    expect(h.staff.filter((s) => s.role === 'housekeeper')).toHaveLength(1);
    // standing still doesn't buy another one
    run(h, 3);
    expect(h.staff.filter((s) => s.role === 'housekeeper')).toHaveLength(1);
    const again = pads(h).find((p) => p.id === 'staff:cleaner:1')!;
    expect(again.price).toBe(pad.price + 50);
    // step off and back on to hire the next one, up to three per pad
    for (let k = 0; k < 3; k++) {
      walkTo(h, { x: pad.x, z: pad.z + 3 });
      if (!pads(h).some((p) => p.id === 'staff:cleaner:1')) break;
      walkTo(h, pad);
      run(h, 3);
    }
    expect(h.staff.filter((s) => s.id.startsWith('cleaner-1'))).toHaveLength(3);
    expect(pads(h).some((p) => p.id === 'staff:cleaner:1')).toBe(false);
  });

  it('you can hire several, and each one costs a bit more', () => {
    const h = createHotel('seaside', 6);
    h.coins = 5000;
    const cleanerPads = pads(h).filter((p) => p.id.startsWith('staff:cleaner:'));
    const first = cleanerPads[0].price;
    for (const pad of cleanerPads.slice(0, 2)) {
      walkTo(h, pad);
      run(h, 3);
    }
    expect(h.staff.filter((s) => s.role === 'housekeeper')).toHaveLength(2);
    expect(pads(h).find((p) => p.id.startsWith('staff:cleaner:'))!.price).toBe(first + 100);
    // two dirty rooms get cleaned at the same time
    h.rooms.filter((r) => r.built).forEach((r) => {
      r.state = 'dirty';
      r.guestId = null;
    });
    walkTo(h, { x: 6, z: 18 });
    const ev = run(h, 30);
    expect(ev.filter((e) => e.kind === 'cleaned').length).toBeGreaterThanOrEqual(2);
  });
});

describe('soda machines', () => {
  it('guests buy sodas on the way out, and the player restocks and takes the money', () => {
    const h = createHotel('seaside', 7);
    walkTo(h, deskSpot);
    let sodas = 0;
    for (let t = 0; t < 120 && sodas < 2; t += DT) sodas += tick(h, DT).filter((e) => e.kind === 'soda').length;
    expect(sodas).toBeGreaterThanOrEqual(2);
    const m = h.vending[0];
    expect(m.stock).toBeLessThan(MACHINE_STOCK);
    expect(m.cash).toBeGreaterThanOrEqual(2 * SODA_PRICE);
    const cash = m.cash;
    const coins = h.coins;
    walkTo(h, machineFront(m));
    expect(m.stock).toBe(MACHINE_STOCK);
    expect(m.cash).toBe(0);
    expect(h.coins).toBe(coins + cash);
  });

  it('an empty machine sells nothing', () => {
    const h = createHotel('seaside', 7);
    h.vending[0].stock = 0;
    walkTo(h, deskSpot);
    h.vending[0].stock = 0;
    const ev = run(h, 80);
    expect(ev.some((e) => e.kind === 'soda')).toBe(false);
  });

  it('a hired restocker refills machines and brings the money to the desk', () => {
    const h = createHotel('seaside', 8);
    h.coins = 1000;
    walkTo(h, pads(h).find((p) => p.id === 'staff:restocker')!);
    run(h, 3);
    expect(h.staff.map((s) => s.role)).toContain('restocker');
    walkTo(h, { x: 6, z: 18 }); // go outside
    const m = h.vending[0];
    m.stock = 1;
    m.cash = 250;
    const pile = h.pile;
    const ev = run(h, 20);
    expect(ev.some((e) => e.kind === 'restocked' && !e.byPlayer)).toBe(true);
    expect(m.stock).toBe(MACHINE_STOCK);
    expect(h.pile).toBe(pile + 250);
  });
});

describe('VIPs', () => {
  it('a VIP comes every minute and leaves 5,000 coins on the pile', () => {
    const h = createHotel('seaside', 3);
    const ev = run(h, 75);
    const vip = ev.filter((e) => e.kind === 'vip');
    expect(vip).toHaveLength(1);
    expect(h.pile).toBeGreaterThanOrEqual(5_000);
    walkTo(h, COIN_PILE);
    expect(h.coins).toBeGreaterThanOrEqual(5_000);
    expect(run(h, 60).filter((e) => e.kind === 'vip')).toHaveLength(1);
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
