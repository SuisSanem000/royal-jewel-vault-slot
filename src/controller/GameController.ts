import type { SlotEngine } from '../core/slotEngine';
import type { GameStateMachine } from '../core/stateMachine';
import type { BonusState, Grid, LineWin, ScatterWin } from '../core/types';

export interface PresentationAdapter {
  updateHud(balance: number, bet: number, win: number, bonus: BonusState, canSpin: boolean): void;
  setSpinButton(label: string, enabled: boolean): void;
  setAutoActive(active: boolean): void;
  setBonusMood(active: boolean): void;
  spinReels(grid: Grid, turbo: boolean): Promise<void>;
  quickStopReels(): void;
  showWins(lineWins: LineWin[], scatterWin: ScatterWin | null, totalWin: number, bet: number): Promise<void>;
  clearWins(): void;
  showBanner(title: string, subtitle: string, durationMs?: number): Promise<void>;
  playClick(): void;
  playSpin(): void;
  playBonusTrigger(): void;
}

export class GameController {
  private readonly engine: SlotEngine;
  private readonly fsm: GameStateMachine;
  private readonly view: PresentationAdapter;
  private autoSpin = false;
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

  start(): void {
    this.fsm.transition('IDLE');
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleBetUp(): void {
    if (this.fsm.state !== 'IDLE' || this.engine.bonus.active) return;
    this.view.playClick();
    this.engine.increaseBet();
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleBetDown(): void {
    if (this.fsm.state !== 'IDLE' || this.engine.bonus.active) return;
    this.view.playClick();
    this.engine.decreaseBet();
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleRefill(): void {
    if (this.fsm.state !== 'IDLE') return;
    this.view.playClick();
    this.engine.refillCredits();
    this.syncHud(0);
    this.view.setSpinButton('SPIN', this.engine.canSpin());
  }

  handleToggleAuto(): void {
    this.view.playClick();
    this.autoSpin = !this.autoSpin;
    this.view.setAutoActive(this.autoSpin);
    if (this.autoSpin && this.fsm.state === 'IDLE') {
      void this.handleSpin();
    }
  }

  async handleSpin(forceBonus = false): Promise<void> {
    if (this.fsm.state === 'SPINNING') {
      this.view.quickStopReels();
      return;
    }

    if (this.fsm.state !== 'IDLE') return;
    if (!this.engine.canSpin()) {
      this.autoSpin = false;
      this.view.setAutoActive(false);
      return;
    }

    await this.executeSpin({ forceBonus });

    if (this.autoSpin && this.fsm.state === 'IDLE' && this.engine.canSpin()) {
      await this.pause(this.delayMs);
      if (this.autoSpin && this.fsm.state === 'IDLE') {
        void this.handleSpin();
      }
    }
  }

  private async executeSpin(options: { forceBonus?: boolean } = {}): Promise<void> {
    const isFreeSpin = this.engine.bonus.active;
    this.fsm.transition('SPINNING');
    this.view.clearWins();
    this.view.playSpin();
    this.view.setSpinButton('STOP', true);

    const result = this.engine.spin(options);

    // Update balance immediately when bet is placed (before win payout displays)
    const balanceBeforeWin = Math.round((result.balanceAfter - result.totalWin) * 100) / 100;
    this.view.updateHud(balanceBeforeWin, result.bet, 0, result.bonusState, false);

    await this.view.spinReels(result.grid, isFreeSpin && this.autoSpin);
    this.fsm.transition('EVALUATING');
    this.view.setSpinButton(isFreeSpin ? 'BONUS' : 'SPIN', false);

    // Present wins if any
    if (result.totalWin > 0) {
      this.fsm.transition('WIN_PRESENTATION');
      this.view.updateHud(result.balanceAfter, result.bet, result.totalWin, result.bonusState, false);
      await this.view.showWins(result.lineWins, result.scatterWin, result.totalWin, result.bet);
    } else {
      this.view.updateHud(result.balanceAfter, result.bet, 0, result.bonusState, false);
    }

    // Handle bonus trigger, bonus progression, or return to idle
    if (result.triggeredBonus) {
      await this.runBonusRound(result.bonusState);
    } else if (isFreeSpin) {
      if (result.retriggeredFreeSpins > 0) {
        this.view.playBonusTrigger();
        await this.view.showBanner(
          'RE-TRIGGER!',
          `+${result.retriggeredFreeSpins} EXTRA FREE SPINS`,
          1200,
        );
      }

      if (result.bonusCompleted) {
        await this.finishBonusRound(result.bonusState.totalBonusWin);
      } else {
        this.fsm.transition('BONUS_ACTIVE');
        await this.pause(this.delayMs);
        await this.executeSpin();
      }
    } else {
      this.fsm.transition('IDLE');
      this.syncHud(result.totalWin);
      this.view.setSpinButton('SPIN', this.engine.canSpin());
    }
  }

  private async runBonusRound(bonus: BonusState): Promise<void> {
    this.fsm.transition('BONUS_INTRO');
    this.view.playBonusTrigger();
    this.view.setBonusMood(true);
    await this.view.showBanner(
      'ROYAL FREE SPINS!',
      `${bonus.spinsAwardedTotal} Free Spins Awarded\nWins boost Multiplier: 1x → 2x → 3x → 5x`,
      1700,
    );

    this.fsm.transition('BONUS_ACTIVE');
    this.syncHud(0);
    await this.pause(this.delayMs);
    await this.executeSpin();
  }

  private async finishBonusRound(totalBonusWin: number): Promise<void> {
    this.fsm.transition('BONUS_OUTRO');
    await this.view.showBanner(
      'BONUS COMPLETE!',
      `Total Bonus Win: ${totalBonusWin.toFixed(2)}`,
      1800,
    );

    this.engine.finishBonus();
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
      this.engine.canSpin(),
    );
  }

  private pause(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, ms));
  }
}
