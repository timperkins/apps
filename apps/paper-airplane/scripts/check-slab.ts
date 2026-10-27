/**
 * A sheet is a slab, and folding it over turns it over.
 *
 * The bend maps the middle of each sheet and carries its two sides half a
 * thickness either side of that, along the paper's own normal. Three things
 * follow, and all three are visible the moment the thickness slider is raised:
 *
 *  - the sheet keeps its thickness the whole way round the crease,
 *  - a flap that folds over arrives with the side that was uppermost
 *    underneath, which is what turning paper over means, and
 *  - it comes to rest on the sheet below, the two sides that were facing each
 *    other now touching, rather than floating a thickness above it.
 *
 * The last one is what fixes the fold in place. Measuring the arc from the top
 * of the moving stack rather than from the middle of its top sheet lifts the
 * whole fold half a thickness, and then the sheet's upper side rolls round the
 * outside of the crease and stays uppermost: the paper reads as bent rather
 * than folded.
 */
import { buildTimeline } from "../src/lib/fold";
import { applyBend, bandAt, buildFlatMesh, DEFAULT_MESH_OPTIONS } from "../src/lib/paperMesh";
import { dart } from "../src/lib/planes/dart";

const fails: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  if (!ok) fails.push(`${name}: ${detail}`);
  console.log(`${ok ? "pass" : "FAIL"}  ${name.padEnd(48)} ${detail}`);
};

/** The ends of the panel's thickness slider, and the default in between. */
const THICKNESSES = [0.05, 0.3, 1.0, 3.0];

/**
 * Face triangles are emitted in sixes: one triangle for the upper side of the
 * slab and the same triangle again for the lower one, so the two vertices that
 * are the same point of the sheet are three apart.
 */
const partnerOf = (i: number): number => Math.floor(i / 6) * 6 + ((i + 3) % 6);

for (const thickness of THICKNESSES) {
  const o = { ...DEFAULT_MESH_OPTIONS, thickness };
  const states = buildTimeline(dart, thickness);

  // 1. The slab keeps its thickness, flat, mid-fold and pressed.
  let worstSquash = 0;
  for (let s = 0; s < dart.steps.length; s++) {
    const flat = buildFlatMesh(states[s], dart.steps[s], o);
    const pos = new Float32Array(flat.count * 3);
    const nrm = new Float32Array(flat.count * 3);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      applyBend(flat, t, bandAt(t, o), pos, nrm);
      for (let i = 0; i < flat.stats.faceVertices; i++) {
        const j = partnerOf(i);
        const gap = Math.hypot(
          pos[i * 3] - pos[j * 3],
          pos[i * 3 + 1] - pos[j * 3 + 1],
          pos[i * 3 + 2] - pos[j * 3 + 2],
        );
        worstSquash = Math.max(worstSquash, Math.abs(gap - thickness));
      }
    }
  }
  check(
    `t=${thickness}: the sheet keeps its thickness`,
    worstSquash < 1e-3,
    `worst ${worstSquash.toExponential(2)} mm out of ${thickness} mm`,
  );

  // 2. and 3. are measured on the first fold, where a single sheet folds onto
  //    itself and the answer is not tangled up with the rest of the stack.
  const flat = buildFlatMesh(states[0], dart.steps[0], o);
  const pos = new Float32Array(flat.count * 3);
  const nrm = new Float32Array(flat.count * 3);
  applyBend(flat, 1, bandAt(1, o), pos, nrm);

  let worstTurn = 0;
  let restsAt = Infinity;
  let topAt = -Infinity;
  let table = -Infinity;
  for (let i = 0; i < flat.stats.faceVertices; i++) {
    const up = flat.off[i] > 0;
    const y = pos[i * 3 + 1];
    if (flat.sgn[i] === 0) {
      // The sheet the flap lands on: its upper side is the surface they meet at.
      if (up) table = Math.max(table, y);
      continue;
    }
    if (!up) continue;
    // Paper still inside the crease has not turned the whole way yet; the flap
    // proper has, and every normal on it now points the opposite way.
    if (nrm[i * 3 + 1] * flat.nrm[i * 3 + 1] > -0.999) continue;
    const j = partnerOf(i);
    // The side that was up is a thickness below the other one.
    worstTurn = Math.max(worstTurn, Math.abs(pos[j * 3 + 1] - y - thickness));
    restsAt = Math.min(restsAt, y);
    topAt = Math.max(topAt, pos[j * 3 + 1]);
  }
  check(
    `t=${thickness}: folding over turns the sheet over`,
    worstTurn < 1e-3,
    `worst ${worstTurn.toExponential(2)} mm`,
  );
  check(
    `t=${thickness}: the flap rests on the sheet below`,
    Math.abs(restsAt - table) < 1e-3 && Math.abs(topAt - table - thickness) < 1e-3,
    `meets at ${restsAt.toFixed(4)}, sheet at ${table.toFixed(4)},` +
      ` back at ${topAt.toFixed(4)}, expected ${(table + thickness).toFixed(4)}`,
  );
}

console.log(fails.length ? `\n${fails.length} FAILURES` : "\nthe paper folds like a slab of paper");
process.exit(fails.length ? 1 : 0);
