import 'server-only';
import { errors, appError } from '@/server/errors';
import { buildHiLoRoundData } from '@/server/services/boxes/hilo/round';
import { collections, db, newExpiresAt } from '@/server/services/firebase/firestore';
import { totalRoundsForPlayers } from '@/shared/boxes/hilo/round';
import { ROOM_CODE_LENGTH } from '@/shared/constants';
import { getActivePlayers, getGameHost } from '@/shared/game';
import { AppErrorCode, Game, GameBox, GameState, PlayerAvatarType } from '@/shared/types';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

/** Generates a random room code using characters that are visually distinct. */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Creates a game with an unused room code. `playerAvatars` carries avatars over from a previous
 * game so everyone keeps their animal when the host starts a new game.
 */
export async function createGame(
  playerId: string,
  playerAvatars: Record<string, PlayerAvatarType> = {},
): Promise<{ roomCode: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const roomCode = generateRoomCode();
    try {
      // `create` fails if the document exists, so two games never share a code.
      await collections.games.doc(roomCode).create({
        roomCode,
        createTime: FieldValue.serverTimestamp(),
        createdBy: playerId,
        state: GameState.NOT_STARTED,
        box: GameBox.HILO,
        playerAvatars,
        expiresAt: newExpiresAt(),
      });
      return { roomCode };
    } catch (error) {
      if ((error as { code?: number }).code !== 6 /* ALREADY_EXISTS */) throw error;
    }
  }
  throw appError(
    'INTERNAL_SERVER_ERROR',
    AppErrorCode.GAME_CREATION_FAILED,
    'No free room code found',
  );
}

export async function getGameByCode(roomCode: string): Promise<Game | null> {
  try {
    const gameDoc = await collections.games.doc(roomCode).get();
    return gameDoc.data() ?? null;
  } catch (error) {
    console.error('Error fetching game by code:', error);
    if (error instanceof ZodError) {
      throw appError('BAD_REQUEST', AppErrorCode.INVALID_GAME_DATA_FORMAT, 'Invalid game data');
    }
    throw appError('INTERNAL_SERVER_ERROR', AppErrorCode.GAME_FETCH_FAILED, 'Failed to fetch game');
  }
}

/** Starts the game and its first round. Only the host can start, with at least 2 players here. */
export async function startGame(roomCode: string, playerId: string): Promise<void> {
  const gameRef = collections.games.doc(roomCode);

  await db.runTransaction(async (transaction) => {
    const [gameDoc, playersSnapshot] = await Promise.all([
      transaction.get(gameRef),
      transaction.get(collections.players(roomCode)),
    ]);
    const game = gameDoc.data();
    if (!game) throw errors.gameNotFound();

    const now = Date.now();
    const players = playersSnapshot.docs.map((doc) => doc.data());
    if (getGameHost(players, now)?.id !== playerId) {
      throw appError('FORBIDDEN', AppErrorCode.ONLY_HOST_CAN_START, 'Only the host can start');
    }
    if (game.state !== GameState.NOT_STARTED) {
      throw appError('BAD_REQUEST', AppErrorCode.GAME_ALREADY_STARTED, 'Game already started');
    }

    const activePlayers = getActivePlayers(players, now);
    // Throws NOT_ENOUGH_ACTIVE_PLAYERS when fewer than 2 players are here.
    const roundData = buildHiLoRoundData([], activePlayers);

    transaction.set(collections.rounds(roomCode).doc('1'), {
      round: 1,
      gameBox: GameBox.HILO,
      startTime: FieldValue.serverTimestamp(),
      data: roundData,
      expiresAt: newExpiresAt(),
    });
    transaction.update(gameRef, {
      state: GameState.IN_PROGRESS,
      startTime: FieldValue.serverTimestamp(),
      totalRounds: totalRoundsForPlayers(activePlayers.length),
    });
  });
}

/** Starts a new game for the same group and points the old game at it. Host only. */
export async function createNextGame(roomCode: string, playerId: string): Promise<string> {
  const [game, playersSnapshot] = await Promise.all([
    getGameByCode(roomCode),
    collections.players(roomCode).get(),
  ]);
  if (!game) throw errors.gameNotFound();
  if (game.nextGameRoomCode) return game.nextGameRoomCode;

  const players = playersSnapshot.docs.map((doc) => doc.data());
  if (getGameHost(players, Date.now())?.id !== playerId) throw errors.onlyHost();

  const { roomCode: nextGameRoomCode } = await createGame(playerId, game.playerAvatars);
  await collections.games.doc(roomCode).update({ nextGameRoomCode });
  return nextGameRoomCode;
}
