import type { Phase } from './rooms';
import type { Pattern } from '../game/looks';

// Controller to display. Steering goes over the unreliable channel, the rest over the reliable one.
export type ControllerMessage =
  | { t: 'steer'; s: number; boost: boolean }
  | { t: 'look'; name: string; color: string; pattern: Pattern };

export interface PlayerStatus {
  name: string;
  color: string;
  pattern: Pattern;
  alive: boolean;
  mass: number;
  best: number;
  kills: number;
  // 1 is the biggest snake.
  rank: number;
  respawnIn: number;
  protected: boolean;
}

// Display to controller.
export type DisplayMessage =
  | {
      t: 'state';
      phase: Phase | 'countdown';
      // Null while the game is full and this phone has no snake.
      you: PlayerStatus | null;
      full: boolean;
      snakes: number;
      // Colors other snakes already use.
      taken: string[];
      timeLeft: number | null;
      winner: string | null;
    }
  | { t: 'died'; by: string | null };

export const INPUT_CHANNEL = 'input';
export const CONTROL_CHANNEL = 'control';
