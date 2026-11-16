// Draws the map as a tiny globe, for the zoomed-out space view and the minimap.
//
// The map wraps round both ways, so it can't be a true sphere's surface.
// Instead the globe wraps the map round itself from the point under the
// camera: each point on the globe is looked up by its distance and direction
// from the centre of the disc (an azimuthal equidistant projection), with one
// lap of the map equal to one lap of the globe. Every part of the map gets the
// same treatment wherever it is, so panning just slides the map round the
// globe without the stretching and pinching a latitude/longitude grid gives
// near its poles, and everything stays the right way up. Simple sunlight and a
// thin atmosphere; every pixel is cast back onto the sphere and looked up in a
// snapshot of the map.
import { RGB, hash2, wrapNoise } from './gfx';

const TAU = Math.PI * 2;
// Sun from the upper left and a little in front, in view space (x right, y up, z out).
const SUN = (() => {
  const v = [-0.5, 0.55, 0.68];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();

export interface View {
  cx: number; // centre of the globe on the canvas
  cy: number;
  r: number; // radius in canvas pixels
  x: number; // map point at the centre of the globe
  y: number;
}

// What the globe needs of the shroud (v2/shroud.ts).
export interface ShroudLike {
  dark(x: number, y: number): number;
  span(x0: number, y0: number, x1: number, y1: number): number;
}

export class Globe {
  private base: Uint32Array | null = null;
  private tex: Uint32Array | null = null;
  private tw = 0;
  private th = 0;
  private stars: { w: number; h: number; px: Uint32Array } | null = null;
  private img: ImageData | null = null;

  // Cloud cover over the whole map, 0..1, seamless both ways like the map.
  private clouds: Float32Array | null = null;
  private cw = 0;
  private ch = 0;
  time = 0; // seconds, for drifting clouds

  // Map size in map pixels.
  mw = 1;
  mh = 1;

  get ready(): boolean {
    return this.tex !== null;
  }

  // Forget the map (a new one is on its way).
  clear(): void {
    this.base = null;
    this.tex = null;
  }

  // The picture of the whole map (any size; it is stretched over the map).
  // With a shroud, the picture is of the map without it, and the shroud is
  // put over it here, so that as more is seen only that part is redone
  // (shade) rather than the whole picture redrawn.
  setMap(mw: number, mh: number, img: HTMLCanvasElement, shroud?: ShroudLike | null): void {
    this.mw = mw;
    this.mh = mh;
    const tw = img.width;
    const th = img.height;
    const c = img.getContext('2d', { willReadFrequently: true })!;
    this.base = new Uint32Array(c.getImageData(0, 0, tw, th).data.buffer);
    this.tw = tw;
    this.th = th;
    this.clean = shroud ? this.base.slice() : null;
    if (shroud) this.shade(shroud, 0, 0, mw, mh);
    this.tex = this.base.slice();
    const cw = Math.max(8, tw >> 2);
    const ch = Math.max(8, th >> 2);
    if (!this.clouds || this.cw !== cw || this.ch !== ch) this.makeClouds(cw, ch);
  }

  private clean: Uint32Array | null = null;

  /** Put the shroud back over map rect (x0, y0)-(x1, y1) (unwrapped) of the picture. */
  shade(shroud: ShroudLike, x0: number, y0: number, x1: number, y1: number): void {
    const { clean, base, tex, tw, th, mw, mh } = this;
    if (!clean || !base) return;
    const kx = mw / tw;
    const ky = mh / th;
    const u0 = Math.floor(x0 / kx);
    const u1 = Math.min(Math.ceil(x1 / kx), u0 + tw);
    const v0 = Math.floor(y0 / ky);
    const v1 = Math.min(Math.ceil(y1 / ky), v0 + th);
    // in blocks, most of which are all seen or all unseen
    const B = 16;
    for (let bv = v0; bv < v1; bv += B)
      for (let bu = u0; bu < u1; bu += B) {
        const eu = Math.min(bu + B, u1);
        const ev = Math.min(bv + B, v1);
        const all = shroud.span(bu * kx, bv * ky, eu * kx, ev * ky);
        for (let v = bv; v < ev; v++) {
          const row = (((v % th) + th) % th) * tw;
          for (let u = bu; u < eu; u++) {
            const i = row + (((u % tw) + tw) % tw);
            const p = clean[i];
            if (all === 0) base[i] = p;
            else if (all === 1) base[i] = 0xff000000;
            else {
              const k = 1 - shroud.dark((u + 0.5) * kx, (v + 0.5) * ky);
              base[i] = 0xff000000 | (Math.round(((p >>> 16) & 255) * k) << 16) | (Math.round(((p >>> 8) & 255) * k) << 8) | Math.round((p & 255) * k);
            }
            if (tex) tex[i] = base[i]; // (the dots go back on at the next setDots)
          }
        }
      }
  }

  // Units as 2 x 2 dots on top of the map picture.
  setDots(dots: [number, number, RGB][]): void {
    const { base, tex, tw, th, mw, mh } = this;
    if (!base || !tex) return;
    tex.set(base);
    for (const [x, y, c] of dots) {
      const u = Math.floor((x / mw) * tw);
      const v = Math.floor((y / mh) * th);
      const px = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const uu = (u + i) % tw;
          const vv = (v + j) % th;
          if (uu >= 0 && vv >= 0) tex[vv * tw + uu] = px;
        }
    }
  }

  private makeClouds(cw: number, ch: number): void {
    const N = wrapNoise(cw, ch);
    const c = new Float32Array(cw * ch);
    const seed = Math.floor(Math.random() * 1e6);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        // wispy streaks: stretched east-west, broken up by finer noise
        const n = N(x, y, cw / 10, seed, 5, ch / 8) * 0.75 + N(x, y, cw / 40, seed + 9, 3, ch / 60) * 0.25;
        const t = Math.min(1, Math.max(0, (n - 0.5) / 0.2));
        c[y * cw + x] = t * t * (3 - 2 * t);
      }
    this.clouds = c;
    this.cw = cw;
    this.ch = ch;
  }

  // Map position of a canvas pixel, or null if it misses the globe. x comes
  // back unwrapped, within half a world of the view's centre longitude.
  pick(v: View, px: number, py: number): { x: number; y: number } | null {
    const nx = (px - v.cx) / v.r;
    const ny = (py - v.cy) / v.r; // down
    const s = Math.hypot(nx, ny);
    if (s > 1) return null;
    if (s < 1e-9) return { x: v.x, y: v.y };
    const k = Math.asin(s) / s; // angle from the centre, per unit of disc radius
    return { x: v.x + nx * k * (this.mw / TAU), y: v.y + ny * k * (this.mh / Math.PI) };
  }

  // Canvas position of a map point, or null if it is on the far side.
  project(v: View, x: number, y: number): [number, number] | null {
    const wrap = (d: number, p: number) => d - Math.round(d / p) * p;
    const ax = (wrap(x - v.x, this.mw) / this.mw) * TAU;
    const ay = (wrap(y - v.y, this.mh) / this.mh) * Math.PI;
    const a = Math.hypot(ax, ay);
    if (a > Math.PI / 2) return null;
    const k = a < 1e-9 ? 1 : Math.sin(a) / a;
    return [v.cx + ax * k * v.r, v.cy + ay * k * v.r];
  }

  // Render into a canvas. With `space`, the background is a star field;
  // otherwise it is left transparent.
  draw(ctx: CanvasRenderingContext2D, v: View, space: boolean): void {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (!this.img || this.img.width !== W || this.img.height !== H) this.img = ctx.createImageData(W, H);
    const out = new Uint32Array(this.img.data.buffer);
    if (space) out.set(this.starField(W, H));
    else out.fill(0);
    const tex = this.tex;
    if (!tex) {
      ctx.putImageData(this.img, 0, 0);
      return;
    }
    const { tw, th } = this;
    const halo = 1.14;
    const clouds = this.clouds!;
    const { cw, ch } = this;
    const drift = this.time * 0.006 * cw; // clouds creep east
    const cku = cw / tw;
    const ckv = ch / th;
    const x0 = Math.max(0, Math.floor(v.cx - v.r * halo));
    const x1 = Math.min(W, Math.ceil(v.cx + v.r * halo));
    const y0 = Math.max(0, Math.floor(v.cy - v.r * halo));
    const y1 = Math.min(H, Math.ceil(v.cy + v.r * halo));
    const inv = 1 / v.r;
    // texels per radian of arc, and the texel under the centre
    const uK = tw / TAU;
    const vK = th / Math.PI;
    const u0 = (v.x / this.mw) * tw;
    const t0 = (v.y / this.mh) * th;
    for (let py = y0; py < y1; py++) {
      const ny = -(py + 0.5 - v.cy) * inv;
      for (let px = x0; px < x1; px++) {
        const nx = (px + 0.5 - v.cx) * inv;
        const r2 = nx * nx + ny * ny;
        const i = py * W + px;
        if (r2 > 1) {
          // atmosphere glow just outside the rim
          const d = (Math.sqrt(r2) - 1) / (halo - 1);
          if (d < 1) {
            const a = (1 - d) * (1 - d) * 0.85;
            const bg = out[i];
            const br = bg & 255;
            const bgG = (bg >> 8) & 255;
            const bb = (bg >> 16) & 255;
            const r = br + (110 - br) * a;
            const g = bgG + (170 - bgG) * a;
            const b = bb + (255 - bb) * a;
            out[i] = (255 << 24) | (b << 16) | (g << 8) | r;
          }
          continue;
        }
        const nz = Math.sqrt(1 - r2);
        // arc from the centre, along the pixel's direction from the centre
        const sr = Math.sqrt(r2);
        const k = sr < 1e-9 ? 1 : Math.asin(sr > 1 ? 1 : sr) / sr;
        let uf = (u0 + nx * k * uK) % tw;
        if (uf < 0) uf += tw;
        let tf = (t0 - ny * k * vK) % th;
        if (tf < 0) tf += th;
        const u = Math.min(tw - 1, uf | 0);
        const t = Math.min(th - 1, tf | 0);
        const c = tex[t * tw + u];
        const lit = 0.3 + 0.85 * Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
        let r = (c & 255) * lit;
        let g = ((c >> 8) & 255) * lit;
        let b = ((c >> 16) & 255) * lit;
        // clouds, lit by the same sun
        // clouds, smoothly interpolated (they are coarser than the ground)
        let fu = (uf * cku + drift) % cw;
        if (fu < 0) fu += cw;
        let fv = tf * ckv - 0.5;
        if (fv < 0) fv = 0;
        const cu = fu | 0;
        const cv0 = Math.min(ch - 1, fv | 0);
        const cu1 = cu + 1 >= cw ? 0 : cu + 1;
        const cv1 = cv0 + 1 >= ch ? cv0 : cv0 + 1;
        const ax = fu - cu;
        const ay = fv - cv0;
        const c0 = clouds[cv0 * cw + cu] + (clouds[cv0 * cw + cu1] - clouds[cv0 * cw + cu]) * ax;
        const c1 = clouds[cv1 * cw + cu] + (clouds[cv1 * cw + cu1] - clouds[cv1 * cw + cu]) * ax;
        const cv = (c0 + (c1 - c0) * ay) * 0.8;
        const cl = 235 * (0.35 + 0.75 * (lit - 0.3));
        r += (cl - r) * cv;
        g += (cl - g) * cv;
        b += (cl + 10 - b) * cv;
        // haze over everything, thickening towards the rim
        const rim = 0.16 + (1 - nz) * (1 - nz) * 0.75;
        r = Math.min(255, r + (125 - r) * rim);
        g = Math.min(255, g + (170 - g) * rim);
        b = Math.min(255, b + (235 - b) * rim);
        out[i] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }
    ctx.putImageData(this.img, 0, 0);
  }

  private starField(W: number, H: number): Uint32Array {
    if (this.stars && this.stars.w === W && this.stars.h === H) return this.stars.px;
    const px = new Uint32Array(W * H);
    const bg = (255 << 24) | (0x0d << 16) | (0x07 << 8) | 0x05;
    px.fill(bg);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const h = hash2(x, y, 911);
        if (h > 0.9965) {
          const b = 120 + Math.floor(hash2(x, y, 912) * 135);
          const warm = hash2(x, y, 913) > 0.7;
          const r = warm ? b : Math.floor(b * 0.85);
          const g = Math.floor(b * 0.9);
          const bl = warm ? Math.floor(b * 0.8) : b;
          px[y * W + x] = (255 << 24) | (bl << 16) | (g << 8) | r;
        }
      }
    this.stars = { w: W, h: H, px };
    return px;
  }
}
