import gsap from 'gsap';
import { Application, Container, Graphics, Text } from 'pixi.js';
import {
  LANDSCAPE_HEIGHT,
  LANDSCAPE_WIDTH,
  clampDevicePixelRatio,
  computeStageLayout,
  type StageLayout,
} from './layout';

export const STAGE_WIDTH = LANDSCAPE_WIDTH;
export const STAGE_HEIGHT = LANDSCAPE_HEIGHT;

export interface LoadingIndicator {
  updateProgress(progress: number): void;
  destroy(): void;
}

export class SlotStage {
  readonly app = new Application();
  readonly root = new Container();
  private readonly bgBase = new Graphics();
  private readonly bgBonus = new Graphics();
  private readonly fxLayer = new Container();
  private readonly titleText: Text;
  private loadingContainer: Container | null = null;
  private contextLostOverlay: HTMLDivElement | null = null;
  private initialized = false;
  private _reducedMotion = false;
  private layoutListeners: Array<(layout: StageLayout) => void> = [];
  private reducedMotionListeners: Array<(reduced: boolean) => void> = [];
  private currentLayout: StageLayout = computeStageLayout(STAGE_WIDTH, STAGE_HEIGHT);

  constructor() {
    this.titleText = new Text({
      text: 'ROYAL JEWEL VAULT',
      style: {
        fill: 0xfacc15,
        fontSize: 28,
        fontWeight: '900',
        fontFamily: 'Georgia, serif',
        letterSpacing: 3,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: LANDSCAPE_WIDTH - 48,
      },
    });
    this.titleText.anchor.set(0.5);

    this.root.addChild(this.bgBase, this.bgBonus, this.titleText);
    this.redrawBackdrop(this.currentLayout);
  }

  get layout(): StageLayout {
    return this.currentLayout;
  }

  get reducedMotion(): boolean {
    return this._reducedMotion;
  }

  onLayoutChange(listener: (layout: StageLayout) => void): void {
    this.layoutListeners.push(listener);
    if (this.initialized) {
      listener(this.currentLayout);
    }
  }

  onReducedMotionChange(listener: (reduced: boolean) => void): void {
    this.reducedMotionListeners.push(listener);
    listener(this._reducedMotion);
  }

  private redrawBackdrop(layout: StageLayout): void {
    const { virtualWidth, virtualHeight, isPortrait } = layout;
    const glowCenterY = isPortrait ? 360 : 310;
    const glowRadius = isPortrait ? 390 : 420;

    this.bgBase
      .clear()
      .rect(0, 0, virtualWidth, virtualHeight)
      .fill(0x16050e)
      .circle(virtualWidth / 2, glowCenterY, glowRadius)
      .fill({ color: 0x58102a, alpha: 0.45 });

    this.bgBonus
      .clear()
      .rect(0, 0, virtualWidth, virtualHeight)
      .fill(0x1c0629)
      .circle(virtualWidth / 2, glowCenterY, glowRadius + 30)
      .fill({ color: 0x7e22ce, alpha: 0.42 });

    this.titleText.style.fontSize = isPortrait ? 30 : 28;
    this.titleText.style.wordWrapWidth = virtualWidth - 48;
    this.titleText.scale.set(1);
    if (this.titleText.width > virtualWidth - 48) {
      this.titleText.scale.set((virtualWidth - 48) / this.titleText.width);
    }
    this.titleText.position.set(virtualWidth / 2, isPortrait ? 38 : 26);

    if (this.loadingContainer && !this.loadingContainer.destroyed) {
      this.loadingContainer.position.set(virtualWidth / 2, virtualHeight / 2);
    }
  }

  async init(mountEl: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: mountEl,
      backgroundAlpha: 0,
      antialias: true,
      resolution: clampDevicePixelRatio(window.devicePixelRatio),
      autoDensity: true,
    });
    mountEl.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);
    this.root.addChild(this.fxLayer);
    this.initialized = true;

    this.initReducedMotion();
    this.initWebGlContextRecovery(mountEl);
    this.resize(true);

    const handleViewportChange = () => {
      const nextResolution = clampDevicePixelRatio(window.devicePixelRatio);
      if (this.app.renderer.resolution !== nextResolution) {
        this.app.renderer.resolution = nextResolution;
      }
      this.app.resize();
      this.resize();
    };

    this.app.renderer.on('resize', () => this.resize());
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
    window.screen?.orientation?.addEventListener?.('change', handleViewportChange);
  }

  private initReducedMotion(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (matches: boolean) => {
      this._reducedMotion = matches;
      for (const listener of this.reducedMotionListeners) {
        listener(matches);
      }
    };
    update(mq.matches);
    mq.addEventListener?.('change', (e) => update(e.matches));
  }

  private initWebGlContextRecovery(mountEl: HTMLElement): void {
    const canvas = this.app.canvas;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.setPaused(true);
      this.showContextLostOverlay(mountEl, true);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.showContextLostOverlay(mountEl, false);
      this.setPaused(false);
      this.app.resize();
      this.resize();
    });
  }

  private showContextLostOverlay(mountEl: HTMLElement, visible: boolean): void {
    if (!visible) {
      if (this.contextLostOverlay) {
        this.contextLostOverlay.style.display = 'none';
      }
      return;
    }
    if (!this.contextLostOverlay) {
      const div = document.createElement('div');
      div.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(12,3,8,0.88);color:#facc15;font:700 18px system-ui,sans-serif;text-align:center;padding:24px;';
      div.textContent = 'Restoring graphics context...';
      mountEl.appendChild(div);
      this.contextLostOverlay = div;
    }
    this.contextLostOverlay.style.display = 'flex';
  }

  setPaused(paused: boolean): void {
    if (!this.initialized) return;
    gsap.globalTimeline.paused(paused);
    if (paused) {
      this.app.ticker.stop();
    } else {
      this.app.ticker.start();
    }
  }

  resize(forceNotify = false): void {
    const prevOrientation = this.currentLayout.isPortrait;
    const prevW = this.currentLayout.virtualWidth;
    const prevH = this.currentLayout.virtualHeight;

    const next = computeStageLayout(this.app.screen.width, this.app.screen.height);
    this.currentLayout = next;
    this.root.scale.set(next.scale);
    this.root.position.set(next.offsetX, next.offsetY);

    if (forceNotify || next.isPortrait !== prevOrientation || next.virtualWidth !== prevW || next.virtualHeight !== prevH) {
      this.redrawBackdrop(next);
      for (const listener of this.layoutListeners) {
        listener(next);
      }
    }
  }

  setBonusMood(active: boolean): void {
    gsap.to(this.bgBonus, { alpha: active ? 1 : 0, duration: this._reducedMotion ? 0.1 : 0.5 });
    this.titleText.text = active ? 'ROYAL FREE SPINS BONUS' : 'ROYAL JEWEL VAULT';
  }

  showLoading(): LoadingIndicator {
    const container = new Container();
    container.position.set(this.currentLayout.virtualWidth / 2, this.currentLayout.virtualHeight / 2);

    const barWidth = 340;
    const barHeight = 16;

    const label = new Text({
      text: 'LOADING ASSETS... 0%',
      style: { fill: 0xfde68a, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
    });
    label.anchor.set(0.5);
    label.position.set(0, -24);

    const track = new Graphics()
      .roundRect(-barWidth / 2, 0, barWidth, barHeight, 8)
      .fill(0x2b0a18)
      .stroke({ width: 2, color: 0xfacc15 });

    const fill = new Graphics();
    container.addChild(label, track, fill);
    this.loadingContainer = container;
    this.root.addChild(container);

    const updateProgress = (progress: number) => {
      const clamped = Math.min(1, Math.max(0, progress));
      label.text = `LOADING ASSETS... ${Math.round(clamped * 100)}%`;
      fill
        .clear()
        .roundRect(-barWidth / 2 + 2, 2, Math.max(0, (barWidth - 4) * clamped), barHeight - 4, 6)
        .fill(0xfacc15);
    };
    updateProgress(0);

    return {
      updateProgress,
      destroy: () => {
        if (!container.destroyed) {
          container.destroy({ children: true });
        }
        this.loadingContainer = null;
      },
    };
  }

  spawnWinSparkles(count = 24): void {
    if (this._reducedMotion) return;
    const cx = this.currentLayout.virtualWidth / 2;
    const cy = this.currentLayout.isPortrait ? 360 : 320;
    for (let i = 0; i < count; i++) {
      const dot = new Graphics().circle(0, 0, 4 + Math.random() * 4).fill(i % 2 === 0 ? 0xfacc15 : 0xff4d6d);
      dot.position.set(cx + (Math.random() - 0.5) * 420, cy + (Math.random() - 0.5) * 140);
      this.fxLayer.addChild(dot);

      gsap.to(dot, {
        x: dot.x + (Math.random() - 0.5) * 260,
        y: dot.y - 80 - Math.random() * 180,
        alpha: 0,
        duration: 0.7 + Math.random() * 0.45,
        ease: 'power2.out',
        onComplete: () => {
          dot.destroy();
        },
      });
    }
  }
}
