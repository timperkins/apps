/**
 * Which faces are visible from above, and how much of each shows.
 *
 * A face that folds over is supposed to end up under the face it folded with,
 * so a sliver of an inner layer peeking out means the stacking is wrong.
 */
import { buildTimeline, faceWorldPoly } from "../src/lib/fold";
import { dart } from "../src/lib/planes/dart";
import { polyArea, V2 } from "../src/lib/geom";
import { DEFAULT_MESH_OPTIONS } from "../src/lib/paperMesh";

function pointInPoly(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

const states = buildTimeline(dart, DEFAULT_MESH_OPTIONS.thickness);
for (let si = 1; si < states.length; si++) {
  const faces = states[si].faces;
  const worlds = faces.map(faceWorldPoly);
  const exposed = new Map<number, number>();

  faces.forEach((face, i) => {
    const poly = worlds[i];
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const N = 60;
    let inCount = 0;
    let openCount = 0;
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        const p = {
          x: minX + ((a + 0.5) / N) * (maxX - minX),
          y: minY + ((b + 0.5) / N) * (maxY - minY),
        };
        if (!pointInPoly(p, poly)) continue;
        inCount++;
        const covered = faces.some(
          (g, j) => j !== i && g.layer > face.layer && pointInPoly(p, worlds[j]),
        );
        if (!covered) openCount++;
      }
    }
    if (!inCount) return;
    const area = Math.abs(polyArea(poly));
    const open = (area * openCount) / inCount;
    exposed.set(face.layer, (exposed.get(face.layer) ?? 0) + open);
  });

  const rows = [...exposed.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([layer, area]) => `L${layer}:${area.toFixed(0)}`)
    .join(" ");
  console.log(`after "${dart.steps[si - 1].title}"`.padEnd(44) + ` visible mm^2 by layer  ${rows}`);
}
