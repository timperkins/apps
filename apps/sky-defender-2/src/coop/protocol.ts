// Messages between the host screen and the phones in co-op.
import type { BomberAct, BomberView, UpgradeId } from '../game';
import type { Snap } from './mirror';

/** Bumped whenever messages change shape, so an old phone page is told to reload. */
export const PROTOCOL = 4;
export type Role = 'base' | 'bomber' | 'sniper';

/** Phone to host. */
export type ClientMsg =
  | { t: 'hello'; v: number; id: string; name: string }
  | { t: 'name'; name: string }
  /** Base: the phone's aim (already calibrated and smoothed on the phone), and the fire button */
  | { t: 'tilt'; r: number }
  | { t: 'fire'; on: boolean }
  | { t: 'open' }
  /** Base or Bomber: Protection */
  | { t: 'protect' }
  /** Sniper: point the laser at this world point */
  | { t: 'snipe'; x: number; y: number }
  | { t: 'pick'; id: UpgradeId | null }
  /** Bomber: up and down are held; everything else is a tap */
  | { t: 'hold'; dir: 'up' | 'down'; on: boolean }
  | { t: 'act'; a: BomberAct };

export interface LobbyPlayer { id: string; name: string; role: Role | null; here: boolean; }
export interface CardInfo { id: UpgradeId; name: string; kind: string; desc: string; color: string; }

/** Host to phone. */
export type HostMsg =
  | { t: 'lobby'; you: string; players: LobbyPlayer[]; playing: boolean }
  | { t: 'full' }
  | { t: 'old' }
  | { t: 'start'; role: Role }
  | { t: 'bomber'; v: BomberView }
  | { t: 'base'; crate: boolean; weapon: string | null; score: number; wave: number; protect: number; protectT: number }
  | { t: 'sniper'; ready: boolean; damage: number; canGrab: boolean; arming: boolean; perk: string | null; perkDesc: string; status: string }
  | { t: 'cards'; title: string; cards: CardInfo[] }
  | { t: 'paused'; on: boolean }
  /** the map, about 20 times a second */
  | { t: 'snap'; s: Snap }
  | { t: 'over'; title: string; score: number; wave: number };
