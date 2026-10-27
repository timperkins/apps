import { describe, expect, it } from 'vitest';
import { defaultConfig, PLAYER_COLORS } from '../src/core/config';
import { MOVE_TIME } from '../src/core/constants';
import { Terrain } from '../src/core/terrain';
import { Match } from '../src/core/match';
import { LoopbackNetwork } from '../src/net/loopback';
import { PROTOCOL_VERSION, parseClientMsg, type ClientMsg, type HostMsg } from '../src/net/protocol';
import { Room } from '../src/net/room';
import type { Link } from '../src/net/transport';

class Phone {
  readonly got: HostMsg[] = [];
  closed = false;
  constructor(readonly link: Link) {
    link.onMessage((m) => this.got.push(m as HostMsg));
    link.onClose(() => (this.closed = true));
  }
  send(m: ClientMsg): void {
    this.link.send(m);
  }
  last<T extends HostMsg['t']>(t: T): Extract<HostMsg, { t: T }> | undefined {
    for (let i = this.got.length - 1; i >= 0; i--) if (this.got[i].t === t) return this.got[i] as Extract<HostMsg, { t: T }>;
    return undefined;
  }
  phase(): string | undefined {
    const p = this.last('phase');
    return p?.phase;
  }
}

async function setup(cpus = 0) {
  const net = new LoopbackNetwork();
  const room = new Room(await net.open(), defaultConfig().players.filter((p) => p.kind === 'cpu').slice(0, cpus));
  const join = async (name: string, token: string | null = null) => {
    const phone = new Phone(await net.join(room.room));
    phone.send({ t: 'hello', v: PROTOCOL_VERSION, name, token });
    return phone;
  };
  return { net, room, join };
}

function startMatch(room: Room): Match {
  const match = new Match({ ...room.configFor(defaultConfig()), seed: 7, wind: 'off' });
  room.attach(match);
  return match;
}

describe('Room lobby', () => {
  it('welcomes phones with distinct colors and lists everyone', async () => {
    const { room, join } = await setup(1);
    const a = await join('Ann');
    const b = await join('Bo');
    expect(a.last('welcome')!.color).not.toBe(b.last('welcome')!.color);
    const lobby = b.last('phase') as Extract<HostMsg, { phase: 'lobby' }>;
    expect(lobby.players.map((p) => p.name)).toEqual(['Ann', 'Bo', 'Hawk']);
    expect(lobby.players[1].you).toBe(true);
    expect(lobby.taken).toEqual([a.last('welcome')!.color]);
    // The CPU never takes a color a phone has.
    expect([a.last('welcome')!.color, b.last('welcome')!.color]).not.toContain(lobby.players[2].color);
    expect(room.playerCount()).toBe(3);
  });

  it('refuses a color someone else already has', async () => {
    const { join } = await setup();
    const a = await join('Ann');
    const b = await join('Bo');
    const annColor = a.last('welcome')!.color;
    b.send({ t: 'look', color: annColor, design: 'hover' });
    expect(b.last('welcome')!.color).not.toBe(annColor);
    expect(b.last('welcome')!.design).toBe('hover');
    b.send({ t: 'look', color: PLAYER_COLORS[19], design: 'dome' });
    expect(b.last('welcome')!.color).toBe(PLAYER_COLORS[19]);
  });

  it('gives duplicate names a number', async () => {
    const { room, join } = await setup();
    await join('Ann');
    await join('ann');
    expect(room.seats.map((s) => s.name)).toEqual(['Ann', 'ann 2']);
  });

  it('keeps the seat when a phone reconnects before the old link has closed', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    const again = await join('Ann', a.last('welcome')!.token);
    expect(room.seats.length).toBe(1);
    expect(room.seats[0].name).toBe('Ann');
    expect(again.phase()).toBe('lobby');
    expect(a.closed).toBe(true);
  });

  it('frees a seat when a phone leaves the lobby', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    await join('Bo');
    a.link.close();
    expect(room.seats.map((s) => s.name)).toEqual(['Bo']);
  });

  it('turns away phones with an old page or once the game has started', async () => {
    const { room, net } = await setup();
    const old = new Phone(await net.join(room.room));
    old.send({ t: 'hello', v: PROTOCOL_VERSION + 1, name: 'Old', token: null });
    expect(old.last('reject')).toBeTruthy();
    room.enterShop();
    const late = new Phone(await net.join(room.room));
    late.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Late', token: null });
    expect(late.last('reject')!.reason).toMatch(/started/);
    expect(room.seats.length).toBe(0);
  });
});

describe('Room match', () => {
  it('lets phones shop, then starts once everyone is ready', async () => {
    const { room, join } = await setup(1);
    const a = await join('Ann');
    const b = await join('Bo');
    const match = startMatch(room);
    let started = 0;
    room.onAllReady = () => started++;
    match.nextRound();
    room.enterShop();
    expect(a.phase()).toBe('shop');
    const before = (a.last('phase') as Extract<HostMsg, { phase: 'shop' }>).shop.coins;
    a.send({ t: 'buy', item: 'missile' });
    const after = (a.last('phase') as Extract<HostMsg, { phase: 'shop' }>).shop;
    expect(after.coins).toBeLessThan(before);
    expect(after.inventory.missile).toBe(5);
    a.send({ t: 'ready', ready: true });
    expect(started).toBe(0);
    // A phone that is ready can't keep buying.
    a.send({ t: 'buy', item: 'missile' });
    expect(match.players[0].inventory.missile).toBe(5);
    b.send({ t: 'ready', ready: true });
    expect(started).toBe(1);
  });

  it('does not wait on a phone that dropped out while shopping', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    const b = await join('Bo');
    startMatch(room).nextRound();
    let started = 0;
    room.onAllReady = () => started++;
    room.enterShop();
    a.send({ t: 'ready', ready: true });
    b.link.close();
    expect(started).toBe(1);
  });

  it('drives the tank from phone input and reports its status', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    await join('Bo');
    const match = startMatch(room);
    match.nextRound();
    const battle = match.startBattle();
    room.enterBattle();
    expect(a.phase()).toBe('battle');
    const tank = battle.tankOf(0)!;
    a.send({ t: 'aim', angle: 33, power: 512 });
    expect(tank.angle).toBe(33);
    expect(tank.power).toBe(512);
    a.send({ t: 'fire' });
    expect(tank.reload).toBeGreaterThan(0);
    expect(a.last('status')!.reload).toBeGreaterThan(0);
    // Hostile or broken input never reaches the rules.
    a.link.send({ t: 'aim', angle: 'up', power: 1e9 });
    a.link.send({ t: 'buy', item: '__proto__' });
    expect(tank.angle).toBe(33);
    room.tick(1);
    expect(a.last('status')!.angle).toBe(33);
  });

  it('drives the tank sideways when the phone asks to move', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    await join('Bo');
    const match = startMatch(room);
    match.nextRound();
    const battle = match.startBattle();
    room.enterBattle();
    const tank = battle.tankOf(0)!;
    const flat = Terrain.fromHeights(new Array(battle.terrain.width).fill(300), battle.terrain.width, battle.terrain.height);
    battle.terrain.mask.set(flat.mask);
    battle.tanks.forEach((t, i) => {
      t.x = 150 + i * 300;
      t.y = 300;
    });
    a.send({ t: 'move', dir: 1 });
    expect(tank.moveLeft).toBeGreaterThan(0);
    const status = a.last('status')!;
    expect(status.moving).toBe(true);
    expect(status.reloadTotal).toBe(MOVE_TIME);
    a.send({ t: 'fire' });
    expect(tank.shots).toBe(0);
  });

  it('gives a returning phone its tank back', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    await join('Bo');
    const token = a.last('welcome')!.token;
    const match = startMatch(room);
    match.nextRound();
    match.startBattle();
    room.enterBattle();
    a.link.close();
    expect(room.seats[0].link).toBe(null);
    const again = await join('Whoever', token);
    expect(again.last('welcome')!.token).toBe(token);
    expect(again.phase()).toBe('battle');
    expect(room.seats.length).toBe(2);
  });

  it('sends each phone its own round result', async () => {
    const { room, join } = await setup();
    const a = await join('Ann');
    const b = await join('Bo');
    const match = startMatch(room);
    match.nextRound();
    match.startBattle().winner = 1;
    room.enterResults(match.finishRound());
    const ra = (a.last('phase') as Extract<HostMsg, { phase: 'results' }>).result;
    const rb = (b.last('phase') as Extract<HostMsg, { phase: 'results' }>).result;
    expect(ra.winner).toBe('Bo');
    expect(rb.youWon).toBe(true);
    expect(rb.place).toBe(1);
  });
});

describe('Protocol', () => {
  it('cleans names and rejects malformed messages', () => {
    expect(parseClientMsg({ t: 'hello', v: 1, name: '  <b>Tim</b>\u0007 the Great Destroyer ', token: null })).toEqual({
      t: 'hello', v: 1, name: 'bTim/b the G', token: null,
    });
    expect(parseClientMsg({ t: 'look', color: '#123456', design: 'classic' })).toBe(null);
    expect(parseClientMsg({ t: 'look', color: PLAYER_COLORS[3], design: 'spaceship' })).toBe(null);
    expect(parseClientMsg({ t: 'aim', angle: NaN, power: 1 })).toBe(null);
    expect(parseClientMsg({ t: 'buy', item: 'babyMissile' })).toBe(null);
    expect(parseClientMsg({ t: 'weapon', dir: 2 })).toBe(null);
    expect(parseClientMsg({ t: 'move', dir: 0 })).toBe(null);
    expect(parseClientMsg({ t: 'move', dir: -1 })).toEqual({ t: 'move', dir: -1 });
    expect(parseClientMsg({ t: 'steer', dir: 0 })).toEqual({ t: 'steer', dir: 0 });
    expect(parseClientMsg({ t: 'steer', dir: 1 })).toEqual({ t: 'steer', dir: 1 });
    expect(parseClientMsg({ t: 'steer', dir: 3 })).toBe(null);
    expect(parseClientMsg('fire')).toBe(null);
    expect(parseClientMsg({ t: 'fire' })).toEqual({ t: 'fire' });
  });
});
