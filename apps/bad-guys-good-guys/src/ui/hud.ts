import { ENEMIES, ITEMS, SECTIONS } from '../core/config';
import type { Look } from '../core/look';
import type { Fx } from '../core/sim';
import type { Snapshot } from '../core/snapshot';
import { portrait, type GameView } from '../render/view';

const COLORS = ['#ff5a4a', '#ff5fb0', '#2fd17a', '#3a9aff'];

interface Bubble {
  el: HTMLElement;
  id: number;
  until: number;
}

/** Everything drawn over the 3D view: health, names, hit words, banners and end screens. */
export class Hud {
  readonly root: HTMLElement;
  private cards: HTMLElement;
  private score: HTMLElement;
  private layer: HTMLElement;
  private banner: HTMLElement;
  private go: HTMLElement;
  private bossBar: HTMLElement;
  private end: HTMLElement;
  private tags = new Map<string, HTMLElement>();
  private bubbles: Bubble[] = [];
  private portraits = new Map<number, string>();
  private portraitKeys = new Map<number, string>();
  private cardKey = '';
  private time = 0;
  private bannerUntil = 0;
  onRestart: () => void = () => {};
  onLeave: () => void = () => {};

  constructor(
    parent: HTMLElement,
    private readonly view: GameView,
    private readonly myId: () => number,
    private readonly canRestart: boolean,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="cards"></div>
      <div class="score"><small>TEAM</small><b>0</b></div>
      <div class="layer"></div>
      <div class="banner"></div>
      <div class="go">GO <span>➜</span></div>
      <div class="bossbar"><b></b><div><i></i></div></div>
      <div class="end"></div>
      <button class="menu-btn" aria-label="Leave game">✕</button>`;
    parent.appendChild(this.root);
    this.cards = this.root.querySelector('.cards')!;
    this.score = this.root.querySelector('.score b')!;
    this.layer = this.root.querySelector('.layer')!;
    this.banner = this.root.querySelector('.banner')!;
    this.go = this.root.querySelector('.go')!;
    this.bossBar = this.root.querySelector('.bossbar')!;
    this.end = this.root.querySelector('.end')!;
    this.root.querySelector('.menu-btn')!.addEventListener('click', () => {
      if (confirm('Leave this game?')) this.onLeave();
    });
  }

  setLooks(looks: Map<number, Look>): void {
    for (const [id, look] of looks) {
      const key = `${id}:${JSON.stringify(look)}`;
      if (this.portraitKeys.get(id) !== key) {
        this.portraits.set(id, portrait(look));
        this.portraitKeys.set(id, key);
      }
    }
    this.looks = looks;
    this.cardKey = '';
  }

  private looks = new Map<number, Look>();

  private tag(key: string, cls: string): HTMLElement {
    let el = this.tags.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = cls;
      this.layer.appendChild(el);
      this.tags.set(key, el);
    }
    el.dataset.seen = '1';
    return el;
  }

  private showBanner(text: string, sub = '', secs = 2.2): void {
    this.banner.innerHTML = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.bannerUntil = this.time + secs;
  }

  events(evs: Fx[]): void {
    const s = this.view.last;
    for (const ev of evs) {
      switch (ev.t) {
        case 'hit': {
          if (!ev.word) break;
          const p = this.view.project(ev.x, ev.y + 0.4, ev.z);
          const el = document.createElement('div');
          el.className = `pop ${ev.big ? 'big' : ''}`;
          el.textContent = ev.word;
          el.style.left = `${p.x + (Math.random() - 0.5) * 30}px`;
          el.style.top = `${p.y}px`;
          el.style.setProperty('--r', `${(Math.random() - 0.5) * 18}deg`);
          this.layer.appendChild(el);
          setTimeout(() => el.remove(), 700);
          break;
        }
        case 'say': {
          const el = document.createElement('div');
          el.className = 'say';
          el.textContent = ev.text;
          this.layer.appendChild(el);
          this.bubbles = this.bubbles.filter((b) => {
            if (b.id === ev.id) b.el.remove();
            return b.id !== ev.id;
          });
          this.bubbles.push({ el, id: ev.id, until: this.time + 2.4 });
          break;
        }
        case 'section':
          this.showBanner(`STRETCH ${ev.i + 1}`, SECTIONS[ev.i].name.toUpperCase());
          break;
        case 'boss':
          this.showBanner('PRINCIPAL GRIMSBY', 'blocks the way to summer!', 2.8);
          break;
        case 'pickup':
          if (ev.id === this.myId()) this.toast(ITEMS[ev.kind].name + (ITEMS[ev.kind].rare ? ' ✦ RARE' : ''));
          break;
        case 'break':
          if (ev.id === this.myId()) this.toast(`Your ${ITEMS[ev.kind].name.toLowerCase()} broke!`);
          break;
        case 'heal':
          if (ev.id === this.myId()) this.toast('Yum! +health');
          break;
        case 'revive': {
          const name = this.looks.get(ev.id)?.name ?? '';
          this.toast(`${name} is back up!`);
          break;
        }
        case 'down':
          if (ev.id === this.myId()) this.toast('You got knocked out! A friend can walk over to revive you.', 3.5);
          break;
      }
    }
    void s;
  }

  private toast(text: string, secs = 1.8): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), secs * 1000);
  }

  update(dt: number): void {
    this.time += dt;
    const s = this.view.last;
    if (!s) return;
    for (const el of this.tags.values()) el.dataset.seen = '';
    this.updateCards(s);
    this.score.textContent = s.kids.reduce((a, k) => a + k.sc, 0).toLocaleString();

    s.kids.forEach((k) => {
      const pos = this.view.kidPos(k.id);
      if (!pos) return;
      const idx = this.kidIndex(k.id);
      const look = this.looks.get(k.id);
      if (k.s === 'down') {
        const p = this.view.project(pos.x, 0.9, pos.z);
        const el = this.tag(`rv${k.id}`, 'revive');
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        const mine = k.id === this.myId();
        el.innerHTML = `<div class="ring" style="--p:${Math.round(k.rv * 100)}%"><span>✚</span></div><b>${mine ? 'Wait for a friend!' : `Walk over to revive ${look?.name ?? ''}`}</b>`;
        return;
      }
      const p = this.view.project(pos.x, pos.top + 0.25, pos.z);
      const el = this.tag(`k${k.id}`, 'tag');
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.style.setProperty('--c', COLORS[idx % 4]);
      const html = `<b>${look?.name ?? ''}${k.id === this.myId() ? ' ★' : ''}</b><div class="h"><i style="width:${k.hp}%"></i></div>`;
      if (el.innerHTML !== html) el.innerHTML = html;
    });

    let boss: (typeof s.en)[number] | null = null;
    for (const e of s.en) {
      if (e.k === 'boss') boss = e;
      if (e.s === 'down' || e.k === 'boss') continue;
      if (e.hp >= e.mhp) continue;
      const pos = this.view.enemyPos(e.id);
      if (!pos) continue;
      const p = this.view.project(pos.x, pos.top + 0.15, pos.z);
      const el = this.tag(`e${e.id}`, 'ebar');
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.innerHTML = `<i style="width:${(e.hp / e.mhp) * 100}%"></i>`;
    }
    for (const pk of s.pk) {
      if (!ITEMS[pk.k].rare) continue;
      const pos = this.view.pickupPos(pk.id);
      if (!pos) continue;
      const p = this.view.project(pos.x, 0.9, pos.z);
      const el = this.tag(`p${pk.id}`, 'pick');
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.textContent = `✦ Rare · ${ITEMS[pk.k].name}`;
    }
    for (const [key, el] of this.tags) {
      if (!el.dataset.seen) {
        el.remove();
        this.tags.delete(key);
      }
    }

    this.bubbles = this.bubbles.filter((b) => {
      const pos = this.view.enemyPos(b.id);
      if (!pos || this.time > b.until) {
        b.el.remove();
        return false;
      }
      const p = this.view.project(pos.x, pos.top + 0.5, pos.z);
      b.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      return true;
    });

    if (boss && boss.s !== 'down') {
      this.bossBar.classList.add('show');
      this.bossBar.querySelector('b')!.textContent = ENEMIES.boss.name;
      this.bossBar.querySelector('i')!.style.width = `${(boss.hp / boss.mhp) * 100}%`;
    } else this.bossBar.classList.remove('show');

    this.go.classList.toggle('show', s.ph === 'walk' && s.sec > 0);
    if (this.time > this.bannerUntil) this.banner.classList.remove('show');
    this.updateEnd(s);
  }

  private kidIndex(id: number): number {
    return [...this.looks.keys()].indexOf(id);
  }

  private updateCards(s: Snapshot): void {
    const key = s.kids.map((k) => `${k.id}:${k.hp}:${k.s === 'down'}:${k.h}:${k.hu}`).join('|');
    if (key === this.cardKey) return;
    this.cardKey = key;
    this.cards.innerHTML = s.kids
      .map((k) => {
        const look = this.looks.get(k.id);
        const c = COLORS[this.kidIndex(k.id) % 4];
        const held = k.h ? `<em>${ITEMS[k.h].name}${ITEMS[k.h].uses > 1 ? ` · ${k.hu}` : ''}</em>` : '';
        return `<div class="card ${k.s === 'down' ? 'ko' : ''} ${k.id === this.myId() ? 'me' : ''}" style="--c:${c}">
          <div class="av" style="background-image:url(${this.portraits.get(k.id) ?? ''})"></div>
          <div><div class="cn">${look?.name ?? ''}${k.s === 'down' ? ' · down' : ''}</div><div class="ch"><i style="width:${k.hp}%"></i></div>${held}</div></div>`;
      })
      .join('');
  }

  private endShown = '';
  private updateEnd(s: Snapshot): void {
    const state = s.ph === 'won' || s.ph === 'lost' ? s.ph : '';
    if (state === this.endShown) return;
    this.endShown = state;
    if (!state) {
      this.end.classList.remove('show');
      return;
    }
    const rows = [...s.kids]
      .sort((a, b) => b.sc - a.sc)
      .map((k) => `<li><span>${this.looks.get(k.id)?.name ?? ''}</span><b>${k.sc.toLocaleString()}</b></li>`)
      .join('');
    this.end.innerHTML = `<div class="panel">
      <h2>${state === 'won' ? "SCHOOL'S OUT!" : 'GROUNDED!'}</h2>
      <p>${state === 'won' ? 'Principal Grimsby is down and summer has begun.' : 'Every kid got knocked out. The grown-ups win this round.'}</p>
      <ol>${rows}</ol>
      <div class="row">${this.canRestart ? `<button class="btn primary again">${state === 'won' ? 'Play again' : 'Try again'}</button>` : '<p class="wait">Waiting for the host to start again…</p>'}
      <button class="btn leave">Leave</button></div></div>`;
    this.end.querySelector('.again')?.addEventListener('click', () => this.onRestart());
    this.end.querySelector('.leave')!.addEventListener('click', () => this.onLeave());
    this.end.classList.add('show');
  }

  destroy(): void {
    this.root.remove();
  }
}
