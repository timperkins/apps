/**
 * Every folded edge must carry a band along its whole length.
 *
 * A crease is drawn by joining the two halves the fold separated, but a flap
 * lands short of the crease it turned about by the paper it wrapped, and on a
 * corner that shortens its half of the crease at both ends. Pairing covers only
 * the part the two halves share, so the folded edge used to stop short of the
 * corner and run on as a bare knife edge. The stub is as long as the crease
 * allowance, which grows with the sheet's thickness, so the thicker the paper
 * the more obvious the break.
 *
 * `creaseStubMm` is how much folded edge is drawn by carrying a round on past
 * the overlap, and `creaseGapMm` is the longest single stretch still left bare.
 * The second has to stay near zero at every thickness the tuning panel offers.
 */
import { buildTimeline } from "../src/lib/fold";
import { buildFlatMesh, DEFAULT_MESH_OPTIONS } from "../src/lib/paperMesh";
import { dart } from "../src/lib/planes/dart";

/** The ends of the panel's thickness slider, and the default in between. */
const THICKNESSES = [0.05, 0.3, 1.0, 2.0, 3.0];
/**
 * A stub shorter than this is narrower than the seam between two abutting
 * walls, so no geometry is built for it and none is missed.
 */
const TOLERANCE = 0.05;

let worstGap = 0;
console.log("thickness  step  crease edges   carried on      longest bare");
for (const thickness of THICKNESSES) {
  const o = { ...DEFAULT_MESH_OPTIONS, thickness };
  const states = buildTimeline(dart, thickness);
  for (let i = 0; i < dart.steps.length; i++) {
    const { stats } = buildFlatMesh(states[i], dart.steps[i], o);
    worstGap = Math.max(worstGap, stats.creaseGapMm);
    console.log(
      `${thickness.toFixed(2).padStart(9)}  ${String(i + 1).padStart(4)}  ` +
        `${String(stats.creaseEdges).padStart(12)}  ` +
        `${stats.creaseStubMm.toFixed(2).padStart(11)} mm  ` +
        `${stats.creaseGapMm.toFixed(3).padStart(9)} mm` +
        (stats.creaseGapMm > TOLERANCE ? "   <- bare folded edge" : ""),
    );
  }
}

console.log(`\nlongest folded edge left bare: ${worstGap.toFixed(3)} mm`);
if (worstGap > TOLERANCE) {
  console.log("FAIL: a folded edge is drawn without its band");
  process.exit(1);
}
console.log("every folded edge carries its band from end to end");
