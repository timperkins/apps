import * as sfx from './audio';
import type { Input } from './input';

// ---------------------------------------------------------------------------
// World layout (world units; x runs down-right on screen, y down-left, z up)
// ---------------------------------------------------------------------------

const ISO_X = 0.866;
const ISO_Y = 0.5;
const CAMP = 7; // fence sits on the square ±CAMP
const GATE = 1.25; // half-width of each gate gap
const WORLD = 23; // player is kept inside ±WORLD
const BASE_CAPACITY = 10;
const PRICE = 10;
const LOGS_PER_TREE = 3;
const HITS_PER_TREE = 3;
const SPEED = 4.4;
const PLAYER_R = 0.3;
const MAX_QUEUE = 5;
const SAVE_KEY = 'your-doom:save';

const DROP = { x0: 0.7, y0: -2, x1: 2.5, y1: 0 };
const COUNTER = { x0: 3, y0: -2.5, x1: 4, y1: 0.5, top: 0.8 };
const CAMPFIRE = { x: -1.6, y: 1.4 };
const TENTS = [
  { x0: 4.3, y0: 4.0, x1: 6.1, y1: 5.8, h: 1.8, cloth: '#e9b46a', dark: '#c68a45', back: '#f3cc8e' },
  { x0: -5.8, y0: 3.4, x1: -4.0, y1: 5.2, h: 1.7, cloth: '#6aa9b8', dark: '#4b8597', back: '#8cc3cf' },
];
const SPAWN = { x: 5.2, y: 6.2 };
const EXIT = { x: -4.9, y: 5.6 };
const queueSpot = (i: number) => ({ x: 4.8, y: -1 + i * 0.95 });

// Conveyor belt (an upgrade): drop wood by the north gate and it rides to the counter.
const BELT_DROP = { x0: -3.2, y0: -6.3, x1: -1.6, y1: -4.7 };
const BELT_PATH = [
  { x: -1.4, y: -5.5 },
  { x: 3.5, y: -5.5 },
  { x: 3.5, y: -2.55 },
];
const BELT_SPEED = 1.9;
const BELT_W = 0.5;

export type UpgradeId =
  | 'belt' | 'bag' | 'axe' | 'worker' | 'boots' | 'price' | 'crowd' | 'grow' | 'bigtree'
  // Second tier: each appears once the upgrade it follows is maxed out.
  | 'beltspeed' | 'sled' | 'chainsaw' | 'crew' | 'skates' | 'royal' | 'market' | 'seeds' | 'megatree';
interface Upgrade {
  id: UpgradeId;
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  prices: number[];
  level: number;
  paid: number;
  payT: number;
  /** Menu-only upgrades have no pad in the camp. */
  menuOnly?: boolean;
  /** Only offered once this other upgrade is maxed out (it takes over its pad). */
  after?: UpgradeId;
}
const BAG_STEP = 5; // extra logs per bag level
const AXE_SPEED = [0.3, 0.24, 0.19, 0.15]; // seconds per swing

// Hired woodcutters walk out through the nearest gate, chop, and bring wood to a drop-off.
const WORKER_CAPACITY = 6;
const WORKER_SPEED = 2.6;
const WORKER_CHOP = 0.5;
const GATES = [
  { inner: { x: 0, y: -6.2 }, outer: { x: 0, y: -8 } },
  { inner: { x: -6.2, y: 0 }, outer: { x: -8, y: 0 } },
];
const HIRE_SPOT = { x: 2.9, y: 2.4 };
const WORKER_LOOKS = [
  { hat: '#e8862a', coat: '#3f8a4a' },
  { hat: '#7a4fb5', coat: '#c0892c' },
  { hat: '#d23f5c', coat: '#3c6fa8' },
];

interface Worker {
  x: number;
  y: number;
  face: number;
  walk: number;
  moving: boolean;
  stack: number;
  state: 'toTree' | 'chop' | 'toDrop' | 'drop';
  path: { x: number; y: number }[];
  tree: Tree | null;
  chopT: number;
  swing: number;
  dropT: number;
  hat: string;
  coat: string;
}

const BARK = '#a0602f';
const BARK_DARK = '#7b4520';
const WOOD = '#f2c98b';
const RING = '#c9934f';

type V3 = { x: number; y: number; z: number };

interface Tree {
  x: number;
  y: number;
  size: number;
  hp: number;
  stump: boolean;
  regrow: number;
  grow: number;
  shake: number;
  golden?: boolean;
}

type Stat = 'trees' | 'sold' | 'upgrades' | 'golden' | 'hired' | 'earned' | 'belt' | 'escapes';
interface Goal {
  text: string;
  stat: Stat;
  target: number;
  reward: number;
}
const GOALS: Goal[] = [
  { text: 'Chop 3 trees', stat: 'trees', target: 3, reward: 20 },
  { text: 'Sell 10 logs', stat: 'sold', target: 10, reward: 30 },
  { text: 'Buy an upgrade', stat: 'upgrades', target: 1, reward: 30 },
  { text: 'Chop a golden tree', stat: 'golden', target: 1, reward: 50 },
  { text: 'Hire a woodcutter', stat: 'hired', target: 1, reward: 60 },
  { text: 'Sell 50 logs', stat: 'sold', target: 50, reward: 100 },
  { text: 'Get away from the wolf', stat: 'escapes', target: 1, reward: 80 },
  { text: 'Build the wood belt', stat: 'belt', target: 1, reward: 100 },
  { text: 'Earn 1,000 eeeddd', stat: 'earned', target: 1000, reward: 200 },
  { text: 'Chop 3 golden trees', stat: 'golden', target: 3, reward: 200 },
  { text: 'Sell 200 logs', stat: 'sold', target: 200, reward: 400 },
];
/** After the list runs out, keep going with ever bigger selling goals. */
function goalAt(i: number): Goal {
  if (i < GOALS.length) return GOALS[i];
  const n = i - GOALS.length + 1;
  return { text: `Sell ${200 + n * 150} logs`, stat: 'sold', target: 200 + n * 150, reward: 400 + n * 100 };
}

interface Wolf {
  x: number;
  y: number;
  state: 'roam' | 'chase' | 'flee';
  t: number;
  tx: number;
  ty: number;
  face: number;
  walk: number;
}

interface Post {
  x: number;
  y: number;
  h: number;
}

interface Customer {
  x: number;
  y: number;
  want: number;
  got: number;
  incoming: number;
  leaving: boolean;
  fade: number;
  takeT: number;
  walk: number;
  face: number;
  moving: boolean;
  hood: string;
  coat: string;
  skin: string;
  happy: number;
  rich: boolean;
}

interface Flyer {
  from: V3;
  to: () => V3;
  t: number;
  dur: number;
  delay: number;
  arc: number;
  spin: number;
  onArrive: () => void;
}

interface CoinFlyer {
  x: number;
  y: number;
  t: number;
  dur: number;
  /** Set when the coin flies from the HUD into the world (paying for an upgrade). */
  toWorld?: V3;
  onArrive: () => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

interface FloatText {
  x: number;
  y: number;
  z: number;
  t: number;
  text: string;
}

export interface GameHooks {
  moneyTarget: () => { x: number; y: number };
  onGoal: (text: string, cur: number, target: number, reward: number) => void;
  onToast: (text: string) => void;
  onMoney: (value: number, bump: boolean) => void;
  onFirstMove: () => void;
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function inCamp(x: number, y: number) {
  return Math.abs(x) < CAMP && Math.abs(y) < CAMP;
}

export class Game {
  private g: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private S = 40; // pixels per world unit
  private camX = 0;
  private camY = 1;
  private time = 0;

  private player = {
    x: 0,
    y: 1,
    face: 1,
    walk: 0,
    moving: false,
    stack: 0,
    incoming: 0,
    chopT: 0,
    swing: 0,
    chopping: null as Tree | null,
    dropT: 0,
    stepDist: 0,
    stepSide: 1,
  };

  private trees: Tree[] = [];
  private posts: Post[] = [];
  private patches: { x: number; y: number; r: number; tone: number }[] = [];
  private customers: Customer[] = [];
  private flyers: Flyer[] = [];
  private coins: CoinFlyer[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private footprints: { x: number; y: number; age: number; a: number }[] = [];
  private flakes: { x: number; y: number; r: number; v: number; ph: number }[] = [];

  private beltItems: { d: number }[] = [];
  private baseUpgrades: Upgrade[] = [
    { id: 'belt', name: 'Wood belt', ...BELT_DROP, prices: [150], level: 0, paid: 0, payT: 0 },
    { id: 'bag', name: 'Bigger bag', x0: -3.3, y0: -3.6, x1: -1.7, y1: -2.0, prices: [40, 100, 220, 450], level: 0, paid: 0, payT: 0 },
    { id: 'axe', name: 'Sharper axe', x0: -5.5, y0: -3.6, x1: -3.9, y1: -2.0, prices: [60, 160, 380], level: 0, paid: 0, payT: 0 },
    { id: 'worker', name: 'Hire woodcutter', x0: 0, y0: 2.4, x1: 1.6, y1: 4.0, prices: [80, 200, 400], level: 0, paid: 0, payT: 0 },
    { id: 'boots', name: 'Snow boots', x0: 0, y0: 0, x1: 0, y1: 0, prices: [50, 150, 350], level: 0, paid: 0, payT: 0, menuOnly: true },
    { id: 'price', name: 'Fancy wood', x0: 0, y0: 0, x1: 0, y1: 0, prices: [120, 300, 700], level: 0, paid: 0, payT: 0, menuOnly: true },
    { id: 'crowd', name: 'Town sign', x0: 0, y0: 0, x1: 0, y1: 0, prices: [90], level: 0, paid: 0, payT: 0, menuOnly: true },
    { id: 'grow', name: 'Tree fertilizer', x0: 0, y0: 0, x1: 0, y1: 0, prices: [70, 200], level: 0, paid: 0, payT: 0, menuOnly: true },
    { id: 'bigtree', name: 'Giant trees', x0: 0, y0: 0, x1: 0, y1: 0, prices: [250], level: 0, paid: 0, payT: 0, menuOnly: true },
  ];
  private upgrades: Upgrade[] = [
    ...this.baseUpgrades,
    ...(
      [
        ['beltspeed', 'Turbo belt', 'belt', [200, 450]],
        ['sled', 'Wood sled', 'bag', [600, 1200]],
        ['chainsaw', 'Chainsaw', 'axe', [700, 1500]],
        ['crew', 'Woodcutter training', 'worker', [250, 600]],
        ['skates', 'Ice skates', 'boots', [400, 900]],
        ['royal', 'Royal wood', 'price', [1500, 3000]],
        ['market', 'Town market', 'crowd', [400]],
        ['seeds', 'Magic seeds', 'grow', [500]],
        ['megatree', 'Mega trees', 'bigtree', [800]],
      ] as [UpgradeId, string, UpgradeId, number[]][]
    ).map(([id, name, after, prices]) => {
      const parent = this.baseUpgrades.find((u) => u.id === after)!;
      return { ...parent, id, name, after, prices, level: 0, paid: 0, payT: 0 };
    }),
  ];
  private workers: Worker[] = [];
  private stats: Record<Stat, number> = { trees: 0, sold: 0, upgrades: 0, golden: 0, hired: 0, earned: 0, belt: 0, escapes: 0 };
  private goal = 0;
  private goldenT = 12;
  private wolf: Wolf | null = null;
  private wolfT = 25;
  private shakeAmt = 0;
  private pile = 0;
  private pileIncoming = 0;
  private spawnT = 0.6;
  private money = 0;
  private movedOnce = false;
  private rand = rng(7);

  constructor(
    private canvas: HTMLCanvasElement,
    private input: Input,
    private hooks: GameHooks,
  ) {
    this.g = canvas.getContext('2d')!;
    input.onGesture(() => sfx.unlockAudio());
    this.load();
    for (let i = 0; i < this.upgrade('worker').level; i++) this.hireWorker(i);
    hooks.onMoney(this.money, false);
    this.buildWorld();
    this.checkGoal();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // -------------------------------------------------------------------------
  // Save / upgrades
  // -------------------------------------------------------------------------

  private load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}');
      this.money = Math.max(0, Number(data.money) || 0);
      this.goal = Math.max(0, Number(data.goal) || 0);
      for (const k of Object.keys(this.stats) as Stat[]) this.stats[k] = Math.max(0, Number(data.stats?.[k]) || 0);
      for (const u of this.upgrades) {
        const s = data.upgrades?.[u.id];
        if (!s) continue;
        u.level = Math.max(0, Math.min(u.prices.length, Number(s.level) || 0));
        u.paid = Math.max(0, Number(s.paid) || 0);
      }
    } catch {
      /* no save yet, or storage unavailable */
    }
  }

  private saveBlocked = false;

  private save() {
    if (this.saveBlocked) return;
    const upgrades: Record<string, { level: number; paid: number }> = {};
    for (const u of this.upgrades) upgrades[u.id] = { level: u.level, paid: u.paid };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ money: this.money, upgrades, goal: this.goal, stats: this.stats }));
    } catch {
      /* storage unavailable */
    }
  }

  private upgrade(id: UpgradeId) {
    return this.upgrades.find((u) => u.id === id)!;
  }

  private lvl(id: UpgradeId) {
    return this.upgrade(id).level;
  }

  private maxed(u: Upgrade) {
    return u.level >= u.prices.length;
  }

  /** Offered right now: its parent (if any) is maxed and it isn't maxed itself. */
  private available(u: Upgrade) {
    return !this.maxed(u) && (!u.after || this.maxed(this.upgrade(u.after)));
  }

  private get capacity() {
    return BASE_CAPACITY + this.lvl('bag') * BAG_STEP + this.lvl('sled') * 10;
  }

  private get chopInterval() {
    const saw = this.lvl('chainsaw');
    return saw > 0 ? [0.11, 0.08][saw - 1] : AXE_SPEED[this.lvl('axe')];
  }

  private get price() {
    return PRICE + 5 * this.lvl('price') + 10 * this.lvl('royal');
  }

  private get logsPerTree() {
    return LOGS_PER_TREE + this.lvl('bigtree') + this.lvl('megatree');
  }

  private get beltSpeed() {
    return BELT_SPEED * [1, 1.6, 2.2][this.lvl('beltspeed')];
  }

  private get workerCapacity() {
    return WORKER_CAPACITY + 3 * this.lvl('crew');
  }

  private get workerSpeed() {
    return WORKER_SPEED * (1 + 0.35 * this.lvl('crew'));
  }

  private regrowTime() {
    const k = this.lvl('seeds') > 0 ? 0.15 : [1, 0.6, 0.35][this.lvl('grow')];
    return (22 + Math.random() * 8) * k;
  }

  private get hasBelt() {
    return this.upgrade('belt').level > 0;
  }

  private updateUpgrades(dt: number) {
    const p = this.player;
    for (const u of this.upgrades) {
      const price = u.prices[u.level];
      if (price === undefined || u.menuOnly || !this.available(u)) continue;
      const inside = p.x > u.x0 && p.x < u.x1 && p.y > u.y0 && p.y < u.y1;
      if (!inside || this.money <= 0) {
        u.payT = -0.25; // short pause before paying starts
        continue;
      }
      u.payT += dt;
      const step = Math.max(1, Math.ceil(price / 30));
      let paidNow = false;
      while (u.payT >= 0.035 && this.money > 0 && u.paid < price) {
        u.payT -= 0.035;
        const chunk = Math.min(step, this.money, price - u.paid);
        this.money -= chunk;
        u.paid += chunk;
        paidNow = true;
        const from = this.hooks.moneyTarget();
        this.coins.push({ x: from.x, y: from.y, t: 0, dur: 0.35, toWorld: { x: (u.x0 + u.x1) / 2, y: (u.y0 + u.y1) / 2, z: 0 }, onArrive: () => {} });
      }
      if (!paidNow) continue;
      if (u.paid >= price) this.completeUpgrade(u);
      this.hooks.onMoney(this.money, false);
      this.save();
    }
  }

  private bump(stat: Stat, n = 1) {
    this.stats[stat] += n;
    this.checkGoal();
  }

  private checkGoal() {
    const g = goalAt(this.goal);
    const cur = Math.min(g.target, this.stats[g.stat]);
    if (cur >= g.target) {
      this.goal++;
      this.hooks.onToast(`Goal done! +${g.reward} eeeddd`);
      sfx.upgrade();
      // Shower of coins from the player.
      const s = this.project(this.player.x, this.player.y, 1.4);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const amount = Math.floor(g.reward / n) + (i === 0 ? g.reward % n : 0);
        this.coins.push({
          x: s.x + (Math.random() - 0.5) * 60,
          y: s.y + (Math.random() - 0.5) * 30,
          t: -i * 0.06,
          dur: 0.7,
          onArrive: () => this.earn(amount, false),
        });
      }
      this.save();
      this.checkGoal();
      return;
    }
    this.hooks.onGoal(g.text, cur, g.target, g.reward);
  }

  /** Add eeeddd (counts toward the "earn" goals). */
  private earn(n: number, countSale: boolean) {
    this.money += n;
    this.stats.earned += n;
    if (countSale) this.stats.sold++;
    this.save();
    this.hooks.onMoney(this.money, true);
    sfx.coin();
    this.checkGoal();
  }

  private completeUpgrade(u: Upgrade) {
    u.paid = 0;
    u.level++;
    this.stats.upgrades++;
    if (u.id === 'worker') this.stats.hired++;
    if (u.id === 'belt') this.stats.belt = 1;
    this.checkGoal();
    if (u.id === 'worker') this.hireWorker(u.level - 1);
    sfx.upgrade();
    const cx = u.menuOnly ? this.player.x : (u.x0 + u.x1) / 2;
    const cy = u.menuOnly ? this.player.y : (u.y0 + u.y1) / 2;
    this.texts.push({ x: cx, y: cy, z: 1.2, t: 0, text: u.id === 'belt' ? 'Belt built!' : u.id === 'worker' ? 'Hired!' : `${u.name}!` });
    const next = this.upgrades.find((n) => n.after === u.id);
    if (next && this.maxed(u)) this.hooks.onToast(`New upgrade: ${next.name}!`);
    for (let i = 0; i < 24; i++) {
      this.particles.push({
        x: cx, y: cy, z: 0.2,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: 3 + Math.random() * 3,
        life: 1, max: 1, color: ['#ffd23a', '#ffffff', '#ff7a1a', '#3fbf7f'][i % 4], size: 0.07, gravity: 9,
      });
    }
  }

  // --- Public API for the upgrades menu ---------------------------------------

  get eeeddd() {
    return this.money;
  }

  upgradeList() {
    const describe: Record<UpgradeId, (level: number) => string> = {
      belt: () => 'Drop wood by the north gate and a belt carries it to the counter.',
      bag: (l) => `Carry ${BASE_CAPACITY + l * BAG_STEP} → ${BASE_CAPACITY + (l + 1) * BAG_STEP} logs.`,
      axe: () => 'Chop trees faster.',
      worker: (l) => `A helper who chops trees and brings the wood back. You have ${l} of ${this.upgrade('worker').prices.length}.`,
      boots: () => 'Walk 15% faster.',
      price: (l) => `People pay ${PRICE + 5 * l} → ${PRICE + 5 * (l + 1)} eeeddd per log.`,
      crowd: () => 'Twice as many townspeople come to buy wood.',
      grow: () => 'Chopped trees grow back faster.',
      bigtree: () => `Every tree gives ${LOGS_PER_TREE + 1} logs.`,
      beltspeed: () => 'The belt runs faster.',
      sled: () => `Carry 10 more logs (now ${this.capacity}).`,
      chainsaw: () => 'Chop trees super fast.',
      crew: () => 'Woodcutters walk faster and carry 3 more logs.',
      skates: () => 'Walk another 15% faster.',
      royal: () => `People pay ${this.price} → ${this.price + 10} eeeddd per log.`,
      market: () => 'Even more townspeople come to buy.',
      seeds: () => 'Trees grow back almost right away.',
      megatree: () => `Every tree gives ${this.logsPerTree + 1} logs.`,
    };
    // One row per upgrade slot: a maxed upgrade is replaced by the one that follows it.
    const shown = this.upgrades.filter((u) => {
      if (u.after && !this.maxed(this.upgrade(u.after))) return false;
      const next = this.upgrades.find((n) => n.after === u.id);
      return !(next && this.maxed(u));
    });
    // New and menu-only upgrades first, then the ones that also have pads in camp.
    const ordered = [...shown.filter((u) => u.menuOnly), ...shown.filter((u) => !u.menuOnly)];
    return ordered.map((u) => {
      const price = u.prices[u.level];
      return {
        id: u.id,
        name: u.name,
        level: u.level,
        maxLevel: u.prices.length,
        cost: price === undefined ? null : price - u.paid,
        isNew: !!u.after,
        text: describe[u.id](u.level),
      };
    });
  }

  /** Buy the next level of an upgrade outright. Returns false if it's maxed or too expensive. */
  buy(id: UpgradeId): boolean {
    const u = this.upgrade(id);
    const price = u.prices[u.level];
    if (price === undefined || !this.available(u)) return false;
    const cost = price - u.paid;
    if (this.money < cost) return false;
    this.money -= cost;
    this.completeUpgrade(u);
    this.hooks.onMoney(this.money, true);
    this.save();
    return true;
  }

  /** Wipe the save. The page reloads afterwards to start fresh. */
  resetSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
    this.money = 0;
    this.saveBlocked = true;
  }

  private updateBelt(dt: number) {
    const len = beltLength();
    for (const it of this.beltItems) it.d += dt * this.beltSpeed;
    const done = this.beltItems.filter((it) => it.d >= len);
    this.beltItems = this.beltItems.filter((it) => it.d < len);
    for (const _ of done) {
      const slot = this.pile + this.pileIncoming;
      this.pileIncoming++;
      const end = BELT_PATH[BELT_PATH.length - 1];
      this.flyers.push({
        from: { x: end.x, y: end.y, z: 0.25 },
        to: () => pileSlot(slot),
        t: 0,
        dur: 0.25,
        delay: 0,
        arc: 0.5,
        spin: 1,
        onArrive: () => {
          this.pileIncoming--;
          this.pile++;
          sfx.pop();
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private buildWorld() {
    const r = rng(1234);
    // Trees: a jittered grid outside the camp.
    const step = 2.05;
    const reach = WORLD + 6;
    for (let gx = -reach; gx <= reach; gx += step) {
      for (let gy = -reach; gy <= reach; gy += step) {
        const x = gx + (r() - 0.5) * 0.9;
        const y = gy + (r() - 0.5) * 0.9;
        if (Math.max(Math.abs(x), Math.abs(y)) < CAMP + 2) continue;
        if (r() < 0.25) continue;
        this.trees.push({ x, y, size: 0.85 + r() * 0.35, hp: HITS_PER_TREE, stump: false, regrow: 0, grow: 1, shake: 0 });
      }
    }
    // Fence posts around the camp, leaving two gates on the far sides.
    const ps = 0.42;
    const n = Math.round((CAMP * 2) / ps);
    for (let i = 0; i <= n; i++) {
      const t = -CAMP + (i * CAMP * 2) / n;
      const edges: [number, number, boolean][] = [
        [t, -CAMP, Math.abs(t) < GATE], // far-right edge, gate
        [-CAMP, t, Math.abs(t) < GATE], // far-left edge, gate
        [t, CAMP, false],
        [CAMP, t, false],
      ];
      for (const [x, y, gap] of edges) {
        if (gap) continue;
        if (this.posts.some((p) => Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01)) continue;
        this.posts.push({ x, y, h: 1.15 + r() * 0.25 });
      }
    }
    // Gate posts are taller.
    for (const [x, y] of [
      [-GATE - 0.1, -CAMP],
      [GATE + 0.1, -CAMP],
      [-CAMP, -GATE - 0.1],
      [-CAMP, GATE + 0.1],
    ]) {
      this.posts.push({ x, y, h: 1.75 });
    }
    // Snow texture patches.
    for (let i = 0; i < 520; i++) {
      this.patches.push({ x: (r() - 0.5) * 70, y: (r() - 0.5) * 70, r: 0.4 + r() * 1.6, tone: r() });
    }
    for (let i = 0; i < 70; i++) {
      this.flakes.push({ x: r(), y: r(), r: 1 + r() * 2.2, v: 0.04 + r() * 0.07, ph: r() * 6 });
    }
  }

  private resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.S = Math.max(24, Math.min(58, Math.min(this.w / 10, this.h / 14)));
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dt: number) {
    this.time += dt;
    this.updatePlayer(dt);
    this.updateChopping(dt);
    this.updateDropping(dt);
    this.updateBelt(dt);
    this.updateUpgrades(dt);
    this.updateWorkers(dt);
    this.updateCustomers(dt);
    this.updateTrees(dt);
    this.updateEffects(dt);
    this.updateGolden(dt);
    this.updateWolf(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt);
    this.camX += (this.player.x - this.camX) * Math.min(1, dt * 6);
    this.camY += (this.player.y - this.camY) * Math.min(1, dt * 6);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const d = this.input.direction();
    const mag = Math.hypot(d.x, d.y);
    p.moving = mag > 0.05;
    if (!p.moving) return;
    if (!this.movedOnce) {
      this.movedOnce = true;
      this.hooks.onFirstMove();
    }
    // Screen direction -> world direction so the character moves the way the stick points.
    let wx = (d.x / ISO_X + d.y / ISO_Y) / 2;
    let wy = (d.y / ISO_Y - d.x / ISO_X) / 2;
    const wl = Math.hypot(wx, wy) || 1;
    const speed = SPEED * (1 + 0.15 * this.lvl('boots') + 0.15 * this.lvl('skates'));
    wx = (wx / wl) * mag * speed * dt;
    wy = (wy / wl) * mag * speed * dt;
    const ox = p.x;
    const oy = p.y;
    p.x += wx;
    p.y += wy;
    this.collide(p);
    p.x = Math.max(-WORLD, Math.min(WORLD, p.x));
    p.y = Math.max(-WORLD, Math.min(WORLD, p.y));
    if (d.x > 0.15) p.face = 1;
    else if (d.x < -0.15) p.face = -1;
    p.walk += dt * 13 * mag;

    // Footprints in the snow.
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.stepDist += moved;
    if (p.stepDist > 0.42) {
      p.stepDist = 0;
      if (!inCamp(p.x, p.y)) {
        p.stepSide *= -1;
        const nx = -wy / (Math.hypot(wx, wy) || 1);
        const ny = wx / (Math.hypot(wx, wy) || 1);
        this.footprints.push({ x: p.x + nx * 0.1 * p.stepSide, y: p.y + ny * 0.1 * p.stepSide, age: 0, a: Math.atan2(wy, wx) });
        if (this.footprints.length > 120) this.footprints.shift();
      }
    }
  }

  private collide(p: { x: number; y: number }) {
    const circle = (cx: number, cy: number, r: number) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const min = r + PLAYER_R;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * min;
        p.y = cy + (dy / d) * min;
      }
    };
    const box = (x0: number, y0: number, x1: number, y1: number) => {
      const cx = Math.max(x0, Math.min(x1, p.x));
      const cy = Math.max(y0, Math.min(y1, p.y));
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < PLAYER_R * PLAYER_R) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * PLAYER_R;
          p.y = cy + (dy / d) * PLAYER_R;
        } else {
          // Inside the box: push out the nearest side.
          const opts = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y];
          const m = Math.min(...opts);
          if (m === opts[0]) p.x = x0 - PLAYER_R;
          else if (m === opts[1]) p.x = x1 + PLAYER_R;
          else if (m === opts[2]) p.y = y0 - PLAYER_R;
          else p.y = y1 + PLAYER_R;
        }
      }
    };
    for (const t of this.trees) {
      if (Math.abs(t.x - p.x) > 1.5 || Math.abs(t.y - p.y) > 1.5) continue;
      circle(t.x, t.y, t.stump ? 0.24 : 0.36 * t.size);
    }
    for (const post of this.posts) {
      if (Math.abs(post.x - p.x) > 1 || Math.abs(post.y - p.y) > 1) continue;
      circle(post.x, post.y, 0.21);
    }
    circle(CAMPFIRE.x, CAMPFIRE.y, 0.7);
    box(COUNTER.x0, COUNTER.y0, COUNTER.x1, COUNTER.y1);
    for (const t of TENTS) box(t.x0, t.y0, t.x1, t.y1);
  }

  private nearestTree(x: number, y: number, maxD: number): Tree | null {
    let best: Tree | null = null;
    let bd = maxD;
    for (const t of this.trees) {
      if (t.stump || t.grow < 1) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  /** Nearest tree counting the walk out through a gate. */
  private nearestTreeByRoute(from: { x: number; y: number }): Tree | null {
    let best: Tree | null = null;
    let bd = Infinity;
    for (const t of this.trees) {
      if (t.stump || t.grow < 1) continue;
      let d = 0;
      let prev = from;
      for (const q of this.route(from, t)) {
        d += Math.hypot(q.x - prev.x, q.y - prev.y);
        prev = q;
      }
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private updateChopping(dt: number) {
    const p = this.player;
    p.swing = Math.max(0, p.swing - dt * 5);
    const room = this.capacity - p.stack - p.incoming;
    const tree = room > 0 ? this.nearestTree(p.x, p.y, 1.15) : null;
    p.chopping = tree;
    if (!tree) {
      p.chopT = 0;
      return;
    }
    // Face the tree on screen.
    const sx = (tree.x - tree.y) - (p.x - p.y);
    if (!p.moving && Math.abs(sx) > 0.05) p.face = sx > 0 ? 1 : -1;
    p.chopT += dt;
    if (p.chopT < this.chopInterval) return;
    p.chopT = 0;
    p.swing = 1;
    tree.hp--;
    tree.shake = 0.3;
    sfx.chop();
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: tree.x,
        y: tree.y,
        z: 0.4,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        vz: 2 + Math.random() * 2,
        life: 0.6,
        max: 0.6,
        color: Math.random() < 0.5 ? WOOD : BARK,
        size: 0.07,
        gravity: 9,
      });
    }
    if (tree.hp > 0) return;

    // Timber!
    tree.stump = true;
    tree.regrow = this.regrowTime();
    sfx.timber();
    this.shakeAmt = Math.max(this.shakeAmt, 0.25);
    this.bump('trees');
    if (tree.golden) {
      tree.golden = false;
      this.goldTreeReward(tree);
    }
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: tree.x + (Math.random() - 0.5) * 0.8,
        y: tree.y + (Math.random() - 0.5) * 0.8,
        z: 0.6 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        vz: Math.random() * 1.5,
        life: 0.9,
        max: 0.9,
        color: '#ffffff',
        size: 0.12,
        gravity: 3,
      });
    }
    const count = Math.min(this.logsPerTree, room);
    for (let i = 0; i < count; i++) {
      p.incoming++;
      const from = { x: tree.x, y: tree.y, z: 0.8 + i * 0.3 };
      this.flyers.push({
        from,
        to: () => ({ x: p.x, y: p.y, z: 1.0 + (p.stack + 0.5) * 0.17 }),
        t: 0,
        dur: 0.4,
        delay: i * 0.12,
        arc: 1.2,
        spin: Math.random() < 0.5 ? -1 : 1,
        onArrive: () => {
          p.incoming--;
          p.stack++;
          sfx.pop();
        },
      });
    }
  }

  private updateDropping(dt: number) {
    const p = this.player;
    const within = (r: { x0: number; y0: number; x1: number; y1: number }) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
    const atCounter = within(DROP);
    const atBelt = this.hasBelt && within(BELT_DROP);
    if ((!atCounter && !atBelt) || p.stack <= 0) {
      p.dropT = 0.1;
      return;
    }
    p.dropT += dt;
    while (p.dropT >= 0.08 && p.stack > 0) {
      p.dropT -= 0.08;
      const from = { x: p.x, y: p.y, z: 1.0 + p.stack * 0.17 };
      p.stack--;
      this.sendLog(from, atBelt);
    }
  }

  /** Throw one log from a carrier onto the belt or the counter pile. */
  private sendLog(from: V3, toBelt: boolean) {
    if (toBelt) {
      const start = BELT_PATH[0];
      this.flyers.push({
        from,
        to: () => ({ x: start.x, y: start.y, z: 0.25 }),
        t: 0,
        dur: 0.3,
        delay: 0,
        arc: 0.8,
        spin: 1,
        onArrive: () => {
          this.beltItems.push({ d: 0 });
          sfx.pop();
        },
      });
      return;
    }
    const slot = this.pile + this.pileIncoming;
    this.pileIncoming++;
    this.flyers.push({
      from,
      to: () => pileSlot(slot),
      t: 0,
      dur: 0.32,
      delay: 0,
      arc: 1,
      spin: 1,
      onArrive: () => {
        this.pileIncoming--;
        this.pile++;
        sfx.pop();
      },
    });
  }

  // -------------------------------------------------------------------------
  // Woodcutters
  // -------------------------------------------------------------------------

  private hireWorker(i: number) {
    const look = WORKER_LOOKS[i % WORKER_LOOKS.length];
    this.workers.push({
      x: HIRE_SPOT.x,
      y: HIRE_SPOT.y,
      face: 1,
      walk: 0,
      moving: false,
      stack: 0,
      state: 'toTree',
      path: [],
      tree: null,
      chopT: 0,
      swing: 0,
      dropT: 0,
      ...look,
    });
  }

  /** Waypoints from a to b, going through the best gate when crossing the fence. */
  private route(a: { x: number; y: number }, b: { x: number; y: number }) {
    const aIn = inCamp(a.x, a.y);
    const bIn = inCamp(b.x, b.y);
    if (aIn === bIn) return [b];
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    let best = GATES[0];
    let bd = Infinity;
    for (const g of GATES) {
      const d = dist(a, aIn ? g.inner : g.outer) + dist(b, bIn ? g.inner : g.outer);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return aIn ? [best.inner, best.outer, b] : [best.outer, best.inner, b];
  }

  private pickTree(w: Worker): Tree | null {
    const claimed = new Set(this.workers.map((o) => o.tree));
    let best: Tree | null = null;
    let bd = Infinity;
    for (const t of this.trees) {
      if (t.stump || t.golden || t.grow < 1 || claimed.has(t) || Math.max(Math.abs(t.x), Math.abs(t.y)) > WORLD - 1) continue;
      // Distance from the nearest gate, so workers stay close to camp.
      let d = Infinity;
      for (const g of GATES) d = Math.min(d, Math.hypot(t.x - g.outer.x, t.y - g.outer.y));
      d += Math.hypot(t.x - w.x, t.y - w.y) * 0.15 + Math.random() * 0.5;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private workerDrop(w: Worker) {
    const zones: { r: typeof DROP; belt: boolean }[] = [{ r: DROP, belt: false }];
    if (this.hasBelt) zones.push({ r: BELT_DROP, belt: true });
    let best = zones[0];
    let bd = Infinity;
    for (const z of zones) {
      const c = { x: (z.r.x0 + z.r.x1) / 2, y: (z.r.y0 + z.r.y1) / 2 };
      const d = this.route(w, c).reduce((acc, p, i, arr) => acc + Math.hypot(p.x - (i ? arr[i - 1].x : w.x), p.y - (i ? arr[i - 1].y : w.y)), 0);
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    return best;
  }

  private updateWorkers(dt: number) {
    for (const w of this.workers) {
      w.swing = Math.max(0, w.swing - dt * 4);
      w.moving = false;
      if (w.state === 'toTree') {
        if (!w.tree || w.tree.stump) {
          w.tree = this.pickTree(w);
          if (!w.tree) continue;
          const t = w.tree;
          const ang = Math.atan2(w.y - t.y, w.x - t.x);
          w.path = this.route(w, { x: t.x + Math.cos(ang) * 0.75, y: t.y + Math.sin(ang) * 0.75 });
        }
        if (this.walkPath(w, dt)) w.state = 'chop';
      } else if (w.state === 'chop') {
        const t = w.tree;
        if (!t || t.stump) {
          // Someone else felled it.
          w.state = w.stack >= this.workerCapacity ? 'toDrop' : 'toTree';
          w.tree = null;
          w.path = [];
          continue;
        }
        const sx = t.x - t.y - (w.x - w.y);
        if (Math.abs(sx) > 0.05) w.face = sx > 0 ? 1 : -1;
        w.chopT += dt;
        if (w.chopT < WORKER_CHOP) continue;
        w.chopT = 0;
        w.swing = 1;
        t.hp--;
        t.shake = 0.3;
        if (this.onScreen(t.x, t.y, 0)) sfx.chop();
        if (t.hp > 0) continue;
        t.stump = true;
        t.regrow = this.regrowTime();
        w.stack = Math.min(this.workerCapacity, w.stack + this.logsPerTree);
        w.tree = null;
        if (w.stack >= this.workerCapacity) {
          w.state = 'toDrop';
          w.path = [];
        } else {
          w.state = 'toTree';
        }
      } else if (w.state === 'toDrop') {
        if (!w.path.length) {
          const z = this.workerDrop(w);
          const jx = (Math.random() - 0.5) * 0.8;
          const jy = (Math.random() - 0.5) * 0.8;
          w.path = this.route(w, { x: (z.r.x0 + z.r.x1) / 2 + jx, y: (z.r.y0 + z.r.y1) / 2 + jy });
        }
        if (this.walkPath(w, dt)) {
          w.state = 'drop';
          w.dropT = 0;
        }
      } else {
        const atBelt = this.hasBelt && w.x > BELT_DROP.x0 && w.x < BELT_DROP.x1 && w.y > BELT_DROP.y0 && w.y < BELT_DROP.y1;
        w.dropT += dt;
        while (w.dropT >= 0.12 && w.stack > 0) {
          w.dropT -= 0.12;
          this.sendLog({ x: w.x, y: w.y, z: 1.0 + w.stack * 0.17 }, atBelt);
          w.stack--;
        }
        if (w.stack <= 0) {
          w.state = 'toTree';
          w.tree = null;
        }
      }
    }
  }

  /** Move along the waypoint path; true once the last point is reached. */
  private walkPath(w: Worker, dt: number): boolean {
    let budget = this.workerSpeed * dt;
    while (w.path.length && budget > 0) {
      const t = w.path[0];
      const dx = t.x - w.x;
      const dy = t.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        w.x = t.x;
        w.y = t.y;
        budget -= d;
        w.path.shift();
        continue;
      }
      w.x += (dx / d) * budget;
      w.y += (dy / d) * budget;
      w.moving = true;
      const sx = dx - dy;
      if (Math.abs(sx) > 0.02) w.face = sx > 0 ? 1 : -1;
      budget = 0;
    }
    if (w.moving) w.walk += dt * 12;
    return w.path.length === 0;
  }

  private updateCustomers(dt: number) {
    const waiting = this.customers.filter((c) => !c.leaving);
    this.spawnT -= dt;
    const crowd = this.lvl('crowd');
    if (this.spawnT <= 0 && waiting.length < MAX_QUEUE + crowd) {
      this.spawnT = (2.5 + Math.random() * 3) / (1 + crowd + this.lvl('market'));
      const coats = ['#3f8fa6', '#2f7d6d', '#5a6fb8', '#b85a6f', '#8a6bb8', '#d0813a'];
      const skins = ['#f5cfa7', '#e2a77f', '#b57a52', '#8a5636'];
      const coat = coats[Math.floor(Math.random() * coats.length)];
      this.customers.push({
        x: SPAWN.x,
        y: SPAWN.y,
        want: 1 + Math.floor(Math.random() * 4),
        got: 0,
        incoming: 0,
        leaving: false,
        fade: 0,
        takeT: 0,
        walk: Math.random() * 6,
        face: -1,
        moving: true,
        hood: coat,
        coat,
        skin: skins[Math.floor(Math.random() * skins.length)],
        happy: 0,
        rich: Math.random() < 0.15,
      });
    }

    let slot = 0;
    for (const c of this.customers) {
      const target = c.leaving ? EXIT : queueSpot(slot);
      const isFront = !c.leaving && slot === 0;
      if (!c.leaving) slot++;
      const dx = target.x - c.x;
      const dy = target.y - c.y;
      const d = Math.hypot(dx, dy);
      const sp = 2.3 * dt;
      c.moving = d > 0.05;
      if (c.moving) {
        const k = Math.min(1, sp / d);
        c.x += dx * k;
        c.y += dy * k;
        c.walk += dt * 11;
        const sx = dx - dy;
        if (Math.abs(sx) > 0.02) c.face = sx > 0 ? 1 : -1;
      } else if (!c.leaving) {
        c.face = -1; // face the counter
      }
      c.happy = Math.max(0, c.happy - dt);

      if (c.leaving && d < 0.3) c.fade += dt * 3;

      if (isFront && d < 0.15) {
        if (c.got + c.incoming < c.want && this.pile > 0) {
          c.takeT += dt;
          if (c.takeT >= 0.35) {
            c.takeT = 0;
            this.pile--;
            c.incoming++;
            const from = pileSlot(this.pile);
            this.flyers.push({
              from,
              to: () => ({ x: c.x, y: c.y, z: 0.8 }),
              t: 0,
              dur: 0.3,
              delay: 0,
              arc: 0.8,
              spin: -1,
              onArrive: () => {
                c.incoming--;
                c.got++;
                this.sell(c);
                if (c.got >= c.want) {
                  c.leaving = true;
                  c.happy = 1.4;
                }
              },
            });
          }
        }
      }
    }
    this.customers = this.customers.filter((c) => c.fade < 1);
  }

  private sell(c: Customer) {
    const amount = this.price * (c.rich ? 2 : 1);
    this.texts.push({ x: c.x, y: c.y, z: 1.9, t: 0, text: `+${amount}` });
    const s = this.project(c.x, c.y, 1.6);
    this.coins.push({ x: s.x, y: s.y, t: 0, dur: 0.55, onArrive: () => this.earn(amount, true) });
  }

  // -------------------------------------------------------------------------
  // Golden trees and the wolf
  // -------------------------------------------------------------------------

  private updateGolden(dt: number) {
    if (this.trees.some((t) => t.golden)) return;
    this.goldenT -= dt;
    if (this.goldenT > 0) return;
    this.goldenT = 35 + Math.random() * 25;
    const options = this.trees.filter((t) => !t.stump && t.grow >= 1 && Math.max(Math.abs(t.x), Math.abs(t.y)) < 16);
    if (!options.length) return;
    const t = options[Math.floor(Math.random() * options.length)];
    t.golden = true;
    this.hooks.onToast('A golden tree appeared! ✨');
  }

  private goldTreeReward(t: Tree) {
    this.bump('golden');
    this.texts.push({ x: t.x, y: t.y, z: 2.6, t: 0, text: 'GOLD! +100' });
    this.shakeAmt = 0.45;
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: t.x, y: t.y, z: 1 + Math.random(),
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, vz: 2 + Math.random() * 4,
        life: 1.2, max: 1.2, color: i % 2 ? '#ffd23a' : '#fff3b0', size: 0.08, gravity: 8,
      });
    }
    const s = this.project(t.x, t.y, 1.5);
    for (let i = 0; i < 10; i++) {
      this.coins.push({
        x: s.x + (Math.random() - 0.5) * 70,
        y: s.y + (Math.random() - 0.5) * 40,
        t: -i * 0.05,
        dur: 0.7,
        onArrive: () => this.earn(10, false),
      });
    }
  }

  private updateWolf(dt: number) {
    const p = this.player;
    const outside = !inCamp(p.x, p.y);
    if (!this.wolf) {
      if (!outside) return;
      this.wolfT -= dt;
      if (this.wolfT > 0) return;
      // Appear somewhere in the woods, off to the side of the player.
      const a = Math.random() * Math.PI * 2;
      const x = Math.max(-WORLD, Math.min(WORLD, p.x + Math.cos(a) * 9));
      const y = Math.max(-WORLD, Math.min(WORLD, p.y + Math.sin(a) * 9));
      if (inCamp(x, y) || Math.max(Math.abs(x), Math.abs(y)) < CAMP + 1.5) return;
      this.wolf = { x, y, state: 'roam', t: 0, tx: x, ty: y, face: 1, walk: 0 };
      this.hooks.onToast('A wolf is in the woods! 🐺');
      sfx.howl();
      return;
    }
    const w = this.wolf;
    w.t += dt;
    const dx = p.x - w.x;
    const dy = p.y - w.y;
    const d = Math.hypot(dx, dy);
    let tx = w.tx;
    let ty = w.ty;
    let speed = 1.6;
    if (w.state === 'roam') {
      if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.3) {
        w.tx = w.x + (Math.random() - 0.5) * 6;
        w.ty = w.y + (Math.random() - 0.5) * 6;
      }
      if (outside && d < 7) {
        w.state = 'chase';
        w.t = 0;
        sfx.growl();
      }
      if (w.t > 40) {
        // Wander off for a while.
        this.wolf = null;
        this.wolfT = 30 + Math.random() * 30;
        return;
      }
    } else if (w.state === 'chase') {
      tx = p.x;
      ty = p.y;
      speed = 3.7;
      if (!outside || w.t > 7 || d > 12) {
        if (p.stack > 0 || !outside) this.bump('escapes');
        w.state = 'flee';
        w.t = 0;
      } else if (d < 0.55) {
        // Caught! Lose half the stack.
        const lost = Math.ceil(p.stack / 2);
        p.stack -= lost;
        for (let i = 0; i < lost; i++) {
          this.particles.push({
            x: p.x, y: p.y, z: 1 + i * 0.1,
            vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, vz: 3 + Math.random() * 2,
            life: 0.8, max: 0.8, color: BARK, size: 0.12, gravity: 10,
          });
        }
        this.texts.push({ x: p.x, y: p.y, z: 2.2, t: 0, text: lost ? `-${lost} logs!` : 'Chomp!' });
        this.shakeAmt = 0.5;
        sfx.growl();
        // Knock the player back.
        p.x += (dx / (d || 1)) * 1.2;
        p.y += (dy / (d || 1)) * 1.2;
        this.collide(p);
        w.state = 'flee';
        w.t = 0;
      }
    } else {
      tx = w.x - dx;
      ty = w.y - dy;
      speed = 3;
      if (w.t > 3) {
        if (d > 10 || w.t > 6) {
          this.wolf = null;
          this.wolfT = 35 + Math.random() * 35;
          return;
        }
      }
    }
    const mx = tx - w.x;
    const my = ty - w.y;
    const md = Math.hypot(mx, my);
    if (md > 0.01) {
      const k = Math.min(md, speed * dt) / md;
      w.x += mx * k;
      w.y += my * k;
      // The wolf never enters the camp.
      if (inCamp(w.x, w.y)) {
        const ox = Math.abs(w.x) > Math.abs(w.y);
        if (ox) w.x = Math.sign(w.x || 1) * CAMP;
        else w.y = Math.sign(w.y || 1) * CAMP;
      }
      w.x = Math.max(-WORLD, Math.min(WORLD, w.x));
      w.y = Math.max(-WORLD, Math.min(WORLD, w.y));
      const sx = mx - my;
      if (Math.abs(sx) > 0.02) w.face = sx > 0 ? 1 : -1;
      w.walk += dt * speed * 4;
    }
  }

  private drawWolf(w: Wolf) {
    const g = this.g;
    const u = this.S;
    const b = this.project(w.x, w.y, 0);
    this.ellipse(b.x, b.y, u * 0.45, u * 0.2, 'rgba(40,60,90,0.22)');
    const bob = Math.abs(Math.sin(w.walk)) * u * 0.04;
    g.save();
    g.translate(b.x, b.y - bob);
    g.scale(w.face * 1.4, 1.4);
    // Legs.
    const sw = Math.sin(w.walk) * u * 0.07;
    for (const [lx, o] of [[-0.25, sw], [-0.12, -sw], [0.15, -sw], [0.28, sw]] as const) {
      this.roundRect(lx * u + o - u * 0.04, -u * 0.28, u * 0.08, u * 0.28, u * 0.03, '#5e6676');
    }
    // Tail.
    g.beginPath();
    g.moveTo(-u * 0.32, -u * 0.42);
    g.quadraticCurveTo(-u * 0.6, -u * 0.5 + Math.sin(w.walk) * u * 0.05, -u * 0.62, -u * 0.25);
    g.lineWidth = u * 0.1;
    g.lineCap = 'round';
    g.strokeStyle = '#7d8696';
    g.stroke();
    // Body.
    this.ellipse(0, -u * 0.4, u * 0.42, u * 0.2, '#8a93a3');
    this.ellipse(u * 0.05, -u * 0.34, u * 0.3, u * 0.1, '#c3c9d3');
    // Head.
    this.ellipse(u * 0.38, -u * 0.55, u * 0.17, u * 0.15, '#8a93a3');
    this.ellipse(u * 0.53, -u * 0.5, u * 0.1, u * 0.07, '#9aa2b0');
    this.ellipse(u * 0.62, -u * 0.52, u * 0.03, u * 0.03, '#2b2f3a');
    // Ears.
    for (const ex of [0.3, 0.42]) {
      g.beginPath();
      g.moveTo(ex * u - u * 0.05, -u * 0.64);
      g.lineTo(ex * u, -u * 0.8);
      g.lineTo(ex * u + u * 0.05, -u * 0.64);
      g.closePath();
      g.fillStyle = '#6f7787';
      g.fill();
    }
    // Eye.
    this.ellipse(u * 0.44, -u * 0.58, u * 0.03, u * 0.03, w.state === 'chase' ? '#ff3b2f' : '#fff6c8');
    g.restore();
    if (w.state === 'chase') {
      const s = this.project(w.x, w.y, 1.6);
      this.label(s.x, s.y, '!', '#e0452f');
    }
  }

  private updateTrees(dt: number) {
    const p = this.player;
    for (const t of this.trees) {
      if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
      if (t.stump) {
        t.regrow -= dt;
        if (t.regrow <= 0 && Math.hypot(p.x - t.x, p.y - t.y) > 1) {
          t.stump = false;
          t.hp = HITS_PER_TREE;
          t.grow = 0;
        }
      } else if (t.grow < 1) {
        t.grow = Math.min(1, t.grow + dt * 0.8);
      }
    }
  }

  private updateEffects(dt: number) {
    for (const f of this.flyers) {
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.t += dt / f.dur;
      if (f.t >= 1) f.onArrive();
    }
    this.flyers = this.flyers.filter((f) => f.t < 1);

    for (const c of this.coins) {
      c.t += dt / c.dur;
      if (c.t >= 1) c.onArrive();
    }
    this.coins = this.coins.filter((c) => c.t < 1);

    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.vz -= q.gravity * dt;
      if (q.z < 0) {
        q.z = 0;
        q.vx *= 0.5;
        q.vy *= 0.5;
        q.vz = 0;
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);

    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 1);

    for (const f of this.footprints) f.age += dt;
    this.footprints = this.footprints.filter((f) => f.age < 9);

    // Embers from the campfire.
    if (Math.random() < dt * 6) {
      this.particles.push({
        x: CAMPFIRE.x + (Math.random() - 0.5) * 0.3,
        y: CAMPFIRE.y + (Math.random() - 0.5) * 0.3,
        z: 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: 1 + Math.random(),
        life: 1.1,
        max: 1.1,
        color: '#ffb340',
        size: 0.05,
        gravity: -0.3,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Rendering helpers
  // -------------------------------------------------------------------------

  private project(x: number, y: number, z: number) {
    const S = this.S;
    return {
      x: (x - y - (this.camX - this.camY)) * ISO_X * S + this.w / 2,
      y: (x + y - (this.camX + this.camY)) * ISO_Y * S - z * S + this.h * 0.56,
    };
  }

  private onScreen(x: number, y: number, margin = 3) {
    const s = this.project(x, y, 0);
    const m = margin * this.S;
    return s.x > -m && s.x < this.w + m && s.y > -m && s.y < this.h + m * 1.5;
  }

  private poly(pts: { x: number; y: number }[], fill: string) {
    const g = this.g;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  private box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, top: string, left: string, right: string) {
    const P = (x: number, y: number, z: number) => this.project(x, y, z);
    this.poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], left);
    this.poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], right);
    this.poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number, fill: string) {
    const g = this.g;
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  }

  private shadow(x: number, y: number, r: number, alpha = 0.18) {
    const s = this.project(x, y, 0);
    this.ellipse(s.x, s.y, r * 1.22 * this.S, r * 0.71 * this.S, `rgba(40,60,90,${alpha})`);
  }

  /** Vertical cylinder; rings on top for cut logs. */
  private cylinder(x: number, y: number, z: number, r: number, h: number, side: string, sideDark: string, top: string, ring?: string) {
    const g = this.g;
    const b = this.project(x, y, z);
    const t = this.project(x, y, z + h);
    const rx = r * 1.22 * this.S;
    const ry = r * 0.71 * this.S;
    g.beginPath();
    g.moveTo(t.x - rx, t.y);
    g.lineTo(b.x - rx, b.y);
    g.ellipse(b.x, b.y, rx, ry, 0, Math.PI, 0, true);
    g.lineTo(t.x + rx, t.y);
    g.closePath();
    g.fillStyle = side;
    g.fill();
    g.beginPath();
    g.moveTo(t.x + rx * 0.25, t.y);
    g.lineTo(b.x + rx * 0.25, b.y + ry * 0.97);
    g.ellipse(b.x, b.y, rx, ry, 0, Math.PI * 0.42, 0, true);
    g.lineTo(t.x + rx, t.y);
    g.closePath();
    g.fillStyle = sideDark;
    g.fill();
    this.ellipse(t.x, t.y, rx, ry, top);
    if (ring) {
      g.beginPath();
      g.ellipse(t.x, t.y, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      g.strokeStyle = ring;
      g.lineWidth = Math.max(1, this.S * 0.025);
      g.stroke();
    }
  }

  /** A log lying in the world along x or y. */
  private logWorld(x: number, y: number, z: number, axis: 'x' | 'y', len = 0.76) {
    const g = this.g;
    const hl = len / 2;
    const a = axis === 'x' ? this.project(x - hl, y, z) : this.project(x, y - hl, z);
    const b = axis === 'x' ? this.project(x + hl, y, z) : this.project(x, y + hl, z);
    const th = 0.21 * this.S;
    g.lineCap = 'round';
    g.strokeStyle = BARK_DARK;
    g.lineWidth = th;
    g.beginPath();
    g.moveTo(a.x, a.y + th * 0.12);
    g.lineTo(b.x, b.y + th * 0.12);
    g.stroke();
    g.strokeStyle = BARK;
    g.lineWidth = th * 0.8;
    g.beginPath();
    g.moveTo(a.x, a.y - th * 0.04);
    g.lineTo(b.x, b.y - th * 0.04);
    g.stroke();
    this.logEnd(b.x, b.y, th * 0.5);
  }

  private logEnd(x: number, y: number, r: number) {
    this.ellipse(x, y, r * 0.85, r, WOOD);
    const g = this.g;
    g.beginPath();
    g.ellipse(x, y, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
    g.strokeStyle = RING;
    g.lineWidth = Math.max(1, r * 0.18);
    g.stroke();
  }

  /** A log drawn flat in screen space (on the player's back, in flight). */
  private logScreen(x: number, y: number, len: number, th: number, rot = 0) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.lineCap = 'round';
    g.strokeStyle = BARK_DARK;
    g.lineWidth = th;
    g.beginPath();
    g.moveTo(-len / 2, th * 0.08);
    g.lineTo(len / 2, th * 0.08);
    g.stroke();
    g.strokeStyle = BARK;
    g.lineWidth = th * 0.78;
    g.beginPath();
    g.moveTo(-len / 2, -th * 0.06);
    g.lineTo(len / 2, -th * 0.06);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = th * 0.16;
    g.beginPath();
    g.moveTo(-len / 2 + th * 0.2, -th * 0.25);
    g.lineTo(len / 2 - th * 0.4, -th * 0.25);
    g.stroke();
    this.logEnd(len / 2, 0, th * 0.5);
    g.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number, fill: string) {
    const g = this.g;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fillStyle = fill;
    g.fill();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  render() {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#e6eef6';
    g.fillRect(0, 0, this.w, this.h);

    if (this.shakeAmt > 0) {
      const m = this.shakeAmt * 14;
      g.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    this.drawGround();

    const items: { key: number; draw: () => void }[] = [];
    for (const t of this.trees) {
      if (!this.onScreen(t.x, t.y)) continue;
      items.push({ key: t.x + t.y, draw: () => this.drawTree(t) });
    }
    for (const p of this.posts) {
      if (!this.onScreen(p.x, p.y)) continue;
      items.push({ key: p.x + p.y, draw: () => this.drawPost(p) });
    }
    for (let i = 0; i < 3; i++) {
      const y0 = COUNTER.y0 + i;
      items.push({ key: (COUNTER.x0 + COUNTER.x1) / 2 + y0 + 0.5, draw: () => this.drawCounterSegment(y0, y0 + 1) });
    }
    items.push({ key: (COUNTER.x0 + COUNTER.x1) / 2 + COUNTER.y1 + 0.6, draw: () => this.drawPile() });
    for (const t of TENTS) items.push({ key: (t.x0 + t.x1 + t.y0 + t.y1) / 2, draw: () => this.drawTent(t) });
    items.push({ key: CAMPFIRE.x + CAMPFIRE.y, draw: () => this.drawCampfire() });
    for (const it of this.beltItems) {
      const b = beltPoint(it.d);
      items.push({ key: b.x + b.y, draw: () => this.logWorld(b.x, b.y, 0.26, b.axis === 'x' ? 'y' : 'x', 0.42) });
    }
    for (const c of this.customers) items.push({ key: c.x + c.y + 0.01, draw: () => this.drawCustomer(c) });
    const p = this.player;
    items.push({ key: p.x + p.y + 0.02, draw: () => this.drawPlayer() });
    // A woodcutter waits by the hire pad until every slot is filled.
    const hire = this.upgrade('worker');
    if (hire.prices[hire.level] !== undefined) {
      items.push({ key: HIRE_SPOT.x + HIRE_SPOT.y, draw: () => this.drawCandidate() });
    }
    const wolf = this.wolf;
    if (wolf && this.onScreen(wolf.x, wolf.y)) items.push({ key: wolf.x + wolf.y, draw: () => this.drawWolf(wolf) });
    for (const w of this.workers) {
      if (this.onScreen(w.x, w.y)) items.push({ key: w.x + w.y + 0.015, draw: () => this.drawWorker(w) });
    }
    for (const q of this.particles) items.push({ key: q.x + q.y + 0.05, draw: () => this.drawParticle(q) });
    items.sort((a, b) => a.key - b.key);
    for (const it of items) it.draw();

    this.drawFlyers();
    this.drawOverlays();
    this.drawSnowfall();
    this.drawStick();
    this.drawCoins();
  }

  private drawGround() {
    const g = this.g;
    // Snow patches give the white ground some texture.
    for (const s of this.patches) {
      if (!this.onScreen(s.x, s.y, 4)) continue;
      const c = this.project(s.x, s.y, 0);
      this.ellipse(c.x, c.y, s.r * 1.22 * this.S, s.r * 0.71 * this.S, s.tone < 0.6 ? 'rgba(200,216,232,0.45)' : 'rgba(255,255,255,0.8)');
    }
    // Camp dirt.
    const P = (x: number, y: number) => this.project(x, y, 0);
    const e = CAMP - 0.05;
    this.poly([P(-e, -e), P(e, -e), P(e, e), P(-e, e)], '#b98b62');
    const i = CAMP - 0.6;
    this.poly([P(-i, -i), P(i, -i), P(i, i), P(-i, i)], '#c39570');
    // Paths out of the gates.
    this.poly([P(-GATE, -CAMP - 0.1), P(GATE, -CAMP - 0.1), P(GATE * 0.7, -CAMP - 2.5), P(-GATE * 0.7, -CAMP - 2.5)], 'rgba(185,139,98,0.55)');
    this.poly([P(-CAMP - 0.1, -GATE), P(-CAMP - 0.1, GATE), P(-CAMP - 2.5, GATE * 0.7), P(-CAMP - 2.5, -GATE * 0.7)], 'rgba(185,139,98,0.55)');

    // Campfire glow.
    const cf = P(CAMPFIRE.x, CAMPFIRE.y);
    const flick = 1 + Math.sin(this.time * 9) * 0.04 + Math.sin(this.time * 23) * 0.03;
    const gr = g.createRadialGradient(cf.x, cf.y, 0, cf.x, cf.y, this.S * 2.6 * flick);
    gr.addColorStop(0, 'rgba(255,170,70,0.45)');
    gr.addColorStop(1, 'rgba(255,170,70,0)');
    g.save();
    g.translate(cf.x, cf.y);
    g.scale(1, 0.58);
    g.translate(-cf.x, -cf.y);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cf.x, cf.y, this.S * 2.6 * flick, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Drop zone: dashed square with a log icon.
    this.dropZone(DROP);

    this.drawBelt();
    for (const u of this.upgrades) if (!u.menuOnly && this.available(u)) this.drawPad(u);

    // Footprints.
    for (const f of this.footprints) {
      if (!this.onScreen(f.x, f.y)) continue;
      const c = P(f.x, f.y);
      const a = Math.min(1, (9 - f.age) / 3) * 0.35;
      this.ellipse(c.x, c.y, this.S * 0.09, this.S * 0.055, `rgba(120,150,185,${a})`);
    }
  }

  private zoneOutline(r: { x0: number; y0: number; x1: number; y1: number }, fill: string, stroke = '#ffffff') {
    const g = this.g;
    const P = (x: number, y: number) => this.project(x, y, 0);
    const m = 0.08;
    const corners = [P(r.x0 + m, r.y0 + m), P(r.x1 - m, r.y0 + m), P(r.x1 - m, r.y1 - m), P(r.x0 + m, r.y1 - m)];
    g.beginPath();
    g.moveTo(corners[0].x, corners[0].y);
    for (const c of corners.slice(1)) g.lineTo(c.x, c.y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.setLineDash([this.S * 0.28, this.S * 0.18]);
    g.lineWidth = this.S * 0.09;
    g.strokeStyle = stroke;
    g.lineJoin = 'round';
    g.stroke();
    g.setLineDash([]);
  }

  private dropZone(r: { x0: number; y0: number; x1: number; y1: number }) {
    const g = this.g;
    const pulse = this.player.stack > 0 ? 0.5 + 0.5 * Math.sin(this.time * 6) : 0;
    this.zoneOutline(r, `rgba(255,255,255,${0.1 + pulse * 0.15})`);
    const dc = this.project((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0);
    g.globalAlpha = 0.85;
    this.logScreen(dc.x - this.S * 0.05, dc.y - this.S * 0.12, this.S * 0.7, this.S * 0.22, 0);
    this.logScreen(dc.x + this.S * 0.05, dc.y + this.S * 0.14, this.S * 0.7, this.S * 0.22, 0);
    g.globalAlpha = 1;
  }

  private drawBelt() {
    const built = this.hasBelt;
    if (!built && !this.onScreen(BELT_PATH[1].x, BELT_PATH[1].y, 6)) return;
    const g = this.g;
    if (!built) g.globalAlpha = 0.28;
    const hw = BELT_W / 2;
    for (let i = 0; i < BELT_PATH.length - 1; i++) {
      const a = BELT_PATH[i];
      const b = BELT_PATH[i + 1];
      const x0 = Math.min(a.x, b.x) - hw;
      const x1 = Math.max(a.x, b.x) + hw;
      const y0 = Math.min(a.y, b.y) - hw;
      const y1 = Math.max(a.y, b.y) + hw;
      this.box(x0, y0, 0, x1, y1, 0.18, '#4a4f5e', '#6b7385', '#565d6e');
    }
    // Moving stripes along the belt.
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = Math.max(1, this.S * 0.05);
    const len = beltLength();
    const offset = built ? (this.time * this.beltSpeed) % 0.5 : 0;
    for (let d = offset; d < len; d += 0.5) {
      const p = beltPoint(d);
      const nx = p.axis === 'x' ? 0 : 1;
      const ny = p.axis === 'x' ? 1 : 0;
      const s0 = this.project(p.x - nx * hw * 0.8, p.y - ny * hw * 0.8, 0.18);
      const s1 = this.project(p.x + nx * hw * 0.8, p.y + ny * hw * 0.8, 0.18);
      g.beginPath();
      g.moveTo(s0.x, s0.y);
      g.lineTo(s1.x, s1.y);
      g.stroke();
    }
    g.globalAlpha = 1;
    if (built) this.dropZone(BELT_DROP);
  }

  private drawPad(u: Upgrade) {
    const price = u.prices[u.level];
    if (price === undefined) return;
    if (!this.onScreen((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2)) return;
    const g = this.g;
    this.zoneOutline(u, 'rgba(255,210,58,0.16)', '#ffd23a');
    // Progress fill.
    const f = u.paid / price;
    if (f > 0) {
      const P = (x: number, y: number) => this.project(x, y, 0);
      const m = 0.14;
      const xe = lerp(u.x0 + m, u.x1 - m, f);
      this.poly([P(u.x0 + m, u.y0 + m), P(xe, u.y0 + m), P(xe, u.y1 - m), P(u.x0 + m, u.y1 - m)], 'rgba(255,210,58,0.45)');
    }
    const c = this.project((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, 0);
    const s = this.S;
    g.save();
    g.translate(c.x, c.y);
    const kind = u.after ?? u.id;
    if (kind === 'axe') {
      g.rotate(-0.5);
      g.fillStyle = '#7b4a24';
      g.fillRect(-s * 0.04, -s * 0.35, s * 0.08, s * 0.7);
      g.beginPath();
      g.moveTo(s * 0.04, -s * 0.35);
      g.lineTo(s * 0.3, -s * 0.42);
      g.lineTo(s * 0.3, -s * 0.08);
      g.lineTo(s * 0.04, -s * 0.16);
      g.closePath();
      g.fillStyle = '#c7ced8';
      g.fill();
    } else if (kind === 'worker') {
      this.ellipse(0, s * 0.02, s * 0.2, s * 0.2, '#eebd94');
      g.beginPath();
      g.ellipse(0, -s * 0.03, s * 0.21, s * 0.19, 0, Math.PI, 0);
      g.fillStyle = '#e8862a';
      g.fill();
      this.ellipse(0, -s * 0.25, s * 0.07, s * 0.07, '#f4f1ea');
      this.ellipse(-s * 0.07, s * 0.04, s * 0.025, s * 0.035, '#2b2f3a');
      this.ellipse(s * 0.07, s * 0.04, s * 0.025, s * 0.035, '#2b2f3a');
    } else if (kind === 'bag') {
      this.roundRect(-s * 0.26, -s * 0.28, s * 0.52, s * 0.56, s * 0.14, '#8a5a2b');
      this.roundRect(-s * 0.18, -s * 0.05, s * 0.36, s * 0.22, s * 0.06, '#6f4520');
      g.beginPath();
      g.arc(0, -s * 0.28, s * 0.13, Math.PI, 0);
      g.strokeStyle = '#6f4520';
      g.lineWidth = s * 0.06;
      g.stroke();
    } else {
      this.logScreen(0, 0, s * 0.55, s * 0.2, 0);
    }
    g.restore();
  }

  private drawTree(t: Tree) {
    const g = this.g;
    if (t.stump) {
      this.shadow(t.x, t.y, 0.3, 0.14);
      this.cylinder(t.x, t.y, 0, 0.22, 0.22, BARK, BARK_DARK, WOOD, RING);
      return;
    }
    const k = t.size * easeOut(t.grow);
    this.shadow(t.x + 0.25, t.y + 0.25, 0.75 * k, 0.16);
    const shake = t.shake > 0 ? Math.sin(t.shake * 60) * t.shake * this.S * 0.25 : 0;
    g.save();
    g.translate(shake, 0);
    // See-through when the tree stands in front of the player.
    const p = this.player;
    const ahead = t.x + t.y - (p.x + p.y);
    if (ahead > 0 && ahead < 4.5 && Math.abs(t.x - t.y - (p.x - p.y)) < 2.2) g.globalAlpha = 0.45;
    this.cylinder(t.x, t.y, 0, 0.13 * k, 0.55 * k, '#8a5530', '#6c3f20', '#a8703f');
    const tiers = [
      { z: 0.4, r: 0.85, h: 1.0 },
      { z: 0.95, r: 0.66, h: 0.9 },
      { z: 1.45, r: 0.46, h: 0.8 },
    ];
    for (const tier of tiers) {
      const base = this.project(t.x, t.y, tier.z * k);
      const apex = this.project(t.x, t.y, (tier.z + tier.h) * k);
      const rx = tier.r * k * 1.22 * this.S;
      const ry = tier.r * k * 0.71 * this.S;
      // Dark body.
      g.beginPath();
      g.moveTo(apex.x, apex.y);
      g.lineTo(base.x + rx, base.y);
      g.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI, false);
      g.closePath();
      g.fillStyle = t.golden ? '#d79b12' : '#1f7a4c';
      g.fill();
      // Lit left half.
      g.beginPath();
      g.moveTo(apex.x, apex.y);
      g.lineTo(base.x - rx, base.y);
      g.ellipse(base.x, base.y, rx, ry, 0, Math.PI, Math.PI * 0.55, true);
      g.closePath();
      g.fillStyle = t.golden ? '#f6c63b' : '#2f9a5f';
      g.fill();
      // Snow cap.
      const f = 0.42;
      const lx = lerp(apex.x, base.x - rx, f);
      const ly = lerp(apex.y, base.y, f);
      const rxx = lerp(apex.x, base.x + rx, f);
      const ryy = lerp(apex.y, base.y, f);
      g.beginPath();
      g.moveTo(apex.x, apex.y);
      g.lineTo(lx, ly);
      const n = 4;
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        const px = lerp(lx, rxx, u);
        const py = lerp(ly, ryy, u) + (i % 2 ? ry * 0.35 : -ry * 0.05);
        g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = '#f7fbff';
      g.fill();
    }
    g.restore();
    if (t.golden) {
      for (let k2 = 0; k2 < 4; k2++) {
        const ph = this.time * 2 + k2 * 1.7;
        const sp = this.project(t.x + Math.cos(ph) * 0.6, t.y + Math.sin(ph) * 0.6, 0.8 + ((ph * 0.4) % 1.6));
        const r = this.S * 0.07 * (0.6 + 0.4 * Math.sin(ph * 3));
        g.fillStyle = '#fff6c8';
        g.beginPath();
        g.moveTo(sp.x, sp.y - r * 2);
        g.lineTo(sp.x + r * 0.5, sp.y - r * 0.5);
        g.lineTo(sp.x + r * 2, sp.y);
        g.lineTo(sp.x + r * 0.5, sp.y + r * 0.5);
        g.lineTo(sp.x, sp.y + r * 2);
        g.lineTo(sp.x - r * 0.5, sp.y + r * 0.5);
        g.lineTo(sp.x - r * 2, sp.y);
        g.lineTo(sp.x - r * 0.5, sp.y - r * 0.5);
        g.closePath();
        g.fill();
      }
    }
  }

  private drawPost(p: Post) {
    this.cylinder(p.x, p.y, 0, 0.2, p.h, '#b9773d', '#94592a', WOOD, RING);
    // Snow on top.
    const t = this.project(p.x, p.y, p.h);
    this.ellipse(t.x - this.S * 0.04, t.y - this.S * 0.03, this.S * 0.13, this.S * 0.06, 'rgba(255,255,255,0.9)');
  }

  private drawCounterSegment(y0: number, y1: number) {
    const c = COUNTER;
    const legs: [number, number][] = [
      [c.x0 + 0.08, c.y0 + 0.08],
      [c.x1 - 0.2, c.y0 + 0.08],
      [c.x0 + 0.08, c.y1 - 0.2],
      [c.x1 - 0.2, c.y1 - 0.2],
    ];
    if (y0 === c.y0) this.shadow((c.x0 + c.x1) / 2 + 0.2, (c.y0 + c.y1) / 2 + 0.2, 1.2, 0.12);
    for (const [lx, ly] of legs) {
      if (ly < y0 || ly >= y1) continue;
      this.box(lx, ly, 0, lx + 0.12, ly + 0.12, c.top - 0.15, '#8a5530', '#7a4826', '#5f3619');
    }
    this.box(c.x0, y0, c.top - 0.15, c.x1, y1, c.top, '#c98a4f', '#a46a35', '#8a5428');
    // Plank lines.
    const g = this.g;
    g.strokeStyle = 'rgba(110,60,25,0.35)';
    g.lineWidth = Math.max(1, this.S * 0.025);
    for (let i = 1; i < 3; i++) {
      const x = c.x0 + (i * (c.x1 - c.x0)) / 3;
      const a = this.project(x, y0, c.top);
      const b = this.project(x, y1, c.top);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
  }

  private drawPile() {
    const shown = Math.min(this.pile, 45);
    for (let i = 0; i < shown; i++) {
      const s = pileSlot(i);
      this.logWorld(s.x, s.y, s.z, 'y');
    }
    if (this.pile > 0) {
      const top = pileSlot(Math.max(0, shown - 1));
      const s = this.project((COUNTER.x0 + COUNTER.x1) / 2, (COUNTER.y0 + COUNTER.y1) / 2, top.z + 0.55);
      this.label(s.x, s.y, String(this.pile), 'rgba(43,47,58,0.75)');
    }
  }

  private drawTent(t: (typeof TENTS)[number]) {
    const P = (x: number, y: number, z: number) => this.project(x, y, z);
    const cx = (t.x0 + t.x1) / 2;
    const cy = (t.y0 + t.y1) / 2;
    const apex = P(cx, cy, t.h);
    this.shadow(cx + 0.3, cy + 0.3, 1.4, 0.14);
    this.poly([P(t.x0, t.y0, 0), P(t.x1, t.y0, 0), apex], t.back);
    this.poly([P(t.x0, t.y1, 0), P(t.x0, t.y0, 0), apex], t.back);
    this.poly([P(t.x1, t.y0, 0), P(t.x1, t.y1, 0), apex], t.dark);
    this.poly([P(t.x0, t.y1, 0), P(t.x1, t.y1, 0), apex], t.cloth);
    // Door on the front face.
    const dz = t.h * 0.55;
    const f = dz / t.h;
    this.poly([P(cx - 0.32, t.y1, 0), P(cx + 0.32, t.y1, 0), P(cx, lerp(t.y1, cy, f), dz)], 'rgba(40,30,30,0.75)');
    // Snow on the peak.
    this.ellipse(apex.x, apex.y + this.S * 0.08, this.S * 0.2, this.S * 0.1, '#ffffff');
  }

  private drawCampfire() {
    const g = this.g;
    const { x, y } = CAMPFIRE;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = this.project(x + Math.cos(a) * 0.55, y + Math.sin(a) * 0.55, 0);
      this.ellipse(s.x, s.y - this.S * 0.06, this.S * 0.16, this.S * 0.11, i % 2 ? '#8b93a3' : '#a3abba');
    }
    this.logWorld(x, y, 0.1, 'x', 0.8);
    this.logWorld(x, y, 0.18, 'y', 0.8);
    const base = this.project(x, y, 0.25);
    const flames = [
      { dx: 0, s: 1, c: '#ff7a1a', ph: 0 },
      { dx: -0.12, s: 0.7, c: '#ffb020', ph: 1.7 },
      { dx: 0.12, s: 0.75, c: '#ffb020', ph: 3.1 },
      { dx: 0, s: 0.5, c: '#fff1a0', ph: 4.2 },
    ];
    for (const f of flames) {
      const hgt = this.S * 0.8 * f.s * (1 + Math.sin(this.time * 12 + f.ph) * 0.12);
      const wid = this.S * 0.28 * f.s;
      const fx = base.x + f.dx * this.S;
      g.beginPath();
      g.moveTo(fx, base.y - hgt);
      g.quadraticCurveTo(fx + wid * 1.3, base.y - hgt * 0.35, fx, base.y);
      g.quadraticCurveTo(fx - wid * 1.3, base.y - hgt * 0.35, fx, base.y - hgt);
      g.fillStyle = f.c;
      g.fill();
    }
  }

  private drawParticle(q: Particle) {
    const s = this.project(q.x, q.y, q.z);
    const a = Math.max(0, q.life / q.max);
    this.g.globalAlpha = a;
    const r = q.size * this.S;
    this.g.fillStyle = q.color;
    this.g.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    this.g.globalAlpha = 1;
  }

  private drawPerson(
    x: number,
    y: number,
    o: { face: number; walk: number; moving: boolean; coat: string; coatDark: string; skin: string; hat: 'beanie' | 'hood'; hatColor: string; alpha?: number; happy?: boolean },
    behind?: (bx: number, by: number) => void,
    front?: (bx: number, by: number) => void,
  ) {
    const g = this.g;
    const u = this.S;
    const b = this.project(x, y, 0);
    g.save();
    if (o.alpha !== undefined) g.globalAlpha = o.alpha;
    this.ellipse(b.x, b.y, u * 0.34, u * 0.18, 'rgba(40,60,90,0.22)');
    const bob = o.moving ? Math.abs(Math.sin(o.walk)) * u * 0.05 : 0;
    const by = b.y - bob;
    if (behind) behind(b.x, by);
    // Legs.
    const swing = o.moving ? Math.sin(o.walk) * u * 0.08 : 0;
    this.roundRect(b.x - u * 0.17 + swing, b.y - u * 0.3, u * 0.14, u * 0.3, u * 0.05, '#3b3f52');
    this.roundRect(b.x + u * 0.03 - swing, b.y - u * 0.3, u * 0.14, u * 0.3, u * 0.05, '#2f3344');
    // Body.
    this.roundRect(b.x - u * 0.27, by - u * 0.78, u * 0.54, u * 0.56, u * 0.16, o.coat);
    g.save();
    g.beginPath();
    g.roundRect(b.x - u * 0.27, by - u * 0.78, u * 0.54, u * 0.56, u * 0.16);
    g.clip();
    g.fillStyle = o.coatDark;
    g.fillRect(b.x + o.face * u * 0.08 - (o.face > 0 ? 0 : u * 0.3), by - u * 0.78, u * 0.3, u * 0.6);
    g.restore();
    // Arm (swinging when walking).
    const armSwing = o.moving ? -Math.sin(o.walk) * u * 0.06 : 0;
    this.roundRect(b.x + o.face * u * 0.18 - u * 0.07 + armSwing, by - u * 0.68, u * 0.14, u * 0.36, u * 0.07, o.coatDark);
    // Head.
    const hx = b.x + o.face * u * 0.02;
    const hy = by - u * 0.98;
    if (o.hat === 'hood') {
      this.ellipse(hx, hy, u * 0.27, u * 0.27, o.hatColor);
      this.ellipse(hx + o.face * u * 0.07, hy + u * 0.02, u * 0.16, u * 0.17, o.skin);
      this.ellipse(hx, hy - u * 0.02, u * 0.27, u * 0.27, 'rgba(0,0,0,0)');
      // Fur trim.
      g.beginPath();
      g.ellipse(hx + o.face * u * 0.07, hy + u * 0.02, u * 0.18, u * 0.19, 0, 0, Math.PI * 2);
      g.strokeStyle = '#f1ede4';
      g.lineWidth = u * 0.05;
      g.stroke();
    } else {
      this.ellipse(hx, hy, u * 0.22, u * 0.22, o.skin);
      // Beard.
      g.beginPath();
      g.ellipse(hx + o.face * u * 0.06, hy + u * 0.09, u * 0.15, u * 0.12, 0, 0, Math.PI);
      g.fillStyle = '#7a3e1d';
      g.fill();
      // Beanie with pompom.
      g.beginPath();
      g.ellipse(hx, hy - u * 0.05, u * 0.23, u * 0.2, 0, Math.PI, 0);
      g.fillStyle = o.hatColor;
      g.fill();
      this.roundRect(hx - u * 0.24, hy - u * 0.08, u * 0.48, u * 0.08, u * 0.04, '#f4f1ea');
      this.ellipse(hx, hy - u * 0.27, u * 0.08, u * 0.08, '#f4f1ea');
    }
    // Eyes.
    const ex = hx + o.face * u * 0.09;
    if (o.happy) {
      g.strokeStyle = '#2b2f3a';
      g.lineWidth = u * 0.03;
      for (const dx of [-0.05, 0.05]) {
        g.beginPath();
        g.arc(ex + dx * u, hy, u * 0.025, Math.PI, 0);
        g.stroke();
      }
    } else {
      this.ellipse(ex - u * 0.05, hy, u * 0.025, u * 0.035, '#2b2f3a');
      this.ellipse(ex + u * 0.05, hy, u * 0.025, u * 0.035, '#2b2f3a');
    }
    if (front) front(b.x, by);
    g.restore();
  }

  private drawPlayer() {
    const p = this.player;
    const u = this.S;
    this.drawPerson(
      p.x,
      p.y,
      { face: p.face, walk: p.walk, moving: p.moving, coat: '#d8452f', coatDark: '#a92f1f', skin: '#f5cfa7', hat: 'beanie', hatColor: '#2f6db5' },
      (bx, by) => {
        // Wood stack on the back.
        const sx = bx - p.face * u * 0.22;
        for (let i = 0; i < p.stack; i++) {
          this.logScreen(sx, by - u * 0.55 - i * u * 0.17, u * 0.72, u * 0.21, 0);
        }
      },
      (bx, by) => {
        // Axe.
        const g = this.g;
        const swing = p.chopping ? Math.sin((1 - p.swing) * Math.PI) : 0;
        const ang = p.chopping ? -1.2 + (1 - p.swing) * 2.0 : 0.5;
        if (!p.chopping && p.moving) return;
        g.save();
        g.translate(bx + p.face * u * 0.25, by - u * 0.5);
        g.scale(p.face, 1);
        g.rotate(ang + swing * 0.1);
        g.fillStyle = '#7b4a24';
        g.fillRect(-u * 0.03, -u * 0.5, u * 0.06, u * 0.55);
        g.beginPath();
        g.moveTo(u * 0.03, -u * 0.5);
        g.lineTo(u * 0.22, -u * 0.56);
        g.lineTo(u * 0.22, -u * 0.32);
        g.lineTo(u * 0.03, -u * 0.38);
        g.closePath();
        g.fillStyle = '#c7ced8';
        g.fill();
        g.restore();
      },
    );
    if (p.stack >= this.capacity) {
      const s = this.project(p.x, p.y, 0);
      const by = s.y - u * 0.75 - p.stack * u * 0.17;
      this.label(s.x - p.face * u * 0.22, by, 'MAX', '#e0452f');
    }
  }

  private drawAxe(bx: number, by: number, face: number, chopping: boolean, swing: number) {
    const g = this.g;
    const u = this.S;
    const ang = chopping ? -1.2 + (1 - swing) * 2.0 : 0.5;
    g.save();
    g.translate(bx + face * u * 0.25, by - u * 0.5);
    g.scale(face, 1);
    g.rotate(ang);
    g.fillStyle = '#7b4a24';
    g.fillRect(-u * 0.03, -u * 0.5, u * 0.06, u * 0.55);
    g.beginPath();
    g.moveTo(u * 0.03, -u * 0.5);
    g.lineTo(u * 0.22, -u * 0.56);
    g.lineTo(u * 0.22, -u * 0.32);
    g.lineTo(u * 0.03, -u * 0.38);
    g.closePath();
    g.fillStyle = '#c7ced8';
    g.fill();
    g.restore();
  }

  private drawCandidate() {
    const u = this.S;
    const look = WORKER_LOOKS[this.upgrade('worker').level % WORKER_LOOKS.length];
    const wave = Math.sin(this.time * 3);
    this.drawPerson(
      HIRE_SPOT.x,
      HIRE_SPOT.y,
      { face: -1, walk: 0, moving: false, coat: look.coat, coatDark: shade(look.coat, -0.22), skin: '#eebd94', hat: 'beanie', hatColor: look.hat },
    );
    const s = this.project(HIRE_SPOT.x, HIRE_SPOT.y, 1.6);
    this.label(s.x, s.y - Math.abs(wave) * u * 0.08, 'Hire me!', 'rgba(63,138,74,0.95)');
  }

  private drawWorker(w: Worker) {
    const u = this.S;
    this.drawPerson(
      w.x,
      w.y,
      { face: w.face, walk: w.walk, moving: w.moving, coat: w.coat, coatDark: shade(w.coat, -0.22), skin: '#eebd94', hat: 'beanie', hatColor: w.hat },
      (bx, by) => {
        const sx = bx - w.face * u * 0.22;
        for (let i = 0; i < w.stack; i++) this.logScreen(sx, by - u * 0.55 - i * u * 0.17, u * 0.72, u * 0.21, 0);
      },
      (bx, by) => {
        if (w.state === 'chop') this.drawAxe(bx, by, w.face, true, w.swing);
      },
    );
  }

  private drawCustomer(c: Customer) {
    this.drawPerson(c.x, c.y, {
      face: c.face,
      walk: c.walk,
      moving: c.moving,
      coat: c.coat,
      coatDark: shade(c.coat, -0.2),
      skin: c.skin,
      hat: 'hood',
      hatColor: c.hood,
      alpha: 1 - c.fade,
      happy: c.happy > 0,
    }, undefined, (bx, by) => {
      if (c.rich) {
        // Gold crown: this one pays double.
        const u = this.S;
        const hx = bx + c.face * u * 0.02;
        const hy = by - u * 1.22;
        const g = this.g;
        g.beginPath();
        g.moveTo(hx - u * 0.16, hy + u * 0.06);
        g.lineTo(hx - u * 0.16, hy - u * 0.08);
        g.lineTo(hx - u * 0.08, hy);
        g.lineTo(hx, hy - u * 0.12);
        g.lineTo(hx + u * 0.08, hy);
        g.lineTo(hx + u * 0.16, hy - u * 0.08);
        g.lineTo(hx + u * 0.16, hy + u * 0.06);
        g.closePath();
        g.fillStyle = '#ffd23a';
        g.fill();
        g.strokeStyle = '#a86f00';
        g.lineWidth = u * 0.025;
        g.stroke();
      }
      // Logs they've bought, held in front.
      for (let i = 0; i < c.got; i++) {
        this.logScreen(bx + c.face * this.S * 0.12, by - this.S * 0.42 - i * this.S * 0.12, this.S * 0.55, this.S * 0.16, 0);
      }
    });
  }

  private drawFlyers() {
    for (const f of this.flyers) {
      if (f.delay > 0) continue;
      const to = f.to();
      const t = easeInOut(Math.min(1, f.t));
      const x = lerp(f.from.x, to.x, t);
      const y = lerp(f.from.y, to.y, t);
      const z = lerp(f.from.z, to.z, t) + Math.sin(Math.PI * t) * f.arc;
      const s = this.project(x, y, z);
      this.logScreen(s.x, s.y, this.S * 0.66, this.S * 0.2, f.spin * (1 - t) * Math.PI * 1.5);
    }
  }

  private label(x: number, y: number, text: string, bg: string) {
    const g = this.g;
    const fs = Math.max(13, this.S * 0.36);
    g.font = `${fs}px 'Lilita One', system-ui, sans-serif`;
    const w = g.measureText(text).width + fs * 0.8;
    this.roundRect(x - w / 2, y - fs * 0.75, w, fs * 1.4, fs * 0.7, bg);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x, y - fs * 0.04);
  }

  private drawOverlays() {
    const g = this.g;
    const u = this.S;
    // Speech bubbles: how many logs each customer still wants.
    for (const c of this.customers) {
      if (c.leaving) {
        if (c.happy > 0) {
          const s = this.project(c.x, c.y, 1.9);
          g.globalAlpha = Math.min(1, c.happy);
          g.font = `${u * 0.5}px system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('😊', s.x, s.y - (1.4 - c.happy) * u * 0.4);
          g.globalAlpha = 1;
        }
        continue;
      }
      const left = c.want - c.got;
      const s = this.project(c.x, c.y, 1.75);
      const bw = u * 1.0;
      const bh = u * 0.56;
      g.save();
      g.shadowColor = 'rgba(30,40,60,0.25)';
      g.shadowOffsetY = 2;
      this.roundRect(s.x - bw / 2, s.y - bh / 2, bw, bh, bh / 2, '#ffffff');
      g.restore();
      g.beginPath();
      g.moveTo(s.x - u * 0.09, s.y + bh / 2 - 1);
      g.lineTo(s.x + u * 0.09, s.y + bh / 2 - 1);
      g.lineTo(s.x, s.y + bh / 2 + u * 0.13);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.fill();
      this.logScreen(s.x - u * 0.18, s.y, u * 0.38, u * 0.15, 0);
      g.font = `${u * 0.34}px 'Lilita One', system-ui, sans-serif`;
      g.fillStyle = '#2b2f3a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(left), s.x + u * 0.24, s.y + 1);
    }

    // Floating "+10" texts.
    for (const t of this.texts) {
      const s = this.project(t.x, t.y, t.z + t.t * 0.8);
      g.globalAlpha = 1 - t.t * t.t;
      g.font = `${u * 0.42}px 'Lilita One', system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = u * 0.08;
      g.strokeStyle = '#7a4a00';
      g.strokeText(t.text, s.x, s.y);
      g.fillStyle = '#ffd23a';
      g.fillText(t.text, s.x, s.y);
      g.globalAlpha = 1;
    }

    // Upgrade pad labels.
    for (const up of this.upgrades) {
      const price = up.prices[up.level];
      if (price === undefined || up.menuOnly || !this.available(up)) continue;
      const cx = (up.x0 + up.x1) / 2;
      const cy = (up.y0 + up.y1) / 2;
      if (!this.onScreen(cx, cy)) continue;
      const s = this.project(cx, cy, 0.95);
      const title = up.prices.length > 1 && up.id !== 'worker' ? `${up.name} ${up.level + 1}/${up.prices.length}` : up.name;
      const fs = Math.max(11, u * 0.28);
      g.font = `${fs}px 'Lilita One', system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = fs * 0.25;
      g.strokeStyle = 'rgba(43,47,58,0.85)';
      g.strokeText(title, s.x, s.y - fs * 1.05);
      g.fillStyle = '#ffffff';
      g.fillText(title, s.x, s.y - fs * 1.05);
      this.label(s.x, s.y + fs * 0.25, `${price - up.paid} eeeddd`, 'rgba(201,141,23,0.95)');
    }

    // Guide arrow: where to go next.
    const p = this.player;
    let target: { x: number; y: number } | null = null;
    const carrying = p.stack + p.incoming;
    let isDrop = false;
    if (carrying >= this.capacity || (p.stack > 0 && inCamp(p.x, p.y))) {
      isDrop = true;
      target = { x: (DROP.x0 + DROP.x1) / 2, y: (DROP.y0 + DROP.y1) / 2 };
      if (this.hasBelt) {
        const b = { x: (BELT_DROP.x0 + BELT_DROP.x1) / 2, y: (BELT_DROP.y0 + BELT_DROP.y1) / 2 };
        if (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(target.x - p.x, target.y - p.y)) target = b;
      }
    } else if (carrying === 0 || !inCamp(p.x, p.y)) {
      const gold = this.trees.find((t) => t.golden && !t.stump);
      target = gold ?? (inCamp(p.x, p.y) ? this.nearestTreeByRoute(p) : this.nearestTree(p.x, p.y, 60));
    }
    if (!target) return;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    // Bouncing marker over the target.
    const bounce = Math.abs(Math.sin(this.time * 4)) * u * 0.2;
    const mz = isDrop ? 0.6 : 2.6;
    const m = this.project(target.x, target.y, mz);
    if (d > 1.4) {
      g.beginPath();
      g.moveTo(m.x, m.y - bounce);
      g.lineTo(m.x - u * 0.22, m.y - u * 0.3 - bounce);
      g.lineTo(m.x - u * 0.09, m.y - u * 0.3 - bounce);
      g.lineTo(m.x - u * 0.09, m.y - u * 0.55 - bounce);
      g.lineTo(m.x + u * 0.09, m.y - u * 0.55 - bounce);
      g.lineTo(m.x + u * 0.09, m.y - u * 0.3 - bounce);
      g.lineTo(m.x + u * 0.22, m.y - u * 0.3 - bounce);
      g.closePath();
      g.fillStyle = '#ffd23a';
      g.fill();
      g.lineWidth = u * 0.05;
      g.strokeStyle = '#7a4a00';
      g.stroke();
    }
    if (d < 2.5) return;
    // Ground chevron around the player pointing at the target.
    const nx = dx / d;
    const ny = dy / d;
    const R = 1.05;
    const tip = this.project(p.x + nx * (R + 0.35), p.y + ny * (R + 0.35), 0);
    const l = this.project(p.x + nx * R - ny * 0.3, p.y + ny * R + nx * 0.3, 0);
    const mid = this.project(p.x + nx * (R + 0.1), p.y + ny * (R + 0.1), 0);
    const r = this.project(p.x + nx * R + ny * 0.3, p.y + ny * R - nx * 0.3, 0);
    g.globalAlpha = 0.65 + Math.sin(this.time * 5) * 0.25;
    g.beginPath();
    g.moveTo(tip.x, tip.y);
    g.lineTo(l.x, l.y);
    g.lineTo(mid.x, mid.y);
    g.lineTo(r.x, r.y);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineWidth = u * 0.04;
    g.strokeStyle = 'rgba(43,47,58,0.5)';
    g.stroke();
    g.globalAlpha = 1;
  }

  private drawSnowfall() {
    const g = this.g;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.flakes) {
      const y = (f.y + this.time * f.v) % 1;
      const x = (f.x + Math.sin(this.time * 0.8 + f.ph) * 0.01 - (this.camX - this.camY) * 0.004 + 10) % 1;
      g.beginPath();
      g.arc(x * this.w, y * this.h, f.r, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawStick() {
    const s = this.input.stick;
    if (!s) return;
    const g = this.g;
    g.beginPath();
    g.arc(s.ox, s.oy, this.input.radius, 0, Math.PI * 2);
    g.fillStyle = 'rgba(43,47,58,0.15)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.stroke();
    g.beginPath();
    g.arc(s.x, s.y, 24, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();
  }

  private drawCoins() {
    const g = this.g;
    const hud = this.hooks.moneyTarget();
    for (const c of this.coins) {
      if (c.t < 0) continue;
      const t = easeInOut(c.t);
      const target = c.toWorld ? this.project(c.toWorld.x, c.toWorld.y, c.toWorld.z) : hud;
      const x = lerp(c.x, target.x, t);
      const y = lerp(c.y, target.y, t) - Math.sin(Math.PI * t) * (c.toWorld ? 30 : 60);
      const r = (c.toWorld ? 10 : 13) * (1 - t * 0.3);
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      gr.addColorStop(0, '#ffe68a');
      gr.addColorStop(0.6, '#f7c844');
      gr.addColorStop(1, '#c98d17');
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = gr;
      g.fill();
      g.font = `${r * 1.3}px 'Lilita One', system-ui, sans-serif`;
      g.fillStyle = '#9a5c00';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('e', x, y + 1);
    }
  }
}

/** Where the i-th log sits on the counter (3 x 3 per layer). */
function pileSlot(i: number): V3 {
  const level = Math.min(4, Math.floor(i / 9));
  const k = i % 9;
  const col = k % 3;
  const row = Math.floor(k / 3);
  return {
    x: COUNTER.x0 + 0.22 + col * 0.28,
    y: COUNTER.y0 + 0.55 + row * 0.95,
    z: COUNTER.top + 0.1 + level * 0.19,
  };
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + c * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function beltLength() {
  let len = 0;
  for (let i = 0; i < BELT_PATH.length - 1; i++) {
    len += Math.hypot(BELT_PATH[i + 1].x - BELT_PATH[i].x, BELT_PATH[i + 1].y - BELT_PATH[i].y);
  }
  return len;
}

/** Point at distance d along the belt, and which axis that stretch runs along. */
function beltPoint(d: number): { x: number; y: number; axis: 'x' | 'y' } {
  for (let i = 0; i < BELT_PATH.length - 1; i++) {
    const a = BELT_PATH[i];
    const b = BELT_PATH[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg || i === BELT_PATH.length - 2) {
      const t = Math.min(1, d / seg);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), axis: Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? 'x' : 'y' };
    }
    d -= seg;
  }
  return { ...BELT_PATH[0], axis: 'x' };
}
