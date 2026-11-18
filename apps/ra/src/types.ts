import type { RGB } from './gfx';
import type { ShroudLike } from './planet';

// What main.ts needs from each game version. All coordinates are map pixels
// (the flat, top-down or isometric screen-space map); main.ts owns the camera
// and translates the canvas before drawing.
//
// The map wraps round both ways, every `w` pixels across and every `h` pixels
// down, like a tiny planet. Points passed in may be on any copy of the map (the
// camera keeps going round), and games test the nearest copy of each unit.
// Games keep their own state on the first copy. main.ts draws the ground once
// for the whole view, then the objects of every copy of the map in view.
// A command for what is selected, shown as a button above the toolbar.
export interface Action {
  id: string;
  label: string;
  icon: string; // a key into main.ts's icons
  disabled?: boolean;
  title?: string;
}

// A kind of unit you have on screen, for the selection bar.
// What a tap at a map point would do, for the mouse cursor (harvest: send
// the selected ore haulers to dig there).
export type CursorAt = 'pick' | 'move' | 'attack' | 'harvest' | 'rally' | 'build' | 'blocked' | null;

export interface UnitType {
  kind: string;
  name: string;
  icon: string; // image URL
  count: number; // how many on screen
  sel: number; // how many of those are selected
}

// The colours you can give a selection, to pick it again later (1-8). Red
// is left out: it is the enemy's.
export const GROUP_COLORS = ['#4a9dff', '#3fe6e6', '#b4f03c', '#ffd93b', '#ff9a2e', '#ff6fb5', '#b07cff', '#f4f7ea'];
export const GROUP_NAMES = ['Blue', 'Cyan', 'Lime', 'Yellow', 'Orange', 'Pink', 'Purple', 'White'];

// A colour group with units in it.
export interface GroupInfo {
  color: number; // index into GROUP_COLORS
  hex: string;
  count: number;
  icon: string; // the picture of its most common kind
  sel: boolean; // the selection is exactly this group
}

// One thing on the build menu.
export interface BuildItem {
  id: string;
  name: string;
  tab: string;
  cost: number;
  icon: string; // image URL
  blurb: string;
  state: 'idle' | 'building' | 'paused' | 'ready';
  progress: number; // 0..1
  count: number; // how many queued (units)
  isNew: boolean;
  blocked?: string; // why it can't be started right now
}

export interface BuildMenu {
  credits: number;
  store?: number; // most credits you can hold
  power?: { made: number; used: number };
  tabs: { id: string; label: string; icon?: string; disabled?: boolean }[]; // icon: image URL; disabled: nothing on it yet
  items: BuildItem[];
}

export interface GameLike {
  seed: number;
  ctx: CanvasRenderingContext2D;
  onSelect: (names: string[]) => void;
  readonly w: number;
  readonly h: number;
  // Getting ready behind the loading screen (main.ts makeWorld): work to wait
  // for before generate() (preload) and after it (warmUp), each a promise.
  preload?(): Promise<unknown>[];
  generate(w: number, h: number): void;
  warmUp?(): Promise<unknown>[];
  update(dt: number): void;
  // What is going on, for the background music (src/music.ts): a fight
  // involving your side, your troops out away from the base, or neither.
  mood?(): 'battle' | 'shroud' | 'base';
  // Ground for a map rect in unwrapped map pixels; tiles not yet painted are
  // painted for up to `budget` milliseconds.
  renderGround(x0: number, y0: number, x1: number, y1: number, budget: number): void;
  // Whether the last ground drawn had tiles in it still to be painted.
  groundPending?(): boolean;
  // Objects of the copy of the map at the origin, within a rect in its coordinates.
  renderObjects(x0: number, y0: number, x1: number, y1: number): void;
  // Drawn once over all the copies, in unwrapped map pixels (the shroud and
  // whatever shows over it).
  renderOver?(x0: number, y0: number, x1: number, y1: number): void;
  // A coarse picture of the whole map for the globe views (the bases included),
  // and the units as coloured dots.
  // The coarse picture is built a little at a time: mapStep(ms) works on it
  // for up to ms milliseconds and says whether it is ready.
  mapStep(ms: number): boolean;
  mapImage(): HTMLCanvasElement;
  // The shroud, if there is one: the globe darkens its picture of the map
  // with it, redoing just the part where more has been seen.
  shroudMap?(): (ShroudLike & { changed(): [number, number, number, number] | null }) | null;
  mapDots(): [number, number, RGB][];
  click(x: number, y: number, add: boolean): void;
  // shortest: from the globe view, go the shortest way instead of the way the
  // camera has panned.
  order(x: number, y: number, shortest?: boolean): void;
  // Map positions of the selected units, for the globe views.
  selectedPoints(): [number, number][];
  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void;
  // Your kinds of unit inside a map rect (the view), and selecting or
  // dropping one kind of them (on: add those in the rect; off: drop them all).
  unitTypes?(x0: number, y0: number, x1: number, y1: number): UnitType[];
  // Select everything of yours in a screen rect except kinds that are
  // only picked by hand (ore haulers), unless that is all there is.
  selectAll?(x0: number, y0: number, x1: number, y1: number, add: boolean): void;
  selectKind?(kind: string, on: boolean, x0: number, y0: number, x1: number, y1: number): void;
  // The kinds of unit of yours that are selected, wherever they are.
  selectedTypes?(): UnitType[];
  // Colour groups: the ones in use, putting the selection into one, and
  // selecting one (false if it has no units left).
  groups?(): GroupInfo[];
  setGroup?(g: number): void;
  selectGroup?(g: number): boolean;
  deselect(): void;
  focus(): { x: number; y: number };
  // True if the game draws at ART pixels to the map pixel (see gfx.ts).
  fine?: boolean;
  // Commands for the selection (deploy, pack up and so on), if the version has any.
  actions?(): Action[];
  act?(id: string): void;
  /** A lone selected MCU of yours: where to show its Deploy button over it. */
  deployAt?(): { x: number; y: number; ok: boolean } | null;
  // Goes up whenever the bases change, so the globe's picture is redrawn.
  mapVersion?: number;
  // Building: the build menu (null until there is anything to build), tapping
  // an item (start, pause, resume, or place it when ready), cancelling it,
  // and short messages for the player.
  buildMenu?(): BuildMenu | null;
  buildTap?(id: string): void;
  buildCancel?(id: string): void;
  seen?(id: string): void;
  onNotice?: (msg: string) => void;
  // Placing a finished building: true while its ghost is out, which follows
  // placeAt (map coordinates); act('place') puts it down.
  placing?(): boolean;
  placeAt?(x: number, y: number): void;
  // Maps to pick from before generate(), with a small picture of each for
  // the current seed; mapId is the one generate() makes.
  maps?(): { id: string; name: string; blurb: string; players?: [number, number] }[];
  preview?(id: string, w: number, h: number): HTMLCanvasElement;
  mapId?: string;
  // The size of the world generate() should be given for mapId, from the
  // usual one (some maps are smaller planets).
  worldSize?(w: number, h: number): { w: number; h: number };
  // Stages to start in, for testing (the normal start, a ready-made fight...);
  // stage is the one generate() makes.
  stages?(): { id: string; name: string; blurb: string }[];
  stage?: string;
  // false: don't mark where move orders go (the mouse cursor shows it).
  moveMarks?: boolean;
  // What a tap at map point (x, y) would do, for the mouse cursor: pick a
  // unit, send the selection there, attack an enemy, set a building's rally point, put the building being
  // placed down, or nothing it can do ('blocked'). null: nothing to show.
  cursorAt?(x: number, y: number): CursorAt;
  // How far to shake the view this frame (map pixels), when something big
  // has just been destroyed near the middle of it.
  shake?(): [number, number];
  // Where your home base is now, for the Home button.
  homeBase?(): { x: number; y: number };
}
