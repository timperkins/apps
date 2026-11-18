// The designs on the UI kit page. Each is a whole design system: the look is
// in kit.css under [data-theme='<id>'], and this file says what it is called,
// why, and which icon set and cursor style it uses.
import type { IconSet } from './icons';

export type CursorStyle = 'pixel' | 'line' | 'solid';

export interface Theme {
  id: string;
  name: string;
  tag: string; // a few words
  blurb: string; // what it is and why
  traits: string[]; // the ideas that make it what it is
  icons: IconSet;
  cursor: CursorStyle;
  // cursor colours: main, outline, attack, harvest
  cur: [string, string, string, string];
  type: { display: string; body: string };
}

export const THEMES: Theme[] = [
  {
    id: 'now',
    name: 'Current',
    tag: 'Today’s game, for comparison',
    blurb: 'What the game ships with now: dark green see-through panels, a wooden build menu, Silkscreen everywhere and bright green for anything switched on. Here so you can compare every design against it.',
    traits: ['Silkscreen pixel font', 'Wooden build frame', 'Green pressed state'],
    icons: 'pixel',
    cursor: 'pixel',
    cur: ['#f4f7ea', '#10140c', '#e8452f', '#f2c94c'],
    type: { display: 'Silkscreen', body: 'Silkscreen' },
  },
  {
    id: 'field',
    name: 'Field Command',
    tag: 'Olive drab, stencil and brass',
    blurb: 'A field headquarters in a crate. Panels are olive steel plates with cut corners and brass rivets, headings are stencilled like an ammo box, and switched-on buttons glow a warm brass. The most traditionally “army” of the set.',
    traits: ['Stencil headings', 'Cut-corner steel plates', 'Brass rivets and highlights', 'Canvas texture'],
    icons: 'pixel',
    cursor: 'pixel',
    cur: ['#efe6c8', '#1c1a10', '#e0563a', '#e9b949'],
    type: { display: 'Saira Stencil One', body: 'Barlow Condensed' },
  },
  {
    id: 'iron',
    name: 'Ironworks',
    tag: 'Gunmetal and hazard stripes',
    blurb: 'Heavy industry. Brushed gunmetal plates with a bevel, black-and-yellow hazard stripes on the edges that matter, and chunky square buttons that feel like hardware switches. Loud, confident and very readable.',
    traits: ['Brushed metal gradients', 'Hazard-stripe trims', 'Bolted corners', 'Amber indicator lights'],
    icons: 'pixel',
    cursor: 'solid',
    cur: ['#ffcf3a', '#141518', '#ff4b2b', '#ffcf3a'],
    type: { display: 'Russo One', body: 'Titillium Web' },
  },
  {
    id: 'nvg',
    name: 'Night Vision',
    tag: 'Phosphor green on black',
    blurb: 'Everything is seen through night-vision optics: one phosphor green on near-black, CRT scanlines, soft glow and a terminal typeface. Retro tech that sits naturally next to pixel art, and stays out of the way of the map.',
    traits: ['Single-hue phosphor palette', 'Scanlines and glow', 'Terminal type', 'Bracketed selections'],
    icons: 'pixel',
    cursor: 'line',
    cur: ['#8dff9a', '#031006', '#ff6a4d', '#d8ff6a'],
    type: { display: 'VT323', body: 'Share Tech Mono' },
  },
  {
    id: 'arctic',
    name: 'Arctic',
    tag: 'Light, clean, signal red',
    blurb: 'The one light design. Frosted white panels, navy type and a signal-red accent, with soft rounded corners and gentle shadows. It looks like modern military kit made for snow: calm, precise and easy on the eyes in daylight.',
    traits: ['Light frosted panels', 'Navy and signal red', 'Rounded and soft-shadowed', 'Line icons'],
    icons: 'line',
    cursor: 'line',
    cur: ['#ffffff', '#14233a', '#e5322d', '#f0a400'],
    type: { display: 'Exo 2', body: 'Exo 2' },
  },
  {
    id: 'recon',
    name: 'Desert Recon',
    tag: 'Map table, sand and rust',
    blurb: 'A recon officer’s map table. Sand-coloured panels printed with topographic contour lines, rust-orange for action, grid coordinates in a typewriter face, and pill-shaped buttons. Warm and tactile, a cartographer’s war.',
    traits: ['Contour-line paper texture', 'Rust accent', 'Pill buttons', 'Coordinates in mono'],
    icons: 'line',
    cursor: 'solid',
    cur: ['#f6e7c8', '#2a1d10', '#c8401e', '#d9951c'],
    type: { display: 'Saira Condensed', body: 'IBM Plex Mono' },
  },
  {
    id: 'pixel',
    name: 'Refined Pixel',
    tag: 'The current look, grown up',
    blurb: 'Keeps the game’s pixel-art soul but at half the pixel size: stepped rounded corners drawn a pixel at a time, a lighter pixel font, navy panels with brass trim and a cool blue for the Cobalt side. The least risky step from today.',
    traits: ['Fine pixel frames with rounded steps', 'Pixelify Sans', 'Navy and brass', 'Pixel icons'],
    icons: 'pixel',
    cursor: 'pixel',
    cur: ['#f3f1e6', '#0d1220', '#ff5a3c', '#ffc94a'],
    type: { display: 'Pixelify Sans', body: 'Pixelify Sans' },
  },
  {
    id: 'glass',
    name: 'Tactical Glass',
    tag: 'Near-future smoked glass HUD',
    blurb: 'A heads-up display. Panels are smoked glass that blurs the battlefield behind them, edged with thin cyan lines and corner brackets, with angled cuts and a quiet glow. Futuristic but still grounded in today’s military optics.',
    traits: ['Blurred translucent glass', 'Corner brackets', 'Thin cyan lines', 'Angled cuts'],
    icons: 'line',
    cursor: 'line',
    cur: ['#bff6ff', '#03141a', '#ff4d6a', '#ffd166'],
    type: { display: 'Chakra Petch', body: 'Chakra Petch' },
  },
  {
    id: 'carbon',
    name: 'Carbon Strike',
    tag: 'Matte black and safety orange',
    blurb: 'Modern special forces. Matte carbon-fibre black, one safety-orange accent and slanted parallelogram buttons that lean forward like they are moving. Sharp, minimal and fast, like a modern shooter’s menus.',
    traits: ['Carbon-fibre weave', 'Slanted buttons and tabs', 'One orange accent', 'Tight condensed type'],
    icons: 'line',
    cursor: 'solid',
    cur: ['#ffffff', '#0a0a0a', '#ff3b1f', '#ff8a00'],
    type: { display: 'Rajdhani', body: 'Rajdhani' },
  },
  {
    id: 'holo',
    name: 'Vanguard Holo',
    tag: 'Orbital command, far future',
    blurb: 'The most futuristic: a holographic command deck in orbit. Deep indigo with teal-to-violet light, capsule-shaped panels, a hexagon grid behind everything and glowing edges. Feels like commanding the planet from space, which fits the zoom-out globe.',
    traits: ['Teal-violet gradients', 'Capsule shapes', 'Hex grid', 'Glowing edges'],
    icons: 'line',
    cursor: 'line',
    cur: ['#c8fbff', '#0b0630', '#ff4fa0', '#ffd25e'],
    type: { display: 'Orbitron', body: 'Oxanium' },
  },
  {
    id: 'admiral',
    name: 'Admiralty',
    tag: 'Navy steel and polished brass',
    blurb: 'A warship’s bridge. Deep navy lacquer with polished brass rims, round gauge-style dials for power and the minimap, engraved slab-serif labels and soft rounded plates. Dignified and expensive-looking, with a naval twist that suits the boats.',
    traits: ['Brass rims and bezels', 'Gauge dials', 'Slab-serif engraving', 'Navy lacquer'],
    icons: 'line',
    cursor: 'solid',
    cur: ['#f5e6b8', '#0b1626', '#e04a3a', '#f0c050'],
    type: { display: 'Zilla Slab', body: 'IBM Plex Sans Condensed' },
  },
];

export const GROUP_COLORS = ['#4a9dff', '#3fe6e6', '#b4f03c', '#ffd93b', '#ff9a2e', '#ff6fb5', '#b07cff', '#f4f7ea'];
export const GROUP_NAMES = ['Blue', 'Cyan', 'Lime', 'Yellow', 'Orange', 'Pink', 'Purple', 'White'];
export const PLAYER_COLORS: [string, string][] = [
  ['Cobalt', '#4f74a8'], ['Ember', '#c0622e'], ['Crimson', '#a83434'], ['Gold', '#c49a22'],
  ['Violet', '#7650a8'], ['Teal', '#2a8f8a'], ['Rose', '#b8538a'], ['Frost', '#a7aeb4'],
  ['Lime', '#7fa62c'], ['Umber', '#86583a'], ['Onyx', '#3c3e44'], ['Sky', '#4ea6d6'],
];
