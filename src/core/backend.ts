import type { SlotEngine } from './slotEngine';
import type { BonusState, SpinResult } from './types';

export interface SpinRequestOptions {
  forceBonus?: boolean;
  transactionId?: string;
}

export class RgsTransportError extends Error {
  readonly code: 'NETWORK' | 'TIMEOUT' | 'SERVER';
  readonly retryable: boolean;

  constructor(message: string, code: 'NETWORK' | 'TIMEOUT' | 'SERVER' = 'NETWORK', retryable = true) {
    super(message);
    this.name = 'RgsTransportError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface GameBackend {
  readonly balance: number;
  readonly bet: number;
  readonly bonus: BonusState;
  canSpin(): boolean;
  increaseBet(): number;
  decreaseBet(): number;
  setBet(bet: number): boolean;
  refillCredits(amount?: number): number;
  spin(options?: SpinRequestOptions): Promise<SpinResult>;
  finishBonus(): void;
  reset(): void;
}

/** Synchronous in-browser math backend wrapping SlotEngine behind the async GameBackend contract. */
export class LocalSlotBackend implements GameBackend {
  constructor(private readonly engine: SlotEngine) {}

  get balance(): number {
    return this.engine.balance;
  }

  get bet(): number {
    return this.engine.bet;
  }

  get bonus(): BonusState {
    return this.engine.bonus;
  }

  canSpin(): boolean {
    return this.engine.canSpin();
  }

  increaseBet(): number {
    return this.engine.increaseBet();
  }

  decreaseBet(): number {
    return this.engine.decreaseBet();
  }

  setBet(bet: number): boolean {
    return this.engine.setBet(bet);
  }

  refillCredits(amount?: number): number {
    return this.engine.refillCredits(amount);
  }

  async spin(options: SpinRequestOptions = {}): Promise<SpinResult> {
    return this.engine.spin(options);
  }

  finishBonus(): void {
    this.engine.finishBonus();
  }

  reset(): void {
    this.engine.reset();
  }
}

export type RgsFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<SpinResult> }>;

export interface RgsBackendOptions {
  endpointUrl: string;
  fetcher?: RgsFetcher;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Remote Game Server (RGS) HTTP transport adapter with idempotent transaction IDs,
 * timeout guards, and automatic retry before surfacing RgsTransportError.
 */
export class RgsSlotBackend extends LocalSlotBackend {
  private readonly endpointUrl: string;
  private readonly fetcher: RgsFetcher;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private txSeq = 0;

  constructor(engine: SlotEngine, options: RgsBackendOptions) {
    super(engine);
    this.endpointUrl = options.endpointUrl;
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 5000);
  }

  override async spin(options: SpinRequestOptions = {}): Promise<SpinResult> {
    const transactionId = options.transactionId ?? `tx-${Date.now()}-${++this.txSeq}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

      try {
        const res = await this.fetcher(this.endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': transactionId,
          },
          body: JSON.stringify({
            transactionId,
            bet: this.bet,
            forceBonus: Boolean(options.forceBonus),
          }),
          signal: controller?.signal,
        });

        if (timer) clearTimeout(timer);

        if (!res.ok) {
          const retryable = res.status >= 500 || res.status === 429;
          throw new RgsTransportError(`RGS HTTP ${res.status}`, 'SERVER', retryable);
        }

        return await res.json();
      } catch (err) {
        if (timer) clearTimeout(timer);
        lastError = err;
        if (err instanceof RgsTransportError && !err.retryable) {
          throw err;
        }
      }
    }

    if (lastError instanceof RgsTransportError) {
      throw lastError;
    }
    const isAbort = lastError instanceof Error && lastError.name === 'AbortError';
    throw new RgsTransportError(
      isAbort ? 'RGS request timed out' : 'Network connection lost',
      isAbort ? 'TIMEOUT' : 'NETWORK',
      true,
    );
  }
}
