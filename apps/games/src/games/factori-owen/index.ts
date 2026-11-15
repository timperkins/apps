// Factori-owen: mount the game into a container. Wires up input, the loop, saving and the HUD.
import './style.css';
import { ENTITIES, ITEMS, RECIPE_BY_ID, type ItemId } from './data';
import { isMuted, setMuted, sfx } from './audio';
import { Renderer, type Ghost, type Overlay } from './render';
import { Game, TPS, type Dir, type Entity } from './sim';
import { itemTip, panelAction, recipeTip, renderHotbar, renderPanel, renderQueue, renderResearchMini, type UIState } from './ui';
import { RES_ITEM, RES_NAME, WORLD } from './world';
import { iconURL } from './icons';
import type { GameModule } from '../types';

const SAVE_KEY = 'factori-owen-save-v1';
const BUILD_REACH = 11;
const MINE_REACH = 3.2;

interface Goal {
  text: string;
  done: (g: Game) => boolean;
}

const GOALS: Goal[] = [
  { text: 'Put the burner drill on Owen ore and fuel it', done: (g) => [...g.ents.values()].some((e) => e.type === 'burner-drill' && (e.fuel || e.burn > 0)) },
  { text: 'Smelt 10 Owen plates in a stone furnace', done: (g) => (g.produced['owen-plate'] ?? 0) >= 10 },
  { text: 'Hand-mine coal and stone, then automate coal with a drill', done: (g) => (g.produced['coal'] ?? 0) >= 20 },
  { text: 'Craft and lay 20 conveyor belts', done: (g) => [...g.ents.values()].filter((e) => e.type === 'belt').length >= 20 },
  { text: 'Build a coal generator and power poles', done: (g) => [...g.ents.values()].some((e) => e.type === 'generator' && e.working) },
  { text: 'Build a research lab and research Automation', done: (g) => g.researched.has('automation') },
  { text: 'Have an assembler make Owen gear wheels', done: (g) => [...g.ents.values()].some((e) => e.type === 'assembler' && e.recipe === 'owen-gear' && (e.output?.n ?? 0) > 0) },
  { text: 'Research everything', done: (g) => g.allResearched() },
  { text: 'Build the Great Owen Monument', done: (g) => g.won },
];

function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return Game.load(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not load save', err);
    return null;
  }
}

const mount: GameModule['mount'] = (root, { onExit }) => {
  root.innerHTML = `
  <div class="fo" tabindex="0">
    <canvas class="fo-canvas"></canvas>
    <div class="fo-goals"></div>
    <div class="fo-topright">
      <div class="fo-research"></div>
      <div class="fo-buttons">
        <button class="fo-mini" data-btn="inventory" title="Inventory (E)">Bag</button>
        <button class="fo-mini" data-btn="research" title="Research (T)">Tech</button>
        <button class="fo-mini" data-btn="mute" title="Sound (M)">Sound</button>
        <button class="fo-mini" data-btn="menu" title="Menu (Esc)">Menu</button>
      </div>
    </div>
    <div class="fo-toasts"></div>
    <div class="fo-hand"></div>
    <div class="fo-queue"></div>
    <div class="fo-hotbar"></div>
    <div class="fo-panel" hidden></div>
    <div class="fo-tip" hidden></div>
    <div class="fo-touch">
      <div class="fo-stick"><i></i></div>
      <div class="fo-tbtns">
        <button data-t="rotate">Turn</button>
        <button data-t="clear">Hand</button>
        <button data-t="mine">Mine</button>
      </div>
    </div>
    <div class="fo-win" hidden><h2>Owen is proud of you!</h2><p>You built the Great Owen Monument. Your factory lives on: keep building, or head back to the cabin.</p><button class="fo-btn" data-win="ok">Keep building</button></div>
  </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const wrap = $<HTMLDivElement>('.fo');
  const canvas = $<HTMLCanvasElement>('.fo-canvas');
  const panelEl = $('.fo-panel');
  const tipEl = $('.fo-tip');
  const hotbarEl = $('.fo-hotbar');
  const queueEl = $('.fo-queue');
  const goalsEl = $('.fo-goals');
  const toastsEl = $('.fo-toasts');
  const handEl = $('.fo-hand');
  const researchEl = $('.fo-research');
  const winEl = $('.fo-win');
  const touchMode = matchMedia('(pointer: coarse)').matches;
  wrap.classList.toggle('touch', touchMode);

  const renderer = new Renderer(canvas);
  let game = loadGame() ?? Game.fresh(Math.floor(Math.random() * 1e9));
  let firstRun = !localStorage.getItem(SAVE_KEY);

  const ui: UIState = {
    game,
    panel: firstRun ? 'help' : null,
    entity: null,
    tab: 'logistics',
    cursor: null,
    hotbar: new Array(10).fill(null),
    pickRecipe: false,
    confirmNew: false,
    onExit: () => exit(),
    onNewGame: () => {
      localStorage.removeItem(SAVE_KEY);
      game = Game.fresh(Math.floor(Math.random() * 1e9));
      ui.game = game;
      ui.hotbar = new Array(10).fill(null);
      ui.cursor = null;
      renderer.camX = game.px;
      renderer.camY = game.py;
      ui.panel = 'help';
      winEl.hidden = true;
      save();
    },
    onSave: () => save(),
    setCursor: (item) => {
      ui.cursor = item;
    },
  };
  try {
    const hb = JSON.parse(localStorage.getItem(SAVE_KEY + '-hotbar') ?? 'null');
    if (Array.isArray(hb) && hb.length === 10) ui.hotbar = hb.map((x) => (x && ITEMS[x as ItemId] ? x : null));
  } catch {
    /* ignore */
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
      localStorage.setItem(SAVE_KEY + '-hotbar', JSON.stringify(ui.hotbar));
      firstRun = false;
    } catch (err) {
      console.warn('save failed', err);
    }
  }

  // ---------- input state ----------
  const keys = new Set<string>();
  let mouseX = 0, mouseY = 0, mouseIn = false;
  let leftDown = false, rightDown = false;
  let cursorDir: Dir = 0;
  let lastPlaced = '';
  let mineKey = '';
  let mineProgress = 0;
  let mineTick = 0;
  let stick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  let touchHold: { id: number; x: number; y: number; t: number; moved: boolean; mining: boolean } | null = null;
  let pinch: { d: number; z: number } | null = null;
  const touches = new Map<number, [number, number]>();
  let touchMineBtn = false;

  const hoverTile = (): [number, number] | null => {
    if (!mouseIn) return null;
    const [wx, wy] = renderer.screenToWorld(mouseX, mouseY);
    const tx = Math.floor(wx), ty = Math.floor(wy);
    return game.world.inside(tx, ty) ? [tx, ty] : null;
  };

  const ghostFor = (item: ItemId | null): Ghost | null => {
    if (!item || !mouseIn) return null;
    const type = ITEMS[item].place;
    if (!type) return null;
    const d = ENTITIES[type];
    const [wx, wy] = renderer.screenToWorld(mouseX, mouseY);
    const x = Math.floor(wx - d.w / 2 + 0.5), y = Math.floor(wy - d.h / 2 + 0.5);
    const inReach = Math.hypot(x + d.w / 2 - game.px, y + d.h / 2 - game.py) <= BUILD_REACH;
    return { type, x, y, dir: cursorDir, ok: inReach && game.inv.count(item) > 0 && game.canPlace(type, x, y) };
  };

  function tryPlace() {
    const item = ui.cursor;
    const gh = ghostFor(item);
    if (!item || !gh) return;
    const key = `${gh.x},${gh.y}`;
    if (key === lastPlaced) return;
    // Rotating onto an existing belt by dragging over it
    const existing = game.entAt(gh.x, gh.y);
    if (existing && existing.type === gh.type && existing.def.rotatable && existing.dir !== cursorDir && ENTITIES[gh.type].w === 1) {
      existing.dir = cursorDir;
      game.updateCurves(existing.x, existing.y);
      lastPlaced = key;
      return;
    }
    if (!gh.ok) {
      if (game.inv.count(item) <= 0) {
        ui.cursor = null;
      }
      return;
    }
    const e = game.place(gh.type, gh.x, gh.y, gh.dir);
    if (e) {
      game.inv.remove(item, 1);
      lastPlaced = key;
      sfx.place();
      if (game.inv.count(item) <= 0) ui.cursor = null;
    }
  }

  function openEntity(e: Entity) {
    const reach = Math.hypot(e.cx - game.px, e.cy - game.py) <= BUILD_REACH;
    if (!reach) {
      game.toast('Too far away');
      sfx.error();
      return;
    }
    ui.entity = e;
    ui.panel = 'entity';
    ui.pickRecipe = false;
    sfx.click();
  }

  function pipette() {
    if (ui.cursor) {
      ui.cursor = null;
      return;
    }
    const t = hoverTile();
    const e = t ? game.entAt(t[0], t[1]) : null;
    if (e) {
      const item = e.def.item;
      if (game.inv.count(item) > 0) {
        ui.cursor = item;
        cursorDir = e.dir;
      } else {
        game.toast(`No ${ITEMS[item].name.toLowerCase()} in your inventory`);
      }
    }
  }

  function rotate() {
    if (ui.cursor) {
      cursorDir = ((cursorDir + 1) % 4) as Dir;
      sfx.rotate();
      return;
    }
    const t = hoverTile();
    const e = t ? game.entAt(t[0], t[1]) : null;
    if (e && e.def.rotatable) {
      game.rotate(e);
      sfx.rotate();
    }
  }

  function togglePanel(p: UIState['panel']) {
    ui.panel = ui.panel === p ? null : p;
    ui.confirmNew = false;
    panelDirty = true;
  }

  function onKey(ev: KeyboardEvent, down: boolean) {
    if (!wrap.isConnected) return;
    const k = ev.key.toLowerCase();
    if (down) {
      if (k === 'e') togglePanel('inventory');
      else if (k === 't') togglePanel('research');
      else if (k === 'escape') {
        if (ui.panel) ui.panel = null;
        else if (ui.cursor) ui.cursor = null;
        else ui.panel = 'menu';
        panelDirty = true;
      } else if (k === 'r') rotate();
      else if (k === 'q') pipette();
      else if (k === 'm') toggleMute();
      else if (/^[0-9]$/.test(k)) selectHot((Number(k) + 9) % 10);
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (down) keys.add(k);
      else keys.delete(k);
      ev.preventDefault();
    }
  }
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  const blur = () => {
    keys.clear();
    leftDown = rightDown = false;
  };
  window.addEventListener('blur', blur);

  function selectHot(i: number) {
    const it = ui.hotbar[i];
    if (!it) return;
    if (ui.cursor === it) ui.cursor = null;
    else if (game.inv.count(it) > 0) ui.cursor = it;
    else game.toast(`No ${ITEMS[it].name.toLowerCase()} left. Craft more with E.`);
  }

  function toggleMute() {
    setMuted(!isMuted());
    game.toast(isMuted() ? 'Sound off' : 'Sound on');
  }

  // ---------- mouse on the world ----------
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    wrap.focus();
    if (e.pointerType === 'touch') return onTouchStart(e);
    mouseX = e.offsetX;
    mouseY = e.offsetY;
    mouseIn = true;
    if (e.button === 0) {
      leftDown = true;
      lastPlaced = '';
      if (ui.cursor) tryPlace();
      else {
        const t = hoverTile();
        const ent = t ? game.entAt(t[0], t[1]) : null;
        if (ent) openEntity(ent);
        else if (ui.panel === 'entity') ui.panel = null;
        panelDirty = true;
      }
    } else if (e.button === 2) {
      rightDown = true;
    }
  });
  window.addEventListener('pointerup', onPointerUp);
  function onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch') return onTouchEnd(e);
    if (e.button === 0) leftDown = false;
    if (e.button === 2) rightDown = false;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return onTouchMove(e);
    mouseX = e.offsetX;
    mouseY = e.offsetY;
    mouseIn = true;
    if (leftDown && ui.cursor) tryPlace();
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') mouseIn = false;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      renderer.zoom = Math.max(10, Math.min(96, renderer.zoom * (e.deltaY > 0 ? 0.88 : 1.14)));
    },
    { passive: false },
  );

  // ---------- touch ----------
  const stickEl = $('.fo-stick');
  const stickKnob = stickEl.querySelector('i')!;
  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickEl.setPointerCapture(e.pointerId);
    const r = stickEl.getBoundingClientRect();
    stick = { active: true, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2, dx: 0, dy: 0 };
    moveStick(e);
  });
  stickEl.addEventListener('pointermove', (e) => {
    if (stick.active && e.pointerId === stick.id) moveStick(e);
  });
  const endStick = (e: PointerEvent) => {
    if (e.pointerId !== stick.id) return;
    stick.active = false;
    stick.dx = stick.dy = 0;
    stickKnob.style.transform = '';
  };
  stickEl.addEventListener('pointerup', endStick);
  stickEl.addEventListener('pointercancel', endStick);
  function moveStick(e: PointerEvent) {
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const l = Math.hypot(dx, dy), max = 44;
    if (l > max) {
      dx = (dx / l) * max;
      dy = (dy / l) * max;
    }
    stick.dx = dx / max;
    stick.dy = dy / max;
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  root.querySelectorAll<HTMLButtonElement>('.fo-tbtns button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const t = b.dataset.t;
      if (t === 'rotate') rotate();
      if (t === 'clear') ui.cursor = null;
      if (t === 'mine') {
        touchMineBtn = true;
        b.classList.add('on');
      }
    });
    const up = () => {
      if (b.dataset.t === 'mine') {
        touchMineBtn = false;
        b.classList.remove('on');
      }
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  });

  function onTouchStart(e: PointerEvent) {
    touches.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: renderer.zoom };
      touchHold = null;
      rightDown = false;
      return;
    }
    mouseX = e.offsetX;
    mouseY = e.offsetY;
    mouseIn = true;
    touchHold = { id: e.pointerId, x: e.offsetX, y: e.offsetY, t: performance.now(), moved: false, mining: false };
    lastPlaced = '';
    if (ui.cursor) {
      leftDown = true;
      tryPlace();
    }
  }
  function onTouchMove(e: PointerEvent) {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      renderer.zoom = Math.max(10, Math.min(96, pinch.z * (d / pinch.d)));
      return;
    }
    if (touchHold && e.pointerId === touchHold.id) {
      if (Math.hypot(e.offsetX - touchHold.x, e.offsetY - touchHold.y) > 12) touchHold.moved = true;
      mouseX = e.offsetX;
      mouseY = e.offsetY;
      if (leftDown && ui.cursor) tryPlace();
    }
  }
  function onTouchEnd(e: PointerEvent) {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (touchHold && e.pointerId === touchHold.id) {
      const quick = performance.now() - touchHold.t < 350 && !touchHold.mining;
      if (quick && !ui.cursor && !touchHold.moved) {
        const t = hoverTile();
        const ent = t ? game.entAt(t[0], t[1]) : null;
        if (ent) openEntity(ent);
        panelDirty = true;
      }
      touchHold = null;
      leftDown = false;
      rightDown = false;
      mouseIn = false;
    }
  }

  // ---------- HUD buttons, panel, hotbar ----------
  root.querySelectorAll<HTMLButtonElement>('[data-btn]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.btn;
      if (k === 'inventory') togglePanel('inventory');
      if (k === 'research') togglePanel('research');
      if (k === 'menu') togglePanel('menu');
      if (k === 'mute') toggleMute();
    }),
  );
  panelEl.addEventListener('contextmenu', (e) => e.preventDefault());
  panelEl.addEventListener('pointerdown', (e) => {
    if (panelAction(ui, e.target as HTMLElement, e.button, e.shiftKey)) {
      panelDirty = true;
      hideTip();
    }
  });
  hotbarEl.addEventListener('contextmenu', (e) => e.preventDefault());
  hotbarEl.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hot]');
    if (!el) return;
    const i = Number(el.dataset.hot);
    if (e.button === 2) ui.hotbar[i] = null;
    else selectHot(i);
  });
  queueEl.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cancel]');
    if (el) game.cancelCraft(Number(el.dataset.cancel));
  });
  winEl.querySelector('button')!.addEventListener('click', () => (winEl.hidden = true));

  // tooltips
  function hideTip() {
    tipEl.hidden = true;
  }
  root.addEventListener('pointermove', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!el || e.pointerType === 'touch') return hideTip();
    const [kind, id] = el.dataset.tip!.split(':');
    tipEl.innerHTML = kind === 'recipe' ? recipeTip(game, RECIPE_BY_ID[id]) : itemTip(game, id as ItemId);
    tipEl.hidden = false;
    const r = root.getBoundingClientRect();
    let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
    if (x + 260 > r.width) x = e.clientX - r.left - 270;
    if (y + tipEl.offsetHeight > r.height) y = r.height - tipEl.offsetHeight - 8;
    tipEl.style.transform = `translate(${x}px, ${y}px)`;
  });

  // ---------- per-tick player actions ----------
  function playerTick() {
    let mx = 0, my = 0;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (stick.active && Math.hypot(stick.dx, stick.dy) > 0.2) {
      mx = stick.dx;
      my = stick.dy;
    }
    game.movePlayer(mx, my);

    // touch long-press = mine
    if (touchHold && !touchHold.moved && !ui.cursor && performance.now() - touchHold.t > 350) {
      touchHold.mining = true;
    }
    const mining = rightDown || (touchHold?.mining ?? false) || touchMineBtn;
    let target: { key: string; time: number; x: number; y: number; w: number; h: number; done: () => void } | null = null;
    if (mining) {
      let t = hoverTile();
      if (touchMineBtn && !touchHold) t = nearestMineable();
      if (t) {
        const [tx, ty] = t;
        const e = game.entAt(tx, ty);
        const w = game.world;
        const i = w.idx(tx, ty);
        if (e) {
          if (Math.hypot(e.cx - game.px, e.cy - game.py) <= BUILD_REACH)
            target = {
              key: 'e' + e.id, time: e.def.mineTime, x: e.x, y: e.y, w: e.def.w, h: e.def.h,
              done: () => {
                const items = game.remove(e);
                for (const [it, n] of items) {
                  const k = game.inv.add(it, n);
                  if (k < n) game.toast('Inventory full: some items were lost');
                }
                if (ui.entity === e) ui.panel = null;
                sfx.pickup();
              },
            };
        } else if (Math.hypot(tx + 0.5 - game.px, ty + 0.5 - game.py) <= MINE_REACH) {
          if (w.tree[i])
            target = {
              key: 't' + i, time: 1.2, x: tx, y: ty, w: 1, h: 1,
              done: () => {
                w.tree[i] = 0;
                game.inv.add('wood', 4);
                game.produced.wood = (game.produced.wood ?? 0) + 4;
                sfx.pickup();
              },
            };
          else if (w.res[i]) {
            const item = RES_ITEM[w.res[i]] as ItemId;
            target = {
              key: 'r' + i, time: 1, x: tx, y: ty, w: 1, h: 1,
              done: () => {
                if (game.inv.add(item, 1) === 1) {
                  w.mineRes(tx, ty);
                  game.produced[item] = (game.produced[item] ?? 0) + 1;
                  sfx.pickup();
                } else game.toast('Inventory full');
              },
            };
          }
        }
      }
    }
    if (target) {
      if (target.key !== mineKey) {
        mineKey = target.key;
        mineProgress = 0;
      }
      mineProgress += 1 / TPS / target.time;
      if (++mineTick % 14 === 0) (target.key[0] === 't' ? sfx.chop : sfx.mine)();
      if (mineProgress >= 1) {
        target.done();
        mineProgress = 0;
        if (target.key[0] !== 'r') mineKey = '';
        panelDirty = true;
      }
      miningOverlay = { x: target.x, y: target.y, w: target.w, h: target.h, p: mineProgress };
    } else {
      mineKey = '';
      mineProgress = 0;
      miningOverlay = null;
    }
  }

  function nearestMineable(): [number, number] | null {
    const w = game.world;
    let best: [number, number] | null = null, bd = 1e9;
    const px = Math.floor(game.px), py = Math.floor(game.py);
    for (let y = py - 3; y <= py + 3; y++)
      for (let x = px - 3; x <= px + 3; x++) {
        if (!w.inside(x, y)) continue;
        const i = w.idx(x, y);
        if (game.entAt(x, y) || !(w.res[i] || w.tree[i])) continue;
        const d = Math.hypot(x + 0.5 - game.px, y + 0.5 - game.py);
        if (d < bd && d <= MINE_REACH) {
          bd = d;
          best = [x, y];
        }
      }
    return best;
  }

  let miningOverlay: Overlay['mining'] = null;

  // keep the hotbar stocked with what you can build
  function refreshHotbar() {
    for (const s of game.inv.slots) {
      if (!s || !ITEMS[s.item].place || ui.hotbar.includes(s.item)) continue;
      const free = ui.hotbar.indexOf(null);
      if (free >= 0) ui.hotbar[free] = s.item;
    }
  }

  // ---------- loop ----------
  let panelDirty = true;
  let last = performance.now();
  let acc = 0;
  let frame = 0;
  let raf = 0;
  let lastSave = performance.now();
  let lastGoals = '';
  let lastHud = '';
  renderer.camX = game.px;
  renderer.camY = game.py;

  const resize = () => renderer.resize();
  window.addEventListener('resize', resize);
  resize();

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const paused = ui.panel === 'menu' || ui.panel === 'help';
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / TPS && steps < 8) {
        playerTick();
        game.step();
        acc -= 1 / TPS;
        steps++;
      }
      if (steps === 8) acc = 0;
    }
    for (const ev of game.events) {
      if (ev === 'research') {
        sfx.research();
        panelDirty = true;
      }
      if (ev === 'craft') sfx.craft();
      if (ev === 'win') {
        sfx.win();
        winEl.hidden = false;
      }
    }
    game.events.length = 0;

    // camera follows the player smoothly
    renderer.camX += (game.px - renderer.camX) * Math.min(1, dt * 10);
    renderer.camY += (game.py - renderer.camY) * Math.min(1, dt * 10);
    renderer.camX = Math.max(0, Math.min(WORLD, renderer.camX));
    renderer.camY = Math.max(0, Math.min(WORLD, renderer.camY));

    const ht = hoverTile();
    const ghost = ghostFor(ui.cursor);
    const hoverEnt = ht ? game.entAt(ht[0], ht[1]) : null;
    const cursorKind = ui.cursor ? ENTITIES[ITEMS[ui.cursor].place!]?.kind : null;
    const ov: Overlay = {
      hoverTile: ht,
      hoverEnt,
      ghost,
      mining: miningOverlay,
      showPower: cursorKind === 'pole' || !!(ui.cursor && ENTITIES[ITEMS[ui.cursor].place!]?.electric) || hoverEnt?.def.kind === 'pole',
      reachOk: !!hoverEnt && Math.hypot(hoverEnt.cx - game.px, hoverEnt.cy - game.py) <= BUILD_REACH,
    };
    renderer.draw(game, ov, now / 1000);

    frame++;
    if (ui.panel === 'entity' && ui.entity && !game.ents.has(ui.entity.id)) ui.panel = null;
    if (ui.panel === 'entity' && ui.entity && Math.hypot(ui.entity.cx - game.px, ui.entity.cy - game.py) > BUILD_REACH + 2) ui.panel = null;
    if (panelDirty || (ui.panel && frame % 12 === 0 && ui.panel !== 'menu' && ui.panel !== 'help')) {
      renderPanel(panelEl, ui);
      panelDirty = false;
    }
    if (frame % 6 === 0) {
      refreshHotbar();
      if (ui.cursor && game.inv.count(ui.cursor) <= 0) ui.cursor = null;
      const hudKey = JSON.stringify([ui.hotbar, ui.cursor, game.inv.slots.length && game.inv.toJSON()]);
      if (hudKey !== lastHud) {
        lastHud = hudKey;
        renderHotbar(hotbarEl, ui);
      }
      renderQueue(queueEl, game);
      renderResearchMini(researchEl, game);
      toastsEl.innerHTML = game.toasts.map((t) => `<div>${t.text}</div>`).join('');
      handEl.innerHTML = ui.cursor
        ? `<img src="${iconURL(ui.cursor)}" alt=""><span>${ITEMS[ui.cursor].name} × ${game.inv.count(ui.cursor)}</span><em>${
            touchMode ? 'Tap to build · Turn rotates · Hand to put away' : 'R rotate · Q put away'
          }</em>`
        : hoverInfo(ht, hoverEnt);
      handEl.hidden = !handEl.innerHTML;
      const gk = GOALS.map((g) => (g.done(game) ? 1 : 0)).join('');
      if (gk !== lastGoals) {
        lastGoals = gk;
        const next = GOALS.findIndex((g) => !g.done(game));
        goalsEl.innerHTML = `<h4>Goals</h4>${GOALS.map(
          (g, i) => `<div class="${g.done(game) ? 'done' : i === next ? 'next' : ''}">${g.done(game) ? '✓' : '○'} ${g.text}</div>`,
        ).join('')}`;
      }
    }
    if (now - lastSave > 30000) {
      lastSave = now;
      save();
    }
  }
  raf = requestAnimationFrame(loop);

  function hoverInfo(ht: [number, number] | null, e: Entity | null): string {
    if (touchMode) return '';
    if (e) return `<span>${ITEMS[e.def.item].name}</span><em>${e.status || ''} · click to open · right-click to pick up</em>`;
    if (!ht) return '';
    const w = game.world;
    const i = w.idx(ht[0], ht[1]);
    if (w.res[i]) return `<span>${RES_NAME[w.res[i]]}: ${w.amount[i]}</span><em>hold right-click to mine</em>`;
    if (w.tree[i]) return `<span>Tree</span><em>hold right-click to chop</em>`;
    return '';
  }

  const onHide = () => {
    if (document.visibilityState === 'hidden') save();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('beforeunload', save);
  wrap.focus();

  function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    window.removeEventListener('blur', blur);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', resize);
    window.removeEventListener('beforeunload', save);
    document.removeEventListener('visibilitychange', onHide);
    root.innerHTML = '';
  }

  function exit() {
    save();
    cleanup();
    onExit();
  }

  return () => {
    save();
    cleanup();
  };
};

export default { mount } satisfies GameModule;
