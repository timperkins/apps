// Draws the world in 3D with three.js: the land in 32×32 chunks around you (it wraps, so positions are
// measured from you), villages, machines, animals, players and cars, caves, the space ship and effects.
import * as THREE from 'three';
import { BUILDS, CHUNK, DESTINATIONS, MOBS, ROCK_COLOR, WATER_LEVEL, type Biome } from './data';
import type { Building, Dim, Fx, Game, Mob, Player, Target, Vehicle } from './game';
import { DIRS } from './game';
import { GeoBuilder, T, ball, box, buildingModel, carModel, itemColor, mat, mobModel, personModel, rocketModel, type Rig } from './models';
import { CAVE_SIZE, key, wd, wrap, type Feature } from './world';

const VIEW = 5; // chunks each way
const ORE_COLOR: Record<string, string> = { iron_ore: '#6f87a8', copper_ore: '#d07a3a', coal: '#262626', stone: '#b0a898' };
const BIOME_COLOR: Record<Biome, [string, string]> = {
  ocean: ['#c9b98a', '#a89a70'], beach: ['#e8d9a0', '#d9c98a'], plains: ['#6db04a', '#5ea040'], forest: ['#3f8a35', '#367a2e'],
  desert: ['#e3c97a', '#d6b866'], snow: ['#f2f6fa', '#e2eaf2'], pole: ['#e8f4ff', '#cfe6f8'], mountain: ['#8a8a80', '#7a7a72'],
};

interface Chunk { cx: number; cz: number; group: THREE.Group; terrain: THREE.Mesh; feats: THREE.Mesh | null; water: THREE.Mesh | null; }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; size: number; grav: number; dim: Dim; }

export class Renderer {
  r: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam: THREE.PerspectiveCamera;
  camYaw = Math.PI;
  camPitch = 0.45;
  camDist = 9;
  ox = 0; oz = 0; // world point at the scene's origin (the player)
  private hemi = new THREE.HemisphereLight('#cfe8ff', '#5a4a30', 1.1);
  private sun = new THREE.DirectionalLight('#fff4dc', 1.6);
  private lamp = new THREE.PointLight('#ffd9a0', 0, 28, 1.2);
  private lights: THREE.PointLight[] = [];
  private stars: THREE.Points;
  private chunks = new Map<string, Chunk>();
  private dirtyChunks = new Set<string>();
  private earth = new THREE.Group();
  private cave = new THREE.Group();
  private space = new THREE.Group();
  private caveId = '';
  private caveMesh: THREE.Mesh | null = null;
  private platformMesh: THREE.Mesh | null = null;
  private platformKey = '';
  private planet: THREE.Mesh;
  private streaks: THREE.LineSegments;
  private bObjs = new Map<number, THREE.Group>();
  private mObjs = new Map<number, Rig>();
  private pObjs = new Map<number, Rig & { label: THREE.Sprite; held: THREE.Group; heldId: string }>();
  private cObjs = new Map<number, THREE.Group>();
  private rObjs = new Map<number, THREE.Mesh>();
  private sObjs = new Map<number, THREE.Mesh>();
  private signs = new Map<string, THREE.Sprite[]>();
  private parts: Particle[] = [];
  private pMesh: THREE.InstancedMesh;
  private tracers: { line: THREE.Line; life: number }[] = [];
  private booms: { mesh: THREE.Mesh; life: number; r: number }[] = [];
  private launches: { obj: THREE.Group; t: number; x: number; z: number }[] = [];
  ghost: THREE.Mesh;
  private hl: THREE.Mesh;
  private ray = new THREE.Raycaster();
  dimShown: Dim = '';
  private mineBar: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.cam = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.lamp, this.earth, this.cave, this.space);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ffb050', 0, 14, 1.6); this.lights.push(l); this.scene.add(l); }
    this.scene.fog = new THREE.Fog('#9fd0ff', 60, VIEW * CHUNK - 8);
    // stars
    const sg = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1);
      sp.push(Math.sin(b) * Math.cos(a) * 300, Math.abs(Math.cos(b)) * 300 * (Math.random() < 0.5 ? 1 : -1), Math.sin(b) * Math.sin(a) * 300);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    this.scene.add(this.stars);
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshLambertMaterial({ color: '#3f7fd9', fog: false }));
    this.planet.position.set(50, -70, 140);
    this.space.add(this.planet);
    const lg = new THREE.BufferGeometry();
    const lp: number[] = [];
    for (let i = 0; i < 200; i++) { const x = (Math.random() - 0.5) * 120, y = (Math.random() - 0.5) * 60 - 5, z = (Math.random() - 0.5) * 160; lp.push(x, y, z, x, y, z + 4); }
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#aac8ff', transparent: true, opacity: 0.5, fog: false }));
    this.space.add(this.streaks);
    this.pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 600);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
    this.pMesh.frustumCulled = false;
    this.scene.add(this.pMesh);
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#40ff60', transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.hl = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.6 }));
    this.hl.visible = false;
    this.scene.add(this.hl);
    this.mineBar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ color: '#7dff6a', depthTest: false }));
    this.mineBar.renderOrder = 10;
    this.mineBar.visible = false;
    this.scene.add(this.mineBar);
  }

  resize(w: number, h: number) {
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }
  /** Scene position of a world point. */
  sx(x: number, dim: Dim) { return dim === 'earth' ? wd(x, this.ox) : x - this.ox; }
  sz(z: number, dim: Dim) { return dim === 'earth' ? wd(z, this.oz) : z - this.oz; }

  markChunk(x: number, z: number) {
    const cx = Math.floor(wrap(x) / CHUNK), cz = Math.floor(wrap(z) / CHUNK);
    this.dirtyChunks.add(key(cx, cz));
    // corners on the edge touch the next chunk too
    const lx = wrap(x) - cx * CHUNK, lz = wrap(z) - cz * CHUNK;
    if (lx <= 1) this.dirtyChunks.add(key(cx - 1, cz));
    if (lz <= 1) this.dirtyChunks.add(key(cx, cz - 1));
    if (lx >= CHUNK - 1) this.dirtyChunks.add(key(cx + 1, cz));
    if (lz >= CHUNK - 1) this.dirtyChunks.add(key(cx, cz + 1));
  }
  markCave() { this.caveId = ''; }

  // ---------- land ----------
  private buildChunk(g: Game, cx: number, cz: number): Chunk {
    const w = g.w;
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const N = CHUNK + 1;
    const h = new Float32Array(N * N);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) h[z * N + x] = w.cornerHeight(x0 + x, z0 + z);
    const tb = new GeoBuilder();
    const c = new THREE.Color(), c2 = new THREE.Color();
    let anyWater = false;
    for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const a = h[z * N + x], b = h[z * N + x + 1], cc = h[(z + 1) * N + x], d = h[(z + 1) * N + x + 1];
      const tx = x0 + x, tz = z0 + z;
      const bi = w.baseBiome(tx, tz);
      const top = Math.max(a, b, cc, d), low = Math.min(a, b, cc, d);
      const slope = top - low;
      const avg = (a + b + cc + d) / 4;
      if (low < WATER_LEVEL) anyWater = true;
      let col: string;
      const alt = (tx + tz) & 1;
      if (w.isRoad(tx, tz)) col = (wrap(tx) % 6 < 3 && w.isRoad(tx, tz + 1) && w.isRoad(tx, tz - 1) && w.isRoad(tx + 3, tz) && w.isRoad(tx - 3, tz)) ? '#55555a' : '#4a4a4e';
      else if (w.villageAt(tx, tz)) col = alt ? '#7cc35b' : '#74b954';
      else if (slope > 1.6) col = alt ? '#8a8378' : '#7f786e';
      else if (avg < WATER_LEVEL - 0.3 && bi !== 'pole') col = avg < -4 ? '#3a6a8a' : '#c9b98a';
      else if (avg > 30 && bi !== 'desert') col = '#f4f8fb';
      else col = BIOME_COLOR[bi][alt];
      c.set(col);
      // tiny brightness wobble so the ground isn't flat-looking
      const j = 0.94 + ((Math.sin(tx * 12.9898 + tz * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.1;
      c2.copy(c).multiplyScalar(j);
      tb.tri(x, a, z, x, cc, z + 1, x + 1, b, z, c2.r, c2.g, c2.b);
      c2.copy(c).multiplyScalar(j * 0.95);
      tb.tri(x + 1, b, z, x, cc, z + 1, x + 1, d, z + 1, c2.r, c2.g, c2.b);
    }
    const terrain = new THREE.Mesh(tb.build(), mat('#ffffff'));
    (terrain.material as THREE.MeshLambertMaterial).vertexColors = true;
    terrain.material = TERRAIN_MAT;
    terrain.userData.terrain = true;
    const group = new THREE.Group();
    group.add(terrain);
    // trees, rocks, ore, nests, caves, village houses
    const fb = new GeoBuilder();
    for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
      const f = w.feature(x0 + x, z0 + z);
      if (f) this.addFeature(fb, f, x + 0.5, h[z * N + x] * 0.25 + h[z * N + x + 1] * 0.25 + h[(z + 1) * N + x] * 0.25 + h[(z + 1) * N + x + 1] * 0.25, z + 0.5, x0 + x, z0 + z);
    }
    for (const v of w.villagesNear(x0 + 16, z0 + 16)) {
      for (const b of v.buildings) {
        const lx = wd(b.x, x0), lz = wd(b.z, z0);
        if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK) continue;
        this.addVillageBuilding(fb, b, lx, v.y, lz, g.owned.has(b.id) ? g.owned.get(b.id)!.slot : -1);
      }
      // street lamps along the main street
      for (let i = -36; i <= 36; i += 12) for (const s of [-2, 2]) {
        const lx = wd(v.x + i, x0), lz = wd(v.z + s, z0);
        if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK) continue;
        fb.add(T.cyl(), lx + 0.5, v.y + 1.4, lz + 0.5, 0.1, 2.8, 0.1, '#333');
        fb.add(T.box(), lx + 0.5, v.y + 2.85, lz + 0.5, 0.35, 0.2, 0.35, '#fff3b0');
      }
    }
    let feats: THREE.Mesh | null = null;
    if (fb.pos.length) {
      feats = new THREE.Mesh(fb.build(), TERRAIN_MAT);
      feats.userData.feats = true;
      group.add(feats);
    }
    let water: THREE.Mesh | null = null;
    if (anyWater && w.latitude(z0 + 16) > 1300) {
      water = new THREE.Mesh(WATER_GEO, WATER_MAT);
      water.position.set(CHUNK / 2, WATER_LEVEL - 0.12, CHUNK / 2);
      group.add(water);
    }
    this.earth.add(group);
    return { cx, cz, group, terrain, feats, water };
  }

  private addFeature(fb: GeoBuilder, f: Feature, x: number, y: number, z: number, tx: number, tz: number) {
    const v = f.v;
    const r = (n: number) => ((Math.sin((tx + n) * 91.7 + tz * 47.3) * 9631.1) % 1 + 1) % 1;
    switch (f.kind) {
      case 'tree': {
        const s = 0.8 + v * 0.6;
        fb.add(T.cyl(), x, y + 0.8 * s, z, 0.25 * s, 1.6 * s, 0.25 * s, '#7a5230');
        const leaf = v < 0.33 ? '#3d8b37' : v < 0.66 ? '#4c9a3a' : '#2f7d31';
        fb.add(T.ico(), x, y + 2.1 * s, z, 1.9 * s, 1.7 * s, 1.9 * s, leaf, v * 6);
        fb.add(T.ico(), x + 0.4 * s, y + 2.6 * s, z - 0.2 * s, 1.2 * s, 1.1 * s, 1.2 * s, leaf, v * 3);
        if (v > 0.7) fb.add(T.ico(), x + 0.6 * s, y + 1.9 * s, z + 0.6 * s, 0.18, 0.18, 0.18, '#d02020');
        break;
      }
      case 'pine': case 'snowtree': {
        const s = 0.9 + v * 0.7;
        fb.add(T.cyl(), x, y + 0.5 * s, z, 0.22 * s, 1 * s, 0.22 * s, '#6b4423');
        const g = f.kind === 'snowtree' ? '#2f5f45' : '#245c3a';
        for (let i = 0; i < 3; i++) {
          fb.add(T.cone(), x, y + (1.3 + i * 0.75) * s, z, (1.9 - i * 0.5) * s, 1.3 * s, (1.9 - i * 0.5) * s, g, v * 5 + i);
          if (f.kind === 'snowtree') fb.add(T.cone(), x, y + (1.55 + i * 0.75) * s, z, (1.2 - i * 0.35) * s, 0.8 * s, (1.2 - i * 0.35) * s, '#f4f8fb', v * 5 + i);
        }
        break;
      }
      case 'palm': {
        for (let i = 0; i < 5; i++) fb.add(T.cyl(), x + i * 0.12, y + 0.45 + i * 0.85, z, 0.22, 0.9, 0.22, '#9a7a4a', 0, 0, -0.14);
        for (let i = 0; i < 6; i++) fb.add(T.box(), x + 0.6 + Math.cos(i) * 0.9, y + 4.3, z + Math.sin(i) * 0.9, 1.8, 0.08, 0.45, '#3a9a3a', -i, 0, 0.35);
        fb.add(T.ico(), x + 0.6, y + 4.15, z, 0.3, 0.3, 0.3, '#6b4423');
        break;
      }
      case 'cactus':
        fb.add(T.cyl(), x, y + 1.1, z, 0.45, 2.2, 0.45, '#4a8a3a');
        fb.add(T.cyl(), x + 0.4, y + 1.3, z, 0.25, 0.8, 0.25, '#4a8a3a');
        fb.add(T.cyl(), x - 0.4, y + 1.6, z, 0.25, 0.7, 0.25, '#4a8a3a');
        break;
      case 'rock': {
        const s = 0.7 + v * 0.8;
        fb.add(T.dodo(), x, y + 0.3 * s, z, 1.3 * s, 0.9 * s, 1.1 * s, v > 0.8 ? '#6a6460' : '#8f8a82', v * 7, v, 0);
        if (v > 0.5) fb.add(T.dodo(), x + 0.5, y + 0.15, z + 0.3, 0.6, 0.5, 0.5, '#9a958c', v * 3);
        break;
      }
      case 'ore': {
        const col = ORE_COLOR[f.ore!] ?? '#999';
        const amt = Math.min(1, (f.amount ?? 500) / 900);
        const n = 1 + Math.round(amt * 3);
        for (let i = 0; i < n; i++) fb.add(T.dodo(), x + (r(i) - 0.5) * 0.7, y + 0.12, z + (r(i + 7) - 0.5) * 0.7, 0.35 + amt * 0.25, 0.28 + amt * 0.2, 0.35 + amt * 0.25, i % 2 ? col : f.ore === 'coal' ? '#3a3a3a' : '#8a857c', r(i + 3) * 6);
        break;
      }
      case 'oil':
        fb.add(T.cyl(), x, y + 0.03, z, 1.4, 0.06, 1.1, '#111114');
        fb.add(T.cyl(), x + 0.3, y + 0.05, z - 0.2, 0.5, 0.06, 0.4, '#2a2040');
        break;
      case 'nest':
        fb.add(T.ico(), x, y + 0.4, z, 2.2, 1.3, 2.2, '#5b2a7a', v * 3);
        fb.add(T.ico(), x, y + 0.9, z, 1.2, 0.9, 1.2, '#7a3a9a', v * 2);
        for (let i = 0; i < 5; i++) fb.add(T.cone(), x + Math.cos(i * 1.3) * 0.8, y + 0.9, z + Math.sin(i * 1.3) * 0.8, 0.2, 0.9, 0.2, '#5ef2c4', 0, Math.cos(i * 1.3) * 0.5, -Math.sin(i * 1.3) * 0.5);
        fb.add(T.box(), x, y + 0.5, z + 0.95, 0.6, 0.45, 0.2, '#14081c');
        break;
      case 'cave':
        fb.add(T.dodo(), x, y + 0.9, z - 0.2, 3.4, 2.6, 2.6, '#7a7468', v * 3);
        fb.add(T.box(), x, y + 0.65, z + 0.95, 1.3, 1.3, 0.3, '#0a0806');
        fb.add(T.dodo(), x - 1.3, y + 0.3, z + 0.6, 1, 0.8, 1, '#8a8478');
        break;
      case 'shaft':
        fb.add(T.box(), x, y + 0.05, z, 1.4, 0.1, 1.4, '#120c08');
        for (const [ox, oz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) fb.add(T.box(), x + ox, y + 1.5, z + oz, 0.18, 3, 0.18, '#7a5230');
        fb.add(T.box(), x, y + 3, z - 0.75, 1.7, 0.18, 0.18, '#7a5230');
        fb.add(T.box(), x, y + 3, z + 0.75, 1.7, 0.18, 0.18, '#7a5230');
        fb.add(T.cyl(), x, y + 3.2, z, 0.35, 0.2, 0.35, '#555', 0, Math.PI / 2);
        fb.add(T.box(), x + 1.2, y + 0.5, z + 1, 0.6, 1, 0.05, '#c9a04a');
        break;
      case 'flower':
        fb.add(T.box(), x + (r(1) - 0.5) * 0.6, y + 0.15, z + (r(2) - 0.5) * 0.6, 0.04, 0.3, 0.04, '#3a8a2a');
        fb.add(T.box(), x + (r(1) - 0.5) * 0.6, y + 0.32, z + (r(2) - 0.5) * 0.6, 0.16, 0.12, 0.16, ['#ff6b9d', '#ffd23f', '#ffffff', '#b06bff', '#ff8040'][Math.floor(v * 5)]);
        break;
      case 'bush':
        fb.add(T.ico(), x, y + 0.35, z, 1.1, 0.8, 1.1, '#3f8a35', v * 4);
        if (v > 0.5) for (let i = 0; i < 3; i++) fb.add(T.ico(), x + Math.cos(i * 2) * 0.4, y + 0.5, z + Math.sin(i * 2) * 0.4, 0.12, 0.12, 0.12, '#d02040');
        break;
      case 'pole_marker':
        for (let i = 0; i < 8; i++) fb.add(T.cyl(), x, y + 0.25 + i * 0.5, z, 0.3, 0.5, 0.3, i % 2 ? '#ffffff' : '#d02020');
        fb.add(T.ico(), x, y + 4.3, z, 0.6, 0.6, 0.6, '#ffd23f');
        fb.add(T.box(), x + 0.8, y + 2.5, z, 1.2, 0.5, 0.06, '#7a5230');
        break;
    }
  }

  private addVillageBuilding(fb: GeoBuilder, b: { kind: string; shop?: string; w: number; d: number; h: number; color: string; roof: string; door: [number, number]; x: number; z: number }, lx: number, y: number, lz: number, owner: number) {
    const cx = lx + b.w / 2, cz = lz + b.d / 2;
    fb.add(T.box(), cx, y + b.h / 2, cz, b.w, b.h, b.d, b.color);
    // roof
    if (b.kind === 'shop') {
      fb.add(T.box(), cx, y + b.h + 0.15, cz, b.w + 0.3, 0.3, b.d + 0.3, b.roof);
      fb.add(T.box(), cx, y + b.h - 0.6, cz + (b.door[1] > b.z ? b.d / 2 + 0.6 : -b.d / 2 - 0.6), b.w * 0.8, 0.12, 1.2, b.roof);
    } else {
      const rh = 1.8, sy = rh / 0.75;
      fb.add(T.prism(), cx, y + b.h + 0.25 * sy, cz, b.w + 0.4, sy, (b.d + 0.6) / 0.866, owner >= 0 ? ['#ffd23f', '#4fc3f7', '#ff6b9d', '#7ddc6a'][owner] : b.roof);
    }
    // door and windows on the street side
    const front = b.door[1] > b.z ? cz + b.d / 2 + 0.02 : cz - b.d / 2 - 0.02;
    const dx = b.door[0] - b.x + lx + 0.5;
    fb.add(T.box(), dx, y + 0.9, front, 1, 1.8, 0.08, '#6b4423');
    for (const wx of [lx + 1, lx + b.w - 1]) fb.add(T.box(), wx, y + b.h * 0.6, front, 0.9, 0.8, 0.08, '#bfe0ff');
    if (b.kind === 'house') fb.add(T.box(), lx + b.w - 1, y + b.h + 1.1, cz, 0.5, 1.2, 0.5, '#8a4a3a');
  }

  private updateChunks(g: Game) {
    const [pcx, pcz] = g.w.chunkOf(this.ox, this.oz);
    const want = new Set<string>();
    let built = 0;
    const order: [number, number, number][] = [];
    for (let dz = -VIEW; dz <= VIEW; dz++) for (let dx = -VIEW; dx <= VIEW; dx++) {
      const P = Math.round(1_000_000 / CHUNK);
      const cx = (((pcx + dx) % P) + P) % P, cz = (((pcz + dz) % P) + P) % P;
      want.add(key(cx, cz));
      order.push([dx * dx + dz * dz, cx, cz]);
    }
    order.sort((a, b) => a[0] - b[0]);
    for (const k of this.dirtyChunks) {
      const c = this.chunks.get(k);
      if (c) { this.disposeChunk(c); this.chunks.delete(k); }
    }
    this.dirtyChunks.clear();
    for (const [, cx, cz] of order) {
      const k = key(cx, cz);
      if (this.chunks.has(k)) continue;
      if (built++ >= 2) break;
      this.chunks.set(k, this.buildChunk(g, cx, cz));
    }
    for (const [k, c] of this.chunks) {
      if (!want.has(k)) { this.disposeChunk(c); this.chunks.delete(k); continue; }
      c.group.position.set(wd(c.cx * CHUNK, this.ox), 0, wd(c.cz * CHUNK, this.oz));
    }
  }
  private disposeChunk(c: Chunk) {
    this.earth.remove(c.group);
    c.terrain.geometry.dispose();
    c.feats?.geometry.dispose();
  }
  /** Chunks still to build near you (the loading screen waits for these). */
  pending(g: Game) {
    const [pcx, pcz] = g.w.chunkOf(this.ox, this.oz);
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.chunks.has(key(pcx + dx, pcz + dz))) n++;
    return n;
  }

  // ---------- caves ----------
  private buildCave(g: Game, id: string) {
    if (this.caveMesh) { this.cave.remove(this.caveMesh); this.caveMesh.geometry.dispose(); }
    const c = g.w.cave(id);
    const fb = new GeoBuilder();
    const N = CAVE_SIZE;
    const colors: Record<number, string> = { 1: '#5a554c', 2: '#6f87a8', 3: '#d07a3a', 4: '#2a2a2a', 5: '#7fe0ff', 6: '#7a5230' };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const cell = g.w.caveCell(c, x, z);
      if (cell === 0) {
        fb.add(T.box(), x + 0.5, -0.1, z + 0.5, 1, 0.2, 1, (x + z) & 1 ? '#3a352e' : '#36312a');
        if (c.mine && z % 6 === 4 && x % 4 === 2) { fb.add(T.box(), x + 0.5, 0.05, z + 0.5, 1, 0.06, 0.15, '#6b4423'); }
        continue;
      }
      // only walls you can see
      let seen = false;
      for (const [dx, dz] of DIRS) if (g.w.caveCell(c, x + dx, z + dz) === 0) seen = true;
      if (!seen) continue;
      fb.add(T.box(), x + 0.5, 1.1, z + 0.5, 1, 2.2, 1, cell === 6 ? '#7a5230' : '#5a554c');
      if (cell >= 2 && cell <= 5) for (let i = 0; i < 4; i++) {
        const a = (x * 7 + z * 3 + i) % 4;
        fb.add(T.dodo(), x + 0.5 + (a - 1.5) * 0.25, 0.4 + i * 0.45, z + 0.5 + ((i * 5) % 3 - 1) * 0.3, 1.08, 0.3, 1.08, colors[cell], i);
        fb.add(T.dodo(), x + 0.5, 2.2, z + 0.5, 0.7, 0.2, 0.7, colors[cell], i);
      }
    }
    // light coming in at the way out
    fb.add(T.box(), c.exit[0], 1.1, c.exit[1] + 1.4, 3, 2.2, 0.2, '#fff6c8');
    if (c.mine) for (let i = 0; i < 6; i++) fb.add(T.box(), c.exit[0] + 1, 0.3 + i * 0.5, c.exit[1] + 0.9, 0.8, 0.06, 0.1, '#8a6a3a');
    this.caveMesh = new THREE.Mesh(fb.build(), TERRAIN_MAT);
    this.caveMesh.userData.cave = true;
    this.cave.add(this.caveMesh);
    this.caveId = id;
  }

  // ---------- space ----------
  private buildPlatform(g: Game) {
    const k = [...g.ship.tiles].join(';');
    if (k === this.platformKey) return;
    this.platformKey = k;
    if (this.platformMesh) { this.space.remove(this.platformMesh); this.platformMesh.geometry.dispose(); }
    const fb = new GeoBuilder();
    for (const t of g.ship.tiles) {
      const [x, z] = t.split(',').map(Number);
      fb.add(T.box(), x + 0.5, -0.15, z + 0.5, 0.98, 0.3, 0.98, (x + z) & 1 ? '#5d6577' : '#555c6c');
      fb.add(T.box(), x + 0.5, -0.4, z + 0.5, 0.7, 0.3, 0.7, '#3e4454');
    }
    this.platformMesh = new THREE.Mesh(fb.build(), TERRAIN_MAT);
    this.platformMesh.userData.platform = true;
    this.space.add(this.platformMesh);
  }

  // ---------- one frame ----------
  render(g: Game, me: Player, dt: number, target: Target | null, mineProg: number) {
    const dim = me.dim === 'silo' ? 'earth' : me.dim;
    this.ox = me.x; this.oz = me.z;
    if (dim !== this.dimShown) {
      this.dimShown = dim;
      for (const o of this.bObjs.values()) o.removeFromParent();
      this.bObjs.clear();
    }
    this.earth.visible = dim === 'earth';
    this.cave.visible = dim !== 'earth' && dim !== 'space';
    this.space.visible = dim === 'space';
    const fog = this.scene.fog as THREE.Fog;
    const light = g.light;
    if (dim === 'earth') {
      this.updateChunks(g);
      const day = new THREE.Color('#8ec9ff'), night = new THREE.Color('#0b1030'), dusk = new THREE.Color('#f08a5a');
      const t = g.tod;
      const sky = night.clone().lerp(day, light);
      if ((t > 0.62 && t < 0.78) || t < 0.08) sky.lerp(dusk, 0.25 * (1 - Math.abs(light - 0.5) * 2));
      this.scene.background = sky;
      fog.color.copy(sky);
      fog.near = 50; fog.far = VIEW * CHUNK - 8;
      this.hemi.intensity = 0.35 + light * 0.85;
      this.sun.intensity = light * 1.6;
      const a = t * Math.PI * 2 - Math.PI / 2;
      this.sun.position.set(Math.cos(a) * 50 + 20, Math.max(5, Math.sin(a + Math.PI) * -60 + 30), 30);
      (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - light * 1.5);
      this.lamp.intensity = light < 0.5 ? (0.5 - light) * 6 : 0;
      this.updateSigns(g);
    } else if (dim === 'space') {
      this.buildPlatform(g);
      this.scene.background = new THREE.Color('#03040a');
      fog.near = 200; fog.far = 400;
      this.hemi.intensity = 0.8;
      this.sun.intensity = 1.8;
      this.sun.position.set(40, 60, 20);
      (this.stars.material as THREE.PointsMaterial).opacity = 1;
      this.lamp.intensity = 0;
      const dest = DESTINATIONS[g.ship.moving ? g.ship.dest : g.ship.at];
      (this.planet.material as THREE.MeshLambertMaterial).color.set(dest.planet);
      const near = g.ship.moving ? 0.4 : 1;
      this.planet.scale.setScalar(near);
      this.streaks.visible = g.ship.moving;
      if (g.ship.moving) {
        const pos = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) { let z = pos.getZ(i) + dt * 60; if (z > 80) z -= 160; pos.setZ(i, z); }
        pos.needsUpdate = true;
      }
      this.space.position.set(-this.ox, 0, -this.oz);
      this.planet.position.set(50 + this.ox, -70, 140 + this.oz);
      this.streaks.position.set(this.ox, 0, this.oz);
    } else {
      if (this.caveId !== dim) this.buildCave(g, dim);
      this.scene.background = new THREE.Color('#050403');
      fog.color.set('#050403');
      fog.near = 10; fog.far = 36;
      this.hemi.intensity = 0.55;
      this.sun.intensity = 0;
      (this.stars.material as THREE.PointsMaterial).opacity = 0;
      this.lamp.intensity = 9;
      this.cave.position.set(-this.ox, 0, -this.oz);
    }
    this.stars.position.copy(this.cam.position);
    this.lamp.position.set(0, me.y + 2.2, 0);

    this.updateBuildings(g, dim, dt);
    this.updateMobs(g, dim, dt);
    this.updatePlayers(g, dim, dt);
    this.updateCars(g, dim);
    this.updateRocks(g, dim, dt);
    this.updateShots(g, dim);
    this.updateLights(g, dim);
    this.updateFx(dt);
    this.drawTarget(g, dim, me, target, mineProg);

    // camera
    const ty = me.y + 1.5;
    const cd = this.camDist * (me.car ? 1.4 : 1);
    const cp = Math.cos(this.camPitch);
    let cx = Math.sin(this.camYaw) * cp * cd, cz = Math.cos(this.camYaw) * cp * cd, cy = ty + Math.sin(this.camPitch) * cd;
    if (dim === 'earth') {
      const gy = g.groundY('earth', me.x + cx, me.z + cz) + 0.6;
      if (cy < gy) cy = gy;
    } else if (dim !== 'space') {
      // caves have no roof to block the view: look down from above
      const pitch = Math.max(this.camPitch, 1.28);
      const pc = Math.cos(pitch);
      cx = Math.sin(this.camYaw) * pc * cd; cz = Math.cos(this.camYaw) * pc * cd; cy = ty + Math.sin(pitch) * cd;
    }
    this.cam.position.set(cx, cy, cz);
    this.cam.lookAt(0, ty, 0);
    this.r.render(this.scene, this.cam);
  }

  private updateSigns(g: Game) {
    const want = new Set<string>();
    for (const v of g.w.villagesNear(this.ox, this.oz)) {
      want.add(v.id);
      if (!this.signs.has(v.id)) {
        const list: THREE.Sprite[] = [];
        for (const b of v.buildings) if (b.kind === 'shop') {
          const names: Record<string, string> = { store: '🛒 STORE', restaurant: '🍔 RESTAURANT', cars: '🚗 CARS', homes: '🏠 HOMES', pets: '🐾 PETS', police: '👮 POLICE' };
          const s = textSprite(names[b.shop!], '#ffffff', 'rgba(0,0,0,.55)');
          s.userData = { x: b.x + b.w / 2, z: b.door[1] > b.z ? b.z + b.d + 0.3 : b.z - 0.3, y: v.y + b.h + 0.9 };
          s.scale.multiplyScalar(0.6);
          list.push(s);
          this.earth.add(s);
        }
        const nameSign = textSprite(`Welcome to ${v.name}`, '#ffe9a0', 'rgba(40,20,0,.6)');
        nameSign.userData = { x: v.x - v.r + 2, z: v.z - 3, y: v.y + 3 };
        nameSign.scale.multiplyScalar(0.7);
        list.push(nameSign);
        this.earth.add(nameSign);
        this.signs.set(v.id, list);
      }
    }
    for (const [id, list] of this.signs) {
      if (!want.has(id)) { for (const s of list) { this.earth.remove(s); s.material.map?.dispose(); s.material.dispose(); } this.signs.delete(id); continue; }
      for (const s of list) s.position.set(wd(s.userData.x, this.ox), s.userData.y, wd(s.userData.z, this.oz));
    }
  }

  private parentFor(dim: Dim) { return dim === 'earth' ? this.scene : dim === 'space' ? this.scene : this.scene; }

  private updateBuildings(g: Game, dim: Dim, dt: number) {
    const seen = new Set<number>();
    for (const b of g.buildings.values()) {
      if (b.dim !== dim) continue;
      if (b.type === 'space_platform') continue;
      const px = this.sx(b.x, dim), pz = this.sz(b.z, dim);
      if (Math.abs(px) > 110 || Math.abs(pz) > 110) continue;
      seen.add(b.id);
      let o = this.bObjs.get(b.id);
      if (!o || o.userData.ver !== verOf(b)) {
        if (o) o.removeFromParent();
        o = buildingModel(b);
        o.userData.ver = verOf(b);
        this.parentFor(dim).add(o);
        this.bObjs.set(b.id, o);
      }
      const s = BUILDS[b.type].size;
      const gy = dim === 'earth' ? g.w.heightAt(b.x + s / 2, b.z + s / 2) : 0;
      o.position.set(px + s / 2, gy, pz + s / 2);
      o.rotation.y = s > 1 ? 0 : Math.atan2(DIRS[b.dir][0], DIRS[b.dir][1]);
      // children were made with 0..size coords: shift by half
      if (!o.userData.centered) { for (const c of o.children) c.position.x -= s / 2, c.position.z -= s / 2; o.userData.centered = true; }
      this.animateBuilding(o, b, dt);
    }
    for (const [id, o] of this.bObjs) if (!seen.has(id)) { o.removeFromParent(); this.bObjs.delete(id); }
  }
  private animateBuilding(o: THREE.Group, b: Building, dt: number) {
    const p = o.userData.parts as Record<string, THREE.Object3D>;
    const t = performance.now() / 1000;
    if (p.glow) p.glow.visible = b.on !== false && (b.on || b.type === 'torch' || b.type === 'campfire');
    if (p.spin && b.on) p.spin.rotation.y += dt * 8;
    if (p.beam && b.on) p.beam.rotation.x = Math.sin(t * 2) * 0.35;
    if (p.head && b.aim !== undefined) p.head.rotation.y = b.aim - o.rotation.y;
    if (p.arm) {
      const sw = b.swing ?? 0;
      p.arm.rotation.y = b.type === 'asteroid_grabber' ? (b.hold ? Math.PI * (1 - sw) : (b.aim ?? 0) - o.rotation.y + Math.PI) : Math.PI * (1 - sw);
      if (p.hand) {
        p.hand.visible = !!b.hold;
        if (b.hold) ((p.hand as THREE.Mesh).material as THREE.MeshLambertMaterial) = mat(itemColor(b.hold.id));
      }
    }
    if (p.rocket) p.rocket.visible = (b.units ?? 0) >= 10 || !!b.launch;
    if (p.red) {
      const ph = Math.floor((t + b.id) / 4) % 3;
      ((p.red as THREE.Mesh).material as THREE.Material) = mat('#ff2020', { emissive: ph === 0 ? '#ff0000' : '#300000' });
      ((p.yellow as THREE.Mesh).material as THREE.Material) = mat('#ffd020', { emissive: ph === 1 ? '#ffb000' : '#302000' });
      ((p.green as THREE.Mesh).material as THREE.Material) = mat('#20ff40', { emissive: ph === 2 ? '#00ff20' : '#003000' });
    }
    // belt items
    if (b.items) {
      let holder = o.userData.items as THREE.Group | undefined;
      if (!holder) { holder = new THREE.Group(); o.add(holder); o.userData.items = holder; }
      while (holder.children.length < b.items.length) holder.add(box(0.26, 0.2, 0.26, 0, 0.25, 0, '#fff'));
      holder.children.forEach((c, i) => {
        const it = b.items![i];
        c.visible = !!it;
        if (!it) return;
        (c as THREE.Mesh).material = mat(itemColor(it.id));
        c.position.set(0, 0.24, it.p - 0.5);
      });
    }
  }

  private updateMobs(g: Game, dim: Dim, dt: number) {
    const seen = new Set<number>();
    for (const m of g.mobs.values()) {
      if (m.dim !== dim) continue;
      const px = this.sx(m.x, dim), pz = this.sz(m.z, dim);
      if (Math.abs(px) > 120 || Math.abs(pz) > 120) continue;
      seen.add(m.id);
      let rig = this.mObjs.get(m.id);
      if (!rig) {
        rig = mobModel(m.type);
        rig.root.traverse((o) => { o.userData.mob = m.id; });
        this.scene.add(rig.root);
        this.mObjs.set(m.id, rig);
      }
      this.poseMob(rig, m, px, pz, dt);
    }
    for (const [id, r] of this.mObjs) if (!seen.has(id)) { r.root.removeFromParent(); this.mObjs.delete(id); }
  }
  private poseMob(rig: Rig, m: Mob, px: number, pz: number, dt: number) {
    const cur = rig.root.position;
    // smooth toward the latest position (friends get 10 updates a second)
    const k = Math.min(1, dt * 12);
    if (cur.distanceToSquared(new THREE.Vector3(px, m.y, pz)) > 25) cur.set(px, m.y, pz);
    else cur.set(cur.x + (px - cur.x) * k, cur.y + (m.y - cur.y) * k, cur.z + (pz - cur.z) * k);
    let dy = m.yaw - rig.root.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    rig.root.rotation.y += dy * Math.min(1, dt * 10);
    const sw = Math.sin(m.anim * 3) * 0.6;
    const def = MOBS[m.type];
    rig.legs.forEach((l, i) => {
      if (def.shape === 'bug') l.rotation.y = Math.sin(m.anim * 4 + i) * 0.4;
      else if (def.shape === 'fish') l.rotation.y = Math.sin(m.anim * 2) * 0.5;
      else if (def.shape === 'snake') l.position.x = Math.sin(m.anim * 3 + i) * 0.12;
      else l.rotation.x = (i % 2 ? sw : -sw) * (i < 2 ? 1 : -1);
    });
    rig.arms.forEach((a, i) => {
      if (def.shape === 'bat' || def.shape === 'bird') a.rotation.z = Math.sin(performance.now() / 70 + m.id) * 0.8 * (i ? 1 : -1);
      else a.rotation.x = (i ? -sw : sw);
    });
  }

  private updatePlayers(g: Game, dim: Dim, dt: number) {
    const seen = new Set<number>();
    for (const p of g.players.values()) {
      if (p.dim !== dim || p.car) continue;
      seen.add(p.slot);
      let rig = this.pObjs.get(p.slot);
      if (!rig) {
        const base = personModel(p.color, '#f1c9a0', '#5a3a22');
        const label = textSprite(`${p.slot + 1}`, '#111', p.color);
        label.scale.set(0.6, 0.6, 1);
        label.position.y = 2.4;
        base.root.add(label);
        const held = new THREE.Group();
        held.position.set(0.33, 0.8, 0.15);
        base.root.add(held);
        rig = { ...base, label, held, heldId: '' };
        this.scene.add(rig.root);
        this.pObjs.set(p.slot, rig);
      }
      const px = this.sx(p.x, dim), pz = this.sz(p.z, dim);
      const k = p === g.me ? 1 : Math.min(1, dt * 12);
      const r = rig.root.position;
      if (r.distanceToSquared(new THREE.Vector3(px, p.y, pz)) > 25) r.set(px, p.y, pz);
      else r.set(r.x + (px - r.x) * k, r.y + (p.y - r.y) * k, r.z + (pz - r.z) * k);
      rig.root.rotation.y = p.yaw;
      const sw = Math.sin(p.anim * 2.4) * 0.7;
      rig.legs[0].rotation.x = sw; rig.legs[1].rotation.x = -sw;
      rig.arms[0].rotation.x = -sw * 0.8;
      rig.arms[1].rotation.x = p.swing > 0 ? -1.6 * p.swing : sw * 0.8;
      p.swing = Math.max(0, p.swing - dt * 4);
      rig.label.visible = p !== g.me;
      // what's in your hand
      const h = p.inv[p.hand];
      const hid = h?.id ?? '';
      if (hid !== rig.heldId) {
        rig.heldId = hid;
        rig.held.clear();
        if (hid) {
          const wpn = ['gun', 'sniper', 'flamethrower', 'rocket_launcher'].includes(hid);
          if (wpn) { box(0.1, 0.14, hid === 'sniper' ? 1 : 0.6, 0, 0, 0.25, hid === 'rocket_launcher' ? '#4a6a3a' : '#333', rig.held); if (hid === 'flamethrower') box(0.16, 0.2, 0.2, 0, -0.1, 0, '#d04030', rig.held); }
          else box(0.2, 0.2, 0.2, 0, 0, 0.1, itemColor(hid), rig.held);
        }
      }
    }
    for (const [id, r] of this.pObjs) if (!seen.has(id)) { r.root.removeFromParent(); this.pObjs.delete(id); }
  }

  private updateCars(g: Game, dim: Dim) {
    const seen = new Set<number>();
    if (dim === 'earth') for (const c of g.cars.values()) {
      const px = this.sx(c.x, dim), pz = this.sz(c.z, dim);
      if (Math.abs(px) > 120 || Math.abs(pz) > 120) continue;
      seen.add(c.id);
      let o = this.cObjs.get(c.id);
      if (!o) { o = carModel(c.car); o.traverse((x) => { x.userData.car = c.id; }); this.scene.add(o); this.cObjs.set(c.id, o); }
      const drv: Player | undefined = c.driver !== null ? g.players.get(c.driver) : undefined;
      const src: Vehicle | Player = drv ?? c;
      o.position.set(this.sx(src.x, dim), src.y, this.sz(src.z, dim));
      o.rotation.y = src.yaw;
      // tilt with the ground
      const ahead = g.groundY('earth', src.x + Math.sin(src.yaw) * 1.2, src.z + Math.cos(src.yaw) * 1.2);
      const back = g.groundY('earth', src.x - Math.sin(src.yaw) * 1.2, src.z - Math.cos(src.yaw) * 1.2);
      o.rotation.x = -Math.atan2(ahead - back, 2.4);
      o.rotation.order = 'YXZ';
    }
    for (const [id, o] of this.cObjs) if (!seen.has(id)) { o.removeFromParent(); this.cObjs.delete(id); }
  }

  private updateRocks(g: Game, dim: Dim, dt: number) {
    const seen = new Set<number>();
    if (dim === 'space') for (const r of g.ship.rocks) {
      seen.add(r.id);
      let m = this.rObjs.get(r.id);
      if (!m) {
        m = new THREE.Mesh(ROCK_GEO, mat(ROCK_COLOR[r.kind]));
        m.scale.setScalar([0.7, 1.8, 3.2, 5.5][r.size]);
        m.userData.rock = r.id;
        this.scene.add(m);
        this.rObjs.set(r.id, m);
      }
      m.position.set(this.sx(r.x, dim), 0.4 + r.size * 0.3, this.sz(r.z, dim));
      m.rotation.set(r.rot, r.rot * 0.7, 0);
      void dt;
    }
    for (const [id, m] of this.rObjs) if (!seen.has(id)) { m.removeFromParent(); this.rObjs.delete(id); }
  }
  private updateShots(g: Game, dim: Dim) {
    const seen = new Set<number>();
    for (const s of g.shots) {
      if (s.dim !== dim) continue;
      seen.add(s.id);
      let m = this.sObjs.get(s.id);
      if (!m) { m = new THREE.Mesh(s.kind === 'grenade' ? new THREE.SphereGeometry(0.15) : new THREE.CylinderGeometry(0.08, 0.08, 0.6), mat(s.kind === 'grenade' ? '#3a5a2a' : '#d04030')); this.scene.add(m); this.sObjs.set(s.id, m); }
      m.position.set(this.sx(s.x, dim), s.y, this.sz(s.z, dim));
      if (s.kind === 'rocket') m.lookAt(m.position.x + s.vx, m.position.y + s.vy, m.position.z + s.vz), m.rotateX(Math.PI / 2);
    }
    for (const [id, m] of this.sObjs) if (!seen.has(id)) { m.removeFromParent(); m.geometry.dispose(); this.sObjs.delete(id); }
  }
  private updateLights(g: Game, dim: Dim) {
    const lit: [number, number, number][] = [];
    if (g.light < 0.6 || (dim !== 'earth' && dim !== 'space')) {
      for (const b of g.buildings.values()) {
        if (b.dim !== dim || (b.type !== 'torch' && b.type !== 'campfire' && !(b.on && (b.type === 'furnace' || b.type === 'steel_furnace')))) continue;
        const px = this.sx(b.x + 0.5, dim), pz = this.sz(b.z + 0.5, dim);
        lit.push([px * px + pz * pz, px, pz]);
      }
    }
    lit.sort((a, b) => a[0] - b[0]);
    this.lights.forEach((l, i) => {
      const L = lit[i];
      l.intensity = L && L[0] < 3600 ? 3 : 0;
      if (L) l.position.set(L[1], (dim === 'earth' ? g.groundY('earth', this.ox + L[1], this.oz + L[2]) : 0) + 1.5, L[2]);
    });
  }

  // ---------- effects ----------
  addFx(f: Fx, meDim: Dim) {
    if (f.k === 'sfx') return;
    const fdim = f.dim === 'silo' ? 'earth' : f.dim;
    if (fdim !== meDim) return;
    const P = (n: number, c: string, speed: number, life: number, size: number, grav: number, up = 0) => {
      for (let i = 0; i < n && this.parts.length < 580; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
        this.parts.push({ x: (f as { x: number }).x, y: (f as { y: number }).y, z: (f as { z: number }).z, vx: Math.cos(a) * Math.cos(e) * speed, vy: Math.abs(Math.sin(e)) * speed + up, vz: Math.sin(a) * Math.cos(e) * speed, life, max: life, color: new THREE.Color(c), size, grav, dim: fdim });
      }
    };
    switch (f.k) {
      case 'puff': P(f.n ?? 12, f.c ?? '#fff', 2.5, 0.8, 0.3, -1, 1); break;
      case 'chips': P(f.n ?? 8, f.c ?? '#888', 4, 0.7, 0.14, 12, 2); break;
      case 'spark': P(f.n ?? 5, f.c ?? '#fff', 4, 0.3, 0.08, 0); break;
      case 'smoke': P(1, '#bbbbbb', 0.5, 0.8, 0.25, -1); break;
      case 'flame': {
        const [dx, dy, dz] = (f.c ?? '0,0,1').split(',').map(Number);
        for (let i = 0; i < 4 && this.parts.length < 580; i++) {
          const s = 9 + Math.random() * 4;
          this.parts.push({ x: f.x, y: f.y, z: f.z, vx: dx * s + (Math.random() - 0.5) * 3, vy: dy * s + Math.random() * 1.5, vz: dz * s + (Math.random() - 0.5) * 3, life: 0.6, max: 0.6, color: new THREE.Color(Math.random() < 0.5 ? '#ffb030' : '#ff5a10'), size: 0.35, grav: -2, dim: fdim });
        }
        break;
      }
      case 'boom': {
        P(30, '#ffb030', 7, 0.6, 0.3, 2, 2);
        P(15, '#555', 3, 1.2, 0.5, -1, 1);
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd080', transparent: true, opacity: 0.8 }));
        this.scene.add(m);
        this.booms.push({ mesh: m, life: 0.4, r: f.n ?? 3 });
        m.userData = { x: f.x, y: f.y, z: f.z, dim: fdim };
        break;
      }
      case 'tracer': {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: f.c ?? '#ffd27a', transparent: true }));
        line.userData = { a: [f.x, f.y, f.z], b: [f.tx, f.ty, f.tz], dim: fdim };
        this.scene.add(line);
        this.tracers.push({ line, life: 0.08 });
        break;
      }
      case 'launch': {
        const obj = rocketModel();
        this.scene.add(obj);
        this.launches.push({ obj, t: 0, x: f.x, z: f.z });
        break;
      }
    }
  }
  private updateFx(dt: number) {
    const m4 = new THREE.Matrix4();
    let n = 0;
    const dim = this.dimShown;
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of this.parts) {
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 0.97; p.vz *= 0.97;
      if (p.dim !== dim) continue;
      const s = p.size * (0.4 + (p.life / p.max) * 0.6);
      m4.makeScale(s, s, s);
      m4.setPosition(this.sx(p.x, dim), p.y, this.sz(p.z, dim));
      this.pMesh.setMatrixAt(n, m4);
      this.pMesh.setColorAt(n, p.color);
      n++;
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    for (const t of this.tracers) {
      t.life -= dt;
      const { a, b, dim: d } = t.line.userData;
      const pos = t.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, this.sx(a[0], d), a[1], this.sz(a[2], d));
      pos.setXYZ(1, this.sx(b[0], d), b[1], this.sz(b[2], d));
      pos.needsUpdate = true;
      t.line.visible = d === dim;
      if (t.life <= 0) { t.line.removeFromParent(); t.line.geometry.dispose(); }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const b of this.booms) {
      b.life -= dt;
      const k = 1 - b.life / 0.4;
      b.mesh.scale.setScalar(0.3 + k * b.r);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      const u = b.mesh.userData;
      b.mesh.position.set(this.sx(u.x, u.dim), u.y, this.sz(u.z, u.dim));
      b.mesh.visible = u.dim === dim;
      if (b.life <= 0) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); }
    }
    this.booms = this.booms.filter((b) => b.life > 0);
    for (const l of this.launches) {
      l.t += dt;
      const y = l.t < 1 ? 1 : 1 + (l.t - 1) ** 2 * 6;
      l.obj.position.set(this.sx(l.x, 'earth'), y, this.sz(l.z, 'earth'));
      l.obj.visible = dim === 'earth';
      if (Math.random() < 0.8) this.parts.push({ x: l.x + (Math.random() - 0.5), y: y - 0.5, z: l.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vy: -2, vz: (Math.random() - 0.5) * 3, life: 1.5, max: 1.5, color: new THREE.Color(Math.random() < 0.3 ? '#ffb030' : '#dddddd'), size: 0.7, grav: -0.5, dim: 'earth' });
      if (l.t > 7) l.obj.removeFromParent();
    }
    this.launches = this.launches.filter((l) => l.t <= 7);
  }

  private drawTarget(g: Game, dim: Dim, me: Player, t: Target | null, prog: number) {
    this.hl.visible = false;
    this.mineBar.visible = false;
    if (!t) return;
    let x = 0, z = 0, y = 0, sx = 1, sy = 1, sz = 1;
    if (t.k === 'feat' || t.k === 'ground') { x = t.x + 0.5; z = t.z + 0.5; y = g.w.tileHeight(t.x, t.z); sy = t.k === 'ground' ? 0.1 : 1.6; }
    else if (t.k === 'cave') { x = t.x + 0.5; z = t.z + 0.5; y = 0; sy = 3; }
    else if (t.k === 'build') { const b = g.buildings.get(t.id); if (!b) return; const s = BUILDS[b.type].size; x = b.x + s / 2; z = b.z + s / 2; y = dim === 'earth' ? g.w.heightAt(x, z) : 0; sx = sz = s; sy = 1.2; }
    else if (t.k === 'mob') { const m = g.mobs.get(t.id); if (!m) return; const s = MOBS[m.type].size; x = m.x; z = m.z; y = m.y; sx = sz = s; sy = s * 1.3; }
    else return;
    this.hl.visible = true;
    this.hl.position.set(this.sx(x, dim), y + sy / 2, this.sz(z, dim));
    this.hl.scale.set(sx * 1.05, sy, sz * 1.05);
    if (prog > 0) {
      this.mineBar.visible = true;
      this.mineBar.position.set(this.sx(x, dim), y + sy + 0.5, this.sz(z, dim));
      this.mineBar.scale.x = Math.max(0.02, prog);
      this.mineBar.quaternion.copy(this.cam.quaternion);
    }
    void me;
  }

  showGhost(dim: Dim, x: number, z: number, size: number, ok: boolean, g: Game, dir: number) {
    this.ghost.visible = true;
    const y = dim === 'earth' ? g.w.heightAt(x + size / 2, z + size / 2) : 0;
    this.ghost.position.set(this.sx(x + size / 2, dim), y + 0.5, this.sz(z + size / 2, dim));
    this.ghost.scale.set(size, 1, size);
    this.ghost.rotation.y = Math.atan2(DIRS[dir][0], DIRS[dir][1]);
    (this.ghost.material as THREE.MeshBasicMaterial).color.set(ok ? '#40ff60' : '#ff4040');
  }

  /** What's under the screen point (-1..1)? */
  pick(g: Game, dim: Dim, nx: number, ny: number): { target: Target | null; point: THREE.Vector3 | null; wx: number; wz: number } {
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.cam);
    const objs: THREE.Object3D[] = [];
    for (const r of this.mObjs.values()) objs.push(r.root);
    for (const o of this.bObjs.values()) objs.push(o);
    for (const o of this.cObjs.values()) objs.push(o);
    for (const o of this.rObjs.values()) objs.push(o);
    if (dim === 'earth') for (const c of this.chunks.values()) { if (Math.abs(c.group.position.x + 16) < 80 && Math.abs(c.group.position.z + 16) < 80) { objs.push(c.terrain); if (c.feats) objs.push(c.feats); } }
    else if (dim === 'space') { if (this.platformMesh) objs.push(this.platformMesh); }
    else if (this.caveMesh) objs.push(this.caveMesh);
    const hits = this.ray.intersectObjects(objs, true);
    const h = hits.find((x) => x.object.visible);
    if (!h) return { target: null, point: null, wx: 0, wz: 0 };
    const p = h.point;
    const wx = dim === 'earth' ? wrap(p.x + this.ox) : p.x + this.ox, wz = dim === 'earth' ? wrap(p.z + this.oz) : p.z + this.oz;
    const ud = h.object.userData;
    if (ud.mob !== undefined) return { target: { k: 'mob', id: ud.mob }, point: p, wx, wz };
    if (ud.b !== undefined) return { target: { k: 'build', id: ud.b }, point: p, wx, wz };
    if (ud.rock !== undefined) return { target: { k: 'rock', id: ud.rock }, point: p, wx, wz };
    if (ud.car !== undefined) return { target: null, point: p, wx, wz };
    if (ud.cave) {
      const n = h.face?.normal ?? new THREE.Vector3();
      const cx = Math.floor(wx - n.x * 0.1), cz = Math.floor(wz - n.z * 0.1);
      if (n.y > 0.5 || n.y < -0.5) return { target: null, point: p, wx, wz };
      return { target: { k: 'cave', x: cx, z: cz }, point: p, wx, wz };
    }
    if (dim === 'earth') {
      // a feature on this tile or next to it
      const tx = Math.floor(wx), tz = Math.floor(wz);
      if (ud.feats) {
        let best: [number, number] | null = null, bd = 9;
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
          const f = g.w.feature(tx + ox, tz + oz);
          if (!f) continue;
          const d = (wd(wx, tx + ox + 0.5)) ** 2 + (wd(wz, tz + oz + 0.5)) ** 2;
          if (d < bd) { bd = d; best = [wrap(tx + ox), wrap(tz + oz)]; }
        }
        if (best) return { target: { k: 'feat', x: best[0], z: best[1] }, point: p, wx, wz };
      }
      const f = g.w.feature(tx, tz);
      if (f && (f.kind === 'ore' || f.kind === 'oil' || f.kind === 'flower')) return { target: { k: 'feat', x: wrap(tx), z: wrap(tz) }, point: p, wx, wz };
      const b = g.buildingAt('earth', tx, tz);
      if (b) return { target: { k: 'build', id: b.id }, point: p, wx, wz };
      return { target: { k: 'ground', x: wrap(tx), z: wrap(tz) }, point: p, wx, wz };
    }
    const b = g.buildingAt(dim, wx, wz);
    if (b) return { target: { k: 'build', id: b.id }, point: p, wx, wz };
    return { target: null, point: p, wx, wz };
  }

  dispose() {
    this.r.dispose();
    for (const c of this.chunks.values()) this.disposeChunk(c);
  }
}

function verOf(b: Building) { return `${b.type}${b.hub ? 'h' : ''}${b.ug ?? ''}`; }

const TERRAIN_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const WATER_GEO = new THREE.PlaneGeometry(CHUNK, CHUNK).rotateX(-Math.PI / 2);
const WATER_MAT = new THREE.MeshLambertMaterial({ color: '#2f7fc8', transparent: true, opacity: 0.72, depthWrite: false });
const ROCK_GEO = new THREE.DodecahedronGeometry(0.5, 0);

function textSprite(text: string, color: string, bg: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 40px system-ui, sans-serif';
  const w = Math.max(64, ctx.measureText(text).width + 30);
  c.width = w; c.height = 64;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 64, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  s.scale.set(w / 64, 1, 1);
  return s;
}
export { ball };
