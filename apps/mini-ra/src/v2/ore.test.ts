import { describe, expect, it } from 'vitest';
import { regrowField } from './ore';

describe('ore generators', () => {
  it('grow back the nearest dug clump first, then spread outwards', () => {
    const nodes = [{ amt: 600 }, { amt: 0 }, { amt: 100 }, { amt: 0 }];
    const g = { x: 0, y: 0, nodes };
    regrowField(g, 50, 600);
    expect(nodes.map((n) => n.amt)).toEqual([600, 50, 100, 0]);
    regrowField(g, 600, 600);
    expect(nodes.map((n) => n.amt)).toEqual([600, 600, 150, 0]);
    regrowField(g, 500, 600);
    expect(nodes.map((n) => n.amt)).toEqual([600, 600, 600, 50]);
  });

  it('pass over clumps that can\'t grow', () => {
    const nodes = [{ amt: 0 }, { amt: 0 }];
    regrowField({ x: 0, y: 0, nodes }, 30, 600, (n) => n !== nodes[0]);
    expect(nodes.map((n) => n.amt)).toEqual([0, 30]);
  });

  it('stop once the field is full', () => {
    const nodes = [{ amt: 590 }, { amt: 600 }];
    expect(regrowField({ x: 0, y: 0, nodes }, 30, 600)).toBe(20);
    expect(nodes.map((n) => n.amt)).toEqual([600, 600]);
  });
});
