import { CONTROL_CHANNEL, INPUT_CHANNEL, type GuestMessage, type HostMessage } from './protocol';
import { publishAnswer, publishOffer, watchOffers, watchSignal, type SessionDescription } from './rooms';

// Free public STUN is enough for devices on the same Wi-Fi; there is no TURN relay in v1.
const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const ICE_GATHER_TIMEOUT_MS = 2500;
export const CONNECT_TIMEOUT_MS = 10000;

// Waits for ICE gathering so the whole offer or answer goes in one Firestore write.
function gatherIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

function describe(pc: RTCPeerConnection): SessionDescription {
  const d = pc.localDescription!;
  return { type: d.type, sdp: d.sdp };
}

export interface GuestLink {
  sendInput(msg: GuestMessage): void;
  sendControl(msg: GuestMessage): void;
  close(): void;
}

// Joining side: offers a connection to the host and resolves once both channels are open.
export async function connectToHost(
  code: string,
  uid: string,
  onMessage: (msg: HostMessage) => void,
  onClosed: () => void,
): Promise<GuestLink> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const input = pc.createDataChannel(INPUT_CHANNEL, { ordered: false, maxRetransmits: 0 });
  const control = pc.createDataChannel(CONTROL_CHANNEL);
  const session = crypto.randomUUID();
  let stopSignal = () => {};
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    stopSignal();
    pc.close();
  };

  control.onmessage = (e) => onMessage(JSON.parse(e.data) as HostMessage);
  const lost = () => {
    if (!closed) {
      close();
      onClosed();
    }
  };
  control.onclose = lost;
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') lost();
  };

  const opened = Promise.all(
    [input, control].map(
      (ch) =>
        new Promise<void>((resolve) => {
          if (ch.readyState === 'open') resolve();
          else ch.addEventListener('open', () => resolve(), { once: true });
        }),
    ),
  );

  try {
    await pc.setLocalDescription(await pc.createOffer());
    await gatherIce(pc);
    stopSignal = watchSignal(code, uid, (signal) => {
      if (signal?.session === session && signal.answer && !pc.remoteDescription) {
        void pc.setRemoteDescription(signal.answer);
      }
    });
    await publishOffer(code, uid, session, describe(pc));

    let timer = 0;
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('timeout')), CONNECT_TIMEOUT_MS);
    });
    await Promise.race([opened, timeout]).finally(() => clearTimeout(timer));
  } catch (err) {
    close();
    throw err;
  }

  return {
    sendInput(msg) {
      if (input.readyState === 'open') input.send(JSON.stringify(msg));
    },
    sendControl(msg) {
      if (control.readyState === 'open') control.send(JSON.stringify(msg));
    },
    close,
  };
}

export interface HostCallbacks {
  onConnected(uid: string): void;
  onDisconnected(uid: string): void;
  onMessage(uid: string, msg: GuestMessage): void;
}

interface Peer {
  session: string;
  pc: RTCPeerConnection;
  control?: RTCDataChannel;
}

// Host side: answers the joining device's offer and routes their messages.
export class HostHub {
  private peers = new Map<string, Peer>();
  private stopOffers: () => void;

  constructor(
    private code: string,
    private callbacks: HostCallbacks,
  ) {
    this.stopOffers = watchOffers(code, (uid, signal) => {
      if (this.peers.get(uid)?.session === signal.session) return;
      void this.answer(uid, signal.session, signal.offer);
    });
  }

  send(uid: string, msg: HostMessage): void {
    const ch = this.peers.get(uid)?.control;
    if (ch?.readyState === 'open') ch.send(JSON.stringify(msg));
  }

  /** Bytes still waiting to go out to a peer, so the host can skip a snapshot on a slow link. */
  buffered(uid: string): number {
    return this.peers.get(uid)?.control?.bufferedAmount ?? 0;
  }

  close(): void {
    this.stopOffers();
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear();
  }

  private async answer(uid: string, session: string, offer: SessionDescription): Promise<void> {
    // A reconnecting device replaces its old link.
    this.drop(uid, false);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer: Peer = { session, pc };
    this.peers.set(uid, peer);
    let open = 0;

    pc.ondatachannel = (e) => {
      const ch = e.channel;
      if (ch.label === CONTROL_CHANNEL) peer.control = ch;
      ch.onmessage = (m) => this.callbacks.onMessage(uid, JSON.parse(m.data) as GuestMessage);
      ch.onopen = () => {
        open += 1;
        if (open === 2 && this.peers.get(uid) === peer) this.callbacks.onConnected(uid);
      };
      ch.onclose = () => {
        if (this.peers.get(uid) === peer) this.drop(uid, true);
      };
    };
    pc.onconnectionstatechange = () => {
      if ((pc.connectionState === 'failed' || pc.connectionState === 'disconnected') && this.peers.get(uid) === peer) {
        this.drop(uid, true);
      }
    };

    try {
      await pc.setRemoteDescription(offer);
      await pc.setLocalDescription(await pc.createAnswer());
      await gatherIce(pc);
      if (this.peers.get(uid) !== peer) return;
      await publishAnswer(this.code, uid, describe(pc));
    } catch (err) {
      console.error('WebRTC answer failed', err);
      if (this.peers.get(uid) === peer) this.drop(uid, false);
    }
  }

  private drop(uid: string, notify: boolean): void {
    const peer = this.peers.get(uid);
    if (!peer) return;
    this.peers.delete(uid);
    peer.pc.close();
    if (notify) this.callbacks.onDisconnected(uid);
  }
}
