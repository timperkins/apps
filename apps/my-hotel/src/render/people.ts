// Low-poly people: guests, staff and the player (the hotel manager).
import * as THREE from 'three';
import { ball, box, cyl } from './kit';

export interface Look {
  outfit: string;
  skin: string;
  hair?: string;
  hat?: 'none' | 'cap' | 'sunhat' | 'beanie' | 'manager' | 'bellhop';
  hatColor?: string;
  bag?: string | null;
  legs?: string;
  bowTie?: string;
  mop?: boolean;
}

export interface Person {
  root: THREE.Group;
  body: THREE.Group; // bobs while walking
  legL: THREE.Object3D;
  legR: THREE.Object3D;
}

export function makePerson(look: Look, scale = 1): Person {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.scale.setScalar(scale);

  const legs = look.legs ?? '#3d3a4b';
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.15, 0.55, 0);
  legR.position.set(0.15, 0.55, 0);
  box(legL, 0.22, 0.55, 0.24, legs, 0, -0.55, 0);
  box(legR, 0.22, 0.55, 0.24, legs, 0, -0.55, 0);
  root.add(legL, legR);

  cyl(body, 0.34, 0.4, 0.8, look.outfit, 0, 0.5, 0);
  ball(body, 0.16, look.outfit, -0.46, 0.95, 0);
  ball(body, 0.16, look.outfit, 0.46, 0.95, 0);
  ball(body, 0.4, look.skin, 0, 1.66, 0);
  ball(body, 0.05, '#2b2233', -0.13, 1.7, 0.37);
  ball(body, 0.05, '#2b2233', 0.13, 1.7, 0.37);
  const cheekL = ball(body, 0.06, '#ff8a80', -0.24, 1.6, 0.31);
  const cheekR = ball(body, 0.06, '#ff8a80', 0.24, 1.6, 0.31);
  cheekL.castShadow = cheekR.castShadow = false;

  const hatColor = look.hatColor ?? '#264653';
  if (look.hair && look.hat !== 'beanie' && look.hat !== 'manager') {
    const h = ball(body, 0.42, look.hair, 0, 1.76, -0.06);
    h.scale.set(0.42, 0.3, 0.42);
  }
  switch (look.hat) {
    case 'cap': {
      const c = ball(body, 0.42, hatColor, 0, 1.84, 0);
      c.scale.set(0.42, 0.24, 0.42);
      box(body, 0.48, 0.06, 0.4, hatColor, 0, 1.86, 0.38);
      break;
    }
    case 'sunhat':
      cyl(body, 0.72, 0.72, 0.05, hatColor, 0, 1.9, 0, 20);
      cyl(body, 0.3, 0.38, 0.3, hatColor, 0, 1.93, 0);
      cyl(body, 0.39, 0.39, 0.08, '#e76f51', 0, 1.95, 0);
      break;
    case 'beanie': {
      const b = ball(body, 0.43, hatColor, 0, 1.82, 0);
      b.scale.set(0.43, 0.28, 0.43);
      ball(body, 0.11, hatColor, 0, 2.14, 0);
      break;
    }
    case 'manager':
      cyl(body, 0.34, 0.38, 0.34, hatColor, 0, 1.95, 0, 18);
      cyl(body, 0.4, 0.4, 0.06, '#ffd54f', 0, 1.97, 0, 18);
      break;
    case 'bellhop':
      cyl(body, 0.26, 0.28, 0.3, hatColor, 0, 1.98, 0, 16);
      cyl(body, 0.29, 0.29, 0.06, '#ffd54f', 0, 2.0, 0, 16);
      break;
  }
  if (look.bowTie) box(body, 0.32, 0.16, 0.08, look.bowTie, 0, 1.16, 0.37);
  if (look.bag) {
    box(body, 0.5, 0.65, 0.28, look.bag, 0.72, 0.02, 0.05);
    box(body, 0.28, 0.07, 0.07, '#4e342e', 0.72, 0.67, 0.05);
  }
  if (look.mop) {
    cyl(body, 0.04, 0.04, 1.7, '#a1887f', 0.62, 0.05, 0.2, 6);
    box(body, 0.5, 0.12, 0.3, '#e0e0e0', 0.62, 0, 0.2);
  }
  return { root, body, legL, legR };
}

/** Swing legs and bob while walking; settle when standing. */
export function animatePerson(p: Person, moving: boolean, t: number) {
  const target = moving ? Math.sin(t * 13) * 0.7 : 0;
  p.legL.rotation.x += (target - p.legL.rotation.x) * 0.4;
  p.legR.rotation.x += (-target - p.legR.rotation.x) * 0.4;
  p.body.position.y = moving ? Math.abs(Math.sin(t * 13)) * 0.08 : 0;
}

/** Turn smoothly towards a heading (radians, 0 = facing +z). */
export function turnTowards(obj: THREE.Object3D, heading: number, k = 0.25) {
  let d = heading - obj.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * k;
}

export const PLAYER_LOOK: Look = { outfit: '#5e35b1', skin: '#e8b48f', hat: 'manager', hatColor: '#5e35b1', bowTie: '#ffd54f' };
