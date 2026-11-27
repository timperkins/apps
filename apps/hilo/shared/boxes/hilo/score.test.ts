import { GameBox, HiLoRound } from '@/shared/types';
import { describe, expect, it } from 'vitest';
import { totalRoundsForPlayers } from './round';
import { answerAccuracy, correctDirection, scoreRound, standings } from './score';
import { Direction, HiLoRoundData, HiLoRoundStage } from './types';

function data(overrides: Partial<HiLoRoundData>): HiLoRoundData {
  return {
    questionPlayerId: 'asker',
    answerPlayerId: 'answerer',
    activeStage: HiLoRoundStage.MoreOrLess,
    guesses: [],
    playerAnswer: 500,
    correctAnswer: 808,
    revealTime: new Date(),
    ...overrides,
  };
}

describe('scoring', () => {
  it('finds the right direction', () => {
    expect(correctDirection(data({}))).toBe(Direction.Higher);
    expect(correctDirection(data({ correctAnswer: 100 }))).toBe(Direction.Lower);
    expect(correctDirection(data({ correctAnswer: 500 }))).toBeNull();
    expect(correctDirection(data({ correctAnswer: undefined }))).toBeUndefined();
  });

  it('treats 0 as a real answer', () => {
    expect(correctDirection(data({ playerAnswer: 0, correctAnswer: 3 }))).toBe(Direction.Higher);
    expect(answerAccuracy(data({ playerAnswer: 0, correctAnswer: 0 }))).toBe('exact');
  });

  it('gives 10 points per right guess', () => {
    const scores = scoreRound(
      data({
        guesses: [
          { playerId: 'a', direction: Direction.Higher },
          { playerId: 'b', direction: Direction.Lower },
          { playerId: 'answerer', direction: Direction.Higher },
        ],
      }),
    );
    expect(scores).toEqual({ a: 10, answerer: 10 });
  });

  it('gives the answerer a bonus for a close or exact answer', () => {
    expect(scoreRound(data({ playerAnswer: 780 }))).toEqual({ answerer: 10 });
    expect(scoreRound(data({ playerAnswer: 808 }))).toEqual({ answerer: 20 });
    expect(scoreRound(data({ playerAnswer: 600 }))).toEqual({});
  });

  it('scores nothing before the reveal', () => {
    expect(
      scoreRound(
        data({ revealTime: undefined, guesses: [{ playerId: 'a', direction: Direction.Higher }] }),
      ),
    ).toEqual({});
  });

  it('ranks players and shares ranks on ties', () => {
    const round = (n: number, d: Partial<HiLoRoundData>): HiLoRound => ({
      round: n,
      startTime: new Date(),
      gameBox: GameBox.HILO,
      data: data(d),
    });
    const rounds = [
      round(1, { guesses: [{ playerId: 'a', direction: Direction.Higher }] }),
      round(2, {
        guesses: [
          { playerId: 'a', direction: Direction.Higher },
          { playerId: 'b', direction: Direction.Higher },
        ],
      }),
      round(3, { revealTime: undefined }),
    ];
    expect(standings(rounds, ['a', 'b', 'c'])).toEqual([
      { playerId: 'a', total: 20, lastRound: 10, rank: 1 },
      { playerId: 'b', total: 10, lastRound: 10, rank: 2 },
      { playerId: 'c', total: 0, lastRound: 0, rank: 3 },
    ]);
    expect(standings([], ['a', 'b']).map((s) => s.rank)).toEqual([1, 1]);
  });

  it('picks a game length that fits the group', () => {
    expect(totalRoundsForPlayers(2)).toBe(4);
    expect(totalRoundsForPlayers(4)).toBe(8);
    expect(totalRoundsForPlayers(6)).toBe(8);
    expect(totalRoundsForPlayers(8)).toBe(8);
  });
});
