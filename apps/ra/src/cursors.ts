// Pixel-art mouse cursors. Each is a 16x16 grid drawn at 2x, so its pixels
// match the chunky pixels of the game. They are turned into CSS cursor values
// once, at start-up, and set as --cur-* variables on the page for style.css.
//
// The cursor over a unit is not here: the game draws a spinning ring round the
// unit instead (see drawHover in v2/game.ts) and hides the pointer.

export type CursorKind = 'arrow' | 'hand' | 'grab' | 'grabbing' | 'move' | 'rally' | 'blocked' | 'build' | 'none';

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
const ART: Record<Exclude<CursorKind, 'none'>, { rows: string[]; hot: [number, number] }> = {
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
  // four arrowheads closing in on the spot the units will go
  move: {
    hot: [7, 7],
    rows: [
      '....kkkkkkk.....',
      '....kGGGGGk.....',
      '.....kgggk......',
      '......kgk.......',
      'kk.....k.....kk.',
      'kGk.........kGk.',
      'kGgk.......kgGk.',
      'kGggk..k..kggGk.',
      'kGgk.......kgGk.',
      'kGk.........kGk.',
      'kk.....k.....kk.',
      '......kgk.......',
      '.....kgggk......',
      '....kgggggk.....',
      '....kkkkkkk.....',
      '................',
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
  rally: 'crosshair',
  blocked: 'not-allowed',
  build: 'crosshair',
  none: 'none',
};

const SCALE = 2;

function toCss(kind: Exclude<CursorKind, 'none'>): string {
  const { rows, hot } = ART[kind];
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
  const url = c.toDataURL('image/png');
  return `url(${url}) ${hot[0] * SCALE} ${hot[1] * SCALE}, ${FALLBACK[kind]}`;
}

export const CURSORS = {} as Record<CursorKind, string>;

// Build every cursor and publish them as --cur-<kind> on the page.
export function initCursors(): void {
  const root = document.documentElement.style;
  for (const kind of Object.keys(FALLBACK) as CursorKind[]) {
    CURSORS[kind] = kind === 'none' ? 'none' : toCss(kind);
    root.setProperty(`--cur-${kind}`, CURSORS[kind]);
  }
}
