// North Pole Village: mount the game, the title screen, keys, touch controls and the HUD.
import './style.css';
import type { GameModule } from '../types';
import { isMuted, play, setMuted, unlockAudio } from './audio';
import {
  DX,
  DY,
  Game,
  MACHINE_TILE,
  MEAT_PRICE,
  PRICES,
  STICKS_TILE,
  T,
  TOOLS,
  TOWER_MAX,
  TREES_FOR_BASE,
  type Dir,
  type Tool,
} from './game';
import { Renderer, type Ghost } from './render';
import type { Snap, Sound } from './game';
import { coopBadge, coopMenu, every } from '../coop/ui';
import { PLAYER_NAMES, type FriendSession, type HostSession, type Session } from '../coop/session';

const COOP_PREFIX = 'trom-north-pole-';
type Buyable = 'tower' | 'belt' | 'grabber' | 'villager';
type ToHost =
  | { t: 'me'; x: number; y: number; dir: Dir; aim: number; step: number }
  | { t: 'act' }
  | { t: 'shoot'; ang: number }
  | { t: 'load' }
  | { t: 'place'; tool: Tool; x: number; y: number; dir: Dir }
  | { t: 'pick'; x: number; y: number }
  | { t: 'buy'; id: Buyable; n: number };
type ToFriend =
  | { t: 'init'; trees: number[][] }
  | { t: 's'; s: Snap; snd: Sound[] }
  | { t: 'msg'; list: { toast?: string; banner?: string }[] };

// Several villages can be saved on this device. Each one is its own slot.
const OLD_SAVE_KEY = 'north-pole-save-v1';
const INDEX_KEY = 'north-pole-saves';
const slotKey = (id: string) => `north-pole-slot-${id}`;

interface SaveMeta {
  id: string;
  name: string;
  saved: number;
  chopped: number;
  wave: number;
  gold: number;
}

function listSaves(): SaveMeta[] {
  try {
    let list = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as SaveMeta[];
    if (!Array.isArray(list)) list = [];
    // bring forward the save from the first version (one village only)
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (old) {
      const g = Game.load(old);
      if (g) {
        const id = 'v' + Date.now().toString(36);
        localStorage.setItem(slotKey(id), old);
        list.unshift({ id, name: 'Village 1', saved: Date.now(), chopped: g.chopped, wave: g.wave, gold: g.inv.gold });
        localStorage.setItem(INDEX_KEY, JSON.stringify(list));
      }
      localStorage.removeItem(OLD_SAVE_KEY);
    }
    return list.sort((a, b) => b.saved - a.saved);
  } catch {
    return [];
  }
}

function writeSlot(meta: SaveMeta, data: string): boolean {
  try {
    localStorage.setItem(slotKey(meta.id), data);
    const list = listSaves().filter((m) => m.id !== meta.id);
    list.unshift(meta);
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn('save failed', err);
    return false;
  }
}

function readSlot(id: string): string | null {
  try {
    return localStorage.getItem(slotKey(id));
  } catch {
    return null;
  }
}

function deleteSlot(id: string) {
  try {
    localStorage.removeItem(slotKey(id));
    localStorage.setItem(INDEX_KEY, JSON.stringify(listSaves().filter((m) => m.id !== id)));
  } catch {
    /* ignore */
  }
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const TOOL_INFO: Record<Tool, { icon: string; name: string }> = {
  crossbow: { icon: '🏹', name: 'Crossbow' },
  fence: { icon: '🪵', name: 'Fence' },
  tower: { icon: '🗼', name: 'Crossbow tower' },
  belt: { icon: '⏩', name: 'Conveyor belt' },
  grabber: { icon: '🦾', name: 'Grabber' },
};

function mmss(s: number) {
  const n = Math.max(0, Math.ceil(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

const HELP = `
  <h2>How to play</h2>
  <ul>
    <li>🌲 <b>Chop trees</b> for wood: walk up to a tree and press <kbd>Space</kbd> (or <b>Use</b>).</li>
    <li>🏠 Chop <b>${TREES_FOR_BASE} trees</b> and you get a <b>base</b>. Then <b>polar bears</b> come in 2 minutes, and again and again.</li>
    <li>🪵 <b>Fences</b> cost 1 wood. Bears can't get through them, but <b>you can</b>. Build a fence all the way around your village!</li>
    <li>🐻‍❄️ Bears don't hurt fences, but if you walk outside they will hurt <b>you</b>. If you get knocked out, a villager comes to carry you back to base and you get healed.</li>
    <li>🏹 Shoot bears with your <b>crossbow</b> to get <b>meat</b>. Walk over the meat to pick it up.</li>
    <li>🪙 Sell meat to a villager (<kbd>Space</kbd> next to them) for <b>${MEAT_PRICE} gold coins</b> each.</li>
    <li>🗼 Buy <b>crossbow towers</b> in the shop. Stand next to one and press <kbd>L</kbd> to load arrows. It shoots bears by itself.</li>
    <li>🪵➡️🏹 In the back of the village is a <b>stick pile</b> that never runs out. Put sticks in the <b>arrow machine</b> and it makes 2 arrows from each stick.</li>
    <li>⏩🦾 Buy <b>belts</b> and <b>grabbers</b> to do it for you: a grabber takes from behind it and puts in front of it. Try: stick pile → grabber → belts → machine → grabber → belts → tower!</li>
    <li>👪 <b>${PRICES.villager.toLocaleString()} gold</b> buys a new villager, who chops trees and brings you the wood.</li>
  </ul>
  <h3>Keys</h3>
  <p><kbd>WASD</kbd>/arrows move · <kbd>Space</kbd>/<kbd>E</kbd> use · click to shoot or build · <kbd>1</kbd>–<kbd>5</kbd> pick · <kbd>R</kbd> turn · <kbd>X</kbd> pick up a thing · <kbd>L</kbd> load tower · <kbd>B</kbd> shop · <kbd>H</kbd> help</p>
  <p>👥 <b>Play together</b>: up to 4 players, each on their own phone or computer. Tap 👥 while playing to get a code; friends tap <b>Join a friend</b> on the start screen. Wood, arrows and gold are shared, bears go after whoever is closest, and a villager carries anyone who gets knocked out back to base.</p>
  <p>💾 Your village saves by itself every few seconds. Tap 💾 to save right now. Pick a saved village on the start screen.</p>`;

const game: GameModule = {
  mount(root, { onExit }) {
    root.innerHTML = `
    <div class="np">
      <canvas class="np-canvas"></canvas>
      <div class="np-stats"></div>
      <div class="np-goal"></div>
      <div class="np-top">
        <button data-b="shop" title="Shop (B)">🛒 Shop</button>
        <button data-b="friends" title="Play with friends">👥</button>
        <button data-b="save" title="Save your village">💾</button>
        <button data-b="help" title="Help (H)">?</button>
        <button data-b="mute" title="Sound"></button>
        <button data-b="exit" title="Save and go to the start screen">✕</button>
      </div>
      <div class="np-banner" hidden></div>
      <div class="np-toasts"></div>
      <div class="np-hint"></div>
      <div class="np-hotbar"></div>
      <div class="np-touch">
        <div class="np-stick"><i></i></div>
        <div class="np-tbtns">
          <button data-t="use" class="big">✋<span>Use</span></button>
          <button data-t="fire" class="big">🏹<span>Shoot</span></button>
          <button data-t="load">L<span>Load</span></button>
          <button data-t="turn">↻<span>Turn</span></button>
          <button data-t="pick">⬆<span>Pick up</span></button>
        </div>
      </div>
      <div class="np-panel np-shop" hidden></div>
      <div class="np-panel np-help" hidden><div class="np-box">${HELP}<button class="np-btn" data-close>Got it</button></div></div>
      <div class="np-title"></div>
    </div>`;
    const $ = <E extends HTMLElement>(s: string) => root.querySelector<E>(s)!;
    const wrap = $('.np');
    const canvas = $<HTMLCanvasElement>('.np-canvas');
    const statsEl = $('.np-stats');
    const goalEl = $('.np-goal');
    const bannerEl = $('.np-banner');
    const toastsEl = $('.np-toasts');
    const hintEl = $('.np-hint');
    const hotbarEl = $('.np-hotbar');
    const shopEl = $('.np-shop');
    const helpEl = $('.np-help');
    const titleEl = $('.np-title');
    const muteBtn = $('[data-b="mute"]');
    const fireBtn = $('[data-t="fire"]');
    const turnBtn = $('[data-t="turn"]');
    const pickBtn = $('[data-t="pick"]');
    const useBtn = $('[data-t="use"]');

    const touchMode = matchMedia('(pointer: coarse)').matches;
    wrap.classList.toggle('touch', touchMode);

    const ren = new Renderer(canvas);
    let g = new Game();
    let playing = false;
    let tool: Tool = 'crossbow';
    let rot: Dir = 0;
    let stopped = false;

    // ---------- playing together ----------
    let net: Session | null = null;
    const badge = coopBadge(wrap, { top: 'calc(max(10px, env(safe-area-inset-top)) + 44px)' });
    const sendRate = every(15), snapRate = every(12);
    let netSounds: Sound[] = [];
    const isFriend = () => net?.role === 'friend';
    const toHost = (m: ToHost) => (net?.role === 'friend' ? net.send(m) : undefined);
    const refreshBadge = () => {
      if (!net) return badge.set('', [], 0);
      if (net.role === 'host') badge.set(net.code, [0, ...net.friends()], 0);
      else badge.set(net.code, [...new Set([0, net.slot, ...g.others.map((o) => o.slot)])].sort(), net.slot);
    };
    const endNet = () => {
      net?.close();
      net = null;
      g.others = [];
      g.p = g.me;
      refreshBadge();
    };
    const startHosting = (s: HostSession) => {
      net = s;
      netSounds = [];
      s.onJoin((slot) => {
        g.others.push(Game.newPlayer(slot));
        g.toast(`${PLAYER_NAMES[slot]} joined your village!`);
        g.sounds.push('coin');
        refreshBadge();
        s.send(slot, { t: 'init', trees: g.treeList() } satisfies ToFriend);
        s.send(slot, { t: 's', s: g.snap(), snd: [] } satisfies ToFriend);
      });
      s.onLeave((slot) => {
        g.removeOther(slot);
        g.toast(`${PLAYER_NAMES[slot]} left.`);
        refreshBadge();
      });
      s.onMessage((slot, raw) => {
        const m = raw as ToHost;
        const o = g.other(slot);
        if (net !== s || !m || !o) return;
        if (m.t === 'me') g.setOther(slot, m.x, m.y, m.dir, m.aim, m.step);
        else if (m.t === 'act') g.as(o, () => g.act());
        else if (m.t === 'shoot') g.as(o, () => g.shoot(Number(m.ang) || 0));
        else if (m.t === 'load') g.as(o, () => g.loadTower());
        else if (m.t === 'place' && TOOLS.includes(m.tool)) g.as(o, () => g.place(m.tool, m.x | 0, m.y | 0, (m.dir & 3) as Dir));
        else if (m.t === 'pick') g.pickUp(m.x | 0, m.y | 0);
        else if (m.t === 'buy' && m.id in PRICES)
          g.as(o, () => (g.buy(m.id, Math.max(1, Math.min(10, m.n | 0))) ? g.toast('Bought! It is in everyone’s hotbar.') : g.toast('Not enough gold coins yet. Sell meat to villagers!')));
        lastHud = '';
      });
      refreshBadge();
      g.toast(`Friends can join with the code ${s.code}: Join a friend on the start screen.`);
    };
    const startFriend = (s: FriendSession) => {
      endNet();
      g = new Game();
      g.objs.clear();
      g.occ.fill(null);
      g.setTrees([]);
      g.villagers = [];
      g.p = g.me = Game.newPlayer(s.slot);
      net = s;
      slot = null; // friends don't save: the village lives in the host's game
      ren.camX = -1e6;
      titleEl.hidden = true;
      playing = true;
      lastHud = '';
      s.onMessage((raw) => {
        const m = raw as ToFriend;
        if (net !== s || !m) return;
        if (m.t === 'init') g.setTrees(m.trees);
        else if (m.t === 's') {
          g.applySnap(m.s);
          g.sounds.push(...m.snd);
          refreshBadge();
        } else if (m.t === 'msg')
          for (const x of m.list) {
            if (x.toast) g.toasts.push(x.toast);
            if (x.banner) g.showBanner(x.banner);
          }
      });
      s.onClose(() => {
        if (net !== s) return;
        net = null;
        toTitle();
        g.toast('The host stopped playing.');
      });
      g.toast(`You're ${PLAYER_NAMES[s.slot]}! Wood, arrows and gold are shared with everyone.`);
    };
    const friendsMenu = (fromTitle: boolean) => {
      if (net?.role === 'host') {
        endNet();
        return g.toast('Playing on your own again.');
      }
      if (isFriend()) return g.toast('You are playing in a friend’s village. ✕ leaves it.');
      coopMenu(wrap, {
        title: 'North Pole Village',
        prefix: COOP_PREFIX,
        canHost: !fromTitle,
        canJoin: fromTitle,
        onHosted: startHosting,
        onJoined: startFriend,
      });
    };
    // what you do: on a friend's game it goes to the host
    const doAct = () => {
      if (!isFriend()) return g.act();
      if (g.p.down || g.p.actCool > 0) return;
      // a hair longer than the host's own wait, so none get turned away
      g.p.actCool = 0.3;
      toHost({ t: 'act' });
    };
    const doShoot = (ang: number) => {
      if (!isFriend()) return g.shoot(ang);
      if (g.p.down || g.p.shootCool > 0) return;
      if (g.inv.arrows <= 0) {
        g.toast('No arrows! Make some: sticks from the pile go in the arrow machine.');
        g.p.shootCool = 0.8;
        return;
      }
      g.p.aim = ang;
      g.p.shootCool = 0.37;
      toHost({ t: 'shoot', ang });
    };
    const doLoad = () => (isFriend() ? toHost({ t: 'load' }) : g.loadTower());

    // ---------- saving ----------
    let slot: SaveMeta | null = null;
    const save = (): boolean => {
      if (!playing || !slot) return false;
      slot = { ...slot, saved: Date.now(), chopped: g.chopped, wave: g.wave, gold: g.inv.gold };
      return writeSlot(slot, g.save());
    };
    const saveTimer = setInterval(save, 10000);

    // ---------- title screen ----------
    const showTitle = () => {
      playing = false;
      const saves = listSaves();
      titleEl.hidden = false;
      const rows = saves
        .map(
          (m) => `<div class="np-save"><div><b>${m.name}</b><small>🌲 ${m.chopped} · ${m.wave ? `🐻‍❄️ wave ${m.wave}` : 'no bears yet'} · 🪙 ${m.gold.toLocaleString()} · ${ago(m.saved)}</small></div>
          <button class="np-btn" data-go="load" data-id="${m.id}">Play</button><button class="np-btn np-alt np-del" data-go="del" data-id="${m.id}" title="Delete">✕</button></div>`,
        )
        .join('');
      titleEl.innerHTML = `<div class="np-box np-titlebox">
        <div class="np-logo">🐻‍❄️🌲🏠</div>
        <h1>North Pole Village</h1>
        <p>Chop trees, build fences and keep the polar bears out!</p>
        ${saves.length ? `<div class="np-saves"><h3>💾 Your saved villages</h3>${rows}</div>` : ''}
        <button class="np-btn ${saves.length ? 'np-alt' : ''}" data-go="new">${saves.length ? '➕ New village' : 'Start'}</button>
        <button class="np-btn np-alt" data-go="join">👥 Join a friend</button>
        <button class="np-btn np-alt" data-go="help">How to play</button>
        <button class="np-btn np-alt" data-go="exit">Back to games</button>
      </div>`;
    };
    titleEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
      if (!b) return;
      unlockAudio();
      const go = b.dataset.go;
      if (go === 'help') return (helpEl.hidden = false);
      if (go === 'join') return friendsMenu(true);
      if (go === 'exit') return exit();
      if (go === 'del') {
        if (b.dataset.sure !== '1') {
          b.dataset.sure = '1';
          b.textContent = 'Delete?';
          return;
        }
        deleteSlot(b.dataset.id!);
        return showTitle();
      }
      if (go === 'load') {
        const meta = listSaves().find((m) => m.id === b.dataset.id);
        const raw = meta && readSlot(meta.id);
        const loaded = raw && Game.load(raw);
        if (!meta || !loaded) {
          b.textContent = "Can't open";
          return;
        }
        g = loaded;
        slot = meta;
        g.toast(`Welcome back to ${meta.name}!`);
      } else {
        const n = listSaves().length + 1;
        slot = { id: 'v' + Date.now().toString(36), name: `Village ${n}`, saved: Date.now(), chopped: 0, wave: 0, gold: 0 };
        g = new Game(Math.floor(Math.random() * 1e9));
        g.toast('Welcome to the North Pole! Chop trees to get wood.');
        g.toast(touchMode ? 'Walk to a tree and tap ✋ Use.' : 'Walk to a tree and press Space.');
      }
      ren.camX = -1e6; // snap the camera
      titleEl.hidden = true;
      playing = true;
      save();
    });
    const exit = () => {
      save();
      onExit();
    };

    // ---------- HUD ----------
    const renderHotbar = () => {
      hotbarEl.innerHTML = TOOLS.map((t, i) => {
        const n = t === 'crossbow' ? g.inv.arrows : t === 'fence' ? g.inv.wood : g.inv[t];
        return `<button class="np-slot ${t === tool ? 'on' : ''} ${t !== 'crossbow' && n <= 0 ? 'empty' : ''}" data-tool="${t}" title="${TOOL_INFO[t].name} (${i + 1})">
          <span class="k">${i + 1}</span><span class="i">${TOOL_INFO[t].icon}</span><span class="n">${n}</span></button>`;
      }).join('');
    };
    hotbarEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (b) pickTool(b.dataset.tool as Tool);
    });
    const pickTool = (t: Tool) => {
      tool = t;
      if (t !== 'crossbow' && t !== 'fence' && g.inv[t] <= 0) g.toast(`You have no ${TOOL_INFO[t].name.toLowerCase()}s. Buy some in the 🛒 Shop.`);
      lastHud = '';
    };

    let lastHud = '';
    const renderHud = () => {
      const i = g.inv;
      const key = JSON.stringify([i, tool, g.p.hp | 0, g.chopped, g.hasBase, Math.ceil(g.bearTimer), g.wave, g.kills]);
      if (key === lastHud) return;
      lastHud = key;
      statsEl.innerHTML = `
        <div class="hp"><i style="width:${g.p.hp}%"></i><span>❤️ ${Math.ceil(g.p.hp)}</span></div>
        <div class="row"><span title="Wood">🪵 ${i.wood}</span><span title="Sticks">🥢 ${i.sticks}</span><span title="Arrows">🏹 ${i.arrows}</span></div>
        <div class="row"><span title="Meat">🍖 ${i.meat}</span><span title="Gold coins" class="gold">🪙 ${i.gold.toLocaleString()}</span></div>`;
      let goal: string;
      if (!g.hasBase) goal = `🌲 Chop trees: <b>${g.chopped}/${TREES_FOR_BASE}</b> to get a base`;
      else if (g.wave === 0) goal = `🐻‍❄️ Bears come in <b>${mmss(g.bearTimer)}</b>! Fence in your village`;
      else goal = `🐻‍❄️ Next bears in <b>${mmss(g.bearTimer)}</b> · wave ${g.wave} · bears beaten ${g.kills}`;
      goalEl.innerHTML = goal;
      renderHotbar();
      const building = tool !== 'crossbow';
      fireBtn.innerHTML = building ? `${TOOL_INFO[tool].icon}<span>Place</span>` : '🏹<span>Shoot</span>';
      turnBtn.hidden = tool !== 'belt' && tool !== 'grabber';
      pickBtn.hidden = !building;
    };

    let toastQ: string[] = [];
    const pumpToasts = () => {
      toastQ.push(...g.toasts.splice(0));
      while (toastQ.length) {
        const s = toastQ.shift()!;
        if ([...toastsEl.children].some((c) => c.textContent === s)) continue;
        const d = document.createElement('div');
        d.className = 'np-toast';
        d.textContent = s;
        toastsEl.appendChild(d);
        while (toastsEl.children.length > 3) toastsEl.firstElementChild!.remove();
        setTimeout(() => d.classList.add('out'), 4200);
        setTimeout(() => d.remove(), 4700);
      }
      if (g.bannerT > 0) {
        if (bannerEl.hidden || bannerEl.textContent !== g.banner) {
          bannerEl.textContent = g.banner;
          bannerEl.hidden = false;
          bannerEl.classList.remove('pop');
          void bannerEl.offsetWidth;
          bannerEl.classList.add('pop');
        }
      } else bannerEl.hidden = true;
    };

    /** What "Use" would do right now, for the hint and the button label. */
    const useHint = (): string => {
      const p = g.p;
      if (p.down) return '';
      if (g.inv.meat > 0 && g.villagers.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 60)) return `Sell ${g.inv.meat} meat`;
      if (g.nearRect(MACHINE_TILE, 30)) return 'Use arrow machine';
      if (g.nearRect(STICKS_TILE, 30)) return 'Grab sticks';
      const tx = Math.floor(p.x / T);
      const ty = Math.floor(p.y / T);
      for (let y = ty - 2; y <= ty + 2; y++)
        for (let x = tx - 2; x <= tx + 2; x++) if (g.standingTree(x, y) && Math.hypot((x + 0.5) * T - p.x, (y + 0.5) * T - p.y) < 62) return 'Chop tree';
      return '';
    };
    const nearTower = () => [...g.objs.values()].some((o) => o.kind === 'tower' && Math.hypot((o.x + 0.5) * T - g.p.x, (o.y + 0.5) * T - g.p.y) < 90);

    // ---------- shop ----------
    const renderShop = () => {
      const row = (id: 'tower' | 'belt' | 'grabber' | 'villager', icon: string, name: string, about: string, n = 1) => {
        const cost = PRICES[id] * n;
        return `<div class="np-item"><span class="i">${icon}</span><div><b>${name}${n > 1 ? ` ×${n}` : ''}</b><small>${about}</small></div>
          <button class="np-btn ${g.inv.gold < cost ? 'np-off' : ''}" data-buy="${id}" data-n="${n}">🪙 ${cost.toLocaleString()}</button></div>`;
      };
      shopEl.innerHTML = `<div class="np-box"><h2>🛒 Shop <span class="gold">🪙 ${g.inv.gold.toLocaleString()}</span></h2>
        <p class="np-sub">Get gold by selling 🍖 meat to villagers (${MEAT_PRICE} each).</p>
        ${row('tower', '🗼', 'Crossbow tower', `Shoots bears near it. Load it with arrows (L). Holds ${TOWER_MAX}.`)}
        ${row('belt', '⏩', 'Conveyor belt', 'Moves sticks and arrows along.')}
        ${row('belt', '⏩', 'Conveyor belt', 'A bunch of belts.', 10)}
        ${row('grabber', '🦾', 'Grabber', 'Takes from behind it, puts in front of it.')}
        ${row('villager', '👪', 'New villager', 'Chops trees and brings you wood.')}
        <button class="np-btn np-alt" data-close>Close</button></div>`;
    };
    shopEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      if (!b) return;
      const id = b.dataset.buy as Buyable;
      if (isFriend()) {
        if (g.inv.gold < PRICES[id] * Number(b.dataset.n)) g.toast('Not enough gold coins yet. Sell meat to villagers!');
        else toHost({ t: 'buy', id, n: Number(b.dataset.n) });
        if (id !== 'villager') tool = id;
        lastHud = '';
        return;
      }
      if (g.buy(id, Number(b.dataset.n))) {
        if (id !== 'villager') {
          tool = id;
          g.toast(`Bought! ${TOOL_INFO[id].name} is in your hotbar.`);
        }
      } else g.toast('Not enough gold coins yet. Sell meat to villagers!');
      lastHud = '';
      renderShop();
    });
    const toggle = (el: HTMLElement, open = el.hidden) => {
      if (open && el === shopEl) renderShop();
      if (open) (el === shopEl ? helpEl : shopEl).hidden = true;
      el.hidden = !open;
    };
    for (const el of [shopEl, helpEl])
      el.addEventListener('click', (e) => {
        if (e.target === el || (e.target as HTMLElement).closest('[data-close]')) el.hidden = true;
      });
    // with friends, the village keeps going while the shop or help is open
    const paused = () => !playing || (!net && (!shopEl.hidden || !helpEl.hidden));
    const inMenu = () => !shopEl.hidden || !helpEl.hidden;

    $('.np-top').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (!b) return;
      unlockAudio();
      const k = b.dataset.b;
      if (k === 'shop') toggle(shopEl);
      if (k === 'friends') friendsMenu(false);
      if (k === 'save') {
        if (isFriend()) return g.toast('Only the host can save. This village lives in their game.');
        const ok = save();
        g.toast(ok ? `Saved ${slot?.name ?? 'your village'}! 💾` : 'Could not save on this device.');
        if (ok) g.sounds.push('coin');
      }
      if (k === 'help') toggle(helpEl);
      if (k === 'mute') {
        setMuted(!isMuted());
        drawMute();
      }
      if (k === 'exit') toTitle();
    });
    // ✕ saves and goes back to the start screen, where you can pick another village
    const toTitle = () => {
      save();
      endNet();
      shopEl.hidden = helpEl.hidden = true;
      showTitle();
    };
    const drawMute = () => (muteBtn.textContent = isMuted() ? '🔇' : '🔊');
    drawMute();

    // ---------- building ----------
    const frontTile = () => ({ x: Math.floor(g.p.x / T) + DX[g.p.dir], y: Math.floor(g.p.y / T) + DY[g.p.dir] });
    let mouse: { x: number; y: number; in: boolean } = { x: 0, y: 0, in: false };
    const targetTile = () => {
      if (!touchMode && mouse.in) {
        const w = ren.toWorld(mouse.x, mouse.y);
        const tx = Math.floor(w.x / T);
        const ty = Math.floor(w.y / T);
        if (Math.hypot((tx + 0.5) * T - g.p.x, (ty + 0.5) * T - g.p.y) < 9 * T) return { x: tx, y: ty };
      }
      return frontTile();
    };
    const ghost = (): Ghost | null => {
      if (tool === 'crossbow' || g.p.down || paused()) return null;
      const t = targetTile();
      return { tool, x: t.x, y: t.y, dir: rot, ok: g.canPlace(tool, t.x, t.y) };
    };
    let lastPlaced = '';
    const tryPlace = (quiet = false) => {
      if (tool === 'crossbow' || g.p.down) return;
      const t = targetTile();
      const k = `${t.x},${t.y}`;
      if (quiet && k === lastPlaced) return;
      lastPlaced = k;
      if (isFriend()) {
        if (g.canPlace(tool, t.x, t.y)) return toHost({ t: 'place', tool, x: t.x, y: t.y, dir: rot });
      } else if (g.place(tool, t.x, t.y, rot)) return;
      if (quiet) return;
      if (tool === 'fence' && g.inv.wood <= 0) g.toast('You need wood to build fences. Chop trees!');
      else if (tool !== 'fence' && g.inv[tool] <= 0) g.toast(`You have no ${TOOL_INFO[tool].name.toLowerCase()}s. Buy some in the 🛒 Shop.`);
    };
    const tryPick = () => {
      const t = targetTile();
      if (isFriend()) {
        const o = g.at(t.x, t.y);
        if (o && o.kind !== 'base' && o.kind !== 'machine' && o.kind !== 'sticks') toHost({ t: 'pick', x: t.x, y: t.y });
        else g.toast('Nothing to pick up there.');
      } else if (!g.pickUp(t.x, t.y)) g.toast('Nothing to pick up there.');
    };
    const turn = () => {
      rot = ((rot + 1) % 4) as Dir;
    };

    // ---------- keyboard ----------
    const keys = new Set<string>();
    const onKey = (e: KeyboardEvent) => {
      if (stopped) return;
      const k = e.key.toLowerCase();
      if (e.type === 'keyup') {
        keys.delete(k);
        return;
      }
      if (!playing) return;
      if (e.repeat && !['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'e'].includes(k)) return;
      unlockAudio();
      if (k === 'escape') {
        if (!shopEl.hidden || !helpEl.hidden) {
          shopEl.hidden = helpEl.hidden = true;
        } else if (tool !== 'crossbow') pickTool('crossbow');
        return;
      }
      if (k === 'b') return toggle(shopEl);
      if (k === 'h' || k === '?') return toggle(helpEl);
      if (paused() || inMenu()) return;
      keys.add(k);
      if (k >= '1' && k <= '5') pickTool(TOOLS[Number(k) - 1]);
      else if (k === 'r') turn();
      else if (k === 'l') doLoad();
      else if (k === 'x') tryPick();
      else if (k === ' ' || k === 'e') e.preventDefault();
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    };
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKey);
    const onBlur = () => keys.clear();
    addEventListener('blur', onBlur);

    // ---------- mouse ----------
    let mouseDown = false;
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top, in: true };
      if (mouseDown && tool !== 'crossbow') tryPlace(true);
    });
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') mouse.in = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || paused()) return;
      unlockAudio();
      if (e.button === 2) {
        tryPick();
        return;
      }
      mouseDown = true;
      lastPlaced = '';
      if (tool !== 'crossbow') tryPlace();
    });
    const onUp = () => (mouseDown = false);
    addEventListener('pointerup', onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---------- touch ----------
    const stickEl = $('.np-stick');
    const knob = stickEl.querySelector('i')!;
    let stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    stickEl.addEventListener('pointerdown', (e) => {
      unlockAudio();
      stickEl.setPointerCapture(e.pointerId);
      const r = stickEl.getBoundingClientRect();
      stick = { id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2, x: 0, y: 0 };
      moveStick(e);
    });
    const moveStick = (e: PointerEvent) => {
      if (e.pointerId !== stick.id) return;
      let dx = e.clientX - stick.ox;
      let dy = e.clientY - stick.oy;
      const max = 50;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      stick.x = dx / max;
      stick.y = dy / max;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stickEl.addEventListener('pointermove', moveStick);
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== stick.id) return;
      stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
      knob.style.transform = '';
    };
    stickEl.addEventListener('pointerup', endStick);
    stickEl.addEventListener('pointercancel', endStick);

    const held = new Set<string>();
    for (const b of root.querySelectorAll<HTMLElement>('[data-t]')) {
      const t = b.dataset.t!;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        unlockAudio();
        b.setPointerCapture(e.pointerId);
        b.classList.add('down');
        held.add(t);
        lastPlaced = '';
        if (t === 'load') doLoad();
        if (t === 'turn') turn();
        if (t === 'pick') tryPick();
        if (t === 'fire' && tool !== 'crossbow') tryPlace();
      });
      const up = () => {
        held.delete(t);
        b.classList.remove('down');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }

    // ---------- loop ----------
    const onResize = () => ren.resize();
    addEventListener('resize', onResize);
    ren.resize();
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      if (import.meta.env.DEV) (window as unknown as { np: Game }).np = g;
      if (!paused()) {
        const menuOpen = inMenu();
        let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
        let my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
        if (stick.id >= 0) {
          mx = stick.x;
          my = stick.y;
        }
        if (menuOpen) mx = my = 0;
        // aim with the mouse on a computer
        if (!touchMode && mouse.in && !g.p.down && g.p.swing <= 0) {
          const w = ren.toWorld(mouse.x, mouse.y);
          g.p.aim = Math.atan2(w.y - g.p.y, w.x - g.p.x);
        } else if (touchMode && (mx || my) && g.p.swing <= 0) g.p.aim = Math.atan2(my, mx);
        if (!menuOpen) {
          if (keys.has(' ') || keys.has('e') || held.has('use')) doAct();
          if (mouseDown && tool === 'crossbow') {
            const w = ren.toWorld(mouse.x, mouse.y);
            doShoot(Math.atan2(w.y - g.p.y, w.x - g.p.x));
          }
          if (held.has('fire')) {
            if (tool === 'crossbow') doShoot(g.autoAim());
            else tryPlace(true);
          }
        }
        g.update(dt, { x: mx, y: my }, !isFriend());
        if (net?.role === 'friend' && sendRate(now)) {
          toHost({ t: 'me', x: Math.round(g.me.x), y: Math.round(g.me.y), dir: g.me.dir, aim: +g.me.aim.toFixed(2), step: +g.me.step.toFixed(1) });
        } else if (net?.role === 'host') {
          for (const [slot, list] of g.outbox) net.send(slot, { t: 'msg', list } satisfies ToFriend);
          g.outbox.clear();
          if (net.friends().length && snapRate(now)) {
            net.broadcast({ t: 's', s: g.snap(), snd: netSounds } satisfies ToFriend);
            netSounds = [];
          }
        }
      }
      for (const s of g.sounds.splice(0)) {
        play(s);
        if (net?.role === 'host' && netSounds.length < 30) netSounds.push(s);
      }
      ren.draw(g, ghost(), t, paused() ? 0 : dt);
      if (playing) {
        renderHud();
        pumpToasts();
        const h = useHint();
        const extra = nearTower() ? (touchMode ? 'Tap L to load the tower' : 'L: load the tower') : '';
        const msg = [h && (touchMode ? `✋ ${h}` : `Space: ${h}`), extra].filter(Boolean).join(' · ');
        if (hintEl.textContent !== msg) hintEl.textContent = msg;
        hintEl.hidden = !msg;
        useBtn.classList.toggle('glow', !!h);
      }
    };
    raf = requestAnimationFrame(frame);
    showTitle();

    return () => {
      stopped = true;
      save();
      net?.close();
      cancelAnimationFrame(raf);
      clearInterval(saveTimer);
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      removeEventListener('blur', onBlur);
      removeEventListener('pointerup', onUp);
      removeEventListener('resize', onResize);
      root.innerHTML = '';
    };
  },
};
export default game;
