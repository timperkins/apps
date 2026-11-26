// Little icons for gear and supplies, drawn once into data URLs.
import { ARTIFACTS, armorOf, isArtifact, isMelee, isRanged, meleeOf, parseKey, rangedOf, type ArtifactId, type GearId, type ItemKey, type MonsterKind } from './data';
import { drawBow, drawHeldWeapon, portrait, monsterParts, heroParts, tintParts } from './render';

const cache = new Map<string, string>();

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!] as const;
}

/** Icon for an owned item key ("battle-axe~12~123") or a plain gear id. */
export function gearIcon(key: ItemKey | ''): string {
  if (key && isArtifact(parseKey(key).id)) return artifactIcon(parseKey(key).id as unknown as ArtifactId);
  const ck = 'g:' + (key ? parseKey(key).id : '');
  const hit = cache.get(ck);
  if (hit) return hit;
  const S = 64;
  const [c, x] = canvas(S);
  const { id } = key ? parseKey(key) : { id: '' as GearId };
  if (!key || isMelee(id)) {
    const w = meleeOf(key ? `${id}~1~0` : '');
    if (w.shape === 'fist') {
      x.fillStyle = '#e8b890';
      x.fillRect(18, 22, 28, 22);
      x.fillStyle = '#c99a70';
      for (let i = 0; i < 4; i++) x.fillRect(19 + i * 7, 22, 5, 6);
      x.fillRect(14, 30, 8, 10);
    } else {
      const len = w.shape === 'spear' || w.shape === 'glaive' || w.shape === 'scythe' ? 60 : w.shape === 'daggers' || w.shape === 'sickle' ? 34 : 46;
      drawHeldWeapon(x, w.shape === 'daggers' ? 18 : 12, S - 12, -Math.PI / 4, len, w.color, w.blade, w.shape, !!w.glow);
      if (w.shape === 'daggers') drawHeldWeapon(x, 32, S - 8, -Math.PI / 4, len, w.color, w.blade, w.shape, !!w.glow);
    }
  } else if (isRanged(id)) {
    const w = rangedOf(`${id}~1~0`);
    x.translate(S / 2 + 4, S / 2);
    x.rotate(-Math.PI / 4);
    drawBow(x, w, w.shape === 'longbow' ? 1.45 : 2, false);
    const arrows = w.shots === 3 ? [-0.3, 0, 0.3] : w.shots === 2 ? [-0.12, 0.12] : [0];
    for (const a of arrows) {
      x.save();
      x.rotate(a);
      x.strokeStyle = w.burn ? '#ff8a3a' : w.glow ? '#fff8d0' : '#d8c8a0';
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(-18, 0);
      x.lineTo(24, 0);
      x.stroke();
      x.fillStyle = '#c0c8d0';
      x.fillRect(22, -3, 6, 6);
      x.restore();
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (w.auto) {
      x.fillStyle = '#ffe066';
      x.font = 'bold 13px sans-serif';
      x.fillText('AUTO', 2, 62);
    }
  } else {
    const a = armorOf(`${id}~1~0`);
    const shiny = false;
    const parts = heroParts({ armor: a.color, trim: a.trim, walk: 0, moving: false, helm: a.helm, shiny }).filter((p) => p[6] === a.color || p[6] === a.trim || p[6] === '#e8dcc0');
    const p = portrait(parts.map((q) => [q[0], q[1], q[2] - 0.3, q[3], q[4], q[5], q[6], q[7]]), Math.PI / 4, S, S, 1, 1.35);
    x.drawImage(p, 0, -4, S, S);
    if (a.regen) {
      x.fillStyle = '#8fe06a';
      x.fillRect(48, 6, 12, 4);
      x.fillRect(52, 2, 4, 12);
    }
  }
  const url = c.toDataURL();
  cache.set(ck, url);
  return url;
}

export function artifactIcon(id: ArtifactId): string {
  const ck = 'a:' + id;
  const hit = cache.get(ck);
  if (hit) return hit;
  const [c, x] = canvas(64);
  const A = ARTIFACTS[id];
  x.shadowColor = A.color;
  x.shadowBlur = 10;
  const box = (px: number, py: number, w: number, h: number, col: string) => {
    x.fillStyle = col;
    x.fillRect(px, py, w, h);
  };
  const arrow = (col: string, glow = false) => {
    x.save();
    if (glow) {
      x.shadowColor = col;
      x.shadowBlur = 10;
    }
    x.strokeStyle = '#a07a4a';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(12, 52);
    x.lineTo(50, 14);
    x.stroke();
    box(46, 10, 8, 8, col);
    box(10, 48, 8, 8, '#e8e0d0');
    x.restore();
  };
  switch (id) {
    case 'soul-beacon':
      box(22, 40, 20, 16, '#4a3a5a');
      box(18, 52, 28, 6, '#2a2238');
      box(26, 8, 12, 34, 'rgba(176,122,255,.6)');
      box(29, 4, 6, 40, '#f4e8ff');
      break;
    case 'healing-totem':
      box(26, 26, 12, 30, '#6b4424');
      box(22, 18, 20, 10, '#3f8a3a');
      box(27, 6, 10, 10, A.color);
      box(29, 36, 6, 4, '#2a1a0a');
      break;
    case 'hay-bundle':
      box(16, 20, 32, 30, '#e0c060');
      box(16, 30, 32, 4, '#a07a30');
      box(14, 14, 4, 10, '#e8d070');
      box(26, 10, 4, 12, '#e8d070');
      box(40, 12, 4, 10, '#e8d070');
      break;
    case 'old-bone':
      x.translate(32, 32);
      x.rotate(-Math.PI / 4);
      box(-20, -4, 40, 8, '#e8e0d0');
      box(-26, -10, 10, 10, '#f0e8d8');
      box(-26, 0, 10, 10, '#f0e8d8');
      box(16, -10, 10, 10, '#f0e8d8');
      box(16, 0, 10, 10, '#f0e8d8');
      x.setTransform(1, 0, 0, 1, 0, 0);
      break;
    case 'soul-mender':
      box(24, 6, 16, 52, A.color);
      box(6, 24, 52, 16, A.color);
      box(28, 10, 8, 44, '#e8fffc');
      box(10, 28, 44, 8, '#e8fffc');
      break;
    case 'firework-arrow':
      arrow('#c0c8d0');
      box(30, 24, 12, 18, '#ff6ad6');
      box(33, 20, 6, 4, '#ffe066');
      box(34, 42, 4, 6, '#a07a4a');
      break;
    case 'charm-medallion':
      box(30, 4, 4, 14, '#c9a040');
      x.beginPath();
      x.moveTo(32, 56);
      x.lineTo(12, 34);
      x.quadraticCurveTo(10, 18, 22, 18);
      x.quadraticCurveTo(30, 18, 32, 26);
      x.quadraticCurveTo(34, 18, 42, 18);
      x.quadraticCurveTo(54, 18, 52, 34);
      x.closePath();
      x.fillStyle = A.color;
      x.fill();
      box(22, 24, 6, 6, '#ffd0e0');
      break;
    case 'soul-quiver':
    case 'fire-quiver':
    case 'poison-quiver':
      box(18, 16, 22, 40, '#6b4424');
      box(18, 16, 22, 5, '#4a2e1a');
      for (const [px, py] of [[20, 6], [28, 2], [34, 8]]) {
        box(px + 2, py + 6, 3, 14, '#a07a4a');
        box(px, py, 7, 7, A.color);
      }
      box(24, 30, 10, 10, A.color);
      break;
    case 'gust-horn':
      x.beginPath();
      x.moveTo(10, 40);
      x.quadraticCurveTo(20, 18, 50, 14);
      x.lineTo(54, 30);
      x.quadraticCurveTo(28, 30, 18, 46);
      x.closePath();
      x.fillStyle = '#e8dcc0';
      x.fill();
      box(48, 12, 8, 20, '#c9a040');
      break;
    case 'thunder-charm':
      x.beginPath();
      x.moveTo(36, 4); x.lineTo(16, 34); x.lineTo(30, 34); x.lineTo(24, 60); x.lineTo(48, 26); x.lineTo(34, 26); x.lineTo(42, 4);
      x.closePath();
      x.fillStyle = A.color;
      x.fill();
      break;
    case 'ghost-boots':
      box(14, 14, 14, 30, '#8a78d0');
      box(14, 40, 26, 12, '#8a78d0');
      box(34, 18, 14, 26, '#b8a8ff');
      box(34, 40, 24, 12, '#b8a8ff');
      break;
    case 'ironhide-charm':
      x.beginPath();
      x.moveTo(32, 6); x.lineTo(54, 14); x.lineTo(50, 40); x.lineTo(32, 58); x.lineTo(14, 40); x.lineTo(10, 14);
      x.closePath();
      x.fillStyle = A.color;
      x.fill();
      box(28, 16, 8, 30, '#5b6169');
      box(20, 26, 24, 8, '#5b6169');
      break;
  }
  const url = c.toDataURL();
  cache.set(ck, url);
  return url;
}

export function supplyIcon(id: 'potion' | 'arrows' | 'soul'): string {
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
  } else if (id === 'soul') {
    x.shadowColor = '#9ae0ff';
    x.shadowBlur = 14;
    x.fillStyle = '#bfefff';
    x.fillRect(18, 10, 28, 28);
    x.fillRect(22, 38, 8, 14);
    x.fillRect(34, 38, 8, 10);
    x.fillStyle = '#2a4a6a';
    x.fillRect(24, 18, 5, 6);
    x.fillRect(35, 18, 5, 6);
  } else {
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
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function monsterIcon(kind: MonsterKind, size = 72, tint = ''): string {
  const key = `m:${kind}:${size}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const scale = kind === 'nyxwing' ? 0.3 : kind === 'gloomguard' ? 0.42 : kind === 'ember-golem' ? 0.6 : kind === 'void-stalker' || kind === 'bog-rider' ? 0.72 : 1;
  const parts = monsterParts(kind, 1.2, 0, 'chase');
  const p = portrait(tint ? tintParts(parts, tint) : parts, Math.PI / 2, size, size, scale, size / 60);
  const url = p.toDataURL();
  cache.set(key, url);
  return url;
}
