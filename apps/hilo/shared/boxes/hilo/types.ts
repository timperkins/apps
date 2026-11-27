import { firestoreDate } from '@/shared/firestoreDate';
import { z } from 'zod';

export enum HiLoRoundStage {
  AskQuestion = 'AskQuestion',
  AnswerQuestion = 'AnswerQuestion',
  MoreOrLess = 'MoreOrLess',
  Scoreboard = 'Scoreboard',
}

export enum Direction {
  Higher = 'Higher',
  Lower = 'Lower',
}

export const GuessSchema = z.object({
  playerId: z.string().min(1),
  direction: z.nativeEnum(Direction),
});
export type Guess = z.infer<typeof GuessSchema>;

export const HiLoRoundDataSchema = z.object({
  question: z.string().optional(),
  /** Units of the answer, shown while the answerer types (e.g. "miles"). */
  correctAnswerUnits: z.string().optional(),
  /**
   * The correct answer and explanation are kept in a server-only `secrets` document until the
   * answer is revealed, so nobody can read them early.
   */
  correctAnswer: z.number().optional(),
  correctAnswerExplanation: z.string().optional(),
  playerAnswer: z.number().optional(),
  questionPlayerId: z.string().min(1),
  answerPlayerId: z.string().min(1),
  activeStage: z.nativeEnum(HiLoRoundStage),
  guesses: z.array(GuessSchema),
  lastGuessTime: firestoreDate.optional(),
  /** When the answer is shown. Set once every player has guessed (or the host reveals early). */
  revealTime: firestoreDate.optional(),
});

export type HiLoRoundData = z.infer<typeof HiLoRoundDataSchema>;

export const HiLoSecretSchema = z.object({
  correctAnswer: z.number(),
  correctAnswerExplanation: z.string(),
});
export type HiLoSecret = z.infer<typeof HiLoSecretSchema>;
