import { useAtomValue, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { gameAtom, playersAtom, roundsAtom } from './atoms';
import { GameSwitch } from './GameSwitch';
import { useClock, usePresence } from './hooks/usePresence';
import { useSetRoomCode } from './hooks/useSetRoomCode';
import { useSubscribeToGame } from './hooks/useSubscribeToGame';
import { useSubscribeToPlayers } from './hooks/useSubscribeToPlayers';
import { useSubscribeToRounds } from './hooks/useSubscribeToRounds';

export function GameProvider({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const setGame = useSetAtom(gameAtom);
  const setPlayers = useSetAtom(playersAtom);
  const setRounds = useSetAtom(roundsAtom);
  const game = useAtomValue(gameAtom);

  const onPlayersLoaded = useCallback(() => setPlayersLoaded(true), []);
  const onGameMissing = useCallback(() => {
    toast.error('That game has ended');
    router.replace('/');
  }, [router]);

  useSetRoomCode(roomCode);
  usePresence(roomCode);
  useClock();
  useSubscribeToPlayers(roomCode, onPlayersLoaded);
  useSubscribeToGame(roomCode, onGameMissing);
  useSubscribeToRounds(roomCode);

  // Clear the previous game's data when moving to a new room (e.g. "Play again").
  useEffect(() => {
    return () => {
      setGame(null);
      setPlayers([]);
      setRounds({});
    };
  }, [roomCode, setGame, setPlayers, setRounds]);

  return game && playersLoaded ? <GameSwitch /> : null;
}
