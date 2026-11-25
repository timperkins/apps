// The numbers behind the game's sound, in one place with nothing else in it,
// so the Audio page (/audio/) can show them without loading the game's sound
// code (which would fetch every clip and start the music on the first tap).

import type { Loop, Sfx } from './sfx';
import type { Announce, UnitLine, UnitVoice } from './voice';
import type { Mood } from './music';

// How loud each clip is at full volume. The clips were all evened out to the
// same peak; this balances them against each other and the voices.
export const GAIN: Partial<Record<Sfx | Loop, number>> = {
  rifle_shot: 0.35,
  flame_burst: 0.45,
  dog_attack: 0.5,
  dog_yelp: 0.45,
  beam_fire: 0.5,
  beam_charge: 0.3,
  cannon_shot: 0.5,
  howitzer_shot: 0.6,
  rocket_launch: 0.45,
  shell_whistle: 0.25,
  bullet_hit: 0.25,
  explosion_small: 0.5,
  explosion_large: 0.6,
  building_collapse: 0.7,
  debris: 0.3,
  infantry_death: 0.35,
  build_rise: 0.45,
  build_place: 0.6,
  foundry_unfold: 0.5,
  unit_exit: 0.4,
  ore_unload: 0.35,
  ui_click: 0.35,
  ui_panel: 0.3,
  credits_tick: 0.15,
  ui_error: 0.4,
  order_confirm: 0.35,
  ui_ready: 0.35,
  whoosh_space: 0.45,
  tracks_loop: 0.35,
  engine_loop: 0.3,
  rotor_loop: 0.35,
  boat_loop: 0.3,
  footsteps: 0.3,
  ore_dig: 0.3,
  surf_loop: 0.3,
  fire_loop: 0.5,
};

// How many takes there are of each unit line (public/voice/<voice>/<voice>_<line>_<n>.mp3).
export const UNIT_CLIPS: Record<UnitVoice, Partial<Record<UnitLine, number>>> = {
  soldier: { select: 5, move: 5, attack: 5 },
  tank: { select: 4, move: 4, attack: 4 },
  copter: { select: 4, move: 4, attack: 4 },
  scout: { select: 4, move: 4, attack: 4 },
  harvester: { select: 4, move: 4, harvest: 3, full: 2 },
  engineer: { select: 4, move: 4, repair: 3 },
  dog: { select: 2, move: 2, attack: 2 },
  commando: { select: 4, move: 4, attack: 4 },
  flamer: { select: 4, move: 4, attack: 4 },
  pilot: { select: 4, move: 4, attack: 4 },
  navy: { select: 4, move: 4, attack: 4 },
};

// Every announcement (one take each).
export const ANNOUNCE: Announce[] = [
  'building',
  'training',
  'construction_complete',
  'unit_ready',
  'insufficient_funds',
  'low_power',
  'power_restored',
  'base_under_attack',
  'harvester_under_attack',
  'unit_lost',
  'building_lost',
  'new_options',
  'rally_point',
  'para_ready',
  'tech_captured',
];

// The least time between two of the same announcement, in seconds: alerts
// that can fire every frame of a fight are kept to one now and then.
export const ANNOUNCE_GAP: Partial<Record<Announce, number>> = {
  insufficient_funds: 10,
  base_under_attack: 25,
  harvester_under_attack: 25,
  unit_lost: 8,
  building_lost: 4,
  low_power: 10,
  new_options: 6,
  rally_point: 3,
};

// How loud each music loop plays (src/music.ts).
export const MUSIC_VOLUME: Record<Mood, number> = { battle: 1, shroud: 1, base: 0.5 };
