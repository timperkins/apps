import QRCode from 'qrcode';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { IDLE, Stick, type StickState } from '../controller/stick';
import { cleanName } from '../game/looks';
import { audioUnlocked, isMuted, setMuted, unlockAudio } from '../audio/sound';
import * as K from '../game/constants';
import { startLoop } from '../game/loop';
import { ensureUser } from '../net/firebase';
import { watchRoom } from '../net/rooms';
import { Scene } from '../render/draw';
import { loadPixelFont } from '../render/text';
import { JoinPanel, RaiderPad, SwimmerPad, loadLook, saveLook, useHostClock, useKeyboard, type StoreControl, type GameInfo, type Look } from './controls';
import { HostSession, type HostView, type PlayerRow } from './hostSession';

type Status = 'loading' | 'hosting' | 'missing' | 'not-host' | 'error';

function Roster({ rows, title, max }: { rows: PlayerRow[]; title: string; max: number }) {
  return (
    <div className="roster">
      <h3>
        {title} <span className="dim">{rows.length}/{max}</span>
      </h3>
      {rows.length === 0 && <div className="dim small">Nobody yet</div>}
      <ul>
        {rows.map((r) => (
          <li key={r.id} className={r.connected ? '' : 'dim'}>
            <span className="swatch" style={{ background: r.color }} />
            <span className="name">
              {r.name}
              {r.local && ' (this screen)'}
              {!r.connected && ' (away)'}
            </span>
            <span className="num">{r.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const WINNER_TEXT = { crew: 'The Crew wins!', school: 'The School wins!', tie: "It's a tie!" } as const;

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
  const solo = useSearchParams()[0].has('solo');
  // The person at this screen can play too, with touch controls drawn over the sea.
  const [localInfo, setLocalInfo] = useState<GameInfo | null>(null);
  const [look, setLook] = useState<Look>(loadLook);
  const [picking, setPicking] = useState(solo);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [stick, setStick] = useState<StickState>(IDLE);
  const padEl = useRef<HTMLDivElement>(null);
  const hostNow = useHostClock(localInfo);
  const me = localInfo?.you ?? null;

  useEffect(() => saveLook(look), [look]);

  useEffect(() => {
    if (!me || picking || !padEl.current) return;
    const st = new Stick(padEl.current, me.role === 'raider' ? 'x' : 'xy', setStick);
    return () => {
      st.dispose();
      setStick(IDLE);
    };
  }, [me?.role, picking]);

  const holdRef = useRef(false);
  useEffect(() => {
    if (keys.current.on && !stick.active) return;
    sessionRef.current?.local({ t: 'in', x: stick.x, y: stick.y, hold: holdRef.current });
  }, [stick]);
  const hold = (on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    holdRef.current = on;
    sessionRef.current?.local({ t: 'in', x: stick.x, y: stick.y, hold: on });
  };

  const keys = useRef({ x: 0, y: 0, hold: false, on: false });
  const [storeOpen, setStoreOpen] = useState(false);
  const store: StoreControl = {
    open: storeOpen,
    toggle: () => setStoreOpen((o) => !o),
    buy: (item) => sessionRef.current?.local({ t: 'buy', item }),
  };

  useKeyboard(
    picking ? null : me,
    hostNow,
    (x, y, hold) => {
      keys.current = { x, y, hold, on: x !== 0 || y !== 0 || hold };
      sessionRef.current?.local({ t: 'in', x, y, hold: hold || holdRef.current });
    },
    (a) => sessionRef.current?.local({ t: 'act', a }),
    store,
  );

  const joinHere = () => {
    sessionRef.current?.local({ t: 'join', role: look.role, name: cleanName(look.name, ''), color: look.color, kind: look.kind });
    setPicking(false);
  };

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
    let stopLoop = () => {};
    let session: HostSession | null = null;
    let cancelled = false;
    // The pixel font must be ready before any text sprite is drawn and cached.
    void loadPixelFont().then(() => {
      if (cancelled) return;
      const scene = new Scene();
      const s = new HostSession(code, setView, (e) => scene.event(e, s.world));
      s.onLocalStatus = setLocalInfo;
      session = s;
      sessionRef.current = s;
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      stopLoop = startLoop(
        (dt) => s.update(dt),
        () => scene.draw(ctx, s.world, { ...s.hud, code }),
      );
    });
    return () => {
      cancelled = true;
      stopLoop();
      session?.dispose();
      sessionRef.current = null;
    };
  }, [status, code]);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, scale: 6, color: { dark: '#1a1030', light: '#fff6dc' } }).then(setQr);
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

  const rows = view?.players ?? [];
  const playingHere = !!me && !picking;
  const crew = rows.filter((r) => r.role === 'raider');
  const school = rows.filter((r) => r.role === 'swimmer');

  return (
    <div className={`host${playingHere ? ' local' : ''}`}>
      <canvas ref={canvasRef} className="scene" width={K.SCENE_W} height={K.SCENE_H} />

      {playingHere && view?.phase !== 'over' && (
        <div className={`local-controls ${me.role}`} style={{ ['--me' as string]: me.color }}>
          {me.role === 'raider' ? (
            <RaiderPad
              you={me}
              info={localInfo!}
              padEl={padEl}
              stick={stick}
              hold={hold}
              act={(a) => sessionRef.current?.local({ t: 'act', a })}
              hostNow={hostNow}
              store={store}
            />
          ) : (
            <SwimmerPad you={me} padEl={padEl} stick={stick} act={(a) => sessionRef.current?.local({ t: 'act', a })} store={store} />
          )}
        </div>
      )}
      {playingHere && <div className="turn-hint">Turn your phone sideways</div>}

      {picking && (
        <div className="overlay dimmed picker">
          <section className="card">
            <h2>{solo ? 'Play solo' : 'Play on this screen'}</h2>
            <JoinPanel look={look} info={localInfo} joined={!!me} onChange={(p) => setLook((l) => ({ ...l, ...p }))} onJoin={joinHere} />
            <p className="small dim">An easy bot plays the other side until a friend joins it.</p>
            {(me || !solo) && (
              <button className="link" onClick={() => setPicking(false)}>
                Cancel
              </button>
            )}
          </section>
        </div>
      )}

      {view?.phase === 'lobby' && !picking && playingHere && !lobbyOpen && (
        <div className="lobby-bar">
          <span>
            Room <b>{code}</b>
          </span>
          <button className="primary" onClick={() => sessionRef.current?.start()}>
            Start round
          </button>
          <button onClick={() => setLobbyOpen(true)}>Invite & settings</button>
        </div>
      )}

      {view?.phase === 'lobby' && !picking && (!playingHere || lobbyOpen) && (
        <div className="lobby">
          <section className="card join-card">
            <h1 className="logo">Reef Raiders</h1>
            <div className="dim small">Room code</div>
            <div className="room-code">{code}</div>
            {qr && <img className="qr" src={qr} alt={`QR code for ${joinUrl}`} />}
            <p className="small dim">Scan with your phone, or open {location.host} and type the code.</p>
          </section>
          <section className="card">
            <h2>Pick a side on your phone</h2>
            <p className="small">
              <b>Crew</b>: steer your boat, cast, and reel fish in. <b>School</b>: swim, eat smaller fish to grow, and ram the boats.
            </p>
            <div className="rosters">
              <Roster rows={crew} title="Crew" max={K.MAX_RAIDERS} />
              <Roster rows={school} title="School" max={K.MAX_SWIMMERS} />
            </div>
            {view.waiting > 0 && <p className="small dim">{view.waiting} picking a side…</p>}
            <label className="check small">
              <input type="checkbox" checked={view.botsOn} onChange={(e) => sessionRef.current?.setBots(e.target.checked)} />
              Easy bot fills an empty side
            </label>
            <button onClick={() => setPicking(true)}>{me ? 'Change your side or look' : 'Play on this screen too'}</button>
            <p className="small dim">Everyone can practice now. Rounds last {K.ROUND_S / 60} minutes.</p>
            <button className="primary wide" onClick={() => sessionRef.current?.start()} disabled={rows.length === 0}>
              Start round
            </button>
            {lobbyOpen && (
              <button className="link" onClick={() => setLobbyOpen(false)}>
                Close
              </button>
            )}
          </section>
        </div>
      )}

      {view?.phase === 'countdown' && (
        <div className="overlay">
          <div className="countdown">{view.countdown}</div>
        </div>
      )}

      {view?.phase === 'over' && !picking && (
        <div className="overlay dimmed">
          <section className="card results">
            <h1 className="winner">{view.winner ? WINNER_TEXT[view.winner] : 'Round over'}</h1>
            <div className="totals">
              <span>
                Crew <b>{view.crew}</b>
              </span>
              <span>
                School <b>{view.school}</b>
              </span>
            </div>
            <div className="rosters">
              <Roster rows={crew} title="Crew" max={K.MAX_RAIDERS} />
              <Roster rows={school} title="School" max={K.MAX_SWIMMERS} />
            </div>
            <div className="row">
              <button className="primary" onClick={() => sessionRef.current?.start()}>
                Play again
              </button>
              <button onClick={() => sessionRef.current?.backToLobby()}>Back to lobby</button>
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
        {view?.phase === 'playing' && <button onClick={() => sessionRef.current?.end()}>End round</button>}
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
