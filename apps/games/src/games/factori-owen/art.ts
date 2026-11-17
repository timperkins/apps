// Procedural drawings for buildings, trees and the player. All coordinates are in tiles.
import { ENTITIES, footprint, type EntityType } from './data';
import { gear, owenO } from './icons';

type Ctx = CanvasRenderingContext2D;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface Look {
  dir: number;
  working: boolean;
  anim: number; // grows while working
  time: number; // seconds, for idle animation
  t?: number;   // inserter swing 0..1
  curve?: number;
  noPower?: boolean;
  noFuel?: boolean;
  /** underground belt: this one is the exit */
  ugOut?: boolean;
}

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function shadow(c: Ctx, x: number, y: number, w: number, h: number) {
  c.fillStyle = 'rgba(0,0,0,.28)';
  rr(c, x + 0.12, y + 0.16, w - 0.06, h - 0.08, 0.2);
  c.fill();
}

function box(c: Ctx, x: number, y: number, w: number, h: number, body: string, top: string, edge: string) {
  shadow(c, x, y, w, h);
  c.fillStyle = edge;
  rr(c, x + 0.06, y + 0.08, w - 0.12, h - 0.1, 0.14);
  c.fill();
  c.fillStyle = body;
  rr(c, x + 0.06, y + 0.04, w - 0.12, h - 0.16, 0.14);
  c.fill();
  c.fillStyle = top;
  rr(c, x + 0.14, y + 0.1, w - 0.28, h - 0.32, 0.1);
  c.fill();
}

function arrow(c: Ctx, cx: number, cy: number, dir: number, s: number, col: string) {
  c.save();
  c.translate(cx, cy);
  c.rotate((dir * Math.PI) / 2);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0, -s);
  c.lineTo(s * 0.8, s * 0.2);
  c.lineTo(s * 0.3, s * 0.2);
  c.lineTo(s * 0.3, s * 0.8);
  c.lineTo(-s * 0.3, s * 0.8);
  c.lineTo(-s * 0.3, s * 0.2);
  c.lineTo(-s * 0.8, s * 0.2);
  c.closePath();
  c.fill();
  c.restore();
}

const BELT_COLORS: Record<string, [string, string, string]> = {
  'belt': ['#2c3138', '#4b5561', '#3fc1b0'],
  'fast-belt': ['#2c2a30', '#5a4d55', '#f08a3c'],
  'express-belt': ['#262833', '#4d5a72', '#4fa3ff'],
};

export function drawBelt(c: Ctx, type: EntityType, x: number, y: number, l: Look) {
  drawBeltBase(c, type, x, y, l);
  if (ENTITIES[type].ug) {
    // a hood over the end where items dive under (entrance) or come up (exit)
    c.save();
    c.translate(x + 0.5, y + 0.5);
    c.rotate((l.dir * Math.PI) / 2);
    const top = l.ugOut ? 0.5 : -0.5; // forward is -y
    const y0 = l.ugOut ? 0 : -0.5;
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.fillRect(-0.5, y0 + 0.06, 1, 0.5);
    c.fillStyle = '#5b6573';
    c.fillRect(-0.5, y0, 1, 0.5);
    c.fillStyle = '#3fc1b0';
    c.fillRect(-0.5, y0, 1, 0.08);
    c.fillStyle = '#1b1f25';
    c.fillRect(-0.36, l.ugOut ? 0.0 : 0.0 - 0.08, 0.72, 0.08);
    arrowDir(c, 0, top * 0.5, 0.14, l.ugOut ? '#ffd23f' : '#e8eef7');
    c.restore();
  }
}

function arrowDir(c: Ctx, cx: number, cy: number, s: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(cx, cy - s);
  c.lineTo(cx + s, cy + s * 0.6);
  c.lineTo(cx - s, cy + s * 0.6);
  c.closePath();
  c.fill();
}

function drawBeltBase(c: Ctx, type: EntityType, x: number, y: number, l: Look) {
  const [base, rail, chev] = BELT_COLORS[type] ?? BELT_COLORS['belt'];
  const speed = (ENTITIES[type].speed ?? 1.875) / 1.875;
  const off = ((l.time * 1.875 * speed) % 0.5 + 0.5) % 0.5;
  c.save();
  c.translate(x + 0.5, y + 0.5);
  if (l.curve === undefined || l.curve < 0) {
    c.rotate((l.dir * Math.PI) / 2);
    c.fillStyle = base;
    c.fillRect(-0.4, -0.5, 0.8, 1);
    c.fillStyle = rail;
    c.fillRect(-0.47, -0.5, 0.1, 1);
    c.fillRect(0.37, -0.5, 0.1, 1);
    c.strokeStyle = chev;
    c.lineWidth = 0.07;
    c.globalAlpha = 0.75;
    c.beginPath();
    for (let k = -1; k < 2; k++) {
      const yy = 0.5 - off - k * 0.5;
      c.moveTo(-0.22, yy);
      c.lineTo(0, yy - 0.16);
      c.lineTo(0.22, yy);
    }
    c.save();
    c.beginPath();
    c.rect(-0.4, -0.5, 0.8, 1);
    c.clip();
    c.beginPath();
    for (let k = -1; k < 3; k++) {
      const yy = 0.5 - off - k * 0.5 + 0.1;
      c.moveTo(-0.22, yy);
      c.lineTo(0, yy - 0.16);
      c.lineTo(0.22, yy);
    }
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  } else {
    // a turn: items arrive travelling in direction `inDir`, leave in `dir`
    const inDir = (l.curve + 2) % 4;
    const cx = -DX[inDir] * 0.5 + DX[l.dir] * 0.5;
    const cy = -DY[inDir] * 0.5 + DY[l.dir] * 0.5;
    const a0 = Math.atan2(-DY[l.dir], -DX[l.dir]);
    const a1 = Math.atan2(DY[inDir], DX[inDir]);
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const ccw = da < 0;
    c.save();
    c.beginPath();
    c.rect(-0.5, -0.5, 1, 1);
    c.clip();
    c.lineWidth = 0.8;
    c.strokeStyle = base;
    c.beginPath();
    c.arc(cx, cy, 0.5, a0, a1, ccw);
    c.stroke();
    c.lineWidth = 0.1;
    c.strokeStyle = rail;
    for (const r of [0.08, 0.92]) {
      c.beginPath();
      c.arc(cx, cy, r, a0, a1, ccw);
      c.stroke();
    }
    c.strokeStyle = chev;
    c.globalAlpha = 0.75;
    c.lineWidth = 0.07;
    for (let k = 0; k < 2; k++) {
      const f = (k * 0.5 + off) % 1;
      const a = a0 + da * f;
      const px = cx + Math.cos(a) * 0.5, py = cy + Math.sin(a) * 0.5;
      c.save();
      c.translate(px, py);
      c.rotate(a + (ccw ? -Math.PI / 2 : Math.PI / 2) - Math.PI / 2);
      c.beginPath();
      c.moveTo(-0.22, 0.08);
      c.lineTo(0, -0.08);
      c.lineTo(0.22, 0.08);
      c.stroke();
      c.restore();
    }
    c.restore();
    c.globalAlpha = 1;
  }
  c.restore();
}

/** Position of an item on a belt, in tile coordinates. */
export function beltItemPos(x: number, y: number, dir: number, curve: number, pos: number): [number, number] {
  const mx = x + 0.5, my = y + 0.5;
  if (curve < 0 || pos >= 0.999) return [mx + DX[dir] * (pos - 0.5), my + DY[dir] * (pos - 0.5)];
  const inDir = (curve + 2) % 4;
  const cx = mx - DX[inDir] * 0.5 + DX[dir] * 0.5;
  const cy = my - DY[inDir] * 0.5 + DY[dir] * 0.5;
  const th = (pos * Math.PI) / 2;
  return [
    cx - DX[dir] * 0.5 * Math.cos(th) + DX[inDir] * 0.5 * Math.sin(th),
    cy - DY[dir] * 0.5 * Math.cos(th) + DY[inDir] * 0.5 * Math.sin(th),
  ];
}

const ARM_COLORS: Record<string, string> = {
  'burner-inserter': '#a8673a',
  'inserter': '#e3b341',
  'long-inserter': '#8f6cd8',
  'fast-inserter': '#e0573c',
};

export function inserterBase(c: Ctx, type: EntityType, x: number, y: number, l: Look) {
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.arc(x + 0.55, y + 0.58, 0.32, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4a515c';
  rr(c, x + 0.18, y + 0.18, 0.64, 0.64, 0.12);
  c.fill();
  c.fillStyle = ARM_COLORS[type] ?? '#e3b341';
  c.beginPath();
  c.arc(x + 0.5, y + 0.5, 0.18, 0, Math.PI * 2);
  c.fill();
  arrow(c, x + 0.5, y + 0.5, l.dir, 0.1, 'rgba(255,255,255,.7)');
}

/** Hand position for an inserter swing (t: 0 = at pickup, 1 = at drop). */
export function inserterHand(x: number, y: number, dir: number, reach: number, t: number): [number, number] {
  const back = (dir + 2) % 4;
  const a0 = Math.atan2(DY[back], DX[back]);
  const a = a0 + t * Math.PI;
  const r = reach * 0.82;
  return [x + 0.5 + Math.cos(a) * r, y + 0.5 + Math.sin(a) * r];
}

export function inserterArm(c: Ctx, type: EntityType, x: number, y: number, l: Look, reach: number) {
  const [hx, hy] = inserterHand(x, y, l.dir, reach, l.t ?? 0);
  const col = ARM_COLORS[type] ?? '#e3b341';
  const mx = (x + 0.5 + hx) / 2, my = (y + 0.5 + hy) / 2;
  // elbow lifted a little for a 3D feel
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(0,0,0,.25)';
  c.lineWidth = 0.12;
  c.beginPath();
  c.moveTo(x + 0.55, y + 0.6);
  c.lineTo(hx + 0.05, hy + 0.1);
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = 0.11;
  c.beginPath();
  c.moveTo(x + 0.5, y + 0.5);
  c.lineTo(mx, my - 0.12);
  c.lineTo(hx, hy);
  c.stroke();
  c.fillStyle = '#2b2f36';
  c.beginPath();
  c.arc(hx, hy, 0.09, 0, Math.PI * 2);
  c.fill();
}

function statusBadge(c: Ctx, x: number, y: number, w: number, l: Look) {
  if (!l.noPower && !l.noFuel) return;
  if (Math.floor(l.time * 2) % 2) return;
  const cx = x + w / 2, cy = y + 0.45;
  c.fillStyle = 'rgba(20,20,24,.75)';
  c.beginPath();
  c.arc(cx, cy, 0.28, 0, Math.PI * 2);
  c.fill();
  if (l.noPower) {
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.moveTo(cx + 0.05, cy - 0.2);
    c.lineTo(cx - 0.12, cy + 0.03);
    c.lineTo(cx, cy + 0.03);
    c.lineTo(cx - 0.05, cy + 0.2);
    c.lineTo(cx + 0.12, cy - 0.03);
    c.lineTo(cx, cy - 0.03);
    c.closePath();
    c.fill();
  } else {
    c.fillStyle = '#ff7a2f';
    c.beginPath();
    c.moveTo(cx, cy - 0.2);
    c.quadraticCurveTo(cx + 0.18, cy, cx + 0.1, cy + 0.15);
    c.quadraticCurveTo(cx, cy + 0.22, cx - 0.1, cy + 0.15);
    c.quadraticCurveTo(cx - 0.18, cy, cx, cy - 0.2);
    c.fill();
  }
}

/**
 * Size each building's drawing was made at. Buildings now fill one tile, so these are drawn at
 * this size and shrunk to fit.
 */
const ART_SIZE: Partial<Record<EntityType, number>> = {
  'burner-drill': 2, 'electric-drill': 3, 'stone-furnace': 2, 'steel-furnace': 2, 'electric-furnace': 3,
  'assembler': 3, 'assembler-2': 3, 'lab': 3, 'generator': 3, 'solar-panel': 3, 'owen-monument': 5,
  'gun-turret': 2, 'rail-turret': 3, 'battery-bank': 2,
};
export function artSize(type: EntityType): number {
  return ART_SIZE[type] ?? 1;
}

export function drawBuilding(c: Ctx, type: EntityType, x: number, y: number, l: Look) {
  const s = artSize(type);
  if (s === 1) {
    const [w, h] = footprint(type, l.dir);
    drawBuildingAt(c, type, x, y, l, w, h);
    return;
  }
  c.save();
  c.translate(x, y);
  c.scale(1 / s, 1 / s);
  drawBuildingAt(c, type, 0, 0, l, s, s);
  c.restore();
}

function drawBuildingAt(c: Ctx, type: EntityType, x: number, y: number, l: Look, w: number, h: number) {
  const d = ENTITIES[type];
  switch (d.kind) {
    case 'chest': {
      const [body, top, edge] = type === 'wooden-chest'
        ? ['#9a6a3c', '#b98450', '#5f3e20']
        : type === 'owen-chest' ? ['#6f82c8', '#93a5e6', '#3b4a85'] : ['#8d939e', '#b9bec8', '#4e535c'];
      box(c, x, y, w, h, body, top, edge);
      c.strokeStyle = edge;
      c.lineWidth = 0.05;
      c.beginPath();
      c.moveTo(x + 0.14, y + 0.4);
      c.lineTo(x + 0.86, y + 0.4);
      c.stroke();
      if (type !== 'wooden-chest') owenO(c, x + 0.5, y + 0.56, 0.08, edge);
      else {
        c.fillStyle = '#e8c37a';
        c.fillRect(x + 0.44, y + 0.36, 0.12, 0.1);
      }
      break;
    }
    case 'drill': {
      const electric = type === 'electric-drill';
      box(c, x, y, w, h, electric ? '#4e6a9a' : '#7b6a58', electric ? '#6d8cc2' : '#9a8a76', electric ? '#2c3d5c' : '#4b3e31');
      const cx = x + w / 2, cy = y + h / 2 - 0.08;
      c.fillStyle = '#2b2f36';
      c.beginPath();
      c.arc(cx, cy, w * 0.27, 0, Math.PI * 2);
      c.fill();
      gear(c, cx, cy, w * 0.23, 6, l.anim * 0.15, electric ? '#c8d4ee' : '#c9b79c', '#2b2f36');
      if (!electric && l.working) {
        c.fillStyle = `rgba(255,${120 + Math.sin(l.time * 20) * 40},40,.8)`;
        c.fillRect(x + 0.2, y + h - 0.42, 0.3, 0.1);
      }
      // output chute
      const ox = DX[l.dir], oy = DY[l.dir];
      arrow(c, cx + ox * (w / 2 - 0.12), cy + 0.08 + oy * (h / 2 - 0.12), l.dir, 0.16, '#ffd23f');
      break;
    }
    case 'furnace': {
      if (w !== 2) {
        // bigger furnaces are the same drawing, scaled up
        c.save();
        c.translate(x, y);
        c.scale(w / 2, h / 2);
        drawBuildingAt(c, 'steel-furnace', 0, 0, { ...l, noPower: false, noFuel: false }, 2, 2);
        c.restore();
        c.fillStyle = '#5adcff';
        c.fillRect(x + 0.4, y + 0.3, w - 0.8, 0.12);
        break;
      }
      const [fb, ft, fe] = type === 'stone-furnace' ? ['#8f8173', '#b2a493', '#574c41'] : ['#7d8592', '#a4acb8', '#454b55'];
      box(c, x, y, w, h, fb, ft, fe);
      c.fillStyle = '#2a2420';
      rr(c, x + 0.6, y + 0.95, 0.8, 0.55, 0.25);
      c.fill();
      if (l.working) {
        const f = 0.6 + Math.sin(l.time * 13) * 0.2;
        const g = c.createRadialGradient(x + 1, y + 1.3, 0.05, x + 1, y + 1.3, 0.5);
        g.addColorStop(0, `rgba(255,220,120,${f})`);
        g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g;
        c.fillRect(x + 0.5, y + 0.8, 1, 0.8);
      }
      c.fillStyle = '#6d6155';
      for (let i = 0; i < 3; i++) c.fillRect(x + 0.35 + i * 0.5, y + 0.3, 0.3, 0.12);
      break;
    }
    case 'assembler': {
      if (type === 'assembler-2') box(c, x, y, w, h, '#5d6f58', '#7e9a76', '#33452f');
      else box(c, x, y, w, h, '#5b6c7d', '#7d90a3', '#33404d');
      c.fillStyle = '#2b3440';
      rr(c, x + 0.7, y + 0.6, 1.6, 1.5, 0.2);
      c.fill();
      gear(c, x + 1.3, y + 1.25, 0.45, 8, l.anim * 0.06, '#c3cfdc', '#2b3440');
      gear(c, x + 1.85, y + 1.6, 0.3, 6, -l.anim * 0.09, '#e3b341', '#2b3440');
      c.fillStyle = '#e3b341';
      for (let i = 0; i < 5; i++) c.fillRect(x + 0.35 + i * 0.5, y + 2.45, 0.3, 0.1);
      break;
    }
    case 'lab': {
      box(c, x, y, w, h, '#4d5b6e', '#6b7d93', '#2b3542');
      const cx = x + 1.5, cy = y + 1.35;
      const glow = l.working ? 0.55 + Math.sin(l.time * 4) * 0.25 : 0.15;
      const g = c.createRadialGradient(cx, cy, 0.1, cx, cy, 1);
      g.addColorStop(0, `rgba(140,230,255,${glow})`);
      g.addColorStop(1, 'rgba(60,140,220,0.05)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, 0.9, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(220,240,255,.7)';
      c.lineWidth = 0.05;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.5)';
      c.beginPath();
      c.ellipse(cx, cy, 0.6, 0.25, l.anim * 0.04, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(cx, cy, 0.12, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'pole': {
      if (type === 'big-pole') {
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.beginPath();
        c.ellipse(x + 0.6, y + 0.9, 0.3, 0.1, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#8d939e';
        c.lineWidth = 0.07;
        c.beginPath();
        c.moveTo(x + 0.25, y + 0.9); c.lineTo(x + 0.45, y - 0.6);
        c.moveTo(x + 0.75, y + 0.9); c.lineTo(x + 0.55, y - 0.6);
        for (let k = 0; k < 4; k++) {
          const yy = y + 0.9 - k * 0.37;
          c.moveTo(x + 0.27 + k * 0.05, yy); c.lineTo(x + 0.68 - k * 0.04, yy - 0.37);
        }
        c.stroke();
        c.fillStyle = '#5c626d';
        c.fillRect(x + 0.1, y - 0.66, 0.8, 0.14);
        c.fillStyle = '#d8dde6';
        c.fillRect(x + 0.14, y - 0.72, 0.1, 0.08);
        c.fillRect(x + 0.76, y - 0.72, 0.1, 0.08);
        break;
      }
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath();
      c.ellipse(x + 0.6, y + 0.85, 0.18, 0.08, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7a5232';
      c.fillRect(x + 0.42, y - 0.6, 0.16, 1.4);
      c.fillStyle = '#5c3c22';
      c.fillRect(x + 0.18, y - 0.55, 0.64, 0.12);
      c.fillStyle = '#d8dde6';
      c.fillRect(x + 0.18, y - 0.62, 0.08, 0.08);
      c.fillRect(x + 0.74, y - 0.62, 0.08, 0.08);
      break;
    }
    case 'generator': {
      box(c, x, y, w, h, '#6b5a4b', '#8b7865', '#3e3329');
      c.fillStyle = '#3a312a';
      c.fillRect(x + 2.1, y + 0.25, 0.5, 0.9);
      c.fillStyle = '#2a2420';
      c.beginPath();
      c.arc(x + 1.2, y + 1.4, 0.65, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#c9b79c';
      c.lineWidth = 0.1;
      c.beginPath();
      c.arc(x + 1.2, y + 1.4, 0.5, 0, Math.PI * 2);
      c.stroke();
      const a = l.anim * 0.2;
      c.beginPath();
      c.moveTo(x + 1.2 + Math.cos(a) * 0.5, y + 1.4 + Math.sin(a) * 0.5);
      c.lineTo(x + 1.2 - Math.cos(a) * 0.5, y + 1.4 - Math.sin(a) * 0.5);
      c.moveTo(x + 1.2 + Math.cos(a + 1.57) * 0.5, y + 1.4 + Math.sin(a + 1.57) * 0.5);
      c.lineTo(x + 1.2 - Math.cos(a + 1.57) * 0.5, y + 1.4 - Math.sin(a + 1.57) * 0.5);
      c.stroke();
      if (l.working) {
        for (let i = 0; i < 3; i++) {
          const p = (l.time * 0.6 + i / 3) % 1;
          c.fillStyle = `rgba(200,200,205,${0.5 * (1 - p)})`;
          c.beginPath();
          c.arc(x + 2.35 + p * 0.4, y + 0.2 - p * 1.4, 0.18 + p * 0.3, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.fillStyle = l.working ? '#ffd23f' : '#555';
      c.beginPath();
      c.arc(x + 2.4, y + 2.2, 0.12, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'solar': {
      shadow(c, x, y, w, h);
      c.fillStyle = '#9aa2ad';
      rr(c, x + 0.08, y + 0.06, w - 0.16, h - 0.14, 0.1);
      c.fill();
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) {
          c.fillStyle = '#1d3566';
          c.fillRect(x + 0.18 + i * 0.9, y + 0.16 + j * 0.88, 0.82, 0.8);
          c.fillStyle = 'rgba(120,170,255,.35)';
          c.fillRect(x + 0.18 + i * 0.9, y + 0.16 + j * 0.88, 0.82, 0.18);
        }
      break;
    }
    case 'turret': {
      const rail = type === 'rail-turret';
      box(c, x, y, w, h, rail ? '#4a5563' : '#6a6f76', rail ? '#5d6a7b' : '#868c94', rail ? '#272e38' : '#3b3f45');
      if (l.noPower) break;
      break;
    }
    case 'wall': {
      const steel = type === 'steel-wall';
      c.fillStyle = 'rgba(0,0,0,.3)';
      c.fillRect(x + 0.08, y + 0.2, 0.96, 0.9);
      c.fillStyle = steel ? '#5c626d' : '#8a7a66';
      c.fillRect(x, y + 0.08, 1, 0.92);
      c.fillStyle = steel ? '#a4acb8' : '#b8a688';
      c.fillRect(x, y - 0.1, 1, 0.82);
      c.strokeStyle = steel ? '#5c626d' : '#8a7a66';
      c.lineWidth = 0.04;
      c.beginPath();
      c.moveTo(x, y + 0.3); c.lineTo(x + 1, y + 0.3);
      c.moveTo(x + 0.5, y - 0.1); c.lineTo(x + 0.5, y + 0.3);
      c.moveTo(x + 0.25, y + 0.3); c.lineTo(x + 0.25, y + 0.72);
      c.moveTo(x + 0.75, y + 0.3); c.lineTo(x + 0.75, y + 0.72);
      c.stroke();
      break;
    }
    case 'floor': {
      c.fillStyle = '#8e8676';
      c.fillRect(x, y, 1, 1);
      c.fillStyle = '#a69d8b';
      c.fillRect(x + 0.04, y + 0.04, 0.44, 0.44);
      c.fillRect(x + 0.52, y + 0.52, 0.44, 0.44);
      c.fillStyle = '#9b927f';
      c.fillRect(x + 0.52, y + 0.04, 0.44, 0.44);
      c.fillRect(x + 0.04, y + 0.52, 0.44, 0.44);
      break;
    }
    case 'splitter': {
      // two tiles side by side, across the way the belts run
      shadow(c, x, y, w, h);
      c.fillStyle = '#33404d';
      rr(c, x + 0.05, y + 0.05, w - 0.1, h - 0.1, 0.12);
      c.fill();
      c.fillStyle = '#e3b341';
      rr(c, x + 0.15, y + 0.15, w - 0.3, h - 0.3, 0.1);
      c.fill();
      // an arrow out the front of each tile
      for (const k of [0, 1]) {
        const tx = x + 0.5 + (k ? w - 1 : 0), ty = y + 0.5 + (k ? h - 1 : 0);
        arrow(c, tx + DX[l.dir] * 0.18, ty + DY[l.dir] * 0.18, l.dir, 0.14, '#2b3440');
      }
      break;
    }
    case 'lamp': {
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath();
      c.ellipse(x + 0.55, y + 0.88, 0.2, 0.08, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#4b5563';
      c.fillRect(x + 0.44, y + 0.2, 0.12, 0.7);
      c.fillStyle = l.working ? '#fff3b0' : '#c9ced8';
      c.beginPath();
      c.arc(x + 0.5, y + 0.2, 0.22, 0, Math.PI * 2);
      c.fill();
      if (l.working) {
        c.fillStyle = 'rgba(255,240,160,.35)';
        c.beginPath();
        c.arc(x + 0.5, y + 0.2, 0.42, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'battery': {
      box(c, x, y, w, h, '#3d4a3f', '#56685a', '#232c25');
      for (let i = 0; i < 3; i++) {
        c.fillStyle = '#1b2120';
        rr(c, x + 0.3 + i * 0.5, y + 0.4, 0.36, 1.1, 0.06);
        c.fill();
        c.fillStyle = l.working ? '#57d38c' : '#3f8f63';
        c.fillRect(x + 0.36 + i * 0.5, y + 0.9, 0.24, 0.55);
      }
      c.fillStyle = '#ffd23f';
      c.fillRect(x + 0.85, y + 0.22, 0.3, 0.08);
      break;
    }
    case 'mine': {
      c.globalAlpha = 0.55;
      c.fillStyle = '#4b5563';
      c.beginPath();
      c.ellipse(x + 0.5, y + 0.55, 0.3, 0.2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff5b4b';
      c.beginPath();
      c.arc(x + 0.5, y + 0.5, 0.06, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      break;
    }
    case 'monument': {
      shadow(c, x, y, w, h);
      c.fillStyle = '#8f8173';
      rr(c, x + 0.3, y + 3.2, 4.4, 1.6, 0.2);
      c.fill();
      c.fillStyle = '#b2a493';
      rr(c, x + 0.5, y + 3.3, 4, 1.2, 0.15);
      c.fill();
      // Owen's big round head
      c.fillStyle = '#9fb0e6';
      c.beginPath();
      c.arc(x + 2.5, y + 1.8, 1.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c6d2f5';
      c.beginPath();
      c.arc(x + 2.1, y + 1.3, 0.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#30406f';
      c.beginPath();
      c.arc(x + 1.95, y + 1.6, 0.18, 0, Math.PI * 2);
      c.arc(x + 3.05, y + 1.6, 0.18, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#30406f';
      c.lineWidth = 0.18;
      c.beginPath();
      c.arc(x + 2.5, y + 2.0, 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
      owenO(c, x + 2.5, y + 3.9, 0.3, '#574c41');
      const sp = (l.time % 2) / 2;
      c.fillStyle = `rgba(255,240,180,${1 - sp})`;
      c.beginPath();
      c.arc(x + 4.1, y + 0.4 + sp * 0.2, 0.12 + sp * 0.2, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
  statusBadge(c, x, y, w, l);
}

export function drawEntityIcon(c: Ctx, type: EntityType) {
  const d = ENTITIES[type];
  const s = Math.max(d.w, d.h, 1);
  const look: Look = { dir: 1, working: false, anim: 2, time: 0, t: 0.25 };
  c.save();
  if (d.kind === 'belt') {
    c.translate(0.05, 0.05);
    c.scale(0.9, 0.9);
    drawBelt(c, type, 0, 0, { ...look, dir: 0 });
  } else if (d.kind === 'inserter') {
    c.translate(0.15, 0.25);
    c.scale(0.7, 0.7);
    inserterBase(c, type, 0, 0, { ...look, dir: 0 });
    inserterArm(c, type, 0, 0, { ...look, dir: 0, t: 0.35 }, 0.7);
  } else if (d.kind === 'splitter') {
    c.translate(0.05, 0.3);
    c.scale(0.45, 0.45);
    drawBuilding(c, type, 0, 0, { ...look, dir: 0 });
  } else if (d.kind === 'floor' || d.kind === 'mine') {
    c.translate(0.1, 0.1);
    c.scale(0.8, 0.8);
    drawBuilding(c, type, 0, 0, { ...look, dir: 0 });
  } else if (d.kind === 'pole' || d.kind === 'lamp') {
    c.translate(0.1, 0.35);
    c.scale(0.75, 0.75);
    drawBuilding(c, type, 0, 0, look);
  } else {
    c.translate(0.04, 0.04);
    c.scale(0.92 / s, 0.92 / s);
    drawBuilding(c, type, 0, 0, { ...look, dir: 2 });
    if (d.kind === 'turret') drawTurretHead(c, type, 0, 0, -0.6, 1);
  }
  c.restore();
}

// ---------- trees ----------

const TREE_GREENS = ['#2f6b3a', '#3a7d3f', '#2b5e3d', '#4b7f36'];

export function drawTree(c: Ctx, x: number, y: number, v: number, sway: number) {
  const col = TREE_GREENS[(v - 1) % 4];
  const ox = x + 0.5, oy = y + 0.75;
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.ellipse(ox + 0.2, oy + 0.05, 0.5, 0.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5a3b22';
  c.fillRect(ox - 0.07, oy - 0.4, 0.14, 0.45);
  const s = sway * 0.04;
  if (v % 2 === 0) {
    // pine
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === 2 ? lighten(col) : col;
      c.beginPath();
      const ty = oy - 0.3 - i * 0.38;
      const ww = 0.55 - i * 0.12;
      c.moveTo(ox - ww + s * i, ty);
      c.lineTo(ox + ww + s * i, ty);
      c.lineTo(ox + s * (i + 1), ty - 0.6);
      c.closePath();
      c.fill();
    }
  } else {
    c.fillStyle = col;
    for (const [dx, dy, r] of [[-0.25, -0.55, 0.35], [0.25, -0.6, 0.35], [0, -0.9, 0.42]] as const) {
      c.beginPath();
      c.arc(ox + dx + s, oy + dy, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = lighten(col);
    c.beginPath();
    c.arc(ox - 0.1 + s, oy - 1.0, 0.2, 0, Math.PI * 2);
    c.fill();
  }
}

function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 30), g = Math.min(255, ((n >> 8) & 255) + 30), b = Math.min(255, (n & 255) + 20);
  return `rgb(${r},${g},${b})`;
}

// ---------- the player ----------

export interface PlayerLook {
  hair: string;
  hairStyle: number; // 0 short, 1 long, 2 spiky, 3 bald
  skin: string;
  armor: string;
  trim: string;
  helmet: string;
}

export const DEFAULT_LOOK: PlayerLook = {
  hair: '#5a3a22', hairStyle: 0, skin: '#e9b98f', armor: '#3d6fa8', trim: '#f2b632', helmet: '#f2b632',
};

export const LOOK_OPTIONS = {
  hair: ['#5a3a22', '#1e1a18', '#d9a441', '#b5462d', '#e9e4da', '#6a4bd1', '#2fa36b', '#ff6fae'],
  skin: ['#f6d2b5', '#e9b98f', '#c98f62', '#9b6640', '#6b4128'],
  armor: ['#3d6fa8', '#b8443a', '#3f8a4a', '#6b4fb0', '#2d2f36', '#d08a2a', '#2a9d9a', '#c9ced8'],
  trim: ['#f2b632', '#e8eef7', '#ff6b5b', '#57d38c', '#63b8ff', '#1e1a18'],
  helmet: ['#f2b632', '#e8eef7', '#ff6b5b', '#3d6fa8', '#57d38c', '#2d2f36'],
  hairStyle: ['Short', 'Long', 'Spiky', 'Bald'],
};

export function drawPlayer(c: Ctx, x: number, y: number, dir: number, moving: boolean, time: number, mining: boolean, look: PlayerLook = DEFAULT_LOOK) {
  const bob = moving ? Math.sin(time * 14) * 0.04 : 0;
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(x + 0.05, y + 0.3, 0.3, 0.12, 0, 0, Math.PI * 2);
  c.fill();
  // feet
  const step = moving ? Math.sin(time * 14) * 0.09 : 0;
  c.fillStyle = '#3b3027';
  c.beginPath();
  c.ellipse(x - 0.11, y + 0.24 + step, 0.08, 0.06, 0, 0, Math.PI * 2);
  c.ellipse(x + 0.11, y + 0.24 - step, 0.08, 0.06, 0, 0, Math.PI * 2);
  c.fill();
  // armor
  c.fillStyle = look.armor;
  c.beginPath();
  c.ellipse(x, y + 0.02 + bob, 0.24, 0.27, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = look.trim;
  c.fillRect(x - 0.22, y + 0.06 + bob, 0.44, 0.05);
  c.fillRect(x - 0.03, y - 0.2 + bob, 0.06, 0.26);
  if (dir === 0) {
    c.fillStyle = '#7c5b3a';
    c.fillRect(x - 0.15, y - 0.06 + bob, 0.3, 0.22);
  }
  // arms
  const swing = mining ? Math.sin(time * 18) * 0.15 : 0;
  c.fillStyle = look.skin;
  const ax = [0, 0.26, 0, -0.26][dir];
  c.beginPath();
  c.arc(x - 0.24 + (dir === 3 ? -0.05 : 0), y + 0.05 + bob + swing, 0.07, 0, Math.PI * 2);
  c.arc(x + 0.24 + (dir === 1 ? 0.05 : 0), y + 0.05 + bob - swing, 0.07, 0, Math.PI * 2);
  c.fill();
  const hx = x + ax * 0.2, hy = y - 0.26 + bob;
  // long hair falls behind the head
  if (look.hairStyle === 1) {
    c.fillStyle = look.hair;
    c.beginPath();
    c.ellipse(hx, hy + 0.06, 0.18, 0.2, 0, 0, Math.PI * 2);
    c.fill();
  }
  // head
  c.fillStyle = look.skin;
  c.beginPath();
  c.arc(hx, hy, 0.15, 0, Math.PI * 2);
  c.fill();
  // hair peeking out under the helmet
  if (look.hairStyle !== 3) {
    c.fillStyle = look.hair;
    if (look.hairStyle === 2) {
      c.beginPath();
      for (let i = -2; i <= 2; i++) {
        c.moveTo(hx + i * 0.06 - 0.04, hy - 0.08);
        c.lineTo(hx + i * 0.07, hy - 0.28);
        c.lineTo(hx + i * 0.06 + 0.04, hy - 0.08);
      }
      c.fill();
    } else {
      // sideburns and a fringe under the helmet brim
      c.beginPath();
      c.ellipse(hx - 0.13, hy + 0.0, 0.05, 0.09, 0, 0, Math.PI * 2);
      c.ellipse(hx + 0.13, hy + 0.0, 0.05, 0.09, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(hx - 0.15, hy - 0.06, 0.3, 0.06);
      if (dir === 0) c.fillRect(hx - 0.15, hy - 0.06, 0.3, 0.17);
    }
  }
  // helmet
  c.fillStyle = look.helmet;
  c.beginPath();
  c.arc(hx, hy - 0.04, 0.16, Math.PI, 0);
  c.fill();
  c.fillRect(hx - 0.2, hy - 0.05, 0.4, 0.05);
  if (dir !== 0) {
    c.fillStyle = '#2b2b2b';
    const ex = [0, 0.07, 0, -0.07][dir];
    c.beginPath();
    c.arc(hx + ex - (dir === 2 ? 0.05 : 0), hy + 0.04, 0.025, 0, Math.PI * 2);
    if (dir === 2) c.arc(hx + 0.05, hy + 0.04, 0.025, 0, Math.PI * 2);
    c.fill();
  }
}

export type GunKind = 'pistol' | 'rail';

/** The gun in the engineer's hands, pointing along `angle`. */
export function drawGun(c: Ctx, x: number, y: number, angle: number, gun: GunKind, muzzle: number, reloading: number) {
  c.save();
  c.translate(x, y + 0.02);
  c.rotate(angle);
  const flip = Math.cos(angle) < 0 ? -1 : 1;
  c.scale(1, flip);
  // a reload tips the gun down
  if (reloading > 0) c.rotate(0.6 * Math.sin(reloading * Math.PI));
  if (gun === 'rail') {
    c.fillStyle = '#39424f';
    c.fillRect(0.08, -0.06, 0.62, 0.12);
    c.fillStyle = '#7d8a9b';
    c.fillRect(0.3, -0.09, 0.42, 0.04);
    c.fillRect(0.3, 0.05, 0.42, 0.04);
    c.fillStyle = '#5adcff';
    c.fillRect(0.34, -0.02, 0.36, 0.04);
    c.fillStyle = '#6b4126';
    c.fillRect(0.1, 0.04, 0.09, 0.14);
  } else {
    c.fillStyle = '#2b2f36';
    c.fillRect(0.12, -0.05, 0.42, 0.1);
    c.fillStyle = '#4b5563';
    c.fillRect(0.12, -0.07, 0.3, 0.04);
    c.fillStyle = '#6b4126';
    c.beginPath();
    c.moveTo(0.14, 0.04);
    c.lineTo(0.24, 0.04);
    c.lineTo(0.2, 0.2);
    c.lineTo(0.1, 0.2);
    c.fill();
    // magazine
    c.fillStyle = '#9fb0e6';
    c.fillRect(0.28, 0.04, 0.07, 0.11);
  }
  // hands on the grip
  c.fillStyle = '#e9b98f';
  c.beginPath();
  c.arc(0.17, 0.06, 0.06, 0, Math.PI * 2);
  c.fill();
  if (muzzle > 0) {
    const end = gun === 'rail' ? 0.72 : 0.56;
    c.fillStyle = gun === 'rail' ? `rgba(120,230,255,${muzzle / 5})` : `rgba(255,220,90,${muzzle / 5})`;
    c.beginPath();
    c.moveTo(end, 0);
    c.lineTo(end + 0.22, -0.1);
    c.lineTo(end + 0.3, 0);
    c.lineTo(end + 0.22, 0.1);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** The engineer plus their gun, drawn in the right order for where they aim. */
export function drawEngineer(
  c: Ctx, x: number, y: number, dir: number, moving: boolean, time: number, mining: boolean, look: PlayerLook,
  gun: GunKind | null, angle: number, muzzle: number, reloading: number,
) {
  const behind = gun && Math.sin(angle) < -0.35;
  if (gun && behind) drawGun(c, x, y, angle, gun, muzzle, reloading);
  drawPlayer(c, x, y, dir, moving, time, mining, look);
  if (gun && !behind) drawGun(c, x, y, angle, gun, muzzle, reloading);
}

/** How the gun is carried for each facing (up, right, down, left) when not aiming: tipped to the side so it shows. */
export const DIR_ANGLE = [-Math.PI / 2 + 0.75, 0.35, Math.PI / 2 - 0.6, Math.PI - 0.35];

// ---------- bugs ----------

export function drawBug(c: Ctx, x: number, y: number, angle: number, size: number, color: string, shell: string, anim: number) {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.beginPath();
  c.ellipse(0.05, 0.08, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(angle);
  const s = size;
  // legs
  c.strokeStyle = '#2a2018';
  c.lineWidth = s * 0.08;
  c.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const w = Math.sin(anim * 0.4 + i * 2) * s * 0.15;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(i * s * 0.22, 0);
      c.lineTo(i * s * 0.25 + w * side, side * s * 0.38);
      c.lineTo(i * s * 0.32 + w * side, side * s * 0.55);
      c.stroke();
    }
  }
  // abdomen + head
  c.fillStyle = shell;
  c.beginPath();
  c.ellipse(-s * 0.15, 0, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(-s * 0.12, 0, s * 0.34, s * 0.24, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = shell;
  c.lineWidth = s * 0.05;
  c.beginPath();
  c.moveTo(-s * 0.46, 0);
  c.lineTo(s * 0.18, 0);
  c.stroke();
  c.fillStyle = shell;
  c.beginPath();
  c.arc(s * 0.3, 0, s * 0.16, 0, Math.PI * 2);
  c.fill();
  // mandibles + eyes
  c.strokeStyle = '#2a2018';
  c.lineWidth = s * 0.06;
  c.beginPath();
  const m = Math.sin(anim * 0.5) * 0.3;
  c.moveTo(s * 0.4, -s * 0.06);
  c.quadraticCurveTo(s * 0.6, -s * (0.16 + m * 0.1), s * 0.6, 0);
  c.moveTo(s * 0.4, s * 0.06);
  c.quadraticCurveTo(s * 0.6, s * (0.16 + m * 0.1), s * 0.6, 0);
  c.stroke();
  c.fillStyle = '#ffeb6b';
  c.beginPath();
  c.arc(s * 0.36, -s * 0.07, s * 0.04, 0, Math.PI * 2);
  c.arc(s * 0.36, s * 0.07, s * 0.04, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export function drawNest(c: Ctx, x: number, y: number, pulse: number, hpFrac: number) {
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(x + 0.1, y + 0.25, 1.6, 1.0, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4a2f4f';
  c.beginPath();
  c.ellipse(x, y + 0.1, 1.5, 1.05, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#6b3f6e';
  c.beginPath();
  c.ellipse(x - 0.1, y - 0.05, 1.25, 0.85, 0, 0, Math.PI * 2);
  c.fill();
  const g = 0.5 + Math.sin(pulse) * 0.25;
  for (const [dx, dy, r] of [[-0.5, -0.1, 0.28], [0.45, 0.05, 0.24], [0, 0.4, 0.22], [0.1, -0.45, 0.18]] as const) {
    c.fillStyle = '#251827';
    c.beginPath();
    c.ellipse(x + dx, y + dy, r, r * 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `rgba(190,255,90,${g * 0.6})`;
    c.beginPath();
    c.ellipse(x + dx, y + dy + r * 0.1, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  }
  // spikes
  c.fillStyle = '#2f1d33';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const px = x + Math.cos(a) * 1.25, py = y + Math.sin(a) * 0.85;
    c.beginPath();
    c.moveTo(px - 0.1, py);
    c.lineTo(px + Math.cos(a) * 0.35, py + Math.sin(a) * 0.25 - 0.2);
    c.lineTo(px + 0.1, py);
    c.fill();
  }
  if (hpFrac < 1) {
    c.fillStyle = 'rgba(0,0,0,.6)';
    c.fillRect(x - 0.8, y - 1.3, 1.6, 0.14);
    c.fillStyle = '#ff5b4b';
    c.fillRect(x - 0.78, y - 1.28, 1.56 * hpFrac, 0.1);
  }
}

export function drawTurretHead(c: Ctx, type: EntityType, x: number, y: number, angle: number, charge: number) {
  const d = ENTITIES[type];
  const k = 1 / artSize(type);
  const cx = x + d.w / 2, cy = y + d.h / 2 - 0.2 * k;
  c.save();
  c.translate(cx, cy);
  c.rotate(angle);
  c.scale(k, k);
  if (type === 'rail-turret') {
    c.fillStyle = '#39424f';
    c.beginPath();
    c.arc(0, 0, 0.85, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5b6878';
    c.fillRect(0, -0.32, 1.9, 0.18);
    c.fillRect(0, 0.14, 1.9, 0.18);
    c.fillStyle = `rgba(90,220,255,${0.3 + charge * 0.7})`;
    c.fillRect(0.2, -0.12, 1.6 * charge, 0.24);
    c.fillStyle = '#7d8a9b';
    c.beginPath();
    c.arc(0, 0, 0.5, 0, Math.PI * 2);
    c.fill();
    owenO(c, 0, 0, 0.18, '#2b3440');
  } else {
    c.fillStyle = '#5a6470';
    c.beginPath();
    c.arc(0, 0, 0.55, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2f353d';
    c.fillRect(0.2, -0.17, 0.85, 0.12);
    c.fillRect(0.2, 0.05, 0.85, 0.12);
    c.fillStyle = '#e3b341';
    c.beginPath();
    c.arc(0, 0, 0.28, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
