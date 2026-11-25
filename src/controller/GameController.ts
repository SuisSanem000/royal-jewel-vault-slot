import { LocalSlotBackend, RgsTransportError, type GameBackend } from '../core/backend';
import { formatCredits, type FormatConfig } from '../core/format';
import { SlotEngine } from '../core/slotEngine';
import type { GameStateMachine } from '../core/stateMachine';
import type { BonusState, Grid, LineWin, ScatterWin, SpinResult } from '../core/types';

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

export interface ControllerOptions {
  delayMs?: number;
  ukgcMode?: boolean;
  minSpinMs?: number;
  realityCheckMinutes?: number;
  formatConfig?: FormatConfig;
  nowFn?: () => number;
}

export class GameController {
  private readonly backend: GameBackend;
  private readonly fsm: GameStateMachine;
  private readonly view: PresentationAdapter;
  private readonly delayMs: number;
  private readonly ukgcMode: boolean;
  private readonly minSpinMs: number;
  private readonly realityCheckMinutes: number;
  private readonly formatConfig: FormatConfig;
  private readonly nowFn: () => number;

  private autoSpin = false;
  private turbo = false;
  private quickStopped = false;
  private isBonusFlow = false;
  private lastWin = 0;
  private runId = 0;
  private sessionSpins = 0;
  private sessionStartMs: number;
  private lastRealityCheckMs: number;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseResolve: (() => void) | null = null;

  constructor(
    engineOrBackend: SlotEngine | GameBackend,
    fsm: GameStateMachine,
    view: PresentationAdapter,
    delayOrOptions: number | ControllerOptions = 450,
  ) {
    this.backend =
      engineOrBackend instanceof SlotEngine ? new LocalSlotBackend(engineOrBackend) : engineOrBackend;
    this.fsm = fsm;
    this.view = view;

    const opts: ControllerOptions =
      typeof delayOrOptions === 'number' ? { delayMs: delayOrOptions } : delayOrOptions;
    this.delayMs = opts.delayMs ?? 450;
    this.ukgcMode = opts.ukgcMode ?? false;
    this.minSpinMs = opts.minSpinMs ?? (this.ukgcMode ? 2500 : 0);
    this.realityCheckMinutes = opts.realityCheckMinutes ?? 0;
    this.formatConfig = opts.formatConfig ?? { locale: 'en-US' };
    this.nowFn = opts.nowFn ?? (() => Date.now());
    this.sessionStartMs = this.nowFn();
    this.lastRealityCheckMs = this.sessionStartMs;
  }

  get isIdle(): boolean {
    return this.fsm.state === 'IDLE' && !this.backend.bonus.active && !this.isBonusFlow && !this.autoSpin;
  }

  get isTurbo(): boolean {
    return this.turbo;
  }

  private get stopAllActive(): boolean {
    return this.autoSpin || this.isBonusFlow || this.backend.bonus.active;
  }

  private get controlsLocked(): boolean {
    return !this.isIdle;
  }

  private get autoControlEnabled(): boolean {
    if (this.ukgcMode) return false;
    return this.autoSpin || (this.isIdle && this.backend.canSpin());
  }

  start(): void {
    this.fsm.transition('IDLE');
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.backend.canSpin());
  }

  handleBetUp(): void {
    if (this.controlsLocked) return;
    this.view.playClick();
    this.backend.increaseBet();
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.backend.canSpin());
  }

  handleBetDown(): void {
    if (this.controlsLocked) return;
    this.view.playClick();
    this.backend.decreaseBet();
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.backend.canSpin());
  }

  handleRefill(): void {
    if (this.controlsLocked) return;
    this.view.playClick();
    this.backend.refillCredits();
    this.lastWin = 0;
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.backend.canSpin());
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
    this.backend.reset();
    this.fsm.reset('IDLE');
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.backend.canSpin());
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
    if (this.ukgcMode) return;
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
    if (this.ukgcMode) return;
    this.view.playClick();
    this.turbo = !this.turbo;
    this.view.setTurboActive(this.turbo);
  }

  async handleDemoBonus(): Promise<void> {
    if (this.controlsLocked || !this.backend.canSpin()) return;

    const token = this.runId;
    this.clearAutoTimer();
    this.isBonusFlow = true;
    await this.executeSpin({ forceBonus: true, token });
    if (token !== this.runId) return;
    this.scheduleNextAutoSpin(token);
  }

  async handleSpin(): Promise<void> {
    if (this.fsm.state === 'SPINNING') {
      if (!this.quickStopped && !this.ukgcMode) {
        this.quickStopped = true;
        this.view.setSpinButton('STOP', false);
        this.view.quickStopReels();
      }
      return;
    }

    if (this.fsm.state !== 'IDLE') return;
    if (!this.backend.canSpin()) {
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
    if (this.ukgcMode || token !== this.runId || !this.autoSpin || this.fsm.state !== 'IDLE') return;
    if (!this.backend.canSpin()) {
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

  private async maybeShowRealityCheck(token: number): Promise<void> {
    if (this.realityCheckMinutes <= 0 || token !== this.runId) return;
    const now = this.nowFn();
    const elapsedSinceCheck = now - this.lastRealityCheckMs;
    if (elapsedSinceCheck < this.realityCheckMinutes * 60_000) return;

    this.lastRealityCheckMs = now;
    const totalMinutes = Math.max(1, Math.round((now - this.sessionStartMs) / 60_000));
    await this.view.showBanner(
      'REALITY CHECK',
      `Session Time: ${totalMinutes} min | Spins Played: ${this.sessionSpins}\nBalance: ${formatCredits(this.backend.balance, this.formatConfig)}`,
      2400,
    );
  }

  private async executeSpin(options: { forceBonus?: boolean; token?: number } = {}): Promise<void> {
    const token = options.token ?? this.runId;
    if (token !== this.runId) return;

    const isFreeSpin = this.backend.bonus.active;
    const preSpinBonus = this.backend.bonus;
    const spinStartedAt = this.nowFn();
    this.quickStopped = false;
    this.fsm.transition('SPINNING');
    this.view.clearWins();
    this.view.playSpin();
    this.view.setSpinButton('STOP', !this.ukgcMode);
    this.view.updateHud(
      this.backend.balance,
      this.backend.bet,
      0,
      preSpinBonus,
      true,
      this.stopAllActive,
      this.autoSpin && !this.ukgcMode,
    );

    let result: SpinResult;
    try {
      result = await this.backend.spin(options);
    } catch (err) {
      if (token !== this.runId) return;
      this.autoSpin = false;
      this.isBonusFlow = false;
      this.view.setAutoActive(false);
      this.fsm.reset('IDLE');
      this.syncHud(this.lastWin);
      this.view.setSpinButton('SPIN', this.backend.canSpin());
      const msg =
        err instanceof RgsTransportError
          ? `${err.message}\nPlease check your connection and try again.`
          : 'Connection error. Please try again.';
      await this.view.showBanner('CONNECTION LOST', msg, 2200);
      return;
    }

    if (token !== this.runId) return;

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
      this.autoSpin && !this.ukgcMode,
    );

    const useTurbo = !this.ukgcMode && (this.turbo || (isFreeSpin && this.autoSpin));
    await this.view.spinReels(result.grid, useTurbo);
    if (token !== this.runId) return;

    // Enforce regulatory minimum spin duration floor (e.g., UKGC 2500ms)
    if (this.minSpinMs > 0 && (!this.quickStopped || this.ukgcMode)) {
      const elapsed = this.nowFn() - spinStartedAt;
      const remaining = this.minSpinMs - elapsed;
      if (remaining > 0) {
        await this.pause(remaining);
        if (token !== this.runId) return;
      }
    }

    this.sessionSpins++;
    this.fsm.transition('EVALUATING');
    this.view.setSpinButton(isFreeSpin ? 'BONUS' : 'SPIN', false);

    if (result.totalWin > 0) {
      this.fsm.transition('WIN_PRESENTATION');
      this.view.updateHud(
        result.balanceAfter,
        result.bet,
        result.totalWin,
        result.bonusState,
        true,
        this.stopAllActive || result.triggeredBonus,
        this.autoSpin && !result.triggeredBonus && !this.ukgcMode,
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
        this.autoSpin && !result.triggeredBonus && !this.ukgcMode,
      );
    }

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
      this.view.setSpinButton('SPIN', this.backend.canSpin());
      await this.maybeShowRealityCheck(token);
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
      `Total Bonus Win: ${formatCredits(totalBonusWin, this.formatConfig)}`,
      1800,
    );
    if (token !== this.runId) return;

    this.backend.finishBonus();
    this.isBonusFlow = false;
    this.lastWin = totalBonusWin;
    this.view.setBonusMood(false);
    this.view.clearWins();
    this.fsm.transition('IDLE');
    this.syncHud(totalBonusWin);
    this.view.setSpinButton('SPIN', this.backend.canSpin());
    await this.maybeShowRealityCheck(token);
  }

  private syncHud(winAmount: number): void {
    this.view.updateHud(
      this.backend.balance,
      this.backend.bet,
      winAmount,
      this.backend.bonus,
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
