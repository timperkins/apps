/** Each player asks this many questions in a game, up to MAX_ROUNDS in total. */
export const NUM_ROUNDS_PER_ACTIVE_PLAYER = 2;
export const MAX_ROUNDS = 8;

/** Countdown between the last guess and the answer being shown. */
export const REVEAL_DELAY_MS = 3_000;

/** Points for guessing the right direction. */
export const POINTS_CORRECT_GUESS = 10;
/** Bonus for the answerer when their answer is within CLOSE_ANSWER_RATIO of the correct answer. */
export const POINTS_CLOSE_ANSWER = 10;
/** Bonus for the answerer when their answer is exactly right. */
export const POINTS_EXACT_ANSWER = 20;
export const CLOSE_ANSWER_RATIO = 0.1;
