// The four corner mini bosses. Each one lives in a lair in a corner of the map, looks different and
// fights differently. Beating one gives a permanent heart and a pile of coins.
import { sfx } from './audio';
import { MAX_HP_CAP } from './data';
import { LAIRS } from './world';
import type { Game } from './game';

export interface MiniKind {
  name: string;
  hp: number;
  radius: number; // tiles, for getting hit
  speed: number;
  color: string;
  intro: string;
}

export const MINI_KINDS: MiniKind[] = [
  { name: 'Frost Golem', hp: 150, radius: 1.3, speed: 2.4, color: '#8fe0ff', intro: 'Brr! A Frost Golem! Watch out for its stomp and ice shards!' },
  { name: 'Ember Toad', hp: 130, radius: 1.3, speed: 0, color: '#ff7a2a', intro: 'An Ember Toad! Move when you see its shadow, it is going to jump on you!' },
  { name: 'Thorn King', hp: 180, radius: 1.3, speed: 1.9, color: '#6fbf4a', intro: 'The Thorn King! Watch the ground for roots, and beat its little helpers!' },
  { name: 'Storm Eye', hp: 160, radius: 1.1, speed: 0, color: '#c9a6ff', intro: 'A Storm Eye! It teleports and shoots lightning. Keep moving!' },
];

export interface Mini {
  kind: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  /** Height above the ground (the toad's jump, the eye's float). */
  lift: number;
  hp: number;
  active: boolean;
  dead: boolean;
  t: number;
  step: number;
  hurtT: number;
  leap: { fx: number; fy: number; tx: number; ty: number; t: number; max: number } | null;
  flash: number;
}

export interface Shot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  life: number;
  dmg: number;
  color: string;
}

export interface Hazard {
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
  dmg: number;
  color: string;
  /** After the hit, how long the burst stays on screen. */
  after: number;
  hit: boolean;
}

export class Minis {
  list: Mini[];
  shots: Shot[] = [];
  hazards: Hazard[] = [];
  private seen = new Set<number>();

  constructor(defeated: number[] = []) {
    this.list = LAIRS.map((l, i) => ({
      kind: i, homeX: l.x + 0.5, homeY: l.y + 0.5, x: l.x + 0.5, y: l.y + 0.5, lift: 0, hp: MINI_KINDS[i].hp, active: false,
      dead: defeated.includes(i), t: 2, step: 0, hurtT: 0, leap: null, flash: 0,
    }));
  }

  defeated() {
    return this.list.filter((m) => m.dead).map((m) => m.kind);
  }

  /** The mini boss you are fighting now, if any. */
  current(): Mini | null {
    return this.list.find((m) => m.active && !m.dead) ?? null;
  }

  private reset(m: Mini) {
    m.active = false;
    m.hp = MINI_KINDS[m.kind].hp;
    m.x = m.homeX;
    m.y = m.homeY;
    m.lift = 0;
    m.leap = null;
    m.t = 2;
    m.step = 0;
  }

  update(g: Game, dt: number) {
    for (const m of this.list) {
      if (m.dead) continue;
      const k = MINI_KINDS[m.kind];
      const near = g.nearest(m.homeX, m.homeY);
      const dHome = near ? near.d : 999;
      const mine = Math.hypot(g.p.x - m.homeX, g.p.y - m.homeY);
      if (!this.seen.has(m.kind) && mine < 45) {
        this.seen.add(m.kind);
        g.say(`lair${m.kind}`, 'Something big lives here… be careful!', 60);
      }
      if (!m.active) {
        if (dHome < 13) {
          m.active = true;
          m.t = 1.5;
          sfx.door();
          g.shake = 10;
          g.toast(`${k.name}!`);
          g.say(`mini${m.kind}`, k.intro, 5);
        }
        continue;
      }
      if (dHome > 34) {
        // everyone ran away (or got knocked out): it heals up and goes home
        this.reset(m);
        this.shots = [];
        this.hazards = [];
        g.enemies = g.enemies.filter((e) => !e.minion);
        continue;
      }
      m.hurtT = Math.max(0, m.hurtT - dt);
      m.flash = Math.max(0, m.flash - dt);
      const p = g.nearest(m.x, m.y) ?? { x: m.x, y: m.y };
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
      if (k.speed && d > 2.2) {
        // walkers chase you
        m.x += (dx / d) * k.speed * dt;
        m.y += (dy / d) * k.speed * dt;
      }
      if (m.kind === 3) m.lift = 1.4 + Math.sin(g.time * 2.5) * 0.3;
      if (m.leap) {
        const L = m.leap;
        L.t += dt;
        const f = Math.min(1, L.t / L.max);
        m.x = L.fx + (L.tx - L.fx) * f;
        m.y = L.fy + (L.ty - L.fy) * f;
        m.lift = Math.sin(f * Math.PI) * 7;
        if (f >= 1) {
          m.leap = null;
          m.lift = 0;
          g.shake = 9;
          sfx.slam();
          g.puff(m.x, m.y, g.world.heightAt(m.x, m.y), '#ff9a3a', 18, 3);
        }
      }
      // keep it in its lair
      m.x = Math.max(m.homeX - 15, Math.min(m.homeX + 15, m.x));
      m.y = Math.max(m.homeY - 15, Math.min(m.homeY + 15, m.y));
      m.t -= dt;
      if (m.t <= 0 && !m.leap) this.attack(g, m);
    }
    this.updateShots(g, dt);
    this.updateHazards(g, dt);
  }

  private aimShots(m: Mini, n: number, spread: number, speed: number, dmg: number, color: string, px: number, py: number) {
    const a0 = Math.atan2(py - m.y, px - m.x);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * spread;
      this.shots.push({ x: m.x, y: m.y, dx: Math.cos(a), dy: Math.sin(a), speed, life: 3.5, dmg, color });
    }
  }

  private attack(g: Game, m: Mini) {
    const p = g.nearest(m.x, m.y) ?? g.p;
    const angry = m.hp < MINI_KINDS[m.kind].hp / 2;
    m.step++;
    m.flash = 0.5;
    switch (m.kind) {
      case 0: {
        // Frost Golem: a big stomp around itself, then a ring of ice shards
        if (m.step % 2) {
          this.hazards.push({ x: m.x, y: m.y, r: 3.6, t: 0, max: 1.1, dmg: 3, color: '#8fe0ff', after: 0.4, hit: false });
          sfx.beastWind();
        } else {
          const n = angry ? 12 : 8;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + m.step * 0.3;
            this.shots.push({ x: m.x, y: m.y, dx: Math.cos(a), dy: Math.sin(a), speed: 5.5, life: 3, dmg: 2, color: '#bff1ff' });
          }
          sfx.orb();
        }
        m.t = angry ? 1.2 : 1.7;
        break;
      }
      case 1: {
        // Ember Toad: leaps onto where you are (shadow first), then spits fireballs
        if (m.step % 3 !== 0) {
          const tx = p.x, ty = p.y;
          this.hazards.push({ x: tx, y: ty, r: 2.2, t: 0, max: 0.95, dmg: 3, color: '#ff7a2a', after: 0.3, hit: false });
          m.leap = { fx: m.x, fy: m.y, tx, ty, t: 0, max: 0.95 };
          sfx.jump();
        } else {
          this.aimShots(m, angry ? 5 : 3, 0.3, 7.5, 2, '#ffb03a', p.x, p.y);
          sfx.bow();
        }
        m.t = angry ? 1.1 : 1.5;
        break;
      }
      case 2: {
        // Thorn King: roots burst out of the ground under you, and it calls little helpers
        if (m.step % 3 === 0 && g.enemies.filter((e) => e.minion).length < 5) {
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            g.spawnMinion(0, m.x + Math.cos(a) * 2.5, m.y + Math.sin(a) * 2.5);
          }
          g.toast('The Thorn King calls its helpers!');
          sfx.door();
        } else {
          const n = angry ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const ox = i === 0 ? 0 : (Math.random() - 0.5) * 5, oy = i === 0 ? 0 : (Math.random() - 0.5) * 5;
            this.hazards.push({ x: p.x + ox, y: p.y + oy, r: 1.4, t: 0, max: 1.1, dmg: 2, color: '#6fbf4a', after: 0.5, hit: false });
          }
          sfx.chop();
        }
        m.t = angry ? 1.2 : 1.6;
        break;
      }
      case 3: {
        // Storm Eye: teleports near you, then a line of lightning toward you, or a spiral of sparks
        if (m.step % 3 === 1) {
          const a = Math.random() * Math.PI * 2;
          g.puff(m.x, m.y, g.world.heightAt(m.x, m.y) + 1.5, '#c9a6ff', 14, 3);
          m.x = p.x + Math.cos(a) * 5;
          m.y = p.y + Math.sin(a) * 5;
          g.puff(m.x, m.y, g.world.heightAt(m.x, m.y) + 1.5, '#fff3a0', 14, 3);
          sfx.orb();
          m.t = 0.4;
          break;
        }
        if (m.step % 3 === 2) {
          const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
          const n = angry ? 8 : 6;
          for (let i = 1; i <= n; i++) {
            this.hazards.push({ x: m.x + (dx / d) * i * 1.4, y: m.y + (dy / d) * i * 1.4, r: 1, t: 0, max: 0.85, dmg: 3, color: '#fff36b', after: 0.25, hit: false });
          }
          sfx.beastWind();
        } else {
          const n = angry ? 10 : 7;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + g.time;
            this.shots.push({ x: m.x, y: m.y, dx: Math.cos(a), dy: Math.sin(a), speed: 4.5, life: 3.2, dmg: 2, color: '#e3c9ff' });
          }
          sfx.orb();
        }
        m.t = angry ? 1 : 1.4;
        break;
      }
    }
  }

  private updateShots(g: Game, dt: number) {
    const all = g.targets();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.dx * s.speed * dt;
      s.y += s.dy * s.speed * dt;
      s.life -= dt;
      for (const t of all) {
        if (s.life > 0 && Math.hypot(s.x - t.x, s.y - t.y) < 0.6 && !(t.id === 'me' && g.p.climbing)) {
          g.hurtTarget(t.id, s.dmg, s.x, s.y);
          s.life = 0;
        }
      }
      if (s.life <= 0) this.shots.splice(i, 1);
    }
  }

  private updateHazards(g: Game, dt: number) {
    const all = g.targets();
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      if (!h.hit && h.t >= h.max) {
        h.hit = true;
        for (const t of all) if (Math.hypot(t.x - h.x, t.y - h.y) < h.r) g.hurtTarget(t.id, h.dmg, h.x, h.y);
      }
      if (h.t >= h.max + h.after) this.hazards.splice(i, 1);
    }
  }

  /** A sword swing. Returns true if it hit a mini boss. */
  swordHit(g: Game, dmg: number, inCone: (dx: number, dy: number) => boolean): boolean {
    const m = this.current();
    if (!m) return false;
    const dx = m.x - g.p.x, dy = m.y - g.p.y, d = Math.hypot(dx, dy);
    if (d < MINI_KINDS[m.kind].radius + 1.7 && m.lift < 3 && inCone(dx, dy)) {
      this.hurt(g, m, dmg);
      return true;
    }
    return false;
  }

  arrowHit(g: Game, x: number, y: number, dmg: number): boolean {
    const m = this.current();
    if (!m) return false;
    if (Math.hypot(m.x - x, m.y - y) < MINI_KINDS[m.kind].radius + 0.2 && m.lift < 3) {
      this.hurt(g, m, dmg);
      return true;
    }
    return false;
  }

  /** The host applies a friend's hit on a mini boss. */
  hurtKind(g: Game, kind: number, dmg: number) {
    const m = this.list[kind];
    if (m && m.active && !m.dead) this.hurt(g, m, dmg, true);
  }

  private hurt(g: Game, m: Mini, dmg: number, remote = false) {
    m.hurtT = 0.2;
    if (!remote) {
      sfx.hit();
      g.float(m.x, m.y, g.world.heightAt(m.x, m.y) + 1.5, `${dmg}`, '#fff');
    }
    if (g.role === 'guest') {
      g.net?.hitMini(m.kind, dmg);
      return;
    }
    m.hp = Math.max(0, m.hp - dmg);
    if (m.hp > 0) return;
    m.dead = true;
    m.active = false;
    this.shots = [];
    this.hazards = [];
    g.enemies = g.enemies.filter((e) => !e.minion);
    g.net?.bonus('mini', String(m.kind));
    this.reward(g, m);
  }

  /** Everyone who is playing gets the prize for a beaten mini boss. */
  reward(g: Game, m: Mini) {
    const k = MINI_KINDS[m.kind];
    m.dead = true;
    m.active = false;
    g.puff(m.x, m.y, g.world.heightAt(m.x, m.y) + 1, k.color, 40, 4);
    const gain = Math.min(4, MAX_HP_CAP - g.maxHp);
    g.maxHp += gain;
    g.p.hp = g.maxHp;
    g.coins += 60;
    sfx.win();
    g.toast(`You beat the ${k.name}! ${gain ? '+1 heart forever and ' : ''}+60 coins`);
    const left = this.list.filter((q) => !q.dead).length;
    g.say(`minidown${m.kind}`, left ? `You beat the ${k.name}! ${left} more mini boss${left > 1 ? 'es' : ''} in the corners of the map.` : 'You beat all four mini bosses! You are a legend!', 5);
  }
}
