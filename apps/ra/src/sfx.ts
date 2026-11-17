// Sound effects: guns, explosions, engines, building, ore and the buttons.
// The clips are in public/sfx/, one mp3 each (made with ElevenLabs). One clip
// often stands in for several sounds by playing faster or slower: the Bastion
// fires the Lancer's cannon an octave-ish down, the Kestrel the Rocketeer's
// rocket a little up, and so on (see the calls in src/v2/game.ts).
//
// The files are fetched while the loading screen is up, and decoded on the
// audio context src/voice.ts starts at the first tap.
//
// Two kinds of sound:
//   play():  a one-shot, at a volume the caller works out (how near the
//            middle of the view it happened). Every play is pitched a few
//            percent at random so a burst of gunfire isn't one sound repeated.
//   level(): a loop (engines, rotors, fire, wind, surf) that is always
//            running once loaded; each frame the game says how loud it should
//            be, and it glides there.

import { onAudioUnlock } from './voice';
import { onSettings, settings } from './settings';

export type Sfx =
  | 'rifle_shot'
  | 'cannon_shot'
  | 'howitzer_shot'
  | 'rocket_launch'
  | 'shell_whistle'
  | 'bullet_hit'
  | 'explosion_small'
  | 'explosion_large'
  | 'building_collapse'
  | 'debris'
  | 'infantry_death'
  | 'build_rise'
  | 'build_place'
  | 'foundry_unfold'
  | 'unit_exit'
  | 'ore_unload'
  | 'ui_click'
  | 'ui_panel'
  | 'credits_tick'
  | 'ui_error'
  | 'order_confirm'
  | 'ui_ready'
  | 'whoosh_space';

export type Loop = 'tracks_loop' | 'engine_loop' | 'rotor_loop' | 'boat_loop' | 'footsteps' | 'ore_dig' | 'ambient_land' | 'surf_loop' | 'fire_loop';

const SHOTS: Sfx[] = [
  'rifle_shot',
  'cannon_shot',
  'howitzer_shot',
  'rocket_launch',
  'shell_whistle',
  'bullet_hit',
  'explosion_small',
  'explosion_large',
  'building_collapse',
  'debris',
  'infantry_death',
  'build_rise',
  'build_place',
  'foundry_unfold',
  'unit_exit',
  'ore_unload',
  'ui_click',
  'ui_panel',
  'credits_tick',
  'ui_error',
  'order_confirm',
  'ui_ready',
  'whoosh_space',
];
const LOOPS: Loop[] = ['tracks_loop', 'engine_loop', 'rotor_loop', 'boat_loop', 'footsteps', 'ore_dig', 'ambient_land', 'surf_loop', 'fire_loop'];

// How loud each clip is at full volume. The clips were all evened out to the
// same peak; this balances them against each other and the voices.
const GAIN: Partial<Record<Sfx | Loop, number>> = {
  rifle_shot: 0.35,
  cannon_shot: 0.5,
  howitzer_shot: 0.6,
  rocket_launch: 0.45,
  shell_whistle: 0.25,
  bullet_hit: 0.25,
  explosion_small: 0.5,
  explosion_large: 0.6,
  building_collapse: 0.7,
  debris: 0.3,
  infantry_death: 0.35,
  build_rise: 0.45,
  build_place: 0.6,
  foundry_unfold: 0.5,
  unit_exit: 0.4,
  ore_unload: 0.35,
  ui_click: 0.35,
  ui_panel: 0.3,
  credits_tick: 0.15,
  ui_error: 0.4,
  order_confirm: 0.35,
  ui_ready: 0.35,
  whoosh_space: 0.45,
  tracks_loop: 0.35,
  engine_loop: 0.3,
  rotor_loop: 0.35,
  boat_loop: 0.3,
  footsteps: 0.3,
  ore_dig: 0.3,
  ambient_land: 0.25,
  surf_loop: 0.3,
  fire_loop: 0.5,
};

// Most copies of one clip playing at once (a big fight would otherwise pile
// up dozens of the same gunshot), and the least time between two starts.
const MAX_AT_ONCE = 5;
const MIN_GAP_S = 0.03;

const base = import.meta.env.BASE_URL;
const url = (name: string) => `${base}sfx/${name}.mp3`;

let ctx: AudioContext | null = null;
let master: GainNode | null = null; // everything; the Sounds volume
let world: GainNode | null = null; // sounds from the map (quieter from space)
const bytes = new Map<string, Promise<ArrayBuffer | null>>();
const buffers = new Map<string, AudioBuffer>();
const reversed = new Map<string, AudioBuffer>();
const live = new Map<string, number>();
const lastStart = new Map<string, number>();
const loops = new Map<Loop, { src: AudioBufferSourceNode; gain: GainNode; want: number }>();
// the Sounds volume in Settings (squared, so the slider sounds even)
const sfxVol = () => settings().sfx ** 2;

// Fetch every clip now, while the loading screen is up: they are small.
function fetchAll(): void {
  for (const n of [...SHOTS, ...LOOPS])
    if (!bytes.has(n))
      bytes.set(
        n,
        fetch(url(n))
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null),
      );
}
if (typeof window !== 'undefined') fetchAll();

onAudioUnlock((c) => {
  ctx = c;
  master = c.createGain();
  master.gain.value = sfxVol();
  master.connect(c.destination);
  world = c.createGain();
  world.connect(master);
  for (const [n, p] of bytes)
    void p.then((b) =>
      b
        ? c.decodeAudioData(b).then(
            (buf) => {
              buffers.set(n, buf);
              if ((LOOPS as string[]).includes(n)) startLoop(n as Loop, buf);
            },
            () => undefined,
          )
        : undefined,
    );
});

// mp3 decoding pads a little silence at each end, which would tick at the
// loop point: loop just the part with sound in it (as src/music.ts does).
function soundEdges(buf: AudioBuffer): [number, number] {
  const d = buf.getChannelData(0);
  const scan = Math.min(4800, buf.length >> 2);
  let a = 0;
  while (a < scan && Math.abs(d[a]) < 1e-4) a++;
  let b = buf.length - 1;
  while (b > buf.length - 1 - scan && Math.abs(d[b]) < 1e-4) b--;
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
}

function startLoop(n: Loop, buf: AudioBuffer): void {
  if (!ctx || !world || loops.has(n)) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(world);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  [src.loopStart, src.loopEnd] = soundEdges(buf);
  src.connect(gain);
  // start somewhere in the loop so they don't all line up
  src.start(0, src.loopStart + Math.random() * (src.loopEnd - src.loopStart));
  loops.set(n, { src, gain, want: 0 });
}

function backwards(n: string, buf: AudioBuffer): AudioBuffer {
  let r = reversed.get(n);
  if (!r && ctx) {
    r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
    reversed.set(n, r);
  }
  return r ?? buf;
}

export interface PlayOpts {
  rate?: number; // playback speed (and pitch); 1 is as recorded
  delay?: number; // seconds from now
  reverse?: boolean;
  ui?: boolean; // a button sound: not part of the map, so not quieter from space
}

/** A one-shot at volume vol (0..1, how near it is). */
export function play(n: Sfx, vol = 1, o: PlayOpts = {}): void {
  if (!sfxVol() || !ctx || !master || !world || vol < 0.02) return;
  let buf = buffers.get(n);
  if (!buf) return;
  const t = ctx.currentTime + (o.delay ?? 0);
  const key = n + (o.reverse ? '-r' : '');
  if ((live.get(key) ?? 0) >= MAX_AT_ONCE) return;
  if (!o.delay && t - (lastStart.get(key) ?? -1) < MIN_GAP_S) return;
  lastStart.set(key, t);
  if (o.reverse) buf = backwards(n, buf);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = (o.rate ?? 1) * (0.95 + Math.random() * 0.1);
  const g = ctx.createGain();
  g.gain.value = Math.min(1, vol) * (GAIN[n] ?? 0.5);
  src.connect(g).connect(o.ui ? master : world);
  live.set(key, (live.get(key) ?? 0) + 1);
  src.onended = () => live.set(key, (live.get(key) ?? 1) - 1);
  src.start(t);
}

/** A button sound. */
export function ui(n: Sfx, rate = 1): void {
  play(n, 1, { rate, ui: true });
}

/** How loud a loop should be now (0..1). Call every frame; it glides there. */
export function level(n: Loop, vol: number, rate = 1): void {
  const l = loops.get(n);
  if (!l || !ctx) return;
  const v = Math.max(0, Math.min(1, vol)) * (GAIN[n] ?? 0.5);
  if (Math.abs(v - l.want) > 0.005) {
    l.want = v;
    l.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.25);
  }
  if (Math.abs(l.src.playbackRate.value - rate) > 0.01) l.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.4);
}

/** Up in space the map's sounds fade right down (the buttons don't). */
export function setWorldLevel(v: number): void {
  if (!ctx || !world) return;
  world.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
}

onSettings(() => {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(sfxVol(), t + 0.1);
});
