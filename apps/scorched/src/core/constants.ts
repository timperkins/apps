export const WORLD_W = 640;
export const WORLD_H = 360;

/** Fixed simulation step, in seconds. */
export const STEP = 1 / 60;

export const TANK_HALF_W = 7;
export const TANK_H = 6;
export const BARREL_LEN = 10;
export const MAX_HEALTH = 100;
export const MAX_POWER = 1000;

/** Converts the 0-1000 power setting into launch speed (px/s). */
export const POWER_TO_SPEED = 0.52;

/** Horizontal acceleration (px/s^2) per unit of wind. */
export const WIND_ACCEL = 4;

/** Projectiles alive longer than this (seconds) are removed. */
export const MAX_FLIGHT_TIME = 25;

/** Fall distance (px) a tank can drop without taking damage. */
export const SAFE_FALL = 6;
export const FALL_DAMAGE_PER_PX = 1;

export const SHIELD_STRENGTH = 60;
export const REPAIR_AMOUNT = 30;

/** Economy. */
export const COINS_PER_DAMAGE = 20;
export const KILL_BONUS = 1500;
export const WIN_BONUS = 3000;
export const SELL_RATE = 0.5;
export const SCORE_PER_KILL = 1;
export const SCORE_PER_WIN = 2;

/** Seconds a tank waits after firing or repairing before it can again. */
export const RELOAD_TIME = 5;

/** A move drives the tank this far (5% of the screen) over MOVE_TIME seconds, and uses up its turn meanwhile. */
export const MOVE_DISTANCE = Math.round(WORLD_W * 0.05);
export const MOVE_TIME = 5;
/** Steepest climb a moving tank can manage, in pixels up per pixel across. */
export const MAX_CLIMB = 2;

/** Seconds with no tank hit before players may vote for a draw. */
export const DRAW_VOTE_AFTER = 60;

/** Seconds between wind shifts when wind is set to change during a round. */
export const WIND_SHIFT_INTERVAL = 10;

/** Planes take this many seconds to cross the screen. */
export const PLANE_CROSS_TIME = 20;
export const PLANE_HALF_W = 9;
export const PLANE_HALF_H = 3;
/** Damage at the center of a crashing plane's blast, which is as wide as a Baby Nuke's. */
export const PLANE_CRASH_DAMAGE = 40;
/** Range of the cash paid for shooting down a plane. */
export const PLANE_REWARD_MIN = 1500;
export const PLANE_REWARD_MAX = 4000;

/**
 * A Torpedo rockets its own tank up to the top of the screen whatever the power, speeding up
 * by TORPEDO_THRUST px/s^2 to at most TORPEDO_MAX_SPEED, and drifting sideways at up to
 * TORPEDO_DRIFT px/s the way it was aimed.
 */
export const TORPEDO_THRUST = 300;
export const TORPEDO_MAX_SPEED = 240;
export const TORPEDO_DRIFT = 70;
/** Turns per second a tank tumbles once its parachute is shot away. */
export const TUMBLE_SPIN = 0.75;
/** A parachuting tank drifts down this fast (px/s) and steers sideways at most this fast. */
export const CHUTE_FALL_SPEED = 11;
export const CHUTE_STEER_SPEED = 14;
/** The canopy above a parachuting tank, as rows above its treads, and its half width. */
export const CHUTE_TOP = 22;
export const CHUTE_BOTTOM = 17;
export const CHUTE_HALF_W = 8;
