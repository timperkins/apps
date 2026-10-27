// Logical playfield, in pixels. The canvas is drawn at this size and scaled up.
export const FIELD_W = 320;
export const FIELD_H = 240;

export const PADDLE_W = 4;
export const PADDLE_H = 28;
export const PADDLE_INSET = 16;

export const BALL_SIZE = 4;
export const BALL_START_SPEED = 150;
export const BALL_SPEEDUP = 1.07;
export const BALL_MAX_SPEED = 420;
// Steepest bounce off the paddle's edge, in radians.
export const MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;
// Like the original cabinet, the paddle face is split into 8 zones.
export const PADDLE_ZONES = 8;

export const STEP = 1 / 60;
export const SERVE_DELAY = 1;
export const WIN_SCORE = 11;
