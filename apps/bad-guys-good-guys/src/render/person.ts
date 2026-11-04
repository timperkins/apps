import * as THREE from 'three';
import type { EnemyKind } from '../core/config';
import type { Look } from '../core/look';
import { M, bake, canvasTex, cap, cyl, mesh, rbox, sph, taper, torsoGeo } from './materials';

/**
 * People built from simple shapes with realistic proportions, plus the limb pivots that
 * the animator turns. Each body part's meshes are merged so a person costs few draw calls.
 */

export interface PersonSpec {
  kid: boolean;
  skin: string;
  eyes?: string;
  shirt: string;
  pants: string;
  shoes: string;
  shoeSole?: string;
  w?: number;
  legW?: number;
  armW?: number;
  legLen?: number;
  torsoH?: number;
  headR?: number;
  armLen?: number;
  hair: string;
  hairColor: string;
  shorts?: boolean;
  skirt?: boolean;
  shortSleeve?: boolean;
  sleeveColor?: string;
  socks?: string;
  belly?: boolean;
  apron?: string;
  vest?: string;
  hood?: boolean;
  straps?: string;
  number?: string;
  jaw?: boolean;
  mustache?: boolean;
  noseR?: number;
  glasses?: 'round' | 'square' | 'goggles' | 'none';
  glassesColor?: string;
  hat?: string;
  hatColor?: string;
  hairnet?: boolean;
  whistle?: boolean;
  backpack?: string;
  cape?: string;
  gloves?: string;
  tie?: string;
  stripe?: string;
  brow?: number;
  frown?: boolean;
  robe?: string;
}

export class Rig {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly head = new THREE.Group();
  readonly legs: THREE.Group[] = [];
  readonly arms: THREE.Group[] = [];
  readonly hands: THREE.Group[] = [];
  readonly height: number;
  readonly headY: number;
  readonly hipY: number;
  readonly kid: boolean;
  cape: THREE.Mesh | null = null;
  materials: THREE.Material[] = [];

  constructor(o: PersonSpec) {
    this.kid = o.kid;
    const kid = o.kid;
    const w = o.w ?? 1;
    const headR = (o.headR ?? (kid ? 0.33 : 0.25)) * (kid ? 0.68 : 0.72);
    const legLen = (o.legLen ?? (kid ? 0.48 : 0.85)) * (kid ? 1.35 : 1.12);
    const torsoH = (o.torsoH ?? (kid ? 0.5 : 0.78)) * (kid ? 1.05 : 1);
    const legR = (kid ? 0.085 : 0.11) * (o.legW ?? w);
    const shoeH = 0.12;
    const hipY = legLen + shoeH;
    this.hipY = hipY;
    const skin = M(o.skin, { skin: true });
    const shirt = M(o.shirt);
    const pants = M(o.pants);
    const shoe = M(o.shoes);
    this.root.add(this.body);

    // Legs
    for (const s of [-1, 1]) {
      const piv = new THREE.Group();
      piv.userData.pivot = true;
      piv.position.set(s * (kid ? 0.12 : 0.15) * w, hipY, 0);
      const bare = o.shorts || o.skirt;
      const leg = mesh(taper(legR * 1.35, legR * 0.75, legLen - legR), bare ? skin : pants);
      leg.position.y = -legLen / 2 + legR * 0.3;
      piv.add(leg);
      if (o.shorts) {
        const sh = mesh(taper(legR * 1.6, legR * 1.45, legLen * 0.25), pants);
        sh.position.y = -legLen * 0.15;
        piv.add(sh);
      }
      if (o.stripe && !bare) {
        const st = mesh(rbox(0.03, legLen * 0.9, 0.03, 0.01), M(o.stripe));
        st.position.set(s * legR * 1.1, -legLen / 2, 0);
        piv.add(st);
      }
      if (o.socks) {
        const so = mesh(cyl(legR * 0.85, legR * 0.8, 0.14), M(o.socks));
        so.position.y = -legLen + 0.1;
        piv.add(so);
      }
      const sh = mesh(rbox(legR * 2.2, shoeH, legR * 3.6, 0.05), shoe);
      sh.position.set(0, -legLen - 0.02, legR * 0.8);
      piv.add(sh);
      const sole = mesh(rbox(legR * 2.3, 0.04, legR * 3.7, 0.015), M(o.shoeSole ?? '#f2f0ea'));
      sole.position.set(0, -legLen - 0.075, legR * 0.8);
      piv.add(sole);
      bake(piv);
      this.legs.push(piv);
      this.body.add(piv);
    }

    // Torso
    const tw = (kid ? 0.26 : 0.3) * w;
    const torso = mesh(torsoGeo(torsoH + 0.06, tw * 0.95, tw * 0.82, tw * 1.0, tw * 1.08, headR * 0.45), shirt);
    torso.scale.set(1, 1, 0.62);
    torso.position.y = hipY + torsoH / 2 - 0.02;
    this.body.add(torso);
    if (o.skirt) {
      const sk = mesh(cyl(tw * 0.95, tw * 1.55, legLen * 0.45, 24), pants);
      sk.scale.z = 0.8;
      sk.position.y = hipY - legLen * 0.18;
      this.body.add(sk);
    } else {
      const hips = mesh(sph(tw * 0.98, 20, 12), pants);
      hips.scale.set(1, 0.55, 0.66);
      hips.position.y = hipY + 0.02;
      this.body.add(hips);
    }
    if (o.robe) {
      const rb = mesh(cyl(tw * 0.95, tw * 1.35, legLen * 0.9, 24), M(o.robe));
      rb.scale.z = 0.75;
      rb.position.y = hipY - legLen * 0.38;
      this.body.add(rb);
    }
    if (o.belly) {
      const b = mesh(sph(tw * 1.12), shirt);
      b.scale.set(1.05, 0.95, 1.0);
      b.position.set(0, hipY + torsoH * 0.38, tw * 0.28);
      this.body.add(b);
    }
    const frontZ = tw * 0.66 + (o.belly ? tw * 0.6 : 0);
    if (o.apron) {
      const a = mesh(rbox(tw * 1.4, torsoH * 0.95, 0.04, 0.02), M(o.apron));
      a.position.set(0, hipY + torsoH * 0.38, frontZ);
      this.body.add(a);
    }
    if (o.vest) {
      const v = mesh(torsoGeo(torsoH * 0.85, tw * 1.0, tw * 0.9, tw * 1.06, tw * 1.12, headR * 0.5), M(o.vest));
      v.scale.set(1.02, 1, 0.68);
      v.position.y = hipY + torsoH * 0.48;
      this.body.add(v);
      for (const f of [0.3, 0.55]) {
        const st = mesh(cyl(tw * 1.07, tw * 1.07, 0.05, 24), M('#e9f2ff', { rough: 0.3 }));
        st.scale.z = 0.7;
        st.position.y = hipY + torsoH * f;
        this.body.add(st);
      }
    }
    if (o.tie) {
      const t = mesh(rbox(0.07, torsoH * 0.55, 0.03, 0.01), M(o.tie));
      t.position.set(0, hipY + torsoH * 0.6, frontZ + 0.02);
      this.body.add(t);
      const col = mesh(rbox(tw * 0.9, 0.06, 0.05, 0.02), M('#f4f4f4'));
      col.position.set(0, hipY + torsoH * 0.92, tw * 0.5);
      this.body.add(col);
    }
    if (o.hood) {
      const hd = mesh(sph(tw * 0.9), shirt);
      hd.scale.set(1.25, 0.5, 0.85);
      hd.position.set(0, hipY + torsoH + 0.0, -tw * 0.3);
      this.body.add(hd);
    }
    if (o.straps) {
      for (const s of [-1, 1]) {
        const st = mesh(rbox(0.06, torsoH * 0.6, 0.03, 0.015), M(o.straps));
        st.position.set(s * tw * 0.45, hipY + torsoH * 0.62, tw * 0.6);
        this.body.add(st);
      }
      const bib = mesh(rbox(tw * 1.15, torsoH * 0.4, 0.04, 0.02), M(o.straps));
      bib.position.set(0, hipY + torsoH * 0.28, tw * 0.62);
      this.body.add(bib);
    }
    if (o.number) {
      const nt = canvasTex(128, 128, (ctx) => {
        ctx.fillStyle = '#fff';
        ctx.font = '700 96px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.number!, 64, 70);
      });
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: nt, transparent: true }));
      n.position.set(0, hipY + torsoH * 0.55, tw * 0.64);
      this.body.add(n);
    }
    if (o.whistle) {
      const wh = mesh(rbox(0.07, 0.05, 0.1, 0.02), M('#d8d8e0', { metal: 0.7, rough: 0.3 }));
      wh.position.set(0.05, hipY + torsoH * 0.62, frontZ + 0.03);
      this.body.add(wh);
    }
    if (o.backpack) {
      const bp = mesh(rbox(tw * 1.5, torsoH * 0.75, 0.25, 0.08), M(o.backpack));
      bp.position.set(0, hipY + torsoH * 0.55, -tw * 0.75);
      this.body.add(bp);
      const pk = mesh(rbox(tw * 1.0, torsoH * 0.3, 0.1, 0.04), M(o.backpack));
      pk.position.set(0, hipY + torsoH * 0.38, -tw * 0.75 - 0.15);
      this.body.add(pk);
    }
    if (o.cape) {
      const ch = torsoH + legLen * 0.6;
      const geo = new THREE.PlaneGeometry(tw * 2.3, ch, 4, 6);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        p.setZ(i, -Math.pow(0.5 - y / ch, 2) * 0.5 + Math.sin(p.getX(i) * 9) * 0.03);
      }
      geo.computeVertexNormals();
      const cp = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: o.cape, side: THREE.DoubleSide, roughness: 0.6 }));
      cp.castShadow = true;
      cp.userData.keep = true;
      const cpiv = new THREE.Group();
      cpiv.userData.pivot = true;
      cpiv.position.set(0, hipY + torsoH * 0.95, -tw * 0.6);
      cp.position.y = -ch / 2;
      cpiv.add(cp);
      cpiv.rotation.x = 0.2;
      this.body.add(cpiv);
      this.cape = cp;
    }

    // Arms
    const shY = hipY + torsoH - 0.08;
    const armLen = (o.armLen ?? (kid ? 0.42 : 0.66)) * (kid ? 1.3 : 1.12);
    const armR = (kid ? 0.07 : 0.085) * (o.armW ?? w);
    for (const s of [-1, 1]) {
      const piv = new THREE.Group();
      piv.userData.pivot = true;
      piv.position.set(s * (tw * 1.02 + armR * 0.5), shY, 0);
      const sleeve = o.sleeveColor ? M(o.sleeveColor) : shirt;
      const up = mesh(taper(armR * 1.2, armR * 0.75, armLen - armR), o.shortSleeve ? skin : sleeve);
      up.position.y = -armLen / 2 + armR;
      piv.add(up);
      if (o.shortSleeve) {
        const sl = mesh(taper(armR * 1.5, armR * 1.35, armLen * 0.22), sleeve);
        sl.position.y = -armR * 0.9;
        piv.add(sl);
      }
      const hand = mesh(sph(armR * 1.0, 14, 10), o.gloves ? M(o.gloves) : skin);
      hand.position.y = -armLen + armR * 0.4;
      piv.add(hand);
      const hp = new THREE.Group();
      hp.userData.pivot = true;
      hp.position.y = -armLen + armR * 0.4;
      piv.add(hp);
      bake(piv);
      this.hands.push(hp);
      this.arms.push(piv);
      this.body.add(piv);
    }

    // Head
    const headY = hipY + torsoH + headR * 0.85;
    this.headY = headY;
    this.height = headY + headR * 1.3;
    this.head.position.y = headY;
    this.head.userData.pivot = true;
    this.body.add(this.head);
    const head = this.head;
    const nk = mesh(cyl(headR * 0.4, headR * 0.46, headR * 0.9, 16), skin);
    nk.position.y = -headR * 0.85;
    head.add(nk);
    const skull = mesh(sph(headR, 32, 24), skin);
    skull.scale.set(1, 1.04, 0.96);
    head.add(skull);
    if (o.jaw) {
      const j = mesh(sph(headR * 0.8), skin);
      j.scale.set(1.05, 0.6, 0.9);
      j.position.set(0, -headR * 0.45, headR * 0.15);
      head.add(j);
    }
    for (const s of [-1, 1]) {
      const ear = mesh(sph(headR * 0.22, 12, 10), skin);
      ear.scale.set(0.6, 1, 0.8);
      ear.position.set(s * headR * 0.97, -headR * 0.05, 0);
      head.add(ear);
    }
    const eyeY = headR * (kid ? 0.1 : 0.2);
    const eyeX = headR * (kid ? 0.34 : 0.3);
    const eyeR = headR * (kid ? 0.144 : 0.1);
    const white = M('#fbf8f4', { plain: true, rough: 0.25 });
    const iris = M(o.eyes ?? '#5a3a20', { plain: true, rough: 0.3 });
    const pupil = M('#140f14', { plain: true, rough: 0.2 });
    const brow = M(o.hairColor);
    for (const s of [-1, 1]) {
      const ew = mesh(sph(eyeR, 16, 12), white, false);
      ew.scale.set(0.9, 1.0, 0.5);
      ew.position.set(s * eyeX, eyeY, headR * 0.9);
      head.add(ew);
      const ir = mesh(sph(eyeR * 0.62, 12, 10), iris, false);
      ir.scale.set(1, 1.05, 0.5);
      ir.position.set(s * eyeX + 0.03 * headR, eyeY, headR * 0.955);
      head.add(ir);
      const pu = mesh(sph(eyeR * 0.32, 10, 8), pupil, false);
      pu.scale.set(1, 1.1, 0.5);
      pu.position.set(s * eyeX + 0.03 * headR, eyeY, headR * 0.98);
      head.add(pu);
      const br = mesh(rbox(eyeR * 2.1, eyeR * 0.45, eyeR * 0.5, 0.015), brow, false);
      br.position.set(s * eyeX, eyeY + eyeR * 1.6, headR * 0.92);
      br.rotation.z = s * -(o.brow ?? 0);
      head.add(br);
    }
    const nose = mesh(sph(headR * (o.noseR ?? (kid ? 0.11 : 0.15)), 12, 10), skin);
    nose.scale.set(1, 1.1, 1.1);
    nose.position.set(0, eyeY - headR * 0.28, headR * 0.98);
    head.add(nose);
    const mouthY = eyeY - headR * 0.55;
    const mouth = mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.035, 6, 16, Math.PI), M('#7a2a30', { plain: true }), false);
    mouth.rotation.z = o.frown ? 0 : Math.PI;
    mouth.position.set(0, mouthY + (o.frown ? -headR * 0.1 : headR * 0.06), headR * 0.9);
    head.add(mouth);
    if (o.mustache) {
      const mu = mesh(cap(headR * 0.07, headR * 0.35), M(o.hairColor, { hair: true }));
      mu.rotation.z = Math.PI / 2;
      mu.position.set(0, mouthY + headR * 0.17, headR * 0.98);
      head.add(mu);
    }
    if (o.glasses && o.glasses !== 'none') {
      const gc = M(o.glassesColor ?? '#1a1a22', { plain: true, rough: 0.3 });
      if (o.glasses === 'goggles') {
        const band = mesh(new THREE.TorusGeometry(headR * 1.0, headR * 0.06, 8, 28), M('#2a2a34'));
        band.rotation.x = Math.PI / 2;
        band.position.y = eyeY;
        head.add(band);
        for (const s of [-1, 1]) {
          const g = mesh(cyl(eyeR * 1.6, eyeR * 1.6, headR * 0.18, 16), M('#ffb020', { plain: true, rough: 0.2 }));
          g.rotation.x = Math.PI / 2;
          g.position.set(s * eyeX, eyeY, headR * 0.98);
          head.add(g);
        }
      } else {
        for (const s of [-1, 1]) {
          const r = mesh(
            o.glasses === 'square' ? new THREE.TorusGeometry(eyeR * 1.5, eyeR * 0.18, 4, 4) : new THREE.TorusGeometry(eyeR * 1.4, eyeR * 0.16, 6, 20),
            gc,
            false,
          );
          if (o.glasses === 'square') r.rotation.z = Math.PI / 4;
          r.position.set(s * eyeX, eyeY, headR * 1.0);
          head.add(r);
        }
        const bridge = mesh(rbox(eyeX * 0.6, eyeR * 0.2, eyeR * 0.2, 0.01), gc, false);
        bridge.position.set(0, eyeY, headR * 1.02);
        head.add(bridge);
      }
    }
    this.addHair(o, headR);
    this.addHat(o, headR, eyeY);
    bake(head);
    bake(this.body);
    this.root.traverse((n) => {
      const m = (n as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !this.materials.includes(m)) this.materials.push(m);
    });
  }

  private addHair(o: PersonSpec, headR: number): void {
    const hc = M(o.hairColor, { hair: true });
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, mat: THREE.Material = hc) => {
      const m = mesh(geo, mat);
      m.position.set(x * headR, y * headR, z * headR);
      m.scale.set(sx, sy, sz);
      this.head.add(m);
      return m;
    };
    // A skull cap tilted back so the hairline sits above the eyebrows.
    const capHair = (cover = 0.5) => {
      const m = add(sph(headR * 1.06, 28, 18, 0, Math.PI * 2, 0, Math.PI * cover), 0, 0.02, -0.06, 1, 1, 1);
      m.rotation.x = -0.6;
      return m;
    };
    switch (o.hair) {
      case 'buzz':
        capHair(0.48).scale.set(0.98, 0.98, 0.98);
        break;
      case 'spiky': {
        capHair(0.5);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const c = add(new THREE.ConeGeometry(headR * 0.26, headR * 0.65, 8), Math.cos(a) * 0.5, 0.92, Math.sin(a) * 0.45 - 0.05);
          c.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        }
        add(new THREE.ConeGeometry(headR * 0.28, headR * 0.75, 8), 0, 1.12, 0.05);
        break;
      }
      case 'curly':
        capHair(0.52);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          add(sph(headR * 0.3, 10, 8), Math.cos(a) * 0.82, 0.55 + Math.sin(i * 1.7) * 0.15, Math.sin(a) * 0.8 - 0.1);
        }
        add(sph(headR * 0.85, 16, 12), 0, 0.45, -0.1);
        break;
      case 'afro':
        add(sph(headR * 1.32, 24, 18), 0, 0.35, -0.2, 1.05, 0.95, 1);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const b = 0.4 + (i % 3) * 0.35;
          add(sph(headR * 0.42, 12, 10), Math.cos(a) * Math.sin(b + 0.3) * 1.15, 0.35 + Math.cos(b) * 0.9, Math.sin(a) * Math.sin(b + 0.3) * 1.0 - 0.25);
        }
        break;
      case 'pigtails':
        capHair(0.55);
        for (const s of [-1, 1]) {
          add(sph(headR * 0.4), s * 1.15, -0.15, -0.15, 0.85, 1.25, 0.85);
          const tie = add(new THREE.TorusGeometry(headR * 0.15, headR * 0.06, 6, 12), s * 0.98, 0.12, -0.12, 1, 1, 1, M(o.hatColor ?? '#ff4fa0'));
          tie.rotation.y = Math.PI / 2;
        }
        break;
      case 'ponytail':
        capHair(0.55);
        add(sph(headR * 0.32), 0, 0.55, -1.0);
        add(cap(headR * 0.22, headR * 1.0), 0, -0.1, -1.1, 1, 1, 0.8).rotation.x = 0.35;
        break;
      case 'long':
        capHair(0.58);
        add(rbox(headR * 2.0, headR * 2.0, headR * 0.6, 0.15), 0, -0.45, -0.6);
        for (const s of [-1, 1]) add(rbox(headR * 0.35, headR * 1.5, headR * 0.6, 0.12), s * 0.92, -0.35, -0.05);
        break;
      case 'mohawk':
        capHair(0.45).scale.set(0.97, 0.97, 0.97);
        for (let i = 0; i < 6; i++) add(new THREE.ConeGeometry(headR * 0.18, headR * 0.7, 6), 0, 1.0 + Math.sin((i / 5) * Math.PI) * 0.12, 0.6 - i * 0.28).rotation.x = -0.3 + i * 0.12;
        break;
      case 'bowl':
        add(sph(headR * 1.1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.6), 0, 0.05, -0.05, 1, 1.0, 1).rotation.x = -0.45;
        break;
      case 'bun':
        capHair(0.55);
        add(sph(headR * 0.48), 0, 0.85, -0.55);
        if (o.hairnet) {
          const n = add(sph(headR * 1.12, 20, 14), 0, 0.25, -0.15, 1, 0.92, 1, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3 }));
          n.castShadow = false;
        }
        break;
      case 'bald':
        for (const s of [-1, 1]) add(sph(headR * 0.4), s * 0.82, 0.05, -0.25, 0.6, 0.9, 1.2);
        add(sph(headR * 0.5), 0, 0.15, -0.8, 1.6, 0.9, 0.6);
        break;
      case 'flattop':
        add(rbox(headR * 1.9, headR * 0.6, headR * 1.8, 0.06), 0, 0.85, -0.05);
        capHair(0.5);
        break;
      case 'curlers':
        capHair(0.55);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 1.4 - Math.PI * 0.2;
          const c = add(cyl(headR * 0.16, headR * 0.16, headR * 0.5, 10), Math.cos(a) * 0.75, 0.75 + Math.sin(i) * 0.1, Math.sin(a) * -0.6, 1, 1, 1, M(i % 2 ? '#ff8ab8' : '#8ad0ff'));
          c.rotation.z = Math.PI / 2;
        }
        break;
      case 'side':
        capHair(0.5);
        add(sph(headR * 0.5), -0.55, 0.65, 0.35, 1.2, 0.5, 0.8);
        break;
    }
  }

  private addHat(o: PersonSpec, headR: number, eyeY: number): void {
    if (!o.hat || o.hat === 'none') return;
    const hc = M(o.hatColor ?? '#e8423a');
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, mat: THREE.Material = hc) => {
      const m = mesh(geo, mat);
      m.position.set(x * headR, y * headR, z * headR);
      this.head.add(m);
      return m;
    };
    switch (o.hat) {
      case 'cap':
      case 'backwards': {
        add(sph(headR * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.12, 0).scale.set(1, 0.85, 1);
        const brim = add(rbox(headR * 1.25, headR * 0.07, headR * 0.95, 0.03), 0, 0.18, o.hat === 'backwards' ? -1.25 : 1.25);
        brim.rotation.x = o.hat === 'backwards' ? -0.15 : 0.15;
        break;
      }
      case 'beanie':
        add(sph(headR * 1.12, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 0.12, 0).scale.set(1, 1.05, 1);
        add(sph(headR * 0.25, 10, 8), 0, 1.25, 0, M('#ffffff'));
        break;
      case 'headband': {
        const hb = add(new THREE.TorusGeometry(headR * 1.0, headR * 0.09, 8, 28), 0, 0.42, 0);
        hb.rotation.x = Math.PI / 2 + 0.2;
        break;
      }
      case 'helmet':
        add(sph(headR * 1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.1, 0).scale.set(1, 0.9, 1.15);
        for (let i = -1; i <= 1; i++) add(rbox(headR * 0.15, headR * 0.12, headR * 1.6, 0.03), i * 0.4, 1.12, 0, M('#1a1a22'));
        break;
      case 'crown': {
        add(cyl(headR * 0.8, headR * 0.8, headR * 0.35, 20), 0, 1.05, 0, M('#ffcf3a', { metal: 0.7, rough: 0.25 }));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(new THREE.ConeGeometry(headR * 0.16, headR * 0.35, 6), Math.cos(a) * 0.72, 1.38, Math.sin(a) * 0.72, M('#ffcf3a', { metal: 0.7, rough: 0.25 }));
        }
        break;
      }
      case 'guard':
        add(cyl(headR * 1.05, headR * 1.1, headR * 0.45, 24), 0, 0.75, 0, M('#25305a'));
        add(rbox(headR * 1.6, headR * 0.08, headR * 0.8, 0.03), 0, 0.55, 0.85, M('#151a33'));
        add(sph(headR * 0.13), 0, 0.78, 1.05, M('#ffd23f', { metal: 0.6, rough: 0.3 }));
        break;
      case 'police':
        add(cyl(headR * 1.15, headR * 1.0, headR * 0.5, 24), 0, 0.8, 0, M('#1f2a4a'));
        add(rbox(headR * 1.5, headR * 0.08, headR * 0.7, 0.03), 0, 0.55, 0.9, M('#0f1426'));
        add(sph(headR * 0.15), 0, 0.85, 1.12, M('#e0e0e8', { metal: 0.8, rough: 0.3 }));
        break;
    }
    void eyeY;
  }

  setOpacity(a: number): void {
    for (const m of this.materials) {
      m.transparent = a < 1;
      m.opacity = a;
    }
  }
}

// ---------------------------------------------------------------- kids from looks

export function kidSpec(look: Look): PersonSpec {
  const build = [0.9, 1, 1.12][look.build] ?? 1;
  const spec: PersonSpec = {
    kid: true,
    skin: look.skin,
    eyes: look.eyes,
    shirt: look.topColor,
    pants: look.bottomColor,
    shoes: look.shoes,
    w: [0.95, 1, 1.02][look.build],
    legLen: 0.48 * build,
    torsoH: 0.5 * (0.95 + (build - 1) * 0.6),
    armLen: 0.42 * build,
    hair: look.hair,
    hairColor: look.hairColor,
    hat: look.hat,
    hatColor: look.hatColor,
    glasses: look.glasses,
    brow: 0.15,
  };
  switch (look.top) {
    case 'hoodie': spec.hood = true; break;
    case 'tee': spec.shortSleeve = true; break;
    case 'jersey': spec.shortSleeve = true; spec.number = String(1 + (look.name.charCodeAt(0) % 30)); break;
    case 'overalls': spec.shortSleeve = true; spec.straps = look.bottomColor; break;
    case 'jacket': spec.sleeveColor = '#f4f1e8'; break;
  }
  switch (look.bottom) {
    case 'shorts': spec.shorts = true; spec.socks = '#ffffff'; break;
    case 'skirt': spec.skirt = true; spec.socks = '#ffffff'; break;
    case 'track': spec.stripe = '#ffffff'; break;
  }
  if (look.back === 'backpack') spec.backpack = look.backColor;
  if (look.back === 'cape') spec.cape = look.backColor;
  return spec;
}

// ---------------------------------------------------------------- grown-ups

export const ADULTS: Record<EnemyKind, PersonSpec> = {
  lunch: { kid: false, skin: '#f0b890', shirt: '#4fb8b0', pants: '#2a3458', shoes: '#f4f4f4', w: 1.4, legLen: 0.6, torsoH: 0.75, headR: 0.27, hair: 'bun', hairColor: '#8a4a2a', hairnet: true, apron: '#ffffff', belly: true, jaw: true, brow: -0.2 },
  dad: { kid: false, skin: '#f4c09a', shirt: '#ff8a3a', pants: '#c9b07a', shorts: true, shortSleeve: true, shoes: '#7a4a2a', socks: '#ffffff', w: 1.55, legW: 1.1, armW: 1.25, legLen: 0.78, torsoH: 0.9, headR: 0.27, belly: true, jaw: true, hair: 'bald', hairColor: '#5a3a24', mustache: true, brow: 0.3 },
  coach: { kid: false, skin: '#a8704c', shirt: '#2a4ad8', pants: '#2a4ad8', stripe: '#ffffff', shoes: '#ffffff', shoeSole: '#2a2a2a', w: 0.85, legLen: 1.05, torsoH: 0.85, headR: 0.24, hair: 'flattop', hairColor: '#1a1410', whistle: true, hat: 'headband', hatColor: '#ff3a3a', brow: 0.45 },
  guard: { kid: false, skin: '#e9c0a0', shirt: '#2a3a6a', pants: '#2a3a6a', shoes: '#1a1a1a', w: 0.75, legLen: 0.95, torsoH: 0.75, headR: 0.23, noseR: 0.24, hair: 'bald', hairColor: '#d8d8d8', mustache: true, vest: '#c8ff2a', hat: 'guard', gloves: '#ffffff', brow: 0.5, frown: true },
  watch: { kid: false, skin: '#f2c8a8', shirt: '#c98ad8', pants: '#c98ad8', robe: '#c98ad8', shoes: '#ff9ac0', w: 0.8, legLen: 0.5, torsoH: 0.62, headR: 0.24, hair: 'curlers', hairColor: '#b8b8c0', glasses: 'round', glassesColor: '#8a3a6a', brow: 0.4, frown: true },
  cop: { kid: false, skin: '#c98e64', shirt: '#7a8aa8', pants: '#1f2a4a', shoes: '#111111', w: 1.45, legLen: 0.78, torsoH: 0.82, headR: 0.26, belly: true, jaw: true, hair: 'side', hairColor: '#2a1a10', hat: 'police', mustache: true, brow: 0.35 },
  boss: { kid: false, skin: '#e8b898', shirt: '#3a3a48', pants: '#2a2a34', shoes: '#111111', w: 1.7, legW: 1.25, armW: 1.4, legLen: 1.2, torsoH: 1.15, headR: 0.34, belly: true, jaw: true, hair: 'side', hairColor: '#4a4a52', tie: '#c8262b', glasses: 'square', mustache: true, brow: 0.55, frown: true },
};

export function adultRig(kind: EnemyKind): Rig {
  return new Rig(ADULTS[kind]);
}
