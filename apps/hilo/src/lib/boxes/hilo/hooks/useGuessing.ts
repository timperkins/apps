import { useActivePlayers, useCurrentRound, useNow, usePlayer } from '@/lib/game/hooks';

/** Guessing state for the current round. */
export function useGuessing() {
  const round = useCurrentRound();
  const activePlayers = useActivePlayers();
  const me = usePlayer();
  const now = useNow();

  const guesses = round?.data.guesses ?? [];
  const myGuess = guesses.find((guess) => guess.playerId === me?.id);
  const guessedIds = new Set(guesses.map((guess) => guess.playerId));
  const waitingFor = activePlayers.filter((player) => !guessedIds.has(player.id));

  const revealTime = round?.data.revealTime?.getTime();
  const secondsToReveal =
    revealTime === undefined ? undefined : Math.max(0, Math.ceil((revealTime - now) / 1000));

  return {
    guesses,
    myGuess,
    waitingFor,
    /** Undefined until everyone has guessed; then counts down to 0. */
    secondsToReveal,
    revealed: secondsToReveal === 0,
  };
}
