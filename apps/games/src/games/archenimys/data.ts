// Archenimys: numbers for enemies, bosses, upgrades and the tower.

export const STAGES = 50;
export const BOSS_EVERY = 5;
export const W = 960; // arena size in world units
export const H = 640;
export const MAX_PLAYERS = 4;

export const isBossStage = (s: number) => s % BOSS_EVERY === 0;
/** the stage right before a boss gets the loot chest and the health chest once it's cleared */
export const isChestStage = (s: number) => (s + 1) % BOSS_EVERY === 0;

// ---------- monsters ----------

export type MonsterKind = 'pot' | 'cactus' | 'stew' | 'crab';
export const MONSTER_KINDS: MonsterKind[] = ['pot', 'cactus', 'stew', 'crab'];

export interface MonsterDef {
  name: string;
  hp: number;
  speed: number;
  r: number; // body radius
  xp: number;
  /** what it does, for the help and monster-player screens */
  blurb: string;
  firstStage: number;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  pot: { name: 'Boom Pot', hp: 30, speed: 95, r: 16, xp: 3, firstStage: 1, blurb: 'A teapot with a fuse. It blows up when it gets near you, or when it gets destroyed.' },
  crab: { name: 'Snapping Crab', hp: 45, speed: 120, r: 17, xp: 4, firstStage: 1, blurb: 'Scuttles sideways, then dashes in and pinches.' },
  cactus: { name: 'Sharp Cactus', hp: 60, speed: 40, r: 18, xp: 4, firstStage: 2, blurb: 'A thorny cactus that shoots a fan of thorns at you.' },
  stew: { name: 'Acid Stew', hp: 55, speed: 55, r: 19, xp: 5, firstStage: 3, blurb: 'A black pot of bubbling green goo. It spits acid that stays on the ground for 5 seconds and hurts if you step in it.' },
};

/** monster players are tougher than the ones the tower sends */
export const PLAYER_MONSTER_HP: Record<MonsterKind, number> = { pot: 90, crab: 160, cactus: 180, stew: 170 };
export const PLAYER_MONSTER_SPEED: Record<MonsterKind, number> = { pot: 165, crab: 175, cactus: 120, stew: 130 };

// damage the monsters do (before stage scaling)
export const DMG = {
  boom: 20, // explosion
  boomR: 78, // explosion radius
  thorn: 9,
  pinch: 14,
  acidHit: 10, // the glob landing on you
  acidDps: 14, // standing in the splotch
  splotchR: 34,
  splotchLife: 5,
};

export type BossKind = 'crabKing' | 'thornlord' | 'teapotTitan' | 'cauldron' | 'archenemy';
export interface BossDef { name: string; hp: number; r: number; speed: number; xp: number; look: MonsterKind }
export const BOSSES: Record<BossKind, BossDef> = {
  crabKing: { name: 'The Crab King', hp: 900, r: 44, speed: 95, xp: 40, look: 'crab' },
  thornlord: { name: 'Thornlord', hp: 1100, r: 46, speed: 35, xp: 45, look: 'cactus' },
  teapotTitan: { name: 'Teapot Titan', hp: 1000, r: 46, speed: 70, xp: 45, look: 'pot' },
  cauldron: { name: 'The Witch Cauldron', hp: 1200, r: 48, speed: 45, xp: 50, look: 'stew' },
  archenemy: { name: 'The Archenemy', hp: 2400, r: 50, speed: 80, xp: 120, look: 'pot' },
};
const BOSS_ORDER: BossKind[] = ['crabKing', 'thornlord', 'teapotTitan', 'cauldron'];
export const bossFor = (stage: number): BossKind => (stage >= STAGES ? 'archenemy' : BOSS_ORDER[(stage / BOSS_EVERY - 1) % BOSS_ORDER.length]);

export const hpScale = (stage: number) => 1 + 0.13 * (stage - 1);
export const dmgScale = (stage: number) => 1 + 0.035 * (stage - 1);

// ---------- archers ----------

export const ARCHER = {
  hp: 100,
  speed: 190,
  r: 14,
  dmg: 20,
  fireEvery: 0.42,
  arrowSpeed: 560,
  range: 520,
};

export const xpNeed = (level: number) => Math.round(8 + level * 5 + level * level * 0.6);

// ---------- upgrades ----------

export const QUALITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'] as const;
export const Q_COLORS = ['#c8c8c8', '#5fd35f', '#4ea6ff', '#b65cff', '#ffb02e', '#ff4f6e'];

export type UpId =
  | 'lifesteal' | 'sharp' | 'quick' | 'tough' | 'boots' | 'long' | 'guard' | 'regen'
  | 'crit' | 'pierce' | 'multi' | 'bounce' | 'frost' | 'fire' | 'side' | 'orbs' | 'back' | 'phoenix';

export interface UpDef {
  name: string;
  icon: string;
  /** value added for each quality, Common..Mythical; null where it can't roll */
  v: (number | null)[];
  text: (v: number) => string;
}

export const UPGRADES: Record<UpId, UpDef> = {
  lifesteal: { name: 'Life Steal', icon: '🩸', v: [1, 2, 3, 5, 8, 12], text: (v) => `Gain ${v} health every monster destroyed` },
  sharp: { name: 'Sharp Arrows', icon: '🗡️', v: [10, 15, 25, 40, 60, 100], text: (v) => `+${v}% arrow damage` },
  quick: { name: 'Quick Draw', icon: '⚡', v: [8, 12, 18, 28, 40, 60], text: (v) => `Shoot ${v}% faster` },
  tough: { name: 'Tough Skin', icon: '❤️', v: [15, 25, 40, 60, 90, 150], text: (v) => `+${v} max health (and heal it)` },
  boots: { name: 'Swift Boots', icon: '👟', v: [5, 8, 12, 18, 25, 35], text: (v) => `Move ${v}% faster` },
  long: { name: 'Long Shot', icon: '🎯', v: [10, 15, 22, 32, 45, 65], text: (v) => `Arrows fly ${v}% faster and farther` },
  guard: { name: 'Iron Guard', icon: '🛡️', v: [3, 5, 8, 12, 16, 22], text: (v) => `Take ${v}% less damage` },
  regen: { name: 'Regeneration', icon: '🌿', v: [0.4, 0.7, 1.2, 2, 3, 5], text: (v) => `Heal ${v} health every second` },
  crit: { name: 'Critical Eye', icon: '👁️', v: [null, 5, 8, 12, 18, 25], text: (v) => `${v}% chance for a double-damage hit` },
  frost: { name: 'Frost Arrows', icon: '❄️', v: [null, 10, 15, 22, 30, 40], text: (v) => `Hits slow monsters by ${v}% for 2 seconds` },
  pierce: { name: 'Piercing', icon: '📌', v: [null, null, 1, 1, 2, 3], text: (v) => `Arrows go through ${v} more monster${v > 1 ? 's' : ''}` },
  multi: { name: 'Multishot', icon: '🏹', v: [null, null, 1, 1, 2, 3], text: (v) => `+${v} extra arrow${v > 1 ? 's' : ''} in every shot` },
  fire: { name: 'Fire Arrows', icon: '🔥', v: [null, null, 6, 10, 16, 26], text: (v) => `Hits burn for ${v} damage a second (3 seconds)` },
  bounce: { name: 'Ricochet', icon: '↪️', v: [null, null, null, 1, 2, 3], text: (v) => `Arrows bounce to ${v} more monster${v > 1 ? 's' : ''}` },
  side: { name: 'Side Arrows', icon: '↔️', v: [null, null, null, 1, 1, 2], text: (v) => `Also shoot ${v} arrow${v > 1 ? 's' : ''} to each side` },
  back: { name: 'Back Arrow', icon: '🔙', v: [null, null, null, 1, 1, 2], text: (v) => `Also shoot ${v} arrow${v > 1 ? 's' : ''} behind you` },
  orbs: { name: 'Guardian Orbs', icon: '🔮', v: [null, null, null, null, 1, 2], text: (v) => `${v} glowing orb${v > 1 ? 's' : ''} circle you and hurt monsters` },
  phoenix: { name: 'Phoenix Feather', icon: '🪶', v: [null, null, null, null, null, 1], text: () => 'Come back to life once with full health' },
};
export const UP_IDS = Object.keys(UPGRADES) as UpId[];

/** how likely each quality is on a level-up; the tower gets luckier as you climb */
export function qualityWeights(stage: number, lucky: boolean): number[] {
  const s = Math.min(1, stage / STAGES);
  const w = [52 - 30 * s, 26 - 4 * s, 13 + 6 * s, 6 + 8 * s, 2.4 + 6 * s, 0.6 + 3 * s];
  if (lucky) {
    // the loot chest skips Common and leans better
    w[0] = 0;
    w[1] *= 0.6;
    w[3] *= 1.8;
    w[4] *= 2.2;
    w[5] *= 2.5;
  }
  return w;
}

export interface Offer { up: UpId; q: number }

export function rollOffers(stage: number, lucky: boolean, rnd: () => number = Math.random): Offer[] {
  const w = qualityWeights(stage, lucky);
  const total = w.reduce((a, b) => a + b, 0);
  const out: Offer[] = [];
  for (let n = 0; n < 3; n++) {
    let r = rnd() * total;
    let q = 0;
    while (q < 5 && r >= w[q]) r -= w[q++];
    const pool = UP_IDS.filter((u) => UPGRADES[u].v[q] !== null && !out.some((o) => o.up === u));
    out.push({ up: pool[Math.floor(rnd() * pool.length)], q });
  }
  return out;
}

export const upValue = (o: Offer) => UPGRADES[o.up].v[o.q] ?? 0;
export const upText = (o: Offer) => UPGRADES[o.up].text(upValue(o));

// ---------- player colors ----------

export const PLAYER_COLORS = ['#3fa7ff', '#ff6b4a', '#ffd23f', '#b86bff'];
