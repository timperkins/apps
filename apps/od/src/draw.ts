import type { Game, Person, Vehicle } from './game';
import { inRect } from './game';
import { TH, TW, ZH, toScreen } from './iso';
import { GameMap, PALETTE, ROAD_BASES, T, isTall } from './map';

type Ctx = CanvasRenderingContext2D;

const shadeCache = new Map<string, string>();
export function shade(hex: string, f: number): string {
  const key = hex + f;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  const out = `rgb(${r},${g},${b})`;
  shadeCache.set(key, out);
  return out;
}

function poly(ctx: Ctx, pts: { sx: number; sy: number }[], fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function diamond(x: number, y: number, z = 0, s = 1) {
  const o = (1 - s) / 2;
  return [toScreen(x + o, y + o, z), toScreen(x + 1 - o, y + o, z), toScreen(x + 1 - o, y + 1 - o, z), toScreen(x + o, y + 1 - o, z)];
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// ---------- ground ----------

function drawGround(ctx: Ctx, m: GameMap, x: number, y: number, t: number, time: number, open: boolean) {
  const i = y * m.w + x;
  const d = diamond(x, y);
  const v = hash(x, y);
  switch (t) {
    case T.Grass:
    case T.Tree:
      poly(ctx, d, v < 0.5 ? '#7ec66b' : '#78bf65');
      if (v > 0.85) {
        const c = toScreen(x + 0.5, y + 0.5);
        ctx.fillStyle = v > 0.93 ? '#fff59d' : '#f48fb1';
        ctx.fillRect(c.sx - 2, c.sy - 2, 3, 3);
      }
      break;
    case T.Road: {
      poly(ctx, d, '#5b616a');
      const hRow = ROAD_BASES.includes(y);
      const vCol = ROAD_BASES.includes(x);
      const inH = ROAD_BASES.includes(y) || ROAD_BASES.includes(y - 1);
      const inV = ROAD_BASES.includes(x) || ROAD_BASES.includes(x - 1);
      ctx.strokeStyle = '#f5d76e';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      if (hRow && !inV) {
        const a = toScreen(x, y + 1);
        const b = toScreen(x + 1, y + 1);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      if (vCol && !inH) {
        const a = toScreen(x + 1, y);
        const b = toScreen(x + 1, y + 1);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // zebra crossings next to intersections
      if (inH && inV) break;
      break;
    }
    case T.Sidewalk:
      poly(ctx, d, v < 0.5 ? '#d3d1ca' : '#cbc9c1', '#b9b6ad');
      break;
    case T.Water: {
      const w = Math.sin(time * 1.5 + x * 0.7 + y * 0.4) * 0.5 + 0.5;
      poly(ctx, d, shade('#3f8fd8', 0.92 + w * 0.12));
      if (w > 0.9) {
        const c = toScreen(x + 0.5, y + 0.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.sx - 8, c.sy);
        ctx.quadraticCurveTo(c.sx, c.sy - 3, c.sx + 8, c.sy);
        ctx.stroke();
      }
      break;
    }
    case T.Sand:
      poly(ctx, d, v < 0.5 ? '#efdca4' : '#e9d59a');
      break;
    case T.Dock: {
      poly(ctx, d, '#ab7b4c');
      ctx.strokeStyle = '#8a5f37';
      ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        const a = toScreen(x + k / 4, y);
        const b = toScreen(x + k / 4, y + 1);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      break;
    }
    case T.Lot: {
      poly(ctx, d, '#6a6f77');
      if (x % 3 === 0) {
        const a = toScreen(x, y + 0.1);
        const b = toScreen(x, y + 0.9);
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      break;
    }
    case T.Plaza:
      poly(ctx, d, (x + y) % 2 ? '#e2d6bb' : '#d8cbae');
      break;
    case T.Door:
      poly(ctx, d, m.name === 'bank' ? '#efe6d2' : '#e2d6bb');
      poly(ctx, diamond(x, y, 0, 0.7), '#9c3d2a');
      poly(ctx, diamond(x, y, 0, 0.45), '#c0563c');
      break;
    case T.Laser: {
      poly(ctx, d, '#3a2a30');
      // flickering red laser beams just above the floor
      const on = Math.sin(time * 9 + x * 1.7 + y) > -0.6;
      ctx.strokeStyle = on ? 'rgba(255,40,60,0.95)' : 'rgba(255,40,60,0.35)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 3; k++) {
        const a = toScreen(x + k / 3, y, 0.12);
        const b = toScreen(x + k / 3, y + 1, 0.12);
        const c = toScreen(x, y + k / 3, 0.12);
        const e = toScreen(x + 1, y + k / 3, 0.12);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.moveTo(c.sx, c.sy);
        ctx.lineTo(e.sx, e.sy);
        ctx.stroke();
      }
      break;
    }
    case T.Floor:
    case T.Grate:
      if (m.restricted[i]) poly(ctx, d, (x + y) % 2 ? '#dccaca' : '#d2bfbf');
      else poly(ctx, d, (x + y) % 2 ? '#f1e8d6' : '#e7dcc6');
      if (t === T.Grate) {
        poly(ctx, diamond(x, y, 0, 0.75), open ? '#1d1f24' : '#5e646d');
        if (!open) {
          ctx.strokeStyle = '#2b2e33';
          ctx.lineWidth = 1.5;
          for (let k = 1; k < 5; k++) {
            const a = toScreen(x + 0.125 + k * 0.15, y + 0.125);
            const b = toScreen(x + 0.125 + k * 0.15, y + 0.875);
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }
      break;
    default:
      poly(ctx, d, '#999');
  }
}

// ---------- prisms ----------

function face(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) {
  return [toScreen(x0, y0, z0), toScreen(x1, y1, z0), toScreen(x1, y1, z1), toScreen(x0, y0, z1)];
}

function drawPrism(ctx: Ctx, m: GameMap, x: number, y: number, t: number, time: number) {
  const i = y * m.w + x;
  const h = m.heights[i] || 1;
  if (t === T.Tree) {
    const c = toScreen(x + 0.5, y + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(c.sx - 3, c.sy - 22, 6, 22);
    const v = hash(x, y);
    const g = v < 0.5 ? '#4e9a43' : '#5aa84c';
    ctx.fillStyle = shade(g, 0.85);
    ctx.beginPath();
    ctx.arc(c.sx, c.sy - 30, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.sx - 4, c.sy - 35, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(g, 1.2);
    ctx.beginPath();
    ctx.arc(c.sx - 7, c.sy - 39, 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const [top, left, right] = PALETTE[m.pal[i]] ?? PALETTE[0];
  poly(ctx, face(x, y + 1, x + 1, y + 1, 0, h), left);
  poly(ctx, face(x + 1, y, x + 1, y + 1, 0, h), right);
  poly(ctx, diamond(x, y, h), top);
  if (t === T.Building && h >= 1) {
    // windows on the faces we can see
    const lit = '#bfe3f7';
    for (let z = 0.3; z + 0.45 < h; z += 0.7) {
      if (m.tiles[i + m.w] !== T.Building) {
        poly(ctx, face(x + 0.25, y + 1, x + 0.75, y + 1, z, z + 0.35), lit);
      }
      if (m.tiles[i + 1] !== T.Building) {
        poly(ctx, face(x + 1, y + 0.25, x + 1, y + 0.75, z, z + 0.35), shade('#a9d0e6', 0.95));
      }
    }
  }
  if (t === T.Vent) {
    ctx.strokeStyle = '#596069';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      const a = toScreen(x + k / 4, y + 0.15, h);
      const b = toScreen(x + k / 4, y + 0.85, h);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
  }
  if (t === T.Vault) {
    const c = toScreen(x + 0.5, y + 1, h * 0.5);
    ctx.fillStyle = '#9e9e9e';
    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(c.sx, c.sy);
    ctx.rotate(time);
    ctx.fillStyle = '#424242';
    ctx.fillRect(-1.5, -8, 3, 16);
    ctx.restore();
  }
  if (t === T.Crate) {
    ctx.strokeStyle = '#5d4030';
    ctx.lineWidth = 2;
    for (const f of [face(x, y + 1, x + 1, y + 1, 0, h), face(x + 1, y, x + 1, y + 1, 0, h)]) {
      ctx.beginPath();
      ctx.moveTo(f[0].sx, f[0].sy);
      ctx.lineTo(f[2].sx, f[2].sy);
      ctx.moveTo(f[1].sx, f[1].sy);
      ctx.lineTo(f[3].sx, f[3].sy);
      ctx.stroke();
    }
  }
  if (t === T.Locked) {
    const c = toScreen(x + 0.5, y + 1, h * 0.45);
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(c.sx - 5, c.sy - 3, 10, 9);
    ctx.strokeStyle = '#ffca28';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.sx, c.sy - 4, 4, Math.PI, 0);
    ctx.stroke();
  }
}

// ---------- boxes (vehicles) ----------

function drawBox(
  ctx: Ctx,
  cx: number,
  cy: number,
  angle: number,
  len: number,
  wid: number,
  z0: number,
  z1: number,
  color: string,
  topColor?: string,
) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts = [
    [len / 2, wid / 2],
    [len / 2, -wid / 2],
    [-len / 2, -wid / 2],
    [-len / 2, wid / 2],
  ].map(([a, b]) => ({ x: cx + a * c - b * s, y: cy + a * s + b * c }));
  for (let k = 0; k < 4; k++) {
    const p0 = pts[k];
    const p1 = pts[(k + 1) % 4];
    // outward normal
    const ex = p1.x - p0.x;
    const ey = p1.y - p0.y;
    const nx = ey;
    const ny = -ex;
    const mx = (p0.x + p1.x) / 2 - cx;
    const my = (p0.y + p1.y) / 2 - cy;
    const sign = nx * mx + ny * my > 0 ? 1 : -1;
    const fx = nx * sign;
    const fy = ny * sign;
    if (fx + fy <= 0) continue;
    const l = Math.hypot(fx, fy) || 1;
    const f = 0.62 + 0.25 * (fx / l);
    poly(ctx, [toScreen(p0.x, p0.y, z0), toScreen(p1.x, p1.y, z0), toScreen(p1.x, p1.y, z1), toScreen(p0.x, p0.y, z1)], shade(color, f));
  }
  poly(
    ctx,
    pts.map((p) => toScreen(p.x, p.y, z1)),
    topColor ?? color,
  );
}

function drawVehicle(ctx: Ctx, v: Vehicle, g: Game, time: number) {
  const a = v.angle;
  const fwd = (d: number) => ({ x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d });
  const color = v.hit > 0 ? '#ffffff' : v.broken > 0 ? shade(v.color, 0.55) : v.color;
  // shadow
  if (v.kind !== 'ship') {
    const c = toScreen(v.x, v.y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy + 2, (v.len + v.wid) * 13, (v.len + v.wid) * 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  switch (v.kind) {
    case 'car':
    case 'sports':
    case 'cop': {
      drawBox(ctx, v.x, v.y, a, v.len * 0.92, v.wid * 0.98, 0, 0.18, '#222');
      drawBox(ctx, v.x, v.y, a, v.len, v.wid, 0.12, 0.12 + v.hgt * 0.62, color);
      const cab = fwd(v.kind === 'sports' ? -0.2 : -0.1);
      drawBox(ctx, cab.x, cab.y, a, v.len * 0.5, v.wid * 0.86, 0.12 + v.hgt * 0.62, 0.12 + v.hgt * 1.25, '#8fc9ea', color);
      if (v.kind === 'cop') {
        const on = Math.floor(time * 6) % 2 === 0 && v.driver === 'cop';
        const l1 = { x: cab.x - Math.sin(a) * 0.18, y: cab.y + Math.cos(a) * 0.18 };
        const l2 = { x: cab.x + Math.sin(a) * 0.18, y: cab.y - Math.cos(a) * 0.18 };
        const z = 0.12 + v.hgt * 1.25;
        drawBox(ctx, l1.x, l1.y, a, 0.18, 0.3, z, z + 0.12, on ? '#ff1744' : '#7f1d1d');
        drawBox(ctx, l2.x, l2.y, a, 0.18, 0.3, z, z + 0.12, on ? '#304ffe' : '#1a237e');
      }
      if (v.rental > 0 || v.mine) {
        const c = toScreen(v.x, v.y, 1.3);
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = v.mine ? '#f8bbd0' : '#b2dfdb';
        ctx.fillText(v.mine ? 'MY CAR' : `RENTAL ${Math.ceil(v.rental)}s`, c.sx, c.sy);
      }
      break;
    }
    case 'bus':
    case 'army': {
      drawBox(ctx, v.x, v.y, a, v.len * 0.94, v.wid * 0.98, 0, 0.2, '#222');
      drawBox(ctx, v.x, v.y, a, v.len, v.wid, 0.15, 0.6, color);
      drawBox(ctx, v.x, v.y, a, v.len, v.wid, 0.6, 0.95, v.kind === 'army' ? '#3b4a2a' : '#8fc9ea');
      drawBox(ctx, v.x, v.y, a, v.len, v.wid, 0.95, 1.12, color);
      if (v.kind === 'army') {
        const c = toScreen(v.x, v.y, 1.13);
        ctx.fillStyle = '#e8f5e9';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('★', c.sx, c.sy + 5);
      }
      break;
    }
    case 'tank': {
      drawBox(ctx, v.x, v.y, a, v.len, v.wid, 0, 0.3, '#3a3f2a');
      drawBox(ctx, v.x, v.y, a, v.len * 0.92, v.wid * 0.8, 0.3, 0.6, color);
      drawBox(ctx, v.x, v.y, v.turret, 1.1, 0.9, 0.6, 0.95, shade(color, 1.1));
      const b = { x: v.x + Math.cos(v.turret) * 1.0, y: v.y + Math.sin(v.turret) * 1.0 };
      drawBox(ctx, b.x, b.y, v.turret, 1.2, 0.18, 0.72, 0.86, '#3a3f2a');
      break;
    }
    case 'ship': {
      drawBox(ctx, v.x, v.y, a, v.len, v.wid, -0.2, v.hgt, color, '#c9a06a');
      // deck planks
      ctx.strokeStyle = 'rgba(120,80,40,0.35)';
      ctx.lineWidth = 1;
      for (let k = -1; k <= 1; k++) {
        const p0 = { x: v.x + Math.cos(a) * (-v.len / 2) - Math.sin(a) * k * 0.7, y: v.y + Math.sin(a) * (-v.len / 2) + Math.cos(a) * k * 0.7 };
        const p1 = { x: v.x + Math.cos(a) * (v.len / 2) - Math.sin(a) * k * 0.7, y: v.y + Math.sin(a) * (v.len / 2) + Math.cos(a) * k * 0.7 };
        const s0 = toScreen(p0.x, p0.y, v.hgt);
        const s1 = toScreen(p1.x, p1.y, v.hgt);
        ctx.beginPath();
        ctx.moveTo(s0.sx, s0.sy);
        ctx.lineTo(s1.sx, s1.sy);
        ctx.stroke();
      }
      // cabin at the front
      const cab = fwd(v.len / 2 - 1.3);
      drawBox(ctx, cab.x, cab.y, a, 1.4, 1.8, v.hgt, v.hgt + 0.8, '#eceff1', '#b0bec5');
      // helm wheel at the back
      const h = fwd(-v.len / 2 + 1.1);
      const hs = toScreen(h.x, h.y, v.hgt + 0.55);
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hs.sx, hs.sy, 8, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const ang = time * (g.vehicle === v ? 2 : 0) + (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(hs.sx - Math.cos(ang) * 11, hs.sy - Math.sin(ang) * 11);
        ctx.lineTo(hs.sx + Math.cos(ang) * 11, hs.sy + Math.sin(ang) * 11);
        ctx.stroke();
      }
      // mast and sail
      const mast = fwd(0.4);
      const ms = toScreen(mast.x, mast.y, v.hgt);
      const mt = toScreen(mast.x, mast.y, v.hgt + 4);
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ms.sx, ms.sy);
      ctx.lineTo(mt.sx, mt.sy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(250,250,245,0.92)';
      ctx.beginPath();
      ctx.moveTo(mt.sx, mt.sy + 6);
      ctx.quadraticCurveTo(mt.sx + 46, mt.sy + 50, mt.sx + 2, ms.sy - 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = g.captainDown ? '#e53935' : '#212121';
      ctx.beginPath();
      ctx.moveTo(mt.sx, mt.sy);
      ctx.lineTo(mt.sx + 22, mt.sy + 6 + Math.sin(time * 5) * 2);
      ctx.lineTo(mt.sx, mt.sy + 12);
      ctx.fill();
      break;
    }
  }
}

// ---------- people ----------

const DISGUISE_SUIT: Record<string, string> = { tophat: '#263238', cowboy: '#8d6e63', cap: '#1565c0', clown: '#ffeb3b', mustache: '#6d4c41' };

function drawPerson(ctx: Ctx, p: Person, g: Game, time: number) {
  const ground = toScreen(p.x, p.y, p.kind === 'player' ? (g.vehicle ? p.z : g.ground) : p.onShip ? p.z : 0);
  const s = toScreen(p.x, p.y, p.z);
  const isPlayer = p.kind === 'player';
  const dis = isPlayer ? g.wearing : null;
  const carried = g.lift?.driver === p;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const flash = p.hit > 0 && Math.floor(p.hit * 30) % 2 === 0;
  const shirt = flash ? '#fff' : dis && DISGUISE_SUIT[dis] ? DISGUISE_SUIT[dis] : p.shirt;

  if (p.ko > 0 || carried) {
    // lying down
    ctx.fillStyle = p.pants;
    ctx.fillRect(s.sx - 16, s.sy - 7, 10, 6);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(s.sx, s.sy - 5, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(s.sx + 12, s.sy - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    if (!carried) {
      for (let k = 0; k < 3; k++) {
        const ang = time * 4 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = '#ffee58';
        star(ctx, s.sx + 12 + Math.cos(ang) * 10, s.sy - 16 + Math.sin(ang) * 4, 4);
      }
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(s.sx + 10, s.sy - 7, 2, 2);
    }
    return;
  }

  const sw = p.moving ? Math.sin(p.walk * 2) * 3 : 0;
  const top = s.sy;
  // legs
  ctx.fillStyle = p.pants;
  ctx.fillRect(s.sx - 6, top - 10 + Math.max(0, sw * 0.3), 5, 10 - Math.max(0, sw * 0.3));
  ctx.fillRect(s.sx + 1, top - 10 + Math.max(0, -sw * 0.3), 5, 10 - Math.max(0, -sw * 0.3));
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(s.sx - 7 + sw * 0.4, top - 2, 6, 3);
  ctx.fillRect(s.sx + 1 - sw * 0.4, top - 2, 6, 3);

  // heater carries a fuel tank on the back
  if (p.kind === 'heater') {
    ctx.fillStyle = '#ef6c00';
    roundRect(ctx, s.sx - 10, top - 26, 6, 14, 3);
  }

  // body
  ctx.fillStyle = shirt;
  roundRect(ctx, s.sx - 8, top - 24, 16, 15, 5);
  if (isPlayer && !dis && !flash) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(s.sx - 8, top - 20, 16, 2.5);
    ctx.fillRect(s.sx - 8, top - 15, 16, 2.5);
  }
  if (p.kind === 'cop' || p.kind === 'guard') {
    ctx.fillStyle = '#ffd54f';
    star(ctx, s.sx - 3, top - 19, 2.5);
  }
  if (p.kind === 'sailor' && !flash) {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(s.sx - 8, top - 20, 16, 2);
    ctx.fillRect(s.sx - 8, top - 15, 16, 2);
  }
  if (p.kind === 'grenider') {
    ctx.fillStyle = '#33691e';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(s.sx - 5 + k * 5, top - 11, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (dis === 'tophat' && !flash) {
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(s.sx - 4, top - 24);
    ctx.lineTo(s.sx, top - 22);
    ctx.lineTo(s.sx - 4, top - 20);
    ctx.moveTo(s.sx + 4, top - 24);
    ctx.lineTo(s.sx, top - 22);
    ctx.lineTo(s.sx + 4, top - 20);
    ctx.fill();
  }

  // arms (one punches toward the facing direction)
  const fs = toScreen(p.fx, p.fy);
  const fl = Math.hypot(fs.sx, fs.sy) || 1;
  const ax = fs.sx / fl;
  const ay = fs.sy / fl;
  ctx.fillStyle = p.skin;
  const reach = p.punch > 0 ? 13 : 0;
  ctx.beginPath();
  ctx.arc(s.sx + ax * (6 + reach), top - 16 + ay * (3 + reach * 0.5), p.punch > 0 && isPlayer && g.upgrades.gloves ? 5 : 3.5, 0, Math.PI * 2);
  if (p.punch > 0 && isPlayer && g.upgrades.gloves) ctx.fillStyle = '#e53935';
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(s.sx - ax * 6, top - 15 - ay * 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // weapons for troops
  if (p.kind === 'lazor' || p.kind === 'heater') {
    ctx.strokeStyle = p.kind === 'lazor' ? '#7e57c2' : '#5d4037';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.sx + ax * 4, top - 15);
    ctx.lineTo(s.sx + ax * 18, top - 15 + ay * 8);
    ctx.stroke();
  }

  // head
  const hy = top - 30;
  ctx.fillStyle = flash ? '#fff' : p.skin;
  ctx.beginPath();
  ctx.arc(s.sx, hy, 7.5, 0, Math.PI * 2);
  ctx.fill();
  const facingDown = fs.sy > -0.3 * fl;
  const ex = ax * 2.5;
  if (facingDown) {
    ctx.fillStyle = '#222';
    if (p.sleeping) {
      ctx.fillRect(s.sx - 4 + ex, hy, 3, 1);
      ctx.fillRect(s.sx + 1 + ex, hy, 3, 1);
    } else {
      ctx.fillRect(s.sx - 3.5 + ex, hy - 1, 2, 2.5);
      ctx.fillRect(s.sx + 1.5 + ex, hy - 1, 2, 2.5);
    }
  }

  // hats, hair and masks
  switch (p.kind) {
    case 'player':
      if (!dis) {
        // robber beanie and eye mask
        ctx.fillStyle = '#1b1b1b';
        ctx.beginPath();
        ctx.arc(s.sx, hy - 2, 7.8, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(s.sx - 8, hy - 3, 16, 2);
        if (facingDown) {
          ctx.fillRect(s.sx - 7.5 + ex * 0.5, hy - 2, 15, 4.5);
          ctx.fillStyle = '#fff';
          ctx.fillRect(s.sx - 3.5 + ex, hy - 1, 2, 2);
          ctx.fillRect(s.sx + 1.5 + ex, hy - 1, 2, 2);
        }
      } else drawDisguise(ctx, dis, s.sx, hy, facingDown, ex);
      break;
    case 'cop':
    case 'guard':
      ctx.fillStyle = p.kind === 'cop' ? '#1b2f5e' : '#424242';
      ctx.beginPath();
      ctx.arc(s.sx, hy - 3, 7.8, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(s.sx - 9 + ax * 3, hy - 4, 18, 3);
      break;
    case 'grenider':
    case 'heater':
    case 'lazor':
      ctx.fillStyle = '#4a5a2a';
      ctx.beginPath();
      ctx.arc(s.sx, hy - 1, 9, Math.PI, 0);
      ctx.fill();
      if (p.kind === 'lazor' && facingDown) {
        ctx.fillStyle = '#b388ff';
        ctx.fillRect(s.sx - 6 + ex, hy - 2, 12, 4);
      }
      if (p.kind === 'heater' && facingDown) {
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(s.sx - 5 + ex, hy + 1, 10, 5);
      }
      break;
    case 'captain':
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath();
      ctx.ellipse(s.sx, hy - 6, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2a52';
      ctx.fillRect(s.sx - 8, hy - 7, 16, 3);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(s.sx - 2, hy - 9, 4, 3);
      if (facingDown) {
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.arc(s.sx + ex * 0.5, hy + 5, 6, 0, Math.PI);
        ctx.fill();
      }
      break;
    case 'sailor':
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.sx, hy - 4, 6.5, Math.PI, 0);
      ctx.fill();
      break;
    case 'bully':
      ctx.fillStyle = '#303030';
      ctx.beginPath();
      ctx.arc(s.sx, hy - 1, 8.5, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      break;
    default:
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.arc(s.sx, hy - 2, 7.6, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
  }

  if (p.sleeping) {
    ctx.fillStyle = '#e3f2fd';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'left';
    const b = (time * 0.8) % 1;
    ctx.globalAlpha = 1 - b;
    ctx.fillText('Z', s.sx + 8 + b * 8, hy - 8 - b * 14);
    ctx.globalAlpha = 1;
    ctx.fillText('z', s.sx + 10, hy - 6);
  }
  if (p.tired) {
    ctx.fillStyle = '#90caf9';
    ctx.beginPath();
    ctx.arc(s.sx + 9, hy - 2 + ((time * 20) % 8), 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // health bar for tough enemies
  if ((p.kind === 'captain' || p.kind === 'heater' || p.kind === 'grenider' || p.kind === 'lazor') && p.hp < p.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(s.sx - 14, hy - 18, 28, 4);
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(s.sx - 14, hy - 18, (28 * Math.max(0, p.hp)) / p.maxHp, 4);
  }
}

function drawDisguise(ctx: Ctx, dis: string, x: number, hy: number, down: boolean, ex: number) {
  switch (dis) {
    case 'cap':
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(x, hy - 3, 7.8, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 2 + ex * 2, hy - 4, 12, 3);
      if (down) {
        ctx.fillStyle = '#111';
        ctx.fillRect(x - 6 + ex, hy - 2, 5, 3.5);
        ctx.fillRect(x + 1 + ex, hy - 2, 5, 3.5);
      }
      break;
    case 'mustache':
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.arc(x, hy - 3, 7.6, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      if (down) {
        ctx.beginPath();
        ctx.ellipse(x - 2.5 + ex, hy + 3, 3.5, 1.8, 0.3, 0, Math.PI * 2);
        ctx.ellipse(x + 2.5 + ex, hy + 3, 3.5, 1.8, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'cowboy':
      ctx.fillStyle = '#8d5524';
      ctx.beginPath();
      ctx.ellipse(x, hy - 5, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 6, hy - 13, 12, 9);
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(x - 6, hy - 7, 12, 2);
      break;
    case 'clown':
      for (const [dx, dy, c] of [
        [-8, -2, '#e53935'],
        [8, -2, '#1e88e5'],
        [-5, -7, '#43a047'],
        [5, -7, '#fdd835'],
        [0, -9, '#8e24aa'],
      ] as [number, number, string][]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + dx, hy + dy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (down) {
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(x + ex, hy + 2, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'tophat':
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(x, hy - 5, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 6, hy - 18, 12, 13);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(x - 6, hy - 9, 12, 2);
      break;
  }
}

function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function outlinedText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 4);
  ctx.strokeStyle = 'rgba(30,20,10,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function bubble(ctx: Ctx, text: string, x: number, y: number) {
  ctx.font = 'bold 12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 14;
  const h = 20;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, 8);
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x, y + 6);
  ctx.lineTo(x + 4, y);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 6);
}

// ---------- main render ----------

export function render(ctx: Ctx, g: Game, W: number, H: number, zoom: number, time: number) {
  const m = g.scene.map;
  const cam = toScreen(g.cam.x, g.cam.y);
  ctx.fillStyle = m.name === 'bank' ? '#1d1b22' : '#3f8fd8';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-Math.round(cam.sx), -Math.round(cam.sy));
  const halfW = W / 2 / zoom + TW;
  const halfH = H / 2 / zoom;
  const visible = (x: number, y: number) => {
    const s = toScreen(x + 0.5, y + 0.5);
    return Math.abs(s.sx - cam.sx) < halfW && s.sy - cam.sy > -halfH - TH && s.sy - cam.sy < halfH + 4 * ZH;
  };

  const ventOpen = (x: number, y: number) => g.scene === g.bank && g.inVent && Math.floor(g.player.x) === x && Math.floor(g.player.y) === y;
  const drawables: { d: number; f: () => void }[] = [];
  const pl = g.player;
  const pd = pl.x + pl.y;
  const pdx = pl.x - pl.y;
  // Only look at tiles near the camera; the city is big.
  const R = (halfW / (TW / 2) + (halfH + 4 * ZH + TH) / (TH / 2)) / 2 + 2;
  const xs = Math.max(0, Math.floor(g.cam.x - R));
  const xe = Math.min(m.w - 1, Math.ceil(g.cam.x + R));
  const ys = Math.max(0, Math.floor(g.cam.y - R));
  const ye = Math.min(m.h - 1, Math.ceil(g.cam.y + R));
  for (let y = ys; y <= ye; y++)
    for (let x = xs; x <= xe; x++) {
      if (!visible(x, y)) continue;
      const t = m.tiles[y * m.w + x];
      drawGround(ctx, m, x, y, t, time, ventOpen(x, y));
      if (isTall(t)) {
        const h = m.heights[y * m.w + x] || 1;
        const d = x + y + 1;
        const fade = !g.vehicle && !g.inVent && t !== T.Vent && d > pd + 0.2 && d - pd < h * 2.4 + 1.5 && Math.abs(x - y - pdx) < 2.2 && h > 0.7;
        drawables.push({
          d,
          f: () => {
            if (fade) ctx.globalAlpha = 0.38;
            drawPrism(ctx, m, x, y, t, time);
            ctx.globalAlpha = 1;
          },
        });
      }
    }

  const shipD = g.ship.x + g.ship.y;
  for (const v of g.scene.vehicles) {
    if (!visible(Math.floor(v.x), Math.floor(v.y)) && v.kind !== 'ship') continue;
    drawables.push({ d: v.x + v.y, f: () => drawVehicle(ctx, v, g, time) });
  }
  for (const p of g.scene.people) {
    if (p.kind === 'player') continue;
    if (!visible(Math.floor(p.x), Math.floor(p.y))) continue;
    let d = p.x + p.y;
    if (g.scene === g.city && (p.onShip || inRect(g.ship, p.x, p.y))) d = Math.max(d, shipD + 4.5);
    if (g.lift?.driver === p) d = pd + 0.05;
    drawables.push({ d, f: () => drawPerson(ctx, p, g, time) });
  }
  if (!g.vehicle || g.vehicle.kind === 'ship') {
    let d = pd;
    if (g.scene === g.city && inRect(g.ship, pl.x, pl.y)) d = Math.max(d, shipD + 4.5);
    if (g.inVent) d += 0.6;
    d += g.ground; // standing on a crate draws you on top of it
    drawables.push({
      d,
      f: () => {
        if (g.inVent) {
          // crouch down while crawling through the ducts
          const base = toScreen(pl.x, pl.y, pl.z);
          ctx.save();
          ctx.translate(base.sx, base.sy);
          ctx.scale(1, 0.6);
          ctx.translate(-base.sx, -base.sy);
          drawPerson(ctx, pl, g, time);
          ctx.restore();
        } else drawPerson(ctx, pl, g, time);
      },
    });
  }
  drawables.sort((a, b) => a.d - b.d);
  for (const dr of drawables) dr.f();

  // shots
  for (const s of g.scene.shots) {
    const p = toScreen(s.x, s.y, s.z);
    if (s.kind === 'laser') {
      const b = toScreen(s.x - s.vx * 0.04, s.y - s.vy * 0.04, s.z);
      ctx.strokeStyle = '#18ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (s.kind === 'flame') {
      const k = 1 - s.t / 0.45;
      ctx.fillStyle = k < 0.4 ? 'rgba(255,235,59,0.9)' : k < 0.7 ? 'rgba(255,152,0,0.8)' : 'rgba(244,81,30,0.5)';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 4 + k * 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sh = toScreen(s.x, s.y, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(sh.sx, sh.sy, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.kind === 'grenade' ? '#33691e' : '#37474f';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, s.kind === 'grenade' ? 4.5 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // signs
  for (const l of m.labels) {
    const p = toScreen(l.x, l.y, l.z);
    ctx.font = '900 15px system-ui, sans-serif';
    const w = ctx.measureText(l.text).width + 16;
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(p.sx - w / 2, p.sy - 13, w, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = l.color;
    ctx.textAlign = 'center';
    ctx.fillText(l.text, p.sx, p.sy + 5);
  }

  // effects
  for (const f of g.scene.fx) {
    const k = f.t / f.life;
    if (f.kind === 'text') {
      const p = toScreen(f.x, f.y, f.z + k * 1.2);
      ctx.globalAlpha = 1 - k * k;
      outlinedText(ctx, f.text, p.sx, p.sy, 18 * f.size * (k < 0.15 ? 0.6 + k * 2.6 : 1), f.color);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'boom') {
      const p = toScreen(f.x, f.y, f.z);
      const r = (12 + k * 30) * f.size;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy - r * 0.2, r * 0.7, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bdbdbd';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(p.sx + Math.cos(a) * r, p.sy + Math.sin(a) * r * 0.5 - k * 20, 8 * f.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'smoke') {
      const p = toScreen(f.x, f.y, f.z + k * 1.5);
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 6 + k * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (f.kind === 'splash') {
      const p = toScreen(f.x, f.y, 0);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#e1f5fe';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(p.sx + Math.cos(a) * k * 22, p.sy + Math.sin(a) * k * 11 - Math.sin(k * Math.PI) * 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      outlinedText(ctx, f.text, p.sx, p.sy - 30 - k * 20, 16, '#b3e5fc');
      ctx.globalAlpha = 1;
    }
  }

  // speech bubbles
  for (const p of g.scene.people) {
    if (p.sayT <= 0 || !p.say || p.ko > 0) continue;
    const s = toScreen(p.x, p.y, p.z);
    ctx.globalAlpha = Math.min(1, p.sayT * 3);
    bubble(ctx, p.say, s.sx, s.sy - 44);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- phone map ----------

const MAP_COLORS: Record<number, string> = {
  [T.Grass]: '#86c873',
  [T.Tree]: '#4e9a43',
  [T.Road]: '#5b616a',
  [T.Sidewalk]: '#d3d1ca',
  [T.Water]: '#4a97dc',
  [T.Sand]: '#efdca4',
  [T.Dock]: '#ab7b4c',
  [T.Lot]: '#6a6f77',
  [T.Plaza]: '#e2d6bb',
  [T.Door]: '#c0563c',
};

function drawMapTiles(
  ctx: Ctx,
  m: GameMap,
  P: (x: number, y: number) => { x: number; y: number },
  tw: number,
  th: number,
  cx: number,
  cy: number,
  r: number,
) {
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(m.h, cy + r); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(m.w, cx + r); x++) {
      const t = m.tiles[y * m.w + x];
      if (t === T.Water) continue;
      const c = t === T.Building ? PALETTE[m.pal[y * m.w + x]][0] : MAP_COLORS[t] ?? '#999';
      const p = P(x, y);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + tw / 2 + 0.3, p.y + th / 2);
      ctx.lineTo(p.x, p.y + th + 0.3);
      ctx.lineTo(p.x - tw / 2 - 0.3, p.y + th / 2);
      ctx.fill();
    }
}

let mapCache: { map: GameMap; img: HTMLCanvasElement } | null = null;

export function drawMinimap(canvas: HTMLCanvasElement, g: Game, near: boolean) {
  const ctx = canvas.getContext('2d')!;
  const m = g.city.map;
  const W = canvas.width;
  const H = canvas.height;
  const me = g.scene === g.city ? g.vehicle ?? g.player : g.bankReturn;
  // iso diamond map so "up" matches the game
  const span = m.w + m.h;
  const s = near ? 5 : Math.min(W / (span * 0.5 * 2), H / (span * 0.5));
  const tw = s * 2;
  const th = s;
  const ox = near ? W / 2 - ((me.x - me.y) * tw) / 2 : W / 2 - ((m.w - m.h) * tw) / 4;
  const oy = near ? H / 2 - ((me.x + me.y) * th) / 2 : H / 2 - ((m.w + m.h) * th) / 4;
  const P = (x: number, y: number) => ({ x: ox + ((x - y) * tw) / 2, y: oy + ((x + y) * th) / 2 });
  if (near) {
    ctx.fillStyle = '#4a97dc';
    ctx.fillRect(0, 0, W, H);
    drawMapTiles(ctx, m, P, tw, th, me.x, me.y, 60);
  } else {
    if (!mapCache || mapCache.map !== m || mapCache.img.width !== W) {
      const img = document.createElement('canvas');
      img.width = W;
      img.height = H;
      const ictx = img.getContext('2d')!;
      ictx.fillStyle = '#4a97dc';
      ictx.fillRect(0, 0, W, H);
      drawMapTiles(ictx, m, P, tw, th, m.w / 2, m.h / 2, span);
      mapCache = { map: m, img };
    }
    ctx.drawImage(mapCache.img, 0, 0);
  }
  const pin = (x: number, y: number, label: string, color: string) => {
    const p = P(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, near ? 7 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!near && label !== 'Ship') return;
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(label, p.x, p.y - 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, p.x, p.y - 10);
  };
  for (const [i, place] of m.places) {
    const x = i % m.w;
    const y = Math.floor(i / m.w);
    if (place === 'shop' && m.places.get(i - 1) === 'shop') continue;
    if (place === 'bank' && m.places.get(i - 1) === 'bank') continue;
    const names: Record<string, [string, string]> = {
      bank: ['Bank', '#f9a825'],
      shop: ['Shop', '#fb8c00'],
      lot: ['Cars', '#43a047'],
      home: ['Home', '#e53935'],
    };
    const n = names[place];
    if (n) pin(x + 0.5, y + 0.5, n[0], n[1]);
  }
  pin(g.ship.x, g.ship.y, 'Ship', '#00838f');
  for (const pol of m.spawns.police) pin(pol.x, pol.y - 2, 'Police', '#1e40af');
  for (const p of g.city.people)
    if (p.hostile && p.ko === 0 && p.kind !== 'bully') {
      const q = P(p.x, p.y);
      ctx.fillStyle = p.kind === 'cop' ? '#2962ff' : '#558b2f';
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
  if (g.myCar && !g.myCar.gone) {
    const q = P(g.myCar.x, g.myCar.y);
    ctx.fillStyle = '#d81b60';
    ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
  }
  const q = P(me.x, me.y);
  const pulse = 7 + Math.sin(performance.now() / 150) * 2;
  ctx.fillStyle = 'rgba(255,23,68,0.3)';
  ctx.beginPath();
  ctx.arc(q.x, q.y, pulse + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff1744';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '900 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText('YOU', q.x, q.y + 20);
  ctx.fillText('YOU', q.x, q.y + 20);
}
