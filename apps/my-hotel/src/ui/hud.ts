// The heads-up display: coins, hotel level, hints, toasts and floating "+coins".
import { levelInfo, padUnderPlayer, players, playerAtDesk, rating, type Hotel, type HotelEvent } from '../sim/hotel';
import { THEMES } from '../render/theme';

export class Hud {
  readonly el: HTMLDivElement;
  private coins: HTMLElement;
  private level: HTMLElement;
  private bar: HTMLElement;
  private barText: HTMLElement;
  private hint: HTMLElement;
  private keys: HTMLElement;
  private toasts: HTMLElement;
  private last = { coins: -1, xp: -1, hint: '' };

  constructor(h: Hotel, onMenu: () => void, opts: { onInvite?: () => void; guest?: boolean } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="pill coins"><span class="coin"></span><b>0</b></div>
      <div class="pill level"><div class="star"><b>1</b></div><div class="bar"><span></span><em></em></div></div>
      <div class="top-right">
        ${opts.onInvite ? '<button class="pill invite-btn" type="button">📱 Invite</button>' : ''}
        <button class="pill menu" type="button" title="${opts.guest ? 'Leave' : 'Change map'}">${opts.guest ? 'Leave' : `${THEMES[h.map].name} · Maps`}</button>
      </div>
      <div class="pill keys">${
        h.player2 && !opts.guest
          ? 'Player 1: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · Player 2: <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>'
          : 'Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys'
      }</div>
      <div class="hint"></div>
      <div class="toasts"></div>`;
    this.coins = this.el.querySelector('.coins b')!;
    this.level = this.el.querySelector('.star b')!;
    this.bar = this.el.querySelector('.bar span')!;
    this.barText = this.el.querySelector('.bar em')!;
    this.hint = this.el.querySelector('.hint')!;
    this.keys = this.el.querySelector('.keys')!;
    this.toasts = this.el.querySelector('.toasts')!;
    this.el.querySelector('.menu')!.addEventListener('click', onMenu);
    if (opts.onInvite) this.el.querySelector('.invite-btn')!.addEventListener('click', opts.onInvite);
    document.body.appendChild(this.el);
  }

  update(h: Hotel, controlsUsed: boolean) {
    if (h.coins !== this.last.coins) {
      this.last.coins = h.coins;
      this.coins.textContent = h.coins.toLocaleString('en-US');
    }
    if (h.xp !== this.last.xp) {
      this.last.xp = h.xp;
      const l = levelInfo(h.xp);
      const r = rating(h);
      this.level.textContent = String(l.level);
      this.bar.style.width = `${(100 * l.into) / l.need}%`;
      this.barText.textContent = `Hotel level ${l.level}${r ? ` · ${r.toFixed(1)}★` : ''}`;
    }
    this.keys.classList.toggle('gone', controlsUsed && h.time > 8);
    const hint = hintFor(h);
    if (hint !== this.last.hint) {
      this.last.hint = hint;
      this.hint.textContent = hint;
      this.hint.classList.toggle('show', hint !== '');
    }
  }

  events(ev: HotelEvent[], popAt: (text: string, by?: number) => void) {
    for (const e of ev) {
      if (e.kind === 'collect') popAt(`+${e.amount}`, e.by);
      if (e.kind === 'review' && e.stars >= 4) this.toast(`${'★'.repeat(e.stars)} ${e.name}`, `“${e.text}”`);
      if (e.kind === 'unlocked') this.toast('🎉 Unlocked', e.what);
      if (e.kind === 'vip') this.toast(`👑 VIP ${e.name}`, `Left ${e.amount.toLocaleString('en-US')} coins at the desk!`);
      if (e.kind === 'restocked' && e.byPlayer) this.toast('🥤 Restocked', e.cash ? `Took ${e.cash} coins from the machine.` : 'The machine is full again.');
      if (e.kind === 'levelUp') this.toast(`⭐ Hotel level ${e.level}!`, 'Guests pay more and come more often.');
    }
  }

  toast(title: string, body: string) {
    const t = document.createElement('div');
    t.className = 'pill toast';
    t.innerHTML = `<b></b><small></small>`;
    t.querySelector('b')!.textContent = title;
    t.querySelector('small')!.textContent = body;
    this.toasts.prepend(t);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  dispose() {
    this.el.remove();
  }
}

function hintFor(h: Hotel): string {
  const pad = players(h).map((p) => padUnderPlayer(h, p)).find((x) => x) ?? null;
  if (pad && h.coins <= 0) return 'You need coins. Collect them at the desk!';
  if (pad) return 'Stay on the pad to pay';
  if (playerAtDesk(h)) {
    const waiting = h.guests.some((g) => g.state === 'queued');
    const free = h.rooms.some((r) => r.built && r.state === 'ready');
    if (waiting && !free) return 'No clean rooms! Go tidy one up.';
    if (!waiting) return 'Waiting for guests…';
    return '';
  }
  if (h.served === 0 && h.time < 40) return 'Stand behind the desk to check guests in';
  if (h.pile >= 40 && h.coins < 40) return 'Coins are piling up at the desk';
  if (h.vending.some((m) => m.stock === 0) && !h.staff.some((s) => s.role === 'restocker')) return 'A soda machine is empty. Walk up to it to restock!';
  return '';
}
