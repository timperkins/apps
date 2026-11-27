import { describe, expect, it } from 'vitest';
import { MAPS, landGrid, mapsFor, startsFor, worldOf } from './maps';

// The usual world is CH * 80 by CH * 40 map pixels (see main.ts); small maps
// make a fraction of it.
const W0 = 128 * 80;
const H0 = 128 * 40;
const PW = 480;
const PH = 240;
const SEEDS = [1, 77, 4242, 31337, 90001];

// The land cell nearest a start (as findLand looks for it in game.ts:
// spiralling out, half as far up and down on screen).
function nearestLand(kind: Uint8Array, u: number, v: number): number {
  const ci = Math.floor(u * PW);
  const cj = Math.floor(v * PH);
  for (let r = 0; r < 60; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -2 * r; di <= 2 * r; di++) {
        if (Math.max(Math.abs(di) / 2, Math.abs(dj)) < r - 0.5) continue;
        const i = (((ci + di) % PW) + PW) % PW;
        const j = (((cj + dj) % PH) + PH) % PH;
        if (kind[j * PW + i] >= 2) return j * PW + i;
      }
  return -1;
}

// Which land cells can be driven to from cell q (the map wraps both ways).
function reachable(kind: Uint8Array, q: number, river: Uint8Array): Uint8Array {
  const seen = new Uint8Array(PW * PH);
  const stack = [q];
  seen[q] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    const i = c % PW;
    const j = (c - i) / PW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (((j + dj) % PH) + PH) % PH * PW + ((((i + di) % PW) + PW) % PW);
      if (!seen[n] && (kind[n] !== 0 || river[n])) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return seen;
}

describe('maps', () => {
  it('has twenty-four, with player counts from 2 to 8', () => {
    expect(MAPS).toHaveLength(24);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(24);
    for (let n = 2; n <= 8; n++) expect(mapsFor(n).length).toBeGreaterThanOrEqual(4);
    for (const m of MAPS) {
      expect(m.players[0]).toBeGreaterThanOrEqual(2);
      expect(m.players[1]).toBeLessThanOrEqual(8);
      expect(m.starts.length).toBeGreaterThanOrEqual(m.players[1]);
    }
  });

  for (const m of MAPS)
    it(`${m.name}: every start is on land that joins up with the others`, () => {
      const n = m.players[1];
      const { w: W, h: H } = worldOf(m, W0, H0);
      for (const seed of SEEDS) {
        // (rivers are crossed by bridges and fords)
        const { kind, river } = landGrid(m, seed, W, H, PW, PH);
        const cells = startsFor(m, n).map(([u, v]) => nearestLand(kind, u, v));
        expect(cells.every((c) => c >= 0), `${m.id} seed ${seed}: a start with no land near`).toBe(true);
        const seen = reachable(kind, cells[0], river);
        cells.forEach((c, i) => expect(seen[c], `${m.id} seed ${seed}: start ${i} cut off`).toBe(1));
        // and not far out at sea: the land is within a screen or so of the start
        startsFor(m, n).forEach(([u, v], i) => {
          const c = cells[i];
          const du = Math.abs((c % PW) / PW - u);
          const dv = Math.abs(Math.floor(c / PW) / PH - v);
          expect(Math.min(du, 1 - du) * W + Math.min(dv, 1 - dv) * H, `${m.id} seed ${seed}: start ${i} far from land`).toBeLessThan(1500);
        });
      }
    });

  it('starts with four small maps, the first an island with the bases close', () => {
    const small = MAPS.slice(0, 4);
    expect(small.every((m) => (m.size ?? 1) < 1)).toBe(true);
    expect(MAPS.slice(4).every((m) => (m.size ?? 1) === 1)).toBe(true);
    const isle = MAPS[0];
    const { w, h } = worldOf(isle, W0, H0);
    expect(w % 128 + (h % 128)).toBe(0);
    expect(w).toBeLessThan(W0 / 2);
    // the bases under a screen and a half apart on the ground
    const du = Math.abs(isle.home[0] - isle.enemy[0]) * w;
    const dv = Math.abs(isle.home[1] - isle.enemy[1]) * h * 2;
    expect(Math.hypot(du, dv)).toBeLessThan(1000);
    // and mostly water round the island
    const { kind } = landGrid(isle, 1, w, h, 160, 80);
    expect(kind.filter((k) => k === 0).length / kind.length).toBeGreaterThan(0.6);
  });
});
