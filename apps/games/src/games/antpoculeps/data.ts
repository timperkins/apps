// Antpoculeps: the egg, the 20 ant stages, food kinds and the numbers that tie them together.

export interface Stage {
  name: string;
  /** body length in world pixels */
  size: number;
  hp: number;
  dmg: number;
  speed: number;
  /** body colors: head/thorax, abdomen, legs */
  body: string;
  belly: string;
  legs: string;
  /** extra look drawn on top */
  fx?: 'fire' | 'leaf' | 'stripe' | 'armor' | 'crystal' | 'spark' | 'lava' | 'shadow' | 'galaxy' | 'cosmic' | 'gold' | 'jaw';
  blurb: string;
}

// Level 0 is the egg. Levels 1 to 20 are ants, ending with the Cosmic Ant.
export const STAGES: Stage[] = [
  { name: 'Egg', size: 16, hp: 20, dmg: 0, speed: 55, body: '#fbf6e9', belly: '#efe5cc', legs: '#d9cdb0', blurb: 'Roll around and eat food to hatch.' },
  { name: 'Baby Ant', size: 18, hp: 30, dmg: 4, speed: 120, body: '#f2e0c4', belly: '#e8cfa6', legs: '#b99b74', blurb: 'Tiny and soft. Eat, eat, eat!' },
  { name: 'Worker Ant', size: 21, hp: 42, dmg: 5, speed: 128, body: '#6b4a32', belly: '#5a3c27', legs: '#3b281a', blurb: 'A hard-working little ant.' },
  { name: 'Black Ant', size: 24, hp: 56, dmg: 7, speed: 134, body: '#2a2a30', belly: '#1c1c22', legs: '#121216', blurb: 'Shiny black and quick.' },
  { name: 'Red Ant', size: 27, hp: 72, dmg: 9, speed: 138, body: '#b8322a', belly: '#97261f', legs: '#5e1712', blurb: 'Red and ready to bite.' },
  { name: 'Fire Ant', size: 30, hp: 90, dmg: 12, speed: 142, body: '#e2541c', belly: '#c23a12', legs: '#6d1f08', fx: 'fire', blurb: 'Its bite burns!' },
  { name: 'Sugar Ant', size: 33, hp: 110, dmg: 14, speed: 150, body: '#e8a94c', belly: '#f3d18d', legs: '#8a5a1e', blurb: 'Fast, and loves sweet things.' },
  { name: 'Carpenter Ant', size: 37, hp: 135, dmg: 17, speed: 146, body: '#3a2416', belly: '#5a3a22', legs: '#24160c', fx: 'stripe', blurb: 'Chews through wood.' },
  { name: 'Leafcutter Ant', size: 41, hp: 162, dmg: 20, speed: 148, body: '#9c5a2a', belly: '#7b4420', legs: '#4a2610', fx: 'leaf', blurb: 'Carries a leaf everywhere.' },
  { name: 'Weaver Ant', size: 45, hp: 195, dmg: 24, speed: 152, body: '#d6a23c', belly: '#c08a2a', legs: '#7a5418', fx: 'stripe', blurb: 'Weaves leaves into houses.' },
  { name: 'Bullet Ant', size: 50, hp: 232, dmg: 30, speed: 156, body: '#4a2e1e', belly: '#2e1c12', legs: '#1c100a', fx: 'jaw', blurb: 'The most painful sting around.' },
  { name: 'Army Ant', size: 55, hp: 275, dmg: 34, speed: 160, body: '#5f6b38', belly: '#4a5428', legs: '#2c3216', fx: 'stripe', blurb: 'Marches over everything.' },
  { name: 'Soldier Ant', size: 61, hp: 325, dmg: 40, speed: 158, body: '#6d2e2a', belly: '#521f1c', legs: '#2e100e', fx: 'armor', blurb: 'Big head, bigger jaws.' },
  { name: 'Bulldog Ant', size: 67, hp: 380, dmg: 47, speed: 162, body: '#a33c1c', belly: '#1e1410', legs: '#7a2c12', fx: 'jaw', blurb: 'Jumps in and never lets go.' },
  { name: 'Trap-Jaw Ant', size: 74, hp: 445, dmg: 55, speed: 166, body: '#8a5b2e', belly: '#6e4420', legs: '#3c2410', fx: 'jaw', blurb: 'Jaws that snap shut in a blink.' },
  { name: 'Crystal Ant', size: 82, hp: 520, dmg: 63, speed: 168, body: '#6fd4e8', belly: '#a9eef8', legs: '#3a8ea4', fx: 'crystal', blurb: 'Made of shining crystal.' },
  { name: 'Thunder Ant', size: 90, hp: 600, dmg: 72, speed: 176, body: '#3c4a9c', belly: '#5d70d8', legs: '#1e2858', fx: 'spark', blurb: 'Crackles with lightning.' },
  { name: 'Lava Ant', size: 99, hp: 690, dmg: 82, speed: 170, body: '#2e1a14', belly: '#ff6a1a', legs: '#1a0e0a', fx: 'lava', blurb: 'Hot rock with a glowing belly.' },
  { name: 'Shadow Ant', size: 108, hp: 790, dmg: 93, speed: 182, body: '#1a1426', belly: '#3a2a5a', legs: '#0c0814', fx: 'shadow', blurb: 'Hard to see, hard to beat.' },
  { name: 'Galaxy Ant', size: 118, hp: 900, dmg: 106, speed: 180, body: '#3a1f6a', belly: '#6a3ab8', legs: '#1e0f3a', fx: 'galaxy', blurb: 'Stars swirl inside it.' },
  { name: 'Cosmic Ant', size: 132, hp: 1100, dmg: 125, speed: 186, body: '#140a2e', belly: '#2a1460', legs: '#0a0518', fx: 'cosmic', blurb: 'The biggest, strongest ant in the universe.' },
];

export const MAX_LEVEL = STAGES.length - 1; // 20

/** Food needed to go from this level to the next (at level 20: food needed to rebirth). */
export function foodNeeded(level: number): number {
  return Math.round(6 + 4 * level + 2.4 * level * level);
}

/** Power multiplier: 1x, then 1.25x after the first rebirth, 1.5x after the second, and so on. */
export const power = (rebirths: number) => 1 + 0.25 * rebirths;

/** Dying sends you down this many levels. */
export const DEATH_DROP = 3;

/** Share of max health healed every second. */
export const HEAL_PER_SEC = 0.015;

/** Food that a destroyed ant drops as meat: bigger ant, more meat. */
export const meatFor = (level: number) => Math.round(4 + 4 * level + 0.35 * level * level);

export type FoodKind = 'crumb' | 'seed' | 'berry' | 'sugar' | 'cookie' | 'apple' | 'meat';
export const FOOD: Record<FoodKind, { value: number; r: number; weight: number }> = {
  crumb: { value: 1, r: 4, weight: 40 },
  seed: { value: 2, r: 5, weight: 26 },
  berry: { value: 4, r: 7, weight: 16 },
  sugar: { value: 7, r: 8, weight: 10 },
  cookie: { value: 15, r: 12, weight: 5 },
  apple: { value: 30, r: 16, weight: 3 },
  meat: { value: 0, r: 8, weight: 0 }, // value set per drop
};
export const FOOD_KINDS = (Object.keys(FOOD) as FoodKind[]).filter((k) => FOOD[k].weight > 0);

export const WORLD = 4200; // the yard is WORLD x WORLD pixels
export const FOOD_TARGET = 520;
export const NPC_TARGET = 70;

export const PLAYER_COLORS = ['#ffd84a', '#5ad1ff', '#ff7ad9', '#7dff7a', '#ff9a4a', '#c69bff'];
