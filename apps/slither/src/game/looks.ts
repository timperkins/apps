// What a player picks on their phone. Colors are unique within a game; patterns are not.
export const COLORS = [
  '#ff5a5f',
  '#ff9f1c',
  '#ffd23f',
  '#b5e550',
  '#3ddc84',
  '#2ec4b6',
  '#3fa7ff',
  '#5e60ce',
  '#9d4edd',
  '#f15bb5',
  '#ff7aa2',
  '#e0e0e0',
  '#8d6e63',
  '#00e5ff',
  '#c6ff00',
  '#ff6d00',
] as const;

export const PATTERNS = ['solid', 'stripes', 'dots', 'gradient', 'glow'] as const;
export type Pattern = (typeof PATTERNS)[number];

export const NAME_MAX = 12;

export interface Look {
  name: string;
  color: string;
  pattern: Pattern;
}

export function cleanName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return trimmed || fallback;
}

export function isPattern(p: unknown): p is Pattern {
  return typeof p === 'string' && (PATTERNS as readonly string[]).includes(p);
}

export function isColor(c: unknown): c is string {
  return typeof c === 'string' && (COLORS as readonly string[]).includes(c);
}

const BOT_NAMES = ['Noodle', 'Ziggy', 'Slinky', 'Wiggles', 'Kaa', 'Hiss', 'Basil', 'Monty', 'Sssam', 'Doodle', 'Lacey', 'Bolt'];

export function botName(index: number): string {
  return BOT_NAMES[index % BOT_NAMES.length];
}
