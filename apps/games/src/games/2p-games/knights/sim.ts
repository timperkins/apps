// Knight Battle rules. The host's game runs this; friends only draw its snapshots.
// Blue team lives on the bottom half of the field, red on the top half. Every player has a big heart
// (1000 health) at the back of their side; a team loses when all of its hearts are broken.

export const TILE = 64;
export const TEAM_NAMES = ['Blue', 'Red'];
export const TEAM_FILES = ['blue', 'red'] as const;

export type Cls = 'knight' | 'archer' | 'monk' | 'lancer';
export const CLASSES: Cls[] = ['knight', 'archer', 'monk', 'lancer'];
export const CLASS: Record<Cls, { name: string; hp: number; speed: number; dmg: number; range: number; cd: number; knock: number; desc: string }> = {
  knight: { name: 'Knight', hp: 300, speed: 230, dmg: 72, range: 100, cd: 0.55, knock: 280, desc: 'Big sword swing: 72 damage and a strong knockback.' },
  archer: { name: 'Archer', hp: 220, speed: 245, dmg: 40, range: 560, cd: 0.6, knock: 130, desc: 'No sword. Shoots arrows from far away.' },
  monk: { name: 'Monk', hp: 240, speed: 225, dmg: 34, range: 180, cd: 1.0, knock: 200, desc: 'Heals you and your teammates close by, and hurts enemies close by.' },
  lancer: { name: 'Lancer', hp: 330, speed: 220, dmg: 60, range: 170, cd: 0.75, knock: 340, desc: 'A long spear that reaches far in a line.' },
};
export const CLASS_PRICE = 10;

export const ARMOR = [
  { name: 'No armor', cut: 0, price: 0 },
  { name: 'Stone armor', cut: 0.15, price: 40 },
  { name: 'Iron armor', cut: 0.40, price: 120 },
  { name: 'Gold armor', cut: 0.55, price: 260 },
  { name: 'Diamond armor', cut: 0.70, price: 500 },
];
export const MEAT_PRICE = 10; // for 3 meat
export const MEAT_HEAL = 70;

export type Ench = 'freeze' | 'burn' | 'zap' | 'poison';
export const ENCHANTS: Ench[] = ['freeze', 'burn', 'zap', 'poison'];
export const ENCH: Record<Ench, { name: string; icon: string; desc: string }> = {
  freeze: { name: 'Freezing', icon: '❄️', desc: 'Hits freeze enemies in place, then slow them.' },
  burn: { name: 'Burning', icon: '🔥', desc: 'Hits set enemies on fire for 4 seconds.' },
  zap: { name: 'Zapping', icon: '⚡', desc: 'Hits jump to the nearest other enemy too.' },
  poison: { name: 'Poisoning', icon: '☠️', desc: 'Hits poison enemies for 7 seconds, right through armor.' },
};
export const BOX_EVERY = 300; // a mystery box every 5 minutes

export type UKind = 'hero' | 'warrior' | 'lancer' | 'archer' | 'monk' | 'sheep';
export const UKINDS: UKind[] = ['hero', 'warrior', 'lancer', 'archer', 'monk', 'sheep'];
export const UNIT: Record<Exclude<UKind, 'hero'>, { name: string; hp: number; speed: number; dmg: number; range: number; cd: number; cost: number; pop: number; desc: string }> = {
  warrior: { name: 'Warrior', hp: 130, speed: 150, dmg: 16, range: 62, cd: 0.9, cost: 20, pop: 1, desc: 'Sword fighter. Cheap and tough.' },
  lancer: { name: 'Lancer', hp: 170, speed: 140, dmg: 22, range: 110, cd: 1.1, cost: 35, pop: 2, desc: 'Long spear, lots of health. Takes 2 room.' },
  archer: { name: 'Archer', hp: 85, speed: 150, dmg: 14, range: 380, cd: 1.2, cost: 25, pop: 1, desc: 'Shoots arrows from far away.' },
  monk: { name: 'Monk', hp: 95, speed: 140, dmg: 18, range: 170, cd: 1.6, cost: 30, pop: 1, desc: 'Heals friends nearby, heroes too.' },
  sheep: { name: 'Sheep', hp: 30, speed: 70, dmg: 0, range: 0, cd: 1, cost: 0, pop: 0, desc: '' },
};

export type BKind = 'castle' | 'heart' | 'barracks' | 'archery' | 'monastery' | 'tower' | 'house' | 'wall' | 'goldblock';
export const BKINDS: BKind[] = ['castle', 'heart', 'barracks', 'archery', 'monastery', 'tower', 'house', 'wall', 'goldblock'];
export const BUILD: Record<BKind, { name: string; hp: number; w: number; h: number; cost: number; trains: Exclude<UKind, 'hero' | 'sheep'>[]; pop?: number; desc: string }> = {
  castle: { name: 'Castle', hp: 1e9, w: 5, h: 2, cost: 0, trains: [], desc: 'Change your class, buy armor and meat. Shoots arrows at enemies close by.' },
  heart: { name: 'Heart', hp: 1000, w: 3, h: 2, cost: 0, trains: [], desc: 'Your big heart. If it breaks, you can’t come back.' },
  barracks: { name: 'Barracks', hp: 650, w: 3, h: 2, cost: 60, trains: ['warrior', 'lancer'], desc: 'Trains warriors and lancers.' },
  archery: { name: 'Archery Range', hp: 550, w: 3, h: 2, cost: 70, trains: ['archer'], desc: 'Trains archers.' },
  monastery: { name: 'Monastery', hp: 550, w: 3, h: 2, cost: 80, trains: ['monk'], desc: 'Trains monks, who heal.' },
  tower: { name: 'Tower', hp: 800, w: 2, h: 2, cost: 100, trains: [], desc: 'Shoots arrows at enemies that come close.' },
  house: { name: 'House', hp: 400, w: 2, h: 1, cost: 30, trains: [], pop: 4, desc: 'Room for 4 more warriors.' },
  wall: { name: 'Wall', hp: 320, w: 1, h: 1, cost: 6, trains: [], desc: 'Stops enemies until they break it. Your team walks right through.' },
  goldblock: { name: 'Infinite Gold Block', hp: 1, w: 1, h: 1, cost: 10, trains: [], desc: 'Never breaks unless you sell it. Everyone can walk through it, but it stops enemy arrows and spells.' },
};
export const BUILDABLE: BKind[] = ['wall', 'goldblock', 'house', 'barracks', 'archery', 'monastery', 'tower'];
const BASE_POP = 6, MAX_POP = 30;

export type Order = 'attack' | 'defend' | 'follow';
export const ORDERS: Order[] = ['attack', 'defend', 'follow'];
export const TAUNTS = ['Come at me!', 'Too slow!', 'Is that all?', 'Nice try!', 'Catch me if you can!', 'Ha ha ha!', 'My heart is safe!', 'Boo!'];

export type Anim = 'idle' | 'run' | 'attack' | 'attack2' | 'heal' | 'shoot';
export const ANIMS: Anim[] = ['idle', 'run', 'attack', 'attack2', 'heal', 'shoot'];

// fx kinds in snapshots
export const FX = { boom: 0, dust: 1, heal: 2, zap: 3, freeze: 4, burn: 5, poison: 6, hit: 7, gold: 8, meat: 9, box: 10, swing: 11 } as const;

export interface Player {
  slot: number; name: string; team: number; bot: boolean;
  hero: number; heart: number;
  gold: number; meat: number; armor: number; cls: Cls; ench: Ench | null;
  respawn: number; ghost: boolean; order: Order; kills: number;
  tauntAt: number; taunt: number; left: boolean;
  // bot brain
  think: number;
}

interface Status { frozen: number; slow: number; burn: number; poison: number; burnBy: number; poisonBy: number }
interface Unit extends Status {
  id: number; kind: UKind; team: number; owner: number; x: number; y: number; kx: number; ky: number;
  hp: number; maxHp: number; cd: number; face: number; aimX: number; aimY: number;
  anim: Anim; seq: number; animT: number; target: number; stuck: number; dead: boolean; ghost: boolean;
  wander: number; wx: number; wy: number;
}
interface Building {
  id: number; kind: BKind; team: number; owner: number; tx: number; ty: number; x: number; y: number;
  hp: number; maxHp: number; cd: number; dead: boolean; variant: number;
}
interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; team: number; owner: number; life: number; kind: number; hero: boolean; knock: number }
interface Rock { id: number; tx: number; ty: number; gold: number; regrow: number }

export interface Input { mx: number; my: number; ax: number; ay: number; atk: boolean }
export type Cmd =
  | { t: 'build'; kind: BKind; tx: number; ty: number }
  | { t: 'train'; bid: number; kind: Exclude<UKind, 'hero' | 'sheep'> }
  | { t: 'sell'; bid: number }
  | { t: 'class'; cls: Cls }
  | { t: 'armor' }
  | { t: 'meat' }
  | { t: 'eat' }
  | { t: 'taunt' }
  | { t: 'order'; o: Order };

export interface PView {
  slot: number; name: string; team: number; bot: boolean; hero: number; heart: number;
  gold: number; meat: number; armor: number; cls: Cls; ench: Ench | null; respawn: number; ghost: boolean;
  order: Order; army: number; cap: number; kills: number; taunt: number; tauntAt: number;
}
export interface Snap {
  W: number; H: number;
  t: number;
  /** units: id, kind, team, x, y, anim, seq, flags (1 flip, 2 frozen, 4 burning, 8 poisoned, 16 ghost, 32 slowed), hp %, owner */
  e: number[][];
  /** buildings: id, kind, team, x, y, hp %, owner, variant */
  b: number[][];
  /** arrows and spells: x, y, angle*100, kind */
  a: number[][];
  /** effects: kind, x, y, x2, y2 */
  fx: number[][];
  ps: PView[];
  /** mystery box: 0 none, 1 falling, 2 on the ground; x, y, seconds left to land */
  box: [number, number, number, number];
  next: number;
  rocks: number[][];
  over: number; // winning team, or -1
  say: string[];
  /** private notes for one player: [slot, text] */
  note: [number, string][];
}

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

export function mapSize(blue: number, red: number) {
  const n = Math.max(1, blue, red);
  return { W: Math.max(26, n * 9 + 8), H: 42 };
}

export class Game {
  W: number; H: number;
  units: Unit[] = [];
  buildings: Building[] = [];
  projs: Proj[] = [];
  rocks: Rock[] = [];
  players = new Map<number, Player>();
  inputs = new Map<number, Input>();
  grid: Int32Array;
  t = 0;
  nextBox = BOX_EVERY;
  box: { state: 0 | 1 | 2; x: number; y: number; land: number } = { state: 0, x: 0, y: 0, land: 0 };
  over = -1;
  private fx: number[][] = [];
  private say: string[] = [];
  private notes: [number, string][] = [];
  private nid = 1;
  private r: () => number;
  castles: number[] = [];
  private income = 0;
  private sheepT = 0;

  constructor(players: { slot: number; name: string; team: number; bot: boolean }[], seed: number) {
    this.r = rng(seed);
    const blue = players.filter((p) => p.team === 0), red = players.filter((p) => p.team === 1);
    const { W, H } = mapSize(blue.length, red.length);
    this.W = W; this.H = H;
    this.grid = new Int32Array(W * H);
    // castles at the back left of each side
    for (const team of [0, 1]) {
      const ty = team === 0 ? H - 4 : 2;
      const c = this.addBuilding('castle', team, -1, 2, ty);
      this.castles[team] = c.id;
    }
    for (const team of [0, 1]) {
      const list = team === 0 ? blue : red;
      list.forEach((p, k) => {
        const hx = Math.round(W * (k + 1) / (list.length + 1) - 1.5);
        const hy = team === 0 ? H - 4 : 2;
        // keep hearts clear of the castle
        const tx = Math.max(8, Math.min(W - 5, hx + (list.length > 1 ? 0 : 0)));
        const heart = this.addBuilding('heart', team, p.slot, tx, hy);
        this.addPlayer(p, heart.id);
      });
    }
    // gold rocks across the middle
    const mid = Math.floor(H / 2);
    const n = Math.max(4, Math.floor(W / 5));
    for (let i = 0; i < n; i++) {
      const tx = Math.floor(W * (i + 0.5) / n);
      for (const dy of [-3, 2]) {
        const ty = mid + dy + (i % 2 ? 1 : 0) * (dy < 0 ? -1 : 1);
        if (Math.abs(tx - W / 2) < 2) continue;
        this.rocks.push({ id: this.nid++, tx, ty, gold: 40, regrow: 0 });
      }
    }
    for (let i = 0; i < 5; i++) this.spawnSheep();
  }

  private addPlayer(p: { slot: number; name: string; team: number; bot: boolean }, heart: number, ghost = false) {
    const pl: Player = {
      slot: p.slot, name: p.name, team: p.team, bot: p.bot, hero: 0, heart,
      gold: 40, meat: 3, armor: 0, cls: 'knight', ench: null, respawn: 0, ghost, order: 'attack', kills: 0,
      tauntAt: -9, taunt: 0, left: false, think: 0,
    };
    this.players.set(p.slot, pl);
    const at = this.spawnPoint(pl);
    const hero = this.addUnit('hero', p.team, p.slot, at.x, at.y);
    hero.maxHp = hero.hp = CLASS.knight.hp;
    hero.ghost = ghost;
    pl.hero = hero.id;
    return pl;
  }

  /** Someone who joins after the start watches as a ghost. */
  addLate(p: { slot: number; name: string; team: number; bot: boolean }) {
    const pl = this.addPlayer(p, 0, true);
    this.say.push(`${pl.name} came to watch 👻`);
  }

  removePlayer(slot: number) {
    const p = this.players.get(slot);
    if (!p) return;
    p.left = true;
    const h = this.unit(p.hero);
    if (h) h.dead = true;
    this.say.push(`${p.name} left.`);
  }

  private spawnPoint(p: Player) {
    const heart = this.building(p.heart);
    if (heart) return { x: heart.x + (Math.random() - 0.5) * 40, y: p.team === 0 ? heart.y - 2 * TILE - 70 : heart.y + 70 };
    return { x: this.W * TILE / 2, y: this.H * TILE / 2 };
  }

  unit(id: number) { const u = this.units.find((x) => x.id === id); return u && !u.dead ? u : undefined; }
  building(id: number) { const b = this.buildings.find((x) => x.id === id); return b && !b.dead ? b : undefined; }

  private addUnit(kind: UKind, team: number, owner: number, x: number, y: number): Unit {
    const st = kind === 'hero' ? CLASS.knight : UNIT[kind];
    const u: Unit = {
      id: this.nid++, kind, team, owner, x, y, kx: 0, ky: 0, hp: st.hp, maxHp: st.hp, cd: 0.5, face: team === 0 ? 1 : -1, aimX: 0, aimY: team === 0 ? -1 : 1,
      anim: 'idle', seq: 0, animT: 0, target: 0, stuck: 0, dead: false, ghost: false, wander: 0, wx: x, wy: y,
      frozen: 0, slow: 0, burn: 0, poison: 0, burnBy: -1, poisonBy: -1,
    };
    this.units.push(u);
    return u;
  }

  private addBuilding(kind: BKind, team: number, owner: number, tx: number, ty: number): Building {
    const s = BUILD[kind];
    const b: Building = {
      id: this.nid++, kind, team, owner, tx, ty, x: (tx + s.w / 2) * TILE, y: (ty + s.h) * TILE,
      hp: s.hp, maxHp: s.hp, cd: 1, dead: false, variant: this.nid % 3,
    };
    this.buildings.push(b);
    for (let y = ty; y < ty + s.h; y++) for (let x = tx; x < tx + s.w; x++) this.grid[y * this.W + x] = b.id;
    return b;
  }

  private removeBuilding(b: Building) {
    b.dead = true;
    const s = BUILD[b.kind];
    for (let y = b.ty; y < b.ty + s.h; y++) for (let x = b.tx; x < b.tx + s.w; x++) if (this.grid[y * this.W + x] === b.id) this.grid[y * this.W + x] = 0;
  }

  /** Can a building of this kind go here for this team? Returns why not, or ''. */
  canPlace(kind: BKind, team: number, tx: number, ty: number): string {
    const s = BUILD[kind];
    const mid = this.H / 2;
    if (tx < 1 || ty < 1 || tx + s.w > this.W - 1 || ty + s.h > this.H - 1) return 'Too close to the edge.';
    if (team === 0 ? ty < mid + 1 : ty + s.h > mid - 1) return 'Build on your own side of the field.';
    for (let y = ty; y < ty + s.h; y++) for (let x = tx; x < tx + s.w; x++) {
      if (this.grid[y * this.W + x]) return 'Something is in the way.';
      if (this.rocks.some((r) => r.tx === x && r.ty === y)) return 'Something is in the way.';
    }
    return '';
  }

  // ---------- commands ----------
  cmd(slot: number, c: Cmd): string {
    const p = this.players.get(slot);
    if (!p || p.left || this.over >= 0) return '';
    const hero = this.unit(p.hero);
    if (c.t === 'taunt') {
      if (this.t - p.tauntAt < 1.5 || !hero) return '';
      p.tauntAt = this.t; p.taunt = Math.floor(this.r() * TAUNTS.length);
      return '';
    }
    if (p.ghost) return 'Ghosts can only watch (and taunt).';
    switch (c.t) {
      case 'build': {
        const s = BUILD[c.kind];
        if (!BUILDABLE.includes(c.kind)) return '';
        if (p.gold < s.cost) return `You need ${s.cost} gold.`;
        const why = this.canPlace(c.kind, p.team, c.tx, c.ty);
        if (why) return why;
        p.gold -= s.cost;
        this.addBuilding(c.kind, p.team, slot, c.tx, c.ty);
        this.fx.push([FX.dust, (c.tx + s.w / 2) * TILE, (c.ty + s.h) * TILE, 0, 0]);
        return '';
      }
      case 'train': {
        const b = this.building(c.bid);
        if (!b || b.owner !== slot || !BUILD[b.kind].trains.includes(c.kind)) return 'Can’t train that here.';
        const st = UNIT[c.kind];
        if (p.gold < st.cost) return `You need ${st.cost} gold.`;
        if (this.army(slot) + st.pop > this.cap(slot)) return 'No room. Build a house for more.';
        p.gold -= st.cost;
        const u = this.addUnit(c.kind, p.team, slot, b.x + (this.r() - 0.5) * 60, p.team === 0 ? b.y - BUILD[b.kind].h * TILE - 20 : b.y + 20);
        u.cd = 0.8;
        return '';
      }
      case 'sell': {
        const b = this.building(c.bid);
        if (!b || b.owner !== slot || !BUILDABLE.includes(b.kind)) return 'You can only sell your own buildings.';
        p.gold += Math.floor(BUILD[b.kind].cost / 2);
        this.removeBuilding(b);
        this.fx.push([FX.dust, b.x, b.y, 0, 0]);
        return '';
      }
      case 'class': {
        if (!this.atCastle(p)) return 'Go to your castle to change class.';
        if (p.cls === c.cls) return '';
        if (p.gold < CLASS_PRICE) return `You need ${CLASS_PRICE} gold.`;
        p.gold -= CLASS_PRICE;
        p.cls = c.cls;
        if (hero) { const f = hero.hp / hero.maxHp; hero.maxHp = CLASS[c.cls].hp; hero.hp = Math.max(1, Math.round(f * hero.maxHp)); }
        this.fx.push([FX.heal, hero?.x ?? 0, hero?.y ?? 0, 0, 0]);
        return '';
      }
      case 'armor': {
        if (!this.atCastle(p)) return 'Go to your castle for armor.';
        const next = ARMOR[p.armor + 1];
        if (!next) return 'You have the best armor.';
        if (p.gold < next.price) return `You need ${next.price} gold.`;
        p.gold -= next.price; p.armor++;
        return '';
      }
      case 'meat': {
        if (!this.atCastle(p)) return 'Go to your castle for meat.';
        if (p.gold < MEAT_PRICE) return `You need ${MEAT_PRICE} gold.`;
        p.gold -= MEAT_PRICE; p.meat += 3;
        return '';
      }
      case 'eat': {
        if (!hero) return '';
        if (p.meat <= 0) return 'No meat. Hit a sheep or buy some at the castle.';
        if (hero.hp >= hero.maxHp) return 'You’re already at full health.';
        p.meat--; hero.hp = Math.min(hero.maxHp, hero.hp + MEAT_HEAL);
        this.fx.push([FX.meat, hero.x, hero.y, 0, 0]);
        return '';
      }
      case 'order': p.order = c.o; return '';
    }
    return '';
  }

  atCastle(p: Player) {
    const h = this.unit(p.hero), c = this.building(this.castles[p.team]);
    if (!h || !c) return false;
    const cy = c.y - TILE;
    return Math.abs(h.x - c.x) < 3.6 * TILE && Math.abs(h.y - cy) < 2.6 * TILE;
  }

  army(slot: number) { let n = 0; for (const u of this.units) if (!u.dead && u.owner === slot && u.kind !== 'hero' && u.kind !== 'sheep') n += UNIT[u.kind].pop; return n; }
  cap(slot: number) { let n = BASE_POP; for (const b of this.buildings) if (!b.dead && b.owner === slot) n += BUILD[b.kind].pop ?? 0; return Math.min(MAX_POP, n); }

  // ---------- the clock ----------
  step(dt: number) {
    if (this.over >= 0) return;
    this.t += dt;
    // a little gold for everyone, every second
    this.income += dt;
    if (this.income >= 1) {
      this.income -= 1;
      for (const p of this.players.values()) if (!p.left && !p.ghost) p.gold += 2;
    }
    for (const p of this.players.values()) this.stepPlayer(p, dt);
    for (const u of this.units) if (!u.dead) this.stepUnit(u, dt);
    this.separate();
    for (const b of this.buildings) if (!b.dead) this.stepBuilding(b, dt);
    this.stepProjs(dt);
    this.stepBox(dt);
    for (const r of this.rocks) if (r.gold <= 0 && (r.regrow -= dt) <= 0) r.gold = 40;
    this.sheepT += dt;
    if (this.sheepT > 12) { this.sheepT = 0; if (this.units.filter((u) => !u.dead && u.kind === 'sheep').length < 6) this.spawnSheep(); }
    if (this.units.length > 400) this.units = this.units.filter((u) => !u.dead || u.kind === 'hero');
    if (this.buildings.length > 300) this.buildings = this.buildings.filter((b) => !b.dead);
    this.checkWin();
  }

  private spawnSheep() {
    const x = (2 + this.r() * (this.W - 4)) * TILE, y = (this.H / 2 + (this.r() - 0.5) * 6) * TILE;
    const s = this.addUnit('sheep', 2, -1, x, y);
    s.wx = x; s.wy = y;
  }

  private stepPlayer(p: Player, dt: number) {
    if (p.left) return;
    if (p.bot) this.botThink(p, dt);
    const hero = this.units.find((u) => u.id === p.hero);
    if (!hero) return;
    if (hero.dead && !p.ghost) {
      p.respawn -= dt;
      if (p.respawn <= 0) {
        if (this.building(p.heart)) {
          const at = this.spawnPoint(p);
          hero.dead = false; hero.x = at.x; hero.y = at.y; hero.kx = hero.ky = 0;
          hero.maxHp = CLASS[p.cls].hp; hero.hp = hero.maxHp;
          hero.frozen = hero.slow = hero.burn = hero.poison = 0;
          this.fx.push([FX.heal, at.x, at.y, 0, 0]);
        } else this.makeGhost(p, hero);
      }
    }
  }

  private makeGhost(p: Player, hero: Unit) {
    p.ghost = true;
    hero.dead = false; hero.ghost = true; hero.hp = 1;
    hero.frozen = hero.slow = hero.burn = hero.poison = 0;
    this.say.push(`${p.name} is a ghost now 👻`);
  }

  private stepUnit(u: Unit, dt: number) {
    // status effects
    if (u.burn > 0) { u.burn -= dt; this.hurtRaw(u, 12 * dt, u.burnBy); if (Math.random() < dt * 4) this.fx.push([FX.burn, u.x, u.y, 0, 0]); }
    if (u.poison > 0) { u.poison -= dt; this.hurtRaw(u, 7 * dt, u.poisonBy); if (Math.random() < dt * 3) this.fx.push([FX.poison, u.x, u.y, 0, 0]); }
    if (u.dead) return;
    if (u.frozen > 0) u.frozen -= dt;
    if (u.slow > 0) u.slow -= dt;
    u.cd -= dt;
    u.animT -= dt;
    // knockback slides and fades
    if (u.kx || u.ky) {
      this.move(u, u.kx * dt, u.ky * dt);
      const f = Math.pow(0.004, dt);
      u.kx *= f; u.ky *= f;
      if (Math.abs(u.kx) < 5 && Math.abs(u.ky) < 5) u.kx = u.ky = 0;
    }
    if (u.frozen > 0) { u.anim = 'idle'; return; }
    const slow = u.slow > 0 ? 0.5 : 1;
    if (u.kind === 'hero') this.stepHero(u, dt, slow);
    else if (u.kind === 'sheep') this.stepSheep(u, dt);
    else this.stepArmy(u, dt, slow);
  }

  private stepHero(u: Unit, dt: number, slow: number) {
    const p = this.players.get(u.owner);
    if (!p) return;
    const inp = this.inputs.get(u.owner) ?? { mx: 0, my: 0, ax: 0, ay: -1, atk: false };
    const st = CLASS[p.cls];
    const sp = (u.ghost ? 320 : st.speed) * slow;
    const m = Math.hypot(inp.mx, inp.my);
    if (m > 0.1) {
      const mx = inp.mx / Math.max(1, m), my = inp.my / Math.max(1, m);
      if (u.ghost) { u.x = clamp(u.x + mx * sp * dt, 0, this.W * TILE); u.y = clamp(u.y + my * sp * dt, 0, this.H * TILE); }
      else this.move(u, mx * sp * dt, my * sp * dt);
      if (Math.abs(mx) > 0.2) u.face = mx > 0 ? 1 : -1;
      if (u.animT <= 0) this.setAnim(u, 'run');
    } else if (u.animT <= 0) this.setAnim(u, 'idle');
    const am = Math.hypot(inp.ax, inp.ay);
    if (am > 0.01) { u.aimX = inp.ax / am; u.aimY = inp.ay / am; }
    if (u.ghost) return;
    if (inp.atk && u.cd <= 0) this.heroAttack(u, p);
  }

  private heroAttack(u: Unit, p: Player) {
    const st = CLASS[p.cls];
    u.cd = st.cd;
    if (Math.abs(u.aimX) > 0.15) u.face = u.aimX > 0 ? 1 : -1;
    const dmgMul = p.bot ? 0.8 : 1;
    if (p.cls === 'knight') {
      this.setAnim(u, u.seq % 2 ? 'attack2' : 'attack', 0.35);
      this.fx.push([FX.swing, u.x + u.aimX * 50, u.y - 30 + u.aimY * 40, Math.round(Math.atan2(u.aimY, u.aimX) * 100), 0]);
      this.meleeArc(u, p, st.range, 0.55, st.dmg * dmgMul, st.knock);
    } else if (p.cls === 'lancer') {
      this.setAnim(u, 'attack', 0.35);
      this.meleeLine(u, p, st.range, 38, st.dmg * dmgMul, st.knock);
    } else if (p.cls === 'archer') {
      this.setAnim(u, 'shoot', 0.5);
      this.projs.push({ x: u.x + u.aimX * 20, y: u.y - 40, vx: u.aimX * 820, vy: u.aimY * 820, dmg: st.dmg * dmgMul, team: u.team, owner: u.owner, life: st.range / 820, kind: 0, hero: true, knock: st.knock });
    } else {
      this.setAnim(u, 'heal', 0.6);
      this.fx.push([FX.heal, u.x, u.y, 1, 0]);
      for (const o of this.units) {
        if (o.dead || o.ghost || dist(o, u) > st.range) continue;
        if (o.team === u.team) { if (o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + 40); }
        else this.hitUnit(o, st.dmg * dmgMul, u, st.knock, p);
      }
      for (const b of this.buildings) if (!b.dead && b.team !== u.team && b.kind !== 'castle' && b.kind !== 'goldblock' && distB(b, u.x, u.y) < st.range) this.hitBuilding(b, st.dmg * dmgMul * 0.6, u.owner);
      this.mineNear(u, p, st.range);
    }
  }

  private meleeArc(u: Unit, p: Player, range: number, cosMin: number, dmg: number, knock: number) {
    const cx = u.x, cy = u.y - 20;
    for (const o of this.units) {
      if (o.dead || o.ghost || o.team === u.team) continue;
      const dx = o.x - cx, dy = (o.y - 20) - cy, d = Math.hypot(dx, dy);
      if (d > range + 18) continue;
      if (d > 24 && (dx * u.aimX + dy * u.aimY) / d < cosMin) continue;
      this.hitUnit(o, dmg, u, knock, p);
    }
    for (const b of this.buildings) {
      if (b.dead || b.team === u.team || b.kind === 'castle' || b.kind === 'goldblock') continue;
      if (distB(b, cx + u.aimX * range * 0.6, cy + u.aimY * range * 0.6) < range * 0.7) this.hitBuilding(b, dmg, u.owner);
    }
    this.mineNear(u, p, range);
  }

  private meleeLine(u: Unit, p: Player, reach: number, half: number, dmg: number, knock: number) {
    const cx = u.x, cy = u.y - 20;
    for (const o of this.units) {
      if (o.dead || o.ghost || o.team === u.team) continue;
      const dx = o.x - cx, dy = (o.y - 20) - cy;
      const along = dx * u.aimX + dy * u.aimY, side = Math.abs(-dx * u.aimY + dy * u.aimX);
      if (along < -10 || along > reach + 16 || side > half) continue;
      this.hitUnit(o, dmg, u, knock, p);
    }
    for (const b of this.buildings) {
      if (b.dead || b.team === u.team || b.kind === 'castle' || b.kind === 'goldblock') continue;
      for (const f of [0.4, 0.8, 1]) if (distB(b, cx + u.aimX * reach * f, cy + u.aimY * reach * f) < 20) { this.hitBuilding(b, dmg, u.owner); break; }
    }
    this.mineNear(u, p, reach);
  }

  /** Swinging at a gold rock gives gold. */
  private mineNear(u: Unit, p: Player, range: number) {
    for (const r of this.rocks) {
      if (r.gold <= 0) continue;
      const rx = (r.tx + 0.5) * TILE, ry = (r.ty + 0.6) * TILE;
      const dx = rx - u.x, dy = ry - (u.y - 20), d = Math.hypot(dx, dy);
      if (d > range + 30) continue;
      if (d > 40 && (dx * u.aimX + dy * u.aimY) / d < 0.3) continue;
      const got = Math.min(r.gold, 5);
      r.gold -= got; p.gold += got;
      if (r.gold <= 0) r.regrow = 30;
      this.fx.push([FX.gold, rx, ry, got, 0]);
      break;
    }
  }

  private hitUnit(o: Unit, dmg: number, by: Unit, knock: number, p?: Player) {
    if (o.dead || o.ghost) return;
    const dx = o.x - by.x, dy = o.y - by.y, d = Math.hypot(dx, dy) || 1;
    o.kx += dx / d * knock; o.ky += dy / d * knock;
    this.hurt(o, dmg, by.owner);
    this.fx.push([FX.hit, o.x, o.y - 30, 0, 0]);
    if (o.kind === 'sheep' && o.dead && p) { p.meat += 2; this.fx.push([FX.meat, o.x, o.y, 2, 0]); this.notes.push([p.slot, '+2 meat 🍖']); }
    // enchanted weapons (heroes only)
    if (p?.ench && by.kind === 'hero' && o.kind !== 'sheep') this.enchant(p.ench, o, dmg, by);
  }

  private enchant(e: Ench, o: Unit, dmg: number, by: Unit) {
    if (e === 'freeze') { o.frozen = 1.2; o.slow = 2.4; this.fx.push([FX.freeze, o.x, o.y, 0, 0]); }
    else if (e === 'burn') { o.burn = 4; o.burnBy = by.owner; }
    else if (e === 'poison') { o.poison = 7; o.poisonBy = by.owner; }
    else if (e === 'zap') {
      let best: Unit | null = null, bd = 240;
      for (const x of this.units) {
        if (x.dead || x.ghost || x === o || x.team === by.team || x.kind === 'sheep') continue;
        const d = dist(x, o); if (d < bd) { bd = d; best = x; }
      }
      if (best) { this.fx.push([FX.zap, o.x, o.y - 30, best.x, best.y - 30]); this.hurt(best, dmg * 0.6, by.owner); best.kx += (best.x - o.x) / bd * 120; best.ky += (best.y - o.y) / bd * 120; }
    }
  }

  /** Damage with armor (heroes) taken off. */
  private hurt(o: Unit, dmg: number, by: number) {
    let d = dmg;
    if (o.kind === 'hero') { const p = this.players.get(o.owner); if (p) d *= 1 - ARMOR[p.armor].cut; }
    this.hurtRaw(o, d, by);
  }

  private hurtRaw(o: Unit, d: number, by: number) {
    if (o.dead || o.ghost) return;
    o.hp -= d;
    if (o.hp > 0) return;
    o.dead = true;
    this.fx.push([FX.dust, o.x, o.y, 0, 0]);
    const killer = this.players.get(by);
    if (o.kind === 'hero') {
      const p = this.players.get(o.owner);
      if (p) {
        p.respawn = 5; p.ench = null;
        if (killer && killer.team !== p.team) { killer.kills++; killer.gold += 25; this.say.push(`${killer.name} knocked out ${p.name}!`); }
        else this.say.push(`${p.name} was knocked out.`);
        if (!this.building(p.heart)) { p.respawn = 1.2; }
      }
    } else if (o.kind !== 'sheep' && killer && killer.team !== o.team) killer.gold += 4;
  }

  private hitBuilding(b: Building, dmg: number, by: number) {
    if (b.kind === 'castle' || b.kind === 'goldblock') return;
    b.hp -= dmg;
    this.fx.push([FX.hit, b.x + (Math.random() - 0.5) * 40, b.y - 40, 0, 0]);
    if (b.hp > 0) return;
    this.removeBuilding(b);
    this.fx.push([FX.boom, b.x, b.y - 30, 0, 0]);
    const killer = this.players.get(by);
    if (b.kind === 'heart') {
      const p = this.players.get(b.owner);
      this.say.push(`💔 ${p?.name ?? 'Someone'}’s heart is broken!`);
      if (killer) killer.gold += 50;
    } else if (killer) killer.gold += Math.floor(BUILD[b.kind].cost / 3);
  }

  private stepSheep(u: Unit, dt: number) {
    u.wander -= dt;
    if (u.wander <= 0) {
      u.wander = 2 + Math.random() * 4;
      u.wx = clamp(u.x + (Math.random() - 0.5) * 300, 2 * TILE, (this.W - 2) * TILE);
      u.wy = clamp(u.y + (Math.random() - 0.5) * 200, (this.H / 2 - 4) * TILE, (this.H / 2 + 4) * TILE);
    }
    const dx = u.wx - u.x, dy = u.wy - u.y, d = Math.hypot(dx, dy);
    if (d > 8) { this.move(u, dx / d * 60 * dt, dy / d * 60 * dt); u.face = dx > 0 ? 1 : -1; this.setAnim(u, 'run'); }
    else this.setAnim(u, 'idle');
  }

  private stepArmy(u: Unit, dt: number, slow: number) {
    const st = UNIT[u.kind as Exclude<UKind, 'hero'>];
    const p = this.players.get(u.owner);
    const order: Order = p && !p.left ? p.order : 'attack';
    const heart = p ? this.building(p.heart) : undefined;
    const hero = p ? this.unit(p.hero) : undefined;
    // monks heal first
    if (u.kind === 'monk' && u.cd <= 0) {
      let best: Unit | null = null;
      for (const o of this.units) if (!o.dead && !o.ghost && o.team === u.team && o.hp < o.maxHp && dist(o, u) < st.range && (!best || o.hp / o.maxHp < best.hp / best.maxHp)) best = o;
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + st.dmg);
        u.cd = st.cd; this.setAnim(u, 'heal', 0.8); this.fx.push([FX.heal, best.x, best.y, 0, 0]);
        return;
      }
    }
    // pick a target
    const home = order === 'defend' && heart ? { x: heart.x, y: heart.team === 0 ? heart.y - 3 * TILE : heart.y + TILE } : order === 'follow' && hero && !hero.ghost ? { x: hero.x, y: hero.y } : null;
    const aggro = order === 'attack' ? 360 : 300;
    let tgt: { x: number; y: number; unit?: Unit; b?: Building } | null = null;
    let bd = aggro;
    const from = home && order === 'defend' ? home : u;
    for (const o of this.units) {
      if (o.dead || o.ghost || o.team === u.team || o.kind === 'sheep') continue;
      const d = dist(o, from);
      if (d < bd) { bd = d; tgt = { x: o.x, y: o.y, unit: o }; }
    }
    if (!tgt) for (const b of this.buildings) {
      if (b.dead || b.team === u.team || b.kind === 'castle' || b.kind === 'goldblock') continue;
      const d = distB(b, from.x, from.y);
      if (d < bd) { bd = d; tgt = { x: b.x, y: b.y - TILE * 0.5, b }; }
    }
    if (!tgt && order === 'attack') {
      // march on the nearest enemy heart
      let hd = Infinity;
      for (const b of this.buildings) if (!b.dead && b.kind === 'heart' && b.team !== u.team) { const d = distB(b, u.x, u.y); if (d < hd) { hd = d; tgt = { x: b.x, y: b.y - TILE * 0.5, b }; } }
    }
    // stuck against an enemy wall: break it
    if (u.stuck > 0.6) {
      for (const b of this.buildings) if (!b.dead && b.team !== u.team && (b.kind === 'wall') && distB(b, u.x, u.y) < 70) { tgt = { x: b.x, y: b.y - 32, b }; break; }
    }
    let goal = tgt ?? home;
    if (!goal) { if (u.animT <= 0) this.setAnim(u, 'idle'); return; }
    const reach = tgt ? (tgt.b ? st.range + (tgt.b.kind === 'wall' ? 20 : 50) : st.range) : 70;
    const dx = goal.x - u.x, dy = goal.y - u.y, d = tgt?.b ? distB(tgt.b, u.x, u.y) : Math.hypot(dx, dy);
    if (d > reach * 0.9 || (!tgt && d > 70)) {
      const m = Math.hypot(dx, dy) || 1;
      const ox = u.x, oy = u.y;
      let mx = dx / m, my = dy / m;
      if (u.stuck > 0.4) { const s = (u.id % 2 ? 1 : -1); const nx = mx + -my * s * 1.2, ny = my + mx * s * 1.2; const nm = Math.hypot(nx, ny); mx = nx / nm; my = ny / nm; }
      this.move(u, mx * st.speed * slow * dt, my * st.speed * slow * dt);
      const moved = Math.hypot(u.x - ox, u.y - oy);
      u.stuck = moved < st.speed * slow * dt * 0.3 ? u.stuck + dt : Math.max(0, u.stuck - dt * 2);
      if (Math.abs(dx) > 4) u.face = dx > 0 ? 1 : -1;
      if (u.animT <= 0) this.setAnim(u, 'run');
      goal = null;
    }
    if (goal === null) return;
    if (!tgt) { if (u.animT <= 0) this.setAnim(u, 'idle'); return; }
    if (u.cd > 0) { if (u.animT <= 0) this.setAnim(u, 'idle'); return; }
    u.cd = st.cd;
    u.face = dx > 0 ? 1 : -1;
    const m = Math.hypot(dx, dy) || 1;
    u.aimX = dx / m; u.aimY = dy / m;
    if (u.kind === 'archer') {
      this.setAnim(u, 'shoot', 0.5);
      this.projs.push({ x: u.x, y: u.y - 40, vx: dx / m * 700, vy: (dy - 0) / m * 700, dmg: st.dmg, team: u.team, owner: u.owner, life: (st.range + 60) / 700, kind: 0, hero: false, knock: 60 });
    } else if (u.kind === 'monk') {
      this.setAnim(u, 'heal', 0.6);
      this.fx.push([FX.heal, tgt.x, tgt.y, 0, 0]);
      if (tgt.unit) this.hitUnit(tgt.unit, st.dmg, u, 60); else if (tgt.b) this.hitBuilding(tgt.b, st.dmg, u.owner);
    } else {
      this.setAnim(u, u.seq % 2 ? 'attack2' : 'attack', 0.35);
      if (tgt.unit) this.hitUnit(tgt.unit, st.dmg, u, u.kind === 'lancer' ? 140 : 90);
      else if (tgt.b) this.hitBuilding(tgt.b, st.dmg, u.owner);
    }
  }

  private stepBuilding(b: Building, dt: number) {
    if (b.kind !== 'tower' && b.kind !== 'castle') return;
    b.cd -= dt;
    if (b.cd > 0) return;
    const range = b.kind === 'tower' ? 430 : 470;
    const sy = b.y - (b.kind === 'tower' ? 170 : 120);
    let best: Unit | null = null, bd = range;
    for (const u of this.units) {
      if (u.dead || u.ghost || u.team === b.team || u.kind === 'sheep') continue;
      const d = Math.hypot(u.x - b.x, u.y - b.y + 30);
      if (d < bd) { bd = d; best = u; }
    }
    if (!best) { b.cd = 0.3; return; }
    b.cd = b.kind === 'tower' ? 1.0 : 1.3;
    const dx = best.x - b.x, dy = best.y - 30 - sy, m = Math.hypot(dx, dy) || 1;
    this.projs.push({ x: b.x, y: sy, vx: dx / m * 760, vy: dy / m * 760, dmg: b.kind === 'tower' ? 22 : 15, team: b.team, owner: b.owner, life: (m + 60) / 760, kind: 0, hero: false, knock: 50 });
  }

  private stepProjs(dt: number) {
    for (const a of this.projs) {
      a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
      if (a.life <= 0) continue;
      // gold blocks stop enemy arrows
      const tx = Math.floor(a.x / TILE), ty = Math.floor((a.y + 30) / TILE);
      const gid = tx >= 0 && ty >= 0 && tx < this.W && ty < this.H ? this.grid[ty * this.W + tx] : 0;
      if (gid) {
        const b = this.buildings.find((x) => x.id === gid);
        if (b && !b.dead && b.team !== a.team) {
          a.life = 0;
          if (b.kind === 'goldblock') { this.fx.push([FX.gold, a.x, a.y + 10, 0, 1]); continue; }
          if (b.kind !== 'castle') this.hitBuilding(b, a.dmg * 0.7, a.owner);
          continue;
        }
      }
      for (const u of this.units) {
        if (u.dead || u.ghost || u.team === a.team) continue;
        if (Math.abs(u.x - a.x) < 22 && Math.abs(u.y - 30 - a.y) < 34) {
          a.life = 0;
          const p = a.hero ? this.players.get(a.owner) : undefined;
          const src = { x: a.x - a.vx * 0.05, y: a.y + 30 - a.vy * 0.05, owner: a.owner, kind: a.hero ? 'hero' : 'warrior', team: a.team } as Unit;
          this.hitUnit(u, a.dmg, src, a.knock, p);
          break;
        }
      }
      if (a.life > 0) {
        for (const r of this.rocks) if (r.gold > 0 && a.hero && Math.abs((r.tx + 0.5) * TILE - a.x) < 30 && Math.abs((r.ty + 0.5) * TILE - a.y - 20) < 30) {
          const p = this.players.get(a.owner);
          if (p) { const got = Math.min(r.gold, 4); r.gold -= got; p.gold += got; if (r.gold <= 0) r.regrow = 30; this.fx.push([FX.gold, a.x, a.y, got, 0]); }
          a.life = 0; break;
        }
      }
    }
    this.projs = this.projs.filter((a) => a.life > 0 && a.x > 0 && a.y > -100 && a.x < this.W * TILE && a.y < this.H * TILE + 100);
  }

  private stepBox(dt: number) {
    const b = this.box;
    if (b.state === 0) {
      this.nextBox -= dt;
      if (Math.abs(this.nextBox - 10) < dt / 2 + 0.001) this.say.push('🎁 A mystery box drops in 10 seconds!');
      if (this.nextBox <= 0) {
        this.nextBox = BOX_EVERY;
        b.state = 1; b.land = 3; b.x = this.W * TILE / 2; b.y = this.H * TILE / 2 + 20;
        this.say.push('🎁 A mystery box is falling from the sky!');
      }
    } else if (b.state === 1) {
      b.land -= dt;
      if (b.land <= 0) { b.state = 2; this.fx.push([FX.dust, b.x, b.y, 0, 0]); }
    } else {
      for (const u of this.units) {
        if (u.dead || u.ghost || u.kind !== 'hero' || Math.hypot(u.x - b.x, u.y - b.y) > 50) continue;
        const p = this.players.get(u.owner);
        if (!p) continue;
        const e = ENCHANTS[Math.floor(this.r() * ENCHANTS.length)];
        p.ench = e;
        b.state = 0;
        this.fx.push([FX.box, b.x, b.y, ENCHANTS.indexOf(e), 0]);
        this.say.push(`🎁 ${p.name} got ${ENCH[e].name} ${ENCH[e].icon}!`);
        break;
      }
    }
  }

  private checkWin() {
    for (const team of [0, 1]) {
      const hearts = this.buildings.filter((b) => b.kind === 'heart' && b.team === team);
      if (hearts.length && hearts.every((b) => b.dead)) { this.over = 1 - team; this.say.push(`${TEAM_NAMES[1 - team]} team wins!`); return; }
    }
  }

  private setAnim(u: Unit, a: Anim, hold = 0) {
    if (u.anim !== a || hold) { u.anim = a; u.seq++; }
    if (hold) u.animT = hold;
  }

  /** Can a unit of this team stand on this tile? */
  private open(tx: number, ty: number, team: number) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return false;
    const id = this.grid[ty * this.W + tx];
    if (!id) return true;
    const b = this.buildings.find((x) => x.id === id);
    if (!b || b.dead) return true;
    if (b.kind === 'goldblock') return true;
    if (b.kind === 'wall' && b.team === team) return true;
    return false;
  }

  private move(u: Unit, dx: number, dy: number) {
    const r = u.kind === 'sheep' ? 14 : 18;
    const ok = (x: number, y: number) => {
      if (x < TILE * 0.6 || y < TILE * 0.8 || x > (this.W - 0.6) * TILE || y > (this.H - 0.3) * TILE) return false;
      const team = u.team;
      return this.open(Math.floor((x - r) / TILE), Math.floor((y - 8) / TILE), team) && this.open(Math.floor((x + r) / TILE), Math.floor((y - 8) / TILE), team)
        && this.open(Math.floor((x - r) / TILE), Math.floor((y + 4) / TILE), team) && this.open(Math.floor((x + r) / TILE), Math.floor((y + 4) / TILE), team);
    };
    if (ok(u.x + dx, u.y)) u.x += dx;
    if (ok(u.x, u.y + dy)) u.y += dy;
  }

  /** Units gently push apart so armies don't stack into one spot. */
  private separate() {
    const list = this.units.filter((u) => !u.dead && !u.ghost);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= 28) continue;
      const push = (28 - d) * 0.25;
      const nx = dx / d * push, ny = dy / d * push;
      this.move(a, -nx, -ny); this.move(b, nx, ny);
    }
  }

  // ---------- bots ----------
  private botThink(p: Player, dt: number) {
    const hero = this.unit(p.hero);
    const heart = this.building(p.heart);
    const inp: Input = this.inputs.get(p.slot) ?? { mx: 0, my: 0, ax: 0, ay: -1, atk: false };
    this.inputs.set(p.slot, inp);
    p.think -= dt;
    if (p.think <= 0 && !p.ghost && heart) {
      p.think = 2 + this.r() * 1.5;
      // spend gold: barracks first, then warriors, sometimes a house or a tower
      const mine = this.buildings.filter((b) => !b.dead && b.owner === p.slot);
      const barracks = mine.find((b) => b.kind === 'barracks');
      const want: BKind | null = !barracks ? 'barracks' : this.army(p.slot) >= this.cap(p.slot) - 1 && mine.filter((b) => b.kind === 'house').length < 4 ? 'house' : !mine.some((b) => b.kind === 'tower') && p.gold > 160 ? 'tower' : null;
      if (want && p.gold >= BUILD[want].cost) this.botBuild(p, want, heart);
      else if (barracks && p.gold >= 20 && this.army(p.slot) < this.cap(p.slot)) this.cmd(p.slot, { t: 'train', bid: barracks.id, kind: this.r() < 0.25 && p.gold >= 35 ? 'lancer' : 'warrior' });
      // bots wait a bit before they march, so new players get time to set up
      p.order = (this.t > 90 && this.army(p.slot) >= 6) || this.t > 300 ? 'attack' : 'defend';
      if (hero && hero.hp < hero.maxHp * 0.45 && p.meat > 0) this.cmd(p.slot, { t: 'eat' });
      if (hero && this.r() < 0.04) this.cmd(p.slot, { t: 'taunt' });
    }
    if (!hero || p.ghost) {
      // ghosts drift around the middle
      if (hero) { const t = this.t * 0.3 + p.slot; inp.mx = Math.cos(t); inp.my = Math.sin(t * 1.3); inp.atk = false; }
      return;
    }
    // what to go for: the box, enemies close by (or near my heart), a gold rock, the enemy hearts
    let gx = hero.x, gy = hero.y, fight: Unit | null = null, rock = false;
    if (this.box.state === 2) { gx = this.box.x; gy = this.box.y; }
    else {
      let bd = 420;
      for (const o of this.units) {
        if (o.dead || o.ghost || o.team === hero.team || o.kind === 'sheep') continue;
        const d = Math.min(dist(o, hero), heart ? Math.hypot(o.x - heart.x, o.y - heart.y) * 0.8 : Infinity);
        if (d < bd) { bd = d; fight = o; }
      }
      if (fight) { gx = fight.x; gy = fight.y; }
      else if (p.order === 'attack' && this.army(p.slot) >= 3) {
        let hd = Infinity;
        for (const b of this.buildings) if (!b.dead && b.kind === 'heart' && b.team !== hero.team) { const d = distB(b, hero.x, hero.y); if (d < hd) { hd = d; gx = b.x; gy = b.team === 0 ? b.y - 2.4 * TILE : b.y + 0.4 * TILE; } }
      } else {
        let rd = Infinity;
        for (const r of this.rocks) if (r.gold > 0) { const x = (r.tx + 0.5) * TILE, y = (r.ty + (hero.team === 0 ? 1.3 : -0.2)) * TILE; const d = Math.hypot(x - hero.x, y - hero.y) + (hero.team === 0 ? (r.ty < this.H / 2 ? 300 : 0) : (r.ty > this.H / 2 ? 300 : 0)); if (d < rd) { rd = d; gx = x; gy = y; rock = true; } }
      }
    }
    const st = CLASS[p.cls];
    const dx = gx - hero.x, dy = gy - hero.y, d = Math.hypot(dx, dy);
    const want = fight ? (p.cls === 'archer' ? st.range * 0.6 : st.range * 0.7) : rock ? 50 : 30;
    if (d > want) { inp.mx = dx / d; inp.my = dy / d; } else { inp.mx = 0; inp.my = 0; }
    if (p.cls === 'archer' && fight && d < st.range * 0.35) { inp.mx = -dx / d; inp.my = -dy / d; }
    inp.ax = dx / (d || 1); inp.ay = (dy - (rock ? 20 : 0)) / (d || 1);
    const enemyHeartClose = this.buildings.some((b) => !b.dead && b.team !== hero.team && b.kind !== 'castle' && b.kind !== 'goldblock' && distB(b, hero.x, hero.y) < st.range * 0.9);
    inp.atk = (fight !== null && d < st.range + 10) || (rock && d < 90) || enemyHeartClose;
  }

  private botBuild(p: Player, kind: BKind, heart: Building) {
    const s = BUILD[kind];
    for (let tries = 0; tries < 40; tries++) {
      const tx = Math.round(heart.tx + (this.r() - 0.5) * 14);
      const ty = p.team === 0 ? Math.round(heart.ty - 3 - this.r() * 8) : Math.round(heart.ty + 3 + this.r() * 8);
      if (!this.canPlace(kind, p.team, tx, ty)) {
        // leave a lane open in front of the heart
        if (Math.abs(tx + s.w / 2 - heart.x / TILE) < 2.5) continue;
        this.cmd(p.slot, { t: 'build', kind, tx, ty });
        return;
      }
    }
  }

  // ---------- snapshots ----------
  snapshot(): Snap {
    const e: number[][] = [];
    for (const u of this.units) {
      if (u.dead) continue;
      const flags = (u.face < 0 ? 1 : 0) | (u.frozen > 0 ? 2 : 0) | (u.burn > 0 ? 4 : 0) | (u.poison > 0 ? 8 : 0) | (u.ghost ? 16 : 0) | (u.slow > 0 ? 32 : 0);
      const cls = u.kind === 'hero' ? CLASSES.indexOf(this.players.get(u.owner)?.cls ?? 'knight') : 0;
      e.push([u.id, UKINDS.indexOf(u.kind), u.team, Math.round(u.x), Math.round(u.y), ANIMS.indexOf(u.anim), u.seq, flags, Math.ceil(u.hp / u.maxHp * 100), u.owner, cls, Math.round(Math.atan2(u.aimY, u.aimX) * 100)]);
    }
    const b: number[][] = [];
    for (const x of this.buildings) if (!x.dead) b.push([x.id, BKINDS.indexOf(x.kind), x.team, x.x, x.y, x.kind === 'heart' ? Math.ceil(x.hp) : Math.ceil(x.hp / x.maxHp * 100), x.owner, x.variant, x.tx, x.ty]);
    const a = this.projs.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(Math.atan2(p.vy, p.vx) * 100), p.kind]);
    const ps: PView[] = [...this.players.values()].filter((p) => !p.left).map((p) => ({
      slot: p.slot, name: p.name, team: p.team, bot: p.bot, hero: p.hero, heart: p.heart, gold: Math.floor(p.gold), meat: p.meat, armor: p.armor, cls: p.cls,
      ench: p.ench, respawn: Math.max(0, p.respawn), ghost: p.ghost, order: p.order, army: this.army(p.slot), cap: this.cap(p.slot), kills: p.kills,
      taunt: p.taunt, tauntAt: p.tauntAt,
    }));
    const s: Snap = {
      W: this.W, H: this.H, t: this.t, e, b, a, fx: this.fx, ps,
      box: [this.box.state, this.box.x, this.box.y, Math.max(0, this.box.land)], next: this.nextBox,
      rocks: this.rocks.map((r) => [r.id, r.tx, r.ty, r.gold]), over: this.over, say: this.say, note: this.notes,
    };
    this.fx = []; this.say = []; this.notes = [];
    return s;
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** Distance from a point to the nearest edge of a building's footprint. */
function distB(b: Building, x: number, y: number) {
  const s = BUILD[b.kind];
  const x0 = b.tx * TILE, x1 = (b.tx + s.w) * TILE, y0 = b.ty * TILE, y1 = (b.ty + s.h) * TILE;
  const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1);
  return Math.hypot(dx, dy);
}
