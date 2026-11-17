// Jobville: jobs on the job board and upgrades on the shop podiums.

export type JobId = 'sweeper' | 'farmer' | 'fisher' | 'mail' | 'lumberjack' | 'pizza' | 'miner';

export interface Job {
  id: JobId;
  name: string;
  icon: string;
  pay: string;
  how: string;
  /** Total money earned (ever) needed before you can take it. */
  unlock: number;
}

export const JOBS: Job[] = [
  { id: 'sweeper', name: 'Street Sweeper', icon: '🧹', pay: '$3 a piece of trash', how: 'Pick up trash on the streets.', unlock: 0 },
  { id: 'farmer', name: 'Farmer', icon: '🌾', pay: '$4 a crop', how: 'Harvest ripe crops on the farms east of town.', unlock: 0 },
  { id: 'fisher', name: 'Fisher', icon: '🎣', pay: '$6 to $40 a fish', how: 'Fish off the dock at the pond. Press when you see the !', unlock: 40 },
  { id: 'mail', name: 'Mail Carrier', icon: '✉️', pay: '$10+ a letter', how: 'Grab letters at the Post Office and bring them to houses.', unlock: 120 },
  { id: 'lumberjack', name: 'Lumberjack', icon: '🪓', pay: '$9 a tree', how: 'Chop trees in the forest west of town.', unlock: 250 },
  { id: 'pizza', name: 'Pizza Delivery', icon: '🍕', pay: '$20 + tips', how: 'Grab pizzas at the Pizza place and deliver them while they are hot.', unlock: 450 },
  { id: 'miner', name: 'Miner', icon: '⛏️', pay: '$14 a rock, gems $80', how: 'Break rocks in the quarry north of town.', unlock: 800 },
];

export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j])) as Record<JobId, Job>;

export type UpgradeId = 'shoes' | 'bag' | 'tools' | 'hat' | 'magnet' | 'rod' | 'watch' | 'pet' | 'hover' | 'car' | 'trophy';

export interface Tier {
  name: string;
  icon: string;
  price: number;
  desc: string;
}

export interface Upgrade {
  id: UpgradeId;
  tiers: Tier[];
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'shoes',
    tiers: [
      { name: 'Sneakers', icon: '👟', price: 40, desc: 'Walk 25% faster' },
      { name: 'Roller Skates', icon: '🛼', price: 220, desc: 'Go 55% faster' },
      { name: 'Bike', icon: '🚲', price: 750, desc: 'Go 90% faster' },
    ],
  },
  {
    id: 'bag',
    tiers: [
      { name: 'Backpack', icon: '🎒', price: 70, desc: 'Carry 2 letters or pizzas' },
      { name: 'Big Backpack', icon: '🎒', price: 300, desc: 'Carry 3 letters or pizzas' },
      { name: 'Mega Bag', icon: '💼', price: 900, desc: 'Carry 5 letters or pizzas' },
    ],
  },
  {
    id: 'tools',
    tiers: [
      { name: 'Iron Tools', icon: '🔨', price: 120, desc: 'Chop and mine faster' },
      { name: 'Gold Tools', icon: '⚒️', price: 500, desc: 'Chop in 1 hit, mine faster' },
      { name: 'Diamond Tools', icon: '💎', price: 1400, desc: 'Everything in 1 hit, double wood and rock pay' },
    ],
  },
  {
    id: 'hat',
    tiers: [
      { name: 'Lucky Cap', icon: '🧢', price: 150, desc: 'Earn 20% more' },
      { name: 'Top Hat', icon: '🎩', price: 650, desc: 'Earn 50% more' },
      { name: 'Crown', icon: '👑', price: 2200, desc: 'Earn double!' },
    ],
  },
  {
    id: 'magnet',
    tiers: [
      { name: 'Magnet', icon: '🧲', price: 130, desc: 'Grab trash and crops just by walking near' },
      { name: 'Super Magnet', icon: '🧲', price: 550, desc: 'Grab from twice as far' },
    ],
  },
  {
    id: 'rod',
    tiers: [
      { name: 'Good Rod', icon: '🎣', price: 90, desc: 'Fish bite faster' },
      { name: 'Pro Rod', icon: '🎣', price: 420, desc: 'Bite even faster, catch bigger fish' },
    ],
  },
  {
    id: 'watch',
    tiers: [
      { name: 'Magic Watch', icon: '⌚', price: 350, desc: 'Crops, trees, rocks and trash come back twice as fast' },
    ],
  },
  {
    id: 'pet',
    tiers: [
      { name: 'Puppy', icon: '🐶', price: 300, desc: 'A friend who follows you. +10% pay' },
      { name: 'Pet Dragon', icon: '🐉', price: 3000, desc: 'A dragon who follows you! +25% pay' },
    ],
  },
  {
    id: 'hover',
    tiers: [{ name: 'Hoverboard', icon: '🛸', price: 1800, desc: 'Fly super fast, even over water' }],
  },
  {
    id: 'car',
    tiers: [{ name: 'Car', icon: '🚗', price: 1200, desc: 'Zoom super fast on roads' }],
  },
  {
    id: 'trophy',
    tiers: [{ name: 'Golden Trophy', icon: '🏆', price: 10000, desc: 'The biggest prize in Jobville' }],
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, Upgrade>;
