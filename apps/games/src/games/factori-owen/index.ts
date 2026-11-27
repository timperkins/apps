// Factori-owen: mount the game into a container. Title screen, input, the loop, saving and the HUD.
import './style.css';
import { ENTITIES, footprint, ITEMS, RECIPE_BY_ID, useRules, type ItemId } from './data';
import { isMuted, setMuted, sfx } from './audio';
import { Renderer, type Ghost, type Overlay } from './render';
import { Game, TPS, type Dir, type Entity } from './sim';
import { helpHtml, itemTip, panelAction, recipeTip, renderHotbar, renderPanel, renderQueue, renderResearchMini, type UIState } from './ui';
import { RES_NAME, WORLD } from './world';
import { iconURL } from './icons';
import { localActions, type Actions } from './actions';
import { DEFAULT_LOOK, drawPlayer, LOOK_OPTIONS, type PlayerLook } from './art';
import { cycleWeapon, MAG_SIZE, playerWeapon, throwGrenade, WEAPONS } from './combat';
import { drawSpace } from './space';
import { Res } from './world';
import { drillSpeed, reachBonus } from './bonus';
import { shieldMax } from './armor';
import { explore, Minimap } from './minimap';
import { buildScene, pickScene, SCENE_SECONDS, type Scene } from './scenes';
import type { GameModule } from '../types';
import type { GuestSession, HostSession } from './mp';

const OLD_SAVE_KEY = 'factori-owen-save-v1';
const INDEX_KEY = 'factori-owen-saves';
const PROFILE_KEY = 'factori-owen-profile';
const slotKey = (id: string) => `factori-owen-slot-${id}`;
const BUILD_REACH = 11;
const MINE_REACH = 3.2;

interface SaveMeta {
  id: string;
  name: string;
  saved: number;
  enemies: boolean;
  hotbar?: (ItemId | null)[];
  advanced?: boolean;
}

interface Profile {
  name: string;
  look: PlayerLook;
}

interface Goal {
  text: string;
  done: (g: Game) => boolean;
}

const GOALS: Goal[] = [
  { text: 'Put the burner drill on Owen ore and fuel it', done: (g) => [...g.ents.values()].some((e) => e.type === 'burner-drill' && (e.fuel || e.burn > 0)) },
  { text: 'Smelt 10 Owen plates in a stone furnace', done: (g) => (g.produced['owen-plate'] ?? 0) >= 10 },
  { text: 'Hand-mine coal and stone, then automate coal with a drill', done: (g) => (g.produced['coal'] ?? 0) >= 20 },
  { text: 'Craft and lay 20 conveyor belts', done: (g) => [...g.ents.values()].filter((e) => e.type === 'belt').length >= 20 },
  { text: 'Build a gun turret and load it with Owen bullets', done: (g) => [...g.ents.values()].some((e) => e.type === 'gun-turret' && (e.input['owen-ammo'] ?? 0) + e.burn > 0) },
  { text: 'Build a coal generator and power poles', done: (g) => [...g.ents.values()].some((e) => e.type === 'generator' && e.working) },
  { text: 'Build a research lab and research Automation', done: (g) => g.researched.has('automation') },
  { text: 'Have an assembler make Owen gear wheels', done: (g) => [...g.ents.values()].some((e) => e.type === 'assembler' && e.recipe === 'owen-gear' && (e.output?.n ?? 0) > 0) },
  { text: 'Research Rail guns and destroy a bug nest', done: (g) => g.researched.has('rail-guns') && g.nestsDestroyed > 0 },
  { text: 'Research everything', done: (g) => g.allResearched() },
  { text: 'Build the Great Owen Monument', done: (g) => g.won },
];

const has = (g: Game, t: string, ok: (e: Entity) => boolean = () => true) => [...g.ents.values()].some((e) => e.type === t && ok(e));
const ADV_GOALS: Goal[] = [
  { text: 'Put the burner drill on Owen ore and fuel it', done: (g) => has(g, 'burner-drill', (e) => !!e.fuel || e.burn > 0) },
  { text: 'Smelt 10 Owen plates in a stone furnace', done: (g) => (g.produced['owen-plate'] ?? 0) >= 10 },
  { text: 'Pump water from the pond into a steam engine', done: (g) => has(g, 'steam-engine', (e) => e.working) },
  { text: 'Research Green science in a 2×2 science lab', done: (g) => g.researched.has('green-science') },
  { text: 'Pump crude oil with a pump jack', done: (g) => (g.produced['crude-oil'] ?? 0) >= 100 || has(g, 'pumpjack', (e) => e.working) },
  { text: 'Make plastic in an oil refinery', done: (g) => (g.produced['plastic'] ?? 0) > 0 },
  { text: 'Research Rocket silo and launch a rocket', done: (g) => g.space.launches > 0 },
  { text: 'Catch an asteroid and crush it in space', done: (g) => g.space.built && (g.space.cargo.count('cryser-crystal') > 0 || (g.produced['cryser-crystal'] ?? 0) > 0 || g.space.crushers > 0 && g.space.catchers > 0) },
  { text: 'Build the Great Owen Monument', done: (g) => g.won },
];
const goalsFor = (g: Game) => (g.advanced ? ADV_GOALS : GOALS);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, v: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch (err) {
    console.warn('save failed', err);
    return false;
  }
}

function listSaves(): SaveMeta[] {
  const list = readJSON<SaveMeta[]>(INDEX_KEY, []);
  // bring forward a save from the first version of the game
  const old = localStorage.getItem(OLD_SAVE_KEY);
  if (old) {
    const id = 'first';
    try {
      localStorage.setItem(slotKey(id), old);
      list.unshift({ id, name: 'My factory', saved: Date.now(), enemies: false, hotbar: readJSON(OLD_SAVE_KEY + '-hotbar', undefined) });
      localStorage.removeItem(OLD_SAVE_KEY);
      localStorage.removeItem(OLD_SAVE_KEY + '-hotbar');
      writeJSON(INDEX_KEY, list);
    } catch {
      /* ignore */
    }
  }
  return list.sort((a, b) => b.saved - a.saved);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};

type TitleView = 'main' | 'new' | 'load' | 'join' | 'help' | 'look';

const mount: GameModule['mount'] = (root, { onExit }) => {
  root.innerHTML = `
  <div class="fo" tabindex="0">
    <canvas class="fo-canvas"></canvas>
    <div class="fo-hud">
      <div class="fo-goals"></div>
      <div class="fo-topright">
        <div class="fo-research"></div>
        <div class="fo-buttons">
          <button class="fo-mini" data-btn="space" title="Space platform" hidden>Space</button>
          <button class="fo-mini" data-btn="inventory" title="Inventory (E)">Bag</button>
          <button class="fo-mini" data-btn="research" title="Research (T)">Tech</button>
          <button class="fo-mini" data-btn="mute" title="Sound (M)">Sound</button>
          <button class="fo-mini" data-btn="menu" title="Menu (Esc)">Menu</button>
        </div>
        <canvas class="fo-minimap" title="Map (N): click to open the whole map"></canvas>
        <div class="fo-mpstatus" hidden></div>
      </div>
      <div class="fo-health"><div class="fo-hpcol"><div class="fo-hp fo-shield" hidden><i></i></div><div class="fo-hp"><i></i></div></div><span class="fo-weapon"></span></div>
      <div class="fo-toasts"></div>
      <div class="fo-hand"></div>
      <div class="fo-queue"></div>
      <div class="fo-hotbar"></div>
      <div class="fo-panel" hidden></div>
      <div class="fo-touch">
        <div class="fo-stick"><i></i></div>
        <div class="fo-tbtns">
          <button data-t="shoot">Shoot</button>
          <button data-t="grenade">Boom</button>
          <button data-t="mine">Mine</button>
          <button data-t="rotate">Turn</button>
          <button data-t="clear">Hand</button>
        </div>
      </div>
      <div class="fo-dead" hidden></div>
      <div class="fo-win" hidden><h2>Owen is proud of you!</h2><p>You built the Great Owen Monument. Your factory lives on: keep building, or quit to the title screen.</p><button class="fo-btn" data-win="ok">Keep building</button></div>
    </div>
    <div class="fo-bigmap" hidden><div class="fo-bigmap-box"><h3>Map <span class="fo-sub">yellow is you · red is a bug nest · brown haze is pollution (advanced)</span></h3><canvas></canvas><button class="fo-btn" data-bigmap="close">Close (N)</button></div></div>
    <div class="fo-title"></div>
    <div class="fo-fade"></div>
    <div class="fo-tip" hidden></div>
  </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const wrap = $<HTMLDivElement>('.fo');
  const canvas = $<HTMLCanvasElement>('.fo-canvas');
  const hud = $('.fo-hud');
  const titleEl = $('.fo-title');
  const fadeEl = $('.fo-fade');
  const panelEl = $('.fo-panel');
  const tipEl = $('.fo-tip');
  const hotbarEl = $('.fo-hotbar');
  const queueEl = $('.fo-queue');
  const goalsEl = $('.fo-goals');
  const toastsEl = $('.fo-toasts');
  const handEl = $('.fo-hand');
  const researchEl = $('.fo-research');
  const winEl = $('.fo-win');
  const deadEl = $('.fo-dead');
  const hpEl = $('.fo-hp:not(.fo-shield) i');
  const shEl = $('.fo-shield i');
  const gBtn = $('[data-t="grenade"]');
  const weaponEl = $('.fo-weapon');
  weaponEl.addEventListener('click', () => switchWeapon());
  const spaceBtn = $('[data-btn="space"]');
  const mpEl = $('.fo-mpstatus');
  const bigMapEl = $('.fo-bigmap');
  const minimap = new Minimap($<HTMLCanvasElement>('.fo-minimap'), $<HTMLCanvasElement>('.fo-bigmap canvas'));
  const toggleBigMap = (open = bigMapEl.hidden) => {
    bigMapEl.hidden = !open;
  };
  $('.fo-minimap').addEventListener('click', () => toggleBigMap());
  bigMapEl.addEventListener('click', (ev) => {
    if (ev.target === bigMapEl || (ev.target as HTMLElement).dataset.bigmap) toggleBigMap(false);
  });
  const touchMode = matchMedia('(pointer: coarse)').matches;
  wrap.classList.toggle('touch', touchMode);

  const renderer = new Renderer(canvas);
  const profile: Profile = { name: 'Engineer', ...readJSON<Partial<Profile>>(PROFILE_KEY, {}), look: { ...DEFAULT_LOOK, ...readJSON<Partial<Profile>>(PROFILE_KEY, {}).look } };
  renderer.look = profile.look;

  // ---------- modes ----------
  let mode: 'title' | 'game' = 'title';
  let titleView: TitleView = 'main';
  let scene: Scene = buildScene(pickScene());
  let sceneT = 0;
  let game: Game = scene.game;
  let slot: SaveMeta | null = null;
  let host: HostSession | null = null;
  let guest: GuestSession | null = null;
  let hostList: { id: string; name: string; world: string; players: number; updated: number }[] | null = null;
  let joinStatus = '';
  let act: Actions = localActions(() => game);

  const ui: UIState = {
    game,
    panel: null,
    entity: null,
    tab: 'logistics',
    cursor: null,
    hotbar: new Array(10).fill(null),
    pickRecipe: false,
    act,
    setCursor: (item) => {
      ui.cursor = item;
    },
    menuHtml: () => menuHtml(),
    onMenu: (a, el) => menuAction(a, el),
  };
  let menuView: 'menu' | 'load' | 'look' = 'menu';

  function setGame(g: Game) {
    useRules(g.advanced);
    game = g;
    ui.game = g;
    ui.cursor = null;
    ui.entity = null;
    renderer.camX = g.px;
    renderer.camY = g.py;
  }

  function save(): boolean {
    if (mode !== 'game' || guest || !slot) return false;
    slot.saved = Date.now();
    slot.hotbar = ui.hotbar;
    const ok = writeJSON(slotKey(slot.id), game.serialize());
    const list = listSaves().filter((s) => s.id !== slot!.id);
    list.unshift(slot);
    writeJSON(INDEX_KEY, list);
    if (!ok) game.toast('Could not save: the browser is out of storage');
    return ok;
  }

  function startGame(g: Game, meta: SaveMeta | null) {
    setGame(g);
    slot = meta;
    ui.hotbar = meta?.hotbar?.length === 10 ? meta.hotbar.map((x) => (x && ITEMS[x] ? x : null)) : new Array(10).fill(null);
    act = guest ? guest.actions() : localActions(() => game);
    ui.act = act;
    mode = 'game';
    titleEl.hidden = true;
    hud.hidden = false;
    winEl.hidden = true;
    ui.panel = !meta || readJSON(PROFILE_KEY + '-helped', false) ? null : 'help';
    writeJSON(PROFILE_KEY + '-helped', true);
    panelDirty = true;
    lastGoals = '';
    lastHud = '';
    flash();
    if (meta) save();
  }

  async function quitToTitle() {
    save();
    if (host) {
      await host.close().catch(() => {});
      host = null;
    }
    if (guest) {
      guest.close();
      guest = null;
    }
    renderer.others = [];
    mode = 'title';
    titleView = 'main';
    ui.panel = null;
    newScene();
    renderTitle();
    hud.hidden = true;
    titleEl.hidden = false;
  }

  function newScene() {
    scene = buildScene(pickScene(scene?.kind));
    sceneT = 0;
    setGame(scene.game);
    renderer.look = profile.look;
    flash();
  }

  function flash() {
    fadeEl.classList.remove('go');
    void fadeEl.offsetWidth;
    fadeEl.classList.add('go');
  }

  // ---------- title screen ----------
  function lookPreview() {
    return `<canvas class="fo-lookcv" width="160" height="160"></canvas>`;
  }

  function swatches(key: 'hair' | 'skin' | 'armor' | 'trim' | 'helmet', label: string) {
    return `<div class="fo-swrow"><label>${label}</label>${LOOK_OPTIONS[key]
      .map((c) => `<button class="fo-sw ${profile.look[key] === c ? 'on' : ''}" style="background:${c}" data-look="${key}" data-v="${c}" aria-label="${label} ${c}"></button>`)
      .join('')}</div>`;
  }

  function lookHtml(back: string) {
    return `<h2>Your engineer</h2>
    <div class="fo-look">
      ${lookPreview()}
      <div>
        <div class="fo-swrow"><label>Name</label><input class="fo-name" maxlength="20" value="${esc(profile.name)}"></div>
        ${swatches('hair', 'Hair')}
        <div class="fo-swrow"><label>Style</label>${LOOK_OPTIONS.hairStyle.map((n, i) => `<button class="fo-chip ${profile.look.hairStyle === i ? 'on' : ''}" data-look="hairStyle" data-v="${i}">${n}</button>`).join('')}</div>
        ${swatches('skin', 'Skin')}
        ${swatches('armor', 'Armor')}
        ${swatches('trim', 'Trim')}
        ${swatches('helmet', 'Helmet')}
      </div>
    </div>
    <button class="fo-btn" ${back === 'menu' ? 'data-act="mback"' : `data-title="${back}"`}>Done</button>`;
  }

  function drawLookPreview() {
    const cv = root.querySelector<HTMLCanvasElement>('.fo-lookcv');
    if (!cv) return;
    const c = cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#4f7a43';
    c.beginPath();
    c.arc(80, 80, 76, 0, Math.PI * 2);
    c.fill();
    c.setTransform(110, 0, 0, 110, 80, 96);
    const t = performance.now() / 1000;
    drawPlayer(c, 0, 0, Math.floor(t / 1.2) % 4 === 0 ? 2 : [2, 1, 2, 3][Math.floor(t / 1.2) % 4], true, t, false, profile.look);
  }

  function renderTitle() {
    let body = '';
    const saves = listSaves();
    switch (titleView) {
      case 'main':
        body = `<h1>Factori-owen</h1><p class="fo-tag">Mine Owen ore. Smelt Owen plates. Keep the bugs away.</p>
        <div class="fo-tmenu">
          <button class="fo-btn big" data-title="new">Play</button>
          <button class="fo-btn big" data-title="load" ${saves.length ? '' : 'disabled'}>Load</button>
          <button class="fo-btn big" data-title="help">How to play</button>
          <button class="fo-btn big" data-title="join">Join a game</button>
          <button class="fo-btn alt" data-title="look">Customize your engineer</button>
          <button class="fo-btn alt" data-title="exit">Back to the cabin</button>
        </div>`;
        break;
      case 'new':
        body = `<h2>New factory</h2>
        <div class="fo-swrow"><label>Name</label><input class="fo-world" maxlength="30" value="Factory ${saves.length + 1}"></div>
        <div class="fo-swrow"><label>Mode</label>
          <button class="fo-chip ${newAdvanced ? '' : 'on'}" data-mode="0">Normal</button><button class="fo-chip ${newAdvanced ? 'on' : ''}" data-mode="1">Advanced</button></div>
        <p class="fo-note fo-modenote">${modeNote()}</p>
        <div class="fo-swrow"><label>Bugs</label>
          <button class="fo-chip ${newBugs ? 'on' : ''}" data-bugs="1">On</button><button class="fo-chip ${newBugs ? '' : 'on'}" data-bugs="0">Peaceful</button></div>
        <p class="fo-note">With bugs on, Calvin, Archie, Mom, Dad and Roger attack once your factory starts polluting.</p>
        <div class="fo-row"><button class="fo-btn" data-title="start">Start</button><button class="fo-btn alt" data-title="main">Back</button></div>`;
        break;
      case 'load':
        body = `<h2>Load a factory</h2><div class="fo-saves">${
          saves.length
            ? saves.map((s) => `<div class="fo-save"><div><b>${esc(s.name)}</b><span>${ago(s.saved)} · ${s.advanced ? 'advanced · ' : ''}${s.enemies ? 'bugs on' : 'peaceful'}</span></div>
              <button class="fo-btn" data-load="${s.id}">Load</button><button class="fo-btn alt" data-del="${s.id}">Delete</button></div>`).join('')
            : '<p class="fo-note">No saved factories yet.</p>'
        }</div><button class="fo-btn alt" data-title="main">Back</button>`;
        break;
      case 'join':
        body = `<h2>Join a game</h2><p class="fo-note">Games other players have opened to join. Ask a friend to press Esc and choose "Open to join".</p>
        <div class="fo-saves">${
          hostList === null
            ? '<p class="fo-note">Looking for games…</p>'
            : hostList.length
              ? hostList.map((h) => `<div class="fo-save"><div><b>${esc(h.world)}</b><span>Hosted by ${esc(h.name)} · ${h.players} playing · ${ago(h.updated)}</span></div>
                <button class="fo-btn" data-join="${h.id}">Join</button></div>`).join('')
              : '<p class="fo-note">Nobody is hosting right now.</p>'
        }</div>${joinStatus ? `<p class="fo-status">${esc(joinStatus)}</p>` : ''}
        <div class="fo-row"><button class="fo-btn" data-title="refresh">Refresh</button><button class="fo-btn alt" data-title="main">Back</button></div>`;
        break;
      case 'help':
        body = helpHtml().replace('data-act="close"', 'data-title="main"');
        break;
      case 'look':
        body = lookHtml('main');
        break;
    }
    titleEl.innerHTML = `<div class="fo-tcard t-${titleView}">${body}</div>`;
    drawLookPreview();
  }

  let newBugs = true;
  let newAdvanced = false;
  const modeNote = () => newAdvanced
    ? 'Advanced: real recipe costs, pipes, oil, steam power, rockets and a space platform. You start next to every ore. Bugs live twice as far away and only come when your pollution reaches them.'
    : 'Normal: the classic Factori-owen.';
  titleEl.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fo-name')) {
      profile.name = t.value.trim() || 'Engineer';
      writeJSON(PROFILE_KEY, profile);
    }
  });
  titleEl.addEventListener('click', (e) => void titleClick(e));
  async function titleClick(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    sfx.click();
    if (t.dataset.look) return setLook(t);
    if (t.dataset.bugs) {
      newBugs = t.dataset.bugs === '1';
      titleEl.querySelectorAll('[data-bugs]').forEach((b) => b.classList.toggle('on', b === t));
      return;
    }
    if (t.dataset.mode) {
      newAdvanced = t.dataset.mode === '1';
      titleEl.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b === t));
      titleEl.querySelector('.fo-modenote')!.textContent = modeNote();
      return;
    }
    if (t.dataset.load) {
      const meta = listSaves().find((s) => s.id === t.dataset.load);
      const data = meta && readJSON<unknown>(slotKey(meta.id), null);
      if (!meta || !data) return;
      try {
        startGame(Game.load(data), meta);
      } catch (err) {
        console.error(err);
        joinStatus = 'That save could not be loaded.';
      }
      return;
    }
    if (t.dataset.del) {
      const id = t.dataset.del;
      if (t.dataset.sure !== '1') {
        t.dataset.sure = '1';
        t.textContent = 'Really?';
        return;
      }
      localStorage.removeItem(slotKey(id));
      writeJSON(INDEX_KEY, listSaves().filter((s) => s.id !== id));
      renderTitle();
      return;
    }
    if (t.dataset.join) return void join(t.dataset.join);
    const v = t.dataset.title;
    if (!v) return;
    if (v === 'exit') return exit();
    if (v === 'start') {
      const name = (titleEl.querySelector<HTMLInputElement>('.fo-world')?.value || 'My factory').trim();
      const meta: SaveMeta = { id: Date.now().toString(36), name, saved: Date.now(), enemies: newBugs, advanced: newAdvanced };
      startGame(Game.fresh(Math.floor(Math.random() * 1e9), newBugs, newAdvanced), meta);
      ui.panel = 'help';
      return;
    }
    if (v === 'refresh' || v === 'join') {
      titleView = 'join';
      hostList = null;
      joinStatus = '';
      renderTitle();
      try {
        const { listHosts } = await import('./net');
        hostList = await listHosts();
      } catch (err) {
        console.warn(err);
        hostList = [];
        joinStatus = 'Could not reach the game list. Check your connection and try again.';
      }
      if (mode === 'title' && titleView === 'join') renderTitle();
      return;
    }
    titleView = v as TitleView;
    renderTitle();
  }

  function setLook(t: HTMLElement) {
    const k = t.dataset.look as keyof PlayerLook;
    const v = t.dataset.v!;
    (profile.look as unknown as Record<string, string | number>)[k] = k === 'hairStyle' ? Number(v) : v;
    writeJSON(PROFILE_KEY, profile);
    renderer.look = profile.look;
    t.parentElement!.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
  }

  async function join(id: string) {
    joinStatus = 'Connecting…';
    renderTitle();
    try {
      const { GuestSession } = await import('./mp');
      const gs = new GuestSession();
      gs.onWorld = (g) => {
        guest = gs;
        startGame(g, null);
        game.toast('Joined! Your inventory is your own; the factory is shared.', 5);
      };
      gs.onLost = () => {
        if (guest === gs) {
          guest = null;
          void quitToTitle().then(() => {
            titleView = 'join';
            joinStatus = 'Disconnected from the host.';
            renderTitle();
          });
        }
      };
      await gs.join(id, profile);
      joinStatus = 'Connected, loading the world…';
      renderTitle();
    } catch (err) {
      console.warn(err);
      joinStatus = err instanceof Error ? err.message : 'Could not connect.';
      renderTitle();
    }
  }

  // ---------- in-game menu ----------
  function menuHtml(): string {
    if (menuView === 'look') return lookHtml('menu');
    if (menuView === 'load') {
      const saves = listSaves();
      return `<h3>Load a factory</h3><div class="fo-saves">${saves
        .map((s) => `<div class="fo-save"><div><b>${esc(s.name)}</b><span>${ago(s.saved)}${slot?.id === s.id ? ' · playing now' : ''}</span></div><button class="fo-btn" data-act="mload" data-id="${s.id}">Load</button></div>`)
        .join('') || '<p class="fo-note">No saves.</p>'}</div><button class="fo-btn alt" data-act="mback">Back</button>`;
    }
    if (guest)
      return `<h3>Factori-owen</h3><div class="fo-menu">
        <button class="fo-btn" data-act="close">Resume</button>
        <button class="fo-btn" data-act="help">How to play</button>
        <button class="fo-btn" data-act="mlook">Customize your engineer</button>
        <button class="fo-btn" data-act="quit">Leave the game</button>
      </div><p class="fo-note">You're playing in someone else's factory. They save it.</p>`;
    return `<h3>${esc(slot?.name ?? 'Factori-owen')}</h3><div class="fo-menu">
      <button class="fo-btn" data-act="close">Resume</button>
      <button class="fo-btn" data-act="save">Save</button>
      <button class="fo-btn" data-act="mloadview">Load</button>
      <button class="fo-btn" data-act="host">${host ? 'Open to join: on' : 'Open to join'}</button>
      <button class="fo-btn" data-act="help">How to play</button>
      <button class="fo-btn" data-act="mlook">Customize your engineer</button>
      <button class="fo-btn" data-act="quit">Quit and save</button>
    </div><p class="fo-note">${host ? esc(host.status) : 'The game also saves itself every 30 seconds.'}</p>`;
  }

  function menuAction(a: string, el: HTMLElement): boolean {
    switch (a) {
      case 'save':
        if (save()) game.toast('Saved');
        ui.panel = null;
        return true;
      case 'mloadview': menuView = 'load'; return true;
      case 'mback': menuView = 'menu'; return true;
      case 'mlook': menuView = 'look'; return true;
      case 'mload': {
        save();
        const meta = listSaves().find((s) => s.id === el.dataset.id);
        const data = meta && readJSON<unknown>(slotKey(meta.id), null);
        if (meta && data) {
          void (host?.close());
          host = null;
          startGame(Game.load(data), meta);
        }
        return true;
      }
      case 'host':
        if (!host) void openToJoin();
        return true;
      case 'quit':
        void quitToTitle();
        return false;
    }
    return false;
  }

  async function openToJoin() {
    try {
      const { HostSession } = await import('./mp');
      const h = new HostSession(() => game, () => profile);
      host = h;
      panelDirty = true;
      await h.open(slot?.name ?? 'A factory');
      game.toast('Your game is open: friends can join from the title screen', 5);
    } catch (err) {
      console.warn(err);
      host = null;
      game.toast('Could not open the game to others. Check your connection.', 5);
    }
    panelDirty = true;
  }

  panelEl.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-look]');
    if (t) setLook(t);
  });
  panelEl.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fo-name')) {
      profile.name = t.value.trim() || 'Engineer';
      writeJSON(PROFILE_KEY, profile);
    }
  });

  // ---------- input state ----------
  const keys = new Set<string>();
  let mouseX = 0, mouseY = 0, mouseIn = false;
  let leftDown = false, rightDown = false;
  let cursorDir: Dir = 0;
  let lastPlaced = '';
  let mineKey = '';
  let mineProgress = 0;
  let mineTick = 0;
  let shootKey = false, touchShoot = false;
  let stick = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  let touchHold: { id: number; x: number; y: number; t: number; moved: boolean; mining: boolean } | null = null;
  let pinch: { d: number; z: number } | null = null;
  const touches = new Map<number, [number, number]>();
  let touchMineBtn = false;

  const hoverTile = (): [number, number] | null => {
    if (!mouseIn || mode !== 'game') return null;
    const [wx, wy] = renderer.screenToWorld(mouseX, mouseY);
    const tx = Math.floor(wx), ty = Math.floor(wy);
    return game.world.inside(tx, ty) ? [tx, ty] : null;
  };

  const ghostFor = (item: ItemId | null): Ghost | null => {
    if (!item || !mouseIn || mode !== 'game') return null;
    const type = ITEMS[item].place;
    if (!type) return null;
    const dir = ENTITIES[type].rotatable ? cursorDir : 0;
    const [w, h] = footprint(type, dir);
    const [wx, wy] = renderer.screenToWorld(mouseX, mouseY);
    const x = Math.floor(wx - w / 2 + 0.5), y = Math.floor(wy - h / 2 + 0.5);
    const inReach = Math.hypot(x + w / 2 - game.px, y + h / 2 - game.py) <= reach();
    return { type, x, y, dir: cursorDir, ok: inReach && game.inv.count(item) > 0 && game.canPlace(type, x, y, dir) };
  };

  let lastWhy = 0;
  function tryPlace() {
    const item = ui.cursor;
    const gh = ghostFor(item);
    if (!item || !gh || game.playerDead) return;
    const key = `${gh.x},${gh.y}`;
    if (key === lastPlaced) return;
    // dragging over an existing belt turns it
    const existing = game.entAt(gh.x, gh.y);
    if (existing && existing.type === gh.type && existing.def.rotatable && existing.dir !== cursorDir && existing.w === 1 && existing.h === 1) {
      act.rotate(existing, cursorDir);
      lastPlaced = key;
      return;
    }
    if (!gh.ok) {
      if (game.inv.count(item) <= 0) ui.cursor = null;
      else if (game.placeWhy && performance.now() - lastWhy > 1500) {
        lastWhy = performance.now();
        game.toast(game.placeWhy);
      }
      return;
    }
    if (act.place(gh.type, gh.x, gh.y, gh.dir, item)) {
      lastPlaced = key;
      sfx.place();
      if (game.inv.count(item) <= 0) ui.cursor = null;
    }
  }

  function openEntity(e: Entity) {
    if (Math.hypot(e.cx - game.px, e.cy - game.py) > reach()) {
      game.toast('Too far away');
      sfx.error();
      return;
    }
    ui.entity = e;
    ui.panel = 'entity';
    ui.pickRecipe = false;
    sfx.click();
  }

  /** P: scoop up whatever is on the belt under the mouse. Hold P and sweep to grab more. */
  let pickKey = false;
  function pickFromBelt() {
    const t = hoverTile();
    const e = t ? game.entAt(t[0], t[1]) : null;
    if (!e || e.def.kind !== 'belt' || !e.items.length) return;
    if (Math.hypot(e.cx - game.px, e.cy - game.py) > reach()) {
      if (frame % 30 === 0) game.toast('Walk closer to pick that up');
      return;
    }
    act.take(e, 'belt');
    sfx.pickup();
  }

  const reach = () => BUILD_REACH + reachBonus(game);

  /** G: throw a grenade at the mouse (on a phone, at the nearest bug). */
  let lastThrow = 0;
  function throwG() {
    if (game.playerDead || performance.now() - lastThrow < 500) return;
    if (game.inv.count('grenade') <= 0) {
      game.toast(game.researched.has('grenades') ? 'No grenades: craft some (E, Military tab)' : 'Research Grenades first');
      return;
    }
    let tx: number, ty: number;
    if (touchMode) {
      const b = game.cs.bugs.reduce<{ x: number; y: number } | null>((m, q) => (Math.hypot(q.x - game.px, q.y - game.py) < (m ? Math.hypot(m.x - game.px, m.y - game.py) : 14) ? q : m), null);
      tx = b ? b.x : game.px + [0, 6, 0, -6][game.pdir];
      ty = b ? b.y : game.py + [-6, 0, 6, 0][game.pdir];
    } else [tx, ty] = renderer.screenToWorld(mouseX, mouseY);
    lastThrow = performance.now();
    game.inv.remove('grenade', 1);
    throwGrenade(game, game.px, game.py, tx, ty);
    game.onFire?.('grenade', { x: tx, y: ty });
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
      } else game.toast(`No ${ITEMS[item].name.toLowerCase()} in your inventory`);
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
      act.rotate(e);
      sfx.rotate();
    }
  }

  function togglePanel(p: UIState['panel']) {
    ui.panel = ui.panel === p ? null : p;
    menuView = 'menu';
    panelDirty = true;
  }

  function onKey(ev: KeyboardEvent, down: boolean) {
    if (!wrap.isConnected || mode !== 'game') return;
    if ((ev.target as HTMLElement).tagName === 'INPUT') return;
    const k = ev.key.toLowerCase();
    if (down) {
      if (k === 'e') togglePanel('inventory');
      else if (k === 't') togglePanel('research');
      else if (k === 'escape') {
        if (!bigMapEl.hidden) toggleBigMap(false);
        else if (ui.panel) ui.panel = null;
        else if (ui.cursor) ui.cursor = null;
        else {
          ui.panel = 'menu';
          menuView = 'menu';
        }
        panelDirty = true;
      } else if (k === 'r') rotate();
      else if (k === 'q') pipette();
      else if (k === 'm') toggleMute();
      else if (k === 'n') toggleBigMap();
      else if (k === 'p') pickKey = true;
      else if (k === 'g') throwG();
      else if (k === 'x') switchWeapon();
      else if (/^[0-9]$/.test(k)) selectHot((Number(k) + 9) % 10);
    }
    if (k === 'p' && !down) pickKey = false;
    if (k === ' ' || k === 'c') {
      shootKey = down;
      ev.preventDefault();
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
    leftDown = rightDown = shootKey = false;
  };
  window.addEventListener('blur', blur);

  function switchWeapon() {
    const w = cycleWeapon(game);
    game.toast(w ? `${WEAPONS[w].name}` : 'No weapons with ammo');
    sfx.click();
    lastHud = '';
  }

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
    if (mode !== 'game') return;
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
    } else if (e.button === 2) rightDown = true;
  });
  function onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch') return onTouchEnd(e);
    if (e.button === 0) leftDown = false;
    if (e.button === 2) rightDown = false;
  }
  window.addEventListener('pointerup', onPointerUp);
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
      if (mode === 'game') renderer.zoom = Math.max(10, Math.min(96, renderer.zoom * (e.deltaY > 0 ? 0.88 : 1.14)));
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
      if (t === 'mine') touchMineBtn = true;
      if (t === 'shoot') touchShoot = true;
      if (t === 'grenade') throwG();
      if (t === 'mine' || t === 'shoot') b.classList.add('on');
    });
    const up = () => {
      if (b.dataset.t === 'mine') touchMineBtn = false;
      if (b.dataset.t === 'shoot') touchShoot = false;
      b.classList.remove('on');
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
      renderer.zoom = Math.max(10, Math.min(96, pinch.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)));
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
      leftDown = rightDown = false;
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
      if (k === 'space') {
        ui.silo = null;
        togglePanel('space');
      }
      if (k === 'mute') toggleMute();
    }),
  );
  panelEl.addEventListener('contextmenu', (e) => e.preventDefault());
  panelEl.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-look]') || t.tagName === 'INPUT') return;
    if (panelAction(ui, t, e.button, e.shiftKey)) {
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
  let miningOverlay: Overlay['mining'] = null;

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
    game.shooting = shootKey || touchShoot;
    game.aim = null;

    if (touchHold && !touchHold.moved && !ui.cursor && performance.now() - touchHold.t > 350) touchHold.mining = true;
    const mining = !game.playerDead && (rightDown || (touchHold?.mining ?? false) || touchMineBtn);
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
          if (Math.hypot(e.cx - game.px, e.cy - game.py) <= reach())
            target = {
              key: 'e' + e.id, time: e.def.mineTime, x: e.x, y: e.y, w: e.w, h: e.h,
              done: () => {
                act.remove(e);
                if (ui.entity === e) ui.panel = null;
                sfx.pickup();
              },
            };
        } else if (Math.hypot(tx + 0.5 - game.px, ty + 0.5 - game.py) <= MINE_REACH && (w.tree[i] || (w.res[i] && w.res[i] !== Res.Oil))) {
          const tree = !!w.tree[i];
          target = {
            key: (tree ? 't' : 'r') + i, time: tree ? 1.2 : 1 / drillSpeed(game), x: tx, y: ty, w: 1, h: 1,
            done: () => {
              act.mine(tx, ty);
              sfx.pickup();
            },
          };
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
        if (game.entAt(x, y) || !((w.res[i] && w.res[i] !== Res.Oil) || w.tree[i])) continue;
        const d = Math.hypot(x + 0.5 - game.px, y + 0.5 - game.py);
        if (d < bd && d <= MINE_REACH) {
          bd = d;
          best = [x, y];
        }
      }
    return best;
  }

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
  let lookFrame = 0;

  const resize = () => renderer.resize();
  window.addEventListener('resize', resize);
  resize();

  function handleEvents() {
    for (const ev of game.events) {
      if (mode === 'title') continue;
      if (ev === 'research') {
        sfx.research();
        panelDirty = true;
      }
      if (ev === 'craft') sfx.craft();
      if (ev === 'shot') sfx.shot();
      if (ev === 'turret' && Math.random() < 0.5) sfx.shot();
      if (ev === 'rail') sfx.rail();
      if (ev === 'reload') sfx.reload();
      if (ev === 'laser') sfx.laser();
      if (ev === 'hurt') sfx.hurt();
      if (ev === 'attack') sfx.alarm();
      if (ev === 'nest') sfx.boom();
      if (ev === 'destroyed') sfx.boom();
      if (ev === 'died') sfx.error();
      if (ev === 'launch') sfx.launch();
      if (ev === 'flame' && frame % 4 === 0) sfx.flame();
      if (ev === 'rocket') sfx.rocket();
      if (ev === 'catch') sfx.catch();
      if (ev === 'win') {
        sfx.win();
        winEl.hidden = false;
      }
    }
    game.events.length = 0;
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    frame++;
    if (mode === 'title') {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / TPS && steps < 4) {
        const cam = scene.script(sceneT);
        sceneT += 1 / TPS;
        game.step();
        renderer.camX += (cam.x - renderer.camX) * 0.05;
        renderer.camY += (cam.y - renderer.camY) * 0.05;
        renderer.zoom = cam.zoom;
        acc -= 1 / TPS;
        steps++;
      }
      if (steps === 4) acc = 0;
      game.events.length = 0;
      renderer.draw(game, { hoverTile: null, hoverEnt: null, ghost: null, mining: null, showPower: false, reachOk: false }, now / 1000);
      if (sceneT >= SCENE_SECONDS) newScene();
      if (++lookFrame % 2 === 0) drawLookPreview();
      return;
    }

    const paused = !guest && !host?.guests.size && (ui.panel === 'menu' || ui.panel === 'help');
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / TPS && steps < 8) {
        playerTick();
        game.step();
        host?.tick();
        guest?.tick();
        acc -= 1 / TPS;
        steps++;
      }
      if (steps === 8) acc = 0;
    }
    handleEvents();
    renderer.others = guest ? guest.others : host ? host.views() : [];
    if (ui.panel === 'space') {
      const cv = panelEl.querySelector<HTMLCanvasElement>('.fo-spacecv');
      if (cv) drawSpace(cv, game, now / 1000);
    }
    if (pickKey && frame % 3 === 0) pickFromBelt();
    explore(game, game.px, game.py);
    minimap.draw(game, renderer.others, frame, !bigMapEl.hidden);

    renderer.camX += (game.px - renderer.camX) * Math.min(1, dt * 10);
    renderer.camY += (game.py - renderer.camY) * Math.min(1, dt * 10);
    renderer.camX = Math.max(0, Math.min(WORLD, renderer.camX));
    renderer.camY = Math.max(0, Math.min(WORLD, renderer.camY));

    const ht = hoverTile();
    const ghost = ghostFor(ui.cursor);
    const hoverEnt = ht ? game.entAt(ht[0], ht[1]) : null;
    const cdef = ui.cursor ? ENTITIES[ITEMS[ui.cursor].place!] : null;
    renderer.draw(game, {
      hoverTile: ht,
      hoverEnt,
      ghost,
      mining: miningOverlay,
      showPower: cdef?.kind === 'pole' || !!cdef?.electric || hoverEnt?.def.kind === 'pole',
      reachOk: !!hoverEnt && Math.hypot(hoverEnt.cx - game.px, hoverEnt.cy - game.py) <= reach(),
    }, now / 1000);

    if (ui.panel === 'entity' && ui.entity && !game.ents.has(ui.entity.id)) {
      // the guest's snapshot may have swapped the object; find it again by position
      const again = game.entAt(ui.entity.x, ui.entity.y);
      if (again && again.type === ui.entity.type) ui.entity = again;
      else ui.panel = null;
    }
    if (ui.panel === 'entity' && ui.entity && Math.hypot(ui.entity.cx - game.px, ui.entity.cy - game.py) > reach() + 2) ui.panel = null;
    const live = ui.panel && ui.panel !== 'menu' && ui.panel !== 'help';
    if (panelDirty || (live && frame % 12 === 0)) {
      renderPanel(panelEl, ui);
      if (ui.panel === 'menu' && menuView === 'look') drawLookPreview();
      panelDirty = false;
    } else if (ui.panel === 'menu' && menuView === 'look' && frame % 2 === 0) drawLookPreview();
    if (frame % 6 === 0) hudTick(ht, hoverEnt);
    if (now - lastSave > 30000) {
      lastSave = now;
      save();
    }
  }

  function hudTick(ht: [number, number] | null, hoverEnt: Entity | null) {
    refreshHotbar();
    if (ui.cursor && game.inv.count(ui.cursor) <= 0) ui.cursor = null;
    const hudKey = JSON.stringify([ui.hotbar, ui.cursor, game.inv.toJSON()]);
    if (hudKey !== lastHud) {
      lastHud = hudKey;
      renderHotbar(hotbarEl, ui);
    }
    renderQueue(queueEl, game);
    renderResearchMini(researchEl, game);
    toastsEl.innerHTML = game.toasts.map((t) => `<div>${esc(t.text)}</div>`).join('');
    handEl.innerHTML = ui.cursor
      ? `<img src="${iconURL(ui.cursor)}" alt=""><span>${ITEMS[ui.cursor].name} × ${game.inv.count(ui.cursor)}</span><em>${
          touchMode ? 'Tap to build · Turn rotates · Hand to put away' : 'R rotate · Q put away'
        }</em>`
      : hoverInfo(ht, hoverEnt);
    handEl.hidden = !handEl.innerHTML;
    hpEl.style.width = `${Math.max(0, game.cs.playerHp / game.maxHp()) * 100}%`;
    hpEl.parentElement!.classList.toggle('low', game.cs.playerHp < game.maxHp() * 0.35);
    const smax = shieldMax(game.suit);
    shEl.parentElement!.hidden = !smax;
    if (smax) shEl.style.width = `${(game.suit.shield / smax) * 100}%`;
    gBtn.hidden = !game.inv.count('grenade');
    spaceBtn.hidden = !game.space.built;
    const wk = playerWeapon(game);
    const mag = game.cs.pierce ? 'piercing-ammo' : 'owen-ammo';
    const mags = game.inv.count('owen-ammo') + game.inv.count('piercing-ammo');
    weaponEl.innerHTML = wk === 'rail'
      ? `<img src="${iconURL('rail-gun')}" alt="">${game.inv.count('rail-ammo')}`
      : wk === 'rocket'
        ? `<img src="${iconURL('rocket-launcher')}" alt="">${game.inv.count('rocket')}`
        : wk === 'flame'
          ? `<img src="${iconURL('flamethrower')}" alt="">${game.cs.flameShots}<span class="fo-sub">+${game.inv.count('flame-ammo')}</span>`
          : wk === 'pistol' || wk === 'sniper'
            ? `<img src="${iconURL(wk === 'sniper' ? 'sniper' : mag)}" alt="">${game.cs.reload > 0 ? '<em>Reloading…</em>' : `${game.pistolRounds}/${MAG_SIZE}`}<span class="fo-sub">+${mags}</span>`
            : `<span class="fo-sub">No ammo</span>`;
    weaponEl.title = wk ? `${WEAPONS[wk].name}: hold Space to shoot${game.advanced ? ' · X or click to switch' : ''}` : 'Craft Owen bullets';
    deadEl.hidden = !game.playerDead;
    if (game.playerDead) deadEl.innerHTML = `<h2>${esc(game.killedBy || 'A bug')} got you!</h2><p>Waking up back at the start…</p>`;
    mpEl.hidden = !host && !guest;
    if (host) mpEl.textContent = `Open to join · ${host.guests.size + 1} playing`;
    if (guest) mpEl.textContent = `Playing online`;
    const goals = goalsFor(game);
    const gk = (game.advanced ? 'a' : '') + goals.map((g) => (g.done(game) ? 1 : 0)).join('');
    if (gk !== lastGoals) {
      lastGoals = gk;
      const next = goals.findIndex((g) => !g.done(game));
      goalsEl.innerHTML = `<h4>Goals</h4>${goals.map(
        (g, i) => `<div class="${g.done(game) ? 'done' : i === next ? 'next' : ''}">${g.done(game) ? '✓' : '○'} ${g.text}</div>`,
      ).join('')}`;
    }
  }

  function hoverInfo(ht: [number, number] | null, e: Entity | null): string {
    if (touchMode) return '';
    if (e) return `<span>${ITEMS[e.def.item].name}</span><em>${e.status || ''} · click to open · right-click to pick up</em>`;
    if (!ht) return '';
    const w = game.world;
    const i = w.idx(ht[0], ht[1]);
    const far = Math.hypot(ht[0] + 0.5 - game.px, ht[1] + 0.5 - game.py) > MINE_REACH ? ' (walk closer)' : '';
    if (w.res[i] === Res.Oil) return `<span>Oil patch: ${w.amount[i]}%</span><em>build a pump jack on it</em>`;
    if (w.res[i]) return `<span>${RES_NAME[w.res[i]]}: ${w.amount[i]}</span><em>hold right-click to mine${far}</em>`;
    if (w.tree[i]) return `<span>Tree</span><em>hold right-click to chop${far}</em>`;
    return '';
  }

  const onHide = () => {
    if (document.visibilityState === 'hidden') save();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('beforeunload', save);

  hud.hidden = true;
  renderer.camX = game.px;
  renderer.camY = game.py;
  renderTitle();
  raf = requestAnimationFrame(loop);
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
    void host?.close();
    guest?.close();
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
