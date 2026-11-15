import { useMemo, useRef, useState } from 'react';
import type { Timeline } from '../engine/timeline';
import { formatMonth, parseDateInput, yearOf } from '../engine/time';
import { BABY_BOY, BABY_GIRL } from '../data/index';
import type { Scene, SceneState } from '../scene/Scene';
import { SPEEDS, SPEED_LABELS } from '../scene/player';

interface Props {
  scene: Scene;
  state: SceneState;
  timeline: Timeline;
}

export function TimelineBar({ scene, state, timeline }: Props) {
  const { start, end } = timeline;
  const span = end - start;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pct = ((state.t - start) / span) * 100;

  const marks = useMemo(
    () =>
      timeline.events.flatMap(({ event, t }) => {
        if (event.type === 'move') return [];
        const person = timeline.people.get(event.people[0])!;
        const color =
          event.type === 'marriage' ? '#D4A72C' : person.kind === 'friend' ? person.color : person.sex === 'female' ? BABY_GIRL : BABY_BOY;
        const names = event.people.map((id) => timeline.people.get(id)!.name.split(' ')[0]).join(' & ');
        const title = event.type === 'marriage' ? `${names} married` : event.people.length > 1 ? 'Twins born' : `${person.name} born`;
        return [{ id: event.id, left: ((t - start) / span) * 100, color, kind: event.type === 'marriage' ? 'marriage' : person.kind, title: `${title}, ${formatMonth(t)}` }];
      }),
    [timeline, start, span],
  );

  const years = useMemo(() => {
    const list: { year: number; left: number; major: boolean }[] = [];
    for (let y = Math.ceil(start / 12); y * 12 <= end; y++) {
      list.push({ year: y, left: ((y * 12 - start) / span) * 100, major: y % 5 === 0 });
    }
    return list;
  }, [start, end, span]);

  const seekTo = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    scene.seek(start + f * span);
  };

  return (
    <div className="bar">
      <button className="play" onClick={() => scene.togglePlay()} aria-label={state.playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
        {state.playing ? (
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.2" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
      </button>

      <div className="speed">
        <button onClick={() => scene.setSpeed((state.speed + 1) % SPEEDS.length)} title={`${SPEEDS[state.speed]} seconds per year. Click to change.`}>
          {SPEED_LABELS[state.speed]}
        </button>
        <span className="hint">{SPEEDS[state.speed]}s / year</span>
      </div>

      <div
        className="track"
        ref={trackRef}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekTo(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && seekTo(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <div className="marks">
          {marks.map((m) => (
            <span key={m.id} className={`mark ${m.kind}`} style={{ left: `${m.left}%`, background: m.color }} title={m.title} />
          ))}
        </div>
        <div className="rail">
          <div className="fill" style={{ width: `${pct}%` }} />
          <div className="thumb" style={{ left: `${pct}%` }} />
        </div>
        <div className="years">
          {years.map((y) => (
            <span key={y.year} className={y.major ? 'major' : ''} style={{ left: `${y.left}%` }}>
              {y.major && <em>{y.year}</em>}
            </span>
          ))}
        </div>
      </div>

      <DateBox t={state.t} onSeek={(t) => scene.seek(t)} />

      <button
        className={`pill small ${state.pauseForEvents ? 'on' : ''}`}
        onClick={() => scene.setPauseForEvents(!state.pauseForEvents)}
        aria-pressed={state.pauseForEvents}
        title="Stop on every move, birth and wedding until it has played, then wait 3 seconds (L)"
      >
        <span className="switch" aria-hidden />
        Pause on each event
      </button>
    </div>
  );
}

function DateBox({ t, onSeek }: { t: number; onSeek: (t: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);

  if (!editing) {
    return (
      <button
        className="date"
        onClick={() => {
          setText(formatMonth(t));
          setBad(false);
          setEditing(true);
        }}
        title="Type a date to jump there"
      >
        <span className="month">{formatMonth(t).split(' ')[0]}</span> <span className="yr">{yearOf(t)}</span>
      </button>
    );
  }
  return (
    <form
      className={`date editing ${bad ? 'bad' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseDateInput(text);
        if (parsed === null) {
          setBad(true);
          return;
        }
        onSeek(parsed + 0.5);
        setEditing(false);
      }}
    >
      <input
        autoFocus
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setText(e.target.value);
          setBad(false);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        placeholder="June 2014"
        aria-label="Jump to date"
      />
    </form>
  );
}
