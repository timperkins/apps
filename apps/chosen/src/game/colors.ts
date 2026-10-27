/** Bright, distinct finger colors, in the order they're handed out. */
export const FINGER_COLORS = [
  '#ff4d6d', // watermelon
  '#ffd23f', // sunshine
  '#3bceac', // mint
  '#4d96ff', // sky
  '#b15eff', // grape
  '#ff8c42', // tangerine
  '#00e5ff', // cyan
  '#ff5ec4', // bubblegum
  '#a3e635', // lime
  '#f5f5f5', // snow
] as const

export function fingerColor(index: number): string {
  return FINGER_COLORS[index % FINGER_COLORS.length]
}
