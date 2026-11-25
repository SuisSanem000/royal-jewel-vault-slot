import type { GameState } from './types';

const ALLOWED_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  BOOT: ['IDLE'],
  IDLE: ['SPINNING'],
  SPINNING: ['EVALUATING'],
  EVALUATING: ['IDLE', 'WIN_PRESENTATION', 'BONUS_INTRO', 'BONUS_ACTIVE', 'BONUS_OUTRO'],
  WIN_PRESENTATION: ['IDLE', 'BONUS_INTRO', 'BONUS_ACTIVE', 'BONUS_OUTRO'],
  BONUS_INTRO: ['BONUS_ACTIVE'],
  BONUS_ACTIVE: ['SPINNING', 'BONUS_OUTRO'],
  BONUS_OUTRO: ['IDLE'],
};

export type StateListener = (next: GameState, prev: GameState) => void;

export class GameStateMachine {
  private current: GameState;
  private readonly listeners = new Set<StateListener>();

  constructor(initial: GameState = 'BOOT') {
    this.current = initial;
  }

  get state(): GameState {
    return this.current;
  }

  canTransition(next: GameState): boolean {
    return ALLOWED_TRANSITIONS[this.current].includes(next);
  }

  transition(next: GameState): void {
    if (!this.canTransition(next)) {
      throw new Error(`Invalid state transition: ${this.current} -> ${next}`);
    }
    const prev = this.current;
    this.current = next;
    for (const listener of this.listeners) {
      listener(next, prev);
    }
  }

  /** Force-resets the machine to a known safe state (used when cancelling an active sequence). */
  reset(state: GameState = 'IDLE'): void {
    const prev = this.current;
    this.current = state;
    if (prev !== state) {
      for (const listener of this.listeners) {
        listener(state, prev);
      }
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
