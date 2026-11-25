// Explorer co-op, hosted the Factori-owen way: hosts list themselves in Firestore, friends pick one
// from the Join list and connect over WebRTC. The host runs the real world. Host documents carry
// game: 'explorer' so each game only lists its own hosts.
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore';

const env = import.meta.env;
const app = initializeApp({
  apiKey: 'AIzaSyDqgldIcbiEGPtlDoVVohbwuyKBiWZq3Qc',
  authDomain: 'apps-97595.firebaseapp.com',
  projectId: 'apps-97595',
  appId: '1:769532990756:web:db61ccd442333d635c8fb1',
}, 'explorer');
const auth = getAuth(app);
// CI sets the database id (games for prod, games-preview for previews); local runs use the preview one.
const db = getFirestore(app, env.VITE_FIRESTORE_DATABASE_ID || 'games-preview');

const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const LIFETIME_MS = 3 * 60 * 60 * 1000;
const expiresAt = () => Timestamp.fromMillis(Date.now() + LIFETIME_MS);
/** Hosts that haven't checked in for this long are hidden from the list. */
const STALE_MS = 3 * 60 * 1000;
const CHUNK = 15000;
const GAME = 'explorer';

let userPromise: Promise<User> | null = null;
export function ensureUser(): Promise<User> {
  if (!userPromise) {
    userPromise = new Promise<User>((resolve, reject) => {
      const stop = onAuthStateChanged(auth, (u) => {
        if (u) {
          stop();
          resolve(u);
        }
      });
      signInAnonymously(auth).catch((err) => {
        stop();
        userPromise = null;
        reject(err);
      });
    });
  }
  return userPromise;
}

export interface HostInfo {
  id: string;
  name: string;
  world: string;
  players: number;
  updated: number;
}

export async function listHosts(): Promise<HostInfo[]> {
  await ensureUser();
  const since = Timestamp.fromMillis(Date.now() - STALE_MS);
  const snap = await getDocs(query(collection(db, 'hosts'), where('updatedAt', '>', since), orderBy('updatedAt', 'desc'), limit(50)));
  return snap.docs.filter((d) => d.data().game === GAME).map((d) => {
    const x = d.data();
    return { id: d.id, name: x.name ?? 'Someone', world: x.world ?? 'A world', players: x.players ?? 1, updated: x.updatedAt?.toMillis?.() ?? 0 };
  });
}

function gatherIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, 2500);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

type SD = { type: RTCSdpType; sdp: string };
const describe = (pc: RTCPeerConnection): SD => ({ type: pc.localDescription!.type, sdp: pc.localDescription!.sdp });

/** A reliable message pipe that splits big messages into chunks. */
export class Pipe {
  onMessage: (msg: any) => void = () => {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  onClose: () => void = () => {};
  private parts: string[] = [];

  constructor(public ch: RTCDataChannel) {
    ch.onmessage = (e) => {
      const s = e.data as string;
      if (s[0] === '+') {
        this.parts.push(s.slice(1));
        return;
      }
      if (s[0] === '.') {
        this.parts.push(s.slice(1));
        const all = this.parts.join('');
        this.parts = [];
        this.onMessage(JSON.parse(all));
        return;
      }
      this.onMessage(JSON.parse(s));
    };
    ch.onclose = () => this.onClose();
  }

  send(msg: unknown) {
    if (this.ch.readyState !== 'open') return;
    const s = JSON.stringify(msg);
    if (s.length < CHUNK) {
      this.ch.send(s);
      return;
    }
    for (let i = 0; i < s.length; i += CHUNK) {
      const last = i + CHUNK >= s.length;
      this.ch.send((last ? '.' : '+') + s.slice(i, i + CHUNK));
    }
  }

  get open() {
    return this.ch.readyState === 'open';
  }
}

// ---------- host ----------

export class Host {
  private stopOffers: () => void = () => {};
  private beat = 0;
  private sessions = new Map<string, { session: string; pc: RTCPeerConnection }>();
  uid = '';
  onGuest: (id: string, pipe: Pipe) => void = () => {};
  onGuestLeft: (id: string) => void = () => {};

  async open(name: string, world: string) {
    const u = await ensureUser();
    this.uid = u.uid;
    const ref = doc(db, 'hosts', u.uid);
    await setDoc(ref, { game: GAME, name: name.slice(0, 24), world: world.slice(0, 32), players: 1, updatedAt: Timestamp.now(), expiresAt: expiresAt() });
    this.beat = window.setInterval(() => void this.touch(), 60_000);
    this.stopOffers = onSnapshot(collection(db, 'hosts', u.uid, 'rtc'), (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed') continue;
        const s = ch.doc.data() as { session: string; offer: SD; answer?: SD };
        if (s.answer || this.sessions.get(ch.doc.id)?.session === s.session) continue;
        void this.answer(ch.doc.id, s.session, s.offer);
      }
    });
  }

  players = 1;
  world = 'A world';
  async touch() {
    if (!this.uid) return;
    try {
      await updateDoc(doc(db, 'hosts', this.uid), { players: this.players, world: this.world.slice(0, 32), updatedAt: Timestamp.now(), expiresAt: expiresAt() });
    } catch (err) {
      console.warn('host heartbeat failed', err);
    }
  }

  private async answer(guest: string, session: string, offer: SD) {
    this.sessions.get(guest)?.pc.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.sessions.set(guest, { session, pc });
    pc.ondatachannel = (e) => {
      const pipe = new Pipe(e.channel);
      e.channel.onopen = () => this.onGuest(guest, pipe);
      pipe.onClose = () => this.onGuestLeft(guest);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.onGuestLeft(guest);
    };
    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await gatherIce(pc);
    await updateDoc(doc(db, 'hosts', this.uid, 'rtc', guest), { answer: describe(pc) });
  }

  async close() {
    clearInterval(this.beat);
    this.stopOffers();
    for (const s of this.sessions.values()) s.pc.close();
    this.sessions.clear();
    if (this.uid) await deleteDoc(doc(db, 'hosts', this.uid)).catch(() => {});
  }
}

// ---------- guest ----------

export async function joinHost(hostId: string): Promise<{ pipe: Pipe; close: () => void }> {
  const u = await ensureUser();
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const ch = pc.createDataChannel('game');
  const session = crypto.randomUUID();
  const ref = doc(db, 'hosts', hostId, 'rtc', u.uid);
  await pc.setLocalDescription(await pc.createOffer());
  await gatherIce(pc);
  const stop = onSnapshot(ref, (snap) => {
    const s = snap.data() as { session: string; answer?: SD } | undefined;
    if (s?.session === session && s.answer && !pc.remoteDescription) void pc.setRemoteDescription(s.answer);
  });
  await setDoc(ref, { session, offer: describe(pc), expiresAt: expiresAt() });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The host did not answer. They may have closed their game.')), 15000);
    ch.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
  }).finally(stop);
  const pipe = new Pipe(ch);
  // the host's tab closing shows up as a failed connection, not always a closed channel
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') pipe.onClose(); };
  return { pipe, close: () => pc.close() };
}

// ---------- sessions: slots 1 to 3 for friends, on top of the host list ----------

export const MAX_PLAYERS = 4;

export interface HostSession {
  role: 'host';
  name: string;
  friends(): number[];
  send(slot: number, msg: unknown): void;
  broadcast(msg: unknown): void;
  onJoin(cb: (slot: number) => void): void;
  onLeave(cb: (slot: number) => void): void;
  onMessage(cb: (slot: number, msg: unknown) => void): void;
  setWorld(world: string): void;
  close(): void;
}

export interface FriendSession {
  role: 'friend';
  name: string;
  slot: number;
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export type Session = HostSession | FriendSession;

type Hello = { t: '_hi'; slot: number } | { t: '_full' };

/** List this world so friends can join it from their Join list. */
export async function hostWorld(name: string, world: string): Promise<HostSession> {
  const h = new Host();
  h.world = world;
  const pipes = new Map<number, Pipe>();
  const slotOf = new Map<string, number>();
  const joinCbs: ((s: number) => void)[] = [], leaveCbs: ((s: number) => void)[] = [], msgCbs: ((s: number, m: unknown) => void)[] = [];
  let closed = false;
  const left = (guest: string) => {
    const slot = slotOf.get(guest);
    if (slot === undefined) return;
    slotOf.delete(guest);
    pipes.delete(slot);
    h.players = 1 + pipes.size;
    void h.touch();
    for (const cb of leaveCbs) cb(slot);
  };
  h.onGuest = (guest, pipe) => {
    if (closed) return;
    if (slotOf.has(guest)) left(guest);
    let slot = 1;
    while (pipes.has(slot)) slot++;
    if (slot >= MAX_PLAYERS) {
      pipe.send({ t: '_full' } satisfies Hello);
      return;
    }
    pipes.set(slot, pipe);
    slotOf.set(guest, slot);
    h.players = 1 + pipes.size;
    void h.touch();
    pipe.send({ t: '_hi', slot } satisfies Hello);
    pipe.onMessage = (m) => { for (const cb of msgCbs) cb(slot, m); };
    pipe.onClose = () => { if (pipes.get(slot) === pipe) left(guest); };
    for (const cb of joinCbs) cb(slot);
  };
  h.onGuestLeft = left;
  await h.open(name, world);
  return {
    role: 'host',
    name,
    friends: () => [...pipes.keys()].sort(),
    send: (slot, msg) => pipes.get(slot)?.send(msg),
    broadcast: (msg) => { for (const p of pipes.values()) p.send(msg); },
    onJoin: (cb) => joinCbs.push(cb),
    onLeave: (cb) => leaveCbs.push(cb),
    onMessage: (cb) => msgCbs.push(cb),
    setWorld: (w) => { h.world = w; },
    close: () => {
      closed = true;
      for (const p of pipes.values()) p.ch.close();
      pipes.clear();
      void h.close();
    },
  };
}

/** Join a world from the list. */
export async function joinWorld(info: HostInfo): Promise<FriendSession> {
  const { pipe, close } = await joinHost(info.id);
  const msgCbs: ((m: unknown) => void)[] = [], early: unknown[] = [], closeCbs: (() => void)[] = [];
  let got = false;
  const slot = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The host didn’t answer.')), 10000);
    pipe.onMessage = (m) => {
      if (!got) {
        const hi = m as Hello;
        if (hi?.t === '_full') { clearTimeout(timer); got = true; close(); reject(new Error(`That world already has ${MAX_PLAYERS} players.`)); }
        else if (hi?.t === '_hi') { clearTimeout(timer); got = true; resolve(hi.slot); }
        return;
      }
      if (msgCbs.length) for (const cb of msgCbs) cb(m); else early.push(m);
    };
    pipe.onClose = () => { if (!got) { clearTimeout(timer); reject(new Error('The host closed the game.')); } else for (const cb of closeCbs) cb(); };
  });
  return {
    role: 'friend',
    name: info.name,
    slot,
    send: (msg) => pipe.send(msg),
    onMessage: (cb) => { msgCbs.push(cb); for (const m of early.splice(0)) cb(m); },
    onClose: (cb) => closeCbs.push(cb),
    close,
  };
}
