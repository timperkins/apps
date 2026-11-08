/** The eight ways to play, picked on the start screen. */
export const MODES = [
  { id: 'night', emoji: '🌙', name: 'Night & blizzards', text: 'It gets dark and stormy. Keep the campfire fed with logs or the townspeople leave.' },
  { id: 'lake', emoji: '🎣', name: 'Frozen lake', text: 'Unlock ice fishing on the lake and sell fish too.' },
  { id: 'boss', emoji: '🐺', name: 'Boss wolf', text: 'A giant wolf raids the camp. Fight it, build spiked gates and hire guards.' },
  { id: 'town', emoji: '🏠', name: 'Build the town', text: 'Spend wood on houses. Every house brings more customers.' },
  { id: 'pets', emoji: '🐶', name: 'Pets', text: 'Buy a dog that scares wolves and a reindeer that carries extra logs.' },
  { id: 'outfits', emoji: '🎩', name: 'Outfits', text: 'Spend eeeddd on hats and coats for your lumberjack.' },
  { id: 'chest', emoji: '🎁', name: 'Daily chest', text: 'A free surprise chest every time you come back.' },
  { id: 'rebirth', emoji: '🌟', name: 'Rebirth', text: 'Start over on purpose to earn stars that make everything better.' },
] as const;

export type Mode = (typeof MODES)[number]['id'];

export const OUTFITS = [
  { id: 'hat-blue', kind: 'hat', name: 'Blue beanie', price: 0, style: 'beanie', color: '#2f6db5', icon: '🧢' },
  { id: 'hat-red', kind: 'hat', name: 'Red beanie', price: 30, style: 'beanie', color: '#d23f3f', icon: '🧢' },
  { id: 'hat-green', kind: 'hat', name: 'Green beanie', price: 30, style: 'beanie', color: '#3f8a4a', icon: '🧢' },
  { id: 'hat-top', kind: 'hat', name: 'Top hat', price: 150, style: 'tophat', color: '#22252e', icon: '🎩' },
  { id: 'hat-viking', kind: 'hat', name: 'Viking helmet', price: 300, style: 'viking', color: '#9aa3b2', icon: '⛑️' },
  { id: 'hat-crown', kind: 'hat', name: 'Crown', price: 800, style: 'crown', color: '#ffd23a', icon: '👑' },
  { id: 'coat-red', kind: 'coat', name: 'Red coat', price: 0, style: '', color: '#d8452f', icon: '🧥' },
  { id: 'coat-green', kind: 'coat', name: 'Green coat', price: 40, style: '', color: '#3f8a4a', icon: '🧥' },
  { id: 'coat-purple', kind: 'coat', name: 'Purple coat', price: 80, style: '', color: '#7a4fb5', icon: '🧥' },
  { id: 'coat-pink', kind: 'coat', name: 'Pink coat', price: 120, style: '', color: '#e46aa0', icon: '🧥' },
  { id: 'coat-black', kind: 'coat', name: 'Black coat', price: 120, style: '', color: '#2b2f3a', icon: '🧥' },
  { id: 'coat-gold', kind: 'coat', name: 'Gold coat', price: 600, style: '', color: '#e0b12a', icon: '✨' },
] as const;

export type OutfitId = (typeof OUTFITS)[number]['id'];
