// Co-op sessions on top of net.ts: the host's game is the real one, and up to 3 friends join it.
// Each player has a slot: 0 is the host, 1 to 3 are friends. Games send their own messages through these.
import { MAX_PLAYERS, cleanCode, joinRoom, openRoom, type Link } from './net';

export { MAX_PLAYERS, cleanCode };

/** Colors for players 1 to 4, so everyone can tell who is who. */
export const PLAYER_COLORS = ['#ffd23f', '#4fc3f7', '#ff6b9d', '#7ddc6a'];
export const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export interface HostSession {
  role: 'host';
  code: string;
  /** Slots of the friends who are here now. */
  friends(): number[];
  send(slot: number, msg: unknown): void;
  broadcast(msg: unknown): void;
  onJoin(cb: (slot: number) => void): void;
  onLeave(cb: (slot: number) => void): void;
  onMessage(cb: (slot: number, msg: unknown) => void): void;
  close(): void;
}

export interface FriendSession {
  role: 'friend';
  code: string;
  slot: number;
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  /** The host left or the link dropped. */
  onClose(cb: () => void): void;
  close(): void;
}

export type Session = HostSession | FriendSession;

type Hello = { t: '_hi'; slot: number } | { t: '_full' };

export async function host(prefix: string, want?: string): Promise<HostSession> {
  const room = await openRoom(prefix, want);
  const links = new Map<number, Link>();
  const joinCbs: ((s: number) => void)[] = [], leaveCbs: ((s: number) => void)[] = [], msgCbs: ((s: number, m: unknown) => void)[] = [];
  let closed = false;
  room.onLink(link => {
    if (closed) return link.close();
    let slot = 1;
    while (links.has(slot)) slot++;
    if (slot >= MAX_PLAYERS) {
      link.send({ t: '_full' } satisfies Hello);
      setTimeout(() => link.close(), 500);
      return;
    }
    links.set(slot, link);
    link.send({ t: '_hi', slot } satisfies Hello);
    link.onMessage(m => { for (const cb of msgCbs) cb(slot, m); });
    link.onClose(() => {
      if (links.get(slot) !== link) return;
      links.delete(slot);
      for (const cb of leaveCbs) cb(slot);
    });
    for (const cb of joinCbs) cb(slot);
  });
  return {
    role: 'host',
    code: room.code,
    friends: () => [...links.keys()].sort(),
    send: (slot, msg) => links.get(slot)?.send(msg),
    broadcast: msg => { for (const l of links.values()) l.send(msg); },
    onJoin: cb => joinCbs.push(cb),
    onLeave: cb => leaveCbs.push(cb),
    onMessage: cb => msgCbs.push(cb),
    close: () => {
      closed = true;
      for (const l of links.values()) l.close();
      links.clear();
      room.close();
    },
  };
}

export async function join(prefix: string, rawCode: string): Promise<FriendSession> {
  const code = cleanCode(rawCode);
  if (!code) throw new Error('Type the code from the host’s screen.');
  const link = await joinRoom(prefix, code);
  const msgCbs: ((m: unknown) => void)[] = [], early: unknown[] = [];
  const slot = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The host didn’t answer.')), 8000);
    let got = false;
    link.onMessage(m => {
      if (!got) {
        const h = m as Hello;
        if (h?.t === '_full') { clearTimeout(timer); got = true; link.close(); reject(new Error(`That game already has ${MAX_PLAYERS} players.`)); }
        else if (h?.t === '_hi') { clearTimeout(timer); got = true; resolve(h.slot); }
        return;
      }
      // what the host sends before the game listens waits for it
      if (msgCbs.length) for (const cb of msgCbs) cb(m); else early.push(m);
    });
    link.onClose(() => { if (!got) { clearTimeout(timer); reject(new Error('The host closed the game.')); } });
  });
  return {
    role: 'friend',
    code,
    slot,
    send: msg => link.send(msg),
    onMessage: cb => { msgCbs.push(cb); for (const m of early.splice(0)) cb(m); },
    onClose: cb => link.onClose(cb),
    close: () => link.close(),
  };
}
