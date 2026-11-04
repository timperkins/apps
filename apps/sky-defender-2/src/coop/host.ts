// The host screen's side of co-op: the room phones join by QR code, the players and their
// roles, and passing each phone's buttons to the game.
import { openRoom, type HostRoom, type Link } from './net';
import { PROTOCOL, type ClientMsg, type HostMsg, type LobbyPlayer, type Role } from './protocol';
import { cleanName, randomName } from './names';

/** This device's own player, when the host joins in. */
export const LOCAL = 'local';
export const MAX_PLAYERS = 3;
const ROLES: Role[] = ['base', 'bomber', 'sniper'];

export interface Player { id: string; name: string; role: Role | null; link: Link | null; }

export interface HostEvents {
  /** the lobby changed: someone joined, left, renamed or got a role */
  change(): void;
  /** a message from a phone that is playing */
  input(p: Player, msg: ClientMsg): void;
  /** a phone that was playing dropped out */
  lost(p: Player): void;
}

export class CoopHost {
  room: HostRoom | null = null;
  players: Player[] = [];
  playing = false;
  error = '';
  private closed = false;

  constructor(private ev: HostEvents) { }

  async open() {
    try {
      const room = await openRoom();
      if (this.closed) { room.close(); return; }
      this.room = room;
      room.onLink(link => this.accept(link));
    } catch (err) {
      this.error = (err as Error).message || 'Could not open the room';
    }
    this.ev.change();
  }
  close() {
    this.closed = true;
    for (const p of this.players) p.link?.close();
    this.room?.close();
    this.players = [];
  }

  get local() { return this.players.find(p => p.id === LOCAL) ?? null; }
  joinLocal(name: string) {
    if (this.local || this.players.length >= MAX_PLAYERS) return;
    this.players.push({ id: LOCAL, name, role: null, link: null });
    this.autoRoles();
    this.changed();
  }
  leaveLocal() { this.players = this.players.filter(p => p.id !== LOCAL); this.changed(); }
  renameLocal() {
    const me = this.local;
    if (!me) return '';
    me.name = randomName(me.name);
    this.changed();
    return me.name;
  }
  /** The host picks a role for a player; whoever had that role swaps to the player's old one. */
  setRole(id: string, role: Role) {
    const p = this.players.find(q => q.id === id);
    if (!p || p.role === role) return;
    const other = this.players.find(q => q !== p && q.role === role);
    if (other) other.role = p.role ?? ROLES.find(r => !this.players.some(q => q.role === r)) ?? null;
    p.role = role;
    this.changed();
  }
  byRole(role: Role) { return this.players.find(p => p.role === role) ?? null; }
  /** A Base and a Bomber are needed; a Sniper is a third player if there is one. */
  canStart() { return !!this.byRole('base') && !!this.byRole('bomber') && this.players.every(p => p.role && (p.id === LOCAL || p.link)); }

  send(p: Player | null, msg: HostMsg) { p?.link?.send(msg); }
  broadcast(msg: HostMsg) { for (const p of this.players) p.link?.send(msg); }
  start() {
    this.playing = true;
    for (const p of this.players) if (p.role) this.send(p, { t: 'start', role: p.role });
  }
  stop() { this.playing = false; this.changed(); }

  /** Fills in roles nobody has picked, in order: Base, then Bomber, then Sniper. */
  private autoRoles() {
    for (const p of this.players) if (!p.role) p.role = ROLES.find(r => !this.players.some(q => q.role === r)) ?? null;
  }
  private changed() {
    const list: LobbyPlayer[] = this.players.map(p => ({ id: p.id, name: p.name, role: p.role, here: p.id === LOCAL || !!p.link }));
    for (const p of this.players) p.link?.send({ t: 'lobby', you: p.id, players: list, playing: this.playing } satisfies HostMsg);
    this.ev.change();
  }

  private accept(link: Link) {
    let me: Player | null = null;
    link.onMessage(raw => {
      const msg = raw as ClientMsg;
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        if (msg.v !== PROTOCOL) { link.send({ t: 'old' } satisfies HostMsg); return; }
        const id = String(msg.id).slice(0, 40);
        // a phone coming back (same id) takes its old place, role and all
        const back = this.players.find(p => p.id === id && id !== LOCAL);
        if (back) { back.link?.close(); back.link = link; back.name = cleanName(msg.name); me = back; }
        else {
          if (this.players.length >= MAX_PLAYERS || this.playing) { link.send({ t: 'full' } satisfies HostMsg); return; }
          me = { id, name: cleanName(msg.name), role: null, link };
          this.players.push(me);
          this.autoRoles();
        }
        this.changed();
        if (this.playing && me.role) this.send(me, { t: 'start', role: me.role });
        return;
      }
      if (!me || me.link !== link) return;
      if (msg.t === 'name') { me.name = cleanName(msg.name); this.changed(); return; }
      if (this.playing) this.ev.input(me, msg);
    });
    link.onClose(() => {
      if (!me || me.link !== link) return;
      me.link = null;
      // in the lobby a phone that leaves gives up its place; during a game it may come back
      if (this.playing) this.ev.lost(me);
      else this.players = this.players.filter(p => p !== me);
      this.changed();
    });
  }
}
