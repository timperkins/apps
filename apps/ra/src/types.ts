import type { RGB } from './gfx';

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
  tabs: { id: string; label: string }[];
  items: BuildItem[];
}

export interface GameLike {
  seed: number;
  ctx: CanvasRenderingContext2D;
  onSelect: (names: string[]) => void;
  readonly w: number;
  readonly h: number;
  generate(w: number, h: number): void;
  update(dt: number): void;
  // Ground for a map rect in unwrapped map pixels; tiles not yet painted are
  // painted for up to `budget` milliseconds.
  renderGround(x0: number, y0: number, x1: number, y1: number, budget: number): void;
  // Objects of the copy of the map at the origin, within a rect in its coordinates.
  renderObjects(x0: number, y0: number, x1: number, y1: number): void;
  // A coarse picture of the whole map for the globe views (the bases included),
  // and the units as coloured dots.
  // The coarse picture is built a little at a time: mapStep(ms) works on it
  // for up to ms milliseconds and says whether it is ready.
  mapStep(ms: number): boolean;
  mapImage(): HTMLCanvasElement;
  mapDots(): [number, number, RGB][];
  click(x: number, y: number, add: boolean): void;
  // shortest: from the globe view, go the shortest way instead of the way the
  // camera has panned.
  order(x: number, y: number, shortest?: boolean): void;
  // Map positions of the selected units, for the globe views.
  selectedPoints(): [number, number][];
  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void;
  deselect(): void;
  focus(): { x: number; y: number };
  // Commands for the selection (deploy, pack up and so on), if the version has any.
  actions?(): Action[];
  act?(id: string): void;
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
}
