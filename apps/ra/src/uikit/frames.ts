// Panel and button frames drawn as little SVGs and used as CSS border-images
// (with `fill`, so the middle is the panel's face too). This is how a design
// gets cut corners, stepped pixel corners or bolted bevels that still stretch
// to any size. kit.css uses them as var(--fr-panel), var(--fr-btn) etc.

const enc = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

// Cut corners, a dark outline, a light top-left and dark bottom-right edge and
// optional rivets. 32x32 units, sliced at 10.
export function chamfer(o: { fill: string; line: string; hi: string; lo: string; rivet?: string; cut?: number }): string {
  const c = o.cut ?? 7;
  const W = 32;
  const poly = (i: number) => {
    const k = c - i * 0.4;
    return `${k + i},${i} ${W - k - i},${i} ${W - i},${k + i} ${W - i},${W - k - i} ${W - k - i},${W - i} ${k + i},${W - i} ${i},${W - k - i} ${i},${k + i}`;
  };
  const rivet = (x: number, y: number) =>
    o.rivet ? `<circle cx="${x}" cy="${y}" r="1.6" fill="${o.rivet}"/><circle cx="${x - 0.5}" cy="${y - 0.5}" r="0.6" fill="#fff" fill-opacity=".6"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
    <polygon points="${poly(0)}" fill="${o.line}"/>
    <polygon points="${poly(1.5)}" fill="${o.lo}" transform="translate(.6 .6)"/>
    <polygon points="${poly(1.5)}" fill="${o.hi}" transform="translate(-.6 -.6)"/>
    <polygon points="${poly(2.5)}" fill="${o.fill}"/>
    ${rivet(6.5, 6.5)}${rivet(W - 6.5, 6.5)}${rivet(6.5, W - 6.5)}${rivet(W - 6.5, W - 6.5)}
  </svg>`;
  return enc(svg);
}

// A pixel frame with stepped round corners, on a grid of 16x16 "pixels",
// sliced at 5. Outline, a light inner edge at the top-left, a dark one at
// the bottom-right and an optional trim line one pixel inside.
export function pixelFrame(o: { fill: string; line: string; hi: string; lo: string; trim?: string }): string {
  const N = 16;
  let r = '';
  const px = (x: number, y: number, w: number, h: number, f: string) => (r += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`);
  // the shape: corners stepped 2,1
  const rowSpan = (y: number) => (y === 0 || y === N - 1 ? 3 : y === 1 || y === N - 2 ? 1 : y === 2 || y === N - 3 ? 1 : 0);
  for (let y = 0; y < N; y++) {
    const s = rowSpan(y);
    px(s, y, N - 2 * s, 1, o.line);
  }
  for (let y = 1; y < N - 1; y++) {
    const s = Math.max(rowSpan(y) + 1, 1);
    const s2 = y === 1 || y === N - 2 ? 3 : y === 2 || y === N - 3 ? 2 : 1;
    px(Math.max(s, s2), y, N - 2 * Math.max(s, s2), 1, o.fill);
  }
  // bevel
  px(3, 1, N - 6, 1, o.hi);
  px(1, 3, 1, N - 6, o.hi);
  px(2, 2, 1, 1, o.hi);
  px(3, N - 2, N - 6, 1, o.lo);
  px(N - 2, 3, 1, N - 6, o.lo);
  px(N - 3, N - 3, 1, 1, o.lo);
  if (o.trim) {
    px(4, 3, N - 8, 1, o.trim);
    px(4, N - 4, N - 8, 1, o.trim);
    px(3, 4, 1, N - 8, o.trim);
    px(N - 4, 4, 1, N - 8, o.trim);
  }
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${N}" height="${N}" shape-rendering="crispEdges">${r}</svg>`);
}

// A square bevelled plate with hex bolts in the corners. 32x32, sliced at 10.
export function boltPlate(o: { fill: string; line: string; hi: string; lo: string; bolt: string }): string {
  const W = 32;
  const bolt = (x: number, y: number) =>
    `<polygon points="${[0, 60, 120, 180, 240, 300].map((a) => `${x + 2.4 * Math.cos((a * Math.PI) / 180)},${y + 2.4 * Math.sin((a * Math.PI) / 180)}`).join(' ')}" fill="${o.bolt}" stroke="${o.line}" stroke-width=".6"/><circle cx="${x}" cy="${y}" r=".8" fill="${o.line}" fill-opacity=".6"/>`;
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
    <rect width="${W}" height="${W}" rx="1.5" fill="${o.line}"/>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${W - 3}" fill="${o.lo}"/>
    <path d="M1.5 1.5H${W - 1.5}L${W - 3.5} 3.5H3.5V${W - 3.5}L1.5 ${W - 1.5}Z" fill="${o.hi}"/>
    <rect x="3.5" y="3.5" width="${W - 7}" height="${W - 7}" fill="${o.fill}"/>
    ${bolt(7, 7)}${bolt(W - 7, 7)}${bolt(7, W - 7)}${bolt(W - 7, W - 7)}
  </svg>`);
}

// Topographic contour lines, as a repeating background tile.
export function contours(stroke: string): string {
  const loops = [
    'M20 60c10-30 50-40 70-20s10 50-20 55-55-10-50-35z',
    'M30 62c8-20 38-28 52-14s6 36-14 40-42-8-38-26z',
    'M42 63c5-10 22-14 30-6s3 20-8 22-24-5-22-16z',
    'M120 20c30-10 70 0 72 30s-40 45-70 35-30-55-2-65z',
    'M132 30c20-6 46 2 48 22s-28 30-48 22-18-38 0-44z',
    'M146 40c10-3 24 2 24 12s-14 15-24 11-9-20 0-23z',
    'M-10 150c40-20 90-10 120 10s70 30 100 10',
    'M-10 165c40-18 90-8 120 12s70 28 100 8',
    'M-10 180c40-16 90-6 120 14s70 26 100 6',
  ];
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><g fill="none" stroke="${stroke}" stroke-width="1">${loops.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`);
}

// A hexagon grid tile.
export function hexGrid(stroke: string): string {
  const h = Math.sqrt(3) * 10;
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 ${h * 2}" width="30" height="${h * 2}"><path d="M0 ${h}L5 0h10l5 ${h}-5 ${h}H5z M20 ${h}h10" fill="none" stroke="${stroke}" stroke-width=".6"/></svg>`);
}
