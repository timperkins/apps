// Level-up powerups. Some change which items show up in the mansion, others boost Lenny's stats.
import { Rng } from './rng';
import type { ItemKind } from './sprites';
import type { ItemWeights } from './level';

export interface Powerup {
  id: string;
  name: string;
  desc: string;
  max: number;
  kind: 'odds' | 'stat';
  icon: string;
}

export const POWERUPS: Powerup[] = [
  { id: 'rocks', name: 'Rock Hound', desc: 'Rocks turn up a lot more often.', max: 4, kind: 'odds', icon: '🪨' },
  { id: 'bottles', name: 'Clumsy Butler', desc: 'More noisy bottles to throw and distract guards.', max: 4, kind: 'odds', icon: '🍾' },
  { id: 'meat', name: 'Dog Whisperer', desc: 'More meat lying about. Dogs drop everything for meat.', max: 4, kind: 'odds', icon: '🍖' },
  { id: 'smoke', name: 'Smoke and Mirrors', desc: 'Smoke bombs start showing up. Nobody sees through smoke.', max: 4, kind: 'odds', icon: '💨' },
  { id: 'toys', name: 'Tinkerer', desc: 'More wind-up toys. They rattle for a while and pull guards away.', max: 4, kind: 'odds', icon: '🐭' },
  { id: 'scavenger', name: 'Scavenger', desc: '25% more items in every level.', max: 4, kind: 'odds', icon: '🎒' },
  { id: 'medic', name: 'First Aid', desc: 'Bandages show up more often. Each heals a heart.', max: 3, kind: 'odds', icon: '🩹' },
  { id: 'sneaky', name: 'Soft Steps', desc: 'Guards and cameras take 20% longer to spot you.', max: 4, kind: 'stat', icon: '👣' },
  { id: 'speed', name: 'Fleet Feet', desc: 'Move 8% faster.', max: 4, kind: 'stat', icon: '⚡' },
  { id: 'arm', name: 'Strong Arm', desc: 'Throw 25% farther and harder.', max: 3, kind: 'stat', icon: '💪' },
  { id: 'pockets', name: 'Deep Pockets', desc: 'Carry 2 more of whatever you are holding.', max: 3, kind: 'stat', icon: '👖' },
  { id: 'tough', name: 'Thick Skin', desc: 'One more heart.', max: 3, kind: 'stat', icon: '❤️' },
  { id: 'lightsout', name: 'Lights Out', desc: 'Knocked-out enemies stay down 35% longer.', max: 3, kind: 'stat', icon: '💫' },
  { id: 'shadow', name: 'Shadow', desc: 'Guards and cameras see 10% less far.', max: 3, kind: 'stat', icon: '🌑' },
  { id: 'unscented', name: 'Unscented', desc: 'Dogs have to get 20% closer to notice you.', max: 3, kind: 'stat', icon: '🌿' },
  { id: 'deadeye', name: 'Dead Eye', desc: 'Throws home in on enemies from a wider angle.', max: 2, kind: 'stat', icon: '🎯' },
];

export type Ranks = Record<string, number>;

export const rank = (r: Ranks, id: string) => r[id] ?? 0;

export interface Stats {
  speed: number; // px/s
  maxHearts: number;
  detectMul: number; // multiplies how fast guards fill their alert meter
  visionMul: number;
  dogNoseMul: number;
  throwMul: number;
  koMul: number;
  carryBonus: number;
  aimCone: number; // radians
  itemScale: number;
}

export function stats(r: Ranks): Stats {
  return {
    speed: 120 * (1 + 0.08 * rank(r, 'speed')),
    maxHearts: 3 + rank(r, 'tough'),
    detectMul: Math.pow(0.8, rank(r, 'sneaky')),
    visionMul: 1 - 0.1 * rank(r, 'shadow'),
    dogNoseMul: 1 - 0.2 * rank(r, 'unscented'),
    throwMul: 1 + 0.25 * rank(r, 'arm'),
    koMul: 1 + 0.35 * rank(r, 'lightsout'),
    carryBonus: 2 * rank(r, 'pockets'),
    aimCone: 0.35 + 0.25 * rank(r, 'deadeye'),
    itemScale: 1 + 0.25 * rank(r, 'scavenger'),
  };
}

export const CARRY: Record<ItemKind, number> = { rock: 3, bottle: 2, meat: 2, smoke: 1, toy: 1, bandage: 0 };

export function itemWeights(r: Ranks, level: number): ItemWeights {
  return {
    rock: 10 * (1 + 0.5 * rank(r, 'rocks')),
    bottle: (level >= 2 ? 3 : 0) * (1 + 0.7 * rank(r, 'bottles')) + rank(r, 'bottles') * 1.5,
    meat: (level >= 4 ? 3 : 0) * (1 + 0.7 * rank(r, 'meat')) + rank(r, 'meat') * 1.5,
    smoke: rank(r, 'smoke') * 2.5,
    toy: (level >= 11 ? 2 : 0) + rank(r, 'toys') * 2.5,
    bandage: (level >= 3 ? 1.5 : 0.5) * (1 + 0.8 * rank(r, 'medic')),
  };
}

/** Four distinct powerups that aren't maxed out yet. */
export function offer(r: Ranks, rng: Rng): Powerup[] {
  const avail = POWERUPS.filter((p) => rank(r, p.id) < p.max);
  rng.shuffle(avail);
  // try to offer a mix of item odds and stat boosts
  const odds = avail.filter((p) => p.kind === 'odds');
  const stat = avail.filter((p) => p.kind === 'stat');
  const out: Powerup[] = [];
  while (out.length < 4 && (odds.length || stat.length)) {
    const fromOdds = out.length % 2 === 0 ? odds.length > 0 : stat.length === 0;
    out.push((fromOdds ? odds : stat).shift()!);
  }
  return out;
}

export const xpForLevel = (plevel: number) => 40 + plevel * 15;
