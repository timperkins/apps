import { MAX_ROUNDS, NUM_ROUNDS_PER_ACTIVE_PLAYER } from './config';

/**
 * Rounds in a game with this many players: everyone asks at least once, and twice when there are
 * few enough players to keep the game short.
 */
export function totalRoundsForPlayers(numActivePlayers: number): number {
  return Math.max(
    numActivePlayers,
    Math.min(numActivePlayers * NUM_ROUNDS_PER_ACTIVE_PLAYER, MAX_ROUNDS),
  );
}
