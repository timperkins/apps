import { HiLoRound, isHiLoRound } from '@/shared/types';
import { useRounds } from './useRounds';

/** The latest round, or undefined before the game starts. */
export function useCurrentRound(): HiLoRound | undefined {
  const rounds = Object.values(useRounds()).filter(isHiLoRound);
  return rounds.reduce<HiLoRound | undefined>(
    (latest, round) => (!latest || round.round > latest.round ? round : latest),
    undefined,
  );
}
