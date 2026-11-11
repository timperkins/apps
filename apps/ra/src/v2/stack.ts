// A tiny voxel-style renderer for 2:1 isometric sprites.
//
// World axes: +x runs to the screen's lower right, +y to the lower left, +z up.
//   screen x = wx - wy,  screen y = (wx + wy) / 2 - z
// A shape is a function of local coordinates (u forward, v right, z up) that
// returns a colour or null. Each sprite pixel casts a ray down through the
// volume; the first solid sample is shaded as a top, left or right face.
import { Pix, RGB, shade } from '../gfx';

export type Shape = (u: number, v: number, z: number) => RGB | null;

export const toScreen = (wx: number, wy: number, z = 0): [number, number] => [wx - wy, (wx + wy) / 2 - z];
export const toWorld = (sx: number, sy: number, z = 0): [number, number] => [sx / 2 + sy + z, sy + z - sx / 2];

// Light comes from the upper left of the screen (from -x, slightly +y, above).
const LIGHT: [number, number, number] = [-1, 0.25, 1.1];

export interface StackOpts {
  r: number; // footprint half-size (world units) that bounds the shape at any angle
  rx?: number; // or explicit half extents for unrotated shapes
  ry?: number;
  zmax: number;
  angle?: number;
  step?: number;
  bakeShadow?: boolean;
  shadowAlpha?: number;
  outline?: RGB;
  flat?: boolean; // no outline or edge lighting (ground decals)
  top?: number;
  left?: number;
  right?: number;
  hmap?: ColumnMap;
}

export interface StackSprite {
  img: HTMLCanvasElement;
  shadow: HTMLCanvasElement | null;
  cx: number; // canvas position of the ground origin
  cy: number;
}

export function renderStack(shape: Shape, o: StackOpts): StackSprite {
  const rx = o.rx ?? o.r;
  const ry = o.ry ?? o.r;
  const zmax = o.zmax;
  const step = o.step ?? 0.5;
  const shadowReach = Math.ceil(zmax * 0.9);
  const W = Math.ceil(rx + ry) * 2 + 4 + shadowReach;
  const H = Math.ceil((rx + ry) / 2) * 2 + zmax + 4 + Math.ceil(shadowReach / 2);
  const cx = Math.ceil(rx + ry) + 2;
  const cy = zmax + 2 + Math.ceil((rx + ry) / 2);
  const a = o.angle ?? 0;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const local = (wx: number, wy: number, z: number) => shape(ca * wx + sa * wy, -sa * wx + ca * wy, z);
  const inFoot = (wx: number, wy: number) => {
    if (o.rx !== undefined) return Math.abs(wx) <= rx + 0.5 && Math.abs(wy) <= ry + 0.5;
    return wx * wx + wy * wy <= (o.r + 0.7) ** 2;
  };

  const hm = o.hmap ?? columnMap(shape, o);
  const hAt = (wx: number, wy: number) => hm.at(ca * wx + sa * wy, -sa * wx + ca * wy);

  const p = new Pix(W, H);
  const top = o.top ?? 0.06;
  const left = o.left ?? -0.1;
  const right = o.right ?? -0.32;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      for (let z = zmax; z >= 0; z -= step) {
        const wx = dx / 2 + dy + z;
        const wy = dy + z - dx / 2;
        if (z > hAt(wx, wy) + 0.6) continue;
        if (!inFoot(wx, wy)) continue;
        const c = local(wx, wy, z);
        if (!c) continue;
        let f: number;
        if (!local(wx, wy, z + step)) f = top;
        else if (!local(wx + 0.9, wy, z)) f = right;
        else f = left;
        p.set(x, y, shade(c, f));
        break;
      }
    }

  // Ground shadow: march from each ground point towards the light.
  const sh = new Pix(W, H);
  const len = Math.hypot(...LIGHT);
  const L = LIGHT.map((v) => v / len);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5 - cx) / 2 + (y + 0.5 - cy);
      const gy = y + 0.5 - cy - (x + 0.5 - cx) / 2;
      let hit = false;
      for (let t = 0.6; t * L[2] <= zmax; t += 0.7) {
        if (hAt(gx + L[0] * t, gy + L[1] * t) >= L[2] * t) {
          hit = true;
          break;
        }
      }
      if (hit) sh.set(x, y, [0, 0, 0], Math.round(255 * (o.shadowAlpha ?? 0.34)));
    }

  if (!o.flat) p.finish(o.outline ?? [18, 20, 16], 0.12, -0.18);
  let img: HTMLCanvasElement;
  if (o.bakeShadow) {
    // shadow underneath, sprite on top
    const out = sh.canvas();
    out.getContext('2d')!.drawImage(p.canvas(), 0, 0);
    img = out;
  } else img = p.canvas();
  return { img, shadow: o.bakeShadow ? null : sh.canvas(), cx, cy };
}

// Headings are rendered lazily, the first time each one is drawn, so the game
// starts quickly; a unit turning to a new heading costs a few milliseconds once.
export function renderDirs(shape: Shape, dirs: number, o: StackOpts): StackSprite[] {
  let hmap: ColumnMap | undefined;
  const cache: (StackSprite | undefined)[] = new Array(dirs);
  return new Proxy(cache as StackSprite[], {
    get(target, prop, recv) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const d = Number(prop);
        let spr = target[d];
        if (!spr) {
          hmap ??= columnMap(shape, o);
          spr = target[d] = renderStack(shape, { ...o, hmap, angle: (d / dirs) * Math.PI * 2 });
        }
        return spr;
      }
      return Reflect.get(target, prop, recv);
    },
  });
}

export interface ColumnMap {
  at(u: number, v: number): number;
}

// Top height of each column of the shape in local coordinates, on a half-unit
// grid dilated by one cell. Lets the ray caster skip empty air and makes
// shadow marching cheap. Computed once per shape and shared by all headings.
export function columnMap(shape: Shape, o: StackOpts): ColumnMap {
  const R = Math.max(o.rx ?? o.r, o.ry ?? o.r) + 1;
  const res = 0.5;
  const step = o.step ?? 0.5;
  const n = Math.ceil((2 * R) / res) + 1;
  const raw = new Float32Array(n * n).fill(-1);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = i * res - R;
      const v = j * res - R;
      for (let z = o.zmax; z >= 0; z -= step)
        if (shape(u, v, z)) {
          raw[j * n + i] = z;
          break;
        }
    }
  const hmap = new Float32Array(n * n).fill(-1);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let m = -1;
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          const ii = i + a;
          const jj = j + b;
          if (ii >= 0 && jj >= 0 && ii < n && jj < n) m = Math.max(m, raw[jj * n + ii]);
        }
      hmap[j * n + i] = m;
    }
  return {
    at(u: number, v: number) {
      const i = Math.round((u + R) / res);
      const j = Math.round((v + R) / res);
      if (i < 0 || j < 0 || i >= n || j >= n) return -1;
      return hmap[j * n + i];
    },
  };
}

// Helpers for building shapes
export const inBox = (u: number, v: number, z: number, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  u >= x0 && u <= x1 && v >= y0 && v <= y1 && z >= z0 && z <= z1;
