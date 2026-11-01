// Art: the approved Alpine Dusk drawings (planes, base, fire, bombs) are kept as SVG
// markup and rasterised once per lighting palette into sprites. The landscape is built
// as Path2D shapes so its colours can blend smoothly every frame.
import { PALETTES, PALETTE_ORDER, hexMix, type Palette, type PaletteId } from './palettes';

export const G = 800;              // mockup ground line
export const TX = 195;             // mockup turret x
export const PIVOT_Y = G - 18.4;   // turret pivot in mockup space; world origin
export const GROUND_Y = 18.4;      // ground line in world space
export const BASE_SCALE = 1.15;
/** War mode's turrets, in world x: the base's own turret in the middle and one out on its own either side. */
export const WAR_POSTS = [-470, 0, 470];
export const B = { search: 70, radar: 110, depot: 152, turret: 195, hangar: 244, repair: 296 };

const f = (n: number) => Math.round(n * 100) / 100;
export function rng(seed: number): () => number { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function noise(seed: number): (x: number) => number { const r = rng(seed), v: number[] = []; for (let i = 0; i < 4096; i++) v.push(r()); return (x: number) => { const i = Math.floor(x), t = x - i, s = t * t * (3 - 2 * t), a = v[((i % 4096) + 4096) % 4096], b = v[(((i + 1) % 4096) + 4096) % 4096]; return a + (b - a) * s; }; }
function fbm(n: (x: number) => number, x: number, oct: number) { let s = 0, a = 1, t = 0; for (let k = 0; k < oct; k++) { s += a * n(x * Math.pow(2.1, k) + k * 37); t += a; a *= .5; } return s / t; }

/* ---------- planes: side view, facing right (from the mockups) ---------- */
export type PlaneType = 'heavy' | 'light' | 'fighter' | 'recon';
export type AnyPlaneType = PlaneType | 'cargo' | 'boss';
const SH: Record<PlaneType, string> = {
  heavy: `<path class="d" opacity=".75" d="M12,-6 C16,-8.5 28,-8.5 31,-6.5 L31,-3 L12,-3Z"/><path class="b" d="M-36,-6 C-39,-14 -43,-23 -42,-26 C-40,-27.5 -36,-27 -35,-25 C-32,-18 -28,-12 -22,-8Z"/><path class="ln" d="M-38,-12 C-36,-16 -37,-22 -38,-25"/><path class="b" d="M-50,-3 C-44,-6 -30,-10 -6,-10.5 C14,-11 32,-10 42,-7 C47,-5.5 50,-3 50,-1 C50,1.5 47,3.5 42,4.5 C30,6.5 10,7 -10,6 C-30,5 -44,2 -50,-1Z"/><path class="ln" d="M-36,-8.6 L-33,4.4 M-10,-10.4 L-10,6 M14,-10.8 L14,6.8 M-48,-1 C-20,1 20,1.5 48,0"/><path class="b" d="M-50,-2 L-34,-3 C-31,-2.8 -31,-0.2 -34,0 L-50,0.4Z"/><path class="g" d="M0,-10.5 C1,-14.5 9,-14.5 10,-10.6Z"/><path class="g" d="M24,-9.8 C26,-13.2 33,-13 37,-8.4Z"/><path class="g" d="M42,-7 C47,-5.5 50,-3 50,-1 C50,1 48.5,2.5 45.5,3.4 C44,0 43,-4 42,-7Z"/><path class="g" d="M-50,-3 C-48,-4.6 -46,-4.6 -45,-3.6 L-48.6,-1Z"/><path class="g" d="M-18,-5.6 h2.4 v1.8 h-2.4z M-13,-5.8 h2.4 v1.8 h-2.4z"/><path class="b" d="M6,-1 C9,-4.4 24,-4.6 30,-3 C31.5,-2 31.5,2.2 30,3 C24,4.6 9,4.4 6,1Z"/><path class="ln" d="M26,-3.6 L26,3.6 M6,0 L26,0"/><path class="b" d="M-4,1.4 L18,0.6 C20,0.8 20,2.8 18,3 L-4,3.8Z"/><path class="d" d="M10,2.6 h4 v1 h-4z"/><circle class="d" cx="-24" cy="-1" r="2.6" opacity=".6"/><circle class="hi" cx="-24" cy="-1" r="1.1"/><ellipse class="pr" cx="31.6" cy="-5" rx="1" ry="7" opacity=".6"/><ellipse class="pr" cx="31.6" cy="0" rx="1.3" ry="9.5"/><path class="d" d="M30.6,-1.5 C32.6,-1.5 33.8,0 33.8,0 C33.8,0 32.6,1.5 30.6,1.5Z"/>`,
  light: `<path class="d" opacity=".75" d="M6,-5 C9,-7 19,-7 22,-5.5 L22,-2.5 L6,-2.5Z"/><path class="b" d="M-30,-4 C-32,-10 -35,-17 -34,-19 C-32.5,-20 -29.5,-19.5 -29,-18 C-27,-13 -24,-9 -19,-6Z"/><path class="b" d="M-40,-2 C-34,-5 -22,-7.5 -4,-8 C12,-8.4 26,-7.6 33,-5.4 C38,-4 40,-2 40,0 C40,2 37,3.6 32,4.2 C20,5.4 4,5.6 -10,5 C-24,4.2 -34,2 -40,0Z"/><path class="ln" d="M-28,-6 L-26,3.6 M-6,-8 L-6,5.4 M-38,-0.8 C-10,1 16,1.4 38,0.4"/><path class="b" d="M-40,-1.4 L-27,-2 C-24.6,-1.8 -24.6,0.2 -27,0.4 L-40,0.6Z"/><path class="g" d="M14,-8.2 C16,-11 22,-11 26,-7.4Z"/><path class="g" d="M32,-5.6 C37,-4.2 40,-2 40,0 C40,1.6 38.5,2.8 36,3.4 C34.6,0.6 33.4,-2.6 32,-5.6Z"/><path class="g" d="M-4,-8 C-3,-10.4 2,-10.4 3,-8.1Z"/><path class="b" d="M2,-0.6 C4,-3.8 16,-4 22,-2.6 C23.4,-1.6 23.4,2 22,2.8 C16,4.2 4,4 2,1.2Z"/><path class="ln" d="M18.6,-3.2 L18.6,3.4"/><path class="b" d="M-6,1.4 L12,0.8 C14,1 14,2.8 12,3 L-6,3.6Z"/><circle class="d" cx="-18" cy="-1" r="2.2" opacity=".6"/><circle class="hi" cx="-18" cy="-1" r=".9"/><ellipse class="pr" cx="23.6" cy="-4" rx=".8" ry="5.5" opacity=".6"/><ellipse class="pr" cx="23.6" cy="0.1" rx="1.1" ry="7.5"/><path class="d" d="M22.8,-1.2 C24.4,-1.2 25.4,0 25.4,0 C25.4,0 24.4,1.2 22.8,1.2Z"/>`,
  fighter: `<path class="b" d="M-24,-2 C-26,-7 -28,-12 -27,-13.4 C-25.6,-14.2 -23.4,-13.8 -22.6,-12.6 C-21,-9 -19,-6 -16,-4Z"/><path class="b" d="M-30,-1 C-24,-3.4 -12,-4.6 2,-5 C12,-5.2 20,-4.8 25,-3.6 L28,-2.2 C29.4,-1.4 29.4,1.4 28,2.2 L25,3.2 C18,4.4 6,4.8 -6,4.2 C-18,3.6 -26,1.6 -30,0.6Z"/><path class="g" d="M0,-4.9 C2,-8.6 9,-8.8 12,-5.2Z"/><path class="ln" d="M5.4,-8 L5.8,-5 M-20,-3 L-19,2.6 M16,-4.8 L16,4 M-28,0 C-10,1 10,1 27,0"/><path class="d" d="M-2,4 C0,6.2 6,6.2 8,4.4Z"/><path class="d" d="M17,-2.8 h1.1 v1 h-1.1z M19.2,-2.8 h1.1 v1 h-1.1z M21.4,-2.8 h1.1 v1 h-1.1z"/><path class="b" d="M-30,-0.8 L-20,-1.2 C-18.4,-1 -18.4,0.4 -20,0.6 L-30,0.8Z"/><path class="b" d="M-6,2.2 L8,1.6 C9.6,1.8 9.6,3.4 8,3.6 L-6,4Z"/><circle class="d" cx="-12" cy="-0.4" r="1.8" opacity=".6"/><circle class="hi" cx="-12" cy="-0.4" r=".7"/><ellipse class="pr" cx="29.6" cy="0" rx="1.1" ry="8.5"/><path class="d" d="M28.4,-1.8 C30.4,-1.6 31.6,0 31.6,0 C31.6,0 30.4,1.6 28.4,1.8Z"/>`,
  recon: `<path class="b" d="M-22,-1.6 C-24,-6 -26,-10.6 -25,-12 C-23.6,-12.8 -21.6,-12.4 -21,-11.2 C-19.6,-8 -17.6,-5 -14,-3Z"/><path class="b" d="M-28,-0.6 C-20,-2.4 -8,-3.4 4,-4.6 C12,-6 18,-5.6 22,-3.6 C25,-2.2 26,-0.6 26,0.6 C25.6,2.4 22,3.6 16,4 C6,4.6 -10,3.2 -28,0.6Z"/><path class="g" d="M4,-4.6 C8,-8.4 16,-8.6 19,-5.2 L17,-0.4 L6,-0.6Z"/><path class="ln" d="M10,-7.6 L10.6,-0.6 M14.6,-7.8 L14.2,-0.6 M20,-4.8 L20,3.4 M-26,0 C-10,1 10,1.4 24,0.6"/><path class="b" d="M2,-9.6 L22,-10 C23.6,-9.8 23.6,-8.2 22,-8 L2,-7.8Z"/><path class="d" d="M7,-8 L13,2.4 L13.8,2.4 L7.8,-8Z M12,3.6 L10,8 L11,8 L13.2,3.6Z"/><circle class="d" cx="10.5" cy="8.6" r="1.6"/><path class="b" d="M-28,-0.3 L-19,-0.8 C-17.6,-0.6 -17.6,0.6 -19,0.8 L-28,0.8Z"/><circle class="d" cx="-12" cy="0" r="1.8" opacity=".6"/><circle class="hi" cx="-12" cy="0" r=".7"/><ellipse class="pr" cx="27" cy="0.2" rx="1" ry="7"/><path class="d" d="M25.8,-1.4 C27.6,-1.4 28.6,0.2 28.6,0.2 C28.6,0.2 27.6,1.6 25.8,1.6Z"/>`,
};
// The boss is the heavy bomber's airframe, much bigger, with twin tails, gun turrets and red bands.
const BOSS_SH = `<path class="d" opacity=".8" d="M-29,-6 C-32,-14 -35,-21 -34,-24 C-32.5,-25 -29.5,-24.5 -29,-23 C-26,-17 -23,-12 -17,-8Z"/>${SH.heavy}` +
  `<path class="rd" d="M-41.2,-23.4 C-40.6,-26.6 -36.6,-27.4 -35.2,-24.6 L-34.2,-22 L-40.4,-21.2Z"/>` +
  `<path class="rd" d="M-29,-9.1 L-25,-9.5 L-25,5 L-29,4.6Z M36,-8 L39.6,-7.3 L39.6,4.7 L36,5.3Z"/>` +
  `<path class="g" d="M-15,-10.2 C-14,-14.2 -6.6,-14.2 -5.6,-10.3Z"/><path class="d" d="M-7.4,-12.9 L4.4,-13.8 L4.4,-12.8 L-7.4,-12.1Z"/>` +
  `<path class="b" d="M-21,5.3 C-19,9.4 -8.6,9.6 -4.4,5.9Z"/><path class="g" d="M-18.6,6.2 C-16.6,8.6 -10.6,8.8 -7.4,6.4Z"/>`;
export const SC: Record<AnyPlaneType, number> = { heavy: .38, light: .36, fighter: .44, recon: .42, cargo: .4, boss: .7 };
export const HALF: Record<AnyPlaneType, number> = { heavy: 50, light: 40, fighter: 30, recon: 28, cargo: 50, boss: 50 };
// Running-light positions (plane local, unscaled): wingtip and tail.
export const LIGHTS: Record<AnyPlaneType, [[number, number], [number, number]]> = {
  heavy: [[-2, 2.6], [-46, -2]], light: [[0, 2.4], [-38, -1]], fighter: [[0, 3], [-28, 0]],
  recon: [[12, -9], [-26, 0]], cargo: [[-2, 2.6], [-46, -2]], boss: [[-2, 2.6], [-46, -2]],
};

/* ---------- small pieces from the mockups ---------- */
function fireSvg() { return `<circle r="9" fill="url(#fglow)"/><path d="M-3.2,1.2 C-4,-2.6 -1.4,-4 -1.6,-7 C0,-5 1,-5.4 1.2,-9.6 C3.8,-6.4 4.4,-2.8 3.4,1.2 C1.2,2.6 -1.2,2.6 -3.2,1.2Z" fill="url(#flame)"/><path d="M-1.6,1.2 C-2,-1 -0.6,-2 -0.4,-4 C0.8,-2.6 1.8,-2 1.8,1.2 C0.6,2 -0.6,2 -1.6,1.2Z" fill="#fff3c4"/>`; }
function bombSvg(S: Palette, big: boolean) { const k = big ? 1.45 : 1; return `<g transform="scale(${k})"><path d="M0,5 C1.6,4.6 2.2,2.6 2.2,0 L1.8,-3 L-1.8,-3 L-2.2,0 C-2.2,2.6 -1.6,4.6 0,5Z" fill="url(#bomb)"/><path d="M-0.6,4.6 h1.2 v1.2 h-1.2z" fill="${S.pDark}"/><path d="M-2.4,-6 L2.4,-6 L1.7,-3 L-1.7,-3Z" fill="${S.pDark}"/><path d="M-2.1,0.4 h4.2 v.6 h-4.2z" fill="${S.pHi}" opacity=".5"/></g>`; }
function sandbags(x0: number, x1: number, y: number, rows: number, skip = 0) { let s = ''; const r0 = rng(x0 * 7 | 0); for (let r = 0; r < rows; r++) { const yy = y - (r + 1) * 2.15, off = r % 2 ? 2 : 0, ins = r * 1.6; for (let x = x0 + ins + off; x < x1 - ins - 3.6; x += 4.1) { if (skip && r0() < skip) continue; s += `<rect class="fa" x="${f(x)}" y="${f(yy)}" width="4.2" height="2.35" rx="1.15"/><rect class="lt" x="${f(x + .6)}" y="${f(yy + .15)}" width="2.8" height=".5" rx=".25" opacity=".7"/>`; } } return s; }
function person(x: number, y: number, c: string) { return `<g fill="${c}"><circle cx="${x}" cy="${y - 4.6}" r=".85"/><path d="M${x - .8},${y - 3.7} h1.6 l.3,2 h-.5 l-.2,1.7 h-.5 l-.1,-1.6 l-.1,1.6 h-.5 l-.2,-1.7 h-.5z"/><path d="M${x - 1.2},${y - 5.3} h2.4 l-.4,-.6 h-1.6z"/></g>`; }
function rubble(x: number, w: number, seed: number, _S: Palette) { const r = rng(seed); let s = `<path class="dk" d="M${x - w},${G} C${x - w * .7},${G - 4} ${x - w * .3},${G - 5.4} ${x},${G - 3} C${x + w * .3},${G - 5} ${x + w * .6},${G - 3} ${x + w},${G}Z"/>`; for (let i = 0; i < 6; i++) { const dx = (r() - .5) * w * 1.5, dy = -1.5 - r() * 3.5, ww = 1.6 + r() * 2, a = (r() - .5) * 80; s += `<rect class="${r() < .5 ? 'fa' : 'sh'}" x="${f(x + dx)}" y="${f(G + dy)}" width="${f(ww)}" height="${f(ww * .45)}" transform="rotate(${f(a)} ${f(x + dx)} ${f(G + dy)})"/>`; } return s; }
function scorch(x: number, y: number, w: number) { return `<ellipse class="dk" cx="${x}" cy="${y}" rx="${w}" ry="${w * .55}" opacity=".75"/>`; }

/* ---------- base structures: intact, damaged and ruined ---------- */
function pad(S: Palette) {
  let s = `<path class="gr" d="M30,${G + 1} C60,${G - 3} 330,${G - 3} 360,${G + 1} L360,${G + 6} L30,${G + 6}Z"/><path class="edge" d="M36,${G - .6} C80,${G - 2.6} 310,${G - 2.6} 354,${G - .6}" opacity=".55"/>`;
  for (let x = 34; x <= 356; x += 9) s += `<rect class="dk" x="${x}" y="${G - 4}" width=".7" height="5"/>`;
  s += `<path d="M34,${G - 3} L356,${G - 3}" stroke="${S.bDark}" stroke-width=".35" opacity=".8"/>`;
  return s;
}
/** Building state: 0 intact, 1 damaged, 2 ruined. */
export type BuildingState = 0 | 1 | 2;

function searchBase(S: Palette, st: BuildingState) {
  const x = B.search;
  if (st === 2) return sandbags(x - 11, x + 11, G, 1, .4) + `<path class="mt" d="M${x - 1.4},${G} L${x - 1.4},${G - 4} L${x + 4},${G - 7} L${x + 4.8},${G - 6} L${x + 1.4},${G - 3} L${x + 1.4},${G}Z"/>` + rubble(x, 8, 3, S) + `<ellipse cx="${x + 6}" cy="${G - 1.4}" rx="3.4" ry="1.4" fill="${S.lens}" opacity=".35"/>`;
  return sandbags(x - 11, x + 11, G, 2, st === 1 ? .2 : 0) + `<rect class="mt" x="${x - 1.4}" y="${G - 8}" width="2.8" height="4"/><path class="mt" d="M${x - 4.4},${G - 7.6} L${x - 4.4},${G - 13} L${x - 3.4},${G - 13} L${x - 3.4},${G - 8.6} L${x + 3.4},${G - 8.6} L${x + 3.4},${G - 13} L${x + 4.4},${G - 13} L${x + 4.4},${G - 7.6}Z"/>` + (st === 1 ? scorch(x + 5, G - 2, 4) : '');
}
// The lamp head, centred on its pivot, lens pointing up; rotated toward the aim at runtime.
function searchHead(S: Palette) { return `<rect class="sh" x="-4.2" y="-5" width="8.4" height="8.6" rx="1.2"/><rect class="fa" x="-4.2" y="-5" width="3.2" height="8.6" rx="1"/><path d="M-3,-1 h6 M-3,0.6 h6 M-3,2.2 h6" stroke="${S.bDark}" stroke-width=".35"/><ellipse cx="0" cy="-5.1" rx="4.2" ry="1.3" fill="${S.lens}"/><ellipse cx="-1.2" cy="-5.4" rx="1.6" ry=".5" fill="#ffffff" opacity=".6"/>`; }
function radar(S: Palette, st: BuildingState) {
  const x = B.radar;
  if (st === 2) return `<path class="fa" d="M${x - 10},${G} L${x - 10},${G - 6} L${x - 6},${G - 7.6} L${x - 3},${G - 4} L${x + 1},${G - 6.4} L${x + 5},${G - 3} L${x + 5},${G}Z"/><path class="sh" d="M${x + 5},${G} L${x + 5},${G - 3} L${x + 8},${G - 4} L${x + 8},${G}Z"/>` + `<rect class="mt" x="${x + 2}" y="${G - 2.4}" width="16" height="1.4" transform="rotate(-8 ${x + 2} ${G - 2})"/><g transform="translate(${x + 18} ${G - 4}) rotate(70) scale(.62 1)"><circle r="8" fill="url(#dish)"/><circle r="8" fill="none" stroke="${S.bMetal}" stroke-width=".9"/></g>` + rubble(x - 2, 10, 5, S);
  let s = `<rect class="fa" x="${x - 10}" y="${G - 10}" width="15" height="10"/><path class="sh" d="M${x + 5},${G} L${x + 5},${G - 10} L${x + 8},${G - 11.4} L${x + 8},${G - 1.2}Z"/><path class="lt" d="M${x - 10.8},${G - 10} L${x + 5},${G - 10} L${x + 8},${G - 11.4} L${x - 7.8},${G - 11.4}Z"/><rect class="gl" x="${x - 7}" y="${G - 7.6}" width="3" height="2.4"/><rect class="dk" x="${x - 1.6}" y="${G - 7.6}" width="3.4" height="7.6"/>`;
  s += `<rect class="mt" x="${x + .6}" y="${G - 24}" width="1.4" height="13"/><path d="M${x - 2},${G - 11.4} L${x + 1.3},${G - 20} L${x + 4.6},${G - 11.4}" fill="none" stroke="${S.bMetal}" stroke-width=".6"/>`;
  s += `<g transform="translate(${x + 1.6} ${G - 27}) rotate(-32) scale(.62 1)"><circle r="10" fill="url(#dish)"/><circle r="10" fill="none" stroke="${S.bMetal}" stroke-width=".9"/><circle r="6.6" fill="none" stroke="${S.bDark}" stroke-width=".45" opacity=".7"/><circle r="3.3" fill="none" stroke="${S.bDark}" stroke-width=".45" opacity=".7"/>${[0, 30, 60, 90, 120, 150].map(a => `<line x1="${f(10 * Math.cos(a * Math.PI / 180))}" y1="${f(10 * Math.sin(a * Math.PI / 180))}" x2="${f(-10 * Math.cos(a * Math.PI / 180))}" y2="${f(-10 * Math.sin(a * Math.PI / 180))}" stroke="${S.bDark}" stroke-width=".4" opacity=".6"/>`).join('')}<line x1="0" y1="0" x2="-9" y2="0" stroke="${S.bMetal}" stroke-width=".9"/><circle cx="-9.4" cy="0" r="1.2" class="mt"/></g>`;
  if (st === 1) s += scorch(x - 4, G - 5, 3) + `<path class="dk" d="M${x - 10},${G - 10} l3,2 l2,-1.6 l2,1.6 v-2Z"/>`;
  return s;
}
function depot(S: Palette, st: BuildingState) {
  const x = B.depot;
  if (st === 2) {
    let s = `<path class="gr" d="M${x - 21},${G} C${x - 16},${G - 6} ${x - 8},${G - 8} ${x},${G - 7} C${x + 8},${G - 8.4} ${x + 15},${G - 5} ${x + 21},${G}Z"/><path class="dk" d="M${x - 6},${G} L${x - 5},${G - 4} L${x + 5},${G - 4.4} L${x + 6},${G}Z"/>`;
    s += `<rect class="sh" x="${x + 13}" y="${G - 3}" width="4" height="3" transform="rotate(20 ${x + 13} ${G - 3})"/><rect class="fa" x="${x - 26}" y="${G - 3}" width="4" height="3" transform="rotate(-25 ${x - 26} ${G - 3})"/><rect class="mt" x="${x + 17}" y="${G - 2.4}" width="4.6" height="2.4" rx=".4"/>`;
    return s + rubble(x, 12, 8, S);
  }
  let s = `<path class="gr" d="M${x - 21},${G} C${x - 18},${G - 11} ${x - 12},${G - 14} ${x - 4},${G - 14} L${x + 6},${G - 14} C${x + 13},${G - 14} ${x + 18},${G - 10} ${x + 21},${G} Z"/><path class="edge" d="M${x - 20},${G - 2} C${x - 17},${G - 11} ${x - 12},${G - 13.6} ${x - 4},${G - 13.6} L${x + 6},${G - 13.6}"/>`;
  s += `<rect class="fa" x="${x - 10}" y="${G - 10.5}" width="20" height="10.5"/><rect class="lt" x="${x - 10}" y="${G - 10.5}" width="20" height=".8"/><rect class="dk" x="${x - 6}" y="${G - 8.4}" width="12" height="8.4"/><path d="M${x},${G - 8.4} v8.4" stroke="${S.bShade}" stroke-width=".5"/>`;
  if (st === 1) s += `<path class="dk" d="M${x + 4},${G - 14} l3,-1.6 l2.6,1.2 l1.8,-1 l1.4,1.6 l-2,1.4Z"/>`;
  const crates = st === 1 ? [[x + 12, G - 4, 5, 4], [x + 17.4, G - 4, 5, 4], [x - 27, G - 4, 5, 4]] : [[x + 12, G - 4, 5, 4], [x + 17.4, G - 4, 5, 4], [x + 14.6, G - 8, 5, 4], [x - 27, G - 4, 5, 4]];
  crates.forEach(([cx, cy, w, h]) => { s += `<rect class="fa" x="${cx}" y="${cy}" width="${w}" height="${h}"/><rect class="sh" x="${cx + w * .62}" y="${cy}" width="${w * .38}" height="${h}"/><rect class="lt" x="${cx}" y="${cy}" width="${w}" height=".6"/><path d="M${cx + .6},${cy + h / 2} h${w - 1.2}" stroke="${S.bDark}" stroke-width=".3"/>`; });
  [[x - 21, G - 4.6], [x - 18.2, G - 4.6]].forEach(([cx, cy]) => { s += `<rect class="mt" x="${cx}" y="${cy}" width="2.5" height="4.6" rx=".4"/><rect class="lt" x="${cx}" y="${cy + 1.2}" width="2.5" height=".4" opacity=".7"/>`; });
  return s;
}
function turretPit(S: Palette, st: BuildingState) {
  const x = B.turret;
  let s = `<ellipse class="dk" cx="${x}" cy="${G - 1}" rx="22" ry="2.6" opacity=".55"/>`;
  if (st === 2) {
    s += `<rect class="mt" x="${x - 15}" y="${G - 4}" width="30" height="1.6" transform="rotate(6 ${x} ${G - 4})"/><path class="sh" d="M${x - 8},${G - 3} L${x - 6},${G - 9} L${x + 2},${G - 7} L${x + 7},${G - 3}Z"/><path class="fa" d="M${x - 12},${G - 3} L${x - 11},${G - 12} L${x - 6},${G - 10} L${x - 7},${G - 3}Z"/><rect class="mt" x="${x - 2}" y="${G - 6}" width="22" height="2" transform="rotate(-14 ${x - 2} ${G - 6})"/>`;
    return s + sandbags(x - 24, x + 24, G, 2, .35) + rubble(x, 16, 12, S);
  }
  s += `<rect class="mt" x="${x - 15}" y="${G - 6.4}" width="30" height="1.6"/><path class="sh" d="M${x - 8},${G - 5} L${x - 5.6},${G - 15} L${x + 5.6},${G - 15} L${x + 8},${G - 5}Z"/><path class="fa" d="M${x - 8},${G - 5} L${x - 5.6},${G - 15} L${x - 1},${G - 15} L${x - 2},${G - 5}Z"/><rect class="mt" x="${x - 4.6}" y="${G - 19}" width="9.2" height="5" rx="1"/>`;
  s += `<path class="fa" d="M${x - 11},${G - 13} L${x - 11},${G - 24} C${x - 6},${G - 26.4} ${x + 6},${G - 26.4} ${x + 11},${G - 24} L${x + 11},${G - 13}Z"/><path class="sh" d="M${x + 3},${G - 13} L${x + 3},${G - 25.8} C${x + 6},${G - 25.4} ${x + 9},${G - 24.8} ${x + 11},${G - 24} L${x + 11},${G - 13}Z"/><path class="edge" d="M${x - 11},${G - 24} C${x - 6},${G - 26.4} ${x + 6},${G - 26.4} ${x + 11},${G - 24}"/>`;
  if (st === 1) s += `<path class="dk" d="M${x - 11},${G - 20} l3,-1 l1,2 l-2,2 l-2,-.6Z"/>` + scorch(x + 9, G - 16, 2.4);
  s += person(x - 15, G - 1, S.bDark) + person(x + 15.5, G - 1, S.bDark);
  s += sandbags(x - 24, x + 24, G, 3, st === 1 ? .12 : 0);
  [[x + 19, G - 11.5], [x + 21.2, G - 11.5]].forEach(([cx, cy]) => { s += `<rect class="mt" x="${cx}" y="${cy}" width="1.5" height="4.6" rx=".6"/>`; });
  return s;
}
function hangar(S: Palette, st: BuildingState) {
  const x = B.hangar;
  const truck = `<rect class="fa" x="${x + 24}" y="${G - 5.4}" width="9" height="4.6" rx=".6"/><rect class="sh" x="${x + 30}" y="${G - 7.8}" width="4.4" height="7"/><rect class="gl" x="${x + 31}" y="${G - 7}" width="2.4" height="2" opacity=".6"/><circle class="dk" cx="${x + 26.4}" cy="${G - .6}" r="1.5"/><circle class="dk" cx="${x + 32}" cy="${G - .6}" r="1.5"/>`;
  if (st === 2) {
    let s = '';
    for (let i = 0; i < 4; i++) { const k = i * 4.4; s += `<path d="M${x - 21 + k},${G} L${x - 21 + k},${G - 8} C${x - 20 + k * .9},${G - 18 + k * .85} ${x - 12 + k * .5},${G - 23 + k} ${x - 2 + k * .3},${G - 23 + k}" fill="none" stroke="${S.bShade}" stroke-width=".9"/>`; }
    s += `<path class="fa" d="M${x - 21},${G} L${x - 21},${G - 8} C${x - 20.4},${G - 12} ${x - 18},${G - 15} ${x - 15},${G - 16} L${x - 13},${G - 11} L${x - 8},${G - 9} L${x - 4},${G - 4} L${x + 2},${G - 5} L${x + 8},${G}Z"/>`;
    return s + rubble(x + 6, 15, 21, S) + `<rect class="fa" x="${x + 24}" y="${G - 3}" width="9" height="3" rx=".6" transform="rotate(12 ${x + 24} ${G - 3})"/>`;
  }
  if (st === 1) {
    let s = `<path class="fa" d="M${x - 21},${G} L${x - 21},${G - 8} C${x - 20},${G - 18} ${x - 12},${G - 23} ${x},${G - 23} C${x + 6},${G - 23} ${x + 10},${G - 21.6} ${x + 12},${G - 20} L${x + 9},${G - 17} L${x + 13},${G - 15.6} L${x + 11},${G - 13} L${x + 17},${G - 12.6} C${x + 19},${G - 11} ${x + 20.6},${G - 9.6} ${x + 21},${G - 8} L${x + 21},${G} Z"/>`;
    s += `<path class="sh" d="M${x + 5},${G} L${x + 5},${G - 22.6} C${x + 8},${G - 22.2} ${x + 10},${G - 21.6} ${x + 12},${G - 20} L${x + 9},${G - 17} L${x + 13},${G - 15.6} L${x + 11},${G - 13} L${x + 17},${G - 12.6} C${x + 19},${G - 11} ${x + 20.6},${G - 9.6} ${x + 21},${G - 8} L${x + 21},${G} Z" opacity=".75"/>`;
    s += `<path class="edge" d="M${x - 21},${G - 8} C${x - 20},${G - 18} ${x - 12},${G - 23} ${x},${G - 23} C${x + 6},${G - 23} ${x + 10},${G - 21.6} ${x + 12},${G - 20}"/>`;
    for (let i = 1; i < 4; i++) { const k = i * 4.4; s += `<path d="M${x - 21 + k},${G} L${x - 21 + k},${G - 8} C${x - 20 + k * .9},${G - 18 + k * .85} ${x - 12 + k * .5},${G - 23 + k} ${x},${G - 23 + k}" fill="none" stroke="${S.bShade}" stroke-width=".35" opacity=".8"/>`; }
    s += `<rect class="dk" x="${x - 12}" y="${G - 14}" width="22" height="14"/><path d="M${x - 1},${G - 14} v14 M${x - 6.5},${G - 14} v14 M${x + 4.5},${G - 14} v14" stroke="${S.bShade}" stroke-width=".4"/><path class="gl" d="M${x + 9},${G - 17} L${x + 13},${G - 15.6} L${x + 11},${G - 13} L${x + 17},${G - 12.6} L${x + 16},${G - 11} L${x + 9},${G - 12}Z" opacity=".9"/>`;
    return s + truck;
  }
  let s = `<path class="fa" d="M${x - 21},${G} L${x - 21},${G - 8} C${x - 20},${G - 18} ${x - 12},${G - 23} ${x},${G - 23} C${x + 12},${G - 23} ${x + 20},${G - 18} ${x + 21},${G - 8} L${x + 21},${G} Z"/>`;
  s += `<path class="sh" d="M${x + 5},${G} L${x + 5},${G - 22.6} C${x + 13},${G - 21.6} ${x + 20},${G - 16} ${x + 21},${G - 8} L${x + 21},${G} Z" opacity=".75"/>`;
  s += `<path class="edge" d="M${x - 21},${G - 8} C${x - 20},${G - 18} ${x - 12},${G - 23} ${x},${G - 23} C${x + 6},${G - 23} ${x + 10},${G - 21.6} ${x + 12},${G - 20}"/>`;
  for (let i = 1; i < 4; i++) { const k = i * 4.4; s += `<path d="M${x - 21 + k},${G} L${x - 21 + k},${G - 8} C${x - 20 + k * .9},${G - 18 + k * .85} ${x - 12 + k * .5},${G - 23 + k} ${x},${G - 23 + k} C${x + 12 - k * .5},${G - 23 + k} ${x + 20 - k * .9},${G - 18 + k * .85} ${x + 21 - k},${G - 8}" fill="none" stroke="${S.bShade}" stroke-width=".35" opacity=".8"/>`; }
  s += `<rect class="dk" x="${x - 12}" y="${G - 14}" width="22" height="14"/><path d="M${x - 1},${G - 14} v14 M${x - 6.5},${G - 14} v14 M${x + 4.5},${G - 14} v14" stroke="${S.bShade}" stroke-width=".4"/><rect class="gl" x="${x - 3}" y="${G - 18.5}" width="4" height="2" opacity=".85"/>`;
  return s + truck;
}
function repair(S: Palette, st: BuildingState) {
  const x = B.repair;
  if (st === 2) {
    let s = `<path class="sh" d="M${x - 16},${G} L${x - 16},${G - 9} L${x - 13},${G - 11} L${x - 12},${G - 6} L${x - 9},${G - 8} L${x - 8},${G} Z"/><path class="fa" d="M${x - 16},${G} L${x - 16},${G - 9} L${x - 14.4},${G - 10} L${x - 14.4},${G}Z"/><path class="sh" d="M${x + 5},${G} L${x + 5},${G - 7} L${x + 8},${G - 5} L${x + 10},${G - 8.6} L${x + 12},${G - 4} L${x + 13},${G}Z"/>`;
    s += `<path class="dk" d="M${x - 18},${G} C${x - 14},${G - 4} ${x - 6},${G - 5.4} ${x - 1},${G - 3} C${x + 3},${G - 5} ${x + 10},${G - 3} ${x + 16},${G}Z"/>`;
    for (const [dx, dy, w, h, a] of [[-6, -4, 3, 1.4, 20], [0, -5, 2.4, 1.2, -30], [4, -3.4, 3.4, 1.2, 10], [-10, -2.4, 2, 1, 45], [9, -2.6, 2.6, 1.1, -15]]) s += `<rect class="fa" x="${x + dx}" y="${G + dy}" width="${w}" height="${h}" transform="rotate(${a} ${x + dx} ${G + dy})"/>`;
    s += `<path d="M${x - 4},${G - 1} L${x - 4},${G - 20} M${x - 4},${G - 20} L${x + 14},${G - 6} M${x + 14},${G - 6} L${x + 15},${G}" stroke="${S.bMetal}" stroke-width="1.1" fill="none"/><path d="M${x - 4},${G - 14} L${x + 6},${G - 13.4} M${x - 4},${G - 8} L${x + 11},${G - 8.4}" stroke="${S.bMetal}" stroke-width=".4" fill="none"/><path d="M${x - 4},${G - 20} L${x - 1},${G - 17} M${x + 2},${G - 15.4} L${x + 4},${G - 12}" stroke="${S.bLit}" stroke-width=".4" opacity=".6"/>`;
    return s;
  }
  // Workshop shed with a gantry crane over the yard.
  let s = `<path class="fa" d="M${x - 17},${G} L${x - 17},${G - 11} L${x - 6},${G - 14} L${x + 2},${G - 11.6} L${x + 2},${G}Z"/><path class="sh" d="M${x - 6},${G - 14} L${x + 2},${G - 11.6} L${x + 2},${G} L${x - 6},${G}Z" opacity=".8"/><path class="lt" d="M${x - 17.8},${G - 11} L${x - 6},${G - 14.6} L${x - 6},${G - 13.6} L${x - 17},${G - 10.2}Z"/>`;
  s += `<rect class="dk" x="${x - 14}" y="${G - 7.5}" width="7" height="7.5"/><rect class="gl" x="${x - 3.6}" y="${G - 8.6}" width="2.6" height="2" opacity=".8"/>`;
  s += `<path d="M${x + 4},${G} L${x + 4},${G - 21} M${x + 15},${G} L${x + 15},${G - 21} M${x + 2.6},${G - 21} L${x + 16.4},${G - 21}" stroke="${S.bMetal}" stroke-width="1.1" fill="none"/><path d="M${x + 4},${G - 6} L${x + 15},${G - 16} M${x + 4},${G - 16} L${x + 15},${G - 6}" stroke="${S.bMetal}" stroke-width=".35" fill="none" opacity=".8"/><path d="M${x + 10},${G - 21} v8" stroke="${S.bDark}" stroke-width=".4"/><rect class="mt" x="${x + 8.8}" y="${G - 13}" width="2.4" height="1.6"/><path d="M${x + 4},${G - 21} L${x + 16},${G - 21}" stroke="${S.bLit}" stroke-width=".4" opacity=".7"/>`;
  s += `<rect class="fa" x="${x + 7}" y="${G - 4}" width="6" height="4"/><rect class="sh" x="${x + 10.8}" y="${G - 4}" width="2.2" height="4"/>`;
  if (st === 1) s += scorch(x - 10, G - 9, 3) + `<path class="dk" d="M${x - 6},${G - 14} l2,2.6 l2.4,-1 l1,1.4 l-2.4,-3.4Z"/>`;
  return s;
}

export type BuildingId = 'search' | 'radar' | 'depot' | 'turret' | 'hangar' | 'repair';
export interface BuildingDef { id: BuildingId; name: string; mx: number; hp: number; half: number; box: Box; draw: (S: Palette, st: BuildingState) => string; }
export type Box = [number, number, number, number];

export const BUILDINGS: BuildingDef[] = [
  { id: 'search', name: 'Searchlight', mx: B.search, hp: 80, half: 14, box: [52, 768, 36, 34], draw: searchBase },
  { id: 'radar', name: 'Radar', mx: B.radar, hp: 80, half: 16, box: [90, 756, 40, 46], draw: radar },
  { id: 'depot', name: 'Weapons depot', mx: B.depot, hp: 100, half: 24, box: [118, 780, 66, 22], draw: depot },
  { id: 'turret', name: 'Main turret', mx: B.turret, hp: 200, half: 26, box: [166, 770, 58, 32], draw: turretPit },
  { id: 'hangar', name: 'Resupply hangar', mx: B.hangar, hp: 100, half: 26, box: [218, 772, 66, 30], draw: hangar },
  { id: 'repair', name: 'Repair yard', mx: B.repair, hp: 100, half: 20, box: [274, 774, 46, 28], draw: repair },
];
export function mockToWorld(mx: number, my: number): [number, number] { return [(mx - TX) * BASE_SCALE, (my - G) * BASE_SCALE + GROUND_Y]; }

/* ---------- rasterising ---------- */
type RasterMode = 'normal' | 'burnt' | 'sil';
function styleFor(S: Palette, mode: RasterMode) {
  if (mode === 'sil') return `*{fill:#04050c!important;stroke:none!important;opacity:1!important}.ln,.pr{display:none}`;
  const red = mode === 'burnt' ? '#5a1c1a' : '#c8302a';
  const body = mode === 'burnt' ? 'url(#pbb)' : 'url(#pb)';
  return `.b{fill:${body}}.rd{fill:${red}}.g{fill:url(#pg)}.d{fill:${S.pDark}}.pr{fill:${S.prop}}.hi{fill:${S.pHi}}.ln{fill:none;stroke:${S.pDark};stroke-width:.5;opacity:.5}` +
    `.fa{fill:${S.bFace}}.sh{fill:${S.bShade}}.lt{fill:${S.bLit}}.dk{fill:${S.bDark}}.mt{fill:${S.bMetal}}.gl{fill:${S.bGlow}}.gr{fill:${S.bGround}}.edge{fill:none;stroke:${S.bLit};stroke-width:.6;stroke-linecap:round}`;
}
function defsFor(S: Palette) {
  return `<linearGradient id="pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.rim}"/><stop offset=".22" stop-color="${S.pLight}"/><stop offset=".55" stop-color="${S.pMid}"/><stop offset="1" stop-color="${S.pDark}"/></linearGradient>
<linearGradient id="pbb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hexMix(S.rim, S.pDark, .5)}"/><stop offset=".3" stop-color="${hexMix(S.pMid, '#000000', .3)}"/><stop offset="1" stop-color="${S.pDark}"/></linearGradient>
<linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.glassTop}"/><stop offset="1" stop-color="${S.pDark}"/></linearGradient>
<linearGradient id="bomb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${S.pLight}"/><stop offset=".45" stop-color="${S.pMid}"/><stop offset="1" stop-color="${S.pDark}"/></linearGradient>
<linearGradient id="barrel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${S.bLit}"/><stop offset=".4" stop-color="${S.bMetal}"/><stop offset="1" stop-color="${S.bDark}"/></linearGradient>
<radialGradient id="dish" cx=".35" cy=".35"><stop offset="0" stop-color="${S.bLit}"/><stop offset="1" stop-color="${S.bShade}"/></radialGradient>
<linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd36b"/><stop offset=".5" stop-color="#ff7b2c"/><stop offset="1" stop-color="#c2331b" stop-opacity=".6"/></linearGradient>
<radialGradient id="fglow"><stop offset="0" stop-color="#ffb04a" stop-opacity=".7"/><stop offset="1" stop-color="#ff7b2c" stop-opacity="0"/></radialGradient>
`;
}
/** A rasterised drawing and the box (in its own units) it covers. */
export interface Sprite { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; }

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return g;
}

async function raster(S: Palette, inner: string, box: Box, scale: number, mode: RasterMode): Promise<Sprite> {
  const [x, y, w, h] = box;
  const pw = Math.ceil(w * scale), ph = Math.ceil(h * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${x} ${y} ${w} ${h}"><style>${styleFor(S, mode)}</style><defs>${defsFor(S)}</defs>${inner}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  ctx2d(c).drawImage(img, 0, 0, pw, ph);
  return { img: c, x, y, w, h };
}

const CARGO = {
  rim: '#d8f0ff', pLight: '#e6eee8', pMid: '#86a690', pDark: '#2c3e36', glassTop: '#d6f2ff', pHi: '#ffffff', prop: 'rgba(240,250,255,.25)',
};

/** Friendly planes are olive green with a blue and white roundel, so they read apart from the dark enemy planes. */
const ALLY = {
  rim: '#eaffd2', pLight: '#a7b884', pMid: '#5f7444', pDark: '#252e1b', glassTop: '#d6f2ff', pHi: '#ffffff', prop: 'rgba(240,255,230,.25)',
};
/** Where each friendly airframe wears its roundel, in the plane's own unscaled units. */
const ROUNDEL: Record<PlaneType, [number, number]> = { heavy: [-14, -2], light: [-12, -1.5], fighter: [-6, -.5], recon: [-4, -.5] };
const roundel = ([x, y]: [number, number]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#f4f1e6"/><circle cx="${x}" cy="${y}" r="2.5" fill="#2f55a4"/><circle cx="${x}" cy="${y}" r="1" fill="#f4f1e6"/>`;

/** The boss keeps some of the sky's light but is mostly dark gunmetal, with a hot glow in its glass. */
const boss = (S: Palette): Palette => ({
  ...S, rim: hexMix(S.rim, '#ff9a80', .5), pLight: hexMix(S.pLight, '#6e737e', .7), pMid: hexMix(S.pMid, '#3a3f4a', .75),
  pDark: hexMix(S.pDark, '#101217', .7), glassTop: '#ff8a5a', pHi: '#ffd2bc', prop: 'rgba(255,225,210,.25)',
});

export interface PaletteSprites {
  planes: Record<AnyPlaneType, Sprite>; burnt: Record<AnyPlaneType, Sprite>;
  /** war mode's friendly planes */
  allies: Record<PlaneType, Sprite>; alliesBurnt: Record<PlaneType, Sprite>;
  buildings: Record<BuildingId, Sprite[]>; bombs: { small: Sprite; big: Sprite };
  searchHead: Sprite; pad: Sprite; clouds: CloudShape[];
}
export const SPRITES = {} as Record<PaletteId, PaletteSprites>;
export const SHARED = {} as { fire: Sprite; puff: HTMLCanvasElement; stars: StarLayer[] } & Record<`sil_${AnyPlaneType}`, Sprite>;

async function buildPalette(id: PaletteId) {
  const S = PALETTES[id];
  const out = { planes: {}, burnt: {}, allies: {}, alliesBurnt: {}, buildings: {}, bombs: {} } as PaletteSprites;
  const RS = 6;
  const jobs: Promise<unknown>[] = [];
  for (const t of ['heavy', 'light', 'fighter', 'recon'] as const) {
    const s = SC[t], box: Box = [-54 * s, -30 * s, 108 * s, 44 * s];
    const inner = `<g transform="scale(${s})">${SH[t]}</g>`;
    jobs.push(raster(S, inner, box, RS, 'normal').then(r => out.planes[t] = r));
    jobs.push(raster(S, inner, box, RS, 'burnt').then(r => out.burnt[t] = r));
    if (id === 'gold') jobs.push(raster(S, inner, box, RS, 'sil').then(r => SHARED[`sil_${t}`] = r));
    const ally = `<g transform="scale(${s})">${SH[t]}${roundel(ROUNDEL[t])}</g>`;
    jobs.push(raster({ ...S, ...ALLY }, ally, box, RS, 'normal').then(r => out.allies[t] = r));
    jobs.push(raster({ ...S, ...ALLY }, ally, box, RS, 'burnt').then(r => out.alliesBurnt[t] = r));
  }
  {
    const s = SC.cargo, box: Box = [-54 * s, -30 * s, 108 * s, 44 * s];
    const inner = `<g transform="scale(${s})">${SH.heavy}</g>`;
    jobs.push(raster({ ...S, ...CARGO }, inner, box, RS, 'normal').then(r => out.planes.cargo = r));
    jobs.push(raster({ ...S, ...CARGO }, inner, box, RS, 'burnt').then(r => out.burnt.cargo = r));
    if (id === 'gold') jobs.push(raster(S, inner, box, RS, 'sil').then(r => SHARED.sil_cargo = r));
  }
  {
    const s = SC.boss, box: Box = [-54 * s, -30 * s, 108 * s, 44 * s];
    const inner = `<g transform="scale(${s})">${BOSS_SH}</g>`;
    jobs.push(raster(boss(S), inner, box, RS, 'normal').then(r => out.planes.boss = r));
    jobs.push(raster(boss(S), inner, box, RS, 'burnt').then(r => out.burnt.boss = r));
    if (id === 'gold') jobs.push(raster(S, inner, box, RS, 'sil').then(r => SHARED.sil_boss = r));
  }
  jobs.push(raster(S, bombSvg(S, false), [-3, -7, 6, 13], 10, 'normal').then(r => out.bombs.small = r));
  jobs.push(raster(S, bombSvg(S, true), [-4, -9.5, 8, 19], 10, 'normal').then(r => out.bombs.big = r));
  for (const b of BUILDINGS) {
    out.buildings[b.id] = [];
    for (const st of [0, 1, 2] as const) jobs.push(raster(S, b.draw(S, st), b.box, 5, 'normal').then(r => out.buildings[b.id][st] = r));
  }
  jobs.push(raster(S, searchHead(S), [-5, -7, 10, 11], 6, 'normal').then(r => out.searchHead = r));
  jobs.push(raster(S, pad(S), [26, 794, 338, 14], 5, 'normal').then(r => out.pad = r));
  out.clouds = cloudShapes(S);
  await Promise.all(jobs);
  SPRITES[id] = out;
}

/**
 * One cloud bank in world units, drawn as vector shapes each frame so it stays sharp at any
 * resolution. `rings` are the same lumpy outline grown by a few units, outermost first, and
 * are layered at low opacity to feather the edge.
 */
export interface CloudShape { y: number; ry: number; op: number; rings: Path2D[]; }
/** Stars grouped by brightness so the whole field is a handful of path fills. */
export interface StarLayer { path: Path2D; alpha: number; }
/** Cloud edge feathering: [growth in world units, share of the cloud's opacity], outermost first. */
export const CLOUD_RINGS: [number, number][] = [[2.4, .3], [1.2, .35], [0, .6]];

function cloudShapes(S: Palette): CloudShape[] {
  // Clouds from the mockup, repeated across the wide world; mockup y is shifted into world space.
  // Each bank is a flat-bottomed run of overlapping lobes, taller in the middle and tapering out.
  const out: CloudShape[] = [];
  const r = rng(S.id.length * 31 + 7);
  for (let k = -3; k <= 2; k++) {
    for (const [mx, my, rx, ry, op] of S.clouds) {
      const x = mx + k * 390 - 195 + (r() - .5) * 60, y = my - PIVOT_Y + (r() - .5) * 30;
      const n = 4 + Math.floor(rx / 35), lobes: [number, number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const u = (i + .5) / n * 2 - 1, bell = 1 - u * u;
        const lry = ry * (.45 + .55 * bell) * (.8 + .4 * r());
        lobes.push([x + u * rx * .8 + (r() - .5) * rx / n * .6, y + ry * .35 - lry * .7, rx / n * (1.3 + .5 * r()), lry]);
      }
      const rings = CLOUD_RINGS.map(([grow]) => {
        const p = new Path2D();
        const base = (cx: number, cy: number, ex: number, ey: number) => { p.moveTo(cx + ex + grow * 2, cy); p.ellipse(cx, cy, ex + grow * 2, ey + grow, 0, 0, Math.PI * 2); };
        base(x, y + ry * .2, rx * .9, ry * .45);
        for (const [cx, cy, ex, ey] of lobes) base(cx, cy, ex, ey);
        return p;
      });
      out.push({ y, ry, op, rings });
    }
  }
  return out;
}

/** Storm light rays: thin wedges from the sun to these mockup points. */
export const RAYS: [number, number][] = [[-60, -200], [10, -230], [150, -260], [260, -240], [400, -120], [520, -60]].map(([x, y]) => [x - 195, y - PIVOT_Y]);

async function buildShared() {
  const S = PALETTES.gold;
  SHARED.fire = await raster(S, fireSvg(), [-10, -11, 20, 21], 8, 'normal');
  // soft round puff used for smoke, flak and glows (tinted per colour on demand)
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = ctx2d(c), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SHARED.puff = c;
  // star field over the whole upper sky (world x -1100..1100, y -1150..-50)
  const layers = [.3, .5, .7].map(alpha => ({ path: new Path2D(), alpha }));
  const r = rng(9);
  for (let i = 0; i < 700; i++) {
    const a = .2 + r() * .6, x = r() * 2200 - 1100, y = -1150 + r() * 1100 * (r() < .7 ? .7 : 1), rad = (.3 + r() * .7) * 2;
    const p = layers[a < .4 ? 0 : a < .6 ? 1 : 2].path;
    p.moveTo(x + rad, y); p.arc(x, y, rad, 0, 7);
  }
  SHARED.stars = layers;
}

const tintCache = new Map<string, HTMLCanvasElement>();
// A soft puff tinted to one colour; colours are quantised to keep the cache small.
export function puff(color: string): HTMLCanvasElement {
  let k = color;
  if (k[0] === 'r') { const m = k.match(/\d+/g) ?? ['0', '0', '0']; k = '#' + [0, 1, 2].map(i => (Math.round(+m[i] / 8) * 8).toString(16).padStart(2, '0').slice(-2)).join(''); }
  let c = tintCache.get(k);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = ctx2d(c);
  g.drawImage(SHARED.puff, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = k; g.fillRect(0, 0, 64, 64);
  if (tintCache.size > 400) tintCache.clear();
  tintCache.set(k, c);
  return c;
}

/* ---------- landscape (world space) ---------- */
export interface Ridge { path: Path2D; trees: Path2D | null; top: number; base: number; t: number; k: number; }
/** `edgeTreesWar` leaves clearings for war mode's outlying turrets. */
export const LAND = { ridges: [] as Ridge[], ground: new Path2D(), edgeTrees: new Path2D(), edgeTreesWar: new Path2D() };
function buildLandscape() {
  const L = [[688, 22, 190, 2, 4], [706, 26, 140, 3, 4], [726, 28, 100, 4, 5], [748, 24, 80, 5, 5], [770, 18, 60, 6, 5]];
  const X0 = -1300, X1 = 1300;
  L.forEach(([b, a, sc, sd, oc], i) => {
    const n = noise(sd), p = new Path2D(), ys: [number, number][] = [];
    const base = b - PIVOT_Y;
    for (let x = X0; x <= X1; x += 3) {
      const y = base - a * fbm(n, (x + 195) / sc, oc);
      ys.push([x, y]);
      if (x === X0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.lineTo(X1, 1400); p.lineTo(X0, 1400); p.closePath();
    let trees: Path2D | null = null;
    if (i >= 3) {
      trees = new Path2D();
      const r = rng(31 + i - 3), nn = noise(31 + i);
      const dens = i === 3 ? .45 : .3, hmin = i === 3 ? 2 : 3, hmax = i === 3 ? 4 : 7;
      for (const [x, y] of ys) {
        if (nn(x / 26) < dens) continue;
        for (let j = 0; j < 3; j++) { const xx = x + r() * 3, h = hmin + r() * (hmax - hmin); trees.moveTo(xx - h * .28, y + 1.5); trees.lineTo(xx, y - h); trees.lineTo(xx + h * .28, y + 1.5); trees.closePath(); }
      }
    }
    LAND.ridges.push({ path: p, trees, top: base - a, base, t: i / (L.length - 1), k: [2, 6, 12, 22, 34][i] });
  });
  const g = new Path2D();
  const gy = GROUND_Y;
  g.moveTo(-1400, gy + 2); g.lineTo(-215, gy + 1); g.bezierCurveTo(-115, gy - 4, 105, gy - 4, 215, gy + 1); g.lineTo(1400, gy + 2); g.lineTo(1400, 1400); g.lineTo(-1400, 1400); g.closePath();
  LAND.ground = g;
  const treeLine = (clear: number[]) => {
    const t = new Path2D(), r = rng(41), nn = noise(43);
    for (let x = -1300; x <= 1300; x += 1.6) {
      // the gap to the nearest clearing, thinning out toward its edge
      const gap = Math.min(...clear.map(c => Math.abs(x - c) - (c ? 60 : 200)));
      if (gap < 0) continue;
      const edge = Math.min(1, gap / 60);
      if (nn(x / 18) < .2 + .5 * (1 - edge)) continue;
      const h = 4 + r() * 6 * (0.6 + .4 * edge), y = gy - 2;
      t.moveTo(x - h * .28, y + 1.5); t.lineTo(x, y - h); t.lineTo(x + h * .28, y + 1.5); t.closePath();
    }
    return t;
  };
  LAND.edgeTrees = treeLine([0]);
  LAND.edgeTreesWar = treeLine(WAR_POSTS);
}

export async function loadArt(onProgress?: (fraction: number) => void) {
  buildLandscape();
  await buildShared();
  let n = 0;
  // Load the opening palette first so the start screen can show quickly.
  for (const id of PALETTE_ORDER) { await buildPalette(id); onProgress && onProgress(++n / PALETTE_ORDER.length); }
}
