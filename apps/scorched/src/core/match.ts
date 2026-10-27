import { Battle } from './battle';
import { GRAVITY, PLANE_INTERVAL, WIND_MAX, type GameConfig } from './config';
import { SCORE_PER_WIN, SELL_RATE, WIN_BONUS } from './constants';
import { createPlayer, emptyRoundStats, type Player, type RoundStats } from './player';
import { Rng, randomSeed } from './rng';
import { TERRAIN_TYPES, type ConcreteTerrain } from './terrain';
import { shopDef, type ShopId } from './weapons';

export interface RoundSummary {
  round: number;
  winner: number | null;
  /** Per player, in player order. */
  stats: (RoundStats & { interest: number; winBonus: number })[];
}

/** A whole game: players, their money and score, and the sequence of rounds. */
export class Match {
  readonly players: Player[];
  readonly rng: Rng;
  readonly seed: number;
  /** 1-based number of the round being shopped for or played; 0 before the first. */
  round = 0;
  battle: Battle | null = null;
  readonly history: RoundSummary[] = [];

  constructor(readonly config: GameConfig) {
    this.seed = config.seed ?? randomSeed();
    this.rng = new Rng(this.seed);
    this.players = config.players.map((p, i) => createPlayer(p, i, config.startingCoins));
  }

  get isOver(): boolean {
    return this.round >= this.config.rounds && (this.battle === null || this.battle.phase === 'over');
  }

  /** Moves to the next round's shopping phase. */
  nextRound(): void {
    this.round++;
    this.battle = null;
    for (const p of this.players) p.round = emptyRoundStats();
  }

  startBattle(): Battle {
    const terrain: ConcreteTerrain =
      this.config.terrain === 'random' ? this.rng.pick(TERRAIN_TYPES) : this.config.terrain;
    this.battle = new Battle(this.players, {
      terrain,
      gravity: GRAVITY[this.config.gravity],
      windMax: WIND_MAX[this.config.wind],
      windChange: this.config.windChange,
      planeInterval: PLANE_INTERVAL[this.config.planes] ?? 0,
      seed: this.rng.int(1, 0x7fffffff),
    });
    return this.battle;
  }

  /** Pays out end-of-round bonuses and interest. Call once the battle is over. */
  finishRound(): RoundSummary {
    const winner = this.battle?.winner ?? null;
    const stats = this.players.map((p) => {
      let winBonus = 0;
      if (p.index === winner) {
        winBonus = WIN_BONUS;
        p.coins += WIN_BONUS;
        p.score += SCORE_PER_WIN;
      }
      p.coins = Math.floor(p.coins);
      const interest = Math.floor((p.coins * this.config.interestPct) / 100);
      p.coins += interest;
      p.round.coinsEarned = Math.floor(p.round.coinsEarned) + winBonus + interest;
      p.round.damageDealt = Math.round(p.round.damageDealt);
      return { ...p.round, interest, winBonus };
    });
    const summary: RoundSummary = { round: this.round, winner, stats };
    this.history.push(summary);
    return summary;
  }

  canBuy(player: number, id: ShopId): boolean {
    const def = shopDef(id);
    return def.bundle > 0 && this.players[player].coins >= def.price;
  }

  buy(player: number, id: ShopId): boolean {
    if (!this.canBuy(player, id)) return false;
    const def = shopDef(id);
    const p = this.players[player];
    p.coins -= def.price;
    p.inventory[id] += def.bundle;
    return true;
  }

  /** Coins returned for selling one unit. */
  sellPrice(id: ShopId): number {
    const def = shopDef(id);
    return def.bundle > 0 ? Math.floor((def.price / def.bundle) * SELL_RATE) : 0;
  }

  sell(player: number, id: ShopId): boolean {
    const p = this.players[player];
    if (p.inventory[id] <= 0 || shopDef(id).bundle === 0) return false;
    p.inventory[id]--;
    p.coins += this.sellPrice(id);
    return true;
  }

  /** Players ordered by score, then kills, then coins. */
  standings(): Player[] {
    return [...this.players].sort(
      (a, b) => b.score - a.score || b.totalKills - a.totalKills || b.coins - a.coins,
    );
  }
}
