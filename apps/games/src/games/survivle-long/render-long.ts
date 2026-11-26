// Drawing for the Long Edition: raiders, wolves, horses, camps, shrines, towers, springs, ore, the
// Sword of Light, night and rain, and the extra HUD.
import { ENEMY_KINDS, LIGHT_HEARTS, armorById, raiderShield, raiderWeapon, shieldById } from './data';
import type { Enemy, Game } from './game';
import { ELDER, SMITH, type Horse } from './long';
import type { Cam, HeroGear, Renderer } from './render';
import { drawHero } from './render';
import { CAMP_SPEARS, CAMP_TENTS, GROVE, ORE_ROCKS, S, VILLAGES, tH, type Site } from './world';

export const SITE_COL: Record<number, string> = {
  [S.Camp]: '#ff5a4a', [S.Shrine]: '#5ad0ff', [S.Tower]: '#e0e0e0', [S.Spring]: '#9fe8ff', [S.Ore]: '#c9b0ff',
};

type Add = (x: number, y: number, d: () => void) => void;

/** What the hero is holding and wearing. */
export function heroGear(game: Game): HeroGear {
  const lx = game.lx;
  const sh = lx.shield ? shieldById(lx.shield.id) : null;
  return {
    weapon: lx.weapon,
    shield: sh ? { color: sh.color, rim: sh.rim } : null,
    blocking: lx.blocking,
    armor: { head: armorById(lx.armor.head)?.color, body: armorById(lx.armor.body)?.color, legs: armorById(lx.armor.legs)?.color },
  };
}

export function drawGlider(x: CanvasRenderingContext2D, t: number) {
  x.save();
  x.translate(0, -50 + Math.sin(t * 3) * 1.5);
  x.fillStyle = '#c9473a';
  x.beginPath();
  x.moveTo(-30, 4);
  x.quadraticCurveTo(0, -14, 30, 4);
  x.quadraticCurveTo(0, -4, -30, 4);
  x.fill();
  x.fillStyle = '#e8c070';
  x.fillRect(-30, 2, 60, 2);
  x.strokeStyle = '#5a3a1e';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(-8, 0);
  x.lineTo(-4, 26);
  x.moveTo(8, 0);
  x.lineTo(4, 26);
  x.stroke();
  x.restore();
}

export function drawHorse(x: CanvasRenderingContext2D, h: Horse, ridden: boolean) {
  const sdx = Math.cos(h.face) - Math.sin(h.face);
  const side = Math.sign(sdx) || 1;
  const leg = Math.sin(h.walkT * 14) * 3;
  x.save();
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath();
  x.ellipse(0, 0, 20, 7, 0, 0, 7);
  x.fill();
  x.scale(side, 1);
  const dark = shade(h.color, 0.7);
  x.fillStyle = dark;
  x.fillRect(-13, -14 + leg * 0.3, 4, 14);
  x.fillRect(9, -14 - leg * 0.3, 4, 14);
  x.fillStyle = h.color;
  x.fillRect(-9, -14 - leg * 0.3, 4, 14);
  x.fillRect(5, -14 + leg * 0.3, 4, 14);
  x.beginPath();
  x.ellipse(0, -18, 17, 9, 0, 0, 7);
  x.fill();
  // neck and head
  x.beginPath();
  x.moveTo(10, -22);
  x.lineTo(18, -36);
  x.lineTo(25, -34);
  x.lineTo(16, -18);
  x.closePath();
  x.fill();
  x.beginPath();
  x.ellipse(24, -34, 7, 4, 0.4, 0, 7);
  x.fill();
  x.fillStyle = dark;
  x.beginPath();
  x.moveTo(10, -24);
  x.lineTo(17, -38);
  x.lineTo(14, -38);
  x.lineTo(7, -24);
  x.fill();
  x.fillRect(-19, -21, 4, 12); // tail
  x.fillStyle = '#111';
  x.fillRect(23, -36, 2, 2);
  if (ridden) {
    x.fillStyle = '#7a3a2a';
    x.fillRect(-7, -27, 14, 5);
  }
  x.restore();
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function hpBar(ctx: CanvasRenderingContext2D, X: number, Y: number, hp: number, max: number, col: string) {
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(X - 15, Y, 30, 4);
  ctx.fillStyle = col;
  ctx.fillRect(X - 15, Y, (30 * Math.max(0, hp)) / max, 4);
}

export function drawRaider(R: Renderer, game: Game, e: Enemy, cam: Cam) {
  const ctx = R.ctx;
  const k = ENEMY_KINDS[e.kind];
  const X = R.sx(cam, e.x, e.y), Y = R.sy(cam, e.x, e.y, e.z);
  const tg = game.p;
  const face = Math.atan2(tg.y - e.y, tg.x - e.x);
  const sdx = Math.cos(face) - Math.sin(face);
  const side = Math.sign(sdx) || 1;
  const s = k.size;
  const walk = e.aggro && !e.sleep ? e.hop : 0;
  ctx.save();
  ctx.translate(X, Y);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12 * s, 5 * s, 0, 0, 7);
  ctx.fill();
  ctx.scale(s, s);
  const hurt = e.hurtT > 0;
  if (e.sleep) {
    // sitting by the fire, asleep
    ctx.fillStyle = hurt ? '#fff' : k.body;
    ctx.beginPath();
    ctx.ellipse(0, -9, 11, 9, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#e0b48a';
    ctx.beginPath();
    ctx.arc(0, -21, 6.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#b8342a';
    ctx.fillRect(-7, -26, 14, 4);
    ctx.strokeStyle = '#1b1b22';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -21);
    ctx.lineTo(-1, -21);
    ctx.moveTo(1, -21);
    ctx.lineTo(4, -21);
    ctx.stroke();
    ctx.font = 'bold 11px ui-rounded, system-ui, sans-serif';
    ctx.fillStyle = '#dff';
    const zt = (game.time * 0.8 + e.id) % 1;
    ctx.fillText('z', 8 + zt * 6, -30 - zt * 10);
    ctx.fillText('Z', 12 + ((zt + 0.5) % 1) * 6, -34 - ((zt + 0.5) % 1) * 10);
    ctx.restore();
    return;
  }
  const leg = Math.sin(walk * 1.5) * 3;
  // legs
  ctx.fillStyle = k.dark;
  ctx.fillRect(-5, -13 + Math.max(0, leg) * 0.3, 4, 10);
  ctx.fillRect(1, -13 + Math.max(0, -leg) * 0.3, 4, 10);
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(-5.5, -4, 5, 3);
  ctx.fillRect(0.5, -4, 5, 3);
  // cape for the captain
  if (e.kind === 7) {
    ctx.fillStyle = '#5a1e4a';
    ctx.beginPath();
    ctx.moveTo(-9, -27);
    ctx.lineTo(9, -27);
    ctx.lineTo(12, -6);
    ctx.lineTo(-12, -6);
    ctx.closePath();
    ctx.fill();
  }
  // body
  ctx.fillStyle = hurt ? '#fff' : (e.frozen ?? 0) > 0 ? '#9fdcf5' : k.body;
  ctx.beginPath();
  ctx.roundRect(-8, -27, 16, 15, 4);
  ctx.fill();
  if (e.kind === 6 || e.kind === 7) {
    // armor plate
    ctx.fillStyle = e.kind === 7 ? '#9aa3ad' : '#7a7f88';
    ctx.beginPath();
    ctx.roundRect(-7, -26, 14, 11, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(-5, -25, 3, 8);
  }
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(-8, -15, 16, 2.5);
  // head with a bandana mask
  ctx.fillStyle = '#e0b48a';
  ctx.beginPath();
  ctx.arc(0, -33, 7, 0, 7);
  ctx.fill();
  ctx.fillStyle = e.kind === 7 ? '#3a1e4a' : '#b8342a';
  ctx.fillRect(-7.5, -32, 15, 5); // mask over nose and mouth
  ctx.beginPath();
  ctx.arc(0, -36, 7.5, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-side * 6, -38);
  ctx.lineTo(-side * 14, -34 + Math.sin(game.time * 6 + e.id) * 2);
  ctx.lineTo(-side * 6, -34);
  ctx.fill();
  if (e.kind === 7) {
    // horned helmet
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.arc(0, -37, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f0e6d0';
    ctx.beginPath();
    ctx.moveTo(-7, -39);
    ctx.lineTo(-13, -48);
    ctx.lineTo(-5, -42);
    ctx.moveTo(7, -39);
    ctx.lineTo(13, -48);
    ctx.lineTo(5, -42);
    ctx.fill();
  }
  ctx.fillStyle = e.aggro ? '#c4001a' : '#1b1b22';
  ctx.fillRect(-3.5 + sdx * 1.5, -35, 2, 2);
  ctx.fillRect(1.5 + sdx * 1.5, -35, 2, 2);
  // arms
  ctx.fillStyle = k.body;
  ctx.fillRect(-11, -26, 4, 10);
  ctx.fillRect(7, -26, 4, 10);
  // weapon
  const w = raiderWeapon(e.kind);
  const sw = e.swingT ?? 0;
  ctx.save();
  ctx.translate(side * 10, -20);
  if (w === 'bow') {
    ctx.strokeStyle = '#6b4424';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 10, side > 0 ? -1.3 : Math.PI - 1.3, side > 0 ? 1.3 : Math.PI + 1.3);
    ctx.stroke();
  } else if (w === 'spear') {
    ctx.rotate(side * (sw > 0 ? 1.3 : 0.15));
    ctx.fillStyle = '#6b4424';
    ctx.fillRect(-1.5, -26, 3, 36);
    ctx.fillStyle = '#b0b7c0';
    ctx.beginPath();
    ctx.moveTo(-3.5, -26);
    ctx.lineTo(0, -33);
    ctx.lineTo(3.5, -26);
    ctx.fill();
  } else {
    ctx.rotate(side * (sw > 0 ? 1.6 - sw * 4 : 0.5));
    const big = e.kind === 7;
    ctx.fillStyle = big ? '#7a7f88' : '#a3a8ae';
    ctx.fillRect(big ? -3 : -1.5, big ? -24 : -17, big ? 6 : 3, big ? 22 : 15);
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(-4, -2, 8, 2);
    ctx.fillRect(-1.5, 0, 3, 5);
  }
  ctx.restore();
  // shield on the other arm
  const sh = e.shield ?? raiderShield(e.kind);
  if (sh > 0) {
    ctx.fillStyle = e.kind === 7 ? '#5a3a6a' : '#7a5a3a';
    ctx.strokeStyle = '#2a1a12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-side * 9, -20, 7, 10, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9b44a';
    ctx.beginPath();
    ctx.arc(-side * 9, -20, 2, 0, 7);
    ctx.fill();
  }
  ctx.restore();
  if (e.burn) {
    ctx.fillStyle = Math.random() < 0.5 ? '#ff7a2a' : '#ffd34d';
    ctx.beginPath();
    ctx.ellipse(X, Y - 20 * s, 6, 10 + Math.random() * 4, 0, 0, 7);
    ctx.fill();
  }
  if (e.hp < k.hp) hpBar(ctx, X, Y - 54 * s, e.hp, k.hp, '#ff6a4a');
  if (e.kind === 7) {
    ctx.font = 'bold 10px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd2f0';
    ctx.fillText('Captain', X, Y - 58 * s);
  }
}

export function drawWolf(R: Renderer, game: Game, e: Enemy, cam: Cam) {
  const ctx = R.ctx;
  const k = ENEMY_KINDS[e.kind];
  const X = R.sx(cam, e.x, e.y), Y = R.sy(cam, e.x, e.y, e.z);
  const p = game.p;
  const sdx = (p.x - e.x) - (p.y - e.y);
  const side = Math.sign(sdx) || 1;
  const leg = e.aggro ? Math.sin(e.hop * 1.6) * 3 : 0;
  ctx.save();
  ctx.translate(X, Y);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 5, 0, 0, 7);
  ctx.fill();
  ctx.scale(side * k.size, k.size);
  const body = e.hurtT > 0 ? '#fff' : (e.frozen ?? 0) > 0 ? '#9fdcf5' : k.body;
  ctx.fillStyle = k.dark;
  ctx.fillRect(-10, -10 + leg * 0.3, 3, 10);
  ctx.fillRect(7, -10 - leg * 0.3, 3, 10);
  ctx.fillStyle = body;
  ctx.fillRect(-7, -10 - leg * 0.3, 3, 10);
  ctx.fillRect(4, -10 + leg * 0.3, 3, 10);
  ctx.beginPath();
  ctx.ellipse(0, -13, 13, 6.5, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -15);
  ctx.lineTo(-20, -20);
  ctx.lineTo(-13, -11);
  ctx.fill(); // tail
  ctx.beginPath();
  ctx.ellipse(13, -18, 6.5, 5, -0.2, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -18);
  ctx.lineTo(23, -16);
  ctx.lineTo(16, -14);
  ctx.fill(); // snout
  ctx.fillStyle = k.dark;
  ctx.beginPath();
  ctx.moveTo(10, -22);
  ctx.lineTo(11, -28);
  ctx.lineTo(14, -22);
  ctx.fill(); // ear
  ctx.fillStyle = e.aggro ? '#ffcc00' : '#222';
  ctx.fillRect(14, -20, 2, 2);
  ctx.restore();
  if (e.hp < k.hp) hpBar(ctx, X, Y - 32, e.hp, k.hp, '#c9ced6');
}

function label(ctx: CanvasRenderingContext2D, text: string, X: number, Y: number, col = '#fff') {
  ctx.font = 'bold 10px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillText(text, X + 1, Y + 1);
  ctx.fillStyle = col;
  ctx.fillText(text, X, Y);
}

function fire(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number, big = 1) {
  ctx.save();
  ctx.translate(X, Y);
  ctx.scale(big, big);
  ctx.fillStyle = '#6a6460';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 12, Math.sin(a) * 5, 3.5, 2.5, 0, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#5b3a1e';
  ctx.save();
  ctx.rotate(0.4);
  ctx.fillRect(-10, -2, 20, 4);
  ctx.rotate(-0.8);
  ctx.fillRect(-10, -2, 20, 4);
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const fl = 1 + 0.25 * Math.sin(t * 13 + i * 2);
    ctx.fillStyle = ['#ff6a1f', '#ffa530', '#ffe27a'][i];
    ctx.beginPath();
    ctx.ellipse(0, -6 - i * 2, (7 - i * 2) * fl, (11 - i * 3) * fl, 0, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function npc(ctx: CanvasRenderingContext2D, X: number, Y: number, t: number, shirt: string, hood: string, name: string, extra?: () => void) {
  ctx.save();
  ctx.translate(X, Y);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 4.5, 0, 0, 7);
  ctx.fill();
  extra?.();
  drawHero(ctx, { id: '', name: '', shirt, pants: '#3a2e24', hood, price: 0 }, Math.PI * 0.25 + Math.sin(t * 0.7) * 0.4, 0, { scale: 0.95 });
  label(ctx, name, 0, -52, '#fff3c4');
  ctx.restore();
}

/** Everything new that stands in the world. */
export function collectLong(R: Renderer, game: Game, cam: Cam, add: Add) {
  const ctx = R.ctx;
  const t = game.time;
  const lx = game.lx;
  const world = game.world;
  const close = (x: number, y: number, r = 50) => Math.abs(x - cam.x) < r && Math.abs(y - cam.y) < r;
  for (const s of lx.near) {
    if (!close(s.x, s.y)) continue;
    const h = tH(world.tile(s.x, s.y));
    drawSite(R, game, s, h, cam, add);
  }
  // the Sword of Light in its grove
  if (close(GROVE.x, GROVE.y, 60)) {
    const h = world.heightAt(GROVE.x, GROVE.y);
    add(GROVE.x + 0.5, GROVE.y + 0.5, () => {
      const X = R.sx(cam, GROVE.x + 0.5, GROVE.y + 0.5), Y = R.sy(cam, GROVE.x + 0.5, GROVE.y + 0.5, h);
      ctx.save();
      ctx.translate(X, Y);
      // a big stone the sword is stuck in
      ctx.fillStyle = '#5f5b68';
      ctx.beginPath();
      ctx.roundRect(-18, -22, 36, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#8c8996';
      ctx.beginPath();
      ctx.ellipse(0, -22, 18, 7, 0, 0, 7);
      ctx.fill();
      if (!lx.light) {
        const gl = ctx.createLinearGradient(0, -160, 0, -10);
        gl.addColorStop(0, 'rgba(255,246,176,0)');
        gl.addColorStop(1, `rgba(255,246,176,${0.35 + Math.sin(t * 2) * 0.1})`);
        ctx.fillStyle = gl;
        ctx.fillRect(-12, -160, 24, 150);
        // half the blade is down inside the stone: only the top half sticks out
        ctx.fillStyle = '#2a2730';
        ctx.beginPath();
        ctx.ellipse(0, -22, 4, 1.6, 0, 0, 7);
        ctx.fill();
        ctx.shadowColor = '#fff2a0';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#fff7c8';
        ctx.fillRect(-2, -38, 4, 16);
        ctx.fillStyle = '#e0b53c';
        ctx.fillRect(-7, -40, 14, 3);
        ctx.fillStyle = '#3b6fcb';
        ctx.fillRect(-1.5, -50, 3, 10);
        ctx.fillStyle = '#e0b53c';
        ctx.fillRect(-2.5, -52, 5, 2.5);
        ctx.shadowBlur = 0;
        label(ctx, 'The Sword of Light', 0, -60, '#fff2a0');
        const p = game.p;
        if (Math.hypot(p.x - GROVE.x, p.y - GROVE.y) < 6) label(ctx, `Needs 12 full hearts (you have ${Math.floor(p.hp / 4)})`, 0, -72, p.hp >= LIGHT_HEARTS ? '#9fe37a' : '#ffb0b0');
      }
      ctx.restore();
    });
  }
  // blacksmith and elder in each village
  for (const v of VILLAGES) {
    if (!close(v.x, v.y, 70)) continue;
    const sx = v.x + SMITH.x, sy = v.y + SMITH.y, ex = v.x + ELDER.x, ey = v.y + ELDER.y;
    const sh = world.heightAt(sx, sy), eh = world.heightAt(ex, ey);
    add(sx + 0.5, sy + 0.5, () => {
      const X = R.sx(cam, sx + 0.5, sy + 0.5), Y = R.sy(cam, sx + 0.5, sy + 0.5, sh);
      // anvil and forge
      ctx.fillStyle = '#4a4458';
      ctx.fillRect(X + 12, Y - 10, 18, 10);
      ctx.fillStyle = '#5a5f68';
      ctx.fillRect(X + 9, Y - 16, 24, 6);
      ctx.fillStyle = `rgba(255,${120 + Math.sin(t * 8) * 40},40,.9)`;
      ctx.beginPath();
      ctx.arc(X - 20, Y - 8, 6, 0, 7);
      ctx.fill();
      npc(ctx, X, Y, t, '#6a6a72', '#2a2a30', 'Blacksmith');
    });
    add(ex + 0.5, ey + 0.5, () => {
      const X = R.sx(cam, ex + 0.5, ey + 0.5), Y = R.sy(cam, ex + 0.5, ey + 0.5, eh);
      npc(ctx, X, Y, t, '#5a7a4a', '#e8e8e8', lx.quest && lx.quest.village === VILLAGES.indexOf(v) ? 'Elder (quest)' : 'Elder !', () => {
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(10, -40, 2.5, 40);
      });
    });
  }
  // horses
  for (const hr of lx.horses) {
    if (hr === lx.riding || !close(hr.x, hr.y)) continue;
    add(hr.x, hr.y, () => {
      ctx.save();
      ctx.translate(R.sx(cam, hr.x, hr.y), R.sy(cam, hr.x, hr.y, hr.z));
      drawHorse(ctx, hr, false);
      ctx.restore();
    });
  }
  // mushrooms and falling stars
  for (const q of lx.pickups) {
    if (!close(q.x, q.y)) continue;
    const gh = world.heightAt(q.x, q.y);
    add(q.x, q.y, () => {
      const X = R.sx(cam, q.x, q.y), Y = R.sy(cam, q.x, q.y, gh + q.fall);
      if (q.kind === 'star') {
        ctx.save();
        ctx.shadowColor = '#fff6b0';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#fff6b0';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t * 2, r = i % 2 ? 4 : 9;
          ctx.lineTo(X + Math.cos(a) * r, Y - 8 + Math.sin(a) * r);
        }
        ctx.fill();
        ctx.restore();
        if (q.fall > 0) {
          ctx.strokeStyle = 'rgba(255,246,176,.5)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(X, Y - 8);
          ctx.lineTo(X - 30, Y - 60);
          ctx.stroke();
        }
        return;
      }
      ctx.fillStyle = '#efe6d6';
      ctx.fillRect(X - 1.5, Y - 7, 3, 7);
      ctx.fillStyle = q.kind === 'red' ? '#d8342a' : '#3a7ae0';
      ctx.beginPath();
      ctx.arc(X, Y - 7, 6, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(X - 3, Y - 10, 2, 2);
      ctx.fillRect(X + 2, Y - 9, 1.5, 1.5);
    });
  }
  // bombs in the air
  for (const b of lx.bombsFlying) {
    add(b.x, b.y, () => {
      const X = R.sx(cam, b.x, b.y), Y = R.sy(cam, b.x, b.y, b.z);
      ctx.fillStyle = '#22262e';
      ctx.beginPath();
      ctx.arc(X, Y - 6, 6, 0, 7);
      ctx.fill();
      ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ff4a2a' : '#ffd34d';
      ctx.fillRect(X - 1, Y - 15, 2, 4);
    });
  }
}

function drawSite(R: Renderer, game: Game, s: Site, h: number, cam: Cam, add: Add) {
  const ctx = R.ctx;
  const t = game.time;
  const lx = game.lx;
  const at = (dx: number, dy: number, z = h) => ({ X: R.sx(cam, s.x + dx + 0.5, s.y + dy + 0.5), Y: R.sy(cam, s.x + dx + 0.5, s.y + dy + 0.5, z) });
  if (s.kind === S.Camp) {
    const st = lx.camps.get(s.key);
    add(s.x + 0.5, s.y + 0.5, () => {
      const { X, Y } = at(0, 0);
      fire(ctx, X, Y, t, 1.2);
    });
    CAMP_SPEARS.forEach(([ox, oy], i) => {
      if (st && st.spears & (1 << i)) return;
      add(s.x + ox + 0.5, s.y + oy + 0.5, () => {
        const { X, Y } = at(ox, oy);
        ctx.fillStyle = '#6b4424';
        ctx.fillRect(X - 1.5, Y - 40, 3, 40);
        ctx.fillStyle = '#b0b7c0';
        ctx.beginPath();
        ctx.moveTo(X - 4, Y - 40);
        ctx.lineTo(X, Y - 50);
        ctx.lineTo(X + 4, Y - 40);
        ctx.fill();
        // an apple stuck on the spear
        ctx.fillStyle = '#e0302a';
        ctx.beginPath();
        ctx.arc(X, Y - 36, 5, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#4a9a3a';
        ctx.fillRect(X, Y - 43, 3, 2.5);
      });
    });
    for (const [ox, oy] of CAMP_TENTS) {
      add(s.x + ox + 0.5, s.y + oy + 0.5, () => {
        const { X, Y } = at(ox, oy);
        ctx.fillStyle = '#8a6a48';
        ctx.beginPath();
        ctx.moveTo(X - 22, Y + 4);
        ctx.lineTo(X, Y - 28);
        ctx.lineTo(X + 22, Y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6a4a30';
        ctx.beginPath();
        ctx.moveTo(X, Y - 28);
        ctx.lineTo(X + 22, Y + 4);
        ctx.lineTo(X + 4, Y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2a1a12';
        ctx.beginPath();
        ctx.moveTo(X - 6, Y + 4);
        ctx.lineTo(X - 1, Y - 10);
        ctx.lineTo(X + 4, Y + 4);
        ctx.fill();
      });
    }
    // a skull flag on a pole so you can spot camps
    add(s.x - 6.5, s.y - 6.5, () => {
      const { X, Y } = at(-6, -6);
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(X - 1.5, Y - 60, 3, 60);
      ctx.fillStyle = st?.cleared ? '#5a8a4a' : '#7a1e1e';
      ctx.fillRect(X + 1.5, Y - 60 + Math.sin(t * 4) * 1, 20, 13);
      ctx.fillStyle = '#f0e6d0';
      ctx.beginPath();
      ctx.arc(X + 11, Y - 54, 3.5, 0, 7);
      ctx.fill();
    });
    if (st?.cleared && !st.chest) {
      add(s.x + 0.5, s.y + 1.5, () => {
        const { X, Y } = at(0, 1);
        ctx.fillStyle = '#7a4a1e';
        ctx.fillRect(X - 13, Y - 18, 26, 16);
        ctx.fillStyle = '#e0b53c';
        ctx.fillRect(X - 13, Y - 13, 26, 3);
        ctx.fillRect(X - 2, Y - 15, 4, 6);
        label(ctx, 'Loot!', X, Y - 24, '#ffe27a');
      });
    }
  } else if (s.kind === S.Shrine) {
    const on = lx.found.has(s.key);
    add(s.x + 0.5, s.y + 0.5, () => {
      const { X, Y } = at(0, 0);
      const col = on ? '255,170,60' : '90,200,255';
      const gl = ctx.createRadialGradient(X, Y - 20, 4, X, Y - 20, 50);
      gl.addColorStop(0, `rgba(${col},${0.4 + Math.sin(t * 3) * 0.12})`);
      gl.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gl;
      ctx.fillRect(X - 50, Y - 70, 100, 100);
      ctx.fillStyle = '#4a4e5a';
      ctx.beginPath();
      ctx.ellipse(X, Y, 22, 9, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#5d6270';
      ctx.beginPath();
      ctx.arc(X, Y - 4, 18, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = `rgb(${col})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(X, Y - 4, 12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X, Y - 14, 3, 0, 7);
      ctx.fillStyle = `rgb(${col})`;
      ctx.fill();
      label(ctx, on ? 'Shrine' : 'Shrine (new!)', X, Y - 30, on ? '#ffd9a0' : '#bff1ff');
    });
  } else if (s.kind === S.Tower) {
    const top = tH(game.world.tile(s.x, s.y));
    add(s.x + 0.5, s.y + 0.5, () => {
      const { X, Y } = at(0, 0, top);
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(X - 18, Y + 2, 3, -26);
      ctx.fillRect(X + 15, Y + 2, 3, -26);
      ctx.fillStyle = '#8a3a2a';
      ctx.beginPath();
      ctx.moveTo(X - 24, Y - 22);
      ctx.lineTo(X, Y - 40);
      ctx.lineTo(X + 24, Y - 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = game.lx.towers.has(s.key) ? '#5ad0ff' : '#f0d070';
      ctx.fillRect(X - 1, Y - 58, 2, 18);
      ctx.fillRect(X + 1, Y - 58 + Math.sin(t * 4), 14, 8);
      label(ctx, 'Watchtower', X, Y - 64);
    });
  } else if (s.kind === S.Spring) {
    add(s.x + 0.5, s.y + 0.5, () => {
      const { X, Y } = at(0, 0);
      const ready = !lx.springCd.has(s.key);
      ctx.fillStyle = '#6e6a78';
      ctx.beginPath();
      ctx.ellipse(X, Y, 40, 17, 0, 0, 7);
      ctx.fill();
      const gr = ctx.createRadialGradient(X, Y, 2, X, Y, 34);
      gr.addColorStop(0, ready ? '#e0fbff' : '#8ab0c0');
      gr.addColorStop(1, ready ? '#3fb0d8' : '#3a6a80');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(X, Y, 33, 13, 0, 0, 7);
      ctx.fill();
      if (ready) {
        for (let i = 0; i < 4; i++) {
          const a = t * 1.3 + i * 1.6;
          ctx.fillStyle = 'rgba(255,255,255,.8)';
          ctx.fillRect(X + Math.cos(a) * 20, Y - 6 - ((t * 20 + i * 9) % 28), 2, 2);
        }
      }
      label(ctx, 'Healing spring', X, Y - 24, '#c4f4ff');
    });
  } else if (s.kind === S.Ore) {
    ORE_ROCKS.forEach(([ox, oy], i) => {
      if (lx.mined.has(`${s.key}:${i}`)) return;
      add(s.x + ox + 0.5, s.y + oy + 0.5, () => {
        const { X, Y } = at(ox, oy);
        ctx.fillStyle = '#6a6470';
        ctx.beginPath();
        ctx.moveTo(X - 14, Y);
        ctx.lineTo(X - 10, Y - 18);
        ctx.lineTo(X + 4, Y - 22);
        ctx.lineTo(X + 14, Y - 8);
        ctx.lineTo(X + 12, Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = (Math.floor(t * 3 + i) % 3) ? '#7fe0ff' : '#ffffff';
        ctx.fillRect(X - 5, Y - 14, 4, 4);
        ctx.fillStyle = '#c9b0ff';
        ctx.fillRect(X + 4, Y - 10, 3, 3);
      });
    });
  }
}

let sky: HTMLCanvasElement | null = null;
let skyCtx: CanvasRenderingContext2D | null = null;

/** Night falls and rain comes down. */
export function drawSky(R: Renderer, game: Game, cam: Cam) {
  const ctx = R.ctx;
  const W = R.W, H = R.H;
  const lx = game.lx;
  const n = lx.night(game);
  if (n > 0.01) {
    if (!sky) {
      sky = document.createElement('canvas');
      skyCtx = sky.getContext('2d')!;
    }
    const sw = Math.ceil(W / 3), sh = Math.ceil(H / 3);
    if (sky.width !== sw || sky.height !== sh) {
      sky.width = sw;
      sky.height = sh;
    }
    const dc = skyCtx!;
    const sc = sw / W;
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, sw, sh);
    dc.fillStyle = `rgba(10,18,52,${0.45 * n})`;
    dc.fillRect(0, 0, sw, sh);
    dc.globalCompositeOperation = 'destination-out';
    const hole = (X: number, Y: number, r: number, a: number) => {
      const gr = dc.createRadialGradient(X * sc, Y * sc, 0, X * sc, Y * sc, r * sc);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gr;
      dc.fillRect((X - r) * sc, (Y - r) * sc, r * 2 * sc, r * 2 * sc);
    };
    const p = game.p;
    hole(R.sx(cam, p.x, p.y), R.sy(cam, p.x, p.y, p.z) - 20, lx.weapon === 'light' ? 260 : 170, lx.weapon === 'light' ? 0.95 : 0.75);
    for (const f of game.fires) hole(R.sx(cam, f.x + 0.5, f.y + 0.5), R.sy(cam, f.x + 0.5, f.y + 0.5, game.world.heightAt(f.x, f.y)), 160, 0.9);
    for (const s of lx.near) {
      if (s.kind === S.Camp || s.kind === S.Shrine || s.kind === S.Spring) {
        const z = game.world.heightAt(s.x, s.y);
        hole(R.sx(cam, s.x + 0.5, s.y + 0.5), R.sy(cam, s.x + 0.5, s.y + 0.5, z), s.kind === S.Camp ? 170 : 90, 0.85);
      }
    }
    for (const v of VILLAGES) if (Math.abs(v.x - cam.x) < 80 && Math.abs(v.y - cam.y) < 80) hole(R.sx(cam, v.x, v.y), R.sy(cam, v.x, v.y, game.world.heightAt(v.x, v.y)), 420, 0.7);
    ctx.drawImage(sky, 0, 0, W, H);
    // stars twinkle in the dark corners
    ctx.fillStyle = `rgba(255,255,255,${0.6 * n})`;
    for (let i = 0; i < 24; i++) {
      const x = (i * 197.3) % W, y = (i * 83.7) % (H * 0.35);
      if (Math.sin(game.time * 2 + i) > 0.2) ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
  if (lx.rain > 0.02) {
    ctx.fillStyle = `rgba(40,50,70,${0.18 * lx.rain})`;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(200,220,255,${0.45 * lx.rain})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const drops = Math.floor(160 * lx.rain);
    const tt = game.time;
    for (let i = 0; i < drops; i++) {
      const x = ((i * 137.1 + tt * 60) % (W + 40)) - 20;
      const y = ((i * 71.3 + tt * 700) % (H + 40)) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
    }
    ctx.stroke();
  }
}

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/** Extra HUD: the Sword of Light compass, buffs, orbs, day/night, the shield bar. */
export function hudLong(R: Renderer, game: Game, cam: Cam) {
  const ctx = R.ctx;
  const W = R.W, H = R.H;
  const lx = game.lx;
  const p = game.p;
  if (!lx.light) {
    const dx = GROVE.x + 0.5 - p.x, dy = GROVE.y + 0.5 - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      const a = Math.atan2((dx + dy) / 2, dx - dy);
      ctx.save();
      ctx.translate(W / 2 - 150, 52);
      ctx.rotate(a);
      ctx.fillStyle = '#fff2a0';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 12px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      R.shadowText(`✨ Sword of Light ${Math.round(dist)}`, W / 2 - 150, 76, '#fff2a0');
    }
  }
  // status line under the top-right map
  const bits: string[] = [];
  const n = lx.night(game);
  bits.push(n > 0.5 ? '🌙 Night' : '☀ Day');
  if (lx.rain > 0.3) bits.push('🌧 Rain');
  if (lx.orbs) bits.push(`🔮 ${lx.orbs}/4`);
  if (lx.soup > 0) bits.push(`🥣 ${fmt(lx.soup)}`);
  if (lx.chili > 0) bits.push(`🌶 ${fmt(lx.chili)}`);
  if (lx.feast > 0) bits.push(`🍲 ${fmt(lx.feast)}`);
  if (lx.red || lx.blue) bits.push(`🍄 ${lx.red}/${lx.blue}`);
  if (lx.meat) bits.push(`🍖 ${lx.meat}`);
  if (lx.stars) bits.push(`⭐ ${lx.stars}`);
  if (lx.gems) bits.push(`💎 ${lx.gems}`);
  if (lx.armorDef()) bits.push(`🛡 armor ${Math.round(lx.armorDef() * 100)}%`);
  ctx.font = 'bold 12px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'left';
  const slots = Math.ceil(game.maxHp / 4);
  const y0 = 18 + Math.floor((slots - 1) / 10) * 28 + (game.job === 'grocer' ? 92 : game.coopLabel || game.others.length ? 76 : 58);
  R.shadowText(bits.join('  ·  '), 14, y0, '#e8f0ff');
  if (lx.cold) {
    ctx.textAlign = 'center';
    ctx.font = '900 15px ui-rounded, system-ui, sans-serif';
    R.shadowText('❄ Freezing! Find fur, chili, or get out of the snow', W / 2, H - 90, '#bfe3ff');
  }
  if (lx.quest) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px ui-rounded, system-ui, sans-serif';
    R.shadowText(`📜 Quest for ${VILLAGES[lx.quest.village]?.name ?? 'a village'}`, 14, H - 60, '#ffe9a0');
  }
  // shield bar while blocking
  if (lx.blocking && lx.shield) {
    const max = shieldById(lx.shield.id)?.hp ?? 30;
    const X = R.sx(cam, p.x, p.y), Y = R.sy(cam, p.x, p.y, p.z) + 10;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(X - 20, Y, 40, 5);
    ctx.fillStyle = lx.shield.hp / max < 0.3 ? '#ff6a4a' : '#bfe3ff';
    ctx.fillRect(X - 20, Y, (40 * lx.shield.hp) / max, 5);
  }
}
