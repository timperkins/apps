import type { HostTransport, JoinRoom, Link, OpenRoom } from './transport';

/**
 * An in-memory transport where the host and the phones live in the same program. Used by
 * tests. Messages are cloned so neither side can share objects with the other, like a real wire.
 */

interface Pipe {
  deliver: (msg: unknown) => void;
  close: () => void;
}

function makeLink(): { link: Link; pipe: Pipe; bind: (other: Pipe) => void } {
  const msgCbs: ((m: unknown) => void)[] = [];
  const closeCbs: (() => void)[] = [];
  let other: Pipe | null = null;
  let closed = false;
  const pipe: Pipe = {
    deliver: (m) => {
      if (!closed) for (const cb of msgCbs) cb(structuredClone(m));
    },
    close: () => {
      if (closed) return;
      closed = true;
      for (const cb of closeCbs) cb();
    },
  };
  const link: Link = {
    send: (m) => {
      if (!closed) other?.deliver(m);
    },
    onMessage: (cb) => msgCbs.push(cb),
    onClose: (cb) => closeCbs.push(cb),
    close: () => {
      pipe.close();
      other?.close();
    },
  };
  return { link, pipe, bind: (o) => (other = o) };
}

export class LoopbackNetwork {
  private readonly rooms = new Map<string, (link: Link) => void>();
  private next = 0;

  open: OpenRoom = async () => {
    const room = `ROOM${this.next++}`;
    const cbs: ((link: Link) => void)[] = [];
    this.rooms.set(room, (link) => cbs.forEach((cb) => cb(link)));
    const host: HostTransport = {
      room,
      onLink: (cb) => cbs.push(cb),
      close: () => this.rooms.delete(room),
    };
    return host;
  };

  join: JoinRoom = async (room) => {
    const accept = this.rooms.get(room);
    if (!accept) throw new Error('No such room');
    const a = makeLink();
    const b = makeLink();
    a.bind(b.pipe);
    b.bind(a.pipe);
    accept(a.link);
    return b.link;
  };
}
