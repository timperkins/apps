import { useAtomValue } from 'jotai';
import { roomCodeAtom } from '../atoms';

export function useRoomCode() {
  return useAtomValue(roomCodeAtom);
}
