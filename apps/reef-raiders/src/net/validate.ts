import { cleanName, isColor, isKind, isRole } from '../game/looks';
import type { Action, ControllerMessage } from './protocol';

const ACTIONS: Action[] = ['cast', 'tap', 'heave', 'pull', 'thrash', 'dash', 'egg', 'taunt', 'sell', 'find'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

// Phones are untrusted: anything malformed is dropped and every value is clamped or checked.
export function parseControllerMessage(raw: unknown): ControllerMessage | null {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  if (m.t === 'in') return { t: 'in', x: num(m.x), y: num(m.y), hold: m.hold === true };
  if (m.t === 'act') return ACTIONS.includes(m.a as Action) ? { t: 'act', a: m.a as Action } : null;
  if (m.t === 'join') {
    if (!isRole(m.role) || !isKind(m.kind)) return null;
    return { t: 'join', role: m.role, name: cleanName(m.name, ''), color: isColor(m.color) ? m.color : '', kind: m.kind };
  }
  return null;
}
