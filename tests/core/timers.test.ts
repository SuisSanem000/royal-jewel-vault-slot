import { describe, expect, it, vi } from 'vitest';
import { PausableTimerManager } from '../../src/core/timers';

describe('PausableTimerManager', () => {
  it('freezes active timers on pauseAll and fires after resumeAll', () => {
    vi.useFakeTimers();
    const timers = new PausableTimerManager();
    const fired = vi.fn();

    timers.set(fired, 100);
    vi.advanceTimersByTime(40);
    expect(fired).not.toHaveBeenCalled();

    timers.pauseAll();
    vi.advanceTimersByTime(500);
    expect(fired).not.toHaveBeenCalled();

    timers.resumeAll();
    vi.advanceTimersByTime(59);
    expect(fired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fired).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
