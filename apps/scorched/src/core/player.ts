import type { Difficulty, PlayerSetup, TankDesign } from './config';
import { emptyInventory, type Inventory } from './weapons';

export interface RoundStats {
  damageDealt: number;
  kills: number;
  coinsEarned: number;
  survived: boolean;
  won: boolean;
}

/** What a computer player remembers between shots. */
export interface AiMemory {
  lastTarget: number | null;
  /** Consecutive shots at the same target; accuracy improves with each one. */
  streak: number;
}

export interface Player {
  index: number;
  name: string;
  color: string;
  kind: 'human' | 'cpu';
  difficulty: Difficulty;
  design: TankDesign;
  coins: number;
  score: number;
  totalKills: number;
  inventory: Inventory;
  round: RoundStats;
  ai: AiMemory;
}

export function emptyRoundStats(): RoundStats {
  return { damageDealt: 0, kills: 0, coinsEarned: 0, survived: false, won: false };
}

export function createPlayer(setup: PlayerSetup, index: number, coins: number): Player {
  return {
    index,
    name: setup.name.trim(),
    color: setup.color,
    kind: setup.kind,
    difficulty: setup.difficulty,
    design: setup.design ?? 'classic',
    coins,
    score: 0,
    totalKills: 0,
    inventory: emptyInventory(),
    round: emptyRoundStats(),
    ai: { lastTarget: null, streak: 0 },
  };
}
