/** Tuning numbers for the game. World units are roughly meters; x runs left to right along the street. */

export const TICK = 1 / 60;
export const GRAVITY = -24;
export const Z_MIN = -4.3; // back edge of the sidewalk
export const Z_MAX = 3.6; // front edge of the street
export const HALF_VIEW = 6.2; // how far from the camera center a kid may walk
export const KID_SPEED = 4.6;
export const KID_HP = 100;
export const JUMP_V = 8.2;
export const REVIVE_TIME = 2.5;
export const REVIVE_RANGE = 1.4;
export const PICKUP_RANGE = 1.1;
export const MAX_KIDS = 4;

export type ItemKind =
  | 'bat' | 'lunchbox' | 'skateboard' | 'lid' | 'balloons' | 'noodle' | 'backpack' | 'chicken'
  | 'blower' | 'finger' | 'confetti'
  | 'apple' | 'pizza';

export interface ItemDef {
  name: string;
  /** Damage when swung; 0 means it can't be swung (throw only). */
  swing: number;
  reach: number;
  /** Seconds per swing. */
  speed: number;
  throwDmg: number;
  uses: number;
  rare?: boolean;
  heal?: number;
  knock?: number;
  stun?: number;
}

export const ITEMS: Record<ItemKind, ItemDef> = {
  bat: { name: 'Baseball bat', swing: 18, reach: 1.7, speed: 0.42, throwDmg: 20, uses: 8, knock: 3 },
  lunchbox: { name: 'Lunchbox', swing: 10, reach: 1.25, speed: 0.26, throwDmg: 14, uses: 12 },
  skateboard: { name: 'Skateboard', swing: 20, reach: 1.6, speed: 0.5, throwDmg: 22, uses: 6, knock: 3.5 },
  lid: { name: 'Trash can lid', swing: 12, reach: 1.3, speed: 0.34, throwDmg: 18, uses: 10 },
  balloons: { name: 'Water balloons', swing: 0, reach: 0, speed: 0.3, throwDmg: 12, uses: 3, stun: 0.9 },
  noodle: { name: 'Pool noodle', swing: 6, reach: 2.0, speed: 0.2, throwDmg: 5, uses: 20 },
  backpack: { name: 'Backpack', swing: 14, reach: 1.4, speed: 0.4, throwDmg: 18, uses: 8 },
  chicken: { name: 'Rubber chicken', swing: 8, reach: 1.4, speed: 0.28, throwDmg: 10, uses: 12, stun: 0.6 },
  blower: { name: 'Leaf blower', swing: 14, reach: 3.6, speed: 0.55, throwDmg: 16, uses: 6, rare: true, knock: 6 },
  finger: { name: 'Giant foam finger', swing: 34, reach: 2.0, speed: 0.55, throwDmg: 28, uses: 5, rare: true, knock: 8 },
  confetti: { name: 'Confetti cannon', swing: 0, reach: 0, speed: 0.4, throwDmg: 22, uses: 5, rare: true },
  apple: { name: 'Apple', swing: 0, reach: 0, speed: 0, throwDmg: 0, uses: 0, heal: 20 },
  pizza: { name: 'Pizza slice', swing: 0, reach: 0, speed: 0, throwDmg: 0, uses: 0, heal: 50 },
};

export const WEAPON_DROPS: ItemKind[] = ['bat', 'lunchbox', 'skateboard', 'lid', 'balloons', 'noodle', 'backpack', 'chicken'];

export type EnemyKind = 'lunch' | 'dad' | 'coach' | 'guard' | 'watch' | 'cop' | 'boss';
export type ProjKind =
  | 'burger' | 'potato' | 'dodgeball' | 'cone' | 'gnome' | 'pretzel' | 'slip' | 'cabinet' | 'tray'
  | 'confettiShot' | ItemKind;

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  melee: number;
  meleeReach: number;
  throws: ProjKind[];
  throwDmg: number;
  throwCooldown: number;
  /** Preferred distance for throwing. */
  throwRange: [number, number];
  height: number;
  radius: number;
  score: number;
  lines: string[];
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  lunch: { name: 'Lunch Lady', hp: 60, speed: 2.2, melee: 9, meleeReach: 1.3, throws: ['potato', 'tray'], throwDmg: 9, throwCooldown: 3.2, throwRange: [3, 7], height: 1.75, radius: 0.55, score: 300, lines: ['Eat your vegetables!', 'No seconds!'] },
  dad: { name: 'Lawn Dad', hp: 80, speed: 1.9, melee: 12, meleeReach: 1.4, throws: ['burger'], throwDmg: 10, throwCooldown: 2.6, throwRange: [3, 8], height: 2.0, radius: 0.6, score: 400, lines: ['Not on my lawn!', 'Who wants a burger?!'] },
  coach: { name: 'Gym Coach', hp: 65, speed: 3.0, melee: 10, meleeReach: 1.4, throws: ['dodgeball'], throwDmg: 11, throwCooldown: 2.2, throwRange: [3, 9], height: 2.15, radius: 0.45, score: 350, lines: ['Drop and give me twenty!', 'Hustle!'] },
  guard: { name: 'Crossing Guard', hp: 50, speed: 2.0, melee: 11, meleeReach: 1.9, throws: ['cone'], throwDmg: 9, throwCooldown: 3.4, throwRange: [3, 7], height: 2.0, radius: 0.4, score: 250, lines: ["Walk, don't run!", 'STOP!'] },
  watch: { name: 'Neighborhood Watch Lady', hp: 45, speed: 2.4, melee: 7, meleeReach: 1.1, throws: ['gnome'], throwDmg: 12, throwCooldown: 2.4, throwRange: [3, 8], height: 1.55, radius: 0.4, score: 300, lines: ["I'm calling your parents!", 'Off the grass!'] },
  cop: { name: 'Mall Cop', hp: 70, speed: 3.4, melee: 12, meleeReach: 1.4, throws: ['pretzel'], throwDmg: 9, throwCooldown: 2.0, throwRange: [3, 8], height: 1.85, radius: 0.6, score: 400, lines: ['Freeze, young man!', 'No running in the mall!'] },
  boss: { name: 'Principal Grimsby', hp: 600, speed: 2.1, melee: 18, meleeReach: 2.4, throws: ['slip', 'cabinet'], throwDmg: 14, throwCooldown: 2.4, throwRange: [3, 10], height: 2.8, radius: 0.85, score: 5000, lines: ['See me in my office!', 'DETENTION!'] },
};

export interface Section {
  name: string;
  /** Left and right edges of the stretch in world x. */
  x0: number;
  x1: number;
  waves: EnemyKind[][];
  pickups: { kind: ItemKind; x: number; z: number }[];
}

export const SECTIONS: Section[] = [
  {
    name: 'School steps',
    x0: 0, x1: 20,
    waves: [['lunch', 'guard'], ['lunch', 'lunch', 'guard']],
    pickups: [{ kind: 'lunchbox', x: 4, z: 1.5 }, { kind: 'backpack', x: 9, z: -1.2 }, { kind: 'apple', x: 15, z: 2.4 }],
  },
  {
    name: 'Bus loop',
    x0: 20, x1: 42,
    waves: [['coach', 'coach'], ['coach', 'lunch', 'dad']],
    pickups: [{ kind: 'bat', x: 25, z: 0.5 }, { kind: 'noodle', x: 31, z: 2.6 }, { kind: 'pizza', x: 38, z: -2.5 }],
  },
  {
    name: 'Suburban street',
    x0: 42, x1: 64,
    waves: [['dad', 'watch'], ['dad', 'watch', 'guard', 'lunch']],
    pickups: [{ kind: 'lid', x: 46, z: -2.8 }, { kind: 'balloons', x: 51, z: 1.8 }, { kind: 'chicken', x: 57, z: 0.2 }, { kind: 'apple', x: 61, z: 2.8 }],
  },
  {
    name: 'Strip mall',
    x0: 64, x1: 86,
    waves: [['cop', 'cop'], ['cop', 'coach', 'dad', 'watch']],
    pickups: [{ kind: 'skateboard', x: 68, z: 1.2 }, { kind: 'blower', x: 75, z: -1.0 }, { kind: 'pizza', x: 82, z: 2.4 }],
  },
  {
    name: 'Park gates',
    x0: 86, x1: 108,
    waves: [['boss']],
    pickups: [{ kind: 'confetti', x: 89, z: 0.4 }, { kind: 'bat', x: 92, z: 2.6 }, { kind: 'apple', x: 90, z: -2.6 }],
  },
];

export const LEVEL_END = SECTIONS[SECTIONS.length - 1].x1;

/** Kids' bare-handed combo: punch, punch, kick. */
export const COMBO = [
  { dmg: 7, reach: 1.15, time: 0.24 },
  { dmg: 7, reach: 1.15, time: 0.24 },
  { dmg: 12, reach: 1.3, time: 0.36, knock: 3 },
];
export const JUMP_KICK = { dmg: 14, reach: 1.3, knock: 3.5 };
