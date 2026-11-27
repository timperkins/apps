import { getGameHost } from '@/shared/game';
import { useNow } from './useNow';
import { usePlayers } from './usePlayers';

export function useGameHost() {
  const players = usePlayers();
  const now = useNow();
  return getGameHost(players, now);
}
