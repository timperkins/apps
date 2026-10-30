#!/usr/bin/env node
// Writes made-up data for 10 couples to src/data/*.json and their avatars to public/faces/.
// Seeded, so running it again gives the same result. Replace with the real data later.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

let seed = 20261030;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];

const C = (name, lat, lng) => ({ name, lat, lng });
const CITY = {
  lisbon: C('Lisbon, Portugal', 38.72, -9.14),
  london: C('London, UK', 51.51, -0.13),
  paris: C('Paris, France', 48.86, 2.35),
  berlin: C('Berlin, Germany', 52.52, 13.4),
  stockholm: C('Stockholm, Sweden', 59.33, 18.07),
  rome: C('Rome, Italy', 41.9, 12.5),
  madrid: C('Madrid, Spain', 40.42, -3.7),
  amsterdam: C('Amsterdam, Netherlands', 52.37, 4.9),
  lagos: C('Lagos, Nigeria', 6.52, 3.38),
  accra: C('Accra, Ghana', 5.6, -0.19),
  nairobi: C('Nairobi, Kenya', -1.29, 36.82),
  capeTown: C('Cape Town, South Africa', -33.92, 18.42),
  cairo: C('Cairo, Egypt', 30.04, 31.24),
  istanbul: C('Istanbul, Turkey', 41.01, 28.98),
  dubai: C('Dubai, UAE', 25.2, 55.27),
  mumbai: C('Mumbai, India', 19.08, 72.88),
  bangalore: C('Bangalore, India', 12.97, 77.59),
  singapore: C('Singapore', 1.35, 103.82),
  bangkok: C('Bangkok, Thailand', 13.76, 100.5),
  hongKong: C('Hong Kong', 22.32, 114.17),
  shanghai: C('Shanghai, China', 31.23, 121.47),
  seoul: C('Seoul, South Korea', 37.57, 126.98),
  tokyo: C('Tokyo, Japan', 35.68, 139.69),
  osaka: C('Osaka, Japan', 34.69, 135.5),
  sydney: C('Sydney, Australia', -33.87, 151.21),
  melbourne: C('Melbourne, Australia', -37.81, 144.96),
  auckland: C('Auckland, New Zealand', -36.85, 174.76),
  vancouver: C('Vancouver, Canada', 49.28, -123.12),
  seattle: C('Seattle, USA', 47.61, -122.33),
  sf: C('San Francisco, USA', 37.77, -122.42),
  la: C('Los Angeles, USA', 34.05, -118.24),
  denver: C('Denver, USA', 39.74, -104.99),
  austin: C('Austin, USA', 30.27, -97.74),
  chicago: C('Chicago, USA', 41.88, -87.63),
  toronto: C('Toronto, Canada', 43.65, -79.38),
  nyc: C('New York, USA', 40.71, -74.01),
  boston: C('Boston, USA', 42.36, -71.06),
  mexicoCity: C('Mexico City, Mexico', 19.43, -99.13),
  bogota: C('Bogotá, Colombia', 4.71, -74.07),
  lima: C('Lima, Peru', -12.05, -77.04),
  saoPaulo: C('São Paulo, Brazil', -23.55, -46.63),
  buenosAires: C('Buenos Aires, Argentina', -34.6, -58.38),
  reykjavik: C('Reykjavík, Iceland', 64.15, -21.94),
  oslo: C('Oslo, Norway', 59.91, 10.75),
  dublin: C('Dublin, Ireland', 53.35, -6.26),
};
const WEDDING_SPOTS = [
  C('Santorini, Greece', 36.39, 25.46),
  C('Bali, Indonesia', -8.41, 115.19),
  C('Tuscany, Italy', 43.77, 11.25),
  C('Tulum, Mexico', 20.21, -87.47),
  C('Kyoto, Japan', 35.01, 135.77),
  C('Queenstown, New Zealand', -45.03, 168.66),
];
const BIG_CITIES = Object.keys(CITY);

// Unique friend colors. No pinks or blues: those mean baby girl and baby boy.
const COLORS = [
  '#E5484D', '#F76B15', '#F2A900', '#8DB600', '#2E9E5B', '#0F8A7E', '#7C5CFF', '#9E4FC9', '#8B5E3C', '#D08A4E',
  '#6E7F2A', '#9B2335', '#C2410C', '#365E40', '#C9A227', '#4A4A55', '#5B2A86', '#7FA88A', '#A3A3A3', '#3D2B1F',
];

const COUPLES = [
  [['Maya', 'Okafor'], ['Daniel', 'Reyes'], 'lagos', 'mexicoCity'],
  [['Priya', 'Nair'], ['Arjun', 'Mehta'], 'mumbai', 'bangalore'],
  [['Sofia', 'Rossi'], ['Mateo', 'García'], 'rome', 'buenosAires'],
  [['Amara', 'Mensah'], ['Kwame', 'Boateng'], 'accra', 'nairobi'],
  [['Hana', 'Kim'], ['Kenji', 'Watanabe'], 'seoul', 'osaka'],
  [['Elena', 'Petrova'], ['Luca', 'Bianchi'], 'istanbul', 'paris'],
  [['Zoe', 'Mitchell'], ['Theo', 'Walsh'], 'sydney', 'auckland'],
  [['Leila', 'Haddad'], ['Omar', 'Farouk'], 'cairo', 'dubai'],
  [['Ingrid', 'Larsen'], ['Lars', 'Eriksson'], 'oslo', 'reykjavik'],
  [['Camila', 'Souza'], ['Diego', 'Torres'], 'saoPaulo', 'lima'],
];
const GIRL_NAMES = ['Ada', 'Nia', 'Mila', 'Iris', 'Luna', 'Aria', 'Yuna', 'Esme', 'Noor', 'Lina', 'Ivy', 'Rosa'];
const BOY_NAMES = ['Leo', 'Kai', 'Eli', 'Noah', 'Felix', 'Ravi', 'Hugo', 'Sami', 'Jonah', 'Tomas', 'Ezra', 'Remy'];

const people = [];
const events = [];
let eventCount = 0;
const ev = (type, year, month, ids, place) => {
  const event = { id: `e${String(++eventCount).padStart(3, '0')}`, type, date: `${year}-${String(month).padStart(2, '0')}`, people: ids };
  if (place) event.place = place;
  events.push(event);
  return event;
};

function friend(first, last, order) {
  const id = `${first}-${last}`.toLowerCase().normalize('NFD').replace(/[^a-z-]/g, '');
  people.push({ id, name: `${first} ${last}`, kind: 'friend', color: COLORS[order], photo: `faces/${id}.svg`, order });
  return id;
}

// Specific stories so the data shows off the edge cases: two couples in London at the same time,
// a long ocean move (Sydney to New York), a destination wedding both partners fly to, and twins.
const SHARED_CITY = CITY.london;

COUPLES.forEach(([[wFirst, wLast], [hFirst, hLast], wHome, hHome], c) => {
  const wife = friend(wFirst, wLast, c * 2);
  const husband = friend(hFirst, hLast, c * 2 + 1);
  const wBorn = { y: int(1984, 1994), m: int(1, 12) };
  const hBorn = { y: Math.min(1994, Math.max(1984, wBorn.y + int(-2, 3))), m: int(1, 12) };
  ev('birth', wBorn.y, wBorn.m, [wife], CITY[wHome]);
  ev('birth', hBorn.y, hBorn.m, [husband], CITY[hHome]);

  // Solo years: university and first jobs, ending in the city where they meet.
  const meetCity = c === 0 || c === 5 ? SHARED_CITY : CITY[pick(BIG_CITIES)];
  const marriedYear = Math.min(2022, Math.max(wBorn.y, hBorn.y) + int(24, 30));
  for (const [id, born] of [[wife, wBorn], [husband, hBorn]]) {
    const solo = int(2, 4);
    let year = born.y + 18;
    for (let i = 0; i < solo - 1; i++) {
      year += int(1, 3);
      if (year >= marriedYear - 2) break;
      ev('move', year, int(1, 12), [id], CITY[pick(BIG_CITIES)]);
    }
    ev('move', marriedYear - int(1, 2), int(1, 6), [id], meetCity);
  }

  // The wedding: at home in the city they share, or somewhere far away (couple 2 always flies off).
  const destination = c === 2 || rand() < 0.35;
  const weddingPlace = destination ? pick(WEDDING_SPOTS) : meetCity;
  const weddingMonth = int(4, 10);
  ev('marriage', marriedYear, weddingMonth, [wife, husband], weddingPlace);
  let home = meetCity;
  if (destination) ev('move', marriedYear, weddingMonth + 1, [wife, husband], home);

  // Life together: moves and kids, interleaved by date.
  const moves = int(1, 4);
  const plan = [];
  let year = marriedYear;
  for (let i = 0; i < moves; i++) {
    year += int(1, 3);
    if (year > 2026) break;
    plan.push({ kind: 'move', y: year, m: int(1, 12) });
  }
  if (c === 6) plan.splice(0, plan.length, { kind: 'move', y: marriedYear + 1, m: 3, to: CITY.sydney }, { kind: 'move', y: marriedYear + 3, m: 8, to: CITY.nyc });
  // Couples 0 and 5 both met in London; keep couple 5 there long enough to overlap.
  if (c === 5) plan.forEach((step, i) => (step.y = Math.max(step.y, 2021 + i * 2)));
  const kids = c === 3 ? 3 : int(0, 3);
  let kidYear = marriedYear + int(1, 2);
  for (let k = 0; k < kids && kidYear <= 2025; k++) {
    plan.push({ kind: 'kid', y: kidYear, m: int(1, 12), twins: c === 3 && k === 1 });
    if (c === 3 && k === 1) k++;
    kidYear += int(2, 3);
  }
  plan.sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
  for (const step of plan) {
    if (step.kind === 'move') {
      let to = step.to ?? CITY[pick(BIG_CITIES)];
      while (to === home) to = CITY[pick(BIG_CITIES)];
      ev('move', step.y, step.m, [wife, husband], to);
      home = to;
    } else {
      for (let n = 0; n < (step.twins ? 2 : 1); n++) {
        const sex = rand() < 0.5 ? 'female' : 'male';
        const first = sex === 'female' ? GIRL_NAMES.splice(int(0, GIRL_NAMES.length - 1), 1)[0] : BOY_NAMES.splice(int(0, BOY_NAMES.length - 1), 1)[0];
        const id = `${first}-${hLast}`.toLowerCase().normalize('NFD').replace(/[^a-z-]/g, '');
        people.push({ id, name: `${first} ${hLast}`, kind: 'child', sex, motherId: wife, order: 100 + people.length });
        ev('birth', step.y, step.m, [id]);
      }
    }
  }
});

// Nothing in the future.
for (let i = events.length - 1; i >= 0; i--) if (events[i].date > '2026-10') events.splice(i, 1);
events.sort((a, b) => a.date.localeCompare(b.date));
events.forEach((e, i) => (e.id = `e${String(i + 1).padStart(3, '0')}`));

const dataDir = join(root, 'src', 'data');
writeFileSync(join(dataDir, 'people.json'), JSON.stringify(people, null, 2) + '\n');
writeFileSync(join(dataDir, 'events.json'), JSON.stringify(events, null, 2) + '\n');

// Avatars: simple illustrated faces, one per friend.
const SKIN = ['#F5D0B5', '#E8B894', '#D39A6A', '#B07848', '#8A5A35', '#5E3B22'];
const HAIR = ['#1F1A17', '#3B2618', '#6B4423', '#A0522D', '#D9A15B', '#2B2B2B', '#8C8C8C'];
const facesDir = join(root, 'public', 'faces');
mkdirSync(facesDir, { recursive: true });
people.filter((p) => p.kind === 'friend').forEach((p, i) => {
  const female = i % 2 === 0;
  writeFileSync(join(facesDir, `${p.id}.svg`), face({ skin: pick(SKIN), hair: pick(HAIR), female, style: int(0, 2), glasses: rand() < 0.25, beard: !female && rand() < 0.4, tint: p.color }));
});

function face({ skin, hair, female, style, glasses, beard, tint }) {
  const back = female
    ? [
        `<path d="M22 50 C20 22 80 22 78 50 L80 92 L20 92 Z" fill="${hair}"/>`,
        `<path d="M24 48 C22 20 78 20 76 48 L74 74 Q50 82 26 74 Z" fill="${hair}"/>`,
        `<circle cx="50" cy="20" r="11" fill="${hair}"/>`,
      ][style]
    : '';
  const front = female
    ? [
        `<path d="M27 46 C26 24 74 24 73 46 C64 34 44 30 27 46 Z" fill="${hair}"/>`,
        `<path d="M26 47 C28 22 72 22 74 47 C70 38 60 33 50 33 C40 33 30 38 26 47 Z" fill="${hair}"/>`,
        `<path d="M28 44 C30 26 70 26 72 44 C62 35 40 35 28 44 Z" fill="${hair}"/>`,
      ][style]
    : [
        `<path d="M28 44 C27 24 73 24 72 44 C66 36 58 34 50 34 C42 34 34 36 28 44 Z" fill="${hair}"/>`,
        `<path d="M27 42 C28 20 72 20 73 42 L68 36 L60 38 L52 33 L44 38 L36 35 Z" fill="${hair}"/>`,
        `<path d="M29 40 C32 26 68 26 71 40 C60 34 40 34 29 40 Z" fill="${hair}"/>`,
      ][style];
  const beardPath = beard ? `<path d="M31 58 C33 78 67 78 69 58 C64 70 36 70 31 58 Z" fill="${hair}" opacity="0.9"/>` : '';
  const specs = glasses
    ? `<g fill="none" stroke="#2a2a2a" stroke-width="2"><circle cx="40" cy="52" r="6.5"/><circle cx="60" cy="52" r="6.5"/><path d="M46.5 52 H53.5"/></g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" fill="${tint}" opacity="0.18"/><rect width="100" height="100" fill="#ffffff" opacity="0.55"/>
${back}
<rect x="42" y="68" width="16" height="14" fill="${skin}"/>
<path d="M18 100 C20 84 34 78 50 78 C66 78 80 84 82 100 Z" fill="${tint}"/>
<ellipse cx="50" cy="52" rx="23" ry="26" fill="${skin}"/>
<circle cx="27" cy="54" r="4" fill="${skin}"/><circle cx="73" cy="54" r="4" fill="${skin}"/>
${front}
<circle cx="40" cy="52" r="2.6" fill="#2a1d14"/><circle cx="60" cy="52" r="2.6" fill="#2a1d14"/>
<circle cx="34" cy="61" r="4" fill="#E9967A" opacity="0.35"/><circle cx="66" cy="61" r="4" fill="#E9967A" opacity="0.35"/>
<path d="M42 64 Q50 71 58 64" fill="none" stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round"/>
${beardPath}${specs}
</svg>
`;
}

console.log(`Wrote ${people.length} people and ${events.length} events.`);
