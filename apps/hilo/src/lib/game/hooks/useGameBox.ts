import { GameBox } from '@/shared/types';
import { useGame } from './useGame';

export function useGameBox(): GameBox {
  const game = useGame();
  return game.box;
}
