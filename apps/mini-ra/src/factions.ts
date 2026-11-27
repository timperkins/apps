// The sides' colors: Cobalt and Ember, then one more for each extra player.
import { RGB, hex } from './gfx';

export interface Faction {
  name: string;
  main: RGB;
  light: RGB;
  dark: RGB;
}

export const FACTIONS: Faction[] = [
  { name: 'Cobalt', main: hex('#4f74a8'), light: hex('#8fb2dc'), dark: hex('#2c446b') },
  { name: 'Ember', main: hex('#c0622e'), light: hex('#eba05d'), dark: hex('#71331a') },
  // more sides for multiplayer: a color each player can pick
  { name: 'Crimson', main: hex('#a83434'), light: hex('#e07a6e'), dark: hex('#5e1a1c') },
  { name: 'Gold', main: hex('#c49a22'), light: hex('#f0d46a'), dark: hex('#6e5310') },
  { name: 'Violet', main: hex('#7650a8'), light: hex('#b39ae0'), dark: hex('#3e2862') },
  { name: 'Teal', main: hex('#2a8f8a'), light: hex('#72d4c8'), dark: hex('#14504d') },
  { name: 'Rose', main: hex('#b8538a'), light: hex('#ec9cc4'), dark: hex('#66284a') },
  { name: 'Frost', main: hex('#a7aeb4'), light: hex('#e6eaec'), dark: hex('#5a6168') },
  { name: 'Lime', main: hex('#7fa62c'), light: hex('#c2e06a'), dark: hex('#425a12') },
  { name: 'Umber', main: hex('#86583a'), light: hex('#c4956c'), dark: hex('#472b1a') },
  { name: 'Onyx', main: hex('#3c3e44'), light: hex('#7c8088'), dark: hex('#1c1d21') },
  { name: 'Sky', main: hex('#4ea6d6'), light: hex('#9ad6f2'), dark: hex('#1f5c80') },
];
