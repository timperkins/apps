import { describe, expect, it } from 'vitest';
import { BABY_BOY, BABY_GIRL, events, people } from './index';
import { colorDistance, hueChroma } from '../engine/color';
import { monthIndex } from '../engine/time';

const byId = new Map(people.map((p) => [p.id, p]));

describe('data', () => {
  it('has unique ids', () => {
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it('names only known people, with valid dates and places', () => {
    for (const e of events) {
      expect(() => monthIndex(e.date)).not.toThrow();
      for (const id of e.people) expect(byId.has(id), `${e.id} names ${id}`).toBe(true);
      if (e.place) {
        expect(Math.abs(e.place.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(e.place.lng)).toBeLessThanOrEqual(180);
        expect(e.place.name.length).toBeGreaterThan(0);
      }
      if (e.type !== 'birth') expect(e.place, e.id).toBeDefined();
      if (e.type === 'marriage') expect(e.people).toHaveLength(2);
    }
  });

  it('gives everyone exactly one birth, before any of their other events', () => {
    for (const p of people) {
      const births = events.filter((e) => e.type === 'birth' && e.people[0] === p.id);
      expect(births, p.id).toHaveLength(1);
      const born = monthIndex(births[0].date);
      for (const e of events.filter((e) => e.type !== 'birth' && e.people.includes(p.id))) {
        expect(monthIndex(e.date), `${p.id} ${e.id}`).toBeGreaterThanOrEqual(born);
      }
      if (p.kind === 'friend') expect(births[0].place, p.id).toBeDefined();
    }
  });

  it('gives every child a mother who is a friend born before them', () => {
    for (const p of people) {
      if (p.kind !== 'child') continue;
      const mother = byId.get(p.motherId);
      expect(mother?.kind, p.id).toBe('friend');
      const birth = (id: string) => monthIndex(events.find((e) => e.type === 'birth' && e.people[0] === id)!.date);
      expect(birth(p.id) - birth(p.motherId)).toBeGreaterThan(16 * 12);
      // Children follow their mother, so they never appear in moves or marriages.
      expect(events.some((e) => e.type !== 'birth' && e.people.includes(p.id))).toBe(false);
    }
  });

  it('gives friends distinct colors that are neither pink nor blue', () => {
    const colors = people.flatMap((p) => (p.kind === 'friend' ? [p.color] : []));
    expect(new Set(colors).size).toBe(colors.length);
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        expect(colorDistance(colors[i], colors[j]), `${colors[i]} vs ${colors[j]}`).toBeGreaterThan(0.06);
      }
      expect(colorDistance(colors[i], BABY_GIRL), colors[i]).toBeGreaterThan(0.12);
      expect(colorDistance(colors[i], BABY_BOY), colors[i]).toBeGreaterThan(0.12);
      const { hue, chroma } = hueChroma(colors[i]);
      if (chroma > 0.05) {
        expect(hue > 340 || hue < 0, `${colors[i]} looks pink`).toBe(false);
        expect(hue > 215 && hue < 275, `${colors[i]} looks blue (hue ${hue.toFixed(0)})`).toBe(false);
      }
    }
  });
});
