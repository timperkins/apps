// Little pixel-art icons for the HUD, drawn as rows of characters so they are
// easy to tweak: each character is a colour from the palette ('.' is clear).
// They come out as inline SVG strings, one <rect> per run of a colour.

type Palette = Record<string, string>;

function pixels(rows: string[], pal: Palette, cls = ''): string {
  const w = Math.max(...rows.map((r) => r.length));
  let rects = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let n = 1;
      while (row[x + n] === ch) n++;
      if (ch !== '.' && pal[ch]) rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${pal[ch]}"/>`;
      x += n;
    }
  });
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 ${w} ${rows.length}" width="${w}" height="${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

const OUT = '#1d140b';

// A gold coin, for credits and prices.
export const COIN = pixels(
  [
    '..OOOOO..', //
    '.OHHYYYO.',
    'OHHYYYYDO',
    'OHYYddYDO',
    'OYYdYYYDO',
    'OYYdYYYDO',
    'OYYYYYDDO',
    '.ODDDDDO.',
    '..OOOOO..',
  ],
  { O: '#5c3a06', H: '#fff1a8', Y: '#f2c230', D: '#c58a14', d: '#a87210' },
  'coin',
);

// A lightning bolt, for power.
export const BOLT = pixels(
  [
    '...OOOO', //
    '..OYYO.',
    '.OYYO..',
    'OYYYYYO',
    'OOOYYO.',
    '..OYO..',
    '.OYO...',
    '.OO....',
  ],
  { O: OUT, Y: '#ffe45c' },
  'bolt',
);

// Icons for the build menu's tabs.
export const TAB_ICONS: Record<string, string> = {
  // a workshop with a chimney
  base: pixels(
    [
      '........OO..', //
      '........OO..',
      '...OOO..OO..',
      '..ORRRO.OO..',
      '.ORRRRRORO..',
      'ORRRRRRRRRRO',
      'OWWWWWWWWWWO',
      'OWBBWWBBWWWO',
      'OWBBWWBBWDDO',
      'OWWWWWWWWDDO',
      'OWWWWWWWWDDO',
      'OOOOOOOOOOOO',
    ],
    { O: OUT, R: '#4f74a8', W: '#d6cfb8', B: '#8fd0ff', D: '#6b4a2e' },
  ),
  // a quartered shield
  defense: pixels(
    [
      '.OOOOOOOOOO.', //
      'OBBBBBSSSSSO',
      'OBHBBBSSSSSO',
      'OBBBBBSSSSSO',
      'OBBBBBSSSSSO',
      'OSSSSSBBBBBO',
      'OSSSSSBBBBBO',
      '.OSSSSBBBBO.',
      '.OSSSSBBBBO.',
      '..OSSSBBBO..',
      '...OOSBOO...',
      '.....OO.....',
    ],
    { O: OUT, B: '#4f74a8', H: '#8fb2dc', S: '#d9dde2' },
  ),
  // a soldier in a helmet
  inf: pixels(
    [
      '...OOOOOO...', //
      '..OHHHHhHO..',
      '.OHHHHHHHhO.',
      'OOOOOOOOOOOO',
      '..OSSSSSSO..',
      '..OSESSESO..',
      '..OSSSSSSO..',
      '...OSSSSO...',
      '.OOBBBBBBOO.',
      'OBBBBYYBBBBO',
      'OBBBBBBBBBBO',
      'OOOOOOOOOOOO',
    ],
    { O: OUT, H: '#6f7d3a', h: '#94a352', S: '#e9b98c', E: OUT, B: '#4f74a8', Y: '#f2c230' },
  ),
  // a tank
  veh: pixels(
    [
      '............', //
      '...OOOOO....',
      '..OTTTTTO...',
      '..OTHTTTOOOO',
      '..OTTTTTOOOO',
      '.OOOOOOOOOO.',
      'OBBBBBBBBBBO',
      'OBBBBBBBBBBO',
      'OOOOOOOOOOOO',
      'OWOWOOWOWOWO',
      '.OOOOOOOOOO.',
      '............',
    ],
    { O: OUT, T: '#6d93c7', H: '#a9c6ec', B: '#4f74a8', W: '#9aa0a8' },
  ),
};
