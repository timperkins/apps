import { rethrow } from '@/server/errors';
import {
  createGame,
  createNextGame,
  getGameByCode,
  joinGame,
  startGame,
  updatePlayerAvatar,
} from '@/server/services/game';
import { authenticatedProcedure, router } from '@/server/trpc';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@/shared/constants';
import { AppErrorCode, PlayerAvatarType } from '@/shared/types';
import { errors } from '@/server/errors';
import { z } from 'zod';

const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(/^[A-Z]+$/);

export const gameRouter = router({
  create: authenticatedProcedure
    .output(z.object({ success: z.boolean(), roomCode: z.string() }))
    .mutation(async ({ ctx }) => {
      try {
        const { roomCode } = await createGame(ctx.playerId);
        return { success: true, roomCode };
      } catch (error) {
        rethrow(error, AppErrorCode.GAME_CREATION_FAILED, 'Failed to create game');
      }
    }),
  createNextGame: authenticatedProcedure
    .input(z.object({ roomCode }))
    .output(z.object({ success: z.boolean(), nextGameRoomCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const nextGameRoomCode = await createNextGame(input.roomCode, ctx.playerId);
        return { success: true, nextGameRoomCode };
      } catch (error) {
        rethrow(error, AppErrorCode.GAME_CREATION_FAILED, 'Failed to create next game');
      }
    }),
  verifyGame: authenticatedProcedure
    .input(z.object({ roomCode }))
    .output(z.object({ verified: z.literal(true) }))
    .mutation(async ({ input }) => {
      try {
        const game = await getGameByCode(input.roomCode);
        if (!game) throw errors.gameNotFound();
        return { verified: true as const };
      } catch (error) {
        rethrow(error, AppErrorCode.GAME_VERIFICATION_FAILED, 'Failed to verify game');
      }
    }),
  joinGame: authenticatedProcedure
    .input(z.object({ roomCode, playerName: z.string().trim().min(1).max(NAME_MAX_LENGTH) }))
    .output(z.object({ joined: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      try {
        await joinGame(input.roomCode, ctx.playerId, input.playerName);
        return { joined: true as const };
      } catch (error) {
        rethrow(error, AppErrorCode.GAME_JOIN_FAILED, 'Failed to join game');
      }
    }),
  startGame: authenticatedProcedure
    .input(z.object({ roomCode }))
    .output(z.object({ started: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await startGame(input.roomCode, ctx.playerId);
        return { started: true };
      } catch (error) {
        rethrow(error, AppErrorCode.GAME_START_FAILED, 'Failed to start game');
      }
    }),
  updatePlayerAvatar: authenticatedProcedure
    .input(z.object({ roomCode, avatar: z.nativeEnum(PlayerAvatarType) }))
    .output(z.object({ avatar: z.nativeEnum(PlayerAvatarType) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const avatar = await updatePlayerAvatar(input.roomCode, ctx.playerId, input.avatar);
        return { avatar };
      } catch (error) {
        rethrow(error, AppErrorCode.UNKNOWN_ERROR, 'Failed to update player avatar');
      }
    }),
});
