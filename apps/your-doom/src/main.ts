import './style.css';
import { Game } from './game';
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
