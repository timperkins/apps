import { useGame } from '@/lib/game/hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Takes everyone to the new game when the host starts one. */
export function useRedirectWhenNextGameCreated() {
  const { nextGameRoomCode } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (nextGameRoomCode) router.push(`/games/${nextGameRoomCode}`);
  }, [nextGameRoomCode, router]);
}
