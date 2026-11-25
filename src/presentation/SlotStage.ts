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

export class SlotStage {
  readonly app = new Application();
  readonly root = new Container();
  private readonly bgBase = new Graphics();
  private readonly bgBonus = new Graphics();
  private readonly fxLayer = new Container();
  private readonly titleText: Text;
  private loadingLabel: Text | null = null;
  private initialized = false;
  private layoutListeners: Array<(layout: StageLayout) => void> = [];
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

  onLayoutChange(listener: (layout: StageLayout) => void): void {
    this.layoutListeners.push(listener);
    if (this.initialized) {
      listener(this.currentLayout);
    }
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

    if (this.loadingLabel && !this.loadingLabel.destroyed) {
      this.loadingLabel.position.set(virtualWidth / 2, virtualHeight / 2);
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
    gsap.to(this.bgBonus, { alpha: active ? 1 : 0, duration: 0.5 });
    this.titleText.text = active ? 'ROYAL FREE SPINS BONUS' : 'ROYAL JEWEL VAULT';
  }

  showLoading(): Text {
    const label = new Text({
      text: 'LOADING ASSETS...',
      style: { fill: 0xfde68a, fontSize: 22, fontWeight: '700', letterSpacing: 2 },
    });
    label.anchor.set(0.5);
    label.position.set(this.currentLayout.virtualWidth / 2, this.currentLayout.virtualHeight / 2);
    this.loadingLabel = label;
    this.root.addChild(label);
    return label;
  }

  spawnWinSparkles(count = 24): void {
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
