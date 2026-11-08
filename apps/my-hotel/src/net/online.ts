// Playing on two devices. The host's device runs the hotel; the device that joins is player 2.
// Each device moves its own player and the host sends the whole hotel back ten times a second.
import { CONNECT_TIMEOUT_MS, HostHub, connectToHost, type GuestLink } from './rtc';
import { createRoom, joinRoom } from './rooms';
import { ensureUser } from './firebase';
import { setTwoPlayer, type Hotel, type Player } from '../sim/hotel';
import type { GuestMessage, HostMessage } from './protocol';

const SEND_EVERY_MS = 100;
const MAX_BUFFERED = 512 * 1024; // skip a snapshot rather than queue them up on a slow link

/** The address a second device opens to join, also shown as a QR code. */
export function joinUrl(code: string): string {
  return `${location.origin}${location.pathname}?join=${code}`;
}

export interface HostEvents {
  onJoined(): void;
  onLeft(): void;
}

export class OnlineHost {
  code: string | null = null;
  private hub: HostHub | null = null;
  private guest: string | null = null;
  private remote: GuestMessage | null = null;
  private lastSent = 0;

  constructor(
    private hotel: () => Hotel,
    private events: HostEvents,
  ) {}

  get connected() {
    return this.guest !== null;
  }

  /** Make a room and wait for a device to join it. Safe to call again. */
  async open(): Promise<string> {
    if (this.code) return this.code;
    const user = await ensureUser();
    const code = await createRoom(user.uid);
    this.code = code;
    this.hub = new HostHub(code, {
      onConnected: (uid) => {
        if (this.guest && this.guest !== uid) return; // one friend at a time
        this.guest = uid;
        setTwoPlayer(this.hotel(), true);
        this.events.onJoined();
        this.sendNow();
      },
      onDisconnected: (uid) => {
        if (uid !== this.guest) return;
        this.guest = null;
        this.remote = null;
        setTwoPlayer(this.hotel(), false);
        this.events.onLeft();
      },
      onMessage: (uid, msg) => {
        if (uid === this.guest && msg.t === 'me') this.remote = msg;
      },
    });
    return code;
  }

  /** Put player 2 where the other device says they are. Call before and after each tick. */
  applyRemote() {
    const p2 = this.hotel().player2;
    if (!p2 || !this.remote) return;
    p2.pos = { ...this.remote.pos };
    p2.heading = this.remote.heading;
    p2.moving = this.remote.moving;
  }

  /** Send the hotel to the other device if it's time. */
  update(now: number) {
    if (!this.guest || now - this.lastSent < SEND_EVERY_MS) return;
    this.sendNow(now);
  }

  private sendNow(now = performance.now()) {
    if (!this.hub || !this.guest || this.hub.buffered(this.guest) > MAX_BUFFERED) return;
    this.lastSent = now;
    this.hub.send(this.guest, { t: 'state', hotel: this.hotel() });
  }

  close() {
    if (this.hub && this.guest) this.hub.send(this.guest, { t: 'bye' });
    this.hub?.close();
    this.hub = null;
    this.code = null;
    this.guest = null;
  }
}

export interface Guest {
  /** Tell the host where player 2 is. */
  sendMe(p: Player): void;
  close(): void;
}

/** Join a host by room code. Resolves once the link is open; states arrive through onState. */
export async function joinOnline(code: string, onState: (h: Hotel) => void, onClosed: () => void): Promise<Guest> {
  const user = await ensureUser();
  await joinRoom(code, user.uid);
  let link: GuestLink | null = null;
  let lastSent = 0;
  const onMessage = (msg: HostMessage) => {
    if (msg.t === 'state') onState(msg.hotel);
    if (msg.t === 'bye') {
      link?.close();
      onClosed();
    }
  };
  link = await connectToHost(code, user.uid, onMessage, onClosed);
  return {
    sendMe(p) {
      const now = performance.now();
      if (now - lastSent < 50) return;
      lastSent = now;
      link?.sendInput({ t: 'me', pos: p.pos, heading: p.heading, moving: p.moving });
    },
    close() {
      link?.close();
    },
  };
}

export { CONNECT_TIMEOUT_MS };
