// The big map (M): the land around you, with the places you know about.
import type { Game } from './game';
import { CX, CY, G, GROVE, LAIRS, S, VILLAGES, gen, sitesNear, tG, tH, tT, T } from './world';

const COL: Record<number, [number, number, number]> = {
  [G.Grass]: [99, 176, 75], [G.Forest]: [60, 130, 52], [G.Sand]: [227, 208, 143], [G.Water]: [59, 127, 198],
  [G.Rock]: [145, 140, 132], [G.Snow]: [238, 243, 248], [G.Dirt]: [168, 137, 90], [G.Path]: [215, 180, 120],
  [G.Bridge]: [155, 107, 60], [G.Gloom]: [94, 83, 115], [G.Stone]: [140, 137, 150], [G.Floor]: [110, 107, 120], [G.Dark]: [60, 30, 80],
  [G.Roof]: [196, 83, 58], [G.Farm]: [122, 82, 48],
};

/** How many tiles the map shows across. */
const SPAN = 1400;
const N = 200;

export function drawBigMap(c: HTMLCanvasElement, g: Game) {
  const ctx = c.getContext('2d')!;
  const p = g.p;
  const step = SPAN / N;
  const img = ctx.createImageData(N, N);
  const x0 = p.x - SPAN / 2, y0 = p.y - SPAN / 2;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const v = gen(Math.floor(x0 + i * step), Math.floor(y0 + j * step), g.world.seed);
      const col = COL[tG(v)] ?? [0, 0, 0];
      const f = (0.75 + Math.min(tH(v), 24) * 0.018) * (tT(v) === T.Oak || tT(v) === T.Pine ? 0.85 : 1);
      const k = (j * N + i) * 4;
      img.data[k] = col[0] * f;
      img.data[k + 1] = col[1] * f;
      img.data[k + 2] = col[2] * f;
      img.data[k + 3] = 255;
    }
  const off = document.createElement('canvas');
  off.width = off.height = N;
  off.getContext('2d')!.putImageData(img, 0, 0);
  const W = c.width, H = c.height;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  // rotated like the screen: up on the map is up on the screen
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, 0.62);
  ctx.rotate(Math.PI / 4);
  const k = (H / N) * 1.05;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, (-N / 2) * k, (-N / 2) * k, N * k, N * k);
  const pos = (wx: number, wy: number) => [((wx - p.x) / step) * k, ((wy - p.y) / step) * k] as const;
  const inside = (wx: number, wy: number) => Math.abs(wx - p.x) < SPAN / 2 && Math.abs(wy - p.y) < SPAN / 2;
  const mark = (wx: number, wy: number, text: string, col: string, size = 14) => {
    if (!inside(wx, wy)) return;
    const [x, y] = pos(wx, wy);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.scale(1, 1 / 0.62);
    ctx.font = `900 ${size}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillText(text, 1, 1);
    ctx.fillStyle = col;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const lx = g.lx;
  for (const s of sitesNear(p.x, p.y, SPAN / 2, g.world.seed)) {
    if (!lx.discovered.has(s.key)) continue;
    if (s.kind === S.Camp) mark(s.x, s.y, lx.camps.get(s.key)?.cleared ? '✓' : '🔥', '#ff6a4a', 12);
    else if (s.kind === S.Shrine) mark(s.x, s.y, '✦', lx.found.has(s.key) ? '#ffc04a' : '#7fe0ff', 16);
    else if (s.kind === S.Tower) mark(s.x, s.y, '▲', lx.towers.has(s.key) ? '#7fe0ff' : '#eee', 13);
    else if (s.kind === S.Spring) mark(s.x, s.y, '◎', '#bff4ff', 14);
    else mark(s.x, s.y, '◆', '#c9b0ff', 11);
  }
  for (const v of VILLAGES) mark(v.x, v.y, '⌂', '#ffb070', 18);
  for (const l of LAIRS) mark(l.x, l.y, '☠', '#ff9aff', 16);
  mark(CX, CY, '♜', '#d080ff', 20);
  if (!lx.light) mark(GROVE.x, GROVE.y, '✨', '#fff2a0', 18);
  for (const o of g.others) mark(o.x, o.y, '●', '#9fe8ff', 12);
  ctx.restore();
  // you, in the middle
  const sdx = Math.cos(p.face) - Math.sin(p.face), sdy = (Math.cos(p.face) + Math.sin(p.face)) / 2;
  const a = Math.atan2(sdy, sdx);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(a);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
