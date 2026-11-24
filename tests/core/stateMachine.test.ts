import { describe, expect, it, vi } from 'vitest';
import { GameStateMachine } from '../../src/core/stateMachine';

describe('GameStateMachine', () => {
  it('allows valid base and bonus lifecycle transitions', () => {
    const fsm = new GameStateMachine('BOOT');
    const listener = vi.fn();
    fsm.subscribe(listener);

    fsm.transition('IDLE');
    fsm.transition('SPINNING');
    fsm.transition('EVALUATING');
    fsm.transition('BONUS_INTRO');
    fsm.transition('BONUS_ACTIVE');
    fsm.transition('SPINNING');
    fsm.transition('EVALUATING');
    fsm.transition('BONUS_OUTRO');
    fsm.transition('IDLE');

    expect(fsm.state).toBe('IDLE');
    expect(listener).toHaveBeenCalledTimes(9);
  });

  it('rejects invalid transitions', () => {
    const fsm = new GameStateMachine('IDLE');
    expect(() => fsm.transition('BONUS_ACTIVE')).toThrow(/Invalid state transition/);
    expect(fsm.state).toBe('IDLE');
  });
});
