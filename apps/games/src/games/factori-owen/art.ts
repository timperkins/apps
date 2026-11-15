// Procedural drawings for buildings, trees and the player. All coordinates are in tiles.
import { ENTITIES, type EntityType } from './data';
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
};

export function drawBelt(c: Ctx, type: EntityType, x: number, y: number, l: Look) {
  const [base, rail, chev] = BELT_COLORS[type] ?? BELT_COLORS['belt'];
  const speed = type === 'fast-belt' ? 2 : 1;
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

export function drawBuilding(c: Ctx, type: EntityType, x: number, y: number, l: Look) {
  const d = ENTITIES[type];
  const { w, h } = d;
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
      box(c, x, y, w, h, '#8f8173', '#b2a493', '#574c41');
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
      box(c, x, y, w, h, '#5b6c7d', '#7d90a3', '#33404d');
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
  } else if (d.kind === 'pole') {
    c.translate(0.1, 0.35);
    c.scale(0.75, 0.75);
    drawBuilding(c, type, 0, 0, look);
  } else {
    c.translate(0.04, 0.04);
    c.scale(0.92 / s, 0.92 / s);
    drawBuilding(c, type, 0, 0, { ...look, dir: 2 });
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

export function drawPlayer(c: Ctx, x: number, y: number, dir: number, moving: boolean, time: number, mining: boolean) {
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
  // body (overalls)
  c.fillStyle = '#3d6fa8';
  c.beginPath();
  c.ellipse(x, y + 0.02 + bob, 0.24, 0.27, 0, 0, Math.PI * 2);
  c.fill();
  // backpack faces away from where we look
  if (dir === 0) {
    c.fillStyle = '#7c5b3a';
    c.fillRect(x - 0.15, y - 0.06 + bob, 0.3, 0.22);
  }
  // arms
  const swing = mining ? Math.sin(time * 18) * 0.15 : 0;
  c.fillStyle = '#e9b98f';
  const ax = [0, 0.26, 0, -0.26][dir];
  c.beginPath();
  c.arc(x - 0.24 + (dir === 3 ? -0.05 : 0), y + 0.05 + bob + swing, 0.07, 0, Math.PI * 2);
  c.arc(x + 0.24 + (dir === 1 ? 0.05 : 0), y + 0.05 + bob - swing, 0.07, 0, Math.PI * 2);
  c.fill();
  // head
  c.fillStyle = '#e9b98f';
  c.beginPath();
  c.arc(x + ax * 0.2, y - 0.26 + bob, 0.15, 0, Math.PI * 2);
  c.fill();
  // hard hat
  c.fillStyle = '#f2b632';
  c.beginPath();
  c.arc(x + ax * 0.2, y - 0.3 + bob, 0.16, Math.PI, 0);
  c.fill();
  c.fillRect(x + ax * 0.2 - 0.2, y - 0.31 + bob, 0.4, 0.05);
  if (dir !== 0) {
    c.fillStyle = '#2b2b2b';
    const ex = [0, 0.07, 0, -0.07][dir];
    c.beginPath();
    c.arc(x + ax * 0.2 + ex - (dir === 2 ? 0.05 : 0), y - 0.22 + bob, 0.025, 0, Math.PI * 2);
    if (dir === 2) c.arc(x + 0.05, y - 0.22 + bob, 0.025, 0, Math.PI * 2);
    c.fill();
  }
}
