import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEFAULT_SETTINGS, TiltController, detectSensor, requestMotionPermission, type TiltSettings } from '../controller/tilt';
import { TouchPad, type PadState } from '../controller/touch';
import { cleanName, COLORS, NAME_MAX, PATTERNS, isColor, isPattern, type Look, type Pattern } from '../game/looks';
import { ensureUser } from '../net/firebase';
import type { DisplayMessage } from '../net/protocol';
import { joinRoom, watchRoom, type Room } from '../net/rooms';
import { connectToDisplay, type ControllerLink } from '../net/rtc';
import { drawSnake, previewPoints } from '../render/snakeArt';

type Status = 'intro' | 'connecting' | 'missing' | 'unreachable' | 'lost' | 'connected';
type Mode = 'touch' | 'tilt';
type GameInfo = Extract<DisplayMessage, { t: 'state' }>;

const SEND_INTERVAL_MS = 33;
const KEEPALIVE_MS = 250;
const LOOK_KEY = 'slither.look';
const MODE_KEY = 'slither.mode';
const TILT_KEY = 'slither.tilt';

const PATTERN_LABELS: Record<Pattern, string> = {
  solid: 'Solid',
  stripes: 'Stripes',
  dots: 'Dots',
  gradient: 'Rainbow',
  glow: 'Glow',
};

function load<T>(key: string, fallback: T, check: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return check(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Remembering choices is a convenience; private mode can refuse storage.
  }
}

function randomLook(): Look {
  return { name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], pattern: 'solid' };
}

const isLook = (v: unknown): v is Look =>
  !!v && typeof v === 'object' && isColor((v as Look).color) && isPattern((v as Look).pattern) && typeof (v as Look).name === 'string';
const isMode = (v: unknown): v is Mode => v === 'touch' || v === 'tilt';
const isTilt = (v: unknown): v is TiltSettings =>
  !!v && typeof v === 'object' && typeof (v as TiltSettings).range === 'number' && typeof (v as TiltSettings).invert === 'boolean';

function firstRoomSnapshot(code: string): Promise<Room | null> {
  return new Promise((resolve, reject) => {
    const stop = watchRoom(
      code,
      (room) => {
        stop();
        resolve(room);
      },
      reject,
    );
  });
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function Preview({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    let raf = 0;
    const frame = (now: number) => {
      const t = now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      drawSnake(ctx, previewPoints(canvas.clientWidth, canvas.clientHeight, t), 11, look, { time: t });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [look]);
  return <canvas ref={ref} className="preview" />;
}

export default function Play() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('intro');
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [look, setLook] = useState<Look>(() => load(LOOK_KEY, randomLook(), isLook));
  const [mode, setMode] = useState<Mode>(() => load(MODE_KEY, 'touch' as Mode, isMode));
  const [tiltSettings, setTiltSettings] = useState<TiltSettings>(() => load(TILT_KEY, DEFAULT_SETTINGS, isTilt));
  const [tiltError, setTiltError] = useState('');
  const [pad, setPad] = useState<PadState>({ active: false, boost: false, s: 0, cx: 0, cy: 0, x: 0, y: 0 });
  const [tiltS, setTiltS] = useState(0);
  const [killedBy, setKilledBy] = useState<string | null | undefined>(undefined);
  const [showStyle, setShowStyle] = useState(true);
  const linkRef = useRef<ControllerLink | null>(null);
  const tiltRef = useRef<TiltController | null>(null);
  const padRef = useRef<TouchPad | null>(null);
  const padEl = useRef<HTMLDivElement>(null);
  const steer = useRef({ s: 0, boost: false });
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    return () => {
      tiltRef.current?.dispose();
      padRef.current?.dispose();
      linkRef.current?.close();
      void wakeLock.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => save(LOOK_KEY, look), [look]);
  useEffect(() => save(MODE_KEY, mode), [mode]);
  useEffect(() => {
    if (tiltRef.current) tiltRef.current.settings = tiltSettings;
    save(TILT_KEY, tiltSettings);
  }, [tiltSettings]);

  // The pad exists once connected; it steers in touch mode and only boosts in tilt mode.
  useEffect(() => {
    if (status !== 'connected' || !padEl.current) return;
    const touch = new TouchPad(padEl.current, mode === 'touch', setPad);
    padRef.current = touch;
    return () => {
      touch.dispose();
      padRef.current = null;
    };
  }, [status, mode]);

  useEffect(() => {
    steer.current = { s: mode === 'tilt' ? tiltS : pad.s, boost: pad.boost };
  }, [mode, tiltS, pad]);

  // Streams steering about 30 times a second, plus a keepalive when nothing changes.
  useEffect(() => {
    if (status !== 'connected') return;
    let last = { s: 9, boost: false };
    let lastTime = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      const cur = steer.current;
      if (Math.abs(cur.s - last.s) > 0.01 || cur.boost !== last.boost || now - lastTime > KEEPALIVE_MS) {
        linkRef.current?.sendSteer(Math.round(cur.s * 1000) / 1000, cur.boost);
        last = { ...cur };
        lastTime = now;
      }
    }, SEND_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status]);

  // Keep the screen awake again after the phone comes back to this tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'connected') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status]);

  // Follow the color the screen actually gave us (it may differ if ours was taken).
  useEffect(() => {
    const you = info?.you;
    if (you && (you.color !== look.color || you.pattern !== look.pattern)) {
      setLook((l) => ({ ...l, color: you.color, pattern: you.pattern }));
    }
  }, [info?.you?.color, info?.you?.pattern]);

  useEffect(() => {
    if (info?.you?.alive) setKilledBy(undefined);
  }, [info?.you?.alive]);

  // Style changes are only accepted between games.
  const canStyle = !info || info.phase === 'lobby' || info.phase === 'over';
  useEffect(() => {
    if (info?.phase === 'lobby' || info?.phase === 'over') setShowStyle(true);
    else if (info) setShowStyle(false);
  }, [info?.phase]);

  async function requestWakeLock() {
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not fatal: the game still works, the phone may just dim.
    }
  }

  function sendLook(next: Look) {
    linkRef.current?.sendControl({ t: 'look', name: cleanName(next.name, ''), color: next.color, pattern: next.pattern });
  }

  function updateLook(patch: Partial<Look>) {
    const next = { ...lookRef.current, ...patch };
    setLook(next);
    sendLook(next);
  }

  async function connect() {
    setStatus('connecting');
    linkRef.current?.close();
    try {
      const user = await ensureUser();
      const room = await firstRoomSnapshot(code);
      if (!room) return setStatus('missing');
      await joinRoom(code, user.uid);
      linkRef.current = await connectToDisplay(
        code,
        user.uid,
        (msg) => {
          if (msg.t === 'died') {
            setKilledBy(msg.by);
            navigator.vibrate?.([80, 40, 160]);
          } else setInfo(msg);
        },
        () => setStatus('lost'),
      );
      sendLook(lookRef.current);
      setStatus('connected');
      void requestWakeLock();
    } catch (err) {
      console.error(err);
      setStatus('unreachable');
    }
  }

  // Tilt needs motion access, which iPhone only grants from a tap.
  async function chooseTilt() {
    setTiltError('');
    const permission = await requestMotionPermission();
    if (permission !== 'granted') {
      setTiltError(permission === 'denied' ? 'Motion access was denied. Allow it to steer by tilting.' : 'This device has no motion sensor.');
      setMode('touch');
      return;
    }
    if (!tiltRef.current) tiltRef.current = new TiltController(tiltSettings, setTiltS);
    if (!(await detectSensor())) {
      tiltRef.current.dispose();
      tiltRef.current = null;
      setTiltError('This device has no motion sensor.');
      setMode('touch');
      return;
    }
    tiltRef.current.calibrate();
    setMode('tilt');
  }

  // Joining is a tap, so a phone that used tilt last time can ask for motion access again here.
  function join() {
    if (mode === 'tilt') void chooseTilt();
    void connect();
  }

  function chooseMode(next: Mode) {
    if (next === 'tilt') void chooseTilt();
    else setMode('touch');
  }

  if (status !== 'connected') {
    return (
      <main className="screen">
        <h1 className="title small-title">Slither</h1>
        <div className="dim">Room {code}</div>
        {status === 'intro' && (
          <button className="primary wide" onClick={join}>
            Join game
          </button>
        )}
        {status === 'connecting' && <p>Connecting to the screen…</p>}
        {status === 'missing' && <p>Room {code} does not exist.</p>}
        {(status === 'unreachable' || status === 'lost') && (
          <>
            <p className="small" style={{ maxWidth: 300 }}>
              {status === 'lost' ? 'Lost the connection to the screen.' : "Can't reach the screen."} Make sure both devices are on the
              same Wi-Fi.
            </p>
            <button className="primary wide" onClick={connect}>
              Retry
            </button>
          </>
        )}
        <Link to="/" className="dim small">
          Back
        </Link>
      </main>
    );
  }

  const you = info?.you ?? null;
  const taken = new Set(info?.taken ?? []);
  const s = mode === 'tilt' ? tiltS : pad.s;
  let headline = 'Waiting for the screen…';
  if (info?.full && !you) headline = 'This game is full (10 snakes)';
  else if (info && you) {
    if (!you.alive) headline = killedBy ? `Eaten by ${killedBy}` : 'You crashed';
    else if (info.phase === 'lobby') headline = 'Practice: the game starts from the screen';
    else if (info.phase === 'countdown') headline = 'Get ready…';
    else if (info.phase === 'over') headline = info.winner ? (info.winner === you.name ? 'You win!' : `${info.winner} wins`) : 'Game over';
    else headline = you.protected ? 'Go!' : `#${you.rank} of ${info.snakes}`;
  }

  return (
    <main className="play">
      <header className="status">
        <div className="me">
          <span className="swatch" style={{ background: look.color }} />
          <b>{cleanName(look.name, 'You')}</b>
        </div>
        {you && (
          <div className="stats">
            <span>
              Size <b>{you.alive ? you.mass : 0}</b>
            </span>
            <span>
              Kills <b>{you.kills}</b>
            </span>
            {info?.timeLeft != null && <span className="time">{clock(info.timeLeft)}</span>}
          </div>
        )}
      </header>
      <div className="headline">
        {headline}
        {you && !you.alive && you.respawnIn > 0 && <span className="dim"> · back in {you.respawnIn}</span>}
      </div>

      {showStyle && (
        <section className="style-panel">
          <Preview look={look} />
          <input
            className="name-input"
            value={look.name}
            maxLength={NAME_MAX}
            placeholder="Your name"
            onChange={(e) => updateLook({ name: e.target.value })}
            disabled={!canStyle}
          />
          <div className="colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color${c === look.color ? ' on' : ''}`}
                style={{ background: c }}
                disabled={!canStyle || taken.has(c)}
                onClick={() => updateLook({ color: c })}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="segmented">
            {PATTERNS.map((p) => (
              <button key={p} className={look.pattern === p ? 'on' : ''} disabled={!canStyle} onClick={() => updateLook({ pattern: p })}>
                {PATTERN_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button className={mode === 'touch' ? 'on' : ''} onClick={() => chooseMode('touch')}>
              Touch
            </button>
            <button className={mode === 'tilt' ? 'on' : ''} onClick={() => chooseMode('tilt')}>
              Tilt
            </button>
          </div>
          {tiltError && <p className="small">{tiltError}</p>}
          {mode === 'tilt' && (
            <div className="tilt-settings">
              <label>
                Turn {tiltSettings.range}° for a full turn
                <input
                  type="range"
                  min={15}
                  max={60}
                  step={1}
                  value={tiltSettings.range}
                  onChange={(e) => setTiltSettings({ ...tiltSettings, range: Number(e.target.value) })}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={tiltSettings.invert}
                  onChange={(e) => setTiltSettings({ ...tiltSettings, invert: e.target.checked })}
                />
                Invert
              </label>
            </div>
          )}
        </section>
      )}

      <div className="pad-bar">
        <button className="link" onClick={() => setShowStyle(!showStyle)}>
          {showStyle ? 'Hide style' : 'Style & controls'}
        </button>
        {mode === 'tilt' && <button onClick={() => tiltRef.current?.calibrate()}>Straighten</button>}
      </div>

      <div ref={padEl} className={`pad${pad.boost ? ' boosting' : ''}`}>
        {mode === 'touch' ? (
          pad.active ? (
            <>
              <div className="pad-center" style={{ left: pad.cx, top: pad.cy }} />
              <div
                className="pad-arm"
                style={{
                  left: Math.min(pad.cx, pad.cx + s * 120),
                  top: pad.cy - 3,
                  width: Math.abs(s * 120),
                }}
              />
              <div className="pad-finger" style={{ left: pad.x, top: pad.y }} />
            </>
          ) : (
            <div className="pad-help">
              Touch and slide left or right to turn.
              <br />
              Double-tap and hold to boost.
            </div>
          )
        ) : (
          <>
            <div className="wheel" style={{ transform: `rotate(${s * 90}deg)` }} />
            <div className="pad-help">
              Hold the phone sideways and turn it like a wheel.
              <br />
              Double-tap and hold anywhere to boost.
            </div>
          </>
        )}
        {pad.boost && <div className="boost-label">Boost</div>}
      </div>
    </main>
  );
}
