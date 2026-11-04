import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Shared materials, geometry helpers and canvas textures for the realistic diorama look. */

function noiseTex(n: number, fn: (x: number, y: number) => number, repeat = 3): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d')!;
  const id = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = fn(x, y);
      const i = (y * n + x) * 4;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
  ctx.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

let fabric: THREE.Texture | null = null;
let hairBump: THREE.Texture | null = null;
const fabricNoise = () => (fabric ??= noiseTex(128, (x, y) => 128 + (((x % 4 < 2) !== (y % 4 < 2)) ? 22 : -22) + (Math.random() - 0.5) * 40));
const hairNoise = () => (hairBump ??= noiseTex(128, (x, y) => 128 + Math.sin(x * 0.9 + Math.sin(y * 0.05) * 6) * 60 + (Math.random() - 0.5) * 30));

export interface MatOpts {
  skin?: boolean;
  hair?: boolean;
  rough?: number;
  metal?: number;
  map?: THREE.Texture;
  glow?: boolean;
  plain?: boolean;
}

const cache = new Map<string, THREE.Material>();

export function M(color: string, o: MatOpts = {}): THREE.Material {
  const key = color + (o.skin ? 's' : '') + (o.hair ? 'h' : '') + (o.rough ?? '') + (o.metal ?? '') + (o.glow ? 'g' : '') + (o.plain ? 'p' : '');
  if (!o.map && cache.has(key)) return cache.get(key)!;
  const c = new THREE.Color(color);
  let m: THREE.Material;
  if (o.glow) m = new THREE.MeshBasicMaterial({ color: c, map: o.map ?? null });
  else if (o.skin)
    m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffb8a0'), clearcoat: 0.05, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
  else if (o.hair)
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, bumpMap: hairNoise(), bumpScale: 2, envMapIntensity: 0.45 });
  else if (o.plain || o.map)
    m = new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, map: o.map ?? null, envMapIntensity: 0.5 });
  else
    m = new THREE.MeshPhysicalMaterial({ color: c, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0, sheen: 0.5, sheenRoughness: 0.75, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.3), bumpMap: fabricNoise(), bumpScale: 1.2, envMapIntensity: 0.55 });
  if (!o.map) cache.set(key, m);
  return m;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export const sph = (r: number, ws = 24, hs = 18, phiStart = 0, phiLen = Math.PI * 2, thStart = 0, thLen = Math.PI) =>
  new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thStart, thLen);
export const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, Math.max(0.001, l), 6, 16);
export const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
export const cyl = (rt: number, rb: number, h: number, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** A capsule whose two ends have different radii, for limbs that taper. */
export function taper(rTop: number, rBot: number, len: number, seg = 18): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * rBot), -len / 2 + Math.sin(a) * rBot));
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * rTop), len / 2 + Math.sin(a) * rTop));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Hips to neck as one shape, so a body has a waist and shoulders. */
export function torsoGeo(h: number, hip: number, waist: number, chest: number, shoulder: number, neck: number): THREE.BufferGeometry {
  const P: [number, number][] = [[0.0001, 0], [hip * 0.85, 0.01], [hip, 0.1], [hip * 0.98, 0.22], [waist, 0.42], [chest, 0.68], [shoulder, 0.84], [shoulder * 0.8, 0.94], [neck, 1.0], [0.0001, 1.0]];
  return new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y * h - h / 2)), 28);
}

export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, a: number): void {
  for (let i = 0; i < (w * h) / 30; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

function normalizeGeo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g.clone();
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(name)) out.deleteAttribute(name);
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  if (!out.attributes.normal) out.computeVertexNormals();
  out.morphAttributes = {};
  out = out as THREE.BufferGeometry;
  return out;
}

/**
 * Merges the plain meshes directly under `group` into one mesh per material, keeping child
 * groups (limb pivots, hand anchors) as they are. Cuts draw calls a lot on phones.
 */
export function bake(group: THREE.Object3D, recursive = false): void {
  const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  const remove: THREE.Object3D[] = [];
  const visit = (node: THREE.Object3D, parentMatrix: THREE.Matrix4) => {
    for (const child of [...node.children]) {
      child.updateMatrix();
      const m = parentMatrix.clone().multiply(child.matrix);
      if ((child as THREE.Mesh).isMesh && child.children.length === 0 && !child.userData.keep) {
        const mm = child as THREE.Mesh;
        const mat = mm.material as THREE.Material;
        if ((mat as THREE.MeshBasicMaterial).transparent) continue;
        const g = normalizeGeo(mm.geometry);
        g.applyMatrix4(m);
        const entry = byMat.get(mat) ?? { geos: [], cast: false };
        entry.geos.push(g);
        entry.cast ||= mm.castShadow;
        byMat.set(mat, entry);
        remove.push(child);
      } else if (recursive && !child.userData.pivot && !(child as THREE.Mesh).isMesh) {
        visit(child, m);
      }
    }
  };
  visit(group, new THREE.Matrix4());
  for (const r of remove) r.parent?.remove(r);
  for (const [mat, { geos, cast }] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = mesh(merged, mat, cast);
    group.add(m);
  }
}
