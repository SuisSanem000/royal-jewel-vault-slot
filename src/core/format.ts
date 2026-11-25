export interface FormatConfig {
  locale: string;
  currency?: string;
}

export interface LaunchConfig {
  format: FormatConfig;
  ukgcMode: boolean;
  minSpinMs: number;
  realityCheckMinutes: number;
  rgsUrl?: string;
}

const DEFAULT_FORMAT: FormatConfig = {
  locale: 'en-US',
};

/** Parses operator/player URL launch parameters (e.g. ?currency=EUR&locale=de-DE&ukgc=1). */
export function parseLaunchConfig(search: string): LaunchConfig {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);

  const rawLocale = params.get('locale')?.trim();
  const locale = rawLocale && rawLocale.length > 0 ? rawLocale : DEFAULT_FORMAT.locale;

  const rawCurrency = params.get('currency')?.trim().toUpperCase();
  const currency = rawCurrency && /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : undefined;

  const ukgcParam = params.get('ukgc')?.trim().toLowerCase();
  const ukgcMode = ukgcParam === '1' || ukgcParam === 'true';

  const rawMinSpin = Number(params.get('minSpinMs'));
  const minSpinMs =
    Number.isFinite(rawMinSpin) && rawMinSpin > 0
      ? Math.min(rawMinSpin, 10000)
      : ukgcMode
        ? 2500
        : 0;

  const rawReality = Number(params.get('realityCheckMin'));
  const realityCheckMinutes =
    Number.isFinite(rawReality) && rawReality > 0 ? Math.min(rawReality, 240) : 0;

  const rawRgsUrl = params.get('rgsUrl')?.trim();
  const rgsUrl = rawRgsUrl && rawRgsUrl.length > 0 ? rawRgsUrl : undefined;

  return {
    format: { locale, currency },
    ukgcMode,
    minSpinMs,
    realityCheckMinutes,
    rgsUrl,
  };
}

/** Formats credit/currency values using Intl.NumberFormat with integer-cent rounding. */
export function formatCredits(amount: number, config: FormatConfig = DEFAULT_FORMAT): string {
  const safe = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  try {
    if (config.currency) {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safe);
    }
    return new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return String(safe);
  }
}
