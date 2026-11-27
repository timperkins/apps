import { getGameDocument } from '@/lib/firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { gameAtom } from '../atoms';

export function useSubscribeToGame(roomCode: string, onMissing: () => void) {
  const setGame = useSetAtom(gameAtom);

  useEffect(() => {
    if (!roomCode) {
      setGame(null);
      return;
    }
    return onSnapshot(
      getGameDocument(roomCode),
      (doc) => {
        if (doc.exists()) {
          setGame(doc.data());
        } else {
          setGame(null);
          onMissing();
        }
      },
      (error) => {
        console.error('Error listening to game document:', error);
        onMissing();
      },
    );
  }, [roomCode, setGame, onMissing]);
}
