import { useEffect, useRef, useState } from 'react';
import { people } from '../data/index';
import type { Friend } from '../data/types';
import type { Scene, SceneState } from '../scene/Scene';

const friends = people.filter((p): p is Friend => p.kind === 'friend').sort((a, b) => a.name.localeCompare(b.name));

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2);
}

/** A button that opens everyone's face and name, each with a switch to show or hide them. */
export function Filter({ scene, state }: { scene: Scene; state: SceneState }) {
  const [open, setOpen] = useState(false);
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
    <div className="filter" ref={ref}>
      <button className={`pill ${hidden.size ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} title="Choose who to show">
        <svg viewBox="0 0 20 20" aria-hidden>
          <path d="M3 5h14l-5.5 6.5V16l-3 1.5v-6z" />
        </svg>
        Filter
        {hidden.size > 0 && <span className="count">{shown}/{friends.length}</span>}
      </button>
      {open && (
        <div className="filter-panel" role="dialog" aria-label="Choose who to show">
          <div className="filter-head">
            <span>Show</span>
            <button onClick={() => scene.setAllHidden(false)}>All</button>
            <button onClick={() => scene.setAllHidden(true)}>None</button>
          </div>
          <ul>
            {friends.map((f) => {
              const on = !hidden.has(f.id);
              return (
                <li key={f.id}>
                  <button className={`filter-row ${on ? 'on' : ''}`} onClick={() => scene.setHidden(f.id, on)} aria-pressed={on}>
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
        </div>
      )}
    </div>
  );
}
