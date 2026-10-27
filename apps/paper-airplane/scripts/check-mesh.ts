import { buildTimeline } from "../src/lib/fold";
import {
  applyBend,
  bandAt,
  buildFlatMesh,
  DEFAULT_MESH_OPTIONS,
  layerHeights,
} from "../src/lib/paperMesh";
import { dart } from "../src/lib/planes/dart";

const opts = DEFAULT_MESH_OPTIONS;
const states = buildTimeline(dart, opts.thickness);
let worstBuild = 0;
let worstBend = 0;
let problems = 0;

for (let i = 0; i < dart.steps.length; i++) {
  const flat = buildFlatMesh(states[i], dart.steps[i], opts);
  const buildMs = flat.stats.buildMs;
  worstBuild = Math.max(worstBuild, buildMs);

  const pos = new Float32Array(flat.count * 3);
  const nrm = new Float32Array(flat.count * 3);
  const t1 = performance.now();
  const N = 60;
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1);
    applyBend(flat, t, bandAt(t, opts), pos, nrm);
  }
  const bendMs = (performance.now() - t1) / N;
  worstBend = Math.max(worstBend, bendMs);

  let bad = 0;
  for (let j = 0; j < pos.length; j++) if (!Number.isFinite(pos[j]) || !Number.isFinite(nrm[j])) bad++;
  if (bad) problems++;

  // The face triangles tile the whole sheet twice over, once for each side of
  // it. Any shortfall is a hole, which shows up in the render as light leaking
  // through the paper.
  let meshArea = 0;
  for (let v = 0; v < flat.stats.faceVertices; v += 3) {
    const g = (k: number, c: number) => flat.pos[(v + k) * 3 + c];
    const ax = g(1, 0) - g(0, 0);
    const az = g(1, 2) - g(0, 2);
    const bx = g(2, 0) - g(0, 0);
    const bz = g(2, 2) - g(0, 2);
    meshArea += Math.abs(ax * bz - az * bx) / 2;
  }
  // The flat faces tile the sheet apart from the paper wrapped into creases.
  const sheetArea = dart.paper.width * dart.paper.height - states[i].rolledArea;
  const lost = sheetArea - meshArea / 2;
  if (lost > 0.5) problems++;

  console.log(
    `step ${i + 1} ${dart.steps[i].title.padEnd(38)}` +
      ` faces=${String(flat.stats.faces).padStart(3)}` +
      ` creaseEdges=${String(flat.stats.creaseEdges).padStart(3)}` +
      ` rolls=${String(flat.stats.rolls).padStart(3)}` +
      ` tris=${String(flat.stats.triangles).padStart(5)}` +
      ` verts=${String(flat.count).padStart(5)}` +
      ` build=${buildMs.toFixed(1)}ms bend=${bendMs.toFixed(2)}ms` +
      ` lostArea=${lost.toFixed(3)}mm2` +
      (bad ? ` NON-FINITE=${bad}` : ""),
  );
}

console.log(
  `\nworst rebuild ${worstBuild.toFixed(1)} ms, worst per-frame bend ${worstBend.toFixed(2)} ms` +
    ` (budget 16.7 ms/frame)`,
);

// Layers must stay far enough apart to avoid z-fighting, and the deepest stack
// must not balloon into something that reads as corrugated board.
{
  const deepest = states[states.length - 1].faces.reduce((m, f) => Math.max(m, f.layer), 0);
  const { height, gap } = layerHeights(opts, deepest);
  const total = height[deepest];
  console.log(
    `layers: ${deepest + 1} deep, gap ${gap[0].toFixed(2)} mm, total ${total.toFixed(2)} mm`,
  );
  if (gap[0] < 0.099) {
    console.log("FAIL: layers too close, they will z-fight");
    problems++;
  }
  if (total > 14) {
    console.log("FAIL: the deepest stack is thicker than paper should ever look");
    problems++;
  }
}
if (problems) console.log("FAIL: non-finite vertices or holes in the paper");
process.exit(problems ? 1 : 0);
