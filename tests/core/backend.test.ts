import { describe, expect, it, vi } from 'vitest';
import { LocalSlotBackend, RgsSlotBackend, RgsTransportError } from '../../src/core/backend';
import { SeededRng } from '../../src/core/rng';
import { SlotEngine } from '../../src/core/slotEngine';

describe('LocalSlotBackend & RgsSlotBackend', () => {
  it('delegates state and spin to SlotEngine via LocalSlotBackend', async () => {
    const engine = new SlotEngine(new SeededRng(42), 1000);
    const backend = new LocalSlotBackend(engine);
    const result = await backend.spin();
    expect(result.bet).toBe(5);
    expect(backend.balance).toBe(result.balanceAfter);
  });

  it('retries transient HTTP 503 responses with the same Idempotency-Key and succeeds', async () => {
    const engine = new SlotEngine(new SeededRng(42), 1000);
    const sample = engine.spin();
    const keys: string[] = [];

    const fetcher = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        keys.push(init.headers['Idempotency-Key']);
        return { ok: false, status: 503, json: async () => sample };
      })
      .mockImplementationOnce(async (_url, init) => {
        keys.push(init.headers['Idempotency-Key']);
        return { ok: true, status: 200, json: async () => sample };
      });

    const backend = new RgsSlotBackend(engine, {
      endpointUrl: 'https://rgs.example/spin',
      fetcher,
      maxRetries: 2,
    });

    const result = await backend.spin();
    expect(result).toEqual(sample);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('throws RgsTransportError when retries are exhausted or on non-retryable 400', async () => {
    const engine = new SlotEngine(new SeededRng(42), 1000);
    const sample = engine.spin();

    const failingFetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const netBackend = new RgsSlotBackend(engine, {
      endpointUrl: 'https://rgs.example/spin',
      fetcher: failingFetcher,
      maxRetries: 1,
    });
    await expect(netBackend.spin()).rejects.toBeInstanceOf(RgsTransportError);
    expect(failingFetcher).toHaveBeenCalledTimes(2);

    const badReqFetcher = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => sample });
    const clientErrBackend = new RgsSlotBackend(engine, {
      endpointUrl: 'https://rgs.example/spin',
      fetcher: badReqFetcher,
      maxRetries: 2,
    });
    await expect(clientErrBackend.spin()).rejects.toBeInstanceOf(RgsTransportError);
    expect(badReqFetcher).toHaveBeenCalledTimes(1);
  });
});
