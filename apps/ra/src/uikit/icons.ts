// Two icon sets for the UI kit. The pixel set is the game's own 11x11 HUD
// icons (from index.html); the line set draws the same things as thin vector
// strokes, for the designs that move away from chunky pixels. Both use
// currentColor, so each design colours them.

export type IconName =
  | 'menu' | 'select' | 'home' | 'build' | 'group' | 'all' | 'clear' | 'close'
  | 'shuffle' | 'units' | 'check' | 'deploy' | 'gear' | 'back' | 'flag' | 'bolt' | 'coin' | 'play' | 'users' | 'bot';

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

// Holes for a few pixel icons, so they read: drawn in the background colour
// would need a colour, so instead the shapes above are already hollow where it
// matters, and a few get an inner cut-out here (fill-rule evenodd isn't
// available for rects).
const PIXEL_CUT: Partial<Record<IconName, string>> = {
  gear: R(4, 4, 3, 3),
  bot: R(3, 4, 2, 2) + R(6, 4, 2, 2),
  coin: R(4, 3, 3, 1) + R(3, 4, 1, 3) + R(4, 7, 3, 1),
};

const LINE: Record<IconName, string> = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  select: '<path d="M6 3l12 9-5.5 1.2L15.5 20l-2.6 1.1-3-6.6L6 18z"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5h3v5H18V9.5"/>',
  build: '<path d="M14.5 6.5a4 4 0 0 1 5-1.6l-2.6 2.6.4 2.2 2.2.4 2.6-2.6a4 4 0 0 1-5.4 4.8L9 20a2 2 0 0 1-3-3l7.7-7.7a4 4 0 0 1 .8-2.8z"/>',
  group: '<circle cx="12" cy="7" r="2.6"/><path d="M7.5 20v-3.5a4.5 4.5 0 0 1 9 0V20"/><circle cx="5" cy="9.5" r="1.8"/><circle cx="19" cy="9.5" r="1.8"/><path d="M2.5 19v-2a3 3 0 0 1 3-3M21.5 19v-2a3 3 0 0 0-3-3"/>',
  all: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
  clear: '<path d="M6 6l12 12M18 6L6 18"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  shuffle: '<path d="M3 7h3.5c4 0 6.5 10 11 10H21M3 17h3.5c1.6 0 2.8-1.5 4-3.4M13.5 9.6c1.1-1.5 2.3-2.6 4-2.6H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  units: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  deploy: '<path d="M12 3v10M8 9.5l4 4 4-4"/><path d="M4 15v5h16v-5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  flag: '<path d="M6 21V3.5"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  bolt: '<path d="M13.5 2.5L5 13.5h6l-1.5 8L18 10.5h-6z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9a3 3 0 1 0 0 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  users: '<circle cx="8.5" cy="8" r="3"/><path d="M2.5 20v-2a6 6 0 0 1 12 0v2"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14a5 5 0 0 1 5.5 5v1"/>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="2.5"/><path d="M12 3.5V7M2 12v3M22 12v3"/><circle cx="9" cy="13" r="1.4"/><circle cx="15" cy="13" r="1.4"/>',
};

// pixel: the game's own chunky 11x11 icons. line: thin vector strokes.
// duo: the line icons with a soft see-through fill (two-tone).
// fine: the line icons redrawn as small pixel art (16x16, one-pixel lines
// with a faint fill), made by rasterizing them once at start-up (prepareIcons).
export type IconSet = 'pixel' | 'line' | 'duo' | 'fine';

const fine = new Map<IconName, string>();

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

export async function prepareIcons(): Promise<void> {
  const N = 16;
  await Promise.all(
    (Object.keys(LINE) as IconName[]).map(async (name) => {
      const wrap = (attrs: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${N}" height="${N}" ${attrs}>${LINE[name]}</svg>`;
      const [stroke, fill] = await Promise.all([
        rasterize(wrap('fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"'), N),
        rasterize(wrap('fill="#000" stroke="none"'), N),
      ]);
      let solid = '';
      let soft = '';
      for (let y = 0; y < N; y++) {
        let x = 0;
        while (x < N) {
          const kind = (i: number) => (stroke[(y * N + i) * 4 + 3] > 110 ? 2 : fill[(y * N + i) * 4 + 3] > 128 ? 1 : 0);
          const k = kind(x);
          let w = 1;
          while (x + w < N && kind(x + w) === k) w++;
          if (k === 2) solid += R(x, y, w, 1);
          else if (k === 1) soft += R(x, y, w, 1);
          x += w;
        }
      }
      fine.set(name, `<g opacity=".3">${soft}</g>${solid}`);
    }),
  );
}

export function icon(name: IconName, set: IconSet, cls = 'ic'): string {
  if (set === 'fine' && fine.has(name))
    return `<svg class="${cls} fine" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${fine.get(name)}</svg>`;
  if (set === 'duo')
    return `<svg class="${cls} duo" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g fill="currentColor" fill-opacity=".28" stroke="none">${LINE[name]}</g><g fill="none" stroke="currentColor" stroke-width="var(--icon-stroke, 2)">${LINE[name]}</g></svg>`;
  if (set === 'line')
    return `<svg class="${cls} line" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[name]}</svg>`;
  const cut = PIXEL_CUT[name];
  const body = cut
    ? `<mask id="m-${name}"><rect width="11" height="11" fill="#fff"/><g fill="#000">${cut}</g></mask><g mask="url(#m-${name})">${PIXEL[name]}</g>`
    : PIXEL[name];
  return `<svg class="${cls} pixel" viewBox="0 0 11 11" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}

// The game's own gold coin, used by every design for credits and prices
// (some recolour it with a CSS filter).
export const COIN_ART = (() => {
  const rows = ['..OOOOO..', '.OHHYYYO.', 'OHHYYYYDO', 'OHYYddYDO', 'OYYdYYYDO', 'OYYdYYYDO', 'OYYYYYDDO', '.ODDDDDO.', '..OOOOO..'];
  const pal: Record<string, string> = { O: '#5c3a06', H: '#fff1a8', Y: '#f2c230', D: '#c58a14', d: '#a87210' };
  let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`; }));
  return `<svg class="coin" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
})();
