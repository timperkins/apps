// Playing clips on the Audio page. Every clip is fetched and decoded up front
// (a few at a time) so its length can be shown; decoding needs no tap, so it
// happens on an offline context. Playing needs a real one, which phones only
// allow after a tap: it starts on the first press of a play button.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
function unlock(): void {
  if (ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
}
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });

const decoder = new OfflineAudioContext(2, 1, 44100);
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const reversed = new Map<string, AudioBuffer>();
const queue: (() => void)[] = [];
let busy = 0;

/** The clip at url, decoded (null if it won't load). */
export function load(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = new Promise<AudioBuffer | null>((res) => {
      const go = (): void => {
        busy++;
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((b) => decoder.decodeAudioData(b))
          .then(res, () => res(null))
          .finally(() => {
            busy--;
            queue.shift()?.();
          });
      };
      if (busy < 4) go();
      else queue.push(go);
    });
    buffers.set(url, p);
  }
  return p;
}

// mp3 decoding pads a little silence at each end: a loop plays just the part
// with sound in it, as the game does.
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

function backwards(url: string, buf: AudioBuffer): AudioBuffer {
  let r = reversed.get(url);
  if (!r) {
    r = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: buf.length, sampleRate: buf.sampleRate });
    for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
    reversed.set(url, r);
  }
  return r;
}

export interface PlayOpts {
  rate?: number;
  reverse?: boolean;
  loop?: boolean;
  gain?: number;
}

export interface Playing {
  stop(): void;
  /** 0..1 through the clip (wrapping for a loop). */
  progress(): number;
  ended: Promise<void>;
}

let current: { p: Playing; onStop: () => void } | null = null;

/** Play a clip, stopping whatever was playing. onStop runs when it ends or is stopped. */
export async function play(url: string, o: PlayOpts, onStop: () => void): Promise<Playing | null> {
  stopAll();
  unlock();
  const buf = await load(url);
  if (!buf || !ctx || !out) {
    onStop();
    return null;
  }
  if (ctx.state === 'suspended') await ctx.resume();
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = o.reverse ? backwards(url, buf) : buf;
  const rate = o.rate ?? 1;
  src.playbackRate.value = rate;
  let from = 0;
  let span = buf.duration;
  if (o.loop) {
    const [a, b] = soundEdges(buf);
    src.loop = true;
    src.loopStart = a;
    src.loopEnd = b;
    from = a;
    span = b - a;
  }
  const g = c.createGain();
  g.gain.value = o.gain ?? 1;
  src.connect(g).connect(out);
  const t0 = c.currentTime;
  src.start(t0, from);
  let done = false;
  let resolve!: () => void;
  const ended = new Promise<void>((r) => (resolve = r));
  const finish = (): void => {
    if (done) return;
    done = true;
    if (current?.p === p) current = null;
    onStop();
    resolve();
  };
  src.onended = finish;
  const p: Playing = {
    stop() {
      try {
        src.stop();
      } catch {
        /* already ended */
      }
      finish();
    },
    progress() {
      const k = ((c.currentTime - t0) * rate) / span;
      return o.loop ? k % 1 : Math.min(1, k);
    },
    ended,
  };
  current = { p, onStop };
  return p;
}

export function stopAll(): void {
  current?.p.stop();
  current = null;
}

/** Audio is allowed yet (there has been a tap). */
export const unlocked = (): boolean => !!ctx;
