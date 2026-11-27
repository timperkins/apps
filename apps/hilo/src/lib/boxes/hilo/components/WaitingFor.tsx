import PlayerChip from '@/components/PlayerChip';
import { useChipProps } from '@/lib/game/hooks';
import { Player } from '@/shared/types';

const MAX_CHIPS = 3;

/** "Waiting for..." and the players still to act. */
export function WaitingFor({
  players,
  label = 'Waiting for...',
}: {
  players: Player[];
  label?: string;
}) {
  const chipProps = useChipProps();
  if (players.length === 0) return null;

  const shown = players.length > MAX_CHIPS ? players.slice(0, MAX_CHIPS - 1) : players;
  const more = players.length - shown.length;

  return (
    <div className="flex flex-col items-center gap-xs">
      <p className="text-sm font-bold">{label}</p>
      <div className="flex flex-wrap justify-center gap-xs">
        {shown.map((player) => (
          <PlayerChip key={player.id} {...chipProps(player)} />
        ))}
        {more > 0 && (
          <span className="inline-flex items-center rounded-md bg-gray-300 px-sm text-sm font-black text-gray-800">
            +{more}
          </span>
        )}
      </div>
    </div>
  );
}
