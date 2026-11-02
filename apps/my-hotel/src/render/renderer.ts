// Draws a hotel each frame: the static world (rebuilt when the layout changes) plus the live
// layer of people, pads, coins, bubbles and progress rings.
import * as THREE from 'three';
import { CLEAN_TIME, PATIENCE, pads, type Hotel, type Pad } from '../sim/hotel';
import { COIN_PILE, DESK_ZONE, roomGeom } from '../sim/layout';
import { Label, UI_FONT, ball, box, drawBubble, drawRing, mat, roundRect } from './kit';
import { PLAYER_LOOK, animatePerson, makePerson, turnTowards, type Person } from './people';
import { THEMES, type Theme } from './theme';
import { buildWorld } from './world';

const CAM_OFFSET = new THREE.Vector3(0, 23, 17.5);

interface GuestView {
  person: Person;
  bubble: Label;
}

interface RoomView {
  group: THREE.Group;
  key: string;
  ring: Label;
}

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private sun: THREE.DirectionalLight;
  private T: Theme;
  private world: THREE.Group | null = null;
  private worldVersion = -1;
  private live = new THREE.Group();
  private player: Person;
  private playerRing: THREE.Mesh;
  private guests = new Map<number, GuestView>();
  private staff = new Map<string, Person>();
  private rooms = new Map<number, RoomView>();
  private padViews = new Map<string, { mesh: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string }>();
  private pile = new THREE.Group();
  private pileCount = -1;
  private deskRing = new Label(256, 256, 1.3);
  private camTarget = new THREE.Vector3();
  private time = 0;

  constructor(canvas: HTMLCanvasElement, h: Hotel) {
    this.T = THEMES[h.map];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(this.T.bg);
    this.scene.fog = new THREE.Fog(this.T.bg, 45, 90);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
    this.scene.add(new THREE.HemisphereLight(this.T.hemiSky, this.T.hemiGround, 1.6));
    this.sun = new THREE.DirectionalLight(this.T.sun, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target, this.live);

    this.player = makePerson(PLAYER_LOOK, 1.15);
    this.playerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.95, 40),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }),
    );
    this.playerRing.rotation.x = -Math.PI / 2;
    this.live.add(this.player.root, this.playerRing, this.pile, this.deskRing.sprite);
    this.deskRing.sprite.position.set((DESK_ZONE.x0 + DESK_ZONE.x1) / 2, 3.4, (DESK_ZONE.z0 + DESK_ZONE.z1) / 2);

    this.camTarget.set(h.player.pos.x, 0, h.player.pos.z);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep about the same amount of hotel in view on narrow screens
    this.camera.fov = w / h < 1 ? 55 : 38;
    this.camera.updateProjectionMatrix();
  }

  render(h: Hotel, dt: number) {
    this.time += dt;
    if (h.layoutVersion !== this.worldVersion) {
      if (this.world) disposeGroup(this.world, this.scene);
      this.world = buildWorld(h, this.T);
      this.scene.add(this.world);
      this.worldVersion = h.layoutVersion;
    }
    this.updatePlayer(h);
    this.updateGuests(h);
    this.updateStaff(h);
    this.updateRooms(h);
    this.updatePads(h);
    this.updatePile(h);
    this.updateDesk(h);

    // follow the player
    const p = h.player.pos;
    this.camTarget.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 6));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z - 1.5);
    this.sun.position.set(this.camTarget.x - 12, 26, this.camTarget.z + 10);
    this.sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);

    this.renderer.render(this.scene, this.camera);
  }

  /** Screen position (CSS pixels) of a world point, for HTML pop-ups. */
  project(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const el = this.renderer.domElement;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight };
  }

  dispose() {
    this.renderer.dispose();
  }

  // ---------- live layer ----------

  private updatePlayer(h: Hotel) {
    const r = this.player.root;
    r.position.set(h.player.pos.x, 0, h.player.pos.z);
    if (h.player.moving) turnTowards(r, h.player.heading, 0.3);
    animatePerson(this.player, h.player.moving, this.time);
    this.playerRing.position.set(h.player.pos.x, 0.04, h.player.pos.z);
  }

  private updateGuests(h: Hotel) {
    const seen = new Set<number>();
    for (const g of h.guests) {
      seen.add(g.id);
      let v = this.guests.get(g.id);
      if (!v) {
        const person = makePerson({ ...g.look, hatColor: g.look.outfit === '#264653' ? '#e76f51' : '#264653' });
        const bubble = new Label(256, 256, 1.4);
        this.live.add(person.root, bubble.sprite);
        v = { person, bubble };
        this.guests.set(g.id, v);
      }
      const sleeping = g.state === 'sleeping';
      v.person.root.visible = !sleeping;
      v.person.root.position.set(g.pos.x, 0, g.pos.z);
      turnTowards(v.person.root, g.heading, 0.25);
      animatePerson(v.person, g.path.length > 0, this.time + g.id);

      const waiting = g.state === 'queued' || g.state === 'arriving';
      v.bubble.sprite.visible = waiting || (g.state === 'leaving' && g.angry);
      if (v.bubble.sprite.visible) {
        const left = waiting ? Math.max(0, 1 - g.waited / PATIENCE) : 0;
        const q = Math.round(left * 24) / 24;
        const icon = g.angry ? '😡' : left < 0.3 ? '😤' : '🛏️';
        const color = left < 0.3 ? '#e53935' : left < 0.55 ? '#fb8c00' : '#43a047';
        v.bubble.draw(`${icon}${q}`, (c) => drawBubble(c, icon, g.angry ? null : q, color));
        v.bubble.sprite.position.set(g.pos.x, 3.0, g.pos.z);
      }
    }
    for (const [id, v] of this.guests) {
      if (seen.has(id)) continue;
      this.live.remove(v.person.root, v.bubble.sprite);
      v.bubble.dispose();
      this.guests.delete(id);
    }
  }

  private updateStaff(h: Hotel) {
    for (const s of h.staff) {
      let p = this.staff.get(s.role);
      if (!p) {
        p =
          s.role === 'receptionist'
            ? makePerson({ outfit: this.T.accent, skin: '#c98c62', hat: 'bellhop', hatColor: this.T.trim, bowTie: '#ffffff' })
            : makePerson({ outfit: '#4fc3f7', skin: '#f1c9a5', hat: 'beanie', hatColor: '#0288d1', mop: true }, 0.95);
        this.live.add(p.root);
        this.staff.set(s.role, p);
      }
      p.root.position.set(s.pos.x, 0, s.pos.z);
      const facing = s.path.length ? s.heading : s.role === 'receptionist' ? Math.PI / 2 : s.heading;
      turnTowards(p.root, facing, 0.25);
      animatePerson(p, s.path.length > 0, this.time * 0.9);
    }
  }

  private updateRooms(h: Hotel) {
    for (const r of h.rooms) {
      if (!r.built) continue;
      let v = this.rooms.get(r.id);
      if (!v) {
        const ring = new Label(256, 256, 1.3);
        v = { group: new THREE.Group(), key: '', ring };
        this.live.add(v.group, ring.sprite);
        this.rooms.set(r.id, v);
      }
      const g = roomGeom(r.i, r.j, r.side);
      const guest = r.guestId !== null ? h.guests.find((x) => x.id === r.guestId) : undefined;
      const asleep = guest?.state === 'sleeping';
      const key = `${r.state}:${asleep ? guest!.id : ''}`;
      if (v.key !== key) {
        v.key = key;
        v.group.clear();
        const blanket = this.T.blankets[r.id % this.T.blankets.length];
        const bx = g.rect.x0 + 2.6, bz = g.rect.z0 + 2.5;
        if (r.state === 'dirty') {
          const b1 = box(v.group, 1.6, 0.3, 1.3, blanket, bx + 0.2, 0.7, bz + 0.4);
          b1.rotation.set(0.3, 0.6, 0.2);
          const b2 = box(v.group, 0.9, 0.25, 0.9, blanket, bx - 0.5, 0.55, bz + 1.4);
          b2.rotation.set(-0.2, -0.5, 0.4);
          [[-1.2, 4.3, '#a1887f'], [0.9, 4.9, '#fff59d'], [-0.3, 5.4, '#90a4ae']].forEach(([dx, dz, c], k) => {
            const m = box(v!.group, 0.42, 0.16, 0.32, c as string, g.rect.x0 + 2.5 + (dx as number), 0, g.rect.z0 + (dz as number));
            m.rotation.y = k;
          });
        } else {
          box(v.group, 1.9, 0.18, 1.8, blanket, bx, 0.75, bz + 0.45);
        }
        if (asleep && guest) {
          ball(v.group, 0.38, guest.look.skin, bx, 1.05, bz - 0.6);
          box(v.group, 1.5, 0.3, 1.6, blanket, bx, 0.8, bz + 0.4);
          const z = new Label(256, 256, 1.0);
          z.draw('z', (c) => {
            c.fillStyle = '#5e548e';
            c.font = `bold 90px ${UI_FONT}`;
            c.fillText('z', 60, 170);
            c.font = `bold 120px ${UI_FONT}`;
            c.fillText('Z', 130, 110);
          });
          z.sprite.position.set(bx + 0.8, 2.2, bz - 0.4);
          v.group.add(z.sprite);
        }
      }
      // cleaning ring or "needs cleaning" bubble
      v.ring.sprite.position.set(g.rect.x0 + 2.5, 2.9, g.rect.z0 + 3.2);
      v.ring.sprite.visible = r.state === 'dirty';
      if (r.state === 'dirty') {
        if (r.clean > 0) {
          const q = Math.round(r.clean * 30) / 30;
          v.ring.draw(`c${q}`, (c) => drawRing(c, '🧹', q, '#43a047'));
        } else {
          v.ring.draw('dirty', (c) => drawBubble(c, '🧹', null, ''));
        }
      }
    }
    void CLEAN_TIME;
  }

  private updatePads(h: Hotel) {
    const list = pads(h);
    const seen = new Set<string>();
    for (const pad of list) {
      seen.add(pad.id);
      let v = this.padViews.get(pad.id);
      if (!v) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pad.size, pad.size), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(pad.x, 0.06, pad.z);
        this.live.add(mesh);
        v = { mesh, canvas, tex, key: '' };
        this.padViews.set(pad.id, v);
      }
      const key = `${pad.price}:${pad.paid}`;
      if (v.key !== key) {
        v.key = key;
        drawPad(v.canvas, pad, this.T);
        v.tex.needsUpdate = true;
      }
      // gentle pulse so pads read as interactive
      const s = 1 + Math.sin(this.time * 3 + pad.x) * 0.03;
      v.mesh.scale.set(s, s, 1);
    }
    for (const [id, v] of this.padViews) {
      if (seen.has(id)) continue;
      this.live.remove(v.mesh);
      v.tex.dispose();
      this.padViews.delete(id);
    }
  }

  private updatePile(h: Hotel) {
    const n = Math.min(40, Math.ceil(h.pile / 5));
    if (n === this.pileCount) return;
    this.pileCount = n;
    this.pile.clear();
    for (let k = 0; k < n; k++) {
      const stack = k % 4, level = Math.floor(k / 4);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16), mat(level % 2 ? '#ffb300' : '#ffca28'));
      c.position.set(COIN_PILE.x - 0.45 + (stack % 2) * 0.6, 0.05 + level * 0.11, COIN_PILE.z - 0.3 + Math.floor(stack / 2) * 0.6);
      c.castShadow = true;
      this.pile.add(c);
    }
  }

  private updateDesk(h: Hotel) {
    const s = this.deskRing.sprite;
    s.visible = h.checkin > 0.02;
    if (s.visible) {
      const q = Math.round(h.checkin * 30) / 30;
      this.deskRing.draw(`k${q}`, (c) => drawRing(c, '🔑', q, this.T.accent));
    }
  }
}

function drawPad(canvas: HTMLCanvasElement, pad: Pad, T: Theme) {
  const g = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const color = pad.kind === 'lot' ? T.accent2 : pad.kind === 'staff' ? '#7e57c2' : T.accent;
  g.fillStyle = color;
  roundRect(g, 6, 6, w - 12, h - 12, 40);
  g.fill();
  // paid portion fills from the bottom
  if (pad.paid > 0) {
    const f = pad.paid / pad.price;
    g.save();
    roundRect(g, 6, 6, w - 12, h - 12, 40);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, h - 6 - (h - 12) * f, w, (h - 12) * f + 6);
    g.restore();
  }
  g.strokeStyle = '#fff';
  g.lineWidth = 9;
  roundRect(g, 20, 20, w - 40, h - 40, 30);
  g.stroke();
  const dark = pad.kind === 'lot';
  g.fillStyle = dark ? '#3b2f2f' : '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold 46px ${UI_FONT}`;
  g.fillText(pad.label, w / 2, 92);
  g.font = `bold 52px ${UI_FONT}`;
  g.fillText(`${(pad.price - pad.paid).toLocaleString('en-US')}`, w / 2 + 22, 170);
  g.beginPath();
  g.fillStyle = '#ffca28';
  const tw = g.measureText(`${(pad.price - pad.paid).toLocaleString('en-US')}`).width;
  g.arc(w / 2 + 22 - tw / 2 - 30, 168, 20, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e0a000';
  g.lineWidth = 4;
  g.stroke();
}

function disposeGroup(g: THREE.Object3D, parent: THREE.Object3D) {
  parent.remove(g);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !(m.geometry.type === 'BoxGeometry' || m.geometry.type === 'SphereGeometry')) m.geometry.dispose();
    const material = m.material as THREE.Material | undefined;
    if (material && 'map' in material && (material as THREE.MeshBasicMaterial).map) {
      (material as THREE.MeshBasicMaterial).map!.dispose();
      material.dispose();
    }
  });
}
