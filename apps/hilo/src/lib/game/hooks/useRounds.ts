import { useAtomValue } from 'jotai';
import { roundsAtom } from '../atoms';

export function useRounds() {
  return useAtomValue(roundsAtom);
}
