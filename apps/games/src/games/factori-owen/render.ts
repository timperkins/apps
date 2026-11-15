// Draws the world, buildings and overlays onto the main canvas.
import { ENTITIES, maxHp, POLE_SUPPLY_RADIUS, POLE_WIRE_REACH, RECIPE_BY_ID, type EntityType, type ItemId } from './data';
import { BUG_KINDS, NEST_HP, playerWeapon, RELOAD_TICKS } from './combat';
import { beltItemPos, DEFAULT_LOOK, DIR_ANGLE, drawBelt, drawBug, drawBuilding, drawEngineer, drawNest, type GunKind, drawTree, drawTurretHead, inserterArm, inserterBase, inserterHand, type Look, type PlayerLook } from './art';
import { iconCanvas } from './icons';
import { DX, DY, drillOut, TPS, type Dir, type Entity, type Game } from './sim';
import { Ground, Res, WORLD } from './world';

const CHUNK = 32;
const CPX = 16; // pixels per tile in the ground cache

const GROUND_RGB: Record<number, [number, number, number]> = {
  [Ground.Grass]: [86, 122, 66],
  [Ground.Dry]: [118, 128, 74],
  [Ground.Dirt]: [122, 100, 70],
  [Ground.Sand]: [196, 178, 128],
  [Ground.Water]: [48, 92, 140],
};

const RES_COLORS: Record<number, [string, string, string]> = {
  [Res.Owen]: ['#4f63b8', '#8fa2ec', '#e7ecff'],
  [Res.Copper]: ['#a85a2e', '#e08a52', '#4fb39a'],
  [Res.Coal]: ['#1f1f24', '#45454f', '#0b0b0d'],
  [Res.Stone]: ['#9b8d78', '#c9bca6', '#776b5a'],
};

export interface Ghost {
  type: EntityType;
  x: number;
  y: number;
  dir: Dir;
  ok: boolean;
}

export interface Overlay {
  hoverTile: [number, number] | null;
  hoverEnt: Entity | null;
  ghost: Ghost | null;
  mining: { x: number; y: number; w: number; h: number; p: number } | null;
  showPower: boolean;
  reachOk: boolean;
}

export class Renderer {
  cv: HTMLCanvasElement;
  c: CanvasRenderingContext2D;
  zoom = 36;
  look: PlayerLook = DEFAULT_LOOK;
  /** Extra players to draw (multiplayer). */
  others: { x: number; y: number; dir: number; moving: boolean; look: PlayerLook; name: string }[] = [];
  camX = 0;
  camY = 0;
  dpr = 1;
  private chunks = new Map<number, HTMLCanvasElement>();
  private world: unknown = null;
  private oreSprites = new Map<string, HTMLCanvasElement>();
  private dark: HTMLCanvasElement = document.createElement('canvas');

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.c = cv.getContext('2d')!;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.cv.getBoundingClientRect();
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    const W = this.cv.width / this.dpr, H = this.cv.height / this.dpr;
    return [(sx - W / 2) / this.zoom + this.camX, (sy - H / 2) / this.zoom + this.camY];
  }

  invalidate(chunk: number) {
    this.chunks.delete(chunk);
  }

  private chunk(g: Game, cx: number, cy: number): HTMLCanvasElement {
    const key = (cy << 8) | cx;
    let cv = this.chunks.get(key);
    if (cv) {
      // most recently used goes to the back
      this.chunks.delete(key);
      this.chunks.set(key, cv);
      return cv;
    }
    if (this.chunks.size >= 48) this.chunks.delete(this.chunks.keys().next().value!);
    cv = document.createElement('canvas');
    cv.width = cv.height = CHUNK * CPX;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(CHUNK * CPX, CHUNK * CPX);
    const w = g.world;
    for (let ty = 0; ty < CHUNK; ty++)
      for (let tx = 0; tx < CHUNK; tx++) {
        const X = cx * CHUNK + tx, Y = cy * CHUNK + ty;
        const gr = w.ground[w.idx(X, Y)];
        const base = GROUND_RGB[gr];
        for (let py = 0; py < CPX; py++)
          for (let px = 0; px < CPX; px++) {
            const n = w.rand(X * CPX + px, Y * CPX + py, 1);
            const n2 = w.rand(X * 4 + (px >> 2), Y * 4 + (py >> 2), 2);
            let k = 0.9 + n * 0.12 + n2 * 0.08;
            if (gr === Ground.Water) k = 0.92 + n2 * 0.1 + (((px + py * 3 + X * 7) % 11) === 0 ? 0.08 : 0);
            const o = ((ty * CPX + py) * CHUNK * CPX + tx * CPX + px) * 4;
            img.data[o] = Math.min(255, base[0] * k);
            img.data[o + 1] = Math.min(255, base[1] * k);
            img.data[o + 2] = Math.min(255, base[2] * k);
            img.data[o + 3] = 255;
          }
      }
    c.putImageData(img, 0, 0);
    // soft shore edges and grass tufts
    for (let ty = 0; ty < CHUNK; ty++)
      for (let tx = 0; tx < CHUNK; tx++) {
        const X = cx * CHUNK + tx, Y = cy * CHUNK + ty;
        const gr = w.ground[w.idx(X, Y)];
        if (gr === Ground.Grass && w.rand(X, Y, 4) < 0.25) {
          c.fillStyle = 'rgba(150,190,100,.35)';
          const ox = tx * CPX + w.rand(X, Y, 5) * 12, oy = ty * CPX + w.rand(X, Y, 6) * 12;
          c.fillRect(ox, oy, 1, 3);
          c.fillRect(ox + 2, oy + 1, 1, 2);
        }
        if (gr === Ground.Water) {
          for (let d = 0; d < 4; d++) {
            const nx = X + DX[d], ny = Y + DY[d];
            if (w.inside(nx, ny) && w.ground[w.idx(nx, ny)] !== Ground.Water) {
              c.fillStyle = 'rgba(210,230,240,.35)';
              if (d === 0) c.fillRect(tx * CPX, ty * CPX, CPX, 2);
              if (d === 2) c.fillRect(tx * CPX, ty * CPX + CPX - 2, CPX, 2);
              if (d === 1) c.fillRect(tx * CPX + CPX - 2, ty * CPX, 2, CPX);
              if (d === 3) c.fillRect(tx * CPX, ty * CPX, 2, CPX);
            }
          }
        }
      }
    this.chunks.set(key, cv);
    return cv;
  }

  private ore(kind: number, variant: number, dense: boolean): HTMLCanvasElement {
    const key = `${kind}-${variant}-${dense}`;
    let cv = this.oreSprites.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = cv.height = 48;
    const c = cv.getContext('2d')!;
    c.scale(48, 48);
    const [base, light, fleck] = RES_COLORS[kind];
    let s = kind * 31 + variant * 7 + (dense ? 3 : 0);
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = dense ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const x = 0.15 + rnd() * 0.7, y = 0.15 + rnd() * 0.7, r = 0.08 + rnd() * (dense ? 0.12 : 0.08);
      c.fillStyle = 'rgba(0,0,0,.3)';
      c.beginPath();
      c.ellipse(x + 0.02, y + 0.04, r, r * 0.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = base;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.8, rnd(), 0, Math.PI * 2);
      c.fill();
      c.fillStyle = light;
      c.beginPath();
      c.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      if (rnd() < 0.6) {
        c.fillStyle = fleck;
        c.fillRect(x + r * 0.2, y, r * 0.25, r * 0.25);
      }
    }
    this.oreSprites.set(key, cv);
    return cv;
  }

  draw(g: Game, ov: Overlay, time: number) {
    const c = this.c;
    const W = this.cv.width / this.dpr, H = this.cv.height / this.dpr;
    const z = this.zoom;
    if (g.world !== this.world) {
      // a different world (new game, loaded save or title scene): drop the old ground pictures
      this.world = g.world;
      this.chunks.clear();
    }
    for (const k of g.world.dirtyChunks) this.invalidate(k);
    g.world.dirtyChunks.clear();

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#1d3550';
    c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2);
    c.scale(z, z);
    c.translate(-this.camX, -this.camY);
    c.imageSmoothingEnabled = true;

    const x0 = Math.max(0, Math.floor(this.camX - W / 2 / z) - 1);
    const y0 = Math.max(0, Math.floor(this.camY - H / 2 / z) - 1);
    const x1 = Math.min(WORLD - 1, Math.ceil(this.camX + W / 2 / z) + 1);
    const y1 = Math.min(WORLD - 1, Math.ceil(this.camY + H / 2 / z) + 2);

    // ground
    for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++)
      for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
        c.drawImage(this.chunk(g, cx, cy), cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
      }

    // ore
    const w = g.world;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * WORLD + x;
        const r = w.res[i];
        if (!r) continue;
        const v = Math.floor(w.rand(x, y, 9) * 4);
        c.drawImage(this.ore(r, v, w.amount[i] > 400), x - 0.1, y - 0.1, 1.2, 1.2);
      }

    // power areas
    if (ov.showPower) {
      c.fillStyle = 'rgba(90,170,255,.14)';
      for (const e of g.ents.values())
        if (e.def.kind === 'pole') {
          const r = e.def.supply ?? POLE_SUPPLY_RADIUS;
          c.fillRect(e.cx - r, e.cy - r, r * 2, r * 2);
        }
    }

    // collect visible entities
    const vis: Entity[] = [];
    for (const e of g.ents.values()) {
      const d = e.def;
      if (e.x + d.w < x0 || e.x > x1 || e.y + d.h < y0 - 1 || e.y > y1) continue;
      vis.push(e);
    }
    const look = (e: Entity): Look => ({
      dir: e.dir,
      working: e.working,
      anim: e.anim,
      time,
      t: e.t,
      curve: e.curve,
      noPower: !!e.def.electric && e.def.kind !== 'inserter' && (e.net < 0 || e.sat <= 0) && e.def.kind !== 'pole',
      noFuel: e.status === 'No fuel',
      ugOut: e.recipe === 'out',
    });

    // paths and mines lie flat on the ground
    for (const e of vis) if (e.def.kind === 'floor' || e.def.kind === 'mine') drawBuilding(c, e.type, e.x, e.y, look(e));

    // belts, then their items
    for (const e of vis) if (e.def.kind === 'belt') drawBelt(c, e.type, e.x, e.y, look(e));
    for (const e of vis)
      if (e.def.kind === 'belt')
        for (const b of e.items) {
          const [ix, iy] = beltItemPos(e.x, e.y, e.dir, e.curve, b.pos);
          c.drawImage(iconCanvas(b.item, 32), ix - 0.21, iy - 0.21, 0.42, 0.42);
        }

    for (const e of vis)
      if (e.def.kind === 'splitter') {
        drawBuilding(c, e.type, e.x, e.y, look(e));
        if (e.items[0]) c.drawImage(iconCanvas(e.items[0].item, 32), e.x + 0.29, e.y + 0.29, 0.42, 0.42);
      }

    // inserter bases sit under everything tall
    for (const e of vis) if (e.def.kind === 'inserter') inserterBase(c, e.type, e.x, e.y, look(e));

    // tall things sorted by their bottom edge: buildings, trees, player
    type Item = { y: number; f: () => void };
    const tall: Item[] = [];
    for (const e of vis) {
      const k = e.def.kind;
      if (k === 'belt' || k === 'inserter' || k === 'floor' || k === 'mine' || k === 'splitter') continue;
      tall.push({ y: e.y + e.def.h, f: () => this.building(e, look(e)) });
    }
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = w.tree[y * WORLD + x];
        if (t) tall.push({ y: y + 1, f: () => drawTree(c, x, y, t, Math.sin(time * 1.3 + x * 0.7 + y * 0.3)) });
      }
    if (!g.playerDead) {
      const recent = g.cs.gunCd > 0 || g.cs.reload > 0 || g.shooting;
      const angle = recent ? g.cs.aimAngle : DIR_ANGLE[g.pdir];
      const gun: GunKind = playerWeapon(g) === 'rail' ? 'rail' : 'pistol';
      const rel = g.cs.reload > 0 ? 1 - g.cs.reload / RELOAD_TICKS : 0;
      tall.push({ y: g.py + 0.3, f: () => drawEngineer(c, g.px, g.py, g.pdir, g.pmoving, time, !!ov.mining, this.look, ov.mining ? null : gun, angle, g.cs.muzzle, rel) });
      if (g.cs.reload > 0) {
        // reload bar over the head
        tall.push({ y: 1e9, f: () => {
          c.fillStyle = 'rgba(0,0,0,.6)';
          c.fillRect(g.px - 0.4, g.py - 0.75, 0.8, 0.1);
          c.fillStyle = '#f2b632';
          c.fillRect(g.px - 0.38, g.py - 0.73, 0.76 * rel, 0.06);
        } });
      }
    }
    const dr = g.cs.drone;
    if (dr && !g.playerDead) tall.push({ y: dr.y + 1.2, f: () => this.drone(dr.x, dr.y, time) });
    for (const o of this.others) tall.push({ y: o.y + 0.3, f: () => drawEngineer(c, o.x, o.y, o.dir, o.moving, time, false, o.look, 'pistol', DIR_ANGLE[o.dir], 0, 0) });
    const inView = (x: number, y: number, r: number) => x + r > x0 && x - r < x1 && y + r > y0 - 1 && y - r < y1;
    for (const n of g.cs.nests)
      if (inView(n.x, n.y, 2)) tall.push({ y: n.y + 1, f: () => drawNest(c, n.x, n.y, time * 2 + n.pulse, n.hp / NEST_HP) });
    for (const b of g.cs.bugs)
      if (inView(b.x, b.y, 1)) {
        const k = BUG_KINDS[b.kind];
        tall.push({ y: b.y + k.size * 0.4, f: () => drawBug(c, b.x, b.y, b.angle, k.size, k.color, k.shell, b.anim) });
      }
    // splats lie on the ground
    for (const f of g.cs.fx)
      if (f.kind === 'splat') {
        c.globalAlpha = Math.min(1, f.t / 60) * 0.7;
        c.fillStyle = f.color ?? '#6a8a2a';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.arc(f.x0 + Math.cos(i * 2.4) * 0.25 * (i % 3), f.y0 + Math.sin(i * 2.4) * 0.2 * (i % 3), 0.18 - i * 0.02, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
    tall.sort((a, b) => a.y - b.y);
    for (const t of tall) t.f();

    // turret heads
    for (const e of vis)
      if (e.def.kind === 'turret') drawTurretHead(c, e.type, e.x, e.y, e.t || -Math.PI / 2, e.type === 'rail-turret' ? e.progress : 1);

    // inserter arms and their cargo on top
    for (const e of vis)
      if (e.def.kind === 'inserter') {
        const reach = e.def.reach ?? 1;
        inserterArm(c, e.type, e.x, e.y, look(e), reach);
        if (e.held) {
          const [hx, hy] = inserterHand(e.x, e.y, e.dir, reach, e.t);
          c.drawImage(iconCanvas(e.held, 32), hx - 0.2, hy - 0.2, 0.4, 0.4);
        }
      }

    // wires
    c.strokeStyle = 'rgba(40,30,20,.85)';
    c.lineWidth = 0.035;
    for (const e of vis)
      if (e.def.kind === 'pole')
        for (const id of e.wire) {
          const o = g.ents.get(id);
          if (!o || o.id < e.id) continue;
          for (const off of [0.22, 0.78]) {
            const ax = e.x + off, ay = e.y - 0.58, bx = o.x + off, by = o.y - 0.58;
            c.beginPath();
            c.moveTo(ax, ay);
            c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 0.35, bx, by);
            c.stroke();
          }
        }

    this.effects(g);
    this.night(g, vis, W, H, x0, y0);
    this.labels(g, vis, inView);
    this.overlays(g, ov);
  }

  private drone(x: number, y: number, time: number) {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath();
    c.ellipse(x, y + 1.1, 0.25, 0.08, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(x - 0.35, y - 0.35);
    c.scale(0.7, 0.7);
    c.drawImage(iconCanvas('helper-drone', 48), 0, Math.sin(time * 5) * 0.05, 1, 1);
    c.restore();
  }

  private effects(g: Game) {
    const c = this.c;
    for (const f of g.cs.fx) {
      const a = f.t / f.life;
      if (f.kind === 'laser') {
        c.lineCap = 'round';
        c.strokeStyle = `rgba(255,60,90,${a * 0.6})`;
        c.lineWidth = 0.22 * a + 0.04;
        c.beginPath();
        c.moveTo(f.x0, f.y0);
        c.lineTo(f.x1, f.y1);
        c.stroke();
        c.strokeStyle = `rgba(255,220,230,${a})`;
        c.lineWidth = 0.05;
        c.stroke();
      } else if (f.kind === 'grenade') {
        const p = 1 - a;
        const gx = f.x0 + (f.x1 - f.x0) * p, gy = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * 2;
        c.fillStyle = '#2f3a24';
        c.beginPath();
        c.arc(gx, gy, 0.14, 0, Math.PI * 2);
        c.fill();
      } else if (f.kind === 'bullet') {
        c.strokeStyle = `rgba(255,230,120,${a})`;
        c.lineWidth = 0.05;
        c.beginPath();
        c.moveTo(f.x0, f.y0);
        c.lineTo(f.x1, f.y1);
        c.stroke();
        c.fillStyle = `rgba(255,250,200,${a})`;
        c.beginPath();
        c.arc(f.x1, f.y1, 0.08, 0, Math.PI * 2);
        c.fill();
      } else if (f.kind === 'rail') {
        c.lineCap = 'round';
        c.strokeStyle = `rgba(60,200,255,${a * 0.5})`;
        c.lineWidth = 0.5 * a + 0.1;
        c.beginPath();
        c.moveTo(f.x0, f.y0);
        c.lineTo(f.x1, f.y1);
        c.stroke();
        c.strokeStyle = `rgba(230,250,255,${a})`;
        c.lineWidth = 0.12 * a + 0.02;
        c.stroke();
      } else if (f.kind === 'boom') {
        const r = (1 - a) * 2 + 0.3;
        c.fillStyle = `rgba(255,${150 + a * 100},60,${a * 0.8})`;
        c.beginPath();
        c.arc(f.x0, f.y0, r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgba(80,70,70,${a * 0.5})`;
        c.beginPath();
        c.arc(f.x0 + 0.3, f.y0 - (1 - a), r * 0.7, 0, Math.PI * 2);
        c.fill();
      } else if (f.kind === 'bite') {
        c.strokeStyle = `rgba(255,80,60,${a})`;
        c.lineWidth = 0.06;
        c.beginPath();
        c.arc(f.x0, f.y0, 0.3 + (1 - a) * 0.3, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  private labels(g: Game, vis: Entity[], inView: (x: number, y: number, r: number) => boolean) {
    const c = this.c;
    // damaged buildings show a health bar
    for (const e of vis) {
      const m = maxHp(e.type);
      if (e.hp >= m) continue;
      const w = Math.min(1.6, e.def.w * 0.8);
      const x = e.cx - w / 2, y = e.y - 0.25;
      c.fillStyle = 'rgba(0,0,0,.6)';
      c.fillRect(x, y, w, 0.12);
      c.fillStyle = e.hp / m > 0.5 ? '#57d38c' : e.hp / m > 0.25 ? '#f2b632' : '#ff5b4b';
      c.fillRect(x + 0.02, y + 0.02, (w - 0.04) * (e.hp / m), 0.08);
    }
    // bug names float above them
    if (this.zoom >= 14) {
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      for (const b of g.cs.bugs) {
        if (!inView(b.x, b.y, 1)) continue;
        const k = BUG_KINDS[b.kind];
        const fs = Math.max(0.3, 11 / this.zoom);
        c.font = `700 ${fs}px ui-rounded, system-ui, sans-serif`;
        const ty = b.y - k.size * 0.6 - 0.05;
        c.lineWidth = fs * 0.25;
        c.strokeStyle = 'rgba(0,0,0,.75)';
        c.strokeText(b.name, b.x, ty);
        c.fillStyle = b.mode === 'idle' ? '#e8eef7' : '#ffb3a8';
        c.fillText(b.name, b.x, ty);
        if (b.hp < k.hp) {
          c.fillStyle = 'rgba(0,0,0,.6)';
          c.fillRect(b.x - 0.3, ty + 0.02, 0.6, 0.07);
          c.fillStyle = '#ff5b4b';
          c.fillRect(b.x - 0.3, ty + 0.02, 0.6 * (b.hp / k.hp), 0.07);
        }
      }
      for (const o of this.others) {
        const fs = Math.max(0.3, 12 / this.zoom);
        c.font = `700 ${fs}px ui-rounded, system-ui, sans-serif`;
        c.lineWidth = fs * 0.25;
        c.strokeStyle = 'rgba(0,0,0,.75)';
        c.strokeText(o.name, o.x, o.y - 0.55);
        c.fillStyle = '#9fe0ff';
        c.fillText(o.name, o.x, o.y - 0.55);
      }
    }
  }

  private building(e: Entity, l: Look) {
    const c = this.c;
    drawBuilding(c, e.type, e.x, e.y, l);
    const d = e.def;
    // "alt mode": show what a machine is making
    let icon: ItemId | null = null;
    if (d.kind === 'assembler' && e.recipe) icon = RECIPE_BY_ID[e.recipe]?.out ?? null;
    if (d.kind === 'furnace') icon = e.crafting ? RECIPE_BY_ID[e.crafting].out : e.output?.item ?? null;
    if (icon) {
      const cx = e.x + d.w / 2, cy = e.y + d.h / 2 - 0.1;
      const s = d.w >= 3 ? 0.9 : 0.6;
      c.fillStyle = 'rgba(20,24,32,.55)';
      c.beginPath();
      c.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
      c.fill();
      c.drawImage(iconCanvas(icon, 48), cx - s / 2, cy - s / 2, s, s);
    }
  }

  private night(g: Game, vis: Entity[], W: number, H: number, x0: number, y0: number) {
    const dark = 1 - g.daylight();
    if (dark <= 0.02) return;
    const z = this.zoom;
    const s = 0.5; // half resolution
    const dc = this.dark;
    const dw = Math.ceil(W * s), dh = Math.ceil(H * s);
    if (dc.width !== dw || dc.height !== dh) {
      dc.width = dw;
      dc.height = dh;
    }
    const d = dc.getContext('2d')!;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, dw, dh);
    d.fillStyle = `rgba(8,12,38,${dark * (g.suit.nightOn ? 0.2 : 0.62)})`;
    d.fillRect(0, 0, dw, dh);
    d.globalCompositeOperation = 'destination-out';
    const light = (wx: number, wy: number, r: number, a: number) => {
      const sx = ((wx - this.camX) * z + W / 2) * s, sy = ((wy - this.camY) * z + H / 2) * s;
      const rr = r * z * s;
      const grd = d.createRadialGradient(sx, sy, 0, sx, sy, rr);
      grd.addColorStop(0, `rgba(0,0,0,${a})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
    };
    light(g.px, g.py, g.suit.nightOn ? 16 : 7, 0.95);
    for (const e of vis) {
      const k = e.def.kind;
      if (k === 'lamp' && e.working) light(e.cx, e.cy - 0.3, 7.5, 0.95);
      else if (k === 'pole') light(e.cx, e.cy, 3.5, 0.6);
      else if (e.working && (k === 'furnace' || k === 'lab' || k === 'generator' || k === 'assembler' || k === 'drill'))
        light(e.cx, e.cy, e.def.w + 1.5, 0.75);
    }
    void x0;
    void y0;
    const c = this.c;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(dc, 0, 0, this.cv.width, this.cv.height);
    c.restore();
  }

  private overlays(g: Game, ov: Overlay) {
    const c = this.c;
    if (ov.hoverEnt && !ov.ghost) {
      const e = ov.hoverEnt;
      c.strokeStyle = ov.reachOk ? 'rgba(255,230,140,.95)' : 'rgba(255,120,100,.9)';
      c.lineWidth = 0.06;
      c.setLineDash([0.2, 0.12]);
      c.strokeRect(e.x + 0.03, e.y + 0.03, e.def.w - 0.06, e.def.h - 0.06);
      c.setLineDash([]);
      if (e.def.kind === 'inserter') this.inserterMarks(e.x, e.y, e.dir, e.def.reach ?? 1);
      if (e.def.kind === 'drill') this.drillArea(e.type, e.x, e.y, e.dir);
    } else if (ov.hoverTile && !ov.ghost) {
      const [x, y] = ov.hoverTile;
      c.strokeStyle = 'rgba(255,255,255,.35)';
      c.lineWidth = 0.04;
      c.strokeRect(x + 0.04, y + 0.04, 0.92, 0.92);
    }
    if (ov.ghost) {
      const gh = ov.ghost;
      const d = ENTITIES[gh.type];
      c.globalAlpha = 0.55;
      const l: Look = { dir: gh.dir, working: false, anim: 0, time: 0, t: 0, curve: -1 };
      if (d.kind === 'belt') drawBelt(c, gh.type, gh.x, gh.y, l);
      else if (d.kind === 'inserter') {
        inserterBase(c, gh.type, gh.x, gh.y, l);
        inserterArm(c, gh.type, gh.x, gh.y, l, d.reach ?? 1);
      } else drawBuilding(c, gh.type, gh.x, gh.y, l);
      c.globalAlpha = 1;
      c.fillStyle = gh.ok ? 'rgba(80,220,120,.22)' : 'rgba(240,70,60,.3)';
      c.fillRect(gh.x, gh.y, d.w, d.h);
      if (d.kind === 'inserter') this.inserterMarks(gh.x, gh.y, gh.dir, d.reach ?? 1);
      if (d.kind === 'drill') this.drillArea(gh.type, gh.x, gh.y, gh.dir);
      if (d.kind === 'pole') {
        const r = d.supply ?? POLE_SUPPLY_RADIUS;
        c.strokeStyle = 'rgba(120,190,255,.9)';
        c.lineWidth = 0.05;
        c.strokeRect(gh.x + 0.5 - r, gh.y + 0.5 - r, r * 2, r * 2);
        c.strokeStyle = 'rgba(255,220,120,.7)';
        for (const e of g.ents.values())
          if (e.def.kind === 'pole' && Math.hypot(e.cx - gh.x - 0.5, e.cy - gh.y - 0.5) <= Math.min(d.wireReach ?? POLE_WIRE_REACH, e.def.wireReach ?? POLE_WIRE_REACH)) {
            c.beginPath();
            c.moveTo(gh.x + 0.5, gh.y + 0.5);
            c.lineTo(e.cx, e.cy);
            c.stroke();
          }
      }
    }
    if (ov.mining) {
      const m = ov.mining;
      c.fillStyle = 'rgba(0,0,0,.6)';
      c.fillRect(m.x + m.w / 2 - 0.5, m.y - 0.3, 1, 0.16);
      c.fillStyle = '#f2b632';
      c.fillRect(m.x + m.w / 2 - 0.48, m.y - 0.28, 0.96 * m.p, 0.12);
    }
  }

  private inserterMarks(x: number, y: number, dir: number, reach: number) {
    const c = this.c;
    const sx = x - DX[dir] * reach, sy = y - DY[dir] * reach;
    const tx = x + DX[dir] * reach, ty = y + DY[dir] * reach;
    c.lineWidth = 0.06;
    c.strokeStyle = 'rgba(120,220,140,.9)';
    c.strokeRect(sx + 0.15, sy + 0.15, 0.7, 0.7);
    c.strokeStyle = 'rgba(255,140,90,.95)';
    c.beginPath();
    c.arc(tx + 0.5, ty + 0.5, 0.3, 0, Math.PI * 2);
    c.stroke();
  }

  private drillArea(type: EntityType, x: number, y: number, dir: Dir) {
    const c = this.c;
    const d = ENTITIES[type];
    const a = d.area ?? d.w;
    const o = (a - d.w) / 2;
    c.fillStyle = 'rgba(120,200,255,.12)';
    c.fillRect(x - o, y - o, a, a);
    c.strokeStyle = 'rgba(120,200,255,.6)';
    c.lineWidth = 0.04;
    c.strokeRect(x - o, y - o, a, a);
    const [ox, oy] = drillOut({ x, y, dir, def: d } as unknown as Entity);
    c.strokeStyle = 'rgba(255,210,63,.95)';
    c.lineWidth = 0.06;
    c.strokeRect(ox + 0.12, oy + 0.12, 0.76, 0.76);
  }
}

export { TPS };
