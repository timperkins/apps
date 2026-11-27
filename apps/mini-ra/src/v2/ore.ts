// Ore generators: a small machine in the middle of each ore field that slowly
// grows back the ore the haulers have dug, starting with the clumps nearest
// to it and working outwards.

export interface OreClump {
  amt: number;
}

export interface OreGen<N extends OreClump = OreClump> {
  x: number;
  y: number;
  nodes: N[]; // the field's clumps, nearest the generator first
}

// Pour `amount` of new ore into the field, filling the clump nearest the
// generator that isn't full before going on to the next one out. Returns
// what was left over (when the whole field is full). A clump that can't
// grow (say a building has gone up on the bare ground) is passed over.
export function regrowField<N extends OreClump>(g: OreGen<N>, amount: number, full: number, grows: (n: N) => boolean = () => true): number {
  for (const n of g.nodes) {
    if (amount <= 0) break;
    if (n.amt >= full || !grows(n)) continue;
    const add = Math.min(full - n.amt, amount);
    n.amt += add;
    amount -= add;
  }
  return amount;
}
