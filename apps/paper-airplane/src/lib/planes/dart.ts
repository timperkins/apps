/**
 * The classic dart, written directly against the engine's op types.
 *
 * M1 replaces this with data-driven JSON plus resolved fold-line constructions.
 * Until then the lines are spelled out so the spike has real multi-layer
 * geometry to render rather than a mocked-up stack.
 */

import { Plane } from "../fold";
import { lineThroughPoints, v2 } from "../geom";

const W = 216; // US Letter, millimetres
const H = 279;
const HW = W / 2;
const HH = H / 2;

/** The nose of the sheet, where every early fold line meets. */
const NOSE = v2(0, -HH);

const R22 = (22.5 * Math.PI) / 180;

/** Wing fold: from the nose tip back to a point 26 mm off the spine at the tail. */
const WING_LINE = lineThroughPoints(v2(0, -HH), v2(26, HH));

export const dart: Plane = {
  id: "classic-dart",
  name: "Classic Dart",
  paper: { width: W, height: H },
  steps: [
    {
      id: "corners",
      title: "Fold the top corners to the center",
      text: "Bring each top corner in so its edge meets the middle of the sheet. Both corners fold together.",
      bookmark: true,
      durationMs: 1600,
      ops: [
        {
          kind: "fold",
          line: lineThroughPoints(NOSE, v2(-HW, -HH + HW)),
          movingRef: v2(-60, -120),
          angle: 180,
        },
        {
          kind: "fold",
          line: lineThroughPoints(NOSE, v2(HW, -HH + HW)),
          movingRef: v2(60, -120),
          angle: 180,
        },
      ],
    },
    {
      id: "edges",
      title: "Fold the slanted edges to the center",
      text: "Take the new slanted edges and fold them in to the center line. The nose gets long and sharp.",
      durationMs: 1600,
      ops: [
        {
          kind: "fold",
          line: lineThroughPoints(NOSE, v2(-Math.sin(R22) * 300, -HH + Math.cos(R22) * 300)),
          movingRef: v2(-40, -85),
          angle: 180,
        },
        {
          kind: "fold",
          line: lineThroughPoints(NOSE, v2(Math.sin(R22) * 300, -HH + Math.cos(R22) * 300)),
          movingRef: v2(40, -85),
          angle: 180,
        },
      ],
    },
    {
      id: "half",
      title: "Fold the plane in half",
      text: "Fold along the center line so the two halves meet. Everything folded so far stacks up at the nose.",
      bookmark: true,
      durationMs: 1800,
      ops: [
        {
          kind: "fold",
          line: lineThroughPoints(v2(0, -HH), v2(0, HH)),
          movingRef: v2(-50, 0),
          angle: 180,
          tag: "halfA",
        },
      ],
    },
    {
      id: "wings",
      title: "Fold the wings down",
      text: "Fold both wings down against the body. One fold through the whole stack makes both wings at once.",
      durationMs: 1800,
      ops: [
        {
          kind: "fold",
          line: WING_LINE,
          movingRef: v2(60, 0),
          angle: 180,
          tag: "wing",
        },
      ],
    },
    {
      id: "open",
      title: "Open the wings",
      text: "Hold the body and lift the wings level. The dart is ready to throw.",
      bookmark: true,
      durationMs: 1400,
      roll: 90,
      ops: [
        {
          kind: "rotate",
          line: WING_LINE,
          modelRef: v2(5, 0),
          angle: 90,
          requireTag: "wing",
          signTag: "halfA",
        },
      ],
    },
  ],
};
