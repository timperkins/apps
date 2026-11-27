// Knight Battle: controls, the HUD, menus, and playing together. The host runs the rules (sim.ts) and
// sends snapshots about 20 times a second; friends send their stick, aim and buttons.
import { play, unlockAudio, isMuted, setMuted } from '../audio';
import { esc, type Match } from '../match';
import {
  ARMOR, BKINDS, BUILD, BUILDABLE, CLASS, CLASSES, CLASS_PRICE, ENCH, Game, MEAT_HEAL, MEAT_PRICE, ORDERS, TAUNTS, TEAM_NAMES, TILE, UKINDS, UNIT,
  type BKind, type Cmd, type Input, type Order, type PView, type Snap,
} from './sim';
import { Renderer, RING, artUrl, loadArt, type Overlay } from './render';

type ToHost = { t: 'in'; i: Input } | { t: 'cmd'; c: Cmd };
type ToFriend = { t: 's'; s: Snap } | { t: 'err'; m: string };

const ORDER_TEXT: Record<Order, string> = { attack: '⚔️ Attack!', defend: '🛡️ Guard my heart', follow: '🚩 Follow me' };
const CLASS_ICON = { knight: '🗡️', archer: '🏹', monk: '✨', lancer: '🔱' };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TICK = 1 / 30, SNAP_EVERY = 1 / 20;

const HELP = `
  <h2>⚔️ Knight Battle</h2>
  <p><b>Blue team</b> starts at the bottom, <b>red team</b> at the top (red players see the field upside down, so your own heart is always at the bottom of your screen). Every player has a <b>big heart with 1000 health</b>. Break all of the other team's hearts to win.</p>
  <ul>
    <li>🗡️ You start as a <b>knight</b>: 72 damage a swing, with knockback. Hit gold rocks in the middle for gold, and sheep for meat.</li>
    <li>🏰 At your <b>castle</b> (press <kbd>E</kbd> next to it) pay ${CLASS_PRICE} gold to change class: Knight, Archer (arrows, no sword), Monk (heals you and teammates, hurts enemies) or Lancer (long spear). Buy armor (stone takes 15% less damage, iron 40%, gold 55%, diamond 70%) and meat there too.</li>
    <li>🔨 Press <kbd>B</kbd> to <b>build</b> on your side: walls, the Infinite Gold Block (never breaks unless you sell it, everyone walks through it, and it stops enemy arrows), houses, barracks, an archery range, a monastery and towers. Walk up to your building and press <kbd>E</kbd> to train warriors or sell it.</li>
    <li>🚩 <kbd>Q</kbd> tells your warriors to attack, guard your heart or follow you.</li>
    <li>🍖 <kbd>1</kbd> eats meat to heal.</li>
    <li>🎁 Every 5 minutes a <b>mystery box</b> drops in the middle of the map. Grab it for a random weapon enchantment: freezing, burning, zapping (jumps to the nearest enemy) or poisoning. You keep it until you're knocked out.</li>
    <li>😜 <kbd>T</kbd> taunts whoever you can see.</li>
    <li>👻 Knocked out, you come back at your heart in 5 seconds. If your heart is broken, you become a ghost who watches the chaos.</li>
  </ul>
  <p><kbd>WASD</kbd>/arrows walk · mouse aims · click or <kbd>Space</kbd> attack · <kbd>E</kbd> use · <kbd>B</kbd> build · <kbd>Q</kbd> army · <kbd>1</kbd> eat · <kbd>T</kbd> taunt · <kbd>Esc</kbd> menu</p>
  <p class="kb-credit">Unit and building art: <a href="https://pixelfrog-assets.itch.io/tiny-swords" target="_blank" rel="noopener">Tiny Swords</a> by Pixel Frog.</p>`;

export function startGame(root: HTMLElement, match: Match): () => void {
  root.innerHTML = `
    <div class="kb">
      <canvas class="kb-canvas"></canvas>
      <div class="kb-top"><div class="kb-res"></div><div class="kb-hearts"></div></div>
      <div class="kb-btns"><button data-b="mute"></button><button data-b="menu">☰</button></div>
      <div class="kb-side">
        <canvas class="kb-mini" width="150" height="200"></canvas>
        <button class="kb-act" data-b="build">🔨 Build <kbd>B</kbd></button>
        <button class="kb-act" data-b="order"></button>
        <button class="kb-act" data-b="taunt">😜 Taunt <kbd>T</kbd></button>
      </div>
      <div class="kb-hero"></div>
      <div class="kb-toasts"></div>
      <div class="kb-hint" hidden></div>
      <div class="kb-banner" hidden></div>
      <div class="kb-touch">
        <div class="kb-stick"><i></i></div>
        <div class="kb-tbtns">
          <button data-t="atk" class="big">⚔️</button>
          <button data-t="use">✋<span>Use</span></button>
          <button data-t="build">🔨<span>Build</span></button>
          <button data-t="eat">🍖<span>Eat</span></button>
          <button data-t="taunt">😜<span>Taunt</span></button>
          <button data-t="order">🚩<span>Army</span></button>
        </div>
      </div>
      <div class="kb-place" hidden><button data-p="ok">✔ Place</button><button data-p="no">✕</button></div>
      <div class="kb-dim" hidden><div class="kb-panel"></div></div>
      <div class="kb-loading">Loading…</div>
    </div>`;
  const $ = <E extends HTMLElement>(s: string) => root.querySelector<E>(s)!;
  const wrap = $('.kb'), canvas = $<HTMLCanvasElement>('.kb-canvas'), mini = $<HTMLCanvasElement>('.kb-mini');
  const resEl = $('.kb-res'), heartsEl = $('.kb-hearts'), heroEl = $('.kb-hero'), toastsEl = $('.kb-toasts'), hintEl = $('.kb-hint'), bannerEl = $('.kb-banner');
  const dim = $('.kb-dim'), panel = $('.kb-panel'), orderBtn = $('[data-b="order"]'), tauntBtn = $('[data-b="taunt"]'), muteBtn = $('[data-b="mute"]');
  const placeBar = $('.kb-place');
  const touch = matchMedia('(pointer: coarse)').matches;
  wrap.classList.toggle('touch', touch);

  const me = match.me;
  let myTeam = match.players.find((p) => p.slot === me)?.team ?? 0;
  const game = match.host ? new Game(match.players, match.seed) : null;
  let ren: Renderer | null = null;
  let snap: Snap | null = null;
  let mine: PView | null = null;
  let stopped = false, ended = false, hostGone = false;
  let artReady = false;
  void loadArt().then(() => { artReady = true; $('.kb-loading').remove(); });

  function makeRenderer(W: number, H: number) {
    ren = new Renderer(canvas, W, H, myTeam === 1, match.seed);
    ren.resize();
  }
  if (game) makeRenderer(game.W, game.H);

  // ---------- input ----------
  const keys = new Set<string>();
  let stick = { x: 0, y: 0 }, touchAtk = false, mouseAtk = false;
  let mouse: { x: number; y: number } | null = null;
  let placing: BKind | null = null;
  const panelOpen = () => !dim.hidden;

  function heroPos() {
    if (!ren || !mine) return null;
    return ren.pos(mine.hero, performance.now());
  }
  function input(): Input {
    let mx = stick.x, my = stick.y;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    if (myTeam === 1) my = -my; // red sees the field upside down
    let ax = 0, ay = 0;
    const hp = heroPos();
    if (hp && ren) {
      if (!touch && mouse) { const w = ren.toWorld(mouse.x, mouse.y); ax = w.x - hp.x; ay = w.y - (hp.y - 30); }
      else {
        // phones: aim at the nearest enemy close by, otherwise where you walk
        let best = 330;
        for (const e of ren.ents()) {
          if (e.team === myTeam || e.flags & 16) continue;
          const d = Math.hypot(e.x - hp.x, e.y - hp.y);
          if (d < best) { best = d; ax = e.x - hp.x; ay = e.y - hp.y; }
        }
        if (!ax && !ay) {
          if (mx || my) { ax = mx; ay = my; lastAim = { x: mx, y: my }; } else { ax = lastAim.x; ay = lastAim.y; }
          // swing at gold rocks and buildings in front too
        }
      }
    }
    const atk = !panelOpen() && !placing && (keys.has(' ') || keys.has('j') || touchAtk || mouseAtk);
    return { mx, my, ax, ay, atk };
  }
  let lastAim = { x: 0, y: myTeam === 0 ? -1 : 1 };

  function send(c: Cmd) {
    if (game) { const err = game.cmd(me, c); if (err) toast(err, true); }
    else match.send({ t: 'cmd', c } satisfies ToHost);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); if (panelOpen()) closePanel(); else if (placing) cancelPlace(); else openMenu(); return; }
    if (e.target instanceof HTMLInputElement) return;
    if (ended) return;
    if (panelOpen()) {
      const n = Number(k);
      if (n >= 1 && n <= 9) { const b = panel.querySelectorAll<HTMLButtonElement>('[data-n]')[n - 1]; b?.click(); }
      return;
    }
    unlockAudio();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (placing && (k === 'e' || k === ' ' || k === 'enter')) { placeNow(); return; }
    keys.add(k);
    if (e.repeat) return;
    if (k === 'e') use();
    else if (k === 'b') openBuild();
    else if (k === 'q') cycleOrder();
    else if (k === 't') taunt();
    else if (k === '1' || k === 'f') send({ t: 'eat' });
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  const onBlur = () => { keys.clear(); mouseAtk = false; touchAtk = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
  canvas.addEventListener('mousedown', (e) => {
    unlockAudio();
    if (touch) return;
    if (placing) { if (e.button === 2) cancelPlace(); else placeNow(); return; }
    if (e.button === 0) mouseAtk = true;
  });
  window.addEventListener('mouseup', () => { mouseAtk = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // phone stick and buttons
  const stickEl = $('.kb-stick'), knob = stickEl.querySelector('i')!;
  let stickId: number | null = null;
  const stickMove = (t: Touch) => {
    const r = stickEl.getBoundingClientRect();
    let x = (t.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    stick = { x, y };
    knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };
  stickEl.addEventListener('touchstart', (e) => { e.preventDefault(); unlockAudio(); const t = e.changedTouches[0]; stickId = t.identifier; stickMove(t); }, { passive: false });
  stickEl.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === stickId) stickMove(t); }, { passive: false });
  const stickEnd = (e: TouchEvent) => { for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; stick = { x: 0, y: 0 }; knob.style.transform = ''; } };
  stickEl.addEventListener('touchend', stickEnd); stickEl.addEventListener('touchcancel', stickEnd);
  root.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => {
    const t = b.dataset.t!;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault(); unlockAudio();
      if (t === 'atk') { if (placing) placeNow(); else touchAtk = true; }
      else if (t === 'use') use();
      else if (t === 'build') openBuild();
      else if (t === 'eat') send({ t: 'eat' });
      else if (t === 'taunt') taunt();
      else if (t === 'order') cycleOrder();
    }, { passive: false });
    if (t === 'atk') { const off = () => { touchAtk = false; }; b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); }
  });
  $('[data-b="build"]').onclick = () => openBuild();
  orderBtn.onclick = () => cycleOrder();
  tauntBtn.onclick = () => taunt();
  $('[data-b="menu"]').onclick = () => openMenu();
  const drawMute = () => { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; };
  muteBtn.onclick = () => { setMuted(!isMuted()); drawMute(); };
  drawMute();
  $('[data-p="ok"]').onclick = () => placeNow();
  $('[data-p="no"]').onclick = () => cancelPlace();

  function cycleOrder() {
    if (!mine || mine.ghost) return;
    const o = ORDERS[(ORDERS.indexOf(mine.order) + 1) % ORDERS.length];
    send({ t: 'order', o });
    toast(`Your army: ${ORDER_TEXT[o]}`);
    play('click');
  }
  function taunt() { send({ t: 'taunt' }); }

  // ---------- using things ----------
  /** The building next to you that you can use, if any. */
  function nearBuilding(): number {
    const hp = heroPos();
    if (!ren || !hp || !mine || mine.ghost) return 0;
    let best = 0, bd = Infinity;
    for (const b of ren.buildings()) {
      const kind = BKINDS[b.kind];
      if (b.team !== myTeam) continue;
      if (kind === 'heart') continue;
      if (kind !== 'castle' && b.owner !== me) continue;
      const st = BUILD[kind];
      const x0 = b.tx * TILE, x1 = (b.tx + st.w) * TILE, y0 = b.ty * TILE, y1 = (b.ty + st.h) * TILE;
      const d = Math.hypot(Math.max(x0 - hp.x, 0, hp.x - x1), Math.max(y0 - hp.y, 0, hp.y - y1));
      const reach = kind === 'castle' ? 2 * TILE : 0.9 * TILE;
      if (d < reach && d < bd) { bd = d; best = b.id; }
    }
    return best;
  }
  function use() {
    const id = nearBuilding();
    if (!id || !ren) return;
    const b = ren.building(id)!;
    play('click');
    if (BKINDS[b.kind] === 'castle') openCastle(); else openBuildingPanel(id);
  }

  // ---------- panels ----------
  function openPanel(html: string, bind: () => void) {
    panel.innerHTML = html;
    dim.hidden = false;
    keys.clear();
    bind();
  }
  function closePanel() { dim.hidden = true; panel.innerHTML = ''; panelKind = ''; }
  let panelKind = '';
  dim.onclick = (e) => { if (e.target === dim && !ended) closePanel(); };
  const gold = () => mine?.gold ?? 0;
  const icon = (k: string) => `<img class="kb-ico" src="${artUrl(`ui/${k}`)}" alt="">`;

  function openCastle() {
    panelKind = 'castle';
    const p = mine; if (!p) return;
    const next = ARMOR[p.armor + 1];
    let n = 0;
    openPanel(`
      <h2>🏰 Castle</h2>
      <p class="kb-sub">You have ${icon('gold')}<b>${gold()}</b> gold and ${icon('meat')}<b>${p.meat}</b> meat.</p>
      <h3>Change class · ${CLASS_PRICE} gold</h3>
      <div class="kb-list">${CLASSES.map((c) => `
        <button class="kb-item${p.cls === c ? ' on' : ''}" data-n="${++n}" data-cls="${c}" ${p.cls === c ? 'disabled' : ''}>
          <span class="kb-face" style="background-image:url(${artUrl(`units/${myTeam ? 'red' : 'blue'}/${c === 'knight' ? 'warrior' : c}_idle`)})"></span>
          <b>${CLASS_ICON[c]} ${CLASS[c].name}${p.cls === c ? ' (you)' : ''}</b><small>${CLASS[c].desc} ${CLASS[c].hp} health.</small>
        </button>`).join('')}</div>
      <h3>Armor</h3>
      <div class="kb-list">
        <button class="kb-item" data-n="${++n}" data-a="armor" ${!next ? 'disabled' : ''}>
          <span class="kb-big">🛡️</span><b>${next ? next.name : ARMOR[p.armor].name}</b>
          <small>${next ? `Take ${Math.round(next.cut * 100)}% less damage. Now: ${ARMOR[p.armor].name}${p.armor ? ` (${Math.round(ARMOR[p.armor].cut * 100)}%)` : ''}.` : 'You have the best armor.'}</small>
          ${next ? `<span class="kb-cost">${icon('gold')}${next.price}</span>` : ''}
        </button>
        <button class="kb-item" data-n="${++n}" data-a="meat"><span class="kb-big">🍖</span><b>3 meat</b><small>Eat with 1 (or 🍖) to heal ${MEAT_HEAL}.</small><span class="kb-cost">${icon('gold')}${MEAT_PRICE}</span></button>
      </div>
      <button class="kb-btn ghost" data-a="close">Close</button>`, () => {
      panel.querySelectorAll<HTMLElement>('[data-cls]').forEach((b) => b.onclick = () => { send({ t: 'class', cls: b.dataset.cls as typeof CLASSES[number] }); play('train'); later(openCastle); });
      panel.querySelector<HTMLElement>('[data-a="armor"]')!.onclick = () => { send({ t: 'armor' }); play('build'); later(openCastle); };
      panel.querySelector<HTMLElement>('[data-a="meat"]')!.onclick = () => { send({ t: 'meat' }); play('coin'); later(openCastle); };
      panel.querySelector<HTMLElement>('[data-a="close"]')!.onclick = closePanel;
    });
  }
  /** Redraw a panel once the host has had a moment to apply the purchase. */
  const later = (f: () => void) => setTimeout(() => { if (!dim.hidden) f(); }, game ? 30 : 160);

  function openBuildingPanel(id: number) {
    panelKind = 'bld';
    const b = ren?.building(id); if (!b || !mine) { closePanel(); return; }
    const kind = BKINDS[b.kind], st = BUILD[kind];
    let n = 0;
    openPanel(`
      <h2>${st.name}</h2>
      <p class="kb-sub">${st.desc} You have ${icon('gold')}<b>${gold()}</b> · Army ${mine.army}/${mine.cap}</p>
      ${st.trains.length ? `<div class="kb-list">${st.trains.map((u) => `
        <button class="kb-item" data-n="${++n}" data-train="${u}">
          <span class="kb-face" style="background-image:url(${artUrl(`units/${myTeam ? 'red' : 'blue'}/${u === 'lancer' ? 'lancer' : u}_idle`)})"></span>
          <b>${UNIT[u].name}</b><small>${UNIT[u].desc}</small><span class="kb-cost">${icon('gold')}${UNIT[u].cost}</span>
        </button>`).join('')}</div>` : ''}
      <button class="kb-btn red" data-n="${++n}" data-a="sell">Sell for ${Math.floor(st.cost / 2)} gold</button>
      <button class="kb-btn ghost" data-a="close">Close</button>`, () => {
      panel.querySelectorAll<HTMLElement>('[data-train]').forEach((x) => x.onclick = () => { send({ t: 'train', bid: id, kind: x.dataset.train as 'warrior' }); play('train'); later(() => openBuildingPanel(id)); });
      panel.querySelector<HTMLElement>('[data-a="sell"]')!.onclick = () => { send({ t: 'sell', bid: id }); play('coin'); closePanel(); };
      panel.querySelector<HTMLElement>('[data-a="close"]')!.onclick = closePanel;
    });
  }

  function openBuild() {
    if (!mine || mine.ghost || ended) return;
    panelKind = 'build';
    let n = 0;
    const pic = (k: BKind) => k === 'wall' ? '<span class="kb-wallpic"></span>' : k === 'goldblock' ? '<span class="kb-goldpic">∞</span>'
      : `<img src="${artUrl(`buildings/${myTeam ? 'red' : 'blue'}/${k === 'house' ? 'house1' : k}`)}" alt="">`;
    openPanel(`
      <h2>🔨 Build</h2>
      <p class="kb-sub">You have ${icon('gold')}<b>${gold()}</b>. Build on your own side of the field.</p>
      <div class="kb-list">${BUILDABLE.map((k) => `
        <button class="kb-item${gold() < BUILD[k].cost ? ' poor' : ''}" data-n="${++n}" data-k="${k}">
          ${pic(k)}<b>${BUILD[k].name}</b><small>${BUILD[k].desc}</small><span class="kb-cost">${icon('gold')}${BUILD[k].cost}</span>
        </button>`).join('')}</div>
      <p class="kb-sub">No sheep farm in this game: hit the wild sheep in the middle for meat.</p>
      <button class="kb-btn ghost" data-a="close">Close</button>`, () => {
      panel.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.onclick = () => {
        const k = b.dataset.k as BKind;
        if (gold() < BUILD[k].cost) { play('no'); toast(`You need ${BUILD[k].cost} gold.`, true); return; }
        closePanel(); placing = k; placeBar.hidden = !touch;
        toast(touch ? 'Walk to the spot and tap Place.' : 'Click where it goes. Right-click or Esc cancels.');
      });
      panel.querySelector<HTMLElement>('[data-a="close"]')!.onclick = closePanel;
    });
  }

  function ghostSpot(): { kind: BKind; tx: number; ty: number; ok: boolean } | null {
    if (!placing || !ren) return null;
    const st = BUILD[placing];
    let wx: number, wy: number;
    const hp = heroPos();
    if (!touch && mouse) { const w = ren.toWorld(mouse.x, mouse.y); wx = w.x; wy = w.y; }
    else if (hp) { const ahead = myTeam === 0 ? -1 : 1; wx = hp.x + lastAim.x * 90; wy = hp.y + (lastAim.y || ahead) * 90; }
    else return null;
    // the mouse points at the middle of the building
    const tx = Math.round(wx / TILE - st.w / 2), ty = Math.round(wy / TILE - st.h / 2);
    return { kind: placing, tx, ty, ok: canPlaceHere(placing, tx, ty) };
  }
  function canPlaceHere(kind: BKind, tx: number, ty: number) {
    if (!ren || !snap) return false;
    const st = BUILD[kind], H = snap.H, W = snap.W;
    if (tx < 1 || ty < 1 || tx + st.w > W - 1 || ty + st.h > H - 1) return false;
    if (myTeam === 0 ? ty < H / 2 + 1 : ty + st.h > H / 2 - 1) return false;
    for (const b of ren.buildings()) {
      const s2 = BUILD[BKINDS[b.kind]];
      if (tx < b.tx + s2.w && tx + st.w > b.tx && ty < b.ty + s2.h && ty + st.h > b.ty) return false;
    }
    for (const r of snap.rocks) if (r[1] >= tx && r[1] < tx + st.w && r[2] >= ty && r[2] < ty + st.h) return false;
    return true;
  }
  function placeNow() {
    const g = ghostSpot();
    if (!g || !placing) return;
    if (!g.ok) { play('no'); toast('Can’t build there.', true); return; }
    if (gold() < BUILD[placing].cost) { play('no'); toast(`You need ${BUILD[placing].cost} gold.`, true); cancelPlace(); return; }
    send({ t: 'build', kind: placing, tx: g.tx, ty: g.ty });
    play('build');
    // walls and gold blocks keep going so you can lay a line
    if (placing !== 'wall' && placing !== 'goldblock') cancelPlace();
  }
  function cancelPlace() { placing = null; placeBar.hidden = true; }

  function openMenu() {
    panelKind = 'menu';
    openPanel(`
      <h2>⚔️ Knight Battle</h2>
      <button class="kb-btn" data-a="resume">▶ Keep playing</button>
      <button class="kb-btn blue" data-a="help">❓ How to play</button>
      <button class="kb-btn red" data-a="leave">🚪 Leave the battle</button>`, () => {
      panel.querySelector<HTMLElement>('[data-a="resume"]')!.onclick = closePanel;
      panel.querySelector<HTMLElement>('[data-a="help"]')!.onclick = () => openPanel(HELP + '<button class="kb-btn" data-a="back">Back</button>', () => { panel.querySelector<HTMLElement>('[data-a="back"]')!.onclick = openMenu; });
      panel.querySelector<HTMLElement>('[data-a="leave"]')!.onclick = () => match.quit();
    });
  }

  // ---------- messages ----------
  const toastList: HTMLElement[] = [];
  function toast(text: string, bad = false) {
    const el = document.createElement('div');
    el.className = `kb-toast${bad ? ' bad' : ''}`;
    el.textContent = text;
    toastsEl.appendChild(el);
    toastList.push(el);
    if (toastList.length > 4) toastList.shift()!.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => { el.remove(); const i = toastList.indexOf(el); if (i >= 0) toastList.splice(i, 1); }, 3300);
    if (bad) play('no');
  }

  match.onMsg((from, m: ToHost | ToFriend) => {
    if (game) {
      const msg = m as ToHost;
      if (msg.t === 'in') {
        const i = msg.i;
        game.inputs.set(from, { mx: clampN(i.mx), my: clampN(i.my), ax: +i.ax || 0, ay: +i.ay || 0, atk: !!i.atk });
      } else if (msg.t === 'cmd') {
        const err = game.cmd(from, msg.c);
        if (err) match.sendTo(from, { t: 'err', m: err } satisfies ToFriend);
      }
    } else {
      const msg = m as ToFriend;
      if (msg.t === 's') applySnap(msg.s, true);
      else if (msg.t === 'err') toast(msg.m, true);
    }
  });
  match.onJoin((p) => { game?.addLate(p); });
  match.onLeave((slot) => {
    if (game) game.removePlayer(slot);
    else if (slot === 0 && !ended) { hostGone = true; showEnd('The host left the battle.'); }
  });

  // ---------- snapshots ----------
  let lastHp = -1, wasDead = false, wasGhost = false, lastEnch: string | null = null;
  const seenTaunts = new Map<number, number>();
  function applySnap(s: Snap, smooth: boolean) {
    if (!ren) {
      const p = s.ps.find((q) => q.slot === me);
      if (p) myTeam = p.team;
      makeRenderer(s.W, s.H);
    }
    snap = s;
    ren!.push(s, performance.now(), smooth);
    mine = s.ps.find((p) => p.slot === me) ?? null;
    for (const t of s.say) toast(t);
    for (const [slot, text] of s.note) if (slot === me) toast(text);
    // sounds for things near the camera
    for (const f of s.fx) {
      const v = ren!.onScreen(f[1], f[2]) ? 1 : 0.2;
      const kind = f[0];
      if (kind === 0) play('boom', v);
      else if (kind === 2) play('heal', v * 0.7);
      else if (kind === 3) play('zap', v);
      else if (kind === 4) play('freeze', v);
      else if (kind === 6) play('poison', v * 0.5);
      else if (kind === 7) play('hit', v * 0.8);
      else if (kind === 8) play('coin', v);
      else if (kind === 9) play('eat', v);
      else if (kind === 10) play('box');
      else if (kind === 11) play('swing', v);
    }
    for (const p of s.ps) {
      if (p.tauntAt > 0 && seenTaunts.get(p.slot) !== p.tauntAt) {
        seenTaunts.set(p.slot, p.tauntAt);
        const h = ren!.ent(p.hero);
        if (h && (p.slot === me || ren!.onScreen(h.x, h.y))) play('taunt');
      }
    }
    if (mine) {
      const h = ren!.ent(mine.hero);
      const dead = !h && !mine.ghost;
      if (h && lastHp >= 0 && h.hp < lastHp && !(h.flags & 16)) play('hurt', 0.6);
      lastHp = h ? h.hp : -1;
      if (dead && !wasDead) toast('Knocked out!', true);
      wasDead = dead;
      if (mine.ghost && !wasGhost) { play('ghost'); toast('Your heart is broken. You’re a ghost now: watch the chaos!'); }
      wasGhost = mine.ghost;
      if (mine.ench && mine.ench !== lastEnch) toast(`${ENCH[mine.ench].icon} ${ENCH[mine.ench].name}: ${ENCH[mine.ench].desc}`);
      lastEnch = mine.ench;
    }
    if (s.over >= 0 && !ended) {
      const won = s.over === myTeam;
      play(won ? 'win' : 'lose');
      showEnd(won ? `🏆 ${TEAM_NAMES[s.over]} team wins! You won!` : `${TEAM_NAMES[s.over]} team wins.`);
    }
  }

  function showEnd(text: string) {
    ended = true;
    cancelPlace();
    const list = snap ? [...snap.ps].sort((a, b) => b.kills - a.kills) : [];
    openPanel(`
      <h2>${esc(text)}</h2>
      ${list.length ? `<div class="kb-score">${list.map((p) => `<div style="--c:${RING[p.team]}"><b>${esc(p.name)}</b><span>${p.kills} knockouts</span></div>`).join('')}</div>` : ''}
      <button class="kb-btn" data-a="leave">Back to 2p Games</button>`, () => {
      panel.querySelector<HTMLElement>('[data-a="leave"]')!.onclick = () => match.quit();
    });
    void hostGone;
  }

  // ---------- HUD ----------
  let hudKey = '';
  function drawHud(now: number) {
    if (!snap || !mine) return;
    const p = mine;
    const h = ren?.ent(p.hero);
    const box = snap.box[0] === 0 ? `🎁 ${fmtTime(snap.next)}` : snap.box[0] === 1 ? '🎁 Falling!' : '🎁 In the middle!';
    const key = `${p.gold}|${p.meat}|${p.armor}|${p.cls}|${p.ench}|${Math.ceil(snap.next)}|${snap.box[0]}|${p.army}|${p.cap}|${Math.floor(snap.t)}`;
    if (key !== hudKey) {
      hudKey = key;
      resEl.innerHTML = `<span>${icon('gold')}${p.gold}</span><span>${icon('meat')}${p.meat}</span><span title="Armor">🛡️${p.armor ? Math.round(ARMOR[p.armor].cut * 100) + '%' : '–'}</span>
        <span title="Army">⚔️${p.army}/${p.cap}</span><span class="kb-time">${box}</span><span class="kb-time">⏱ ${fmtTime(snap.t)}</span>`;
      orderBtn.innerHTML = `${ORDER_TEXT[p.order]} <kbd>Q</kbd>`;
      const hearts = snap.b.filter((b) => BKINDS[b[1]] === 'heart');
      const owners = snap.ps;
      heartsEl.innerHTML = [0, 1].map((team) => `<div class="kb-team t${team}">${owners.filter((q) => q.team === team && q.heart).map((q) => {
        const hb = hearts.find((b) => b[0] === q.heart);
        const hp = hb ? hb[5] : 0;
        return `<span class="${hp ? '' : 'broken'}" title="${esc(q.name)}">${hp ? '❤️' : '💔'}<b>${esc(q.name)}</b><i><u style="width:${hp / 10}%"></u></i></span>`;
      }).join('')}</div>`).join('');
    }
    // hero card
    const respawn = !h && !p.ghost ? Math.ceil(p.respawn) : 0;
    heroEl.innerHTML = p.ghost ? '<div class="kb-ghost">👻 You’re a ghost. Fly around and watch the chaos (T still taunts).</div>'
      : respawn ? `<div class="kb-ghost">Knocked out! Back at your heart in ${respawn}…</div>`
      : `<div class="kb-card"><span class="kb-cls">${CLASS_ICON[p.cls]} ${CLASS[p.cls].name}</span>${p.ench ? `<span class="kb-ench">${ENCH[p.ench].icon} ${ENCH[p.ench].name}</span>` : ''}
          <span class="kb-hp"><i style="width:${h?.hp ?? 0}%"></i></span></div>`;
    // taunt glows when an enemy hero is on screen
    let see = false;
    if (ren) for (const e of ren.ents()) if (UKINDS[e.kind] === 'hero' && e.team !== myTeam && !(e.flags & 16) && ren.onScreen(e.x, e.y)) { see = true; break; }
    tauntBtn.classList.toggle('glow', see);
    root.querySelector('[data-t="taunt"]')?.classList.toggle('glow', see);
    // hint over the building you can use
    const nb = nearBuilding();
    if (nb && ren && !panelOpen() && !placing) {
      const b = ren.building(nb)!;
      const kind = BKINDS[b.kind];
      const sp = ren.toScreen(b.x, b.y - BUILD[kind].h * TILE / 2);
      hintEl.hidden = false;
      hintEl.textContent = `${touch ? '✋' : 'E'}: ${kind === 'castle' ? 'Change class, armor, meat' : kind === 'wall' || kind === 'goldblock' ? `Sell ${BUILD[kind].name}` : BUILD[kind].name}`;
      hintEl.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -100%)`;
    } else hintEl.hidden = true;
    bannerEl.hidden = !(snap.box[0] === 1);
    if (snap.box[0] === 1) bannerEl.textContent = '🎁 A mystery box is falling in the middle!';
    void now;
  }

  function overlay(now: number): Overlay {
    const names = new Map<number, { name: string; slot: number }>();
    const taunts = new Map<number, { text: string; age: number }>();
    const hearts = new Map<number, { owner: string; team: number }>();
    if (snap) for (const p of snap.ps) {
      names.set(p.hero, { name: p.name, slot: p.slot });
      if (p.heart) hearts.set(p.heart, { owner: p.name, team: p.team });
      const age = snap.t - p.tauntAt + (now - lastSnapAt) / 1000;
      if (p.tauntAt > 0 && age < 2.2) taunts.set(p.hero, { text: TAUNTS[p.taunt], age });
    }
    return { me, myHero: mine?.hero ?? 0, ghost: ghostSpot(), near: placing ? 0 : nearBuilding(), names, taunts, hearts };
  }

  // ---------- the loop ----------
  let raf = 0, last = performance.now(), acc = 0, snapAcc = 0, sendAcc = 0, lastSnapAt = performance.now();
  const onResize = () => ren?.resize();
  window.addEventListener('resize', onResize);
  const loop = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game) {
      game.inputs.set(me, input());
      acc += dt;
      while (acc >= TICK) { game.step(TICK); acc -= TICK; snapAcc += TICK; }
      if (snapAcc >= SNAP_EVERY) {
        snapAcc = 0;
        const s = game.snapshot();
        match.broadcast({ t: 's', s } satisfies ToFriend);
        applySnap(s, true);
        lastSnapAt = now;
      }
    } else {
      sendAcc += dt;
      if (sendAcc >= 0.05) { sendAcc = 0; if (!ended) match.send({ t: 'in', i: input() } satisfies ToHost); }
    }
    if (!ren || !artReady) return;
    const hp = heroPos();
    const focus = hp ?? (mine ? (() => { const hb = ren.building(mine.heart); return hb ? { x: hb.x, y: hb.y } : { x: ren.W * TILE / 2, y: ren.H * TILE / 2 }; })() : { x: ren.W * TILE / 2, y: ren.H * TILE / 2 });
    ren.draw(now, overlay(now), focus);
    ren.minimap(mini, mine?.hero ?? 0);
    drawHud(now);
  };
  // friends note when snapshots arrive, for taunt timing
  if (!game) match.onMsg((_f, m) => { if ((m as ToFriend).t === 's') lastSnapAt = performance.now(); });
  raf = requestAnimationFrame(loop);
  if (!match.host || match.players.length) setTimeout(() => toast(myTeam === 0 ? 'You’re on the blue team. Protect your heart!' : 'You’re on the red team. Protect your heart!'), 600);
  void panelKind;

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    root.innerHTML = '';
  };
}

const clampN = (v: unknown) => Math.max(-1, Math.min(1, Number(v) || 0));
