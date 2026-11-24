import { describe, expect, it } from 'vitest';
import { evaluateGrid } from '../../src/core/evaluator';
import type { Grid, SymbolId } from '../../src/core/types';

function makeGrid(rows: [SymbolId[], SymbolId[], SymbolId[]]): Grid {
  // Convert row-major helper into column-major Grid[col][row]
  return [0, 1, 2, 3, 4].map((col) => [rows[0][col], rows[1][col], rows[2][col]]);
}

describe('evaluateGrid', () => {
  it('pays a 3-of-a-kind middle payline with WILD substitution', () => {
    const grid = makeGrid([
      ['LOW_J', 'LOW_Q', 'LOW_K', 'LOW_A', 'LOW_J'],
      ['HIGH_RUBY', 'WILD', 'HIGH_RUBY', 'LOW_Q', 'LOW_K'],
      ['LOW_A', 'LOW_K', 'LOW_J', 'LOW_Q', 'LOW_A'],
    ]);

    const result = evaluateGrid(grid, 10, 1);
    const middleLine = result.lineWins.find((w) => w.paylineIndex === 0);

    expect(middleLine).toBeDefined();
    expect(middleLine?.symbol).toBe('HIGH_RUBY');
    expect(middleLine?.count).toBe(3);
    expect(middleLine?.payout).toBe(20); // 20 * (10 / 10) * 1
  });

  it('triggers scatter bonus with 3+ scatters anywhere and applies multiplier', () => {
    const grid = makeGrid([
      ['SCATTER', 'LOW_Q', 'LOW_K', 'LOW_A', 'LOW_J'],
      ['LOW_J', 'LOW_K', 'SCATTER', 'LOW_Q', 'LOW_K'],
      ['LOW_A', 'LOW_K', 'LOW_J', 'LOW_Q', 'SCATTER'],
    ]);

    const result = evaluateGrid(grid, 5, 2);
    expect(result.scatterWin).not.toBeNull();
    expect(result.scatterWin?.count).toBe(3);
    expect(result.scatterWin?.freeSpinsAwarded).toBe(8);
    expect(result.scatterWin?.payout).toBe(20); // 2 * bet(5) * multiplier(2)
  });

  it('returns zero win when no paylines or scatters match', () => {
    const grid = makeGrid([
      ['HIGH_RUBY', 'HIGH_SAPPHIRE', 'HIGH_EMERALD', 'HIGH_AMETHYST', 'LOW_A'],
      ['LOW_K', 'LOW_Q', 'LOW_J', 'HIGH_RUBY', 'HIGH_SAPPHIRE'],
      ['HIGH_EMERALD', 'HIGH_AMETHYST', 'LOW_A', 'LOW_K', 'LOW_Q'],
    ]);

    const result = evaluateGrid(grid, 5, 1);
    expect(result.lineWins).toHaveLength(0);
    expect(result.scatterWin).toBeNull();
    expect(result.totalWin).toBe(0);
  });
});
