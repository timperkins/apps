/** Small synthesised sound set, no audio files. */
export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private laserGain?: GainNode;
  private laserOsc?: OscillatorNode;
  private laserOsc2?: OscillatorNode;
  muted = localStorage.getItem('ld-muted') === '1';

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Continuous laser hum, faded in and out.
    this.laserGain = ctx.createGain();
    this.laserGain.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    this.laserOsc = ctx.createOscillator();
    this.laserOsc.type = 'sawtooth';
    this.laserOsc.frequency.value = 160;
    this.laserOsc2 = ctx.createOscillator();
    this.laserOsc2.type = 'square';
    this.laserOsc2.frequency.value = 323;
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 30;
    lfo.connect(lfoG).connect(this.laserOsc.frequency);
    this.laserOsc.connect(f);
    this.laserOsc2.connect(g2).connect(f);
    f.connect(this.laserGain).connect(this.master);
    this.laserOsc.start();
    this.laserOsc2.start();
    lfo.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem('ld-muted', m ? '1' : '0');
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  laser(on: boolean, heat = 0) {
    if (!this.ctx || !this.laserGain || !this.laserOsc) return;
    const t = this.ctx.currentTime;
    this.laserGain.gain.setTargetAtTime(on ? 0.16 : 0, t, on ? 0.015 : 0.05);
    this.laserOsc.frequency.setTargetAtTime(150 + heat * 1.6, t, 0.05);
    this.laserOsc2!.frequency.setTargetAtTime(300 + heat * 3.2, t, 0.05);
  }

  private env(gain: number, attack: number, decay: number, at = 0) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime + at;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master!);
    return { g, t, end: t + attack + decay + 0.05 };
  }

  private tone(type: OscillatorType, f0: number, f1: number, gain: number, decay: number, at = 0) {
    if (!this.ctx) return;
    const { g, t, end } = this.env(gain, 0.005, decay, at);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + decay);
    o.connect(g);
    o.start(t);
    o.stop(end);
  }

  private hiss(freq: number, q: number, gain: number, decay: number, type: BiquadFilterType = 'bandpass', at = 0) {
    if (!this.ctx || !this.noise) return;
    const { g, t, end } = this.env(gain, 0.004, decay, at);
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.5 + Math.random();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    s.connect(f).connect(g);
    s.start(t, Math.random() * 0.5);
    s.stop(end);
  }

  zap() {
    this.hiss(3200, 0.8, 0.9, 0.35);
    this.hiss(900, 1.5, 0.6, 0.25);
    this.tone('square', 1400, 90, 0.25, 0.3);
    this.tone('sawtooth', 2400, 300, 0.12, 0.15, 0.04);
  }
  hit() { this.hiss(1800, 3, 0.25, 0.06); }
  die(big = false) {
    this.tone('square', big ? 120 : 220, 40, 0.35, big ? 0.6 : 0.25);
    this.hiss(600, 1, 0.5, big ? 0.5 : 0.25, 'lowpass');
  }
  hurt() {
    this.tone('sawtooth', 180, 60, 0.4, 0.25);
    this.hiss(400, 1, 0.5, 0.2, 'lowpass');
  }
  bow() { this.hiss(2500, 6, 0.25, 0.08); this.tone('triangle', 700, 300, 0.1, 0.08); }
  dash() { this.hiss(1200, 0.7, 0.45, 0.2, 'highpass'); }
  pickup() { this.tone('triangle', 660, 660, 0.25, 0.12); this.tone('triangle', 990, 990, 0.25, 0.18, 0.08); }
  overheat() { this.hiss(5000, 1, 0.4, 0.6, 'highpass'); this.tone('square', 400, 120, 0.15, 0.5); }
  spawn() { this.tone('sine', 90, 50, 0.25, 0.5); }
  wave() {
    [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.14, 0.2, i * 0.09));
  }
  upgrade() {
    [523, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.25, i * 0.07));
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone('square', f, f * 0.98, 0.18, 0.35, i * 0.2));
  }
}
