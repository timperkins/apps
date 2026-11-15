// Little scripted scenes that play behind the title screen, 20 seconds each.
import { NEST_HP, playerWeapon, spawnBug, PLAYER_HP } from './combat';
import { Game, type Dir } from './sim';
import { Res, WORLD } from './world';

export type SceneKind = 'peaceful' | 'good' | 'bad';
export const SCENE_SECONDS = 20;

export interface Scene {
  kind: SceneKind;
  game: Game;
  /** Called every tick before the sim steps; returns the camera. */
  script: (t: number) => { x: number; y: number; zoom: number };
}

export function pickScene(prev?: SceneKind): SceneKind {
  for (;;) {
    const r = Math.random();
    const k: SceneKind = r < 0.2 ? 'peaceful' : r < 0.6 ? 'good' : 'bad';
    if (k !== prev || Math.random() < 0.3) return k;
  }
}

const OX = WORLD / 2 - 12;
const OY = WORLD / 2 - 8;

function clear(g: Game, x0: number, y0: number, w: number, h: number) {
  const wd = g.world;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = y * WORLD + x;
      wd.ground[i] = 0;
      wd.tree[i] = 0;
      wd.res[i] = 0;
      wd.amount[i] = 0;
    }
}

function ore(g: Game, x0: number, y0: number, w: number, h: number, r: Res) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      g.world.res[y * WORLD + x] = r;
      g.world.amount[y * WORLD + x] = 3000;
    }
}

/** A tidy little smelting line with power. Returns the game. */
function factory(enemies: boolean): Game {
  const g = Game.fresh(424242, false);
  g.enemies = enemies;
  g.cs.nests = [];
  clear(g, OX - 14, OY - 14, 54, 44);
  ore(g, OX, OY, 12, 3, Res.Owen);
  ore(g, OX - 9, OY + 10, 6, 6, Res.Coal);
  const P = (t: Parameters<Game['place']>[0], x: number, y: number, d: Dir = 0) => g.place(t, OX + x, OY + y, d);
  for (let i = 0; i < 4; i++) P('electric-drill', i * 3, 0, 2);
  for (let x = 0; x < 15; x++) P('belt', x, 3, 1);
  for (let y = 3; y < 12; y++) P('belt', 15, y, 2);
  for (const y of [4, 7, 10]) {
    P('inserter', 16, y, 1);
    const f = P('stone-furnace', 17, y);
    if (f) f.fuel = { item: 'coal', n: 50 };
    P('inserter', 19, y, 1);
    P('wooden-chest', 20, y);
  }
  for (let i = 0; i < 2; i++) {
    const d = P('burner-drill', -9 + i * 2, 10, 1);
    if (d) d.fuel = { item: 'coal', n: 30 };
  }
  const gen = P('generator', 2, 6);
  if (gen) gen.fuel = { item: 'coal', n: 50 };
  for (const [x, y] of [[5, 4], [10, 4], [16, 6], [16, 9], [18, 12], [12, 12], [6, 12]]) P('pole', x, y);
  const a = P('assembler', 8, 7);
  if (a) {
    a.recipe = 'owen-gear';
    a.input['owen-plate'] = 40;
  }
  const lab = P('lab', 12, 7);
  if (lab) lab.input['red-pack'] = 20;
  g.research = 'automation';
  // warm up so belts are full
  for (let i = 0; i < 60 * 12; i++) g.step();
  g.tick = 0;
  return g;
}

export function buildScene(kind: SceneKind): Scene {
  if (kind === 'peaceful') {
    const g = factory(false);
    g.px = OX + 14;
    g.py = OY + 6;
    return {
      kind,
      game: g,
      script: (t) => {
        // the engineer strolls along the line
        const p = t / SCENE_SECONDS;
        g.movePlayer(Math.cos(p * 6) * 0.4, Math.sin(p * 4) * 0.25);
        return { x: OX + 2 + p * 16, y: OY + 5 + Math.sin(p * 3) * 1.5, zoom: 34 };
      },
    };
  }
  if (kind === 'bad') {
    const g = factory(true);
    g.px = OX + 30;
    g.py = OY - 10;
    g.playerDead = 1e9; // nobody home
    for (let i = 0; i < 26; i++) {
      const k = i < 16 ? 0 : i < 23 ? 1 : 2;
      spawnBug(g, OX - 12 + Math.random() * 6, OY + 2 + Math.random() * 10, k, 0, 'attack', OX + 6, OY + 4);
    }
    return {
      kind,
      game: g,
      script: (t) => {
        const p = t / SCENE_SECONDS;
        return { x: OX + 1 + p * 9, y: OY + 5, zoom: 30 };
      },
    };
  }
  // good: an engineer with a rail gun and a few turrets clear out a nest cluster
  const g = Game.fresh(777, false);
  g.enemies = true;
  g.cs.nests = [];
  clear(g, OX - 14, OY - 14, 54, 44);
  const nests: [number, number][] = [[24, 4], [27, 9], [22, 11], [29, 3]];
  let id = 1;
  for (const [x, y] of nests) g.cs.nests.push({ id: id++, x: OX + x, y: OY + y, hp: NEST_HP, anger: 0, spawnCd: 99, pulse: x });
  for (const n of g.cs.nests) for (let i = 0; i < 3; i++) spawnBug(g, n.x + Math.random() * 3 - 1.5, n.y + 1.5, i === 2 ? 1 : 0, n.id, 'idle');
  for (const [x, y] of [[8, 3], [8, 9]]) {
    const t = g.place('gun-turret', OX + x, OY + y, 0);
    if (t) t.input['owen-ammo'] = 50;
  }
  g.inv.add('rail-gun', 1);
  g.inv.add('rail-ammo', 40);
  g.inv.add('owen-ammo', 50);
  g.px = OX + 4;
  g.py = OY + 6.5;
  g.tick = 0;
  return {
    kind,
    game: g,
    script: (t) => {
      g.cs.playerHp = PLAYER_HP;
      const target = g.cs.nests[0];
      if (target) {
        const dx = target.x - g.px, dy = target.y - g.py;
        const d = Math.hypot(dx, dy);
        if (d > 13) g.movePlayer(dx, dy);
        else g.pmoving = false;
        if (playerWeapon(g)) g.shooting = true;
      } else {
        g.movePlayer(1, 0);
        g.shooting = false;
      }
      const p = t / SCENE_SECONDS;
      return { x: Math.max(g.px + 6, OX + 10 + p * 6), y: OY + 6.5, zoom: 28 };
    },
  };
}
