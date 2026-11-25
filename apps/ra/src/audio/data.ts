// What the Audio page (/audio/) shows: every clip the game plays, what it is,
// when it plays and (for the spoken lines) what is said and in whose voice.
// The numbers (how loud each clip is, how many takes of each line, the music
// volumes) are the game's own, from src/audio-config.ts; audio.test.ts checks
// that the words here cover every clip in public/.

import type { Loop, Sfx } from '../sfx';
import type { Announce, UnitLine, UnitVoice } from '../voice';

// Units, by the game's kind ids (UNIT in src/v2/game.ts), for the pictures.
export type UnitKind =
  | 'inf'
  | 'rocket'
  | 'gren'
  | 'eng'
  | 'dog'
  | 'cmdo'
  | 'flamer'
  | 'light'
  | 'heavy'
  | 'scorch'
  | 'lumen'
  | 'skyguard'
  | 'buggy'
  | 'apc'
  | 'arty'
  | 'comet'
  | 'mcv'
  | 'hauler'
  | 'heli'
  | 'heron'
  | 'jet'
  | 'plane'
  | 'boat'
  | 'otter'
  | 'destroyer'
  | 'cruiser'
  | 'carrier'
  | 'sub';

export const UNIT_NAME: Record<UnitKind, string> = {
  inf: 'G.I.',
  rocket: 'Rocketeer',
  gren: 'Grenadier',
  eng: 'Engineer',
  dog: 'Attack dog',
  cmdo: 'Commando',
  flamer: 'Flame trooper',
  light: 'Lancer tank',
  heavy: 'Bastion tank',
  scorch: 'Scorch tank',
  lumen: 'Lumen tank',
  skyguard: 'Skyguard tank',
  buggy: 'Scout buggy',
  apc: 'Mule APC',
  arty: 'Howler artillery',
  comet: 'Comet launcher',
  mcv: 'MCU',
  hauler: 'Ore hauler',
  heli: 'Kestrel copter',
  heron: 'Heron transport',
  jet: 'Swift jet',
  plane: 'Paratrooper plane',
  boat: 'Patrol boat',
  otter: 'Otter hovercraft',
  destroyer: 'Destroyer',
  cruiser: 'Skyguard cruiser',
  carrier: 'Carrier',
  sub: 'Submarine',
};

// A picture beside a clip: a unit drawn and moving, or a building's (or the
// menu's) build-menu picture from public/cameos/.
export type Pic = { unit: UnitKind } | { cameo: string };

// One way the game plays a clip: who, at what speed (1 is as recorded;
// slower is lower), backwards or not.
export interface Use {
  who: string;
  rate?: number;
  reverse?: boolean;
  note?: string;
}

export interface SfxInfo {
  title: string;
  group: SfxGroup;
  what: string; // what it sounds like
  when: string; // when the game plays it
  pic?: Pic;
  uses?: Use[];
}

export type SfxGroup = 'weapons' | 'hits' | 'base' | 'loops' | 'ui';

export const SFX_GROUPS: { id: SfxGroup; title: string; blurb: string }[] = [
  { id: 'weapons', title: 'Weapons', blurb: 'Every gun, rocket and beam. One clip stands in for many weapons, played faster (higher) or slower (lower).' },
  { id: 'hits', title: 'Hits, blasts and deaths', blurb: 'What happens at the other end.' },
  { id: 'base', title: 'Building and the base', blurb: 'Putting up, selling and packing buildings, units coming out, ore.' },
  { id: 'loops', title: 'Loops', blurb: 'Always running once loaded; each frame the game sets how loud each one is from what is moving or burning near the middle of the view.' },
  { id: 'ui', title: 'Buttons and menus', blurb: 'Not part of the map, so these stay the same loudness wherever the view is.' },
];

// Every clip in public/sfx/. Every one is a one-shot unless it's a Loop.
export const SFX: Record<Sfx | Loop, SfxInfo> = {
  // ---- weapons ----
  rifle_shot: {
    title: 'Rifle shot',
    group: 'weapons',
    what: 'A single crack of a rifle.',
    when: 'Small arms firing. Machine guns play it a few times in a quick burst.',
    pic: { unit: 'inf' },
    uses: [
      { who: 'G.I.', rate: 1 },
      { who: 'Scout buggy, Mule APC (3-round burst)', rate: 1.35 },
      { who: 'Pillbox (4-round burst)', rate: 1.2 },
      { who: 'Commando (pistol double tap)', rate: 1.55 },
    ],
  },
  cannon_shot: {
    title: 'Tank cannon',
    group: 'weapons',
    what: 'A sharp cannon boom.',
    when: 'Tank and ship guns firing. Twin-barrelled guns play it twice, 0.05 s apart.',
    pic: { unit: 'light' },
    uses: [
      { who: 'Lancer tank', rate: 1 },
      { who: 'Bastion tank', rate: 0.8 },
      { who: 'Turret', rate: 0.92 },
      { who: 'Patrol boat', rate: 1.2 },
      { who: 'Destroyer', rate: 0.7 },
    ],
  },
  howitzer_shot: {
    title: 'Howitzer',
    group: 'weapons',
    what: 'A deep, heavy artillery boom.',
    when: 'Artillery firing, and under the Comet launcher’s rocket.',
    pic: { unit: 'arty' },
    uses: [
      { who: 'Howler artillery', rate: 1 },
      { who: 'Comet launcher (under the rocket roar)', rate: 0.7 },
    ],
  },
  rocket_launch: {
    title: 'Rocket launch',
    group: 'weapons',
    what: 'The whoosh of a rocket leaving its tube.',
    when: 'Anything that fires rockets, missiles or torpedoes.',
    pic: { unit: 'rocket' },
    uses: [
      { who: 'Rocketeer', rate: 1 },
      { who: 'Kestrel copter', rate: 1.15 },
      { who: 'Skyguard tank and battery', rate: 1.3 },
      { who: 'Skyguard cruiser', rate: 0.9 },
      { who: 'Carrier', rate: 1.6 },
      { who: 'Submarine torpedo', rate: 0.55 },
      { who: 'Comet launcher (the big rocket)', rate: 0.5 },
    ],
  },
  shell_whistle: {
    title: 'Incoming whistle',
    group: 'weapons',
    what: 'A falling shell whistling down.',
    when: 'Just before an artillery shell or a missile lands, timed to end as it hits.',
    pic: { unit: 'arty' },
    uses: [
      { who: 'Artillery shell', rate: 1.1 },
      { who: 'Missile', rate: 0.75 },
    ],
  },
  flame_burst: {
    title: 'Flamethrower',
    group: 'weapons',
    what: 'A roaring burst of flame.',
    when: 'Flamethrowers firing.',
    pic: { unit: 'flamer' },
    uses: [
      { who: 'Flame trooper', rate: 1.05 },
      { who: 'Scorch tank', rate: 0.85 },
    ],
  },
  dog_attack: {
    title: 'Dog attack',
    group: 'weapons',
    what: 'A snarling bark and bite.',
    when: 'An attack dog lunging at a soldier.',
    pic: { unit: 'dog' },
  },
  beam_fire: {
    title: 'Light beam',
    group: 'weapons',
    what: 'A crackling energy beam.',
    when: 'Lumen weapons firing.',
    pic: { unit: 'lumen' },
    uses: [
      { who: 'Lumen tank', rate: 1.05 },
      { who: 'Lumen tower', rate: 0.9 },
    ],
  },
  beam_charge: {
    title: 'Beam charge-up',
    group: 'weapons',
    what: 'A rising electric hum.',
    when: 'A Lumen tower charging before it fires.',
    pic: { cameo: 'prism' },
  },

  // ---- hits ----
  bullet_hit: {
    title: 'Bullet hit',
    group: 'hits',
    what: 'A metallic ping.',
    when: 'Bullets hitting a vehicle or building (not soldiers). Pitched 0.9–1.3 at random.',
    pic: { unit: 'apc' },
  },
  explosion_small: {
    title: 'Small explosion',
    group: 'hits',
    what: 'A short blast.',
    when: 'Shells and grenades landing, light vehicles blowing up, and the smaller blasts as a building goes up.',
    uses: [
      { who: 'Grenade', rate: 1 },
      { who: 'Big shell hit', rate: 0.85 },
      { who: 'Small shell hit', rate: 1.1 },
    ],
    pic: { unit: 'gren' },
  },
  explosion_large: {
    title: 'Large explosion',
    group: 'hits',
    what: 'A big, rolling blast.',
    when: 'Tanks and ships destroyed, buildings destroyed, the Comet’s rocket landing.',
    uses: [
      { who: 'Tank destroyed', rate: 1 },
      { who: 'Building destroyed', rate: 0.85 },
      { who: 'Comet rocket landing', rate: 0.75 },
      { who: 'Power plant destroyed', rate: 0.7 },
    ],
    pic: { unit: 'heavy' },
  },
  building_collapse: {
    title: 'Building collapse',
    group: 'hits',
    what: 'Masonry and steel crashing down.',
    when: 'Right after a building’s big blast, as it falls to a ruin.',
    pic: { cameo: 'factory' },
  },
  debris: {
    title: 'Debris',
    group: 'hits',
    what: 'Pieces clattering to the ground.',
    when: 'A third of a second after a vehicle blows up, as the pieces land.',
    pic: { unit: 'buggy' },
  },
  infantry_death: {
    title: 'Soldier killed',
    group: 'hits',
    what: 'A short cry.',
    when: 'Any soldier killed (not the dog). Pitched 0.9–1.15 at random so a squad doesn’t sound like one man.',
    pic: { unit: 'inf' },
  },
  dog_yelp: {
    title: 'Dog killed',
    group: 'hits',
    what: 'A yelp.',
    when: 'An attack dog killed.',
    pic: { unit: 'dog' },
  },

  // ---- base ----
  build_place: {
    title: 'Place',
    group: 'base',
    what: 'A heavy clunk.',
    when: 'Putting a building down, and many small jobs: walls, engineers going in, sandbags, planting a charge.',
    pic: { cameo: 'wall' },
    uses: [
      { who: 'Building placed', rate: 1 },
      { who: 'Engineer goes in to repair', rate: 0.9 },
      { who: 'G.I.s dig in', rate: 1.5 },
      { who: 'G.I.s climb out', rate: 1.25 },
      { who: 'Commando plants a charge', rate: 1.9 },
      { who: 'Hauler docks', rate: 0.6 },
    ],
  },
  build_rise: {
    title: 'Construction',
    group: 'base',
    what: 'Machinery and steel going up.',
    when: 'A building rising from its foundations. Selling plays it backwards as the building goes back down.',
    pic: { cameo: 'barracks' },
    uses: [
      { who: 'Building goes up', rate: 1.1 },
      { who: 'Building sold (backwards)', rate: 1.3, reverse: true },
    ],
  },
  foundry_unfold: {
    title: 'Foundry unfolds',
    group: 'base',
    what: 'Hydraulics and metal panels unfolding.',
    when: 'The MCU deploying into a Construction yard. Packing the yard back up plays it backwards.',
    pic: { unit: 'mcv' },
    uses: [
      { who: 'MCU deploys', rate: 1 },
      { who: 'Construction yard packs up (backwards)', rate: 1, reverse: true },
    ],
  },
  unit_exit: {
    title: 'Unit comes out',
    group: 'base',
    what: 'A door or hatch opening.',
    when: 'A new unit rolling or walking out of the Barracks, Vehicle works or Naval yard, and soldiers getting out of an APC.',
    pic: { cameo: 'barracks' },
    uses: [
      { who: 'New unit', rate: 1 },
      { who: 'Getting out of a transport', rate: 1.3 },
    ],
  },
  ore_unload: {
    title: 'Ore unload',
    group: 'base',
    what: 'Rocks pouring out of a tipped bed.',
    when: 'An Ore hauler tipping its load into a refinery.',
    pic: { unit: 'hauler' },
  },

  // ---- loops ----
  tracks_loop: {
    title: 'Tank tracks',
    group: 'loops',
    what: 'Clanking tracks and a diesel rumble.',
    when: 'Tracked vehicles moving: tanks, the MCU, the Ore hauler and others.',
    pic: { unit: 'heavy' },
  },
  engine_loop: {
    title: 'Engine',
    group: 'loops',
    what: 'A running engine.',
    when: 'Wheeled vehicles moving (Scout buggy, Mule APC, Howler artillery), and the paratrooper plane and Swift jets in the air.',
    pic: { unit: 'buggy' },
  },
  rotor_loop: {
    title: 'Rotors',
    group: 'loops',
    what: 'Helicopter blades chopping.',
    when: 'Kestrel copters and Heron transports in the air (quieter while hovering).',
    pic: { unit: 'heli' },
  },
  boat_loop: {
    title: 'Boat engine',
    group: 'loops',
    what: 'An engine and water churning.',
    when: 'Ships moving, and the Otter hovercraft on water. The Carrier is louder.',
    pic: { unit: 'destroyer' },
  },
  footsteps: {
    title: 'Footsteps',
    group: 'loops',
    what: 'Boots on dirt.',
    when: 'Soldiers walking.',
    pic: { unit: 'inf' },
  },
  ore_dig: {
    title: 'Ore digging',
    group: 'loops',
    what: 'A scoop scraping and crunching rock.',
    when: 'An Ore hauler digging in an ore field.',
    pic: { unit: 'hauler' },
  },
  surf_loop: {
    title: 'Surf',
    group: 'loops',
    what: 'Waves on a shore.',
    when: 'The view has both land and water in it; loudest when it’s about half and half.',
    pic: { cameo: 'navy' },
  },
  fire_loop: {
    title: 'Fire',
    group: 'loops',
    what: 'Crackling flames.',
    when: 'Burning wrecks and ruins as they die down, and buildings under half health.',
    pic: { cameo: 'power' },
  },

  // ---- ui ----
  ui_click: {
    title: 'Click',
    group: 'ui',
    what: 'A small button click.',
    when: 'Menu buttons, and moving the Sounds slider in Settings (so you can hear the new level).',
  },
  ui_panel: {
    title: 'Panel',
    group: 'ui',
    what: 'A soft slide.',
    when: 'Opening the menu (and a little lower closing it), opening Settings or Hotkeys.',
    uses: [
      { who: 'Open', rate: 1 },
      { who: 'Close', rate: 0.85 },
    ],
  },
  order_confirm: {
    title: 'Order',
    group: 'ui',
    what: 'A short radio blip.',
    when: 'Giving an order.',
    uses: [
      { who: 'Move or attack', rate: 1 },
      { who: 'Engineer sent to repair or capture', rate: 1.2 },
      { who: 'Into a bay, onto a carrier, haulers to ore or a refinery', rate: 1.3 },
      { who: 'A carrier sends its jets', rate: 0.8 },
    ],
  },
  ui_error: {
    title: 'Error',
    group: 'ui',
    what: 'A low buzz.',
    when: 'Something you asked for can’t be done (can’t build there, can’t afford it, nothing to deploy).',
  },
  ui_ready: {
    title: 'Ready',
    group: 'ui',
    what: 'A bright chime.',
    when: 'Something you were building is finished.',
  },
  credits_tick: {
    title: 'Credits tick',
    group: 'ui',
    what: 'A coin counter ticking.',
    when: 'Spending credits as something builds, ore credits coming in (higher), and selling.',
    uses: [
      { who: 'Spending', rate: 1 },
      { who: 'Ore credits in', rate: 1.4 },
    ],
  },
  whoosh_space: {
    title: 'Space whoosh',
    group: 'ui',
    what: 'A long rising whoosh.',
    when: 'Zooming out to the planet view (and backwards, zooming back down to the map).',
    uses: [
      { who: 'Up to space', rate: 1 },
      { who: 'Back down to the map', rate: 1, reverse: true },
    ],
  },
};

// ---------- Spoken lines ----------

export interface VoiceInfo {
  title: string; // who's talking
  voice: string; // the ElevenLabs voice
  voiceId: string; // its id there
  style: string; // how the voice is described, and how the lines were asked for
  units: UnitKind[]; // who answers in this voice (VOICE in src/v2/game.ts)
  note?: string;
}

// ElevenLabs Eleven v4 text to speech, one take per line, except the dog.
export const VOICES: Record<UnitVoice | 'announcer', VoiceInfo> = {
  soldier: {
    title: 'Infantry',
    voice: 'Jerry B. – Military Commander',
    voiceId: 'TxWZERZ5Hc6h9dGxVmXa',
    style: 'Gruff, gritty American military commander.',
    units: ['inf', 'rocket', 'gren'],
  },
  tank: {
    title: 'Vehicle crews',
    voice: 'Desert Ranger – Male 01',
    voiceId: 'iEvYV2o9zHf3RDl9U51b',
    style: 'Deep American voice, muffled as if through a gas-mask radio.',
    units: ['light', 'heavy', 'scorch', 'lumen', 'skyguard', 'arty', 'comet', 'apc', 'mcv', 'boat'],
  },
  copter: {
    title: 'Copter pilot',
    voice: 'Eryn – Strong Female Military Commander',
    voiceId: 'wa4sQVgbDDzUDEzJwch3',
    style: 'Strong, commanding American female voice.',
    units: ['heli'],
  },
  pilot: {
    title: 'Jet and plane pilot',
    voice: 'Everley Rhodes – VO Pro',
    voiceId: 'Xm5W2LBUW4LWizr18Fbd',
    style: 'Confident American female voice. Asked for: crisp, cool, over a cockpit radio; focused for the attack lines.',
    units: ['jet', 'heron', 'plane'],
  },
  scout: {
    title: 'Scout',
    voice: 'Emma – Wry, Gritty Hero',
    voiceId: 'dmWfLQZJq7wNPv9WmtiM',
    style: 'Wry, gritty young American woman with dry humor.',
    units: ['buggy'],
  },
  harvester: {
    title: 'Ore hauler driver',
    voice: 'David – Deep, Southern, Cowboy',
    voiceId: '0hh7H4ZVAtaGpm1VZyEN',
    style: 'Weathered Southern drawl.',
    units: ['hauler'],
  },
  engineer: {
    title: 'Engineer',
    voice: 'Mike – Multi Trade Expert',
    voiceId: 'kSSJYNGo5Kev6qgwVloV',
    style: 'Blue-collar North-Eastern US tradesman. Asked for: confident, brisk or cheerful, over the radio.',
    units: ['eng'],
  },
  commando: {
    title: 'Commando',
    voice: 'Pauly – Brooklyn Wise Guy',
    voiceId: 'OBLxU3DhFiBOh33EeRvi',
    style: 'Brash, wisecracking New Yorker. Asked for: cocky, confident; grinning for the attack lines.',
    units: ['cmdo'],
  },
  flamer: {
    title: 'Flame trooper',
    voice: 'Rob – Tough, Calloused, British',
    voiceId: '2ajXGJNYBR0iNHpS4VZb',
    style: 'Tough, gritty British man. Asked for: gruff, slightly muffled as if through a gas mask; intense for the attack lines.',
    units: ['flamer'],
  },
  navy: {
    title: 'Sea captain',
    voice: 'Arkadius – Old Storyteller',
    voiceId: 'O4uxPTtvgxrA0QCLHI1J',
    style: 'Old Scottish storyteller, deep and raspy. Asked for: gruff old sea captain, commanding; fierce for the attack lines.',
    units: ['otter', 'destroyer', 'cruiser', 'carrier', 'sub'],
  },
  dog: {
    title: 'Attack dog',
    voice: 'No voice: barks',
    voiceId: '',
    style: 'A German shepherd guard dog, made with ElevenLabs sound effects (not text to speech) and cut into single barks.',
    units: ['dog'],
    note: 'No words: the lines below describe the barks.',
  },
  announcer: {
    title: 'Base announcer',
    voice: 'Vector – Tec Voice',
    voiceId: 'NoiYxL9g25M4orC8Q0ls',
    style: 'Crisp, slightly robotic American male voice. Played 10% louder than the units.',
    units: [],
  },
};

export const LINE_WHEN: Record<UnitLine, string> = {
  select: 'You select it (the most common kind in the selection answers).',
  move: 'You send it somewhere.',
  attack: 'You order it to attack.',
  harvest: 'You send it to an ore field.',
  full: 'Its bed is full and it heads home (only if it is selected).',
  repair: 'You send it to repair a building or bridge (sending it to capture one plays a Move line).',
};

export const LINE_TITLE: Record<UnitLine, string> = {
  select: 'Selected',
  move: 'Move',
  attack: 'Attack',
  harvest: 'Harvest',
  full: 'Load full',
  repair: 'Repair',
};

// What each take says, by file name (public/voice/<voice>/<file>.mp3).
// Unit takes: [line][take - 1].
export const LINES: Record<UnitVoice, Partial<Record<UnitLine, string[]>>> = {
  soldier: {
    select: ['Yes sir!', 'Standing by.', 'Ready.', 'Orders?', 'Sir!'],
    move: ['Moving out.', 'On it.', 'Double time!', 'Roger that.', 'Going.'],
    attack: ['Attacking!', 'Open fire!', 'Engaging!', 'Take ’em down!', 'Fire at will!'],
  },
  tank: {
    select: ['Tank ready.', 'Armor standing by.', 'Turret hot.', 'Crew ready.'],
    move: ['Tank rolling.', 'Moving.', 'Rolling out.', 'Treads turning.'],
    attack: ['Engaging!', 'Fire main gun!', 'Target locked.', 'Shell away!'],
  },
  copter: {
    select: ['Copter ready.', 'Rotors hot.', 'Airborne.', 'Pilot here.'],
    move: ['Flying there.', 'Changing course.', 'Heading out.', 'On approach.'],
    attack: ['Target acquired.', 'Going in hot!', 'Strafing run!', 'Rockets away!'],
  },
  scout: {
    select: ['Scout here.', 'Eyes open.', 'What’ve we got?', 'Yeah?'],
    move: ['On my way.', 'Quick and quiet.', 'Scouting ahead.', 'I’ll take a look.'],
    attack: ['Light ’em up!', 'Taking the shot.', 'Hitting them!', 'Here goes nothing.'],
  },
  harvester: {
    select: ['Harvester ready.', 'Yeah, boss?', 'Rig’s runnin’.', 'What d’you need?'],
    move: ['Heading out to harvest.', 'Movin’ on.', 'On my way, boss.', 'Rollin’.'],
    harvest: ['Back to work.', 'Time to dig.', 'Gettin’ the goods.'],
    full: ['Load’s full. Headin’ home.', 'Bringin’ it in.'],
  },
  engineer: {
    select: ['Wrench in hand.', 'What needs fixing?', 'Toolbox is packed.', 'Show me the damage.'],
    move: ['On my way.', 'Hauling the gear.', 'Moving out, boss.', 'Right behind you.'],
    repair: ['I’ll patch it up.', 'Leave it to me.', 'Good as new, coming up!'],
  },
  dog: {
    select: ['(a bark)', '(two barks)'],
    move: ['(a short whine)', '(two barks)'],
    attack: ['(barking)', '(a snarl)'],
  },
  commando: {
    select: ['Talk to me.', 'You rang?', 'Locked and loaded, boss.', 'Who needs a problem solved?'],
    move: ['On my way.', 'Moving quiet.', 'Easy does it.', 'Heading out.'],
    attack: ['Lights out.', 'This’ll be loud.', 'Party time.', 'Nobody walks away.'],
  },
  flamer: {
    select: ['Tanks are full.', 'Ready to burn.', 'Pilot’s lit.', 'Flame trooper.'],
    move: ['Moving out.', 'Stay upwind of me.', 'On the way.', 'Coming through, hot.'],
    attack: ['Light ’em up!', 'Burn it down!', 'Feel the heat!', 'Torch it!'],
  },
  pilot: {
    select: ['Pilot here, go ahead.', 'Engines warm.', 'Ready to fly.', 'Standing by on the pad.'],
    move: ['Vectoring now.', 'Course set.', 'Copy, heading there.', 'On my way.'],
    attack: ['Target in sight.', 'Lining up the run.', 'Weapons free!', 'Going in hot!'],
  },
  navy: {
    select: ['Captain on deck.', 'Helm’s yours.', 'All hands ready.', 'Steady as she goes.'],
    move: ['Making way.', 'Full ahead.', 'Setting a new heading.', 'Aye, aye.'],
    attack: ['Open fire!', 'Bring her about, give ’em a broadside!', 'Fire at will!', 'Send ’em to the bottom!'],
  },
};

export interface AnnounceInfo {
  says: string;
  when: string;
}

// The announcer has one take of each.
export const ANNOUNCEMENTS: Record<Announce, AnnounceInfo> = {
  building: { says: 'Building.', when: 'You start building a building.' },
  training: { says: 'Training.', when: 'You start training a unit.' },
  construction_complete: { says: 'Construction complete.', when: 'A building is ready to place.' },
  unit_ready: { says: 'Unit ready.', when: 'A unit you were making comes out.' },
  insufficient_funds: { says: 'Insufficient funds.', when: 'You try to build something you can’t afford.' },
  low_power: { says: 'Low power.', when: 'Your buildings use more power than your plants make.' },
  power_restored: { says: 'Power restored.', when: 'You have enough power again after running low.' },
  base_under_attack: { says: 'Base under attack.', when: 'One of your buildings is hit.' },
  harvester_under_attack: { says: 'Harvester under attack.', when: 'One of your Ore haulers is hit.' },
  unit_lost: { says: 'Unit lost.', when: 'One of your units is destroyed.' },
  building_lost: { says: 'Building lost.', when: 'One of your buildings is destroyed.' },
  new_options: { says: 'New construction options.', when: 'Something new becomes available in the build menu.' },
  rally_point: { says: 'New rally point established.', when: 'You set a rally point for a Barracks, Vehicle works, Helipad or Naval yard.' },
  para_ready: { says: 'Paratroopers ready.', when: 'The Air command’s paratroopers can be called in.' },
  tech_captured: { says: 'Tech building captured.', when: 'An Engineer captures a tech oil derrick.' },
};

// ---------- Background music ----------

export type MoodId = 'base' | 'battle' | 'shroud';

export interface MusicInfo {
  title: string;
  style: string;
  when: string;
}

// Made with ElevenLabs Music, then cut to loop seamlessly. They crossfade
// over 2.5 seconds when the mood changes.
export const MUSIC: Record<MoodId, MusicInfo> = {
  base: {
    title: 'Base',
    style: 'A military march remix: snare, brass and a steady groove.',
    when: 'Most of the time: nothing is fighting and none of your troops are out exploring. Played at half volume so it stays out of the way.',
  },
  battle: {
    title: 'Battle',
    style: 'Driving industrial battle music: pounding drums and distorted synths.',
    when: 'Your units are hitting or getting hit, and for 12 seconds after the last hit.',
  },
  shroud: {
    title: 'Shroud',
    style: 'Tense, sparse ambient.',
    when: 'Any of your combat units is on the move well away from your base (24 cells from your nearest building, or from the MCU before it deploys), and for 8 seconds after.',
  },
};

// ---------- New options to choose from ----------

// Three new ElevenLabs takes of every sound effect, made from the same
// prompts (Text to Sound v3), trimmed and matched in loudness to the clip the
// game plays now: public/sfx/options/<name>_<1..3>.mp3.
export const SFX_OPTIONS = 3;

export interface VoiceOption {
  slug: string; // file name part: public/voice-options/<voice>/<voice>_select_<slug>.mp3
  voice: string; // the ElevenLabs voice
  voiceId: string;
  style: string;
}

// Three new male voices for some units, each saying that unit's first select
// line (Eleven v4). The game keeps its current voice until one is picked.
export const VOICE_OPTIONS: Partial<Record<UnitVoice, { why?: string; options: VoiceOption[] }>> = {
  commando: {
    options: [
      { slug: 'adam', voice: 'Adam – Brooding, Dark, Tough American', voiceId: 'IRHApOXLvnW57QJPQH2P', style: 'A tough hero weathered by years of experience, mid-low and gritty.' },
      { slug: 'revenant', voice: 'Revenant – RTS Stealth Ghost Soldier', voiceId: 'AocjYzHzWRalprWmBG9m', style: 'Gritty American soldier, sinister and calculating, made for RTS units.' },
      { slug: 'clive', voice: 'Clive – Determined Hero', voiceId: 'dnHIANkC4u76O6OE22jT', style: 'Deep and resonant with a slight rasp; strong and controlled.' },
    ],
  },
  tank: {
    why: 'Asked for: less echo-y than the gas-mask radio voice.',
    options: [
      { slug: 'rolando', voice: 'Rolando', voiceId: '6PBHdlpKVQ70t6tnDUYF', style: 'Strong, authoritative and deep, with a military past; clean studio sound.' },
      { slug: 'rob', voice: 'Rob – Military Podcast Host', voiceId: 'hWhGhek2FTOGZaByvSGa', style: 'Many years in the military; serious but lively, dry and close.' },
      { slug: 'pyle', voice: 'Pyle', voiceId: 'weNdhGmYaizQlfiLlyJq', style: 'Low baritone, plainspoken military veteran, deadpan and dry.' },
    ],
  },
  scout: {
    why: 'Male voices; the current one is female.',
    options: [
      { slug: 'max', voice: 'Max – Deep and Crisp', voiceId: 'ItKJeqCQp9zXEfMJgRLS', style: 'Young American man, confident, clear and a little breathy.' },
      { slug: 'john', voice: 'John Mansfield', voiceId: 'jD9ZLAx3sVOQk9LCF0zD', style: 'Mid-twenties East Coast American, low and no-nonsense.' },
      { slug: 'louie', voice: 'Louie the Legend', voiceId: 'ataV0GNgfIus2NWdTJP0', style: 'Youthful, expressive and animated, warm and confident.' },
    ],
  },
  copter: {
    why: 'Male voices; the current one is female.',
    options: [
      { slug: 'steven', voice: 'Steven Casteel – Hero, Villain, or Narrator', voiceId: 'QEj0heL4nQHjaGrihlr0', style: 'Neutral Pacific Northwest accent, confident hero.' },
      { slug: 'oliver', voice: 'Oliver – Friendly Professional', voiceId: 'snyKKuaGYk1VUEh42zbW', style: 'Warm, laid-back Australian.' },
      { slug: 'chris', voice: 'Chris – Northern UK', voiceId: 'AmY1pcgcEc15wyuIj50p', style: 'British, North Eastern accent (Durham).' },
    ],
  },
  pilot: {
    why: 'Male voices; the current one is female.',
    options: [
      { slug: 'penfist', voice: 'Penfist – Military Broadcaster', voiceId: 'PODaWQBE9fnXYis1ztG8', style: 'Military-trained radio broadcaster, confident.' },
      { slug: 'mark', voice: 'Mark – Friendly, Confident', voiceId: 'v3p1kjzUvro6S76qmYmH', style: 'Midwestern American, friendly and sure of himself.' },
      { slug: 'adam', voice: 'Adam – American Male', voiceId: 'ookcfIYgQDpBT5ueX6gr', style: 'Neutral newscaster American, relaxed.' },
    ],
  },
  navy: {
    why: 'Asked for: not like a pirate.',
    options: [
      { slug: 'severin', voice: 'Severin – Powerful & Commanding', voiceId: 'ib8aaABAPZQpTo6hx8Jr', style: 'Refined British, composed and authoritative.' },
      { slug: 'jeff', voice: 'Jeff Wells', voiceId: 'sK8BRDMixLgM8i4inA71', style: 'Deep, commanding, bold American.' },
      { slug: 'spartan', voice: 'Spartan', voiceId: 'S75jVZ0i3J6Xa5BbK8CE', style: 'Calm, grounded American baritone, measured.' },
    ],
  },
};
