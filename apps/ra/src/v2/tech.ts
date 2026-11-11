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
  unit?: string; // a unit kind, made at a `from` building and queued up
  from?: BuildingKind;
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

  { id: 'inf', name: 'Rifleman', tab: 'inf', cost: 100, needs: ['barracks'], unit: 'inf', from: 'barracks', blurb: 'Cheap, quick foot soldier.' },
  { id: 'rocket', name: 'Rocketeer', tab: 'inf', cost: 300, needs: ['barracks'], unit: 'rocket', from: 'barracks', blurb: 'Foot soldier with a rocket launcher.' },

  { id: 'buggy', name: 'Scout buggy', tab: 'veh', cost: 400, needs: ['factory'], unit: 'buggy', from: 'factory', blurb: 'Fast and light.' },
  { id: 'light', name: 'Lancer tank', tab: 'veh', cost: 700, needs: ['factory'], unit: 'light', from: 'factory', blurb: 'The workhorse tank.' },
  { id: 'hauler', name: 'Ore hauler', tab: 'veh', cost: 1400, needs: ['factory', 'refinery'], unit: 'hauler', from: 'factory', blurb: 'Gathers ore for the refinery.' },
  { id: 'arty', name: 'Howler artillery', tab: 'veh', cost: 800, needs: ['factory', 'radar'], unit: 'arty', from: 'factory', blurb: 'Long-range gun.' },
  { id: 'heavy', name: 'Bastion tank', tab: 'veh', cost: 1200, needs: ['factory', 'lab'], unit: 'heavy', from: 'factory', blurb: 'Heavy twin-gun tank.' },
  { id: 'heli', name: 'Kestrel copter', tab: 'veh', cost: 1200, needs: ['helipad', 'lab'], unit: 'heli', from: 'helipad', blurb: 'Rocket copter.' },
  { id: 'mcv', name: 'Mobile Foundry', tab: 'veh', cost: 2500, needs: ['factory'], unit: 'mcv', from: 'factory', blurb: 'Deploys into another Foundry.' },
];

// Most of one unit you can have waiting in a queue.
export const QUEUE_MAX = 5;

// Seconds to build something of this cost.
export const buildTime = (cost: number) => Math.max(3, cost / 80);

// Start-up money (there is no ore to earn more yet).
export const START_CREDITS = 5000;
