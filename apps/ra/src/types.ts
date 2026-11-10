// What main.ts needs from each game version. All coordinates are map pixels
// (the flat, top-down or isometric screen-space map); main.ts owns the camera
// and translates the canvas before drawing.
//
// The map wraps around east to west every `w` pixels, like a tiny planet. x
// values passed in may be on any copy of the map (the camera keeps going round),
// and games test the nearest copy of each unit. Games keep their own state in
// 0 <= x < w, and main.ts draws a copy of the map at every multiple of w in view.
export interface GameLike {
  seed: number;
  ctx: CanvasRenderingContext2D;
  onSelect: (names: string[]) => void;
  readonly w: number;
  readonly h: number;
  generate(w: number, h: number): void;
  update(dt: number): void;
  renderGround(): void;
  renderObjects(): void;
  click(x: number, y: number, add: boolean): void;
  // shortest: from the globe view, go the shortest way (maybe over a pole)
  // instead of the way the camera has panned.
  order(x: number, y: number, shortest?: boolean): void;
  // Map positions of the selected units, for the globe views.
  selectedPoints(): [number, number][];
  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void;
  deselect(): void;
  focus(): { x: number; y: number };
}
