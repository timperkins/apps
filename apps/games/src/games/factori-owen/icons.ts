// Procedural item icons, drawn in a 1x1 unit space and cached as canvases / data URLs.
import { ITEMS, type ItemId } from './data';
import { drawEntityIcon, LIQUID_COLOR } from './art';

type Ctx = CanvasRenderingContext2D;

function rocks(c: Ctx, base: string, light: string, fleck: string, seed: number) {
  const pts: [number, number, number][] = [
    [0.36, 0.6, 0.22], [0.64, 0.62, 0.2], [0.5, 0.38, 0.2], [0.26, 0.38, 0.13], [0.74, 0.36, 0.12],
  ];
  pts.forEach(([x, y, r], i) => {
    c.fillStyle = 'rgba(0,0,0,.35)';
    blob(c, x + 0.02, y + 0.04, r, seed + i);
    c.fill();
    c.fillStyle = base;
    blob(c, x, y, r, seed + i);
    c.fill();
    c.fillStyle = light;
    blob(c, x - r * 0.25, y - r * 0.3, r * 0.45, seed + i + 9);
    c.fill();
    c.fillStyle = fleck;
    c.beginPath();
    c.arc(x + r * 0.3, y + r * 0.1, r * 0.16, 0, Math.PI * 2);
    c.fill();
  });
}

function blob(c: Ctx, x: number, y: number, r: number, seed: number) {
  c.beginPath();
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.8 + 0.25 * Math.sin(seed * 12.9898 + i * 78.233);
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function plate(c: Ctx, base: string, edge: string, shine: string, emblem: boolean) {
  for (let k = 2; k >= 0; k--) {
    const o = k * 0.06;
    c.fillStyle = edge;
    roundRect(c, 0.16 + o, 0.22 + o * 0.6, 0.62, 0.5, 0.08);
    c.fill();
    c.fillStyle = base;
    roundRect(c, 0.16 + o, 0.2 + o * 0.6, 0.62, 0.46, 0.08);
    c.fill();
  }
  c.fillStyle = shine;
  c.fillRect(0.22, 0.25, 0.5, 0.05);
  if (emblem) owenO(c, 0.47, 0.43, 0.12, edge);
}

/** The Owen emblem: a bold "O" with a little smile. */
export function owenO(c: Ctx, x: number, y: number, r: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = r * 0.42;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = r * 0.22;
  c.beginPath();
  c.arc(x, y + r * 0.05, r * 0.45, 0.2 * Math.PI, 0.8 * Math.PI);
  c.stroke();
}

export function gear(c: Ctx, x: number, y: number, r: number, teeth: number, rot: number, fill: string, hole: string) {
  c.fillStyle = fill;
  c.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = rot + (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.78;
    const a0 = a - Math.PI / (teeth * 2) * 0.9, a1 = a + Math.PI / (teeth * 2) * 0.9;
    c.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
    c.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
  }
  c.closePath();
  c.fill();
  c.fillStyle = hole;
  c.beginPath();
  c.arc(x, y, r * 0.3, 0, Math.PI * 2);
  c.fill();
}

function flask(c: Ctx, liquid: string, glow: string) {
  c.fillStyle = 'rgba(220,235,255,.25)';
  c.strokeStyle = '#e8eef7';
  c.lineWidth = 0.04;
  c.beginPath();
  c.moveTo(0.42, 0.12);
  c.lineTo(0.58, 0.12);
  c.lineTo(0.58, 0.36);
  c.lineTo(0.8, 0.8);
  c.quadraticCurveTo(0.82, 0.88, 0.74, 0.88);
  c.lineTo(0.26, 0.88);
  c.quadraticCurveTo(0.18, 0.88, 0.2, 0.8);
  c.lineTo(0.42, 0.36);
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = liquid;
  c.fillRect(0, 0.52, 1, 0.5);
  c.fillStyle = glow;
  c.beginPath();
  c.arc(0.4, 0.7, 0.05, 0, Math.PI * 2);
  c.arc(0.6, 0.62, 0.035, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.stroke();
  c.fillStyle = '#8a6a4a';
  c.fillRect(0.4, 0.06, 0.2, 0.08);
}

export function drawItem(c: Ctx, item: ItemId) {
  switch (item) {
    case 'wood':
      c.fillStyle = '#6b4424';
      roundRect(c, 0.12, 0.38, 0.7, 0.28, 0.12);
      c.fill();
      c.fillStyle = '#c9965c';
      c.beginPath();
      c.ellipse(0.78, 0.52, 0.1, 0.14, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#8b5e34';
      c.lineWidth = 0.025;
      c.beginPath();
      c.ellipse(0.78, 0.52, 0.05, 0.07, 0, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#4f9a45';
      c.beginPath();
      c.ellipse(0.34, 0.34, 0.08, 0.04, -0.5, 0, Math.PI * 2);
      c.fill();
      break;
    case 'coal': rocks(c, '#26262b', '#4a4a55', '#111', 3); break;
    case 'stone': rocks(c, '#a39580', '#c9bca6', '#7c705f', 5); break;
    case 'owen-ore': rocks(c, '#4f63b8', '#8fa2ec', '#e7ecff', 7); break;
    case 'copper-ore': rocks(c, '#a85a2e', '#e08a52', '#4fb39a', 11); break;
    case 'owen-plate': plate(c, '#9fb0e6', '#5466a8', '#dbe3ff', true); break;
    case 'copper-plate': plate(c, '#e09160', '#9a5530', '#ffd0ad', false); break;
    case 'steel-plate': plate(c, '#c9ced8', '#5c6270', '#ffffff', true); break;
    case 'stone-brick':
      c.fillStyle = '#8a7a66';
      roundRect(c, 0.14, 0.3, 0.72, 0.42, 0.05);
      c.fill();
      c.fillStyle = '#c4ae8e';
      roundRect(c, 0.14, 0.26, 0.72, 0.4, 0.05);
      c.fill();
      c.strokeStyle = '#8a7a66';
      c.lineWidth = 0.03;
      c.beginPath();
      c.moveTo(0.14, 0.46); c.lineTo(0.86, 0.46);
      c.moveTo(0.5, 0.26); c.lineTo(0.5, 0.46);
      c.moveTo(0.32, 0.46); c.lineTo(0.32, 0.66);
      c.moveTo(0.68, 0.46); c.lineTo(0.68, 0.66);
      c.stroke();
      break;
    case 'owen-gear':
      gear(c, 0.52, 0.54, 0.36, 9, 0.1, '#30406f', 'transparent');
      gear(c, 0.5, 0.5, 0.36, 9, 0.1, '#9fb0e6', '#30406f');
      owenO(c, 0.5, 0.5, 0.06, '#dbe3ff');
      break;
    case 'owen-stick':
      c.lineCap = 'round';
      for (const [o, col] of [[0, '#5466a8'], [0.14, '#9fb0e6']] as const) {
        c.strokeStyle = col;
        c.lineWidth = 0.1;
        c.beginPath();
        c.moveTo(0.22 + o, 0.82);
        c.lineTo(0.62 + o, 0.18);
        c.stroke();
      }
      break;
    case 'copper-cable':
      c.strokeStyle = '#c96f3b';
      c.lineWidth = 0.06;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.ellipse(0.5, 0.5, 0.28 - i * 0.05, 0.22 - i * 0.04, 0.3, 0, Math.PI * 2);
        c.stroke();
      }
      c.strokeStyle = '#ffc39a';
      c.lineWidth = 0.02;
      c.beginPath();
      c.ellipse(0.5, 0.5, 0.28, 0.22, 0.3, 3.6, 5);
      c.stroke();
      break;
    case 'circuit':
      c.fillStyle = '#16525a';
      roundRect(c, 0.14, 0.2, 0.72, 0.6, 0.06);
      c.fill();
      c.fillStyle = '#2b8f8a';
      roundRect(c, 0.14, 0.17, 0.72, 0.58, 0.06);
      c.fill();
      c.strokeStyle = '#f2c14e';
      c.lineWidth = 0.035;
      c.beginPath();
      c.moveTo(0.2, 0.3); c.lineTo(0.4, 0.3); c.lineTo(0.48, 0.42);
      c.moveTo(0.2, 0.6); c.lineTo(0.36, 0.6); c.lineTo(0.44, 0.5);
      c.moveTo(0.8, 0.3); c.lineTo(0.62, 0.3);
      c.moveTo(0.8, 0.62); c.lineTo(0.62, 0.62);
      c.stroke();
      c.fillStyle = '#1b1f2a';
      c.fillRect(0.44, 0.36, 0.2, 0.22);
      break;
    case 'owen-ammo':
      c.fillStyle = '#5466a8';
      roundRect(c, 0.2, 0.3, 0.6, 0.5, 0.06);
      c.fill();
      c.fillStyle = '#9fb0e6';
      roundRect(c, 0.2, 0.26, 0.6, 0.46, 0.06);
      c.fill();
      for (let i = 0; i < 3; i++) {
        c.fillStyle = '#e0a53c';
        c.fillRect(0.28 + i * 0.16, 0.12, 0.1, 0.2);
        c.beginPath();
        c.arc(0.33 + i * 0.16, 0.12, 0.05, Math.PI, 0);
        c.fill();
      }
      owenO(c, 0.5, 0.5, 0.1, '#30406f');
      break;
    case 'rail-ammo':
      c.save();
      c.translate(0.5, 0.5);
      c.rotate(-0.7);
      c.fillStyle = '#5c6270';
      c.fillRect(-0.38, -0.1, 0.6, 0.2);
      c.fillStyle = '#c9ced8';
      c.beginPath();
      c.moveTo(0.22, -0.1);
      c.lineTo(0.42, 0);
      c.lineTo(0.22, 0.1);
      c.fill();
      c.fillStyle = '#5adcff';
      c.fillRect(-0.3, -0.04, 0.48, 0.08);
      c.restore();
      break;
    case 'rail-gun':
      c.save();
      c.translate(0.5, 0.52);
      c.rotate(-0.5);
      c.fillStyle = '#39424f';
      c.fillRect(-0.42, -0.08, 0.84, 0.16);
      c.fillStyle = '#7d8a9b';
      c.fillRect(-0.1, -0.13, 0.58, 0.06);
      c.fillRect(-0.1, 0.07, 0.58, 0.06);
      c.fillStyle = '#5adcff';
      c.fillRect(0, -0.03, 0.42, 0.06);
      c.fillStyle = '#6b4126';
      c.fillRect(-0.36, 0.06, 0.12, 0.22);
      c.restore();
      break;
    case 'red-pack': flask(c, '#e0414a', '#ffb3b3'); break;
    case 'green-pack': flask(c, '#43c463', '#c5ffd0'); break;
    case 'military-pack': flask(c, '#6b7280', '#d1d5db'); break;
    case 'advanced-pack': flask(c, '#3b82f6', '#bfdbfe'); break;
    case 'grenade': {
      c.fillStyle = '#4b5a3a';
      c.beginPath();
      c.ellipse(0.5, 0.58, 0.26, 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#2f3a24';
      c.lineWidth = 0.04;
      for (const yy of [0.48, 0.62, 0.76]) {
        c.beginPath();
        c.moveTo(0.27, yy);
        c.lineTo(0.73, yy);
        c.stroke();
      }
      c.fillStyle = '#8d939e';
      c.fillRect(0.42, 0.18, 0.16, 0.14);
      c.strokeStyle = '#c9ced8';
      c.lineWidth = 0.05;
      c.beginPath();
      c.arc(0.66, 0.22, 0.08, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case 'helper-drone': {
      c.fillStyle = '#4b5563';
      c.fillRect(0.12, 0.3, 0.76, 0.06);
      for (const xx of [0.18, 0.82]) {
        c.fillStyle = 'rgba(200,220,255,.6)';
        c.beginPath();
        c.ellipse(xx, 0.28, 0.14, 0.04, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#9fb0e6';
      c.beginPath();
      c.arc(0.5, 0.55, 0.22, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1b2433';
      c.beginPath();
      c.arc(0.5, 0.55, 0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff5b4b';
      c.beginPath();
      c.arc(0.5, 0.55, 0.04, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'armor-0': case 'armor-1': case 'armor-2': case 'armor-3': case 'armor-4': case 'armor-5': {
      const tier = Number(item.slice(-1));
      const [body, trim] = [['#8a8f99', '#4b525d'], ['#9a6a3c', '#5f3e20'], ['#6f82c8', '#3b4a85'], ['#a4acb8', '#4e535c'], ['#3b4a6b', '#e3b341'], ['#1f2a3a', '#5adcff']][tier];
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(0.3, 0.14);
      c.lineTo(0.42, 0.2);
      c.lineTo(0.58, 0.2);
      c.lineTo(0.7, 0.14);
      c.lineTo(0.9, 0.3);
      c.lineTo(0.8, 0.48);
      c.lineTo(0.74, 0.44);
      c.lineTo(0.74, 0.88);
      c.lineTo(0.26, 0.88);
      c.lineTo(0.26, 0.44);
      c.lineTo(0.2, 0.48);
      c.lineTo(0.1, 0.3);
      c.closePath();
      c.fill();
      c.strokeStyle = trim;
      c.lineWidth = 0.05;
      c.stroke();
      owenO(c, 0.5, 0.5, 0.1, trim);
      for (let i = 0; i < tier; i++) {
        c.fillStyle = trim;
        c.fillRect(0.3 + i * 0.09, 0.74, 0.06, 0.06);
      }
      break;
    }
    case 'eq-solar': case 'eq-battery': case 'eq-core': case 'eq-laser': case 'eq-shield': case 'eq-legs': case 'eq-night': {
      c.fillStyle = '#2b3440';
      c.beginPath();
      c.roundRect(0.08, 0.08, 0.84, 0.84, 0.1);
      c.fill();
      c.strokeStyle = '#5b6c7d';
      c.lineWidth = 0.04;
      c.stroke();
      if (item === 'eq-solar') {
        c.fillStyle = '#1d3566';
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) c.fillRect(0.18 + i * 0.33, 0.18 + j * 0.33, 0.3, 0.3);
        c.fillStyle = 'rgba(120,170,255,.4)';
        c.fillRect(0.18, 0.18, 0.63, 0.08);
      } else if (item === 'eq-battery') {
        c.fillStyle = '#3f8f63';
        c.fillRect(0.3, 0.22, 0.4, 0.62);
        c.fillStyle = '#57d38c';
        c.fillRect(0.34, 0.5, 0.32, 0.3);
        c.fillStyle = '#c9ced8';
        c.fillRect(0.42, 0.15, 0.16, 0.07);
      } else if (item === 'eq-core') {
        const grd = c.createRadialGradient(0.5, 0.5, 0.02, 0.5, 0.5, 0.32);
        grd.addColorStop(0, '#fff3b0');
        grd.addColorStop(1, '#e3b341');
        c.fillStyle = grd;
        c.beginPath();
        c.arc(0.5, 0.5, 0.3, 0, Math.PI * 2);
        c.fill();
        owenO(c, 0.5, 0.5, 0.12, '#8a5a10');
      } else if (item === 'eq-laser') {
        c.fillStyle = '#7d8a9b';
        c.fillRect(0.2, 0.42, 0.45, 0.16);
        c.fillStyle = '#d6455d';
        c.fillRect(0.62, 0.47, 0.22, 0.06);
        c.fillStyle = '#ffb3b3';
        c.beginPath();
        c.arc(0.84, 0.5, 0.05, 0, Math.PI * 2);
        c.fill();
      } else if (item === 'eq-shield') {
        c.fillStyle = 'rgba(90,169,255,.8)';
        c.beginPath();
        c.moveTo(0.5, 0.16);
        c.lineTo(0.8, 0.28);
        c.quadraticCurveTo(0.78, 0.7, 0.5, 0.86);
        c.quadraticCurveTo(0.22, 0.7, 0.2, 0.28);
        c.closePath();
        c.fill();
      } else if (item === 'eq-legs') {
        c.fillStyle = '#9aa2ad';
        c.fillRect(0.28, 0.18, 0.14, 0.62);
        c.fillRect(0.58, 0.18, 0.14, 0.62);
        c.fillStyle = '#e3b341';
        c.fillRect(0.24, 0.42, 0.22, 0.08);
        c.fillRect(0.54, 0.42, 0.22, 0.08);
        c.fillStyle = '#4b5563';
        c.fillRect(0.22, 0.78, 0.24, 0.08);
        c.fillRect(0.52, 0.78, 0.24, 0.08);
      } else {
        c.fillStyle = '#1b2433';
        c.fillRect(0.16, 0.4, 0.68, 0.22);
        c.fillStyle = '#57d38c';
        c.beginPath();
        c.arc(0.34, 0.51, 0.08, 0, Math.PI * 2);
        c.arc(0.66, 0.51, 0.08, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    default:
      if (ITEMS[item].fluid) droplet(c, LIQUID_COLOR[item] ?? '#4fa3ff');
      else if (ITEMS[item].place) drawEntityIcon(c, ITEMS[item].place!);
      else drawAdvancedItem(c, item);
  }
}

function droplet(c: Ctx, col: string) {
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(0.52, 0.86, 0.22, 0.06, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0.5, 0.1);
  c.bezierCurveTo(0.6, 0.3, 0.8, 0.45, 0.8, 0.62);
  c.arc(0.5, 0.62, 0.3, 0, Math.PI);
  c.bezierCurveTo(0.2, 0.45, 0.4, 0.3, 0.5, 0.1);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.45)';
  c.beginPath();
  c.ellipse(0.4, 0.58, 0.06, 0.12, 0.4, 0, Math.PI * 2);
  c.fill();
}

function canister(c: Ctx, body: string, band: string) {
  c.fillStyle = 'rgba(0,0,0,.3)';
  roundRect(c, 0.27, 0.22, 0.5, 0.68, 0.08);
  c.fill();
  c.fillStyle = body;
  roundRect(c, 0.25, 0.18, 0.5, 0.68, 0.08);
  c.fill();
  c.fillStyle = band;
  c.fillRect(0.25, 0.42, 0.5, 0.16);
  c.fillStyle = '#4b525d';
  c.fillRect(0.4, 0.1, 0.2, 0.1);
}

function gunShape(c: Ctx, body: string, barrel: string, len: number, thick: number) {
  c.save();
  c.translate(0.5, 0.55);
  c.rotate(-0.5);
  c.fillStyle = body;
  c.fillRect(-0.42, -thick / 2, 0.84 * len, thick);
  c.fillStyle = barrel;
  c.fillRect(0.1, -thick / 4, 0.5 * len, thick / 2);
  c.fillStyle = '#6b4126';
  c.fillRect(-0.34, thick / 2 - 0.02, 0.12, 0.2);
  c.restore();
}

/** Icons for advanced-mode items that aren't buildings. */
function drawAdvancedItem(c: Ctx, item: ItemId) {
  switch (item) {
    case 'plastic':
      c.fillStyle = '#c9ced8';
      roundRect(c, 0.16, 0.36, 0.68, 0.32, 0.08);
      c.fill();
      c.fillStyle = '#f4f6fa';
      roundRect(c, 0.16, 0.32, 0.68, 0.28, 0.08);
      c.fill();
      break;
    case 'sulfur':
      rocks(c, '#d9c227', '#f5e66a', '#a8941a', 13);
      break;
    case 'solid-fuel':
      c.fillStyle = '#3a3f48';
      roundRect(c, 0.18, 0.3, 0.64, 0.46, 0.08);
      c.fill();
      c.fillStyle = '#f08a3c';
      c.fillRect(0.24, 0.42, 0.52, 0.1);
      c.fillStyle = '#5c6270';
      c.fillRect(0.24, 0.6, 0.52, 0.06);
      break;
    case 'rocket-fuel':
      canister(c, '#d6455d', '#f2c14e');
      break;
    case 'flame-ammo':
      canister(c, '#c0661f', '#2a2420');
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.moveTo(0.5, 0.42);
      c.quadraticCurveTo(0.6, 0.5, 0.5, 0.58);
      c.quadraticCurveTo(0.4, 0.5, 0.5, 0.42);
      c.fill();
      break;
    case 'adv-circuit':
      c.fillStyle = '#5a1a1a';
      roundRect(c, 0.14, 0.2, 0.72, 0.6, 0.06);
      c.fill();
      c.fillStyle = '#c2373f';
      roundRect(c, 0.14, 0.17, 0.72, 0.58, 0.06);
      c.fill();
      c.strokeStyle = '#f2c14e';
      c.lineWidth = 0.035;
      c.beginPath();
      c.moveTo(0.2, 0.3); c.lineTo(0.4, 0.3);
      c.moveTo(0.2, 0.6); c.lineTo(0.4, 0.6);
      c.moveTo(0.8, 0.3); c.lineTo(0.6, 0.3);
      c.moveTo(0.8, 0.6); c.lineTo(0.6, 0.6);
      c.stroke();
      c.fillStyle = '#1b1f2a';
      c.fillRect(0.38, 0.3, 0.24, 0.32);
      break;
    case 'rocket-part':
      c.fillStyle = '#c9ced8';
      roundRect(c, 0.25, 0.14, 0.5, 0.72, 0.1);
      c.fill();
      c.fillStyle = '#8d939e';
      c.fillRect(0.25, 0.3, 0.5, 0.06);
      c.fillRect(0.25, 0.62, 0.5, 0.06);
      c.fillStyle = '#d6455d';
      c.fillRect(0.25, 0.44, 0.5, 0.1);
      break;
    case 'rocket':
      c.save();
      c.translate(0.5, 0.5);
      c.rotate(-0.78);
      c.fillStyle = '#8d939e';
      c.fillRect(-0.32, -0.08, 0.5, 0.16);
      c.fillStyle = '#d6455d';
      c.beginPath();
      c.moveTo(0.18, -0.08);
      c.lineTo(0.38, 0);
      c.lineTo(0.18, 0.08);
      c.fill();
      c.fillStyle = '#4b525d';
      c.fillRect(-0.4, -0.14, 0.12, 0.28);
      c.restore();
      break;
    case 'rocket-launcher':
      gunShape(c, '#4b5a3a', '#2f3a24', 1, 0.2);
      break;
    case 'flamethrower':
      gunShape(c, '#7b5a3a', '#c0661f', 0.9, 0.16);
      c.fillStyle = '#ff9a3c';
      c.beginPath();
      c.arc(0.8, 0.24, 0.07, 0, Math.PI * 2);
      c.fill();
      break;
    case 'sniper':
      gunShape(c, '#39424f', '#1b1f25', 1.1, 0.1);
      c.fillStyle = '#5adcff';
      c.fillRect(0.42, 0.34, 0.14, 0.05);
      break;
    case 'piercing-ammo':
      c.fillStyle = '#7a1f25';
      roundRect(c, 0.2, 0.3, 0.6, 0.5, 0.06);
      c.fill();
      c.fillStyle = '#d6455d';
      roundRect(c, 0.2, 0.26, 0.6, 0.46, 0.06);
      c.fill();
      for (let i = 0; i < 3; i++) {
        c.fillStyle = '#c9ced8';
        c.fillRect(0.28 + i * 0.16, 0.12, 0.1, 0.2);
        c.beginPath();
        c.arc(0.33 + i * 0.16, 0.12, 0.05, Math.PI, 0);
        c.fill();
      }
      owenO(c, 0.5, 0.5, 0.1, '#4a1015');
      break;
    case 'robot':
      c.fillStyle = '#c9ced8';
      roundRect(c, 0.24, 0.4, 0.52, 0.3, 0.08);
      c.fill();
      c.fillStyle = '#57d38c';
      c.fillRect(0.4, 0.48, 0.2, 0.08);
      c.strokeStyle = '#8d939e';
      c.lineWidth = 0.05;
      c.beginPath();
      c.moveTo(0.1, 0.34);
      c.lineTo(0.9, 0.34);
      c.stroke();
      break;
    case 'eq-goggles':
      c.fillStyle = '#2b3440';
      roundRect(c, 0.08, 0.08, 0.84, 0.84, 0.1);
      c.fill();
      c.fillStyle = '#1b2433';
      c.fillRect(0.14, 0.42, 0.72, 0.18);
      c.fillStyle = '#57d38c';
      c.beginPath();
      c.arc(0.33, 0.51, 0.11, 0, Math.PI * 2);
      c.arc(0.67, 0.51, 0.11, 0, Math.PI * 2);
      c.fill();
      break;
    case 'platform-kit':
      c.fillStyle = '#4b525d';
      roundRect(c, 0.14, 0.24, 0.72, 0.6, 0.08);
      c.fill();
      c.fillStyle = '#8d939e';
      roundRect(c, 0.14, 0.2, 0.72, 0.56, 0.08);
      c.fill();
      c.fillStyle = '#fff3b0';
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.08 : 0.2;
        c.lineTo(0.5 + Math.cos(a) * r, 0.48 + Math.sin(a) * r);
      }
      c.fill();
      break;
    case 'catcher':
      c.strokeStyle = '#e3b341';
      c.lineWidth = 0.09;
      c.beginPath();
      c.moveTo(0.5, 0.85);
      c.lineTo(0.5, 0.45);
      c.lineTo(0.25, 0.18);
      c.moveTo(0.5, 0.45);
      c.lineTo(0.75, 0.18);
      c.stroke();
      c.fillStyle = '#4b525d';
      c.fillRect(0.34, 0.78, 0.32, 0.12);
      break;
    case 'crusher':
      c.fillStyle = '#7b6a58';
      roundRect(c, 0.16, 0.22, 0.68, 0.6, 0.08);
      c.fill();
      gear(c, 0.38, 0.52, 0.15, 6, 0, '#c9b79c', '#2b2f36');
      gear(c, 0.62, 0.52, 0.15, 6, 0.4, '#c9b79c', '#2b2f36');
      break;
    case 'thruster':
      c.fillStyle = '#8d939e';
      c.beginPath();
      c.moveTo(0.32, 0.2);
      c.lineTo(0.68, 0.2);
      c.lineTo(0.8, 0.62);
      c.lineTo(0.2, 0.62);
      c.closePath();
      c.fill();
      c.fillStyle = '#ff9a3c';
      c.beginPath();
      c.moveTo(0.28, 0.62);
      c.lineTo(0.72, 0.62);
      c.lineTo(0.5, 0.94);
      c.closePath();
      c.fill();
      break;
    case 'ice':
      c.fillStyle = '#bfe6ff';
      roundRect(c, 0.2, 0.24, 0.6, 0.56, 0.1);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.fillRect(0.28, 0.3, 0.2, 0.08);
      c.strokeStyle = '#7fc8ef';
      c.lineWidth = 0.04;
      c.stroke();
      break;
    case 'cryser-crystal':
      c.fillStyle = '#7fc8ef';
      c.beginPath();
      c.moveTo(0.5, 0.1);
      c.lineTo(0.75, 0.45);
      c.lineTo(0.5, 0.9);
      c.lineTo(0.25, 0.45);
      c.closePath();
      c.fill();
      c.fillStyle = '#d2f0ff';
      c.beginPath();
      c.moveTo(0.5, 0.1);
      c.lineTo(0.6, 0.45);
      c.lineTo(0.5, 0.9);
      c.closePath();
      c.fill();
      break;
  }
}

const canvasCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

export function iconCanvas(item: ItemId, size = 64): HTMLCanvasElement {
  const key = item + size;
  let cv = canvasCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d')!;
    c.scale(size, size);
    drawItem(c, item);
    canvasCache.set(key, cv);
  }
  return cv;
}

export function iconURL(item: ItemId): string {
  let u = urlCache.get(item);
  if (!u) {
    u = iconCanvas(item, 64).toDataURL();
    urlCache.set(item, u);
  }
  return u;
}
