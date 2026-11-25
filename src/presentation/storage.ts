import { REEL_COUNT, ROW_COUNT } from '../core/config';
import type { BonusState, Grid, SymbolId } from '../core/types';

export interface PersistedSession {
  balance?: number;
  bet?: number;
  lastWin?: number;
  muted?: boolean;
  grid?: Grid;
  bonus?: BonusState;
}

const STORAGE_KEY = 'royal_jewel_vault_session_v2';
const LEGACY_KEY = 'royal_jewel_vault_prefs_v1';

const VALID_SYMBOLS = new Set<SymbolId>([
  'HIGH_RUBY',
  'HIGH_SAPPHIRE',
  'HIGH_EMERALD',
  'HIGH_AMETHYST',
  'LOW_A',
  'LOW_K',
  'LOW_Q',
  'LOW_J',
  'WILD',
  'SCATTER',
]);

function isValidGrid(value: unknown): value is Grid {
  if (!Array.isArray(value) || value.length !== REEL_COUNT) return false;
  return value.every(
    (col) =>
      Array.isArray(col) &&
      col.length === ROW_COUNT &&
      col.every((sym) => typeof sym === 'string' && VALID_SYMBOLS.has(sym as SymbolId)),
  );
}

function isValidBonus(value: unknown): value is BonusState {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  return (
    b.active === true &&
    typeof b.spinsRemaining === 'number' &&
    b.spinsRemaining > 0 &&
    typeof b.spinsAwardedTotal === 'number' &&
    typeof b.multiplierIndex === 'number' &&
    typeof b.multiplier === 'number' &&
    typeof b.totalBonusWin === 'number'
  );
}

/**
 * Safely reads persisted game state from localStorage.
 * Intentionally excludes TURBO so TURBO always starts OFF by default.
 */
export function loadSession(storage?: Pick<Storage, 'getItem'> | null): PersistedSession {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return {};
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    return {
      balance: typeof obj.balance === 'number' && Number.isFinite(obj.balance) && obj.balance >= 0 ? obj.balance : undefined,
      bet: typeof obj.bet === 'number' && Number.isFinite(obj.bet) ? obj.bet : undefined,
      lastWin: typeof obj.lastWin === 'number' && Number.isFinite(obj.lastWin) && obj.lastWin >= 0 ? obj.lastWin : undefined,
      muted: typeof obj.muted === 'boolean' ? obj.muted : undefined,
      grid: isValidGrid(obj.grid) ? obj.grid : undefined,
      bonus: isValidBonus(obj.bonus) ? obj.bonus : undefined,
    };
  } catch {
    return {};
  }
}

/** Safely persists current game state, ignoring storage quota or sandbox errors. */
export function saveSession(
  session: PersistedSession,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.removeItem?.(LEGACY_KEY);
    target.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors in sandboxed iframes or private browsing
  }
}

/** Clears saved session data (used by RESET / STOP ALL). */
export function clearSession(storage?: Pick<Storage, 'removeItem'> | null): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.removeItem(LEGACY_KEY);
    target.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors in sandboxed iframes or private browsing
  }
}
