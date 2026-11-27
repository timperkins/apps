import { appError, rethrow } from '@/server/errors';
import {
  assertCanAskQuestion,
  createNextRound,
  revealAnswer,
  skipTurn,
  updateRoundToScoreboardStage,
  updateRoundWithMoreOrLessGuess,
  updateRoundWithPlayerAnswer,
  updateRoundWithQuestion,
} from '@/server/services/boxes/hilo/firestore';
import { verifyQuestion } from '@/server/services/boxes/hilo/verifyQuestion';
import { authenticatedProcedure, router } from '@/server/trpc';
import { Direction } from '@/shared/boxes/hilo/types';
import { QUESTION_MAX_LENGTH, ROOM_CODE_LENGTH } from '@/shared/constants';
import { AppErrorCode } from '@/shared/types';
import { z } from 'zod';

const roomCode = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH);
const roomInput = z.object({ roomCode });
const success = z.object({ success: z.literal(true) });

/** A host-or-player action on the current round that returns `{ success: true }`. */
function roundAction(fn: (roomCode: string, playerId: string) => Promise<void>, failure: string) {
  return authenticatedProcedure
    .input(roomInput)
    .output(success)
    .mutation(async ({ input, ctx }) => {
      try {
        await fn(input.roomCode, ctx.playerId);
        return { success: true as const };
      } catch (error) {
        rethrow(error, AppErrorCode.UNKNOWN_ERROR, failure);
      }
    });
}

export const hiloRouter = router({
  askQuestion: authenticatedProcedure
    .input(z.object({ roomCode, question: z.string().trim().min(1).max(QUESTION_MAX_LENGTH) }))
    .output(z.object({ verified: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const roundNumber = await assertCanAskQuestion(input.roomCode, ctx.playerId);
        const result = await verifyQuestion(input.question);
        if (!result.isValid) {
          throw appError('BAD_REQUEST', AppErrorCode.INVALID_QUESTION, result.reason);
        }
        await updateRoundWithQuestion({
          roomCode: input.roomCode,
          playerId: ctx.playerId,
          roundNumber,
          question: input.question,
          correctAnswer: result.answer,
          correctAnswerUnits: result.units,
          correctAnswerExplanation: result.explanation,
        });
        return { verified: true as const };
      } catch (error) {
        rethrow(error, AppErrorCode.QUESTION_ASK_FAILED, 'Failed to ask question');
      }
    }),
  answerQuestion: authenticatedProcedure
    .input(z.object({ roomCode, answer: z.number().finite() }))
    .output(success)
    .mutation(async ({ input, ctx }) => {
      try {
        await updateRoundWithPlayerAnswer({
          roomCode: input.roomCode,
          playerId: ctx.playerId,
          playerAnswer: input.answer,
        });
        return { success: true as const };
      } catch (error) {
        rethrow(error, AppErrorCode.UNKNOWN_ERROR, 'Failed to answer question');
      }
    }),
  moreOrLessGuess: authenticatedProcedure
    .input(z.object({ roomCode, direction: z.nativeEnum(Direction) }))
    .output(success)
    .mutation(async ({ input, ctx }) => {
      try {
        await updateRoundWithMoreOrLessGuess({
          roomCode: input.roomCode,
          playerId: ctx.playerId,
          direction: input.direction,
        });
        return { success: true as const };
      } catch (error) {
        rethrow(error, AppErrorCode.UNKNOWN_ERROR, 'Failed to make guess');
      }
    }),
  revealAnswer: roundAction(revealAnswer, 'Failed to reveal answer'),
  advanceToScoreboardStage: roundAction(updateRoundToScoreboardStage, 'Failed to show scores'),
  createNextRound: roundAction(createNextRound, 'Failed to create next round'),
  skipTurn: roundAction(skipTurn, 'Failed to skip turn'),
});
