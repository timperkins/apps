// Spoken lines: units answer when selected and ordered about, and the base
// announcer calls out what happens. The clips are in public/voice/, one
// folder per voice, named <voice>_<line>_<n>.mp3. Each kind of line has a few
// takes and one is picked at random (never the same one twice running).
//
// Played through Web Audio, which phones only allow after a tap: the context
// starts on the first pointer or key press, and the clips load then.

import { onSettings, settings } from './settings';

export type UnitVoice = 'soldier' | 'tank' | 'copter' | 'scout' | 'harvester' | 'engineer' | 'dog' | 'commando' | 'flamer' | 'pilot' | 'navy';
export type UnitLine = 'select' | 'move' | 'attack' | 'harvest' | 'full' | 'repair';
export type Announce =
  | 'building'
  | 'training'
  | 'construction_complete'
  | 'unit_ready'
  | 'insufficient_funds'
  | 'low_power'
  | 'power_restored'
  | 'base_under_attack'
  | 'harvester_under_attack'
  | 'unit_lost'
  | 'building_lost'
  | 'new_options'
  | 'rally_point'
  | 'para_ready';

const UNIT_CLIPS: Record<UnitVoice, Partial<Record<UnitLine, number>>> = {
  soldier: { select: 5, move: 5, attack: 5 },
  tank: { select: 4, move: 4, attack: 4 },
  copter: { select: 4, move: 4, attack: 4 },
  scout: { select: 4, move: 4, attack: 4 },
  harvester: { select: 4, move: 4, harvest: 3, full: 2 },
  engineer: { select: 4, move: 4, repair: 3 },
  dog: { select: 2, move: 2, attack: 2 },
  commando: { select: 4, move: 4, attack: 4 },
  flamer: { select: 4, move: 4, attack: 4 },
  pilot: { select: 4, move: 4, attack: 4 },
  navy: { select: 4, move: 4, attack: 4 },
};

const ANNOUNCE: Announce[] = [
  'building',
  'training',
  'construction_complete',
  'unit_ready',
  'insufficient_funds',
  'low_power',
  'power_restored',
  'base_under_attack',
  'harvester_under_attack',
  'unit_lost',
  'building_lost',
  'new_options',
  'rally_point',
  'para_ready',
];

// The least time between two of the same announcement, in seconds: alerts
// that can fire every frame of a fight are kept to one now and then.
const ANNOUNCE_GAP: Partial<Record<Announce, number>> = {
  insufficient_funds: 10,
  base_under_attack: 25,
  harvester_under_attack: 25,
  unit_lost: 8,
  building_lost: 4,
  low_power: 10,
  new_options: 6,
  rally_point: 3,
};

const base = import.meta.env.BASE_URL;
const url = (voice: string, line: string, n: number) => `${base}voice/${voice}/${voice}_${line}_${n}.mp3`;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();
const lastPick = new Map<string, number>();
const lastSaid = new Map<Announce, number>();
const unlockFns: ((c: AudioContext) => void)[] = [];
let unitSrc: AudioBufferSourceNode | null = null;
let annSrc: AudioBufferSourceNode | null = null;
let annQueue: string[] = [];
// the Voices volume in Settings (squared, so the slider sounds even)
const level = () => 0.9 * settings().voice ** 2;

function load(u: string): Promise<AudioBuffer | null> {
  const hit = buffers.get(u);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(u);
  if (!p && ctx) {
    const c = ctx;
    p = fetch(u)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => {
        buffers.set(u, buf);
        return buf;
      })
      .catch(() => null);
    loading.set(u, p);
  }
  return p ?? Promise.resolve(null);
}

function allUrls(): string[] {
  const us: string[] = [];
  for (const [v, lines] of Object.entries(UNIT_CLIPS)) for (const [l, n] of Object.entries(lines)) for (let i = 1; i <= n!; i++) us.push(url(v, l, i));
  for (const a of ANNOUNCE) us.push(url('announcer', a, 1));
  return us;
}

function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = level();
    out.connect(ctx.destination);
    // load everything in the background, a few at a time
    const todo = allUrls();
    const next = (): void => {
      const u = todo.shift();
      if (u) void load(u).then(next);
    };
    for (let i = 0; i < 4; i++) next();
    for (const f of unlockFns) f(ctx);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

/** Runs once audio is allowed (the first tap), with the shared context. Used by src/music.ts. */
export function onAudioUnlock(f: (c: AudioContext) => void): void {
  if (ctx) f(ctx);
  else unlockFns.push(f);
}

function start(buf: AudioBuffer, gain = 1): AudioBufferSourceNode | null {
  if (!ctx || !out) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (gain !== 1) {
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out);
  } else src.connect(out);
  src.start();
  return src;
}

// A random take of one line, not the one picked last time.
function pick(voice: string, line: string, n: number): string {
  const key = `${voice}_${line}`;
  let i = 1 + Math.floor(Math.random() * n);
  if (n > 1 && i === lastPick.get(key)) i = (i % n) + 1;
  lastPick.set(key, i);
  return url(voice, line, i);
}

/** A unit answers. A new answer cuts off the one before, as in the old RTS games. */
export function sayUnit(voice: UnitVoice, line: UnitLine): void {
  if (!level() || !ctx) return;
  const n = UNIT_CLIPS[voice][line];
  if (!n) return;
  const u = pick(voice, line, n);
  const buf = buffers.get(u);
  if (!buf) {
    void load(u);
    return; // not loaded yet: a late answer would sound out of step
  }
  try {
    unitSrc?.stop();
  } catch {
    /* already ended */
  }
  unitSrc = start(buf);
}

/** The base announcer. Announcements queue up instead of talking over each other. */
export function announce(what: Announce, now = performance.now() / 1000): void {
  if (!level() || !ctx) return;
  const gap = ANNOUNCE_GAP[what] ?? 2;
  if (now - (lastSaid.get(what) ?? -1e9) < gap) return;
  lastSaid.set(what, now);
  const u = url('announcer', what, 1);
  if (annQueue.includes(u) || annQueue.length >= 3) return;
  annQueue.push(u);
  if (!annSrc) playNext();
}

function playNext(): void {
  const u = annQueue.shift();
  if (!u) {
    annSrc = null;
    return;
  }
  void load(u).then((buf) => {
    if (!buf) return playNext();
    const src = start(buf, 1.1);
    annSrc = src;
    if (src) src.onended = () => playNext();
    else annSrc = null;
  });
}

onSettings(() => {
  if (ctx && out) out.gain.setTargetAtTime(level(), ctx.currentTime, 0.05);
  if (!level()) {
    annQueue = [];
    try {
      unitSrc?.stop();
      annSrc?.stop();
    } catch {
      /* already ended */
    }
  }
});
