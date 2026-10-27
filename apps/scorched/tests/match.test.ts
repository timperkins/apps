import { describe, expect, it } from 'vitest';
import { WIN_BONUS } from '../src/core/constants';
import { WEAPONS } from '../src/core/weapons';
import { makeMatch } from './helpers';

describe('Match economy', () => {
  it('buys bundles and sells singles at half price', () => {
    const m = makeMatch({ startingCoins: 10000 });
    expect(m.buy(0, 'missile')).toBe(true);
    expect(m.players[0].inventory.missile).toBe(5);
    expect(m.players[0].coins).toBe(10000 - WEAPONS.missile.price);
    expect(m.sell(0, 'missile')).toBe(true);
    expect(m.players[0].coins).toBe(10000 - 1200 + 120);
  });

  it('sells the Power Cell as a single for 1,000', () => {
    const m = makeMatch({ startingCoins: 10000 });
    expect(m.buy(0, 'powerCell')).toBe(true);
    expect(m.players[0].inventory.powerCell).toBe(1);
    expect(m.players[0].coins).toBe(9000);
  });

  it('refuses purchases the player cannot afford', () => {
    const m = makeMatch({ startingCoins: 500 });
    expect(m.buy(0, 'nuke')).toBe(false);
    expect(m.players[0].inventory.nuke).toBe(0);
    expect(m.buy(0, 'babyMissile')).toBe(false);
  });

  it('pays the winner and interest at the end of a round', () => {
    const m = makeMatch({ startingCoins: 10000, interestPct: 5 });
    m.nextRound();
    const battle = m.startBattle();
    battle.winner = 1;
    const summary = m.finishRound();
    expect(m.players[1].coins).toBe(Math.floor((10000 + WIN_BONUS) * 1.05));
    expect(m.players[1].score).toBe(2);
    expect(m.players[0].coins).toBe(10500);
    expect(summary.winner).toBe(1);
  });

  it('ends after the configured number of rounds', () => {
    const m = makeMatch({ rounds: 2 });
    m.nextRound();
    m.startBattle().phase = 'over';
    expect(m.isOver).toBe(false);
    m.nextRound();
    m.startBattle().phase = 'over';
    expect(m.isOver).toBe(true);
  });
});
