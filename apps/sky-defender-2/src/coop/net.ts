// PeerJS transport for co-op. The free public PeerJS server only brokers the WebRTC handshake;
// once a data channel is open, messages go straight between each phone and the host screen.
import { Peer, type DataConnection } from 'peerjs';

/** Prefix so our room codes don't collide with other apps on the shared PeerJS server. */
const PREFIX = 'skydef2-coop-';
const OPEN_TIMEOUT = 12000;
/** For local testing, VITE_PEER_HOST (host:port) points at a PeerJS server of your own instead of the public one. */
const LOCAL = import.meta.env.VITE_PEER_HOST as string | undefined;
const OPTS = LOCAL ? { host: LOCAL.split(':')[0], port: Number(LOCAL.split(':')[1] || 9000), path: '/', secure: false } : {};
/** Consonants only: no lookalikes and no accidental words. */
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

export function randomCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
export function normalizeCode(s: string): string { return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); }

export interface Link {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
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
  // A phone that locks its screen can drop without a close event; the ICE state catches that.
  conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
    const s = conn.peerConnection?.iceConnectionState;
    if (s === 'failed' || s === 'closed' || s === 'disconnected') fireClose();
  });
  return {
    send: msg => { if (!closed && conn.open) conn.send(msg); },
    onMessage: cb => conn.on('data', cb),
    onClose: cb => closeCbs.push(cb),
    close: () => { conn.close(); fireClose(); },
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

function tryOpen(code: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PREFIX + code, OPTS);
    peer.once('open', () => resolve(peer));
    peer.once('error', err => { peer.destroy(); reject(err); });
  });
}

export interface HostRoom { code: string; onLink(cb: (link: Link) => void): void; close(): void; }

/** Opens a room on this screen under a fresh 4-letter code. */
export async function openRoom(): Promise<HostRoom> {
  let peer: Peer | null = null, code = '';
  for (let attempt = 0; attempt < 5 && !peer; attempt++) {
    code = randomCode();
    try { peer = await withTimeout(tryOpen(code), OPEN_TIMEOUT, 'Opening the room'); }
    catch (err) {
      // someone else has this code: try another. Anything else is a real failure.
      if ((err as { type?: string }).type !== 'unavailable-id') throw err;
    }
  }
  if (!peer) throw new Error('Could not find a free room code');
  const p = peer;
  const linkCbs: ((link: Link) => void)[] = [];
  p.on('connection', conn => {
    conn.on('open', () => { const link = wrap(conn); for (const cb of linkCbs) cb(link); });
  });
  // Losing the signalling server only stops new phones from joining; reconnect quietly.
  p.on('disconnected', () => { if (!p.destroyed) setTimeout(() => !p.destroyed && p.reconnect(), 1000); });
  p.on('error', () => { /* individual connection errors are handled per link */ });
  return { code, onLink: cb => linkCbs.push(cb), close: () => p.destroy() };
}

/** Joins the room with this code from a phone. */
export function joinRoom(code: string): Promise<Link> {
  return withTimeout(new Promise<Link>((resolve, reject) => {
    const peer = new Peer(OPTS);
    peer.once('error', err => { peer.destroy(); reject(err); });
    peer.once('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      conn.once('open', () => { const link = wrap(conn); link.onClose(() => peer.destroy()); resolve(link); });
      conn.once('error', err => { peer.destroy(); reject(err); });
    });
  }), OPEN_TIMEOUT, 'Joining the game');
}
