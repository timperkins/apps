import { arePlayersEqual } from '@/shared/game';
import { Player } from '@/shared/types';
import { useCallback } from 'react';
import { useGameHost } from './useGameHost';
import { usePlayer } from './usePlayer';

export function useIsGameHost() {
  const host = useGameHost();
  const currentPlayer = usePlayer();

  return useCallback(
    (player?: Player) => {
      const playerToCheck = player ?? currentPlayer;
      if (!host || !playerToCheck) return false;
      return arePlayersEqual(host, playerToCheck);
    },
    [host, currentPlayer],
  );
}
