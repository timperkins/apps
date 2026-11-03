// The Bomber's buttons: on the phone of a Bomber who joined by QR code, or beside the game on
// the host screen when the host device plays the Bomber. Up and down are held; the rest are taps.
import { BOMBER, BOMBER_PERKS, type BomberAct, type BomberView } from '../game';

export interface PadHandlers { hold(dir: 'up' | 'down', on: boolean): void; act(a: BomberAct): void; }

const ACTS: [BomberAct, string, string][] = [
  ['missile', 'Missile', 'M'], ['nuke', 'Nuke', 'N'], ['dive', 'Dive', 'D'],
  ['switch', 'Switch plane', 'S'], ['grab', 'Grab', 'G'], ['use', 'Upgrade', 'U'],
];

export class BomberPad {
  readonly el: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(sel: string) => this.el.querySelector(sel) as T;

  constructor(h: PadHandlers, opts: { keys?: boolean; compact?: boolean } = {}) {
    const el = this.el = document.createElement('div');
    el.className = 'pad' + (opts.compact ? ' compact' : '');
    el.innerHTML = `
      <div class="pad-status"><b class="pad-name"></b><span class="pad-hp"></span><span class="pad-note"></span></div>
      <div class="pad-move">
        <div class="alt" aria-label="Height"><i></i><b class="mark m-nuke" style="bottom:${BOMBER.nukeAlt * 100}%"><span>nuke</span></b><b class="mark m-dive" style="bottom:${BOMBER.diveAlt * 100}%"><span>high dive</span></b><em></em></div>
        <div class="updown">
          <button data-hold="up" aria-label="Up">▲<small>Up${opts.keys ? ' · ↑' : ''}</small></button>
          <button data-hold="down" aria-label="Down">▼<small>Down${opts.keys ? ' · ↓' : ''}</small></button>
        </div>
      </div>
      <div class="pad-acts">${ACTS.map(([a, label, key]) => `<button data-act="${a}"><i class="cd"></i><span class="lb">${label}</span>${opts.keys ? `<small>${key}</small>` : ''}</button>`).join('')}</div>
      <div class="pad-dead" hidden><b>You died</b><span></span></div>`;
    el.querySelectorAll<HTMLElement>('[data-hold]').forEach(b => {
      const dir = b.dataset.hold as 'up' | 'down';
      const on = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); b.setPointerCapture?.(e.pointerId); h.hold(dir, true); };
      const off = (e: PointerEvent) => { e.stopPropagation(); if (!b.classList.contains('down')) return; b.classList.remove('down'); h.hold(dir, false); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    });
    el.querySelectorAll<HTMLElement>('[data-act]').forEach(b => b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      b.classList.add('tap'); setTimeout(() => b.classList.remove('tap'), 140);
      h.act(b.dataset.act as BomberAct);
    }));
    // swallow touches so iOS doesn't zoom or select on the buttons
    el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  }

  update(v: BomberView) {
    this.q('.pad-name').textContent = v.name;
    this.q('.pad-hp').textContent = v.alive ? '♥'.repeat(Math.ceil(v.hp)) + '♡'.repeat(Math.max(0, Math.ceil(v.max - v.hp))) : '';
    this.q('.pad-note').textContent = [v.shieldT > 0 ? `Shield ${Math.ceil(v.shieldT)}` : '', v.turboT > 0 ? `Turbo ${Math.ceil(v.turboT)}` : '', v.rapidT > 0 ? `Rapid ${Math.ceil(v.rapidT)}` : '',
      v.diving ? 'Firing!' : '', v.arm >= 0 ? `Arm ${Math.round(v.arm * 100)}%` : ''].filter(Boolean).join(' · ');
    const alt = this.q('.alt');
    (alt.querySelector('i') as HTMLElement).style.height = `${Math.round(v.height * 100)}%`;
    (alt.querySelector('em') as HTMLElement).style.bottom = `${Math.round(v.height * 100)}%`;
    alt.classList.toggle('high', v.canNuke);
    const set = (a: BomberAct, cd: number, ready: boolean, label?: string) => {
      const b = this.q(`[data-act="${a}"]`);
      (b.querySelector('.cd') as HTMLElement).style.height = `${Math.round(Math.max(0, Math.min(1, cd)) * 100)}%`;
      b.classList.toggle('off', !ready || !v.alive);
      if (label) (b.querySelector('.lb') as HTMLElement).textContent = label;
    };
    set('missile', v.missile, v.missile <= 0);
    set('nuke', v.nuke, v.nuke <= 0 && v.canNuke);
    set('dive', v.diving ? 1 : v.dive, !v.diving && v.dive <= 0, v.diving ? 'Firing' : v.height >= BOMBER.diveAlt ? 'Strafe' : 'Dive');
    set('switch', 0, true);
    set('grab', v.arm >= 0 ? 1 - v.arm : 0, v.canGrab, v.arm >= 0 ? 'Reeling in' : 'Grab');
    set('use', 0, !!v.perk, v.perk ? BOMBER_PERKS[v.perk].name : 'Upgrade');
    const dead = this.q('.pad-dead');
    dead.hidden = v.alive;
    if (!v.alive) (dead.querySelector('span') as HTMLElement).textContent = v.deadT > 0 ? `Back in ${Math.ceil(v.deadT)}` : '';
  }
}
