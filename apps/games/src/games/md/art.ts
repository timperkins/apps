// Little icons for gear and supplies, drawn once into data URLs.
import { ARMOR, MELEE, RANGED, type GearId, type SupplyId, type MonsterKind } from './data';
import { drawHeldWeapon, portrait, monsterParts, heroParts, tintParts } from './render';

const cache = new Map<string, string>();

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!] as const;
}

export function gearIcon(id: GearId): string {
  const key = 'g:' + id;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 64;
  const [c, x] = canvas(S);
  if (id in MELEE) {
    const w = MELEE[id as keyof typeof MELEE];
    const len = id === 'long-spear' || id === 'frost-glaive' ? 62 : id === 'twin-daggers' ? 34 : 46;
    drawHeldWeapon(x, id === 'twin-daggers' ? 18 : 12, S - 12, -Math.PI / 4, len, w.color, w.blade, id, w.effect === 'burn' || w.effect === 'slow');
    if (id === 'twin-daggers') drawHeldWeapon(x, 32, S - 8, -Math.PI / 4, len, w.color, w.blade, id);
  } else if (id in RANGED) {
    const w = RANGED[id as keyof typeof RANGED];
    x.translate(S / 2, S / 2);
    x.rotate(-Math.PI / 4);
    if (id === 'starlight-bow') {
      x.shadowColor = '#fff3a0';
      x.shadowBlur = 12;
    }
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.lineWidth = 8;
    x.beginPath();
    if (id === 'crossbow') {
      x.moveTo(-24, 0);
      x.lineTo(24, 0);
      x.moveTo(10, -22);
      x.quadraticCurveTo(18, 0, 10, 22);
    } else x.arc(-14, 0, 30, -1.05, 1.05);
    x.stroke();
    x.strokeStyle = w.color;
    x.lineWidth = 5;
    x.stroke();
    x.strokeStyle = '#efe6d0';
    x.lineWidth = 1.5;
    x.beginPath();
    if (id === 'crossbow') {
      x.moveTo(10, -22);
      x.lineTo(-2, 0);
      x.lineTo(10, 22);
    } else {
      x.moveTo(1, -26);
      x.lineTo(1, 26);
    }
    x.stroke();
    // arrow(s)
    const arrows = id === 'fan-bow' ? [-0.3, 0, 0.3] : [0];
    for (const a of arrows) {
      x.save();
      x.rotate(a);
      x.strokeStyle = id === 'starlight-bow' ? '#fff8d0' : '#d8c8a0';
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(-18, 0);
      x.lineTo(24, 0);
      x.stroke();
      x.fillStyle = '#c0c8d0';
      x.fillRect(22, -3, 6, 6);
      x.restore();
    }
  } else {
    const a = ARMOR[id as keyof typeof ARMOR];
    const parts = heroParts({ armor: a.color, trim: a.trim, walk: 0, moving: false }).filter((p) => p[6] === a.color || p[6] === a.trim);
    const p = portrait(parts.map((q) => [q[0], q[1], q[2] - 0.3, q[3], q[4], q[5], q[6]]), Math.PI / 4, S, S, 1, 1.5);
    x.drawImage(p, 0, -6, S, S);
    if (a.regen) {
      x.fillStyle = '#8fe06a';
      x.fillRect(44, 6, 12, 4);
      x.fillRect(48, 2, 4, 12);
    }
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function supplyIcon(id: SupplyId): string {
  const key = 's:' + id;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 64;
  const [c, x] = canvas(S);
  if (id === 'potion') {
    x.fillStyle = '#8a6a4a';
    x.fillRect(27, 8, 10, 6);
    x.fillStyle = '#e8e0d0';
    x.fillRect(25, 14, 14, 10);
    x.shadowColor = '#ff4a7a';
    x.shadowBlur = 12;
    x.fillStyle = '#ff4a7a';
    x.fillRect(14, 24, 36, 32);
    x.shadowBlur = 0;
    x.fillStyle = '#ff9ab8';
    x.fillRect(18, 28, 8, 10);
  } else if (id === 'arrows') {
    x.translate(32, 32);
    x.rotate(-Math.PI / 4);
    for (const o of [-8, 0, 8]) {
      x.strokeStyle = '#a07a4a';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(-24, o);
      x.lineTo(20, o);
      x.stroke();
      x.fillStyle = '#c0c8d0';
      x.fillRect(18, o - 4, 8, 8);
      x.fillStyle = '#e8e0d0';
      x.fillRect(-26, o - 4, 8, 8);
    }
    x.fillStyle = '#7a4a28';
    x.fillRect(-6, -14, 8, 28);
  } else if (id === 'bomb') {
    x.fillStyle = '#2a2a33';
    x.fillRect(14, 20, 36, 36);
    x.fillStyle = '#4a4a55';
    x.fillRect(18, 24, 10, 10);
    x.fillStyle = '#8a6a4a';
    x.fillRect(30, 10, 4, 10);
    x.shadowColor = '#ffe066';
    x.shadowBlur = 10;
    x.fillStyle = '#ffe066';
    x.fillRect(28, 4, 8, 8);
  } else {
    x.fillStyle = '#8a5a2b';
    x.fillRect(8, 18, 48, 40);
    x.fillStyle = '#6b4626';
    x.fillRect(8, 18, 48, 6);
    x.fillRect(8, 36, 48, 4);
    x.fillStyle = '#ffe066';
    x.font = 'bold 30px sans-serif';
    x.textAlign = 'center';
    x.fillText('?', 32, 52);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function monsterIcon(kind: MonsterKind, size = 72, tint = ''): string {
  const key = `m:${kind}:${size}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const scale = kind === 'hollow-crown' ? 0.45 : kind === 'rustknight' ? 0.8 : 1;
  const parts = monsterParts(kind, 1.2, 0, 'chase');
  const p = portrait(tint ? tintParts(parts, tint) : parts, Math.PI / 2, size, size, scale, size / 60);
  const url = p.toDataURL();
  cache.set(key, url);
  return url;
}
