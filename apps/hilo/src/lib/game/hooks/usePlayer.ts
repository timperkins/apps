import { useAuth } from '@/lib/firebase/auth';
import { usePlayers } from './usePlayers';

export function usePlayer() {
  const auth = useAuth();
  const playerId = auth?.currentUser?.uid ?? '';
  const players = usePlayers();
  return players.find((player) => player.id === playerId);
}
