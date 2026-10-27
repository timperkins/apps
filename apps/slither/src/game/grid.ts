import { WORLD_H, WORLD_W } from './constants';
import { wrap } from './math';

// Buckets body points by cell so collision checks only look nearby. Cells wrap with the world.
export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  // Each entry is snake index * 65536 + point index.
  private cells: number[][];

  constructor(readonly cellSize = 40) {
    this.cols = Math.ceil(WORLD_W / cellSize);
    this.rows = Math.ceil(WORLD_H / cellSize);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const cell of this.cells) cell.length = 0;
  }

  insert(x: number, y: number, snake: number, point: number): void {
    const cx = Math.floor(wrap(x, WORLD_W) / this.cellSize) % this.cols;
    const cy = Math.floor(wrap(y, WORLD_H) / this.cellSize) % this.rows;
    this.cells[cy * this.cols + cx].push(snake * 65536 + point);
  }

  // Calls back with every entry in the cells that cover the circle (and maybe a few more).
  query(x: number, y: number, radius: number, cb: (snake: number, point: number) => void): void {
    const span = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(wrap(x, WORLD_W) / this.cellSize);
    const cy = Math.floor(wrap(y, WORLD_H) / this.cellSize);
    const spanX = Math.min(span, Math.floor((this.cols - 1) / 2));
    const spanY = Math.min(span, Math.floor((this.rows - 1) / 2));
    for (let dy = -spanY; dy <= spanY; dy++) {
      const row = ((cy + dy) % this.rows + this.rows) % this.rows;
      for (let dx = -spanX; dx <= spanX; dx++) {
        const col = ((cx + dx) % this.cols + this.cols) % this.cols;
        for (const entry of this.cells[row * this.cols + col]) cb(Math.floor(entry / 65536), entry % 65536);
      }
    }
  }
}
