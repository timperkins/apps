import { describe, expect, it } from 'vitest';
import { parseControllerMessage } from './validate';

describe('parseControllerMessage', () => {
  it('clamps steering and rejects junk', () => {
    expect(parseControllerMessage('{"t":"steer","s":4,"boost":true}')).toEqual({ t: 'steer', s: 1, boost: true });
    expect(parseControllerMessage('{"t":"steer","s":"x"}')).toEqual({ t: 'steer', s: 0, boost: false });
    expect(parseControllerMessage('not json')).toBeNull();
    expect(parseControllerMessage('{"t":"nope"}')).toBeNull();
  });

  it('cleans looks', () => {
    expect(parseControllerMessage('{"t":"look","name":"  A very long name indeed ","color":"#ff5a5f","pattern":"dots"}')).toEqual({
      t: 'look',
      name: 'A very long',
      color: '#ff5a5f',
      pattern: 'dots',
    });
    expect(parseControllerMessage('{"t":"look","name":"x","color":"#123456","pattern":"dots"}')).toMatchObject({ color: '#ff5a5f' });
    expect(parseControllerMessage('{"t":"look","name":"x","color":"#ff5a5f","pattern":"plaid"}')).toBeNull();
  });
});
