import './style.css';
import { Game, type UpgradeId } from './game';
import { MODES, type Mode, type OutfitId } from './modes';
import { Input } from './input';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const hint = document.querySelector<HTMLDivElement>('#hint')!;
const moneyEl = document.querySelector<HTMLDivElement>('#money')!;
const moneyNum = document.querySelector<HTMLSpanElement>('#moneyNum')!;

const goalLabel = document.querySelector<HTMLSpanElement>('#goalLabel')!;
const goalReward = document.querySelector<HTMLSpanElement>('#goalReward')!;
const goalBar = document.querySelector<HTMLElement>('#goalBar')!;
const toast = document.querySelector<HTMLDivElement>('#toast')!;
let toastTimer = 0;
function showToast(text: string) {
  toast.textContent = text;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

const touchFirst = matchMedia('(pointer: coarse)').matches;
hint.textContent = touchFirst ? 'Drag anywhere to walk' : 'WASD or arrow keys to walk';

const input = new Input(canvas);
const game = new Game(canvas, input, {
  moneyTarget: () => {
    const r = moneyEl.querySelector('.coin')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  onMoney: (value, bump) => {
    moneyNum.textContent = value.toLocaleString();
    if (bump) {
      moneyEl.classList.remove('bump');
      void moneyEl.offsetWidth;
      moneyEl.classList.add('bump');
      setTimeout(() => moneyEl.classList.remove('bump'), 120);
    }
  },
  onFirstMove: () => hint.classList.add('hide'),
  onGoal: (text, cur, target, reward) => {
    goalLabel.textContent = target > 1 ? `${text}  ${cur.toLocaleString()}/${target.toLocaleString()}` : text;
    goalReward.textContent = `+${reward}`;
    goalBar.style.width = `${(cur / target) * 100}%`;
  },
  onToast: (text) => showToast(text),
});

// Upgrades menu.
const menu = document.querySelector<HTMLDivElement>('#menu')!;
const upList = document.querySelector<HTMLUListElement>('#upList')!;
const resetBtn = document.querySelector<HTMLButtonElement>('#resetBtn')!;
const icons: Partial<Record<UpgradeId, string>> = {
  belt: '⚙️',
  bag: '🎒',
  axe: '🪓',
  worker: '🧑‍🌾',
  boots: '🥾',
  price: '✨',
  crowd: '🪧',
  grow: '🌱',
  bigtree: '🌲',
  beltspeed: '⚡',
  sled: '🛷',
  chainsaw: '🪚',
  crew: '💪',
  skates: '⛸️',
  royal: '👑',
  market: '🏪',
  seeds: '🪄',
  megatree: '🌳',
  lantern: '🏮',
  firebox: '📦',
  lake: '🎣',
  rod: '🪝',
  fisher: '🐟',
  wall: '🛡️',
  guard: '💂',
  dog: '🐶',
  reindeer: '🦌',
};
const extra = document.querySelector<HTMLDivElement>('#extra')!;

/** Mode-specific sections at the top of the menu: outfits and rebirth. */
function renderExtra() {
  extra.innerHTML = '';
  if (game.mode === 'outfits') {
    const money = game.eeeddd;
    const h = document.createElement('h3');
    h.textContent = 'Outfits';
    extra.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'outfits';
    for (const o of game.outfitList()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'outfit' + (o.worn ? ' worn' : '');
      b.innerHTML = `<span class="swatch" style="background:${o.color}">${o.icon}</span><span class="oname">${o.name}</span><span class="oprice">${o.worn ? 'Wearing' : o.owned ? 'Wear' : `${o.price} eeeddd`}</span>`;
      b.disabled = !o.owned && money < o.price;
      b.addEventListener('click', () => {
        if (game.useOutfit(o.id as OutfitId)) renderMenu();
      });
      grid.appendChild(b);
    }
    extra.appendChild(grid);
    const h2 = document.createElement('h3');
    h2.textContent = 'Upgrades';
    extra.appendChild(h2);
  }
  if (game.mode === 'rebirth') {
    const r = game.rebirthInfo();
    const card = document.createElement('div');
    card.className = 'rebirth';
    card.innerHTML = `
      <div class="rtitle">🌟 Rebirth</div>
      <div class="desc">Start over and keep your stars. Each ★ gives +25% eeeddd and makes you a bit faster. You have ★${r.stars}.</div>
      <button class="buy" type="button">${r.gain > 0 ? `Rebirth for ★${r.gain}` : `Earn ${r.step} first (${Math.min(r.earned, r.step)}/${r.step})`}</button>`;
    const btn = card.querySelector<HTMLButtonElement>('.buy')!;
    btn.disabled = r.gain < 1;
    btn.addEventListener('click', () => {
      if (game.rebirth()) location.reload();
    });
    extra.appendChild(card);
  }
}

function renderMenu() {
  renderExtra();
  const money = game.eeeddd;
  upList.innerHTML = '';
  for (const u of game.upgradeList()) {
    const li = document.createElement('li');
    const maxed = u.cost === null;
    const lvl = u.maxLevel === 0 ? `Lv ${u.level + 1}` : u.maxLevel > 1 ? `${u.level}/${u.maxLevel}` : maxed ? 'built' : '';
    const base = u.id.replace('gold-', '') as UpgradeId;
    li.innerHTML = `
      <div class="icon">${icons[u.id] ?? `<span class="goldicon">${icons[base] ?? '✨'}</span>`}</div>
      <div class="info">
        <div class="name">${u.name}<span class="lvl">${lvl}</span>${u.isNew && !maxed ? '<span class="new">NEW</span>' : ''}</div>
        <div class="desc">${maxed ? 'All done!' : u.text}</div>
      </div>
      <button class="buy" type="button">${maxed ? 'Max' : `${u.cost} eeeddd`}</button>`;
    const btn = li.querySelector<HTMLButtonElement>('.buy')!;
    btn.disabled = maxed || money < (u.cost ?? Infinity);
    btn.addEventListener('click', () => {
      if (game.buy(u.id)) renderMenu();
    });
    upList.appendChild(li);
  }
}

function openMenu() {
  resetBtn.classList.remove('confirm');
  resetBtn.textContent = 'Start over';
  renderMenu();
  menu.hidden = false;
}

// Keep buy buttons in step with eeeddd earned while the menu is open.
setInterval(() => {
  if (!menu.hidden) renderMenu();
}, 600);

document.querySelector('#menuBtn')!.addEventListener('click', openMenu);
document.querySelector('#menuClose')!.addEventListener('click', () => (menu.hidden = true));
menu.addEventListener('click', (e) => {
  if (e.target === menu) menu.hidden = true;
});
resetBtn.addEventListener('click', () => {
  if (!resetBtn.classList.contains('confirm')) {
    resetBtn.classList.add('confirm');
    resetBtn.textContent = 'Tap again to lose everything';
    return;
  }
  game.resetSave();
  location.reload();
});

// Restart button with a confirm dialog.
const confirmEl = document.querySelector<HTMLDivElement>('#confirm')!;
document.querySelector('#restartBtn')!.addEventListener('click', () => (confirmEl.hidden = false));
document.querySelector('#confirmNo')!.addEventListener('click', () => (confirmEl.hidden = true));
confirmEl.addEventListener('click', (e) => {
  if (e.target === confirmEl) confirmEl.hidden = true;
});
document.querySelector('#confirmYes')!.addEventListener('click', () => {
  game.resetSave();
  location.reload();
});

// Start screen: pick one of eight ways to play.
const start = document.querySelector<HTMLDivElement>('#start')!;
const modeGrid = document.querySelector<HTMLDivElement>('#modeGrid')!;
const modeChip = document.querySelector<HTMLDivElement>('#modeChip')!;
const starsEl = document.querySelector<HTMLDivElement>('#stars')!;
const menuBtn = document.querySelector<HTMLButtonElement>('#menuBtn')!;

function showMode(m: Mode) {
  const info = MODES.find((x) => x.id === m)!;
  modeChip.textContent = `${info.emoji} ${info.name}`;
  modeChip.hidden = false;
  menuBtn.textContent = m === 'outfits' ? '🎩 Shop' : '⬆ Upgrades';
  starsEl.hidden = m !== 'rebirth';
  starsEl.textContent = `★ ${game.stars}`;
}

MODES.forEach((m, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mode';
  b.innerHTML = `<span class="num">${i + 1}</span><span class="memoji">${m.emoji}</span><span class="mname">${m.name}</span><span class="mtext">${m.text}</span>`;
  b.addEventListener('click', () => {
    start.hidden = true;
    game.paused = false;
    game.setMode(m.id);
    showMode(m.id);
  });
  modeGrid.appendChild(b);
});

if (game.mode) {
  start.hidden = true;
  showMode(game.mode);
} else {
  start.hidden = false;
  game.paused = true;
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game.paused) game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
