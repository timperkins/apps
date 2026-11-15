import { ITEMS, type ItemId } from './data';

export interface Stack {
  item: ItemId;
  n: number;
}

export class Inventory {
  slots: (Stack | null)[];

  constructor(size: number) {
    this.slots = new Array(size).fill(null);
  }

  count(item: ItemId): number {
    let c = 0;
    for (const s of this.slots) if (s && s.item === item) c += s.n;
    return c;
  }

  /** How many of `item` could be added right now. */
  space(item: ItemId): number {
    const stack = ITEMS[item].stack;
    let c = 0;
    for (const s of this.slots) {
      if (!s) c += stack;
      else if (s.item === item) c += stack - s.n;
    }
    return c;
  }

  /** Adds up to n; returns how many were added. */
  add(item: ItemId, n: number): number {
    const stack = ITEMS[item].stack;
    let left = n;
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.item === item && s.n < stack) {
        const k = Math.min(stack - s.n, left);
        s.n += k;
        left -= k;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const k = Math.min(stack, left);
        this.slots[i] = { item, n: k };
        left -= k;
      }
    }
    return n - left;
  }

  /** Removes up to n; returns how many were removed. */
  remove(item: ItemId, n: number): number {
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.item === item) {
        const k = Math.min(s.n, left);
        s.n -= k;
        left -= k;
        if (s.n === 0) this.slots[i] = null;
      }
    }
    return n - left;
  }

  firstItem(filter?: (item: ItemId) => boolean): ItemId | null {
    for (const s of this.slots) if (s && (!filter || filter(s.item))) return s.item;
    return null;
  }

  isEmpty(): boolean {
    return this.slots.every((s) => !s);
  }

  /** Merge stacks and sort by item order for a tidy look. */
  sort(): void {
    const totals = new Map<ItemId, number>();
    for (const s of this.slots) if (s) totals.set(s.item, (totals.get(s.item) ?? 0) + s.n);
    const order = Object.keys(ITEMS) as ItemId[];
    this.slots.fill(null);
    for (const id of order) {
      const n = totals.get(id);
      if (n) this.add(id, n);
    }
  }

  toJSON(): [ItemId, number][] {
    const out: [ItemId, number][] = [];
    for (const s of this.slots) if (s) out.push([s.item, s.n]);
    return out;
  }

  load(data: [ItemId, number][]): void {
    this.slots.fill(null);
    for (const [item, n] of data) if (ITEMS[item]) this.add(item, n);
  }
}
