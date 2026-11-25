// Sound effects for everything, made on the spot with Web Audio (no sound files): tools, machines, guns,
// animals, cars, rockets, plus wind, birds, crickets and cave drips in the background.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('explorer-muted') === '1'; } catch { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('explorer-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 0.7;
}
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.7;
      master.connect(ctx.destination);
    } catch { return; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
let noiseBuf: AudioBuffer | null = null;
function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', delay = 0, q = 1) {
  if (!ctx || !master) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

/** Plays a named sound, quieter the farther away it is (`v` 0..1). */
export function sfx(name: string, v = 1) {
  if (!ctx || muted || v <= 0.02) return;
  const V = Math.min(1, v);
  switch (name) {
    case 'click': tone(900, 0.05, 'square', 0.05 * V); break;
    case 'craft': tone(520, 0.08, 'triangle', 0.12 * V); tone(780, 0.1, 'triangle', 0.1 * V, 0, 0.07); break;
    case 'pick': noise(0.08, 0.3 * V, 2500, 'bandpass', 0, 3); tone(1400, 0.05, 'square', 0.05 * V); break;
    case 'chop': noise(0.1, 0.35 * V, 700, 'bandpass', 0, 2); tone(180, 0.08, 'triangle', 0.15 * V); break;
    case 'treefall': noise(0.6, 0.35 * V, 400, 'lowpass'); tone(120, 0.5, 'sawtooth', 0.08 * V, -60, 0.1); noise(0.3, 0.3 * V, 1500, 'bandpass', 0.35); break;
    case 'rockbreak': noise(0.35, 0.45 * V, 900, 'lowpass'); tone(90, 0.25, 'square', 0.1 * V, -40); break;
    case 'rustle': noise(0.25, 0.2 * V, 3000, 'highpass'); break;
    case 'dig': noise(0.18, 0.35 * V, 500, 'lowpass'); break;
    case 'step': noise(0.05, 0.06 * V, 600, 'lowpass'); break;
    case 'splash': noise(0.3, 0.2 * V, 1200, 'bandpass'); break;
    case 'place': tone(220, 0.08, 'square', 0.1 * V); noise(0.1, 0.25 * V, 800, 'lowpass'); break;
    case 'pickup': tone(660, 0.06, 'triangle', 0.1 * V); tone(990, 0.08, 'triangle', 0.08 * V, 0, 0.05); break;
    case 'drop': tone(400, 0.06, 'triangle', 0.1 * V, -100); break;
    case 'eat': for (let i = 0; i < 3; i++) noise(0.06, 0.25 * V, 1800, 'bandpass', i * 0.12, 2); break;
    case 'nope': tone(200, 0.15, 'square', 0.08 * V, -60); break;
    case 'cash': tone(1200, 0.08, 'square', 0.08 * V); tone(1600, 0.15, 'square', 0.08 * V, 0, 0.08); break;
    case 'gun': noise(0.12, 0.5 * V, 1800, 'bandpass', 0, 0.8); tone(150, 0.08, 'square', 0.12 * V, -80); break;
    case 'sniper': noise(0.35, 0.7 * V, 1200, 'bandpass', 0, 0.6); tone(90, 0.3, 'sawtooth', 0.2 * V, -50); break;
    case 'turret': noise(0.08, 0.3 * V, 2200, 'bandpass', 0, 1); break;
    case 'flame': noise(0.25, 0.25 * V, 600, 'lowpass'); break;
    case 'throw': noise(0.15, 0.15 * V, 2000, 'highpass'); break;
    case 'rocketfire': noise(0.6, 0.4 * V, 500, 'lowpass'); tone(300, 0.5, 'sawtooth', 0.08 * V, 400); break;
    case 'boom': noise(0.9, 0.9 * V, 300, 'lowpass'); tone(60, 0.6, 'sine', 0.4 * V, -30); break;
    case 'hit': tone(240, 0.07, 'square', 0.1 * V, -80); noise(0.06, 0.2 * V, 1000); break;
    case 'poof': noise(0.4, 0.3 * V, 2400, 'highpass'); tone(700, 0.25, 'sine', 0.1 * V, 500); break;
    case 'ouch': tone(330, 0.15, 'square', 0.12 * V, -120); break;
    case 'knockout': tone(440, 0.2, 'triangle', 0.15 * V, -200); tone(330, 0.3, 'triangle', 0.15 * V, -200, 0.2); tone(220, 0.5, 'triangle', 0.15 * V, -100, 0.45); break;
    case 'whistle': tone(2400, 0.15, 'sine', 0.12 * V); tone(2400, 0.3, 'sine', 0.12 * V, 0, 0.2); break;
    case 'squish': noise(0.15, 0.3 * V, 400, 'lowpass'); tone(160, 0.12, 'sine', 0.12 * V, -60); break;
    case 'drill': tone(110, 0.25, 'sawtooth', 0.04 * V, 20); noise(0.2, 0.06 * V, 1500); break;
    case 'crush': noise(0.3, 0.25 * V, 300, 'lowpass'); break;
    case 'grab': tone(500, 0.1, 'square', 0.06 * V, 300); break;
    case 'door': tone(180, 0.1, 'square', 0.08 * V); noise(0.08, 0.15 * V, 600, 'lowpass', 0.08); break;
    case 'carstart': for (let i = 0; i < 4; i++) tone(70 + i * 15, 0.15, 'sawtooth', 0.12 * V, 10, i * 0.12); break;
    case 'cave': noise(0.8, 0.1 * V, 200, 'lowpass'); break;
    case 'whoosh': noise(0.6, 0.25 * V, 900, 'bandpass', 0, 0.5); break;
    case 'countdown': for (let i = 0; i < 5; i++) tone(i === 4 ? 1100 : 660, 0.12, 'square', 0.1 * V, 0, i); break;
    case 'liftoff': noise(3.5, 0.8 * V, 250, 'lowpass'); tone(50, 3, 'sawtooth', 0.15 * V, 30); break;
    case 'engine': tone(80, 1.2, 'sawtooth', 0.12 * V, 60); break;
    case 'arrive': tone(523, 0.15, 'triangle', 0.15 * V); tone(659, 0.15, 'triangle', 0.15 * V, 0, 0.15); tone(784, 0.3, 'triangle', 0.15 * V, 0, 0.3); break;
    // animals
    case 'growl': tone(110, 0.5, 'sawtooth', 0.12 * V, -30); noise(0.5, 0.1 * V, 300, 'lowpass'); break;
    case 'roar': tone(140, 0.8, 'sawtooth', 0.18 * V, -80); noise(0.8, 0.2 * V, 500, 'lowpass'); break;
    case 'chirp': tone(2200, 0.06, 'sine', 0.08 * V, 600); tone(2600, 0.06, 'sine', 0.08 * V, 600, 0.09); break;
    case 'squeak': tone(1500, 0.08, 'sine', 0.07 * V, 400); break;
    case 'moo': tone(140, 0.7, 'sawtooth', 0.08 * V, -30); break;
    case 'chitter': for (let i = 0; i < 4; i++) tone(1800 + Math.random() * 800, 0.03, 'square', 0.05 * V, 0, i * 0.05); break;
    case 'hiss': noise(0.5, 0.15 * V, 5000, 'highpass'); break;
    case 'bark': tone(420, 0.08, 'square', 0.12 * V, -150); tone(420, 0.08, 'square', 0.12 * V, -150, 0.14); break;
    case 'meow': tone(700, 0.35, 'triangle', 0.1 * V, 300); break;
    case 'voice': for (let i = 0; i < 3; i++) tone(200 + Math.random() * 120, 0.08, 'triangle', 0.06 * V, 0, i * 0.1); break;
  }
}

// ---------- background sounds ----------
let ambT = 0;
let engine: { o: OscillatorNode; g: GainNode } | null = null;
export function ambience(dt: number, where: 'day' | 'night' | 'cave' | 'space' | 'water', carSpeed: number) {
  if (!ctx || !master || muted) return;
  ambT -= dt;
  if (ambT <= 0) {
    ambT = 1.5 + Math.random() * 3;
    if (where === 'day') { if (Math.random() < 0.6) sfx('chirp', 0.5); noise(2, 0.03, 400, 'lowpass'); }
    else if (where === 'night') { for (let i = 0; i < 6; i++) tone(4200, 0.03, 'sine', 0.02, 0, i * 0.08); }
    else if (where === 'cave') { tone(1200 + Math.random() * 600, 0.15, 'sine', 0.04, -600); }
    else if (where === 'space') { tone(60, 3, 'sine', 0.03); }
    else if (where === 'water') sfx('splash', 0.4);
  }
  // car engine hum
  if (carSpeed > 0) {
    if (!engine) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      g.gain.value = 0;
      o.connect(g).connect(master);
      o.start();
      engine = { o, g };
    }
    engine.o.frequency.value = 45 + carSpeed * 5;
    engine.g.gain.value = 0.035;
  } else if (engine) {
    engine.g.gain.value = 0;
  }
}
export function stopAudio() {
  if (engine) { engine.o.stop(); engine = null; }
}
