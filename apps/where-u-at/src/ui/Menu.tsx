import { useEffect, useRef, useState } from 'react';
import { people } from '../data/index';
import type { Friend } from '../data/types';
import { formatMonth, parseDateInput } from '../engine/time';
import type { Scene, SceneState } from '../scene/Scene';
import { SPEEDS, SPEED_LABELS } from '../scene/player';

const friends = people.filter((p): p is Friend => p.kind === 'friend').sort((a, b) => a.name.localeCompare(b.name));

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2);
}

/** The hamburger button at the top right, and the panel holding every setting. */
export function Menu({ scene, state }: { scene: Scene; state: SceneState }) {
  const [open, setOpen] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = new Set(state.hidden);
  const shown = friends.length - friends.filter((f) => hidden.has(f.id)).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} title="Settings">
        <svg viewBox="0 0 20 20" aria-hidden>
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />}
        </svg>
      </button>
      {open && (
        <div className="menu-panel" role="dialog" aria-label="Settings">
          <section>
            <h2>Camera</h2>
            <div className="segmented" role="group" aria-label="Camera">
              <button className={state.view === 'fit' ? 'on' : ''} onClick={() => scene.setView('fit')} title="Fit everyone (F)">
                Fit everyone
              </button>
              <button className={state.view === 'world' ? 'on' : ''} onClick={() => scene.setView('world')} title="Whole world (W)">
                Whole world
              </button>
            </div>
          </section>

          <section>
            <h2>Speed</h2>
            <div className="segmented" role="group" aria-label="Speed">
              {SPEED_LABELS.map((label, i) => (
                <button key={label} className={state.speed === i ? 'on' : ''} onClick={() => scene.setSpeed(i)} title={`${SPEEDS[i]} seconds per year`}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Jump to</h2>
            <DateBox t={state.t} onSeek={(t) => scene.seek(t)} />
          </section>

          <section className="toggles">
            <Toggle on={state.traces} onChange={(on) => scene.setTraces(on)} title="Show traces (T)">
              Traces
            </Toggle>
            <Toggle on={state.pauseForEvents} onChange={(on) => scene.setPauseForEvents(on)} title="Stop on every birth, wedding and long move (L)">
              Pause on each event
            </Toggle>
            <Toggle on={state.babies} onChange={(on) => scene.setBabies(on)} title="Show children and their births">
              Baby births
            </Toggle>
          </section>

          <section className="people">
            <button className="row" onClick={() => setShowPeople(!showPeople)} aria-expanded={showPeople}>
              <span className="label">People</span>
              <span className="count">
                {shown}/{friends.length}
              </span>
              <svg className={`chevron ${showPeople ? 'up' : ''}`} viewBox="0 0 20 20" aria-hidden>
                <path d="M6 8l4 4 4-4" />
              </svg>
            </button>
            {showPeople && (
              <>
                <div className="people-head">
                  <button onClick={() => scene.setAllHidden(false)}>Show all</button>
                  <button onClick={() => scene.setAllHidden(true)}>Hide all</button>
                </div>
                <ul>
                  {friends.map((f) => {
                    const on = !hidden.has(f.id);
                    return (
                      <li key={f.id}>
                        <button className={`person ${on ? 'on' : ''}`} onClick={() => scene.setHidden(f.id, on)} aria-pressed={on}>
                          <span className="face" style={{ borderColor: f.color, background: f.color }}>
                            {f.photo ? <img src={f.photo} alt="" /> : initials(f.name)}
                          </span>
                          <span className="name">{f.name}</span>
                          <span className="switch" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, title, children }: { on: boolean; onChange: (on: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <button className={`row toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} title={title}>
      <span className="label">{children}</span>
      <span className="switch" aria-hidden />
    </button>
  );
}

function DateBox({ t, onSeek }: { t: number; onSeek: (t: number) => void }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <form
      className={`date ${bad ? 'bad' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseDateInput(text);
        if (parsed === null) {
          setBad(true);
          return;
        }
        onSeek(parsed + 0.5);
        setText('');
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setBad(false);
        }}
        placeholder={formatMonth(t)}
        aria-label="Jump to date"
        enterKeyHint="go"
      />
      <button type="submit" disabled={!text.trim()}>
        Go
      </button>
    </form>
  );
}
