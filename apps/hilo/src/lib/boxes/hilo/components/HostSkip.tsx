import Button from '@/components/Button';
import { useIsGameHost, useIsPlayerActive, useRoomCode } from '@/lib/game/hooks';
import { trpc } from '@/lib/trpc';
import { Player } from '@/shared/types';
import toast from 'react-hot-toast';

/**
 * Lets the host move the game on when the player whose turn it is has left (closed the page or lost
 * their connection).
 */
export function HostSkip({ player }: { player?: Player }) {
  const isGameHost = useIsGameHost();
  const isActive = useIsPlayerActive();
  const roomCode = useRoomCode();
  const skip = trpc.hilo.skipTurn.useMutation({
    onError: () => toast.error("Can't skip right now"),
  });

  if (!player || isActive(player) || !isGameHost()) return null;

  return (
    <div className="flex flex-col items-center gap-xs">
      <p className="text-sm text-gray-400">{player.name} seems to have left.</p>
      <Button
        variant="quiet"
        className="[&&]:py-xs [&&]:px-md"
        textClassName="[&&]:text-sm"
        disabled={skip.isPending}
        onClick={() => skip.mutate({ roomCode })}
      >
        Give the turn to someone else
      </Button>
    </div>
  );
}
