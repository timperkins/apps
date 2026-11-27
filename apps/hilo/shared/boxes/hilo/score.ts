import { HiLoRound } from '@/shared/types';
import {
  CLOSE_ANSWER_RATIO,
  POINTS_CLOSE_ANSWER,
  POINTS_CORRECT_GUESS,
  POINTS_EXACT_ANSWER,
} from './config';
import { Direction, HiLoRoundData } from './types';

/** The right guess for a round, or null when the answerer was exactly right. */
export function correctDirection(data: HiLoRoundData): Direction | null | undefined {
  const { correctAnswer, playerAnswer } = data;
  if (correctAnswer === undefined || playerAnswer === undefined) return undefined;
  if (correctAnswer > playerAnswer) return Direction.Higher;
  if (correctAnswer < playerAnswer) return Direction.Lower;
  return null;
}

export type AnswerAccuracy = 'exact' | 'close' | 'off';

export function answerAccuracy(data: HiLoRoundData): AnswerAccuracy | undefined {
  const { correctAnswer, playerAnswer } = data;
  if (correctAnswer === undefined || playerAnswer === undefined) return undefined;
  if (correctAnswer === playerAnswer) return 'exact';
  const tolerance = Math.abs(correctAnswer) * CLOSE_ANSWER_RATIO;
  return Math.abs(correctAnswer - playerAnswer) <= tolerance ? 'close' : 'off';
}

/** Points each player earned in a round (players who earned nothing are left out). */
export function scoreRound(data: HiLoRoundData): Record<string, number> {
  const scores: Record<string, number> = {};
  if (!data.revealTime) return scores;
  const direction = correctDirection(data);
  if (direction === undefined) return scores;

  const add = (playerId: string, points: number) => {
    scores[playerId] = (scores[playerId] ?? 0) + points;
  };

  for (const guess of data.guesses) {
    if (guess.direction === direction) add(guess.playerId, POINTS_CORRECT_GUESS);
  }

  const accuracy = answerAccuracy(data);
  if (accuracy === 'exact') add(data.answerPlayerId, POINTS_EXACT_ANSWER);
  if (accuracy === 'close') add(data.answerPlayerId, POINTS_CLOSE_ANSWER);

  return scores;
}

export interface PlayerStanding {
  playerId: string;
  total: number;
  /** Points from the latest scored round. */
  lastRound: number;
  /** 1-based; players with the same total share a rank. */
  rank: number;
}

export function standings(rounds: HiLoRound[], playerIds: string[]): PlayerStanding[] {
  const ordered = [...rounds].sort((a, b) => a.round - b.round);
  const scored = ordered.filter((round) => round.data.revealTime);
  const last = scored[scored.length - 1];
  const lastScores = last ? scoreRound(last.data) : {};

  const totals: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const round of scored) {
    for (const [playerId, points] of Object.entries(scoreRound(round.data))) {
      if (playerId in totals) totals[playerId] += points;
    }
  }

  const sorted = playerIds
    .map((playerId) => ({
      playerId,
      total: totals[playerId],
      lastRound: lastScores[playerId] ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  return sorted.map((standing) => ({
    ...standing,
    rank: sorted.findIndex((other) => other.total === standing.total) + 1,
  }));
}
