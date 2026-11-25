import { describe, expect, it } from 'vitest';
import { Game, IDLE } from '../src/game';
import { BLINK_CYCLE, COURSE, T, buildCity, buildJail, idx, tileAt } from '../src/map';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Where on rect r is closest to point p, pulled `inset` tiles inside the edge. */
function closest(r: (typeof COURSE)[number], p: { x: number; y: number }, inset: number) {
  const [x, y, w, d] = r;
  return { x: clamp(p.x, x + inset, x + w - inset), y: clamp(p.y, y + inset, y + d - inset) };
}

function enterJail(g: Game) {
  const m = g.city.map;
  const door = [...m.places].find(([, p]) => p === 'jail')![0];
  g.enterJail(door % m.w, Math.floor(door / m.w));
}

describe('jail parkour', () => {
  it('has a jail door in the city', () => {
    const m = buildCity();
    expect([...m.places.values()]).toContain('jail');
  });

  it('has 34 numbered platforms over a pit', () => {
    const m = buildJail();
    expect(COURSE.length).toBe(34);
    const nums = new Set(m.course);
    for (let n = 1; n <= 34; n++) expect(nums.has(n)).toBe(true);
    expect(m.courseLabels!.size).toBe(34);
    // the trophy is only next to the last platform
    const ti = m.tiles.indexOf(T.Trophy);
    expect(ti).toBeGreaterThan(0);
    const [x, y, w, d] = COURSE[33];
    const tx = ti % m.w;
    const ty = Math.floor(ti / m.w);
    expect(tx === x + w && ty >= y && ty < y + d).toBe(true);
  });

  it('sends you back to the start when you fall', () => {
    const g = new Game(null);
    enterJail(g);
    const [x, y, , , h] = COURSE[1];
    g.player.x = x + 0.5;
    g.player.y = y + 0.5;
    g.player.z = h;
    g.cur.course = 2;
    // walk off the edge into the pit
    for (let i = 0; i < 60; i++) g.update(1 / 60, { ...IDLE, mx: 0, my: -1, mag: 1 });
    expect(g.cur.course).toBe(0);
    const s = g.jail.map.spawns.start[0];
    expect(Math.hypot(g.player.x - s.x, g.player.y - s.y)).toBeLessThan(1.5);
  });

  it('every jump on the course can be made', () => {
    for (let k = 0; k < COURSE.length; k++) {
      const g = new Game(null);
      enterJail(g);
      const m = g.jail.map;
      const from: (typeof COURSE)[number] = k === 0 ? [1, 24, 8, 5, 0, 'b'] : COURSE[k - 1];
      const to = COURSE[k];
      // keep blinking platforms switched on for the jump
      const blink = m.blinks!.find((b) => b.tiles.includes(idx(m, to[0], to[1]))) ?? m.blinks!.find((b) => b.tiles.includes(idx(m, from[0], from[1])));
      if (blink) g.jailClock = (BLINK_CYCLE - blink.phase + 10 * BLINK_CYCLE) % BLINK_CYCLE;
      const toC = { x: to[0] + to[2] / 2, y: to[1] + to[3] / 2 };
      const start = closest(from, toC, 0.3);
      g.player.x = start.x;
      g.player.y = start.y;
      g.player.z = from[4];
      g.cur.course = k;
      let ok = false;
      for (let i = 0; i < 240 && !ok; i++) {
        const aim = closest(to, g.player, 0.45);
        const dx = aim.x - g.player.x;
        const dy = aim.y - g.player.y;
        const len = Math.hypot(dx, dy) || 1;
        g.update(1 / 60, { ...IDLE, mx: dx / len, my: dy / len, mag: len > 0.05 ? 1 : 0, jump: i === 0 && from[5] !== 's' });
        if (g.cur.course === k + 1) ok = true;
        if (g.cur.course === 0 && k > 0) break;
      }
      expect(ok, `jump to platform ${k + 1}`).toBe(true);
      expect(tileAt(m, g.player.x, g.player.y)).not.toBe(T.Wall);
    }
  });
});
