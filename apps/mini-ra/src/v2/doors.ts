// Doors that new units come out of: the Vehicle works' garage door and the
// Air command's hangar door, which roll up, and the Barracks' pair of doors, which swing in. The doors are
// part of the buildings' pictures; these draw them open, and limit a unit
// still coming out to what shows through the doorway.
import { BARRACKS_DOOR, BuildingKind, FACTORY_DOOR, HANGAR_DOOR } from './sprites';
import { toScreen } from './stack';

export interface Door {
  x: number; // its middle on the ground, from the building's middle
  y: number;
  nx: number; // which way out it faces
  ny: number;
  hw: number; // half its width
  top: number; // its height
  roll: boolean; // rolls up (or swings open from the middle)
}

/** How long a door takes to open, and how long a new unit waits for it. */
export const DOOR_S = 0.4;

/** The door of a building that units come out of, or null. */
export function doorOf(kind: BuildingKind): Door | null {
  if (kind === 'factory') return { x: FACTORY_DOOR[0], y: 18, nx: 0, ny: 1, hw: FACTORY_DOOR[1], top: FACTORY_DOOR[2], roll: true };
  if (kind === 'radar') return { x: HANGAR_DOOR[0], y: HANGAR_DOOR[1], nx: 0, ny: 1, hw: HANGAR_DOOR[2], top: HANGAR_DOOR[3], roll: true };
  if (kind === 'barracks') return { x: 14, y: BARRACKS_DOOR[0], nx: 1, ny: 0, hw: BARRACKS_DOOR[1], top: BARRACKS_DOOR[2], roll: false };
  return null;
}

// The open part of the doorway (open 0..1): half its width and its height.
function opening(d: Door, open: number): [number, number] {
  return d.roll ? [d.hw - 0.9, (d.top - 0.9) * open] : [(d.hw - 0.5) * open, d.top - 0.7];
}

/** Draw door d of the building whose middle is at world (bx, by), open 0..1. */
export function drawDoor(c: CanvasRenderingContext2D, d: Door, bx: number, by: number, open: number): void {
  if (open <= 0) return;
  const lx = -d.ny;
  const ly = d.nx;
  const quad = (l0: number, l1: number, z0: number, z1: number, fill: string) => {
    c.fillStyle = fill;
    c.beginPath();
    for (const [i, [l, z]] of ([[l0, z0], [l1, z0], [l1, z1], [l0, z1]] as const).entries()) {
      const [x, y] = toScreen(bx + d.x + lx * l + d.nx * 0.1, by + d.y + ly * l + d.ny * 0.1, z);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
  };
  const [w, h] = opening(d, open);
  quad(-w, w, 0, h, '#141412');
  quad(-w, w, 0, Math.min(h, 1.2), '#2a2925'); // the floor inside, catching the light
  if (d.roll) {
    if (h > 6) quad(-w + 3, w - 3, h - 2.2, h - 1.6, 'rgba(240,220,132,0.55)'); // lamps in the roof
    quad(-w, w, Math.max(0, h - 0.5), h, '#757c80'); // the rolled-up door's bottom edge
  }
}

/**
 * Clip to what shows through door d (its middle on the ground at world
 * (x, y)) open 0..1: the doorway carried on out the way it faces. Call
 * between save() and restore().
 */
export function clipDoorway(c: CanvasRenderingContext2D, d: Door, x: number, y: number, open: number): void {
  const [w, h] = opening(d, Math.max(0, open));
  const lx = -d.ny;
  const ly = d.nx;
  const pts: [number, number][] = [];
  for (const s of [-w, w]) for (const z of [0, h]) for (const o of [0, 80]) pts.push(toScreen(x + lx * s + d.nx * o, y + ly * s + d.ny * o, z));
  c.beginPath();
  convexHull(pts).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
  c.clip();
}

// The convex hull of some points, in order round it.
function convexHull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (q: [number, number][]) => {
    const out: [number, number][] = [];
    for (const r of q) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], r) <= 0) out.pop();
      out.push(r);
    }
    return out.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())];
}
