import { Player, PlayerAvatarType } from '@/shared/types';
import { useCallback } from 'react';
import { useGame } from './useGame';

export function useGetPlayerAvatar() {
  const playerAvatars = useGame().playerAvatars;
  return useCallback(
    (player?: Player): PlayerAvatarType | undefined =>
      player ? playerAvatars[player.id] : undefined,
    [playerAvatars],
  );
}
