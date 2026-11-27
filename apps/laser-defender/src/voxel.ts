import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One voxel in world units. Models are written in voxel units. */
export const VOX = 0.1;

/** [x, y, z, w, h, d, color, glow?]: min corner and size in voxels. */
export type Box = [number, number, number, number, number, number, number, (1 | 0)?];

const tmp = new THREE.Color();

function jitter(hex: number, amount: number, rnd: () => number): THREE.Color {
  tmp.setHex(hex);
  const k = 1 + (rnd() * 2 - 1) * amount;
  tmp.r = Math.min(1, tmp.r * k);
  tmp.g = Math.min(1, tmp.g * k);
  tmp.b = Math.min(1, tmp.b * k);
  return tmp;
}

let seed = 1;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** Merge boxes into one geometry with vertex colours. Coordinates are shifted by -origin. */
export function boxesGeometry(
  boxes: Box[],
  origin: [number, number, number] = [0, 0, 0],
  scale = VOX,
  jitterAmount = 0.07,
): THREE.BufferGeometry | null {
  if (!boxes.length) return null;
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, y, z, w, h, d, color] of boxes) {
    const g = new THREE.BoxGeometry(w * scale, h * scale, d * scale);
    g.translate((x + w / 2 - origin[0]) * scale, (y + h / 2 - origin[1]) * scale, (z + d / 2 - origin[2]) * scale);
    const c = jitter(color, jitterAmount, rand);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/**
 * A rig part: a group whose origin is the pivot (in voxels, model space).
 * Lit boxes use `mat`, glowing boxes use a shared unlit material.
 */
export function part(boxes: Box[], pivot: [number, number, number], mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const lit = boxesGeometry(boxes.filter((b) => !b[7]), pivot);
  const glow = boxesGeometry(boxes.filter((b) => b[7]), pivot, VOX, 0.02);
  if (lit) {
    const m = new THREE.Mesh(lit, mat);
    m.castShadow = true;
    g.add(m);
  }
  if (glow) g.add(new THREE.Mesh(glow, glowMat));
  g.position.set(pivot[0] * VOX, pivot[1] * VOX, pivot[2] * VOX);
  return g;
}

/** Mirror boxes across x = 0. */
export function mirrorX(boxes: Box[]): Box[] {
  return boxes.map(([x, y, z, w, h, d, c, gl]) => [-x - w, y, z, w, h, d, c, gl] as Box);
}
