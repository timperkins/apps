// A picture for every enchantment: a colored badge with a small drawing, as SVG.
import type { EnchId } from './data';

const frame = (a: string, b: string, inner: string, id: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
  `<rect x="2" y="2" width="44" height="44" rx="9" fill="url(#g${id})" stroke="#1a1426" stroke-width="2.5"/><rect x="5" y="5" width="38" height="38" rx="7" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>${inner}</svg>`;

const ARROW = (x1: number, y1: number, x2: number, y2: number, col = '#f4e6c8') => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 5;
  const p1 = `${x2 - Math.cos(a - 0.5) * h},${y2 - Math.sin(a - 0.5) * h}`, p2 = `${x2 - Math.cos(a + 0.5) * h},${y2 - Math.sin(a + 0.5) * h}`;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7a4a22" stroke-width="2.6" stroke-linecap="round"/><polygon points="${x2},${y2} ${p1} ${p2}" fill="${col}" stroke="#2a2030" stroke-width="0.8"/>`;
};
const SWORD = (col = '#e8eef4') =>
  `<g transform="rotate(45 24 24)"><rect x="22" y="6" width="4" height="24" rx="1" fill="${col}" stroke="#2a2030" stroke-width="1"/><polygon points="22,6 24,2 26,6" fill="${col}" stroke="#2a2030" stroke-width="1"/><rect x="17" y="29" width="14" height="3" rx="1" fill="#c8a040" stroke="#2a2030" stroke-width="1"/><rect x="22.5" y="32" width="3" height="9" fill="#6a4020"/></g>`;
const SHIELD = (col = '#6a7280') => `<path d="M24 8 L38 13 C38 27 33 35 24 41 C15 35 10 27 10 13z" fill="${col}" stroke="#e8eef4" stroke-width="2"/>`;
const HEART = (col = '#ff2a50', s = 1, x = 24, y = 26) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 13 C -16 1, -16 -13, -7 -14 C -3 -14, 0 -10, 0 -8 C 0 -10, 3 -14, 7 -14 C 16 -13, 16 1, 0 13z" fill="${col}" stroke="#fff" stroke-width="2"/>`;
const GHOST = `<path d="M14 40 V22 a10 10 0 0 1 20 0 V40 l-4 -3 l-3 3 l-3 -3 l-3 3 l-3 -3z" fill="#e8f8ff" stroke="#3a6a8a" stroke-width="1.5"/><circle cx="20" cy="23" r="2" fill="#2a3a5a"/><circle cx="28" cy="23" r="2" fill="#2a3a5a"/>`;
const FLAME = (x = 24, y = 24, s = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 16 C -10 14, -12 2, -5 -6 C -5 0, -1 1, 0 -2 C 0 -9, 4 -14, 6 -16 C 6 -8, 12 -2, 10 6 C 9 12, 5 16, 0 16z" fill="#ffb03a" stroke="#a8331a" stroke-width="1.5"/><path transform="translate(${x} ${y + 6}) scale(${s * 0.5})" d="M0 16 C -10 14, -12 2, -5 -6 C -3 0, 0 0, 0 -6 C 6 -2, 10 4, 8 10 C 7 14, 4 16, 0 16z" fill="#ffe27a"/>`;
const FLAKE = (x = 24, y = 24, r = 14, col = '#fff') =>
  `<g stroke="${col}" stroke-width="2.6" stroke-linecap="round">${[0, 60, 120].map((d) => `<line x1="${x}" y1="${y - r}" x2="${x}" y2="${y + r}" transform="rotate(${d} ${x} ${y})"/>`).join('')}</g>`;
const BOLT = `<polygon points="27,6 15,26 23,26 18,42 34,20 26,20 31,6" fill="#ffe95a" stroke="#a87a10" stroke-width="1.2"/>`;
const SKULL = `<circle cx="24" cy="22" r="10" fill="#e8f0d8" stroke="#2a3a1a" stroke-width="1.5"/><rect x="19" y="29" width="10" height="7" rx="2" fill="#e8f0d8" stroke="#2a3a1a" stroke-width="1.5"/><circle cx="20" cy="21" r="3" fill="#3a6a1a"/><circle cx="28" cy="21" r="3" fill="#3a6a1a"/>`;
const SPEED = `<g stroke="#fff" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="18" x2="14" y2="18"/><line x1="4" y1="25" x2="14" y2="25"/><line x1="6" y1="32" x2="14" y2="32"/></g>`;
const BOOT = `<path d="M18 10 h10 v16 h8 c4 0 6 3 6 6 v4 h-24z" fill="#8a5a2b" stroke="#3a2410" stroke-width="2" stroke-linejoin="round"/><rect x="18" y="34" width="24" height="4" fill="#3a2410"/>`;
const BURST = (col = '#ffe27a', r = 14) =>
  `<polygon points="${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, d = i % 2 ? r * 0.5 : r; return `${(24 + Math.cos(a) * d).toFixed(1)},${(24 + Math.sin(a) * d).toFixed(1)}`; }).join(' ')}" fill="${col}" stroke="#a8331a" stroke-width="1.5"/>`;

const ART: Record<EnchId, [string, string, string]> = {
  // melee
  sharp: ['#d8e0f0', '#5a6a8a', SWORD() + `<path d="M34 8 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" fill="#fff"/>`],
  swift: ['#9af0ff', '#2a7ab0', SWORD() + SPEED],
  sweep: ['#c8f0ff', '#3a6aa8', `<path d="M10 34 A16 16 0 0 1 38 34" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M14 30 A12 12 0 0 1 34 30" stroke="#9ad8ff" stroke-width="3" fill="none" stroke-linecap="round"/>` + `<g transform="translate(0 -6) scale(1)">${''}</g>`],
  wildfire: ['#ffb05a', '#a8331a', SWORD('#ffd0a0') + FLAME(33, 30, 0.55)],
  chill: ['#bff1ff', '#2c7cb0', SWORD('#dff6ff') + FLAKE(34, 33, 7)],
  leech: ['#ff8aa0', '#7a1030', HEART() + `<path d="M19 18 l2 6 l2 -6z M25 18 l2 6 l2 -6z" fill="#fff"/>`],
  crit: ['#ffe27a', '#b06a10', BURST('#fff3b0') + `<text x="24" y="30" font-size="16" font-weight="900" text-anchor="middle" fill="#a8331a" font-family="sans-serif">!</text>`],
  soulheal: ['#9ae0ff', '#2a4a8a', GHOST + HEART('#ff5a7a', 0.4, 34, 36)],
  siphon: ['#c8a0ff', '#3a1a7a', `<circle cx="24" cy="24" r="10" fill="#b07aff" stroke="#fff" stroke-width="2"/><circle cx="24" cy="24" r="4" fill="#fff"/>` + `<g fill="#e8d8ff"><circle cx="10" cy="12" r="2.5"/><circle cx="38" cy="14" r="2"/><circle cx="12" cy="38" r="2"/><circle cx="37" cy="37" r="2.5"/></g>`],
  // ranged
  power: ['#ffd08a', '#a8601a', ARROW(8, 40, 38, 10) + `<path d="M8 40 l6 -2 l-4 -4z" fill="#ff5a3a"/>`],
  quick: ['#9af0ff', '#2a7ab0', ARROW(14, 36, 40, 14) + SPEED],
  pierce: ['#e8e0d0', '#6a5a4a', `<rect x="20" y="10" width="5" height="28" fill="#8a6a4a" stroke="#3a2410" stroke-width="1"/><rect x="28" y="10" width="5" height="28" fill="#8a6a4a" stroke="#3a2410" stroke-width="1"/>` + ARROW(6, 26, 44, 22)],
  flametip: ['#ffb05a', '#a8331a', ARROW(8, 40, 30, 18) + FLAME(34, 16, 0.5)],
  frosttip: ['#bff1ff', '#2c7cb0', ARROW(8, 40, 30, 18) + FLAKE(35, 15, 7)],
  poison: ['#b0f07a', '#2a6a1a', SKULL + ARROW(6, 44, 16, 34)],
  multishot: ['#6fc7ff', '#1f4f9a', ARROW(10, 38, 36, 12) + ARROW(10, 38, 22, 8) + ARROW(10, 38, 40, 26)],
  soularrow: ['#9ae0ff', '#2a4a8a', GHOST + ARROW(4, 44, 16, 32, '#9ae0ff')],
  // armor
  tough: ['#c8ccd8', '#4a5060', SHIELD('#8a92a0') + `<path d="M24 14 v20 M16 22 h16" stroke="#e8eef4" stroke-width="3"/>`],
  quickstep: ['#ffe27a', '#b07a10', BOOT + SPEED],
  mend: ['#9af0a0', '#1f7a3a', HEART('#4ad06a') + `<path d="M24 18 v12 M18 24 h12" stroke="#fff" stroke-width="3"/>`],
  nimble: ['#ffc8f0', '#8a3a7a', `<circle cx="24" cy="24" r="12" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 4"/><polygon points="34,10 40,16 32,18" fill="#fff"/><circle cx="24" cy="24" r="4" fill="#fff"/>`],
  heart: ['#ff8aa0', '#7a1030', HEART('#ff2a50', 1.15) + `<text x="36" y="16" font-size="12" font-weight="900" fill="#fff" font-family="sans-serif">+</text>`],
  soulguard: ['#9ae0ff', '#2a4a8a', SHIELD('#4a6a9a') + `<circle cx="24" cy="23" r="6" fill="#e8f8ff"/><circle cx="22" cy="22" r="1.3" fill="#2a3a5a"/><circle cx="26" cy="22" r="1.3" fill="#2a3a5a"/>`],
  thorns: ['#9ad07a', '#2a5a1a', SHIELD('#4a7a3a') + `<g fill="#e8f4d8"><polygon points="24,0 21,9 27,9"/><polygon points="44,10 36,12 39,17"/><polygon points="4,10 12,12 9,17"/><polygon points="41,31 33,27 34,33"/><polygon points="7,31 15,27 14,33"/></g>`],
  // effect enchantments
  boomshot: ['#ff9a4a', '#a8331a', `${ARROW(9, 39, 25, 23)}<circle cx="31" cy="20" r="9" fill="#2a2030"/><circle cx="28" cy="17" r="2.5" fill="#6a6078"/><path d="M36 12 q3 -5 7 -4" stroke="#7a4a22" stroke-width="2" fill="none"/><path d="M43 4 l1.5 3.5 l3.5 1 l-3.5 1 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1 l3.5 -1z" fill="#ffe27a"/>`],
  chainzap: ['#4a5aa8', '#151a3a', `<circle cx="10" cy="36" r="4.5" fill="#ff6a6a"/><circle cx="24" cy="14" r="4.5" fill="#ff6a6a"/><circle cx="38" cy="32" r="4.5" fill="#ff6a6a"/><polyline points="12,32 17,26 14,24 22,17" stroke="#ffe95a" stroke-width="3" fill="none" stroke-linejoin="round"/><polyline points="27,17 30,24 33,22 36,29" stroke="#ffe95a" stroke-width="3" fill="none" stroke-linejoin="round"/>`],
  seeker: ['#b07aff', '#4a1f8a', `<circle cx="34" cy="16" r="9" fill="none" stroke="#ffd0f0" stroke-width="2.5"/><circle cx="34" cy="16" r="4" fill="none" stroke="#ffd0f0" stroke-width="2"/><circle cx="34" cy="16" r="1.5" fill="#ff5a8a"/><path d="M8 40 C 10 22, 26 34, 30 20" stroke="#7a4a22" stroke-width="2.6" fill="none" stroke-linecap="round"/><polygon points="31,17 26,21 31,23" fill="#f4e6c8"/>`],
  bounce: ['#ffe8a0', '#a8701a', `<circle cx="12" cy="14" r="5" fill="#ff6a6a"/><circle cx="36" cy="14" r="5" fill="#ff6a6a"/><path d="M6 40 L24 30" stroke="#7a4a22" stroke-width="2.6" stroke-linecap="round"/>` + `<path d="M24 30 L34 20" stroke="#fff" stroke-width="2" stroke-dasharray="3 2"/>` + `<polygon points="34,19 28,21 32,25" fill="#f4e6c8"/><circle cx="24" cy="30" r="3" fill="#fff"/>`],
  thunder: ['#6a7aa0', '#20263a', `<ellipse cx="18" cy="13" rx="9" ry="6" fill="#d8dde8"/><ellipse cx="29" cy="11" rx="10" ry="7" fill="#eef1f6"/><ellipse cx="24" cy="16" rx="13" ry="5" fill="#c8cede"/><polygon points="25,18 17,30 23,30 19,43 32,25 25,25 29,18" fill="#ffe95a" stroke="#a87a10" stroke-width="1"/>`],
  whirl: ['#8af0a0', '#1f7a4a', `<path d="M24 24 m0 -3 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 6 a9 9 0 1 1 -9 -9 a12 12 0 1 1 12 12 a15 15 0 0 1 -15 -15" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><polygon points="38,8 44,12 37,15" fill="#e8f0f8"/>`],
  frostbite: ['#bff1ff', '#2c7cb0', `<rect x="12" y="12" width="24" height="24" rx="4" fill="#dff6ff" stroke="#fff" stroke-width="2" opacity=".9"/>` + FLAKE(24, 24, 9, '#5aa8d8') + `<path d="M14 14 l6 0 M14 14 l0 6" stroke="#fff" stroke-width="2"/>`],
  shockwave: ['#d8e8ff', '#3a4a8a', `<g fill="none" stroke="#fff" stroke-linecap="round"><path d="M14 12 Q22 24 14 36" stroke-width="3.5"/><path d="M22 10 Q31 24 22 38" stroke-width="3" opacity=".8"/><path d="M30 8 Q40 24 30 40" stroke-width="2.5" opacity=".6"/></g>`],
  frostnova: ['#e8fbff', '#3a8ac0', SHIELD('#5a9ad0') + `<circle cx="24" cy="24" r="17" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>` + FLAKE(24, 24, 7)],
  blastback: ['#ffb05a', '#8a2a1a', BURST('#ffd06a', 19) + SHIELD('#7a5a4a').replace('M24 8', 'M24 12').replace('L38 13 C38 27 33 35 24 41 C15 35 10 27 10 13z', 'L34 16 C34 27 30 32 24 37 C18 32 14 27 14 16z')],
};

const cache = new Map<EnchId, string>();
/** the enchantment's picture as a data URL for an <img> */
export function enchIcon(id: EnchId): string {
  let u = cache.get(id);
  if (!u) {
    const [a, b, inner] = ART[id] ?? ['#888', '#333', ''];
    u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frame(a, b, inner, id))}`;
    cache.set(id, u);
  }
  return u;
}
