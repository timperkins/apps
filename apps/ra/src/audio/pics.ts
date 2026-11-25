// The little moving pictures on the Audio page: a unit drawn with the game's
// own sprites (src/v2/sprites.ts), swinging slowly from side to side
// (soldiers and the dog marching on the spot, aircraft hovering), or a
// building's build-menu picture. A unit's headings are drawn by the game's
// art workers (src/v2/art-pool.ts), and only once its card scrolls into view.

import { ART, dirIndex } from '../gfx';
import { DIRS, FACTIONS, makeFactionArt, type V2FactionArt } from '../v2/sprites';
import { drawSprite, toScreen, type StackSprite } from '../v2/stack';
import { startArtPool } from '../v2/art-pool';
import { type Pic, UNIT_NAME, type UnitKind } from './data';

startArtPool();

// (this page is one folder down from the game's root)
export const ROOT = `${import.meta.env.BASE_URL}../`.replace(/^\/\.\.\/$/, '/');

let art: V2FactionArt | null = null;
const getArt = (): V2FactionArt => (art ??= makeFactionArt(FACTIONS[0]));

type Part = { spr: StackSprite; dx?: number; dy?: number; z?: number; shadow?: boolean };

const FOOT: Partial<Record<UnitKind, (a: V2FactionArt) => StackSprite[][]>> = {
  inf: (a) => a.infantry,
  rocket: (a) => a.rocket,
  gren: (a) => a.gren,
  eng: (a) => a.eng,
  cmdo: (a) => a.cmdo,
  flamer: (a) => a.flamer,
  dog: (a) => a.dog,
};
const TANK: Partial<Record<UnitKind, (a: V2FactionArt) => [StackSprite[], StackSprite[]]>> = {
  light: (a) => [a.lightTank, a.lightTurret],
  heavy: (a) => [a.heavyTank, a.heavyTurret],
  scorch: (a) => [a.scorchTank, a.scorchTurret],
  lumen: (a) => [a.lumenTank, a.lumenTurret],
  skyguard: (a) => [a.skyguardTank, a.skyguardTurret],
};
const PLAIN: Partial<Record<UnitKind, (a: V2FactionArt) => StackSprite[]>> = {
  buggy: (a) => a.buggy,
  apc: (a) => a.apc,
  arty: (a) => a.artillery,
  comet: (a) => a.comet,
  mcv: (a) => a.mcv,
  hauler: (a) => a.hauler,
  boat: (a) => a.boat,
  otter: (a) => a.otter,
  destroyer: (a) => a.destroyer,
  cruiser: (a) => a.cruiser,
  carrier: (a) => a.carrier,
  sub: (a) => a.sub,
};
const AIR: Partial<Record<UnitKind, (a: V2FactionArt) => StackSprite[]>> = {
  heli: (a) => a.heli,
  heron: (a) => a.heron,
  jet: (a) => a.jet,
  plane: (a) => a.plane,
};
const ALT = 10; // how high aircraft hover in the picture
const FACE = Math.PI / 4; // facing the viewer
const SWING = 0.5; // and turning this far (radians) either way

// What to draw for unit k facing a, t seconds in.
function parts(k: UnitKind, a: number, t: number): Part[] {
  const A = getArt();
  const foot = FOOT[k];
  if (foot) {
    const fr = [1, 0, 2, 0][Math.floor(t * 6) % 4];
    return [{ spr: foot(A)[fr][dirIndex(a, 16)] }];
  }
  const tank = TANK[k];
  if (tank) {
    const [hull, tur] = tank(A);
    return [{ spr: hull[dirIndex(a, DIRS)] }, { spr: tur[dirIndex(a, DIRS)], dx: -Math.cos(a) * 1.2, dy: -Math.sin(a) * 1.2 }];
  }
  const plain = PLAIN[k];
  if (plain) return [{ spr: plain(A)[dirIndex(a, DIRS)] }];
  const air = AIR[k]!(A)[dirIndex(a, DIRS)];
  return [{ spr: air, z: ALT + Math.sin(t * 2) * 1.2, shadow: true }];
}

// The box (map pixels, around the unit's ground point) that holds it at every angle.
const boxes = new Map<UnitKind, { l: number; r: number; u: number; d: number }>();
function boxOf(k: UnitKind) {
  let b = boxes.get(k);
  if (!b) {
    b = { l: 0, r: 0, u: 0, d: 0 };
    for (const da of [-SWING, 0, SWING])
      for (const p of parts(k, FACE + da, 0)) {
        const [sx, sy] = toScreen(p.dx ?? 0, p.dy ?? 0, p.z ?? 0);
        b.l = Math.max(b.l, p.spr.cx - sx);
        b.r = Math.max(b.r, p.spr.w - p.spr.cx + sx);
        b.u = Math.max(b.u, p.spr.cy - sy);
        b.d = Math.max(b.d, p.spr.h - p.spr.cy + sy + (p.shadow ? (p.z ?? 0) + 2 : 0));
      }
    boxes.set(k, b);
  }
  return b;
}

interface Live {
  cv: HTMLCanvasElement;
  c: CanvasRenderingContext2D | null; // set once it has first been in view
  k: UnitKind;
  ox: number;
  oy: number;
  t: number;
  seen: boolean;
}
const live: Live[] = [];
const io = new IntersectionObserver(
  (es) => {
    for (const e of es) {
      const l = live.find((x) => x.cv === e.target);
      if (!l) continue;
      l.seen = e.isIntersecting;
      if (l.seen && !l.c) setUp(l);
    }
  },
  { rootMargin: '200px' },
);

function setUp(l: Live): void {
  const b = boxOf(l.k);
  const w = Math.ceil(b.l + b.r) + 2;
  const h = Math.ceil(b.u + b.d) + 2;
  l.cv.width = w * ART;
  l.cv.height = h * ART;
  l.cv.style.setProperty('--w', String(w));
  l.cv.style.setProperty('--h', String(h));
  l.ox = b.l + 1;
  l.oy = b.u + 1;
  l.c = l.cv.getContext('2d')!;
}

function paint(l: Live): void {
  const { c } = l;
  if (!c) return;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, l.cv.width, l.cv.height);
  c.setTransform(ART, 0, 0, ART, l.ox * ART, l.oy * ART);
  c.imageSmoothingEnabled = false;
  const a = FACE + SWING * Math.sin(l.t * 0.8);
  for (const p of parts(l.k, a, l.t)) {
    if (p.shadow && p.spr.shadow) {
      const [sx, sy] = toScreen((p.dx ?? 0) + 3, (p.dy ?? 0) - 1, 0);
      drawSprite(c, p.spr.shadow, p.spr, sx, sy);
    }
    const [sx, sy] = toScreen(p.dx ?? 0, p.dy ?? 0, p.z ?? 0);
    drawSprite(c, p.spr.img, p.spr, sx, sy);
  }
}

/** A picture for pic, sized to sit in a row (CSS sets its height). */
export function picture(pic: Pic): HTMLElement {
  if ('cameo' in pic) {
    const img = document.createElement('img');
    img.className = 'pic cameo';
    img.src = `${ROOT}cameos/${pic.cameo}.png`;
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }
  const cv = document.createElement('canvas');
  cv.className = 'pic unit';
  cv.width = cv.height = 1;
  cv.title = UNIT_NAME[pic.unit];
  live.push({ cv, c: null, k: pic.unit, ox: 0, oy: 0, t: Math.random() * 10, seen: false });
  io.observe(cv);
  return cv;
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const l of live)
    if (l.seen) {
      l.t += dt;
      paint(l);
    }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
