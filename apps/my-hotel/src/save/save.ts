// One save per map, kept in the browser. The version field lets later updates migrate old saves.
import { LOBBY_CLEANER_SPOTS, createHotel, lotCleanerSpot, type Hotel, type MapId, type Staff } from '../sim/hotel';
import { RECEPTIONIST_SPOT, parseLot } from '../sim/layout';

export const saveKey = (map: MapId) => `my-hotel:save:${map}`;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function serialize(h: Hotel): string {
  return JSON.stringify(h);
}

export function deserialize(text: string | null, map: MapId): Hotel | null {
  if (!text) return null;
  try {
    const h = JSON.parse(text) as Hotel;
    if (!h || h.map !== map || !Array.isArray(h.lots) || !h.player) return null;
    if ((h.version as number) === 2) migrateFrom2(h);
    if (h.version !== 3) return null;
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

/** Version 2 had one cleaner pad; version 3 has several, plus one per lot. */
function migrateFrom2(h: Hotel) {
  const spots = [...LOBBY_CLEANER_SPOTS];
  for (const k of h.lots) {
    const [i, j] = parseLot(k);
    if (i !== 0 || j !== 0) spots.push(lotCleanerSpot(i, j));
  }
  h.cleanerSpots = spots.map((p, n) => ({ id: n + 1, x: p.x, z: p.z, hired: false }));
  const old = h.staff as (Omit<Staff, 'id' | 'home'> & Partial<Staff>)[];
  h.staff = old.map((s) => {
    if (s.role === 'receptionist') return { ...s, id: 'clerk', home: { ...RECEPTIONIST_SPOT } } as Staff;
    h.cleanerSpots[0].hired = true;
    return { ...s, id: 'cleaner-1', home: { x: spots[0].x, z: spots[0].z - 1.5 } } as Staff;
  });
  h.version = 3;
}
