import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../src/core/rng';
import { SlotEngine } from '../../src/core/slotEngine';
import type { Grid, SymbolId } from '../../src/core/types';

function makeGrid(rows: [SymbolId[], SymbolId[], SymbolId[]]): Grid {
  return [0, 1, 2, 3, 4].map((col) => [rows[0][col], rows[1][col], rows[2][col]]);
}

describe('SlotEngine', () => {
  it('deducts bet on base spin and prevents spinning with insufficient balance', () => {
    const engine = new SlotEngine(new SeededRng(42), 5);
    const losingGrid = makeGrid([
      ['HIGH_RUBY', 'HIGH_SAPPHIRE', 'HIGH_EMERALD', 'HIGH_AMETHYST', 'LOW_A'],
      ['LOW_K', 'LOW_Q', 'LOW_J', 'HIGH_RUBY', 'HIGH_SAPPHIRE'],
      ['HIGH_EMERALD', 'HIGH_AMETHYST', 'LOW_A', 'LOW_K', 'LOW_Q'],
    ]);

    const res = engine.spin({ customGrid: losingGrid });
    expect(res.totalWin).toBe(0);
    expect(engine.balance).toBe(0);
    expect(engine.canSpin()).toBe(false);
    expect(() => engine.spin()).toThrow(/Insufficient balance/);
  });

  it('runs a full Free Spins bonus lifecycle with progressive multiplier and clean reset', () => {
    const engine = new SlotEngine(new SeededRng(7), 100);
    const triggerRes = engine.spin({ forceBonus: true });

    expect(triggerRes.triggeredBonus).toBe(true);
    expect(engine.bonus.active).toBe(true);
    expect(engine.bonus.spinsRemaining).toBe(8);
    expect(engine.bonus.multiplier).toBe(1);

    // Bet cannot be changed while bonus is active
    const betBefore = engine.bet;
    engine.increaseBet();
    expect(engine.bet).toBe(betBefore);

    const winGrid = makeGrid([
      ['LOW_J', 'LOW_Q', 'LOW_K', 'LOW_A', 'LOW_J'],
      ['HIGH_RUBY', 'HIGH_RUBY', 'HIGH_RUBY', 'LOW_Q', 'LOW_K'],
      ['LOW_A', 'LOW_K', 'LOW_J', 'LOW_Q', 'LOW_A'],
    ]);

    const firstFreeSpin = engine.spin({ customGrid: winGrid });
    expect(firstFreeSpin.isFreeSpin).toBe(true);
    expect(firstFreeSpin.multiplierApplied).toBe(1);
    expect(engine.bonus.multiplier).toBe(2); // stepped up after win!
    expect(engine.bonus.spinsRemaining).toBe(7);

    // Play remaining 7 free spins with losing grid
    const loseGrid = makeGrid([
      ['HIGH_RUBY', 'HIGH_SAPPHIRE', 'HIGH_EMERALD', 'HIGH_AMETHYST', 'LOW_A'],
      ['LOW_K', 'LOW_Q', 'LOW_J', 'HIGH_RUBY', 'HIGH_SAPPHIRE'],
      ['HIGH_EMERALD', 'HIGH_AMETHYST', 'LOW_A', 'LOW_K', 'LOW_Q'],
    ]);
    let lastRes = firstFreeSpin;
    while (engine.bonus.spinsRemaining > 0) {
      lastRes = engine.spin({ customGrid: loseGrid });
    }

    expect(lastRes.bonusCompleted).toBe(true);
    engine.finishBonus();
    expect(engine.bonus.active).toBe(false);
    expect(engine.bonus.multiplier).toBe(1);
  });

  it('produces identical outcomes for identical RNG seeds', () => {
    const a = new SlotEngine(new SeededRng(12345), 1000).spin();
    const b = new SlotEngine(new SeededRng(12345), 1000).spin();
    expect(a.grid).toEqual(b.grid);
    expect(a.totalWin).toBe(b.totalWin);
  });

  it('resets balance, bet, and bonus state back to defaults', () => {
    const engine = new SlotEngine(new SeededRng(7), 200);
    engine.increaseBet();
    engine.spin({ forceBonus: true });
    expect(engine.bonus.active).toBe(true);

    engine.reset();
    expect(engine.balance).toBe(1000);
    expect(engine.bet).toBe(5);
    expect(engine.bonus.active).toBe(false);
  });

  it('never places duplicate SCATTER symbols in the same column when forceBonus is true', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const engine = new SlotEngine(new SeededRng(seed), 1000);
      const res = engine.spin({ forceBonus: true });
      for (const col of res.grid) {
        const scatterCount = col.filter((s) => s === 'SCATTER').length;
        expect(scatterCount).toBeLessThanOrEqual(1);
      }
      expect(res.triggeredBonus).toBe(true);
    }
  });
});
