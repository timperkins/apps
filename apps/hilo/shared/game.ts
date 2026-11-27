import { PLAYER_ACTIVE_TIMEOUT_MS } from './constants';
import { Player } from './types';

/** Whether the player has sent a heartbeat recently. `now` is in server time (ms). */
export function isPlayerActive(player: Player, now: number): boolean {
  if (!player.lastSeen) return false;
  return now - player.lastSeen.getTime() < PLAYER_ACTIVE_TIMEOUT_MS;
}

export function getActivePlayers(players: Player[], now: number): Player[] {
  return players.filter((player) => isPlayerActive(player, now));
}

function byJoinTime(a: Player, b: Player) {
  return a.joinTime.getTime() - b.joinTime.getTime();
}

/**
 * The player who runs the game: the player who created it while they are here, otherwise the
 * earliest-joined player who is still here, so the game never gets stuck when the host leaves.
 */
export function getGameHost(players: Player[], now: number): Player | undefined {
  const creator = players.find((player) => player.isHost);
  if (creator && isPlayerActive(creator, now)) return creator;
  const active = getActivePlayers(players, now).sort(byJoinTime);
  return active[0] ?? creator;
}

export function arePlayersEqual(player1: Player, player2: Player): boolean {
  return player1.id === player2.id;
}
