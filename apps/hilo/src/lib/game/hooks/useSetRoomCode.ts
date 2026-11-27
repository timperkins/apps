import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { roomCodeAtom } from '../atoms';

export function useSetRoomCode(roomCode: string) {
  const setRoomCode = useSetAtom(roomCodeAtom);

  useEffect(() => {
    setRoomCode(roomCode);
    return () => {
      setRoomCode('');
    };
  }, [roomCode, setRoomCode]);
}
