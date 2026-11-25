// M.D. (Monster Dungeons): weapons, armor, monsters, dungeon levels and traders.
// Everything here is original: names, stats and the blocky looks in models.ts.

export type MeleeId =
  | 'rusty-sword' | 'twin-daggers' | 'battle-axe' | 'long-spear' | 'thunder-hammer' | 'frost-glaive' | 'ember-blade'
  | 'sickle' | 'scythe' | 'obsidian-cleaver' | 'dragonfang' | 'rimeblade'
  | 'bone-club' | 'coral-cutlass' | 'shadow-katana' | 'moon-sickle' | 'blizzard-axe' | 'magma-axe' | 'spiked-mace' | 'frostbite-daggers'
  | 'cinder-claws' | 'thunder-pike' | 'venom-spear' | 'crystal-greatsword' | 'volcano-hammer' | 'soul-scythe';
export type RangedId = 'shortbow' | 'crossbow' | 'fan-bow' | 'starlight-bow' | 'rapid-repeater' | 'storm-bow' | 'thornspike-bow' | 'dragonbone-longbow' | 'glacier-bow'
  | 'hunters-longbow' | 'twinstring-bow' | 'ember-crossbow' | 'frost-repeater' | 'thunderclap-crossbow' | 'phoenix-bow';
export type ArmorId = 'tunic' | 'jerkin' | 'chainmail' | 'mossguard' | 'obsidian-plate' | 'scout-cloak' | 'knight-plate' | 'shadowweave' | 'dragonscale';
export type GearId = MeleeId | RangedId | ArmorId;
export type Rarity = 'normal' | 'gold' | 'diamond';
/** An owned item: the gear id, plus "@gold" or "@diamond" for the rare versions. */
export type ItemKey = string;

/** How a weapon is drawn in the hero's hand. */
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
  price: number;
  color: string;
  blade: string;
  shape: MeleeShape;
  /** drawn with a glow */
  glow?: boolean;
  element?: Element;
  burnChance?: number;
  slowChance?: number;
  /** health back per hit */
  leech?: number;
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
}
export interface Armor {
  kind: 'armor';
  name: string;
  desc: string;
  /** share of damage blocked, 0..1 */
  block: number;
  speed: number;
  regen: number;
  price: number;
  color: string;
  trim: string;
  /** walk on lava without burning */
  lavaproof?: boolean;
  /** dodge roll recharges faster */
  quickroll?: boolean;
  /** horns, spikes or a hood on the helmet */
  helm?: 'horns' | 'hood' | 'crest' | 'spikes';
  /** roll cooldown multiplier (Nimble) */
  rollMul?: number;
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

/** what you swing with nothing equipped */
export const FIST: Melee = { kind: 'melee', shape: 'fist', name: 'Fists', desc: 'Better than nothing!', dmg: 4, rate: 0.32, reach: 1.0, arc: 80, knock: 2, price: 0, color: '#e8b890', blade: '#e8b890' };

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

export const ARMOR: Record<ArmorId, Armor> = {
  tunic: { kind: 'armor', name: "Traveler's Tunic", desc: 'Comfy. Blocks nothing.', block: 0, speed: 1, regen: 0, price: 0, color: '#3f7a5a', trim: '#2c4f3c' },
  'scout-cloak': { kind: 'armor', name: "Scout's Cloak", desc: 'Blocks 10% and you run 12% faster.', block: 0.1, speed: 1.12, regen: 0, price: 90, color: '#4a5a3a', trim: '#2a3420', helm: 'hood' },
  jerkin: { kind: 'armor', name: 'Leather Jerkin', desc: 'Blocks 15% of damage.', block: 0.15, speed: 1, regen: 0, price: 70, color: '#8a5a32', trim: '#5a3418' },
  chainmail: { kind: 'armor', name: 'Chainmail', desc: 'Blocks 30% of damage, a little heavy.', block: 0.3, speed: 0.95, regen: 0, price: 170, color: '#8c939c', trim: '#5b6169' },
  shadowweave: { kind: 'armor', name: 'Shadowweave', desc: 'Blocks 30% and your dodge roll recharges twice as fast.', block: 0.3, speed: 1.05, regen: 0, price: 260, color: '#2a2a3a', trim: '#6a4aa0', quickroll: true, helm: 'hood' },
  mossguard: { kind: 'armor', name: 'Mossguard Plate', desc: 'Blocks 40% and slowly heals you.', block: 0.4, speed: 0.95, regen: 1.2, price: 300, color: '#4d7a3a', trim: '#a8c46a' },
  'knight-plate': { kind: 'armor', name: "Knight's Plate", desc: 'Heavy steel with a red crest. Blocks 50%.', block: 0.5, speed: 0.9, regen: 0, price: 420, color: '#b8c0c8', trim: '#c0392b', helm: 'crest' },
  'obsidian-plate': { kind: 'armor', name: 'Obsidian Plate', desc: 'Spiked black armor. Blocks 55% of damage.', block: 0.55, speed: 0.92, regen: 0, price: 560, color: '#2a2238', trim: '#9b6ad6', helm: 'spikes' },
  dragonscale: { kind: 'armor', name: 'Dragonscale Armor', desc: 'Red scales and horns. Blocks 55% and lava can’t burn you.', block: 0.55, speed: 1, regen: 0, price: 720, color: '#8a1e1e', trim: '#e0a030', lavaproof: true, helm: 'horns' },
};

// ---------- gold and diamond ----------
export const GOLD_CHANCE = 0.005;
export const DIAMOND_CHANCE = 0.0005;

export function rollRarity(r = Math.random()): Rarity {
  return r < DIAMOND_CHANCE ? 'diamond' : r < DIAMOND_CHANCE + GOLD_CHANCE ? 'gold' : 'normal';
}
export function parseKey(key: ItemKey): { id: GearId; rarity: Rarity } {
  const [id, r] = key.split('@');
  return { id: id as GearId, rarity: r === 'gold' || r === 'diamond' ? r : 'normal' };
}
export const makeKey = (id: GearId, rarity: Rarity): ItemKey => (rarity === 'normal' ? id : `${id}@${rarity}`);
export const RARITY_LOOK = {
  gold: { metal: '#ffd040', dark: '#a07010', name: 'Golden' },
  diamond: { metal: '#8af4ff', dark: '#2a8aa0', name: 'Diamond' },
};
// ---------- "the set" levels (1 to 100) ----------
export const MAX_LEVEL = 100;
/** xp to go from level lv to lv + 1 */
export const xpNeed = (lv: number) => 3 + Math.floor(lv * 0.6);
/** how much better an item gets with its level: stronger, faster, and a little more reach */
export function levelBoost(lv = 1) {
  const t = Math.max(0, Math.min(MAX_LEVEL, lv) - 1) / (MAX_LEVEL - 1);
  return { dmg: 1 + 2 * t, rate: 1 - 0.35 * t, reach: 1 + 0.2 * t, bowRange: 1 + 0.06 * t, block: 0.15 * t, regen: 1.2 * t, speed: 1 + 0.06 * t };
}

const mul = { normal: 1, gold: 1.35, diamond: 1.8 };
const fast = { normal: 1, gold: 0.9, diamond: 0.8 };

export const isMelee = (id: GearId): id is MeleeId => id in MELEE;
export const isRanged = (id: GearId): id is RangedId => id in RANGED;
export const isArmor = (id: GearId): id is ArmorId => id in ARMOR;

/** The real stats and look of an owned item, with its rarity applied. */
export function meleeOf(key: ItemKey | '', lv = 1): Melee {
  const w = baseMelee(key);
  if (lv <= 1 || !key) return w;
  const B = levelBoost(lv);
  return { ...w, dmg: Math.round(w.dmg * B.dmg), rate: w.rate * B.rate, reach: +(w.reach * B.reach).toFixed(2) };
}
function baseMelee(key: ItemKey | ''): Melee {
  if (!key) return FIST;
  const { id, rarity } = parseKey(key);
  const b = MELEE[id as MeleeId] ?? FIST;
  if (rarity === 'normal') return b;
  const L = RARITY_LOOK[rarity];
  return { ...b, name: `${L.name} ${b.name}`, dmg: Math.round(b.dmg * mul[rarity]), rate: b.rate * fast[rarity], reach: +(b.reach * (rarity === 'diamond' ? 1.12 : 1.06)).toFixed(2), blade: L.metal, color: b.shape === 'cleaver' ? L.dark : b.color, glow: true };
}
export function rangedOf(key: ItemKey, lv = 1): Ranged {
  const w = baseRanged(key);
  if (lv <= 1) return w;
  const B = levelBoost(lv);
  return { ...w, dmg: Math.round(w.dmg * B.dmg), rate: w.rate * B.rate, speed: +(w.speed * B.bowRange).toFixed(2) };
}
function baseRanged(key: ItemKey): Ranged {
  const { id, rarity } = parseKey(key);
  const b = RANGED[id as RangedId] ?? RANGED.shortbow;
  if (rarity === 'normal') return b;
  const L = RARITY_LOOK[rarity];
  return { ...b, name: `${L.name} ${b.name}`, dmg: Math.round(b.dmg * mul[rarity]), rate: b.rate * fast[rarity], pierce: b.pierce + (rarity === 'diamond' ? 2 : 1), color: L.metal, glow: true };
}
export function armorOf(key: ItemKey, lv = 1): Armor {
  const a = baseArmor(key);
  if (lv <= 1) return a;
  const B = levelBoost(lv);
  return { ...a, block: +Math.min(0.85, a.block + B.block).toFixed(3), regen: +(a.regen + B.regen).toFixed(2), speed: +(a.speed * B.speed).toFixed(3) };
}
function baseArmor(key: ItemKey): Armor {
  const { id, rarity } = parseKey(key);
  const b = ARMOR[id as ArmorId] ?? ARMOR.tunic;
  if (rarity === 'normal') return b;
  const L = RARITY_LOOK[rarity];
  return { ...b, name: `${L.name} ${b.name}`, block: Math.min(0.8, b.block + (rarity === 'diamond' ? 0.2 : 0.1)), regen: b.regen + (rarity === 'diamond' ? 1 : 0.4), trim: L.metal, color: mixHex(b.color, L.metal, 0.3) };
}
export function itemName(key: ItemKey) {
  const { id } = parseKey(key);
  return isMelee(id) ? meleeOf(key).name : isRanged(id) ? rangedOf(key).name : armorOf(key).name;
}
function mixHex(a: string, b: string, t: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

export function gear(id: GearId): Melee | Ranged | Armor {
  return isMelee(id) ? MELEE[id] : isRanged(id) ? RANGED[id] : ARMOR[id as ArmorId];
}

// ---------- enchanting ----------
export type EnchId =
  | 'keen' | 'swift' | 'wildfire' | 'chill' | 'leech' | 'sweep'
  | 'power' | 'quick' | 'pierce' | 'flametip' | 'frosttip'
  | 'tough' | 'quickstep' | 'mend' | 'nimble';
export interface Ench {
  name: string;
  icon: string;
  for: 'melee' | 'ranged' | 'armor';
  /** what each tier (1..3) does */
  tiers: [string, string, string];
}
export const ENCHANTS: Record<EnchId, Ench> = {
  keen: { name: 'Keen Edge', icon: '🗡️', for: 'melee', tiers: ['+12% damage', '+24% damage', '+36% damage'] },
  swift: { name: 'Swift Strikes', icon: '💨', for: 'melee', tiers: ['8% faster', '16% faster', '24% faster'] },
  sweep: { name: 'Wide Sweep', icon: '🌀', for: 'melee', tiers: ['+15° swing', '+30° swing', '+45° swing'] },
  wildfire: { name: 'Wildfire', icon: '🔥', for: 'melee', tiers: ['30% of hits burn', '60% of hits burn', 'every hit burns'] },
  chill: { name: 'Chilling', icon: '❄️', for: 'melee', tiers: ['30% of hits slow', '60% of hits slow', 'every hit slows'] },
  leech: { name: 'Lifesteal', icon: '❤️', for: 'melee', tiers: ['heal 1 per hit', 'heal 2 per hit', 'heal 3 per hit'] },
  power: { name: 'Power Draw', icon: '🏹', for: 'ranged', tiers: ['+12% damage', '+24% damage', '+36% damage'] },
  quick: { name: 'Quick Nock', icon: '💨', for: 'ranged', tiers: ['8% faster', '16% faster', '24% faster'] },
  pierce: { name: 'Piercing', icon: '➶', for: 'ranged', tiers: ['pierce +1', 'pierce +2', 'pierce +3'] },
  flametip: { name: 'Flame Tips', icon: '🔥', for: 'ranged', tiers: ['40% of arrows burn', '70% of arrows burn', 'every arrow burns'] },
  frosttip: { name: 'Frost Tips', icon: '❄️', for: 'ranged', tiers: ['40% of arrows slow', '70% of arrows slow', 'every arrow slows'] },
  tough: { name: 'Toughness', icon: '🛡️', for: 'armor', tiers: ['+5% block', '+10% block', '+15% block'] },
  quickstep: { name: 'Quickstep', icon: '👟', for: 'armor', tiers: ['+5% speed', '+10% speed', '+15% speed'] },
  mend: { name: 'Mending', icon: '💚', for: 'armor', tiers: ['heal 0.8/s', 'heal 1.6/s', 'heal 2.4/s'] },
  nimble: { name: 'Nimble', icon: '🤸', for: 'armor', tiers: ['rolls recharge 15% faster', '30% faster', '45% faster'] },
};
/** an item holds up to this many different enchantments */
export const ENCH_SLOTS = 3;
/** points to reach a tier: tier 1 costs 1, tier 2 costs 2 more, tier 3 costs 3 more */
export const enchCost = (tier: number) => (tier * (tier + 1)) / 2;
export type EnchSet = Partial<Record<EnchId, number>>;

/** a melee weapon with its enchantments */
export function enchantMelee(w: Melee, e: EnchSet = {}): Melee {
  if (!Object.keys(e).length) return w;
  const t = (k: EnchId) => e[k] ?? 0;
  return {
    ...w,
    dmg: Math.round(w.dmg * (1 + 0.12 * t('keen'))),
    rate: w.rate * (1 - 0.08 * t('swift')),
    arc: w.arc >= 360 ? 360 : w.arc + 15 * t('sweep'),
    burnChance: [0, 0.3, 0.6, 1][t('wildfire')],
    slowChance: [0, 0.3, 0.6, 1][t('chill')],
    leech: t('leech'),
  };
}
export function enchantRanged(w: Ranged, e: EnchSet = {}): Ranged {
  if (!Object.keys(e).length) return w;
  const t = (k: EnchId) => e[k] ?? 0;
  return {
    ...w,
    dmg: Math.round(w.dmg * (1 + 0.12 * t('power'))),
    rate: w.rate * (1 - 0.08 * t('quick')),
    pierce: w.pierce + t('pierce'),
    burnChance: [0, 0.4, 0.7, 1][t('flametip')],
    slowChance: [0, 0.4, 0.7, 1][t('frosttip')],
  };
}
export function enchantArmor(a: Armor, e: EnchSet = {}): Armor {
  if (!Object.keys(e).length) return a;
  const t = (k: EnchId) => e[k] ?? 0;
  return {
    ...a,
    block: Math.min(0.9, a.block + 0.05 * t('tough')),
    speed: a.speed * (1 + 0.05 * t('quickstep')),
    regen: a.regen + 0.8 * t('mend'),
    rollMul: 1 - 0.15 * t('nimble'),
  };
}

// ---------- hero level ----------
export const HERO_MAX = 100;
export const heroXpNeed = (lv: number) => 8 + lv * 4;

// ---------- difficulty ----------
export interface Difficulty {
  name: string;
  desc: string;
  hp: number;
  dmg: number;
  /** extra monsters per room */
  more: number;
  coins: number;
  xp: number;
  reward: number;
  /** chance a chest has a new piece of gear */
  gear: number;
  /** the level new gear starts at */
  startLv: number;
  color: string;
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const HP = [0.8, 1, 1.35, 1.8, 2.4, 3.2, 4.2, 5.5];
const DMG = [0.7, 1, 1.25, 1.55, 1.9, 2.3, 2.8, 3.4];
const LOOT = [1, 1.2, 1.5, 1.9, 2.4, 3, 3.8, 4.8];
const XP = [1, 1.3, 1.7, 2.2, 2.8, 3.5, 4.3, 5.2];
const START = [1, 1, 3, 6, 10, 15, 21, 28];
const COLORS = ['#7ad07a', '#b8e07a', '#e8d870', '#ffc050', '#ff9a40', '#ff6a40', '#ff4a6a', '#d04aff'];
/** difficulties I to VIII: each one is harder, with better loot */
export const DIFFS: Difficulty[] = ROMAN.map((name, i) => ({
  name,
  desc: i === 0 ? 'The easiest. Good for learning a dungeon.' : i === 7 ? 'The hardest there is. The best loot there is.' : `Harder monsters${[0, 0, 1, 1, 2, 2, 3, 3][i] ? ' and more of them' : ''}, better loot.`,
  hp: HP[i], dmg: DMG[i], more: [0, 0, 1, 1, 2, 2, 3, 3][i], coins: LOOT[i], xp: XP[i], reward: LOOT[i],
  gear: 0.45 + i * 0.05, startLv: START[i], color: COLORS[i],
}));

// ---------- arrows ----------
export type ArrowKind = 'normal' | 'fire' | 'frost' | 'boom';
export const ARROWS: Record<ArrowKind, { name: string; color: string; desc: string }> = {
  normal: { name: 'Arrows', color: '#d8c8a0', desc: 'Plain arrows.' },
  fire: { name: 'Fire Arrows', color: '#ff8a3a', desc: 'Set enemies on fire.' },
  frost: { name: 'Frost Arrows', color: '#aee8ff', desc: 'Slow enemies down.' },
  boom: { name: 'Boom Arrows', color: '#ffe066', desc: 'Burst on hit, hurting everything close by.' },
};

// ---------- artifacts ----------
export type ArtifactId = 'healing-totem' | 'thunder-charm' | 'gust-horn' | 'ironhide-charm' | 'firework-crown' | 'ghost-boots';
export interface Artifact {
  name: string;
  desc: string;
  cooldown: number;
  price: number;
  color: string;
}
export const ARTIFACTS: Record<ArtifactId, Artifact> = {
  'healing-totem': { name: 'Healing Totem', desc: 'Plants a totem that heals you while you stand near it.', cooldown: 22, price: 120, color: '#6fe08a' },
  'gust-horn': { name: 'Gust Horn', desc: 'A blast of wind knocks back and stuns everything near you.', cooldown: 12, price: 110, color: '#cfe8ff' },
  'thunder-charm': { name: 'Thunder Charm', desc: 'Lightning strikes the five closest enemies.', cooldown: 14, price: 180, color: '#ffe066' },
  'ghost-boots': { name: 'Ghost Boots', desc: 'Run 60% faster for 5 seconds.', cooldown: 16, price: 150, color: '#b8a8ff' },
  'ironhide-charm': { name: 'Ironhide Charm', desc: 'Take 75% less damage for 6 seconds.', cooldown: 25, price: 200, color: '#9aa4ae' },
  'firework-crown': { name: 'Firework Crown', desc: 'Shoots a ring of 12 exploding fireworks.', cooldown: 18, price: 260, color: '#ff6ad6' },
};

export type SupplyId = 'potion' | 'arrows' | 'fire-arrows' | 'frost-arrows' | 'boom-arrows' | 'bomb' | 'mystery';
export const SUPPLIES: Record<SupplyId, { name: string; desc: string; price: number }> = {
  potion: { name: 'Healing Draught', desc: 'Heals 60% of your health. A fresh one brews every 20 seconds (Option / Alt).', price: 25 },
  arrows: { name: 'Bundle of 20 Arrows', desc: 'For any bow.', price: 12 },
  'fire-arrows': { name: '10 Fire Arrows', desc: 'Set enemies on fire. X switches arrows.', price: 30 },
  'frost-arrows': { name: '10 Frost Arrows', desc: 'Slow enemies down. X switches arrows.', price: 30 },
  'boom-arrows': { name: '8 Boom Arrows', desc: 'Burst on hit. X switches arrows.', price: 45 },
  bomb: { name: 'Fizz Bomb', desc: 'Throw it (R) and it bursts after a moment.', price: 30 },
  mystery: { name: 'Mystery Crate', desc: 'A random weapon, bow or armor you don’t own yet. Maybe even gold or diamond!', price: 200 },
};

// ---------- monsters ----------
export type MonsterKind = 'mossling' | 'lantern-monk' | 'sporecap' | 'rustknight' | 'gloomwing' | 'frost-wisp' | 'cinder-hound' | 'hollow-crown';

export interface MonsterDef {
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  /** melee: hits when close; ranged: keeps distance and shoots; flier: swoops */
  style: 'melee' | 'ranged' | 'flier' | 'boss';
  range: number;
  windup: number;
  cooldown: number;
  radius: number;
  coins: [number, number];
  shot?: 'ember' | 'spore' | 'ice';
  blurb: string;
  /** made of fire or ice: weak to the other one */
  element?: Element;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  mossling: { name: 'Mossling', hp: 26, speed: 2.4, dmg: 8, style: 'melee', range: 0.9, windup: 0.35, cooldown: 0.9, radius: 0.32, coins: [1, 3], blurb: 'A hopping block of mossy stone with glowing eyes.' },
  'lantern-monk': { name: 'Lantern Monk', hp: 22, speed: 2.0, dmg: 9, style: 'ranged', range: 5.5, windup: 0.6, cooldown: 1.6, radius: 0.3, coins: [2, 4], shot: 'ember', blurb: 'A hooded robe with a lantern for a head. Throws embers.', element: 'fire' },
  sporecap: { name: 'Sporecap', hp: 38, speed: 1.4, dmg: 7, style: 'ranged', range: 4.5, windup: 0.8, cooldown: 2.2, radius: 0.38, coins: [2, 5], shot: 'spore', blurb: 'A waddling mushroom that lobs clouds of spores.' },
  rustknight: { name: 'Rustknight', hp: 90, speed: 1.6, dmg: 20, style: 'melee', range: 1.25, windup: 0.75, cooldown: 1.5, radius: 0.45, coins: [5, 9], blurb: 'A big empty suit of horned armor. Slow, but it hits hard.' },
  gloomwing: { name: 'Gloomwing', hp: 14, speed: 4.2, dmg: 6, style: 'flier', range: 0.8, windup: 0.2, cooldown: 1.1, radius: 0.28, coins: [1, 2], blurb: 'A cube with leathery wings that swoops in fast.' },
  'frost-wisp': { name: 'Frost Wisp', hp: 34, speed: 2.2, dmg: 10, style: 'ranged', range: 6, windup: 0.55, cooldown: 1.7, radius: 0.32, coins: [3, 6], shot: 'ice', blurb: 'A floating ice crystal. Its bolts slow you down.', element: 'ice' },
  'cinder-hound': { name: 'Cinder Hound', hp: 40, speed: 3.6, dmg: 12, style: 'melee', range: 1.0, windup: 0.3, cooldown: 1.0, radius: 0.36, coins: [3, 6], blurb: 'A blocky dog of cooling lava that charges you down.', element: 'fire' },
  'hollow-crown': { name: 'The Hollow Crown', hp: 1400, speed: 1.5, dmg: 24, style: 'boss', range: 1.8, windup: 0.9, cooldown: 1.4, radius: 0.9, coins: [150, 200], blurb: 'An obsidian golem king who rules the deepest dungeon.' },
};

// ---------- levels ----------
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
  /** the guardian in the last room: a bigger, tougher version of a monster (or the final boss) */
  guardian: { kind: MonsterKind; name: string; scale: number; hp: number };
  rooms: number;
  hazard?: 'lava' | 'water' | 'ice';
  /** where it sits on the camp's mission map (0..100) */
  map: { x: number; y: number };
  reward: number;
}

export const LEVELS: LevelDef[] = [
  {
    id: 'crypt', name: 'Mossy Crypt', blurb: 'Old tombs gone green. Mind the hopping stones.',
    floor: ['#56605a', '#4a534d'], wall: ['#6d7a68', '#3d4a3a'], accent: '#8fd16a', ambient: '#0b1410', light: 0.8,
    monsters: ['mossling', 'mossling', 'lantern-monk', 'gloomwing'],
    guardian: { kind: 'mossling', name: 'Old Boulderback', scale: 2.2, hp: 260 }, rooms: 16, hazard: 'water', map: { x: 18, y: 72 }, reward: 65,
  },
  {
    id: 'shroom', name: 'Shroom Hollow', blurb: 'Caves full of giant glowing mushrooms, and some that walk.',
    floor: ['#5a4a5e', '#4c3e50'], wall: ['#7a5a7e', '#3e2c44'], accent: '#e06ad6', ambient: '#140b16', light: 0.85,
    monsters: ['sporecap', 'mossling', 'gloomwing', 'sporecap'],
    guardian: { kind: 'sporecap', name: 'Queen Puffshroom', scale: 2.4, hp: 420 }, rooms: 17, map: { x: 36, y: 40 }, reward: 95,
  },
  {
    id: 'frost', name: 'Frostdeep Halls', blurb: 'Frozen halls where wisps drift and old armor walks.',
    floor: ['#9fb6c8', '#8aa2b6'], wall: ['#d8eaf6', '#7896b0'], accent: '#aee8ff', ambient: '#0a1220', light: 0.95,
    monsters: ['frost-wisp', 'rustknight', 'gloomwing', 'frost-wisp'],
    guardian: { kind: 'rustknight', name: 'The Frozen Warden', scale: 2.0, hp: 700 }, rooms: 18, hazard: 'ice', map: { x: 60, y: 22 }, reward: 135,
  },
  {
    id: 'forge', name: 'Cinder Forge', blurb: 'A forge built over lava. Hounds of ember guard it.',
    floor: ['#4a3a36', '#3e302c'], wall: ['#6e4a3e', '#38221c'], accent: '#ff7a2a', ambient: '#1a0806', light: 0.9,
    monsters: ['cinder-hound', 'rustknight', 'lantern-monk', 'cinder-hound'],
    guardian: { kind: 'cinder-hound', name: 'Magmajaw', scale: 2.3, hp: 900 }, rooms: 19, hazard: 'lava', map: { x: 78, y: 52 }, reward: 175,
  },
  {
    id: 'throne', name: 'Obsidian Throne', blurb: 'The deepest dungeon, where the Hollow Crown waits.',
    floor: ['#2e2838', '#262030'], wall: ['#4a3e5e', '#1c1626'], accent: '#b07aff', ambient: '#08050e', light: 0.75,
    monsters: ['rustknight', 'frost-wisp', 'cinder-hound', 'lantern-monk', 'sporecap', 'gloomwing'],
    guardian: { kind: 'hollow-crown', name: 'The Hollow Crown', scale: 1, hp: 1400 }, rooms: 20, hazard: 'lava', map: { x: 88, y: 16 }, reward: 450,
  },
];

// ---------- traders ----------
export interface Trader {
  id: 'smith' | 'armorer' | 'peddler' | 'mystic';
  name: string;
  title: string;
  hello: string;
  /** where they stand in camp */
  x: number;
  y: number;
  look: { robe: string; trim: string; hat: string; skin: string };
}
export const TRADERS: Trader[] = [
  { id: 'smith', name: 'Bram', title: 'Weaponsmith', hello: 'Sharp steel and strong string! What will it be?', x: 9.5, y: 7.5, look: { robe: '#7a4a2a', trim: '#3a2010', hat: '#c0392b', skin: '#c98e5e' } },
  { id: 'armorer', name: 'Tilda', title: 'Armorer', hello: 'Can’t win if you can’t take a hit, friend.', x: 16.5, y: 7.5, look: { robe: '#4a5a7a', trim: '#2a3450', hat: '#9aa4ae', skin: '#f0c7a0' } },
  { id: 'peddler', name: 'Old Pip', title: 'Peddler', hello: 'Potions, arrows, bombs… and a crate of surprises!', x: 13, y: 15.5, look: { robe: '#6a3a7a', trim: '#f0c040', hat: '#3a2a5a', skin: '#e0b088' } },
  { id: 'mystic', name: 'Mira', title: 'Mystic', hello: 'Charms and relics, each with a little magic inside.', x: 21.5, y: 13.5, look: { robe: '#1f6a6a', trim: '#8af4e0', hat: '#123c3c', skin: '#d8a880' } },
];

export const SMITH_STOCK: GearId[] = ['twin-daggers', 'sickle', 'long-spear', 'battle-axe', 'scythe', 'frost-glaive', 'thunder-hammer', 'obsidian-cleaver', 'rimeblade', 'ember-blade', 'dragonfang', 'bone-club', 'coral-cutlass', 'spiked-mace', 'venom-spear', 'frostbite-daggers', 'cinder-claws', 'moon-sickle', 'shadow-katana', 'thunder-pike', 'blizzard-axe', 'magma-axe', 'soul-scythe', 'crystal-greatsword', 'volcano-hammer', 'crossbow', 'fan-bow', 'rapid-repeater', 'thornspike-bow', 'storm-bow', 'glacier-bow', 'starlight-bow', 'dragonbone-longbow', 'hunters-longbow', 'twinstring-bow', 'ember-crossbow', 'frost-repeater', 'thunderclap-crossbow', 'phoenix-bow'];
export const ARMOR_STOCK: ArmorId[] = ['scout-cloak', 'jerkin', 'chainmail', 'shadowweave', 'mossguard', 'knight-plate', 'obsidian-plate', 'dragonscale'];
export const PEDDLER_STOCK: SupplyId[] = ['arrows', 'fire-arrows', 'frost-arrows', 'boom-arrows', 'bomb', 'mystery'];
export const MYSTIC_STOCK: ArtifactId[] = ['healing-totem', 'gust-horn', 'thunder-charm', 'ghost-boots', 'ironhide-charm', 'firework-crown'];
