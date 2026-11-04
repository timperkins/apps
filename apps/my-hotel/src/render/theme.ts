import type { MapId } from '../sim/hotel';

export interface Theme {
  id: MapId;
  name: string;
  blurb: string;
  bg: string;
  ground: string;
  floorA: string;
  floorB: string;
  floorPattern: 'terrazzo' | 'planks';
  wall: string;
  trim: string;
  accent: string;
  accent2: string;
  rug: string;
  blankets: string[];
  sun: string;
  hemiSky: string;
  hemiGround: string;
  outside: 'beach' | 'city' | 'snow' | 'garden';
}

export const THEMES: Record<MapId, Theme> = {
  seaside: {
    id: 'seaside',
    name: 'Seaside',
    blurb: 'Sand, palms and sea breeze.',
    bg: '#8fd3ea', ground: '#f3d59b',
    floorA: '#f6efe4', floorB: '#e9dccb', floorPattern: 'terrazzo',
    wall: '#fff6ea', trim: '#ff8a65', accent: '#26a69a', accent2: '#ffca28', rug: '#ff8a65',
    blankets: ['#26a69a', '#ff8a65', '#ffca28', '#7e57c2'],
    sun: '#fff1d6', hemiSky: '#cdefff', hemiGround: '#f3d59b', outside: 'beach',
  },
  city: {
    id: 'city',
    name: 'City',
    blurb: 'A boutique hotel on a busy street.',
    bg: '#c9d6e3', ground: '#a9b3be',
    floorA: '#c98d5a', floorB: '#b57a49', floorPattern: 'planks',
    wall: '#f1e4d3', trim: '#2f4858', accent: '#e4572e', accent2: '#76b041', rug: '#e4572e',
    blankets: ['#e4572e', '#2f4858', '#76b041', '#f2c14e'],
    sun: '#fff4e6', hemiSky: '#e8f0ff', hemiGround: '#9aa5b1', outside: 'city',
  },
  lodge: {
    id: 'lodge',
    name: 'Lodge',
    blurb: 'A cozy cabin in the snowy hills.',
    bg: '#cfe3f2', ground: '#f4f8fb',
    floorA: '#8d5b3a', floorB: '#7a4c2f', floorPattern: 'planks',
    wall: '#c98b55', trim: '#5d3a22', accent: '#c0392b', accent2: '#f39c12', rug: '#c0392b',
    blankets: ['#c0392b', '#2e7d32', '#f39c12', '#1565c0'],
    sun: '#ffe8cc', hemiSky: '#e3f1ff', hemiGround: '#f4f8fb', outside: 'snow',
  },
  garden: {
    id: 'garden',
    name: 'Garden',
    blurb: 'Flower beds and a quiet pond. No VIPs here.',
    bg: '#bfe6b0', ground: '#8ccf6e',
    floorA: '#f3ead7', floorB: '#e4d6b8', floorPattern: 'planks',
    wall: '#fffaf0', trim: '#6d8b3a', accent: '#ec6f9a', accent2: '#ffd54f', rug: '#ec6f9a',
    blankets: ['#ec6f9a', '#6d8b3a', '#ffd54f', '#7e9ce6'],
    sun: '#fff8e1', hemiSky: '#e6f7ff', hemiGround: '#8ccf6e', outside: 'garden',
  },
};
