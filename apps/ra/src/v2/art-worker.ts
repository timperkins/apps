// Renders sprites off the main thread for art-pool.ts. It builds the same
// shapes as the game (makeFactionArt, makeBuilding, makeDish) and draws the
// one asked for, sending it back as bitmaps.
import { FACTIONS } from '../factions';
import { BuildingKind, V2FactionArt, factionOf, factionSet, makeBuilding, makeBuildingGlow, makeConstruction, makeDish, makeFactionArt } from './sprites';
import { StackSprite } from './stack';
import { bridgeFromKey } from './bridge-art';

export type Job = { id: number; key: string; d: number };
export interface SprMsg {
  img: ImageBitmap;
  shadow: ImageBitmap | null;
  cx: number;
  cy: number;
  w: number;
  h: number;
}
export type Reply = { id: number; key: string; d: number; spr?: SprMsg; rx?: number; ry?: number; fx?: { x: number; y: number; z: number }[]; stages?: SprMsg[]; err?: string };

const arts: V2FactionArt[] = [];
let dish: StackSprite[] | null = null;
const sent = new Set<string>();

const bitmap = (c: HTMLCanvasElement) => (c as unknown as OffscreenCanvas).transferToImageBitmap();
function pack(s: StackSprite): [SprMsg, Transferable[]] {
  const img = bitmap(s.img);
  const shadow = s.shadow ? bitmap(s.shadow) : null;
  return [{ img, shadow, cx: s.cx, cy: s.cy, w: s.w, h: s.h }, shadow ? [img, shadow] : [img]];
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, key, d } = e.data;
  try {
    // b:<kind>:<faction> is a building, bc:<kind>:<faction> the stages of it
    // going up, bg:<kind>:<faction> the light in its windows, fa:... a unit's heading, dish the radar's
    if (key.startsWith('br:')) {
      // a bridge: its main picture and its near rail (which may be missing)
      const [back, front] = bridgeFromKey(key);
      const packed = [pack(back), ...(front ? [pack(front)] : [])];
      (self as unknown as Worker).postMessage({ id, key, d, stages: packed.map((p) => p[0]) } satisfies Reply, packed.flatMap((p) => p[1]));
      return;
    }
    if (key.startsWith('bc:')) {
      const [, kind, f] = key.split(':');
      const packed = makeConstruction(kind as BuildingKind, factionOf(Number(f))).map(pack);
      (self as unknown as Worker).postMessage({ id, key, d, stages: packed.map((p) => p[0]) } satisfies Reply, packed.flatMap((p) => p[1]));
      return;
    }
    if (key.startsWith('bg:')) {
      // the light in a building's windows, if it has any (see makeBuildingGlow)
      const [, kind, f] = key.split(':');
      const g = makeBuildingGlow(kind as BuildingKind, factionOf(Number(f)));
      const packed = g ? [pack(g)] : [];
      (self as unknown as Worker).postMessage({ id, key, d, stages: packed.map((p) => p[0]) } satisfies Reply, packed.flatMap((p) => p[1]));
      return;
    }
    if (key.startsWith('b:')) {
      const [, kind, f] = key.split(':');
      const a = makeBuilding(kind as BuildingKind, factionOf(Number(f)));
      const [spr, tr] = pack(a.spr);
      (self as unknown as Worker).postMessage({ id, key, d, spr, rx: a.rx, ry: a.ry, fx: a.fx } satisfies Reply, tr);
      return;
    }
    let set: StackSprite[] | null;
    if (key === 'dish') set = dish ??= makeDish();
    else {
      const f = Number(key.split(':')[1]);
      set = factionSet((arts[f] ??= makeFactionArt(FACTIONS[f])), key);
    }
    if (!set) throw new Error(`no art ${key}`);
    // (each is drawn once: its canvas went with the first answer)
    if (sent.has(`${key}|${d}`)) return (self as unknown as Worker).postMessage({ id, key, d } satisfies Reply);
    sent.add(`${key}|${d}`);
    const [spr, tr] = pack(set[d]);
    (self as unknown as Worker).postMessage({ id, key, d, spr } satisfies Reply, tr);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, key, d, err: String(err) } satisfies Reply);
  }
};
