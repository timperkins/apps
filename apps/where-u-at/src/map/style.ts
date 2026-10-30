// The base map: bundled Natural Earth country shapes (no tile server or API key), styled softly
// so the colored faces carry the picture.
import type { StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection, MultiLineString } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';

export interface Theme {
  dark: boolean;
  water: string;
  land: string;
  border: string;
  coast: string;
  graticule: string;
  ink: string;
  muted: string;
  panel: string;
  labelBg: string;
}

export const LIGHT: Theme = {
  dark: false,
  water: '#dde7ea',
  land: '#f7f4ee',
  border: '#d9d1c3',
  coast: '#c9c0b0',
  graticule: 'rgba(120, 140, 150, 0.12)',
  ink: '#22262b',
  muted: '#6b7178',
  panel: 'rgba(255, 255, 255, 0.82)',
  labelBg: 'rgba(255, 255, 255, 0.94)',
};

export const DARK: Theme = {
  dark: true,
  water: '#0d141b',
  land: '#1c242d',
  border: '#2e3944',
  coast: '#36424e',
  graticule: 'rgba(160, 180, 200, 0.07)',
  ink: '#eef1f4',
  muted: '#9aa3ad',
  panel: 'rgba(22, 28, 36, 0.82)',
  labelBg: 'rgba(28, 35, 44, 0.95)',
};

const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }>; land: GeometryCollection }>;
const countries = feature(topo, topo.objects.countries) as FeatureCollection;
countries.features = countries.features.filter((f) => f.properties?.name !== 'Antarctica');
countries.features.forEach((f) => {
  const g = f.geometry;
  if (g.type === 'Polygon') g.coordinates = g.coordinates.map(unwrapRing);
  if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map((poly) => poly.map(unwrapRing));
});

/**
 * Rings that cross the date line (Russia, Fiji) jump from 180 to -180 and back, which the map
 * draws as a band across the whole world. Shift points by 360 degrees so each ring is continuous.
 */
function unwrapRing(ring: number[][]): number[][] {
  let shift = 0;
  return ring.map(([lng, lat], i) => {
    if (i > 0) {
      const prev = ring[i - 1][0];
      if (lng - prev > 180) shift -= 360;
      else if (prev - lng > 180) shift += 360;
    }
    return [lng + shift, lat];
  });
}
const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);

function graticule(): FeatureCollection<MultiLineString> {
  const lines: number[][][] = [];
  for (let lng = -180; lng <= 180; lng += 30) lines.push(Array.from({ length: 33 }, (_, i) => [lng, -80 + i * 5]));
  for (let lat = -60; lat <= 80; lat += 20) lines.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } }] };
}

export function mapStyle(theme: Theme): StyleSpecification {
  return {
    version: 8,
    sources: {
      countries: { type: 'geojson', data: countries },
      borders: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: borders } },
      graticule: { type: 'geojson', data: graticule() },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': theme.water } },
      { id: 'graticule', type: 'line', source: 'graticule', paint: { 'line-color': theme.graticule, 'line-width': 1 } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': theme.land, 'fill-antialias': true } },
      { id: 'coast', type: 'line', source: 'countries', paint: { 'line-color': theme.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.2] } },
      { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': theme.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1] } },
    ],
  };
}
