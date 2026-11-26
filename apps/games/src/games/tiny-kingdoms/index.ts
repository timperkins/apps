// Tiny Kingdoms: title screen, controls, menus, the HUD and playing together.
import './style.css';
import type { GameModule } from '../types';
import { coopBadge, coopMenu, every } from '../coop/ui';
import type { FriendSession, HostSession, Session } from '../coop/session';
import { isMuted, play, setMuted, unlockAudio } from './audio';
import {
  BUILD, BUILDABLE, BUILD_KINDS, CASTLE_AT, COLOR_NAMES, Game, TILE, UNIT, plotSpots,
  type BuildKind, type Cost, type Difficulty, type Input, type Order, type Res, type Snap, type UnitKind,
} from './game';
import { Renderer, artUrl, loadArt, type Overlay } from './render';

const COOP_PREFIX = 'trom-tiny-kingdoms-';
const ORDERS: Order[] = ['follow', 'defend', 'attack'];
const ORDER_TEXT: Record<Order, string> = { follow: 'Follow me', defend: 'Guard castle', attack: 'Attack!' };
const ORDER_ICON: Record<Order, string> = { follow: '🚩', defend: '🛡️', attack: '⚔️' };

type ToHost =
  | { t: 'in'; mx: number; my: number; atk: boolean; guard: boolean }
  | { t: 'build'; plot: number; kind: BuildKind }
  | { t: 'train'; bid: number; kind: UnitKind }
  | { t: 'order'; o: Order };
type ToFriend =
  | { t: 'init'; seed: number; diff: Difficulty; nodes: { trees: number[][]; golds: number[][] } }
  | { t: 's'; s: Snap }
  | { t: 'err'; m: string };

const icon = (r: string) => `<img class="tk-ico" src="${artUrl(`ui/${r}`)}" alt="${r}">`;
const costHtml = (c: Cost) => (Object.keys(c) as Res[]).map(r => `<span class="tk-cost">${icon(r)}${c[r]}</span>`).join('');
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const HELP = `
  <h2>How to play</h2>
  <p>You are the hero of a little kingdom. The <b>Black kingdom</b> in the middle of the island sends bigger and bigger attacks at your castle. Grow strong, then march in and knock down the Black castle to win.</p>
  <ul>
    <li>${icon('wood')} ${icon('gold')} ${icon('meat')} Your <b>pawns</b> chop trees, mine gold and catch sheep by themselves. You can chop, mine and catch sheep with your sword too.</li>
    <li>${icon('hammer')} Walk onto an empty spot by your castle and press <kbd>E</kbd> to <b>build</b>: houses (room for more units), barracks, an archery range, towers and a monastery.</li>
    <li>${icon('sword')} Walk up to a building and press <kbd>E</kbd> to <b>train</b>: pawns at the castle, warriors and lancers at the barracks, archers at the archery range, monks (healers) at the monastery.</li>
    <li>🚩 Tell your army what to do with <kbd>Q</kbd>: <b>Follow me</b>, <b>Guard castle</b> or <b>Attack!</b> (march on the Black castle).</li>
    <li>${icon('shield')} Hold <kbd>Shift</kbd> to block with your shield: you take a quarter of the damage.</li>
  </ul>
  <h3>Keys</h3>
  <p><kbd>WASD</kbd>/arrows walk · <kbd>Space</kbd> or click swing · <kbd>Shift</kbd> block · <kbd>E</kbd> build or train · <kbd>Q</kbd> army order · <kbd>Esc</kbd> menu. Phones get a stick and buttons.</p>
  <p>👥 <b>Play together</b>: up to 4 players, each with their own kingdom in a corner of the island. Press <kbd>Esc</kbd> → Play with friends to get a code; friends pick Join a friend on the title screen.</p>
  <p class="tk-credit">Art: <a href="https://pixelfrog-assets.itch.io/tiny-swords" target="_blank" rel="noopener">Tiny Swords</a> by Pixel Frog.</p>`;

const game: GameModule = {
  mount(root, { onExit }) {
    root.innerHTML = `
    <div class="tk">
      <canvas class="tk-canvas"></canvas>
      <div class="tk-top">
        <div class="tk-res"></div>
        <div class="tk-wave"></div>
      </div>
      <div class="tk-side">
        <canvas class="tk-mini" width="216" height="144"></canvas>
        <button class="tk-order" data-b="order"></button>
      </div>
      <div class="tk-btns">
        <button data-b="mute" title="Sound"></button>
        <button data-b="menu" title="Menu (Esc)">☰</button>
      </div>
      <div class="tk-hero"></div>
      <div class="tk-toasts"></div>
      <div class="tk-hint" hidden></div>
      <div class="tk-touch">
        <div class="tk-stick"><i></i></div>
        <div class="tk-tbtns">
          <button data-t="atk" class="big">⚔️<span>Swing</span></button>
          <button data-t="use">✋<span>Use</span></button>
          <button data-t="guard">🛡️<span>Block</span></button>
          <button data-t="order">🚩<span>Army</span></button>
        </div>
      </div>
      <div class="tk-dim tk-panel-wrap" hidden><div class="tk-panel"></div></div>
      <div class="tk-title"></div>
    </div>`;
    const $ = <E extends HTMLElement>(s: string) => root.querySelector<E>(s)!;
    const wrap = $('.tk');
    const canvas = $<HTMLCanvasElement>('.tk-canvas');
    const mini = $<HTMLCanvasElement>('.tk-mini');
    const resEl = $('.tk-res'), waveEl = $('.tk-wave'), heroEl = $('.tk-hero'), toastsEl = $('.tk-toasts'), hintEl = $('.tk-hint');
    const orderBtn = $('.tk-order'), muteBtn = $('[data-b="mute"]');
    const panelWrap = $('.tk-panel-wrap'), panel = $('.tk-panel'), titleEl = $('.tk-title');
    const touchMode = matchMedia('(pointer: coarse)').matches;
    wrap.classList.toggle('touch', touchMode);

    let g: Game | null = null;
    let ren: Renderer | null = null;
    let me = 0;
    let playing = false, paused = false, stopped = false, ended = false;
    let raf = 0, last = performance.now();
    let net: Session | null = null;
    let lastSnap: Snap | null = null;
    let artReady = false;
    const artLoad = loadArt().then(() => { artReady = true; });

    // ---------- input ----------
    const keys = new Set<string>();
    let stick = { x: 0, y: 0 }, touchAtk = false, touchGuard = false, mouseAtk = false;
    const input = (): Input => {
      let mx = stick.x, my = stick.y;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      const m = Math.hypot(mx, my);
      if (m > 1) { mx /= m; my /= m; }
      const blocking = keys.has('shift') || keys.has('k') || touchGuard;
      return { mx, my, atk: !panelOpen() && (keys.has(' ') || keys.has('j') || touchAtk || mouseAtk), guard: blocking };
    };
    const panelOpen = () => !panelWrap.hidden;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!playing) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { e.preventDefault(); if (panelOpen()) closePanel(); else openPause(); return; }
      if (panelOpen()) {
        // number keys pick from the open menu
        const n = Number(k);
        if (n >= 1 && n <= 9) panel.querySelectorAll<HTMLButtonElement>('[data-pick]')[n - 1]?.click();
        if (k === 'e') closePanel();
        return;
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (k === 'e' && !e.repeat) use();
      if (k === 'q' && !e.repeat) cycleOrder();
      if (k === '1' || k === '2' || k === '3') setOrder(ORDERS[Number(k) - 1]);
      keys.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => { keys.clear(); mouseAtk = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', e => { if (!touchMode && e.button === 0) mouseAtk = true; unlockAudio(); });
    const onPointerUp = () => { mouseAtk = false; };
    window.addEventListener('pointerup', onPointerUp);

    // touch stick and buttons
    const stickEl = $('.tk-stick'), knob = stickEl.querySelector('i')!;
    let stickId = -1, sx0 = 0, sy0 = 0;
    stickEl.addEventListener('pointerdown', e => { stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId); const r = stickEl.getBoundingClientRect(); sx0 = r.left + r.width / 2; sy0 = r.top + r.height / 2; moveStick(e); unlockAudio(); });
    const moveStick = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      let dx = e.clientX - sx0, dy = e.clientY - sy0;
      const m = Math.hypot(dx, dy), max = 46;
      if (m > max) { dx *= max / m; dy *= max / m; }
      stick = { x: dx / max, y: dy / max };
      if (Math.hypot(stick.x, stick.y) < 0.15) stick = { x: 0, y: 0 };
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stickEl.addEventListener('pointermove', moveStick);
    const endStick = (e: PointerEvent) => { if (e.pointerId !== stickId) return; stickId = -1; stick = { x: 0, y: 0 }; knob.style.transform = ''; };
    stickEl.addEventListener('pointerup', endStick);
    stickEl.addEventListener('pointercancel', endStick);
    root.querySelectorAll<HTMLButtonElement>('[data-t]').forEach(b => {
      const t = b.dataset.t;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); unlockAudio();
        if (t === 'atk') touchAtk = true;
        if (t === 'guard') touchGuard = true;
        if (t === 'use') use();
        if (t === 'order') cycleOrder();
      });
      const up = () => { if (t === 'atk') touchAtk = false; if (t === 'guard') touchGuard = false; };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    orderBtn.addEventListener('click', () => cycleOrder());
    muteBtn.addEventListener('click', () => { setMuted(!isMuted()); muteBtn.textContent = isMuted() ? '🔇' : '🔊'; });
    muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    $('[data-b="menu"]').addEventListener('click', () => openPause());

    // ---------- toasts ----------
    const toast = (m: string) => {
      const el = document.createElement('div');
      el.className = 'tk-toast';
      el.textContent = m;
      toastsEl.appendChild(el);
      while (toastsEl.children.length > 4) toastsEl.firstElementChild?.remove();
      setTimeout(() => el.classList.add('out'), 3500);
      setTimeout(() => el.remove(), 4200);
    };

    // ---------- what's around me ----------
    const myKingdom = () => lastSnap?.k.find(k => k.s === me);
    const myHero = () => { const k = myKingdom(); return k && ren ? ren.ent(k.h) : undefined; };
    const nearThings = () => {
      const k = myKingdom(), h = myHero();
      const res: { plot: number; building: number } = { plot: -1, building: 0 };
      if (!k || !h || !ren) return res;
      const [cx, cy] = CASTLE_AT[me];
      const spots = plotSpots(cx, cy);
      let bd = 150;
      spots.forEach(([x, y], i) => {
        const occupied = k.p[i] && ren!.ent(k.p[i]);
        const d = Math.hypot(h.x - x * TILE, h.y - (y * TILE - 50));
        if (!occupied && d < bd) { bd = d; res.plot = i; }
      });
      if (res.plot >= 0) return res;
      let bb = 230;
      for (const e of ren.ents()) {
        if (e.kind < 100 || e.team !== me) continue;
        const kind = BUILD_KINDS[e.kind - 100];
        if (!BUILD[kind].trains.length) continue;
        const d = Math.hypot(h.x - e.x, h.y - (e.y - 20));
        if (d < bb) { bb = d; res.building = e.id; }
      }
      return res;
    };

    // ---------- commands (the host runs them, friends send them) ----------
    const sendHost = (m: ToHost) => { if (net?.role === 'friend') net.send(m); };
    const fail = (m: string | null) => { if (m) { toast(m); play('no'); } };
    const doBuild = (plot: number, kind: BuildKind) => { if (net?.role === 'friend') sendHost({ t: 'build', plot, kind }); else if (g) fail(g.build(me, plot, kind)); };
    const doTrain = (bid: number, kind: UnitKind) => { if (net?.role === 'friend') sendHost({ t: 'train', bid, kind }); else if (g) fail(g.train(me, bid, kind)); };
    const setOrder = (o: Order) => {
      if (net?.role === 'friend') sendHost({ t: 'order', o }); else g?.setOrder(me, o);
      toast(`Army: ${ORDER_TEXT[o]}`);
      orderBtn.innerHTML = `${ORDER_ICON[o]} ${ORDER_TEXT[o]}`;
    };
    const cycleOrder = () => { const k = myKingdom(); if (!k) return; setOrder(ORDERS[(ORDERS.indexOf(k.o) + 1) % 3]); };

    // ---------- build and train menus ----------
    let panelKind: 'build' | 'train' | 'pause' | 'end' | 'help' | '' = '';
    let panelFor = 0;
    const closePanel = () => { panelWrap.hidden = true; panelKind = ''; if (!net) paused = false; };
    const showPanel = (html: string, kind: typeof panelKind) => {
      panel.innerHTML = html;
      panelWrap.hidden = false;
      panelKind = kind;
      keys.clear(); touchAtk = false; mouseAtk = false;
    };
    const stockOk = (c: Cost) => { const k = myKingdom(); return !!k && (Object.keys(c) as Res[]).every(r => ({ gold: k.g, wood: k.w, meat: k.m })[r] >= (c[r] ?? 0)); };
    const use = () => {
      if (!playing || panelOpen()) return;
      const n = nearThings();
      if (n.plot >= 0) openBuild(n.plot);
      else if (n.building) openTrain(n.building);
      else toast('Walk onto a building spot (hammer) or up to your castle or barracks.');
    };
    const openBuild = (plot: number) => {
      panelFor = plot;
      showPanel(`<h2>${icon('hammer')} Build</h2><div class="tk-list">${BUILDABLE.map((b, i) => {
        const s = BUILD[b];
        return `<button class="tk-item" data-pick="${b}" ${stockOk(s.cost) ? '' : 'data-poor'}>
          <img src="${artUrl(`buildings/${['blue', 'red', 'yellow', 'purple'][me]}/${b === 'house' ? 'house1' : b}`)}" alt="">
          <b>${i + 1}. ${s.name}</b><small>${s.desc}</small><span class="tk-costs">${costHtml(s.cost)}</span></button>`;
      }).join('')}</div><button class="tk-btn ghost" data-close>Close</button>`, 'build');
    };
    const openTrain = (bid: number) => {
      const e = ren?.ent(bid);
      if (!e) return;
      panelFor = bid;
      const bk = BUILD_KINDS[e.kind - 100], s = BUILD[bk], k = myKingdom();
      const color = ['blue', 'red', 'yellow', 'purple'][me];
      showPanel(`<h2>${s.name}</h2><p class="tk-sub">Room: ${k?.pop ?? 0} / ${k?.cap ?? 0}${(k?.pop ?? 0) >= (k?.cap ?? 0) ? ' · build a house for more' : ''}</p>
        <div class="tk-list">${s.trains.map((u, i) => {
          const st = UNIT[u];
          const file = u === 'monk' ? 'monk_idle' : `${u}_idle`;
          return `<button class="tk-item" data-pick="${u}" ${stockOk(st.cost ?? {}) ? '' : 'data-poor'}>
            <span class="tk-face" style="background-image:url(${artUrl(`units/${color}/${file}`)})"></span>
            <b>${i + 1}. ${st.name}</b><small>${st.desc}</small><span class="tk-costs">${costHtml(st.cost ?? {})}</span></button>`;
        }).join('')}</div><p class="tk-sub">Tap again to train more.</p><button class="tk-btn ghost" data-close>Close</button>`, 'train');
    };
    panel.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) { closePanel(); return; }
      const pick = t.closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (pick && panelKind === 'build') { doBuild(panelFor, pick as BuildKind); closePanel(); return; }
      if (pick && panelKind === 'train') { doTrain(panelFor, pick as UnitKind); setTimeout(() => panelKind === 'train' && openTrain(panelFor), 120); return; }
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act) pauseAction(act);
    });

    // ---------- pause and end ----------
    const openPause = () => {
      if (!playing) return;
      if (!net) paused = true;
      const friend = net?.role === 'friend';
      showPanel(`<h2>Menu</h2>
        <button class="tk-btn" data-act="resume">Keep playing</button>
        ${friend ? '' : `<button class="tk-btn blue" data-act="friends">👥 Play with friends</button>`}
        <button class="tk-btn ghost" data-act="help">How to play</button>
        <button class="tk-btn red" data-act="quit">${friend ? 'Leave the game' : 'Quit to title'}</button>
        ${net ? '<p class="tk-sub">Playing together: the game keeps going while this menu is open.</p>' : ''}`, 'pause');
    };
    const pauseAction = (act: string) => {
      if (act === 'resume') closePanel();
      if (act === 'help') showPanel(`${HELP}<button class="tk-btn" data-act="resume">Got it</button>`, 'help');
      if (act === 'quit' || act === 'title') { closePanel(); toTitle(); }
      if (act === 'again') { const d = g?.diff ?? 'normal'; closePanel(); toTitle(); start(d); }
      if (act === 'friends') {
        closePanel();
        coopMenu(wrap, { title: 'Tiny Kingdoms', prefix: COOP_PREFIX, canJoin: false, onHosted: startHosting });
      }
    };
    const showEnd = (s: Snap) => {
      if (ended) return;
      ended = true;
      const won = s.state === 'won';
      let best = '';
      if (won && g) {
        const key = `tiny-kingdoms-best-${g.diff}`;
        try {
          const old = Number(localStorage.getItem(key) || 0);
          if (!old || s.t < old) { localStorage.setItem(key, String(Math.round(s.t))); best = ' A new best time!'; }
          else best = ` Best: ${fmtTime(old)}.`;
        } catch { /* ignore */ }
      }
      showPanel(`<h2>${won ? '🏆 Victory!' : 'The castles have fallen'}</h2>
        <p class="tk-sub">${won ? `You knocked down the Black castle in ${fmtTime(s.t)}.${best}` : `You held out for ${s.wave} waves (${fmtTime(s.t)}).`}</p>
        ${net?.role === 'friend' ? '' : '<button class="tk-btn" data-act="again">Play again</button>'}
        <button class="tk-btn ghost" data-act="title">Back to the title</button>`, 'end');
    };

    // ---------- playing together ----------
    // the code badge only shows while playing together
    let badge: ReturnType<typeof coopBadge> | null = null;
    const snapRate = every(12), inRate = every(20);
    // things that happen between two snapshots still reach friends
    const pend = { fx: [] as Snap['fx'], snd: [] as Snap['snd'], msg: [] as string[], n: [] as number[][] };
    const refreshBadge = () => {
      if (!net) { badge?.remove(); badge = null; return; }
      badge ??= coopBadge(wrap, { top: 'calc(max(8px, env(safe-area-inset-top)) + 52px)' });
      const slots = lastSnap ? lastSnap.k.map(k => k.s) : [0];
      badge.set(net.code, net.role === 'host' ? [0, ...net.friends()] : slots, me);
    };
    const startHosting = (s: HostSession) => {
      if (!g) return s.close();
      net = s;
      paused = false;
      s.onJoin(slot => {
        if (!g) return;
        g.addKingdom(slot);
        toast(`${COLOR_NAMES[slot]} joined! Their castle is in another corner.`);
        play('train');
        s.send(slot, { t: 'init', seed: g.seed, diff: g.diff, nodes: g.nodes() } satisfies ToFriend);
        refreshBadge();
      });
      s.onLeave(slot => {
        g?.inputs.delete(slot);
        toast(`${COLOR_NAMES[slot]} left. Their kingdom stays.`);
        refreshBadge();
      });
      s.onMessage((slot, raw) => {
        const m = raw as ToHost;
        if (!g || !m || net !== s) return;
        if (m.t === 'in') g.inputs.set(slot, { mx: Math.max(-1, Math.min(1, +m.mx || 0)), my: Math.max(-1, Math.min(1, +m.my || 0)), atk: !!m.atk, guard: !!m.guard });
        else if (m.t === 'build' && BUILDABLE.includes(m.kind)) { const err = g.build(slot, m.plot | 0, m.kind); if (err) s.send(slot, { t: 'err', m: err } satisfies ToFriend); }
        else if (m.t === 'train' && m.kind in UNIT) { const err = g.train(slot, m.bid | 0, m.kind); if (err) s.send(slot, { t: 'err', m: err } satisfies ToFriend); }
        else if (m.t === 'order' && ORDERS.includes(m.o)) g.setOrder(slot, m.o);
      });
      refreshBadge();
      toast(`Friends can join with the code ${s.code}`);
    };
    const startFriend = (s: FriendSession) => {
      net = s;
      me = s.slot;
      titleEl.innerHTML = `<div class="tk-card"><h2>Joining…</h2><p class="tk-sub">Waiting for the host’s island.</p></div>`;
      s.onMessage(raw => {
        const m = raw as ToFriend;
        if (net !== s || !m) return;
        if (m.t === 'init') {
          ren = new Renderer(canvas, m.seed);
          ren.setNodes(m.nodes);
          ren.resize();
          beginPlay();
          refreshBadge();
        } else if (m.t === 's' && ren) {
          const now = performance.now();
          ren.push(m.s, now, true);
          gotSnap(m.s);
        } else if (m.t === 'err') fail(m.m);
      });
      s.onClose(() => {
        if (net !== s) return;
        net = null;
        toTitle();
        toast('The host left the game.');
      });
    };

    const gotSnap = (s: Snap) => {
      const firstMine = !lastSnap?.k.some(k => k.s === me) && s.k.some(k => k.s === me);
      lastSnap = s;
      // sounds near the camera
      if (ren) for (const ev of s.snd) {
        const d = Math.hypot(ev.x - ren.camX, ev.y - ren.camY);
        const loud = ev.s === 'horn' || ev.s === 'win' || ev.s === 'lose';
        play(ev.s, loud ? 1 : Math.max(0, 1 - d / 900));
      }
      for (const m of s.msg) toast(m);
      if (firstMine) { const k = s.k.find(k => k.s === me); if (k) orderBtn.innerHTML = `${ORDER_ICON[k.o]} ${ORDER_TEXT[k.o]}`; refreshBadge(); }
      if (s.state !== 'play') showEnd(s);
    };

    // ---------- title ----------
    const best = (d: Difficulty) => { try { const v = Number(localStorage.getItem(`tiny-kingdoms-best-${d}`) || 0); return v ? ` · best ${fmtTime(v)}` : ''; } catch { return ''; } };
    const showTitle = () => {
      titleEl.hidden = false;
      titleEl.innerHTML = `<div class="tk-card">
        <div class="tk-logo"><span>Tiny Kingdoms</span></div>
        <p class="tk-sub">Grow your kingdom, train an army and knock down the Black castle. Up to 4 players.</p>
        <div class="tk-diffs">
          <button class="tk-btn" data-d="easy">Easy<small>Slow attacks${best('easy')}</small></button>
          <button class="tk-btn blue" data-d="normal">Normal<small>The real thing${best('normal')}</small></button>
          <button class="tk-btn red" data-d="hard">Hard<small>Big attacks, soon${best('hard')}</small></button>
        </div>
        <button class="tk-btn ghost" data-c="join">👥 Join a friend</button>
        <button class="tk-btn ghost" data-c="help">How to play</button>
        <button class="tk-btn ghost" data-c="exit">← Back to games</button>
        <p class="tk-credit">Art: <a href="https://pixelfrog-assets.itch.io/tiny-swords" target="_blank" rel="noopener">Tiny Swords</a> by Pixel Frog</p>
      </div>`;
    };
    titleEl.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      unlockAudio();
      const d = t.closest<HTMLElement>('[data-d]')?.dataset.d as Difficulty | undefined;
      if (d) { start(d); return; }
      const c = t.closest<HTMLElement>('[data-c]')?.dataset.c;
      if (c === 'exit') onExit();
      if (c === 'help') titleEl.innerHTML = `<div class="tk-card tk-help">${HELP}<button class="tk-btn" data-c="back">Back</button></div>`;
      if (c === 'back') showTitle();
      if (c === 'join') coopMenu(wrap, { title: 'Tiny Kingdoms', prefix: COOP_PREFIX, canHost: false, onJoined: s => { void artLoad.then(() => startFriend(s)); } });
    });

    const start = async (d: Difficulty) => {
      titleEl.innerHTML = `<div class="tk-card"><h2>Building the island…</h2></div>`;
      await artLoad;
      if (stopped) return;
      const seed = (Math.random() * 1e9) | 0;
      me = 0;
      g = new Game(seed, d);
      g.addKingdom(0);
      if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __tk: Game }).__tk = g;
      ren = new Renderer(canvas, seed);
      ren.setNodes(g.nodes());
      ren.resize();
      beginPlay();
      toast('Build, train an army, then knock down the Black castle in the middle!');
      orderBtn.innerHTML = `${ORDER_ICON.follow} ${ORDER_TEXT.follow}`;
    };
    const beginPlay = () => {
      playing = true; paused = false; ended = false; lastSnap = null;
      titleEl.hidden = true;
      wrap.classList.add('playing');
      last = performance.now();
    };
    const toTitle = () => {
      net?.close();
      net = null;
      refreshBadge();
      playing = false; g = null; ren = null; lastSnap = null;
      wrap.classList.remove('playing');
      panelWrap.hidden = true;
      showTitle();
    };

    // ---------- the loop ----------
    let hudKey = '';
    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!playing || !ren || !artReady) return;
      const inp = input();
      if (g) {
        g.inputs.set(me, inp);
        const h = myHero();
        if (h) g.cameraHint = { x: h.x, y: h.y };
        if (!paused) g.update(dt);
        const s = g.snap();
        ren.push(s, now, false);
        if (net?.role === 'host') {
          pend.fx.push(...s.fx); pend.snd.push(...s.snd); pend.msg.push(...s.msg); pend.n.push(...s.n);
          if (snapRate(now)) {
            net.broadcast({ t: 's', s: { ...s, fx: pend.fx.splice(0), snd: pend.snd.splice(0), msg: pend.msg.splice(0), n: pend.n.splice(0) } } satisfies ToFriend);
          }
        }
        gotSnap(s);
      } else if (net?.role === 'friend' && inRate(now)) {
        sendHost({ t: 'in', mx: +inp.mx.toFixed(2), my: +inp.my.toFixed(2), atk: inp.atk, guard: inp.guard });
      }
      const k = myKingdom();
      const heroPos = k ? ren.pos(k.h, now) : null;
      const focus = heroPos ?? (k ? { x: CASTLE_AT[me][0] * TILE, y: CASTLE_AT[me][1] * TILE + 60 } : { x: CASTLE_AT[me][0] * TILE, y: CASTLE_AT[me][1] * TILE });
      // what's drawn over the map
      const near = nearThings();
      const ov: Overlay = { me, plots: [], nearBuilding: near.building, names: new Map() };
      if (k) {
        const [cx, cy] = CASTLE_AT[me];
        plotSpots(cx, cy).forEach(([x, y], i) => ov.plots.push({ x: x * TILE, y: y * TILE, empty: !(k.p[i] && ren!.ent(k.p[i])), near: near.plot === i }));
      }
      if (lastSnap) for (const kk of lastSnap.k) if (net || kk.s !== me) ov.names.set(kk.h, kk.s === me ? 'You' : `P${kk.s + 1}`);
      ren.draw(now, ov, focus);
      if (Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) ren.minimap(mini, me);
      // hint over the hero
      if (heroPos && !panelOpen() && (near.plot >= 0 || near.building)) {
        const p = ren.toScreen(heroPos.x, heroPos.y - 130);
        hintEl.hidden = false;
        hintEl.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        hintEl.textContent = near.plot >= 0 ? `${touchMode ? '✋' : 'E'}: build here` : `${touchMode ? '✋' : 'E'}: train`;
      } else hintEl.hidden = true;
      // the HUD, only when it changes
      const s = lastSnap;
      if (s && k) {
        const hero = ren.ent(k.h);
        const key = `${k.g}|${k.w}|${k.m}|${k.pop}|${k.cap}|${s.wave}|${s.next}|${s.bhp}|${hero?.hp}|${k.r}|${k.o}`;
        if (key !== hudKey) {
          hudKey = key;
          resEl.innerHTML = `<span>${icon('gold')}${k.g}</span><span>${icon('wood')}${k.w}</span><span>${icon('meat')}${k.m}</span><span class="tk-pop" title="Units / room">👥 ${k.pop}/${k.cap}</span>`;
          waveEl.innerHTML = `<span>${s.wave ? `Wave ${s.wave} · ` : ''}next attack in <b>${fmtTime(s.next)}</b></span><span class="tk-bhp" title="Black castle"><i style="width:${s.bhp}%"></i></span>`;
          heroEl.innerHTML = hero ? `<span class="tk-hp"><i style="width:${hero.hp}%"></i></span>` : `<span class="tk-down">Back in ${Math.max(0, k.r)}…</span>`;
          orderBtn.innerHTML = `${ORDER_ICON[k.o]} ${ORDER_TEXT[k.o]}`;
        }
      }
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => ren?.resize();
    window.addEventListener('resize', onResize);
    showTitle();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      net?.close();
      badge?.remove();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      root.innerHTML = '';
    };
  },
};

export default game;
