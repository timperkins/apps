import { useAtomValue } from 'jotai';
import { nowAtom } from '../atoms';

/** Server time in ms, refreshed every second. */
export function useNow(): number {
  return useAtomValue(nowAtom);
}
