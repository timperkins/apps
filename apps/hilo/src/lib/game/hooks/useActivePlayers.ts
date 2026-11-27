import { getActivePlayers } from '@/shared/game';
import { useNow } from './useNow';
import { usePlayers } from './usePlayers';

export function useActivePlayers() {
  const players = usePlayers();
  const now = useNow();
  return getActivePlayers(players, now);
}
