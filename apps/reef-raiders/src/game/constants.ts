// All tuning lives here so playtests only touch one file. Units are game pixels (the scene is 640x360)
// and seconds.
export const STEP = 1 / 60;

export const SCENE_W = 640;
export const SCENE_H = 360;
// The waterline. Boats float on it; everything below is the ocean.
export const SURF = 88;
// The seabed (top of the sand) is about here; fish stay above it.
export const SEABED = 322;
// Fish can ram a boat from this band just under the surface.
export const SURFACE_BAND = 22;

export const MAX_RAIDERS = 4;
export const MAX_SWIMMERS = 8;
export const MAX_PLAYERS = MAX_RAIDERS + MAX_SWIMMERS;

export const ROUND_S = 180;
export const COUNTDOWN_S = 3;

// ---- Swimmers ----
export const FISH_SPEED = 78;
export const FISH_ACCEL = 6;
export const DASH_MULT = 2.3;
export const DASH_S = 0.35;
export const DASH_COOLDOWN_S = 3;
export const RESPAWN_S = 3;
export const SPAWN_SAFE_S = 2;
// You must be this much bigger (by length) to eat another fish.
export const EAT_RATIO = 1.25;
export const MAX_LEVEL = 30;
// Food needed to go from level n to n+1.
export const foodToLevel = (level: number) => 3 + level * 2;
// Body length in pixels for a level. Grows a little each level, capped around a boat's size.
export const fishLength = (level: number) => Math.min(64, 12 + level * 3.2);
// Bigger fish are a bit slower: never below 60% speed.
export const speedForLevel = (level: number) => Math.max(0.6, 1 - (level - 1) * 0.035);
// Seconds alive between survival coins.
export const SURVIVE_COIN_S = 10;

export const TAUNT_S = 3;
export const TAUNT_COOLDOWN_S = 8;
export const TAUNT_LINE = "You can't catch me, I'm the gingerbread man!";

export const EGG_COOLDOWN_S = 25;
export const EGG_HATCH_S = 10;
export const BABIES_PER_EGG = 2;
// Babies stay until they are caught; a parent can have at most this many.
export const MAX_BABIES = 6;
// Babies join in on a boat their parent rammed within this many seconds.
export const BABY_ATTACK_S = 4;
export const BABY_RAM_DAMAGE = 2;

// ---- Computer fish ----
export const NPC_TARGET = 26;
export const NPC_MIN = 12;
export const NPC_PER_PLAYER = 1.5;
export const NPC_RESPAWN_S = 2.5;
// Chance per second that a computer fish near a hook goes for it.
export const NPC_BITE_CHANCE = 0.55;

// ---- Raiders ----
export const BOAT_SPEED = 95;
export const BOAT_ACCEL = 4;
export const BOAT_HOOK_DOWN_MULT = 0.5;
export const BOAT_MIN_X = 54;
export const BOAT_MAX_X = SCENE_W - 54;
// Boats bump off each other closer than this (centers).
export const BOAT_GAP = 92;
export const BOAT_HALF_W = 40;
export const BOAT_HEALTH = 100;
export const BOAT_RESPAWN_S = 8;
export const RAM_COOLDOWN_S = 1;
export const ramDamage = (level: number) => 6 + level * 1.2;
export const SINK_SCORE = 50;
export const SINK_FOOD = 6;
export const ASSIST_FOOD = 2;
export const ASSIST_S = 10;

// Where the rod tip sits relative to the boat center (facing right).
export const ROD_DX = 47;
export const ROD_DY = -32;
export const HOOK_SINK = 70;
export const HOOK_REEL = 95;
export const HOOK_FOLLOW = 3;
export const HOOK_RADIUS = 5;
// The hook can't catch anything in the top this-many pixels of water.
export const HOOK_BITE_DEPTH = 40;
export const LINE_DEEP = SEABED - 4;

// ---- Tug-of-war ----
export const KNOT_START = 40;
export const KNOT_LANDED = 100;
export const REEL_TAP = 3;
export const HEAVE_TAP = 8;
export const RATCHET_PER_S = 4;
export const PULL_TAP = 3;
export const THRASH = 14;
// Computer fish pull steadily: per second, before the size factor.
export const NPC_PULL_PER_S = 10;
// 1.0 for the smallest fish up to 1.4 for the biggest.
export const sizeFactor = (level: number) => 1 + Math.min(0.4, (level - 1) * 0.04);
// Taps faster than this per second are ignored.
export const MAX_TAPS_PER_S = 12;
export const ESCAPE_SAFE_S = 1.5;

// ---- Rewards ----
export const CATCH_SCORE = 20;
export const MEAT_CHANCE = 0.4;
export const MEAT_PRICE = 15;
export const EAT_SCORE = 10;
export const EAT_PLAYER_SCORE = 25;
export const COIN_SCORE = 5;
export const COINS_MAX = 8;
export const COIN_EVERY_S = 2.2;

// ---- Gristle Pete ----
export const PETE_FIRST_S = 25;
export const PETE_EVERY_MIN_S = 30;
export const PETE_EVERY_MAX_S = 45;
export const PETE_STAY_S = 8;
export const PETE_LINE = 'Hot diggity dog, do you have any meat?';

// ---- Heave ring on the Raider's phone ----
// A gold ring closes every HEAVE_EVERY_S after the bite; a tap within HEAVE_WINDOW_S of it is a Heave.
export const HEAVE_EVERY_S = 1.2;
export const HEAVE_WINDOW_S = 0.2;
