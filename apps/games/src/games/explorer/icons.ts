// Drawn icons for materials and parts, so the bag looks like real stuff instead of emoji.
// Each one is a small SVG made from a few shapes with shading; anything not listed keeps its emoji.
import type { ItemId } from './data';

let uid = 0;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`;
/** A vertical gradient from light to dark, returns [defs, fill]. */
function grad(light: string, dark: string): [string, string] {
  const id = `g${uid++}`;
  return [`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>`, `url(#${id})`];
}
const OUT = 'stroke="#000" stroke-opacity=".45" stroke-width="1.2" stroke-linejoin="round"';

/** A stack of metal plates seen from an angle. */
function plates(light: string, dark: string, edge: string) {
  const [d, f] = grad(light, dark);
  let s = d;
  for (let i = 2; i >= 0; i--) {
    const y = 14 + i * 7;
    s += `<path d="M6 ${y + 6} L24 ${y} L42 ${y + 6} L24 ${y + 12} Z" fill="${f}" ${OUT}/>`;
    s += `<path d="M6 ${y + 6} L24 ${y + 12} L24 ${y + 15} L6 ${y + 9} Z" fill="${edge}" ${OUT}/><path d="M42 ${y + 6} L24 ${y + 12} L24 ${y + 15} L42 ${y + 9} Z" fill="${edge}" opacity=".8" ${OUT}/>`;
  }
  return svg(s + `<path d="M12 18 L22 15" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>`);
}
/** Lumpy rocks with colored bits in them. */
function ore(base: string, dark: string, specks: string[]) {
  const [d, f] = grad(base, dark);
  let s = d + `<path d="M5 34 L10 20 L20 13 L31 15 L41 23 L43 35 L33 42 L15 42 Z" fill="${f}" ${OUT}/>`;
  s += `<path d="M10 20 L20 13 L24 22 L14 28 Z" fill="#fff" opacity=".12"/><path d="M24 22 L41 23 L43 35 L30 33 Z" fill="#000" opacity=".15"/>`;
  const pts = [[16, 22], [27, 19], [34, 28], [20, 33], [12, 32], [29, 37], [37, 34], [22, 26]];
  pts.forEach(([x, y], i) => { s += `<path d="M${x} ${y - 2.5} L${x + 2.5} ${y} L${x} ${y + 2.5} L${x - 2.5} ${y} Z" fill="${specks[i % specks.length]}" stroke="#000" stroke-opacity=".3" stroke-width=".6"/>`; });
  return svg(s);
}
/** A few chunks of one kind of rock (coal, stone). */
function chunks(light: string, dark: string, shine = 0.15) {
  const [d, f] = grad(light, dark);
  let s = d;
  for (const [x, y, r] of [[16, 30, 10], [31, 32, 9], [24, 19, 9]]) {
    s += `<path d="M${x - r} ${y + 2} L${x - r / 2} ${y - r} L${x + r / 2} ${y - r} L${x + r} ${y} L${x + r / 2} ${y + r} L${x - r / 2} ${y + r} Z" fill="${f}" ${OUT}/>`;
    s += `<path d="M${x - r / 2} ${y - r} L${x + r / 2} ${y - r} L${x} ${y - 2} Z" fill="#fff" opacity="${shine}"/>`;
  }
  return svg(s);
}
/** A glass bottle of science. */
function flask(color: string, light: string) {
  const [d, f] = grad(light, color);
  return svg(`${d}<path d="M19 6 H29 V9 H28 V18 L38 37 Q40 42 35 42 H13 Q8 42 10 37 L20 18 V9 H19 Z" fill="#dfeef5" fill-opacity=".55" ${OUT}/>
    <path d="M15 28 H33 L37.5 37 Q39 40.5 35 40.5 H13 Q9 40.5 10.5 37 Z" fill="${f}"/>
    <rect x="18.5" y="3.5" width="11" height="4" rx="1" fill="#8a6a4a" ${OUT}/>
    <path d="M22 12 V19 L15 33" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none"/>
    <circle cx="22" cy="34" r="2" fill="#fff" opacity=".6"/><circle cx="28" cy="31" r="1.3" fill="#fff" opacity=".6"/>`);
}
/** A circuit board with a chip and gold lines. */
function board(color: string, dark: string, chip = '#1a1a1a') {
  const [d, f] = grad(color, dark);
  let s = d + `<rect x="5" y="9" width="38" height="30" rx="3" fill="${f}" ${OUT}/>`;
  for (const [x1, y1, x2, y2] of [[9, 15, 18, 15], [9, 33, 16, 26], [30, 15, 39, 15], [30, 33, 39, 33], [24, 12, 24, 17], [24, 31, 24, 36]]) s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#f2c94c" stroke-width="1.6"/>`;
  s += `<rect x="16" y="17" width="16" height="14" rx="1.5" fill="${chip}" ${OUT}/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${17.5 + i * 3.8}" y="15" width="1.6" height="2.4" fill="#ccc"/><rect x="${17.5 + i * 3.8}" y="30.6" width="1.6" height="2.4" fill="#ccc"/>`;
  return svg(s + `<circle cx="10" cy="14" r="1.6" fill="#f2c94c"/><circle cx="38" cy="34" r="1.6" fill="#f2c94c"/>`);
}
function gear(light: string, dark: string) {
  const [d, f] = grad(light, dark);
  let path = '';
  const n = 10, ro = 20, ri = 15.5;
  for (let i = 0; i < n * 2; i++) {
    const a1 = (i / (n * 2)) * Math.PI * 2, a2 = ((i + 1) / (n * 2)) * Math.PI * 2, r = i % 2 ? ri : ro;
    path += `${i ? 'L' : 'M'}${(24 + Math.cos(a1) * r).toFixed(1)} ${(24 + Math.sin(a1) * r).toFixed(1)} L${(24 + Math.cos(a2) * r).toFixed(1)} ${(24 + Math.sin(a2) * r).toFixed(1)} `;
  }
  return svg(`${d}<path d="${path}Z" fill="${f}" ${OUT}/><circle cx="24" cy="24" r="9" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/><circle cx="24" cy="24" r="4.5" fill="#2a2a2a" ${OUT}/><path d="M13 16 A13 13 0 0 1 22 11" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none"/>`);
}

const ICONS: Record<ItemId, string> = {
  iron: plates('#e8edf2', '#9aa6b2', '#7d8994'),
  copper: plates('#ffb27a', '#c8662e', '#a24f22'),
  steel: plates('#c7d3e0', '#5d6b7a', '#46525e'),
  iron_ore: ore('#7c6a5c', '#4a3c32', ['#9fb4cc', '#6f89a8', '#c8d6e4']),
  copper_ore: ore('#7a5f4c', '#4a3628', ['#ff9a4a', '#d66a2a', '#4fbf8f']),
  coal: chunks('#4a4a52', '#0e0e12', 0.3),
  stone: chunks('#c2bcb0', '#7a746a'),
  wood: svg(`${grad('#b07a44', '#6e4522')[0]}<rect x="6" y="24" width="34" height="12" rx="2" fill="#8a5a2e" ${OUT}/><rect x="10" y="12" width="32" height="12" rx="2" fill="#a06a38" ${OUT}/>
    <ellipse cx="40" cy="30" rx="5" ry="6" fill="#e6c28a" ${OUT}/><circle cx="40" cy="30" r="2.5" fill="none" stroke="#a87a44"/><ellipse cx="42" cy="18" rx="5" ry="6" fill="#ecc890" ${OUT}/><circle cx="42" cy="18" r="2.5" fill="none" stroke="#a87a44"/>
    <path d="M12 28 H32 M14 16 H34" stroke="#5a3a1a" stroke-opacity=".5"/>`),
  brick: svg(`<rect x="5" y="26" width="18" height="10" rx="1" fill="#b5523b" ${OUT}/><rect x="25" y="26" width="18" height="10" rx="1" fill="#a9472f" ${OUT}/><rect x="14" y="15" width="20" height="10" rx="1" fill="#c25e44" ${OUT}/><path d="M7 28 H20 M27 28 H40 M16 17 H31" stroke="#fff" stroke-opacity=".3"/>`),
  gear: gear('#d7dde3', '#7a848e'),
  copper_cable: svg(`<g fill="none" stroke-linecap="round"><path d="M8 34 C8 20 40 20 40 34 C40 44 14 44 14 32 C14 24 34 24 34 33" stroke="#5a2a10" stroke-width="5.5"/><path d="M8 34 C8 20 40 20 40 34 C40 44 14 44 14 32 C14 24 34 24 34 33" stroke="#e8803a" stroke-width="3.5"/><path d="M10 30 C14 22 30 21 37 28" stroke="#ffd0a0" stroke-width="1.2"/></g><path d="M34 33 L40 10" stroke="#e8803a" stroke-width="3" stroke-linecap="round"/><path d="M39 12 L42 6" stroke="#ffcf80" stroke-width="2" stroke-linecap="round"/>`),
  iron_stick: svg(`<rect x="8" y="12" width="5" height="30" rx="2" transform="rotate(-25 10 27)" fill="#b8c0c8" ${OUT}/><rect x="22" y="8" width="5" height="34" rx="2" transform="rotate(-25 24 25)" fill="#cfd6dc" ${OUT}/><rect x="34" y="12" width="5" height="30" rx="2" transform="rotate(-25 36 27)" fill="#a8b0b8" ${OUT}/>`),
  circuit: board('#3fbf5a', '#1f7a34'),
  advanced_circuit: board('#e04848', '#8a1e1e'),
  plastic: svg(`${grad('#d79af0', '#8a3ab0')[0]}<path d="M6 30 L22 22 L42 28 L26 38 Z" fill="#c070e0" ${OUT}/><path d="M6 30 L26 38 V42 L6 34 Z" fill="#8a3ab0" ${OUT}/><path d="M42 28 L26 38 V42 L42 32 Z" fill="#a050c8" ${OUT}/><path d="M12 29 L22 24" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>`),
  battery: svg(`<rect x="13" y="10" width="22" height="32" rx="4" fill="#2a2a2a" ${OUT}/><rect x="13" y="10" width="22" height="12" rx="4" fill="#e0c030" ${OUT}/><rect x="19" y="6" width="10" height="5" rx="1" fill="#c8c8c8" ${OUT}/><path d="M24 26 L20 33 H24 L23 39 L28 31 H24 L25 26 Z" fill="#e0c030"/><path d="M16 13 V38" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`),
  motor: svg(`<rect x="8" y="14" width="26" height="22" rx="4" fill="#4a6fa8" ${OUT}/><path d="M12 14 V36 M17 14 V36 M22 14 V36 M27 14 V36" stroke="#2a4a7a" stroke-width="1.5"/><rect x="34" y="21" width="9" height="8" rx="1.5" fill="#c8c8c8" ${OUT}/><circle cx="11" cy="25" r="5" fill="#e8803a" ${OUT}/><rect x="10" y="36" width="22" height="4" rx="1" fill="#333"/><path d="M10 17 H32" stroke="#fff" stroke-opacity=".4"/>`),
  engine_unit: svg(`<rect x="7" y="16" width="28" height="20" rx="2" fill="#7a6a5a" ${OUT}/><rect x="10" y="10" width="7" height="7" fill="#5a4a3a" ${OUT}/><rect x="20" y="10" width="7" height="7" fill="#5a4a3a" ${OUT}/><path d="M35 26 H43 V40" stroke="#9aa0a8" stroke-width="4" fill="none"/><circle cx="21" cy="26" r="5" fill="#9aa0a8" ${OUT}/><circle cx="21" cy="26" r="1.8" fill="#333"/><path d="M10 19 H32" stroke="#fff" stroke-opacity=".3"/>`),
  red_pack: flask('#c8202a', '#ff6a6a'),
  green_pack: flask('#1f9a3a', '#6ae08a'),
  blue_pack: flask('#2050c8', '#70a0ff'),
  sand: svg(`<path d="M4 40 Q24 8 44 40 Z" fill="#e6d38f" ${OUT}/><path d="M14 30 Q24 16 30 22" stroke="#fff6c8" stroke-width="2" fill="none"/><circle cx="18" cy="35" r="1" fill="#b8a060"/><circle cx="28" cy="31" r="1" fill="#b8a060"/><circle cx="33" cy="37" r="1" fill="#b8a060"/>`),
  dirt: svg(`<path d="M4 40 Q24 10 44 40 Z" fill="#7a5a3a" ${OUT}/><path d="M14 31 Q22 18 30 22" stroke="#a07a52" stroke-width="2" fill="none"/><circle cx="18" cy="35" r="1.4" fill="#4a3420"/><circle cx="29" cy="32" r="1.6" fill="#4a3420"/><path d="M33 26 L35 21 L37 26" stroke="#5aa040" stroke-width="1.5" fill="none"/>`),
  ice: svg(`<path d="M8 18 L24 10 L40 18 L40 34 L24 42 L8 34 Z" fill="#bfe8ff" fill-opacity=".9" ${OUT}/><path d="M8 18 L24 26 L40 18 M24 26 V42" stroke="#7ab8e0" fill="none"/><path d="M13 20 L22 15" stroke="#fff" stroke-width="2"/>`),
  crystal: svg(`<path d="M24 4 L34 18 L28 44 L20 44 L14 18 Z" fill="#7fe0ff" ${OUT}/><path d="M24 4 L24 44 M14 18 L34 18" stroke="#2aa0c8" stroke-opacity=".6" fill="none"/><path d="M19 16 L23 8" stroke="#fff" stroke-width="2"/><path d="M8 34 L13 26 L17 36 L13 44 Z" fill="#a0ecff" ${OUT}/>`),
  ammo: svg(`<g ${OUT}><rect x="9" y="20" width="8" height="20" fill="#d4a020"/><path d="M9 20 Q13 8 17 20 Z" fill="#b87333"/><rect x="20" y="16" width="8" height="24" fill="#e0b030"/><path d="M20 16 Q24 4 28 16 Z" fill="#c08040"/><rect x="31" y="20" width="8" height="20" fill="#d4a020"/><path d="M31 20 Q35 8 39 20 Z" fill="#b87333"/></g>`),
  fuel: svg(`<rect x="11" y="10" width="26" height="32" rx="3" fill="#e0b030" ${OUT}/><rect x="15" y="5" width="8" height="6" rx="1" fill="#555" ${OUT}/><path d="M24 18 Q30 26 24 32 Q18 26 24 18 Z" fill="#7a3a10"/><path d="M14 14 V38" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>`),
};

/** HTML for an item's picture: a drawn icon if there is one, otherwise its emoji. */
const cache = new Map<ItemId, string>();
export function iconHtml(id: ItemId, emoji: string): string {
  const s = ICONS[id];
  if (!s) return emoji;
  let h = cache.get(id);
  if (!h) { h = `<img class="ex-ico" alt="" src="data:image/svg+xml,${encodeURIComponent(s)}">`; cache.set(id, h); }
  return h;
}
