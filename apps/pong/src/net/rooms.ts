import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { randomCode } from './codes';

export type Phase = 'lobby' | 'playing' | 'paused' | 'over';

export interface Room {
  hostUid: string;
  phase: Phase;
  // Player uid in each slot; index 0 is the left paddle.
  slots: (string | null)[];
  score: number[];
  maxPlayers: number;
}

export interface SessionDescription {
  type: RTCSdpType;
  sdp: string;
}

export interface RtcSignal {
  // Changes each time a controller (re)connects, so the display can drop stale links.
  session: string;
  offer: SessionDescription;
  answer?: SessionDescription;
}

// Every document carries expiresAt so Firestore TTL policies clean up abandoned rooms.
const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;
const expiresAt = () => Timestamp.fromMillis(Date.now() + ROOM_LIFETIME_MS);

const roomRef = (code: string) => doc(db, 'rooms', code);

export async function createRoom(hostUid: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const created = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef(code));
      if (snap.exists()) return false;
      tx.set(roomRef(code), {
        hostUid,
        phase: 'lobby',
        slots: [null, null],
        score: [0, 0],
        maxPlayers: 2,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt(),
      });
      return true;
    });
    if (created) return code;
  }
  throw new Error('Could not find a free room code. Try again.');
}

export function watchRoom(code: string, onRoom: (room: Room | null) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(
    roomRef(code),
    (snap) => onRoom(snap.exists() ? (snap.data() as Room) : null),
    onError,
  );
}

export function updateRoom(code: string, patch: Partial<Room>): Promise<void> {
  return updateDoc(roomRef(code), { ...patch, expiresAt: expiresAt() });
}

export function joinRoom(code: string, uid: string): Promise<void> {
  return setDoc(doc(db, 'rooms', code, 'players', uid), { joinedAt: serverTimestamp(), expiresAt: expiresAt() });
}

export function watchPlayers(code: string, onPlayers: (uids: string[]) => void): () => void {
  return onSnapshot(collection(db, 'rooms', code, 'players'), (snap) => onPlayers(snap.docs.map((d) => d.id)));
}

const rtcRef = (code: string, uid: string) => doc(db, 'rooms', code, 'rtc', uid);

export function publishOffer(code: string, uid: string, session: string, offer: SessionDescription): Promise<void> {
  return setDoc(rtcRef(code, uid), { session, offer, expiresAt: expiresAt() });
}

export function publishAnswer(code: string, uid: string, answer: SessionDescription): Promise<void> {
  return updateDoc(rtcRef(code, uid), { answer });
}

export function watchSignal(code: string, uid: string, onSignal: (signal: RtcSignal | null) => void): () => void {
  return onSnapshot(rtcRef(code, uid), (snap) => onSignal(snap.exists() ? (snap.data() as RtcSignal) : null));
}

export function watchOffers(code: string, onOffer: (uid: string, signal: RtcSignal) => void): () => void {
  return onSnapshot(collection(db, 'rooms', code, 'rtc'), (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type === 'removed') continue;
      const signal = change.doc.data() as RtcSignal;
      if (!signal.answer) onOffer(change.doc.id, signal);
    }
  });
}
