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

class Painter {
  w: number;
  h: number;
  px: (string | null)[];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: string) {
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

/** Lenny's look by story stage: 0 scared and filthy ... 4 confident, clean and muscular. */
function paintLenny(st: number, dir: Dir, frame: number, twitch: boolean): Painter {
  const p = new Painter(32, 32);
  const m = [0, 0, 1, 2, 3][st];
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  // ---- body first (head overlaps it)
  const tx0 = 10 - m;
  const tx1 = 21 + m;
  const tank = st >= 3;
  const shirt = st >= 3 ? 'W' : 'w';
  const shade = st >= 3 ? 'L' : 'g';
  const aw = 3 + (st >= 3 ? 1 : 0) + (st >= 4 ? 1 : 0);

  // legs + shoes
  const legL = frame === 1 ? -1 : 0;
  const legR = frame === 2 ? -1 : 0;
  if (dir === 'side') {
    const fx = frame === 1 ? 3 : frame === 2 ? -3 : 0;
    p.rect(14 - fx, 27, 4, 3 + (fx ? 0 : 0), 'T');
    p.rect(14 + fx, 27, 4, 3, 't');
    p.rect(14 - fx, 30, 5, 1, 'K');
    p.rect(14 + fx, 30, 5, 1, 'K');
    p.rect(12, 25, 9, 3, 't');
  } else {
    p.rect(11, 25, 10, 3, 't');
    p.row(25, 11, 20, 'T');
    p.rect(11, 27 + legL, 4, 3, 't');
    p.rect(17, 27 + legR, 4, 3, 't');
    p.rect(11, 30 + legL, 4, 1, 'K');
    p.rect(17, 30 + legR, 4, 1, 'K');
    if (legL) p.rect(11, 30, 4, 1, 'K');
    if (legR) p.rect(17, 30, 4, 1, 'K');
  }

  // torso
  if (dir === 'side') {
    p.rect(12 - Math.floor(m / 2), 17, 9 + m, 8, shirt);
    p.rect(12 - Math.floor(m / 2), 17, 2, 8, shade);
  } else {
    p.rect(tx0, 17, tx1 - tx0 + 1, 8, shirt);
    p.rect(tx0, 17, 2, 8, shade);
    if (tank) {
      // tank top straps: shoulders show skin
      p.rect(tx0, 17, 3, 2, 's');
      p.rect(tx1 - 2, 17, 3, 2, 's');
      if (dir === 'down') {
        p.row(17, 14, 17, 's');
        if (st >= 4) {
          // pecs and abs
          p.row(20, tx0 + 3, 15, 'L');
          p.row(20, 16, tx1 - 3, 'L');
          p.dots('L', [[15, 22], [16, 22], [15, 24], [16, 24]]);
        }
      }
    }
    if (st <= 1 && dir !== 'up') {
      // rips in the shirt
      p.dots('K', [[13, 20], [14, 21], [19, 22], [18, 23], [12, 23]]);
      p.dots('g', [[13, 21], [18, 22], [20, 19], [16, 24]]);
      if (st === 0) p.dots('s', [[13, 22], [19, 23]]);
    }
    if (st <= 1 && dir === 'up') p.dots('K', [[14, 20], [15, 21], [19, 23]]);
  }

  // arms
  const armColor = 's';
  const sleeve = st <= 2 ? shirt : 's';
  if (dir === 'side') {
    const ax = 14 + swing * 2;
    p.rect(ax, 18, aw, 6, armColor);
    p.rect(ax, 17, aw, 2, sleeve);
    p.rect(ax, 24, aw, 2, 's');
    if (st >= 3) p.dots('d', [[ax, 20], [ax, 21]]);
  } else {
    const lx = tx0 - aw;
    const rx = tx1 + 1;
    p.rect(lx, 18 + swing, aw, 7, armColor);
    p.rect(lx, 17 + swing, aw, 2, sleeve);
    p.rect(rx, 18 - swing, aw, 7, armColor);
    p.rect(rx, 17 - swing, aw, 2, sleeve);
    if (st >= 3) {
      // biceps
      p.set(lx - 1, 19 + swing, 's');
      p.set(lx - 1, 20 + swing, 's');
      p.set(rx + aw, 19 - swing, 's');
      p.set(rx + aw, 20 - swing, 's');
      p.set(lx + 1, 21 + swing, 'd');
      p.set(rx + aw - 2, 21 - swing, 'd');
    }
    if (st <= 1) p.dots('b', [[lx + 1, 22 + swing], [rx + 1, 20 - swing]]);
  }

  // neck
  p.rect(13, 15, 6, 2, 's');

  // ---- head
  if (dir === 'side') {
    p.rect(9, 3, 15, 12, 's');
    p.rect(8, 5, 17, 8, 's');
    p.rect(10, 15, 12, 1, 's');
    p.dots('s', [[25, 10], [25, 11]]); // nose
    p.set(24, 12, 'd');
    // hair
    const messy = st <= 1;
    p.rect(8, 1, 16, 5, 'h');
    p.rect(7, 3, 6, 10, 'h');
    p.rect(13, 6, 4, 1, 'h');
    if (messy) {
      p.dots('h', [[9, 0], [12, 0], [13, 0], [17, 0], [20, 0], [24, 3], [25, 4], [6, 5], [6, 8], [21, 6], [22, 6]]);
    } else {
      p.row(1, 10, 21, 'H');
      p.rect(7, 11, 3, 3, 'h');
    }
    if (st >= 3) p.rect(7, 10, 2, 3, 's');
    // ear
    p.rect(13, 8, 2, 3, 's');
    p.dots('d', [[13, 9], [14, 10]]);
    // eye
    if (st <= 1) {
      p.rect(19, 8, 3, 3, 'W');
      p.set(21, 8, 'L');
      p.set(21, 9, twitch ? 'K' : 'K');
      if (twitch) p.rect(19, 8, 3, 3, 's'), p.row(9, 19, 21, 'K');
    } else {
      p.rect(20, 8, 2, 2, 'W');
      p.set(21, 9, 'K');
      p.row(7, 19, 22, 'h');
      if (st >= 3) p.row(8, 20, 21, 'd');
    }
    // mouth
    if (st === 0) {
      p.row(12, 21, 23, 'W');
      p.row(13, 21, 23, 'm');
    } else if (st <= 2) p.row(13, 21, 23, 'm');
    else {
      p.row(13, 21, 23, 'm');
      p.set(24, 12, 'm');
    }
    if (st <= 1) p.dots('b', [[16, 12], [17, 13], [19, 14]]);
  } else if (dir === 'up') {
    p.rect(6, 3, 20, 12, 'h');
    p.rect(5, 5, 22, 8, 'h');
    p.rect(8, 15, 16, 1, 'h');
    p.rect(4, 8, 2, 3, 's');
    p.rect(26, 8, 2, 3, 's');
    p.row(1, 7, 24, 'h');
    p.row(2, 6, 25, 'h');
    if (st <= 1) p.dots('h', [[8, 0], [11, 0], [12, 0], [16, 0], [19, 0], [23, 0], [3, 5], [28, 6], [4, 12], [27, 11]]);
    else p.dots('H', [[10, 3], [11, 3], [12, 4], [18, 3], [19, 4], [20, 4]]);
    if (st >= 2) p.rect(10, 13, 12, 3, 's');
  } else {
    // front
    p.rect(6, 3, 20, 12, 's');
    p.rect(5, 5, 22, 8, 's');
    p.rect(7, 14, 18, 1, 's');
    p.rect(9, 15, 14, 1, 's');
    // hair
    if (st <= 1) {
      p.rect(4, 1, 23, 5, 'h');
      p.row(6, 4, 7, 'h');
      p.row(6, 16, 27, 'h');
      p.row(7, 22, 26, 'h');
      p.row(8, 25, 26, 'h');
      p.dots('h', [[6, 0], [7, 0], [9, 0], [10, 0], [11, 0], [13, 0], [14, 0], [17, 0], [18, 0], [21, 0], [22, 0], [24, 0], [3, 3], [3, 4], [27, 4], [28, 5]]);
      // forehead showing through the mop
      p.rect(10, 4, 4, 2, 's');
      p.row(6, 11, 15, 's');
      p.dots('s', [[6, 5], [17, 6]]);
    } else if (st === 2) {
      p.rect(4, 1, 24, 5, 'h');
      p.row(6, 4, 9, 'h');
      p.row(6, 18, 27, 'h');
      p.dots('h', [[7, 0], [8, 0], [12, 0], [13, 0], [18, 0], [19, 0], [23, 0]]);
      p.rect(11, 5, 5, 1, 's');
      p.dots('H', [[9, 2], [10, 2], [11, 3], [17, 2], [18, 2]]);
    } else {
      // neat, combed with a side part and a swoop
      p.rect(5, 1, 22, 4, 'h');
      p.row(0, 8, 23, 'h');
      p.row(5, 5, 7, 'h');
      p.row(5, 16, 26, 'h');
      p.row(6, 20, 26, 'h');
      p.row(2, 9, 14, 'H');
      p.row(1, 15, 22, 'H');
      p.set(15, 2, 's');
      p.set(15, 3, 'h');
    }
    // ears
    p.rect(3, 8, 2, 3, 's');
    p.rect(27, 8, 2, 3, 's');
    p.dots('d', [[4, 9], [27, 9]]);
    // nose
    p.dots('d', [[15, 9], [15, 10], [16, 11]]);

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
        p.rect(7, 8, 4, 3, 's');
        p.row(9, 7, 10, 'K');
        p.dots('d', [[7, 7], [8, 7], [9, 8]]);
      }
      if (st === 1) {
        p.row(6, 7, 10, 'h');
        p.row(6, 18, 21, 'h');
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
        p.row(7, 7, 11, 'h');
        p.row(7, 18, 22, 'h');
      } else if (st === 3) {
        // confident, slightly lowered lids
        p.row(9, 8, 10, 'd');
        p.row(9, 19, 21, 'd');
        p.dots('h', [[7, 8], [8, 7], [9, 7], [10, 7], [11, 8], [18, 8], [19, 7], [20, 7], [21, 7], [22, 8]]);
      } else {
        // one eyebrow raised, smug
        p.row(9, 8, 10, 'd');
        p.dots('h', [[7, 8], [8, 7], [9, 7], [10, 7], [11, 7], [18, 6], [19, 6], [20, 6], [21, 6], [22, 7]]);
      }
    }

    // mouth
    if (st === 0) {
      p.row(12, 13, 17, 'W');
      p.dots('m', [[12, 12], [18, 12]]);
      p.row(13, 12, 18, 'm');
      p.dots('m', [[12, 14], [13, 14], [17, 14], [18, 14]]);
      p.row(12, 13, 17, 'W');
    } else if (st === 1) {
      p.dots('m', [[12, 13], [13, 12], [14, 13], [15, 12], [16, 13], [17, 12], [18, 13]]);
    } else if (st === 2) {
      p.row(13, 13, 18, 'm');
    } else if (st === 3) {
      p.row(13, 13, 18, 'm');
      p.dots('m', [[12, 12], [19, 12]]);
    } else {
      p.row(13, 13, 18, 'm');
      p.dots('m', [[19, 12], [20, 11]]);
      p.dots('W', [[14, 12], [15, 12], [16, 12], [17, 12]]);
    }

    // grime
    if (st === 0) p.dots('b', [[8, 13], [9, 13], [9, 14], [23, 11], [22, 12], [24, 8], [17, 4], [6, 11]]);
    if (st === 1) p.dots('b', [[8, 13], [9, 14], [23, 11]]);
    if (st === 2) p.dots('d', [[23, 12]]);
  }

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
    p.set(19, 16, 'y');
    const ax = 14 + swing * 2;
    p.rect(ax, 15, 3, 8, 'V');
    p.rect(ax, 23, 3, 2, skin);
    // head
    p.rect(11, 5, 10, 9, skin);
    p.rect(10, 3, 11, 4, 'n');
    p.rect(17, 6, 6, 1, 'n');
    p.row(3, 12, 18, 'N');
    p.set(18, 9, 'K');
    p.row(12, 17, 19, 'C');
    p.set(21, 10, skin);
  } else {
    p.rect(11, 25 - (frame === 1 ? 1 : 0), 4, 5, 'V');
    p.rect(17, 25 - (frame === 2 ? 1 : 0), 4, 5, 'V');
    p.rect(11, 30 - (frame === 1 ? 1 : 0), 4, 1, 'K');
    p.rect(17, 30 - (frame === 2 ? 1 : 0), 4, 1, 'K');
    p.rect(9, 14, 14, 11, 'v');
    p.row(22, 9, 22, 'K');
    p.set(16, 22, 'y');
    p.rect(6, 15 + swing, 3, 8, 'V');
    p.rect(23, 15 - swing, 3, 8, 'V');
    p.rect(6, 23 + swing, 3, 2, skin);
    p.rect(23, 23 - swing, 3, 2, skin);
    p.rect(10, 5, 12, 9, skin);
    p.rect(9, 7, 1, 3, skin);
    p.rect(22, 7, 1, 3, skin);
    p.rect(9, 2, 14, 4, 'n');
    p.row(2, 11, 20, 'N');
    if (dir === 'down') {
      p.row(6, 8, 23, 'n');
      p.set(16, 3, 'y');
      p.dots('K', [[12, 8], [13, 8], [18, 8], [19, 8]]);
      p.row(11, 14, 17, 'K');
      p.dots('V', [[13, 15], [14, 16], [15, 17], [16, 17], [17, 16], [18, 15]]);
      p.set(12, 17, 'y');
    } else {
      p.rect(10, 5, 12, 3, 'n');
      p.row(13, 11, 20, 'C');
    }
  }
  p.outline('K');
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

export const lennySprite = (st: number, dir: Dir, frame: number, twitch: boolean) =>
  cached(`L${st}${dir}${frame}${twitch ? 1 : 0}`, () => paintLenny(st, dir, frame, twitch));
export const jeffSprite = (st: number, dir: Dir, frame: number) => cached(`J${st}${dir}${frame}`, () => paintJeff(st, dir, frame));
export const guardSprite = (dir: Dir, frame: number, variant: number) =>
  cached(`G${dir}${frame}${variant % 2}`, () => paintGuard(dir, frame, variant));
export const dogSprite = (frame: number) => cached(`D${frame}`, () => paintDog(frame));
export const itemSprite = (kind: ItemKind) => cached(`I${kind}`, () => paintItem(kind));

/** Stage of Lenny's transformation for a level (1..50). */
export const lennyStage = (level: number) => Math.min(4, Math.floor((level - 1) / 10));
/** How frazzled Jeff is for a level (1..50). */
export const jeffStage = (level: number) => Math.min(4, Math.floor((level - 1) / 10));
