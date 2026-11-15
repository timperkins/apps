// Survivle: an open-world adventure. Name your hero, explore a huge land, find chests, and defeat the
// Dark Beast in the castle at the middle of the map before 4 hours of play run out.
import './style.css';
import type { GameModule } from '../types';
import { Game, type SaveData } from './game';
import { Renderer, drawHero, drawBeast, type Cam } from './render';
import { OUTFITS, PRICES, bowName, outfitById, swordName, TIME_LIMIT } from './data';
import { isMuted, setMuted, sfx } from './audio';
import { CX, CY, FLOOR_H } from './world';

const INDEX_KEY = 'survivle-saves';
const slotKey = (id: string) => `survivle-slot-${id}`;

interface SaveMeta {
  id: string;
  name: string;
  savedAt: number;
  elapsed: number;
  won: boolean;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, v: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
const listSaves = () => readJSON<SaveMeta[]>(INDEX_KEY, []).sort((a, b) => b.savedAt - a.savedAt);

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const CONTROLS = `
  <div class="sv-keys">
    <div><b>Arrows / WASD</b> walk</div>
    <div><b>Space</b> swing sword (chops trees too)</div>
    <div><b>Shift</b> shoot bow · aim with the mouse</div>
    <div><b>Z</b> jump · walk into a cliff to climb</div>
    <div><b>E</b> open chests · trade</div>
    <div><b>C</b> campfire (3 wood) · <b>H</b> eat apple</div>
    <div><b>I</b> gear &amp; clothes · <b>Esc</b> pause</div>
  </div>`;

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'sv';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="sv-canvas"></canvas><div class="sv-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const ui = el.querySelector<HTMLDivElement>('.sv-ui')!;
    const R = new Renderer(cv);
    R.resize();

    type Mode = 'title' | 'create' | 'cutscene' | 'play' | 'end';
    let mode: Mode = 'title';
    let overlay: 'none' | 'pause' | 'gear' | 'shop' | 'load' = 'none';
    let g = new Game('', 12345);
    const cam: Cam = { x: CX + 0.5, y: CY + 30, z: FLOOR_H };
    let titleT = 0;
    let cut = { t: 0, motes: [] as { x: number; y: number; z: number; a: number; r: number; life: number }[] };
    let mouse = { x: 0, y: 0 };
    let raf = 0;
    let last = performance.now();
    let endShown = false;

    // ---------- screens ----------
    const show = (html: string) => {
      ui.innerHTML = html;
    };

    function title() {
      mode = 'title';
      overlay = 'none';
      g = new Game('', 777);
      cam.x = CX + 0.5;
      cam.y = CY + 60;
      cam.z = FLOOR_H;
      const saves = listSaves();
      show(`
        <div class="sv-title">
          <div class="sv-logo"><canvas class="sv-orb" width="120" height="120"></canvas><h1>Survivle</h1></div>
          <p class="sv-tag">The gloom is spreading from the castle. Defeat the Dark Beast in 4 hours, or the world goes black.</p>
          <div class="sv-menu">
            <button data-a="new" class="sv-btn big">New game</button>
            ${saves.length ? '<button data-a="load" class="sv-btn">Load game</button>' : ''}
            <button data-a="exit" class="sv-btn ghost">Back to games</button>
          </div>
          ${CONTROLS}
          <p class="sv-note">Best on a computer with a keyboard and mouse.</p>
        </div>`);
      drawOrb();
    }

    function drawOrb() {
      const oc = ui.querySelector<HTMLCanvasElement>('.sv-orb');
      if (!oc) return;
      const x = oc.getContext('2d')!;
      x.clearRect(0, 0, 120, 120);
      x.save();
      x.translate(60, 60);
      drawBeast(x, 36, titleT, 0, false);
      x.restore();
    }

    let newOutfit = 'forest';
    function create() {
      mode = 'create';
      show(`
        <div class="sv-panel sv-create">
          <h2>Who is your hero?</h2>
          <canvas class="sv-preview" width="160" height="180"></canvas>
          <label>Name <input class="sv-name" maxlength="16" placeholder="Type a name" autocomplete="off"></label>
          <p class="sv-dim">You start in green: green shirt, green pants and a dark green hood. Traders sell more clothes later.</p>
          <div class="sv-row"><button data-a="back" class="sv-btn ghost">Back</button><button data-a="begin" class="sv-btn big">Begin</button></div>
        </div>`);
      newOutfit = 'forest';
      const input = ui.querySelector<HTMLInputElement>('.sv-name')!;
      input.focus();
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') begin();
      });
      drawPreview();
    }

    function drawPreview() {
      const pc = ui.querySelector<HTMLCanvasElement>('.sv-preview');
      if (!pc) return;
      const x = pc.getContext('2d')!;
      x.clearRect(0, 0, 160, 180);
      x.save();
      x.translate(80, 160);
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.beginPath();
      x.ellipse(0, 0, 30, 10, 0, 0, 7);
      x.fill();
      drawHero(x, outfitById(newOutfit), Math.PI * 0.25 + Math.sin(titleT) * 0.6, titleT, { scale: 2.8, swordD: 1 });
      x.restore();
    }

    function begin() {
      const input = ui.querySelector<HTMLInputElement>('.sv-name');
      const name = (input?.value.trim() || 'Hero').slice(0, 16);
      g = new Game(name, Math.floor(Math.random() * 1e9));
      g.p.outfit = newOutfit;
      g.onShop = openShop;
      startCutscene();
    }

    function startCutscene() {
      mode = 'cutscene';
      overlay = 'none';
      cut = { t: 0, motes: [] };
      cam.x = CX + 0.5;
      cam.y = CY + 0.5;
      cam.z = FLOOR_H;
      show(`<div class="sv-cut"><div class="sv-cut-text"></div><div class="sv-skip">Space to skip</div></div>`);
      sfx.gloom();
      el.focus();
    }

    function cutText(s: string) {
      const t = ui.querySelector('.sv-cut-text');
      if (t && t.textContent !== s) {
        t.textContent = s;
        t.classList.remove('in');
        void (t as HTMLElement).offsetWidth;
        t.classList.add('in');
      }
    }

    function play() {
      mode = 'play';
      overlay = 'none';
      show('');
      el.focus();
    }

    function pause() {
      overlay = 'pause';
      show(`
        <div class="sv-dim-bg"><div class="sv-panel">
          <h2>Paused</h2>
          <p class="sv-dim">${esc(g.p.name)} · Darkness in ${fmtTime(g.timeLeft)}</p>
          <div class="sv-menu">
            <button data-a="resume" class="sv-btn big">Resume</button>
            <button data-a="save" class="sv-btn">Save</button>
            <button data-a="load" class="sv-btn">Load</button>
            <button data-a="gear" class="sv-btn">Gear &amp; clothes</button>
            <button data-a="savequit" class="sv-btn">Save and quit</button>
            <button data-a="mute" class="sv-btn ghost">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
          </div>
          ${CONTROLS}
        </div></div>`);
    }

    function save(): boolean {
      const data = g.toSave();
      const ok = writeJSON(slotKey(g.id), data);
      if (!ok) return false;
      const list = listSaves().filter((s) => s.id !== g.id);
      list.push({ id: g.id, name: g.p.name, savedAt: data.savedAt, elapsed: g.elapsed, won: g.won });
      writeJSON(INDEX_KEY, list);
      return true;
    }

    function loadMenu(from: 'title' | 'pause') {
      overlay = 'load';
      const saves = listSaves();
      show(`
        <div class="sv-dim-bg"><div class="sv-panel">
          <h2>Load a game</h2>
          <div class="sv-saves">
            ${saves.length ? saves.map((s) => `
              <div class="sv-save">
                <button class="sv-btn" data-a="loadslot" data-id="${s.id}"><b>${esc(s.name)}</b>
                <span>${s.won ? 'Beat the Dark Beast!' : `${fmtTime(Math.max(0, TIME_LIMIT - s.elapsed))} left`} · ${new Date(s.savedAt).toLocaleString()}</span></button>
                <button class="sv-x" data-a="delslot" data-id="${s.id}" title="Delete">✕</button>
              </div>`).join('') : '<p class="sv-dim">No saves yet.</p>'}
          </div>
          <div class="sv-row"><button data-a="${from === 'title' ? 'totitle' : 'topause'}" class="sv-btn ghost">Back</button></div>
        </div></div>`);
    }

    function loadSlot(id: string) {
      const data = readJSON<SaveData | null>(slotKey(id), null);
      if (!data) return;
      g = Game.fromSave(data);
      g.onShop = openShop;
      cam.x = g.p.x;
      cam.y = g.p.y;
      cam.z = g.p.z;
      endShown = false;
      g.toast(`Welcome back, ${g.p.name}!`);
      play();
    }

    function gear() {
      overlay = 'gear';
      const swords = [...new Set(g.swords)];
      const bows = [...new Set(g.bows)];
      show(`
        <div class="sv-dim-bg"><div class="sv-panel wide">
          <h2>Gear &amp; clothes</h2>
          <div class="sv-cols">
            <div><h3>Swords</h3>${swords.map((d) => `<button class="sv-item ${g.swordDmg === d ? 'on' : ''}" data-a="eqs" data-d="${d}">⚔ ${swordName(d)} <em>${d} dmg</em></button>`).join('')}</div>
            <div><h3>Bows</h3>${bows.map((d) => `<button class="sv-item ${g.bowDmg === d ? 'on' : ''}" data-a="eqb" data-d="${d}">🏹 ${bowName(d)} <em>${d} dmg</em></button>`).join('')}
              <p class="sv-dim">${g.arrows} arrows · ${g.wood} wood · ${g.coins} coins · ${g.apples} apples</p></div>
            <div><h3>Clothes</h3>${g.owned.map((id) => { const o = outfitById(id); return `<button class="sv-item ${g.p.outfit === id ? 'on' : ''}" data-a="wear" data-id="${id}"><i style="background:${o.shirt};border-color:${o.hood}"></i>${o.name}</button>`; }).join('')}</div>
          </div>
          <p class="sv-dim">Chests hide on cliff tops and deep in forests. Each one holds a better sword or bow (up to 5 damage better than your best). The best sword does 15.</p>
          <div class="sv-row"><button data-a="close" class="sv-btn big">Done</button></div>
        </div></div>`);
    }

    function openShop() {
      overlay = 'shop';
      shopHtml();
    }
    function shopHtml(msg = '') {
      show(`
        <div class="sv-dim-bg"><div class="sv-panel wide">
          <h2>Trader</h2>
          <p class="sv-dim">"Wood for coins, coins for anything!" · You have <b>${g.coins}</b> coins, <b>${g.wood}</b> wood.</p>
          ${msg ? `<p class="sv-msg">${msg}</p>` : ''}
          <div class="sv-shop">
            <button class="sv-item" data-a="sellwood" ${g.wood ? '' : 'disabled'}>🪵 Sell all wood <em>+${g.wood * PRICES.woodSell} coins</em></button>
            <button class="sv-item" data-a="buyarrows">🏹 10 arrows <em>${PRICES.arrows10} coins</em></button>
            <button class="sv-item" data-a="buyapple">🍎 Apple (heals 1 heart) <em>${PRICES.apple} coins</em></button>
          </div>
          <h3>Clothes</h3>
          <div class="sv-shop">
            ${OUTFITS.filter((o) => o.price > 0).map((o) => g.owned.includes(o.id)
              ? `<button class="sv-item" data-a="wear2" data-id="${o.id}"><i style="background:${o.shirt};border-color:${o.hood}"></i>${o.name} <em>${g.p.outfit === o.id ? 'wearing' : 'wear'}</em></button>`
              : `<button class="sv-item" data-a="buyoutfit" data-id="${o.id}"><i style="background:${o.shirt};border-color:${o.hood}"></i>${o.name} <em>${o.price} coins</em></button>`).join('')}
            ${g.owned.includes('forest') ? `<button class="sv-item" data-a="wear2" data-id="forest"><i style="background:#3e9b3a;border-color:#1b4a20"></i>Forest Green <em>${g.p.outfit === 'forest' ? 'wearing' : 'wear'}</em></button>` : ''}
          </div>
          <div class="sv-row"><button data-a="close" class="sv-btn big">Bye!</button></div>
        </div></div>`);
    }

    function endScreen(won: boolean) {
      mode = 'end';
      endShown = true;
      if (won) save();
      show(`
        <div class="sv-dim-bg ${won ? 'win' : 'lose'}"><div class="sv-panel">
          <h2>${won ? 'You beat the Dark Beast!' : 'The world went black…'}</h2>
          <p>${won
            ? `${esc(g.p.name)} saved the land with ${fmtTime(g.timeLeft)} to spare. The gloom is gone and the sun is back.`
            : `Four hours passed and the Dark Beast's gloom covered everything. Load a save and try again!`}</p>
          <div class="sv-menu">
            ${won ? '<button data-a="keepplaying" class="sv-btn big">Keep exploring</button>' : '<button data-a="load" class="sv-btn big">Load a save</button>'}
            <button data-a="totitle" class="sv-btn">Title screen</button>
          </div>
        </div></div>`);
    }

    ui.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      sfx.click();
      switch (a) {
        case 'new': return create();
        case 'load': return loadMenu(mode === 'title' ? 'title' : mode === 'end' ? 'title' : 'pause');
        case 'exit': return onExit();
        case 'back': return title();
        case 'begin': return begin();
        case 'resume': case 'close': return play();
        case 'save': {
          const ok = save();
          g.toast(ok ? 'Game saved' : 'Could not save (storage full?)');
          return play();
        }
        case 'savequit': {
          save();
          return title();
        }
        case 'gear': return gear();
        case 'mute': {
          setMuted(!isMuted());
          return pause();
        }
        case 'totitle': return title();
        case 'topause': return pause();
        case 'loadslot': return loadSlot(b.dataset.id!);
        case 'delslot': {
          localStorage.removeItem(slotKey(b.dataset.id!));
          writeJSON(INDEX_KEY, listSaves().filter((s) => s.id !== b.dataset.id));
          return loadMenu(mode === 'title' ? 'title' : 'pause');
        }
        case 'eqs': g.sword = g.swords.lastIndexOf(Number(b.dataset.d)); return gear();
        case 'eqb': g.bow = g.bows.lastIndexOf(Number(b.dataset.d)); return gear();
        case 'wear': g.p.outfit = b.dataset.id!; return gear();
        case 'wear2': g.p.outfit = b.dataset.id!; return shopHtml();
        case 'sellwood': {
          const c = g.wood * PRICES.woodSell;
          g.coins += c;
          g.wood = 0;
          sfx.coin();
          return shopHtml(`Sold for ${c} coins.`);
        }
        case 'buyarrows':
          if (g.coins < PRICES.arrows10) return shopHtml('Not enough coins.');
          g.coins -= PRICES.arrows10;
          g.arrows += 10;
          sfx.coin();
          return shopHtml('10 arrows added.');
        case 'buyapple':
          if (g.coins < PRICES.apple) return shopHtml('Not enough coins.');
          g.coins -= PRICES.apple;
          g.apples++;
          sfx.coin();
          return shopHtml('An apple! Press H to eat it.');
        case 'buyoutfit': {
          const o = outfitById(b.dataset.id!);
          if (g.coins < o.price) return shopHtml('Not enough coins.');
          g.coins -= o.price;
          g.owned.push(o.id);
          g.p.outfit = o.id;
          sfx.coin();
          return shopHtml(`You're wearing ${o.name} now!`);
        }
        case 'keepplaying': return play();
      }
    });

    // ---------- input ----------
    const keyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    };
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const dir = keyMap[e.code];
      if (dir) {
        g.input[dir] = down;
        e.preventDefault();
      }
      if (!down) return;
      if (['Space', 'Tab', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
      if (mode === 'cutscene' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        play();
        return;
      }
      if (e.code === 'Escape') {
        if (mode !== 'play') return;
        if (overlay === 'none') pause();
        else if (overlay === 'load') pause();
        else play();
        return;
      }
      if (mode !== 'play') return;
      if (e.code === 'KeyI' || e.code === 'Tab') {
        if (overlay === 'gear') play();
        else if (overlay === 'none') gear();
        return;
      }
      if (overlay !== 'none' || e.repeat) {
        if (overlay === 'none' && e.code === 'Space') g.swing();
        return;
      }
      switch (e.code) {
        case 'Space': g.swing(); break;
        case 'ShiftLeft': case 'ShiftRight': g.shoot(); break;
        case 'KeyZ': g.jump(); break;
        case 'KeyE': g.interact(); break;
        case 'KeyC': g.campfire(); break;
        case 'KeyH': g.eat(); break;
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const blur = () => {
      g.input.up = g.input.down = g.input.left = g.input.right = false;
      if (mode === 'play' && overlay === 'none') pause();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    const onMove = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      mouse = { x: (e.clientX - r.left) / R.zoom, y: (e.clientY - r.top) / R.zoom };
    };
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mousedown', (e) => {
      el.focus();
      if (mode === 'play' && overlay === 'none') {
        onMove(e);
        if (e.button === 0) g.shoot();
      }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    const onResize = () => R.resize();
    window.addEventListener('resize', onResize);

    // ---------- loop ----------
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      titleT += dt;
      if (import.meta.env.DEV) (window as unknown as { __sv: Game }).__sv = g;

      if (mode === 'title' || mode === 'create') {
        g.time += dt;
        cam.x = CX + 0.5 + Math.sin(titleT * 0.05) * 40;
        cam.y = CY + 70 + Math.cos(titleT * 0.05) * 30;
        cam.z = FLOOR_H + 2;
        R.draw(g, cam, { hud: false, hideHero: true });
        if (mode === 'title') drawOrb();
        else drawPreview();
        return;
      }

      if (mode === 'cutscene') {
        runCutscene(dt);
        return;
      }

      if (mode === 'play' && overlay === 'none') {
        // aim from mouse
        const w = R.toWorld(cam, mouse.x, mouse.y, g.p.z + 1);
        g.input.aimX = w.x - g.p.x;
        g.input.aimY = w.y - g.p.y;
        let left = dt;
        while (left > 0) {
          const step = Math.min(left, 1 / 60);
          g.update(step);
          left -= step;
        }
        if (g.lost && !endShown) endScreen(false);
        if (g.won && g.boss.deadT > 4 && !endShown) endScreen(true);
      }
      const k = Math.min(1, dt * 7);
      cam.x += (g.p.x - cam.x) * k;
      cam.y += (g.p.y - cam.y) * k;
      cam.z += (g.p.z - cam.z) * k;
      R.draw(g, cam, { hud: true });
    }

    function runCutscene(dt: number) {
      cut.t += dt;
      g.time += dt;
      const t = cut.t;
      const top = FLOOR_H + 9;
      let form = 0, bz = top;
      if (t < 3) {
        cutText('Deep in the middle of the land stands an old castle…');
      } else if (t < 7.5) {
        cutText('One day, a dark gloom poured out of it…');
        form = Math.max(0, (t - 4) / 3.5);
      } else if (t < 10) {
        cutText('…and formed the Dark Beast.');
        form = 1;
        bz = top - ((t - 7.5) / 2.5) * (top - FLOOR_H - 1.6);
      } else {
        form = 1;
        bz = FLOOR_H + 1.6;
        cutText(`Defeat it within 4 hours, ${g.p.name}, or the world goes black.`);
      }
      // gloom pouring out of the castle and swirling into a sphere
      if (t < 8 && Math.random() < 0.9) {
        for (let i = 0; i < 3; i++)
          cut.motes.push({ x: CX + 0.5 + (Math.random() - 0.5) * 18, y: CY + 0.5 + (Math.random() - 0.5) * 18, z: FLOOR_H + Math.random() * 2, a: Math.random() * 7, r: 0, life: 3 });
      }
      for (const m of cut.motes) {
        m.life -= dt;
        // pull toward the forming sphere
        const dx = CX + 0.5 - m.x, dy = CY + 0.5 - m.y, dz = bz - m.z;
        m.x += dx * dt * 0.9 + Math.cos(m.a + t * 2) * dt * 2;
        m.y += dy * dt * 0.9 + Math.sin(m.a + t * 2) * dt * 2;
        m.z += dz * dt * 0.9;
      }
      cut.motes = cut.motes.filter((m) => m.life > 0);
      // camera: castle, then fly to the hero
      if (t > 10.5) {
        const k = Math.min(1, (t - 10.5) / 3);
        const e = k * k * (3 - 2 * k);
        cam.x = CX + 0.5 + (g.p.x - CX - 0.5) * e;
        cam.y = CY + 0.5 + (g.p.y - CY - 0.5) * e;
        cam.z = FLOOR_H + (g.p.z - FLOOR_H) * e;
      } else {
        cam.x = CX + 0.5;
        cam.y = CY + 6;
        cam.z = FLOOR_H + 3;
      }
      R.draw(g, cam, { hud: false, beastForm: form, beastZ: bz, hideHero: t < 10.5 });
      const ctx = R.ctx;
      for (const m of cut.motes) {
        const X = R.sx(cam, m.x, m.y), Y = R.sy(cam, m.x, m.y, m.z);
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120,40,180,.7)' : 'rgba(20,5,30,.75)';
        ctx.beginPath();
        ctx.arc(X, Y, 4 + Math.random() * 3, 0, 7);
        ctx.fill();
      }
      if (t > 14) play();
    }

    title();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', onResize);
      el.remove();
    };
  },
};

export default game;
