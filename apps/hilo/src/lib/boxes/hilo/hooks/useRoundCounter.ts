import { useGame, useRounds } from '@/lib/game/hooks';

export function useRoundCounter() {
  const game = useGame();
  const current = Object.keys(useRounds()).length;
  const total = Math.max(game.totalRounds ?? current, current);
  return { current, total, isLastRound: current >= total };
}
