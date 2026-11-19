// Sprite rendering off the main thread. Drawing a unit heading or a building
// with the voxel renderer (stack.ts) takes from a few milliseconds to a few
// hundred on a phone, and done in the middle of play that is a stutter. A
// few workers (art-worker.ts) draw them instead and send them back as
// bitmaps. Wanted-now headings jump the queue; the rest are worked through
// in the background so they're ready before they're needed.
//
// Where workers or OffscreenCanvas aren't available everything is drawn on
// the main thread as before.
import type { Reply, SprMsg } from './art-worker';
import type { V2BuildingArt } from './sprites';
import { StackSprite, deliver, setRemote } from './stack';

type Job = { key: string; d: number; resolve?: (r: Reply | null) => void };

const workers: Worker[] = [];
const busy = new Map<Worker, number>(); // jobs in flight on each
const urgent: Job[] = [];
const later: Job[] = [];
const waiting = new Map<number, Job>();
let nextId = 1;
let broken = false;
const PER_WORKER = 2;

function supported(): boolean {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;
  try {
    return !!new OffscreenCanvas(1, 1).getContext('2d');
  } catch {
    return false;
  }
}

function toCanvas(b: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = b.width;
  c.height = b.height;
  c.getContext('2d')!.drawImage(b, 0, 0);
  b.close();
  return c;
}

// (turned into canvases the first time they're drawn, so the many that
// arrive in the background cost nothing until then)
export function unpack(m: SprMsg): StackSprite {
  let img: HTMLCanvasElement | undefined;
  let shadow: HTMLCanvasElement | null | undefined;
  return {
    get img() {
      return (img ??= toCanvas(m.img));
    },
    get shadow() {
      if (shadow === undefined) shadow = m.shadow ? toCanvas(m.shadow) : null;
      return shadow;
    },
    cx: m.cx,
    cy: m.cy,
    w: m.w,
    h: m.h,
  };
}

function pump(): void {
  for (const w of workers) {
    while ((busy.get(w) ?? 0) < PER_WORKER) {
      const job = urgent.shift() ?? later.shift();
      if (!job) return;
      const id = nextId++;
      waiting.set(id, job);
      busy.set(w, (busy.get(w) ?? 0) + 1);
      w.postMessage({ id, key: job.key, d: job.d });
    }
  }
}

function onReply(w: Worker, r: Reply): void {
  busy.set(w, (busy.get(w) ?? 1) - 1);
  const job = waiting.get(r.id);
  waiting.delete(r.id);
  if (r.spr && !r.key.startsWith('b:')) deliver(r.key, r.d, unpack(r.spr));
  job?.resolve?.(r.err ? null : r);
  pump();
}

function fail(): void {
  // a worker died: draw on the main thread from now on
  broken = true;
  setRemote(null);
  for (const w of workers) w.terminate();
  workers.length = 0;
  for (const j of [...waiting.values(), ...urgent, ...later]) j.resolve?.(null);
  waiting.clear();
  urgent.length = 0;
  later.length = 0;
}

/** Start the workers (once). Returns false if sprites will be drawn here. */
export function startArtPool(): boolean {
  if (workers.length) return true;
  if (broken || !supported()) return false;
  const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
  try {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./art-worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<Reply>) => onReply(w, e.data);
      w.onerror = fail;
      workers.push(w);
    }
  } catch {
    fail();
    return false;
  }
  setRemote({ want: (key, d, now) => want(key, d, now) });
  return true;
}

const promised = new Map<string, Promise<void>>();

// Ask for a heading: now, ahead of everything waiting, or in the background.
// Resolves when it has arrived (at once if there are no workers).
function want(key: string, d: number, now: boolean): Promise<void> {
  if (!workers.length) return Promise.resolve();
  const id = `${key}|${d}`;
  const had = promised.get(id);
  if (had) {
    if (now) {
      // queued for later: bring it forward
      const i = later.findIndex((j) => j.key === key && j.d === d);
      if (i >= 0) {
        urgent.push(...later.splice(i, 1));
        pump();
      }
    }
    return had;
  }
  const p = new Promise<void>((resolve) => {
    (now ? urgent : later).push({ key, d, resolve: () => resolve() });
  });
  promised.set(id, p);
  pump();
  return p;
}

/** Have a heading drawn by a worker; resolves when it has arrived. */
export function prefetch(key: string, d: number, now = false): Promise<void> {
  return want(key, d, now);
}

/** A building's art, drawn by a worker (null if it has to be drawn here). */
export function buildingArt(kind: string, f: number, now = true): Promise<V2BuildingArt | null> {
  return new Promise((res) => {
    if (!workers.length) return res(null);
    const key = `b:${kind}:${f}`;
    (now ? urgent : later).push({
      key,
      d: 0,
      resolve: (r) => res(r?.spr ? { spr: unpack(r.spr), rx: r.rx!, ry: r.ry!, fx: r.fx! } : null),
    });
    pump();
  });
}

/** The stages of a building going up, drawn by a worker (null if there are no workers). */
export function constructionArt(kind: string, f: number, now = true): Promise<StackSprite[] | null> {
  return new Promise((res) => {
    if (!workers.length) return res(null);
    (now ? urgent : later).push({ key: `bc:${kind}:${f}`, d: 0, resolve: (r) => res(r?.stages ? r.stages.map(unpack) : null) });
    pump();
  });
}

/** Jobs still queued or in flight. */
export function artBacklog(): number {
  return urgent.length + later.length + waiting.size;
}
