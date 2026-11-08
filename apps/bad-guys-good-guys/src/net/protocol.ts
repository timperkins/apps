import type { Look } from '../core/look';
import type { Input } from '../core/sim';
import type { Snapshot } from '../core/snapshot';

/** Bumped whenever messages change shape, so an old page is told to reload. */
export const PROTOCOL = 1;
export const ROOM_CODE_LENGTH = 4;

export type ToHost =
  | { t: 'hello'; v: number; look: Look }
  | { t: 'in'; i: Input }
  | { t: 'restart' };

export type ToPlayer =
  | { t: 'welcome'; id: number; v: number }
  | { t: 'looks'; looks: [number, Look][] }
  | { t: 'start' }
  | { t: 'snap'; s: Snapshot }
  | { t: 'full' }
  | { t: 'version'; v: number };

export function randomRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += Math.floor(random() * 10);
  return code;
}

export function normalizeRoomCode(raw: string): string | null {
  const code = raw.replace(/\D/g, '');
  return code.length === ROOM_CODE_LENGTH ? code : null;
}

export function isInput(x: unknown): x is Input {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return ['mx', 'mz', 'attack', 'jump', 'grab'].every((k) => typeof i[k] === 'number' && Number.isFinite(i[k] as number));
}

export function clampInput(i: Input): Input {
  const c = (v: number) => Math.max(-1, Math.min(1, v));
  return { mx: c(i.mx), mz: c(i.mz), attack: i.attack | 0, jump: i.jump | 0, grab: i.grab | 0 };
}
