// Pixel-art mouse cursors. Each is a 16x16 grid drawn at 2x, so its pixels
// match the chunky pixels of the game. They are turned into CSS cursor values
// once, at start-up, and set as --cur-* variables on the page for style.css.
//
// The move cursor turns and plays a burst on click, and the corners cursor
// (over a unit you can pick) and the attack cursor (over an enemy your units
// can fire on) breathe: main.ts steps through their frames. The attack cursor
// plays a red burst on click, like the move cursor's.

export type CursorKind = 'arrow' | 'hand' | 'grab' | 'grabbing' | 'move' | 'corners' | 'attack' | 'rally' | 'blocked' | 'build';

const COLORS: Record<string, string> = {
  k: '#10140c', // outline
  w: '#f4f7ea', // white
  s: '#a9b49a', // white's shadow
  g: '#4fd84a', // green
  G: '#b8ff9c', // light green
  r: '#e8452f', // red
  R: '#ff9c86', // light red
  y: '#f2c94c', // yellow
  Y: '#fff1a8', // light yellow
};

// Rows of 16 characters, '.' is clear. hot is the click point.
const ART: Record<Exclude<CursorKind, 'move' | 'corners' | 'attack'>, { rows: string[]; hot: [number, number] }> = {
  arrow: {
    hot: [0, 0],
    rows: [
      'k...............',
      'kk..............',
      'kwk.............',
      'kwwk............',
      'kwwwk...........',
      'kwwwwk..........',
      'kwwwwwk.........',
      'kwwwwwwk........',
      'kwwwwwwsk.......',
      'kwwwwwssskk.....',
      'kwwwwskkkkk.....',
      'kwwkwsk.........',
      'kwk.kwsk........',
      'kk..kwsk........',
      'k....kwsk.......',
      '.....kkk........',
    ],
  },
  hand: {
    hot: [5, 0],
    rows: [
      '....kk..........',
      '...kwwk.........',
      '...kwwk.........',
      '...kwwk.........',
      '...kwwkkk.......',
      '...kwwkwwkkk....',
      '.kkkwwkwwkwwkk..',
      'kwwkwwwwwwwwkwk.',
      'kwwkwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '..kwwwwwwwwwwsk.',
      '..kwwwwwwwwwssk.',
      '...kwwwwwwwssk..',
      '....kwwwwwwsk...',
      '....kwwwwwwsk...',
      '....kkkkkkkkk...',
    ],
  },
  grab: {
    hot: [8, 8],
    rows: [
      '......kk........',
      '...kkkwwkkk.....',
      '..kwwkwwkwwk....',
      '..kwwkwwkwwkkk..',
      '..kwwkwwkwwkwwk.',
      '..kwwkwwkwwkwwk.',
      '..kwwkwwkwwkwwk.',
      'kkkwwwwwwwwwwwk.',
      'kwwkwwwwwwwwwwk.',
      'kwwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwsk.',
      '..kwwwwwwwwwssk.',
      '...kwwwwwwwssk..',
      '....kwwwwwwsk...',
      '....kwwwwwwsk...',
      '....kkkkkkkkk...',
    ],
  },
  grabbing: {
    hot: [8, 8],
    rows: [
      '................',
      '................',
      '................',
      '................',
      '...kkkkkkkkk....',
      '..kwwkwwkwwkkk..',
      '..kwwkwwkwwkwwk.',
      '.kkwwwwwwwwwwwk.',
      'kwwkwwwwwwwwwwk.',
      'kwwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwsk.',
      '..kwwwwwwwwwssk.',
      '...kwwwwwwwssk..',
      '....kwwwwwwsk...',
      '....kwwwwwwsk...',
      '....kkkkkkkkk...',
    ],
  },
  // a little flag: where a barracks, works or helipad sends its new units
  rally: {
    hot: [2, 15],
    rows: [
      '.kk.............',
      '.kwkkkkkk.......',
      '.kwkYYYYykkk....',
      '.kwkYyyyyyyyk...',
      '.kwkYyyyyyyyk...',
      '.kwkYyyyyyyk....',
      '.kwkyyyyyyyk....',
      '.kwkkkkyyyyk....',
      '.kwk...kkkk.....',
      '.kwk............',
      '.kwk............',
      '.kwk............',
      '.kwk............',
      'kkwkk...........',
      'kwwwk...........',
      'kkkkk...........',
    ],
  },
  // can't go (or can't build) there
  blocked: {
    hot: [7, 7],
    rows: [
      '.....kkkkk......',
      '...kkrrrrrkk....',
      '..krrRkkkrrrk...',
      '.krRk...krrrrk..',
      '.krk...krrrkrk..',
      'krk...krrrk.krk.',
      'krk..krrrk..krk.',
      'krk.krrrk...krk.',
      'krkkrrrk....krk.',
      'krkrrrk.....krk.',
      '.krrrk.....krk..',
      '.krrrk....krrk..',
      '..krrrkkkrrrk...',
      '...kkrrrrrkk....',
      '.....kkkkk......',
      '................',
    ],
  },
  // putting a building down: the corners of its plot
  build: {
    hot: [7, 7],
    rows: [
      'kkkkk.....kkkkk.',
      'kYyyk.....kyyYk.',
      'kykkk.....kkkyk.',
      'kyk.........kyk.',
      'kkk.........kkk.',
      '.......k........',
      '......kyk.......',
      '.....kyYyk......',
      '......kyk.......',
      '.......k........',
      'kkk.........kkk.',
      'kyk.........kyk.',
      'kykkk.....kkkyk.',
      'kYyyk.....kyyYk.',
      'kkkkk.....kkkkk.',
      '................',
    ],
  },
};

const FALLBACK: Record<CursorKind, string> = {
  arrow: 'default',
  hand: 'pointer',
  grab: 'grab',
  grabbing: 'grabbing',
  move: 'crosshair',
  corners: 'pointer',
  attack: 'crosshair',
  rally: 'crosshair',
  blocked: 'not-allowed',
  build: 'crosshair',
};

const SCALE = 2;

// A size x size grid of colour letters (as in COLORS) drawn on a canvas,
// scale pixels to a letter.
function gridCanvas(rows: string[], scale: number): HTMLCanvasElement {
  const n = rows.length;
  const c = document.createElement('canvas');
  c.width = c.height = n * scale;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = COLORS[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return c;
}

// The same grid as a CSS cursor value.
function gridCss(rows: string[], hot: [number, number], fallback: string): string {
  const c = gridCanvas(rows, SCALE);
  return `url(${c.toDataURL('image/png')}) ${hot[0] * SCALE} ${hot[1] * SCALE}, ${fallback}`;
}

// Draw on a size x size grid with put(x, y, colour letter); every drawn pixel
// gets a dark outline.
function drawn(size: number, draw: (put: (x: number, y: number, col: string) => void) => void): string[] {
  const g = Array.from({ length: size }, () => Array<string>(size).fill('.'));
  draw((x, y, col) => {
    if (x >= 0 && y >= 0 && x < size && y < size) g[y][x] = col;
  });
  const out = g.map((r) => [...r]);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (g[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== '.');
      if (near) out[y][x] = 'k';
    }
  return out.map((r) => r.join(''));
}

// ---------- The move cursor ----------
// Four green arrowheads pointing in at the click point, turned by angle a,
// their tips d pixels out. It slowly turns while your units are selected;
// a click plays MOVE_CLICK: the arrowheads snap in to a white flash, a ring
// bursts out from the spot, and they grow back out behind it. (d < 0: hidden)

const MS = 25; // grid size: room for the ring to burst out
const MC = 12; // the click point
const REST = 4;
export const MOVE_STEPS = 12; // drawn turns through a quarter circle

interface MoveFrame {
  d: number;
  flash?: number;
  ring?: number;
  dots?: boolean;
}
const MOVE_CLICK: MoveFrame[] = [
  { d: 2 },
  { d: 0, flash: 1.5 },
  { d: -9, flash: 2.5, ring: 3 },
  { d: -9, ring: 5 },
  { d: -9, ring: 7 },
  { d: 1, ring: 9 },
  { d: 2.5, ring: 11, dots: true },
  { d: 3.5, ring: 12, dots: true },
];
export const MOVE_CLICK_FRAMES = MOVE_CLICK.length;

function moveRows(a: number, f: MoveFrame): string[] {
  return drawn(MS, (put) => {
    for (let y = 0; y < MS; y++)
      for (let x = 0; x < MS; x++) {
        const vx = x - MC;
        const vy = y - MC;
        const r = Math.hypot(vx, vy);
        if (f.ring && Math.abs(r - f.ring) < 0.55) {
          const ang = Math.atan2(vy, vx);
          if (!f.dots || Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0) put(x, y, f.ring < 4 ? 'w' : 'G');
        }
        for (let k = 0; k < 4 && f.d >= 0; k++) {
          const t = a + (k * Math.PI) / 2;
          const along = vx * Math.cos(t) + vy * Math.sin(t);
          const across = -vx * Math.sin(t) + vy * Math.cos(t);
          const into = along - f.d;
          if (into >= -0.3 && into <= 4 && Math.abs(across) <= into * 0.8 + 0.5) put(x, y, into > 3 ? 'G' : 'g');
        }
        if (f.flash && r <= f.flash) put(x, y, 'w');
      }
  });
}

const moveCache = new Map<string, string>();
// The move cursor at turn step (0 to MOVE_STEPS - 1) and click frame (-1: at rest).
export function moveCursor(step: number, frame = -1): string {
  const key = `${step},${frame}`;
  let css = moveCache.get(key);
  if (!css) {
    const f = MOVE_CLICK[frame] ?? { d: REST };
    css = gridCss(moveRows((step / MOVE_STEPS) * (Math.PI / 2), f), [MC, MC], FALLBACK.move);
    moveCache.set(key, css);
  }
  return css;
}

// Over a unit a click would pick: white corners, h pixels out from the
// middle, breathing in and out (see CORNER_FRAMES).
function cornerRows(h: number): string[] {
  return drawn(16, (put) => {
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (let i = 0; i < 3; i++) {
          put(7 + sx * (h - i), 7 + sy * h, 'w');
          put(7 + sx * h, 7 + sy * (h - i), 'w');
        }
  });
}

// Over an enemy your units can fire on: a red gunsight, a broken ring of
// radius r with four ticks pointing in at the target and a dot on it, centred
// on (C, C).
function sight(put: (x: number, y: number, col: string) => void, size: number, C: number, r: number): void {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x - C;
      const dy = y - C;
      if (Math.abs(Math.hypot(dx, dy) - r) < 0.55 && Math.abs(dx) > 1.5 && Math.abs(dy) > 1.5) put(x, y, 'r');
    }
  for (let i = 3; i <= Math.round(r) + 1; i++) {
    const col = i > r - 1 ? 'R' : 'r';
    put(C + i, C, col);
    put(C - i, C, col);
    put(C, C + i, col);
    put(C, C - i, col);
  }
  put(C, C, 'R');
}

function attackRows(r: number): string[] {
  return drawn(17, (put) => sight(put, 17, 8, r));
}

// A click on an enemy plays ATTACK_CLICK, the move burst in red: the sight
// snaps in to a white flash, a red ring bursts out from the target, and the
// sight opens back up behind it. (r < 0: sight hidden)
interface AttackFrame {
  r: number;
  flash?: number;
  ring?: number;
  dots?: boolean;
}
const ATTACK_CLICK: AttackFrame[] = [
  { r: 4 },
  { r: -1, flash: 1.5 },
  { r: -1, flash: 2.5, ring: 3 },
  { r: -1, ring: 5 },
  { r: -1, ring: 7 },
  { r: 3.5, ring: 9 },
  { r: 4.5, ring: 11, dots: true },
  { r: 5, ring: 12, dots: true },
];
export const ATTACK_CLICK_FRAMES = ATTACK_CLICK.length;

function attackClickRows(f: AttackFrame): string[] {
  return drawn(MS, (put) => {
    for (let y = 0; y < MS; y++)
      for (let x = 0; x < MS; x++) {
        const vx = x - MC;
        const vy = y - MC;
        const r = Math.hypot(vx, vy);
        if (f.ring && Math.abs(r - f.ring) < 0.55) {
          const ang = Math.atan2(vy, vx);
          if (!f.dots || Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0) put(x, y, f.ring < 4 ? 'w' : 'R');
        }
      }
    if (f.r >= 0) sight(put, MS, MC, f.r);
    if (f.flash)
      for (let y = 0; y < MS; y++)
        for (let x = 0; x < MS; x++) if (Math.hypot(x - MC, y - MC) <= f.flash) put(x, y, 'w');
  });
}

// The attack cursor's click burst, one CSS value per frame.
export const ATTACK_CLICK_CSS: string[] = [];

export const CURSORS = {} as Record<CursorKind, string>;
// The attack cursor through one breath.
export const ATTACK_FRAMES: string[] = [];
// The corners cursor through one breath.
export const CORNER_FRAMES: string[] = [];

// Build every cursor and publish them as --cur-<kind> on the page.
export function initCursors(): void {
  for (const h of [4, 5, 6, 5]) CORNER_FRAMES.push(gridCss(cornerRows(h), [7, 7], FALLBACK.corners));
  for (const r of [5, 5.5, 6, 5.5]) ATTACK_FRAMES.push(gridCss(attackRows(r), [8, 8], FALLBACK.attack));
  for (const f of ATTACK_CLICK) ATTACK_CLICK_CSS.push(gridCss(attackClickRows(f), [MC, MC], FALLBACK.attack));
  const root = document.documentElement.style;
  for (const kind of Object.keys(FALLBACK) as CursorKind[]) {
    if (kind === 'move') CURSORS[kind] = moveCursor(0);
    else if (kind === 'corners') CURSORS[kind] = CORNER_FRAMES[0];
    else if (kind === 'attack') CURSORS[kind] = ATTACK_FRAMES[0];
    else CURSORS[kind] = gridCss(ART[kind].rows, ART[kind].hot, FALLBACK[kind]);
    root.setProperty(`--cur-${kind}`, CURSORS[kind]);
  }
}

// ---------- The click bursts, drawn on the map ----------
// With touch there is no cursor, so the game draws the move or attack burst
// on the map where you tapped: one grid pixel to a map pixel, centred on the
// tap (BURST_CENTER). BURST_FRAME is how long each frame shows, in seconds.

export const BURST_CENTER = MC;
export const BURST_FRAME = 0.055;
const bursts: Record<'move' | 'attack', HTMLCanvasElement[]> = { move: [], attack: [] };
export function burstFrames(kind: 'move' | 'attack'): HTMLCanvasElement[] {
  const out = bursts[kind];
  if (!out.length) {
    if (kind === 'move') for (const f of MOVE_CLICK) out.push(gridCanvas(moveRows(0, f), 1));
    else for (const f of ATTACK_CLICK) out.push(gridCanvas(attackClickRows(f), 1));
  }
  return out;
}
