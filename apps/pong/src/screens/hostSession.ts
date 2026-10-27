import { play } from '../audio/sound';
import { inputToPaddle, newGame, step, type GameState, type Side } from '../game/physics';
import type { ControllerMessage, DisplayMessage } from '../net/protocol';
import { updateRoom, watchPlayers, type Phase } from '../net/rooms';
import { DisplayHub } from '../net/rtc';

const COUNTDOWN_S = 3;

export interface HostView {
  phase: Phase | 'countdown';
  slots: (string | null)[];
  connected: boolean[];
  ready: boolean[];
  score: number[];
  winner: number | null;
  countdown: number;
}

// Owns everything the display does: slots, the WebRTC hub, phases and the simulation.
export class HostSession {
  readonly game: GameState = newGame();
  private phase: HostView['phase'] = 'lobby';
  private slots: (string | null)[] = [null, null];
  private connected = [false, false];
  private ready = [false, false];
  private inputs = [0.5, 0.5];
  // Phones with an open link, even before they have a slot.
  private live = new Set<string>();
  private countdown = 0;
  private hub: DisplayHub;
  private stopPlayers: () => void;
  private lastView = '';

  constructor(
    private code: string,
    private onView: (view: HostView) => void,
  ) {
    this.hub = new DisplayHub(code, {
      onConnected: (uid) => this.setConnected(uid, true),
      onDisconnected: (uid) => this.setConnected(uid, false),
      onMessage: (uid, msg) => this.handleMessage(uid, msg),
    });
    this.stopPlayers = watchPlayers(code, (uids) => this.assignSlots(uids));
    this.emit();
  }

  dispose(): void {
    this.stopPlayers();
    this.hub.close();
  }

  update(dt: number): void {
    this.game.paddles[0] = inputToPaddle(this.inputs[0]);
    this.game.paddles[1] = inputToPaddle(this.inputs[1]);

    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (this.countdown <= 0) this.setPhase('playing');
      else if (Math.ceil(this.countdown) !== before) this.emit();
      return;
    }
    if (this.phase !== 'playing') return;

    for (const event of step(this.game, dt)) {
      if (event.type === 'paddle') {
        play('paddle');
        const uid = this.slots[event.side];
        if (uid) this.hub.send(uid, { t: 'hit' });
      } else if (event.type === 'wall') {
        play('wall');
      } else if (event.type === 'score') {
        play('score');
        void updateRoom(this.code, { score: [...this.game.score] }).catch(() => {});
        this.emit();
      } else if (event.type === 'win') {
        this.ready = [false, false];
        this.setPhase('over');
      }
    }
  }

  private slotOf(uid: string): number {
    return this.slots.indexOf(uid);
  }

  // Slots stick to a player; a newcomer can only take an empty slot or one whose phone is gone.
  private assignSlots(uids: string[]): void {
    let changed = false;
    for (const uid of uids) {
      if (this.slots.includes(uid)) continue;
      let slot = this.slots.indexOf(null);
      if (slot === -1 && this.phase !== 'playing' && this.phase !== 'countdown') {
        slot = this.connected.findIndex((c) => !c);
      }
      if (slot === -1) continue;
      this.slots[slot] = uid;
      this.connected[slot] = this.live.has(uid);
      this.ready[slot] = false;
      changed = true;
    }
    if (changed) {
      void updateRoom(this.code, { slots: [...this.slots] }).catch(() => {});
      this.broadcast();
      this.emit();
    }
  }

  private setConnected(uid: string, value: boolean): void {
    if (value) this.live.add(uid);
    else this.live.delete(uid);
    const slot = this.slotOf(uid);
    if (slot === -1) return;
    this.connected[slot] = value;
    if (!value) {
      this.ready[slot] = false;
      if (this.phase === 'playing' || this.phase === 'countdown') this.setPhase('paused');
    } else if (this.phase === 'paused' && this.connected.every(Boolean)) {
      this.startCountdown();
    }
    this.broadcast();
    this.emit();
  }

  private handleMessage(uid: string, msg: ControllerMessage): void {
    const slot = this.slotOf(uid);
    if (slot === -1) return;
    if (msg.t === 'input') {
      if (Number.isFinite(msg.y)) this.inputs[slot] = msg.y;
    } else if (msg.t === 'ready') {
      this.ready[slot] = true;
      const canStart = this.phase === 'lobby' || this.phase === 'over';
      if (canStart && this.ready.every(Boolean) && this.connected.every(Boolean)) {
        if (this.phase === 'over') this.resetGame();
        this.startCountdown();
      }
      this.broadcast();
      this.emit();
    }
  }

  private resetGame(): void {
    const fresh = newGame((this.game.winner === 0 ? 1 : 0) as Side);
    Object.assign(this.game, fresh);
    void updateRoom(this.code, { score: [0, 0] }).catch(() => {});
  }

  private startCountdown(): void {
    this.countdown = COUNTDOWN_S;
    this.setPhase('countdown');
  }

  private setPhase(phase: HostView['phase']): void {
    this.phase = phase;
    if (phase !== 'countdown') void updateRoom(this.code, { phase }).catch(() => {});
    this.broadcast();
    this.emit();
  }

  private broadcast(): void {
    const phase: Phase = this.phase === 'countdown' ? 'playing' : this.phase;
    this.slots.forEach((uid, slot) => {
      if (!uid) return;
      const msg: DisplayMessage = {
        t: 'state',
        phase,
        slot,
        score: [...this.game.score],
        ready: [...this.ready],
        winner: this.game.winner,
      };
      this.hub.send(uid, msg);
    });
  }

  private emit(): void {
    const view: HostView = {
      phase: this.phase,
      slots: [...this.slots],
      connected: [...this.connected],
      ready: [...this.ready],
      score: [...this.game.score],
      winner: this.game.winner,
      countdown: Math.ceil(this.countdown),
    };
    const key = JSON.stringify(view);
    if (key === this.lastView) return;
    this.lastView = key;
    this.onView(view);
  }
}
