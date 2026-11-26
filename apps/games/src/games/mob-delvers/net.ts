// M.D. team play: same setup as Factori-owen (hosts list themselves in Firestore, players connect
// over WebRTC, the host runs the real game). Host documents carry game: 'mob-delvers' so each game only
// lists its own hosts.
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
}, 'mob-delvers');
const auth = getAuth(app);
// CI sets the database id (games for prod, games-preview for previews); local runs use the preview one.
const db = getFirestore(app, env.VITE_FIRESTORE_DATABASE_ID || 'games-preview');

const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const LIFETIME_MS = 3 * 60 * 60 * 1000;
const expiresAt = () => Timestamp.fromMillis(Date.now() + LIFETIME_MS);
/** Hosts that haven't checked in for this long are hidden from the list. */
const STALE_MS = 3 * 60 * 1000;
const CHUNK = 15000;
const GAME = 'mob-delvers';

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
    return { id: d.id, name: x.name ?? 'Someone', world: x.world ?? 'Camp', players: x.players ?? 1, updated: x.updatedAt?.toMillis?.() ?? 0 };
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
  world = 'Camp';
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
  return { pipe, close: () => pc.close() };
}
