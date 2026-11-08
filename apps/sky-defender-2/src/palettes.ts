// Lighting palettes from the approved Alpine Dusk mockups, plus a night palette
// that extends Blue Hour. The sky blends between them as the waves go on.

export type SkyStop = [number, string];
export type Cloud = [number, number, number, number, number];

export interface Palette {
  id: PaletteId; name: string;
  dark: number; stars: number; lights: number; rays: number;
  sky: SkyStop[]; sun: [number, number]; sunDisc: number; sunCol: string; sunGlow: number;
  clouds: Cloud[]; cloudTop: string; cloudLit: string;
  haze: string; far: string; near: string; ground: string; groundTop: string;
  rim: string; pLight: string; pMid: string; pDark: string; glassTop: string; pHi: string; prop: string;
  contrail: string; trail: string; smokeDark: string; smokeLight: string; smokeFar: string; smokeBlack: string; dust: string; flak: string; shadow: string;
  shell: string; tracer: string; amber: string; red: string; lens: string;
  bFace: string; bShade: string; bLit: string; bDark: string; bMetal: string; bGlow: string; bGround: string;
  hud: string; stripBg: string;
}
export type PaletteId = 'gold' | 'storm' | 'rose' | 'blue' | 'night';
/** A palette blended between two lighting states for one frame. */
export interface BlendedPalette extends Omit<Palette, 'id'> { a: Palette; b: Palette; t: number; }
/** Colour keys usable for smoke and particles. */
export type ColorKey = Exclude<{ [K in keyof Palette]: Palette[K] extends string ? K : never }[keyof Palette], 'id' | 'name'>;

const common = {
  pHi: '#efe6d6', prop: 'rgba(255,240,220,.22)', shell: '#ffe2a0', tracer: '#ffcf7a',
  amber: '#ffbe55', red: '#ff6b5a', bMetal: '#3a3b3a', lens: '#f7e7c0',
};

export const PALETTES: Record<PaletteId, Palette> = {
  gold: {
    ...common, id: 'gold', name: 'Golden Hour', dark: 0, stars: 0, lights: 0, rays: 0,
    sky: [[0, '#2b3a6e'], [.35, '#7a6a9a'], [.62, '#d98f86'], [.8, '#f4b06e'], [.9, '#ffd99a']],
    sun: [-117, -106], sunDisc: 16, sunCol: '#fff0c4', sunGlow: .75,
    clouds: [[60, 300, 120, 6, .55], [300, 450, 140, 5, .5], [150, 560, 160, 4, .45], [320, 250, 80, 4, .4]], cloudTop: '#c9a0b2', cloudLit: '#ffcf96',
    haze: '#f4b98a', far: '#d5a194', near: '#3a2a3e', ground: '#2c2130', groundTop: '#c98a6a',
    rim: '#ffd08a', pLight: '#8b7a74', pMid: '#4a4048', pDark: '#221c26', glassTop: '#ffe6b8',
    contrail: '#fff4e6', trail: '#ffffff', smokeDark: '#3b3036', smokeLight: '#9c8a8c', smokeFar: '#c6aaa2', smokeBlack: '#1e181c', dust: '#c4a184', flak: '#2a2226', shadow: 'rgba(0,0,0,.55)',
    bFace: '#8a7d62', bShade: '#4c4436', bLit: '#ffcf8c', bDark: '#211b1c', bGlow: '#ffb45a', bGround: '#6b5446',
    hud: '#fff5ea', stripBg: 'rgba(26,18,28,.6)',
  },
  storm: {
    ...common, id: 'storm', name: 'Storm Light', dark: .05, stars: 0, lights: 0, rays: 1,
    sky: [[0, '#24222f'], [.3, '#3d3646'], [.55, '#6c5260'], [.72, '#b8706a'], [.84, '#f6b46c'], [.9, '#ffe0a6']],
    sun: [105, -92], sunDisc: 12, sunCol: '#ffe6b0', sunGlow: .8,
    clouds: [[60, 140, 220, 30, .85], [320, 190, 200, 26, .8], [180, 90, 240, 30, .8], [120, 430, 160, 10, .6], [300, 560, 180, 7, .55]], cloudTop: '#2e2a38', cloudLit: '#c27a6e',
    haze: '#d49a7e', far: '#a07a7c', near: '#24202a', ground: '#1e1a22', groundTop: '#b07a5a',
    rim: '#ffc48a', pLight: '#79706c', pMid: '#3e3840', pDark: '#1a161c', glassTop: '#ffdcae',
    contrail: '#ffefe0', trail: '#ffffff', smokeDark: '#2c262a', smokeLight: '#7a6e70', smokeFar: '#a0908c', smokeBlack: '#161214', dust: '#a88c78', flak: '#1e1a1e', shadow: 'rgba(0,0,0,.6)',
    bFace: '#7e745e', bShade: '#403a32', bLit: '#ffc890', bDark: '#1a1618', bGlow: '#ffb45a', bGround: '#5a4a40',
    hud: '#fff3e6', stripBg: 'rgba(18,14,20,.62)',
  },
  rose: {
    ...common, id: 'rose', name: 'Rose Dusk', dark: .1, stars: 0, lights: .3, rays: 0,
    sky: [[0, '#171a45'], [.36, '#4e3672'], [.66, '#c25f7f'], [.82, '#f0a06a'], [.9, '#f9cf8a']],
    sun: [-111, -77], sunDisc: 0, sunCol: '#ffd6a0', sunGlow: .6,
    clouds: [[90, 330, 130, 5, .5], [310, 470, 150, 5, .45], [180, 580, 170, 4, .4]], cloudTop: '#7a4f86', cloudLit: '#f7a98a',
    haze: '#e3a08e', far: '#b87789', near: '#2f2140', ground: '#251a33', groundTop: '#a8687a',
    rim: '#ffb08a', pLight: '#7d6a82', pMid: '#3f3450', pDark: '#1c1528', glassTop: '#ffd0b8',
    contrail: '#ffece6', trail: '#ffffff', smokeDark: '#382a40', smokeLight: '#8e7890', smokeFar: '#b496a6', smokeBlack: '#1a1420', dust: '#b88e90', flak: '#261c2c', shadow: 'rgba(0,0,0,.55)',
    bFace: '#7d7066', bShade: '#443a44', bLit: '#ffb89a', bDark: '#1e1624', bGlow: '#ffb45a', bGround: '#5e4652',
    hud: '#fff4ea', stripBg: 'rgba(20,14,32,.6)',
  },
  blue: {
    ...common, id: 'blue', name: 'Blue Hour', dark: .35, stars: 1, lights: 1, rays: 0,
    sky: [[0, '#0b1230'], [.4, '#1f2f5e'], [.68, '#4c5c8e'], [.82, '#a98a9a'], [.9, '#eda16e']],
    sun: [-99, -70], sunDisc: 0, sunCol: '#ffb27a', sunGlow: .45,
    clouds: [[110, 340, 130, 4, .35], [300, 500, 150, 4, .35]], cloudTop: '#2c3866', cloudLit: '#c08898',
    haze: '#7d7fa6', far: '#6e6f98', near: '#151a32', ground: '#121628', groundTop: '#59547a',
    rim: '#c9a6b6', pLight: '#5f6688', pMid: '#2e3452', pDark: '#11142a', glassTop: '#b8c6ee',
    contrail: '#dfe6ff', trail: '#f4f6ff', smokeDark: '#2a2e44', smokeLight: '#6a7092', smokeFar: '#8a8eae', smokeBlack: '#111322', dust: '#7f7f9e', flak: '#1a1d2e', shadow: 'rgba(255,214,140,.5)',
    bFace: '#5a5c66', bShade: '#2e3040', bLit: '#c6b6c8', bDark: '#10121e', bGlow: '#ffc06a', bGround: '#3a3a52',
    hud: '#e6ebff', stripBg: 'rgba(6,8,20,.65)',
  },
  // Night extends Blue Hour: the warm band is gone and the searchlight becomes the main light.
  night: {
    ...common, id: 'night', name: 'Night', dark: 1, stars: 1, lights: 1, rays: 0,
    sky: [[0, '#04071a'], [.45, '#0b1232'], [.72, '#18234a'], [.84, '#2a3258'], [.9, '#3a3a5c']],
    sun: [-99, -70], sunDisc: 0, sunCol: '#6a6a9a', sunGlow: .2,
    clouds: [[110, 340, 130, 4, .25], [300, 500, 150, 4, .22]], cloudTop: '#141a36', cloudLit: '#3a4064',
    haze: '#2e3456', far: '#2c3156', near: '#090b1a', ground: '#080a16', groundTop: '#24263e',
    rim: '#8e9cc8', pLight: '#454c6c', pMid: '#20263c', pDark: '#090b16', glassTop: '#8ea2d8',
    contrail: '#aab6e0', trail: '#d0d8f4', smokeDark: '#1c2032', smokeLight: '#4a5070', smokeFar: '#5a6080', smokeBlack: '#0a0b14', dust: '#4c4e68', flak: '#121424', shadow: 'rgba(255,214,140,.5)',
    bFace: '#3e4152', bShade: '#1e2032', bLit: '#9a96b4', bDark: '#07080f', bGlow: '#ffc06a', bGround: '#24243a',
    hud: '#e6ebff', stripBg: 'rgba(4,6,16,.7)',
  },
};

export const PALETTE_ORDER: PaletteId[] = ['gold', 'storm', 'rose', 'blue', 'night'];

// Waves 1 to 10 of each day: dawn, day, dusk, then three night waves (8 to 10).
const DAY: PaletteId[] = ['gold', 'gold', 'storm', 'storm', 'rose', 'rose', 'blue', 'night', 'night', 'night'];
export function paletteForWave(wave: number): PaletteId { return DAY[(wave - 1) % 10]; }

/* ---------- colour helpers ---------- */
type RGBA = [number, number, number, number];
const cache = new Map<string, RGBA>();
export function parseColor(c: string): RGBA {
  let v = cache.get(c);
  if (v) return v;
  if (c[0] === '#') {
    const h = c.slice(1);
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  } else {
    const m = c.match(/rgba?\(([^)]+)\)/);
    const p = (m ? m[1] : '0,0,0').split(',').map(Number);
    v = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  cache.set(c, v);
  return v;
}
export function rgba(v: RGBA, a = 1): string {
  return `rgba(${Math.round(v[0])},${Math.round(v[1])},${Math.round(v[2])},${+(v[3] * a).toFixed(3)})`;
}
export function mixC(a: string, b: string, t: number): string {
  const A = parseColor(a), B = parseColor(b);
  return rgba([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, A[3] + (B[3] - A[3]) * t]);
}
export function hexMix(a: string, b: string, t: number): string {
  const A = parseColor(a), B = parseColor(b);
  return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
}
export function withAlpha(c: string, a: number): string { return rgba(parseColor(c), a); }

function sampleSky(stops: SkyStop[], o: number): string {
  if (o <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (o <= stops[i][0]) {
      const [o0, c0] = stops[i - 1], [o1, c1] = stops[i];
      return hexMix(c0, c1, (o - o0) / (o1 - o0));
    }
  }
  return stops[stops.length - 1][1];
}
const SKY_O = [0, .12, .24, .36, .48, .58, .66, .74, .8, .85, .9];

// Blend two palettes into one flat palette used for this frame.
export function blendPalette(A: Palette, B: Palette, t: number): BlendedPalette {
  const out: Record<string, unknown> = { a: A, b: B, t };
  for (const k in A) {
    const va = A[k as keyof Palette], vb = B[k as keyof Palette];
    if (typeof va === 'string' && (va[0] === '#' || va.startsWith('rgb'))) out[k] = t <= 0 ? va : t >= 1 ? vb : mixC(va, vb as string, t);
    else if (typeof va === 'number') out[k] = va + ((vb as number) - va) * t;
    else out[k] = t < .5 ? va : vb;
  }
  out.sun = [A.sun[0] + (B.sun[0] - A.sun[0]) * t, A.sun[1] + (B.sun[1] - A.sun[1]) * t];
  out.sky = SKY_O.map(o => [o, hexMix(sampleSky(A.sky, o), sampleSky(B.sky, o), t)]);
  return out as unknown as BlendedPalette;
}
