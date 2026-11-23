export const HELLO_LINES = ['Hi!', 'Hello!', "Didn't see you there!", 'Nice day, huh?', 'Hey there!', 'Howdy!', 'Cool mask!'];
export const BULLY_LINES = ['Gimme your money!', 'Hey, you!', 'Come here!', 'Put em up!'];
export const DRIVER_LINES = ['Hey! My car!', 'Not my car!', 'Come back!', 'Rude!'];
export const COP_LINES = ['Stop right there!', 'Freeze!', "You're under arrest!", 'Come back here!'];
export const TIRED_LINES = ['You too fast', 'You too fast!', '*huff* *puff*', 'Need... a... break...'];
export const GUARD_IDLE = ['Welcome to the bank.', 'Have a nice day.', 'No funny business.'];
export const LOST_LINES = ["Huh? Where'd they go?", 'Lost them!', 'Who was that?'];
export const CAPTAIN_LINES = ['Get off my ship!', 'Arr! Scram!', 'This ship is MINE!'];
export const TROOP_LINES = ['Move out!', 'Target spotted!', 'Go go go!'];

export type ItemKind = 'tool' | 'disguise' | 'upgrade' | 'heal' | 'weapon';

export interface Item {
  id: string;
  name: string;
  price: number;
  kind: ItemKind;
  desc: string;
  max?: number; // for upgrades with levels
}

export const SHOP_ITEMS: Item[] = [
  { id: 'screwdriver', name: 'Screwdriver', price: 100, kind: 'tool', desc: 'Opens vents and locked doors.' },
  { id: 'wrench', name: 'Wrench', price: 150, kind: 'tool', desc: 'Opens vents and locked doors.' },
  { id: 'flamer', name: 'Flamethrower', price: 800, kind: 'weapon', desc: 'Hold F (or the fire button) to spray cartoon flames.' },
  { id: 'snack', name: 'Sandwich', price: 20, kind: 'heal', desc: 'Get your health back.' },
  { id: 'shoes', name: 'Fast shoes', price: 300, kind: 'upgrade', desc: 'Run faster.', max: 2 },
  { id: 'gloves', name: 'Boxing gloves', price: 250, kind: 'upgrade', desc: 'Punch harder.', max: 2 },
  { id: 'vest', name: 'Padded vest', price: 400, kind: 'upgrade', desc: 'More health.', max: 2 },
  { id: 'cap', name: 'Cap & shades', price: 150, kind: 'disguise', desc: 'A disguise. Put it on to shake the cops.' },
  { id: 'mustache', name: 'Fake mustache', price: 100, kind: 'disguise', desc: 'A disguise. Very convincing.' },
  { id: 'cowboy', name: 'Cowboy hat', price: 200, kind: 'disguise', desc: 'A disguise. Yee-haw.' },
  { id: 'clown', name: 'Clown wig', price: 250, kind: 'disguise', desc: 'A disguise. Honk honk.' },
  { id: 'tophat', name: 'Top hat & suit', price: 400, kind: 'disguise', desc: 'A disguise. Fancy.' },
];

export const RENT_PRICE = 100;
export const RENT_SECONDS = 180;
export const BUY_PRICE = 1500;
export const VAULT_CASH = 2500;
export const VAULT_REFILL = 300; // seconds
