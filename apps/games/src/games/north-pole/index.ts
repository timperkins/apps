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

const SAVE_KEY = 'north-pole-save-v1';

const TOOL_INFO: Record<Tool, { icon: string; name: string }> = {
  crossbow: { icon: '🏹', name: 'Crossbow' },
  fence: { icon: '🪵', name: 'Fence' },
  tower: { icon: '🗼', name: 'Crossbow tower' },
  belt: { icon: '⏩', name: 'Conveyor belt' },
  grabber: { icon: '🦾', name: 'Grabber' },
};

function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

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
  <p><kbd>WASD</kbd>/arrows move · <kbd>Space</kbd>/<kbd>E</kbd> use · click to shoot or build · <kbd>1</kbd>–<kbd>5</kbd> pick · <kbd>R</kbd> turn · <kbd>X</kbd> pick up a thing · <kbd>L</kbd> load tower · <kbd>B</kbd> shop · <kbd>H</kbd> help</p>`;

const game: GameModule = {
  mount(root, { onExit }) {
    root.innerHTML = `
    <div class="np">
      <canvas class="np-canvas"></canvas>
      <div class="np-stats"></div>
      <div class="np-goal"></div>
      <div class="np-top">
        <button data-b="shop" title="Shop (B)">🛒 Shop</button>
        <button data-b="help" title="Help (H)">?</button>
        <button data-b="mute" title="Sound"></button>
        <button data-b="exit" title="Back to games">✕</button>
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

    // ---------- saving ----------
    const save = () => {
      if (!playing) return;
      try {
        localStorage.setItem(SAVE_KEY, g.save());
      } catch (err) {
        console.warn('save failed', err);
      }
    };
    const saveTimer = setInterval(save, 5000);

    // ---------- title screen ----------
    const showTitle = () => {
      playing = false;
      const has = !!readSave();
      titleEl.hidden = false;
      titleEl.innerHTML = `<div class="np-box np-titlebox">
        <div class="np-logo">🐻‍❄️🌲🏠</div>
        <h1>North Pole Village</h1>
        <p>Chop trees, build fences and keep the polar bears out!</p>
        ${has ? '<button class="np-btn" data-go="continue">Keep playing</button>' : ''}
        <button class="np-btn ${has ? 'np-alt' : ''}" data-go="new">${has ? 'New village' : 'Start'}</button>
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
      if (go === 'exit') return exit();
      if (go === 'new' && readSave() && b.dataset.sure !== '1') {
        b.dataset.sure = '1';
        b.textContent = 'Tap again to start over';
        return;
      }
      const raw = go === 'continue' ? readSave() : null;
      g = (raw && Game.load(raw)) || new Game(Math.floor(Math.random() * 1e9));
      if (go === 'new') {
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
      const id = b.dataset.buy as 'tower' | 'belt' | 'grabber' | 'villager';
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
    const paused = () => !playing || !shopEl.hidden || !helpEl.hidden;

    $('.np-top').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (!b) return;
      unlockAudio();
      const k = b.dataset.b;
      if (k === 'shop') toggle(shopEl);
      if (k === 'help') toggle(helpEl);
      if (k === 'mute') {
        setMuted(!isMuted());
        drawMute();
      }
      if (k === 'exit') exit();
    });
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
      if (g.place(tool, t.x, t.y, rot)) return;
      if (quiet) return;
      if (tool === 'fence' && g.inv.wood <= 0) g.toast('You need wood to build fences. Chop trees!');
      else if (tool !== 'fence' && g.inv[tool] <= 0) g.toast(`You have no ${TOOL_INFO[tool].name.toLowerCase()}s. Buy some in the 🛒 Shop.`);
    };
    const tryPick = () => {
      const t = targetTile();
      if (!g.pickUp(t.x, t.y)) g.toast('Nothing to pick up there.');
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
      if (paused()) return;
      keys.add(k);
      if (k >= '1' && k <= '5') pickTool(TOOLS[Number(k) - 1]);
      else if (k === 'r') turn();
      else if (k === 'l') g.loadTower();
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
        if (t === 'load') g.loadTower();
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
        let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
        let my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
        if (stick.id >= 0) {
          mx = stick.x;
          my = stick.y;
        }
        // aim with the mouse on a computer
        if (!touchMode && mouse.in && !g.p.down && g.p.swing <= 0) {
          const w = ren.toWorld(mouse.x, mouse.y);
          g.p.aim = Math.atan2(w.y - g.p.y, w.x - g.p.x);
        } else if (touchMode && (mx || my) && g.p.swing <= 0) g.p.aim = Math.atan2(my, mx);
        if (keys.has(' ') || keys.has('e') || held.has('use')) g.act();
        if (mouseDown && tool === 'crossbow') {
          const w = ren.toWorld(mouse.x, mouse.y);
          g.shoot(Math.atan2(w.y - g.p.y, w.x - g.p.x));
        }
        if (held.has('fire')) {
          if (tool === 'crossbow') g.shoot(g.autoAim());
          else tryPlace(true);
        }
        g.update(dt, { x: mx, y: my });
      }
      for (const s of g.sounds.splice(0)) play(s);
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
