// Guest names, looks and review lines. All original content for My hotel.

export const FIRST_NAMES = [
  'Ada', 'Bram', 'Cleo', 'Dev', 'Elsie', 'Felix', 'Gus', 'Hana', 'Ivo', 'June',
  'Kit', 'Lou', 'Mara', 'Nico', 'Odette', 'Pip', 'Quinn', 'Rosa', 'Sol', 'Tess',
  'Uma', 'Vince', 'Wren', 'Xavi', 'Yara', 'Zed',
] as const;

export const LAST_INITIALS = 'ABCDFGHJKLMNPRSTVW'.split('');

export const OUTFIT_COLORS = [
  '#e76f51', '#2a9d8f', '#e9c46a', '#8ab17d', '#6d597a', '#f4a261',
  '#4d908e', '#c9184a', '#577590', '#b5838d', '#ec407a', '#7e57c2',
] as const;

export const SKIN_TONES = ['#f6d5b8', '#e8b48f', '#c98c62', '#9c6644', '#6f4429'] as const;
export const HAIR_COLORS = ['#2b2233', '#6d4c41', '#d4a24c', '#a1442a', '#cfcfcf'] as const;

export const HATS = ['none', 'none', 'cap', 'sunhat', 'beanie'] as const;
export type Hat = (typeof HATS)[number];

export const BAG_COLORS = ['#26c6da', '#ef5350', '#ffca28', '#5c6bc0', '#8d6e63', null, null] as const;

export const REVIEWS: Record<1 | 2 | 3 | 4 | 5, readonly string[]> = {
  1: ['Waited forever. Never again.', 'Nobody was at the desk!', 'I gave up and slept in my car.'],
  2: ['Slow check-in, sad pillow.', 'It was fine. Barely.', 'Too long in that line.'],
  3: ['A decent night.', 'Clean enough, quick enough.', 'Solid. Would maybe return.'],
  4: ['Friendly and quick. Nice stay!', 'Comfy bed, short wait.', 'Lovely little hotel.'],
  5: ['Checked in before I could blink!', 'Best stay of my life!', 'Telling all my friends.'],
};
