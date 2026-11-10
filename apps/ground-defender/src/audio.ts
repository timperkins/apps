// All sound is synthesised with Web Audio, so the game ships with no audio files.

type AnyPlaneType = 'heavy' | 'light' | 'fighter' | 'recon' | 'cargo' | 'boss';

interface Engine { o1: OscillatorNode; o2: OscillatorNode; lfo: OscillatorNode; g: GainNode; p: StereoPannerNode; fl: BiquadFilterNode; hz: number; }

let ctx: AudioContext | null = null;
let master: GainNode, sfx: GainNode, musicBus: GainNode, noiseBuf: AudioBuffer, windNode: BiquadFilterNode | null = null, windGain: GainNode | null = null;
const engines = new Map<number, Engine>();
const ENGINE_HZ: Record<AnyPlaneType, number> = { heavy: 52, light: 74, fighter: 108, recon: 88, cargo: 62, boss: 40 };

export const Sound = {
  soundOn: true, musicOn: true,

  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = .0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.startWind();
    this.startMusic();
  },
  apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfx.gain.setTargetAtTime(this.soundOn ? 1 : 0, t, .05);
    musicBus.gain.setTargetAtTime(this.musicOn ? .55 : 0, t, .4);
  },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

  noise(dur: number, filterType: BiquadFilterType, freq: number, q: number, gain: number, pan = 0, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = .8 + Math.random() * .4;
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = freq; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(fl); fl.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(sfx); } else g.connect(sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + .05);
    return fl;
  },
  tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, pan = 0, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .008); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(sfx); } else g.connect(sfx);
    o.start(t); o.stop(t + dur + .05);
  },

  // A low, satisfying thump for each shell.
  thump() { this.tone('sine', 130, 38, .32, .55); this.noise(.12, 'lowpass', 900, .7, .35); this.tone('triangle', 70, 30, .2, .25); },
  missile() { this.noise(.9, 'bandpass', 1400, 1.2, .25); this.tone('sawtooth', 300, 900, .5, .05); },
  flak(dist = .5, pan = 0) { const g = .28 * (1 - dist * .7); this.noise(.5, 'lowpass', 1200 - dist * 700, .8, g, pan); this.tone('sine', 90, 40, .3, g * .6, pan); },
  boom(big = false, pan = 0) { this.noise(big ? 1.6 : 1.0, 'lowpass', big ? 500 : 800, .6, big ? .8 : .5, pan); this.tone('sine', big ? 70 : 90, 25, big ? 1.2 : .7, big ? .7 : .45, pan); },
  hitPlane(pan = 0) { this.noise(.18, 'bandpass', 2200, 2, .25, pan); this.tone('square', 420, 180, .08, .05, pan); },
  intercept(pan = 0) { this.noise(.4, 'bandpass', 1500, 1, .32, pan); this.tone('sine', 660, 990, .12, .06, pan); },
  minigun(pan = 0) { for (let i = 0; i < 6; i++) this.noise(.05, 'highpass', 1800, .7, .14, pan, i * .07); },
  pop() { this.tone('sine', 520, 880, .18, .2); this.tone('sine', 780, 1320, .22, .12, 0, .08); },
  ui() { this.tone('sine', 700, 900, .07, .12); },
  denied() { this.tone('square', 220, 150, .2, .08); },
  click() { this.tone('square', 1600, 1200, .03, .05); },
  lockStep(k: number) { this.tone('sine', 600 + k * 500, 620 + k * 500, .07, .08); },
  locked() { this.tone('sine', 1250, 1250, .2, .1); },
  rocket() { this.noise(.7, 'bandpass', 900, .9, .3); this.tone('sawtooth', 160, 520, .35, .05); this.tone('sine', 110, 40, .25, .3); },
  fireball() { this.noise(.45, 'lowpass', 700, .8, .3); this.tone('triangle', 320, 140, .3, .1); },
  sonic() { this.tone('sine', 220, 55, .7, .35); this.tone('sine', 1100, 260, .45, .06); this.noise(.3, 'bandpass', 500, 3, .12); },
  // a short buzz, repeated while the beam is on
  lightning() { this.noise(.35, 'highpass', 2600, .8, .3); this.tone('sawtooth', 1800, 140, .25, .07); this.tone('square', 90, 50, .2, .12); },
  shield() { this.tone('sine', 300, 900, .6, .14); this.tone('sine', 450, 1350, .6, .08, 0, .05); },
  laser() { this.tone('sawtooth', 1180, 1120, .12, .025); this.tone('sine', 2350, 2300, .12, .02); },
  nuke(pan = 0) { this.boom(true, pan); this.noise(3.2, 'lowpass', 260, .5, .9, pan); this.tone('sine', 55, 18, 2.8, .8, pan); },
  alarm() { this.tone('sawtooth', 400, 300, .25, .05); },

  whine(dur: number, pan: number) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(720, t + dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + dur * .9); g.gain.linearRampToValueAtTime(0, t + dur + .4);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(fl); fl.connect(g); g.connect(p); p.connect(sfx);
    o.start(t); o.stop(t + dur + .5);
  },

  // Each plane gets its own drone, panned to its position relative to the aim.
  engine(id: number, type: AnyPlaneType, gain: number, pan: number) {
    if (!ctx) return;
    let e = engines.get(id);
    if (!e) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      const hz = ENGINE_HZ[type] * (.95 + Math.random() * .1);
      o1.frequency.value = hz; o2.frequency.value = hz * 1.012;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6 + Math.random() * 4;
      const lg = ctx.createGain(); lg.gain.value = hz * .015; lfo.connect(lg); lg.connect(o1.frequency);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420; fl.Q.value = 1;
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createStereoPanner();
      o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(p); p.connect(sfx);
      o1.start(); o2.start(); lfo.start();
      e = { o1, o2, lfo, g, p, fl, hz };
      engines.set(id, e);
    }
    const t = ctx.currentTime;
    e.g.gain.setTargetAtTime(gain, t, .15);
    e.p.pan.setTargetAtTime(pan, t, .1);
    return e;
  },
  enginePitch(id: number, k: number) { const e = engines.get(id); if (e && ctx) { e.o1.frequency.setTargetAtTime(e.hz * k, ctx.currentTime, .3); e.o2.frequency.setTargetAtTime(e.hz * k * 1.012, ctx.currentTime, .3); } },
  stopEngine(id: number) {
    const e = engines.get(id); if (!e || !ctx) return;
    engines.delete(id);
    const t = ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, .2);
    for (const o of [e.o1, e.o2, e.lfo]) o.stop(t + 1);
  },
  stopAllEngines() { for (const id of [...engines.keys()]) this.stopEngine(id); },

  startWind() {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 380; fl.Q.value = .6;
    windGain = ctx.createGain(); windGain.gain.value = .035;
    const lfo = ctx.createOscillator(); lfo.frequency.value = .11;
    const lg = ctx.createGain(); lg.gain.value = .02; lfo.connect(lg); lg.connect(windGain.gain);
    src.connect(fl); fl.connect(windGain); windGain.connect(sfx);
    src.start(); lfo.start();
    windNode = fl;
  },
  setWind(strength: number) { if (ctx && windGain && windNode) { windGain.gain.setTargetAtTime(.03 + Math.abs(strength) * .05, ctx.currentTime, 1); windNode.frequency.setTargetAtTime(340 + Math.abs(strength) * 200, ctx.currentTime, 1); } },

  // Calm generative music: slow pad chords with the odd soft bell on top.
  startMusic() {
    if (!ctx) return;
    const ac = ctx;
    const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]];
    const scale = [69, 72, 74, 76, 79, 81, 84];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const rev = ac.createDelay(); rev.delayTime.value = .38;
    const fb = ac.createGain(); fb.gain.value = .35; rev.connect(fb); fb.connect(rev);
    const wet = ac.createGain(); wet.gain.value = .4; rev.connect(wet); wet.connect(musicBus);
    let i = 0;
    const play = () => {
      if (!ctx) return;
      const t = ac.currentTime, ch = chords[i++ % chords.length], len = 8;
      for (const m of ch) {
        const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m - 12);
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + 2.5); g.gain.linearRampToValueAtTime(.03, t + len - 1.5); g.gain.linearRampToValueAtTime(0, t + len + 1.5);
        const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
        o.connect(fl); fl.connect(g); g.connect(musicBus); g.connect(rev);
        o.start(t); o.stop(t + len + 2);
      }
      for (let k = 0; k < 3; k++) {
        if (Math.random() < .55) {
          const tt = t + 1 + k * 2.3 + Math.random() * .8, m = scale[Math.floor(Math.random() * scale.length)];
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
          const g = ac.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.04, tt + .02); g.gain.exponentialRampToValueAtTime(.0005, tt + 2.6);
          o.connect(g); g.connect(musicBus); g.connect(rev);
          o.start(tt); o.stop(tt + 2.8);
        }
      }
      setTimeout(play, len * 1000);
    };
    play();
  },
};
