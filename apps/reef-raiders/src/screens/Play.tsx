import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IDLE, Stick, type StickState } from '../controller/stick';
import { cleanName } from '../game/looks';
import { ensureUser } from '../net/firebase';
import type { Action } from '../net/protocol';
import { joinRoom, watchRoom, type Room } from '../net/rooms';
import { connectToDisplay, type ControllerLink } from '../net/rtc';
import { JoinPanel, RaiderPad, SwimmerPad, buzz, clock, loadLook, saveLook, useHostClock, useKeyboard, type GameInfo, type Look } from './controls';

type Status = 'intro' | 'connecting' | 'missing' | 'unreachable' | 'lost' | 'connected';

const SEND_INTERVAL_MS = 33;
const KEEPALIVE_MS = 250;

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

export default function Play() {
  const code = (useParams().code ?? '').toUpperCase();
  const [status, setStatus] = useState<Status>('intro');
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [look, setLook] = useState<Look>(loadLook);
  const [editing, setEditing] = useState(true);
  const [stick, setStick] = useState<StickState>(IDLE);
  const linkRef = useRef<ControllerLink | null>(null);
  const padEl = useRef<HTMLDivElement>(null);
  const input = useRef({ x: 0, y: 0, hold: false });
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  const hostNow = useHostClock(info);

  const you = info?.you ?? null;
  const joined = !!you;
  const playing = !editing && joined;

  useEffect(() => {
    return () => {
      linkRef.current?.close();
      void wakeLock.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => saveLook(look), [look]);

  // Follow the color the screen gave us (ours may have been taken in the meantime).
  useEffect(() => {
    if (you && you.color !== look.color) setLook((l) => ({ ...l, color: you.color }));
  }, [you?.color]);

  // The joystick: sideways only for a boat, all directions for a fish.
  const axis = you?.role === 'raider' ? 'x' : 'xy';
  useEffect(() => {
    if (!playing || !padEl.current) return;
    const s = new Stick(padEl.current, axis, setStick);
    return () => {
      s.dispose();
      setStick(IDLE);
    };
  }, [playing, axis]);

  useEffect(() => {
    input.current.x = stick.x;
    input.current.y = stick.y;
  }, [stick]);

  // Streams the stick about 30 times a second, plus a keepalive when nothing changes.
  useEffect(() => {
    if (status !== 'connected') return;
    let last = { x: 9, y: 9, hold: false };
    let lastTime = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      const cur = input.current;
      if (Math.abs(cur.x - last.x) > 0.01 || Math.abs(cur.y - last.y) > 0.01 || cur.hold !== last.hold || now - lastTime > KEEPALIVE_MS) {
        linkRef.current?.sendInput(Math.round(cur.x * 1000) / 1000, Math.round(cur.y * 1000) / 1000, cur.hold);
        last = { ...cur };
        lastTime = now;
      }
    }, SEND_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'connected') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status]);

  // Buzz on the moments that matter.
  const fighting = you?.role === 'raider' ? you.hook === 'fight' : you?.role === 'swimmer' ? you.hooked : false;
  useEffect(() => {
    if (fighting) buzz([60, 40, 60]);
  }, [fighting]);
  const down = you ? (you.role === 'raider' ? you.sunk : !you.alive) : false;
  useEffect(() => {
    if (down) buzz([80, 40, 200]);
  }, [down]);

  async function requestWakeLock() {
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not fatal: the game still works, the phone may just dim.
    }
  }

  function sendJoin(l: Look) {
    linkRef.current?.sendControl({ t: 'join', role: l.role, name: cleanName(l.name, ''), color: l.color, kind: l.kind });
  }

  function act(a: Action) {
    linkRef.current?.sendControl({ t: 'act', a });
  }

  async function connect() {
    setStatus('connecting');
    linkRef.current?.close();
    try {
      const user = await ensureUser();
      const room = await firstRoomSnapshot(code);
      if (!room) return setStatus('missing');
      await joinRoom(code, user.uid);
      linkRef.current = await connectToDisplay(code, user.uid, setInfo, () => setStatus('lost'));
      setStatus('connected');
      void requestWakeLock();
      // Rejoining after a dropped connection: the screen still knows us.
      if (!editing) sendJoin(lookRef.current);
    } catch (err) {
      console.error(err);
      setStatus('unreachable');
    }
  }

  function join() {
    sendJoin(look);
    setEditing(false);
  }

  useKeyboard(
    playing ? you : null,
    hostNow,
    (x, y, hold) => {
      input.current = { x, y, hold };
    },
    act,
  );

  const hold = (on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    input.current.hold = on;
  };

  if (status !== 'connected') {
    return (
      <main className="screen">
        <h1 className="title small-title">Reef Raiders</h1>
        <div className="dim">Room {code}</div>
        {status === 'intro' && (
          <button className="primary wide" onClick={connect}>
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

  const between = !info || info.phase === 'lobby' || info.phase === 'over';
  let headline = '';
  if (info?.phase === 'lobby') headline = 'Practice! The round starts from the big screen.';
  else if (info?.phase === 'countdown') headline = 'Get ready…';
  else if (info?.phase === 'over' && you) {
    const mine = you.role === 'raider' ? 'crew' : 'school';
    headline = info.winner === 'tie' ? "It's a tie!" : info.winner === mine ? 'Your team wins!' : 'Your team lost this one.';
  }

  return (
    <main className={`play ${you?.role ?? ''}`} style={{ ['--me' as string]: you?.color ?? look.color }}>
      <header className="status">
        <div className="me">
          <span className="swatch" />
          <b>{you?.name ?? (cleanName(look.name, '') || 'You')}</b>
        </div>
        {you && (
          <div className="stats">
            <span>
              Score <b>{you.score}</b>
            </span>
            <span>
              Coins <b>{you.coins}</b>
            </span>
            {info?.timeLeft != null && <span className="time">{clock(info.timeLeft)}</span>}
          </div>
        )}
      </header>
      {info && joined && (
        <div className="teams">
          <span className={you?.role === 'raider' ? 'mine' : ''}>Crew {info.crew}</span>
          <span className={you?.role === 'swimmer' ? 'mine' : ''}>School {info.school}</span>
        </div>
      )}
      {headline && <div className="headline">{headline}</div>}

      {(editing || !joined) && (
        <JoinPanel
          look={look}
          info={info}
          joined={joined}
          onChange={(p) => setLook((l) => ({ ...l, ...p }))}
          onJoin={join}
        />
      )}

      {playing && you?.role === 'raider' && (
        <RaiderPad you={you} info={info!} padEl={padEl} stick={stick} hold={hold} act={act} hostNow={hostNow} />
      )}
      {playing && you?.role === 'swimmer' && <SwimmerPad you={you} padEl={padEl} stick={stick} act={act} />}

      {playing && between && (
        <button className="link change" onClick={() => setEditing(true)}>
          Change side or look
        </button>
      )}
      {editing && joined && (
        <button className="link change" onClick={() => setEditing(false)}>
          Back to the game
        </button>
      )}
    </main>
  );
}

