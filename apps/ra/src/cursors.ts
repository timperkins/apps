// Pixel-art mouse cursors. Each is a 16x16 grid drawn at 2x, so its pixels
// match the chunky pixels of the game. They are turned into CSS cursor values
// once, at start-up, and set as --cur-* variables on the page for style.css.
//
// The move cursor turns and plays a burst on click, the corners cursor (over
// a unit you can pick) breathes, and the attack cursor (over an enemy your
// units can fire on) is the move cursor in red: the same four arrowheads,
// turning the same way, with a red burst on click. The harvest cursor spins
// as the move cursor does: main.ts steps through their frames. The deploy
// cursor (over a selected unit of yours that can deploy, dig in or let its
// soldiers out) and the harvest cursor (over ore with an ore hauler selected)
// are the move cursor in orange and gold, turning the same way, with a gold
// burst on click. The enter cursor (soldiers onto a transport, an ore hauler
// onto its refinery) is three yellow triangles stacked one over another,
// pointing down at the spot, a light running down them, with a gold burst
// when clicked. The repair cursor (an engineer onto a damaged bridge's
// blockhouse or a damaged building of yours) is a steel wrench, rocking as
// if turning a nut, with a gold burst when clicked.

export type CursorKind = 'arrow' | 'hand' | 'grab' | 'grabbing' | 'move' | 'corners' | 'attack' | 'harvest' | 'deploy' | 'enter' | 'rally' | 'blocked' | 'build' | 'repair';

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
  o: '#f0901e', // orange
};

// Rows of 16 characters, '.' is clear. hot is the click point.
const ART: Record<Exclude<CursorKind, 'move' | 'corners' | 'attack' | 'harvest' | 'deploy' | 'enter' | 'repair'>, { rows: string[]; hot: [number, number] }> = {
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
  harvest: 'crosshair',
  deploy: 'crosshair',
  enter: 'pointer',
  repair: 'pointer',
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

// The arrowheads' colors: green (move), red (attack) or orange and gold (deploy, harvest).
type Tint = 'green' | 'red' | 'gold';
const TINT: Record<Tint, [string, string]> = { green: ['g', 'G'], red: ['r', 'R'], gold: ['o', 'Y'] };
function moveRows(a: number, f: MoveFrame, tint: Tint = 'green'): string[] {
  const [dark, light] = TINT[tint];
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

// Three yellow triangles, one over another, pointing down with the lowest
// tip at (cx, tip). big: 7 pixels across and 4 down, 5 apart; otherwise 5
// across and 3 down, 4 apart. lit: which one (0 the top) the light is on.
function chevrons(put: (x: number, y: number, col: string) => void, cx: number, tip: number, big: boolean, lit = -1): void {
  const h = big ? 4 : 3;
  const gap = big ? 5 : 4;
  for (let i = 0; i < 3; i++) {
    const ty = tip - (2 - i) * gap; // this one's tip
    for (let r = 0; r < h; r++) {
      const half = h - 1 - r;
      const y = ty - half;
      for (let x = -half; x <= half; x++) put(cx + x, y, i === lit ? 'Y' : r === 0 || x === -half ? 'Y' : 'y');
    }
  }
}

// The attack cursor turns through a quarter turn (it looks the same each
// quarter) in MOVE_STEPS frames: the turn at frame i.
const spin = (i: number) => (i / MOVE_STEPS) * (Math.PI / 2);

// The enter cursor, through one run of the light down the
// triangles (and a beat with it off), bobbing a pixel as it goes.
const CHEV_STEPS = 4;
function chevronRows(i: number): string[] {
  return drawn(17, (put) => chevrons(put, 8, 14 + (i >= 2 ? 1 : 0), true, i < 3 ? i : -1));
}

// A click plays CHEV_CLICK: the triangles drop onto the spot, snap in to a
// white flash, a gold ring bursts out from it, and they come back above it.
// (tip: where the lowest tip is, above the spot; none: hidden)
interface ChevFrame {
  tip?: number;
  flash?: number;
  ring?: number;
  dots?: boolean;
}
const CHEV_CLICK: ChevFrame[] = [
  { tip: 4 },
  { tip: 2 },
  { tip: 0, flash: 1.5 },
  { flash: 2.5, ring: 3 },
  { ring: 5 },
  { ring: 7 },
  { tip: 3, ring: 9, dots: true },
  { tip: 2, ring: 11, dots: true },
];
export const ATTACK_CLICK_FRAMES = CHEV_CLICK.length;
export const ENTER_CLICK_FRAMES = CHEV_CLICK.length;

function chevClickRows(f: ChevFrame): string[] {
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
    if (f.tip !== undefined) chevrons(put, MC, MC - f.tip, false);
    if (f.flash)
      for (let y = 0; y < MS; y++)
        for (let x = 0; x < MS; x++) if (Math.hypot(x - MC, y - MC) <= f.flash) put(x, y, 'w');
  });
}

// ---------- The repair cursor ----------
// A wrench: a steel handle with a gold grip and an open jaw at the top,
// turned by angle a about (cx, cy), the jaw's middle.
function wrench(put: (x: number, y: number, col: string) => void, cx: number, cy: number, a: number, size: number): void {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const vx = x - cx;
      const vy = y - cy;
      // along the handle (down and to the left of the jaw) and across it
      const s = -(vx * ca + vy * sa);
      const t = -vx * sa + vy * ca;
      const r = Math.hypot(vx, vy);
      // the head: a ring round the jaw, open on the far side
      if (r <= 4.1 && r >= 1.4 && !(s < 0.5 && Math.abs(t) < 1.5)) put(x, y, s > 1 || t > 0.5 ? 's' : 'w');
      // the handle
      else if (s > 2.8 && s < 11.5 && Math.abs(t) <= 1.05) put(x, y, s > 7 ? (t > 0 ? 'y' : 'Y') : t > 0.3 ? 's' : 'w');
    }
}
// Rocking through REPAIR_STEPS frames (and the angle at each).
const REPAIR_STEPS = 6;
const rock = (i: number) => -Math.PI / 4 + Math.sin((i / REPAIR_STEPS) * Math.PI * 2) * 0.35;
const RS = 17;
const repairRows = (i: number) => drawn(RS, (put) => wrench(put, 10, 6, rock(i), RS));
// A click: the wrench gives a hard turn, then a gold ring bursts out of the jaw.
const REPAIR_CLICK: { a: number; ring?: number; dots?: boolean; flash?: number }[] = [
  { a: -0.2 },
  { a: 0.25, flash: 1.5 },
  { a: 0.5, flash: 2.5, ring: 3 },
  { a: 0.35, ring: 5 },
  { a: 0.1, ring: 7 },
  { a: -0.1, ring: 9, dots: true },
  { a: -0.3, ring: 11, dots: true },
  { a: -0.4, ring: 12, dots: true },
];
export const REPAIR_CLICK_FRAMES = REPAIR_CLICK.length;
function repairClickRows(f: (typeof REPAIR_CLICK)[number]): string[] {
  return drawn(MS, (put) => {
    for (let y = 0; y < MS; y++)
      for (let x = 0; x < MS; x++) {
        const r = Math.hypot(x - MC, y - MC);
        if (f.ring && Math.abs(r - f.ring) < 0.55) {
          const ang = Math.atan2(y - MC, x - MC);
          if (!f.dots || Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0) put(x, y, f.ring < 4 ? 'w' : 'Y');
        }
      }
    wrench(put, MC, MC, -Math.PI / 4 + f.a, MS);
    if (f.flash)
      for (let y = 0; y < MS; y++)
        for (let x = 0; x < MS; x++) if (Math.hypot(x - MC, y - MC) <= f.flash) put(x, y, 'w');
  });
}
// The repair cursor through one rock, and its click burst.
export const REPAIR_FRAMES: string[] = [];
export const REPAIR_CLICK_CSS: string[] = [];

// The attack cursor's click burst, one CSS value per frame.
export const ATTACK_CLICK_CSS: string[] = [];
// The deploy and harvest cursor's (gold arrowheads snapping in).
export const DEPLOY_CLICK_CSS: string[] = [];
// The enter cursor's (the triangles dropping onto the spot).
export const ENTER_CLICK_CSS: string[] = [];

export const CURSORS = {} as Record<CursorKind, string>;
// The attack cursor through one quarter turn.
export const ATTACK_FRAMES: string[] = [];
// The corners cursor through one breath.
export const CORNER_FRAMES: string[] = [];
// The deploy and harvest cursor through one quarter turn.
export const DEPLOY_FRAMES: string[] = [];
// The enter cursor through one run of its light.
export const ENTER_FRAMES: string[] = [];

// Build every cursor and publish them as --cur-<kind> on the page.
export function initCursors(): void {
  for (const h of [4, 5, 6, 5]) CORNER_FRAMES.push(gridCss(cornerRows(h), [7, 7], FALLBACK.corners));
  for (let i = 0; i < MOVE_STEPS; i++) ATTACK_FRAMES.push(gridCss(moveRows(spin(i), { d: REST }, 'red'), [MC, MC], FALLBACK.attack));
  for (const f of MOVE_CLICK) ATTACK_CLICK_CSS.push(gridCss(moveRows(0, f, 'red'), [MC, MC], FALLBACK.attack));
  for (let i = 0; i < MOVE_STEPS; i++) DEPLOY_FRAMES.push(gridCss(moveRows(spin(i), { d: REST }, 'gold'), [MC, MC], FALLBACK.deploy));
  for (const f of MOVE_CLICK) DEPLOY_CLICK_CSS.push(gridCss(moveRows(0, f, 'gold'), [MC, MC], FALLBACK.deploy));
  for (let i = 0; i < CHEV_STEPS; i++) ENTER_FRAMES.push(gridCss(chevronRows(i), [8, 16], FALLBACK.enter));
  for (const f of CHEV_CLICK) ENTER_CLICK_CSS.push(gridCss(chevClickRows(f), [MC, MC], FALLBACK.enter));
  for (let i = 0; i < REPAIR_STEPS; i++) REPAIR_FRAMES.push(gridCss(repairRows(i), [10, 6], FALLBACK.repair));
  for (const f of REPAIR_CLICK) REPAIR_CLICK_CSS.push(gridCss(repairClickRows(f), [MC, MC], FALLBACK.repair));
  const root = document.documentElement.style;
  for (const kind of Object.keys(FALLBACK) as CursorKind[]) {
    if (kind === 'move') CURSORS[kind] = moveCursor(0);
    else if (kind === 'corners') CURSORS[kind] = CORNER_FRAMES[0];
    else if (kind === 'attack') CURSORS[kind] = ATTACK_FRAMES[0];
    else if (kind === 'harvest' || kind === 'deploy') CURSORS[kind] = DEPLOY_FRAMES[0];
    else if (kind === 'enter') CURSORS[kind] = ENTER_FRAMES[0];
    else if (kind === 'repair') CURSORS[kind] = REPAIR_FRAMES[0];
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
    for (let i = 0; i < MOVE_STEPS; i++) attackRing.push(gridCanvas(moveRows((i / MOVE_STEPS) * (Math.PI / 2), { d: 7 }, 'red'), 1).toDataURL('image/png'));
  return attackRing;
}
// The deploy cursor's gold arrowheads, turning round the confirm button for
// sending ore haulers to dig.
const goldRing: string[] = [];
export function harvestRingFrames(): string[] {
  if (!goldRing.length)
    for (let i = 0; i < MOVE_STEPS; i++) goldRing.push(gridCanvas(moveRows((i / MOVE_STEPS) * (Math.PI / 2), { d: 7 }, 'gold'), 1).toDataURL('image/png'));
  return goldRing;
}

// The enter cursor's triangles, standing over the confirm button for
// getting into a transport or onto a refinery and pointing down at it,
// through one run of their light. They need a taller picture than the
// arrowheads (ENTER_RING_SIZE across, centered on the button).
export const ENTER_RING_SIZE = 41;
const oreRingFrames: string[] = [];
export function enterRingFrames(): string[] {
  if (!oreRingFrames.length)
    for (let i = 0; i < CHEV_STEPS; i++) {
      const c = ENTER_RING_SIZE >> 1;
      oreRingFrames.push(gridCanvas(drawn(ENTER_RING_SIZE, (put) => chevrons(put, c, c - 8 + (i >= 2 ? 1 : 0), true, i < 3 ? i : -1)), 1).toDataURL('image/png'));
    }
  return oreRingFrames;
}

// The repair cursor's wrench, rocking over the confirm button for sending
// engineers to repair something (ENTER_RING_SIZE across, like the triangles).
const repairRing: string[] = [];
export function repairRingFrames(): string[] {
  if (!repairRing.length)
    for (let i = 0; i < REPAIR_STEPS; i++) {
      const c = ENTER_RING_SIZE >> 1;
      repairRing.push(gridCanvas(drawn(ENTER_RING_SIZE, (put) => wrench(put, c + 3, c - 11, rock(i), ENTER_RING_SIZE)), 1).toDataURL('image/png'));
    }
  return repairRing;
}

// The enter cursor's triangles as pictures for the map (a grid pixel to a
// map pixel), through one run of their light: the lowest tip is at
// (CHEV_TIP[0], CHEV_TIP[1]) in them. They float over a Foundry vehicle that
// has yet to deploy, pointing it out.
const chevMap: HTMLCanvasElement[] = [];
export const CHEV_TIP: [number, number] = [8, 14];
export function chevronFrames(): HTMLCanvasElement[] {
  if (!chevMap.length) for (let i = 0; i < CHEV_STEPS; i++) chevMap.push(gridCanvas(chevronRows(i), 1));
  return chevMap;
}

// ---------- The click bursts, drawn on the map ----------
// With touch there is no cursor, so the game draws the move or attack burst
// on the map where you tapped (gold for digging and deploying, the triangles
// for getting in): one grid pixel to a map pixel, centered on the tap
// (BURST_CENTER). BURST_FRAME is how long each frame shows, in seconds.

export const BURST_CENTER = MC;
export const BURST_FRAME = 0.055;
export type BurstKind = 'move' | 'attack' | 'harvest' | 'enter' | 'repair';
const bursts: Record<BurstKind, HTMLCanvasElement[]> = { move: [], attack: [], harvest: [], enter: [], repair: [] };
export function burstFrames(kind: BurstKind): HTMLCanvasElement[] {
  const out = bursts[kind];
  if (!out.length) {
    if (kind === 'enter') for (const f of CHEV_CLICK) out.push(gridCanvas(chevClickRows(f), 1));
    else if (kind === 'repair') for (const f of REPAIR_CLICK) out.push(gridCanvas(repairClickRows(f), 1));
    else for (const f of MOVE_CLICK) out.push(gridCanvas(moveRows(0, f, kind === 'attack' ? 'red' : kind === 'harvest' ? 'gold' : 'green'), 1));
  }
  return out;
}
