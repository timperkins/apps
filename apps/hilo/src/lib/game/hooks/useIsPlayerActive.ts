import { isPlayerActive } from '@/shared/game';
import { Player } from '@/shared/types';
import { useCallback } from 'react';
import { useNow } from './useNow';

export function useIsPlayerActive() {
  const now = useNow();
  return useCallback((player?: Player) => !!player && isPlayerActive(player, now), [now]);
}
