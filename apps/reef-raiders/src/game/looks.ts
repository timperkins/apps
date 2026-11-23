// Every player has a unique color, plus a symbol on their name tag for colorblind players.
export const COLORS = [
  '#ff4f4f',
  '#ffd23f',
  '#45e3ff',
  '#6dff5a',
  '#ff9a2e',
  '#ff5fc0',
  '#6f93ff',
  '#c08bff',
  '#ffffff',
  '#2ee8b0',
  '#ffa3a3',
  '#d4ff3d',
] as const;

export const SYMBOLS = ['star', 'diamond', 'dot', 'triangle', 'square', 'heart', 'plus', 'ring', 'cross', 'moon', 'bolt', 'flower'] as const;
export type SymbolName = (typeof SYMBOLS)[number];

export const symbolFor = (color: string): SymbolName => SYMBOLS[Math.max(0, COLORS.indexOf(color as (typeof COLORS)[number]))];

export type Role = 'raider' | 'swimmer';
export type FishKind = 'fish' | 'clown';
export const FISH_KINDS: FishKind[] = ['fish', 'clown'];

export const NAME_MAX = 10;

export function cleanName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.replace(/[^\p{L}\p{N} '!?.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return trimmed || fallback;
}

export function isColor(c: unknown): c is string {
  return typeof c === 'string' && (COLORS as readonly string[]).includes(c);
}

export const isRole = (r: unknown): r is Role => r === 'raider' || r === 'swimmer';
export const isKind = (k: unknown): k is FishKind => k === 'fish' || k === 'clown';

const RAIDER_NAMES = ['Kelpbeard', 'Salty Sal', 'Ozzie', 'Marigold'];
const SWIMMER_NAMES = ['Bubbles', 'Finn', 'Coral', 'Sprat', 'Gus', 'Gill', 'Pearl', 'Squid'];

export function defaultName(role: Role, index: number): string {
  const list = role === 'raider' ? RAIDER_NAMES : SWIMMER_NAMES;
  return list[index % list.length];
}
