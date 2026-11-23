import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { StickState } from '../controller/stick';
import * as K from '../game/constants';
import { COLORS, NAME_MAX, isColor, isKind, isRole, type FishKind, type Role } from '../game/looks';
import type { Action, DisplayMessage, RaiderStatus, SwimmerStatus } from '../net/protocol';
import { seeded } from '../render/pix';
import { CREWS, boatGrid, clownLook, fishGrid, playerLook } from '../render/sprites';

// Pieces shared by the phone controller and a display that is also a player.

export type GameInfo = DisplayMessage;

export interface Look {
  role: Role;
  name: string;
  color: string;
  kind: FishKind;
}


const LOOK_KEY = 'reef.look';

export function loadLook(): Look {
  const fallback: Look = { role: 'swimmer', name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], kind: 'fish' };
  try {
    const v = JSON.parse(localStorage.getItem(LOOK_KEY) ?? 'null');
    if (v && isRole(v.role) && isColor(v.color) && isKind(v.kind) && typeof v.name === 'string') return v;
  } catch {
    // Remembering the last look is a convenience; private mode can refuse storage.
  }
  return fallback;
}

export function saveLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {
    // See loadLook.
  }
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
export const buzz = (p: number | number[]) => navigator.vibrate?.(p);

// The player's fish or boat, drawn with the same pixel sprites as the big screen.
export function Preview({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    let frame = 0;
    const paint = () => {
      const g =
        look.role === 'raider'
          ? boatGrid(look.color, CREWS[0])
          : fishGrid({ ...(look.kind === 'clown' ? clownLook() : playerLook(look.color)), len: 34, hgt: 19 }, frame % 4, seeded(7)).outlineAuto().glow(look.color);
      const src = g.toCanvas();
      canvas.width = src.width;
      canvas.height = src.height;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0);
      frame++;
    };
    paint();
    const timer = look.role === 'swimmer' ? setInterval(paint, 160) : 0;
    return () => clearInterval(timer);
  }, [look.role, look.color, look.kind]);
  return <canvas ref={ref} className={`preview ${look.role}`} />;
}

// Shows a cooldown as a shrinking shade over a button.
export function Cooldown({ left, total }: { left: number; total: number }) {
  if (left <= 0) return null;
  return <span className="cool" style={{ height: `${Math.min(100, (left / total) * 100)}%` }} />;
}

export function JoinPanel({
  look,
  info,
  onChange,
  onJoin,
  joined,
}: {
  look: Look;
  info: GameInfo | null;
  onChange: (patch: Partial<Look>) => void;
  onJoin: () => void;
  joined: boolean;
}) {
  const between = !info || info.phase === 'lobby' || info.phase === 'over';
  const roleLocked = joined && !between;
  const taken = new Set(info?.taken ?? []);
  const youRole = info?.you?.role;
  const full = (r: Role) => {
    const n = r === 'raider' ? (info?.raiders ?? 0) : (info?.swimmers ?? 0);
    return youRole !== r && n >= (r === 'raider' ? K.MAX_RAIDERS : K.MAX_SWIMMERS);
  };
  return (
    <section className="join-panel">
      <div className="sides">
        {(['raider', 'swimmer'] as Role[]).map((r) => (
          <button
            key={r}
            className={`side ${r}${look.role === r ? ' on' : ''}`}
            disabled={roleLocked ? r !== youRole : full(r)}
            onClick={() => onChange({ role: r })}
          >
            <b>{r === 'raider' ? 'Crew' : 'School'}</b>
            <span className="small">
              {r === 'raider' ? 'Sail a boat and catch fish' : 'Swim, grow, ram boats'}
              <br />
              {r === 'raider' ? `${info?.raiders ?? 0}/${K.MAX_RAIDERS}` : `${info?.swimmers ?? 0}/${K.MAX_SWIMMERS}`}
              {full(r) && ' · full'}
            </span>
          </button>
        ))}
      </div>
      <Preview look={look} />
      <input
        className="name-input"
        value={look.name}
        maxLength={NAME_MAX}
        placeholder="Your name"
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <div className="colors">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`color${c === look.color ? ' on' : ''}`}
            style={{ background: c }}
            disabled={taken.has(c)}
            onClick={() => onChange({ color: c })}
            aria-label={`Color ${c}${taken.has(c) ? ', taken' : ''}`}
          />
        ))}
      </div>
      {look.role === 'swimmer' && (
        <div className="segmented">
          <button className={look.kind === 'fish' ? 'on' : ''} onClick={() => onChange({ kind: 'fish' })}>
            Fish
          </button>
          <button className={look.kind === 'clown' ? 'on' : ''} onClick={() => onChange({ kind: 'clown' })}>
            Clownfish (can taunt)
          </button>
        </div>
      )}
      <button className="primary wide" onClick={onJoin} disabled={full(look.role) || (roleLocked && look.role !== youRole)}>
        {joined ? 'Save' : look.role === 'raider' ? 'Set sail' : 'Dive in'}
      </button>
    </section>
  );
}

// Keeps the display's clock in step with ours, for the Heave ring.
export function useHostClock(info: GameInfo | null) {
  const offset = useRef(0);
  useEffect(() => {
    if (info) offset.current = info.now - performance.now() / 1000;
  }, [info]);
  return useRef(() => performance.now() / 1000 + offset.current).current;
}

export function heavePhase(now: number, fightStart: number): number {
  const t = now - fightStart;
  if (t < 0) return 0;
  return (t % K.HEAVE_EVERY_S) / K.HEAVE_EVERY_S;
}

export function inHeaveWindow(now: number, fightStart: number): boolean {
  const t = now - fightStart;
  if (t < K.HEAVE_EVERY_S - K.HEAVE_WINDOW_S) return false;
  const r = t % K.HEAVE_EVERY_S;
  return r < K.HEAVE_WINDOW_S || r > K.HEAVE_EVERY_S - K.HEAVE_WINDOW_S;
}

// A gold ring that closes on the button; tap as it lands for a Heave.
export function HeaveRing({ fightStart, hostNow }: { fightStart: number; hostNow: () => number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const el = ref.current;
      if (el) {
        const now = hostNow();
        const p = heavePhase(now, fightStart);
        el.style.transform = `translate(-50%, -50%) scale(${1 + (1 - p) * 1.1})`;
        el.classList.toggle('hot', inHeaveWindow(now, fightStart));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fightStart, hostNow]);
  return <div ref={ref} className="heave-ring" />;
}

export function KnotBar({ knot, mine }: { knot: number; mine: 'raider' | 'swimmer' }) {
  return (
    <div className={`knot-bar ${mine}`}>
      <span className="end left">Fish</span>
      <div className="track">
        <div className="knot" style={{ left: `${Math.max(0, Math.min(100, knot))}%` }} />
      </div>
      <span className="end right">Boat</span>
    </div>
  );
}


export function StickView({ stick, hint }: { stick: StickState; hint: string }) {
  return stick.active ? (
    <>
      <div className="stick-base" style={{ left: stick.cx, top: stick.cy }} />
      <div className="stick-knob" style={{ left: stick.kx, top: stick.ky }} />
    </>
  ) : (
    <div className="pad-help">{hint}</div>
  );
}

export function RaiderPad({
  you,
  info,
  padEl,
  stick,
  hold,
  act,
  hostNow,
}: {
  you: RaiderStatus;
  info: GameInfo;
  padEl: React.RefObject<HTMLDivElement | null>;
  stick: StickState;
  hold: (on: boolean) => (e: ReactPointerEvent) => void;
  act: (a: Action) => void;
  hostNow: () => number;
}) {
  const [flash, setFlash] = useState('');
  const tapReel = () => {
    const heave = inHeaveWindow(hostNow(), you.fightStart);
    act(heave ? 'heave' : 'tap');
    setFlash(heave ? 'Heave!' : '');
    if (heave) buzz(30);
  };

  if (you.sunk) {
    return (
      <div className="big-state">
        <div className="big">Your boat sank!</div>
        <div>Fixing it… back in {you.fixIn}</div>
      </div>
    );
  }

  return (
    <>
      <div className="row-info">
        <span>Hull {you.health}%</span>
        <span>Meat {you.meat}</span>
        <span>Catches {you.catches}</span>
      </div>
      {you.hook === 'fight' && <KnotBar knot={you.knot} mine="raider" />}
      <div className="controls">
        <div ref={padEl} className="pad stick-pad">
          <StickView stick={stick} hint={you.hook === 'ready' ? 'Slide left or right to sail' : 'Slide to drag the line'} />
        </div>
        <div className="buttons">
          {you.hook === 'ready' && (
            <button className="action cast" onClick={() => act('cast')}>
              Cast
            </button>
          )}
          {you.hook === 'down' && (
            <button
              className="action reel"
              onPointerDown={hold(true)}
              onPointerUp={hold(false)}
              onPointerCancel={hold(false)}
              onPointerLeave={hold(false)}
            >
              Hold to reel
              <span className="small">Line {you.depth}% deep</span>
            </button>
          )}
          {you.hook === 'fight' && (
            <button className="action fight" onPointerDown={tapReel}>
              <HeaveRing fightStart={you.fightStart} hostNow={hostNow} />
              Tap!
              <span className="small">{flash || 'Tap as the ring closes'}</span>
            </button>
          )}
          <div className="small-buttons">
            {info.pete && you.meat > 0 && (
              <button className="sell" onClick={() => act('sell')}>
                Sell meat
              </button>
            )}
            <button onClick={() => act('find')}>Find me</button>
          </div>
        </div>
      </div>
    </>
  );
}

export function SwimmerPad({
  you,
  padEl,
  stick,
  act,
}: {
  you: SwimmerStatus;
  padEl: React.RefObject<HTMLDivElement | null>;
  stick: StickState;
  act: (a: Action) => void;
}) {
  const [thrashed, setThrashed] = useState(false);
  useEffect(() => {
    if (!you.hooked) setThrashed(false);
  }, [you.hooked]);

  if (!you.alive) {
    return (
      <div className="big-state">
        <div className="big">{you.diedBy ? `${you.diedBy} got you!` : 'You got eaten!'}</div>
        <div>Back in {you.respawnIn}</div>
      </div>
    );
  }

  if (you.hooked) {
    return (
      <>
        <KnotBar knot={you.knot} mine="swimmer" />
        <button className="pull-zone" onPointerDown={() => act('pull')}>
          <span className="big">Hooked!</span>
          <span>Tap fast to pull free</span>
        </button>
        <button
          className="action thrash"
          disabled={thrashed}
          onClick={() => {
            act('thrash');
            setThrashed(true);
            buzz(80);
          }}
        >
          {thrashed ? 'Thrashed' : 'Thrash! (once)'}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="row-info">
        <span>Level {you.level}</span>
        <div className="food">
          <div style={{ width: `${Math.round(you.food * 100)}%` }} />
        </div>
      </div>
      <div className="controls">
        <div ref={padEl} className="pad stick-pad">
          <StickView stick={stick} hint="Touch and drag to swim. Eat smaller fish, dodge bigger ones and hooks." />
        </div>
        <div className="buttons">
          <button className="action dash" onClick={() => act('dash')} disabled={you.dashIn > 0}>
            <Cooldown left={you.dashIn} total={K.DASH_COOLDOWN_S} />
            Dash
          </button>
          <div className="small-buttons">
            <button onClick={() => act('egg')} disabled={you.eggIn > 0}>
              <Cooldown left={you.eggIn} total={K.EGG_COOLDOWN_S} />
              Lay egg
            </button>
            {you.kind === 'clown' && (
              <button onClick={() => act('taunt')} disabled={you.tauntIn > 0}>
                <Cooldown left={you.tauntIn} total={K.TAUNT_COOLDOWN_S} />
                Taunt
              </button>
            )}
            <button onClick={() => act('find')}>Find me</button>
          </div>
        </div>
      </div>
    </>
  );
}
