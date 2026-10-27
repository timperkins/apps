"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { PaperModel } from "./PaperModel";
import { useApp } from "@/lib/store";

/**
 * A small studio: a soft key light with a real shadow, fill and rim panels built
 * from light emitters rather than a downloaded environment map, and a table for
 * the paper to sit on. Nothing here is fetched, so the scene works offline.
 */
export default function Scene() {
  const look = useApp((s) => s.look);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [3.0, 3.4, 5.0], fov: 30, near: 0.05, far: 60 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl, scene }) => {
        gl.toneMappingExposure = look.exposure;
        scene.background = new THREE.Color("#6f6b64");
      }}
    >
      <Exposure value={look.exposure} />

      <directionalLight
        castShadow
        position={[2.6, 4.2, 1.8]}
        intensity={look.keyIntensity}
        color="#fff6e8"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      {/* Fill from the shaded side, so the back of the paper still reads white. */}
      <directionalLight
        position={[-3.0, 1.6, -2.4]}
        intensity={look.keyIntensity * 0.34}
        color="#f2f0ee"
      />
      <ambientLight intensity={0.22} color="#dcdfe6" />

      <Environment resolution={256} frames={1}>
        <Lightformer
          intensity={1.0}
          color="#ffffff"
          position={[0, 5, -2]}
          rotation-x={Math.PI / 2}
          scale={[9, 9, 1]}
        />
        <Lightformer
          intensity={0.8}
          color="#eaf1ff"
          position={[-5, 2, 2]}
          rotation-y={Math.PI / 2}
          scale={[12, 3, 1]}
        />
        <Lightformer
          intensity={0.7}
          color="#fff2e0"
          position={[5, 1.5, -1]}
          rotation-y={-Math.PI / 2}
          scale={[12, 3, 1]}
        />
        <Lightformer
          intensity={0.25}
          color="#ffffff"
          position={[0, -3, 0]}
          rotation-x={-Math.PI / 2}
          scale={[12, 12, 1]}
        />
      </Environment>

      <PaperModel />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#8d8474" roughness={0.97} metalness={0} />
      </mesh>
      <ContactShadows
        position={[0, 0.0015, 0]}
        scale={9}
        resolution={1024}
        blur={1.8}
        opacity={0.65}
        far={1.2}
        color="#4a453c"
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.8}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={[0, 0.15, 0]}
      />
      <CameraHook />
      <FrameSampler />
    </Canvas>
  );
}

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * Reads back the rendered frame so a script can measure it.
 *
 * Continuity between the last frame of a step and the first of the next is not
 * something screenshots settle by eye; comparing the average of the actual
 * pixels does.
 */
function FrameSampler() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__sampleFrame = () => {
      gl.render(scene, camera);
      const ctx = gl.getContext();
      const width = ctx.drawingBufferWidth;
      const height = ctx.drawingBufferHeight;
      const px = new Uint8Array(width * height * 4);
      ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      // Averaged into a coarse grid: comparing whole frames this way notices a
      // patch of paper changing colour, which a single average would hide.
      const cols = 32;
      const rows = 24;
      const sums = new Float64Array(cols * rows);
      const counts = new Float64Array(cols * rows);
      for (let y = 0; y < height; y++) {
        const gy = Math.min(rows - 1, Math.floor((y / height) * rows));
        for (let x = 0; x < width; x++) {
          const gx = Math.min(cols - 1, Math.floor((x / width) * cols));
          const i = (y * width + x) * 4;
          sums[gy * cols + gx] += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          counts[gy * cols + gx]++;
        }
      }
      const grid = Array.from(sums, (v, i) => v / (counts[i] || 1));
      return { grid, cols, rows, width, height };
    };
    return () => {
      delete w.__sampleFrame;
    };
  }, [gl, scene, camera]);
  return null;
}

/** Lets the screenshot script park the camera for close inspection. */
function CameraHook() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__setCamera = (pos: [number, number, number], target: [number, number, number]) => {
      camera.position.set(...pos);
      if (controls) {
        controls.target.set(...target);
        controls.update();
      }
      camera.lookAt(new THREE.Vector3(...target));
    };
    return () => {
      delete w.__setCamera;
    };
  }, [camera, controls]);
  return null;
}

function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}
