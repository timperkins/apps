// Mob Delvers: a blocky mission dungeon crawler designed on two handwritten pages. Start at a little
// camp, pick a mission on the map in the middle, beat its boss, and find better gear (it never levels
// up: the level it drops at is the level it keeps). Up to 4 players, hosted the Factori-owen way.
import './style.css';
import type { GameModule } from '../types';
import {
  ARMOR, ARTIFACTS, DIFF_COUNT, ENCHANTS, HERO_MAX, LEVELS, MAX_SOULS, MELEE, MODES, MONSTERS, RANGED,
  armorDef, armorOf, dropRange, enchChoices, enchantArmor, enchantMelee, enchantRanged, heroXpNeed, isArmor, isArtifact, isMelee, isRanged, itemName, meleeOf, modeOf, parseKey, powerOf, rangedOf,
  type ArtifactId, type EnchId, type ItemKey, type ModeId,
} from './data';
import { BASE_HP, Game, MOB_ENCH_NAME, newSave, POTION_EVERY, type AimMode, type Input, type SaveData } from './game';
import { GuestSession, HostSession, MAX_TEAM } from './mp';
import { listHosts, type HostInfo } from './net';
import { Renderer, portrait, heroParts } from './render';
import { artifactIcon, gearIcon, monsterIcon, supplyIcon } from './art';
import { isMuted, setMuted, sfx } from './audio';

const SAVE_KEY = 'dv-save-v1';
const MUTE_KEY = 'dv-muted';
const SETTINGS_KEY = 'dv-settings';
const NAME_KEY = 'dv-name';
const SLOT_KEY = (n: number) => `dv-slot-${n}`;
const SLOTS = 3;

interface SlotData {
  saved: number;
  data: SaveData;
}
function readSlot(n: number): SlotData | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(n));
    const s = raw ? (JSON.parse(raw) as SlotData) : null;
    return s && s.data && s.data.v === 1 ? s : null;
  } catch {
    return null;
  }
}
function writeSlot(n: number, data: SaveData) {
  try {
    localStorage.setItem(SLOT_KEY(n), JSON.stringify({ saved: Date.now(), data }));
    return true;
  } catch {
    return false;
  }
}
function fixSave(s: SaveData): SaveData {
  const d = newSave();
  const out: SaveData = { ...d, ...s, owned: Array.isArray(s.owned) ? s.owned : d.owned, arts: Array.isArray(s.arts) ? s.arts : d.arts, slots: Array.isArray(s.slots) ? s.slots.slice(0, 3) : d.slots, potions: Math.min(1, s.potions ?? 1) };
  while (out.slots.length < 3) out.slots.push('');
  if (out.melee && !out.owned.includes(out.melee)) out.melee = out.owned.find((k) => isMelee(parseKey(k).id)) ?? '';
  if (!out.owned.includes(out.ranged)) out.ranged = out.owned.find((k) => isRanged(parseKey(k).id)) ?? d.ranged;
  if (!out.owned.includes(out.armor)) out.armor = out.owned.find((k) => isArmor(parseKey(k).id)) ?? d.armor;
  for (const k of [out.ranged, out.armor]) if (!out.owned.includes(k)) out.owned.push(k);
  out.slots = out.slots.map((k) => (k && out.arts.includes(k) ? k : ''));
  return out;
}
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
}

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
    return fixSave(s);
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

type Overlay = 'none' | 'title' | 'help' | 'menu' | 'settings' | 'gear' | 'mission' | 'map' | 'dead' | 'done' | 'win' | 'slots' | 'join' | 'team' | 'ench';

const LOGO = `<div class="dv-logo"><span>MOB</span><i></i><span>DELVERS</span></div><div class="dv-sub">MISSIONS · LOOT · BOSSES</div>`;

const HELP = `
  <div class="dv-keys">
    <div><b>WASD</b> / arrows: walk · <b>mouse</b>: aim your bow</div>
    <div><b>Space</b>: swing your sword (or axe, scythe, spear…)</div>
    <div><b>Click</b> or hold <b>F</b>: shoot your bow · <b>Click a monster</b>: lock on · <b>.</b>: stop targeting</div>
    <div><b>Shift</b>: inventory (your 6 slots: bow, sword, armor and 3 artifacts) and enchanting</div>
    <div><b>Z</b> <b>X</b> <b>C</b> (or <b>1</b> <b>2</b> <b>3</b>): your 3 artifacts · <b>Right click</b> or <b>V</b>: dodge roll</div>
    <div><b>Q</b> or <b>Option</b> (Alt): drink your Healing Draught (a new one brews every 20 seconds)</div>
    <div><b>E</b>: open, use, revive · <b>M</b>: map · <b>Esc</b>: menu (save, load, team play, settings)</div>
    <div class="dv-dim">❤️ You have one big heart with 100 health. Armor makes it bigger.</div>
    <div class="dv-dim">⚡ Your <b>power</b> is your sword, bow and armor levels added together, then ÷ 3. Gear never levels up: find better gear instead. What drops depends on your power, the mode and the difficulty.</div>
    <div class="dv-dim">👻 Beating monsters drops souls. Some artifacts use souls. ⭐ Leveling up gives an enchanting point: each item has 3 random enchantments to pick from.</div>
    <div class="dv-dim">On a phone: stick on the left, buttons on the right. Attacks aim at the nearest monster.</div>
  </div>`;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const SLOT_KEYS = ['Z', 'X', 'C'];

const game: GameModule = {
  mount(root, { onExit }) {
    const el = document.createElement('div');
    el.className = 'dv';
    el.tabIndex = 0;
    el.innerHTML = `<canvas class="dv-canvas"></canvas>
      <div class="dv-hud" hidden>
        <div class="dv-tl">
          <div class="dv-heart"><div class="dv-heartbig"><i></i><b></b></div><div class="dv-heartinfo"><div class="dv-hp"><i></i><span></span></div><div class="dv-xp"><i></i></div><div class="dv-souls"><i></i><span></span></div></div></div>
          <div class="dv-stats"></div>
          <div class="dv-where"></div>
        </div>
        <div class="dv-boss" hidden><b></b><div class="dv-bossbar"><i></i></div></div>
        <div class="dv-btns">
          <button data-a="gear" title="Inventory (Shift)">🎒</button>
          <button data-a="map" title="Map (M)">🗺️</button>
          <button data-a="mute" title="Sound"></button>
          <button data-a="menu" title="Menu (Esc)">☰</button>
        </div>
        <div class="dv-prompt" hidden></div>
        <div class="dv-bar"></div>
      </div>
      <div class="dv-touch" hidden>
        <div class="dv-stick"><div class="dv-knob"></div></div>
        <div class="dv-tbtns">
          <button data-t="use" class="dv-tuse">✋</button>
          <button data-t="potion">🧪</button>
          <button data-t="gear">🎒</button>
          <button data-t="artifact">✨</button>
          <button data-t="roll">💨</button>
          <button data-t="ranged">🏹</button>
          <button data-t="melee" class="dv-tbig">⚔️</button>
        </div>
      </div>
      <div class="dv-toast" hidden></div>
      <div class="dv-banner" hidden></div>
      <div class="dv-ui"></div>`;
    root.appendChild(el);
    const cv = el.querySelector('canvas')!;
    const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const hud = $('.dv-hud'), hpEl = $('.dv-hp'), statsEl = $('.dv-stats'), whereEl = $('.dv-where');
    const heartEl = $('.dv-heartbig'), soulsEl = $('.dv-souls');
    const bossEl = $('.dv-boss'), promptEl = $('.dv-prompt'), barEl = $('.dv-bar');
    const toastEl = $('.dv-toast'), bannerEl = $('.dv-banner'), ui = $('.dv-ui'), touchEl = $('.dv-touch');
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
    let host: HostSession | null = null;
    let guest: GuestSession | null = null;
    let myName = (() => {
      try {
        return localStorage.getItem(NAME_KEY) || 'Delver';
      } catch {
        return 'Delver';
      }
    })();
    const setName = (n: string) => {
      myName = n.trim().slice(0, 20) || 'Delver';
      try {
        localStorage.setItem(NAME_KEY, myName);
      } catch {
        /* ignore */
      }
    };
    let curSlot = (() => {
      try {
        return Number(localStorage.getItem('dv-cur-slot')) || 0;
      } catch {
        return 0;
      }
    })();
    const setCurSlot = (n: number) => {
      curSlot = n;
      try {
        localStorage.setItem('dv-cur-slot', String(n));
      } catch {
        /* ignore */
      }
    };

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
      bannerEl.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
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
      gm.onMissionTable = () => (guest ? toast('Your host picks the mission. Stay close and you go in together!') : openMission(missionSel));
      gm.onDeath = () => show('dead');
      gm.onEnter = (mode, idx, seed) => host?.entered(mode, idx, seed);
      gm.onFinish = () => host?.finished();
      gm.onReviveMate = (id, by) => host?.revive(id, by);
      gm.onPeerHurt = (id, dmg, fx, fy, effect) => host?.hurtPeer(id, dmg, fx, fy, effect);
      gm.onPeerGain = (id, obj) => host?.gain(id, obj);
      gm.onBothDown = () => {
        host?.bothDown();
        show('dead');
      };
      gm.onLevelDone = (def, found) => {
        lastDone = { name: def.name, found };
        show('done');
      };
      gm.onWin = (hard) => {
        winHard = hard;
        show('win');
      };
    }
    wire(g);
    let lastDone: { name: string; found: ItemKey[] } = { name: '', found: [] };
    let winHard = false;

    // ---------- input ----------
    const keys = new Set<string>();
    const pressed = new Set<string>();
    let mouse: { x: number; y: number } | null = null;
    let mouseL = false;
    let mouseMovedAt = 0;
    const stick = { x: 0, y: 0, id: -1 };
    const held = new Set<string>();

    const toggleGear = () => {
      if (overlay === 'none') show('gear');
      else if (overlay === 'gear' || overlay === 'ench') show('none');
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.startsWith('Digit') ? e.code.slice(5) : e.key.toLowerCase();
      if (e.type === 'keyup') {
        keys.delete(k);
        return;
      }
      if (!keys.has(k)) pressed.add(k);
      keys.add(k);
      if (k === 'tab' || k === ' ' || k === 'alt' || k === 'shift') e.preventDefault();
      if (overlay === 'title') return;
      if (k === 'shift' && !e.repeat && playing) {
        toggleGear();
        return;
      }
      if (k === 'escape') {
        if (overlay === 'none') show('menu');
        else if (overlay === 'menu' || overlay === 'settings' || overlay === 'gear' || overlay === 'map' || overlay === 'mission' || overlay === 'help' || overlay === 'team') show('none');
        else if (overlay === 'slots' || overlay === 'join') show(playing ? 'menu' : 'title');
        else if (overlay === 'ench') show('gear');
      } else if (k === 'i' && (overlay === 'none' || overlay === 'gear')) toggleGear();
      else if (k === 'm' && (overlay === 'none' || overlay === 'map')) {
        if (g.mode === 'camp') {
          if (overlay === 'none') g.onMissionTable();
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
      if (!mouse || Math.hypot(mouse.x - e.offsetX, mouse.y - e.offsetY) > 2) mouseMovedAt = performance.now();
      mouse = { x: e.offsetX, y: e.offsetY };
    });
    cv.addEventListener('pointerdown', (e) => {
      el.focus();
      if (e.pointerType !== 'mouse') return;
      mouse = { x: e.offsetX, y: e.offsetY };
      if (e.button === 0) {
        mouseL = true;
        pressed.add('mouse0');
        if (playing && overlay === 'none' && g.lockAt(R.toWorld(e.offsetX, e.offsetY))) sfx('click');
      }
      if (e.button === 2) pressed.add('mouse2');
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) mouseL = false;
    });

    // touch stick and buttons
    const stickEl = $('.dv-stick'), knob = $('.dv-knob');
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
    el.querySelectorAll<HTMLButtonElement>('.dv-tbtns button').forEach((b) => {
      const t = b.dataset.t!;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (t === 'gear') return toggleGear();
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
        ranged: mouseL || p('mouse0') || keys.has('f') || held.has('ranged'),
        roll: p('mouse2') || p('v') || p('t:roll'),
        potion: p('alt') || p('q') || p('t:potion'),
        use: p('e') || p('enter') || p('t:use'),
        useHeld: keys.has('e') || held.has('use'),
        artifact: p('z') || p('1') ? 0 : p('x') || p('2') ? 1 : p('c') || p('3') ? 2 : p('t:artifact') ? Math.max(0, g.artCd.findIndex((c, i) => c <= 0 && !!g.save.slots[i])) : -1,
        aimMode: touchMode && settings.aim === 'mouse' ? 'nearest' : settings.aim,
        autoFire: settings.autoFire,
        aimFresh: performance.now() - mouseMovedAt < 1200,
      };
      if (p('.')) {
        g.targetId = 0;
        toast('Stopped targeting.');
      }
      pressed.clear();
      return inp;
    }

    // ---------- HUD ----------
    let barKey = '', statKey = '';
    function updateHud() {
      const s = g.save;
      const hpK = Math.max(0, g.hp / g.maxHp);
      hpEl.querySelector('i')!.setAttribute('style', `width:${pct(hpK)}`);
      hpEl.classList.toggle('low', hpK < 0.3);
      hpEl.querySelector('span')!.textContent = `${Math.ceil(g.hp)} / ${g.maxHp}`;
      // the big heart empties from the top as you get hurt
      heartEl.querySelector('i')!.setAttribute('style', `height:${pct(hpK)}`);
      heartEl.querySelector('b')!.textContent = String(Math.ceil(g.hp));
      heartEl.classList.toggle('low', hpK < 0.3);
      const lvNow = s.heroLv ?? 1;
      el.querySelector<HTMLElement>('.dv-xp i')!.style.width = lvNow >= HERO_MAX ? '100%' : pct((s.heroXp ?? 0) / heroXpNeed(lvNow));
      soulsEl.querySelector('i')!.setAttribute('style', `width:${pct(g.souls / MAX_SOULS)}`);
      soulsEl.querySelector('span')!.textContent = `👻 ${g.souls} souls`;
      const st = topStats();
      if (statKey !== st) statsEl.innerHTML = statKey = st;
      whereEl.textContent = g.mode === 'camp' ? 'Delvers’ Camp · the mission map is on the table in the middle' : `${g.def.name} · ${g.M.name} D${g.diff + 1} · monsters Lv ${g.threat} · ${g.monsters.filter((m) => m.kind !== 'loot-hog' && !(m.charmT ?? 0)).length} left`;
      const gd = g.guardian;
      if (gd && g.bossAwake && !gd.dead) {
        bossEl.hidden = false;
        bossEl.querySelector('b')!.textContent = gd.name;
        bossEl.querySelector('i')!.setAttribute('style', `width:${pct(Math.max(0, gd.hp / gd.maxHp))}`);
      } else bossEl.hidden = true;
      if (g.reviveNear) {
        promptEl.hidden = false;
        const who = esc(g.mates.find((m) => m.dead && Math.hypot(m.x - g.x, m.y - g.y) < 1.4)?.name ?? 'your teammate');
        promptEl.innerHTML = `<kbd>${touchMode ? '✋' : 'E'}</kbd> Hold to revive ${who} <span class="dv-revive"><i style="width:${pct(g.reviveT / 1.5)}"></i></span>`;
      } else if (g.dead && (host?.guest || guest)) {
        promptEl.hidden = false;
        promptEl.innerHTML = `💫 You’re down! A teammate can revive you (hold E next to you) · up by yourself in ${Math.max(0, Math.ceil(30 - g.deadT))}s`;
      } else if (g.near) {
        promptEl.hidden = false;
        promptEl.innerHTML = `<kbd>${touchMode ? '✋' : 'E'}</kbd> ${g.near.label}`;
      } else promptEl.hidden = true;
      touchEl.querySelector<HTMLElement>('.dv-tuse')!.style.visibility = g.near || g.reviveNear ? 'visible' : 'hidden';
      const arts = s.slots.map((k, i) => (k ? `${(g.artCd[i] / (ARTIFACTS[parseKey(k).id as unknown as ArtifactId]?.cooldown ?? 1)).toFixed(2)}` : '-')).join('/');
      const key = [arts, s.slots.join(), touchMode, g.souls, g.quiver?.kind, g.quiver?.n].join();
      if (key !== barKey) {
        barKey = key;
        barEl.innerHTML = s.slots
          .map((k, i) => {
            const kk = touchMode ? '' : SLOT_KEYS[i];
            if (!k) return `<div class="dv-slot dv-empty"><em>${kk}</em><small>Empty</small></div>`;
            const id = parseKey(k).id as unknown as ArtifactId;
            const A = ARTIFACTS[id];
            const cd = g.artCd[i] / A.cooldown;
            const short = A.souls > g.souls;
            return `<div class="dv-slot ${cd <= 0 && !short ? 'ready' : ''} ${short ? 'dv-short' : ''}" title="${esc(A.name)}"><img src="${artifactIcon(id)}" alt=""><em>${kk}</em><div class="dv-cool" style="height:${Math.round(Math.max(0, cd) * 100)}%"></div>${cd > 0 ? `<span>${Math.ceil(g.artCd[i])}s</span>` : ''}${A.souls ? `<i class="dv-scost">👻${A.souls}</i>` : ''}</div>`;
          })
          .join('');
      }
    }
    function topStats() {
      const s = g.save;
      const pot = s.potions > 0
        ? `<span class="dv-pot ready" title="Drink with Q">🧪 ${touchMode ? 'Ready' : '<kbd>Q</kbd> Ready'}</span>`
        : `<span class="dv-pot">🧪 ${Math.ceil(POTION_EVERY - g.potionT)}s</span>`;
      const team = host?.guest ? `<span class="dv-team">👥 ${esc(host.guest.name)}</span>` : host ? '<span class="dv-team">👥 Open</span>' : guest ? `<span class="dv-team">👥 ${esc(g.mate?.name ?? 'Host')}</span>` : '';
      const pts = g.enchPoints;
      const q = g.quiver ? `<span class="dv-q">${g.quiver.kind === 'fire' ? '🔥' : g.quiver.kind === 'poison' ? '☠️' : '🎆'} ×${g.quiver.n}</span>` : '';
      return `<span class="dv-pow" title="Power: sword + bow + armor levels ÷ 3">⚡ Power ${g.power}</span><span class="dv-hlv">⭐ Lv ${s.heroLv ?? 1}${pts ? ` · ✨${pts}` : ''}</span>${pot}<span>🏹 ${g.arrowCount()}</span>${q}${team}`;
    }

    // ---------- overlays ----------
    function show(o: Overlay) {
      overlay = o;
      ui.innerHTML = '';
      ui.className = 'dv-ui' + (o === 'none' ? '' : ' on');
      hud.hidden = !playing || o === 'title';
      touchEl.hidden = !(touchMode && playing && o === 'none');
      if (o !== 'none') bannerEl.hidden = true;
      if (o === 'none') {
        el.focus();
        return;
      }
      if (o === 'title') titleScreen();
      else if (o === 'help') panel(`<h2>How to play</h2>${HELP}<p>Walk to the table in the middle of camp to open the mission map. Mission 1, the Ruined Village, comes first; after that you can play the other seven in any order. Each mission ends with a boss; beat it and step into the portal to go home with a reward. Beat a map once on difficulty 1 and you can pick any difficulty for it. Beat mission 8 to open Hard mode.</p><div class="dv-row"><button class="dv-btn" data-x="back">Back</button></div>`, { back: () => show(playing ? 'menu' : 'title') });
      else if (o === 'menu') menu();
      else if (o === 'settings') settingsPanel();
      else if (o === 'gear') gearPanel();
      else if (o === 'map') mapPanel();
      else if (o === 'slots') slotsPanel();
      else if (o === 'join') joinPanel();
      else if (o === 'team') teamPanel();
      else if (o === 'ench') enchPanel();
      else if (o === 'dead' && guest) panel(`<h2 class="dv-red">Your team fell!</h2><p>Your whole team was knocked out. Your host picks what happens next.</p><p class="dv-dim">Waiting for the host…</p><div class="dv-row"><button class="dv-btn" data-x="leave">Leave their game</button></div>`, { leave: () => leaveGuest('You left the team game.') });
      else if (o === 'dead') panel(`<h2 class="dv-red">You fell!</h2><p>The monsters of ${esc(g.def.name)} got you this time. You keep all the gear you found.</p><p class="dv-dim">Monsters beaten this run: ${g.kills} · gear found: ${g.found.length}</p><div class="dv-row"><button class="dv-btn dv-go" data-x="camp">Back to camp</button><button class="dv-btn" data-x="retry">Try again</button></div>`, {
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
      else if (o === 'done') {
        const list = lastDone.found.map((k) => `<div class="dv-item"><img src="${gearIcon(k)}" alt=""><div class="dv-it"><b>${esc(itemName(k))} <span class="dv-lvb">Lv ${parseKey(k).lv}</span></b><small>${statLine(k)}</small></div></div>`).join('');
        const unlocked = lastDone.name === LEVELS[0].name && g.save.cleared.length === 1;
        panel(`<h2>${esc(lastDone.name)} complete!</h2><p>You’re back in camp. ${unlocked ? '<b>Every other mission is open now: pick any of them on the map!</b>' : ''}</p>
          <p>You can now pick <b>any difficulty</b> for ${esc(lastDone.name)} in ${g.M.name} mode.</p>
          <h3>Gear you found (${lastDone.found.length})</h3><div class="dv-items dv-small">${list || '<p class="dv-dim">Nothing this time.</p>'}</div>
          <div class="dv-row"><button class="dv-btn" data-x="inv">🎒 Inventory</button><button class="dv-btn dv-go" data-x="ok">Onward</button></div>`, { ok: () => show('none'), inv: () => show('gear') });
      } else if (o === 'win')
        panel(winHard
          ? `<div class="dv-crown">🌌</div><h2>Nyxwing falls again, on Hard!</h2><p><b>Nightmare mode is open!</b> The toughest monsters there are, and gear all the way up to level 200.</p><div class="dv-row"><button class="dv-btn dv-go" data-x="ok">Back to camp</button></div>`
          : `<div class="dv-crown">🐉</div><h2>Nyxwing, the Void Wyrm, is beaten!</h2><p>The Void Realm is quiet and the camp is safe. <b>Hard mode is open!</b> Monsters come enchanted, but the loot is far better.</p><p class="dv-dim">Pick Hard on the mission map. Beat mission 8 on Hard to open Nightmare.</p><div class="dv-row"><button class="dv-btn dv-go" data-x="ok">Back to camp</button></div>`,
          { ok: () => show('none') });
    }

    function panel(html: string, acts: Record<string, () => void>, cls = '') {
      ui.innerHTML = `<div class="dv-panel ${cls}">${html}</div>`;
      ui.querySelectorAll<HTMLElement>('[data-x]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx('click');
          acts[b.dataset.x!]?.();
        }),
      );
    }

    function titleScreen() {
      const has = !!readSave();
      ui.innerHTML = `<div class="dv-title">
        ${LOGO}
        <p class="dv-tag">Start at a little camp, pick a mission on the map, beat its boss and find better gear. 8 missions, 10 difficulties, 4 modes, up to 4 players.</p>
        <div class="dv-col">
          <button class="dv-btn dv-go" data-x="play">${has ? 'Continue' : 'Play'}</button>
          <button class="dv-btn" data-x="load">📂 Load game</button>
          <button class="dv-btn" data-x="join">👥 Join a friend</button>
          ${has ? '<button class="dv-btn" data-x="new">New game</button>' : ''}
          <button class="dv-btn" data-x="help">How to play</button>
          <button class="dv-btn dv-dim" data-x="exit">Back to games</button>
        </div>
        <div class="dv-cast">${(['shambler', 'rattler', 'gloop', 'fizzler', 'marauder', 'hexer', 'loot-hog'] as const).map((k) => `<img src="${monsterIcon(k, 64)}" title="${MONSTERS[k].name}" alt="">`).join('')}</div>
      </div>`;
      const acts: Record<string, () => void> = {
        play: () => start(),
        load: () => openSlots('load'),
        join: () => show('join'),
        new: () => {
          if (!confirmNew()) return;
          g = new Game();
          wire(g);
          setCurSlot(0);
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
      if (Date.now() - newArmed < 3000) return true;
      newArmed = Date.now();
      toast('Press New game again to wipe your save and start over.');
      return false;
    }
    function start() {
      playing = true;
      g.enterCamp();
      show('none');
      banner('Delvers’ Camp', g.save.cleared.length ? 'The mission map is on the table in the middle.' : 'Walk to the table in the middle and press E to pick your first mission.');
    }

    function menu() {
      const inDungeon = g.mode === 'dungeon';
      const team = guest ? `👥 Team: in ${esc(g.mate?.name ?? 'a friend')}’s game` : host?.guest ? `👥 Team: playing with ${esc(host.guest.name)}` : host ? '👥 Team: open to join' : `👥 Open to join (up to ${MAX_TEAM} players)`;
      panel(`<h2>${guest || host?.guest ? 'Menu' : 'Paused'}</h2>
        ${guest || host?.guest ? '<p class="dv-dim">Team games keep running while the menu is open.</p>' : ''}
        <div class="dv-col">
          <button class="dv-btn dv-go" data-x="resume">Resume</button>
          <button class="dv-btn" data-x="save">💾 Save</button>
          ${guest ? '' : '<button class="dv-btn" data-x="load">📂 Load</button>'}
          <button class="dv-btn" data-x="savequit">💾 Save &amp; quit</button>
          <button class="dv-btn" data-x="team">${team}</button>
          ${inDungeon && !guest ? '<button class="dv-btn" data-x="camp">Leave the mission (back to camp)</button>' : ''}
          <button class="dv-btn" data-x="settings">⚙️ Settings</button>
          <button class="dv-btn" data-x="help">How to play</button>
          <button class="dv-btn dv-dim" data-x="exit">Back to games</button>
        </div>`, {
        resume: () => show('none'),
        save: () => openSlots('save'),
        load: () => openSlots('load'),
        savequit: () => {
          if (curSlot) {
            writeSlot(curSlot, g.save);
            toast(`Saved to slot ${curSlot}.`);
            quitToTitle();
          } else openSlots('savequit');
        },
        team: () => show('team'),
        camp: () => {
          g.enterCamp();
          save();
          show('none');
        },
        help: () => show('help'),
        settings: () => show('settings'),
        exit: () => {
          save();
          void endTeam();
          onExit();
        },
      });
    }
    function quitToTitle() {
      save();
      void endTeam();
      playing = false;
      if (g.mode === 'dungeon') g.enterCamp();
      show('title');
    }

    // --- save slots ---
    let slotMode: 'save' | 'load' | 'savequit' = 'save';
    let armed = 0, armedAt = 0;
    function openSlots(m: typeof slotMode) {
      slotMode = m;
      armed = 0;
      show('slots');
    }
    function slotsPanel() {
      const saving = slotMode !== 'load';
      const rows: string[] = [];
      for (let n = 1; n <= SLOTS; n++) {
        const sd = readSlot(n);
        const d = sd?.data;
        const info = d
          ? `<b>Slot ${n}${n === curSlot ? ' · playing now' : ''}</b><small>⚡ Power ${powerOf(d.melee, d.ranged, d.armor)} · ⭐ Lv ${d.heroLv ?? 1} · ${d.cleared.length} of ${LEVELS.length} missions · ${d.owned.length + (d.arts?.length ?? 0)} items</small><small>Saved ${ago(sd!.saved)}</small>`
          : `<b>Slot ${n}</b><small>Empty</small>`;
        const btn = saving
          ? `<button class="dv-btn ${d ? '' : 'dv-go'}" data-sv="${n}">${armed === n ? 'Tap again to overwrite' : d ? 'Save over' : 'Save here'}</button>`
          : `<button class="dv-btn dv-go" data-ld="${n}" ${d ? '' : 'disabled'}>Load</button>`;
        rows.push(`<div class="dv-saveslot ${n === curSlot ? 'cur' : ''}"><img src="${gearIcon(d ? d.melee : '')}" alt="" style="width:44px;height:44px"><div>${info}</div>${btn}</div>`);
      }
      const title = slotMode === 'load' ? 'Load a game' : slotMode === 'savequit' ? 'Save & quit' : 'Save your game';
      panel(`<h2>${title}</h2>
        <p class="dv-dim">${saving ? 'Saves keep all your gear, artifacts, enchantments, your level and the missions you’ve beaten.' : 'Loading takes you to camp with that save’s gear.'}</p>
        <div class="dv-slots">${rows.join('')}</div>
        <div class="dv-row"><button class="dv-btn" data-x="back">Back</button></div>`, { back: () => show(playing ? 'menu' : 'title') });
      ui.querySelectorAll<HTMLElement>('[data-sv]').forEach((b) =>
        b.addEventListener('click', () => {
          const n = Number(b.dataset.sv);
          if (readSlot(n) && n !== curSlot && !(armed === n && Date.now() - armedAt < 4000)) {
            armed = n;
            armedAt = Date.now();
            slotsPanel();
            return;
          }
          if (!writeSlot(n, g.save)) return toast('Could not save: your browser storage is full or blocked.');
          setCurSlot(n);
          save();
          sfx('buy');
          toast(`Saved to slot ${n}.`);
          if (slotMode === 'savequit') quitToTitle();
          else show(playing ? 'menu' : 'title');
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-ld]').forEach((b) =>
        b.addEventListener('click', () => {
          const n = Number(b.dataset.ld);
          const sd = readSlot(n);
          if (!sd) return;
          void endTeam();
          g = new Game(fixSave(sd.data));
          wire(g);
          setCurSlot(n);
          save();
          toast(`Loaded slot ${n}.`);
          start();
        }),
      );
    }

    // --- team play (up to 4 players, like Factori-owen) ---
    let hostList: HostInfo[] | null = null;
    let joinStatus = '';
    function nameField() {
      return `<label class="dv-dim">Your name</label><input class="dv-name" maxlength="20" value="${esc(myName)}">`;
    }
    function hookName() {
      ui.querySelector<HTMLInputElement>('.dv-name')?.addEventListener('input', (e) => setName((e.target as HTMLInputElement).value));
    }
    function teamPanel() {
      let body: string;
      const acts: Record<string, () => void> = { back: () => show('menu') };
      if (guest) {
        body = `<p>You’re on ${esc(g.mate?.name ?? 'your host')}’s team. They pick the missions; you keep your own gear, and every drop is rolled from your own power.</p><div class="dv-row"><button class="dv-btn" data-x="leave">Leave their game</button><button class="dv-btn dv-go" data-x="back">Back</button></div>`;
        acts.leave = () => leaveGuest('You left the team game.');
      } else if (host) {
        body = `<p>${host.guest ? `On your team: <b>${esc(host.guest.name)}</b>. Up to ${MAX_TEAM} players can play together.` : `Your game is open (up to ${MAX_TEAM} players). On another device, a friend opens Mob Delvers and picks <b>Join a friend</b> on the title screen.`}</p>
          <p class="dv-dim">You pick the missions. Monsters go after whoever is closest. If someone falls, a teammate can revive them: stand next to them and hold E.</p>
          <div class="dv-row"><button class="dv-btn" data-x="close">Close the game to friends</button><button class="dv-btn dv-go" data-x="back">Back</button></div>`;
        acts.close = () => {
          void endTeam();
          toast('Your game is closed to friends.');
          show('team');
        };
      } else {
        body = `<p>Play as a team of up to ${MAX_TEAM}. Open your game, then your friends pick <b>Join a friend</b> on their title screen.</p>${nameField()}
          <div class="dv-row"><button class="dv-btn dv-go" data-x="open">👥 Open to join</button><button class="dv-btn" data-x="back">Back</button></div>`;
        acts.open = () => void openTeam();
      }
      panel(`<h2>Team play</h2>${body}`, acts, 'dv-join');
      hookName();
    }
    async function openTeam() {
      if (host || guest) return;
      const h = new HostSession(() => g, () => myName);
      h.onJoin = (n) => {
        banner('Team up!', `${n} joined your game.`);
        sfx('win');
      };
      h.onLeave = (n) => toast(`${n} left your game.`);
      host = h;
      toast('Opening your game…');
      try {
        await h.open();
        toast(`Your game is open. Up to ${MAX_TEAM - 1} friends can join from their title screen.`);
      } catch (e) {
        host = null;
        toast(`Couldn’t open your game: ${(e as Error).message || e}`);
      }
      if (overlay === 'team') show('team');
    }
    async function endTeam() {
      if (host) {
        const h = host;
        host = null;
        await h.close().catch(() => {});
      }
      if (guest) {
        guest.close();
        guest = null;
        g.remote = false;
        g.mate = null;
      }
    }
    function leaveGuest(why: string) {
      if (!guest) return;
      guest.close();
      guest = null;
      g.remote = false;
      g.mate = null;
      g.dead = false;
      g.hp = g.maxHp;
      g.enterCamp();
      save();
      toast(why);
      if (playing) show('none');
    }
    function joinPanel() {
      const list = hostList === null
        ? '<p class="dv-dim">Looking for games…</p>'
        : hostList.length
          ? hostList.map((h) => `<div class="dv-host"><div><b>${esc(h.name)}’s game</b><small>${esc(h.world)} · ${h.players} of ${MAX_TEAM} playing</small></div><button class="dv-btn dv-go" data-join="${h.id}" ${h.players >= MAX_TEAM ? 'disabled' : ''}>${h.players >= MAX_TEAM ? 'Full' : 'Join'}</button></div>`).join('')
          : '<p class="dv-dim">No open games right now. Your friend opens their game from the menu (Esc → Open to join).</p>';
      panel(`<h2>Join a friend</h2>${nameField()}
        <div class="dv-hosts">${list}</div>
        ${joinStatus ? `<p>${esc(joinStatus)}</p>` : ''}
        <div class="dv-row"><button class="dv-btn" data-x="refresh">↻ Refresh</button><button class="dv-btn" data-x="back">Back</button></div>`, {
        refresh: () => refreshHosts(),
        back: () => show(playing ? 'menu' : 'title'),
      }, 'dv-join');
      hookName();
      ui.querySelectorAll<HTMLElement>('[data-join]').forEach((b) => b.addEventListener('click', () => void joinGame(b.dataset.join!)));
      if (hostList === null) refreshHosts();
    }
    function refreshHosts() {
      hostList = null;
      listHosts()
        .then((l) => (hostList = l))
        .catch((e) => {
          hostList = [];
          joinStatus = `Couldn’t look for games: ${(e as Error).message || e}`;
        })
        .finally(() => overlay === 'join' && joinPanel());
    }
    async function joinGame(id: string) {
      if (guest) return;
      await endTeam();
      joinStatus = 'Connecting…';
      joinPanel();
      if (g.mode === 'dungeon') g.enterCamp();
      const s2 = new GuestSession(() => g, () => myName);
      s2.onLost = (why) => {
        if (guest === s2) leaveGuest(why);
        else {
          joinStatus = why;
          if (overlay === 'join') joinPanel();
        }
      };
      s2.onFail = () => show('dead');
      try {
        await s2.join(id);
        guest = s2;
        joinStatus = '';
        playing = true;
        show('none');
        banner('Team up!', 'You joined your friend’s game.');
      } catch (e) {
        joinStatus = `Couldn’t join: ${(e as Error).message || e}`;
        if (overlay === 'join') joinPanel();
      }
    }

    // --- item text ---
    const elemTag = (e?: 'fire' | 'ice') => (e === 'fire' ? ' · 🔥 burns' : e === 'ice' ? ' · ❄️ slows' : '');
    function statLine(key: ItemKey | '') {
      const { id } = key ? parseKey(key) : { id: '' };
      if (key && isArtifact(id)) {
        const A = ARTIFACTS[id as unknown as ArtifactId];
        return `✨ ${A.desc} · recharges in ${A.cooldown}s${A.souls ? ` · uses ${A.souls} souls` : ''}`;
      }
      if (!key || isMelee(id)) {
        const w = enchantMelee(meleeOf(key), key ? g.enchOf(key) : {});
        return `⚔️ ${w.dmg} damage · ${(1 / w.rate).toFixed(1)} hits/s · reach ${w.reach}${w.arc >= 360 ? ' · all around' : w.arc >= 200 ? ' · wide sweep' : ''}${w.element ? elemTag(w.element) : w.effect ? ` · ${w.effect === 'burn' ? 'burns' : w.effect === 'slow' ? 'slows' : 'stuns'}` : ''}`;
      }
      if (isRanged(id)) {
        const w = enchantRanged(rangedOf(key), g.enchOf(key));
        return `🏹 ${w.dmg} damage${w.shots > 1 ? ` ×${w.shots}` : ''} · ${(1 / w.rate).toFixed(1)} shots/s${w.pierce ? ` · pierces ${w.pierce > 5 ? 'all' : w.pierce}` : ''}${w.auto ? ' · AUTO-FIRE' : ''}${w.element ? elemTag(w.element) : ''}`;
      }
      const a = enchantArmor(armorOf(key), g.enchOf(key));
      return `🛡️ +${a.hp} health · blocks ${pct(a.block)} · protection ×${armorDef(parseKey(key).lv).toFixed(1)}${a.regen ? ' · heals' : ''}${a.speed > 1 ? ` · ${pct(a.speed - 1)} faster` : a.speed < 1 ? ` · ${pct(1 - a.speed)} slower` : ''}${a.lavaproof ? ' · lavaproof' : ''}${a.quickroll ? ' · fast rolls' : ''}`;
    }
    function itemDesc(key: ItemKey) {
      const { id } = parseKey(key);
      return isMelee(id) ? MELEE[id].desc : isRanged(id) ? RANGED[id].desc : isArmor(id) ? ARMOR[id].desc : '';
    }
    const isEquipped = (key: ItemKey) => g.save.melee === key || g.save.ranged === key || g.save.armor === key || g.save.slots.includes(key);
    const enchText = (key: ItemKey) => Object.entries(g.enchOf(key)).map(([k, t]) => `${ENCHANTS[k as EnchId].icon}${'I'.repeat(t ?? 0)}`).join(' ');

    // --- inventory (Shift): 6 slots on the left, everything you own on the right ---
    let invSel: ItemKey | '' = '';
    let invTab: 'all' | 'melee' | 'ranged' | 'armor' | 'art' = 'all';
    let salvageArmed = '';
    function gearPanel() {
      const s = g.save;
      const all = [...s.owned, ...s.arts];
      if (invSel && !all.includes(invSel)) invSel = '';
      if (!invSel) invSel = s.melee || s.ranged;
      const slot = (key: ItemKey | '', label: string, extra = '') => {
        const lv = key ? parseKey(key).lv : 0;
        return `<button class="dv-islot ${key === invSel && key ? 'sel' : ''} ${key ? '' : 'empty'}" ${key ? `data-sel="${key}"` : ''} ${extra}>
          ${key ? `<img src="${gearIcon(key)}" alt=""><span class="dv-ilv">${lv}</span>` : '<b>+</b>'}<small>${label}</small></button>`;
      };
      const kindOf = (k: ItemKey) => {
        const id = parseKey(k).id;
        return isMelee(id) ? 'melee' : isRanged(id) ? 'ranged' : isArmor(id) ? 'armor' : 'art';
      };
      const shown = all.filter((k) => invTab === 'all' || kindOf(k) === invTab).sort((a, b) => parseKey(b).lv - parseKey(a).lv);
      const grid = shown
        .map((k) => `<button class="dv-cell ${k === invSel ? 'sel' : ''} ${isEquipped(k) ? 'eq' : ''}" data-sel="${k}" title="${esc(itemName(k))}"><img src="${gearIcon(k)}" alt=""><span class="dv-ilv">${parseKey(k).lv}</span>${isEquipped(k) ? '<i>✓</i>' : ''}</button>`)
        .join('');
      let detail = '<p class="dv-dim">Pick an item to see it.</p>';
      if (invSel) {
        const k = invSel;
        const id = parseKey(k).id;
        const art = isArtifact(id);
        const eqd = isEquipped(k);
        const en = enchText(k);
        // compare with what you have on now
        const cur = isMelee(id) ? s.melee : isRanged(id) ? s.ranged : isArmor(id) ? s.armor : '';
        const diff = !art && cur && cur !== k ? parseKey(k).lv - parseKey(cur).lv : 0;
        const pAfter = art ? g.power : powerOf(isMelee(id) ? k : s.melee, isRanged(id) ? k : s.ranged, isArmor(id) ? k : s.armor);
        detail = `<div class="dv-dhead"><img src="${gearIcon(k)}" alt=""><div><b>${esc(itemName(k))}</b><span class="dv-lvb">Level ${parseKey(k).lv}</span>${diff ? `<span class="${diff > 0 ? 'dv-up' : 'dv-down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} vs yours</span>` : ''}</div></div>
          <p>${statLine(k)}</p>${itemDesc(k) ? `<p class="dv-dim">${esc(itemDesc(k))}</p>` : ''}
          ${en ? `<p class="dv-ench-t">✨ ${en}</p>` : ''}
          ${!art && !eqd ? `<p class="dv-dim">Power if you wear it: ⚡ ${pAfter} (now ${g.power})</p>` : ''}
          <div class="dv-row dv-left">
            ${art
              ? [0, 1, 2].map((i) => `<button class="dv-btn ${s.slots[i] === k ? 'dv-go' : ''}" data-aslot="${i}">${s.slots[i] === k ? `On ${SLOT_KEYS[i]} ✓` : `Put on ${SLOT_KEYS[i]}`}</button>`).join('')
              : eqd ? '<span class="dv-tagx">Equipped</span>' : '<button class="dv-btn dv-go" data-x="equip">Equip</button>'}
            ${!art ? '<button class="dv-btn dv-enb" data-x="ench">✨ Enchant</button>' : ''}
            ${art && s.slots.includes(k) ? '<button class="dv-btn" data-x="unslot">Take off</button>' : ''}
            ${!eqd ? `<button class="dv-btn dv-salv" data-x="salvage">${salvageArmed === k ? 'Tap again to salvage' : '🗑️ Salvage'}</button>` : ''}
          </div>`;
      }
      const tabs = (['all', 'melee', 'ranged', 'armor', 'art'] as const)
        .map((t) => `<button class="dv-tab ${invTab === t ? 'on' : ''}" data-tab="${t}">${{ all: 'All', melee: '⚔️ Swords', ranged: '🏹 Bows', armor: '🛡️ Armor', art: '✨ Artifacts' }[t]}</button>`)
        .join('');
      ui.innerHTML = `<div class="dv-panel dv-inv">
        <div class="dv-invl">
          <div class="dv-me"></div>
          <div class="dv-power">⚡ ${g.power}<small>POWER</small></div>
          <div class="dv-islots">
            ${slot(s.ranged, 'Bow')}${slot(s.melee, 'Sword')}${slot(s.armor, 'Armor')}
            ${[0, 1, 2].map((i) => slot(s.slots[i], `Artifact ${SLOT_KEYS[i]}`)).join('')}
          </div>
          <p class="dv-istat">❤️ ${Math.ceil(g.hp)} / ${g.maxHp}<br>⭐ Lv ${s.heroLv ?? 1}${(s.heroLv ?? 1) < HERO_MAX ? ` · ${s.heroXp ?? 0}/${heroXpNeed(s.heroLv ?? 1)} xp` : ''}<br>✨ ${g.enchPoints} enchanting point${g.enchPoints === 1 ? '' : 's'}<br>👻 ${g.souls} souls · 🏹 ${s.arrows}</p>
        </div>
        <div class="dv-invr">
          <div class="dv-tabs">${tabs}</div>
          <div class="dv-grid">${grid || '<p class="dv-dim">Nothing here yet.</p>'}</div>
          <div class="dv-detail">${detail}</div>
          <p class="dv-dim dv-small-note">Gear never levels up. Your power is your sword, bow and armor levels ÷ 3, and drops are rolled from it. Salvaging gives back the item’s enchanting points.</p>
          <div class="dv-row"><button class="dv-btn" data-x="settings">⚙️ Settings</button><button class="dv-btn dv-go" data-x="close">Close (Shift)</button></div>
        </div></div>`;
      const a = g.armor;
      ui.querySelector('.dv-me')!.appendChild(portrait(heroParts({ armor: a.color, trim: a.trim, walk: 0, moving: false, helm: a.helm, shiny: parseKey(s.armor).lv >= 100 }), Math.PI / 2, 110, 130, 1, 2.4));
      const on = (sel: string, fn: (b: HTMLElement) => void) => ui.querySelectorAll<HTMLElement>(sel).forEach((b) => b.addEventListener('click', () => (sfx('click'), fn(b))));
      on('[data-x="close"]', () => show('none'));
      on('[data-x="settings"]', () => show('settings'));
      on('[data-sel]', (b) => {
        invSel = b.dataset.sel!;
        salvageArmed = '';
        gearPanel();
      });
      on('[data-tab]', (b) => {
        invTab = b.dataset.tab as typeof invTab;
        gearPanel();
      });
      on('[data-x="equip"]', () => {
        g.equip(invSel);
        gearPanel();
      });
      on('[data-aslot]', (b) => {
        g.slotArtifact(Number(b.dataset.aslot), invSel);
        gearPanel();
      });
      on('[data-x="unslot"]', () => {
        const i = g.save.slots.indexOf(invSel);
        if (i >= 0) g.slotArtifact(i, '');
        gearPanel();
      });
      on('[data-x="ench"]', () => show('ench'));
      on('[data-x="salvage"]', () => {
        if (salvageArmed !== invSel) {
          salvageArmed = invSel;
          return gearPanel();
        }
        const err = g.salvage(invSel);
        if (err) toast(err);
        else toast(`Salvaged ${itemName(invSel)}.`);
        salvageArmed = '';
        invSel = '';
        gearPanel();
      });
    }

    // --- enchanting: each item has 3 random enchantments to pick from ---
    function enchPanel() {
      const key = invSel;
      if (!key) return show('gear');
      const en = g.enchOf(key);
      const rows = enchChoices(key)
        .map((k) => {
          const E = ENCHANTS[k];
          const t = en[k] ?? 0;
          const can = g.enchPoints >= t + 1;
          const pips = [1, 2, 3].map((i) => `<i class="${i <= t ? 'on' : ''}"></i>`).join('');
          const btn = t >= 3 ? '<span class="dv-tagx">Max</span>' : `<button class="dv-btn ${can ? 'dv-go' : ''}" data-ench="${k}" ${can ? '' : 'disabled'}>✨ ${t + 1}</button>`;
          return `<div class="dv-item ${t ? 'eq' : ''}"><b class="dv-eico">${E.icon}</b><div class="dv-it"><b>${E.name} <span class="dv-pips">${pips}</span></b><small>${t ? `Now: ${E.tiers[t - 1]}` : E.tiers.join(' → ')}${t && t < 3 ? ` · next: ${E.tiers[t]}` : ''}</small></div>${btn}</div>`;
        })
        .join('');
      panel(`<h2>✨ Enchant: ${esc(itemName(key))} <small>Lv ${parseKey(key).lv}</small></h2>
        <p>⭐ Lv ${g.save.heroLv ?? 1} · <b>✨ ${g.enchPoints}</b> point${g.enchPoints === 1 ? '' : 's'} to spend</p>
        <p class="dv-dim">This item rolled these 3 enchantments. You get 1 point every time you level up. Tier I costs 1 point, tier II 2 more, tier III 3 more.</p>
        <div class="dv-items dv-small">${rows}</div>
        <div class="dv-row">${Object.keys(en).length ? '<button class="dv-btn" data-x="reset">Take enchantments off (get points back)</button>' : ''}<button class="dv-btn dv-go" data-x="back">Done</button></div>`, {
        back: () => show('gear'),
        reset: () => {
          g.disenchant(key);
          enchPanel();
        },
      });
      ui.querySelectorAll<HTMLElement>('[data-ench]').forEach((b) =>
        b.addEventListener('click', () => {
          const err = g.enchant(key, b.dataset.ench as EnchId);
          if (err) toast(err);
          enchPanel();
        }),
      );
    }

    // --- settings ---
    function settingsPanel() {
      const opt = (k: AimMode, label: string, sub: string) =>
        `<button class="dv-opt ${settings.aim === k ? 'on' : ''}" data-aim="${k}"><b>${label}</b><small>${sub}</small></button>`;
      panel(`<h2>Settings</h2>
        <h3>Where bows aim</h3>
        <div class="dv-opts">
          ${opt('mouse', '🖱️ At the mouse', 'Arrows fly toward your mouse pointer.')}
          ${opt('front', '⬆️ In front of you', 'Arrows fly the way you are facing.')}
          ${opt('nearest', '🎯 Nearest enemy', 'Arrows fly at the closest monster you can see.')}
        </div>
        <h3>Auto-fire bows</h3>
        <div class="dv-opts">
          <button class="dv-opt ${settings.autoFire ? 'on' : ''}" data-auto="1"><b>On</b><small>Auto-fire bows shoot by themselves when a monster is close.</small></button>
          <button class="dv-opt ${!settings.autoFire ? 'on' : ''}" data-auto="0"><b>Off</b><small>Auto-fire bows only shoot when you click or hold F.</small></button>
        </div>
        <div class="dv-row"><button class="dv-btn dv-go" data-x="back">Done</button></div>`, { back: () => show(playing ? 'none' : 'title') }, 'dv-settings');
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

    // --- mission map in the dungeon ---
    function mapPanel() {
      ui.innerHTML = `<div class="dv-panel dv-mapp"><h2>${esc(g.def.name)}</h2><canvas class="dv-mapcv"></canvas>
        <p class="dv-dim">⬜ you · 🟨 loot chests · 🟥 monsters · 💀 the boss room${g.L.portal.open ? ' · the glowing square is the portal home' : ''}</p>
        <div class="dv-row"><button class="dv-btn" data-x="close">Close (M)</button></div></div>`;
      const c = ui.querySelector<HTMLCanvasElement>('.dv-mapcv')!;
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

    // --- the mission map on the camp's table ---
    let missionSel = 0;
    let diffSel = 0;
    function openMission(sel: number) {
      if (!g.mapOpen(sel)) sel = 0;
      missionSel = sel;
      show('mission');
      const s = g.save;
      let mode = g.playMode;
      if (!g.modeOpen(mode)) mode = g.playMode = 'normal';
      const L = LEVELS[sel];
      if (!g.diffOpen(L.id, mode, diffSel)) diffSel = 0;
      const camp = { x: 50, y: 50 };
      const nodes = LEVELS.map((M, i) => {
        const locked = !g.mapOpen(i);
        const done = s.cleared.includes(M.id);
        const best = g.bestOn(M.id, mode);
        return `<path d="M${camp.x} ${camp.y * 0.7} L${M.map.x} ${M.map.y * 0.7}" stroke="#7a4a28" stroke-width="0.6" stroke-dasharray="1.4 1.2" fill="none" opacity="${locked ? 0.35 : 0.8}"/>
          <g class="dv-node ${locked ? 'locked' : ''} ${i === sel ? 'sel' : ''}" data-lv="${i}" transform="translate(${M.map.x} ${M.map.y * 0.7})">
          <rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="${locked ? '#6a5a48' : M.wall[0]}" stroke="${i === sel ? '#fff' : '#2a1a0a'}" stroke-width="${i === sel ? 1 : 0.6}"/>
          <rect x="-5" y="-5" width="10" height="3.5" rx="1" fill="${locked ? '#7a6a58' : M.accent}" opacity=".85"/>
          <text y="2.4" font-size="5" text-anchor="middle" font-weight="900" fill="#fff" stroke="#1a1010" stroke-width=".6" paint-order="stroke">${locked ? '🔒' : i + 1}</text>
          ${done ? `<text x="5" y="-4" font-size="4.4">${best >= 0 ? '⭐' : '✔'}</text>` : ''}
          <text y="9.5" font-size="3.3" text-anchor="middle" fill="#3a2410" font-weight="800">${M.name}</text>
        </g>`;
      }).join('');
      const locked = !g.mapOpen(sel);
      const kinds = [...new Set(L.monsters)];
      const P = g.power;
      const [lo, hi] = dropRange(mode, P, diffSel);
      const M = modeOf(mode);
      const tl = Math.min(200, M.threat[diffSel] + sel);
      ui.innerHTML = `<div class="dv-panel dv-mission">
        <div class="dv-mapwrap"><svg viewBox="-6 -6 112 80" class="dv-parch">
          <defs><pattern id="dvp" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#e8d4a6"/><rect width="1" height="1" fill="#dcc590"/><rect x="2" y="2" width="1" height="1" fill="#f0e0b8"/></pattern></defs>
          <rect x="-6" y="-6" width="112" height="80" fill="url(#dvp)"/>
          <path d="M0 52 Q20 46 30 54 T60 50 T100 56 V70 H0Z" fill="#a8c47a" opacity=".55"/>
          <path d="M28 18 l6-7 6 7z M36 20 l5-6 5 6z" fill="#b0704a" opacity=".8"/>
          <path d="M72 30 q6-4 14 0 q6 4 12 0" stroke="#5a8ab0" stroke-width="1.8" fill="none" opacity=".6"/>
          <circle cx="90" cy="10" r="6" fill="#2a2238" opacity=".75"/><circle cx="88" cy="8" r="1" fill="#c07aff"/>
          ${[[8, 40], [12, 36], [24, 62], [6, 22], [64, 40], [90, 50], [44, 8], [6, 52]].map(([a, b]) => `<rect x="${a}" y="${b}" width="3" height="3" fill="#4f8a3a"/><rect x="${a + 1.1}" y="${b + 3}" width="0.8" height="1.4" fill="#6b4424"/>`).join('')}
          ${nodes}
          <g transform="translate(${camp.x} ${camp.y * 0.7})"><path d="M-4 2 L0 -4 L4 2Z" fill="#b5483a"/><path d="M2 3 L6 -2 L10 3Z" fill="#3f6aa1"/><rect x="-1" y="1" width="3" height="2" fill="#ffb347"/><text y="7" font-size="3.4" text-anchor="middle" fill="#3a2410" font-weight="900">Camp</text></g>
          <g transform="translate(96 64)" opacity=".7"><circle r="4.4" fill="none" stroke="#7a4a28" stroke-width=".5"/><path d="M0-4.4 L1 0 L0 4.4 L-1 0Z" fill="#7a4a28"/></g>
        </svg></div>
        <div class="dv-info">
          <h2>${sel + 1}. ${L.name}</h2>
          <p>${L.blurb}</p>
          <h3>Monsters</h3>
          <div class="dv-mobs">${kinds.map((k) => `<div><img src="${monsterIcon(k, 56)}" alt=""><small>${MONSTERS[k].name}</small></div>`).join('')}${L.mini ? `<div class="dv-gd"><img src="${monsterIcon(L.mini, 56)}" alt=""><small>Mini-boss: ${MONSTERS[L.mini].name}</small></div>` : ''}</div>
          <h3>${L.final ? 'Final boss' : 'Boss'}</h3>
          <div class="dv-mobs"><div class="dv-gd"><img src="${monsterIcon(L.guardian.kind, 72, L.final || MONSTERS[L.guardian.kind].mini ? '' : L.accent)}" alt=""><small>${L.guardian.name}</small></div><p class="dv-dim">${MONSTERS[L.guardian.kind].mini || L.final ? MONSTERS[L.guardian.kind].blurb : `A giant ${MONSTERS[L.guardian.kind].name} with a ring slam that hits all around it.`}</p></div>
          <h3>Mode</h3>
          <div class="dv-diffs">${MODES.map((m) => {
            const open = g.modeOpen(m.id);
            const why = m.id === 'hard' ? 'Beat mission 8 to open Hard' : 'Beat mission 8 on Hard to open Nightmare';
            return `<button class="dv-diff ${m.id === mode ? 'on' : ''}" data-mode="${m.id}" ${open ? '' : 'disabled'} style="--c:${m.color}" title="${open ? m.desc : why}">${open ? '' : '🔒 '}${m.name}</button>`;
          }).join('')}</div>
          <p class="dv-dim dv-small-note">${M.desc}</p>
          <h3>Difficulty</h3>
          <div class="dv-diffs">${Array.from({ length: DIFF_COUNT }, (_, i) => {
            const open = g.diffOpen(L.id, mode, i);
            const beat = g.bestOn(L.id, mode) >= i;
            return `<button class="dv-diff ${i === diffSel ? 'on' : ''}" data-diff="${i}" ${open ? '' : 'disabled'} style="--c:${['#7ad07a', '#a0d878', '#c8e07a', '#e8d870', '#ffc050', '#ff9a40', '#ff7a40', '#ff5a50', '#ff4a7a', '#d04aff'][i]}" title="${open ? `Difficulty ${i + 1}` : `Beat ${L.name} on difficulty 1 first`}">${open ? '' : '🔒'}${i + 1}${beat ? '⭐' : ''}</button>`;
          }).join('')}</div>
          <p class="dv-small-note">${g.diffOpen(L.id, mode, 1) ? '' : `<span class="dv-dim">Beat difficulty 1 here once and you can pick any difficulty for this map.</span><br>`}Monsters level <b>${tl}</b> · ⚡ your power <b>${P}</b> · gear drops level <b>${lo}–${hi}</b> (best on D${diffSel + 1}: ${M.maxDrop[diffSel]})${L.hazard ? ` · watch for ${L.hazard === 'lava' ? 'lava' : L.hazard === 'ice' ? 'slippery ice' : 'deep water'}` : ''}</p>
          <div class="dv-row">
            ${locked ? `<button class="dv-btn" disabled>🔒 Beat ${LEVELS[0].name} first</button>` : '<button class="dv-btn dv-go" data-x="go">Start mission</button>'}
            <button class="dv-btn" data-x="close">Close</button>
          </div>
        </div></div>`;
      ui.querySelectorAll<SVGGElement>('[data-lv]').forEach((n) =>
        n.addEventListener('click', () => {
          sfx('click');
          openMission(Number(n.dataset.lv));
        }),
      );
      ui.querySelector('[data-x="close"]')!.addEventListener('click', () => show('none'));
      ui.querySelectorAll<HTMLElement>('[data-diff]').forEach((b) =>
        b.addEventListener('click', () => {
          diffSel = Number(b.dataset.diff);
          sfx('click');
          openMission(sel);
        }),
      );
      ui.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          g.playMode = b.dataset.mode as ModeId;
          g.save.mode = g.playMode;
          save();
          sfx('click');
          openMission(sel);
        }),
      );
      ui.querySelector('[data-x="go"]')?.addEventListener('click', () => {
        g.diff = diffSel;
        g.enterLevel(sel);
        save();
        show('none');
      });
    }

    // top buttons
    el.querySelectorAll<HTMLButtonElement>('.dv-btns button').forEach((b) =>
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
        else if (a === 'gear') toggleGear();
        else if (a === 'map') {
          if (g.mode === 'camp') g.onMissionTable();
          else show(overlay === 'map' ? 'none' : 'map');
        }
        b.blur();
      }),
    );

    // ---------- loop ----------
    let raf = 0, last = performance.now(), saveT = 0;
    const blankInput: Input = { mx: 0, my: 0, aim: null, melee: false, ranged: false, roll: false, potion: false, use: false };
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      R.resize();
      if (overlay === 'title') {
        g.time += dt;
        const t = g.time * 0.12;
        g.x = 13 + Math.cos(t) * 4;
        g.y = 11 + Math.sin(t) * 3;
        R.draw(g, { minimap: false, title: true });
        return;
      }
      const team = !!(host?.guest || guest);
      if (playing && overlay === 'none') {
        g.update(dt, readInput());
        saveT += dt;
        if (saveT > 20) {
          saveT = 0;
          save();
        }
      } else if (playing && team) {
        pressed.clear();
        g.update(dt, blankInput);
      } else {
        pressed.clear();
        g.update(0, blankInput);
      }
      host?.tick(dt);
      guest?.tick(dt);
      if (guest && overlay === 'dead' && !g.dead) show('none');
      R.draw(g, { minimap: overlay === 'none' });
      if (playing) updateHud();
    }
    show('title');
    raf = requestAnimationFrame(frame);

    if (import.meta.env.DEV)
      (window as unknown as { __dv: unknown }).__dv = {
        g: () => g,
        R: () => R,
        start,
        show: (o: Overlay) => show(o),
        mission: (i: number) => openMission(i),
        slots: (m: 'save' | 'load' | 'savequit') => openSlots(m),
      };

    void BASE_HP;
    void MOB_ENCH_NAME;
    void supplyIcon;
    return () => {
      cancelAnimationFrame(raf);
      save();
      void endTeam();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', blur);
      el.remove();
    };
  },
};

export default game;
