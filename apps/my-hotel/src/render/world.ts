// Builds the parts of the scene that only change when the layout changes:
// ground, outside scenery, floors, walls, furniture, unbuilt plots and land for sale.
import * as THREE from 'three';
import { grid, type Hotel, type Vending } from '../sim/hotel';
import { DESK, ENTRANCE_X, LOT, SOFA, lotKey, lotsForSale, parseLot, roomGeom, worldBounds } from '../sim/layout';
import { nextRandom } from '../sim/rng';
import { ball, box, canvasTexture, cone, cyl, decal, mat, roundRect, toonMap, UI_FONT } from './kit';
import type { Theme } from './theme';

const OUTER_H = 1.4;
const ROOM_H = 1.1;
const WALL_T = 0.7;

export function buildWorld(h: Hotel, T: Theme): THREE.Group {
  const root = new THREE.Group();
  const owned = new Set(h.lots);
  const forSale = lotsForSale(owned);
  const reserved = new Set([...owned, ...forSale.map(([i, j]) => lotKey(i, j))]);
  const b = worldBounds(owned);

  // ground
  const ground = decal(root, 400, 400, mat(T.ground), (b.x0 + b.x1) / 2, -0.02, 0);
  ground.receiveShadow = true;
  outside(root, h, T, reserved, b);

  // floors
  const floorMat = toonMap(floorTexture(T), false);
  (floorMat.map as THREE.Texture).wrapS = (floorMat.map as THREE.Texture).wrapT = THREE.RepeatWrapping;
  (floorMat.map as THREE.Texture).repeat.set(2, 2);
  for (const k of owned) {
    const [i, j] = parseLot(k);
    decal(root, LOT, LOT, floorMat, i * LOT + LOT / 2, 0.01, j * LOT + LOT / 2);
    box(root, LOT, 0.25, LOT, T.trim, i * LOT + LOT / 2, -0.3, j * LOT + LOT / 2);
  }

  walls(root, h, T);
  lobby(root, T);

  for (const r of h.rooms) {
    const g = roomGeom(r.i, r.j, r.side);
    const cx = (g.rect.x0 + g.rect.x1) / 2, cz = (g.rect.z0 + g.rect.z1) / 2;
    if (!r.built) {
      decal(root, g.rect.x1 - g.rect.x0 - 0.3, g.rect.z1 - g.rect.z0 - 0.3, toonMap(dashed('rgba(80,70,60,0.18)', '#ffffff')), cx, 0.02, cz);
      continue;
    }
    roomFurniture(root, T, r.id, g);
  }

  for (const m of h.vending) vendingMachine(root, T, m);
  for (const [i, j] of forSale) landForSale(root, T, i, j);
  return root;
}

function floorTexture(T: Theme) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = T.floorA;
    g.fillRect(0, 0, w, h);
    if (T.floorPattern === 'terrazzo') {
      for (let i = 0; i < 700; i++) {
        g.fillStyle = [T.floorB, '#f0c9a8', '#cfe9e4', '#e7d7f0'][i % 4];
        g.beginPath();
        g.arc((i * 733) % w, (i * 397) % h, 2 + ((i * 37) % 6), 0, 7);
        g.fill();
      }
    } else {
      for (let y = 0, row = 0; y < h; y += 64, row++) {
        for (let x = -((row * 97) % 256); x < w; x += 256) {
          g.fillStyle = (row + Math.round(x / 256)) % 2 ? T.floorA : T.floorB;
          g.fillRect(x + 2, y + 2, 252, 60);
        }
      }
    }
  });
}

function dashed(fill: string, line: string) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
    g.setLineDash([22, 14]);
    g.lineWidth = 8;
    g.strokeStyle = line;
    g.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Merge wall cells into runs so there are few meshes. */
function walls(root: THREE.Group, h: Hotel, T: Theme) {
  const g = grid(h);
  const used = new Set<number>();
  const kindAt = (gx: number, gz: number) => (gx < 0 || gz < 0 || gx >= g.w || gz >= g.h ? undefined : g.walls.get(gz * g.w + gx));
  const emit = (x: number, z: number, w: number, d: number, kind: string) => {
    const height = kind === 'outer' ? OUTER_H : ROOM_H;
    box(root, w, height, d, T.wall, x, 0, z);
    box(root, w + 0.08, 0.12, d + 0.08, T.trim, x, height, z);
  };
  // horizontal runs
  for (let gz = 0; gz < g.h; gz++) {
    for (let gx = 0; gx < g.w; gx++) {
      const kind = kindAt(gx, gz);
      if (!kind || used.has(gz * g.w + gx)) continue;
      let end = gx;
      while (kindAt(end + 1, gz) === kind) end++;
      if (end === gx) continue;
      for (let x = gx; x <= end; x++) used.add(gz * g.w + x);
      emit(g.x0 + (gx + end + 1) / 2, g.z0 + gz + 0.5, end - gx + 1 - (1 - WALL_T), WALL_T, kind);
      gx = end;
    }
  }
  // vertical runs of whatever is left
  for (let gx = 0; gx < g.w; gx++) {
    for (let gz = 0; gz < g.h; gz++) {
      const kind = kindAt(gx, gz);
      if (!kind || used.has(gz * g.w + gx)) continue;
      let end = gz;
      while (kindAt(gx, end + 1) === kind && !used.has((end + 1) * g.w + gx)) end++;
      for (let z = gz; z <= end; z++) used.add(z * g.w + gx);
      emit(g.x0 + gx + 0.5, g.z0 + (gz + end + 1) / 2, WALL_T, end - gz + 1 + (1 - WALL_T), kind);
      gz = end;
    }
  }
}

function lobby(root: THREE.Group, T: Theme) {
  // reception desk
  const dx = (DESK.x0 + DESK.x1) / 2, dz = (DESK.z0 + DESK.z1) / 2;
  box(root, DESK.x1 - DESK.x0 - 0.3, 1.05, DESK.z1 - DESK.z0 - 0.1, T.trim, dx, 0, dz);
  box(root, DESK.x1 - DESK.x0, 0.14, DESK.z1 - DESK.z0 + 0.2, T.accent, dx, 1.05, dz);
  box(root, 0.5, 0.35, 0.5, '#37474f', dx - 0.3, 1.19, dz - 1);
  box(root, 0.05, 0.32, 0.45, '#80deea', dx - 0.04, 1.38, dz - 1);
  ball(root, 0.16, '#ffca28', dx + 0.4, 1.3, dz + 1.2);
  // the spot behind the desk
  decal(root, 1.9, 3.8, mat(T.accent2), 1, 0.02, dz).material = new THREE.MeshBasicMaterial({ color: T.accent2, transparent: true, opacity: 0.35 });
  // sofa and rug
  const sx = (SOFA.x0 + SOFA.x1) / 2;
  box(root, 3, 0.55, 1.1, T.accent, sx, 0, SOFA.z0 + 0.6);
  box(root, 3, 1.0, 0.35, T.accent, sx, 0, SOFA.z0 + 0.1);
  box(root, 0.35, 0.8, 1.1, T.accent, sx - 1.5, 0, SOFA.z0 + 0.6);
  box(root, 0.35, 0.8, 1.1, T.accent, sx + 1.5, 0, SOFA.z0 + 0.6);
  decal(root, 5, 3, mat(T.rug), sx, 0.025, 3);
  plant(root, T, 11, 10.6, 1.1);
  plant(root, T, 4.2, 10.6, 1);
  // entrance mat and canopy
  decal(root, 2.6, 1.6, mat(T.accent), ENTRANCE_X, 0.03, 10.6);
  box(root, 0.45, 2.5, 0.45, T.trim, ENTRANCE_X - 1.5, 0, 12.1);
  box(root, 0.45, 2.5, 0.45, T.trim, ENTRANCE_X + 1.5, 0, 12.1);
  box(root, 4.2, 0.3, 1.8, T.accent, ENTRANCE_X, 2.5, 12.1);
  const sign = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = T.trim;
    roundRect(g, 4, 4, w - 8, h - 8, 30);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `bold 80px ${UI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('My hotel', w / 2, h / 2 + 4);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
  s.position.set(ENTRANCE_X, 3.25, 12.9);
  s.rotation.x = -0.5;
  root.add(s);
}

function roomFurniture(root: THREE.Group, T: Theme, id: number, g: ReturnType<typeof roomGeom>) {
  const x0 = g.rect.x0, z0 = g.rect.z0;
  const bx = x0 + 2.6, bz = z0 + 2.5;
  // bed: frame, headboard, mattress, pillow (blanket is drawn by the live layer)
  box(root, 2.0, 0.45, 2.8, T.trim, bx, 0, bz);
  box(root, 2.0, 1.1, 0.2, T.trim, bx, 0, bz - 1.4);
  box(root, 1.85, 0.3, 2.6, '#ffffff', bx, 0.45, bz + 0.05);
  box(root, 1.3, 0.2, 0.5, '#ffffff', bx, 0.75, bz - 0.95);
  // nightstand and lamp
  box(root, 0.5, 0.6, 0.5, T.trim, x0 + 1.3, 0, z0 + 1.4);
  cyl(root, 0.05, 0.05, 0.4, '#555555', x0 + 1.3, 0.6, z0 + 1.4, 6);
  cyl(root, 0.18, 0.28, 0.32, T.accent2, x0 + 1.3, 1.0, z0 + 1.4);
  decal(root, 2.4, 1.5, mat(T.blankets[(id + 2) % T.blankets.length]), x0 + 2.5, 0.025, z0 + 5);
  // number plate on the back wall
  const plate = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = T.trim;
    roundRect(c, 8, 8, w - 16, h - 16, 28);
    c.fill();
    c.fillStyle = '#fff';
    c.font = `bold 76px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(100 + id), w / 2, h / 2 + 4);
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: plate, transparent: true }));
  p.position.set(x0 + 1.0, ROOM_H + 0.45, z0 + 0.5);
  p.rotation.x = -0.6;
  root.add(p);
}

/** A soda machine: red cabinet, glowing window with cans, and a slot at the bottom. */
function vendingMachine(root: THREE.Group, T: Theme, v: Vending) {
  const g = new THREE.Group();
  g.position.set(v.cell[0] + 0.5, 0, v.cell[1] + 0.5);
  g.rotation.y = v.face;
  box(g, 0.95, 1.9, 0.8, '#e53935', 0, 0, 0);
  box(g, 1.0, 0.12, 0.85, '#b71c1c', 0, 1.9, 0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.0), new THREE.MeshBasicMaterial({ color: '#e3f2fd' }));
  glass.position.set(-0.12, 1.15, 0.41);
  g.add(glass);
  const cans = ['#ffca28', '#43a047', '#1e88e5', '#8e24aa'];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 3; k++) {
      cyl(g, 0.06, 0.06, 0.2, cans[(row + k) % cans.length], -0.3 + k * 0.18, 0.75 + row * 0.32, 0.36, 8);
    }
  }
  box(g, 0.2, 0.6, 0.04, '#eeeeee', 0.3, 1.0, 0.41);
  box(g, 0.6, 0.18, 0.04, '#212121', 0, 0.25, 0.41);
  const sign = canvasTexture(256, 96, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.font = `bold 66px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('SODA', w / 2, h / 2 + 4);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
  s.position.set(0, 1.78, 0.41);
  g.add(s);
  void T;
  root.add(g);
}

function landForSale(root: THREE.Group, T: Theme, i: number, j: number) {
  const x0 = i * LOT, z0 = j * LOT;
  decal(root, LOT - 0.6, LOT - 0.6, toonMap(dashed('rgba(255,255,255,0.16)', 'rgba(255,255,255,0.95)')), x0 + LOT / 2, 0.012, z0 + LOT / 2);
  for (const [x, z] of [[x0 + 0.4, z0 + 0.4], [x0 + LOT - 0.4, z0 + 0.4], [x0 + 0.4, z0 + LOT - 0.4], [x0 + LOT - 0.4, z0 + LOT - 0.4]]) {
    cyl(root, 0.07, 0.07, 1.2, '#8d6e63', x, 0, z, 6);
    box(root, 0.45, 0.3, 0.04, T.accent2, x + 0.24, 0.85, z);
  }
}

function plant(root: THREE.Object3D, T: Theme, x: number, z: number, k = 1) {
  cyl(root, 0.32 * k, 0.26 * k, 0.55 * k, T.trim, x, 0, z);
  const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * k, 0), mat('#4caf50'));
  a.position.set(x, 0.95 * k, z);
  a.castShadow = true;
  const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * k, 0), mat('#66bb6a'));
  b2.position.set(x + 0.18 * k, 1.35 * k, z + 0.1);
  b2.castShadow = true;
  root.add(a, b2);
}

// ---------- outside ----------

function outside(root: THREE.Group, h: Hotel, T: Theme, reserved: Set<string>, b: ReturnType<typeof worldBounds>) {
  const rng = { seed: 1234 };
  const free = (x: number, z: number, pad = 2) => {
    for (const [dx, dz] of [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]]) {
      const i = Math.floor((x + dx) / LOT), j = Math.floor((z + dz) / LOT);
      if (reserved.has(lotKey(i, j))) return false;
    }
    if (Math.abs(x - ENTRANCE_X) < 3 && z > 10 && z < 24) return false; // the front path
    return true;
  };
  const scatter = (n: number, fn: (x: number, z: number, s: number) => void, zMax = 11) => {
    const x0 = b.x0 - 24, x1 = b.x1 + 24, z0 = b.z0 - 20;
    for (let k = 0; k < n; k++) {
      const x = x0 + nextRandom(rng) * (x1 - x0);
      const z = z0 + nextRandom(rng) * (zMax - z0);
      if (free(x, z)) fn(x, z, 0.8 + nextRandom(rng) * 0.5);
    }
  };
  const front = LOT; // z where the street row starts

  if (T.outside === 'beach') {
    decal(root, 400, 60, mat('#4cc3d9'), 0, -0.005, front + 40);
    decal(root, 400, 1.2, mat('#ffffff'), 0, 0.0, front + 10.4);
    for (let k = 0; k < 5; k++) decal(root, 2.4, 0.9, mat('#d7ccc8'), ENTRANCE_X, 0.02, front + 1 + k * 1.6);
    scatter(70, (x, z, s) => palm(root, x, z, s));
    for (let x = b.x0 - 20; x < b.x1 + 20; x += 9) {
      if (Math.abs(x - ENTRANCE_X) < 4) continue;
      const c = T.blankets[Math.abs(Math.round(x)) % T.blankets.length];
      cyl(root, 0.06, 0.06, 2.2, '#eeeeee', x, 0, front + 7);
      cone(root, 1.4, 0.6, c, x, 2.2, front + 7, 10);
      decal(root, 1.0, 2.0, mat(c), x + 1.3, 0.02, front + 7.4);
    }
  } else if (T.outside === 'city') {
    decal(root, 400, 7, mat('#4a5462'), 0, 0, front + 7.5);
    for (let x = Math.floor(b.x0 / 4) * 4 - 40; x < b.x1 + 40; x += 4) decal(root, 2, 0.3, mat('#f1f1f1'), x, 0.01, front + 7.5);
    decal(root, 400, 3.5, mat('#c4ccd6'), 0, 0.005, front + 1.75);
    for (let x = b.x0 - 20; x < b.x1 + 20; x += 10) {
      if (Math.abs(x - ENTRANCE_X) < 3) continue;
      cyl(root, 0.12, 0.16, 3.4, '#37474f', x, 0, front + 3.2);
      ball(root, 0.3, '#fff59d', x, 3.6, front + 3.2);
    }
    const carColors = ['#f2c14e', '#e4572e', '#4d908e', '#ffffff'];
    for (let x = b.x0 - 16, k = 0; x < b.x1 + 16; x += 13, k++) car(root, x, front + 6, carColors[k % carColors.length]);
    scatter(40, (x, z, s) => {
      const hgt = 3 + nextRandom(rng) * 8;
      box(root, 6 * s, hgt, 6 * s, ['#b0bec5', '#90a4ae', '#cfd8dc'][Math.floor(nextRandom(rng) * 3)], x, 0, z);
    }, -2);
    scatter(40, (x, z, s) => tree(root, x, z, s));
  } else {
    for (let k = 0; k < 5; k++) decal(root, 2.4, 0.9, mat('#b0bec5'), ENTRANCE_X, 0.02, front + 1 + k * 1.6);
    scatter(90, (x, z, s) => pine(root, x, z, s), front + 12);
    snowman(root, ENTRANCE_X + 5, front + 4);
  }
  void h;
}

function palm(root: THREE.Object3D, x: number, z: number, s: number) {
  for (let k = 0; k < 6; k++) cyl(root, 0.2 * s, 0.24 * s, 0.7 * s, k % 2 ? '#a1887f' : '#8d6e63', x + k * 0.08 * s, k * 0.68 * s, z, 8);
  for (let a = 0; a < 6; a++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 2.6 * s, 4), mat(a % 2 ? '#43a047' : '#66bb6a'));
    leaf.position.set(x + 0.5 * s + Math.cos(a) * 1.1 * s, 4.1 * s, z + Math.sin(a) * 1.1 * s);
    leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    leaf.castShadow = true;
    root.add(leaf);
  }
}

function pine(root: THREE.Object3D, x: number, z: number, s: number) {
  cyl(root, 0.25 * s, 0.3 * s, 0.8 * s, '#6d4c41', x, 0, z, 6);
  ([[1.6, 1.9, 0.6], [1.25, 1.7, 1.6], [0.85, 1.4, 2.5]] as const).forEach(([r, hgt, y], k) => {
    cone(root, r * s, hgt * s, k % 2 ? '#2e7d32' : '#388e3c', x, y * s, z, 7);
    cone(root, r * s * 0.5, hgt * s * 0.45, '#ffffff', x, y * s + hgt * s * 0.55, z, 7);
  });
}

function tree(root: THREE.Object3D, x: number, z: number, s: number) {
  cyl(root, 0.18 * s, 0.22 * s, 1.2 * s, '#6d4c41', x, 0, z, 6);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), mat('#66bb6a'));
  top.position.set(x, 2.0 * s, z);
  top.castShadow = true;
  root.add(top);
}

function car(root: THREE.Object3D, x: number, z: number, color: string) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  root.add(g);
  box(g, 4, 0.9, 1.9, color, 0, 0.3, 0);
  box(g, 2.2, 0.75, 1.7, color, -0.2, 1.2, 0);
  box(g, 2.0, 0.55, 1.75, '#bbdefb', -0.2, 1.3, 0);
  for (const [dx, dz] of [[-1.3, 0.95], [1.3, 0.95], [-1.3, -0.95], [1.3, -0.95]]) {
    const w = cyl(g, 0.42, 0.42, 0.3, '#263238', dx, 0, dz, 12);
    w.rotation.x = Math.PI / 2;
    w.position.y = 0.42;
  }
}

function snowman(root: THREE.Object3D, x: number, z: number) {
  ball(root, 0.8, '#ffffff', x, 0.8, z);
  ball(root, 0.55, '#ffffff', x, 2.0, z);
  ball(root, 0.38, '#ffffff', x, 2.85, z);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 8), mat('#ff7043'));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(x, 2.85, z + 0.45);
  root.add(nose);
}
