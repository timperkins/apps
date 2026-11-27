// What every mini game in 2p Games gets when a match starts: who's playing, and a way to talk.
export type Mode = 'factory' | 'knights';

export interface Player {
  slot: number; // 0 is the host; 1–7 friends; bots use 8 and up
  name: string;
  team: number; // knights: 0 blue, 1 red
  bot: boolean;
}

export interface Match {
  mode: Mode;
  me: number;
  host: boolean;
  /** Playing alone, with no one connected (bots only). */
  solo: boolean;
  players: Player[];
  seed: number;
  /** Friend → host. */
  send(msg: unknown): void;
  /** Host → one friend. */
  sendTo(slot: number, msg: unknown): void;
  /** Host → every friend. */
  broadcast(msg: unknown): void;
  /** On the host, `from` is the friend's slot; on a friend it is always 0. */
  onMsg(cb: (from: number, msg: any) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Host only: someone joined after the start. */
  onJoin(cb: (p: Player) => void): void;
  /** Host: a friend left. Friend: the host closed the game (slot 0). */
  onLeave(cb: (slot: number) => void): void;
  /** Back to the 2p Games menu. */
  quit(): void;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const fmt = (n: number) => n < 100 && n % 1 > 0.05 ? n.toFixed(1) : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : `${Math.floor(n)}`;
