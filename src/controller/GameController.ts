import type { SlotEngine } from '../core/slotEngine';
import type { GameStateMachine } from '../core/stateMachine';
import type { BonusState, Grid, LineWin, ScatterWin } from '../core/types';

export interface PresentationAdapter {
  updateHud(
    balance: number,
    bet: number,
    win: number,
    bonus: BonusState,
    controlsLocked: boolean,
    stopAllActive: boolean,
    autoControlEnabled: boolean,
  ): void;
  setSpinButton(label: string, enabled: boolean): void;
  setAutoActive(active: boolean): void;
  setTurboActive(active: boolean): void;
  setBonusMood(active: boolean): void;
  spinReels(grid: Grid, turbo: boolean): Promise<void>;
  quickStopReels(): void;
  showWins(lineWins: LineWin[], scatterWin: ScatterWin | null, totalWin: number, bet: number): Promise<void>;
  clearWins(): void;
  showBanner(title: string, subtitle: string, durationMs?: number): Promise<void>;
  abortPresentation(): void;
  playClick(): void;
  playSpin(): void;
  playBonusTrigger(): void;
}

export class GameController {
  private readonly engine: SlotEngine;
  private readonly fsm: GameStateMachine;
  private readonly view: PresentationAdapter;
  private autoSpin = false;
  private turbo = false;
  private quickStopped = false;
  private isBonusFlow = false;
  private lastWin = 0;
  private runId = 0;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseResolve: (() => void) | null = null;
  private readonly delayMs: number;

  constructor(
    engine: SlotEngine,
    fsm: GameStateMachine,
    view: PresentationAdapter,
    delayMs = 450,
  ) {
    this.engine = engine;
    this.fsm = fsm;
    this.view = view;
    this.delayMs = delayMs;
  }

  get isIdle(): boolean {
    return this.fsm.state === 'IDLE' && !this.engine.bonus.active && !this.isBonusFlow && !this.autoSpin;
  }

  private get stopAllActive(): boolean {
    return this.autoSpin || this.isBonusFlow || this.engine.bonus.active;
  }

  private get controlsLocked(): boolean {
    return !this.isIdle;
  }

  private get autoControlEnabled(): boolean {
    return this.autoSpin || (this.isIdle && this.engine.canSpin());
  }

  start(): void {
    this.fsm.transition('IDLE');
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleBetUp(): void {
    if (this.controlsLocked) return;
    this.view.playClick();
    this.engine.increaseBet();
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleBetDown(): void {
    if (this.controlsLocked) return;
    this.view.playClick();
    this.engine.decreaseBet();
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleRefill(): void {
    if (this.controlsLocked) return;
    this.view.playClick();
    this.engine.refillCredits();
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  /** Unconditionally stops all active spins, auto-spins, bonus rounds, and timers, then resets state. */
  handleReset(): void {
    this.runId++;
    this.clearAutoTimer();
    this.clearPause();
    this.autoSpin = false;
    this.isBonusFlow = false;
    this.quickStopped = false;
    this.lastWin = 0;

    this.view.playClick();
    this.view.setAutoActive(false);
    this.view.abortPresentation();
    this.engine.reset();
    this.fsm.reset('IDLE');
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  stopAutoSpin(): void {
    this.clearAutoTimer();
    if (this.autoSpin) {
      this.autoSpin = false;
      this.view.setAutoActive(false);
      if (this.fsm.state === 'IDLE') {
        this.syncHud(this.lastWin);
      }
    }
  }

  handleToggleAuto(): void {
    if (!this.autoSpin && !this.autoControlEnabled) return;

    this.view.playClick();
    if (this.autoSpin) {
      this.stopAutoSpin();
      return;
    }

    this.autoSpin = true;
    this.view.setAutoActive(true);
    this.clearAutoTimer();
    this.syncHud(this.lastWin);
    if (this.fsm.state === 'IDLE') {
      void this.handleSpin();
    }
  }

  handleToggleTurbo(): void {
    this.view.playClick();
    this.turbo = !this.turbo;
    this.view.setTurboActive(this.turbo);
  }

  async handleDemoBonus(): Promise<void> {
    if (this.controlsLocked || !this.engine.canSpin()) return;

    const token = this.runId;
    this.clearAutoTimer();
    this.isBonusFlow = true;
    await this.executeSpin({ forceBonus: true, token });
    if (token !== this.runId) return;
    this.scheduleNextAutoSpin(token);
  }

  async handleSpin(): Promise<void> {
    if (this.fsm.state === 'SPINNING') {
      if (!this.quickStopped) {
        this.quickStopped = true;
        this.view.setSpinButton('STOP', false);
        this.view.quickStopReels();
      }
      return;
    }

    if (this.fsm.state !== 'IDLE') return;
    if (!this.engine.canSpin()) {
      this.stopAutoSpin();
      return;
    }

    const token = this.runId;
    this.clearAutoTimer();
    await this.executeSpin({ token });
    if (token !== this.runId) return;
    this.scheduleNextAutoSpin(token);
  }

  private scheduleNextAutoSpin(token: number): void {
    this.clearAutoTimer();
    if (token !== this.runId || !this.autoSpin || this.fsm.state !== 'IDLE') return;
    if (!this.engine.canSpin()) {
      this.stopAutoSpin();
      return;
    }
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      if (token === this.runId && this.autoSpin && this.fsm.state === 'IDLE') {
        void this.handleSpin();
      }
    }, this.delayMs);
  }

  private clearAutoTimer(): void {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  private clearPause(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    if (this.pauseResolve) {
      const resolve = this.pauseResolve;
      this.pauseResolve = null;
      resolve();
    }
  }

  private async executeSpin(options: { forceBonus?: boolean; token?: number } = {}): Promise<void> {
    const token = options.token ?? this.runId;
    if (token !== this.runId) return;

    const isFreeSpin = this.engine.bonus.active;
    const preSpinBonus = this.engine.bonus;
    this.quickStopped = false;
    this.fsm.transition('SPINNING');
    this.view.clearWins();
    this.view.playSpin();
    this.view.setSpinButton('STOP', true);

    const result = this.engine.spin(options);

    // Update balance immediately when bet is placed, without spoiling bonus state before reels land
    const balanceBeforeWin = Math.round((result.balanceAfter - result.totalWin) * 100) / 100;
    const spinningBonusView: BonusState = isFreeSpin
      ? { ...preSpinBonus, spinsRemaining: Math.max(0, preSpinBonus.spinsRemaining - 1) }
      : preSpinBonus;
    this.view.updateHud(
      balanceBeforeWin,
      result.bet,
      0,
      spinningBonusView,
      true,
      this.stopAllActive,
      this.autoSpin,
    );

    await this.view.spinReels(result.grid, this.turbo || (isFreeSpin && this.autoSpin));
    if (token !== this.runId) return;

    this.fsm.transition('EVALUATING');
    this.view.setSpinButton(isFreeSpin ? 'BONUS' : 'SPIN', false);

    // Present wins if any
    if (result.totalWin > 0) {
      this.fsm.transition('WIN_PRESENTATION');
      this.view.updateHud(
        result.balanceAfter,
        result.bet,
        result.totalWin,
        result.bonusState,
        true,
        this.stopAllActive || result.triggeredBonus,
        this.autoSpin && !result.triggeredBonus,
      );
      await this.view.showWins(result.lineWins, result.scatterWin, result.totalWin, result.bet);
      if (token !== this.runId) return;
    } else {
      this.view.updateHud(
        result.balanceAfter,
        result.bet,
        0,
        result.bonusState,
        true,
        this.stopAllActive || result.triggeredBonus,
        this.autoSpin && !result.triggeredBonus,
      );
    }

    // Handle bonus trigger, bonus progression, or return to idle
    if (result.triggeredBonus) {
      this.isBonusFlow = true;
      await this.runBonusRound(result.bonusState, token);
    } else if (isFreeSpin) {
      if (result.retriggeredFreeSpins > 0) {
        this.view.playBonusTrigger();
        await this.view.showBanner(
          'RE-TRIGGER!',
          `+${result.retriggeredFreeSpins} EXTRA FREE SPINS`,
          1200,
        );
        if (token !== this.runId) return;
      }

      if (result.bonusCompleted) {
        await this.finishBonusRound(result.bonusState.totalBonusWin, token);
      } else {
        this.fsm.transition('BONUS_ACTIVE');
        this.lastWin = result.totalWin;
        this.syncHud(result.totalWin);
        await this.pause(this.delayMs);
        if (token !== this.runId) return;
        await this.executeSpin({ token });
      }
    } else {
      this.isBonusFlow = false;
      this.lastWin = result.totalWin;
      this.fsm.transition('IDLE');
      this.syncHud(result.totalWin);
      this.view.setSpinButton('SPIN', this.engine.canSpin());
    }
  }

  private async runBonusRound(bonus: BonusState, token: number): Promise<void> {
    if (token !== this.runId) return;
    this.fsm.transition('BONUS_INTRO');
    this.view.playBonusTrigger();
    this.view.setBonusMood(true);
    this.syncHud(0);
    await this.view.showBanner(
      'ROYAL FREE SPINS!',
      `${bonus.spinsAwardedTotal} Free Spins Awarded\nWinning Spins Boost Multiplier: 1x → 2x → 3x → 5x`,
      1700,
    );
    if (token !== this.runId) return;

    this.fsm.transition('BONUS_ACTIVE');
    this.syncHud(0);
    await this.pause(this.delayMs);
    if (token !== this.runId) return;
    await this.executeSpin({ token });
  }

  private async finishBonusRound(totalBonusWin: number, token: number): Promise<void> {
    if (token !== this.runId) return;
    this.fsm.transition('BONUS_OUTRO');
    await this.view.showBanner(
      'BONUS COMPLETE!',
      `Total Bonus Win: ${totalBonusWin.toFixed(2)}`,
      1800,
    );
    if (token !== this.runId) return;

    this.engine.finishBonus();
    this.isBonusFlow = false;
    this.lastWin = totalBonusWin;
    this.view.setBonusMood(false);
    this.view.clearWins();
    this.fsm.transition('IDLE');
    this.syncHud(totalBonusWin);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  private syncHud(winAmount: number): void {
    this.view.updateHud(
      this.engine.balance,
      this.engine.bet,
      winAmount,
      this.engine.bonus,
      this.controlsLocked,
      this.stopAllActive,
      this.autoControlEnabled,
    );
  }

  private pause(ms: number): Promise<void> {
    this.clearPause();
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.pauseResolve = resolve;
      this.pauseTimer = setTimeout(() => {
        this.pauseTimer = null;
        this.pauseResolve = null;
        resolve();
      }, ms);
    });
  }
}
