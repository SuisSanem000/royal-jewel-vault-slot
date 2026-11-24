import gsap from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import type { BonusState } from '../../core/types';

export class BonusHeaderBar extends Container {
  private readonly spinsText: Text;
  private readonly multText: Text;
  private readonly totalText: Text;

  constructor() {
    super();
    this.visible = false;

    const bg = new Graphics()
      .roundRect(0, 0, 780, 52, 14)
      .fill({ color: 0x581c87, alpha: 0.94 })
      .stroke({ width: 3, color: 0xfacc15 });
    this.addChild(bg);

    this.spinsText = new Text({
      text: 'FREE SPINS: 8',
      style: { fill: 0xfff8dc, fontSize: 20, fontWeight: '800' },
    });
    this.spinsText.position.set(28, 14);

    this.multText = new Text({
      text: 'MULTIPLIER: 1x',
      style: { fill: 0xfacc15, fontSize: 20, fontWeight: '900' },
    });
    this.multText.position.set(285, 14);

    this.totalText = new Text({
      text: 'BONUS WIN: 0.00',
      style: { fill: 0x86efac, fontSize: 20, fontWeight: '800' },
    });
    this.totalText.position.set(525, 14);

    this.addChild(this.spinsText, this.multText, this.totalText);
  }

  updateBonus(bonus: BonusState): void {
    this.visible = bonus.active;
    this.spinsText.text = `FREE SPINS: ${bonus.spinsRemaining}`;
    this.multText.text = `MULTIPLIER: ${bonus.multiplier}x`;
    this.totalText.text = `BONUS WIN: ${bonus.totalBonusWin.toFixed(2)}`;
  }
}

export class ModalBanner extends Container {
  private readonly titleText: Text;
  private readonly subtitleText: Text;
  private readonly card = new Container();

  constructor(stageWidth: number, stageHeight: number) {
    super();
    this.visible = false;

    const backdrop = new Graphics()
      .rect(0, 0, stageWidth, stageHeight)
      .fill({ color: 0x090208, alpha: 0.65 });
    this.addChild(backdrop);

    const box = new Graphics()
      .roundRect(-290, -110, 580, 220, 24)
      .fill({ color: 0x2b0a18, alpha: 0.97 })
      .stroke({ width: 5, color: 0xfacc15 });

    this.titleText = new Text({
      text: '',
      style: { fill: 0xfacc15, fontSize: 44, fontWeight: '900', fontFamily: 'Georgia, serif' },
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(0, -30);

    this.subtitleText = new Text({
      text: '',
      style: { fill: 0xffffff, fontSize: 24, fontWeight: '700', align: 'center' },
    });
    this.subtitleText.anchor.set(0.5);
    this.subtitleText.position.set(0, 36);

    this.card.position.set(stageWidth / 2, stageHeight / 2);
    this.card.addChild(box, this.titleText, this.subtitleText);
    this.addChild(this.card);
  }

  async show(title: string, subtitle: string, durationMs = 1700): Promise<void> {
    this.titleText.text = title;
    this.subtitleText.text = subtitle;
    this.visible = true;
    this.alpha = 0;
    this.card.scale.set(0.72);

    gsap.killTweensOf(this);
    gsap.killTweensOf(this.card.scale);
    gsap.to(this, { alpha: 1, duration: 0.22 });
    gsap.to(this.card.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(1.8)' });

    await new Promise((r) => setTimeout(r, durationMs));

    await new Promise<void>((resolve) => {
      gsap.to(this, {
        alpha: 0,
        duration: 0.22,
        onComplete: () => {
          this.visible = false;
          resolve();
        },
      });
    });
  }
}

export class PaytableModal extends Container {
  constructor(stageWidth: number, stageHeight: number) {
    super();
    this.visible = false;

    const backdrop = new Graphics()
      .rect(0, 0, stageWidth, stageHeight)
      .fill({ color: 0x090208, alpha: 0.78 });
    backdrop.eventMode = 'static';
    backdrop.on('pointertap', () => {
      this.visible = false;
    });

    const panel = new Graphics()
      .roundRect(stageWidth / 2 - 320, stageHeight / 2 - 210, 640, 420, 20)
      .fill({ color: 0x1f0814, alpha: 0.98 })
      .stroke({ width: 4, color: 0xfacc15 });

    const body = new Text({
      text: [
        'ROYAL JEWEL VAULT — PAYTABLE & RULES',
        '',
        '• 5 Reels × 3 Rows | 20 Fixed Paylines (Left to Right)',
        '• High Symbols: Ruby > Sapphire > Emerald > Amethyst',
        '• Low Symbols: A > K > Q > J',
        '• WILD substitutes for all regular symbols',
        '• 3 / 4 / 5 SCATTER anywhere triggers 8 / 10 / 12 Free Spins',
        '• Free Spins Bonus: Consecutive wins step multiplier',
        '  up from 1x → 2x → 3x → 5x (re-triggers add more spins!)',
        '',
        'Controls: Click SPIN or press SPACE (press again to Quick Stop)',
        'Click anywhere to close',
      ].join('\n'),
      style: {
        fill: 0xfff8dc,
        fontSize: 17,
        lineHeight: 28,
        fontFamily: 'system-ui, sans-serif',
      },
    });
    body.position.set(stageWidth / 2 - 285, stageHeight / 2 - 180);

    this.addChild(backdrop, panel, body);
  }

  toggle(): void {
    this.visible = !this.visible;
  }
}
