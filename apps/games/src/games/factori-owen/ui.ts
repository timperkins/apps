// HTML panels: inventory + crafting, building windows, research, hotbar and HUD.
import { ENTITIES, ITEMS, RECIPES, RECIPE_BY_ID, SCIENCE_PACKS, TECH_ICON, TECHS, TECH_BY_ID, type Category, type ItemId, type Recipe } from './data';
import { iconURL } from './icons';
import { sfx } from './audio';
import type { Entity, Game } from './sim';
import type { Actions } from './actions';
import { ARMORS, capacity, equip, EQUIP, gridSize, isArmor, isEquip, shieldMax, takeOff, unequip, wear } from './armor';

export type PanelMode = null | 'inventory' | 'entity' | 'research' | 'menu' | 'help' | 'load';

export interface UIState {
  game: Game;
  panel: PanelMode;
  entity: Entity | null;
  tab: Category;
  cursor: ItemId | null;
  hotbar: (ItemId | null)[];
  pickRecipe: boolean;
  /** Technology picked in the research tree. */
  techSel?: string | null;
  /** scroll the tree to the picked technology on the next draw */
  techJump?: boolean;
  act: Actions;
  setCursor: (item: ItemId | null) => void;
  /** Esc menu and load screen live in index.ts */
  menuHtml: () => string;
  onMenu: (act: string, el: HTMLElement) => boolean;
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
  ['military', 'Military'],
  ['armor', 'Armor'],
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
      body += `<div class="fo-row">${SCIENCE_PACKS.map((p) => slot(p, e.input[p] ?? 0, `data-act="take-input" data-id="${p}"`)).join('')}</div>`;
      body += t
        ? `<div class="fo-sub">Researching ${esc(t.name)}: ${g.researchUnits[t.id] ?? 0} / ${t.units}</div>${bar((g.researchUnits[t.id] ?? 0) / t.units)}`
        : `<button class="fo-btn" data-act="open-research">Choose research</button>`;
      break;
    }
    case 'drill':
      body += `<div class="fo-row"><label>Mining</label>${bar(e.progress)}${slot(e.output?.item ?? null, e.output?.n ?? 0, 'data-act="take-output"')}</div><p class="fo-note">Drops ore into whatever is in front of the yellow arrow (a furnace, chest or belt). With nothing there it keeps up to 50 inside: click the slot to collect them. Press R while hovering to turn it.</p>`;
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
      if (d.filter) {
        const picks = (Object.keys(ITEMS) as ItemId[])
          .filter((it) => g.produced[it] || g.inv.count(it) || it === e.recipe)
          .map((it) => `<div class="fo-slot recipe ${it === e.recipe ? 'sel' : ''}" data-act="set-recipe" data-id="${it}" data-tip="item:${it}">${icon(it)}</div>`)
          .join('');
        body += `<h4>Only move: ${e.recipe ? esc(ITEMS[e.recipe as ItemId].name) : 'nothing yet'}</h4><div class="fo-grid recipes">${picks || '<span class="fo-sub">Make some items first.</span>'}</div>`;
      }
      if (e.held) body += `<div class="fo-row"><label>Holding</label>${slot(e.held, null)}</div>`;
      break;
    case 'belt':
      body += `<p class="fo-note">${e.items.length} item(s) on this tile.</p>`;
      break;
    case 'turret': {
      const ammo = d.ammo!;
      body += `<div class="fo-row"><label>Ammo</label>${slot(ammo, e.input[ammo] ?? 0, `data-act="take-input" data-id="${ammo}"`, e.input[ammo] ? '' : 'want')}</div>`;
      body += `<p class="fo-note">Range ${d.range} tiles. ${e.type === 'rail-turret' ? 'Needs power to charge each shot. ' : ''}Robo arms can load it too.</p>`;
      break;
    }
    case 'wall':
      body += `<p class="fo-note">Bugs have to chew through walls before they reach your factory.</p>`;
      break;
    case 'pole':
      body += `<p class="fo-note">Powers machines inside the blue square and links to poles up to 7 tiles away. Connected to ${e.wire.length} pole(s).</p>`;
      break;
    case 'monument':
      body += `<p class="fo-note">Owen is proud of you.</p>`;
      break;
    case 'battery':
      body += `<div class="fo-row"><label>Charge</label>${bar(e.burn / d.capacity!, 'power')}<span class="fo-sub">${(e.burn / 1e6).toFixed(1)} of ${d.capacity! / 1e6} MJ</span></div><p class="fo-note">Fills up when your generators and solar panels make more than you use, and helps out when they don't. Place it near a power pole.</p>`;
      break;
    case 'lamp':
      body += `<p class="fo-note">Turns on at night when it has power.</p>`;
      break;
    case 'splitter':
      body += `<p class="fo-note">Point a belt into its back. It hands items out in turn to belts on its left, front and right.</p>`;
      break;
    case 'floor':
      body += `<p class="fo-note">You walk 30% faster on stone paths.</p>`;
      break;
    case 'mine':
      body += `<p class="fo-note">Blows up when a bug walks over it.</p>`;
      break;
  }
  if (d.ug) body += `<p class="fo-note">${e.recipe === 'out' ? 'Exit: items come up here.' : g.ugExit(e) ? 'Entrance: items go under and come up at the exit.' : 'Entrance with no exit yet: place another underground belt facing the same way, up to 4 tiles ahead.'} Press R while hovering to swap entrance and exit.</p>`;
  const accepts = !['belt', 'inserter', 'pole', 'solar', 'monument', 'wall', 'battery', 'lamp', 'splitter', 'floor', 'mine'].includes(d.kind);
  return `<div class="fo-cols">
    <section><h3>${icon(d.item)} ${esc(name)}</h3>${body}</section>
    ${accepts ? `<section><h3>Inventory</h3>${inventoryGrid(g, 'give')}<p class="fo-note">Click an item to put it all in, right-click for half. Same for taking items out.</p></section>` : ''}
  </div>`;
}

interface TreeNode { id: string; depth: number; x: number; y: number }

const NODE_W = 132, NODE_H = 92, COL = 156, ROW = 128, PAD = 16;

/** Lays the technologies out as a tree: each one sits a row below its deepest prerequisite. */
const TREE: { nodes: Record<string, TreeNode>; width: number; height: number } = (() => {
  const depth: Record<string, number> = {};
  const d = (id: string): number =>
    (depth[id] ??= TECH_BY_ID[id].requires.reduce((m, r) => Math.max(m, d(r) + 1), 0));
  TECHS.forEach((t) => d(t.id));
  const rows: string[][] = [];
  for (const t of TECHS) (rows[depth[t.id]] ??= []).push(t.id);
  const pos: Record<string, number> = {};
  const place = () => rows.forEach((r) => r.forEach((id, i) => (pos[id] = i - (r.length - 1) / 2)));
  place();
  const kids = (id: string) => TECHS.filter((t) => t.requires.includes(id)).map((t) => t.id);
  const mean = (ids: string[], fb: number) => (ids.length ? ids.reduce((s, x) => s + pos[x], 0) / ids.length : fb);
  // a few passes of "sit near the things you connect to" to untangle the lines
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < rows.length; i++) {
      rows[i].sort((a, b) => mean(TECH_BY_ID[a].requires, pos[a]) - mean(TECH_BY_ID[b].requires, pos[b]));
      place();
    }
    for (let i = rows.length - 2; i >= 0; i--) {
      rows[i].sort((a, b) => mean(kids(a), pos[a]) - mean(kids(b), pos[b]));
      place();
    }
  }
  const widest = Math.max(...rows.map((r) => r.length));
  const width = (widest - 1) * COL + NODE_W + PAD * 2;
  const nodes: Record<string, TreeNode> = {};
  for (const t of TECHS) {
    nodes[t.id] = { id: t.id, depth: depth[t.id], x: width / 2 + pos[t.id] * COL - NODE_W / 2, y: PAD + depth[t.id] * ROW };
  }
  return { nodes, width, height: PAD * 2 + (rows.length - 1) * ROW + NODE_H };
})();

function techState(g: Game, id: string) {
  return g.researched.has(id) ? 'done' : g.research === id ? 'cur' : g.canResearch(id) ? 'can' : 'locked';
}

function armorPanel(g: Game) {
  const s = g.suit;
  if (!s.armor) return `<h3>Armor</h3><div class="fo-row"><div class="fo-slot empty armor"></div><span class="fo-sub">No armor on. Research Owen vest to make your first one.</span></div>`;
  const [W, H] = gridSize(s);
  const C = 30; // cell size in px
  const pieces = s.grid
    .map((p, i) => {
      const d = EQUIP[p.item]!;
      return `<div class="fo-eq" data-act="unequip" data-i="${i}" data-tip="item:${p.item}" style="left:${p.x * C}px;top:${p.y * C}px;width:${d.w * C - 2}px;height:${d.h * C - 2}px;background:${d.color}">${icon(p.item)}</div>`;
    })
    .join('');
  const cells = Array.from({ length: W * H }, () => '<i></i>').join('');
  const a = ARMORS[s.armor]!;
  const max = shieldMax(s);
  return `<h3>Armor</h3>
  <div class="fo-armor">
    <div class="fo-slot armor" data-act="unwear" data-tip="item:${s.armor}">${icon(s.armor)}</div>
    <div>
      <div class="fo-sub">${esc(ITEMS[s.armor].name)} · blocks ${Math.round(a.reduce * 100)}% of damage · ${W}×${H} grid</div>
      <div class="fo-row"><label>Suit power</label>${bar(s.energy / capacity(s), 'power')}<span class="fo-sub">${(s.energy / 1e6).toFixed(1)} MJ</span></div>
      ${max ? `<div class="fo-row"><label>Shield</label>${bar(s.shield / max, "shieldbar")}<span class="fo-sub">${Math.round(s.shield)}/${max}</span></div>` : ''}
    </div>
  </div>
  <div class="fo-pgrid" style="width:${W * C}px;height:${H * C}px;grid-template-columns:repeat(${W},${C}px)">${cells}${pieces}</div>
  <p class="fo-note">Click equipment in your inventory to add it. Click a piece in the grid to take it out, or the armor to take it all off.</p>`;
}

function researchPanel(ui: UIState) {
  const g = ui.game;
  const sel = TECH_BY_ID[ui.techSel ?? ''] ?? TECH_BY_ID[g.research ?? ''] ?? TECHS.find((t) => g.canResearch(t.id)) ?? TECHS[TECHS.length - 1];
  // prerequisite lines
  const lines = TECHS.flatMap((t) =>
    t.requires.map((r) => {
      const a = TREE.nodes[r], b = TREE.nodes[t.id];
      const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
      const my = y2 - 14;
      const st = g.researched.has(r) ? 'done' : 'locked';
      const hot = t.id === sel.id || r === sel.id ? 'hot' : '';
      return `<path class="${st} ${hot}" d="M${x1} ${y1} V${my - 10} Q${x1} ${my} ${x1 + Math.sign(x2 - x1) * Math.min(10, Math.abs(x2 - x1))} ${my} H${
        x2 - Math.sign(x2 - x1) * Math.min(10, Math.abs(x2 - x1))
      } Q${x2} ${my} ${x2} ${my + 10} V${y2}"/>`;
    }),
  ).sort((a, b) => Number(a.includes(' hot"')) - Number(b.includes(' hot"'))).join('');
  const nodes = TECHS.map((t) => {
    const n = TREE.nodes[t.id];
    const st = techState(g, t.id);
    const u = g.researchUnits[t.id] ?? 0;
    return `<div class="fo-tnode ${st} ${t.id === sel.id ? 'sel' : ''}" data-act="tech-sel" data-id="${t.id}" style="left:${n.x}px;top:${n.y}px">
      <div class="fo-tnode-ic">${icon(TECH_ICON[t.id] ?? 'red-pack')}</div>
      <div class="fo-tnode-name">${esc(t.name)}</div>
      <div class="fo-tnode-cost">${t.packs.map((p) => icon(p, 'xs')).join('')}<span>${t.units}</span></div>
      ${st === 'done' ? '<b class="fo-tnode-tick">✓</b>' : u > 0 ? bar(u / t.units) : ''}
    </div>`;
  }).join('');

  const st = techState(g, sel.id);
  const u = g.researchUnits[sel.id] ?? 0;
  const unlocks = RECIPES.filter((r) => r.unlock === sel.id);
  const leadsTo = TECHS.filter((t) => t.requires.includes(sel.id));
  const chip = (id: string) =>
    `<button class="fo-tchip ${techState(g, id)}" data-act="tech-sel" data-id="${id}">${icon(TECH_ICON[id] ?? 'red-pack', 'xs')}${esc(TECH_BY_ID[id].name)}</button>`;
  const detail = `<div class="fo-tdetail ${st}">
    <div class="fo-tdetail-head">${icon(TECH_ICON[sel.id] ?? 'red-pack', 'lg')}<div><h4>${esc(sel.name)}</h4><span class="fo-tstatus">${
      st === 'done' ? 'Researched' : st === 'cur' ? 'Researching' : st === 'can' ? 'Ready to research' : 'Locked'
    }</span></div></div>
    <p>${esc(sel.desc)}</p>
    <h5>Cost</h5>
    <div class="fo-tcost">${sel.packs.map((p) => `<span>${icon(p, 'sm')}${esc(ITEMS[p].name.replace(' science pack', ''))}</span>`).join('')}</div>
    <div class="fo-sub">${sel.units} of each · ${sel.time}s per unit in a lab</div>
    ${st !== 'done' && u > 0 ? `<div class="fo-tprog">${bar(u / sel.units)}<span>${u}/${sel.units}</span></div>` : ''}
    ${unlocks.length ? `<h5>Unlocks</h5><div class="fo-tunl">${unlocks.map((r) => `<span data-tip="item:${r.out}">${icon(r.out, 'sm')}</span>`).join('')}</div>` : ''}
    ${sel.requires.length ? `<h5>Needs</h5><div class="fo-tchips">${sel.requires.map(chip).join('')}</div>` : ''}
    ${leadsTo.length ? `<h5>Leads to</h5><div class="fo-tchips">${leadsTo.map((t) => chip(t.id)).join('')}</div>` : ''}
    ${st === 'can' ? `<button class="fo-btn fo-tgo" data-act="research" data-id="${sel.id}">Research</button>` : ''}
    ${st === 'cur' ? `<div class="fo-note">Put ${sel.packs.map((p) => esc(ITEMS[p].name.toLowerCase())).join(', ')} in a powered lab.</div>` : ''}
    ${st === 'locked' ? `<div class="fo-note">Research the technologies it needs first.</div>` : ''}
  </div>`;
  return `<h3>Research</h3>
  <div class="fo-rtree">
    <div class="fo-tree-wrap"><div class="fo-tree" style="width:${TREE.width}px;height:${TREE.height}px">
      <svg width="${TREE.width}" height="${TREE.height}">${lines}</svg>${nodes}
    </div></div>
    ${detail}
  </div>`;
}

function helpPanel() {
  return `<h3>How to play</h3>
  <div class="fo-help">
  <p><b>Goal:</b> grow a factory from a few plates to a research empire, then build the Great Owen Monument.</p>
  <ul>
    <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · mouse wheel zooms</li>
    <li><b>Hold right-click</b> on ore, rocks or trees to mine them by hand. Right-click a building to pick it up.</li>
    <li><kbd>E</kbd> inventory and crafting · <kbd>T</kbd> research tree · <kbd>N</kbd> map · <kbd>Esc</kbd> menu</li>
    <li>Click an item (or press <kbd>1</kbd>–<kbd>0</kbd>) to hold it, then <b>left-click</b> to build. Drag to lay belts.</li>
    <li><kbd>R</kbd> rotates · <kbd>Q</kbd> picks the building under the mouse, or empties your hand</li>
    <li><kbd>P</kbd> over a belt picks up the items on it (hold P and sweep to grab more)</li>
    <li>In a building's window, click a slot to take everything, or right-click to take half.</li>
    <li>Left-click a building to open it, then click inventory items to load fuel, ore or ingredients.</li>
  </ul>
  <p><b>First steps:</b> put your burner drill on Owen ore and give it wood or coal. Point its yellow arrow at the stone furnace so the ore drops straight in. Add fuel to the furnace too, and Owen plates come out.</p>
  <p><b>Bugs:</b> Calvin, Archie, Mom, Dad and Roger live in nests far from the start. Pollution from your machines makes them angry, and after 10 quiet minutes they come for your factory, at most one wave every 3 minutes. They run almost as fast as you (95%) and chase anyone who comes within 10 tiles. Hold <kbd>Space</kbd> to shoot the closest bug with your gun: each shot plants your feet for a second, and a new magazine of 10 Owen bullets takes 1.45 seconds to load. Build gun turrets and load them with Owen bullets, and research Rail guns for the big stuff.</p>
  <p><b>Science:</b> there are 4 science packs: automation (red), logistic (green), military (grey) and advanced (blue). Press <kbd>T</kbd> to open the research tree, click a technology to see what it needs and unlocks, then feed those packs to powered labs.</p>
  <p><b>Armor:</b> research and craft armor, then click it in your inventory to put it on. There are 5 kinds, each blocking more damage with a bigger personal grid. Fill the grid with equipment: solar panels, batteries and a power core make suit power; the personal laser, energy shield, exo legs and night vision use it. Press <kbd>G</kbd> to throw a grenade at the mouse.</p>
  <p><b>Map:</b> the map in the top right fills in as you explore. Click it or press <kbd>N</kbd> for the whole map.</p>
  <p><b>On a phone:</b> use the stick to walk, tap to build or open, press and hold to mine, and hold Shoot to fire.</p>
  </div><button class="fo-btn" data-act="close">Got it</button>`;
}

export function helpHtml() {
  return helpPanel();
}

export function renderPanel(el: HTMLElement, ui: UIState) {
  const g = ui.game;
  let html = '';
  switch (ui.panel) {
    case 'inventory':
      html = `<div class="fo-cols"><section><h3>Inventory <button class="fo-mini" data-act="sort">Sort</button></h3>${inventoryGrid(
        g,
        'hold',
      )}<p class="fo-note">Click a building to hold it. Click armor to wear it, and grid equipment to put it in your armor.</p></section><section><h3>Crafting</h3>${craftingPanel(ui)}${armorPanel(g)}</section></div>`;
      break;
    case 'entity':
      html = entityPanel(ui);
      break;
    case 'research':
      html = researchPanel(ui);
      break;
    case 'menu':
    case 'load':
      html = ui.menuHtml();
      break;
    case 'help':
      html = helpPanel();
      break;
  }
  // keep scroll positions when the panel redraws itself
  const scrolls = [...el.querySelectorAll<HTMLElement>('.fo-tree-wrap, .fo-tdetail')].map((x) => [x.scrollLeft, x.scrollTop]);
  const keep = el.scrollTop;
  el.innerHTML = `<button class="fo-x" data-act="close" aria-label="Close">×</button>${html}`;
  el.querySelectorAll<HTMLElement>('.fo-tree-wrap, .fo-tdetail').forEach((x, i) => {
    if (scrolls[i]) [x.scrollLeft, x.scrollTop] = scrolls[i];
  });
  el.scrollTop = keep;
  const wrap = el.querySelector<HTMLElement>('.fo-tree-wrap');
  const sel = el.querySelector<HTMLElement>('.fo-tnode.sel');
  if (wrap && sel && (!scrolls.length || ui.techJump)) {
    // bring the picked technology into view
    const x = sel.offsetLeft + sel.offsetWidth / 2 - wrap.clientWidth / 2;
    const y = sel.offsetTop + sel.offsetHeight / 2 - wrap.clientHeight / 2;
    if (!scrolls.length || sel.offsetLeft < wrap.scrollLeft || sel.offsetLeft + sel.offsetWidth > wrap.scrollLeft + wrap.clientWidth || sel.offsetTop < wrap.scrollTop || sel.offsetTop + sel.offsetHeight > wrap.scrollTop + wrap.clientHeight) {
      wrap.scrollLeft = x;
      wrap.scrollTop = y;
    }
  }
  ui.techJump = false;
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
  switch (act) {
    case 'close': ui.panel = null; break;
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
    case 'unwear': takeOff(g); break;
    case 'unequip': unequip(g, i); break;
    case 'hold': {
      const s = g.inv.slots[i];
      if (s && isArmor(s.item)) {
        wear(g, s.item);
        sfx.click();
        break;
      }
      if (s && isEquip(s.item)) {
        if (!g.suit.armor) g.toast('Put on some armor first');
        else if (!equip(g, s.item)) g.toast('No room in your armor grid');
        else sfx.click();
        break;
      }
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
      const name = s.item;
      if (ui.act.give(e, i, n)) sfx.click();
      else {
        sfx.error();
        g.toast(`The ${ITEMS[e.def.item].name.toLowerCase()} can't use ${ITEMS[name].name.toLowerCase()}`);
      }
      break;
    }
    case 'take-fuel': if (e) ui.act.take(e, 'fuel', undefined, button === 2); break;
    case 'take-output': if (e) ui.act.take(e, 'output', undefined, button === 2); break;
    case 'take-input': if (e) ui.act.take(e, 'input', id || undefined, button === 2); break;
    case 'take-chest': if (e) ui.act.take(e, 'chest', i, button === 2); break;
    case 'set-recipe':
      if (e) {
        ui.act.setRecipe(e, id);
        ui.pickRecipe = false;
      }
      break;
    case 'change-recipe': ui.pickRecipe = true; break;
    case 'open-research': ui.panel = 'research'; break;
    case 'tech-sel':
      ui.techSel = id;
      ui.techJump = true;
      break;
    case 'research':
      ui.act.research(id);
      sfx.click();
      break;
    case 'help': ui.panel = 'help'; break;
    default: return ui.onMenu(act, el);
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
