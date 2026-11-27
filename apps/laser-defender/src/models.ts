import * as THREE from 'three';
import { Box, VOX, boxesGeometry, mirrorX, part } from './voxel';

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  mat: THREE.MeshLambertMaterial;
  legL?: THREE.Group;
  legR?: THREE.Group;
  armL?: THREE.Group;
  armR?: THREE.Group;
  head?: THREE.Group;
  legs?: THREE.Group[];
  muzzle?: THREE.Object3D;
  /** Colours the model bursts into when it dies. */
  palette: number[];
}

function newMat() {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}

// ---------- Player: the Laser Defender, white armour with cyan power cells ----------
export function playerRig(): Rig {
  const mat = newMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const WHITE = 0xe8edf2, STEEL = 0x55606e, DARK = 0x2a3140, CYAN = 0x3ff4ff, SKIN = 0xd9a074, NAVY = 0x27324a;

  const leg: Box[] = [
    [-3.5, 0, -2, 3, 2, 4, DARK],
    [-3.5, 2, -1.5, 3, 4, 3, NAVY],
    [-3.6, 3, 1.3, 3.2, 1.2, 0.4, CYAN, 1],
  ];
  const legL = part(leg, [-2, 6, 0], mat);
  const legR = part(mirrorX(leg), [2, 6, 0], mat);

  const torso = part(
    [
      [-4, 6, -2.5, 8, 6, 5, WHITE],
      [-4.2, 6, -2.7, 8.4, 1, 5.4, DARK],
      [-1, 8.5, 2.4, 2, 2, 0.4, CYAN, 1],
      [-3, 10, 2.45, 6, 1, 0.3, STEEL],
      // power pack
      [-3, 7, -4.5, 6, 5, 2, STEEL],
      [-2.2, 8, -4.8, 1, 3, 0.4, CYAN, 1],
      [-0.5, 8, -4.8, 1, 3, 0.4, CYAN, 1],
      [1.2, 8, -4.8, 1, 3, 0.4, CYAN, 1],
      // shoulder pads
      [-6.4, 10.5, -2, 2.6, 1.8, 4, WHITE],
      [3.8, 10.5, -2, 2.6, 1.8, 4, WHITE],
    ],
    [0, 6, 0],
    mat,
  );
  const head = part(
    [
      [-3, 12, -3, 6, 5, 6, SKIN],
      [-3.4, 15.5, -3.4, 6.8, 2.5, 6.8, WHITE],
      [-3.4, 12, -3.4, 0.8, 4, 6.8, WHITE],
      [2.6, 12, -3.4, 0.8, 4, 6.8, WHITE],
      [-3.4, 12, -3.4, 6.8, 4, 0.8, WHITE],
      [-3.2, 13.6, 2.7, 6.4, 1.4, 0.6, CYAN, 1],
      [-0.5, 18, -1, 1, 1.5, 1, CYAN, 1],
    ],
    [0, 12, 0],
    mat,
  );
  const armL = part(
    [
      [-6, 6, -1.5, 2, 5, 3, WHITE],
      [-6.1, 4.8, -1.6, 2.2, 1.6, 3.2, SKIN],
    ],
    [-5, 11, 0],
    mat,
  );
  const armR = part(
    [
      [4, 7, -1.5, 2, 4, 3, WHITE],
      [3.6, 4.4, -2, 2.8, 3, 4, DARK],
      [3.9, 6.6, 1.9, 2.2, 0.6, 0.4, CYAN, 1],
      [4.2, 3.8, -0.8, 1.6, 0.7, 1.6, 0xff4060, 1],
    ],
    [5, 11, 0],
    mat,
  );
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.75, 0);
  armR.add(muzzle);
  body.add(legL, legR, torso, head, armL, armR);
  root.scale.setScalar(1.2);
  return { root, body, mat, legL, legR, armL, armR, head, muzzle, palette: [WHITE, CYAN, DARK, STEEL] };
}

// ---------- Zombie: hunched, mossy grey-green, sack-cloth tunic ----------
export function zombieRig(brute = false): Rig {
  const mat = newMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const SKIN = brute ? 0x6f8a4a : 0x7d9a62, ROT = 0x4e6640, CLOTH = brute ? 0x5a3a2a : 0x7a6247, RAG = 0x4b3b2c, EYE = 0xffd23a;

  const leg: Box[] = [
    [-3.5, 0, -1.5, 3, 2, 3, ROT],
    [-3.5, 2, -1.5, 3, 4, 3, RAG],
  ];
  const legL = part(leg, [-2, 6, 0], mat);
  const legR = part(mirrorX(leg), [2, 6, 0], mat);
  const torso = part(
    [
      [-4, 6, -2, 8, 6, 4, CLOTH],
      [-4, 6, -2.2, 3, 2, 0.4, RAG],
      [1, 9, 1.9, 2, 2, 0.3, SKIN],
      [-4.2, 6, -2.2, 8.4, 0.8, 4.4, RAG],
      ...(brute ? ([[-3, 9, -3.4, 6, 3, 1.4, 0x3a2a20]] as Box[]) : []),
    ],
    [0, 6, 0],
    mat,
  );
  torso.rotation.x = 0.12;
  const head = part(
    [
      [-3, 12, -3, 6, 6, 6, SKIN],
      [-2.2, 14, 2.9, 1.4, 1.2, 0.3, EYE, 1],
      [0.8, 14, 2.9, 1.4, 1.2, 0.3, EYE, 1],
      [-2, 12.6, 2.9, 4, 0.8, 0.3, 0x2b1c12],
      [-3.2, 16, -2, 2, 2, 3, ROT],
      [1.5, 17, 0, 1.5, 1.2, 2, ROT],
    ],
    [0, 12, 0],
    mat,
  );
  head.position.z += 0.08;
  const arm: Box[] = [
    [-6, 6, -1.5, 2, 5, 3, CLOTH],
    [-6, 3.5, -1.5, 2, 2.5, 3, SKIN],
  ];
  const armL = part(arm, [-5, 11, 0], mat);
  const armR = part(mirrorX(arm), [5, 11, 0], mat);
  armL.rotation.x = armR.rotation.x = -1.35;
  body.add(legL, legR, torso, head, armL, armR);
  root.scale.setScalar(brute ? 2 : 1.15);
  return { root, body, mat, legL, legR, armL, armR, head, palette: [SKIN, ROT, CLOTH, RAG] };
}

// ---------- Skeleton: rattling bones with a short bow ----------
export function skeletonRig(): Rig {
  const mat = newMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const BONE = 0xdcd6c4, SHADE = 0xa49d88, DARK = 0x2a2622, EYE = 0xff3b2f, WOOD = 0x7b5230, STRING = 0xeeeeee;

  const leg: Box[] = [
    [-3, 0, -1.5, 2.4, 1.2, 3, SHADE],
    [-2.6, 1.2, -0.8, 1.6, 4.8, 1.6, BONE],
  ];
  const legL = part(leg, [-1.8, 6, 0], mat);
  const legR = part(mirrorX(leg), [1.8, 6, 0], mat);
  const torso = part(
    [
      [-3, 6, -1.2, 6, 1.4, 2.4, SHADE],
      [-0.8, 6, -0.8, 1.6, 6, 1.6, BONE],
      [-3.4, 8, -1.6, 6.8, 0.8, 3.2, BONE],
      [-3.4, 9.4, -1.6, 6.8, 0.8, 3.2, BONE],
      [-3.4, 10.8, -1.6, 6.8, 0.8, 3.2, BONE],
      [-4.4, 11.4, -1.4, 8.8, 0.8, 2.8, SHADE],
    ],
    [0, 6, 0],
    mat,
  );
  const head = part(
    [
      [-3, 13, -3, 6, 5, 6, BONE],
      [-2.4, 12, -2.4, 4.8, 1.2, 4.8, SHADE],
      [-2.3, 14.6, 2.85, 1.6, 1.5, 0.3, DARK],
      [0.7, 14.6, 2.85, 1.6, 1.5, 0.3, DARK],
      [-1.8, 15, 2.95, 0.6, 0.6, 0.2, EYE, 1],
      [1.2, 15, 2.95, 0.6, 0.6, 0.2, EYE, 1],
      [-1.5, 12.3, 2.5, 3, 0.4, 0.4, DARK],
    ],
    [0, 12, 0],
    mat,
  );
  const armL = part(
    [
      [-5.6, 5, -0.7, 1.4, 6, 1.4, BONE],
      // bow
      [-6.1, 4, -4.5, 1, 1, 9, WOOD],
      [-6.1, 4, 4.3, 1, 3, 1, WOOD],
      [-6.1, 4, -5.3, 1, 3, 1, WOOD],
      [-5.9, 6.8, -4.6, 0.4, 0.4, 9.4, STRING],
    ],
    [-5, 11, 0],
    mat,
  );
  const armR = part([[4.2, 5, -0.7, 1.4, 6, 1.4, BONE]], [5, 11, 0], mat);
  armL.rotation.x = -1.4;
  body.add(legL, legR, torso, head, armL, armR);
  root.scale.setScalar(1.15);
  return { root, body, mat, legL, legR, armL, armR, head, palette: [BONE, SHADE, BONE, WOOD] };
}

// ---------- Spider: wide, low, eight legs, many red eyes ----------
export function spiderRig(): Rig {
  const mat = newMat();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const SHELL = 0x2e2433, FUR = 0x463848, MARK = 0xc2412f, EYE = 0xff2a3a, LEG = 0x3a2e3e;

  const torso = part(
    [
      [-4.5, 3, -9, 9, 6, 8, SHELL],
      [-3.5, 8.6, -8, 7, 0.6, 6, FUR],
      [-1, 9, -7, 2, 0.4, 4, MARK],
      [-2.5, 9, -5.5, 5, 0.4, 1, MARK],
      [-3, 2.5, -1, 6, 4.5, 5, FUR],
      [-2.2, 5, 3.9, 1, 1, 0.4, EYE, 1],
      [1.2, 5, 3.9, 1, 1, 0.4, EYE, 1],
      [-1, 5.8, 3.9, 0.8, 0.8, 0.4, EYE, 1],
      [0.2, 5.8, 3.9, 0.8, 0.8, 0.4, EYE, 1],
      [-1.6, 2.5, 3.8, 1, 1.4, 1, 0x1a141c],
      [0.6, 2.5, 3.8, 1, 1.4, 1, 0x1a141c],
    ],
    [0, 4, 0],
    mat,
  );
  body.add(torso);
  const legs: THREE.Group[] = [];
  const zs = [2.5, 0.5, -1.5, -3.5];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = zs[i];
      let boxes: Box[] = [
        [3, 4.5, z - 0.5, 5, 1, 1, LEG],
        [7.5, 1, z - 0.5, 1, 4.5, 1, LEG],
        [7.6, 0, z - 0.4, 0.8, 1, 0.8, FUR],
      ];
      if (side < 0) boxes = mirrorX(boxes);
      const leg = part(boxes, [side * 3, 5, z], mat);
      leg.rotation.y = side * (i - 1.5) * 0.25;
      leg.userData.baseY = leg.rotation.y;
      legs.push(leg);
      body.add(leg);
    }
  }
  root.scale.setScalar(1.1);
  return { root, body, mat, legs, palette: [SHELL, FUR, MARK, LEG] };
}

// ---------- Small props ----------
export function arrowMesh(): THREE.Mesh {
  const g = boxesGeometry(
    [
      [-0.3, -0.3, -4, 0.6, 0.6, 7, 0x8a6a44],
      [-0.6, -0.6, 3, 1.2, 1.2, 1.4, 0xb8bcc4],
      [-0.1, -0.9, -4.5, 0.2, 1.8, 1.8, 0xe6e6e6],
    ],
    [0, 0, 0],
  )!;
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

export function heartMesh(): THREE.Group {
  const g = new THREE.Group();
  const geo = boxesGeometry(
    [
      [-3, 1, -1, 2, 3, 2, 0xff4058],
      [1, 1, -1, 2, 3, 2, 0xff4058],
      [-2, -1, -1, 4, 4, 2, 0xff4058],
      [-1, -2, -1, 2, 1, 2, 0xff4058],
      [-2, 3, -1.1, 1, 1, 0.2, 0xffb0bc],
    ],
    [0, 0, 0],
    VOX * 1.1,
  )!;
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  return g;
}

export function torchGeometry(): { stick: THREE.BufferGeometry; flame: THREE.BufferGeometry } {
  const stick = boxesGeometry(
    [
      [-0.6, 0, -0.6, 1.2, 4, 1.2, 0x5a3b22],
      [-1, 4, -1, 2, 1, 2, 0x3a3a40],
    ],
    [0, 0, 0],
  )!;
  const flame = boxesGeometry(
    [
      [-1, 0, -1, 2, 2, 2, 0xffb02e],
      [-0.6, 1.6, -0.6, 1.2, 1.6, 1.2, 0xffe27a],
    ],
    [0, 0, 0],
  )!;
  return { stick, flame };
}
