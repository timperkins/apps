import { SCENE_H as H, SCENE_W as W, SURF } from '../game/constants';
import { Frame, Grid, bay, grad, mix, seeded, type Color } from './pix';

// The static scene, painted once: sky and islands, layered water with light rays, rocks, a wreck,
// kelp, the reef and the sandy seabed.

export const waveY = (x: number) => SURF + (Math.sin(x * 0.19) + Math.sin(x * 0.063 + 1) > 1.1 ? -1 : 0);
const hFar = (x: number) => 232 + 14 * Math.sin(x * 0.012 + 1) + 9 * Math.sin(x * 0.037 + 2) + 4 * Math.sin(x * 0.1);
const hMid = (x: number) => 282 + 11 * Math.sin(x * 0.018 + 3) + 7 * Math.sin(x * 0.055) + 3 * Math.sin(x * 0.16 + 1);
export const hSand = (x: number) => 326 + 3 * Math.sin(x * 0.04) + 2 * Math.sin(x * 0.11 + 1);

export function paintBackground(): HTMLCanvasElement {
  const f = new Frame(W, H);
  let rnd = seeded(3);
  const px = f.px.bind(f);

  // ---- sky ----
  const sky: Color[] = ['#2a62c9', '#3373d3', '#3f86dc', '#4f99e4', '#62abea', '#78bdef', '#90cdf2', '#aadaf4', '#c6e6f5', '#dcefef'];
  for (let y = 0; y < SURF + 2; y++) for (let x = 0; x < W; x++) px(x, y, grad(sky, y / (SURF - 1), x, y));
  const sx = 228;
  const sy = 24;
  for (let y = -34; y <= 34; y++)
    for (let x = -34; x <= 34; x++) {
      const d = Math.hypot(x, y);
      if (d < 7) px(sx + x, sy + y, d < 5 ? '#fffbe6' : '#fff3b8');
      else if (d < 9) px(sx + x, sy + y, '#ffe993', 0.9);
      else if (d < 34 && bay(sx + x, sy + y) < Math.pow((34 - d) / 25, 1.6) * 0.5) px(sx + x, sy + y, '#fff4cf', 0.35);
    }
  const cloud = (cx: number, cy: number, s: number) => {
    const blobs = [[0, 0, 8], [9, -5, 10], [20, -2, 9], [30, 1, 7], [-9, 2, 6], [12, 2, 9], [38, 3, 5]];
    for (let y = Math.floor(-18 * s); y <= 10 * s; y++)
      for (let x = Math.floor(-18 * s); x <= 46 * s; x++) {
        let best = 9;
        for (const [bx, by, r] of blobs) best = Math.min(best, Math.hypot(x / s - bx, (y / s - by) * 1.2) / r);
        if (best > 1 || y > 6 * s) continue;
        const shade = (y / s + 6) / 12 + best * 0.15;
        let c = shade < 0.25 ? '#ffffff' : shade < 0.5 ? '#f4f9ff' : shade < 0.72 ? '#dceefa' : shade < 0.9 ? '#bfdcf2' : '#a6c8e8';
        if (best > 0.88 && y < 0) c = '#ffffff';
        px(cx + x, cy + y, c);
      }
  };
  cloud(110, 40, 1.15);
  cloud(395, 30, 0.9);
  cloud(560, 50, 1.0);
  cloud(30, 58, 0.75);
  cloud(300, 58, 0.6);
  cloud(470, 14, 0.55);
  for (const [x, y] of [[262, 20], [274, 26], [284, 18], [438, 40]]) {
    for (const [dx, dy] of [[-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1]]) px(x + dx, y + dy, '#2b3550');
  }
  for (let x = 0; x < W; x++) {
    const h = Math.max(0, 9 * Math.sin(x * 0.021 + 2) + 5 * Math.sin(x * 0.07) + 3 * Math.sin(x * 0.17 + 1) + 2);
    for (let y = SURF - Math.round(h); y < SURF; y++) px(x, y, '#a6c9de');
    const h2 = Math.max(0, 6 * Math.sin(x * 0.033 + 4) + 4 * Math.sin(x * 0.11 + 2) - 1);
    for (let y = SURF - Math.round(h2); y < SURF; y++) px(x, y, y < SURF - h2 + 1 ? '#9cc0d6' : '#8db4cd');
  }
  const island = (cx: number, w: number, h: number, palm: boolean) => {
    for (let x = -w; x <= w; x++) {
      const t = x / w;
      const hh = Math.round(h * Math.pow(Math.max(0, 1 - t * t), 0.7) * (1 + 0.15 * Math.sin(x * 0.5)));
      for (let y = 0; y < hh; y++) {
        const yy = SURF - 1 - y;
        let c: string;
        if (y < 2) c = y < 1 ? '#e8d49a' : '#f6e3ad';
        else if (y < 4) c = x % 3 === 0 ? '#8a7a5a' : '#9c8a64';
        else {
          const top = y > hh - 3;
          c = top ? '#9be06e' : x < -w * 0.2 ? '#6cc25a' : '#4ea24f';
          if (!top && x > w * 0.4) c = '#3e8a47';
          if (!top && bay(cx + x, yy) < 0.15) c = '#3a7f42';
        }
        px(cx + x, yy, c);
      }
    }
    if (palm) {
      for (const [ox, hgt] of [[Math.round(w * 0.25), 14], [Math.round(-w * 0.35), 11]]) {
        const tx = cx + ox;
        const ty = SURF - Math.round(h * 0.8);
        for (let i = 0; i < hgt; i++) {
          const xx = tx + Math.round(Math.sin(i * 0.18) * 2);
          px(xx, ty - i, i % 2 ? '#8a5a34' : '#b07a45');
          px(xx + 1, ty - i, '#6b4426');
        }
        const top = [tx + Math.round(Math.sin(hgt * 0.18) * 2), ty - hgt];
        for (const [dx, dy] of [[-1, 0], [1, 0], [-0.8, 0.45], [0.8, 0.45], [-0.3, -0.9], [0.4, -0.8]])
          for (let k = 1; k < 8; k++) {
            const xx = top[0] + dx * k;
            const yy = top[1] + dy * k + k * k * 0.1;
            px(xx, yy, k < 3 ? '#62b84e' : '#3f9a46');
            px(xx, yy + 1, '#2b6e37');
          }
      }
    } else {
      f.rect(cx - 3, SURF - h - 4, 6, 4, '#e9e1cf');
      f.rect(cx - 4, SURF - h - 6, 8, 2, '#c0392b');
      px(cx, SURF - h - 3, '#5a3a22');
    }
  };
  island(42, 30, 14, true);
  island(372, 34, 12, false);
  island(612, 30, 15, true);
  island(258, 16, 7, false);

  // ---- water ----
  const sea: Color[] = ['#53d2d3', '#3dbfcc', '#2eaac4', '#2494b9', '#1f7fac', '#1b6b9e', '#175a8f', '#144b80', '#123e72', '#103364', '#0d2a56'];
  for (let y = SURF; y < H; y++) for (let x = 0; x < W; x++) if (y >= waveY(x)) px(x, y, grad(sea, Math.pow((y - SURF) / (H - SURF), 0.9), x, y));
  const rays = [[20, 12], [78, 18], [150, 10], [210, 22], [300, 13], [360, 20], [440, 12], [500, 24], [580, 14], [660, 18], [720, 12]];
  for (let y = SURF; y < H; y++) {
    const t = (y - SURF) / (H - SURF);
    for (let x = 0; x < W; x++) {
      const u = x + (y - SURF) * 0.42;
      let I = 0;
      for (const [c, w] of rays) I = Math.max(I, 1 - Math.abs(u - c) / w);
      I = Math.max(0, I);
      I = I * I * (3 - 2 * I) * Math.pow(1 - t, 1.4) * 0.85;
      if (bay(x, y) < I) px(x, y, '#cdf7ff', 0.2);
    }
  }

  // ---- far and mid layers ----
  for (let x = 0; x < W; x++) {
    const fy = Math.round(hFar(x));
    for (let y = fy; y < H; y++) {
      px(x, y, '#18578a', 0.42);
      if (y === fy) px(x, y, '#3a8fb0', 0.35);
    }
  }
  for (let y = 200; y < 250; y++)
    for (let x = 470; x < 560; x++) {
      const nx = (x - 515) / 45;
      const ny = (250 - y) / 50;
      const inner = ((x - 515) / 22) ** 2 + ((250 - y) / 32) ** 2 < 1;
      if (nx * nx + ny * ny < 1 && !inner) px(x, y, y < 203 ? '#3a8fb0' : '#18578a', 0.42);
    }
  for (const [x, h] of [[60, 90], [84, 60], [300, 80], [330, 110], [610, 95]])
    for (let i = 0; i < h; i++) {
      const xx = x + Math.sin(i * 0.07 + x) * 4;
      px(xx, hFar(x) - i, '#1a5f86', 0.45);
      px(xx + 1, hFar(x) - i, '#1a5f86', 0.45);
      if (i % 8 === 4) {
        px(xx + 2, hFar(x) - i - 1, '#1a5f86', 0.45);
        px(xx - 1, hFar(x) - i - 1, '#1a5f86', 0.45);
      }
    }
  for (let x = 0; x < W; x++) {
    const m = Math.round(hMid(x));
    for (let y = m; y < H; y++) {
      px(x, y, '#11406a', 0.6);
      if (y < m + 2) px(x, y, '#3b93a8', 0.45);
      else if (bay(x, y) < 0.1 && (x * 7 + y * 3) % 11 < 3) px(x, y, '#0c3256', 0.5);
    }
  }
  // wreck
  {
    const g = new Grid(90, 40);
    for (let y = 0; y < 16; y++) {
      const ins = Math.round((y / 16) ** 2 * 14);
      for (let x = 4 + ins; x < 86 - ins * 0.6; x++) g.set(x, y + 18, y % 4 === 0 ? '#1a4a6a' : '#205877');
    }
    for (let x = 10; x < 80; x += 12) g.rect(x, 24, 4, 3, '#0f3150');
    g.line(40, 18, 30, 0, '#205877');
    g.line(41, 18, 31, 0, '#1a4a6a');
    g.line(30, 4, 46, 6, '#1a4a6a');
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const c = g.get(x, y);
        if (c) px(150 - 45 + x, 288 - 40 + y + Math.round(x * 0.12), c, 0.75);
      }
  }
  const kelp = (x0: number, y0: number, h: number, ph: number, cols: string[], a = 1) => {
    for (let i = 0; i < h; i++) {
      const y = y0 - i;
      const x = x0 + Math.sin(i * 0.08 + ph) * 3.5 * (i / h + 0.3);
      px(x - 1, y, cols[2], a);
      px(x, y, cols[0], a);
      px(x + 1, y, cols[3], a);
      if (i % 6 === 3 && i > 4) {
        const s = (i / 6) % 2 >= 1 ? 1 : -1;
        const len = 6 + ((i * 7) % 3);
        for (let k = 1; k < len; k++) {
          const xx = x + s * (k + 1);
          const yy = y - Math.round(k * 0.55) + (k > len - 3 ? 1 : 0);
          px(xx, yy, k < len - 2 ? cols[1] : cols[0], a);
          px(xx, yy + 1, cols[0], a);
          if (k < len - 3) px(xx, yy - 1, cols[3], a * 0.8);
        }
      }
    }
  };
  for (const [x, h, ph] of [[30, 90, 0], [52, 120, 1], [262, 80, 2], [296, 104, 0.5], [452, 96, 3], [606, 124, 1.5], [628, 84, 2.2]])
    kelp(x, hMid(x) + 6, h, ph, ['#1f6a5a', '#2c8169', '#174e48', '#36937a'], 0.9);

  // ---- sand ----
  rnd = seeded(11);
  for (let x = 0; x < W; x++) {
    const t = Math.round(hSand(x));
    for (let y = t; y < H; y++) {
      const d = y - t;
      const c = d < 1 ? '#fff0c4' : d < 3 ? '#f4dca2' : grad(['#ebcd92', '#e0bd7d', '#d0aa68', '#bf9657', '#a9814a'], d / (H - t), x, y);
      px(x, y, c);
      if (d > 2 && Math.sin(x * 0.21 + Math.sin(y * 0.6) * 2 + y * 0.9) > 0.92) px(x, y, '#f7e2b2');
    }
  }
  for (let y = Math.floor(hSand(0)) - 6; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y < hSand(x)) continue;
      const v = Math.abs(Math.sin(x * 0.13 + Math.sin(y * 0.31) * 1.6)) + Math.abs(Math.sin(y * 0.29 + Math.sin(x * 0.11) * 1.8));
      if (v < 0.32) px(x, y, '#fff8dc', 0.55 * (1 - (y - hSand(x)) / 40));
    }
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(hSand(x) + 3 + rnd() * (H - hSand(x) - 3));
    px(x, y, rnd() < 0.5 ? '#9c7642' : '#fff1cc');
  }

  // ---- reef ----
  const rock = (cx: number, by: number, w: number, h: number, moss: boolean, sd: number) => {
    const r = seeded(sd);
    const g = new Grid(w + 4, h + 4);
    const bumps = [...Array(6)].map(() => r() * 0.25);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2);
        const ny = (h - y) / h;
        const ang = Math.atan2(ny, nx);
        const rr = 1 - (bumps[Math.floor((ang / Math.PI) * 6) % 6] || 0) * 0.6;
        if (nx * nx + ny * ny > rr) continue;
        const l = -nx * 0.5 + ny * 0.9 + (bay(x, y) - 0.5) * 0.35;
        let c = l > 0.75 ? '#a7b9cc' : l > 0.45 ? '#8396ae' : l > 0.15 ? '#687b95' : l > -0.15 ? '#55657f' : '#44526a';
        if ((x * 13 + y * 7) % 17 === 0) c = '#3a465c';
        if (moss && ny > 0.78 - 0.08 * Math.sin(x * 0.7)) c = ny > 0.9 ? '#a8e07a' : (x + y) % 3 ? '#6fbf5a' : '#5aa64c';
        g.set(x + 2, y + 2, c);
      }
    g.outlineAuto(0.4);
    f.blit(g, cx - w / 2 - 2, by - h - 2);
  };
  const branch = (cx: number, by: number, col: string, light: string, dark: string, sc: number, sd: number) => {
    const r = seeded(sd);
    const g = new Grid(60, 56);
    const br = (x: number, y: number, ang: number, len: number, dep: number) => {
      for (let i = 0; i < len; i++) {
        x += Math.cos(ang);
        y -= Math.sin(ang);
        const w = dep > 1 ? 2 : 1;
        for (let k = 0; k < w; k++) g.set(x + k, y, k === 0 && w > 1 ? light : col);
        g.set(x + (dep > 1 ? w : 1), y, dark);
      }
      if (dep > 0) {
        br(x, y, ang + 0.45 + r() * 0.35, len * 0.72, dep - 1);
        br(x, y, ang - 0.45 - r() * 0.35, len * 0.72, dep - 1);
        if (r() < 0.4) br(x, y, ang, len * 0.5, dep - 1);
      } else {
        g.set(x, y - 1, light);
        g.set(x, y, light);
      }
    };
    br(30, 55, Math.PI / 2, 12 * sc, 3);
    g.outlineAuto(0.4);
    f.blit(g, cx - 30, by - 55);
  };
  const fan = (cx: number, by: number, r: number, col: string, dark: string) => {
    const g = new Grid(2 * r + 5, r + 7);
    for (let y = 0; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y * 1.1);
        if (d > r) continue;
        const ang = Math.atan2(y, x);
        if (Math.abs(Math.sin(ang * 11)) < 0.22 || Math.abs(Math.sin(d * 0.9)) < 0.25 || d > r - 1.2)
          g.set(x + r + 2, r - y + 2, d > r - 1.2 ? col : y > r * 0.5 ? mix(col, '#ffffff', 0.25) : dark);
      }
    g.rect(r + 1, r + 2, 2, 4, dark);
    g.outlineAuto(0.45);
    f.blit(g, cx - r - 2, by - r - 6);
  };
  const brain = (cx: number, by: number, w: number, h: number) => {
    const g = new Grid(w + 4, h + 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const nx = (x - w / 2) / (w / 2);
        const ny = (h - y) / h;
        if (nx * nx + ny * ny > 1) continue;
        const groove = Math.sin(x * 0.8 + Math.sin(y * 1.1) * 2.4) > 0.45;
        const l = -nx * 0.4 + ny * 0.8;
        g.set(x + 2, y + 2, groove ? (l > 0.5 ? '#d4943a' : '#b0732a') : l > 0.7 ? '#ffe29a' : l > 0.3 ? '#f6bf5a' : '#e2a043');
      }
    g.outlineAuto(0.42);
    f.blit(g, cx - w / 2 - 2, by - h - 2);
  };
  const anemone = (cx: number, by: number, c1: string, c2: string, c3: string) => {
    for (let i = -7; i <= 7; i++) {
      const h = 10 + ((i * 7 + 30) % 6);
      for (let k = 0; k < h; k++) px(cx + i + Math.sin(k * 0.33 + i) * 1.6 * (k / h), by - 5 - k, k > h - 3 ? c2 : k < 3 ? c3 : c1);
    }
    for (let j = 0; j < 5; j++) for (let i = -7; i <= 7; i++) px(cx + i, by - 5 + j, j === 0 ? c1 : Math.abs(i) > 6 - j * 0.3 ? mix(c3, '#000', 0.3) : c3);
    for (let i = -8; i <= 8; i++) px(cx + i, by, mix(c3, '#000', 0.45));
  };
  const tube = (cx: number, by: number, cols: [number, number, string][]) => {
    for (const [dx, h, c] of cols) {
      for (let y = 0; y < h; y++) {
        px(cx + dx, by - y, mix(c, '#000', 0.25));
        px(cx + dx + 1, by - y, c);
        px(cx + dx + 2, by - y, mix(c, '#fff', 0.3));
        px(cx + dx + 3, by - y, c);
      }
      f.rect(cx + dx, by - h, 4, 1, mix(c, '#000', 0.55));
      px(cx + dx - 1, by - h, '#241a50');
      px(cx + dx + 4, by - h, '#241a50');
    }
  };
  const grass = (cx: number, by: number, col: string) => {
    for (let i = -4; i <= 4; i++) {
      const h = 8 + ((i * 5 + 12) % 7);
      for (let k = 0; k < h; k++) px(cx + i + Math.sin(k * 0.25 + i) * k * 0.12, by - k, k > h - 3 ? mix(col, '#fff', 0.3) : i % 2 ? col : mix(col, '#000', 0.25));
    }
  };
  const star = (cx: number, cy: number, c: string) => {
    for (let a = 0; a < 5; a++) {
      const ang = (a * Math.PI * 2) / 5 - Math.PI / 2;
      for (let k = 0; k < 5; k++) px(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k * 0.8, k < 4 ? c : mix(c, '#fff', 0.4));
    }
    px(cx, cy, mix(c, '#fff', 0.5));
  };
  const chest = (cx: number, by: number) => {
    const g = new Grid(28, 22);
    g.rect(3, 10, 22, 10, '#8a5530');
    for (let x = 3; x < 25; x++) {
      g.set(x, 13, '#6e4223');
      g.set(x, 16, '#6e4223');
    }
    g.rect(3, 10, 22, 1, '#b0703f');
    g.rect(12, 10, 4, 10, '#e6b84a');
    g.rect(13, 10, 1, 10, '#fff0a0');
    g.rect(3, 18, 22, 1, '#e6b84a');
    g.rect(12, 12, 4, 3, '#b88a2a');
    g.rect(4, 2, 20, 4, '#7a4a28');
    g.rect(4, 1, 20, 1, '#a86a3c');
    g.rect(12, 1, 4, 5, '#e6b84a');
    g.rect(4, 6, 20, 1, '#4a2a14');
    for (let i = 0; i < 18; i++) {
      g.set(5 + i, 9, i % 3 ? '#ffd54a' : '#fff3a0');
      if (i % 2) g.set(5 + i, 8, '#f0b830');
    }
    g.set(14, 7, '#9ee5ff');
    g.set(20, 8, '#ff5a8a');
    g.outlineAuto(0.38);
    f.blit(g, cx - 14, by - 20);
  };
  const anchor = (cx: number, by: number) => {
    const g = new Grid(20, 22);
    g.rect(9, 2, 2, 16, '#5d6b7d');
    g.rect(10, 2, 1, 16, '#8796a8');
    g.rect(5, 5, 10, 2, '#5d6b7d');
    g.rect(8, 0, 4, 3, '#5d6b7d');
    g.set(9, 1, null);
    g.set(10, 1, null);
    for (let a = 0; a <= Math.PI; a += 0.08) g.set(10 - Math.cos(a) * 8, 16 + Math.sin(a) * 3, '#5d6b7d');
    for (let k = 0; k < 5; k++) g.set(11 + k, 6 + k * 2, '#6c9a5a');
    g.outlineAuto(0.45);
    f.blit(g, cx - 10, by - 20);
  };
  const crab = (cx: number, by: number) => {
    const g = new Grid(17, 11);
    g.rect(4, 4, 9, 4, '#e5533d');
    g.rect(5, 3, 7, 1, '#ff7a5a');
    g.rect(5, 7, 7, 1, '#b8392a');
    g.set(6, 1, '#141414');
    g.set(10, 1, '#141414');
    g.set(6, 2, '#e5533d');
    g.set(10, 2, '#e5533d');
    g.rect(1, 2, 3, 3, '#ff6a4a');
    g.rect(13, 2, 3, 3, '#ff6a4a');
    for (const x of [3, 5, 11, 13]) {
      g.set(x, 8, '#b8392a');
      g.set(x + (x < 8 ? -1 : 1), 9, '#b8392a');
    }
    g.outlineAuto(0.4);
    f.blit(g, cx - 8, by - 10);
  };

  rock(440, 330, 60, 26, true, 4);
  rock(36, 338, 60, 30, true, 8);
  rock(344, 330, 30, 13, false, 12);
  rock(600, 336, 40, 18, true, 15);
  brain(306, 330, 28, 14);
  branch(84, 334, '#ff6f9f', '#ffc2d8', '#d94a7c', 1, 3);
  branch(196, 331, '#ff9a4a', '#ffd29a', '#d96a2a', 0.85, 9);
  fan(380, 330, 15, '#c46cff', '#9a48e0');
  fan(150, 333, 11, '#ff6b6b', '#d94545');
  anemone(522, 336, '#ff7fc8', '#ffd6f1', '#c0418f');
  tube(626, 336, [[-6, 14, '#7f6bff'], [-1, 20, '#9b8cff'], [4, 16, '#6c58e8']]);
  branch(566, 334, '#ff6f9f', '#ffc2d8', '#d94a7c', 0.75, 5);
  anemone(262, 336, '#ffb84d', '#fff0c0', '#d9782a');
  tube(18, 312, [[0, 12, '#4fd1c5'], [5, 17, '#38b2ac']]);
  grass(120, 340, '#58b85a');
  grass(342, 342, '#6cc860');
  grass(480, 340, '#58b85a');
  grass(232, 342, '#4fae58');
  chest(236, 338);
  anchor(370, 346);
  crab(560, 348);
  rnd = seeded(21);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(20 + rnd() * 600);
    const y = Math.floor(346 + rnd() * 10);
    const g = new Grid(9, 7);
    for (let yy = 0; yy < 5; yy++) for (let xx = -3 + Math.floor(yy / 2); xx <= 3 - Math.floor(yy / 2); xx++) g.set(xx + 4, 5 - yy, xx % 2 ? '#f2b4c6' : '#ffe2ec');
    g.outlineAuto(0.5);
    f.blit(g, x - 4, y - 5);
  }
  star(602, 350, '#ff8a3d');
  star(318, 352, '#ff6b8a');
  star(166, 354, '#ffb84d');
  for (const [x, h, ph] of [[10, 200, 0], [134, 150, 1.3], [364, 120, 2.1], [586, 184, 0.7]])
    kelp(x, hSand(x) + 1, h, ph, ['#3d9a4a', '#6cc860', '#2a7038', '#8ee07a']);

  // ---- waterline ----
  rnd = seeded(5);
  for (let x = 0; x < W; x++) {
    const y = waveY(x);
    px(x, y, '#f2ffff');
    px(x, y + 1, '#a2ecee');
    px(x, y + 2, '#7cdcdf', 0.6);
  }
  for (let i = 0; i < 70; i++) f.rect(Math.floor(rnd() * W), Math.floor(SURF + 3 + rnd() * 9), 2 + Math.floor(rnd() * 4), 1, '#d7fbfc', 0.55);
  for (let i = 0; i < 30; i++) f.rect(Math.floor(228 + (rnd() - 0.5) * 40), Math.floor(SURF + 2 + rnd() * 10), 1 + Math.floor(rnd() * 3), 1, '#fff7d0', 0.8);
  return f.toCanvas();
}
