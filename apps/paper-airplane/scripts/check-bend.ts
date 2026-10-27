/**
 * Numeric checks on the bend map. The fold engine is exact; the renderer is an
 * approximation, so these assert the properties we actually rely on: the paper
 * does not stretch, a full fold really lands flat, and normals stay square to
 * the surface.
 */
import { applyBend, FlatMesh } from "../src/lib/paperMesh";
import { lineFromPointDir, v2 } from "../src/lib/geom";

// A strip of paper running away from a fold line along +x, at one layer height.
function strip(samples: number[], d: number, target: number, dMaxPlus: number): FlatMesh {
  const n = samples.length;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  samples.forEach((s, i) => {
    pos[i * 3] = s;
    pos[i * 3 + 1] = d;
    pos[i * 3 + 2] = 0;
    nrm[i * 3 + 1] = 1;
  });
  return {
    count: n,
    pos,
    nrm,
    off: new Float32Array(n),
    drop: new Float32Array(n),
    ref: new Float32Array(n).fill(dMaxPlus),
    colBack: new Float32Array(n * 3),
    uv: new Float32Array(n * 2),
    col: new Float32Array(n * 3),
    op: Int8Array.from(samples.map(() => 0)),
    sgn: Int8Array.from(samples.map(() => 1)),
    ops: [
      {
        // The line x = 0, oriented so the moving side is +x.
        line: lineFromPointDir(v2(0, 0), v2(0, -1)),
        target,
        dMaxPlus,
        dMinMinus: 0,
      },
    ],
    stats: {
      faces: 1,
      triangles: 0,
      rolls: 0,
      walls: 0,
      creaseEdges: 0,
      creaseStubMm: 0,
      creaseGapMm: 0,
      faceVertices: 0,
      buildMs: 0,
    },
  };
}

const fails: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  if (!ok) fails.push(`${name}: ${detail}`);
  console.log(`${ok ? "pass" : "FAIL"}  ${name.padEnd(46)} ${detail}`);
};

const BAND = 8;
const samples: number[] = [];
for (let s = 0; s <= 120; s += 0.25) samples.push(s);

// 1. At rest the map is the identity.
{
  const m = strip(samples, 0, 180, 0);
  const p = new Float32Array(m.count * 3);
  const nOut = new Float32Array(m.count * 3);
  applyBend(m, 0, BAND, p, nOut);
  let worst = 0;
  for (let i = 0; i < m.count * 3; i++) worst = Math.max(worst, Math.abs(p[i] - m.pos[i]));
  check("t=0 leaves the paper flat", worst < 1e-6, `max drift ${worst.toExponential(2)} mm`);
}

// 2. Arc length is preserved: the bent strip is exactly as long as the flat one.
for (const t of [0.25, 0.5, 0.75, 1]) {
  const m = strip(samples, 0, 180, 0);
  const p = new Float32Array(m.count * 3);
  const nOut = new Float32Array(m.count * 3);
  applyBend(m, t, BAND, p, nOut);
  let len = 0;
  for (let i = 1; i < m.count; i++) {
    len += Math.hypot(p[i * 3] - p[(i - 1) * 3], p[i * 3 + 1] - p[(i - 1) * 3 + 1]);
  }
  const err = Math.abs(len - samples[samples.length - 1]);
  check(`arc length preserved at t=${t}`, err < 0.02, `error ${err.toFixed(4)} mm over 120 mm`);
}

// 3. A finished 180 degree fold lands the far paper flat, facing back.
{
  const m = strip(samples, 0, 180, 0);
  const p = new Float32Array(m.count * 3);
  const nOut = new Float32Array(m.count * 3);
  applyBend(m, 1, BAND, p, nOut);
  const last = m.count - 1;
  const height = p[last * 3 + 1];
  const expectedHeight = 2 * (BAND / Math.PI);
  const x = p[last * 3];
  const expectedX = -(samples[last] - BAND);
  check(
    "180 deg fold lands one crease diameter up",
    Math.abs(height - expectedHeight) < 1e-4,
    `y=${height.toFixed(4)} expected ${expectedHeight.toFixed(4)}`,
  );
  check(
    "180 deg fold lands mirrored, short by the crease",
    Math.abs(x - expectedX) < 1e-4,
    `x=${x.toFixed(3)} expected ${expectedX.toFixed(3)}`,
  );
  check(
    "far paper is upside down",
    Math.abs(nOut[last * 3 + 1] + 1) < 1e-5,
    `normal.y=${nOut[last * 3 + 1].toFixed(6)}`,
  );
}

// 4. Normals stay unit length and square to the surface. The comparison uses a
//    finite difference, so it is run at two sample spacings: a correct normal
//    makes the measured error shrink as the spacing shrinks.
{
  const measure = (h: number) => {
    const fine: number[] = [];
    for (let s = 0; s <= 120; s += h) fine.push(s);
    const m = strip(fine, 0, 180, 0);
    const p = new Float32Array(m.count * 3);
    const nOut = new Float32Array(m.count * 3);
    applyBend(m, 0.5, BAND, p, nOut);
    let worstLen = 0;
    let worstDot = 0;
    for (let i = 1; i + 1 < m.count; i++) {
      const nx = nOut[i * 3];
      const ny = nOut[i * 3 + 1];
      const nz = nOut[i * 3 + 2];
      worstLen = Math.max(worstLen, Math.abs(Math.hypot(nx, ny, nz) - 1));
      const tx = p[(i + 1) * 3] - p[(i - 1) * 3];
      const ty = p[(i + 1) * 3 + 1] - p[(i - 1) * 3 + 1];
      const tl = Math.hypot(tx, ty) || 1;
      worstDot = Math.max(worstDot, Math.abs((nx * tx + ny * ty) / tl));
    }
    return { worstLen, worstDot };
  };
  const coarse = measure(0.25);
  const fine = measure(0.025);
  check("normals stay unit length", coarse.worstLen < 1e-5, `max error ${coarse.worstLen.toExponential(2)}`);
  check(
    "normals stay square to the paper",
    fine.worstDot < 2e-3 && fine.worstDot < coarse.worstDot / 4,
    `|dot| ${coarse.worstDot.toExponential(2)} at 0.25 mm, ${fine.worstDot.toExponential(2)} at 0.025 mm`,
  );
}

// 5. A stack does not stretch: every layer keeps its own length.
{
  const dMax = 15 * 0.22;
  for (const d of [0, dMax / 2, dMax]) {
    const m = strip(samples, d, 180, dMax);
    const p = new Float32Array(m.count * 3);
    const nOut = new Float32Array(m.count * 3);
    applyBend(m, 1, BAND, p, nOut);
    let len = 0;
    for (let i = 1; i < m.count; i++) {
      len += Math.hypot(p[i * 3] - p[(i - 1) * 3], p[i * 3 + 1] - p[(i - 1) * 3 + 1]);
    }
    const err = Math.abs(len - samples[samples.length - 1]);
    check(
      `layer at ${d.toFixed(2)} mm keeps its length`,
      err < 0.02,
      `error ${err.toFixed(4)} mm, edge lands at x=${p[(m.count - 1) * 3].toFixed(2)}`,
    );
  }
}

console.log(fails.length ? `\n${fails.length} FAILURES` : "\nall bend checks pass");
process.exit(fails.length ? 1 : 0);
