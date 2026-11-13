// The build menu: a panel of what you can build, in tabs (Base, Defense,
// Infantry, Vehicles) shown as a row of icons, with a power bar down its left
// side. On a phone it is a sheet above the toolbar that the Build button opens;
// on a wide screen it is a sidebar that is always open. Tap an item to start it,
// tap again to put it on hold or take it off; long-press (or right-click) to
// cancel and get your credits back. A finished building is tapped to place it.
import type { BuildItem, BuildMenu, GameLike } from './types';
import { BOLT, COIN, TAB_ICONS } from './pixel-icons';

const LONG_MS = 480;

export interface BuildUI {
  update(now: number): void;
  reset(): void;
}

export function initBuild(getGame: () => GameLike | undefined): BuildUI {
  const btn = document.querySelector<HTMLButtonElement>('#buildBtn')!;
  const sep = document.querySelector<HTMLElement>('#buildSep')!;
  const panel = document.querySelector<HTMLDivElement>('#build')!;
  const tabsEl = panel.querySelector<HTMLDivElement>('.tabs')!;
  const grid = panel.querySelector<HTMLDivElement>('.grid')!;
  const creditsEl = document.querySelector<HTMLSpanElement>('#credits')!;
  const closeBtn = panel.querySelector<HTMLButtonElement>('.close')!;
  const toast = document.querySelector<HTMLDivElement>('#toast')!;
  const pwr = panel.querySelector<HTMLDivElement>('.pwr')!;
  const pwrFill = pwr.querySelector<HTMLDivElement>('.fill')!;
  const pwrUse = pwr.querySelector<HTMLDivElement>('.use')!;
  for (const el of document.querySelectorAll('.coinIco')) el.outerHTML = COIN;
  pwr.querySelector('.boltIco')!.outerHTML = BOLT;
  const hudNum = creditsEl.querySelector<HTMLSpanElement>('.num')!;
  const panelCredits = panel.querySelector<HTMLElement>('.credits')!;
  const panelNum = panelCredits.querySelector<HTMLSpanElement>('.num')!;

  let open = false;
  let tab = '';
  let last = 0;
  let wasPlacing = false;
  let reopen = false;
  const cards = new Map<string, { el: HTMLButtonElement; key: string }>();
  let tabsKey = '';
  const seenSoon = new Set<string>();

  // a wide screen keeps the menu open as a sidebar
  const wideMq = window.matchMedia('(min-width: 900px)');
  const narrow = () => !wideMq.matches;
  let hasMenu = false;

  function setOpen(v: boolean): void {
    open = v;
    panel.hidden = !(hasMenu && (v || !narrow()));
    btn.setAttribute('aria-pressed', String(v));
    document.body.classList.toggle('sheet-open', v && narrow());
    last = 0;
  }
  wideMq.addEventListener('change', () => setOpen(open && narrow()));
  btn.addEventListener('click', () => setOpen(!open));
  closeBtn.addEventListener('click', () => setOpen(false));

  // messages from the game, shown for a moment at the top of the screen
  let toastTimer = 0;
  function notice(msg: string): void {
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), 2600);
  }

  function card(it: BuildItem): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'item';
    el.innerHTML = `<span class="pic"><img alt=""><i class="wipe"></i><b class="state"></b><em class="new">New</em><span class="count"></span></span><span class="label"><span class="name"></span><span class="cost">${COIN}<span></span></span></span>`;
    el.querySelector('img')!.src = it.icon;
    el.querySelector('.name')!.textContent = it.name;
    el.querySelector('.cost span')!.textContent = String(it.cost);
    // tap, long-press to cancel, right-click to cancel
    let timer = 0;
    let longFired = false;
    el.addEventListener('pointerdown', () => {
      longFired = false;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        longFired = true;
        getGame()?.buildCancel?.(it.id);
        last = 0;
      }, LONG_MS);
    });
    const stop = () => clearTimeout(timer);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      stop();
      longFired = true;
      getGame()?.buildCancel?.(it.id);
      last = 0;
    });
    el.addEventListener('click', () => {
      if (longFired) return;
      const g = getGame();
      g?.buildTap?.(it.id);
      last = 0;
      // a ready building goes on the map: get the sheet out of the way
      if (g?.placing?.() && narrow() && open) {
        reopen = true;
        setOpen(false);
      }
    });
    return el;
  }

  function render(): void {
    const g = getGame();
    const menu = g?.buildMenu?.() ?? null;
    const has = !!menu;
    btn.hidden = !has;
    sep.hidden = !has;
    creditsEl.hidden = !has;
    if (has !== hasMenu) {
      hasMenu = has;
      setOpen(has && open);
    }
    if (!menu) return;
    const low = !!menu.power && menu.power.used > menu.power.made;
    hudNum.textContent = String(menu.credits);
    creditsEl.classList.toggle('low', low);
    creditsEl.title = low ? 'Low power: building at half speed' : 'Credits';
    btn.classList.toggle('alert', menu.items.some((i) => i.isNew || i.state === 'ready'));
    if (panel.hidden) return;
    panelNum.textContent = String(menu.credits);
    panelCredits.title = menu.store ? `Credits (you can hold ${menu.store})` : 'Credits';
    panelCredits.classList.toggle('full', !!menu.store && menu.credits >= menu.store);
    renderPower(menu.power);

    if (!menu.tabs.some((t) => t.id === tab)) tab = menu.tabs[0]?.id ?? '';
    const tk = menu.tabs.map((t) => t.id).join(',') + '|' + tab + '|' + menu.tabs.map((t) => (menu.items.some((i) => i.tab === t.id && (i.isNew || i.state === 'ready')) ? 1 : 0)).join('');
    if (tk !== tabsKey) {
      tabsKey = tk;
      tabsEl.replaceChildren(
        ...menu.tabs.map((t) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.role = 'tab';
          if (TAB_ICONS[t.id]) b.innerHTML = TAB_ICONS[t.id];
          else b.textContent = t.label;
          b.title = t.label;
          b.setAttribute('aria-label', t.label);
          b.setAttribute('aria-selected', String(t.id === tab));
          if (menu.items.some((i) => i.tab === t.id && (i.isNew || i.state === 'ready'))) b.classList.add('alert');
          b.addEventListener('click', () => {
            tab = t.id;
            last = 0;
          });
          return b;
        }),
      );
    }

    const shown = menu.items.filter((i) => i.tab === tab);
    // looking at a tab counts as seeing what is new on it (after a moment)
    for (const it of shown)
      if (it.isNew && !seenSoon.has(it.id)) {
        seenSoon.add(it.id);
        window.setTimeout(() => {
          seenSoon.delete(it.id);
          if (!panel.hidden && tab === it.tab) getGame()?.seen?.(it.id);
        }, 1500);
      }
    const keep = new Set(shown.map((i) => i.id));
    for (const [id, c] of cards)
      if (!keep.has(id)) {
        c.el.remove();
        cards.delete(id);
      }
    shown.forEach((it, n) => {
      let c = cards.get(it.id);
      if (!c) {
        c = { el: card(it), key: '' };
        cards.set(it.id, c);
      }
      if (grid.children[n] !== c.el) grid.insertBefore(c.el, grid.children[n] ?? null);
      const p = Math.round(it.progress * 100);
      const key = `${it.state}|${p}|${it.isNew}|${it.blocked ?? ''}|${it.count}`;
      if (key === c.key) return;
      c.key = key;
      const el = c.el;
      el.dataset.state = it.state;
      el.classList.toggle('blocked', !!it.blocked && it.state === 'idle');
      el.classList.toggle('fresh', it.isNew);
      el.title = it.blocked ?? `${it.name}: ${it.blurb}`;
      const wipe = el.querySelector<HTMLElement>('.wipe')!;
      // the part still to build is shaded, sweeping round like a clock
      wipe.style.background = it.state === 'idle' || it.state === 'ready' ? 'none' : `conic-gradient(transparent 0 ${p}%, rgba(0,0,0,0.62) ${p}% 100%)`;
      el.querySelector('.state')!.textContent =
        it.state === 'ready' ? 'Ready' : it.state === 'paused' ? 'On hold' : it.state === 'building' ? `${p}%` : it.blocked && !it.blocked.startsWith('Busy') ? it.blocked : '';
      el.querySelector('.count')!.textContent = it.count > 1 ? `×${it.count}` : '';
    });
  }

  // The power bar: how much the plants make, filling up from the bottom in
  // segments, with a notch for how much the base uses. It goes red, and
  // blinks, when the base uses more than it makes.
  function renderPower(p: BuildMenu['power']): void {
    const made = p?.made ?? 0;
    const used = p?.used ?? 0;
    const top = Math.max(200, Math.ceil((Math.max(made, used) * 1.2) / 100) * 100);
    pwrFill.style.height = `${(100 * made) / top}%`;
    pwrUse.style.bottom = `${(100 * used) / top}%`;
    pwrUse.hidden = used <= 0;
    const level = used > made ? 'low' : used > made * 0.85 ? 'tight' : 'ok';
    pwr.dataset.level = level;
    pwr.title = `Power: using ${used} of ${made}` + (level === 'low' ? ' (low: building at half speed)' : '');
    pwr.setAttribute('aria-valuenow', String(used));
    pwr.setAttribute('aria-valuemax', String(made));
  }

  return {
    update(now: number) {
      const g = getGame();
      const placing = !!g?.placing?.();
      if (wasPlacing && !placing && reopen) {
        reopen = false;
        setOpen(true);
      }
      wasPlacing = placing;
      if (g && g.onNotice !== notice && 'onNotice' in g) g.onNotice = notice;
      if (now - last < 120) return;
      last = now;
      render();
    },
    reset() {
      hasMenu = false;
      setOpen(false);
      reopen = false;
      tab = '';
      tabsKey = '';
      for (const c of cards.values()) c.el.remove();
      cards.clear();
    },
  };
}
