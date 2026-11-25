import gsap from 'gsap';
import { Container, Graphics, Sprite } from 'pixi.js';
import { PAYLINES, REEL_COUNT, ROW_COUNT } from '../../core/config';
import type { CellPosition, Grid, LineWin, ScatterWin } from '../../core/types';
import type { GameTextures } from '../assets';
import { ReelColumn } from './ReelColumn';

const PAYLINE_COLORS = [0xffd700, 0xff4d6d, 0x38bdf8, 0x4ade80, 0xc084fc, 0xfb923c];

export class ReelGridView extends Container {
  private readonly columns: ReelColumn[] = [];
  private readonly overlayLayer = new Container();
  private readonly paylineGraphics = new Graphics();
  private readonly anticipationGraphics = new Graphics();
  private readonly textures: GameTextures;
  private readonly cellSize: number;
  private readonly colGap = 10;

  constructor(textures: GameTextures, initialGrid: Grid, cellSize = 148) {
    super();
    this.textures = textures;
    this.cellSize = cellSize;

    const totalW = REEL_COUNT * cellSize + (REEL_COUNT - 1) * this.colGap;
    const totalH = ROW_COUNT * cellSize;

    // Ornate cabinet background
    const cabinet = new Graphics();
    cabinet
      .roundRect(-20, -20, totalW + 40, totalH + 40, 22)
      .fill({ color: 0x1a0712, alpha: 0.94 })
      .stroke({ width: 5, color: 0xeab308 });
    cabinet
      .roundRect(-12, -12, totalW + 24, totalH + 24, 16)
      .stroke({ width: 2, color: 0x9d174d, alpha: 0.75 });

    // Column dividers
    for (let c = 1; c < REEL_COUNT; c++) {
      const x = c * (cellSize + this.colGap) - this.colGap / 2;
      cabinet.moveTo(x, 4).lineTo(x, totalH - 4).stroke({ width: 2, color: 0xfacc15, alpha: 0.25 });
    }
    this.addChild(cabinet);

    // Masked reel container
    const reelContainer = new Container();
    const mask = new Graphics().roundRect(0, 0, totalW, totalH, 10).fill(0xffffff);
    reelContainer.mask = mask;
    this.addChild(mask, reelContainer);

    for (let col = 0; col < REEL_COUNT; col++) {
      const column = new ReelColumn(textures.symbols, cellSize, initialGrid[col]);
      column.x = col * (cellSize + this.colGap);
      this.columns.push(column);
      reelContainer.addChild(column);
    }

    this.addChild(this.anticipationGraphics, this.paylineGraphics, this.overlayLayer);
  }

  get gridWidth(): number {
    return REEL_COUNT * this.cellSize + (REEL_COUNT - 1) * this.colGap;
  }

  get gridHeight(): number {
    return ROW_COUNT * this.cellSize;
  }

  update(deltaSeconds: number): void {
    for (const col of this.columns) {
      col.update(deltaSeconds);
    }
  }

  async spinTo(grid: Grid, turbo: boolean, onReelStop: (col: number) => void): Promise<void> {
    this.clearHighlights();
    for (const col of this.columns) {
      col.startSpin();
    }

    const baseDelay = turbo ? 220 : 520;
    const stagger = turbo ? 90 : 210;
    let scattersInResult = 0;
    let scattersLanded = 0;
    let extraAnticipation = 0;

    const promises = this.columns.map((col, idx) => {
      const delay = baseDelay + idx * stagger + extraAnticipation;
      const hasAnticipation = scattersInResult >= 2 && !turbo;
      if (hasAnticipation) {
        extraAnticipation += 280;
      }
      if (grid[idx].includes('SCATTER')) {
        scattersInResult++;
      }

      return col.scheduleStop(grid[idx], delay, () => {
        if (grid[idx].includes('SCATTER')) {
          scattersLanded++;
        }
        if (!turbo && scattersLanded >= 2 && idx + 1 < REEL_COUNT) {
          this.showAnticipation(idx + 1);
        } else {
          this.anticipationGraphics.clear();
        }
        onReelStop(idx);
      });
    });

    await Promise.all(promises);
    this.anticipationGraphics.clear();
  }

  quickStop(onReelStop: (col: number) => void): void {
    this.anticipationGraphics.clear();
    this.columns.forEach((col, idx) => col.quickStop(() => onReelStop(idx)));
  }

  private showAnticipation(colIndex: number): void {
    const x = colIndex * (this.cellSize + this.colGap);
    this.anticipationGraphics.clear();
    this.anticipationGraphics
      .roundRect(x - 3, -3, this.cellSize + 6, this.gridHeight + 6, 10)
      .stroke({ width: 5, color: 0xffd700, alpha: 0.9 });
  }

  showWins(lineWins: LineWin[], scatterWin: ScatterWin | null): void {
    this.clearHighlights();

    // Draw payline connectors
    lineWins.forEach((win, i) => {
      const rows = PAYLINES[win.paylineIndex];
      const color = PAYLINE_COLORS[i % PAYLINE_COLORS.length];
      for (let col = 0; col < win.count; col++) {
        const pt = this.cellCenter(col, rows[col]);
        if (col === 0) this.paylineGraphics.moveTo(pt.x, pt.y);
        else this.paylineGraphics.lineTo(pt.x, pt.y);
      }
      this.paylineGraphics.stroke({ width: 5, color, alpha: 0.85 });
    });

    // Collect unique winning & scatter cells for symbol_overlay.png frames
    const unique = new Map<string, CellPosition>();
    for (const win of lineWins) {
      for (const pos of win.positions) unique.set(`${pos.col},${pos.row}`, pos);
    }
    if (scatterWin) {
      for (const pos of scatterWin.positions) unique.set(`${pos.col},${pos.row}`, pos);
    }

    for (let col = 0; col < REEL_COUNT; col++) {
      for (let row = 0; row < ROW_COUNT; row++) {
        this.columns[col].highlightRow(row, unique.has(`${col},${row}`));
      }
    }

    for (const pos of unique.values()) {
      const frame = new Sprite(this.textures.overlay);
      frame.anchor.set(0.5);
      const scale = (this.cellSize * 1.02) / Math.max(frame.texture.width || 1, frame.texture.height || 1);
      frame.scale.set(scale * 0.92);
      const center = this.cellCenter(pos.col, pos.row);
      frame.position.set(center.x, center.y);
      this.overlayLayer.addChild(frame);

      gsap.to(frame.scale, {
        x: scale * 1.04,
        y: scale * 1.04,
        duration: 0.45,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }
  }

  clearHighlights(): void {
    this.paylineGraphics.clear();
    this.anticipationGraphics.clear();
    for (const col of this.columns) {
      col.resetRowHighlights();
    }
    for (const child of this.overlayLayer.children) {
      gsap.killTweensOf(child.scale);
    }
    this.overlayLayer.removeChildren();
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: col * (this.cellSize + this.colGap) + this.cellSize / 2,
      y: row * this.cellSize + this.cellSize / 2,
    };
  }
}
