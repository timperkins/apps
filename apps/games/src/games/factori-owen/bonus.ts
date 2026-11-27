// Upgrades from research. Everything that a technology makes better reads its number here.
import type { Game } from './sim';

const R = (g: Game, id: string) => g.researched.has(id);

export const craftSpeed = (g: Game) => (R(g, 'fast-hands') ? 1.5 : 1);
export const invSize = (g: Game) => 80 + (R(g, 'backpack') ? 20 : 0);
export const reachBonus = (g: Game) => (R(g, 'long-arms') ? 5 : 0);
export const miningProd = (g: Game) => (R(g, 'mining-prod-1') ? 0.1 : 0) + (R(g, 'mining-prod-2') ? 0.1 : 0) + 0.1 * g.level('mining-prod');
/** Advanced mode's Faster mining: 20% a level, for drills, pump jacks and your hands. */
export const drillSpeed = (g: Game) => 1 + 0.2 * g.level('mining-speed');
export const labSpeed = (g: Game) => (R(g, 'lab-speed') ? 1.5 : 1);
export const genMult = (g: Game) => (R(g, 'better-gen') ? 1.5 : 1);
export const bulletMult = (g: Game) => 1 + (R(g, 'weapon-damage') ? 0.5 : 0) + (R(g, 'bullet-damage-2') ? 0.5 : 0);
export const fireRate = (g: Game) => (R(g, 'fire-rate') ? 1.3 : 1);
export const hpMult = (g: Game) => (R(g, 'toughness') ? 1.5 : 1);
export const healing = (g: Game) => R(g, 'healing');
export const turretRange = (g: Game) => (R(g, 'turret-range') ? 1.25 : 1);
export const railMult = (g: Game) => (R(g, 'rail-damage') ? 1.5 : 1);
export const bootsMult = (g: Game) => (R(g, 'speed-boots') ? 1.25 : 1);
export const asmProd = (g: Game) => (R(g, 'prod-module') ? 0.1 : 0);
