import Button from '@/components/Button';
import PlayerChip from '@/components/PlayerChip';
import { useChipProps, useGameHost, useIsGameHost, useRoomCode } from '@/lib/game/hooks';
import { trpc } from '@/lib/trpc';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStandings } from '../hooks';

function ordinalSuffix(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/** Ranked scores. `showRoundPoints` adds each player's points from the last round. */
export function ScoreTable({ showRoundPoints = true }: { showRoundPoints?: boolean }) {
  const standings = useStandings();
  const chipProps = useChipProps();

  return (
    <ol className="flex flex-col">
      {standings.map(({ player, total, lastRound, rank }, index) => (
        <motion.li
          key={player.id}
          layout
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={classNames(
            'grid items-center gap-xs px-sm py-xs',
            '[grid-template-columns:calc(2.5rem*var(--scale))_1fr_calc(3rem*var(--scale))_calc(3rem*var(--scale))]',
            index % 2 === 0 && 'bg-zone',
          )}
        >
          <span className="text-md font-black">
            {rank}
            <sup className="text-xs">{ordinalSuffix(rank)}</sup>
          </span>
          <span className="min-w-0">
            <PlayerChip {...chipProps(player)} />
          </span>
          <span className="text-md font-black text-right">{total}</span>
          <span className="text-md font-bold text-gray-400 text-right">
            {showRoundPoints && lastRound > 0 ? `+${lastRound}` : ''}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

export function Scoreboard() {
  const roomCode = useRoomCode();
  const host = useGameHost();
  const isGameHost = useIsGameHost();
  const nextRound = trpc.hilo.createNextRound.useMutation({
    onError: () => toast.error("Can't start the next round"),
  });

  return (
    <div className="min-h-dvh w-[var(--main-content-width)] mx-auto flex flex-col">
      <h1 className="px-sm pt-md pb-lg text-md font-bold">Scores</h1>
      <div className="flex-1">
        <ScoreTable />
      </div>
      <div className="flex flex-col items-end p-xs pb-sm">
        {isGameHost() ? (
          <Button
            variant="action"
            endIcon={<ArrowRight className="w-md h-md text-white" strokeWidth={3} />}
            disabled={nextRound.isPending}
            onClick={() => nextRound.mutate({ roomCode })}
          >
            Next round
          </Button>
        ) : (
          <p className="self-center text-sm text-gray-400">
            Waiting for {host?.name ?? 'the host'} to start the next round...
          </p>
        )}
      </div>
    </div>
  );
}
