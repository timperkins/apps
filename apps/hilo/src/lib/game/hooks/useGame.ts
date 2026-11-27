import { Game } from '@/shared/types';
import { useAtomValue } from 'jotai';
import { gameAtom } from '../atoms';

export function useGame(): Game {
  const game = useAtomValue(gameAtom);

  if (!game) {
    throw new Error('`useGame` hook used before the game was loaded');
  }

  return game;
}
