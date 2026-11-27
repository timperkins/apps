import { motion } from 'framer-motion';
import { useRoundCounter } from '../hooks';

/** Progress through the game along the top edge, and the screen title. */
export function RoundHeader({ title }: { title?: string }) {
  const { current, total } = useRoundCounter();
  const progress = total ? Math.min(1, current / total) : 0;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-[calc(0.375rem*var(--scale))] bg-primary z-10">
        <motion.div
          className="h-full bg-secondary"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <h1 className="pt-md pb-sm text-center text-md font-bold text-white">
        {title ?? `Round ${current} of ${total}`}
      </h1>
    </>
  );
}
