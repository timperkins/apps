// M.D. (Monster Dungeons): a blocky action dungeon crawler. Gear up with the traders in camp,
// pick a dungeon on the mission map, fight through its rooms and beat the guardian at the end.
import './style.css';
import type { GameModule } from '../types';
import {
  ARMOR, ARMOR_STOCK, LEVELS, TRADERS, MELEE, MONSTERS, PEDDLER_STOCK, RANGED, SMITH_STOCK, SUPPLIES,
  type ArmorId, type GearId, type MeleeId, type RangedId, type SupplyId, type Trader,
} from './data';
import { Game, gearName, gearPrice, newSave, type Input, type SaveData } from './game';
import { Renderer, portrait, heroParts, traderParts } from './render';
import { gearIcon, monsterIcon, supplyIcon } from './art';
import { isMuted, setMuted, sfx } from './audio';

const SAVE_KEY = 'md-save-v1';
const MUTE_KEY = 'md-muted';

function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? (JSON.parse(raw) as SaveData) : null;
    return s && s.v === 1 ? { ...newSave(), ...s } : null;
  } catch {
    return null;
  }
}
function writeSave(s: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}

type Overlay = 'none' | 'title' | 'help' | 'menu' | 'shop' | 'gear' | 'mission' | 'map' | 'dead' | 'done' | 'win';

const LOGO = `<div class="md-logo"><span>M</span><i></i><span>D</span><i></i></div><div class="md-sub">MONSTER DUNGEONS</div>`;

const HELP = `
  <div class="md-keys">
    <div><b>WASD</b> / arrows: walk · <b>mouse</b>: aim</div>
    <div><b>Left click</b>: melee weapon · <b>Right click</b> or <b>F</b>: bow</div>
    <div><b>Space</b> or <b>Shift</b>: dodge roll (you can’t be hit mid-roll)</div>
    <div><b>Q</b>: Healing Draught · <b>R</b>: throw a Fizz Bomb · <b>E</b>: talk, open, use</div>
    <div><b>I</b> or <b>Tab</b>: your gear · <b>M</b>: map · <b>Esc</b>: menu</div>
    <div class="md-dim">On a phone: stick on the left, buttons on the right. Attacks aim at the nearest monster.</div>
  </div>`;

const pct = (n: number) => `${Math.round(n * 100)}%`;

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'md';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="md-canvas"></canvas>
      <div class="md-hud" hidden>
        <div class="md-tl">
          <div class="md-hp"><i></i><span></span></div>
          <div class="md-stats"></div>
          <div class="md-where"></div>
        </div>
        <div class="md-boss" hidden><b></b><div class="md-bossbar"><i></i></div></div>
        <div class="md-btns">
          <button data-a="gear" title="Gear (I)">🎒</button>
          <button data-a="map" title="Map (M)">🗺️</button>
          <button data-a="mute" title="Sound"></button>
          <button data-a="menu" title="Menu (Esc)">☰</button>
        </div>
        <div class="md-prompt" hidden></div>
        <div class="md-bar"></div>
      </div>
      <div class="md-touch" hidden>
        <div class="md-stick"><div class="md-knob"></div></div>
        <div class="md-tbtns">
          <button data-t="use" class="md-tuse">✋</button>
          <button data-t="potion">🧪</button>
          <button data-t="bomb">💣</button>
          <button data-t="roll">💨</button>
          <button data-t="ranged">🏹</button>
          <button data-t="melee" class="md-tbig">⚔️</button>
        </div>
      </div>
      <div class="md-toast" hidden></div>
      <div class="md-banner" hidden></div>
      <div class="md-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const hud = $('.md-hud'), hpEl = $('.md-hp'), statsEl = $('.md-stats'), whereEl = $('.md-where');
    const bossEl = $('.md-boss'), promptEl = $('.md-prompt'), barEl = $('.md-bar');
    const toastEl = $('.md-toast'), bannerEl = $('.md-banner'), ui = $('.md-ui'), touchEl = $('.md-touch');
    const muteBtn = $<HTMLButtonElement>('[data-a="mute"]');
    const R = new Renderer(cv);
    const touchMode = !!window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;

    try {
      setMuted(localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      /* ignore */
    }
    const syncMute = () => (muteBtn.textContent = isMuted() ? '🔇' : '🔊');
    syncMute();

    let g = new Game(readSave() ?? undefined);
    let overlay: Overlay = 'title';
    let playing = false;

    // ---------- messages ----------
    let toastTimer = 0;
    const toast = (t: string) => {
      toastEl.textContent = t;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), 2600);
    };
    let bannerTimer = 0;
    const banner = (title: string, sub: string) => {
      bannerEl.innerHTML = `<b>${title}</b><span>${sub}</span>`;
      bannerEl.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => (bannerEl.hidden = true), 3600);
    };
    const save = () => writeSave(g.save);

    function wire(gm: Game) {
      gm.onSound = sfx;
      gm.onMsg = toast;
      gm.onBanner = banner;
      gm.onSave = save;
      gm.onTrader = (t) => openShop(t);
      gm.onMissionTable = () => openMission(Math.min(gm.save.unlocked, LEVELS.length - 1));
      gm.onDeath = () => show('dead');
      gm.onLevelDone = (def, reward) => {
        lastDone = { name: def.name, reward };
        show('done');
      };
      gm.onWin = () => show('win');
    }
    wire(g);
    let lastDone = { name: '', reward: 0 };

    // ---------- input ----------
    const keys = new Set<string>();
    const pressed = new Set<string>();
    let mouse: { x: number; y: number } | null = null;
    let mouseL = false, mouseR = false;
    const stick = { x: 0, y: 0, id: -1 };
    const held = new Set<string>();

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.type === 'keyup') {
        keys.delete(k);
        return;
      }
      if (!keys.has(k)) pressed.add(k);
      keys.add(k);
      if (k === 'tab' || k === ' ') e.preventDefault();
      if (overlay === 'title') return;
      if (k === 'escape') {
        if (overlay === 'none') show('menu');
        else if (overlay === 'menu' || overlay === 'shop' || overlay === 'gear' || overlay === 'map' || overlay === 'mission' || overlay === 'help') show('none');
      } else if ((k === 'i' || k === 'tab') && (overlay === 'none' || overlay === 'gear')) show(overlay === 'gear' ? 'none' : 'gear');
      else if (k === 'm' && (overlay === 'none' || overlay === 'map')) {
        if (g.mode === 'camp') {
          if (overlay === 'none') openMission(Math.min(g.save.unlocked, LEVELS.length - 1));
        } else show(overlay === 'map' ? 'none' : 'map');
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const blur = () => {
      keys.clear();
      mouseL = mouseR = false;
    };
    window.addEventListener('blur', blur);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse = { x: e.offsetX, y: e.offsetY };
    });
    cv.addEventListener('pointerdown', (e) => {
      el.focus();
      if (e.pointerType !== 'mouse') return;
      mouse = { x: e.offsetX, y: e.offsetY };
      if (e.button === 0) mouseL = true;
      if (e.button === 2) mouseR = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) mouseL = false;
      if (e.button === 2) mouseR = false;
    });

    // touch stick and buttons
    const stickEl = $('.md-stick'), knob = $('.md-knob');
    stickEl.addEventListener('pointerdown', (e) => {
      stick.id = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    const moveStick = (e: PointerEvent) => {
      if (e.pointerId !== stick.id) return;
      const r = stickEl.getBoundingClientRect();
      let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        dx /= l;
        dy /= l;
      }
      stick.x = dx;
      stick.y = dy;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    stickEl.addEventListener('pointermove', moveStick);
    const stickUp = (e: PointerEvent) => {
      if (e.pointerId !== stick.id) return;
      stick.id = -1;
      stick.x = stick.y = 0;
      knob.style.transform = '';
    };
    stickEl.addEventListener('pointerup', stickUp);
    stickEl.addEventListener('pointercancel', stickUp);
    el.querySelectorAll<HTMLButtonElement>('.md-tbtns button').forEach((b) => {
      const t = b.dataset.t!;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        held.add(t);
        pressed.add('t:' + t);
        b.classList.add('on');
      });
      const up = () => {
        held.delete(t);
        b.classList.remove('on');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });

    function readInput(): Input {
      let mx = 0, my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      if (stick.id >= 0) {
        mx += stick.x;
        my += stick.y;
      }
      const p = (k: string) => pressed.has(k);
      const inp: Input = {
        mx, my,
        aim: mouse && !touchMode ? R.toWorld(mouse.x, mouse.y) : null,
        melee: mouseL || held.has('melee'),
        ranged: mouseR || keys.has('f') || held.has('ranged'),
        roll: p(' ') || p('shift') || p('t:roll'),
        potion: p('q') || p('t:potion'),
        bomb: p('r') || p('t:bomb'),
        use: p('e') || p('enter') || p('t:use'),
      };
      pressed.clear();
      return inp;
    }

    // ---------- HUD ----------
    function slot(img: string, label: string, key: string, count?: string, cool = 0) {
      return `<div class="md-slot"><img src="${img}" alt=""><em>${key}</em>${count !== undefined ? `<span>${count}</span>` : ''}<div class="md-cool" style="height:${Math.round(cool * 100)}%"></div><small>${label}</small></div>`;
    }
    let barKey = '';
    function updateHud() {
      const s = g.save;
      const hpK = g.hp / g.maxHp;
      hpEl.querySelector('i')!.setAttribute('style', `width:${pct(hpK)}`);
      hpEl.classList.toggle('low', hpK < 0.3);
      hpEl.querySelector('span')!.textContent = `${Math.ceil(g.hp)} / ${g.maxHp}`;
      statsEl.innerHTML = `<span>🪙 ${s.coins}</span>`;
      whereEl.textContent = g.mode === 'camp' ? 'Hearthstead Camp' : `${g.def.name} · ${g.monsters.length} monsters left`;
      const gd = g.guardian;
      if (gd && g.bossAwake && !gd.dead) {
        bossEl.hidden = false;
        bossEl.querySelector('b')!.textContent = gd.name;
        bossEl.querySelector('i')!.setAttribute('style', `width:${pct(Math.max(0, gd.hp / gd.maxHp))}`);
      } else bossEl.hidden = true;
      if (g.near) {
        promptEl.hidden = false;
        promptEl.innerHTML = `<kbd>${touchMode ? '✋' : 'E'}</kbd> ${g.near.label}`;
      } else promptEl.hidden = true;
      touchEl.querySelector<HTMLElement>('.md-tuse')!.style.visibility = g.near ? 'visible' : 'hidden';
      const rc = Math.max(0, g.rangedCd / g.ranged.rate), mc = Math.max(0, g.meleeCd / g.melee.rate), roll = Math.max(0, g.rollCd / 0.85);
      const key = [s.melee, s.ranged, s.arrows, s.potions, s.bombs, rc.toFixed(1), mc.toFixed(1), roll.toFixed(1)].join();
      if (key !== barKey) {
        barKey = key;
        barEl.innerHTML =
          slot(gearIcon(s.melee), g.melee.name, touchMode ? '⚔️' : 'L', undefined, mc) +
          slot(gearIcon(s.ranged), g.ranged.name, touchMode ? '🏹' : 'R', String(s.arrows), rc) +
          `<div class="md-slot md-roll"><b>💨</b><em>${touchMode ? '' : 'Spc'}</em><div class="md-cool" style="height:${Math.round(roll * 100)}%"></div><small>Roll</small></div>` +
          slot(supplyIcon('potion'), 'Healing Draught', 'Q', String(s.potions)) +
          slot(supplyIcon('bomb'), 'Fizz Bomb', 'R', String(s.bombs));
      }
    }

    // ---------- overlays ----------
    function show(o: Overlay) {
      overlay = o;
      ui.innerHTML = '';
      ui.className = 'md-ui' + (o === 'none' ? '' : ' on');
      hud.hidden = !playing || o === 'title';
      touchEl.hidden = !(touchMode && playing && o === 'none');
      if (o !== 'none') bannerEl.hidden = true;
      if (o === 'none') {
        el.focus();
        return;
      }
      if (o === 'title') titleScreen();
      else if (o === 'help') panel(`<h2>How to play</h2>${HELP}<p>Talk to the traders in camp to buy weapons, armor and supplies. Use the mission table to pick a dungeon. Each dungeon has a guardian in its last room; beat it and a portal opens to take you home with a reward. Clear all five to face the Hollow Crown.</p><div class="md-row"><button class="md-btn" data-x="back">Back</button></div>`, { back: () => show(playing ? 'menu' : 'title') });
      else if (o === 'menu') menu();
      else if (o === 'gear') gearPanel();
      else if (o === 'map') mapPanel();
      else if (o === 'dead') panel(`<h2 class="md-red">You fell!</h2><p>The monsters of ${g.def.name} got the better of you this time. You keep every coin and piece of gear you found.</p><p class="md-dim">Monsters beaten this run: ${g.kills} · coins found: ${g.runCoins}</p><div class="md-row"><button class="md-btn md-go" data-x="camp">Back to camp</button><button class="md-btn" data-x="retry">Try again</button></div>`, {
        camp: () => {
          g.enterCamp();
          save();
          show('none');
        },
        retry: () => {
          g.enterLevel(g.levelIdx);
          save();
          show('none');
        },
      });
      else if (o === 'done') panel(`<h2>${lastDone.name} cleared!</h2><p>You’re back in camp with <b>🪙 ${lastDone.reward}</b> reward coins. ${g.save.unlocked < LEVELS.length && !g.save.cleared.includes(LEVELS[g.save.unlocked].id) ? `<b>${LEVELS[g.save.unlocked].name}</b> is open on the mission map.` : ''}</p><p class="md-dim">Spend your coins with Bram, Tilda and Old Pip before the next dungeon.</p><div class="md-row"><button class="md-btn md-go" data-x="ok">Onward</button></div>`, { ok: () => show('none') });
      else if (o === 'win') panel(`<div class="md-crown">👑</div><h2>The Hollow Crown is beaten!</h2><p>All five dungeons are clear and the camp is safe. Bram has started telling the story to anyone who will listen.</p><p class="md-dim">You can keep playing: replay any dungeon from the mission map for more coins and gear.</p><div class="md-row"><button class="md-btn md-go" data-x="ok">Back to camp</button></div>`, { ok: () => show('none') });
    }

    function panel(html: string, acts: Record<string, () => void>, cls = '') {
      ui.innerHTML = `<div class="md-panel ${cls}">${html}</div>`;
      ui.querySelectorAll<HTMLElement>('[data-x]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('click');
          acts[b.dataset.x!]?.();
        }),
      );
    }

    function titleScreen() {
      const has = !!readSave();
      ui.innerHTML = `<div class="md-title">
        ${LOGO}
        <p class="md-tag">A blocky dungeon crawler. Gear up in camp, delve five dungeons, beat their guardians.</p>
        <div class="md-col">
          <button class="md-btn md-go" data-x="play">${has ? 'Continue' : 'Play'}</button>
          ${has ? '<button class="md-btn" data-x="new">New game</button>' : ''}
          <button class="md-btn" data-x="help">How to play</button>
          <button class="md-btn md-dim" data-x="exit">Back to games</button>
        </div>
        <div class="md-cast">${(['mossling', 'lantern-monk', 'sporecap', 'rustknight', 'gloomwing', 'frost-wisp', 'cinder-hound'] as const).map((k) => `<img src="${monsterIcon(k, 64)}" title="${MONSTERS[k].name}" alt="">`).join('')}</div>
      </div>`;
      const acts: Record<string, () => void> = {
        play: () => start(),
        new: () => {
          if (!confirmNew()) return;
          g = new Game();
          wire(g);
          save();
          start();
        },
        help: () => show('help'),
        exit: () => onExit(),
      };
      ui.querySelectorAll<HTMLElement>('[data-x]').forEach((b) => b.addEventListener('click', () => (sfx('click'), acts[b.dataset.x!]())));
    }
    let newArmed = 0;
    function confirmNew() {
      // second press within 3s confirms (no browser dialogs)
      if (Date.now() - newArmed < 3000) return true;
      newArmed = Date.now();
      toast('Press New game again to wipe your save and start over.');
      return false;
    }
    function start() {
      playing = true;
      g.enterCamp();
      show('none');
      banner('Hearthstead Camp', 'Talk to the traders, then use the mission table by the fire.');
    }

    function menu() {
      const inDungeon = g.mode === 'dungeon';
      panel(`<h2>Paused</h2>
        <div class="md-col">
          <button class="md-btn md-go" data-x="resume">Resume</button>
          ${inDungeon ? '<button class="md-btn" data-x="camp">Leave the dungeon (back to camp)</button>' : ''}
          <button class="md-btn" data-x="help">How to play</button>
          <button class="md-btn" data-x="title">Title screen</button>
          <button class="md-btn md-dim" data-x="exit">Back to games</button>
        </div>`, {
        resume: () => show('none'),
        camp: () => {
          g.enterCamp();
          save();
          show('none');
        },
        help: () => show('help'),
        title: () => {
          save();
          playing = false;
          if (g.mode === 'dungeon') g.enterCamp();
          show('title');
        },
        exit: () => {
          save();
          onExit();
        },
      });
    }

    // --- shop ---
    function statLine(id: GearId) {
      if (id in MELEE) {
        const w = MELEE[id as MeleeId];
        return `⚔️ ${w.dmg} dmg · ${(1 / w.rate).toFixed(1)}/s · reach ${w.reach}${w.arc >= 360 ? ' · all around' : ''}`;
      }
      if (id in RANGED) {
        const w = RANGED[id as RangedId];
        return `🏹 ${w.dmg} dmg${w.shots > 1 ? ` ×${w.shots}` : ''} · ${(1 / w.rate).toFixed(1)}/s${w.pierce ? ` · pierces ${w.pierce > 5 ? 'all' : w.pierce}` : ''}`;
      }
      const a = ARMOR[id as ArmorId];
      return `🛡️ blocks ${pct(a.block)}${a.regen ? ' · heals' : ''}${a.speed < 1 ? ` · ${pct(1 - a.speed)} slower` : ''}`;
    }
    function gearDesc(id: GearId) {
      return (MELEE as Record<string, { desc: string }>)[id]?.desc ?? (RANGED as Record<string, { desc: string }>)[id]?.desc ?? ARMOR[id as ArmorId].desc;
    }
    function equipped(id: GearId) {
      return g.save.melee === id || g.save.ranged === id || g.save.armor === id;
    }
    let shopTrader: Trader | null = null;
    function openShop(t: Trader) {
      shopTrader = t;
      sfx('click');
      show('shop');
      shopPanel();
    }
    function shopPanel() {
      const t = shopTrader!;
      const items: string[] = [];
      if (t.id === 'peddler') {
        for (const id of PEDDLER_STOCK) {
          const s = SUPPLIES[id];
          const have = id === 'potion' ? g.save.potions : id === 'arrows' ? g.save.arrows : id === 'bomb' ? g.save.bombs : null;
          items.push(`<div class="md-item"><img src="${supplyIcon(id)}" alt=""><div class="md-it"><b>${s.name}</b><small>${s.desc}</small>${have !== null ? `<small class="md-dim">You have ${have}</small>` : ''}</div>
            <button class="md-btn md-buy" data-buy="${id}" ${g.save.coins < s.price ? 'disabled' : ''}>🪙 ${s.price}</button></div>`);
        }
      } else {
        const stock: GearId[] = t.id === 'smith' ? SMITH_STOCK : ARMOR_STOCK;
        for (const id of stock) {
          const own = g.save.owned.includes(id);
          const price = gearPrice(id);
          const btn = own
            ? equipped(id) ? '<button class="md-btn" disabled>Equipped</button>' : `<button class="md-btn" data-eq="${id}">Equip</button>`
            : `<button class="md-btn md-buy" data-gear="${id}" ${g.save.coins < price ? 'disabled' : ''}>🪙 ${price}</button>`;
          items.push(`<div class="md-item ${own ? 'own' : ''}"><img src="${gearIcon(id)}" alt=""><div class="md-it"><b>${gearName(id)}</b><small>${statLine(id)}</small><small class="md-dim">${gearDesc(id)}</small></div>${btn}</div>`);
        }
      }
      ui.innerHTML = `<div class="md-panel md-shop">
        <div class="md-shophead"><div class="md-face"></div><div><h2>${t.name} <small>the ${t.title}</small></h2><p class="md-say">“${t.hello}”</p></div><div class="md-purse">🪙 ${g.save.coins}</div></div>
        <div class="md-items">${items.join('')}</div>
        <div class="md-row"><button class="md-btn" data-x="close">Done</button></div></div>`;
      ui.querySelector('.md-face')!.appendChild(portrait(traderParts(t, 0), Math.PI / 2, 110, 130, 1, 2.4));
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
      ui.querySelectorAll<HTMLElement>('[data-gear]').forEach((b) =>
        b.addEventListener('click', () => {
          const err = g.buyGear(b.dataset.gear as GearId);
          if (err) toast(err);
          else toast(`Bought ${gearName(b.dataset.gear as GearId)} and equipped it.`);
          shopPanel();
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-eq]').forEach((b) =>
        b.addEventListener('click', () => {
          g.equip(b.dataset.eq as GearId);
          sfx('click');
          shopPanel();
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
        b.addEventListener('click', () => {
          buySupply(b.dataset.buy as SupplyId);
          shopPanel();
        }),
      );
    }
    function buySupply(id: SupplyId) {
      const s = SUPPLIES[id];
      if (g.save.coins < s.price) return toast('Not enough coins.');
      if (id === 'mystery') {
        const pool = [...SMITH_STOCK, ...ARMOR_STOCK].filter((x) => !g.save.owned.includes(x));
        if (!pool.length) return toast('You already own every piece of gear!');
        g.save.coins -= s.price;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        g.save.owned.push(pick);
        banner('Mystery Crate!', `Inside: ${gearName(pick)}. Equip it from your gear (I).`);
      } else {
        g.save.coins -= s.price;
        if (id === 'potion') g.save.potions++;
        else if (id === 'arrows') g.save.arrows += 20;
        else g.save.bombs++;
      }
      sfx('buy');
      save();
    }

    // --- gear ---
    function gearPanel() {
      const s = g.save;
      const group = (title: string, ids: GearId[]) =>
        `<h3>${title}</h3><div class="md-items md-small">${ids
          .filter((id) => s.owned.includes(id))
          .map((id) => `<div class="md-item ${equipped(id) ? 'eq' : ''}"><img src="${gearIcon(id)}" alt=""><div class="md-it"><b>${gearName(id)}</b><small>${statLine(id)}</small></div>${equipped(id) ? '<span class="md-tagx">Equipped</span>' : `<button class="md-btn" data-eq="${id}">Equip</button>`}</div>`)
          .join('')}</div>`;
      ui.innerHTML = `<div class="md-panel md-gear">
        <div class="md-gearhead"><div class="md-me"></div><div>
          <h2>Your gear</h2>
          <p>❤️ ${Math.ceil(g.hp)} / ${g.maxHp} · 🪙 ${s.coins}</p>
          <p>🏹 ${s.arrows} arrows · 🧪 ${s.potions} draughts · 💣 ${s.bombs} bombs</p>
          <p class="md-dim">Dungeons cleared: ${s.cleared.length} of ${LEVELS.length}</p>
        </div></div>
        ${group('Melee weapons', Object.keys(MELEE) as GearId[])}
        ${group('Bows', Object.keys(RANGED) as GearId[])}
        ${group('Armor', Object.keys(ARMOR) as GearId[])}
        <p class="md-dim">More gear: Bram and Tilda in camp, chests in dungeons, and Old Pip’s Mystery Crates.</p>
        <div class="md-row"><button class="md-btn" data-x="close">Close</button></div></div>`;
      const a = g.armor;
      ui.querySelector('.md-me')!.appendChild(portrait(heroParts({ armor: a.color, trim: a.trim, walk: 0, moving: false }), Math.PI / 2, 110, 130, 1, 2.4));
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
      ui.querySelectorAll<HTMLElement>('[data-eq]').forEach((b) =>
        b.addEventListener('click', () => {
          g.equip(b.dataset.eq as GearId);
          sfx('click');
          gearPanel();
        }),
      );
    }

    // --- dungeon map ---
    function mapPanel() {
      ui.innerHTML = `<div class="md-panel md-mapp"><h2>${g.def.name}</h2><canvas class="md-mapcv"></canvas>
        <p class="md-dim">⬜ you · 🟨 chests · 🟥 monsters · 💀 the guardian’s room${g.L.portal.open ? ' · the glowing square is the portal home' : ''}</p>
        <div class="md-row"><button class="md-btn" data-x="close">Close (M)</button></div></div>`;
      const c = ui.querySelector<HTMLCanvasElement>('.md-mapcv')!;
      const w = Math.min(760, window.innerWidth - 60), h = Math.min(440, window.innerHeight - 220);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const x = c.getContext('2d')!;
      x.scale(dpr, dpr);
      R.drawMap(x, g, w, h, true);
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
    }

    // --- mission map (the camp's table) ---
    function openMission(sel: number) {
      show('mission');
      const s = g.save;
      const pts = LEVELS.map((L) => L.map);
      const camp = { x: 8, y: 92 };
      const path = [camp, ...pts].map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y * 0.7}`).join(' ');
      const nodes = LEVELS.map((L, i) => {
        const locked = i > s.unlocked;
        const done = s.cleared.includes(L.id);
        return `<g class="md-node ${locked ? 'locked' : ''} ${i === sel ? 'sel' : ''}" data-lv="${i}" transform="translate(${L.map.x} ${L.map.y * 0.7})">
          <rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="${locked ? '#6a5a48' : L.wall[0]}" stroke="${i === sel ? '#fff' : '#2a1a0a'}" stroke-width="${i === sel ? 1 : 0.6}"/>
          <rect x="-5" y="-5" width="10" height="3.5" rx="1" fill="${locked ? '#7a6a58' : L.accent}" opacity=".85"/>
          <rect x="-1.6" y="0" width="3.2" height="5" fill="#1a1010"/>
          ${locked ? '<text y="2.6" font-size="6" text-anchor="middle">🔒</text>' : done ? '<text x="5" y="-4" font-size="5">⭐</text>' : ''}
          <text y="9.5" font-size="3.4" text-anchor="middle" fill="#3a2410" font-weight="800">${L.name}</text>
        </g>`;
      }).join('');
      const L = LEVELS[sel];
      const locked = sel > s.unlocked;
      const kinds = [...new Set(L.monsters)];
      ui.innerHTML = `<div class="md-panel md-mission">
        <div class="md-mapwrap"><svg viewBox="-6 -6 112 80" class="md-parch">
          <defs><pattern id="mdp" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#e8d4a6"/><rect width="1" height="1" fill="#dcc590"/><rect x="2" y="2" width="1" height="1" fill="#f0e0b8"/></pattern></defs>
          <rect x="-6" y="-6" width="112" height="80" fill="url(#mdp)"/>
          <path d="M0 52 Q20 46 30 54 T60 50 T100 56 V70 H0Z" fill="#a8c47a" opacity=".55"/>
          <path d="M44 8 l6-7 6 7z M52 10 l5-6 5 6z M66 6 l6-6 6 6z" fill="#9a8a78"/><path d="M48 3 l2-2 2 2z M70 2 l2-2 2 2z" fill="#fff"/>
          <path d="M70 48 q6-4 14 0 q6 4 12 0" stroke="#e0581a" stroke-width="2.4" fill="none" opacity=".7"/>
          <path d="M14 30 q4-3 8 0 q4 3 8 0" stroke="#5a8ab0" stroke-width="1.8" fill="none" opacity=".6"/>
          ${[[8, 40], [12, 36], [24, 62], [30, 30], [52, 36], [90, 34], [22, 20], [6, 52]].map(([a, b]) => `<rect x="${a}" y="${b}" width="3" height="3" fill="#4f8a3a"/><rect x="${a + 1.1}" y="${b + 3}" width="0.8" height="1.4" fill="#6b4424"/>`).join('')}
          <path d="${path}" stroke="#7a4a28" stroke-width="0.8" stroke-dasharray="1.6 1.4" fill="none"/>
          <g transform="translate(${camp.x} ${camp.y * 0.7})"><rect x="-4" y="-3" width="8" height="5" fill="#a0713f"/><path d="M-5 -3 L0 -7 L5 -3Z" fill="#b5483a"/><text y="6" font-size="3.2" text-anchor="middle" fill="#3a2410" font-weight="800">Camp</text></g>
          ${nodes}
          <g transform="translate(92 62)" opacity=".7"><circle r="5" fill="none" stroke="#7a4a28" stroke-width=".5"/><path d="M0-5 L1.2 0 L0 5 L-1.2 0Z" fill="#7a4a28"/><text y="-6" font-size="3" text-anchor="middle" fill="#7a4a28">N</text></g>
        </svg></div>
        <div class="md-info">
          <h2>${L.name}</h2>
          <p>${L.blurb}</p>
          <h3>Monsters</h3>
          <div class="md-mobs">${kinds.map((k) => `<div><img src="${monsterIcon(k, 64)}" alt=""><small>${MONSTERS[k].name}</small></div>`).join('')}</div>
          <h3>Guardian</h3>
          <div class="md-mobs"><div class="md-gd"><img src="${monsterIcon(L.guardian.kind, 72, L.guardian.kind === 'hollow-crown' ? '' : L.accent)}" alt=""><small>${L.guardian.name}</small></div><p class="md-dim">${L.guardian.kind === 'hollow-crown' ? MONSTERS[L.guardian.kind].blurb : `A giant ${MONSTERS[L.guardian.kind].name}, much tougher, with a ring attack that hits all around it.`}</p></div>
          <p>Reward: 🪙 ${s.cleared.includes(L.id) ? Math.round(L.reward / 3) + ' (replay)' : L.reward}${L.hazard ? ` · Watch for ${L.hazard === 'lava' ? 'lava' : L.hazard === 'ice' ? 'slippery ice' : 'deep water'}` : ''}</p>
          <div class="md-row">
            ${locked ? `<button class="md-btn" disabled>🔒 Clear ${LEVELS[sel - 1].name} first</button>` : '<button class="md-btn md-go" data-x="go">Enter dungeon</button>'}
            <button class="md-btn" data-x="close">Close</button>
          </div>
        </div></div>`;
      ui.querySelectorAll<SVGGElement>('[data-lv]').forEach((n) =>
        n.addEventListener('click', () => {
          sfx('click');
          openMission(Number(n.dataset.lv));
        }),
      );
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
      ui.querySelector('[data-x="go"]')?.addEventListener('click', () => {
        g.enterLevel(sel);
        save();
        show('none');
      });
    }

    // top buttons
    el.querySelectorAll<HTMLButtonElement>('.md-btns button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        sfx('click');
        if (a === 'mute') {
          setMuted(!isMuted());
          syncMute();
          try {
            localStorage.setItem(MUTE_KEY, isMuted() ? '1' : '0');
          } catch {
            /* ignore */
          }
        } else if (a === 'menu') show(overlay === 'menu' ? 'none' : 'menu');
        else if (a === 'gear') show(overlay === 'gear' ? 'none' : 'gear');
        else if (a === 'map') {
          if (g.mode === 'camp') openMission(Math.min(g.save.unlocked, LEVELS.length - 1));
          else show(overlay === 'map' ? 'none' : 'map');
        }
        b.blur();
      }),
    );

    // ---------- loop ----------
    let raf = 0, last = performance.now(), saveT = 0;
    const blankInput: Input = { mx: 0, my: 0, aim: null, melee: false, ranged: false, roll: false, potion: false, bomb: false, use: false };
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      R.resize();
      if (overlay === 'title') {
        // drift around the camp behind the title
        g.time += dt;
        const t = g.time * 0.12;
        g.x = 13 + Math.cos(t) * 4;
        g.y = 11 + Math.sin(t) * 3;
        R.draw(g, { minimap: false, title: true });
        return;
      }
      if (playing && overlay === 'none') {
        g.update(dt, readInput());
        saveT += dt;
        if (saveT > 20) {
          saveT = 0;
          save();
        }
      } else {
        pressed.clear();
        g.update(0, blankInput);
      }
      R.draw(g, { minimap: overlay === 'none' });
      if (playing) updateHud();
    }
    show('title');
    raf = requestAnimationFrame(frame);

    if (import.meta.env.DEV)
      (window as unknown as { __md: unknown }).__md = {
        g: () => g,
        start,
        show: (o: Overlay) => show(o),
        shop: (i: number) => openShop(TRADERS[i]),
        mission: (i: number) => openMission(i),
      };

    return () => {
      cancelAnimationFrame(raf);
      save();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', blur);
      el.remove();
    };
  },
};

export default game;
