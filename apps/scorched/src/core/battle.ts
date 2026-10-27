import type { WindChange } from './config';
import {
  CHUTE_FALL_SPEED,
  CHUTE_HALF_W,
  CHUTE_STEER_SPEED,
  CHUTE_TOP,
  COINS_PER_DAMAGE,
  DRAW_VOTE_AFTER,
  FALL_DAMAGE_PER_PX,
  KILL_BONUS,
  MAX_FLIGHT_TIME,
  MAX_HEALTH,
  MAX_CLIMB,
  MAX_POWER,
  MOVE_DISTANCE,
  MOVE_TIME,
  PLANE_CRASH_DAMAGE,
  PLANE_CROSS_TIME,
  PLANE_HALF_W,
  PLANE_REWARD_MAX,
  PLANE_REWARD_MIN,
  RELOAD_TIME,
  REPAIR_AMOUNT,
  SAFE_FALL,
  SCORE_PER_KILL,
  SHIELD_STRENGTH,
  STEP,
  TANK_H,
  TANK_HALF_W,
  TORPEDO_DRIFT,
  TORPEDO_MAX_SPEED,
  TORPEDO_THRUST,
  TUMBLE_SPIN,
  WIND_ACCEL,
  WIND_SHIFT_INTERVAL,
  WORLD_H,
  WORLD_W,
} from './constants';
import { launchVelocity, muzzle, stepBody, tankAt, wrapDx, wrapX, type Hit, type PhysicsEnv } from './physics';
import type { Player } from './player';
import { Rng } from './rng';
import { Terrain, type ConcreteTerrain } from './terrain';
import { WEAPONS, WEAPON_ORDER, ammo, type WeaponId } from './weapons';

export interface Tank {
  id: number;
  player: number;
  /** Center of the treads. */
  x: number;
  /** Row just below the treads (where the ground should be). */
  y: number;
  health: number;
  /** Extra health points counted toward the power cap, added by a Power Cell. */
  powerBoost: number;
  alive: boolean;
  angle: number;
  power: number;
  shield: number;
  weapon: WeaponId;
  /** Row the tank started falling from, or null when resting. */
  fallStartY: number | null;
  parachute: boolean;
  lastHitBy: number | null;
  shots: number;
  /** Seconds until this tank can fire, repair or move again. */
  reload: number;
  /** Length of the current reload, for drawing its progress. */
  reloadTotal: number;
  /** Pixels still to drive, and which way (-1 left, 1 right). */
  moveLeft: number;
  moveDir: -1 | 1;
  /** Fraction of a pixel driven but not yet stepped. */
  moveCarry: number;
  /**
   * A Torpedo in progress: 'launch' while the tank rockets up, 'chute' while it drifts down
   * under a parachute, 'tumble' once that parachute is shot away. Null on the ground.
   */
  flight: Flight | null;
  /** Velocity while in flight, px/s. */
  vx: number;
  vy: number;
  /** How far the tank has turned over while tumbling, in radians; only for drawing. */
  spin: number;
  /** Which way it tumbles: the way it was fired. */
  spinDir: -1 | 1;
  /** Steering held on the controller while parachuting. */
  steer: -1 | 0 | 1;
}

export type Flight = 'launch' | 'chute' | 'tumble';

/** A plane flying across the sky. Shot down, it falls and explodes where it lands. */
export interface Plane {
  id: number;
  /** Center of the plane. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: -1 | 1;
  /** False once it has been shot down and is falling. */
  flying: boolean;
  /** Player who shot it down, credited for the crash. */
  shotBy: number | null;
  /** Smoke behind a falling plane, as flat [x, y, x, y, ...], oldest first. */
  trail: number[];
}

export type ProjectileKind = 'shell' | 'warhead' | 'bomblet' | 'hop';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: WeaponId;
  owner: number;
  kind: ProjectileKind;
  age: number;
  hopsLeft: number;
  rolling: boolean;
  rollDir: number;
  rollDist: number;
  digging: boolean;
  digLeft: number;
  /** Recent positions as flat [x, y, x, y, ...], oldest first. */
  trail: number[];
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  dirt: boolean;
}

export interface Fire {
  x: number;
  y: number;
  life: number;
  owner: number;
  tick: number;
}

export type BattleEvent =
  | { type: 'fire'; tank: number; weapon: WeaponId }
  | { type: 'explosion'; x: number; y: number; radius: number; dirt: boolean }
  | { type: 'damage'; tank: number; amount: number }
  | { type: 'destroyed'; tank: number; killer: number | null }
  | { type: 'parachute'; tank: number }
  | { type: 'repair'; tank: number }
  | { type: 'move'; tank: number; dir: -1 | 1 }
  | { type: 'powerCell'; tank: number }
  | { type: 'planeDown'; plane: number; by: number | null; reward: number; x: number; y: number }
  | { type: 'chuteCut'; tank: number; by: number | null }
  | { type: 'drawVote'; open: boolean }
  | { type: 'wind'; wind: number }
  | { type: 'roundOver'; winner: number | null };

export type Phase = 'playing' | 'over';

export interface BattleOptions {
  terrain: ConcreteTerrain;
  gravity: number;
  windMax: number;
  windChange: WindChange;
  /** Average seconds between planes; 0 or missing means no planes. */
  planeInterval?: number;
  seed: number;
}

const MIRV_WARHEADS = 5;
const FUNKY_BOMBLETS = 6;
const LEAPFROG_HOPS = 3;
const NAPALM_FLAMES = 28;
const DIG_LENGTH = 70;
const ROLL_LIMIT = 400;
const TANK_DEATH_RADIUS = 22;
const TANK_DEATH_DAMAGE = 35;
const TRAIL_LEN = 14;
/** Planes, and tanks whose parachute is shot away, fall with this share of normal gravity, so the crash is easy to follow. */
const PLANE_FALL_GRAVITY = 0.6;
/** Speed (px/s) a Torpedo leaves the ground at, before its thrust builds. */
const TORPEDO_START_SPEED = 60;
/** A rocketing tank's treads stop at this row, so its parachute opens just inside the top of the screen. */
const TORPEDO_PEAK = CHUTE_TOP + 4;

export class Battle {
  readonly rng: Rng;
  readonly terrain: Terrain;
  readonly tanks: Tank[] = [];
  readonly projectiles: Projectile[] = [];
  readonly explosions: Explosion[] = [];
  readonly fires: Fire[] = [];
  readonly planes: Plane[] = [];
  /** Things that happened since the UI last drained them (sound, text, AI). */
  events: BattleEvent[] = [];
  phase: Phase = 'playing';
  wind = 0;
  time = 0;
  winner: number | null = null;
  /** Seconds since any tank last took damage; a draw vote opens once this passes DRAW_VOTE_AFTER. */
  sinceHit = 0;
  /** Players who have agreed to a draw while the vote is open. */
  readonly drawVotes = new Set<number>();
  /** Everyone agreed: nobody may fire, and the round ends in a draw once the field is quiet. */
  drawAgreed = false;

  private burn = new Map<number, number>();
  private windTimer = 0;
  private drawWasOpen = false;
  /** Planes roll their own dice so turning them on doesn't change the rest of the round. */
  private readonly planeRng: Rng;
  private planeTimer = 0;
  private nextPlaneId = 0;

  constructor(
    readonly players: Player[],
    readonly opts: BattleOptions,
  ) {
    this.rng = new Rng(opts.seed);
    this.terrain = Terrain.generate(opts.terrain, this.rng, WORLD_W, WORLD_H);
    this.placeTanks();
    this.wind = this.rollWind();
    this.planeRng = new Rng(opts.seed ^ 0x5eed91a7);
    this.planeTimer = (opts.planeInterval ?? 0) * this.planeRng.range(0.3, 1);
  }

  get env(): PhysicsEnv {
    return {
      width: WORLD_W,
      gravity: this.opts.gravity,
      windAccel: this.wind * WIND_ACCEL,
    };
  }

  tankOf(player: number): Tank | undefined {
    return this.tanks.find((t) => t.player === player);
  }

  aliveTanks(): Tank[] {
    return this.tanks.filter((t) => t.alive);
  }

  /** Power is capped by remaining health, like the original, unless a Power Cell topped it up. */
  maxPower(t: Tank): number {
    const level = Math.min(MAX_HEALTH, t.health + t.powerBoost);
    return Math.max(100, Math.round((level / MAX_HEALTH) * MAX_POWER));
  }

  // ---- Actions, for any tank at any time ---------------------------------------

  /** Whether the tank can shoot, repair or move right now. */
  canFire(id: number): boolean {
    const t = this.tanks[id];
    return (
      this.phase === 'playing' &&
      !!t?.alive &&
      t.reload <= 0 &&
      t.moveLeft <= 0 &&
      t.flight === null &&
      this.aliveCount() > 1 &&
      !this.drawAgreed
    );
  }

  private controllable(id: number): Tank | null {
    const t = this.tanks[id];
    return this.phase === 'playing' && t?.alive ? t : null;
  }

  setAngle(id: number, angle: number): void {
    const t = this.controllable(id);
    if (t) t.angle = Math.max(0, Math.min(180, angle));
  }

  setPower(id: number, power: number): void {
    const t = this.controllable(id);
    if (t) t.power = Math.max(0, Math.min(this.maxPower(t), Math.round(power)));
  }

  selectWeapon(id: number, weapon: WeaponId): void {
    const t = this.controllable(id);
    if (t && ammo(this.players[t.player].inventory, weapon) > 0) t.weapon = weapon;
  }

  cycleWeapon(id: number, dir: 1 | -1): void {
    const t = this.tanks[id];
    if (!t) return;
    const owned = this.ownedWeapons(t.player);
    const i = owned.indexOf(t.weapon);
    this.selectWeapon(id, owned[(i + dir + owned.length) % owned.length]);
  }

  ownedWeapons(player: number): WeaponId[] {
    const inv = this.players[player].inventory;
    return WEAPON_ORDER.filter((id) => ammo(inv, id) > 0);
  }

  fire(id: number): boolean {
    if (!this.canFire(id)) return false;
    const t = this.tanks[id];
    const inv = this.players[t.player].inventory;
    if (ammo(inv, t.weapon) <= 0) t.weapon = 'babyMissile';
    if (t.weapon !== 'babyMissile') inv[t.weapon]--;
    if (WEAPONS[t.weapon].behavior === 'torpedo') {
      this.launch(t);
    } else {
      const m = muzzle(t.x, t.y, t.angle);
      const v = launchVelocity(t.angle, t.power);
      this.projectiles.push(this.newProjectile(m.x, m.y, v.vx, v.vy, t.weapon, t.player, 'shell'));
    }
    t.shots++;
    this.startReload(t, RELOAD_TIME);
    this.events.push({ type: 'fire', tank: id, weapon: t.weapon });
    if (ammo(inv, t.weapon) <= 0) t.weapon = 'babyMissile';
    return true;
  }

  /** Heals the tank. Uses up the reload like a shot. */
  useRepair(id: number): boolean {
    if (!this.canFire(id)) return false;
    const t = this.tanks[id];
    const inv = this.players[t.player].inventory;
    if (inv.repairKit <= 0 || t.health >= MAX_HEALTH) return false;
    inv.repairKit--;
    t.health = Math.min(MAX_HEALTH, t.health + REPAIR_AMOUNT);
    this.startReload(t, RELOAD_TIME);
    this.events.push({ type: 'repair', tank: id });
    return true;
  }

  /**
   * Starts driving the tank MOVE_DISTANCE pixels left or right over MOVE_TIME seconds. Uses up
   * the tank's turn: it can't fire, repair or move again until the drive is over. Refused, with
   * the turn kept, when the way is already blocked by a steep hill or another tank. Driving off
   * one side of the map comes back on the other.
   */
  move(id: number, dir: -1 | 1): boolean {
    if (!this.canFire(id)) return false;
    const t = this.tanks[id];
    if (t.fallStartY !== null || this.climbTo(t, t.x + dir) === null) return false;
    t.moveLeft = MOVE_DISTANCE;
    t.moveDir = dir;
    t.moveCarry = 0;
    this.startReload(t, MOVE_TIME);
    this.events.push({ type: 'move', tank: id, dir });
    return true;
  }

  /** Holds the steering on a parachuting tank: -1 drifts left, 1 right, 0 straight down. */
  steer(id: number, dir: -1 | 0 | 1): boolean {
    const t = this.controllable(id);
    if (!t || t.flight !== 'chute') return false;
    t.steer = dir;
    return true;
  }

  /** Refills the power cap to max without healing. Free: no reload. */
  usePowerCell(id: number): boolean {
    const t = this.controllable(id);
    if (!t) return false;
    const inv = this.players[t.player].inventory;
    if (inv.powerCell <= 0 || this.maxPower(t) >= MAX_POWER) return false;
    inv.powerCell--;
    t.powerBoost = MAX_HEALTH - t.health;
    t.power = MAX_POWER;
    this.events.push({ type: 'powerCell', tank: id });
    return true;
  }

  // ---- Draw vote -----------------------------------------------------------------

  /** True once nobody has been hit for a while; living players may then agree to a draw. */
  get drawOpen(): boolean {
    return this.phase === 'playing' && this.sinceHit >= DRAW_VOTE_AFTER;
  }

  /** Records or withdraws a player's vote for a draw. Ignored unless the vote is open. */
  voteDraw(id: number, agree: boolean): boolean {
    const t = this.controllable(id);
    if (!t || !this.drawOpen) return false;
    if (agree) this.drawVotes.add(t.player);
    else this.drawVotes.delete(t.player);
    return true;
  }

  /** Living human tanks, and how many of them have voted for a draw. CPUs always agree. */
  drawTally(): { votes: number; needed: number } {
    const humans = this.aliveTanks().filter((t) => this.players[t.player].kind === 'human');
    return { votes: humans.filter((t) => this.drawVotes.has(t.player)).length, needed: humans.length };
  }

  // ---- Simulation ---------------------------------------------------------------

  update(dt = STEP): void {
    if (this.phase === 'over') return;
    this.time += dt;
    this.sinceHit += dt;
    for (const t of this.tanks) if (t.reload > 0) t.reload = Math.max(0, t.reload - dt);
    this.updateWind(dt);
    this.updateProjectiles(dt);
    this.updatePlanes(dt);
    this.updateFires(dt);
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.age += dt;
      if (e.age >= e.duration) this.explosions.splice(i, 1);
    }
    this.terrain.settleStep();
    this.terrain.settleStep();
    this.updateMoves(dt);
    this.updateFlights(dt);
    this.updateTanks();
    this.resolveDeaths();
    this.updateDrawVote();

    if (this.aliveCount() <= 1 && this.isQuiet()) this.finish();
  }

  aliveCount(): number {
    let n = 0;
    for (const t of this.tanks) if (t.alive) n++;
    return n;
  }

  /** Nothing is moving or burning. */
  isQuiet(): boolean {
    return (
      this.projectiles.length === 0 &&
      this.fires.length === 0 &&
      this.explosions.length === 0 &&
      !this.planes.some((p) => !p.flying) &&
      this.terrain.settled &&
      !this.tanks.some((t) => t.alive && (t.fallStartY !== null || t.flight !== null))
    );
  }

  /**
   * Flies a Baby-Missile-style shot without changing anything and reports where it lands.
   * Used by the computer players to aim.
   */
  traceShot(
    tank: Tank,
    angle: number,
    power: number,
    useWind: boolean,
  ): { x: number; y: number; tank: number; lost: boolean } {
    const m = muzzle(tank.x, tank.y, angle);
    const v = launchVelocity(angle, power);
    const body = { x: m.x, y: m.y, vx: v.vx, vy: v.vy };
    const env = this.env;
    if (!useWind) env.windAccel = 0;
    const steps = MAX_FLIGHT_TIME / STEP;
    for (let i = 0; i < steps; i++) {
      const hit = stepBody(body, STEP, env, this.terrain, this.tanks);
      if (!hit) continue;
      return { x: hit.x, y: hit.y, tank: hit.kind === 'tank' ? hit.tank : -1, lost: false };
    }
    return { x: body.x, y: body.y, tank: -1, lost: true };
  }

  // ---- Internals ----------------------------------------------------------------

  private placeTanks(): void {
    const n = this.players.length;
    const margin = 28;
    const slot = (WORLD_W - margin * 2) / n;
    const slots = this.rng.shuffle(this.players.map((p) => p.index));
    slots.forEach((player, i) => {
      const x = Math.round(margin + slot * (i + 0.5) + this.rng.range(-0.22, 0.22) * slot);
      const y = this.terrain.surfaceY(x);
      this.terrain.flatten(x - TANK_HALF_W - 2, x + TANK_HALF_W + 2, y);
      const inv = this.players[player].inventory;
      let shield = 0;
      if (inv.shield > 0) {
        inv.shield--;
        shield = SHIELD_STRENGTH;
      }
      this.tanks.push({
        id: this.tanks.length,
        player,
        x,
        y,
        health: MAX_HEALTH,
        powerBoost: 0,
        alive: true,
        angle: x < WORLD_W / 2 ? 60 : 120,
        power: 450,
        shield,
        weapon: 'babyMissile',
        fallStartY: null,
        parachute: false,
        lastHitBy: null,
        shots: 0,
        reload: 0,
        reloadTotal: RELOAD_TIME,
        moveLeft: 0,
        moveDir: 1,
        moveCarry: 0,
        flight: null,
        vx: 0,
        vy: 0,
        spin: 0,
        spinDir: 1,
        steer: 0,
      });
    });
  }

  private rollWind(): number {
    const max = this.opts.windMax;
    return max === 0 ? 0 : Math.round(this.rng.range(-max, max));
  }

  private newProjectile(
    x: number, y: number, vx: number, vy: number,
    weapon: WeaponId, owner: number, kind: ProjectileKind,
  ): Projectile {
    return {
      x, y, vx, vy, weapon, owner, kind, age: 0,
      hopsLeft: weapon === 'leapfrog' ? LEAPFROG_HOPS - 1 : 0,
      rolling: false, rollDir: 0, rollDist: 0,
      digging: false, digLeft: 0,
      trail: [],
    };
  }

  private updateProjectiles(dt: number): void {
    const env = this.env;
    // New projectiles spawned during this loop are pushed onto the end and wait until next step.
    const count = this.projectiles.length;
    const remove = new Set<Projectile>();
    for (let i = 0; i < count; i++) {
      const p = this.projectiles[i];
      p.age += dt;
      if (p.rolling) {
        if (this.rollStep(p)) remove.add(p);
        continue;
      }
      if (p.digging) {
        if (this.digStep(p)) remove.add(p);
        continue;
      }
      const prevVy = p.vy;
      const hit = stepBody(p, dt, env, this.terrain, this.tanks, this.planes);
      p.trail.push(p.x, p.y);
      if (p.trail.length > TRAIL_LEN * 2) p.trail.splice(0, 2);

      if (!hit && p.weapon === 'mirv' && p.kind === 'shell' && prevVy < 0 && p.vy >= 0) {
        this.splitMirv(p);
        remove.add(p);
        continue;
      }
      if (hit && this.impact(p, hit)) remove.add(p);
      else if (p.age > MAX_FLIGHT_TIME || p.y > WORLD_H + 50) remove.add(p);
    }
    if (remove.size) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        if (remove.has(this.projectiles[i])) this.projectiles.splice(i, 1);
      }
    }
  }

  /** Handles a collision. Returns true if the projectile is used up. */
  private impact(p: Projectile, hit: Hit): boolean {
    const def = WEAPONS[p.weapon];
    const { x, y } = hit;

    if (hit.kind === 'plane' || hit.kind === 'chute') {
      // Any weapon brings a plane or a parachute down; the shell goes off where it struck.
      if (hit.kind === 'plane') this.shootDown(this.planes[hit.plane], p.owner);
      else this.cutChute(this.tanks[hit.tank], p.owner);
      const bomblet = p.kind === 'bomblet';
      this.detonate(x, y, bomblet ? 14 : Math.max(6, def.radius), bomblet ? 35 : def.damage, p.owner);
      return true;
    }

    if (p.kind === 'bomblet') {
      this.detonate(x, y, 14, 35, p.owner);
      return true;
    }

    switch (def.behavior) {
      case 'dirt':
        this.detonate(x, y, def.radius, 0, p.owner, true);
        return true;
      case 'leapfrog': {
        const hop = LEAPFROG_HOPS - 1 - p.hopsLeft;
        this.detonate(x, y, def.radius - hop * 2, def.damage - hop * 5, p.owner);
        if (p.hopsLeft > 0) {
          const dir = Math.sign(p.vx) || 1;
          const next = this.newProjectile(
            x, y - 2,
            dir * Math.max(60, Math.abs(p.vx) * 0.75),
            -Math.max(150, Math.abs(p.vy) * 0.55),
            p.weapon, p.owner, 'hop',
          );
          next.hopsLeft = p.hopsLeft - 1;
          this.projectiles.push(next);
        }
        return true;
      }
      case 'funky':
        this.detonate(x, y, def.radius, def.damage, p.owner);
        for (let i = 0; i < FUNKY_BOMBLETS; i++) {
          this.projectiles.push(
            this.newProjectile(
              x, y - def.radius * 0.5,
              this.rng.range(-170, 170), -this.rng.range(140, 320),
              p.weapon, p.owner, 'bomblet',
            ),
          );
        }
        return true;
      case 'roller':
        if (hit.kind === 'tank') {
          this.detonate(x, y, def.radius, def.damage, p.owner);
          return true;
        }
        p.rolling = true;
        p.rollDir = Math.sign(p.vx);
        p.y = this.terrain.surfaceY(p.x) - 1;
        p.trail.length = 0;
        return false;
      case 'digger':
        if (hit.kind === 'tank') {
          this.detonate(x, y, 6, 0, p.owner, false);
          return true;
        }
        p.digging = true;
        p.digLeft = DIG_LENGTH;
        {
          const len = Math.hypot(p.vx, p.vy) || 1;
          p.vx /= len;
          p.vy /= len;
        }
        p.trail.length = 0;
        return false;
      case 'napalm':
        this.detonate(x, y, def.radius, def.damage, p.owner);
        for (let i = 0; i < NAPALM_FLAMES; i++) {
          const fx = wrapX(Math.round(x + this.rng.range(-10, 10)));
          this.fires.push({
            x: fx,
            y: this.terrain.surfaceY(fx) - 1,
            life: this.rng.range(2.5, 4),
            owner: p.owner,
            tick: this.rng.int(0, 2),
          });
        }
        return true;
      default:
        // blast and MIRV warheads
        this.detonate(x, y, def.radius, def.damage, p.owner);
        return true;
    }
  }

  private splitMirv(p: Projectile): void {
    const spread = 45;
    for (let i = 0; i < MIRV_WARHEADS; i++) {
      const off = (i - (MIRV_WARHEADS - 1) / 2) * spread;
      const w = this.newProjectile(p.x, p.y, p.vx + off, p.vy, p.weapon, p.owner, 'warhead');
      this.projectiles.push(w);
    }
  }

  /** Moves a roller along the ground. Returns true once it has exploded. */
  private rollStep(p: Projectile): boolean {
    const def = WEAPONS[p.weapon];
    for (let k = 0; k < 2; k++) {
      if (p.rollDir === 0) {
        const left = this.terrain.surfaceY(p.x - 3);
        const right = this.terrain.surfaceY(p.x + 3);
        p.rollDir = left > right ? -1 : 1;
      }
      const nx = wrapX(p.x + p.rollDir);
      const ny = this.terrain.surfaceY(nx) - 1;
      const hitTank = tankAt(this.tanks, nx, ny - 2) >= 0;
      if (hitTank || ny < p.y - 2 || p.rollDist > ROLL_LIMIT) {
        this.detonate(p.x, p.y, def.radius, def.damage, p.owner);
        return true;
      }
      p.x = nx;
      p.y = ny;
      p.rollDist++;
    }
    return false;
  }

  /** Tunnels a digger forward. Returns true when finished. */
  private digStep(p: Projectile): boolean {
    for (let k = 0; k < 2; k++) {
      p.x = wrapX(p.x + p.vx);
      p.y += p.vy;
      p.digLeft--;
      this.terrain.carve(p.x, p.y, WEAPONS.digger.radius);
      if (p.digLeft <= 0 || p.y >= WORLD_H) {
        this.explosions.push({ x: p.x, y: p.y, radius: 6, age: 0, duration: 0.3, dirt: true });
        return true;
      }
    }
    return false;
  }

  private updateFires(dt: number): void {
    if (this.fires.length === 0) return;
    const near = new Map<number, number>();
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.fires.splice(i, 1);
        continue;
      }
      f.tick++;
      if (f.tick % 3 === 0) {
        const here = this.terrain.surfaceY(f.x);
        const l = this.terrain.surfaceY(f.x - 1);
        const r = this.terrain.surfaceY(f.x + 1);
        if (l > here && l >= r) f.x = wrapX(f.x - 1);
        else if (r > here) f.x = wrapX(f.x + 1);
        f.y = this.terrain.surfaceY(f.x) - 1;
      }
      for (const t of this.tanks) {
        if (!t.alive) continue;
        if (Math.abs(wrapDx(t.x, f.x)) <= TANK_HALF_W + 2 && Math.abs(t.y - 1 - f.y) <= 8) {
          near.set(t.id, (near.get(t.id) ?? 0) + 1);
          // Remember who burned whom for kill credit.
          t.lastHitBy = f.owner;
        }
      }
    }
    for (const [id, count] of near) {
      const t = this.tanks[id];
      const dealt = this.damageTank(t, 0.05 * Math.min(count, 10), t.lastHitBy);
      this.burn.set(id, (this.burn.get(id) ?? 0) + dealt);
    }
    if (this.fires.length === 0) {
      for (const [id, amount] of this.burn) {
        if (amount >= 0.5) this.events.push({ type: 'damage', tank: id, amount: Math.round(amount) });
      }
      this.burn.clear();
    }
  }

  private updateTanks(): void {
    const inv = (t: Tank) => this.players[t.player].inventory;
    for (const t of this.tanks) {
      if (!t.alive || t.flight !== null) continue;
      const speed = t.parachute ? 0.5 : 1.5;
      let moved = 0;
      while (moved < speed && !this.supported(t)) {
        if (t.fallStartY === null) t.fallStartY = t.y;
        const fallen = t.y - t.fallStartY;
        if (!t.parachute && fallen >= 3 && inv(t).parachute > 0) {
          inv(t).parachute--;
          t.parachute = true;
          this.events.push({ type: 'parachute', tank: t.id });
        }
        t.y += 0.5;
        moved += 0.5;
      }
      if (t.fallStartY !== null && this.supported(t)) {
        const fallen = t.y - t.fallStartY;
        if (!t.parachute && fallen > SAFE_FALL) {
          // Whoever knocked the ground out from under the tank gets the credit.
          const dealt = this.damageTank(t, (fallen - SAFE_FALL) * FALL_DAMAGE_PER_PX, t.lastHitBy);
          if (dealt >= 0.5) this.events.push({ type: 'damage', tank: t.id, amount: Math.round(dealt) });
        }
        t.fallStartY = null;
        t.parachute = false;
        t.y = Math.floor(t.y);
      }
    }
  }

  private startReload(t: Tank, seconds: number): void {
    t.reload = seconds;
    t.reloadTotal = seconds;
  }

  /** Drives moving tanks a pixel at a time, pausing while they fall and stopping where they're blocked. */
  private updateMoves(dt: number): void {
    const speed = MOVE_DISTANCE / MOVE_TIME;
    for (const t of this.tanks) {
      if (t.moveLeft <= 0) continue;
      if (!t.alive || this.phase !== 'playing') {
        t.moveLeft = 0;
        continue;
      }
      if (t.fallStartY !== null || t.flight !== null) continue;
      t.moveCarry += speed * dt;
      while (t.moveCarry >= 1 && t.moveLeft > 0) {
        t.moveCarry -= 1;
        const nx = t.x + t.moveDir;
        const ny = this.climbTo(t, nx);
        if (ny === null) {
          t.moveLeft = 0;
          break;
        }
        t.x = wrapX(nx);
        t.y = ny;
        t.moveLeft--;
        // Driving off a ledge: stop stepping and let the tank drop.
        if (!this.supported(t)) break;
      }
      if (t.moveLeft <= 0) t.moveCarry = 0;
    }
  }

  /**
   * The ground row the tank would rest on one pixel over at `nx`, climbing up to MAX_CLIMB
   * pixels, or null when a steep hill or another tank is in the way.
   */
  private climbTo(t: Tank, nx: number): number | null {
    for (const o of this.tanks) {
      const near = Math.abs(wrapDx(o.x, nx));
      if (
        o !== t &&
        o.alive &&
        o.flight === null &&
        near <= TANK_HALF_W * 2 &&
        near < Math.abs(wrapDx(o.x, t.x)) &&
        Math.abs(o.y - t.y) < TANK_H + MAX_CLIMB
      ) {
        return null;
      }
    }
    const dir = Math.sign(nx - t.x);
    for (let climb = 0; climb <= MAX_CLIMB; climb++) {
      if (this.frontClear(nx, t.y - climb, dir)) return t.y - climb;
    }
    return null;
  }

  /**
   * No dirt in the front half of a tank's body, standing on row `y` at column `x` and facing
   * `dir`. The back half is left out so a tank that has just driven off a ledge can carry on.
   */
  private frontClear(x: number, y: number, dir: number): boolean {
    for (let yy = y - TANK_H; yy < y; yy++) {
      for (let dx = 0; dx <= TANK_HALF_W; dx++) {
        if (this.terrain.isSolid(x + dx * dir, yy)) return false;
      }
    }
    return true;
  }

  private supported(t: Tank): boolean {
    for (let dx = -TANK_HALF_W + 2; dx <= TANK_HALF_W - 2; dx++) {
      if (this.terrain.isSolid(t.x + dx, t.y)) return true;
    }
    return false;
  }

  private detonate(x: number, y: number, radius: number, damage: number, owner: number | null, dirt = false): void {
    if (dirt) this.terrain.addCircle(x, y, radius);
    else this.terrain.carve(x, y, radius);
    this.explosions.push({ x, y, radius, age: 0, duration: 0.35 + radius / 110, dirt });
    this.events.push({ type: 'explosion', x, y, radius, dirt });
    for (const pl of this.planes) {
      if (pl.flying && Math.hypot(wrapDx(pl.x, x), pl.y - y) < radius + PLANE_HALF_W - 2) this.shootDown(pl, owner);
    }
    for (const t of this.tanks) {
      const canopy = t.y - CHUTE_TOP + 2;
      if (t.alive && t.flight === 'chute' && Math.hypot(wrapDx(t.x, x), canopy - y) < radius + CHUTE_HALF_W - 2) {
        this.cutChute(t, owner);
      }
    }
    if (damage <= 0) return;
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const d = Math.hypot(wrapDx(t.x, x), t.y - TANK_H / 2 - y);
      const reach = radius + TANK_HALF_W - 1;
      if (d >= reach) continue;
      const dealt = this.damageTank(t, damage * (1 - d / reach), owner);
      if (dealt >= 0.5) this.events.push({ type: 'damage', tank: t.id, amount: Math.round(dealt) });
    }
  }

  /** Applies damage through shields and pays the attacker. Returns health actually lost. */
  private damageTank(t: Tank, amount: number, owner: number | null): number {
    if (!t.alive || amount <= 0) return 0;
    this.sinceHit = 0;
    let a = amount;
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, a);
      t.shield -= absorbed;
      a -= absorbed;
    }
    a = Math.min(a, t.health);
    t.health -= a;
    if (owner !== null) {
      t.lastHitBy = owner;
      if (owner !== t.player && a > 0) {
        const attacker = this.players[owner];
        attacker.round.damageDealt += a;
        attacker.round.coinsEarned += a * COINS_PER_DAMAGE;
        attacker.coins += a * COINS_PER_DAMAGE;
      }
    }
    t.power = Math.min(t.power, this.maxPower(t));
    return a;
  }

  /** Blows up tanks with no health left. */
  private resolveDeaths(): void {
    const dying = this.tanks.filter((t) => t.alive && t.health <= 0.001);
    for (const t of dying) {
      t.alive = false;
      t.health = 0;
      const killer = t.lastHitBy;
      if (killer !== null && killer !== t.player) {
        const k = this.players[killer];
        k.round.kills++;
        k.totalKills++;
        k.score += SCORE_PER_KILL;
        k.coins += KILL_BONUS;
        k.round.coinsEarned += KILL_BONUS;
      }
      this.events.push({ type: 'destroyed', tank: t.id, killer });
    }
    for (const t of dying) {
      this.detonate(t.x, t.y - TANK_H / 2, TANK_DEATH_RADIUS, TANK_DEATH_DAMAGE, t.lastHitBy);
    }
  }

  // ---- Torpedo flights --------------------------------------------------------------

  /**
   * Fires the tank itself: it rockets straight up through anything in its way to the top of the
   * screen, drifting sideways the way it was aimed. Power makes no difference.
   */
  private launch(t: Tank): void {
    const a = (t.angle * Math.PI) / 180;
    t.flight = 'launch';
    t.vx = Math.cos(a) * TORPEDO_DRIFT;
    t.vy = -TORPEDO_START_SPEED;
    t.spin = 0;
    t.spinDir = t.angle <= 90 ? 1 : -1;
    t.steer = 0;
    t.moveLeft = 0;
    t.fallStartY = null;
    t.parachute = false;
  }

  /** Shoots away a parachuting tank's canopy, so it drops like a hit plane. */
  private cutChute(t: Tank, by: number | null): void {
    if (t.flight !== 'chute') return;
    t.flight = 'tumble';
    t.parachute = false;
    t.fallStartY = t.y;
    t.vx = t.steer * CHUTE_STEER_SPEED;
    t.vy = 0;
    t.steer = 0;
    if (by !== null) t.lastHitBy = by;
    this.events.push({ type: 'chuteCut', tank: t.id, by });
  }

  private updateFlights(dt: number): void {
    for (const t of this.tanks) {
      if (!t.flight) continue;
      if (!t.alive) {
        t.flight = null;
        continue;
      }
      if (t.flight === 'launch') {
        // Rockets ignore dirt on the way up. The parachute opens at the top, or once the tank
        // is clear of the dirt if it's buried up there.
        t.vy = Math.max(-TORPEDO_MAX_SPEED, t.vy - TORPEDO_THRUST * dt);
        t.x = wrapX(t.x + t.vx * dt);
        t.y += t.vy * dt;
        if (t.y <= TORPEDO_PEAK && !this.bodyBlocked(t.x, t.y)) this.openChute(t);
      } else if (t.flight === 'chute') {
        // Drift down and wherever the player steers.
        t.vx = t.steer * CHUTE_STEER_SPEED;
        t.vy = CHUTE_FALL_SPEED;
        this.flyTo(t, t.x + t.vx * dt, t.y);
        this.dropTo(t, t.y + t.vy * dt);
      } else {
        t.vy += this.opts.gravity * PLANE_FALL_GRAVITY * dt;
        t.spin += t.spinDir * TUMBLE_SPIN * Math.PI * 2 * dt;
        this.flyTo(t, t.x + t.vx * dt, t.y);
        this.dropTo(t, t.y + t.vy * dt);
      }
    }
  }

  private openChute(t: Tank): void {
    t.flight = 'chute';
    t.parachute = true;
    t.vx = 0;
    t.vy = CHUTE_FALL_SPEED;
  }

  /**
   * Moves a flying tank toward (x, y) a pixel at a time, stopping short of any dirt in its way.
   * Returns false if it was stopped.
   */
  private flyTo(t: Tank, x: number, y: number): boolean {
    const dx = x - t.x;
    const dy = y - t.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let i = 1; i <= n; i++) {
      const nx = t.x + dx / n;
      const ny = t.y + dy / n;
      if (this.bodyBlocked(nx, ny)) return false;
      t.x = wrapX(nx);
      t.y = ny;
    }
    return true;
  }

  /** Lowers a parachuting or tumbling tank, landing it when it reaches the ground. */
  private dropTo(t: Tank, y: number): void {
    while (t.y < y) {
      if (this.supported(t)) return this.land(t);
      t.y = Math.min(y, Math.floor(t.y) + 1);
    }
    if (this.supported(t)) this.land(t);
  }

  private land(t: Tank): void {
    t.y = Math.floor(t.y);
    if (t.flight === 'tumble' && t.fallStartY !== null) {
      // No canopy left: a hard landing, credited to whoever shot the parachute away.
      const fallen = t.y - t.fallStartY;
      if (fallen > SAFE_FALL) {
        const dealt = this.damageTank(t, (fallen - SAFE_FALL) * FALL_DAMAGE_PER_PX, t.lastHitBy);
        if (dealt >= 0.5) this.events.push({ type: 'damage', tank: t.id, amount: Math.round(dealt) });
      }
    }
    t.flight = null;
    t.parachute = false;
    t.fallStartY = null;
    t.vx = 0;
    t.vy = 0;
    t.spin = 0;
    t.steer = 0;
  }

  /** Dirt anywhere in the body of a tank whose treads would be on row `y` at column `x`. */
  private bodyBlocked(x: number, y: number): boolean {
    for (let yy = Math.floor(y) - TANK_H; yy < y; yy++) {
      for (let dx = -TANK_HALF_W + 2; dx <= TANK_HALF_W - 2; dx++) {
        if (this.terrain.isSolid(x + dx, yy)) return true;
      }
    }
    return false;
  }

  // ---- Planes ---------------------------------------------------------------------

  private updatePlanes(dt: number): void {
    const interval = this.opts.planeInterval ?? 0;
    if (interval > 0 && this.aliveCount() > 1 && !this.drawAgreed) {
      this.planeTimer -= dt;
      if (this.planeTimer <= 0) {
        this.spawnPlane();
        this.planeTimer = interval * this.planeRng.range(0.5, 1.5);
      }
    }
    const fall: PhysicsEnv = { ...this.env, gravity: this.opts.gravity * PLANE_FALL_GRAVITY, windAccel: 0 };
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const pl = this.planes[i];
      if (pl.flying) {
        pl.x += pl.vx * dt;
        if (pl.x < -PLANE_HALF_W * 2 || pl.x > WORLD_W + PLANE_HALF_W * 2) this.planes.splice(i, 1);
        continue;
      }
      const hit = stepBody(pl, dt, fall, this.terrain, this.tanks);
      pl.trail.push(pl.x, pl.y);
      if (pl.trail.length > TRAIL_LEN * 4) pl.trail.splice(0, 2);
      if (hit?.kind === 'terrain' || hit?.kind === 'tank') {
        this.planes.splice(i, 1);
        this.detonate(hit.x, hit.y, WEAPONS.babyNuke.radius, PLANE_CRASH_DAMAGE, pl.shotBy);
      } else if (pl.y > WORLD_H + 20) {
        this.planes.splice(i, 1);
      }
    }
  }

  /** Sends a plane across from a random side, high enough to clear the tallest hill. */
  private spawnPlane(): void {
    let peak = WORLD_H;
    for (let x = 0; x < WORLD_W; x += 4) peak = Math.min(peak, this.terrain.surfaceY(x));
    const low = Math.max(24, Math.min(120, peak - 40));
    const dir: -1 | 1 = this.planeRng.chance(0.5) ? 1 : -1;
    const speed = (WORLD_W + PLANE_HALF_W * 2) / PLANE_CROSS_TIME;
    this.planes.push({
      id: this.nextPlaneId++,
      x: dir === 1 ? -PLANE_HALF_W : WORLD_W + PLANE_HALF_W,
      y: Math.round(this.planeRng.range(20, low)),
      vx: dir * speed,
      vy: 0,
      dir,
      flying: true,
      shotBy: null,
      trail: [],
    });
  }

  /** Knocks a plane out of the sky and pays whoever did it. */
  private shootDown(pl: Plane, by: number | null): void {
    if (!pl.flying) return;
    pl.flying = false;
    pl.shotBy = by;
    pl.vy = -25;
    let reward = 0;
    if (by !== null) {
      reward = this.planeRng.int(PLANE_REWARD_MIN / 100, PLANE_REWARD_MAX / 100) * 100;
      const p = this.players[by];
      p.coins += reward;
      p.round.coinsEarned += reward;
    }
    this.events.push({ type: 'planeDown', plane: pl.id, by, reward, x: pl.x, y: pl.y });
  }

  private updateWind(dt: number): void {
    if (this.opts.windChange !== 'turn' || this.opts.windMax <= 0) return;
    this.windTimer += dt;
    if (this.windTimer < WIND_SHIFT_INTERVAL) return;
    this.windTimer = 0;
    const max = this.opts.windMax;
    this.wind = Math.round(Math.max(-max, Math.min(max, this.wind + this.rng.range(-max / 2, max / 2))));
    this.events.push({ type: 'wind', wind: this.wind });
  }

  private updateDrawVote(): void {
    const open = this.drawOpen;
    if (open !== this.drawWasOpen) {
      this.drawWasOpen = open;
      if (!open) {
        // A hit landed: the vote is off, even if everyone had agreed.
        this.drawVotes.clear();
        this.drawAgreed = false;
      }
      this.events.push({ type: 'drawVote', open });
    }
    if (!open) return;
    const { votes, needed } = this.drawTally();
    this.drawAgreed = votes >= needed;
    if (this.drawAgreed && this.isQuiet()) this.finish();
  }

  private finish(): void {
    this.phase = 'over';
    const alive = this.aliveTanks();
    for (const t of alive) this.players[t.player].round.survived = true;
    this.winner = alive.length === 1 ? alive[0].player : null;
    if (this.winner !== null) this.players[this.winner].round.won = true;
    this.events.push({ type: 'roundOver', winner: this.winner });
  }
}
