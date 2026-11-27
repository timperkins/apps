import * as THREE from 'three';
import { Sfx } from './audio';
import { Dungeon, makeRng } from './dungeon';
import { Fx } from './fx';
import { Input } from './input';
import { Rig, arrowMesh, heartMesh, playerRig, skeletonRig, spiderRig, zombieRig } from './models';

export type Kind = 'zombie' | 'spider' | 'skeleton' | 'brute';

interface KindDef { hp: number; speed: number; r: number; dmg: number; score: number }
const KINDS: Record<Kind, KindDef> = {
  zombie: { hp: 42, speed: 1.7, r: 0.45, dmg: 12, score: 10 },
  spider: { hp: 20, speed: 3.6, r: 0.5, dmg: 8, score: 15 },
  skeleton: { hp: 30, speed: 2.2, r: 0.38, dmg: 10, score: 20 },
  brute: { hp: 320, speed: 1.35, r: 0.8, dmg: 28, score: 120 },
};

interface Enemy {
  kind: Kind;
  rig: Rig;
  pos: THREE.Vector3;
  kx: number;
  kz: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  score: number;
  cd: number;
  stun: number;
  flash: number;
  rise: number;
  t: number;
  facing: number;
  state: 'walk' | 'draw' | 'crouch' | 'leap';
  stateT: number;
  lx: number;
  lz: number;
  hitDone: boolean;
  wobble: number;
}

interface Arrow { mesh: THREE.Mesh; x: number; z: number; dx: number; dz: number; life: number; dmg: number }
interface Heart { mesh: THREE.Group; x: number; z: number; t: number }
interface Pending { kind: Kind; x: number; z: number; t: number }

export interface Stats {
  laserDps: number;
  heatRate: number;
  pierce: number;
  boltDmg: number;
  boltChains: number;
  boltCd: number;
  maxHp: number;
  speed: number;
  dashCd: number;
  staticDash: boolean;
  thunder: boolean;
  leech: number;
}

export interface Upgrade { id: string; name: string; desc: string; icon: string; once?: boolean; apply: (g: Game) => void }

export const UPGRADES: Upgrade[] = [
  { id: 'lens', icon: '🔴', name: 'Focusing lens', desc: 'Laser damage +30%', apply: (g) => (g.stats.laserDps *= 1.3) },
  { id: 'sink', icon: '❄️', name: 'Heat sink', desc: 'Laser heats up 30% slower', apply: (g) => (g.stats.heatRate *= 0.7) },
  { id: 'prism', icon: '🔺', name: 'Splitting prism', desc: 'Laser burns through one more enemy', apply: (g) => g.stats.pierce++ },
  { id: 'coil', icon: '🌀', name: 'Storm coil', desc: 'Lightning jumps to 2 more enemies', apply: (g) => (g.stats.boltChains += 2) },
  { id: 'cap', icon: '🔋', name: 'Quick capacitor', desc: 'Lightning recharges 25% faster', apply: (g) => (g.stats.boltCd *= 0.75) },
  { id: 'volt', icon: '⚡', name: 'High voltage', desc: 'Lightning damage +40%', apply: (g) => (g.stats.boltDmg *= 1.4) },
  { id: 'plate', icon: '🛡️', name: 'Armour plating', desc: '+25 max health and a full heal', apply: (g) => { g.stats.maxHp += 25; g.hp = g.stats.maxHp; } },
  { id: 'boots', icon: '👢', name: 'Servo boots', desc: 'Move 12% faster, dash recharges sooner', apply: (g) => { g.stats.speed *= 1.12; g.stats.dashCd *= 0.8; } },
  { id: 'static', icon: '💨', name: 'Static dash', desc: 'Dashing shocks every enemy around you', once: true, apply: (g) => (g.stats.staticDash = true) },
  { id: 'thunder', icon: '💥', name: 'Thunderclap', desc: 'Lightning also blasts enemies standing near each target', once: true, apply: (g) => (g.stats.thunder = true) },
  { id: 'leech', icon: '❤️', name: 'Life siphon', desc: 'Every kill heals 2 health', apply: (g) => (g.stats.leech += 2) },
];

const baseStats = (): Stats => ({
  laserDps: 46, heatRate: 26, pierce: 0, boltDmg: 55, boltChains: 3, boltCd: 3.2,
  maxHp: 100, speed: 5, dashCd: 1.0, staticDash: false, thunder: false, leech: 0,
});

const PLAYER_R = 0.42;
const MUZZLE_Y = 1.2;
const RISE_T = 0.7;
const CAM_DIST = 13;
const CAM_H = 13.5;

export type State = 'title' | 'play' | 'pick' | 'pause' | 'dead';

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  sfx = new Sfx();
  fx: Fx;
  dungeon!: Dungeon;
  stats = baseStats();

  state: State = 'title';
  hp = 100;
  heat = 0;
  overheated = false;
  boltCd = 0;
  dashCd = 0;
  wave = 0;
  score = 0;
  kills = 0;
  hurtFlash = 0;
  picked: string[] = [];

  onPick: (choices: Upgrade[]) => void = () => {};
  onBanner: (text: string, sub?: string) => void = () => {};
  onGameOver: () => void = () => {};

  private player: Rig;
  private ppos = new THREE.Vector3();
  private facing = 0;
  private walkT = 0;
  private dashT = 0;
  private dashX = 0;
  private dashZ = 0;
  private invuln = 0;
  private heatIdle = 0;
  private firing = false;
  private aimX = 0;
  private aimZ = 1;
  private aimPoint: THREE.Vector3 | null = null;

  private enemies: Enemy[] = [];
  private arrows: Arrow[] = [];
  private hearts: Heart[] = [];
  private pending: Pending[] = [];
  private queue: Kind[] = [];
  private spawnTimer = 0;
  private clearT = -1;
  private deadT = 0;

  private camTarget = new THREE.Vector3();
  private camAngle = Math.PI / 4;
  private shake = 0;
  private time = 0;
  private hitSoundT = 0;

  private sun: THREE.DirectionalLight;
  private playerLight: THREE.PointLight;
  private laserLight: THREE.PointLight;
  private boltLight: THREE.PointLight;
  private beamCore: THREE.Mesh;
  private beamGlow: THREE.Mesh;
  private beamTip: THREE.Mesh;
  private arrowProto = arrowMesh();
  private heartProto = heartMesh();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MUZZLE_Y);
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private muzzle = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, public input: Input) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    const bg = 0x07080e;
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(bg, 20, 40);
    this.scene.add(new THREE.HemisphereLight(0x8aa0d8, 0x3a2a20, 1.3));
    this.sun = new THREE.DirectionalLight(0xc8d4ff, 1.6);
    this.sun.castShadow = true;
    const small = Math.min(innerWidth, innerHeight) < 700;
    this.sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -16;
    sc.right = sc.top = 16;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.playerLight = new THREE.PointLight(0x5af2ff, 6, 6, 1.4);
    this.laserLight = new THREE.PointLight(0xff3355, 0, 6, 1.4);
    this.boltLight = new THREE.PointLight(0xa8dcff, 0, 16, 1.2);
    this.scene.add(this.playerLight, this.laserLight, this.boltLight);

    this.fx = new Fx(this.scene);

    const unit = new THREE.BoxGeometry(1, 1, 1);
    this.beamCore = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0xffe0e6, toneMapped: false }));
    this.beamGlow = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0xff2448, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.beamTip = new THREE.Mesh(unit, this.beamGlow.material);
    this.beamCore.visible = this.beamGlow.visible = this.beamTip.visible = false;
    this.scene.add(this.beamCore, this.beamGlow, this.beamTip);

    this.player = playerRig();
    this.scene.add(this.player.root);
    this.newDungeon();
    this.resize();
  }

  private newDungeon() {
    if (this.dungeon) this.scene.remove(this.dungeon.group);
    this.dungeon = new Dungeon(makeRng((Math.random() * 1e9) | 0));
    this.scene.add(this.dungeon.group);
    const s = this.dungeon.rooms[0];
    this.ppos.set(s.cx + 0.5, 0, s.cz + 0.5);
    this.camTarget.copy(this.ppos);
    this.dungeon.updateFlow(this.ppos.x, this.ppos.z);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- run lifecycle ----------------

  start() {
    for (const e of this.enemies) this.removeEnemy(e);
    this.enemies = [];
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows = [];
    for (const h of this.hearts) this.scene.remove(h.mesh);
    this.hearts = [];
    this.pending = [];
    this.queue = [];
    this.newDungeon();
    this.stats = baseStats();
    this.picked = [];
    this.hp = this.stats.maxHp;
    this.heat = 0;
    this.overheated = false;
    this.boltCd = 0;
    this.dashCd = 0;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.player.root.visible = true;
    this.camAngle = Math.PI / 4;
    this.input.reset();
    this.state = 'play';
    this.nextWave();
  }

  private nextWave() {
    this.wave++;
    const n = this.wave;
    const q: Kind[] = [];
    const zombies = 4 + n * 2;
    const spiders = n >= 2 ? 2 + (n - 2) * 2 : 0;
    const skels = n >= 3 ? 1 + Math.floor((n - 3) * 1.5) : 0;
    for (let i = 0; i < zombies; i++) q.push('zombie');
    for (let i = 0; i < spiders; i++) q.push('spider');
    for (let i = 0; i < skels; i++) q.push('skeleton');
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    if (n % 5 === 0) for (let i = 0; i < n / 5; i++) q.push('brute');
    this.queue = q;
    this.spawnTimer = 1.6;
    this.clearT = -1;
    this.onBanner(`Wave ${n}`, n % 5 === 0 ? 'A brute is coming' : n === 2 ? 'Spiders!' : n === 3 ? 'Skeleton archers' : undefined);
    this.sfx.wave();
  }

  choose(u: Upgrade) {
    u.apply(this);
    this.picked.push(u.id);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.25);
    this.sfx.upgrade();
    this.state = 'play';
    this.nextWave();
  }

  private rollUpgrades(): Upgrade[] {
    const pool = UPGRADES.filter((u) => !(u.once && this.picked.includes(u.id)));
    const out: Upgrade[] = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }

  get remaining() {
    return this.queue.length + this.pending.length + this.enemies.length;
  }

  get dashReady() {
    return this.dashCd <= 0;
  }

  // ---------------- frame ----------------

  frame(dt: number) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    if (this.state === 'play') this.update(dt);
    else if (this.state === 'dead') {
      this.deadT += dt;
      this.updateEnemies(dt);
      this.fx.update(dt);
      if (this.deadT > 1.8 && this.deadT - dt <= 1.8) this.onGameOver();
    } else if (this.state === 'title') {
      this.camAngle += dt * 0.12;
      this.animatePlayer(dt, 0, false);
      this.fx.update(dt);
    }
    this.dungeon.animate(this.time);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private camVectors() {
    const a = this.camAngle;
    return { fx: -Math.sin(a), fz: -Math.cos(a), rx: Math.cos(a), rz: -Math.sin(a) };
  }

  private update(dt: number) {
    const inp = this.input;
    const { fx, fz, rx, rz } = this.camVectors();

    // ---- movement
    const m = inp.readMove();
    let mx = rx * m.x - fx * m.y;
    let mz = rz * m.x - fz * m.y;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    if (inp.takeDash() && this.dashCd <= 0) {
      let dx = mx, dz = mz;
      if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(this.facing); dz = Math.cos(this.facing); }
      const l = Math.hypot(dx, dz);
      this.dashX = dx / l;
      this.dashZ = dz / l;
      this.dashT = 0.18;
      this.dashCd = this.stats.dashCd;
      this.invuln = Math.max(this.invuln, 0.3);
      this.sfx.dash();
      if (this.stats.staticDash) this.staticShock();
    }
    this.dashCd -= dt;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.ppos.x += this.dashX * 15 * dt;
      this.ppos.z += this.dashZ * 15 * dt;
      this.fx.glows.spawn(this.ppos.x, 0.6 + Math.random() * 0.8, this.ppos.z, 0, 0, 0, 0.3, 0.18, 0x5af2ff);
    } else {
      const sp = this.stats.speed * (this.firing ? 0.8 : 1);
      this.ppos.x += mx * sp * dt;
      this.ppos.z += mz * sp * dt;
    }
    this.dungeon.collide(this.ppos, PLAYER_R);
    this.dungeon.updateFlow(this.ppos.x, this.ppos.z);

    // ---- aim
    this.aimPoint = null;
    if (inp.touchAim) {
      const ax = rx * inp.touchAim.x - fx * inp.touchAim.y;
      const az = rz * inp.touchAim.x - fz * inp.touchAim.y;
      const l = Math.hypot(ax, az);
      this.aimX = ax / l;
      this.aimZ = az / l;
      this.assistAim();
    } else if (inp.mouseSeen && !inp.touch) {
      const ndc = new THREE.Vector2((inp.mouseX / innerWidth) * 2 - 1, -(inp.mouseY / innerHeight) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const hit = this.ray.ray.intersectPlane(this.plane, this.v);
      if (hit) {
        const dx = hit.x - this.ppos.x, dz = hit.z - this.ppos.z;
        const l = Math.hypot(dx, dz);
        if (l > 0.05) { this.aimX = dx / l; this.aimZ = dz / l; }
        this.aimPoint = hit.clone();
      }
    } else if (ml > 0.1) {
      this.aimX = mx / ml;
      this.aimZ = mz / ml;
    }

    this.firing = inp.firing() && !this.overheated;
    const wantFace = this.firing || (inp.mouseSeen && !inp.touch) ? Math.atan2(this.aimX, this.aimZ) : ml > 0.1 ? Math.atan2(mx, mz) : this.facing;
    this.facing = turn(this.facing, wantFace, dt * (this.firing ? 30 : 14));

    this.animatePlayer(dt, this.dashT > 0 ? 1.6 : ml, this.firing);

    // ---- laser
    this.updateLaser(dt);

    // ---- lightning
    this.boltCd -= dt;
    if (inp.takeBolt()) this.castBolt();

    // ---- world
    this.updateSpawns(dt);
    this.updateEnemies(dt);
    this.updateArrows(dt);
    this.updateHearts(dt);
    this.fx.update(dt);

    this.invuln -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    this.player.mat.emissive.setRGB(this.invuln > 0 && this.dashT <= 0 && Math.sin(this.time * 40) > 0 ? 0.5 : 0, 0, 0);

    const bl = this.boltLight;
    bl.intensity = Math.max(0, bl.intensity - dt * 120);

    // ---- wave clear
    if (this.remaining === 0) {
      if (this.clearT < 0) {
        this.clearT = 0;
        this.onBanner(`Wave ${this.wave} cleared`);
      }
      this.clearT += dt;
      if (this.clearT > 1.6) {
        this.state = 'pick';
        this.firing = false;
        this.sfx.laser(false);
        this.hideBeam();
        this.onPick(this.rollUpgrades());
      }
    }
  }

  private assistAim() {
    // Nudge touch aim onto an enemy that's nearly in line.
    let best: Enemy | null = null, bestA = 0.22;
    for (const e of this.enemies) {
      if (e.rise > 0.3) continue;
      const dx = e.pos.x - this.ppos.x, dz = e.pos.z - this.ppos.z;
      const d = Math.hypot(dx, dz);
      if (d > 14 || d < 0.3) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * this.aimX + dz * this.aimZ) / d)));
      if (a < bestA && this.dungeon.los(this.ppos.x, this.ppos.z, e.pos.x, e.pos.z)) { bestA = a; best = e; }
    }
    if (best) {
      const dx = best.pos.x - this.ppos.x, dz = best.pos.z - this.ppos.z;
      const d = Math.hypot(dx, dz);
      this.aimX = dx / d;
      this.aimZ = dz / d;
    }
  }

  private animatePlayer(dt: number, speed: number, firing: boolean) {
    const r = this.player;
    r.root.position.copy(this.ppos);
    r.root.rotation.y = this.facing;
    if (speed > 0.05) this.walkT += dt * (6 + speed * 6);
    const sw = Math.sin(this.walkT) * 0.7 * Math.min(1, speed);
    r.legL!.rotation.x = sw;
    r.legR!.rotation.x = -sw;
    r.armL!.rotation.x = -sw * 0.8;
    r.body.position.y = Math.abs(Math.cos(this.walkT)) * 0.06 * Math.min(1, speed);
    const armTarget = firing ? -Math.PI / 2 : sw * 0.8;
    r.armR!.rotation.x += (armTarget - r.armR!.rotation.x) * Math.min(1, dt * 25);
    r.head!.rotation.y = Math.sin(this.time * 0.7) * 0.08;
    this.playerLight.position.set(this.ppos.x, 1.6, this.ppos.z);
  }

  private hideBeam() {
    this.beamCore.visible = this.beamGlow.visible = this.beamTip.visible = false;
    this.laserLight.intensity = 0;
  }

  private updateLaser(dt: number) {
    const s = this.stats;
    if (this.firing) {
      this.heat += s.heatRate * dt;
      this.heatIdle = 0;
      if (this.heat >= 100) {
        this.heat = 100;
        this.overheated = true;
        this.firing = false;
        this.sfx.overheat();
        this.fx.sparks(this.ppos.x, 1.2, this.ppos.z, 0xffffff, 14, 3);
      }
    } else {
      this.heatIdle += dt;
      if (this.heatIdle > 0.25 || this.overheated) this.heat = Math.max(0, this.heat - (this.overheated ? 45 : 38) * dt);
      if (this.overheated && this.heat <= 20) this.overheated = false;
    }
    this.sfx.laser(this.firing, this.heat);
    if (!this.firing) {
      this.hideBeam();
      return;
    }

    this.player.root.updateMatrixWorld(true);
    this.player.muzzle!.getWorldPosition(this.muzzle);
    const ox = this.muzzle.x, oz = this.muzzle.z;
    let dx = this.aimX, dz = this.aimZ;
    if (this.aimPoint) {
      const ax = this.aimPoint.x - ox, az = this.aimPoint.z - oz;
      const al = Math.hypot(ax, az);
      if (al > 1.2) { dx = ax / al; dz = az / al; }
    }
    // Don't start the beam inside a wall when hugging one.
    const startBlocked = this.dungeon.solidAt(ox, oz);
    const wall = startBlocked ? 0 : this.dungeon.raycast(ox, oz, dx, dz, 22);
    const hits: { e: Enemy; t: number }[] = [];
    for (const e of this.enemies) {
      if (e.rise > RISE_T * 0.6) continue;
      const cx = e.pos.x - ox, cz = e.pos.z - oz;
      const t = cx * dx + cz * dz;
      if (t < -e.r) continue;
      const p2 = cx * cx + cz * cz - t * t;
      const rr = e.r * 1.15;
      if (p2 > rr * rr) continue;
      const th = Math.max(0, t - Math.sqrt(rr * rr - p2));
      if (th < wall) hits.push({ e, t: th });
    }
    hits.sort((a, b) => a.t - b.t);
    let end = wall;
    const n = Math.min(hits.length, 1 + s.pierce);
    for (let i = 0; i < n; i++) {
      const { e, t } = hits[i];
      this.damage(e, s.laserDps * dt, dx * 0.8, dz * 0.8);
      if (Math.random() < dt * 20) this.fx.sparks(ox + dx * t, MUZZLE_Y, oz + dz * t, 0xff5a70, 2, 4);
      if (i === n - 1 && n === 1 + s.pierce) end = t;
    }
    if (hits.length && (this.hitSoundT -= dt) <= 0) {
      this.sfx.hit();
      this.hitSoundT = 0.09;
    }
    const ex = ox + dx * end, ez = oz + dz * end;
    const y = this.muzzle.y;
    const flick = 0.85 + Math.random() * 0.3;
    for (const [mesh, w] of [[this.beamCore, 0.06], [this.beamGlow, 0.2 * flick]] as const) {
      mesh.visible = true;
      mesh.position.set((ox + ex) / 2, y, (oz + ez) / 2);
      mesh.lookAt(ex, y, ez);
      mesh.scale.set(w, w, Math.max(0.01, end));
    }
    this.beamTip.visible = true;
    this.beamTip.position.set(ex, y, ez);
    this.beamTip.rotation.set(this.time * 9, this.time * 7, 0);
    this.beamTip.scale.setScalar(0.35 * flick);
    this.laserLight.position.set(ex - dx * 0.4, y, ez - dz * 0.4);
    this.laserLight.intensity = 10 * flick;
    if (Math.random() < dt * 30) this.fx.sparks(ex, y, ez, 0xff8090, 1, 3);
  }

  private castBolt() {
    if (this.boltCd > 0) return;
    const s = this.stats;
    this.player.root.updateMatrixWorld(true);
    this.player.muzzle!.getWorldPosition(this.muzzle);
    const origin = this.muzzle.clone();
    const range = 10;
    let first: Enemy | null = null, bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.rise > RISE_T * 0.6) continue;
      const dx = e.pos.x - this.ppos.x, dz = e.pos.z - this.ppos.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * this.aimX + dz * this.aimZ) / Math.max(d, 0.01))));
      const score = d * (1 + a * 1.6) + (a > 1.1 ? 8 : 0);
      if (score < bestScore && this.dungeon.los(this.ppos.x, this.ppos.z, e.pos.x, e.pos.z)) { bestScore = score; first = e; }
    }
    this.sfx.zap();
    this.shake = Math.max(this.shake, 0.18);
    if (!first) {
      // Nothing to hit: crack the floor ahead, short cooldown.
      const d = this.dungeon.raycast(this.ppos.x, this.ppos.z, this.aimX, this.aimZ, 6);
      const p = new THREE.Vector3(this.ppos.x + this.aimX * d, 0.05, this.ppos.z + this.aimZ * d);
      this.fx.bolt(origin, p);
      this.fx.bolt(p.clone().add(new THREE.Vector3(0.3, 9, -0.2)), p, 0x9ad8ff, 0.09);
      this.fx.sparks(p.x, 0.2, p.z, 0xbfe6ff, 16, 5);
      this.fx.ring(p.x, p.z, 0x9ad8ff, 1.5);
      this.flashBolt(p);
      this.boltCd = 0.6;
      return;
    }
    const chain: Enemy[] = [first];
    let cur = first;
    for (let i = 0; i < s.boltChains; i++) {
      let next: Enemy | null = null, bd = 5.5;
      for (const e of this.enemies) {
        if (chain.includes(e) || e.rise > RISE_T * 0.6) continue;
        const d = e.pos.distanceTo(cur.pos);
        if (d < bd && this.dungeon.los(cur.pos.x, cur.pos.z, e.pos.x, e.pos.z)) { bd = d; next = e; }
      }
      if (!next) break;
      chain.push(next);
      cur = next;
    }
    let from = origin;
    const top = new THREE.Vector3(first.pos.x + 0.4, 10, first.pos.z - 0.3);
    const firstHit = new THREE.Vector3(first.pos.x, 0.9, first.pos.z);
    this.fx.bolt(top, firstHit, 0xb8e4ff, 0.1, 0.3);
    chain.forEach((e, i) => {
      const to = new THREE.Vector3(e.pos.x, 0.8 + (e.kind === 'spider' ? -0.3 : 0.2), e.pos.z);
      this.fx.bolt(from, to, 0x9ad8ff, i === 0 ? 0.08 : 0.06);
      this.fx.sparks(to.x, to.y, to.z, 0xcfeeff, 10, 5);
      this.fx.ring(to.x, to.z, 0x9ad8ff, 1.2);
      const dmg = s.boltDmg * (i === 0 ? 1 : 0.85);
      const kd = Math.hypot(e.pos.x - from.x, e.pos.z - from.z) || 1;
      e.stun = Math.max(e.stun, 0.7);
      this.damage(e, dmg, ((e.pos.x - from.x) / kd) * 4, ((e.pos.z - from.z) / kd) * 4);
      if (s.thunder) {
        this.fx.ring(to.x, to.z, 0xffffff, 2.2, 0.35);
        for (const o of this.enemies) {
          if (o === e || chain.includes(o)) continue;
          const d = o.pos.distanceTo(e.pos);
          if (d < 2.2) this.damage(o, dmg * 0.5, ((o.pos.x - e.pos.x) / d) * 5, ((o.pos.z - e.pos.z) / d) * 5);
        }
      }
      from = to;
    });
    this.flashBolt(firstHit);
    this.boltCd = s.boltCd;
  }

  private staticShock() {
    let any = false;
    for (const e of this.enemies) {
      if (e.rise > RISE_T * 0.6) continue;
      const d = Math.hypot(e.pos.x - this.ppos.x, e.pos.z - this.ppos.z);
      if (d > 3) continue;
      any = true;
      this.fx.bolt(new THREE.Vector3(this.ppos.x, 1, this.ppos.z), new THREE.Vector3(e.pos.x, 0.8, e.pos.z), 0x5af2ff, 0.05, 0.18);
      e.stun = Math.max(e.stun, 0.4);
      this.damage(e, 22, ((e.pos.x - this.ppos.x) / (d || 1)) * 5, ((e.pos.z - this.ppos.z) / (d || 1)) * 5);
    }
    if (any) {
      this.fx.ring(this.ppos.x, this.ppos.z, 0x5af2ff, 3, 0.35);
      this.sfx.zap();
    }
  }

  private flashBolt(p: THREE.Vector3) {
    this.boltLight.position.set(p.x, 2.5, p.z);
    this.boltLight.intensity = 40;
  }

  // ---------------- enemies ----------------

  private updateSpawns(dt: number) {
    this.spawnTimer -= dt;
    const maxAlive = Math.min(40, 10 + this.wave * 2);
    if (this.spawnTimer <= 0 && this.queue.length && this.enemies.length + this.pending.length < maxAlive) {
      const group = Math.min(this.queue.length, 1 + Math.floor(Math.random() * Math.min(4, 1 + this.wave / 2)));
      const p = this.dungeon.spawnPoint(11, 26);
      if (p) {
        for (let i = 0; i < group; i++) {
          const kind = this.queue.shift()!;
          let x = p.x + (Math.random() - 0.5) * 1.6, z = p.z + (Math.random() - 0.5) * 1.6;
          if (this.dungeon.solidAt(x, z)) { x = p.x; z = p.z; }
          this.pending.push({ kind, x, z, t: 0.9 });
          this.fx.ring(x, z, kind === 'brute' ? 0xff4422 : 0x9b5cff, kind === 'brute' ? 2 : 1, 0.9);
        }
        this.sfx.spawn();
      }
      this.spawnTimer = Math.max(0.35, 1.5 - this.wave * 0.08);
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (Math.random() < dt * 25) this.fx.glows.spawn(p.x + (Math.random() - 0.5), 0.1, p.z + (Math.random() - 0.5), 0, 1.5, 0, 0.6, 0.1, 0xa070ff);
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        this.spawnEnemy(p.kind, p.x, p.z);
      }
    }
  }

  private spawnEnemy(kind: Kind, x: number, z: number) {
    const def = KINDS[kind];
    const rig = kind === 'spider' ? spiderRig() : kind === 'skeleton' ? skeletonRig() : zombieRig(kind === 'brute');
    const hpScale = 1 + (this.wave - 1) * 0.09;
    const e: Enemy = {
      kind, rig, pos: rig.root.position, kx: 0, kz: 0,
      hp: def.hp * hpScale, maxHp: def.hp * hpScale, r: def.r,
      speed: def.speed * (0.9 + Math.random() * 0.2) * (1 + Math.min(0.3, this.wave * 0.02)),
      dmg: def.dmg, score: def.score, cd: 0.5 + Math.random(), stun: 0, flash: 0, rise: RISE_T,
      t: Math.random() * 10, facing: Math.atan2(this.ppos.x - x, this.ppos.z - z), state: 'walk', stateT: 0,
      lx: 0, lz: 0, hitDone: false, wobble: Math.random() * 10,
    };
    e.pos.set(x, -1.6, z);
    rig.root.rotation.y = e.facing;
    this.scene.add(rig.root);
    this.enemies.push(e);
    this.fx.burst(x, 0, z, [0x3b3a3e, 0x55555c], 8, 2, 0.1);
  }

  private removeEnemy(e: Enemy) {
    this.scene.remove(e.rig.root);
    e.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    e.rig.mat.dispose();
  }

  private damage(e: Enemy, amount: number, kx: number, kz: number) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.flash = 1;
    const heavy = e.kind === 'brute' ? 0.15 : 1;
    e.kx += kx * heavy;
    e.kz += kz * heavy;
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy) {
    const big = e.kind === 'brute';
    this.fx.burst(e.pos.x, big ? 0.6 : 0.2, e.pos.z, e.rig.palette, big ? 60 : e.kind === 'spider' ? 18 : 24, big ? 6 : 4, big ? 0.24 : 0.14);
    this.fx.sparks(e.pos.x, 0.8, e.pos.z, 0xffffff, 6, 4);
    this.sfx.die(big);
    this.kills++;
    this.score += Math.round(e.score * (1 + (this.wave - 1) * 0.1));
    if (this.stats.leech) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.leech);
    if (big || Math.random() < 0.09) this.dropHeart(e.pos.x, e.pos.z);
    if (big) this.shake = Math.max(this.shake, 0.4);
    this.removeEnemy(e);
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  private updateEnemies(dt: number) {
    const px = this.ppos.x, pz = this.ppos.z;
    const alive = this.state === 'play';
    const step = this.v2;
    for (const e of this.enemies) {
      e.t += dt;
      const rig = e.rig;
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 8);
        rig.mat.emissive.setRGB(e.flash, e.flash * (e.stun > 0 ? 1 : 0.8), e.flash * (e.stun > 0 ? 1.2 : 0.8));
      }
      if (e.rise > 0) {
        e.rise -= dt;
        e.pos.y = -1.6 * Math.max(0, e.rise / RISE_T) ** 2 * (e.kind === 'spider' ? 0.7 : 1);
        if (Math.random() < dt * 20) this.fx.chunks.spawn(e.pos.x, 0.05, e.pos.z, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, 0.6, 0.08, 0x4d4d55);
        continue;
      }
      const dx = px - e.pos.x, dz = pz - e.pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      let vx = 0, vz = 0;
      let face = Math.atan2(dx, dz);
      let moving = 0;

      if (e.stun > 0) {
        e.stun -= dt;
        rig.root.rotation.z = Math.sin(e.t * 50) * 0.06;
        if (Math.random() < dt * 8) this.fx.sparks(e.pos.x, 0.9, e.pos.z, 0x9ad8ff, 1, 2);
      } else if (alive) {
        rig.root.rotation.z = 0;
        const seen = dist < 12 && this.dungeon.los(e.pos.x, e.pos.z, px, pz);
        // Path direction: straight at the player when visible, otherwise follow the flow field.
        let tx = dx / dist, tz = dz / dist;
        if (!seen && this.dungeon.nextStep(e.pos.x, e.pos.z, step)) {
          const sx = step.x - e.pos.x, sz = step.z - e.pos.z;
          const sl = Math.hypot(sx, sz) || 1;
          tx = sx / sl;
          tz = sz / sl;
        }
        e.cd -= dt;
        if (e.kind === 'zombie' || e.kind === 'brute') {
          vx = tx * e.speed;
          vz = tz * e.speed;
          moving = 1;
          if (dist < e.r + PLAYER_R + 0.3 && e.cd <= 0) {
            e.cd = e.kind === 'brute' ? 1.5 : 1.1;
            e.stateT = 0.25;
            this.hurt(e.dmg, dx / dist, dz / dist);
          }
          if (e.stateT > 0) {
            e.stateT -= dt;
            vx *= 0.2; vz *= 0.2;
          }
          if (!seen) face = Math.atan2(tx, tz);
        } else if (e.kind === 'spider') {
          if (e.state === 'walk') {
            const zig = Math.sin(e.t * 3 + e.wobble) * 0.6;
            vx = (tx - tz * zig) * e.speed;
            vz = (tz + tx * zig) * e.speed;
            moving = 1;
            face = Math.atan2(vx, vz);
            if (seen && dist < 4.5 && e.cd <= 0) {
              e.state = 'crouch';
              e.stateT = 0.3;
            }
          } else if (e.state === 'crouch') {
            e.stateT -= dt;
            rig.body.position.y = -0.08;
            if (e.stateT <= 0) {
              e.state = 'leap';
              e.stateT = 0.38;
              e.lx = dx / dist;
              e.lz = dz / dist;
              e.hitDone = false;
            }
          } else {
            e.stateT -= dt;
            vx = e.lx * 10;
            vz = e.lz * 10;
            face = Math.atan2(e.lx, e.lz);
            rig.body.position.y = Math.sin((1 - e.stateT / 0.38) * Math.PI) * 0.8;
            if (!e.hitDone && dist < e.r + PLAYER_R + 0.2) {
              e.hitDone = true;
              this.hurt(e.dmg, e.lx, e.lz);
            }
            if (e.stateT <= 0) {
              e.state = 'walk';
              rig.body.position.y = 0;
              e.cd = 1.8 + Math.random() * 1.2;
            }
          }
          if (e.state === 'walk' && dist < e.r + PLAYER_R + 0.2 && e.cd <= 0.8) {
            e.cd = 1.3;
            this.hurt(e.dmg * 0.6, dx / dist, dz / dist);
          }
        } else {
          // Skeleton archer: keep distance, draw, loose.
          if (e.state === 'draw') {
            e.stateT -= dt;
            if (e.stateT <= 0) {
              e.state = 'walk';
              e.cd = 2.2 + Math.random() * 0.9;
              if (seen) this.shootArrow(e, dx / dist, dz / dist);
            }
          } else if (seen && dist < 11) {
            const strafe = Math.sin(e.t * 0.9 + e.wobble) > 0 ? 1 : -1;
            const away = dist < 4.5 ? -1 : dist > 8 ? 1 : 0;
            vx = (tx * away - tz * strafe * 0.6) * e.speed;
            vz = (tz * away + tx * strafe * 0.6) * e.speed;
            moving = 1;
            if (e.cd <= 0) {
              e.state = 'draw';
              e.stateT = 0.6;
            }
          } else {
            vx = tx * e.speed;
            vz = tz * e.speed;
            moving = 1;
            face = Math.atan2(tx, tz);
          }
        }
      }

      e.pos.x += (vx + e.kx) * dt;
      e.pos.z += (vz + e.kz) * dt;
      const decay = Math.pow(0.002, dt);
      e.kx *= decay;
      e.kz *= decay;
      e.pos.y = 0;
      e.facing = turn(e.facing, face, dt * 8);
      rig.root.rotation.y = e.facing;

      // Animation
      const sp = moving ? Math.hypot(vx, vz) : 0;
      if (rig.legs) {
        const k = e.t * (8 + sp * 3);
        rig.legs.forEach((l, i) => {
          const ph = k + (i % 2 ? Math.PI : 0) + (i >= 4 ? Math.PI / 2 : 0);
          l.rotation.y = (l.userData.baseY as number) + Math.sin(ph) * 0.35 * Math.min(1, sp);
          l.rotation.z = Math.max(0, Math.cos(ph)) * 0.25 * Math.min(1, sp) * (i < 4 ? 1 : -1);
        });
      } else {
        const k = e.t * (3 + sp * 2.6);
        const sw = Math.sin(k) * 0.6 * Math.min(1, sp);
        rig.legL!.rotation.x = sw;
        rig.legR!.rotation.x = -sw;
        if (e.kind === 'skeleton') {
          const drawing = e.state === 'draw';
          rig.armL!.rotation.x = drawing ? -Math.PI / 2 : -1.2 + sw * 0.3;
          rig.armR!.rotation.x = drawing ? -Math.PI / 2 + 0.2 : -sw * 0.8;
          rig.armR!.rotation.z = drawing ? -0.5 : 0;
          rig.head!.rotation.z = Math.sin(e.t * 7) * 0.05;
        } else {
          const lunge = e.stateT > 0 ? -0.5 : 0;
          rig.armL!.rotation.x = -1.35 + Math.sin(k * 0.5) * 0.12 + lunge;
          rig.armR!.rotation.x = -1.35 - Math.sin(k * 0.5) * 0.12 + lunge;
          rig.head!.rotation.z = Math.sin(e.t * 1.3 + e.wobble) * 0.12;
        }
        rig.body.position.y = Math.abs(Math.cos(k)) * 0.04 * Math.min(1, sp);
      }
    }

    // Separation, then walls.
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.rise > 0) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.rise > 0) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const wa = a.kind === 'brute' ? 0.1 : 1, wb = b.kind === 'brute' ? 0.1 : 1;
          a.pos.x -= (dx / d) * push * wa; a.pos.z -= (dz / d) * push * wa;
          b.pos.x += (dx / d) * push * wb; b.pos.z += (dz / d) * push * wb;
        }
      }
      // Don't stand inside the player.
      if (alive) {
        const dx = a.pos.x - px, dz = a.pos.z - pz;
        const min = a.r + PLAYER_R;
        const d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) {
          a.pos.x = px + (dx / d) * min;
          a.pos.z = pz + (dz / d) * min;
        }
      }
      this.dungeon.collide(a.pos, a.r);
    }
  }

  private shootArrow(e: Enemy, dx: number, dz: number) {
    const mesh = this.arrowProto.clone();
    const x = e.pos.x + dx * 0.5, z = e.pos.z + dz * 0.5;
    mesh.position.set(x, 1.05, z);
    mesh.lookAt(x + dx, 1.05, z + dz);
    this.scene.add(mesh);
    this.arrows.push({ mesh, x, z, dx, dz, life: 3, dmg: e.dmg });
    this.sfx.bow();
  }

  private updateArrows(dt: number) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.x += a.dx * 12 * dt;
      a.z += a.dz * 12 * dt;
      a.life -= dt;
      a.mesh.position.set(a.x, 1.05, a.z);
      let gone = a.life <= 0;
      if (this.dungeon.solidAt(a.x, a.z)) {
        this.fx.sparks(a.x, 1, a.z, 0xd8c8a0, 4, 2);
        gone = true;
      } else if (Math.hypot(a.x - this.ppos.x, a.z - this.ppos.z) < PLAYER_R + 0.15) {
        if (this.invuln <= 0) {
          this.hurt(a.dmg, a.dx, a.dz);
          gone = true;
        }
      }
      if (gone) {
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  private dropHeart(x: number, z: number) {
    const mesh = this.heartProto.clone();
    mesh.position.set(x, 0.6, z);
    this.scene.add(mesh);
    this.hearts.push({ mesh, x, z, t: 0 });
  }

  private updateHearts(dt: number) {
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.t += dt;
      const dx = this.ppos.x - h.x, dz = this.ppos.z - h.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.5 && this.hp < this.stats.maxHp) {
        h.x += (dx / d) * dt * 7;
        h.z += (dz / d) * dt * 7;
      }
      h.mesh.position.set(h.x, 0.6 + Math.sin(h.t * 3) * 0.12, h.z);
      h.mesh.rotation.y = h.t * 2;
      h.mesh.visible = h.t < 15 || Math.sin(h.t * 20) > 0;
      if (d < 0.6 && this.hp < this.stats.maxHp) {
        this.hp = Math.min(this.stats.maxHp, this.hp + 20);
        this.sfx.pickup();
        this.fx.sparks(h.x, 0.8, h.z, 0xff6070, 12, 3);
        this.scene.remove(h.mesh);
        this.hearts.splice(i, 1);
      } else if (h.t > 18) {
        this.scene.remove(h.mesh);
        this.hearts.splice(i, 1);
      }
    }
  }

  private hurt(dmg: number, dx: number, dz: number) {
    if (this.invuln > 0 || this.state !== 'play') return;
    this.hp -= dmg;
    this.invuln = 0.55;
    this.hurtFlash = 1;
    this.shake = Math.max(this.shake, 0.3);
    this.ppos.x += dx * 0.35;
    this.ppos.z += dz * 0.35;
    this.sfx.hurt();
    this.fx.sparks(this.ppos.x, 1, this.ppos.z, 0xff3040, 8, 3);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dead';
      this.deadT = 0;
      this.firing = false;
      this.sfx.laser(false);
      this.sfx.gameOver();
      this.hideBeam();
      this.player.root.visible = false;
      this.fx.burst(this.ppos.x, 0.4, this.ppos.z, this.player.palette, 40, 5, 0.16);
      const best = Number(localStorage.getItem('ld-best') || 0);
      if (this.score > best) localStorage.setItem('ld-best', String(this.score));
    }
  }

  private updateCamera(dt: number) {
    this.camTarget.lerp(this.ppos, 1 - Math.pow(0.0005, dt));
    const portrait = this.camera.aspect < 1;
    const zoom = portrait ? Math.min(2.1, 1 / Math.pow(this.camera.aspect, 0.8)) : 1;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 20 * zoom;
    fog.far = 40 * zoom;
    const a = this.camAngle;
    const t = this.camTarget;
    this.camera.position.set(t.x + Math.sin(a) * CAM_DIST * zoom * 0.7071, t.y + CAM_H * zoom, t.z + Math.cos(a) * CAM_DIST * zoom * 0.7071);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      const s = this.shake * this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(t.x, t.y + 0.5, t.z);
    this.sun.position.set(t.x + 5, 18, t.z + 9);
    this.sun.target.position.copy(t);
  }

  togglePause() {
    if (this.state === 'play') {
      this.state = 'pause';
      this.sfx.laser(false);
      this.hideBeam();
    } else if (this.state === 'pause') {
      this.state = 'play';
      this.input.reset();
    }
  }
}

function turn(from: number, to: number, k: number) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}
