// Start screen: pick a map. Each map keeps its own hotel.
import { levelInfo, MAP_IDS, type MapId } from '../sim/hotel';
import { deleteSave, hasSave, loadHotel } from '../save/save';
import { THEMES } from '../render/theme';
import { isValidCode, normalizeCode } from '../net/codes';

const MODE_KEY = 'my-hotel:players';

function savedTwoPlayer(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === '2';
  } catch {
    return false;
  }
}

export function showStart(onPick: (map: MapId, twoPlayer: boolean) => void, onJoin?: (code: string) => void) {
  let two = savedTwoPlayer();
  const el = document.createElement('div');
  el.className = 'start';
  el.innerHTML = `
    <h1>My hotel</h1>
    <div class="mode" role="group" aria-label="Players">
      <button type="button" data-n="1">👤 1 player</button>
      <button type="button" data-n="2">👥 2 players</button>
    </div>
    <p class="tag">Pick a spot for your hotel</p>
    <div class="maps"></div>
    <form class="join">
      <label for="join-code">Joining a friend? Type their code:</label>
      <input id="join-code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="CODE" />
      <button type="submit">Join</button>
    </form>
    <p class="how two">2 players share one keyboard: player 1 walks with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, player 2 with the arrow keys. You share the coins.</p>
    <p class="how one">Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys. Check guests in at the desk, pick up their coins, clean rooms, and stand on pads to build.</p>`;
  const showMode = () => {
    el.querySelectorAll<HTMLButtonElement>('.mode button').forEach((b) => b.classList.toggle('on', (b.dataset.n === '2') === two));
    el.classList.toggle('is-two', two);
  };
  el.querySelectorAll<HTMLButtonElement>('.mode button').forEach((b) =>
    b.addEventListener('click', () => {
      two = b.dataset.n === '2';
      try {
        localStorage.setItem(MODE_KEY, two ? '2' : '1');
      } catch {
        // fine, just not remembered
      }
      showMode();
    }),
  );
  showMode();
  const form = el.querySelector<HTMLFormElement>('.join')!;
  const input = form.querySelector('input')!;
  input.addEventListener('input', () => (input.value = normalizeCode(input.value)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normalizeCode(input.value);
    if (!isValidCode(code) || !onJoin) return;
    el.remove();
    onJoin(code);
  });
  if (!onJoin) form.remove();
  const list = el.querySelector('.maps')!;
  for (const id of MAP_IDS) {
    const t = THEMES[id];
    const saved = hasSave(id);
    const card = document.createElement('div');
    card.className = 'map';
    card.style.setProperty('--accent', t.accent);
    let status = 'New hotel';
    if (saved) {
      const h = loadHotel(id);
      status = `Level ${levelInfo(h.xp).level} · 🪙 ${h.coins.toLocaleString('en-US')} · ${h.rooms.filter((r) => r.built).length} rooms`;
    }
    card.innerHTML = `
      <img src="./maps/${id}.jpg" alt="" />
      <div class="body">
        <h2>${t.name}</h2>
        <p>${t.blurb}</p>
        <p class="status">${status}</p>
        <div class="row">
          <button class="play" type="button">${saved ? 'Continue' : 'Play'}</button>
          ${saved ? '<button class="reset" type="button">Start over</button>' : ''}
        </div>
      </div>`;
    card.querySelector('.play')!.addEventListener('click', () => {
      el.remove();
      onPick(id, two);
    });
    card.querySelector('.reset')?.addEventListener('click', () => {
      if (!confirm(`Start a new ${t.name} hotel? Your current one there will be lost.`)) return;
      deleteSave(id);
      el.remove();
      onPick(id, two);
    });
    list.appendChild(card);
  }
  document.body.appendChild(el);
}
