// Getting two browsers talking. Browsers can't find each other on the
// network by themselves, so a WebRTC connection needs a go-between to pass
// the handshake (an offer from the joining player, an answer from the host).
// Here that is a room document in Firestore under a four-letter code; once
// the data channel opens, the game itself goes straight between the devices.
// For testing on one machine, ?localnet passes the handshake between tabs
// with a BroadcastChannel instead.
import { randomCode } from './codes';

export interface SessionDescription {
  type: RTCSdpType;
  sdp: string;
}

export interface RtcSignal {
  // changes each time a player (re)connects, so the host can drop stale links
  session: string;
  offer: SessionDescription;
  answer?: SessionDescription;
}

export interface Signaling {
  /** Who this device is (a stable id for the session). */
  me(): Promise<string>;
  // the host
  createRoom(): Promise<string>;
  setPhase(code: string, phase: 'lobby' | 'playing'): Promise<void>;
  /** The host is back (after a reload): the room is theirs again. False if it isn't theirs. */
  reopenRoom(code: string, phase: 'lobby' | 'playing'): Promise<boolean>;
  closeRoom(code: string): Promise<void>;
  watchOffers(code: string, onOffer: (uid: string, signal: RtcSignal) => void): () => void;
  publishAnswer(code: string, uid: string, answer: SessionDescription): Promise<void>;
  // a player joining
  roomPhase(code: string): Promise<'lobby' | 'playing' | null>;
  publishOffer(code: string, uid: string, session: string, offer: SessionDescription): Promise<void>;
  watchSignal(code: string, uid: string, onSignal: (signal: RtcSignal | null) => void): () => void;
}

// ---------- Firestore ----------

export async function firestoreSignaling(): Promise<Signaling> {
  const [{ db, ensureUser }, fs] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  const { collection, deleteDoc, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc } = fs;
  // every document carries expiresAt so Firestore's TTL policy clears out abandoned rooms
  const LIFETIME = 6 * 60 * 60 * 1000;
  const expiresAt = () => Timestamp.fromMillis(Date.now() + LIFETIME);
  const roomRef = (code: string) => doc(db, 'rooms', code);
  const rtcRef = (code: string, uid: string) => doc(db, 'rooms', code, 'rtc', uid);
  return {
    async me() {
      return (await ensureUser()).uid;
    },
    async createRoom() {
      const uid = (await ensureUser()).uid;
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode();
        const made = await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef(code));
          if (snap.exists() && (snap.data().expiresAt?.toMillis?.() ?? 0) > Date.now()) return false;
          tx.set(roomRef(code), { hostUid: uid, phase: 'lobby', createdAt: serverTimestamp(), expiresAt: expiresAt() });
          return true;
        });
        if (made) return code;
      }
      throw new Error('Could not find a free room code. Try again.');
    },
    async setPhase(code, phase) {
      await updateDoc(roomRef(code), { phase, expiresAt: expiresAt() });
    },
    async reopenRoom(code, phase) {
      const uid = (await ensureUser()).uid;
      const snap = await getDoc(roomRef(code));
      if (snap.exists()) {
        if (snap.data().hostUid !== uid) return false;
        await updateDoc(roomRef(code), { phase, expiresAt: expiresAt() });
        return true;
      }
      // gone (cleared out while you were away): make it again
      await setDoc(roomRef(code), { hostUid: uid, phase: 'lobby', createdAt: serverTimestamp(), expiresAt: expiresAt() });
      if (phase !== 'lobby') await updateDoc(roomRef(code), { phase });
      return true;
    },
    async closeRoom(code) {
      await deleteDoc(roomRef(code)).catch(() => {});
    },
    watchOffers(code, onOffer) {
      return onSnapshot(collection(db, 'rooms', code, 'rtc'), (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type === 'removed') continue;
          const s = ch.doc.data() as RtcSignal;
          if (!s.answer) onOffer(ch.doc.id, s);
        }
      });
    },
    async publishAnswer(code, uid, answer) {
      await updateDoc(rtcRef(code, uid), { answer });
    },
    async roomPhase(code) {
      await ensureUser();
      const snap = await getDoc(roomRef(code));
      return snap.exists() ? (snap.data().phase as 'lobby' | 'playing') : null;
    },
    async publishOffer(code, uid, session, offer) {
      await setDoc(rtcRef(code, uid), { session, offer, expiresAt: expiresAt() });
    },
    watchSignal(code, uid, onSignal) {
      return onSnapshot(rtcRef(code, uid), (snap) => onSignal(snap.exists() ? (snap.data() as RtcSignal) : null));
    },
  };
}

// ---------- Between tabs, for testing ----------

type LocalMsg =
  | { k: 'room'; code: string; phase: 'lobby' | 'playing' | null }
  | { k: 'ask'; code: string }
  | { k: 'offer'; code: string; uid: string; signal: RtcSignal }
  | { k: 'answer'; code: string; uid: string; answer: SessionDescription };

export function localSignaling(): Signaling {
  const bc = new BroadcastChannel('ra-localnet');
  // one id per tab, kept when the tab reloads
  let uid = '';
  try {
    uid = sessionStorage.getItem('ra-localnet-uid') ?? '';
    if (!uid) sessionStorage.setItem('ra-localnet-uid', (uid = crypto.randomUUID()));
  } catch {
    uid ||= crypto.randomUUID();
  }
  const listeners = new Set<(m: LocalMsg) => void>();
  bc.onmessage = (e) => listeners.forEach((l) => l(e.data as LocalMsg));
  const on = (l: (m: LocalMsg) => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const rooms = new Map<string, 'lobby' | 'playing'>(); // rooms this tab hosts
  const offers = new Map<string, RtcSignal>(); // offers this tab has made (a tab doesn't hear its own messages)
  on((m) => {
    if (m.k === 'ask' && rooms.has(m.code)) bc.postMessage({ k: 'room', code: m.code, phase: rooms.get(m.code)! } satisfies LocalMsg);
  });
  return {
    async me() {
      return uid;
    },
    async createRoom() {
      const code = randomCode();
      rooms.set(code, 'lobby');
      return code;
    },
    async setPhase(code, phase) {
      rooms.set(code, phase);
    },
    async reopenRoom(code, phase) {
      rooms.set(code, phase);
      return true;
    },
    async closeRoom(code) {
      rooms.delete(code);
    },
    watchOffers(code, onOffer) {
      return on((m) => {
        if (m.k === 'offer' && m.code === code) onOffer(m.uid, m.signal);
      });
    },
    async publishAnswer(code, to, answer) {
      bc.postMessage({ k: 'answer', code, uid: to, answer } satisfies LocalMsg);
    },
    roomPhase(code) {
      return new Promise((resolve) => {
        const stop = on((m) => {
          if (m.k === 'room' && m.code === code) {
            stop();
            clearTimeout(timer);
            resolve(m.phase);
          }
        });
        const timer = setTimeout(() => {
          stop();
          resolve(null);
        }, 800);
        bc.postMessage({ k: 'ask', code } satisfies LocalMsg);
      });
    },
    async publishOffer(code, from, session, offer) {
      offers.set(code, { session, offer });
      bc.postMessage({ k: 'offer', code, uid: from, signal: { session, offer } } satisfies LocalMsg);
    },
    watchSignal(code, me, onSignal) {
      return on((m) => {
        const mine = offers.get(code);
        if (m.k === 'answer' && m.code === code && m.uid === me && mine) onSignal({ ...mine, answer: m.answer });
      });
    },
  };
}
