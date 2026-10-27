/**
 * Procedural paper surface, generated at startup.
 *
 * Paper reads as paper mostly through its microstructure: a faint fibre grain
 * that catches grazing light, and roughness that varies just enough to break up
 * specular highlights. Both are generated here from value noise so the app
 * ships no texture assets and nothing has to be authored by hand.
 */

import * as THREE from "three";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number): number => t * t * (3 - 2 * t);

/**
 * Tiling value noise. `cellsX` and `cellsY` may differ, which is what gives the
 * grain its direction.
 */
function valueNoise(
  size: number,
  cellsX: number,
  cellsY: number,
  rnd: () => number,
): Float32Array {
  const lattice = new Float32Array(cellsX * cellsY);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();

  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cellsY;
    const y0 = Math.floor(fy) % cellsY;
    const y1 = (y0 + 1) % cellsY;
    const ty = fade(fy - Math.floor(fy));
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cellsX;
      const x0 = Math.floor(fx) % cellsX;
      const x1 = (x0 + 1) % cellsX;
      const tx = fade(fx - Math.floor(fx));
      const a = lattice[y0 * cellsX + x0];
      const b = lattice[y0 * cellsX + x1];
      const c = lattice[y1 * cellsX + x0];
      const d = lattice[y1 * cellsX + x1];
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

export type PaperTextures = {
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  dispose: () => void;
};

export function makePaperTextures(size = 512, seed = 7): PaperTextures {
  const rnd = mulberry32(seed);

  // Fibres: long and thin, so the lattice is stretched along one axis. The
  // finer isotropic octaves on top are the pulp texture between fibres.
  const height = new Float32Array(size * size);
  const octaves: Array<[number, number, number]> = [
    [24, 220, 0.55], // cellsX, cellsY, weight
    [48, 380, 0.25],
    [140, 140, 0.14],
    [300, 300, 0.06],
  ];
  let total = 0;
  for (const [cx, cy, w] of octaves) {
    const n = valueNoise(size, cx, cy, rnd);
    for (let i = 0; i < height.length; i++) height[i] += n[i] * w;
    total += w;
  }
  for (let i = 0; i < height.length; i++) height[i] /= total;

  // Slow mottling for roughness, independent of the fibre grain.
  const mottle = valueNoise(size, 9, 11, rnd);

  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)];

  // Scaled so the stored normal covers a useful range; final strength is set
  // with normalScale on the material.
  const relief = 3.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * relief;
      const dy = (at(x, y + 1) - at(x, y - 1)) * relief;
      const len = Math.hypot(-dx, -dy, 1);
      const i = (y * size + x) * 4;
      normalData[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      normalData[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      normalData[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5);
      normalData[i + 3] = 255;

      // Fibres sit slightly proud and scatter more; hollows are smoother.
      const r = 0.78 + mottle[y * size + x] * 0.14 + height[y * size + x] * 0.12;
      const v = Math.round(Math.min(1, Math.max(0, r)) * 255);
      roughData[i] = v;
      roughData[i + 1] = v;
      roughData[i + 2] = v;
      roughData[i + 3] = 255;
    }
  }

  const make = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const normalMap = make(normalData, false);
  const roughnessMap = make(roughData, false);

  return {
    normalMap,
    roughnessMap,
    dispose: () => {
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}
