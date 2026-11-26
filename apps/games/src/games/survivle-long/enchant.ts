// Enchanting: spend enchantment points (one per level up) on picture enchantments for your
// melee weapons (sword, spear, Sword of Light), your bow, and your armor. Each gear type holds up to
// 3 enchantments, and each enchantment goes up to level III.
import type { Arrow, Enemy, Game } from './game';
import { sfx } from './audio';

export type EnchGear = 'melee' | 'bow' | 'armor';

export interface EnchDef {
  id: string;
  name: string;
  gear: EnchGear;
  color: string;
  /** What it does at level 1, 2 or 3. */
  what: (l: number) => string;
  /** The picture, as SVG markup for a 48×48 box. */
  art: string;
}

export const ENCH_MAX = 3;
export const ENCH_SLOTS = 3;
export const GEAR_NAMES: Record<EnchGear, string> = { melee: 'Sword & spear', bow: 'Bow', armor: 'Armor' };
const ROMAN = ['', 'I', 'II', 'III'];
export const roman = (l: number) => ROMAN[l] ?? '';

const frame = (a: string, b: string, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
  `<rect x="2" y="2" width="44" height="44" rx="9" fill="url(#g)" stroke="#1a1426" stroke-width="2.5"/><rect x="5" y="5" width="38" height="38" rx="7" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>${inner}</svg>`;

const ARROW = (x1: number, y1: number, x2: number, y2: number, col = '#f4e6c8') => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 5;
  const p1 = `${x2 - Math.cos(a - 0.5) * h},${y2 - Math.sin(a - 0.5) * h}`, p2 = `${x2 - Math.cos(a + 0.5) * h},${y2 - Math.sin(a + 0.5) * h}`;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7a4a22" stroke-width="2.6" stroke-linecap="round"/><polygon points="${x2},${y2} ${p1} ${p2}" fill="${col}" stroke="#2a2030" stroke-width="0.8"/>`;
};

export const ENCHANTS: EnchDef[] = [
  {
    id: 'boom', name: 'Boom Shot', gear: 'bow', color: '#ff7a3a',
    what: (l) => `Every 4th arrow sticks in and explodes 3 seconds later (${8 + l * 6} damage)`,
    art: frame('#ff9a4a', '#a8331a', `${ARROW(9, 39, 25, 23)}<circle cx="31" cy="20" r="9" fill="#2a2030"/><circle cx="28" cy="17" r="2.5" fill="#6a6078"/><path d="M36 12 q3 -5 7 -4" stroke="#7a4a22" stroke-width="2" fill="none"/><path d="M43 4 l1.5 3.5 l3.5 1 l-3.5 1 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1 l3.5 -1z" fill="#ffe27a"/>`),
  },
  {
    id: 'multi', name: 'Triple Shot', gear: 'bow', color: '#7fd8ff',
    what: (l) => `${[0, 33, 66, 100][l]}% of shots fire 3 arrows in a fan (only costs 1 arrow)`,
    art: frame('#6fc7ff', '#1f4f9a', `${ARROW(10, 38, 36, 12)}${ARROW(10, 38, 22, 8)}${ARROW(10, 38, 40, 26)}`),
  },
  {
    id: 'zap', name: 'Chain Zap', gear: 'bow', color: '#ffe95a',
    what: (l) => `Arrow hits jump lightning to ${l + 1} more enemies (${3 + l * 2} damage each)`,
    art: frame('#4a5aa8', '#151a3a', `<circle cx="10" cy="36" r="4.5" fill="#ff6a6a"/><circle cx="24" cy="14" r="4.5" fill="#ff6a6a"/><circle cx="38" cy="32" r="4.5" fill="#ff6a6a"/><polyline points="12,32 17,26 14,24 22,17" stroke="#ffe95a" stroke-width="3" fill="none" stroke-linejoin="round"/><polyline points="27,17 30,24 33,22 36,29" stroke="#ffe95a" stroke-width="3" fill="none" stroke-linejoin="round"/>`),
  },
  {
    id: 'seek', name: 'Seeker', gear: 'bow', color: '#c58aff',
    what: (l) => `Arrows curve toward enemies${l > 1 ? ' (sharper turns)' : ''} and do +${l} damage`,
    art: frame('#b07aff', '#4a1f8a', `<circle cx="34" cy="16" r="9" fill="none" stroke="#ffd0f0" stroke-width="2.5"/><circle cx="34" cy="16" r="4" fill="none" stroke="#ffd0f0" stroke-width="2"/><circle cx="34" cy="16" r="1.5" fill="#ff5a8a"/><path d="M8 40 C 10 22, 26 34, 30 20" stroke="#7a4a22" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-dasharray="0"/><polygon points="31,17 26,21 31,23" fill="#f4e6c8"/>`),
  },
  {
    id: 'frost', name: 'Frost Bite', gear: 'melee', color: '#9fe8ff',
    what: (l) => `Hits freeze enemies solid for ${(l * 0.6).toFixed(1)} seconds`,
    art: frame('#bff1ff', '#2c7cb0', `<g stroke="#fff" stroke-width="3" stroke-linecap="round"><line x1="24" y1="9" x2="24" y2="39"/><line x1="11" y1="16.5" x2="37" y2="31.5"/><line x1="11" y1="31.5" x2="37" y2="16.5"/></g><g stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"><polyline points="20,11 24,15 28,11"/><polyline points="20,37 24,33 28,37"/><polyline points="12,21 17,22 15,17"/><polyline points="36,27 31,26 33,31"/><polyline points="12,27 17,26 15,31"/><polyline points="36,21 31,22 33,17"/></g>`),
  },
  {
    id: 'thunder', name: 'Thunder Strike', gear: 'melee', color: '#ffe95a',
    what: (l) => `Every 5th hit calls down lightning (${6 + l * 7} damage around the target)`,
    art: frame('#6a7aa0', '#20263a', `<ellipse cx="18" cy="15" rx="9" ry="6" fill="#d8dde8"/><ellipse cx="29" cy="13" rx="10" ry="7" fill="#eef1f6"/><ellipse cx="24" cy="18" rx="13" ry="5" fill="#c8cede"/><polygon points="25,20 17,32 23,32 19,43 32,27 25,27 29,20" fill="#ffe95a" stroke="#a87a10" stroke-width="1"/>`),
  },
  {
    id: 'leech', name: 'Life Leech', gear: 'melee', color: '#ff5a7a',
    what: (l) => `Every enemy you finish off heals you ${['', '¼', '½', '¾'][l]} heart`,
    art: frame('#ff8aa0', '#7a1030', `<path d="M24 40 C 8 28, 8 14, 17 13 C 21 13, 24 17, 24 19 C 24 17, 27 13, 31 13 C 40 14, 40 28, 24 40z" fill="#ff2a50" stroke="#fff" stroke-width="2"/><path d="M19 21 l2 6 l2 -6z M25 21 l2 6 l2 -6z" fill="#fff"/><circle cx="24" cy="33" r="2" fill="#ffd0da"/>`),
  },
  {
    id: 'spin', name: 'Whirlwind', gear: 'melee', color: '#a8ffb0',
    what: (l) => `Every 3rd swing spins all the way around and does ${100 + l * 25}% damage`,
    art: frame('#8af0a0', '#1f7a4a', `<path d="M24 24 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 6 a9 9 0 1 1 -9 -9 a12 12 0 1 1 12 12 a15 15 0 0 1 -15 -15" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><polygon points="38,8 44,12 37,15" fill="#e8f0f8"/>`),
  },
  {
    id: 'spikes', name: 'Spikes', gear: 'armor', color: '#c8c8d0',
    what: (l) => `Enemies that hit you take ${2 + l * 3} damage back`,
    art: frame('#9aa3ad', '#3a3f4a', `<path d="M24 8 L38 13 C38 27 33 35 24 41 C15 35 10 27 10 13z" fill="#6a7280" stroke="#e8eef4" stroke-width="2"/><g fill="#e8eef4"><polygon points="24,0 21,9 27,9"/><polygon points="44,10 36,12 39,17"/><polygon points="4,10 12,12 9,17"/><polygon points="41,31 33,27 34,33"/><polygon points="7,31 15,27 14,33"/><polygon points="24,48 21,40 27,40"/></g><circle cx="24" cy="23" r="5" fill="#e8eef4"/>`),
  },
  {
    id: 'swift', name: 'Swift Feet', gear: 'armor', color: '#ffd34d',
    what: (l) => `You run ${l * 10}% faster`,
    art: frame('#ffe27a', '#b07a10', `<path d="M14 12 h10 v16 h10 c4 0 6 3 6 6 v4 h-26z" fill="#8a5a2b" stroke="#3a2410" stroke-width="2" stroke-linejoin="round"/><rect x="14" y="35" width="26" height="4" fill="#3a2410"/><path d="M24 15 C 32 6, 42 8, 44 10 C 38 11, 34 14, 32 18 C 36 15, 40 15, 42 16 C 36 18, 30 20, 24 20z" fill="#fff" stroke="#c8a040" stroke-width="1"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="4" y1="22" x2="10" y2="22"/><line x1="2" y1="28" x2="10" y2="28"/><line x1="4" y1="34" x2="10" y2="34"/></g>`),
  },
];

export const enchById = (id: string) => ENCHANTS.find((e) => e.id === id);
export const enchSrc = (d: EnchDef) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.art)}`;

const imgs = new Map<string, HTMLImageElement>();
/** The picture as an image for drawing on the canvas. */
export function enchImg(d: EnchDef) {
  let im = imgs.get(d.id);
  if (!im) {
    im = new Image();
    im.src = enchSrc(d);
    imgs.set(d.id, im);
  }
  return im;
}

export interface EnchSave {
  lv: Record<string, number>;
  xp: number;
  level: number;
  points: number;
}

/** A boom arrow stuck in an enemy (or the ground), counting down. */
export interface Stick {
  x: number;
  y: number;
  z: number;
  eid?: number;
  boss?: boolean;
  t: number;
  dmg: number;
  owner?: string;
}

/** A flash of lightning to draw: a chain from point to point, or a bolt from the sky. */
export interface Zap {
  pts: [number, number, number][];
  sky?: boolean;
  t: number;
}

export class Ench {
  lv: Record<string, number> = {};
  xp = 0;
  level = 1;
  /** Enchantment points you haven't spent yet. You start with 3 so you can try it right away. */
  points = 3;
  shots = 0;
  hits = 0;
  swings = 0;
  sticks: Stick[] = [];
  zaps: Zap[] = [];
  /** Seconds left of the whirlwind spin animation. */
  spinT = 0;
  /** Seconds since the last level up, for the HUD flash. */
  levelT = 99;

  get(id: string) {
    return this.lv[id] ?? 0;
  }
  on(gear: EnchGear) {
    return ENCHANTS.filter((d) => d.gear === gear && this.get(d.id) > 0);
  }
  xpNeed() {
    return 6 + this.level * 4;
  }
  /** Points it costs to take this enchantment up one level (I = 1, II = 2, III = 3). */
  cost(id: string) {
    return this.get(id) + 1;
  }
  spent() {
    return Object.values(this.lv).reduce((s, l) => s + (l * (l + 1)) / 2, 0);
  }
  /** Why you can't add this one right now, or '' if you can. */
  blocked(id: string) {
    const d = enchById(id)!;
    const l = this.get(id);
    if (l >= ENCH_MAX) return 'Maxed out';
    if (!l && this.on(d.gear).length >= ENCH_SLOTS) return `${GEAR_NAMES[d.gear]} already has ${ENCH_SLOTS} enchantments`;
    if (this.points < this.cost(id)) return `Needs ${this.cost(id)} ✨`;
    return '';
  }
  enchant(id: string): string {
    const d = enchById(id);
    if (!d) return '';
    const why = this.blocked(id);
    if (why) return why;
    this.points -= this.cost(id);
    this.lv[id] = this.get(id) + 1;
    sfx.chest();
    return `${d.name} ${roman(this.lv[id])}! ${d.what(this.lv[id])}.`;
  }
  /** Take every enchantment off and get all the points back. */
  refund(): string {
    const n = this.spent();
    if (!n) return 'Nothing to take off.';
    this.points += n;
    this.lv = {};
    sfx.click();
    return `All enchantments off. You got ${n} ✨ back.`;
  }

  addXp(g: Game, n: number) {
    this.xp += n;
    let up = 0;
    while (this.xp >= this.xpNeed()) {
      this.xp -= this.xpNeed();
      this.level++;
      this.points++;
      up++;
    }
    if (up) {
      this.levelT = 0;
      sfx.win();
      g.float(g.p.x, g.p.y, g.p.z + 2, `Level ${this.level}! +${up} ✨`, '#ffe27a');
      g.toast(`Level ${this.level}! You have ${this.points} enchantment point${this.points > 1 ? 's' : ''}. Press N (or ✨) to enchant.`);
      g.say('enchlv', 'You leveled up! Spend your enchantment point on a new power.', 120);
    }
  }

  // ---------- bow ----------

  /** Called for each shot. Marks the arrow and returns any extra arrows from Triple Shot. */
  onShoot(a: Arrow): Arrow[] {
    this.shots++;
    const boom = this.get('boom');
    if (boom && this.shots % 4 === 0) a.boom = boom;
    const zap = this.get('zap');
    if (zap) a.zap = zap;
    const seek = this.get('seek');
    if (seek) {
      a.seek = seek;
      a.dmg += seek;
    }
    const multi = this.get('multi');
    const extra: Arrow[] = [];
    if (multi && Math.random() < [0, 0.34, 0.67, 1][multi]) {
      const ang = Math.atan2(a.dy, a.dx);
      for (const s of [-0.28, 0.28]) extra.push({ ...a, boom: undefined, dx: Math.cos(ang + s), dy: Math.sin(ang + s) });
    }
    return extra;
  }

  /** Seeker arrows turn toward the closest enemy in front of them. */
  steer(g: Game, a: Arrow, dt: number) {
    if (!a.seek || a.hostile) return;
    let best: Enemy | null = null, bd = 9;
    for (const e of g.enemies) {
      const dx = e.x - a.x, dy = e.y - a.y, d = Math.hypot(dx, dy);
      if (d < bd && (dx * a.dx + dy * a.dy) / (d || 1) > 0.2) {
        bd = d;
        best = e;
      }
    }
    if (!best) return;
    const want = Math.atan2(best.y - a.y, best.x - a.x);
    let cur = Math.atan2(a.dy, a.dx);
    let df = want - cur;
    while (df > Math.PI) df -= Math.PI * 2;
    while (df < -Math.PI) df += Math.PI * 2;
    const turn = (2 + a.seek * 1.5) * dt;
    cur += Math.max(-turn, Math.min(turn, df));
    a.dx = Math.cos(cur);
    a.dy = Math.sin(cur);
  }

  /** An arrow hit an enemy (host only). */
  arrowHitEnemy(g: Game, a: Arrow, e: Enemy) {
    if (a.boom) this.stick(g, { x: e.x, y: e.y, z: e.z + 0.8, eid: e.id, t: 0, dmg: 8 + a.boom * 6, owner: a.owner });
    if (a.zap) this.chain(g, e, a.zap, a.owner);
  }
  /** An arrow hit something that isn't an enemy. */
  arrowHitElse(g: Game, a: Arrow, boss = false) {
    if (a.boom) this.stick(g, { x: a.x - a.dx * 0.3, y: a.y - a.dy * 0.3, z: a.z, boss, t: 0, dmg: 8 + a.boom * 6, owner: a.owner });
  }

  private stick(g: Game, s: Stick) {
    this.sticks.push(s);
    g.float(s.x, s.y, s.z + 0.6, '💥 3…', '#ff9a4a');
    sfx.click();
  }

  private chain(g: Game, from: Enemy, l: number, owner?: string) {
    const hit = new Set<number>([from.id]);
    let cur: { x: number; y: number; z: number } = from;
    const pts: [number, number, number][] = [[from.x, from.y, from.z + 0.7]];
    for (let n = 0; n < l + 1; n++) {
      let best: Enemy | null = null, bd = 5;
      for (const e of g.enemies) {
        if (hit.has(e.id)) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) break;
      hit.add(best.id);
      pts.push([best.x, best.y, best.z + 0.7]);
      const nx = best.x - cur.x, ny = best.y - cur.y, d = Math.hypot(nx, ny) || 1;
      cur = { x: best.x, y: best.y, z: best.z };
      g.hurtEnemy(best, 3 + l * 2, (nx / d) * 0.3, (ny / d) * 0.3, owner);
    }
    if (pts.length > 1) {
      this.zaps.push({ pts, t: 0.35 });
      sfx.slam();
    }
  }

  // ---------- melee ----------

  /** Called at the start of each swing. True if this swing is a Whirlwind spin. */
  spinNow(): boolean {
    const l = this.get('spin');
    if (!l) return false;
    this.swings++;
    if (this.swings % 3) return false;
    this.spinT = 0.35;
    return true;
  }
  spinMul() {
    return 1 + this.get('spin') * 0.25;
  }

  /** A melee hit landed on an enemy. `killed` is whether it went down. */
  meleeHit(g: Game, e: Enemy, dmg: number, killed: boolean) {
    const guest = g.role === 'guest';
    const fr = this.get('frost');
    if (fr && !killed) {
      if (!guest) {
        e.frozen = Math.max(e.frozen ?? 0, fr * 0.6);
        e.kx = e.ky = 0;
      }
      g.puff(e.x, e.y, e.z + 0.7, '#bff1ff', 8, 1.5);
    }
    const th = this.get('thunder');
    if (th) {
      this.hits++;
      if (this.hits % 5 === 0) this.thunder(g, e.x, e.y, e.z, 6 + th * 7);
    }
    const le = this.get('leech');
    if (le && killed) {
      const p = g.p;
      if (p.hp < g.maxHp) {
        p.hp = Math.min(g.maxHp, p.hp + le);
        g.float(p.x, p.y, p.z + 1.4, `+${['', '¼', '½', '¾'][le]} ❤`, '#ff7a9a');
      }
      g.puff(e.x, e.y, e.z + 0.6, '#ff2a50', 10, 2);
    }
    void dmg;
  }

  private thunder(g: Game, x: number, y: number, z: number, dmg: number) {
    this.zaps.push({ pts: [[x, y, z]], sky: true, t: 0.4 });
    g.shake = Math.max(g.shake, 8);
    sfx.beastBlast();
    g.puff(x, y, z + 0.3, '#fff6a0', 18, 3);
    this.hitArea(g, x, y, z, 1.8, dmg);
  }

  /** Damage everything in a circle (but never you). Works for guests too. */
  hitArea(g: Game, x: number, y: number, z: number, R: number, dmg: number, owner?: string) {
    for (const e of [...g.enemies]) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > R || Math.abs(e.z - z) > 2.5) continue;
      const nx = (e.x - x) / (d || 1), ny = (e.y - y) / (d || 1);
      if (g.role === 'guest') g.net?.hitEnemy(e.id, dmg, nx, ny);
      else g.hurtEnemy(e, dmg, nx, ny, owner);
    }
    if (g.boss.active && !g.boss.dead && g.beastBodies().some((q) => Math.hypot(q.x - x, q.y - y) < R + q.r)) {
      if (g.role === 'guest') g.net?.hitBoss(dmg);
      else g.hurtBoss(dmg);
    }
    g.minis.arrowHit(g, x, y, dmg);
  }

  // ---------- armor ----------

  /** You got hit from (fx, fy): Spikes hurts whoever did it. */
  hurtBack(g: Game, fx?: number, fy?: number) {
    const l = this.get('spikes');
    if (!l || fx === undefined || fy === undefined) return;
    let best: Enemy | null = null, bd = 1.8;
    for (const e of g.enemies) {
      const d = Math.hypot(e.x - fx, e.y - fy);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) return;
    const dmg = 2 + l * 3;
    const nx = best.x - g.p.x, ny = best.y - g.p.y, d = Math.hypot(nx, ny) || 1;
    g.puff(best.x, best.y, best.z + 0.7, '#e8eef4', 8, 2);
    if (g.role === 'guest') g.net?.hitEnemy(best.id, dmg, nx / d, ny / d);
    else g.hurtEnemy(best, dmg, nx / d, ny / d);
  }

  speedMul() {
    return 1 + this.get('swift') * 0.1;
  }

  // ---------- every frame ----------

  update(g: Game, dt: number) {
    this.levelT += dt;
    this.spinT = Math.max(0, this.spinT - dt);
    for (let i = this.zaps.length - 1; i >= 0; i--) if ((this.zaps[i].t -= dt) <= 0) this.zaps.splice(i, 1);
    for (let i = this.sticks.length - 1; i >= 0; i--) {
      const s = this.sticks[i];
      const before = Math.ceil(3 - s.t);
      s.t += dt;
      if (s.eid !== undefined) {
        const e = g.enemies.find((q) => q.id === s.eid);
        if (e) {
          s.x = e.x;
          s.y = e.y;
          s.z = e.z + 0.8;
        } else s.eid = undefined;
      }
      if (s.boss && g.boss.active && !g.boss.dead) {
        s.x += (g.boss.x - s.x) * Math.min(1, dt * 4);
        s.y += (g.boss.y - s.y) * Math.min(1, dt * 4);
      }
      const now = Math.ceil(3 - s.t);
      if (now !== before && now > 0) {
        g.float(s.x, s.y, s.z + 0.6, `${now}…`, '#ff9a4a');
        sfx.click();
      }
      if (s.t >= 3) {
        this.sticks.splice(i, 1);
        sfx.beastBlast();
        g.shake = Math.max(g.shake, 10);
        g.puff(s.x, s.y, s.z, '#ff9a3a', 24, 4.5);
        g.puff(s.x, s.y, s.z, '#ffe27a', 12, 3);
        g.puff(s.x, s.y, s.z, '#4a4458', 14, 3);
        this.hitArea(g, s.x, s.y, s.z, 2.6, s.dmg, s.owner);
      }
    }
  }

  toSave(): EnchSave {
    return { lv: { ...this.lv }, xp: this.xp, level: this.level, points: this.points };
  }
  static fromSave(s: EnchSave | undefined): Ench {
    const en = new Ench();
    if (s) {
      en.lv = { ...s.lv };
      en.xp = s.xp;
      en.level = s.level;
      en.points = s.points;
    }
    return en;
  }
}
