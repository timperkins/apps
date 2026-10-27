// 3x5 block digits, one string of '#' and '.' per row, drawn as solid pixels.
const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['..#', '..#', '..#', '..#', '..#'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

export function numberWidth(value: number, cell: number): number {
  return String(value).length * (GLYPH_W + 1) * cell - cell;
}

// Draws digits with their right edge at `right`, `cell` pixels per block.
export function drawNumber(ctx: CanvasRenderingContext2D, value: number, right: number, top: number, cell: number): void {
  const text = String(value);
  const advance = (GLYPH_W + 1) * cell;
  let x = right - text.length * advance + cell;
  for (const ch of text) {
    const rows = DIGITS[ch];
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < GLYPH_W; rx++) {
        if (row[rx] === '#') ctx.fillRect(x + rx * cell, top + ry * cell, cell, cell);
      }
    });
    x += advance;
  }
}
