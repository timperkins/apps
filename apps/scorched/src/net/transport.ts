/**
 * The network seam. The game only sees these interfaces, so the signaling service behind
 * them (PeerJS today) can be swapped without touching anything else.
 */

/** One open, reliable, ordered link between the host and one phone. */
export interface Link {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/** The host side: owns a room code and accepts phones. */
export interface HostTransport {
  readonly room: string;
  onLink(cb: (link: Link) => void): void;
  close(): void;
}

/** Opens a room under a fresh code. Rejects if the signaling service can't be reached. */
export type OpenRoom = () => Promise<HostTransport>;

/** Connects a phone to the room with the given code. */
export type JoinRoom = (room: string) => Promise<Link>;
