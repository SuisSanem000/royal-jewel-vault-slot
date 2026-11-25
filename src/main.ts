import { GameController, type PresentationAdapter } from './controller/GameController';
import { REEL_COUNT, REEL_STRIPS, ROW_COUNT } from './core/config';
import { SlotEngine } from './core/slotEngine';
import { GameStateMachine } from './core/stateMachine';
import type { Grid } from './core/types';
import { loadGameTextures } from './presentation/assets';
import { SoundManager } from './presentation/audio';
import { ReelGridView } from './presentation/reels/ReelGridView';
import { SlotStage, STAGE_HEIGHT, STAGE_WIDTH } from './presentation/SlotStage';
import { HudView } from './presentation/ui/HudView';
import { BonusHeaderBar, ModalBanner, PaytableModal } from './presentation/ui/Overlays';

function initialDisplayGrid(): Grid {
  return Array.from({ length: REEL_COUNT }, (_, col) =>
    Array.from({ length: ROW_COUNT }, (_, row) => REEL_STRIPS[col][row]),
  );
}

async function bootstrap(): Promise<void> {
  const mountEl = document.getElementById('app');
  if (!mountEl) throw new Error('Missing #app mount element');

  const stage = new SlotStage();
  await stage.init(mountEl);

  const loadingText = stage.showLoading();
  const textures = await loadGameTextures();
  loadingText.destroy();

  const sound = new SoundManager();
  const engine = new SlotEngine();
  const fsm = new GameStateMachine('BOOT');

  const reels = new ReelGridView(textures, initialDisplayGrid());
  reels.position.set((STAGE_WIDTH - reels.gridWidth) / 2, 118);

  const bonusBar = new BonusHeaderBar();
  bonusBar.position.set((STAGE_WIDTH - 780) / 2, 56);

  const banner = new ModalBanner(STAGE_WIDTH, STAGE_HEIGHT);
  const paytable = new PaytableModal(STAGE_WIDTH, STAGE_HEIGHT, textures);

  let controller!: GameController;

  const hud = new HudView({
    onSpin: () => void controller.handleSpin(),
    onBetUp: () => controller.handleBetUp(),
    onBetDown: () => controller.handleBetDown(),
    onToggleAuto: () => controller.handleToggleAuto(),
    onToggleTurbo: () => controller.handleToggleTurbo(),
    onToggleMute: () => {
      const muted = sound.toggleMute();
      hud.setMuted(muted);
    },
    onTogglePaytable: () => {
      sound.playClick();
      paytable.toggle();
    },
    onDemoBonus: () => void controller.handleSpin(true),
    onRefill: () => controller.handleRefill(),
    onReset: () => controller.handleReset(),
  });
  hud.position.set((STAGE_WIDTH - 1180) / 2, STAGE_HEIGHT - 114);

  stage.root.addChild(reels, bonusBar, hud, banner, paytable);

  stage.app.ticker.add((ticker) => {
    reels.update(ticker.deltaMS / 1000);
  });

  const adapter: PresentationAdapter = {
    updateHud(balance, bet, win, bonus) {
      hud.setBalance(balance, balance < bet && !bonus.active);
      hud.setBet(bet, bonus.active);
      hud.setWin(win, win > 0);
      bonusBar.updateBonus(bonus);
    },
    setSpinButton: (label, enabled) => hud.setSpinLabel(label, enabled),
    setAutoActive: (active) => hud.setAutoActive(active),
    setTurboActive: (active) => hud.setTurboActive(active),
    setBonusMood: (active) => stage.setBonusMood(active),
    spinReels: (grid, turbo) => reels.spinTo(grid, turbo, (col) => sound.playReelStop(col)),
    quickStopReels: () => reels.quickStop((col) => sound.playReelStop(col)),
    async showWins(lineWins, scatterWin, totalWin, bet) {
      reels.showWins(lineWins, scatterWin);
      sound.playWin();
      stage.spawnWinSparkles(totalWin >= bet * 10 ? 40 : 20);
      if (totalWin >= bet * 10) {
        const tier = totalWin >= bet * 25 ? 'MEGA WIN!' : 'BIG WIN!';
        await banner.show(tier, `+${totalWin.toFixed(2)} CREDITS`, 1400);
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }
    },
    clearWins: () => reels.clearHighlights(),
    showBanner: (title, subtitle, ms) => banner.show(title, subtitle, ms),
    playClick: () => sound.playClick(),
    playSpin: () => sound.playSpin(),
    playBonusTrigger: () => sound.playBonusTrigger(),
  };

  controller = new GameController(engine, fsm, adapter);
  controller.start();

  window.addEventListener('keydown', (e) => {
    if (paytable.visible && (e.code === 'Space' || e.code === 'Escape')) {
      e.preventDefault();
      paytable.visible = false;
      return;
    }
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      void controller.handleSpin();
    }
  });
}

void bootstrap();
