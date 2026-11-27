import { describe, expect, it } from 'vitest';
import { Shroud } from './shroud';

// A map with land above y = 512 (on screen) and open sea below it.
function coast(): Shroud {
  return new Shroud(2048, 1024, (_sx, sy) => sy > 512);
}

describe('Shroud.clearThin', () => {
  it('lifts the strip of shroud left over the water between a base by the shore and the open sea', () => {
    const sh = coast();
    // a base whose sight reaches just past the shore
    for (let x = 700; x <= 1300; x += 50) sh.reveal(x, 400, 200);
    // the water just off the shore below it, past its sight: still shrouded
    const y = 528;
    expect(sh.dark(1024, y)).toBeGreaterThan(0.5);
    sh.clearThin();
    expect(sh.dark(1024, y)).toBe(0);
    expect(sh.seen(1024, y)).toBe(true);
    // the land well away from the base stays shrouded
    expect(sh.dark(200, 200)).toBe(1);
    expect(sh.dark(1024, 150)).toBe(1);
  });

  // two long rows of sight, gap apart on screen, with the shroud between them
  function rows(gap: number): Shroud {
    const sh = new Shroud(4096, 2048);
    for (let x = 1000; x <= 3000; x += 50) {
      sh.reveal(x, 900, 120);
      sh.reveal(x, 900 + 2 * (120 / Math.SQRT2) + gap, 120);
    }
    return sh;
  }
  const mid = (gap: number) => 900 + 120 / Math.SQRT2 + gap / 2;

  it('lifts a thin strip between two seen areas', () => {
    const sh = rows(30);
    expect(sh.dark(2000, mid(30))).toBe(1);
    sh.clearThin();
    expect(sh.dark(2000, mid(30))).toBe(0);
    expect(sh.seen(2000, mid(30))).toBe(true);
    // the shroud beyond them is untouched
    expect(sh.dark(2000, 300)).toBe(1);
    expect(sh.dark(500, 1000)).toBe(1);
  });

  it('leaves a wide strip between two seen areas', () => {
    const sh = rows(200);
    sh.clearThin();
    expect(sh.dark(2000, mid(200))).toBe(1);
  });

  it('leaves a small pocket of shroud that nothing seen touches', () => {
    const sh = new Shroud(2048, 1024, (sx, sy) => Math.hypot((sx - 500) / 2, sy - 500) > 30);
    sh.clearThin();
    expect(sh.dark(500, 500)).toBe(1);
  });

  it('leaves a fully shrouded map alone', () => {
    const sh = new Shroud(1024, 512);
    const v = sh.version;
    sh.clearThin();
    expect(sh.version).toBe(v);
    expect(sh.dark(500, 250)).toBe(1);
  });
});
