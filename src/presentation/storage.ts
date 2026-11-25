export interface ClientPreferences {
  muted?: boolean;
  turbo?: boolean;
  bet?: number;
}

const STORAGE_KEY = 'royal_jewel_vault_prefs_v1';

/** Safely reads persisted preferences, guarding against Safari Private Mode / sandboxed iframe SecurityErrors. */
export function loadPreferences(storage?: Pick<Storage, 'getItem'> | null): ClientPreferences {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return {};
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    return {
      muted: typeof obj.muted === 'boolean' ? obj.muted : undefined,
      turbo: typeof obj.turbo === 'boolean' ? obj.turbo : undefined,
      bet: typeof obj.bet === 'number' && Number.isFinite(obj.bet) ? obj.bet : undefined,
    };
  } catch {
    return {};
  }
}

/** Safely persists preferences, ignoring storage quota or sandbox errors. */
export function savePreferences(
  prefs: ClientPreferences,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors in sandboxed iframes or private browsing
  }
}
