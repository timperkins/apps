import * as THREE from 'three';

const unit = new THREE.BoxGeometry(1, 1, 1);

/** A pool of voxel cubes. Chunks fall and bounce; glows float and fade. */
class Pool {
  mesh: THREE.InstancedMesh;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size: Float32Array;
  private spin: Float32Array;
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(n: number, mat: THREE.Material, private gravity: number, private drag: number) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(unit, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.setHex(0xffffff));
    }
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.spin[i] = Math.random() * 6;
    this.mesh.setColorAt(i, this.c.setHex(color));
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number) {
    const drag = Math.pow(this.drag, dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      this.vel[k + 1] -= this.gravity * dt;
      this.vel[k] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const sz = this.size[i];
      if (this.gravity > 0 && this.pos[k + 1] < sz / 2) {
        this.pos[k + 1] = sz / 2;
        this.vel[k + 1] *= -0.35;
        this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6;
        this.spin[i] *= 0.5;
      }
      const f = this.life[i] / this.max[i];
      const scale = this.gravity > 0 ? sz * Math.min(1, f * 4) : sz * f;
      this.spin[i] += dt * 3;
      this.q.setFromEuler(this.e.set(this.spin[i], this.spin[i] * 0.7, 0));
      this.m.compose(this.p.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]), this.q, this.s.set(scale, scale, scale));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Bolt { group: THREE.Group; life: number; max: number; mats: THREE.MeshBasicMaterial[] }
interface Ring { mesh: THREE.Mesh; life: number; max: number; grow: number }

export class Fx {
  chunks: Pool;
  glows: Pool;
  private bolts: Bolt[] = [];
  private rings: Ring[] = [];
  private ringGeo = new THREE.RingGeometry(0.85, 1, 32);

  constructor(private scene: THREE.Scene) {
    this.chunks = new Pool(500, new THREE.MeshLambertMaterial(), 16, 0.6);
    this.chunks.mesh.castShadow = true;
    this.glows = new Pool(
      600,
      new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
      -0.5,
      0.15,
    );
    scene.add(this.chunks.mesh, this.glows.mesh);
  }

  burst(x: number, y: number, z: number, palette: number[], n: number, power = 4, size = 0.14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.4 + Math.random());
      this.chunks.spawn(
        x + (Math.random() - 0.5) * 0.5, y + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.5,
        Math.cos(a) * s, 3 + Math.random() * power, Math.sin(a) * s,
        1.2 + Math.random() * 0.8, size * (0.6 + Math.random() * 0.8), palette[i % palette.length],
      );
    }
  }

  sparks(x: number, y: number, z: number, color: number, n: number, speed = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      this.glows.spawn(x, y, z, Math.cos(a) * s, (Math.random() - 0.3) * speed, Math.sin(a) * s, 0.25 + Math.random() * 0.3, 0.06 + Math.random() * 0.07, color);
    }
  }

  ring(x: number, z: number, color: number, radius: number, life = 0.4, y = 0.05) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(radius * 0.2);
    this.scene.add(mesh);
    this.rings.push({ mesh, life, max: life, grow: radius });
  }

  /** A jagged electric arc between a and b. */
  bolt(a: THREE.Vector3, b: THREE.Vector3, color = 0x9ad8ff, width = 0.07, life = 0.22) {
    const group = new THREE.Group();
    const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const len = a.distanceTo(b);
    const segs = Math.max(3, Math.round(len / 0.45));
    const pts: THREE.Vector3[] = [a.clone()];
    const dir = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    for (let i = 1; i < segs; i++) {
      const p = a.clone().lerp(b, i / segs);
      const amp = Math.min(0.35, len * 0.08);
      p.addScaledVector(side, (Math.random() - 0.5) * 2 * amp).addScaledVector(up, (Math.random() - 0.5) * 2 * amp);
      pts.push(p);
    }
    pts.push(b.clone());
    const mid = new THREE.Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const l = p0.distanceTo(p1);
      mid.addVectors(p0, p1).multiplyScalar(0.5);
      for (const [mat, w] of [[core, width], [glow, width * 3.2]] as const) {
        const s = new THREE.Mesh(unit, mat);
        s.position.copy(mid);
        s.lookAt(p1);
        s.scale.set(w, w, l + w);
        group.add(s);
      }
      // Occasional fork
      if (Math.random() < 0.18) {
        const f = p1.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.9));
        const s = new THREE.Mesh(unit, glow);
        s.position.addVectors(p1, f).multiplyScalar(0.5);
        s.lookAt(f);
        s.scale.set(width * 1.5, width * 1.5, p1.distanceTo(f));
        group.add(s);
      }
    }
    this.scene.add(group);
    this.bolts.push({ group, life, max: life, mats: [core, glow] });
  }

  update(dt: number) {
    this.chunks.update(dt);
    this.glows.update(dt);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      const f = Math.max(0, b.life / b.max);
      b.mats[0].opacity = f > 0.5 ? 1 : f * 2;
      b.mats[1].opacity = 0.55 * f * (0.6 + Math.random() * 0.4);
      if (b.life <= 0) {
        this.scene.remove(b.group);
        b.mats.forEach((m) => m.dispose());
        this.bolts.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const f = 1 - r.life / r.max;
      r.mesh.scale.setScalar(r.grow * (0.2 + 0.8 * Math.sqrt(f)));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - f;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
  }
}
