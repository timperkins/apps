// Jobville: a huge village. Get a job at the job board, earn $, buy upgrades on the shop podiums.
import './style.css';
import type { GameModule } from '../types';
import { JOBS, JOB_BY_ID, UPGRADES, UPGRADE_BY_ID, type JobId, type UpgradeId } from './data';
import { isMuted, setMuted, sfx } from './audio';
import { H, LOT, SOLID, T, W, hash, idx, inLot, inMap, makeWorld, type Building, type World } from './world';
import { CATS, CAT_ICON, ITEMS, ITEM_BY_ID, LEVEL_TITLES, NAMES, ROLES, type Item } from './build';

const SAVE_KEY = 'jobville-save-v1';

interface Save {
  money: number;
  earned: number;
  job: JobId | null;
  up: Partial<Record<UpgradeId, number>>;
  x: number;
  y: number;
  intro: boolean;
  muted: boolean;
  shirt: string;
  won: boolean;
  count: Partial<Record<JobId, number>>;
  pranks?: number;
  bricks: number;
  objs: [number, string][];
  floors: [number, string][];
  biz: { name: string; kind: string } | null;
  workers: Worker[];
  box: number;
  nextId: number;
}

interface Worker {
  id: number;
  name: string;
  role: string;
  level: number;
  wage: number;
  skill: number;
  shirt: string;
  skin: string;
  hair: string;
}

interface Walker {
  x: number;
  y: number;
  path: { x: number; y: number }[];
  kind: 'customer' | 'worker' | 'applicant';
  state: 'in' | 'stay' | 'out';
  t: number;
  shirt: string;
  skin: string;
  hair: string;
  item?: string;
  wid?: number;
  app?: Worker;
}

interface Rival {
  name: string;
  job: 'sweeper' | 'farmer' | 'lumberjack' | 'miner';
  x: number;
  y: number;
  tx: number;
  ty: number;
  ti: number;
  trash: Trash | null;
  work: number;
  dizzy: number;
  stuck: number;
  lx: number;
  ly: number;
  shirt: string;
  say: string;
  sayT: number;
}

const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e84393', '#34495e'];

interface Carry {
  kind: 'letter' | 'pizza';
  house: Building;
  due: number;
  total: number;
}

interface Npc {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dx: number;
  dy: number;
  speed: number;
  shirt: string;
  skin: string;
  hair: string;
  say: string;
  sayT: number;
  cool: number;
}

interface Trash {
  x: number;
  y: number;
  icon: string;
}

interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

interface Action {
  label: string;
  icon: string;
  repeat?: boolean;
  disabled?: boolean;
  run: () => void;
}

interface Fishing {
  phase: 'wait' | 'bite';
  t: number;
  x: number;
  y: number;
  bx: number;
  by: number;
}

const FISH = [
  { name: 'Minnow', icon: '🐟', pay: 6, w: 40 },
  { name: 'Sunfish', icon: '🐠', pay: 11, w: 28 },
  { name: 'Bass', icon: '🐟', pay: 17, w: 18 },
  { name: 'Pufferfish', icon: '🐡', pay: 24, w: 9 },
  { name: 'Golden Carp', icon: '✨', pay: 40, w: 4 },
];

const TRASH_ICONS = ['🥫', '🍌', '📰', '🧃', '🥤', '🍎', '🧦'];
const GREETINGS = ['Hi!', 'Hello!', 'Nice day!', 'Howdy!', 'Hey there!', 'Love the hat!', 'Working hard?', 'Got a job yet?', 'Hi neighbor!'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const HAIRS = ['#2c1b10', '#5a3825', '#b5651d', '#e6c35c', '#222', '#a33'];

// Shop room
const SW = 18;
const SH = 12;
const PODIUMS: { x: number; y: number; id: UpgradeId }[] = UPGRADES.map((u, i) => ({
  x: 3 + (i % 5) * 3,
  y: i < 5 ? 5 : 8.5,
  id: u.id,
}));
const SHOP_DOOR = { x: 9, y: 11 };

const fmt = (n: number) => '$' + Math.floor(n).toLocaleString('en-US');
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const doorPt = (b: Building) => ({ x: b.door.x + 0.5, y: b.door.y + 0.5 });

function loadSave(): Save {
  const base: Save = {
    money: 0,
    earned: 0,
    job: null,
    up: {},
    x: 0,
    y: 0,
    intro: false,
    muted: false,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    won: false,
    count: {},
    bricks: 0,
    objs: [],
    floors: [],
    biz: null,
    workers: [],
    box: 0,
    nextId: 1,
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Save>) };
  } catch {
    /* fresh game */
  }
  return base;
}

function mount(root: HTMLElement, opts: { onExit: () => void }) {
  const world: World = makeWorld();
  let save = loadSave();
  setMuted(save.muted);
  const startX = world.board.x + 1;
  const startY = world.board.y + 1.8;
  if (!save.x || !inMap(Math.floor(save.x), Math.floor(save.y))) {
    save.x = startX;
    save.y = startY;
  }

  root.innerHTML = `
  <div class="jv" tabindex="0">
    <canvas class="jv-canvas"></canvas>
    <div class="jv-hud">
      <div class="jv-money"></div>
      <div class="jv-job"></div>
    </div>
    <div class="jv-topright">
      <canvas class="jv-mini" width="180" height="180"></canvas>
      <div class="jv-btns">
        <button class="jv-btn" data-b="build" title="Build your shop (B)">🔨</button>
        <button class="jv-btn" data-b="map" title="Map (M)">🗺️</button>
        <button class="jv-btn" data-b="menu" title="Menu (Esc)">⏸</button>
      </div>
    </div>
    <div class="jv-prompt"></div>
    <div class="jv-buildbar">
      <button class="jv-bb-item" data-bb="menu"></button>
      <button data-bb="place">✅ Place <kbd>E</kbd></button>
      <button data-bb="remove">🗑 Remove <kbd>X</kbd></button>
      <button data-bb="done">✔ Done</button>
    </div>
    <div class="jv-toast"></div>
    <div class="jv-stick"><div class="jv-knob"></div></div>
    <button class="jv-act"><span class="i"></span><span class="l"></span></button>
    <div class="jv-modal hidden"></div>
  </div>`;
  const el = root.querySelector<HTMLDivElement>('.jv')!;
  const canvas = el.querySelector<HTMLCanvasElement>('.jv-canvas')!;
  const g = canvas.getContext('2d')!;
  const moneyEl = el.querySelector<HTMLDivElement>('.jv-money')!;
  const jobEl = el.querySelector<HTMLDivElement>('.jv-job')!;
  const promptEl = el.querySelector<HTMLDivElement>('.jv-prompt')!;
  const toastEl = el.querySelector<HTMLDivElement>('.jv-toast')!;
  const modal = el.querySelector<HTMLDivElement>('.jv-modal')!;
  const mini = el.querySelector<HTMLCanvasElement>('.jv-mini')!;
  const mg = mini.getContext('2d')!;
  const stick = el.querySelector<HTMLDivElement>('.jv-stick')!;
  const knob = el.querySelector<HTMLDivElement>('.jv-knob')!;
  const actBtn = el.querySelector<HTMLButtonElement>('.jv-act')!;
  el.focus();

  // ---------- state ----------
  let now = 0;
  let scene: 'town' | 'shop' = 'town';
  const p = { x: save.x, y: save.y, fx: 0, fy: 1, walk: 0, moving: false };
  const pet = { x: p.x - 1, y: p.y };
  let townReturn = { x: p.x, y: p.y };
  let carry: Carry[] = [];
  let fishing: Fishing | null = null;
  const floats: Float[] = [];
  const trash: Trash[] = [];
  const npcs: Npc[] = [];
  let target: { x: number; y: number } | null = null;
  let targetTimer = 0;
  let action: Action | null = null;
  let actCool = 0;
  let actHeld = false;
  let touchMode = matchMedia('(pointer: coarse)').matches;
  let toastT = 0;
  let lastCoin = -1;
  let saveT = 0;
  let confetti: { x: number; y: number; vx: number; vy: number; c: string; r: number }[] = [];

  const tier = (id: UpgradeId) => save.up[id] ?? 0;
  const speed = () => {
    const shoes = [4.4, 5.5, 6.8, 8.4][tier('shoes')];
    return tier('hover') ? Math.max(shoes, 10) : shoes;
  };
  const bagCap = () => [1, 2, 3, 5][tier('bag')];
  const chopHits = () => [3, 2, 1, 1][tier('tools')];
  const mineHits = () => [5, 3, 2, 1][tier('tools')];
  const payMult = () => [1, 1.2, 1.5, 2][tier('hat')] * [1, 1.1, 1.25][tier('pet')];
  const magnet = () => [0, 2.5, 5][tier('magnet')];
  const regrowMult = () => (tier('watch') ? 0.5 : 1);

  // ---------- helpers ----------
  function toast(text: string) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastT = 2.6;
  }

  function addFloat(x: number, y: number, text: string, color = '#ffe14d') {
    floats.push({ x, y, text, color, t: 1.4 });
  }

  function earn(base: number, x: number, y: number, extra = '') {
    const amt = Math.max(1, Math.round(base * payMult()));
    save.money += amt;
    save.earned += amt;
    if (save.job) save.count[save.job] = (save.count[save.job] ?? 0) + 1;
    addFloat(x, y, `+${fmt(amt)}${extra}`);
    if (now - lastCoin > 0.09) sfx.coin();
    lastCoin = now;
    checkUnlocks(save.earned - amt);
  }

  function checkUnlocks(before: number) {
    for (const j of JOBS)
      if (j.unlock > before && j.unlock <= save.earned) toast(`New job on the job board: ${j.icon} ${j.name}!`);
  }

  const tileAt = (x: number, y: number) => (inMap(x, y) ? world.tiles[idx(x, y)] : T.Hedge);

  function solidTown(x: number, y: number) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!inMap(tx, ty)) return true;
    const t = world.tiles[idx(tx, ty)];
    if (t === T.Water) return !tier('hover');
    if (t === T.Lot) return placedSolid(idx(tx, ty));
    return SOLID.has(t);
  }

  function solidShop(x: number, y: number) {
    if (x < 1 || y < 3 || x >= SW - 1 || y >= SH - 1) {
      // the doorway in the bottom wall
      return !(y >= SH - 1 && y < SH && x >= SHOP_DOOR.x && x < SHOP_DOOR.x + 1);
    }
    for (const pd of PODIUMS) if (dist(x, y, pd.x, pd.y) < 0.55) return true;
    return false;
  }

  const solid = (x: number, y: number) => (scene === 'town' ? solidTown(x, y) : solidShop(x, y));
  const R = 0.3;
  const blocked = (x: number, y: number) =>
    solid(x - R, y - R) || solid(x + R, y - R) || solid(x - R, y + R) || solid(x + R, y + R);

  // ---------- town life ----------
  function randomRoad() {
    const i = world.roads[Math.floor(Math.random() * world.roads.length)];
    return { x: i % W, y: (i / W) | 0 };
  }
  const walkable = (x: number, y: number) => {
    const t = tileAt(x, y);
    return t === T.Road || t === T.Plaza || t === T.Path;
  };

  for (let i = 0; i < 70; i++) {
    const r = randomRoad();
    npcs.push({
      x: r.x + 0.5,
      y: r.y + 0.5,
      tx: r.x,
      ty: r.y,
      dx: 1,
      dy: 0,
      speed: 1.3 + Math.random() * 1.1,
      shirt: SHIRTS[i % SHIRTS.length],
      skin: SKINS[i % SKINS.length],
      hair: HAIRS[(i * 7) % HAIRS.length],
      say: '',
      sayT: 0,
      cool: Math.random() * 5,
    });
  }

  function stepNpc(n: Npc, dt: number) {
    const cx = n.tx + 0.5;
    const cy = n.ty + 0.5;
    const d = dist(n.x, n.y, cx, cy);
    const s = n.speed * dt;
    if (d > s) {
      n.x += ((cx - n.x) / d) * s;
      n.y += ((cy - n.y) / d) * s;
    } else {
      n.x = cx;
      n.y = cy;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => walkable(n.tx + dx, n.ty + dy) && !(dx === -n.dx && dy === -n.dy));
      let pick: number[] | undefined;
      if (dirs.some(([dx, dy]) => dx === n.dx && dy === n.dy) && Math.random() < 0.8) pick = [n.dx, n.dy];
      else pick = dirs[Math.floor(Math.random() * dirs.length)];
      if (!pick) pick = [-n.dx, -n.dy];
      n.dx = pick[0];
      n.dy = pick[1];
      n.tx += n.dx;
      n.ty += n.dy;
    }
    n.cool -= dt;
    n.sayT -= dt;
    if (n.cool <= 0 && scene === 'town' && dist(n.x, n.y, p.x, p.y) < 2.2) {
      n.say = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      n.sayT = 2;
      n.cool = 14 + Math.random() * 10;
    }
  }

  let trashT = 0;
  function spawnTrash() {
    let r = randomRoad();
    // most trash shows up within walking distance of you
    for (let k = 0; k < 12 && Math.random() < 0.7 && dist(r.x, r.y, p.x, p.y) > 30; k++) r = randomRoad();
    if (dist(r.x, r.y, p.x, p.y) < 4) return;
    trash.push({ x: r.x + 0.2 + Math.random() * 0.6, y: r.y + 0.2 + Math.random() * 0.6, icon: TRASH_ICONS[Math.floor(Math.random() * TRASH_ICONS.length)] });
  }
  for (let i = 0; i < 60; i++) spawnTrash();

  function updateRegrow() {
    // trees, rocks come back
    const reg = world.regrow;
    for (const i of world.forest) if (world.tiles[i] === T.Stump && reg[i] <= now) { world.tiles[i] = T.Tree; world.hits[i] = 0; }
    for (const i of world.rocks) if (world.tiles[i] === T.Quarry && reg[i] <= now) { world.tiles[i] = T.Rock; world.hits[i] = 0; }
  }

  // ---------- jobs ----------
  const nearTiles = (rad: number, test: (i: number, x: number, y: number) => boolean) => {
    let best = -1;
    let bd = rad;
    for (let y = Math.floor(p.y - rad); y <= Math.floor(p.y + rad); y++)
      for (let x = Math.floor(p.x - rad); x <= Math.floor(p.x + rad); x++) {
        if (!inMap(x, y)) continue;
        const i = idx(x, y);
        if (!test(i, x, y)) continue;
        const d = dist(p.x, p.y, x + 0.5, y + 0.5);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    return best;
  };

  const ripe = (i: number) => world.tiles[i] === T.Field && world.regrow[i] <= now;
  const CROP_TIME = 45;

  function harvest(i: number) {
    const x = i % W;
    const y = (i / W) | 0;
    world.regrow[i] = now + CROP_TIME * regrowMult() * (0.8 + Math.random() * 0.4);
    sfx.pick();
    earn(4, x + 0.5, y + 0.2);
  }

  function chop(i: number) {
    const x = i % W;
    const y = (i / W) | 0;
    world.hits[i]++;
    sfx.chop();
    if (world.hits[i] >= chopHits()) {
      world.tiles[i] = T.Stump;
      world.regrow[i] = now + 60 * regrowMult();
      earn(tier('tools') >= 3 ? 18 : 9, x + 0.5, y + 0.2, ' 🪵');
    } else addFloat(x + 0.5, y + 0.2, '*chop*', '#fff');
  }

  function mine(i: number) {
    const x = i % W;
    const y = (i / W) | 0;
    world.hits[i]++;
    sfx.rock();
    if (world.hits[i] >= mineHits()) {
      world.tiles[i] = T.Quarry;
      world.regrow[i] = now + 50 * regrowMult();
      const gem = Math.random() < 0.1;
      const base = (gem ? 80 : 14) * (tier('tools') >= 3 ? 2 : 1);
      earn(base, x + 0.5, y + 0.2, gem ? ' 💎' : ' 🪨');
      if (gem) toast('You found a gem! 💎');
    } else addFloat(x + 0.5, y + 0.2, '*clink*', '#fff');
  }

  function pickHouse(from: { x: number; y: number }) {
    const taken = new Set(carry.map((c) => c.house));
    for (let tries = 0; tries < 50; tries++) {
      const h = world.houses[Math.floor(Math.random() * world.houses.length)];
      if (taken.has(h)) continue;
      if (dist(from.x, from.y, h.door.x, h.door.y) < 14) continue;
      return h;
    }
    return world.houses[0];
  }

  function grab(kind: 'letter' | 'pizza') {
    const b = world.byKind[kind === 'letter' ? 'post' : 'pizza']!;
    const from = doorPt(b);
    let got = 0;
    while (carry.length < bagCap()) {
      const house = pickHouse(from);
      const d = dist(from.x, from.y, house.door.x, house.door.y);
      const total = kind === 'pizza' ? Math.round(20 + d / 2.6) : 0;
      carry.push({ kind, house, due: now + total, total });
      got++;
    }
    sfx.door();
    const what = kind === 'letter' ? (got > 1 ? `${got} letters` : 'a letter') : got > 1 ? `${got} pizzas` : 'a pizza';
    toast(`You got ${what}! Follow the arrow to house #${carry[0].house.num}.`);
    targetTimer = 0;
  }

  function deliver(c: Carry) {
    carry = carry.filter((x) => x !== c);
    const d = doorPt(c.house);
    if (c.kind === 'letter') {
      const b = world.byKind.post!;
      earn(10 + Math.floor(dist(b.door.x, b.door.y, c.house.door.x, c.house.door.y) / 6), d.x, d.y - 0.6, ' ✉️');
    } else {
      const left = c.due - now;
      if (left > 0) earn(20 + Math.ceil(left / 2), d.x, d.y - 0.6, ' 🍕');
      else {
        earn(6, d.x, d.y - 0.6, ' (cold)');
        toast('That pizza got cold. Be faster next time!');
      }
    }
    if (carry.length) toast(`Next: house #${carry[0].house.num}`);
    targetTimer = 0;
  }

  function nearWater() {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0.9], [0.9, 0], [-0.9, 0], [0, -0.9]]) {
      const x = Math.floor(p.x + dx);
      const y = Math.floor(p.y + dy);
      if (tileAt(x, y) === T.Water && !(tileAt(Math.floor(p.x), Math.floor(p.y)) === T.Water)) return { x: p.x + dx * 1.6, y: p.y + dy * 1.6 };
    }
    return null;
  }

  function biteWait() {
    const [a, b] = [[2.5, 5.5], [1.5, 3.5], [0.8, 2.2]][tier('rod')];
    return a + Math.random() * (b - a);
  }

  function reel() {
    const pro = tier('rod') >= 2;
    const list = FISH.map((f, i) => ({ ...f, w: pro ? f.w * (1 + i * 0.6) : f.w }));
    let r = Math.random() * list.reduce((s, f) => s + f.w, 0);
    let fish = list[0];
    for (const f of list) {
      r -= f.w;
      if (r <= 0) {
        fish = f;
        break;
      }
    }
    sfx.splash();
    earn(fish.pay, p.x, p.y - 0.8, ' ' + fish.icon);
    toast(`You caught a ${fish.name}!`);
  }

  function findAction(): Action | null {
    if (scene === 'shop') {
      if (dist(p.x, p.y, SHOP_DOOR.x + 0.5, SH - 1.2) < 1.3)
        return { label: 'Leave shop', icon: '🚪', run: leaveShop };
      for (const pd of PODIUMS) {
        if (dist(p.x, p.y, pd.x, pd.y) > 1.35) continue;
        const up = UPGRADE_BY_ID[pd.id];
        const t = tier(pd.id);
        if (t >= up.tiers.length) return { label: 'Sold out', icon: '✅', disabled: true, run: () => {} };
        const it = up.tiers[t];
        if (save.money < it.price)
          return { label: `${it.name}: need ${fmt(it.price)}`, icon: it.icon, disabled: true, run: () => { sfx.nope(); toast(`You need ${fmt(it.price - save.money)} more for the ${it.name}.`); } };
        return { label: `Buy ${it.name} ${fmt(it.price)}`, icon: it.icon, run: () => buy(pd.id) };
      }
      return null;
    }
    // town
    if (build.on) {
      const it = build.item;
      return it ? { label: `Place ${it.name}`, icon: it.icon, run: placeItem } : { label: 'Pick something', icon: '📦', run: openBuildMenu };
    }
    const bt = boxTile();
    if (bt >= 0 && dist(p.x, p.y, (bt % W) + 0.5, ((bt / W) | 0) + 0.5) < 1.5)
      return {
        label: 'Collect money',
        icon: '💰',
        run: () => {
          if (save.box <= 0) {
            toast('The money box is empty. Wait for customers!');
            return;
          }
          const amt = Math.floor(save.box);
          save.money += amt;
          save.earned += amt;
          save.box = 0;
          addFloat((bt % W) + 0.5, ((bt / W) | 0) - 0.2, `+${fmt(amt)} 💰`);
          sfx.buy();
        },
      };
    for (const k of walkers) {
      if (dist(p.x, p.y, k.x, k.y) > 1.4) continue;
      if (k.kind === 'applicant') return { label: `Read ${k.app!.name}'s diploma`, icon: '📜', run: () => openDiploma(k) };
      if (k.kind === 'worker') {
        const w = save.workers.find((x) => x.id === k.wid);
        if (w) return { label: `Talk to ${w.name}`, icon: '💬', run: () => openWorker(w) };
      }
    }
    for (const r of rivals)
      if (r.dizzy <= 0 && dist(p.x, p.y, r.x, r.y) < 1.4) return { label: `Prank ${r.name} 🍌`, icon: '🍌', run: () => prank(r) };
    const b = world.board;
    if (dist(p.x, p.y, b.x + 1, b.y + 0.5) < 1.9) return { label: 'Job board', icon: '📋', run: openBoard };
    const shop = world.byKind.shop!;
    if (dist(p.x, p.y, shop.door.x + 0.5, shop.door.y + 0.5) < 1.3) return { label: 'Go in the shop', icon: '🛒', run: enterShop };
    const job = save.job;
    if (job === 'mail' || job === 'pizza') {
      const kind = job === 'mail' ? 'letter' : 'pizza';
      for (const c of carry) {
        const d = doorPt(c.house);
        if (dist(p.x, p.y, d.x, d.y) < 1.4) return { label: `Deliver ${kind}`, icon: kind === 'letter' ? '✉️' : '🍕', run: () => deliver(c) };
      }
      const src = world.byKind[job === 'mail' ? 'post' : 'pizza']!;
      const sd = doorPt(src);
      if (dist(p.x, p.y, sd.x, sd.y) < 1.4) {
        if (carry.length >= bagCap()) return { label: 'Your bag is full', icon: '🎒', disabled: true, run: () => {} };
        return { label: kind === 'letter' ? 'Get letters' : 'Get pizzas', icon: kind === 'letter' ? '📬' : '🍕', run: () => grab(kind) };
      }
    }
    if (job === 'farmer') {
      const i = nearTiles(1.3, (i) => ripe(i));
      if (i >= 0) return { label: 'Harvest', icon: '🌾', repeat: true, run: () => harvest(i) };
    }
    if (job === 'lumberjack') {
      const i = nearTiles(1.5, (i, x, y) => world.tiles[i] === T.Tree && x > 2 && y > 2 && x < W - 3 && y < H - 3);
      if (i >= 0) return { label: 'Chop tree', icon: '🪓', repeat: true, run: () => chop(i) };
    }
    if (job === 'miner') {
      const i = nearTiles(1.5, (i) => world.tiles[i] === T.Rock);
      if (i >= 0) return { label: 'Mine rock', icon: '⛏️', repeat: true, run: () => mine(i) };
    }
    if (job === 'sweeper') {
      let best: Trash | null = null;
      let bd = 1.3;
      for (const t of trash) {
        const d = dist(p.x, p.y, t.x, t.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (best) {
        const t = best;
        return { label: 'Pick up trash', icon: '🧹', repeat: true, run: () => pickTrash(t) };
      }
    }
    if (job === 'fisher') {
      if (fishing?.phase === 'bite') return { label: 'Reel it in!', icon: '❗', run: () => { fishing = null; reel(); } };
      if (fishing) return { label: 'Wait for a bite…', icon: '🎣', run: () => { addFloat(p.x, p.y - 0.8, 'Too soon!', '#fff'); if (fishing) fishing.t = biteWait(); } };
      const w = nearWater();
      if (w) return { label: 'Cast your line', icon: '🎣', run: () => { fishing = { phase: 'wait', t: biteWait(), x: p.x, y: p.y, bx: w.x, by: w.y }; sfx.splash(); } };
    }
    return null;
  }

  // ---------- your own shop ----------
  const objMap = new Map<number, string>(save.objs);
  const floorMap = new Map<number, string>(save.floors);
  const build = { on: false, item: null as Item | null };
  let walkers: Walker[] = [];
  let custT = 8;
  let workT = 10;
  let wageT = 60;
  let appT = 25;
  let noDoorT = 0;
  let pathsDirty = true;
  const GATE = { x: LOT.x + LOT.w + 1, y: LOT.gateY };

  const syncLot = () => {
    save.objs = [...objMap];
    save.floors = [...floorMap];
    pathsDirty = true;
  };
  const placedSolid = (i: number) => {
    const id = objMap.get(i);
    return !!id && ITEM_BY_ID[id]?.solid !== false;
  };
  const boxTile = () => {
    for (const [i, id] of objMap) if (id === 'money-box') return i;
    return -1;
  };
  const appeal = () => {
    let a = 0;
    for (const id of objMap.values()) a += ITEM_BY_ID[id]?.appeal ?? 0;
    for (const id of floorMap.values()) a += ITEM_BY_ID[id]?.appeal ?? 0;
    return a;
  };
  const lotPass = (x: number, y: number) =>
    (inLot(x, y) && !placedSolid(idx(x, y))) || ((x === LOT.x + LOT.w || x === GATE.x) && (y === LOT.gateY || y === LOT.gateY + 1));

  /** Shortest walk inside your lot, to any tile next to the goal tile. */
  function lotPath(sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
    const key = (x: number, y: number) => y * W + x;
    const prev = new Map<number, number>();
    const start = key(sx, sy);
    prev.set(start, -1);
    const q = [start];
    const goal = (x: number, y: number) => Math.abs(x - gx) + Math.abs(y - gy) === 1 || (x === gx && y === gy);
    while (q.length) {
      const k = q.shift()!;
      const x = k % W;
      const y = (k / W) | 0;
      if (goal(x, y)) {
        const out: { x: number; y: number }[] = [];
        for (let c = k; c !== -1; c = prev.get(c)!) out.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
        return out.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = key(nx, ny);
        if (prev.has(nk) || !lotPass(nx, ny)) continue;
        prev.set(nk, k);
        q.push(nk);
      }
    }
    return null;
  }

  const randLook = () => ({
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
  });

  function stationFor(w: Worker) {
    const role = ROLES.find((r) => r.name === w.role);
    const tiles = [...objMap].filter(([, id]) => ITEM_BY_ID[id]?.layer === 'object');
    const match = role ? tiles.find(([, id]) => role.needs.includes(id)) : undefined;
    return { tile: match ?? tiles[w.id % Math.max(1, tiles.length)], matched: !!match };
  }

  function placeWorkers() {
    walkers = walkers.filter((k) => k.kind !== 'worker');
    for (const w of save.workers) {
      const st = stationFor(w);
      let path: { x: number; y: number }[] | null = null;
      if (st.tile) path = lotPath(GATE.x, GATE.y, st.tile[0] % W, (st.tile[0] / W) | 0);
      const end = path?.[path.length - 1] ?? { x: LOT.x + LOT.w - 1.5, y: LOT.gateY + 0.5 };
      walkers.push({ x: end.x, y: end.y, path: [], kind: 'worker', state: 'stay', t: 0, shirt: w.shirt, skin: w.skin, hair: w.hair, wid: w.id });
    }
  }

  function workerRate(w: Worker) {
    const matched = !w.role || ROLES.some((r) => r.name === w.role) ? stationFor(w).matched : true;
    return (w.wage * (matched ? 2 : 1.3) * (0.6 + 0.2 * w.skill) * (1 + 0.5 * (w.level - 1)));
  }

  function spawnCustomer() {
    const targets = [...objMap].filter(([, id]) => {
      const it = ITEM_BY_ID[id];
      return it && it.layer === 'object' && id !== 'money-box' && it.appeal > 0;
    });
    if (!targets.length) return;
    const pick = targets.find(([, id]) => ITEM_BY_ID[id].sells && Math.random() < 0.5) ?? targets[Math.floor(Math.random() * targets.length)];
    const path = lotPath(GATE.x, GATE.y, pick[0] % W, (pick[0] / W) | 0);
    if (!path) {
      if (noDoorT <= 0) {
        toast("Customers can't get into your shop! Leave a gap or put in a 🚪 door.");
        noDoorT = 40;
      }
      return;
    }
    walkers.push({ x: GATE.x + 0.5, y: GATE.y + 0.5, path, kind: 'customer', state: 'in', t: 0, ...randLook(), item: pick[1] });
  }

  function stepWalkers(dt: number) {
    for (const k of walkers) {
      if (k.path.length) {
        const n = k.path[0];
        const d = dist(k.x, k.y, n.x, n.y);
        const s = 2.2 * dt;
        if (d <= s) {
          k.x = n.x;
          k.y = n.y;
          k.path.shift();
        } else {
          k.x += ((n.x - k.x) / d) * s;
          k.y += ((n.y - k.y) / d) * s;
        }
        continue;
      }
      if (k.kind === 'customer') {
        if (k.state === 'in') {
          k.state = 'stay';
          k.t = 2.5;
        } else if (k.state === 'stay') {
          k.t -= dt;
          if (k.t <= 0) {
            const it = ITEM_BY_ID[k.item ?? ''];
            const bt = boxTile();
            if (it && bt >= 0) {
              const pay = Math.round((3 + Math.min(30, appeal() / 15) + (it.sells ? it.price / 3 : 1)) * payMult());
              save.box += pay;
            }
            k.state = 'out';
            const back = lotPath(Math.floor(k.x), Math.floor(k.y), GATE.x, GATE.y);
            k.path = back ?? [];
            if (!back) k.t = -99;
          }
        } else k.t = -99;
      }
    }
    walkers = walkers.filter((k) => !(k.kind === 'customer' && k.state === 'out' && !k.path.length));
  }

  function updateBusiness(dt: number) {
    if (pathsDirty) {
      pathsDirty = false;
      placeWorkers();
    }
    stepWalkers(dt);
    noDoorT -= dt;
    const hasBox = boxTile() >= 0;
    const a = appeal();
    if (hasBox && a > 0) {
      custT -= dt;
      if (custT <= 0) {
        custT = Math.max(2, 22 - a / 12 - save.workers.length * 1.5) * (0.7 + Math.random() * 0.6);
        if (walkers.filter((k) => k.kind === 'customer').length < 12) spawnCustomer();
      }
    }
    if (hasBox && save.workers.length) {
      workT -= dt;
      if (workT <= 0) {
        workT = 10;
        for (const w of save.workers) save.box += Math.round((workerRate(w) / 6) * payMult());
      }
    }
    if (save.workers.length) {
      wageT -= dt;
      if (wageT <= 0) {
        wageT = 60;
        for (const w of [...save.workers]) {
          if (save.money >= w.wage) save.money -= w.wage;
          else if (save.box >= w.wage) save.box -= w.wage;
          else {
            save.workers = save.workers.filter((x) => x !== w);
            toast(`${w.name} quit because you couldn't pay them. 😢`);
            pathsDirty = true;
            continue;
          }
        }
        if (save.workers.length) addFloat(p.x, p.y - 1, `-${fmt(save.workers.reduce((s, w) => s + w.wage, 0))} wages`, '#ff8a80');
      }
    }
    // job seekers
    if (save.biz && hasBox && save.workers.length < 10 && !walkers.some((k) => k.kind === 'applicant')) {
      appT -= dt;
      if (appT <= 0) {
        appT = 35 + Math.random() * 35;
        const look = randLook();
        const roles = [...ROLES.map((r) => r.name), `${save.biz.kind} Worker`];
        const skill = 1 + Math.floor(Math.random() * 5);
        const app: Worker = {
          id: save.nextId++,
          name: NAMES[Math.floor(Math.random() * NAMES.length)],
          role: roles[Math.floor(Math.random() * roles.length)],
          level: 1,
          skill,
          wage: 3 + skill * 2 + Math.floor(Math.random() * 4),
          ...look,
        };
        const path = lotPath(GATE.x, GATE.y, LOT.x + LOT.w - 3, LOT.gateY) ?? [];
        walkers.push({ x: GATE.x + 0.5, y: GATE.y + 0.5, path, kind: 'applicant', state: 'stay', t: 0, ...look, app });
        toast(`${app.name} wants a job at ${save.biz.name}! Go read their diploma 📜`);
      }
    }
  }

  function hire(k: Walker, yes: boolean) {
    walkers = walkers.filter((x) => x !== k);
    if (yes && k.app) {
      save.workers.push(k.app);
      sfx.job();
      toast(`${k.app.name} works for you now! 🎉`);
      pathsDirty = true;
      writeSave();
    }
  }

  // ---------- rivals ----------
  const RIVAL_NAMES = ['Rex', 'Bea', 'Gus', 'Dot', 'Ziggy', 'Moe', 'Kit', 'Bubba', 'Fern', 'Nico', 'Tess', 'Waldo'];
  const RIVAL_JOBS: Rival['job'][] = ['sweeper', 'sweeper', 'sweeper', 'sweeper', 'farmer', 'farmer', 'farmer', 'lumberjack', 'lumberjack', 'lumberjack', 'miner', 'miner'];
  const rivals: Rival[] = RIVAL_JOBS.map((job, i) => {
    const start = job === 'farmer' ? { x: 147, y: 46 + i * 6 } : job === 'lumberjack' ? { x: 30 + i, y: 88 } : job === 'miner' ? { x: 93, y: 12 } : randomRoad();
    return {
      name: RIVAL_NAMES[i], job, x: start.x + 0.5, y: start.y + 0.5, tx: start.x + 0.5, ty: start.y + 0.5, ti: -1, trash: null,
      work: 0, dizzy: 0, stuck: 0, lx: 0, ly: 0, shirt: '#444', say: '', sayT: 0,
    };
  });
  const RIVAL_TOOL: Record<Rival['job'], string> = { sweeper: '🧹', farmer: '🌾', lumberjack: '🪓', miner: '⛏️' };

  function rivalTarget(r: Rival) {
    r.ti = -1;
    r.trash = null;
    let best = Infinity;
    const jitter = () => Math.random() * 8;
    if (r.job === 'sweeper') {
      for (const t of trash) {
        const d = dist(r.x, r.y, t.x, t.y) + jitter();
        if (d < best) {
          best = d;
          r.trash = t;
        }
      }
      if (r.trash) {
        r.tx = r.trash.x;
        r.ty = r.trash.y;
      }
      return;
    }
    const list = r.job === 'farmer' ? world.fields : r.job === 'miner' ? world.rocks : world.forest;
    for (const i of list) {
      const ok = r.job === 'farmer' ? ripe(i) : r.job === 'miner' ? world.tiles[i] === T.Rock : world.tiles[i] === T.Tree && i % W < 44;
      if (!ok) continue;
      const d = dist(r.x, r.y, (i % W) + 0.5, ((i / W) | 0) + 0.5) + jitter();
      if (d < best) {
        best = d;
        r.ti = i;
      }
    }
    if (r.ti >= 0) {
      r.tx = (r.ti % W) + 0.5;
      r.ty = ((r.ti / W) | 0) + 0.5;
    }
  }

  const rivalBlocked = (x: number, y: number) => {
    for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const tx = Math.floor(x + dx);
      const ty = Math.floor(y + dy);
      if (!inMap(tx, ty)) return true;
      const t = world.tiles[idx(tx, ty)];
      if (SOLID.has(t) || inLot(tx, ty)) return true;
    }
    return false;
  };

  function stepRival(r: Rival, dt: number) {
    r.sayT -= dt;
    if (r.dizzy > 0) {
      r.dizzy -= dt;
      return;
    }
    const valid =
      r.job === 'sweeper' ? !!r.trash && trash.includes(r.trash) : r.ti >= 0 && (r.job === 'farmer' ? ripe(r.ti) : world.tiles[r.ti] === (r.job === 'miner' ? T.Rock : T.Tree));
    if (!valid) {
      rivalTarget(r);
      r.work = 0;
      return;
    }
    const d = dist(r.x, r.y, r.tx, r.ty);
    const reach = r.job === 'sweeper' || r.job === 'farmer' ? 0.5 : 1.2;
    if (d > reach) {
      const s = 3 * dt;
      const mx = ((r.tx - r.x) / d) * s;
      const my = ((r.ty - r.y) / d) * s;
      if (!rivalBlocked(r.x + mx, r.y)) r.x += mx;
      if (!rivalBlocked(r.x, r.y + my)) r.y += my;
      r.stuck += dt;
      if (r.stuck > 1.5) {
        if (dist(r.x, r.y, r.lx, r.ly) < 0.3) {
          // stuck: hop to a road and try something else
          const rr = randomRoad();
          if (r.job === 'sweeper') {
            r.x = rr.x + 0.5;
            r.y = rr.y + 0.5;
          }
          r.ti = -1;
          r.trash = null;
        }
        r.stuck = 0;
        r.lx = r.x;
        r.ly = r.y;
      }
      return;
    }
    r.work += dt;
    if (r.work < (r.job === 'sweeper' ? 0.4 : 1.6)) return;
    r.work = 0;
    if (r.job === 'sweeper' && r.trash) trash.splice(trash.indexOf(r.trash), 1);
    else if (r.job === 'farmer') world.regrow[r.ti] = now + CROP_TIME;
    else if (r.job === 'lumberjack') {
      world.tiles[r.ti] = T.Stump;
      world.regrow[r.ti] = now + 60;
    } else if (r.job === 'miner') {
      world.tiles[r.ti] = T.Quarry;
      world.regrow[r.ti] = now + 50;
    }
    r.ti = -1;
    r.trash = null;
  }

  function prank(r: Rival) {
    r.dizzy = 25;
    r.say = ['Whoa!', 'Hey!!', 'Who did that?', 'Oof!', 'My tools!'][Math.floor(Math.random() * 5)];
    r.sayT = 2.5;
    sfx.splash();
    save.pranks = (save.pranks ?? 0) + 1;
    if (Math.random() < 0.2 && save.money >= 10) {
      save.money -= 10;
      toast(`${r.name} saw you! You paid a $10 fine. 😬`);
    } else toast(`🍌 ${r.name} slipped on a banana peel! They can't work for a while.`);
  }

  // ---------- building ----------
  function ghostTile() {
    let dx = 0;
    let dy = 0;
    if (Math.abs(p.fx) > Math.abs(p.fy)) dx = Math.sign(p.fx);
    else dy = Math.sign(p.fy) || 1;
    return { x: Math.floor(p.x) + dx, y: Math.floor(p.y) + dy };
  }

  function canPlace(it: Item, x: number, y: number): string | null {
    if (!inLot(x, y)) return 'Build inside your lot (the fenced area west of town).';
    const i = idx(x, y);
    if (it.layer === 'floor') return null;
    if (objMap.has(i)) return 'Something is already there. Remove it first.';
    if (it.solid && Math.floor(p.x) === x && Math.floor(p.y) === y) return "You're standing there!";
    if (it.solid && walkers.some((k) => Math.floor(k.x) === x && Math.floor(k.y) === y)) return 'Someone is standing there!';
    if (it.id === 'money-box' && boxTile() >= 0) return 'You already have a money box.';
    if (save.bricks < it.bricks) return `You need ${it.bricks} 🧱 (you have ${save.bricks}). Buy bricks in the build menu.`;
    if (save.money < it.price) return `You need ${fmt(it.price)} for the ${it.name}.`;
    return null;
  }

  function placeItem() {
    const it = build.item;
    if (!it) return openBuildMenu();
    const g = ghostTile();
    const why = canPlace(it, g.x, g.y);
    if (why) {
      sfx.nope();
      toast(why);
      return;
    }
    const i = idx(g.x, g.y);
    if (it.layer === 'floor') {
      if (floorMap.get(i) === it.id) return;
      if (save.money < it.price) {
        sfx.nope();
        toast(`You need ${fmt(it.price)}.`);
        return;
      }
      floorMap.set(i, it.id);
    } else objMap.set(i, it.id);
    // step back if the new thing touches you
    if (it.solid) {
      const e = R + 0.01;
      if (p.y + R > g.y && p.y - R < g.y + 1) {
        if (p.x < g.x && p.x + R > g.x) p.x = g.x - e;
        if (p.x > g.x + 1 && p.x - R < g.x + 1) p.x = g.x + 1 + e;
      }
      if (p.x + R > g.x && p.x - R < g.x + 1) {
        if (p.y < g.y && p.y + R > g.y) p.y = g.y - e;
        if (p.y > g.y + 1 && p.y - R < g.y + 1) p.y = g.y + 1 + e;
      }
    }
    save.money -= it.price;
    save.bricks -= it.bricks;
    sfx.pick();
    syncLot();
    if (it.id === 'money-box') toast('💰 Money box placed! Customers pay into it. Walk up to it to collect.');
  }

  function removeItem() {
    const g = ghostTile();
    if (!inLot(g.x, g.y)) return;
    const i = idx(g.x, g.y);
    const id = objMap.get(i) ?? floorMap.get(i);
    if (!id) return;
    const it = ITEM_BY_ID[id];
    if (objMap.has(i)) objMap.delete(i);
    else floorMap.delete(i);
    if (it) {
      save.money += Math.floor(it.price / 2);
      save.bricks += it.bricks;
    }
    if (id === 'money-box' && save.box > 0) {
      save.money += save.box;
      addFloat(g.x + 0.5, g.y, `+${fmt(save.box)}`);
      save.box = 0;
    }
    sfx.rock();
    syncLot();
  }

  function setBuild(on: boolean) {
    build.on = on;
    el.classList.toggle('building', on);
    targetTimer = 0;
  }

  function buildBarLabel() {
    const it = build.item;
    const b = el.querySelector<HTMLButtonElement>('.jv-bb-item')!;
    b.innerHTML = it
      ? `<span class="ic">${it.icon}</span> ${it.name} · ${it.bricks ? `${it.bricks}🧱 (${save.bricks} left)` : fmt(it.price)} <small>change</small>`
      : '📦 Pick something';
  }

  function openBizSetup(then?: () => void) {
    openModal(
      `<h2>🏪 Your own shop!</h2>
      <p>Build a shop on your lot west of town. It can be any job you want!</p>
      <label class="jv-field">Shop name<input class="jv-in-name" maxlength="24" placeholder="Tim's Shop" value="${save.biz?.name ?? ''}"></label>
      <label class="jv-field">What kind of shop or job? (anything!)<input class="jv-in-kind" maxlength="20" placeholder="Bakery, Pet Shop, Hair Salon…" value="${save.biz?.kind ?? ''}"></label>
      <button class="jv-close big jv-ok">Save</button>`,
      (e) => {
        if (!(e.target as HTMLElement).closest('.jv-ok')) return;
        const name = modal.querySelector<HTMLInputElement>('.jv-in-name')!.value.trim() || 'My Shop';
        const kind = modal.querySelector<HTMLInputElement>('.jv-in-kind')!.value.trim() || 'Shop';
        save.biz = { name, kind };
        writeSave();
        closeModal();
        then?.();
      },
    );
    setTimeout(() => modal.querySelector<HTMLInputElement>('.jv-in-name')?.focus(), 50);
  }

  let buildCat: string = CATS[0];
  function openBuildMenu() {
    if (!save.biz) return openBizSetup(openBuildMenu);
    const tabs = [...CATS, 'Staff']
      .map((c) => `<button class="jv-tab ${c === buildCat ? 'on' : ''}" data-cat="${c}">${c === 'Staff' ? '👥' : CAT_ICON[c]} ${c}</button>`)
      .join('');
    let body = '';
    if (buildCat === 'Staff') {
      body = save.workers.length
        ? save.workers.map((w) => `<div class="jv-staff"><b>${w.name}</b> <span>${LEVEL_TITLES[w.level]} ${w.role}</span> <span class="pay">${fmt(w.wage)}/min</span><button data-talk="${w.id}">Talk</button></div>`).join('')
        : `<p class="sub">No workers yet. Put down a 💰 Money Box and people will come asking for a job with their diploma.</p>`;
    } else {
      body = `<div class="jv-items">${ITEMS.filter((i) => i.cat === buildCat)
        .map((i) => {
          const sw = i.layer === 'floor' ? `<span class="sw" style="background:${i.color}"></span>` : i.layer === 'wall' && i.color && i.id !== 'door' && i.id !== 'window' ? `<span class="sw" style="background:${i.color}"></span>` : `<span class="ic">${i.icon}</span>`;
          const cost = [i.bricks ? `${i.bricks}🧱` : '', i.price ? fmt(i.price) : ''].filter(Boolean).join(' + ') || 'free';
          return `<button class="jv-item ${build.item?.id === i.id ? 'on' : ''}" data-item="${i.id}">${sw}<b>${i.name}</b><small>${cost}</small></button>`;
        })
        .join('')}</div>`;
    }
    openModal(
      `<h2>🔨 ${save.biz.name}</h2>
      <p class="sub">${save.biz.kind} · <a href="#" class="jv-rename">✏️ rename</a> · ${ITEMS.length} things to build</p>
      <div class="jv-bricks">You have <b>${save.bricks} 🧱</b>
        <button data-bricks="10">Buy 10 🧱 $20</button><button data-bricks="50">Buy 50 🧱 $90</button></div>
      <div class="jv-tabs">${tabs}</div>
      ${body}
      <button class="jv-close">Close</button>`,
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('.jv-rename')) {
          e.preventDefault();
          return openBizSetup(openBuildMenu);
        }
        const cat = t.closest<HTMLElement>('[data-cat]');
        if (cat) {
          buildCat = cat.dataset.cat!;
          return openBuildMenu();
        }
        const br = t.closest<HTMLElement>('[data-bricks]');
        if (br) {
          const n = Number(br.dataset.bricks);
          const cost = n === 10 ? 20 : 90;
          if (save.money < cost) {
            sfx.nope();
            toast(`You need ${fmt(cost)} for ${n} bricks.`);
          } else {
            save.money -= cost;
            save.bricks += n;
            sfx.coin();
          }
          return openBuildMenu();
        }
        const talk = t.closest<HTMLElement>('[data-talk]');
        if (talk) {
          const w = save.workers.find((x) => x.id === Number(talk.dataset.talk));
          if (w) openWorker(w);
          return;
        }
        const itEl = t.closest<HTMLElement>('[data-item]');
        if (itEl) {
          build.item = ITEM_BY_ID[itEl.dataset.item!];
          setBuild(true);
          closeModal();
          if (scene === 'town' && !inLot(Math.floor(p.x), Math.floor(p.y)))
            toast(`Follow the arrow to your lot, then face a spot and press ${touchMode ? 'Place' : 'E'}.`);
          return;
        }
        if (t.closest('.jv-close')) closeModal();
      },
    );
  }

  function stars(n: number) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function openDiploma(k: Walker) {
    const a = k.app!;
    openModal(
      `<div class="jv-diploma">
        <div class="seal">🎓</div>
        <h3>DIPLOMA</h3>
        <p>This says that</p>
        <div class="who">${a.name}</div>
        <p>is great at being a</p>
        <div class="what">${a.role}</div>
        <p>Skill: <span class="stars">${stars(a.skill)}</span></p>
        <div class="want">I want to be paid <b>${fmt(a.wage)} a minute</b></div>
      </div>
      <div class="jv-row"><button class="jv-yes">✅ Hire ${a.name}</button><button class="jv-no">❌ No thanks</button></div>`,
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('.jv-yes')) {
          closeModal();
          hire(k, true);
        } else if (t.closest('.jv-no')) {
          closeModal();
          hire(k, false);
          toast(`${a.name} says "Okay, bye!"`);
        }
      },
    );
  }

  function openWorker(w: Worker) {
    const st = stationFor(w);
    const role = ROLES.find((r) => r.name === w.role);
    const needs = role ? role.needs.map((id) => ITEM_BY_ID[id]?.icon + ' ' + ITEM_BY_ID[id]?.name).join(' or ') : '';
    const roleBtns = [...ROLES.map((r) => `${r.icon} ${r.name}`)]
      .map((r, i) => `<button class="jv-role ${ROLES[i].name === w.role ? 'on' : ''}" data-role="${ROLES[i].name}">${r}</button>`)
      .join('');
    openModal(
      `<h2>${w.name}</h2>
      <p class="sub">${LEVEL_TITLES[w.level]} ${w.role} · Skill ${stars(w.skill)} · Level ${w.level}/5</p>
      <p>Paid <b>${fmt(w.wage)} a minute</b>. Earns your shop about <b>${fmt(workerRate(w) * payMult())} a minute</b>.</p>
      ${role ? `<p class="sub">${st.matched ? '✅ Has what they need to work.' : `⚠️ Works twice as well with a ${needs}.`}</p>` : ''}
      <div class="jv-row">
        <button class="jv-promote" ${w.level >= 5 ? 'disabled' : ''}>⬆ Promote (+$3/min pay, works 50% better)</button>
        <button class="jv-fire">👋 Fire</button>
      </div>
      <h3>Change job</h3>
      <div class="jv-roles">${roleBtns}</div>
      <div class="jv-row"><input class="jv-in-role" maxlength="24" placeholder="…or type any job"><button class="jv-setrole">Set</button></div>
      <button class="jv-close">Close</button>`,
      (e) => {
        const t = e.target as HTMLElement;
        const r = t.closest<HTMLElement>('[data-role]');
        if (t.closest('.jv-promote') && w.level < 5) {
          w.level++;
          w.wage += 3;
          sfx.buy();
          toast(`${w.name} is now a ${LEVEL_TITLES[w.level]} ${w.role}! 🎉`);
          openWorker(w);
        } else if (t.closest('.jv-fire')) {
          save.workers = save.workers.filter((x) => x !== w);
          pathsDirty = true;
          closeModal();
          toast(`${w.name} doesn't work for you anymore.`);
        } else if (r) {
          w.role = r.dataset.role!;
          pathsDirty = true;
          openWorker(w);
        } else if (t.closest('.jv-setrole')) {
          const v = modal.querySelector<HTMLInputElement>('.jv-in-role')!.value.trim();
          if (v) {
            w.role = v;
            pathsDirty = true;
            openWorker(w);
          }
        } else if (t.closest('.jv-close')) closeModal();
        writeSave();
      },
    );
  }

  function pickTrash(t: Trash) {
    const i = trash.indexOf(t);
    if (i < 0) return;
    trash.splice(i, 1);
    sfx.pick();
    earn(3, t.x, t.y - 0.3);
  }

  function updateTarget() {
    target = null;
    if (scene !== 'town') return;
    if (build.on) {
      if (!inLot(Math.floor(p.x), Math.floor(p.y))) target = { x: GATE.x + 0.5, y: GATE.y + 1 };
      return;
    }
    const job = save.job;
    if (!job) {
      target = { x: world.board.x + 1, y: world.board.y - 0.7 };
      return;
    }
    let best = Infinity;
    const consider = (x: number, y: number) => {
      const d = dist(p.x, p.y, x, y);
      if (d < best) {
        best = d;
        target = { x, y };
      }
    };
    if (job === 'mail' || job === 'pizza') {
      if (!carry.length) {
        const d = doorPt(world.byKind[job === 'mail' ? 'post' : 'pizza']!);
        target = d;
      } else for (const c of carry) consider(doorPt(c.house).x, doorPt(c.house).y);
    } else if (job === 'farmer') {
      for (const i of world.fields) if (ripe(i)) consider((i % W) + 0.5, ((i / W) | 0) + 0.5);
    } else if (job === 'lumberjack') {
      for (const i of world.forest) if (world.tiles[i] === T.Tree && i % W < 44) consider((i % W) + 0.5, ((i / W) | 0) + 0.5);
    } else if (job === 'miner') {
      for (const i of world.rocks) if (world.tiles[i] === T.Rock) consider((i % W) + 0.5, ((i / W) | 0) + 0.5);
    } else if (job === 'sweeper') {
      for (const t of trash) consider(t.x, t.y);
    } else if (job === 'fisher') {
      if (!nearWater()) target = { x: world.dock.x + 1, y: world.dock.y + 0.5 };
    }
  }

  // ---------- shop ----------
  function enterShop() {
    townReturn = { x: p.x, y: p.y + 0.4 };
    scene = 'shop';
    p.x = SHOP_DOOR.x + 0.5;
    p.y = SH - 1.6;
    pet.x = p.x;
    pet.y = p.y + 0.5;
    fishing = null;
    sfx.door();
    toast('Welcome to the shop! Walk up to a podium to buy.');
  }

  function leaveShop() {
    scene = 'town';
    p.x = townReturn.x;
    p.y = townReturn.y;
    pet.x = p.x;
    pet.y = p.y + 0.6;
    sfx.door();
    targetTimer = 0;
  }

  function buy(id: UpgradeId) {
    const up = UPGRADE_BY_ID[id];
    const t = tier(id);
    const it = up.tiers[t];
    if (!it || save.money < it.price) return;
    save.money -= it.price;
    save.up[id] = t + 1;
    sfx.buy();
    toast(`You got the ${it.name}! ${it.desc}.`);
    const pd = PODIUMS.find((x) => x.id === id)!;
    for (let i = 0; i < 40; i++) confettiBurst(pd.x, pd.y);
    writeSave();
    if (id === 'trophy') {
      save.won = true;
      sfx.win();
      setTimeout(showWin, 600);
    }
  }

  function confettiBurst(x: number, y: number) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 3;
    confetti.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, c: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], r: 1 });
  }

  // ---------- modals ----------
  let paused = false;
  function openModal(html: string, onClick?: (e: MouseEvent) => void) {
    modal.innerHTML = `<div class="jv-card">${html}</div>`;
    modal.classList.remove('hidden');
    paused = true;
    actHeld = false;
    keys.clear();
    modal.onclick = (e) => {
      if (e.target === modal) return closeModal();
      onClick?.(e);
    };
  }
  function closeModal() {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    paused = false;
    el.focus();
  }

  function openBoard() {
    const rows = JOBS.map((j) => {
      const locked = save.earned < j.unlock;
      const mine = save.job === j.id;
      const btn = mine
        ? `<span class="jv-tag">Your job</span>`
        : locked
          ? `<span class="jv-lock">🔒 Earn ${fmt(j.unlock)} total</span>`
          : `<button class="jv-take" data-job="${j.id}">Take job</button>`;
      return `<div class="jv-jobrow ${locked ? 'locked' : ''} ${mine ? 'mine' : ''}">
        <div class="jv-jicon">${j.icon}</div>
        <div class="jv-jtext"><b>${j.name}</b><span class="pay">${j.pay}</span><small>${j.how}</small></div>
        ${btn}</div>`;
    }).join('');
    openModal(
      `<h2>📋 Job Board</h2><p class="sub">Pick a job. You can switch any time. You've earned ${fmt(save.earned)} so far.</p>
      <div class="jv-jobs">${rows}</div>
      <button class="jv-close">Close</button>`,
      (e) => {
        const t = e.target as HTMLElement;
        const take = t.closest<HTMLElement>('[data-job]');
        if (take) {
          const id = take.dataset.job as JobId;
          save.job = id;
          carry = [];
          fishing = null;
          sfx.job();
          closeModal();
          toast(`You're a ${JOB_BY_ID[id].name} now! ${JOB_BY_ID[id].how} Follow the yellow arrow.`);
          targetTimer = 0;
          writeSave();
        } else if (t.closest('.jv-close')) closeModal();
      },
    );
  }

  function openMenu() {
    openModal(
      `<h2>⏸ Paused</h2>
      <div class="jv-menu">
        <button data-m="resume">▶ Keep playing</button>
        <button data-m="sound">${isMuted() ? '🔇 Sound: off' : '🔊 Sound: on'}</button>
        <button data-m="shirt">👕 Change shirt color</button>
        <button data-m="home">🏠 Back to the town square</button>
        <button data-m="exit">🚪 Back to games</button>
        <button data-m="reset" class="danger">🗑 Start over</button>
      </div>
      <p class="sub">Jobs done: ${JOBS.map((j) => `${j.icon} ${save.count[j.id] ?? 0}`).join(' · ')}</p>`,
      (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-m]');
        if (!b) return;
        const m = b.dataset.m;
        if (m === 'resume') closeModal();
        else if (m === 'sound') {
          setMuted(!isMuted());
          save.muted = isMuted();
          b.textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on';
        } else if (m === 'shirt') {
          save.shirt = SHIRTS[(SHIRTS.indexOf(save.shirt) + 1) % SHIRTS.length];
        } else if (m === 'home') {
          if (scene === 'shop') leaveShop();
          p.x = startX;
          p.y = startY;
          fishing = null;
          closeModal();
        } else if (m === 'exit') {
          writeSave();
          opts.onExit();
        } else if (m === 'reset') {
          if (b.dataset.sure) {
            try {
              localStorage.removeItem(SAVE_KEY);
            } catch {
              /* ignore */
            }
            save = loadSave();
            save.x = p.x = startX;
            save.y = p.y = startY;
            scene = 'town';
            carry = [];
            fishing = null;
            objMap.clear();
            floorMap.clear();
            walkers = [];
            pathsDirty = true;
            setBuild(false);
            closeModal();
            showIntro();
          } else {
            b.dataset.sure = '1';
            b.textContent = '🗑 Tap again to start over';
          }
        }
      },
    );
  }

  function openMap() {
    openModal(
      `<h2>🗺️ Jobville</h2><div class="jv-bigmap"><canvas width="540" height="540"></canvas></div><button class="jv-close">Close</button>`,
      (e) => {
        if ((e.target as HTMLElement).closest('.jv-close')) closeModal();
      },
    );
    const c = modal.querySelector('canvas')!;
    const cg = c.getContext('2d')!;
    cg.imageSmoothingEnabled = false;
    cg.drawImage(mapImg, 0, 0, 540, 540);
    const s = 540 / W;
    cg.font = 'bold 15px system-ui, sans-serif';
    cg.textAlign = 'center';
    const label = (text: string, x: number, y: number) => {
      cg.lineWidth = 4;
      cg.strokeStyle = 'rgba(0,0,0,.7)';
      cg.strokeText(text, x * s, y * s);
      cg.fillStyle = '#fff';
      cg.fillText(text, x * s, y * s);
    };
    label('🌲 Forest', 20, 60);
    label('⛏️ Quarry', 93, 30);
    label('🌾 Farms', 160, 26 + 4);
    label('🎣 Pond', 128, 160);
    label(save.biz ? `🏪 ${save.biz.name}` : '🔨 Your Lot', LOT.x + LOT.w / 2, LOT.y + LOT.h / 2);
    label('📋 Jobs', world.board.x + 1, world.board.y + 4);
    const named: [string, Building | undefined][] = [
      ['🛒 Shop', world.byKind.shop],
      ['✉️ Post Office', world.byKind.post],
      ['🍕 Pizza', world.byKind.pizza],
    ];
    for (const [t, b] of named) if (b) label(t, b.x + b.w / 2, b.y + b.h / 2 + 1);
    if (target) {
      cg.fillStyle = '#ffe14d';
      cg.beginPath();
      cg.arc(target.x * s, target.y * s, 7, 0, 7);
      cg.fill();
    }
    const px = (scene === 'town' ? p.x : townReturn.x) * s;
    const py = (scene === 'town' ? p.y : townReturn.y) * s;
    cg.fillStyle = save.shirt;
    cg.strokeStyle = '#fff';
    cg.lineWidth = 3;
    cg.beginPath();
    cg.arc(px, py, 8, 0, 7);
    cg.fill();
    cg.stroke();
  }

  function showIntro() {
    openModal(
      `<h2>Welcome to Jobville! 🏘️</h2>
      <p>This village is HUGE. Here's how it works:</p>
      <ol class="jv-steps">
        <li>📋 Walk to the <b>job board</b> in the town square and pick a job.</li>
        <li>💲 Do your job to earn money. Follow the <b>yellow arrow</b>.</li>
        <li>🛒 Spend it in the <b>shop</b>. Upgrades sit on podiums.</li>
        <li>🏆 Save up for the Golden Trophy!</li>
      </ol>
      <p class="sub">${touchMode ? 'Drag on the left side to walk. Tap the big button to do things.' : 'Arrow keys or WASD to walk. E or Space to do things. M for the map.'}</p>
      <button class="jv-close big">Let's go!</button>`,
      (e) => {
        if ((e.target as HTMLElement).closest('.jv-close')) {
          save.intro = true;
          closeModal();
        }
      },
    );
  }

  function showWin() {
    openModal(
      `<h2>🏆 You won Jobville! 🏆</h2>
      <p>You bought the Golden Trophy! A golden statue of you now stands in the town square.</p>
      <p class="sub">You earned ${fmt(save.earned)} in all. Keep playing as long as you like.</p>
      <button class="jv-close big">Yay!</button>`,
      (e) => {
        if ((e.target as HTMLElement).closest('.jv-close')) closeModal();
      },
    );
  }

  // ---------- map image ----------
  const mapImg = document.createElement('canvas');
  mapImg.width = W;
  mapImg.height = H;
  function drawMapImg() {
    const mctx = mapImg.getContext('2d')!;
    const img = mctx.createImageData(W, H);
    const col: Record<number, [number, number, number]> = {
      [T.Grass]: [124, 195, 91],
      [T.Flowers]: [124, 195, 91],
      [T.Road]: [214, 196, 160],
      [T.Path]: [214, 196, 160],
      [T.Plaza]: [235, 228, 212],
      [T.Water]: [74, 163, 223],
      [T.Sand]: [236, 217, 160],
      [T.Field]: [170, 120, 60],
      [T.Tree]: [46, 120, 52],
      [T.Stump]: [100, 160, 80],
      [T.Building]: [190, 80, 70],
      [T.Rock]: [120, 115, 110],
      [T.Quarry]: [165, 155, 140],
      [T.Hedge]: [30, 90, 40],
      [T.Board]: [140, 90, 40],
      [T.Dock]: [160, 112, 63],
      [T.Lot]: [207, 177, 132],
      [T.Fence]: [184, 135, 79],
    };
    for (let i = 0; i < W * H; i++) {
      const c = col[world.tiles[i]] ?? [0, 0, 0];
      const o = world.owner[i];
      const rc = o >= 0 ? hexRgb(world.buildings[o].roof) : c;
      img.data[i * 4] = rc[0];
      img.data[i * 4 + 1] = rc[1];
      img.data[i * 4 + 2] = rc[2];
      img.data[i * 4 + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
  }
  drawMapImg();

  // ---------- input ----------
  const keys = new Set<string>();
  const joy = { id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };

  function press() {
    if (paused) return;
    if (!action || action.disabled) {
      action?.run();
      return;
    }
    action.run();
    actCool = 0.22;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (paused) {
      if (k === 'escape') closeModal();
      return;
    }
    if (touchMode) setTouch(false);
    if (k === 'e' || k === ' ' || k === 'enter') {
      if (!e.repeat) press();
      actHeld = true;
    } else if (k === 'b') openBuildMenu();
    else if ((k === 'x' || k === 'delete' || k === 'backspace') && build.on) removeItem();
    else if (k === 'escape' && build.on) setBuild(false);
    else if (k === 'escape' || k === 'p') openMenu();
    else if (k === 'm') openMap();
    else keys.add(k);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (k === 'e' || k === ' ' || k === 'enter') actHeld = false;
  };
  const onBlur = () => {
    keys.clear();
    actHeld = false;
  };

  function setTouch(on: boolean) {
    touchMode = on;
    el.classList.toggle('touch', on);
  }
  setTouch(touchMode);

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !touchMode) setTouch(true);
    if (!touchMode || paused) return;
    if (joy.id === -1 && e.clientX < innerWidth * 0.6) {
      joy.id = e.pointerId;
      joy.ox = e.clientX;
      joy.oy = e.clientY;
      joy.dx = joy.dy = 0;
      stick.style.left = `${e.clientX}px`;
      stick.style.top = `${e.clientY}px`;
      stick.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    } else if (e.clientX >= innerWidth * 0.6) press();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox;
    let dy = e.clientY - joy.oy;
    const len = Math.hypot(dx, dy);
    const max = 50;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    joy.dx = dx / max;
    joy.dy = dy / max;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const endJoy = (e: PointerEvent) => {
    if (e.pointerId !== joy.id) return;
    joy.id = -1;
    joy.dx = joy.dy = 0;
    stick.classList.remove('on');
  };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);

  actBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press();
    actHeld = true;
  });
  const actUp = () => (actHeld = false);
  actBtn.addEventListener('pointerup', actUp);
  actBtn.addEventListener('pointercancel', actUp);
  actBtn.addEventListener('pointerleave', actUp);

  el.querySelector('[data-b="map"]')!.addEventListener('click', openMap);
  el.querySelector('[data-b="build"]')!.addEventListener('click', openBuildMenu);
  el.querySelector('.jv-buildbar')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bb]');
    if (!b) return;
    const what = b.dataset.bb;
    if (what === 'menu') openBuildMenu();
    else if (what === 'place') placeItem();
    else if (what === 'remove') removeItem();
    else if (what === 'done') setBuild(false);
  });
  el.querySelector('[data-b="menu"]')!.addEventListener('click', openMenu);
  mini.addEventListener('click', openMap);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // ---------- update ----------
  function update(dt: number) {
    now += dt;
    let ix = 0;
    let iy = 0;
    if (keys.has('arrowleft') || keys.has('a')) ix -= 1;
    if (keys.has('arrowright') || keys.has('d')) ix += 1;
    if (keys.has('arrowup') || keys.has('w')) iy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) iy += 1;
    if (joy.id !== -1) {
      ix = joy.dx;
      iy = joy.dy;
    }
    let len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
      len = 1;
    }
    if (len < 0.15) len = 0;
    p.moving = len > 0;
    if (p.moving) {
      p.fx = ix;
      p.fy = iy;
      const sp = speed() * len * dt;
      const mx = ix * speed() * dt;
      const my = iy * speed() * dt;
      // sub-steps so fast upgrades never skip through walls
      const steps = Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 0.2) || 1;
      const stuck = blocked(p.x, p.y);
      for (let s = 0; s < steps; s++) {
        if (stuck || !blocked(p.x + mx / steps, p.y)) p.x += mx / steps;
        if (stuck || !blocked(p.x, p.y + my / steps)) p.y += my / steps;
      }
      p.walk += sp * 2.2;
      if (fishing && dist(p.x, p.y, fishing.x, fishing.y) > 0.4) fishing = null;
    }

    // pet follows
    const pd = dist(pet.x, pet.y, p.x, p.y);
    if (pd > 1.2) {
      const k = Math.min(1, (pd - 1.2) * dt * 4);
      pet.x += (p.x - pet.x) * k;
      pet.y += (p.y - pet.y) * k;
    }
    if (pd > 8) {
      pet.x = p.x;
      pet.y = p.y;
    }

    for (const n of npcs) stepNpc(n, dt);
    for (const r of rivals) stepRival(r, dt);
    updateBusiness(dt);

    // trash comes back
    trashT -= dt;
    if (trashT <= 0) {
      trashT = 1.5 * regrowMult();
      if (trash.length < 70) spawnTrash();
    }
    if (Math.floor(now * 2) !== Math.floor((now - dt) * 2)) updateRegrow();

    // magnet
    const mag = magnet();
    if (mag && scene === 'town') {
      if (save.job === 'sweeper')
        for (const t of [...trash]) if (dist(p.x, p.y, t.x, t.y) < mag) pickTrash(t);
      if (save.job === 'farmer') {
        for (let y = Math.floor(p.y - mag); y <= Math.floor(p.y + mag); y++)
          for (let x = Math.floor(p.x - mag); x <= Math.floor(p.x + mag); x++)
            if (inMap(x, y) && ripe(idx(x, y)) && dist(p.x, p.y, x + 0.5, y + 0.5) < mag) harvest(idx(x, y));
      }
    }
    // sweepers grab trash they walk right over
    if (save.job === 'sweeper' && scene === 'town')
      for (const t of [...trash]) if (dist(p.x, p.y, t.x, t.y) < 0.5) pickTrash(t);

    // fishing
    if (fishing) {
      fishing.t -= dt;
      if (fishing.t <= 0) {
        if (fishing.phase === 'wait') {
          fishing.phase = 'bite';
          fishing.t = [1.0, 1.3, 1.6][tier('rod')];
          sfx.bite();
        } else {
          fishing.phase = 'wait';
          fishing.t = biteWait();
          addFloat(p.x, p.y - 0.8, 'It got away!', '#fff');
        }
      }
    }

    // pizzas going cold warning
    for (const c of carry)
      if (c.kind === 'pizza' && c.due - now < 10 && c.due - now > 10 - dt) toast('Hurry! A pizza is getting cold! 🍕');

    actCool -= dt;
    action = findAction();
    if (actHeld && action?.repeat && actCool <= 0) {
      action.run();
      actCool = 0.24;
    }

    targetTimer -= dt;
    if (targetTimer <= 0) {
      updateTarget();
      targetTimer = 0.4;
    }

    for (const f of floats) {
      f.t -= dt;
      f.y -= dt * 0.9;
    }
    while (floats.length && floats[0].t <= 0) floats.shift();
    for (const c of confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 6 * dt;
      c.r -= dt * 0.6;
    }
    confetti = confetti.filter((c) => c.r > 0);

    toastT -= dt;
    if (toastT <= 0) toastEl.classList.remove('show');

    saveT -= dt;
    if (saveT <= 0) {
      writeSave();
      saveT = 4;
    }
  }

  function writeSave() {
    if (scene === 'town') {
      save.x = p.x;
      save.y = p.y;
    } else {
      save.x = townReturn.x;
      save.y = townReturn.y;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      /* storage full or blocked */
    }
  }

  // ---------- render ----------
  let ts = 40;
  let vw = 0;
  let vh = 0;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = el.clientWidth;
    vh = el.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    ts = Math.min(vw, vh) < 560 ? 32 : 42;
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  function render() {
    g.clearRect(0, 0, vw, vh);
    if (scene === 'town') renderTown();
    else renderShop();
    renderHud();
  }

  function camera() {
    let cx = p.x * ts - vw / 2;
    let cy = p.y * ts - vh / 2;
    if (scene === 'town') {
      cx = Math.max(0, Math.min(W * ts - vw, cx));
      cy = Math.max(0, Math.min(H * ts - vh, cy));
    } else {
      cx = (SW * ts - vw) / 2;
      cy = (SH * ts - vh) / 2;
      if (SW * ts > vw) cx = Math.max(0, Math.min(SW * ts - vw, p.x * ts - vw / 2));
      if (SH * ts > vh) cy = Math.max(0, Math.min(SH * ts - vh, p.y * ts - vh / 2));
    }
    return { cx: Math.round(cx), cy: Math.round(cy) };
  }

  function circle(x: number, y: number, r: number, fill: string) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function emoji(ch: string, x: number, y: number, size: number) {
    g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, x, y);
  }

  function renderTown() {
    const { cx, cy } = camera();
    const x0 = Math.max(0, Math.floor(cx / ts) - 1);
    const y0 = Math.max(0, Math.floor(cy / ts) - 1);
    const x1 = Math.min(W - 1, Math.ceil((cx + vw) / ts) + 1);
    const y1 = Math.min(H - 1, Math.ceil((cy + vh) / ts) + 1);
    g.save();
    g.translate(-cx, -cy);

    // ground
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = world.tiles[idx(x, y)];
        const sx = x * ts;
        const sy = y * ts;
        const h = hash(x, y);
        switch (t) {
          case T.Road:
            g.fillStyle = h < 0.5 ? '#cdb994' : '#c9b48e';
            g.fillRect(sx, sy, ts, ts);
            break;
          case T.Path:
            g.fillStyle = '#dccba3';
            g.fillRect(sx, sy, ts, ts);
            break;
          case T.Plaza:
          case T.Board:
            g.fillStyle = (x + y) % 2 ? '#e6dfcf' : '#ddd5c3';
            g.fillRect(sx, sy, ts, ts);
            break;
          case T.Water: {
            g.fillStyle = '#4aa3df';
            g.fillRect(sx, sy, ts, ts);
            g.strokeStyle = 'rgba(255,255,255,.35)';
            g.lineWidth = 2;
            const o = Math.sin(now * 1.5 + x * 0.7 + y * 1.3) * ts * 0.12;
            g.beginPath();
            g.moveTo(sx + ts * 0.2 + o, sy + ts * (0.3 + h * 0.4));
            g.lineTo(sx + ts * 0.55 + o, sy + ts * (0.3 + h * 0.4));
            g.stroke();
            break;
          }
          case T.Sand:
            g.fillStyle = h < 0.5 ? '#efdca6' : '#ead69c';
            g.fillRect(sx, sy, ts, ts);
            break;
          case T.Field:
            g.fillStyle = '#8a5a33';
            g.fillRect(sx, sy, ts, ts);
            g.fillStyle = '#7a4d2a';
            g.fillRect(sx, sy + ts * 0.25, ts, ts * 0.12);
            g.fillRect(sx, sy + ts * 0.7, ts, ts * 0.12);
            break;
          case T.Quarry:
          case T.Rock:
            g.fillStyle = h < 0.5 ? '#aaa091' : '#a39989';
            g.fillRect(sx, sy, ts, ts);
            break;
          case T.Dock:
            g.fillStyle = '#4aa3df';
            g.fillRect(sx, sy, ts, ts);
            g.fillStyle = '#a8763f';
            g.fillRect(sx, sy, ts, ts);
            g.fillStyle = '#8e6232';
            for (let k = 1; k < 4; k++) g.fillRect(sx, sy + (k * ts) / 4, ts, 2);
            break;
          case T.Lot: {
            const fl = floorMap.get(idx(x, y));
            const fi = fl ? ITEM_BY_ID[fl] : null;
            if (fi) {
              g.fillStyle = fi.id === 'checker-floor' ? ((x + y) % 2 ? '#222' : '#eee') : fi.color!;
              g.fillRect(sx, sy, ts, ts);
              g.strokeStyle = 'rgba(0,0,0,.12)';
              g.lineWidth = 1;
              g.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
            } else {
              g.fillStyle = h < 0.5 ? '#cfb184' : '#c9aa7c';
              g.fillRect(sx, sy, ts, ts);
            }
            break;
          }
          case T.Building:
            g.fillStyle = world.owner[idx(x, y)] >= 0 ? '#7cc35b' : '#e6dfcf';
            g.fillRect(sx, sy, ts, ts);
            break;
          default:
            g.fillStyle = h < 0.5 ? '#7cc35b' : '#77bd56';
            g.fillRect(sx, sy, ts, ts);
            if (t === T.Flowers) {
              const fc = ['#ff6b8a', '#ffd93b', '#ffffff', '#b08cff'][Math.floor(h * 4)];
              for (let k = 0; k < 3; k++) circle(sx + ts * (0.2 + ((h * 7 + k * 0.31) % 0.6)), sy + ts * (0.25 + ((h * 13 + k * 0.27) % 0.55)), ts * 0.08, fc);
            } else if (h > 0.85) {
              g.fillStyle = '#69ad49';
              g.fillRect(sx + ts * h * 0.6, sy + ts * 0.5, 2, ts * 0.15);
            }
        }
      }

    // crops, trash, objects
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        const t = world.tiles[i];
        const sx = x * ts;
        const sy = y * ts;
        if (t === T.Field) drawCrop(i, sx, sy);
        else if (t === T.Tree) drawTree(sx, sy, hash(x, y), world.hits[i]);
        else if (t === T.Hedge) {
          circle(sx + ts / 2, sy + ts / 2, ts * 0.62, '#2f6f35');
          circle(sx + ts * 0.4, sy + ts * 0.4, ts * 0.3, '#3d8a43');
        } else if (t === T.Stump) {
          circle(sx + ts / 2, sy + ts / 2, ts * 0.22, '#8b5a2b');
          circle(sx + ts / 2, sy + ts / 2, ts * 0.14, '#c49a63');
        } else if (t === T.Rock) drawRock(sx, sy, hash(x, y), world.hits[i]);
        else if (t === T.Fence) drawFence(sx, sy, x, y);
        else if (t === T.Lot) {
          const id = objMap.get(i);
          if (id) drawPlaced(ITEM_BY_ID[id], sx, sy, x, y);
        }
      }
    drawLotSign();
    if (build.on) drawGhost();

    for (const t of trash)
      if (t.x > x0 - 1 && t.x < x1 + 1 && t.y > y0 - 1 && t.y < y1 + 1) {
        circle(t.x * ts, t.y * ts + ts * 0.12, ts * 0.2, 'rgba(0,0,0,.15)');
        emoji(t.icon, t.x * ts, t.y * ts, ts * 0.46);
      }

    for (const b of world.buildings) {
      if (b.x + b.w < x0 - 1 || b.x > x1 + 1 || b.y + b.h < y0 - 2 || b.y > y1 + 1) continue;
      drawBuilding(b);
    }
    drawBoard();
    drawFountain();

    // fishing line
    if (fishing) {
      const bob = Math.sin(now * 4) * 2 + (fishing.phase === 'bite' ? Math.sin(now * 30) * 4 : 0);
      g.strokeStyle = 'rgba(255,255,255,.8)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(p.x * ts + ts * 0.3, p.y * ts - ts * 0.3);
      g.lineTo(fishing.bx * ts, fishing.by * ts + bob);
      g.stroke();
      circle(fishing.bx * ts, fishing.by * ts + bob, ts * 0.1, '#ff4d4d');
      circle(fishing.bx * ts, fishing.by * ts + bob - ts * 0.05, ts * 0.05, '#fff');
      if (fishing.phase === 'bite') {
        g.fillStyle = '#ffe14d';
        g.font = `bold ${ts * 0.9}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText('!', p.x * ts, p.y * ts - ts * 1.1);
      }
    }

    // people
    for (const n of npcs) {
      if (n.x < x0 - 1 || n.x > x1 + 1 || n.y < y0 - 1 || n.y > y1 + 1) continue;
      drawPerson(n.x, n.y, n.shirt, n.skin, n.hair, (n.x + n.y) * 3, true);
      if (n.sayT > 0) bubble(n.x * ts, n.y * ts - ts * 0.75, n.say);
    }
    for (const k of walkers) {
      if (k.x < x0 - 1 || k.x > x1 + 1 || k.y < y0 - 1 || k.y > y1 + 1) continue;
      drawPerson(k.x, k.y, k.shirt, k.skin, k.hair, (k.x + k.y) * 4, k.path.length > 0);
      if (k.kind === 'applicant') emoji('📜', k.x * ts, k.y * ts - ts * (0.95 + Math.abs(Math.sin(now * 4)) * 0.15), ts * 0.45);
      else if (k.kind === 'customer' && k.state === 'stay' && k.item) bubble(k.x * ts, k.y * ts - ts * 0.7, ITEM_BY_ID[k.item]?.icon ?? '🙂');
      else if (k.kind === 'worker') {
        const w = save.workers.find((x) => x.id === k.wid);
        if (w) nameTag(k.x, k.y, `${ROLES.find((r) => r.name === w.role)?.icon ?? '⭐'} ${w.name}`, '#2e9d5a');
      }
    }
    for (const r of rivals) {
      if (r.x < x0 - 1 || r.x > x1 + 1 || r.y < y0 - 1 || r.y > y1 + 1) continue;
      drawPerson(r.x, r.y, r.shirt, '#e0ac69', '#111', now * 8, r.dizzy <= 0 && dist(r.x, r.y, r.tx, r.ty) > 0.6);
      emoji(r.dizzy > 0 ? '🍌' : RIVAL_TOOL[r.job], r.x * ts + ts * 0.3, r.y * ts - ts * 0.05, ts * 0.32);
      nameTag(r.x, r.y, `${r.name} (rival)`, '#c0392b');
      if (r.dizzy > 0)
        for (let k = 0; k < 3; k++) {
          const a = now * 5 + (k * Math.PI * 2) / 3;
          emoji('⭐', r.x * ts + Math.cos(a) * ts * 0.3, r.y * ts - ts * 0.75 + Math.sin(a) * ts * 0.1, ts * 0.22);
        }
      if (r.sayT > 0) bubble(r.x * ts, r.y * ts - ts * 1.25, r.say);
    }
    drawPet();
    drawPlayer();
    if (save.won) drawStatue();

    drawWorldFx();
    g.restore();
    drawArrow(cx, cy);
  }

  function nameTag(x: number, y: number, text: string, color: string) {
    g.font = `bold ${Math.round(ts * 0.24)}px system-ui, sans-serif`;
    const w = g.measureText(text).width + 8;
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.roundRect(x * ts - w / 2, y * ts - ts * 0.98, w, ts * 0.3, 5);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x * ts, y * ts - ts * 0.83);
  }

  function drawFence(sx: number, sy: number, x: number, y: number) {
    g.fillStyle = '#b8874f';
    const horiz = y === LOT.y - 1 || y === LOT.y + LOT.h;
    if (horiz) {
      g.fillRect(sx, sy + ts * 0.35, ts, ts * 0.1);
      g.fillRect(sx, sy + ts * 0.6, ts, ts * 0.1);
    } else {
      g.fillRect(sx + ts * 0.35, sy, ts * 0.1, ts);
      g.fillRect(sx + ts * 0.6, sy, ts * 0.1, ts);
    }
    g.fillStyle = '#8a5f32';
    g.fillRect(sx + ts * 0.4, sy + ts * 0.25, ts * 0.2, ts * 0.5);
    void x;
  }

  function drawPlaced(it: Item | undefined, sx: number, sy: number, x: number, y: number) {
    if (!it) return;
    if (it.layer === 'wall') {
      if (it.id === 'door') {
        g.fillStyle = '#7a4a26';
        g.fillRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.8);
        g.fillStyle = '#a0683a';
        g.fillRect(sx + ts * 0.18, sy + ts * 0.18, ts * 0.64, ts * 0.64);
        circle(sx + ts * 0.7, sy + ts * 0.5, ts * 0.06, '#ffd54f');
        return;
      }
      g.fillStyle = it.color!;
      g.fillRect(sx, sy, ts, ts);
      if (it.id === 'window') {
        g.strokeStyle = '#fff';
        g.lineWidth = 3;
        g.strokeRect(sx + 3, sy + 3, ts - 6, ts - 6);
        g.beginPath();
        g.moveTo(sx + ts / 2, sy + 3);
        g.lineTo(sx + ts / 2, sy + ts - 3);
        g.stroke();
        return;
      }
      if (it.id === 'fence') {
        g.fillStyle = '#7cc35b';
        g.fillRect(sx, sy, ts, ts);
        g.fillStyle = it.color!;
        g.fillRect(sx, sy + ts * 0.4, ts, ts * 0.2);
        g.fillRect(sx + ts * 0.4, sy + ts * 0.15, ts * 0.2, ts * 0.7);
        return;
      }
      // bricks
      g.strokeStyle = 'rgba(0,0,0,.22)';
      g.lineWidth = 1;
      for (let r = 0; r < 4; r++) {
        const yy = sy + (r * ts) / 4;
        g.beginPath();
        g.moveTo(sx, yy);
        g.lineTo(sx + ts, yy);
        g.stroke();
        const off = r % 2 ? ts / 4 : 0;
        for (let c = off; c < ts; c += ts / 2) {
          g.beginPath();
          g.moveTo(sx + c, yy);
          g.lineTo(sx + c, yy + ts / 4);
          g.stroke();
        }
      }
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.fillRect(sx, sy, ts, ts * 0.12);
      return;
    }
    // objects
    g.fillStyle = 'rgba(0,0,0,.15)';
    g.beginPath();
    g.ellipse(sx + ts / 2, sy + ts * 0.78, ts * 0.36, ts * 0.12, 0, 0, 7);
    g.fill();
    if (it.cat === 'Shop' || it.cat === 'Kitchen') {
      g.fillStyle = it.id === 'counter' ? '#8b5a2b' : 'rgba(255,255,255,.55)';
      g.beginPath();
      g.roundRect(sx + ts * 0.08, sy + ts * 0.12, ts * 0.84, ts * 0.76, 6);
      g.fill();
    }
    if (it.id !== 'counter') emoji(it.icon, sx + ts / 2, sy + ts * 0.48, ts * 0.66);
    if (it.id === 'money-box' && save.box > 0) {
      const a = now * 4 + x + y;
      emoji('✨', sx + ts / 2 + Math.cos(a) * ts * 0.35, sy + ts * 0.3 + Math.sin(a) * ts * 0.2, ts * 0.3);
    }
  }

  function drawLotSign() {
    const cx = (LOT.x + LOT.w / 2) * ts;
    const cy = (LOT.y - 1.9) * ts;
    const text = save.biz ? `${save.biz.name} · ${save.biz.kind}` : 'YOUR LOT · tap 🔨 to build';
    g.font = `900 ${Math.round(ts * 0.42)}px system-ui, sans-serif`;
    const w = g.measureText(text).width + 24;
    g.fillStyle = '#6d4424';
    g.fillRect(cx - w / 2 + 10, cy, 6, ts * 1.1);
    g.fillRect(cx + w / 2 - 16, cy, 6, ts * 1.1);
    g.fillStyle = '#fff3d6';
    g.strokeStyle = '#6d4424';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(cx - w / 2, cy - ts * 0.4, w, ts * 0.8, 10);
    g.fill();
    g.stroke();
    g.fillStyle = '#7a3f12';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, cx, cy + 1);
  }

  function drawGhost() {
    const gt = ghostTile();
    const it = build.item;
    const ok = it ? !canPlace(it, gt.x, gt.y) : false;
    const sx = gt.x * ts;
    const sy = gt.y * ts;
    if (it && ok) {
      g.globalAlpha = 0.55;
      if (it.layer === 'object') emoji(it.icon, sx + ts / 2, sy + ts / 2, ts * 0.66);
      else {
        g.fillStyle = it.color ?? '#fff';
        g.fillRect(sx, sy, ts, ts);
      }
      g.globalAlpha = 1;
    }
    g.strokeStyle = ok ? '#57ff8c' : '#ff5b5b';
    g.lineWidth = 3;
    g.setLineDash([6, 4]);
    g.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4);
    g.setLineDash([]);
  }

  function drawWorldFx() {
    for (const c of confetti) {
      g.fillStyle = c.c;
      g.fillRect(c.x * ts, c.y * ts, ts * 0.12 * c.r + 2, ts * 0.12 * c.r + 2);
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.t * 1.5);
      g.font = `bold ${Math.round(ts * 0.42)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,.6)';
      g.strokeText(f.text, f.x * ts, f.y * ts);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x * ts, f.y * ts);
    }
    g.globalAlpha = 1;
  }

  function bubble(x: number, y: number, text: string) {
    g.font = `bold ${Math.round(ts * 0.3)}px system-ui, sans-serif`;
    const w = g.measureText(text).width + 12;
    const h = ts * 0.45;
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath();
    g.roundRect(x - w / 2, y - h, w, h, 6);
    g.fill();
    g.fillStyle = '#333';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x, y - h / 2);
  }

  function drawCrop(i: number, sx: number, sy: number) {
    const left = world.regrow[i] - now;
    const grow = left <= 0 ? 1 : Math.max(0, 1 - left / CROP_TIME);
    const kind = Math.floor(hash(i % 97, (i / W) | 0) * 3);
    const cx = sx + ts / 2;
    const cy = sy + ts / 2;
    if (grow < 1) {
      const s = 0.1 + grow * 0.2;
      circle(cx, cy, ts * s, '#5fae3e');
      return;
    }
    const wob = Math.sin(now * 2 + i) * ts * 0.03;
    if (kind === 0) {
      // wheat
      g.strokeStyle = '#c9962e';
      g.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(cx + k * ts * 0.18, cy + ts * 0.35);
        g.lineTo(cx + k * ts * 0.18 + wob, cy - ts * 0.2);
        g.stroke();
        circle(cx + k * ts * 0.18 + wob, cy - ts * 0.22, ts * 0.09, '#f2c94c');
      }
    } else if (kind === 1) {
      // carrot
      circle(cx, cy + ts * 0.12, ts * 0.12, '#f07f1f');
      g.fillStyle = '#3c9a3a';
      g.beginPath();
      g.moveTo(cx, cy + ts * 0.05);
      g.lineTo(cx - ts * 0.2 + wob, cy - ts * 0.3);
      g.lineTo(cx + ts * 0.2 + wob, cy - ts * 0.3);
      g.fill();
    } else {
      // pumpkin
      circle(cx, cy + ts * 0.05, ts * 0.28, '#e8792b');
      g.strokeStyle = '#c45d14';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx, cy - ts * 0.22);
      g.lineTo(cx, cy + ts * 0.32);
      g.stroke();
      g.fillStyle = '#3c9a3a';
      g.fillRect(cx - 2, cy - ts * 0.32, 4, ts * 0.12);
    }
  }

  function drawTree(sx: number, sy: number, h: number, hits: number) {
    const shake = hits ? Math.sin(now * 40) * 2 : 0;
    const cx = sx + ts / 2 + shake;
    const cy = sy + ts / 2;
    circle(cx + ts * 0.08, cy + ts * 0.12, ts * 0.5, 'rgba(0,0,0,.18)');
    const greens = ['#2e7d32', '#388e3c', '#2b6e2e', '#43a047'];
    circle(cx, cy, ts * (0.46 + h * 0.08), greens[Math.floor(h * 4)]);
    circle(cx - ts * 0.12, cy - ts * 0.14, ts * 0.24, 'rgba(255,255,255,.12)');
    if (h > 0.8) {
      circle(cx + ts * 0.15, cy - ts * 0.05, ts * 0.07, '#e53935');
      circle(cx - ts * 0.1, cy + ts * 0.15, ts * 0.07, '#e53935');
    }
  }

  function drawRock(sx: number, sy: number, h: number, hits: number) {
    const shake = hits ? Math.sin(now * 40) * 1.5 : 0;
    const cx = sx + ts / 2 + shake;
    const cy = sy + ts / 2;
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath();
    g.ellipse(cx + 3, cy + ts * 0.2, ts * 0.42, ts * 0.22, 0, 0, 7);
    g.fill();
    g.fillStyle = h < 0.5 ? '#7d7873' : '#8a847d';
    g.beginPath();
    g.moveTo(cx - ts * 0.4, cy + ts * 0.25);
    g.lineTo(cx - ts * 0.3, cy - ts * 0.2);
    g.lineTo(cx, cy - ts * 0.38);
    g.lineTo(cx + ts * 0.35, cy - ts * 0.15);
    g.lineTo(cx + ts * 0.42, cy + ts * 0.25);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.beginPath();
    g.moveTo(cx - ts * 0.25, cy - ts * 0.15);
    g.lineTo(cx, cy - ts * 0.32);
    g.lineTo(cx + ts * 0.05, cy - ts * 0.05);
    g.fill();
    if (h > 0.85) circle(cx + ts * 0.15, cy + ts * 0.05, ts * 0.06, '#5ee0ff');
  }

  function drawBuilding(b: Building) {
    const x = b.x * ts;
    const y = b.y * ts;
    const w = b.w * ts;
    const h = b.h * ts;
    // shadow
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.fillRect(x + 5, y + 6, w, h);
    // front wall strip on the door side
    const wallH = ts * 0.45;
    g.fillStyle = b.wall;
    g.fillRect(x, y, w, h);
    const ry = b.up ? y + wallH : y;
    const rh = h - wallH;
    g.fillStyle = b.roof;
    g.fillRect(x - 3, ry - (b.up ? 0 : 3), w + 6, rh + 3);
    // ridge and shingles
    g.fillStyle = 'rgba(255,255,255,.14)';
    g.fillRect(x - 3, ry - (b.up ? 0 : 3), w + 6, rh / 2);
    g.strokeStyle = 'rgba(0,0,0,.18)';
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(x - 3, ry + (rh * k) / 4);
      g.lineTo(x + w + 3, ry + (rh * k) / 4);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(x - 3, ry + rh / 2 - 1, w + 6, 2);
    // windows on the wall strip
    const wy = b.up ? y + wallH * 0.2 : y + h - wallH * 0.8;
    const doorX = (b.door.x + 0.5) * ts;
    for (let wx = x + ts * 0.3; wx < x + w - ts * 0.4; wx += ts) {
      if (Math.abs(wx + ts * 0.15 - doorX) < ts * 0.55) continue;
      g.fillStyle = '#9fd8ff';
      g.fillRect(wx, wy, ts * 0.32, wallH * 0.6);
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.strokeRect(wx, wy, ts * 0.32, wallH * 0.6);
    }
    // door
    g.fillStyle = b.kind === 'shop' ? '#d04a7a' : '#7a4a26';
    const dw = ts * (b.kind === 'house' ? 0.42 : 0.7);
    if (b.up) g.fillRect(doorX - dw / 2, y - 2, dw, wallH + 2);
    else g.fillRect(doorX - dw / 2, y + h - wallH, dw, wallH + 2);
    circle(doorX + dw * 0.3, b.up ? y + wallH * 0.55 : y + h - wallH * 0.45, 2, '#ffd54f');
    // chimney
    if (b.kind === 'house') {
      g.fillStyle = '#8d6e63';
      g.fillRect(x + w - ts * 0.6, ry + ts * 0.2, ts * 0.3, ts * 0.3);
      // house number
      const ny = b.up ? y - ts * 0.45 : y + h + ts * 0.05;
      g.fillStyle = '#fff';
      g.beginPath();
      g.roundRect(x + ts * 0.1, ny, ts * 0.62, ts * 0.38, 4);
      g.fill();
      g.fillStyle = '#333';
      g.font = `bold ${Math.round(ts * 0.26)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`#${b.num}`, x + ts * 0.41, ny + ts * 0.2);
      const c = carry.find((c) => c.house === b);
      if (c) {
        const pulse = 1 + Math.sin(now * 6) * 0.1;
        emoji(c.kind === 'letter' ? '📬' : '🍕', doorX, (b.up ? y - ts * 0.9 : y + h + ts * 0.8) , ts * 0.6 * pulse);
      }
    }
    if (b.label) {
      g.font = `900 ${Math.round(ts * 0.42)}px system-ui, sans-serif`;
      const tw = g.measureText(b.label).width + 16;
      const lx = x + w / 2;
      const ly = ry + rh / 2;
      g.fillStyle = 'rgba(255,255,255,.92)';
      g.beginPath();
      g.roundRect(lx - tw / 2, ly - ts * 0.32, tw, ts * 0.64, 8);
      g.fill();
      g.fillStyle = b.roof;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(b.label, lx, ly + 1);
      const icon = { shop: '🛒', post: '✉️', pizza: '🍕', hall: '🏛️', sawmill: '🪵', barn: '🐄', mine: '⛏️', fishhut: '🐟', house: '', home: '' }[b.kind];
      if (icon) emoji(icon, lx, ly - ts * 0.8, ts * 0.6);
    }
  }

  function drawBoard() {
    const b = world.board;
    const x = b.x * ts;
    const y = b.y * ts;
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.fillRect(x + 4, y + 6, ts * 2, ts * 0.9);
    g.fillStyle = '#6d4424';
    g.fillRect(x + ts * 0.15, y + ts * 0.6, ts * 0.15, ts * 0.45);
    g.fillRect(x + ts * 1.7, y + ts * 0.6, ts * 0.15, ts * 0.45);
    g.fillStyle = '#9a6435';
    g.fillRect(x, y - ts * 0.3, ts * 2, ts * 1);
    g.strokeStyle = '#5a3418';
    g.lineWidth = 3;
    g.strokeRect(x, y - ts * 0.3, ts * 2, ts * 1);
    const papers = ['#fff8dc', '#ffe0e0', '#e0f0ff', '#e8ffe0', '#fff'];
    for (let k = 0; k < 5; k++) {
      g.fillStyle = papers[k];
      g.fillRect(x + ts * (0.12 + k * 0.37), y - ts * (0.15 - (k % 2) * 0.1), ts * 0.3, ts * 0.38);
    }
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(ts * 0.26)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#5a3418';
    g.fillRect(x + ts * 0.3, y - ts * 0.72, ts * 1.4, ts * 0.38);
    g.fillStyle = '#ffe9a8';
    g.fillText('JOBS', x + ts, y - ts * 0.53);
    if (!save.job) {
      const bounce = Math.abs(Math.sin(now * 4)) * ts * 0.2;
      emoji('📋', x + ts, y - ts * 1.25 - bounce, ts * 0.6);
    }
  }

  function drawFountain() {
    const f = world.fountain;
    const cx = f.x * ts;
    const cy = f.y * ts;
    circle(cx, cy, ts * 2, '#9e9e9e');
    circle(cx, cy, ts * 1.75, '#5bb8ef');
    circle(cx, cy, ts * 0.45, '#bdbdbd');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + now;
      const r = ts * (0.6 + ((now * 0.8 + k * 0.13) % 1) * 0.9);
      circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, ts * 0.07, 'rgba(255,255,255,.8)');
    }
  }

  function drawStatue() {
    const f = world.fountain;
    const cx = f.x * ts;
    const cy = f.y * ts;
    circle(cx, cy, ts * 0.5, '#c9a227');
    drawPerson(f.x, f.y - 0.1, '#ffd700', '#ffd700', '#e6b800', 0, false);
    emoji('🏆', cx, cy - ts * 0.95, ts * 0.5);
  }

  function drawPerson(x: number, y: number, shirt: string, skin: string, hair: string, walk: number, moving: boolean) {
    const sx = x * ts;
    const sy = y * ts;
    const bob = moving ? Math.abs(Math.sin(walk)) * ts * 0.06 : 0;
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath();
    g.ellipse(sx, sy + ts * 0.3, ts * 0.28, ts * 0.12, 0, 0, 7);
    g.fill();
    // legs
    const leg = moving ? Math.sin(walk) * ts * 0.1 : 0;
    g.fillStyle = '#34495e';
    g.fillRect(sx - ts * 0.15, sy + ts * 0.05 + leg - bob, ts * 0.12, ts * 0.25);
    g.fillRect(sx + ts * 0.03, sy + ts * 0.05 - leg - bob, ts * 0.12, ts * 0.25);
    // body
    g.fillStyle = shirt;
    g.beginPath();
    g.roundRect(sx - ts * 0.22, sy - ts * 0.22 - bob, ts * 0.44, ts * 0.36, ts * 0.1);
    g.fill();
    // head
    circle(sx, sy - ts * 0.38 - bob, ts * 0.2, skin);
    g.fillStyle = hair;
    g.beginPath();
    g.arc(sx, sy - ts * 0.42 - bob, ts * 0.2, Math.PI, 0);
    g.fill();
  }

  function drawPlayer() {
    if (tier('hover')) {
      g.fillStyle = '#00e5ff';
      g.globalAlpha = 0.85;
      g.beginPath();
      g.ellipse(p.x * ts, p.y * ts + ts * 0.32, ts * 0.42, ts * 0.13, 0, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    }
    drawPerson(p.x, p.y, save.shirt, '#f1c27d', '#4a2c17', p.walk, p.moving);
    const bob = p.moving ? Math.abs(Math.sin(p.walk)) * ts * 0.06 : 0;
    const hat = tier('hat');
    if (hat) emoji(['', '🧢', '🎩', '👑'][hat], p.x * ts, p.y * ts - ts * 0.6 - bob, ts * 0.38);
    // what you carry
    if (carry.length) {
      emoji(carry[0].kind === 'letter' ? '✉️' : '🍕', p.x * ts + ts * 0.32, p.y * ts - ts * 0.05, ts * 0.32);
      if (carry.length > 1) {
        g.fillStyle = '#fff';
        g.font = `bold ${Math.round(ts * 0.24)}px system-ui`;
        g.fillText(`x${carry.length}`, p.x * ts + ts * 0.55, p.y * ts + ts * 0.15);
      }
    }
    const job = save.job;
    if (job && !carry.length) {
      const tool = { sweeper: '🧹', farmer: '', fisher: '🎣', mail: '', lumberjack: '🪓', pizza: '', miner: '⛏️' }[job];
      const swing = actCool > 0 ? Math.sin(actCool * 25) * 0.3 : 0;
      if (tool) {
        g.save();
        g.translate(p.x * ts + ts * 0.3, p.y * ts - ts * 0.05);
        g.rotate(swing);
        emoji(tool, 0, 0, ts * 0.34);
        g.restore();
      }
    }
  }

  function drawPet() {
    const t = tier('pet');
    if (!t) return;
    const hop = Math.abs(Math.sin(now * 6)) * ts * 0.1 * (dist(pet.x, pet.y, p.x, p.y) > 1.25 ? 1 : 0.3);
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath();
    g.ellipse(pet.x * ts, pet.y * ts + ts * 0.2, ts * 0.2, ts * 0.08, 0, 0, 7);
    g.fill();
    g.save();
    if (pet.x > p.x) {
      g.translate(pet.x * ts, 0);
      g.scale(-1, 1);
      g.translate(-pet.x * ts, 0);
    }
    emoji(t === 1 ? '🐕' : '🐉', pet.x * ts, pet.y * ts - hop, ts * (t === 1 ? 0.5 : 0.7));
    g.restore();
  }

  function drawArrow(cx: number, cy: number) {
    if (!target || paused) return;
    const tx = target.x * ts - cx;
    const ty = target.y * ts - cy;
    const m = 54;
    const on = tx > m && tx < vw - m && ty > m + 40 && ty < vh - m;
    if (on) {
      const b = Math.abs(Math.sin(now * 5)) * 8;
      g.fillStyle = '#ffe14d';
      g.strokeStyle = '#7a5a00';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(tx, ty - ts * 0.55 - b);
      g.lineTo(tx - 10, ty - ts * 0.55 - 16 - b);
      g.lineTo(tx + 10, ty - ts * 0.55 - 16 - b);
      g.closePath();
      g.fill();
      g.stroke();
      return;
    }
    const px = p.x * ts - cx;
    const py = p.y * ts - cy;
    const a = Math.atan2(ty - py, tx - px);
    // put the arrow on an ellipse around the player, inside the screen
    const rx = Math.min(vw / 2 - m, 220);
    const ry = Math.min(vh / 2 - m, 160);
    const ax = px + Math.cos(a) * rx;
    const ay = py + Math.sin(a) * ry;
    g.save();
    g.translate(ax, ay);
    g.rotate(a);
    g.fillStyle = '#ffe14d';
    g.strokeStyle = '#7a5a00';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(20, 0);
    g.lineTo(-10, -14);
    g.lineTo(-4, 0);
    g.lineTo(-10, 14);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    const d = Math.round(dist(p.x, p.y, target.x, target.y));
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.7)';
    g.strokeText(`${d}m`, ax - Math.cos(a) * 28, ay - Math.sin(a) * 28);
    g.fillStyle = '#fff';
    g.fillText(`${d}m`, ax - Math.cos(a) * 28, ay - Math.sin(a) * 28);
  }

  function renderShop() {
    const { cx, cy } = camera();
    g.fillStyle = '#3a2340';
    g.fillRect(0, 0, vw, vh);
    g.save();
    g.translate(-cx, -cy);
    // floor
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const wall = x === 0 || y < 3 || x === SW - 1 || y === SH - 1;
        if (wall && !(y === SH - 1 && x === SHOP_DOOR.x)) {
          g.fillStyle = y < 3 ? (y === 2 ? '#c2477a' : '#e2618f') : '#a83864';
          g.fillRect(x * ts, y * ts, ts, ts);
          if (y === 1 && x % 3 === 1) {
            // shelves with goodies on the back wall
            g.fillStyle = '#8b5a2b';
            g.fillRect(x * ts, y * ts + ts * 0.6, ts * 2, ts * 0.12);
            emoji(['🧸', '🎈', '🍭', '⚽', '🎁', '🪀'][(x / 3) | 0], x * ts + ts * 0.5, y * ts + ts * 0.35, ts * 0.42);
            emoji(['🍬', '🎨', '🧃', '🪁', '📚', '🎲'][(x / 3) | 0], x * ts + ts * 1.4, y * ts + ts * 0.35, ts * 0.42);
          }
          continue;
        }
        g.fillStyle = (x + y) % 2 ? '#fbe7ef' : '#f3d3e0';
        g.fillRect(x * ts, y * ts, ts, ts);
      }
    // doormat
    g.fillStyle = '#6d4c41';
    g.fillRect(SHOP_DOOR.x * ts, (SH - 1) * ts, ts, ts);
    emoji('🚪', SHOP_DOOR.x * ts + ts / 2, (SH - 0.5) * ts, ts * 0.6);
    // sign
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(ts * 0.55)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('★ UPGRADE SHOP ★', (SW / 2) * ts, ts * 0.45);
    // shopkeeper behind the counter
    drawPerson(SW / 2, 2.9, '#d04a7a', '#e0ac69', '#222', 0, false);
    g.fillStyle = '#8b5a2b';
    g.fillRect((SW / 2 - 2) * ts, 3.05 * ts, ts * 4, ts * 0.4);
    if (Math.floor(now / 6) % 2 === 0) bubble((SW / 2) * ts, 2.1 * ts, save.money >= 40 ? 'Take a look!' : 'Come back with $!');

    for (const pd of PODIUMS) drawPodium(pd.x, pd.y, pd.id);
    drawPet();
    drawPlayer();
    drawWorldFx();
    g.restore();
  }

  function drawPodium(x: number, y: number, id: UpgradeId) {
    const up = UPGRADE_BY_ID[id];
    const t = tier(id);
    const it = up.tiers[t];
    const sx = x * ts;
    const sy = y * ts;
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath();
    g.ellipse(sx + 4, sy + ts * 0.25, ts * 0.55, ts * 0.25, 0, 0, 7);
    g.fill();
    // pedestal
    g.fillStyle = '#c9c3d6';
    g.fillRect(sx - ts * 0.45, sy - ts * 0.2, ts * 0.9, ts * 0.45);
    g.fillStyle = '#e9e4f2';
    g.beginPath();
    g.ellipse(sx, sy - ts * 0.2, ts * 0.48, ts * 0.2, 0, 0, 7);
    g.fill();
    g.fillStyle = '#b3abc4';
    g.beginPath();
    g.ellipse(sx, sy + ts * 0.25, ts * 0.45, ts * 0.12, 0, 0, Math.PI);
    g.fill();
    const near = dist(p.x, p.y, x, y) < 1.35;
    if (!it) {
      emoji('✅', sx, sy - ts * 0.55, ts * 0.5);
      g.fillStyle = '#7a6f8c';
      g.font = `bold ${Math.round(ts * 0.26)}px system-ui, sans-serif`;
      g.fillText('SOLD OUT', sx, sy + ts * 0.62);
      return;
    }
    const can = save.money >= it.price;
    const float = Math.sin(now * 2.5 + x) * ts * 0.08;
    // glow
    const glow = g.createRadialGradient(sx, sy - ts * 0.65, 2, sx, sy - ts * 0.65, ts * 0.7);
    glow.addColorStop(0, can ? 'rgba(255,240,120,.7)' : 'rgba(255,255,255,.4)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(sx - ts, sy - ts * 1.4, ts * 2, ts * 1.5);
    emoji(it.icon, sx, sy - ts * 0.65 + float, ts * (near ? 0.75 : 0.6));
    // tier dots
    for (let k = 0; k < up.tiers.length && up.tiers.length > 1; k++)
      circle(sx + (k - (up.tiers.length - 1) / 2) * ts * 0.16, sy + ts * 0.02, ts * 0.05, k < t ? '#57d38c' : k === t ? '#ffd54f' : '#8d849e');
    // price tag
    const price = fmt(it.price);
    g.font = `900 ${Math.round(ts * 0.3)}px system-ui, sans-serif`;
    const tw = g.measureText(price).width + 10;
    g.fillStyle = can ? '#2e9d5a' : '#c0392b';
    g.beginPath();
    g.roundRect(sx - tw / 2, sy + ts * 0.42, tw, ts * 0.36, 6);
    g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(price, sx, sy + ts * 0.61);
    if (near) {
      g.font = `bold ${Math.round(ts * 0.28)}px system-ui, sans-serif`;
      const lines = [it.name, it.desc];
      const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 16;
      const by = sy - ts * 1.9;
      g.fillStyle = 'rgba(40,20,50,.92)';
      g.beginPath();
      g.roundRect(sx - w / 2, by - ts * 0.25, w, ts * 0.75, 8);
      g.fill();
      g.fillStyle = '#ffe14d';
      g.fillText(lines[0], sx, by);
      g.fillStyle = '#fff';
      g.font = `${Math.round(ts * 0.24)}px system-ui, sans-serif`;
      g.fillText(lines[1], sx, by + ts * 0.3);
    }
  }

  let lastHud = '';
  function renderHud() {
    const job = save.job ? JOB_BY_ID[save.job] : null;
    let task = 'Go to the job board in the town square';
    if (scene === 'shop') task = 'Walk up to a podium to buy an upgrade';
    else if (job) {
      if (job.id === 'mail' || job.id === 'pizza') {
        const kind = job.id === 'mail' ? 'letters' : 'pizzas';
        if (!carry.length) task = `Get ${kind} at the ${job.id === 'mail' ? 'Post Office' : 'Pizza place'}`;
        else {
          const c = carry[0];
          task = `Bring it to house #${c.house.num}` + (c.kind === 'pizza' ? ` (${Math.max(0, Math.ceil(c.due - now))}s)` : '') + (carry.length > 1 ? ` +${carry.length - 1} more` : '');
        }
      } else if (job.id === 'fisher') task = fishing ? (fishing.phase === 'bite' ? 'Reel it in NOW!' : 'Wait for the ! ...') : 'Go to the pond and cast your line';
      else task = job.how;
    }
    if (build.on) task = inLot(Math.floor(p.x), Math.floor(p.y)) ? 'Face a spot and place it. Walls need bricks 🧱' : 'Follow the arrow to your lot to build';
    const biz = save.biz ? `<span class="biz">🏪 ${save.biz.name} · ${save.workers.length} worker${save.workers.length === 1 ? '' : 's'}${boxTile() < 0 ? ' · needs a 💰 box' : ''}</span>` : '';
    const hud = `${save.money}|${job?.id}|${task}|${biz}|${save.bricks}|${build.item?.id}`;
    if (hud !== lastHud) {
      lastHud = hud;
      moneyEl.textContent = fmt(save.money);
      jobEl.innerHTML = (job
        ? `<b>${job.icon} ${job.name}</b><span>${task}</span>`
        : `<b>😀 No job yet</b><span>${task}</span>`) + biz;
      buildBarLabel();
    }
    const a = action;
    const label = a ? a.label : '';
    if (promptEl.dataset.l !== label + touchMode) {
      promptEl.dataset.l = label + touchMode;
      promptEl.innerHTML = a ? `<kbd>E</kbd> ${a.icon} ${a.label}` : '';
      promptEl.classList.toggle('show', !!a && !touchMode);
      promptEl.classList.toggle('off', !!a?.disabled);
      actBtn.querySelector('.i')!.textContent = a ? a.icon : '✋';
      actBtn.querySelector('.l')!.textContent = a ? a.label : '';
      actBtn.classList.toggle('dim', !a || !!a.disabled);
    }
    drawMini();
  }

  function drawMini() {
    const s = mini.width;
    mg.imageSmoothingEnabled = false;
    // a zoomed-in window around you
    const span = 60;
    const px = scene === 'town' ? p.x : townReturn.x;
    const py = scene === 'town' ? p.y : townReturn.y;
    const sx = Math.max(0, Math.min(W - span, px - span / 2));
    const sy = Math.max(0, Math.min(H - span, py - span / 2));
    mg.clearRect(0, 0, s, s);
    mg.drawImage(mapImg, sx, sy, span, span, 0, 0, s, s);
    const k = s / span;
    if (target) {
      const tx = Math.max(4, Math.min(s - 4, (target.x - sx) * k));
      const ty = Math.max(4, Math.min(s - 4, (target.y - sy) * k));
      mg.fillStyle = '#ffe14d';
      mg.strokeStyle = '#000';
      mg.lineWidth = 2;
      mg.beginPath();
      mg.arc(tx, ty, 6, 0, 7);
      mg.fill();
      mg.stroke();
    }
    mg.fillStyle = '#fff';
    mg.beginPath();
    mg.arc((px - sx) * k, (py - sy) * k, 7, 0, 7);
    mg.fill();
    mg.fillStyle = save.shirt;
    mg.beginPath();
    mg.arc((px - sx) * k, (py - sy) * k, 5, 0, 7);
    mg.fill();
  }

  // ---------- loop ----------
  let raf = 0;
  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!paused) update(dt);
    render();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  if (!save.intro) showIntro();

  const onHide = () => writeSave();
  window.addEventListener('pagehide', onHide);

  return () => {
    writeSave();
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', onHide);
    root.innerHTML = '';
  };
}

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const game: GameModule = { mount };
export default game;
