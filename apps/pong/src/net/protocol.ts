import type { Phase } from './rooms';

// Controller to display. Input goes over the unreliable channel, the rest over the reliable one.
export type ControllerMessage = { t: 'input'; y: number } | { t: 'ready' };

// Display to controller.
export type DisplayMessage =
  | { t: 'state'; phase: Phase; slot: number; score: number[]; ready: boolean[]; winner: number | null }
  | { t: 'hit' };

export const INPUT_CHANNEL = 'input';
export const CONTROL_CHANNEL = 'control';
