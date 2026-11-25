import { describe, expect, it, vi } from 'vitest';
import { GameController, type PresentationAdapter } from '../../src/controller/GameController';
import { LocalSlotBackend, RgsTransportError } from '../../src/core/backend';
import { SeededRng } from '../../src/core/rng';
import { SlotEngine } from '../../src/core/slotEngine';
import { GameStateMachine } from '../../src/core/stateMachine';

function createMockView(): PresentationAdapter & {
  calls: string[];
  hudBonuses: boolean[];
  hudLockedFlags: boolean[];
  stopAllFlags: boolean[];
  autoEnabledFlags: boolean[];
} {
  const calls: string[] = [];
  const hudBonuses: boolean[] = [];
  const hudLockedFlags: boolean[] = [];
  const stopAllFlags: boolean[] = [];
  const autoEnabledFlags: boolean[] = [];
  return {
    calls,
    hudBonuses,
    hudLockedFlags,
    stopAllFlags,
    autoEnabledFlags,
    updateHud: vi.fn((_bal, _bet, _win, bonus, locked, stopAll, autoEnabled) => {
      hudBonuses.push(bonus.active);
      hudLockedFlags.push(locked);
      stopAllFlags.push(stopAll);
      autoEnabledFlags.push(autoEnabled);
    }),
    setSpinButton: vi.fn(),
    setAutoActive: vi.fn((active) => calls.push(`autoActive:${active}`)),
    setTurboActive: vi.fn(),
    setBonusMood: vi.fn((active) => calls.push(`mood:${active}`)),
    spinReels: vi.fn(async (_grid, turbo) => {
      calls.push(`spinReels:${turbo}`);
    }),
    quickStopReels: vi.fn(() => calls.push('quickStop')),
    showWins: vi.fn(async () => {
      calls.push('showWins');
    }),
    clearWins: vi.fn(),
    showBanner: vi.fn(async (title) => {
      calls.push(`banner:${title}`);
    }),
    abortPresentation: vi.fn(() => calls.push('abort')),
    playClick: vi.fn(),
    playSpin: vi.fn(),
    playBonusTrigger: vi.fn(),
  };
}

describe('GameController end-to-end flow', () => {
  it('completes a base spin and respects turbo toggle', async () => {
    const engine = new SlotEngine(new SeededRng(99), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    const controller = new GameController(engine, fsm, view, 0);

    controller.start();
    expect(fsm.state).toBe('IDLE');

    controller.handleToggleTurbo();
    expect(view.setTurboActive).toHaveBeenCalledWith(true);

    await controller.handleSpin();
    expect(fsm.state).toBe('IDLE');
    expect(view.calls).toContain('spinReels:true');
  });

  it('triggers Royal Free Spins without spoiling bonus HUD before reels land, enables STOP ALL, and returns to IDLE', async () => {
    const engine = new SlotEngine(new SeededRng(7), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    const controller = new GameController(engine, fsm, view, 0);

    controller.start();
    await controller.handleDemoBonus();

    // hudBonuses[0] = start(), hudBonuses[1] = during initial spinReels() (must be false!)
    expect(view.hudBonuses[1]).toBe(false);
    expect(view.stopAllFlags).toContain(true);
    expect(view.stopAllFlags[view.stopAllFlags.length - 1]).toBe(false);
    expect(fsm.state).toBe('IDLE');
    expect(engine.bonus.active).toBe(false);
    expect(view.calls).toContain('mood:true');
    expect(view.calls).toContain('banner:ROYAL FREE SPINS!');
    expect(view.calls).toContain('banner:BONUS COMPLETE!');
    expect(view.calls).toContain('mood:false');
    // 1 base trigger spin + at least 8 free spins
    expect(view.calls.filter((c) => c.startsWith('spinReels:')).length).toBeGreaterThanOrEqual(9);
  });

  it('locks HUD mid-spin, ignores handleDemoBonus and AUTO mid-spin, and triggers quick-stop once on handleSpin', async () => {
    let resolveSpin!: () => void;
    const engine = new SlotEngine(new SeededRng(99), 10);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    view.spinReels = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSpin = resolve;
        }),
    );

    const controller = new GameController(engine, fsm, view, 0);
    controller.start();
    expect(view.hudLockedFlags[0]).toBe(false);

    const spinPromise = controller.handleSpin();
    await Promise.resolve();
    // Mid-spin: controls must be locked and AUTO disabled
    expect(view.hudLockedFlags[1]).toBe(true);
    expect(view.autoEnabledFlags[1]).toBe(false);
    expect(fsm.state).toBe('SPINNING');

    // Demo bonus and enabling AUTO mid-spin must be ignored
    await controller.handleDemoBonus();
    controller.handleToggleAuto();
    expect(view.quickStopReels).not.toHaveBeenCalled();
    expect(view.calls).not.toContain('autoActive:true');

    // Clicking SPIN mid-spin triggers quickStop once and disables STOP button
    await controller.handleSpin();
    await controller.handleSpin();
    expect(view.quickStopReels).toHaveBeenCalledTimes(1);
    expect(view.setSpinButton).toHaveBeenCalledWith('STOP', false);

    resolveSpin();
    await spinPromise;
    expect(fsm.state).toBe('IDLE');
    expect(view.hudLockedFlags[view.hudLockedFlags.length - 1]).toBe(false);
  });

  it('allows handleReset (STOP ALL) to abort an active DEMO BONUS flow immediately from any state', async () => {
    let resolveBanner!: () => void;
    const engine = new SlotEngine(new SeededRng(7), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    view.showBanner = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveBanner = resolve;
        }),
    );

    const controller = new GameController(engine, fsm, view, 0);
    controller.start();

    const demoPromise = controller.handleDemoBonus();
    // Spin 1 resolves synchronously in mock view, entering BONUS_INTRO banner await
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fsm.state).toBe('BONUS_INTRO');
    expect(view.stopAllFlags[view.stopAllFlags.length - 1]).toBe(true);

    // Clicking STOP ALL / RESET unconditionally cancels the bonus flow & resets balance
    controller.handleReset();
    resolveBanner();
    await demoPromise;

    expect(view.calls).toContain('abort');
    expect(fsm.state).toBe('IDLE');
    expect(engine.bonus.active).toBe(false);
    expect(engine.balance).toBe(1000);
    expect(view.stopAllFlags[view.stopAllFlags.length - 1]).toBe(false);
    // Only the initial trigger spin ran; all 8 free spins were aborted
    expect(view.calls.filter((c) => c.startsWith('spinReels:')).length).toBe(1);
  });

  it('allows handleReset (STOP ALL) to abort AUTO mode mid-spin and cleanly unlock controls', async () => {
    let resolveSpin!: () => void;
    const engine = new SlotEngine(new SeededRng(12), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    view.spinReels = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSpin = resolve;
        }),
    );

    const controller = new GameController(engine, fsm, view, 10);
    controller.start();
    controller.handleToggleAuto();
    await Promise.resolve();
    expect(view.stopAllFlags[view.stopAllFlags.length - 1]).toBe(true);
    expect(fsm.state).toBe('SPINNING');

    controller.handleReset();
    resolveSpin();
    await Promise.resolve();
    await Promise.resolve();

    expect(view.calls).toContain('abort');
    expect(view.calls).toContain('autoActive:false');
    expect(fsm.state).toBe('IDLE');
    expect(engine.balance).toBe(1000);
    expect(view.stopAllFlags[view.stopAllFlags.length - 1]).toBe(false);
    expect(view.hudLockedFlags[view.hudLockedFlags.length - 1]).toBe(false);
  });

  it('enforces UKGC mode by locking AUTO/TURBO and honoring minSpinMs floor', async () => {
    let clock = 0;
    const engine = new SlotEngine(new SeededRng(99), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    const controller = new GameController(engine, fsm, view, {
      delayMs: 0,
      ukgcMode: true,
      minSpinMs: 25,
      nowFn: () => clock,
    });

    controller.start();
    controller.handleToggleAuto();
    controller.handleToggleTurbo();
    expect(view.autoEnabledFlags[0]).toBe(false);
    expect(view.setTurboActive).not.toHaveBeenCalled();

    const start = Date.now();
    await controller.handleSpin();
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
    expect(fsm.state).toBe('IDLE');
  });

  it('triggers Reality Check banner after elapsed session minutes and recovers from RGS disconnect', async () => {
    let clock = 0;
    const engine = new SlotEngine(new SeededRng(99), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    const backend = new LocalSlotBackend(engine);
    const controller = new GameController(backend, fsm, view, {
      delayMs: 0,
      realityCheckMinutes: 15,
      nowFn: () => clock,
    });

    controller.start();
    clock = 15 * 60_000 + 100;
    await controller.handleSpin();
    expect(view.calls).toContain('banner:REALITY CHECK');

    // Simulate RGS transport failure on next spin
    vi.spyOn(backend, 'spin').mockRejectedValueOnce(new RgsTransportError('Network down', 'NETWORK', true));
    await controller.handleSpin();
    expect(view.calls).toContain('banner:CONNECTION LOST');
    expect(fsm.state).toBe('IDLE');
  });

  it('resets TURBO on handleReset and restores active bonus mood when resuming saved session', () => {
    const engine = new SlotEngine(new SeededRng(12), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    const controller = new GameController(engine, fsm, view, 0);

    controller.start();
    controller.handleToggleTurbo();
    expect(controller.isTurbo).toBe(true);

    controller.handleReset();
    expect(controller.isTurbo).toBe(false);
    expect(view.setTurboActive).toHaveBeenLastCalledWith(false);

    // Simulate reload with an active bonus saved in SlotEngine
    const restoredEngine = new SlotEngine(new SeededRng(12), 1000);
    restoredEngine.restoreState({
      balance: 880,
      bet: 20,
      bonus: {
        active: true,
        spinsRemaining: 5,
        spinsAwardedTotal: 8,
        multiplierIndex: 1,
        multiplier: 2,
        totalBonusWin: 40,
      },
    });
    const restoredFsm = new GameStateMachine('BOOT');
    const restoredView = createMockView();
    const restoredController = new GameController(restoredEngine, restoredFsm, restoredView, 0);
    restoredController.start(40);

    expect(restoredView.calls).toContain('mood:true');
    expect(restoredView.stopAllFlags[0]).toBe(true);
  });
});
