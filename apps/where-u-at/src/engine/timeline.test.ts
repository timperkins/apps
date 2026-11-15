import { describe, expect, it } from 'vitest';
import type { LifeEvent, Person, Place } from '../data/types';
import { Timeline } from './timeline';
import { formatMonth, monthIndex, parseDateInput } from './time';
import { events as realEvents, people as realPeople } from '../data/index';

const P = (name: string, lat: number, lng: number): Place => ({ name, lat, lng });
const lisbon = P('Lisbon', 38.7, -9.1);
const tokyo = P('Tokyo', 35.7, 139.7);
const paris = P('Paris', 48.9, 2.4);
const bali = P('Bali', -8.4, 115.2);

const people: Person[] = [
  { id: 'ann', name: 'Ann', kind: 'friend', color: '#E5484D', photo: '', order: 0 },
  { id: 'bob', name: 'Bob', kind: 'friend', color: '#2E9E5B', photo: '', order: 1 },
  { id: 'kid', name: 'Kid', kind: 'child', sex: 'female', motherId: 'ann', order: 2 },
];
const events: LifeEvent[] = [
  { id: '1', type: 'birth', date: '1990-03', people: ['ann'], place: lisbon },
  { id: '2', type: 'birth', date: '1990-03', people: ['bob'], place: tokyo },
  { id: '3', type: 'move', date: '2010-01', people: ['bob'], place: paris },
  { id: '4', type: 'marriage', date: '2012-06', people: ['ann', 'bob'], place: bali },
  { id: '5', type: 'move', date: '2012-07', people: ['ann', 'bob'], place: paris },
  { id: '6', type: 'birth', date: '2014-02', people: ['kid'] },
  { id: '7', type: 'move', date: '2016-09', people: ['ann', 'bob'], place: tokyo },
];
const tl = new Timeline(people, events, monthIndex('2026-10'));
const at = (date: string) => monthIndex(date) + 0.99;

describe('time', () => {
  it('parses what people type', () => {
    expect(parseDateInput('2014')).toBe(monthIndex('2014-01'));
    expect(parseDateInput('June 2014')).toBe(monthIndex('2014-06'));
    expect(parseDateInput('jun 2014')).toBe(monthIndex('2014-06'));
    expect(parseDateInput('2014 sept')).toBe(monthIndex('2014-09'));
    expect(parseDateInput('2014-06')).toBe(monthIndex('2014-06'));
    expect(parseDateInput('6/2014')).toBe(monthIndex('2014-06'));
    expect(parseDateInput('2014-13')).toBeNull();
    expect(parseDateInput('soon')).toBeNull();
  });

  it('formats a month', () => {
    expect(formatMonth(monthIndex('2014-06') + 0.7)).toBe('June 2014');
  });
});

describe('Timeline', () => {
  it('spreads events in the same month across it, in list order', () => {
    const [a, b] = tl.events;
    expect(a.event.id).toBe('1');
    expect(a.t).toBeCloseTo(monthIndex('1990-03') + 0.25);
    expect(b.t).toBeCloseTo(monthIndex('1990-03') + 0.75);
  });

  it('shows nobody before they are born', () => {
    expect(tl.placeAt('ann', monthIndex('1989-01'))).toBeNull();
    expect(tl.presentAt(at('1995-01')).sort()).toEqual(['ann', 'bob']);
  });

  it('keeps people at their latest place', () => {
    expect(tl.placeAt('bob', at('2009-12'))).toEqual(tokyo);
    expect(tl.placeAt('bob', at('2010-01'))).toEqual(paris);
    // The wedding is in Bali, but nobody moves there.
    expect(tl.placeAt('ann', at('2012-06'))).toEqual(lisbon);
    expect(tl.placeAt('ann', at('2012-07'))).toEqual(paris);
    expect(tl.placeAt('ann', at('2020-01'))).toEqual(tokyo);
  });

  it('keeps children with their mother', () => {
    expect(tl.placeAt('kid', at('2014-01'))).toBeNull();
    expect(tl.placeAt('kid', at('2014-02'))).toEqual(paris);
    expect(tl.placeAt('kid', at('2017-01'))).toEqual(tokyo);
  });

  it('gives couples who move together side-by-side lanes', () => {
    const toTokyo = tl.legs.filter((l) => l.eventId === '7');
    expect(toTokyo.map((l) => [l.personId, l.lane, l.laneCount])).toEqual([
      ['ann', 0, 2],
      ['bob', 1, 2],
    ]);
    // Moving in together from different cities: separate trips, one lane each.
    const toParis = tl.legs.filter((l) => l.eventId === '5');
    expect(toParis.map((l) => [l.personId, l.laneCount])).toEqual([['ann', 1]]);
    expect(tl.legs.some((l) => l.eventId === '4')).toBe(false);
  });

  it('lists the events crossed between two times', () => {
    expect(tl.eventsBetween(at('2012-05'), at('2012-07')).map((e) => e.event.id)).toEqual(['4', '5']);
  });

  it('lets a spouse with no birth join at the wedding, where their partner lives', () => {
    const joiner = new Timeline(
      [...people, { id: 'cy', name: 'Cy', kind: 'friend', color: '#8E44AD', photo: '', order: 3 }],
      [...events, { id: '8', type: 'marriage', date: '2020-01', people: ['bob', 'cy'] }, { id: '9', type: 'move', date: '2021-01', people: ['bob', 'cy'], place: paris }],
      monthIndex('2026-10'),
    );
    expect(joiner.placeAt('cy', at('2019-12'))).toBeNull();
    expect(joiner.placeAt('cy', at('2020-01'))).toEqual(tokyo);
    expect(joiner.placeAt('cy', at('2021-01'))).toEqual(paris);
    expect(joiner.legs.filter((l) => l.eventId === '9').map((l) => l.laneCount)).toEqual([2, 2]);
  });

  it('finds partners', () => {
    expect(tl.partnerOf('ann')).toBe('bob');
  });

  it('loads the bundled data', () => {
    const real = new Timeline(realPeople, realEvents, monthIndex('2026-10'));
    expect(real.presentAt(monthIndex('2026-10')).length).toBe(realPeople.length);
  });
});
