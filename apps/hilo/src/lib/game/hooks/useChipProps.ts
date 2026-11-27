import { PlayerChipProps } from '@/components/PlayerChip';
import { Player } from '@/shared/types';
import { useCallback } from 'react';
import { useGetPlayerAvatar } from './useGetPlayerAvatar';
import { useIsPlayerActive } from './useIsPlayerActive';

/** Props for a PlayerChip showing this player: their avatar, and greyed out if they left. */
export function useChipProps() {
  const getAvatar = useGetPlayerAvatar();
  const isActive = useIsPlayerActive();
  return useCallback(
    (player?: Player): PlayerChipProps => ({
      player,
      avatar: getAvatar(player),
      away: !!player && !isActive(player),
    }),
    [getAvatar, isActive],
  );
}
