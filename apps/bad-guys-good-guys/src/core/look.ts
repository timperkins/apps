/** What a kid looks like. Chosen on the character screen and sent to the host when joining. */
export interface Look {
  name: string;
  build: number; // 0 small, 1 medium, 2 tall
  skin: string;
  eyes: string;
  hair: HairStyle;
  hairColor: string;
  top: TopStyle;
  topColor: string;
  bottom: BottomStyle;
  bottomColor: string;
  shoes: string;
  hat: HatStyle;
  hatColor: string;
  glasses: GlassesStyle;
  back: BackStyle;
  backColor: string;
}

export const HAIR = ['buzz', 'spiky', 'curly', 'afro', 'pigtails', 'ponytail', 'long', 'mohawk', 'bowl', 'bun'] as const;
export const TOPS = ['hoodie', 'tee', 'jersey', 'overalls', 'jacket'] as const;
export const BOTTOMS = ['jeans', 'shorts', 'track', 'skirt'] as const;
export const HATS = ['none', 'cap', 'backwards', 'beanie', 'headband', 'helmet', 'crown'] as const;
export const GLASSES = ['none', 'round', 'square', 'goggles'] as const;
export const BACKS = ['none', 'backpack', 'cape'] as const;

export type HairStyle = (typeof HAIR)[number];
export type TopStyle = (typeof TOPS)[number];
export type BottomStyle = (typeof BOTTOMS)[number];
export type HatStyle = (typeof HATS)[number];
export type GlassesStyle = (typeof GLASSES)[number];
export type BackStyle = (typeof BACKS)[number];

export const SKINS = ['#ffe0c7', '#f6d0b0', '#eebd96', '#e0a882', '#c98e64', '#b07650', '#93603f', '#7a4d32', '#5e3a26', '#47291a'];
export const HAIR_COLORS = ['#1a1210', '#3b2416', '#6a3e22', '#a0622e', '#d9a456', '#f0d38a', '#b8b8b8', '#d8452f', '#3f6fd8', '#e85aa8'];
export const EYE_COLORS = ['#5a3a20', '#2f6a8a', '#3f7a3a', '#7a5a2a', '#3a3a4a'];
export const CLOTH_COLORS = ['#e8423a', '#ff8a2a', '#ffc93a', '#4fbf5a', '#2fb5a8', '#3a8aff', '#3a4ad8', '#7a3aff', '#ff5fb0', '#f4f1e8', '#9aa0aa', '#2a2a34', '#c9a77a', '#7a4a2a'];
export const BUILD_NAMES = ['Small', 'Medium', 'Tall'];

export const LABELS: Record<string, string> = {
  buzz: 'Buzz cut', spiky: 'Spiky', curly: 'Curly', afro: 'Afro', pigtails: 'Pigtails', ponytail: 'Ponytail', long: 'Long', mohawk: 'Mohawk', bowl: 'Bowl cut', bun: 'Bun',
  hoodie: 'Hoodie', tee: 'T-shirt', jersey: 'Jersey', overalls: 'Overalls', jacket: 'Varsity jacket',
  jeans: 'Jeans', shorts: 'Shorts', track: 'Track pants', skirt: 'Skirt',
  none: 'None', cap: 'Cap', backwards: 'Backwards cap', beanie: 'Beanie', headband: 'Headband', helmet: 'Bike helmet', crown: 'Crown',
  round: 'Round glasses', square: 'Square glasses', goggles: 'Goggles',
  backpack: 'Backpack', cape: 'Cape',
};

const NAMES = ['MAX', 'ZOE', 'DEV', 'SAM', 'RUBY', 'LEO', 'NIA', 'OTTO', 'IVY', 'JAX', 'MILA', 'KAI', 'PIA', 'REX', 'TESS', 'BO'];

function pick<T>(arr: readonly T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

export function randomLook(random: () => number = Math.random, name?: string): Look {
  const top = pick(TOPS, random);
  let bottomColor = pick(CLOTH_COLORS, random);
  const topColor = pick(CLOTH_COLORS, random);
  if (bottomColor === topColor) bottomColor = '#3a5aa8';
  return {
    name: name ?? pick(NAMES, random),
    build: Math.floor(random() * 3),
    skin: pick(SKINS, random),
    eyes: pick(EYE_COLORS, random),
    hair: pick(HAIR, random),
    hairColor: pick(HAIR_COLORS.slice(0, 7), random),
    top,
    topColor,
    bottom: pick(BOTTOMS, random),
    bottomColor,
    shoes: pick(['#ffffff', '#e8423a', '#2a2a34', '#2fb5a8', '#ffc93a', '#3a8aff'], random),
    hat: random() < 0.45 ? 'none' : pick(HATS, random),
    hatColor: pick(CLOTH_COLORS, random),
    glasses: random() < 0.7 ? 'none' : pick(GLASSES.slice(1), random),
    back: random() < 0.5 ? 'none' : pick(BACKS.slice(1), random),
    backColor: pick(CLOTH_COLORS, random),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Cleans up a look that arrived over the network, so a bad value can't break rendering. */
export function sanitizeLook(raw: unknown): Look {
  const d = randomLook();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const color = (k: keyof Look) => (typeof r[k] === 'string' && HEX.test(r[k] as string) ? (r[k] as string) : (d[k] as string));
  const one = <T extends string>(k: keyof Look, list: readonly T[]) => (list.includes(r[k] as T) ? (r[k] as T) : (d[k] as T));
  const name = typeof r.name === 'string' ? r.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 8) : '';
  return {
    name: name || d.name,
    build: typeof r.build === 'number' && r.build >= 0 && r.build <= 2 ? Math.round(r.build) : 1,
    skin: color('skin'),
    eyes: color('eyes'),
    hair: one('hair', HAIR),
    hairColor: color('hairColor'),
    top: one('top', TOPS),
    topColor: color('topColor'),
    bottom: one('bottom', BOTTOMS),
    bottomColor: color('bottomColor'),
    shoes: color('shoes'),
    hat: one('hat', HATS),
    hatColor: color('hatColor'),
    glasses: one('glasses', GLASSES),
    back: one('back', BACKS),
    backColor: color('backColor'),
  };
}
