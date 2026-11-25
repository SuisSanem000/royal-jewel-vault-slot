import { describe, expect, it, vi } from 'vitest';
import { GameController, type PresentationAdapter } from '../../src/controller/GameController';
import { SeededRng } from '../../src/core/rng';
import { SlotEngine } from '../../src/core/slotEngine';
import { GameStateMachine } from '../../src/core/stateMachine';

function createMockView(): PresentationAdapter & { calls: string[]; hudBonuses: boolean[] } {
  const calls: string[] = [];
  const hudBonuses: boolean[] = [];
  return {
    calls,
    hudBonuses,
    updateHud: vi.fn((_bal, _bet, _win, bonus) => {
      hudBonuses.push(bonus.active);
    }),
    setSpinButton: vi.fn(),
    setAutoActive: vi.fn(),
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

  it('triggers Royal Free Spins without spoiling bonus HUD before reels land, and returns to IDLE', async () => {
    const engine = new SlotEngine(new SeededRng(7), 1000);
    const fsm = new GameStateMachine('BOOT');
    const view = createMockView();
    const controller = new GameController(engine, fsm, view, 0);

    controller.start();
    await controller.handleSpin(true); // forceBonus trigger

    // hudBonuses[0] = start(), hudBonuses[1] = during initial spinReels() (must be false!)
    expect(view.hudBonuses[1]).toBe(false);
    expect(fsm.state).toBe('IDLE');
    expect(engine.bonus.active).toBe(false);
    expect(view.calls).toContain('mood:true');
    expect(view.calls).toContain('banner:ROYAL FREE SPINS!');
    expect(view.calls).toContain('banner:BONUS COMPLETE!');
    expect(view.calls).toContain('mood:false');
    // 1 base trigger spin + at least 8 free spins
    expect(view.calls.filter((c) => c.startsWith('spinReels:')).length).toBeGreaterThanOrEqual(9);
  });
});
