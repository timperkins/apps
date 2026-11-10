// What main.ts needs from each game version.
export interface GameLike {
  seed: number;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  onSelect: (names: string[]) => void;
  readonly w: number;
  readonly h: number;
  generate(w: number, h: number): void;
  update(dt: number): void;
  render(): void;
  click(x: number, y: number, add: boolean): void;
  order(x: number, y: number): void;
  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean): void;
  deselect(): void;
}
