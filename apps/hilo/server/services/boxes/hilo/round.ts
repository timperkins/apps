import { appError } from '@/server/errors';
import { HiLoRoundData, HiLoRoundStage } from '@/shared/boxes/hilo/types';
import { AppErrorCode, HiLoRound, Player } from '@/shared/types';
import { reject, sample, sortBy } from 'lodash';

/**
 * Picks who asks and who answers the next round from the players who are here: whoever has waited
 * longest for each role. `activePlayers` must only contain players who are here.
 */
export function buildHiLoRoundData(
  pastRounds: HiLoRound[],
  activePlayers: Player[],
): HiLoRoundData {
  if (activePlayers.length < 2) {
    throw appError(
      'BAD_REQUEST',
      AppErrorCode.NOT_ENOUGH_ACTIVE_PLAYERS,
      'Not enough active players to start a round',
    );
  }

  const questionPlayerId = pickQuestionPlayerId(pastRounds, activePlayers);
  const answerPlayerId = pickAnswerPlayerId(
    pastRounds,
    reject(activePlayers, { id: questionPlayerId }),
  );

  return {
    question: '',
    correctAnswerUnits: '',
    questionPlayerId,
    answerPlayerId,
    activeStage: HiLoRoundStage.AskQuestion,
    guesses: [],
  };
}

export function pickQuestionPlayerId(pastRounds: HiLoRound[], players: Player[]): string {
  return sample(
    getPlayerIdsThatHaveWaitedTheLongest(pastRounds, players, [
      'lastRoundPickedForQuestion',
      'lastRoundPickedForAnswer',
    ]),
  )!;
}

export function pickAnswerPlayerId(pastRounds: HiLoRound[], players: Player[]): string {
  return sample(
    getPlayerIdsThatHaveWaitedTheLongest(pastRounds, players, [
      'lastRoundPickedForAnswer',
      'lastRoundPickedForQuestion',
    ]),
  )!;
}

function getPlayerIdsThatHaveWaitedTheLongest(
  pastRounds: HiLoRound[],
  players: Player[],
  sortOrder: (keyof PlayerPicksInfo)[],
) {
  const sortedPlayerPicks = sortBy(getPlayerPicksInfo(pastRounds, players), sortOrder);
  const { lastRoundPickedForQuestion, lastRoundPickedForAnswer } = sortedPlayerPicks[0];
  return sortedPlayerPicks
    .filter(
      (player) =>
        player.lastRoundPickedForQuestion === lastRoundPickedForQuestion &&
        player.lastRoundPickedForAnswer === lastRoundPickedForAnswer,
    )
    .map((player) => player.id);
}

interface PlayerPicksInfo {
  id: string;
  lastRoundPickedForQuestion: number;
  lastRoundPickedForAnswer: number;
}

function lastRoundWhere(pastRounds: HiLoRound[], matches: (round: HiLoRound) => boolean): number {
  // Not lodash's `reverse`, which reverses the array in place.
  return Math.max(-1, ...pastRounds.filter(matches).map((round) => round.round));
}

function getPlayerPicksInfo(pastRounds: HiLoRound[], players: Player[]): PlayerPicksInfo[] {
  return players.map((player) => ({
    id: player.id,
    lastRoundPickedForQuestion: lastRoundWhere(
      pastRounds,
      (round) => round.data.questionPlayerId === player.id,
    ),
    lastRoundPickedForAnswer: lastRoundWhere(
      pastRounds,
      (round) => round.data.answerPlayerId === player.id,
    ),
  }));
}
