import { randomRoomCode } from './protocol';
import type { HostTransport, JoinRoom, Link, OpenRoom } from './transport';

/**
 * A transport between tabs of one browser, over BroadcastChannel. For trying the phone
 * controller on a single computer without the PeerJS server: add `?net=tabs` to both the
 * big screen and the controller page.
 */

interface Packet {
  from: string;
  to: string;
  kind: 'join' | 'accept' | 'msg' | 'close';
  body?: unknown;
}

function id(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeLink(channel: BroadcastChannel, self: string, peer: string, onDone: () => void): {
  link: Link;
  receive: (p: Packet) => void;
} {
  const msgCbs: ((m: unknown) => void)[] = [];
  const closeCbs: (() => void)[] = [];
  let closed = false;
  const shut = () => {
    if (closed) return;
    closed = true;
    onDone();
    for (const cb of closeCbs) cb();
  };
  return {
    link: {
      send: (body) => !closed && channel.postMessage({ from: self, to: peer, kind: 'msg', body } satisfies Packet),
      onMessage: (cb) => msgCbs.push(cb),
      onClose: (cb) => closeCbs.push(cb),
      close: () => {
        if (!closed) channel.postMessage({ from: self, to: peer, kind: 'close' } satisfies Packet);
        shut();
      },
    },
    receive: (p) => {
      if (p.kind === 'msg') for (const cb of msgCbs) cb(p.body);
      if (p.kind === 'close') shut();
    },
  };
}

export const openTabsRoom: OpenRoom = async () => {
  const room = randomRoomCode();
  const channel = new BroadcastChannel(`scorched-${room}`);
  const self = 'host';
  const links = new Map<string, (p: Packet) => void>();
  const cbs: ((link: Link) => void)[] = [];
  channel.onmessage = (e: MessageEvent<Packet>) => {
    const p = e.data;
    if (p.to !== self) return;
    if (p.kind === 'join') {
      const { link, receive } = makeLink(channel, self, p.from, () => links.delete(p.from));
      links.set(p.from, receive);
      channel.postMessage({ from: self, to: p.from, kind: 'accept' } satisfies Packet);
      for (const cb of cbs) cb(link);
      return;
    }
    links.get(p.from)?.(p);
  };
  window.addEventListener('pagehide', () => {
    for (const [peer] of links) channel.postMessage({ from: self, to: peer, kind: 'close' } satisfies Packet);
  });
  return { room, onLink: (cb) => cbs.push(cb), close: () => channel.close() } satisfies HostTransport;
};

export const joinTabsRoom: JoinRoom = (room) =>
  new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(`scorched-${room}`);
    const self = id();
    const { link, receive } = makeLink(channel, self, 'host', () => channel.close());
    const timer = setTimeout(() => {
      channel.close();
      reject(new Error('No game in another tab with that code'));
    }, 3000);
    channel.onmessage = (e: MessageEvent<Packet>) => {
      const p = e.data;
      if (p.to !== self) return;
      if (p.kind === 'accept') {
        clearTimeout(timer);
        resolve(link);
        return;
      }
      receive(p);
    };
    window.addEventListener('pagehide', () => link.close());
    channel.postMessage({ from: self, to: 'host', kind: 'join' } satisfies Packet);
  });

/** True when the page was opened with `?net=tabs`. */
export function useTabs(): boolean {
  return new URLSearchParams(location.search).get('net') === 'tabs';
}
