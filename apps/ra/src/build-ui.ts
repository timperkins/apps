// The build menu: a Build button on the toolbar opens a panel of what you can
// build, in tabs (Base, Defense, Infantry, Vehicles). It is a sheet above the
// toolbar on a phone and a sidebar on a wide screen. Tap an item to start it,
// tap again to put it on hold or take it off; long-press (or right-click) to
// cancel and get your credits back. A finished building is tapped to place it.
import type { BuildItem, GameLike } from './types';

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
  const hint = panel.querySelector<HTMLDivElement>('.hint')!;

  let open = false;
  let tab = '';
  let last = 0;
  let wasPlacing = false;
  let reopen = false;
  const cards = new Map<string, { el: HTMLButtonElement; key: string }>();
  let tabsKey = '';
  const seenSoon = new Set<string>();

  const narrow = () => window.innerWidth < 900;

  function setOpen(v: boolean): void {
    open = v;
    panel.hidden = !v;
    btn.setAttribute('aria-pressed', String(v));
    document.body.classList.toggle('sheet-open', v && narrow());
    last = 0;
  }
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
    el.innerHTML = '<img alt=""><span class="name"></span><span class="cost"></span><i class="wipe"></i><b class="state"></b><em class="new">New</em><span class="count"></span>';
    el.querySelector('img')!.src = it.icon;
    el.querySelector('.name')!.textContent = it.name;
    el.querySelector('.cost')!.textContent = `$${it.cost}`;
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
      if (g?.placing?.() && narrow()) {
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
    if (!menu) {
      if (open) setOpen(false);
      return;
    }
    const low = !!menu.power && menu.power.used > menu.power.made;
    creditsEl.textContent = low ? `$${menu.credits} ⚡` : `$${menu.credits}`;
    creditsEl.classList.toggle('low', low);
    creditsEl.title = menu.power && menu.power.used > menu.power.made ? 'Low power: building at half speed' : 'Credits';
    btn.classList.toggle('alert', menu.items.some((i) => i.isNew || i.state === 'ready'));
    if (!open) return;
    const cr = panel.querySelector<HTMLElement>('.credits')!;
    cr.textContent = `$${menu.credits}`;
    cr.title = menu.store ? `Credits (you can hold $${menu.store})` : 'Credits';
    cr.classList.toggle('full', !!menu.store && menu.credits >= menu.store);
    const pw = panel.querySelector<HTMLElement>('.power')!;
    pw.hidden = !menu.power || (menu.power.made === 0 && menu.power.used === 0);
    if (menu.power) {
      pw.textContent = `⚡${menu.power.used}/${menu.power.made}`;
      pw.classList.toggle('low', menu.power.used > menu.power.made);
    }

    if (!menu.tabs.some((t) => t.id === tab)) tab = menu.tabs[0]?.id ?? '';
    const tk = menu.tabs.map((t) => t.id).join(',') + '|' + tab + '|' + menu.tabs.map((t) => (menu.items.some((i) => i.tab === t.id && (i.isNew || i.state === 'ready')) ? 1 : 0)).join('');
    if (tk !== tabsKey) {
      tabsKey = tk;
      tabsEl.replaceChildren(
        ...menu.tabs.map((t) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = t.label;
          b.setAttribute('aria-pressed', String(t.id === tab));
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
    hint.textContent = tab === 'inf' || tab === 'veh' ? 'Tap to queue more · hold to take one off' : 'Tap to build · tap again to hold · hold to cancel';
    // looking at a tab counts as seeing what is new on it (after a moment)
    for (const it of shown)
      if (it.isNew && !seenSoon.has(it.id)) {
        seenSoon.add(it.id);
        window.setTimeout(() => {
          seenSoon.delete(it.id);
          if (open && tab === it.tab) getGame()?.seen?.(it.id);
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
      el.title = it.blocked ?? `${it.name}: ${it.blurb} $${it.cost}`;
      const wipe = el.querySelector<HTMLElement>('.wipe')!;
      // the part still to build is shaded, sweeping round like a clock
      wipe.style.background = it.state === 'idle' || it.state === 'ready' ? 'none' : `conic-gradient(transparent 0 ${p}%, rgba(0,0,0,0.62) ${p}% 100%)`;
      el.querySelector('.state')!.textContent =
        it.state === 'ready' ? 'Ready' : it.state === 'paused' ? 'On hold' : it.state === 'building' ? `${p}%` : it.blocked && !it.blocked.startsWith('Busy') ? it.blocked : '';
      el.querySelector('.count')!.textContent = it.count > 1 ? `×${it.count}` : '';
    });
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
      setOpen(false);
      reopen = false;
      tab = '';
      tabsKey = '';
      for (const c of cards.values()) c.el.remove();
      cards.clear();
    },
  };
}
