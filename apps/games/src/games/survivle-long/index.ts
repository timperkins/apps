// Survivle (Long Edition): Survivle with a 3× tougher Dark Beast, the Sword of Light, raider camps, shields,
// spears, armor, and 25 more open-world things to find. Saves are kept apart from the first Survivle.
import './style.css';
import type { GameModule } from '../types';
import { Game, type SaveData } from './game';
import { Renderer, drawHero, drawBeast, type Cam } from './render';
import { ARMOR, JOBS, LONG_FEATURES, OUTFITS, PRICES, QUESTS, RECIPES, SHIELDS, bowName, outfitById, shieldById, swordName, TIME_LIMIT } from './data';
import { drawBigMap } from './bigmap';
import { ENCHANTS, ENCH_MAX, ENCH_SLOTS, GEAR_NAMES, enchSrc, roman, type EnchGear } from './enchant';
import { isMuted, setMuted, sfx } from './audio';
import { CX, CY, FLOOR_H, VILLAGES, setVillageCount } from './world';
import { hostGame, joinGame, type Session } from './coop';
import { cleanCode } from './net';

const INDEX_KEY = 'survivle-long-saves';
const slotKey = (id: string) => `survivle-long-slot-${id}`;

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
  <div class="svl-keys">
    <div><b>Arrows / WASD</b> walk · hold <b>X</b> to sprint</div>
    <div><b>Space</b> or click: use your weapon (swords chop trees)</div>
    <div><b>Shift</b> change weapon: sword, bow, spear, Sword of Light</div>
    <div>Hold <b>F</b> or right mouse: block with your shield</div>
    <div><b>Q</b> normal / ice / fire arrows · aim the bow with the mouse</div>
    <div><b>Z</b> jump · <b>Z</b> again in the air to glide · walk into a cliff to climb</div>
    <div><b>E</b> chests · spears · cook · shrines · horses · people</div>
    <div><b>G</b> throw a bomb · <b>M</b> big map</div>
    <div><b>B</b> build a wall (5 wood) · <b>C</b> campfire (3 wood) · <b>H</b> eat</div>
    <div><b>I</b> gear, armor &amp; clothes · <b>N</b> enchant · <b>Esc</b> pause</div>
  </div>`;

const VOICE_KEY = 'survivle-long-voice';
const PITCH_KEY = 'survivle-long-pitch';
function readSetting(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeSetting(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}
const PITCHES: Record<string, number> = { low: 0.6, normal: 1, high: 1.6 };

function voices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  const all = speechSynthesis.getVoices();
  const en = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return (en.length ? en : all).slice(0, 30);
}

function narratorOptions(cur: string, pitch: string) {
  const vs = voices();
  return `
    <div class="svl-voice">
      <label>Narrator
        <select data-set="voice">
          <option value="auto" ${cur === 'auto' ? 'selected' : ''}>Default voice</option>
          ${vs.map((v) => `<option value="${esc(v.name)}" ${cur === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
          <option value="subs" ${cur === 'subs' ? 'selected' : ''}>Words only (no voice)</option>
          <option value="off" ${cur === 'off' ? 'selected' : ''}>Off</option>
        </select>
      </label>
      <label>Pitch
        <select data-set="pitch">
          <option value="low" ${pitch === 'low' ? 'selected' : ''}>Low</option>
          <option value="normal" ${pitch === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="high" ${pitch === 'high' ? 'selected' : ''}>High</option>
        </select>
      </label>
    </div>`;
}

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'svl';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="svl-canvas"></canvas><div class="svl-say" hidden></div>
      <div class="svl-touch" hidden>
        <div class="svl-stick"><div class="svl-knob"></div></div>
        <div class="svl-tbtns">
          <button data-t="swing" class="big">⚔️</button>
          <button data-t="switch">🔄</button>
          <button data-t="jump">⤒</button>
          <button data-t="block">🛡</button>
          <button data-t="act">E</button>
          <button data-t="bomb">💣</button>
          <button data-t="ice">➶</button>
          <button data-t="build">🧱</button>
          <button data-t="fire">🔥</button>
          <button data-t="eat">🍎</button>
        </div>
        <div class="svl-ttop"><button data-t="gear">🎒</button><button data-t="ench">✨</button><button data-t="pause">⏸</button><button data-t="map">🗺</button><button data-t="sprint">🏃</button></div>
      </div>
      <div class="svl-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const sayEl = el.querySelector<HTMLDivElement>('.svl-say')!;

    // ---------- narrator ----------
    let voiceName = readSetting(VOICE_KEY, 'auto');
    let pitch = readSetting(PITCH_KEY, 'normal');
    const lastSaid = new Map<string, number>();
    let quietUntil = 0;
    let sayTimer = 0;
    function speak(text: string, urgent: boolean) {
      sayEl.textContent = text;
      sayEl.hidden = false;
      sayEl.classList.remove('in');
      void sayEl.offsetWidth;
      sayEl.classList.add('in');
      clearTimeout(sayTimer);
      sayTimer = window.setTimeout(() => (sayEl.hidden = true), 2600 + text.length * 45);
      if (voiceName === 'subs' || !('speechSynthesis' in window)) return;
      try {
        if (urgent) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = voices().find((x) => x.name === voiceName);
        if (v) u.voice = v;
        u.pitch = PITCHES[pitch] ?? 1;
        u.rate = 1.05;
        speechSynthesis.speak(u);
      } catch {
        /* speech not available */
      }
    }
    function narrate(key: string, text: string, cooldown = 40) {
      if (voiceName === 'off') return;
      const now = performance.now() / 1000;
      if ((lastSaid.get(key) ?? -1e9) + cooldown > now) return;
      const urgent = cooldown <= 10 || cooldown >= 999;
      if (now < quietUntil && !urgent) return;
      lastSaid.set(key, now);
      quietUntil = now + 4;
      speak(text, urgent);
    }
    function hush() {
      sayEl.hidden = true;
      try {
        if ('speechSynthesis' in window) speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => {
      const sel = ui.querySelector<HTMLSelectElement>('select[data-set=voice]');
      if (sel && sel.options.length <= 3) {
        const holder = sel.closest('.svl-voice');
        if (holder) holder.outerHTML = narratorOptions(voiceName, pitch);
      }
    });
    const ui = el.querySelector<HTMLDivElement>('.svl-ui')!;
    // ---------- touch controls (phones and tablets) ----------
    const touchEl = el.querySelector<HTMLDivElement>('.svl-touch')!;
    let touchMode = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    const stick = touchEl.querySelector<HTMLDivElement>('.svl-stick')!;
    const knob = touchEl.querySelector<HTMLDivElement>('.svl-knob')!;
    let stickId: number | null = null;
    const setStick = (cx: number, cy: number) => {
      const r = stick.getBoundingClientRect();
      const mx = r.left + r.width / 2, my = r.top + r.height / 2, rad = r.width / 2;
      let dx = (cx - mx) / rad, dy = (cy - my) / rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
      const dead = 0.32;
      g.input.left = dx < -dead;
      g.input.right = dx > dead;
      g.input.up = dy < -dead;
      g.input.down = dy > dead;
    };
    const releaseStick = () => {
      stickId = null;
      knob.style.transform = '';
      g.input.up = g.input.down = g.input.left = g.input.right = false;
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      setStick(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) setStick(e.clientX, e.clientY);
    });
    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);
    touchEl.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-t]');
      if (!b) return;
      e.preventDefault();
      if (mode !== 'play') return;
      const a = b.dataset.t;
      if (a === 'pause') return overlay === 'none' ? pause() : play();
      if (a === 'gear') return overlay === 'gear' ? play() : overlay === 'none' ? gear() : undefined;
      if (a === 'map') return overlay === 'map' ? play() : overlay === 'none' ? bigMap() : undefined;
      if (a === 'ench') return overlay === 'ench' ? play() : overlay === 'none' ? enchMenu() : undefined;
      if (overlay !== 'none') return;
      if (a === 'swing') g.attack();
      else if (a === 'switch') g.lx.cycleWeapon(g);
      else if (a === 'block') {
        touchBlock = e.pointerId;
        setBlock(true);
      } else if (a === 'bomb') g.lx.throwBomb(g);
      else if (a === 'sprint') {
        g.lx.sprint = !g.lx.sprint;
        b.classList.toggle('on', g.lx.sprint);
      }
      else if (a === 'jump') g.jump();
      else if (a === 'act') g.interact();
      else if (a === 'build') g.build();
      else if (a === 'fire') g.campfire();
      else if (a === 'eat') g.eat();
      else if (a === 'ice') g.toggleIce();
    });
    touchEl.addEventListener('contextmenu', (e) => e.preventDefault());
    let touchBlock: number | null = null;
    const setBlock = (on: boolean) => {
      if (on && !g.lx.shield) {
        if (!g.lx.blocking) g.toast('No shield! Raiders drop them, and the blacksmith sells them.');
        return;
      }
      g.lx.blocking = on;
    };
    const touchUp = (e: PointerEvent) => {
      if (e.pointerId === touchBlock) {
        touchBlock = null;
        setBlock(false);
      }
    };
    window.addEventListener('pointerup', touchUp);
    window.addEventListener('pointercancel', touchUp);
    window.addEventListener('touchstart', () => (touchMode = true), { once: true, passive: true });
    const R = new Renderer(cv);
    R.resize();

    type Mode = 'title' | 'create' | 'cutscene' | 'play' | 'end';
    let mode: Mode = 'title';
    let overlay: 'none' | 'pause' | 'gear' | 'shop' | 'load' | 'jobs' | 'cook' | 'shrine' | 'smith' | 'elder' | 'map' | 'ench' = 'none';
    let g = new Game('', 12345);
    const cam: Cam = { x: CX + 0.5, y: CY + 30, z: FLOOR_H };
    let titleT = 0;
    let cut = { t: 0, motes: [] as { x: number; y: number; z: number; a: number; r: number; life: number }[] };
    let mouse = { x: 0, y: 0 };
    let raf = 0;
    let last = performance.now();
    let endShown = false;
    let session: Session | null = null;
    let hosting = false;
    const endSession = () => {
      session?.close();
      session = null;
      hosting = false;
    };

    // ---------- screens ----------
    const show = (html: string) => {
      ui.innerHTML = html;
    };

    function title() {
      mode = 'title';
      overlay = 'none';
      endSession();
      setVillageCount(2);
      g = new Game('', 777);
      cam.x = CX + 0.5;
      cam.y = CY + 60;
      cam.z = FLOOR_H;
      const saves = listSaves();
      show(`
        <div class="svl-title">
          <div class="svl-logo"><canvas class="svl-orb" width="120" height="120"></canvas><h1>Survivle</h1><div class="svl-edition">Long Edition</div></div>
          <p class="svl-tag">The gloom is spreading from the castle, and the Dark Beast is three times stronger now. Find the Sword of Light, raid the raider camps, and beat it in 4 hours, or the world goes black.</p>
          <div class="svl-menu">
            <button data-a="new" class="svl-btn big">New game</button>
            ${saves.length ? '<button data-a="load" class="svl-btn">Load game</button>' : ''}
            <button data-a="joinmenu" class="svl-btn">Join a friend</button>
            <button data-a="exit" class="svl-btn ghost">Back to games</button>
          </div>
          ${CONTROLS}
          <details class="svl-new"><summary>What's new in the Long Edition</summary>
            <ul>
              <li><b>The Dark Beast is 3× harder</b>: 1,500 health, hits harder and attacks faster.</li>
              <li><b>The Sword of Light</b>: 30 damage, double to bosses. You need 12 full hearts to pull it out. Follow the gold arrow.</li>
              <li><b>Raider camps</b> around a fire with 4 spears with apples on them. Take the spears!</li>
              <li><b>Raiders</b> with swords, bows, spears, armor and shields. <b>Shields break</b>, yours too.</li>
              <li><b>Enchanting</b> (N or ✨): 10 enchantments with pictures, like Boom Shot (every 4th arrow explodes 3 seconds later), Chain Zap, Whirlwind and Spikes. Level up to get points.</li>
              <li><b>Shift</b> changes weapons. <b>Armor</b> from the blacksmith, captains and loot chests.</li>
              ${LONG_FEATURES.map((f, i) => `<li>${i + 1}. ${esc(f)}</li>`).join('')}
            </ul>
          </details>
          ${narratorOptions(voiceName, pitch)}
          <p class="svl-note">Plays with a keyboard and mouse, or with the touch buttons on a phone. Saves are separate from the first Survivle.</p>
        </div>`);
      drawOrb();
    }

    function drawOrb() {
      const oc = ui.querySelector<HTMLCanvasElement>('.svl-orb');
      if (!oc) return;
      const x = oc.getContext('2d')!;
      x.clearRect(0, 0, 120, 120);
      x.save();
      x.translate(60, 60);
      drawBeast(x, 36, titleT, 0, false);
      x.restore();
    }

    function joinMenu(msg = '') {
      mode = 'create';
      newOutfit = 'forest';
      show(`
        <div class="svl-panel svl-create">
          <h2>Join a friend</h2>
          <canvas class="svl-preview" width="160" height="180"></canvas>
          <p class="svl-dim">Your friend opens their game, presses Esc, then <b>Play with friends</b> to get a code. Then fight each other! Swords and arrows hit other players: every 4 damage your weapon does takes 1 heart. Murk hits only do ¼ heart.</p>
          <label>Name <input class="svl-name" maxlength="16" placeholder="Type a name" autocomplete="off" value="${esc(readSetting('survivle-long-coop-name', ''))}"></label>
          <label>Code <input class="svl-code" maxlength="12" placeholder="ABCDE" autocomplete="off" autocapitalize="characters"></label>
          ${msg ? `<p class="svl-msg">${esc(msg)}</p>` : ''}
          <div class="svl-row"><button data-a="back" class="svl-btn ghost">Back</button><button data-a="join" class="svl-btn big">Join</button></div>
        </div>`);
      const code = ui.querySelector<HTMLInputElement>('.svl-code')!;
      for (const inp of ui.querySelectorAll<HTMLInputElement>('input')) {
        inp.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') join();
        });
      }
      code.addEventListener('input', () => (code.value = cleanCode(code.value)));
      (ui.querySelector<HTMLInputElement>('.svl-name')!.value ? code : ui.querySelector<HTMLInputElement>('.svl-name')!).focus();
      drawPreview();
    }

    async function join() {
      const name = (ui.querySelector<HTMLInputElement>('.svl-name')?.value.trim() || 'Hero').slice(0, 16);
      const code = cleanCode(ui.querySelector<HTMLInputElement>('.svl-code')?.value ?? '');
      if (!code) return joinMenu('Type the code from your friend\'s screen.');
      writeSetting('survivle-long-coop-name', name);
      const btn = ui.querySelector<HTMLButtonElement>('[data-a=join]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Joining…';
      }
      try {
        const res = await joinGame(code, name, newOutfit, (why) => {
          if (session?.role !== 'guest') return;
          session = null;
          title();
          g.toast(why);
          const tag = ui.querySelector('.svl-tag');
          if (tag) tag.textContent = `${why}.`;
        });
        endSession();
        g = res.game;
        session = res.session;
        hookGame();
        cam.x = g.p.x;
        cam.y = g.p.y;
        cam.z = g.p.z;
        endShown = false;
        g.toast('Fight! Your weapon hurts players: 4 damage = 1 heart. Murks only do ¼ heart.');
        play();
      } catch (err) {
        joinMenu((err as Error).message || 'Could not join');
      }
    }

    async function openToFriends() {
      if (session) return;
      hosting = true;
      pause();
      try {
        session = await hostGame(g, () => overlay === 'pause' && pause());
        g.coopLabel = `Co-op · code ${session.code}`;
      } catch (err) {
        g.toast(`Could not open the game: ${(err as Error).message}`);
      }
      hosting = false;
      if (overlay === 'pause') pause();
    }

    let newOutfit = 'forest';
    function create() {
      mode = 'create';
      show(`
        <div class="svl-panel svl-create">
          <h2>Who is your hero?</h2>
          <canvas class="svl-preview" width="160" height="180"></canvas>
          <label>Name <input class="svl-name" maxlength="16" placeholder="Type a name" autocomplete="off"></label>
          <p class="svl-dim">You start in green: green shirt, green pants and a dark green hood. Traders sell more clothes later.</p>
          <div class="svl-row"><button data-a="back" class="svl-btn ghost">Back</button><button data-a="begin" class="svl-btn big">Begin</button></div>
        </div>`);
      newOutfit = 'forest';
      const input = ui.querySelector<HTMLInputElement>('.svl-name')!;
      input.focus();
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') begin();
      });
      drawPreview();
    }

    function drawPreview() {
      const pc = ui.querySelector<HTMLCanvasElement>('.svl-preview');
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
      endSession();
      setVillageCount(2);
      const input = ui.querySelector<HTMLInputElement>('.svl-name');
      const name = (input?.value.trim() || 'Hero').slice(0, 16);
      g = new Game(name, Math.floor(Math.random() * 1e9));
      g.p.outfit = newOutfit;
      hookGame();
      startCutscene();
    }

    function hookGame() {
      g.onShop = openShop;
      g.onJobs = jobsMenu;
      g.onSay = narrate;
      g.lx.onCook = () => cookMenu();
      g.lx.onShrine = (key) => shrineMenu(key);
      g.lx.onSmith = (vi) => smithMenu(vi);
      g.lx.onElder = (vi) => elderMenu(vi);
    }

    function enchMenu(msg = '') {
      overlay = 'ench';
      const en = g.lx.en;
      const gearBox = (gear: EnchGear) => {
        const used = en.on(gear).length;
        return `<div class="svl-ench-gear"><h3>${GEAR_NAMES[gear]} <span class="svl-sub">${used} / ${ENCH_SLOTS} slots</span></h3>
          ${ENCHANTS.filter((d) => d.gear === gear).map((d) => {
            const l = en.get(d.id);
            const why = en.blocked(d.id);
            const dots = Array.from({ length: ENCH_MAX }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
            return `<button class="svl-ench ${l ? 'has' : ''}" data-a="ench" data-id="${d.id}" ${why ? 'disabled' : ''} style="--c:${d.color}">
              <img src="${enchSrc(d)}" alt="" width="52" height="52">
              <span class="svl-ench-txt"><b>${d.name}${l ? ` ${roman(l)}` : ''}</b><span class="svl-dots">${dots}</span>
              <span class="svl-sub">${esc(d.what(Math.min(ENCH_MAX, l + (l < ENCH_MAX ? 1 : 0))))}${l && l < ENCH_MAX ? ' (next level)' : ''}</span></span>
              <em>${l >= ENCH_MAX ? 'MAX' : why && !why.startsWith('Needs') ? 'full' : `${en.cost(d.id)} ✨`}</em></button>`;
          }).join('')}</div>`;
      };
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>✨ Enchanting</h2>
          <p class="svl-dim">Level <b>${en.level}</b> · ${en.xp} / ${en.xpNeed()} xp to the next level · <b class="svl-pts">${en.points} enchantment point${en.points === 1 ? '' : 's'}</b><br>
          Beat enemies, clear camps and wake shrines to level up. Every level gives 1 point. Level I costs 1 point, II costs 2, III costs 3. Each kind of gear holds ${ENCH_SLOTS} enchantments.</p>
          ${msg ? `<p class="svl-msg">${esc(msg)}</p>` : ''}
          <div class="svl-cols">${gearBox('melee')}${gearBox('bow')}${gearBox('armor')}</div>
          <div class="svl-row"><button data-a="unench" class="svl-btn ghost" ${en.spent() ? '' : 'disabled'}>Take them all off (get points back)</button><button data-a="close" class="svl-btn big">Done</button></div>
        </div></div>`);
    }

    function cookMenu(msg = '') {
      overlay = 'cook';
      const lx = g.lx;
      const names: Record<string, string> = { apple: '🍎', acorn: '🌰', red: '🍄red', blue: '🍄blue', meat: '🍖' };
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>Cooking</h2>
          <p class="svl-dim">You have 🍎 ${g.apples} · 🌰 ${g.acorns} · red 🍄 ${lx.red} · blue 🍄 ${lx.blue} · 🍖 ${lx.meat}. Mushrooms grow in forests, wolves drop meat.</p>
          ${msg ? `<p class="svl-msg">${esc(msg)}</p>` : ''}
          <div class="svl-shop">
            ${RECIPES.map((r) => `<button class="svl-item" data-a="cook" data-id="${r.id}" ${lx.have(r.needs, g) ? '' : 'disabled'}>
              <b>${r.icon} ${r.name}</b><span class="svl-sub">${r.desc}</span><em>${Object.entries(r.needs).map(([k, n]) => `${n} ${names[k]}`).join(' + ')}</em></button>`).join('')}
          </div>
          <div class="svl-row"><button data-a="close" class="svl-btn big">Done</button></div>
        </div></div>`);
    }

    function shrineMenu(key: number, msg = '') {
      overlay = 'shrine';
      const lx = g.lx;
      const list = lx.shrineList(g).filter((s) => s.key !== key);
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>Shrine</h2>
          <p class="svl-dim">Spirit orbs: <b>${lx.orbs}</b>. Every new shrine you wake gives one. Trade 4 for a heart or more stamina.</p>
          ${msg ? `<p class="svl-msg">${esc(msg)}</p>` : ''}
          <div class="svl-shop">
            <button class="svl-item" data-a="orbheart" ${lx.orbs >= 4 ? '' : 'disabled'}>❤ A new heart <em>4 orbs</em></button>
            <button class="svl-item" data-a="orbstam" ${lx.orbs >= 4 ? '' : 'disabled'}>🟢 Stamina lasts longer <em>4 orbs</em></button>
          </div>
          <h3>Travel to another shrine</h3>
          <div class="svl-shop">
            ${list.length ? list.slice(0, 16).map((s) => `<button class="svl-item" data-a="travel" data-id="${s.key}">✦ Shrine <em>${Math.round(Math.hypot(s.x - g.p.x, s.y - g.p.y))} tiles</em></button>`).join('') : '<p class="svl-dim">Wake more shrines to travel between them.</p>'}
          </div>
          <div class="svl-row"><button data-a="close" class="svl-btn big">Done</button></div>
        </div></div>`);
      ui.dataset.shrine = String(key);
    }

    function smithMenu(vi: number, msg = '') {
      overlay = 'smith';
      const lx = g.lx;
      const sh = lx.shield ? shieldById(lx.shield.id) : null;
      const cost = lx.repairCost();
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>${esc(VILLAGES[vi]?.name ?? '')} blacksmith</h2>
          <p class="svl-dim">"Armor soaks up hits. Shields block hits from the front, until they break." · You have <b>${g.coins}</b> coins.</p>
          ${msg ? `<p class="svl-msg">${esc(msg)}</p>` : ''}
          <h3>Armor (tap one you own to wear or take it off)</h3>
          <div class="svl-shop">
            ${ARMOR.map((a) => { const own = lx.ownedArmor.includes(a.id); const on = lx.armor[a.slot] === a.id;
              return `<button class="svl-item ${on ? 'on' : ''}" data-a="armor" data-id="${a.id}"><i style="background:${a.color};border-color:#222"></i>${a.name} <span class="svl-sub">${Math.round(a.def * 100)}%${a.warm ? ' · warm' : ''}</span><em>${on ? 'wearing' : own ? 'wear' : `${a.price} coins`}</em></button>`; }).join('')}
          </div>
          <h3>Shields ${sh ? `(yours: ${sh.name}, ${lx.shield!.hp} / ${sh.hp})` : '(you have none)'}</h3>
          <div class="svl-shop">
            ${SHIELDS.filter((q) => q.price).map((q) => `<button class="svl-item" data-a="shield" data-id="${q.id}"><i style="background:${q.color};border-color:${q.rim}"></i>${q.name} <span class="svl-sub">${q.hp} strength</span><em>${q.price} coins</em></button>`).join('')}
            ${sh ? `<button class="svl-item" data-a="repair" ${cost ? '' : 'disabled'}>🔨 Fix my shield <em>${cost ? `${cost} coins` : 'like new'}</em></button>` : ''}
          </div>
          <div class="svl-row"><button data-a="close" class="svl-btn big">Bye!</button></div>
        </div></div>`);
      ui.dataset.village = String(vi);
    }

    function elderMenu(vi: number) {
      overlay = 'elder';
      const msg = g.lx.questTalk(g, vi);
      const q = g.lx.quest ? QUESTS.find((x) => x.id === g.lx.quest!.id) : null;
      show(`
        <div class="svl-dim-bg"><div class="svl-panel">
          <h2>${esc(VILLAGES[vi]?.name ?? '')} elder</h2>
          <p>${esc(msg)}</p>
          ${q ? `<p class="svl-dim">Reward: ${q.coins} coins</p>` : `<p class="svl-dim">Quests done: ${g.lx.questsDone}. Talk to me again for a new one!</p>`}
          <div class="svl-row"><button data-a="close" class="svl-btn big">OK</button></div>
        </div></div>`);
    }

    function bigMap() {
      overlay = 'map';
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide svl-mapbox">
          <h2>Map</h2>
          <canvas class="svl-bigmap" width="640" height="420"></canvas>
          <p class="svl-dim">You are the white arrow. 🔥 raider camps · ✦ shrines (gold = woken) · ▲ watchtowers · ◎ healing springs · ◆ ore · ✨ the Sword of Light. Climb watchtowers to see more.</p>
          <div class="svl-row"><button data-a="close" class="svl-btn big">Close (M)</button></div>
        </div></div>`);
      const c = ui.querySelector<HTMLCanvasElement>('.svl-bigmap');
      if (c) drawBigMap(c, g);
    }

    function jobsMenu(vi: number) {
      overlay = 'jobs';
      const v = VILLAGES[vi];
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>${esc(v.name)} job board</h2>
          <p class="svl-dim">Pick a job to earn coins. You can have one job at a time and change it here whenever you like.</p>
          <div class="svl-jobs">
            ${JOBS.map((j) => `<button class="svl-item job ${g.job === j.id ? 'on' : ''}" data-a="takejob" data-id="${j.id}" data-v="${vi}">
              <b>${j.icon} ${j.name}</b><span>${j.desc}</span></button>`).join('')}
          </div>
          <div class="svl-row">${g.job ? '<button data-a="quitjob" class="svl-btn ghost">Quit my job</button>' : ''}<button data-a="close" class="svl-btn big">Done</button></div>
        </div></div>`);
    }

    function startCutscene() {
      mode = 'cutscene';
      overlay = 'none';
      cut = { t: 0, motes: [] };
      cam.x = CX + 0.5;
      cam.y = CY + 0.5;
      cam.z = FLOOR_H;
      show(`<div class="svl-cut"><div class="svl-cut-text"></div><div class="svl-skip">Space to skip</div></div>`);
      sfx.gloom();
      el.focus();
    }

    function cutText(s: string) {
      const t = ui.querySelector('.svl-cut-text');
      if (t && t.textContent !== s) {
        t.textContent = s;
        t.classList.remove('in');
        void (t as HTMLElement).offsetWidth;
        t.classList.add('in');
      }
    }

    function play() {
      if (mode === 'cutscene') {
        hush();
        setTimeout(() => g.say('start', 'Here we go! The Dark Beast is much stronger now. Follow the gold arrow to the Sword of Light, and raid the raider camps for spears and loot!', 5), 600);
      }
      mode = 'play';
      overlay = 'none';
      show('');
      el.focus();
    }

    function pause() {
      overlay = 'pause';
      show(`
        <div class="svl-dim-bg"><div class="svl-panel">
          <h2>Paused</h2>
          <p class="svl-dim">${esc(g.p.name)} · Darkness in ${fmtTime(g.timeLeft)}</p>
          ${coopBox()}
          <div class="svl-menu">
            <button data-a="resume" class="svl-btn big">Resume</button>
            ${g.role === 'guest' ? '' : '<button data-a="save" class="svl-btn">Save</button><button data-a="load" class="svl-btn">Load</button>'}
            <button data-a="gear" class="svl-btn">Gear &amp; clothes</button>
            <button data-a="enchmenu" class="svl-btn">✨ Enchant${g.lx.en.points ? ` (${g.lx.en.points})` : ''}</button>
            ${g.role === 'guest' ? '<button data-a="leave" class="svl-btn">Leave game</button>' : '<button data-a="savequit" class="svl-btn">Save and quit</button>'}
            <button data-a="mute" class="svl-btn ghost">${isMuted() ? 'Sound: off' : 'Sound: on'}</button>
          </div>
          ${narratorOptions(voiceName, pitch)}
          ${CONTROLS}
        </div></div>`);
    }

    function coopBox() {
      if (g.role === 'guest') return `<p class="svl-coop">Playing in a friend's world (${esc(session?.code ?? '')}). You can fight each other: 4 weapon damage = 1 heart. Murk hits do ¼ heart. The game keeps going while this menu is open.</p>`;
      if (session) {
        const names = g.others.map((o) => esc(o.name)).join(', ');
        return `<div class="svl-coop"><div>Friends join with this code</div><b class="svl-bigcode">${esc(session.code)}</b>
          <div>${names ? `Here now: ${names}` : 'Waiting for friends…'} · fight each other: 4 weapon damage = 1 heart</div>
          <button data-a="stophost" class="svl-btn ghost">Stop playing together</button></div>`;
      }
      if (hosting) return '<p class="svl-coop">Opening your game to friends…</p>';
      return '<button data-a="host" class="svl-btn svl-coop-btn">Play with friends (fight each other)</button>';
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
        <div class="svl-dim-bg"><div class="svl-panel">
          <h2>Load a game</h2>
          <div class="svl-saves">
            ${saves.length ? saves.map((s) => `
              <div class="svl-save">
                <button class="svl-btn" data-a="loadslot" data-id="${s.id}"><b>${esc(s.name)}</b>
                <span>${s.won ? 'Beat the Dark Beast!' : `${fmtTime(Math.max(0, TIME_LIMIT - s.elapsed))} left`} · ${new Date(s.savedAt).toLocaleString()}</span></button>
                <button class="svl-x" data-a="delslot" data-id="${s.id}" title="Delete">✕</button>
              </div>`).join('') : '<p class="svl-dim">No saves yet.</p>'}
          </div>
          <div class="svl-row"><button data-a="${from === 'title' ? 'totitle' : 'topause'}" class="svl-btn ghost">Back</button></div>
        </div></div>`);
    }

    function loadSlot(id: string) {
      const data = readJSON<SaveData | null>(slotKey(id), null);
      if (!data) return;
      endSession();
      setVillageCount(2);
      g = Game.fromSave(data);
      hookGame();
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
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>Gear &amp; clothes</h2>
          <div class="svl-cols">
            <div><h3>Swords</h3>${swords.map((d) => `<button class="svl-item ${g.swordDmg === d ? 'on' : ''}" data-a="eqs" data-d="${d}">⚔ ${swordName(d)} <em>${d} dmg</em></button>`).join('')}</div>
            <div><h3>Bows</h3>${bows.map((d) => `<button class="svl-item ${g.bowDmg === d ? 'on' : ''}" data-a="eqb" data-d="${d}">🏹 ${bowName(d)} <em>${d} dmg</em></button>`).join('')}
              <p class="svl-dim">${g.arrows} arrows · ${g.wood} wood · ${g.coins} coins · ${g.apples} apples</p></div>
            <div><h3>Clothes</h3>${g.owned.map((id) => { const o = outfitById(id); return `<button class="svl-item ${g.p.outfit === id ? 'on' : ''}" data-a="wear" data-id="${id}"><i style="background:${o.shirt};border-color:${o.hood}"></i>${o.name}</button>`; }).join('')}</div>
          </div>
          <div class="svl-cols">
            <div><h3>In your hand (Shift)</h3>${g.lx.weapons().map((w) => `<button class="svl-item ${g.lx.weapon === w ? 'on' : ''}" data-a="weapon" data-id="${w}">${g.lx.weaponIcon(w)} ${esc(g.lx.weaponLabel(g, w))}</button>`).join('')}
              ${g.lx.light ? '' : '<p class="svl-dim">✨ The Sword of Light waits in a ring of trees (gold arrow). You need 12 full hearts to pull it out.</p>'}</div>
            <div><h3>Armor (${Math.round(g.lx.armorDef() * 100)}% less damage)</h3>${g.lx.ownedArmor.length ? g.lx.ownedArmor.map((id) => { const a = ARMOR.find((q) => q.id === id)!; return `<button class="svl-item ${g.lx.armor[a.slot] === id ? 'on' : ''}" data-a="armor" data-id="${id}"><i style="background:${a.color};border-color:#222"></i>${a.name}${a.warm ? ' (warm)' : ''}</button>`; }).join('') : '<p class="svl-dim">No armor yet. The blacksmith in each village sells it.</p>'}</div>
            <div><h3>Shield &amp; more</h3><p class="svl-dim">${g.lx.shield ? `🛡 ${shieldById(g.lx.shield.id)?.name}: ${g.lx.shield.hp} / ${shieldById(g.lx.shield.id)?.hp}` : '🛡 No shield'}<br>💣 ${g.lx.bombs} bombs · 🔥 ${g.lx.fireArrows} fire arrows · ❄ ${g.iceArrows} ice arrows<br>🍄 ${g.lx.red} red, ${g.lx.blue} blue · 🍖 ${g.lx.meat} meat<br>🔮 ${g.lx.orbs} spirit orbs · ⭐ ${g.lx.stars} · 💎 ${g.lx.gems}${g.lx.glider ? '<br>🪂 Glider' : ''}</p></div>
          </div>
          <div class="svl-row"><button data-a="enchmenu" class="svl-btn">✨ Enchant${g.lx.en.points ? ` (${g.lx.en.points} points)` : ''}</button></div>
          <p class="svl-dim">Chests hide on cliff tops and deep in forests. Each one holds a better sword or bow (up to 5 damage better than your best). The best sword does 15. Four mini bosses guard the corners of the map: beat one for a permanent heart.</p>
          <div class="svl-row"><button data-a="close" class="svl-btn big">Done</button></div>
        </div></div>`);
    }

    function openShop() {
      overlay = 'shop';
      shopHtml();
    }
    function shopHtml(msg = '') {
      show(`
        <div class="svl-dim-bg"><div class="svl-panel wide">
          <h2>Trader</h2>
          <p class="svl-dim">"Wood for coins, coins for anything!" · You have <b>${g.coins}</b> coins, <b>${g.wood}</b> wood.</p>
          ${msg ? `<p class="svl-msg">${msg}</p>` : ''}
          <div class="svl-shop">
            <button class="svl-item" data-a="sellwood" ${g.wood ? '' : 'disabled'}>🪵 Sell all wood <em>+${g.wood * PRICES.woodSell} coins</em></button>
            <button class="svl-item" data-a="buyarrows">🏹 10 arrows <em>${PRICES.arrows10} coins</em></button>
            <button class="svl-item" data-a="buyice">❄ 10 ice arrows (freeze a Murk for 10 s, ⅒ damage) <em>${PRICES.ice10} coins</em></button>
            <button class="svl-item" data-a="buyapple">🍎 Apple (heals 1 heart) <em>${PRICES.apple} coins</em></button>
            <button class="svl-item" data-a="buyfire">🔥 10 fire arrows (they burn) <em>${PRICES.fire10} coins</em></button>
            <button class="svl-item" data-a="buybomb">💣 Bomb (G to throw, breaks shields) <em>${PRICES.bomb} coins</em></button>
            ${g.lx.glider ? '' : `<button class="svl-item" data-a="buyglider">🪂 Glider (Z in the air) <em>${PRICES.glider} coins</em></button>`}
            ${g.lx.stars ? `<button class="svl-item" data-a="sellstars">⭐ Sell ${g.lx.stars} star fragment${g.lx.stars > 1 ? 's' : ''} <em>+${g.lx.stars * PRICES.starSell} coins</em></button>` : ''}
            ${g.lx.gems ? `<button class="svl-item" data-a="sellgems">💎 Sell ${g.lx.gems} gem${g.lx.gems > 1 ? 's' : ''} <em>+${g.lx.gems * PRICES.gemSell} coins</em></button>` : ''}
          </div>
          <h3>Clothes</h3>
          <div class="svl-shop">
            ${OUTFITS.filter((o) => o.price > 0).map((o) => g.owned.includes(o.id)
              ? `<button class="svl-item" data-a="wear2" data-id="${o.id}"><i style="background:${o.shirt};border-color:${o.hood}"></i>${o.name} <em>${g.p.outfit === o.id ? 'wearing' : 'wear'}</em></button>`
              : `<button class="svl-item" data-a="buyoutfit" data-id="${o.id}"><i style="background:${o.shirt};border-color:${o.hood}"></i>${o.name} <em>${o.price} coins</em></button>`).join('')}
            ${g.owned.includes('forest') ? `<button class="svl-item" data-a="wear2" data-id="forest"><i style="background:#3e9b3a;border-color:#1b4a20"></i>Forest Green <em>${g.p.outfit === 'forest' ? 'wearing' : 'wear'}</em></button>` : ''}
          </div>
          <div class="svl-row"><button data-a="close" class="svl-btn big">Bye!</button></div>
        </div></div>`);
    }

    function endScreen(won: boolean) {
      mode = 'end';
      endShown = true;
      if (won && g.role !== 'guest') save();
      show(`
        <div class="svl-dim-bg ${won ? 'win' : 'lose'}"><div class="svl-panel">
          <h2>${won ? 'You beat the Dark Beast!' : 'The world went black…'}</h2>
          <p>${won
            ? `${esc(g.p.name)} saved the land with ${fmtTime(g.timeLeft)} to spare. The gloom is gone and the sun is back.`
            : `Four hours passed and the Dark Beast's gloom covered everything. Load a save and try again! (Tip: the Sword of Light does double damage to it.)`}</p>
          <div class="svl-menu">
            ${won ? '<button data-a="keepplaying" class="svl-btn big">Keep exploring</button>' : g.role === 'guest' ? '' : '<button data-a="load" class="svl-btn big">Load a save</button>'}
            <button data-a="totitle" class="svl-btn">Title screen</button>
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
        case 'joinmenu': return joinMenu();
        case 'join': return void join();
        case 'host': return void openToFriends();
        case 'stophost': {
          endSession();
          g.coopLabel = '';
          g.toast('Your friends were sent home');
          return pause();
        }
        case 'leave': return title();
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
        case 'enchmenu': return enchMenu();
        case 'ench': return enchMenu(g.lx.en.enchant(b.dataset.id!));
        case 'unench': return enchMenu(g.lx.en.refund());
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
        case 'buyice':
          if (g.coins < PRICES.ice10) return shopHtml('Not enough coins.');
          g.coins -= PRICES.ice10;
          g.iceArrows += 10;
          sfx.coin();
          return shopHtml('10 ice arrows! Press Q (or ❄) to switch to them.');
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
        case 'buyfire':
          if (g.coins < PRICES.fire10) return shopHtml('Not enough coins.');
          g.coins -= PRICES.fire10;
          g.lx.fireArrows += 10;
          sfx.coin();
          return shopHtml('10 fire arrows! Press Q (or ➶) to switch to them.');
        case 'buybomb':
          if (g.coins < PRICES.bomb) return shopHtml('Not enough coins.');
          g.coins -= PRICES.bomb;
          g.lx.bombs++;
          sfx.coin();
          return shopHtml(`A bomb! You have ${g.lx.bombs}. Press G (or 💣) to throw one.`);
        case 'buyglider':
          if (g.coins < PRICES.glider) return shopHtml('Not enough coins.');
          g.coins -= PRICES.glider;
          g.lx.glider = true;
          sfx.coin();
          return shopHtml('A glider! Jump off a cliff, then press Z (or ⤒) in the air to glide.');
        case 'sellstars': {
          const c = g.lx.stars * PRICES.starSell;
          g.coins += c;
          g.lx.stars = 0;
          sfx.coin();
          return shopHtml(`Sold for ${c} coins.`);
        }
        case 'sellgems': {
          const c = g.lx.gems * PRICES.gemSell;
          g.coins += c;
          g.lx.gems = 0;
          sfx.coin();
          return shopHtml(`Sold for ${c} coins.`);
        }
        case 'cook': return cookMenu(g.lx.cook(g, b.dataset.id!));
        case 'orbheart': return shrineMenu(Number(ui.dataset.shrine), g.lx.spendOrbs(g, 'heart'));
        case 'orbstam': return shrineMenu(Number(ui.dataset.shrine), g.lx.spendOrbs(g, 'stamina'));
        case 'travel': {
          g.lx.travel(g, Number(b.dataset.id));
          return play();
        }
        case 'armor': {
          const m = g.lx.buyArmor(g, b.dataset.id!);
          return overlay === 'gear' ? gear() : smithMenu(Number(ui.dataset.village), m);
        }
        case 'shield': return smithMenu(Number(ui.dataset.village), g.lx.buyShield(g, b.dataset.id!));
        case 'repair': return smithMenu(Number(ui.dataset.village), g.lx.repair(g));
        case 'weapon': {
          g.lx.weapon = b.dataset.id as typeof g.lx.weapon;
          return gear();
        }
        case 'keepplaying': return play();
        case 'takejob': {
          g.takeJob(b.dataset.id!, Number(b.dataset.v));
          return play();
        }
        case 'quitjob': {
          g.quitJob();
          g.toast('You quit your job');
          return play();
        }
      }
    });

    ui.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel.dataset.set === 'voice') {
        voiceName = sel.value;
        writeSetting(VOICE_KEY, voiceName);
      } else if (sel.dataset.set === 'pitch') {
        pitch = sel.value;
        writeSetting(PITCH_KEY, pitch);
      } else return;
      lastSaid.delete('test');
      quietUntil = 0;
      narrate('test', voiceName === 'off' ? '' : 'Hi! I will help you on your adventure.', 0);
    });
    ui.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') e.stopPropagation();
    });

    // ---------- input ----------
    const keyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    };
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || (tag === 'SELECT' && e.code !== 'Escape')) return;
      const dir = keyMap[e.code];
      if (dir) {
        g.input[dir] = down;
        e.preventDefault();
      }
      if (e.code === 'KeyX') g.lx.sprint = down && mode === 'play';
      if (e.code === 'KeyF') setBlock(down && mode === 'play' && overlay === 'none');
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
      if (e.code === 'KeyN') {
        if (overlay === 'ench') play();
        else if (overlay === 'none') enchMenu();
        return;
      }
      if (e.code === 'KeyM') {
        if (overlay === 'map') play();
        else if (overlay === 'none') bigMap();
        return;
      }
      if (overlay !== 'none' || e.repeat) {
        if (overlay === 'none' && e.code === 'Space') g.attack();
        return;
      }
      switch (e.code) {
        case 'Space': g.attack(); break;
        case 'ShiftLeft': case 'ShiftRight': g.lx.cycleWeapon(g); break;
        case 'KeyG': g.lx.throwBomb(g); break;
        case 'KeyZ': g.jump(); break;
        case 'KeyE': g.interact(); break;
        case 'KeyC': g.campfire(); break;
        case 'KeyB': g.build(); break;
        case 'KeyQ': g.toggleIce(); break;
        case 'KeyH': g.eat(); break;
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const blur = () => {
      g.input.up = g.input.down = g.input.left = g.input.right = false;
      g.lx.sprint = false;
      g.lx.blocking = false;
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
    cv.addEventListener('pointerdown', (e) => {
      el.focus();
      if (e.pointerType !== 'mouse') {
        touchMode = true;
        return;
      }
      if (mode === 'play' && overlay === 'none') {
        onMove(e);
        if (e.button === 0) g.attack();
        else if (e.button === 2) setBlock(true);
      }
    });
    cv.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 2) setBlock(false);
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

      session?.tick(dt);
      const showTouch = touchMode && mode === 'play' && overlay === 'none';
      if (touchEl.hidden === showTouch) {
        touchEl.hidden = !showTouch;
        if (!showTouch) releaseStick();
      }
      g.autoAim = touchMode;
      if (mode === 'play' && (overlay === 'none' || session)) {
        if (overlay !== 'none') g.input.up = g.input.down = g.input.left = g.input.right = false;
        if (touchMode) {
          // on a phone the bow shoots the way you are facing
          g.input.aimX = 0;
          g.input.aimY = 0;
        } else {
          // aim from mouse
          const w = R.toWorld(cam, mouse.x, mouse.y, g.p.z + 1);
          g.input.aimX = w.x - g.p.x;
          g.input.aimY = w.y - g.p.y;
        }
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
        cutText('…and formed the Dark Beast. This time, it is three times stronger.');
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
      if (form > 0.3 && Math.random() < 0.5) g.gas(CX + 0.5, CY + 0.5, bz);
      g.updateParticles(dt);
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
      window.removeEventListener('pointerup', touchUp);
      window.removeEventListener('pointercancel', touchUp);
      clearTimeout(sayTimer);
      hush();
      endSession();
      el.remove();
    };
  },
};

export default game;
