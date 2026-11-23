// Item icons, drawn with canvas paths so the bag, the hotbar and the belts share one look.
import type { ItemId } from './data';

type C = CanvasRenderingContext2D;

function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
function ingot(c: C, top: string, side: string) {
  c.fillStyle = side;
  c.beginPath();
  c.moveTo(-0.38, 0.1);
  c.lineTo(0.38, 0.1);
  c.lineTo(0.3, 0.3);
  c.lineTo(-0.3, 0.3);
  c.fill();
  c.fillStyle = top;
  c.beginPath();
  c.moveTo(-0.28, -0.2);
  c.lineTo(0.28, -0.2);
  c.lineTo(0.38, 0.1);
  c.lineTo(-0.38, 0.1);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.fillRect(-0.2, -0.16, 0.3, 0.05);
}
function lump(c: C, base: string, fleck?: string, crystal = false) {
  c.fillStyle = base;
  c.beginPath();
  c.moveTo(-0.32, 0.22);
  c.lineTo(-0.36, -0.06);
  c.lineTo(-0.12, -0.3);
  c.lineTo(0.2, -0.26);
  c.lineTo(0.36, 0.0);
  c.lineTo(0.26, 0.28);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.moveTo(-0.32, 0.22);
  c.lineTo(0.26, 0.28);
  c.lineTo(0.36, 0.0);
  c.lineTo(0.1, 0.12);
  c.fill();
  if (fleck) {
    c.fillStyle = fleck;
    if (crystal) {
      c.beginPath();
      c.moveTo(-0.05, -0.38);
      c.lineTo(0.08, -0.05);
      c.lineTo(-0.05, 0.16);
      c.lineTo(-0.18, -0.05);
      c.fill();
    } else
      for (const [x, y] of [[-0.14, -0.08], [0.1, -0.12], [0.02, 0.1], [-0.2, 0.1]]) {
        c.beginPath();
        c.arc(x, y, 0.06, 0, Math.PI * 2);
        c.fill();
      }
  }
}
function gearShape(c: C, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rad = i % 2 ? r : r * 1.3;
    c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.45)';
  c.beginPath();
  c.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  c.fill();
}
function box(c: C, top: string, front: string) {
  c.fillStyle = front;
  rr(c, -0.36, -0.1, 0.72, 0.44, 0.06);
  c.fill();
  c.fillStyle = top;
  rr(c, -0.36, -0.34, 0.72, 0.36, 0.06);
  c.fill();
}
function blade(c: C, color: string, hilt: string) {
  c.save();
  c.rotate(-Math.PI / 4);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-0.05, 0.1);
  c.lineTo(-0.05, -0.36);
  c.lineTo(0, -0.44);
  c.lineTo(0.05, -0.36);
  c.lineTo(0.05, 0.1);
  c.fill();
  c.fillStyle = hilt;
  c.fillRect(-0.16, 0.1, 0.32, 0.06);
  c.fillStyle = '#5a3a20';
  c.fillRect(-0.035, 0.16, 0.07, 0.2);
  c.restore();
}
function pickaxe(c: C, head: string) {
  c.save();
  c.rotate(-Math.PI / 4);
  c.fillStyle = '#7a5130';
  c.fillRect(-0.035, -0.3, 0.07, 0.7);
  c.strokeStyle = head;
  c.lineWidth = 0.1;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(0, 0.05, 0.36, -Math.PI * 0.85, -Math.PI * 0.15);
  c.stroke();
  c.restore();
}

/** Draws an item centred on (0,0), about 1 unit across. */
export function drawItem(c: C, id: ItemId) {
  c.lineJoin = 'round';
  switch (id) {
    case 'wood':
      c.fillStyle = '#7a4d27';
      rr(c, -0.38, -0.16, 0.7, 0.32, 0.12);
      c.fill();
      c.fillStyle = '#d8ad72';
      c.beginPath();
      c.ellipse(0.32, 0, 0.1, 0.16, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#a7743e';
      c.lineWidth = 0.03;
      c.beginPath();
      c.ellipse(0.32, 0, 0.05, 0.08, 0, 0, Math.PI * 2);
      c.stroke();
      break;
    case 'stone':
      lump(c, '#8e8b86');
      break;
    case 'coal':
      lump(c, '#2e2c2c', '#5a5656');
      break;
    case 'copper_ore':
      lump(c, '#8a7c70', '#e07a3e');
      break;
    case 'iron_ore':
      lump(c, '#8a8580', '#c9b8a8');
      break;
    case 'crystal':
      lump(c, '#5fb4e6', '#d4f4ff', true);
      break;
    case 'sand':
      c.fillStyle = '#e7cf8d';
      c.beginPath();
      c.ellipse(0, 0.1, 0.36, 0.2, 0, Math.PI, 0);
      c.lineTo(0.36, 0.2);
      c.lineTo(-0.36, 0.2);
      c.fill();
      break;
    case 'plank':
      c.fillStyle = '#c08a4e';
      c.fillRect(-0.36, -0.3, 0.72, 0.6);
      c.strokeStyle = '#8a5a2e';
      c.lineWidth = 0.04;
      for (const y of [-0.1, 0.1]) {
        c.beginPath();
        c.moveTo(-0.36, y);
        c.lineTo(0.36, y);
        c.stroke();
      }
      break;
    case 'brick':
      c.fillStyle = '#a8a39a';
      c.fillRect(-0.36, -0.3, 0.72, 0.6);
      c.strokeStyle = '#6e6a64';
      c.lineWidth = 0.04;
      c.strokeRect(-0.36, -0.3, 0.72, 0.6);
      c.beginPath();
      c.moveTo(-0.36, 0);
      c.lineTo(0.36, 0);
      c.moveTo(0, -0.3);
      c.lineTo(0, 0);
      c.moveTo(-0.18, 0);
      c.lineTo(-0.18, 0.3);
      c.moveTo(0.18, 0);
      c.lineTo(0.18, 0.3);
      c.stroke();
      break;
    case 'glass':
      c.fillStyle = 'rgba(190,235,255,.55)';
      c.fillRect(-0.32, -0.32, 0.64, 0.64);
      c.strokeStyle = '#e8fbff';
      c.lineWidth = 0.05;
      c.strokeRect(-0.32, -0.32, 0.64, 0.64);
      c.beginPath();
      c.moveTo(-0.18, 0.1);
      c.lineTo(0.08, -0.18);
      c.stroke();
      break;
    case 'copper':
      ingot(c, '#e8894a', '#a9552a');
      break;
    case 'iron':
      ingot(c, '#cfd4da', '#8a9098');
      break;
    case 'steel':
      ingot(c, '#7d8fa8', '#4b5a70');
      break;
    case 'gear':
      gearShape(c, 0.28, '#b8bec6');
      break;
    case 'wire':
      c.strokeStyle = '#e8894a';
      c.lineWidth = 0.07;
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = i * 0.7;
        c.lineTo(-0.3 + i * 0.03, Math.sin(a) * 0.2);
      }
      c.stroke();
      break;
    case 'circuit':
      c.fillStyle = '#2f8a4c';
      rr(c, -0.34, -0.28, 0.68, 0.56, 0.06);
      c.fill();
      c.strokeStyle = '#e8c35a';
      c.lineWidth = 0.04;
      c.beginPath();
      c.moveTo(-0.24, -0.14);
      c.lineTo(0, -0.14);
      c.lineTo(0.1, 0);
      c.lineTo(0.24, 0);
      c.moveTo(-0.24, 0.14);
      c.lineTo(0.14, 0.14);
      c.stroke();
      c.fillStyle = '#1a1a1a';
      c.fillRect(-0.1, -0.06, 0.14, 0.14);
      break;
    case 'lens':
      c.fillStyle = '#9fe4ff';
      c.beginPath();
      c.ellipse(0, 0, 0.3, 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#d2a64a';
      c.lineWidth = 0.07;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.beginPath();
      c.ellipse(-0.1, -0.1, 0.08, 0.05, -0.7, 0, Math.PI * 2);
      c.fill();
      break;
    case 'arrow':
      c.save();
      c.rotate(-Math.PI / 4);
      c.fillStyle = '#c9a26b';
      c.fillRect(-0.03, -0.32, 0.06, 0.64);
      c.fillStyle = '#9a9a9a';
      c.beginPath();
      c.moveTo(0, -0.44);
      c.lineTo(0.1, -0.3);
      c.lineTo(-0.1, -0.3);
      c.fill();
      c.fillStyle = '#e9e2d2';
      c.fillRect(-0.09, 0.22, 0.18, 0.12);
      c.restore();
      break;
    case 'berries':
      c.fillStyle = '#3b7a2e';
      c.beginPath();
      c.ellipse(0.08, -0.22, 0.14, 0.07, -0.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d43a5a';
      for (const [x, y] of [[-0.12, 0], [0.1, 0.04], [-0.02, 0.18], [0.02, -0.1]]) {
        c.beginPath();
        c.arc(x, y, 0.12, 0, Math.PI * 2);
        c.fill();
      }
      break;
    case 'apple':
      c.fillStyle = '#d93b2e';
      c.beginPath();
      c.arc(0, 0.04, 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#5a3a20';
      c.fillRect(-0.02, -0.34, 0.04, 0.14);
      c.fillStyle = '#4d9a3a';
      c.beginPath();
      c.ellipse(0.1, -0.26, 0.1, 0.05, -0.4, 0, Math.PI * 2);
      c.fill();
      break;
    case 'mushroom':
      c.fillStyle = '#efe6d2';
      c.fillRect(-0.08, -0.04, 0.16, 0.3);
      c.fillStyle = '#c8452f';
      c.beginPath();
      c.ellipse(0, -0.04, 0.32, 0.22, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(-0.12, -0.12, 0.05, 0, Math.PI * 2);
      c.arc(0.1, -0.16, 0.04, 0, Math.PI * 2);
      c.fill();
      break;
    case 'meat':
    case 'roast':
      c.fillStyle = id === 'meat' ? '#d4606a' : '#9a4f26';
      c.beginPath();
      c.ellipse(-0.06, 0, 0.26, 0.2, -0.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f1e7d6';
      c.fillRect(0.12, 0.04, 0.22, 0.07);
      c.beginPath();
      c.arc(0.34, 0.03, 0.06, 0, Math.PI * 2);
      c.arc(0.34, 0.12, 0.06, 0, Math.PI * 2);
      c.fill();
      break;
    case 'stew':
      c.fillStyle = '#6b4a2e';
      c.beginPath();
      c.ellipse(0, 0.06, 0.34, 0.22, 0, 0, Math.PI);
      c.fill();
      c.fillStyle = '#c9742e';
      c.beginPath();
      c.ellipse(0, 0.06, 0.32, 0.1, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e8d4a8';
      c.fillRect(-0.04, -0.3, 0.05, 0.3);
      break;
    case 'gloom':
      c.fillStyle = '#5b3fa8';
      c.beginPath();
      c.arc(0, 0, 0.26, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#b9a4ff';
      for (const [x, y] of [[-0.08, -0.06], [0.1, 0.06], [0.02, -0.14]]) {
        c.beginPath();
        c.arc(x, y, 0.05, 0, Math.PI * 2);
        c.fill();
      }
      break;
    case 'ember_core': {
      const g = c.createRadialGradient(0, 0, 0.02, 0, 0, 0.38);
      g.addColorStop(0, '#fff6c8');
      g.addColorStop(0.45, '#ffb347');
      g.addColorStop(1, 'rgba(255,90,30,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 0.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff7a2a';
      c.beginPath();
      c.moveTo(0, -0.22);
      c.lineTo(0.16, 0);
      c.lineTo(0, 0.22);
      c.lineTo(-0.16, 0);
      c.fill();
      break;
    }
    case 'campfire':
      c.fillStyle = '#6b4424';
      c.save();
      c.rotate(0.4);
      c.fillRect(-0.34, 0.08, 0.68, 0.12);
      c.rotate(-0.8);
      c.fillRect(-0.34, 0.08, 0.68, 0.12);
      c.restore();
      c.fillStyle = '#ff9a2e';
      c.beginPath();
      c.moveTo(-0.16, 0.1);
      c.quadraticCurveTo(-0.18, -0.2, 0, -0.38);
      c.quadraticCurveTo(0.18, -0.2, 0.16, 0.1);
      c.fill();
      c.fillStyle = '#ffe27a';
      c.beginPath();
      c.moveTo(-0.07, 0.1);
      c.quadraticCurveTo(-0.08, -0.08, 0, -0.18);
      c.quadraticCurveTo(0.08, -0.08, 0.07, 0.1);
      c.fill();
      break;
    case 'lamp':
      c.fillStyle = '#4a4a52';
      c.fillRect(-0.04, -0.1, 0.08, 0.44);
      c.fillStyle = '#ffe9a0';
      rr(c, -0.14, -0.38, 0.28, 0.3, 0.06);
      c.fill();
      c.strokeStyle = '#4a4a52';
      c.lineWidth = 0.05;
      c.stroke();
      break;
    case 'belt':
      c.fillStyle = '#3a3f45';
      rr(c, -0.38, -0.24, 0.76, 0.48, 0.08);
      c.fill();
      c.strokeStyle = '#e8b33a';
      c.lineWidth = 0.08;
      c.beginPath();
      c.moveTo(-0.2, -0.14);
      c.lineTo(-0.04, 0);
      c.lineTo(-0.2, 0.14);
      c.moveTo(0.06, -0.14);
      c.lineTo(0.22, 0);
      c.lineTo(0.06, 0.14);
      c.stroke();
      break;
    case 'drill':
      box(c, '#d39a3a', '#9a6a22');
      c.fillStyle = '#5a5f66';
      c.beginPath();
      c.moveTo(-0.12, 0.0);
      c.lineTo(0.12, 0.0);
      c.lineTo(0, 0.42);
      c.fill();
      break;
    case 'furnace':
      box(c, '#a19b92', '#77726b');
      c.fillStyle = '#ff8a2a';
      rr(c, -0.14, 0.02, 0.28, 0.2, 0.08);
      c.fill();
      break;
    case 'assembler':
      box(c, '#7c93b8', '#4f6488');
      c.save();
      c.translate(0, -0.16);
      gearShape(c, 0.12, '#dfe6f0');
      c.restore();
      break;
    case 'chest':
      box(c, '#b07a40', '#7c4f24');
      c.fillStyle = '#e8c35a';
      c.fillRect(-0.05, -0.08, 0.1, 0.12);
      break;
    case 'sky_engine': {
      c.fillStyle = '#3a3550';
      c.beginPath();
      c.moveTo(-0.34, 0.34);
      c.lineTo(0.34, 0.34);
      c.lineTo(0.2, 0.0);
      c.lineTo(-0.2, 0.0);
      c.fill();
      c.strokeStyle = '#ffb347';
      c.lineWidth = 0.05;
      c.beginPath();
      c.ellipse(0, -0.12, 0.34, 0.12, 0, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#9fe4ff';
      c.beginPath();
      c.moveTo(0, -0.42);
      c.lineTo(0.12, -0.12);
      c.lineTo(0, 0.08);
      c.lineTo(-0.12, -0.12);
      c.fill();
      break;
    }
    case 'pick_stone':
      pickaxe(c, '#8e8b86');
      break;
    case 'pick_iron':
      pickaxe(c, '#d6dbe2');
      break;
    case 'pick_crystal':
      pickaxe(c, '#7fd4ff');
      break;
    case 'sword_stone':
      blade(c, '#9a968e', '#6b4424');
      break;
    case 'sword_iron':
      blade(c, '#dfe4ea', '#8a6a3a');
      break;
    case 'sword_crystal':
      blade(c, '#8fe0ff', '#e8c35a');
      break;
    case 'bow':
      c.strokeStyle = '#8a5a2e';
      c.lineWidth = 0.08;
      c.beginPath();
      c.arc(-0.1, 0, 0.36, -Math.PI / 2.2, Math.PI / 2.2);
      c.stroke();
      c.strokeStyle = '#eee';
      c.lineWidth = 0.025;
      c.beginPath();
      c.moveTo(-0.1 + Math.cos(Math.PI / 2.2) * 0.36, -Math.sin(Math.PI / 2.2) * 0.36);
      c.lineTo(-0.1 + Math.cos(Math.PI / 2.2) * 0.36, Math.sin(Math.PI / 2.2) * 0.36);
      c.stroke();
      break;
  }
}

const cache = new Map<string, string>();
/** A data URL of an item's icon, for HTML. */
export function iconURL(id: ItemId, px = 64) {
  const key = id + px;
  let u = cache.get(key);
  if (u) return u;
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const c = cv.getContext('2d')!;
  c.translate(px / 2, px / 2);
  c.scale(px * 0.92, px * 0.92);
  drawItem(c, id);
  u = cv.toDataURL();
  cache.set(key, u);
  return u;
}
export const icon = (id: ItemId, cls = 'ew-ico') => `<img class="${cls}" src="${iconURL(id)}" alt="">`;
