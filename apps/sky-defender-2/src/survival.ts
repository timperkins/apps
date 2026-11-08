// Survival: a top-down mode. A little guy with a crossbow walks around a walled base while
// slow bears gather at the gate; a bear that has waited 30 seconds there comes in.
import { Sound } from './audio';

/** Tim's numbers. Damage and healing are shares of max health. */
export const SURVIVAL = {
  maxHp: 1_000_000,
  bearHit: .08,         // a bear hit takes 8% of max health
  bearCooldown: 5,      // seconds between one bear's hits
  heal: .012,           // the guy heals 1.2% of max health every second
  bearHp: 10.5,
  gateWait: 30,         // seconds a bear waits at the gate before it comes in
  gateWaitLater: 20,    // ...and after the first 4 bears are defeated
  rushKills: 4,         // bears to defeat before the gate wait drops and the mine and machine appear
  bearThrow: .09,       // a bear inside throws a rock that takes 9% of max health
  throwCooldown: 5,
  throwSpeed: 170,
  mineEvery: 2,         // mining gives a stone every 2 seconds
  minerCost: 10,        // stone to hire the first miner
  extraMinerCost: 20,   // stone for each extra miner
  maxMiners: 6,
  minerEvery: 5,        // the miner digs a stone every 5 seconds
  beltCost: 5,          // stone for a belt in the shop
  beltLength: 3,        // one belt from the shop lays 3 tiles
  shortBeltCost: 5,     // 3 one-tile belts for 5 stone
  shortBeltPack: 3,
  splitterCost: 4,      // stone for a splitter
  splitTime: .3,        // seconds between stones out of a splitter
  chestCost: 10,        // stone for a chest
  chestSize: 200,       // a chest holds 200 stone
  turretCost: 15,       // stone for a turret in the shop
  turretDamage: 5.25,
  turretReload: 2,
  turretRange: 280,
  grabberCost: 3,       // stone for a grabber in the shop
  grabTime: 1,          // seconds for a grabber to move one stone
  mineBears: .6,        // after the mine checkpoint, 40% fewer bears
  beltSpeed: 45,        // how fast a belt carries stone (and you)
  batchTime: 4,         // the machine turns each stone into stone ammo in 4 seconds
  batchAmmo: 5,         // stone ammo per stone
  stoneDamage: 1.7,     // stone ammo does 1.7x normal ammo damage
  targetRange: 300,     // space bar only fires if a bear is this close (world units)
  boltRange: 420,
  boltSpeed: 520,
  guySpeed: 120,
  bearEvery: 10,        // seconds between bears
  bearSpeed: 20,        // slow
  bearSpeedInside: 26,
};

export type AmmoId = 'normal' | 'quick' | 'heavy';
export const AMMO: Record<AmmoId, { name: string; reload: number; damage: number; color: string; desc: string }> = {
  normal: { name: 'Normal', reload: 3, damage: 3.5, color: '#e8d9b8', desc: '3 s reload, 3.5 damage' },
  quick: { name: 'Quick', reload: 1.5, damage: 2.1, color: '#9fe6ff', desc: '1.5 s reload, 2.1 damage' },
  heavy: { name: 'Heavy', reload: 5, damage: 5.25, color: '#ff9a6a', desc: '5 s reload, 5.25 damage' },
};
export type HatId = 'none' | 'cap' | 'helmet' | 'crown';
export const HATS: Record<HatId, string> = { none: 'No hat', cap: 'Cap', helmet: 'Helmet', crown: 'Crown' };
export const COLORS = ['#3f7fd6', '#d64545', '#3ea860', '#e0a32e', '#8e5bd6', '#e06aa8', '#30b8b0', '#f2f2f2'];
export interface Loadout { name: string; color: string; hat: HatId; ammo: AmmoId; }
export interface SurvivalResult { time: number; kills: number; shots: number; hits: number; damage: number; }

// world layout (world units; the whole map is scaled to fit the screen)
const W = 600, H = 920;
const WALL = { x0: 110, x1: 490, y0: 400, y1: 860, t: 14 };
const GATE = { x: 300, w: 74 };
const GUY_R = 13, BEAR_R = 18, STONE = '#a9a59c';
// belts sit on a grid inside the walls
const TILE = 24, GX0 = WALL.x0 + WALL.t, GY0 = WALL.y0 + WALL.t;
const COLS = Math.floor((WALL.x1 - WALL.t - GX0) / TILE), ROWS = Math.floor((WALL.y1 - WALL.t - GY0) / TILE);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const; // right, down, left, up
const SHOP = { x: WALL.x1 - 62, y: WALL.y1 - 62, r: 26 };
/** Something on the ground or a belt: a stone, or (ammo) a piece of stone ammo from the machine. */
interface Item { x: number; y: number; gone?: boolean; ammo?: boolean; }
/** What a chest holds. */
interface Chest { stone: number; ammo: number; }
/** A grabber picks stone up from the tile behind it and puts it down on the tile in front. */
interface Grabber { d: number; t: number; carry: boolean; ammo?: boolean; }
/** A turret shoots the nearest bear in range, one ammo a shot. */
interface Turret { ammo: number; cd: number; face: number; }
type Placeable = 'belt' | 'short' | 'grab' | 'turret' | 'split' | 'chest';
/** A splitter takes stone in and sends it out to its left and right in turn. */
interface Splitter { d: number; buf: boolean[]; side: number; t: number; }
// where hired miners stand, relative to the mine
const MINER_SPOTS = [[-4, 30], [32, 22], [-30, 26], [36, -8], [8, -32], [-32, -14]] as const;
const MINE = { x: WALL.x0 + 62, y: WALL.y0 + 95, r: 24 }, MACHINE = { x: WALL.x1 - 62, y: WALL.y0 + 215, r: 26 }, NEAR = 58;

type BearState = 'walk' | 'wait' | 'enter' | 'inside' | 'dead';
interface Bear { tc: number; id: number; x: number; y: number; hp: number; state: BearState; wait: number; tx: number; ty: number; cd: number; face: number; swipe: number; hurt: number; dead: number; step: number; }
interface Bolt { stone: boolean; x: number; y: number; vx: number; vy: number; left: number; dmg: number; target: Bear | null; }
interface Rock { x: number; y: number; vx: number; vy: number; left: number; spin: number; }
interface Bubble { x: number; y: number; text: string; t: number; kind: 'loss' | 'dmg' | 'info'; }

export interface SurvivalHooks { over(r: SurvivalResult): void; pause(): void; }

export class Survival {
  running = false;
  paused = false;
  private ctx: CanvasRenderingContext2D;
  private load!: Loadout;
  private hp = SURVIVAL.maxHp;
  private x = 300; private y = 640; private face = -Math.PI / 2;
  private reload = 0;
  private bears: Bear[] = [];
  private bolts: Bolt[] = [];
  private bubbles: Bubble[] = [];
  private t = 0; private healT = 0; private spawnT = 0; private nextId = 1; private kills = 0;
  private shots = 0; private hits = 0; private damage = 0;
  private gateOpen = 0; private hurtFlash = 0; private walk = 0;
  private keys = new Set<string>();
  private stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private scale = 1; private ox = 0; private oy = 0; private cw = 0;
  private decor: { x: number; y: number; r: number; k: number }[] = [];
  private noTargetT = 0;
  private rocks: Rock[] = [];
  private gateWait = SURVIVAL.gateWait;
  private mineOn = false; private mining = false; private mineT = 0; private swing = 0;
  private belts = new Map<string, number>(); private items: Item[] = []; private inv = 0; private placing = false; private placeDir = 0;
  private invGrab = 0; private placeType: Placeable = 'belt'; private invTurret = 0; private invShort = 0; private invSplit = 0; private invChest = 0; private splitters = new Map<string, Splitter>(); private chests = new Map<string, Chest>(); private machineAmmo = 0; private tap: { id: number; x: number; y: number; t: number } | null = null; private turrets = new Map<string, Turret>(); private grabbers = new Map<string, Grabber>();
  private hover: { c: number; r: number; t: number } | null = null; shopOpen = false; helpText = 'Drag anywhere to walk';
  private miners: number[] = []; private popT = 0; private stones = 0; private queue = 0; private batchT = 0; private stoneAmmo = 0; private useStone = false;

  constructor(private canvas: HTMLCanvasElement, private pad: HTMLElement, private hooks: SurvivalHooks) {
    this.ctx = canvas.getContext('2d')!;
    // fixed scenery: trees and bushes outside the walls, tufts inside
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H;
      const inBase = x > WALL.x0 - 30 && x < WALL.x1 + 30 && y > WALL.y0 - 40 && y < WALL.y1 + 30;
      const nearGate = Math.abs(x - GATE.x) < 190 && y > 170 && y < WALL.y0;
      if (inBase) { if (x > WALL.x0 + 30 && x < WALL.x1 - 30 && y > WALL.y0 + 30 && y < WALL.y1 - 30) this.decor.push({ x, y, r: 3 + rnd() * 3, k: 2 }); continue; }
      if (nearGate) continue;
      this.decor.push({ x, y, r: 10 + rnd() * 14, k: rnd() < .55 ? 0 : 1 });
    }
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    const up = (e: PointerEvent) => {
      if (this.stick && this.stick.id === e.pointerId) this.stick = null;
      // a quick tap (not a drag) on a belt, grabber or turret picks it up
      const tp = this.tap; this.tap = null;
      if (tp && tp.id === e.pointerId && e.type === 'pointerup' && Math.hypot(e.offsetX - tp.x, e.offsetY - tp.y) < 10 && e.timeStamp - tp.t < 400 && this.running && !this.paused && !this.shopOpen) {
        const t = tileAt((e.offsetX - this.ox) / this.scale, (e.offsetY - this.oy) / this.scale);
        if (t) this.pickUp(t.c, t.r);
      }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    const btn = (id: string, f: () => void) => pad.querySelector<HTMLElement>(id)!.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (this.running && !this.paused) f(); });
    btn('#svTarget', () => this.shoot(true));
    btn('#svFree', () => this.shoot(false));
    btn('#svPause', () => this.hooks.pause());
    btn('#svMine', () => this.action());
    btn('#svAmmoBtn', () => this.switchAmmo());
    btn('#svHire', () => this.hire());
    btn('#svShopBtn', () => this.openShop());
    btn('#svInv', () => this.togglePlacing('belt'));
    btn('#svInvGrab', () => this.togglePlacing('grab'));
    btn('#svInvTurret', () => this.togglePlacing('turret'));
    btn('#svInvShort', () => this.togglePlacing('short'));
    btn('#svInvSplit', () => this.togglePlacing('split'));
    btn('#svInvChest', () => this.togglePlacing('chest'));
    btn('#svLoad', () => this.useNear());
    btn('#svRotate', () => this.rotate());
    pad.querySelector('#svBuyBelt')!.addEventListener('click', e => { e.stopPropagation(); this.buyBelt(); });
    pad.querySelector('#svBuyGrab')!.addEventListener('click', e => { e.stopPropagation(); this.buyGrabber(); });
    pad.querySelector('#svBuySplit')!.addEventListener('click', e => { e.stopPropagation(); this.buy('split'); });
    pad.querySelector('#svBuyChest')!.addEventListener('click', e => { e.stopPropagation(); this.buy('chest'); });
    pad.querySelector('#svBuyShort')!.addEventListener('click', e => { e.stopPropagation(); this.buyShort(); });
    pad.querySelector('#svBuyTurret')!.addEventListener('click', e => { e.stopPropagation(); this.buyTurret(); });
    pad.querySelector('#svShopClose')!.addEventListener('click', e => { e.stopPropagation(); this.closeShop(); });
    addEventListener('keydown', e => {
      if (!this.running || this.paused) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (this.shopOpen) { if (k === 'b' || k === 'Escape') this.closeShop(); else if (k === 'Enter' && !e.repeat) this.buyBelt(); return; }
      if (k === 'b') { if (!e.repeat) this.openShop(); return; }
      if (k === 'e') { if (!e.repeat) this.togglePlacing('belt'); return; }
      if (k === 'g') { if (!e.repeat) this.togglePlacing('grab'); return; }
      if (k === 'u') { if (!e.repeat) this.togglePlacing('turret'); return; }
      if (k === 'q') { if (!e.repeat) this.togglePlacing('short'); return; }
      if (k === 'x') { if (!e.repeat) this.togglePlacing('split'); return; }
      if (k === 'c') { if (!e.repeat) this.togglePlacing('chest'); return; }
      if (k === 't') { if (!e.repeat) this.useNear(); return; }
      if (k === 'r') { if (!e.repeat) this.rotate(); return; }
      if (this.placing && k === 'Enter') { const t = this.ghost(); if (t) this.placeAt(t.c, t.r); return; }
      if (this.placing && k === 'Escape') { this.placing = false; return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.shoot(true); return; }
      if (k === 'z') { if (!e.repeat) this.shoot(false); return; }
      if (k === 'p' || k === 'Escape') { this.hooks.pause(); return; }
      if (k === 'm') { if (!e.repeat) this.action(); return; }
      if (k === 's') { if (!e.repeat) this.switchAmmo(); return; }
      if (k === 'h') { if (!e.repeat) this.hire(); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); this.keys.add(k); }
    });
    addEventListener('keyup', e => this.keys.delete(e.key));
    addEventListener('blur', () => this.keys.clear());
  }

  start(load: Loadout) {
    this.load = load;
    this.hp = SURVIVAL.maxHp; this.x = 300; this.y = 660; this.face = -Math.PI / 2; this.reload = 0;
    this.bears = []; this.bolts = []; this.bubbles = [];
    this.t = 0; this.healT = 0; this.spawnT = 2; this.kills = 0; this.shots = 0; this.hits = 0; this.damage = 0;
    this.gateOpen = 0; this.hurtFlash = 0; this.keys.clear(); this.stick = null;
    this.rocks = []; this.gateWait = SURVIVAL.gateWait;
    this.mineOn = false; this.mining = false; this.mineT = 0; this.swing = 0; this.popT = 0; this.miners = [];
    this.belts.clear(); this.items = []; this.inv = 0; this.placing = false; this.placeDir = 0; this.hover = null; this.closeShop();
    this.invGrab = 0; this.placeType = 'belt'; this.grabbers.clear(); this.invTurret = 0; this.turrets.clear(); this.invShort = 0; this.tap = null; this.invSplit = 0; this.invChest = 0; this.splitters.clear(); this.chests.clear(); this.machineAmmo = 0;
    this.stones = 0; this.queue = 0; this.batchT = 0; this.stoneAmmo = 0; this.useStone = false;
    this.running = true; this.paused = false;
    this.canvas.hidden = false; this.pad.hidden = false;
    this.say('Bears are coming. Shoot them before they get in!');
  }
  stop() { this.running = false; this.paused = false; this.canvas.hidden = true; this.pad.hidden = true; this.keys.clear(); this.stick = null; }

  /* ---------- input ---------- */
  private down(e: PointerEvent) {
    e.preventDefault();
    if (!this.running || this.paused || this.shopOpen) return;
    const wx = (e.offsetX - this.ox) / this.scale, wy = (e.offsetY - this.oy) / this.scale;
    // placing a belt: tap the spot
    if (this.placing) { const t = tileAt(wx, wy); if (t) { this.placeAt(t.c, t.r); return; } }
    // a tap on the machine uses it, a tap on the shop opens it
    if (this.mineOn) {
      if (Math.hypot(wx - MACHINE.x, wy - MACHINE.y) < MACHINE.r + 10) { this.useMachine(); return; }
      if (Math.hypot(wx - SHOP.x, wy - SHOP.y) < SHOP.r + 10) { this.openShop(); return; }
    }
    // anywhere on the map works as a joystick: drag from where the finger lands
    this.stick = { id: e.pointerId, ox: e.offsetX, oy: e.offsetY, dx: 0, dy: 0 };
    this.tap = { id: e.pointerId, x: e.offsetX, y: e.offsetY, t: e.timeStamp };
  }
  private move(e: PointerEvent) {
    // with a mouse, the belt being placed follows the pointer
    if (this.placing && e.pointerType === 'mouse') {
      const t = tileAt((e.offsetX - this.ox) / this.scale, (e.offsetY - this.oy) / this.scale);
      this.hover = t ? { ...t, t: performance.now() } : null;
    }
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    s.dx = e.offsetX - s.ox; s.dy = e.offsetY - s.oy;
    const m = Math.hypot(s.dx, s.dy), max = 46;
    if (m > max) { s.ox += s.dx * (1 - max / m); s.oy += s.dy * (1 - max / m); s.dx *= max / m; s.dy *= max / m; }
  }

  /** Space shoots at the nearest bear in range; Z shoots straight ahead with no target. */
  private shoot(targeted: boolean) {
    if (this.reload > 0) { Sound.click(); return; }
    let target: Bear | null = null;
    if (targeted) {
      let best = SURVIVAL.targetRange;
      for (const b of this.bears) {
        if (b.state === 'dead') continue;
        const d = Math.hypot(b.x - this.x, b.y - this.y);
        if (d < best) { best = d; target = b; }
      }
      if (!target) {
        if (this.noTargetT <= 0) { this.bubble(this.x, this.y - 30, 'No bear in range', 'info'); this.noTargetT = 1.2; }
        Sound.denied();
        return;
      }
      this.face = Math.atan2(target.y - this.y, target.x - this.x);
    }
    const a = this.face, ammo = AMMO[this.load.ammo];
    // stone ammo: 1.7x normal damage, and each shot uses one up
    const stone = this.useStone && this.stoneAmmo > 0;
    const dmg = stone ? AMMO.normal.damage * SURVIVAL.stoneDamage : ammo.damage;
    if (stone) { this.stoneAmmo--; if (!this.stoneAmmo) { this.useStone = false; this.bubble(this.x, this.y - 30, 'Out of stone ammo', 'info'); } }
    this.mining = false;
    this.bolts.push({ x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: SURVIVAL.boltRange, dmg, target, stone });
    this.reload = ammo.reload;
    this.shots++;
    Sound.tone('triangle', 900, 260, .12, .14); Sound.noise(.08, 'highpass', 2400, .8, .1);
  }

  /** M: start or stop mining when next to the mine, or use the machine when next to it. */
  private action() {
    if (!this.mineOn) return;
    if (dist(this.x, this.y, MINE.x, MINE.y) < NEAR) {
      this.mining = !this.mining; this.mineT = 0;
      if (this.mining) this.face = Math.atan2(MINE.y - this.y, MINE.x - this.x);
      Sound.ui();
    } else if (dist(this.x, this.y, MACHINE.x, MACHINE.y) < NEAR) this.useMachine();
    else this.bubble(this.x, this.y - 30, 'Walk to the mine or the machine', 'info');
  }
  /** The machine takes all your stone; each stone is a batch that gives 5 stone ammo after 4 seconds. */
  private useMachine() {
    if (dist(this.x, this.y, MACHINE.x, MACHINE.y) > NEAR) { this.bubble(MACHINE.x, MACHINE.y - 36, 'Walk to the machine', 'info'); Sound.denied(); return; }
    if (!this.stones) { this.bubble(MACHINE.x, MACHINE.y - 36, 'No stone to put in', 'info'); Sound.denied(); return; }
    this.bubble(MACHINE.x, MACHINE.y - 36, `${this.stones} stone in`, 'info');
    this.queue += this.stones; this.stones = 0;
    Sound.thump();
  }
  /* ---------- shop, inventory and belts ---------- */
  private openShop() {
    if (!this.mineOn) return;
    if (dist(this.x, this.y, SHOP.x, SHOP.y) > NEAR + 6) { this.bubble(SHOP.x, SHOP.y - 36, 'Walk to the shop', 'info'); Sound.denied(); return; }
    this.shopOpen = true; this.stick = null; this.keys.clear(); this.mining = false;
    this.renderShop();
    this.pad.querySelector<HTMLElement>('#svShop')!.hidden = false;
    Sound.ui();
  }
  private closeShop() { this.shopOpen = false; this.pad.querySelector<HTMLElement>('#svShop')!.hidden = true; }
  private renderShop() {
    this.pad.querySelector('#svShopStone')!.textContent = String(this.stones);
    (this.pad.querySelector('#svBuySplit') as HTMLButtonElement).disabled = this.stones < SURVIVAL.splitterCost;
    (this.pad.querySelector('#svBuyChest') as HTMLButtonElement).disabled = this.stones < SURVIVAL.chestCost;
    (this.pad.querySelector('#svBuyShort') as HTMLButtonElement).disabled = this.stones < SURVIVAL.shortBeltCost;
    const have = [this.inv ? `${this.inv} long belt${this.inv > 1 ? 's' : ''}` : '', this.invShort ? `${this.invShort} short belt${this.invShort > 1 ? 's' : ''}` : '', this.invGrab ? `${this.invGrab} grabber${this.invGrab > 1 ? 's' : ''}` : '', this.invTurret ? `${this.invTurret} turret${this.invTurret > 1 ? 's' : ''}` : '', this.invSplit ? `${this.invSplit} splitter${this.invSplit > 1 ? 's' : ''}` : '', this.invChest ? `${this.invChest} chest${this.invChest > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
    (this.pad.querySelector('#svBuyTurret') as HTMLButtonElement).disabled = this.stones < SURVIVAL.turretCost;
    this.pad.querySelector('#svShopInv')!.textContent = have ? `In your inventory: ${have}` : '';
    (this.pad.querySelector('#svBuyBelt') as HTMLButtonElement).disabled = this.stones < SURVIVAL.beltCost;
    (this.pad.querySelector('#svBuyGrab') as HTMLButtonElement).disabled = this.stones < SURVIVAL.grabberCost;
  }
  private buyBelt() {
    if (this.stones < SURVIVAL.beltCost) { Sound.denied(); return; }
    this.stones -= SURVIVAL.beltCost; this.inv++;
    Sound.pop(); this.renderShop();
  }
  private buyGrabber() {
    if (this.stones < SURVIVAL.grabberCost) { Sound.denied(); return; }
    this.stones -= SURVIVAL.grabberCost; this.invGrab++;
    Sound.pop(); this.renderShop();
  }
  private buyTurret() {
    if (this.stones < SURVIVAL.turretCost) { Sound.denied(); return; }
    this.stones -= SURVIVAL.turretCost; this.invTurret++;
    Sound.pop(); this.renderShop();
  }
  private buy(type: 'split' | 'chest') {
    const cost = type === 'split' ? SURVIVAL.splitterCost : SURVIVAL.chestCost;
    if (this.stones < cost) { Sound.denied(); return; }
    this.stones -= cost; if (type === 'split') this.invSplit++; else this.invChest++;
    Sound.pop(); this.renderShop();
  }
  /** The chest next to the guy, if any. */
  private nearChest() {
    for (const key of this.chests.keys()) { const [c, r] = key.split(',').map(Number); if (dist(this.x, this.y, tileX(c), tileY(r)) < NEAR) return key; }
    return null;
  }
  /** T: take the stone out of a chest next to you, or load a turret next to you. */
  private useNear() {
    const ck = this.nearChest();
    const ch = ck ? this.chests.get(ck)! : null;
    if (ch && (ch.stone + ch.ammo > 0 || !this.stoneAmmo)) {
      if (!ch.stone && !ch.ammo) { this.bubble(this.x, this.y - 30, 'The chest is empty', 'info'); Sound.denied(); return; }
      this.bubble(this.x, this.y - 30, [ch.stone ? `+${ch.stone} stone` : '', ch.ammo ? `+${ch.ammo} stone ammo` : ''].filter(Boolean).join(', '), 'info');
      this.stones += ch.stone; this.stoneAmmo += ch.ammo; ch.stone = 0; ch.ammo = 0;
      Sound.thump();
      return;
    }
    this.loadTurret();
  }
  /** T next to a turret: put all your stone ammo in it. */
  private loadTurret() {
    let best: Turret | null = null, bd = NEAR;
    for (const [key, tu] of this.turrets) { const [c, r] = key.split(',').map(Number), d = dist(this.x, this.y, tileX(c), tileY(r)); if (d < bd) { bd = d; best = tu; } }
    if (!best) { this.bubble(this.x, this.y - 30, 'Walk to a turret to load it', 'info'); Sound.denied(); return; }
    if (!this.stoneAmmo) { this.bubble(this.x, this.y - 30, 'No stone ammo to load. Make some in the machine', 'info'); Sound.denied(); return; }
    this.bubble(this.x, this.y - 30, `Loaded ${this.stoneAmmo} ammo`, 'info');
    best.ammo += this.stoneAmmo; this.stoneAmmo = 0; this.useStone = false;
    Sound.thump();
  }
  private count(type: Placeable) { return { belt: this.inv, short: this.invShort, grab: this.invGrab, turret: this.invTurret, split: this.invSplit, chest: this.invChest }[type]; }
  /** Puts one stone into whatever is at (c, r): the machine, a turret, a chest, a splitter or a free belt. False if it can't take it. */
  private deliver(c: number, r: number, ammo = false) {
    const x = tileX(c), y = tileY(r), key = c + ',' + r;
    // the machine only takes raw stone
    if (this.isMachine(c, r)) { if (ammo) return false; this.queue++; this.bubble(MACHINE.x, MACHINE.y - 36, 'Stone in', 'info'); return true; }
    const tu = this.turrets.get(key); if (tu) { tu.ammo++; return true; }
    const ch = this.chests.get(key); if (ch) { if (ch.stone + ch.ammo >= SURVIVAL.chestSize) return false; if (ammo) ch.ammo++; else ch.stone++; return true; }
    const sp = this.splitters.get(key); if (sp) { if (sp.buf.length >= 4) return false; sp.buf.push(ammo); return true; }
    if (this.belts.has(key)) { if (this.items.some(o => !o.gone && dist(o.x, o.y, x, y) < 10)) return false; this.items.push({ x, y, ammo }); return true; }
    return false;
  }
  /** The tile at (c, r) is the machine's side, where belts and grabbers meet it. */
  private isMachine(c: number, r: number) { return dist(tileX(c), tileY(r), MACHINE.x, MACHINE.y) < MACHINE.r + 24 && !this.taken(c, r); }
  /** A grabber with the machine behind it pulls stone ammo out of it. */
  private machineGrabbed() {
    for (const [key, gr] of this.grabbers) { const [c, r] = key.split(',').map(Number), [dx, dy] = DIRS[gr.d]; if (this.isMachine(c - dx, r - dy)) return true; }
    return false;
  }
  private buyShort() {
    if (this.stones < SURVIVAL.shortBeltCost) { Sound.denied(); return; }
    this.stones -= SURVIVAL.shortBeltCost; this.invShort += SURVIVAL.shortBeltPack;
    Sound.pop(); this.renderShop();
  }
  /** Tap a placed piece to put it back in your inventory. A belt tile comes back as a 1-tile belt. */
  private pickUp(c: number, r: number) {
    const key = c + ',' + r, x = tileX(c), y = tileY(r);
    // stone on that spot goes in your pocket
    const dropStone = () => { for (const it of this.items) { const t = tileAt(it.x, it.y); if (t && t.c === c && t.r === r) { it.gone = true; if (it.ammo) this.stoneAmmo++; else this.stones++; } } this.items = this.items.filter(it => !it.gone); };
    if (this.belts.has(key)) { this.belts.delete(key); this.invShort++; dropStone(); this.bubble(x, y - 14, '+1 short belt', 'info'); }
    else if (this.grabbers.has(key)) { const gk = this.grabbers.get(key)!; if (gk.carry) { if (gk.ammo) this.stoneAmmo++; else this.stones++; } this.grabbers.delete(key); this.invGrab++; this.bubble(x, y - 14, '+1 grabber', 'info'); }
    else if (this.splitters.has(key)) { for (const a of this.splitters.get(key)!.buf) { if (a) this.stoneAmmo++; else this.stones++; } this.splitters.delete(key); this.invSplit++; this.bubble(x, y - 14, '+1 splitter', 'info'); }
    else if (this.chests.has(key)) { const ch = this.chests.get(key)!, n = ch.stone + ch.ammo; this.stones += ch.stone; this.stoneAmmo += ch.ammo; this.chests.delete(key); this.invChest++; this.bubble(x, y - 14, n ? `+1 chest, ${n} things back` : '+1 chest', 'info'); }
    else if (this.turrets.has(key)) { const tu = this.turrets.get(key)!; this.stoneAmmo += tu.ammo; this.turrets.delete(key); this.invTurret++; this.bubble(x, y - 14, tu.ammo ? `+1 turret, ${tu.ammo} ammo back` : '+1 turret', 'info'); }
    else return;
    Sound.click();
  }
  private taken(c: number, r: number) { const k = c + ',' + r; return this.belts.has(k) || this.grabbers.has(k) || this.turrets.has(k) || this.splitters.has(k) || this.chests.has(k); }
  private togglePlacing(type: Placeable) {
    if (this.placing && this.placeType === type) { this.placing = false; Sound.click(); return; }
    if (!this.count(type)) { this.bubble(this.x, this.y - 30, `No ${({ belt: 'long belts', short: 'short belts', grab: 'grabbers', turret: 'turrets', split: 'splitters', chest: 'chests' })[type]}. Buy them at the shop`, 'info'); Sound.denied(); return; }
    this.placing = true; this.placeType = type; this.hover = null;
    Sound.click();
  }
  /** Turns whatever is on a tile; false if nothing is there. */
  private turnTile(key: string) {
    if (this.belts.has(key)) { this.belts.set(key, (this.belts.get(key)! + 1) % 4); Sound.click(); return true; }
    const gr = this.grabbers.get(key);
    if (gr) { gr.d = (gr.d + 1) % 4; Sound.click(); return true; }
    const sp = this.splitters.get(key);
    if (sp) { sp.d = (sp.d + 1) % 4; Sound.click(); return true; }
    return false;
  }
  /** Where the belt would go: under the mouse, or the tile in front of the guy. */
  private ghost() {
    if (this.hover && performance.now() - this.hover.t < 4000) return this.hover;
    const d = DIRS[Math.round(((this.face % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 4];
    return tileAt(this.x + d[0] * TILE, this.y + d[1] * TILE);
  }
  private placeAt(c: number, r: number) {
    const key = c + ',' + r;
    if (this.turnTile(key)) return;
    if (!this.count(this.placeType)) { this.placing = false; return; }
    if (this.turrets.has(key) || this.chests.has(key)) { this.bubble(tileX(c), tileY(r) - 16, 'Something is there', 'info'); Sound.denied(); return; }
    if (blockedTile(c, r)) { this.bubble(tileX(c), tileY(r) - 16, "Can't put that there", 'info'); Sound.denied(); return; }
    if (this.placeType === 'belt') {
      // one belt is 3 tiles long, laid from the spot in the direction it faces
      const [dx, dy] = DIRS[this.placeDir];
      for (let i = 0; i < SURVIVAL.beltLength; i++) {
        const cc = c + dx * i, rr = r + dy * i;
        if (i && (!tileAt(tileX(cc), tileY(rr)) || cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || blockedTile(cc, rr) || this.taken(cc, rr))) break;
        this.belts.set(cc + ',' + rr, this.placeDir);
      }
      this.inv--;
    } else if (this.placeType === 'short') {
      this.belts.set(key, this.placeDir); this.invShort--;
    } else {
      if (this.placeType === 'grab') { this.grabbers.set(key, { d: this.placeDir, t: 0, carry: false }); this.invGrab--; }
      else if (this.placeType === 'split') { this.splitters.set(key, { d: this.placeDir, buf: [], side: 0, t: 0 }); this.invSplit--; }
      else if (this.placeType === 'chest') { this.chests.set(key, { stone: 0, ammo: 0 }); this.invChest--; }
      else { this.turrets.set(key, { ammo: 0, cd: 0, face: -Math.PI / 2 }); this.invTurret--; }
      // stone lying on the spot goes back in your pocket
      for (const it of this.items) { const t = tileAt(it.x, it.y); if (t && t.c === c && t.r === r) { it.gone = true; if (it.ammo) this.stoneAmmo++; else this.stones++; } } this.items = this.items.filter(it => !it.gone);
    }
    Sound.thump();
    if (!this.count(this.placeType)) this.placing = false;
  }
  /** R: turn the belt being placed, or the belt under (or in front of) the guy. */
  private rotate() {
    if (this.placing) { this.placeDir = (this.placeDir + 1) % 4; Sound.click(); return; }
    for (const t of [tileAt(this.x, this.y), this.ghost()]) {
      if (!t) continue;
      if (this.turnTile(t.c + ',' + t.r)) return;
    }
    this.bubble(this.x, this.y - 30, 'Stand on a belt or face a grabber to turn it', 'info');
  }
  /** New stone goes onto a belt that touches the mine, or into your pocket. */
  private giveStone(x: number, y: number) {
    let best: { c: number; r: number } | null = null, bd = MINE.r + 34;
    for (const key of this.belts.keys()) {
      const [c, r] = key.split(',').map(Number), d = dist(tileX(c), tileY(r), MINE.x, MINE.y);
      if (d < bd) { bd = d; best = { c, r }; }
    }
    if (best && this.items.length < 80) { this.items.push({ x: tileX(best.c), y: tileY(best.r) }); this.bubble(x, y, '+1 stone on the belt', 'info'); }
    else { this.stones++; this.bubble(x, y, '+1 stone', 'info'); }
  }
  /** Belts move stone along; stone that runs into the machine goes in as a batch. */
  private moveItems(dt: number) {
    const step = SURVIVAL.beltSpeed * dt;
    for (const it of this.items) {
      const t = tileAt(it.x, it.y);
      const d = t ? this.belts.get(t.c + ',' + t.r) : undefined;
      if (!t || d === undefined) continue;
      const [dx, dy] = DIRS[d];
      // anything just ahead on the belt holds it up
      if (this.items.some(o => { const a = (o.x - it.x) * dx + (o.y - it.y) * dy; return o !== it && !o.gone && a > 0 && a < 11 && Math.abs((o.x - it.x) * dy - (o.y - it.y) * dx) < 6; })) continue;
      // keep to the middle of the belt
      if (dx) it.y += clamp(tileY(t.r) - it.y, -step, step); else it.x += clamp(tileX(t.c) - it.x, -step, step);
      const nx = it.x + dx * step, ny = it.y + dy * step, nt = tileAt(nx + dx * 6, ny + dy * 6);
      const onward = nt && (nt.c !== t.c || nt.r !== t.r) ? this.belts.has(nt.c + ',' + nt.r) : !!nt;
      if (onward) { it.x = nx; it.y = ny; continue; }
      if (!this.belts.has((t.c + dx) + ',' + (t.r + dy)) && this.deliver(t.c + dx, t.r + dy, it.ammo)) {
        it.gone = true;
      } else {
        // end of the line: it waits at the edge
        it.x = clamp(nx, tileX(t.c) - 9, tileX(t.c) + 9); it.y = clamp(ny, tileY(t.r) - 9, tileY(t.r) + 9);
      }
    }
    // grabbers: pick a stone up from behind, swing, put it down in front
    for (const [key, gr] of this.grabbers) {
      const [c, r] = key.split(',').map(Number), [dx, dy] = DIRS[gr.d];
      if (!gr.carry) {
        const it = this.items.find(o => { if (o.gone) return false; const t = tileAt(o.x, o.y); return !!t && t.c === c - dx && t.r === r - dy; });
        if (it) { it.gone = true; gr.carry = true; gr.ammo = !!it.ammo; gr.t = 0; }
        else {
          // or one out of a chest behind it (ammo first), or stone ammo out of the machine
          const bk = (c - dx) + ',' + (r - dy), ch = this.chests.get(bk);
          if (ch && ch.ammo) { ch.ammo--; gr.carry = true; gr.ammo = true; gr.t = 0; }
          else if (ch && ch.stone) { ch.stone--; gr.carry = true; gr.ammo = false; gr.t = 0; }
          else if (this.machineAmmo > 0 && this.isMachine(c - dx, r - dy)) { this.machineAmmo--; gr.carry = true; gr.ammo = true; gr.t = 0; }
        }
        continue;
      }
      gr.t += dt;
      if (gr.t < SURVIVAL.grabTime) continue;
      const fx = tileX(c + dx), fy = tileY(r + dy);
      if (this.deliver(c + dx, r + dy, gr.ammo)) { gr.carry = false; continue; }
      const ft = tileAt(fx, fy);
      if (!ft || this.taken(ft.c, ft.r) || this.grabbers.has(ft.c + ',' + ft.r) || blockedTile(ft.c, ft.r)) continue; // nowhere to put it: hold on
      // wait for room on the tile in front
      if (this.items.some(o => !o.gone && dist(o.x, o.y, fx, fy) < 10)) continue;
      this.items.push({ x: fx, y: fy, ammo: gr.ammo }); gr.carry = false;
    }
    // splitters: send stone out to the left and right in turn, so it splits evenly
    for (const [key, sp] of this.splitters) {
      sp.t = Math.max(0, sp.t - dt);
      if (!sp.buf.length || sp.t > 0) continue;
      const [c, r] = key.split(',').map(Number);
      for (let k = 0; k < 2; k++) {
        const [dx, dy] = DIRS[(sp.d + (sp.side ? 3 : 1)) % 4];
        sp.side ^= 1;
        if (this.deliver(c + dx, r + dy, sp.buf[0])) { sp.buf.shift(); sp.t = SURVIVAL.splitTime; break; }
      }
    }
    this.items = this.items.filter(it => !it.gone);
    // walk over stone to pick it up
    let got = false;
    for (const it of this.items) if (dist(it.x, it.y, this.x, this.y) <= GUY_R + 4) { it.gone = true; got = true; if (it.ammo) this.stoneAmmo++; else this.stones++; }
    if (got) { this.items = this.items.filter(it => !it.gone); Sound.click(); }
  }

  private minerCost() { return this.miners.length ? SURVIVAL.extraMinerCost : SURVIVAL.minerCost; }
  /** H next to the mine: hire a miner (30 stone, then 20 for each extra one), who digs a stone every 5 seconds for you. */
  private hire() {
    if (!this.mineOn) return;
    if (this.miners.length >= SURVIVAL.maxMiners) { this.bubble(this.x, this.y - 30, 'No room for more miners', 'info'); Sound.denied(); return; }
    if (dist(this.x, this.y, MINE.x, MINE.y) > NEAR) { this.bubble(this.x, this.y - 30, 'Walk to the mine to hire a miner', 'info'); Sound.denied(); return; }
    const cost = this.minerCost();
    if (this.stones < cost) { this.bubble(this.x, this.y - 30, `${this.miners.length ? 'An extra' : 'A'} miner costs ${cost} stone`, 'info'); Sound.denied(); return; }
    this.stones -= cost; this.miners.push(Math.random() * SURVIVAL.minerEvery * .5);
    this.say(this.miners.length > 1 ? `You hired miner ${this.miners.length}!` : 'You hired a miner!'); Sound.pop();
  }
  /** S: switch between your loadout ammo and stone ammo. */
  private switchAmmo() {
    if (!this.useStone && !this.stoneAmmo) { this.bubble(this.x, this.y - 30, 'No stone ammo yet', 'info'); Sound.denied(); return; }
    this.useStone = !this.useStone;
    this.bubble(this.x, this.y - 30, this.useStone ? 'Stone ammo' : `${AMMO[this.load.ammo].name} ammo`, 'info');
    Sound.click();
  }

  /* ---------- rules ---------- */
  update(dt: number) {
    if (!this.running || this.paused || this.shopOpen) return;
    this.t += dt;
    this.reload = Math.max(0, this.reload - dt);
    this.noTargetT -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // walking: arrow keys or the drag stick
    let mx = 0, my = 0;
    if (this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('ArrowDown')) my += 1;
    if (this.stick) { const m = Math.hypot(this.stick.dx, this.stick.dy); if (m > 6) { mx = this.stick.dx / 46; my = this.stick.dy / 46; } }
    const m = Math.hypot(mx, my);
    if (m > 0) {
      if (m > 1) { mx /= m; my /= m; }
      this.x += mx * SURVIVAL.guySpeed * dt; this.y += my * SURVIVAL.guySpeed * dt;
      this.face = Math.atan2(my, mx);
      this.walk += dt * 10 * Math.min(1, m);
    }
    // a belt under the guy carries him along
    const under = tileAt(this.x, this.y), ud = under ? this.belts.get(under.c + ',' + under.r) : undefined;
    if (ud !== undefined) { this.x += DIRS[ud][0] * SURVIVAL.beltSpeed * dt; this.y += DIRS[ud][1] * SURVIVAL.beltSpeed * dt; }
    // the guy stays inside the walls
    this.x = clamp(this.x, WALL.x0 + WALL.t + GUY_R, WALL.x1 - WALL.t - GUY_R);
    this.y = clamp(this.y, WALL.y0 + WALL.t + GUY_R, WALL.y1 - WALL.t - GUY_R);

    // healing: 1.2% of max health every second
    this.healT += dt;
    while (this.healT >= 1) { this.healT -= 1; this.hp = Math.min(SURVIVAL.maxHp, this.hp + SURVIVAL.maxHp * SURVIVAL.heal); }

    // mining: a stone every 4 seconds while next to the mine
    this.swing = Math.max(0, this.swing - dt);
    if (this.mineOn) this.popT += dt;
    if (this.mining) {
      if (m > 0 || dist(this.x, this.y, MINE.x, MINE.y) > NEAR) this.mining = false;
      else {
        this.face = Math.atan2(MINE.y - this.y, MINE.x - this.x);
        if (this.swing <= 0) { this.swing = 1; Sound.click(); }
        this.mineT += dt;
        if (this.mineT >= SURVIVAL.mineEvery) { this.mineT -= SURVIVAL.mineEvery; this.giveStone(MINE.x, MINE.y - 30); Sound.thump(); }
      }
    }
    for (let i = 0; i < this.miners.length; i++) {
      this.miners[i] += dt;
      if (this.miners[i] >= SURVIVAL.minerEvery) { this.miners[i] -= SURVIVAL.minerEvery; const [ox, oy] = MINER_SPOTS[i]; this.giveStone(MINE.x + ox, MINE.y + oy - 18); }
    }
    this.moveItems(dt);
    if (this.queue > 0) {
      this.batchT += dt;
      if (this.batchT >= SURVIVAL.batchTime) {
        this.batchT -= SURVIVAL.batchTime; this.queue--;
        // with a grabber pulling from the machine, the ammo waits in the machine for it; otherwise it's yours
        if (this.machineGrabbed()) this.machineAmmo += SURVIVAL.batchAmmo; else this.stoneAmmo += SURVIVAL.batchAmmo;
        this.bubble(MACHINE.x, MACHINE.y - 36, `+${SURVIVAL.batchAmmo} stone ammo`, 'info'); Sound.pop();
      }
    } else this.batchT = 0;
    if (this.machineAmmo && !this.machineGrabbed()) { this.stoneAmmo += this.machineAmmo; this.machineAmmo = 0; }

    // more bears as time goes on
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnBear();
      // bears come at a steady pace (no growing over time); after the mine checkpoint, 40% fewer
      const fewer = this.mineOn ? SURVIVAL.mineBears : 1;
      this.spawnT = SURVIVAL.bearEvery / fewer;
    }

    let entering = false;
    for (const b of this.bears) {
      if (b.state === 'dead') { b.dead += dt; continue; }
      b.hurt = Math.max(0, b.hurt - dt); b.swipe = Math.max(0, b.swipe - dt);
      if (b.state === 'walk') {
        if (this.stepTo(b, b.tx, b.ty, SURVIVAL.bearSpeed, dt)) b.state = 'wait';
      } else if (b.state === 'wait') {
        b.wait += dt;
        b.face = approachAngle(b.face, Math.atan2(WALL.y0 - b.y, GATE.x - b.x), dt * 2);
        if (b.wait >= this.gateWait) b.state = 'enter';
      } else if (b.state === 'enter') {
        entering = true;
        // line up at the gate, then walk through it
        if (b.y < WALL.y0 - BEAR_R - 2) {
          const x = clamp(b.x, GATE.x - 12, GATE.x + 12);
          if (Math.abs(b.x - x) > 1) this.stepTo(b, x, b.y + 4, SURVIVAL.bearSpeedInside, dt);
          else this.stepTo(b, GATE.x, WALL.y0 + 50, SURVIVAL.bearSpeedInside, dt);
        } else if (this.stepTo(b, GATE.x, WALL.y0 + WALL.t + BEAR_R + 8, SURVIVAL.bearSpeedInside, dt)) {
          b.state = 'inside'; b.cd = .8; b.tc = 2;
          this.say('A bear got in!');
          Sound.tone('sawtooth', 160, 90, .5, .12);
        }
      } else {
        // inside: go for the guy and swipe every 5 seconds
        b.cd = Math.max(0, b.cd - dt);
        const d = Math.hypot(this.x - b.x, this.y - b.y), reach = GUY_R + BEAR_R + 6;
        if (d > reach - 2) this.stepTo(b, this.x, this.y, SURVIVAL.bearSpeedInside, dt, reach - 2);
        else b.face = approachAngle(b.face, Math.atan2(this.y - b.y, this.x - b.x), dt * 6);
        if (d <= reach && b.cd <= 0) this.bearHit(b);
        // from further off it throws a rock, every 5 seconds
        b.tc = Math.max(0, b.tc - dt);
        if (d > reach + 20 && b.tc <= 0) this.throwRock(b);
      }
    }
    this.gateOpen = clamp(this.gateOpen + (entering ? dt : -dt) * 1.5, 0, 1);
    // turrets shoot the nearest bear in range while they have ammo
    for (const [key, tu] of this.turrets) {
      tu.cd = Math.max(0, tu.cd - dt);
      if (!tu.ammo || tu.cd > 0) continue;
      const [c, r] = key.split(',').map(Number), x = tileX(c), y = tileY(r);
      let target: Bear | null = null, bd = SURVIVAL.turretRange;
      for (const b of this.bears) { if (b.state === 'dead') continue; const d = dist(x, y, b.x, b.y); if (d < bd) { bd = d; target = b; } }
      if (!target) continue;
      const a = Math.atan2(target.y - y, target.x - x);
      tu.face = a; tu.ammo--; tu.cd = SURVIVAL.turretReload;
      this.bolts.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, vx: Math.cos(a) * SURVIVAL.boltSpeed, vy: Math.sin(a) * SURVIVAL.boltSpeed, left: SURVIVAL.boltRange, dmg: SURVIVAL.turretDamage, target, stone: true });
      Sound.tone('square', 500, 200, .08, .06);
    }
    this.separate(dt);

    // bolts
    for (const bo of this.bolts) {
      if (bo.target && bo.target.state !== 'dead') {
        // a targeted bolt curves onto its bear
        const a = Math.atan2(bo.target.y - bo.y, bo.target.x - bo.x), s = SURVIVAL.boltSpeed;
        const cur = Math.atan2(bo.vy, bo.vx), na = approachAngle(cur, a, dt * 9);
        bo.vx = Math.cos(na) * s; bo.vy = Math.sin(na) * s;
      }
      bo.x += bo.vx * dt; bo.y += bo.vy * dt; bo.left -= SURVIVAL.boltSpeed * dt;
      for (const b of this.bears) {
        if (b.state === 'dead') continue;
        if (Math.hypot(b.x - bo.x, b.y - bo.y) < BEAR_R + 4) { this.boltHit(b, bo); bo.left = 0; break; }
      }
    }
    this.bolts = this.bolts.filter(b => b.left > 0);
    for (const r of this.rocks) {
      r.x += r.vx * dt; r.y += r.vy * dt; r.left -= SURVIVAL.throwSpeed * dt; r.spin += dt * 9;
      if (dist(r.x, r.y, this.x, this.y) < GUY_R + 5) { r.left = 0; this.hurt(SURVIVAL.bearThrow); }
    }
    this.rocks = this.rocks.filter(r => r.left > 0);
    this.bears = this.bears.filter(b => b.state !== 'dead' || b.dead < 1.2);
    for (const u of this.bubbles) u.t += dt;
    this.bubbles = this.bubbles.filter(u => u.t < (u.kind === 'loss' ? 1.6 : 1.1));

    if (this.hp <= 0) {
      this.hp = 0; this.running = false;
      Sound.boom(false);
      this.mining = false;
      this.hooks.over({ time: this.t, kills: this.kills, shots: this.shots, hits: this.hits, damage: this.damage });
    }
  }

  private spawnBear() {
    // bears come from the woods north of the base and make for a spot outside the gate
    const side = Math.random();
    let x: number, y: number;
    if (side < .5) { x = 30 + Math.random() * (W - 60); y = -BEAR_R - 10; }
    else if (side < .75) { x = -BEAR_R - 10; y = 30 + Math.random() * 300; }
    else { x = W + BEAR_R + 10; y = 30 + Math.random() * 300; }
    const waiting = this.bears.filter(b => b.state === 'walk' || b.state === 'wait').length;
    const ring = 70 + Math.min(4, Math.floor(waiting / 5)) * 42;
    const a = Math.PI + .25 + Math.random() * (Math.PI - .5);
    const tx = clamp(GATE.x + Math.cos(a) * ring * 1.4, 40, W - 40), ty = clamp(WALL.y0 - 10 + Math.sin(a) * ring, 40, WALL.y0 - BEAR_R - 10);
    this.bears.push({ tc: 0, id: this.nextId++, x, y, hp: SURVIVAL.bearHp, state: 'walk', wait: 0, tx, ty, cd: 0, face: Math.atan2(ty - y, tx - x), swipe: 0, hurt: 0, dead: 0, step: Math.random() * 6 });
  }

  /** Moves a bear toward a point; returns true once it is there. */
  private stepTo(b: Bear, tx: number, ty: number, speed: number, dt: number, stopAt = 2) {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d <= stopAt) return true;
    const s = Math.min(d - stopAt + .01, speed * dt);
    b.x += dx / d * s; b.y += dy / d * s;
    b.face = approachAngle(b.face, Math.atan2(dy, dx), dt * 4);
    b.step += dt * 6;
    return false;
  }

  /** Bears don't stand on each other, and only cross the wall at the gate. */
  private separate(dt: number) {
    const live = this.bears.filter(b => b.state !== 'dead');
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, min = BEAR_R * 2;
      if (d < min) {
        const push = Math.min(min - d, 40 * dt) / 2;
        // a bear going through the gate holds its line
        const wa = a.state === 'enter' ? 0 : 1, wb = b.state === 'enter' ? 0 : 1;
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * wb; b.y += dy / d * push * wb;
      }
    }
    for (const b of live) {
      if (b.state === 'inside') {
        b.x = clamp(b.x, WALL.x0 + WALL.t + BEAR_R, WALL.x1 - WALL.t - BEAR_R);
        b.y = clamp(b.y, WALL.y0 + WALL.t + BEAR_R, WALL.y1 - WALL.t - BEAR_R);
      } else if (b.state === 'wait' || b.state === 'walk') {
        // outside: keep out of the walls
        if (b.x > WALL.x0 - BEAR_R && b.x < WALL.x1 + BEAR_R && b.y > WALL.y0 - BEAR_R) b.y = WALL.y0 - BEAR_R;
      }
    }
  }

  private throwRock(b: Bear) {
    b.tc = SURVIVAL.throwCooldown; b.swipe = .25;
    const a = Math.atan2(this.y - b.y, this.x - b.x);
    b.face = a;
    this.rocks.push({ x: b.x + Math.cos(a) * 24, y: b.y + Math.sin(a) * 24, vx: Math.cos(a) * SURVIVAL.throwSpeed, vy: Math.sin(a) * SURVIVAL.throwSpeed, left: 520, spin: 0 });
    Sound.tone('sine', 300, 160, .15, .1);
  }

  private bearHit(b: Bear) {
    b.cd = SURVIVAL.bearCooldown; b.swipe = .35;
    this.hurt(SURVIVAL.bearHit);
  }

  private hurt(share: number) {
    const dmg = SURVIVAL.maxHp * share;
    this.hp -= dmg;
    this.hurtFlash = .4;
    this.bubble(this.x + (Math.random() - .5) * 16, this.y - 24, '-' + fmt(dmg), 'loss');
    Sound.noise(.25, 'lowpass', 700, .8, .4); Sound.tone('sine', 120, 50, .25, .3);
    if (navigator.vibrate) try { navigator.vibrate(60); } catch { }
  }

  private boltHit(b: Bear, bo: Bolt) {
    b.hp -= bo.dmg; b.hurt = .25;
    this.hits++; this.damage += Math.min(bo.dmg, b.hp + bo.dmg);
    this.bubble(b.x, b.y - 26, '-' + trim(bo.dmg), 'dmg');
    Sound.hitPlane();
    if (b.hp <= 1e-6) {
      b.state = 'dead'; b.dead = 0; this.kills++;
      if (this.kills === SURVIVAL.rushKills) {
        // the bears get impatient, and a mine and a machine pop up in the camp
        this.gateWait = SURVIVAL.gateWaitLater;
        this.say('Bears in base in 20 seconds', 4);
        this.mineOn = true;
        Sound.alarm();
      }
      Sound.tone('sine', 200, 70, .4, .18);
    }
  }

  private bubble(x: number, y: number, text: string, kind: Bubble['kind']) { this.bubbles.push({ x, y, text, t: 0, kind }); }
  private sayT = 0; private sayText = '';
  private say(text: string, secs = 3) { this.sayText = text; this.sayT = secs; }

  /* ---------- drawing ---------- */
  draw(dt: number) {
    const c = this.canvas, cw = c.clientWidth, ch = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    this.cw = cw;
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the map sits between the health bar (top) and the buttons (bottom)
    const top = this.mineOn ? 82 : 64, bottom = 96;
    this.scale = Math.min(cw / W, (ch - top - bottom) / H);
    this.ox = (cw - W * this.scale) / 2; this.oy = top + (ch - top - bottom - H * this.scale) / 2;
    g.fillStyle = '#2f4426'; g.fillRect(0, 0, cw, ch);
    g.save();
    g.translate(this.ox, this.oy); g.scale(this.scale, this.scale);
    this.drawWorld(g);
    g.restore();
    this.drawHud(g, dt);
  }

  private drawWorld(g: CanvasRenderingContext2D) {
    // ground
    g.fillStyle = '#4b6b37'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(30,50,20,.25)';
    for (const d of this.decor) if (d.k === 0) { g.beginPath(); g.arc(d.x + 6, d.y + 8, d.r * 1.1, 0, 7); g.fill(); }
    // a worn path to the gate
    g.fillStyle = '#6f6a45';
    g.beginPath(); g.moveTo(GATE.x - 30, WALL.y0); g.quadraticCurveTo(GATE.x - 10, 220, GATE.x - 50, 0); g.lineTo(GATE.x + 40, 0); g.quadraticCurveTo(GATE.x + 20, 220, GATE.x + 30, WALL.y0); g.fill();
    // inside the base: packed earth, with the wall's shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(WALL.x0 + 4, WALL.y0 + 6, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.fillStyle = '#8b7651'; g.fillRect(WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.fillStyle = 'rgba(60,45,25,.18)';
    for (const d of this.decor) if (d.k === 2) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill(); }
    // a campfire and a tent so it reads as a camp
    this.drawCamp(g);
    // scenery outside
    for (const d of this.decor) {
      if (d.k === 0) { // tree
        g.fillStyle = '#2d4a22'; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill();
        g.fillStyle = '#3c5f2c'; g.beginPath(); g.arc(d.x - d.r * .25, d.y - d.r * .25, d.r * .65, 0, 7); g.fill();
      } else if (d.k === 1) { // bush
        g.fillStyle = '#3f6230'; g.beginPath(); g.arc(d.x, d.y, d.r * .55, 0, 7); g.fill();
      }
    }
    this.drawBelts(g);
    if (this.mineOn) { this.drawMineAndMachine(g); this.drawShop(g); }
    for (const it of this.items) {
      if (it.ammo) {
        // stone ammo: a grey bolt with a blue band
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(it.x - 5, it.y - 1, 12, 5);
        g.fillStyle = STONE; g.beginPath(); g.moveTo(it.x + 7, it.y); g.lineTo(it.x + 2, it.y - 4); g.lineTo(it.x - 6, it.y - 3); g.lineTo(it.x - 6, it.y + 3); g.lineTo(it.x + 2, it.y + 4); g.closePath(); g.fill();
        g.fillStyle = '#7fc8ff'; g.fillRect(it.x - 3, it.y - 3, 2.5, 6);
        continue;
      }
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(it.x + 1.5, it.y + 2, 5.5, 0, 7); g.fill();
      g.fillStyle = STONE; g.beginPath(); g.arc(it.x, it.y, 5.5, 0, 7); g.fill();
      g.fillStyle = '#d0ccc2'; g.beginPath(); g.arc(it.x - 1.5, it.y - 1.5, 2, 0, 7); g.fill();
    }
    if (this.placing) {
      const t = this.ghost();
      if (t) {
        const taken = this.taken(t.c, t.r);
        const bad = taken ? false : blockedTile(t.c, t.r);
        g.globalAlpha = .6;
        if (!taken) {
          if (this.placeType === 'belt' || this.placeType === 'short') { const [dx, dy] = DIRS[this.placeDir]; for (let i = 0; i < (this.placeType === 'belt' ? SURVIVAL.beltLength : 1); i++) { const cc = t.c + dx * i, rr = t.r + dy * i; if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || (i && (blockedTile(cc, rr) || this.taken(cc, rr)))) break; paintBelt(g, tileX(cc), tileY(rr), this.placeDir, this.t); } }
          else if (this.placeType === 'grab') paintGrabber(g, tileX(t.c), tileY(t.r), { d: this.placeDir, t: 0, carry: false });
          else if (this.placeType === 'split') paintSplitter(g, tileX(t.c), tileY(t.r), this.placeDir);
          else if (this.placeType === 'chest') paintChest(g, tileX(t.c), tileY(t.r));
          else paintTurret(g, tileX(t.c), tileY(t.r), { ammo: 0, cd: 0, face: -Math.PI / 2 });
        }
        g.globalAlpha = 1;
        g.strokeStyle = bad ? '#ff6a5a' : '#fff5ea'; g.lineWidth = 2; g.strokeRect(GX0 + t.c * TILE + 1, GY0 + t.r * TILE + 1, TILE - 2, TILE - 2);
      }
    }
    this.drawWalls(g);
    // dead bears fade, then the rest on top
    for (const b of this.bears) if (b.state === 'dead') this.drawBear(g, b);
    for (const b of this.bears) if (b.state !== 'dead') this.drawBear(g, b);
    this.drawGuy(g);
    for (const bo of this.bolts) {
      const a = Math.atan2(bo.vy, bo.vx);
      g.save(); g.translate(bo.x, bo.y); g.rotate(a);
      g.strokeStyle = '#5a3d22'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = bo.stone ? STONE : AMMO[this.load.ammo].color; g.beginPath(); g.moveTo(10, 0); g.lineTo(4, -3.5); g.lineTo(4, 3.5); g.fill();
      g.fillStyle = '#f0e6d0'; g.fillRect(-15, -3, 4, 6);
      g.restore();
    }
    // rocks thrown by bears
    for (const r of this.rocks) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(r.x + 3, r.y + 4, 6, 0, 7); g.fill();
      g.save(); g.translate(r.x, r.y); g.rotate(r.spin);
      g.fillStyle = '#8d8a84'; g.beginPath(); g.moveTo(-6, -3); g.lineTo(-1, -7); g.lineTo(6, -4); g.lineTo(7, 3); g.lineTo(1, 7); g.lineTo(-6, 4); g.closePath(); g.fill();
      g.fillStyle = '#b5b1a8'; g.beginPath(); g.arc(-1, -2, 2.5, 0, 7); g.fill();
      g.restore();
    }
    // targeting range when a bear is close: a faint ring
    g.strokeStyle = 'rgba(255,245,234,.10)'; g.lineWidth = 1.5; g.setLineDash([6, 8]);
    g.beginPath(); g.arc(this.x, this.y, SURVIVAL.targetRange, 0, 7); g.stroke(); g.setLineDash([]);
  }

  private drawBelts(g: CanvasRenderingContext2D) {
    if (this.placing) {
      // a faint grid while placing
      g.strokeStyle = 'rgba(255,245,234,.12)'; g.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) { g.beginPath(); g.moveTo(GX0 + c * TILE, GY0); g.lineTo(GX0 + c * TILE, GY0 + ROWS * TILE); g.stroke(); }
      for (let r = 0; r <= ROWS; r++) { g.beginPath(); g.moveTo(GX0, GY0 + r * TILE); g.lineTo(GX0 + COLS * TILE, GY0 + r * TILE); g.stroke(); }
    }
    for (const [key, d] of this.belts) { const [c, r] = key.split(',').map(Number); paintBelt(g, tileX(c), tileY(r), d, this.t); }
    for (const [key, gr] of this.grabbers) { const [c, r] = key.split(',').map(Number); paintGrabber(g, tileX(c), tileY(r), gr); }
    for (const [key, sp] of this.splitters) { const [c, r] = key.split(',').map(Number); paintSplitter(g, tileX(c), tileY(r), sp.d); }
    for (const [key, ch] of this.chests) {
      const [c, r] = key.split(',').map(Number), n = ch.stone + ch.ammo; paintChest(g, tileX(c), tileY(r));
      g.fillStyle = n >= SURVIVAL.chestSize ? '#ff8a7a' : '#fff5ea'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(`${n}/${SURVIVAL.chestSize}`, tileX(c), tileY(r) + 21);
    }
    for (const [key, tu] of this.turrets) {
      const [c, r] = key.split(',').map(Number); paintTurret(g, tileX(c), tileY(r), tu);
      g.fillStyle = tu.ammo ? '#fff5ea' : '#ff8a7a'; g.font = '600 10px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(tu.ammo ? String(tu.ammo) : 'empty', tileX(c), tileY(r) + 21);
    }
  }

  private drawShop(g: CanvasRenderingContext2D) {
    const pop = Math.min(1, this.popT * 2);
    g.save(); g.translate(SHOP.x, SHOP.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-22, -14, 50, 38);
    g.fillStyle = '#8a5a32'; g.fillRect(-26, -10, 52, 32);
    g.fillStyle = '#6a4224'; g.fillRect(-26, 8, 52, 4);
    // striped awning
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#f2efe6' : '#d64545'; g.fillRect(-28 + i * 56 / 6, -22, 56 / 6 + .5, 14); }
    g.fillStyle = STONE; g.beginPath(); g.arc(-10, 0, 4, 0, 7); g.arc(0, 2, 4, 0, 7); g.fill();
    paintBelt(g, 14, 0, 0, this.t, .5);
    g.restore();
    g.fillStyle = '#fff5ea'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText('Shop', SHOP.x, SHOP.y + 36);
  }

  private drawMineAndMachine(g: CanvasRenderingContext2D) {
    const pop = Math.min(1, this.popT * 2);
    // the mine: a heap of grey rock
    g.save(); g.translate(MINE.x, MINE.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(4, 6, 28, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#6f6c66'; g.beginPath(); g.moveTo(-26, 10); g.lineTo(-18, -12); g.lineTo(-4, -22); g.lineTo(14, -16); g.lineTo(26, 2); g.lineTo(18, 16); g.lineTo(-12, 18); g.closePath(); g.fill();
    g.fillStyle = '#8f8b84'; g.beginPath(); g.moveTo(-14, -8); g.lineTo(-3, -17); g.lineTo(10, -12); g.lineTo(4, 0); g.lineTo(-10, 2); g.closePath(); g.fill();
    g.fillStyle = '#c7c2b8'; g.beginPath(); g.arc(12, 6, 3, 0, 7); g.arc(-8, 10, 2.5, 0, 7); g.fill();
    if (this.mining && this.swing > .7) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * 1.6 + this.t * 3; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); g.stroke(); } }
    g.restore();
    // the machine: a metal box with a hopper, a light while it works and a progress bar
    g.save(); g.translate(MACHINE.x, MACHINE.y); g.scale(pop, pop);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-22, -18, 50, 44);
    g.fillStyle = '#5b6670'; g.fillRect(-26, -22, 52, 44);
    g.fillStyle = '#7d8a95'; g.fillRect(-20, -16, 24, 18);
    g.fillStyle = '#3a4249'; g.beginPath(); g.moveTo(8, -18); g.lineTo(22, -18); g.lineTo(18, -6); g.lineTo(12, -6); g.closePath(); g.fill();
    g.fillStyle = this.queue ? (Math.sin(this.t * 10) > 0 ? '#ffcf4a' : '#a07a20') : '#3c4a3c'; g.beginPath(); g.arc(16, 10, 4, 0, 7); g.fill();
    if (this.queue) { g.fillStyle = '#222'; g.fillRect(-20, 8, 26, 6); g.fillStyle = '#9fe0b0'; g.fillRect(-20, 8, 26 * this.batchT / SURVIVAL.batchTime, 6); }
    g.restore();
    // hired miners stand round the mine, swinging picks at it
    this.miners.forEach((mt, i) => {
      const [ox, oy] = MINER_SPOTS[i], mx = MINE.x + ox, my = MINE.y + oy, sw = Math.sin(mt / SURVIVAL.minerEvery * Math.PI * 10) * .6;
      g.save(); g.translate(mx, my);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2, 3, 11, 9, 0, 0, 7); g.fill();
      g.rotate(Math.atan2(-oy, -ox));
      g.fillStyle = '#7a5a3a'; g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, 7); g.fill();
      g.save(); g.rotate(sw);
      g.strokeStyle = '#5a3d22'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(4, 2); g.lineTo(18, 2); g.stroke();
      g.strokeStyle = '#9aa0a6'; g.lineWidth = 3; g.beginPath(); g.moveTo(18, -6); g.quadraticCurveTo(22, 2, 18, 10); g.stroke();
      g.restore();
      g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill();
      g.fillStyle = '#e0b43a'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(4, 0, 1.8, 0, 7); g.fill();
      g.restore();
    });
    // labels
    g.fillStyle = '#fff5ea'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText(this.miners.length ? `Mine (${this.miners.length} miner${this.miners.length > 1 ? 's' : ''})` : 'Mine', MINE.x + (this.miners.length ? 40 : 0), MINE.y + (this.miners.length ? 52 : 34));
    g.fillText(this.queue ? `Machine (${this.queue} left)` : 'Machine', MACHINE.x, MACHINE.y + 38);
    if (this.machineAmmo) { g.fillStyle = '#7fc8ff'; g.fillText(`${this.machineAmmo} ammo ready`, MACHINE.x, MACHINE.y + 51); }
    // mining progress ring
    if (this.mining) {
      g.strokeStyle = '#c7c2b8'; g.lineWidth = 3;
      g.beginPath(); g.arc(MINE.x, MINE.y, MINE.r + 8, -Math.PI / 2, -Math.PI / 2 + this.mineT / SURVIVAL.mineEvery * Math.PI * 2); g.stroke();
    }
  }

  private drawCamp(g: CanvasRenderingContext2D) {
    // tent
    const tx = WALL.x0 + 70, ty = WALL.y1 - 90;
    g.fillStyle = '#b88a4a'; g.beginPath(); g.moveTo(tx - 38, ty + 30); g.lineTo(tx, ty - 30); g.lineTo(tx + 38, ty + 30); g.closePath(); g.fill();
    g.fillStyle = '#8f6633'; g.beginPath(); g.moveTo(tx, ty - 30); g.lineTo(tx + 38, ty + 30); g.lineTo(tx, ty + 30); g.closePath(); g.fill();
    // fire pit
    const fx = GATE.x + 70, fy = WALL.y1 - 130, f = .8 + Math.sin(this.t * 13) * .15;
    g.fillStyle = '#5d5148'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.arc(fx + Math.cos(a) * 15, fy + Math.sin(a) * 15, 4.5, 0, 7); g.fill(); }
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.arc(fx, fy, 9 * f, 0, 7); g.fill();
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(fx, fy, 4.5 * f, 0, 7); g.fill();
    // crates
    g.fillStyle = '#9a6a3a'; g.fillRect(WALL.x1 - 70, WALL.y0 + 40, 34, 34); g.fillRect(WALL.x1 - 50, WALL.y0 + 80, 30, 30);
    g.strokeStyle = '#6a4626'; g.lineWidth = 2; g.strokeRect(WALL.x1 - 70, WALL.y0 + 40, 34, 34); g.strokeRect(WALL.x1 - 50, WALL.y0 + 80, 30, 30);
  }

  private drawWalls(g: CanvasRenderingContext2D) {
    const { x0, x1, y0, y1, t } = WALL, gl = GATE.x - GATE.w / 2, gr = GATE.x + GATE.w / 2;
    const logs = (ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 13));
      for (let i = 0; i < n; i++) {
        const k = (i + .5) / n, x = ax + (bx - ax) * k, y = ay + (by - ay) * k;
        g.fillStyle = i % 2 ? '#6d4a2a' : '#7c5631'; g.beginPath(); g.arc(x, y, t * .55, 0, 7); g.fill();
        g.fillStyle = '#a07a4c'; g.beginPath(); g.arc(x - 1, y - 1, t * .28, 0, 7); g.fill();
      }
    };
    logs(x0 + t / 2, y0 + t / 2, gl, y0 + t / 2);
    logs(gr, y0 + t / 2, x1 - t / 2, y0 + t / 2);
    logs(x1 - t / 2, y0 + t / 2, x1 - t / 2, y1 - t / 2);
    logs(x1 - t / 2, y1 - t / 2, x0 + t / 2, y1 - t / 2);
    logs(x0 + t / 2, y1 - t / 2, x0 + t / 2, y0 + t / 2);
    // gate posts and the two doors, which swing in while a bear comes through
    const open = easeInOut(this.gateOpen) * 1.35;
    for (const [px, dir] of [[gl, 1], [gr, -1]] as const) {
      g.save(); g.translate(px, y0 + t / 2); g.rotate(dir * open);
      g.fillStyle = '#5e3f22'; g.fillRect(dir > 0 ? 0 : -GATE.w / 2, -4, GATE.w / 2, 8);
      g.fillStyle = '#3e2a16'; g.fillRect(dir > 0 ? GATE.w / 2 - 5 : -GATE.w / 2, -4, 5, 8);
      g.restore();
      g.fillStyle = '#4a3219'; g.beginPath(); g.arc(px, y0 + t / 2, 9, 0, 7); g.fill();
    }
  }

  private drawBear(g: CanvasRenderingContext2D, b: Bear) {
    g.save(); g.translate(b.x, b.y);
    if (b.state === 'dead') g.globalAlpha = Math.max(0, 1 - b.dead / 1.2);
    // shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(3, 5, BEAR_R * 1.1, BEAR_R * .9, 0, 0, 7); g.fill();
    g.rotate(b.face);
    const fur = b.hurt > 0 ? '#c9875a' : '#6b4a2e', dark = '#4f3520';
    // paws, stepping
    const st = Math.sin(b.step) * 4;
    g.fillStyle = dark;
    for (const [px, py, s] of [[8, -13, st], [8, 13, -st], [-9, -13, -st], [-9, 13, st]]) { g.beginPath(); g.arc(px + s, py, 5.5, 0, 7); g.fill(); }
    if (b.state === 'dead') { g.rotate(.6); }
    g.fillStyle = fur; g.beginPath(); g.ellipse(-2, 0, BEAR_R * 1.05, BEAR_R * .85, 0, 0, 7); g.fill();
    // head with ears and a snout
    g.fillStyle = fur; g.beginPath(); g.arc(15, 0, 10, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(11, -9, 4, 0, 7); g.arc(11, 9, 4, 0, 7); g.fill();
    g.fillStyle = '#b08a62'; g.beginPath(); g.ellipse(23, 0, 5, 4.2, 0, 0, 7); g.fill();
    g.fillStyle = '#1e140c'; g.beginPath(); g.arc(27, 0, 2, 0, 7); g.fill();
    g.beginPath(); g.arc(17, -4.5, 1.5, 0, 7); g.arc(17, 4.5, 1.5, 0, 7); g.fill();
    // a swipe: claw marks in front
    if (b.swipe > 0) {
      g.strokeStyle = `rgba(255,255,255,${b.swipe / .35})`; g.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(26, i * 6, 10, -.6, .6); g.stroke(); }
    }
    g.restore();
    if (b.state === 'dead') return;
    // waiting at the gate: a ring that fills over 30 seconds, and the seconds left
    if (b.state === 'wait') {
      const k = b.wait / this.gateWait;
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, BEAR_R + 7, 0, 7); g.stroke();
      g.strokeStyle = k > .8 ? '#ff6a5a' : '#ffcf8c'; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, BEAR_R + 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      g.fillStyle = '#fff5ea'; g.font = '600 13px Jost, sans-serif'; g.textAlign = 'center';
      g.fillText(String(Math.ceil(this.gateWait - b.wait)), b.x, b.y - BEAR_R - 12);
    }
    // health bar once hurt
    if (b.hp < SURVIVAL.bearHp) {
      const w = 34, k = Math.max(0, b.hp / SURVIVAL.bearHp), y = b.y + BEAR_R + 8;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(b.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle = '#ff6a5a'; g.fillRect(b.x - w / 2, y, w * k, 4);
    }
  }

  private drawGuy(g: CanvasRenderingContext2D) {
    const L = this.load, a = this.face, bob = Math.sin(this.walk) * 2;
    g.save(); g.translate(this.x, this.y);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(2, 4, GUY_R + 2, GUY_R, 0, 0, 7); g.fill();
    if (this.hurtFlash > 0) { g.fillStyle = `rgba(255,60,50,${this.hurtFlash})`; g.beginPath(); g.arc(0, 0, GUY_R + 10, 0, 7); g.fill(); }
    paintGuy(g, L, a + (this.mining ? Math.sin(this.swing * Math.PI) * .5 : 0), bob, this.reload > 0 ? 0 : 1, this.useStone ? STONE : undefined);
    g.restore();
    // reload ring around the guy
    if (this.reload > 0) {
      const k = 1 - this.reload / AMMO[L.ammo].reload;
      g.strokeStyle = 'rgba(255,245,234,.75)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(this.x, this.y, GUY_R + 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
    }
  }

  private drawHud(g: CanvasRenderingContext2D, dt: number) {
    const cw = this.cw, s = this.scale;
    // the guy's name over his head
    g.font = '500 12px Jost, sans-serif'; g.textAlign = 'center';
    const nx = this.ox + this.x * s, ny = this.oy + (this.y - GUY_R - 14) * s - 4;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(this.load.name, nx + 1, ny + 1);
    g.fillStyle = '#fff5ea'; g.fillText(this.load.name, nx, ny);

    // health bar
    const x = 14, y = 12, w = cw - 28 - 46, h = 18, k = this.hp / SURVIVAL.maxHp;
    g.fillStyle = 'rgba(10,8,24,.7)'; roundRect(g, x - 2, y - 2, w + 4, h + 4, 8); g.fill();
    g.fillStyle = k > .5 ? '#5fbf86' : k > .25 ? '#e0b43a' : '#e0524a';
    roundRect(g, x, y, Math.max(0, w * k), h, 6); g.fill();
    g.fillStyle = '#fff'; g.font = '600 12px Jost, sans-serif'; g.textAlign = 'center';
    g.fillText(`${fmt(Math.ceil(this.hp))} / ${fmt(SURVIVAL.maxHp)}`, x + w / 2, y + 13.5);
    g.textAlign = 'left'; g.font = '500 13px Jost, sans-serif'; g.fillStyle = '#fff5ea';
    const waiting = this.bears.filter(b => b.state === 'wait' || b.state === 'walk').length, inside = this.bears.filter(b => b.state === 'inside' || b.state === 'enter').length;
    g.fillText(`${clock(this.t)}   Bears defeated ${this.kills}`, x, y + h + 20);
    g.textAlign = 'right';
    g.fillStyle = inside ? '#ff8a7a' : '#fff5ea';
    g.fillText(inside ? `${inside} inside · ${waiting} outside` : `${waiting} outside`, cw - 14, y + h + 20);
    if (this.mineOn) {
      g.textAlign = 'left'; g.fillStyle = '#d9d4ca';
      g.fillText(`Stone ${this.stones}   Stone ammo ${this.stoneAmmo}`, x, y + h + 38);
      g.textAlign = 'right'; g.fillStyle = this.useStone ? '#fff' : '#fff5ea';
      g.fillText(`Ammo: ${this.useStone ? 'Stone' : AMMO[this.load.ammo].name}`, cw - 14, y + h + 38);
    }

    // bubbles: red for health lost, small white numbers on bears
    for (const u of this.bubbles) {
      const life = u.kind === 'loss' ? 1.6 : 1.1, p = u.t / life;
      const bx = this.ox + u.x * s, by = this.oy + u.y * s - p * 38;
      g.globalAlpha = p < .75 ? 1 : 1 - (p - .75) / .25;
      if (u.kind === 'loss') {
        g.font = '700 14px Jost, sans-serif'; const tw = g.measureText(u.text).width;
        const pop = 1 + Math.max(0, .25 - u.t) * 1.6;
        g.save(); g.translate(bx, by); g.scale(pop, pop);
        g.fillStyle = '#d8312a'; roundRect(g, -tw / 2 - 9, -13, tw + 18, 24, 12); g.fill();
        g.strokeStyle = '#ff9a90'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(u.text, 0, 4);
        g.restore();
      } else {
        g.font = u.kind === 'info' ? '500 12px Jost, sans-serif' : '700 13px Jost, sans-serif'; g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(u.text, bx + 1, by + 1);
        g.fillStyle = u.kind === 'info' ? '#fff5ea' : '#ffe9b0'; g.fillText(u.text, bx, by);
      }
      g.globalAlpha = 1;
    }

    // a short message in the middle
    if (this.sayT > 0) {
      this.sayT -= dt;
      g.globalAlpha = Math.min(1, this.sayT);
      g.font = '500 14px Jost, sans-serif'; g.textAlign = 'center';
      const tw = g.measureText(this.sayText).width, my = this.oy + 22;
      g.fillStyle = 'rgba(20,16,34,.78)'; roundRect(g, cw / 2 - tw / 2 - 12, my - 17, tw + 24, 28, 14); g.fill();
      g.fillStyle = '#fff5ea'; g.fillText(this.sayText, cw / 2, my + 2);
      g.globalAlpha = 1;
    }

    // drag stick
    if (this.stick) {
      g.strokeStyle = 'rgba(255,245,234,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(this.stick.ox, this.stick.oy, 46, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,245,234,.35)'; g.beginPath(); g.arc(this.stick.ox + this.stick.dx, this.stick.oy + this.stick.dy, 20, 0, 7); g.fill();
    }

    // reload shown on the buttons
    const r = this.reload / AMMO[this.load.ammo].reload;
    this.pad.style.setProperty('--reload', String(r));
    this.pad.classList.toggle('loading', this.reload > 0);
    const nearMine = this.mineOn && dist(this.x, this.y, MINE.x, MINE.y) < NEAR, nearMachine = this.mineOn && dist(this.x, this.y, MACHINE.x, MACHINE.y) < NEAR;
    const mb = this.pad.querySelector<HTMLElement>('#svMine')!, ab = this.pad.querySelector<HTMLElement>('#svAmmoBtn')!;
    mb.hidden = !nearMine && !nearMachine;
    const label = nearMine ? (this.mining ? 'Stop' : 'Mine') : 'Machine';
    if (mb.firstElementChild!.textContent !== label) mb.firstElementChild!.textContent = label;
    ab.hidden = !this.stoneAmmo && !this.useStone;
    const hb = this.pad.querySelector<HTMLElement>('#svHire')!;
    hb.hidden = !nearMine || this.miners.length >= SURVIVAL.maxMiners;
    const hl = `H: ${this.minerCost()} stone`;
    if (hb.lastElementChild!.textContent !== hl) hb.lastElementChild!.textContent = hl;
    const hn = this.miners.length ? 'Extra miner' : 'Miner';
    if (hb.firstElementChild!.textContent !== hn) hb.firstElementChild!.textContent = hn;
    const nearShop = this.mineOn && dist(this.x, this.y, SHOP.x, SHOP.y) < NEAR + 6;
    this.pad.querySelector<HTMLElement>('#svShopBtn')!.hidden = !nearShop || this.shopOpen;
    const inv = this.pad.querySelector<HTMLElement>('#svInv')!;
    inv.hidden = !this.inv && !(this.placing && this.placeType === 'belt');
    inv.classList.toggle('on', this.placing && this.placeType === 'belt');
    const il = `Belt 3 ×${this.inv}`;
    if (inv.firstElementChild!.textContent !== il) inv.firstElementChild!.textContent = il;
    const ig = this.pad.querySelector<HTMLElement>('#svInvGrab')!;
    ig.hidden = !this.invGrab && !(this.placing && this.placeType === 'grab');
    ig.classList.toggle('on', this.placing && this.placeType === 'grab');
    const gl = `Grabber ×${this.invGrab}`;
    if (ig.firstElementChild!.textContent !== gl) ig.firstElementChild!.textContent = gl;
    const is = this.pad.querySelector<HTMLElement>('#svInvShort')!;
    is.hidden = !this.invShort && !(this.placing && this.placeType === 'short');
    is.classList.toggle('on', this.placing && this.placeType === 'short');
    const sl = `Belt 1 ×${this.invShort}`;
    if (is.firstElementChild!.textContent !== sl) is.firstElementChild!.textContent = sl;
    const it = this.pad.querySelector<HTMLElement>('#svInvTurret')!;
    it.hidden = !this.invTurret && !(this.placing && this.placeType === 'turret');
    it.classList.toggle('on', this.placing && this.placeType === 'turret');
    const tl = `Turret ×${this.invTurret}`;
    if (it.firstElementChild!.textContent !== tl) it.firstElementChild!.textContent = tl;
    for (const [id, type, label] of [['#svInvSplit', 'split', 'Splitter'], ['#svInvChest', 'chest', 'Chest']] as const) {
      const el = this.pad.querySelector<HTMLElement>(id)!, n = this.count(type), on = this.placing && this.placeType === type;
      el.hidden = !n && !on; el.classList.toggle('on', on);
      const tx = `${label} ×${n}`;
      if (el.firstElementChild!.textContent !== tx) el.firstElementChild!.textContent = tx;
    }
    let nearTurret = false;
    for (const key of this.turrets.keys()) { const [c, r] = key.split(',').map(Number); if (dist(this.x, this.y, tileX(c), tileY(r)) < NEAR) nearTurret = true; }
    const ck = this.nearChest(), cch = ck ? this.chests.get(ck)! : null, chestFull = !!cch && cch.stone + cch.ammo > 0;
    const lb = this.pad.querySelector<HTMLElement>('#svLoad')!;
    lb.hidden = !(chestFull || (nearTurret && this.stoneAmmo));
    const ll = chestFull && !(nearTurret && this.stoneAmmo) ? 'Take' : 'Load';
    if (lb.firstElementChild!.textContent !== ll) lb.firstElementChild!.textContent = ll;
    const standing = tileAt(this.x, this.y);
    this.pad.querySelector<HTMLElement>('#svRotate')!.hidden = !this.placing && !(standing && this.belts.has(standing.c + ',' + standing.r));
    const help = this.placing ? (this.placeType === 'turret' || this.placeType === 'chest' ? `Tap a spot to place the ${this.placeType}.` : `Tap a spot to place the ${({ grab: 'grabber', split: 'splitter' } as Record<string, string>)[this.placeType] ?? 'belt'}. R turns it.`) : this.helpText;
    const hp = this.pad.querySelector<HTMLElement>('#svHelp')!;
    if (hp.textContent !== help) hp.textContent = help;
    if (this.shopOpen) this.renderShop();
    const al = this.useStone ? 'Stone' : AMMO[this.load.ammo].name;
    if (ab.firstElementChild!.textContent !== al) ab.firstElementChild!.textContent = al;
  }
}

/** The little guy, centred on the origin, facing angle a. */
function paintGuy(g: CanvasRenderingContext2D, L: Loadout, a: number, bob: number, pull: number, boltColor = AMMO[L.ammo].color) {
  g.rotate(a);
  // feet
  g.fillStyle = '#3a2c20'; g.beginPath(); g.arc(3 + bob, -6, 3.5, 0, 7); g.arc(3 - bob, 6, 3.5, 0, 7); g.fill();
  // body (shirt colour) and arms holding the crossbow forward
  g.fillStyle = L.color; g.beginPath(); g.ellipse(0, 0, GUY_R * .8, GUY_R, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(12, -5, 3, 0, 7); g.arc(12, 5, 3, 0, 7); g.fill();
  // crossbow: stock, bow and string; a bolt sits on it when loaded
  g.strokeStyle = '#5a3d22'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(4, 0); g.lineTo(26, 0); g.stroke();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, -12); g.quadraticCurveTo(28, 0, 22, 12); g.stroke();
  g.strokeStyle = '#e8e0d0'; g.lineWidth = 1; g.beginPath(); g.moveTo(22, -12); g.lineTo(22 - 8 * pull, 0); g.lineTo(22, 12); g.stroke();
  if (pull) { g.strokeStyle = boltColor; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 0); g.lineTo(30, 0); g.stroke(); }
  // head and hat
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, 0, 7.5, 0, 7); g.fill();
  if (L.hat === 'cap') { g.fillStyle = shade(L.color, -.25); g.beginPath(); g.arc(0, 0, 7.8, 0, 7); g.fill(); g.beginPath(); g.ellipse(7, 0, 5, 6, 0, -Math.PI / 2, Math.PI / 2); g.fill(); }
  else if (L.hat === 'helmet') { g.fillStyle = '#6b7a52'; g.beginPath(); g.arc(0, 0, 9.5, 0, 7); g.fill(); g.fillStyle = '#7f8f63'; g.beginPath(); g.arc(-1.5, -1.5, 5.5, 0, 7); g.fill(); }
  else if (L.hat === 'crown') {
    g.fillStyle = '#ffd34a'; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 8.5, an = i / 10 * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    g.closePath(); g.fill(); g.fillStyle = '#ff5a6a'; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill();
  }
}

/** Draws the little guy on the loadout screen. */
export function drawPreview(c: HTMLCanvasElement, L: Loadout) {
  const g = c.getContext('2d')!, dpr = Math.min(2, devicePixelRatio || 1), size = c.clientWidth || 96;
  c.width = c.height = Math.round(size * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
  g.fillStyle = '#8b7651'; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 7); g.fill();
  g.translate(size / 2 - 6, size / 2); g.scale(size / 52, size / 52);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(2, 4, GUY_R + 2, GUY_R, 0, 0, 7); g.fill();
  paintGuy(g, L, -.5, 0, 1);
}

const tileX = (c: number) => GX0 + c * TILE + TILE / 2, tileY = (r: number) => GY0 + r * TILE + TILE / 2;
function tileAt(x: number, y: number) {
  const c = Math.floor((x - GX0) / TILE), r = Math.floor((y - GY0) / TILE);
  return c >= 0 && r >= 0 && c < COLS && r < ROWS ? { c, r } : null;
}
/** Belts can't go on the mine, the machine or the shop. */
function blockedTile(c: number, r: number) {
  const x = tileX(c), y = tileY(r);
  return [MINE, MACHINE, SHOP].some(o => dist(x, y, o.x, o.y) < o.r + 10);
}
/** A splitter: stone comes in, and goes out to the left and right in turn. */
function paintSplitter(g: CanvasRenderingContext2D, x: number, y: number, d: number) {
  g.save(); g.translate(x, y); g.rotate(d * Math.PI / 2);
  g.fillStyle = '#4a4f7a'; g.fillRect(-11, -11, 22, 22);
  g.strokeStyle = '#e0b43a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(0, 0); g.lineTo(0, -8); g.moveTo(0, 0); g.lineTo(0, 8); g.stroke();
  g.fillStyle = '#e0b43a';
  g.beginPath(); g.moveTo(0, -11); g.lineTo(-3.5, -6); g.lineTo(3.5, -6); g.fill();
  g.beginPath(); g.moveTo(0, 11); g.lineTo(-3.5, 6); g.lineTo(3.5, 6); g.fill();
  g.restore();
}
/** A chest: a wooden box with a metal band. */
function paintChest(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-9, -7, 22, 20);
  g.fillStyle = '#8a5a2e'; g.fillRect(-11, -10, 22, 20);
  g.fillStyle = '#6a4222'; g.fillRect(-11, -3, 22, 3);
  g.fillStyle = '#c9a24a'; g.fillRect(-2.5, -4, 5, 6);
  g.strokeStyle = '#4a2e16'; g.lineWidth = 1.5; g.strokeRect(-11, -10, 22, 20);
  g.restore();
}
/** A turret: a round base with a barrel pointing at its last target. */
function paintTurret(g: CanvasRenderingContext2D, x: number, y: number, tu: Turret) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(2, 3, 11, 0, 7); g.fill();
  g.fillStyle = '#5b6670'; g.fillRect(-11, -11, 22, 22);
  g.fillStyle = '#7d8a95'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
  g.rotate(tu.face);
  g.fillStyle = '#2f363c'; g.fillRect(2, -2.5, 14, 5);
  g.fillStyle = tu.ammo ? '#e0b43a' : '#8a3a30'; g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.fill();
  g.restore();
}
/** A grabber: a turntable with an arm that swings from the back tile to the front tile. */
function paintGrabber(g: CanvasRenderingContext2D, x: number, y: number, gr: Grabber) {
  const s = TILE;
  g.save(); g.translate(x, y); g.rotate(gr.d * Math.PI / 2);
  g.fillStyle = '#4a5560'; g.fillRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
  g.strokeStyle = '#e0b43a'; g.lineWidth = 1.5; g.strokeRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
  // arm: points back while it waits, swings forward with a stone
  const k = gr.carry ? Math.min(1, gr.t / SURVIVAL.grabTime) : 0, a = Math.PI * (1 - k);
  g.fillStyle = '#2a3036'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
  g.strokeStyle = '#c9d3dc'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); g.stroke();
  g.strokeStyle = '#e0b43a'; g.lineWidth = 2;
  const hx = Math.cos(a) * 15, hy = Math.sin(a) * 15;
  g.beginPath(); g.arc(hx, hy, 4, a - 1.2, a + 1.2); g.stroke();
  if (gr.carry) { g.fillStyle = STONE; g.beginPath(); g.arc(hx, hy, 4.5, 0, 7); g.fill(); if (gr.ammo) { g.fillStyle = '#7fc8ff'; g.beginPath(); g.arc(hx, hy, 2, 0, 7); g.fill(); } }
  // a small arrow showing which way it moves stone
  g.fillStyle = '#e0b43a'; g.beginPath(); g.moveTo(s / 2 - 3, 0); g.lineTo(s / 2 - 8, -4); g.lineTo(s / 2 - 8, 4); g.fill();
  g.restore();
}
/** A conveyor tile with moving chevrons pointing along direction d. */
function paintBelt(g: CanvasRenderingContext2D, x: number, y: number, d: number, t: number, k = 1) {
  const s = TILE * k;
  g.save(); g.translate(x, y); g.rotate(d * Math.PI / 2);
  g.fillStyle = '#3b3f45'; g.fillRect(-s / 2, -s / 2, s, s);
  g.fillStyle = '#2a2d31'; g.fillRect(-s / 2, -s / 2, s, s * .14); g.fillRect(-s / 2, s / 2 - s * .14, s, s * .14);
  g.beginPath(); g.rect(-s / 2, -s / 2, s, s); g.clip();
  g.strokeStyle = '#e0b43a'; g.lineWidth = 2 * k;
  const off = (t * SURVIVAL.beltSpeed * k) % (s / 2);
  for (let i = -1; i < 2; i++) { const cx = -s / 2 + i * s / 2 + off; g.beginPath(); g.moveTo(cx - s * .12, -s * .2); g.lineTo(cx + s * .08, 0); g.lineTo(cx - s * .12, s * .2); g.stroke(); }
  g.restore();
}
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const trim = (n: number) => String(Math.round(n * 100) / 100);
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const easeInOut = (k: number) => k * k * (3 - 2 * k);
function approachAngle(a: number, b: number, step: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
