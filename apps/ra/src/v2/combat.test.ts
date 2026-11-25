import { describe, expect, it } from 'vitest';
import { UNIT_DEF, VERSUS, WEAPON, versus } from './combat';

describe('Comet rocket', () => {
  it('takes about three quarters of a Bastion tank on a direct hit', () => {
    const w = WEAPON.comet!;
    const heavy = UNIT_DEF.heavy;
    // a direct hit lands within its scatter of the middle, so a little off the full blast
    const worst = 1 - ((w.scatter ?? 0) / w.splash!) * 0.6;
    const share = (k: number) => (w.dmg * versus(w, heavy.armor) * k) / heavy.strength;
    expect(share(1)).toBeGreaterThan(0.75);
    expect(share(1)).toBeLessThan(0.85);
    expect(share(worst)).toBeGreaterThan(0.68);
  });

  it('leaves other weapons on their warhead\'s table', () => {
    expect(versus(WEAPON.arty!, 'heavy')).toBe(VERSUS.HE.heavy);
  });
});
