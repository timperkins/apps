// Start screen: pick a map. Each map keeps its own hotel.
import { levelInfo, MAP_IDS, type MapId } from '../sim/hotel';
import { deleteSave, hasSave, loadHotel } from '../save/save';
import { THEMES } from '../render/theme';

export function showStart(onPick: (map: MapId) => void) {
  const el = document.createElement('div');
  el.className = 'start';
  el.innerHTML = `
    <h1>My hotel</h1>
    <p class="tag">Pick a spot for your hotel</p>
    <div class="maps"></div>
    <p class="how">Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys. Check guests in at the desk, pick up their coins, clean rooms, and stand on pads to build.</p>`;
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
      onPick(id);
    });
    card.querySelector('.reset')?.addEventListener('click', () => {
      if (!confirm(`Start a new ${t.name} hotel? Your current one there will be lost.`)) return;
      deleteSave(id);
      el.remove();
      onPick(id);
    });
    list.appendChild(card);
  }
  document.body.appendChild(el);
}
