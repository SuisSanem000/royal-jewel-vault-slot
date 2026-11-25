import { describe, expect, it } from 'vitest';
import { loadPreferences, savePreferences } from '../../src/presentation/storage';

describe('storage preferences persistence', () => {
  it('saves and loads valid preferences safely', () => {
    const mem = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };

    savePreferences({ muted: true, turbo: false, bet: 20 }, mockStorage);
    expect(loadPreferences(mockStorage)).toEqual({ muted: true, turbo: false, bet: 20 });
  });

  it('swallows SecurityError / quota errors in restricted environments', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    expect(() => savePreferences({ muted: true }, brokenStorage)).not.toThrow();
    expect(loadPreferences(brokenStorage)).toEqual({});
  });
});
