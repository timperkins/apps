// The designs on the UI kit page. Tim picked Refined Pixel from the first
// round, so this round is today's look (for comparison), Refined Pixel as it
// was, and variations that branch off it: other heading fonts, finer or
// smoother icons, and one bigger overhaul of the layout. The look is in
// kit.css under [data-theme='<id>']; this file says what each is called, why,
// and which icon set and layout it uses. Every design uses the game's own
// cursors.
import type { IconSet } from './icons';

export interface Theme {
  id: string;
  name: string;
  tag: string; // a few words
  blurb: string; // what it is and why
  traits: string[]; // what changed from Refined Pixel
  icons: IconSet;
  layout?: 'deck'; // the command-deck overhaul; otherwise today's layout
  type: { display: string; body: string };
}

export const THEMES: Theme[] = [
  {
    id: 'now',
    name: 'Current',
    tag: 'Today’s game, for comparison',
    blurb: 'What the game ships with now: dark green see-through panels, a wooden build menu, Silkscreen everywhere and bright green for anything switched on.',
    traits: ['Silkscreen pixel font', 'Wooden build frame', 'Green pressed state'],
    icons: 'pixel',
    type: { display: 'Silkscreen', body: 'Silkscreen' },
  },
  {
    id: 'pixel',
    name: 'Refined Pixel',
    tag: 'Your pick from round one',
    blurb: 'The design you picked, unchanged: navy panels with brass trim, stepped pixel corners at half the pixel size, Pixelify Sans and the game’s own pixel icons. Every tab after this one starts from here.',
    traits: ['Fine pixel frames with rounded steps', 'Pixelify Sans', 'Navy and brass', 'Chunky pixel icons'],
    icons: 'pixel',
    type: { display: 'Pixelify Sans', body: 'Pixelify Sans' },
  },
  {
    id: 'fine',
    name: 'Fine Line',
    tag: 'Same look, lighter touch',
    blurb: 'Refined Pixel with everything made a little lighter. Frames are drawn with one-pixel lines instead of two, icons are small pixel drawings with one-pixel strokes and a faint fill instead of solid blocks, and headings use Handjet, a pixel-grid face with slim, elegant strokes.',
    traits: ['Handjet headings', 'Fine pixel icons', 'One-pixel frames', 'Navy and brass'],
    icons: 'fine',
    type: { display: 'Handjet', body: 'Pixelify Sans' },
  },
  {
    id: 'steel',
    name: 'Cobalt Steel',
    tag: 'Cooler metal, smooth icons',
    blurb: 'Swaps the brass for brushed steel and the Cobalt side’s own blue, so the interface matches your army. Headings use Jersey 15, a tall, narrow pixel face that reads like stencilled unit markings without being heavy. Icons are smooth two-tone drawings.',
    traits: ['Jersey 15 headings', 'Two-tone smooth icons', 'Steel and cobalt blue', 'Amber highlights'],
    icons: 'duo',
    type: { display: 'Jersey 15', body: 'Pixelify Sans' },
  },
  {
    id: 'deck',
    name: 'Command Deck',
    tag: 'A bigger overhaul of the layout',
    blurb: 'The same Refined Pixel parts, rearranged. On a computer everything you act with sits in one console along the bottom: what you have selected (with a big portrait and health), a grid of commands with their keys, and the build menu as a single row. Credits and power move to a strip at the top. On a phone the toolbar becomes a full-width tab bar and the build menu a full-width tray.',
    traits: ['Bottom console on desktop', 'Selected-unit card with portrait', 'Commands with hotkeys', 'Phone tab bar', 'Kode Mono headings', 'Fine pixel icons'],
    icons: 'fine',
    layout: 'deck',
    type: { display: 'Kode Mono', body: 'Pixelify Sans' },
  },
  {
    id: 'signal',
    name: 'Signal',
    tag: 'Dot-matrix readouts',
    blurb: 'Refined Pixel with the feel of field electronics. Headings and numbers are set in Doto, a dot-matrix face like a radio display, credits glow amber like an LED readout, and panels get a darker, glassier navy so the readouts stand out. Light and technical rather than blocky.',
    traits: ['Doto dot-matrix headings', 'Amber LED numbers', 'Darker navy glass', 'Fine pixel icons'],
    icons: 'fine',
    type: { display: 'Doto', body: 'Pixelify Sans' },
  },
  {
    id: 'soft',
    name: 'Soft Pixel',
    tag: 'Rounder and warmer',
    blurb: 'The friendliest take: bigger, rounder stepped corners, a warmer teal-navy with cream text, and VT323 for headings, a thin terminal pixel face that stays crisp at any size. Smooth two-tone icons keep it light.',
    traits: ['VT323 headings', 'Rounder pixel corners', 'Teal-navy and cream', 'Two-tone smooth icons'],
    icons: 'duo',
    type: { display: 'VT323', body: 'Pixelify Sans' },
  },
];

export const GROUP_COLORS = ['#4a9dff', '#3fe6e6', '#b4f03c', '#ffd93b', '#ff9a2e', '#ff6fb5', '#b07cff', '#f4f7ea'];
export const GROUP_NAMES = ['Blue', 'Cyan', 'Lime', 'Yellow', 'Orange', 'Pink', 'Purple', 'White'];
export const PLAYER_COLORS: [string, string][] = [
  ['Cobalt', '#4f74a8'], ['Ember', '#c0622e'], ['Crimson', '#a83434'], ['Gold', '#c49a22'],
  ['Violet', '#7650a8'], ['Teal', '#2a8f8a'], ['Rose', '#b8538a'], ['Frost', '#a7aeb4'],
  ['Lime', '#7fa62c'], ['Umber', '#86583a'], ['Onyx', '#3c3e44'], ['Sky', '#4ea6d6'],
];
