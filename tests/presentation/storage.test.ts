import { describe, expect, it } from 'vitest';
import type { Grid } from '../../src/core/types';
import { clearSession, loadSession, saveSession } from '../../src/presentation/storage';

const SAMPLE_GRID: Grid = [
  ['HIGH_RUBY', 'LOW_A', 'LOW_K',],
  ['HIGH_SAPPHIRE', 'LOW_Q', 'LOW_J',],
  ['HIGH_EMERALD', 'WILD', 'SCATTER',],
  ['HIGH_AMETHYST', 'LOW_A', 'LOW_K',],
  ['LOW_Q', 'LOW_J', 'HIGH_RUBY',],
];

describe('session persistence', () => {
  it('saves, loads, and clears game state cleanly without persisting TURBO', () => {
    const mem = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };

    saveSession(
      {
        balance: 1450,
        bet: 20,
        lastWin: 80,
        muted: true,
        grid: SAMPLE_GRID,
        bonus: {
          active: true,
          spinsRemaining: 6,
          spinsAwardedTotal: 8,
          multiplierIndex: 1,
          multiplier: 2,
          totalBonusWin: 80,
        },
      },
      mockStorage,
    );

    const loaded = loadSession(mockStorage);
    expect(loaded.balance).toBe(1450);
    expect(loaded.bet).toBe(20);
    expect(loaded.lastWin).toBe(80);
    expect(loaded.muted).toBe(true);
    expect(loaded.grid).toEqual(SAMPLE_GRID);
    expect(loaded.bonus?.spinsRemaining).toBe(6);

    clearSession(mockStorage);
    expect(loadSession(mockStorage)).toEqual({});
  });

  it('swallows SecurityError / quota errors in restricted environments', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(() => saveSession({ balance: 900 }, brokenStorage)).not.toThrow();
    expect(() => clearSession(brokenStorage)).not.toThrow();
    expect(loadSession(brokenStorage)).toEqual({});
  });
});
