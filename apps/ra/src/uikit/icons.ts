// The icon sets for the UI kit. The pixel set is the game's own 11x11 HUD
// icons (from index.html); the line set draws the same things as thin vector
// strokes, and the solid set as filled shapes. The other sets are made from
// these (see prepareIcons). All use currentColor, so the design colors them.

import { LINE, type IconName as AnyIcon } from '../line-icons';

// the icons the kit shows (the game has a couple more)
export type IconName = Exclude<AnyIcon, 'star' | 'pack'>;

const R = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

const PIXEL: Record<IconName, string> = {
  menu: R(1, 2, 9, 2) + R(1, 5, 9, 2) + R(1, 8, 9, 2),
  select: R(2, 1, 1, 8) + R(3, 2, 1, 6) + R(4, 3, 1, 5) + R(5, 4, 1, 3) + R(6, 5, 1, 2) + R(7, 6, 1, 1) + R(5, 7, 1, 1) + R(6, 8, 1, 2),
  home: R(5, 0, 1, 1) + R(4, 1, 3, 1) + R(3, 2, 5, 1) + R(2, 3, 7, 1) + R(1, 4, 9, 1) + R(0, 5, 11, 1) + R(1, 6, 3, 5) + R(7, 6, 3, 5) + R(4, 6, 3, 2) + R(8, 1, 2, 3),
  build: R(1, 1, 6, 3) + R(0, 2, 1, 2) + R(7, 2, 2, 1) + R(4, 4, 2, 7),
  group: R(4, 1, 3, 3) + R(0, 3, 2, 8) + R(9, 3, 2, 8) + R(3, 5, 5, 6),
  all: R(0, 0, 3, 1) + R(0, 0, 1, 3) + R(8, 0, 3, 1) + R(10, 0, 1, 3) + R(0, 10, 3, 1) + R(0, 8, 1, 3) + R(8, 10, 3, 1) + R(10, 8, 1, 3) + R(3, 3, 2, 2) + R(6, 3, 2, 2) + R(3, 6, 2, 2) + R(6, 6, 2, 2),
  clear: R(0, 0, 2, 1) + R(9, 0, 2, 1) + R(0, 1, 3, 1) + R(8, 1, 3, 1) + R(1, 2, 3, 1) + R(7, 2, 3, 1) + R(2, 3, 3, 1) + R(6, 3, 3, 1) + R(3, 4, 5, 1) + R(4, 5, 3, 1) + R(3, 6, 5, 1) + R(2, 7, 3, 1) + R(6, 7, 3, 1) + R(1, 8, 3, 1) + R(7, 8, 3, 1) + R(0, 9, 3, 1) + R(8, 9, 3, 1) + R(0, 10, 2, 1) + R(9, 10, 2, 1),
  close: R(1, 1, 2, 2) + R(3, 3, 2, 2) + R(5, 5, 1, 1) + R(6, 6, 2, 2) + R(8, 8, 2, 2) + R(8, 1, 2, 2) + R(6, 3, 2, 2) + R(3, 6, 2, 2) + R(1, 8, 2, 2),
  shuffle: R(3, 1, 5, 1) + R(2, 2, 1, 1) + R(8, 2, 1, 1) + R(1, 3, 1, 5) + R(9, 3, 1, 2) + R(7, 4, 4, 1) + R(8, 5, 2, 1) + R(2, 8, 1, 1) + R(8, 8, 1, 1) + R(3, 9, 5, 1) + R(9, 7, 1, 1),
  units: R(1, 1, 4, 4) + R(6, 1, 4, 4) + R(1, 6, 4, 4) + R(6, 6, 4, 4),
  check: R(1, 5, 2, 2) + R(3, 7, 2, 2) + R(5, 5, 2, 2) + R(7, 3, 2, 2) + R(9, 1, 1, 2),
  deploy: R(5, 0, 1, 6) + R(3, 3, 5, 1) + R(4, 4, 3, 1) + R(0, 7, 11, 1) + R(0, 8, 1, 3) + R(10, 8, 1, 3) + R(0, 10, 11, 1),
  gear: R(4, 0, 3, 2) + R(4, 9, 3, 2) + R(0, 4, 2, 3) + R(9, 4, 2, 3) + R(2, 2, 7, 7) + R(1, 1, 2, 2) + R(8, 1, 2, 2) + R(1, 8, 2, 2) + R(8, 8, 2, 2),
  back: R(6, 1, 2, 2) + R(4, 3, 2, 2) + R(2, 5, 2, 1) + R(4, 6, 2, 2) + R(6, 8, 2, 2),
  flag: R(2, 0, 1, 11) + R(3, 1, 6, 1) + R(3, 2, 7, 3) + R(3, 5, 6, 1),
  bolt: R(5, 0, 3, 1) + R(4, 1, 3, 2) + R(3, 3, 6, 1) + R(5, 4, 3, 1) + R(4, 5, 3, 2) + R(3, 7, 2, 2) + R(2, 9, 2, 2),
  coin: R(3, 0, 5, 1) + R(1, 1, 9, 1) + R(0, 2, 11, 7) + R(1, 9, 9, 1) + R(3, 10, 5, 1),
  play: R(2, 1, 2, 9) + R(4, 2, 2, 7) + R(6, 3, 2, 5) + R(8, 4, 2, 3),
  users: R(1, 1, 3, 3) + R(7, 1, 3, 3) + R(0, 5, 5, 5) + R(6, 5, 5, 5),
  bot: R(5, 0, 1, 2) + R(1, 2, 9, 7) + R(0, 4, 1, 3) + R(10, 4, 1, 3) + R(2, 9, 2, 2) + R(7, 9, 2, 2),
};

// Holes for a few pixel icons, so they read: drawn in the background color
// would need a color, so instead the shapes above are already hollow where it
// matters, and a few get an inner cut-out here (fill-rule evenodd isn't
// available for rects).
const PIXEL_CUT: Partial<Record<IconName, string>> = {
  gear: R(4, 4, 3, 3),
  bot: R(3, 4, 2, 2) + R(6, 4, 2, 2),
  coin: R(4, 3, 3, 1) + R(3, 4, 1, 3) + R(4, 7, 3, 1),
};


// Smooth solid: the same drawings as filled shapes. Lines that have nothing
// to fill (menu, close, check…) stay as heavier strokes.
const SOLID: Record<IconName, { f?: string; s?: string }> = {
  menu: { s: LINE.menu },
  select: { f: LINE.select },
  home: { f: '<path d="M12 3L2.5 11.2H5.5V20.5h5v-5.5h3v5.5h5V11.2h3z"/>' },
  build: { f: LINE.build },
  group: { f: '<circle cx="12" cy="7" r="3"/><path d="M7 20.5v-4a5 5 0 0 1 10 0v4z"/><circle cx="4.8" cy="9.6" r="2.2"/><circle cx="19.2" cy="9.6" r="2.2"/><path d="M1.5 19.5v-2a3.6 3.6 0 0 1 4.6-3.4 6.5 6.5 0 0 0-.1 1.4v4zM22.5 19.5v-2a3.6 3.6 0 0 0-4.6-3.4 6.5 6.5 0 0 1 .1 1.4v4z"/>' },
  all: { s: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/>', f: '<rect x="8" y="8" width="8" height="8" rx="1.2"/>' },
  clear: { s: LINE.clear },
  close: { s: LINE.close },
  shuffle: { s: LINE.shuffle },
  units: { f: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>' },
  check: { s: LINE.check },
  deploy: { f: '<path d="M10.3 2.5h3.4v6.8h3.8L12 15 6.5 9.3h3.8z"/>', s: '<path d="M4 15v5h16v-5"/>' },
  gear: { f: '<path fill-rule="evenodd" d="M10.3 2h3.4l.5 2.7 1.7.7 2.3-1.6 2.4 2.4-1.6 2.3.7 1.7 2.3.5v3.4l-2.7.5-.7 1.7 1.6 2.3-2.4 2.4-2.3-1.6-1.7.7-.5 2.7h-3.4l-.5-2.7-1.7-.7-2.3 1.6-2.4-2.4 1.6-2.3-.7-1.7L2 13.7v-3.4l2.7-.5.7-1.7-1.6-2.3 2.4-2.4 2.3 1.6 1.7-.7zM12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"/>' },
  back: { s: LINE.back },
  flag: { s: '<path d="M6 21V3.5"/>', f: '<path d="M6 3h12.5l-3 4.8 3 4.7H6z"/>' },
  bolt: { f: LINE.bolt },
  coin: { f: '<circle cx="12" cy="12" r="9"/>' },
  play: { f: '<path d="M6.5 3.5v17l14-8.5z"/>' },
  users: { f: '<circle cx="8.5" cy="7.5" r="3.5"/><path d="M1.5 20.5v-2.5a7 7 0 0 1 14 0v2.5z"/><circle cx="17.5" cy="8.5" r="2.8"/><path d="M16.8 20.5V18a8.4 8.4 0 0 0-1.6-4.8 5.2 5.2 0 0 1 7.3 4.8v2.5z"/>' },
  bot: { s: '<path d="M12 3v4M2.5 11.5v4M21.5 11.5v4"/>', f: '<path fill-rule="evenodd" d="M6.5 6.5h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3zM9 11.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zm6 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/>' },
};

const solidInner = (name: IconName) => `${SOLID[name].f ? `<g stroke="none">${SOLID[name].f}</g>` : ''}${SOLID[name].s ? `<g fill="none">${SOLID[name].s}</g>` : ''}`;

// pixel: the game's own chunky 11x11 icons. outline: those with a dark edge.
// glyph: the solid drawings as pixel art on a 12-pixel grid. fine: the line
// drawings as one-pixel lines on a 16-pixel grid. solid and line: smooth
// vectors. The pixel versions of the drawings are made once at start-up by
// rasterizing them (prepareIcons).
export type IconSet = 'pixel' | 'outline' | 'glyph' | 'fine' | 'solid' | 'line';

const fine = new Map<IconName, string>();
const glyph = new Map<IconName, string>();
const outline = new Map<IconName, string>();

function rasterize(svg: string, n: number): Promise<Uint8ClampedArray> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0, n, n);
      res(g.getImageData(0, 0, n, n).data);
    };
    img.onerror = rej;
    img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
}

// A grid of on/off pixels as rects, one run per row.
function runs(n: number, on: (x: number, y: number) => boolean, off = 0): string {
  let r = '';
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!on(x, y)) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < n && on(x + w, y)) w++;
      r += R(x + off, y + off, w, 1);
      x += w;
    }
  }
  return r;
}

// The game's pixel icons as a grid, holes cut out.
function pixelGrid(name: IconName): boolean[][] {
  const g = Array.from({ length: 11 }, () => Array<boolean>(11).fill(false));
  const paint = (rects: string, v: boolean) => {
    for (const m of rects.matchAll(/x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
      const [x, y, w, h] = m.slice(1).map(Number);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (j < 11 && i < 11) g[j][i] = v;
    }
  };
  paint(PIXEL[name], true);
  const cut = PIXEL_CUT[name];
  if (cut) paint(cut, false);
  return g;
}

export async function prepareIcons(): Promise<void> {
  const names = Object.keys(PIXEL) as IconName[];
  await Promise.all(
    names.map(async (name) => {
      const N = 16;
      const line = await rasterize(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${N}" height="${N}" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${LINE[name]}</svg>`, N);
      fine.set(name, runs(N, (x, y) => line[(y * N + x) * 4 + 3] > 110));
      const G = 12;
      const sol = await rasterize(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${G}" height="${G}" fill="#000" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${solidInner(name)}</svg>`, G);
      glyph.set(name, runs(G, (x, y) => sol[(y * G + x) * 4 + 3] > 120));
    }),
  );
  for (const name of names) {
    const g = pixelGrid(name);
    const at = (x: number, y: number) => g[y]?.[x] ?? false;
    // the edge: every pixel touching the icon (sideways or diagonally) that isn't in it
    const edge = runs(13, (x, y) => !at(x - 1, y - 1) && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x - 1 + dx, y - 1 + dy))));
    outline.set(name, `<g class="edge">${edge}</g>${runs(11, at, 1)}`);
  }
}

export function icon(name: IconName, set: IconSet, cls = 'ic'): string {
  const px = (kind: string, n: number, body: string) => `<svg class="${cls} ${kind}" viewBox="0 0 ${n} ${n}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  if (set === 'fine' && fine.has(name)) return px('fine', 16, fine.get(name)!);
  if (set === 'glyph' && glyph.has(name)) return px('glyph', 12, glyph.get(name)!);
  if (set === 'outline' && outline.has(name)) return px('outline', 13, outline.get(name)!);
  if (set === 'solid')
    return `<svg class="${cls} solid" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${solidInner(name)}</svg>`;
  if (set === 'line')
    return `<svg class="${cls} line" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[name]}</svg>`;
  const cut = PIXEL_CUT[name];
  const body = cut
    ? `<mask id="m-${name}"><rect width="11" height="11" fill="#fff"/><g fill="#000">${cut}</g></mask><g mask="url(#m-${name})">${PIXEL[name]}</g>`
    : PIXEL[name];
  return px('pixel', 11, body);
}

// The game's own gold coin, used by every design for credits and prices
// (some recolor it with a CSS filter).
export const COIN_ART = (() => {
  const rows = ['..OOOOO..', '.OHHYYYO.', 'OHHYYYYDO', 'OHYYddYDO', 'OYYdYYYDO', 'OYYdYYYDO', 'OYYYYYDDO', '.ODDDDDO.', '..OOOOO..'];
  const pal: Record<string, string> = { O: '#5c3a06', H: '#fff1a8', Y: '#f2c230', D: '#c58a14', d: '#a87210' };
  let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`; }));
  return `<svg class="coin" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
})();
