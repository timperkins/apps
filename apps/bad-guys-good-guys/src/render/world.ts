import * as THREE from 'three';
import { M, bake, canvasTex, cyl, mesh, rbox, speckle, sph, box } from './materials';

/**
 * The level: one long street from the school steps to the park gates. Everything static is
 * merged per material at the end so the whole street is a few dozen draw calls.
 */

const PAL = { brick: '#a5543c', mortar: '#cdbca8', trim: '#ebe4d6', grass: '#6aa043', road: '#55585f', walk: '#cbc2b2' };
const X0 = -16;
const X1 = 126;
const LEN = X1 - X0;
const MID = (X0 + X1) / 2;

export function buildWorld(scene: THREE.Scene): void {
  const env = new THREE.Group();
  ground(env);
  school(env, -14, 44);
  buses(env);
  houses(env);
  mall(env);
  park(env);
  for (let x = -8; x < X1; x += 16) streetlight(env, x, -3.5);
  for (let x = X0; x < X1; x += 7 + (Math.abs(Math.sin(x)) * 4)) farTree(env, x, -15 - Math.abs(Math.cos(x * 1.3)) * 4);
  bake(env, true);
  env.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) n.matrixAutoUpdate = false;
    n.updateMatrix();
  });
  scene.add(env);
}

function texture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) {
  return canvasTex(w, h, draw, repeat);
}

function ground(env: THREE.Group): void {
  const roadTex = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = PAL.road;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 0.12);
  }, [LEN / 4, 3]);
  const road = mesh(new THREE.PlaneGeometry(LEN, 12), M('#ffffff', { map: roadTex, rough: 0.9 }), false);
  road.rotation.x = -Math.PI / 2;
  road.position.set(MID, 0, 3);
  env.add(road);
  for (let x = X0; x < X1; x += 2.6) {
    const d = mesh(new THREE.PlaneGeometry(1.4, 0.14), M('#f2e3a8', { plain: true }), false);
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, 0.01, 4.6);
    env.add(d);
  }
  for (const cx of [4, 46, 90]) {
    for (let i = 0; i < 7; i++) {
      const c = mesh(new THREE.PlaneGeometry(0.45, 7.4), M('#eeeadc', { plain: true }), false);
      c.rotation.x = -Math.PI / 2;
      c.position.set(cx - 2.4 + i * 0.8, 0.012, 0.8);
      env.add(c);
    }
  }
  const curb = mesh(rbox(LEN, 0.2, 0.35, 0.05), M('#cfc6b6', { plain: true }), false);
  curb.position.set(MID, 0.1, -3.0);
  env.add(curb);
  const walkTex = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = PAL.walk;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 0.06);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, h);
      ctx.stroke();
    }
  }, [LEN / 4, 1]);
  const walk = mesh(box(LEN, 0.2, 2.4), M('#ffffff', { map: walkTex, rough: 0.9 }), false);
  walk.position.set(MID, -0.08, -4.35);
  env.add(walk);
  const grassTex = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const c = new THREE.Color(PAL.grass).offsetHSL(0, 0, (Math.random() - 0.4) * 0.15);
      ctx.strokeStyle = '#' + c.getHexString();
      ctx.beginPath();
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 3 - 1.5, y - 6);
      ctx.stroke();
    }
  }, [LEN / 3, 4]);
  const lawn = mesh(box(LEN, 0.16, 14), M('#ffffff', { map: grassTex, rough: 0.95 }), false);
  lawn.position.set(MID, -0.02, -12.55);
  env.add(lawn);
  // Far ground so the horizon never shows a gap.
  const far = mesh(new THREE.PlaneGeometry(400, 200), M('#7aa85a', { plain: true }), false);
  far.rotation.x = -Math.PI / 2;
  far.position.set(MID, -0.05, -60);
  env.add(far);
}

function windowAt(env: THREE.Group, x: number, y: number, z: number, w = 1.5, h = 1.8): void {
  const frame = mesh(rbox(w + 0.2, h + 0.2, 0.3, 0.05), M(PAL.trim, { plain: true }));
  frame.position.set(x, y, z);
  env.add(frame);
  const glass = mesh(new THREE.PlaneGeometry(w, h), M('#a9cde6', { plain: true, rough: 0.08, metal: 0.2 }), false);
  glass.position.set(x, y, z + 0.16);
  env.add(glass);
  const bar = mesh(box(w, 0.07, 0.05), M(PAL.trim, { plain: true }), false);
  bar.position.set(x, y, z + 0.18);
  env.add(bar);
}

function school(env: THREE.Group, x0: number, x1: number): void {
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  const brickTex = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = PAL.mortar;
    ctx.fillRect(0, 0, w, h);
    const bh = 32;
    const bw = 64;
    for (let y = 0; y < h / bh; y++)
      for (let x = -1; x < w / bw + 1; x++) {
        const ox = (y % 2) * (bw / 2);
        const c = new THREE.Color(PAL.brick).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
        ctx.fillStyle = '#' + c.getHexString();
        ctx.fillRect(x * bw + ox + 3, y * bh + 3, bw - 6, bh - 6);
      }
    speckle(ctx, w, h, 0.08);
  }, [len / 3.4, 3]);
  const wall = mesh(box(len, 7.5, 1), M('#ffffff', { map: brickTex, rough: 0.9 }), false);
  wall.position.set(cx, 3.75, -9.5);
  env.add(wall);
  const trim = mesh(rbox(len + 0.4, 0.5, 1.4, 0.1), M(PAL.trim, { plain: true }), false);
  trim.position.set(cx, 7.6, -9.3);
  env.add(trim);
  const base = mesh(rbox(len + 0.2, 0.6, 1.2, 0.05), M('#bfb3a0', { plain: true }), false);
  base.position.set(cx, 0.3, -9.2);
  env.add(base);
  const doorX = 6;
  for (let x = x0 + 2; x < x1 - 1; x += 2.6) for (let r = 0; r < 2; r++) {
    if (Math.abs(x - doorX) < 2.4 && r === 0) continue;
    windowAt(env, x, 2.3 + r * 2.8, -8.95);
  }
  const ent = mesh(rbox(3.6, 4.2, 1.2, 0.08), M(PAL.trim, { plain: true }));
  ent.position.set(doorX, 2.1, -8.7);
  env.add(ent);
  const door = mesh(rbox(2.4, 3.0, 0.3), M('#2f6fb0', { rough: 0.5 }));
  door.position.set(doorX, 1.85, -8.05);
  env.add(door);
  const signTex = texture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = PAL.trim;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a3a7a';
    ctx.font = '92px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WESTBROOK SCHOOL', w / 2, h / 2 + 6);
  });
  const sign = mesh(new THREE.PlaneGeometry(6.4, 1.0), M('#ffffff', { map: signTex }), false);
  sign.position.set(doorX, 5.05, -8.08);
  env.add(sign);
  const signBack = mesh(rbox(6.7, 1.25, 0.2), M('#2a3a7a', { plain: true }));
  signBack.position.set(doorX, 5.05, -8.2);
  env.add(signBack);
  for (let s = 0; s < 3; s++) {
    const st = mesh(rbox(4.6 - s * 0.4, 0.18, 0.9 - s * 0.2, 0.03), M('#cfc4b0', { plain: true }));
    st.position.set(doorX, 0.09 + s * 0.18, -7.6 + s * 0.2);
    env.add(st);
  }
  const clock = mesh(cyl(0.55, 0.55, 0.15, 32), M('#fffdf4', { plain: true }));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(doorX, 6.5, -8.85);
  env.add(clock);
  const banTex = texture(1024, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d6302b';
    ctx.font = '84px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HAVE A GREAT SUMMER!', w / 2, h / 2 + 6);
  });
  const ban = mesh(new THREE.PlaneGeometry(7, 0.9, 20, 1), M('#ffffff', { map: banTex }), false);
  const p = ban.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - 0.25 * Math.cos(((p.getX(i) / 3.5) * Math.PI) / 2));
  ban.position.set(15.5, 5.7, -8.9);
  env.add(ban);
  // hedge
  for (let x = x0; x < 20; x += 1.25) {
    if (Math.abs(x - doorX) < 2.6) continue;
    const h = mesh(sph(0.55, 14, 10), M('#4f9440'));
    h.scale.set(1.2, 0.8, 0.8);
    h.position.set(x, 0.45, -7.4);
    env.add(h);
  }
  const flag = mesh(cyl(0.04, 0.05, 6.5, 10), M('#d8d8e0', { metal: 0.6, rough: 0.3 }));
  flag.position.set(-2, 3.25, -7);
  env.add(flag);
  const bikeRack = mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 20, Math.PI), M('#3a7ad6', { metal: 0.5, rough: 0.4 }));
  bikeRack.position.set(13, 0.2, -5.6);
  env.add(bikeRack);
  tree(env, -10, -6.4, 1.15);
  tree(env, 17, -6.5, 1.0);
}

function bus(env: THREE.Group, x: number, z: number): void {
  const yel = M('#ffc21a', { rough: 0.45 });
  const body = mesh(rbox(7, 2.4, 2.4, 0.3), yel);
  body.position.set(x, 1.65, z);
  env.add(body);
  const hood = mesh(rbox(1.4, 1.4, 2.3, 0.25), yel);
  hood.position.set(x - 3.9, 1.15, z);
  env.add(hood);
  const stripe = mesh(box(7.02, 0.12, 2.42), M('#1b1b1b', { plain: true }), false);
  stripe.position.set(x, 1.35, z);
  env.add(stripe);
  for (let i = 0; i < 6; i++) {
    const w = mesh(rbox(0.9, 0.75, 0.05, 0.08), M('#9fc6e2', { plain: true, rough: 0.1, metal: 0.2 }), false);
    w.position.set(x - 2.6 + i * 1.05, 2.25, z + 1.21);
    env.add(w);
  }
  for (const wx of [-2.6, 2.2]) {
    const t = mesh(cyl(0.48, 0.48, 0.35, 20), M('#202028', { plain: true }));
    t.rotation.x = Math.PI / 2;
    t.position.set(x + wx, 0.48, z + 1.1);
    env.add(t);
    const hub = mesh(cyl(0.22, 0.22, 0.37, 14), M('#c9c9cf', { metal: 0.6, rough: 0.3 }));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x + wx, 0.48, z + 1.12);
    env.add(hub);
  }
  const stop = mesh(cyl(0.32, 0.32, 0.05, 8), M('#d8262b', { plain: true }));
  stop.rotation.x = Math.PI / 2;
  stop.position.set(x - 1.6, 1.6, z + 1.32);
  env.add(stop);
}

function buses(env: THREE.Group): void {
  bus(env, 25, -6.4);
  bus(env, 33.5, -6.4);
  tree(env, 39.5, -6.8, 1.2);
}

function house(env: THREE.Group, x: number, color: string, roof: string): void {
  const z = -11;
  const body = mesh(box(6.4, 3.6, 4), M(color, { plain: true, rough: 0.9 }));
  body.position.set(x, 1.8, z);
  env.add(body);
  // gable roof
  const shape = new THREE.Shape();
  shape.moveTo(-3.6, 0);
  shape.lineTo(0, 2.2);
  shape.lineTo(3.6, 0);
  shape.lineTo(-3.6, 0);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 4.6, bevelEnabled: false });
  const r = mesh(roofGeo, M(roof, { plain: true, rough: 0.8 }));
  r.position.set(x, 3.6, z - 2.3);
  env.add(r);
  const door = mesh(rbox(1.0, 2.0, 0.15, 0.04), M('#7a3a2a', { plain: true }));
  door.position.set(x - 1.6, 1.0, z + 2.05);
  env.add(door);
  windowAt(env, x + 1.2, 2.0, z + 2.0, 1.6, 1.2);
  const porch = mesh(rbox(3.2, 0.25, 1.4, 0.04), M('#cfc4b0', { plain: true }));
  porch.position.set(x - 1.4, 0.12, z + 2.7);
  env.add(porch);
  // picket fence
  for (let fx = x - 3.2; fx < x + 3.2; fx += 0.3) {
    if (Math.abs(fx - (x - 1.6)) < 0.7) continue;
    const pk = mesh(box(0.12, 0.9, 0.05), M('#f6f3ea', { plain: true }));
    pk.position.set(fx, 0.45, -6.2);
    env.add(pk);
  }
  const rail = mesh(box(6.4, 0.08, 0.05), M('#f6f3ea', { plain: true }), false);
  rail.position.set(x, 0.65, -6.23);
  env.add(rail);
  const mail = mesh(rbox(0.25, 0.25, 0.45, 0.08), M('#3a4ad8', { plain: true }));
  mail.position.set(x + 3.0, 1.0, -5.8);
  env.add(mail);
  const post = mesh(box(0.08, 0.9, 0.08), M('#6a4a2a', { plain: true }));
  post.position.set(x + 3.0, 0.45, -5.8);
  env.add(post);
}

function houses(env: THREE.Group): void {
  house(env, 46, '#e8d8b8', '#7a4a3a');
  house(env, 54, '#b8d0e0', '#3a4a5a');
  house(env, 62, '#f0c8a8', '#5a3a2a');
  tree(env, 50, -7.2, 1.1);
  tree(env, 58, -7.4, 1.25);
  // grill on a lawn
  const grill = mesh(sph(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#1a1a1a', { rough: 0.4 }));
  grill.rotation.x = Math.PI;
  grill.position.set(52.5, 1.0, -6.9);
  env.add(grill);
  for (const s of [-1, 1]) {
    const leg = mesh(cyl(0.03, 0.03, 1.0, 6), M('#1a1a1a'));
    leg.position.set(52.5 + s * 0.25, 0.5, -6.9);
    env.add(leg);
  }
}

function mall(env: THREE.Group): void {
  const x0 = 66;
  const x1 = 90;
  const len = x1 - x0;
  const body = mesh(box(len, 4.6, 4), M('#e8e0d0', { plain: true, rough: 0.9 }));
  body.position.set((x0 + x1) / 2, 2.3, -10.5);
  env.add(body);
  const cap = mesh(rbox(len + 0.4, 0.5, 4.4, 0.06), M('#8a7a6a', { plain: true }));
  cap.position.set((x0 + x1) / 2, 4.75, -10.4);
  env.add(cap);
  const shops: [string, string][] = [['PRETZEL HUT', '#d8262b'], ['GAME ZONE', '#3a4ad8'], ['DONUTS', '#ff5fb0'], ['SHOE BARN', '#2fa86a']];
  shops.forEach(([name, color], i) => {
    const sx = x0 + 3 + i * 6;
    const glass = mesh(new THREE.PlaneGeometry(4.6, 2.4), M('#9fc0d8', { plain: true, rough: 0.05, metal: 0.3 }), false);
    glass.position.set(sx, 1.5, -8.48);
    env.add(glass);
    const frame = mesh(rbox(4.8, 2.6, 0.12, 0.03), M('#3a3a42', { plain: true }), false);
    frame.position.set(sx, 1.5, -8.56);
    env.add(frame);
    const awn = mesh(box(5.0, 0.1, 1.4), M(color, { rough: 0.7 }));
    awn.position.set(sx, 3.0, -7.8);
    awn.rotation.x = 0.35;
    env.add(awn);
    const tex = texture(512, 96, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '64px "Lilita One", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, w / 2, h / 2 + 4);
    });
    const sign = mesh(new THREE.PlaneGeometry(4.2, 0.8), M('#ffffff', { map: tex }), false);
    sign.position.set(sx, 3.9, -8.45);
    env.add(sign);
  });
  // parking lot strip with planters
  for (let x = x0; x < x1; x += 6) {
    const pl = mesh(rbox(1.2, 0.5, 1.2, 0.06), M('#a89c8a', { plain: true }));
    pl.position.set(x, 0.25, -6.6);
    env.add(pl);
    const bush = mesh(sph(0.6, 14, 10), M('#4f9440'));
    bush.position.set(x, 0.9, -6.6);
    env.add(bush);
  }
}

function park(env: THREE.Group): void {
  for (const [x, z, s] of [[93, -7, 1.3], [98, -9, 1.5], [110, -7.5, 1.4], [116, -9.5, 1.6], [122, -7, 1.3], [104.5, -12, 1.7]] as const) tree(env, x, z, s);
  // gate pillars and arch
  for (const gx of [100.5, 108.5]) {
    const pil = mesh(rbox(1.0, 3.6, 1.0, 0.05), M('#9a4a34', { plain: true, rough: 0.9 }));
    pil.position.set(gx, 1.8, -6.8);
    env.add(pil);
    const capS = mesh(rbox(1.3, 0.3, 1.3, 0.05), M('#cfc4b0', { plain: true }));
    capS.position.set(gx, 3.75, -6.8);
    env.add(capS);
  }
  for (let gx = 101.2; gx < 108; gx += 0.35) {
    const bar = mesh(cyl(0.03, 0.03, 2.8, 6), M('#2a2a30', { metal: 0.6, rough: 0.4 }));
    bar.position.set(gx, 1.4, -6.8);
    env.add(bar);
  }
  const archTex = texture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '96px "Lilita One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WESTBROOK PARK', w / 2, h / 2 + 6);
  });
  const arch = mesh(new THREE.PlaneGeometry(8.4, 1.1), M('#ffffff', { map: archTex }), false);
  arch.position.set(104.5, 4.6, -6.7);
  env.add(arch);
  const archBack = mesh(rbox(8.7, 1.3, 0.2, 0.05), M('#2a2a30', { plain: true }));
  archBack.position.set(104.5, 4.6, -6.85);
  env.add(archBack);
  // fence along the park
  for (let x = 90; x < X1; x += 2) {
    if (x > 99.5 && x < 109.5) continue;
    const post = mesh(cyl(0.05, 0.05, 1.4, 6), M('#2a2a30', { metal: 0.5 }));
    post.position.set(x, 0.7, -6.8);
    env.add(post);
    const rail = mesh(box(2, 0.05, 0.05), M('#2a2a30', { metal: 0.5 }), false);
    rail.position.set(x + 1, 1.2, -6.8);
    env.add(rail);
  }
  const bench = mesh(rbox(2, 0.12, 0.6, 0.04), M('#8a5a32', { rough: 0.8 }));
  bench.position.set(95, 0.5, -5.8);
  env.add(bench);
}

function tree(env: THREE.Group, x: number, z: number, s = 1): void {
  const trunk = mesh(cyl(0.12 * s, 0.18 * s, 2.0 * s, 10), M('#6a4a2b', { rough: 0.9 }));
  trunk.position.set(x, 1.0 * s, z);
  env.add(trunk);
  const leaf = '#5a8f3e';
  const blobs: [number, number, number, number][] = [[0, 2.5, 0, 1.0], [-0.6, 2.2, 0.1, 0.75], [0.65, 2.25, 0, 0.8], [0.1, 3.05, 0, 0.7], [0, 2.3, 0.5, 0.7]];
  blobs.forEach(([a, b, c, r], i) => {
    const m = mesh(sph(r * s, 16, 12), M(new THREE.Color(leaf).offsetHSL(0, 0, i * 0.02 - 0.03).getStyle(), { rough: 0.9 }));
    m.position.set(x + a * s, b * s, z + c * s);
    env.add(m);
  });
}

function farTree(env: THREE.Group, x: number, z: number): void {
  const m = mesh(sph(1.8, 10, 8), M('#5f8f4a', { plain: true, rough: 1 }), false);
  m.scale.set(1, 1.2, 1);
  m.position.set(x, 1.8, z);
  env.add(m);
}

function streetlight(env: THREE.Group, x: number, z: number): void {
  const c = M('#3f5a6a', { metal: 0.4, rough: 0.5 });
  const pole = mesh(cyl(0.07, 0.09, 5, 10), c);
  pole.position.set(x, 2.5, z - 1.6);
  env.add(pole);
  const arm = mesh(rbox(1.1, 0.1, 0.1), c);
  arm.position.set(x + 0.5, 4.95, z - 1.6);
  env.add(arm);
  const lamp = mesh(rbox(0.6, 0.2, 0.35, 0.08), M('#e8e4d0', { plain: true }));
  lamp.position.set(x + 0.95, 4.85, z - 1.6);
  env.add(lamp);
}
