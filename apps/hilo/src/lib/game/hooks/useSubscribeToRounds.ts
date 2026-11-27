import { getRoundsCollection } from '@/lib/firebase/firestore';
import { Round } from '@/shared/types';
import { onSnapshot } from 'firebase/firestore';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { roundsAtom } from '../atoms';

export function useSubscribeToRounds(roomCode: string) {
  const setRounds = useSetAtom(roundsAtom);

  useEffect(() => {
    if (!roomCode) {
      setRounds({});
      return;
    }
    return onSnapshot(
      getRoundsCollection(roomCode),
      (snapshot) => {
        const roundsData: Record<number, Round> = {};
        snapshot.forEach((doc) => {
          const round = doc.data();
          roundsData[round.round] = round;
        });
        setRounds(roundsData);
      },
      (error) => {
        console.error('Error listening to rounds collection:', error);
      },
    );
  }, [roomCode, setRounds]);
}
