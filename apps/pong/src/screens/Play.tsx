import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEFAULT_SETTINGS, TiltController, detectSensor, requestMotionPermission, type TiltSettings } from '../controller/tilt';
import { ensureUser } from '../net/firebase';
import type { DisplayMessage } from '../net/protocol';
import { joinRoom, watchRoom, type Room } from '../net/rooms';
import { connectToDisplay, type ControllerLink } from '../net/rtc';

type Status = 'intro' | 'starting' | 'no-sensor' | 'denied' | 'missing' | 'full' | 'connecting' | 'unreachable' | 'lost' | 'playing';

type GameInfo = Extract<DisplayMessage, { t: 'state' }>;

const SEND_INTERVAL_MS = 33;
const KEEPALIVE_MS = 250;
const SETTINGS_KEY = 'pong.tilt';

function loadSettings(): TiltSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: TiltSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Settings are a convenience; private mode can refuse storage.
  }
}

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

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export default function Play() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('intro');
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [position, setPosition] = useState(0.5);
  const [settings, setSettings] = useState<TiltSettings>(loadSettings);
  const [calibrated, setCalibrated] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const stopRoomWatch = useRef<() => void>(() => {});
  const tiltRef = useRef<TiltController | null>(null);
  const linkRef = useRef<ControllerLink | null>(null);
  const latestY = useRef(0.5);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // Tilt starts after the first tap (iPhone permission) and lives for the whole visit.
  useEffect(() => {
    return () => {
      tiltRef.current?.dispose();
      linkRef.current?.close();
      stopRoomWatch.current();
      void wakeLock.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (tiltRef.current) tiltRef.current.settings = settings;
    saveSettings(settings);
  }, [settings]);

  // Streams the paddle position about 30 times a second, plus a keepalive when it is still.
  useEffect(() => {
    if (status !== 'playing') return;
    let lastSent = -1;
    let lastTime = 0;
    const timer = setInterval(() => {
      const y = latestY.current;
      const now = performance.now();
      if (Math.abs(y - lastSent) > 0.002 || now - lastTime > KEEPALIVE_MS) {
        linkRef.current?.sendInput(y);
        lastSent = y;
        lastTime = now;
      }
      setPosition(y);
    }, SEND_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status]);

  // Keep the screen awake again after the phone comes back to this tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'playing') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status]);

  async function requestWakeLock() {
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not fatal: the game still works, the phone may just dim.
    }
  }

  async function connect() {
    setStatus('connecting');
    linkRef.current?.close();
    try {
      const user = await ensureUser();
      const room = await firstRoomSnapshot(code);
      if (!room) return setStatus('missing');
      if (!room.slots.includes(user.uid) && room.slots.every((s) => s !== null) && room.phase === 'playing') {
        return setStatus('full');
      }
      await joinRoom(code, user.uid);
      stopRoomWatch.current();
      stopRoomWatch.current = watchRoom(
        code,
        (r) => setRoomFull(!!r && !r.slots.includes(user.uid) && r.slots.every((s) => s !== null)),
        () => {},
      );
      linkRef.current = await connectToDisplay(
        code,
        user.uid,
        (msg) => {
          if (msg.t === 'hit') navigator.vibrate?.(25);
          else setInfo(msg);
        },
        () => setStatus('lost'),
      );
      setStatus('playing');
      void requestWakeLock();
    } catch (err) {
      console.error(err);
      setStatus('unreachable');
    }
  }

  // Everything that needs a user gesture happens in this one tap.
  async function start() {
    const permission = await requestMotionPermission();
    if (permission === 'denied') return setStatus('denied');
    if (permission === 'unsupported') return setStatus('no-sensor');
    setStatus('starting');
    if (!tiltRef.current) {
      tiltRef.current = new TiltController(settings, (y) => (latestY.current = y));
    }
    if (!(await detectSensor())) return setStatus('no-sensor');
    // Start from however the phone is held now; Ready recalibrates.
    tiltRef.current.calibrate();
    setCalibrated(true);
    await connect();
  }

  const ready = () => {
    tiltRef.current?.calibrate();
    setCalibrated(true);
    linkRef.current?.sendControl({ t: 'ready' });
  };

  const recalibrate = () => {
    tiltRef.current?.calibrate();
    setCalibrated(true);
  };

  if (status !== 'playing') {
    return (
      <main className="screen">
        <div className="dim">Room</div>
        <div className="big">{code}</div>
        {status === 'intro' && (
          <>
            <p className="small" style={{ maxWidth: 300 }}>
              You steer your paddle by tilting this phone. Tap to allow motion access and join.
            </p>
            <button className="wide" onClick={start}>
              Tap to start
            </button>
          </>
        )}
        {(status === 'starting' || status === 'connecting') && <p>Connecting to the screen…</p>}
        {status === 'denied' && (
          <>
            <p className="small" style={{ maxWidth: 300 }}>
              Pong needs motion access to read your phone's tilt. Allow it to play.
            </p>
            <button className="wide" onClick={start}>
              Try again
            </button>
          </>
        )}
        {status === 'no-sensor' && (
          <p className="small" style={{ maxWidth: 300 }}>
            This device has no motion sensor. Tilt is required, so join from a phone.
          </p>
        )}
        {status === 'missing' && <p>Room {code} does not exist.</p>}
        {status === 'full' && <p>This game already has two players.</p>}
        {(status === 'unreachable' || status === 'lost') && (
          <>
            <p className="small" style={{ maxWidth: 300 }}>
              {status === 'lost' ? 'Lost the connection to the screen.' : "Can't reach the screen."} Make sure both devices are on the
              same Wi-Fi.
            </p>
            <button className="wide" onClick={connect}>
              Retry
            </button>
          </>
        )}
        {isIOS && !isStandalone && status === 'intro' && (
          <p className="dim small">Tip: Share, then Add to Home Screen, for full screen.</p>
        )}
        <Link to="/" className="dim small">
          Back
        </Link>
      </main>
    );
  }

  const slot = info?.slot ?? -1;
  const meReady = slot >= 0 && info?.ready[slot];
  const canReady = info && (info.phase === 'lobby' || info.phase === 'over') && !meReady;
  let message = 'Waiting for the screen…';
  if (roomFull && slot < 0) message = 'This game already has two players';
  if (info && slot >= 0) {
    if (info.phase === 'lobby') message = meReady ? 'Waiting for the other player' : 'Hold the phone comfortably, then tap Ready';
    else if (info.phase === 'playing') message = 'Tilt to move';
    else if (info.phase === 'paused') message = 'Paused: waiting for a player';
    else if (info.phase === 'over') message = info.winner === slot ? 'You win!' : 'You lose';
  }

  return (
    <main className="screen">
      <div className="big">
        {slot >= 0 ? `P${slot + 1} · ${slot === 0 ? 'Left' : 'Right'}` : 'Joining'}
        {info && (
          <span className="dim">
            {'  '}
            {info.score[0]}-{info.score[1]}
          </span>
        )}
      </div>
      <p className="small">{message}</p>
      <div className="pad">
        <div className="track" aria-label="Your paddle">
          <div className="paddle" style={{ top: `calc(${position} * 80%)` }} />
        </div>
        <div className="controls">
          {canReady && (
            <button className="wide" onClick={ready}>
              Ready
            </button>
          )}
          <button onClick={recalibrate}>{calibrated ? 'Recalibrate' : 'Calibrate'}</button>
          <label>
            Sensitivity: {settings.range}° of tilt
            <input
              type="range"
              min={15}
              max={45}
              step={1}
              value={settings.range}
              onChange={(e) => setSettings({ ...settings, range: Number(e.target.value) })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.invert}
              onChange={(e) => setSettings({ ...settings, invert: e.target.checked })}
            />
            Invert
          </label>
        </div>
      </div>
    </main>
  );
}
