"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { buildTimeline } from "@/lib/fold";
import { applyBend, bandAt, buildFlatMesh } from "@/lib/paperMesh";
import { makePaperTextures } from "@/lib/paperTexture";
import { clamp, useApp } from "@/lib/store";

/** Millimetres to scene units. A Letter sheet ends up 2.16 by 2.79 units. */
const SCALE = 0.01;

/**
 * Clearance between the bottom sheet and the table. The lowest sheet's edge
 * walls hang a full thickness below its surface, so the model has to sit at
 * least that high or the walls would push through the table.
 */
const restHeightMm = (thickness: number) => thickness + 0.3;

/** Eased progress within a step. Slow at both ends, like a hand folding paper. */
const ease = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Colour each face by the side of the paper actually turned towards the camera.
 *
 * Both colours travel on the geometry and the shader picks between them, so a
 * flap changes colour as it passes vertical rather than the moment the step
 * commits.
 */
function twoSidedPaper(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nattribute vec3 colorBack;\nvarying vec3 vColorBack;",
    )
    .replace("#include <color_vertex>", "#include <color_vertex>\n\tvColorBack = colorBack;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vColorBack;")
    .replace(
      "#include <color_fragment>",
      // vColor is a vec4 when vertex alpha is in play, so swizzle either way.
      "diffuseColor.rgb *= gl_FrontFacing ? vColor.rgb : vColorBack;",
    );
}
const twoSidedPaperKey = () => "paper-two-sided";

export function PaperModel() {
  const plane = useApp((s) => s.plane);
  const mesh = useApp((s) => s.mesh);
  const look = useApp((s) => s.look);
  const setStats = useApp((s) => s.setStats);

  // Only re-renders when the step changes, not on every frame of progress.
  const stepIndex = useApp((s) =>
    clamp(Math.floor(s.progress + 1e-9), 0, s.plane.steps.length - 1),
  );

  // Thickness changes the geometry of every crease, so the timeline depends on it.
  const timeline = useMemo(() => buildTimeline(plane, mesh.thickness), [plane, mesh.thickness]);
  const textures = useMemo(() => makePaperTextures(512), []);
  useEffect(() => () => textures.dispose(), [textures]);

  useEffect(() => {
    const tile = plane.paper.width / Math.max(0.5, look.textureRepeat);
    for (const tex of [textures.normalMap, textures.roughnessMap]) {
      tex.repeat.set(1 / tile, 1 / tile);
      tex.needsUpdate = true;
    }
  }, [textures, look.textureRepeat, plane.paper.width]);

  // Rebuilding the triangle list is the expensive part, so it happens only when
  // the step or the tuning changes, never per frame.
  // Paper colours live with the rest of the look, but the mesh builder needs
  // them as linear values on the vertices, so they are folded in here.
  const meshOptions = useMemo(() => {
    const toLinear = (hex: string): [number, number, number] => {
      const c = new THREE.Color(hex);
      return [c.r, c.g, c.b];
    };
    return {
      ...mesh,
      frontTint: toLinear(look.paperFront),
      backTint: toLinear(look.paperBack),
      debugLayers: look.debugLayers,
    };
  }, [mesh, look.paperFront, look.paperBack, look.debugLayers]);

  const flat = useMemo(
    () => buildFlatMesh(timeline[stepIndex], plane.steps[stepIndex] ?? null, meshOptions),
    [timeline, stepIndex, plane.steps, meshOptions],
  );

  useEffect(() => {
    setStats({
      triangles: flat.stats.triangles,
      faces: flat.stats.faces,
      rolls: flat.stats.rolls,
      walls: flat.stats.walls,
      creaseEdges: flat.stats.creaseEdges,
      buildMs: flat.stats.buildMs,
    });
  }, [flat, setStats]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flat.count * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(flat.count * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(flat.uv.slice(), 2));
    g.setAttribute("color", new THREE.BufferAttribute(flat.col.slice(), 3));
    g.setAttribute("colorBack", new THREE.BufferAttribute(flat.colBack.slice(), 3));
    return g;
  }, [flat]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // A new step means a new set of triangles, whose positions start at zero.
  // Filling them before the browser paints stops the model blinking out for a
  // frame every time a step commits.
  useLayoutEffect(() => {
    const app = useApp.getState();
    const steps = app.plane.steps;
    const idx = clamp(Math.floor(app.progress + 1e-9), 0, steps.length - 1);
    const eased = ease(clamp(app.progress - idx, 0, 1));
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const nrm = geometry.attributes.normal as THREE.BufferAttribute;
    applyBend(
      flat,
      eased,
      bandAt(eased, app.mesh),
      pos.array as Float32Array,
      nrm.array as Float32Array,
    );
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
  }, [flat, geometry]);

  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const centre = useRef(new THREE.Vector2(0, 0));
  const fps = useRef({ frames: 0, last: 0 });

  useFrame((_state, delta) => {
    const app = useApp.getState();
    const steps = app.plane.steps;

    if (app.playing) {
      const step = steps[clamp(Math.floor(app.progress + 1e-9), 0, steps.length - 1)];
      // A stalled tab or a slow first frame can hand us a huge delta; without a
      // cap the animation would teleport past whole steps.
      const dt = Math.min(delta, 0.1);
      const next = app.progress + (dt * 1000 * app.speed) / step.durationMs;
      if (next >= steps.length) {
        useApp.setState({ progress: steps.length, playing: false });
      } else {
        useApp.setState({ progress: next });
      }
    }

    const idx = clamp(Math.floor(useApp.getState().progress + 1e-9), 0, steps.length - 1);
    const t = clamp(useApp.getState().progress - idx, 0, 1);
    const eased = ease(t);

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const nrm = geometry.attributes.normal as THREE.BufferAttribute;
    applyBend(
      flat,
      eased,
      bandAt(eased, app.mesh),
      pos.array as Float32Array,
      nrm.array as Float32Array,
    );
    pos.needsUpdate = true;
    nrm.needsUpdate = true;

    // Keep the subject framed as the paper shrinks and shifts under folding.
    const arr = pos.array as Float32Array;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < flat.count; i++) {
      const x = arr[i * 3];
      const z = arr[i * 3 + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (Number.isFinite(minX)) {
      const k = 1 - Math.exp(-delta * 4);
      centre.current.x += ((minX + maxX) / 2 - centre.current.x) * k;
      centre.current.y += ((minZ + maxZ) / 2 - centre.current.y) * k;
    }
    if (inner.current) {
      inner.current.position.set(
        -centre.current.x * SCALE,
        restHeightMm(app.mesh.thickness) * SCALE,
        -centre.current.y * SCALE,
      );
    }

    // The closing step lifts the plane off the table and rolls it upright.
    const step = steps[idx];
    const roll = ((step.roll ?? 0) * eased * Math.PI) / 180;
    const lift = step.roll ? eased * 70 * SCALE : 0;
    if (outer.current) {
      outer.current.rotation.z = roll;
      outer.current.position.y = lift;
    }

    const f = fps.current;
    f.frames++;
    const now = performance.now();
    if (f.last === 0) f.last = now;
    if (now - f.last > 500) {
      const measured = Math.round((f.frames * 1000) / (now - f.last));
      useApp.setState((s) => ({ stats: { ...s.stats, fps: measured } }));
      f.frames = 0;
      f.last = now;
    }
  });

  return (
    <group ref={outer}>
      <group ref={inner} scale={SCALE}>
        <mesh geometry={geometry} castShadow receiveShadow frustumCulled={false}>
          <meshPhysicalMaterial
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            roughness={look.roughness}
            metalness={0}
            sheen={look.sheen}
            sheenRoughness={0.85}
            sheenColor={new THREE.Color("#fffdf6")}
            normalMap={textures.normalMap}
            normalScale={new THREE.Vector2(look.normalScale, look.normalScale)}
            roughnessMap={textures.roughnessMap}
            envMapIntensity={look.envIntensity}
            wireframe={look.showWireframe}
            onBeforeCompile={twoSidedPaper}
            customProgramCacheKey={twoSidedPaperKey}
          />
        </mesh>
      </group>
    </group>
  );
}
