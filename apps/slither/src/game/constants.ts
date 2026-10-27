// The arena is a fixed 16:9 world drawn to fit the screen. Its edges wrap.
export const WORLD_W = 1600;
export const WORLD_H = 900;
export const STEP = 1 / 60;

export const MAX_SNAKES = 10;

// Mass is the score. Size, length and turning all follow from it.
export const MIN_MASS = 10;
export const START_MASS = 12;
export const SPEED = 150;
export const BOOST_SPEED = 300;
// Mass per second spent while boosting; most of it drops behind as food.
export const BOOST_COST = 3;
export const BOOST_DROP_SHARE = 0.75;
export const BOOST_DROP_EVERY_S = 0.2;
export const TURN_RATE = 3.4;
// Distance between stored body points.
export const SPACING = 5;

export const RESPAWN_S = 3;
export const PROTECT_S = 2;
// Share of a dead snake's mass that turns into food.
export const DEATH_DROP_SHARE = 0.8;

export const FOOD_TARGET = 260;
export const FOOD_MAX = 1200;
// Food within this distance of a head drifts into its mouth.
export const MAGNET = 36;

export function radiusFor(mass: number): number {
  return 6 + 2.2 * Math.sqrt(mass / 10);
}

export function lengthFor(mass: number): number {
  return 40 + mass * 2.4;
}

export function turnRateFor(radius: number): number {
  return TURN_RATE * Math.sqrt(radiusFor(MIN_MASS) / radius);
}
