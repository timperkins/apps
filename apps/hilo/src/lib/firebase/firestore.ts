import { Game, GameSchema, Player, PlayerSchema, Round, RoundSchema } from '@/shared/types';
import {
  collection,
  CollectionReference,
  connectFirestoreEmulator,
  doc,
  DocumentReference,
  FirestoreDataConverter,
  getFirestore,
  QueryDocumentSnapshot,
  serverTimestamp,
  SnapshotOptions,
  updateDoc,
} from 'firebase/firestore';
import { app, FIRESTORE_DATABASE_ID, useEmulators } from './firebase';

export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

if (useEmulators && typeof window !== 'undefined') {
  try {
    connectFirestoreEmulator(db, window.location.hostname, 8080);
  } catch {
    // Already connected (hot reload).
  }
}

/**
 * Read-only converters: all game writes go through the server, except each player's heartbeat.
 * Pending server timestamps read as estimates rather than null.
 */
function readOnlyConverter<T>(
  parse: (id: string, data: Record<string, unknown>) => T,
): FirestoreDataConverter<T> {
  return {
    toFirestore() {
      throw new Error('Game data is written by the server');
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return parse(snapshot.id, snapshot.data({ ...options, serverTimestamps: 'estimate' }));
    },
  };
}

const playerConverter = readOnlyConverter<Player>((id, data) =>
  PlayerSchema.parse({ ...data, id }),
);
const gameConverter = readOnlyConverter<Game>((id, data) =>
  GameSchema.parse({ ...data, roomCode: id }),
);
const roundConverter = readOnlyConverter<Round>((id, data) =>
  RoundSchema.parse({ ...data, round: parseInt(id) }),
);

export function getPlayersCollection(gameId: string): CollectionReference<Player> {
  return collection(db, 'games', gameId, 'players').withConverter(playerConverter);
}

export function getRoundsCollection(gameId: string): CollectionReference<Round> {
  return collection(db, 'games', gameId, 'rounds').withConverter(roundConverter);
}

export function getGameDocument(gameId: string): DocumentReference<Game> {
  return doc(db, 'games', gameId).withConverter(gameConverter);
}

/** The only client write: "I'm still here" (see firestore.rules). */
export function writeHeartbeat(gameId: string, playerId: string) {
  return updateDoc(doc(db, 'games', gameId, 'players', playerId), {
    lastSeen: serverTimestamp(),
  });
}
