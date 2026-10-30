import peopleJson from './people.json';
import eventsJson from './events.json';
import type { LifeEvent, Person } from './types';

export const people = peopleJson as Person[];
export const events = eventsJson as LifeEvent[];

export const BABY_GIRL = '#F472B6';
export const BABY_BOY = '#60A5FA';
