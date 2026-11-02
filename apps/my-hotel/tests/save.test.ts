import { describe, expect, it } from 'vitest';
import { createHotel, tick } from '../src/sim/hotel';
import { deleteSave, deserialize, hasSave, loadHotel, saveHotel, saveKey, serialize } from '../src/save/save';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('saving', () => {
  it('a loaded hotel keeps playing the same as the original', () => {
    const h = createHotel('seaside', 9);
    for (let i = 0; i < 300; i++) tick(h, 1 / 30, { x: 0.2, z: 0.1 });
    const copy = deserialize(serialize(h), 'seaside')!;
    for (let i = 0; i < 300; i++) {
      tick(h, 1 / 30);
      tick(copy, 1 / 30);
    }
    expect(copy).toEqual(h);
  });

  it('keeps one save per map', () => {
    const store = memoryStorage();
    const a = createHotel('seaside', 1);
    a.coins = 111;
    const b = createHotel('lodge', 1);
    b.coins = 222;
    saveHotel(a, store);
    saveHotel(b, store);
    expect(loadHotel('seaside', store).coins).toBe(111);
    expect(loadHotel('lodge', store).coins).toBe(222);
    expect(hasSave('city', store)).toBe(false);
    deleteSave('lodge', store);
    expect(hasSave('lodge', store)).toBe(false);
  });

  it('starts fresh on missing or broken saves', () => {
    const store = memoryStorage();
    store.setItem(saveKey('city'), '{oops');
    expect(loadHotel('city', store).served).toBe(0);
    expect(deserialize(JSON.stringify({ version: 1 }), 'city')).toBeNull();
  });
});
