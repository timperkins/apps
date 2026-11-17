import { useEffect, useMemo, useRef, useState } from 'react';
import type { Timeline } from '../engine/timeline';
import { formatMonth } from '../engine/time';
import { BABY_BOY, BABY_GIRL } from '../data/index';
import type { Scene, SceneState } from '../scene/Scene';

interface Props {
  scene: Scene;
  state: SceneState;
  timeline: Timeline;
}

/** The play button hides after this long without the pointer moving, while playing. */
const IDLE_MS = 8000;

/** True once the pointer, a touch or a key hasn't been used for IDLE_MS. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    wake();
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, wake);
    };
  }, []);
  return idle;
}

/** Play/pause, and a scrubbable timeline along the bottom edge with optional dots for births and weddings. */
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
  const visible = !state.dots ? [] : state.babies ? marks : marks.filter((m) => m.kind !== 'child');
  const idle = useIdle();
  const hidePlay = state.playing && idle;

  const seekTo = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    scene.seek(start + f * span);
  };

  return (
    <div className="bar">
      <button className={`play ${hidePlay ? 'hidden' : ''}`} tabIndex={hidePlay ? -1 : 0} onClick={() => scene.togglePlay()} aria-label={state.playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
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
        role="slider"
        aria-label="Timeline"
        aria-valuemin={start}
        aria-valuemax={end}
        aria-valuenow={Math.floor(state.t)}
        aria-valuetext={formatMonth(state.t)}
      >
        <div className="marks">
          {visible.map((m) => (
            <span key={m.id} className={`mark ${m.kind}`} style={{ left: `${m.left}%`, background: m.color }} title={m.title} />
          ))}
        </div>
        <div className="rail">
          <div className="fill" style={{ width: `${pct}%` }} />
          <div className="thumb" style={{ left: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
