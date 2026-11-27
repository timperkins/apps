// Musitions: the world, the sled's ride along the drawn lines, and the song score.
// Pure logic (no DOM), so index.ts only has to draw it and play the sounds.

export interface Pt { x: number; y: number }
export interface Line { pts: Pt[] }

/** Note lanes from low C to high C, two octaves (15 lanes). */
export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LANES = 15;
export const LANE_H = 40;
export const TOP = 70;
/** World height in world units; the view is scaled to fit it. */
export const WORLD_H = TOP + (LANES - 1) * LANE_H + 60;
/** One beat is this many world units wide. */
export const BEAT = 60;
export const WORLD_BEATS = 128;
export const WORLD_W = BEAT * WORLD_BEATS;
export const GRAVITY = 1800;
/** A line steeper than this (rise over run) going up gets a spring. */
export const SPRING_SLOPE = 2.4;
export const TEMPOS = { slow: 90, normal: 120, fast: 165 } as const;
export type Tempo = keyof typeof TEMPOS;

export const laneY = (lane: number) => TOP + (LANES - 1 - lane) * LANE_H;
export const laneOf = (y: number) => Math.max(0, Math.min(LANES - 1, Math.round((TOP + (LANES - 1) * LANE_H - y) / LANE_H)));
export const noteName = (lane: number) => NOTE_NAMES[lane % 7];
/** Semitones above low C for a lane (C major scale). */
const SCALE = [0, 2, 4, 5, 7, 9, 11];
export const laneSemis = (lane: number) => Math.floor(lane / 7) * 12 + SCALE[lane % 7];

/** Is the segment from a to b a "spring" segment (steep and going up)? */
export function isSpring(a: Pt, b: Pt) {
  const dy = a.y - b.y; // positive = going up on screen
  const dx = b.x - a.x;
  return dy > 6 && (dx < 1 || dy / dx > SPRING_SLOPE);
}

/** The first segment of `line` that spans x with a non-zero width, or -1. */
export function segAt(line: Line, x: number) {
  const p = line.pts;
  for (let i = 0; i < p.length - 1; i++) {
    if (p[i + 1].x - p[i].x < 0.001) continue;
    if (x >= p[i].x && x <= p[i + 1].x) return i;
  }
  return -1;
}

export function yOn(line: Line, seg: number, x: number) {
  const a = line.pts[seg], b = line.pts[seg + 1];
  const dx = b.x - a.x;
  if (dx < 0.001) return b.y;
  return a.y + (b.y - a.y) * ((x - a.x) / dx);
}

export type RideEvent =
  | { t: 'note'; lane: number; beat: number }
  | { t: 'spring'; x: number; y: number }
  | { t: 'land' }
  | { t: 'end'; why: 'done' | 'fell' };

export class Ride {
  x: number;
  y: number;
  vy = 0;
  line = -1; // index of the line we're on, -1 = in the air
  seg = -1;
  angle = 0;
  done = false;
  private wall: { x: number; top: number } | null = null;
  private lastBeat: number;
  private endX: number;

  constructor(private lines: Line[], public speed: number) {
    const real = lines.filter((l) => l.pts.length > 1);
    const first = real.reduce((m, l) => Math.min(m, l.pts[0].x), Infinity);
    this.endX = real.reduce((m, l) => Math.max(m, l.pts[l.pts.length - 1].x), -Infinity);
    const start = real.find((l) => l.pts[0].x === first)!;
    // Start sitting on the first line, so its first note plays straight away.
    this.line = lines.indexOf(start);
    this.seg = Math.max(0, segAt(start, first));
    this.x = first;
    this.y = start.pts[0].y;
    this.lastBeat = Math.ceil(first / BEAT) - 1;
  }

  static canRide(lines: Line[]) { return lines.some((l) => l.pts.length > 1); }

  step(dt: number, out: RideEvent[]) {
    if (this.done) return;
    // Small steps so landings and springs stay exact.
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    for (let i = 0; i < n && !this.done; i++) this.sub(dt / n, out);
  }

  private sub(dt: number, out: RideEvent[]) {
    const nx = this.x + this.speed * dt;
    if (this.line >= 0) this.ground(nx, out);
    else this.air(nx, dt, out);
    // Beats: a note plays on every beat line the sled crosses while riding a line.
    const beat = Math.floor(this.x / BEAT);
    if (beat > this.lastBeat) {
      this.lastBeat = beat;
      if (this.line >= 0) out.push({ t: 'note', lane: laneOf(this.y), beat });
    }
    if (this.y > WORLD_H + 120) { this.done = true; out.push({ t: 'end', why: this.x > this.endX ? 'done' : 'fell' }); }
    else if (this.x > this.endX + BEAT * 3) { this.done = true; out.push({ t: 'end', why: 'done' }); }
  }

  private ground(nx: number, out: RideEvent[]) {
    const line = this.lines[this.line];
    const p = line.pts;
    let seg = this.seg;
    while (seg < p.length - 1 && nx > p[seg + 1].x) {
      seg++;
      if (seg >= p.length - 1) break;
      const a = p[seg], b = p[seg + 1];
      if (isSpring(a, b)) return this.spring(seg, nx, out);
      if (b.y - a.y > 6 && (b.x - a.x < 1 || (b.y - a.y) / (b.x - a.x) > 2.5)) {
        // A cliff going down: fall off it.
        this.line = -1; this.vy = 0; this.x = nx; return;
      }
    }
    if (seg >= p.length - 1) {
      // Off the end of the line: fly on with the slope we had.
      const a = p[p.length - 2], b = p[p.length - 1];
      const slope = b.x - a.x > 0.001 ? (b.y - a.y) / (b.x - a.x) : 0;
      this.vy = Math.min(slope * this.speed, 400);
      this.line = -1;
      this.x = nx;
      return;
    }
    this.seg = seg;
    this.x = nx;
    this.y = yOn(line, seg, nx);
    const a = p[seg], b = p[seg + 1];
    this.angle = Math.atan2(b.y - a.y, Math.max(0.001, b.x - a.x));
  }

  /** A steep climb: a spring throws the sled up high enough to land on top. */
  private spring(seg: number, nx: number, out: RideEvent[]) {
    const p = this.lines[this.line].pts;
    let top = p[seg + 1].y, topX = p[seg + 1].x, j = seg + 1;
    while (j < p.length - 1 && isSpring(p[j], p[j + 1])) { j++; top = Math.min(top, p[j].y); topX = p[j].x; }
    const rise = this.y - top + 26;
    this.vy = -Math.sqrt(2 * GRAVITY * rise);
    // Until the sled is up past the top, the climb is a wall it can't go through.
    this.wall = { x: topX, top };
    out.push({ t: 'spring', x: p[seg].x, y: p[seg].y });
    this.line = -1;
    this.x = nx;
  }

  private air(nx: number, dt: number, out: RideEvent[]) {
    const py = this.y, px = this.x;
    if (this.wall) {
      if (py < this.wall.top - 4) this.wall = null;
      else if (nx > this.wall.x - 3) nx = Math.max(px, this.wall.x - 3);
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, 1400);
    const ny = py + this.vy * dt;
    this.angle += (Math.max(-0.6, Math.min(0.6, this.vy / 1500)) - this.angle) * Math.min(1, dt * 8);
    if (this.vy >= 0) {
      let best = -1, bestSeg = -1, bestY = Infinity;
      this.lines.forEach((l, li) => {
        if (l.pts.length < 2) return;
        const s = segAt(l, nx);
        if (s < 0) return;
        const ly = yOn(l, s, nx);
        const ps = segAt(l, px);
        const lyPrev = ps >= 0 ? yOn(l, ps, px) : ly;
        if (py <= lyPrev + 3 && ny >= ly - 0.5 && ly < bestY) { best = li; bestSeg = s; bestY = ly; }
      });
      if (best >= 0) {
        this.line = best; this.seg = bestSeg; this.x = nx; this.y = bestY; this.vy = 0; this.wall = null;
        out.push({ t: 'land' });
        return;
      }
    }
    this.x = nx;
    this.y = ny;
  }
}

/** Where springs sit on the drawn lines (for drawing them). */
export function springSpots(lines: Line[]) {
  const s: Pt[] = [];
  for (const l of lines) {
    for (let i = 0; i < l.pts.length - 1; i++) {
      if (isSpring(l.pts[i], l.pts[i + 1]) && (i === 0 || !isSpring(l.pts[i - 1], l.pts[i]))) s.push(l.pts[i]);
    }
  }
  return s;
}

// ---- Score: the more it sounds like a normal song, the more points ----

export interface Played { lane: number; beat: number }
export interface Award { pts: number; why: string }

/** Points for one new note, judged against the notes before it. */
export function scoreNote(prev: Played[], cur: Played): Award | null {
  const last = prev[prev.length - 1];
  if (!last) return { pts: [0, 2, 4].includes(cur.lane % 7) ? 15 : 5, why: [0, 2, 4].includes(cur.lane % 7) ? 'good start' : 'first note' };
  const gap = cur.beat - last.beat;
  let bonus = 0;
  let extra = '';
  if (gap >= 2 && gap <= 4 && prev.length >= 3) { bonus = 5; extra = ' + breath'; }
  const d = Math.abs(cur.lane - last.lane);
  if (d === 0) {
    let run = 1;
    for (let i = prev.length - 1; i > 0 && prev[i].lane === prev[i - 1].lane; i--) run++;
    if (run >= 3) return { pts: -3 + bonus, why: 'same note again…' + extra };
    return { pts: 4 + bonus, why: 'repeat' + extra };
  }
  if (d === 1) return { pts: 10 + bonus, why: 'step' + extra };
  if (d === 2) return { pts: 8 + bonus, why: 'skip' + extra };
  if (d <= 4) return { pts: 5 + bonus, why: 'leap' + extra };
  if (d <= 7) return { pts: 1 + bonus, why: 'big leap' + extra };
  return { pts: -5 + bonus, why: 'huge jump' + extra };
}

/** End-of-song bonuses. */
export function finalBonuses(notes: Played[]): Award[] {
  const out: Award[] = [];
  if (notes.length < 2) return out;
  const last = notes[notes.length - 1];
  if (last.lane % 7 === 0) out.push({ pts: 40, why: 'Ends on the home note C' });
  else if (last.lane % 7 === 4) out.push({ pts: 10, why: 'Ends on G' });
  // Songs repeat themselves: a 4-note tune shape that comes back (even higher or lower).
  const shape = (i: number) => [1, 2, 3].map((k) => notes[i + k].lane - notes[i + k - 1].lane).join(',');
  const seen = new Map<string, number>();
  let repeats = 0;
  for (let i = 0; i + 3 < notes.length; i++) {
    const s = shape(i);
    if (s === '0,0,0') continue;
    const at = seen.get(s);
    if (at === undefined) seen.set(s, i);
    else if (i - at >= 4) { repeats++; seen.set(s, i); }
  }
  if (repeats) out.push({ pts: Math.min(repeats, 5) * 25, why: `Tune comes back ×${Math.min(repeats, 5)}` });
  const distinct = new Set(notes.map((n) => n.lane % 7)).size;
  if (distinct >= 5) out.push({ pts: 20, why: `Uses ${distinct} different notes` });
  let near = 0;
  for (let i = 1; i < notes.length; i++) if (Math.abs(notes[i].lane - notes[i - 1].lane) <= 2) near++;
  if (notes.length >= 6 && near / (notes.length - 1) >= 0.6) out.push({ pts: 30, why: 'Mostly smooth steps' });
  if (notes.length >= 32) out.push({ pts: 40, why: 'A long song (32+ notes)' });
  else if (notes.length >= 16) out.push({ pts: 20, why: 'A full tune (16+ notes)' });
  return out;
}

export function rating(score: number) {
  if (score >= 700) return { stars: 5, name: 'Hit song!' };
  if (score >= 450) return { stars: 4, name: 'Real song' };
  if (score >= 250) return { stars: 3, name: 'Nice tune' };
  if (score >= 100) return { stars: 2, name: 'Tune-ish' };
  return { stars: 1, name: 'Noisy' };
}

/** A made-up starter tune so there's something to ride on the first visit. */
export function demoLines(): Line[] {
  // Lanes (0 = low C): two phrases that answer each other and come home to C.
  const tune = [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2, 2, 4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0];
  const b = (n: number) => BEAT * (2 + n);
  const pts: Pt[] = tune.map((lane, i) => ({ x: b(i), y: laneY(lane) }));
  // A big finish: a spring jumps the sled up onto a high platform, then up to high C.
  pts.push(
    { x: b(31) + 20, y: laneY(0) }, { x: b(31) + 24, y: laneY(4) },
    { x: b(33), y: laneY(4) }, { x: b(34), y: laneY(7) }, { x: b(35), y: laneY(7) }, { x: b(35) + 40, y: laneY(7) },
  );
  return [{ pts }];
}
