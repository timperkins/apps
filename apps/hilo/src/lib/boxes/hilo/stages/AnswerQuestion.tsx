import PlayerChip from '@/components/PlayerChip';
import { useChipProps, useCurrentRound, useRoomCode } from '@/lib/game/hooks';
import { trpc } from '@/lib/trpc';
import { motion } from 'framer-motion';
import { ArrowUp, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Bubble } from '../components/Bubbles';
import { HostSkip } from '../components/HostSkip';
import { RoundHeader } from '../components/RoundHeader';
import { Screen } from '../components/Screen';
import { WaitingFor } from '../components/WaitingFor';
import { useRoundRoles } from '../hooks';

/** Accepts "1,200", "-3", "2.5". */
function parseAnswer(text: string): number | undefined {
  const cleaned = text.replace(/,/g, '').trim();
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function AnswerForm({ units }: { units?: string }) {
  const roomCode = useRoomCode();
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const answerQuestion = trpc.hilo.answerQuestion.useMutation({
    onError: () => toast.error("Can't send your answer"),
  });
  const value = parseAnswer(answer);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <form
      className="flex flex-col gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (value === undefined || answerQuestion.isPending) return;
        answerQuestion.mutate({ roomCode, answer: value });
      }}
    >
      <label htmlFor="answer" className="text-sm font-bold">
        What&apos;s your guess?
      </label>
      <div className="flex items-center gap-xs">
        <div className="relative flex-1">
          <input
            id="answer"
            ref={inputRef}
            inputMode="decimal"
            autoComplete="off"
            value={answer}
            onChange={(event) => setAnswer(event.target.value.replace(/[^\d.,-]/g, ''))}
            disabled={answerQuestion.isPending}
            placeholder="0"
            className="w-full rounded-md bg-surface-container py-sm pl-sm pr-xl text-lg font-black text-white placeholder:text-gray-600 focus:outline-none focus:ring-[length:var(--spacing-xxxs)] focus:ring-secondary"
          />
          {units && (
            <span className="pointer-events-none absolute right-sm top-1/2 -translate-y-1/2 text-md font-bold text-gray-400">
              {units}
            </span>
          )}
        </div>
        <button
          type="submit"
          aria-label="Send answer"
          disabled={value === undefined || answerQuestion.isPending}
          className="flex h-[calc(3.5rem*var(--scale))] w-[calc(3.5rem*var(--scale))] items-center justify-center rounded-full border-sm border-white bg-primary text-white cursor-pointer disabled:cursor-default disabled:opacity-40"
        >
          <ArrowUp className="w-md h-md" />
        </button>
      </div>
    </form>
  );
}

function AnswerFound() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto flex w-[80%] flex-col items-center gap-xs rounded-md bg-[#18301f] px-sm py-md"
    >
      <span className="flex h-lg w-lg items-center justify-center rounded-full border-[length:var(--spacing-xxxs)] border-secondary">
        <Check className="w-md h-md text-secondary" strokeWidth={3} />
      </span>
      <p className="text-md font-bold">Answer found!</p>
    </motion.div>
  );
}

export function AnswerQuestion() {
  const round = useCurrentRound();
  const { asker, answerer, isAsker, isAnswerer } = useRoundRoles();
  const chipProps = useChipProps();

  if (isAsker) {
    return (
      <Screen>
        <RoundHeader title="Ask a question" />
        <div className="flex-1 flex flex-col justify-center gap-xl pb-lg">
          <AnswerFound />
          <WaitingFor players={answerer ? [answerer] : []} />
          <HostSkip player={answerer} />
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <RoundHeader />
      <div className="flex-1 flex flex-col gap-lg pb-lg">
        <Bubble player={asker} className="text-md font-bold mt-sm">
          {round?.data.question}
        </Bubble>
        <div className="flex-1 flex flex-col justify-center gap-md">
          {isAnswerer ? (
            <AnswerForm units={round?.data.correctAnswerUnits} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-xs text-sm font-bold">
                <PlayerChip {...chipProps(answerer)} />
                <span>is answering...</span>
              </div>
              <HostSkip player={answerer} />
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
