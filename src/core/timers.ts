interface TimerEntry {
  fn: () => void;
  remaining: number;
  fireAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/**
 * Minimal pausable timer registry so reel stops, banners, and AUTO/BONUS delays
 * freeze cleanly when the browser tab is hidden, minimized, or backgrounded.
 */
export class PausableTimerManager {
  private nextId = 1;
  private paused = false;
  private readonly entries = new Map<number, TimerEntry>();

  set(fn: () => void, delayMs: number): number {
    const id = this.nextId++;
    const safeDelay = Math.max(0, delayMs);
    const entry: TimerEntry = {
      fn,
      remaining: safeDelay,
      fireAt: Date.now() + safeDelay,
      handle: null,
    };
    this.entries.set(id, entry);
    if (!this.paused) {
      this.arm(id, entry);
    }
    return id;
  }

  clear(id: number | null | undefined): void {
    if (!id) return;
    const entry = this.entries.get(id);
    if (!entry) return;
    if (entry.handle !== null) {
      clearTimeout(entry.handle);
    }
    this.entries.delete(id);
  }

  pauseAll(): void {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    for (const entry of this.entries.values()) {
      if (entry.handle !== null) {
        clearTimeout(entry.handle);
        entry.handle = null;
      }
      entry.remaining = Math.max(0, entry.fireAt - now);
    }
  }

  resumeAll(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const [id, entry] of [...this.entries.entries()]) {
      if (this.entries.has(id) && entry.handle === null) {
        this.arm(id, entry);
      }
    }
  }

  private arm(id: number, entry: TimerEntry): void {
    entry.fireAt = Date.now() + entry.remaining;
    entry.handle = setTimeout(() => {
      if (!this.entries.has(id)) return;
      this.entries.delete(id);
      entry.fn();
    }, entry.remaining);
  }
}

export const gameTimers = new PausableTimerManager();
