import { PAYLINES, PAYTABLE, REEL_COUNT, ROW_COUNT, SCATTER_FREE_SPINS, SCATTER_PAYOUTS } from './config';
import type { CellPosition, Grid, LineWin, ScatterWin, SymbolId } from './types';

function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

function evaluatePayline(
  grid: Grid,
  paylineIndex: number,
  bet: number,
  multiplier: number,
): LineWin | null {
  const rows = PAYLINES[paylineIndex];
  const symbols: SymbolId[] = [];
  for (let col = 0; col < REEL_COUNT; col++) {
    symbols.push(grid[col][rows[col]]);
  }

  // First non-wild symbol determines target symbol (unless all leading symbols are WILD)
  let target: Exclude<SymbolId, 'SCATTER'> | null = null;
  for (const sym of symbols) {
    if (sym === 'SCATTER') break;
    if (sym !== 'WILD') {
      target = sym;
      break;
    }
  }

  // Count leading WILD-only match
  let wildCount = 0;
  while (wildCount < REEL_COUNT && symbols[wildCount] === 'WILD') {
    wildCount++;
  }

  // Count target + wild match
  let regularCount = 0;
  if (target) {
    while (
      regularCount < REEL_COUNT &&
      (symbols[regularCount] === target || symbols[regularCount] === 'WILD')
    ) {
      regularCount++;
    }
  }

  const lineBet = bet / 10;
  const wildPayout =
    wildCount >= 3 ? roundCredits(PAYTABLE.WILD[wildCount as 3 | 4 | 5] * lineBet * multiplier) : 0;
  const regularPayout =
    target && regularCount >= 3
      ? roundCredits(PAYTABLE[target][regularCount as 3 | 4 | 5] * lineBet * multiplier)
      : 0;

  if (wildPayout === 0 && regularPayout === 0) return null;

  const useWild = wildPayout >= regularPayout;
  const count = useWild ? wildCount : regularCount;
  const payout = useWild ? wildPayout : regularPayout;
  const symbol: SymbolId = useWild ? 'WILD' : target!;

  const positions: CellPosition[] = [];
  for (let col = 0; col < count; col++) {
    positions.push({ col, row: rows[col] });
  }

  return { paylineIndex, symbol, count, payout, positions };
}

function evaluateScatters(grid: Grid, bet: number, multiplier: number): ScatterWin | null {
  const positions: CellPosition[] = [];
  for (let col = 0; col < REEL_COUNT; col++) {
    for (let row = 0; row < ROW_COUNT; row++) {
      if (grid[col][row] === 'SCATTER') {
        positions.push({ col, row });
      }
    }
  }

  const count = Math.min(positions.length, 5);
  if (count < 3) return null;

  return {
    count,
    payout: roundCredits((SCATTER_PAYOUTS[count] ?? 0) * bet * multiplier),
    freeSpinsAwarded: SCATTER_FREE_SPINS[count] ?? 8,
    positions,
  };
}

export function evaluateGrid(
  grid: Grid,
  bet: number,
  multiplier = 1,
): { lineWins: LineWin[]; scatterWin: ScatterWin | null; totalWin: number } {
  const lineWins: LineWin[] = [];
  for (let i = 0; i < PAYLINES.length; i++) {
    const win = evaluatePayline(grid, i, bet, multiplier);
    if (win) lineWins.push(win);
  }

  const scatterWin = evaluateScatters(grid, bet, multiplier);
  const lineSum = lineWins.reduce((acc, w) => acc + w.payout, 0);
  const totalWin = roundCredits(lineSum + (scatterWin?.payout ?? 0));

  return { lineWins, scatterWin, totalWin };
}
