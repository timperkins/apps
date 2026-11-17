// Runs the map, the overlay canvas and one animation loop. React only draws the controls and
// talks to this through its commands and state.
import { LngLatBounds, Map as MapLibre, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Person, Place } from '../data/types';
import { BABY_BOY, BABY_GIRL } from '../data/index';
import { samePlace, type Leg, type TimedEvent, type Timeline } from '../engine/timeline';
import { withAlpha } from '../engine/color';
import { DARK, LIGHT, mapStyle, type Theme } from '../map/style';
import { step, type Body } from './physics';
import { arc, easeInOut, laneOffset, pointAt, shifted, type Pt } from './curves';
import { FLIGHT_SECONDS, Player } from './player';
import { babySvg, circleImage, heart, label, ring, roundRect, sparkle, star, weddingRing } from './draw';

setWorkerUrl(workerUrl);

export type View = 'fit' | 'world' | 'free';

export interface SceneState {
  t: number;
  playing: boolean;
  speed: number;
  pauseForEvents: boolean;
  traces: boolean;
  /** Whether children and their births are shown. */
  babies: boolean;
  view: View;
  /** Friends switched off in the filter. */
  hidden: string[];
}

const FRIEND_R = 22;
const CHILD_R = 13;
const PLACE_LABEL_SECONDS = 2;
const TRACE_LANE = 4.5;
const WORLD: [[number, number], [number, number]] = [[-168, -50], [192, 74]];

interface Flight {
  from: Place;
  to: Place;
  start: number;
  leg?: Leg;
  lane: number;
  laneCount: number;
  /** Where the bubble was drawn when it took off, relative to the from point, so it doesn't jump. */
  startOffset: Pt;
  order: number;
}

interface Actor {
  person: Person;
  color: string;
  body: Body;
  place: Place | null;
  flight: Flight | null;
  img: HTMLImageElement;
  scale: number;
  scaleV: number;
  drop: number;
  dropV: number;
  justBorn: boolean;
  label: { text: string; start: number; until: number } | null;
  prevAnchor: Pt | null;
}

interface Particle {
  kind: 'sparkle' | 'heart' | 'confetti' | 'star' | 'wave';
  /** Position on screen, or relative to the bubble it follows. */
  x: number;
  y: number;
  /** Births' sparkles and stars stay centered on the bubble even while it moves. */
  follow?: Actor;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  born: number;
  life: number;
}

interface Wedding {
  a: Actor;
  b: Actor;
  start: number;
}

/** "It's a boy!" for a baby with no name yet, else "Welcome, Ada!". */
function babyLabel(name: string, sex: 'female' | 'male'): string {
  if (/^baby\b/i.test(name)) return `It's a ${sex === 'female' ? 'girl' : 'boy'}!`;
  return `Welcome, ${name.split(' ')[0]}!`;
}

export class Scene {
  readonly map: MapLibre;
  readonly player: Player;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly actors: Actor[] = [];
  private readonly byId = new Map<string, Actor>();
  private particles: Particle[] = [];
  private weddings: Wedding[] = [];
  private theme: Theme;
  private clock = 0;
  private last = 0;
  private frameId = 0;
  private snap = true;
  private traces = true;
  private babies = true;
  private hidden = new Set<string>();
  private view: View = 'fit';
  private fitKey = '';
  private hover: Pt | null = null;
  private state: SceneState;
  private listeners = new Set<() => void>();
  private width = 0;
  private height = 0;
  private resizeObserver: ResizeObserver;
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor(
    private readonly container: HTMLElement,
    mapEl: HTMLElement,
    canvas: HTMLCanvasElement,
    private readonly timeline: Timeline,
  ) {
    this.theme = this.media.matches ? DARK : LIGHT;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.player = new Player(timeline);
    // Time doesn't stop for events that only involve people filtered out.
    this.player.skip = (e) => e.event.people.every((id) => this.isHidden(id));
    this.map = new MapLibre({
      container: mapEl,
      style: mapStyle(this.theme),
      bounds: WORLD,
      fitBoundsOptions: { padding: this.padding() },
      renderWorldCopies: true,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxZoom: 9,
      minZoom: 0.5,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disable();
    this.map.on('movestart', (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) this.setView('free');
    });

    timeline.people.forEach((person) => {
      const img = new Image();
      if (person.kind === 'child') img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(babySvg(person.sex === 'female' ? BABY_GIRL : BABY_BOY))}`;
      else if (person.photo) img.src = person.photo;
      const family = this.familyOf(person.kind === 'child' ? person.motherId : person.id);
      const actor: Actor = {
        person,
        color: person.kind === 'friend' ? person.color : person.sex === 'female' ? BABY_GIRL : BABY_BOY,
        body: { id: person.id, x: 0, y: 0, vx: 0, vy: 0, r: person.kind === 'friend' ? FRIEND_R : CHILD_R, ax: 0, ay: 0, family, flying: false, active: false },
        place: null,
        flight: null,
        img,
        scale: 1,
        scaleV: 0,
        drop: 0,
        dropV: 0,
        justBorn: false,
        label: null,
        prevAnchor: null,
      };
      this.actors.push(actor);
      this.byId.set(person.id, actor);
    });

    this.state = this.snapshot();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    container.addEventListener('mousemove', this.onMouseMove);
    container.addEventListener('mouseleave', this.onMouseLeave);
    this.media.addEventListener('change', this.onScheme);
    this.frameId = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.container.removeEventListener('mousemove', this.onMouseMove);
    this.container.removeEventListener('mouseleave', this.onMouseLeave);
    this.media.removeEventListener('change', this.onScheme);
    this.map.remove();
  }

  // Commands from the controls

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): SceneState => this.state;

  togglePlay(): void {
    if (this.player.playing) this.player.playing = false;
    else {
      if (this.player.t >= this.timeline.end) this.snap = true;
      this.player.play();
    }
    this.emit();
  }

  seek(t: number): void {
    this.player.seek(t);
    this.snap = true;
    // Celebrations belong to the moment they happened; don't carry them to the new date.
    this.weddings = [];
    this.particles = [];
    for (const a of this.actors) a.label = null;
    this.emit();
  }

  setSpeed(speed: number): void {
    this.player.speed = speed;
    this.emit();
  }

  setPauseForEvents(on: boolean): void {
    this.player.pauseForEvents = on;
    this.emit();
  }

  setTraces(on: boolean): void {
    this.traces = on;
    this.emit();
  }

  /** Shows or hides every child, along with their births on the map and the timeline. */
  setBabies(on: boolean): void {
    this.babies = on;
    this.snap = true;
    this.emit();
  }

  /** Shows or hides a friend; their children go with them when they're the parent. */
  setHidden(id: string, hidden: boolean): void {
    if (hidden) this.hidden.add(id);
    else this.hidden.delete(id);
    this.snap = true;
    this.emit();
  }

  setAllHidden(hidden: boolean): void {
    this.hidden = new Set(hidden ? this.timeline.friends.map((f) => f.id) : []);
    this.snap = true;
    this.emit();
  }

  private isHidden(id: string): boolean {
    const person = this.timeline.people.get(id);
    if (!person) return false;
    if (person.kind === 'child' && !this.babies) return true;
    return this.hidden.has(person.kind === 'child' ? person.motherId : id);
  }

  setView(view: View): void {
    if (this.view === view) return;
    this.view = view;
    this.fitKey = '';
    if (view === 'world') this.map.fitBounds(WORLD, { padding: this.padding(), duration: 1400 });
    this.emit();
  }

  // The loop

  private frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 20) : 1 / 60;
    this.last = now;
    this.clock += dt;

    const before = this.player.t;
    const crossed = this.player.advance(dt);
    const animate = !this.snap && (this.player.playing || crossed.length > 0);
    if (animate) this.markBirths(crossed);
    this.updatePlaces(animate);
    this.updateBodies(dt);
    if (animate) this.celebrate(crossed);
    this.updateCamera();
    this.render(dt);
    this.snap = false;
    if (this.player.t !== before || crossed.length) this.emit();
    else if (this.state.playing !== this.player.playing) this.emit();
  };

  private markBirths(crossed: TimedEvent[]) {
    for (const { event, t } of crossed) {
      for (const id of event.people) {
        // Births, and spouses who first appear at their wedding.
        if (event.type !== 'birth' && this.timeline.birthTime(id) !== t) continue;
        const actor = this.byId.get(id);
        if (actor) actor.justBorn = true;
      }
    }
  }

  /** Works out where everyone should be now, starting flights for anyone who moved. */
  private updatePlaces(animate: boolean) {
    const t = this.player.t;
    const started: Actor[] = [];
    for (const actor of this.actors) {
      const target = this.isHidden(actor.person.id) ? null : this.timeline.placeAt(actor.person.id, t);
      const body = actor.body;
      if (!target) {
        body.active = false;
        actor.place = null;
        actor.flight = null;
        actor.label = null;
        continue;
      }
      if (!actor.place || !body.active) {
        actor.place = target;
        const p = this.projectPlace(target);
        const mother = actor.person.kind === 'child' ? this.byId.get(actor.person.motherId) : undefined;
        const start = mother?.body.active ? { x: mother.body.x, y: mother.body.y } : p;
        Object.assign(body, { x: start.x + (Math.random() - 0.5), y: start.y + (Math.random() - 0.5), vx: 0, vy: 0, ax: p.x, ay: p.y, active: true, flying: false });
        actor.prevAnchor = p;
        if (animate && actor.justBorn) {
          actor.scale = 0;
          actor.scaleV = 0;
          if (actor.person.kind === 'child') {
            actor.scale = 0.6;
            actor.drop = -70;
            actor.dropV = 0;
          }
        } else {
          actor.scale = 1;
          actor.drop = 0;
        }
        continue;
      }
      if (!samePlace(actor.place, target)) {
        if (animate) {
          const fromPx = this.projectPlace(actor.place);
          actor.flight = {
            from: actor.place,
            to: target,
            start: this.clock,
            leg: this.legFor(actor.person.id, target),
            lane: 0,
            laneCount: 1,
            startOffset: { x: body.x - fromPx.x, y: body.y - fromPx.y },
            order: actor.person.order,
          };
          started.push(actor);
          if (actor.person.kind === 'friend') this.setLabel(actor, target.name, FLIGHT_SECONDS + PLACE_LABEL_SECONDS);
        } else {
          actor.flight = null;
          const p = this.projectPlace(target);
          body.x = p.x;
          body.y = p.y;
          body.vx = body.vy = 0;
          actor.prevAnchor = p;
        }
        actor.place = target;
      }
    }
    // People taking off together on the same trip fly side by side.
    const groups = new Map<string, Actor[]>();
    for (const a of started) {
      const f = a.flight!;
      const key = `${f.from.lat},${f.from.lng}>${f.to.lat},${f.to.lng}`;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    for (const group of groups.values()) {
      group.sort((x, y) => x.flight!.order - y.flight!.order);
      group.forEach((a, i) => {
        a.flight!.lane = i;
        a.flight!.laneCount = group.length;
      });
    }
    for (const a of this.actors) a.justBorn = false;
  }

  private updateBodies(dt: number) {
    for (const actor of this.actors) {
      const body = actor.body;
      if (!body.active || !actor.place) continue;
      if (actor.flight) {
        const f = actor.flight;
        const s = (this.clock - f.start) / FLIGHT_SECONDS;
        if (s >= 1) {
          actor.flight = null;
        } else {
          const e = easeInOut(s);
          const p0 = this.projectPlace(f.from);
          const p1 = this.projectPlace(f.to);
          const spacing = (FRIEND_R * 2 + 6) * Math.sin(Math.PI * s);
          const p = pointAt(shifted(arc(p0, p1), laneOffset(f.lane, f.laneCount, spacing)), e);
          body.ax = p.x + f.startOffset.x * (1 - e);
          body.ay = p.y + f.startOffset.y * (1 - e);
          body.flying = s < 0.85;
          // Coming in to land, it starts nudging the others aside instead of dropping on top of them.
          body.ghost = s < 0.6;
          actor.prevAnchor = null;
          continue;
        }
      }
      body.flying = false;
      body.ghost = false;
      const p = this.projectPlace(actor.place);
      // Move with the map as the camera moves; the springs only handle bumping and settling.
      if (actor.prevAnchor) {
        body.x += p.x - actor.prevAnchor.x;
        body.y += p.y - actor.prevAnchor.y;
      }
      actor.prevAnchor = p;
      body.ax = p.x;
      body.ay = p.y;
    }

    if (this.snap) {
      // Jumps settle instantly: run the layout to rest without drawing the in-between.
      for (let i = 0; i < 90; i++) step(this.actors.map((a) => a.body), 1 / 60);
      for (const a of this.actors) a.body.vx = a.body.vy = 0;
    } else {
      step(this.actors.map((a) => a.body), dt);
    }

    for (const actor of this.actors) {
      actor.scaleV += (180 * (1 - actor.scale) - 11 * actor.scaleV) * dt;
      actor.scale += actor.scaleV * dt;
      actor.dropV += (220 * (0 - actor.drop) - 9 * actor.dropV) * dt;
      actor.drop += actor.dropV * dt;
    }
  }

  private celebrate(crossed: TimedEvent[]) {
    for (const { event } of crossed) {
      if (event.type === 'birth') {
        for (const id of event.people) {
          const actor = this.byId.get(id);
          if (!actor?.body.active) continue;
          if (actor.person.kind === 'friend') {
            this.burst('sparkle', actor, 18, [actor.color, '#F2C94C', actor.color], 70, 1.4);
            this.particles.push({ ...this.particle('wave', 0, 0, 0, 0, actor.color, 1.1, FRIEND_R), follow: actor });
            this.setLabel(actor, `Born in ${event.place?.name ?? actor.place?.name ?? ''}`, 3);
          } else {
            this.burst('star', actor, 14, [actor.color, '#ffffff', actor.color], 90, 1.5);
            // Twins share one label so the two don't sit on top of each other.
            if (id === event.people[0]) this.setLabel(actor, event.people.length > 1 ? 'Twins!' : babyLabel(actor.person.name, actor.person.sex), 3);
          }
        }
      } else if (event.type === 'marriage') {
        const a = this.byId.get(event.people[0]);
        // A spouse who isn't in the app: the halo goes around one bubble.
        const b = event.people[1] ? this.byId.get(event.people[1]) : a;
        if (!a?.body.active || !b?.body.active) continue;
        // Partners who still live apart each get their own halo.
        const together = Math.hypot(a.body.x - b.body.x, a.body.y - b.body.y) < FRIEND_R * 6;
        if (together) this.weddings.push({ a, b, start: this.clock });
        else this.weddings.push({ a, b: a, start: this.clock }, { a: b, b, start: this.clock });
        this.setLabel(a, event.place ? `Married in ${event.place.name}` : 'Just married!', 3.4);
      }
    }
  }

  private updateCamera() {
    if (this.view !== 'fit') return;
    const bounds = new LngLatBounds();
    let any = false;
    for (const a of this.actors) {
      if (a.body.active && a.place && a.person.kind === 'friend') {
        bounds.extend([a.place.lng, a.place.lat]);
        any = true;
      }
    }
    if (any) {
      // Keep some context around one city: at least about 50 by 25 degrees.
      const [[w, so], [e, n]] = bounds.toArray();
      const cx = (w + e) / 2;
      const cy = (so + n) / 2;
      const halfW = Math.max((e - w) / 2, 25);
      const halfH = Math.max((n - so) / 2, 12.5);
      bounds.setSouthWest([cx - halfW, Math.max(-70, cy - halfH)]);
      bounds.setNorthEast([cx + halfW, Math.min(80, cy + halfH)]);
    }
    const key = any ? bounds.toArray().flat().map((v) => v.toFixed(2)).join(',') : 'world';
    if (key === this.fitKey) return;
    const first = this.fitKey === '';
    this.fitKey = key;
    const duration = first ? 1000 : this.snap ? 500 : 1800;
    if (!any) this.map.fitBounds(WORLD, { padding: this.padding(), duration });
    else this.map.fitBounds(bounds, { padding: this.padding(), maxZoom: 4, duration });
  }

  // Drawing

  private render(dt: number) {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.traces) this.drawTraces();
    this.drawWeddingHalos();
    this.drawTethers();
    const order = this.actors.filter((a) => a.body.active).sort((x, y) => Number(!!x.flight) - Number(!!y.flight) || y.body.r - x.body.r);
    for (const actor of order) this.drawBubble(actor);
    this.drawParticles(dt);
    this.drawWeddingRings();
    this.drawLabels();
  }

  private drawTraces() {
    const ctx = this.ctx;
    const t = this.player.t;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    for (const leg of this.timeline.legs) {
      if (leg.t > t) break;
      const actor = this.byId.get(leg.personId);
      if (!actor?.body.active) continue;
      let upto = 1;
      if (actor.flight?.leg === leg) upto = easeInOut(Math.min(1, (this.clock - actor.flight.start) / FLIGHT_SECONDS));
      const a = shifted(arc(this.projectPlace(leg.from), this.projectPlace(leg.to)), laneOffset(leg.lane, leg.laneCount, TRACE_LANE));
      ctx.beginPath();
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const s = (i / steps) * upto;
        const p = pointAt(a, s);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      // Recent trips stand out; older ones fade back over a few years.
      const fade = 0.16 + 0.5 * Math.exp(-(t - leg.t) / 48);
      ctx.strokeStyle = withAlpha(actor.color, this.theme.dark ? fade + 0.06 : fade);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A thin line back to the real spot for bubbles pushed far from it. */
  private drawTethers() {
    const ctx = this.ctx;
    for (const a of this.actors) {
      const b = a.body;
      if (!b.active || a.flight || a.person.kind === 'child') continue;
      const d = Math.hypot(b.x - b.ax, b.y - b.ay);
      if (d < b.r * 1.4) continue;
      ctx.beginPath();
      ctx.moveTo(b.ax, b.ay);
      ctx.lineTo(b.x - ((b.x - b.ax) / d) * b.r, b.y - ((b.y - b.ay) / d) * b.r);
      ctx.strokeStyle = withAlpha(a.color, 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.ax, b.ay, 3, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
    }
  }

  private drawBubble(actor: Actor) {
    const ctx = this.ctx;
    const b = actor.body;
    const scale = Math.max(0, actor.scale);
    if (scale < 0.02) return;
    const r = b.r * scale;
    const x = b.x;
    const y = b.y + actor.drop;
    const friend = actor.person.kind === 'friend';
    ctx.save();
    ctx.shadowColor = this.theme.dark ? 'rgba(0,0,0,0.55)' : 'rgba(40,30,20,0.28)';
    ctx.shadowBlur = actor.flight ? 16 : 8;
    ctx.shadowOffsetY = actor.flight ? 6 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r + (friend ? 3.5 : 2), 0, Math.PI * 2);
    ctx.fillStyle = friend ? actor.color : '#ffffff';
    ctx.fill();
    ctx.restore();
    const initials = actor.person.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
    circleImage(ctx, actor.img, x, y, r, actor.color, initials);
    if (friend) ring(ctx, x, y, r + 0.5, 'rgba(255,255,255,0.9)', 1.5);
  }

  private drawWeddingHalos() {
    const ctx = this.ctx;
    this.weddings = this.weddings.filter((w) => this.clock - w.start < 3);
    for (const w of this.weddings) {
      const age = this.clock - w.start;
      const alpha = Math.min(1, age * 3) * Math.min(1, (3 - age) * 1.5);
      const ax = w.a.body.x;
      const ay = w.a.body.y;
      const bx = w.b.body.x;
      const by = w.b.body.y;
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2;
      const half = Math.hypot(bx - ax, by - ay) / 2;
      const angle = Math.atan2(by - ay, bx - ax);
      const grow = 1 + 0.08 * Math.sin(age * 6);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;
      const w2 = (half + FRIEND_R + 9) * grow;
      const h2 = (FRIEND_R + 9) * grow;
      roundRect(ctx, -w2, -h2, w2 * 2, h2 * 2, h2);
      ctx.strokeStyle = '#D4A72C';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(212,167,44,0.6)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawWeddingRings() {
    const ctx = this.ctx;
    for (const w of this.weddings) {
      const age = this.clock - w.start;
      const cx = (w.a.body.x + w.b.body.x) / 2;
      const cy = Math.min(w.a.body.y, w.b.body.y) - FRIEND_R - 22 - age * 8;
      const pop = Math.min(1, age * 4);
      const size = 15 * (pop < 1 ? pop * 1.2 : 1);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (3 - age) * 1.5);
      weddingRing(ctx, cx, cy, size);
      ctx.restore();
      // Hearts and confetti keep coming for the first second.
      if (age < 1 && Math.random() < 0.6) {
        const colors = [w.a.color, w.b.color, '#F2C94C'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
        const speed = 60 + Math.random() * 80;
        const kind = Math.random() < 0.55 ? 'heart' : 'confetti';
        this.particles.push(this.particle(kind, cx + (Math.random() - 0.5) * 30, cy + 20, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 1.6, kind === 'heart' ? 9 + Math.random() * 5 : 6));
      }
    }
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => this.clock - p.born < p.life);
    for (const p of this.particles) {
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const age = (this.clock - p.born) / p.life;
      ctx.save();
      if (p.follow) ctx.translate(p.follow.body.x, p.follow.body.y + p.follow.drop);
      ctx.globalAlpha = Math.max(0, 1 - age * age);
      switch (p.kind) {
        case 'sparkle':
          sparkle(ctx, p.x, p.y, p.size * (1 - age * 0.5), p.rot, p.color);
          break;
        case 'star':
          star(ctx, p.x, p.y, p.size, p.rot, p.color);
          break;
        case 'heart':
          heart(ctx, p.x, p.y, p.size, p.color);
          break;
        case 'confetti':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        case 'wave':
          ctx.globalAlpha = 0.6 * (1 - age);
          ring(ctx, p.x, p.y, p.size + age * 55, p.color, 3 * (1 - age) + 0.5);
          break;
      }
      ctx.restore();
    }
  }

  private drawLabels() {
    const hovered = this.hovered();
    for (const a of this.actors) {
      if (!a.body.active) continue;
      let text: string | null = null;
      let alpha = 0;
      if (a === hovered) {
        text = a.person.name;
        alpha = 1;
      } else if (a.label) {
        if (this.clock > a.label.until) {
          a.label = null;
          continue;
        }
        text = a.label.text;
        alpha = Math.min(1, (this.clock - a.label.start) * 4, (a.label.until - this.clock) * 2);
      }
      if (!text) continue;
      const b = a.body;
      const r = b.r * Math.max(0, a.scale);
      const y = b.y + a.drop;
      const right = b.x + r + 10 + 200 < this.width;
      label(this.ctx, text, right ? b.x + r + 10 : b.x - r - 10, y, a.color, alpha, this.theme, right ? 'right' : 'left');
    }
  }

  // Helpers

  private hovered(): Actor | null {
    if (!this.hover) return null;
    let best: Actor | null = null;
    let bestD = Infinity;
    for (const a of this.actors) {
      if (!a.body.active) continue;
      const d = Math.hypot(a.body.x - this.hover.x, a.body.y - this.hover.y);
      if (d <= a.body.r + 4 && d < bestD) {
        best = a;
        bestD = d;
      }
    }
    return best;
  }

  private setLabel(actor: Actor, text: string, seconds: number) {
    actor.label = { text, start: this.clock, until: this.clock + seconds };
  }

  /** Particles flying out from a bubble, and moving with it. */
  private burst(kind: Particle['kind'], from: Actor, n: number, colors: string[], speed: number, life: number) {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const v = speed * (0.6 + Math.random() * 0.6);
      const size = kind === 'star' ? 4 + Math.random() * 3 : 4 + Math.random() * 4;
      const p = this.particle(kind, 0, 0, Math.cos(angle) * v, Math.sin(angle) * v - (kind === 'star' ? 40 : 0), colors[i % colors.length], life * (0.7 + Math.random() * 0.5), size);
      this.particles.push({ ...p, follow: from });
    }
  }

  private particle(kind: Particle['kind'], x: number, y: number, vx: number, vy: number, color: string, life: number, size: number): Particle {
    const gravity = kind === 'heart' ? -20 : kind === 'confetti' ? 120 : kind === 'star' ? 60 : 0;
    return { kind, x, y, vx, vy, gravity, drag: kind === 'wave' ? 0 : 1.6, size, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6, color, born: this.clock, life };
  }

  private legFor(id: string, to: Place): Leg | undefined {
    let found: Leg | undefined;
    for (const leg of this.timeline.legs) {
      if (leg.t > this.player.t) break;
      if (leg.personId === id && samePlace(leg.to, to)) found = leg;
    }
    return found;
  }

  private familyOf(id: string): string {
    // Partners and their children share a family, named after the couple.
    for (const { event } of this.timeline.events) {
      if (event.type === 'marriage' && event.people.includes(id)) return [...event.people].sort().join('+');
    }
    return id;
  }

  private projectPlace(place: Place): Pt {
    const p = this.map.project([place.lng, place.lat]);
    return { x: p.x, y: p.y };
  }

  private padding() {
    return { top: 110, bottom: 120, left: 90, right: 90 };
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.map.resize();
    this.fitKey = '';
    if (this.view === 'world') this.map.fitBounds(WORLD, { padding: this.padding(), duration: 0 });
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.container.getBoundingClientRect();
    this.hover = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.container.style.cursor = this.hovered() ? 'default' : '';
  };

  private onMouseLeave = () => {
    this.hover = null;
  };

  private onScheme = () => {
    this.theme = this.media.matches ? DARK : LIGHT;
    this.map.setStyle(mapStyle(this.theme));
  };

  private snapshot(): SceneState {
    return {
      t: this.player.t,
      playing: this.player.playing,
      speed: this.player.speed,
      pauseForEvents: this.player.pauseForEvents,
      traces: this.traces,
      babies: this.babies,
      view: this.view,
      hidden: [...this.hidden],
    };
  }

  private emit() {
    this.state = this.snapshot();
    for (const fn of this.listeners) fn();
  }
}
