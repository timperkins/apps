"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { MeshOptions } from "@/lib/paperMesh";
import { LookOptions, useApp } from "@/lib/store";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-stone-500">
      Loading the studio…
    </div>
  ),
});

export default function Viewer() {
  const plane = useApp((s) => s.plane);
  const progress = useApp((s) => s.progress);
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const stats = useApp((s) => s.stats);
  const { setProgress, togglePlaying, stepBy, goToStep, setSpeed } = useApp.getState();

  const stepCount = plane.steps.length;
  const current = Math.min(Math.floor(progress + 1e-9), stepCount - 1);
  const step = plane.steps[current];

  // Hooks for the screenshot script, which drives the app in a real browser.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__setProgress = (v: number) => useApp.setState({ progress: v, playing: false });
    w.__stats = () => useApp.getState().stats;
    w.__progress = () => useApp.getState().progress;
    w.__setLook = (key: string, value: unknown) =>
      useApp.setState((st) => ({ look: { ...st.look, [key]: value } }));
    w.__setMesh = (key: string, value: unknown) =>
      useApp.setState((st) => ({ mesh: { ...st.mesh, [key]: value } }));
    return () => {
      delete w.__setProgress;
      delete w.__stats;
      delete w.__progress;
      delete w.__setLook;
      delete w.__setMesh;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlaying();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) setProgress(useApp.getState().progress + 0.05);
        else stepBy(1);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) setProgress(useApp.getState().progress - 0.05);
        else stepBy(-1);
      } else if (e.key === "[") {
        setSpeed(Math.max(0.25, useApp.getState().speed / 2));
      } else if (e.key === "]") {
        setSpeed(Math.min(3, useApp.getState().speed * 2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlaying, setProgress, stepBy, setSpeed]);

  return (
    <div className="flex h-dvh w-full flex-col bg-stone-100 text-stone-800">
      <header className="flex items-baseline gap-3 border-b border-stone-300 px-5 py-3">
        <h1 className="text-base font-semibold tracking-tight">{plane.name}</h1>
        <span className="text-xs text-stone-500">
          Realism spike · procedural folding, no authored animation
        </span>
        <span className="ml-auto font-mono text-[11px] text-stone-500">
          {stats.fps} fps · {stats.triangles.toLocaleString()} tris · {stats.faces} faces ·{" "}
          {stats.rolls} rolled edges · {stats.walls} cut edges · rebuild{" "}
          {stats.buildMs.toFixed(1)} ms
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-stone-300 p-3 lg:flex">
          <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Steps
          </h2>
          <ol className="flex flex-col gap-1">
            {plane.steps.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => goToStep(i)}
                  className={`w-full rounded-md px-3 py-2 text-left transition ${
                    i === current ? "bg-stone-800 text-stone-50" : "hover:bg-stone-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] opacity-60">{i + 1}</span>
                    <span className="text-sm font-medium">{s.title}</span>
                    {s.bookmark && (
                      <span
                        title="Bookmarked step"
                        className={`ml-auto text-xs ${
                          i === current ? "text-amber-300" : "text-amber-500"
                        }`}
                      >
                        ★
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-xs leading-snug ${
                      i === current ? "text-stone-300" : "text-stone-500"
                    }`}
                  >
                    {s.text}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="relative min-w-0 flex-1">
          <Scene />
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-md rounded-lg bg-stone-900/75 px-3 py-2 text-stone-50 backdrop-blur lg:hidden">
            <div className="text-sm font-medium">{step.title}</div>
            <div className="text-xs text-stone-300">{step.text}</div>
          </div>
        </main>

        <TuningPanel />
      </div>

      <footer className="flex items-center gap-3 border-t border-stone-300 px-5 py-3">
        <button
          onClick={togglePlaying}
          className="w-20 rounded-md bg-stone-800 px-3 py-2 text-sm font-medium text-stone-50 hover:bg-stone-700"
        >
          {playing ? "Pause" : progress >= stepCount - 1e-6 ? "Replay" : "Play"}
        </button>
        <button
          onClick={() => stepBy(-1)}
          className="rounded-md border border-stone-400 px-3 py-2 text-sm hover:bg-stone-200"
        >
          Prev
        </button>
        <button
          onClick={() => stepBy(1)}
          className="rounded-md border border-stone-400 px-3 py-2 text-sm hover:bg-stone-200"
        >
          Next
        </button>

        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={stepCount}
            step={0.001}
            value={progress}
            onChange={(e) => {
              useApp.setState({ playing: false });
              setProgress(Number(e.target.value));
            }}
            className="w-full accent-stone-800"
          />
          <div className="pointer-events-none absolute inset-x-0 top-full flex justify-between px-[7px] text-[10px] text-stone-400">
            {Array.from({ length: stepCount + 1 }, (_, i) => (
              <span key={i} className={plane.steps[i]?.bookmark ? "text-amber-600" : ""}>
                {plane.steps[i]?.bookmark ? "★" : "|"}
              </span>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-stone-600">
          Speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded border border-stone-400 bg-white px-2 py-1 text-sm"
          >
            {[0.25, 0.5, 1, 1.5, 2, 3].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </footer>
    </div>
  );
}

function TuningPanel() {
  const mesh = useApp((s) => s.mesh);
  const look = useApp((s) => s.look);
  const setMesh = useApp((s) => s.setMesh);
  const setLook = useApp((s) => s.setLook);
  const resetTuning = useApp((s) => s.resetTuning);

  const meshRow = (k: keyof MeshOptions, label: string, min: number, max: number, step: number) => (
    <Row
      key={k}
      label={label}
      value={mesh[k] as number}
      min={min}
      max={max}
      step={step}
      onChange={(v) => setMesh(k, v as never)}
    />
  );
  const lookRow = (k: keyof LookOptions, label: string, min: number, max: number, step: number) => (
    <Row
      key={k}
      label={label}
      value={look[k] as number}
      min={min}
      max={max}
      step={step}
      onChange={(v) => setLook(k, v as never)}
    />
  );

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-stone-300 p-3 xl:flex">
      <section>
        <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Paper
        </h2>
        {meshRow("thickness", "Sheet thickness", 0.05, 3, 0.05)}
        {meshRow("edgeShade", "Edge shading", 0, 0.8, 0.02)}
        {meshRow("bandStart", "Crease width, moving", 1, 30, 0.5)}
        {meshRow("strips", "Arc segments", 3, 20, 1)}
        <p className="pb-2 text-[10px] leading-snug text-stone-500">
          The finished crease follows from thickness, so the fold lands exactly where the
          animation leaves it.
        </p>
      </section>
      <section>
        <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Colour
        </h2>
        <ColourRow
          label="Front of the sheet"
          value={look.paperFront}
          onChange={(v) => setLook("paperFront", v)}
        />
        <ColourRow
          label="Back of the sheet"
          value={look.paperBack}
          onChange={(v) => setLook("paperBack", v)}
        />
        <button
          onClick={() => setLook("paperBack", look.paperFront)}
          className="mb-1 w-full rounded-md border border-stone-400 px-2 py-1 text-[11px] hover:bg-stone-200"
        >
          Match back to front
        </button>
      </section>
      <section>
        <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Surface
        </h2>
        {lookRow("roughness", "Roughness", 0.3, 1, 0.01)}
        {lookRow("sheen", "Sheen", 0, 1, 0.01)}
        {lookRow("normalScale", "Fibre depth", 0, 2, 0.05)}
        {lookRow("textureRepeat", "Fibre scale", 1, 30, 0.5)}
      </section>
      <section>
        <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Light
        </h2>
        {lookRow("keyIntensity", "Key light", 0, 6, 0.1)}
        {lookRow("envIntensity", "Environment", 0, 3, 0.05)}
        {lookRow("exposure", "Exposure", 0.3, 2, 0.05)}
      </section>
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={look.showWireframe}
          onChange={(e) => setLook("showWireframe", e.target.checked)}
        />
        Show wireframe
      </label>
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={look.debugLayers}
          onChange={(e) => setLook("debugLayers", e.target.checked)}
        />
        Colour by layer
      </label>
      <button
        onClick={resetTuning}
        className="rounded-md border border-stone-400 px-3 py-1.5 text-xs hover:bg-stone-200"
      >
        Reset tuning
      </button>
    </aside>
  );
}

function ColourRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="mb-2 flex items-center justify-between gap-2 text-[11px] text-stone-600">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px]">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-stone-400 bg-white p-0.5"
        />
      </span>
    </label>
  );
}

function Row({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-2 block">
      <div className="flex justify-between text-[11px] text-stone-600">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-stone-700"
      />
    </label>
  );
}
