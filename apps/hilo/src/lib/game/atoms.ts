import { Game, Player, Round } from '@/shared/types';
import { atom } from 'jotai';

export const playersAtom = atom<Player[]>([]);
export const roundsAtom = atom<Record<number, Round>>({});
export const gameAtom = atom<Game | null>(null);
export const roomCodeAtom = atom('');
export const gameLoadedAtom = atom(false);

/** Server clock minus this device's clock, learned from our own heartbeat timestamps. */
export const serverOffsetMsAtom = atom(0);
/** Server time in ms, refreshed every second by GameProvider. */
export const nowAtom = atom(Date.now());
