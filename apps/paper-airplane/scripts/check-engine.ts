import { buildTimeline, stateSummary, maxLayer } from "../src/lib/fold";
import { dart } from "../src/lib/planes/dart";
import { DEFAULT_MESH_OPTIONS } from "../src/lib/paperMesh";

const states = buildTimeline(dart, DEFAULT_MESH_OPTIONS.thickness);
const sheetArea = dart.paper.width * dart.paper.height;

console.log(`sheet area ${sheetArea.toFixed(1)} mm^2\n`);
states.forEach((s, i) => {
  const sum = stateSummary(s);
  const label = i === 0 ? "flat sheet" : `after "${dart.steps[i - 1].title}"`;
  const drift = Math.abs(sum.area - sheetArea);
  console.log(
    `${String(i).padStart(2)} ${label.padEnd(42)} faces=${String(sum.faces).padStart(3)}` +
      ` maxLayer=${String(sum.maxLayer).padStart(2)}` +
      ` areaDrift=${drift.toExponential(2)}`,
  );
  console.log(`   layers: ${sum.layerHistogram.map(([l, n]) => `${l}:${n}`).join(" ")}`);
});

const final = states[states.length - 1];
const problems: string[] = [];
for (const s of states) {
  const drift = Math.abs(stateSummary(s).area - sheetArea);
  if (drift > 1e-6 * sheetArea) problems.push(`area drift ${drift}`);
}
if (maxLayer(final) < 4) problems.push(`expected a deep stack, got maxLayer ${maxLayer(final)}`);
console.log(problems.length ? `\nFAIL\n${problems.join("\n")}` : "\nOK: paper is conserved and the stack is deep");
if (problems.length) process.exitCode = 1;

// Paper space and model space must round-trip exactly, or the fibre texture
// slides across the sheet as it folds.
import { applyIso, invertIso } from "../src/lib/geom";
{
  let worst = 0;
  for (const state of states) {
    for (const f of state.faces) {
      const back = invertIso(f.xf);
      for (const p of f.poly) {
        const q = applyIso(back, applyIso(f.xf, p));
        worst = Math.max(worst, Math.hypot(q.x - p.x, q.y - p.y));
      }
    }
  }
  console.log(
    worst < 1e-9
      ? `paper/model round-trip exact (max error ${worst.toExponential(2)} mm)`
      : `FAIL: round-trip error ${worst}`,
  );
  if (worst >= 1e-9) process.exitCode = 1;
}
