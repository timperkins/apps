import 'server-only';
import { appError, errors } from '@/server/errors';
import { collections, db, newExpiresAt } from '@/server/services/firebase/firestore';
import { MAX_NUM_PLAYERS } from '@/shared/constants';
import { AppErrorCode, Player, PlayerAvatarType } from '@/shared/types';
import { FieldValue } from 'firebase-admin/firestore';
import { shuffle } from 'lodash';

export async function getAllPlayers(roomCode: string): Promise<Player[]> {
  const playersSnapshot = await collections.players(roomCode).get();
  return playersSnapshot.docs.map((doc) => doc.data());
}

/**
 * Adds the player to the game (or updates their name when they rejoin) and gives them an avatar.
 * Players can join a game in progress; they start guessing from the current round.
 */
export async function joinGame(
  roomCode: string,
  playerId: string,
  playerName: string,
): Promise<void> {
  const gameRef = collections.games.doc(roomCode);
  const playersRef = collections.players(roomCode);
  const playerRef = playersRef.doc(playerId);

  await db.runTransaction(async (transaction) => {
    const [gameDoc, playersSnapshot] = await Promise.all([
      transaction.get(gameRef),
      transaction.get(playersRef),
    ]);
    const game = gameDoc.data();
    if (!game) throw errors.gameNotFound();

    const existing = playersSnapshot.docs.find((doc) => doc.id === playerId);
    if (existing) {
      transaction.update(playerRef, { name: playerName, lastSeen: FieldValue.serverTimestamp() });
    } else {
      if (playersSnapshot.docs.length >= MAX_NUM_PLAYERS) {
        throw appError('BAD_REQUEST', AppErrorCode.GAME_FULL, 'Game is full');
      }
      transaction.set(playerRef, {
        id: playerId,
        name: playerName,
        joinTime: FieldValue.serverTimestamp(),
        lastSeen: FieldValue.serverTimestamp(),
        // The creator of the game is its host.
        isHost: game.createdBy === playerId,
        expiresAt: newExpiresAt(),
      });
    }

    const avatars = game.playerAvatars;
    if (!avatars[playerId]) {
      transaction.update(gameRef, {
        [`playerAvatars.${playerId}`]: pickAvatar(avatars),
      });
    }
  });
}

function pickAvatar(avatars: Record<string, PlayerAvatarType>): PlayerAvatarType {
  const taken = Object.values(avatars);
  const available = shuffle(Object.values(PlayerAvatarType)).filter(
    (type) => !taken.includes(type),
  );
  return available[0] ?? shuffle(Object.values(PlayerAvatarType))[0];
}

/** Changes the player's avatar; falls back to a free one if someone else already has it. */
export async function updatePlayerAvatar(
  roomCode: string,
  playerId: string,
  newAvatar: PlayerAvatarType,
): Promise<PlayerAvatarType> {
  const gameRef = collections.games.doc(roomCode);
  return db.runTransaction(async (transaction) => {
    const game = (await transaction.get(gameRef)).data();
    if (!game) throw errors.gameNotFound();
    if (!(playerId in game.playerAvatars)) throw errors.notAllowed('Not a player in this game');

    const { [playerId]: current, ...others } = game.playerAvatars;
    const avatar = Object.values(others).includes(newAvatar) ? current : newAvatar;
    transaction.update(gameRef, { [`playerAvatars.${playerId}`]: avatar });
    return avatar;
  });
}
