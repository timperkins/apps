import { randomLook } from '../src/core/look';
import { addKid, createWorld, step, type Input, type Kid, type World } from '../src/core/sim';
import { TICK } from '../src/core/config';

export function rng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function world(kids = 1, seed = 1): World {
  const r = rng(seed);
  const w = createWorld(r);
  for (let i = 0; i < kids; i++) addKid(w, randomLook(r));
  return w;
}

export function run(w: World, secs: number, drive?: (w: World) => void): void {
  for (let t = 0; t < secs; t += TICK) {
    drive?.(w);
    step(w, TICK);
  }
}

/** A simple player: walks to the nearest grown-up, lines up, and punches; walks right otherwise. */
export function bot(w: World, k: Kid, frame: { n: number }): Input {
  frame.n++;
  const i = k.input;
  const live = w.enemies.filter((e) => e.state !== 'down');
  const down = w.kids.find((o) => o !== k && o.state === 'down');
  if (down && k.state !== 'down') {
    return { ...i, mx: Math.sign(down.x - k.x) * (Math.abs(down.x - k.x) > 0.3 ? 1 : 0), mz: Math.sign(down.z - k.z) * (Math.abs(down.z - k.z) > 0.3 ? 1 : 0) };
  }
  if (!live.length) return { ...i, mx: 1, mz: 0 };
  const e = live.reduce((a, b) => (Math.abs(b.x - k.x) < Math.abs(a.x - k.x) ? b : a));
  const dx = e.x - k.x;
  const dz = e.z - k.z;
  const want = dx - Math.sign(dx) * 0.9;
  const mx = Math.abs(want) > 0.25 ? Math.sign(want) : 0;
  const mz = Math.abs(dz) > 0.3 ? Math.sign(dz) : 0;
  const attack = Math.abs(dz) < 0.6 && Math.abs(dx) < 1.5 && frame.n % 8 === 0 ? i.attack + 1 : i.attack;
  return { mx: mx || (Math.abs(dx) < 0.3 ? Math.sign(dx) * 0.3 : 0), mz, attack, jump: i.jump, grab: i.grab };
}
