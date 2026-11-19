// Pixel-art mouse cursors. Each is a 16x16 grid drawn at 2x, so its pixels
// match the chunky pixels of the game. They are turned into CSS cursor values
// once, at start-up, and set as --cur-* variables on the page for style.css.
//
// The move cursor turns and plays a burst on click, the corners cursor (over
// a unit you can pick) breathes, and the attack cursor (over an enemy your
// units can fire on) is the move cursor in red: the same four arrowheads,
// turning the same way, with a red burst on click. The harvest cursor spins
// as the move cursor does, breathing as it turns: main.ts steps through their
// frames. The harvest cursor (over
// ore with an ore hauler selected) is the attack cursor's cousin in gold: a
// diamond closing in on a nugget, with a gold burst.

export type CursorKind = 'arrow' | 'hand' | 'grab' | 'grabbing' | 'move' | 'corners' | 'attack' | 'harvest' | 'enter' | 'rally' | 'blocked' | 'build';

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
const ART: Record<Exclude<CursorKind, 'move' | 'corners' | 'attack' | 'harvest'>, { rows: string[]; hot: [number, number] }> = {
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
  // get in: a green arrow down into an open hatch (soldiers onto a transport)
  enter: {
    hot: [7, 10],
    rows: [
      '.....kkkkk......',
      '.....kGggk......',
      '.....kGggk......',
      '.....kGggk......',
      '...kkkGggkkk....',
      '..kGggggggggk...',
      '...kGggggggk....',
      '....kGggggk.....',
      'kkkk.kGggk.kkkk.',
      'kwwk..kGk..kwwk.',
      'kwwk...k...kwwk.',
      'kwwk.......kwwk.',
      'kwwkkkkkkkkkwwk.',
      'kwwwwwwwwwwwwwk.',
      'kkkkkkkkkkkkkkk.',
      '................',
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
  harvest: 'crosshair',
  enter: 'pointer',
  rally: 'crosshair',
  blocked: 'not-allowed',
  build: 'crosshair',
};

const SCALE = 2;

// A size x size grid of color letters (as in COLORS) drawn on a canvas,
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

// Draw on a size x size grid with put(x, y, color letter); every drawn pixel
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

// red: the attack cursor's colors instead of green
function moveRows(a: number, f: MoveFrame, red = false): string[] {
  const [dark, light] = red ? ['r', 'R'] : ['g', 'G'];
  return drawn(MS, (put) => {
    for (let y = 0; y < MS; y++)
      for (let x = 0; x < MS; x++) {
        const vx = x - MC;
        const vy = y - MC;
        const r = Math.hypot(vx, vy);
        if (f.ring && Math.abs(r - f.ring) < 0.55) {
          const ang = Math.atan2(vy, vx);
          if (!f.dots || Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0) put(x, y, f.ring < 4 ? 'w' : light);
        }
        for (let k = 0; k < 4 && f.d >= 0; k++) {
          const t = a + (k * Math.PI) / 2;
          const along = vx * Math.cos(t) + vy * Math.sin(t);
          const across = -vx * Math.sin(t) + vy * Math.cos(t);
          const into = along - f.d;
          if (into >= -0.3 && into <= 4 && Math.abs(across) <= into * 0.8 + 0.5) put(x, y, into > 3 ? light : dark);
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

// Over ore an ore hauler can dig: a gold diamond of "radius" r (to its tips)
// broken at the tips, closing in on a little nugget at (C, C). Its four sides
// are turned by angle a round the nugget, so it spins as a steps round.
function oreSight(put: (x: number, y: number, col: string) => void, size: number, C: number, r: number, a = 0): void {
  const m = r / Math.SQRT2; // how far each side's middle is from the nugget
  const half = (r - 3) / Math.SQRT2; // half of the part of a side that shows
  for (let k = 0; k < 4; k++) {
    const t = a + Math.PI / 4 + (k * Math.PI) / 2;
    const nx = Math.cos(t);
    const ny = Math.sin(t);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const out = (x - C) * nx + (y - C) * ny - m; // across the side, + outwards
        const along = -(x - C) * ny + (y - C) * nx;
        if (Math.abs(out) < 0.62 && Math.abs(along) <= half + 0.3) put(x, y, out > 0 ? 'Y' : 'y');
      }
  }
  // the nugget
  put(C, C - 1, 'Y');
  put(C - 1, C, 'y');
  put(C, C, 'Y');
  put(C + 1, C, 'y');
}

function oreRows(r: number, a: number): string[] {
  return drawn(17, (put) => oreSight(put, 17, 8, r, a));
}

// The harvest cursor spins through a quarter turn (they look the
// same each quarter) in MOVE_STEPS frames, breathing in and out as they go:
// the turn and the size of the sight at frame i.
const spin = (i: number) => (i / MOVE_STEPS) * (Math.PI / 2);
const breath = (i: number, rs: number[]) => rs[i % rs.length];

// A click on ore plays ATTACK_CLICK, the move burst in gold: the diamond
// snaps in to a white flash, a gold ring bursts out from the spot, and the
// diamond opens back up behind it. (r < 0: diamond hidden)
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

function oreClickRows(f: AttackFrame): string[] {
  return drawn(MS, (put) => {
    for (let y = 0; y < MS; y++)
      for (let x = 0; x < MS; x++) {
        const vx = x - MC;
        const vy = y - MC;
        const r = Math.hypot(vx, vy);
        if (f.ring && Math.abs(r - f.ring) < 0.55) {
          const ang = Math.atan2(vy, vx);
          if (!f.dots || Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0) put(x, y, f.ring < 4 ? 'w' : 'Y');
        }
      }
    if (f.r >= 0) oreSight(put, MS, MC, f.r * 1.4);
    if (f.flash)
      for (let y = 0; y < MS; y++)
        for (let x = 0; x < MS; x++) if (Math.hypot(x - MC, y - MC) <= f.flash) put(x, y, 'w');
  });
}

// The attack cursor's click burst, one CSS value per frame.
export const ATTACK_CLICK_CSS: string[] = [];
// The harvest cursor's (the same burst in gold).
export const HARVEST_CLICK_CSS: string[] = [];

export const CURSORS = {} as Record<CursorKind, string>;
// The attack cursor through one quarter turn.
export const ATTACK_FRAMES: string[] = [];
// The corners cursor through one breath.
export const CORNER_FRAMES: string[] = [];
// The harvest cursor through one breath.
export const HARVEST_FRAMES: string[] = [];

// Build every cursor and publish them as --cur-<kind> on the page.
export function initCursors(): void {
  for (const h of [4, 5, 6, 5]) CORNER_FRAMES.push(gridCss(cornerRows(h), [7, 7], FALLBACK.corners));
  for (let i = 0; i < MOVE_STEPS; i++) ATTACK_FRAMES.push(gridCss(moveRows(spin(i), { d: REST }, true), [MC, MC], FALLBACK.attack));
  for (const f of MOVE_CLICK) ATTACK_CLICK_CSS.push(gridCss(moveRows(0, f, true), [MC, MC], FALLBACK.attack));
  for (let i = 0; i < MOVE_STEPS; i++) HARVEST_FRAMES.push(gridCss(oreRows(breath(i, [7, 7.5, 8, 7.5]), spin(i)), [8, 8], FALLBACK.harvest));
  for (const f of ATTACK_CLICK) HARVEST_CLICK_CSS.push(gridCss(oreClickRows(f), [MC, MC], FALLBACK.harvest));
  const root = document.documentElement.style;
  for (const kind of Object.keys(FALLBACK) as CursorKind[]) {
    if (kind === 'move') CURSORS[kind] = moveCursor(0);
    else if (kind === 'corners') CURSORS[kind] = CORNER_FRAMES[0];
    else if (kind === 'attack') CURSORS[kind] = ATTACK_FRAMES[0];
    else if (kind === 'harvest') CURSORS[kind] = HARVEST_FRAMES[0];
    else CURSORS[kind] = gridCss(ART[kind].rows, ART[kind].hot, FALLBACK[kind]);
    root.setProperty(`--cur-${kind}`, CURSORS[kind]);
  }
}

// The move cursor's arrowheads, turning round a touch screen's confirm
// button: one picture per turn step, as image URLs (a grid pixel to a pixel),
// with the tips far enough out to clear the button.
const ringFrames: string[] = [];
export function moveRingFrames(): string[] {
  if (!ringFrames.length)
    for (let i = 0; i < MOVE_STEPS; i++) ringFrames.push(gridCanvas(moveRows((i / MOVE_STEPS) * (Math.PI / 2), { d: 7 }), 1).toDataURL('image/png'));
  return ringFrames;
}
export const MOVE_RING_SIZE = MS;
// The attack cursor's red arrowheads, turning round the confirm button for
// an attack, as the move cursor's green ones do for a move.
const attackRing: string[] = [];
export function attackRingFrames(): string[] {
  if (!attackRing.length)
    for (let i = 0; i < MOVE_STEPS; i++) attackRing.push(gridCanvas(moveRows((i / MOVE_STEPS) * (Math.PI / 2), { d: 7 }, true), 1).toDataURL('image/png'));
  return attackRing;
}

// The harvest cursor's diamond, opened wide round the confirm button for
// sending haulers to dig, through one breath.
const oreRingFrames: string[] = [];
export function harvestRingFrames(): string[] {
  if (!oreRingFrames.length)
    for (let i = 0; i < MOVE_STEPS; i++) oreRingFrames.push(gridCanvas(drawn(MS, (put) => oreSight(put, MS, MC, breath(i, [13, 13.5, 14, 13.5]), spin(i))), 1).toDataURL('image/png'));
  return oreRingFrames;
}

// ---------- The click bursts, drawn on the map ----------
// With touch there is no cursor, so the game draws the move or attack burst
// on the map where you tapped: one grid pixel to a map pixel, centered on the
// tap (BURST_CENTER). BURST_FRAME is how long each frame shows, in seconds.

export const BURST_CENTER = MC;
export const BURST_FRAME = 0.055;
const bursts: Record<'move' | 'attack' | 'harvest', HTMLCanvasElement[]> = { move: [], attack: [], harvest: [] };
export function burstFrames(kind: 'move' | 'attack' | 'harvest'): HTMLCanvasElement[] {
  const out = bursts[kind];
  if (!out.length) {
    if (kind === 'harvest') for (const f of ATTACK_CLICK) out.push(gridCanvas(oreClickRows(f), 1));
    else for (const f of MOVE_CLICK) out.push(gridCanvas(moveRows(0, f, kind === 'attack'), 1));
  }
  return out;
}
