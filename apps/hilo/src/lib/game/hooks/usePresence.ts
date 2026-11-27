import { useAuth } from '@/lib/firebase';
import { writeHeartbeat } from '@/lib/firebase/firestore';
import { HEARTBEAT_INTERVAL_MS } from '@/shared/constants';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { nowAtom, serverOffsetMsAtom } from '../atoms';

/**
 * Keeps this player marked as here: writes a heartbeat to their player document while the page is
 * open and visible. Other players see them as gone once heartbeats stop (shared/game.ts).
 * Replaces the old Realtime Database presence and Cloud Function.
 */
export function usePresence(roomCode: string) {
  const auth = useAuth();
  const playerId = auth.currentUser?.uid ?? '';

  useEffect(() => {
    if (!playerId || !roomCode) return;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      writeHeartbeat(roomCode, playerId).catch((error) => {
        console.warn('Heartbeat failed:', error);
      });
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [roomCode, playerId]);
}

/** Ticks the shared server-time clock once a second. */
export function useClock() {
  const offset = useAtomValue(serverOffsetMsAtom);
  const setNow = useSetAtom(nowAtom);

  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [offset, setNow]);
}
