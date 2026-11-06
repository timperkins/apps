import './style.css';
import { Game, type UpgradeId } from './game';
import { Input } from './input';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const hint = document.querySelector<HTMLDivElement>('#hint')!;
const moneyEl = document.querySelector<HTMLDivElement>('#money')!;
const moneyNum = document.querySelector<HTMLSpanElement>('#moneyNum')!;

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
});

// Upgrades menu.
const menu = document.querySelector<HTMLDivElement>('#menu')!;
const upList = document.querySelector<HTMLUListElement>('#upList')!;
const resetBtn = document.querySelector<HTMLButtonElement>('#resetBtn')!;
const icons: Record<UpgradeId, string> = {
  belt: '⚙️',
  bag: '🎒',
  axe: '🪓',
  worker: '🧑‍🌾',
  boots: '🥾',
  price: '✨',
  crowd: '🪧',
  grow: '🌱',
  bigtree: '🌲',
};

function renderMenu() {
  const money = game.eeeddd;
  upList.innerHTML = '';
  for (const u of game.upgradeList()) {
    const li = document.createElement('li');
    const maxed = u.cost === null;
    const lvl = u.maxLevel > 1 ? `${u.level}/${u.maxLevel}` : maxed ? 'built' : '';
    li.innerHTML = `
      <div class="icon">${icons[u.id]}</div>
      <div class="info">
        <div class="name">${u.name}<span class="lvl">${lvl}</span></div>
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

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
