// Canvas renderer. The world is drawn rotated around the turret pivot so the game's
// horizon tracks the real one; the barrel and HUD are drawn in screen space. In war mode the
// camera also slides sideways to whichever turret is in use (game.viewX).
import { SPRITES, SHARED, LAND, GROUND_Y, PIVOT_Y, B, G, SC, HALF, LIGHTS, BASE_SCALE, puff, mockToWorld, RAYS, CLOUD_RINGS, type Sprite, type PaletteSprites, type BuildingId } from './art';
import { PALETTES, blendPalette, withAlpha, type BlendedPalette, type Palette } from './palettes';
import { UPGRADES, DOME_RX, DOME_RY, WAR_TIME, WAR_STRIKES, SNIPER, type Game, type ArmOwner, type Plane, type Crate, type Bomb, type Building } from './game';

const smooth = (t: number) => t * t * (3 - 2 * t);
/** The glow color of a crate. */
const crateTint = (c: Crate) => c.diamond ? '#9fe6ff' : c.gold ? '#ffd34a' : '#9dffb8';
/** A plane silhouette filled with gold, made once per silhouette. */
const goldCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function goldSil(img: HTMLCanvasElement) {
  let c = goldCache.get(img);
  if (!c) {
    c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in';
    const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(.45, '#f2c23a'); gr.addColorStop(1, '#b07a14');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    goldCache.set(img, c);
  }
  return c;
}
const FIRE_Y: Record<BuildingId, number> = { search: G - 9, radar: G - 12, depot: G - 12, turret: G - 16, hangar: G - 16, repair: G - 10 };
const LAMPS: [BuildingId, number, number, number][] = [['radar', B.radar - 5.5, G - 6.4, 10], ['hangar', B.hangar, G - 17, 14], ['depot', B.depot, G - 8, 8], ['repair', B.repair - 2.3, G - 7.6, 8], ['hangar', B.hangar + 32, G - 6, 8]];
const SEARCH_PIVOT = mockToWorld(B.search, G - 12.4);

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  safeTop = 0;
  time = 0;
  W = 0; H = 0; dpr = 1;
  /** world units to CSS pixels */
  s = 1;
  /** turret pivot on screen */
  px = 0; py = 0;
  /** camera shake offset this frame */
  sx = 0; sy = 0;
  private pal: BlendedPalette | null = null;
  private palKey = '';

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }
  resize(w: number, h: number, safeTop = 0) {
    this.W = w; this.H = h; this.safeTop = safeTop;
    // full device resolution (3x on recent iPhones); a lower cap made the whole screen soft
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    // world units per CSS pixel: keep the 390-wide design and at least 800 units of height
    this.s = Math.min(w / 390, h / 800);
    this.px = w / 2;
    this.py = h - 62.4 * this.s;
  }
  palette(game: Game): BlendedPalette {
    const t = smooth(game.palT);
    const key = `${game.palFrom}|${game.palTo}|${t.toFixed(3)}`;
    if (key !== this.palKey || !this.pal) { this.palKey = key; this.pal = blendPalette(PALETTES[game.palFrom], PALETTES[game.palTo], t); }
    return this.pal;
  }
  worldToScreen(game: Game, x: number, y: number): [number, number] {
    const c = Math.cos(game.cam), sn = Math.sin(game.cam);
    x -= game.viewX;
    return [this.px + this.s * (x * c + y * sn) + this.sx, this.py + this.s * (-x * sn + y * c) + this.sy];
  }
  /** The world point under a point on the screen (the inverse of worldToScreen, without shake). */
  screenToWorld(game: Game, sx: number, sy: number): [number, number] {
    const c = Math.cos(game.cam), sn = Math.sin(game.cam);
    const a = (sx - this.px) / this.s, b = (sy - this.py) / this.s;
    return [a * c - b * sn + game.viewX, a * sn + b * c];
  }
  sprite(P: BlendedPalette, get: (s: PaletteSprites) => Sprite, x?: number, y?: number, w?: number, h?: number) {
    // draw a palette sprite, cross-fading between the two palettes being blended
    const ctx = this.ctx, A = get(SPRITES[P.a.id]), Bs = get(SPRITES[P.b.id]);
    const t = P.t;
    const draw = (s: Sprite, a: number) => { if (!s || a <= 0) return; ctx.globalAlpha = a; ctx.drawImage(s.img, x ?? s.x, y ?? s.y, w ?? s.w, h ?? s.h); };
    const ga = ctx.globalAlpha;
    if (t <= 0 || A === Bs) draw(A, ga);
    else if (t >= 1) draw(Bs, ga);
    else { draw(A, ga); draw(Bs, ga * t); }
    ctx.globalAlpha = ga;
  }

  drawClouds(P: BlendedPalette) {
    // Vector clouds stay sharp at any screen size; a few widening rings feather the edges.
    const ctx = this.ctx;
    const layer = (S: Palette, a: number) => {
      if (a <= 0) return;
      for (const c of SPRITES[S.id].clouds) {
        const g = ctx.createLinearGradient(0, c.y - c.ry - 4, 0, c.y + c.ry + 4);
        g.addColorStop(0, S.cloudTop); g.addColorStop(1, S.cloudLit);
        ctx.fillStyle = g;
        CLOUD_RINGS.forEach(([, k], i) => { ctx.globalAlpha = a * c.op * k; ctx.fill(c.rings[i]); });
      }
      if (S.rays) {
        // faint shafts of light that fade out away from the sun
        const [sx, sy] = S.sun;
        ctx.globalAlpha = a;
        for (const [x, y] of RAYS) {
          const g = ctx.createLinearGradient(sx, sy, x + 20, y + 5);
          g.addColorStop(0, withAlpha(S.sunCol, .06)); g.addColorStop(1, withAlpha(S.sunCol, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.lineTo(x + 40, y + 10); ctx.closePath(); ctx.fill();
        }
      }
    };
    const ga = ctx.globalAlpha;
    if (P.t <= 0 || P.a === P.b) layer(P.a, ga);
    else if (P.t >= 1) layer(P.b, ga);
    else { layer(P.a, ga * (1 - P.t)); layer(P.b, ga * P.t); }
    ctx.globalAlpha = ga;
  }

  frame(game: Game, dt: number) {
    this.time += dt;
    const ctx = this.ctx, P = this.palette(game);
    const sh = game.shake;
    this.sx = sh ? (Math.random() - .5) * sh * this.s : 0;
    this.sy = sh ? (Math.random() - .5) * sh * this.s : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.sky[0][1]; ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    ctx.translate(this.px + this.sx, this.py + this.sy);
    ctx.scale(this.s, this.s);
    ctx.rotate(-game.cam);
    ctx.translate(-game.viewX, 0);
    this.drawWorld(game, P);
    this.drawGun2(game, P);
    this.drawAdvGuns(game, P);
    ctx.restore();

    ctx.save();
    const [gx, gy] = this.worldToScreen(game, game.gunX, 0);
    ctx.translate(gx, gy);
    ctx.scale(this.s, this.s);
    this.drawGun(game, P);
    ctx.restore();

    this.drawOverlays(game, P);
    this.drawHud(game, P);
  }

  /* ---------- world ---------- */
  drawWorld(game: Game, P: BlendedPalette) {
    const ctx = this.ctx;
    const reduce = game.settings.reduceMotion;
    // the sky is far away, so it barely moves when the camera slides to another turret
    ctx.save(); ctx.translate(game.viewX * .9, 0);
    // sky
    const sg = ctx.createLinearGradient(0, -PIVOT_Y, 0, 844 - PIVOT_Y);
    for (const [o, c] of P.sky) sg.addColorStop(o, c);
    ctx.fillStyle = sg; ctx.fillRect(-1500, -1600, 3000, 1700);
    if (P.stars > .01) {
      const k = P.stars * (.85 + .15 * Math.sin(this.time * .7));
      ctx.fillStyle = '#ffffff';
      for (const l of SHARED.stars) { ctx.globalAlpha = k * l.alpha; ctx.fill(l.path); }
      ctx.globalAlpha = 1;
    }
    // sun
    const [sx, sy] = P.sun;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150);
    glow.addColorStop(0, withAlpha(P.sunCol, P.sunGlow)); glow.addColorStop(.35, withAlpha(P.sunCol, P.sunGlow * .35)); glow.addColorStop(1, withAlpha(P.sunCol, 0));
    ctx.fillStyle = glow; ctx.fillRect(sx - 150, sy - 150, 300, 300);
    if (P.sunDisc > .5) { ctx.fillStyle = P.sunCol; ctx.beginPath(); ctx.arc(sx, sy, P.sunDisc, 0, 7); ctx.fill(); }
    this.drawClouds(P);
    ctx.restore();
    // mountain ranges, far to near, with a little parallax as the world turns
    for (let i = 0; i < LAND.ridges.length; i++) {
      const r = LAND.ridges[i];
      const c = this.mixHex(P.far, P.near, Math.pow(r.t, 1.15));
      const shift = -game.cam * r.k * (reduce ? .3 : 1) + game.viewX * (.85 - .45 * r.t);
      ctx.save(); ctx.translate(shift, 0);
      if (r.trees) { ctx.fillStyle = c; ctx.fill(r.trees); }
      const g = ctx.createLinearGradient(0, r.top, 0, r.base + 24);
      g.addColorStop(0, c); g.addColorStop(1, this.mixHex(c, P.haze, .45 - .3 * r.t));
      ctx.fillStyle = g; ctx.fill(r.path);
      if (i < 3) {
        const m = ctx.createLinearGradient(0, r.base - 4, 0, r.base + 26);
        m.addColorStop(0, withAlpha(P.haze, 0)); m.addColorStop(.5, withAlpha(P.haze, .55)); m.addColorStop(1, withAlpha(P.haze, 0));
        ctx.globalAlpha = .5 - i * .1; ctx.fillStyle = m; ctx.fillRect(-1500, r.base - 4, 3000, 30); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // foreground ground and edge forest
    const gg = ctx.createLinearGradient(0, GROUND_Y - 6, 0, GROUND_Y + 110);
    gg.addColorStop(0, P.groundTop); gg.addColorStop(.08, P.ground); gg.addColorStop(1, this.mixHex(P.ground, '#000000', .35));
    ctx.fillStyle = gg; ctx.fill(LAND.ground);
    ctx.fillStyle = P.near; ctx.fill(game.war ? LAND.edgeTreesWar : LAND.edgeTrees);
    ctx.fillStyle = this.mixHex(P.ground, '#000000', .35); ctx.fillRect(-2500, GROUND_Y + 110, 5000, 1400);

    this.drawBase(game, P);
    this.drawBeam(game, P);
    this.drawTrails(game, P);
    for (const p of game.planes) this.drawPlane(game, P, p);
    this.drawLandingZone(game);
    for (const c of game.crates) this.drawCrate(game, P, c);
    for (const b of game.bombs) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
      if (b.kind === 'missile') this.drawEnemyMissile(P, b);
      else if (b.kind === 'nuke') {
        // the Bomber's nuke: a big bomb with a pulsing red glow
        const k = b.mega ? 1.35 : 1;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 + .25 * Math.sin(this.time * 9);
        ctx.drawImage(puff('#ff5a3a'), -12 * k, -12 * k, 24 * k, 24 * k);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.scale(k, k); this.sprite(P, s => s.bombs.big);
      } else { ctx.scale(.62, .62); this.sprite(P, s => s.bombs.big); }
      ctx.restore();
    }
    this.drawArm(game);
    this.drawSnipes(game);
    this.drawShots(game, P);
    this.drawParticles(game, P);
    this.drawShield(game);
  }

  // The shield dome over the base: a faint glass bubble with a bright rim that flares when something hits it.
  drawShield(game: Game) {
    if (game.shieldT <= 0) return;
    const ctx = this.ctx;
    // it flickers in its last three seconds
    const ending = game.shieldT < 3 && Math.sin(this.time * 24) < 0;
    const k = Math.min(1, game.shieldT / .5) * (ending ? .45 : 1), f = game.shieldFlash;
    ctx.save();
    ctx.translate(0, GROUND_Y); ctx.scale(1, DOME_RY / DOME_RX);
    const g = ctx.createRadialGradient(0, 0, DOME_RX * .55, 0, 0, DOME_RX);
    g.addColorStop(0, 'rgba(127,233,255,0)'); g.addColorStop(1, `rgba(127,233,255,${(.16 + .25 * f) * k})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, DOME_RX, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#7fe9ff'; ctx.globalAlpha = (.45 + .5 * f + .08 * Math.sin(this.time * 5)) * k; ctx.lineWidth = 1.4 + 2 * f;
    ctx.beginPath(); ctx.arc(0, 0, DOME_RX, Math.PI, 0); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // A light plane's missile: long and skinny, nose along +y, a flickering flame at the tail.
  drawEnemyMissile(P: BlendedPalette, b: Bomb) {
    const ctx = this.ctx, f = .8 + .2 * Math.sin(this.time * 40 + b.id);
    ctx.drawImage(puff('#ffb04a'), -1.6 * f, -7.2 - 1.6 * f, 3.2 * f, 4.4 * f);
    ctx.fillStyle = P.pDark;
    ctx.beginPath(); ctx.moveTo(-.55, -3); ctx.lineTo(-1.7, -4.8); ctx.lineTo(-.55, -4.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(.55, -3); ctx.lineTo(1.7, -4.8); ctx.lineTo(.55, -4.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.pMid; ctx.fillRect(-.55, -4.5, 1.1, 9);
    ctx.fillStyle = P.pHi; ctx.globalAlpha *= .45; ctx.fillRect(-.45, -4.3, .35, 8.6); ctx.globalAlpha /= .45;
    ctx.fillStyle = P.pDark;
    ctx.beginPath(); ctx.moveTo(-.55, 4.5); ctx.quadraticCurveTo(-.4, 5.8, 0, 6.6); ctx.quadraticCurveTo(.4, 5.8, .55, 4.5); ctx.closePath(); ctx.fill();
  }

  mixHex(a: string, b: string, t: number) {
    // fast mix for '#rrggbb' or 'rgba()' strings
    const pa = this.pc(a), pb = this.pc(b);
    return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
  }
  pc(c: string): [number, number, number] {
    if (c[0] === '#') return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const m = c.match(/[\d.]+/g) ?? ['0', '0', '0']; return [+m[0], +m[1], +m[2]];
  }

  drawBase(game: Game, P: BlendedPalette) {
    const ctx = this.ctx;
    // lamps glow at blue hour and night
    ctx.save();
    ctx.translate(0, GROUND_Y); ctx.scale(1.15, 1.15); ctx.translate(-195, -800);
    if (P.lights > .02) {
      for (const [id, x, y, r] of LAMPS) {
        if (!game.has(id) || game.b(id).ruined) continue;
        ctx.globalAlpha = P.lights * .55;
        ctx.drawImage(puff('#ffc56a'), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    this.sprite(P, s => s.pad);
    ctx.restore();
    // bomb landing shadows, with the radar standing
    if (game.alive('radar')) {
      const pulse = .55 + .4 * Math.sin(this.time * 4);
      for (const b of game.bombs) {
        const lx = game.bombLandX(b), k = Math.min(1, b.t / b.T);
        ctx.globalAlpha = pulse * (.4 + .6 * k);
        ctx.fillStyle = P.shadow;
        const big = b.kind === 'bomb';
        ctx.beginPath(); ctx.ellipse(lx, GROUND_Y + 2, (big ? 9 : 4.5) * (.6 + .4 * k), (big ? 1.3 : .8), 0, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(0, GROUND_Y); ctx.scale(1.15, 1.15); ctx.translate(-195, -800);
    for (const b of game.buildings) {
      const st = b.ruined ? 2 : b.hp / b.max < .5 ? 1 : 0;
      const ox = this.offset(b);
      ctx.save(); ctx.translate(ox, 0);
      // a war mode outpost stands on its own patch of packed earth
      if (b.outpost) { ctx.fillStyle = P.bGround; ctx.beginPath(); ctx.ellipse(B.turret, G + 1.2, 34, 3, 0, 0, 7); ctx.fill(); }
      this.sprite(P, s => s.buildings[b.id][st]);
      ctx.restore();
      if (b.id === 'search' && !b.ruined) {
        const [lx, ly] = SEARCH_PIVOT, [ax, ay] = this.aimPoint(game);
        const ang = Math.atan2(ax - lx, -(ay - ly));
        ctx.save(); ctx.translate(B.search, G - 12.4); ctx.rotate(ang); this.sprite(P, s => s.searchHead); ctx.restore();
      }
    }
    // windsock
    {
      const x = 340, w = game.wind, droop = (1 - Math.min(1, Math.abs(w) * 1.2)) * 1.2;
      ctx.strokeStyle = P.bMetal; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x, G - 16); ctx.stroke();
      ctx.save(); ctx.translate(x, G - 15.5);
      const dir = w >= 0 ? 1 : -1;
      ctx.scale(dir, 1); ctx.rotate(droop + Math.sin(this.time * 3) * .05 * Math.abs(w));
      const L = 9;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? '#f2ede4' : '#e0583e';
        const x0 = i * L / 3, x1 = (i + 1) * L / 3, h0 = 1.6 - i * .35, h1 = 1.6 - (i + 1) * .35;
        ctx.beginPath(); ctx.moveTo(x0, -h0); ctx.lineTo(x1, -h1); ctx.lineTo(x1, h1); ctx.lineTo(x0, h0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // fires and hairline health bars
    for (const b of game.buildings) {
      const frac = b.hp / b.max;
      const fx = b.def.mx + this.offset(b), fy = FIRE_Y[b.id];
      if ((b.ruined && b.ruinT < 25) || (!b.ruined && frac < .3)) {
        const k = (b.ruined ? .7 : .85) * (1 + .12 * Math.sin(this.time * 17 + fx) + .06 * Math.sin(this.time * 31));
        const f = SHARED.fire;
        ctx.drawImage(f.img, fx - 10 * k * .8, (b.ruined ? G - 3 : fy) - 11 * k * .8 - 2, 20 * k * .8, 21 * k * .8);
      }
      if (!b.ruined && frac < 1) {
        const w = 18, y = b.def.box[1] - 4;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(fx - w / 2 - .5, y - .5, w + 1, 2.6, 1.3); ctx.fill();
        ctx.fillStyle = frac > .6 ? '#9fe0b0' : frac > .25 ? P.amber : P.red;
        ctx.beginPath(); ctx.roundRect(fx - w / 2, y, w * frac, 1.6, .8); ctx.fill();
      }
      // the building's health in small white figures above it ("0%" once it is ruined)
      // (in adventure the turret's is a share of a normal turret's, so a new adventure turret reads 20%)
      const pct = game.adventure && b.id === 'turret' ? game.turretPct(b) : b.ruined ? 0 : Math.max(1, Math.round(frac * 100));
      // the turret's sits beside the gun barrel, which would otherwise cross it
      const tx = b.id === 'turret' ? fx + 16 : fx, ty = b.id === 'turret' ? FIRE_Y.turret - 2 : b.def.box[1] - (!b.ruined && frac < 1 ? 5.5 : 2.5);
      ctx.font = `600 4.6px Jost, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(pct + '%', tx + .3, ty + .3);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = b.ruined ? .6 : .92; ctx.fillText(pct + '%', tx, ty); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** How far a building is drawn from where its drawing puts it, in mockup units (war mode's outposts reuse the turret's). */
  offset(b: Building) { return (b.x - mockToWorld(b.def.mx, G)[0]) / BASE_SCALE; }
  /** A point far out along the aim, which the searchlight follows. */
  aimPoint(game: Game): [number, number] { return [game.gunX + Math.sin(game.aim) * 700, -Math.cos(game.aim) * 700]; }
  searchlightOn(game: Game, P: BlendedPalette) { return game.alive('search') && P.dark > .15; }
  litBy(game: Game, P: BlendedPalette, x: number, y: number) {
    if (!this.searchlightOn(game, P)) return 0;
    const [lx, ly] = SEARCH_PIVOT;
    const [px, py] = this.aimPoint(game), ax = px - lx, ay = py - ly;
    const bx = x - lx, by = y - ly;
    const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) + 1e-6);
    const ang = Math.acos(Math.min(1, cos));
    return Math.max(0, Math.min(1, (.13 - ang) / .05));
  }
  drawBeam(game: Game, P: BlendedPalette) {
    if (!this.searchlightOn(game, P)) return;
    const ctx = this.ctx;
    const [lx, ly] = SEARCH_PIVOT;
    const [ax, ay] = this.aimPoint(game);
    const ang = Math.atan2(ax - lx, -(ay - ly));
    const k = Math.min(1, (P.dark - .15) / .5);
    ctx.save(); ctx.translate(lx, ly - 6); ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, -1100);
    g.addColorStop(0, `rgba(255,236,190,${.24 * k})`); g.addColorStop(.4, `rgba(255,236,190,${.09 * k})`); g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(1100 * Math.tan(.1), -1100); ctx.lineTo(-1100 * Math.tan(.1), -1100); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,236,190,${.12 * k})`;
    ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); ctx.lineTo(1100 * Math.tan(.04), -1100); ctx.lineTo(-1100 * Math.tan(.04), -1100); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawTrails(game: Game, P: BlendedPalette) {
    const ctx = this.ctx, now = game.t;
    ctx.lineCap = 'round';
    // contrails
    for (const p of game.planes) {
      const pts = p.trail; if (pts.length < 3) continue;
      const fade = p.state === 'falling' ? Math.max(0, 1 - p.stateT / 2) : 1;
      for (let i = 0; i < pts.length - 1; i++) {
        const k = i / (pts.length - 2), age = Math.min(1, (now - pts[i][2]) / 4.5);
        const a = Math.pow(k, .8) * (1 - age) * fade;
        if (a < .02) continue;
        ctx.strokeStyle = P.contrail;
        ctx.globalAlpha = a * .25; ctx.lineWidth = 4 - 2.6 * k;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
        ctx.globalAlpha = a * .7; ctx.lineWidth = 1.3 - .8 * k;
        ctx.stroke();
      }
    }
    // thin white smoke behind falling bombs, widening and fading as it ages
    const bombTrail = (pts: [number, number, number][], head: { x: number; y: number } | null, fadeAll: number) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const age = (now - pts[i][2]);
        const a = Math.max(0, 1 - age / 5) * fadeAll;
        if (a < .02) continue;
        const w = .55 + Math.min(1, age / 3) * .9;
        ctx.strokeStyle = P.trail;
        ctx.globalAlpha = a * .3; ctx.lineWidth = w * 2.4;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
        ctx.globalAlpha = a * .85; ctx.lineWidth = w * .9; ctx.stroke();
      }
      if (head && pts.length) { const l = pts[pts.length - 1]; ctx.globalAlpha = .9 * fadeAll; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(head.x, head.y); ctx.stroke(); }
    };
    for (const b of game.bombs) bombTrail(b.trail, game.bombTail(b), 1);
    for (const tr of game.trails) bombTrail(tr.pts, null, 1 - tr.t / 4);
    ctx.globalAlpha = 1;
  }

  drawPlane(game: Game, P: BlendedPalette, p: Plane) {
    const ctx = this.ctx;
    const type = p.type;
    const falling = p.state === 'falling';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.pitch * p.dir);
    const fl = p.flip;
    ctx.scale(p.dir * (Math.abs(fl) < .08 ? .08 * Math.sign(fl || 1) : fl), 1);
    const ally = p.friend && type !== 'cargo' && type !== 'boss' ? type : null;
    this.sprite(P, s => ally ? (falling ? s.alliesBurnt[ally] : s.allies[ally]) : falling ? s.burnt[type] : s.planes[type]);
    // at night only the searchlight shows a plane clearly
    const lit = this.litBy(game, P, p.x, p.y);
    const dark = P.dark * .88 * (1 - lit) * (type === 'cargo' || p.friend ? .6 : 1);
    if (dark > .02) { const s = SHARED[`sil_${type}`]; ctx.globalAlpha = dark; ctx.drawImage(s.img, s.x, s.y, s.w, s.h); ctx.globalAlpha = 1; }
    if (p.hitFlash > 0) { const s = SHARED[`sil_${type}`]; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p.hitFlash * .35; ctx.filter = 'none'; ctx.drawImage(puff('#ffe8c0'), s.x, s.y, s.w, s.h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    // a gold plane: the cargo plane washed in gold, with a glint running along it
    if (p.gold) {
      const s = SHARED.sil_cargo, g = goldSil(s.img);
      ctx.globalAlpha = falling ? .35 : .62; ctx.drawImage(g, s.x, s.y, s.w, s.h);
      if (!falling) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18 + .12 * Math.sin(this.time * 4); ctx.drawImage(puff('#ffd34a'), s.x - 4, s.y - 4, s.w + 8, s.h + 8); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1;
    }
    // running lights
    const green = type === 'cargo' || p.friend;
    if ((P.dark > .2 || green) && !falling) {
      const sc = SC[type], [[wx, wy], [tx, ty]] = LIGHTS[type];
      const blink = Math.sin(this.time * 6 + p.lightPhase) > 0;
      const c1 = p.gold ? '#ffd34a' : green ? '#9dffb8' : '#ff4a3a', c2 = green ? '#ffffff' : '#7dff9a';
      const s = 1 / Math.max(.3, Math.abs(fl));
      if (blink || !green) { ctx.drawImage(puff(c1), wx * sc - 2.5 * s, wy * sc - 2.5, 5 * s, 5); }
      if (blink) ctx.drawImage(puff(c2), tx * sc - 2 * s, ty * sc - 2, 4 * s, 4);
    }
    ctx.restore();
    // a friendly plane carries a green marker above it, so it can be told apart at a glance; a gold plane, a gold one
    if ((p.friend || p.gold) && !falling) {
      const y = p.y - (p.gold ? 14 : 11) - .8 * Math.sin(this.time * 3 + p.lightPhase);
      if (p.gold) this.twinkles(p.x, p.y, 34, 12, p.lightPhase);
      ctx.strokeStyle = p.gold ? '#ffd34a' : '#9dffb8'; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.moveTo(p.x - 3, y - 2.4); ctx.lineTo(p.x, y); ctx.lineTo(p.x + 3, y - 2.4); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.burning && !falling) { const f = SHARED.fire, k = .5; ctx.drawImage(f.img, p.x - 10 * k, p.y - 14 * k, 20 * k, 21 * k); }
    // co-op: the plane the Bomber flies wears a red marker, and a bubble while its shield is up
    if (p.player && !falling) {
      const y = p.y - 13 - .8 * Math.sin(this.time * 3);
      ctx.strokeStyle = '#ff6b5a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .95;
      ctx.beginPath(); ctx.moveTo(p.x - 3.4, y - 2.6); ctx.lineTo(p.x, y); ctx.lineTo(p.x + 3.4, y - 2.6); ctx.stroke();
      if ((game.bomber?.shieldT ?? 0) > 0) {
        ctx.globalAlpha = .45 + .2 * Math.sin(this.time * 6); ctx.strokeStyle = '#7fe9ff';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, HALF[type] * SC[type] + 4, 9, 0, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // health bar, shown once it has been hit; the boss always shows its own, bigger one
    const boss = type === 'boss';
    if (!falling && p.max > 1 && (boss || p.hp < p.max)) {
      const w = boss ? 44 : p.player ? 26 : type === 'heavy' ? 26 : 18, y = p.y - (boss ? 22 : p.player ? 19 : 15), fr = Math.max(0, p.hp / p.max);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(p.x - w / 2 - .5, y - .5, w + 1, 2.6, 1.3); ctx.fill();
      ctx.fillStyle = fr > .5 ? P.amber : P.red; ctx.beginPath(); ctx.roundRect(p.x - w / 2, y, w * fr, 1.6, .8); ctx.fill();
    }
  }

  /** Co-op: the Sniper's laser, a thin red beam down to a dot, with a ring closing in until it hits. */
  drawSnipes(game: Game) {
    const ctx = this.ctx;
    for (const sn of game.snipes) {
      const k = Math.max(0, sn.t / (sn.d || SNIPER.delay));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = .6; ctx.globalAlpha = .35 + .25 * Math.sin(this.time * 20);
      ctx.beginPath(); ctx.moveTo(sn.x - 500, sn.y - 1200); ctx.lineTo(sn.x, sn.y); ctx.stroke();
      ctx.globalAlpha = .9; ctx.drawImage(puff('#ff3a2a'), sn.x - 4, sn.y - 4, 8, 8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .85; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(sn.x, sn.y, 4 + 14 * k, 0, 7); ctx.stroke();
      ctx.restore();
    }
    // Protection: a gold shimmer along the base, or round the Bomber's plane
    if (game.protectT > 0) {
      ctx.save(); ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 1; ctx.globalAlpha = .35 + .2 * Math.sin(this.time * 6);
      for (const b of game.buildings) if (!b.ruined) { ctx.beginPath(); ctx.roundRect(b.x - b.half - 2, GROUND_Y - 30, b.half * 2 + 4, 30, 4); ctx.stroke(); }
      ctx.restore();
    }
    const bp = game.bomber?.plane;
    if (bp && (game.bomber?.protectT ?? 0) > 0) {
      ctx.save(); ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 1.1; ctx.globalAlpha = .5 + .2 * Math.sin(this.time * 6);
      ctx.beginPath(); ctx.ellipse(bp.x, bp.y, HALF[bp.type] * SC[bp.type] + 6, 11, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  /** Co-op: the Bomber's metal arm, a jointed rod from the plane to the pack it is reeling in, with its health. */
  drawArm(game: Game) { this.drawOneArm(game, 'bomber'); this.drawOneArm(game, 'sniper'); }
  /** The Sniper's arm is the same rod, hanging straight down from the top of the sky. */
  drawOneArm(game: Game, who: ArmOwner) {
    const a = game.armOf(who);
    if (!a) return;
    const ctx = this.ctx, n = who === 'sniper' ? 12 : 6;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const [x, y] = game.armPoint(i / n, who);
      // a slight sag in the middle
      pts.push([x, y + Math.sin(Math.PI * i / n) * 4]);
    }
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 1.8;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.strokeStyle = '#b8bcc6'; ctx.lineWidth = .9;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.fillStyle = '#d8dce4';
    for (const [x, y] of pts.slice(1, -1)) { ctx.beginPath(); ctx.arc(x, y, .9, 0, 7); ctx.fill(); }
    // the claw around the pack
    const [cx, cy] = pts[n];
    ctx.strokeStyle = '#d8dce4'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy - 3); ctx.lineTo(cx - 4.5, cy + 2); ctx.moveTo(cx + 4, cy - 3); ctx.lineTo(cx + 4.5, cy + 2); ctx.stroke();
    // its health, over the middle of the arm
    const [mx, my] = pts[who === 'sniper' ? n - 2 : n >> 1], w = 20, fr = Math.max(0, a.hp / a.max);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(mx - w / 2 - .5, my - 8.5, w + 1, 2.6, 1.3); ctx.fill();
    ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.roundRect(mx - w / 2, my - 8, w * fr, 1.6, .8); ctx.fill();
    ctx.restore();
  }

  // The crate's landing zone on the pad, shown while a drop is on its way: corner marks, pulsing while the crate comes down.
  drawLandingZone(game: Game) {
    const zones: [number, boolean, string][] = game.crates.map(c => [c.lz, !c.landed, crateTint(c)]);
    if (game.cargo) zones.push([game.lzX, false, game.cargo.gold ? '#ffd34a' : '#9dffb8']);
    const ctx = this.ctx, y = GROUND_Y - 3;
    ctx.save();
    ctx.lineWidth = .5; ctx.lineCap = 'round';
    for (const [LZ_X, falling, tint] of zones) {
      ctx.strokeStyle = tint;
      ctx.globalAlpha = falling ? .45 + .35 * Math.sin(this.time * 5) : .3;
      for (const d of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(LZ_X + d * 8, y - 1.6); ctx.lineTo(LZ_X + d * 9, y); ctx.lineTo(LZ_X + d * 6.5, y + .6); ctx.stroke();
      }
    }
    ctx.restore();
  }
  drawCrate(_game: Game, _P: BlendedPalette, c: Crate) {
    const ctx = this.ctx;
    if (c.landed) {
      // a gentle pulse around the waiting crate: tap it to open
      const k = (this.time * .7) % 1, glow = .5 + .5 * Math.sin(this.time * 3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .25 + .25 * glow;
      ctx.drawImage(puff(crateTint(c)), c.x - 10, c.y - 12, 20, 20);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = c.diamond ? '#d8f6ff' : c.gold ? '#ffe9a0' : '#bff5cf'; ctx.lineWidth = .6;
      ctx.globalAlpha = .8 * (1 - k);
      ctx.beginPath(); ctx.ellipse(c.x, GROUND_Y - 2.4, 5 + 9 * k, 1.2 + 2 * k, 0, 0, 7); ctx.stroke();
      const by = c.y - 10 - 1.2 * Math.sin(this.time * 3);
      ctx.globalAlpha = .6 + .35 * glow; ctx.lineWidth = .8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(c.x - 2.6, by - 1.8); ctx.lineTo(c.x, by + .6); ctx.lineTo(c.x + 2.6, by - 1.8); ctx.stroke();
      ctx.restore();
    }
    ctx.save(); ctx.translate(c.x + (c.dodgeX ?? 0), c.y);
    ctx.scale(.7, .7);
    const chute = c.landed ? Math.max(0, 1 - c.t * 1.5) : 1;
    ctx.rotate(c.sway);
    if (chute > 0) {
      ctx.globalAlpha = chute;
      ctx.strokeStyle = 'rgba(240,236,224,.7)'; ctx.lineWidth = .35;
      ctx.beginPath(); ctx.moveTo(-2.5, -3); ctx.lineTo(-8, -15); ctx.moveTo(2.5, -3); ctx.lineTo(8, -15); ctx.moveTo(0, -3); ctx.lineTo(0, -16); ctx.stroke();
      const g = ctx.createLinearGradient(0, -22, 0, -14); g.addColorStop(0, '#f4f0e6'); g.addColorStop(1, '#b9c8bd');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-9, -15); ctx.quadraticCurveTo(-9, -23, 0, -23.5); ctx.quadraticCurveTo(9, -23, 9, -15); ctx.quadraticCurveTo(4.5, -17, 0, -15.5); ctx.quadraticCurveTo(-4.5, -17, -9, -15); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = c.diamond ? '#4fb8d8' : c.gold ? '#c9952a' : '#6f6248'; ctx.fillRect(-3, -3, 6, 5);
    ctx.fillStyle = c.diamond ? '#c9f4ff' : c.gold ? '#ffe27a' : '#4fae74'; ctx.fillRect(-3, -1, 6, 1.1);
    // a diamond pack is cut like a gem: a lighter facet down one side
    if (c.diamond) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(0, -3); ctx.lineTo(-3, 2); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-3, -3, 6, .6);
    if (!c.landed && Math.sin(this.time * 7) > .3) { ctx.drawImage(puff(crateTint(c)), -2, -6, 4, 4); }
    ctx.restore();
    // a newly dropped diamond pack shimmers inside a shield while it can't be shot down
    if (_game.crateSafe(c)) {
      ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(this.time * 10); ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.arc(c.x + (c.dodgeX ?? 0), c.y - 2, 7, 0, 7); ctx.stroke(); ctx.restore();
    }
    // gold and diamond packs sparkle
    if (c.gold || c.diamond) this.twinkles(c.x + (c.dodgeX ?? 0), c.y - 1.5, 14, 10, 1.7, c.diamond ? '#effcff' : '#fff3b8');
  }
  /** Little four-point gold glints that wink on and off around (x, y), in a w by h box. */
  twinkles(x: number, y: number, w: number, h: number, seed: number, color = '#fff3b8') {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      const ph = this.time * (1.6 + i * .23) + seed * 3.1 + i * 1.9, k = Math.sin(ph);
      if (k <= 0) continue;
      // each glint moves to a new spot every time it winks
      const n = Math.floor(ph / (Math.PI * 2)), rx = Math.sin(n * 12.9898 + i * 78.233 + seed) * 43758.5453, ry = Math.sin(n * 39.346 + i * 11.135 + seed) * 24634.6345;
      const gx = x + (rx - Math.floor(rx) - .5) * w, gy = y + (ry - Math.floor(ry) - .5) * h, r = 1.8 * k;
      ctx.globalAlpha = .9 * k;
      ctx.beginPath();
      ctx.moveTo(gx, gy - r); ctx.lineTo(gx + r * .25, gy - r * .25); ctx.lineTo(gx + r, gy); ctx.lineTo(gx + r * .25, gy + r * .25);
      ctx.lineTo(gx, gy + r); ctx.lineTo(gx - r * .25, gy + r * .25); ctx.lineTo(gx - r, gy); ctx.lineTo(gx - r * .25, gy - r * .25);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawShots(game: Game, P: BlendedPalette) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const s of game.shells) {
      const sp = Math.hypot(s.vx, s.vy) || 1;
      // a ghost shell is light blue and glows
      if (s.ghost) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7; ctx.drawImage(puff('#7fd8ff'), s.x - 4, s.y - 4, 8, 8); ctx.globalCompositeOperation = 'source-over'; }
      ctx.strokeStyle = s.ghost ? '#9fe6ff' : P.shell; ctx.globalAlpha = .55; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x - s.vx / sp * 14, s.y - s.vy / sp * 14); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = s.ghost ? '#e2f8ff' : '#fff4d0'; ctx.beginPath(); ctx.arc(s.x, s.y, 1.2, 0, 7); ctx.fill();
    }
    for (const m of game.missiles) {
      const sp = Math.hypot(m.vx, m.vy) || 1, ux = m.vx / sp, uy = m.vy / sp;
      if (m.kind === 'fireball') {
        const r = 7 + Math.sin(this.time * 40 + m.t * 9) * 1;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(puff('#ff7a1a'), m.x - r, m.y - r, r * 2, r * 2);
        ctx.drawImage(puff('#fff1c0'), m.x - 3, m.y - 3, 6, 6);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (m.kind === 'bomblet') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(puff('#ffb04a'), m.x - 2.5, m.y - 2.5, 5, 5);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (m.kind === 'cluster') {
        ctx.strokeStyle = '#ffd36a'; ctx.globalAlpha = .6; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(m.x - ux * 12, m.y - uy * 12); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, 7); ctx.fill();
        continue;
      }
      const len = m.kind === 'nuke' ? 9 : m.kind === 'rocket' ? 6 : 5;
      ctx.strokeStyle = m.kind === 'nuke' ? '#3d4238' : P.bMetal; ctx.lineWidth = m.kind === 'nuke' ? 3.4 : m.kind === 'rocket' ? 1.8 : 1.4;
      ctx.beginPath(); ctx.moveTo(m.x - ux * len, m.y - uy * len); ctx.lineTo(m.x, m.y); ctx.stroke();
      if (m.kind === 'nuke') {
        ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3.6;
        ctx.beginPath(); ctx.moveTo(m.x - ux * 5, m.y - uy * 5); ctx.lineTo(m.x - ux * 4, m.y - uy * 4); ctx.stroke();
      }
      const f = m.kind === 'nuke' ? 12 : m.kind === 'rocket' ? 10 : 8;
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(puff('#ffb04a'), m.x - ux * (len + 1) - f / 2, m.y - uy * (len + 1) - f / 2, f, f); ctx.globalCompositeOperation = 'source-over';
    }
    // sonic pulses: bright arcs spreading out along the aim they were fired at
    ctx.globalCompositeOperation = 'lighter';
    for (const p of game.pulses) {
      const fade = 1 - p.r / 1000, a0 = p.a - Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const r = p.r - i * 9;
        if (r < 40) continue;
        ctx.strokeStyle = '#8fd8ff'; ctx.globalAlpha = fade * (.75 - i * .22); ctx.lineWidth = 3 - i * .8;
        ctx.beginPath(); ctx.arc(p.x, 0, r, a0 - .26, a0 + .26); ctx.stroke();
      }
    }
    // the laser: a hot core inside a soft red glow, flickering a little
    if (game.lasing) {
      const [dx, dy] = game.aimDir(), fl = 1 + .25 * Math.sin(this.time * 70);
      const x0 = game.gunX + dx * 48, y0 = dy * 48, x1 = game.gunX + dx * 1100, y1 = dy * 1100;
      for (const [w, c, a] of [[7, '#ff2a2a', .22], [3, '#ff5a5a', .6], [1, '#fff0f0', 1]] as [number, string, number][]) {
        ctx.strokeStyle = c; ctx.globalAlpha = a; ctx.lineWidth = w * fl;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalAlpha = .9; ctx.drawImage(puff('#ff6a5a'), x0 - 6, y0 - 6, 12, 12);
    }
    // chain lightning: a jagged violet bolt through every point it jumped between, redrawn each frame so it crackles
    for (const b of game.bolts) {
      const k = Math.min(1, b.life / .2);
      for (const [w, c, a] of [[5, '#8a6bff', .3], [1.6, '#c9b6ff', .8], [.7, '#ffffff', 1]] as [number, string, number][]) {
        ctx.strokeStyle = c; ctx.globalAlpha = a * k; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(b.pts[0][0], b.pts[0][1]);
        for (let i = 1; i < b.pts.length; i++) {
          const [x0, y0] = b.pts[i - 1], [x1, y1] = b.pts[i];
          const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, Math.round(len / 28));
          const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
          for (let j = 1; j < steps; j++) {
            const t = j / steps, j2 = (Math.random() - .5) * Math.min(18, len * .12);
            ctx.lineTo(x0 + (x1 - x0) * t + nx * j2, y0 + (y1 - y0) * t + ny * j2);
          }
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = P.tracer; ctx.lineWidth = .9;
    for (const t of game.tracers) {
      ctx.globalAlpha = Math.min(1, t.life / .1) * .85;
      ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(game: Game, P: BlendedPalette) {
    const ctx = this.ctx;
    for (const p of game.particles) {
      const k = p.t / p.life;
      if (p.k === 'puff') {
        const col = p.color ? P[p.color] : '#888888';
        ctx.globalAlpha = (p.a ?? 1) * (1 - k) * (k < .08 ? k / .08 : 1);
        const r = p.r * 1.25;
        ctx.drawImage(puff(col), p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.k === 'fire') {
        const f = SHARED.fire, s = p.r * (1 - k * .7) * .6;
        ctx.globalAlpha = 1 - k * .5;
        ctx.drawImage(f.img, p.x - 10 * s, p.y - 11 * s, 20 * s, 21 * s);
      } else if (p.k === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k) * .9;
        ctx.drawImage(puff('#ffb04a'), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.globalAlpha = (1 - k);
        ctx.drawImage(puff('#fff1c8'), p.x - p.r * .3, p.y - p.r * .3, p.r * .6, p.r * .6);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.k === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#fff1c8'; ctx.globalAlpha = (1 - k) * .8; ctx.lineWidth = 2 + 10 * (1 - k);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.k === 'spark') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffe2a0'; ctx.fillRect(p.x - .4, p.y - .4, .8, .8);
      } else if (p.k === 'debris') {
        ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = P.bDark; ctx.fillRect(p.x - p.r, p.y - p.r * .6, p.r * 2, p.r * 1.2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Adventure: the extra turrets, drawn in the world at the main gun's aim. */
  drawAdvGuns(game: Game, P: BlendedPalette) {
    for (const b of game.advGuns()) this.drawBarrel(P, b.x, game.aim, game.recoil, game.flash);
  }
  /** Co-op: the second Base player's turret, drawn in the world at its own aim, with its player's name. */
  drawGun2(game: Game, P: BlendedPalette) {
    const g = game.gun2, post = game.gun2Post();
    if (!g || !post || post.ruined) return;
    const ctx = this.ctx;
    this.drawBarrel(P, g.x, g.aim, g.recoil, g.flash);
    ctx.save();
    ctx.font = `500 7px Jost, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#9dd8ff'; ctx.globalAlpha = .9;
    ctx.fillText(g.name, g.x, GROUND_Y + 9);
    ctx.restore();
  }
  drawBarrel(P: BlendedPalette, x: number, aim: number, recoil: number, flash: number) {
    const g = { recoil, flash };
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, 0); ctx.rotate(aim);
    ctx.fillStyle = P.bMetal;
    ctx.fillRect(-2.6, -18, 1.6, 16); ctx.fillRect(1, -18, 1.6, 16);
    const bar = ctx.createLinearGradient(-1.5, 0, 1.5, 0);
    bar.addColorStop(0, P.bLit); bar.addColorStop(.4, P.bMetal); bar.addColorStop(1, P.bDark);
    ctx.translate(0, g.recoil * 3);
    ctx.fillStyle = bar; ctx.fillRect(-1.5, -44, 3, 44);
    ctx.fillStyle = P.bMetal; ctx.beginPath(); ctx.roundRect(-1.9, -48, 3.8, 5, .6); ctx.fill();
    if (g.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = g.flash;
      ctx.drawImage(puff('#ffb04a'), -9, -63, 18, 18);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /* ---------- screen space ---------- */
  drawGun(game: Game, P: BlendedPalette) {
    const ctx = this.ctx;
    if (game.post().ruined) return;
    const rc = game.recoil * 3;
    ctx.fillStyle = P.bMetal;
    ctx.fillRect(-2.6, -18, 1.6, 16); ctx.fillRect(1, -18, 1.6, 16);
    const bar = ctx.createLinearGradient(-1.5, 0, 1.5, 0);
    bar.addColorStop(0, P.bLit); bar.addColorStop(.4, P.bMetal); bar.addColorStop(1, P.bDark);
    const barrels = game.guns === 3 ? [-3.4, 0, 3.4] : game.guns === 2 ? [-2.2, 2.2] : [0];
    const wc = game.weapon ? UPGRADES[game.weapon].color : null;
    for (const bx of barrels) {
      const w = game.guns === 3 ? 2.1 : game.guns === 2 ? 2.4 : 3;
      ctx.save(); ctx.translate(bx, rc);
      ctx.fillStyle = bar; ctx.fillRect(-w / 2, -44, w, 44);
      ctx.fillStyle = P.bMetal; ctx.beginPath(); ctx.roundRect(-w / 2 - .4, -48, w + .8, 5, .6); ctx.fill();
      ctx.strokeStyle = P.bDark; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-w / 2 - .4, -46); ctx.lineTo(w / 2 + .4, -46); ctx.stroke();
      // a band in the special weapon's colour
      if (wc) { ctx.fillStyle = wc; ctx.fillRect(-w / 2 - .3, -40, w + .6, 3); }
      ctx.restore();
    }
    if (game.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = game.flash;
      ctx.drawImage(puff('#ffb04a'), -9, -63, 18, 18);
      ctx.fillStyle = '#fff1c0';
      for (const bx of barrels) { ctx.beginPath(); ctx.moveTo(bx, -49); ctx.lineTo(bx - 3.4, -55); ctx.lineTo(bx, -53.2); ctx.lineTo(bx + 3.4, -55); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx, -50); ctx.lineTo(bx, -60); ctx.lineTo(bx + 1, -52); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // the special weapon and what is left of it, beside the turret
    if (game.weapon && wc) {
      const timed = game.weapon === 'rapid' || game.weapon === 'laser';
      const left = timed ? `${Math.ceil(game.ammo)}s` : game.weapon === 'nuke' ? '' : String(Math.ceil(game.ammo));
      ctx.globalAlpha = .9; ctx.fillStyle = wc; ctx.textAlign = 'left'; ctx.font = `500 8px Jost, system-ui, sans-serif`;
      ctx.fillText(`${UPGRADES[game.weapon].hud} ${left}`.trim(), 7, -46);
      if (game.weapon === 'missiles') for (let i = 0; i < game.ammo; i++) {
        ctx.beginPath(); const x = 7 + i * 4.2, y = -38; ctx.moveTo(x, y - 2.6); ctx.lineTo(x + 1.3, y); ctx.lineTo(x, y + 2.6); ctx.lineTo(x - 1.3, y); ctx.fill();
      }
    }
    if (game.shieldT > 0) {
      ctx.globalAlpha = .9; ctx.fillStyle = UPGRADES.shield.color; ctx.textAlign = 'right'; ctx.font = `500 8px Jost, system-ui, sans-serif`;
      ctx.fillText(`SHIELD ${Math.ceil(game.shieldT)}s`, -7, -46);
    }
    ctx.globalAlpha = 1;
  }

  drawOverlays(game: Game, P: BlendedPalette) {
    const ctx = this.ctx, s = this.s;
    // the nuke whites out the screen for a moment
    if (game.nukeFlash > 0) {
      ctx.fillStyle = '#fff6e0'; ctx.globalAlpha = Math.min(1, game.nukeFlash * game.nukeFlash) * (game.settings.reduceMotion ? .35 : .85);
      ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1;
    }
    // missile lock bracket
    const L = game.lock;
    if (L.target && !L.target.dead && game.weapon === 'missiles') {
      const [x, y] = this.worldToScreen(game, L.target.x, L.target.y);
      const k = Math.min(1, L.t), size = (26 - 12 * k) * s, c = L.locked ? '#ff6b5a' : '#ffdf7a';
      ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.globalAlpha = L.locked ? .95 : .5 + .4 * k;
      const q = size * .35;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath(); ctx.moveTo(x + dx * size, y + dy * (size - q)); ctx.lineTo(x + dx * size, y + dy * size); ctx.lineTo(x + dx * (size - q), y + dy * size); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // floating score labels
    ctx.textAlign = 'center';
    for (const l of game.labels) {
      const [x, y] = this.worldToScreen(game, l.x, l.y);
      const k = l.t / l.life;
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.font = `500 ${(l.big ? 13 : 10) * Math.max(.9, s)}px Jost, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillText(l.text, x + 1, y - k * 22 * s + 1);
      ctx.fillStyle = l.color; ctx.fillText(l.text, x, y - k * 22 * s);
    }
    ctx.globalAlpha = 1;
    // co-op: the Bomber's name over its plane
    const bp = game.bomber?.plane;
    if (bp && !bp.dead) {
      const [x, y] = this.worldToScreen(game, bp.x, bp.y - 26);
      ctx.font = `500 ${10 * Math.max(.9, s)}px Jost, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillText(game.bomber!.name, x + 1, y + 1);
      ctx.fillStyle = '#ff8a7a'; ctx.fillText(game.bomber!.name, x, y);
    }
    // arrows at the screen edge for planes out of view, while the radar stands
    if (game.alive('radar') && game.phase !== 'over') {
      const m = 12, top = this.safeTop + 92, bottom = this.H - 34 * s;
      const cx = this.W / 2, cy = (top + bottom) / 2;
      ctx.strokeStyle = P.hud; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const p of game.planes) {
        if (p.state === 'falling' || p.dead) continue;
        const [x, y] = this.worldToScreen(game, p.x, p.y);
        if (x > 0 && x < this.W && y > top - 40 && y < this.H) continue;
        const dx = x - cx, dy = y - cy;
        const tx = dx > 0 ? (this.W - m - cx) / dx : (m - cx) / dx;
        const ty = dy > 0 ? (bottom - cy) / dy : (top - cy) / dy;
        const t = Math.min(Math.abs(tx), Math.abs(ty));
        const ax = cx + dx * t, ay = cy + dy * t, ang = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
        const green = p.type === 'cargo' || p.friend;
        ctx.globalAlpha = green ? .9 : .8;
        ctx.strokeStyle = p.gold ? '#ffd34a' : green ? '#9dffb8' : p.player ? '#ff6b5a' : P.hud;
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(0, 0); ctx.lineTo(-6, 6); ctx.stroke();
        if (p.type === 'fighter' && (p.state === 'warn' || p.state === 'dive')) { ctx.strokeStyle = P.red; ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(-5, 0); ctx.lineTo(-11, 6); ctx.stroke(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawHud(game: Game, P: BlendedPalette) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const u = Math.max(1, Math.min(1.35, this.s));
    const top = this.safeTop + 14;
    ctx.fillStyle = P.hud; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (game.phase !== 'idle') {
      // score and multiplier
      ctx.font = `500 ${17 * u}px Jost, system-ui, sans-serif`;
      const sc = game.score.toLocaleString('en-US');
      ctx.fillText(sc, 18, top + 18 * u);
      const w = ctx.measureText(sc).width;
      ctx.font = `500 ${11 * u}px Jost, system-ui, sans-serif`; ctx.globalAlpha = .8;
      ctx.fillText('×' + game.mult, 18 + w + 5, top + 18 * u);
      ctx.globalAlpha = 1;
      // wave and planes remaining; in war mode the level and the time left
      ctx.textAlign = 'center';
      ctx.font = `500 ${10.5 * u}px Jost, system-ui, sans-serif`;
      this.spaced(game.war ? 'WAR · LEVEL 1' : `WAVE ${game.wave}`, W / 2, top + 12 * u, 2.4 * u);
      if (game.difficulty === 'hard') {
        ctx.font = `500 ${8.5 * u}px Jost, system-ui, sans-serif`; ctx.fillStyle = P.red;
        this.spaced('HARD', W / 2, top + 38 * u, 2 * u);
        ctx.fillStyle = P.hud; ctx.font = `500 ${10.5 * u}px Jost, system-ui, sans-serif`;
      }
      if (game.war) {
        const left = Math.max(0, Math.ceil(WAR_TIME - game.warT));
        ctx.font = `500 ${12 * u}px Jost, system-ui, sans-serif`;
        ctx.fillText(game.phase === 'won' ? 'survived' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, top + 27 * u);
        this.drawStrikes(game, P, 18, top + 34 * u, u);
      } else {
        ctx.font = `${9 * u}px Jost, system-ui, sans-serif`; ctx.globalAlpha = .75;
        const left = game.planesLeft();
        ctx.fillText(game.phase === 'clear' ? 'cleared' : `${left} plane${left === 1 ? '' : 's'} left`, W / 2, top + 26 * u);
        ctx.globalAlpha = 1;
        // co-op: how the Bomber is doing
        const bm = game.bomber;
        if (bm) {
          ctx.font = `500 ${9 * u}px Jost, system-ui, sans-serif`; ctx.fillStyle = '#ff8a7a';
          const st = bm.plane ? (bm.arm ? 'stealing an upgrade' : bm.perk ? 'has an upgrade' : 'flying') : `back in ${Math.ceil(bm.deadT)}`;
          ctx.fillText(`BOMBER ${bm.name.toUpperCase()} · ${st}`, W / 2, top + (game.difficulty === 'hard' ? 50 : 40) * u);
          ctx.fillStyle = P.hud;
        }
        // and the Sniper, when they have an arm out or an upgrade
        const sn = game.sniper, sst = sn ? game.sniperStatus() : '';
        if (sn && sst) {
          ctx.font = `500 ${9 * u}px Jost, system-ui, sans-serif`; ctx.fillStyle = '#ff8a7a';
          ctx.fillText(`SNIPER ${sn.name.toUpperCase()} · ${sst}`, W / 2, top + ((game.difficulty === 'hard' ? 50 : 40) + (bm ? 12 : 0)) * u);
          ctx.fillStyle = P.hud;
        }
      }
    }
    // pinned base status strip
    const sh = 18 * this.s;
    ctx.fillStyle = P.stripBg; ctx.fillRect(0, H - sh, W, sh);
    // in war mode the outposts sit apart at either end of the strip, and the turret in use is underlined
    const base = game.buildings.filter(b => !b.outpost);
    game.buildings.forEach(b => {
      const i = base.indexOf(b);
      const x = i >= 0 ? W / 2 + (i - (base.length - 1) / 2) * 16 * this.s - 5 * this.s : W / 2 + Math.sign(b.x) * ((base.length + 3) / 2 * 16) * this.s - 5 * this.s;
      const y = H - sh / 2 - 2 * this.s;
      const fr = b.hp / b.max;
      if (b.ruined) { ctx.strokeStyle = '#9a8fa8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + .5, y + .5, 9 * this.s, 3 * this.s, 1.5 * this.s); ctx.stroke(); }
      else { ctx.fillStyle = fr > .6 ? '#9fe0b0' : fr > .25 ? P.amber : P.red; ctx.beginPath(); ctx.roundRect(x, y, 10 * this.s, 4 * this.s, 2 * this.s); ctx.fill(); }
      if (game.war && b === game.post()) { ctx.fillStyle = P.hud; ctx.globalAlpha = .85; ctx.fillRect(x + 2 * this.s, y + 6 * this.s, 6 * this.s, 1.2 * this.s); ctx.globalAlpha = 1; }
    });
    // in war mode, arrows toward the other turrets show which way to swipe
    if (game.war && game.phase !== 'idle' && !game.ended) {
      ctx.strokeStyle = P.hud; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const y = H - sh - 22 * this.s;
      for (const d of [-1, 1]) {
        if (!game.posts.some((b, i) => !b.ruined && (i - game.postI) * d > 0)) continue;
        const x = d < 0 ? 14 : W - 14;
        ctx.globalAlpha = .45 + .15 * Math.sin(this.time * 3);
        ctx.beginPath(); ctx.moveTo(x - d * 5, y - 7); ctx.lineTo(x + d * 2, y); ctx.lineTo(x - d * 5, y + 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // wave title card and clear tally
    if (game.phase === 'intro') this.drawIntro(game, P);
    if (game.phase === 'clear') this.drawClear(game, P);
  }
  /** War mode: one mark for each friendly plane the player may still shoot down before losing, crossed out once used. */
  drawStrikes(game: Game, P: BlendedPalette, x: number, y: number, u: number) {
    const ctx = this.ctx;
    ctx.textAlign = 'left'; ctx.font = `500 ${8 * u}px Jost, system-ui, sans-serif`; ctx.fillStyle = P.hud; ctx.globalAlpha = .75;
    this.spaced('FRIENDLY FIRE', x, y + 8 * u, 1.2 * u);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < WAR_STRIKES; i++) {
      const cx = x + 5 * u + i * 14 * u, cy = y + 18 * u, used = i < game.strikes;
      // a small plane seen from above
      ctx.strokeStyle = used ? P.red : '#9dffb8'; ctx.lineWidth = 1.4 * u; ctx.globalAlpha = used ? 1 : .85;
      ctx.beginPath(); ctx.moveTo(cx, cy - 4 * u); ctx.lineTo(cx, cy + 4 * u); ctx.moveTo(cx - 4.5 * u, cy); ctx.lineTo(cx + 4.5 * u, cy); ctx.moveTo(cx - 2 * u, cy + 3.5 * u); ctx.lineTo(cx + 2 * u, cy + 3.5 * u); ctx.stroke();
      if (used) { ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(cx - 5 * u, cy - 5 * u); ctx.lineTo(cx + 5 * u, cy + 5 * u); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  spaced(text: string, x: number, y: number, sp: number) {
    const ctx = this.ctx;
    if ('letterSpacing' in CanvasRenderingContext2D.prototype) { ctx.letterSpacing = sp + 'px'; ctx.fillText(text, x + sp / 2, y); ctx.letterSpacing = '0px'; }
    else ctx.fillText(text, x, y);
  }
  drawIntro(game: Game, P: BlendedPalette) {
    const ctx = this.ctx, W = this.W, H = this.H, t = game.phaseT;
    const a = Math.min(1, t / .4) * Math.min(1, (3 - t) / .5);
    const u = Math.max(1, Math.min(1.4, this.s));
    ctx.globalAlpha = a; ctx.fillStyle = P.hud; ctx.textAlign = 'center';
    ctx.font = `500 ${30 * u}px Jost, system-ui, sans-serif`;
    this.spaced(game.war ? 'LEVEL 1' : `WAVE ${game.wave}`, W / 2, H * .3, 6 * u);
    if (game.war) {
      ctx.font = `${14 * u}px Jost, system-ui, sans-serif`;
      ctx.fillText(`Hold out for ${WAR_TIME / 60} minutes`, W / 2, H * .3 + 28 * u);
      ctx.globalAlpha = a * .8; ctx.font = `${12 * u}px Jost, system-ui, sans-serif`;
      ctx.fillText(`Don't shoot down ${WAR_STRIKES} friendly planes`, W / 2, H * .3 + 48 * u);
    }
    ctx.globalAlpha = 1;
  }
  drawClear(game: Game, P: BlendedPalette) {
    const ctx = this.ctx, W = this.W, H = this.H, t = game.phaseT, info = game.clearInfo;
    if (!info) return;
    const a = Math.min(1, t / .4) * Math.min(1, (10 - t) / .6);
    const u = Math.max(1, Math.min(1.4, this.s));
    ctx.globalAlpha = a; ctx.fillStyle = P.hud; ctx.textAlign = 'center';
    ctx.font = `500 ${22 * u}px Jost, system-ui, sans-serif`;
    this.spaced(`WAVE ${game.wave} CLEARED`, W / 2, H * .28, 3 * u);
    ctx.font = `${13 * u}px Jost, system-ui, sans-serif`;
    const lines: [string, number][] = [[`Wave bonus`, info.bonus], [`Base health`, info.health]];
    if (info.perfect) lines.push(['Perfect wave', info.perfect]);
    lines.forEach(([k, v], i) => {
      const y = H * .28 + (30 + i * 20) * u;
      if (t < .5 + i * .35) return;
      ctx.textAlign = 'right'; ctx.globalAlpha = a * .8; ctx.fillText(k, W / 2 - 8, y);
      ctx.textAlign = 'left'; ctx.globalAlpha = a; ctx.fillText('+' + v.toLocaleString('en-US'), W / 2 + 8, y);
    });
    if (t > 1.2) { ctx.textAlign = 'center'; ctx.globalAlpha = a * (.5 + .3 * Math.sin(t * 3)); ctx.font = `${11 * u}px Jost, system-ui, sans-serif`; ctx.fillText('Tap to continue', W / 2, H * .28 + (40 + lines.length * 20) * u); }
    ctx.globalAlpha = 1;
  }
}
