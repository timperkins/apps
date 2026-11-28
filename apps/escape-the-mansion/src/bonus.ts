// Bonus level after level 50: Lenny takes Jeff's limo down the drive while the mansion burns.
import { jeffSprite, lennySprite } from './sprites';
import { Rng } from './rng';
import type { Input } from './game';

const W = 340; // world width
const ROAD = 132; // road width
const LENGTH = 5200; // distance to the gate
const GATE_Y = LENGTH;

type ObKind = 'guard' | 'dog' | 'barrel' | 'cone' | 'coin' | 'fountain';
interface Ob {
  kind: ObKind;
  x: number;
  y: number;
  vx: number;
  hit: boolean;
  t: number;
  fly: number; // knocked flying
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  max: number;
  c: string;
  r: number;
}

export type BonusEvent = { type: 'sfx'; name: string } | { type: 'say'; who: 'jeff' | 'lenny'; text: string } | { type: 'done'; coins: number; time: number; bumps: number };

export const roadX = (y: number) => W / 2 + Math.sin(y / 420) * 70 + Math.sin(y / 170) * 18;

export class Bonus {
  phase: 'intro' | 'drive' | 'gate' | 'done' = 'intro';
  t = 0;
  x = roadX(120);
  y = 120;
  vy = 0;
  steer = 0;
  ang = 0;
  coins = 0;
  bumps = 0;
  obs: Ob[] = [];
  sparks: Spark[] = [];
  events: BonusEvent[] = [];
  jeffY = -20; // Jeff chasing in his golf cart
  jeffX = roadX(-20);
  honk = 0;
  shake = 0;
  rng = new Rng(4242);
  fire = 0; // how much of the mansion is burning
  driveT = 0;
  said = new Set<string>();

  constructor() {
    const r = this.rng;
    for (let y = 700; y < LENGTH - 300; y += 70 + r.next() * 90) {
      const roll = r.next();
      const cx = roadX(y);
      if (roll < 0.33) this.obs.push({ kind: 'coin', x: cx + (r.next() - 0.5) * (ROAD - 30), y, vx: 0, hit: false, t: 0, fly: 0 });
      else if (roll < 0.58) this.obs.push({ kind: 'guard', x: cx + (r.chance(0.5) ? -1 : 1) * (ROAD / 2 + 20), y, vx: 0, hit: false, t: r.next() * 3, fly: 0 });
      else if (roll < 0.72) this.obs.push({ kind: 'dog', x: cx + (r.chance(0.5) ? -1 : 1) * (ROAD / 2 + 24), y, vx: 0, hit: false, t: 0, fly: 0 });
      else if (roll < 0.88) this.obs.push({ kind: 'barrel', x: cx + (r.next() - 0.5) * (ROAD - 40), y, vx: 0, hit: false, t: 0, fly: 0 });
      else this.obs.push({ kind: 'cone', x: cx + (r.next() - 0.5) * (ROAD - 30), y, vx: 0, hit: false, t: 0, fly: 0 });
      if (r.chance(0.35)) this.obs.push({ kind: 'coin', x: cx + (r.next() - 0.5) * (ROAD - 30), y: y + 30, vx: 0, hit: false, t: 0, fly: 0 });
    }
    this.obs.push({ kind: 'fountain', x: roadX(2600), y: 2600, vx: 0, hit: false, t: 0, fly: 0 });
  }

  private say(who: 'jeff' | 'lenny', text: string) {
    this.events.push({ type: 'say', who, text });
  }

  update(dt: number, input: Input) {
    dt = Math.min(dt, 1 / 20);
    this.events.length = 0;
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 2);
    this.honk = Math.max(0, this.honk - dt);
    this.fire = Math.min(1, this.fire + dt * (this.phase === 'intro' ? 0.25 : 0.05));
    this.updateSparks(dt);

    if (this.phase === 'intro') {
      const once = (k: string, at: number, f: () => void) => {
        if (this.t >= at && !this.said.has(k)) {
          this.said.add(k);
          f();
        }
      };
      once('toss', 0.4, () => this.events.push({ type: 'sfx', name: 'whoosh' }));
      once('jeff', 1.2, () => this.say('jeff', 'MY HOUSE! My beautiful, beautiful house! My SPOONS!'));
      once('lenny', 3.4, () => this.say('lenny', 'Keys were in the limo, Jeff. Thanks for the ride.'));
      if (this.t > 5.6 || (input.action && this.t > 1.5)) {
        this.phase = 'drive';
        this.events.push({ type: 'sfx', name: 'engine' });
      }
      return;
    }

    if (this.phase === 'gate' || this.phase === 'done') {
      this.y += this.vy * dt;
      this.vy = Math.max(0, this.vy - 120 * dt);
      if (this.phase === 'gate' && this.vy <= 1) {
        this.phase = 'done';
        this.events.push({ type: 'done', coins: this.coins, time: this.driveT, bumps: this.bumps });
      }
      return;
    }

    this.driveT += dt;
    // steering and speed: down speeds up, up brakes
    const want = 220 + Math.max(0, input.my) * 90 - Math.max(0, -input.my) * 130;
    this.vy += (want - this.vy) * Math.min(1, dt * 1.5);
    const off = Math.abs(this.x - roadX(this.y)) > ROAD / 2 - 8;
    if (off) {
      this.vy = Math.min(this.vy, 120);
      if (Math.random() < 0.5) this.spark(this.x + (Math.random() - 0.5) * 20, this.y + 20, '#5a7a3a', 1.5);
    }
    this.steer += (input.mx - this.steer) * Math.min(1, dt * 8);
    this.x += this.steer * 170 * dt;
    this.x = Math.max(22, Math.min(W - 22, this.x));
    this.ang = this.steer * 0.35;
    this.y += this.vy * dt;

    if (input.action && this.honk <= 0) {
      this.honk = 0.6;
      this.events.push({ type: 'sfx', name: 'horn' });
      // guards and dogs ahead dive out of the way
      for (const o of this.obs)
        if ((o.kind === 'guard' || o.kind === 'dog') && !o.hit && o.y > this.y && o.y - this.y < 260) o.vx = (o.x < roadX(o.y) ? -1 : 1) * 160;
    }

    // Jeff in his golf cart, never quite fast enough
    const jt = this.y - 150 - Math.sin(this.driveT * 0.7) * 40;
    this.jeffY += (jt - this.jeffY) * Math.min(1, dt * 0.8);
    this.jeffX += (roadX(this.jeffY) - this.jeffX) * Math.min(1, dt * 2);
    if (this.driveT > 4 && Math.floor(this.driveT / 6) !== Math.floor((this.driveT - dt) / 6)) {
      const lines = ['Come back with my LIMO!', 'That car has heated seats! For ME!', 'I will buy a FASTER golf cart!', 'You are scratching the paint!', 'The mini-bar is MINE!', 'Lenny! LENNY! At least leave the hood ornament!'];
      this.say('jeff', lines[Math.floor(this.driveT / 6) % lines.length]);
    }

    for (const o of this.obs) {
      o.t += dt;
      if (o.fly > 0) {
        o.fly += dt;
        o.y += 200 * dt;
        o.x += o.vx * dt;
        continue;
      }
      if (o.hit) continue;
      if (o.kind === 'guard' || o.kind === 'dog') {
        // run across the road when the limo gets near
        const d = o.y - this.y;
        if (o.vx === 0 && d < 330 && d > 0) o.vx = (o.x < roadX(o.y) ? 1 : -1) * (o.kind === 'dog' ? 120 : 75);
        o.x += o.vx * dt;
      }
      const dx = Math.abs(o.x - this.x);
      const dy = Math.abs(o.y - this.y);
      const hitW = o.kind === 'fountain' ? 34 : o.kind === 'coin' ? 16 : 18;
      const hitH = o.kind === 'fountain' ? 46 : 32;
      if (dx < hitW && dy < hitH) {
        if (o.kind === 'coin') {
          o.hit = true;
          this.coins++;
          this.events.push({ type: 'sfx', name: 'pickup' });
          for (let i = 0; i < 6; i++) this.spark(o.x, o.y, '#ffd34d', 1);
        } else if (o.kind === 'fountain') {
          // bounce off to the side of it
          this.x = o.x + (this.x >= o.x ? 1 : -1) * (hitW + 3);
          this.vy *= 0.4;
          this.bumps++;
          this.shake = 0.6;
          this.events.push({ type: 'sfx', name: 'splat' });
          for (let i = 0; i < 20; i++) this.spark(this.x, this.y - 10, '#8fd0ff', 2);
        } else {
          o.hit = true;
          o.fly = 0.01;
          o.vx = (o.x < this.x ? -1 : 1) * 140;
          this.bumps++;
          this.vy *= 0.6;
          this.shake = 0.35;
          this.events.push({ type: 'sfx', name: o.kind === 'dog' ? 'yelp' : o.kind === 'guard' ? 'bonk' : 'clack' });
          for (let i = 0; i < 8; i++) this.spark(o.x, o.y, o.kind === 'barrel' ? '#6a4428' : '#ffffff', 1.5);
        }
      }
    }
    this.obs = this.obs.filter((o) => o.y > this.y - 400 && (o.fly < 1.5 || o.fly === 0));

    if (this.y >= GATE_Y - 40) {
      this.phase = 'gate';
      this.events.push({ type: 'sfx', name: 'gate' });
      this.shake = 0.8;
      for (let i = 0; i < 30; i++) this.spark(this.x, this.y, '#c0c0c0', 3);
      this.say('lenny', 'FREEDOM!');
    }
  }

  private spark(x: number, y: number, c: string, sp: number) {
    this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 120 * sp, vy: (Math.random() - 0.8) * 120 * sp, t: 0, max: 0.4 + Math.random() * 0.5, c, r: 1 + Math.random() * 2 });
  }
  private updateSparks(dt: number) {
    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 200 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.t < s.max);
  }

  progress() {
    return Math.max(0, Math.min(1, this.y / GATE_Y));
  }

  // ---------------------------------------------------------------- drawing

  draw(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, dpr: number) {
    const s = Math.min(cssW / W, cssH / 300) * 1.05;
    const viewH = cssH / s;
    const ox = (cssW / s - W) / 2;
    let camY = this.phase === 'intro' ? -250 : this.y - viewH * 0.32;
    camY = Math.max(-260, camY);
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 8 : 0;
    ctx.setTransform(s * dpr, 0, 0, s * dpr, (ox + sh) * s * dpr, -camY * s * dpr);
    ctx.imageSmoothingEnabled = false;

    // grass
    ctx.fillStyle = '#16220f';
    ctx.fillRect(-ox - 20, camY - 20, W + ox * 2 + 40, viewH + 40);
    const y0 = Math.floor(camY / 16) * 16;
    for (let y = y0; y < camY + viewH + 16; y += 16) {
      const cx = roadX(y);
      // road
      ctx.fillStyle = '#4a463e';
      ctx.fillRect(cx - ROAD / 2, y, ROAD, 17);
      ctx.fillStyle = '#3a362e';
      ctx.fillRect(cx - ROAD / 2, y, 4, 17);
      ctx.fillRect(cx + ROAD / 2 - 4, y, 4, 17);
      if ((y / 16) % 3 === 0) {
        ctx.fillStyle = '#5a564c';
        ctx.fillRect(cx - 1, y, 2, 8);
      }
      // hedges along the drive
      ctx.fillStyle = '#123012';
      ctx.fillRect(cx - ROAD / 2 - 26, y, 14, 17);
      ctx.fillRect(cx + ROAD / 2 + 12, y, 14, 17);
      ctx.fillStyle = '#1e4a1c';
      ctx.fillRect(cx - ROAD / 2 - 26, y, 14, 3);
      ctx.fillRect(cx + ROAD / 2 + 12, y, 14, 3);
      // lamp posts
      if (y % 320 === 0) {
        for (const lx of [cx - ROAD / 2 - 6, cx + ROAD / 2 + 6]) {
          ctx.fillStyle = '#111';
          ctx.fillRect(lx - 1, y - 10, 2, 14);
          ctx.fillStyle = '#ffe08a';
          ctx.fillRect(lx - 2, y - 13, 4, 4);
          ctx.fillStyle = 'rgba(255,220,140,0.08)';
          ctx.beginPath();
          ctx.arc(lx, y, 34, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    this.drawMansion(ctx);

    // gate at the end
    const gx = roadX(GATE_Y);
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(gx - ROAD / 2 - 30, GATE_Y - 6, 30, 12);
    ctx.fillRect(gx + ROAD / 2, GATE_Y - 6, 30, 12);
    if (this.phase === 'drive' || this.phase === 'intro') {
      for (let x = gx - ROAD / 2; x < gx + ROAD / 2; x += 7) ctx.fillRect(x, GATE_Y - 4, 3, 8);
      ctx.fillRect(gx - ROAD / 2, GATE_Y - 1, ROAD, 2);
    } else {
      // burst open
      ctx.save();
      ctx.translate(gx - ROAD / 2, GATE_Y);
      ctx.rotate(1.1);
      for (let x = 0; x < ROAD / 2; x += 7) ctx.fillRect(x, -4, 3, 8);
      ctx.restore();
      ctx.save();
      ctx.translate(gx + ROAD / 2, GATE_Y);
      ctx.rotate(-1.1);
      for (let x = -ROAD / 2; x < 0; x += 7) ctx.fillRect(x, -4, 3, 8);
      ctx.restore();
    }
    ctx.font = '10px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dff9a';
    ctx.fillText('THE WORLD', gx, GATE_Y + 26);

    // obstacles
    for (const o of this.obs) {
      if (o.hit && o.fly === 0) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.fly) ctx.rotate(o.fly * 12);
      this.drawOb(ctx, o);
      ctx.restore();
    }

    // Jeff's golf cart behind
    if (this.phase !== 'intro') this.drawCart(ctx, this.jeffX, this.jeffY);

    // the limo
    if (this.phase !== 'intro' || this.t > 4.2) this.drawLimo(ctx, this.x, this.y, this.phase === 'intro' ? 0 : this.ang);

    for (const sp of this.sparks) {
      ctx.globalAlpha = 1 - sp.t / sp.max;
      ctx.fillStyle = sp.c;
      ctx.fillRect(sp.x, sp.y, sp.r, sp.r);
    }
    ctx.globalAlpha = 1;

    // night + firelight
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, cssH * dpr);
    const fireNear = Math.max(0, 1 - (camY + 260) / 1400) * this.fire;
    g.addColorStop(0, `rgba(255,90,20,${0.18 * fireNear})`);
    g.addColorStop(0.5, 'rgba(5,10,30,0.25)');
    g.addColorStop(1, 'rgba(5,10,30,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);

    // HUD: coins and distance to the gate
    if (this.phase !== 'intro') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bw = Math.min(260, cssW - 120);
      const bx = (cssW - bw) / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 2, 14, bw + 4, 10);
      ctx.fillStyle = '#7dff9a';
      ctx.fillRect(bx, 16, bw * this.progress(), 6);
      ctx.font = '20px "VT323", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd34d';
      ctx.fillText('Coins: ' + this.coins, 12, 24);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8e0d0';
      ctx.fillText('to the gate', cssW / 2, 42);
    }
  }

  private drawMansion(ctx: CanvasRenderingContext2D) {
    const t = this.t;
    const x0 = 30;
    const y0 = -230;
    // body
    ctx.fillStyle = '#1a1418';
    ctx.fillRect(x0, y0 + 60, W - 60, 170);
    ctx.fillRect(x0 + 40, y0 + 20, 80, 50);
    ctx.fillRect(W - x0 - 120, y0 + 20, 80, 50);
    // roofs
    ctx.fillStyle = '#0e0a0c';
    for (const [rx, rw] of [
      [x0 - 6, W - 48],
      [x0 + 34, 92],
      [W - x0 - 126, 92],
    ]) {
      ctx.beginPath();
      ctx.moveTo(rx, rx === x0 - 6 ? y0 + 62 : y0 + 22);
      ctx.lineTo(rx + rw / 2, rx === x0 - 6 ? y0 + 30 : y0 - 8);
      ctx.lineTo(rx + rw, rx === x0 - 6 ? y0 + 62 : y0 + 22);
      ctx.fill();
    }
    // tower
    ctx.fillStyle = '#1a1418';
    ctx.fillRect(W / 2 - 16, y0 - 30, 32, 100);
    ctx.fillStyle = '#0e0a0c';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 20, y0 - 28);
    ctx.lineTo(W / 2, y0 - 70);
    ctx.lineTo(W / 2 + 20, y0 - 28);
    ctx.fill();
    // windows glowing with fire
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 9; c++) {
        const wx = x0 + 14 + c * 30;
        const wy = y0 + 78 + r * 36;
        const burning = (c * 7 + r * 3) % 10 < this.fire * 10;
        const fl = 0.6 + 0.4 * Math.sin(t * 8 + c * 2 + r);
        ctx.fillStyle = burning ? `rgba(255,${120 + fl * 80},40,${0.7 + fl * 0.3})` : '#2a2430';
        ctx.fillRect(wx, wy, 12, 18);
        ctx.fillStyle = '#0e0a0c';
        ctx.fillRect(wx + 5, wy, 2, 18);
        ctx.fillRect(wx, wy + 8, 12, 2);
      }
    // front door and steps
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(W / 2 - 14, y0 + 190, 28, 40);
    ctx.fillStyle = '#3a3630';
    for (let i = 0; i < 3; i++) ctx.fillRect(W / 2 - 30 - i * 6, y0 + 230 + i * 6, 60 + i * 12, 6);

    // flames
    if (this.fire > 0.05) {
      for (let i = 0; i < 70 * this.fire; i++) {
        const fx = x0 + ((i * 53) % (W - 60));
        const phase = (t * 1.4 + i * 0.37) % 1;
        const fy = y0 + 70 + ((i * 29) % 120) - phase * 90;
        const size = (1 - phase) * (8 + (i % 5) * 2);
        ctx.fillStyle = phase < 0.3 ? '#ffe14d' : phase < 0.6 ? '#ff8a1a' : 'rgba(200,40,10,0.7)';
        ctx.beginPath();
        ctx.arc(fx + Math.sin(t * 5 + i) * 4, fy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      // smoke
      for (let i = 0; i < 24; i++) {
        const phase = (t * 0.3 + i * 0.13) % 1;
        ctx.fillStyle = `rgba(40,36,40,${0.5 * (1 - phase) * this.fire})`;
        ctx.beginPath();
        ctx.arc(x0 + 20 + ((i * 71) % (W - 80)) + phase * 30, y0 + 40 - phase * 220, 14 + phase * 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Jeff on the steps during the intro, Lenny tossing the candelabra
    if (this.phase === 'intro') {
      const bob = Math.sin(t * 20) * (t > 1 ? 1.5 : 0);
      ctx.drawImage(jeffSprite(4, 'down', 0), W / 2 - 60 + bob, y0 + 232, 32, 32);
      if (this.t < 4.2) {
        ctx.drawImage(lennySprite(6, 'up', 0, false, 2), W / 2 + 10, y0 + 250, 32, 32);
        if (this.t < 0.9) {
          // the candelabra in flight
          const k = this.t / 0.9;
          const cx = W / 2 + 26 - k * 10;
          const cy = y0 + 250 - k * 50 - Math.sin(k * Math.PI) * 40;
          ctx.fillStyle = '#c0a040';
          ctx.fillRect(cx - 5, cy, 10, 2);
          ctx.fillRect(cx - 1, cy, 2, 6);
          ctx.fillStyle = '#ffcf5a';
          ctx.fillRect(cx - 5, cy - 3, 2, 3);
          ctx.fillRect(cx - 1, cy - 3, 2, 3);
          ctx.fillRect(cx + 3, cy - 3, 2, 3);
        }
      }
    }
  }

  private drawLimo(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-12, -26, 26, 56);
    // headlight beams (driving down the screen)
    ctx.fillStyle = 'rgba(255,240,180,0.18)';
    ctx.beginPath();
    ctx.moveTo(-8, 26);
    ctx.lineTo(-30, 120);
    ctx.lineTo(30, 120);
    ctx.lineTo(8, 26);
    ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.fillRect(-12, -29, 24, 58);
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(-11, -28, 22, 56);
    ctx.fillStyle = '#2c2c36';
    ctx.fillRect(-11, -28, 4, 56);
    // windows
    ctx.fillStyle = '#3a4a5a';
    ctx.fillRect(-9, 8, 18, 9);
    ctx.fillRect(-9, -22, 18, 6);
    ctx.fillStyle = '#26303a';
    ctx.fillRect(-10, -12, 2, 18);
    ctx.fillRect(8, -12, 2, 18);
    // Lenny at the wheel
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-6, 10, 5, 4);
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(-6, 14, 5, 2);
    // chrome and lights
    ctx.fillStyle = '#c8c8d0';
    ctx.fillRect(-12, 28, 24, 2);
    ctx.fillRect(-12, -30, 24, 2);
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(-10, 28, 4, 2);
    ctx.fillRect(6, 28, 4, 2);
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(-10, -30, 4, 2);
    ctx.fillRect(6, -30, 4, 2);
    ctx.fillStyle = '#d8c060';
    ctx.fillRect(-1, 30, 2, 3); // hood ornament
    if (this.honk > 0.3) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(0, 34, 10 + (0.6 - this.honk) * 40, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCart(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 10, y - 12, 22, 28);
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(x - 10, y - 14, 20, 26);
    ctx.fillStyle = '#b8b2a0';
    ctx.fillRect(x - 10, y - 14, 20, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 12, y - 10, 2, 6);
    ctx.fillRect(x + 10, y - 10, 2, 6);
    ctx.fillRect(x - 12, y + 4, 2, 6);
    ctx.fillRect(x + 10, y + 4, 2, 6);
    // Jeff's bald head and fist
    ctx.fillStyle = '#efe9e1';
    ctx.fillRect(x - 4, y - 2, 8, 7);
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(x - 3, y + 2, 6, 1);
    const shake = Math.sin(this.t * 18) * 2;
    ctx.fillStyle = '#efe9e1';
    ctx.fillRect(x + 6, y - 6 + shake, 3, 3);
  }

  private drawOb(ctx: CanvasRenderingContext2D, o: Ob) {
    switch (o.kind) {
      case 'coin': {
        const w = Math.abs(Math.sin(o.t * 4 + o.y)) * 6 + 1;
        ctx.fillStyle = '#7a5a10';
        ctx.fillRect(-w / 2 - 1, -7, w + 2, 14);
        ctx.fillStyle = '#ffd34d';
        ctx.fillRect(-w / 2, -6, w, 12);
        break;
      }
      case 'guard': {
        const legs = Math.sin(o.t * 14) * 2;
        ctx.fillStyle = '#111';
        ctx.fillRect(-5, 2 + legs, 3, 6);
        ctx.fillRect(2, 2 - legs, 3, 6);
        ctx.fillStyle = '#454c56';
        ctx.fillRect(-7, -8, 14, 12);
        ctx.fillStyle = '#c9a27e';
        ctx.fillRect(-4, -14, 8, 6);
        ctx.fillStyle = '#1f2a44';
        ctx.fillRect(-5, -16, 10, 3);
        break;
      }
      case 'dog': {
        const legs = Math.sin(o.t * 20) * 2;
        ctx.fillStyle = '#1b1b1b';
        ctx.fillRect(-9, -4, 18, 7);
        ctx.fillRect(o.vx >= 0 ? 7 : -12, -8, 5, 6);
        ctx.fillRect(-8, 3, 2, 4 + legs);
        ctx.fillRect(6, 3, 2, 4 - legs);
        ctx.fillStyle = '#a0602a';
        ctx.fillRect(o.vx >= 0 ? 10 : -12, -4, 2, 2);
        break;
      }
      case 'barrel':
        ctx.fillStyle = '#111';
        ctx.fillRect(-8, -9, 16, 18);
        ctx.fillStyle = '#6a4428';
        ctx.fillRect(-7, -8, 14, 16);
        ctx.fillStyle = '#2e2e30';
        ctx.fillRect(-7, -5, 14, 2);
        ctx.fillRect(-7, 3, 14, 2);
        break;
      case 'cone':
        ctx.fillStyle = '#111';
        ctx.fillRect(-6, -7, 12, 14);
        ctx.fillStyle = '#ff7a1a';
        ctx.fillRect(-5, -6, 10, 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-5, -1, 10, 2);
        break;
      case 'fountain': {
        ctx.fillStyle = '#6a6a6e';
        ctx.beginPath();
        ctx.ellipse(0, 0, 34, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a5a8a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 29, 21, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d8d4cc';
        ctx.fillRect(-4, -14, 8, 14); // a statue of Jeff, naturally
        ctx.fillStyle = '#eae6de';
        ctx.fillRect(-3, -20, 6, 6);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-3, -18, 6, 1);
        for (let i = 0; i < 6; i++) {
          const ph = (o.t * 1.5 + i / 6) % 1;
          ctx.fillStyle = `rgba(160,210,255,${1 - ph})`;
          ctx.fillRect(Math.cos(i) * ph * 16, -22 + ph * 18, 2, 2);
        }
        break;
      }
    }
  }
}
