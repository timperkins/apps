import 'server-only';
import { errors } from '@/server/errors';
import { collections, db, newExpiresAt } from '@/server/services/firebase/firestore';
import { REVEAL_DELAY_MS } from '@/shared/boxes/hilo/config';
import { Direction, HiLoRoundData, HiLoRoundStage, HiLoSecret } from '@/shared/boxes/hilo/types';
import { getActivePlayers, getGameHost, isPlayerActive } from '@/shared/game';
import { Game, GameBox, GameState, HiLoRound, isHiLoRound, Player } from '@/shared/types';
import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import { reject } from 'lodash';
import { buildHiLoRoundData, pickAnswerPlayerId } from './round';

interface RoundContext {
  transaction: Transaction;
  game: Game;
  players: Player[];
  rounds: HiLoRound[];
  current: HiLoRound;
  player: Player;
  /** Server time in ms. */
  now: number;
  isHost: boolean;
  /** Writes new data for the current round. */
  updateRound: (data: Partial<HiLoRoundData>) => void;
}

/**
 * Runs `fn` in a transaction with the game, its players and rounds loaded. The caller must be a
 * player in the game and the game must be in progress.
 */
async function withCurrentRound<T>(
  roomCode: string,
  playerId: string,
  fn: (context: RoundContext) => Promise<T> | T,
): Promise<T> {
  return db.runTransaction(async (transaction) => {
    const [gameDoc, playersSnapshot, roundsSnapshot] = await Promise.all([
      transaction.get(collections.games.doc(roomCode)),
      transaction.get(collections.players(roomCode)),
      transaction.get(collections.rounds(roomCode)),
    ]);
    const game = gameDoc.data();
    if (!game) throw errors.gameNotFound();
    if (game.state !== GameState.IN_PROGRESS) throw errors.wrongStage('Game is not in progress');

    const players = playersSnapshot.docs.map((doc) => doc.data());
    const player = players.find((p) => p.id === playerId);
    if (!player) throw errors.notAllowed('Not a player in this game');

    const rounds = roundsSnapshot.docs
      .map((doc) => doc.data())
      .filter(isHiLoRound)
      .sort((a, b) => a.round - b.round);
    const current = rounds[rounds.length - 1];
    if (!current) throw errors.roundNotFound();

    const now = Date.now();
    const roundRef = collections.rounds(roomCode).doc(String(current.round));
    return fn({
      transaction,
      game,
      players,
      rounds,
      current,
      player,
      now,
      isHost: getGameHost(players, now)?.id === playerId,
      updateRound: (data) => {
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) updates[`data.${key}`] = value;
        transaction.update(roundRef, updates);
      },
    });
  });
}

function revealUpdate(secret: HiLoSecret | undefined, now: number): Partial<HiLoRoundData> {
  if (!secret) throw new Error('Missing answer for round');
  return {
    correctAnswer: secret.correctAnswer,
    correctAnswerExplanation: secret.correctAnswerExplanation,
    revealTime: Timestamp.fromMillis(now + REVEAL_DELAY_MS) as unknown as Date,
  };
}

/** Checks the caller is the question asker and the round is waiting for a question. */
export async function assertCanAskQuestion(roomCode: string, playerId: string): Promise<number> {
  return withCurrentRound(roomCode, playerId, ({ current }) => {
    if (current.data.questionPlayerId !== playerId) {
      throw errors.notAllowed('You are not asking the question this round');
    }
    if (current.data.activeStage !== HiLoRoundStage.AskQuestion) {
      throw errors.wrongStage('The question was already asked');
    }
    return current.round;
  });
}

export async function updateRoundWithQuestion({
  roomCode,
  playerId,
  roundNumber,
  question,
  correctAnswer,
  correctAnswerUnits,
  correctAnswerExplanation,
}: {
  roomCode: string;
  playerId: string;
  roundNumber: number;
  question: string;
  correctAnswer: number;
  correctAnswerUnits: string;
  correctAnswerExplanation: string;
}): Promise<void> {
  await withCurrentRound(roomCode, playerId, ({ transaction, current, updateRound }) => {
    // The round may have moved on (e.g. the host skipped) while Gemini was answering.
    if (
      current.round !== roundNumber ||
      current.data.questionPlayerId !== playerId ||
      current.data.activeStage !== HiLoRoundStage.AskQuestion
    ) {
      throw errors.wrongStage('The round moved on');
    }
    transaction.set(collections.secrets(roomCode).doc(String(roundNumber)), {
      correctAnswer,
      correctAnswerExplanation,
      expiresAt: newExpiresAt(),
    } as HiLoSecret);
    updateRound({
      question,
      correctAnswerUnits,
      activeStage: HiLoRoundStage.AnswerQuestion,
    });
  });
}

export async function updateRoundWithPlayerAnswer({
  roomCode,
  playerId,
  playerAnswer,
}: {
  roomCode: string;
  playerId: string;
  playerAnswer: number;
}): Promise<void> {
  await withCurrentRound(roomCode, playerId, ({ current, updateRound }) => {
    if (current.data.answerPlayerId !== playerId) {
      throw errors.notAllowed('You are not answering this round');
    }
    if (current.data.activeStage !== HiLoRoundStage.AnswerQuestion) {
      throw errors.wrongStage('Round is not waiting for an answer');
    }
    updateRound({ playerAnswer, activeStage: HiLoRoundStage.MoreOrLess });
  });
}

/**
 * Records a higher/lower guess. Everyone guesses, including the asker and the answerer. Once every
 * player who is here has guessed, the answer is revealed.
 */
export async function updateRoundWithMoreOrLessGuess({
  roomCode,
  playerId,
  direction,
}: {
  roomCode: string;
  playerId: string;
  direction: Direction;
}): Promise<void> {
  const secretRefFor = (round: number) => collections.secrets(roomCode).doc(String(round));
  await withCurrentRound(
    roomCode,
    playerId,
    async ({ transaction, current, players, now, updateRound }) => {
      if (current.data.activeStage !== HiLoRoundStage.MoreOrLess || current.data.revealTime) {
        throw errors.wrongStage('Guessing is closed');
      }
      if (current.data.guesses.some((guess) => guess.playerId === playerId)) {
        throw errors.wrongStage('You already guessed');
      }
      const secret = (await transaction.get(secretRefFor(current.round))).data();

      const guesses = [...current.data.guesses, { playerId, direction }];
      const guessed = new Set(guesses.map((guess) => guess.playerId));
      const waitingFor = getActivePlayers(players, now).filter((p) => !guessed.has(p.id));

      updateRound({
        guesses,
        lastGuessTime: FieldValue.serverTimestamp() as unknown as Date,
        ...(waitingFor.length === 0 ? revealUpdate(secret, now) : {}),
      });
    },
  );
}

/** Host: shows the answer without waiting for the remaining guesses. */
export async function revealAnswer(roomCode: string, playerId: string): Promise<void> {
  await withCurrentRound(
    roomCode,
    playerId,
    async ({ transaction, current, isHost, now, updateRound }) => {
      if (!isHost) throw errors.onlyHost();
      if (current.data.activeStage !== HiLoRoundStage.MoreOrLess || current.data.revealTime) {
        throw errors.wrongStage('Nothing to reveal');
      }
      const secret = (
        await transaction.get(collections.secrets(roomCode).doc(String(current.round)))
      ).data();
      updateRound(revealUpdate(secret, now));
    },
  );
}

/** Host: moves from the revealed answer to the scores. Ends the game after the last round. */
export async function updateRoundToScoreboardStage(
  roomCode: string,
  playerId: string,
): Promise<void> {
  await withCurrentRound(
    roomCode,
    playerId,
    ({ transaction, game, rounds, current, isHost, now, updateRound }) => {
      if (!isHost) throw errors.onlyHost();
      if (current.data.activeStage !== HiLoRoundStage.MoreOrLess || !current.data.revealTime) {
        throw errors.wrongStage('The answer has not been revealed');
      }
      if (current.data.revealTime.getTime() > now) {
        throw errors.wrongStage('The answer is still being revealed');
      }
      updateRound({ activeStage: HiLoRoundStage.Scoreboard });
      transaction.update(collections.rounds(roomCode).doc(String(current.round)), {
        endTime: FieldValue.serverTimestamp(),
      });
      if (rounds.length >= (game.totalRounds ?? rounds.length)) {
        transaction.update(collections.games.doc(roomCode), { state: GameState.ENDED });
      }
    },
  );
}

/** Host: starts the next round from the scoreboard. */
export async function createNextRound(roomCode: string, playerId: string): Promise<void> {
  await withCurrentRound(
    roomCode,
    playerId,
    ({ transaction, game, players, rounds, current, isHost, now }) => {
      if (!isHost) throw errors.onlyHost();
      if (current.data.activeStage !== HiLoRoundStage.Scoreboard) {
        throw errors.wrongStage('The current round is not over');
      }
      if (rounds.length >= (game.totalRounds ?? 0)) {
        throw errors.wrongStage('No more rounds remaining');
      }
      const nextRound = current.round + 1;
      transaction.create(collections.rounds(roomCode).doc(String(nextRound)), {
        round: nextRound,
        gameBox: GameBox.HILO,
        startTime: FieldValue.serverTimestamp(),
        data: buildHiLoRoundData(rounds, getActivePlayers(players, now)),
        expiresAt: newExpiresAt(),
      } as unknown as HiLoRound);
    },
  );
}

/**
 * Host: when the asker or answerer has left, hands their turn to someone who is here, so the game
 * doesn't get stuck.
 */
export async function skipTurn(roomCode: string, playerId: string): Promise<void> {
  await withCurrentRound(
    roomCode,
    playerId,
    ({ players, rounds, current, isHost, now, updateRound }) => {
      if (!isHost) throw errors.onlyHost();
      const pastRounds = rounds.filter((round) => round.round !== current.round);
      const active = getActivePlayers(players, now);
      const { data } = current;

      if (data.activeStage === HiLoRoundStage.AskQuestion) {
        const asker = players.find((p) => p.id === data.questionPlayerId);
        if (asker && isPlayerActive(asker, now)) throw errors.wrongStage('The asker is still here');
        const candidates = reject(active, { id: data.questionPlayerId });
        const fresh = buildHiLoRoundData(pastRounds, candidates);
        updateRound({
          questionPlayerId: fresh.questionPlayerId,
          answerPlayerId: fresh.answerPlayerId,
        });
        return;
      }

      if (data.activeStage === HiLoRoundStage.AnswerQuestion) {
        const answerer = players.find((p) => p.id === data.answerPlayerId);
        if (answerer && isPlayerActive(answerer, now)) {
          throw errors.wrongStage('The answerer is still here');
        }
        const candidates = active.filter(
          (p) => p.id !== data.answerPlayerId && p.id !== data.questionPlayerId,
        );
        if (candidates.length === 0) throw errors.wrongStage('Nobody else can answer');
        updateRound({ answerPlayerId: pickAnswerPlayerId(pastRounds, candidates) });
        return;
      }

      throw errors.wrongStage('Nothing to skip');
    },
  );
}
