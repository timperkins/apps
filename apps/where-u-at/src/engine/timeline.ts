// Works out where everyone is at any point in time from the list of life events.
// Nothing here knows about the map or the screen, so it is easy to test.
import type { Friend, LifeEvent, Person, Place } from '../data/types';
import { monthIndex } from './time';

export interface TimedEvent {
  event: LifeEvent;
  /** Month index; events in the same month are spread across it in list order. */
  t: number;
}

export interface Stop {
  t: number;
  place: Place;
  eventId: string;
}

/** One trip from one place to another, drawn as an arc and left behind as a trace. */
export interface Leg {
  personId: string;
  from: Place;
  to: Place;
  t: number;
  eventId: string;
  /** Position among the people who made this same trip together, for side-by-side traces. */
  lane: number;
  laneCount: number;
}

export function samePlace(a: Place, b: Place): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

export class Timeline {
  readonly people: Map<string, Person>;
  readonly friends: Friend[];
  readonly events: TimedEvent[];
  readonly legs: Leg[];
  readonly start: number;
  readonly end: number;
  private readonly stops = new Map<string, Stop[]>();
  private readonly births = new Map<string, number>();
  private readonly childrenOf = new Map<string, string[]>();

  constructor(people: Person[], events: LifeEvent[], end: number) {
    this.people = new Map(people.map((p) => [p.id, p]));
    this.friends = people.filter((p): p is Friend => p.kind === 'friend').sort((a, b) => a.order - b.order);
    this.events = spreadWithinMonths(events);

    for (const p of people) {
      if (p.kind === 'child') {
        const list = this.childrenOf.get(p.motherId) ?? [];
        list.push(p.id);
        this.childrenOf.set(p.motherId, list);
      }
    }

    for (const { event, t } of this.events) {
      if (event.type === 'birth') for (const id of event.people) this.births.set(id, t);
      for (const id of event.people) {
        const person = this.people.get(id);
        if (!person) throw new Error(`Event ${event.id} names unknown person ${id}`);
        // Weddings happen away from home, so they don't move anyone.
        if (person.kind === 'child' || event.type === 'marriage' || !event.place) continue;
        const list = this.stops.get(id) ?? [];
        list.push({ t, place: event.place, eventId: event.id });
        this.stops.set(id, list);
      }
    }

    // A spouse we know nothing else about joins at the wedding, wherever their partner lives.
    for (const { event, t } of this.events) {
      if (event.type !== 'marriage') continue;
      for (const id of event.people) {
        if (this.births.has(id)) continue;
        const partner = event.people.find((p) => p !== id);
        const place = partner ? this.placeAt(partner, t) : null;
        if (!place) continue;
        this.births.set(id, t);
        this.stops.set(id, [{ t, place, eventId: event.id }, ...(this.stops.get(id) ?? [])]);
      }
    }

    this.legs = this.buildLegs();
    this.start = this.events.length ? Math.floor(this.events[0].t) - 6 : end - 12;
    this.end = end;
  }

  /** When someone was born, or joined at their wedding if we don't know their birth. */
  birthTime(id: string): number | undefined {
    return this.births.get(id);
  }

  children(motherId: string): string[] {
    return this.childrenOf.get(motherId) ?? [];
  }

  isBorn(id: string, t: number): boolean {
    const born = this.births.get(id);
    return born !== undefined && born <= t;
  }

  /** Where someone is at time t, or null before they are born. Children are wherever their mother is. */
  placeAt(id: string, t: number): Place | null {
    if (!this.isBorn(id, t)) return null;
    const person = this.people.get(id);
    if (!person) return null;
    if (person.kind === 'child') return this.placeAt(person.motherId, t);
    const stops = this.stops.get(id) ?? [];
    let place: Place | null = null;
    for (const stop of stops) {
      if (stop.t > t) break;
      place = stop.place;
    }
    return place;
  }

  /** Everyone on the map at time t. */
  presentAt(t: number): string[] {
    return [...this.people.keys()].filter((id) => this.placeAt(id, t) !== null);
  }

  /** Events with from < t <= to, in order. */
  eventsBetween(from: number, to: number): TimedEvent[] {
    return this.events.filter((e) => e.t > from && e.t <= to);
  }

  partnerOf(id: string): string | undefined {
    for (const { event } of this.events) {
      if (event.type === 'marriage' && event.people.includes(id)) {
        return event.people[0] === id ? event.people[1] : event.people[0];
      }
    }
    return undefined;
  }

  private buildLegs(): Leg[] {
    const legs: Leg[] = [];
    for (const friend of this.friends) {
      const stops = this.stops.get(friend.id) ?? [];
      for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1].place;
        const to = stops[i].place;
        if (samePlace(from, to)) continue;
        legs.push({ personId: friend.id, from, to, t: stops[i].t, eventId: stops[i].eventId, lane: 0, laneCount: 1 });
      }
    }
    // People who take the same trip in the same event get their own lane, in stable order.
    const groups = new Map<string, Leg[]>();
    for (const leg of legs) {
      const key = `${leg.eventId}|${leg.from.lat},${leg.from.lng}`;
      const group = groups.get(key) ?? [];
      group.push(leg);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => this.orderOf(a.personId) - this.orderOf(b.personId));
      group.forEach((leg, i) => {
        leg.lane = i;
        leg.laneCount = group.length;
      });
    }
    return legs.sort((a, b) => a.t - b.t);
  }

  private orderOf(id: string): number {
    return this.people.get(id)?.order ?? 0;
  }
}

function spreadWithinMonths(events: LifeEvent[]): TimedEvent[] {
  const byMonth = new Map<number, LifeEvent[]>();
  for (const event of events) {
    const m = monthIndex(event.date);
    const list = byMonth.get(m) ?? [];
    list.push(event);
    byMonth.set(m, list);
  }
  const timed: TimedEvent[] = [];
  for (const [m, list] of byMonth) {
    list.forEach((event, k) => timed.push({ event, t: m + (k + 0.5) / list.length }));
  }
  return timed.sort((a, b) => a.t - b.t);
}
