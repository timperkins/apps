import { Player } from '@/shared/types';
import { useAtomValue } from 'jotai';
import { playersAtom } from '../atoms';

export function usePlayers(): Player[] {
  return useAtomValue(playersAtom);
}
