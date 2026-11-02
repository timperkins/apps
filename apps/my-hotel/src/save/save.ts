// One save per map, kept in the browser. The version field lets later updates migrate old saves.
import { createHotel, type Hotel, type MapId } from '../sim/hotel';

export const saveKey = (map: MapId) => `my-hotel:save:${map}`;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function serialize(h: Hotel): string {
  return JSON.stringify(h);
}

export function deserialize(text: string | null, map: MapId): Hotel | null {
  if (!text) return null;
  try {
    const h = JSON.parse(text) as Hotel;
    if (h.version !== 2 || h.map !== map || !Array.isArray(h.lots) || !h.player) return null;
    return h;
  } catch {
    return null;
  }
}

export function hasSave(map: MapId, store: Store | null = storage()): boolean {
  try {
    return deserialize(store?.getItem(saveKey(map)) ?? null, map) !== null;
  } catch {
    return false;
  }
}

export function loadHotel(map: MapId, store: Store | null = storage()): Hotel {
  try {
    const h = deserialize(store?.getItem(saveKey(map)) ?? null, map);
    if (h) return h;
  } catch {
    // fall through to a new hotel
  }
  return createHotel(map);
}

export function saveHotel(h: Hotel, store: Store | null = storage()): void {
  try {
    store?.setItem(saveKey(h.map), serialize(h));
  } catch {
    // quota or privacy mode: keep playing without saving
  }
}

export function deleteSave(map: MapId, store: Store | null = storage()): void {
  try {
    store?.removeItem(saveKey(map));
  } catch {
    // ignore
  }
}

function storage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
