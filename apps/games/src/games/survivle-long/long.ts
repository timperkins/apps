// Survivle Long Edition: everything new on top of Survivle. Raider camps with a fire and four spears
// with apples, the Sword of Light, weapons you switch with Shift, shields that break, armor, and 25
// open-world extras (shrines, towers, gliding, horses, cooking, day and night, rain, bombs...).
import {
  ARMOR, ENEMY_KINDS, LIGHT_DMG, LIGHT_HEARTS, MAX_HP_CAP, MAX_SWORD, QUESTS, RECIPES, SHIELDS, SPEAR_DMG, WEAPON_NAMES,
  armorById, isRaider, raiderArmor, raiderShield, raiderWeapon, shieldById, type ArmorSlot, type Recipe, type Weapon,
} from './data';
import { sfx } from './audio';
import type { Enemy, Game, Target } from './game';
import {
  CAMP_SPEARS, G, GROVE, ORE_ROCKS, S, T, VILLAGES, blocksMove, castleR, inRoom, siteIn, sitesNear, tG, tH, tT, villageAt, type Site,
} from './world';

/** Village spots for the blacksmith and the elder, from the village centre. */
export const SMITH = { x: 8, y: -6 };
export const ELDER = { x: -7, y: 7 };
/** One day and night, in seconds of play. */
export const DAY_LEN = 720;

export interface Horse {
  id: number;
  x: number;
  y: number;
  z: number;
  face: number;
  walkT: number;
  wanderA: number;
  wanderT: number;
  color: string;
}

export interface Pickup {
  x: number;
  y: number;
  /** Height above the ground (stars fall from the sky). */
  fall: number;
  kind: 'red' | 'blue' | 'star';
}

export interface Bomb {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
}

export interface CampState {
  spears: number; // bit set: which spears were taken
  alive: number;
  spawned: boolean;
  cleared: boolean;
  chest: boolean; // loot chest opened
  alarm: boolean;
}

export interface LongSave {
  weapon: Weapon;
  spears: number;
  light: boolean;
  shield: { id: string; hp: number } | null;
  armor: Record<ArmorSlot, string | null>;
  ownedArmor: string[];
  bombs: number;
  fireArrows: number;
  arrowType: 'normal' | 'ice' | 'fire';
  glider: boolean;
  red: number;
  blue: number;
  meat: number;
  stars: number;
  gems: number;
  orbs: number;
  stamUp: number;
  found: number[];
  towers: number[];
  discovered: number[];
  camps: [number, CampState][];
  mined: string[];
  quest: { id: string; village: number; got: number } | null;
  questsDone: number;
}

const HORSE_COLS = ['#8a5a2b', '#3a2a1e', '#e8e0d0', '#6b4424', '#a07850'];

export class Long {
  weapon: Weapon = 'sword';
  spears = 0;
  light = false;
  shield: { id: string; hp: number } | null = null;
  /** Holding the shield up (F, right mouse button, or the 🛡 button). */
  blocking = false;
  blockT = 0;
  armor: Record<ArmorSlot, string | null> = { head: null, body: null, legs: null };
  ownedArmor: string[] = [];
  bombs = 0;
  fireArrows = 0;
  arrowType: 'normal' | 'ice' | 'fire' = 'normal';
  glider = false;
  gliding = false;
  /** Holding the sprint key. */
  sprint = false;
  riding: Horse | null = null;
  horses: Horse[] = [];
  red = 0;
  blue = 0;
  meat = 0;
  stars = 0;
  gems = 0;
  orbs = 0;
  /** Stamina upgrades from shrines: each one makes stamina last 25% longer. */
  stamUp = 0;
  found = new Set<number>();
  towers = new Set<number>();
  discovered = new Set<number>();
  camps = new Map<number, CampState>();
  mined = new Set<string>();
  oreHits = new Map<string, number>();
  springCd = new Map<number, number>();
  pickups: Pickup[] = [];
  bombsFlying: Bomb[] = [];
  /** Buffs, in seconds left. */
  soup = 0;
  chili = 0;
  feast = 0;
  rain = 0;
  private rainLeft = 0;
  private rainCd = 200 + Math.random() * 200;
  private coldT = 0;
  private burnT = 0;
  private pickCd = 0;
  private wolfCd = 30;
  private starCd = 20;
  private horseCd = 2;
  private siteCd = 0;
  /** Places near the hero right now (refreshed a few times a second). */
  near: Site[] = [];
  quest: { id: string; village: number; got: number } | null = null;
  questsDone = 0;
  onCook: (() => void) | null = null;
  onShrine: ((key: number) => void) | null = null;
  onSmith: ((vi: number) => void) | null = null;
  onElder: ((vi: number) => void) | null = null;

  // ---------- weapons ----------

  weapons(): Weapon[] {
    const w: Weapon[] = ['sword', 'bow'];
    if (this.spears > 0) w.push('spear');
    if (this.light) w.push('light');
    return w;
  }

  /** Shift: the next weapon. */
  cycleWeapon(g: Game) {
    const list = this.weapons();
    const i = list.indexOf(this.weapon);
    this.weapon = list[(i + 1) % list.length];
    sfx.click();
    g.toast(`${this.weaponIcon(this.weapon)} ${this.weaponLabel(g, this.weapon)}`);
  }

  weaponIcon(w: Weapon) {
    return w === 'sword' ? '⚔' : w === 'bow' ? '🏹' : w === 'spear' ? '🔱' : '✨';
  }

  weaponLabel(g: Game, w: Weapon) {
    if (w === 'sword') return `${g.swordName()} · ${g.swords[g.sword] ?? 1}`;
    if (w === 'bow') return `${g.bowName()} · ${g.bowDmg}`;
    if (w === 'spear') return `Spear ×${this.spears} · ${SPEAR_DMG}`;
    return `${WEAPON_NAMES.light} · ${LIGHT_DMG}`;
  }

  /** Damage of the weapon in your hand when you swing it (feast buff included). */
  meleeDmg(base: number) {
    const d = this.weapon === 'light' ? LIGHT_DMG : this.weapon === 'spear' ? SPEAR_DMG : base;
    return this.feast > 0 ? Math.round(d * 1.5) : d;
  }

  /** The Sword of Light does double to bosses. */
  bossMul() {
    return this.weapon === 'light' ? 2 : 1;
  }

  reach() {
    return this.weapon === 'spear' ? 3.3 : this.weapon === 'light' ? 2.9 : 2.4;
  }

  armorDef() {
    let d = 0;
    for (const id of Object.values(this.armor)) d += armorById(id)?.def ?? 0;
    return Math.min(0.55, d);
  }

  warm() {
    return this.chili > 0 || Object.values(this.armor).some((id) => armorById(id)?.warm);
  }

  // ---------- getting hurt ----------

  /** A hit on you: the shield takes it if it is up and facing the hit, armor soaks some. Returns quarters left (0 = blocked). */
  absorb(g: Game, q: number, fx?: number, fy?: number): number {
    const p = g.p;
    if (this.riding) this.dismount(g, false);
    if (this.blocking && this.shield) {
      let facing = true;
      if (fx !== undefined && fy !== undefined) {
        let d = Math.atan2(fy - p.y, fx - p.x) - p.face;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        facing = Math.abs(d) < 1.7;
      }
      if (facing) {
        this.shield.hp -= q * 3;
        sfx.slam();
        g.float(p.x, p.y, p.z + 0.4, 'Blocked!', '#bfe3ff');
        g.puff(p.x + Math.cos(p.face) * 0.6, p.y + Math.sin(p.face) * 0.6, p.z + 0.8, '#dfe6ee', 6, 2);
        if (this.shield.hp <= 0) {
          const name = shieldById(this.shield.id)?.name ?? 'shield';
          this.shield = null;
          this.blocking = false;
          sfx.treeFall();
          g.puff(p.x, p.y, p.z + 0.8, '#9b6b3c', 18, 3);
          g.toast(`Your ${name} broke! The blacksmith in a village sells new ones.`);
          g.say('shieldbreak', 'Your shield broke!', 20);
        }
        return 0;
      }
    }
    const def = this.armorDef();
    return def ? Math.max(1, Math.round(q * (1 - def))) : q;
  }

  // ---------- enemies ----------

  /** Extra rules when a raider or wolf gets hit. Returns the damage that gets through. */
  enemyHit(g: Game, e: Enemy, dmg: number, bomb = false): number {
    if (e.sleep) {
      e.sleep = false;
      dmg *= 3;
      g.float(e.x, e.y, e.z + 1.2, 'Sneak attack ×3!', '#ffe27a');
      this.alarm(g, e);
    }
    if ((e.shield ?? 0) > 0) {
      if (bomb) e.shield = 0;
      else {
        e.shield = (e.shield ?? 0) - dmg;
        dmg = Math.round(dmg * 0.25 * 100) / 100;
      }
      if ((e.shield ?? 0) <= 0) {
        e.shield = 0;
        sfx.treeFall();
        g.puff(e.x, e.y, e.z + 0.8, '#7a5a3a', 14, 2.5);
        g.float(e.x, e.y, e.z + 1.6, 'Shield broke!', '#ffd34d');
      } else sfx.slam();
    }
    const arm = raiderArmor(e.kind);
    if (arm) dmg = Math.round(dmg * (1 - arm) * 100) / 100;
    if (isRaider(e.kind) || e.kind === 8) this.alarm(g, e);
    return dmg;
  }

  /** Every raider in this one's camp wakes up and comes for you. */
  alarm(g: Game, e: Enemy) {
    e.aggro = true;
    e.sleep = false;
    if (e.camp === undefined) return;
    const c = this.camps.get(e.camp);
    if (!c || c.alarm) return;
    c.alarm = true;
    for (const o of g.enemies) {
      if (o.camp === e.camp) {
        o.aggro = true;
        o.sleep = false;
      }
    }
    sfx.beastWind();
    g.toast('The raiders sound the alarm! The whole camp is coming!');
    g.say('alarm', 'Uh oh, they blew the horn! Here comes the whole camp!', 30);
  }

  /** A raider or wolf was beaten by you: drops and camp counting. */
  enemyDied(g: Game, e: Enemy, mine: boolean) {
    if (e.camp !== undefined) {
      const c = this.camps.get(e.camp);
      if (c) {
        c.alive = Math.max(0, c.alive - 1);
        if (c.alive === 0 && c.spawned && !c.cleared) {
          c.cleared = true;
          g.toast('Camp cleared! A loot chest appeared by the fire.');
          g.say('campclear', 'You cleared the whole camp! Check the chest by the fire.', 20);
          sfx.chest();
          if (this.quest && QUESTS.find((q) => q.id === this.quest!.id)?.kind === 'camp') this.quest.got++;
        }
      }
    }
    if (!mine) return;
    if (isRaider(e.kind) && this.quest && QUESTS.find((q) => q.id === this.quest!.id)?.kind === 'raiders') this.quest.got++;
    const w = raiderWeapon(e.kind);
    if (e.kind === 8) {
      this.meat++;
      g.float(e.x, e.y, e.z + 1, '+1 meat', '#ff9a8a');
      return;
    }
    if (e.kind === 7) {
      // captains always drop something good
      const left = ARMOR.filter((a) => !this.ownedArmor.includes(a.id) && a.def >= 0.08 && !a.warm);
      if (left.length) {
        const a = left[Math.floor(Math.random() * left.length)];
        this.ownedArmor.push(a.id);
        g.toast(`The captain dropped a ${a.name}! Wear it from Gear (I).`);
      } else {
        g.coins += 40;
        g.toast('The captain dropped 40 coins!');
      }
      if (!this.shield || this.shield.hp < 70) {
        this.shield = { id: 'iron', hp: 70 };
        g.toast('You picked up an Iron Shield! Hold F to block.');
      }
      return;
    }
    if (w === 'sword' && Math.random() < 0.4) {
      const best = Math.max(...g.swords);
      const d = Math.min(MAX_SWORD, Math.max(2, best - 1 + Math.floor(Math.random() * 3)));
      if (!g.swords.includes(d)) {
        g.swords.push(d);
        g.swords.sort((a, b) => a - b);
        g.toast(`Picked up the raider's sword: ${g.swordNameOf(d)} (${d} damage)`);
      }
    }
    if ((e.kind === 6 || raiderShield(e.kind)) && Math.random() < 0.6 && (!this.shield || this.shield.hp < 30)) {
      this.shield = { id: 'raider', hp: 45 };
      g.toast('You picked up a Raider Shield! Hold F (or 🛡) to block.');
    }
    if (w === 'spear' && Math.random() < 0.65) {
      this.spears++;
      g.float(e.x, e.y, e.z + 1, '+1 spear', '#e9c58a');
    }
    if (w === 'bow') {
      const n = 3 + Math.floor(Math.random() * 4);
      g.arrows += n;
      g.float(e.x, e.y, e.z + 1, `+${n} arrows`, '#e9c58a');
    }
  }

  /** How raiders and wolves move. Returns the step to take and how close they must be to hit. */
  brain(g: Game, e: Enemy, tg: (Target & { d: number }) | null, dt: number): { mx: number; my: number; reach: number } {
    const k = ENEMY_KINDS[e.kind];
    const d = tg ? tg.d : 999;
    const hx = e.hx ?? e.x, hy = e.hy ?? e.y;
    e.swingT = Math.max(0, (e.swingT ?? 0) - dt);
    if (e.sleep) {
      // wakes up if you walk right up to it (unless you are sneaking without sprinting)
      if (tg && d < (this.sprint || this.riding ? 4 : 1.6)) this.alarm(g, e);
      return { mx: 0, my: 0, reach: 0 };
    }
    const sight = e.kind === 8 ? 14 : e.kind === 4 ? 16 : 12;
    if (tg && !e.aggro && d < sight) {
      e.aggro = true;
      if (e.camp !== undefined) this.alarm(g, e);
      else if (tg.id === 'me') g.say('wolf', 'Wolves! Stay together and fight!', 40);
    }
    // camp raiders don't chase forever
    if (e.camp !== undefined && Math.hypot(e.x - hx, e.y - hy) > 34) {
      e.aggro = false;
      const c = this.camps.get(e.camp);
      if (c) c.alarm = false;
    }
    if (!e.aggro || !tg) {
      // stay around home (camp fire), or wander
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 1.5 + Math.random() * 3;
        const hd = Math.hypot(e.x - hx, e.y - hy);
        e.wanderA = hd > 4 ? Math.atan2(hy - e.y, hx - e.x) : Math.random() < 0.5 ? NaN : Math.random() * Math.PI * 2;
      }
      if (Number.isNaN(e.wanderA)) return { mx: 0, my: 0, reach: 0 };
      return { mx: Math.cos(e.wanderA) * k.speed * 0.35 * dt, my: Math.sin(e.wanderA) * k.speed * 0.35 * dt, reach: 0 };
    }
    const dx = tg.x - e.x, dy = tg.y - e.y;
    const nx = dx / (d || 1), ny = dy / (d || 1);
    if (e.kind === 4) {
      // archers keep their distance and shoot
      e.shootCd = (e.shootCd ?? 1.5) - dt;
      if (e.shootCd <= 0 && d < 18) {
        e.shootCd = 2 + Math.random() * 0.8;
        const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.12;
        g.arrowsFlying.push({ x: e.x, y: e.y, z: e.z + 0.9, dx: Math.cos(a), dy: Math.sin(a), life: 1.6, dmg: k.dmg, hostile: true });
        sfx.bow();
      }
      const want = d < 6 ? -1 : d > 10 ? 1 : 0;
      return { mx: nx * want * k.speed * dt, my: ny * want * k.speed * dt, reach: 0 };
    }
    const reach = e.kind === 5 ? 1.7 : e.kind === 7 ? 1.5 : 0.95;
    if (d < reach * 0.8) return { mx: 0, my: 0, reach };
    const sp = k.speed * (e.kind === 8 && d < 6 ? 1.25 : 1);
    return { mx: nx * sp * dt, my: ny * sp * dt, reach };
  }

  /** Raiders around a camp fire when you come close. */
  private spawnCamp(g: Game, s: Site) {
    let c = this.camps.get(s.key);
    if (!c) this.camps.set(s.key, (c = { spears: 0, alive: 0, spawned: false, cleared: false, chest: false, alarm: false }));
    if (c.cleared || c.spawned) return;
    const night = this.night(g) > 0.5;
    const kinds = [3, 4, 5, 6];
    const n = 3 + Math.floor(Math.random() * 3);
    const list: number[] = [];
    for (let i = 0; i < n; i++) list.push(kinds[(i + Math.floor(Math.random() * 4)) % 4]);
    if (s.big) list.push(7);
    list.forEach((kind, i) => {
      const a = (i / list.length) * Math.PI * 2 + 0.4;
      const r = kind === 7 ? 1.2 : 3.4;
      const x = s.x + 0.5 + Math.cos(a) * r, y = s.y + 0.5 + Math.sin(a) * r;
      g.enemies.push({
        id: g.nextId++, kind, x, y, z: g.world.heightAt(x, y), hp: ENEMY_KINDS[kind].hp, aggro: false, atkCd: 1, hurtT: 0, kx: 0, ky: 0,
        wanderA: NaN, wanderT: Math.random() * 3, hop: Math.random() * 6, camp: s.key, hx: x, hy: y, shield: raiderShield(kind) || undefined,
        sleep: night,
      });
    });
    c.spawned = true;
    c.alive = list.length;
    c.alarm = false;
  }

  /** Raiders that wandered off screen are gone: the camp fills up again next time. */
  despawned(e: Enemy) {
    if (e.camp === undefined) return;
    const c = this.camps.get(e.camp);
    if (c && !c.cleared) {
      c.spawned = false;
      c.alive = 0;
    }
  }

  // ---------- the world ----------

  /** 0 in the day, 1 in the middle of the night. */
  night(g: Game) {
    const t = (g.elapsed % DAY_LEN) / DAY_LEN; // 0 = morning
    if (t < 0.55) return 0;
    if (t < 0.62) return (t - 0.55) / 0.07;
    if (t < 0.9) return 1;
    if (t < 0.97) return 1 - (t - 0.9) / 0.07;
    return 0;
  }

  update(g: Game, dt: number) {
    const p = g.p;
    this.soup = Math.max(0, this.soup - dt);
    this.chili = Math.max(0, this.chili - dt);
    this.feast = Math.max(0, this.feast - dt);
    this.blockT = this.blocking ? this.blockT + dt : 0;
    for (const [k, v] of this.springCd) if (v - dt <= 0) this.springCd.delete(k); else this.springCd.set(k, v - dt);
    // rain storms now and then
    if (this.rainLeft > 0) {
      this.rainLeft -= dt;
      this.rain = Math.min(1, this.rain + dt * 0.3);
      if (this.rainLeft <= 0) g.toast('The rain stops.');
    } else {
      this.rain = Math.max(0, this.rain - dt * 0.3);
      this.rainCd -= dt;
      if (this.rainCd <= 0) {
        this.rainCd = 240 + Math.random() * 300;
        this.rainLeft = 60 + Math.random() * 90;
        g.toast('It starts to rain. Cliffs are slippery!');
        g.say('rain', 'Rain! Climbing will be harder until it stops.', 120);
      }
    }
    // places nearby
    this.siteCd -= dt;
    if (this.siteCd <= 0) {
      this.siteCd = 0.4;
      this.near = sitesNear(p.x, p.y, 60, g.world.seed);
      for (const s of this.near) {
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < 32 && !this.discovered.has(s.key)) {
          this.discovered.add(s.key);
          if (s.kind === S.Camp) g.say('camp', 'A raider camp! See the fire and the spears with apples? Sneak in, or fight!', 60);
          if (s.kind === S.Shrine) g.say('shrine', 'A shrine! Press E there to get a spirit orb.', 60);
          if (s.kind === S.Tower) g.say('tower', 'A watchtower! Climb to the top and press E to see what is around.', 90);
          if (s.kind === S.Spring) g.say('spring', 'A healing spring! Press E there to get all your hearts back.', 90);
        }
        if (s.kind === S.Camp && d < 46 && g.role !== 'guest') this.spawnCamp(g, s);
      }
    }
    if (g.role !== 'guest') {
      this.updateBurning(g, dt);
      this.updateWolves(g, dt);
    }
    this.updateBombs(g, dt);
    this.updateHorses(g, dt);
    this.updatePickups(g, dt);
  }

  private updateBurning(g: Game, dt: number) {
    this.burnT -= dt;
    if (this.burnT > 0) return;
    this.burnT = 0.5;
    for (const e of [...g.enemies]) {
      if (!e.burn) continue;
      e.burn = Math.max(0, e.burn - 0.5);
      g.puff(e.x, e.y, e.z + 0.6, Math.random() < 0.5 ? '#ff7a2a' : '#ffd34d', 4, 1.2);
      g.hurtEnemy(e, 2, 0, 0);
    }
  }

  private updateWolves(g: Game, dt: number) {
    const p = g.p;
    this.wolfCd -= dt * (this.night(g) > 0.5 ? 2 : 1);
    if (this.wolfCd > 0) return;
    this.wolfCd = 35 + Math.random() * 30;
    if (tG(g.world.tile(Math.floor(p.x), Math.floor(p.y))) !== G.Forest || villageAt(p.x, p.y) >= 0 || castleR(p.x, p.y) < 150) return;
    if (g.enemies.some((e) => e.kind === 8)) return;
    const a = Math.random() * Math.PI * 2;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const x = p.x + Math.cos(a) * 26 + (Math.random() - 0.5) * 3, y = p.y + Math.sin(a) * 26 + (Math.random() - 0.5) * 3;
      const v = g.world.tile(Math.floor(x), Math.floor(y));
      if (tG(v) === G.Water || blocksMove(v)) continue;
      g.enemies.push({
        id: g.nextId++, kind: 8, x, y, z: tH(v), hp: ENEMY_KINDS[8].hp, aggro: false, atkCd: 1, hurtT: 0, kx: 0, ky: 0,
        wanderA: Math.random() * 7, wanderT: 0, hop: Math.random() * 6,
      });
    }
  }

  private updateHorses(g: Game, dt: number) {
    const p = g.p;
    if (this.riding) {
      const h = this.riding;
      h.x = p.x;
      h.y = p.y;
      h.z = p.z;
      h.face = p.face;
      if (p.moving) h.walkT += dt;
    }
    this.horses = this.horses.filter((h) => h === this.riding || Math.hypot(h.x - p.x, h.y - p.y) < 90);
    this.horseCd -= dt;
    if (this.horseCd <= 0) {
      this.horseCd = 6;
      if (this.horses.length < 3) {
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 30;
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        const v = g.world.tile(Math.floor(x), Math.floor(y));
        if ((tG(v) === G.Grass || tG(v) === G.Dirt) && !blocksMove(v) && villageAt(x, y) < 0 && castleR(x, y) > 120)
          this.horses.push({ id: g.nextId++, x, y, z: tH(v), face: 0, walkT: 0, wanderA: 0, wanderT: 0, color: HORSE_COLS[Math.floor(Math.random() * HORSE_COLS.length)] });
      }
    }
    for (const h of this.horses) {
      if (h === this.riding) continue;
      h.wanderT -= dt;
      if (h.wanderT <= 0) {
        h.wanderT = 2 + Math.random() * 4;
        h.wanderA = Math.random() < 0.5 ? NaN : Math.random() * Math.PI * 2;
      }
      if (!Number.isNaN(h.wanderA)) {
        const nx = h.x + Math.cos(h.wanderA) * 1.2 * dt, ny = h.y + Math.sin(h.wanderA) * 1.2 * dt;
        const v = g.world.tile(Math.floor(nx), Math.floor(ny));
        if (!blocksMove(v) && tG(v) !== G.Water && Math.abs(tH(v) - h.z) <= 1) {
          h.x = nx;
          h.y = ny;
          h.face = h.wanderA;
          h.walkT += dt;
        } else h.wanderT = 0;
      }
      h.z += (g.world.heightAt(h.x, h.y) - h.z) * Math.min(1, dt * 10);
    }
  }

  dismount(g: Game, say = true) {
    if (!this.riding) return;
    const h = this.riding;
    this.riding = null;
    h.x = g.p.x + 0.8;
    h.y = g.p.y + 0.8;
    if (say) g.toast('You hop off the horse');
  }

  private updatePickups(g: Game, dt: number) {
    const p = g.p;
    this.pickCd -= dt;
    this.pickups = this.pickups.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 120);
    if (this.pickCd <= 0) {
      this.pickCd = 1.2;
      if (this.pickups.filter((q) => q.kind !== 'star').length < 14) {
        const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 45;
        const x = Math.floor(p.x + Math.cos(a) * d) + 0.5, y = Math.floor(p.y + Math.sin(a) * d) + 0.5;
        const v = g.world.tile(Math.floor(x), Math.floor(y));
        const gr = tG(v);
        if ((gr === G.Forest || (gr === G.Grass && Math.random() < 0.25)) && tT(v) === T.None)
          this.pickups.push({ x, y, fall: 0, kind: Math.random() < 0.62 ? 'red' : 'blue' });
      }
    }
    // falling stars at night
    if (this.night(g) > 0.6) {
      this.starCd -= dt;
      if (this.starCd <= 0) {
        this.starCd = 35 + Math.random() * 35;
        const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 18;
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (tG(g.world.tile(Math.floor(x), Math.floor(y))) !== G.Water) {
          this.pickups.push({ x, y, fall: 40, kind: 'star' });
          g.say('star', 'Look! A falling star! Go grab it!', 60);
        }
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const q = this.pickups[i];
      if (q.fall > 0) {
        q.fall = Math.max(0, q.fall - dt * 22);
        if (q.fall === 0) g.puff(q.x, q.y, g.world.heightAt(q.x, q.y), '#fff6b0', 18, 3);
        continue;
      }
      if (Math.hypot(q.x - p.x, q.y - p.y) < 0.9 && Math.abs(g.world.heightAt(q.x, q.y) - p.z) < 1.5) {
        this.pickups.splice(i, 1);
        sfx.eat();
        if (q.kind === 'star') {
          this.stars++;
          sfx.chest();
          g.toast('A star fragment! The trader pays 40 coins for it.');
        } else {
          if (q.kind === 'red') this.red++;
          else this.blue++;
          g.float(q.x, q.y, p.z, q.kind === 'red' ? '+1 red mushroom' : '+1 blue mushroom', q.kind === 'red' ? '#ff8a7a' : '#8ab8ff');
          g.say('mush', 'A mushroom! Cook it at a fire for a tasty meal.', 600);
        }
      }
    }
  }

  // ---------- bombs ----------

  throwBomb(g: Game) {
    const p = g.p;
    if (g.knockedOut || p.climbing) return;
    if (this.bombs <= 0) return g.toast('No bombs. The trader sells them.');
    this.bombs--;
    const a = p.face;
    this.bombsFlying.push({ x: p.x, y: p.y, z: p.z + 1.2, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, vz: 6, t: 0 });
    sfx.jump();
  }

  private updateBombs(g: Game, dt: number) {
    for (let i = this.bombsFlying.length - 1; i >= 0; i--) {
      const b = this.bombsFlying[i];
      b.t += dt;
      const gh = g.world.heightAt(b.x, b.y);
      if (b.z > gh + 0.05 || b.vz > 0) {
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
        if (g.world.heightAt(nx, ny) > b.z || blocksMove(g.world.tile(Math.floor(nx), Math.floor(ny)))) {
          b.vx *= -0.3;
          b.vy *= -0.3;
        } else {
          b.x = nx;
          b.y = ny;
        }
        b.vz -= 20 * dt;
        b.z = Math.max(g.world.heightAt(b.x, b.y), b.z + b.vz * dt);
      } else {
        b.vx *= 0.9;
        b.vy *= 0.9;
      }
      if (Math.random() < 0.5) g.puff(b.x, b.y, b.z + 0.4, '#ffd34d', 1, 0.5);
      if (b.t >= 1.7) {
        this.bombsFlying.splice(i, 1);
        this.explode(g, b.x, b.y, b.z);
      }
    }
  }

  private explode(g: Game, x: number, y: number, z: number) {
    sfx.beastBlast();
    g.shake = Math.max(g.shake, 12);
    g.puff(x, y, z, '#ff9a3a', 26, 5);
    g.puff(x, y, z, '#4a4458', 18, 3);
    const R = 2.8, dmg = 18;
    for (const e of [...g.enemies]) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > R || Math.abs(e.z - z) > 2.5) continue;
      if (g.role === 'guest') g.net?.hitEnemy(e.id, dmg, (e.x - x) / (d || 1), (e.y - y) / (d || 1));
      else {
        e.shield = 0;
        g.hurtEnemy(e, dmg, (e.x - x) / (d || 1), (e.y - y) / (d || 1));
      }
    }
    if (g.beastBodies().some((q) => Math.hypot(q.x - x, q.y - y) < R + q.r)) {
      if (g.role === 'guest') g.net?.hitBoss(dmg);
      else g.hurtBoss(dmg);
    }
    g.minis.arrowHit(g, x, y, dmg);
    if (Math.hypot(g.p.x - x, g.p.y - y) < 2.2) g.hurtPlayer(4, x, y);
    // ore rocks
    for (const s of this.near) {
      if (s.kind !== S.Ore) continue;
      ORE_ROCKS.forEach(([ox, oy], i) => {
        if (Math.hypot(s.x + ox + 0.5 - x, s.y + oy + 0.5 - y) < R) this.mineOre(g, s, i, 9);
      });
    }
  }

  // ---------- ore ----------

  /** Hit an ore rock. 4 hits (or a bomb) breaks it. */
  mineOre(g: Game, s: Site, i: number, hits = 1) {
    const k = `${s.key}:${i}`;
    if (this.mined.has(k)) return;
    const n = (this.oreHits.get(k) ?? 0) + hits;
    const [ox, oy] = ORE_ROCKS[i];
    const x = s.x + ox + 0.5, y = s.y + oy + 0.5, z = g.world.heightAt(x, y);
    g.puff(x, y, z + 0.6, '#9aa3ad', 6, 2);
    sfx.chop();
    if (n < 4) {
      this.oreHits.set(k, n);
      return;
    }
    this.oreHits.delete(k);
    this.mined.add(k);
    const gems = Math.random() < 0.5 ? 2 : 1;
    this.gems += gems;
    g.coins += 3;
    sfx.coin();
    g.puff(x, y, z + 0.6, '#7fe0ff', 16, 3);
    g.float(x, y, z + 1, `+${gems} gem${gems > 1 ? 's' : ''} · +3 coins`, '#7fe0ff');
  }

  /** Swinging a sword near ore rocks. */
  swingOre(g: Game, inArc: (x: number, y: number) => boolean): boolean {
    let hit = false;
    for (const s of this.near) {
      if (s.kind !== S.Ore) continue;
      ORE_ROCKS.forEach(([ox, oy], i) => {
        if (!this.mined.has(`${s.key}:${i}`) && inArc(s.x + ox + 0.5, s.y + oy + 0.5)) {
          this.mineOre(g, s, i);
          hit = true;
        }
      });
    }
    return hit;
  }

  // ---------- the hero ----------

  /** How much faster (or slower) you move right now. */
  speedMul(g: Game) {
    if (this.riding) return 2.3;
    let m = 1;
    if (this.sprint && g.p.stamina > 0.01 && g.p.moving && !g.p.inWater) m = 1.65;
    if (this.blocking && this.shield) m *= 0.5;
    if (this.gliding) m = 1.4;
    return m;
  }

  /** Stamina drain multiplier (rain on cliffs, energy soup, shrine upgrades). */
  drainMul(climbing: boolean) {
    let m = 1 / (1 + this.stamUp * 0.25);
    if (this.soup > 0) m *= 0.5;
    if (climbing && this.rain > 0.3) m *= 1.8;
    return m;
  }

  updatePlayer(g: Game, dt: number) {
    const p = g.p;
    if (p.onGround || p.climbing) this.gliding = false;
    if (this.gliding) {
      p.stamina -= 0.07 * dt * this.drainMul(false);
      p.staminaWait = 1;
      if (p.stamina <= 0) {
        p.stamina = 0;
        this.gliding = false;
        g.toast('Too tired to glide!');
      }
    }
    if (this.sprint && p.moving && p.onGround && !p.climbing && !p.inWater && !this.riding && p.stamina > 0) {
      p.stamina = Math.max(0, p.stamina - 0.2 * dt * this.drainMul(false));
      p.staminaWait = 0.8;
    }
    // cold in the snow
    const gr = tG(g.world.tile(Math.floor(p.x), Math.floor(p.y)));
    if (gr === G.Snow && !this.warm() && !g.knockedOut) {
      this.coldT += dt;
      g.say('cold', 'Brr, it is freezing! Wear a fur coat or hood, or eat warm chili.', 120);
      if (this.coldT > 6) {
        this.coldT = 0;
        g.float(p.x, p.y, p.z, '❄ cold', '#bfe3ff');
        g.hurtPlayer(1);
      }
    } else this.coldT = Math.max(0, this.coldT - dt);
  }

  get cold() {
    return this.coldT > 0.2;
  }

  // ---------- E ----------

  private campNear(g: Game, r: number) {
    const p = g.p;
    return this.near.find((s) => s.kind === S.Camp && Math.hypot(s.x + 0.5 - p.x, s.y + 0.5 - p.y) < r);
  }

  private fireNear(g: Game) {
    const p = g.p;
    if (g.fires.some((f) => Math.hypot(f.x + 0.5 - p.x, f.y + 0.5 - p.y) < 1.8)) return true;
    return !!this.campNear(g, 1.6);
  }

  private village(g: Game) {
    const vi = villageAt(g.p.x, g.p.y);
    return vi >= 0 ? { vi, v: VILLAGES[vi] } : null;
  }

  private near1(g: Game, x: number, y: number, r: number) {
    return Math.hypot(x + 0.5 - g.p.x, y + 0.5 - g.p.y) < r;
  }

  nearSomething(g: Game): string | null {
    const p = g.p;
    if (this.riding) return 'Get off the horse';
    const c = this.campNear(g, 8);
    if (c) {
      const st = this.camps.get(c.key);
      for (let i = 0; i < 4; i++) {
        const [ox, oy] = CAMP_SPEARS[i];
        if (!(st && st.spears & (1 << i)) && this.near1(g, c.x + ox, c.y + oy, 1.3)) return 'Take the spear (and its apple)';
      }
      if (st?.cleared && !st.chest && this.near1(g, c.x, c.y + 1, 1.4)) return 'Open the loot chest';
    }
    if (this.fireNear(g)) return 'Cook';
    for (const s of this.near) {
      if (s.kind === S.Shrine && this.near1(g, s.x, s.y, 2)) return this.found.has(s.key) ? 'Shrine' : 'Wake the shrine';
      if (s.kind === S.Tower && this.near1(g, s.x, s.y, 1.6) && p.z >= tH(g.world.tile(s.x, s.y)) - 0.5) return this.towers.has(s.key) ? null : 'Look out from the tower';
      if (s.kind === S.Spring && this.near1(g, s.x, s.y, 2.4)) return this.springCd.has(s.key) ? null : 'Drink from the healing spring';
    }
    if (!this.light && this.near1(g, GROVE.x, GROVE.y, 2)) return p.hp >= LIGHT_HEARTS ? 'Pull out the Sword of Light' : 'The Sword of Light (needs 10 full hearts)';
    const vv = this.village(g);
    if (vv) {
      if (this.near1(g, vv.v.x + SMITH.x, vv.v.y + SMITH.y, 2.2)) return 'Blacksmith';
      if (this.near1(g, vv.v.x + ELDER.x, vv.v.y + ELDER.y, 2.2)) return 'Talk to the elder';
    }
    for (const h of this.horses) if (Math.hypot(h.x - p.x, h.y - p.y) < 1.6) return 'Ride the horse';
    return null;
  }

  /** E: returns true if something here used it. */
  interact(g: Game): boolean {
    const p = g.p;
    if (this.riding) {
      this.dismount(g);
      return true;
    }
    const c = this.campNear(g, 8);
    if (c) {
      let st = this.camps.get(c.key);
      if (!st) this.camps.set(c.key, (st = { spears: 0, alive: 0, spawned: false, cleared: false, chest: false, alarm: false }));
      for (let i = 0; i < 4; i++) {
        const [ox, oy] = CAMP_SPEARS[i];
        if (!(st.spears & (1 << i)) && this.near1(g, c.x + ox, c.y + oy, 1.3)) {
          st.spears |= 1 << i;
          this.spears++;
          g.apples++;
          sfx.chest();
          g.float(p.x, p.y, p.z + 0.5, '+1 spear · +1 apple', '#e9c58a');
          if (this.spears === 1) g.toast('You got a spear! Press Shift to switch weapons.');
          for (const e of g.enemies) if (e.camp === c.key && !e.sleep && Math.hypot(e.x - p.x, e.y - p.y) < 10) this.alarm(g, e);
          return true;
        }
      }
      if (st.cleared && !st.chest && this.near1(g, c.x, c.y + 1, 1.4)) {
        st.chest = true;
        const coins = 40 + Math.floor(Math.random() * 40);
        g.coins += coins;
        g.arrows += 10;
        let extra = '';
        const left = ARMOR.filter((a) => !this.ownedArmor.includes(a.id));
        if (left.length && Math.random() < 0.6) {
          const a = left[Math.floor(Math.random() * left.length)];
          this.ownedArmor.push(a.id);
          extra = ` and a ${a.name}`;
        } else {
          this.bombs += 3;
          extra = ' and 3 bombs';
        }
        sfx.chest();
        g.puff(c.x + 0.5, c.y + 1.5, p.z, '#ffe27a', 20, 3);
        g.toast(`Loot! ${coins} coins, 10 arrows${extra}`);
        return true;
      }
    }
    if (this.fireNear(g)) {
      this.onCook?.();
      return true;
    }
    for (const s of this.near) {
      if (s.kind === S.Shrine && this.near1(g, s.x, s.y, 2)) {
        if (!this.found.has(s.key)) {
          this.found.add(s.key);
          this.orbs++;
          sfx.win();
          g.puff(s.x + 0.5, s.y + 0.5, p.z + 1, '#7fe0ff', 30, 3);
          g.toast(`The shrine wakes up! +1 spirit orb (${this.orbs}). You can fast travel here now.`);
          if (this.quest && QUESTS.find((q) => q.id === this.quest!.id)?.kind === 'shrine') this.quest.got++;
          if (this.orbs >= 4) g.say('orbs', 'You have 4 spirit orbs! Trade them at a shrine for a heart or more stamina.', 60);
        } else this.onShrine?.(s.key);
        return true;
      }
      if (s.kind === S.Tower && this.near1(g, s.x, s.y, 1.6) && p.z >= tH(g.world.tile(s.x, s.y)) - 0.5 && !this.towers.has(s.key)) {
        this.towers.add(s.key);
        let n = 0;
        for (const o of sitesNear(s.x, s.y, 900, g.world.seed)) {
          if (!this.discovered.has(o.key)) n++;
          this.discovered.add(o.key);
        }
        sfx.win();
        g.toast(`From up here you can see far! ${n} new places on your map (M).`);
        return true;
      }
      if (s.kind === S.Spring && this.near1(g, s.x, s.y, 2.4) && !this.springCd.has(s.key)) {
        this.springCd.set(s.key, 120);
        p.hp = g.maxHp;
        p.stamina = 1;
        sfx.chest();
        g.puff(p.x, p.y, p.z + 0.5, '#9fe8ff', 24, 2);
        g.toast('The spring heals you all the way!');
        return true;
      }
    }
    if (!this.light && this.near1(g, GROVE.x, GROVE.y, 2)) {
      if (p.hp < LIGHT_HEARTS) {
        g.toast(`It won't budge. You need 10 full hearts to pull it out (you have ${Math.floor(p.hp / 4)}).`);
        g.say('nolight', 'The Sword of Light needs a hero with ten full hearts.', 30);
        return true;
      }
      g.startWork('Pulling the Sword of Light', 3, () => {
        this.light = true;
        this.weapon = 'light';
        sfx.win();
        g.shake = 10;
        g.puff(GROVE.x + 0.5, GROVE.y + 0.5, p.z + 1, '#fff6b0', 40, 4);
        g.toast('You pulled out THE SWORD OF LIGHT! 30 damage, and double to bosses.');
        g.say('light', 'The Sword of Light is yours! Now go beat the Dark Beast!', 999);
      });
      return true;
    }
    const vv = this.village(g);
    if (vv) {
      if (this.near1(g, vv.v.x + SMITH.x, vv.v.y + SMITH.y, 2.2)) {
        this.onSmith?.(vv.vi);
        return true;
      }
      if (this.near1(g, vv.v.x + ELDER.x, vv.v.y + ELDER.y, 2.2)) {
        this.onElder?.(vv.vi);
        return true;
      }
    }
    for (const h of this.horses) {
      if (Math.hypot(h.x - p.x, h.y - p.y) < 1.6 && !p.climbing) {
        this.riding = h;
        p.x = h.x;
        p.y = h.y;
        sfx.jump();
        g.toast('Giddy up! You ride much faster. Press E to get off.');
        return true;
      }
    }
    return false;
  }

  // ---------- menus ----------

  have(need: Recipe['needs'], g: Game) {
    const bag: Record<string, number> = { apple: g.apples, acorn: g.acorns, red: this.red, blue: this.blue, meat: this.meat };
    return Object.entries(need).every(([k, n]) => bag[k] >= (n ?? 0));
  }

  cook(g: Game, id: string): string {
    const r = RECIPES.find((q) => q.id === id);
    if (!r) return '';
    if (!this.have(r.needs, g)) return 'You need more ingredients.';
    for (const [k, n] of Object.entries(r.needs)) {
      if (k === 'apple') g.apples -= n!;
      else if (k === 'acorn') g.acorns -= n!;
      else if (k === 'red') this.red -= n!;
      else if (k === 'blue') this.blue -= n!;
      else if (k === 'meat') this.meat -= n!;
    }
    const p = g.p;
    if (id === 'skewer') p.hp = Math.min(g.maxHp, p.hp + 12);
    if (id === 'roast') p.hp = Math.min(g.maxHp, p.hp + 16);
    if (id === 'soup') {
      p.stamina = 1;
      this.soup = 120;
    }
    if (id === 'chili') this.chili = 240;
    if (id === 'pie') {
      p.hp = Math.min(g.maxHp, p.hp + 12);
      p.stamina = 1;
    }
    if (id === 'feast') {
      p.hp = g.maxHp;
      this.feast = 90;
    }
    sfx.eat();
    return `You cooked ${r.icon} ${r.name} and ate it. ${r.desc}`;
  }

  /** Shrines: trade 4 spirit orbs for a heart container or more stamina. */
  spendOrbs(g: Game, what: 'heart' | 'stamina'): string {
    if (this.orbs < 4) return 'You need 4 spirit orbs.';
    if (what === 'heart') {
      if (g.maxHp >= MAX_HP_CAP) return 'You already have the most hearts (20).';
      this.orbs -= 4;
      g.maxHp = Math.min(MAX_HP_CAP, g.maxHp + 4);
      g.p.hp = g.maxHp;
      sfx.win();
      return `+1 heart! You have ${g.maxHp / 4} hearts now.`;
    }
    if (this.stamUp >= 6) return 'Your stamina is already as big as it gets.';
    this.orbs -= 4;
    this.stamUp++;
    sfx.win();
    return 'Your stamina lasts longer now!';
  }

  /** Shrines you can travel to. */
  shrineList(g: Game) {
    const out: { key: number; x: number; y: number }[] = [];
    for (const key of this.found) {
      const rx = Math.floor(key / 1000), ry = key % 1000;
      const s = siteIn(rx, ry, g.world.seed);
      if (s) out.push({ key, x: s.x, y: s.y });
    }
    return out.sort((a, b) => Math.hypot(a.x - g.p.x, a.y - g.p.y) - Math.hypot(b.x - g.p.x, b.y - g.p.y));
  }

  travel(g: Game, key: number) {
    const s = this.shrineList(g).find((q) => q.key === key);
    if (!s || inRoom(g.p.x, g.p.y)) return;
    this.dismount(g, false);
    g.teleport(s.x + 0.5, s.y + 2.5, 'the shrine');
  }

  buyArmor(g: Game, id: string): string {
    const a = armorById(id);
    if (!a) return '';
    if (this.ownedArmor.includes(id)) {
      this.armor[a.slot] = this.armor[a.slot] === id ? null : id;
      return this.armor[a.slot] ? `Wearing the ${a.name}.` : `Took off the ${a.name}.`;
    }
    if (g.coins < a.price) return 'Not enough coins.';
    g.coins -= a.price;
    this.ownedArmor.push(id);
    this.armor[a.slot] = id;
    sfx.coin();
    return `You bought the ${a.name} and put it on!`;
  }

  buyShield(g: Game, id: string): string {
    const s = SHIELDS.find((q) => q.id === id);
    if (!s || !s.price) return '';
    if (g.coins < s.price) return 'Not enough coins.';
    g.coins -= s.price;
    this.shield = { id, hp: s.hp };
    sfx.coin();
    return `New ${s.name}! Hold F (or 🛡) to block. Shields break when they take too many hits.`;
  }

  repairCost() {
    if (!this.shield) return 0;
    const max = shieldById(this.shield.id)?.hp ?? 30;
    return Math.ceil((max - this.shield.hp) / 6);
  }

  repair(g: Game): string {
    if (!this.shield) return 'You have no shield.';
    const c = this.repairCost();
    if (!c) return 'Your shield is like new.';
    if (g.coins < c) return 'Not enough coins.';
    g.coins -= c;
    this.shield.hp = shieldById(this.shield.id)?.hp ?? 30;
    sfx.chop();
    return 'Your shield is fixed!';
  }

  /** Elder quests: get one, then bring it back done. */
  questTalk(g: Game, vi: number): string {
    if (!this.quest) {
      const q = QUESTS[(this.questsDone + vi) % QUESTS.length];
      this.quest = { id: q.id, village: vi, got: 0 };
      return `"${q.text}" Come back to me when you're done.`;
    }
    const q = QUESTS.find((x) => x.id === this.quest!.id)!;
    if (this.quest.village !== vi) return `Your quest is from the elder in ${VILLAGES[this.quest.village]?.name ?? 'another village'}.`;
    let done = false;
    if (q.kind === 'mushrooms' && this.red + this.blue >= q.need) {
      let n = q.need;
      const r = Math.min(this.red, n);
      this.red -= r;
      n -= r;
      this.blue -= n;
      done = true;
    } else if (q.kind === 'meat' && this.meat >= q.need) {
      this.meat -= q.need;
      done = true;
    } else if ((q.kind === 'camp' || q.kind === 'raiders' || q.kind === 'shrine') && this.quest.got >= q.need) done = true;
    if (!done) {
      const have = q.kind === 'mushrooms' ? this.red + this.blue : q.kind === 'meat' ? this.meat : this.quest.got;
      return `"${q.text}" (${Math.min(have, q.need)} of ${q.need})`;
    }
    this.quest = null;
    this.questsDone++;
    g.coins += q.coins;
    sfx.chest();
    return `"Thank you, hero!" +${q.coins} coins.`;
  }

  // ---------- saving ----------

  toSave(): LongSave {
    return {
      weapon: this.weapon, spears: this.spears, light: this.light, shield: this.shield, armor: this.armor, ownedArmor: this.ownedArmor,
      bombs: this.bombs, fireArrows: this.fireArrows, arrowType: this.arrowType, glider: this.glider, red: this.red, blue: this.blue,
      meat: this.meat, stars: this.stars, gems: this.gems, orbs: this.orbs, stamUp: this.stamUp, found: [...this.found], towers: [...this.towers],
      discovered: [...this.discovered], camps: [...this.camps].map(([k, c]) => [k, { ...c, spawned: false, alive: 0, alarm: false }]),
      mined: [...this.mined], quest: this.quest, questsDone: this.questsDone,
    };
  }

  static fromSave(s: LongSave | undefined): Long {
    const l = new Long();
    if (!s) return l;
    Object.assign(l, {
      weapon: s.weapon, spears: s.spears, light: s.light, shield: s.shield, armor: s.armor, ownedArmor: s.ownedArmor, bombs: s.bombs,
      fireArrows: s.fireArrows, arrowType: s.arrowType, glider: s.glider, red: s.red, blue: s.blue, meat: s.meat, stars: s.stars, gems: s.gems,
      orbs: s.orbs, stamUp: s.stamUp, quest: s.quest, questsDone: s.questsDone,
    });
    l.found = new Set(s.found);
    l.towers = new Set(s.towers);
    l.discovered = new Set(s.discovered);
    l.camps = new Map(s.camps);
    l.mined = new Set(s.mined);
    if (!l.weapons().includes(l.weapon)) l.weapon = 'sword';
    return l;
  }
}

