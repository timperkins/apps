// What you can build, what it costs, and what you need first: the tech tree.
// Building something new opens up more of it, starting from the Construction yard.
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
  { id: 'power', name: 'Power plant', tab: 'base', cost: 300, needs: ['yard'], building: 'power', blurb: 'Power for your base.' },
  { id: 'barracks', name: 'Barracks', tab: 'base', cost: 300, needs: ['power'], building: 'barracks', blurb: 'Trains infantry.' },
  { id: 'refinery', name: 'Ore refinery', tab: 'base', cost: 1500, needs: ['power'], building: 'refinery', blurb: 'Turns ore into credits.' },
  { id: 'silo', name: 'Ore silo', tab: 'base', cost: 150, needs: ['refinery'], building: 'silo', blurb: 'Stores more credits.' },
  { id: 'factory', name: 'Vehicle works', tab: 'base', cost: 2000, needs: ['refinery'], building: 'factory', blurb: 'Builds vehicles.' },
  { id: 'radar', name: 'Air command', tab: 'base', cost: 1000, needs: ['refinery'], building: 'radar', blurb: 'Radar, a runway, a hangar and four stands for planes: Swift jets and a Paratrooper plane. Comes with no planes. Opens up artillery.' },
  { id: 'helipad', name: 'Helipad', tab: 'base', cost: 1000, needs: ['radar'], building: 'helipad', blurb: 'Builds copters.' },
  { id: 'lab', name: 'Tech lab', tab: 'base', cost: 1500, needs: ['factory', 'radar'], building: 'lab', blurb: 'Opens up the heaviest arms.' },
  { id: 'depot', name: 'Service depot', tab: 'base', cost: 800, needs: ['factory'], building: 'depot', blurb: 'Repairs vehicles parked on its pad, for credits.' },
  { id: 'navy', name: 'Naval yard', tab: 'base', cost: 1000, needs: ['power'], building: 'navy', blurb: 'Built out on open water next to your base. Makes ships, and mends ships parked in its slip, for credits.' },
  { id: 'wall', name: 'Wall', tab: 'defense', cost: 100, needs: ['yard'], building: 'wall', blurb: 'Concrete wall, one segment at a time. Keep placing to build a line; tap Wall again (or Esc) to stop.' },
  { id: 'uplink', name: 'Satellite uplink', tab: 'base', cost: 1500, needs: ['radar', 'lab'], building: 'uplink', blurb: 'Reveals the whole map while it stands.' },
  { id: 'tower', name: 'Gun tower', tab: 'defense', cost: 600, needs: ['barracks'], building: 'tower', blurb: 'Guards your base.' },
  { id: 'aa', name: 'Skyguard battery', tab: 'defense', cost: 1000, needs: ['barracks', 'radar'], building: 'aa', blurb: 'Missile launcher that shoots down aircraft. Can\'t hit anything on the ground.' },
  { id: 'prism', name: 'Lumen tower', tab: 'defense', cost: 1500, needs: ['radar', 'lab'], building: 'prism', blurb: 'Long-range light beam. Lumen towers near one that fires beam their light into it and add to the blow.' },

  { id: 'inf', name: 'G.I.', tab: 'inf', cost: 100, needs: ['barracks'], unit: 'inf', from: 'barracks', blurb: 'Cheap foot soldier. Deploys behind sandbags to hold ground.' },
  { id: 'dog', name: 'Attack dog', tab: 'inf', cost: 200, needs: ['barracks'], unit: 'dog', from: 'barracks', blurb: 'Fast and sharp-eyed. Kills a soldier in one bite, but cannot hurt vehicles or buildings.' },
  { id: 'gren', name: 'Grenadier', tab: 'inf', cost: 160, needs: ['barracks'], unit: 'gren', from: 'barracks', blurb: 'Lobs grenades: good against soldiers and buildings.' },
  { id: 'flamer', name: 'Flame trooper', tab: 'inf', cost: 300, needs: ['barracks'], unit: 'flamer', from: 'barracks', blurb: 'Short-range flamethrower: burns soldiers in groups and sets buildings alight.' },
  { id: 'eng', name: 'Engineer', tab: 'inf', cost: 500, needs: ['barracks'], unit: 'eng', from: 'barracks', blurb: 'Unarmed. Repairs a bridge from its blockhouse, or one of your buildings, and is used up doing it.' },
  { id: 'rocket', name: 'Rocketeer', tab: 'inf', cost: 300, needs: ['barracks'], unit: 'rocket', from: 'barracks', blurb: 'Foot soldier with a rocket launcher.' },
  { id: 'cmdo', name: 'Commando', tab: 'inf', cost: 1000, needs: ['barracks', 'lab'], unit: 'cmdo', from: 'barracks', blurb: 'One at a time. Picks off soldiers from range, swims, and blows up buildings and bridges with timed charges.' },

  { id: 'buggy', name: 'Scout buggy', tab: 'veh', cost: 400, needs: ['factory'], unit: 'buggy', from: 'factory', blurb: 'Fast and light.' },
  { id: 'apc', name: 'Mule APC', tab: 'veh', cost: 600, needs: ['factory', 'barracks'], unit: 'apc', from: 'factory', blurb: 'Armored carrier for five foot soldiers.' },
  { id: 'light', name: 'Lancer tank', tab: 'veh', cost: 700, needs: ['factory'], unit: 'light', from: 'factory', blurb: 'The workhorse tank.' },
  { id: 'hauler', name: 'Ore hauler', tab: 'veh', cost: 1400, needs: ['factory', 'refinery'], unit: 'hauler', from: 'factory', blurb: 'Gathers ore for the refinery.' },
  { id: 'scorch', name: 'Scorch tank', tab: 'veh', cost: 900, needs: ['factory', 'radar'], unit: 'scorch', from: 'factory', blurb: 'Twin flame projectors: burns soldiers and buildings at short range.' },
  { id: 'arty', name: 'Howler artillery', tab: 'veh', cost: 800, needs: ['factory', 'radar'], unit: 'arty', from: 'factory', blurb: 'Long-range gun.' },
  { id: 'comet', name: 'Comet launcher', tab: 'veh', cost: 1300, needs: ['factory', 'radar'], unit: 'comet', from: 'factory', blurb: 'Slow rocket carrier that fires one huge rocket at a time, from further off than anything else on land, and takes a long while to load the next. Can\'t fire on anything close: keep it guarded.' },
  { id: 'skyguard', name: 'Skyguard tank', tab: 'veh', cost: 900, needs: ['factory', 'radar'], unit: 'skyguard', from: 'factory', blurb: 'Tank carrying a Skyguard missile launcher: shoots down aircraft and keeps up with your army. Can\'t hit anything on the ground.' },
  { id: 'heavy', name: 'Bastion tank', tab: 'veh', cost: 1200, needs: ['factory', 'lab'], unit: 'heavy', from: 'factory', blurb: 'Heavy twin-gun tank.' },
  { id: 'lumen', name: 'Lumen tank', tab: 'veh', cost: 1200, needs: ['factory', 'lab'], unit: 'lumen', from: 'factory', blurb: 'Fires a long-range beam of light that splashes over everything near where it lands.' },
  { id: 'heli', name: 'Kestrel copter', tab: 'veh', cost: 1200, needs: ['helipad', 'lab'], unit: 'heli', from: 'helipad', blurb: 'Rocket copter.' },
  { id: 'heron', name: 'Heron transport', tab: 'veh', cost: 1200, needs: ['helipad', 'radar'], unit: 'heron', from: 'helipad', blurb: 'Twin-rotor copter that carries five soldiers over anything. Lands on open ground to let them out. Has a door gun.' },
  { id: 'jet', name: 'Swift jet', tab: 'veh', cost: 1200, needs: ['radar'], unit: 'jet', from: 'radar', blurb: 'Jump jet with three pairs of missiles. Rolls out of the Air command hangar, and flies home to its stand there to rearm. Four planes to an Air command.' },
  { id: 'plane', name: 'Paratrooper plane', tab: 'veh', cost: 1500, needs: ['radar'], unit: 'plane', from: 'radar', blurb: 'Carries eight paratroopers. Waits on its Air command stand until they are ready, then you call them in from the top of the Defense tab. One at a time: lose it and you need a new one.' },
  { id: 'otter', name: 'Otter hovercraft', tab: 'veh', cost: 900, needs: ['navy'], unit: 'otter', from: 'navy', blurb: 'Unarmed hovercraft that carries twelve soldiers, or three vehicles, over land and water. Comes ashore to let them out.' },
  { id: 'destroyer', name: 'Destroyer', tab: 'veh', cost: 1000, needs: ['navy'], unit: 'destroyer', from: 'navy', blurb: 'Warship with a long-range gun for ships and the shore. Its sonar finds submarines and its depth charges hit them.' },
  { id: 'sub', name: 'Submarine', tab: 'veh', cost: 1000, needs: ['navy'], unit: 'sub', from: 'navy', blurb: 'Hidden under the water until it fires torpedoes, which only hit ships. Only Destroyers can hit it submerged.' },
  { id: 'cruiser', name: 'Skyguard cruiser', tab: 'veh', cost: 1200, needs: ['navy', 'radar'], unit: 'cruiser', from: 'navy', blurb: 'Warship with two Skyguard missile launchers that shoot down aircraft from far off. Can\'t hit anything on the ground or water.' },
  { id: 'carrier', name: 'Carrier', tab: 'veh', cost: 2000, needs: ['navy', 'lab'], unit: 'carrier', from: 'navy', blurb: 'Launches drones at targets on land or sea from very long range.' },
  { id: 'mcv', name: 'MCU', tab: 'veh', cost: 2500, needs: ['factory'], unit: 'mcv', from: 'factory', blurb: 'Deploys into another Construction yard.' },
];

// Most of one unit you can have waiting in a queue.
export const QUEUE_MAX = 5;

// Seconds to build something of this cost.
export const buildTime = (cost: number) => Math.max(3, cost / 80);

// Start-up money; after that it comes from ore.
export const START_CREDITS = 5000;

// Power each building makes (+) or uses (-). Short of power, everything
// builds at half speed.
export const POWER: Partial<Record<BuildingKind, number>> = {
  power: 100,
  barracks: -20,
  refinery: -40,
  silo: -10,
  factory: -30,
  radar: -40,
  helipad: -10,
  lab: -75,
  tower: -20,
  prism: -75,
  aa: -50,
  depot: -25,
  uplink: -100,
  navy: -20,
};

// Credits you can hold: a little of your own, more per refinery and silo.
export const STORE = { base: 3000, refinery: 2000, silo: 3000 };

// Ore: what one clump holds, what a hauler carries, and how fast it digs.
export const ORE = { node: 600, load: 700, digRate: 70, unloadRate: 350, regrow: 2 };

// The Combat test stage: plenty of money, and room to hold it.
export const COMBAT_CREDITS = 50000;
export const COMBAT_STORE = 100000;
