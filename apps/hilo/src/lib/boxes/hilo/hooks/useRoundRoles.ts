import { useCurrentRound, usePlayer, usePlayers } from '@/lib/game/hooks';

/** Who asks and who answers the current round, and whether that's me. */
export function useRoundRoles() {
  const round = useCurrentRound();
  const players = usePlayers();
  const me = usePlayer();
  const asker = players.find((player) => player.id === round?.data.questionPlayerId);
  const answerer = players.find((player) => player.id === round?.data.answerPlayerId);
  return {
    asker,
    answerer,
    isAsker: !!me && me.id === asker?.id,
    isAnswerer: !!me && me.id === answerer?.id,
  };
}
