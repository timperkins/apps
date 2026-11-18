// Little pixel-art icons for the HUD, drawn as rows of characters so they are
// easy to tweak: each character is a color from the palette ('.' is clear).
// They come out as inline SVG strings, one <rect> per run of a color.

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
