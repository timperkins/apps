import { describe, expect, it } from 'vitest';
import { PLAYER_ACTIVE_TIMEOUT_MS } from './constants';
import { getGameHost, isPlayerActive } from './game';
import { Player, PlayerSchema } from './types';

const now = 1_000_000;
const p = (id: string, opts: { seenAgo?: number; joined: number; host?: boolean }): Player => ({
  id,
  name: id,
  joinTime: new Date(opts.joined),
  lastSeen: opts.seenAgo === undefined ? undefined : new Date(now - opts.seenAgo),
  isHost: opts.host,
});

describe('presence', () => {
  it('counts recent heartbeats as active', () => {
    expect(isPlayerActive(p('a', { seenAgo: 1000, joined: 0 }), now)).toBe(true);
    expect(isPlayerActive(p('a', { seenAgo: PLAYER_ACTIVE_TIMEOUT_MS + 1, joined: 0 }), now)).toBe(
      false,
    );
    expect(isPlayerActive(p('a', { joined: 0 }), now)).toBe(false);
  });

  it('hands hosting to the earliest player still here when the host leaves', () => {
    const host = p('host', { seenAgo: 1000, joined: 0, host: true });
    const b = p('b', { seenAgo: 1000, joined: 2 });
    const c = p('c', { seenAgo: 1000, joined: 1 });
    expect(getGameHost([b, host, c], now)?.id).toBe('host');
    const gone = { ...host, lastSeen: new Date(0) };
    expect(getGameHost([b, gone, c], now)?.id).toBe('c');
  });

  it('parses players with and without optional timestamps', () => {
    expect(
      PlayerSchema.parse({ id: 'a', name: 'A', joinTime: new Date(1) }).lastSeen,
    ).toBeUndefined();
    expect(
      PlayerSchema.parse({ id: 'a', name: 'A', joinTime: { toDate: () => new Date(5) } }).joinTime,
    ).toEqual(new Date(5));
  });
});
