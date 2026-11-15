import type { Scene, SceneState } from '../scene/Scene';
import { Filter } from './Filter';

export function Controls({ scene, state }: { scene: Scene; state: SceneState }) {
  return (
    <div className="controls">
      <div className="segmented" role="group" aria-label="Camera">
        <button className={state.view === 'fit' ? 'on' : ''} onClick={() => scene.setView('fit')} title="Fit everyone (F)">
          <svg viewBox="0 0 20 20" aria-hidden>
            <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
            <circle cx="8" cy="10" r="2" />
            <circle cx="12.5" cy="9" r="1.6" />
          </svg>
          Fit everyone
        </button>
        <button className={state.view === 'world' ? 'on' : ''} onClick={() => scene.setView('world')} title="Whole world (W)">
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="10" cy="10" r="7" />
            <path d="M3 10h14M10 3c2.2 2 3 4.5 3 7s-.8 5-3 7c-2.2-2-3-4.5-3-7s.8-5 3-7z" />
          </svg>
          Whole world
        </button>
      </div>
      <button className={`pill ${state.traces ? 'on' : ''}`} onClick={() => scene.setTraces(!state.traces)} title="Show traces (T)" aria-pressed={state.traces}>
        <svg viewBox="0 0 20 20" aria-hidden>
          <path d="M3 15c3-8 7-9 9-6s3 3 5-3" />
        </svg>
        Traces
      </button>
      <Filter scene={scene} state={state} />
    </div>
  );
}
