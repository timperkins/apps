import * as THREE from 'three';
import type { ProjKind } from '../core/config';
import { M, bake, canvasTex, cap, cyl, mesh, rbox, sph } from './materials';

/** Meshes for everything that can be picked up or thrown. Each builder returns a fresh group. */

const metal = () => M('#c9ccd4', { metal: 0.7, rough: 0.3 });

function g(...parts: THREE.Object3D[]): THREE.Group {
  const grp = new THREE.Group();
  for (const p of parts) grp.add(p);
  return grp;
}
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

let stopTex: THREE.Texture | null = null;

const BUILDERS: Record<string, () => THREE.Group> = {
  bat: () => g(at(mesh(cyl(0.055, 0.022, 0.85, 12), M('#d7a26a', { rough: 0.5 })), 0, 0.4, 0), at(mesh(cyl(0.028, 0.028, 0.18, 10), M('#222222')), 0, 0.04, 0), at(mesh(cyl(0.036, 0.036, 0.03, 10), M('#7a4a2a')), 0, -0.05, 0)),
  lunchbox: () => g(mesh(rbox(0.34, 0.24, 0.15, 0.04), M('#2fc4b0', { rough: 0.4 })), at(mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 12, Math.PI), M('#222222')), 0, 0.12, 0)),
  skateboard: () => {
    const grp = g(mesh(rbox(0.22, 0.03, 0.8, 0.015), M('#ff4f6a', { rough: 0.5 })));
    for (const z of [-0.27, 0.27]) for (const x of [-0.08, 0.08]) grp.add(at(mesh(cyl(0.035, 0.035, 0.04, 10), M('#ffe04a', { rough: 0.4 })), x, -0.05, z, 0, 0, Math.PI / 2));
    return grp;
  },
  lid: () => g(at(mesh(cyl(0.3, 0.3, 0.04, 20), M('#9aaab8', { metal: 0.6, rough: 0.35 })), 0, 0, 0), at(mesh(rbox(0.12, 0.04, 0.04, 0.015), M('#7a8a98', { metal: 0.6 })), 0, 0.04, 0)),
  balloons: () => g(balloon('#3fa9ff', 0, 0), balloon('#ff5a8a', 0.16, 0.05), balloon('#ffd23f', -0.1, 0.12)),
  noodle: () => g(at(mesh(cyl(0.05, 0.05, 1.2, 12), M('#ff7ad8', { rough: 0.7 })), 0, 0.5, 0)),
  backpack: () => g(mesh(rbox(0.32, 0.38, 0.18, 0.07), M('#ffb020')), at(mesh(rbox(0.22, 0.14, 0.06, 0.03), M('#ffb020')), 0, -0.07, 0.11)),
  chicken: () => g(at(mesh(cap(0.06, 0.32), M('#ffd84a', { rough: 0.45 })), 0, 0.2, 0, 0.3), at(mesh(sph(0.06, 10, 8), M('#ffd84a', { rough: 0.45 })), 0, 0.42, 0.06), at(mesh(new THREE.ConeGeometry(0.025, 0.07, 6), M('#ff7a1a')), 0, 0.42, 0.13, Math.PI / 2), at(mesh(sph(0.03, 8, 6), M('#e8262b')), 0, 0.48, 0.05)),
  blower: () => g(mesh(rbox(0.28, 0.24, 0.22, 0.06), M('#ff8a1a', { rough: 0.45 })), at(mesh(cyl(0.05, 0.07, 0.7, 12), M('#3a3a42', { rough: 0.5 })), 0, 0.25, 0.2, Math.PI / 2.6), at(mesh(rbox(0.06, 0.12, 0.06, 0.02), M('#222222')), 0, 0.17, -0.05)),
  finger: () => g(mesh(rbox(0.3, 0.32, 0.12, 0.06), M('#2f6fff', { rough: 0.7 })), at(mesh(cap(0.06, 0.32), M('#2f6fff', { rough: 0.7 })), 0.04, 0.32, 0), at(mesh(cyl(0.06, 0.07, 0.25, 12), M('#2f6fff', { rough: 0.7 })), 0, -0.25, 0)),
  confetti: () => g(at(mesh(cyl(0.08, 0.12, 0.6, 14), M('#7a3aff', { rough: 0.4 })), 0, 0.3, 0), at(mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), M('#ffd23f', { metal: 0.5, rough: 0.3 })), 0, 0.6, 0, Math.PI / 2), at(mesh(rbox(0.05, 0.14, 0.05, 0.02), M('#222222')), 0, 0.05, 0.1)),
  apple: () => g(mesh(sph(0.12, 16, 12), M('#d8262b', { rough: 0.35 })), at(mesh(cyl(0.01, 0.01, 0.06, 6), M('#5a3a20')), 0, 0.13, 0), at(mesh(sph(0.04, 8, 6), M('#4fbf3a')), 0.04, 0.14, 0)),
  pizza: () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.18, 0.4);
    shape.quadraticCurveTo(0, 0.46, -0.18, 0.4);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
    const grp = g(at(mesh(geo, M('#ffc23a', { rough: 0.6 })), 0, 0, 0, -Math.PI / 2));
    for (const [x, z] of [[0, -0.18], [0.06, -0.3], [-0.06, -0.3]]) grp.add(at(mesh(cyl(0.035, 0.035, 0.02, 10), M('#c8262b')), x, 0.035, z));
    grp.add(at(mesh(cap(0.03, 0.33), M('#d88a3a', { rough: 0.7 })), 0, 0.02, -0.42, 0, 0, Math.PI / 2));
    return grp;
  },
  burger: () => {
    const bun = M('#e09a45', { rough: 0.6 });
    return g(at(mesh(sph(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bun), 0, 0.04, 0), mesh(cyl(0.16, 0.16, 0.06, 16), M('#6a3a22')), at(mesh(rbox(0.3, 0.02, 0.3, 0.01), M('#ffcf3a')), 0, 0.035, 0, 0, 0.7), at(mesh(cyl(0.18, 0.18, 0.02, 10), M('#5fc24a')), 0, -0.035, 0), at(mesh(cyl(0.16, 0.15, 0.05, 16), bun), 0, -0.07, 0));
  },
  potato: () => g(at(mesh(sph(0.14, 12, 10), M('#f4ead0', { rough: 0.9 })), 0, 0, 0), at(mesh(sph(0.05, 8, 6), M('#ffd84a', { rough: 0.3 })), 0, 0.11, 0)),
  tray: () => g(mesh(rbox(0.5, 0.03, 0.34, 0.02), M('#ff8a5a', { rough: 0.5 }))),
  dodgeball: () => g(mesh(sph(0.17, 18, 14), M('#e8344a', { rough: 0.45 }))),
  cone: () => g(at(mesh(new THREE.ConeGeometry(0.18, 0.5, 18), M('#ff7a1a', { rough: 0.5 })), 0, 0.28, 0), at(mesh(cyl(0.11, 0.13, 0.07, 18), M('#ffffff')), 0, 0.3, 0), mesh(rbox(0.4, 0.05, 0.4, 0.02), M('#ff7a1a'))),
  gnome: () => g(at(mesh(cap(0.1, 0.12), M('#3a6ad8')), 0, 0.12, 0), at(mesh(sph(0.08, 12, 10), M('#f4c8a8', { skin: true })), 0, 0.3, 0), at(mesh(new THREE.ConeGeometry(0.1, 0.25, 12), M('#d8262b')), 0, 0.45, 0), at(mesh(new THREE.ConeGeometry(0.09, 0.16, 10), M('#f4f4f4')), 0, 0.22, 0.06, Math.PI)),
  pretzel: () => {
    const grp = g();
    for (const s of [-1, 1]) grp.add(at(mesh(new THREE.TorusGeometry(0.08, 0.03, 8, 16), M('#b8702a', { rough: 0.5 })), s * 0.07, 0, 0, 0, 0, s * 0.4));
    grp.add(at(mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 16, Math.PI), M('#b8702a', { rough: 0.5 })), 0, -0.03, 0, 0, 0, Math.PI));
    return grp;
  },
  slip: () => g(mesh(rbox(0.3, 0.01, 0.2, 0.004), M('#ff9ac0', { rough: 0.9 }))),
  cabinet: () => {
    const grp = g(mesh(rbox(0.55, 0.9, 0.55, 0.03), M('#8a95a3', { metal: 0.5, rough: 0.4 })));
    for (const y of [-0.28, 0, 0.28]) grp.add(at(mesh(rbox(0.16, 0.04, 0.03, 0.01), M('#3a3a42')), 0, y, 0.29));
    return grp;
  },
  confettiShot: () => {
    const grp = g();
    const cols = ['#ff4a3d', '#ffd23f', '#3a9aff', '#2fd17a', '#ff5fb0'];
    for (let i = 0; i < 10; i++) grp.add(at(mesh(rbox(0.07, 0.07, 0.01, 0.005), M(cols[i % cols.length], { plain: true }), false), (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, Math.random() * 3, Math.random() * 3));
    return grp;
  },
  stopsign: () => {
    stopTex ??= canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#d6202a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124);
      }
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '86px "Lilita One", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STOP', 128, 136);
    });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.28, 8), new THREE.MeshStandardMaterial({ map: stopTex, roughness: 0.5 }));
    face.rotation.z = Math.PI / 8;
    face.position.set(0, 1.3, 0.02);
    face.userData.keep = true;
    return g(at(mesh(cyl(0.022, 0.022, 1.3, 8), M('#dddddd', { metal: 0.5 })), 0, 0.6, 0), at(mesh(cyl(0.29, 0.29, 0.03, 8), M('#b01820')), 0, 1.3, 0, Math.PI / 2, Math.PI / 8), face);
  },
  ladle: () => g(at(mesh(cyl(0.014, 0.014, 0.45, 8), metal()), 0, 0.2, 0), at(mesh(sph(0.08, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal()), 0, 0.44, 0)),
  spatula: () => g(at(mesh(cyl(0.02, 0.02, 0.45, 8), M('#333333')), 0, 0.2, 0), at(mesh(rbox(0.14, 0.16, 0.015, 0.01), metal()), 0, 0.48, 0)),
  ruler: () => g(at(mesh(rbox(0.12, 1.3, 0.025, 0.01), M('#e8c86a', { rough: 0.6 })), 0, 0.55, 0)),
  clipboard: () => g(mesh(rbox(0.26, 0.34, 0.02, 0.01), M('#a8783a')), at(mesh(rbox(0.22, 0.28, 0.005, 0.002), M('#f4f4f4', { plain: true })), 0, -0.01, 0.013)),
  purse: () => g(mesh(rbox(0.26, 0.2, 0.1, 0.05), M('#d84a8a', { rough: 0.4 })), at(mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), M('#d84a8a')), 0, 0.1, 0)),
  baton: () => g(at(mesh(cyl(0.025, 0.03, 0.5, 8), M('#151515', { rough: 0.4 })), 0, 0.2, 0)),
};

function balloon(c: string, x: number, z: number): THREE.Mesh {
  const m = mesh(sph(0.11, 14, 12), M(c, { rough: 0.15, plain: true }));
  m.scale.set(1, 1.15, 1);
  m.position.set(x, 0.05, z);
  return m;
}

export function buildProp(kind: ProjKind | string): THREE.Group {
  const b = BUILDERS[kind] ?? BUILDERS.dodgeball;
  const grp = b();
  bake(grp, true);
  return grp;
}

/** How a held item sits in the hand: rotation so the business end points forward/up. */
export const GRIP: Record<string, [number, number, number]> = {
  bat: [1.6, 0, 0],
  noodle: [1.6, 0, 0],
  finger: [1.4, 0, 0],
  lid: [0, 0, Math.PI / 2],
  skateboard: [0, 0, Math.PI / 2],
  blower: [0.2, 0, 0],
  confetti: [1.5, 0, 0],
  chicken: [1.5, 0, 0],
};
