/**
 * How far the geometry moves at a step boundary.
 *
 * The end of one step and the start of the next are the same physical paper, so
 * any difference between them is a visible jump. This measures it without a
 * browser by building both and comparing.
 */
import { buildTimeline } from "../src/lib/fold";
import { applyBend, bandAt, buildFlatMesh, DEFAULT_MESH_OPTIONS } from "../src/lib/paperMesh";
import { dart } from "../src/lib/planes/dart";

const o = DEFAULT_MESH_OPTIONS;
const states = buildTimeline(dart, o.thickness);

/**
 * Only the paper's own surface is compared. Rolled edges and thickness walls
 * are decoration whose extent changes with the crease radius; the eye tracks
 * the sheet.
 */
function posed(stateIndex: number, stepIndex: number, t: number) {
  const flat = buildFlatMesh(states[stateIndex], dart.steps[stepIndex] ?? null, o);
  const pos = new Float32Array(flat.count * 3);
  const nrm = new Float32Array(flat.count * 3);
  applyBend(flat, t, bandAt(t, o), pos, nrm);
  return pos.subarray(0, flat.stats.faceVertices * 3);
}

function bounds(pos: Float32Array) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      lo[c] = Math.min(lo[c], pos[i + c]);
      hi[c] = Math.max(hi[c], pos[i + c]);
    }
  }
  return { lo, hi };
}

console.log("step boundary            axis   end of step -> start of next     jump");
let worst = 0;
for (let i = 0; i < dart.steps.length - 1; i++) {
  const before = bounds(posed(i, i, 1));
  const after = bounds(posed(i + 1, i + 1, 0));
  const label = `${i + 1} -> ${i + 2}`;
  for (const [c, axis] of ["x", "y", "z"].entries()) {
    const d1 = Math.abs(before.lo[c] - after.lo[c]);
    const d2 = Math.abs(before.hi[c] - after.hi[c]);
    const jump = Math.max(d1, d2);
    worst = Math.max(worst, jump);
    if (jump > 0.05) {
      console.log(
        `  ${label.padEnd(22)} ${axis}   ` +
          `[${before.lo[c].toFixed(2)},${before.hi[c].toFixed(2)}] -> ` +
          `[${after.lo[c].toFixed(2)},${after.hi[c].toFixed(2)}]`.padEnd(34) +
          `${jump.toFixed(2)} mm`,
      );
    }
  }
}
console.log(`\nworst jump at a step boundary: ${worst.toFixed(2)} mm`);
