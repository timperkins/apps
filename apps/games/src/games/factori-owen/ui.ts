// HTML panels: inventory + crafting, building windows, research, hotbar and HUD.
import { ENTITIES, ITEMS, RECIPES, RECIPE_BY_ID, TECHS, TECH_BY_ID, type Category, type ItemId, type Recipe } from './data';
import { iconURL } from './icons';
import { sfx } from './audio';
import type { Entity, Game } from './sim';

export type PanelMode = null | 'inventory' | 'entity' | 'research' | 'menu' | 'help';

export interface UIState {
  game: Game;
  panel: PanelMode;
  entity: Entity | null;
  tab: Category;
  cursor: ItemId | null;
  hotbar: (ItemId | null)[];
  pickRecipe: boolean;
  confirmNew: boolean;
  onExit: () => void;
  onNewGame: () => void;
  onSave: () => void;
  setCursor: (item: ItemId | null) => void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function fmt(n: number): string {
  if (n >= 10000) return Math.floor(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function icon(item: ItemId, cls = '') {
  return `<img class="fo-ic ${cls}" src="${iconURL(item)}" alt="" draggable="false">`;
}

function slot(item: ItemId | null, n: number | null, attrs = '', extra = '') {
  return `<div class="fo-slot ${item ? '' : 'empty'} ${extra}" ${attrs} ${item ? `data-tip="item:${item}"` : ''}>${
    item ? icon(item) : ''
  }${item && n !== null && n > 0 ? `<b>${fmt(n)}</b>` : ''}</div>`;
}

export function recipeTip(g: Game, r: Recipe): string {
  const ings = r.ing
    .map(([it, n]) => {
      const have = g.inv.count(it);
      return `<div class="fo-ing ${have >= n ? '' : 'short'}">${icon(it)}<span>${n} × ${esc(ITEMS[it].name)}</span><i>${have}</i></div>`;
    })
    .join('');
  const where = r.smelt ? 'Made in a furnace' : r.hand ? `${r.time}s by hand` : 'Made in an assembler';
  return `<h4>${esc(ITEMS[r.out].name)}${r.count > 1 ? ` ×${r.count}` : ''}</h4><div class="fo-sub">${where}</div>${ings}`;
}

export function itemTip(g: Game, item: ItemId): string {
  const d = ITEMS[item];
  const r = RECIPES.find((x) => x.out === item);
  let s = `<h4>${esc(d.name)}</h4>`;
  if (d.desc) s += `<div class="fo-sub">${esc(d.desc)}</div>`;
  if (d.fuel) s += `<div class="fo-sub">Fuel: ${d.fuel / 1e6} MJ</div>`;
  if (d.place) {
    const e = ENTITIES[d.place];
    if (e.power) s += `<div class="fo-sub">${e.electric ? 'Uses' : 'Burns fuel at'} ${e.power / 1000} kW</div>`;
    if (e.output) s += `<div class="fo-sub">Makes up to ${e.output / 1000} kW of power</div>`;
    s += `<div class="fo-sub">Click to hold it, then click the ground to build</div>`;
  }
  s += `<div class="fo-sub">In inventory: ${g.inv.count(item)}</div>`;
  if (r && g.unlocked(r)) s += `<hr>${recipeTip(g, r).replace(/<h4>.*?<\/h4>/, '')}`;
  return s;
}

function bar(p: number, cls = '') {
  return `<div class="fo-bar ${cls}"><i style="width:${Math.max(0, Math.min(1, p)) * 100}%"></i></div>`;
}

// ---------- panels ----------

function inventoryGrid(g: Game, act: string) {
  return `<div class="fo-grid inv">${g.inv.slots
    .map((s, i) => slot(s?.item ?? null, s?.n ?? null, `data-act="${act}" data-i="${i}"`))
    .join('')}</div>`;
}

const TABS: [Category, string][] = [
  ['logistics', 'Logistics'],
  ['production', 'Production'],
  ['intermediate', 'Parts'],
  ['science', 'Science'],
];

function craftingPanel(ui: UIState) {
  const g = ui.game;
  const tabs = TABS.map(
    ([id, label]) => `<button class="fo-tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-id="${id}">${label}</button>`,
  ).join('');
  const recipes = RECIPES.filter((r) => r.hand && g.unlocked(r) && ITEMS[r.out].category === ui.tab);
  const cells = recipes
    .map((r) => {
      const n = g.craftable(r, 99);
      return `<div class="fo-slot recipe ${n ? '' : 'cant'}" data-act="craft" data-id="${r.id}" data-tip="recipe:${r.id}">${icon(r.out)}${
        n ? `<b>${n}</b>` : ''
      }</div>`;
    })
    .join('');
  const smelt = ui.tab === 'intermediate'
    ? `<p class="fo-note">Plates and bricks are smelted in a stone furnace: put ore and fuel in it.</p>`
    : '';
  return `<div class="fo-tabs">${tabs}</div><div class="fo-grid recipes">${cells}</div>${smelt}
  <p class="fo-note">Click to craft 1 · right-click for 5 · shift-click for all</p>`;
}

function entityPanel(ui: UIState): string {
  const g = ui.game;
  const e = ui.entity!;
  const d = e.def;
  const name = ITEMS[d.item].name;
  let body = `<div class="fo-status">${esc(e.status || 'Idle')}</div>`;
  const usesFuel = g.usesFuel(e);
  if (usesFuel) {
    body += `<div class="fo-row"><label>Fuel</label>${slot(e.fuel?.item ?? null, e.fuel?.n ?? 0, 'data-act="take-fuel"')}${bar(
      Math.min(1, e.burn / 4e6),
      'fuel',
    )}</div>`;
  }
  if (d.electric) {
    const ok = e.net >= 0;
    body += `<div class="fo-row"><label>Power</label>${bar(ok ? e.sat : 0, 'power')}<span class="fo-sub">${
      ok ? Math.round(e.sat * 100) + '%' : 'Not connected: place a power pole nearby'
    }</span></div>`;
  }
  switch (d.kind) {
    case 'chest':
      body += `<div class="fo-grid chest">${e.inv!.slots
        .map((s, i) => slot(s?.item ?? null, s?.n ?? null, `data-act="take-chest" data-i="${i}"`))
        .join('')}</div>`;
      break;
    case 'furnace': {
      const inItem = Object.keys(e.input).find((k) => e.input[k as ItemId]) as ItemId | undefined;
      body += `<div class="fo-row machine">${slot(inItem ?? null, inItem ? e.input[inItem]! : 0, 'data-act="take-input"')}
        <div class="fo-arrow">${bar(e.progress)}</div>${slot(e.output?.item ?? null, e.output?.n ?? 0, 'data-act="take-output"')}</div>`;
      break;
    }
    case 'assembler': {
      const r = e.recipe ? RECIPE_BY_ID[e.recipe] : null;
      if (!r || ui.pickRecipe) {
        const opts = RECIPES.filter((x) => !x.smelt && g.unlocked(x))
          .map((x) => `<div class="fo-slot recipe" data-act="set-recipe" data-id="${x.id}" data-tip="recipe:${x.id}">${icon(x.out)}</div>`)
          .join('');
        body += `<h4>Choose what to make</h4><div class="fo-grid recipes">${opts}</div>`;
      } else {
        const ins = r.ing.map(([it, n]) => slot(it, e.input[it] ?? 0, `data-act="take-input" data-id="${it}"`, (e.input[it] ?? 0) >= n ? '' : 'want')).join('');
        body += `<div class="fo-row machine"><div class="fo-ins">${ins}</div><div class="fo-arrow">${bar(e.progress)}</div>${slot(
          e.output?.item ?? r.out,
          e.output?.n ?? 0,
          'data-act="take-output"',
          e.output ? '' : 'ghosty',
        )}</div>
        <button class="fo-btn" data-act="change-recipe">Change recipe</button>
        <p class="fo-note">Making ${esc(ITEMS[r.out].name)}: ${r.ing.map(([it, n]) => `${n} ${esc(ITEMS[it].name)}`).join(', ')}, ${(r.time / (d.speed ?? 1)).toFixed(1)}s each.</p>`;
      }
      break;
    }
    case 'lab': {
      const t = g.research ? TECH_BY_ID[g.research] : null;
      body += `<div class="fo-row">${(['red-pack', 'green-pack'] as ItemId[]).map((p) => slot(p, e.input[p] ?? 0, `data-act="take-input" data-id="${p}"`)).join('')}</div>`;
      body += t
        ? `<div class="fo-sub">Researching ${esc(t.name)}: ${g.researchUnits[t.id] ?? 0} / ${t.units}</div>${bar((g.researchUnits[t.id] ?? 0) / t.units)}`
        : `<button class="fo-btn" data-act="open-research">Choose research</button>`;
      break;
    }
    case 'drill':
      body += `<div class="fo-row"><label>Mining</label>${bar(e.progress)}</div><p class="fo-note">Drops ore in front of the yellow arrow. Press R while hovering to turn it.</p>`;
      break;
    case 'generator':
      body += `<p class="fo-note">Burns fuel to power everything on its pole network. Up to ${(d.output ?? 0) / 1000} kW.</p>`;
      if (e.net >= 0) body += `<div class="fo-sub">Network: using ${Math.round(g.netDemand[e.net] / 1000)} kW of ${Math.round(g.netSupply[e.net] / 1000)} kW</div>`;
      break;
    case 'solar':
      body += `<p class="fo-note">Makes up to 60 kW in daylight, nothing at night.</p>`;
      break;
    case 'inserter':
      body += `<p class="fo-note">Picks items up from the green square and drops them on the orange circle.</p>`;
      if (e.held) body += `<div class="fo-row"><label>Holding</label>${slot(e.held, null)}</div>`;
      break;
    case 'belt':
      body += `<p class="fo-note">${e.items.length} item(s) on this tile.</p>`;
      break;
    case 'pole':
      body += `<p class="fo-note">Powers machines inside the blue square and links to poles up to 7 tiles away. Connected to ${e.wire.length} pole(s).</p>`;
      break;
    case 'monument':
      body += `<p class="fo-note">Owen is proud of you.</p>`;
      break;
  }
  const accepts = d.kind !== 'belt' && d.kind !== 'inserter' && d.kind !== 'pole' && d.kind !== 'solar' && d.kind !== 'monument';
  return `<div class="fo-cols">
    <section><h3>${icon(d.item)} ${esc(name)}</h3>${body}</section>
    ${accepts ? `<section><h3>Inventory</h3>${inventoryGrid(g, 'give')}<p class="fo-note">Click an item to put it in.</p></section>` : ''}
  </div>`;
}

function researchPanel(ui: UIState) {
  const g = ui.game;
  const cards = TECHS.map((t) => {
    const done = g.researched.has(t.id);
    const can = g.canResearch(t.id);
    const cur = g.research === t.id;
    const units = g.researchUnits[t.id] ?? 0;
    const cost = t.packs.map((p) => `${icon(p, 'sm')}`).join('') + ` × ${t.units} · ${t.time}s each`;
    const needs = t.requires.length && !done && !can
      ? `<div class="fo-sub">Needs: ${t.requires.map((r) => esc(TECH_BY_ID[r].name)).join(', ')}</div>`
      : '';
    const unlocks = RECIPES.filter((r) => r.unlock === t.id).map((r) => icon(r.out, 'sm')).join('');
    return `<div class="fo-tech ${done ? 'done' : can ? 'can' : 'locked'} ${cur ? 'cur' : ''}">
      <h4>${esc(t.name)}${done ? ' ✓' : ''}</h4>
      <p>${esc(t.desc)}</p>
      <div class="fo-unl">${unlocks}</div>
      <div class="fo-cost">${cost}</div>
      ${needs}
      ${!done && units > 0 ? bar(units / t.units) : ''}
      ${can && !cur ? `<button class="fo-btn" data-act="research" data-id="${t.id}">Research</button>` : ''}
      ${cur ? `<div class="fo-sub">In progress: put science packs in a powered lab</div>` : ''}
    </div>`;
  }).join('');
  return `<h3>Research</h3><p class="fo-note">Labs need power and science packs. Pick a technology, then feed your labs.</p><div class="fo-techs">${cards}</div>`;
}

function menuPanel(ui: UIState) {
  if (ui.confirmNew)
    return `<h3>Start a new factory?</h3><p class="fo-note">Your current factory will be deleted.</p>
    <div class="fo-menu"><button class="fo-btn danger" data-act="new-yes">Yes, start over</button><button class="fo-btn" data-act="new-no">Keep playing</button></div>`;
  return `<h3>Factori-owen</h3><div class="fo-menu">
    <button class="fo-btn" data-act="close">Resume</button>
    <button class="fo-btn" data-act="help">How to play</button>
    <button class="fo-btn" data-act="save">Save now</button>
    <button class="fo-btn" data-act="new">New game</button>
    <button class="fo-btn" data-act="exit">Back to the cabin</button>
  </div><p class="fo-note">The game saves itself every 30 seconds.</p>`;
}

function helpPanel() {
  return `<h3>How to play</h3>
  <div class="fo-help">
  <p><b>Goal:</b> grow a factory from a few plates to a research empire, then build the Great Owen Monument.</p>
  <ul>
    <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · mouse wheel zooms</li>
    <li><b>Hold right-click</b> on ore, rocks or trees to mine them by hand. Right-click a building to pick it up.</li>
    <li><kbd>E</kbd> inventory and crafting · <kbd>T</kbd> research · <kbd>Esc</kbd> menu</li>
    <li>Click an item (or press <kbd>1</kbd>–<kbd>0</kbd>) to hold it, then <b>left-click</b> to build. Drag to lay belts.</li>
    <li><kbd>R</kbd> rotates · <kbd>Q</kbd> picks the building under the mouse, or empties your hand</li>
    <li>Left-click a building to open it, then click inventory items to load fuel, ore or ingredients.</li>
  </ul>
  <p><b>First steps:</b> put your burner drill on Owen ore and give it wood or coal. Point its yellow arrow at the stone furnace so the ore drops straight in. Add fuel to the furnace too, and Owen plates come out.</p>
  <p><b>On a phone:</b> use the stick to walk, tap to build or open, press and hold to mine.</p>
  </div><button class="fo-btn" data-act="close">Got it</button>`;
}

export function renderPanel(el: HTMLElement, ui: UIState) {
  const g = ui.game;
  let html = '';
  switch (ui.panel) {
    case 'inventory':
      html = `<div class="fo-cols"><section><h3>Inventory <button class="fo-mini" data-act="sort">Sort</button></h3>${inventoryGrid(
        g,
        'hold',
      )}<p class="fo-note">Click a building to hold it.</p></section><section><h3>Crafting</h3>${craftingPanel(ui)}</section></div>`;
      break;
    case 'entity':
      html = entityPanel(ui);
      break;
    case 'research':
      html = researchPanel(ui);
      break;
    case 'menu':
      html = menuPanel(ui);
      break;
    case 'help':
      html = helpPanel();
      break;
  }
  el.innerHTML = `<button class="fo-x" data-act="close" aria-label="Close">×</button>${html}`;
  el.hidden = !ui.panel;
  el.className = `fo-panel p-${ui.panel}`;
}

/** Handles a click inside a panel. Returns true if the panel should re-render. */
export function panelAction(ui: UIState, t: HTMLElement, button: number, shift: boolean): boolean {
  const el = t.closest<HTMLElement>('[data-act]');
  if (!el) return false;
  const g = ui.game;
  const act = el.dataset.act!;
  const id = el.dataset.id ?? '';
  const i = Number(el.dataset.i ?? -1);
  const e = ui.entity;
  const toInv = (item: ItemId, n: number) => {
    const k = g.inv.add(item, n);
    if (k < n) g.toast('Inventory full');
    return k;
  };
  switch (act) {
    case 'close': ui.panel = null; ui.confirmNew = false; break;
    case 'tab': ui.tab = id as Category; break;
    case 'sort': g.inv.sort(); break;
    case 'craft': {
      const r = RECIPE_BY_ID[id];
      const want = shift ? g.craftable(r, 200) : button === 2 ? 5 : 1;
      const n = Math.min(want, g.craftable(r, want));
      if (n > 0 && g.queueCraft(r, n)) sfx.click();
      else {
        sfx.error();
        g.toast(`Missing ingredients for ${ITEMS[r.out].name}`);
      }
      break;
    }
    case 'hold': {
      const s = g.inv.slots[i];
      if (s && ITEMS[s.item].place) {
        ui.setCursor(s.item);
        ui.panel = null;
      }
      break;
    }
    case 'give': {
      const s = g.inv.slots[i];
      if (!s || !e) break;
      const n = button === 2 ? Math.ceil(s.n / 2) : s.n;
      const k = g.insert(e, s.item, n, true);
      if (k > 0) {
        g.inv.slots[i]!.n -= k;
        if (g.inv.slots[i]!.n <= 0) g.inv.slots[i] = null;
        sfx.click();
      } else {
        sfx.error();
        g.toast(`The ${ITEMS[e.def.item].name.toLowerCase()} can't use ${ITEMS[s.item].name.toLowerCase()}`);
      }
      break;
    }
    case 'take-fuel':
      if (e?.fuel) {
        const k = toInv(e.fuel.item, e.fuel.n);
        e.fuel.n -= k;
        if (e.fuel.n <= 0) e.fuel = null;
      }
      break;
    case 'take-output':
      if (e?.output) {
        const k = toInv(e.output.item, e.output.n);
        e.output.n -= k;
        if (e.output.n <= 0) e.output = null;
      }
      break;
    case 'take-input': {
      if (!e) break;
      const item = (id || Object.keys(e.input).find((k) => e.input[k as ItemId])) as ItemId | undefined;
      if (item && e.input[item]) {
        const k = toInv(item, e.input[item]!);
        e.input[item]! -= k;
        if (!e.input[item]) delete e.input[item];
      }
      break;
    }
    case 'take-chest': {
      const s = e?.inv?.slots[i];
      if (s) {
        const k = toInv(s.item, s.n);
        s.n -= k;
        if (s.n <= 0) e!.inv!.slots[i] = null;
      }
      break;
    }
    case 'set-recipe':
      if (e) {
        if (e.recipe !== id) {
          // hand back anything loaded for the old recipe
          for (const [k, v] of Object.entries(e.input)) toInv(k as ItemId, v ?? 0);
          e.input = {};
          if (e.crafting) {
            for (const [it, n] of RECIPE_BY_ID[e.crafting].ing) toInv(it, n);
            e.crafting = null;
            e.progress = 0;
          }
        }
        e.recipe = id;
        ui.pickRecipe = false;
      }
      break;
    case 'change-recipe': ui.pickRecipe = true; break;
    case 'open-research': ui.panel = 'research'; break;
    case 'research':
      g.research = id;
      sfx.click();
      break;
    case 'help': ui.panel = 'help'; break;
    case 'save': ui.onSave(); g.toast('Saved'); ui.panel = null; break;
    case 'new': ui.confirmNew = true; break;
    case 'new-no': ui.confirmNew = false; break;
    case 'new-yes': ui.confirmNew = false; ui.panel = null; ui.onNewGame(); break;
    case 'exit': ui.onExit(); return false;
    default: return false;
  }
  return true;
}

export function renderHotbar(el: HTMLElement, ui: UIState) {
  const g = ui.game;
  el.innerHTML = ui.hotbar
    .map((it, i) => {
      const n = it ? g.inv.count(it) : 0;
      return `<div class="fo-slot hot ${ui.cursor && it === ui.cursor ? 'sel' : ''} ${it && !n ? 'cant' : ''} ${it ? '' : 'empty'}" data-hot="${i}" ${
        it ? `data-tip="item:${it}"` : ''
      }><u>${(i + 1) % 10}</u>${it ? icon(it) : ''}${it && n ? `<b>${fmt(n)}</b>` : ''}</div>`;
    })
    .join('');
}

export function renderQueue(el: HTMLElement, g: Game) {
  el.innerHTML = g.craftQueue
    .slice(0, 8)
    .map((j, i) => {
      const r = RECIPE_BY_ID[j.recipe];
      return `<div class="fo-slot q" data-cancel="${i}" title="Click to cancel">${icon(r.out)}<b>${j.count}</b>${
        i === 0 ? `<s style="height:${g.craftProgress * 100}%"></s>` : ''
      }</div>`;
    })
    .join('');
}

export function renderResearchMini(el: HTMLElement, g: Game) {
  const t = g.research ? TECH_BY_ID[g.research] : null;
  if (!t) {
    const any = TECHS.some((x) => g.canResearch(x.id));
    el.innerHTML = any ? `<span class="fo-sub">No research · press T</span>` : `<span class="fo-sub">Everything researched</span>`;
    return;
  }
  const u = g.researchUnits[t.id] ?? 0;
  el.innerHTML = `<span>${esc(t.name)} ${u}/${t.units}</span>${bar(u / t.units)}`;
}
