// The UI kit page (/ui/): every piece of the game's interface, on its own and
// in the game, in Soft Pixel, with a panel for trying other fonts, icons and
// colors on it. Nothing here is used by the game yet: it is for settling the
// design. The look is in kit.css under [data-theme='soft']; the panel sets
// CSS variables (and the frames drawn from the colors), so every component
// below is the same markup whatever is picked.
import './kit.css';
import { COIN_ART, IconName, IconSet, icon, prepareIcons } from './icons';
import { ATTACK_FRAMES, CORNER_FRAMES, CURSORS, CursorKind, HARVEST_FRAMES, MOVE_STEPS, attackRingFrames, harvestRingFrames, initCursors, moveCursor, moveRingFrames } from '../cursors';
import { GROUP_COLORS, PLAYER_COLORS } from './colors';
import { COLOR_KEYS, Colors, DEFAULT, Design, FONTS, ICON_SETS, PRESETS, ROLES, Role, fromHash, toHash } from './design';
import { useFont } from './fonts';
import { themeVars } from '../theme';

const art = import.meta.glob('./art/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const A = (n: string) => art[`./art/${n}`];
const BG = A('bg.webp');
const GLOBE = A('globe.png');

const kit = document.querySelector<HTMLElement>('#kit')!;
const panel = document.querySelector<HTMLElement>('#tweak')!;

let D: Design = structuredClone(DEFAULT);
let IS: IconSet = D.icons;
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
  IS = D.icons;
  mapId = 0;
  kit.innerHTML = `
  <section class="pg-intro">
    <div class="pg-intro-text">
      <div class="pg-num">Your pick · now in the game</div>
      <h1 class="pg-name">Soft Pixel</h1>
      <p class="pg-tag">The game’s look</p>
      <p class="pg-blurb">Bigger, rounder stepped corners, Night ops colors, Jersey 15 headings, DotGothic16 for everything else and smooth line icons: what the game now uses. The Tweak panel still tries other fonts, icons and colors, and the address keeps what you pick, so a link shows exactly what you chose.</p>
      <ul class="pg-traits" data-traits></ul>
    </div>
    <div class="pg-intro-side">
      <div class="pg-type">
        <div class="pg-type-row"><span class="k-label" data-font="d">Headings</span><div class="pg-type-d">Victory 1234</div></div>
        <div class="pg-type-row"><span class="k-label" data-font="b">Body text</span><div class="pg-type-b">Power plant ready. Ore hauler returning to refinery.</div></div>
        <div class="pg-type-row"><span class="k-label" data-font="l">Labels</span><div class="pg-type-l"><span class="k-label">Vehicle works</span><span class="num">$12,450</span></div></div>
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
        <div class="hud">
          <div class="pos tl">${hudTop()}</div>
          <div class="pos tc">${toast('Lancer tank ready')}</div>
          <div class="pos tr">${mini()}</div>
          <div class="pos side">${buildPanel('side')}</div>
          <div class="pos bc">${selBar('full')}${toolbar('select')}</div>
          <div class="pos tipat">${tip()}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="pg-sec">
    <h2 class="pg-h2">In the game <small>Phone</small></h2>
    <div class="phones">
      ${phone('Building', -1035, -445, `<div class="pos tl">${hudTop()}</div><div class="pos tr">${mini()}</div><div class="pos sheet">${buildPanel('sheet', 0, 6)}</div><div class="pos bc">${toolbar('build')}</div>`)}
      ${phone(
        'Units selected',
        -570,
        -470,
        `<div class="pos tl">${hudTop()}</div><div class="pos tr">${mini()}</div><div class="pos tc low">${toast('Group 4 · 6 units')}</div><div class="pos conf" style="left:236px;top:440px">${confirmCheck()}</div><div class="pos bc">${palette()}${selBar('phone')}${toolbar('select')}</div>`,
        `${selbox(414, 510, 44, 34, 0.9, GROUP_COLORS[3])}${selbox(452, 744, 40, 30, 0.6, GROUP_COLORS[3])}${selbox(400, 760, 40, 30, 0.35, GROUP_COLORS[3])}${moveLine(436, 527, 545, 610)}`,
      )}
      ${phone('Deploying', -330, -505, `<div class="pos tl">${hudTop(5000)}</div><div class="pos tr">${mini()}</div><div class="pos deployat">${deploy()}</div><div class="pos tc low">${toast('Tap Deploy to set up your base')}</div><div class="pos bc">${toolbar('')}</div>`)}
      ${phone('Lobby', -1035, -300, `<div class="pos center">${lobbyRoom()}</div>`, '', 'dim')}
    </div>
  </section>

  <section class="pg-sec">
    <h2 class="pg-h2">Components</h2>
    <h3 class="pg-h3">Basics</h3>
    <div class="pg-grid">
      ${card('Buttons', `<div class="pg-col"><div class="pg-row"><button class="k-btn primary">${I('play')}<span>Primary</span></button><button class="k-btn">${I('gear')}<span>Secondary</span></button></div><div class="pg-row"><button class="k-btn danger">${I('back')}<span>Danger</span></button><button class="k-btn" disabled><span>Disabled</span></button><button class="k-btn ghost"><span>Ghost</span></button></div><div class="pg-row"><button class="k-btn sm"><span>Small</span></button><button class="k-ibtn s-btn" aria-label="Menu">${I('menu')}</button><button class="k-ibtn s-btn sm" aria-label="Close">${I('close')}</button><button class="k-ibtn s-btn on" aria-label="Menu">${I('menu')}</button></div></div>`, 'Primary, secondary, danger, disabled, ghost, small and icon buttons', 'plain span2')}
      ${card('Type and color', `<div class="pg-col"><div class="k-title">Choose a map</div><div class="k-label">Section label</div><p class="k-p">Body text for blurbs, tooltips and hints. Ore hauler returning to refinery.</p><div class="pg-row">${badge('New')}${badge('3', 'count')}${badge('Host', 'tag')}<span class="k-alertdot"></span></div></div>`, 'Title, label, body, badges, count bubble and alert dot', 'plain')}
      ${card('Fields', `<div class="pg-col"><label class="k-field"><span class="k-label">Your name</span><input class="k-input s-well" value="Tim"></label><label class="k-field"><span class="k-label">Version</span><span class="k-select s-well"><select><option>v2 · Isometric</option></select></span></label>${seg(['Initial', 'Combat'])}${range('Music', 70)}</div>`, 'Text input, select, segmented switch and slider', 'plain')}
      ${card('Cursors', `<div class="pg-cursors">${CURSOR_NAMES.map(([k, n]) => `<div><span class="cv" style="cursor:${CURSORS[k]}"><img data-cur="${k}" src="${cursorImg(CURSORS[k])}" alt=""></span><small>${n}</small></div>`).join('')}</div>`, 'The game’s own cursors, kept in every design. Hover the map in the mockups to try the move cursor', 'plain span2')}
      ${card('Icons', `<div class="pg-icons">${(['menu', 'select', 'home', 'build', 'group', 'all', 'clear', 'close', 'shuffle', 'units', 'check', 'deploy', 'gear', 'back', 'flag', 'bolt', 'play', 'users', 'bot'] as IconName[]).map((n) => I(n)).join('')}</div>`, `${ICON_SETS.find((x) => x.id === D.icons)!.name}: ${ICON_SETS.find((x) => x.id === D.icons)!.note.toLowerCase()}. Pick another set in the Tweak panel`, 'plain span2')}
    </div>

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
      ${card('Selection bar', selBar('full'), 'Color groups, unit kinds (lit when selected, dashed when partly), Group and Clear', 'span2')}
      ${card('Locked group', selBar('locked'), 'After an order the selection becomes one button')}
      ${card('Color groups', palette(), 'Pick a color to make the selection a group')}
      ${card('Unit kind buttons', `<div class="pg-row">${utype('lancer', 4)}${utype('lancer', 4, true)}${utype('buggy', 3, false, true)}${grp(4, 'rifle', 8)}${grp(4, 'rifle', 8, true)}</div>`, 'Off, on, partly selected, group, group selected')}
      ${card('Selection, health and rally', `<div class="pg-units">${selbox(10, 22, 56, 42, 1)}${selbox(90, 22, 56, 42, 0.5)}${selbox(170, 22, 56, 42, 0.2)}${selbox(250, 22, 56, 42, 0.8, GROUP_COLORS[1])}</div><div class="pg-units short">${rally(40, 44)}${moveLine(70, 34, 300, 20)}</div>`, 'Corners in the group color when grouped; rally flag and the line to where units are headed')}
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

// ---------- Map previews: little noise maps, in the game's map colors ----------

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

// ---------- The tweak panel ----------

const fontName = (r: Role) => D.fonts[r];
const sameColors = (a: Colors, b: Colors) => COLOR_KEYS.every((k) => a[k.id].toLowerCase() === b[k.id].toLowerCase());
const SAMPLE_ICONS: IconName[] = ['select', 'build', 'home', 'gear', 'flag', 'users'];

function buildPanelUi() {
  const groups = (['Pixel', 'Smooth'] as const)
    .map((k) => `<optgroup label="${k === 'Pixel' ? 'Pixel fonts' : 'Smooth fonts'}">${FONTS.filter((f) => f.kind === k).map((f) => `<option>${f.name}</option>`).join('')}</optgroup>`)
    .join('');
  panel.innerHTML = `
    <button class="tw-toggle" type="button" aria-expanded="false" aria-controls="twBody">Tweak</button>
    <div class="tw-body" id="twBody">
      <div class="tw-head"><b>Tweak Soft Pixel</b><button class="tw-close" type="button" aria-label="Close">×</button></div>
      <section class="tw-sec">
        <h3>Fonts</h3>
        ${ROLES.map((r) => `<label class="tw-font"><span class="tw-l">${r.name}<small>${r.note}</small></span><select data-role="${r.id}">${groups}</select><span class="tw-sample" style="font-family:'ra-${r.id}'; font-weight:${r.id === 'd' ? 'var(--w-d)' : 400}">${r.sample}</span></label>`).join('')}
      </section>
      <section class="tw-sec">
        <h3>Icons</h3>
        <div class="tw-icons">${ICON_SETS.map((s) => `<button type="button" class="tw-iset" data-icons="${s.id}" title="${s.note}"><span class="tw-ipre">${SAMPLE_ICONS.map((n) => icon(n, s.id)).join('')}</span><span>${s.name}</span></button>`).join('')}</div>
      </section>
      <section class="tw-sec">
        <h3>Colors</h3>
        <div class="tw-presets">${PRESETS.map((p) => `<button type="button" class="tw-preset" data-preset="${p.id}"><span class="dots">${(['panel', 'trim', 'accent', 'on', 'ink'] as const).map((k) => `<i style="background:${p.c[k]}"></i>`).join('')}</span><span>${p.name}</span></button>`).join('')}</div>
        <div class="tw-colors">${COLOR_KEYS.map((k) => `<label class="tw-color" title="${k.note}"><input type="color" data-color="${k.id}"><span>${k.name}</span></label>`).join('')}</div>
      </section>
      <div class="tw-foot"><button type="button" class="tw-btn" data-act="reset">Reset</button><button type="button" class="tw-btn main" data-act="copy">Copy link</button></div>
    </div>`;

  const open = (on: boolean) => {
    panel.classList.toggle('open', on);
    panel.querySelector('.tw-toggle')!.setAttribute('aria-expanded', String(on));
  };
  panel.querySelector('.tw-toggle')!.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.tw-close')!.addEventListener('click', () => open(false));
  for (const sel of panel.querySelectorAll<HTMLSelectElement>('select[data-role]'))
    sel.addEventListener('change', () => {
      D.fonts[sel.dataset.role as Role] = sel.value;
      apply();
    });
  for (const inp of panel.querySelectorAll<HTMLInputElement>('input[data-color]'))
    inp.addEventListener('input', () => {
      D.colors[inp.dataset.color as keyof Colors] = inp.value;
      apply();
    });
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.icons) {
      D.icons = b.dataset.icons as IconSet;
      apply();
    } else if (b.dataset.preset) {
      D.colors = { ...PRESETS.find((p) => p.id === b.dataset.preset)!.c };
      apply();
    } else if (b.dataset.act === 'reset') {
      D = structuredClone(DEFAULT);
      apply();
    } else if (b.dataset.act === 'copy') {
      const done = () => {
        b.textContent = 'Copied';
        setTimeout(() => (b.textContent = 'Copy link'), 1500);
      };
      navigator.clipboard?.writeText(location.href).then(done, () => prompt('Copy this link', location.href));
    }
  });
}

function syncPanel() {
  for (const sel of panel.querySelectorAll<HTMLSelectElement>('select[data-role]')) sel.value = fontName(sel.dataset.role as Role);
  for (const inp of panel.querySelectorAll<HTMLInputElement>('input[data-color]')) {
    const v = D.colors[inp.dataset.color as keyof Colors];
    if (inp.value !== v) inp.value = v;
  }
  for (const b of panel.querySelectorAll<HTMLElement>('[data-icons]')) b.classList.toggle('on', b.dataset.icons === D.icons);
  for (const b of panel.querySelectorAll<HTMLElement>('[data-preset]')) b.classList.toggle('on', sameColors(PRESETS.find((p) => p.id === b.dataset.preset)!.c, D.colors));
}

// What's on the intro: the fonts and colors picked.
function syncIntro() {
  for (const el of kit.querySelectorAll<HTMLElement>('[data-font]')) {
    const r = el.dataset.font as Role;
    el.textContent = `${ROLES.find((x) => x.id === r)!.name} · ${fontName(r)}`;
  }
  const preset = PRESETS.find((p) => sameColors(p.c, D.colors));
  const traits = [
    `${fontName('d')} headings`,
    `${fontName('b')} text`,
    fontName('l') !== fontName('b') ? `${fontName('l')} labels` : '',
    `${fontName('n')} numbers`,
    `${ICON_SETS.find((x) => x.id === D.icons)!.name} icons`,
    preset ? `${preset.name} colors` : 'Custom colors',
  ].filter(Boolean);
  const ul = kit.querySelector('[data-traits]');
  if (ul) ul.innerHTML = traits.map((t) => `<li>${t}</li>`).join('');
}

function save() {
  const h = toHash(D);
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
  try {
    localStorage.setItem('ra-uikit-soft', h);
  } catch {
    /* private mode */
  }
}

let rendered = false;
function apply() {
  const vars = themeVars(D.colors);
  for (const el of [kit, document.documentElement]) for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  const w = String(FONTS.find((f) => f.name === D.fonts.d)?.w ?? 400);
  for (const el of [kit, document.documentElement]) el.style.setProperty('--w-d', w);
  for (const r of ROLES) useFont(r.id, D.fonts[r.id]).then(fitStages, () => undefined);
  if (!rendered || IS !== D.icons) {
    render();
    rendered = true;
  }
  syncIntro();
  fillSwatchCodes();
  syncPanel();
  save();
}

kit.dataset.theme = document.documentElement.dataset.theme = 'soft';
kit.dataset.family = document.documentElement.dataset.family = 'pixel';
kit.style.setProperty('--bg-url', `url("${BG}")`);

function stored(): Design | null {
  try {
    return fromHash(localStorage.getItem('ra-uikit-soft') ?? '');
  } catch {
    return null;
  }
}
D = fromHash(location.hash) ?? stored() ?? structuredClone(DEFAULT);

prepareIcons()
  .catch(() => undefined)
  .then(() => {
    buildPanelUi();
    apply();
  });
document.fonts?.ready.then(fitStages);
window.addEventListener('hashchange', () => {
  const d = fromHash(location.hash);
  if (d && toHash(d) !== toHash(D)) {
    D = d;
    apply();
  }
});
