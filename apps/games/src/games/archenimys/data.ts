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

export type MonsterKind = 'pot' | 'cactus' | 'stew' | 'crab' | 'sharpCrab' | 'enchanter';
/** monsters a monster player can be */
export const MONSTER_KINDS: MonsterKind[] = ['pot', 'cactus', 'stew', 'crab', 'sharpCrab', 'enchanter'];

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
  pot: { name: 'Boom Pot', hp: 30, speed: 190, r: 16, xp: 3, firstStage: 1, blurb: 'A teapot with a fuse. It blows up when it gets near you, or when it gets destroyed.' },
  crab: { name: 'Snapping Crab', hp: 45, speed: 120, r: 17, xp: 4, firstStage: 1, blurb: 'Scuttles sideways, then dashes in and pinches.' },
  cactus: { name: 'Sharp Cactus', hp: 60, speed: 40, r: 18, xp: 4, firstStage: 2, blurb: 'A thorny cactus that shoots a fan of thorns at you.' },
  stew: { name: 'Acid Stew', hp: 55, speed: 55, r: 19, xp: 5, firstStage: 3, blurb: 'A black pot of bubbling green goo. It spits acid that stays on the ground for 5 seconds and hurts if you step in it.' },
  sharpCrab: { name: 'Sharp Crab', hp: 50, speed: 95, r: 17, xp: 5, firstStage: 6, blurb: 'A green crab that shoots a line of thorns straight at you, with 3× the aim of a cactus.' },
  enchanter: { name: 'Enchanter', hp: 45, speed: 70, r: 16, xp: 6, firstStage: 8, blurb: 'Enchants the monster closest to it with Protection, Sharp Attacks, Speed or Regrowth. Get near it and it tells you what it did.' },
};

export type Enchant = 'protection' | 'sharp' | 'speed' | 'regrowth';
export const ENCHANTS: Record<Enchant, { name: string; color: string; text: string }> = {
  protection: { name: 'Protection', color: '#6fb6ff', text: 'takes half damage' },
  sharp: { name: 'Sharp Attacks', color: '#ff5a5a', text: 'hits 60% harder' },
  speed: { name: 'Speed', color: '#ffe14d', text: 'moves 60% faster' },
  regrowth: { name: 'Regrowth', color: '#6bff8a', text: 'heals itself' },
};
export const ENCHANT_IDS = Object.keys(ENCHANTS) as Enchant[];

/** monster players are tougher than the ones the tower sends */
export const PLAYER_MONSTER_HP: Record<MonsterKind, number> = { pot: 90, crab: 160, cactus: 180, stew: 170, sharpCrab: 150, enchanter: 130 };
export const PLAYER_MONSTER_SPEED: Record<MonsterKind, number> = { pot: 230, crab: 175, cactus: 120, stew: 130, sharpCrab: 150, enchanter: 150 };

// damage the monsters do (before stage scaling)
export const DMG = {
  boom: 33, // explosion (at stage 1; grows as you climb)
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
  crabKing: { name: 'The Crab King', hp: 900, r: 44, speed: 190, xp: 40, look: 'crab' },
  thornlord: { name: 'Thornlord', hp: 1100, r: 46, speed: 35, xp: 45, look: 'cactus' },
  teapotTitan: { name: 'Teapot Titan', hp: 1000, r: 46, speed: 140, xp: 45, look: 'pot' },
  cauldron: { name: 'The Witch Cauldron', hp: 1200, r: 48, speed: 45, xp: 50, look: 'stew' },
  archenemy: { name: 'The Archenemy', hp: 2400, r: 50, speed: 80, xp: 120, look: 'pot' },
};
export const BOSS_ORDER: BossKind[] = ['crabKing', 'thornlord', 'teapotTitan', 'cauldron'];
export const bossFor = (stage: number): BossKind => BOSS_ORDER[(stage / BOSS_EVERY - 1) % BOSS_ORDER.length];
export const WORLDS = 2;
/** every 10 stages a Mythical chest shows up after the stage is cleared */
export const isMythicStage = (s: number) => s % 10 === 0;

// stages get harder faster as you climb, and World 2 is a lot harder again
export const hpScale = (stage: number, world = 1) => (1 + 0.16 * (stage - 1) + 0.002 * (stage - 1) ** 2) * (world > 1 ? 2.6 : 1);
export const dmgScale = (stage: number, world = 1) => (1 + 0.05 * (stage - 1)) * (world > 1 ? 1.7 : 1);

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
  | 'crit' | 'pierce' | 'multi' | 'bounce' | 'frost' | 'fire' | 'side' | 'orbs' | 'back' | 'bone'
  // only Mythical can roll these
  | 'phoenix' | 'rain' | 'thunder' | 'giant' | 'split' | 'golden' | 'aura';

export interface UpDef {
  name: string;
  icon: string;
  /** value added for each quality, Common..Mythical; null where it can't roll */
  v: (number | null)[];
  text: (v: number) => string;
}

export const UPGRADES: Record<UpId, UpDef> = {
  lifesteal: { name: 'Life Steal', icon: '🩸', v: [1, 2, 3, 5, 8, null], text: (v) => `Gain ${v} health every monster destroyed` },
  sharp: { name: 'Sharp Arrows', icon: '🗡️', v: [10, 15, 25, 40, 60, null], text: (v) => `+${v}% arrow damage` },
  quick: { name: 'Quick Draw', icon: '⚡', v: [8, 12, 18, 28, 40, null], text: (v) => `Shoot ${v}% faster` },
  tough: { name: 'Tough Skin', icon: '❤️', v: [15, 25, 40, 60, 90, null], text: (v) => `+${v} max health (and heal it)` },
  boots: { name: 'Swift Boots', icon: '👟', v: [5, 8, 12, 18, 25, null], text: (v) => `Move ${v}% faster` },
  long: { name: 'Long Shot', icon: '🎯', v: [10, 15, 22, 32, 45, null], text: (v) => `Arrows fly ${v}% faster and farther` },
  guard: { name: 'Iron Guard', icon: '🛡️', v: [3, 5, 8, 12, 16, null], text: (v) => `Take ${v}% less damage` },
  regen: { name: 'Regeneration', icon: '🌿', v: [0.4, 0.7, 1.2, 2, 3, null], text: (v) => `Heal ${v} health every second` },
  crit: { name: 'Critical Eye', icon: '👁️', v: [null, 5, 8, 12, 18, null], text: (v) => `${v}% chance for a double-damage hit` },
  frost: { name: 'Frost Arrows', icon: '❄️', v: [null, 10, 15, 22, 30, null], text: (v) => `Hits slow monsters by ${v}% for 2 seconds` },
  pierce: { name: 'Piercing', icon: '📌', v: [null, null, 1, 1, 2, null], text: (v) => `Arrows go through ${v} more monster${v > 1 ? 's' : ''}` },
  multi: { name: 'Multishot', icon: '🏹', v: [null, null, 1, 1, 2, null], text: (v) => `+${v} extra arrow${v > 1 ? 's' : ''} in every shot` },
  fire: { name: 'Fire Arrows', icon: '🔥', v: [null, null, 6, 10, 16, null], text: (v) => `Hits burn for ${v} damage a second (3 seconds)` },
  bounce: { name: 'Ricochet', icon: '↪️', v: [null, null, null, 1, 2, null], text: (v) => `Arrows bounce to ${v} more monster${v > 1 ? 's' : ''}` },
  side: { name: 'Side Arrows', icon: '↔️', v: [null, null, null, 1, 1, null], text: (v) => `Also shoot ${v} arrow${v > 1 ? 's' : ''} to each side` },
  back: { name: 'Back Arrow', icon: '🔙', v: [null, null, null, 1, 1, null], text: (v) => `Also shoot ${v} arrow${v > 1 ? 's' : ''} behind you` },
  orbs: { name: 'Guardian Orbs', icon: '🔮', v: [null, null, null, null, 1, null], text: (v) => `${v} glowing orb${v > 1 ? 's' : ''} circle you and hurt monsters` },
  bone: { name: 'Tasty Bone', icon: '🦴', v: [1, 1.4, 1.8, 2.5, 3.3, null], text: (v) => `A wolf joins you and bites monsters (power ${v})` },
  // Mythical only
  phoenix: { name: 'Phoenix Feather', icon: '🪶', v: [null, null, null, null, null, 1], text: () => 'Come back to life once with full health' },
  rain: { name: 'Arrow Rain', icon: '🌧️', v: [null, null, null, null, null, 6], text: (v) => `Every 3 seconds, ${v} arrows rain down on monsters` },
  thunder: { name: 'Thunder Bow', icon: '🌩️', v: [null, null, null, null, null, 1], text: () => 'Every 4th shot calls lightning that jumps between 5 monsters' },
  giant: { name: 'Giant Slayer', icon: '🗿', v: [null, null, null, null, null, 120], text: (v) => `+${v}% damage to bosses` },
  split: { name: 'Splitting Arrows', icon: '✴️', v: [null, null, null, null, null, 3], text: (v) => `Arrows burst into ${v} more when they hit` },
  golden: { name: 'Golden Quiver', icon: '👑', v: [null, null, null, null, null, 100], text: (v) => `+${v}% XP from monsters` },
  aura: { name: 'Burning Aura', icon: '☀️', v: [null, null, null, null, null, 30], text: (v) => `Monsters near you burn for ${v} damage a second` },
};
export const UP_IDS = Object.keys(UPGRADES) as UpId[];

// Mythical rolls only the 7 upgrades nothing else can roll.

/** how likely each quality is on a level-up; the tower gets luckier as you climb, and World 2 more so */
export function qualityWeights(stage: number, lucky: boolean, world = 1): number[] {
  const s = Math.min(1, stage / STAGES);
  const w = [52 - 30 * s, 26 - 4 * s, 13 + 6 * s, 6 + 8 * s, 2.4 + 6 * s, 0.6 + 3 * s];
  if (world > 1) {
    w[0] *= 0.3;
    w[1] *= 0.6;
    w[3] *= 1.6;
    w[4] *= 2;
    w[5] *= 2.5;
  }
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

/** an offer's value is bigger in World 2 ("even crazier upgrades") */
export interface Offer { up: UpId; q: number; x?: number }

export function rollOffers(stage: number, lucky: boolean, world = 1, mythic = false, rnd: () => number = Math.random): Offer[] {
  const w = qualityWeights(stage, lucky, world);
  const total = w.reduce((a, b) => a + b, 0);
  const out: Offer[] = [];
  for (let n = 0; n < 3; n++) {
    let q = 5;
    if (!mythic) {
      let r = rnd() * total;
      q = 0;
      while (q < 5 && r >= w[q]) r -= w[q++];
    }
    const pool = UP_IDS.filter((u) => UPGRADES[u].v[q] !== null && !out.some((o) => o.up === u));
    const o: Offer = { up: pool[Math.floor(rnd() * pool.length)], q };
    if (world > 1 && !NO_BOOST.includes(o.up)) o.x = 1.6;
    out.push(o);
  }
  return out;
}
/** counts that stay whole numbers in World 2 */
const NO_BOOST: UpId[] = ['phoenix', 'thunder', 'pierce', 'multi', 'bounce', 'side', 'back', 'orbs', 'split'];

export const upValue = (o: Offer) => Math.round((UPGRADES[o.up].v[o.q] ?? 0) * (o.x ?? 1) * 10) / 10;
export const upText = (o: Offer) => UPGRADES[o.up].text(upValue(o));

// ---------- player colors ----------

export const PLAYER_COLORS = ['#3fa7ff', '#ff6b4a', '#ffd23f', '#b86bff'];
