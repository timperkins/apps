import Bat from '@/assets/svg/animals/bat.svg';
import Camel from '@/assets/svg/animals/camel.svg';
import Crab from '@/assets/svg/animals/crab.svg';
import Duck from '@/assets/svg/animals/duck.svg';
import Elephant from '@/assets/svg/animals/elephant.svg';
import Elk from '@/assets/svg/animals/elk.svg';
import Fish from '@/assets/svg/animals/fish.svg';
import Kangaroo from '@/assets/svg/animals/kangaroo.svg';
import Rhino from '@/assets/svg/animals/rhino.svg';
import Rooster from '@/assets/svg/animals/rooster.svg';
import Tiger from '@/assets/svg/animals/tiger.svg';
import { Player, PlayerAvatarType } from '@/shared/types';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { ComponentType, CSSProperties, forwardRef, SVGProps } from 'react';

interface AvatarConfig {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  backgroundColor: string;
  textColor: string;
}

export const avatarConfigMap: Record<PlayerAvatarType, AvatarConfig> = {
  [PlayerAvatarType.Duck]: { Icon: Duck, backgroundColor: '#E57373', textColor: '#461A1A' },
  [PlayerAvatarType.Fish]: { Icon: Fish, backgroundColor: '#FFB74D', textColor: '#4D2C00' },
  [PlayerAvatarType.Kangaroo]: { Icon: Kangaroo, backgroundColor: '#FDD835', textColor: '#443602' },
  [PlayerAvatarType.Bat]: { Icon: Bat, backgroundColor: '#4DB6AC', textColor: '#083631' },
  [PlayerAvatarType.Elk]: { Icon: Elk, backgroundColor: '#4DD0E1', textColor: '#003940' },
  [PlayerAvatarType.Crab]: { Icon: Crab, backgroundColor: '#90A4AE', textColor: '#1C272B' },
  [PlayerAvatarType.Tiger]: { Icon: Tiger, backgroundColor: '#64B5F6', textColor: '#0D2E4D' },
  [PlayerAvatarType.Rhino]: { Icon: Rhino, backgroundColor: '#7986CB', textColor: '#1F2442' },
  [PlayerAvatarType.Elephant]: { Icon: Elephant, backgroundColor: '#BA68C8', textColor: '#37143D' },
  [PlayerAvatarType.Rooster]: { Icon: Rooster, backgroundColor: '#F06292', textColor: '#471226' },
  [PlayerAvatarType.Camel]: { Icon: Camel, backgroundColor: '#A1887F', textColor: '#30221E' },
};

export interface PlayerChipProps {
  player?: Player;
  avatar?: PlayerAvatarType;
  /** Small label after the name, e.g. "HOST". */
  tag?: string;
  /** Greys the chip out (player has left). */
  away?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** framer-motion layoutId, so the chip animates between places (e.g. into a guess zone). */
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** A player's animal and name. With no player, an empty slot. */
const PlayerChip = forwardRef<HTMLButtonElement, PlayerChipProps>(function PlayerChip(
  { player, avatar, tag, away, onClick, disabled, layoutId, className, size = 'md' },
  ref,
) {
  const config = avatar ? avatarConfigMap[avatar] : undefined;
  const isEmpty = !player;
  const Icon = config?.Icon;

  return (
    <motion.button
      ref={ref}
      type="button"
      layout={layoutId ? 'position' : undefined}
      layoutId={layoutId}
      onClick={onClick}
      disabled={disabled || !onClick}
      title={away ? `${player?.name} has left` : undefined}
      style={
        {
          backgroundColor: config?.backgroundColor ?? 'rgba(255, 255, 255, 0.08)',
          '--chip-text': config?.textColor ?? 'transparent',
        } as CSSProperties
      }
      className={classNames(
        'inline-flex items-center rounded-md shrink-0 max-w-full select-none',
        size === 'md' ? 'gap-xs py-xxs pl-xs pr-sm' : 'gap-xxs py-xxxs pl-xxs pr-xs',
        onClick && !disabled
          ? 'cursor-pointer active:scale-95 transition-transform'
          : 'cursor-default',
        { 'opacity-40 grayscale': away },
        className,
      )}
    >
      <span
        className={classNames('flex shrink-0', size === 'md' ? 'w-lg h-lg' : 'w-md h-md', {
          'opacity-0': isEmpty || !Icon,
        })}
      >
        {Icon && <Icon className="w-full h-full" />}
      </span>
      <span
        className={classNames(
          'font-bold truncate text-[var(--chip-text)]',
          size === 'md' ? 'text-sm' : 'text-xs',
        )}
      >
        {/* The dots give an empty slot the width of a name. */}
        {player?.name ?? '............'}
      </span>
      {tag && (
        <span className="text-[calc(0.55rem*var(--scale))] font-black tracking-wide text-[var(--chip-text)] opacity-70">
          {tag}
        </span>
      )}
    </motion.button>
  );
});

export default PlayerChip;
