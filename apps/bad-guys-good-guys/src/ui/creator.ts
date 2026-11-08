import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BACKS, BOTTOMS, BUILD_NAMES, CLOTH_COLORS, EYE_COLORS, GLASSES, HAIR, HAIR_COLORS, HATS, LABELS, SKINS, TOPS,
  randomLook, type Look,
} from '../core/look';
import { pose } from '../render/animate';
import { Rig, kidSpec } from '../render/person';

/** The character screen: a turning 3D preview and a panel of choices. */

type Slot = {
  id: string;
  label: string;
  style?: { key: keyof Look; options: readonly (string | number)[]; names?: (v: string | number) => string };
  colors?: { key: keyof Look; options: readonly string[] }[];
};

const SLOTS: Slot[] = [
  { id: 'body', label: 'Body', style: { key: 'build', options: [0, 1, 2], names: (v) => BUILD_NAMES[v as number] }, colors: [{ key: 'skin', options: SKINS }] },
  { id: 'hair', label: 'Hair', style: { key: 'hair', options: HAIR }, colors: [{ key: 'hairColor', options: HAIR_COLORS }] },
  { id: 'face', label: 'Face', style: { key: 'glasses', options: GLASSES }, colors: [{ key: 'eyes', options: EYE_COLORS }] },
  { id: 'top', label: 'Top', style: { key: 'top', options: TOPS }, colors: [{ key: 'topColor', options: CLOTH_COLORS }] },
  { id: 'bottom', label: 'Bottom', style: { key: 'bottom', options: BOTTOMS }, colors: [{ key: 'bottomColor', options: CLOTH_COLORS }, { key: 'shoes', options: ['#ffffff', '#e8423a', '#2a2a34', '#2fb5a8', '#ffc93a', '#3a8aff', '#ff5fb0', '#7a4a2a'] }] },
  { id: 'hat', label: 'Hat', style: { key: 'hat', options: HATS }, colors: [{ key: 'hatColor', options: CLOTH_COLORS }] },
  { id: 'back', label: 'Back', style: { key: 'back', options: BACKS }, colors: [{ key: 'backColor', options: CLOTH_COLORS }] },
];

const STORE = 'bggg-look';

export function loadLook(): Look {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...randomLook(), ...JSON.parse(raw) };
  } catch {
    /* private mode */
  }
  return randomLook();
}

function saveLook(l: Look): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

export class Creator {
  readonly el: HTMLElement;
  look: Look;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private rig: Rig | null = null;
  private spin = 0.5;
  private drag: number | null = null;
  private slot = 'body';
  private raf = 0;
  private t = 0;
  private wave = 0;

  constructor(parent: HTMLElement, onDone: (look: Look, mode: 'host' | 'join') => void, joinCode: string | null) {
    this.look = loadLook();
    this.el = document.createElement('div');
    this.el.className = 'screen creator';
    this.el.innerHTML = `
      <div class="preview"><canvas></canvas><button class="btn small dice" title="Random kid">🎲 Surprise me</button></div>
      <div class="panel">
        <h2>Make your kid</h2>
        <label class="name">Name <input maxlength="8" autocomplete="off" spellcheck="false"></label>
        <div class="tabs"></div>
        <div class="opts"></div>
        <div class="row actions">
          ${joinCode ? `<button class="btn primary go-join">Join game ${joinCode}</button>` : `<button class="btn primary go-host">Host a game</button><button class="btn go-join">Join a game</button>`}
        </div>
      </div>`;
    parent.appendChild(this.el);
    const canvas = this.el.querySelector('canvas')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x997755, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.position.set(2, 5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const name = this.el.querySelector<HTMLInputElement>('.name input')!;
    name.value = this.look.name;
    name.addEventListener('input', () => {
      this.look.name = name.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
      name.value = this.look.name;
    });
    this.el.querySelector('.dice')!.addEventListener('click', () => {
      this.look = randomLook(Math.random, this.look.name);
      this.wave = 1;
      this.rebuild();
      this.renderOptions();
    });
    const done = (mode: 'host' | 'join') => {
      if (!this.look.name.trim()) this.look.name = randomLook().name;
      saveLook(this.look);
      onDone(this.look, mode);
    };
    this.el.querySelector('.go-host')?.addEventListener('click', () => done('host'));
    this.el.querySelector('.go-join')?.addEventListener('click', () => done('join'));

    canvas.addEventListener('pointerdown', (e) => {
      this.drag = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.drag === null) return;
      this.spin += (e.clientX - this.drag) * 0.012;
      this.drag = e.clientX;
    });
    canvas.addEventListener('pointerup', () => (this.drag = null));

    this.renderTabs();
    this.renderOptions();
    this.rebuild();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private renderTabs(): void {
    const tabs = this.el.querySelector('.tabs')!;
    tabs.innerHTML = SLOTS.map((s) => `<button class="tab ${s.id === this.slot ? 'on' : ''}" data-s="${s.id}">${s.label}</button>`).join('');
    tabs.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) =>
      b.addEventListener('click', () => {
        this.slot = b.dataset.s!;
        this.renderTabs();
        this.renderOptions();
      }),
    );
  }

  private renderOptions(): void {
    const slot = SLOTS.find((s) => s.id === this.slot)!;
    const opts = this.el.querySelector('.opts')!;
    const look = this.look as unknown as Record<string, string | number>;
    let html = '';
    if (slot.style) {
      const st = slot.style;
      html += `<div class="chips">${st.options
        .map((v) => `<button class="chip ${look[st.key] === v ? 'on' : ''}" data-k="${st.key}" data-v="${v}">${st.names ? st.names(v) : LABELS[v as string] ?? v}</button>`)
        .join('')}</div>`;
    }
    for (const c of slot.colors ?? []) {
      const label = c.key === 'shoes' ? 'Shoes' : c.key === 'skin' ? 'Skin' : c.key === 'eyes' ? 'Eyes' : 'Color';
      html += `<div class="swatch-label">${label}</div><div class="swatches">${c.options
        .map((v) => `<button class="sw ${look[c.key] === v ? 'on' : ''}" style="background:${v}" data-k="${c.key}" data-v="${v}" aria-label="${v}"></button>`)
        .join('')}</div>`;
    }
    opts.innerHTML = html;
    opts.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as keyof Look;
        const raw = b.dataset.v!;
        (this.look as unknown as Record<string, string | number>)[k] = k === 'build' ? Number(raw) : raw;
        this.rebuild();
        this.renderOptions();
      }),
    );
  }

  private rebuild(): void {
    if (this.rig) this.scene.remove(this.rig.root);
    this.rig = new Rig(kidSpec(this.look));
    this.scene.add(this.rig.root);
  }

  private frame(dt: number): void {
    this.t += dt;
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * this.renderer.getPixelRatio()) || canvas.height !== Math.round(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.drag === null) this.spin += dt * 0.4;
    if (this.rig) {
      this.rig.root.rotation.y = Math.sin(this.spin) * 0.9;
      this.wave = Math.max(0, this.wave - dt);
      pose(this.rig, { state: this.wave > 0 ? 'throw' : 'idle', t: 1 - this.wave, len: 1, moving: false, walkPhase: 0, face: 1, time: this.t });
      const hgt = this.rig.height;
      this.camera.position.set(0, hgt * 0.62, hgt * 2.3 + 0.6);
      this.camera.lookAt(0, hgt * 0.5, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.el.remove();
  }
}
