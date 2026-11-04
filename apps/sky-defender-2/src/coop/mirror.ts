// Co-op: the phones show the game too. About 20 times a second the host screen sends a compact
// snapshot of everything on the map; the phone copies it into a local Game that it never runs,
// smooths the planes and bombs between snapshots, adds its own smoke, contrails and explosion
// effects, and draws it with the same renderer as the big screen.
import { Game, type Plane, type Bomb, type Crate, type GameMode, type Difficulty, type Phase, type WeaponId, type BombKind, type ShotKind, type PlaneState, type Label, type ClearInfo, type BomberPerk } from '../game';
import type { AnyPlaneType } from '../art';
import type { PaletteId } from '../palettes';
import { Renderer } from '../render';

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

type PlaneRow = [id: number, type: AnyPlaneType, x: number, y: number, dir: number, pitch: number, flip: number, state: PlaneState, hp: number, max: number, flags: number];
type BombRow = [id: number, kind: BombKind, x: number, y: number, angle: number, mega: number, x0: number, vx0: number, k: number, wa: number, T: number, t: number];
type CrateRow = [x: number, y: number, lz: number, landed: number, kind: number, sway: number, t: number, dodgeX: number];

export interface Snap {
  mode: GameMode; diff: Difficulty; phase: Phase; phaseT: number; wave: number; score: number; mult: number; left: number;
  aim: number; cam: number; gunX: number; viewX: number; pal: [PaletteId, PaletteId, number]; wind: number;
  shieldT: number; shieldFlash: number; nukeFlash: number; shake: number;
  weapon: WeaponId | null; ammo: number; guns: number; recoil: number; flash: number; lasing: boolean;
  planes: PlaneRow[]; bombs: BombRow[];
  shells: [number, number, number, number, number][];
  missiles: [ShotKind, number, number, number, number][];
  crates: CrateRow[];
  buildings: [number, number, number][];
  tracers: [number, number, number, number, number][];
  bolts: [[number, number][], number][];
  labels: [string, number, number, number, number, string, number][];
  clear: ClearInfo | null;
  bomber: { name: string; plane: number; armHp: number; armMax: number; armCrate: number; shieldT: number; protectT: number; deadT: number; perk: BomberPerk | null } | null;
  snipes: [number, number, number][]; protectT: number;
  fx: [number, number, number, number][];
}

/** Host side: everything the phones need to draw the map right now. */
export function takeSnap(g: Game): Snap {
  const fx = g.fxLog ?? [];
  g.fxLog = [];
  const b = g.bomber;
  return {
    mode: g.mode, diff: g.difficulty, phase: g.phase, phaseT: r1(g.phaseT), wave: g.wave, score: g.score, mult: g.mult, left: g.planesLeft(),
    aim: r3(g.aim), cam: r3(g.cam), gunX: g.gunX, viewX: r1(g.viewX), pal: [g.palFrom, g.palTo, r3(g.palT)], wind: g.wind,
    shieldT: r1(g.shieldT), shieldFlash: r3(g.shieldFlash), nukeFlash: r3(g.nukeFlash), shake: r1(g.shake),
    weapon: g.weapon, ammo: r1(g.ammo), guns: g.guns, recoil: r3(g.recoil), flash: r3(g.flash), lasing: g.lasing,
    planes: g.planes.filter(p => !p.dead).map(p => [p.id, p.type, r1(p.x), r1(p.y), p.dir, r3(p.pitch), r3(p.flip), p.state, r1(p.hp), p.max,
      (p.friend ? 1 : 0) | (p.gold ? 2 : 0) | (p.player ? 4 : 0) | (p.burning ? 8 : 0) | (p.hitFlash > .3 ? 16 : 0)]),
    bombs: g.bombs.filter(x => !x.dead).map(x => [x.id, x.kind, r1(x.x), r1(x.y), r3(x.angle), x.mega ? 1 : 0, r1(x.x0), r1(x.vx0), x.k, x.wa, x.T, r3(x.t)]),
    shells: g.shells.filter(s => !s.dead).map(s => [r1(s.x), r1(s.y), r1(s.vx), r1(s.vy), s.ghost ? 1 : 0]),
    missiles: g.missiles.filter(m => !m.dead).map(m => [m.kind, r1(m.x), r1(m.y), r1(m.vx), r1(m.vy)]),
    crates: g.crates.filter(c => !c.dead).map(c => [r1(c.x), r1(c.y), r1(c.lz), c.landed ? 1 : 0, c.diamond ? 2 : c.gold ? 1 : 0, r3(c.sway), r1(c.t), r1(c.dodgeX ?? 0)]),
    buildings: g.buildings.map(x => [r1(x.hp), x.ruined ? 1 : 0, r3(x.hit)]),
    tracers: g.tracers.map(t => [r1(t.x0), r1(t.y0), r1(t.x1), r1(t.y1), r3(t.life)]),
    bolts: g.bolts.map(x => [x.pts.map(([px, py]) => [r1(px), r1(py)] as [number, number]), r3(x.life)]),
    labels: g.labels.map(l => [l.text, r1(l.x), r1(l.y), r3(l.t), l.life, l.color, l.big ? 1 : 0]),
    clear: g.clearInfo,
    bomber: b ? { name: b.name, plane: b.plane?.id ?? 0, armHp: b.arm?.hp ?? 0, armMax: b.arm?.max ?? 0, armCrate: b.arm ? g.crates.filter(c => !c.dead).indexOf(b.arm.crate) : -1, shieldT: r1(b.shieldT), protectT: r1(b.protectT), deadT: r1(b.deadT), perk: b.perk } : null,
    snipes: g.snipes.map(x => [r1(x.x), r1(x.y), r3(x.t)]), protectT: r1(g.protectT),
    fx,
  };
}

interface Smooth { fx: number; fy: number; fp: number; ff: number; tx: number; ty: number; tp: number; tf: number; }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Phone side: a copy of the game, drawn from the host's snapshots. */
export class Mirror {
  readonly game = new Game({});
  readonly renderer: Renderer;
  private planes = new Map<number, Plane & { sm: Smooth }>();
  private bombs = new Map<number, Bomb & { sm: Smooth }>();
  private snap: Snap | null = null;
  private since = 0;
  /** the Bomber's phone follows its own plane; the Base's phone sees what the big screen sees; the Sniper's holds still over the base */
  view: 'base' | 'follow' | 'fixed' = 'base';
  private viewX = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.game.settings.vibration = false;
  }

  apply(s: Snap) {
    const g = this.game;
    if (g.mode !== s.mode) { g.mode = s.mode; g.reset(); }
    g.difficulty = s.diff; g.phase = s.phase; g.phaseT = s.phaseT; g.wave = s.wave; g.score = s.score; g.mult = s.mult;
    g.planesLeft = () => s.left;
    g.aim = s.aim; g.gunX = s.gunX; [g.palFrom, g.palTo, g.palT] = s.pal; g.wind = s.wind;
    g.shieldT = s.shieldT; g.shieldFlash = s.shieldFlash; g.nukeFlash = Math.max(g.nukeFlash, s.nukeFlash); g.shake = Math.max(g.shake, s.shake * .6);
    g.weapon = s.weapon; g.ammo = s.ammo; g.guns = s.guns; g.recoil = s.recoil; g.flash = s.flash; g.lasing = s.lasing;
    g.clearInfo = s.clear;
    g.snipes = (s.snipes ?? []).map(([x, y, t]) => ({ x, y, t })); g.protectT = s.protectT ?? 0;
    // planes: keep each one's object (and its contrail) from snapshot to snapshot, and glide it to its new place
    const seen = new Set<number>();
    g.planes = s.planes.map(([id, type, x, y, dir, pitch, flip, state, hp, max, f]) => {
      seen.add(id);
      let p = this.planes.get(id);
      if (!p || p.type !== type) {
        p = { id, type, dir, x, y, alt: y, speed: 0, hp, max, state, stateT: 0, pitch, flip, turnT: 0, hits: [], trail: [], trailT: 0, dropCD: 0, diveCD: 0, burnT: 0, burning: false, smokeT: 0, hitFlash: 0, vx: 0, vy: 0, spin: 0, lightPhase: Math.random() * 6,
          sm: { fx: x, fy: y, fp: pitch, ff: flip, tx: x, ty: y, tp: pitch, tf: flip } };
        this.planes.set(id, p);
      }
      if (p.state !== state) p.stateT = 0;
      p.sm = { fx: p.x, fy: p.y, fp: p.pitch, ff: p.flip, tx: x, ty: y, tp: pitch, tf: flip };
      p.dir = dir; p.state = state; p.hp = hp; p.max = max;
      p.friend = !!(f & 1); p.gold = !!(f & 2); p.player = !!(f & 4); p.burning = !!(f & 8); if (f & 16) p.hitFlash = 1;
      if (type === 'cargo') p.dropped = true;
      return p;
    });
    for (const id of [...this.planes.keys()]) if (!seen.has(id)) this.planes.delete(id);
    g.cargo = g.planes.find(p => p.type === 'cargo' && p.state !== 'falling') ?? null;
    const bseen = new Set<number>();
    g.bombs = s.bombs.map(([id, kind, x, y, angle, mega, x0, vx0, k, wa, T, t]) => {
      bseen.add(id);
      let b = this.bombs.get(id);
      if (!b) {
        b = { id, kind, x, y, x0, y0: y, vx0, k, g: 0, wa, t, T, hp: 1, trail: [], trailT: 0, angle, sm: { fx: x, fy: y, fp: angle, ff: 0, tx: x, ty: y, tp: angle, tf: 0 } };
        this.bombs.set(id, b);
      }
      b.sm = { fx: b.x, fy: b.y, fp: b.angle, ff: 0, tx: x, ty: y, tp: angle, tf: 0 };
      b.t = t; b.mega = !!mega;
      return b;
    });
    for (const id of [...this.bombs.keys()]) if (!bseen.has(id)) { const b = this.bombs.get(id)!; g.trails.push({ pts: b.trail, t: 0 }); this.bombs.delete(id); }
    g.crates = s.crates.map(([x, y, lz, landed, kind, sway, t, dodgeX]): Crate => ({ x, y, vx: 0, vy: 0, lz, landed: !!landed, t, sway, gold: kind === 1, diamond: kind === 2, dodgeX }));
    s.buildings.forEach(([hp, ruined, hit], i) => { const b = g.buildings[i]; if (b) { if (ruined && !b.ruined) b.ruinT = 0; b.hp = hp; b.ruined = !!ruined; b.hit = hit; } });
    g.tracers = s.tracers.map(([x0, y0, x1, y1, life]) => ({ x0, y0, x1, y1, life }));
    g.bolts = s.bolts.map(([pts, life]) => ({ pts, life }));
    g.labels = s.labels.map(([text, x, y, t, life, color, big]): Label => ({ text, x, y, t, life, color, big: !!big }));
    const bp = s.bomber;
    if (bp) {
      const plane = this.planes.get(bp.plane) ?? null;
      const crate = bp.armCrate >= 0 ? g.crates[bp.armCrate] : null;
      g.bomber = {
        name: bp.name, plane, deadT: bp.deadT, up: false, down: false, missileCD: 0, nukeCD: 0, diveCD: 0, switchCD: 0, diveT: 0, dive: null, returnY: null,
        arm: crate ? { crate, hp: bp.armHp, max: bp.armMax, t: 0, x0: crate.x, y0: crate.y } : null, perk: bp.perk, shieldT: bp.shieldT, turboT: 0, rapidT: 0, protectT: bp.protectT, protectCD: 0, damage: 0, deaths: 0, steals: 0,
      };
      if (crate) crate.held = true;
    } else g.bomber = null;
    for (const [kind, x, y, k] of s.fx) { if (kind === 0) g.flak(x, y, k); else g.explosion(x, y, k, kind === 2); }
    this.snap = s; this.since = 0;
  }

  resize(w: number, h: number) { this.renderer.resize(w, h); }

  frame(dt: number) {
    const g = this.game, s = this.snap;
    if (!s) return;
    this.since += dt;
    g.t += dt;
    const k = Math.min(1, this.since / .05);
    for (const p of g.planes) {
      const m = (p as Plane & { sm: Smooth }).sm; p.x = lerp(m.fx, m.tx, k); p.y = lerp(m.fy, m.ty, k); p.pitch = lerp(m.fp, m.tp, k); p.flip = lerp(m.ff, m.tf, k);
      p.stateT += dt; p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
      // contrails up high, and smoke behind a plane that is hit or going down
      p.trailT -= dt;
      if (p.trailT <= 0 && p.y < -360 && (p.state === 'fly' || p.state === 'turn')) { p.trailT = .1; p.trail.push([p.x - p.dir * p.flip * 14, p.y + 1, g.t]); if (p.trail.length > 45) p.trail.shift(); }
      p.smokeT -= dt;
      if (p.smokeT <= 0 && (p.state === 'falling' || p.hp < p.max)) {
        p.smokeT = p.state === 'falling' ? .03 : .08;
        if (p.state === 'falling') { g.addPuff(p.x, p.y, 'smokeBlack', 2, 3.2, .85, 0, -5, 1.6); g.addFire(p.x, p.y, .7); }
        else g.addPuff(p.x, p.y, 'smokeDark', 1.6, 2.2, .7, 0, -6, 1.4);
      }
    }
    for (const b of g.bombs) {
      const m = (b as Bomb & { sm: Smooth }).sm; b.x = lerp(m.fx, m.tx, k); b.y = lerp(m.fy, m.ty, k); b.angle = lerp(m.fp, m.tp, k);
      b.trailT -= dt;
      if (b.trailT <= 0) { b.trailT = .08; const tl = g.bombTail(b); b.trail.push([tl.x, tl.y, g.t]); if (b.trail.length > 90) b.trail.shift(); }
    }
    for (const tr of g.trails) tr.t += dt;
    g.trails = g.trails.filter(tr => tr.t < 4);
    // shells and shots fly on from where the last snapshot put them
    const e = Math.min(.15, this.since);
    g.shells = s.shells.map(([x, y, vx, vy, ghost]) => ({ x: x + vx * e, y: y + vy * e, vx, vy, t: 1, px: x, py: y, ghost: !!ghost || undefined }));
    g.missiles = s.missiles.map(([kind, x, y, vx, vy]) => ({ kind, x: x + vx * e, y: y + vy * e, vx, vy, t: 1, target: null, smokeT: 0 }));
    for (const t of g.tracers) t.life -= dt;
    for (const sn of g.snipes) sn.t = Math.max(0, sn.t - dt);
    g.tracers = g.tracers.filter(t => t.life > 0);
    for (const l of g.labels) l.t += dt;
    g.labels = g.labels.filter(l => l.t < l.life);
    g.updateParticles(dt);
    g.updateBase(dt);
    g.nukeFlash = Math.max(0, g.nukeFlash - dt * 1.6);
    g.shake = Math.max(0, g.shake - dt * 10);
    // camera: the Base's view, or level and following the Bomber's own plane
    const bp = g.bomber?.plane;
    if (this.view === 'fixed') { g.cam = 0; g.viewX = 0; }
    else if (this.view === 'follow') {
      g.cam = 0;
      if (bp) this.viewX += (Math.max(-430, Math.min(430, bp.x)) - this.viewX) * Math.min(1, dt * 2.5);
      g.viewX = this.viewX;
    } else { g.cam = s.cam; g.viewX = s.viewX; }
    this.renderer.frame(g, dt);
  }
}
