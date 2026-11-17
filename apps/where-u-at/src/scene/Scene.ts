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
import { babySvg, balloon, banner, circleImage, heart, label, ring, roundRect, sparkle, star, weddingRing } from './draw';

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
  /** Whether the timeline shows a dot for each birth and wedding. */
  dots: boolean;
  view: View;
  /** Friends switched off in the filter. */
  hidden: string[];
}

const FRIEND_R = 22;
const CHILD_R = 13;
const PLACE_LABEL_SECONDS = 2;
const TRACE_LANE = 4.5;
const WORLD: [[number, number], [number, number]] = [[-168, -50], [192, 74]];
/** How high above their spot a newborn starts floating down on balloons, in pixels. */
const BABY_DROP = 240;
/** When things land in each show: the baby touches down, the shooting star hits, the rings clink. */
const BABY_DESCENT = 1.05;
const STAR_FALL = 0.6;
const RING_MEET = 0.7;
/** When each wedding firework launches, in seconds into the show. */
const FIREWORKS = [0.85, 1.2, 1.6, 2.0];
const SHOW_SECONDS: Record<Show['kind'], number> = { baby: 3.6, star: 3.2, wedding: 4 };
/** Keeps big moments smooth on phones. */
const MAX_PARTICLES = 700;
const GOLD = '#F2C94C';

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
  /** Sideways swing while a newborn floats down. */
  sway: number;
  label: { text: string; start: number; until: number } | null;
  prevAnchor: Pt | null;
}

interface Particle {
  kind: 'sparkle' | 'heart' | 'confetti' | 'star' | 'wave' | 'balloon' | 'spark' | 'rocket';
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
  /** How far a wave's ring spreads over its life, in pixels. */
  grow?: number;
  /** Runs once when the particle burns out: a rocket bursts into a firework. */
  onDone?: () => void;
}

/** One birth or wedding celebration, from the build-up to the fireworks. */
interface Show {
  kind: 'baby' | 'star' | 'wedding';
  a: Actor;
  /** The partner, or the same actor again for births and weddings shown on one bubble. */
  b: Actor;
  /** A newborn's mother, who bounces for joy when the baby lands. */
  parent?: Actor;
  /** The big headline, or null for a show that shares another's (the second twin). */
  banner: string | null;
  start: number;
  /** Moments of the show that already happened. */
  beats: Set<string>;
  seed: number;
}

function backOut(t: number): number {
  const u = t - 1;
  return 1 + 2.70158 * u * u * u + 1.70158 * u * u;
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
  private shows: Show[] = [];
  private flashAt = -10;
  private flashStrength = 0;
  /** Set when the camera swung over to frame a show, so it can settle back after. */
  private refitAfterShow = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private theme: Theme;
  private clock = 0;
  private last = 0;
  private frameId = 0;
  private snap = true;
  private traces = true;
  private babies = true;
  private dots = false;
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
        sway: 0,
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
    this.shows = [];
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

  setDots(on: boolean): void {
    this.dots = on;
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
    this.updateShows(dt);
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
          // The show takes it from here: babies float down on balloons, friends arrive as a shooting star.
          const child = actor.person.kind === 'child';
          actor.scale = child ? 1 : 0;
          actor.scaleV = 0;
          actor.drop = child ? -BABY_DROP : 0;
          actor.dropV = 0;
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
            this.shows.push(this.show('star', actor, actor, `${actor.person.name.split(' ')[0]}!`));
            this.focus({ x: actor.body.x, y: actor.body.y });
            actor.label = { text: `Born in ${event.place?.name ?? actor.place?.name ?? ''}`, start: this.clock + STAR_FALL, until: this.clock + STAR_FALL + 3.2 };
          } else {
            // Twins share one headline so the two don't sit on top of each other.
            const headline = id === event.people[0] ? (event.people.length > 1 ? 'Twins!' : babyLabel(actor.person.name, actor.person.sex)) : null;
            const s = this.show('baby', actor, actor, headline);
            s.parent = this.byId.get(actor.person.motherId);
            this.shows.push(s);
            if (headline) this.focus(this.projectPlace(actor.place ?? event.place!));
          }
        }
      } else if (event.type === 'marriage') {
        const a = this.byId.get(event.people[0]);
        // A spouse who isn't in the app: the show goes around one bubble.
        const b = event.people[1] ? this.byId.get(event.people[1]) : a;
        if (!a?.body.active || !b?.body.active) continue;
        // Partners who still live apart each get their own show.
        const together = Math.hypot(a.body.x - b.body.x, a.body.y - b.body.y) < FRIEND_R * 6;
        if (together) this.shows.push(this.show('wedding', a, b, 'Just married!'));
        else this.shows.push(this.show('wedding', a, a, 'Just married!'), this.show('wedding', b, b, null));
        this.setLabel(a, event.place ? `Married in ${event.place.name}` : 'Just married!', 4.4);
        this.focus(together ? { x: (a.body.x + b.body.x) / 2, y: (a.body.y + b.body.y) / 2 } : { x: a.body.x, y: a.body.y });
      }
    }
  }

  /** Swings the camera over when a show would happen too near the edge to see. */
  private focus(c: Pt) {
    const safeX = Math.min(130, this.width * 0.3);
    const safeY = Math.min(170, this.height * 0.25);
    const dx = c.x < safeX ? c.x - safeX : c.x > this.width - safeX ? c.x - (this.width - safeX) : 0;
    const dy = c.y < safeY ? c.y - safeY : c.y > this.height - safeY ? c.y - (this.height - safeY) : 0;
    if (!dx && !dy) return;
    this.map.panBy([dx, dy], { duration: 700 });
    if (this.view === 'fit') this.refitAfterShow = true;
  }

  private show(kind: Show['kind'], a: Actor, b: Actor, headline: string | null): Show {
    return { kind, a, b, banner: headline, start: this.clock, beats: new Set(), seed: Math.random() };
  }

  /** True once, on the first frame at or after `at` seconds into the show. */
  private beat(s: Show, name: string, at: number): boolean {
    if (this.clock - s.start < at || s.beats.has(name)) return false;
    s.beats.add(name);
    return true;
  }

  /** Runs each show's timed moments, and steers the bubbles it's animating. */
  private updateShows(dt: number) {
    this.shows = this.shows.filter((s) => this.clock - s.start < SHOW_SECONDS[s.kind] && s.a.body.active && s.b.body.active);
    if (!this.shows.length && this.refitAfterShow) {
      this.refitAfterShow = false;
      this.fitKey = '';
    }
    for (const s of this.shows) {
      const age = this.clock - s.start;
      const c = this.showCenter(s);
      if (s.kind === 'baby') {
        const baby = s.a;
        if (age < BABY_DESCENT) {
          const k = age / BABY_DESCENT;
          const e = 1 - (1 - k) * (1 - k);
          baby.drop = -BABY_DROP * (1 - e);
          baby.dropV = 0;
          baby.sway = Math.sin(age * 6 + s.seed * 6) * 16 * (1 - e);
          baby.scale = 1;
          baby.scaleV = 0;
        } else if (this.beat(s, 'land', BABY_DESCENT)) {
          baby.drop = 0;
          baby.dropV = 0;
          baby.sway = 0;
          // Squash on landing, then the spring pops it up big.
          baby.scale = 0.7;
          baby.scaleV = 12;
          if (s.parent?.body.active) s.parent.scaleV += 6;
          for (const b of this.balloonSpots(s)) {
            const p = this.particle('balloon', b.x, b.y, (b.x - c.x) * 1.2 + (Math.random() - 0.5) * 20, -40, b.color, 2.6, 12);
            this.add({ ...p, gravity: -110, drag: 0.3, vr: 2 + Math.random() * 2 });
          }
          if (s.banner) this.flash(0.35);
          this.waves(c, baby.color);
          this.cannon(c.x, c.y, 46, [baby.color, '#ffffff', GOLD, baby.color]);
          this.burst('star', baby, 16, [baby.color, '#ffffff', GOLD], 130, 1.6);
        }
      } else if (s.kind === 'star') {
        const a = s.a;
        if (age < STAR_FALL) {
          a.scale = 0;
          a.scaleV = 0;
        } else if (this.beat(s, 'impact', STAR_FALL)) {
          a.scale = 0.2;
          a.scaleV = 14;
          this.flash(0.4);
          this.waves(c, GOLD);
          this.burst('sparkle', a, 26, [a.color, GOLD, '#ffffff'], 150, 1.6);
          this.cannon(c.x, c.y, 30, [a.color, GOLD, '#ffffff']);
        }
      } else {
        if (this.beat(s, 'clink', RING_MEET)) {
          const r = this.ringPoint(s);
          if (s.banner) this.flash(0.4);
          s.a.scaleV += 7;
          if (s.b !== s.a) s.b.scaleV += 7;
          this.explode(r.x, r.y, GOLD, 'ring', 26, 110);
        }
        FIREWORKS.forEach((at, i) => {
          if (this.beat(s, `firework${i}`, at)) this.rocket(s, c, i);
        });
        // Hearts float up from the couple, and confetti rains down over everything.
        if (age < 1.7 && Math.random() < 0.6) {
          const colors = [s.a.color, s.b.color, '#FF6F9F'];
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
          const speed = 60 + Math.random() * 80;
          this.add(this.particle('heart', c.x + (Math.random() - 0.5) * 40, c.y - 10, Math.cos(angle) * speed, Math.sin(angle) * speed, colors[Math.floor(Math.random() * 3)], 1.8, 9 + Math.random() * 6));
        }
        if (s.banner && age > RING_MEET && age < 2.5) {
          const colors = [s.a.color, s.b.color, GOLD, '#ffffff', '#FF6F9F'];
          for (let n = dt * 80; n > 0; n--) {
            if (n < 1 && Math.random() > n) break;
            const p = this.particle('confetti', Math.random() * this.width, -10, (Math.random() - 0.5) * 60, 60 + Math.random() * 70, colors[Math.floor(Math.random() * colors.length)], 4.5, 6 + Math.random() * 3);
            this.add({ ...p, gravity: 30, drag: 0.4, vr: (Math.random() - 0.5) * 10 });
          }
        }
      }
    }
  }

  /** Where a show is happening: the newborn, or between the couple. */
  private showCenter(s: Show): Pt {
    const a = s.a.body;
    const b = s.b.body;
    if (s.kind === 'baby') return { x: a.x + s.a.sway, y: a.y + s.a.drop };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /** Where the wedding rings meet, just above the couple. */
  private ringPoint(s: Show): Pt {
    const c = this.showCenter(s);
    return { x: c.x, y: Math.min(s.a.body.y, s.b.body.y) - FRIEND_R - 26 };
  }

  /** The three balloons a newborn floats down on. */
  private balloonSpots(s: Show): { x: number; y: number; color: string }[] {
    const c = this.showCenter(s);
    const t = this.clock * 3 + s.seed * 10;
    const color = s.a.color;
    return [
      { x: c.x - 18 + Math.sin(t) * 2, y: c.y - 50 + Math.cos(t * 1.3) * 2, color },
      { x: c.x + Math.sin(t + 2) * 2, y: c.y - 64 + Math.cos(t + 1) * 2, color: '#FDE68A' },
      { x: c.x + 18 + Math.sin(t + 4) * 2, y: c.y - 50 + Math.cos(t * 1.1 + 3) * 2, color },
    ];
  }

  private flash(strength: number) {
    this.flashAt = this.clock;
    this.flashStrength = this.reducedMotion.matches ? strength * 0.25 : strength;
  }

  /** Two shockwave rings spreading out from a point. */
  private waves(c: Pt, color: string) {
    this.add({ ...this.particle('wave', c.x, c.y, 0, 0, color, 0.9, FRIEND_R), grow: 150 });
    const late = this.particle('wave', c.x, c.y, 0, 0, '#ffffff', 1.1, FRIEND_R);
    this.add({ ...late, born: this.clock + 0.12, grow: 190 });
  }

  /** Confetti shot up into the air from a point. */
  private cannon(x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 220 + Math.random() * 260;
      const p = this.particle('confetti', x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, colors[i % colors.length], 2.2 + Math.random() * 0.8, 6 + Math.random() * 3);
      this.add({ ...p, gravity: 260, drag: 2.2, vr: (Math.random() - 0.5) * 14 });
    }
  }

  /** A firework rocket that climbs from below the couple and bursts above them. */
  private rocket(s: Show, c: Pt, i: number) {
    const colors = [s.a.color, GOLD, s.b === s.a ? '#FF6F9F' : s.b.color, '#FF6F9F'];
    const color = colors[i % colors.length];
    const fromX = c.x + (Math.random() - 0.5) * 160;
    const fromY = Math.min(this.height - 20, c.y + 70);
    const toX = Math.max(40, Math.min(this.width - 40, c.x + (Math.random() - 0.5) * 260));
    const toY = Math.max(50, c.y - 120 - Math.random() * 90);
    const climb = 0.45;
    const p = this.particle('rocket', fromX, fromY, (toX - fromX) / climb, (toY - fromY) / climb, color, climb, 2.5);
    this.add({ ...p, gravity: 0, drag: 0, onDone: () => this.explode(toX, toY, color, i % 2 ? 'heart' : 'ring', 42, 150) });
  }

  /** A firework burst of streaking sparks, round or heart-shaped. */
  private explode(x: number, y: number, color: string, shape: 'ring' | 'heart', n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      let vx: number;
      let vy: number;
      if (shape === 'heart') {
        vx = 16 * Math.sin(t) ** 3;
        vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        vx *= speed / 16;
        vy *= speed / 16;
      } else {
        const v = speed * (0.85 + Math.random() * 0.3);
        vx = Math.cos(t) * v;
        vy = Math.sin(t) * v;
      }
      const p = this.particle('spark', x, y, vx, vy, i % 4 === 0 ? '#ffffff' : color, 1.2 + Math.random() * 0.4, 2.4);
      this.add({ ...p, gravity: 45, drag: 1.5 });
    }
    this.add({ ...this.particle('wave', x, y, 0, 0, color, 0.5, 4), grow: 60 });
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
    this.drawShowsBehind();
    this.drawWeddingHalos();
    this.drawTethers();
    const order = this.actors.filter((a) => a.body.active).sort((x, y) => Number(!!x.flight) - Number(!!y.flight) || y.body.r - x.body.r);
    for (const actor of order) this.drawBubble(actor);
    this.drawParticles(dt);
    this.drawShowsInFront();
    this.drawLabels();
    this.drawBanners();
    this.drawFlash();
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
      const a = shifted(arc(this.projectPlace(leg.from), this.projectPlace(leg.to)), laneOffset(leg.lane, leg.laneCount, TRACE_LANE));
      let upto = 1;
      if (actor.flight?.leg === leg) {
        // The bubble trails its flight path a little on its spring, so the line stops where the
        // bubble actually is instead of running out ahead of it.
        const timed = easeInOut(Math.min(1, (this.clock - actor.flight.start) / FLIGHT_SECONDS));
        upto = Math.min(timed, nearestOnArc(a, actor.body.x, actor.body.y, timed));
      }
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
    const x = b.x + actor.sway;
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
  }

  /** Fades a show in over its first moment and out over its last. */
  private showFade(s: Show): number {
    const age = this.clock - s.start;
    return Math.max(0, Math.min(1, age / 0.35, (SHOW_SECONDS[s.kind] - age) / 0.8));
  }

  private landing(s: Show): number {
    return s.kind === 'baby' ? BABY_DESCENT : s.kind === 'star' ? STAR_FALL : RING_MEET;
  }

  /** The big heart behind a wedding couple. */
  private drawShowsBehind() {
    const ctx = this.ctx;
    for (const s of this.shows) {
      const age = this.clock - s.start;
      const fade = this.showFade(s);
      const c = this.showCenter(s);
      const wedding = s.kind === 'wedding';
      const half = Math.hypot(s.b.body.x - s.a.body.x, s.b.body.y - s.a.body.y) / 2;
      const since = age - this.landing(s);
      if (since < 0) continue;
      const on = Math.min(1, since * 3) * fade;
      if (wedding) {
        const pop = backOut(Math.min(1, since / 0.45));
        // A double thump, like a heartbeat.
        const thump = 1 + 0.09 * Math.abs(Math.sin(since * Math.PI * 1.4)) ** 8;
        const size = (half * 2 + FRIEND_R * 2 + 56) * pop * thump;
        heart(ctx, c.x, c.y + size * 0.06, size, withAlpha('#FF5E8A', 0.3 * on));
      }
    }
  }

  private drawWeddingHalos() {
    const ctx = this.ctx;
    for (const w of this.shows) {
      if (w.kind !== 'wedding') continue;
      const age = this.clock - w.start;
      const alpha = this.showFade(w);
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

  /** Balloons, the shooting star and the wedding rings, in front of the bubbles. */
  private drawShowsInFront() {
    const ctx = this.ctx;
    for (const s of this.shows) {
      const age = this.clock - s.start;
      const c = this.showCenter(s);
      if (s.kind === 'baby' && age < BABY_DESCENT) {
        const tieY = c.y - CHILD_R - 2;
        for (const b of this.balloonSpots(s)) balloon(ctx, b.x, b.y, 12, b.color, c.x, tieY);
      } else if (s.kind === 'star' && age < STAR_FALL) {
        const k = age / STAR_FALL;
        const e = k * k;
        const fromX = c.x + 240;
        const fromY = c.y - 300;
        const x = fromX + (c.x - fromX) * e;
        const y = fromY + (c.y - fromY) * e;
        const tail = Math.max(0, e - 0.3);
        const tx = fromX + (c.x - fromX) * tail;
        const ty = fromY + (c.y - fromY) * tail;
        const g = ctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, 'rgba(255,216,107,0)');
        g.addColorStop(1, 'rgba(255,216,107,0.95)');
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();
        star(ctx, x, y, 11, age * 8, '#FFD86B');
        star(ctx, x, y, 5, age * 8, '#ffffff');
      } else if (s.kind === 'wedding') {
        const r = this.ringPoint(s);
        ctx.save();
        ctx.globalAlpha = this.showFade(s);
        if (age < RING_MEET) {
          // Two rings fly in from either side, spinning, and clink together.
          const k = age / RING_MEET;
          const e = k * k;
          for (const side of [-1, 1]) {
            const x = r.x + side * (150 - 143 * e);
            const y = r.y - 120 * (1 - e) - Math.sin(Math.PI * k) * 30;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(Math.max(0.15, Math.abs(Math.cos(age * 14 + side))), 1);
            weddingRing(ctx, 0, 0, 15);
            ctx.restore();
          }
        } else {
          const since = age - RING_MEET;
          const size = 15 * (1 + 0.45 * Math.exp(-since * 6));
          const y = r.y - since * 8;
          weddingRing(ctx, r.x - 7, y, size);
          weddingRing(ctx, r.x + 7, y + 2, size);
        }
        ctx.restore();
      }
    }
  }

  /** The big headline that pops in as each show lands. */
  private drawBanners() {
    const ctx = this.ctx;
    for (const s of this.shows) {
      if (!s.banner) continue;
      const age = this.clock - s.start;
      const since = age - this.landing(s);
      if (since < 0) continue;
      const c = this.showCenter(s);
      const wedding = s.kind === 'wedding';
      const font = wedding ? "italic 700 34px Georgia, 'Times New Roman', serif" : '800 30px Inter, system-ui, sans-serif';
      ctx.font = font;
      const half = ctx.measureText(s.banner).width / 2 + 10;
      const x = Math.max(half, Math.min(this.width - half, c.x));
      const above = wedding ? Math.min(s.a.body.y, s.b.body.y) - FRIEND_R - 82 : c.y - 70;
      const y = Math.max(34, above);
      const fill = s.kind === 'baby' ? s.a.color : '#C8920F';
      const alpha = Math.min(1, (SHOW_SECONDS[s.kind] - age) / 0.6);
      banner(ctx, s.banner, x, y, font, fill, alpha, backOut(Math.min(1, since / 0.5)), Math.sin(age * 2.6) * 0.05);
    }
  }

  private drawFlash() {
    const age = this.clock - this.flashAt;
    if (age >= 0.35) return;
    const k = 1 - age / 0.35;
    this.ctx.fillStyle = `rgba(255,255,255,${this.flashStrength * k * k})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    const alive: Particle[] = [];
    const done: Particle[] = [];
    for (const p of this.particles) (this.clock - p.born < p.life ? alive : done).push(p);
    this.particles = alive;
    for (const p of done) p.onDone?.();
    for (const p of alive) {
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const age = (this.clock - p.born) / p.life;
      if (age < 0) continue;
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
          // Flipping end over end as it flutters.
          ctx.scale(1, Math.cos(p.rot * 1.7) || 0.1);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        case 'wave':
          ctx.globalAlpha = 0.6 * (1 - age);
          ring(ctx, p.x, p.y, p.size + age * (p.grow ?? 55), p.color, 3 * (1 - age) + 0.5);
          break;
        case 'balloon':
          balloon(ctx, p.x, p.y, p.size, p.color, p.x + Math.sin(p.rot) * 5, p.y + p.size * 3.2);
          break;
        case 'spark':
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (1 - age * 0.6);
          ctx.lineCap = 'round';
          ctx.stroke();
          break;
        case 'rocket':
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = withAlpha(p.color, 0.7);
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
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
      this.add({ ...p, follow: from });
    }
  }

  private add(p: Particle) {
    if (this.particles.length < MAX_PARTICLES) this.particles.push(p);
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
    return { top: 110, bottom: 110, left: 90, right: 90 };
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
      dots: this.dots,
      view: this.view,
      hidden: [...this.hidden],
    };
  }

  private emit() {
    this.state = this.snapshot();
    for (const fn of this.listeners) fn();
  }
}

/** How far along an arc (0 to 1, searching up to `max`) the point closest to (x, y) is. */
function nearestOnArc(a: ReturnType<typeof arc>, x: number, y: number, max: number): number {
  const steps = 64;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * max;
    const p = pointAt(a, s);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
