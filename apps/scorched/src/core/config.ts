export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type WindSetting = 'off' | 'calm' | 'breezy' | 'gale';
export type WindChange = 'turn' | 'round';
export type TerrainType = 'hills' | 'mountains' | 'canyons' | 'flat' | 'random';
export type GravitySetting = 'low' | 'normal' | 'high';
export type PlaneSetting = 'off' | 'few' | 'some' | 'many';

export type TankDesign = 'classic' | 'heavy' | 'rover' | 'hover' | 'dome' | 'artillery';

export interface PlayerSetup {
  name: string;
  color: string;
  kind: 'human' | 'cpu';
  difficulty: Difficulty;
  /** How the tank looks. Purely cosmetic: every design has the same hit box. */
  design?: TankDesign;
}

export interface GameConfig {
  rounds: number;
  startingCoins: number;
  wind: WindSetting;
  windChange: WindChange;
  terrain: TerrainType;
  gravity: GravitySetting;
  /** How often planes fly over the battlefield. */
  planes: PlaneSetting;
  /** Percent interest paid on unspent coins at the end of each round. */
  interestPct: number;
  players: PlayerSetup[];
  /** Fixed seed for reproducible games; random when omitted. */
  seed?: number;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** Tank colors players pick from. The first eight are the classic set. */
export const PLAYER_COLORS = [
  '#e8483a', // red
  '#3aa0f0', // blue
  '#f2c230', // yellow
  '#52d46a', // green
  '#c064f0', // purple
  '#f08a2e', // orange
  '#40e0d0', // teal
  '#f070b0', // pink
  '#ffffff', // white
  '#9a9aaa', // grey
  '#a0e040', // lime
  '#2a5cd8', // navy
  '#b02838', // crimson
  '#ffe08a', // sand
  '#8a5a2e', // brown
  '#20a080', // jade
  '#7a50e0', // violet
  '#ff6a8a', // coral
  '#a8e8ff', // sky
  '#d0a020', // gold
];

export const TANK_DESIGNS: TankDesign[] = ['classic', 'heavy', 'rover', 'hover', 'dome', 'artillery'];

export const TANK_DESIGN_NAMES: Record<TankDesign, string> = {
  classic: 'Classic',
  heavy: 'Heavy',
  rover: 'Rover',
  hover: 'Hover',
  dome: 'Dome',
  artillery: 'Artillery',
};

export const CPU_NAMES = ['Hawk', 'Viper', 'Brick', 'Nova', 'Rook', 'Blitz', 'Ember', 'Moss'];

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];

/** Maximum wind strength for each setting, in wind units. */
export const WIND_MAX: Record<WindSetting, number> = { off: 0, calm: 4, breezy: 10, gale: 20 };

/** Average seconds between planes for each setting; 0 means no planes. */
export const PLANE_INTERVAL: Record<PlaneSetting, number> = { off: 0, few: 60, some: 30, many: 15 };

/** Gravity in px/s^2. */
export const GRAVITY: Record<GravitySetting, number> = { low: 190, normal: 300, high: 440 };

export function defaultConfig(): GameConfig {
  return {
    rounds: 5,
    startingCoins: 10000,
    wind: 'breezy',
    windChange: 'turn',
    terrain: 'random',
    gravity: 'normal',
    planes: 'some',
    interestPct: 5,
    players: [
      { name: 'Player 1', color: PLAYER_COLORS[0], kind: 'human', difficulty: 'normal' },
      { name: CPU_NAMES[0], color: PLAYER_COLORS[1], kind: 'cpu', difficulty: 'normal' },
      { name: CPU_NAMES[1], color: PLAYER_COLORS[2], kind: 'cpu', difficulty: 'normal' },
    ],
  };
}

/** Checks the match settings, leaving out the player list. */
export function validateSettings(config: GameConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > 20) {
    errors.push('Rounds must be a whole number from 1 to 20.');
  }
  if (!(config.startingCoins >= 0 && config.startingCoins <= 100000)) {
    errors.push('Starting cash must be between 0 and 100,000.');
  }
  if (!(config.interestPct >= 0 && config.interestPct <= 10)) {
    errors.push('Interest must be between 0% and 10%.');
  }
  config.players.forEach((p, i) => {
    if (!p.name.trim()) errors.push(`Player ${i + 1} needs a name.`);
  });
  return errors;
}

/** Returns a list of problems; empty means the config is playable. */
export function validateConfig(config: GameConfig): string[] {
  const errors: string[] = [];
  const n = config.players.length;
  if (n < MIN_PLAYERS) errors.push(`Add at least ${MIN_PLAYERS} players.`);
  if (n > MAX_PLAYERS) errors.push(`At most ${MAX_PLAYERS} players can play.`);
  return [...errors, ...validateSettings(config)];
}
