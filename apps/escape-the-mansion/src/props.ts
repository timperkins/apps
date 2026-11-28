// Decorative props that stand along the walls (they don't block movement).
import { Rng } from './rng';

export type Prop =
  | 'bucket'
  | 'skulls'
  | 'shackles'
  | 'barrel'
  | 'crate'
  | 'sacks'
  | 'cauldron'
  | 'vase'
  | 'armorStand'
  | 'bookPile'
  | 'globe'
  | 'bust'
  | 'chest'
  | 'lampTable'
  | 'bigPlant'
  | 'statue'
  | 'bench'
  | 'pumpkin'
  | 'lantern'
  | 'candles';

export const THEME_PROPS: Prop[][] = [
  ['bucket', 'skulls', 'shackles', 'candles'],
  ['barrel', 'barrel', 'crate', 'candles'],
  ['sacks', 'crate', 'cauldron', 'barrel'],
  ['vase', 'armorStand', 'candles', 'vase'],
  ['bookPile', 'globe', 'bookPile', 'candles'],
  ['bust', 'vase', 'bust', 'armorStand'],
  ['chest', 'lampTable', 'vase', 'chest'],
  ['bigPlant', 'bigPlant', 'statue', 'vase'],
  ['statue', 'bench', 'lantern', 'bigPlant'],
  ['pumpkin', 'lantern', 'statue', 'bench'],
];

function px(c: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function outlineRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, line = '#111') {
  px(c, line, x - 1, y - 1, w + 2, h + 2);
  px(c, fill, x, y, w, h);
}
function shadowBlob(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(x, y, w, w * 0.3, 0, 0, Math.PI * 2);
  c.fill();
}

/** Draws a prop into a 32x32 tile whose top edge touches a wall. */
export function drawProp(c: CanvasRenderingContext2D, kind: Prop, rng: Rng) {
  switch (kind) {
    case 'bucket':
      shadowBlob(c, 16, 22, 8);
      outlineRect(c, 10, 11, 12, 11, '#5a4632');
      px(c, '#6e573e', 11, 11, 3, 11);
      px(c, '#3a2c1e', 10, 14, 12, 1);
      px(c, '#3a2c1e', 10, 19, 12, 1);
      px(c, '#2a2016', 11, 11, 10, 2);
      px(c, '#777', 9, 8, 1, 4);
      px(c, '#777', 22, 8, 1, 4);
      px(c, '#777', 10, 7, 12, 1);
      break;
    case 'skulls':
      shadowBlob(c, 16, 22, 10);
      for (const [x, y] of [
        [9, 15],
        [17, 15],
        [13, 9],
      ]) {
        outlineRect(c, x, y, 7, 6, '#d8d2c0');
        px(c, '#b8b2a0', x + 5, y, 2, 6);
        px(c, '#1a1a1a', x + 1, y + 2, 2, 2);
        px(c, '#1a1a1a', x + 4, y + 2, 2, 2);
        px(c, '#1a1a1a', x + 3, y + 4, 1, 1);
        px(c, '#d8d2c0', x + 1, y + 6, 5, 1);
        px(c, '#1a1a1a', x + 2, y + 6, 1, 1);
        px(c, '#1a1a1a', x + 4, y + 6, 1, 1);
      }
      break;
    case 'shackles':
      px(c, '#3a3a40', 9, 0, 2, 12);
      px(c, '#3a3a40', 21, 0, 2, 12);
      for (let y = 0; y < 12; y += 3) {
        px(c, '#6a6a72', 9, y, 2, 2);
        px(c, '#6a6a72', 21, y, 2, 2);
      }
      c.strokeStyle = '#7a7a82';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(10, 15, 3, 0, Math.PI * 2);
      c.arc(22, 15, 3, 0, Math.PI * 2);
      c.stroke();
      break;
    case 'barrel':
      shadowBlob(c, 16, 26, 10);
      outlineRect(c, 8, 6, 16, 20, '#6a4428');
      px(c, '#7e5432', 9, 6, 4, 20);
      px(c, '#4e301a', 21, 6, 3, 20);
      px(c, '#2e2e30', 8, 9, 16, 2);
      px(c, '#2e2e30', 8, 21, 16, 2);
      px(c, '#58585c', 9, 9, 3, 1);
      px(c, '#58585c', 9, 21, 3, 1);
      px(c, '#3a2414', 14, 14, 4, 3);
      break;
    case 'crate':
      shadowBlob(c, 16, 26, 11);
      outlineRect(c, 7, 8, 18, 17, '#8a6a3a');
      px(c, '#6a4e28', 7, 8, 18, 2);
      px(c, '#6a4e28', 7, 23, 18, 2);
      px(c, '#6a4e28', 7, 8, 2, 17);
      px(c, '#6a4e28', 23, 8, 2, 17);
      for (let i = 0; i < 13; i++) px(c, '#6a4e28', 9 + i, 10 + i, 2, 1);
      px(c, '#a88a52', 10, 11, 2, 1);
      break;
    case 'sacks':
      shadowBlob(c, 16, 26, 12);
      for (const x of [6, 15]) {
        c.fillStyle = '#111';
        c.beginPath();
        c.ellipse(x + 6, 19, 7, 7, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#b8a070';
        c.beginPath();
        c.ellipse(x + 6, 19, 6, 6, 0, 0, Math.PI * 2);
        c.fill();
        px(c, '#968056', x + 8, 16, 3, 8);
        px(c, '#8a7048', x + 4, 11, 4, 3);
        px(c, '#5a4a2a', x + 4, 13, 4, 1);
      }
      break;
    case 'cauldron':
      shadowBlob(c, 16, 26, 11);
      c.fillStyle = '#111';
      c.beginPath();
      c.ellipse(16, 18, 10, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2e2e30';
      c.beginPath();
      c.ellipse(16, 18, 9, 7, 0, 0, Math.PI * 2);
      c.fill();
      px(c, '#3e5a2a', 9, 12, 14, 3);
      px(c, '#6a9a3a', 12, 12, 3, 1);
      px(c, '#4a4a4e', 9, 16, 2, 4);
      px(c, '#1a1a1a', 10, 25, 3, 2);
      px(c, '#1a1a1a', 20, 25, 3, 2);
      break;
    case 'vase': {
      shadowBlob(c, 16, 27, 7);
      const col = rng.pick(['#2a4a8a', '#8a2a2a', '#2a6a5a']);
      c.fillStyle = '#111';
      c.beginPath();
      c.ellipse(16, 19, 7, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(16, 19, 6, 7, 0, 0, Math.PI * 2);
      c.fill();
      outlineRect(c, 13, 7, 6, 5, col);
      px(c, '#e8e0c8', 11, 18, 10, 2);
      px(c, '#e8e0c8', 13, 9, 6, 1);
      px(c, 'rgba(255,255,255,0.35)', 12, 15, 2, 4);
      px(c, '#c8a040', 12, 26, 8, 1);
      break;
    }
    case 'armorStand':
      shadowBlob(c, 16, 29, 8);
      outlineRect(c, 12, 2, 8, 8, '#a7b0ba');
      px(c, '#1a1a1e', 13, 5, 6, 1);
      px(c, '#dde3e8', 13, 3, 3, 1);
      outlineRect(c, 10, 11, 12, 9, '#a7b0ba');
      px(c, '#dde3e8', 15, 12, 2, 7);
      px(c, '#5f6873', 10, 18, 12, 2);
      outlineRect(c, 12, 21, 3, 7, '#8a939d');
      outlineRect(c, 17, 21, 3, 7, '#8a939d');
      px(c, '#b3201c', 15, 0, 2, 2);
      px(c, '#5a3a20', 24, 2, 1, 26); // halberd
      px(c, '#c0c8d0', 23, 2, 4, 3);
      break;
    case 'bookPile':
      shadowBlob(c, 16, 26, 10);
      for (let i = 0; i < 5; i++) {
        const w = 14 - (i % 2) * 3;
        outlineRect(c, 9 + (i % 3), 22 - i * 3, w, 2, rng.pick(['#6a1a1a', '#1a3a5a', '#2a5a2a', '#6a5a1a', '#4a2a5a']));
        px(c, '#e8e0c8', 9 + (i % 3) + w - 2, 22 - i * 3, 1, 2);
      }
      px(c, '#e8d8a0', 14, 6, 2, 4); // candle on top
      px(c, '#ffcf5a', 14, 4, 2, 2);
      break;
    case 'globe':
      shadowBlob(c, 16, 28, 8);
      px(c, '#5a3a20', 15, 20, 2, 7);
      px(c, '#5a3a20', 11, 27, 10, 2);
      c.fillStyle = '#111';
      c.beginPath();
      c.arc(16, 13, 8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a6a8a';
      c.beginPath();
      c.arc(16, 13, 7, 0, Math.PI * 2);
      c.fill();
      px(c, '#6a8a3a', 12, 9, 4, 3);
      px(c, '#6a8a3a', 17, 13, 4, 4);
      px(c, '#6a8a3a', 13, 15, 2, 2);
      c.strokeStyle = '#c8a040';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(16, 13, 9, -2.4, 0.8);
      c.stroke();
      break;
    case 'bust':
      shadowBlob(c, 16, 29, 7);
      outlineRect(c, 11, 18, 10, 11, '#d8d4cc');
      px(c, '#b8b4ac', 18, 18, 3, 11);
      px(c, '#a8a49c', 11, 21, 10, 1);
      outlineRect(c, 12, 4, 8, 9, '#eae6de');
      outlineRect(c, 10, 12, 12, 5, '#eae6de');
      px(c, '#c8c4bc', 18, 4, 2, 9);
      px(c, '#2a2a2a', 13, 7, 6, 1); // a stone Jeff, unibrow and all
      px(c, '#b0aca4', 14, 10, 4, 1);
      break;
    case 'chest':
      shadowBlob(c, 16, 26, 11);
      outlineRect(c, 6, 12, 20, 13, '#6a3a1a');
      px(c, '#7e4a26', 6, 12, 20, 4);
      px(c, '#4a2810', 6, 16, 20, 1);
      px(c, '#c0a040', 6, 12, 2, 13);
      px(c, '#c0a040', 24, 12, 2, 13);
      outlineRect(c, 15, 16, 2, 3, '#e0c060');
      break;
    case 'lampTable':
      shadowBlob(c, 16, 28, 8);
      outlineRect(c, 9, 17, 14, 3, '#4a2810');
      px(c, '#4a2810', 10, 20, 2, 8);
      px(c, '#4a2810', 20, 20, 2, 8);
      px(c, '#c0a040', 15, 10, 2, 7);
      outlineRect(c, 11, 4, 10, 6, '#e8d8a0');
      px(c, '#ffe6a0', 12, 5, 8, 4);
      break;
    case 'bigPlant':
      shadowBlob(c, 16, 28, 9);
      outlineRect(c, 10, 19, 12, 9, '#8a4a2a');
      px(c, '#6a3a1a', 10, 19, 12, 2);
      for (let i = 0; i < 26; i++) {
        const a = rng.next() * Math.PI * 2;
        const r = rng.next() * 9;
        px(c, rng.pick(['#2e6a2a', '#4a8a3a', '#1e5a1e', '#5a9a46']), 16 + Math.cos(a) * r - 1, 11 + Math.sin(a) * r * 0.9 - 1, 3, 3);
      }
      break;
    case 'statue':
      shadowBlob(c, 16, 29, 9);
      outlineRect(c, 9, 24, 14, 5, '#8a8a8e');
      outlineRect(c, 12, 10, 8, 14, '#b8b8bc');
      px(c, '#98989c', 17, 10, 3, 14);
      outlineRect(c, 13, 3, 6, 6, '#c8c8cc');
      px(c, '#b8b8bc', 8, 11, 4, 2); // arm raised
      px(c, '#b8b8bc', 7, 6, 2, 6);
      px(c, '#4a6a3a', 10, 26, 3, 2); // moss
      px(c, '#4a6a3a', 18, 18, 2, 2);
      break;
    case 'bench':
      shadowBlob(c, 16, 25, 13);
      outlineRect(c, 4, 15, 24, 5, '#8a8a8e');
      px(c, '#a8a8ac', 4, 15, 24, 1);
      outlineRect(c, 6, 20, 3, 6, '#6a6a6e');
      outlineRect(c, 23, 20, 3, 6, '#6a6a6e');
      px(c, '#3e5a2e', 12, 15, 4, 1);
      break;
    case 'pumpkin': {
      shadowBlob(c, 16, 26, 10);
      c.fillStyle = '#111';
      c.beginPath();
      c.ellipse(16, 20, 10, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d0661a';
      c.beginPath();
      c.ellipse(16, 20, 9, 6, 0, 0, Math.PI * 2);
      c.fill();
      px(c, '#a04a10', 12, 15, 1, 11);
      px(c, '#a04a10', 19, 15, 1, 11);
      px(c, '#3a5a1a', 15, 11, 2, 4);
      // jack-o'-lantern face glows
      px(c, '#ffd040', 11, 18, 3, 2);
      px(c, '#ffd040', 18, 18, 3, 2);
      px(c, '#ffd040', 12, 22, 8, 1);
      px(c, '#ffd040', 13, 23, 2, 1);
      px(c, '#ffd040', 17, 23, 2, 1);
      break;
    }
    case 'lantern':
      shadowBlob(c, 16, 29, 6);
      px(c, '#1a1a1a', 15, 12, 2, 17);
      px(c, '#1a1a1a', 12, 28, 8, 2);
      outlineRect(c, 12, 3, 8, 9, '#2a2a2a');
      px(c, '#ffe08a', 13, 5, 6, 6);
      px(c, '#2a2a2a', 15, 5, 2, 6);
      px(c, '#2a2a2a', 11, 2, 10, 1);
      break;
    case 'candles':
      shadowBlob(c, 16, 26, 8);
      for (const [x, h] of [
        [10, 10],
        [14, 14],
        [19, 8],
        [22, 11],
      ]) {
        outlineRect(c, x, 25 - h, 3, h, '#e8e0c8');
        px(c, '#c8c0a8', x + 2, 25 - h, 1, h);
        px(c, '#ffcf5a', x + 1, 22 - h, 1, 2);
        px(c, '#d8d0b8', x - 1, 24, 2, 1); // drips
      }
      break;
  }
}

/** Props that give off a little light. */
export const GLOWING: Partial<Record<Prop, string>> = {
  candles: '255,190,100',
  lampTable: '255,200,120',
  lantern: '255,220,140',
  pumpkin: '255,160,60',
};
