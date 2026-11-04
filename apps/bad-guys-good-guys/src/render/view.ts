import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HALF_VIEW, ITEMS, type EnemyKind, type ItemKind } from '../core/config';
import type { Look } from '../core/look';
import type { Fx } from '../core/sim';
import type { EnemySnap, KidSnap, Snapshot } from '../core/snapshot';
import { pose, poseEnemy } from './animate';
import { Rig, adultRig, kidSpec } from './person';
import { GRIP, buildProp } from './props';
import { buildWorld } from './world';
import { canvasTex } from './materials';

const ENEMY_TOOL: Record<EnemyKind, string> = { lunch: 'ladle', dad: 'spatula', coach: 'clipboard', guard: 'stopsign', watch: 'purse', cop: 'baton', boss: 'ruler' };
const FACE_ANGLE = 0.8;

interface KidView {
  rig: Rig;
  snap: KidSnap;
  x: number;
  y: number;
  z: number;
  face: number;
  walk: number;
  t: number;
  held: THREE.Group | null;
  heldKind: string;
  heldHand: number;
  shadow: THREE.Mesh;
}

interface EnemyView {
  rig: Rig;
  snap: EnemySnap;
  x: number;
  z: number;
  face: number;
  walk: number;
  t: number;
  tool: THREE.Group;
  toolHand: number;
  shadow: THREE.Mesh;
}

interface ThingView {
  obj: THREE.Group;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  spin: number;
  ring?: THREE.Mesh;
}

interface Particle {
  m: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  spin: number;
}

const TILT_SHIFT = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - 0.5);
      float amt = smoothstep(0.26, 0.56, d) * 2.6;
      vec4 c = texture2D(tDiffuse, vUv);
      if (amt > 0.01) {
        vec4 acc = vec4(0.); float tot = 0.;
        for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++) {
          vec2 o = vec2(float(i),float(j)) * amt / res;
          float w = 1.0 - length(vec2(i,j))/3.2;
          acc += texture2D(tDiffuse, vUv+o)*w; tot += w;
        }
        c = acc/tot;
      }
      c.rgb = mix(c.rgb, c.rgb*vec3(1.03,1.0,0.96), 0.6);
      float v = smoothstep(0.95, 0.35, length(vUv-0.5));
      c.rgb *= mix(0.9, 1.0, v);
      gl_FragColor = c;
    }`,
};

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.5, 300);
  private composer: EffectComposer;
  private tilt: ShaderPass;
  private sun: THREE.DirectionalLight;
  private kids = new Map<number, KidView>();
  private enemies = new Map<number, EnemyView>();
  private projs = new Map<number, ThingView>();
  private pickups = new Map<number, ThingView>();
  private particles: Particle[] = [];
  private looks = new Map<number, Look>();
  private camX = HALF_VIEW;
  private camTarget = HALF_VIEW;
  private shake = 0;
  private time = 0;
  private shadowTex: THREE.Texture;
  private dist = 30;
  last: Snapshot | null = null;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);

    const sky = canvasTex(16, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#7fb3e0');
      g.addColorStop(0.55, '#b9d6ee');
      g.addColorStop(1, '#f3e7d3');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(0xe6f0fa, 40, 110);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

    this.scene.add(new THREE.HemisphereLight(0xcadcff, 0xa08060, 0.75));
    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -8, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 5;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xffe6d0, 0.6);
    fill.position.set(8, 4, 10);
    this.scene.add(fill);

    buildWorld(this.scene);

    this.shadowTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.tilt = new ShaderPass(TILT_SHIFT);
    this.composer.addPass(this.tilt);
    this.composer.addPass(new OutputPass());
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = this.host.clientWidth || innerWidth;
    const h = this.host.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.tilt.uniforms.res.value.set(w * pr, h * pr);
    const aspect = Math.max(1.25, w / h);
    this.camera.aspect = w / h;
    // Fit the walkable width of the screen, whatever the shape of the window.
    const want = HALF_VIEW * 2 + 1.6;
    this.dist = want / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    this.camera.updateProjectionMatrix();
  }

  setLooks(looks: Map<number, Look>): void {
    for (const [id, look] of looks) {
      const old = this.looks.get(id);
      if (old && JSON.stringify(old) !== JSON.stringify(look)) {
        const kv = this.kids.get(id);
        if (kv) {
          this.scene.remove(kv.rig.root, kv.shadow);
          this.kids.delete(id);
        }
      }
    }
    this.looks = new Map(looks);
  }

  private blob(r: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 1.3), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    return m;
  }

  /** Takes the newest snapshot. Returns its events so the HUD can show them too. */
  apply(s: Snapshot, snapInstantly = false): Fx[] {
    this.last = s;
    this.camTarget = s.cam;
    if (snapInstantly) this.camX = s.cam;
    const seen = new Set<number>();
    for (const k of s.kids) {
      seen.add(k.id);
      let v = this.kids.get(k.id);
      if (!v) {
        const look = this.looks.get(k.id);
        if (!look) continue;
        const rig = new Rig(kidSpec(look));
        this.scene.add(rig.root);
        v = { rig, snap: k, x: k.x, y: k.y, z: k.z, face: k.f, walk: 0, t: 0, held: null, heldKind: '', heldHand: -1, shadow: this.blob(0.45) };
        this.kids.set(k.id, v);
      }
      if (v.snap.s !== k.s || v.snap.a !== k.a || Math.abs(k.st - v.t) > 0.12 || k.st < v.t) v.t = k.st;
      v.snap = k;
    }
    for (const [id, v] of this.kids) if (!seen.has(id)) {
      this.scene.remove(v.rig.root, v.shadow);
      this.kids.delete(id);
    }

    seen.clear();
    for (const e of s.en) {
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        const rig = adultRig(e.k);
        this.scene.add(rig.root);
        const tool = buildProp(ENEMY_TOOL[e.k]);
        v = { rig, snap: e, x: e.x, z: e.z, face: e.f, walk: 0, t: 0, tool, toolHand: -1, shadow: this.blob(e.k === 'boss' ? 1.0 : 0.6) };
        this.enemies.set(e.id, v);
      }
      if (v.snap.s !== e.s || Math.abs(e.st - v.t) > 0.12 || e.st < v.t) v.t = e.st;
      v.snap = e;
    }
    for (const [id, v] of this.enemies) if (!seen.has(id)) {
      this.scene.remove(v.rig.root, v.shadow);
      this.enemies.delete(id);
    }

    this.syncThings(this.projs, s.pr.map((p) => ({ id: p.id, k: p.k, x: p.x, y: p.y, z: p.z })), true);
    this.syncThings(this.pickups, s.pk.map((p) => ({ id: p.id, k: p.k, x: p.x, y: 0, z: p.z })), false);

    for (const ev of s.ev) this.effect(ev);
    return s.ev;
  }

  private syncThings(map: Map<number, ThingView>, list: { id: number; k: string; x: number; y: number; z: number }[], flying: boolean): void {
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      let v = map.get(p.id);
      if (!v) {
        const obj = buildProp(p.k);
        if (!flying && (p.k === 'bat' || p.k === 'noodle' || p.k === 'finger' || p.k === 'confetti')) obj.rotation.z = Math.PI / 2;
        this.scene.add(obj);
        v = { obj, x: p.x, y: p.y, z: p.z, tx: p.x, ty: p.y, tz: p.z, spin: flying ? 8 : 0 };
        if (!flying && ITEMS[p.k as ItemKind]?.rare) {
          v.ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75 }));
          v.ring.rotation.x = -Math.PI / 2;
          this.scene.add(v.ring);
        }
        map.set(p.id, v);
      }
      v.tx = p.x;
      v.ty = p.y;
      v.tz = p.z;
    }
    for (const [id, v] of map) if (!seen.has(id)) {
      this.scene.remove(v.obj);
      if (v.ring) this.scene.remove(v.ring);
      map.delete(id);
    }
  }

  private effect(ev: Fx): void {
    switch (ev.t) {
      case 'hit':
        this.burst(ev.x, ev.y, ev.z, ev.big ? 14 : 7, ['#ffffff', '#ffe27a', '#ffb05a'], 0.06);
        if (ev.big) this.shake = Math.max(this.shake, 0.18);
        break;
      case 'splat': {
        const cols: Record<string, string[]> = { potato: ['#f4ead0'], burger: ['#6a3a22', '#e09a45'], balloons: ['#8fd0ff', '#ffffff'], confettiShot: ['#ff4a3d', '#ffd23f', '#3a9aff', '#2fd17a'] };
        this.burst(ev.x, ev.y, ev.z, 10, cols[ev.kind] ?? ['#d8d0c0'], 0.07);
        break;
      }
      case 'ko': {
        const e = this.enemies.get(ev.id);
        if (e) this.burst(e.x, 1.0, e.z, 12, ['#ffffff', '#ffd23f'], 0.07);
        this.shake = Math.max(this.shake, 0.12);
        break;
      }
      case 'won':
        this.burst(this.camX, 3, 0, 80, ['#ff4a3d', '#ffd23f', '#3a9aff', '#2fd17a', '#ff5fb0'], 0.09, 8);
        break;
      case 'revive':
      case 'heal': {
        const k = this.kids.get(ev.id);
        if (k) this.burst(k.x, 1.2, k.z, 12, ['#7fff9a', '#ffffff'], 0.06);
        break;
      }
    }
  }

  private burst(x: number, y: number, z: number, n: number, cols: string[], size: number, power = 4): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size * 0.3), new THREE.MeshBasicMaterial({ color: cols[i % cols.length] }));
      m.position.set(x, y, z);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.4 + Math.random() * 0.8);
      this.particles.push({ m, vx: Math.cos(a) * sp, vy: 2 + Math.random() * power, vz: Math.sin(a) * sp * 0.6, life: 0, max: 0.5 + Math.random() * 0.5, spin: Math.random() * 10 });
    }
  }

  render(dt: number): void {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 14);
    this.camX += (this.camTarget - this.camX) * (1 - Math.exp(-dt * 5));

    for (const v of this.kids.values()) this.updateKid(v, dt, k);
    for (const v of this.enemies.values()) this.updateEnemy(v, dt, k);
    for (const v of this.projs.values()) {
      v.x += (v.tx - v.x) * k * 1.4;
      v.y += (v.ty - v.y) * k * 1.4;
      v.z += (v.tz - v.z) * k * 1.4;
      v.obj.position.set(v.x, v.y, v.z);
      v.obj.rotation.x += dt * v.spin;
      v.obj.rotation.z += dt * v.spin * 0.6;
    }
    for (const v of this.pickups.values()) {
      v.x = v.tx;
      v.z = v.tz;
      v.obj.position.set(v.x, 0.18 + Math.sin(this.time * 3 + v.x) * 0.05, v.z);
      v.obj.rotation.y += dt * 1.2;
      if (v.ring) {
        v.ring.position.set(v.x, 0.03, v.z);
        const s = 1 + Math.sin(this.time * 4) * 0.1;
        v.ring.scale.set(s, s, s);
      }
    }
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      p.vy -= 14 * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y = Math.max(0.02, p.m.position.y + p.vy * dt);
      p.m.position.z += p.vz * dt;
      p.m.rotation.x += p.spin * dt;
      p.m.rotation.y += p.spin * dt;
      if (p.life > p.max) {
        this.scene.remove(p.m);
        p.m.geometry.dispose();
        return false;
      }
      return true;
    });

    // Camera: tilted down about 18 degrees, distance chosen to fit the play area.
    this.shake = Math.max(0, this.shake - dt);
    const sx = (Math.random() - 0.5) * this.shake * 0.6;
    const sy = (Math.random() - 0.5) * this.shake * 0.6;
    const pitch = THREE.MathUtils.degToRad(17);
    const tx = this.camX;
    const ty = 1.0;
    const tz = -0.4;
    this.camera.position.set(tx + sx, ty + Math.sin(pitch) * this.dist + sy, tz + Math.cos(pitch) * this.dist);
    this.camera.lookAt(tx + sx, ty + sy, tz);
    this.sun.position.set(tx - 8, 14, 12);
    this.sun.target.position.set(tx, 0, -1);
    this.composer.render(dt);
  }

  private updateKid(v: KidView, dt: number, k: number): void {
    const s = v.snap;
    const dx = s.x - v.x;
    v.x += dx * k;
    v.y += (s.y - v.y) * k * 1.3;
    v.z += (s.z - v.z) * k;
    v.t += dt;
    if (s.m) v.walk += dt * 11;
    v.face += (s.f * FACE_ANGLE - v.face) * (1 - Math.exp(-dt * 16));
    const r = v.rig.root;
    r.position.set(v.x, v.y, v.z);
    r.rotation.y = v.face;
    const blink = s.inv && s.s !== 'down' && Math.floor(this.time * 14) % 2 === 0;
    r.visible = !blink;
    pose(v.rig, { state: s.stun ? 'hurt' : s.s, attack: s.a, t: v.t, len: s.sl, moving: !!s.m, walkPhase: v.walk, face: s.f, air: s.y > 0.05, time: this.time + s.id });
    v.shadow.position.set(v.x, 0.03, v.z);
    const sc = 1 - Math.min(0.5, v.y * 0.25);
    v.shadow.scale.set(sc, sc, sc);
    // Held item in the hand nearer the camera.
    const hand = s.f > 0 ? 0 : 1;
    if (s.h !== v.heldKind) {
      if (v.held) v.held.parent?.remove(v.held);
      v.held = s.h ? buildProp(s.h) : null;
      v.heldKind = s.h;
      v.heldHand = -1;
    }
    if (v.held && v.heldHand !== hand) {
      v.rig.hands[hand].add(v.held);
      const gr = GRIP[s.h] ?? [1.4, 0, 0];
      v.held.rotation.set(gr[0], gr[1], gr[2]);
      v.heldHand = hand;
    }
  }

  private updateEnemy(v: EnemyView, dt: number, k: number): void {
    const s = v.snap;
    const moving = Math.abs(s.x - v.x) > 0.01 || Math.abs(s.z - v.z) > 0.01;
    v.x += (s.x - v.x) * k;
    v.z += (s.z - v.z) * k;
    v.t += dt;
    if ((s.s === 'walk' || s.s === 'enter') && moving) v.walk += dt * (s.k === 'boss' ? 6 : 9);
    v.face += (s.f * FACE_ANGLE - v.face) * (1 - Math.exp(-dt * 10));
    const r = v.rig.root;
    r.position.set(v.x, 0, v.z);
    r.rotation.y = v.face;
    if (s.s === 'down') r.visible = v.t < 1.1 || Math.floor(v.t * 16) % 2 === 0;
    else r.visible = true;
    poseEnemy(v.rig, { state: s.s, t: v.t, len: s.sl, moving: (s.s === 'walk' || s.s === 'enter') && moving, walkPhase: v.walk, face: s.f, time: this.time + s.id });
    if (s.fl) r.position.x += Math.sin(this.time * 90) * 0.04;
    v.shadow.position.set(v.x, 0.03, v.z);
    v.shadow.visible = r.visible;
    const hand = s.f > 0 ? 0 : 1;
    if (v.toolHand !== hand) {
      v.rig.hands[hand].add(v.tool);
      v.tool.rotation.set(s.k === 'guard' ? 1.5 : 1.4, 0, 0);
      if (s.k === 'guard') v.tool.position.y = -0.3;
      v.toolHand = hand;
    }
  }

  /** Screen position of a world point, in CSS pixels. */
  project(x: number, y: number, z: number): { x: number; y: number; on: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, on: v.z < 1 };
  }

  kidPos(id: number): { x: number; y: number; z: number; top: number } | null {
    const v = this.kids.get(id);
    return v ? { x: v.x, y: v.y, z: v.z, top: v.rig.height + v.y } : null;
  }

  enemyPos(id: number): { x: number; z: number; top: number } | null {
    const v = this.enemies.get(id);
    return v ? { x: v.x, z: v.z, top: v.rig.height } : null;
  }

  pickupPos(id: number): { x: number; z: number } | null {
    const v = this.pickups.get(id);
    return v ? { x: v.x, z: v.z } : null;
  }
}

/** Renders a kid's head and shoulders to an image for the HUD and lobby. */
export function portrait(look: Look, size = 96): string {
  const r = getPortraitRenderer(size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x886655, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1, 2, 3);
  scene.add(key);
  const rig = new Rig(kidSpec(look));
  scene.add(rig.root);
  rig.root.rotation.y = 0.35;
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  cam.position.set(0.25, rig.headY + 0.05, 1.5);
  cam.lookAt(0, rig.headY - 0.02, 0);
  r.render(scene, cam);
  return r.domElement.toDataURL();
}

let portraitRenderer: THREE.WebGLRenderer | null = null;
function getPortraitRenderer(size: number): THREE.WebGLRenderer {
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  portraitRenderer.setPixelRatio(2);
  portraitRenderer.setSize(size, size, false);
  return portraitRenderer;
}
