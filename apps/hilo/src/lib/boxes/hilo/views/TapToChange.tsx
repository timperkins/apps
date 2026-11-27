import { useLocalStorage } from '@/hooks/useLocalStorage';
import useWindowDimensions from '@/hooks/useWindowDimensions';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/** Shows a one-time "Tap to change" hint above the player's own chip. */
export const TapToChange = ({ children }: { children: React.ReactNode }) => {
  const { width, height } = useWindowDimensions();
  const minScreenDimension = width && height ? Math.min(width, height) : 0;
  const arrowWidth = minScreenDimension ? minScreenDimension * 0.035 : 20;
  const [ackTapToChangeTooltip, setAckTapToChangeTooltip] = useLocalStorage(
    'ackTapToChangeTooltip',
    false,
  );
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  useEffect(() => {
    if (ackTapToChangeTooltip) return;
    const timer = setTimeout(() => {
      setIsTooltipOpen(true);
      setAckTapToChangeTooltip(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [ackTapToChangeTooltip, setAckTapToChangeTooltip]);

  useEffect(() => {
    if (!isTooltipOpen) return;
    const close = () => setIsTooltipOpen(false);
    const timer = setTimeout(close, 6000);
    document.addEventListener('click', close);
    document.addEventListener('touchstart', close);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('touchstart', close);
    };
  }, [isTooltipOpen]);

  return (
    <Tooltip.Provider>
      <Tooltip.Root open={isTooltipOpen}>
        <Tooltip.Trigger asChild>
          <div className="flex">{children}</div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={5} side="top" align="start">
            <motion.div
              className="px-sm py-xs text-sm font-bold text-white bg-[#1C61D0] rounded-xs shadow-lg select-none"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                y: { repeat: Infinity, repeatType: 'reverse', duration: 0.8, ease: 'easeInOut' },
                opacity: { duration: 0.5 },
              }}
            >
              Tap to change
              <Tooltip.Arrow
                className="fill-[#1C61D0] translate-y-[-1px]"
                width={arrowWidth}
                height={arrowWidth / 2}
              />
            </motion.div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
