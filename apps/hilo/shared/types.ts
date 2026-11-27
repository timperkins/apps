import { z } from 'zod';
import { HiLoRoundData, HiLoRoundDataSchema } from './boxes/hilo/types';
import { firestoreDate } from './firestoreDate';

export enum GameState {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ENDED = 'ENDED',
}

export enum GameBox {
  HILO = 'HILO',
}

export enum AppErrorCode {
  GAME_FULL = 'GAME_FULL',
  GAME_ALREADY_STARTED = 'GAME_ALREADY_STARTED',
  GAME_CREATION_FAILED = 'GAME_CREATION_FAILED',
  GAME_DATA_NOT_FOUND = 'GAME_DATA_NOT_FOUND',
  GAME_FETCH_FAILED = 'GAME_FETCH_FAILED',
  GAME_JOIN_FAILED = 'GAME_JOIN_FAILED',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  GAME_START_FAILED = 'GAME_START_FAILED',
  GAME_VERIFICATION_FAILED = 'GAME_VERIFICATION_FAILED',
  INVALID_AUTHORIZATION = 'INVALID_AUTHORIZATION',
  INVALID_GAME_DATA_FORMAT = 'INVALID_GAME_DATA_FORMAT',
  INVALID_QUESTION = 'INVALID_QUESTION',
  NOT_ALLOWED = 'NOT_ALLOWED',
  NOT_ENOUGH_ACTIVE_PLAYERS = 'NOT_ENOUGH_ACTIVE_PLAYERS',
  ONLY_HOST_CAN_START = 'ONLY_HOST_CAN_START',
  ONLY_HOST_ALLOWED = 'ONLY_HOST_ALLOWED',
  QUESTION_ASK_FAILED = 'QUESTION_ASK_FAILED',
  ROUND_NOT_FOUND = 'ROUND_NOT_FOUND',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  UNSUPPORTED_GAME_BOX = 'UNSUPPORTED_GAME_BOX',
}

export enum PlayerAvatarType {
  Duck = 'Duck',
  Fish = 'Fish',
  Kangaroo = 'Kangaroo',
  Bat = 'Bat',
  Elk = 'Elk',
  Crab = 'Crab',
  Tiger = 'Tiger',
  Rhino = 'Rhino',
  Elephant = 'Elephant',
  Rooster = 'Rooster',
  Camel = 'Camel',
}

export const GameSchema = z.object({
  roomCode: z.string().min(1),
  createTime: firestoreDate,
  startTime: firestoreDate.optional(),
  state: z.nativeEnum(GameState),
  box: z.nativeEnum(GameBox),
  createdBy: z.string().min(1),
  playerAvatars: z.record(z.string().min(1).describe('Player id'), z.nativeEnum(PlayerAvatarType)),
  /** Set when the game starts, from the number of players who are here. */
  totalRounds: z.number().int().positive().optional(),
  /**
   * At the end of a game, the host can start a new game and this is the room code for the new
   * game. */
  nextGameRoomCode: z.string().optional(),
  expiresAt: firestoreDate.optional(),
});
export type Game = z.infer<typeof GameSchema>;

export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  joinTime: firestoreDate,
  /** Heartbeat written by the player's browser while the game is open (see shared/game.ts). */
  lastSeen: firestoreDate.optional(),
  isHost: z.boolean().optional(),
  expiresAt: firestoreDate.optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

const BaseRoundSchema = z.object({
  round: z.number().positive(),
  startTime: firestoreDate,
  endTime: firestoreDate.optional(),
  expiresAt: firestoreDate.optional(),
});

export const RoundSchema = z.discriminatedUnion('gameBox', [
  BaseRoundSchema.extend({
    gameBox: z.literal(GameBox.HILO),
    data: HiLoRoundDataSchema,
  }),
]);

export type Round = z.infer<typeof RoundSchema>;

export type HiLoRound = Round & {
  gameBox: GameBox.HILO;
  data: HiLoRoundData;
};

export function isHiLoRound(round: Round): round is HiLoRound {
  return round.gameBox === GameBox.HILO;
}
