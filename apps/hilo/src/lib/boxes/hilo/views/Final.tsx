import Button from '@/components/Button';
import Frog from '@/components/Frog';
import { useGameHost, useIsGameHost, useRoomCode } from '@/lib/game/hooks';
import { trpc } from '@/lib/trpc';
import { motion } from 'framer-motion';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRedirectWhenNextGameCreated, useStandings } from '../hooks';
import { ScoreTable } from '../stages/Scoreboard';

function winnerText(names: string[]): string {
  if (names.length === 0) return 'Game over!';
  if (names.length === 1) return `${names[0]} wins!`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} tie!`;
}

export function Final() {
  const roomCode = useRoomCode();
  const host = useGameHost();
  const isGameHost = useIsGameHost();
  const standings = useStandings();
  const winners = standings.filter((s) => s.rank === 1 && s.total > 0).map((s) => s.player.name);
  const playAgain = trpc.game.createNextGame.useMutation({
    onError: () => toast.error("Can't start a new game"),
  });

  useRedirectWhenNextGameCreated();

  return (
    <div className="min-h-dvh w-[var(--main-content-width)] mx-auto flex flex-col">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.5 }}
        className="flex flex-col items-center gap-xs pt-lg pb-md"
      >
        <Frog className="w-[calc(6rem*var(--scale))] h-[calc(6rem*var(--scale))]" />
        <h1 className="text-lg font-black text-secondary text-center">{winnerText(winners)}</h1>
        <p className="text-sm text-gray-400">Final scores</p>
      </motion.div>
      <div className="flex-1">
        <ScoreTable showRoundPoints={false} />
      </div>
      <div className="flex flex-col items-center gap-sm p-xs pb-sm">
        {isGameHost() ? (
          <Button disabled={playAgain.isPending} onClick={() => playAgain.mutate({ roomCode })}>
            {playAgain.isPending ? 'Starting...' : 'Play again'}
          </Button>
        ) : (
          <p className="text-sm text-gray-400">
            Waiting for {host?.name ?? 'the host'} to start a new game...
          </p>
        )}
        <Link href="/" className="text-sm font-bold text-gray-400 underline">
          Leave game
        </Link>
      </div>
    </div>
  );
}
