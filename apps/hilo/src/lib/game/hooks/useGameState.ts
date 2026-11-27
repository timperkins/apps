import { GameState } from '@/shared/types';
import { useGame } from './useGame';

export function useGameState(): GameState {
  const game = useGame();
  return game.state;
}
