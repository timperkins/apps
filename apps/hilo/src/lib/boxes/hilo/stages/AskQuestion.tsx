import PlayerChip from '@/components/PlayerChip';
import { useChipProps, useRoomCode } from '@/lib/game/hooks';
import { trpc } from '@/lib/trpc';
import { serverMessage } from '@/lib/trpc/errors';
import { QUESTION_MAX_LENGTH } from '@/shared/constants';
import { motion } from 'framer-motion';
import { ArrowUp, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { HostSkip } from '../components/HostSkip';
import { RoundHeader } from '../components/RoundHeader';
import { Screen } from '../components/Screen';
import { useRoundRoles } from '../hooks';

function AskForm() {
  const roomCode = useRoomCode();
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askQuestion = trpc.hilo.askQuestion.useMutation({
    onError: (error) => {
      toast.error(serverMessage(error) ?? "Couldn't find the answer. Try another question.", {
        duration: 5000,
      });
      inputRef.current?.focus();
    },
  });

  useEffect(() => inputRef.current?.focus(), []);

  const submit = () => {
    const trimmed = question.trim();
    if (!trimmed || askQuestion.isPending) return;
    askQuestion.mutate({ roomCode, question: trimmed });
  };

  return (
    <>
      <RoundHeader title="Ask a question" />
      <div className="flex-1 flex flex-col justify-center gap-sm pb-xl">
        <p className="flex items-center gap-xs text-sm font-bold">
          <Info className="w-md h-md text-action shrink-0" />
          <span>
            Ask something you don&apos;t know. The answer must be a{' '}
            <span className="underline">number</span>!
          </span>
        </p>
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={inputRef}
            value={question}
            maxLength={QUESTION_MAX_LENGTH}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={askQuestion.isPending}
            placeholder="How far is it from Seattle to San Francisco?"
            rows={4}
            className="w-full resize-none rounded-md bg-surface-container p-sm pr-xl text-md font-bold text-white placeholder:text-gray-600 focus:outline-none focus:ring-[length:var(--spacing-xxxs)] focus:ring-secondary disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={!question.trim() || askQuestion.isPending}
            className="absolute right-xs bottom-sm flex h-lg w-lg items-center justify-center rounded-full border-sm border-white bg-gray-500 text-white transition-colors enabled:bg-primary enabled:cursor-pointer disabled:opacity-50"
          >
            <ArrowUp className="w-md h-md" />
          </button>
        </form>
      </div>
      {askQuestion.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-sm left-1/2 -translate-x-1/2 w-[calc(var(--main-content-width)-var(--spacing-xs))] flex items-center gap-sm rounded-md bg-white px-sm py-sm text-sm font-bold text-gray-900"
        >
          <span className="h-md w-md shrink-0 animate-spin rounded-full border-[length:var(--spacing-xxxs)] border-primary border-t-transparent" />
          Finding the answer...
        </motion.div>
      )}
    </>
  );
}

export function AskQuestion() {
  const { asker, isAsker } = useRoundRoles();
  const chipProps = useChipProps();

  return (
    <Screen>
      {isAsker ? (
        <AskForm />
      ) : (
        <>
          <RoundHeader />
          <div className="flex-1 flex flex-col items-center justify-center gap-lg pb-xl">
            <div className="flex flex-wrap items-center justify-center gap-xs text-sm font-bold">
              <PlayerChip {...chipProps(asker)} />
              <span>is asking a question...</span>
            </div>
            <HostSkip player={asker} />
          </div>
        </>
      )}
    </Screen>
  );
}
