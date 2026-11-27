export const ROOM_CODE_LENGTH = 4;
export const NAME_MAX_LENGTH = 12;
export const MAX_NUM_PLAYERS = 8;
export const QUESTION_MAX_LENGTH = 200;

/** Players write a heartbeat this often while the game is open. */
export const HEARTBEAT_INTERVAL_MS = 8_000;
/** A player whose last heartbeat is older than this counts as gone. */
export const PLAYER_ACTIVE_TIMEOUT_MS = 25_000;
/** Game documents are deleted (Firestore TTL on `expiresAt`) this long after they are created. */
export const GAME_TTL_MS = 24 * 60 * 60 * 1000;
