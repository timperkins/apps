import Button from '@/components/Button';
import PlayerChip from '@/components/PlayerChip';
import {
  useChipProps,
  useCurrentRound,
  useGameHost,
  useIsGameHost,
  usePlayer,
  usePlayers,
  useRoomCode,
} from '@/lib/game/hooks';
import { trpc } from '@/lib/trpc';
import { answerAccuracy, correctDirection } from '@/shared/boxes/hilo/score';
import { POINTS_CLOSE_ANSWER, POINTS_EXACT_ANSWER } from '@/shared/boxes/hilo/config';
import { Direction } from '@/shared/boxes/hilo/types';
import { Player } from '@/shared/types';
import classNames from 'classnames';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Bubble, formatAnswer } from '../components/Bubbles';
import { RoundHeader } from '../components/RoundHeader';
import { Screen } from '../components/Screen';
import { useGuessing, useRoundRoles } from '../hooks';

type ZoneState = 'open' | 'correct' | 'wrong';

interface ZoneProps {
  direction: Direction;
  players: Player[];
  state: ZoneState;
  onGuess?: () => void;
  selected: boolean;
}

function Count({ value }: { value: number }) {
  return (
    <span className="absolute -top-xxs -left-xxs flex h-md min-w-md items-center justify-center rounded-full bg-white px-xxs text-xs font-black text-gray-900">
      {value}
    </span>
  );
}

/** A drop zone: the players who bet this way, with its button on the edge. */
function Zone({ direction, players, state, onGuess, selected }: ZoneProps) {
  const chipProps = useChipProps();
  const higher = direction === Direction.Higher;
  const Arrow = higher ? ArrowUp : ArrowDown;

  const button = (
    <motion.button
      type="button"
      onClick={onGuess}
      disabled={!onGuess}
      whileTap={onGuess ? { scale: 0.95 } : undefined}
      className={classNames(
        'relative flex items-center gap-sm rounded-md border-md px-md py-sm text-md font-black text-white transition-colors',
        state === 'correct' ? 'bg-primary' : state === 'wrong' ? 'bg-[#2d5568]' : 'bg-choice',
        state === 'wrong' || (!onGuess && !selected && state === 'open')
          ? 'border-transparent'
          : 'border-white',
        onGuess ? 'cursor-pointer' : 'cursor-default',
        state === 'wrong' && 'opacity-80',
      )}
    >
      {state !== 'open' && players.length > 0 && <Count value={players.length} />}
      {higher ? 'Higher' : 'Lower'}
      {state === 'open' && players.length > 0 ? ` (${players.length})` : ''}
      <Arrow className="w-md h-md" strokeWidth={3} />
    </motion.button>
  );

  return (
    <div className={classNames('relative flex flex-col', higher ? 'pb-lg' : 'pt-lg')}>
      <div
        className={classNames(
          'min-h-[calc(5.5rem*var(--scale))] rounded-md p-xs flex flex-wrap content-start gap-xs transition-colors duration-500',
          state === 'correct' ? 'bg-correct-zone' : state === 'wrong' ? 'bg-wrong-zone' : 'bg-zone',
          higher ? 'pb-lg' : 'pt-lg justify-end content-end',
        )}
      >
        {players.map((player) => (
          <PlayerChip key={player.id} {...chipProps(player)} layoutId={player.id} />
        ))}
      </div>
      <div className={classNames('absolute', higher ? 'bottom-0 right-0' : 'top-0 left-0')}>
        {button}
      </div>
    </div>
  );
}

function RevealNote() {
  const round = useCurrentRound();
  const { answerer } = useRoundRoles();
  if (!round) return null;
  const accuracy = answerAccuracy(round.data);
  const note =
    accuracy === 'exact'
      ? `${answerer?.name} got it exactly! +${POINTS_EXACT_ANSWER}`
      : accuracy === 'close'
        ? `${answerer?.name} was close! +${POINTS_CLOSE_ANSWER}`
        : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-md bg-bubble px-sm py-sm text-center text-bubble-text"
    >
      <p className="text-md font-bold">
        {round.data.correctAnswerExplanation ||
          `The answer is ${formatAnswer(round.data.correctAnswer ?? 0, round.data.correctAnswerUnits)}.`}
      </p>
      {note && <p className="mt-xxs text-sm font-bold text-primary">{note}</p>}
    </motion.div>
  );
}

export function MoreOrLess() {
  const round = useCurrentRound();
  const roomCode = useRoomCode();
  const players = usePlayers();
  const me = usePlayer();
  const host = useGameHost();
  const isGameHost = useIsGameHost();
  const chipProps = useChipProps();
  const { asker, answerer } = useRoundRoles();
  const { guesses, myGuess, waitingFor, secondsToReveal, revealed } = useGuessing();
  // Shown right away while the server records the guess.
  const [pendingGuess, setPendingGuess] = useState<Direction>();

  const guess = trpc.hilo.moreOrLessGuess.useMutation({
    onError: () => {
      toast.error("Can't submit your guess");
      setPendingGuess(undefined);
    },
  });
  const reveal = trpc.hilo.revealAnswer.useMutation({
    onError: () => toast.error("Can't reveal yet"),
  });
  const showScores = trpc.hilo.advanceToScoreboardStage.useMutation({
    onError: () => toast.error("Can't show the scores"),
  });

  if (!round) return null;
  const { data } = round;

  const myDirection = myGuess?.direction ?? pendingGuess;
  const canGuess = !!me && !myDirection && secondsToReveal === undefined;
  const makeGuess = (direction: Direction) => {
    if (!canGuess) return;
    setPendingGuess(direction);
    guess.mutate({ roomCode, direction });
  };

  const directionOf = (player: Player) =>
    guesses.find((g) => g.playerId === player.id)?.direction ??
    (player.id === me?.id ? pendingGuess : undefined);
  const inZone = (direction: Direction) =>
    players.filter((player) => directionOf(player) === direction);
  const undecided = waitingFor.filter((player) => !directionOf(player));

  const right = revealed ? correctDirection(data) : undefined;
  const zoneState = (direction: Direction): ZoneState =>
    !revealed ? 'open' : right === direction ? 'correct' : 'wrong';

  return (
    <Screen>
      <RoundHeader />
      <div className="flex flex-col gap-xs">
        <Bubble player={asker} className="text-md font-bold">
          {data.question}
        </Bubble>
        {data.playerAnswer !== undefined && (
          <Bubble player={answerer} side="right" className="text-lg font-black">
            {formatAnswer(data.playerAnswer, data.correctAnswerUnits)}
          </Bubble>
        )}
      </div>

      <LayoutGroup>
        <div className="flex flex-col gap-xs py-sm">
          <Zone
            direction={Direction.Higher}
            players={inZone(Direction.Higher)}
            state={zoneState(Direction.Higher)}
            selected={myDirection === Direction.Higher}
            onGuess={canGuess ? () => makeGuess(Direction.Higher) : undefined}
          />
          <div className="flex min-h-[calc(2.5rem*var(--scale))] flex-wrap items-center justify-center gap-xs">
            <AnimatePresence>
              {undecided.map((player) => (
                <PlayerChip key={player.id} {...chipProps(player)} layoutId={player.id} />
              ))}
            </AnimatePresence>
            {secondsToReveal !== undefined && !revealed && (
              <p className="text-md font-bold">Revealing in {secondsToReveal}...</p>
            )}
          </div>
          <Zone
            direction={Direction.Lower}
            players={inZone(Direction.Lower)}
            state={zoneState(Direction.Lower)}
            selected={myDirection === Direction.Lower}
            onGuess={canGuess ? () => makeGuess(Direction.Lower) : undefined}
          />
        </div>
      </LayoutGroup>

      <div className="flex flex-col gap-sm pb-sm">
        {canGuess && (
          <p className="text-center text-sm text-gray-300">
            Is the real answer higher or lower than {answerer?.name}&apos;s guess?
          </p>
        )}
        {!canGuess && secondsToReveal === undefined && undecided.length > 0 && (
          <p className="text-center text-sm text-gray-400">
            Waiting for {undecided.length === 1 ? undecided[0].name : `${undecided.length} players`}
            ...
          </p>
        )}
        {secondsToReveal === undefined &&
          isGameHost() &&
          guesses.length > 0 &&
          waitingFor.length > 0 && (
            <button
              type="button"
              className="self-center text-sm font-bold text-gray-400 underline cursor-pointer"
              disabled={reveal.isPending}
              onClick={() => reveal.mutate({ roomCode })}
            >
              Reveal now
            </button>
          )}
        {revealed && (
          <>
            <RevealNote />
            {isGameHost() ? (
              <Button
                variant="action"
                className="self-end"
                endIcon={<ArrowRight className="w-md h-md text-white" strokeWidth={3} />}
                disabled={showScores.isPending}
                onClick={() => showScores.mutate({ roomCode })}
              >
                Scores
              </Button>
            ) : (
              <p className="text-center text-sm text-gray-400">
                Waiting for {host?.name ?? 'the host'}...
              </p>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
