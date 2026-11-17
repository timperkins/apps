// North Pole Village: the world and everything that happens in it (no drawing, no input).

export const T = 40; // tile size in pixels
export const W = 80; // world width in tiles
export const H = 60; // world height in tiles
export type Dir = 0 | 1 | 2 | 3; // right, down, left, up
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export type Item = 'stick' | 'arrow';
export type Kind = 'fence' | 'tower' | 'belt' | 'grabber' | 'machine' | 'sticks' | 'base';
export type Tool = 'crossbow' | 'fence' | 'tower' | 'belt' | 'grabber';
export const TOOLS: Tool[] = ['crossbow', 'fence', 'tower', 'belt', 'grabber'];

export const PRICES = { tower: 250, belt: 10, grabber: 60, villager: 10000 };
export const MEAT_PRICE = 50;
export const TREES_FOR_BASE = 30;
export const FIRST_BEARS = 120; // seconds after the base
export const WAVE_GAP = 50;
export const TOWER_MAX = 100;
export const TOWER_RANGE = 270;
export const STICK_MAX = 50;
export const MACHINE_IN_MAX = 50;
export const MACHINE_OUT_MAX = 200;
export const PLAYER_MAX_HP = 100;

// The village: player starts here, the base goes here, sticks and the arrow machine are "in the back" (north).
export const HOME = { x: 40, y: 34 }; // tile
export const BASE_TILE = { x: 39, y: 33, w: 3, h: 3 };
export const STICKS_TILE = { x: 37, y: 28, w: 2, h: 2 };
export const MACHINE_TILE = { x: 41, y: 28, w: 2, h: 2 };

export interface Obj {
  id: number;
  kind: Kind;
  x: number; // tile
  y: number;
  w: number;
  h: number;
  dir: Dir;
  arrows: number; // tower ammo
  cool: number;
  aim: number; // tower aim angle
  held: Item | null; // grabber hand
  swing: number; // grabber animation 0..1
  carry: { item: Item; p: number } | null; // belt item, p = 0..1 along the tile
  sIn: number; // machine sticks in
  aOut: number; // machine arrows out
  prog: number; // machine progress
}

export interface Tree {
  x: number; // tile
  y: number;
  hp: number;
  regrow: number; // > 0 while it's a stump
  shake: number;
  target: boolean; // a villager is going for it
  size: number;
}

export interface Bear {
  x: number;
  y: number;
  hp: number;
  max: number;
  ang: number;
  cool: number;
  wiggle: number;
  wigAng: number;
  hurt: number;
  step: number;
}

export interface Villager {
  x: number;
  y: number;
  color: string;
  jack: boolean; // bought villagers chop trees for you
  state: 'idle' | 'walk' | 'rescue' | 'carry' | 'toTree' | 'chop' | 'home';
  tx: number;
  ty: number;
  timer: number;
  tree: number;
  wood: number;
  step: number;
  face: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface Meat {
  x: number;
  y: number;
  n: number;
  t: number;
}

export interface Player {
  x: number;
  y: number;
  dir: Dir;
  aim: number;
  hp: number;
  down: boolean;
  hurt: number;
  swing: number;
  step: number;
  shootCool: number;
  actCool: number;
}

export interface Inv {
  wood: number;
  sticks: number;
  arrows: number;
  meat: number;
  gold: number;
  tower: number;
  belt: number;
  grabber: number;
}

export type Sound = 'chop' | 'fall' | 'shoot' | 'hit' | 'growl' | 'hurt' | 'coin' | 'place' | 'pop' | 'base' | 'wave' | 'heal' | 'no';

export interface Fx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  text?: string;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VILLAGER_COLORS = ['#3b82c4', '#e0a526', '#7a4fb8', '#2e9e6a', '#d9567a', '#e07b2e', '#4aa8b8', '#8c6a4a'];

export class Game {
  objs = new Map<number, Obj>();
  occ: (Obj | null)[] = new Array(W * H).fill(null);
  trees: Tree[] = [];
  treeAt = new Int32Array(W * H).fill(-1);
  bears: Bear[] = [];
  villagers: Villager[] = [];
  shots: Shot[] = [];
  meats: Meat[] = [];
  fx: Fx[] = [];
  p: Player;
  inv: Inv = { wood: 0, sticks: 0, arrows: 15, meat: 0, gold: 0, tower: 0, belt: 0, grabber: 0 };
  chopped = 0;
  hasBase = false;
  bearTimer = 0; // counts down to the next wave once the base exists
  wave = 0;
  kills = 0;
  time = 0;
  nextId = 1;
  sounds: Sound[] = [];
  toasts: string[] = [];
  banner = '';
  bannerT = 0;
  rand = rng(Date.now());

  constructor(seed = 7) {
    const r = rng(seed);
    this.p = { x: (HOME.x + 0.5) * T, y: (HOME.y + 3.5) * T, dir: 3, aim: -Math.PI / 2, hp: PLAYER_MAX_HP, down: false, hurt: 0, swing: 0, step: 0, shootCool: 0, actCool: 0 };
    this.addObj('sticks', STICKS_TILE.x, STICKS_TILE.y, 0);
    this.addObj('machine', MACHINE_TILE.x, MACHINE_TILE.y, 0);
    // forest: thick at the edges, a clearing around the village
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const d = Math.hypot(x - HOME.x, (y - HOME.y) * 1.2);
        if (d < 8) continue;
        const chance = d < 12 ? 0.08 : d < 20 ? 0.16 : 0.24;
        if (r() < chance && !this.occ[y * W + x]) this.addTree(x, y, 0.85 + r() * 0.35);
      }
    this.addVillager(false);
    this.addVillager(false);
  }

  addTree(x: number, y: number, size: number) {
    this.treeAt[y * W + x] = this.trees.length;
    this.trees.push({ x, y, hp: 4, regrow: 0, shake: 0, target: false, size });
  }

  addVillager(jack: boolean) {
    const n = this.villagers.length;
    const a = n * 2.1;
    this.villagers.push({
      x: (HOME.x + 0.5 + Math.cos(a) * 3) * T,
      y: (HOME.y + 1.5 + Math.sin(a) * 2) * T,
      color: VILLAGER_COLORS[n % VILLAGER_COLORS.length],
      jack,
      state: 'idle',
      tx: 0,
      ty: 0,
      timer: 1 + n,
      tree: -1,
      wood: 0,
      step: 0,
      face: 0,
    });
  }

  addObj(kind: Kind, x: number, y: number, dir: Dir): Obj {
    const size = kind === 'base' ? 3 : kind === 'machine' || kind === 'sticks' ? 2 : 1;
    const o: Obj = { id: this.nextId++, kind, x, y, w: size, h: size, dir, arrows: 0, cool: 0, aim: -Math.PI / 2, held: null, swing: 0, carry: null, sIn: 0, aOut: 0, prog: 0 };
    this.objs.set(o.id, o);
    for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) this.occ[(y + j) * W + x + i] = o;
    return o;
  }

  removeObj(o: Obj) {
    this.objs.delete(o.id);
    for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) this.occ[(o.y + j) * W + o.x + i] = null;
  }

  at(x: number, y: number): Obj | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return this.occ[y * W + x];
  }

  standingTree(x: number, y: number): Tree | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const i = this.treeAt[y * W + x];
    return i >= 0 && this.trees[i].regrow <= 0 ? this.trees[i] : null;
  }

  // Bears can't walk through fences or buildings (belts and grabbers are flat, so they can).
  blocksBear(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    const o = this.occ[y * W + x];
    return !!o && o.kind !== 'belt' && o.kind !== 'grabber';
  }

  inBaseArea(x: number, y: number) {
    return x >= BASE_TILE.x && x < BASE_TILE.x + BASE_TILE.w && y >= BASE_TILE.y && y < BASE_TILE.y + BASE_TILE.h;
  }

  canPlace(tool: Tool, x: number, y: number): boolean {
    if (tool === 'crossbow') return false;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    if (this.at(x, y) || this.standingTree(x, y)) return false;
    if (!this.hasBase && this.inBaseArea(x, y)) return false;
    if (tool === 'fence') return this.inv.wood >= 1;
    return this.inv[tool] > 0;
  }

  place(tool: Tool, x: number, y: number, dir: Dir): boolean {
    if (!this.canPlace(tool, x, y)) return false;
    if (tool === 'crossbow') return false;
    // stumps can be built over; the tree won't grow back there
    const ti = this.treeAt[y * W + x];
    if (ti >= 0) this.trees[ti].regrow = 1e9;
    if (tool === 'fence') this.inv.wood--;
    else this.inv[tool]--;
    this.addObj(tool, x, y, dir);
    this.sounds.push('place');
    return true;
  }

  pickUp(x: number, y: number): boolean {
    const o = this.at(x, y);
    if (!o || o.kind === 'base' || o.kind === 'machine' || o.kind === 'sticks') return false;
    this.removeObj(o);
    if (o.kind === 'fence') this.inv.wood++;
    else this.inv[o.kind]++;
    if (o.kind === 'tower') this.inv.arrows += o.arrows;
    const it = o.held ?? o.carry?.item;
    if (it === 'arrow') this.inv.arrows++;
    if (it === 'stick') this.inv.sticks = Math.min(STICK_MAX, this.inv.sticks + 1);
    const ti = this.treeAt[y * W + x];
    if (ti >= 0 && this.trees[ti].regrow > 1e8) this.trees[ti].regrow = 60;
    this.sounds.push('pop');
    return true;
  }

  toast(s: string) {
    this.toasts.push(s);
  }

  float(x: number, y: number, text: string, color = '#fff') {
    this.fx.push({ x, y, vx: 0, vy: -30, life: 1.2, max: 1.2, color, size: 15, text });
  }

  puff(x: number, y: number, color: string, n = 8, speed = 80) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = speed * (0.3 + this.rand());
      this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + this.rand() * 0.4, max: 0.9, color, size: 2 + this.rand() * 3 });
    }
  }

  // ---------- player actions ----------

  /** The "use" button: sell, use the machine, grab sticks or chop, whatever is closest. */
  act(): boolean {
    const p = this.p;
    if (p.down || p.actCool > 0) return false;
    // sell meat to a villager
    if (this.inv.meat > 0) {
      const v = this.villagers.find((v) => v.state !== 'carry' && v.state !== 'rescue' && Math.hypot(v.x - p.x, v.y - p.y) < 60);
      if (v) {
        const gold = this.inv.meat * MEAT_PRICE;
        this.inv.gold += gold;
        this.float(v.x, v.y - 30, `+${gold} gold`, '#ffd34d');
        this.toast(`Sold ${this.inv.meat} meat for ${gold} gold coins!`);
        this.inv.meat = 0;
        this.sounds.push('coin');
        p.actCool = 0.3;
        return true;
      }
    }
    // arrow machine
    if (this.nearRect(MACHINE_TILE, 30)) {
      const m = this.at(MACHINE_TILE.x, MACHINE_TILE.y)!;
      let did = false;
      if (m.aOut > 0) {
        this.inv.arrows += m.aOut;
        this.float(p.x, p.y - 30, `+${m.aOut} arrows`, '#ffe9a8');
        m.aOut = 0;
        did = true;
      }
      if (this.inv.sticks > 0) {
        const n = Math.min(this.inv.sticks, MACHINE_IN_MAX - m.sIn);
        if (n > 0) {
          m.sIn += n;
          this.inv.sticks -= n;
          this.float(m.x * T + T, m.y * T, `${n} sticks in`, '#e8c99a');
          did = true;
        }
      }
      if (did) {
        this.sounds.push('pop');
        p.actCool = 0.35;
        return true;
      }
      if (this.inv.sticks === 0 && m.sIn === 0) {
        this.toast('Bring sticks from the stick pile to make arrows.');
        p.actCool = 0.6;
        return true;
      }
    }
    // the stick pile never runs out
    if (this.nearRect(STICKS_TILE, 30)) {
      if (this.inv.sticks < STICK_MAX) {
        const n = Math.min(5, STICK_MAX - this.inv.sticks);
        this.inv.sticks += n;
        this.float(p.x, p.y - 30, `+${n} sticks`, '#e8c99a');
        this.sounds.push('pop');
      } else this.toast(`You can carry ${STICK_MAX} sticks. Put them in the arrow machine!`);
      p.actCool = 0.22;
      return true;
    }
    // chop the closest tree
    let best: Tree | null = null;
    let bd = 62;
    for (let ty = Math.floor(p.y / T) - 2; ty <= Math.floor(p.y / T) + 2; ty++)
      for (let tx = Math.floor(p.x / T) - 2; tx <= Math.floor(p.x / T) + 2; tx++) {
        const t = this.standingTree(tx, ty);
        if (!t) continue;
        const d = Math.hypot((tx + 0.5) * T - p.x, (ty + 0.5) * T - p.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
    if (best) {
      p.swing = 1;
      p.actCool = 0.28;
      p.aim = Math.atan2((best.y + 0.5) * T - p.y, (best.x + 0.5) * T - p.x);
      this.hitTree(best);
      return true;
    }
    return false;
  }

  hitTree(t: Tree) {
    t.hp--;
    t.shake = 0.25;
    this.puff((t.x + 0.5) * T, (t.y + 0.4) * T, '#ffffff', 5, 60);
    this.sounds.push('chop');
    if (t.hp > 0) return;
    t.regrow = 70 + this.rand() * 40;
    t.hp = 4;
    this.inv.wood += 2;
    this.chopped++;
    this.float((t.x + 0.5) * T, t.y * T, '+2 wood', '#e8c99a');
    this.puff((t.x + 0.5) * T, (t.y + 0.5) * T, '#2f6b4f', 10, 90);
    this.sounds.push('fall');
    this.checkBase();
  }

  checkBase() {
    if (this.hasBase || this.chopped < TREES_FOR_BASE) return;
    this.hasBase = true;
    // clear the spot
    for (let j = 0; j < BASE_TILE.h; j++)
      for (let i = 0; i < BASE_TILE.w; i++) {
        const o = this.at(BASE_TILE.x + i, BASE_TILE.y + j);
        if (o) this.pickUp(o.x, o.y);
      }
    this.addObj('base', BASE_TILE.x, BASE_TILE.y, 0);
    this.bearTimer = FIRST_BEARS;
    this.inv.tower++;
    this.sounds.push('base');
    this.puff((BASE_TILE.x + 1.5) * T, (BASE_TILE.y + 1.5) * T, '#ffe9a8', 30, 160);
    this.showBanner('You got a base!');
    this.toast('Polar bears come in 2 minutes! Build fences all the way around your village.');
    this.toast('The villagers gave you a crossbow tower. Load it with L.');
  }

  showBanner(s: string) {
    this.banner = s;
    this.bannerT = 3;
  }

  nearRect(r: { x: number; y: number; w: number; h: number }, pad: number) {
    const p = this.p;
    return p.x > r.x * T - pad && p.x < (r.x + r.w) * T + pad && p.y > r.y * T - pad && p.y < (r.y + r.h) * T + pad;
  }

  shoot(ang: number): boolean {
    const p = this.p;
    if (p.down || p.shootCool > 0) return false;
    if (this.inv.arrows <= 0) {
      this.toast('No arrows! Make some: sticks from the pile go in the arrow machine.');
      this.sounds.push('no');
      p.shootCool = 0.8;
      return false;
    }
    this.inv.arrows--;
    p.aim = ang;
    p.shootCool = 0.35;
    const s = 640;
    this.shots.push({ x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, life: 0.6 });
    this.sounds.push('shoot');
    return true;
  }

  /** Aim at the nearest bear (for touch screens). */
  autoAim(): number {
    const p = this.p;
    let best: Bear | null = null;
    let bd = 420;
    for (const b of this.bears) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : [0, Math.PI / 2, Math.PI, -Math.PI / 2][p.dir];
  }

  loadTower(): boolean {
    const p = this.p;
    if (p.down) return false;
    let best: Obj | null = null;
    let bd = 90;
    for (const o of this.objs.values()) {
      if (o.kind !== 'tower') continue;
      const d = Math.hypot((o.x + 0.5) * T - p.x, (o.y + 0.5) * T - p.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) {
      this.toast('Stand next to a crossbow tower and press L to load it.');
      return false;
    }
    if (this.inv.arrows <= 0) {
      this.toast('You have no arrows to load.');
      this.sounds.push('no');
      return false;
    }
    const n = Math.min(this.inv.arrows, TOWER_MAX - best.arrows);
    if (n <= 0) {
      this.toast('That tower is full.');
      return false;
    }
    best.arrows += n;
    this.inv.arrows -= n;
    this.float((best.x + 0.5) * T, best.y * T, `Loaded ${n}`, '#ffe9a8');
    this.sounds.push('pop');
    return true;
  }

  buy(what: 'tower' | 'belt' | 'grabber' | 'villager', n = 1): boolean {
    const cost = PRICES[what] * n;
    if (this.inv.gold < cost) {
      this.sounds.push('no');
      return false;
    }
    this.inv.gold -= cost;
    if (what === 'villager') {
      this.addVillager(true);
      this.toast('A new villager moved in! They will chop trees and bring you wood.');
    } else this.inv[what] += n;
    this.sounds.push('coin');
    return true;
  }

  // ---------- simulation ----------

  update(dt: number, move: { x: number; y: number }) {
    this.time += dt;
    const p = this.p;
    p.shootCool = Math.max(0, p.shootCool - dt);
    p.actCool = Math.max(0, p.actCool - dt);
    p.swing = Math.max(0, p.swing - dt * 4);
    p.hurt = Math.max(0, p.hurt - dt);
    if (this.bannerT > 0) this.bannerT -= dt;

    // player (walks through fences and everything else)
    if (!p.down) {
      const len = Math.hypot(move.x, move.y);
      if (len > 0.1) {
        const k = Math.min(1, len);
        const sp = 175 * k;
        p.x = Math.max(12, Math.min(W * T - 12, p.x + (move.x / len) * sp * dt));
        p.y = Math.max(12, Math.min(H * T - 12, p.y + (move.y / len) * sp * dt));
        p.step += dt * 10 * k;
        p.dir = Math.abs(move.x) > Math.abs(move.y) ? (move.x > 0 ? 0 : 2) : move.y > 0 ? 1 : 3;
      }
      // regain health slowly inside the base area
      if (this.hasBase && this.nearRect(BASE_TILE, 40)) p.hp = Math.min(PLAYER_MAX_HP, p.hp + dt * 15);
    }

    // pick up meat
    for (let i = this.meats.length - 1; i >= 0; i--) {
      const m = this.meats[i];
      m.t += dt;
      if (!p.down && Math.hypot(m.x - p.x, m.y - p.y) < 34) {
        this.inv.meat += m.n;
        this.float(m.x, m.y - 20, `+${m.n} meat`, '#ff9a9a');
        this.sounds.push('pop');
        this.meats.splice(i, 1);
      }
    }

    // trees grow back
    for (const t of this.trees) {
      if (t.shake > 0) t.shake -= dt;
      if (t.regrow > 0 && t.regrow < 1e8) {
        t.regrow -= dt;
        if (t.regrow <= 0) {
          // don't pop up under someone
          if (this.at(t.x, t.y) || Math.hypot((t.x + 0.5) * T - p.x, (t.y + 0.5) * T - p.y) < 40) t.regrow = 5;
        }
      }
    }

    // bear waves
    if (this.hasBase) {
      this.bearTimer -= dt;
      if (this.bearTimer <= 0) {
        this.wave++;
        const n = Math.min(2 + this.wave * 2, 40 - this.bears.length);
        for (let i = 0; i < n; i++) this.spawnBear();
        this.bearTimer = WAVE_GAP;
        this.showBanner(this.wave === 1 ? 'Polar bears are coming!' : `Bear wave ${this.wave}!`);
        this.sounds.push('wave');
      }
    }

    this.updateBears(dt);
    this.updateShots(dt);
    this.updateTowers(dt);
    this.updateMachines(dt);
    this.updateBelts(dt);
    this.updateGrabbers(dt);
    this.updateVillagers(dt);

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (!f.text) {
        f.vx *= 0.92;
        f.vy *= 0.92;
      }
      if (f.life <= 0) this.fx.splice(i, 1);
    }
  }

  spawnBear() {
    const side = Math.floor(this.rand() * 4);
    const r = this.rand();
    const x = side === 0 ? 1 : side === 1 ? W - 1 : r * W;
    const y = side === 2 ? 1 : side === 3 ? H - 1 : r * H;
    const hp = 3 + Math.floor(this.wave / 4);
    this.bears.push({ x: x * T, y: y * T, hp, max: hp, ang: 0, cool: 0, wiggle: 0, wigAng: 0, hurt: 0, step: this.rand() * 10 });
  }

  bearFits(x: number, y: number): boolean {
    const r = 13;
    return (
      !this.blocksBear(Math.floor((x - r) / T), Math.floor((y - r) / T)) &&
      !this.blocksBear(Math.floor((x + r) / T), Math.floor((y - r) / T)) &&
      !this.blocksBear(Math.floor((x - r) / T), Math.floor((y + r) / T)) &&
      !this.blocksBear(Math.floor((x + r) / T), Math.floor((y + r) / T))
    );
  }

  updateBears(dt: number) {
    const p = this.p;
    const home = { x: (HOME.x + 0.5) * T, y: (HOME.y + 0.5) * T };
    for (const b of this.bears) {
      b.cool = Math.max(0, b.cool - dt);
      b.hurt = Math.max(0, b.hurt - dt);
      const hunting = !p.down;
      const tgt = hunting ? p : home;
      let ang = Math.atan2(tgt.y - b.y, tgt.x - b.x);
      if (b.wiggle > 0) {
        b.wiggle -= dt;
        ang = b.wigAng;
      }
      const dist = Math.hypot(tgt.x - b.x, tgt.y - b.y);
      const sp = (hunting ? 78 : 40) * (dist < 20 ? 0 : 1);
      const ox = b.x;
      const oy = b.y;
      const nx = b.x + Math.cos(ang) * sp * dt;
      const ny = b.y + Math.sin(ang) * sp * dt;
      if (this.bearFits(nx, b.y)) b.x = nx;
      if (this.bearFits(b.x, ny)) b.y = ny;
      const moved = Math.hypot(b.x - ox, b.y - oy);
      if (sp > 0 && moved < sp * dt * 0.25 && b.wiggle <= 0 && this.rand() < 0.02) {
        // stuck against a fence: shuffle sideways for a bit
        b.wiggle = 0.6 + this.rand() * 0.8;
        b.wigAng = ang + (this.rand() < 0.5 ? 1 : -1) * (Math.PI / 2 + this.rand() * 0.6);
      }
      if (moved > 0.01) {
        b.ang = Math.atan2(b.y - oy, b.x - ox);
        b.step += moved * 0.12;
      }
      b.x = Math.max(10, Math.min(W * T - 10, b.x));
      b.y = Math.max(10, Math.min(H * T - 10, b.y));
      // bite! only if no fence is in the way
      if (hunting && dist < 34 && b.cool <= 0) {
        const mx = Math.floor((b.x + p.x) / 2 / T);
        const my = Math.floor((b.y + p.y) / 2 / T);
        if (!this.blocksBear(mx, my) && !this.blocksBear(Math.floor(p.x / T), Math.floor(p.y / T))) {
          b.cool = 0.9;
          b.ang = Math.atan2(p.y - b.y, p.x - b.x);
          this.hurtPlayer(14);
        }
      }
    }
    // keep bears from stacking up in one spot
    for (let i = 0; i < this.bears.length; i++)
      for (let j = i + 1; j < this.bears.length; j++) {
        const a = this.bears[i];
        const c = this.bears[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 28) {
          const push = (28 - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          if (this.bearFits(a.x - ux * push, a.y - uy * push)) {
            a.x -= ux * push;
            a.y -= uy * push;
          }
          if (this.bearFits(c.x + ux * push, c.y + uy * push)) {
            c.x += ux * push;
            c.y += uy * push;
          }
        }
      }
  }

  hurtPlayer(n: number) {
    const p = this.p;
    if (p.down) return;
    p.hp -= n;
    p.hurt = 0.4;
    this.sounds.push('hurt');
    this.puff(p.x, p.y, '#ff6b6b', 6, 70);
    if (p.hp <= 0) {
      p.hp = 0;
      p.down = true;
      this.showBanner('You got hurt!');
      this.toast('Hang on! A villager is coming to carry you back to base.');
      this.sendRescue();
    }
  }

  sendRescue() {
    const p = this.p;
    let best: Villager | null = null;
    let bd = Infinity;
    for (const v of this.villagers) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best) {
      this.healAtBase();
      return;
    }
    if (best.tree >= 0) this.trees[best.tree].target = false;
    best.tree = -1;
    best.state = 'rescue';
  }

  healAtBase() {
    const p = this.p;
    p.down = false;
    p.hp = PLAYER_MAX_HP;
    p.x = (BASE_TILE.x + 1.5) * T;
    p.y = (BASE_TILE.y + BASE_TILE.h + 0.4) * T;
    this.sounds.push('heal');
    this.puff(p.x, p.y, '#9dffb0', 16, 90);
    this.toast('You are all healed up!');
  }

  damageBear(b: Bear, n: number) {
    b.hp -= n;
    b.hurt = 0.15;
    this.sounds.push('hit');
    this.puff(b.x, b.y, '#ffffff', 4, 60);
    if (b.hp <= 0) {
      this.bears.splice(this.bears.indexOf(b), 1);
      this.kills++;
      this.meats.push({ x: b.x, y: b.y, n: 3, t: 0 });
      this.puff(b.x, b.y, '#f0f0ea', 14, 110);
      this.sounds.push('growl');
    }
  }

  updateShots(dt: number) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let hit = false;
      for (const b of this.bears)
        if (Math.hypot(b.x - s.x, b.y - s.y) < 20) {
          this.damageBear(b, 1);
          hit = true;
          break;
        }
      if (hit || s.life <= 0) this.shots.splice(i, 1);
    }
  }

  updateTowers(dt: number) {
    for (const o of this.objs.values()) {
      if (o.kind !== 'tower') continue;
      o.cool = Math.max(0, o.cool - dt);
      const cx = (o.x + 0.5) * T;
      const cy = (o.y + 0.5) * T;
      let best: Bear | null = null;
      let bd = TOWER_RANGE;
      for (const b of this.bears) {
        const d = Math.hypot(b.x - cx, b.y - cy);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (!best) continue;
      const want = Math.atan2(best.y - cy, best.x - cx);
      let diff = want - o.aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      o.aim += Math.max(-dt * 8, Math.min(dt * 8, diff));
      if (o.arrows > 0 && o.cool <= 0 && Math.abs(diff) < 0.3) {
        o.arrows--;
        o.cool = 0.6;
        const s = 700;
        this.shots.push({ x: cx, y: cy - 10, vx: Math.cos(o.aim) * s, vy: Math.sin(o.aim) * s, life: TOWER_RANGE / s + 0.1 });
        this.sounds.push('shoot');
      }
    }
  }

  updateMachines(dt: number) {
    for (const o of this.objs.values()) {
      if (o.kind !== 'machine') continue;
      if (o.sIn > 0 && o.aOut <= MACHINE_OUT_MAX - 2) {
        o.prog += dt;
        if (o.prog >= 0.8) {
          o.prog = 0;
          o.sIn--;
          o.aOut += 2;
        }
      } else o.prog = 0;
    }
  }

  /** Something wants to put `item` into tile (x, y). Returns true if it was taken. */
  give(x: number, y: number, item: Item, fromDir: Dir): boolean {
    const o = this.at(x, y);
    if (!o) return false;
    if (o.kind === 'belt') {
      if (o.carry) return false;
      // don't push items into the front of a belt that points back at us
      if (o.dir === ((fromDir + 2) % 4)) return false;
      o.carry = { item, p: 0 };
      return true;
    }
    if (o.kind === 'machine' && item === 'stick' && o.sIn < MACHINE_IN_MAX) {
      o.sIn++;
      return true;
    }
    if (o.kind === 'tower' && item === 'arrow' && o.arrows < TOWER_MAX) {
      o.arrows++;
      return true;
    }
    return false;
  }

  /** A grabber takes from tile (x, y). */
  take(x: number, y: number): Item | null {
    const o = this.at(x, y);
    if (!o) return null;
    if (o.kind === 'sticks') return 'stick';
    if (o.kind === 'machine' && o.aOut > 0) {
      o.aOut--;
      return 'arrow';
    }
    if (o.kind === 'belt' && o.carry && o.carry.p > 0.5) {
      const it = o.carry.item;
      o.carry = null;
      return it;
    }
    return null;
  }

  updateBelts(dt: number) {
    const moved = new Set<Obj>();
    for (const o of this.objs.values()) {
      if (o.kind !== 'belt' || !o.carry || moved.has(o)) continue;
      o.carry.p = Math.min(1, o.carry.p + dt * 1.6);
      if (o.carry.p >= 1) {
        const nx = o.x + DX[o.dir];
        const ny = o.y + DY[o.dir];
        const next = this.at(nx, ny);
        if (next && next.kind === 'belt') {
          if (!next.carry && next.dir !== (o.dir + 2) % 4) {
            next.carry = { item: o.carry.item, p: 0 };
            o.carry = null;
            moved.add(next);
          }
        } else if (next && next.kind !== 'grabber' && this.give(nx, ny, o.carry.item, o.dir)) o.carry = null;
      }
    }
  }

  updateGrabbers(dt: number) {
    for (const o of this.objs.values()) {
      if (o.kind !== 'grabber') continue;
      o.cool = Math.max(0, o.cool - dt);
      // swing toward where it is going
      const want = o.held ? 1 : 0;
      o.swing += Math.sign(want - o.swing) * Math.min(Math.abs(want - o.swing), dt * 2.5);
      const bx = o.x - DX[o.dir];
      const by = o.y - DY[o.dir];
      const fx = o.x + DX[o.dir];
      const fy = o.y + DY[o.dir];
      if (!o.held && o.swing <= 0 && o.cool <= 0) {
        const it = this.take(bx, by);
        if (it) o.held = it;
        else o.cool = 0.2;
      } else if (o.held && o.swing >= 1) {
        if (this.give(fx, fy, o.held, o.dir)) {
          o.held = null;
          o.cool = 0.1;
        }
      }
    }
  }

  updateVillagers(dt: number) {
    const p = this.p;
    const base = this.hasBase
      ? { x: (BASE_TILE.x + 1.5) * T, y: (BASE_TILE.y + BASE_TILE.h + 0.4) * T }
      : { x: (HOME.x + 0.5) * T, y: (HOME.y + 1.5) * T };
    for (const v of this.villagers) {
      const go = (tx: number, ty: number, sp: number): boolean => {
        const dx = tx - v.x;
        const dy = ty - v.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) return true;
        const s = Math.min(d, sp * dt);
        v.x += (dx / d) * s;
        v.y += (dy / d) * s;
        v.step += s * 0.12;
        v.face = Math.atan2(dy, dx);
        return false;
      };
      switch (v.state) {
        case 'rescue':
          if (!p.down) {
            v.state = 'idle';
            break;
          }
          if (go(p.x, p.y, 190)) {
            v.state = 'carry';
            this.toast('Got you! Going back to base.');
          }
          break;
        case 'carry':
          if (go(base.x, base.y, 120)) {
            v.state = 'idle';
            v.timer = 2;
            this.healAtBase();
          } else {
            p.x = v.x + 10;
            p.y = v.y - 8;
          }
          break;
        case 'idle':
          v.timer -= dt;
          if (v.timer <= 0) {
            if (v.jack && this.hasBase) {
              const t = this.findTreeFor(v);
              if (t >= 0) {
                v.tree = t;
                this.trees[t].target = true;
                v.state = 'toTree';
                break;
              }
            }
            const a = this.rand() * Math.PI * 2;
            const r = (1.5 + this.rand() * 3) * T;
            v.tx = base.x + Math.cos(a) * r;
            v.ty = base.y - T + Math.sin(a) * r * 0.7;
            v.state = 'walk';
          }
          break;
        case 'walk':
          if (go(v.tx, v.ty, 50)) {
            v.state = 'idle';
            v.timer = 2 + this.rand() * 4;
          }
          break;
        case 'toTree': {
          const t = this.trees[v.tree];
          if (!t || t.regrow > 0) {
            if (t) t.target = false;
            v.state = 'idle';
            v.timer = 0.5;
            break;
          }
          if (go((t.x + 0.5) * T, (t.y + 1.1) * T, 75)) {
            v.state = 'chop';
            v.timer = 0.6;
          }
          break;
        }
        case 'chop': {
          const t = this.trees[v.tree];
          if (!t || t.regrow > 0) {
            if (t) t.target = false;
            v.state = v.wood > 0 ? 'home' : 'idle';
            break;
          }
          v.timer -= dt;
          v.face = -Math.PI / 2;
          if (v.timer <= 0) {
            v.timer = 0.6;
            t.hp--;
            t.shake = 0.25;
            this.puff((t.x + 0.5) * T, (t.y + 0.4) * T, '#ffffff', 3, 50);
            if (Math.hypot(v.x - p.x, v.y - p.y) < 500) this.sounds.push('chop');
            if (t.hp <= 0) {
              t.hp = 4;
              t.regrow = 70 + this.rand() * 40;
              t.target = false;
              this.chopped++;
              v.wood = 2;
              v.state = 'home';
              this.checkBase();
            }
          }
          break;
        }
        case 'home':
          if (go(base.x + (this.rand() - 0.5) * 2, base.y, 75)) {
            this.inv.wood += v.wood;
            this.float(v.x, v.y - 30, `+${v.wood} wood`, '#e8c99a');
            v.wood = 0;
            v.state = 'idle';
            v.timer = 1;
          }
          break;
      }
    }
  }

  findTreeFor(v: Villager): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      if (t.regrow > 0 || t.target) continue;
      const d = Math.hypot((t.x + 0.5) * T - v.x, (t.y + 0.5) * T - v.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  // ---------- saving ----------

  save(): string {
    const objs = [...this.objs.values()].map((o) => ({ k: o.kind, x: o.x, y: o.y, d: o.dir, a: o.arrows, h: o.held, c: o.carry?.item ?? null, si: o.sIn, ao: o.aOut }));
    return JSON.stringify({
      v: 1,
      p: { x: this.p.x, y: this.p.y, hp: this.p.hp, down: this.p.down },
      inv: this.inv,
      chopped: this.chopped,
      hasBase: this.hasBase,
      bearTimer: this.bearTimer,
      wave: this.wave,
      kills: this.kills,
      objs,
      trees: this.trees.map((t) => [t.x, t.y, Math.round(t.regrow), Math.round(t.size * 100)]),
      bears: this.bears.map((b) => [Math.round(b.x), Math.round(b.y), b.hp, b.max]),
      meats: this.meats.map((m) => [Math.round(m.x), Math.round(m.y), m.n]),
      jacks: this.villagers.filter((v) => v.jack).length,
    });
  }

  static load(raw: string): Game | null {
    try {
      const s = JSON.parse(raw);
      if (s.v !== 1) return null;
      const g = new Game();
      g.objs.clear();
      g.occ.fill(null);
      g.trees = [];
      g.treeAt.fill(-1);
      for (const [x, y, r, sz] of s.trees as number[][]) {
        g.addTree(x, y, sz / 100);
        g.trees[g.trees.length - 1].regrow = r;
      }
      for (const o of s.objs) {
        const ob = g.addObj(o.k, o.x, o.y, o.d);
        ob.arrows = o.a ?? 0;
        ob.held = o.h ?? null;
        ob.carry = o.c ? { item: o.c, p: 0.5 } : null;
        ob.sIn = o.si ?? 0;
        ob.aOut = o.ao ?? 0;
      }
      Object.assign(g.inv, s.inv);
      g.chopped = s.chopped;
      g.hasBase = s.hasBase;
      g.bearTimer = s.bearTimer;
      g.wave = s.wave;
      g.kills = s.kills ?? 0;
      g.p.x = s.p.x;
      g.p.y = s.p.y;
      g.p.hp = s.p.hp;
      for (const [x, y, hp, max] of s.bears as number[][]) g.bears.push({ x, y, hp, max, ang: 0, cool: 0, wiggle: 0, wigAng: 0, hurt: 0, step: 0 });
      for (const [x, y, n] of s.meats as number[][]) g.meats.push({ x, y, n, t: 0 });
      for (let i = 0; i < (s.jacks ?? 0); i++) g.addVillager(true);
      if (s.p.down) {
        g.p.hp = 0;
        g.p.down = true;
        g.sendRescue();
      }
      return g;
    } catch (err) {
      console.warn('bad save', err);
      return null;
    }
  }
}
