// Background music: one of three loops is always playing, picked by what is
// going on (see IsoGame.mood()).
//   battle: a fight involving your side
//   shroud: your troops out moving away from the base
//   base:   everything else, quieter so it stays out of the way
// The loops are in public/music/. They load after the first tap (on the
// audio context src/voice.ts starts) and crossfade when the mood changes.

import { onAudioUnlock } from './voice';
import { onSettings, settings } from './settings';

export type Mood = 'battle' | 'shroud' | 'base';

const MOODS: Mood[] = ['base', 'battle', 'shroud'];
const VOLUME: Record<Mood, number> = { battle: 1, shroud: 1, base: 0.5 };
const FADE_S = 2.5;

const base = import.meta.env.BASE_URL;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<Mood, AudioBuffer>();
const playing = new Map<Mood, { src: AudioBufferSourceNode; gain: GainNode }>();
let want: Mood = 'base';
let on: Mood | null = null;
// the game is paused: the music fades out until it goes on again
let hushed = false;
// the Music volume in Settings (squared, so the slider sounds even)
const level = () => (hushed ? 0 : settings().music ** 2);

// mp3 decoding pads a little silence at each end, which would tick at the
// loop point: loop just the part with sound in it.
function soundEdges(buf: AudioBuffer): [number, number] {
  const ch = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  const loud = (i: number) => ch.some((d) => Math.abs(d[i]) > 1e-4);
  const scan = Math.min(4800, buf.length >> 2);
  let a = 0;
  while (a < scan && !loud(a)) a++;
  let b = buf.length - 1;
  while (b > buf.length - 1 - scan && !loud(b)) b--;
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
}

function play(m: Mood): void {
  if (!ctx || !master) return;
  const buf = buffers.get(m);
  if (!buf) return;
  const t = ctx.currentTime;
  // fade the others out
  for (const [k, p] of playing) {
    if (k === m) continue;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + FADE_S);
    p.src.stop(t + FADE_S + 0.05);
    playing.delete(k);
  }
  on = m;
  if (playing.has(m)) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(VOLUME[m], t + FADE_S);
  gain.connect(master);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  [src.loopStart, src.loopEnd] = soundEdges(buf);
  src.connect(gain);
  src.start(t, src.loopStart);
  playing.set(m, { src, gain });
}

onAudioUnlock((c) => {
  ctx = c;
  master = c.createGain();
  master.gain.value = level();
  master.connect(c.destination);
  // the one wanted now first, then the rest
  const order = [want, ...MOODS.filter((m) => m !== want)];
  let p = Promise.resolve();
  for (const m of order) {
    p = p.then(() =>
      fetch(`${base}music/${m}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => c.decodeAudioData(b))
        .then((buf) => {
          buffers.set(m, buf);
          if (m === want && on !== want) play(m);
        })
        .catch(() => undefined),
    );
  }
});

/** Call every frame with what is going on; the music follows it. */
export function setMood(m: Mood): void {
  want = m;
  if (on !== m && buffers.has(m)) play(m);
}

function rampMaster(s: number): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(level(), t + s);
}

onSettings(() => rampMaster(0.15));

/** Pausing the game fades the music out; going on again fades it back in. */
export function setMusicPaused(p: boolean): void {
  if (p === hushed) return;
  hushed = p;
  rampMaster(p ? 0.4 : 1);
}
