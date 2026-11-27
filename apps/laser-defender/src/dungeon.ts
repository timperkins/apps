import * as THREE from 'three';
import { Box, boxesGeometry } from './voxel';
import { torchGeometry } from './models';

export const WALL = 0, FLOOR = 1, PILLAR = 2;

export interface Room { x: number; z: number; w: number; h: number; cx: number; cz: number }

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const WALL_H = 1.0;

export class Dungeon {
  readonly w = 46;
  readonly h = 46;
  cells: Uint8Array;
  rooms: Room[] = [];
  group = new THREE.Group();
  flames: THREE.Mesh[] = [];
  torches: { x: number; z: number }[] = [];
  flow: Int16Array;
  private flowFrom = -1;
  private queue: Int32Array;

  constructor(private rng: Rng) {
    this.cells = new Uint8Array(this.w * this.h);
    this.flow = new Int16Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
    this.generate();
    this.build();
  }

  private ri(a: number, b: number) {
    return a + Math.floor(this.rng() * (b - a + 1));
  }

  private carve(x0: number, z0: number, x1: number, z1: number, v = FLOOR) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        if (x > 0 && z > 0 && x < this.w - 1 && z < this.h - 1) this.cells[z * this.w + x] = v;
  }

  private generate() {
    // Start room in the middle so enemies can come from every side.
    const start: Room = { x: 18, z: 18, w: 10, h: 10, cx: 23, cz: 23 };
    this.rooms.push(start);
    for (let tries = 0; tries < 400 && this.rooms.length < 10; tries++) {
      const w = this.ri(6, 12), h = this.ri(6, 12);
      const x = this.ri(2, this.w - w - 3), z = this.ri(2, this.h - h - 3);
      const ok = this.rooms.every((r) => x + w + 2 < r.x || r.x + r.w + 2 < x || z + h + 2 < r.z || r.z + r.h + 2 < z);
      if (ok) this.rooms.push({ x, z, w, h, cx: Math.floor(x + w / 2), cz: Math.floor(z + h / 2) });
    }
    for (const r of this.rooms) this.carve(r.x, r.z, r.x + r.w - 1, r.z + r.h - 1);
    // Connect each room to its nearest already-connected room, then add a few loops.
    const linked = [this.rooms[0]];
    const rest = this.rooms.slice(1);
    while (rest.length) {
      let best = 0, bestD = Infinity, bestTo = linked[0];
      rest.forEach((r, i) => {
        for (const l of linked) {
          const d = Math.abs(r.cx - l.cx) + Math.abs(r.cz - l.cz);
          if (d < bestD) { bestD = d; best = i; bestTo = l; }
        }
      });
      const r = rest.splice(best, 1)[0];
      this.corridor(r, bestTo);
      linked.push(r);
    }
    for (let i = 0; i < 3; i++) {
      const a = this.rooms[this.ri(0, this.rooms.length - 1)], b = this.rooms[this.ri(0, this.rooms.length - 1)];
      if (a !== b) this.corridor(a, b);
    }
    // Pillars in big rooms (not the start room's middle).
    for (const r of this.rooms) {
      if (r.w >= 9 && r.h >= 9) {
        for (const [px, pz] of [[r.x + 2, r.z + 2], [r.x + r.w - 3, r.z + 2], [r.x + 2, r.z + r.h - 3], [r.x + r.w - 3, r.z + r.h - 3]])
          this.cells[pz * this.w + px] = PILLAR;
      }
    }
  }

  private corridor(a: Room, b: Room) {
    const wide = this.rng() < 0.5 ? 1 : 0;
    if (this.rng() < 0.5) {
      this.carve(a.cx, a.cz, b.cx, a.cz + wide);
      this.carve(b.cx, a.cz, b.cx + wide, b.cz);
    } else {
      this.carve(a.cx, a.cz, a.cx + wide, b.cz);
      this.carve(a.cx, b.cz, b.cx, b.cz + wide);
    }
  }

  cell(x: number, z: number) {
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return WALL;
    return this.cells[z * this.w + x];
  }

  solid(x: number, z: number) {
    return this.cell(x, z) !== FLOOR;
  }

  solidAt(x: number, z: number) {
    return this.solid(Math.floor(x), Math.floor(z));
  }

  /** Push a circle out of walls. */
  collide(p: THREE.Vector3, r: number) {
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    for (let i = 0; i < 2; i++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let z = cz - 1; z <= cz + 1; z++) {
          if (!this.solid(x, z)) continue;
          const nx = Math.max(x, Math.min(p.x, x + 1));
          const nz = Math.max(z, Math.min(p.z, z + 1));
          const dx = p.x - nx, dz = p.z - nz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 < 1e-8) {
              // Centre inside the wall: push out along the shortest axis.
              p.x += p.x - (x + 0.5) > 0 ? r : -r;
              continue;
            }
            const d = Math.sqrt(d2);
            p.x += (dx / d) * (r - d);
            p.z += (dz / d) * (r - d);
          }
        }
      }
    }
  }

  /** Distance along a ray until a wall, up to max. */
  raycast(ox: number, oz: number, dx: number, dz: number, max: number) {
    const step = 0.08;
    for (let t = 0; t < max; t += step) if (this.solidAt(ox + dx * t, oz + dz * t)) return Math.max(0, t - step * 0.5);
    return max;
  }

  los(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax, dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return true;
    return this.raycast(ax, az, dx / d, dz / d, d) >= d - 0.05;
  }

  /** Breadth-first distance field from the player's cell, used to path enemies around walls. */
  updateFlow(px: number, pz: number) {
    const sx = Math.floor(px), sz = Math.floor(pz);
    const start = sz * this.w + sx;
    if (start === this.flowFrom) return;
    this.flowFrom = start;
    this.flow.fill(-1);
    let head = 0, tail = 0;
    this.flow[start] = 0;
    this.queue[tail++] = start;
    while (head < tail) {
      const i = this.queue[head++];
      const x = i % this.w, z = (i / this.w) | 0;
      const d = this.flow[i] + 1;
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
        if (this.solid(nx, nz)) continue;
        const j = nz * this.w + nx;
        if (this.flow[j] !== -1) continue;
        this.flow[j] = d;
        this.queue[tail++] = j;
      }
    }
  }

  flowAt(x: number, z: number) {
    if (this.solid(x, z)) return -1;
    return this.flow[z * this.w + x];
  }

  /** Next cell centre to walk towards to reach the player. */
  nextStep(px: number, pz: number, out: THREE.Vector3): boolean {
    const x = Math.floor(px), z = Math.floor(pz);
    let best = this.flowAt(x, z);
    if (best < 0) best = 1e9;
    let bx = -1, bz = -1;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        if (!ox && !oz) continue;
        const f = this.flowAt(x + ox, z + oz);
        if (f < 0) continue;
        if (ox && oz && (this.solid(x + ox, z) || this.solid(x, z + oz))) continue;
        if (f < best) { best = f; bx = x + ox; bz = z + oz; }
      }
    }
    if (bx < 0) return false;
    out.set(bx + 0.5, 0, bz + 0.5);
    return true;
  }

  /** A floor cell at least `min` path steps from the player. */
  spawnPoint(min: number, max: number): THREE.Vector3 | null {
    for (let tries = 0; tries < 300; tries++) {
      const x = this.ri(1, this.w - 2), z = this.ri(1, this.h - 2);
      const f = this.flowAt(x, z);
      if (f >= min && f <= max) return new THREE.Vector3(x + 0.5, 0, z + 0.5);
    }
    for (let tries = 0; tries < 300; tries++) {
      const x = this.ri(1, this.w - 2), z = this.ri(1, this.h - 2);
      if (this.flowAt(x, z) >= 6) return new THREE.Vector3(x + 0.5, 0, z + 0.5);
    }
    return null;
  }

  private nearFloor(x: number, z: number) {
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) if (this.cell(x + ox, z + oz) === FLOOR) return true;
    return false;
  }

  private build() {
    const rng = this.rng;
    // Torches on walls that face a floor cell.
    const { stick, flame } = torchGeometry();
    const stickMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    for (let z = 1; z < this.h - 1; z++) {
      for (let x = 1; x < this.w - 1; x++) {
        if (this.cell(x, z) !== WALL) continue;
        const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dz] of dirs) {
          if (this.cell(x + dx, z + dz) !== FLOOR) continue;
          if ((x * 7 + z * 13) % 9 !== 0 || rng() < 0.3) continue;
          if (this.torches.some((t) => Math.abs(t.x - x) + Math.abs(t.z - z) < 5)) continue;
          const tx = x + 0.5 + dx * 0.55, tz = z + 0.5 + dz * 0.55;
          this.torches.push({ x: tx, z: tz });
          const s = new THREE.Mesh(stick, stickMat);
          s.position.set(tx, WALL_H + 0.0, tz);
          const f = new THREE.Mesh(flame, flameMat);
          f.position.set(tx, WALL_H + 0.5, tz);
          f.userData.phase = rng() * 10;
          this.group.add(s, f);
          this.flames.push(f);
          break;
        }
      }
    }

    const warm = (x: number, z: number) => {
      let w = 0;
      for (const t of this.torches) {
        const d = Math.hypot(t.x - x, t.z - z);
        if (d < 6) w += (1 - d / 6) ** 2;
      }
      return Math.min(1, w);
    };

    // Floor
    const floorCells: number[] = [];
    const wallCells: number[] = [];
    const pillarCells: number[] = [];
    for (let z = 0; z < this.h; z++)
      for (let x = 0; x < this.w; x++) {
        const c = this.cell(x, z);
        if (c === FLOOR) floorCells.push(x, z);
        else if (c === PILLAR) pillarCells.push(x, z);
        else if (this.nearFloor(x, z)) wallCells.push(x, z);
      }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const warmCol = new THREE.Color(0xff9a40);

    const floorMat = new THREE.MeshLambertMaterial();
    const floor = new THREE.InstancedMesh(box, floorMat, floorCells.length / 2);
    for (let i = 0; i < floorCells.length; i += 2) {
      const x = floorCells[i], z = floorCells[i + 1];
      const hgt = 0.2 + (rng() < 0.12 ? 0.04 : 0);
      // Top face at y = 0, a few tiles sit a little proud for a hand-laid look.
      m.makeScale(1, hgt, 1).setPosition(x + 0.5, hgt - 0.2 - hgt / 2, z + 0.5);
      floor.setMatrixAt(i / 2, m);
      const r = rng();
      const base = r < 0.08 ? 0x4a5a3a : r < 0.2 ? 0x3b3a3e : (x + z) % 2 ? 0x55555c : 0x4d4d55;
      col.setHex(base).multiplyScalar(0.85 + rng() * 0.3);
      col.lerp(warmCol, warm(x + 0.5, z + 0.5) * 0.45);
      floor.setColorAt(i / 2, col);
    }
    floor.receiveShadow = true;
    this.group.add(floor);

    const wallMat = new THREE.MeshLambertMaterial();
    const walls = new THREE.InstancedMesh(box, wallMat, wallCells.length / 2 + pillarCells.length / 2);
    let wi = 0;
    const addWall = (x: number, z: number, h: number) => {
      m.makeScale(1, h, 1).setPosition(x + 0.5, h / 2, z + 0.5);
      walls.setMatrixAt(wi, m);
      const r = rng();
      col.setHex(r < 0.15 ? 0x56664a : r < 0.3 ? 0x4c4a52 : 0x6a6a74).multiplyScalar(0.8 + rng() * 0.3);
      col.lerp(warmCol, warm(x + 0.5, z + 0.5) * 0.35);
      walls.setColorAt(wi++, col);
    };
    for (let i = 0; i < wallCells.length; i += 2) addWall(wallCells[i], wallCells[i + 1], WALL_H + (rng() < 0.2 ? 0.2 : 0));
    for (let i = 0; i < pillarCells.length; i += 2) addWall(pillarCells[i], pillarCells[i + 1], 1.5);
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.group.add(walls);

    // Wall caps: a lighter voxel rim on top of each wall block.
    const caps = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), wallCells.length / 2);
    for (let i = 0; i < wallCells.length; i += 2) {
      const x = wallCells[i], z = wallCells[i + 1];
      m.makeScale(1.04, 0.14, 1.04).setPosition(x + 0.5, WALL_H + 0.07, z + 0.5);
      caps.setMatrixAt(i / 2, m);
      col.setHex(0x8a8a94).multiplyScalar(0.85 + rng() * 0.25);
      caps.setColorAt(i / 2, col);
    }
    caps.receiveShadow = true;
    this.group.add(caps);

    // Floor clutter: bones, skulls, rubble and cobwebs. No collision.
    const decor: Box[] = [];
    for (let i = 0; i < floorCells.length; i += 2) {
      const x = floorCells[i], z = floorCells[i + 1];
      if (Math.hypot(x - 23, z - 23) < 4) continue;
      const r = rng();
      const vx = x * 10 + 2 + rng() * 5, vz = z * 10 + 2 + rng() * 5;
      if (r < 0.035) {
        decor.push([vx, 0, vz, 4, 0.8, 1, 0xd6d0bd], [vx + 1.5, 0, vz - 1.5, 1, 0.8, 4, 0xd6d0bd]);
      } else if (r < 0.05) {
        decor.push([vx, 0, vz, 3, 2.6, 3, 0xd6d0bd], [vx + 0.4, 1.2, vz + 2.9, 0.8, 0.8, 0.2, 0x1e1a18], [vx + 1.8, 1.2, vz + 2.9, 0.8, 0.8, 0.2, 0x1e1a18]);
      } else if (r < 0.1) {
        for (let k = 0; k < 3; k++) decor.push([vx + rng() * 4, 0, vz + rng() * 4, 1.2 + rng(), 0.8 + rng(), 1.2 + rng(), 0x5e5e66]);
      } else if (r < 0.115) {
        decor.push([vx - 2, 0, vz - 2, 6, 5, 6, 0x7a5532], [vx - 2.1, 2, vz - 2.1, 6.2, 0.8, 6.2, 0x4a3420]);
      }
    }
    const dg = boxesGeometry(decor, [0, 0, 0], 0.1, 0.12);
    if (dg) {
      const dm = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ vertexColors: true }));
      dm.receiveShadow = true;
      dm.castShadow = true;
      this.group.add(dm);
    }
  }

  animate(t: number) {
    for (const f of this.flames) {
      const p = f.userData.phase as number;
      const s = 0.85 + Math.sin(t * 11 + p) * 0.1 + Math.sin(t * 23 + p * 2) * 0.06;
      f.scale.set(s, s * (0.9 + Math.sin(t * 17 + p) * 0.15), s);
    }
  }
}
