import { usePlayers, useRounds } from '@/lib/game/hooks';
import { standings } from '@/shared/boxes/hilo/score';
import { isHiLoRound, Player } from '@/shared/types';
import { useMemo } from 'react';

export interface Standing {
  player: Player;
  total: number;
  lastRound: number;
  rank: number;
}

export function useStandings(): Standing[] {
  const rounds = useRounds();
  const players = usePlayers();
  return useMemo(() => {
    const hiloRounds = Object.values(rounds).filter(isHiLoRound);
    return standings(
      hiloRounds,
      players.map((player) => player.id),
    ).map(({ playerId, ...rest }) => ({
      ...rest,
      player: players.find((player) => player.id === playerId)!,
    }));
  }, [rounds, players]);
}
