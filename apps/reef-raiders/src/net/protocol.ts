import type { Phase } from './rooms';
import type { FishKind, Role } from '../game/looks';
import type { Levels, UpgradeId } from '../game/upgrades';

// Controller to display. Stick input goes over the unreliable channel, the rest over the reliable one.
export type Action = 'cast' | 'reelin' | 'tap' | 'heave' | 'pull' | 'thrash' | 'dash' | 'egg' | 'taunt' | 'sell' | 'find';

export type ControllerMessage =
  | { t: 'in'; x: number; y: number; hold: boolean }
  | { t: 'join'; role: Role; name: string; color: string; kind: FishKind }
  | { t: 'act'; a: Action }
  | { t: 'buy'; item: UpgradeId };

export interface RaiderStatus {
  role: 'raider';
  name: string;
  color: string;
  score: number;
  coins: number;
  meat: number;
  catches: number;
  health: number;
  sunk: boolean;
  fixIn: number;
  hook: 'ready' | 'down' | 'fight';
  // 0..100: the knot in a tug-of-war, 100 is landed.
  knot: number;
  fightStart: number;
  depth: number;
  ups: Levels;
}

export interface SwimmerStatus {
  role: 'swimmer';
  name: string;
  color: string;
  kind: FishKind;
  score: number;
  coins: number;
  level: number;
  // 0..1 progress to the next level.
  food: number;
  alive: boolean;
  respawnIn: number;
  hooked: boolean;
  knot: number;
  dashIn: number;
  eggIn: number;
  tauntIn: number;
  diedBy: string | null;
  ups: Levels;
}

export type YouStatus = RaiderStatus | SwimmerStatus;

// Display to controller.
export type DisplayMessage = {
  t: 'state';
  phase: Phase | 'countdown';
  you: YouStatus | null;
  raiders: number;
  swimmers: number;
  // Colors other players already use.
  taken: string[];
  timeLeft: number | null;
  pete: boolean;
  crew: number;
  school: number;
  winner: 'crew' | 'school' | 'tie' | null;
  // Seconds on the display clock, so phones can time the Heave ring.
  now: number;
};

export const INPUT_CHANNEL = 'input';
export const CONTROL_CHANNEL = 'control';
