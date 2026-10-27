export type WeaponId =
  | 'babyMissile'
  | 'missile'
  | 'babyNuke'
  | 'nuke'
  | 'dirtClod'
  | 'mirv'
  | 'leapfrog'
  | 'funkyBomb'
  | 'roller'
  | 'digger'
  | 'napalm'
  | 'torpedo';

export type ItemId = 'parachute' | 'shield' | 'repairKit' | 'powerCell';
export type ShopId = WeaponId | ItemId;

export type Behavior = 'blast' | 'dirt' | 'mirv' | 'leapfrog' | 'funky' | 'roller' | 'digger' | 'napalm' | 'torpedo';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Price for one bundle. */
  price: number;
  bundle: number;
  /** Blast (or dirt) radius in pixels. */
  radius: number;
  /** Damage at the center of the blast. */
  damage: number;
  behavior: Behavior;
  description: string;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  price: number;
  bundle: number;
  description: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  babyMissile: {
    id: 'babyMissile', name: 'Baby Missile', price: 0, bundle: 0, radius: 12, damage: 35,
    behavior: 'blast', description: 'Small blast. Always available.',
  },
  missile: {
    id: 'missile', name: 'Missile', price: 1200, bundle: 5, radius: 20, damage: 55,
    behavior: 'blast', description: 'Medium blast.',
  },
  babyNuke: {
    id: 'babyNuke', name: 'Baby Nuke', price: 3200, bundle: 3, radius: 38, damage: 80,
    behavior: 'blast', description: 'Large blast.',
  },
  nuke: {
    id: 'nuke', name: 'Nuke', price: 8000, bundle: 1, radius: 70, damage: 110,
    behavior: 'blast', description: 'Huge blast and a crater to match.',
  },
  dirtClod: {
    id: 'dirtClod', name: 'Dirt Clod', price: 800, bundle: 5, radius: 24, damage: 0,
    behavior: 'dirt', description: 'Drops a ball of dirt. Good for burying tanks.',
  },
  mirv: {
    id: 'mirv', name: 'MIRV', price: 6400, bundle: 2, radius: 18, damage: 45,
    behavior: 'mirv', description: 'Splits into 5 warheads at the top of its arc.',
  },
  leapfrog: {
    id: 'leapfrog', name: 'Leapfrog', price: 4800, bundle: 2, radius: 18, damage: 45,
    behavior: 'leapfrog', description: 'Hops forward three times, exploding on each landing.',
  },
  funkyBomb: {
    id: 'funkyBomb', name: 'Funky Bomb', price: 5600, bundle: 2, radius: 22, damage: 50,
    behavior: 'funky', description: 'Explodes and scatters bomblets in every direction.',
  },
  roller: {
    id: 'roller', name: 'Roller', price: 2400, bundle: 5, radius: 22, damage: 55,
    behavior: 'roller', description: 'Rolls downhill after landing and explodes at the bottom.',
  },
  digger: {
    id: 'digger', name: 'Digger', price: 1600, bundle: 5, radius: 4, damage: 0,
    behavior: 'digger', description: 'Tunnels into the ground. Undermines tanks without hurting them.',
  },
  napalm: {
    id: 'napalm', name: 'Napalm', price: 7200, bundle: 2, radius: 10, damage: 15,
    behavior: 'napalm', description: 'Burning fuel flows downhill and burns anything in its path.',
  },
  torpedo: {
    id: 'torpedo', name: 'Torpedo', price: 1000, bundle: 1, radius: 0, damage: 0,
    behavior: 'torpedo',
    description: 'Rockets your tank to the top of the sky. It parachutes down and you can steer it. A shot parachute drops you hard.',
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  'babyMissile', 'missile', 'babyNuke', 'nuke', 'dirtClod', 'mirv',
  'leapfrog', 'funkyBomb', 'roller', 'digger', 'napalm', 'torpedo',
];

export const ITEMS: Record<ItemId, ItemDef> = {
  parachute: {
    id: 'parachute', name: 'Parachute', price: 1600, bundle: 3,
    description: 'Opens automatically when your tank falls. No fall damage.',
  },
  shield: {
    id: 'shield', name: 'Shield', price: 4000, bundle: 1,
    description: 'Raised at the start of the next round. Absorbs 60 damage.',
  },
  repairKit: {
    id: 'repairKit', name: 'Repair Kit', price: 2400, bundle: 1,
    description: 'Restores 30 health. Using it starts your 5-second reload.',
  },
  powerCell: {
    id: 'powerCell', name: 'Power Cell', price: 1000, bundle: 1,
    description: 'Restores your power to max without healing. Does not start a reload.',
  },
};

export const ITEM_ORDER: ItemId[] = ['parachute', 'shield', 'repairKit', 'powerCell'];

export function isWeapon(id: ShopId): id is WeaponId {
  return id in WEAPONS;
}

export function shopDef(id: ShopId): WeaponDef | ItemDef {
  return isWeapon(id) ? WEAPONS[id] : ITEMS[id];
}

export type Inventory = Record<ShopId, number>;

export function emptyInventory(): Inventory {
  const inv = {} as Inventory;
  for (const id of WEAPON_ORDER) inv[id] = 0;
  for (const id of ITEM_ORDER) inv[id] = 0;
  return inv;
}

/** Number of shots of a weapon a player has; Baby Missiles are unlimited. */
export function ammo(inv: Inventory, id: WeaponId): number {
  return id === 'babyMissile' ? Infinity : inv[id];
}
