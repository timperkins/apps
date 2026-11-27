// Archenimys drawing: everything is drawn with canvas shapes (original art, no image files).
import { BOSSES, DMG, H, MONSTERS, PLAYER_COLORS, Q_COLORS, W, isBossStage, type MonsterKind } from './data';
import { STAIRS, WALL, choosing, orbPos, up, type Enemy, type Fx, type Player, type Shot, type State } from './game';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; r: number; kind: 'dot' | 'ring' | 'text'; text?: string; grow?: number }

// floor colors change every 10 stages as you climb
const FLOORS = [
  { a: '#6d6457', b: '#5f574b', wall: '#3b342c', top: '#8a7f6e' },
  { a: '#5d6670', b: '#515962', wall: '#2f343b', top: '#7d8894' },
  { a: '#6e5a52', b: '#614e47', wall: '#3d2c27', top: '#937466' },
  { a: '#55634f', b: '#4a5745', wall: '#2b3427', top: '#76866d' },
  { a: '#5e5170', b: '#524663', wall: '#30283d', top: '#80709a' },
];

function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function eyes(c: C, x: number, y: number, gap: number, size: number, angry = true, color = '#fff') {
  for (const s of [-1, 1]) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x + s * gap, y, size, size * 1.15, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(x + s * gap + s * size * 0.15, y + size * 0.2, size * 0.55, 0, TAU);
    c.fill();
    if (angry) {
      c.strokeStyle = '#111';
      c.lineWidth = size * 0.45;
      c.beginPath();
      c.moveTo(x + s * (gap + size * 1.1), y - size * 1.5);
      c.lineTo(x + s * (gap - size * 0.9), y - size * 0.8);
      c.stroke();
    }
  }
}

// ---------- monsters ----------

/** Boom Pot: a teapot with a lit fuse on its lid */
export function drawPot(c: C, r: number, t: number, fuse: number, face: number) {
  const flash = fuse > 0 && Math.floor(t * 16) % 2 === 0;
  const swell = fuse > 0 ? 1 + (0.7 - Math.min(0.7, fuse)) * 0.25 : 1;
  const dir = Math.cos(face) >= 0 ? 1 : -1;
  c.save();
  c.scale(swell, swell);
  const body = flash ? '#fff1d6' : '#c8553d';
  const dark = flash ? '#ffb38a' : '#8e3423';
  c.lineWidth = r * 0.12;
  c.strokeStyle = '#2a120c';
  // spout
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(dir * r * 0.6, r * 0.15);
  c.quadraticCurveTo(dir * r * 1.25, r * 0.1, dir * r * 1.45, -r * 0.55);
  c.lineTo(dir * r * 1.2, -r * 0.6);
  c.quadraticCurveTo(dir * r * 1.05, -r * 0.1, dir * r * 0.6, -r * 0.25);
  c.closePath();
  c.fill();
  c.stroke();
  // handle
  c.beginPath();
  c.lineWidth = r * 0.22;
  c.strokeStyle = '#2a120c';
  c.arc(-dir * r * 0.9, -r * 0.05, r * 0.42, Math.PI * 0.5, Math.PI * 1.5, dir > 0);
  c.stroke();
  c.lineWidth = r * 0.12;
  c.strokeStyle = dark;
  c.stroke();
  // body
  c.lineWidth = r * 0.12;
  c.strokeStyle = '#2a120c';
  c.fillStyle = body;
  c.beginPath();
  c.ellipse(0, r * 0.1, r * 0.95, r * 0.8, 0, 0, TAU);
  c.fill();
  c.stroke();
  // stripe and shine
  c.fillStyle = dark;
  c.beginPath();
  c.ellipse(0, r * 0.38, r * 0.9, r * 0.16, 0, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.beginPath();
  c.ellipse(-r * 0.4, -r * 0.2, r * 0.18, r * 0.28, -0.5, 0, TAU);
  c.fill();
  // lid
  c.fillStyle = dark;
  c.beginPath();
  c.ellipse(0, -r * 0.62, r * 0.55, r * 0.22, 0, 0, TAU);
  c.fill();
  c.stroke();
  c.fillStyle = body;
  c.beginPath();
  c.arc(0, -r * 0.82, r * 0.16, 0, TAU);
  c.fill();
  c.stroke();
  // fuse with a spark
  c.strokeStyle = '#3a2a1a';
  c.lineWidth = r * 0.1;
  c.beginPath();
  c.moveTo(0, -r * 0.95);
  c.quadraticCurveTo(r * 0.25, -r * 1.25, r * 0.12, -r * 1.45);
  c.stroke();
  const sp = fuse > 0 ? 1.6 : 1;
  c.fillStyle = Math.floor(t * 20) % 2 ? '#ffe66b' : '#ff8a2a';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + t * 6;
    const rad = (i % 2 ? r * 0.12 : r * 0.28) * sp;
    c.lineTo(r * 0.12 + Math.cos(a) * rad, -r * 1.48 + Math.sin(a) * rad);
  }
  c.fill();
  eyes(c, dir * r * 0.15, r * 0.02, r * 0.3, r * 0.15);
  c.restore();
}

/** Sharp Cactus: a thorny cactus with arms */
export function drawCactus(c: C, r: number, t: number, winding: boolean) {
  c.save();
  if (winding) c.translate(Math.sin(t * 60) * r * 0.06, 0);
  const g = '#3f9a3c', dg = '#2a6e29';
  c.lineWidth = r * 0.1;
  c.strokeStyle = '#163d15';
  // pot of sand at the bottom
  c.fillStyle = '#c98c4d';
  rr(c, -r * 0.6, r * 0.55, r * 1.2, r * 0.5, r * 0.12);
  c.fill();
  c.stroke();
  // arms
  c.fillStyle = g;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.roundRect(s > 0 ? r * 0.35 : -r * 0.95, -r * 0.15, r * 0.6, r * 0.32, r * 0.16);
    c.fill();
    c.stroke();
    c.beginPath();
    c.roundRect(s > 0 ? r * 0.65 : -r * 0.95, -r * (s > 0 ? 0.8 : 0.6), r * 0.3, r * 0.8, r * 0.15);
    c.fill();
    c.stroke();
  }
  // body
  c.beginPath();
  c.roundRect(-r * 0.45, -r * 1.05, r * 0.9, r * 1.7, r * 0.45);
  c.fill();
  c.stroke();
  c.strokeStyle = dg;
  c.lineWidth = r * 0.07;
  for (const x of [-0.2, 0, 0.2]) {
    c.beginPath();
    c.moveTo(x * r, -r * 0.85);
    c.lineTo(x * r, r * 0.5);
    c.stroke();
  }
  // thorns all over
  c.strokeStyle = '#fff6c9';
  c.lineWidth = Math.max(1, r * 0.06);
  const spikes: [number, number, number][] = [
    [-0.45, -0.6, Math.PI], [-0.45, -0.1, Math.PI], [-0.45, 0.35, Math.PI], [0.45, -0.6, 0], [0.45, -0.1, 0], [0.45, 0.35, 0],
    [0, -1.05, -Math.PI / 2], [-0.3, -0.95, -2.3], [0.3, -0.95, -0.8], [0.8, -0.8, -Math.PI / 2], [-0.8, -0.6, -Math.PI / 2],
    [0.95, -0.4, 0], [-0.95, -0.3, Math.PI], [0.6, 0.17, Math.PI / 2], [-0.6, 0.17, Math.PI / 2],
  ];
  for (const [x, y, a] of spikes) {
    c.beginPath();
    c.moveTo(x * r, y * r);
    c.lineTo(x * r + Math.cos(a) * r * 0.28, y * r + Math.sin(a) * r * 0.28);
    c.stroke();
  }
  // flower on top
  c.fillStyle = '#ff6fa8';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    c.beginPath();
    c.arc(Math.cos(a) * r * 0.13, -r * 1.08 + Math.sin(a) * r * 0.13, r * 0.11, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#ffe14d';
  c.beginPath();
  c.arc(0, -r * 1.08, r * 0.08, 0, TAU);
  c.fill();
  eyes(c, 0, -r * 0.45, r * 0.18, r * 0.12);
  c.restore();
}

/** Acid Stew: a mostly black pot (a little gray) of bubbling green goo, with acid drizzling down */
export function drawStew(c: C, r: number, t: number) {
  c.save();
  c.lineWidth = r * 0.08;
  // feet
  c.fillStyle = '#1a1a1a';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * r * 0.5, r * 0.82, r * 0.18, r * 0.12, 0, 0, TAU);
    c.fill();
  }
  // pot body: black with a gray band and shine (about 80% black, 20% gray)
  c.fillStyle = '#121212';
  c.beginPath();
  c.ellipse(0, r * 0.15, r * 0.95, r * 0.75, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#6b6b6b';
  c.beginPath();
  c.ellipse(0, r * 0.2, r * 0.93, r * 0.12, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = 'rgba(160,160,160,.45)';
  c.beginPath();
  c.ellipse(-r * 0.5, r * 0.05, r * 0.12, r * 0.3, 0.4, 0, TAU);
  c.fill();
  // gray rim
  c.fillStyle = '#7a7a7a';
  c.beginPath();
  c.ellipse(0, -r * 0.45, r * 0.9, r * 0.28, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#2a2a2a';
  c.beginPath();
  c.ellipse(0, -r * 0.45, r * 0.78, r * 0.2, 0, 0, TAU);
  c.fill();
  // green goo
  c.fillStyle = '#5ff23a';
  c.beginPath();
  c.ellipse(0, -r * 0.47, r * 0.74, r * 0.17, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#9dff6e';
  c.beginPath();
  c.ellipse(-r * 0.2, -r * 0.5, r * 0.3, r * 0.07, 0, 0, TAU);
  c.fill();
  // drizzles of acid down the sides
  c.fillStyle = '#4fe02c';
  const drips = [-0.62, -0.25, 0.18, 0.55];
  drips.forEach((x, i) => {
    const len = r * (0.35 + 0.25 * Math.sin(t * 2 + i * 1.7) ** 2 + (i % 2) * 0.15);
    c.beginPath();
    c.moveTo(x * r - r * 0.07, -r * 0.4);
    c.lineTo(x * r - r * 0.05, -r * 0.4 + len);
    c.arc(x * r, -r * 0.4 + len, r * 0.06, Math.PI, 0, true);
    c.lineTo(x * r + r * 0.07, -r * 0.4);
    c.fill();
  });
  // bubbles popping up out of the goo
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.9 + i * 0.27) % 1;
    const bx = Math.sin(i * 2.3) * r * 0.5;
    c.strokeStyle = `rgba(170,255,120,${1 - k})`;
    c.lineWidth = Math.max(1, r * 0.05);
    c.beginPath();
    c.arc(bx, -r * 0.5 - k * r * 0.55, r * (0.06 + k * 0.08), 0, TAU);
    c.stroke();
  }
  // glowing eyes on the pot
  eyes(c, 0, r * 0.08, r * 0.28, r * 0.12, true, '#b6ff8a');
  c.restore();
}

/** Snapping Crab: claws snap open and shut */
export function drawCrab(c: C, r: number, t: number, snapping: boolean, moving: boolean) {
  c.save();
  const shell = '#e2532f', dark = '#9c2e17';
  c.lineWidth = r * 0.08;
  c.strokeStyle = '#3d1208';
  // legs
  c.strokeStyle = dark;
  c.lineWidth = r * 0.11;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const wig = moving ? Math.sin(t * 22 + i * 2 + (s > 0 ? 1 : 0)) * r * 0.12 : 0;
      c.beginPath();
      c.moveTo(s * r * 0.55, r * (0.05 + i * 0.22));
      c.lineTo(s * r * 1.05, r * (0.1 + i * 0.25) + wig);
      c.lineTo(s * r * 1.2, r * (0.35 + i * 0.25) + wig);
      c.stroke();
    }
  }
  // claws
  const open = snapping ? 0.25 + 0.35 * Math.abs(Math.sin(t * 18)) : 0.15 + 0.1 * Math.sin(t * 4);
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * r * 0.75, -r * 0.55);
    c.strokeStyle = '#3d1208';
    c.lineWidth = r * 0.08;
    c.fillStyle = shell;
    c.beginPath();
    c.ellipse(0, 0, r * 0.35, r * 0.3, 0, 0, TAU);
    c.fill();
    c.stroke();
    for (const k of [-1, 1]) {
      c.save();
      c.rotate(-Math.PI / 2 + s * 0.3 + k * open);
      c.beginPath();
      c.moveTo(r * 0.15, k * r * 0.05);
      c.quadraticCurveTo(r * 0.55, k * r * 0.22, r * 0.62, 0);
      c.quadraticCurveTo(r * 0.4, k * r * 0.05, r * 0.15, 0);
      c.fill();
      c.stroke();
      c.restore();
    }
    c.restore();
  }
  // shell
  c.fillStyle = shell;
  c.strokeStyle = '#3d1208';
  c.lineWidth = r * 0.08;
  c.beginPath();
  c.ellipse(0, r * 0.15, r * 0.8, r * 0.58, 0, 0, TAU);
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(255,220,180,.35)';
  c.beginPath();
  c.ellipse(-r * 0.25, -r * 0.02, r * 0.28, r * 0.14, -0.3, 0, TAU);
  c.fill();
  c.fillStyle = dark;
  for (const x of [-0.35, 0, 0.35]) {
    c.beginPath();
    c.arc(x * r, r * 0.42, r * 0.07, 0, TAU);
    c.fill();
  }
  // eye stalks
  for (const s of [-1, 1]) {
    c.strokeStyle = dark;
    c.lineWidth = r * 0.09;
    c.beginPath();
    c.moveTo(s * r * 0.2, -r * 0.3);
    c.lineTo(s * r * 0.25, -r * 0.62);
    c.stroke();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(s * r * 0.25, -r * 0.68, r * 0.13, 0, TAU);
    c.fill();
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(s * r * 0.25, -r * 0.66, r * 0.07, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** The Archenemy: a giant shadow archer */
function drawArchenemy(c: C, r: number, t: number, aim: number) {
  c.save();
  c.fillStyle = 'rgba(120,40,200,.25)';
  c.beginPath();
  c.arc(0, 0, r * 1.25 + Math.sin(t * 3) * 3, 0, TAU);
  c.fill();
  // cloak
  c.fillStyle = '#231432';
  c.strokeStyle = '#0c0612';
  c.lineWidth = r * 0.06;
  c.beginPath();
  c.moveTo(-r * 0.8, r * 0.9);
  c.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r * 0.55);
  c.quadraticCurveTo(r * 0.9, -r * 0.2, r * 0.8, r * 0.9);
  c.closePath();
  c.fill();
  c.stroke();
  // hood
  c.fillStyle = '#34204a';
  c.beginPath();
  c.arc(0, -r * 0.55, r * 0.42, 0, TAU);
  c.fill();
  c.stroke();
  c.fillStyle = '#05030a';
  c.beginPath();
  c.ellipse(0, -r * 0.5, r * 0.28, r * 0.24, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#ff3b5c';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * r * 0.11, -r * 0.52, r * 0.06, r * 0.035, s * 0.3, 0, TAU);
    c.fill();
  }
  // shadow bow
  c.save();
  c.rotate(aim);
  c.strokeStyle = '#b06bff';
  c.lineWidth = r * 0.08;
  c.beginPath();
  c.arc(r * 0.45, 0, r * 0.6, -1.1, 1.1);
  c.stroke();
  c.strokeStyle = '#e8d2ff';
  c.lineWidth = r * 0.025;
  c.beginPath();
  c.moveTo(r * 0.45 + Math.cos(-1.1) * r * 0.6, Math.sin(-1.1) * r * 0.6);
  c.lineTo(r * 0.45 + Math.cos(1.1) * r * 0.6, Math.sin(1.1) * r * 0.6);
  c.stroke();
  c.restore();
  c.restore();
}

function crown(c: C, r: number, y: number) {
  c.fillStyle = '#ffd23f';
  c.strokeStyle = '#7a5a00';
  c.lineWidth = r * 0.05;
  c.beginPath();
  c.moveTo(-r * 0.4, y);
  c.lineTo(-r * 0.45, y - r * 0.35);
  c.lineTo(-r * 0.2, y - r * 0.15);
  c.lineTo(0, y - r * 0.45);
  c.lineTo(r * 0.2, y - r * 0.15);
  c.lineTo(r * 0.45, y - r * 0.35);
  c.lineTo(r * 0.4, y);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#ff3b5c';
  c.beginPath();
  c.arc(0, y - r * 0.12, r * 0.06, 0, TAU);
  c.fill();
}

export function drawMonster(c: C, kind: MonsterKind, r: number, t: number, o: { fuse?: number; face?: number; winding?: boolean; moving?: boolean }) {
  if (kind === 'pot') drawPot(c, r, t, o.fuse ?? 0, o.face ?? 0);
  else if (kind === 'cactus') drawCactus(c, r, t, !!o.winding);
  else if (kind === 'stew') drawStew(c, r, t);
  else drawCrab(c, r, t, !!o.winding, o.moving ?? true);
}

// ---------- archer ----------

export function drawArcher(c: C, color: string, aim: number, t: number, moving: boolean, drawn: number) {
  const r = 14;
  c.save();
  const bob = moving ? Math.sin(t * 14) * 1.5 : 0;
  c.translate(0, bob);
  // feet
  c.fillStyle = '#4a3020';
  const step = moving ? Math.sin(t * 14) * 4 : 0;
  c.beginPath();
  c.ellipse(-5, r * 0.85 + step * 0.3, 4, 3, 0, 0, TAU);
  c.ellipse(5, r * 0.85 - step * 0.3, 4, 3, 0, 0, TAU);
  c.fill();
  // quiver on the back
  const back = Math.cos(aim) >= 0 ? -1 : 1;
  c.fillStyle = '#7a4a26';
  rr(c, back * 8 - 3, -10, 6, 14, 2);
  c.fill();
  c.fillStyle = '#eee';
  c.fillRect(back * 8 - 2, -14, 1.5, 4);
  c.fillRect(back * 8 + 0.5, -15, 1.5, 5);
  // cloak / body
  c.fillStyle = color;
  c.strokeStyle = '#141018';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-10, 10);
  c.quadraticCurveTo(-11, -4, 0, -6);
  c.quadraticCurveTo(11, -4, 10, 10);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#5a3a1e';
  c.fillRect(-9, 3, 18, 3);
  // head with hood
  c.fillStyle = color;
  c.beginPath();
  c.arc(0, -11, 8.5, 0, TAU);
  c.fill();
  c.stroke();
  c.fillStyle = '#f2c7a0';
  c.beginPath();
  c.arc(Math.cos(aim) * 2, -10 + Math.max(0, Math.sin(aim)) * 1.5, 5.5, 0, TAU);
  c.fill();
  if (Math.sin(aim) > -0.6) {
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(Math.cos(aim) * 2 - 2 + Math.cos(aim) * 1.5, -10.5, 1, 0, TAU);
    c.arc(Math.cos(aim) * 2 + 2 + Math.cos(aim) * 1.5, -10.5, 1, 0, TAU);
    c.fill();
  }
  // bow
  c.save();
  c.translate(0, -2);
  c.rotate(aim);
  c.strokeStyle = '#8a5a2b';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(6, 0, 12, -1.15, 1.15);
  c.stroke();
  const pull = 4 + drawn * 6;
  c.strokeStyle = '#eee';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(6 + Math.cos(-1.15) * 12, Math.sin(-1.15) * 12);
  c.lineTo(6 + Math.cos(-1.15) * 12 - pull, 0);
  c.lineTo(6 + Math.cos(1.15) * 12, Math.sin(1.15) * 12);
  c.stroke();
  c.strokeStyle = '#d9c39a';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(6 + Math.cos(1.15) * 12 - pull, 0);
  c.lineTo(22, 0);
  c.stroke();
  c.fillStyle = '#cfd6de';
  c.beginPath();
  c.moveTo(25, 0);
  c.lineTo(20, -3);
  c.lineTo(20, 3);
  c.fill();
  c.restore();
  c.restore();
}

// ---------- the renderer ----------

export class Renderer {
  c: C;
  scale = 1;
  ox = 0;
  oy = 0;
  parts: Particle[] = [];
  shake = 0;
  private floor: HTMLCanvasElement | null = null;
  private floorStage = -1;
  private stars: { x: number; y: number; s: number }[] = [];

  constructor(public cv: HTMLCanvasElement) {
    this.c = cv.getContext('2d')!;
    for (let i = 0; i < 120; i++) this.stars.push({ x: Math.random(), y: Math.random(), s: Math.random() });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) {
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(h * dpr);
    }
    const pad = 8 * dpr;
    this.scale = Math.min((this.cv.width - pad * 2) / W, (this.cv.height - pad * 2) / H);
    this.ox = (this.cv.width - W * this.scale) / 2;
    this.oy = (this.cv.height - H * this.scale) / 2;
  }

  /** screen pixel (CSS) to world */
  toWorld(px: number, py: number) {
    const dpr = this.cv.width / Math.max(1, this.cv.clientWidth);
    return { x: (px * dpr - this.ox) / this.scale, y: (py * dpr - this.oy) / this.scale };
  }

  addFx(f: Fx, myId: string) {
    const P = (p: Partial<Particle>) => this.parts.push({ x: f.x, y: f.y, vx: 0, vy: 0, t: 0, life: 0.5, c: '#fff', r: 3, kind: 'dot', ...p });
    const burst = (n: number, colors: string[], speed: number, life = 0.5, r = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
        P({ vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: colors[i % colors.length], life: life * (0.6 + Math.random() * 0.6), r: r * (0.6 + Math.random() * 0.8) });
      }
    };
    switch (f.k) {
      case 'boom':
        P({ kind: 'ring', r: 6, grow: (f.r ?? 80) * 2.2, life: 0.38, c: '#ffd36b' });
        burst(26, ['#ff7a2a', '#ffd23f', '#5a4a3a', '#fff1c0'], 260, 0.6, 5);
        this.shake = Math.max(this.shake, 8);
        break;
      case 'pop':
        burst(14, f.c === 'cactus' ? ['#3f9a3c', '#fff6c9'] : f.c === 'stew' ? ['#5ff23a', '#121212'] : f.c === 'crab' ? ['#e2532f', '#ffd9c0'] : ['#c8553d', '#fff'], 160);
        break;
      case 'bossdie':
        for (let i = 0; i < 4; i++) P({ kind: 'ring', r: 10, grow: 300 + i * 80, life: 0.7 + i * 0.15, c: '#ffd23f' });
        burst(60, ['#ffd23f', '#ff6b4a', '#fff', '#b86bff'], 340, 1, 5);
        this.shake = 14;
        break;
      case 'splat':
        burst(10, ['#5ff23a', '#9dff6e'], 120, 0.4);
        break;
      case 'num':
        P({ kind: 'text', text: String(f.v), vy: -50, life: 0.7, c: f.c === 'crit' ? '#ffd23f' : '#fff', r: f.c === 'crit' ? 18 : 13 });
        break;
      case 'hurt':
        if (f.who === myId) this.shake = Math.max(this.shake, 4);
        P({ kind: 'text', text: `-${f.v}`, vy: -45, life: 0.8, c: '#ff5a5a', r: 14 });
        break;
      case 'level':
        P({ kind: 'ring', r: 10, grow: 90, life: 0.6, c: '#7fe0ff' });
        P({ kind: 'text', text: 'LEVEL UP!', vy: -40, life: 1.2, c: '#7fe0ff', r: 16 });
        break;
      case 'upgrade':
        burst(18, [Q_COLORS[f.v ?? 0], '#fff'], 140, 0.7);
        break;
      case 'heal':
        burst(16, ['#6bff8a', '#fff'], 100, 0.7);
        break;
      case 'chest':
        burst(24, f.c === 'loot' ? ['#ffd23f', '#fff'] : ['#ff5a7a', '#fff'], 160, 0.8);
        break;
      case 'phoenix':
        P({ kind: 'ring', r: 10, grow: 160, life: 0.8, c: '#ff8a2a' });
        burst(30, ['#ff8a2a', '#ffd23f', '#fff'], 200, 0.9);
        break;
      case 'die':
        burst(20, ['#ddd', '#888'], 150, 0.7);
        break;
      case 'poof':
      case 'spawn':
        burst(10, ['#cfc6ff', '#fff'], 80, 0.5);
        break;
      case 'pinch':
        P({ kind: 'ring', r: 4, grow: 50, life: 0.2, c: '#fff' });
        break;
      case 'thud':
        burst(4, ['#bbb'], 60, 0.25, 2);
        break;
    }
  }

  private buildFloor(stage: number) {
    const f = FLOORS[Math.floor((stage - 1) / 10) % FLOORS.length];
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d')!;
    c.fillStyle = f.wall;
    c.fillRect(0, 0, W, H);
    // stone tiles
    const T = 40;
    for (let y = WALL; y < H - WALL; y += T) {
      for (let x = WALL; x < W - WALL; x += T) {
        const odd = ((x / T) | 0) + ((y / T) | 0);
        c.fillStyle = odd % 2 ? f.a : f.b;
        c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(0,0,0,.12)';
        c.fillRect(x, y + T - 2, T, 2);
        c.fillRect(x + T - 2, y, 2, T);
        if ((x * 7 + y * 13) % 11 === 0) {
          c.strokeStyle = 'rgba(0,0,0,.18)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x + 8, y + 10);
          c.lineTo(x + 18, y + 20);
          c.lineTo(x + 15, y + 30);
          c.stroke();
        }
      }
    }
    // a rug down the middle on boss floors
    if (isBossStage(stage)) {
      c.fillStyle = 'rgba(140,20,40,.55)';
      c.fillRect(W / 2 - 60, WALL, 120, H - WALL * 2);
      c.strokeStyle = 'rgba(255,210,63,.6)';
      c.lineWidth = 3;
      c.strokeRect(W / 2 - 54, WALL + 4, 108, H - WALL * 2 - 8);
    }
    // wall top with battlements
    c.fillStyle = f.top;
    for (let x = 0; x < W; x += 32) {
      c.fillRect(x, 0, 22, 12);
      c.fillRect(x, H - 12, 22, 12);
    }
    for (let y = 0; y < H; y += 32) {
      c.fillRect(0, y, 12, 22);
      c.fillRect(W - 12, y, 12, 22);
    }
    c.strokeStyle = 'rgba(0,0,0,.4)';
    c.lineWidth = 3;
    c.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);
    this.floor = cv;
    this.floorStage = stage;
  }

  draw(s: State, me: string, t: number, dt: number, pos: (kind: string, id: number | string, x: number, y: number) => { x: number; y: number }) {
    const c = this.c;
    this.resize();
    c.setTransform(1, 0, 0, 1, 0, 0);
    // night sky around the tower
    c.fillStyle = '#0d0b1a';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    for (const st of this.stars) {
      c.fillStyle = `rgba(255,248,224,${0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + st.s) + st.s * 10))})`;
      c.fillRect(st.x * this.cv.width, st.y * this.cv.height, 1.5 + st.s, 1.5 + st.s);
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    c.setTransform(this.scale, 0, 0, this.scale, this.ox + sx, this.oy + sy);
    if (this.floorStage !== s.stage || !this.floor) this.buildFloor(s.stage);
    c.drawImage(this.floor!, 0, 0);
    this.drawStairs(s, t);
    // torches in the corners
    for (const [x, y] of [[WALL + 6, WALL + 6], [W - WALL - 6, WALL + 6], [WALL + 6, H - WALL - 6], [W - WALL - 6, H - WALL - 6]]) {
      const fl = 1 + Math.sin(t * 12 + x) * 0.15;
      const g = c.createRadialGradient(x, y, 2, x, y, 60 * fl);
      g.addColorStop(0, 'rgba(255,190,90,.35)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = g;
      c.fillRect(x - 60, y - 60, 120, 120);
      c.fillStyle = '#ffb347';
      c.beginPath();
      c.arc(x, y, 4 * fl, 0, TAU);
      c.fill();
    }
    // splotches under everything
    for (const sp of s.splotches) this.drawSplotch(sp.x, sp.y, sp.r, sp.t, sp.id);
    // chests
    const meP = s.players.find((p) => p.id === me);
    for (const ch of s.chests) this.drawChest(ch.x, ch.y, ch.kind, !!meP?.opened.includes(ch.id), t);

    // everything with a body, back to front
    type D = { y: number; f: () => void };
    const list: D[] = [];
    for (const pl of s.pillars) list.push({ y: pl.y, f: () => this.drawPillar(pl.x, pl.y, pl.r) });
    for (const e of s.enemies) {
      const p = pos('e', e.id, e.x, e.y);
      list.push({ y: p.y, f: () => this.drawEnemy(e, p.x, p.y, t) });
    }
    for (const pl of s.players) {
      if (!pl.role || pl.dead) continue;
      const p = pos('p', pl.id, pl.x, pl.y);
      list.push({ y: p.y, f: () => this.drawPlayer(pl, p.x, p.y, t, pl.id === me, s) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();

    for (const sh of s.shots) this.drawShot(sh);
    this.drawParticles(dt);

    // dark edges
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawStairs(s: State, t: number) {
    const c = this.c;
    const { x, y, w, h } = STAIRS;
    c.save();
    c.translate(x, y);
    c.fillStyle = '#2a241e';
    c.fillRect(-w / 2 - 6, -h / 2 - 16, w + 12, h + 16);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = i % 2 ? '#8a7f6e' : '#9c907c';
      c.fillRect(-w / 2 + i * 3, -h / 2 - 12 + i * 9, w - i * 6, 9);
    }
    if (!s.cleared) {
      // closed gate
      c.fillStyle = 'rgba(30,26,22,.9)';
      c.fillRect(-w / 2, -h / 2 - 12, w, h + 12);
      c.strokeStyle = '#6a6a72';
      c.lineWidth = 4;
      for (let i = -w / 2 + 8; i < w / 2; i += 12) {
        c.beginPath();
        c.moveTo(i, -h / 2 - 12);
        c.lineTo(i, h / 2);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(-w / 2, -h / 2);
      c.lineTo(w / 2, -h / 2);
      c.moveTo(-w / 2, h / 2 - 8);
      c.lineTo(w / 2, h / 2 - 8);
      c.stroke();
    } else {
      const a = 0.35 + 0.25 * Math.sin(t * 4);
      c.fillStyle = `rgba(255,230,120,${a})`;
      c.fillRect(-w / 2, -h / 2 - 12, w, h + 12);
      c.fillStyle = '#fff3b0';
      c.font = 'bold 22px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText('▲', 0, h / 2 + 22 + Math.sin(t * 5) * 3);
    }
    c.restore();
  }

  private drawPillar(x: number, y: number, r: number) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath();
    c.ellipse(x + 4, y + 6, r, r * 0.6, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#8f8676';
    c.strokeStyle = '#3d362d';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = '#a99f8c';
    c.beginPath();
    c.arc(x - r * 0.15, y - r * 0.15, r * 0.7, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.2)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, r * 0.45, 0, TAU);
    c.stroke();
  }

  private drawSplotch(x: number, y: number, r: number, life: number, id: number) {
    const c = this.c;
    const a = Math.min(1, life / 1);
    c.save();
    c.globalAlpha = 0.75 * a;
    c.fillStyle = '#3fd61c';
    // a blobby puddle: smooth curves through wobbly points
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU;
      const rr2 = r * (0.82 + 0.2 * Math.sin(id * 3 + i * 2.1));
      pts.push([x + Math.cos(ang) * rr2, y + Math.sin(ang) * rr2 * 0.72]);
    }
    c.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const a = pts[i % pts.length], b = pts[(i + 1) % pts.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (i === 0) c.moveTo(mx, my);
      else c.quadraticCurveTo(a[0], a[1], mx, my);
    }
    c.fill();
    for (let i = 0; i < 3; i++) {
      const ang = id + i * 2.3;
      c.beginPath();
      c.arc(x + Math.cos(ang) * r * 1.05, y + Math.sin(ang) * r * 0.8, r * 0.12, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#9dff6e';
    c.beginPath();
    c.ellipse(x - r * 0.2, y - r * 0.15, r * 0.3, r * 0.12, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  private drawChest(x: number, y: number, kind: 'loot' | 'health', opened: boolean, t: number) {
    const c = this.c;
    c.save();
    c.translate(x, y + (opened ? 0 : Math.sin(t * 3) * 2));
    if (!opened) {
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 44);
      g.addColorStop(0, kind === 'loot' ? 'rgba(255,210,63,.5)' : 'rgba(255,90,122,.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(-44, -44, 88, 88);
    }
    c.fillStyle = kind === 'loot' ? '#9a5a24' : '#f2f2f2';
    c.strokeStyle = '#2a160a';
    c.lineWidth = 2.5;
    rr(c, -18, -6, 36, 22, 3);
    c.fill();
    c.stroke();
    c.fillStyle = kind === 'loot' ? '#b8702f' : '#ffffff';
    c.beginPath();
    if (opened) c.roundRect(-18, -22, 36, 10, 3);
    else c.roundRect(-18, -16, 36, 12, [8, 8, 2, 2]);
    c.fill();
    c.stroke();
    if (kind === 'loot') {
      c.fillStyle = '#ffd23f';
      c.fillRect(-3, -8, 6, 8);
      c.strokeStyle = '#ffd23f';
      c.lineWidth = 2;
      c.strokeRect(-18, -6, 36, 22);
    } else {
      c.fillStyle = '#e8304a';
      c.fillRect(-3, -2, 6, 14);
      c.fillRect(-7, 2, 14, 6);
    }
    if (opened) {
      c.globalAlpha = 0.6;
      c.fillStyle = '#000';
      c.fillRect(-16, -6, 32, 4);
    }
    c.restore();
  }

  private bar(x: number, y: number, w: number, frac: number, color: string) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,.6)';
    c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    c.fillStyle = color;
    c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
  }

  private drawEnemy(e: Enemy, x: number, y: number, t: number) {
    const c = this.c;
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath();
    c.ellipse(0, e.r * 0.85, e.r * 0.9, e.r * 0.3, 0, 0, TAU);
    c.fill();
    if (e.boss) {
      // warning ring for the Teapot Titan's steam blast
      if ((e.boss === 'teapotTitan' || e.boss === 'archenemy') && e.state === 1 && e.kind === 'pot' && e.t <= 1) {
        c.strokeStyle = `rgba(255,80,60,${0.4 + 0.4 * Math.sin(t * 20)})`;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(0, 0, 150, 0, TAU);
        c.stroke();
      }
    }
    if (e.kind === 'pot' && e.fuse > 0) {
      c.strokeStyle = `rgba(255,80,60,${0.3 + 0.3 * Math.sin(t * 25)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, DMG.boomR, 0, TAU);
      c.stroke();
    }
    if (e.burnT > 0) {
      c.fillStyle = 'rgba(255,120,40,.5)';
      c.beginPath();
      c.arc(Math.sin(t * 9) * 4, -e.r * 0.8, e.r * 0.35, 0, TAU);
      c.fill();
    }
    if (e.state === 1 && e.kind === 'crab') {
      c.strokeStyle = 'rgba(255,60,60,.5)';
      c.setLineDash([6, 6]);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(e.dx * 160, e.dy * 160);
      c.stroke();
      c.setLineDash([]);
    }
    if (e.hurtT > 0) c.filter = 'brightness(2.2)';
    else if (e.slowT > 0) c.filter = 'hue-rotate(160deg) saturate(.7) brightness(1.2)';
    if (e.boss === 'archenemy') drawArchenemy(c, e.r, t, e.face);
    else drawMonster(c, e.kind, e.r, t, { fuse: e.fuse || (e.boss && e.state === 1 && e.kind === 'pot' ? 0.3 : 0), face: e.face, winding: e.state >= 1, moving: true });
    c.filter = 'none';
    if (e.boss && e.boss !== 'archenemy') crown(c, e.r, -e.r * (e.kind === 'cactus' ? 1.15 : 0.95));
    c.restore();
    if (!e.boss && e.hp < e.maxHp) this.bar(x, y - e.r - 12, e.r * 2, e.hp / e.maxHp, '#ff5a5a');
  }

  private drawPlayer(p: Player, x: number, y: number, t: number, mine: boolean, s: State) {
    const c = this.c;
    const color = PLAYER_COLORS[p.slot % PLAYER_COLORS.length];
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath();
    c.ellipse(0, 14, 13, 4.5, 0, 0, TAU);
    c.fill();
    // a ring in your color under you
    c.strokeStyle = color;
    c.lineWidth = mine ? 3 : 2;
    c.globalAlpha = 0.8;
    c.beginPath();
    c.ellipse(0, 14, 18, 6.5, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
    if (p.hurtT > 0) c.filter = 'brightness(2.2)';
    if (p.role === 'archer') {
      drawArcher(c, color, p.aim, t, p.moving, p.fireCd > 0 ? 0 : 1);
    } else {
      const r = MONSTERS[p.kind].r + 3;
      if (p.kind === 'pot' && p.fuse > 0) {
        c.strokeStyle = `rgba(255,80,60,${0.3 + 0.3 * Math.sin(t * 25)})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, DMG.boomR * 1.1, 0, TAU);
        c.stroke();
      }
      drawMonster(c, p.kind, r, t, { fuse: p.fuse, face: p.aim, winding: p.fireCd > 0.3, moving: p.moving });
      // aim pointer
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, r + 10, p.aim - 0.25, p.aim + 0.25);
      c.stroke();
    }
    c.filter = 'none';
    // choosing an upgrade: a shield bubble (no damage while picking)
    if (choosing(p)) {
      c.strokeStyle = 'rgba(140,220,255,.8)';
      c.fillStyle = 'rgba(140,220,255,.15)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, -2, 26 + Math.sin(t * 5) * 1.5, 0, TAU);
      c.fill();
      c.stroke();
    }
    c.restore();
    // orbs
    if (p.role === 'archer') {
      const n = up(p, 'orbs');
      for (let i = 0; i < n; i++) {
        const o = orbPos({ ...p, x, y }, i, n, s.time);
        const g = c.createRadialGradient(o.x, o.y, 1, o.x, o.y, 11);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.4, '#c58cff');
        g.addColorStop(1, 'rgba(160,90,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(o.x, o.y, 11, 0, TAU);
        c.fill();
      }
    }
    // name tag and health
    c.font = 'bold 11px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,.6)';
    const label = `${p.slot + 1} ${p.name}`;
    const w = c.measureText(label).width + 8;
    c.fillRect(x - w / 2, y - 46, w, 14);
    c.fillStyle = color;
    c.fillText(label, x, y - 35);
    this.bar(x, y - 30, 30, p.hp / p.maxHp, p.role === 'archer' ? '#5aff7a' : '#ff9a3a');
  }

  private drawShot(sh: Shot) {
    const c = this.c;
    if (sh.kind === 'glob') {
      const k = Math.min(1, sh.t / sh.dur);
      const hgt = Math.sin(k * Math.PI) * 70;
      // landing marker
      c.strokeStyle = 'rgba(95,242,58,.5)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(sh.tx, sh.ty, DMG.splotchR, DMG.splotchR * 0.7, 0, 0, TAU);
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath();
      c.ellipse(sh.x, sh.y, 7, 3, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#5ff23a';
      c.strokeStyle = '#1f6e0e';
      c.beginPath();
      c.arc(sh.x, sh.y - hgt, 8, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = '#c9ffb0';
      c.beginPath();
      c.arc(sh.x - 2, sh.y - hgt - 3, 2.5, 0, TAU);
      c.fill();
      return;
    }
    const a = Math.atan2(sh.vy, sh.vx);
    c.save();
    c.translate(sh.x, sh.y);
    c.rotate(a);
    if (sh.kind === 'arrow') {
      c.strokeStyle = sh.crit ? '#ffd23f' : '#d9c39a';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-14, 0);
      c.lineTo(6, 0);
      c.stroke();
      c.fillStyle = '#e8eef5';
      c.beginPath();
      c.moveTo(10, 0);
      c.lineTo(4, -3.5);
      c.lineTo(4, 3.5);
      c.fill();
      c.fillStyle = '#e04a3a';
      c.fillRect(-15, -3, 5, 2);
      c.fillRect(-15, 1, 5, 2);
    } else {
      c.fillStyle = '#fff6c9';
      c.strokeStyle = '#4a6a2a';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(9, 0);
      c.lineTo(-6, -3);
      c.lineTo(-6, 3);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  private drawParticles(dt: number) {
    const c = this.c;
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.t += dt;
      if (p.t >= p.life) continue;
      keep.push(p);
      const k = p.t / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dot') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      c.globalAlpha = 1 - k;
      if (p.kind === 'ring') {
        c.strokeStyle = p.c;
        c.lineWidth = 4 * (1 - k) + 1;
        c.beginPath();
        c.arc(p.x, p.y, p.r + (p.grow ?? 0) * k * 0.5, 0, TAU);
        c.stroke();
      } else if (p.kind === 'text') {
        c.font = `900 ${p.r}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,.7)';
        c.strokeText(p.text!, p.x, p.y);
        c.fillStyle = p.c;
        c.fillText(p.text!, p.x, p.y);
      } else {
        c.fillStyle = p.c;
        c.beginPath();
        c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, TAU);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    this.parts = keep.length > 600 ? keep.slice(-600) : keep;
  }
}

export const bossName = (e: Enemy) => (e.boss ? BOSSES[e.boss].name : MONSTERS[e.kind].name);

/** a small picture of a monster for buttons and cards (as a data URL) */
export function monsterPicture(kind: MonsterKind, size = 72): string {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  c.translate(size / 2, size / 2 + size * 0.05);
  drawMonster(c, kind, size * 0.3, 0.4, { face: 0, moving: false });
  return cv.toDataURL();
}

export function archerPicture(color: string, size = 72): string {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  c.translate(size / 2, size / 2 + 4);
  c.scale(size / 48, size / 48);
  drawArcher(c, color, -0.3, 0, false, 1);
  return cv.toDataURL();
}
