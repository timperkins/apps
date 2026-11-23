import { describe, expect, it } from 'vitest';
import { parseControllerMessage } from './validate';

describe('parseControllerMessage', () => {
  it('clamps stick input', () => {
    expect(parseControllerMessage(JSON.stringify({ t: 'in', x: 5, y: -9, hold: 1 }))).toEqual({ t: 'in', x: 1, y: -1, hold: false });
  });

  it('checks joins and actions', () => {
    expect(parseControllerMessage(JSON.stringify({ t: 'join', role: 'raider', name: '  Tim  ', color: '#ff4f4f', kind: 'fish' }))).toEqual({
      t: 'join',
      role: 'raider',
      name: 'Tim',
      color: '#ff4f4f',
      kind: 'fish',
    });
    expect(parseControllerMessage(JSON.stringify({ t: 'join', role: 'king', name: 'x', color: '#ff4f4f', kind: 'fish' }))).toBeNull();
    expect(parseControllerMessage(JSON.stringify({ t: 'join', role: 'swimmer', name: 'x', color: '#123456', kind: 'clown' }))?.t).toBe('join');
    expect(parseControllerMessage(JSON.stringify({ t: 'act', a: 'cast' }))).toEqual({ t: 'act', a: 'cast' });
    expect(parseControllerMessage(JSON.stringify({ t: 'act', a: 'nuke' }))).toBeNull();
    expect(parseControllerMessage('not json')).toBeNull();
  });
});
