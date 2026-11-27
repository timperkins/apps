// The yard: made from a seed so every player builds the same map. Big trees, plants, little beaches,
// big leaves, flowers, grass and water puddles. Only tree trunks block; water slows ants down.
import { WORLD } from './data';

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface Puddle { x: number; y: number; r: number; beach: number; pts: number[] }
export interface Tree { x: number; y: number; trunk: number; canopy: number; hue: number; blobs: { a: number; d: number; r: number }[] }
export interface Leaf { x: number; y: number; len: number; a: number; color: string; vein: string }
export interface Flower { x: number; y: number; r: number; petals: number; color: string; center: string; a: number }
export interface Plant { x: number; y: number; kind: 'clover' | 'fern' | 'mushroom' | 'pebble'; s: number; a: number }
export interface Tuft { x: number; y: number; s: number; a: number; c: number }

export interface World {
  seed: number;
  puddles: Puddle[];
  trees: Tree[];
  leaves: Leaf[];
  flowers: Flower[];
  plants: Plant[];
  tufts: Tuft[];
  dirt: { x: number; y: number; r: number }[];
}

const FLOWER_COLORS = ['#ff5c8a', '#ffd23f', '#ffffff', '#b77bff', '#ff8a3d', '#6ec8ff', '#ff3d3d'];
const LEAF_COLORS: [string, string][] = [['#3f8f3a', '#2c6a28'], ['#5aa846', '#3e7c30'], ['#b7a032', '#8a7622'], ['#c9682a', '#94461a'], ['#7d9c2e', '#5a7420']];

export function makeWorld(seed: number): World {
  const r = rng(seed);
  const between = (a: number, b: number) => a + r() * (b - a);
  const W = WORLD;
  const puddles: Puddle[] = [];
  const trees: Tree[] = [];
  const clearOf = (x: number, y: number, pad: number) =>
    puddles.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + p.beach + pad) &&
    trees.every((t) => Math.hypot(t.x - x, t.y - y) > t.trunk + pad);

  for (let i = 0; i < 400 && puddles.length < 22; i++) {
    const x = between(200, W - 200), y = between(200, W - 200), rad = between(70, 210);
    const beach = r() < 0.55 ? between(30, 70) : 0;
    if (!puddles.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + p.beach + rad + beach + 120)) continue;
    if (Math.hypot(x - W / 2, y - W / 2) < 260) continue; // keep the middle dry for a start
    const pts: number[] = [];
    for (let k = 0; k < 14; k++) pts.push(between(0.82, 1.12));
    puddles.push({ x, y, r: rad, beach, pts });
  }
  for (let i = 0; i < 600 && trees.length < 26; i++) {
    const x = between(150, W - 150), y = between(150, W - 150), trunk = between(34, 60);
    if (!clearOf(x, y, trunk + 160)) continue;
    if (!trees.every((t) => Math.hypot(t.x - x, t.y - y) > 460)) continue;
    const canopy = trunk * between(3.3, 4.3);
    const blobs = [];
    const n = 7 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) blobs.push({ a: (k / n) * Math.PI * 2 + between(-0.3, 0.3), d: canopy * between(0.45, 0.7), r: canopy * between(0.38, 0.55) });
    trees.push({ x, y, trunk, canopy, hue: between(95, 135), blobs });
  }
  const leaves: Leaf[] = [];
  for (let i = 0; i < 900 && leaves.length < 120; i++) {
    const x = between(60, W - 60), y = between(60, W - 60);
    if (!clearOf(x, y, 40)) continue;
    const [color, vein] = LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)];
    leaves.push({ x, y, len: between(70, 170), a: r() * Math.PI * 2, color, vein });
  }
  const flowers: Flower[] = [];
  for (let i = 0; i < 2000 && flowers.length < 260; i++) {
    const x = between(30, W - 30), y = between(30, W - 30);
    if (!clearOf(x, y, 20)) continue;
    flowers.push({
      x, y, r: between(10, 26), petals: 5 + Math.floor(r() * 4), color: FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)],
      center: r() < 0.5 ? '#ffcf3a' : '#7a4a1a', a: r() * Math.PI,
    });
  }
  const plants: Plant[] = [];
  for (let i = 0; i < 3000 && plants.length < 420; i++) {
    const x = between(30, W - 30), y = between(30, W - 30);
    if (!clearOf(x, y, 16)) continue;
    const roll = r();
    const kind = roll < 0.42 ? 'clover' : roll < 0.7 ? 'fern' : roll < 0.82 ? 'mushroom' : 'pebble';
    plants.push({ x, y, kind, s: between(14, 38), a: r() * Math.PI * 2 });
  }
  const tufts: Tuft[] = [];
  for (let i = 0; i < 9000; i++) tufts.push({ x: r() * W, y: r() * W, s: between(5, 13), a: between(-0.5, 0.5), c: r() });
  const dirt = [];
  for (let i = 0; i < 40; i++) dirt.push({ x: r() * W, y: r() * W, r: between(60, 160) });
  return { seed, puddles, trees, leaves, flowers, plants, tufts, dirt };
}

/** How far into a puddle this point is: 0 = dry, 1 = in the middle. */
export function wetness(w: World, x: number, y: number): number {
  for (const p of w.puddles) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < p.r) return 1 - d / p.r;
  }
  return 0;
}

export function onBeach(w: World, x: number, y: number): boolean {
  for (const p of w.puddles) {
    if (!p.beach) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= p.r && d < p.r + p.beach) return true;
  }
  return false;
}

/** Push a circle out of tree trunks and keep it inside the yard. */
export function collide(w: World, x: number, y: number, rad: number): [number, number] {
  for (const t of w.trees) {
    const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy), min = t.trunk + rad;
    if (d < min) {
      const k = d > 0.01 ? min / d : 1;
      x = t.x + (d > 0.01 ? dx : 1) * k;
      y = t.y + (d > 0.01 ? dy : 0) * k;
    }
  }
  return [Math.max(rad, Math.min(WORLD - rad, x)), Math.max(rad, Math.min(WORLD - rad, y))];
}

/** A dry, open spot (not in water or a trunk). */
export function openSpot(w: World, rand: () => number, pad = 30): [number, number] {
  for (let i = 0; i < 60; i++) {
    const x = pad + rand() * (WORLD - pad * 2), y = pad + rand() * (WORLD - pad * 2);
    if (wetness(w, x, y) > 0) continue;
    if (w.trees.some((t) => Math.hypot(t.x - x, t.y - y) < t.trunk + pad)) continue;
    return [x, y];
  }
  return [WORLD / 2, WORLD / 2];
}
