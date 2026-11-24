export type RegularSymbolId =
  | 'HIGH_RUBY'
  | 'HIGH_SAPPHIRE'
  | 'HIGH_EMERALD'
  | 'HIGH_AMETHYST'
  | 'LOW_A'
  | 'LOW_K'
  | 'LOW_Q'
  | 'LOW_J';

export type SymbolId = RegularSymbolId | 'WILD' | 'SCATTER';

/** Grid indexed as grid[col][row] where col in 0..4 and row in 0..2 */
export type Grid = SymbolId[][];

export interface CellPosition {
  col: number;
  row: number;
}

export interface LineWin {
  paylineIndex: number;
  symbol: SymbolId;
  count: number;
  payout: number;
  positions: CellPosition[];
}

export interface ScatterWin {
  count: number;
  payout: number;
  freeSpinsAwarded: number;
  positions: CellPosition[];
}

export interface BonusState {
  active: boolean;
  spinsRemaining: number;
  spinsAwardedTotal: number;
  multiplierIndex: number;
  multiplier: number;
  totalBonusWin: number;
}

export interface SpinResult {
  grid: Grid;
  bet: number;
  isFreeSpin: boolean;
  multiplierApplied: number;
  lineWins: LineWin[];
  scatterWin: ScatterWin | null;
  totalWin: number;
  triggeredBonus: boolean;
  retriggeredFreeSpins: number;
  bonusCompleted: boolean;
  balanceAfter: number;
  bonusState: BonusState;
}

export type GameState =
  | 'BOOT'
  | 'IDLE'
  | 'SPINNING'
  | 'EVALUATING'
  | 'WIN_PRESENTATION'
  | 'BONUS_INTRO'
  | 'BONUS_ACTIVE'
  | 'BONUS_OUTRO';
