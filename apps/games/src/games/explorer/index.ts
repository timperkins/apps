// Explorer: a 3D earth that wraps around, with biomes, animals, villages, crafting, factories and a rocket to space.
// This file is the screens and controls; game.ts runs the world, render.ts draws it.
import './style.css';
import type { GameModule } from '../types';
import {
  BIOME_NAME, BUILDS, CARS, DESTINATIONS, FOOD_MENU, HOMES, ITEMS, MAX_HP, MOBS, PETS, RECIPE, RECIPES, SHOP_NAME, SILO_CARGO, SPACE_UNITS_TO_LAUNCH,
  STORE_STOCK, WEAPONS, WORLD, type CarId, type ItemId, type Recipe, type ShopKind,
} from './data';
import { DIRS, Game, REACH, newPlayer, type Building, type Dim, type Fx, type Mob, type Player, type Target, type Vehicle } from './game';
import { craftable, type Inv, type Slot } from './inventory';
import { Renderer } from './render';
import { ambience, isMuted, setMuted, sfx, stopAudio, unlockAudio } from './audio';
import { CAVE_SIZE, dist2, wd, wrap, type VillageBuilding } from './world';
import { coopBadge, coopMenu, every } from '../coop/ui';
import { PLAYER_NAMES, type FriendSession, type HostSession, type Session } from '../coop/session';

const SAVE_KEY = 'explorer-save-v1';
const COOP_PREFIX = 'trom-explorer-';
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number) => `$${Math.floor(n).toLocaleString()}`;
const icon = (id: ItemId) => ITEMS[id]?.icon ?? '❔';
const iname = (id: ItemId) => ITEMS[id]?.name ?? id;

type Panel =
  | { k: 'bag' }
  | { k: 'build'; id: number }
  | { k: 'shop'; shop: ShopKind; vb: string }
  | { k: 'house'; vb: string }
  | { k: 'map' }
  | { k: 'ship' }
  | { k: 'pause' }
  | { k: 'help' };

// what friends send the host, and the host sends friends
type ToHost = { t: 'me'; x: number; y: number; z: number; yaw: number; dim: Dim; anim: number; swing: number } | { t: 'do'; a: string; args: Record<string, unknown> };
type Snap = {
  t: 's'; time: number;
  ps: [number, number, number, number, number, Dim, number, number | null, number, number][];
  ms: [number, string, number, number, number, number, number, Dim][];
  cs: [number, CarId, number, number, number, number, number | null, number, number | null][];
  bs: [number, boolean, [ItemId, number][] | null, Slot | null, number, number, number, number][];
  rocks: [number, string, number, number, number, number][] | null;
  ship: { at: number; dest: number; moving: boolean; km: number };
  fx: Fx[];
};

const GROUPS: [Recipe['group'], string][] = [['basics', '🪵 Basics'], ['production', '🏭 Production'], ['logistics', '➡️ Logistics'], ['power', '⚡ Power & oil'], ['combat', '🔫 Combat'], ['town', '🏘️ Town'], ['space', '🚀 Space']];

const HELP = `
<h3>Getting around</h3>
<p><b>WASD</b> or arrows walk · <b>Space</b> jump · hold <b>Ctrl</b> to run · drag with the <b>right mouse button</b> (or <b>Z</b>/<b>C</b>) to turn the camera · <b>mouse wheel</b> zooms.</p>
<h3>Doing things</h3>
<p><b>Left click</b> (hold) to chop trees, break rocks, mine ore, dig the ground, punch, or shoot with a gun in your hand. <b>E</b> uses things: shop doors, cars, caves, mine shafts and machines. <b>1–0</b> pick from your hotbar. With a building in your hand, left click puts it down and <b>R</b> turns it. <b>X</b> picks a building back up. <b>F</b> eats food.</p>
<h3>Crafting</h3>
<p>Press <b>Shift</b> (or <b>Tab</b>) for your inventory and the crafting list. No research needed: everything can be made right away if you have the stuff. Parts like gears and circuits get made for you on the way.</p>
<h3>Factories</h3>
<p>Drills go on ore patches and run on electricity or coal. Furnaces smelt ore into plates (and the steel furnace turns iron into steel). Grabbers take from behind them and put in front. Belts carry things. For electricity: a water pump at the water's edge, pipes to a steam engine with coal in it, and power poles from the engine to your machines. Pumpjacks pump oil (dark puddles) through pipes to an oil refinery for fuel and plastic.</p>
<h3>To space</h3>
<p>Build a rocket silo (1000 stone, 1000 iron), put in 10 space units, carry a space starter and ride the rocket. In space, add platform to grow your ship, asteroid grabbers to catch little asteroids, crushers to turn them into ore, ice and crystals, turrets with ammo for the big ones, and thrusters with thruster fuel (1 crystal + 100 water: put ice in an oil refinery) to fly to the Moon, Mars and beyond.</p>
<h3>The world</h3>
<p>The earth is round: go straight for 1,000,000 tiles and you're back where you started. The North Pole is north of the start. At night wolves, bears, scorpions and snow wolves come out depending on where you are. Alien bugs live in purple nests: leave them alone and they mostly leave you alone, but they come for factories near them. Villages have stores, restaurants, cars to rent for a month or buy, houses to buy, pets that protect you, and cops.</p>`;

const game: GameModule = {
  mount(root, { onExit }) {
    root.innerHTML = `<div class="ex-wrap">
      <canvas class="ex-canvas"></canvas>
      <div class="ex-hud" hidden>
        <div class="ex-top">
          <div class="ex-stats"><div class="ex-hp"><i></i><span></span></div><div class="ex-line ex-money"></div><div class="ex-line ex-where"></div><div class="ex-line ex-small ex-clock"></div></div>
          <div class="ex-btns"><button data-b="bag" title="Inventory and crafting (Shift)">🎒</button><button data-b="map" title="Map (M)">🗺️</button><button data-b="friends" title="Play with friends">👥</button><button data-b="mute" title="Sound">🔊</button><button data-b="pause" title="Menu (Esc)">⏸</button></div>
        </div>
        <div class="ex-toasts"></div>
        <div class="ex-hint"></div>
        <div class="ex-cross">+</div>
        <div class="ex-queue"></div>
        <div class="ex-hotbar"></div>
        <div class="ex-touch"><div class="ex-stick"><i></i></div><button data-t="jump">⤒</button><button data-t="use">E</button><button data-t="act">⛏️</button><button data-t="bag">🎒</button><button data-t="rot">⟳</button></div>
      </div>
      <div class="ex-panel" hidden></div>
      <div class="ex-title">
        <h1>EXPLORER</h1>
        <p class="ex-sub">A whole round earth to explore, mine, build on and fly away from.</p>
        <div class="ex-menu"></div>
        <p class="ex-small ex-tip">Designed by Tim. 1,000,000 tiles around · biomes · villages · factories · rockets · up to 4 players</p>
      </div>
      <div class="ex-loading" hidden>Building the world…</div>
    </div>`;
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    const wrapEl = $('.ex-wrap');
    const canvas = $<HTMLCanvasElement>('.ex-canvas');
    const hud = $('.ex-hud'), panelEl = $('.ex-panel'), titleEl = $('.ex-title'), loadingEl = $('.ex-loading');
    const toastsEl = $('.ex-toasts'), hintEl = $('.ex-hint'), hotbarEl = $('.ex-hotbar'), queueEl = $('.ex-queue');
    const touch = matchMedia('(pointer: coarse)').matches;
    wrapEl.classList.toggle('touch', touch);

    const ren = new Renderer(canvas);
    let g: Game | null = null;
    let playing = false;
    let panel: Panel | null = null;
    let panelSig = '';
    let placeDir = 2;
    let stopped = false;
    let mineT = 0, mineKey = '', mineNeed = 1;
    let target: Target | null = null;
    let pickWx = 0, pickWz = 0, pickPoint: { x: number; y: number; z: number } | null = null;
    let autosave = 60;
    let selSlot: number | null = null;
    let craftTab: Recipe['group'] = 'basics';
    let mapZoom = 4;
    let lastHotbar = '';
    let lastQueue = '';

    // ---------- playing together ----------
    let net: Session | null = null;
    const badge = coopBadge(wrapEl, { top: 'calc(max(10px, env(safe-area-inset-top)) + 54px)', right: '10px', left: 'auto' });
    const meRate = every(15), snapRate = every(10), bRate = every(4);
    const isFriend = () => net?.role === 'friend';
    const refreshBadge = () => {
      if (!net || !g) return badge.set('', [], 0);
      if (net.role === 'host') badge.set(net.code, [0, ...net.friends()], 0);
      else badge.set(net.code, [...g.players.keys()].sort(), net.slot);
    };
    const act = (a: string, args: Record<string, unknown> = {}) => {
      if (!g) return;
      if (net?.role === 'friend') net.send({ t: 'do', a, args } satisfies ToHost);
      else g.action(g.me, a, args);
    };
    const endNet = () => {
      if (net?.role === 'host' && g) for (const s of net.friends()) dropFriend(s);
      net?.close();
      net = null;
      refreshBadge();
    };
    const dropFriend = (slot: number) => {
      if (!g) return;
      g.players.delete(slot);
      for (const m of [...g.mobs.values()]) if (m.owner === slot) g.mobs.delete(m.id);
      for (const c of [...g.cars.values()]) if (c.owner === slot) g.cars.delete(c.id);
    };
    const startHosting = (s: HostSession) => {
      if (!g) return;
      net = s;
      s.onJoin((slot) => {
        if (!g) return;
        const p = newPlayer(slot, g.w);
        p.x = g.me.x + 1.5 * slot; p.z = g.me.z + 1; p.dim = g.me.dim === 'silo' ? 'earth' : g.me.dim; p.y = g.groundY(p.dim, p.x, p.z) + 0.5;
        g.players.set(slot, p);
        g.toast(`${PLAYER_NAMES[slot]} joined your world!`);
        sfx('cash');
        refreshBadge();
        s.send(slot, {
          t: 'init', seed: g.w.seed, time: g.time, you: p,
          buildings: [...g.buildings.values()], removed: [...g.w.removed], ore: [...g.w.oreLeft], dug: [...g.w.dug], caveDug: [...g.w.caveDug],
          tiles: [...g.ship.tiles], made: g.ship.made, owned: [...g.owned].map(([k, o]) => [k, o.slot]), cars: [...g.cars.values()],
        });
      });
      s.onLeave((slot) => { dropFriend(slot); g?.toast(`${PLAYER_NAMES[slot]} left.`); refreshBadge(); });
      s.onMessage((slot, raw) => {
        const m = raw as ToHost;
        const p = g?.players.get(slot);
        if (!g || net !== s || !m || !p) return;
        if (m.t === 'me') {
          if (p.dim === 'silo') return;
          p.x = Number(m.x) || 0; p.y = Number(m.y) || 0; p.z = Number(m.z) || 0; p.yaw = Number(m.yaw) || 0; p.anim = Number(m.anim) || 0; p.swing = Number(m.swing) || 0;
          if (typeof m.dim === 'string' && m.dim === p.dim) { /* dims only change through the host */ }
          if (p.car) { const c = g.cars.get(p.car); if (c) { c.x = p.x; c.z = p.z; c.y = p.y; c.yaw = p.yaw; } }
        } else if (m.t === 'do' && typeof m.a === 'string') g.action(p, m.a, (m.args ?? {}) as Record<string, unknown>);
      });
      refreshBadge();
      g.toast(`Friends can join with the code ${s.code} (Join a friend on the start screen).`);
    };
    const startFriend = (s: FriendSession) => {
      net = s;
      s.onMessage((raw) => {
        const m = raw as Record<string, unknown> & { t: string };
        if (net !== s || !m) return;
        if (m.t === 'init') {
          const ng = new Game(Number(m.seed));
          ng.remote = true;
          ng.time = Number(m.time);
          ng.players.clear();
          const you = m.you as Player;
          ng.me = { ...newPlayer(s.slot, ng.w), ...you };
          ng.players.set(s.slot, ng.me);
          for (const k of m.removed as string[]) ng.w.removed.add(k);
          for (const [k, n] of m.ore as [string, number][]) ng.w.oreLeft.set(k, n);
          for (const [k, n] of m.dug as [string, number][]) ng.w.dug.set(k, n);
          for (const k of m.caveDug as string[]) ng.w.caveDug.add(k);
          for (const b of m.buildings as Building[]) putBuilding(ng, b);
          for (const k of m.tiles as string[]) ng.ship.tiles.add(k);
          ng.ship.made = !!m.made;
          for (const [k, slot] of m.owned as [string, number][]) ng.owned.set(k, { slot, inv: [] });
          for (const c of m.cars as Vehicle[]) ng.cars.set(c.id, c);
          g = ng;
          startPlaying();
          g.toast(`You're ${PLAYER_NAMES[s.slot]}! You're in your friend's world. Your things stay with this game.`);
          refreshBadge();
        } else if (!g) return;
        else if (m.t === 's') applySnap(g, m as unknown as Snap, s.slot);
        else if (m.t === 'me') {
          const p = m.p as Partial<Player>;
          Object.assign(g.me, { hp: p.hp, money: p.money, inv: p.inv, craftQ: p.craftQ, home: p.home, houses: p.houses, hand: p.hand, car: p.car });
          if (m.open) putBuilding(g, m.open as Building);
        } else if (m.t === 'ev') for (const e of m.list as Ev[]) applyEvent(e, s.slot);
      });
      s.onClose(() => {
        if (net !== s) return;
        net = null;
        toTitle();
        toast('The host stopped playing.');
      });
    };
    const friendsMenu = (fromTitle: boolean) => {
      if (net?.role === 'host') { endNet(); g?.toast('Playing on your own again.'); return; }
      if (isFriend()) { toast('You are in a friend’s world. Quit from the menu to leave.'); return; }
      coopMenu(wrapEl, { title: 'Explorer', prefix: COOP_PREFIX, canHost: !fromTitle, canJoin: fromTitle, onHosted: startHosting, onJoined: startFriend });
    };

    function putBuilding(gg: Game, b: Building) {
      const old = gg.buildings.get(b.id);
      if (old) for (let ox = 0; ox < BUILDS[old.type].size; ox++) for (let oz = 0; oz < BUILDS[old.type].size; oz++) gg.occ.delete(gg.occKey(old.dim, old.x + ox, old.z + oz));
      const nb = JSON.parse(JSON.stringify(b)) as Building;
      gg.buildings.set(nb.id, nb);
      for (let ox = 0; ox < BUILDS[nb.type].size; ox++) for (let oz = 0; oz < BUILDS[nb.type].size; oz++) gg.occ.set(gg.occKey(nb.dim, nb.x + ox, nb.z + oz), nb.id);
    }
    function applySnap(gg: Game, s: Snap, mySlot: number) {
      gg.time = s.time;
      const seen = new Set<number>([mySlot]);
      for (const [slot, x, y, z, yaw, dim, anim, car, hand, swing] of s.ps) {
        if (slot === mySlot) continue;
        seen.add(slot);
        let p = gg.players.get(slot);
        if (!p) { p = newPlayer(slot, gg.w); gg.players.set(slot, p); refreshBadge(); }
        Object.assign(p, { x, y, z, yaw, dim, anim, car, hand, swing });
      }
      for (const k of [...gg.players.keys()]) if (!seen.has(k)) { gg.players.delete(k); refreshBadge(); }
      const ms = new Set<number>();
      for (const [id, type, x, y, z, yaw, anim, dim] of s.ms) {
        ms.add(id);
        const m = gg.mobs.get(id);
        if (m) Object.assign(m, { x, y, z, yaw, anim, dim });
        else gg.mobs.set(id, { id, type, dim, x, y, z, yaw, hp: MOBS[type]?.hp ?? 10, tgt: null, t: 0, wx: x, wz: z, hx: x, hz: z, angry: 0, anim, flee: 0 } as Mob);
      }
      for (const id of [...gg.mobs.keys()]) if (!ms.has(id)) gg.mobs.delete(id);
      const cs = new Set<number>();
      for (const [id, car, x, y, z, yaw, driver, owner, rentDay] of s.cs) {
        cs.add(id);
        if (driver === mySlot) { const c = gg.cars.get(id); if (c) { c.driver = driver; continue; } }
        gg.cars.set(id, { id, car, x, y, z, yaw, driver, owner, rentDay });
      }
      for (const id of [...gg.cars.keys()]) if (!cs.has(id)) gg.cars.delete(id);
      for (const [id, on, items, hold, swing, aim, units, launch] of s.bs) {
        const b = gg.buildings.get(id);
        if (!b) continue;
        b.on = on;
        if (items) b.items = items.map(([iid, p]) => ({ id: iid, p }));
        b.hold = hold; b.swing = swing; b.aim = aim; b.units = units; b.launch = launch;
      }
      if (s.rocks) gg.ship.rocks = s.rocks.map(([id, kind, size, x, z, rot]) => ({ id, kind: kind as 'rusty', size: size as 0, x, z, vx: 0, vz: 0, hp: 1, rot }));
      Object.assign(gg.ship, s.ship);
      for (const f of s.fx) gg.fx.push(f);
    }
    function snapFor(gg: Game, p: Player): Snap {
      const ps: Snap['ps'] = [...gg.players.values()].map((q) => [q.slot, q.x, q.y, q.z, q.yaw, q.dim, q.anim, q.car, q.hand, q.swing]);
      const ms: Snap['ms'] = [];
      for (const m of gg.mobs.values()) if (m.dim === p.dim && dist2(m.x, m.z, p.x, p.z) < 100 * 100) ms.push([m.id, m.type, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), +m.anim.toFixed(2), m.dim]);
      const cs: Snap['cs'] = [...gg.cars.values()].map((c) => [c.id, c.car, c.x, c.y, c.z, c.yaw, c.driver, c.owner, c.rentDay]);
      const bs: Snap['bs'] = [];
      for (const b of gg.buildings.values()) {
        if (b.dim !== p.dim || dist2(b.x, b.z, p.x, p.z) > 70 * 70) continue;
        bs.push([b.id, !!b.on, b.items ? b.items.map((i) => [i.id, +i.p.toFixed(2)]) : null, b.hold ?? null, +(b.swing ?? 0).toFixed(2), +(b.aim ?? 0).toFixed(2), b.units ?? 0, b.launch ?? 0]);
      }
      return {
        t: 's', time: gg.time, ps, ms, cs, bs,
        rocks: p.dim === 'space' ? gg.ship.rocks.map((r) => [r.id, r.kind, r.size, +r.x.toFixed(2), +r.z.toFixed(2), +r.rot.toFixed(2)]) : null,
        ship: { at: gg.ship.at, dest: gg.ship.dest, moving: gg.ship.moving, km: gg.ship.km },
        fx: [],
      };
    }

    type Ev = { t: string; [k: string]: unknown };
    /** Things that happened in the world: show them here, and tell friends. */
    function applyEvent(e: Ev, mySlot: number) {
      if (!g) return;
      const to = e.to as number | undefined;
      switch (e.t) {
        case 'b+': if (g.remote) putBuilding(g, e.b as Building); break;
        case 'b-': if (g.remote) { const b = g.buildings.get(e.id as number); if (b) { for (let ox = 0; ox < BUILDS[b.type].size; ox++) for (let oz = 0; oz < BUILDS[b.type].size; oz++) g.occ.delete(g.occKey(b.dim, b.x + ox, b.z + oz)); g.buildings.delete(b.id); } } break;
        case 'rm': { const k = e.k as string; if (g.remote) g.w.removed.add(k); const [x, z] = k.split(',').map(Number); ren.markChunk(x, z); break; }
        case 'ore': if (g.remote) g.w.oreLeft.set(e.k as string, e.n as number); { const [x, z] = (e.k as string).split(',').map(Number); ren.markChunk(x, z); } break;
        case 'dig': { const k = e.k as string; if (g.remote) { if (e.v) g.w.dug.set(k, e.v as number); else g.w.dug.delete(k); } const [x, z] = k.split(',').map(Number); ren.markChunk(x, z); break; }
        case 'cdig': if (g.remote) g.w.caveDug.add(e.k as string); ren.markCave(); break;
        case 'tile': if (g.remote) g.ship.tiles.add(e.k as string); break;
        case 'car+': if (g.remote) g.cars.set((e.c as Vehicle).id, e.c as Vehicle); break;
        case 'car-': if (g.remote) g.cars.delete(e.id as number); break;
        case 'own': { if (g.remote) g.owned.set(e.id as string, { slot: e.slot as number, inv: [] }); const v = g.w.villageAt(g.me.x, g.me.z); if (v) ren.markChunk(v.x, v.z), ren.markChunk(v.x - 32, v.z), ren.markChunk(v.x + 32, v.z), ren.markChunk(v.x, v.z - 32), ren.markChunk(v.x, v.z + 32), ren.markChunk(v.x - 32, v.z - 32), ren.markChunk(v.x + 32, v.z + 32), ren.markChunk(v.x - 32, v.z + 32), ren.markChunk(v.x + 32, v.z - 32); break; }
        case 'toast': if (to === mySlot) toast(e.s as string); break;
        case 'got': if (to === mySlot) gotPopup(e.id as ItemId, e.n as number); break;
        case 'hinv': if (to === mySlot) houseInv = e.inv as Inv; break;
        case 'tp': if (to === mySlot && g.remote) { Object.assign(g.me, { x: e.x, y: e.y, z: e.z, dim: e.dim }); if (e.yaw !== undefined) g.me.yaw = e.yaw as number; g.me.vy = 0; } break;
      }
    }
    let houseInv: Inv = [];

    // ---------- toasts ----------
    function toast(s: string) {
      const el = document.createElement('div');
      el.className = 'ex-toast';
      el.textContent = s;
      toastsEl.appendChild(el);
      while (toastsEl.children.length > 4) toastsEl.firstChild?.remove();
      setTimeout(() => el.classList.add('out'), 4200);
      setTimeout(() => el.remove(), 4800);
    }
    const gotQ = new Map<ItemId, number>();
    let gotT = 0;
    function gotPopup(id: ItemId, n: number) { gotQ.set(id, (gotQ.get(id) ?? 0) + n); gotT = 0.35; }

    // ---------- title screen ----------
    function readSave(): ReturnType<Game['save']> | null {
      try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); return s && s.v === 1 ? s : null; } catch { return null; }
    }
    function doSave(quiet = false) {
      if (!g || g.remote) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(g.save()));
        if (!quiet) toast('Saved!');
      } catch { toast('Couldn’t save (the browser storage is full).'); }
    }
    function titleMenu() {
      const s = readSave();
      const menu = $('.ex-menu');
      menu.innerHTML = `
        ${s ? `<button class="ex-btn big" data-m="continue">▶ Continue<small>Day ${Math.floor(s.time / 600) + 1} · ${money(s.me.money)}</small></button>` : ''}
        <button class="ex-btn ${s ? '' : 'big'}" data-m="new">🌍 New world</button>
        <button class="ex-btn" data-m="join">👥 Join a friend</button>
        <button class="ex-btn" data-m="help">❓ How to play</button>
        <button class="ex-btn ghost" data-m="exit">← Back to games</button>`;
    }
    $('.ex-menu').addEventListener('click', (e) => {
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-m]')?.dataset.m;
      unlockAudio();
      sfx('click');
      if (m === 'continue') { const s = readSave(); if (s) { try { g = Game.load(s); } catch { toast('That save didn’t load. Starting a new world.'); g = new Game(Math.floor(Math.random() * 1e9)); } startPlaying(); } }
      else if (m === 'new') {
        if (readSave() && !confirmNew()) return;
        g = new Game(Math.floor(Math.random() * 1e9));
        startPlaying();
        toast('Welcome to Explorer! Chop trees and break rocks (hold left click), then press Shift to craft.');
        setTimeout(() => toast('There’s a village just east of you, with stores, food, cars and pets.'), 4500);
      } else if (m === 'join') friendsMenu(true);
      else if (m === 'help') openPanel({ k: 'help' });
      else if (m === 'exit') onExit();
    });
    let confirmArmed = 0;
    function confirmNew() {
      if (Date.now() - confirmArmed < 4000) return true;
      confirmArmed = Date.now();
      toast('Starting a new world replaces your saved one. Click New world again to be sure.');
      return false;
    }
    function startPlaying() {
      titleEl.hidden = true;
      hud.hidden = false;
      playing = true;
      loadingEl.hidden = false;
      closePanel();
      lastHotbar = '';
      if (g) { ren.camYaw = g.me.yaw + Math.PI; }
    }
    function toTitle() {
      if (g && !g.remote) doSave(true);
      endNet();
      playing = false;
      g = null;
      hud.hidden = true;
      titleEl.hidden = false;
      closePanel();
      titleMenu();
    }
    titleMenu();

    // ---------- keys and mouse ----------
    const keys = new Set<string>();
    let mouseX = 0, mouseY = 0, mouseDown = false, rDrag = false, lastMX = 0, lastMY = 0;
    const onKey = (e: KeyboardEvent) => {
      if (!playing || !g) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (e.type === 'keyup') { keys.delete(k); return; }
      unlockAudio();
      if (k === 'shift' || k === 'tab' || k === 'i') { e.preventDefault(); if (panel?.k === 'bag') closePanel(); else openPanel({ k: 'bag' }); return; }
      if (k === 'escape') { if (panel) closePanel(); else openPanel({ k: 'pause' }); return; }
      if (k === 'm') { if (panel?.k === 'map') closePanel(); else openPanel({ k: 'map' }); return; }
      if (k === 'e') { interact(); return; }
      if (k === 'r') { placeDir = (placeDir + 1) & 3; sfx('click'); return; }
      if (k === 'x') { if (target?.k === 'build') act('pickup', { id: target.id }); return; }
      if (k === 'f') { act('eat', { slot: g.me.hand }); return; }
      if (k >= '0' && k <= '9') { act('hand', { i: k === '0' ? 9 : Number(k) - 1 }); g.me.hand = k === '0' ? 9 : Number(k) - 1; return; }
      if (k === ' ') e.preventDefault();
      keys.add(k);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (!playing) return;
      unlockAudio();
      if (e.pointerType === 'touch') return;
      if (e.button === 2 || e.button === 1) { rDrag = true; lastMX = e.clientX; lastMY = e.clientY; return; }
      mouseDown = true;
      clickAct();
    });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') return; mouseDown = false; rDrag = false; mineT = 0; });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouseY = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (rDrag) {
        ren.camYaw -= (e.clientX - lastMX) * 0.008;
        ren.camPitch = Math.max(-0.2, Math.min(1.35, ren.camPitch + (e.clientY - lastMY) * 0.006));
        lastMX = e.clientX; lastMY = e.clientY;
      }
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); ren.camDist = Math.max(3.5, Math.min(30, ren.camDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });

    // ---------- touch ----------
    let stickId: number | null = null, stickX = 0, stickY = 0, stickCx = 0, stickCy = 0, lookId: number | null = null, lookX = 0, lookY = 0, lookMoved = 0, touchAct = false;
    const stickEl = $('.ex-stick'), knob = stickEl.querySelector('i')!;
    wrapEl.addEventListener('touchstart', (e) => {
      if (!playing || panel) return;
      unlockAudio();
      for (const t of Array.from(e.changedTouches)) {
        const el = t.target as HTMLElement;
        const tb = el.closest<HTMLElement>('[data-t]');
        if (tb) {
          e.preventDefault();
          const k = tb.dataset.t;
          if (k === 'jump') keys.add(' ');
          else if (k === 'use') interact();
          else if (k === 'act') { touchAct = true; mouseDown = true; mouseX = 0; mouseY = 0; clickAct(); }
          else if (k === 'bag') openPanel({ k: 'bag' });
          else if (k === 'rot') placeDir = (placeDir + 1) & 3;
          continue;
        }
        if (el.closest('.ex-hotbar,.ex-btns,.ex-panel')) continue;
        if (t.clientX < innerWidth * 0.4 && stickId === null) { stickId = t.identifier; stickCx = t.clientX; stickCy = t.clientY; stickX = stickY = 0; stickEl.style.left = `${t.clientX - 60}px`; stickEl.style.top = `${t.clientY - 60}px`; stickEl.classList.add('on'); }
        else if (lookId === null) { lookId = t.identifier; lookX = t.clientX; lookY = t.clientY; lookMoved = 0; }
      }
    }, { passive: false });
    wrapEl.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickId) {
          stickX = Math.max(-1, Math.min(1, (t.clientX - stickCx) / 50));
          stickY = Math.max(-1, Math.min(1, (t.clientY - stickCy) / 50));
          knob.style.transform = `translate(${stickX * 40}px, ${stickY * 40}px)`;
        } else if (t.identifier === lookId) {
          ren.camYaw -= (t.clientX - lookX) * 0.01;
          ren.camPitch = Math.max(-0.2, Math.min(1.35, ren.camPitch + (t.clientY - lookY) * 0.008));
          lookMoved += Math.abs(t.clientX - lookX) + Math.abs(t.clientY - lookY);
          lookX = t.clientX; lookY = t.clientY;
        }
      }
      if (playing && !panel) e.preventDefault();
    }, { passive: false });
    const touchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const tb = (t.target as HTMLElement).closest<HTMLElement>('[data-t]');
        if (tb?.dataset.t === 'jump') keys.delete(' ');
        if (tb?.dataset.t === 'act') { touchAct = false; mouseDown = false; mineT = 0; }
        if (t.identifier === stickId) { stickId = null; stickX = stickY = 0; knob.style.transform = ''; stickEl.classList.remove('on'); }
        if (t.identifier === lookId) {
          lookId = null;
          // a tap (not a drag) acts on what you tapped
          if (lookMoved < 12 && playing && !panel) {
            const r = canvas.getBoundingClientRect();
            mouseX = ((t.clientX - r.left) / r.width) * 2 - 1;
            mouseY = -((t.clientY - r.top) / r.height) * 2 + 1;
            updatePick();
            clickAct();
          }
        }
      }
    };
    wrapEl.addEventListener('touchend', touchEnd);
    wrapEl.addEventListener('touchcancel', touchEnd);

    // ---------- HUD buttons ----------
    $('.ex-btns').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]')?.dataset.b;
      unlockAudio();
      if (b === 'bag') panel?.k === 'bag' ? closePanel() : openPanel({ k: 'bag' });
      else if (b === 'map') panel?.k === 'map' ? closePanel() : openPanel({ k: 'map' });
      else if (b === 'friends') friendsMenu(false);
      else if (b === 'pause') openPanel({ k: 'pause' });
      else if (b === 'mute') { setMuted(!isMuted()); updateMuteBtn(); }
    });
    const updateMuteBtn = () => { $('[data-b="mute"]').textContent = isMuted() ? '🔇' : '🔊'; };
    updateMuteBtn();
    hotbarEl.addEventListener('click', (e) => {
      const i = (e.target as HTMLElement).closest<HTMLElement>('[data-h]')?.dataset.h;
      if (i !== undefined && g) { act('hand', { i: Number(i) }); g.me.hand = Number(i); }
    });

    // ---------- acting ----------
    function heldItem(): Slot | null { return g ? g.me.inv[g.me.hand] ?? null : null; }
    function updatePick() {
      if (!g) return;
      const dim = g.me.dim === 'silo' ? 'earth' : g.me.dim;
      const r = ren.pick(g, dim, touch && !touchAct ? mouseX : mouseX, mouseY);
      target = r.target;
      pickWx = r.wx; pickWz = r.wz;
      pickPoint = r.point ? { x: r.point.x, y: r.point.y, z: r.point.z } : null;
      // the far-off ground isn't a target
      if (target && pickPoint && (target.k === 'ground' || target.k === 'feat' || target.k === 'cave' || target.k === 'build')) {
        if (Math.hypot(pickPoint.x, pickPoint.z) > REACH + 1) target = null;
      }
    }
    function clickAct() {
      if (!g || panel) return;
      const me = g.me;
      const h = heldItem();
      const it = h ? ITEMS[h.id] : null;
      if (it?.weapon && pickPoint) {
        const wx = me.dim === 'earth' ? wrap(me.x + pickPoint.x) : me.x + pickPoint.x;
        const wz = me.dim === 'earth' ? wrap(me.z + pickPoint.z) : me.z + pickPoint.z;
        act('fire', { x: wx, y: pickPoint.y, z: wz });
        return;
      }
      if (it?.food) { act('eat', { slot: me.hand }); return; }
      if (target?.k === 'build') { openPanel({ k: 'build', id: target.id }); mouseDown = false; return; }
      if ((it?.build || h?.id === 'dirt' || h?.id === 'sand' || h?.id === 'snow') && target?.k !== 'mob') {
        const [x, z] = placeSpot();
        act('place', { slot: me.hand, x, z, dir: placeDir });
        mouseDown = false;
        return;
      }
      if (target?.k === 'mob') { act('hit', { tg: target }); me.swing = 1; return; }
      if (target?.k === 'feat') {
        const f = g.w.feature(target.x, target.z);
        if (f?.kind === 'nest') { act('hit', { tg: target }); me.swing = 1; }
        if (f?.kind === 'cave' || f?.kind === 'shaft') { act('enter', { tg: target }); mouseDown = false; }
      }
    }
    function placeSpot(): [number, number] {
      if (!g) return [0, 0];
      const h = heldItem();
      const size = h && ITEMS[h.id]?.build ? BUILDS[ITEMS[h.id].build!].size : 1;
      const off = (size - 1) / 2;
      return [Math.floor(pickWx - off), Math.floor(pickWz - off)];
    }
    function mineTime(tg: Target): number {
      if (!g) return 1;
      const fast = g.me.inv.some((s) => s?.id === 'steel_pickaxe') ? 0.5 : 1;
      if (tg.k === 'feat') {
        const f = g.w.feature(tg.x, tg.z);
        if (!f) return 0;
        const t: Record<string, number> = { tree: 1.1, pine: 1.1, palm: 1.1, snowtree: 1.1, cactus: 0.7, rock: 1.4, ore: 0.75, bush: 0.3, flower: 0.15 };
        return (t[f.kind] ?? 0) * fast;
      }
      if (tg.k === 'cave') return 1.1 * fast;
      if (tg.k === 'ground') return 0.7 * fast;
      return 0;
    }
    function interact() {
      if (!g) return;
      const me = g.me;
      if (panel) { closePanel(); return; }
      if (me.car) { act('car'); return; }
      for (const c of g.cars.values()) if (dist2(c.x, c.z, me.x, me.z) < 9 && c.driver === null && me.dim === 'earth' && c.owner === me.slot) { act('car'); return; }
      const door = g.villageDoor(me);
      if (door) {
        if (door.kind === 'shop') { openPanel({ k: 'shop', shop: door.shop!, vb: door.id }); sfx('door'); return; }
        const o = g.owned.get(door.id);
        if (o && o.slot === me.slot) { houseInv = g.remote ? houseInv : o.inv; openPanel({ k: 'house', vb: door.id }); sfx('door'); return; }
        toast(o ? `${PLAYER_NAMES[o.slot]} lives here.` : 'Nobody answers. (Houses are for sale at the HOMES shop.)');
        return;
      }
      for (const c of g.cars.values()) if (dist2(c.x, c.z, me.x, me.z) < 9 && c.driver === null && me.dim === 'earth') { act('car'); return; }
      if (me.dim === 'earth') {
        for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) {
          const tx = Math.floor(me.x) + ox, tz = Math.floor(me.z) + oz;
          const f = g.w.feature(tx, tz);
          if (f && (f.kind === 'cave' || f.kind === 'shaft')) { act('enter', { tg: { k: 'feat', x: wrap(tx), z: wrap(tz) } }); return; }
        }
      } else if (me.dim !== 'space' && me.dim !== 'silo') {
        const c = g.w.cave(me.dim);
        if (dist2(me.x, me.z, c.exit[0], c.exit[1]) < 9) { act('leave'); return; }
      }
      if (target?.k === 'build') { openPanel({ k: 'build', id: target.id }); return; }
      // nearest building
      let best: Building | null = null, bd = 9;
      for (const b of g.buildings.values()) if (b.dim === me.dim) { const d = dist2(b.x + BUILDS[b.type].size / 2, b.z + BUILDS[b.type].size / 2, me.x, me.z); if (d < bd && b.type !== 'belt' && b.type !== 'pipe' && b.type !== 'road') { bd = d; best = b; } }
      if (best) openPanel({ k: 'build', id: best.id });
    }

    // ---------- panels ----------
    function openPanel(p: Panel) {
      panel = p;
      panelSig = '';
      selSlot = null;
      if (p.k === 'build') act('open', { id: p.id });
      renderPanel();
      panelEl.hidden = false;
      sfx('click');
    }
    function closePanel() {
      if (panel?.k === 'build') act('open', { id: 0 });
      panel = null;
      panelEl.hidden = true;
      panelEl.innerHTML = '';
    }
    function slotHtml(s: Slot | null | undefined, attrs: string, extra = '') {
      return `<button class="ex-slot ${extra}" ${attrs}>${s ? `<span class="ic">${icon(s.id)}</span><b>${s.n > 1 ? s.n : ''}</b>` : ''}</button>`;
    }
    function bagHtml(mode: 'move' | 'put' | 'sell' | 'hput') {
      if (!g) return '';
      const inv = g.me.inv;
      return `<div class="ex-inv">${inv.map((s, i) => slotHtml(s, `data-inv="${i}" data-mode="${mode}" title="${s ? esc(iname(s.id)) + (mode === 'sell' ? ` · sells for ${money(ITEMS[s.id].sell ?? (ITEMS[s.id].build ? 5 : 0))}` : '') : ''}"`, `${i < 10 ? 'hb' : ''} ${selSlot === i ? 'sel' : ''} ${g!.me.hand === i ? 'hand' : ''}`)).join('')}</div>`;
    }
    function recipeHtml(r: Recipe) {
      if (!g) return '';
      const can = craftable(g.me.inv, r.id);
      return `<div class="ex-recipe ${can ? '' : 'no'}" data-craft="${r.id}" title="${esc(iname(r.out))}">
        <span class="ic">${icon(r.out)}</span>
        <div><b>${esc(iname(r.out))}${r.n > 1 ? ` ×${r.n}` : ''}</b><small>${r.inp.map(([id, n]) => `${n} ${icon(id)}`).join(' ')}</small></div>
        <em>${can || ''}</em>${can >= 5 ? `<button data-craft5="${r.id}">×5</button>` : ''}
      </div>`;
    }
    function renderPanel() {
      if (!g || !panel) return;
      const me = g.me;
      let html = '';
      const p = panel;
      if (p.k === 'bag') {
        const q = me.craftQ;
        html = `<div class="ex-cols"><div><h2>🎒 Inventory</h2>${bagHtml('move')}<p class="ex-small">Click two slots to swap them. The top row is your hotbar (keys 1–0). ${money(me.money)}</p>
          ${q.length ? `<div class="ex-cq"><b>Crafting:</b> ${q.slice(0, 12).map((x) => icon(RECIPE[x.id].out)).join(' ')}${q.length > 12 ? ` +${q.length - 12}` : ''} <button data-c="cancel">Cancel last</button></div>` : ''}</div>
          <div><h2>🛠️ Crafting</h2><div class="ex-tabs">${GROUPS.map(([k, n]) => `<button data-tab="${k}" class="${craftTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          <div class="ex-recipes">${RECIPES.filter((r) => r.group === craftTab).map(recipeHtml).join('')}</div></div></div>`;
      } else if (p.k === 'build') {
        const b = g.buildings.get(p.id);
        if (!b) { closePanel(); return; }
        html = buildingPanel(b);
      } else if (p.k === 'shop') html = shopPanel(p.shop, p.vb);
      else if (p.k === 'house') {
        html = `<h2>🏠 Your house</h2><p>You wake up here if you get knocked out. The storage chest keeps things safe.</p>
          <div class="ex-cols"><div><h3>Storage</h3><div class="ex-inv">${houseInv.map((s, i) => slotHtml(s, `data-htake="${i}"`)).join('')}</div></div>
          <div><h3>Your bag (click to store)</h3>${bagHtml('hput')}</div></div>`;
      } else if (p.k === 'map') html = `<h2>🗺️ Map</h2><canvas class="ex-map" width="420" height="420"></canvas><div class="ex-row"><button data-zoom="-1">−</button><span>${mapZoom * 105} tiles across</span><button data-zoom="1">+</button></div><p class="ex-small">${mapInfo()}</p>`;
      else if (p.k === 'ship') html = shipPanel();
      else if (p.k === 'pause') html = `<h2>⏸ Paused</h2><p class="ex-small">(The world keeps going while menus are open.)</p><div class="ex-stack">
        <button class="ex-btn" data-c="close">▶ Back to the game</button>
        ${g.remote ? '' : '<button class="ex-btn" data-c="save">💾 Save</button>'}
        <button class="ex-btn" data-c="friends">👥 ${net?.role === 'host' ? 'Stop playing with friends' : 'Play with friends'}</button>
        <button class="ex-btn" data-c="help">❓ How to play</button>
        <button class="ex-btn ghost" data-c="quit">${g.remote ? 'Leave this world' : 'Save and quit'}</button></div>`;
      else if (p.k === 'help') html = `<h2>❓ How to play</h2><div class="ex-help">${HELP}</div><button class="ex-btn" data-c="close">Got it</button>`;
      panelEl.innerHTML = `<div class="ex-box ${p.k === 'bag' || p.k === 'build' || p.k === 'shop' || p.k === 'house' ? 'wide' : ''}"><button class="ex-x" data-c="close">✕</button>${html}</div>`;
      if (p.k === 'map') drawMap();
    }
    function panelSignature(): string {
      if (!g || !panel) return '';
      const me = g.me;
      const bag = JSON.stringify(me.inv) + me.money + me.craftQ.length + selSlot + craftTab + me.hand;
      if (panel.k === 'bag') return bag;
      if (panel.k === 'build') { const b = g.buildings.get(panel.id); return bag + JSON.stringify(b ? { ...b, items: null, swing: 0, aim: 0, burn: Math.ceil(b.burn ?? 0), prog: Math.round((b.prog ?? 0) * 10), oil: Math.floor(b.oil ?? 0), power: Math.round((b.power ?? 0) * 10) } : null) + g.ship.moving; }
      if (panel.k === 'shop' || panel.k === 'house') return bag + JSON.stringify(houseInv) + g.owned.size + g.cars.size;
      if (panel.k === 'ship') return `${g.ship.at}${g.ship.dest}${g.ship.moving}${Math.floor(g.ship.km / 50)}${g.shipSpeed()}`;
      return panel.k;
    }

    function slotRow(label: string, s: Slot | null | undefined, from: string, id: number) {
      return `<div class="ex-mslot"><small>${label}</small>${slotHtml(s, `data-btake="${from}" data-bid="${id}"`)}</div>`;
    }
    function buildingPanel(b: Building): string {
      if (!g) return '';
      const def = BUILDS[b.type];
      const powerLine = def.power ? `<p class="ex-small">${b.dim === 'space' ? '⚡ Powered by the ship' : (b.power ?? 0) > 0 ? `⚡ Power ${Math.round((b.power ?? 0) * 100)}%` : b.type === 'miner' ? (b.fuel || (b.burn ?? 0) > 0 ? '🔥 Running on fuel (no electricity)' : '⚠️ No power: put coal in it, or connect a power pole') : '⚠️ No power: connect it to a power pole near a steam engine'}</p>` : '';
      const status = `<p class="ex-status">${b.on ? '🟢 Working' : '⚪ Idle'}</p>`;
      let body = '';
      switch (b.type) {
        case 'chest': case 'house':
          body = `${b.hub ? `<p>This is your ship's hub. It powers everything on the platform.</p><div class="ex-row"><button class="ex-btn" data-c="ship">🧭 Ship controls</button>${g.ship.at === 0 && !g.ship.moving ? '<button class="ex-btn" data-c="down">🪂 Fly back down to Earth</button>' : ''}</div>` : ''}
            ${b.type === 'house' ? '<div class="ex-row"><button class="ex-btn" data-c="sethome">🛏️ Sleep here (wake up here)</button></div>' : ''}
            <div class="ex-inv">${(b.inv ?? []).map((s, i) => slotHtml(s, `data-btake="inv" data-bid="${b.id}" data-i="${i}"`)).join('')}</div><button class="ex-mini" data-btake="all" data-bid="${b.id}">Take everything</button>`;
          break;
        case 'furnace': case 'steel_furnace':
          body = `<div class="ex-row">${slotRow('Ore in', b.inp, 'inp', b.id)}${slotRow('Fuel', b.fuel, 'fuel', b.id)}<span class="ex-arrow">→ ${Math.round((b.prog ?? 0) * 100)}%</span>${slotRow('Out', b.out, 'out', b.id)}</div>
            <p class="ex-small">${b.type === 'steel_furnace' ? 'Smelts twice as fast. 2 iron plates → 1 steel.' : 'Iron ore → iron plate, copper ore → copper plate, stone → brick.'} Fuel: coal, wood, carbon or fuel.</p>`;
          break;
        case 'miner':
          body = `<div class="ex-row">${slotRow('Fuel', b.fuel, 'fuel', b.id)}<span class="ex-arrow">⛏️ ${Math.round((b.prog ?? 0) * 100)}%</span>${slotRow('Ore', b.out, 'out', b.id)}</div><p class="ex-small">Mines the 3×3 tiles around it and pushes ore out the front (onto a belt or into a chest/furnace).</p>`;
          break;
        case 'steam_engine':
          body = `<div class="ex-row">${slotRow('Fuel', b.fuel, 'fuel', b.id)}</div><p>${b.water ? '💧 Has water' : '⚠️ No water: connect it with pipes to a water pump'} · ${b.on ? '♨️ Making power' : 'Not making power'}</p><p class="ex-small">Power poles carry the power to machines.</p>`;
          break;
        case 'assembler': {
          const r = b.recipe ? RECIPE[b.recipe] : null;
          body = `<p>Makes: <select class="ex-sel" data-recipe="${b.id}"><option value="">(pick something)</option>${RECIPES.filter((x) => x.group !== 'space' || x.id === 'space_unit' || x.id === 'thruster_fuel').map((x) => `<option value="${x.id}" ${b.recipe === x.id ? 'selected' : ''}>${icon(x.out)} ${esc(iname(x.out))}</option>`).join('')}</select></p>
            ${r ? `<div class="ex-row">${r.inp.map(([id, n]) => `<div class="ex-mslot"><small>${n} needed</small><div class="ex-slot"><span class="ic">${icon(id)}</span><b>${b.parts?.[id] ?? 0}</b></div></div>`).join('')}<span class="ex-arrow">→ ${Math.round((b.prog ?? 0) * 100)}%</span>${slotRow('Out', b.out, 'out', b.id)}</div><button class="ex-mini" data-btake="parts" data-bid="${b.id}">Take the parts back</button>` : ''}`;
          break;
        }
        case 'oil_refinery':
          body = `<div class="ex-row">${slotRow('Ice in', b.inp, 'inp', b.id)}<span class="ex-arrow">→</span></div><div class="ex-inv">${(b.inv ?? []).map((s, i) => slotHtml(s, `data-btake="inv" data-bid="${b.id}" data-i="${i}"`)).join('')}</div><p class="ex-small">Crude oil from pumpjacks (connected with pipes) → fuel + plastic. Ice → 96 water.</p>`;
          break;
        case 'pumpjack': body = `<p>🛢️ Oil waiting: ${Math.floor(b.oil ?? 0)}</p><p class="ex-small">Connect it to an oil refinery with pipes.</p>`; break;
        case 'water_pump': body = '<p>💧 Pumps water into pipes connected to it.</p>'; break;
        case 'crusher':
          body = `<div class="ex-row">${slotRow('Asteroid', b.inp, 'inp', b.id)}<span class="ex-arrow">→ ${Math.round((b.prog ?? 0) * 100)}%</span></div><div class="ex-inv">${(b.inv ?? []).map((s, i) => slotHtml(s, `data-btake="inv" data-bid="${b.id}" data-i="${i}"`)).join('')}</div>
            <p class="ex-small">Rusty → copper ore (96%) + iron ore (80%). Carbon → carbon (98%) + stone. Cryser → ice + crystals (80%).</p>`;
          break;
        case 'turret': body = `<div class="ex-row">${slotRow('Ammo', b.inv?.[0], 'inv', b.id)}</div><p class="ex-small">${b.dim === 'space' ? 'Shoots medium, big and huge asteroids.' : 'Shoots hostile animals and alien bugs.'} Click ammo in your bag to load it.</p>`; break;
        case 'thruster': body = `<div class="ex-row">${slotRow('Thruster fuel', b.fuel, 'fuel', b.id)}</div><p class="ex-small">Thruster fuel: 1 crystal + 100 water. More thrusters = faster (up to 8).</p><button class="ex-btn" data-c="ship">🧭 Ship controls</button>`; break;
        case 'rocket_silo': {
          const cargo = (b.inv ?? []).reduce((a, s) => a + (s?.n ?? 0), 0);
          body = `<p>🛰️ Space units: <b>${b.units ?? 0}</b> / ${SPACE_UNITS_TO_LAUNCH} for a launch ${(b.units ?? 0) ? `<button class="ex-mini" data-btake="units" data-bid="${b.id}">take out</button>` : ''}</p>
            <p>Cargo (${cargo}/${SILO_CARGO}):</p><div class="ex-inv">${(b.inv ?? []).map((s, i) => slotHtml(s, `data-btake="inv" data-bid="${b.id}" data-i="${i}"`)).join('')}</div>
            ${b.launch ? `<p class="ex-big">🚀 Launching in ${Math.ceil(b.launch)}…</p>` : `<div class="ex-row"><button class="ex-btn" data-launch="ride" ${(b.units ?? 0) < SPACE_UNITS_TO_LAUNCH ? 'disabled' : ''}>🧑‍🚀 Ride to space ${g.me.inv.some((s) => s?.id === 'space_starter') ? '' : '(needs a space starter)'}</button><button class="ex-btn" data-launch="cargo" ${(b.units ?? 0) < SPACE_UNITS_TO_LAUNCH || !cargo ? 'disabled' : ''}>📦 Send the cargo up</button></div>`}
            <p class="ex-small">A rocket holds 100 things OR 1 you. Space units: 10 iron + 1 copper each.</p>`;
          break;
        }
        case 'grabber': case 'long_grabber': case 'bulk_grabber':
          body = `<p>Takes from ${b.type === 'long_grabber' ? '2 tiles' : 'the tile'} behind and puts it ${b.type === 'long_grabber' ? '2 tiles' : ''} in front${b.type === 'bulk_grabber' ? ', 5 at a time' : ''}. Holding: ${b.hold ? `${icon(b.hold.id)} ${b.hold.n}` : 'nothing'}</p>`;
          break;
        case 'asteroid_grabber': body = `<p>Catches little asteroids that come within 6 tiles and puts them in front (in a crusher or chest). Holding: ${b.hold ? icon(b.hold.id) : 'nothing'}</p>`; break;
        case 'belt': body = `<p>Carries things the way it points. On it: ${(b.items ?? []).map((i) => icon(i.id)).join(' ') || 'nothing'}</p>`; break;
        case 'underground_belt': case 'underground_pipe': body = `<p>${b.ug === 'out' ? 'Way out' : b.pair ? 'Way in (linked)' : 'Way in: put another one ahead (same way) to link them'}.</p>`; break;
        case 'power_pole': case 'big_power_pole': case 'substation': body = `<p>Wires reach ${def.wire} tiles. Powers machines within ${def.area} tiles.</p>`; break;
        case 'campfire': body = '<p>🔥 Stand near it to heal faster.</p>'; break;
        default: body = '';
      }
      return `<h2>${ITEMS[b.type]?.icon ?? ''} ${esc(b.hub ? 'Ship hub' : def.name)}</h2>${status}${powerLine}${body}
        <div class="ex-row ex-acts">${def.size === 1 && b.type !== 'space_platform' ? '<button class="ex-mini" data-c="rotate">⟳ Turn</button>' : ''}${b.hub ? '' : '<button class="ex-mini" data-c="pickup">✋ Pick up</button>'}</div>
        <h3>Your bag <small>(click to put in · shift-click puts the whole stack)</small></h3>${bagHtml('put')}`;
    }
    function shopPanel(shop: ShopKind, vb: string): string {
      if (!g) return '';
      const me = g.me;
      const v = g.w.villageAt(me.x, me.z);
      let body = '';
      if (shop === 'store') {
        body = `<div class="ex-cols"><div><h3>Buy</h3><div class="ex-list">${STORE_STOCK.map(([id, price]) => `<div class="ex-li"><span class="ic">${icon(id)}</span><b>${esc(iname(id))}</b><em>${money(price)}</em><button data-buy="${id}" data-n="1">Buy</button><button data-buy="${id}" data-n="10">×10</button></div>`).join('')}</div></div>
          <div><h3>Sell <small>(click; shift-click sells the stack)</small></h3>${bagHtml('sell')}</div></div>`;
      } else if (shop === 'restaurant') {
        body = `<p>🍽️ “Welcome! What can I get you?”</p><div class="ex-list">${FOOD_MENU.map(([id, price]) => `<div class="ex-li"><span class="ic">${icon(id)}</span><b>${esc(iname(id))}</b><small>+${ITEMS[id].food} health</small><em>${money(price)}</em><button data-buy="${id}" data-n="1">Buy</button></div>`).join('')}</div>`;
      } else if (shop === 'cars') {
        const mine = [...g.cars.values()].find((c) => c.owner === me.slot);
        body = `<p>🚗 Rent a car for one month (${30} game days) or buy one to keep. ${mine ? `<br><b>You have a ${CARS[mine.car].name}${mine.rentDay ? ` (rented until day ${mine.rentDay})` : ''}.</b>` : ''}</p>
          <div class="ex-list">${(Object.keys(CARS) as CarId[]).map((c) => `<div class="ex-li"><span class="ic" style="color:${CARS[c].color}">🚗</span><b>${CARS[c].name}</b><small>speed ${CARS[c].speed}</small><button data-buy="rent:${c}" data-n="1">Rent ${money(CARS[c].rent)}</button><button data-buy="buy:${c}" data-n="1">Buy ${money(CARS[c].buy)}</button></div>`).join('')}</div>`;
      } else if (shop === 'homes') {
        const forSale = v ? v.buildings.filter((b) => b.kind === 'house' && !g!.owned.has(b.id)) : [];
        body = `<p>🏠 Houses for sale in ${esc(v?.name ?? 'town')}, big to little. You wake up at your house, and it has storage.</p>
          <div class="ex-list">${HOMES.map((h) => { const pick = pickHouse(forSale, h.id); return `<div class="ex-li"><span class="ic">🏠</span><b>${h.name}</b><em>${money(h.price)}</em>${pick ? `<button data-buy="${h.id}" data-n="1" data-vb="${pick.id}">Buy</button>` : '<small>none left here</small>'}</div>`; }).join('')}</div>`;
      } else if (shop === 'pets') {
        body = `<p>🐾 Pets follow you around and protect you from hostile animals and bugs.</p><div class="ex-list">${PETS.map(([id, price]) => `<div class="ex-li"><span class="ic">${{ cat: '🐱', dog: '🐶', parrot: '🦜', tiger: '🐯', robo_dog: '🤖' }[id] ?? '🐾'}</span><b>${MOBS[id].name}</b><small>strength ${MOBS[id].dmg}</small><em>${money(price)}</em><button data-buy="${id}" data-n="1">Buy</button></div>`).join('')}</div>`;
      } else if (shop === 'police') {
        body = `<p>👮 “Howdy! We keep the town safe. Wild animals stay out of town, and our officers chase off anything that wanders in. Please don't hit people — that's a $50 fine.”</p><p class="ex-small">Tip: at night, wolves and bears come out. Stay in town or build walls and turrets.</p>`;
      }
      void vb;
      return `<h2>${esc(SHOP_NAME[shop])}</h2><p class="ex-small">You have ${money(me.money)}</p>${body}`;
    }
    function pickHouse(list: VillageBuilding[], home: string) {
      // houses matched to sizes: little cabins are the smaller lots, mansions the biggest
      return list.find((b) => b.home === home) ?? (home === 'mansion' ? [...list].sort((a, b) => b.w * b.d - a.w * a.d)[0] : undefined);
    }
    function shipPanel(): string {
      if (!g) return '';
      const s = g.ship;
      const cur = DESTINATIONS[s.at];
      const total = Math.abs(DESTINATIONS[s.dest].dist - cur.dist);
      return `<h2>🧭 Ship controls</h2><p>Now: <b>${s.moving ? `flying to ${DESTINATIONS[s.dest].name}` : `at ${cur.name}`}</b></p>
        ${s.moving ? `<div class="ex-bar"><i style="width:${Math.min(100, (s.km / Math.max(1, total)) * 100)}%"></i></div><p class="ex-small">${Math.floor(s.km)} / ${total} km · ${g.shipSpeed()} km/s</p><button class="ex-btn" data-c="stopship">⏹ Stop</button>` : ''}
        <h3>Pick a destination, then Start</h3><div class="ex-list">${DESTINATIONS.map((d, i) => `<div class="ex-li"><span class="ic" style="color:${d.planet}">●</span><b>${d.name}</b><small>${Math.abs(d.dist - cur.dist)} km</small>${i === s.at ? '<em>here</em>' : `<button data-travel="${i}" ${s.moving ? 'disabled' : ''}>Start</button>`}</div>`).join('')}</div>
        <p class="ex-small">Thrusters with thruster fuel move the ship (${g.shipSpeed() || 0} km/s now). Medium, big and huge asteroids only show up while you're flying: turrets shoot them into smaller pieces for your grabbers.</p>`;
    }

    panelEl.addEventListener('click', (e) => {
      if (!g || !panel) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('button,[data-craft]');
      if (!el) { if (e.target === panelEl) closePanel(); return; }
      const d = el.dataset;
      sfx('click');
      if (d.c === 'close') return closePanel();
      if (d.c === 'save') { doSave(); return closePanel(); }
      if (d.c === 'friends') { closePanel(); return friendsMenu(false); }
      if (d.c === 'help') return openPanel({ k: 'help' });
      if (d.c === 'quit') return toTitle();
      if (d.c === 'cancel') return act('cancel');
      if (d.c === 'ship') return openPanel({ k: 'ship' });
      if (d.c === 'down') { act('down'); return closePanel(); }
      if (d.c === 'stopship') return act('stop');
      if (d.c === 'rotate' && panel.k === 'build') return act('rotate', { id: panel.id });
      if (d.c === 'pickup' && panel.k === 'build') { act('pickup', { id: panel.id }); return closePanel(); }
      if (d.c === 'sethome' && panel.k === 'build') return act('sethome', { id: panel.id });
      if (d.tab) { craftTab = d.tab as Recipe['group']; panelSig = ''; return; }
      if (d.craft5) { e.stopPropagation(); return act('craft', { id: d.craft5, n: 5 }); }
      if (d.craft) return act('craft', { id: d.craft, n: (e as MouseEvent).shiftKey ? 5 : 1 });
      if (d.zoom) { mapZoom = Math.max(1, Math.min(32, d.zoom === '1' ? mapZoom / 2 : mapZoom * 2)); panelSig = ''; return; }
      if (d.travel) { act('travel', { dest: Number(d.travel) }); return; }
      if (d.launch && panel.k === 'build') { act('launch', { id: panel.id, ride: d.launch === 'ride' }); return; }
      if (d.btake !== undefined) return act('btake', { id: Number(d.bid), from: d.btake, i: Number(d.i ?? 0) });
      if (d.htake !== undefined && panel.k === 'house') return act('htake', { vb: panel.vb, i: Number(d.htake) });
      if (d.buy && panel.k === 'shop') return act('buy', { shop: panel.shop, id: d.buy, n: Number(d.n), vb: d.vb ?? '' });
      if (d.inv !== undefined) {
        const i = Number(d.inv);
        const shift = (e as MouseEvent).shiftKey;
        if (d.mode === 'put' && panel.k === 'build') return act('bput', { id: panel.id, slot: i, all: shift });
        if (d.mode === 'sell') return act('sell', { slot: i, all: shift });
        if (d.mode === 'hput' && panel.k === 'house') return act('hput', { vb: panel.vb, i });
        if (selSlot === null) { selSlot = i; panelSig = ''; }
        else { if (selSlot !== i) act('swap', { a: selSlot, b: i }); selSlot = null; panelSig = ''; }
      }
    });
    panelEl.addEventListener('contextmenu', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-inv]');
      if (!el || !g) return;
      e.preventDefault();
      const i = Number(el.dataset.inv);
      const s = g.me.inv[i];
      if (s && ITEMS[s.id]?.food) act('eat', { slot: i });
      else if (i < 10) { act('hand', { i }); g.me.hand = i; }
    });
    panelEl.addEventListener('change', (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset.recipe) act('recipe', { id: Number(el.dataset.recipe), r: el.value });
    });
    panelEl.addEventListener('keydown', (e) => e.stopPropagation());

    // ---------- the map ----------
    const BIOME_MAP: Record<string, string> = { ocean: '#2f6fb0', beach: '#e8d9a0', plains: '#6db04a', forest: '#2f7a2a', desert: '#e3c97a', snow: '#f2f6fa', pole: '#cfe6f8', mountain: '#8a8a80' };
    function drawMap() {
      const c = panelEl.querySelector<HTMLCanvasElement>('.ex-map');
      if (!c || !g) return;
      const ctx = c.getContext('2d')!;
      const me = g.me;
      const S = 105, px = 4;
      const step = mapZoom;
      const cx = me.dim === 'earth' ? me.x : g.w.spawnX, cz = me.dim === 'earth' ? me.z : g.w.spawnZ;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const x = cx + (i - S / 2) * step, z = cz + (j - S / 2) * step;
        let col = BIOME_MAP[g.w.baseBiome(x, z)];
        if (step <= 4) { const v = g.w.villageAt(x, z); if (v && g.w.isRoad(x, z)) col = '#555'; else if (v && g.w.villageBuildingAt(x, z)) col = '#c0583a'; }
        ctx.fillStyle = col;
        ctx.fillRect(i * px, j * px, px, px);
      }
      const dot = (x: number, z: number, color: string, r = 5, label = '') => {
        const sx = (wd(x, cx) / step + S / 2) * px, sz = (wd(z, cz) / step + S / 2) * px;
        if (sx < -10 || sz < -10 || sx > 430 || sz > 430) return;
        ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sz, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (label) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeText(label, sx + 7, sz + 4); ctx.fillText(label, sx + 7, sz + 4); }
      };
      // villages near enough to show
      const seen = new Set<string>();
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const R = (S / 2) * step;
        for (const v of g.w.villagesNear(cx + (i / 3) * R, cz + (j / 3) * R)) if (!seen.has(v.id)) { seen.add(v.id); dot(v.x, v.z, '#ffe08a', 6, v.name); }
      }
      for (const car of g.cars.values()) if (car.owner === me.slot) dot(car.x, car.z, '#ff4fa0', 4, '🚗');
      if (me.home) dot(me.home.x, me.home.z, '#fff', 4, 'Home');
      for (const p of g.players.values()) if (p.dim === 'earth') dot(p.x, p.z, p.color, p === me ? 6 : 5, p === me ? 'You' : `${p.slot + 1}`);
      dot(g.w.spawnX, 0, '#ff3030', 5, 'North Pole');
    }
    function mapInfo() {
      if (!g) return '';
      const me = g.me;
      return `Start: ${Math.round(wd(me.x, g.w.spawnX))} east, ${Math.round(wd(me.z, g.w.spawnZ))} south · North Pole: ${Math.round(g.w.latitude(me.z)).toLocaleString()} tiles north · Walked ${Math.round(me.traveled).toLocaleString()} tiles (${((me.traveled / WORLD) * 100).toFixed(3)}% of the way around)`;
    }

    // ---------- HUD ----------
    let hudT = 0;
    function updateHud(dt: number) {
      if (!g) return;
      const me = g.me;
      hudT -= dt;
      const hb = JSON.stringify(me.inv.slice(0, 10)) + me.hand;
      if (hb !== lastHotbar) {
        lastHotbar = hb;
        hotbarEl.innerHTML = me.inv.slice(0, 10).map((s, i) => `<button class="ex-slot ${me.hand === i ? 'hand' : ''}" data-h="${i}" title="${s ? esc(iname(s.id)) : ''}"><i>${(i + 1) % 10}</i>${s ? `<span class="ic">${icon(s.id)}</span><b>${s.n > 1 ? s.n : ''}</b>` : ''}</button>`).join('');
      }
      const qk = me.craftQ.length ? `${me.craftQ[0].id}${Math.round((1 - me.craftQ[0].left / me.craftQ[0].total) * 10)}${me.craftQ.length}` : '';
      if (qk !== lastQueue) {
        lastQueue = qk;
        const q = me.craftQ[0];
        queueEl.innerHTML = q ? `<span class="ic">${icon(RECIPE[q.id].out)}</span><div class="ex-bar"><i style="width:${(1 - q.left / q.total) * 100}%"></i></div>${me.craftQ.filter((x) => !x.part).length > 1 ? `<small>+${me.craftQ.filter((x) => !x.part).length - 1}</small>` : ''}` : '';
      }
      if (hudT > 0) return;
      hudT = 0.2;
      const hp = Math.max(0, me.hp);
      $<HTMLElement>('.ex-hp i').style.width = `${(hp / MAX_HP) * 100}%`;
      $('.ex-hp span').textContent = `❤️ ${Math.ceil(hp)}`;
      $('.ex-money').textContent = `💰 ${money(me.money)}`;
      const dim = me.dim;
      let where = '';
      if (dim === 'earth') {
        const v = g.w.villageAt(me.x, me.z);
        where = v ? `🏘️ ${v.name}` : `${BIOME_NAME[g.w.biome(me.x, me.z)]}`;
      } else if (dim === 'space') where = `🚀 Space · ${g.ship.moving ? `flying to ${DESTINATIONS[g.ship.dest].name}` : DESTINATIONS[g.ship.at].name}`;
      else if (dim === 'silo') where = '🚀 In the rocket';
      else where = dim.startsWith('m') ? '⛏️ Mine shaft' : '🦇 Cave';
      $('.ex-where').textContent = where;
      const tod = g.tod;
      const hours = Math.floor((tod * 24 + 6) % 24), mins = Math.floor(((tod * 24 + 6) % 1) * 60);
      $('.ex-clock').textContent = `Day ${g.day} · ${hours}:${String(mins).padStart(2, '0')} ${g.night ? '🌙' : '☀️'}${dim === 'earth' ? ` · North Pole ${Math.round(g.w.latitude(me.z)).toLocaleString()} tiles ⬆` : ''}`;
      // hint for E
      let hint = '';
      if (panel) hint = '';
      else if (me.car) hint = 'E: get out of the car · WASD drive';
      else {
        const door = g.villageDoor(me);
        if (door) hint = door.kind === 'shop' ? `E: go in (${SHOP_NAME[door.shop!]})` : g.owned.get(door.id)?.slot === me.slot ? 'E: your house' : 'E: knock';
        else if ([...g.cars.values()].some((c) => c.driver === null && dist2(c.x, c.z, me.x, me.z) < 9 && me.dim === 'earth')) hint = 'E: get in the car';
        else if (me.dim !== 'earth' && me.dim !== 'space' && me.dim !== 'silo' && dist2(me.x, me.z, g.w.cave(me.dim).exit[0], g.w.cave(me.dim).exit[1]) < 9) hint = 'E: climb back out';
        else if (target?.k === 'feat') { const f = g.w.feature(target.x, target.z); if (f?.kind === 'cave') hint = 'E: go into the cave'; else if (f?.kind === 'shaft') hint = 'E: climb down the mine shaft'; else if (f?.kind === 'ore') hint = `${iname(f.ore!)} (${f.amount} left) · hold click to mine`; else if (f?.kind === 'nest') hint = '🐛 Alien bug nest · hit it to destroy it (the bugs will defend it!)'; else if (f?.kind === 'oil') hint = 'Oil · put a pumpjack here'; else if (f) hint = 'Hold click'; }
        else if (target?.k === 'build') { const b = g.buildings.get(target.id); if (b) hint = `${b.hub ? 'Ship hub' : BUILDS[b.type].name} · click to open · X to pick up`; }
        else if (target?.k === 'mob') { const m = g.mobs.get(target.id); if (m) hint = `${MOBS[m.type].name}${m.owner !== undefined ? ` (${PLAYER_NAMES[m.owner]}'s pet)` : MOBS[m.type].hostile ? ' ⚠️' : ''}`; }
        const h = heldItem();
        if (h && ITEMS[h.id]?.build) hint = `${iname(h.id)}: click to place · R to turn (${['north', 'east', 'south', 'west'][placeDir]})`;
        else if (h && ITEMS[h.id]?.weapon) hint = `${iname(h.id)}: click to ${h.id === 'grenade' ? 'throw' : 'shoot'} · needs ${WEAPONS[ITEMS[h.id].weapon!].ammo.map(iname).join(' or ')}`;
      }
      hintEl.textContent = hint;
      hintEl.hidden = !hint;
      if (gotQ.size && gotT <= 0) {
        toast(`+ ${[...gotQ].map(([id, n]) => `${n} ${icon(id)} ${iname(id)}`).join(', ')}`);
        gotQ.clear();
      }
    }

    // ---------- the loop ----------
    let last = performance.now();
    let frame = 0;
    let lastStepSound = 0;
    const loop = (now: number) => {
      if (stopped) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
      if (canvas.width !== Math.floor(w * Math.min(devicePixelRatio, 1.5)) || canvas.height !== Math.floor(h * Math.min(devicePixelRatio, 1.5))) ren.resize(w, h);
      if (!playing || !g) {
        // spin slowly over a demo world on the title screen
        if (!demo) demo = new Game(1234);
        demo.me.x = demo.w.spawnX + 20 + now / 300;
        demo.me.y = demo.groundY('earth', demo.me.x, demo.me.z);
        ren.camYaw = now / 9000;
        ren.camPitch = 0.35;
        ren.camDist = 16;
        demo.time = 120;
        ren.render(demo, demo.me, dt, null, 0);
        return;
      }
      frame++;
      const gg = g;
      const me = gg.me;
      gotT -= dt;
      // move
      if (me.dim !== 'silo') {
        let mx = 0, mz = 0;
        if (keys.has('w') || keys.has('arrowup')) mz -= 1;
        if (keys.has('s') || keys.has('arrowdown')) mz += 1;
        if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
        if (keys.has('d') || keys.has('arrowright')) mx += 1;
        if (stickId !== null) { mx += stickX; mz += stickY; }
        if (keys.has('z')) ren.camYaw += dt * 2;
        if (keys.has('c')) ren.camYaw -= dt * 2;
        if (panel && (panel.k === 'map' || panel.k === 'pause' || panel.k === 'help')) { mx = 0; mz = 0; }
        if (me.car) {
          gg.movePlayer(me, mx, mz, false, false, dt);
          // the camera follows behind the car
          let dy = me.yaw + Math.PI - ren.camYaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          ren.camYaw += dy * Math.min(1, dt * 3);
        } else {
          // walk relative to where the camera looks
          const cy = Math.cos(ren.camYaw), sy = Math.sin(ren.camYaw);
          const wx = mx * cy + mz * sy, wz = -mx * sy + mz * cy;
          gg.movePlayer(me, wx, wz, keys.has(' '), keys.has('control'), dt);
          if (Math.hypot(mx, mz) > 0.1 && now - lastStepSound > 330 && me.y <= gg.groundY(me.dim, me.x, me.z) + 0.1) { lastStepSound = now; sfx('step', 0.6); }
        }
      }
      gg.update(dt);
      // what's under the mouse
      if (frame % 2 === 0 || mouseDown) updatePick();
      // holding the button mines, punches or fires
      if (mouseDown && !panel) {
        const held = heldItem();
        if (held && ITEMS[held.id]?.weapon) { if (me.cool <= 0 || isFriend()) { if (frame % 3 === 0 || !isFriend()) clickAct(); } }
        else if (target?.k === 'mob') { if (me.cool <= 0) { me.cool = WEAPONS.fist.cool; clickAct(); } }
        else if (target && (target.k === 'feat' || target.k === 'cave' || target.k === 'ground')) {
          const k = JSON.stringify(target);
          const need = mineTime(target);
          if (need > 0 && (target.k !== 'ground' || !(held && ITEMS[held.id]?.build))) {
            if (k !== mineKey) { mineKey = k; mineT = 0; mineNeed = need; }
            const was = mineT;
            mineT += dt;
            me.swing = Math.max(me.swing, 0.6 + Math.sin(now / 80) * 0.4);
            if (Math.floor(was / 0.3) !== Math.floor(mineT / 0.3)) {
              const f = target.k === 'feat' ? gg.w.feature(target.x, target.z) : null;
              sfx(f && ['tree', 'pine', 'palm', 'snowtree', 'cactus'].includes(f.kind) ? 'chop' : target.k === 'ground' ? 'dig' : 'pick', 0.8);
            }
            if (mineT >= mineNeed) { act('mine', { tg: target }); mineT = 0; mineKey = ''; }
          }
        }
      } else if (!mouseDown) mineT = 0;
      // the placement preview
      const held = heldItem();
      if (held && ITEMS[held.id]?.build && !panel && pickPoint) {
        const type = ITEMS[held.id].build!;
        const [x, z] = placeSpot();
        const why = gg.canPlace(me, type, x, z, me.dim);
        ren.showGhost(me.dim, x, z, BUILDS[type].size, !why, gg, placeDir);
      } else ren.ghost.visible = false;
      // world events
      for (const e of gg.events) applyEvent(e as Ev, me.slot);
      if (net?.role === 'host' && gg.events.length) net.broadcast({ t: 'ev', list: gg.events });
      gg.events = [];
      for (const t of gg.toasts) toast(t);
      gg.toasts = [];
      // effects and sounds
      const fxNow = gg.fx;
      gg.fx = [];
      const meDim = me.dim === 'silo' ? 'earth' : me.dim;
      for (const f of fxNow) {
        if (f.k === 'sfx') {
          const fdim = f.dim === 'silo' ? 'earth' : f.dim;
          if (fdim !== meDim) continue;
          const d = Math.sqrt(dist2(f.x, f.z, me.x, me.z));
          sfx(f.s, 1 - d / 45);
        } else ren.addFx(f, meDim);
      }
      // playing together
      if (net?.role === 'host') {
        const s = net;
        if (snapRate(now)) for (const slot of s.friends()) {
          const p = gg.players.get(slot);
          if (!p) continue;
          const snap = snapFor(gg, p);
          snap.fx = fxNow.filter((f) => f.dim === p.dim);
          if (!bRate(now)) snap.bs = snap.bs.filter((b) => b[2]);
          s.send(slot, snap);
        } else {
          // effects between snapshots still go out
          for (const slot of s.friends()) {
            const p = gg.players.get(slot);
            const list = p ? fxNow.filter((f) => f.dim === p.dim) : [];
            if (list.length) s.send(slot, { ...snapFor(gg, p!), bs: [], fx: list });
          }
        }
        for (const slot of gg.dirtyPlayers) {
          const p = gg.players.get(slot);
          if (!p || slot === 0) continue;
          const open = p.open ? gg.buildings.get(p.open) ?? null : null;
          s.send(slot, { t: 'me', p: { hp: p.hp, money: p.money, inv: p.inv, craftQ: p.craftQ, home: p.home, houses: p.houses, hand: p.hand, car: p.car }, open });
        }
        // keep open machine panels fresh for friends
        if (frame % 15 === 0) for (const slot of s.friends()) { const p = gg.players.get(slot); if (p?.open) gg.dirtyPlayers.add(slot); else gg.dirtyPlayers.delete(slot); }
        else gg.dirtyPlayers.clear();
      } else if (net?.role === 'friend') {
        if (meRate(now)) net.send({ t: 'me', x: me.x, y: me.y, z: me.z, yaw: me.yaw, dim: me.dim, anim: me.anim, swing: me.swing } satisfies ToHost);
        gg.dirtyPlayers.clear();
      } else gg.dirtyPlayers.clear();
      // sounds of the place
      const carSpeed = me.car ? Math.hypot(keys.has('w') ? 1 : 0, 0) * 10 + 2 : 0;
      const place = me.dim === 'space' ? 'space' : me.dim === 'earth' ? (gg.w.isWater(me.x, me.z) ? 'water' : gg.night ? 'night' : 'day') : me.dim === 'silo' ? 'space' : 'cave';
      ambience(dt, place, carSpeed);
      // panels refresh when something changes
      if (panel && frame % 6 === 0) {
        const sig = panelSignature();
        if (sig !== panelSig) { panelSig = sig; renderPanel(); }
      }
      if (panel?.k === 'build') {
        const b = gg.buildings.get(panel.id);
        if (!b || !gg.near(me, b.x + 0.5, b.z + 0.5, REACH + 5) || b.dim !== me.dim) closePanel();
      }
      if (panel?.k === 'shop' || panel?.k === 'house') { if (!gg.villageDoor(me)) closePanel(); }
      if (!gg.remote) { autosave -= dt; if (autosave <= 0) { autosave = 60; doSave(true); } }
      ren.render(gg, me, dt, target, mineT > 0 ? mineT / mineNeed : 0);
      if (!loadingEl.hidden && (me.dim !== 'earth' || ren.pending(gg) === 0)) loadingEl.hidden = true;
      updateHud(dt);
    };
    let demo: Game | null = null;
    // for testing from the browser console
    (window as unknown as { __explorer?: () => Game | null }).__explorer = () => g;
    (window as unknown as { __explorerAim?: () => unknown }).__explorerAim = () => ({ target, pickPoint, mouseX, mouseY });
    requestAnimationFrame(loop);
    const onResize = () => ren.resize(wrapEl.clientWidth, wrapEl.clientHeight);
    window.addEventListener('resize', onResize);
    const onHide = () => { if (document.hidden && g && !g.remote) doSave(true); };
    document.addEventListener('visibilitychange', onHide);
    void (DIRS as unknown);
    void CAVE_SIZE;

    return () => {
      stopped = true;
      if (g && !g.remote) doSave(true);
      endNet();
      stopAudio();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onHide);
      ren.dispose();
      root.innerHTML = '';
    };
  },
};

export default game;
