// Messages between the host (who runs the hotel) and the device that joined (player 2).
import type { Hotel } from '../sim/hotel';
import type { Point } from '../sim/path';

/** Joined device to host, many times a second over the unreliable channel. */
export type GuestMessage = { t: 'me'; pos: Point; heading: number; moving: boolean };

/** Host to joined device, over the reliable channel. */
export type HostMessage = { t: 'state'; hotel: Hotel } | { t: 'bye' };

export const INPUT_CHANNEL = 'input';
export const CONTROL_CHANNEL = 'control';
