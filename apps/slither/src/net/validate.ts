import { cleanName, COLORS, isPattern } from '../game/looks';
import type { ControllerMessage } from './protocol';

// Phones are untrusted: anything malformed is dropped, names are trimmed (empty means "pick one for me"),
// colors must be on the palette.
export function parseControllerMessage(raw: unknown): ControllerMessage | null {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  if (m.t === 'steer') {
    const s = typeof m.s === 'number' && Number.isFinite(m.s) ? Math.max(-1, Math.min(1, m.s)) : 0;
    return { t: 'steer', s, boost: m.boost === true };
  }
  if (m.t === 'look') {
    if (!isPattern(m.pattern) || typeof m.color !== 'string') return null;
    const color = (COLORS as readonly string[]).includes(m.color) ? m.color : COLORS[0];
    return { t: 'look', name: cleanName(m.name, ''), color, pattern: m.pattern };
  }
  return null;
}
