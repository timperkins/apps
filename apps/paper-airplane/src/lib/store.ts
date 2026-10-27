"use client";

import { create } from "zustand";
import { DEFAULT_MESH_OPTIONS, MeshOptions } from "./paperMesh";
import { dart } from "./planes/dart";
import { Plane } from "./fold";

export type LookOptions = {
  /** Front of the sheet. */
  paperFront: string;
  /**
   * Back of the sheet. Folding a flap over turns it face down, so a different
   * back makes every fold legible, the way two-tone origami paper does. Set it
   * equal to the front for plain white paper.
   */
  paperBack: string;
  roughness: number;
  sheen: number;
  normalScale: number;
  envIntensity: number;
  keyIntensity: number;
  exposure: number;
  textureRepeat: number;
  showWireframe: boolean;
  debugLayers: boolean;
};

export const DEFAULT_LOOK: LookOptions = {
  paperFront: "#f7f4ec",
  // Only just cooler than the front. The two sides have to differ or a fold
  // reads as one blank shape, but a strong contrast turns every place a sheet
  // wraps over - a crease, a flap that lands a millimetre short - into a band
  // of another colour, which looks like a chamfered edge rather than paper.
  paperBack: "#dde3e6",
  roughness: 0.9,
  sheen: 0.45,
  normalScale: 0.32,
  envIntensity: 1.0,
  keyIntensity: 3.4,
  exposure: 0.95,
  textureRepeat: 9,
  showWireframe: false,
  debugLayers: false,
};

type Stats = {
  fps: number;
  triangles: number;
  faces: number;
  rolls: number;
  walls: number;
  creaseEdges: number;
  buildMs: number;
};

type AppState = {
  plane: Plane;
  /** Position along the whole plane: the integer part is the step. */
  progress: number;
  playing: boolean;
  speed: number;
  mesh: MeshOptions;
  look: LookOptions;
  stats: Stats;
  setProgress: (p: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlaying: () => void;
  setSpeed: (s: number) => void;
  goToStep: (i: number) => void;
  stepBy: (d: number) => void;
  setMesh: <K extends keyof MeshOptions>(k: K, v: MeshOptions[K]) => void;
  setLook: <K extends keyof LookOptions>(k: K, v: LookOptions[K]) => void;
  resetTuning: () => void;
  setStats: (s: Partial<Stats>) => void;
};

export const useApp = create<AppState>((set, get) => ({
  plane: dart,
  progress: 0,
  playing: false,
  speed: 1,
  mesh: { ...DEFAULT_MESH_OPTIONS },
  look: { ...DEFAULT_LOOK },
  stats: { fps: 0, triangles: 0, faces: 0, rolls: 0, walls: 0, creaseEdges: 0, buildMs: 0 },

  setProgress: (p) => set({ progress: clamp(p, 0, get().plane.steps.length) }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => {
    const s = get();
    // Replay from the start once the plane is finished.
    if (!s.playing && s.progress >= s.plane.steps.length - 1e-6) {
      set({ progress: 0, playing: true });
    } else {
      set({ playing: !s.playing });
    }
  },
  setSpeed: (speed) => set({ speed }),
  goToStep: (i) => set({ progress: clamp(i, 0, get().plane.steps.length), playing: false }),
  stepBy: (d) => {
    const s = get();
    // Forward jumps land on the end of the current step, back jumps on its start.
    const cur = s.progress;
    const target = d > 0 ? Math.floor(cur + 1e-6) + 1 : Math.ceil(cur - 1e-6) - 1;
    set({ progress: clamp(target, 0, s.plane.steps.length), playing: false });
  },
  setMesh: (k, v) => set({ mesh: { ...get().mesh, [k]: v } }),
  setLook: (k, v) => set({ look: { ...get().look, [k]: v } }),
  resetTuning: () => set({ mesh: { ...DEFAULT_MESH_OPTIONS }, look: { ...DEFAULT_LOOK } }),
  setStats: (s) => set({ stats: { ...get().stats, ...s } }),
}));

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
