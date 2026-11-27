import { writeFileSync } from 'fs';
import { expect, test } from 'vitest';
import { dropGrids } from './cursors';

test('the drop cursor is square, marks its spot, and its burst plays out', () => {
  const { rest, click } = dropGrids();
  expect(rest).toHaveLength(8);
  for (const rows of [...rest, ...click]) for (const r of rows) expect(r.length).toBe(rows.length);
  // the spot itself is lit in every resting frame
  for (const rows of rest) expect(rows[14][10]).toBe('B');
  if (process.env.DUMP_CURSORS) writeFileSync(process.env.DUMP_CURSORS, JSON.stringify({ rest, click }));
});
