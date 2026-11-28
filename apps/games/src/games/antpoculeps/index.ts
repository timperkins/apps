// Antpoculeps: start as an egg in a big back yard, eat food to hatch, bite other ants, and evolve
// through 20 ants up to the Cosmic Ant. At level 20 you can rebirth as an egg with more power.
// Up to 6 players, hosted the Factori-owen way (net.ts). Game design by Tim; original code and art.
import './style.css';
import type { GameModule } from '../types';
import { MAX_LEVEL, PLAYER_COLORS, STAGES, foodNeeded, power, type FoodKind } from './data';
import { Game, maxHp, moveAnt, type Ant, type GameEvent } from './game';
import { Renderer, drawMinimap, stageIcon, type ViewAnt, type ViewFood } from './render';
import { isMuted, setMuted, sfx } from './audio';
import { makeWorld, type World } from './world';
import { MAX_PLAYERS, hostWorld, joinWorld, listHosts, type FriendSession, type HostInfo, type HostSession } from './net';

const SAVE_KEY = 'antpoculeps-save-v1';
const NAME_KEY = 'antpoculeps-name';
const FOOD_KINDS_ALL: FoodKind[] = ['crumb', 'seed', 'berry', 'sugar', 'cookie', 'apple', 'meat'];

interface Save { v: 1; level: number; food: number; rebirths: number; best: number }
function readSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Save | null;
    if (s && s.v === 1) return s;
  } catch { /* ignore */ }
  return { v: 1, level: 0, food: 0, rebirths: 0, best: 0 };
}
function writeSave(s: Save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ---------- messages ----------
type AntRow = [number, number, number, number, number, number, number, number, number, number, number, string];
type ToHost =
  | { t: 'hi'; name: string; level: number; food: number; rebirths: number }
  | { t: 'me'; x: number; y: number; a: number; m: boolean; b: boolean }
  | { t: 'evolve' }
  | { t: 'rebirth' }
  | { t: 'cheat' };
type FoodRow = [number, number, number, number, number];
type ToFriend =
  | { t: 'init'; seed: number; food: FoodRow[] }
  | { t: 's'; ants: AntRow[]; fa: FoodRow[]; fr: number[]; ev: GameEvent[] };

const foodRow = (f: { id: number; x: number; y: number; k: FoodKind; v: number }): FoodRow => [f.id, Math.round(f.x), Math.round(f.y), FOOD_KINDS_ALL.indexOf(f.k), f.v];
const fromFoodRow = (r: FoodRow): ViewFood => ({ id: r[0], x: r[1], y: r[2], k: FOOD_KINDS_ALL[r[3]], v: r[4] });

function antRow(a: Ant): AntRow {
  const flags = (a.moving ? 1 : 0) | (a.bite > 0 ? 2 : 0) | (a.hurt > 0 ? 4 : 0) | (a.dead > 0 ? 8 : 0);
  return [a.id, a.slot, a.level, Math.round(a.x), Math.round(a.y), Math.round(a.a * 100), Math.round((a.hp / maxHp(a)) * 100), flags, a.rebirths, Math.round(a.food), a.spawn, a.slot >= 0 ? a.name : ''];
}

interface RemoteAnt extends ViewAnt { tx: number; ty: number; ta: number; food: number; spawn: number }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'ap';
    el.tabIndex = 0;
    el.innerHTML = `
      <canvas class="ap-canvas"></canvas>
      <div class="ap-ui">
        <div class="ap-hud" hidden>
          <div class="ap-card">
            <div class="ap-icon"></div>
            <div class="ap-stats">
              <div class="ap-name"></div>
              <div class="ap-bar ap-hp"><i></i><span></span></div>
              <div class="ap-bar ap-food"><i></i><span></span></div>
              <div class="ap-power"></div>
            </div>
          </div>
          <div class="ap-right">
            <div class="ap-players"></div>
            <button class="ap-ib" data-a="mute" title="Sound (M)"></button>
            <button class="ap-ib" data-a="menu" title="Menu (Esc)">☰</button>
          </div>
          <canvas class="ap-mini" width="150" height="150"></canvas>
          <button class="ap-evolve" hidden></button>
          <div class="ap-touch">
            <div class="ap-stick" hidden><i></i></div>
            <button class="ap-bitebtn">BITE</button>
          </div>
          <div class="ap-help">WASD / arrows to walk · Space or click to bite · E to evolve · J+K level up · Esc menu</div>
        </div>
        <div class="ap-toasts"></div>
        <div class="ap-dead" hidden></div>
        <div class="ap-screen"></div>
      </div>`;
    root.appendChild(el);
    const $ = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
    const canvas = $<HTMLCanvasElement>('.ap-canvas');
    const hud = $('.ap-hud'), screen = $('.ap-screen'), toasts = $('.ap-toasts'), deadBox = $('.ap-dead');
    const evolveBtn = $<HTMLButtonElement>('.ap-evolve'), mini = $<HTMLCanvasElement>('.ap-mini');
    const stickEl = $('.ap-stick'), stickKnob = $('.ap-stick i');
    const touch = matchMedia('(pointer: coarse)').matches;
    if (!touch) $('.ap-bitebtn').hidden = true; else $('.ap-help').hidden = true;

    let save = readSave();
    let myName = localStorage.getItem(NAME_KEY) || 'Ant' + Math.floor(Math.random() * 900 + 100);

    // ---------- state ----------
    type Mode = 'title' | 'local' | 'friend';
    let mode: Mode = 'title';
    let seed = Math.floor(Math.random() * 1e9);
    let game: Game | null = new Game(seed);
    let world: World = game.world;
    let renderer = new Renderer(canvas, world);
    renderer.resize();
    let host: HostSession | null = null;
    let friend: FriendSession | null = null;
    let mySlot = 0;
    // friend-side view of the yard
    const rAnts = new Map<number, RemoteAnt>();
    const rFood = new Map<number, ViewFood>();
    let myLocal: RemoteAnt | null = null;
    let pendingEvents: GameEvent[] = [];
    let menuOpen = false;
    let lastHp = 1;

    // ---------- input ----------
    const keys = new Set<string>();
    let biteHeld = false, mouseBite = false, touchBite = false;
    let stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (down) {
        if (k === 'escape') { if (mode !== 'title') toggleMenu(); e.preventDefault(); return; }
        if (k === 'e' && mode !== 'title') doEvolve();
        if (k === 'r' && mode !== 'title') doRebirth();
        if (k === 'm') toggleMute();
        keys.add(k);
      } else keys.delete(k);
      if (k === ' ') { biteHeld = down; e.preventDefault(); }
      // cheat: hold J and K together to level up instantly
      if (down && !e.repeat && (k === 'j' || k === 'k') && keys.has('j') && keys.has('k') && mode !== 'title') doCheat();
      if (k.startsWith('arrow')) e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const blur = () => { keys.clear(); biteHeld = mouseBite = touchBite = false; };
    window.addEventListener('blur', blur);
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouseBite = true; });
    const mu = () => { mouseBite = false; };
    window.addEventListener('mouseup', mu);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (stick.id < 0 && t.clientX < window.innerWidth * 0.6) {
          stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
          stickEl.hidden = false;
          stickEl.style.left = t.clientX + 'px';
          stickEl.style.top = t.clientY + 'px';
          stickKnob.style.transform = 'translate(-50%,-50%)';
        } else touchBite = true;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== stick.id) continue;
        let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy;
        const d = Math.hypot(dx, dy), max = 55;
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
        stick.x = dx / max; stick.y = dy / max;
        stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stick.id) { stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }; stickEl.hidden = true; } else touchBite = false;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
    const biteBtn = $('.ap-bitebtn');
    biteBtn.addEventListener('touchstart', (e) => { touchBite = true; e.preventDefault(); }, { passive: false });
    biteBtn.addEventListener('touchend', () => { touchBite = false; });
    evolveBtn.addEventListener('click', () => { const me = myView(); if (me && me.level >= MAX_LEVEL) doRebirth(); else doEvolve(); });

    function readStick(): [number, number] {
      let mx = 0, my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      if (stick.id >= 0) { mx += stick.x; my += stick.y; }
      return [mx, my];
    }
    const biting = () => biteHeld || mouseBite || touchBite;

    // ---------- UI bits ----------
    function toast(text: string, color = '#fff6d8') {
      const t = document.createElement('div');
      t.className = 'ap-toast';
      t.style.color = color;
      t.textContent = text;
      toasts.appendChild(t);
      setTimeout(() => t.remove(), 3200);
      while (toasts.children.length > 4) toasts.firstChild!.remove();
    }
    function toggleMute() {
      setMuted(!isMuted());
      $('[data-a="mute"]').textContent = isMuted() ? '🔇' : '🔊';
    }
    $('[data-a="mute"]').textContent = isMuted() ? '🔇' : '🔊';
    $('[data-a="mute"]').addEventListener('click', toggleMute);
    $('[data-a="menu"]').addEventListener('click', () => toggleMenu());

    const iconCache = new Map<number, HTMLCanvasElement>();
    const icon = (lv: number, px = 56) => {
      const key = lv * 1000 + px;
      if (!iconCache.has(key)) iconCache.set(key, stageIcon(lv, px));
      return iconCache.get(key)!.cloneNode(false) as HTMLCanvasElement;
    };
    function copyIcon(lv: number, px: number) {
      const src = iconCache.get(lv * 1000 + px) ?? (iconCache.set(lv * 1000 + px, stageIcon(lv, px)), iconCache.get(lv * 1000 + px)!);
      const c = icon(lv, px);
      c.getContext('2d')!.drawImage(src, 0, 0);
      return c;
    }

    // ---------- title, join list, guide, menu ----------
    function showTitle() {
      mode = 'title';
      hud.hidden = true;
      deadBox.hidden = true;
      menuOpen = false;
      const st = STAGES[save.level];
      screen.hidden = false;
      screen.innerHTML = `
        <div class="ap-panel ap-title">
          <h1>Antpoculeps</h1>
          <p class="ap-sub">Hatch from an egg. Eat. Bite. Evolve all the way to the Cosmic Ant.</p>
          <div class="ap-prog"><span class="ap-picon"></span><div><b>Level ${save.level} · ${st.name}</b><br>
            ${save.rebirths ? `Rebirths: ${save.rebirths} · Power ${power(save.rebirths).toFixed(2)}x` : 'Power 1x'}</div></div>
          <label class="ap-field">Your name <input maxlength="16" value="${esc(myName)}"></label>
          <div class="ap-buttons">
            <button class="ap-btn ap-go" data-a="play">▶ Play</button>
            <button class="ap-btn" data-a="host">🏠 Host a game</button>
            <button class="ap-btn" data-a="join">👥 Join a game</button>
            <button class="ap-btn ap-small" data-a="guide">🐜 All 20 ants</button>
            <button class="ap-btn ap-small" data-a="exit">← Back to games</button>
          </div>
        </div>`;
      screen.querySelector('.ap-picon')!.appendChild(copyIcon(save.level, 48));
      const input = screen.querySelector('input')!;
      input.addEventListener('input', () => {
        myName = input.value.trim().slice(0, 16) || myName;
        try { localStorage.setItem(NAME_KEY, myName); } catch { /* ignore */ }
      });
      screen.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'play') startLocal(false);
        else if (a === 'host') startLocal(true);
        else if (a === 'join') showJoin();
        else if (a === 'guide') showGuide(showTitle);
        else if (a === 'exit') onExit();
      }));
    }

    function showGuide(back: () => void) {
      screen.hidden = false;
      screen.innerHTML = `<div class="ap-panel ap-guide"><h2>The 20 ants</h2>
        <p class="ap-sub">Eat food to fill your food bar, then evolve. Dying drops you 3 levels. At level 20, fill the bar once more to rebirth as an egg with 1.25x more power (then 1.5x, 1.75x…).</p>
        <div class="ap-grid"></div><button class="ap-btn" data-a="back">Back</button></div>`;
      const grid = screen.querySelector('.ap-grid')!;
      STAGES.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'ap-cell' + (i === save.level ? ' on' : '');
        d.appendChild(copyIcon(i, 52));
        const t = document.createElement('div');
        t.innerHTML = `<b>${i}. ${s.name}</b><small>${s.blurb}</small>`;
        d.appendChild(t);
        grid.appendChild(d);
      });
      screen.querySelector('[data-a="back"]')!.addEventListener('click', back);
    }

    async function showJoin() {
      screen.hidden = false;
      screen.innerHTML = `<div class="ap-panel"><h2>Join a game</h2><div class="ap-list">Looking for games…</div>
        <div class="ap-buttons ap-row"><button class="ap-btn" data-a="refresh">↻ Refresh</button><button class="ap-btn" data-a="back">Back</button></div></div>`;
      screen.querySelector('[data-a="back"]')!.addEventListener('click', showTitle);
      screen.querySelector('[data-a="refresh"]')!.addEventListener('click', () => void showJoin());
      const list = screen.querySelector('.ap-list')!;
      let hosts: HostInfo[];
      try {
        hosts = await listHosts();
      } catch (err) {
        console.warn(err);
        list.textContent = 'Could not reach the game list. Check your internet and try again.';
        return;
      }
      if (mode !== 'title' || !list.isConnected) return;
      if (!hosts.length) {
        list.innerHTML = 'No games open right now. Ask a friend to press <b>Host a game</b>, then refresh.';
        return;
      }
      list.innerHTML = '';
      for (const h of hosts) {
        const b = document.createElement('button');
        b.className = 'ap-host';
        b.innerHTML = `<b>${esc(h.name)}</b><span>${esc(h.world)} · ${h.players}/${MAX_PLAYERS} players</span>`;
        b.disabled = h.players >= MAX_PLAYERS;
        b.addEventListener('click', () => void startFriend(h, b));
        list.appendChild(b);
      }
    }

    function toggleMenu(force?: boolean) {
      menuOpen = force ?? !menuOpen;
      if (!menuOpen) { screen.hidden = true; screen.innerHTML = ''; el.focus(); return; }
      screen.hidden = false;
      const canOpen = mode === 'local' && !host;
      screen.innerHTML = `<div class="ap-panel ap-menu"><h2>Paused</h2>
        <p class="ap-sub">${mode === 'friend' ? 'You are in a friend’s yard. The game keeps going while this is open.' : host ? `Friends can join your yard from <b>Join a game</b>. ${1 + host.friends().length}/${MAX_PLAYERS} players.` : 'The game keeps going while this is open.'}</p>
        <div class="ap-buttons">
          <button class="ap-btn ap-go" data-a="resume">Resume</button>
          ${canOpen ? '<button class="ap-btn" data-a="open">🏠 Open to join</button>' : ''}
          <button class="ap-btn" data-a="guide">🐜 All 20 ants</button>
          <button class="ap-btn" data-a="quit">Save and quit</button>
        </div></div>`;
      screen.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'resume') toggleMenu(false);
        else if (a === 'open') { void openToJoin(); toggleMenu(false); }
        else if (a === 'guide') showGuide(() => toggleMenu(true));
        else if (a === 'quit') quitToTitle();
      }));
    }

    // ---------- starting and stopping ----------
    function resetYard() {
      seed = Math.floor(Math.random() * 1e9);
      game = new Game(seed);
      world = game.world;
      renderer = new Renderer(canvas, world);
      renderer.resize();
    }

    function startLocal(open: boolean) {
      if (!game || game.ants.size === 0 || [...game.ants.values()].some((a) => a.slot >= 0)) resetYard();
      mode = 'local';
      mySlot = 0;
      const a = game!.addPlayer(0, myName, save.level, save.food, save.rebirths);
      renderer.camX = a.x; renderer.camY = a.y;
      lastHp = 1;
      screen.hidden = true;
      screen.innerHTML = '';
      hud.hidden = false;
      el.focus();
      toast(save.level === 0 ? 'You are an egg! Roll over food to eat it and hatch.' : `Welcome back, ${STAGES[save.level].name}!`);
      if (open) void openToJoin();
    }

    async function openToJoin() {
      if (host || !game) return;
      try {
        host = await hostWorld(myName, `${myName}’s yard`);
      } catch (err) {
        console.warn(err);
        toast('Could not open your game to friends. Check your internet.', '#ffb0a0');
        return;
      }
      if (mode !== 'local') { host.close(); host = null; return; }
      toast('Your yard is open! Friends can pick it under Join a game.', '#bfffb0');
      const h = host;
      h.onMessage((slot, raw) => {
        const m = raw as ToHost;
        if (!game || h !== host) return;
        if (m.t === 'hi') {
          game.addPlayer(slot, String(m.name).slice(0, 16) || 'Friend', clampLv(m.level), Math.max(0, Number(m.food) || 0), Math.max(0, Math.floor(Number(m.rebirths) || 0)));
          h.send(slot, { t: 'init', seed: game.seed, food: [...game.food.values()].map(foodRow) } satisfies ToFriend);
          toast(`${m.name} joined!`, PLAYER_COLORS[slot]);
          sfx.join();
        } else if (m.t === 'me') {
          const a = game.playerAnt(slot);
          if (a && a.dead <= 0) { a.x = m.x; a.y = m.y; a.a = m.a; a.moving = m.m; }
          game.inputs.set(slot, { mx: 0, my: 0, bite: !!m.b });
        } else if (m.t === 'evolve') game.evolve(slot);
        else if (m.t === 'rebirth') game.rebirth(slot);
        else if (m.t === 'cheat') game.cheatLevel(slot);
      });
      h.onLeave((slot) => {
        const a = game?.playerAnt(slot);
        if (a) toast(`${a.name} left.`);
        game?.removePlayer(slot);
      });
    }

    async function startFriend(info: HostInfo, btn: HTMLButtonElement) {
      btn.disabled = true;
      btn.querySelector('span')!.textContent = 'Joining…';
      let f: FriendSession;
      try {
        f = await joinWorld(info);
      } catch (err) {
        btn.disabled = false;
        btn.querySelector('span')!.textContent = (err as Error).message || 'Could not join.';
        return;
      }
      if (mode !== 'title') { f.close(); return; }
      friend = f;
      mySlot = f.slot;
      game = null;
      rAnts.clear();
      rFood.clear();
      myLocal = null;
      f.onMessage((raw) => onFriendMsg(raw as ToFriend));
      f.onClose(() => {
        if (friend !== f) return;
        friend = null;
        toast('The host closed their game.', '#ffb0a0');
        quitToTitle();
      });
      f.send({ t: 'hi', name: myName, level: save.level, food: save.food, rebirths: save.rebirths } satisfies ToHost);
      screen.innerHTML = '<div class="ap-panel"><h2>Joining…</h2></div>';
    }

    function onFriendMsg(m: ToFriend) {
      if (m.t === 'init') {
        world = makeWorld(m.seed);
        renderer = new Renderer(canvas, world);
        renderer.resize();
        rFood.clear();
        for (const r of m.food) { const f = fromFoodRow(r); rFood.set(f.id, f); }
        mode = 'friend';
        screen.hidden = true;
        screen.innerHTML = '';
        hud.hidden = false;
        el.focus();
        toast(`You joined ${friend?.name ?? 'a friend'}’s yard!`, '#bfffb0');
        return;
      }
      if (m.t === 's') {
        for (const id of m.fr) rFood.delete(id);
        for (const r of m.fa) { const f = fromFoodRow(r); rFood.set(f.id, f); }
        const seen = new Set<number>();
        for (const r of m.ants) {
          const [id, slot, level, x, y, a100, hp, flags, rebirths, food, spawn, name] = r;
          seen.add(id);
          let ant = rAnts.get(id);
          if (!ant) {
            ant = { id, slot, name, level, rebirths, x, y, a: a100 / 100, moving: false, bite: 0, hurt: 0, hp: hp / 100, dead: false, tx: x, ty: y, ta: a100 / 100, food, spawn };
            rAnts.set(id, ant);
          }
          ant.level = level; ant.rebirths = rebirths; ant.hp = hp / 100; ant.food = food; ant.name = name; ant.slot = slot;
          ant.moving = !!(flags & 1);
          if (flags & 2 && ant.bite <= 0) ant.bite = 0.22;
          if (flags & 4) ant.hurt = 0.15;
          const wasDead = ant.dead;
          ant.dead = !!(flags & 8);
          if (slot === mySlot) {
            // my own ant: I move it; the host only moves it when I hatch somewhere new
            if (!myLocal || ant.spawn !== spawn || wasDead !== ant.dead) { ant.x = x; ant.y = y; ant.a = a100 / 100; }
            ant.spawn = spawn;
            myLocal = ant;
          } else { ant.tx = x; ant.ty = y; ant.ta = a100 / 100; }
        }
        for (const id of rAnts.keys()) if (!seen.has(id)) rAnts.delete(id);
        for (const e of m.ev) handleEvent(e);
      }
    }

    function quitToTitle() {
      persist();
      if (host) { host.close(); host = null; }
      if (friend) { const f = friend; friend = null; f.close(); }
      rAnts.clear();
      rFood.clear();
      myLocal = null;
      resetYard();
      showTitle();
    }

    const clampLv = (n: unknown) => Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(n) || 0)));

    // ---------- actions ----------
    function doEvolve() {
      const me = myView();
      if (!me || me.dead || me.level >= MAX_LEVEL || me.level === 0) return;
      if (myFood() < foodNeeded(me.level)) return;
      if (mode === 'local') game!.evolve(mySlot);
      else friend?.send({ t: 'evolve' } satisfies ToHost);
    }
    function doCheat() {
      const me = myView();
      if (!me || me.dead) return;
      if (me.level >= MAX_LEVEL) { toast('You are already the Cosmic Ant! Fill the food bar to rebirth.', '#9fe8ff'); return; }
      if (mode === 'local') game!.cheatLevel(mySlot);
      else friend?.send({ t: 'cheat' } satisfies ToHost);
    }
    function doRebirth() {
      const me = myView();
      if (!me || me.dead || me.level < MAX_LEVEL || myFood() < foodNeeded(me.level)) return;
      if (mode === 'local') game!.rebirth(mySlot);
      else friend?.send({ t: 'rebirth' } satisfies ToHost);
    }

    function myFood(): number {
      if (mode === 'local') return game?.playerAnt(mySlot)?.food ?? 0;
      return myLocal?.food ?? 0;
    }

    function handleEvent(e: GameEvent) {
      const mine = 'slot' in e && e.slot === mySlot;
      switch (e.e) {
        case 'eat':
          if (mine) { (e.v >= 10 ? sfx.meat : sfx.eat)(); renderer.pop({ kind: 'text', x: e.x, y: e.y, text: '+' + e.v, color: '#c8ff7a', size: 14 + Math.min(12, e.v / 3) }); }
          break;
        case 'bite':
          if (near(e.x, e.y)) sfx.bite(e.big);
          renderer.pop({ kind: 'snap', x: e.x, y: e.y, color: '#fff', size: e.big ? 40 : 18 });
          break;
        case 'hurt':
          break;
        case 'kill':
          if (near(e.x, e.y)) sfx.kill();
          renderer.pop({ kind: 'puff', x: e.x, y: e.y, color: 'rgba(240,230,210,.9)', size: STAGES[e.level].size });
          break;
        case 'die':
          if (mine) {
            sfx.die();
            const down = Math.max(0, e.level - 3);
            deadBox.hidden = false;
            deadBox.innerHTML = `<b>You were eaten by ${esc(e.by)}!</b><br>Down 3 levels to ${STAGES[down].name}. Hatching again…`;
            setTimeout(() => { deadBox.hidden = true; }, 2600);
          } else if (mode !== 'title') {
            const who = antBySlot(e.slot);
            if (who) toast(`${who.name} was eaten by ${e.by}`);
          }
          break;
        case 'evolve':
          if (mine) {
            (e.level === 1 ? sfx.hatch : sfx.evolve)();
            toast(e.level === 1 ? 'You hatched into a Baby Ant! Space or click to bite.' : `You evolved into a ${STAGES[e.level].name}! ${STAGES[e.level].blurb}`, '#ffe27a');
            if (e.level === MAX_LEVEL) toast('THE COSMIC ANT! Fill your food bar once more to rebirth.', '#9fe8ff');
            if (e.level > save.best) save.best = e.level;
          }
          { const a = antBySlot(e.slot); if (a) renderer.pop({ kind: 'ring', x: a.x, y: a.y, color: '#ffe27a', size: STAGES[e.level].size * 1.2 }); }
          break;
        case 'rebirth':
          if (mine) { sfx.rebirth(); toast(`REBIRTH! You are an egg again, with ${power(e.rebirths).toFixed(2)}x power.`, '#ffd84a'); }
          { const a = antBySlot(e.slot); if (a) renderer.pop({ kind: 'ring', x: a.x, y: a.y, color: '#ffd84a', size: 260 }); }
          break;
      }
    }
    const near = (x: number, y: number) => Math.hypot(x - renderer.camX, y - renderer.camY) < 900;

    function antBySlot(slot: number): ViewAnt | undefined {
      if (mode === 'local' && game) { const a = game.playerAnt(slot); return a ? viewOf(a) : undefined; }
      for (const a of rAnts.values()) if (a.slot === slot) return a;
      return undefined;
    }

    function viewOf(a: Ant): ViewAnt {
      return { id: a.id, slot: a.slot, name: a.name, level: a.level, rebirths: a.rebirths, x: a.x, y: a.y, a: a.a, moving: a.moving, bite: a.bite, hurt: a.hurt, hp: a.hp / maxHp(a), dead: a.dead > 0 };
    }

    function myView(): ViewAnt | undefined {
      if (mode === 'local' && game) { const a = game.playerAnt(mySlot); return a ? viewOf(a) : undefined; }
      if (mode === 'friend') return myLocal ?? undefined;
      return undefined;
    }

    function persist() {
      const me = myView();
      if (!me || mode === 'title') return;
      save = { v: 1, level: me.level, food: myFood(), rebirths: me.rebirths, best: Math.max(save.best, me.level) };
      writeSave(save);
    }

    // ---------- HUD ----------
    let hudLevel = -1, hudKey = '';
    function updateHud(me: ViewAnt | undefined, all: ViewAnt[]) {
      if (!me) return;
      const st = STAGES[me.level];
      if (hudLevel !== me.level) {
        hudLevel = me.level;
        const ic = $('.ap-icon');
        ic.innerHTML = '';
        ic.appendChild(copyIcon(me.level, 52));
        $('.ap-name').innerHTML = `<b>L${me.level}</b> ${st.name}`;
      }
      const mhp = st.hp * power(me.rebirths);
      ($('.ap-hp i')).style.width = Math.max(0, me.hp * 100) + '%';
      $('.ap-hp span').textContent = `${Math.ceil(me.hp * mhp)} / ${Math.round(mhp)}`;
      const need = foodNeeded(me.level), food = myFood();
      ($('.ap-food i')).style.width = Math.min(100, (food / need) * 100) + '%';
      $('.ap-food span').textContent = me.level >= MAX_LEVEL ? `Rebirth food ${Math.floor(food)} / ${need}` : `Food ${Math.floor(food)} / ${need}`;
      $('.ap-power').textContent = `Power ${power(me.rebirths).toFixed(2)}x${me.rebirths ? ' · ★' + me.rebirths : ''} · Bite ${Math.round(st.dmg * power(me.rebirths))}`;
      const full = food >= need && !me.dead;
      const showEvolve = full && me.level > 0;
      evolveBtn.hidden = !showEvolve;
      if (showEvolve) {
        const txt = me.level >= MAX_LEVEL
          ? `🌟 REBIRTH → egg with ${power(me.rebirths + 1).toFixed(2)}x power (R)`
          : `⬆ Evolve into ${STAGES[me.level + 1].name}! (E)`;
        if (evolveBtn.textContent !== txt) evolveBtn.textContent = txt;
        evolveBtn.classList.toggle('reb', me.level >= MAX_LEVEL);
      }
      // players
      const ps = all.filter((a) => a.slot >= 0).sort((p, q) => q.level - p.level || q.rebirths - p.rebirths);
      const key = ps.map((p) => `${p.slot}:${p.name}:${p.level}:${p.rebirths}`).join('|');
      if (key !== hudKey) {
        hudKey = key;
        $('.ap-players').innerHTML = ps.length > 1
          ? ps.map((p) => `<div style="color:${PLAYER_COLORS[p.slot % PLAYER_COLORS.length]}">${p.slot === mySlot ? '▶ ' : ''}${esc(p.name)} · L${p.level}${p.rebirths ? ' ★' + p.rebirths : ''}</div>`).join('')
          : '';
      }
      if (me.hp < lastHp - 0.02) { sfx.hurt(); el.classList.remove('ap-ouch'); void el.offsetWidth; el.classList.add('ap-ouch'); }
      lastHp = me.hp;
    }

    // ---------- loop ----------
    let raf = 0, last = performance.now(), acc = 0, netAcc = 0, saveAcc = 0, miniAcc = 0, time = 0, demoA = 0;
    let localBiteT = 0;
    const STEP = 1 / 60;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      const [mx, my] = readStick();
      let ants: ViewAnt[] = [], food: Iterable<ViewFood> = [];
      let me: ViewAnt | undefined;

      if (mode === 'title' || mode === 'local') {
        if (game) {
          if (mode === 'local') game.inputs.set(mySlot, { mx, my, bite: biting() });
          acc += dt;
          while (acc >= STEP) { game.step(STEP); acc -= STEP; }
          const evs = game.takeEvents();
          if (mode === 'local') for (const e of evs) handleEvent(e);
          if (host) {
            pendingEvents.push(...evs);
            netAcc += dt;
            if (netAcc >= 1 / 15) {
              netAcc = 0;
              const rows = [...game.ants.values()].map(antRow);
              host.broadcast({ t: 's', ants: rows, fa: game.foodAdded.map(foodRow), fr: game.foodRemoved, ev: pendingEvents } satisfies ToFriend);
              game.foodAdded = []; game.foodRemoved = []; pendingEvents = [];
            }
          } else { game.foodAdded = []; game.foodRemoved = []; }
          ants = [...game.ants.values()].map(viewOf);
          food = game.food.values();
          me = mode === 'local' ? ants.find((a) => a.slot === mySlot) : undefined;
          if (mode === 'title') {
            // drift the camera over the yard behind the title
            demoA += dt * 0.05;
            renderer.camX = world.puddles.length ? 2100 + Math.cos(demoA) * 900 : 2100;
            renderer.camY = 2100 + Math.sin(demoA * 1.3) * 900;
          }
        }
      } else if (mode === 'friend') {
        for (const a of rAnts.values()) {
          a.bite = Math.max(0, a.bite - dt);
          a.hurt = Math.max(0, a.hurt - dt);
          if (a === myLocal) continue;
          const k = Math.min(1, dt * 12);
          a.x += (a.tx - a.x) * k;
          a.y += (a.ty - a.y) * k;
          let d = a.ta - a.a;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          a.a += d * k;
        }
        if (myLocal && !myLocal.dead) {
          moveAnt(world, myLocal, mx, my, dt);
          localBiteT -= dt;
          if (biting() && localBiteT <= 0 && myLocal.level > 0) { localBiteT = 0.42; myLocal.bite = 0.22; }
        }
        netAcc += dt;
        if (netAcc >= 1 / 20 && friend && myLocal) {
          netAcc = 0;
          friend.send({ t: 'me', x: Math.round(myLocal.x * 10) / 10, y: Math.round(myLocal.y * 10) / 10, a: Math.round(myLocal.a * 100) / 100, m: myLocal.moving, b: biting() } satisfies ToHost);
        }
        ants = [...rAnts.values()];
        food = rFood.values();
        me = myLocal ?? undefined;
      }

      renderer.draw(ants, food, me, dt, time);
      if (mode !== 'title') {
        updateHud(me, ants);
        miniAcc += dt;
        if (miniAcc > 0.25) { miniAcc = 0; drawMinimap(mini, world, ants, me); }
        saveAcc += dt;
        if (saveAcc > 3) { saveAcc = 0; persist(); }
      }
    }

    const onResize = () => renderer.resize();
    window.addEventListener('resize', onResize);
    const onHide = () => { if (document.hidden) persist(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', persist);

    showTitle();
    raf = requestAnimationFrame(frame);

    return () => {
      persist();
      cancelAnimationFrame(raf);
      host?.close();
      friend?.close();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', onHide);
      el.remove();
    };
  },
} satisfies GameModule;
