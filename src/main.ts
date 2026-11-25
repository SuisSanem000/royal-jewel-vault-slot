import { GameController, type PresentationAdapter } from './controller/GameController';
import { LocalSlotBackend, RgsSlotBackend } from './core/backend';
import { REEL_COUNT, REEL_STRIPS, ROW_COUNT } from './core/config';
import { formatCredits, parseLaunchConfig } from './core/format';
import { SlotEngine } from './core/slotEngine';
import { GameStateMachine } from './core/stateMachine';
import { gameTimers } from './core/timers';
import type { Grid } from './core/types';
import { loadGameTextures } from './presentation/assets';
import { SoundManager } from './presentation/audio';
import { ReelGridView } from './presentation/reels/ReelGridView';
import { SlotStage, STAGE_HEIGHT, STAGE_WIDTH } from './presentation/SlotStage';
import { loadPreferences, savePreferences } from './presentation/storage';
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

  const launch = parseLaunchConfig(window.location.search);
  const savedPrefs = loadPreferences();

  const stage = new SlotStage();
  await stage.init(mountEl);

  const loadingIndicator = stage.showLoading();
  const textures = await loadGameTextures((progress) => loadingIndicator.updateProgress(progress));
  loadingIndicator.destroy();

  const sound = new SoundManager();
  if (savedPrefs.muted !== undefined) {
    sound.setMuted(savedPrefs.muted);
  }

  const engine = new SlotEngine();
  if (savedPrefs.bet !== undefined) {
    engine.setBet(savedPrefs.bet);
  }
  const backend = launch.rgsUrl
    ? new RgsSlotBackend(engine, { endpointUrl: launch.rgsUrl })
    : new LocalSlotBackend(engine);

  const fsm = new GameStateMachine('BOOT');

  const reels = new ReelGridView(textures, initialDisplayGrid());
  stage.onReducedMotionChange((reduced) => reels.setReducedMotion(reduced));

  const bonusBar = new BonusHeaderBar(launch.format);
  const banner = new ModalBanner(STAGE_WIDTH, STAGE_HEIGHT);
  const paytable = new PaytableModal(STAGE_WIDTH, STAGE_HEIGHT, textures, launch.format);

  let controller!: GameController;

  const fullscreenSupported =
    typeof document !== 'undefined' &&
    Boolean(
      document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled,
    );

  const persistPrefs = () => {
    savePreferences({
      muted: sound.muted,
      turbo: controller.isTurbo,
      bet: backend.bet,
    });
  };

  const toggleFullscreen = async () => {
    if (!fullscreenSupported) return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Ignore fullscreen denial
    }
  };

  const hud = new HudView(
    {
      onSpin: () => {
        if (paytable.visible) {
          paytable.visible = false;
          return;
        }
        void controller.handleSpin();
      },
      onBetUp: () => {
        controller.handleBetUp();
        persistPrefs();
      },
      onBetDown: () => {
        controller.handleBetDown();
        persistPrefs();
      },
      onToggleAuto: () => {
        paytable.visible = false;
        controller.handleToggleAuto();
      },
      onToggleTurbo: () => {
        controller.handleToggleTurbo();
        persistPrefs();
      },
      onToggleMute: () => {
        const muted = sound.toggleMute();
        hud.setMuted(muted);
        persistPrefs();
      },
      onTogglePaytable: () => {
        if (!paytable.visible && !controller.isIdle) return;
        controller.stopAutoSpin();
        sound.playClick();
        paytable.updatePayouts(backend.bet);
        paytable.toggle();
      },
      onDemoBonus: () => {
        paytable.visible = false;
        void controller.handleDemoBonus();
      },
      onRefill: () => controller.handleRefill(),
      onReset: () => {
        paytable.visible = false;
        controller.handleReset();
        persistPrefs();
      },
      onToggleFullscreen: () => void toggleFullscreen(),
    },
    { format: launch.format, fullscreenSupported },
  );

  hud.setMuted(sound.muted);
  hud.setComplianceMode({ disableTurbo: launch.ukgcMode });

  // Render HUD above ModalBanner so STOP ALL / RESET stays clickable during win & bonus banners
  stage.root.addChild(reels, bonusBar, banner, hud, paytable);

  stage.onLayoutChange((layout) => {
    reels.position.set((layout.virtualWidth - reels.gridWidth) / 2, layout.isPortrait ? 150 : 120);
    bonusBar.position.set((layout.virtualWidth - 780) / 2, layout.isPortrait ? 72 : 48);
    hud.setLayout(layout.isPortrait);
    hud.position.set(
      layout.isPortrait ? (layout.virtualWidth - 780) / 2 : (layout.virtualWidth - 1180) / 2,
      layout.isPortrait ? 662 : layout.virtualHeight - 112,
    );
    banner.setViewport(layout.virtualWidth, layout.virtualHeight);
    paytable.setViewport(layout.virtualWidth, layout.virtualHeight);
  });

  stage.app.ticker.add((ticker) => {
    reels.update(ticker.deltaMS / 1000);
  });

  let winWaitTimer: number | null = null;
  let winWaitResolve: (() => void) | null = null;

  const clearWinWait = () => {
    if (winWaitTimer) {
      gameTimers.clear(winWaitTimer);
      winWaitTimer = null;
    }
    if (winWaitResolve) {
      const res = winWaitResolve;
      winWaitResolve = null;
      res();
    }
  };

  const adapter: PresentationAdapter = {
    updateHud(balance, bet, win, bonus, controlsLocked, stopAllActive, autoControlEnabled) {
      hud.setBalance(balance, !controlsLocked && !bonus.active && balance < bet);
      hud.setControlsLocked(bet, controlsLocked || bonus.active, bonus.active || balance >= bet);
      hud.setStopAllMode(stopAllActive);
      hud.setAutoEnabled(autoControlEnabled);
      hud.setWin(win, win > 0);
      paytable.updatePayouts(bet);
      bonusBar.updateBonus(bonus);
    },
    setSpinButton: (label, enabled) => hud.setSpinLabel(label, enabled),
    setAutoActive: (active) => hud.setAutoActive(active),
    setTurboActive: (active) => hud.setTurboActive(active),
    setBonusMood: (active) => stage.setBonusMood(active),
    spinReels: (grid, turbo) => reels.spinTo(grid, turbo, (col) => sound.playReelStop(col)),
    quickStopReels: () => reels.quickStop((col) => sound.playReelStop(col)),
    async showWins(lineWins, scatterWin, totalWin, bet, turbo) {
      reels.showWins(lineWins, scatterWin);
      sound.playWin();
      stage.spawnWinSparkles(totalWin >= bet * 10 ? 40 : 20);
      if (totalWin >= bet * 10) {
        const tier = totalWin >= bet * 25 ? 'MEGA WIN!' : 'BIG WIN!';
        await banner.show(tier, `+${formatCredits(totalWin, launch.format)}`, turbo ? 750 : 1400);
      } else {
        clearWinWait();
        await new Promise<void>((resolve) => {
          winWaitResolve = resolve;
          winWaitTimer = gameTimers.set(() => {
            winWaitTimer = null;
            winWaitResolve = null;
            resolve();
          }, turbo ? 350 : 900);
        });
      }
    },
    clearWins: () => reels.clearHighlights(),
    showBanner: (title, subtitle, ms) => banner.show(title, subtitle, ms),
    abortPresentation() {
      clearWinWait();
      banner.hideImmediate();
      paytable.visible = false;
      reels.forceStop(initialDisplayGrid());
      stage.setBonusMood(false);
      hud.setWin(0, false);
    },
    playClick: () => sound.playClick(),
    playSpin: () => sound.playSpin(),
    playBonusTrigger: () => sound.playBonusTrigger(),
  };

  controller = new GameController(backend, fsm, adapter, {
    ukgcMode: launch.ukgcMode,
    minSpinMs: launch.minSpinMs,
    realityCheckMinutes: launch.realityCheckMinutes,
    formatConfig: launch.format,
  });

  if (savedPrefs.turbo && !launch.ukgcMode) {
    controller.handleToggleTurbo();
  }

  controller.start();

  // Page Visibility API & pagehide handling: freeze ticker, timers, GSAP & audio when backgrounded
  const setBackgroundPaused = (paused: boolean) => {
    stage.setPaused(paused);
    if (paused) {
      gameTimers.pauseAll();
      sound.suspendForBackground();
    } else {
      gameTimers.resumeAll();
      sound.resumeFromBackground();
    }
  };
  document.addEventListener('visibilitychange', () => setBackgroundPaused(document.hidden));
  window.addEventListener('pagehide', () => setBackgroundPaused(true));
  window.addEventListener('pageshow', () => setBackgroundPaused(document.hidden));
  window.addEventListener('blur', () => sound.suspendForBackground());
  window.addEventListener('focus', () => {
    if (!document.hidden) sound.resumeFromBackground();
  });

  if (fullscreenSupported) {
    document.addEventListener('fullscreenchange', () => {
      hud.setFullscreenActive(Boolean(document.fullscreenElement));
    });
  }

  // Keyboard ergonomics: Space/Enter spin, Esc close, M mute, T turbo, I paytable, Up/Down bet
  window.addEventListener('keydown', (e) => {
    if (paytable.visible && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
      e.preventDefault();
      paytable.visible = false;
      return;
    }
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      e.preventDefault();
      void controller.handleSpin();
      return;
    }
    if (e.code === 'KeyM' && !e.repeat) {
      const muted = sound.toggleMute();
      hud.setMuted(muted);
      persistPrefs();
      return;
    }
    if (e.code === 'KeyT' && !e.repeat) {
      controller.handleToggleTurbo();
      persistPrefs();
      return;
    }
    if (e.code === 'KeyI' && !e.repeat) {
      if (!paytable.visible && !controller.isIdle) return;
      controller.stopAutoSpin();
      sound.playClick();
      paytable.updatePayouts(backend.bet);
      paytable.toggle();
      return;
    }
    if (e.code === 'ArrowUp' && !e.repeat) {
      e.preventDefault();
      controller.handleBetUp();
      persistPrefs();
      return;
    }
    if (e.code === 'ArrowDown' && !e.repeat) {
      e.preventDefault();
      controller.handleBetDown();
      persistPrefs();
    }
  });
}

void bootstrap();
