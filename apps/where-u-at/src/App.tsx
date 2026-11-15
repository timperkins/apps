import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { events, people } from './data/index';
import { Timeline } from './engine/timeline';
import { yearOf } from './engine/time';
import { Scene, type SceneState } from './scene/Scene';
import { Controls } from './ui/Controls';
import { TimelineBar } from './ui/TimelineBar';

function nowMonth(): number {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth() + 0.99;
}

const EMPTY: SceneState = { t: 0, playing: false, speed: 2, pauseForEvents: true, traces: true, view: 'fit', hidden: [] };
const noop = () => () => {};

export function App() {
  const timeline = useMemo(() => new Timeline(people, events, nowMonth()), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    const s = new Scene(stageRef.current!, mapRef.current!, canvasRef.current!, timeline);
    setScene(s);
    (window as unknown as { scene?: Scene }).scene = s;
    return () => s.destroy();
  }, [timeline]);

  const state = useSyncExternalStore(scene?.subscribe ?? noop, scene?.getState ?? (() => EMPTY));

  useEffect(() => {
    if (!scene) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = scene.getState();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          scene.togglePlay();
          break;
        case 'ArrowLeft':
          scene.seek(s.t - 12);
          break;
        case 'ArrowRight':
          scene.seek(s.t + 12);
          break;
        case 'f':
        case 'F':
          scene.setView('fit');
          break;
        case 'w':
        case 'W':
          scene.setView('world');
          break;
        case 't':
        case 'T':
          scene.setTraces(!s.traces);
          break;
        case 'l':
        case 'L':
          scene.setPauseForEvents(!s.pauseForEvents);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene]);

  return (
    <div className="app">
      <div className="stage" ref={stageRef}>
        <div className="map" ref={mapRef} />
        <canvas className="overlay" ref={canvasRef} />
      </div>
      <header className="title">
        <h1>Where u at</h1>
        <div className="year" aria-live="off">
          {scene ? yearOf(state.t) : ''}
        </div>
      </header>
      {scene && <Controls scene={scene} state={state} />}
      {scene && <TimelineBar scene={scene} state={state} timeline={timeline} />}
    </div>
  );
}
