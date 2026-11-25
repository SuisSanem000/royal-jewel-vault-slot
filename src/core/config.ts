import type { SymbolId } from './types';

export const REEL_COUNT = 5;
export const ROW_COUNT = 3;
export const INITIAL_BALANCE = 1000;
export const BET_STEPS = [10, 20, 50, 100, 200, 500] as const;
export const DEFAULT_BET_INDEX = 0; // 10 credits (lineBet = 1 -> clean integer awards)

export const BONUS_MULTIPLIERS = [1, 2, 3, 5] as const;

/** Free spins awarded for 3, 4, or 5 scatters */
export const SCATTER_FREE_SPINS: Record<number, number> = {
  3: 8,
  4: 10,
  5: 12,
};

/** Scatter total-bet multiplier payouts for 3, 4, or 5 scatters */
export const SCATTER_PAYOUTS: Record<number, number> = {
  3: 2,
  4: 10,
  5: 50,
};

/** Payline multipliers (applied to total bet / 10, rounded to 2 decimals) for 3, 4, 5 of a kind */
export const PAYTABLE: Record<Exclude<SymbolId, 'SCATTER'>, Record<3 | 4 | 5, number>> = {
  WILD: { 3: 25, 4: 100, 5: 400 },
  HIGH_RUBY: { 3: 20, 4: 80, 5: 300 },
  HIGH_SAPPHIRE: { 3: 15, 4: 60, 5: 200 },
  HIGH_EMERALD: { 3: 12, 4: 45, 5: 150 },
  HIGH_AMETHYST: { 3: 10, 4: 35, 5: 120 },
  LOW_A: { 3: 5, 4: 15, 5: 50 },
  LOW_K: { 3: 4, 4: 12, 5: 40 },
  LOW_Q: { 3: 3, 4: 10, 5: 30 },
  LOW_J: { 3: 2, 4: 8, 5: 25 },
};

/** 20 fixed paylines; each array holds the row index (0=top, 1=mid, 2=bot) per reel 0..4 */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1], // 1: Middle
  [0, 0, 0, 0, 0], // 2: Top
  [2, 2, 2, 2, 2], // 3: Bottom
  [0, 1, 2, 1, 0], // 4: V
  [2, 1, 0, 1, 2], // 5: Inverted V
  [0, 0, 1, 2, 2], // 6: Diagonal down
  [2, 2, 1, 0, 0], // 7: Diagonal up
  [1, 0, 0, 0, 1], // 8: Top arch
  [1, 2, 2, 2, 1], // 9: Bottom arch
  [0, 1, 1, 1, 0], // 10: Shallow V
  [2, 1, 1, 1, 2], // 11: Shallow inv V
  [1, 0, 1, 2, 1], // 12: Wave up-down
  [1, 2, 1, 0, 1], // 13: Wave down-up
  [0, 1, 0, 1, 0], // 14: Zigzag top
  [2, 1, 2, 1, 2], // 15: Zigzag bottom
  [1, 1, 0, 1, 1], // 16: Mid bump up
  [1, 1, 2, 1, 1], // 17: Mid bump down
  [0, 2, 0, 2, 0], // 18: Deep zigzag A
  [2, 0, 2, 0, 2], // 19: Deep zigzag B
  [0, 2, 2, 2, 0], // 20: Bowl
];

/** Balanced virtual reel strips for each of the 5 reels */
export const REEL_STRIPS: readonly (readonly SymbolId[])[] = [
  [
    'HIGH_RUBY', 'LOW_J', 'LOW_Q', 'HIGH_EMERALD', 'LOW_K', 'LOW_A', 'WILD',
    'LOW_J', 'HIGH_SAPPHIRE', 'LOW_Q', 'SCATTER', 'LOW_K', 'HIGH_AMETHYST', 'LOW_A',
    'LOW_J', 'HIGH_RUBY', 'LOW_Q', 'LOW_K', 'HIGH_EMERALD', 'LOW_A', 'LOW_J',
    'HIGH_SAPPHIRE', 'LOW_Q', 'HIGH_AMETHYST', 'LOW_K', 'LOW_A', 'SCATTER', 'LOW_J',
  ],
  [
    'LOW_K', 'HIGH_SAPPHIRE', 'LOW_J', 'LOW_A', 'HIGH_RUBY', 'LOW_Q', 'WILD',
    'LOW_K', 'HIGH_AMETHYST', 'LOW_J', 'SCATTER', 'LOW_A', 'HIGH_EMERALD', 'LOW_Q',
    'LOW_K', 'HIGH_SAPPHIRE', 'LOW_J', 'LOW_A', 'HIGH_RUBY', 'LOW_Q', 'LOW_K',
    'HIGH_EMERALD', 'LOW_J', 'HIGH_AMETHYST', 'LOW_A', 'LOW_Q', 'SCATTER', 'LOW_K',
  ],
  [
    'LOW_Q', 'HIGH_EMERALD', 'LOW_K', 'LOW_J', 'HIGH_RUBY', 'LOW_A', 'WILD',
    'LOW_Q', 'HIGH_SAPPHIRE', 'LOW_K', 'SCATTER', 'LOW_J', 'HIGH_AMETHYST', 'LOW_A',
    'LOW_Q', 'HIGH_EMERALD', 'LOW_K', 'LOW_J', 'HIGH_RUBY', 'LOW_A', 'LOW_Q',
    'HIGH_AMETHYST', 'LOW_K', 'HIGH_SAPPHIRE', 'LOW_J', 'LOW_A', 'SCATTER', 'LOW_Q',
  ],
  [
    'LOW_A', 'HIGH_AMETHYST', 'LOW_Q', 'LOW_K', 'HIGH_SAPPHIRE', 'LOW_J', 'WILD',
    'LOW_A', 'HIGH_RUBY', 'LOW_Q', 'SCATTER', 'LOW_K', 'HIGH_EMERALD', 'LOW_J',
    'LOW_A', 'HIGH_AMETHYST', 'LOW_Q', 'LOW_K', 'HIGH_SAPPHIRE', 'LOW_J', 'LOW_A',
    'HIGH_RUBY', 'LOW_Q', 'HIGH_EMERALD', 'LOW_K', 'LOW_J', 'SCATTER', 'LOW_A',
  ],
  [
    'LOW_J', 'HIGH_RUBY', 'LOW_A', 'LOW_Q', 'HIGH_AMETHYST', 'LOW_K', 'WILD',
    'LOW_J', 'HIGH_EMERALD', 'LOW_A', 'SCATTER', 'LOW_Q', 'HIGH_SAPPHIRE', 'LOW_K',
    'LOW_J', 'HIGH_RUBY', 'LOW_A', 'LOW_Q', 'HIGH_EMERALD', 'LOW_K', 'LOW_J',
    'HIGH_SAPPHIRE', 'LOW_A', 'HIGH_AMETHYST', 'LOW_Q', 'LOW_K', 'SCATTER', 'LOW_J',
  ],
];
