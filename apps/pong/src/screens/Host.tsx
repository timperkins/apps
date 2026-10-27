import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { audioUnlocked, isMuted, setMuted, unlockAudio } from '../audio/sound';
import { FIELD_H, FIELD_W } from '../game/constants';
import { startLoop } from '../game/loop';
import { drawGame } from '../render/draw';
import { ensureUser } from '../net/firebase';
import { watchRoom } from '../net/rooms';
import { HostSession, type HostView } from './hostSession';

type Status = 'loading' | 'hosting' | 'missing' | 'not-host' | 'error';

export default function Host() {
  const code = (useParams().code ?? '').toUpperCase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [view, setView] = useState<HostView | null>(null);
  const [qr, setQr] = useState('');
  const [soundOn, setSoundOn] = useState(audioUnlocked());
  const [muted, setMutedState] = useState(isMuted());
  const [crt, setCrt] = useState(false);
  const joinUrl = `${location.origin}/play/${code}`;

  // Only the device that created the room may act as its display.
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    ensureUser()
      .then((user) => {
        if (cancelled) return;
        stop = watchRoom(
          code,
          (room) => {
            if (!room) setStatus((s) => (s === 'hosting' ? s : 'missing'));
            else setStatus(room.hostUid === user.uid ? 'hosting' : 'not-host');
          },
          () => setStatus('error'),
        );
      })
      .catch(() => setStatus('error'));
    return () => {
      cancelled = true;
      stop();
    };
  }, [code]);

  useEffect(() => {
    if (status !== 'hosting') return;
    const session = new HostSession(code, setView);
    const ctx = canvasRef.current!.getContext('2d')!;
    const stopLoop = startLoop(
      (dt) => session.update(dt),
      () => drawGame(ctx, session.game),
    );
    return () => {
      stopLoop();
      session.dispose();
    };
  }, [status, code]);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, scale: 6, color: { dark: '#000000', light: '#ffffff' } }).then(setQr);
  }, [joinUrl]);

  const enableSound = () => {
    unlockAudio();
    setTimeout(() => setSoundOn(audioUnlocked()), 100);
  };

  if (status !== 'hosting') {
    return (
      <main className="screen">
        {status === 'loading' && <p>Loading…</p>}
        {status === 'missing' && <p>Room {code} does not exist.</p>}
        {status === 'not-host' && (
          <>
            <p>Room {code} is shown on another screen.</p>
            <Link to={`/play/${code}`}>
              <button>Join as a player</button>
            </Link>
          </>
        )}
        {status === 'error' && <p>Could not reach the game server. Check your connection and reload.</p>}
        <Link to="/" className="dim small">
          Back
        </Link>
      </main>
    );
  }

  const names = ['P1', 'P2'];
  const slotLabel = (i: number) => {
    if (!view?.slots[i]) return 'waiting';
    if (!view.connected[i]) return 'connecting';
    return view.ready[i] ? 'ready' : 'joined';
  };

  return (
    <div className={`host${crt ? ' crt' : ''}`}>
      <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} />

      {view?.phase === 'lobby' && (
        <div className="overlay">
          <div className="dim">Room code</div>
          <div className="room-code">{code}</div>
          <div className="row" style={{ gap: 32 }}>
            {qr && <img className="qr" src={qr} alt={`QR code for ${joinUrl}`} />}
            <div className="small" style={{ maxWidth: 320, textAlign: 'left', lineHeight: 1.6 }}>
              Scan with your phone, or open {location.host} and enter the code. Hold your phone upright and tap Ready.
            </div>
          </div>
          <div className="slots">
            {names.map((n, i) => (
              <div key={n}>
                {n}: <span className={view.ready[i] ? '' : 'dim'}>{slotLabel(i)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view?.phase === 'countdown' && (
        <div className="overlay" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="countdown">{view.countdown}</div>
        </div>
      )}

      {view?.phase === 'paused' && (
        <div className="overlay">
          <div className="big">Paused</div>
          <div>
            Waiting for {names.filter((_, i) => !view.connected[i]).join(' and ')} to reconnect
          </div>
        </div>
      )}

      {view?.phase === 'over' && view.winner !== null && (
        <div className="overlay">
          <div className="big">{names[view.winner]} wins</div>
          <div className="dim">Tap Ready on both phones to play again</div>
          <div className="slots">
            {names.map((n, i) => (
              <div key={n}>
                {n}: <span className={view.ready[i] ? '' : 'dim'}>{slotLabel(i)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!soundOn && (
        <div className="overlay" onClick={enableSound} style={{ cursor: 'pointer' }}>
          <div className="big">Click to enable sound</div>
        </div>
      )}

      <div className="corner">
        <button
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
        <button onClick={() => setCrt(!crt)}>{crt ? 'CRT on' : 'CRT off'}</button>
      </div>
    </div>
  );
}
