import { avatarConfigMap } from '@/components/PlayerChip';
import { useGetPlayerAvatar } from '@/lib/game/hooks';
import { Player } from '@/shared/types';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

function Speaker({ player }: { player?: Player }) {
  const getAvatar = useGetPlayerAvatar();
  const avatar = getAvatar(player);
  const Icon = avatar ? avatarConfigMap[avatar].Icon : undefined;
  return (
    <div className="flex items-center gap-xs mb-xxs">
      {Icon && <Icon className="w-md h-md shrink-0" />}
      <span className="text-sm font-bold">{player?.name}</span>
    </div>
  );
}

interface BubbleProps {
  player?: Player;
  children: ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

/** A chat bubble: the question (left) or the answer (right). */
export function Bubble({ player, children, side = 'left', className }: BubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={classNames(
        'bg-bubble text-bubble-text rounded-md px-sm py-xs max-w-[82%]',
        side === 'right' ? 'self-end text-right' : 'self-start',
        className,
      )}
    >
      {player && (
        <div className={classNames('flex', side === 'right' && 'justify-end')}>
          <Speaker player={player} />
        </div>
      )}
      {children}
    </motion.div>
  );
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function formatAnswer(value: number, units?: string): string {
  return units ? `${formatNumber(value)} ${units}` : formatNumber(value);
}
