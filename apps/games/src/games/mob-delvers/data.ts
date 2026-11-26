// Mob Delvers: weapons, armor, artifacts, monsters, missions, modes and the loot math.
// Designed from two handwritten pages. Everything here is original: names, monsters and looks.

export type MeleeId =
  | 'rusty-sword' | 'twin-daggers' | 'battle-axe' | 'long-spear' | 'thunder-hammer' | 'frost-glaive' | 'ember-blade'
  | 'sickle' | 'scythe' | 'obsidian-cleaver' | 'dragonfang' | 'rimeblade'
  | 'bone-club' | 'coral-cutlass' | 'shadow-katana' | 'moon-sickle' | 'blizzard-axe' | 'magma-axe' | 'spiked-mace' | 'frostbite-daggers'
  | 'cinder-claws' | 'thunder-pike' | 'venom-spear' | 'crystal-greatsword' | 'volcano-hammer' | 'soul-scythe';
export type RangedId = 'shortbow' | 'crossbow' | 'fan-bow' | 'starlight-bow' | 'rapid-repeater' | 'storm-bow' | 'thornspike-bow' | 'dragonbone-longbow' | 'glacier-bow'
  | 'hunters-longbow' | 'twinstring-bow' | 'ember-crossbow' | 'frost-repeater' | 'thunderclap-crossbow' | 'phoenix-bow';
export type ArmorId = 'tunic' | 'jerkin' | 'chainmail' | 'mossguard' | 'obsidian-plate' | 'scout-cloak' | 'knight-plate' | 'shadowweave' | 'dragonscale';
export type GearId = MeleeId | RangedId | ArmorId;
export type Rarity = 'normal';
/**
 * An owned item: "<gear or artifact id>~<level>~<unique number>". Gear never levels up: the level
 * it dropped at is the level it keeps. Two scythes at different levels are two different items.
 */
export type ItemKey = string;

/** Fire burns and hits ice monsters harder; ice slows and hits fire monsters harder. */
export type Element = 'fire' | 'ice';
export const ELEMENT_BONUS = 1.6;
/** how long ice keeps an enemy slowed (seconds) */
export const ICE_SLOW = 3;

export type MeleeShape = 'sword' | 'daggers' | 'axe' | 'spear' | 'hammer' | 'glaive' | 'sickle' | 'scythe' | 'cleaver' | 'fist' | 'mace' | 'katana';

export interface Melee {
  kind: 'melee';
  name: string;
  desc: string;
  dmg: number;
  /** seconds between swings */
  rate: number;
  /** reach in tiles */
  reach: number;
  /** swing arc in degrees (360 = all around) */
  arc: number;
  knock: number;
  effect?: 'slow' | 'burn' | 'stun';
  /** how good it is (0..640): rough tier, used so early missions drop simpler weapons */
  price: number;
  color: string;
  blade: string;
  shape: MeleeShape;
  glow?: boolean;
  element?: Element;
  burnChance?: number;
  slowChance?: number;
  /** health back per hit */
  leech?: number;
  crit?: number;
  soulHeal?: number;
  soulBonus?: number;
}
export interface Ranged {
  kind: 'ranged';
  name: string;
  desc: string;
  dmg: number;
  rate: number;
  speed: number;
  shots: number;
  spread: number;
  pierce: number;
  price: number;
  color: string;
  /** fires on its own at enemies in range */
  auto?: boolean;
  /** every arrow sets enemies on fire */
  burn?: boolean;
  shape: 'bow' | 'crossbow' | 'longbow';
  glow?: boolean;
  element?: Element;
  /** every arrow slows enemies */
  chill?: boolean;
  burnChance?: number;
  slowChance?: number;
  poisonChance?: number;
  extraShot?: number;
  soulHeal?: number;
}
export interface Armor {
  kind: 'armor';
  name: string;
  desc: string;
  /** share of damage blocked, 0..1 */
  block: number;
  speed: number;
  regen: number;
  /** extra health on top of the 100 heart */
  hp: number;
  price: number;
  color: string;
  trim: string;
  /** walk on lava without burning */
  lavaproof?: boolean;
  /** dodge roll recharges faster */
  quickroll?: boolean;
  helm?: 'horns' | 'hood' | 'crest' | 'spikes';
  /** roll cooldown multiplier (Nimble) */
  rollMul?: number;
  soulHeal?: number;
  thorns?: number;
}

export const MELEE: Record<MeleeId, Melee> = {
  'rusty-sword': { kind: 'melee', shape: 'sword', name: 'Rusty Sword', desc: 'Old but honest. A quick, even swing.', dmg: 10, rate: 0.42, reach: 1.35, arc: 110, knock: 3, price: 0, color: '#6b4424', blade: '#b0a090' },
  'twin-daggers': { kind: 'melee', shape: 'daggers', name: 'Twin Daggers', desc: 'Very fast stabs at close range.', dmg: 6, rate: 0.2, reach: 1.05, arc: 70, knock: 1.5, price: 60, color: '#2b2b33', blade: '#d8e2ee' },
  sickle: { kind: 'melee', shape: 'sickle', name: 'Sickle', desc: 'A fast curved blade that hooks everything close by.', dmg: 8, rate: 0.26, reach: 1.15, arc: 140, knock: 2, price: 80, color: '#5a3820', blade: '#c8d0d8' },
  'long-spear': { kind: 'melee', shape: 'spear', name: 'Long Spear', desc: 'Pokes enemies from twice as far away.', dmg: 13, rate: 0.5, reach: 2.3, arc: 36, knock: 4, price: 110, color: '#8a6a3a', blade: '#cfd6dc' },
  'battle-axe': { kind: 'melee', shape: 'axe', name: 'Battle Axe', desc: 'Slow, heavy sweeps that hit everything in front.', dmg: 20, rate: 0.72, reach: 1.45, arc: 170, knock: 6, price: 140, color: '#5a3820', blade: '#9aa4ae' },
  scythe: { kind: 'melee', shape: 'scythe', name: 'Scythe', desc: 'A huge sweeping blade that reaps a wide circle.', dmg: 17, rate: 0.68, reach: 2.0, arc: 230, knock: 4, price: 220, color: '#3a2a20', blade: '#d8dce0' },
  'frost-glaive': { kind: 'melee', shape: 'glaive', name: 'Frost Glaive', desc: 'A wide icy arc that slows what it cuts.', dmg: 15, rate: 0.55, reach: 1.85, arc: 150, knock: 4, effect: 'slow', price: 260, color: '#2f5f8a', blade: '#aee8ff', glow: true, element: 'ice' },
  rimeblade: { kind: 'melee', shape: 'sword', name: 'Rimeblade', desc: 'A sword of blue ice. Slows what it cuts and shatters fire monsters.', dmg: 16, rate: 0.4, reach: 1.45, arc: 120, knock: 3, effect: 'slow', price: 470, color: '#1a3a5a', blade: '#9ae6ff', glow: true, element: 'ice' },
  'thunder-hammer': { kind: 'melee', shape: 'hammer', name: 'Thunder Hammer', desc: 'Slams the floor: a shock ring that hits all around and stuns.', dmg: 28, rate: 1.0, reach: 1.9, arc: 360, knock: 7, effect: 'stun', price: 320, color: '#3b3f5a', blade: '#ffe066' },
  'obsidian-cleaver': { kind: 'melee', shape: 'cleaver', name: 'Obsidian Cleaver', desc: 'A jagged black slab with a glowing purple edge. Brutal.', dmg: 26, rate: 0.62, reach: 1.55, arc: 150, knock: 7, price: 380, color: '#1a1420', blade: '#2a2238', glow: true },
  'ember-blade': { kind: 'melee', shape: 'sword', name: 'Ember Blade', desc: 'A glowing blade that sets enemies on fire.', dmg: 16, rate: 0.4, reach: 1.45, arc: 120, knock: 3, effect: 'burn', price: 480, color: '#5a1d10', blade: '#ff8a3a', glow: true, element: 'fire' },
  dragonfang: { kind: 'melee', shape: 'sword', name: 'Dragonfang', desc: 'A blood-red blade carved from a dragon’s tooth. Burns and hits hard.', dmg: 22, rate: 0.44, reach: 1.6, arc: 130, knock: 5, effect: 'burn', price: 640, color: '#2a0e0e', blade: '#e0303a', glow: true, element: 'fire' },
  'bone-club': { kind: 'melee', shape: 'mace', name: 'Bone Club', desc: 'A knobbly club with a skull-sized end. Cheap and thumpy.', dmg: 12, rate: 0.55, reach: 1.3, arc: 100, knock: 5, price: 50, color: '#d8ccb0', blade: '#efe6d0' },
  'coral-cutlass': { kind: 'melee', shape: 'sword', name: 'Coral Cutlass', desc: 'A curved pink-and-teal blade found in a sunken chest.', dmg: 11, rate: 0.36, reach: 1.4, arc: 130, knock: 3, price: 95, color: '#1f6a6a', blade: '#ff8aa8' },
  'spiked-mace': { kind: 'melee', shape: 'mace', name: 'Spiked Mace', desc: 'An iron ball covered in spikes. Big hits that stun.', dmg: 22, rate: 0.75, reach: 1.4, arc: 110, knock: 7, effect: 'stun', price: 190, color: '#4a3a2a', blade: '#7a828c' },
  'shadow-katana': { kind: 'melee', shape: 'katana', name: 'Shadow Katana', desc: 'A long, thin black blade. Lightning-fast cuts.', dmg: 13, rate: 0.26, reach: 1.6, arc: 100, knock: 2, price: 290, color: '#1a1a22', blade: '#5a4a8a', glow: true },
  'moon-sickle': { kind: 'melee', shape: 'sickle', name: 'Moon Sickle', desc: 'A pale sickle that glows like the moon. Its cold bite slows.', dmg: 12, rate: 0.24, reach: 1.25, arc: 150, knock: 2, effect: 'slow', price: 270, color: '#3a4a6a', blade: '#e8f4ff', glow: true, element: 'ice' },
  'frostbite-daggers': { kind: 'melee', shape: 'daggers', name: 'Frostbite Daggers', desc: 'Two icicle daggers. Very fast, and every stab slows.', dmg: 8, rate: 0.18, reach: 1.1, arc: 80, knock: 1.5, effect: 'slow', price: 250, color: '#2a4a6a', blade: '#bff0ff', glow: true, element: 'ice' },
  'cinder-claws': { kind: 'melee', shape: 'daggers', name: 'Cinder Claws', desc: 'Two glowing claw blades that leave enemies burning.', dmg: 8, rate: 0.18, reach: 1.1, arc: 80, knock: 1.5, effect: 'burn', price: 260, color: '#3a1a10', blade: '#ff7a2a', glow: true, element: 'fire' },
  'venom-spear': { kind: 'melee', shape: 'spear', name: 'Venom Spear', desc: 'A green-tipped spear. Long reach; its poison slows.', dmg: 15, rate: 0.48, reach: 2.4, arc: 36, knock: 4, effect: 'slow', price: 230, color: '#3a5a2a', blade: '#7aff6a', glow: true },
  'thunder-pike': { kind: 'melee', shape: 'spear', name: 'Thunder Pike', desc: 'A crackling pike that stuns whatever it skewers.', dmg: 19, rate: 0.55, reach: 2.4, arc: 40, knock: 5, effect: 'stun', price: 360, color: '#3b3f5a', blade: '#ffe066', glow: true },
  'blizzard-axe': { kind: 'melee', shape: 'axe', name: 'Blizzard Axe', desc: 'A frozen double axe. Huge sweeps that slow everything.', dmg: 23, rate: 0.7, reach: 1.5, arc: 180, knock: 6, effect: 'slow', price: 400, color: '#2a3a5a', blade: '#aee8ff', glow: true, element: 'ice' },
  'magma-axe': { kind: 'melee', shape: 'axe', name: 'Magma Axe', desc: 'Cracked black stone with lava in the cracks. Burns.', dmg: 24, rate: 0.7, reach: 1.5, arc: 180, knock: 6, effect: 'burn', price: 420, color: '#1a1010', blade: '#ff5a1a', glow: true, element: 'fire' },
  'soul-scythe': { kind: 'melee', shape: 'scythe', name: 'Soul Scythe', desc: 'A ghostly green scythe. A wide, spooky sweep.', dmg: 21, rate: 0.62, reach: 2.1, arc: 240, knock: 4, price: 450, color: '#1a2a20', blade: '#6affb0', glow: true },
  'crystal-greatsword': { kind: 'melee', shape: 'sword', name: 'Crystal Greatsword', desc: 'A huge sword of blue crystal. Slow, wide, freezing.', dmg: 30, rate: 0.7, reach: 1.9, arc: 150, knock: 7, effect: 'slow', price: 560, color: '#1a3a5a', blade: '#7ae0ff', glow: true, element: 'ice' },
  'volcano-hammer': { kind: 'melee', shape: 'hammer', name: 'Volcano Hammer', desc: 'Slams the floor in a ring of fire that burns everything around you.', dmg: 32, rate: 1.0, reach: 2.0, arc: 360, knock: 8, effect: 'burn', price: 600, color: '#2a1010', blade: '#ff6a2a', glow: true, element: 'fire' },
};

export const RANGED: Record<RangedId, Ranged> = {
  shortbow: { kind: 'ranged', shape: 'bow', name: 'Shortbow', desc: 'A light bow. One arrow at a time.', dmg: 8, rate: 0.5, speed: 13, shots: 1, spread: 0, pierce: 0, price: 0, color: '#8a5a2b' },
  crossbow: { kind: 'ranged', shape: 'crossbow', name: 'Heavy Crossbow', desc: 'Slow to load; bolts punch through two enemies.', dmg: 22, rate: 1.1, speed: 18, shots: 1, spread: 0, pierce: 2, price: 150, color: '#4a3a2a' },
  'fan-bow': { kind: 'ranged', shape: 'bow', name: 'Fan Bow', desc: 'Looses three arrows in a fan.', dmg: 7, rate: 0.7, speed: 12, shots: 3, spread: 0.22, pierce: 0, price: 180, color: '#6b8a3a' },
  'rapid-repeater': { kind: 'ranged', shape: 'crossbow', name: 'Rapid Repeater', desc: 'AUTO-FIRE: shoots by itself at enemies in range.', dmg: 6, rate: 0.3, speed: 15, shots: 1, spread: 0, pierce: 0, price: 240, color: '#5a5a62', auto: true },
  'thornspike-bow': { kind: 'ranged', shape: 'bow', name: 'Thornspike Bow', desc: 'A spiked black bow that fires two arrows at once.', dmg: 11, rate: 0.55, speed: 14, shots: 2, spread: 0.1, pierce: 0, price: 300, color: '#20261a', glow: false },
  'storm-bow': { kind: 'ranged', shape: 'bow', name: 'Storm Bow', desc: 'AUTO-FIRE: crackling arrows that pierce one enemy.', dmg: 10, rate: 0.45, speed: 16, shots: 1, spread: 0, pierce: 1, price: 420, color: '#3a4a8a', auto: true, glow: true },
  'starlight-bow': { kind: 'ranged', shape: 'bow', name: 'Starlight Bow', desc: 'Fast glowing arrows that pass through everything.', dmg: 14, rate: 0.32, speed: 17, shots: 1, spread: 0, pierce: 9, price: 520, color: '#e8e0ff', glow: true },
  'dragonbone-longbow': { kind: 'ranged', shape: 'longbow', name: 'Dragonbone Longbow', desc: 'A huge bow of bone and red string. Burning arrows that pierce three.', dmg: 30, rate: 0.85, speed: 19, shots: 1, spread: 0, pierce: 3, price: 680, color: '#e8dcc0', burn: true, element: 'fire' },
  'glacier-bow': { kind: 'ranged', shape: 'bow', name: 'Glacier Bow', desc: 'A bow of packed ice. Freezing arrows slow enemies and pierce one.', dmg: 13, rate: 0.5, speed: 15, shots: 1, spread: 0, pierce: 1, price: 460, color: '#8ad8f0', chill: true, glow: true, element: 'ice' },
  'hunters-longbow': { kind: 'ranged', shape: 'longbow', name: "Hunter's Longbow", desc: 'A tall plain bow. Strong, far-flying arrows.', dmg: 16, rate: 0.7, speed: 18, shots: 1, spread: 0, pierce: 0, price: 120, color: '#7a5a32' },
  'twinstring-bow': { kind: 'ranged', shape: 'bow', name: 'Twinstring Bow', desc: 'Two strings, two arrows every shot.', dmg: 8, rate: 0.5, speed: 14, shots: 2, spread: 0.08, pierce: 0, price: 160, color: '#5a6a3a' },
  'ember-crossbow': { kind: 'ranged', shape: 'crossbow', name: 'Ember Crossbow', desc: 'Heavy burning bolts that punch through two enemies.', dmg: 24, rate: 1.0, speed: 18, shots: 1, spread: 0, pierce: 2, price: 340, color: '#5a2010', burn: true, glow: true, element: 'fire' },
  'frost-repeater': { kind: 'ranged', shape: 'crossbow', name: 'Frost Repeater', desc: 'AUTO-FIRE: rattles off icy bolts that slow.', dmg: 7, rate: 0.3, speed: 15, shots: 1, spread: 0, pierce: 0, price: 380, color: '#3a5a7a', auto: true, chill: true, glow: true, element: 'ice' },
  'thunderclap-crossbow': { kind: 'ranged', shape: 'crossbow', name: 'Thunderclap Crossbow', desc: 'Bolts that crack through every enemy in a line.', dmg: 26, rate: 1.05, speed: 20, shots: 1, spread: 0, pierce: 9, price: 500, color: '#3b3f5a', glow: true },
  'phoenix-bow': { kind: 'ranged', shape: 'bow', name: 'Phoenix Bow', desc: 'A blazing orange bow: three burning arrows at once.', dmg: 12, rate: 0.6, speed: 15, shots: 3, spread: 0.18, pierce: 0, price: 620, color: '#ff8a2a', burn: true, glow: true, element: 'fire' },
};

/** what you swing with nothing equipped */
export const FIST: Melee = { kind: 'melee', shape: 'fist', name: 'Fists', desc: 'Better than nothing!', dmg: 4, rate: 0.32, reach: 1.0, arc: 80, knock: 2, price: 0, color: '#e8b890', blade: '#e8b890' };

export const ARMOR: Record<ArmorId, Armor> = {
  tunic: { kind: 'armor', name: "Traveler's Tunic", desc: 'Comfy. Blocks a little.', block: 0.05, speed: 1, regen: 0, hp: 0, price: 0, color: '#3f7a5a', trim: '#2c4f3c' },
  'scout-cloak': { kind: 'armor', name: "Scout's Cloak", desc: 'Light and quick: you run 12% faster.', block: 0.1, speed: 1.12, regen: 0, hp: 5, price: 90, color: '#4a5a3a', trim: '#2a3420', helm: 'hood' },
  jerkin: { kind: 'armor', name: 'Leather Jerkin', desc: 'Sturdy leather with a few extra hearts.', block: 0.15, speed: 1, regen: 0, hp: 10, price: 70, color: '#8a5a32', trim: '#5a3418' },
  chainmail: { kind: 'armor', name: 'Chainmail', desc: 'Rings of steel. A little heavy.', block: 0.3, speed: 0.95, regen: 0, hp: 15, price: 170, color: '#8c939c', trim: '#5b6169' },
  shadowweave: { kind: 'armor', name: 'Shadowweave', desc: 'Your dodge roll recharges twice as fast.', block: 0.25, speed: 1.05, regen: 0, hp: 10, price: 260, color: '#2a2a3a', trim: '#6a4aa0', quickroll: true, helm: 'hood' },
  mossguard: { kind: 'armor', name: 'Mossguard Plate', desc: 'Living moss slowly heals you.', block: 0.35, speed: 0.95, regen: 1.2, hp: 20, price: 300, color: '#4d7a3a', trim: '#a8c46a' },
  'knight-plate': { kind: 'armor', name: "Knight's Plate", desc: 'Heavy steel with a red crest. Lots of extra health.', block: 0.45, speed: 0.9, regen: 0, hp: 35, price: 420, color: '#b8c0c8', trim: '#c0392b', helm: 'crest' },
  'obsidian-plate': { kind: 'armor', name: 'Obsidian Plate', desc: 'Spiked black armor. Blocks a lot.', block: 0.5, speed: 0.92, regen: 0, hp: 30, price: 560, color: '#2a2238', trim: '#9b6ad6', helm: 'spikes' },
  dragonscale: { kind: 'armor', name: 'Dragonscale Armor', desc: 'Red scales and horns. Lava can’t burn you.', block: 0.5, speed: 1, regen: 0, hp: 40, price: 720, color: '#8a1e1e', trim: '#e0a030', lavaproof: true, helm: 'horns' },
};

// ---------- gear power ----------
/** gear levels go from 1 to 200 */
export const MAX_LEVEL = 200;
/** how much stronger a level makes a weapon (level 20 scythe hits much harder than a level 1 one) */
export const gearMul = (lv: number) => 1 + (Math.max(1, Math.min(MAX_LEVEL, lv)) - 1) * 0.06;
/** how much armor of a level shrinks hits from monsters of the same level */
export const armorDef = (lv: number) => 1 + (Math.max(1, Math.min(MAX_LEVEL, lv)) - 1) * 0.05;
/** how hard monsters hit at a threat level (cancels out against armor of the same level) */
export const threatDmg = (tl: number) => 1 + (Math.max(1, tl) - 1) * 0.05;

export const isMelee = (id: string): id is MeleeId => id in MELEE;
export const isRanged = (id: string): id is RangedId => id in RANGED;
export const isArmor = (id: string): id is ArmorId => id in ARMOR;
export const isArtifact = (id: string): id is ArtifactId => id in ARTIFACTS;

export function parseKey(key: ItemKey): { id: GearId; lv: number; uid: number; rarity: Rarity } {
  const [id, lv, uid] = (key || '').split('~');
  return { id: id as GearId, lv: Math.max(1, Math.min(MAX_LEVEL, Math.round(Number(lv) || 1))), uid: Number(uid) || 0, rarity: 'normal' };
}
export const makeKey = (id: string, lv: number, uid = Math.floor(Math.random() * 1e9)): ItemKey => `${id}~${Math.max(1, Math.min(MAX_LEVEL, Math.round(lv)))}~${uid}`;
export const lvOfKey = (key: ItemKey | '') => (key ? parseKey(key).lv : 1);

/** The real stats of an owned item at its level. */
export function meleeOf(key: ItemKey | ''): Melee {
  if (!key) return FIST;
  const { id, lv } = parseKey(key);
  const b = MELEE[id as MeleeId] ?? FIST;
  return { ...b, dmg: Math.round(b.dmg * gearMul(lv)) };
}
export function rangedOf(key: ItemKey): Ranged {
  const { id, lv } = parseKey(key);
  const b = RANGED[id as RangedId] ?? RANGED.shortbow;
  return { ...b, dmg: Math.round(b.dmg * gearMul(lv)) };
}
export function armorOf(key: ItemKey): Armor {
  const { id, lv } = parseKey(key);
  const b = ARMOR[id as ArmorId] ?? ARMOR.tunic;
  return { ...b, hp: Math.round(b.hp + lv * 0.25) };
}
export function itemName(key: ItemKey) {
  const id: string = parseKey(key).id;
  if (isArtifact(id)) return ARTIFACTS[id].name;
  return isMelee(id) ? MELEE[id].name : isRanged(id) ? RANGED[id].name : (ARMOR as Record<string, Armor>)[id]?.name ?? 'Something';
}
export function gear(id: GearId): Melee | Ranged | Armor {
  return isMelee(id) ? MELEE[id] : isRanged(id) ? RANGED[id] : ARMOR[id as ArmorId];
}
export const ALL_MELEE = Object.keys(MELEE) as MeleeId[];
export const ALL_RANGED = Object.keys(RANGED) as RangedId[];
export const ALL_ARMOR = Object.keys(ARMOR) as ArmorId[];

// ---------- enchanting ----------
export type EnchId =
  | 'sharp' | 'swift' | 'sweep' | 'wildfire' | 'chill' | 'leech' | 'crit' | 'soulheal' | 'siphon'
  | 'power' | 'quick' | 'pierce' | 'flametip' | 'frosttip' | 'poison' | 'multishot' | 'soularrow'
  | 'tough' | 'quickstep' | 'mend' | 'nimble' | 'heart' | 'soulguard' | 'thorns';
export interface Ench {
  name: string;
  icon: string;
  for: 'melee' | 'ranged' | 'armor';
  /** what each tier (1..3) does */
  tiers: [string, string, string];
}
export const ENCHANTS: Record<EnchId, Ench> = {
  sharp: { name: 'Sharpness', icon: '🗡️', for: 'melee', tiers: ['+15% damage', '+30% damage', '+45% damage'] },
  swift: { name: 'Fast Hits', icon: '💨', for: 'melee', tiers: ['10% faster', '20% faster', '30% faster'] },
  sweep: { name: 'Wide Sweep', icon: '🌀', for: 'melee', tiers: ['+20° swing', '+40° swing', '+60° swing'] },
  wildfire: { name: 'Wildfire', icon: '🔥', for: 'melee', tiers: ['30% of hits burn', '60% of hits burn', 'every hit burns'] },
  chill: { name: 'Chilling', icon: '❄️', for: 'melee', tiers: ['30% of hits slow', '60% of hits slow', 'every hit slows'] },
  leech: { name: 'Lifesteal', icon: '❤️', for: 'melee', tiers: ['heal 1 per hit', 'heal 2 per hit', 'heal 3 per hit'] },
  crit: { name: 'Critical Hit', icon: '💥', for: 'melee', tiers: ['+10% crits', '+20% crits', '+30% crits'] },
  soulheal: { name: 'Soul Healing', icon: '👻', for: 'melee', tiers: ['every soul heals 2', 'every soul heals 4', 'every soul heals 6'] },
  siphon: { name: 'Soul Siphon', icon: '🔮', for: 'melee', tiers: ['10% of beaten mobs give +2 souls', '20% give +2 souls', '30% give +2 souls'] },
  power: { name: 'Power', icon: '🏹', for: 'ranged', tiers: ['+15% damage', '+30% damage', '+45% damage'] },
  quick: { name: 'Quick Draw', icon: '💨', for: 'ranged', tiers: ['10% faster', '20% faster', '30% faster'] },
  pierce: { name: 'Piercing', icon: '➶', for: 'ranged', tiers: ['pierce +1', 'pierce +2', 'pierce +3'] },
  flametip: { name: 'Flame Tips', icon: '🔥', for: 'ranged', tiers: ['40% of arrows burn', '70% of arrows burn', 'every arrow burns'] },
  frosttip: { name: 'Frost Tips', icon: '❄️', for: 'ranged', tiers: ['40% of arrows slow', '70% of arrows slow', 'every arrow slows'] },
  poison: { name: 'Poison Tips', icon: '☠️', for: 'ranged', tiers: ['30% of arrows poison', '60% of arrows poison', 'every arrow poisons'] },
  multishot: { name: 'Multishot', icon: '🎯', for: 'ranged', tiers: ['20% chance of +2 arrows', '40% chance of +2 arrows', '60% chance of +2 arrows'] },
  soularrow: { name: 'Soul Healing', icon: '👻', for: 'ranged', tiers: ['every soul heals 2', 'every soul heals 4', 'every soul heals 6'] },
  tough: { name: 'Protection', icon: '🛡️', for: 'armor', tiers: ['+5% block', '+10% block', '+15% block'] },
  quickstep: { name: 'Swiftfoot', icon: '👟', for: 'armor', tiers: ['+5% speed', '+10% speed', '+15% speed'] },
  mend: { name: 'Mending', icon: '💚', for: 'armor', tiers: ['heal 0.8/s', 'heal 1.6/s', 'heal 2.4/s'] },
  nimble: { name: 'Nimble', icon: '🤸', for: 'armor', tiers: ['rolls recharge 15% faster', '30% faster', '45% faster'] },
  heart: { name: 'Big Heart', icon: '💗', for: 'armor', tiers: ['+15 health', '+30 health', '+45 health'] },
  soulguard: { name: 'Soul Healing', icon: '👻', for: 'armor', tiers: ['every soul heals 2', 'every soul heals 4', 'every soul heals 6'] },
  thorns: { name: 'Thorns', icon: '🌵', for: 'armor', tiers: ['hurt back 30% of hits', 'hurt back 60%', 'hurt back 90%'] },
};
/** points to reach a tier: tier 1 costs 1, tier 2 costs 2 more, tier 3 costs 3 more */
export const enchCost = (tier: number) => (tier * (tier + 1)) / 2;
export type EnchSet = Partial<Record<EnchId, number>>;

/** Every item rolls 3 random enchantments it can take, picked once from its unique number. */
export function enchChoices(key: ItemKey): EnchId[] {
  const { id, uid } = parseKey(key);
  const kind = isMelee(id) ? 'melee' : isRanged(id) ? 'ranged' : isArmor(id) ? 'armor' : null;
  if (!kind) return [];
  const pool = (Object.keys(ENCHANTS) as EnchId[]).filter((k) => ENCHANTS[k].for === kind);
  let s = (uid ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
  const out: EnchId[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

export function enchantMelee(w: Melee, e: EnchSet = {}): Melee {
  if (!Object.keys(e).length) return w;
  const t = (k: EnchId) => e[k] ?? 0;
  return {
    ...w,
    dmg: Math.round(w.dmg * (1 + 0.15 * t('sharp'))),
    rate: w.rate * (1 - 0.1 * t('swift')),
    arc: w.arc >= 360 ? 360 : Math.min(360, w.arc + 20 * t('sweep')),
    burnChance: [0, 0.3, 0.6, 1][t('wildfire')],
    slowChance: [0, 0.3, 0.6, 1][t('chill')],
    leech: t('leech'),
    crit: 0.1 * t('crit'),
    soulHeal: 2 * t('soulheal'),
    soulBonus: 0.1 * t('siphon'),
  };
}
export function enchantRanged(w: Ranged, e: EnchSet = {}): Ranged {
  if (!Object.keys(e).length) return w;
  const t = (k: EnchId) => e[k] ?? 0;
  return {
    ...w,
    dmg: Math.round(w.dmg * (1 + 0.15 * t('power'))),
    rate: w.rate * (1 - 0.1 * t('quick')),
    pierce: w.pierce + t('pierce'),
    burnChance: [0, 0.4, 0.7, 1][t('flametip')],
    slowChance: [0, 0.4, 0.7, 1][t('frosttip')],
    poisonChance: [0, 0.3, 0.6, 1][t('poison')],
    extraShot: 0.2 * t('multishot'),
    soulHeal: 2 * t('soularrow'),
  };
}
export function enchantArmor(a: Armor, e: EnchSet = {}): Armor {
  if (!Object.keys(e).length) return a;
  const t = (k: EnchId) => e[k] ?? 0;
  return {
    ...a,
    block: Math.min(0.85, a.block + 0.05 * t('tough')),
    speed: a.speed * (1 + 0.05 * t('quickstep')),
    regen: a.regen + 0.8 * t('mend'),
    rollMul: 1 - 0.15 * t('nimble'),
    hp: a.hp + 15 * t('heart'),
    soulHeal: 2 * t('soulguard'),
    thorns: 0.3 * t('thorns'),
  };
}

// ---------- hero level ----------
export const HERO_MAX = 200;
export const heroXpNeed = (lv: number) => 10 + lv * 5;
/** you carry at most this many souls (artifacts like the Soul Beacon use them) */
export const MAX_SOULS = 100;

// ---------- modes and difficulties ----------
export type ModeId = 'easy' | 'normal' | 'hard' | 'nightmare';
export interface Mode {
  id: ModeId;
  name: string;
  desc: string;
  color: string;
  /** the monsters' level on difficulties 1 to 10 */
  threat: number[];
  /** the best gear level that can drop on difficulties 1 to 10 */
  maxDrop: number[];
  /** drop range from your power P on difficulty d (1..10), before the max */
  range: (P: number, d: number) => [number, number];
  /** chance a monster spawns enchanted (fast hits, protection, strength) */
  enchanted: number;
  hp: number;
  dmg: number;
}
// Normal-mode max drops from the notes: d.8 = 50, 7 = 46, 6 = 44, 5 = 40, 4 = 32, 3 = 20, 2 = 18, 1 = 16
const NORMAL_MAX = [16, 18, 20, 32, 40, 44, 46, 50, 55, 60];
// Hard mode: d.8 = 150, 7 = 142, 6 = 136, 5 = 130, 4 = 129, 3 = 100, 2 = 79, 1 = 63
const HARD_MAX = [63, 79, 100, 129, 130, 136, 142, 150, 160, 170];
// Nightmare mode: d.8 = 200, 7 = 192, 6 = 188, 5 = 180, 4 = 174, 3 = 170, 2 = 169, 1 = 165
const NIGHTMARE_MAX = [165, 169, 170, 174, 180, 188, 192, 200, 200, 200];
export const MODES: Mode[] = [
  {
    id: 'easy', name: 'Easy', color: '#7ad07a', desc: 'Gentle monsters. Drops are your power −5 to +5, and each difficulty adds 1 to the low end and 3 to the high end.',
    threat: [1, 2, 3, 5, 8, 11, 14, 17, 20, 24], maxDrop: NORMAL_MAX, enchanted: 0, hp: 0.75, dmg: 0.7,
    // power 7: d.1 = 2-12, d.2 = 3-15, d.3 = 4-18 …
    range: (P, d) => [P - 5 + (d - 1), P + 5 + 3 * (d - 1)],
  },
  {
    id: 'normal', name: 'Normal', color: '#e8d870', desc: 'Drops are your power −3 to +10, and each difficulty adds 2 to the low end and 5 to the high end.',
    threat: [1, 3, 6, 10, 14, 19, 24, 29, 35, 42], maxDrop: NORMAL_MAX, enchanted: 0.03, hp: 1, dmg: 1,
    // power 7: d.1 = 4-17, d.2 = 6-22, d.3 = 8-27 …
    range: (P, d) => [P - 3 + 2 * (d - 1), P + 10 + 5 * (d - 1)],
  },
  {
    id: 'hard', name: 'Hard', color: '#ff9a40', desc: 'Opens after you beat mission 8. Monsters come enchanted with fast hits, protection and more, but the loot is far better (power 7: d.1 drops 22-43).',
    threat: [45, 55, 66, 78, 90, 102, 114, 126, 138, 150], maxDrop: HARD_MAX, enchanted: 0.25, hp: 1, dmg: 1,
    range: (P, d) => [P + 15 + 2 * (d - 1), P + 36 + 5 * (d - 1)],
  },
  {
    id: 'nightmare', name: 'Nightmare', color: '#d04aff', desc: 'Opens after you beat mission 8 on Hard. The toughest monsters, almost all enchanted, and gear up to level 200.',
    threat: [155, 162, 168, 174, 180, 186, 190, 194, 197, 200], maxDrop: NIGHTMARE_MAX, enchanted: 0.45, hp: 1, dmg: 1,
    range: (P, d) => [P + 30 + 2 * (d - 1), P + 60 + 5 * (d - 1)],
  },
];
export const modeOf = (id: ModeId | undefined) => MODES.find((m) => m.id === id) ?? MODES[1];
export const DIFF_COUNT = 10;

/** your power: the levels of your sword, bow and armor added together, then ÷ 3 */
export function powerOf(melee: ItemKey | '', ranged: ItemKey | '', armor: ItemKey | '') {
  return Math.max(1, Math.round((lvOfKey(melee) + lvOfKey(ranged) + lvOfKey(armor)) / 3));
}

/** The gear levels that can drop for power P on difficulty d (0-based index) in a mode. */
export function dropRange(mode: ModeId, P: number, d: number): [number, number] {
  const M = modeOf(mode);
  const cap = M.maxDrop[d];
  let [lo, hi] = M.range(P, d + 1);
  // from difficulty 3 everything is at least level 3, from difficulty 6 at least level 6
  const floor = d + 1 >= 6 ? 6 : d + 1 >= 3 ? 3 : 1;
  lo = Math.max(floor, lo);
  hi = Math.max(lo, hi);
  hi = Math.min(cap, hi, MAX_LEVEL);
  lo = Math.min(lo, hi);
  return [Math.round(lo), Math.round(hi)];
}
export function rollDropLevel(mode: ModeId, P: number, d: number, r = Math.random()) {
  const [lo, hi] = dropRange(mode, P, d);
  return lo + Math.floor(r * (hi - lo + 1));
}

export interface Difficulty {
  name: string;
  /** extra monsters per room */
  more: number;
  /** chance a chest has a piece of gear */
  gear: number;
  xp: number;
  color: string;
  /** monster health and damage on top of their level */
  hp: number;
  dmg: number;
  /** extra chance a monster comes enchanted */
  ench: number;
  /** extra rooms, so higher difficulties are longer */
  rooms: number;
  /** chance of a surprise mini-boss, and of a second one */
  mini: number;
  mini2: number;
}
const DCOL = ['#7ad07a', '#a0d878', '#c8e07a', '#e8d870', '#ffc050', '#ff9a40', '#ff7a40', '#ff5a50', '#ff4a7a', '#d04aff'];
// Higher difficulties get much harder fast: D10 monsters have about 5.6x the health and 3.3x the damage of D1
// (on top of their higher level), there are more of them, more come enchanted and the missions are longer.
export const DIFFS: Difficulty[] = DCOL.map((color, i) => ({
  name: `D${i + 1}`,
  more: Math.floor(i / 2) + (i >= 7 ? 1 : 0),
  gear: 0.55 + i * 0.03,
  xp: 1 + i * 0.3,
  color,
  hp: 1 + 0.2 * i + 0.035 * i * i,
  dmg: 1 + 0.12 * i + 0.015 * i * i,
  ench: i * 0.03,
  rooms: Math.round(i * 0.7),
  mini: Math.min(0.9, 0.35 + i * 0.06),
  mini2: Math.max(0, (i - 5) * 0.15),
}));
export const MINI_BOSSES: MonsterKind[] = ['void-stalker', 'ember-golem', 'hex-lord'];

/** odds a mob drops a piece of gear: 0.3% */
export const MOB_GEAR_CHANCE = 0.003;

// ---------- artifacts ----------
export type ArtifactId =
  | 'soul-beacon' | 'healing-totem' | 'hay-bundle' | 'old-bone' | 'soul-mender' | 'firework-arrow' | 'charm-medallion'
  | 'soul-quiver' | 'fire-quiver' | 'poison-quiver' | 'gust-horn' | 'thunder-charm' | 'ghost-boots' | 'ironhide-charm';
export interface Artifact {
  name: string;
  desc: string;
  cooldown: number;
  /** souls it uses (0 = none) */
  souls: number;
  color: string;
}
export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  'soul-beacon': { name: 'Soul Beacon', desc: 'Fires a burning beam of soul light in front of you for 3 seconds.', cooldown: 6, souls: 40, color: '#b07aff' },
  'healing-totem': { name: 'Healing Totem', desc: 'Plants a totem that heals everyone standing near it.', cooldown: 22, souls: 0, color: '#6fe08a' },
  'hay-bundle': { name: 'Hay Bundle', desc: 'Calls a fighting llama that spits at monsters for 30 seconds.', cooldown: 32, souls: 0, color: '#e8c860' },
  'old-bone': { name: 'Old Bone', desc: 'Calls a fighting wolf that bites monsters for 30 seconds.', cooldown: 32, souls: 0, color: '#e8e0d0' },
  'soul-mender': { name: 'Soul Mender', desc: 'Heals you and every teammate in a medium range.', cooldown: 10, souls: 30, color: '#7af0e0' },
  'firework-arrow': { name: 'Firework Arrow', desc: 'Ties a firework to your next arrow. It explodes when it hits.', cooldown: 10, souls: 0, color: '#ff6ad6' },
  'charm-medallion': { name: 'Charm Medallion', desc: 'Up to 5 nearby monsters fight for you for 10 seconds.', cooldown: 28, souls: 0, color: '#ff7aa8' },
  'soul-quiver': { name: 'Soul Quiver', desc: '3 slow soul arrows that knock monsters back and bounce back to hit them again, up to 10 times.', cooldown: 8, souls: 30, color: '#9ae0ff' },
  'fire-quiver': { name: 'Fire Quiver', desc: 'Your next 8 arrows set monsters on fire.', cooldown: 16, souls: 0, color: '#ff8a3a' },
  'poison-quiver': { name: 'Poison Quiver', desc: 'Your next 8 arrows poison monsters.', cooldown: 16, souls: 0, color: '#8ae04a' },
  'gust-horn': { name: 'Gust Horn', desc: 'A blast of wind knocks back and stuns everything near you.', cooldown: 12, souls: 0, color: '#cfe8ff' },
  'thunder-charm': { name: 'Thunder Charm', desc: 'Lightning strikes the five closest monsters.', cooldown: 14, souls: 0, color: '#ffe066' },
  'ghost-boots': { name: 'Ghost Boots', desc: 'Run 60% faster for 5 seconds.', cooldown: 16, souls: 0, color: '#b8a8ff' },
  'ironhide-charm': { name: 'Ironhide Charm', desc: 'Take 75% less damage for 6 seconds.', cooldown: 25, souls: 0, color: '#9aa4ae' },
};
export const ALL_ARTIFACTS = Object.keys(ARTIFACTS) as ArtifactId[];

// ---------- monsters ----------
export type MonsterKind =
  | 'shambler' | 'rattler' | 'gloop' | 'fizzler' | 'bog-rider' | 'marauder' | 'armored-shambler' | 'armored-rattler' | 'hexer' | 'loot-hog'
  | 'void-stalker' | 'ember-golem' | 'hex-lord' | 'gloomguard' | 'nyxwing';

export type MonsterShot = 'ember' | 'spore' | 'ice' | 'bone' | 'mbolt' | 'void' | 'sonic';
export interface MonsterDef {
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  /** melee: hits when close; ranged: keeps distance and shoots; flier: swoops; flee: runs away; boss: big move set */
  style: 'melee' | 'ranged' | 'flier' | 'boss' | 'flee';
  range: number;
  windup: number;
  cooldown: number;
  radius: number;
  xp: number;
  shot?: MonsterShot;
  blurb: string;
  element?: Element;
  /** a mini-boss: tougher, shows a health bar */
  mini?: boolean;
  /** flies over hazards */
  fly?: boolean;
  /** how tall it is, for health bars */
  tall?: number;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  shambler: { name: 'Shambler', hp: 30, speed: 1.7, dmg: 8, style: 'melee', range: 0.9, windup: 0.45, cooldown: 1.1, radius: 0.32, xp: 2, blurb: 'A slow, groaning thing in a sack hood. It never stops walking toward you.' },
  rattler: { name: 'Rattler', hp: 22, speed: 2.0, dmg: 7, style: 'ranged', range: 6, windup: 0.7, cooldown: 1.8, radius: 0.3, xp: 2, shot: 'bone', blurb: 'A clattering bundle of old bones with a bent bow.' },
  gloop: { name: 'Gloop', hp: 44, speed: 1.6, dmg: 7, style: 'melee', range: 0.9, windup: 0.4, cooldown: 1.0, radius: 0.4, xp: 2, blurb: 'A wobbly green blob. Pop it and it splits in two.' },
  fizzler: { name: 'Fizzler', hp: 20, speed: 2.7, dmg: 34, style: 'melee', range: 1.3, windup: 1.1, cooldown: 1, radius: 0.32, xp: 3, blurb: 'A walking bulb with a lit fuse. When it hisses, run!' },
  'bog-rider': { name: 'Bog Rider', hp: 60, speed: 3.6, dmg: 11, style: 'melee', range: 1.1, windup: 0.35, cooldown: 1.0, radius: 0.46, xp: 4, blurb: 'A shambler riding a bony swamp boar. Very fast.' },
  marauder: { name: 'Marauder', hp: 32, speed: 2.0, dmg: 11, style: 'ranged', range: 6.5, windup: 0.9, cooldown: 2.2, radius: 0.3, xp: 3, shot: 'mbolt', blurb: 'A masked bandit with a crossbow.' },
  'armored-shambler': { name: 'Armored Shambler', hp: 96, speed: 1.6, dmg: 12, style: 'melee', range: 0.95, windup: 0.5, cooldown: 1.1, radius: 0.34, xp: 5, blurb: 'A shambler in a rusty helmet and plates: 3.2× the health and 1.5× the power.' },
  'armored-rattler': { name: 'Armored Rattler', hp: 70, speed: 1.9, dmg: 10.5, style: 'ranged', range: 6, windup: 0.7, cooldown: 1.8, radius: 0.31, xp: 5, shot: 'bone', blurb: 'A rattler with an iron helmet: 3.2× the health and 1.5× the power.' },
  hexer: { name: 'Hexer', hp: 40, speed: 1.8, dmg: 6, style: 'ranged', range: 7, windup: 1.0, cooldown: 2.6, radius: 0.3, xp: 4, shot: 'void', blurb: 'A robed caster who enchants other monsters with fast hits, protection or strength.' },
  'loot-hog': { name: 'Loot Hog', hp: 36, speed: 3.0, dmg: 0, style: 'flee', range: 0, windup: 1, cooldown: 1, radius: 0.36, xp: 2, blurb: 'A pig with a chest on its back. Catch it for gear!' },
  'void-stalker': { name: 'Void Stalker', hp: 280, speed: 3.2, dmg: 20, style: 'melee', range: 1.2, windup: 0.4, cooldown: 1.0, radius: 0.36, xp: 25, mini: true, tall: 2.2, blurb: 'A tall shadow with violet eyes. It blinks behind you.' },
  'ember-golem': { name: 'Ember Golem', hp: 440, speed: 1.5, dmg: 26, style: 'melee', range: 1.5, windup: 0.8, cooldown: 1.5, radius: 0.7, xp: 30, mini: true, tall: 2, blurb: 'A boulder giant with lava in its cracks. Its slams shake the floor.' },
  'hex-lord': { name: 'Hex Lord', hp: 320, speed: 1.6, dmg: 16, style: 'ranged', range: 7, windup: 0.9, cooldown: 2.0, radius: 0.36, xp: 30, mini: true, shot: 'void', tall: 1.6, blurb: 'The hexers’ master. Calls up rows of biting spikes and summons help.' },
  gloomguard: { name: 'The Gloomguard', hp: 2000, speed: 1.9, dmg: 34, style: 'boss', range: 1.8, windup: 0.9, cooldown: 1.4, radius: 0.9, xp: 120, tall: 2.8, blurb: 'The blind stone guardian of the deep caves. It hunts by sound and roars sonic blasts.' },
  nyxwing: { name: 'Nyxwing, the Void Wyrm', hp: 2600, speed: 2.6, dmg: 30, style: 'boss', range: 2.2, windup: 0.9, cooldown: 1.4, radius: 1.1, xp: 200, fly: true, tall: 2.6, blurb: 'A great winged wyrm of starless black and violet fire that rules the Void Realm.' },
};
export const isMini = (k: MonsterKind) => !!MONSTERS[k].mini;

// ---------- missions ----------
export type Deco = 'village' | 'pumpkins' | 'canyon' | 'mines' | 'halls' | 'caves' | 'creek' | 'void';
export interface LevelDef {
  id: string;
  name: string;
  blurb: string;
  floor: [string, string];
  wall: [string, string];
  accent: string;
  ambient: string;
  light: number;
  monsters: MonsterKind[];
  /** the boss in the last room: a mini-boss or a final boss */
  guardian: { kind: MonsterKind; name: string; scale: number; hp: number };
  /** a mini-boss waiting somewhere on the way */
  mini?: MonsterKind;
  rooms: number;
  hazard?: 'lava' | 'water' | 'ice';
  /** share of areas that are outdoors (0..1) */
  outdoor: number;
  deco: Deco;
  /** outdoor ground: [pattern, ground a, ground b, bush a, bush b] */
  out: ['grass' | 'dirt', string, string, string, string];
  /** where it sits on the camp's mission map (0..100) */
  map: { x: number; y: number };
  /** a final boss mission */
  final?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    id: 'village', name: 'Ruined Village', blurb: 'A village of broken houses where shamblers and rattlers wander. Start here.',
    floor: ['#7a6e60', '#6a5f52'], wall: ['#8a7a66', '#5a4c3e'], accent: '#ffcf6a', ambient: '#140f0a', light: 0.7,
    monsters: ['shambler', 'shambler', 'rattler', 'gloop'], outdoor: 0.75, deco: 'village', out: ['grass', '#6fae4a', '#5f9a40', '#3f8a3a', '#2f6e2c'],
    guardian: { kind: 'armored-shambler', name: 'Old Grubjaw', scale: 2.0, hp: 380 }, rooms: 20, map: { x: 18, y: 78 },
  },
  {
    id: 'pumpkins', name: 'Pumpkin Trail', blurb: 'A long trail outside with pumpkins everywhere. Watch for fizzlers in the patches.',
    floor: ['#8a7a5a', '#7a6a4c'], wall: ['#6a5a3a', '#4a3a24'], accent: '#ff9a2a', ambient: '#150c06', light: 0.6,
    monsters: ['shambler', 'rattler', 'fizzler', 'bog-rider'], outdoor: 0.92, deco: 'pumpkins', out: ['grass', '#8aa04a', '#7a9040', '#6a7a2a', '#4a5a1a'],
    guardian: { kind: 'hex-lord', name: 'The Hex Lord', scale: 1.3, hp: 520 }, rooms: 21, map: { x: 9, y: 44 },
  },
  {
    id: 'canyon', name: 'Canyon of Doom', blurb: 'Red rock walls, dry riverbeds and marauder camps.',
    floor: ['#b0704a', '#a0623e'], wall: ['#c07a4a', '#7a3e22'], accent: '#ffb070', ambient: '#1a0a04', light: 0.5,
    monsters: ['marauder', 'rattler', 'fizzler', 'hexer', 'marauder'], outdoor: 0.8, deco: 'canyon', out: ['dirt', '#c08a5a', '#b07a4c', '#a05a30', '#7a3e22'],
    guardian: { kind: 'void-stalker', name: 'Shade of the Canyon', scale: 1.3, hp: 620 }, rooms: 22, map: { x: 28, y: 12 },
  },
  {
    id: 'mines', name: 'Ember Mines', blurb: 'Old mine tunnels lit by glowing ember ore, with lava in the low parts.',
    floor: ['#4a3e3a', '#3e3430'], wall: ['#5a4a44', '#2e2420'], accent: '#ff5a3a', ambient: '#140604', light: 0.9,
    monsters: ['armored-shambler', 'rattler', 'gloop', 'fizzler', 'shambler'], outdoor: 0.1, deco: 'mines', hazard: 'lava', out: ['dirt', '#5a4a40', '#4a3a32', '#3a3a2a', '#5a2a1a'],
    guardian: { kind: 'ember-golem', name: 'The Ember Golem', scale: 1.4, hp: 800 }, rooms: 22, map: { x: 48, y: 90 },
  },
  {
    id: 'halls', name: 'Great Halls', blurb: 'A huge stone castle with banners, carpets and an army of marauders.',
    floor: ['#8a8070', '#7a7062'], wall: ['#a09888', '#605848'], accent: '#e0c060', ambient: '#0e0c08', light: 0.75,
    monsters: ['marauder', 'hexer', 'armored-rattler', 'armored-shambler', 'marauder'], outdoor: 0.15, deco: 'halls', out: ['grass', '#6a9a4a', '#5a8a40', '#3f7a3a', '#2f5e2c'],
    guardian: { kind: 'hex-lord', name: 'Hex Lord Morvane', scale: 1.5, hp: 900 }, mini: 'ember-golem', rooms: 23, map: { x: 60, y: 8 },
  },
  {
    id: 'caves', name: 'Deep Caves', blurb: 'Dark, wet caves full of glowing crystals. Something huge and blind lives at the bottom.',
    floor: ['#3e4a52', '#343e46'], wall: ['#4a5a64', '#222c34'], accent: '#5ae0d0', ambient: '#04080a', light: 0.95,
    monsters: ['gloop', 'armored-shambler', 'rattler', 'fizzler', 'armored-rattler'], outdoor: 0, deco: 'caves', hazard: 'water', out: ['dirt', '#3e4a52', '#343e46', '#2a3a3a', '#1a2a2a'],
    guardian: { kind: 'gloomguard', name: 'The Gloomguard', scale: 1, hp: 2000 }, mini: 'void-stalker', rooms: 24, map: { x: 82, y: 80 }, final: true,
  },
  {
    id: 'creek', name: 'Fizzler Creek', blurb: 'A sunny creek with lily pads and tall reeds, and far too many fizzlers.',
    floor: ['#6a8a5a', '#5a7a4c'], wall: ['#5a7a4a', '#3a5a2a'], accent: '#7ae0ff', ambient: '#06100c', light: 0.5,
    monsters: ['fizzler', 'fizzler', 'gloop', 'bog-rider', 'shambler'], outdoor: 0.85, deco: 'creek', hazard: 'water', out: ['grass', '#7ab85a', '#6aa84c', '#4a9a3a', '#2f7a2c'],
    guardian: { kind: 'void-stalker', name: 'The Creek Stalker', scale: 1.4, hp: 900 }, mini: 'hex-lord', rooms: 23, map: { x: 91, y: 48 },
  },
  {
    id: 'void', name: 'The Void Realm', blurb: 'Floating islands of violet glass in a starless sky, with black crystal spires. Nyxwing waits at the end.',
    floor: ['#4a3e62', '#3e3456'], wall: ['#2a2238', '#140e20'], accent: '#c07aff', ambient: '#05030a', light: 0.85,
    monsters: ['void-stalker', 'armored-shambler', 'hexer', 'armored-rattler', 'fizzler'], outdoor: 0.3, deco: 'void', out: ['dirt', '#5a4a7a', '#4e406c', '#3a2a5a', '#1a1030'],
    guardian: { kind: 'nyxwing', name: 'Nyxwing, the Void Wyrm', scale: 1, hp: 2600 }, mini: 'void-stalker', rooms: 24, map: { x: 89, y: 14 }, final: true,
  },
];
export const LAST_LEVEL = LEVELS.length - 1;
