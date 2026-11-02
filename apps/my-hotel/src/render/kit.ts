// Small helpers for building low-poly toon models from boxes, cylinders and spheres.
import * as THREE from 'three';

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const mats = new Map<string, THREE.MeshToonMaterial>();
export function mat(color: string): THREE.MeshToonMaterial {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    mats.set(color, m);
  }
  return m;
}

export function toonMap(tex: THREE.Texture, transparent = true) {
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient, transparent });
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 18, 14);

/** A box sitting on y (its bottom), centred on x/z. */
export function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number, ry = 0) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent: THREE.Object3D, rt: number, rb: number, h: number, color: string, x: number, y: number, z: number, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function ball(parent: THREE.Object3D, r: number, color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(sphereGeo, mat(color));
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function cone(parent: THREE.Object3D, r: number, h: number, color: string, x: number, y: number, z: number, seg = 8) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A flat textured plane lying on the ground. */
export function decal(parent: THREE.Object3D, w: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export const EMOJI_FONT = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
export const UI_FONT = 'Fredoka, "Trebuchet MS", sans-serif';

/** A camera-facing label drawn on a canvas; call redraw() to change it. */
export class Label {
  readonly sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private tex: THREE.CanvasTexture;
  private key = '';
  constructor(w: number, h: number, scale: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
    this.sprite.scale.set((scale * w) / h, scale, 1);
    this.sprite.renderOrder = 10;
  }
  draw(key: string, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (key === this.key) return;
    this.key = key;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    fn(g, this.canvas.width, this.canvas.height);
    this.tex.needsUpdate = true;
  }
  dispose() {
    this.tex.dispose();
    (this.sprite.material as THREE.SpriteMaterial).dispose();
  }
}

/** Speech bubble with an emoji and an optional ring (0..1) in the corner. */
export function drawBubble(g: CanvasRenderingContext2D, icon: string, ring: number | null, ringColor: string) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(g, 26, 30, 204, 170, 50);
  g.fill();
  g.fillStyle = '#fff';
  roundRect(g, 20, 20, 204, 170, 50);
  g.fill();
  g.beginPath();
  g.moveTo(100, 186);
  g.lineTo(122, 236);
  g.lineTo(146, 186);
  g.fill();
  g.font = `110px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, 122, 112);
  if (ring !== null) {
    g.lineWidth = 14;
    g.strokeStyle = '#eee';
    g.beginPath();
    g.arc(212, 40, 26, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = ringColor;
    g.beginPath();
    g.arc(212, 40, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring);
    g.stroke();
  }
}

/** Round progress ring with an emoji in the middle. */
export function drawRing(g: CanvasRenderingContext2D, icon: string, progress: number, color: string) {
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 22;
  g.strokeStyle = '#e0e0e0';
  g.beginPath();
  g.arc(128, 128, 88, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(128, 128, 88, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, progress));
  g.stroke();
  g.font = `96px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, 128, 136);
}
