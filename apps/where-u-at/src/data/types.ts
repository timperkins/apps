// Shapes of data/people.json and data/events.json.

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export interface Friend {
  id: string;
  name: string;
  kind: 'friend';
  /** Ring and trace color. Unique per friend, never pink or blue (those are for babies). */
  color: string;
  /** Path relative to the site root, e.g. "faces/tim.jpg", or an absolute URL. Empty shows initials. */
  photo: string;
  order: number;
}

export interface Child {
  id: string;
  name: string;
  kind: 'child';
  sex: 'female' | 'male';
  /** The parent a child is always drawn with: the mother, or the father when she isn't in the app. */
  motherId: string;
  order: number;
}

export type Person = Friend | Child;

/** Year and month, "YYYY-MM". */
export type MonthString = string;

export interface BirthEvent {
  id: string;
  type: 'birth';
  date: MonthString;
  /** One friend, or one or more children born together (twins). */
  people: string[];
  /** Required for friends; children are born wherever their mother is. */
  place?: Place;
}

export interface MarriageEvent {
  id: string;
  type: 'marriage';
  date: MonthString;
  /** Both partners, or just one when the spouse isn't in the app. */
  people: string[];
  /** Where the wedding was. Nobody moves there: the couple stays where they live. */
  place?: Place;
}

export interface MoveEvent {
  id: string;
  type: 'move';
  date: MonthString;
  /** Everyone who moves together, e.g. both partners of a couple. */
  people: string[];
  place: Place;
}

export type LifeEvent = BirthEvent | MarriageEvent | MoveEvent;
