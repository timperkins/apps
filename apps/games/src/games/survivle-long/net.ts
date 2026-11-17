import { Peer, type DataConnection } from 'peerjs';

/**
 * Co-op: up to 8 heroes in one world. The host's game runs the world; friends join with
 * the host's code. PeerJS's free public server only brokers the WebRTC handshake, then game traffic
 * goes straight between the devices.
 */

/** So our codes don't collide with other apps on the shared PeerJS server. */
const PREFIX = 'trom-survivle-long-';
const OPEN_TIMEOUT = 12000;
/** Letters and numbers that are hard to mix up (no 0/O, 1/I/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 8;
/** For testing on a computer with its own PeerJS server: ?peer=localhost:9000/myapp. Otherwise the free public one. */
const local = new URLSearchParams(location.search).get('peer');
const OPTS = local ? (() => { const [hp, ...path] = local.split('/'), [host, port] = hp.split(':'); return { host, port: Number(port) || 9000, path: '/' + path.join('/'), secure: false }; })() : {};

export const randomCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
/** What someone typed, as a code: letters and numbers only, upper case, up to 12. */
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export interface Link {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

function wrap(conn: DataConnection): Link {
  const closeCbs: (() => void)[] = [], msgCbs: ((m: unknown) => void)[] = [], early: unknown[] = [];
  let closed = false;
  // messages that come before anyone listens wait for the first listener
  conn.on('data', m => { if (msgCbs.length) for (const cb of msgCbs) cb(m); else early.push(m); });
  const fireClose = () => { if (closed) return; closed = true; for (const cb of closeCbs) cb(); };
  conn.on('close', fireClose);
  conn.on('error', fireClose);
  // a phone that locks its screen can drop without a close event; the connection state catches that
  conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
    const s = conn.peerConnection?.iceConnectionState;
    if (s === 'failed' || s === 'closed' || s === 'disconnected') fireClose();
  });
  return {
    send: msg => { if (!closed && conn.open) try { conn.send(msg); } catch { /* a dropped link closes itself */ } },
    onMessage: cb => { msgCbs.push(cb); for (const m of early.splice(0)) cb(m); },
    onClose: cb => closeCbs.push(cb),
    close: () => { conn.close(); fireClose(); },
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took too long`)), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

export interface Host { code: string; onLink(cb: (link: Link) => void): void; close(): void; }

/** Opens a room with a fresh code (or the one asked for). */
export async function openRoom(want?: string): Promise<Host> {
  const tryOpen = (code: string) => new Promise<Peer>((resolve, reject) => {
    const peer = new Peer(PREFIX + code, OPTS);
    peer.once('open', () => resolve(peer));
    peer.once('error', err => { peer.destroy(); reject(err); });
  });
  let peer: Peer | null = null, code = '';
  // the code asked for (the one you had last game) can take the server a moment to let go of, so try it a few times
  const wantTries = want ? 3 : 0;
  for (let i = 0; i < wantTries + 5 && !peer; i++) {
    code = i < wantTries ? want! : randomCode();
    if (i > 0 && i < wantTries) await new Promise(r => setTimeout(r, 1500));
    try { peer = await withTimeout(tryOpen(code), OPEN_TIMEOUT, 'Making the link'); }
    catch (err) { if ((err as { type?: string }).type !== 'unavailable-id') throw err; }
  }
  if (!peer) throw new Error('Could not find a free code. Try again.');
  const p = peer, cbs: ((l: Link) => void)[] = [], waiting: Link[] = [];
  // friends who join before the game starts wait until it does
  p.on('connection', conn => conn.on('open', () => { const l = wrap(conn); if (cbs.length) for (const cb of cbs) cb(l); else waiting.push(l); }));
  // losing the handshake server only stops new friends joining; reconnect quietly
  p.on('disconnected', () => { if (!p.destroyed) setTimeout(() => !p.destroyed && p.reconnect(), 1000); });
  p.on('error', () => { /* each link handles its own errors */ });
  return { code, onLink: cb => { cbs.push(cb); for (const l of waiting.splice(0)) cb(l); }, close: () => p.destroy() };
}

/** Joins the room with this code. */
export function joinRoom(code: string): Promise<Link> {
  return withTimeout(new Promise<Link>((resolve, reject) => {
    const peer = new Peer(OPTS);
    peer.once('error', err => { peer.destroy(); reject((err as { type?: string }).type === 'peer-unavailable' ? new Error(`No game with the code ${code}`) : err); });
    peer.once('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      conn.once('open', () => { const l = wrap(conn); l.onClose(() => peer.destroy()); resolve(l); });
      conn.once('error', err => { peer.destroy(); reject(err); });
    });
  }), OPEN_TIMEOUT, 'Joining');
}
