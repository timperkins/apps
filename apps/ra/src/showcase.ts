// The showcase page (/units/): every unit and building in v2, one row each,
// from eight angles and doing the things it does in the game, on plain grass.
import './showcase.css';
import { ART, RGB, dirIndex, fbm, hash2, hex, mix, shade } from './gfx';
import { DIRS, FACTIONS, BuildingKind, BuildingStates, V2BuildingArt, V2FactionArt, drawBuggyLights, makeBuilding, makeBuildingStates, makeDish, makeFactionArt, makeOre } from './v2/sprites';
import { BOOM, DAMAGED, HIT_SPREAD, Fx, KNOCK_EASE, PIECE_S, QUAKE, QUAKE_S, Shot, UnitKind, WEAPON, buildingQuake, drawFlame, knockback, makeShot, muzzles } from './v2/combat';
import { StackSprite, drawSprite, toScreen, toWorld } from './v2/stack';
import { TECH } from './v2/tech';

const TAU = Math.PI * 2;
const HELI_ALT = 20; // as in the game (see combat.ts)
const RISE_S = 1.8;

// ---------- The ground: plain grass, in the game's greens ----------

const GRASS = ['#22391b', '#284320', '#2f4d24', '#365628', '#3d5f2d', '#466833'].map(hex);
const FLOWER = [hex('#e8dc72'), hex('#e6e0d0'), hex('#c98ac0'), hex('#d9694a'), hex('#8fa6e0')];
const CLOVER = hex('#2a5a3a');
const GW = 420; // grass texture size in map pixels
const GH = 320;

function makeGrass(): HTMLCanvasElement {
  const W = GW * ART;
  const H = GH * ART;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(W, H);
  const d = img.data;
  const seed = 77;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x / ART;
      const py = y / ART;
      const patch = fbm(px / 36, py / 36, seed + 11, 3);
      const tone = fbm(px / 12, py / 12, seed + 12, 2);
      const rnd = hash2(x, y, seed);
      const cell = (hash2(x >> 1, y >> 1, seed + 2) - 0.5) * 1.3;
      let gi = Math.floor((patch * 0.7 + tone * 0.3) * 6.4 - 0.2 + cell + (rnd - 0.5) * 1.2);
      gi = Math.max(0, Math.min(GRASS.length - 1, gi));
      let col: RGB = GRASS[gi];
      const r2 = hash2(x, y, seed + 26);
      const bloom = fbm(px / 30, py / 30, seed + 14, 2);
      if (bloom < 0.32 && tone > 0.55 && rnd < 0.5) col = mix(col, CLOVER, 0.6);
      else if (r2 > 0.992) col = shade(GRASS[5], rnd * 0.1);
      else if (r2 < 0.02) col = shade(col, -0.2);
      else if (r2 < 0.0206) col = FLOWER[Math.floor(rnd * FLOWER.length)];
      const i = (y * W + x) * 4;
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  return cv;
}

// ---------- Cells: one small scene each ----------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: 'smoke' | 'soot' | 'dust' | 'spark';
  size: number;
}

// What a scene draws with, in map pixels, with the ground origin at (0, 0).
class Scene {
  particles: Particle[] = [];
  fx = new Fx();
  lit = 0; // > 0: what's drawn has just been hit, and flashes this bright
  // the scene shakes when something big is destroyed in it, as the game's view does
  quakes: { s: number; t: number }[] = [];
  constructor(public c: CanvasRenderingContext2D) {}

  quake(s: number): void {
    this.quakes.push({ s, t: 0 });
  }

  // How far to shake the scene this frame, in map pixels.
  shake(time: number): [number, number] {
    let amp = 0;
    for (const q of this.quakes) amp += q.s * (1 - q.t / QUAKE_S) ** 2;
    if (amp < 0.05) return [0, 0];
    amp = Math.min(amp, 4);
    const r = (v: number) => Math.round(v * ART) / ART;
    return [r(amp * (Math.sin(time * 71) * 0.6 + Math.sin(time * 43 + 1.3) * 0.4)), r(amp * 0.7 * (Math.sin(time * 59 + 2.1) * 0.6 + Math.sin(time * 37 + 0.4) * 0.4))];
  }

  blit(spr: StackSprite, wx: number, wy: number, z: number): void {
    const [sx, sy] = toScreen(wx, wy, z);
    drawSprite(this.c, spr.img, spr, sx, sy);
    if (this.lit > 0) {
      this.c.globalCompositeOperation = 'lighter';
      this.c.globalAlpha = this.lit;
      drawSprite(this.c, spr.img, spr, sx, sy);
      this.c.globalCompositeOperation = 'source-over';
      this.c.globalAlpha = 1;
    }
  }

  shadow(spr: StackSprite, wx: number, wy: number, z: number): void {
    if (!spr.shadow) return;
    const [sx, sy] = toScreen(wx, wy, z);
    drawSprite(this.c, spr.shadow, spr, sx, sy);
  }

  puff(sx: number, sy: number, kind: Particle['kind'], o: Partial<Particle> = {}): void {
    this.particles.push({ x: sx, y: sy, vx: 0, vy: 0, life: 0, max: 1, kind, size: 1, ...o });
  }

  step(dt: number): void {
    for (const q of this.quakes) q.t += dt;
    this.quakes = this.quakes.filter((q) => q.t < QUAKE_S);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke' || p.kind === 'soot') p.size += dt * 1.8;
      if (p.kind === 'spark') p.vy += 60 * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  // The game's puffs of smoke and dust, and sparks.
  drawParticles(): void {
    const c = this.c;
    for (const p of this.particles) {
      const k = p.life / p.max;
      if (p.kind === 'spark') {
        c.fillStyle = p.life < 0.2 ? '#fff6c8' : '#ffb347';
        c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        continue;
      }
      const s = Math.max(1, Math.round(p.size));
      c.fillStyle =
        p.kind === 'smoke' ? `rgba(222,222,216,${0.6 * (1 - k)})` : p.kind === 'soot' ? `rgba(70,66,60,${0.55 * (1 - k)})` : `rgba(165,145,105,${0.5 * (1 - k)})`;
      const X = Math.round(p.x - s / 2);
      const Y = Math.round(p.y - s / 2);
      if (s > 1) {
        c.fillRect(X + 0.5, Y, s - 1, s);
        c.fillRect(X, Y + 0.5, 0.5, s - 1);
        c.fillRect(X + s - 0.5, Y + 0.5, 0.5, s - 1);
      } else c.fillRect(X, Y, s, s);
      if (s > 2 && p.kind === 'smoke') {
        c.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`;
        c.fillRect(X, Y, Math.ceil(s / 2), 1);
      }
    }
  }

  // A building site's dashed outline, as the game draws it.
  foot(rx: number, ry: number, color: string, alpha: number): void {
    const c = this.c;
    const pts: [number, number][] = [
      [-rx, -ry],
      [rx, -ry],
      [rx, ry],
      [-rx, ry],
    ];
    c.fillStyle = color;
    c.globalAlpha = alpha * 0.2;
    c.beginPath();
    pts.forEach(([x, y], i) => {
      const [sx, sy] = toScreen(x, y);
      if (i) c.lineTo(sx, sy);
      else c.moveTo(sx, sy);
    });
    c.fill();
    c.globalAlpha = alpha;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % 4];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let k = 0; k <= n; k++) {
        if (k % 4 === 3) continue;
        const [sx, sy] = toScreen(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
        c.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      }
    }
    c.globalAlpha = 1;
  }
}

// A scene's size, in map pixels round its ground origin.
interface Box {
  l: number;
  r: number;
  u: number;
  d: number;
}
// The painted part of a sprite (its picture has room to spare round it), in
// map pixels from the left and top of the picture.
const tight = new WeakMap<StackSprite, { x0: number; y0: number; x1: number; y1: number }>();
function boundsOf(spr: StackSprite): { x0: number; y0: number; x1: number; y1: number } {
  let b = tight.get(spr);
  if (b) return b;
  const { width: W, height: H } = spr.img;
  const d = spr.img.getContext('2d')!.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  b = x1 < x0 ? { x0: 0, y0: 0, x1: spr.w, y1: spr.h } : { x0: x0 / ART, y0: y0 / ART, x1: (x1 + 1) / ART, y1: (y1 + 1) / ART };
  tight.set(spr, b);
  return b;
}
const boxOf = (spr: StackSprite, wx = 0, wy = 0, z = 0): Box => {
  const [sx, sy] = toScreen(wx, wy, z);
  const b = boundsOf(spr);
  return { l: spr.cx - b.x0 - sx, r: b.x1 - spr.cx + sx, u: spr.cy - b.y0 - sy, d: b.y1 - spr.cy + sy };
};
const union = (...bs: Box[]): Box => ({
  l: Math.max(...bs.map((b) => b.l)),
  r: Math.max(...bs.map((b) => b.r)),
  u: Math.max(...bs.map((b) => b.u)),
  d: Math.max(...bs.map((b) => b.d)),
});
// The room a sprite needs to go round a circle of radius R.
const circleBox = (spr: StackSprite, R: number, z = 0): Box => {
  const bs: Box[] = [];
  for (let i = 0; i < 16; i++) bs.push(boxOf(spr, Math.cos((i / 16) * TAU) * R, Math.sin((i / 16) * TAU) * R, z));
  return union(...bs);
};

interface Cell {
  label: string;
  box: Box;
  draw: (s: Scene, t: number, dt: number) => void;
  anim?: boolean;
}

interface Live {
  cv: HTMLCanvasElement;
  scene: Scene;
  cell: Cell;
  ox: number;
  oy: number;
  gx: number;
  gy: number;
  w: number;
  h: number;
  t: number;
  seen: boolean;
}

let grass: HTMLCanvasElement;
const live: Live[] = [];
const PAD = 5;

const io = new IntersectionObserver(
  (es) => {
    for (const e of es) {
      const l = live.find((x) => x.cv === e.target);
      if (l) l.seen = e.isIntersecting;
    }
  },
  { rootMargin: '120px' },
);

function paint(l: Live, dt: number): void {
  const c = l.scene.c;
  c.setTransform(ART, 0, 0, ART, 0, 0);
  c.imageSmoothingEnabled = false;
  const [qx, qy] = l.scene.shake(l.t);
  // (a cell's grass is cut from at least 4 pixels inside the texture, so a shake never runs off it)
  c.drawImage(grass, (l.gx + qx) * ART, (l.gy + qy) * ART, l.w * ART, l.h * ART, 0, 0, l.w, l.h);
  c.translate(l.ox - qx, l.oy - qy);
  l.scene.step(dt);
  l.scene.fx.step(dt);
  l.cell.draw(l.scene, l.t, dt);
  l.scene.drawParticles();
  l.scene.fx.drawBelow(c);
  l.scene.fx.drawAbove(c);
}

// A row: the thing's name and what it is, then its scenes side by side, all
// the same size so the sprites line up.
function addRow(parent: HTMLElement, name: string, blurb: string, cells: Cell[], big = false): void {
  const row = document.createElement('section');
  row.className = big ? 'row big' : 'row';
  const head = document.createElement('div');
  head.className = 'head';
  const h = document.createElement('h3');
  h.textContent = name;
  const p = document.createElement('p');
  p.textContent = blurb;
  head.append(h, p);
  const strip = document.createElement('div');
  strip.className = 'strip';
  const hgt = Math.ceil(Math.max(...cells.map((c) => c.box.u + c.box.d))) + PAD * 2;
  const up = Math.max(...cells.map((c) => c.box.u));
  for (const cell of cells) {
    const w = Math.max(30, Math.ceil(cell.box.l + cell.box.r) + PAD * 2);
    const fig = document.createElement('figure');
    const cv = document.createElement('canvas');
    cv.width = w * ART;
    cv.height = hgt * ART;
    cv.style.setProperty('--w', String(w));
    cv.style.setProperty('--h', String(hgt));
    const cap = document.createElement('figcaption');
    cap.textContent = cell.label;
    if (cell.anim) cap.classList.add('anim');
    fig.append(cv, cap);
    strip.append(fig);
    const l: Live = {
      cv,
      scene: new Scene(cv.getContext('2d')!),
      cell,
      ox: Math.round(w / 2 + (cell.box.l - cell.box.r) / 2),
      oy: Math.round(PAD + up + (hgt - PAD * 2 - up - Math.max(...cells.map((c) => c.box.d))) / 2),
      gx: 4 + Math.floor(Math.random() * Math.max(0, GW - w - 8)),
      gy: 4 + Math.floor(Math.random() * Math.max(0, GH - hgt - 8)),
      w,
      h: hgt,
      t: Math.random() * 10,
      seen: false,
    };
    paint(l, 0);
    if (cell.anim) {
      live.push(l);
      io.observe(cv);
    }
  }
  row.append(head, strip);
  parent.append(row);
}

// ---------- Angles ----------

// Eight headings round the compass of the screen, from facing the viewer
// round clockwise. World angle a points along (cos a, sin a); +x runs to the
// lower right of the screen and +y to the lower left.
const ANGLES: { a: number; label: string }[] = [
  { a: Math.PI / 4, label: '↓ S' },
  { a: Math.PI / 2, label: '↙ SW' },
  { a: (3 * Math.PI) / 4, label: '← W' },
  { a: Math.PI, label: '↖ NW' },
  { a: (5 * Math.PI) / 4, label: '↑ N' },
  { a: (3 * Math.PI) / 2, label: '↗ NE' },
  { a: (7 * Math.PI) / 4, label: '→ E' },
  { a: 0, label: '↘ SE' },
];

const blurbOf = (unit: string) => {
  const t = TECH.find((x) => x.unit === unit || x.building === unit);
  return t ? `${t.blurb} ${t.cost} credits.` : '';
};

// Going round a circle anticlockwise on the ground: position and heading.
const round = (t: number, R: number, speed: number): [number, number, number] => {
  const th = (t * speed) / R;
  return [Math.cos(th) * R, Math.sin(th) * R, th + Math.PI / 2];
};

type Draw = (s: Scene, x: number, y: number, a: number, t: number, extra?: number) => void;

// Standing about, as the game does it (see paceAbout and the turret code in
// v2/game.ts): each Idle cell keeps its own little state between frames.
const PACE_SPEED = 3.5;
const PACE_R = 6;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// A soldier: waits, then steps somewhere near where it was left, or turns.
function pacer(draw: Draw): (s: Scene, t: number, dt: number) => void {
  const u = { x: 0, y: 0, a: Math.PI / 4, idle: 1 + Math.random() * 2, pace: null as [number, number] | null };
  return (s, t, dt) => {
    if (u.pace) {
      const dx = u.pace[0] - u.x;
      const dy = u.pace[1] - u.y;
      const dist = Math.hypot(dx, dy);
      u.a = Math.atan2(dy, dx);
      const sp = Math.min(dist, PACE_SPEED * dt);
      u.x += Math.cos(u.a) * sp;
      u.y += Math.sin(u.a) * sp;
      if (dist < 0.3) {
        u.pace = null;
        u.idle = 1.5 + Math.random() * 4;
      }
    } else if ((u.idle -= dt) <= 0) {
      u.idle = 1.5 + Math.random() * 4;
      if (Math.random() < 0.35) u.a += (Math.random() - 0.5) * 2.5;
      else {
        const r = 2 + Math.random() * (PACE_R - 2);
        const th = Math.random() * TAU;
        u.pace = [Math.cos(th) * r, Math.sin(th) * r];
      }
    }
    draw(s, u.x, u.y, u.a, t, u.pace ? 2 : 0);
  };
}

// A tank: the hull sits still and the turret looks about.
function scanner(draw: Draw): (s: Scene, t: number, dt: number) => void {
  const a = Math.PI / 4;
  let tur = a;
  let goal = a;
  let idle = 0.5;
  return (s, t, dt) => {
    if ((idle -= dt) <= 0) {
      idle = 2 + Math.random() * 5;
      goal = a + (Math.random() - 0.5) * 2.4;
    }
    const d = angDiff(goal, tur);
    tur += Math.sign(d) * Math.min(Math.abs(d), 2.2 * dt);
    draw(s, 0, 0, a, t, tur);
  };
}

// The gun: edges round on its wheels a little now and then, back and
// forth about the way it was left facing.
function shuffler(draw: Draw, turn: number): (s: Scene, t: number, dt: number) => void {
  const home = Math.PI / 4;
  let a = home;
  let look: number | null = null;
  let idle = 1;
  return (s, t, dt) => {
    if (look === null) {
      if ((idle -= dt) <= 0) {
        idle = 3 + Math.random() * 6;
        // (the game lets it drift; here it stays near the camera's view)
        look = home + (a > home ? -1 : 1) * (0.25 + Math.random() * 0.35);
      }
    } else {
      const d = angDiff(look, a);
      const stepA = turn * 0.35 * dt;
      if (Math.abs(d) <= stepA) {
        a = look;
        look = null;
      } else a += Math.sign(d) * stepA;
    }
    draw(s, 0, 0, a, t);
  };
}

// The standard set for a vehicle or soldier: eight angles, driving round, and
// the other side's colours; plus whatever else it does.
function unitCells(spr: StackSprite, draw: Draw, enemy: Draw, o: { R: number; speed: number; z?: number; more?: Cell[]; moveLabel?: string }): Cell[] {
  const z = o.z ?? 0;
  const still = boxOf(spr, 0, 0, z);
  const cells: Cell[] = ANGLES.map(({ a, label }) => ({ label, box: still, draw: (s, t) => draw(s, 0, 0, a, t) }));
  cells.push(...(o.more ?? []));
  cells.push({
    label: o.moveLabel ?? 'Drive',
    box: circleBox(spr, o.R, z),
    anim: true,
    draw: (s, t) => {
      const [x, y, a] = round(t, o.R, o.speed);
      draw(s, x, y, a, t, 1);
    },
  });
  cells.push({ label: 'Enemy', box: still, draw: (s, t) => enemy(s, 0, 0, Math.PI / 4, t) });
  return cells;
}

// ---------- Fighting ----------
// The same weapons, shots and effects as the game (v2/combat.ts), played
// out on a loop in each cell.

const A = Math.PI / 4; // facing the viewer
const MID: Record<UnitKind, number> = { mcv: 6, light: 4, heavy: 5, buggy: 4, hauler: 5, arty: 5, boat: 4, heli: 4, inf: 4, rocket: 4 };

// A health bar, as the game draws it.
function healthBar(c: CanvasRenderingContext2D, bx: number, by: number, bw: number, hp: number): void {
  c.fillStyle = '#111';
  c.fillRect(bx - 1, by - 1, bw + 2, 4);
  c.fillStyle = hp > 0.66 ? '#5ee05e' : hp > 0.33 ? '#e8d24a' : '#e85a4a';
  c.fillRect(bx, by, Math.round(bw * hp), 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 3; i < bw; i += 3) c.fillRect(bx + i, by, 1, 2);
}

// What a round does where it lands.
function impactFx(fx: Fx, kind: Shot['kind'], s: Shot, soft: boolean): void {
  const [sx, sy] = toScreen(s.x, s.y, s.z);
  if (kind === 'arc') {
    fx.boom(sx, sy, 6);
    fx.dust(sx, sy, 4);
  } else if (kind === 'bullet') {
    if (soft) fx.dust(sx, sy);
    else fx.sparks(sx, sy, 4);
  } else {
    fx.boom(sx, sy, kind === 'rocket' ? 3.5 : 3);
    fx.sparks(sx, sy, 6);
  }
}

// Firing at a spot on the ground in front of it, as fast as it reloads
// (artillery a little faster, so there is something to see).
function attackCell(kind: UnitKind | 'tower', box: Box, draw: (s: Scene, t: number, kick: boolean) => void, from: () => [number, number, number][], to: [number, number, number]): Cell {
  const w = WEAPON[kind]!;
  let cool = 0.4;
  let clock = 0;
  let fired = -9;
  return {
    label: 'Attack',
    box,
    anim: true,
    draw: (s, t, dt) => {
      clock += dt;
      if ((cool -= dt) <= 0) {
        cool = Math.min(w.rof, 2.4);
        fired = clock;
        for (const m of from()) {
          const [sx, sy] = toScreen(...m);
          s.fx.muzzle(sx, sy, w.shot !== 'bullet');
          const sc = w.scatter ?? (w.shot === 'bullet' ? 2 : 0.5);
          const aim: [number, number, number] = [to[0] + (Math.random() - 0.5) * sc * 2, to[1] + (Math.random() - 0.5) * sc * 2, to[2]];
          s.fx.fire(makeShot(w.shot, m, aim, w.speed, (sh) => impactFx(s.fx, w.shot, sh, true)));
        }
      }
      draw(s, t, clock - fired < 0.1);
    },
  };
}

// Being shot at from off to the left: rounds land on it, it flashes, and its
// health runs down (then starts again). spot() picks where each one lands.
// knock: how far (world units) each round shoves it back, as in the game; it
// creeps back to its spot between rounds.
function hitCell(box: Box, draw: (s: Scene, t: number) => void, spot: () => [number, number, number], round: 'bullet' | 'shell', bar: { x: number; y: number; w: number }, lit: number, every: number, knock = 0, smokeAt?: [number, number]): Cell {
  let hp = 1;
  let cool = 0.3;
  let flash = -9;
  let clock = 0;
  let off = 0; // how far back it is now
  let left = 0; // and still to go
  return {
    label: 'Hit',
    box,
    anim: true,
    draw: (s, t, dt) => {
      clock += dt;
      if ((cool -= dt) <= 0) {
        cool = every;
        const p = spot();
        s.fx.fire(
          makeShot(round, [p[0] - 70 - off * 0.7, p[1] + 70 + off * 0.7, p[2] + 3], [p[0] + off * 0.7, p[1] - off * 0.7, p[2]], 260, (sh) => {
            impactFx(s.fx, round, sh, round === 'bullet');
            flash = clock;
            left += knock;
            hp -= round === 'bullet' ? 0.08 : 0.1;
            if (hp < 0.15) hp = 1;
          }),
        );
      }
      if (left > 0.01) {
        const k = Math.min(1, KNOCK_EASE * dt) * left;
        off += k;
        left -= k;
      } else off = Math.max(0, off - dt * 3);
      s.lit = clock - flash < 0.07 ? lit : 0;
      // shoved back away from the shots (which come from down and to the left)
      const [kx, ky] = toScreen(off * 0.7, -off * 0.7, 0);
      const [bx, by] = toScreen(0, 0, 0);
      const r = (v: number) => Math.round(v * ART) / ART;
      s.c.save();
      s.c.translate(r(kx - bx), r(ky - by));
      draw(s, t);
      s.c.restore();
      s.lit = 0;
      healthBar(s.c, Math.round(bar.x - bar.w / 2), Math.round(bar.y), bar.w, hp);
      // a vehicle smokes as its health runs down, as in the game
      if (smokeAt) s.fx.damageSmoke(hp, smokeAt[0], smokeAt[1], dt);
    },
  };
}

interface Fighter {
  kind: UnitKind;
  spr: StackSprite; // for sizing
  still?: Box; // its room standing still, if not just the sprite's
  air?: number;
  soft?: boolean; // a soldier: a smaller bang, smaller pieces
  hullOff?: number; // a tank's hull turned this far from where its turret aims
  draw: (s: Scene, x: number, y: number, a: number, tur: number, t: number, kick: boolean) => void;
  // the sprites it is drawn with at the origin, facing the viewer, and where
  // (world point and height), to blow to pieces
  parts: [StackSprite, number, number, number][];
}

// A unit's fighting cells: firing (if armed), being hit, being destroyed
// (it blows up and flies to pieces, which land and fade away, as in the
// game), and the explosion on its own.
function combatCells(o: Fighter): Cell[] {
  const z = o.air ?? 0;
  const mid = MID[o.kind];
  const still = o.still ?? boxOf(o.spr, 0, 0, z);
  const cells: Cell[] = [];
  const w = WEAPON[o.kind];
  if (w) {
    const far = w.shot === 'arc' ? 24 : 12;
    const [ux, uy] = [-12, -12];
    const ha = A + (o.hullOff ?? 0);
    const moved: Box = { l: still.l, r: still.r, u: still.u + 12, d: still.d - 12 };
    cells.push(attackCell(o.kind, union(moved, { l: 8, r: 8, u: 0, d: far + 6 }), (s, t, kick) => o.draw(s, ux, uy, ha, A, t, kick), () => muzzles(o.kind, ux, uy, z, ha, A), [far, far, 0]));
  }
  const bar = { x: 0, y: -still.u - 3, w: Math.max(10, Math.round((still.l + still.r) * 0.6)) };
  const withBar = union(still, { l: bar.w / 2 + 1, r: bar.w / 2 + 1, u: still.u + 5, d: 0 });
  cells.push(
    // (soldiers are knocked back by rifle fire; tanks by a heavy tank's 105mm shells)
    hitCell(withBar, (s, t) => o.draw(s, 0, 0, A, A, t, false), () => [(Math.random() - 0.5) * 1.6 * HIT_SPREAD[o.kind], (Math.random() - 0.5) * 1.6 * HIT_SPREAD[o.kind], z + mid + (Math.random() - 0.5) * mid * 0.8], o.soft ? 'bullet' : 'shell', bar, 0.45, o.soft ? 0.4 : 0.8, knockback(o.soft ? WEAPON.inf! : WEAPON.heavy!, o.kind), o.soft ? undefined : toScreen(0, 0, z + mid + 2)),
  );
  const r = BOOM[o.kind];
  const boomBox: Box = r ? { l: r * 1.3 + 2, r: r * 1.3 + 2, u: r * 1.6 + z + mid, d: r * 0.6 } : still;
  const L = 1.4 + PIECE_S + (o.soft ? 1.2 : 3.5);
  const HITS = [0.35, 0.75, 1.15];
  // room for the pieces to fly
  const flying: Box = { l: 16, r: 16, u: still.u + 8, d: 8 };
  cells.push({
    label: 'Destroyed',
    box: union(withBar, boomBox, flying),
    anim: true,
    draw: (s, t, dt) => {
      const k = t % L;
      const ev = (e: number) => k >= e && k - dt < e;
      if (k < 1.4) {
        // shot at until it goes
        let n = 0;
        let since = 9;
        for (const e of HITS) {
          if (k >= e) {
            n++;
            since = k - e;
          }
          if (ev(e)) {
            const [sx, sy] = toScreen(0, 0, z + mid);
            if (o.soft) s.fx.dust(sx, sy, 5);
            else {
              s.fx.boom(sx + (Math.random() - 0.5) * 4, sy, 3);
              s.fx.sparks(sx, sy, 6);
            }
          }
        }
        s.lit = since < 0.07 ? 0.45 : 0;
        o.draw(s, 0, 0, A, A, t, false);
        s.lit = 0;
        healthBar(s.c, Math.round(bar.x - bar.w / 2), Math.round(bar.y), bar.w, 1 - n * 0.3);
        if (!o.soft) s.fx.damageSmoke(1 - n * 0.3, ...toScreen(0, 0, z + mid + 2), dt);
        return;
      }
      if (!ev(1.4)) return;
      // gone: a bang, it breaks into a few chunks (a copter's rain down)
      // and smoke pours off where it was
      const [ox, oy] = toScreen(0, 0, z + mid * 0.5);
      s.fx.wreck(
        o.kind,
        o.parts.map(([spr, x, y, h]) => [spr, ...toScreen(x, y, h)]),
        ox,
        oy,
        0,
      );
      const q = QUAKE[o.kind];
      if (q) s.quake(q);
    },
  });
  if (r)
    cells.push({
      label: 'Explosion',
      box: boomBox,
      anim: true,
      draw: (s, t, dt) => {
        if (t % 4 < dt) {
          const [ox, oy] = toScreen(0, 0, z + mid * 0.5);
          s.fx.wreck(o.kind, [], ox, oy, 0);
        }
      },
    });
  return cells;
}

function buildUnits(parent: HTMLElement, me: V2FactionArt, foe: V2FactionArt, yard: V2BuildingArt): void {
  const di = (a: number) => dirIndex(a, DIRS);

  // soldiers: 16 headings, a two-step walk
  for (const kind of ['inf', 'rocket'] as const) {
    const frames = (art: V2FactionArt) => (kind === 'inf' ? art.infantry : art.rocket);
    const draw =
      (art: V2FactionArt): Draw =>
      (s, x, y, a, t, moving) => {
        const fr = moving ? 1 + (Math.floor(t * (moving === 2 ? 4 : 7)) % 2) : 0;
        s.blit(frames(art)[fr][dirIndex(a, 16)], x, y, 0);
      };
    const spr = frames(me)[0][0];
    addRow(
      parent,
      kind === 'inf' ? 'Rifleman' : 'Rocketeer',
      blurbOf(kind),
      unitCells(spr, draw(me), draw(foe), {
        R: 9,
        speed: 9,
        moveLabel: 'Walk around',
        more: [
          { label: 'Idle', box: circleBox(spr, PACE_R), anim: true, draw: pacer(draw(me)) },
          { label: 'Walk', box: boxOf(spr), anim: true, draw: (s, t) => draw(me)(s, 0, 0, Math.PI / 4, t, 1) },
          ...combatCells({
            kind,
            spr,
            soft: true,
            draw: (s, x, y, a, _tur, t) => draw(me)(s, x, y, a, t, 0),
            parts: [[frames(me)[0][dirIndex(A, 16)], 0, 0, 0]],
          }),
        ],
      }),
    );
  }

  // plain vehicles: one sprite each
  const plain = (name: string, kind: 'buggy' | 'arty' | 'hauler' | 'mcv', pick: (a: V2FactionArt) => StackSprite[], R: number, speed: number, more: (draw: Draw) => Cell[] = () => []) => {
    const draw =
      (art: V2FactionArt): Draw =>
      (s, x, y, a) =>
        s.blit(pick(art)[di(a)], x, y, 0);
    const fight = combatCells({
      kind,
      spr: pick(me)[0],
      // (the howitzer rolls back on its tracks as it fires)
      draw: (s, x, y, a, _tur, t, kick) => {
        const back = kind === 'arty' && kick ? 1 : 0;
        s.blit(pick(me)[di(a)], x - Math.cos(a) * back, y - Math.sin(a) * back, 0);
        if (kind === 'buggy') drawBuggyLights(s.c, x, y, 0, a, t);
      },
      parts: [[pick(me)[di(A)], 0, 0, 0]],
    });
    addRow(parent, name, blurbOf(kind), unitCells(pick(me)[0], draw(me), draw(foe), { R, speed, more: [...more(draw(me)), ...fight] }));
  };
  // (turn: the game's turn rate for it, from STATS in v1/game.ts)
  const idleShuffle = (sprs: StackSprite[], turn: number) => (draw: Draw): Cell[] => [
    { label: 'Idle', box: union(...[-0.6, 0, 0.6].map((k) => boxOf(sprs[di(Math.PI / 4 + k)]))), anim: true, draw: shuffler(draw, turn) },
  ];
  // a parked buggy blinks the red light on its aerial every 8 seconds
  plain('Scout buggy', 'buggy', (a) => a.buggy, 16, 34, (draw) => [
    {
      label: 'Idle',
      box: union(boxOf(me.buggy[0]), { l: 6, r: 6, u: 14, d: 6 }),
      anim: true,
      draw: (s, t) => {
        draw(s, 0, 0, Math.PI / 4, t);
        drawBuggyLights(s.c, 0, 0, 0, Math.PI / 4, t);
      },
    },
  ]);

  // tanks: a hull and a turret that turns on its own
  for (const kind of ['light', 'heavy'] as const) {
    const hull = (art: V2FactionArt) => (kind === 'light' ? art.lightTank : art.heavyTank);
    const tur = (art: V2FactionArt) => (kind === 'light' ? art.lightTurret : art.heavyTurret);
    const draw =
      (art: V2FactionArt): Draw =>
      (s, x, y, a, _t, turret) => {
        s.blit(hull(art)[di(a)], x, y, 0);
        const ta = turret === undefined || turret === 1 ? a : turret;
        s.blit(tur(art)[di(ta)], x - Math.cos(a) * 1.2, y - Math.sin(a) * 1.2, 0);
      };
    const spr = union(boxOf(hull(me)[0]), boxOf(tur(me)[0]));
    const cells = unitCells(hull(me)[0], draw(me), draw(foe), {
      R: kind === 'light' ? 16 : 18,
      speed: kind === 'light' ? 20 : 13,
      more: [
        { label: 'Idle', box: spr, anim: true, draw: scanner(draw(me)) },
        {
          label: 'Turret turns',
          box: spr,
          anim: true,
          draw: (s, t) => draw(me)(s, 0, 0, Math.PI / 4, t, Math.PI / 4 + t * 1.4),
        },
        ...combatCells({
          kind,
          spr: hull(me)[0],
          still: spr,
          hullOff: 0.6,
          // the turret kicks back as it fires
          draw: (s, x, y, a, ta, _t, kick) => {
            s.blit(hull(me)[di(a)], x, y, 0);
            const k = kick ? 1 : 0;
            s.blit(tur(me)[di(ta)], x - Math.cos(a) * 1.2 - Math.cos(ta) * k, y - Math.sin(a) * 1.2 - Math.sin(ta) * k, 0);
          },
          parts: [
            [hull(me)[di(A)], 0, 0, 0],
            [tur(me)[di(A)], -Math.cos(A) * 1.2, -Math.sin(A) * 1.2, 0],
          ],
        }),
      ],
    });
    for (const c of cells) c.box = union(c.box, spr);
    addRow(parent, kind === 'light' ? 'Lancer tank' : 'Bastion tank', blurbOf(kind), cells);
  }

  plain('Howler artillery', 'arty', (a) => a.artillery, 18, 13, idleShuffle(me.artillery, 2));

  // the hauler also digs ore, and its bed shows how full it is
  const ore = makeOre();
  plain('Ore hauler', 'hauler', (a) => a.hauler, 18, 13, () => [
    ...['Empty', 'Partly full', 'Full'].map((label, fill) => ({
      label,
      box: boxOf(me.haulerLoad[fill][di(Math.PI / 2)]),
      draw: (s: Scene) => s.blit(me.haulerLoad[fill][di(Math.PI / 2)], 0, 0, 0),
    })),
    {
      label: 'Dig ore',
      box: union(boxOf(me.hauler[0], -6, -6), boxOf(ore.lumps[0][2], 8, 8)),
      anim: true,
      draw: (s, t, dt) => {
        // the clump wears down as it is dug, then grows back
        const k = (t % 6) / 6;
        const size = k < 0.33 ? 2 : k < 0.66 ? 1 : 0;
        s.blit(ore.stain[0][size], 8, 8, 0);
        s.blit(ore.lumps[0][size], 8, 8, 0);
        // and the hauler fills up as it goes
        s.blit(me.haulerLoad[2 - size][di(Math.PI / 4)], -6, -6, 0);
        if (Math.random() < dt * 6) {
          const [sx, sy] = toScreen(8, 8, 2);
          s.puff(sx + (Math.random() - 0.5) * 6, sy, 'dust', { vx: (Math.random() - 0.5) * 6, vy: -4, max: 0.8 });
        }
      },
    },
  ]);

  // the Mobile Foundry deploys: it lines up square, then the yard unfolds
  const deploy: Cell = {
    label: 'Deploy',
    box: union(boxOf(yard.spr), boxOf(me.mcv[0])),
    anim: true,
    draw: (s, t, dt) => {
      const k = t % 6; // turn 1s, rise 1.8s, stand, start again
      if (k < 1.2) {
        const a = Math.PI / 2 * Math.max(0, 1 - k / 1);
        s.blit(me.mcv[di(a)], 0, 0, 0);
        return;
      }
      const rise = Math.min(1, (k - 1.2) / RISE_S);
      if (rise < 1) {
        drawRising(s, yard, rise);
        if (Math.random() < dt * 14) puffSite(s, yard);
      } else s.blit(yard.spr, 0, 0, 0);
    },
  };
  plain('Mobile Foundry', 'mcv', (a) => a.mcv, 22, 10, () => [deploy]);

  // the copter flies at height, with a shadow below and its rotors spinning
  const heliDraw =
    (art: V2FactionArt): Draw =>
    (s, x, y, a, t) => {
      const spr = art.heli[di(a)];
      const z = HELI_ALT + Math.sin(t * 2) * 1.2;
      s.shadow(spr, x + 4, y - 2, 0);
      s.blit(spr, x, y, z);
      const c = s.c;
      const hx = x + Math.cos(a) * 1;
      const hy = y + Math.sin(a) * 1;
      const ra = t * 26;
      c.fillStyle = 'rgba(28,28,28,0.5)';
      for (let b = 0; b < 2; b++) {
        const ang = ra + b * Math.PI * 0.5;
        const [x0, y0] = toScreen(hx - Math.cos(ang) * 12, hy - Math.sin(ang) * 12, z + 8);
        const [x1, y1] = toScreen(hx + Math.cos(ang) * 12, hy + Math.sin(ang) * 12, z + 8);
        pxLine(c, x0, y0, x1, y1);
      }
      const [mx, my] = toScreen(hx, hy, z + 8);
      c.fillStyle = '#222';
      c.fillRect(Math.round(mx), Math.round(my), 1, 1);
      const [tx, ty] = toScreen(x - Math.cos(a) * 13.5, y - Math.sin(a) * 13.5, z + 6.5);
      c.fillStyle = 'rgba(28,28,28,0.45)';
      const sz = Math.floor(t * 20) % 2 ? 2 : 1;
      c.fillRect(Math.round(tx), Math.round(ty) - sz, 1, sz * 2 + 1);
    };
  {
    const spr = me.heli[0];
    const air = union(boxOf(spr, 0, 0, HELI_ALT + 1.5), boxOf(spr, 4, -2, 0), { l: 18, r: 18, u: HELI_ALT + 14, d: 10 });
    const cells: Cell[] = ANGLES.map(({ a, label }) => ({ label, box: air, anim: true, draw: (s, t) => heliDraw(me)(s, 0, 0, a, t) }));
    const R = 20;
    cells.push({
      label: 'Fly',
      box: union(circleBox(spr, R + 4, HELI_ALT + 1.5), { l: R * 1.42 + 18, r: R * 1.42 + 18, u: HELI_ALT + 26, d: R * 0.71 + 10 }),
      anim: true,
      draw: (s, t) => {
        const [x, y, a] = round(t, R, 30);
        heliDraw(me)(s, x, y, a, t);
      },
    });
    cells.push(
      ...combatCells({
        kind: 'heli',
        spr,
        still: air,
        air: HELI_ALT,
        draw: (s, x, y, a, _tur, t) => heliDraw(me)(s, x, y, a, t),
        parts: [[me.heli[di(A)], 0, 0, HELI_ALT]],
      }),
    );
    cells.push({ label: 'Enemy', box: air, anim: true, draw: (s, t) => heliDraw(foe)(s, 0, 0, Math.PI / 4, t) });
    addRow(parent, 'Kestrel copter', blurbOf('heli'), cells);
  }

  // the boat bobs (it only goes on water in the game)
  const boatDraw =
    (art: V2FactionArt): Draw =>
    (s, x, y, a, t) =>
      s.blit(art.boat[di(a)], x, y, Math.sin(t * 2.2) * 0.6);
  {
    const box = union(boxOf(me.boat[0], 0, 0, 1), boxOf(me.boat[0], 0, 0, -1));
    const cells: Cell[] = ANGLES.map(({ a, label }) => ({ label, box, anim: true, draw: (s, t) => boatDraw(me)(s, 0, 0, a, t) }));
    cells.push(
      ...combatCells({
        kind: 'boat',
        spr: me.boat[0],
        still: box,
        draw: (s, x, y, a, _tur, t) => boatDraw(me)(s, x, y, a, t),
        parts: [[me.boat[di(A)], 0, 0, 0]],
      }),
    );
    cells.push({ label: 'Enemy', box, anim: true, draw: (s, t) => boatDraw(foe)(s, 0, 0, Math.PI / 4, t) });
    addRow(parent, 'Patrol boat', 'Patrols the water: it only goes on lakes and seas in the game.', cells);
  }
}

// ---------- Buildings ----------

function drawRising(s: Scene, b: V2BuildingArt, rise: number): void {
  const spr = b.spr;
  const [sx, sy] = toScreen(0, 0, 0);
  const x = Math.round(sx - spr.cx);
  const y = Math.round(sy - spr.cy);
  const W = spr.img.width;
  const H = spr.img.height;
  const top = Math.round(H * (1 - rise));
  s.foot(b.rx, b.ry, '#ffe08a', 0.8);
  if (H - top > 0) s.c.drawImage(spr.img, 0, top, W, H - top, x, y + top / ART, spr.w, (H - top) / ART);
}

function puffSite(s: Scene, b: V2BuildingArt): void {
  const t = Math.random() * 4;
  const k = (t % 1) * 2 - 1;
  const side = Math.floor(t);
  const lx = side < 2 ? (side ? 1 : -1) * b.rx : k * b.rx;
  const ly = side < 2 ? k * b.ry : (side === 3 ? 1 : -1) * b.ry;
  const [sx, sy] = toScreen(lx, ly, 1);
  s.puff(sx, sy, 'dust', { vx: (Math.random() - 0.5) * 8, vy: -3 - Math.random() * 3, max: 1 + Math.random() * 0.8, size: 1.5 });
}

const BUILDINGS: { kind: BuildingKind; name: string; blurb?: string }[] = [
  { kind: 'yard', name: 'Foundry', blurb: 'Where your base starts: builds everything else. Packs up into a Mobile Foundry.' },
  { kind: 'power', name: 'Generator' },
  { kind: 'barracks', name: 'Barracks' },
  { kind: 'refinery', name: 'Ore refinery' },
  { kind: 'silo', name: 'Ore silo' },
  { kind: 'factory', name: 'Vehicle works' },
  { kind: 'radar', name: 'Radar mast' },
  { kind: 'helipad', name: 'Helipad' },
  { kind: 'lab', name: 'Tech lab' },
  { kind: 'tower', name: 'Gun tower' },
  { kind: 'hq', name: 'Command post', blurb: 'The heart of an enemy base.' },
];

// The building's moving parts and smoke, as the game draws them.
function working(s: Scene, kind: BuildingKind, b: V2BuildingArt, fi: number, art: V2FactionArt, dish: StackSprite[], phase: number, dt: number, gun: number): void {
  const c = s.c;
  const f = FACTIONS[fi];
  const fx = (i: number) => toScreen(b.fx[i].x, b.fx[i].y, b.fx[i].z).map(Math.round) as [number, number];
  const emit = (i: number, kind: 'smoke' | 'soot', rate: number) => {
    if (!b.fx[i] || Math.random() > dt * rate) return;
    const [sx, sy] = toScreen(b.fx[i].x, b.fx[i].y, b.fx[i].z);
    s.puff(sx + (Math.random() - 0.5) * 6, sy, kind, { vx: 3 + Math.random() * 3, vy: -7 - Math.random() * 4, max: 2.6 + Math.random(), size: 1.5 });
  };
  const blink = (rate: number) => {
    if (Math.floor(phase * rate) % 2) return;
    const [x, y] = fx(0);
    c.fillStyle = 'rgba(255,90,60,0.35)';
    c.fillRect(x - 1, y - 1, 3, 3);
    c.fillStyle = '#ff7a5c';
    c.fillRect(x, y, 1, 1);
  };
  switch (kind) {
    case 'yard':
      blink(1.2);
      if (b.fx[1] && Math.random() < dt * 1.5) {
        const [sx, sy] = toScreen(b.fx[1].x, b.fx[1].y, b.fx[1].z - 1);
        for (let i = 0; i < 3; i++) s.puff(sx, sy, 'spark', { vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 15, max: 0.5 });
      }
      break;
    case 'hq':
      blink(1.5);
      break;
    case 'lab': {
      const [x, y] = fx(0);
      c.fillStyle = `rgba(160,240,255,${0.25 + 0.2 * Math.sin(phase * 3)})`;
      c.fillRect(x - 3, y - 5, 7, 9);
      break;
    }
    case 'barracks': {
      const [x, y] = fx(0);
      const wave = Math.floor(phase * 5) % 4;
      for (let i = 0; i < 7; i++) {
        const dy = Math.round(Math.sin(i * 0.9 - wave * 1.6) * 0.8);
        c.fillStyle = cssOf(i < 2 ? f.light : i === 6 ? f.dark : f.main);
        c.fillRect(x - 1 - i, y + dy, 1, 4);
      }
      break;
    }
    case 'radar': {
      const p = b.fx[0];
      s.blit(dish[Math.floor(((phase * 0.5) % 1) * 16)], p.x, p.y, p.z - 3);
      break;
    }
    case 'tower': {
      const p = b.fx[0];
      s.blit(art.towerGun[dirIndex(gun, DIRS)], p.x, p.y, p.z);
      break;
    }
    case 'power':
      emit(0, 'smoke', 3);
      emit(1, 'smoke', 3);
      break;
    case 'refinery':
      emit(0, 'soot', 2);
      break;
    case 'factory':
      emit(0, 'smoke', 0.8);
      emit(1, 'smoke', 0.8);
      break;
  }
}

const cssOf = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

function buildingRow(parent: HTMLElement, def: (typeof BUILDINGS)[number], arts: V2FactionArt[], dish: StackSprite[]): void {
  const me = makeBuilding(def.kind, FACTIONS[0]);
  const foe = makeBuilding(def.kind, FACTIONS[1]);
  // room for smoke drifting up off the roof
  const smoky = def.kind === 'power' || def.kind === 'refinery' || def.kind === 'factory';
  const box = union(boxOf(me.spr), smoky ? { ...boxOf(me.spr), u: boxOf(me.spr).u + 12, r: boxOf(me.spr).r + 8 } : boxOf(me.spr));
  const still = (b: V2BuildingArt, fi: number, gun: number) => (s: Scene) => {
    s.blit(b.spr, 0, 0, 0);
    if (def.kind === 'radar') s.blit(dish[2], b.fx[0].x, b.fx[0].y, b.fx[0].z - 3);
    if (def.kind === 'tower') s.blit(arts[fi].towerGun[dirIndex(gun, DIRS)], b.fx[0].x, b.fx[0].y, b.fx[0].z);
  };
  const cells: Cell[] = [];
  if (def.kind === 'tower') {
    // the building is fixed; its gun turns to any of 32 headings
    for (const { a, label } of ANGLES) cells.push({ label: `Gun ${label}`, box, draw: still(me, 0, a) });
  } else cells.push({ label: 'Standing', box, draw: still(me, 0, Math.PI / 4) });
  cells.push({
    label: 'Working',
    box,
    anim: true,
    draw: (s, t, dt) => {
      s.blit(me.spr, 0, 0, 0);
      working(s, def.kind, me, 0, arts[0], dish, t, dt, Math.PI / 4 + Math.sin(t * 0.7) * 2.4);
    },
  });
  cells.push({
    label: 'Going up',
    box,
    anim: true,
    draw: (s, t, dt) => {
      const dur = def.kind === 'yard' ? RISE_S : 1 + (me.rx + me.ry) / 30;
      const k = t % (dur + 2);
      const rise = Math.min(1, k / dur);
      if (rise < 1) {
        drawRising(s, me, rise);
        if (Math.random() < dt * 14) puffSite(s, me);
      } else still(me, 0, Math.PI / 4)(s);
    },
  });
  if (def.kind === 'yard') {
    cells.push({
      label: 'Pack up',
      box: union(box, boxOf(arts[0].mcv[0])),
      anim: true,
      draw: (s, t, dt) => {
        const k = t % 4.4;
        if (k < 1) return s.blit(me.spr, 0, 0, 0);
        const rise = 1 - Math.min(1, (k - 1) / 1.2);
        if (rise > 0) {
          drawRising(s, me, rise);
          if (Math.random() < dt * 12) puffSite(s, me);
        } else s.blit(arts[0].mcv[0], 0, 0, 0);
      },
    });
  }
  cells.push(...buildingFight(def.kind, me, makeBuildingStates(def.kind, FACTIONS[0]), box, still(me, 0, A), arts[0], dish));
  cells.push({ label: 'Enemy', box, draw: still(foe, 1, Math.PI / 4) });
  const t = TECH.find((x) => x.building === def.kind);
  addRow(parent, def.name, def.blurb ?? (t ? `${t.blurb} ${t.cost} credits.` : ''), cells, true);
}

// A building's fighting cells: a gun tower firing; being hit (shells
// bursting on it, a flash, its health running down); badly damaged (holed,
// scorched and on fire); being destroyed (hit until it is damaged, hit until
// it goes up in a string of explosions, then the ruin); and the ruin, which
// in the game stays for good.
function buildingFight(kind: BuildingKind, b: V2BuildingArt, st: BuildingStates, box: Box, draw: (s: Scene) => void, art: V2FactionArt, dish: StackSprite[]): Cell[] {
  const cells: Cell[] = [];
  const spr = b.spr;
  const bb = boundsOf(spr);
  const top = bb.y0 - spr.cy;
  // a random point on the building's front, for a round to land on (as a
  // world point at height 8 that is drawn there)
  const spot = (): [number, number, number] => {
    const sx = bb.x0 - spr.cx + (bb.x1 - bb.x0) * (0.2 + Math.random() * 0.6);
    const sy = bb.y0 - spr.cy + (bb.y1 - bb.y0) * (0.3 + Math.random() * 0.45);
    const [wx, wy] = toWorld(sx, sy, 8);
    return [wx, wy, 8];
  };
  const bw = Math.max(16, Math.round((b.rx + b.ry) * 1.1));
  const bar = { x: 0, y: Math.min(top, -8) - 5, w: bw };
  const withBar = union(box, { l: bw / 2 + 1, r: bw / 2 + 1, u: -bar.y + 2, d: 0 });
  const gun = (s: Scene, a: number) => {
    if (kind === 'tower') s.blit(art.towerGun[dirIndex(a, DIRS)], b.fx[0].x, b.fx[0].y, b.fx[0].z);
    if (kind === 'radar') s.blit(dish[2], b.fx[0].x, b.fx[0].y, b.fx[0].z - 3);
  };
  const flames = (s: Scene, pts: V2BuildingArt['fx'], t: number, dt: number, h: number) => {
    for (const [i, p] of pts.entries()) {
      const [sx, sy] = toScreen(p.x, p.y, p.z);
      drawFlame(s.c, sx, sy, h, t + i * 0.37, i + 11);
      if (Math.random() < dt * 2.5) s.fx.smoke(sx, sy - 3, true, 1.5);
    }
  };
  if (kind === 'tower') {
    const w = WEAPON.tower!;
    const p = b.fx[0];
    const far = 20;
    cells.push(
      attackCell('tower', union(box, { l: 8, r: 8, u: 0, d: far + 6 }), (s, t, kick) => {
        s.blit(spr, 0, 0, 0);
        const k = kick ? 0.8 : 0;
        s.blit(art.towerGun[dirIndex(A, DIRS)], p.x - Math.cos(A) * k, p.y - Math.sin(A) * k, p.z);
        void t;
      }, () => muzzles('tower', p.x, p.y, p.z, 0, A), [far, far, 0]),
    );
    void w;
  }
  cells.push(hitCell(withBar, (s) => draw(s), spot, 'shell', bar, 0.22, 0.55));
  cells.push({
    label: 'Damaged',
    box,
    anim: true,
    draw: (s, t, dt) => {
      s.blit(st.damaged.spr, 0, 0, 0);
      gun(s, A + Math.sin(t * 0.7) * 1.2);
      flames(s, st.damaged.fx, t, dt, 3.5);
    },
  });
  const L = 12;
  const n = 4 + Math.round((b.rx + b.ry) / 6);
  cells.push({
    label: 'Destroyed',
    box: withBar,
    anim: true,
    draw: (s, t, dt) => {
      const k = t % L;
      if (k < 4) {
        // hit and hit again: damaged at half health, then gone
        const i = Math.floor((k - 0.1) / 0.4);
        const hitNow = k >= 0.1 && i !== Math.floor((k - dt - 0.1) / 0.4);
        let flash = false;
        if (hitNow) {
          const [x, y, z] = spot();
          const [sx, sy] = toScreen(x, y, z);
          s.fx.boom(sx, sy, 3.5);
          s.fx.sparks(sx, sy, 6);
          flash = true;
        }
        const hp = Math.max(0.05, 1 - (k / 4) * 0.95);
        s.lit = flash || (k - 0.1) % 0.4 < 0.07 ? 0.22 : 0;
        s.blit(hp <= DAMAGED ? st.damaged.spr : spr, 0, 0, 0);
        s.lit = 0;
        gun(s, A);
        if (hp <= DAMAGED) flames(s, st.damaged.fx, t, dt, hp < 0.25 ? 5 : 3.5);
        healthBar(s.c, Math.round(bar.x - bar.w / 2), Math.round(bar.y), bar.w, hp);
        return;
      }
      if (k - dt < 4) {
        for (let j = 0; j < n; j++) {
          const [sx, sy] = toScreen((Math.random() * 2 - 1) * b.rx * 0.8, (Math.random() * 2 - 1) * b.ry * 0.8, 2 + Math.random() * 12);
          s.fx.boom(sx, sy, 5 + Math.random() * 5, j * 0.12);
        }
        s.fx.boom(...toScreen(0, 0, 8), (b.rx + b.ry) * 0.45, 0.4);
      }
      if (k < 4.45) {
        s.blit(st.damaged.spr, 0, 0, 0);
        return;
      }
      // the big bang: the building flies to pieces over its ruin
      if (k - dt < 4.45) {
        s.fx.collapse(st.damaged.spr, 0, 0, ...toScreen(0, 0, 10), b.rx + b.ry, (b.rx + b.ry) * 0.5);
        s.quake(buildingQuake(b.rx, b.ry));
      }
      s.blit(st.ruin.spr, 0, 0, 0);
      const since = k - 4.45;
      if (since < 6) flames(s, st.ruin.fx, t, dt, 4 * (1 - since / 7));
      else for (const p of st.ruin.fx) if (Math.random() < dt * 1.5) s.fx.smoke(...toScreen(p.x, p.y, p.z + 1), true, 2);
    },
  });
  cells.push({
    label: 'Ruin',
    box,
    anim: true,
    draw: (s, _t, dt) => {
      s.blit(st.ruin.spr, 0, 0, 0);
      for (const p of st.ruin.fx) if (Math.random() < dt * 0.6) s.fx.smoke(...toScreen(p.x, p.y, p.z + 1), true, 2);
    },
  });
  return cells;
}

function pxLine(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

// ---------- Start ----------

const status = document.querySelector<HTMLParagraphElement>('#status')!;
const later = () => new Promise<void>((r) => setTimeout(r, 0));

async function main(): Promise<void> {
  await later(); // let "Drawing…" show first
  grass = makeGrass();
  const arts = FACTIONS.map(makeFactionArt);
  const dish = makeDish();
  const yard = makeBuilding('yard', FACTIONS[0]);
  buildUnits(document.querySelector('#unitRows')!, arts[0], arts[1], yard);
  const rows = document.querySelector<HTMLDivElement>('#buildingRows')!;
  for (const def of BUILDINGS) {
    await later();
    buildingRow(rows, def, arts, dish);
  }
  status.hidden = true;
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const l of live) {
    if (!l.seen) continue;
    l.t += dt;
    paint(l, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
main();
