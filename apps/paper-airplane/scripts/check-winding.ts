/**
 * Every triangle's geometric normal (from its winding) must agree with the
 * per-vertex normals we supply. If it does not, double-sided shading flips the
 * normal and the paper lights from the wrong side.
 */
import { buildTimeline } from "../src/lib/fold";
import { buildFlatMesh, DEFAULT_MESH_OPTIONS } from "../src/lib/paperMesh";
import { dart } from "../src/lib/planes/dart";

const states = buildTimeline(dart, DEFAULT_MESH_OPTIONS.thickness);
let faceOk = 0;
let faceBad = 0;
let rollOk = 0;
let rollBad = 0;

for (let i = 0; i < dart.steps.length; i++) {
  const flat = buildFlatMesh(states[i], dart.steps[i], DEFAULT_MESH_OPTIONS);
  for (let t = 0; t < flat.count; t += 3) {
    // Both sides of a sheet, and every wall vertex, are stored at the middle of
    // the sheet and offset when bent, so the offsets have to be applied before
    // the triangle has any area at all.
    const g = (k: number, c: number) =>
      flat.pos[(t + k) * 3 + c] + (c === 1 ? flat.off[t + k] - flat.drop[t + k] : 0);
    const ax = g(1, 0) - g(0, 0);
    const ay = g(1, 1) - g(0, 1);
    const az = g(1, 2) - g(0, 2);
    const bx = g(2, 0) - g(0, 0);
    const by = g(2, 1) - g(0, 1);
    const bz = g(2, 2) - g(0, 2);
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const clen = Math.hypot(cx, cy, cz);
    if (clen / 2 < 1e-4) continue; // degenerate sliver, contributes no shading
    const nx = flat.nrm[t * 3];
    const ny = flat.nrm[t * 3 + 1];
    const nz = flat.nrm[t * 3 + 2];
    const dot = (cx * nx + cy * ny + cz * nz) / clen;
    const isFace = t < flat.stats.faceVertices;
    if (dot > 0.1) {
      if (isFace) faceOk++;
      else rollOk++;
    } else if (isFace) faceBad++;
    else rollBad++;
  }
}

console.log(`faces: ${faceOk} correct, ${faceBad} inverted`);
console.log(`rolled edges: ${rollOk} correct, ${rollBad} inverted`);
const bad = faceBad + rollBad;
console.log(bad ? "FAIL: some triangles are wound against their normal" : "all triangles wound correctly");
process.exit(bad ? 1 : 0);
