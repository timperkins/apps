export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export const easeOutElastic = (t: number) => {
  if (t === 0 || t === 1) return t
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Blend two #rrggbb colors; t=0 gives a, t=1 gives b. */
export function mixColor(a: string, b: string, t: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
