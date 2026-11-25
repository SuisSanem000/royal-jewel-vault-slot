import { describe, expect, it } from 'vitest';
import { formatCredits, parseLaunchConfig } from '../../src/core/format';

describe('parseLaunchConfig', () => {
  it('returns safe defaults when no query parameters are provided', () => {
    const cfg = parseLaunchConfig('');
    expect(cfg.format.locale).toBe('en-US');
    expect(cfg.format.currency).toBeUndefined();
    expect(cfg.ukgcMode).toBe(false);
    expect(cfg.minSpinMs).toBe(0);
    expect(cfg.realityCheckMinutes).toBe(0);
    expect(cfg.rgsUrl).toBeUndefined();
  });

  it('parses currency, locale, UKGC mode, realityCheckMin, and rgsUrl', () => {
    const cfg = parseLaunchConfig(
      '?currency=eur&locale=de-DE&ukgc=1&realityCheckMin=15&rgsUrl=https://rgs.example/spin',
    );
    expect(cfg.format.locale).toBe('de-DE');
    expect(cfg.format.currency).toBe('EUR');
    expect(cfg.ukgcMode).toBe(true);
    expect(cfg.minSpinMs).toBe(2500);
    expect(cfg.realityCheckMinutes).toBe(15);
    expect(cfg.rgsUrl).toBe('https://rgs.example/spin');
  });

  it('ignores malformed currency codes', () => {
    const cfg = parseLaunchConfig('?currency=INVALID');
    expect(cfg.format.currency).toBeUndefined();
  });
});

describe('formatCredits', () => {
  it('formats plain credits and currency values via Intl.NumberFormat', () => {
    expect(formatCredits(1000, { locale: 'en-US' })).toBe('1,000.00');
    expect(formatCredits(12.5, { locale: 'en-US', currency: 'USD' })).toBe('$12.50');
    const deEur = formatCredits(1234.5, { locale: 'de-DE', currency: 'EUR' });
    expect(deEur).toContain('1.234,50');
    expect(deEur).toContain('€');
  });
});
