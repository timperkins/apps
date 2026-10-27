import { PLAYER_COLORS, TANK_DESIGNS, type TankDesign } from '../core/config';
import { ITEM_ORDER, WEAPON_ORDER, type Inventory, type ShopId, type WeaponId } from '../core/weapons';

/** Bumped whenever messages change shape, so an old phone page is told to reload. */
export const PROTOCOL_VERSION = 3;

export const NAME_MAX = 12;

// ---- Phone -> host -----------------------------------------------------------------

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; token: string | null }
  | { t: 'look'; color: string; design: TankDesign }
  | { t: 'aim'; angle: number; power: number }
  | { t: 'weapon'; dir: 1 | -1 }
  | { t: 'fire' }
  | { t: 'move'; dir: 1 | -1 }
  /** Held steering while parachuting; 0 when let go. */
  | { t: 'steer'; dir: 1 | 0 | -1 }
  | { t: 'repair' }
  | { t: 'powerCell' }
  | { t: 'draw'; agree: boolean }
  | { t: 'buy'; item: ShopId }
  | { t: 'sell'; item: ShopId }
  | { t: 'ready'; ready: boolean };

// ---- Host -> phone -----------------------------------------------------------------

export interface LobbyPlayer {
  name: string;
  color: string;
  design: TankDesign;
  cpu: boolean;
  you: boolean;
}

export interface ShopState {
  round: number;
  rounds: number;
  coins: number;
  inventory: Inventory;
  ready: boolean;
}

export interface BattleStatus {
  alive: boolean;
  health: number;
  shield: number;
  angle: number;
  power: number;
  maxPower: number;
  weapon: WeaponId;
  /** Shots left of the selected weapon; -1 for unlimited. */
  ammo: number;
  repairKits: number;
  /** Repair kits do nothing at full health. */
  fullHealth: boolean;
  powerCells: number;
  coins: number;
  /** Seconds of reload left, out of reloadTotal. */
  reload: number;
  reloadTotal: number;
  /** The tank is driving; it can't fire or move until it's done. */
  moving: boolean;
  /** The tank is up in the air after a Torpedo; it can't fire or move until it lands. */
  flying: boolean;
  /** It is drifting down under a parachute, so the move buttons steer. */
  parachuting: boolean;
  wind: number;
  drawOpen: boolean;
  drawVoted: boolean;
  drawVotes: number;
  drawNeeded: number;
}

export interface RoundResult {
  round: number;
  rounds: number;
  winner: string | null;
  youWon: boolean;
  damage: number;
  kills: number;
  earned: number;
  coins: number;
  final: boolean;
  /** 1-based place in the standings. */
  place: number;
}

export type Phase =
  | { phase: 'lobby'; players: LobbyPlayer[]; taken: string[] }
  | { phase: 'shop'; shop: ShopState }
  | { phase: 'battle'; round: number; rounds: number }
  | { phase: 'results'; result: RoundResult };

export type HostMsg =
  | { t: 'welcome'; token: string; color: string; design: TankDesign }
  | { t: 'reject'; reason: string }
  | ({ t: 'phase' } & Phase)
  | ({ t: 'status' } & BattleStatus)
  | { t: 'event'; kind: 'fired' | 'hit' | 'destroyed' | 'roundOver' };

// ---- Validation --------------------------------------------------------------------

const SHOP_IDS = new Set<string>([...WEAPON_ORDER.filter((w) => w !== 'babyMissile'), ...ITEM_ORDER]);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Strips control characters and trims a player name to something safe to show. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, NAME_MAX);
}

/**
 * Checks a message from a phone. Anything malformed comes back as null, so a bad or
 * hostile client can never reach the game rules with unexpected values.
 */
export function parseClientMsg(data: unknown): ClientMsg | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      if (!finite(m.v) || typeof m.name !== 'string') return null;
      if (m.token !== null && (typeof m.token !== 'string' || m.token.length > 64)) return null;
      return { t: 'hello', v: m.v, name: cleanName(m.name), token: m.token as string | null };
    case 'look':
      if (typeof m.color !== 'string' || !PLAYER_COLORS.includes(m.color)) return null;
      if (typeof m.design !== 'string' || !TANK_DESIGNS.includes(m.design as TankDesign)) return null;
      return { t: 'look', color: m.color, design: m.design as TankDesign };
    case 'aim':
      if (!finite(m.angle) || !finite(m.power)) return null;
      return { t: 'aim', angle: m.angle, power: m.power };
    case 'weapon':
    case 'move':
      return m.dir === 1 || m.dir === -1 ? { t: m.t, dir: m.dir } : null;
    case 'steer':
      return m.dir === 1 || m.dir === 0 || m.dir === -1 ? { t: 'steer', dir: m.dir } : null;
    case 'fire':
    case 'repair':
    case 'powerCell':
      return { t: m.t };
    case 'draw':
      return typeof m.agree === 'boolean' ? { t: 'draw', agree: m.agree } : null;
    case 'buy':
    case 'sell':
      return typeof m.item === 'string' && SHOP_IDS.has(m.item) ? { t: m.t, item: m.item as ShopId } : null;
    case 'ready':
      return typeof m.ready === 'boolean' ? { t: 'ready', ready: m.ready } : null;
    default:
      return null;
  }
}

/** Room codes avoid letters that are easy to confuse (O/0, I/1, etc). */
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

export function randomRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  return code;
}

export function normalizeRoomCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return null;
  return code;
}
