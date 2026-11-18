// The UI kit page (/ui/): every piece of the game's interface, on its own and
// in the game, in each design on the table (today's look, Refined Pixel and
// variations on it), which the tabs at the top switch between. Nothing here
// is used by the game yet: it is for choosing a design. Each design is a set of CSS variables and rules in
// kit.css under [data-theme='<id>'], so every component below is the same
// markup in every design.
import './kit.css';
import { COIN_ART, IconName, IconSet, icon, prepareIcons } from './icons';
import { ATTACK_FRAMES, CORNER_FRAMES, CURSORS, CursorKind, HARVEST_FRAMES, MOVE_STEPS, attackRingFrames, harvestRingFrames, initCursors, moveCursor, moveRingFrames } from '../cursors';
import { GROUP_COLORS, PLAYER_COLORS, THEMES, Theme } from './themes';
import { pixelFrame } from './frames';

// Frames and textures some designs draw with (see frames.ts), as CSS variables.
const FRAMES: Record<string, Record<string, string>> = {
  now: {
    '--fr-wood': pixelFrame({ fill: '#2a1e13', line: '#24170b', hi: '#c98a4b', lo: '#6a3f1d', trim: '#9b6232' }),
  },
  pixel: {
    '--fr-panel': pixelFrame({ fill: '#1b2440', line: '#060912', hi: '#36457a', lo: '#111833', trim: '#a8873c' }),
    '--fr-btn': pixelFrame({ fill: '#29345a', line: '#060912', hi: '#4a5b96', lo: '#18203d' }),
    '--fr-hover': pixelFrame({ fill: '#323f6c', line: '#060912', hi: '#5a6cab', lo: '#18203d' }),
    '--fr-on': pixelFrame({ fill: '#3f82d6', line: '#06142a', hi: '#a4ceff', lo: '#24569a' }),
    '--fr-primary': pixelFrame({ fill: '#e0b04a', line: '#2a1a04', hi: '#fff0b0', lo: '#9a6e1c' }),
    '--fr-danger': pixelFrame({ fill: '#b8432f', line: '#2a0a04', hi: '#ff9a80', lo: '#78241a' }),
    '--fr-well': pixelFrame({ fill: '#0d1326', line: '#060912', hi: '#090d1b', lo: '#2a3558' }),
    '--fr-toast': pixelFrame({ fill: '#f2d27a', line: '#2a1a04', hi: '#fff6cc', lo: '#b88a2a' }),
  },
  fine: {
    '--fr-panel': pixelFrame({ fill: '#1b2440', line: '#0a0f1e', hi: '#2f3c68', lo: '#141b33', trim: '#8d7234' }),
    '--fr-btn': pixelFrame({ fill: '#26314f', line: '#0a0f1e', hi: '#3c4a7c', lo: '#1a2240' }),
    '--fr-hover': pixelFrame({ fill: '#2e3a60', line: '#0a0f1e', hi: '#4a5a92', lo: '#1a2240' }),
    '--fr-on': pixelFrame({ fill: '#3a78c8', line: '#0a1a33', hi: '#8fbcf5', lo: '#285a9c' }),
    '--fr-primary': pixelFrame({ fill: '#dcae4c', line: '#2a1a04', hi: '#f8e2a0', lo: '#a37a26' }),
    '--fr-danger': pixelFrame({ fill: '#b0442f', line: '#2a0a04', hi: '#f08a70', lo: '#7a261a' }),
    '--fr-well': pixelFrame({ fill: '#10162b', line: '#0a0f1e', hi: '#0c1122', lo: '#26314f' }),
    '--fr-toast': pixelFrame({ fill: '#f0d488', line: '#2a1a04', hi: '#fff4cc', lo: '#b88f36' }),
  },
  steel: {
    '--fr-panel': pixelFrame({ fill: '#262b33', line: '#0b0d11', hi: '#434b57', lo: '#1a1e24', trim: '#3d6db0' }),
    '--fr-btn': pixelFrame({ fill: '#333a45', line: '#0b0d11', hi: '#56606e', lo: '#22272f' }),
    '--fr-hover': pixelFrame({ fill: '#3c4451', line: '#0b0d11', hi: '#66707f', lo: '#22272f' }),
    '--fr-on': pixelFrame({ fill: '#4f74a8', line: '#0c1626', hi: '#8fb2dc', lo: '#2c446b' }),
    '--fr-primary': pixelFrame({ fill: '#f0b43c', line: '#2a1804', hi: '#ffe39a', lo: '#b07a18' }),
    '--fr-danger': pixelFrame({ fill: '#b8432f', line: '#2a0a04', hi: '#ff9a80', lo: '#78241a' }),
    '--fr-well': pixelFrame({ fill: '#15181d', line: '#0b0d11', hi: '#101318', lo: '#3a414c' }),
    '--fr-toast': pixelFrame({ fill: '#e8edf3', line: '#0b0d11', hi: '#ffffff', lo: '#a9b4c2' }),
  },
  deck: {
    '--fr-panel': pixelFrame({ fill: '#18213b', line: '#060912', hi: '#33416f', lo: '#10172d', trim: '#a8873c' }),
    '--fr-btn': pixelFrame({ fill: '#26314f', line: '#060912', hi: '#46578e', lo: '#18203d' }),
    '--fr-hover': pixelFrame({ fill: '#303c64', line: '#060912', hi: '#5668a6', lo: '#18203d' }),
    '--fr-on': pixelFrame({ fill: '#3f82d6', line: '#06142a', hi: '#a4ceff', lo: '#24569a' }),
    '--fr-primary': pixelFrame({ fill: '#e0b04a', line: '#2a1a04', hi: '#fff0b0', lo: '#9a6e1c' }),
    '--fr-danger': pixelFrame({ fill: '#b8432f', line: '#2a0a04', hi: '#ff9a80', lo: '#78241a' }),
    '--fr-well': pixelFrame({ fill: '#0d1326', line: '#060912', hi: '#090d1b', lo: '#2a3558' }),
    '--fr-toast': pixelFrame({ fill: '#f2d27a', line: '#2a1a04', hi: '#fff6cc', lo: '#b88a2a' }),
  },
  signal: {
    '--fr-panel': pixelFrame({ fill: '#0e1426', line: '#03060d', hi: '#24305a', lo: '#0a0f1d', trim: '#6e5a2a' }),
    '--fr-btn': pixelFrame({ fill: '#18203a', line: '#03060d', hi: '#2f3d6c', lo: '#10162b' }),
    '--fr-hover': pixelFrame({ fill: '#202a4a', line: '#03060d', hi: '#3c4c84', lo: '#10162b' }),
    '--fr-on': pixelFrame({ fill: '#2a1c06', line: '#03060d', hi: '#ffb43c', lo: '#7a4a10' }),
    '--fr-primary': pixelFrame({ fill: '#ffae2e', line: '#2a1804', hi: '#ffe0a0', lo: '#b06a10' }),
    '--fr-danger': pixelFrame({ fill: '#a8392a', line: '#2a0a04', hi: '#ff8a70', lo: '#6e2016' }),
    '--fr-well': pixelFrame({ fill: '#05080f', line: '#03060d', hi: '#04060c', lo: '#1c2440' }),
    '--fr-toast': pixelFrame({ fill: '#120c02', line: '#03060d', hi: '#ffb43c', lo: '#7a4a10' }),
  },
  soft: {
    '--fr-panel': pixelFrame({ fill: '#1a3640', line: '#07141a', hi: '#2f5866', lo: '#122830', trim: '#d9c08a', steps: [5, 3, 2, 1, 1] }),
    '--fr-btn': pixelFrame({ fill: '#24485a', line: '#07141a', hi: '#3e6c80', lo: '#18343f', steps: [5, 3, 2, 1, 1] }),
    '--fr-hover': pixelFrame({ fill: '#2b5468', line: '#07141a', hi: '#4b7c92', lo: '#18343f', steps: [5, 3, 2, 1, 1] }),
    '--fr-on': pixelFrame({ fill: '#f2e3bc', line: '#2a2010', hi: '#ffffff', lo: '#c4b080', steps: [5, 3, 2, 1, 1] }),
    '--fr-primary': pixelFrame({ fill: '#f08a5c', line: '#2a1006', hi: '#ffc8a8', lo: '#b25a30', steps: [5, 3, 2, 1, 1] }),
    '--fr-danger': pixelFrame({ fill: '#c0453a', line: '#2a0a06', hi: '#ff9a8a', lo: '#80261e', steps: [5, 3, 2, 1, 1] }),
    '--fr-well': pixelFrame({ fill: '#0f232b', line: '#07141a', hi: '#0b1b21', lo: '#2a4e5c', steps: [5, 3, 2, 1, 1] }),
    '--fr-toast': pixelFrame({ fill: '#f2e3bc', line: '#2a2010', hi: '#ffffff', lo: '#c4b080', steps: [5, 3, 2, 1, 1] }),
  },
};

const art = import.meta.glob('./art/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const A = (n: string) => art[`./art/${n}`];
const BG = A('bg.webp');
const GLOBE = A('globe.png');

const kit = document.querySelector<HTMLElement>('#kit')!;
const tabsEl = document.querySelector<HTMLElement>('#themeTabs')!;

let T: Theme = THEMES[1];
let IS: IconSet = 'pixel';
const I = (n: IconName, cls?: string) => icon(n, IS, cls);

// ---------- Data ----------

const BUILD_BASE = [
  { k: 'power', n: 'Power plant', c: 300 },
  { k: 'barracks', n: 'Barracks', c: 300 },
  { k: 'refinery', n: 'Ore refinery', c: 1500 },
  { k: 'silo', n: 'Ore silo', c: 150 },
  { k: 'factory', n: 'Vehicle works', c: 2000 },
  { k: 'radar', n: 'Radar mast', c: 1000 },
  { k: 'helipad', n: 'Helipad', c: 1000 },
  { k: 'lab', n: 'Tech lab', c: 1500 },
];
const BUILD_VEH = [
  { k: 'buggy', n: 'Scout buggy', c: 600 },
  { k: 'lancer', n: 'Lancer tank', c: 900 },
  { k: 'hauler', n: 'Ore hauler', c: 1400 },
  { k: 'howler', n: 'Howler artillery', c: 1200 },
  { k: 'bastion', n: 'Bastion tank', c: 1800 },
  { k: 'kestrel', n: 'Kestrel copter', c: 1500 },
];
type ItemState = '' | 'building' | 'ready' | 'paused' | 'blocked' | 'locked';
interface ItemOpts { state?: ItemState; prog?: number; fresh?: boolean; count?: number }

const fmt = (n: number) => n.toLocaleString('en-US');

// ---------- Command Deck: the bigger layout overhaul ----------

// Menu, credits and power in one strip at the top.
function resBar(phone = false) {
  return `<div class="k-resbar s-panel${phone ? ' phone' : ''}"><button class="k-ibtn s-btn sm" aria-label="Menu">${I('menu')}</button><div class="k-res">${coin()}<span class="num">12,450</span>${phone ? '' : '<span class="cap">/ 15,000</span>'}</div><div class="k-res pwr" title="Power">${I('bolt')}<div class="k-hbar"><i style="--p:.72"></i><b style="--u:.55"></b></div>${phone ? '' : '<span class="cap">210 / 290</span>'}</div></div>`;
}

// What you have selected: a big portrait, health, stats and the kinds in it.
function unitCard(compact = false) {
  return `<div class="k-unitcard s-well${compact ? ' compact' : ''}"><div class="por"><img src="${A('c-lancer.webp')}" alt=""><b class="count">×4</b></div><div class="info"><b class="uname">Lancer tank</b><span class="k-label">Group 4 · 6 selected</span><div class="k-hp big hi"><i style="--hp:.8"></i></div>${compact ? '' : `<div class="stats"><span>Armour <b>Heavy</b></span><span>Range <b>5</b></span><span>Speed <b>Med</b></span></div>`}<div class="chips">${utype('lancer', 4, true)}${utype('bastion', 2, true)}${compact ? '' : utype('rifle', 6)}</div></div></div>`;
}

function cmd(icon: IconName, label: string, key: string, cls = '') {
  return `<button class="k-cmd s-btn ${cls}">${I(icon)}<span>${label}</span><kbd>${key}</kbd></button>`;
}

function cmdGrid() {
  return `<div class="k-cmds">${cmd('select', 'Select', 'Q', 'on')}${cmd('all', 'All', '^A')}${cmd('home', 'Home', 'H')}${cmd('group', 'Group', '⇧1')}${cmd('flag', 'Rally', 'R')}${cmd('clear', 'Clear', 'Esc')}</div>`;
}

function consoleDesk() {
  const st: ItemOpts[] = [{ state: 'building', prog: 0.4 }, { state: 'ready' }, {}, { state: 'paused', prog: 0.7 }, { fresh: true }, { state: 'blocked' }];
  return `<div class="k-console s-panel">${unitCard()}${cmdGrid()}<div class="k-console-build">${buildTabs(0)}<div class="k-row">${BUILD_BASE.slice(0, 6)
    .map((x, i) => item(x.k, x.n, x.c, st[i]))
    .join('')}</div></div></div>`;
}

function tabbar(on: 'select' | 'build' | 'home' | '' = '') {
  const t = (k: string, ic: IconName, n: string, alert = false) => `<button class="k-tbtab${on === k ? ' on' : ''}${alert ? ' alert' : ''}">${I(ic)}<span>${n}</span></button>`;
  return `<nav class="k-tabbar s-panel">${t('select', 'select', 'Select')}${t('group', 'group', 'Groups')}${t('home', 'home', 'Home')}${t('build', 'build', 'Build', on !== 'build')}</nav>`;
}

function deckDesk() {
  return `
    <div class="pos tl">${resBar()}</div>
    <div class="pos tc deck">${toast('Lancer tank ready')}</div>
    <div class="pos tr">${mini()}</div>
    <div class="pos console">${consoleDesk()}</div>
    <div class="pos tipat deck">${tip()}</div>`;
}

function deckPhones() {
  return `${phone('Building', -1035, -445, `<div class="pos topbar">${resBar(true)}</div><div class="pos tr low">${mini()}</div><div class="pos tray">${buildPanel('sheet', 0, 6)}</div><div class="pos dock">${tabbar('build')}</div>`)}
      ${phone(
        'Units selected',
        -570,
        -470,
        `<div class="pos topbar">${resBar(true)}</div><div class="pos tr low">${mini()}</div><div class="pos tc lower">${toast('Group 4 · 6 units')}</div><div class="pos conf" style="left:236px;top:400px">${confirmCheck()}</div><div class="pos tray">${unitCard(true)}</div><div class="pos dock">${tabbar('select')}</div>`,
        `${selbox(414, 510, 44, 34, 0.9, GROUP_COLORS[3])}${selbox(452, 744, 40, 30, 0.6, GROUP_COLORS[3])}${moveLine(436, 527, 545, 590)}`,
      )}
      ${phone('Deploying', -330, -505, `<div class="pos topbar">${resBar(true)}</div><div class="pos tr low">${mini()}</div><div class="pos deployat">${deploy()}</div><div class="pos tc lower">${toast('Tap Deploy to set up your base')}</div><div class="pos dock">${tabbar('')}</div>`)}
`;
}

function deckCards() {
  return `<h3 class="pg-h3">Command Deck parts</h3>
    <div class="pg-grid">
      ${card('Console (desktop)', `<div class="pg-console">${consoleDesk()}</div>`, 'Selection, commands and the build row in one panel along the bottom', 'full')}
      ${card('Resource strip', resBar(), 'Menu, credits and power together at the top', 'span2')}
      ${card('Phone tab bar', `<div class="pg-tabbar">${tabbar('select')}</div>`, 'Full width along the bottom of a phone', 'span2')}
      ${card('Selected-unit card', unitCard(), 'Portrait, group, health, stats and the kinds selected', 'span2')}
      ${card('Commands', cmdGrid(), 'Each with its key on a computer', 'span2')}
    </div>`;
}


// ---------- Components (the same markup for every design) ----------

const coin = () => COIN_ART;

function credits(n = 12450, cls = '') {
  return `<div class="k-credits s-panel ${cls}">${coin()}<span class="num">${fmt(n)}</span></div>`;
}

function hudTop(n?: number) {
  return `<div class="k-hudtop"><button class="k-ibtn s-btn" aria-label="Menu">${I('menu')}</button>${credits(n)}</div>`;
}

function mini() {
  return `<div class="k-mini"><div class="k-mini-in"><img src="${GLOBE}" alt=""><i class="view"></i><i class="ping"></i></div><i class="k-mini-rim"></i></div>`;
}

function tool(name: IconName, label: string, on = false, alert = false) {
  return `<button class="k-tool s-btn${on ? ' on' : ''}${alert ? ' alert' : ''}">${I(name)}<span>${label}</span></button>`;
}

function toolbar(on: 'select' | 'build' | '' = '', alert = false) {
  return `<nav class="k-toolbar s-panel">${tool('select', 'Select', on === 'select')}${tool('home', 'Home')}<i class="sep"></i>${tool('build', 'Build', on === 'build', alert)}</nav>`;
}

function item(k: string, n: string, c: number, o: ItemOpts = {}) {
  const st = o.state ?? '';
  const pct = Math.round((o.prog ?? 0) * 100);
  const label = st === 'building' ? `${pct}%` : st === 'ready' ? 'Ready' : st === 'paused' ? 'On hold' : '';
  return `<button class="k-item s-btn${o.fresh ? ' fresh' : ''}" data-state="${st}" style="--prog:${o.prog ?? 0}">
    <span class="pic"><img src="${A(`c-${k}.webp`)}" alt="" loading="lazy"><i class="wipe"></i>${label ? `<b class="state">${label}</b>` : ''}${o.fresh ? '<em class="new">New</em>' : ''}${o.count ? `<b class="count">${o.count}</b>` : ''}</span>
    <span class="label"><span class="name">${n}</span><span class="cost">${coin()}${fmt(c)}</span></span>
  </button>`;
}

function buildTabs(sel = 0, alert = 3) {
  const t = [['base', 'Base'], ['defense', 'Defense'], ['inf', 'Infantry'], ['veh', 'Vehicles']];
  return `<div class="k-tabs" role="tablist">${t
    .map(([k, n], i) => `<button class="k-tab s-btn${i === sel ? ' on' : ''}${i === alert ? ' alert' : ''}" role="tab" aria-selected="${i === sel}" title="${n}"><img src="${A(`t-${k}.png`)}" alt="${n}"></button>`)
    .join('')}</div>`;
}

function power(p = 0.72, u = 0.55, level: 'ok' | 'tight' | 'low' = 'ok') {
  return `<div class="k-pwr s-well" data-level="${level}" role="meter" aria-label="Power"><i class="bolt">${I('bolt')}</i><div class="track"><div class="fill" style="--p:${p}"></div><div class="use" style="--u:${u}"></div></div></div>`;
}

function buildPanel(mode: 'side' | 'sheet', tab = 0, n = 8) {
  const list = tab === 3 ? BUILD_VEH : BUILD_BASE;
  const st: ItemOpts[] =
    tab === 3
      ? [{ state: 'building', prog: 0.4, count: 3 }, { state: '' }, { state: 'paused', prog: 0.65 }, { fresh: true }, { state: 'blocked' }, { state: 'locked' }]
      : [{ state: 'building', prog: 0.4 }, { state: 'ready' }, {}, { state: 'paused', prog: 0.7 }, { fresh: true }, {}, { state: 'blocked' }, {}];
  return `<div class="k-build s-panel mode-${mode}">
    <div class="k-build-head"><div class="k-credits-in s-well">${coin()}<span class="num">12,450</span><span class="cap">/ 15,000</span></div>${mode === 'sheet' ? `<button class="k-ibtn s-btn sm" aria-label="Close">${I('close')}</button>` : ''}</div>
    <div class="k-build-body">${power()}<div class="k-build-main">${buildTabs(tab)}<div class="k-grid">${list
      .slice(0, n)
      .map((x, i) => item(x.k, x.n, x.c, st[i]))
      .join('')}</div></div></div>
  </div>`;
}

const UNITS = ['rifle', 'rocket', 'buggy', 'lancer', 'hauler', 'howler', 'bastion', 'kestrel'];
const UNIT_N: Record<string, string> = { rifle: 'Rifleman', rocket: 'Rocketeer', buggy: 'Scout buggy', lancer: 'Lancer tank', hauler: 'Ore hauler', howler: 'Howler artillery', bastion: 'Bastion tank', kestrel: 'Kestrel copter' };

function utype(k: string, count: number, on = false, part = false) {
  return `<button class="k-utype s-btn${on ? ' on' : ''}${part ? ' part' : ''}" title="${UNIT_N[k]}"><img src="${A(`s-${k}.png`)}" alt="${UNIT_N[k]}"><b class="count">${count}</b></button>`;
}
function grp(color: number, k: string, count: number, on = false) {
  return `<button class="k-grp s-btn${on ? ' on' : ''}" style="--g:${GROUP_COLORS[color]}" title="Group"><img src="${A(`s-${k}.png`)}" alt=""><b class="count">${count}</b></button>`;
}

function selBar(kind: 'full' | 'phone' | 'locked' = 'full') {
  const inner =
    kind === 'locked'
      ? `<button class="k-utype s-btn whole on"><img src="${A('s-lancer.png')}" alt=""><b class="count">9</b></button>`
      : grp(3, 'lancer', 6) + grp(1, 'rifle', 8, kind === 'full') + `<i class="sep"></i>` + utype('lancer', 4, true) + utype('rifle', 6) + utype('bastion', 2, true) + utype('hauler', 1) + (kind === 'full' ? utype('howler', 2) + utype('buggy', 3, false, true) : '');
  return `<div class="k-selbar s-panel"><div class="scroll">${inner}</div><button class="k-act s-btn${kind === 'phone' ? ' open' : ''}" style="--g:${GROUP_COLORS[3]}">${I('group')}<span>Group</span></button><button class="k-act s-btn">${I('clear')}<span>Clear</span></button></div>`;
}

function palette(on = 3) {
  return `<div class="k-palette s-panel" role="group">${GROUP_COLORS.map((c, i) => `<button class="k-swatch${i === on ? ' on' : ''}" style="--g:${c}" aria-label="Group ${i + 1}"><span>${i + 1}</span></button>`).join('')}</div>`;
}

function deploy(disabled = false) {
  return `<button class="k-deploy s-btn primary"${disabled ? ' disabled' : ''}>${I('deploy')}<span>Deploy</span></button>`;
}

// The phone's order check, with the game's own arrowheads (or ore diamond)
// turning round it; the timer below steps through their frames.
function confirmCheck(kind: '' | 'foe' | 'ore' = '') {
  return `<div class="k-confirm ${kind}"><img class="ring" data-ring="${kind || 'move'}" src="${RINGS[kind || 'move'][0]}" alt=""><button class="ok" aria-label="Send them here">${I('check')}</button></div>`;
}

function toast(text: string, kind = '') {
  return `<div class="k-toast ${kind}">${text}</div>`;
}

function banner(win = true) {
  return `<div class="k-banner s-panel ${win ? 'win' : 'lose'}"><div class="eyebrow">${win ? 'Mission complete' : 'Mission failed'}</div><div class="t">${win ? 'Victory' : 'Defeat'}</div><div class="s">${win ? 'Ember has been wiped out · 14:32' : 'Your last building fell · 11:05'}</div><div class="row"><button class="k-btn primary">${I('play')}<span>Play again</span></button><button class="k-btn">${I('users')}<span>Lobby</span></button></div></div>`;
}

function range(label: string, v: number) {
  return `<label class="k-set"><span>${label}<output>${v}</output></span><input class="k-range" type="range" min="0" max="100" step="5" value="${v}" style="--v:${v}%"></label>`;
}

function menu() {
  return `<div class="k-menu s-panel">
    <label class="k-field"><span>Version</span><span class="k-select s-well"><select><option>v2 · Isometric</option><option>v1 · Top-down</option></select></span></label>
    <button class="k-btn">${I('shuffle')}<span>New map</span></button>
    <button class="k-btn">${I('users')}<span>Multiplayer</span></button>
    <button class="k-btn">${I('gear')}<span>Settings</span></button>
    <button class="k-btn">${I('units')}<span>Units &amp; buildings</span></button>
    <button class="k-btn danger">${I('back')}<span>Leave game</span></button>
  </div>`;
}

function settings() {
  return `<div class="k-menu s-panel settings">
    <button class="k-btn ghost back">${I('back')}<span>Settings</span></button>
    ${range('Music', 70)}${range('Sounds', 85)}${range('Voices', 50)}${range('Scroll speed', 40)}${range('Zoom speed', 60)}
    <button class="k-btn">Reset to defaults</button>
  </div>`;
}

function seg(opts: string[], on = 0) {
  return `<div class="k-seg s-well" role="radiogroup">${opts.map((o, i) => `<button role="radio" aria-checked="${i === on}">${o}</button>`).join('')}</div>`;
}

let mapId = 0;
function mapCard(name: string, players: string, blurb: string, seed: number, on = false) {
  return `<button class="k-map s-btn${on ? ' on' : ''}"><canvas class="mapcv" width="96" height="48" data-seed="${seed}" id="mp${mapId++}"></canvas><span class="name">${name}</span><span class="pc">${players}</span><span class="blurb">${blurb}</span></button>`;
}

function picker() {
  return `<div class="k-dialog s-panel">
    <div class="k-dialog-head"><h3 class="k-title">Choose a map</h3><button class="k-btn sm">${I('units')}<span>Units</span></button><button class="k-btn sm">${I('shuffle')}<span>Shuffle</span></button><button class="k-ibtn s-btn sm" aria-label="Close">${I('close')}</button></div>
    <div class="k-stage-row"><span class="k-label">Stage</span>${seg(['Initial', 'Combat'])}<span class="k-hint">The normal start</span></div>
    <div class="k-maps">${mapCard('Lakelands', '2P', 'Lakes everywhere', 3, true)}${mapCard('Highlands', '4P', 'Plateaus and ramps', 11)}${mapCard('Trident', '3P', 'Three prongs of land', 27)}${mapCard('Atoll', '6P', 'A ring of islands', 41)}</div>
    <div class="k-hint legend"><i class="you"></i> You start here · <i class="foe"></i> Enemy base</div>
  </div>`;
}

function lobbyHome() {
  return `<div class="k-dialog s-panel lobby">
    <div class="k-brand">RA</div>
    <label class="k-field"><span class="k-label">Your name</span><input class="k-input s-well" value="Tim" maxlength="16"></label>
    <button class="k-btn primary big">${I('flag')}<span>Host a game</span></button>
    <div class="k-or"><span>or join one</span></div>
    <div class="k-join"><input class="k-input s-well code" placeholder="CODE" value="KXQB" maxlength="4"><button class="k-btn">${I('play')}<span>Join</span></button></div>
    <button class="k-link">Test mode ›</button>
  </div>`;
}

function lobbyRoom() {
  const players = [
    ['Tim', 0, 'Host'],
    ['Sam', 5, 'You'],
    ['Bot · Hard', 1, 'bot'],
  ];
  return `<div class="k-dialog s-panel lobby room">
    <div class="k-room"><span class="k-label">Room code</span><b class="k-code">KXQB</b></div>
    <ul class="k-players">${players
      .map(([n, c, t]) => `<li class="s-well${t === 'bot' ? ' bot' : ''}"><i class="dot" style="--pc:${PLAYER_COLORS[c as number][1]}"></i><span class="pname">${n}</span>${t === 'bot' ? `<span class="k-select s-well sm"><select><option>Hard</option></select></span><button class="k-ibtn s-btn xs" aria-label="Remove">${I('close')}</button>` : `<span class="k-tag">${t}</span>`}</li>`)
      .join('')}<li class="empty s-well"><button class="k-btn ghost sm">${I('bot')}<span>Add bot</span></button></li></ul>
    <div class="k-label">Your color</div>
    <div class="k-pswatches">${PLAYER_COLORS.map(([n, c], i) => `<button class="k-pswatch${i === 5 ? ' on' : ''}${i === 0 || i === 1 ? ' taken' : ''}" style="--pc:${c}" title="${n}"></button>`).join('')}</div>
    <button class="k-btn primary big">${I('play')}<span>Start</span></button>
  </div>`;
}

function loading(p = 0.62) {
  return `<div class="k-loading"><div class="k-brand">RA</div><div class="road"><svg class="tank" viewBox="0 0 20 11" shape-rendering="crispEdges" aria-hidden="true"><rect x="7" y="1" width="6" height="1" class="d"/><rect x="6" y="2" width="8" height="3" class="m"/><rect x="7" y="2" width="5" height="1" class="l"/><rect x="14" y="3" width="6" height="1" class="d"/><rect x="2" y="5" width="16" height="1" class="l"/><rect x="1" y="6" width="18" height="2" class="m"/><rect x="1" y="7" width="18" height="1" class="d"/><rect x="0" y="8" width="20" height="3" class="t"/></svg></div><div class="k-bar s-well"><i style="--p:${p}"></i></div><div class="txt">Deploying forces · ${Math.round(p * 100)}%</div></div>`;
}

function tip() {
  return `<div class="k-tip s-panel"><div class="k-tip-head"><b>Vehicle works</b><span class="cost">${coin()}2,000</span></div><p>Builds vehicles. Opens the Vehicles tab.</p><div class="k-tip-meta"><span>${I('bolt')}−30</span><span>Needs: Ore refinery</span></div></div>`;
}

function selbox(x: number, y: number, w: number, h: number, hp = 1, g = '') {
  const lvl = hp > 0.6 ? 'hi' : hp > 0.3 ? 'mid' : 'lo';
  return `<div class="k-selbox${g ? ' grp' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${g ? `--g:${g}` : ''}"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><div class="k-hp ${lvl}"><i style="--hp:${hp}"></i></div></div>`;
}

function rally(x: number, y: number) {
  return `<div class="k-rally" style="left:${x}px;top:${y}px">${I('flag')}</div>`;
}

function moveLine(x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return `<i class="k-moveline" style="left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${a}deg)"></i>`;
}

// ---------- Cursors: the game's own, from cursors.ts ----------

initCursors();
const RINGS: Record<string, string[]> = { move: moveRingFrames(), foe: attackRingFrames(), ore: harvestRingFrames() };
const CURSOR_NAMES: [CursorKind, string][] = [
  ['arrow', 'Pointer'], ['hand', 'Button'], ['move', 'Move'], ['attack', 'Attack'], ['harvest', 'Harvest'],
  ['corners', 'Pick unit'], ['rally', 'Rally'], ['build', 'Place'], ['blocked', 'Can’t'], ['grab', 'Drag'],
];
const cursorImg = (css: string) => css.match(/url\(([^)]+)\)/)?.[1] ?? '';
const ICON_NOTE: Record<IconSet, string> = {
  pixel: 'Chunky pixel set (the game’s own)',
  fine: 'Fine pixel set: one-pixel lines with a faint fill',
  duo: 'Smooth two-tone set',
  line: 'Line set',
};

// The move, attack and harvest cursors turn as they do in the game, and the
// order checks' rings with them.
let step = 0;
setInterval(() => {
  step = (step + 1) % MOVE_STEPS;
  const corner = CORNER_FRAMES[Math.floor(step / 3) % CORNER_FRAMES.length];
  const frame: Partial<Record<CursorKind, string>> = { move: moveCursor(step), attack: ATTACK_FRAMES[step], harvest: HARVEST_FRAMES[step], corners: corner };
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(frame)) root.setProperty(`--cur-${k}`, v);
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-ring]')) img.src = RINGS[img.dataset.ring!][step];
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-cur]')) {
    const v = frame[img.dataset.cur as CursorKind];
    if (v) img.src = cursorImg(v);
  }
}, 90);

// ---------- The page ----------

function swatches() {
  const vars: [string, string][] = [
    ['Panel', '--panel-solid'],
    ['Edge', '--line'],
    ['Text', '--ink'],
    ['Accent', '--accent'],
    ['Accent 2', '--accent-2'],
    ['Good', '--ok'],
    ['Warning', '--warn'],
    ['Danger', '--danger'],
  ];
  return `<div class="pg-swatches">${vars.map(([n, v]) => `<div class="pg-sw"><i style="background:var(${v})"></i><span>${n}</span><code data-var="${v}"></code></div>`).join('')}</div>`;
}

function card(title: string, body: string, note = '', cls = '') {
  return `<figure class="pg-card ${cls}"><div class="pg-demo">${body}</div><figcaption><b>${title}</b>${note ? `<span>${note}</span>` : ''}</figcaption></figure>`;
}

function render() {
  IS = T.icons;
  mapId = 0;
  kit.style.cssText = '';
  kit.dataset.theme = T.id;
  document.documentElement.dataset.theme = T.id;
  kit.dataset.family = document.documentElement.dataset.family = T.id === 'now' ? 'now' : 'pixel';
  kit.style.setProperty('--bg-url', `url("${BG}")`);
  for (const [k, v] of Object.entries(FRAMES[T.id] ?? {})) kit.style.setProperty(k, v);

  const idx = THEMES.indexOf(T);
  const deck = T.layout === 'deck';
  kit.innerHTML = `
  <section class="pg-intro">
    <div class="pg-intro-text">
      <div class="pg-num">${idx === 0 ? 'Reference' : `Design ${idx} of ${THEMES.length - 1}`}</div>
      <h1 class="pg-name">${T.name}</h1>
      <p class="pg-tag">${T.tag}</p>
      <p class="pg-blurb">${T.blurb}</p>
      <ul class="pg-traits">${T.traits.map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
    <div class="pg-intro-side">
      <div class="pg-type">
        <div class="pg-type-row"><span class="k-label">Display · ${T.type.display}</span><div class="pg-type-d">Victory 1234</div></div>
        <div class="pg-type-row"><span class="k-label">Text · ${T.type.body}</span><div class="pg-type-b">Power plant ready. Ore hauler returning to refinery.</div></div>
        <div class="pg-type-row"><span class="k-label">Labels and numbers</span><div class="pg-type-l"><span class="k-label">Vehicle works</span><span class="num">$12,450</span></div></div>
      </div>
      ${swatches()}
    </div>
  </section>

  <section class="pg-sec">
    <h2 class="pg-h2">In the game <small>Desktop</small></h2>
    <div class="stage-wrap" data-w="1400" data-h="860">
      <div class="stage desk" style="width:1400px;height:860px">
        <div class="world" style="width:1400px;height:860px">
          ${moveLine(436, 528, 660, 690)}
          ${selbox(414, 510, 44, 34, 0.9, GROUP_COLORS[3])}
          ${selbox(796, 586, 46, 34, 0.55)}
          ${selbox(948, 560, 44, 34, 0.25)}
          ${rally(700, 520)}
        </div>
        <div class="hud">${deck ? deckDesk() : `
          <div class="pos tl">${hudTop()}</div>
          <div class="pos tc">${toast('Lancer tank ready')}</div>
          <div class="pos tr">${mini()}</div>
          <div class="pos side">${buildPanel('side')}</div>
          <div class="pos bc">${selBar('full')}${toolbar('select')}</div>
          <div class="pos tipat">${tip()}</div>`}
        </div>
      </div>
    </div>
  </section>

  <section class="pg-sec">
    <h2 class="pg-h2">In the game <small>Phone</small></h2>
    <div class="phones">
${deck ? deckPhones() : `      ${phone('Building', -1035, -445, `<div class="pos tl">${hudTop()}</div><div class="pos tr">${mini()}</div><div class="pos sheet">${buildPanel('sheet', 0, 6)}</div><div class="pos bc">${toolbar('build')}</div>`)}
      ${phone(
        'Units selected',
        -570,
        -470,
        `<div class="pos tl">${hudTop()}</div><div class="pos tr">${mini()}</div><div class="pos tc low">${toast('Group 4 · 6 units')}</div><div class="pos conf" style="left:236px;top:440px">${confirmCheck()}</div><div class="pos bc">${palette()}${selBar('phone')}${toolbar('select')}</div>`,
        `${selbox(414, 510, 44, 34, 0.9, GROUP_COLORS[3])}${selbox(452, 744, 40, 30, 0.6, GROUP_COLORS[3])}${selbox(400, 760, 40, 30, 0.35, GROUP_COLORS[3])}${moveLine(436, 527, 545, 610)}`,
      )}
      ${phone('Deploying', -330, -505, `<div class="pos tl">${hudTop(5000)}</div><div class="pos tr">${mini()}</div><div class="pos deployat">${deploy()}</div><div class="pos tc low">${toast('Tap Deploy to set up your base')}</div><div class="pos bc">${toolbar('')}</div>`)}
`}
      ${phone('Lobby', -1035, -300, `<div class="pos center">${lobbyRoom()}</div>`, '', 'dim')}
    </div>
  </section>

  <section class="pg-sec">
    <h2 class="pg-h2">Components</h2>
    <h3 class="pg-h3">Basics</h3>
    <div class="pg-grid">
      ${card('Buttons', `<div class="pg-col"><div class="pg-row"><button class="k-btn primary">${I('play')}<span>Primary</span></button><button class="k-btn">${I('gear')}<span>Secondary</span></button></div><div class="pg-row"><button class="k-btn danger">${I('back')}<span>Danger</span></button><button class="k-btn" disabled><span>Disabled</span></button><button class="k-btn ghost"><span>Ghost</span></button></div><div class="pg-row"><button class="k-btn sm"><span>Small</span></button><button class="k-ibtn s-btn" aria-label="Menu">${I('menu')}</button><button class="k-ibtn s-btn sm" aria-label="Close">${I('close')}</button><button class="k-ibtn s-btn on" aria-label="Menu">${I('menu')}</button></div></div>`, 'Primary, secondary, danger, disabled, ghost, small and icon buttons', 'plain span2')}
      ${card('Type and colour', `<div class="pg-col"><div class="k-title">Choose a map</div><div class="k-label">Section label</div><p class="k-p">Body text for blurbs, tooltips and hints. Ore hauler returning to refinery.</p><div class="pg-row">${badge('New')}${badge('3', 'count')}${badge('Host', 'tag')}<span class="k-alertdot"></span></div></div>`, 'Title, label, body, badges, count bubble and alert dot', 'plain')}
      ${card('Fields', `<div class="pg-col"><label class="k-field"><span class="k-label">Your name</span><input class="k-input s-well" value="Tim"></label><label class="k-field"><span class="k-label">Version</span><span class="k-select s-well"><select><option>v2 · Isometric</option></select></span></label>${seg(['Initial', 'Combat'])}${range('Music', 70)}</div>`, 'Text input, select, segmented switch and slider', 'plain')}
      ${card('Cursors', `<div class="pg-cursors">${CURSOR_NAMES.map(([k, n]) => `<div><span class="cv" style="cursor:${CURSORS[k]}"><img data-cur="${k}" src="${cursorImg(CURSORS[k])}" alt=""></span><small>${n}</small></div>`).join('')}</div>`, 'The game’s own cursors, kept in every design. Hover the map in the mockups to try the move cursor', 'plain span2')}
      ${card('Icons', `<div class="pg-icons">${(['menu', 'select', 'home', 'build', 'group', 'all', 'clear', 'close', 'shuffle', 'units', 'check', 'deploy', 'gear', 'back', 'flag', 'bolt', 'play', 'users', 'bot'] as IconName[]).map((n) => I(n)).join('')}</div>`, ICON_NOTE[T.icons], 'plain span2')}
    </div>

    ${deck ? deckCards() : ''}
    <h3 class="pg-h3">HUD</h3>
    <div class="pg-grid">
      ${card('Menu button and credits', hudTop(), 'Top left; credits turn red when power is short')}
      ${card('Credits states', `<div class="pg-col">${credits(12450)}${credits(3000, 'full')}${credits(820, 'low')}</div>`, 'Normal, full (storage capped) and short of power')}
      ${card('Minimap globe', mini(), 'Top right; the view is outlined, with an attack ping')}
      ${card('Toolbar', `<div class="pg-row">${toolbar('')}${toolbar('select', true)}</div>`, 'Idle, and Select on with the Build alert', 'span2')}
      ${card('Toasts', `<div class="pg-col">${toast('Barracks ready')}${toast('Not enough credits', 'bad')}${toast('New: Vehicle works', 'good')}</div>`, 'Info, error and unlock messages', 'span2')}
      ${card('Tooltip', tip(), 'Hover an item in the build menu (desktop)')}
    </div>

    <h3 class="pg-h3">Build menu</h3>
    <div class="pg-grid wide">
      ${card('Sidebar (desktop)', buildPanel('side', 3, 6), 'Always open on a wide screen, under the minimap', 'tall')}
      ${card('Item states', `<div class="pg-items">${item('power', 'Power plant', 300)}${item('barracks', 'Barracks', 300, { state: 'building', prog: 0.4 })}${item('refinery', 'Ore refinery', 1500, { state: 'ready' })}${item('silo', 'Ore silo', 150, { state: 'paused', prog: 0.7 })}${item('factory', 'Vehicle works', 2000, { fresh: true })}${item('lancer', 'Lancer tank', 900, { state: 'building', prog: 0.15, count: 4 })}${item('radar', 'Radar mast', 1000, { state: 'blocked' })}${item('lab', 'Tech lab', 1500, { state: 'locked' })}</div>`, 'Ready to buy, building with the clock wipe, ready to place, on hold, new, queued, can’t afford and locked', 'tall')}
    </div>
    <div class="pg-grid">
      ${card('Tabs', `<div class="pg-tabs">${buildTabs(0)}</div>`, 'Base, Defense, Infantry, Vehicles, with a new-item alert', 'span2')}
      ${card('Power meter', `<div class="pg-row pwrs">${power(0.8, 0.45, 'ok')}${power(0.6, 0.55, 'tight')}${power(0.4, 0.7, 'low')}</div>`, 'Enough, tight and short (blinks)', 'span2')}
    </div>

    <h3 class="pg-h3">Selecting and orders</h3>
    <div class="pg-grid">
      ${card('Selection bar', selBar('full'), 'Colour groups, unit kinds (lit when selected, dashed when partly), Group and Clear', 'span2')}
      ${card('Locked group', selBar('locked'), 'After an order the selection becomes one button')}
      ${card('Colour groups', palette(), 'Pick a colour to make the selection a group')}
      ${card('Unit kind buttons', `<div class="pg-row">${utype('lancer', 4)}${utype('lancer', 4, true)}${utype('buggy', 3, false, true)}${grp(4, 'rifle', 8)}${grp(4, 'rifle', 8, true)}</div>`, 'Off, on, partly selected, group, group selected')}
      ${card('Selection, health and rally', `<div class="pg-units">${selbox(10, 22, 56, 42, 1)}${selbox(90, 22, 56, 42, 0.5)}${selbox(170, 22, 56, 42, 0.2)}${selbox(250, 22, 56, 42, 0.8, GROUP_COLORS[1])}</div><div class="pg-units short">${rally(40, 44)}${moveLine(70, 34, 300, 20)}</div>`, 'Corners in the group colour when grouped; rally flag and the line to where units are headed')}
      ${card('Order confirm (phone)', `<div class="pg-row confs">${confirmCheck()}${confirmCheck('foe')}${confirmCheck('ore')}</div>`, 'Move, attack and harvest')}
      ${card('Deploy', `<div class="pg-row">${deploy()}${deploy(true)}</div>`, 'Over the Foundry vehicle; disabled where it can’t deploy')}
    </div>

    <h3 class="pg-h3">Menus and screens</h3>
    <div class="pg-grid">
      ${card('Game menu', menu())}
      ${card('Settings', settings())}
      ${card('End of game', `<div class="pg-col">${banner(true)}</div>`)}
      ${card('Defeat', `<div class="pg-col">${banner(false)}</div>`)}
      ${card('Map picker', picker(), '', 'span2')}
      ${card('Lobby', lobbyHome())}
      ${card('Room', lobbyRoom())}
      ${card('Loading screen', loading(), '', 'full dark')}
    </div>
  </section>`;

  drawMaps();
  fillSwatchCodes();
  fitStages();
  for (const r of kit.querySelectorAll<HTMLInputElement>('.k-range'))
    r.addEventListener('input', () => {
      r.style.setProperty('--v', `${r.value}%`);
      const o = r.closest('.k-set')?.querySelector('output');
      if (o) o.textContent = r.value;
    });
}

function badge(t: string, cls = 'new') {
  return `<span class="k-badge ${cls}">${t}</span>`;
}

function phone(label: string, ox: number, oy: number, hud: string, world = '', cls = '') {
  return `<figure class="phone-fig"><div class="stage-wrap phone-wrap" data-w="390" data-h="780"><div class="stage phone ${cls}" style="width:390px;height:780px"><div class="world" style="width:1400px;height:860px;transform:translate(${ox}px,${oy}px) scale(1.5)">${world}</div><div class="hud">${hud}</div></div></div><figcaption>${label}</figcaption></figure>`;
}

function onClick(e: Event) {
  const t = e.target as HTMLElement;
  const b = t.closest<HTMLElement>('.k-utype:not(.whole), .k-grp, .k-tab, .k-swatch, .k-pswatch:not(.taken), .k-seg button, .k-map, .k-tool');
  if (!b) return;
  if (b.matches('.k-tab, .k-swatch, .k-pswatch, .k-map')) {
    const sel = b.matches('.k-tab') ? '.k-tab' : b.matches('.k-swatch') ? '.k-swatch' : b.matches('.k-pswatch') ? '.k-pswatch' : '.k-map';
    b.parentElement?.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b));
  } else if (b.matches('.k-seg button')) {
    b.parentElement?.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  } else b.classList.toggle('on');
}

// ---------- Map previews: little noise maps, in the game's map colours ----------

function noise(seed: number) {
  const h = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const sm = (t: number) => t * t * (3 - 2 * t);
  const v = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x: number, y: number) => v(x, y) * 0.6 + v(x * 2, y * 2) * 0.3 + v(x * 4, y * 4) * 0.1;
}

function drawMaps() {
  for (const cv of kit.querySelectorAll<HTMLCanvasElement>('canvas.mapcv')) {
    const seed = Number(cv.dataset.seed);
    const n = noise(seed);
    const c = cv.getContext('2d')!;
    const img = c.createImageData(cv.width, cv.height);
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++) {
        const e = n(x / 14, y / 14);
        const col = e < 0.38 ? [38, 84, 140] : e < 0.42 ? [70, 120, 170] : e < 0.45 ? [196, 180, 120] : e < 0.62 ? [60, 104, 46] : e < 0.72 ? [44, 82, 36] : [120, 112, 96];
        const i = (y * cv.width + x) * 4;
        img.data.set([col[0], col[1], col[2], 255], i);
      }
    c.putImageData(img, 0, 0);
    const mark = (x: number, y: number, col: string) => {
      c.fillStyle = '#000';
      c.fillRect(x - 3, y - 3, 6, 6);
      c.fillStyle = col;
      c.fillRect(x - 2, y - 2, 4, 4);
    };
    mark(18, 34, '#7fb2ff');
    mark(78, 14, '#ff6a4d');
  }
}

function fillSwatchCodes() {
  const cs = getComputedStyle(kit);
  for (const el of kit.querySelectorAll<HTMLElement>('code[data-var]')) el.textContent = cs.getPropertyValue(el.dataset.var!).trim().slice(0, 22);
}

// Mockups are drawn at their real size and scaled to fit.
function fitStages() {
  for (const wrap of kit.querySelectorAll<HTMLElement>('.stage-wrap')) {
    const w = Number(wrap.dataset.w);
    const h = Number(wrap.dataset.h);
    const stage = wrap.firstElementChild as HTMLElement;
    const avail = wrap.parentElement!.clientWidth;
    const s = Math.min(1, avail / w);
    stage.style.transform = `scale(${s})`;
    wrap.style.width = `${w * s}px`;
    wrap.style.height = `${h * s}px`;
  }
}
new ResizeObserver(() => fitStages()).observe(document.body);
// pressed states you can try
kit.addEventListener('click', onClick);

// ---------- Tabs ----------

function pick(id: string, push = true) {
  T = THEMES.find((t) => t.id === id) ?? THEMES[1];
  for (const b of tabsEl.querySelectorAll<HTMLButtonElement>('button')) {
    const on = b.dataset.id === T.id;
    b.setAttribute('aria-selected', String(on));
    if (on && push) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  if (push) history.replaceState(null, '', `#${T.id}`);
  try {
    localStorage.setItem('ra-uikit', T.id);
  } catch {
    /* private mode */
  }
  render();
}

tabsEl.innerHTML = THEMES.map((t, i) => `<button role="tab" data-id="${t.id}" aria-selected="false"><span class="n">${i === 0 ? '·' : i}</span><span class="t">${t.name}</span></button>`).join('');
tabsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (b) pick(b.dataset.id!);
});
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const i = THEMES.indexOf(T);
  if (e.key === 'ArrowRight') pick(THEMES[(i + 1) % THEMES.length].id);
  if (e.key === 'ArrowLeft') pick(THEMES[(i - 1 + THEMES.length) % THEMES.length].id);
});

let first = location.hash.slice(1);
if (!THEMES.some((t) => t.id === first)) {
  try {
    first = localStorage.getItem('ra-uikit') ?? '';
  } catch {
    first = '';
  }
}
prepareIcons()
  .catch(() => undefined)
  .then(() => pick(first || THEMES[1].id, false));
document.fonts?.ready.then(fitStages);
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id !== T.id && THEMES.some((t) => t.id === id)) pick(id, false);
});
