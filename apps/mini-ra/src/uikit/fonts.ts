// Loads the font picked for each kind of text under its own name (ra-d,
// ra-b, ra-l, ra-n, which kit.css uses) and scales it so its capital letters
// stand as tall as the default font's did. Pixel fonts differ a lot in size at
// the same font-size (VT323 is small, Press Start 2P huge), so without this
// every size in kit.css would only suit one font.
import { FONTS, Role } from './design';

const DEFAULTS: Record<Role, string> = { d: 'VT323', b: 'Pixelify Sans', l: 'Pixelify Sans', n: 'VT323' };

interface Face { src: string; weight: string; style: string; range?: string }
const faces = new Map<string, Promise<Face[]>>();
const caps = new Map<string, Promise<number>>();
const added: Partial<Record<Role, FontFace[]>> = {};

// The font's files, from the Google Fonts stylesheet for it.
function facesOf(name: string): Promise<Face[]> {
  let p = faces.get(name);
  if (!p) {
    const f = FONTS.find((x) => x.name === name)!;
    p = fetch(`https://fonts.googleapis.com/css2?family=${f.q}&display=swap`)
      .then((r) => r.text())
      .then((css) =>
        [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, b]) => ({
          src: b.match(/src:\s*([^;]+);/)![1],
          weight: b.match(/font-weight:\s*([^;]+);/)?.[1] ?? '400',
          style: b.match(/font-style:\s*([^;]+);/)?.[1] ?? 'normal',
          range: b.match(/unicode-range:\s*([^;]+);/)?.[1],
        })),
      );
    faces.set(name, p);
  }
  return p;
}

// How tall a capital H is, as a share of the font size.
function capOf(name: string): Promise<number> {
  let p = caps.get(name);
  if (!p) {
    p = facesOf(name).then(async (fs) => {
      const fam = `ra-m-${name}`;
      const list = fs.map((f) => new FontFace(fam, f.src, { weight: f.weight, style: f.style, unicodeRange: f.range }));
      list.forEach((f) => document.fonts.add(f));
      await document.fonts.load(`100px "${fam}"`, 'H');
      const g = document.createElement('canvas').getContext('2d')!;
      g.font = `100px "${fam}"`;
      const h = g.measureText('H').actualBoundingBoxAscent / 100;
      list.forEach((f) => document.fonts.delete(f));
      return h > 0 ? h : 0.7;
    });
    caps.set(name, p);
  }
  return p;
}

let seq = 0;
const latest: Partial<Record<Role, number>> = {};

export async function useFont(role: Role, name: string): Promise<void> {
  const my = ++seq;
  latest[role] = my;
  const [fs, cap, ref] = await Promise.all([facesOf(name), capOf(name), capOf(DEFAULTS[role])]);
  if (latest[role] !== my) return; // a newer pick for this role came in
  const k = name === DEFAULTS[role] ? 1 : ref / cap;
  const list = fs.map((f) => new FontFace(`ra-${role}`, f.src, { weight: f.weight, style: f.style, unicodeRange: f.range, sizeAdjust: `${(k * 100).toFixed(1)}%` } as FontFaceDescriptors));
  // load the basic Latin files now; the rest load if a page ever needs them
  await Promise.all(list.filter((f) => !f.unicodeRange || f.unicodeRange.includes('U+0000')).map((f) => f.load().catch(() => f)));
  if (latest[role] !== my) return;
  for (const f of added[role] ?? []) document.fonts.delete(f);
  list.forEach((f) => document.fonts.add(f));
  added[role] = list;
}
