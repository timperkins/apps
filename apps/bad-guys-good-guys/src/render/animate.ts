import type { Rig } from './person';

/** Poses a rig for one frame from its game state. All angles are radians. */

export interface PoseInput {
  state: string;
  attack?: string;
  /** Seconds in the current state and its length, for attack timing. */
  t: number;
  len: number;
  moving: boolean;
  walkPhase: number;
  face: 1 | -1;
  air?: boolean;
  time: number;
  heavy?: boolean;
}

const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
const jab = (p: number) => (p < 0.4 ? p / 0.4 : Math.max(0, 1 - (p - 0.4) / 0.6));

export function pose(rig: Rig, i: PoseInput): void {
  const [legA, legB] = rig.legs;
  const [armA, armB] = rig.arms;
  // The arm nearer the camera does the work.
  const front = i.face > 0 ? 0 : 1;
  const armF = rig.arms[front];
  const armR = rig.arms[1 - front];
  const legF = rig.legs[front];
  const legR = rig.legs[1 - front];
  const side = (idx: number) => (idx === 0 ? -1 : 1);

  // Reset
  rig.body.rotation.set(0, 0, 0);
  rig.body.position.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  for (const [k, a] of [armA, armB].entries()) a.rotation.set(0, 0, side(k) * 0.12);
  legA.rotation.set(0, 0, 0);
  legB.rotation.set(0, 0, 0);

  const p = i.len > 0 ? Math.min(1, i.t / i.len) : 1;
  const sw = Math.sin(i.walkPhase);

  if (i.state === 'down') {
    const fall = ease(i.t / 0.35);
    rig.body.rotation.x = -Math.PI / 2 * fall;
    rig.body.position.y = 0.12 * fall;
    rig.body.position.z = -0.1 * fall;
    armA.rotation.z = -0.9 * fall;
    armB.rotation.z = 0.9 * fall;
    legA.rotation.z = -0.15;
    legB.rotation.z = 0.2;
    return;
  }

  // Locomotion base
  if (i.moving || i.state === 'walk' || i.state === 'enter') {
    legA.rotation.x = sw * 0.65;
    legB.rotation.x = -sw * 0.65;
    armA.rotation.x = -sw * 0.5;
    armB.rotation.x = sw * 0.5;
    rig.body.position.y = Math.abs(Math.cos(i.walkPhase)) * 0.05;
  } else {
    const br = Math.sin(i.time * 2.2) * 0.03;
    armA.rotation.x = br;
    armB.rotation.x = -br;
    rig.body.position.y = Math.sin(i.time * 2.2) * 0.008;
  }
  if (i.air) {
    legF.rotation.x = -0.7;
    legR.rotation.x = 0.4;
    armA.rotation.z = -0.6;
    armB.rotation.z = 0.6;
  }
  if (rig.cape) rig.cape.parent!.rotation.x = 0.2 + (i.moving ? 0.35 + Math.sin(i.time * 9) * 0.08 : Math.sin(i.time * 2) * 0.04);

  switch (i.state) {
    case 'attack': {
      const a = i.attack ?? 'punch1';
      if (a === 'punch1' || a === 'punch2') {
        const arm = a === 'punch1' ? armF : armR;
        arm.rotation.x = -1.55 * jab(p);
        arm.rotation.z = side(rig.arms.indexOf(arm)) * 0.05;
        rig.body.rotation.y = (a === 'punch1' ? 0.25 : -0.25) * jab(p) * i.face;
      } else if (a === 'kick') {
        legF.rotation.x = -1.45 * jab(p);
        rig.body.rotation.x = 0.18 * jab(p);
        armA.rotation.z = -0.5;
        armB.rotation.z = 0.5;
      } else if (a === 'swing') {
        const q = ease(p / 0.55);
        armF.rotation.x = -2.7 + q * 2.3;
        armF.rotation.z = side(front) * 0.3;
        armR.rotation.x = -0.4;
        rig.body.rotation.y = (0.35 - q * 0.7) * i.face;
      } else if (a === 'blast') {
        armF.rotation.x = -1.45 + Math.sin(i.time * 60) * 0.04;
        armR.rotation.x = -1.2;
        rig.body.rotation.x = 0.1;
      } else if (a === 'jumpkick') {
        legF.rotation.x = -1.55;
        legR.rotation.x = 0.7;
        armA.rotation.z = -1.0;
        armB.rotation.z = 1.0;
        rig.body.rotation.x = 0.25;
      }
      break;
    }
    case 'throw': {
      const q = p < 0.35 ? p / 0.35 : 1;
      armF.rotation.x = p < 0.35 ? -2.9 * q : -2.9 + ease((p - 0.35) / 0.4) * 2.0;
      rig.body.rotation.x = p < 0.35 ? -0.1 : 0.12;
      break;
    }
    case 'hurt':
      rig.body.rotation.x = -0.25 * (1 - p * 0.6);
      rig.head.rotation.x = -0.25;
      armA.rotation.z = -0.5;
      armB.rotation.z = 0.5;
      break;
    case 'windup': {
      armF.rotation.x = -2.7 * ease(p * 1.4);
      armF.rotation.z = side(front) * 0.25;
      rig.body.rotation.x = -0.12 * ease(p);
      break;
    }
    case 'attack_enemy':
      break;
    case 'throwWind':
      armF.rotation.x = -2.9 * ease(p * 1.3);
      armF.rotation.z = side(front) * 0.2;
      rig.body.rotation.x = -0.15 * ease(p);
      break;
    case 'whistle':
      armF.rotation.x = -2.2;
      armF.rotation.z = side(front) * -0.6;
      rig.head.rotation.x = -0.25;
      rig.body.rotation.x = -0.1;
      break;
  }
}

/** Grown-ups' attack and throw follow-throughs, which reuse the enemy state names. */
export function poseEnemy(rig: Rig, i: PoseInput): void {
  if (i.state === 'attack') {
    pose(rig, { ...i, state: 'none' });
    const front = i.face > 0 ? 0 : 1;
    const armF = rig.arms[front];
    const q = ease(i.t / 0.15);
    armF.rotation.x = -2.7 + q * 2.4;
    armF.rotation.z = (front === 0 ? -1 : 1) * 0.25;
    rig.body.rotation.x = 0.15 * q;
    rig.body.rotation.y = -0.3 * q * i.face;
    return;
  }
  if (i.state === 'throw') {
    pose(rig, { ...i, state: 'none' });
    const front = i.face > 0 ? 0 : 1;
    const q = ease(i.t / 0.18);
    rig.arms[front].rotation.x = -2.9 + q * 2.1;
    rig.body.rotation.x = 0.15 * q;
    return;
  }
  pose(rig, i);
}
