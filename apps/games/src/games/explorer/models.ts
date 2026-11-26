// Low-poly 3D models made from boxes, cones and balls: terrain decorations, machines, animals, people and cars.
import * as THREE from 'three';
import { BUILDS, CARS, MOBS, type BuildId, type CarId, type ItemId } from './data';
import type { Building } from './game';

// ---------- shared materials ----------
const mats = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: string, opts: { emissive?: string; transparent?: number } = {}) {
  const k = color + (opts.emissive ?? '') + (opts.transparent ?? '');
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? '#000000', transparent: opts.transparent !== undefined, opacity: opts.transparent ?? 1 });
    mats.set(k, m);
  }
  return m;
}
const geos = new Map<string, THREE.BufferGeometry>();
function cached(k: string, make: () => THREE.BufferGeometry) {
  let g = geos.get(k);
  if (!g) { g = make(); geos.set(k, g); }
  return g;
}
export const BOX = cached('box', () => new THREE.BoxGeometry(1, 1, 1));
const CYL = cached('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10));
const CONE = cached('cone', () => new THREE.ConeGeometry(0.5, 1, 8));
const BALL = cached('ball', () => new THREE.IcosahedronGeometry(0.5, 1));

/** A box part: size, position, color. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, parent?: THREE.Object3D, emissive?: string) {
  const m = new THREE.Mesh(BOX, mat(color, { emissive }));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
export function cyl(r: number, h: number, x: number, y: number, z: number, color: string, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(CYL, mat(color));
  m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
export function cone(r: number, h: number, x: number, y: number, z: number, color: string, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(CONE, mat(color));
  m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
export function ball(r: number, x: number, y: number, z: number, color: string, parent?: THREE.Object3D, emissive?: string) {
  const m = new THREE.Mesh(BALL, mat(color, { emissive }));
  m.scale.setScalar(r * 2);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}

// ---------- merged geometry for the land (one draw call per chunk) ----------
const tmpl = new Map<string, Float32Array>();
function template(k: string, g: () => THREE.BufferGeometry) {
  let t = tmpl.get(k);
  if (!t) {
    const geo = g().toNonIndexed();
    t = geo.getAttribute('position').array as Float32Array;
    tmpl.set(k, t);
  }
  return t;
}
export const T = {
  box: () => template('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: () => template('cyl6', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6)),
  cone: () => template('cone7', () => new THREE.ConeGeometry(0.5, 1, 7)),
  pyr: () => template('pyr', () => new THREE.ConeGeometry(0.71, 1, 4, 1).rotateY(Math.PI / 4)),
  ico: () => template('ico', () => new THREE.IcosahedronGeometry(0.5, 0)),
  dodo: () => template('dodo', () => new THREE.DodecahedronGeometry(0.5, 0)),
  // a roof: a triangle (point up, 0.75 tall, 0.866 wide) stretched along x
  prism: () => template('prism2', () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3); g.rotateY(Math.PI / 2); g.rotateZ(Math.PI / 2); return g; }),
};

export class GeoBuilder {
  pos: number[] = [];
  col: number[] = [];
  private c = new THREE.Color();
  private v = new THREE.Vector3();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  /** Adds a template shape scaled, turned and moved, in one color (with a little shading per face). */
  add(t: Float32Array, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, ry = 0, rx = 0, rz = 0) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    this.c.set(color);
    const el = this.m.elements;
    for (let i = 0; i < t.length; i += 9) {
      const shade = 0.92 + ((i / 9) % 3) * 0.04;
      for (let j = 0; j < 9; j += 3) {
        const px = t[i + j], py = t[i + j + 1], pz = t[i + j + 2];
        this.pos.push(el[0] * px + el[4] * py + el[8] * pz + el[12], el[1] * px + el[5] * py + el[9] * pz + el[13], el[2] * px + el[6] * py + el[10] * pz + el[14]);
        this.col.push(this.c.r * shade, this.c.g * shade, this.c.b * shade);
      }
    }
  }
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, r: number, g: number, b: number) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.col.push(r, g, b, r, g, b, r, g, b);
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

export const ITEM_COLOR: Record<string, string> = {
  wood: '#8a5a2b', stone: '#9a958c', coal: '#222', iron_ore: '#6f87a8', copper_ore: '#d07a3a', iron: '#cfd6de', copper: '#e08a4a', steel: '#8fa0b0',
  brick: '#b5523b', gear: '#9aa0a8', circuit: '#2fa84a', plastic: '#c070e0', fuel: '#e0b030', carbon: '#333', ice: '#bfe8ff', crystal: '#7fe0ff',
  sand: '#e0cf8a', dirt: '#7a5a3a', ammo: '#e0c040', advanced_ammo: '#d04030', rusty_rock: '#a55a33', carbon_rock: '#35363b', cryser_rock: '#7fc8ef',
  copper_cable: '#e8803a', iron_stick: '#b8c0c8', advanced_circuit: '#d03838', motor: '#5a7fb0', engine_unit: '#7a6a5a', battery: '#e0d040', robot: '#e8eef8',
  space_unit: '#e8e8f0', thruster_fuel: '#40d0a0', water: '#4aa0ff', rocket: '#d04030', bug_shell: '#5ef2c4', fur: '#c9a77a', bone: '#eee',
};
export const itemColor = (id: ItemId) => ITEM_COLOR[id] ?? '#c8c0b0';

// ---------- player-built things ----------
export function buildingModel(b: Building): THREE.Group {
  const g = new THREE.Group();
  const s = BUILDS[b.type].size;
  const c = s / 2;
  const parts: Record<string, THREE.Object3D> = {};
  switch (b.type as BuildId) {
    case 'chest':
      if (b.hub) {
        box(1, 0.9, 1, 0.5, 0.45, 0.5, '#d0d8e8', g); box(1.04, 0.12, 1.04, 0.5, 0.9, 0.5, '#4a7fd0', g);
        box(0.2, 1.4, 0.2, 0.15, 0.7, 0.15, '#9aa', g); box(0.8, 0.05, 0.5, 0.15, 1.45, 0.15, '#2a4a9a', g, '#102040');
      } else { box(0.8, 0.6, 0.6, 0.5, 0.3, 0.5, '#9a6a35', g); box(0.84, 0.1, 0.64, 0.5, 0.6, 0.5, '#6b4423', g); box(0.12, 0.14, 0.04, 0.5, 0.45, 0.82, '#e0c040', g); }
      break;
    case 'steel_chest':
      box(0.8, 0.6, 0.6, 0.5, 0.3, 0.5, '#8a96a2', g); box(0.84, 0.1, 0.64, 0.5, 0.6, 0.5, '#5a6672', g); box(0.12, 0.14, 0.04, 0.5, 0.45, 0.82, '#333', g);
      break;
    case 'lab': {
      // a round glass dome on a base, glowing while it researches
      box(1.9, 0.5, 1.9, 1, 0.25, 1, '#d8dde4', g);
      box(1.95, 0.08, 1.95, 1, 0.5, 1, '#3a4250', g);
      const dome = ball(0.7, 1, 0.75, 1, '#9fd8ff', g);
      (dome as THREE.Mesh).material = mat('#9fd8ff', { transparent: 0.55 });
      parts.glow = ball(0.3, 1, 0.85, 1, '#40ffd0', g, '#20c0a0');
      parts.spin = new THREE.Group(); parts.spin.position.set(1, 0.85, 1);
      ['#e04848', '#3fbf5a', '#3a7ae0'].forEach((c, i) => box(0.12, 0.12, 0.12, Math.sin(i * 2.09) * 0.5, 0, Math.cos(i * 2.09) * 0.5, c, parts.spin));
      g.add(parts.spin);
      break;
    }
    case 'solar_panel':
      for (const [x, z] of [[0.4, 0.4], [1.6, 0.4], [0.4, 1.6], [1.6, 1.6]]) box(0.08, 0.5, 0.08, x, 0.25, z, '#777', g);
      box(1.9, 0.08, 1.9, 1, 0.55, 1, '#1c2a4a', g).rotation.x = -0.15;
      for (let i = 0; i < 3; i++) box(1.86, 0.01, 0.02, 1, 0.6 + (i - 1) * 0.08, 0.37 + i * 0.63, '#8aa0c8', g).rotation.x = -0.15;
      break;
    case 'laser_turret': {
      box(0.8, 0.4, 0.8, 0.5, 0.2, 0.5, '#d8dde4', g);
      const head = new THREE.Group();
      head.position.set(0.5, 0.65, 0.5);
      box(0.45, 0.3, 0.5, 0, 0, 0, '#c0c8d0', head);
      box(0.12, 0.12, 0.6, 0, 0.05, 0.4, '#333', head);
      ball(0.07, 0, 0.05, 0.72, '#ff3060', head, '#ff1040');
      g.add(head);
      parts.head = head;
      break;
    }
    case 'furnace': case 'steel_furnace': case 'electric_furnace': {
      const col = b.type === 'furnace' ? '#9a958c' : b.type === 'electric_furnace' ? '#c8ccd2' : '#b5523b';
      box(0.9, 0.9, 0.9, 0.5, 0.45, 0.5, col, g);
      box(0.4, 0.3, 0.05, 0.5, 0.35, 0.96, '#222', g);
      parts.glow = box(0.32, 0.22, 0.03, 0.5, 0.35, 0.98, '#ff7a1a', g, '#ff5a00');
      box(0.25, 0.4, 0.25, 0.7, 1.1, 0.3, '#555', g);
      break;
    }
    case 'miner':
      box(0.95, 0.5, 0.95, 0.5, 0.25, 0.5, '#4a6b8a', g);
      box(0.5, 0.6, 0.5, 0.5, 0.8, 0.5, '#e0b030', g);
      parts.spin = cyl(0.12, 0.9, 0.5, 0.2, 0.5, '#888', g);
      box(0.3, 0.2, 0.2, 0.5, 0.3, 1.0, '#333', g); // chute
      break;
    case 'belt': case 'underground_belt': case 'fast_belt': case 'express_belt':
      box(1, 0.12, 0.9, 0.5, 0.06, 0.5, '#333a40', g);
      for (let i = 0; i < 3; i++) box(0.9, 0.02, 0.06, 0.5, 0.13, 0.2 + i * 0.3, b.type === 'fast_belt' ? '#d04030' : b.type === 'express_belt' ? '#3a8ae0' : '#d9a632', g);
      if (b.type === 'underground_belt') box(1, 0.5, 0.5, 0.5, 0.25, b.ug === 'out' ? 0.25 : 0.75, '#7a6a30', g);
      break;
    case 'grabber': case 'long_grabber': case 'bulk_grabber': case 'fast_grabber': {
      const col = b.type === 'grabber' ? '#e0b030' : b.type === 'long_grabber' ? '#d04040' : b.type === 'fast_grabber' ? '#40c0e0' : '#3a7ad0';
      box(0.5, 0.2, 0.5, 0.5, 0.1, 0.5, '#555', g);
      const arm = new THREE.Group();
      arm.position.set(0.5, 0.3, 0.5);
      const len = b.type === 'long_grabber' ? 1.6 : 0.9;
      box(0.12, 0.12, len, 0, 0.1, 0, col, arm);
      box(0.25, 0.08, 0.25, 0, 0.05, len / 2, '#333', arm);
      parts.hand = box(0.18, 0.18, 0.18, 0, -0.08, len / 2, '#fff', arm);
      parts.hand.visible = false;
      g.add(arm);
      parts.arm = arm;
      break;
    }
    case 'assembler':
      box(0.95, 0.8, 0.95, 0.5, 0.4, 0.5, '#7a8a9a', g);
      box(0.6, 0.1, 0.6, 0.5, 0.85, 0.5, '#555', g);
      parts.spin = box(0.5, 0.08, 0.1, 0.5, 0.95, 0.5, '#e0b030', g);
      parts.glow = box(0.3, 0.12, 0.02, 0.5, 0.5, 0.98, '#40ff80', g, '#20c050');
      break;
    case 'power_pole':
      cyl(0.07, 2.4, 0.5, 1.2, 0.5, '#8a5a2b', g); box(0.7, 0.08, 0.08, 0.5, 2.3, 0.5, '#6b4423', g);
      break;
    case 'big_power_pole':
      for (const [x, z] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) cyl(0.04, 4.5, x, 2.25, z, '#8a96a0', g);
      box(1.2, 0.1, 0.1, 0.5, 4.4, 0.5, '#8a96a0', g);
      break;
    case 'substation':
      box(0.9, 1.2, 0.9, 0.5, 0.6, 0.5, '#6a7a8a', g); box(0.3, 0.6, 0.3, 0.5, 1.5, 0.5, '#c0c8d0', g); box(0.9, 0.08, 0.08, 0.5, 1.75, 0.5, '#e0b030', g);
      break;
    case 'steam_engine':
      cyl(0.38, 0.9, 0.5, 0.45, 0.5, '#5a6a7a', g);
      box(0.95, 0.15, 0.95, 0.5, 0.07, 0.5, '#444', g);
      parts.spin = cyl(0.3, 0.12, 0.5, 0.95, 0.5, '#c0a040', g);
      box(0.12, 0.6, 0.12, 0.2, 1.2, 0.2, '#333', g);
      break;
    case 'water_pump':
      box(0.7, 0.6, 0.7, 0.5, 0.3, 0.5, '#3a7ad0', g); cyl(0.12, 0.5, 0.5, 0.85, 0.5, '#8a96a0', g);
      break;
    case 'pipe':
      box(0.3, 0.3, 1, 0.5, 0.25, 0.5, '#8a96a0', g); box(1, 0.3, 0.3, 0.5, 0.25, 0.5, '#8a96a0', g);
      break;
    case 'underground_pipe':
      box(0.5, 0.5, 0.5, 0.5, 0.25, 0.5, '#6a7680', g); box(0.3, 0.3, 0.5, 0.5, 0.25, 0.75, '#8a96a0', g);
      break;
    case 'pumpjack': {
      box(0.9, 0.2, 0.9, 0.5, 0.1, 0.5, '#444', g);
      box(0.1, 1.2, 0.1, 0.5, 0.7, 0.5, '#c03030', g);
      const beam = new THREE.Group();
      beam.position.set(0.5, 1.3, 0.5);
      box(0.14, 0.14, 1.4, 0, 0, 0, '#d04040', beam);
      box(0.25, 0.4, 0.15, 0, -0.15, 0.7, '#555', beam);
      g.add(beam);
      parts.beam = beam;
      break;
    }
    case 'oil_refinery':
      box(1.9, 0.3, 1.9, 1, 0.15, 1, '#555', g);
      cyl(0.35, 2.4, 0.5, 1.5, 0.5, '#c8c8c0', g); cyl(0.3, 1.8, 1.5, 1.2, 0.6, '#c8c8c0', g); cyl(0.12, 2.6, 1.5, 1.6, 1.5, '#888', g);
      box(0.9, 0.9, 0.7, 0.8, 0.75, 1.5, '#d04040', g);
      parts.glow = ball(0.12, 1.5, 2.95, 1.5, '#ff8a2a', g, '#ff5a00');
      break;
    case 'turret': {
      box(0.8, 0.4, 0.8, 0.5, 0.2, 0.5, '#5a6a50', g);
      const head = new THREE.Group();
      head.position.set(0.5, 0.65, 0.5);
      box(0.5, 0.35, 0.5, 0, 0, 0, '#6a7a60', head);
      box(0.1, 0.1, 0.7, 0.1, 0.05, 0.4, '#333', head); box(0.1, 0.1, 0.7, -0.1, 0.05, 0.4, '#333', head);
      g.add(head);
      parts.head = head;
      break;
    }
    case 'road':
      box(1, 0.06, 1, 0.5, 0.03, 0.5, '#4a4a4e', g); box(0.1, 0.07, 0.4, 0.5, 0.04, 0.5, '#f0d040', g);
      break;
    case 'roundabout':
      box(3, 0.06, 3, 1.5, 0.03, 1.5, '#4a4a4e', g); cyl(0.7, 0.25, 1.5, 0.12, 1.5, '#5aa04a', g); cyl(0.12, 0.8, 1.5, 0.5, 1.5, '#6b4423', g); ball(0.4, 1.5, 1, 1.5, '#3a8a3a', g);
      break;
    case 'stop_light': {
      cyl(0.05, 2.2, 0.5, 1.1, 0.5, '#333', g);
      box(0.3, 0.8, 0.25, 0.5, 2.1, 0.5, '#222', g);
      parts.red = ball(0.09, 0.5, 2.35, 0.64, '#ff2020', g, '#ff0000');
      parts.yellow = ball(0.09, 0.5, 2.1, 0.64, '#ffd020', g, '#000');
      parts.green = ball(0.09, 0.5, 1.85, 0.64, '#20ff40', g, '#000');
      break;
    }
    case 'house':
      box(3, 2, 3, 1.5, 1, 1.5, '#e8d5b7', g);
      { const r = new THREE.Mesh(CONE, mat('#a83a2c')); r.scale.set(4.4, 1.4, 4.4); r.rotation.y = Math.PI / 4; r.position.set(1.5, 2.7, 1.5); g.add(r); }
      box(0.7, 1.2, 0.05, 1.5, 0.6, 3.01, '#6b4423', g);
      box(0.6, 0.5, 0.05, 0.6, 1.3, 3.01, '#bfe0ff', g); box(0.6, 0.5, 0.05, 2.4, 1.3, 3.01, '#bfe0ff', g);
      break;
    case 'rocket_silo': {
      box(3, 0.8, 3, 1.5, 0.4, 1.5, '#8a8f98', g);
      box(2, 0.1, 2, 1.5, 0.82, 1.5, '#222', g);
      for (const [x, z] of [[0.2, 0.2], [2.8, 0.2], [0.2, 2.8], [2.8, 2.8]]) cyl(0.12, 3, x, 1.5, z, '#c0c4cc', g);
      const rocket = new THREE.Group();
      rocket.position.set(1.5, 0.9, 1.5);
      cyl(0.4, 3, 0, 1.5, 0, '#f0f0f4', rocket); cone(0.4, 1, 0, 3.5, 0, '#d03030', rocket);
      box(0.1, 0.8, 0.6, 0.4, 0.4, 0, '#d03030', rocket); box(0.1, 0.8, 0.6, -0.4, 0.4, 0, '#d03030', rocket);
      rocket.visible = false;
      g.add(rocket);
      parts.rocket = rocket;
      break;
    }
    case 'thruster':
      box(0.9, 0.4, 0.9, 0.5, 0.2, 0.5, '#5a6070', g);
      cone(0.4, 0.8, 0.5, 0.4, 1.1, '#3a3f48', g).rotation.x = -Math.PI / 2;
      parts.glow = cone(0.3, 1.2, 0.5, 0.4, 1.8, '#5ad0ff', g);
      (parts.glow as THREE.Mesh).material = mat('#5ad0ff', { emissive: '#40a0ff', transparent: 0.8 });
      parts.glow.rotation.x = Math.PI / 2;
      break;
    case 'crusher':
      box(0.95, 0.8, 0.95, 0.5, 0.4, 0.5, '#6a5a4a', g);
      parts.spin = cyl(0.3, 0.9, 0.5, 0.85, 0.5, '#999', g);
      parts.spin.rotation.z = Math.PI / 2;
      break;
    case 'asteroid_grabber': {
      box(0.6, 0.3, 0.6, 0.5, 0.15, 0.5, '#444', g);
      const arm = new THREE.Group();
      arm.position.set(0.5, 0.4, 0.5);
      box(0.15, 0.15, 1.6, 0, 0, 0.6, '#c040c0', arm);
      parts.hand = ball(0.25, 0, 0, 1.4, '#a55a33', arm);
      parts.hand.visible = false;
      g.add(arm);
      parts.arm = arm;
      break;
    }
    case 'wall':
      box(1, 1.4, 1, 0.5, 0.7, 0.5, '#8a8580', g);
      break;
    case 'campfire':
      for (let i = 0; i < 5; i++) box(0.12, 0.12, 0.6, 0.5, 0.08, 0.5, '#6b4423', g).rotation.y = (i * Math.PI) / 5;
      parts.glow = cone(0.22, 0.5, 0.5, 0.35, 0.5, '#ffa020', g);
      (parts.glow as THREE.Mesh).material = mat('#ffa020', { emissive: '#ff6000' });
      break;
    case 'torch':
      cyl(0.04, 1, 0.5, 0.5, 0.5, '#6b4423', g);
      parts.glow = ball(0.1, 0.5, 1.05, 0.5, '#ffc040', g, '#ff9000');
      break;
    case 'roboport': {
      // a 2×2 base with landing pads and an antenna
      box(2, 0.7, 2, 1, 0.35, 1, '#c9ced6', g);
      box(1.9, 0.08, 1.9, 1, 0.74, 1, '#3d4654', g);
      for (const [px, pz] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) box(0.6, 0.04, 0.6, px, 0.8, pz, '#f2c230', g);
      cyl(0.05, 1.3, 1, 1.4, 1, '#888', g);
      parts.glow = ball(0.12, 1, 2.1, 1, '#40c0ff', g, '#2090ff');
      parts.spin = new THREE.Group();
      parts.spin.position.set(1, 1.75, 1);
      box(0.9, 0.05, 0.12, 0, 0, 0, '#ddd', parts.spin);
      g.add(parts.spin);
      break;
    }
    case 'space_platform':
      break;
  }
  void c;
  g.userData.parts = parts;
  g.userData.b = b.id;
  g.traverse((o) => { o.userData.b = b.id; });
  return g;
}

// ---------- animals and people ----------
export interface Rig { root: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; extra: THREE.Object3D[]; }

function leg(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, color: string) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  box(w, h, w, 0, -h / 2, 0, color, pivot);
  parent.add(pivot);
  return pivot;
}

export function mobModel(type: string): Rig {
  const def = MOBS[type];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(def.size);
  const [c1, c2, c3] = def.colors;
  const legs: THREE.Object3D[] = [], arms: THREE.Object3D[] = [], extra: THREE.Object3D[] = [];
  switch (def.shape) {
    case 'quad': {
      const tall = type === 'camel' || type === 'deer' ? 0.65 : type === 'rabbit' || type === 'cat' ? 0.25 : 0.45;
      const long = type === 'rabbit' ? 0.5 : 0.95;
      box(0.55, 0.45, long, 0, tall + 0.22, 0, c1, body);
      const head = new THREE.Group();
      head.position.set(0, tall + 0.45, long / 2 + 0.12);
      body.add(head);
      box(0.38, 0.36, 0.38, 0, 0, 0, type === 'panda' ? c1 : c1, head);
      box(0.2, 0.14, 0.14, 0, -0.06, 0.24, type === 'panda' ? '#ddd' : c2, head);
      box(0.06, 0.06, 0.02, -0.1, 0.06, 0.2, '#111', head); box(0.06, 0.06, 0.02, 0.1, 0.06, 0.2, '#111', head);
      if (type === 'panda') { box(0.1, 0.1, 0.03, -0.1, 0.06, 0.19, '#111', head); box(0.1, 0.1, 0.03, 0.1, 0.06, 0.19, '#111', head); box(0.1, 0.1, 0.08, -0.15, 0.2, 0, '#111', head); box(0.1, 0.1, 0.08, 0.15, 0.2, 0, '#111', head); box(0.56, 0.2, 0.3, 0, tall + 0.3, 0.2, '#111', body); }
      if (type === 'lion') box(0.55, 0.55, 0.2, 0, 0, -0.1, c2, head);
      if (type === 'wolf' || type === 'snow_wolf' || type === 'dog' || type === 'cat' || type === 'tiger' || type === 'robo_dog') { box(0.08, 0.14, 0.06, -0.12, 0.22, 0, c1, head); box(0.08, 0.14, 0.06, 0.12, 0.22, 0, c1, head); }
      if (type === 'rabbit') { box(0.07, 0.3, 0.05, -0.08, 0.3, 0, c1, head); box(0.07, 0.3, 0.05, 0.08, 0.3, 0, c1, head); }
      if (type === 'deer') { box(0.04, 0.35, 0.04, -0.1, 0.32, 0, '#e0d0b0', head); box(0.04, 0.35, 0.04, 0.1, 0.32, 0, '#e0d0b0', head); box(0.2, 0.04, 0.04, -0.18, 0.4, 0, '#e0d0b0', head); box(0.2, 0.04, 0.04, 0.18, 0.4, 0, '#e0d0b0', head); }
      if (type === 'goat') { box(0.05, 0.2, 0.05, -0.1, 0.25, -0.05, '#555', head); box(0.05, 0.2, 0.05, 0.1, 0.25, -0.05, '#555', head); }
      if (type === 'cow') { box(0.3, 0.25, 0.02, 0.18, tall + 0.3, 0.1, c2, body).position.x = 0.28; box(0.2, 0.2, 0.3, -0.2, tall + 0.32, -0.2, c2, body).position.x = -0.18; }
      if (type === 'camel') box(0.35, 0.3, 0.35, 0, tall + 0.55, -0.1, c2, body);
      if (type === 'tiger') for (let i = 0; i < 4; i++) box(0.57, 0.46, 0.06, 0, tall + 0.22, -0.3 + i * 0.2, c2, body);
      if (type === 'robo_dog') box(0.1, 0.06, 0.02, 0, 0.06, 0.2, c2, head).material = mat(c2, { emissive: c2 });
      box(0.08, 0.08, 0.3, 0, tall + 0.35, -long / 2 - 0.12, type === 'panda' ? '#111' : c1, body).rotation.x = 0.6;
      for (const [x, z] of [[-0.18, long / 2 - 0.12], [0.18, long / 2 - 0.12], [-0.18, -long / 2 + 0.12], [0.18, -long / 2 + 0.12]]) legs.push(leg(body, x, tall, z, 0.14, tall, type === 'panda' ? '#111' : c1));
      extra.push(head);
      break;
    }
    case 'bug': {
      box(0.5, 0.3, 0.5, 0, 0.35, 0.3, c1, body);
      box(0.6, 0.35, 0.7, 0, 0.38, -0.3, c1, body);
      ball(0.08, -0.12, 0.45, 0.56, c2, body, c2); ball(0.08, 0.12, 0.45, 0.56, c2, body, c2);
      box(0.04, 0.04, 0.3, -0.1, 0.45, 0.65, c2, body).rotation.x = -0.5; box(0.04, 0.04, 0.3, 0.1, 0.45, 0.65, c2, body).rotation.x = -0.5;
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
        const p = new THREE.Group();
        p.position.set(s * 0.3, 0.38, 0.25 - i * 0.3);
        box(0.5, 0.06, 0.06, s * 0.25, -0.12, 0, '#222', p).rotation.z = s * -0.6;
        body.add(p);
        legs.push(p);
      }
      if (type === 'scorpion') { const t = new THREE.Group(); t.position.set(0, 0.5, -0.6); box(0.12, 0.12, 0.5, 0, 0.2, -0.1, c1, t).rotation.x = -1; ball(0.12, 0, 0.5, 0.1, c2, t); body.add(t); }
      break;
    }
    case 'alien': {
      // armored alien bug: low carapace, raised plated tail, big pincers and six tall jointed legs
      const glow = c3 ?? '#ff6a2a';
      box(0.62, 0.34, 0.6, 0, 0.5, 0.05, c1, body); // thorax
      box(0.5, 0.12, 0.5, 0, 0.71, 0.05, c1, body).rotation.x = 0.08;
      for (let i = 0; i < 3; i++) {
        // tail plates, each one bigger and higher
        const w = 0.5 + i * 0.12;
        const pl = box(w, 0.26 + i * 0.05, 0.3, 0, 0.6 + i * 0.07, -0.35 - i * 0.24, i % 2 ? c2 : c1, body);
        pl.rotation.x = -0.25 - i * 0.08;
      }
      box(0.36, 0.08, 0.5, 0, 0.62, -0.62, c2, body).rotation.x = -0.4; // soft belly showing between plates
      box(0.4, 0.28, 0.32, 0, 0.48, 0.48, c2, body); // head
      box(0.44, 0.08, 0.36, 0, 0.64, 0.46, c1, body); // head shell
      for (const sx of [-1, 1]) {
        ball(0.055, sx * 0.13, 0.55, 0.64, glow, body, glow);
        ball(0.04, sx * 0.07, 0.6, 0.65, glow, body, glow);
        // pincers that open and close
        const pin = new THREE.Group();
        pin.position.set(sx * 0.14, 0.42, 0.62);
        box(0.07, 0.07, 0.3, sx * 0.02, 0, 0.14, c1, pin).rotation.y = sx * 0.3;
        box(0.06, 0.06, 0.22, sx * -0.06, 0, 0.34, '#1a120c', pin).rotation.y = sx * -0.6;
        body.add(pin);
        arms.push(pin);
      }
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
        const lg = new THREE.Group();
        lg.position.set(sx * 0.3, 0.48, 0.25 - i * 0.28);
        lg.rotation.y = sx * (i - 1) * -0.35;
        box(0.5, 0.08, 0.08, sx * 0.22, 0.13, 0, c1, lg).rotation.z = sx * 0.55; // up to the knee
        box(0.07, 0.62, 0.07, sx * 0.55, -0.06, 0, '#1a120c', lg).rotation.z = sx * -0.3; // down to the foot
        body.add(lg);
        legs.push(lg);
      }
      for (let i = 0; i < 4; i++) cone(0.05, 0.18, (i % 2 ? 1 : -1) * 0.15, 0.82 + Math.floor(i / 2) * 0.05, -0.2 - Math.floor(i / 2) * 0.28, c2, body); // spikes
      break;
    }
    case 'bird': {
      box(0.4, 0.55, 0.35, 0, 0.45, 0, c1, body);
      box(0.3, 0.4, 0.05, 0, 0.42, 0.17, c2, body);
      box(0.3, 0.28, 0.3, 0, 0.88, 0.02, c1, body);
      box(0.1, 0.08, 0.16, 0, 0.85, 0.22, c3 ?? '#fa0', body);
      box(0.05, 0.05, 0.02, -0.08, 0.92, 0.17, '#111', body); box(0.05, 0.05, 0.02, 0.08, 0.92, 0.17, '#111', body);
      const wl = new THREE.Group(); wl.position.set(-0.22, 0.6, 0); box(0.06, 0.4, 0.3, 0, -0.15, 0, c1, wl); body.add(wl);
      const wr = new THREE.Group(); wr.position.set(0.22, 0.6, 0); box(0.06, 0.4, 0.3, 0, -0.15, 0, c1, wr); body.add(wr);
      arms.push(wl, wr);
      legs.push(leg(body, -0.1, 0.18, 0, 0.08, 0.18, c3 ?? '#fa0'), leg(body, 0.1, 0.18, 0, 0.08, 0.18, c3 ?? '#fa0'));
      break;
    }
    case 'fish': {
      box(0.5, 0.45, 1.3, 0, 0.3, 0, c1, body);
      box(0.4, 0.15, 1.1, 0, 0.1, 0, c2, body);
      box(0.08, 0.5, 0.35, 0, 0.7, -0.1, c1, body).rotation.x = -0.4;
      const tail = new THREE.Group(); tail.position.set(0, 0.3, -0.65); box(0.08, 0.5, 0.35, 0, 0, -0.15, c1, tail); body.add(tail);
      legs.push(tail);
      box(0.05, 0.05, 0.02, -0.2, 0.4, 0.6, '#111', body); box(0.05, 0.05, 0.02, 0.2, 0.4, 0.6, '#111', body);
      break;
    }
    case 'bat': {
      box(0.25, 0.3, 0.25, 0, 0, 0, c1, body);
      ball(0.04, -0.06, 0.06, 0.12, c2, body, c2); ball(0.04, 0.06, 0.06, 0.12, c2, body, c2);
      const wl = new THREE.Group(); box(0.6, 0.04, 0.3, -0.3, 0, 0, c1, wl); body.add(wl);
      const wr = new THREE.Group(); box(0.6, 0.04, 0.3, 0.3, 0, 0, c1, wr); body.add(wr);
      arms.push(wl, wr);
      break;
    }
    case 'snake': {
      for (let i = 0; i < 6; i++) { const s = box(0.18, 0.15, 0.25, 0, 0.08, 0.5 - i * 0.22, i % 2 ? c2 : c1, body); legs.push(s); }
      box(0.22, 0.16, 0.25, 0, 0.1, 0.72, c1, body);
      break;
    }
    case 'person': return personModel(c1, c2, c3 ?? '#333', type === 'cop');
  }
  return { root, legs, arms, extra };
}

export function personModel(shirt: string, skin: string, hair: string, cop = false): Rig {
  const root = new THREE.Group();
  const legs = [leg(root, -0.12, 0.8, 0, 0.18, 0.8, cop ? '#1a1f3a' : '#3a4a6a'), leg(root, 0.12, 0.8, 0, 0.18, 0.8, cop ? '#1a1f3a' : '#3a4a6a')];
  box(0.5, 0.6, 0.28, 0, 1.1, 0, shirt, root);
  const arms = [leg(root, -0.33, 1.38, 0, 0.14, 0.6, shirt), leg(root, 0.33, 1.38, 0, 0.14, 0.6, shirt)];
  box(0.36, 0.36, 0.36, 0, 1.6, 0, skin, root);
  box(0.38, 0.12, 0.38, 0, 1.8, 0, hair, root);
  box(0.06, 0.06, 0.02, -0.08, 1.63, 0.18, '#111', root); box(0.06, 0.06, 0.02, 0.08, 1.63, 0.18, '#111', root);
  if (cop) { box(0.42, 0.1, 0.46, 0, 1.86, 0.03, '#111', root); box(0.12, 0.1, 0.02, -0.12, 1.25, 0.15, '#e0c040', root); }
  const extra: THREE.Object3D[] = [];
  return { root, legs, arms, extra };
}

export function carModel(car: CarId): THREE.Group {
  const g = new THREE.Group();
  const col = CARS[car].color;
  const sporty = car === 'sports';
  box(1.6, sporty ? 0.45 : 0.6, 3, 0, 0.6, 0, col, g);
  if (car === 'buggy') { for (const [x, z] of [[-0.7, 0.6], [0.7, 0.6], [-0.7, -0.6], [0.7, -0.6]]) cyl(0.05, 0.8, x, 1.2, z, '#333', g); box(1.5, 0.06, 1.5, 0, 1.6, 0, '#333', g); }
  else if (car === 'truck') { box(1.5, 0.7, 1.3, 0, 1.25, 0.7, col, g); box(1.4, 0.5, 0.05, 0, 1.3, 1.36, '#9fd0f0', g); box(1.6, 0.3, 1.5, 0, 1.05, -0.7, '#7a3020', g); }
  else { box(1.4, sporty ? 0.45 : 0.6, sporty ? 1.3 : 1.6, 0, sporty ? 1.05 : 1.2, sporty ? -0.2 : -0.1, col, g); box(1.3, sporty ? 0.35 : 0.45, 0.05, 0, sporty ? 1.05 : 1.2, sporty ? 0.47 : 0.71, '#9fd0f0', g); }
  for (const [x, z] of [[-0.8, 0.95], [0.8, 0.95], [-0.8, -0.95], [0.8, -0.95]]) { const w = cyl(0.33, 0.25, x, 0.33, z, '#1a1a1a', g); w.rotation.z = Math.PI / 2; }
  box(0.3, 0.15, 0.05, -0.5, 0.65, 1.51, '#fff8c0', g, '#ffffa0'); box(0.3, 0.15, 0.05, 0.5, 0.65, 1.51, '#fff8c0', g, '#ffffa0');
  box(0.3, 0.12, 0.05, -0.5, 0.65, -1.51, '#f02020', g, '#a00000'); box(0.3, 0.12, 0.05, 0.5, 0.65, -1.51, '#f02020', g, '#a00000');
  return g;
}

export function rocketModel(): THREE.Group {
  const g = new THREE.Group();
  cyl(0.5, 3.5, 0, 1.75, 0, '#f0f0f4', g); cone(0.5, 1.3, 0, 4.15, 0, '#d03030', g);
  for (let i = 0; i < 4; i++) { const f = box(0.08, 1, 0.7, 0, 0.5, 0, '#d03030', g); f.position.set(Math.sin((i * Math.PI) / 2) * 0.5, 0.5, Math.cos((i * Math.PI) / 2) * 0.5); f.rotation.y = (i * Math.PI) / 2; }
  box(0.3, 0.3, 0.05, 0, 2.6, 0.5, '#6fb6ff', g);
  const flame = cone(0.4, 1.6, 0, -0.8, 0, '#ffb030', g);
  flame.rotation.x = Math.PI;
  (flame as THREE.Mesh).material = mat('#ffb030', { emissive: '#ff7000' });
  return g;
}

// ---------- flying robots ----------
export function botModel(): THREE.Group {
  const g = new THREE.Group();
  box(0.42, 0.18, 0.42, 0, 0, 0, '#e8eef8', g);
  box(0.3, 0.08, 0.3, 0, 0.12, 0, '#4a7fd0', g);
  ball(0.06, 0, -0.04, 0.22, '#40e0ff', g, '#20c0ff');
  const rotors = new THREE.Group();
  for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
    box(0.06, 0.04, 0.3, x, 0.12, z, '#333', rotors);
    box(0.3, 0.04, 0.06, x, 0.12, z, '#333', rotors);
  }
  g.add(rotors);
  const carry = box(0.2, 0.2, 0.2, 0, -0.22, 0, '#fff', g);
  g.userData = { rotors, carry };
  return g;
}

// ---------- things on belts: shaped like what they are ----------
const itemModels = new Map<ItemId, THREE.Group>();
export function itemModel(id: ItemId): THREE.Group {
  let base = itemModels.get(id);
  if (!base) {
    base = new THREE.Group();
    const c = itemColor(id);
    const g = base;
    if (/^(iron|copper|steel|plastic)$/.test(id)) { box(0.32, 0.05, 0.26, 0, 0.03, 0, c, g); box(0.32, 0.05, 0.26, 0.02, 0.08, 0.01, c, g).rotation.y = 0.15; }
    else if (/_ore$|^(coal|stone|carbon|rusty_rock|carbon_rock|cryser_rock)$/.test(id)) {
      const m = new THREE.Mesh(cached('dodo', () => new THREE.DodecahedronGeometry(0.15, 0)), mat(c)); m.position.y = 0.12; m.rotation.set(0.4, 0.7, 0.2); g.add(m);
      if (id === 'iron_ore' || id === 'copper_ore') { const s = new THREE.Mesh(BOX, mat(id === 'iron_ore' ? '#7a5a48' : '#4fbf8f')); s.scale.set(0.08, 0.08, 0.08); s.position.set(0.08, 0.2, 0.05); g.add(s); }
    } else if (id === 'gear') {
      const disc = cyl(0.13, 0.06, 0, 0.05, 0, c, g); void disc;
      for (let i = 0; i < 8; i++) { const t = box(0.06, 0.06, 0.06, Math.cos(i * 0.785) * 0.15, 0.05, Math.sin(i * 0.785) * 0.15, c, g); t.rotation.y = -i * 0.785; }
      cyl(0.04, 0.07, 0, 0.055, 0, '#333', g);
    } else if (id === 'circuit' || id === 'advanced_circuit') { box(0.3, 0.04, 0.24, 0, 0.03, 0, c, g); box(0.1, 0.04, 0.08, 0, 0.07, 0, '#1a1a1a', g); box(0.22, 0.01, 0.02, 0, 0.055, 0.08, '#f2c94c', g); }
    else if (id === 'copper_cable') { for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(cached('torus', () => new THREE.TorusGeometry(0.1, 0.025, 6, 12)), mat(c)); t.rotation.x = Math.PI / 2; t.position.set(0, 0.04 + i * 0.04, 0); g.add(t); } }
    else if (id === 'wood') { const l = cyl(0.08, 0.34, 0, 0.09, 0, '#8a5a2e', g); l.rotation.z = Math.PI / 2; }
    else if (id === 'brick') box(0.26, 0.12, 0.13, 0, 0.07, 0, c, g);
    else if (/_pack$/.test(id)) { cyl(0.1, 0.16, 0, 0.09, 0, c, g); cyl(0.04, 0.1, 0, 0.21, 0, '#dfeef5', g); }
    else if (id === 'battery') { cyl(0.08, 0.24, 0, 0.12, 0, '#2a2a2a', g); cyl(0.082, 0.06, 0, 0.21, 0, '#e0c030', g); }
    else if (id === 'iron_stick') { for (const z of [-0.05, 0.05]) { const r = cyl(0.025, 0.32, 0, 0.04, z, c, g); r.rotation.z = Math.PI / 2; } }
    else if (id === 'ice' || id === 'crystal') { const m = new THREE.Mesh(cached('octa', () => new THREE.OctahedronGeometry(0.14, 0)), mat(c, { transparent: 0.8 })); m.position.y = 0.14; g.add(m); }
    else { box(0.24, 0.2, 0.24, 0, 0.1, 0, '#a0784a', g); box(0.25, 0.04, 0.25, 0, 0.2, 0, c, g); } // anything else comes in a little crate
    itemModels.set(id, base);
  }
  return base.clone();
}
