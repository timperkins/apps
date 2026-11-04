import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { randomRoomCode } from './protocol';
import type { HostTransport, JoinRoom, Link, OpenRoom } from './transport';

/**
 * PeerJS transport. Its free public server only brokers the WebRTC handshake; once a data
 * channel is open, game traffic goes straight between each player and the host.
 */

/** Prefix so our room codes don't collide with other apps on the shared PeerJS server. */
const PREFIX = 'bad-guys-good-guys-room-';
const OPEN_TIMEOUT = 12000;

/** Test hook: `?peerhost=localhost:9000` points at a local PeerJS server instead of the public one. */
function peerOptions(): PeerOptions {
  const host = new URLSearchParams(location.search).get('peerhost');
  if (!host) return {};
  const [hostname, port] = host.split(':');
  return { host: hostname, port: Number(port) || 9000, path: '/', secure: false };
}

function wrap(conn: DataConnection): Link {
  const closeCbs: (() => void)[] = [];
  let closed = false;
  const fireClose = () => {
    if (closed) return;
    closed = true;
    for (const cb of closeCbs) cb();
  };
  conn.on('close', fireClose);
  conn.on('error', fireClose);
  // A device that locks its screen can drop without a close event; ICE state catches that.
  conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
    const s = conn.peerConnection?.iceConnectionState;
    if (s === 'failed' || s === 'closed' || s === 'disconnected') fireClose();
  });
  return {
    send: (msg) => {
      if (!closed && conn.open) conn.send(msg);
    },
    onMessage: (cb) => conn.on('data', cb),
    onClose: (cb) => closeCbs.push(cb),
    close: () => {
      conn.close();
      fireClose();
    },
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function tryOpen(code: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PREFIX + code, peerOptions());
    peer.once('open', () => resolve(peer));
    peer.once('error', (err) => {
      peer.destroy();
      reject(err);
    });
  });
}

export const openPeerRoom: OpenRoom = async () => {
  let peer: Peer | null = null;
  let room = '';
  for (let attempt = 0; attempt < 5 && !peer; attempt++) {
    room = randomRoomCode();
    try {
      peer = await withTimeout(tryOpen(room), OPEN_TIMEOUT, 'Opening the room');
    } catch (err) {
      // Someone else has this code; try another. Anything else is a real failure.
      if ((err as { type?: string }).type !== 'unavailable-id') throw err;
    }
  }
  if (!peer) throw new Error('Could not find a free room code');
  const p = peer;
  const linkCbs: ((link: Link) => void)[] = [];
  p.on('connection', (conn) => {
    conn.on('open', () => {
      const link = wrap(conn);
      for (const cb of linkCbs) cb(link);
    });
  });
  // Losing the signaling server only stops new players from joining; reconnect quietly.
  p.on('disconnected', () => {
    if (!p.destroyed) setTimeout(() => !p.destroyed && p.reconnect(), 1000);
  });
  p.on('error', () => {
    /* individual connection errors are handled per link */
  });
  const host: HostTransport = {
    room,
    onLink: (cb) => linkCbs.push(cb),
    close: () => p.destroy(),
  };
  return host;
};

export const joinPeerRoom: JoinRoom = (room) =>
  withTimeout(
    new Promise<Link>((resolve, reject) => {
      const peer = new Peer(peerOptions());
      peer.once('error', (err) => {
        peer.destroy();
        reject(err);
      });
      peer.once('open', () => {
        const conn = peer.connect(PREFIX + room, { reliable: true, serialization: 'json' });
        conn.once('open', () => {
          const link = wrap(conn);
          link.onClose(() => peer.destroy());
          resolve(link);
        });
        conn.once('error', (err) => {
          peer.destroy();
          reject(err);
        });
      });
    }),
    OPEN_TIMEOUT,
    'Joining the game',
  );
