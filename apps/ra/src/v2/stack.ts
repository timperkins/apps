// A tiny voxel-style renderer for 2:1 isometric sprites.
//
// World axes: +x runs to the screen's lower right, +y to the lower left, +z up.
//   screen x = wx - wy,  screen y = (wx + wy) / 2 - z
// A shape is a function of local coordinates (u forward, v right, z up) that
// returns a color or null. Each sprite pixel casts a ray down through the
// volume; the first solid sample is shaded as a top, left or right face.
import { ART, Pix, RGB, shade } from '../gfx';

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
  // drawn this many times bigger than in the game, with that much more detail
  // (the build menu's close-up pictures)
  scale?: number;
  noGroundShadow?: boolean;
}

export interface StackSprite {
  img: HTMLCanvasElement;
  shadow: HTMLCanvasElement | null;
  cx: number; // where the ground origin is in the picture, in map pixels
  cy: number;
  w: number; // size in map pixels (the picture itself is ART times that)
  h: number;
}

// Draw a sprite with its ground origin at (x, y), in map pixels.
export function drawSprite(c: CanvasRenderingContext2D, img: HTMLCanvasElement, spr: StackSprite, x: number, y: number): void {
  c.drawImage(img, Math.round((x - spr.cx) * ART) / ART, Math.round((y - spr.cy) * ART) / ART, spr.w, spr.h);
}

// Part of a sprite, from the bottom up: the lowest share k of its rows.
function drawFromBottom(c: CanvasRenderingContext2D, spr: StackSprite, x: number, y: number, k: number): void {
  const W = spr.img.width;
  const H = spr.img.height;
  const top = Math.round(H * (1 - Math.min(1, k)));
  if (H - top <= 0) return;
  const x0 = Math.round((x - spr.cx) * ART) / ART;
  const y0 = Math.round((y - spr.cy) * ART) / ART;
  c.drawImage(spr.img, 0, top, W, H - top, x0, y0 + top / ART, spr.w, (H - top) / ART);
}

/** How much of going up (0..1) the footing takes before the walls start. */
export const FOOTING = 0.12;

/**
 * A building going up (rise 0..1) with its ground origin at (x, y): the
 * footing is laid, then each stage of it (sprites.ts, makeConstruction) is
 * built over the last from the bottom up, the last giving way to the finished
 * building. Without the stages it is just revealed from the ground up.
 */
export function drawGoingUp(c: CanvasRenderingContext2D, stages: StackSprite[] | null, full: StackSprite, rise: number, x: number, y: number): void {
  if (!stages?.length) return drawFromBottom(c, full, x, y, rise);
  if (rise < FOOTING) return drawFromBottom(c, stages[0], x, y, rise / FOOTING);
  const s = ((rise - FOOTING) / (1 - FOOTING)) * stages.length;
  const k = Math.min(stages.length - 1, Math.floor(s));
  drawSprite(c, stages[k].img, stages[k], x, y);
  drawFromBottom(c, k + 1 < stages.length ? stages[k + 1] : full, x, y, s - k);
}

export function renderStack(shape: Shape, o: StackOpts): StackSprite {
  const rx = o.rx ?? o.r;
  const ry = o.ry ?? o.r;
  const zmax = o.zmax;
  const scale = o.scale ?? 1;
  const step = (o.step ?? 0.5) / Math.max(1, scale);
  const shadowReach = o.noGroundShadow ? 0 : Math.ceil(zmax * 0.9);
  const D = ART * scale;
  const lw = Math.ceil(rx + ry) * 2 + 4 + shadowReach;
  const lh = Math.ceil((rx + ry) / 2) * 2 + zmax + 4 + Math.ceil(shadowReach / 2);
  const W = Math.ceil(lw * D);
  const H = Math.ceil(lh * D);
  const cx = Math.round((Math.ceil(rx + ry) + 2) * D);
  const cy = Math.round((zmax + 2 + Math.ceil((rx + ry) / 2)) * D);
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
  const len = Math.hypot(...LIGHT);
  const L = LIGHT.map((v) => v / len);
  const solid = (wx: number, wy: number, z: number) => (z < 0 ? 1 : z <= hAt(wx, wy) + 0.6 && local(wx, wy, z) ? 1 : 0);
  // Is the light blocked on its way to this point of the shape (or the ground)?
  const shadowed = (wx: number, wy: number, z: number) => {
    for (let t = 0.9; z + L[2] * t <= zmax + 0.5; t += 0.7) {
      const x = wx + L[0] * t;
      const y = wy + L[1] * t;
      const zz = z + L[2] * t;
      if (hAt(x, y) + 0.3 >= zz && local(x, y, zz)) return true;
    }
    return false;
  };
  // How far up the view ray each pixel's surface is, for the edge lines.
  const depth = new Float32Array(W * H).fill(-99);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / D;
      const dy = (y + 0.5 - cy) / D;
      for (let z = zmax; z >= 0; z -= step) {
        const wx = dx / 2 + dy + z;
        const wy = dy + z - dx / 2;
        if (z > hAt(wx, wy) + 0.6) continue;
        if (!inFoot(wx, wy)) continue;
        const c = local(wx, wy, z);
        if (!c) continue;
        depth[y * W + x] = z;
        if (o.flat) {
          p.set(x, y, shade(c, top));
          break;
        }
        // The surface normal, from which of the neighboring cells are solid:
        // flat faces come out as one of three tones, round ones in bands.
        let nx = solid(wx - 0.7, wy, z) - solid(wx + 0.7, wy, z);
        let ny = solid(wx, wy - 0.7, z) - solid(wx, wy + 0.7, z);
        let nz = solid(wx, wy, z - 0.7) - solid(wx, wy, z + 0.7);
        let f: number;
        if (!nx && !ny && !nz) {
          // too thin to tell (masts, barrels, rails)
          if (!local(wx, wy, z + step)) f = top;
          else if (!local(wx + 0.9, wy, z)) f = right;
          else f = left;
        } else {
          if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) > 1) {
            nx += (solid(wx - 1.5, wy, z) - solid(wx + 1.5, wy, z)) * 0.6;
            ny += (solid(wx, wy - 1.5, z) - solid(wx, wy + 1.5, z)) * 0.6;
            nz += (solid(wx, wy, z - 1.5) - solid(wx, wy, z + 1.5)) * 0.6;
          }
          const nl = Math.hypot(nx, ny, nz) || 1;
          const d = (nx * L[0] + ny * L[1] + nz * L[2]) / nl;
          // -0.66 is a face turned from the light, 0.16 one side on, 0.72 a top
          if (d < 0.16) f = right + ((Math.max(d, -0.66) + 0.66) / 0.82) * (left - right);
          else if (d < 0.72) f = left + ((d - 0.16) / 0.56) * (top - left);
          else f = top + ((d - 0.72) / 0.28) * 0.12;
          f = Math.round(f * 20) / 20;
          if (d > 0.1 && shadowed(wx + (nx / nl) * 0.8, wy + (ny / nl) * 0.8, z + (nz / nl) * 0.8)) f -= 0.17;
        }
        // tucked in against something taller: a little darker
        let ao = 0;
        const az = z + 1.6;
        if (solid(wx - 1.6, wy, az)) ao++;
        if (solid(wx + 1.6, wy, az)) ao++;
        if (solid(wx, wy - 1.6, az)) ao++;
        if (solid(wx, wy + 1.6, az)) ao++;
        f -= ao * 0.045;
        if (z < 1 && nz <= 0) f -= 0.08; // where it meets the ground
        p.set(x, y, shade(c, f));
        break;
      }
    }
  // Edge lines inside the sprite: a part standing in front of another gets a
  // lit rim along its top and the part behind a dark line under it.
  if (!o.flat) {
    const src = p.data.slice();
    const E = 1.2 + 1 / D;
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const q = y * W + x;
        const z = depth[q];
        if (z < -50) continue;
        const up = depth[q - W];
        const lf = depth[q - 1];
        const rt = depth[q + 1];
        const dn = depth[q + W];
        let f = 0;
        if ((up > z + E && up > -50) || (lf > z + E && lf > -50) || (rt > z + E && rt > -50) || dn > z + E + 1) f = -0.2;
        else if (up > -50 && up < z - E - 1) f = 0.1;
        if (f) {
          const i = q * 4;
          p.set(x, y, shade([src[i], src[i + 1], src[i + 2]], f));
        }
      }
  }

  // Ground shadow: march from each ground point towards the light.
  const sh = new Pix(W, H);
  for (let y = 0; y < H && !o.noGroundShadow; y++)
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5 - cx) / D / 2 + (y + 0.5 - cy) / D;
      const gy = (y + 0.5 - cy) / D - (x + 0.5 - cx) / D / 2;
      if (shadowed(gx, gy, 0)) sh.set(x, y, [0, 0, 0], Math.round(255 * (o.shadowAlpha ?? 0.34)));
    }

  if (!o.flat) p.finish(o.outline ?? [18, 20, 16], 0.12, -0.18);
  let img: HTMLCanvasElement;
  if (o.bakeShadow) {
    // shadow underneath, sprite on top
    const out = sh.canvas();
    out.getContext('2d')!.drawImage(p.canvas(), 0, 0);
    img = out;
  } else img = p.canvas();
  return { img, shadow: o.bakeShadow ? null : sh.canvas(), cx: cx / D, cy: cy / D, w: W / D, h: H / D };
}

// Headings are rendered lazily, the first time each one is drawn, so the game
// starts quickly. Rendering one takes a few milliseconds, which in a frame is
// a stutter, so where it can the game has them rendered off the main thread
// instead (src/v2/art-pool.ts sets `remote`): a heading that isn't ready yet
// is asked for there and the nearest one that is ready stands in for it for
// the frame or two that takes. Only when none is ready is it drawn here.
export interface Remote {
  want(key: string, d: number, urgent: boolean): void;
}
let remote: Remote | null = null;
export function setRemote(r: Remote | null): void {
  remote = r;
}

interface DirSet {
  key: string;
  dirs: number;
  cache: (StackSprite | undefined)[];
}
const sets = new Map<string, DirSet>();
const setOf = new WeakMap<object, DirSet>();

/** A heading rendered elsewhere has arrived. */
export function deliver(key: string, d: number, spr: StackSprite): void {
  const s = sets.get(key);
  if (s && !s.cache[d]) s.cache[d] = spr;
}

/** The key and size of a set of headings made by renderDirs (if it has a key). */
export function dirSet(arr: StackSprite[]): { key: string; dirs: number; ready: (d: number) => boolean } | null {
  const s = setOf.get(arr);
  return s ? { key: s.key, dirs: s.dirs, ready: (d) => !!s.cache[d] } : null;
}

// `key` names the set so a worker can make the same one (see art-worker.ts).
export function renderDirs(shape: Shape, dirs: number, o: StackOpts, key?: string): StackSprite[] {
  let hmap: ColumnMap | undefined;
  const cache: (StackSprite | undefined)[] = new Array(dirs);
  const now = (d: number): StackSprite => {
    hmap ??= columnMap(shape, o);
    return (cache[d] = renderStack(shape, { ...o, hmap, angle: (d / dirs) * Math.PI * 2 }));
  };
  const proxy = new Proxy(cache as StackSprite[], {
    get(target, prop, recv) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const d = Number(prop);
        const spr = target[d];
        if (spr) return spr;
        if (remote && key) {
          remote.want(key, d, true);
          for (let k = 1; k <= dirs >> 1; k++) {
            const n = target[(d + k) % dirs] ?? target[(d - k + dirs) % dirs];
            if (n) return n;
          }
        }
        return now(d);
      }
      return Reflect.get(target, prop, recv);
    },
  });
  if (key) {
    const s = { key, dirs, cache };
    sets.set(key, s);
    setOf.set(proxy, s);
  }
  return proxy;
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
