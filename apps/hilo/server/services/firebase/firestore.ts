import 'server-only';
import { HiLoSecret, HiLoSecretSchema } from '@/shared/boxes/hilo/types';
import { GAME_TTL_MS } from '@/shared/constants';
import { Game, GameSchema, Player, PlayerSchema, Round, RoundSchema } from '@/shared/types';
import {
  CollectionReference,
  DocumentData,
  FirestoreDataConverter,
  getFirestore,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { app } from './firebase';

export const FIRESTORE_DATABASE_ID = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || 'hilo';

export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // Already configured by another server bundle in this process.
}

/** Everything a game writes expires (Firestore TTL policy on `expiresAt`) a day after creation. */
export function newExpiresAt(): Timestamp {
  return Timestamp.fromMillis(Date.now() + GAME_TTL_MS);
}

function converter<T extends object, K extends keyof T>(
  schema: { parse: (data: unknown) => T },
  idKey: K,
  parseId: (id: string) => T[K],
): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T): DocumentData {
      const data = { ...value } as Record<string, unknown>;
      delete data[idKey as string];
      return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return schema.parse({ ...snapshot.data(), [idKey]: parseId(snapshot.id) });
    },
  };
}

const gameConverter = converter<Game, 'roomCode'>(GameSchema, 'roomCode', (id) => id);
const playerConverter = converter<Player, 'id'>(PlayerSchema, 'id', (id) => id);
const roundConverter = converter<Round, 'round'>(RoundSchema, 'round', (id) => parseInt(id));

const secretConverter: FirestoreDataConverter<HiLoSecret> = {
  toFirestore: (value: HiLoSecret) => value,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => HiLoSecretSchema.parse(snapshot.data()),
};

export const collections = {
  games: db.collection('games').withConverter(gameConverter) as CollectionReference<Game>,
  players: (gameId: string) =>
    db
      .collection('games')
      .doc(gameId)
      .collection('players')
      .withConverter(playerConverter) as CollectionReference<Player>,
  rounds: (gameId: string) =>
    db
      .collection('games')
      .doc(gameId)
      .collection('rounds')
      .withConverter(roundConverter) as CollectionReference<Round>,
  /** Server-only: the correct answer for each round until it is revealed. */
  secrets: (gameId: string) =>
    db
      .collection('games')
      .doc(gameId)
      .collection('secrets')
      .withConverter(secretConverter) as CollectionReference<HiLoSecret>,
} as const;
