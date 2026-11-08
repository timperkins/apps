import type { EnemyKind, ItemKind, ProjKind } from './config';
import type { AttackKind, EnemyState, Fx, KidState, Phase, World } from './sim';

/** A compact picture of the world, sent from the host to every player about 20 times a second. */
export interface KidSnap {
  id: number;
  x: number;
  y: number;
  z: number;
  f: 1 | -1;
  hp: number;
  s: KidState;
  st: number;
  sl: number;
  a: AttackKind;
  h: ItemKind | '';
  hu: number;
  rv: number;
  sc: number;
  m: 0 | 1;
  inv: 0 | 1;
  stun: 0 | 1;
}

export interface EnemySnap {
  id: number;
  k: EnemyKind;
  x: number;
  z: number;
  f: 1 | -1;
  hp: number;
  mhp: number;
  s: EnemyState;
  st: number;
  sl: number;
  fl: 0 | 1;
}

export interface ProjSnap {
  id: number;
  k: ProjKind;
  x: number;
  y: number;
  z: number;
}

export interface PickupSnap {
  id: number;
  k: ItemKind;
  x: number;
  z: number;
}

export interface Snapshot {
  t: number;
  ph: Phase;
  sec: number;
  wave: number;
  cam: number;
  kids: KidSnap[];
  en: EnemySnap[];
  pr: ProjSnap[];
  pk: PickupSnap[];
  ev: Fx[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function makeSnapshot(w: World, events: Fx[]): Snapshot {
  return {
    t: r2(w.time),
    ph: w.phase,
    sec: w.section,
    wave: w.wave,
    cam: r2(w.camX),
    kids: w.kids.map((k) => ({
      id: k.id, x: r2(k.x), y: r2(k.y), z: r2(k.z), f: k.face, hp: Math.ceil(k.hp), s: k.state, st: r2(k.stateT), sl: r2(k.stateLen),
      a: k.attack, h: k.held?.kind ?? '', hu: k.held?.uses ?? 0, rv: r2(k.revive), sc: k.score, m: k.moving ? 1 : 0,
      inv: k.invuln > 0 ? 1 : 0, stun: k.stun > 0 ? 1 : 0,
    })),
    en: w.enemies.map((e) => ({
      id: e.id, k: e.kind, x: r2(e.x), z: r2(e.z), f: e.face, hp: Math.ceil(e.hp), mhp: Math.ceil(e.maxHp), s: e.state, st: r2(e.stateT),
      sl: r2(e.stateLen), fl: e.flash > 0 ? 1 : 0,
    })),
    pr: w.projs.map((p) => ({ id: p.id, k: p.kind, x: r2(p.x), y: r2(p.y), z: r2(p.z) })),
    pk: w.pickups.filter((p) => Math.abs(p.x - w.camX) < 16).map((p) => ({ id: p.id, k: p.kind, x: r2(p.x), z: r2(p.z) })),
    ev: events,
  };
}
