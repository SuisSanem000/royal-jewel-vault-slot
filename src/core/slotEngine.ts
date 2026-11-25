import {
  BET_STEPS,
  BONUS_MULTIPLIERS,
  DEFAULT_BET_INDEX,
  INITIAL_BALANCE,
  REEL_COUNT,
  REEL_STRIPS,
  ROW_COUNT,
} from './config';
import { evaluateGrid } from './evaluator';
import { MathRng, type Rng } from './rng';
import type { BonusState, Grid, SpinResult, SymbolId } from './types';

function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

function createEmptyBonusState(): BonusState {
  return {
    active: false,
    spinsRemaining: 0,
    spinsAwardedTotal: 0,
    multiplierIndex: 0,
    multiplier: BONUS_MULTIPLIERS[0],
    totalBonusWin: 0,
  };
}

export class SlotEngine {
  private _balance: number;
  private _betIndex: number;
  private _bonus: BonusState;
  private readonly rng: Rng;

  constructor(rng: Rng = new MathRng(), initialBalance = INITIAL_BALANCE) {
    this.rng = rng;
    this._balance = initialBalance;
    this._betIndex = DEFAULT_BET_INDEX;
    this._bonus = createEmptyBonusState();
  }

  get balance(): number {
    return this._balance;
  }

  get bet(): number {
    return BET_STEPS[this._betIndex];
  }

  get bonus(): BonusState {
    return { ...this._bonus };
  }

  canSpin(): boolean {
    return this._bonus.active || this._balance >= this.bet;
  }

  increaseBet(): number {
    if (!this._bonus.active && this._betIndex < BET_STEPS.length - 1) {
      this._betIndex++;
    }
    return this.bet;
  }

  decreaseBet(): number {
    if (!this._bonus.active && this._betIndex > 0) {
      this._betIndex--;
    }
    return this.bet;
  }

  setBet(bet: number): boolean {
    if (this._bonus.active) return false;
    const idx = BET_STEPS.indexOf(bet as (typeof BET_STEPS)[number]);
    if (idx === -1) return false;
    this._betIndex = idx;
    return true;
  }

  refillCredits(amount = INITIAL_BALANCE): number {
    this._balance = roundCredits(this._balance + amount);
    return this._balance;
  }

  /** Generates a 5x3 grid from the virtual reel strips */
  private generateGrid(forceBonus = false): Grid {
    const grid: Grid = [];
    for (let col = 0; col < REEL_COUNT; col++) {
      const strip = REEL_STRIPS[col];
      const start = this.rng.nextInt(strip.length);
      const column: SymbolId[] = [];
      for (let row = 0; row < ROW_COUNT; row++) {
        column.push(strip[(start + row) % strip.length]);
      }
      grid.push(column);
    }

    if (forceBonus) {
      // Guarantee 3 scatters on reels 0, 2, 4 without duplicating scatters in a column
      for (const col of [0, 2, 4]) {
        if (!grid[col].includes('SCATTER')) {
          grid[col][1] = 'SCATTER';
        }
      }
    }

    return grid;
  }

  spin(options: { forceBonus?: boolean; customGrid?: Grid } = {}): SpinResult {
    const isFreeSpin = this._bonus.active;
    const bet = this.bet;

    if (!isFreeSpin) {
      if (this._balance < bet) {
        throw new Error('Insufficient balance for spin');
      }
      this._balance = roundCredits(this._balance - bet);
    } else {
      this._bonus.spinsRemaining = Math.max(0, this._bonus.spinsRemaining - 1);
    }

    const multiplierApplied = isFreeSpin ? this._bonus.multiplier : 1;
    const grid = options.customGrid ?? this.generateGrid(Boolean(options.forceBonus));
    const { lineWins, scatterWin, totalWin } = evaluateGrid(grid, bet, multiplierApplied);

    if (totalWin > 0) {
      this._balance = roundCredits(this._balance + totalWin);
    }

    let triggeredBonus = false;
    let retriggeredFreeSpins = 0;
    let bonusCompleted = false;

    if (isFreeSpin) {
      this._bonus.totalBonusWin = roundCredits(this._bonus.totalBonusWin + totalWin);

      // Progressive multiplier steps up on winning bonus spins
      if (totalWin > 0 && this._bonus.multiplierIndex < BONUS_MULTIPLIERS.length - 1) {
        this._bonus.multiplierIndex++;
        this._bonus.multiplier = BONUS_MULTIPLIERS[this._bonus.multiplierIndex];
      }

      if (scatterWin) {
        retriggeredFreeSpins = scatterWin.freeSpinsAwarded;
        this._bonus.spinsRemaining += retriggeredFreeSpins;
        this._bonus.spinsAwardedTotal += retriggeredFreeSpins;
      }

      if (this._bonus.spinsRemaining === 0) {
        bonusCompleted = true;
      }
    } else if (scatterWin) {
      triggeredBonus = true;
      this._bonus = {
        active: true,
        spinsRemaining: scatterWin.freeSpinsAwarded,
        spinsAwardedTotal: scatterWin.freeSpinsAwarded,
        multiplierIndex: 0,
        multiplier: BONUS_MULTIPLIERS[0],
        totalBonusWin: scatterWin.payout,
      };
    }

    return {
      grid,
      bet,
      isFreeSpin,
      multiplierApplied,
      lineWins,
      scatterWin,
      totalWin,
      triggeredBonus,
      retriggeredFreeSpins,
      bonusCompleted,
      balanceAfter: this._balance,
      bonusState: { ...this._bonus },
    };
  }

  /** Resets bonus state after the bonus outro completes and returns to base game */
  finishBonus(): void {
    this._bonus = createEmptyBonusState();
  }

  /** Resets balance, bet, and bonus state back to initial defaults */
  reset(): void {
    this._balance = INITIAL_BALANCE;
    this._betIndex = DEFAULT_BET_INDEX;
    this._bonus = createEmptyBonusState();
  }
}
