import './launcher/launcher.css';
import { CABIN_SVG } from './launcher/cabin';
import { GAMES } from './games/registry';

const app = document.querySelector<HTMLDivElement>('#app')!;
let stopGame: (() => void) | null = null;

function launcher() {
  document.title = 'Games';
  const cards = GAMES.map(
    (g) => `<a class="card" href="#${g.id}">
      <div class="card-art">${g.art}</div>
      <div class="card-text"><h2>${g.title}</h2><p>${g.tagline}</p></div>
      <span class="play">Play</span>
    </a>`,
  ).join('');
  app.innerHTML = `
    <div class="launcher">
      ${CABIN_SVG}
      <main class="board">
        <h1>Games</h1>
        <p class="sub">Pull up a chair by the fire and pick a game.</p>
        <div class="cards">${cards}
          <div class="card soon"><div class="card-art"><svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#3a2a20"/><text x="60" y="50" font-size="30" text-anchor="middle" fill="#8a6a4a">?</text></svg></div>
          <div class="card-text"><h2>More soon</h2><p>New games will show up here.</p></div></div>
        </div>
      </main>
    </div>`;
}

async function route() {
  stopGame?.();
  stopGame = null;
  const id = location.hash.slice(1);
  const entry = GAMES.find((g) => g.id === id);
  if (!entry) return launcher();
  document.title = entry.title;
  app.innerHTML = `<div class="loading">Loading ${entry.title}…</div>`;
  const mod = await entry.load();
  if (location.hash.slice(1) !== id) return;
  app.innerHTML = '';
  const holder = document.createElement('div');
  holder.className = 'game-root';
  app.appendChild(holder);
  stopGame = mod.default.mount(holder, {
    onExit: () => {
      stopGame = null;
      location.hash = '';
    },
  });
}

window.addEventListener('hashchange', route);
void route();
