import gsap from 'gsap';
import { BlurFilter, Container, Sprite, Texture } from 'pixi.js';
import { ROW_COUNT } from '../../core/config';
import { gameTimers } from '../../core/timers';
import type { SymbolId } from '../../core/types';

const ALL_SYMBOLS: SymbolId[] = [
  'HIGH_RUBY',
  'HIGH_SAPPHIRE',
  'HIGH_EMERALD',
  'HIGH_AMETHYST',
  'LOW_A',
  'LOW_K',
  'LOW_Q',
  'LOW_J',
  'WILD',
  'SCATTER',
];

export class ReelColumn extends Container {
  private readonly sprites: Sprite[] = [];
  private readonly symbolTextures: Record<SymbolId, Texture>;
  private readonly cellSize: number;
  private readonly blurFilter = new BlurFilter({
    strengthX: 0,
    strengthY: 0,
    resolution: 'inherit',
  });

  private spinning = false;
  private speed = 0;
  private scrollOffset = 0;
  private reducedMotion = false;
  private turboMode = false;
  private stopResolve: (() => void) | null = null;
  private stopTimer: number | null = null;
  private targetSymbols: SymbolId[] = ['HIGH_RUBY', 'LOW_A', 'LOW_K'];

  constructor(
    symbolTextures: Record<SymbolId, Texture>,
    cellSize: number,
    initialSymbols: SymbolId[],
  ) {
    super();
    this.symbolTextures = symbolTextures;
    this.cellSize = cellSize;
    this.filters = [];

    // 4 sprites: index 0..2 visible rows, index 3 wrap buffer above top
    for (let i = 0; i < ROW_COUNT + 1; i++) {
      const sym = initialSymbols[i] ?? ALL_SYMBOLS[i % ALL_SYMBOLS.length];
      const sprite = new Sprite(symbolTextures[sym]);
      sprite.anchor.set(0.5);
      this.fitSprite(sprite);
      sprite.x = cellSize / 2;
      sprite.y = i * cellSize + cellSize / 2;
      this.sprites.push(sprite);
      this.addChild(sprite);
    }

    this.setSymbols(initialSymbols);
  }

  private fitSprite(sprite: Sprite): void {
    const target = this.cellSize * 0.84;
    const scale = target / Math.max(sprite.texture.width || 1, sprite.texture.height || 1);
    sprite.scale.set(scale);
  }

  highlightRow(row: number, isWinner: boolean): void {
    const sprite = this.sprites[row];
    if (!sprite) return;
    gsap.killTweensOf(sprite.scale);
    this.fitSprite(sprite);

    if (isWinner) {
      sprite.alpha = 1;
      const base = sprite.scale.x;
      gsap.to(sprite.scale, {
        x: base * 1.09,
        y: base * 1.09,
        duration: 0.45,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    } else {
      sprite.alpha = 0.42;
    }
  }

  resetRowHighlights(): void {
    for (let row = 0; row < ROW_COUNT; row++) {
      const sprite = this.sprites[row];
      gsap.killTweensOf(sprite.scale);
      sprite.alpha = 1;
      this.fitSprite(sprite);
    }
  }

  private randomSymbol(): SymbolId {
    return ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
  }

  setSymbols(symbols: SymbolId[]): void {
    this.scrollOffset = 0;
    for (let row = 0; row < ROW_COUNT; row++) {
      const sprite = this.sprites[row];
      sprite.texture = this.symbolTextures[symbols[row]];
      this.fitSprite(sprite);
      sprite.y = row * this.cellSize + this.cellSize / 2;
    }
    this.sprites[ROW_COUNT].y = -this.cellSize / 2;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.blurFilter.strengthY = 0;
      this.filters = [];
    }
  }

  startSpin(turbo = false): void {
    this.clearTimers();
    gsap.killTweensOf(this);
    this.y = 0;
    this.spinning = true;
    this.turboMode = turbo;
    this.speed = turbo ? 75 : 42;
    if (this.reducedMotion) {
      this.blurFilter.strengthY = 0;
      this.filters = [];
    } else {
      this.blurFilter.strengthY = turbo ? 10 : 7;
      this.filters = [this.blurFilter];
    }
  }

  /** Schedules stop after delayMs and resolves once bounce animation settles */
  scheduleStop(target: SymbolId[], delayMs: number, onLand?: () => void): Promise<void> {
    this.targetSymbols = target;
    return new Promise((resolve) => {
      this.stopResolve = resolve;
      this.stopTimer = gameTimers.set(() => {
        this.stopTimer = null;
        this.land(onLand);
      }, delayMs);
    });
  }

  quickStop(onLand?: () => void): void {
    if (!this.spinning) return;
    this.clearTimers();
    this.land(onLand);
  }

  /** Immediately halts spinning/bounce tweens and resolves pending spin promises (used by STOP ALL / RESET). */
  forceStop(symbols?: SymbolId[]): void {
    this.clearTimers();
    gsap.killTweensOf(this);
    this.spinning = false;
    this.speed = 0;
    this.blurFilter.strengthY = 0;
    this.filters = [];
    this.y = 0;
    this.setSymbols(symbols ?? this.targetSymbols);
    this.resetRowHighlights();
    const res = this.stopResolve;
    this.stopResolve = null;
    res?.();
  }

  private land(onLand?: () => void): void {
    this.spinning = false;
    this.speed = 0;
    this.blurFilter.strengthY = 0;
    this.filters = [];
    this.setSymbols(this.targetSymbols);
    onLand?.();

    // Subtle overshoot bounce for tactile mechanical feel (disabled in reduced-motion mode)
    if (this.reducedMotion) {
      this.y = 0;
      const res = this.stopResolve;
      this.stopResolve = null;
      res?.();
      return;
    }

    this.y = this.turboMode ? -10 : -18;
    gsap.killTweensOf(this);
    gsap.to(this, {
      y: 0,
      duration: this.turboMode ? 0.1 : 0.24,
      ease: 'back.out(2.2)',
      onComplete: () => {
        const res = this.stopResolve;
        this.stopResolve = null;
        res?.();
      },
    });
  }

  update(deltaSeconds: number): void {
    if (!this.spinning) return;
    const clampedDelta = Math.min(deltaSeconds, 0.05);
    const step = this.speed * (clampedDelta * 60);
    this.scrollOffset += step;

    for (const sprite of this.sprites) {
      sprite.y += step;
      while (sprite.y > (ROW_COUNT + 0.5) * this.cellSize) {
        sprite.y -= (ROW_COUNT + 1) * this.cellSize;
        sprite.texture = this.symbolTextures[this.randomSymbol()];
        this.fitSprite(sprite);
      }
    }
  }

  private clearTimers(): void {
    if (this.stopTimer) {
      gameTimers.clear(this.stopTimer);
      this.stopTimer = null;
    }
  }
}
