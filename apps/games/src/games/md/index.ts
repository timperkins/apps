// M.D. (Monster Dungeons): a blocky action dungeon crawler. Gear up with the traders in camp,
// pick a dungeon on the mission map, fight through its rooms and beat the guardian at the end.
import './style.css';
import type { GameModule } from '../types';
import {
  ARMOR, ARMOR_STOCK, ARTIFACTS, ARROWS, LEVELS, MYSTIC_STOCK, TRADERS, MELEE, MONSTERS, PEDDLER_STOCK, RANGED, SMITH_STOCK, SUPPLIES,
  armorOf, isArmor, isMelee, isRanged, itemName, meleeOf, parseKey, rangedOf,
  type ArtifactId, type GearId, type ItemKey, type SupplyId, type Trader,
} from './data';
import { Game, gearName, gearPrice, newSave, type AimMode, type Input, type SaveData } from './game';
import { Renderer, portrait, heroParts, traderParts } from './render';
import { artifactIcon, gearIcon, monsterIcon, supplyIcon } from './art';
import { isMuted, setMuted, sfx } from './audio';

const SAVE_KEY = 'md-save-v1';
const MUTE_KEY = 'md-muted';
const SETTINGS_KEY = 'md-settings';

interface Settings {
  aim: AimMode;
  autoFire: boolean;
}
function readSettings(): Settings {
  try {
    return { aim: 'mouse', autoFire: true, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { aim: 'mouse', autoFire: true };
  }
}

function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? (JSON.parse(raw) as SaveData) : null;
    if (!s || s.v !== 1) return null;
    const d = newSave();
    return { ...d, ...s, special: { ...d.special, ...(s.special ?? {}) }, slots: s.slots ?? d.slots, artifacts: s.artifacts ?? [] };
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

type Overlay = 'none' | 'title' | 'help' | 'menu' | 'settings' | 'shop' | 'gear' | 'mission' | 'map' | 'dead' | 'done' | 'win';

const LOGO = `<div class="md-logo"><span>M</span><i></i><span>D</span><i></i></div><div class="md-sub">MONSTER DUNGEONS</div>`;

const HELP = `
  <div class="md-keys">
    <div><b>WASD</b> / arrows: walk · <b>mouse</b>: aim</div>
    <div><b>Space</b>: attack with your sword, axe, sickle, scythe… (fists if nothing is equipped)</div>
    <div><b>Click</b> or hold <b>Shift</b>: fire your bow · <b>X</b>: switch arrow type</div>
    <div><b>Click a monster</b>: lock on to it · <b>.</b> (period): stop targeting</div>
    <div><b>Right click</b> or <b>C</b>: dodge roll (you can’t be hit mid-roll)</div>
    <div><b>1</b> <b>2</b> <b>3</b>: artifacts · <b>Q</b>: Healing Draught · <b>R</b>: Fizz Bomb · <b>E</b>: talk, open, use</div>
    <div><b>Ctrl</b>, <b>I</b> or <b>Tab</b>: inventory · <b>M</b>: map · <b>Esc</b>: menu (settings are in there)</div>
    <div class="md-dim">Auto-fire bows shoot by themselves when an enemy is close. In Settings, pick where bows aim: at the mouse, in front of you, or at the nearest enemy.</div>
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
          <button data-t="artifact">✨</button>
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
    let settings = readSettings();
    const saveSettings = () => {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
    };
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
    let mouseL = false;
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
      if (k === 'tab' || k === ' ' || k === 'control') e.preventDefault();
      if (overlay === 'title') return;
      if (k === 'control' && (overlay === 'none' || overlay === 'gear')) {
        show(overlay === 'gear' ? 'none' : 'gear');
        return;
      }
      if (k === 'escape') {
        if (overlay === 'none') show('menu');
        else if (overlay === 'menu' || overlay === 'settings' || overlay === 'shop' || overlay === 'gear' || overlay === 'map' || overlay === 'mission' || overlay === 'help') show('none');
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
      mouseL = false;
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
      if (e.button === 0) {
        mouseL = true;
        pressed.add('mouse0');
        // clicking a monster locks on to it
        if (playing && overlay === 'none' && g.lockAt(R.toWorld(e.offsetX, e.offsetY))) sfx('click');
      }
      if (e.button === 2) pressed.add('mouse2');
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) mouseL = false;
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
        melee: keys.has(' ') || held.has('melee'),
        ranged: mouseL || p('mouse0') || keys.has('shift') || keys.has('f') || held.has('ranged'),
        roll: p('mouse2') || p('c') || p('t:roll'),
        potion: p('q') || p('t:potion'),
        bomb: p('r') || p('t:bomb'),
        use: p('e') || p('enter') || p('t:use'),
        artifact: p('1') ? 0 : p('2') ? 1 : p('3') ? 2 : p('t:artifact') ? Math.max(0, g.artCd.findIndex((c, i) => c <= 0 && !!g.save.slots[i])) : -1,
        cycleArrow: p('x'),
        aimMode: touchMode && settings.aim === 'mouse' ? 'nearest' : settings.aim,
        autoFire: settings.autoFire,
      };
      if (p('.')) {
        g.targetId = 0;
        toast('Stopped targeting.');
      }
      pressed.clear();
      return inp;
    }

    // ---------- HUD ----------
    function slot(img: string, label: string, key: string, count?: string, cool = 0, rarity = 'normal') {
      return `<div class="md-slot r-${rarity}"><img src="${img}" alt=""><em>${key}</em>${count !== undefined ? `<span>${count}</span>` : ''}<div class="md-cool" style="height:${Math.round(cool * 100)}%"></div><small>${label}</small></div>`;
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
      const rc = Math.max(0, g.rangedCd / g.ranged.rate), mc = Math.max(0, g.meleeCd / g.melee.rate), roll = Math.max(0, g.rollCd / g.rollMax);
      const ak = g.loadedArrow;
      const arts = s.slots.map((id, i) => (id ? (g.artCd[i] / ARTIFACTS[id].cooldown).toFixed(2) : '-')).join('/');
      const key = [s.melee, s.ranged, g.arrowCount(), ak, s.potions, s.bombs, rc.toFixed(1), mc.toFixed(1), roll.toFixed(1), arts, s.slots.join()].join();
      if (key !== barKey) {
        barKey = key;
        const rare = (k: string) => (k ? parseKey(k).rarity : 'normal');
        barEl.innerHTML =
          slot(gearIcon(s.melee), g.melee.name, touchMode ? '⚔️' : 'Spc', undefined, mc, rare(s.melee)) +
          slot(gearIcon(s.ranged), g.ranged.name, touchMode ? '🏹' : 'Shift', `${ak === 'normal' ? '' : { fire: '🔥', frost: '❄️', boom: '💥' }[ak]}${g.arrowCount()}`, rc, rare(s.ranged)) +
          `<div class="md-slot md-roll"><b>💨</b><em>${touchMode ? '' : 'C'}</em><div class="md-cool" style="height:${Math.round(roll * 100)}%"></div><small>Roll</small></div>` +
          slot(supplyIcon('potion'), 'Healing Draught', 'Q', String(s.potions)) +
          slot(supplyIcon('bomb'), 'Fizz Bomb', 'R', String(s.bombs)) +
          s.slots
            .map((id, i) => (id ? slot(artifactIcon(id), ARTIFACTS[id].name, String(i + 1), undefined, g.artCd[i] / ARTIFACTS[id].cooldown) : `<div class="md-slot md-empty"><em>${i + 1}</em></div>`))
            .join('');
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
      else if (o === 'settings') settingsPanel();
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
          <button class="md-btn" data-x="settings">⚙️ Settings</button>
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
        settings: () => show('settings'),
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
    const RARE_NOTE = '<p class="md-dim md-small-note">Every new item has a <b class="md-gold">0.5% chance to be GOLD</b> and a <b class="md-dia">0.05% chance to be DIAMOND</b>: shinier, with much better stats.</p>';
    function statLine(key: ItemKey | '') {
      const { id } = key ? parseKey(key) : { id: '' as GearId };
      if (!key || isMelee(id)) {
        const w = meleeOf(key);
        return `⚔️ ${w.dmg} dmg · ${(1 / w.rate).toFixed(1)}/s · reach ${w.reach}${w.arc >= 360 ? ' · all around' : w.arc >= 200 ? ' · wide sweep' : ''}${w.effect ? ` · ${w.effect === 'burn' ? 'burns' : w.effect === 'slow' ? 'slows' : 'stuns'}` : ''}`;
      }
      if (isRanged(id)) {
        const w = rangedOf(key);
        return `🏹 ${w.dmg} dmg${w.shots > 1 ? ` ×${w.shots}` : ''} · ${(1 / w.rate).toFixed(1)}/s${w.pierce ? ` · pierces ${w.pierce > 5 ? 'all' : w.pierce}` : ''}${w.auto ? ' · AUTO-FIRE' : ''}${w.burn ? ' · burns' : ''}`;
      }
      const a = armorOf(key);
      return `🛡️ blocks ${pct(a.block)}${a.regen ? ' · heals' : ''}${a.speed > 1 ? ` · ${pct(a.speed - 1)} faster` : a.speed < 1 ? ` · ${pct(1 - a.speed)} slower` : ''}${a.lavaproof ? ' · lavaproof' : ''}${a.quickroll ? ' · fast rolls' : ''}`;
    }
    function gearDesc(id: GearId) {
      return isMelee(id) ? MELEE[id].desc : isRanged(id) ? RANGED[id].desc : ARMOR[id as keyof typeof ARMOR].desc;
    }
    const isEquipped = (key: ItemKey) => g.save.melee === key || g.save.ranged === key || g.save.armor === key;
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
          const have = id === 'potion' ? g.save.potions : id === 'arrows' ? g.save.arrows : id === 'bomb' ? g.save.bombs : id === 'mystery' ? null : g.save.special[id.replace('-arrows', '') as 'fire'];
          items.push(`<div class="md-item"><img src="${supplyIcon(id)}" alt=""><div class="md-it"><b>${s.name}</b><small>${s.desc}</small>${have !== null ? `<small class="md-dim">You have ${have}</small>` : ''}</div>
            <button class="md-btn md-buy" data-buy="${id}" ${g.save.coins < s.price ? 'disabled' : ''}>🪙 ${s.price}</button></div>`);
        }
      } else if (t.id === 'mystic') {
        for (const id of MYSTIC_STOCK) {
          const A = ARTIFACTS[id];
          const own = g.save.artifacts.includes(id);
          items.push(`<div class="md-item ${own ? 'own' : ''}"><img src="${artifactIcon(id)}" alt=""><div class="md-it"><b>${A.name}</b><small>${A.desc}</small><small class="md-dim">Recharges in ${A.cooldown}s</small></div>
            ${own ? '<span class="md-tagx">Owned</span>' : `<button class="md-btn md-buy" data-art="${id}" ${g.save.coins < A.price ? 'disabled' : ''}>🪙 ${A.price}</button>`}</div>`);
        }
      } else {
        const stock: GearId[] = t.id === 'smith' ? SMITH_STOCK : ARMOR_STOCK;
        for (const id of stock) {
          const own = g.owns(id);
          const price = gearPrice(id);
          const btn = own ? '<span class="md-tagx">Owned</span>' : `<button class="md-btn md-buy" data-gear="${id}" ${g.save.coins < price ? 'disabled' : ''}>🪙 ${price}</button>`;
          items.push(`<div class="md-item ${own ? 'own' : ''}"><img src="${gearIcon(id)}" alt=""><div class="md-it"><b>${gearName(id)}</b><small>${statLine(id)}</small><small class="md-dim">${gearDesc(id)}</small></div>${btn}</div>`);
        }
      }
      ui.innerHTML = `<div class="md-panel md-shop">
        <div class="md-shophead"><div class="md-face"></div><div><h2>${t.name} <small>the ${t.title}</small></h2><p class="md-say">“${t.hello}”</p></div><div class="md-purse">🪙 ${g.save.coins}</div></div>
        ${t.id === 'smith' || t.id === 'armorer' || t.id === 'peddler' ? RARE_NOTE : ''}
        <div class="md-items">${items.join('')}</div>
        <div class="md-row"><button class="md-btn" data-x="close">Done</button></div></div>`;
      ui.querySelector('.md-face')!.appendChild(portrait(traderParts(t, 0), Math.PI / 2, 110, 130, 1, 2.4));
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
      ui.querySelectorAll<HTMLElement>('[data-gear]').forEach((b) =>
        b.addEventListener('click', () => {
          const res = g.buyGear(b.dataset.gear as GearId);
          if (res === 'You already own that.' || res === 'Not enough coins.') toast(res);
          else toast(`Bought ${itemName(res)} and equipped it.`);
          shopPanel();
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-art]').forEach((b) =>
        b.addEventListener('click', () => {
          const err = g.buyArtifact(b.dataset.art as ArtifactId);
          toast(err ?? `Bought the ${ARTIFACTS[b.dataset.art as ArtifactId].name}. Use it with 1, 2 or 3.`);
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
        const pool = [...SMITH_STOCK, ...ARMOR_STOCK].filter((x) => !g.owns(x));
        if (!pool.length) return toast('You already own every piece of gear!');
        g.save.coins -= s.price;
        const key = g.grant(pool[Math.floor(Math.random() * pool.length)]);
        if (parseKey(key).rarity === 'normal') banner('Mystery Crate!', `Inside: ${itemName(key)}. Equip it from your inventory (Ctrl).`);
      } else {
        g.save.coins -= s.price;
        if (id === 'potion') g.save.potions++;
        else if (id === 'arrows') g.save.arrows += 20;
        else if (id === 'fire-arrows') g.save.special.fire += 10;
        else if (id === 'frost-arrows') g.save.special.frost += 10;
        else if (id === 'boom-arrows') g.save.special.boom += 8;
        else g.save.bombs++;
      }
      sfx('buy');
      save();
    }

    // --- inventory ---
    function gearPanel() {
      const s = g.save;
      const rank = { diamond: 0, gold: 1, normal: 2 };
      const card = (key: ItemKey) => {
        const r = parseKey(key).rarity;
        return `<div class="md-item r-${r} ${isEquipped(key) ? 'eq' : ''}"><img src="${gearIcon(key)}" alt=""><div class="md-it"><b>${itemName(key)}${r !== 'normal' ? ` <span class="md-badge r-${r}">${r.toUpperCase()}</span>` : ''}</b><small>${statLine(key)}</small></div>${isEquipped(key) ? '<span class="md-tagx">Equipped</span>' : `<button class="md-btn" data-eq="${key}">Equip</button>`}</div>`;
      };
      const group = (title: string, test: (id: GearId) => boolean, extra = '') => {
        const keys = s.owned.filter((k) => test(parseKey(k).id)).sort((a, b) => rank[parseKey(a).rarity] - rank[parseKey(b).rarity]);
        return `<h3>${title}</h3><div class="md-items md-small">${extra}${keys.map(card).join('')}</div>`;
      };
      const fists = `<div class="md-item ${s.melee === '' ? 'eq' : ''}"><img src="${gearIcon('')}" alt=""><div class="md-it"><b>Fists</b><small>${statLine('')}</small></div>${s.melee === '' ? '<span class="md-tagx">Equipped</span>' : '<button class="md-btn" data-x="fists">Unequip weapon</button>'}</div>`;
      const arrows = (['normal', 'fire', 'frost', 'boom'] as const)
        .map((k) => `<button class="md-arrow ${g.save.arrowKind === k ? 'on' : ''}" data-arrow="${k}" style="--c:${ARROWS[k].color}">${ARROWS[k].name}: <b>${g.arrowCount(k)}</b></button>`)
        .join('');
      const arts = s.artifacts.length
        ? s.artifacts
            .map((id) => {
              const slot = s.slots.indexOf(id);
              return `<div class="md-item ${slot >= 0 ? 'eq' : ''}"><img src="${artifactIcon(id)}" alt=""><div class="md-it"><b>${ARTIFACTS[id].name}</b><small>${ARTIFACTS[id].desc}</small></div><button class="md-btn" data-slot="${id}">${slot >= 0 ? `Key ${slot + 1} · Remove` : 'Equip'}</button></div>`;
            })
            .join('')
        : '<p class="md-dim">No artifacts yet. Mira the Mystic in camp sells them.</p>';
      ui.innerHTML = `<div class="md-panel md-gear">
        <div class="md-gearhead"><div class="md-me"></div><div>
          <h2>Inventory</h2>
          <p>❤️ ${Math.ceil(g.hp)} / ${g.maxHp} · 🪙 ${s.coins} · 🧪 ${s.potions} draughts · 💣 ${s.bombs} bombs</p>
          <p class="md-dim">Dungeons cleared: ${s.cleared.length} of ${LEVELS.length}</p>
          <button class="md-btn" data-x="settings">⚙️ Settings</button>
        </div></div>
        ${group('Melee weapons (Space)', isMelee, fists)}
        ${group('Bows (click or Shift)', isRanged)}
        <h3>Arrows (X switches)</h3><div class="md-arrows">${arrows}</div>
        ${group('Armor', isArmor)}
        <h3>Artifacts (keys 1, 2, 3)</h3><div class="md-items md-small">${arts}</div>
        ${RARE_NOTE}
        <div class="md-row"><button class="md-btn" data-x="close">Close</button></div></div>`;
      const a = g.armor;
      ui.querySelector('.md-me')!.appendChild(portrait(heroParts({ armor: a.color, trim: a.trim, walk: 0, moving: false, helm: a.helm, shiny: parseKey(s.armor).rarity !== 'normal' }), Math.PI / 2, 110, 130, 1, 2.4));
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
      ui.querySelector('[data-x="settings"]')!.addEventListener('click', () => show('settings'));
      ui.querySelector('[data-x="fists"]')?.addEventListener('click', () => {
        g.unequipMelee();
        gearPanel();
      });
      ui.querySelectorAll<HTMLElement>('[data-eq]').forEach((b) =>
        b.addEventListener('click', () => {
          g.equip(b.dataset.eq!);
          sfx('click');
          gearPanel();
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) =>
        b.addEventListener('click', () => {
          g.slotArtifact(b.dataset.slot as ArtifactId);
          sfx('click');
          gearPanel();
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-arrow]').forEach((b) =>
        b.addEventListener('click', () => {
          g.save.arrowKind = b.dataset.arrow as 'normal';
          sfx('click');
          gearPanel();
        }),
      );
    }

    // --- settings ---
    function settingsPanel() {
      const opt = (k: AimMode, label: string, sub: string) =>
        `<button class="md-opt ${settings.aim === k ? 'on' : ''}" data-aim="${k}"><b>${label}</b><small>${sub}</small></button>`;
      panel(`<h2>Settings</h2>
        <h3>Where bows aim</h3>
        <div class="md-opts">
          ${opt('mouse', '🖱️ At the mouse', 'Arrows fly toward your mouse pointer.')}
          ${opt('front', '⬆️ In front of you', 'Arrows fly the way you are facing.')}
          ${opt('nearest', '🎯 Nearest enemy', 'Arrows fly at the closest monster you can see.')}
        </div>
        <p class="md-dim">Clicking a monster always locks on to it, whatever you pick here. Press <b>.</b> to stop targeting.</p>
        <h3>Auto-fire bows</h3>
        <div class="md-opts">
          <button class="md-opt ${settings.autoFire ? 'on' : ''}" data-auto="1"><b>On</b><small>Auto-fire bows shoot by themselves when an enemy is close.</small></button>
          <button class="md-opt ${!settings.autoFire ? 'on' : ''}" data-auto="0"><b>Off</b><small>Auto-fire bows only shoot when you click or hold Shift.</small></button>
        </div>
        <div class="md-row"><button class="md-btn md-go" data-x="back">Done</button></div>`, { back: () => show(playing ? 'none' : 'title') }, 'md-settings');
      ui.querySelectorAll<HTMLElement>('[data-aim]').forEach((b) =>
        b.addEventListener('click', () => {
          settings.aim = b.dataset.aim as AimMode;
          saveSettings();
          sfx('click');
          settingsPanel();
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-auto]').forEach((b) =>
        b.addEventListener('click', () => {
          settings.autoFire = b.dataset.auto === '1';
          saveSettings();
          sfx('click');
          settingsPanel();
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
