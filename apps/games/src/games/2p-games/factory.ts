// Factory: makers (a banana, an apple, a cat…) make gold. Buy crates, pick 1 of 3 makers, upgrade each
// one up to 8 times, and be the first to buy the Golden Trophy. Each player runs their own factory;
// the host keeps the scoreboard and calls the winner.
import { play } from './audio';
import { esc, fmt, type Match } from './match';

type Rarity = 0 | 1 | 2 | 3 | 4;
const RARITY = [
  { name: 'Common', color: '#9aa4ad' },
  { name: 'Uncommon', color: '#4cb863' },
  { name: 'Rare', color: '#3d8fe0' },
  { name: 'Epic', color: '#a45be0' },
  { name: 'Legendary', color: '#f0a323' },
];

interface MakerDef { id: string; name: string; em: string; r: Rarity; gold: number; every: number }
export const MAKERS: MakerDef[] = [
  { id: 'banana', name: 'Banana', em: '🍌', r: 0, gold: 1, every: 2 },
  { id: 'apple', name: 'Apple', em: '🍎', r: 0, gold: 2, every: 3 },
  { id: 'carrot', name: 'Carrot', em: '🥕', r: 0, gold: 3, every: 5 },
  { id: 'cookie', name: 'Cookie', em: '🍪', r: 0, gold: 2, every: 2.5 },
  { id: 'cat', name: 'Cat', em: '🐱', r: 1, gold: 6, every: 3 },
  { id: 'duck', name: 'Duck', em: '🦆', r: 1, gold: 5, every: 2 },
  { id: 'cheese', name: 'Cheese', em: '🧀', r: 1, gold: 9, every: 4 },
  { id: 'pizza', name: 'Pizza', em: '🍕', r: 1, gold: 8, every: 3 },
  { id: 'dog', name: 'Dog', em: '🐶', r: 2, gold: 20, every: 3 },
  { id: 'robot', name: 'Robot', em: '🤖', r: 2, gold: 30, every: 4 },
  { id: 'cake', name: 'Rainbow Cake', em: '🎂', r: 2, gold: 15, every: 2 },
  { id: 'penguin', name: 'Penguin', em: '🐧', r: 2, gold: 24, every: 3 },
  { id: 'dragon', name: 'Dragon', em: '🐉', r: 3, gold: 80, every: 4 },
  { id: 'unicorn', name: 'Unicorn', em: '🦄', r: 3, gold: 60, every: 3 },
  { id: 'rocket', name: 'Rocket', em: '🚀', r: 3, gold: 100, every: 5 },
  { id: 'octopus', name: 'Octopus', em: '🐙', r: 3, gold: 50, every: 2 },
  { id: 'goose', name: 'Golden Goose', em: '🪿', r: 4, gold: 250, every: 4 },
  { id: 'dino', name: 'Diamond Dino', em: '🦖', r: 4, gold: 300, every: 5 },
  { id: 'crowncat', name: 'King Cat', em: '😼', r: 4, gold: 200, every: 3 },
];
const DEF = new Map(MAKERS.map((m) => [m.id, m]));

interface Crate { id: string; name: string; price: number; odds: number[]; look: string }
const CRATES: Crate[] = [
  { id: 'wood', name: 'Wooden Crate', price: 15, odds: [80, 18, 2, 0, 0], look: 'wood' },
  { id: 'silver', name: 'Silver Crate', price: 120, odds: [35, 45, 17, 3, 0], look: 'silver' },
  { id: 'gold', name: 'Golden Crate', price: 700, odds: [0, 30, 45, 22, 3], look: 'gold' },
  { id: 'diamond', name: 'Diamond Crate', price: 3500, odds: [0, 0, 35, 45, 20], look: 'diamond' },
];

export const MAX_LEVEL = 8;
const SLOTS = 12;
const TROPHY = 100_000;

interface Maker { id: string; lvl: number; t: number; pop: number }

const gps = (m: Maker) => { const d = DEF.get(m.id)!; return d.gold * mult(m.lvl) / d.every; };
const mult = (lvl: number) => 1 + 0.6 * lvl;
/** Base worth: 30 seconds of what it makes before any upgrades. */
const worth = (id: string) => { const d = DEF.get(id)!; return Math.max(5, d.gold / d.every * 30); };
const upCost = (m: Maker) => Math.round(worth(m.id) * 0.8 * Math.pow(1.75, m.lvl));
const sellFor = (m: Maker) => Math.round(worth(m.id) * 0.5 * (1 + m.lvl * 0.5));

function rollMaker(c: Crate): string {
  const tot = c.odds.reduce((a, b) => a + b, 0);
  let x = Math.random() * tot, r = 0;
  for (; r < 4; r++) { x -= c.odds[r]; if (x < 0) break; }
  const pool = MAKERS.filter((m) => m.r === r);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

interface Row { slot: number; name: string; gold: number; gps: number; em: string; won?: boolean }
type Msg =
  | { t: 'st'; gold: number; gps: number; em: string }
  | { t: 'board'; rows: Row[] }
  | { t: 'won' }
  | { t: 'end'; slot: number; name: string };

export function startGame(root: HTMLElement, match: Match): () => void {
  root.innerHTML = `
    <div class="fx">
      <div class="fx-top">
        <button class="fx-quit" title="Leave">←</button>
        <div class="fx-gold"><span class="fx-coin"></span><b class="fx-g">0</b><small class="fx-gps">0 / sec</small></div>
        <button class="fx-trophy"><span>🏆</span><b>Golden Trophy</b><small>${fmt(TROPHY)} gold</small><i></i></button>
      </div>
      <div class="fx-main">
        <div class="fx-floor"><h3>Your factory</h3><div class="fx-grid"></div></div>
        <div class="fx-side">
          <h3>Crates</h3><div class="fx-crates"></div>
          <h3>Players</h3><div class="fx-board"></div>
        </div>
      </div>
      <div class="fx-modal" hidden></div>
    </div>`;
  const $ = <E extends HTMLElement>(s: string) => root.querySelector<E>(s)!;
  const gEl = $('.fx-g'), gpsEl = $('.fx-gps'), grid = $('.fx-grid'), cratesEl = $('.fx-crates'), boardEl = $('.fx-board');
  const trophyBtn = $<HTMLButtonElement>('.fx-trophy'), modal = $('.fx-modal');
  const meName = match.players.find((p) => p.slot === match.me)?.name ?? 'You';

  let gold = 10;
  const makers: (Maker | null)[] = Array(SLOTS).fill(null);
  makers[0] = { id: 'banana', lvl: 0, t: 0, pop: 0 };
  let board: Row[] = [];
  const rows = new Map<number, Row>(); // host: everyone's latest
  let ended = false;
  let detail = -1; // slot of the maker whose card is open
  let opening: { crate: Crate; picks: string[] } | null = null;

  const myGps = () => makers.reduce((a, m) => a + (m ? gps(m) : 0), 0);
  const emojis = () => makers.filter(Boolean).sort((a, b) => DEF.get(b!.id)!.r - DEF.get(a!.id)!.r).slice(0, 8).map((m) => DEF.get(m!.id)!.em).join('');

  // ---------- drawing ----------
  function drawGrid() {
    grid.innerHTML = makers.map((m, i) => {
      if (!m) return `<div class="fx-slot empty" data-i="${i}"><span>Empty</span></div>`;
      const d = DEF.get(m.id)!;
      return `<button class="fx-slot r${d.r}" data-i="${i}" style="--rc:${RARITY[d.r].color}">
        <span class="fx-em">${d.em}</span>
        <b>${d.name}</b>
        <small>${fmt(d.gold * mult(m.lvl))}g / ${d.every}s</small>
        <span class="fx-stars">${'★'.repeat(m.lvl)}${'☆'.repeat(MAX_LEVEL - m.lvl)}</span>
        <i class="fx-bar"><u></u></i>
      </button>`;
    }).join('');
    grid.querySelectorAll<HTMLElement>('button.fx-slot').forEach((b) => b.onclick = () => { play('click'); detail = Number(b.dataset.i); drawModal(); });
  }
  function drawCrates() {
    const full = makers.every(Boolean);
    cratesEl.innerHTML = CRATES.map((c) => `
      <button class="fx-crate ${c.look}" data-c="${c.id}" ${gold < c.price || full ? 'disabled' : ''}>
        <span class="fx-box"></span><b>${c.name}</b>
        <small>${c.odds.map((o, r) => o ? `<i style="color:${RARITY[r].color}">${o}%</i>` : '').join(' ')}</small>
        <em><span class="fx-coin s"></span>${fmt(c.price)}</em>
      </button>`).join('') + (full ? '<p class="fx-note">Your factory is full. Tap a maker to sell it and make room.</p>' : '');
    cratesEl.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => b.onclick = () => buyCrate(CRATES.find((c) => c.id === b.dataset.c)!));
  }
  function drawBoard() {
    const list = board.length ? board : [{ slot: match.me, name: meName, gold, gps: myGps(), em: emojis() }];
    boardEl.innerHTML = [...list].sort((a, b) => b.gold - a.gold).map((r, i) => `
      <div class="fx-row${r.slot === match.me ? ' me' : ''}"><span class="fx-rank">${i + 1}</span><b>${esc(r.name)}</b>
        <span class="fx-rg"><span class="fx-coin s"></span>${fmt(Math.floor(r.gold))}</span><small>${fmt(r.gps)}/s</small><span class="fx-rem">${r.em}</span>
        <i class="fx-prog"><u style="width:${Math.min(100, r.gold / TROPHY * 100)}%"></u></i></div>`).join('');
  }
  function drawTop() {
    gEl.textContent = fmt(Math.floor(gold));
    gpsEl.textContent = `${myGps() < 10 ? myGps().toFixed(1) : fmt(myGps())} / sec`;
    trophyBtn.disabled = gold < TROPHY || ended;
    trophyBtn.querySelector('i')!.style.width = `${Math.min(100, gold / TROPHY * 100)}%`;
  }

  function drawModal() {
    if (opening) {
      const o = opening;
      modal.hidden = false;
      modal.innerHTML = `<div class="fx-open"><h2>${o.crate.name}</h2><p>Pick one maker for your factory</p>
        <div class="fx-picks">${o.picks.map((id, i) => { const d = DEF.get(id)!; return `
          <button class="fx-pick r${d.r}" data-p="${i}" style="--rc:${RARITY[d.r].color};animation-delay:${0.35 + i * 0.18}s">
            <span class="fx-rar">${RARITY[d.r].name}</span><span class="fx-em big">${d.em}</span><b>${d.name}</b>
            <small>${d.gold} gold every ${d.every} sec</small></button>`; }).join('')}</div></div>`;
      modal.querySelectorAll<HTMLElement>('[data-p]').forEach((b) => b.onclick = () => pick(o.picks[Number(b.dataset.p)]));
      return;
    }
    const m = detail >= 0 ? makers[detail] : null;
    if (!m) { modal.hidden = true; modal.innerHTML = ''; return; }
    const d = DEF.get(m.id)!;
    const max = m.lvl >= MAX_LEVEL, cost = upCost(m);
    modal.hidden = false;
    modal.innerHTML = `<div class="fx-card" style="--rc:${RARITY[d.r].color}">
      <button class="fx-close">✕</button>
      <span class="fx-rar">${RARITY[d.r].name}</span><span class="fx-em big">${d.em}</span><h2>${d.name}</h2>
      <p>Makes <b>${fmt(d.gold * mult(m.lvl))} gold</b> every ${d.every} seconds${max ? '' : ` → <b>${fmt(d.gold * mult(m.lvl + 1))}</b> after the upgrade`}.</p>
      <span class="fx-stars big">${'★'.repeat(m.lvl)}${'☆'.repeat(MAX_LEVEL - m.lvl)}</span>
      <p class="fx-sub">Upgrade ${m.lvl} of ${MAX_LEVEL}</p>
      <button class="fx-btn" data-a="up" ${max || gold < cost ? 'disabled' : ''}>${max ? 'Fully upgraded!' : `⬆ Upgrade · <span class="fx-coin s"></span>${fmt(cost)}`}</button>
      <button class="fx-btn ghost" data-a="sell">Sell for ${fmt(sellFor(m))} gold</button>
    </div>`;
    modal.querySelector<HTMLElement>('.fx-close')!.onclick = () => { detail = -1; drawModal(); };
    modal.querySelector<HTMLElement>('[data-a="up"]')!.onclick = () => upgrade(detail);
    modal.querySelector<HTMLElement>('[data-a="sell"]')!.onclick = () => sell(detail);
  }
  modal.onclick = (e) => { if (e.target === modal && !opening) { detail = -1; drawModal(); } };

  // ---------- actions ----------
  function buyCrate(c: Crate) {
    if (gold < c.price || ended) { play('no'); return; }
    if (makers.every(Boolean)) { play('no'); return; }
    gold -= c.price;
    const picks: string[] = [];
    while (picks.length < 3) { const id = rollMaker(c); if (!picks.includes(id) || Math.random() < 0.1) picks.push(id); }
    opening = { crate: c, picks };
    play('crate');
    drawModal(); drawAll();
  }
  function pick(id: string) {
    const i = makers.findIndex((m) => !m);
    if (i < 0) return;
    makers[i] = { id, lvl: 0, t: 0, pop: 0 };
    opening = null;
    play('pick');
    drawModal(); drawAll();
  }
  function upgrade(i: number) {
    const m = makers[i];
    if (!m || m.lvl >= MAX_LEVEL) return;
    const cost = upCost(m);
    if (gold < cost) { play('no'); return; }
    gold -= cost; m.lvl++;
    play('upgrade');
    drawModal(); drawAll();
  }
  function sell(i: number) {
    const m = makers[i];
    if (!m) return;
    gold += sellFor(m);
    makers[i] = null;
    detail = -1;
    play('coin');
    drawModal(); drawAll();
  }
  trophyBtn.onclick = () => {
    if (gold < TROPHY || ended) return;
    gold -= TROPHY;
    if (match.host) declare(match.me, meName); else match.send({ t: 'won' } satisfies Msg);
  };
  $('.fx-quit').onclick = () => { if (ended || confirmLeave()) match.quit(); };
  const confirmLeave = () => {
    modal.hidden = false;
    modal.innerHTML = `<div class="fx-card"><h2>Leave the factory?</h2><p>Your factory won’t be saved.</p>
      <button class="fx-btn" data-a="stay">Keep playing</button><button class="fx-btn ghost" data-a="go">Leave</button></div>`;
    modal.querySelector<HTMLElement>('[data-a="stay"]')!.onclick = () => drawModal();
    modal.querySelector<HTMLElement>('[data-a="go"]')!.onclick = () => match.quit();
    return false;
  };

  function drawAll() { drawGrid(); drawCrates(); drawBoard(); drawTop(); }

  // ---------- playing together ----------
  function declare(slot: number, name: string) {
    if (ended) return;
    const msg: Msg = { t: 'end', slot, name };
    match.broadcast(msg);
    finish(msg);
  }
  function finish(m: Extract<Msg, { t: 'end' }>) {
    ended = true;
    const mine = m.slot === match.me;
    play(mine ? 'win' : 'lose');
    opening = null; detail = -1;
    modal.hidden = false;
    modal.innerHTML = `<div class="fx-card win"><span class="fx-em big">🏆</span><h2>${mine ? 'You won!' : `${esc(m.name)} won!`}</h2>
      <p>${mine ? 'You bought the Golden Trophy first.' : `${esc(m.name)} bought the Golden Trophy first.`}</p>
      <button class="fx-btn" data-a="go">Back to 2p Games</button></div>`;
    modal.querySelector<HTMLElement>('[data-a="go"]')!.onclick = () => match.quit();
    drawTop();
  }
  match.onMsg((from, m: Msg) => {
    if (match.host) {
      if (m.t === 'st') {
        const p = match.players.find((q) => q.slot === from);
        rows.set(from, { slot: from, name: p?.name ?? 'Player', gold: +m.gold || 0, gps: +m.gps || 0, em: String(m.em).slice(0, 40) });
      } else if (m.t === 'won') declare(from, match.players.find((q) => q.slot === from)?.name ?? 'Player');
    } else {
      if (m.t === 'board') { board = m.rows; drawBoard(); } else if (m.t === 'end') finish(m);
    }
  });
  match.onLeave((slot) => {
    if (match.host) rows.delete(slot);
    else if (slot === 0 && !ended) {
      ended = true;
      modal.hidden = false;
      modal.innerHTML = `<div class="fx-card"><h2>The host left</h2><p>The game is over.</p><button class="fx-btn" data-a="go">Back to 2p Games</button></div>`;
      modal.querySelector<HTMLElement>('[data-a="go"]')!.onclick = () => match.quit();
    }
  });

  // ---------- the clock ----------
  let last = performance.now(), sync = 0, raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    if (ended) return;
    let made = 0;
    makers.forEach((m, i) => {
      if (!m) return;
      const d = DEF.get(m.id)!;
      m.t += dt;
      const el = grid.querySelector<HTMLElement>(`.fx-slot[data-i="${i}"]`);
      while (m.t >= d.every) {
        m.t -= d.every;
        const g = d.gold * mult(m.lvl);
        gold += g; made += g;
        if (el) popGold(el, g);
      }
      el?.querySelector<HTMLElement>('u')?.style.setProperty('width', `${(m.t / d.every) * 100}%`);
    });
    if (made) { play('coin', 0.5); drawTop(); refreshAfford(); }
    sync += dt;
    if (sync > 1) {
      sync = 0;
      const mine: Row = { slot: match.me, name: meName, gold, gps: myGps(), em: emojis() };
      if (match.host) {
        rows.set(match.me, mine);
        board = [...rows.values()];
        match.broadcast({ t: 'board', rows: board } satisfies Msg);
      } else {
        match.send({ t: 'st', gold, gps: mine.gps, em: mine.em } satisfies Msg);
        board = board.map((r) => r.slot === match.me ? mine : r);
      }
      drawBoard();
    }
  };
  // only redraw the crate buttons when what you can afford changes
  let affordKey = '';
  function refreshAfford() {
    const key = CRATES.map((c) => gold >= c.price ? 1 : 0).join('') + (makers.every(Boolean) ? 'f' : '');
    if (key !== affordKey) { affordKey = key; drawCrates(); }
    if (detail >= 0 && !opening) {
      const m = makers[detail];
      const b = modal.querySelector<HTMLButtonElement>('[data-a="up"]');
      if (m && b && m.lvl < MAX_LEVEL) b.disabled = gold < upCost(m);
    }
  }
  function popGold(el: HTMLElement, g: number) {
    const s = document.createElement('span');
    s.className = 'fx-pop';
    s.textContent = `+${fmt(g)}`;
    el.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }

  drawAll();
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); root.innerHTML = ''; };
}
