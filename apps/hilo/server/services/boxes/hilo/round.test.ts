import { HiLoRoundData, HiLoRoundStage } from '@/shared/boxes/hilo/types';
import { GameBox, HiLoRound, Player } from '@/shared/types';
import * as lodash from 'lodash';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { buildHiLoRoundData } from './round';

vi.mock('lodash', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('lodash') & { default: typeof import('lodash') }
  >();
  const lodash = actual.default ?? actual;
  const sample = vi.fn(lodash.sample);
  return { ...lodash, default: { ...lodash, sample }, sample };
});

const mockSample = lodash.sample as unknown as Mock<(ids: string[]) => string>;

function player(id: string): Player {
  return { id, name: id, joinTime: new Date(), lastSeen: new Date() };
}

function round(n: number, data: Partial<HiLoRoundData>): HiLoRound {
  return {
    round: n,
    startTime: new Date(),
    gameBox: GameBox.HILO,
    data: {
      questionPlayerId: 'x',
      answerPlayerId: 'y',
      activeStage: HiLoRoundStage.Scoreboard,
      guesses: [],
      ...data,
    },
  };
}

describe('buildHiLoRoundData', () => {
  beforeEach(() => {
    mockSample.mockClear();
  });

  it('builds a round waiting for a question', () => {
    mockSample.mockReturnValueOnce('p1').mockReturnValueOnce('p2');
    expect(buildHiLoRoundData([], [player('p1'), player('p2')])).toEqual({
      question: '',
      correctAnswerUnits: '',
      questionPlayerId: 'p1',
      answerPlayerId: 'p2',
      activeStage: HiLoRoundStage.AskQuestion,
      guesses: [],
    });
  });

  it('needs at least two players', () => {
    expect(() => buildHiLoRoundData([], [player('p1')])).toThrow('Not enough active players');
  });

  it('never picks the asker as the answerer', () => {
    for (let i = 0; i < 20; i++) {
      const data = buildHiLoRoundData([], [player('p1'), player('p2')]);
      expect(data.questionPlayerId).not.toBe(data.answerPlayerId);
    }
  });

  it('picks the players who have waited longest', () => {
    const pastRounds = [
      round(1, { questionPlayerId: 'p1', answerPlayerId: 'p2' }),
      round(2, { questionPlayerId: 'p3', answerPlayerId: 'p4' }),
    ];
    const players = ['p1', 'p2', 'p3', 'p4', 'p5'].map(player);
    mockSample.mockReturnValueOnce('p5');

    buildHiLoRoundData(pastRounds, players);

    // p5 has never asked or answered.
    expect(mockSample).toHaveBeenNthCalledWith(1, ['p5']);
    // p1 and p3 have never answered; p1 asked longer ago than p3.
    expect(mockSample).toHaveBeenNthCalledWith(2, ['p1']);
  });

  it('gives everyone a turn to ask before anyone asks twice', () => {
    const players = ['a', 'b', 'c'].map(player);
    const rounds: HiLoRound[] = [];
    for (let n = 1; n <= 6; n++) {
      const data = buildHiLoRoundData(rounds, players);
      rounds.push(round(n, data));
    }
    const askers = rounds.map((r) => r.data.questionPlayerId);
    expect(new Set(askers.slice(0, 3)).size).toBe(3);
    expect(new Set(askers.slice(3, 6)).size).toBe(3);
  });
});
