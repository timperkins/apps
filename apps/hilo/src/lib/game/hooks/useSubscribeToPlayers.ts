import { useAuth } from '@/lib/firebase';
import { getPlayersCollection } from '@/lib/firebase/firestore';
import { Player } from '@/shared/types';
import { onSnapshot } from 'firebase/firestore';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { playersAtom, serverOffsetMsAtom } from '../atoms';

export function useSubscribeToPlayers(roomCode: string, onLoaded: () => void) {
  const setPlayers = useSetAtom(playersAtom);
  const setOffset = useSetAtom(serverOffsetMsAtom);
  const auth = useAuth();
  const playerId = auth.currentUser?.uid;

  useEffect(() => {
    if (!roomCode) {
      setPlayers([]);
      return;
    }

    let lastOwnHeartbeat = 0;
    return onSnapshot(
      getPlayersCollection(roomCode),
      { includeMetadataChanges: true },
      (snapshot) => {
        const playersData: Player[] = [];
        snapshot.forEach((doc) => {
          const player = doc.data();
          playersData.push(player);

          // Our own confirmed heartbeat is a fresh server timestamp: use it to learn the
          // difference between this device's clock and the server's.
          const confirmed = !doc.metadata.hasPendingWrites && !doc.metadata.fromCache;
          const lastSeen = player.lastSeen?.getTime() ?? 0;
          if (player.id === playerId && confirmed && lastSeen > lastOwnHeartbeat) {
            lastOwnHeartbeat = lastSeen;
            setOffset(lastSeen - Date.now());
          }
        });
        playersData.sort((a, b) => a.joinTime.getTime() - b.joinTime.getTime());
        setPlayers(playersData);
        onLoaded();
      },
      (error) => {
        console.error('Error listening to players collection:', error);
      },
    );
  }, [roomCode, playerId, setPlayers, setOffset, onLoaded]);
}
