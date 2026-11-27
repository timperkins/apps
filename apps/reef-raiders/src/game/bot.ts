import * as K from './constants';
import { fishLen, type World } from './world';
import type { Action } from '../net/protocol';
import { UPGRADES, upgradeCost, type UpgradeId } from './upgrades';

// Easy computer players. Each step they read the world like a player looking at the TV and
// answer with stick input plus button presses. They are slow on purpose: a little late to
// react, never perfect at the tug-of-war.

export interface BotOutput {
  x: number;
  y: number;
  hold: boolean;
  acts: Action[];
  buy?: UpgradeId;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Taps per second in a tug-of-war, and how often a tap lands as a Heave.
export const BOT_TAPS_PER_S = 4;
export const BOT_HEAVE_CHANCE = 0.12;
// How far below full speed easy bots move.
export const BOT_SPEED = 0.7;
export const BOT_CHASE_SPEED = 0.9;

export class Bot {
  private targetX = K.SCENE_W / 2;
  private targetY = K.SURF + 120;
  private retargetAt = 0;
  private tapAt = 0;
  private castAt = 0;
  private downSince = 0;
  private reeling = false;
  private prey: string | null = null;

  constructor(
    public id: string,
    private rand: () => number = Math.random,
  ) {}

  step(world: World): BotOutput {
    const b = world.boat(this.id);
    const out = b ? this.raider(world) : this.swimmer(world);
    // Now and then, spend coins on a random upgrade it can afford.
    const owner = b ?? world.get(this.id);
    if (owner && this.rand() < 0.004) {
      const role = b ? 'raider' : 'swimmer';
      const options = UPGRADES[role].filter((u) => owner.coins >= upgradeCost(owner.ups[u.id] ?? 0));
      if (options.length) out.buy = options[Math.floor(this.rand() * options.length)].id;
    }
    return out;
  }

  private raider(w: World): BotOutput {
    const b = w.boat(this.id)!;
    const out: BotOutput = { x: 0, y: 0, hold: false, acts: [] };
    const t = w.time;
    if (b.sunk) return out;
    if (w.peteHere && b.meat > 0 && this.rand() < 0.02) out.acts.push('sell');

    if (b.hook.state === 'ready') {
      this.reeling = false;
      if (t > this.retargetAt) {
        // Head for where most computer fish are, give or take.
        const fish = w.fish.filter((f) => f.alive && !f.player && !f.baby);
        const pick = fish.length ? fish[Math.floor(this.rand() * fish.length)].x : K.SCENE_W / 2;
        this.targetX = clamp(pick - b.dir * K.ROD_DX + (this.rand() - 0.5) * 60, K.BOAT_MIN_X, K.BOAT_MAX_X);
        this.retargetAt = t + 6 + this.rand() * 4;
        this.castAt = 0;
      }
      const dx = this.targetX - b.x;
      if (Math.abs(dx) > 10) out.x = clamp(dx / 60, -1, 1) * BOT_SPEED;
      else {
        if (!this.castAt) this.castAt = t + 0.6 + this.rand() * 0.8;
        if (t > this.castAt) {
          out.acts.push('cast');
          this.downSince = t;
          this.castAt = 0;
        }
      }
      return out;
    }

    if (b.hook.state === 'down') {
      // Give up on a quiet spot after a while and reel in to try somewhere else.
      if (!this.reeling && t - this.downSince > 9 + this.rand() * 4) {
        this.reeling = true;
        this.retargetAt = 0;
      }
      out.hold = this.reeling;
      return out;
    }

    // Tug-of-war.
    if (t > this.tapAt) {
      this.tapAt = t + (1 / BOT_TAPS_PER_S) * (0.7 + this.rand() * 0.6);
      out.acts.push(this.rand() < BOT_HEAVE_CHANCE ? 'heave' : 'tap');
    }
    return out;
  }

  private swimmer(w: World): BotOutput {
    const out: BotOutput = { x: 0, y: 0, hold: false, acts: [] };
    const f = w.get(this.id);
    const t = w.time;
    if (!f || !f.alive) return out;

    if (f.hookedBy) {
      if (t > this.tapAt) {
        this.tapAt = t + (1 / BOT_TAPS_PER_S) * (0.7 + this.rand() * 0.6);
        out.acts.push('pull');
      }
      if (this.rand() < 0.01) out.acts.push('thrash');
      return out;
    }

    const len = fishLen(f);
    let tx = this.targetX;
    let ty = this.targetY;
    let flee = false;

    // Run from anything that could eat us, and from hooks.
    for (const o of w.fish) {
      if (o === f || !o.alive || o.hookedBy || (o.player && !w.schoolEats)) continue;
      if (fishLen(o) >= len * K.EAT_RATIO && Math.hypot(o.x - f.x, o.y - f.y) < 60) {
        tx = f.x - (o.x - f.x) * 2;
        ty = f.y - (o.y - f.y) * 2;
        flee = true;
      }
    }
    for (const b of w.boats) {
      if (b.hook.state === 'down' && Math.hypot(b.hook.x - f.x, b.hook.y - f.y) < 40) {
        tx = f.x - (b.hook.x - f.x) * 2;
        ty = f.y + 20;
        flee = true;
      }
    }

    if (!flee) {
      if (t > this.retargetAt) {
        this.retargetAt = t + 1.2 + this.rand();
        // Chase the nearest fish we can eat; once big enough, sometimes go ram a boat.
        let best = Infinity;
        this.prey = null;
        this.targetX = 40 + this.rand() * (K.SCENE_W - 80);
        this.targetY = K.SURF + 30 + this.rand() * (K.SEABED - K.SURF - 60);
        const afloat = w.boats.filter((b) => !b.sunk);
        if (f.level >= 3 && afloat.length && this.rand() < 0.35) {
          const b = afloat[Math.floor(this.rand() * afloat.length)];
          this.targetX = b.x;
          this.targetY = K.SURF + 4;
          this.retargetAt = t + 3;
        } else {
          for (const o of w.fish) {
            if (o === f || !o.alive || o.hookedBy || o.baby || (o.player && !w.schoolEats) || len < fishLen(o) * K.EAT_RATIO) continue;
            const d = Math.hypot(o.x - f.x, o.y - f.y);
            if (d < best && d < 200) {
              best = d;
              this.prey = o.id;
            }
          }
        }
      }
      const prey = this.prey ? w.get(this.prey) : undefined;
      if (prey?.alive && !prey.hookedBy) {
        tx = prey.x;
        ty = prey.y;
      } else {
        this.prey = null;
        tx = this.targetX;
        ty = this.targetY;
      }
    }

    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const speed = this.prey || flee ? BOT_CHASE_SPEED : BOT_SPEED;
      out.x = (dx / d) * speed;
      out.y = (dy / d) * speed;
    }
    if (flee && f.dashReadyAt <= t && this.rand() < 0.05) out.acts.push('dash');
    if (f.eggReadyAt <= t && f.level >= 2 && this.rand() < 0.003) out.acts.push('egg');
    if (f.kind === 'clown' && f.tauntReadyAt <= t && this.rand() < 0.004) out.acts.push('taunt');
    return out;
  }
}
