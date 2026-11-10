// Draws the map as a tiny globe, for the zoomed-out space view and the minimap.
//
// The map wraps round both ways, so it can't be a true sphere's surface; the
// globe instead always puts the camera on its equator and rolls the map through
// it, both across and down. Map x maps to longitude (one lap = 360 degrees) and
// map y to latitude (one lap = 180 degrees, top to bottom of the globe), so the
// globe turns exactly the way the map pans, in every direction, and everything
// on it stays the right way up. Simple sunlight and a thin atmosphere; every
// pixel is cast back onto the sphere and looked up in a snapshot of the map.
import { hash2 } from './gfx';

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

export class Globe {
  private tex: Uint32Array | null = null;
  private tw = 0;
  private th = 0;
  private snap: HTMLCanvasElement = document.createElement('canvas');
  private small: HTMLCanvasElement = document.createElement('canvas');
  private stars: { w: number; h: number; px: Uint32Array } | null = null;
  private img: ImageData | null = null;

  // Map size in map pixels.
  mw = 1;
  mh = 1;

  get ready(): boolean {
    return this.tex !== null;
  }

  // Draw the whole map with `draw(ctx)` and keep a half-size copy as the texture.
  capture(mw: number, mh: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
    this.mw = mw;
    this.mh = mh;
    if (this.snap.width !== mw || this.snap.height !== mh) {
      this.snap.width = mw;
      this.snap.height = mh;
    }
    const c = this.snap.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#22391b';
    c.fillRect(0, 0, mw, mh);
    draw(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    const tw = Math.max(2, Math.round(mw / 2));
    const th = Math.max(2, Math.round(mh / 2));
    if (this.small.width !== tw || this.small.height !== th) {
      this.small.width = tw;
      this.small.height = th;
    }
    const s = this.small.getContext('2d', { willReadFrequently: true })!;
    s.imageSmoothingEnabled = true;
    s.imageSmoothingQuality = 'high';
    s.drawImage(this.snap, 0, 0, tw, th);
    this.tex = new Uint32Array(s.getImageData(0, 0, tw, th).data.buffer);
    this.tw = tw;
    this.th = th;
  }

  // Map position of a canvas pixel, or null if it misses the globe. x comes
  // back unwrapped, within half a world of the view's centre longitude.
  pick(v: View, px: number, py: number): { x: number; y: number } | null {
    const nx = (px - v.cx) / v.r;
    const ny = -(py - v.cy) / v.r;
    const r2 = nx * nx + ny * ny;
    if (r2 > 1) return null;
    const nz = Math.sqrt(1 - r2);
    const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
    const dl = Math.atan2(nx, nz);
    return { x: v.x + (dl / TAU) * this.mw, y: v.y - (lat / Math.PI) * this.mh };
  }

  // Canvas position of a map point, or null if it is on the far side.
  project(v: View, x: number, y: number): [number, number] | null {
    const wrap = (d: number, p: number) => d - Math.round(d / p) * p;
    const lat = (-wrap(y - v.y, this.mh) / this.mh) * Math.PI;
    const dl = (wrap(x - v.x, this.mw) / this.mw) * TAU;
    const Z = Math.cos(lat) * Math.cos(dl);
    if (Z < 0) return null;
    return [v.cx + Math.cos(lat) * Math.sin(dl) * v.r, v.cy - Math.sin(lat) * v.r];
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
    const halo = 1.09;
    const x0 = Math.max(0, Math.floor(v.cx - v.r * halo));
    const x1 = Math.min(W, Math.ceil(v.cx + v.r * halo));
    const y0 = Math.max(0, Math.floor(v.cy - v.r * halo));
    const y1 = Math.min(H, Math.ceil(v.cy + v.r * halo));
    const inv = 1 / v.r;
    const lonK = tw / TAU;
    const latK = th / Math.PI;
    const lon0 = (v.x / this.mw) * TAU;
    const row0 = (v.y / this.mh) * th; // texture row at the centre
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
            const a = (1 - d) * (1 - d) * 0.75;
            const bg = out[i];
            const br = bg & 255;
            const bgG = (bg >> 8) & 255;
            const bb = (bg >> 16) & 255;
            const r = br + (90 - br) * a;
            const g = bgG + (150 - bgG) * a;
            const b = bb + (255 - bb) * a;
            out[i] = (255 << 24) | (b << 16) | (g << 8) | r;
          }
          continue;
        }
        const nz = Math.sqrt(1 - r2);
        const lat = Math.asin(ny > 1 ? 1 : ny < -1 ? -1 : ny);
        let u = Math.floor((lon0 + Math.atan2(nx, nz)) * lonK) % tw;
        if (u < 0) u += tw;
        let t = Math.floor(row0 - lat * latK) % th;
        if (t < 0) t += th;
        const c = tex[t * tw + u];
        // sunlight, plus a blue haze towards the rim
        const lit = 0.3 + 0.85 * Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
        const rim = (1 - nz) * (1 - nz) * (1 - nz) * 0.7;
        const r = Math.min(255, (c & 255) * lit * (1 - rim) + 90 * rim);
        const g = Math.min(255, ((c >> 8) & 255) * lit * (1 - rim) + 150 * rim);
        const b = Math.min(255, ((c >> 16) & 255) * lit * (1 - rim) + 255 * rim);
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
