// The ten areas of the mansion. Each covers five levels and paints its own tiles.
import { Rng } from './rng';

export const TILE = 32;

export interface Theme {
  name: string;
  blurb: string;
  darkness: number; // 0..1 alpha of the darkness overlay
  lightColor: string; // colour of wall lights
  lightKind: 'torch' | 'candle' | 'lamp' | 'moon' | 'none';
  playerLight: number; // radius in tiles of the light around Lenny
  bg: string;
  braid: number; // 0..1, share of dead ends opened into loops
  rooms: number; // open rooms carved into the maze
  floor: (ctx: CanvasRenderingContext2D, rng: Rng, variant: number) => void;
  wallTop: (ctx: CanvasRenderingContext2D, rng: Rng) => void;
  wallFace: (ctx: CanvasRenderingContext2D, rng: Rng, variant: number) => void;
  decor: (ctx: CanvasRenderingContext2D, rng: Rng) => void; // floor scatter, drawn on some floor tiles
  exitLabel: string;
}

const T = TILE;

function noise(ctx: CanvasRenderingContext2D, rng: Rng, colors: string[], n: number, size = 1, x0 = 0, y0 = 0, w = T, h = T) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rng.pick(colors);
    ctx.fillRect(x0 + Math.floor(rng.next() * (w - size + 1)), y0 + Math.floor(rng.next() * (h - size + 1)), size, size);
  }
}

function fill(ctx: CanvasRenderingContext2D, c: string, x = 0, y = 0, w = T, h = T) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** Brick/block courses for a wall face occupying y0..T. */
function bricks(ctx: CanvasRenderingContext2D, rng: Rng, y0: number, bw: number, bh: number, base: string[], mortar: string, offset: number) {
  fill(ctx, mortar, 0, y0, T, T - y0);
  let row = 0;
  for (let y = y0; y < T; y += bh, row++) {
    const off = row % 2 ? Math.floor(bw / 2) + offset : offset;
    for (let x = -bw; x < T + bw; x += bw) {
      const h = Math.min(bh - 1, T - y - 1);
      ctx.fillStyle = rng.pick(base);
      ctx.fillRect(x + off + 1, y + 1, bw - 1, h);
      // bevel: lit top edge, shadowed bottom edge, the odd chip
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + off + 1, y + 1, bw - 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + off + 1, y + h, bw - 1, 1);
      ctx.fillRect(x + off + bw - 1, y + 1, 1, h);
      if (rng.chance(0.15)) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + off + 2 + rng.int(0, bw - 5), y + 2 + rng.int(0, Math.max(0, h - 3)), 2, 1);
      }
    }
  }
}

const FACE_TOP = 9; // the top band of a wall tile shows the top of the wall

export const THEMES: Theme[] = [
  {
    name: 'The Dungeon Cells',
    blurb: 'Torch-lit cinderblock cells deep under the mansion.',
    darkness: 0.86,
    lightColor: '255,150,60',
    lightKind: 'torch',
    playerLight: 2.6,
    bg: '#0b0a0c',
    braid: 0.35,
    rooms: 1,
    floor(ctx, rng, v) {
      fill(ctx, '#2a2a2e');
      noise(ctx, rng, ['#26262a', '#303036', '#232326'], 60, 2);
      ctx.fillStyle = '#1d1d20';
      ctx.fillRect(0, 15, T, 1);
      ctx.fillRect(v % 2 ? 10 : 22, 0, 1, 15);
      ctx.fillRect(v % 2 ? 26 : 6, 16, 1, 16);
      if (v === 2) noise(ctx, rng, ['#3b3a35'], 4, 2);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#3a3a40');
      noise(ctx, rng, ['#34343a', '#404047'], 30, 2);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#3a3a40', 0, 0, T, FACE_TOP);
      bricks(ctx, rng, FACE_TOP, 16, 8, ['#6b6b70', '#636368', '#707075'], '#3e3e44', v * 3);
      noise(ctx, rng, ['#55555a', '#7a7a80'], 25, 1, 0, FACE_TOP, T, T - FACE_TOP);
      if (v === 1) {
        ctx.fillStyle = '#4a5a3a';
        ctx.fillRect(4, T - 4, 6, 4);
      }
    },
    decor(ctx, rng) {
      const k = rng.int(0, 3);
      if (k === 0) {
        // straw
        noise(ctx, rng, ['#8a7a3a', '#a08f45', '#6e6030'], 14, 1, 6, 10, 18, 12);
        ctx.fillStyle = '#a08f45';
        for (let i = 0; i < 6; i++) ctx.fillRect(6 + rng.int(0, 16), 12 + rng.int(0, 8), rng.int(3, 6), 1);
      } else if (k === 1) {
        // bones
        ctx.fillStyle = '#d8d2c0';
        ctx.fillRect(10, 18, 10, 2);
        ctx.fillRect(9, 17, 2, 4);
        ctx.fillRect(19, 17, 2, 4);
      } else if (k === 2) {
        // puddle
        ctx.fillStyle = '#1e2730';
        ctx.fillRect(8, 14, 14, 6);
        ctx.fillRect(10, 13, 9, 8);
        ctx.fillStyle = '#2f3d4a';
        ctx.fillRect(11, 15, 3, 1);
      } else {
        // chains
        ctx.fillStyle = '#56565c';
        for (let i = 0; i < 5; i++) ctx.fillRect(8 + i * 3, 20 + (i % 2), 2, 2);
      }
    },
    exitLabel: 'stairs up',
  },
  {
    name: 'The Wine Cellar',
    blurb: 'Dusty racks and barrels. Something drips in the dark.',
    darkness: 0.82,
    lightColor: '255,160,70',
    lightKind: 'torch',
    playerLight: 2.6,
    bg: '#0e0907',
    braid: 0.4,
    rooms: 2,
    floor(ctx, rng) {
      fill(ctx, '#3a2c22');
      noise(ctx, rng, ['#35281f', '#433327', '#2f241c'], 80, 2);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#3b2420');
      noise(ctx, rng, ['#35201c', '#432a25'], 30, 2);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#3b2420', 0, 0, T, FACE_TOP);
      if (v === 1) {
        // wine rack
        fill(ctx, '#3a2516', 0, FACE_TOP, T, T - FACE_TOP);
        for (let y = FACE_TOP + 2; y < T - 2; y += 6)
          for (let x = 2; x < T - 2; x += 6) {
            ctx.fillStyle = rng.pick(['#4a1020', '#2a3a1a', '#5a1a28']);
            ctx.fillRect(x, y, 4, 4);
            ctx.fillStyle = '#20140c';
            ctx.fillRect(x + 1, y + 1, 2, 2);
          }
      } else {
        bricks(ctx, rng, FACE_TOP, 12, 6, ['#7a3a2e', '#6e3428', '#84412f'], '#3a2420', 0);
        noise(ctx, rng, ['#5e2e24'], 20, 1, 0, FACE_TOP, T, T - FACE_TOP);
      }
    },
    decor(ctx, rng) {
      if (rng.chance(0.5)) {
        // barrel top
        ctx.fillStyle = '#5a3a20';
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a1a10';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#4a2e18';
        ctx.fillRect(8, 15, 16, 2);
      } else {
        ctx.fillStyle = '#5a0f1e';
        ctx.fillRect(9, 16, 12, 5);
        ctx.fillRect(12, 14, 6, 9);
      }
    },
    exitLabel: 'cellar door',
  },
  {
    name: "The Servants' Kitchen",
    blurb: 'Cold ovens, hanging pots and cleavers.',
    darkness: 0.68,
    lightColor: '255,190,110',
    lightKind: 'lamp',
    playerLight: 2.8,
    bg: '#0d0d0b',
    braid: 0.5,
    rooms: 3,
    floor(ctx, rng, v) {
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) fill(ctx, (x + y + v) % 2 ? '#77705f' : '#34322e', x * 16, y * 16, 16, 16);
      noise(ctx, rng, ['rgba(60,50,30,0.35)', 'rgba(0,0,0,0.2)'], 40, 2);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#3c463e');
      noise(ctx, rng, ['#36403a', '#435047'], 20, 2);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#3c463e', 0, 0, T, FACE_TOP);
      fill(ctx, '#7e9484', 0, FACE_TOP, T, T - FACE_TOP);
      ctx.fillStyle = '#5f7464';
      for (let y = FACE_TOP; y < T; y += 6) ctx.fillRect(0, y, T, 1);
      for (let x = 0; x < T; x += 8) ctx.fillRect(x, FACE_TOP, 1, T - FACE_TOP);
      noise(ctx, rng, ['#6a7a5e', '#8a7a5a'], 14, 2, 0, FACE_TOP, T, T - FACE_TOP);
      if (v === 1) {
        // hanging pan
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(15, FACE_TOP + 1, 2, 6);
        ctx.beginPath();
        ctx.arc(16, FACE_TOP + 13, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#444';
        ctx.fillRect(13, FACE_TOP + 11, 3, 2);
      }
    },
    decor(ctx, rng) {
      if (rng.chance(0.5)) {
        ctx.fillStyle = 'rgba(120,20,20,0.55)';
        ctx.fillRect(10, 12, 9, 7);
        ctx.fillRect(13, 10, 5, 11);
      } else {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(9, 18, 12, 3);
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(20, 18, 5, 3);
      }
    },
    exitLabel: 'service stairs',
  },
  {
    name: 'The Grand Hall',
    blurb: 'Red carpet, candelabras and a hundred watching eyes.',
    darkness: 0.62,
    lightColor: '255,200,120',
    lightKind: 'candle',
    playerLight: 3,
    bg: '#0d0606',
    braid: 0.55,
    rooms: 4,
    floor(ctx, rng) {
      fill(ctx, '#5a1418');
      noise(ctx, rng, ['#51121a', '#621a1e', '#4a1014'], 70, 2);
      ctx.fillStyle = '#7a5a20';
      ctx.fillRect(0, 0, T, 1);
      ctx.fillRect(0, 0, 1, T);
      ctx.fillStyle = '#6a1c22';
      ctx.fillRect(14, 14, 4, 4);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#2a1810');
      noise(ctx, rng, ['#24140c', '#30201a'], 20, 2);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#2a1810', 0, 0, T, FACE_TOP);
      fill(ctx, '#4a2c18', 0, FACE_TOP, T, T - FACE_TOP);
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(2, FACE_TOP + 3, 12, T - FACE_TOP - 6);
      ctx.fillRect(18, FACE_TOP + 3, 12, T - FACE_TOP - 6);
      ctx.fillStyle = '#5c3820';
      ctx.fillRect(3, FACE_TOP + 4, 10, 1);
      ctx.fillRect(19, FACE_TOP + 4, 10, 1);
      ctx.fillStyle = '#8a6a2a';
      ctx.fillRect(0, FACE_TOP, T, 1);
      if (v === 1) {
        // portrait
        ctx.fillStyle = '#9a7a2a';
        ctx.fillRect(7, FACE_TOP + 2, 18, 16);
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(9, FACE_TOP + 4, 14, 12);
        ctx.fillStyle = '#e8e2d8';
        ctx.fillRect(13, FACE_TOP + 6, 6, 6);
        ctx.fillStyle = '#111';
        ctx.fillRect(13, FACE_TOP + 8, 6, 1);
      }
      noise(ctx, rng, ['#40261a'], 10, 1, 0, FACE_TOP, T, T - FACE_TOP);
    },
    decor(ctx) {
      ctx.fillStyle = '#7a5a20';
      ctx.fillRect(6, 6, 20, 20);
      ctx.fillStyle = '#4a0c10';
      ctx.fillRect(8, 8, 16, 16);
    },
    exitLabel: 'grand staircase',
  },
  {
    name: 'The Library',
    blurb: 'Towering shelves. The books whisper your name.',
    darkness: 0.7,
    lightColor: '255,190,100',
    lightKind: 'candle',
    playerLight: 2.8,
    bg: '#0a0806',
    braid: 0.45,
    rooms: 3,
    floor(ctx, rng, v) {
      fill(ctx, '#4a3220');
      for (let y = 0; y < T; y += 8) {
        ctx.fillStyle = '#3a2618';
        ctx.fillRect(0, y, T, 1);
        ctx.fillRect(((y / 8 + v) % 2) * 16 + 4, y, 1, 8);
      }
      noise(ctx, rng, ['#52382a', '#42301e'], 40, 1);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#2c1c10');
      noise(ctx, rng, ['#26180c', '#342418'], 20, 2);
    },
    wallFace(ctx, rng) {
      fill(ctx, '#2c1c10', 0, 0, T, FACE_TOP);
      fill(ctx, '#3a2414', 0, FACE_TOP, T, T - FACE_TOP);
      for (let shelf = 0; shelf < 2; shelf++) {
        const y0 = FACE_TOP + 1 + shelf * 11;
        let x = 1;
        while (x < T - 2) {
          const w = rng.int(2, 4);
          const h = rng.int(7, 9);
          ctx.fillStyle = rng.pick(['#6a1a1a', '#1a3a5a', '#2a5a2a', '#6a5a1a', '#4a2a5a', '#7a4a2a', '#2a2a2a']);
          ctx.fillRect(x, y0 + 9 - h, w, h);
          x += w + (rng.chance(0.15) ? 1 : 0);
        }
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(0, y0 + 9, T, 2);
      }
    },
    decor(ctx, rng) {
      ctx.fillStyle = rng.pick(['#6a1a1a', '#1a3a5a', '#6a5a1a']);
      ctx.fillRect(10, 14, 10, 7);
      ctx.fillStyle = '#e8e0c8';
      ctx.fillRect(11, 15, 8, 1);
      ctx.fillRect(11, 19, 8, 1);
    },
    exitLabel: 'secret bookcase',
  },
  {
    name: 'The Portrait Gallery',
    blurb: 'Every painting is of Jeff. Every Jeff is smiling.',
    darkness: 0.66,
    lightColor: '230,210,255',
    lightKind: 'candle',
    playerLight: 2.8,
    bg: '#09070c',
    braid: 0.5,
    rooms: 4,
    floor(ctx, rng, v) {
      fill(ctx, '#3e2c1e');
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = (i + v) % 2 ? '#4a3424' : '#33241a';
        const horizontal = (i + v) % 2 === 0;
        if (horizontal) ctx.fillRect((i % 2) * 16, Math.floor(i / 2) * 16, 16, 16);
      }
      noise(ctx, rng, ['#2e2016', '#4e3828'], 30, 1);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#241a2c');
      noise(ctx, rng, ['#1e1626', '#2c2036'], 20, 2);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#241a2c', 0, 0, T, FACE_TOP);
      fill(ctx, '#3e2a4e', 0, FACE_TOP, T, T - FACE_TOP);
      ctx.fillStyle = '#4e3860';
      for (let y = FACE_TOP + 3; y < T; y += 6) for (let x = (y % 12) / 2; x < T; x += 8) ctx.fillRect(x, y, 2, 2);
      if (v >= 1) {
        // a portrait of Jeff
        ctx.fillStyle = '#b08a2a';
        ctx.fillRect(6, FACE_TOP + 1, 20, 19);
        ctx.fillStyle = '#20202a';
        ctx.fillRect(8, FACE_TOP + 3, 16, 15);
        ctx.fillStyle = '#efe9e1';
        ctx.fillRect(12, FACE_TOP + 5, 8, 8);
        ctx.fillStyle = '#0b0b0d';
        ctx.fillRect(12, FACE_TOP + 7, 8, 1);
        ctx.fillRect(14, FACE_TOP + 11, 4, 1);
        ctx.fillStyle = '#26262f';
        ctx.fillRect(10, FACE_TOP + 14, 12, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(15, FACE_TOP + 14, 2, 3);
      }
      noise(ctx, rng, ['#34243f'], 8, 1, 0, FACE_TOP, T, T - FACE_TOP);
    },
    decor(ctx) {
      ctx.fillStyle = '#5a1a2a';
      ctx.fillRect(4, 10, 24, 12);
      ctx.fillStyle = '#7a2a3a';
      ctx.fillRect(6, 12, 20, 1);
      ctx.fillRect(6, 19, 20, 1);
    },
    exitLabel: 'gallery doors',
  },
  {
    name: 'The Master Bedrooms',
    blurb: 'Four-poster beds and wardrobes. Someone is snoring.',
    darkness: 0.72,
    lightColor: '255,180,120',
    lightKind: 'lamp',
    playerLight: 2.7,
    bg: '#0a060a',
    braid: 0.5,
    rooms: 4,
    floor(ctx, rng) {
      fill(ctx, '#3a1e3e');
      noise(ctx, rng, ['#341a38', '#422446', '#2e1632'], 90, 1);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#1e1420');
      noise(ctx, rng, ['#1a101c', '#261a28'], 20, 2);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#1e1420', 0, 0, T, FACE_TOP);
      fill(ctx, '#2e4a3e', 0, FACE_TOP, T, T - FACE_TOP);
      ctx.fillStyle = '#3e5e4e';
      for (let y = FACE_TOP + 2; y < T; y += 8)
        for (let x = (y % 16 === 0 ? 4 : 0); x < T; x += 8) {
          ctx.fillRect(x + 2, y, 2, 4);
          ctx.fillRect(x + 1, y + 1, 4, 2);
        }
      if (v === 1) {
        // wardrobe
        ctx.fillStyle = '#3a2214';
        ctx.fillRect(4, FACE_TOP, 24, T - FACE_TOP);
        ctx.fillStyle = '#24140a';
        ctx.fillRect(15, FACE_TOP, 2, T - FACE_TOP);
        ctx.fillStyle = '#c0a040';
        ctx.fillRect(13, FACE_TOP + 10, 1, 2);
        ctx.fillRect(18, FACE_TOP + 10, 1, 2);
      }
      noise(ctx, rng, ['#26402e'], 6, 1, 0, FACE_TOP, T, T - FACE_TOP);
    },
    decor(ctx, rng) {
      if (rng.chance(0.5)) {
        ctx.fillStyle = '#d0c8c0';
        ctx.fillRect(6, 10, 14, 10);
        ctx.fillStyle = '#b0a8a0';
        ctx.fillRect(6, 18, 14, 2);
      } else {
        ctx.fillStyle = '#6a2a1a';
        ctx.fillRect(12, 12, 8, 3);
        ctx.fillRect(10, 18, 6, 3);
      }
    },
    exitLabel: 'servants\' passage',
  },
  {
    name: 'The Conservatory',
    blurb: 'Glass and moonlight. The plants are very hungry.',
    darkness: 0.6,
    lightColor: '170,200,255',
    lightKind: 'lamp',
    playerLight: 3,
    bg: '#050a08',
    braid: 0.55,
    rooms: 4,
    floor(ctx, rng, v) {
      fill(ctx, '#3a4440');
      ctx.fillStyle = '#2a3430';
      ctx.fillRect(0, 0, T, 1);
      ctx.fillRect(0, 0, 1, T);
      ctx.fillRect(15, 0, 1, T);
      ctx.fillRect(0, 15, T, 1);
      noise(ctx, rng, ['#435048', '#34403a'], 30, 2);
      if (v === 2) noise(ctx, rng, ['#2e5a2a', '#3e7a34'], 10, 2);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#1e3a1e');
      noise(ctx, rng, ['#2a4a26', '#183018', '#3a5a2e'], 60, 3);
    },
    wallFace(ctx, rng) {
      fill(ctx, '#1e3a1e', 0, 0, T, FACE_TOP);
      fill(ctx, '#3a4a5a', 0, FACE_TOP, T, T - FACE_TOP);
      ctx.fillStyle = '#5a7a9a';
      ctx.fillRect(2, FACE_TOP + 2, 12, T - FACE_TOP - 4);
      ctx.fillRect(18, FACE_TOP + 2, 12, T - FACE_TOP - 4);
      ctx.fillStyle = '#8ab0d0';
      ctx.fillRect(4, FACE_TOP + 4, 2, 6);
      ctx.fillRect(20, FACE_TOP + 4, 2, 6);
      noise(ctx, rng, ['#2a5a26', '#3e7a34', '#1e4a1e'], 40, 3, 0, FACE_TOP, T, 10);
    },
    decor(ctx, rng) {
      ctx.fillStyle = '#7a3a1a';
      ctx.fillRect(10, 16, 12, 9);
      noise(ctx, rng, ['#2e6a2a', '#4a8a3a', '#1e5a1e'], 30, 3, 6, 4, 20, 14);
    },
    exitLabel: 'garden door',
  },
  {
    name: 'The Hedge Maze',
    blurb: 'Out at last, under the moon. The hedges go on forever.',
    darkness: 0.7,
    lightColor: '190,210,255',
    lightKind: 'moon',
    playerLight: 3.2,
    bg: '#040804',
    braid: 0.25,
    rooms: 1,
    floor(ctx, rng) {
      fill(ctx, '#24361e');
      noise(ctx, rng, ['#2a3e22', '#1e2e18', '#30462a'], 90, 1);
      ctx.fillStyle = '#3a5230';
      for (let i = 0; i < 8; i++) ctx.fillRect(rng.int(0, T - 1), rng.int(0, T - 3), 1, 2);
    },
    wallTop(ctx, rng) {
      fill(ctx, '#183a16');
      noise(ctx, rng, ['#1e4a1c', '#123012', '#245a22'], 80, 3);
    },
    wallFace(ctx, rng) {
      fill(ctx, '#183a16');
      noise(ctx, rng, ['#1e4a1c', '#123012', '#245a22'], 60, 3, 0, 0, T, FACE_TOP + 4);
      fill(ctx, '#123012', 0, FACE_TOP + 4, T, T - FACE_TOP - 4);
      noise(ctx, rng, ['#183a16', '#0c240c', '#1e4a1c'], 90, 2, 0, FACE_TOP + 4, T, T - FACE_TOP - 4);
    },
    decor(ctx, rng) {
      // little white flowers
      for (let i = 0; i < 5; i++) {
        const x = rng.int(4, 26);
        const y = rng.int(4, 26);
        ctx.fillStyle = '#d8e0ff';
        ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = '#e8d84a';
        ctx.fillRect(x, y, 1, 1);
      }
    },
    exitLabel: 'hedge gap',
  },
  {
    name: 'The Grounds at Night',
    blurb: 'Gravestones, gnarled trees and the front gate. Freedom is close.',
    darkness: 0.76,
    lightColor: '200,220,255',
    lightKind: 'moon',
    playerLight: 3.2,
    bg: '#030506',
    braid: 0.6,
    rooms: 5,
    floor(ctx, rng, v) {
      if (v === 0) {
        fill(ctx, '#4a463e');
        noise(ctx, rng, ['#5a564c', '#3a362e', '#625e54'], 80, 2);
      } else {
        fill(ctx, '#1e2a1a');
        noise(ctx, rng, ['#243020', '#18221a', '#2a3824'], 80, 1);
      }
    },
    wallTop(ctx, rng) {
      fill(ctx, '#141814');
      noise(ctx, rng, ['#1a201a', '#0e120e'], 40, 3);
    },
    wallFace(ctx, rng, v) {
      fill(ctx, '#1e2a1a');
      if (v === 0) {
        // iron fence
        ctx.fillStyle = '#111';
        for (let x = 2; x < T; x += 6) ctx.fillRect(x, 4, 2, T - 6);
        ctx.fillRect(0, 8, T, 2);
        ctx.fillRect(0, T - 8, T, 2);
        ctx.fillStyle = '#333';
        for (let x = 2; x < T; x += 6) ctx.fillRect(x, 3, 2, 1);
      } else if (v === 1) {
        // gravestone
        ctx.fillStyle = '#6a6a6e';
        ctx.fillRect(8, 8, 16, 22);
        ctx.fillRect(10, 6, 12, 2);
        ctx.fillStyle = '#4a4a4e';
        ctx.fillRect(12, 14, 8, 1);
        ctx.fillRect(15, 11, 2, 8);
        noise(ctx, rng, ['#3e5a2e'], 8, 1, 8, 24, 16, 6);
      } else {
        // dead tree
        ctx.fillStyle = '#2a1e16';
        ctx.fillRect(13, 6, 6, 26);
        ctx.fillRect(6, 8, 8, 2);
        ctx.fillRect(18, 4, 9, 2);
        ctx.fillRect(5, 4, 2, 5);
        ctx.fillRect(25, 1, 2, 4);
      }
    },
    decor(ctx, rng) {
      noise(ctx, rng, ['#3a2a1a', '#4a3a2a'], 6, 2, 4, 4, 24, 24);
      ctx.fillStyle = '#5a5a50';
      ctx.fillRect(rng.int(6, 20), rng.int(6, 20), 3, 2);
    },
    exitLabel: 'front gate',
  },
];

export const themeFor = (level: number) => THEMES[Math.min(THEMES.length - 1, Math.floor((level - 1) / 5))];
