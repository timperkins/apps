// Random call signs for co-op players.
const FIRST = ['Brave', 'Rusty', 'Lucky', 'Sneaky', 'Mighty', 'Silent', 'Crazy', 'Swift', 'Grumpy', 'Jolly', 'Daring', 'Sly', 'Wild', 'Iron', 'Golden', 'Stormy', 'Sleepy', 'Fuzzy', 'Fearless', 'Cosmic', 'Turbo', 'Wobbly', 'Shadow', 'Thunder'];
const SECOND = ['Falcon', 'Badger', 'Hornet', 'Otter', 'Comet', 'Moose', 'Eagle', 'Viper', 'Panda', 'Goose', 'Raven', 'Wombat', 'Pickle', 'Rocket', 'Hawk', 'Penguin', 'Lynx', 'Walrus', 'Taco', 'Yeti', 'Pilot', 'Ace', 'Noodle', 'Gecko'];
export const NAME_MAX = 16;
export function randomName(not = ''): string {
  for (;;) {
    const n = FIRST[Math.floor(Math.random() * FIRST.length)] + ' ' + SECOND[Math.floor(Math.random() * SECOND.length)];
    if (n !== not) return n;
  }
}
export function cleanName(s: unknown): string {
  return typeof s === 'string' ? s.replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, NAME_MAX) || 'Player' : 'Player';
}
