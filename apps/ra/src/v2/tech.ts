// What you can build, what it costs, and what you need first: the tech tree.
// Building something new opens up more of it, starting from the Foundry.
import type { BuildingKind } from './sprites';

export type Tab = 'base' | 'defense' | 'inf' | 'veh';

export interface Tech {
  id: string;
  name: string;
  tab: Tab;
  cost: number;
  needs: BuildingKind[]; // every one of these, built and standing
  building?: BuildingKind;
  blurb: string;
}

export const TABS: { id: Tab; label: string }[] = [
  { id: 'base', label: 'Base' },
  { id: 'defense', label: 'Defense' },
  { id: 'inf', label: 'Infantry' },
  { id: 'veh', label: 'Vehicles' },
];

export const TECH: Tech[] = [
  { id: 'power', name: 'Generator', tab: 'base', cost: 300, needs: ['yard'], building: 'power', blurb: 'Power for your base.' },
  { id: 'barracks', name: 'Barracks', tab: 'base', cost: 300, needs: ['power'], building: 'barracks', blurb: 'Trains infantry.' },
  { id: 'refinery', name: 'Ore refinery', tab: 'base', cost: 1500, needs: ['power'], building: 'refinery', blurb: 'Turns ore into credits.' },
  { id: 'silo', name: 'Ore silo', tab: 'base', cost: 150, needs: ['refinery'], building: 'silo', blurb: 'Stores more credits.' },
  { id: 'factory', name: 'Vehicle works', tab: 'base', cost: 2000, needs: ['refinery'], building: 'factory', blurb: 'Builds vehicles.' },
  { id: 'radar', name: 'Radar mast', tab: 'base', cost: 1000, needs: ['refinery'], building: 'radar', blurb: 'Opens up air power and artillery.' },
  { id: 'helipad', name: 'Helipad', tab: 'base', cost: 1000, needs: ['radar'], building: 'helipad', blurb: 'Builds copters.' },
  { id: 'lab', name: 'Tech lab', tab: 'base', cost: 1500, needs: ['factory', 'radar'], building: 'lab', blurb: 'Opens up the heaviest arms.' },
  { id: 'tower', name: 'Gun tower', tab: 'defense', cost: 600, needs: ['barracks'], building: 'tower', blurb: 'Guards your base.' },
];

// Seconds to build something of this cost.
export const buildTime = (cost: number) => Math.max(4, cost / 80);

// Start-up money (there is no ore to earn more yet).
export const START_CREDITS = 5000;
