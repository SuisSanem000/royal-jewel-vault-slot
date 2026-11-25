import gsap from 'gsap';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { PAYTABLE, SCATTER_FREE_SPINS, SCATTER_PAYOUTS } from '../../core/config';
import { formatCredits, type FormatConfig } from '../../core/format';
import type { BonusState, SymbolId } from '../../core/types';
import type { GameTextures } from '../assets';

function fitTextWidth(textObj: Text, maxWidth: number): void {
  textObj.scale.set(1);
  if (textObj.width > maxWidth && textObj.width > 0) {
    const ratio = maxWidth / textObj.width;
    textObj.scale.set(ratio);
  }
}

export class BonusHeaderBar extends Container {
  private readonly spinsText: Text;
  private readonly multText: Text;
  private readonly totalText: Text;
  private readonly formatConfig: FormatConfig;

  constructor(formatConfig: FormatConfig = { locale: 'en-US' }) {
    super();
    this.formatConfig = formatConfig;
    this.visible = false;

    const bg = new Graphics()
      .roundRect(0, 0, 780, 44, 12)
      .fill({ color: 0x581c87, alpha: 0.94 })
      .stroke({ width: 3, color: 0xfacc15 });
    this.addChild(bg);

    this.spinsText = new Text({
      text: 'FREE SPINS: 8',
      style: { fill: 0xfff8dc, fontSize: 17, fontWeight: '800' },
    });
    this.spinsText.anchor.set(0, 0.5);
    this.spinsText.position.set(24, 22);

    this.multText = new Text({
      text: 'MULTIPLIER: 1x',
      style: { fill: 0xfacc15, fontSize: 17, fontWeight: '900' },
    });
    this.multText.anchor.set(0.5, 0.5);
    this.multText.position.set(390, 22);

    this.totalText = new Text({
      text: 'BONUS WIN: 0',
      style: { fill: 0x86efac, fontSize: 17, fontWeight: '800' },
    });
    this.totalText.anchor.set(1, 0.5);
    this.totalText.position.set(756, 22);

    this.addChild(this.spinsText, this.multText, this.totalText);
  }

  updateBonus(bonus: BonusState): void {
    this.visible = bonus.active;
    this.spinsText.text = `FREE SPINS: ${bonus.spinsRemaining}`;
    this.multText.text = `MULTIPLIER: ${bonus.multiplier}x`;
    this.totalText.text = `BONUS WIN: ${formatCredits(bonus.totalBonusWin, this.formatConfig)}`;
    fitTextWidth(this.spinsText, 220);
    fitTextWidth(this.multText, 200);
    fitTextWidth(this.totalText, 240);
  }
}

export class ModalBanner extends Container {
  private readonly backdrop = new Graphics();
  private readonly titleText: Text;
  private readonly subtitleText: Text;
  private readonly card = new Container();
  private activeTimer: ReturnType<typeof setTimeout> | null = null;
  private activeResolve: (() => void) | null = null;

  constructor(stageWidth: number, stageHeight: number) {
    super();
    this.visible = false;

    this.backdrop.eventMode = 'static';
    this.backdrop.on('pointertap', () => this.dismissEarly());
    this.card.eventMode = 'static';
    this.card.cursor = 'pointer';
    this.card.on('pointertap', () => this.dismissEarly());
    this.addChild(this.backdrop);

    const box = new Graphics()
      .roundRect(-320, -125, 640, 250, 24)
      .fill({ color: 0x2b0a18, alpha: 0.97 })
      .stroke({ width: 5, color: 0xfacc15 });

    this.titleText = new Text({
      text: '',
      style: {
        fill: 0xfacc15,
        fontSize: 38,
        fontWeight: '900',
        fontFamily: 'Georgia, serif',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 576,
      },
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(0, -48);

    this.subtitleText = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 568,
      },
    });
    this.subtitleText.anchor.set(0.5);
    this.subtitleText.position.set(0, 32);

    this.card.addChild(box, this.titleText, this.subtitleText);
    this.addChild(this.card);
    this.setViewport(stageWidth, stageHeight);
  }

  setViewport(stageWidth: number, stageHeight: number): void {
    this.backdrop
      .clear()
      .rect(0, 0, stageWidth, stageHeight)
      .fill({ color: 0x090208, alpha: 0.58 });
    const cardY = stageHeight > stageWidth ? 360 : 328;
    this.card.position.set(stageWidth / 2, cardY);
  }

  private dismissEarly(): void {
    if (!this.visible) return;
    this.finishCurrentShow();
  }

  private finishCurrentShow(): void {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.card.scale);
    this.visible = false;
    this.alpha = 0;
    const resolve = this.activeResolve;
    this.activeResolve = null;
    resolve?.();
  }

  hideImmediate(): void {
    this.finishCurrentShow();
  }

  show(title: string, subtitle: string, durationMs = 1700): Promise<void> {
    this.finishCurrentShow();

    this.titleText.text = title;
    this.subtitleText.text = subtitle;
    fitTextWidth(this.titleText, 576);
    this.subtitleText.scale.set(1);
    if (this.subtitleText.width > 568 || this.subtitleText.height > 106) {
      const ratio = Math.min(
        568 / Math.max(1, this.subtitleText.width),
        106 / Math.max(1, this.subtitleText.height),
      );
      this.subtitleText.scale.set(ratio);
    }

    this.visible = true;
    this.alpha = 0;
    this.card.scale.set(0.76);

    gsap.to(this, { alpha: 1, duration: 0.2 });
    gsap.to(this.card.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(1.8)' });

    return new Promise<void>((resolve) => {
      this.activeResolve = resolve;
      this.activeTimer = setTimeout(() => {
        this.activeTimer = null;
        gsap.to(this, {
          alpha: 0,
          duration: 0.2,
          onComplete: () => {
            this.visible = false;
            const res = this.activeResolve;
            this.activeResolve = null;
            res?.();
          },
        });
      }, durationMs);
    });
  }
}

const PAYTABLE_ORDER: Exclude<SymbolId, 'SCATTER'>[] = [
  'WILD',
  'HIGH_RUBY',
  'HIGH_SAPPHIRE',
  'HIGH_EMERALD',
  'HIGH_AMETHYST',
  'LOW_A',
  'LOW_K',
  'LOW_Q',
  'LOW_J',
];

export class PaytableModal extends Container {
  private readonly backdrop = new Graphics();
  private readonly content = new Container();
  private readonly lineTexts = new Map<Exclude<SymbolId, 'SCATTER'>, Text>();
  private readonly scatterText: Text;
  private readonly titleText: Text;
  private readonly formatConfig: FormatConfig;

  constructor(
    stageWidth: number,
    stageHeight: number,
    textures?: GameTextures,
    formatConfig: FormatConfig = { locale: 'en-US' },
  ) {
    super();
    this.formatConfig = formatConfig;
    this.visible = false;

    this.backdrop.eventMode = 'static';
    this.backdrop.on('pointertap', () => {
      this.visible = false;
    });

    const left = -440;
    const top = -270;
    const panel = new Graphics()
      .roundRect(left, top, 880, 540, 20)
      .fill({ color: 0x1f0814, alpha: 0.98 })
      .stroke({ width: 4, color: 0xfacc15 });
    panel.eventMode = 'static';
    panel.on('pointertap', () => {
      this.visible = false;
    });

    this.titleText = new Text({
      text: 'ROYAL JEWEL VAULT — PAYTABLE (FOR BET 5)',
      style: {
        fill: 0xfacc15,
        fontSize: 22,
        fontWeight: '900',
        fontFamily: 'Georgia, serif',
        wordWrap: true,
        wordWrapWidth: 816,
      },
    });
    this.titleText.position.set(left + 32, top + 24);

    this.addChild(this.backdrop, this.content);
    this.content.addChild(panel, this.titleText);

    PAYTABLE_ORDER.forEach((sym, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i < 5 ? i : i - 5;
      const x = left + 32 + col * 418;
      const y = top + 74 + row * 56;

      if (textures) {
        const icon = new Sprite(textures.symbols[sym]);
        icon.anchor.set(0.5);
        const s = 44 / Math.max(icon.texture.width || 1, icon.texture.height || 1);
        icon.scale.set(s);
        icon.position.set(x + 22, y + 22);
        this.content.addChild(icon);
      }

      const line = new Text({
        text: '',
        style: { fill: 0xfff8dc, fontSize: 15, fontWeight: '600', fontFamily: 'system-ui, sans-serif' },
      });
      line.position.set(x + 56, y + 12);
      this.lineTexts.set(sym, line);
      this.content.addChild(line);
    });

    if (textures) {
      const scatterIcon = new Sprite(textures.symbols.SCATTER);
      scatterIcon.anchor.set(0.5);
      const s = 44 / Math.max(scatterIcon.texture.width || 1, scatterIcon.texture.height || 1);
      scatterIcon.scale.set(s);
      scatterIcon.position.set(left + 32 + 418 + 22, top + 74 + 4 * 56 + 22);
      this.content.addChild(scatterIcon);
    }
    this.scatterText = new Text({
      text: '',
      style: {
        fill: 0xfde68a,
        fontSize: 13.5,
        lineHeight: 19,
        fontWeight: '700',
        fontFamily: 'system-ui, sans-serif',
        wordWrap: true,
        wordWrapWidth: 344,
      },
    });
    this.scatterText.position.set(left + 32 + 418 + 56, top + 74 + 4 * 56 + 4);
    this.content.addChild(this.scatterText);

    const rules = new Text({
      text: [
        '• 5 Reels × 3 Rows | 20 Fixed Paylines (Left to Right, starting from leftmost reel)',
        '• WILD substitutes for all regular symbols (highest win paid per line)',
        '• Free Spins Bonus: Winning spins step multiplier 1x → 2x → 3x → 5x (re-triggers add spins)',
        '• Controls: SPIN/SPACE (press again to Quick Stop) | STOP ALL stops AUTO/BONUS | ESC or click to close',
      ].join('\n'),
      style: {
        fill: 0xe5e7eb,
        fontSize: 14,
        lineHeight: 24,
        fontFamily: 'system-ui, sans-serif',
        wordWrap: true,
        wordWrapWidth: 816,
      },
    });
    rules.position.set(left + 32, top + 382);
    this.content.addChild(rules);

    this.updatePayouts(5);
    this.setViewport(stageWidth, stageHeight);
  }

  setViewport(stageWidth: number, stageHeight: number): void {
    this.backdrop
      .clear()
      .rect(0, 0, stageWidth, stageHeight)
      .fill({ color: 0x090208, alpha: 0.8 });
    this.content.position.set(stageWidth / 2, stageHeight / 2);
    const fitScale = Math.min(1, (stageWidth - 40) / 880, (stageHeight - 40) / 540);
    this.content.scale.set(fitScale);
  }

  updatePayouts(bet: number): void {
    const fmt = (n: number) => formatCredits(n, this.formatConfig);
    this.titleText.text = `ROYAL JEWEL VAULT — PAYTABLE (FOR BET ${fmt(bet)})`;
    fitTextWidth(this.titleText, 816);
    const lineBet = bet / 10;

    for (const sym of PAYTABLE_ORDER) {
      const p = PAYTABLE[sym];
      const label = sym.replace('HIGH_', '').replace('LOW_', '');
      const line = this.lineTexts.get(sym);
      if (line) {
        line.text = `${label}   3: ${fmt(p[3] * lineBet)}  |  4: ${fmt(p[4] * lineBet)}  |  5: ${fmt(p[5] * lineBet)}`;
        fitTextWidth(line, 344);
      }
    }

    this.scatterText.text = [
      `SCATTER   3/4/5 → ${SCATTER_FREE_SPINS[3]}/${SCATTER_FREE_SPINS[4]}/${SCATTER_FREE_SPINS[5]} Spins`,
      `Pays: ${fmt(SCATTER_PAYOUTS[3] * bet)} / ${fmt(SCATTER_PAYOUTS[4] * bet)} / ${fmt(SCATTER_PAYOUTS[5] * bet)}`,
    ].join('\n');
  }

  toggle(): void {
    this.visible = !this.visible;
  }
}
