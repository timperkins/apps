import { shuffle, type Rng } from './random'

export const TAUNTS = [
  'Yep, not you',
  'Better luck never',
  'So close. Not really.',
  'The app has spoken',
  'Maybe next time, champ',
  'You can lift your finger now',
  'Not today',
  'Participation trophy incoming',
  'Nope.',
  'Denied!',
  'Keep dreaming',
  'Wrong finger, buddy',
  'Imagine thinking it was you',
  'Better luck next round',
  'Not even close',
  'Awkward...',
  'The chosen one? No.',
  'Sit this one out',
] as const

/** Distinct taunts, shuffled so repeats between rounds are rare. */
export function pickTaunts(count: number, rng: Rng): string[] {
  return shuffle(TAUNTS, rng).slice(0, count)
}
