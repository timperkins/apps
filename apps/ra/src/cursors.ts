// Pixel-art mouse cursors. Each is a 16x16 grid drawn at 2x, so its pixels
// match the chunky pixels of the game. They are turned into CSS cursor values
// once, at start-up, and set as --cur-* variables on the page for style.css.
//
// Over a unit with something selected the pointer hides and the game draws a
// spinning ring round the unit instead (see drawHover in v2/game.ts).

export type CursorKind = 'arrow' | 'hand' | 'grab' | 'grabbing' | 'move' | 'corners' | 'rally' | 'blocked' | 'build' | 'none';

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
const ART: Record<Exclude<CursorKind, 'none' | 'move' | 'corners'>, { rows: string[]; hot: [number, number] }> = {
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
  rally: 'crosshair',
  blocked: 'not-allowed',
  build: 'crosshair',
  none: 'none',
};

const SCALE = 2;

// A 16x16 grid of colour letters (as in COLORS) to a CSS cursor value.
function gridCss(rows: string[], hot: [number, number], fallback: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = 16 * SCALE;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = COLORS[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  });
  return `url(${c.toDataURL('image/png')}) ${hot[0] * SCALE} ${hot[1] * SCALE}, ${fallback}`;
}

// Draw with put(x, y, colour letter); every drawn pixel gets a dark outline.
function drawn(draw: (put: (x: number, y: number, col: string) => void) => void): string[] {
  const g = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  draw((x, y, col) => {
    if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = col;
  });
  const out = g.map((r) => [...r]);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (g[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== '.');
      if (near) out[y][x] = 'k';
    }
  return out.map((r) => r.join(''));
}

// The move cursor: four green arrowheads round the click point (7, 7), their
// tips d pixels out. Clicking plays it with d running down to 0, so the
// arrowheads close in on the spot the units are sent to.
function moveRows(d: number): string[] {
  return drawn((put) => {
    for (let i = 0; i < 3; i++)
      for (let j = -i; j <= i; j++) {
        const col = i === 2 ? 'G' : 'g';
        const r = d + i;
        put(7 + j, 7 - r, col);
        put(7 + j, 7 + r, col);
        put(7 - r, 7 + j, col);
        put(7 + r, 7 + j, col);
      }
  });
}

// Over a unit with nothing selected: white corners, h pixels out from the
// middle, breathing in and out (see CORNER_FRAMES).
function cornerRows(h: number): string[] {
  return drawn((put) => {
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (let i = 0; i < 3; i++) {
          put(7 + sx * (h - i), 7 + sy * h, 'w');
          put(7 + sx * h, 7 + sy * (h - i), 'w');
        }
  });
}

export const CURSORS = {} as Record<CursorKind, string>;
// MOVE_FRAMES[d]: the move cursor with its arrowheads d pixels out; the last is the resting one.
export const MOVE_FRAMES: string[] = [];
// The corners cursor through one breath.
export const CORNER_FRAMES: string[] = [];

// Build every cursor and publish them as --cur-<kind> on the page.
export function initCursors(): void {
  for (let d = 0; d <= 4; d++) MOVE_FRAMES.push(gridCss(moveRows(d), [7, 7], FALLBACK.move));
  for (const h of [4, 5, 6, 5]) CORNER_FRAMES.push(gridCss(cornerRows(h), [7, 7], FALLBACK.corners));
  const root = document.documentElement.style;
  for (const kind of Object.keys(FALLBACK) as CursorKind[]) {
    if (kind === 'none') CURSORS[kind] = 'none';
    else if (kind === 'move') CURSORS[kind] = MOVE_FRAMES[4];
    else if (kind === 'corners') CURSORS[kind] = CORNER_FRAMES[0];
    else CURSORS[kind] = gridCss(ART[kind].rows, ART[kind].hot, FALLBACK[kind]);
    root.setProperty(`--cur-${kind}`, CURSORS[kind]);
  }
}
