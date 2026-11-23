import type { Role } from './looks';

// The store. Every upgrade can be bought again and again; each level costs more than the last.

export type UpgradeId = 'speed' | 'hull' | 'reel' | 'line' | 'fins' | 'dash' | 'strength' | 'ram';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: string;
  // Added to the multiplier per level: 0.1 means +10% per level.
  per: number;
}

export const UPGRADES: Record<Role, Upgrade[]> = {
  raider: [
    { id: 'speed', name: 'Sails', desc: 'Boat sails faster', per: 0.1 },
    { id: 'hull', name: 'Hull', desc: 'More health, heals when bought', per: 0.25 },
    { id: 'reel', name: 'Reel', desc: 'Taps pull harder, reel in faster', per: 0.15 },
    { id: 'line', name: 'Line', desc: 'Hook sinks faster, easier bites', per: 0.2 },
  ],
  swimmer: [
    { id: 'fins', name: 'Fins', desc: 'Swim faster', per: 0.07 },
    { id: 'dash', name: 'Dash', desc: 'Dash comes back sooner', per: 0.2 },
    { id: 'strength', name: 'Strength', desc: 'Pull and thrash harder on a hook', per: 0.15 },
    { id: 'ram', name: 'Ram', desc: 'Ramming does more damage', per: 0.25 },
  ],
};

export const ALL_UPGRADES: UpgradeId[] = [...UPGRADES.raider, ...UPGRADES.swimmer].map((u) => u.id);
export const isUpgrade = (v: unknown): v is UpgradeId => ALL_UPGRADES.includes(v as UpgradeId);
export const roleOf = (id: UpgradeId): Role => (UPGRADES.raider.some((u) => u.id === id) ? 'raider' : 'swimmer');

export const upgradeCost = (level: number) => Math.round(5 * 1.45 ** level);

export type Levels = Partial<Record<UpgradeId, number>>;

// The multiplier an upgrade gives at its current level.
export function boost(levels: Levels | undefined, id: UpgradeId): number {
  const u = [...UPGRADES.raider, ...UPGRADES.swimmer].find((x) => x.id === id)!;
  return 1 + u.per * (levels?.[id] ?? 0);
}
