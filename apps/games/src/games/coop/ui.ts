// The co-op screens every game shares: "Play with friends" (host or join with a code) and a small
// badge in the corner that shows the code and who is playing.
import './style.css';
import { MAX_PLAYERS, PLAYER_COLORS, cleanCode, host, join, type FriendSession, type HostSession } from './session';

export interface CoopMenuOpts {
  /** Shown above the buttons, e.g. the game's name. */
  title: string;
  /** PeerJS prefix for this game's codes. */
  prefix: string;
  /** Hide "Host" (e.g. on the title screen, where you join; you host from inside a game). */
  canHost?: boolean;
  canJoin?: boolean;
  onHosted?: (s: HostSession) => void;
  onJoined?: (s: FriendSession) => void;
  onClose?: () => void;
}

/** Opens the "Play with friends" panel over `parent`. Returns a function that closes it. */
export function coopMenu(parent: HTMLElement, o: CoopMenuOpts): () => void {
  const el = document.createElement('div');
  el.className = 'coop-dim';
  const canHost = o.canHost ?? true, canJoin = o.canJoin ?? true;
  el.innerHTML = `<div class="coop-panel" role="dialog">
    <h2>Play with friends</h2>
    <p class="coop-sub">${o.title} · up to ${MAX_PLAYERS} players, each on their own phone or computer.</p>
    ${canHost ? `<button class="coop-btn big" data-c="host">Host this game<small>Friends join your world with a code</small></button>` : ''}
    ${canJoin ? `<form class="coop-join"><input class="coop-code" maxlength="12" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="coop-btn" type="submit">Join a friend</button></form>` : ''}
    <p class="coop-msg" hidden></p>
    <button class="coop-btn ghost" data-c="close">Back</button>
  </div>`;
  parent.appendChild(el);
  const msg = el.querySelector<HTMLParagraphElement>('.coop-msg')!;
  const input = el.querySelector<HTMLInputElement>('.coop-code');
  let busy = false, done = false;
  const say = (t: string, bad = false) => { msg.hidden = !t; msg.textContent = t; msg.classList.toggle('bad', bad); };
  const close = () => { if (done) return; done = true; el.remove(); };
  const stopKeys = (e: KeyboardEvent) => {
    // typing a code shouldn't walk your hero around
    e.stopPropagation();
    if (e.key === 'Escape' && !busy) { close(); o.onClose?.(); }
  };
  el.addEventListener('keydown', stopKeys);
  el.addEventListener('keyup', e => e.stopPropagation());
  input?.addEventListener('input', () => { input.value = cleanCode(input.value); });
  el.addEventListener('click', async e => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-c]')?.dataset.c;
    if (!c || busy) return;
    if (c === 'close') { close(); o.onClose?.(); return; }
    if (c === 'host') {
      busy = true;
      say('Making a code…');
      try { const s = await host(o.prefix); if (done) return s.close(); close(); o.onHosted?.(s); }
      catch (err) { busy = false; say(`Couldn't host: ${(err as Error).message}`, true); }
    }
  });
  el.querySelector('form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !input) return;
    busy = true;
    say('Joining…');
    try { const s = await join(o.prefix, input.value); if (done) return s.close(); close(); o.onJoined?.(s); }
    catch (err) { busy = false; say((err as Error).message || "Couldn't join.", true); }
  });
  setTimeout(() => (input && !canHost ? input : el.querySelector<HTMLElement>('.coop-btn'))?.focus(), 0);
  return close;
}

/** A little badge in the top corner while playing together. */
export function coopBadge(parent: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'coop-badge';
  parent.appendChild(el);
  return {
    /** `slots` are everyone in the game (0 is the host). `me` is your slot. */
    set(code: string, slots: number[], me: number) {
      const dots = slots.map(s => `<i style="background:${PLAYER_COLORS[s]}" title="Player ${s + 1}${s === me ? ' (you)' : ''}">${s + 1}</i>`).join('');
      el.innerHTML = `${me === 0 ? `<span>Code <b>${code}</b></span>` : '<span>Playing together</span>'}${dots}`;
    },
    remove: () => el.remove(),
  };
}

/** Throttle helper: true at most `hz` times a second. */
export function every(hz: number) {
  let last = 0;
  return (now = performance.now()) => {
    if (now - last < 1000 / hz) return false;
    last = now;
    return true;
  };
}
