import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { audioUnlocked, isMuted, setMuted, unlockAudio } from '../audio/sound';
import { DIFFICULTIES, type Difficulty } from '../game/ai';
import { MAX_SNAKES } from '../game/constants';
import { startLoop } from '../game/loop';
import { ensureUser } from '../net/firebase';
import { watchRoom } from '../net/rooms';
import { drawWorld } from '../render/draw';
import { DEFAULT_SETUP, HostSession, type HostView, type Setup, type Standing } from './hostSession';

type Status = 'loading' | 'hosting' | 'missing' | 'not-host' | 'error';

const SETUP_KEY = 'slither.setup';
const TIMER_OPTIONS = [0, 120, 180, 300, 600];

function loadSetup(): Setup {
  try {
    return { ...DEFAULT_SETUP, ...JSON.parse(localStorage.getItem(SETUP_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETUP;
  }
}

function saveSetup(setup: Setup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    // The last setup is a convenience; private mode can refuse storage.
  }
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ background: color }} />;
}

function Leaderboard({ standings }: { standings: Standing[] }) {
  if (standings.length === 0) return null;
  return (
    <ol className="leaderboard">
      {standings.map((s) => (
        <li key={s.id} className={s.alive ? '' : 'dim'}>
          <Swatch color={s.color} />
          <span className="name">
            {s.name}
            {!s.connected && ' (away)'}
          </span>
          <span className="num">{s.alive ? s.mass : '—'}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Host() {
  const code = (useParams().code ?? '').toUpperCase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<HostSession | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [view, setView] = useState<HostView | null>(null);
  const [qr, setQr] = useState('');
  const [soundOn, setSoundOn] = useState(audioUnlocked());
  const [muted, setMutedState] = useState(isMuted());
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
    const session = new HostSession(code, loadSetup(), setView);
    sessionRef.current = session;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    const stopLoop = startLoop(
      (dt) => session.update(dt),
      () => drawWorld(ctx, session.world, session.bursts),
    );
    return () => {
      stopLoop();
      window.removeEventListener('resize', resize);
      session.dispose();
      sessionRef.current = null;
    };
  }, [status, code]);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, scale: 6, color: { dark: '#000000', light: '#ffffff' } }).then(setQr);
  }, [joinUrl]);

  const enableSound = () => {
    unlockAudio();
    setTimeout(() => setSoundOn(audioUnlocked()), 100);
  };

  const changeSetup = (patch: Partial<Setup>) => {
    if (!view) return;
    const setup = { ...view.setup, ...patch };
    saveSetup(setup);
    sessionRef.current?.changeSetup(setup);
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

  const setup = view?.setup ?? DEFAULT_SETUP;
  const maxBots = Math.max(0, MAX_SNAKES - (view?.humans ?? 0));
  const snakes = view?.standings.length ?? 0;

  return (
    <div className="host">
      <canvas ref={canvasRef} />

      {view && view.phase !== 'lobby' && view.phase !== 'over' && (
        <div className="hud-right">
          <Leaderboard standings={view.standings} />
        </div>
      )}

      {view?.timeLeft != null && view.phase === 'playing' && (
        <div className={`timer${view.timeLeft <= 10 ? ' urgent' : ''}`}>{clock(view.timeLeft)}</div>
      )}

      {view?.phase === 'playing' && (
        <div className="join-hint">
          Join: {location.host}/play/<b>{code}</b>
        </div>
      )}

      {view?.phase === 'lobby' && (
        <div className="lobby">
          <section className="card">
            <h1 className="logo">Slither</h1>
            <div className="dim small">Room code</div>
            <div className="room-code">{code}</div>
            {qr && <img className="qr" src={qr} alt={`QR code for ${joinUrl}`} />}
            <p className="small dim">
              Scan with your phone, or open {location.host} and enter the code. You can steer around while you wait.
            </p>
          </section>

          <section className="card">
            <h2>Game setup</h2>
            <div className="field">
              <span>Computer players</span>
              <div className="stepper">
                <button onClick={() => changeSetup({ bots: Math.max(0, setup.bots - 1) })} disabled={setup.bots <= 0}>
                  −
                </button>
                <span className="num">{Math.min(setup.bots, maxBots)}</span>
                <button
                  onClick={() => changeSetup({ bots: Math.min(maxBots, setup.bots + 1) })}
                  disabled={setup.bots >= maxBots}
                >
                  +
                </button>
              </div>
            </div>
            <div className="field">
              <span>Difficulty</span>
              <div className="segmented">
                {DIFFICULTIES.map((d: Difficulty) => (
                  <button key={d} className={setup.difficulty === d ? 'on' : ''} onClick={() => changeSetup({ difficulty: d })}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Timer</span>
              <div className="segmented">
                {TIMER_OPTIONS.map((t) => (
                  <button key={t} className={setup.timer === t ? 'on' : ''} onClick={() => changeSetup({ timer: t })}>
                    {t === 0 ? 'Off' : `${t / 60} min`}
                  </button>
                ))}
              </div>
            </div>
            <p className="small dim">
              {setup.timer > 0
                ? 'When time runs out, the biggest snake still alive wins.'
                : 'No timer: play until you press End game. The biggest snake wins.'}
            </p>

            <h2>
              Snakes {snakes}/{MAX_SNAKES}
            </h2>
            <Leaderboard standings={view.standings} />
            {view.humans === 0 && <p className="small dim">Waiting for players to join…</p>}
            <button className="primary wide" onClick={() => sessionRef.current?.start()} disabled={snakes === 0}>
              Start game
            </button>
          </section>
        </div>
      )}

      {view?.phase === 'countdown' && (
        <div className="overlay">
          <div className="countdown">{view.countdown}</div>
        </div>
      )}

      {view?.phase === 'over' && (
        <div className="overlay dimmed">
          <section className="card results">
            {view.winner ? (
              <h1 className="winner">
                <Swatch color={view.winner.color} /> {view.winner.name} wins!
              </h1>
            ) : (
              <h1 className="winner">Nobody survived</h1>
            )}
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Snake</th>
                  <th>Final size</th>
                  <th>Biggest</th>
                  <th>Kills</th>
                </tr>
              </thead>
              <tbody>
                {view.standings.map((s, i) => (
                  <tr key={s.id}>
                    <td className="dim">{i + 1}</td>
                    <td>
                      <Swatch color={s.color} /> {s.name}
                    </td>
                    <td className="num">{s.alive ? s.mass : 'dead'}</td>
                    <td className="num">{s.best}</td>
                    <td className="num">{s.kills}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <button className="primary" onClick={() => sessionRef.current?.start()}>
                Play again
              </button>
              <button onClick={() => sessionRef.current?.backToLobby()}>Change setup</button>
            </div>
          </section>
        </div>
      )}

      {!soundOn && (
        <div className="overlay" onClick={enableSound} style={{ cursor: 'pointer' }}>
          <div className="big">Click to enable sound</div>
        </div>
      )}

      <div className="corner">
        {view?.phase === 'playing' && <button onClick={() => sessionRef.current?.end()}>End game</button>}
        <button
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>
    </div>
  );
}
