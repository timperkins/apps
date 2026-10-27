/** Retro sound effects synthesized with WebAudio, so the game ships no audio files. */
export class Sound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Browsers only allow audio after a user gesture, so call this from a click or key press. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  fire(): void {
    this.tone('square', 720, 160, 0.16, 0.08);
  }

  explosion(radius: number): void {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const dur = 0.25 + radius / 90;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(300, 2400 - radius * 25), ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.5, 0.18 + radius / 200), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  thud(): void {
    this.tone('triangle', 140, 50, 0.12, 0.15);
  }

  click(): void {
    this.tone('square', 1200, 1200, 0.02, 0.03);
  }

  chime(): void {
    [0, 0.09, 0.18].forEach((t, i) => setTimeout(() => this.tone('square', 520 * (1 + i * 0.26), 520 * (1 + i * 0.26), 0.12, 0.06), t * 1000));
  }

  fanfare(): void {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone('square', f, f, 0.18, 0.07), i * 140));
  }

  private ready(): AudioContext | null {
    if (this.muted || !this.ctx) return null;
    return this.ctx;
  }

  private tone(type: OscillatorType, from: number, to: number, dur: number, vol: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }
}
