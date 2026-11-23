// Isometric projection helpers. World units are tiles; x runs down-right, y runs down-left on screen.
export const TW = 64; // tile width in px
export const TH = 32; // tile height in px
export const ZH = 36; // px per unit of height

export function toScreen(x: number, y: number, z = 0): { sx: number; sy: number } {
  return { sx: ((x - y) * TW) / 2, sy: ((x + y) * TH) / 2 - z * ZH };
}

/** Turns a screen-space direction (like a joystick) into a world-space unit direction. */
export function screenDirToWorld(dx: number, dy: number): { x: number; y: number } {
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  const wx = (dx / (TW / 2) + dy / (TH / 2)) / 2;
  const wy = (dy / (TH / 2) - dx / (TW / 2)) / 2;
  const len = Math.hypot(wx, wy);
  return { x: wx / len, y: wy / len };
}

/** Cops get 25% tougher every 10 minutes of play. */
export function copMultiplier(seconds: number): number {
  return Math.pow(1.25, Math.floor(seconds / 600));
}

export function copLevel(seconds: number): number {
  return Math.floor(seconds / 600) + 1;
}
