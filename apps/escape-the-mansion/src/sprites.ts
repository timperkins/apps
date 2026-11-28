// Pixel-art sprites, painted in code on small grids and outlined automatically,
// in the style of the Lenny reference drawing (black outlines, flat muted colours).

export type Dir = 'down' | 'up' | 'side';

const PAL: Record<string, string> = {
  K: '#212121', // outline
  s: '#a1887f', // Lenny skin
  d: '#8d6e63', // skin shade
  b: '#6d4c41', // dirt
  h: '#3e2723', // hair
  H: '#5d4037', // hair highlight
  w: '#bdbdbd', // grey shirt
  g: '#9e9e9e', // shirt shade
  W: '#fafafa', // white
  L: '#e0e0e0', // light grey
  m: '#424242', // mouth
  e: '#d7ccc8', // eye shade
  t: '#00838f', // teal trousers
  T: '#006064', // dark teal
  // Jeff
  p: '#efe9e1', // pale skin
  q: '#cbbfb1', // pale shade
  o: '#0b0b0d', // jeff outline / black
  X: '#26262f', // tuxedo
  Y: '#3d3d4b', // lapel
  r: '#c62828', // red
  i: '#4a0e0e', // dark red iris
  u: '#8fd0ff', // sweat
  z: '#9e9e9e', // grey wisps
  // guards
  n: '#1f2a44', // navy cap
  N: '#2d3b5c', // cap highlight
  c: '#c9a27e', // guard skin
  C: '#a9825e', // guard skin shade
  v: '#454c56', // uniform
  V: '#353a42', // uniform shade
  y: '#f2c94c', // badge yellow
  // dog
  k: '#1b1b1b', // black coat
  a: '#a0602a', // tan
  A: '#7a4520', // tan shade
  // items
  G: '#2e7d32', // bottle green
  F: '#66bb6a', // bottle light
  R: '#8d6e63', // meat brown
  M: '#e57373', // meat pink
  O: '#ff9800', // orange spark
  S: '#757575', // stone
  P: '#9e9e9e', // stone light
  Q: '#5a5a5a', // stone dark
};

function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k + (k > 1 ? 6 : 0))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
}

class Painter {
  w: number;
  h: number;
  px: (string | null)[];
  ox = 0;
  oy = 0;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: string) {
    x += this.ox;
    y += this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  dots(c: string, pts: [number, number][]) {
    for (const [x, y] of pts) this.set(x, y, c);
  }
  row(y: number, x0: number, x1: number, c: string) {
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  /** Rim shading: darkens pixels on the lower/right edge of a shape, lightens the upper/left. */
  shade(colors: string[]) {
    const set = new Set(colors);
    const out = this.px.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c || !set.has(c)) continue;
        const hex = PAL[c] ?? c;
        const empty = (dx: number, dy: number) => {
          const n = this.get(x + dx, y + dy);
          return !n || n === 'K' || n === 'o';
        };
        if (empty(1, 0) || empty(0, 1)) out[y * this.w + x] = tint(hex, 0.78);
        else if (empty(-1, 0) || empty(0, -1)) out[y * this.w + x] = tint(hex, 1.14);
      }
    this.px = out;
  }
  /** Adds a 1px outline around everything painted so far. */
  outline(c = 'K') {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = PAL[c] ?? c;
        ctx.fillRect(x, y, 1, 1);
      }
    return cv;
  }
}

// ---------------------------------------------------------------- Lenny

/**
 * Lenny's look by stage: 0 (levels 1-20) terrified, filthy and twitchy, then step by step
 * (21-25, 26-30 ... 46-50) cleaner, calmer and more muscular until stage 6: smug and ripped.
 * pose: 0 scared tiptoe, 1 normal walk, 2 confident swagger.
 */
function paintLenny(st: number, dir: Dir, frame: number, twitch: boolean, pose: number): Painter {
  const p = new Painter(32, 32);
  const grime = [3, 2, 1, 1, 0, 0, 0][st];
  const m = [0, 0, 0, 1, 1, 2, 3][st];
  const aw = [3, 3, 3, 3, 4, 4, 5][st];
  const tank = st >= 4;
  const shirt = tank ? 'W' : 'w';
  const shade = tank ? 'L' : 'g';
  const tip = pose === 0;
  const swing = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const armSwing = pose === 2 ? swing * 2 : swing;
  const tx0 = 10 - m;
  const tx1 = 21 + m;

  // ---- legs (drawn without the body offset)
  if (dir === 'side') {
    if (tip) {
      // tiptoe: knee up in front, back foot on its toes
      const fwd = frame === 0 ? 0 : 1;
      p.rect(13, 25, 7, 2, 't');
      p.rect(13, 27, 3, 3, 'T');
      p.rect(13, 30, 3, 1, 'K');
      if (fwd) {
        p.rect(17, 26, 3, 2, 't');
        p.rect(18, 28, 4, 1, 'K');
      } else {
        p.rect(16, 27, 3, 3, 't');
        p.rect(16, 30, 4, 1, 'K');
      }
    } else {
      const fx = frame === 1 ? 3 : frame === 2 ? -3 : 0;
      p.rect(12, 25, 9, 2, 't');
      p.rect(14 - fx, 27, 4, 3, 'T');
      p.rect(14 + fx, 27, 4, 3, 't');
      p.rect(14 - fx, 30, 5, 1, 'K');
      p.rect(14 + fx, 30, 5, 1, 'K');
      p.set(18 + fx, 30, 'm');
    }
  } else if (tip) {
    // knees together, up on the toes, one foot lifted while walking
    p.rect(12, 25, 8, 2, 't');
    p.row(25, 12, 19, 'T');
    const lL = frame === 1 ? 2 : 0;
    const lR = frame === 2 ? 2 : 0;
    p.rect(12, 27 - lL, 3, 3, 't');
    p.rect(17, 27 - lR, 3, 3, 't');
    p.rect(12, 30 - lL, 3, 1, 'K');
    p.rect(17, 30 - lR, 3, 1, 'K');
  } else {
    const wide = pose === 2 ? 1 : 0;
    p.rect(11 - wide, 25, 10 + wide * 2, 2, 't');
    p.row(25, 11 - wide, 20 + wide, 'T');
    const legL = frame === 1 ? -1 : 0;
    const legR = frame === 2 ? -1 : 0;
    p.rect(11 - wide, 27 + legL, 4, 3, 't');
    p.rect(17 + wide, 27 + legR, 4, 3, 't');
    p.rect(11 - wide, 30, 4, 1, 'K');
    p.rect(17 + wide, 30, 4, 1, 'K');
    p.set(11 - wide, 27, 'T');
    p.set(20 + wide, 27, 'T');
  }

  // ---- upper body: hunched lower when tiptoeing, bobbing up on the step
  p.oy = tip ? (frame ? 0 : 1) : pose === 2 && frame ? -1 : 0;

  if (dir === 'side') {
    p.rect(12 - Math.floor(m / 2), 17, 9 + m, 8, shirt);
    p.rect(12 - Math.floor(m / 2), 17, 2, 8, shade);
    if (!tank && grime) p.dots('K', [[15, 20], [16, 21], [18, 23]]);
    if (tip) {
      // arms raised, hands up by the chin like a nervous mouse
      p.rect(15, 18, aw, 3, 's');
      p.rect(15, 17, aw, 2, st <= 3 ? shirt : 's');
      p.rect(18, 17, 3, 2, 's');
      p.dots('d', [[20, 18], [18, 18]]);
    } else {
      const ax = 14 + armSwing * 2;
      p.rect(ax, 18, aw, 6, 's');
      p.rect(ax, 17, aw, 2, st <= 3 ? shirt : 's');
      p.rect(ax, 24, aw, 2, 's');
      if (st >= 4) p.dots('d', [[ax, 20], [ax, 21]]);
    }
  } else {
    p.rect(tx0, 17, tx1 - tx0 + 1, 8, shirt);
    p.rect(tx0, 17, 2, 8, shade);
    p.rect(tx1 - 1, 17, 2, 8, shade);
    if (tank) {
      p.rect(tx0, 17, 3, 2, 's');
      p.rect(tx1 - 2, 17, 3, 2, 's');
      if (dir === 'down') {
        p.row(17, 14, 17, 's');
        p.set(13, 17, 'd');
        p.set(18, 17, 'd');
        if (st >= 5) {
          p.row(20, tx0 + 3, 15, 'L');
          p.row(20, 16, tx1 - 3, 'L');
        }
        if (st >= 6) p.dots('L', [[15, 22], [16, 22], [15, 24], [16, 24], [15, 23]]);
      }
    } else if (dir === 'down') {
      // collar
      p.row(17, 13, 18, 'g');
      p.row(18, 14, 17, 's');
    }
    if (dir === 'down' && !tank) {
      if (grime >= 1) {
        p.dots('K', [[13, 20], [14, 21], [19, 22], [18, 23]]);
        p.dots('g', [[13, 21], [18, 22]]);
      }
      if (grime >= 2) p.dots('K', [[12, 23], [20, 19]]), p.dots('s', [[13, 22], [19, 23]]);
      if (grime >= 3) p.dots('b', [[16, 24], [15, 19], [11, 21]]);
    }
    if (dir === 'up' && grime >= 1) p.dots('K', [[14, 20], [15, 21], [19, 23]]);

    const lx = tx0 - aw - (pose === 2 ? 1 : 0);
    const rx = tx1 + 1 + (pose === 2 ? 1 : 0);
    const sleeve = st <= 3 ? shirt : 's';
    if (tip && dir === 'down') {
      // upper arms tucked in, fists raised in front of the chest
      p.rect(lx + 1, 17, aw, 4, 's');
      p.rect(lx + 1, 17, aw, 2, sleeve);
      p.rect(rx - 1, 17, aw, 4, 's');
      p.rect(rx - 1, 17, aw, 2, sleeve);
      const hy = 19 + (frame === 1 ? -1 : 0);
      const hy2 = 19 + (frame === 2 ? -1 : 0);
      for (const [hx, yy] of [
        [tx0 + 1, hy],
        [tx1 - 3, hy2],
      ] as [number, number][]) {
        p.rect(hx - 1, yy - 1, 5, 4, 'K');
        p.rect(hx, yy, 3, 2, 's');
        p.set(hx + 1, yy + 1, 'd');
      }
    } else {
      const ls = dir === 'up' ? -armSwing : armSwing;
      p.rect(lx, 18 + ls, aw, 7, 's');
      p.rect(lx, 17 + ls, aw, 2, sleeve);
      p.rect(rx, 18 - ls, aw, 7, 's');
      p.rect(rx, 17 - ls, aw, 2, sleeve);
      p.rect(lx, 24 + ls, aw, 1, 'd');
      p.rect(rx, 24 - ls, aw, 1, 'd');
      if (st >= 4) {
        p.set(lx - 1, 19 + ls, 's');
        p.set(lx - 1, 20 + ls, 's');
        p.set(rx + aw, 19 - ls, 's');
        p.set(rx + aw, 20 - ls, 's');
        p.set(lx + 1, 21 + ls, 'd');
        p.set(rx + aw - 2, 21 - ls, 'd');
      }
      if (st >= 6) {
        p.set(lx - 1, 21 + ls, 's');
        p.set(rx + aw, 21 - ls, 's');
      }
      if (grime >= 2) p.dots('b', [[lx + 1, 22 + ls], [rx + 1, 20 - ls]]);
    }
  }

  // neck
  p.rect(13, 15, 6, 2, 's');
  p.row(16, 13, 18, 'd');

  // ---- head
  const messy = st <= 1;
  if (dir === 'side') {
    p.rect(9, 3, 15, 12, 's');
    p.rect(8, 5, 17, 8, 's');
    p.rect(10, 15, 12, 1, 's');
    p.dots('s', [[25, 10], [25, 11]]);
    p.set(24, 12, 'd');
    p.rect(8, 1, 16, 5, 'h');
    p.rect(7, 3, 6, 10, 'h');
    p.rect(13, 6, 4, 1, 'h');
    if (messy) p.dots('h', [[9, 0], [12, 0], [13, 0], [17, 0], [20, 0], [24, 3], [25, 4], [6, 5], [6, 8], [21, 6], [22, 6]]);
    else {
      p.row(1, 10, 21, 'H');
      p.row(2, 12, 18, 'H');
      p.rect(7, 11, 3, 3, 'h');
    }
    if (st >= 4) p.rect(7, 10, 2, 3, 's');
    p.rect(13, 8, 2, 3, 's');
    p.dots('d', [[13, 9], [14, 10]]);
    if (st <= 1) {
      p.rect(19, 8, 3, 3, 'W');
      p.set(21, 8, 'L');
      p.set(21, 9, 'K');
      if (twitch) p.row(8, 19, 21, 'K');
      p.row(6, 19, 22, 'h');
    } else {
      p.rect(20, 8, 2, 2, 'W');
      p.set(21, 9, 'K');
      p.row(7, 19, 22, 'h');
      if (st >= 4) p.row(8, 20, 21, 'd');
      if (st === 2 && twitch) p.row(8, 20, 21, 'K');
    }
    if (st <= 1) {
      p.row(12, 21, 23, 'W');
      p.row(13, 21, 23, 'm');
    } else if (st <= 3) p.row(13, 21, 23, 'm');
    else {
      p.row(13, 21, 23, 'm');
      p.set(24, 12, 'm');
    }
    if (grime >= 2) p.dots('b', [[16, 12], [17, 13], [19, 14]]);
    else if (grime === 1) p.dots('b', [[17, 13]]);
  } else if (dir === 'up') {
    p.rect(6, 3, 20, 12, 'h');
    p.rect(5, 5, 22, 8, 'h');
    p.rect(8, 15, 16, 1, 'h');
    p.rect(4, 8, 2, 3, 's');
    p.rect(26, 8, 2, 3, 's');
    p.row(1, 7, 24, 'h');
    p.row(2, 6, 25, 'h');
    if (messy) p.dots('h', [[8, 0], [11, 0], [12, 0], [16, 0], [19, 0], [23, 0], [3, 5], [28, 6], [4, 12], [27, 11]]);
    else p.dots('H', [[10, 3], [11, 3], [12, 4], [18, 3], [19, 4], [20, 4], [14, 6], [15, 7]]);
    if (st >= 3) p.rect(10, 13, 12, 3, 's');
  } else {
    p.rect(6, 3, 20, 12, 's');
    p.rect(5, 5, 22, 8, 's');
    p.rect(7, 14, 18, 1, 's');
    p.rect(9, 15, 14, 1, 's');
    // cheek shading
    p.dots('d', [[6, 12], [25, 12], [7, 13], [24, 13]]);
    // hair
    if (messy) {
      p.rect(4, 1, 23, 5, 'h');
      p.row(6, 4, 7, 'h');
      p.row(6, 16, 27, 'h');
      p.row(7, 22, 26, 'h');
      p.row(8, 25, 26, 'h');
      p.dots('h', [[6, 0], [7, 0], [9, 0], [10, 0], [11, 0], [13, 0], [14, 0], [17, 0], [18, 0], [21, 0], [22, 0], [24, 0], [3, 3], [3, 4], [27, 4], [28, 5]]);
      p.rect(10, 4, 4, 2, 's');
      p.row(6, 11, 15, 's');
      p.dots('s', [[6, 5], [17, 6]]);
      p.dots('H', [[8, 2], [9, 3], [16, 2], [20, 3], [23, 2]]);
    } else if (st <= 3) {
      p.rect(4, 1, 24, 5, 'h');
      p.row(6, 4, 9, 'h');
      p.row(6, 18, 27, 'h');
      p.dots('h', [[7, 0], [8, 0], [12, 0], [13, 0], [18, 0], [19, 0], [23, 0]]);
      if (st === 3) p.row(6, 4, 7, 'h'), p.row(6, 20, 27, 'h');
      p.rect(11, 5, 5, 1, 's');
      p.dots('H', [[9, 2], [10, 2], [11, 3], [17, 2], [18, 2], [21, 3]]);
    } else {
      p.rect(5, 1, 22, 4, 'h');
      p.row(0, 8, 23, 'h');
      p.row(5, 5, 7, 'h');
      p.row(5, 16, 26, 'h');
      p.row(6, 20, 26, 'h');
      p.row(2, 9, 14, 'H');
      p.row(1, 15, 22, 'H');
      if (st >= 6) p.row(3, 17, 23, 'H');
      p.set(15, 2, 's');
      p.set(15, 3, 'h');
    }
    // ears
    p.rect(3, 8, 2, 3, 's');
    p.rect(27, 8, 2, 3, 's');
    p.dots('d', [[4, 9], [27, 9]]);
    // nose
    p.dots('d', [[15, 9], [15, 10], [16, 11]]);
    p.set(14, 11, 'd');

    // eyes and brows
    if (st <= 1) {
      const eye = (x: number, look: number) => {
        p.rect(x, 8, 4, 3, 'W');
        p.set(x + 3, 8, 'L');
        p.set(x + 3, 10, 'e');
        p.set(x + 2 + look, 9, 'K');
      };
      eye(7, st === 0 ? 1 : 0);
      eye(18, st === 0 ? 1 : 0);
      if (twitch) {
        // a half twitch: the upper lid drops to the middle of the eye
        p.row(7, 7, 10, 'd');
        p.row(8, 7, 10, 'K');
        p.set(6, 8, 'd');
      }
      if (st === 1) {
        // worried brows
        p.dots('h', [[7, 6], [8, 6], [9, 5], [10, 5], [21, 6], [20, 6], [19, 5], [18, 5]]);
      }
    } else {
      const eye = (x: number) => {
        p.rect(x, 9, 3, 2, 'W');
        p.set(x + 1, 9, 'K');
        p.set(x + 1, 10, 'K');
      };
      eye(8);
      eye(19);
      if (st === 2) {
        p.dots('h', [[7, 7], [8, 7], [9, 6], [10, 6], [11, 6], [22, 7], [21, 7], [20, 6], [19, 6], [18, 6]]);
        if (twitch) p.row(9, 8, 10, 'd');
      } else if (st === 3) {
        p.row(7, 7, 11, 'h');
        p.row(7, 18, 22, 'h');
      } else if (st <= 5) {
        p.row(9, 8, 10, 'd');
        p.row(9, 19, 21, 'd');
        p.dots('h', [[7, 8], [8, 7], [9, 7], [10, 7], [11, 8], [18, 8], [19, 7], [20, 7], [21, 7], [22, 8]]);
      } else {
        p.row(9, 8, 10, 'd');
        p.dots('h', [[7, 8], [8, 7], [9, 7], [10, 7], [11, 7], [18, 6], [19, 6], [20, 6], [21, 6], [22, 7]]);
      }
    }

    // mouth
    if (st === 0) {
      p.dots('m', [[12, 12], [18, 12]]);
      p.row(13, 12, 18, 'm');
      p.dots('m', [[12, 14], [13, 14], [17, 14], [18, 14]]);
      p.row(12, 13, 17, 'W');
      p.set(15, 12, 'L');
    } else if (st === 1) {
      p.row(12, 13, 17, 'W');
      p.dots('m', [[12, 12], [18, 12]]);
      p.row(13, 12, 18, 'm');
    } else if (st === 2) {
      p.row(13, 14, 17, 'm');
      p.dots('m', [[13, 14], [18, 14]]);
    } else if (st === 3) {
      p.row(13, 13, 18, 'm');
    } else if (st === 4) {
      p.row(13, 13, 18, 'm');
      p.dots('m', [[12, 12], [19, 12]]);
    } else if (st === 5) {
      p.row(13, 13, 18, 'm');
      p.dots('m', [[12, 12], [19, 12]]);
      p.row(12, 14, 17, 'W');
    } else {
      p.row(13, 13, 18, 'm');
      p.dots('m', [[19, 12], [20, 11]]);
      p.dots('W', [[14, 12], [15, 12], [16, 12], [17, 12]]);
    }

    // grime and a cut lip early on
    if (grime >= 3) p.dots('b', [[8, 13], [9, 13], [9, 14], [23, 11], [22, 12], [24, 8], [17, 4], [6, 11]]);
    else if (grime === 2) p.dots('b', [[8, 13], [9, 14], [23, 11], [22, 12]]);
    else if (grime === 1) p.dots('b', [[23, 11]]);
    if (st === 0) p.set(19, 14, 'r');
  }

  p.oy = 0;
  p.shade(['s', 'w', 'W', 'h', 't', 'g']);
  p.outline('K');
  return p;
}

// ---------------------------------------------------------------- Jeff

/** Jeff's look by frazzle stage: 0 smug and immaculate ... 4 sweating, wild-eyed, tux torn. */
function paintJeff(st: number, dir: Dir, frame: number): Painter {
  const p = new Painter(32, 32);
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  // legs
  if (dir === 'side') {
    const fx = frame === 1 ? 2 : frame === 2 ? -2 : 0;
    p.rect(14 - fx, 26, 3, 4, 'X');
    p.rect(14 + fx, 26, 3, 4, 'X');
    p.rect(14 - fx, 30, 4, 1, 'o');
    p.rect(14 + fx, 30, 4, 1, 'o');
  } else {
    p.rect(12, 26 - (frame === 1 ? 1 : 0), 3, 4, 'X');
    p.rect(17, 26 - (frame === 2 ? 1 : 0), 3, 4, 'X');
    p.rect(12, 30 - (frame === 1 ? 1 : 0), 3, 1, 'o');
    p.rect(17, 30 - (frame === 2 ? 1 : 0), 3, 1, 'o');
    p.set(13, 30, 'Y');
  }

  // torso
  if (dir === 'side') {
    p.rect(13, 13, 6, 13, 'X');
    p.rect(17, 14, 2, 6, 'W');
    p.set(19, 14, 'o');
    const ax = 14 + swing * 2;
    p.rect(ax, 14, 2, 10, 'Y');
    p.rect(ax, 24, 2, 2, 'p');
  } else {
    p.rect(10, 13, 12, 13, 'X');
    if (dir === 'down') {
      // shirt V and lapels
      for (let r = 0; r < 7; r++) p.row(13 + r, 13 + Math.floor(r / 2), 18 - Math.floor(r / 2), 'W');
      p.dots('Y', [[12, 14], [12, 15], [13, 16], [13, 17], [14, 18], [19, 14], [19, 15], [18, 16], [18, 17], [17, 18]]);
      p.dots('o', [[15, 21], [15, 23]]);
      // bow tie
      const tilt = st >= 3 ? 1 : 0;
      p.row(13 + tilt, 13, 14, 'o');
      p.row(13, 17, 18, 'o');
      p.rect(15, 13, 2, 1 + tilt, 'o');
      if (st >= 2) p.set(16, 20, 'u');
      if (st >= 4) {
        // torn tux, untucked shirt
        p.dots('W', [[11, 25], [12, 25], [20, 24], [20, 25]]);
        p.dots('o', [[19, 21], [20, 22], [11, 19]]);
        p.dots('Y', [[20, 21], [11, 18]]);
      }
    }
    // arms
    p.rect(8, 14 + swing, 2, 10, 'X');
    p.rect(22, 14 - swing, 2, 10, 'X');
    p.rect(8, 24 + swing, 2, 2, 'p');
    p.rect(22, 24 - swing, 2, 2, 'p');
    if (st >= 4 && dir === 'down') p.dots('p', [[23, 22]]);
  }

  // head
  if (dir === 'side') {
    p.rect(12, 2, 9, 10, 'p');
    p.rect(11, 4, 11, 6, 'p');
    p.dots('p', [[22, 7], [22, 8], [21, 10]]); // nose
    p.rect(12, 12, 6, 1, 'p');
    p.row(6, 17, 21, 'o'); // brow
    p.set(19, 7, 'q');
    p.set(20, 7, st >= 3 ? 'r' : 'o');
    p.rect(13, 6, 2, 2, 'q'); // ear
    p.row(10, 18, 20, 'o');
    if (st <= 1) p.set(21, 9, 'o');
    if (st >= 2) p.dots('u', [[16, 3], [16, 4]]);
    if (st >= 3) p.dots('z', [[11, 1], [10, 2], [12, 0]]);
    p.row(3, 14, 18, 'q');
  } else if (dir === 'up') {
    p.rect(11, 1, 10, 11, 'p');
    p.rect(10, 3, 12, 7, 'p');
    p.rect(9, 6, 1, 3, 'p');
    p.rect(22, 6, 1, 3, 'p');
    p.rect(12, 12, 8, 1, 'p');
    p.dots('q', [[12, 9], [13, 10], [19, 10], [20, 9], [14, 4], [15, 4], [16, 4]]);
    if (st >= 3) p.dots('z', [[9, 3], [8, 4], [22, 3], [23, 2]]);
  } else {
    p.rect(11, 1, 10, 11, 'p');
    p.rect(10, 3, 12, 7, 'p');
    p.rect(9, 6, 1, 3, 'p');
    p.rect(22, 6, 1, 3, 'p');
    p.rect(12, 12, 8, 1, 'p');
    // shading and sunken cheeks
    p.rect(20, 3, 1, 8, 'q');
    p.dots('q', [[12, 10], [19, 10], [13, 8], [18, 8], [13, 3], [14, 3], [17, 3], [18, 3]]);
    // the unibrow
    p.row(5, 11, 20, 'o');
    p.dots('o', [[12, 6], [13, 6], [18, 6], [19, 6]]);
    if (st >= 3) p.dots('o', [[11, 4], [20, 4]]);
    // eyes
    if (st <= 2) {
      p.dots('W', [[13, 7], [18, 7]]);
      p.dots('o', [[14, 7], [17, 7]]);
    } else {
      p.rect(13, 7, 2, 2, 'W');
      p.rect(17, 7, 2, 2, 'W');
      p.dots('i', [[14, 7], [17, 7]]);
      p.dots('r', [[13, 8], [18, 8]]);
    }
    // nose
    p.dots('q', [[15, 8], [16, 9], [15, 9]]);
    // mouth
    if (st <= 1) {
      p.row(10, 13, 17, 'o'); // smug smirk
      p.dots('o', [[18, 9]]);
    } else if (st === 2) {
      p.row(10, 13, 18, 'o');
    } else if (st === 3) {
      p.row(10, 14, 17, 'o');
      p.dots('o', [[13, 11], [18, 11]]);
    } else {
      p.row(10, 13, 18, 'o');
      p.row(11, 13, 18, 'o');
      p.row(10, 14, 17, 'W');
      p.dots('q', [[13, 11], [16, 12], [18, 11]]); // stubble
    }
    if (st >= 2) p.dots('u', [[10, 4], [10, 5], [21, 2]]);
    if (st >= 3) p.dots('u', [[11, 9], [21, 7], [21, 8]]);
    if (st >= 3) p.dots('z', [[9, 3], [8, 2], [22, 3], [23, 2], [23, 4]]);
  }

  p.shade(['p', 'X', 'Y']);
  p.outline('o');
  return p;
}

// ---------------------------------------------------------------- Guard

function paintGuard(dir: Dir, frame: number, variant: number): Painter {
  const p = new Painter(32, 32);
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const skin = variant % 2 ? 'C' : 'c';
  if (dir === 'side') {
    const fx = frame === 1 ? 3 : frame === 2 ? -3 : 0;
    p.rect(14 - fx, 25, 4, 5, 'V');
    p.rect(14 + fx, 25, 4, 5, 'v');
    p.rect(14 - fx, 30, 5, 1, 'K');
    p.rect(14 + fx, 30, 5, 1, 'K');
    p.rect(11, 14, 10, 11, 'v');
    p.row(22, 11, 20, 'K');
    p.set(17, 22, 'y');
    p.set(19, 16, 'y');
    p.rect(12, 23, 3, 2, 'K'); // holster
    const ax = 14 + swing * 2;
    p.rect(ax, 15, 3, 8, 'V');
    p.rect(ax, 23, 3, 2, skin);
    // torch in hand
    p.rect(ax + 2, 22, 4, 2, 'm');
    p.set(ax + 6, 22, 'y');
    p.set(ax + 6, 23, 'y');
    // head
    p.rect(11, 5, 10, 9, skin);
    p.rect(10, 3, 11, 4, 'n');
    p.rect(17, 6, 6, 1, 'n');
    p.row(3, 12, 18, 'N');
    p.set(18, 9, 'K');
    p.row(8, 17, 19, 'K');
    p.row(12, 17, 19, 'C');
    p.set(21, 10, skin);
    p.rect(12, 8, 2, 2, 'C');
  } else {
    p.rect(11, 25 - (frame === 1 ? 1 : 0), 4, 5, 'V');
    p.rect(17, 25 - (frame === 2 ? 1 : 0), 4, 5, 'V');
    p.rect(11, 30 - (frame === 1 ? 1 : 0), 4, 1, 'K');
    p.rect(17, 30 - (frame === 2 ? 1 : 0), 4, 1, 'K');
    p.rect(9, 14, 14, 11, 'v');
    p.row(22, 9, 22, 'K');
    p.rect(15, 22, 2, 1, 'y');
    p.rect(6, 15 + swing, 3, 8, 'V');
    p.rect(23, 15 - swing, 3, 8, 'V');
    p.rect(6, 15 + swing, 3, 2, 'N'); // epaulettes
    p.rect(23, 15 - swing, 3, 2, 'N');
    p.rect(6, 23 + swing, 3, 2, skin);
    p.rect(23, 23 - swing, 3, 2, skin);
    p.rect(10, 5, 12, 9, skin);
    p.rect(9, 7, 1, 3, skin);
    p.rect(22, 7, 1, 3, skin);
    p.rect(9, 2, 14, 4, 'n');
    p.row(2, 11, 20, 'N');
    if (dir === 'down') {
      p.row(6, 8, 23, 'n');
      p.rect(15, 3, 2, 2, 'y');
      p.dots('K', [[12, 8], [13, 8], [18, 8], [19, 8]]);
      p.row(7, 11, 14, 'K');
      p.row(7, 17, 20, 'K');
      p.row(11, 14, 17, 'K');
      p.dots('C', [[15, 9], [16, 10], [10, 12], [21, 12]]);
      p.dots('V', [[13, 15], [14, 16], [15, 17], [16, 17], [17, 16], [18, 15]]);
      p.set(12, 17, 'y');
      p.dots('V', [[19, 18], [20, 18], [19, 19], [20, 19]]); // pocket
      p.dots('K', [[16, 19], [16, 21]]); // buttons
      // torch in the right hand
      p.rect(23, 25 - swing, 3, 3, 'm');
      p.set(24, 28 - swing, 'y');
    } else {
      p.rect(10, 5, 12, 3, 'n');
      p.row(13, 11, 20, 'C');
    }
  }
  p.shade(['v', 'V', 'n', 'c', 'C']);
  p.outline('K');
  return p;
}

/** Armoured guard (after level 35): a walking suit of armour with glowing red eyes. */
function paintKnight(dir: Dir, frame: number): Painter {
  const p = new Painter(32, 32);
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const S = '#a7b0ba';
  const D = '#5f6873';
  const L = '#dde3e8';
  const E = '#ff2b2b';
  if (dir === 'side') {
    const fx = frame === 1 ? 3 : frame === 2 ? -3 : 0;
    p.rect(13 - fx, 24, 5, 6, D);
    p.rect(13 + fx, 24, 5, 6, S);
    p.rect(13 + fx, 26, 5, 1, L);
    p.rect(12 - fx, 30, 7, 1, D);
    p.rect(12 + fx, 30, 7, 1, D);
    p.rect(10, 13, 12, 11, S);
    p.rect(10, 13, 3, 11, D);
    p.row(16, 13, 21, L);
    p.row(21, 10, 21, D);
    const ax = 13 + swing * 2;
    p.rect(ax, 13, 5, 4, L); // pauldron
    p.rect(ax + 1, 17, 3, 6, S);
    p.rect(ax + 1, 23, 3, 2, D);
    // helmet
    p.rect(10, 2, 12, 11, S);
    p.rect(10, 2, 3, 11, D);
    p.rect(16, 6, 6, 3, '#1a1a1e');
    p.set(19, 7, E);
    p.set(20, 7, E);
    p.row(3, 13, 20, L);
    p.rect(14, 0, 4, 2, '#b3201c'); // plume
    p.set(12, 0, '#b3201c');
  } else {
    p.rect(11, 24 - (frame === 1 ? 1 : 0), 5, 6, S);
    p.rect(17, 24 - (frame === 2 ? 1 : 0), 5, 6, S);
    p.row(26 - (frame === 1 ? 1 : 0), 11, 15, L);
    p.row(26 - (frame === 2 ? 1 : 0), 17, 21, L);
    p.rect(10, 30, 6, 1, D);
    p.rect(17, 30, 6, 1, D);
    // breastplate
    p.rect(9, 13, 15, 11, S);
    p.rect(9, 13, 2, 11, D);
    p.rect(22, 13, 2, 11, D);
    p.row(21, 9, 23, D);
    p.rect(11, 22, 11, 2, D);
    if (dir === 'down') {
      p.rect(15, 14, 2, 7, L);
      p.dots(L, [[12, 15], [13, 16], [20, 15], [19, 16]]);
      p.dots(D, [[12, 18], [20, 18]]);
    }
    // pauldrons and arms
    p.rect(5, 13 + swing, 5, 4, L);
    p.rect(23, 13 - swing, 5, 4, L);
    p.rect(6, 17 + swing, 3, 6, S);
    p.rect(24, 17 - swing, 3, 6, S);
    p.rect(6, 23 + swing, 3, 2, D);
    p.rect(24, 23 - swing, 3, 2, D);
    // helmet
    p.rect(10, 2, 12, 11, S);
    p.rect(10, 2, 2, 11, D);
    p.rect(20, 2, 2, 11, D);
    p.row(3, 12, 19, L);
    p.rect(14, 0, 4, 2, '#b3201c');
    if (dir === 'down') {
      p.rect(11, 6, 10, 3, '#1a1a1e'); // visor slit
      p.dots(E, [[13, 7], [14, 7], [17, 7], [18, 7]]);
      p.dots('#ff9a9a', [[13, 7], [17, 7]]);
      for (let y = 9; y < 12; y++) p.dots(D, [[13, y], [15, y], [17, y], [19, y]]); // breathing holes
    } else {
      p.rect(14, 4, 4, 8, D);
    }
  }
  p.shade([S]);
  p.outline('o');
  return p;
}

// ---------------------------------------------------------------- Dog (side view only, faces right)

function paintDog(frame: number): Painter {
  const p = new Painter(32, 32);
  const l = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  // legs
  p.rect(9 + l, 24, 2, 5, 'k');
  p.rect(12 - l, 24, 2, 5, 'k');
  p.rect(19 + l, 24, 2, 5, 'k');
  p.rect(22 - l, 24, 2, 5, 'k');
  p.dots('a', [[9 + l, 28], [12 - l, 28], [19 + l, 28], [22 - l, 28]]);
  // body
  p.rect(8, 17, 17, 7, 'k');
  p.row(23, 10, 22, 'a');
  p.rect(5, 15, 3, 2, 'k'); // tail
  p.set(4, 14, 'k');
  // neck + head
  p.rect(21, 12, 5, 7, 'k');
  p.rect(23, 11, 7, 5, 'k');
  p.rect(26, 14, 4, 2, 'a');
  p.rect(22, 7, 2, 4, 'k'); // ear
  p.set(22, 6, 'k');
  p.set(26, 12, 'a');
  p.set(27, 12, 'r');
  p.set(30, 14, 'K');
  p.rect(21, 16, 3, 1, 'r'); // collar
  p.shade(['k', 'a']);
  p.outline('o');
  return p;
}

// ---------------------------------------------------------------- Items (16x16)

export type ItemKind = 'rock' | 'bottle' | 'meat' | 'smoke' | 'toy' | 'bandage';

function paintItem(kind: ItemKind): Painter {
  const p = new Painter(16, 16);
  switch (kind) {
    case 'rock':
      p.ellipse(8, 9.5, 5, 4, 'S');
      p.dots('P', [[6, 7], [7, 7], [8, 7], [5, 8]]);
      p.dots('Q', [[10, 11], [11, 10], [9, 12]]);
      break;
    case 'bottle':
      p.rect(6, 7, 5, 7, 'G');
      p.rect(7, 3, 3, 4, 'G');
      p.rect(7, 2, 3, 1, 'R');
      p.dots('F', [[7, 8], [7, 9], [7, 10], [8, 4]]);
      p.rect(6, 10, 5, 2, 'W');
      break;
    case 'meat':
      p.ellipse(6.5, 7.5, 4.5, 4, 'R');
      p.dots('M', [[5, 6], [6, 5], [4, 7], [7, 6]]);
      p.rect(9, 9, 4, 2, 'W');
      p.rect(12, 8, 2, 2, 'W');
      p.rect(12, 11, 2, 2, 'W');
      break;
    case 'smoke':
      p.ellipse(7.5, 9.5, 4.5, 4.5, 'm');
      p.dots('L', [[5, 7], [6, 6]]);
      p.rect(7, 3, 2, 2, 'g');
      p.dots('O', [[9, 2], [10, 1], [8, 1]]);
      break;
    case 'toy':
      p.ellipse(7.5, 10, 5, 3.5, 'P');
      p.rect(11, 9, 2, 2, 'P');
      p.dots('L', [[5, 8], [6, 8], [7, 8]]);
      p.dots('K', [[11, 9]]);
      p.dots('M', [[10, 7], [13, 10]]);
      p.rect(5, 4, 1, 4, 'y');
      p.rect(4, 4, 3, 1, 'y');
      break;
    case 'bandage':
      p.rect(3, 4, 10, 9, 'W');
      p.rect(7, 5, 2, 7, 'r');
      p.rect(5, 7, 6, 3, 'r');
      break;
  }
  p.outline(kind === 'bandage' ? 'K' : 'o');
  return p;
}

// ---------------------------------------------------------------- cache + public API

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => Painter): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make().canvas();
    cache.set(key, c);
  }
  return c;
}

export const lennySprite = (st: number, dir: Dir, frame: number, twitch: boolean, pose = 1) =>
  cached(`L${st}${dir}${frame}${twitch ? 1 : 0}${pose}`, () => paintLenny(st, dir, frame, twitch, pose));
export const jeffSprite = (st: number, dir: Dir, frame: number) => cached(`J${st}${dir}${frame}`, () => paintJeff(st, dir, frame));
export const guardSprite = (dir: Dir, frame: number, variant: number, armored = false) =>
  armored ? cached(`K${dir}${frame}`, () => paintKnight(dir, frame)) : cached(`G${dir}${frame}${variant % 2}`, () => paintGuard(dir, frame, variant));
export const dogSprite = (frame: number) => cached(`D${frame}`, () => paintDog(frame));
export const itemSprite = (kind: ItemKind) => cached(`I${kind}`, () => paintItem(kind));

/** Stage of Lenny's transformation: terrified until level 20, then a step every 5 levels. */
export const lennyStage = (level: number) => (level <= 20 ? 0 : Math.min(6, 1 + Math.floor((level - 21) / 5)));
/** How Lenny walks: a scared tiptoe for the first half, then normal, then a swagger. */
export const lennyPose = (level: number) => (level <= 25 ? 0 : level <= 37 ? 1 : 2);
/** How frazzled Jeff is for a level (1..50). */
export const jeffStage = (level: number) => Math.min(4, Math.floor((level - 1) / 10));
