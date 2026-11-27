// Panel and button frames drawn as little SVGs and used as CSS border-images
// (with `fill`, so the middle is the panel's face too). This is how a design
// gets stepped pixel corners that still stretch to any size. kit.css uses them as var(--fr-panel), var(--fr-btn) etc.

const enc = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

// A pixel frame with stepped round corners, on a grid of 16x16 "pixels"
// (slice it at 5, or 6 for the rounder steps). An outline, a light inner edge
// at the top-left, a dark one at the bottom-right and an optional trim line
// a couple of pixels inside. steps: how far in the outline starts on the
// first rows (and columns) from each corner.
export function pixelFrame(o: { fill: string; line: string; hi: string; lo: string; trim?: string; steps?: number[] }): string {
  const N = 16;
  const steps = o.steps ?? [3, 1, 1];
  const L = (i: number) => steps[Math.min(i, N - 1 - i)] ?? 0;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && x >= L(y) && x < N - L(y) && y >= L(x) && y < N - L(x);
  const edge = (x: number, y: number) => inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1));
  // distance (in steps) from the outline, for the trim
  const dist: number[][] = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (edge(x, y) ? 0 : 99)));
  for (let k = 0; k < 4; k++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (inside(x, y) && dist[y][x] > k)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dist[y + dy]?.[x + dx] === k) dist[y][x] = k + 1;
  let r = '';
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      let c = o.fill;
      if (dist[y][x] === 0) c = o.line;
      else if (dist[y][x] === 1) c = edge(x + 1, y) || edge(x, y + 1) ? o.lo : o.hi;
      else if (o.trim && dist[y][x] === 3) c = o.trim;
      r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${N}" height="${N}" shape-rendering="crispEdges">${r}</svg>`);
}
