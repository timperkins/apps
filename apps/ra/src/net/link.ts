// The connections between the host and each player: one WebRTC data channel
// each way, reliable and in order, carrying JSON messages. The host is the
// hub (everyone connects to it), which is plenty for eight on one network.
import type { RtcSignal, SessionDescription, Signaling } from './signal';

// Free public STUN; on the same network the devices find each other directly.
const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const ICE_GATHER_MS = 2500;
const CONNECT_MS = 15000;
// Big messages (the host's updates in a big game) go in pieces this long.
const PIECE = 15000;

// Wait for ICE gathering, so the whole offer or answer goes in one write.
function gatherIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, ICE_GATHER_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

const describe = (pc: RTCPeerConnection): SessionDescription => ({ type: pc.localDescription!.type, sdp: pc.localDescription!.sdp });

// Sends and receives whole messages over a channel, in pieces when big.
class Wire {
  private parts: string[] = [];
  constructor(
    readonly ch: RTCDataChannel,
    onMessage: (msg: unknown) => void,
  ) {
    ch.onmessage = (e) => {
      const s = e.data as string;
      if (s[0] === '~') {
        // a piece: ~<last ? 1 : 0><data>
        this.parts.push(s.slice(2));
        if (s[1] === '1') {
          const whole = this.parts.join('');
          this.parts = [];
          onMessage(JSON.parse(whole));
        }
        return;
      }
      onMessage(JSON.parse(s));
    };
  }
  send(msg: unknown): void {
    if (this.ch.readyState !== 'open') return;
    const s = JSON.stringify(msg);
    if (s.length <= PIECE) {
      this.ch.send(s);
      return;
    }
    for (let i = 0; i < s.length; i += PIECE) this.ch.send(`~${i + PIECE >= s.length ? 1 : 0}${s.slice(i, i + PIECE)}`);
  }
  /** Bytes waiting to go out (to skip an update when a player falls behind). */
  get backlog(): number {
    return this.ch.bufferedAmount;
  }
}

export interface HubEvents {
  onOpen(uid: string): void;
  onClose(uid: string): void;
  onMessage(uid: string, msg: unknown): void;
}

interface Peer {
  session: string;
  pc: RTCPeerConnection;
  wire?: Wire;
}

/** The host's side: answers every player's offer and routes their messages. */
export class Hub {
  private peers = new Map<string, Peer>();
  private stop: () => void;

  constructor(
    private sig: Signaling,
    private code: string,
    private ev: HubEvents,
  ) {
    this.stop = sig.watchOffers(code, (uid, s) => {
      if (this.peers.get(uid)?.session === s.session) return;
      void this.answer(uid, s);
    });
  }

  send(uid: string, msg: unknown): void {
    this.peers.get(uid)?.wire?.send(msg);
  }
  broadcast(msg: unknown, skipBusy = false): void {
    for (const p of this.peers.values()) if (p.wire && !(skipBusy && p.wire.backlog > 1 << 20)) p.wire.send(msg);
  }
  drop(uid: string): void {
    const p = this.peers.get(uid);
    if (!p) return;
    this.peers.delete(uid);
    p.pc.close();
  }
  close(): void {
    this.stop();
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
  }

  private async answer(uid: string, s: RtcSignal): Promise<void> {
    // a player connecting again replaces their old link
    this.lost(uid, false);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer: Peer = { session: s.session, pc };
    this.peers.set(uid, peer);
    pc.ondatachannel = (e) => {
      const ch = e.channel;
      const wire = new Wire(ch, (m) => this.ev.onMessage(uid, m));
      ch.onopen = () => {
        if (this.peers.get(uid) !== peer) return;
        peer.wire = wire;
        this.ev.onOpen(uid);
      };
      ch.onclose = () => this.peers.get(uid) === peer && this.lost(uid, true);
    };
    pc.onconnectionstatechange = () => {
      if ((pc.connectionState === 'failed' || pc.connectionState === 'closed') && this.peers.get(uid) === peer) this.lost(uid, true);
    };
    try {
      await pc.setRemoteDescription(s.offer);
      await pc.setLocalDescription(await pc.createAnswer());
      await gatherIce(pc);
      if (this.peers.get(uid) !== peer) return;
      await this.sig.publishAnswer(this.code, uid, describe(pc));
    } catch (err) {
      console.error('WebRTC answer failed', err);
      if (this.peers.get(uid) === peer) this.lost(uid, false);
    }
  }

  private lost(uid: string, tell: boolean): void {
    const p = this.peers.get(uid);
    if (!p) return;
    const was = !!p.wire;
    this.peers.delete(uid);
    p.pc.close();
    if (tell && was) this.ev.onClose(uid);
  }
}

export interface Link {
  uid: string;
  send(msg: unknown): void;
  close(): void;
}

/** A player's side: connects to the room's host. Resolves once the channel is open. */
export async function join(sig: Signaling, code: string, onMessage: (msg: unknown) => void, onClose: () => void): Promise<Link> {
  const uid = await sig.me();
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const ch = pc.createDataChannel('ra');
  const wire = new Wire(ch, onMessage);
  const session = crypto.randomUUID();
  let stopSignal = () => {};
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    stopSignal();
    pc.close();
  };
  const lost = () => {
    if (closed) return;
    close();
    onClose();
  };
  ch.onclose = lost;
  pc.onconnectionstatechange = () => (pc.connectionState === 'failed' || pc.connectionState === 'closed') && lost();
  const opened = new Promise<void>((resolve) => (ch.readyState === 'open' ? resolve() : ch.addEventListener('open', () => resolve(), { once: true })));
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await gatherIce(pc);
    stopSignal = sig.watchSignal(code, uid, (s) => {
      if (s?.session === session && s.answer && !pc.remoteDescription) void pc.setRemoteDescription(s.answer);
    });
    await sig.publishOffer(code, uid, session, describe(pc));
    let timer = 0;
    const timeout = new Promise<never>((_, reject) => (timer = window.setTimeout(() => reject(new Error('Could not reach the host. Are you on the same network?')), CONNECT_MS)));
    await Promise.race([opened, timeout]).finally(() => clearTimeout(timer));
  } catch (err) {
    close();
    throw err;
  }
  // once connected the handshake is no longer needed
  stopSignal();
  stopSignal = () => {};
  return { uid, send: (m) => wire.send(m), close };
}
