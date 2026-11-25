import gsap from 'gsap';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { PAYTABLE, SCATTER_FREE_SPINS, SCATTER_PAYOUTS } from '../../core/config';
import type { BonusState, SymbolId } from '../../core/types';
import type { GameTextures } from '../assets';

export class BonusHeaderBar extends Container {
  private readonly spinsText: Text;
  private readonly multText: Text;
  private readonly totalText: Text;

  constructor() {
    super();
    this.visible = false;

    const bg = new Graphics()
      .roundRect(0, 0, 780, 44, 12)
      .fill({ color: 0x581c87, alpha: 0.94 })
      .stroke({ width: 3, color: 0xfacc15 });
    this.addChild(bg);

    this.spinsText = new Text({
      text: 'FREE SPINS: 8',
      style: { fill: 0xfff8dc, fontSize: 18, fontWeight: '800' },
    });
    this.spinsText.position.set(28, 11);

    this.multText = new Text({
      text: 'MULTIPLIER: 1x',
      style: { fill: 0xfacc15, fontSize: 18, fontWeight: '900' },
    });
    this.multText.position.set(285, 11);

    this.totalText = new Text({
      text: 'BONUS WIN: 0.00',
      style: { fill: 0x86efac, fontSize: 18, fontWeight: '800' },
    });
    this.totalText.position.set(525, 11);

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
    backdrop.eventMode = 'static';
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
  private readonly lineTexts = new Map<Exclude<SymbolId, 'SCATTER'>, Text>();
  private readonly scatterText: Text;
  private readonly titleText: Text;

  constructor(stageWidth: number, stageHeight: number, textures?: GameTextures) {
    super();
    this.visible = false;

    const backdrop = new Graphics()
      .rect(0, 0, stageWidth, stageHeight)
      .fill({ color: 0x090208, alpha: 0.8 });
    backdrop.eventMode = 'static';
    backdrop.on('pointertap', () => {
      this.visible = false;
    });

    const left = stageWidth / 2 - 420;
    const top = stageHeight / 2 - 260;
    const panel = new Graphics()
      .roundRect(left, top, 840, 520, 20)
      .fill({ color: 0x1f0814, alpha: 0.98 })
      .stroke({ width: 4, color: 0xfacc15 });
    panel.eventMode = 'static';
    panel.on('pointertap', () => {
      this.visible = false;
    });

    this.titleText = new Text({
      text: 'ROYAL JEWEL VAULT — PAYTABLE (FOR BET 5.00)',
      style: { fill: 0xfacc15, fontSize: 22, fontWeight: '900', fontFamily: 'Georgia, serif' },
    });
    this.titleText.position.set(left + 32, top + 24);

    this.addChild(backdrop, panel, this.titleText);

    PAYTABLE_ORDER.forEach((sym, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i < 5 ? i : i - 5;
      const x = left + 32 + col * 405;
      const y = top + 74 + row * 56;

      if (textures) {
        const icon = new Sprite(textures.symbols[sym]);
        icon.anchor.set(0.5);
        const s = 44 / Math.max(icon.texture.width || 1, icon.texture.height || 1);
        icon.scale.set(s);
        icon.position.set(x + 22, y + 22);
        this.addChild(icon);
      }

      const line = new Text({
        text: '',
        style: { fill: 0xfff8dc, fontSize: 15, fontWeight: '600', fontFamily: 'system-ui, sans-serif' },
      });
      line.position.set(x + 56, y + 12);
      this.lineTexts.set(sym, line);
      this.addChild(line);
    });

    if (textures) {
      const scatterIcon = new Sprite(textures.symbols.SCATTER);
      scatterIcon.anchor.set(0.5);
      const s = 44 / Math.max(scatterIcon.texture.width || 1, scatterIcon.texture.height || 1);
      scatterIcon.scale.set(s);
      scatterIcon.position.set(left + 32 + 405 + 22, top + 74 + 4 * 56 + 22);
      this.addChild(scatterIcon);
    }
    this.scatterText = new Text({
      text: '',
      style: { fill: 0xfde68a, fontSize: 14, fontWeight: '700', fontFamily: 'system-ui, sans-serif' },
    });
    this.scatterText.position.set(left + 32 + 405 + 56, top + 74 + 4 * 56 + 13);
    this.addChild(this.scatterText);

    const rules = new Text({
      text: [
        '• 5 Reels × 3 Rows | 20 Fixed Paylines (Left to Right, starting from leftmost reel)',
        '• WILD substitutes for all regular symbols (highest win paid per line)',
        '• Free Spins Bonus: Each winning spin steps multiplier up 1x → 2x → 3x → 5x (re-triggers add spins)',
        '• Controls: SPIN or SPACE (press again to Quick Stop)  |  Click anywhere or press ESC / SPACE to close',
      ].join('\n'),
      style: {
        fill: 0xe5e7eb,
        fontSize: 14,
        lineHeight: 24,
        fontFamily: 'system-ui, sans-serif',
      },
    });
    rules.position.set(left + 32, top + 382);
    this.addChild(rules);

    this.updatePayouts(5);
  }

  updatePayouts(bet: number): void {
    this.titleText.text = `ROYAL JEWEL VAULT — PAYTABLE (FOR BET ${bet.toFixed(2)})`;
    const lineBet = bet / 10;
    const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

    for (const sym of PAYTABLE_ORDER) {
      const p = PAYTABLE[sym];
      const label = sym.replace('HIGH_', '').replace('LOW_', '');
      const line = this.lineTexts.get(sym);
      if (line) {
        line.text = `${label}   3: ${fmt(p[3] * lineBet)}  |  4: ${fmt(p[4] * lineBet)}  |  5: ${fmt(p[5] * lineBet)}`;
      }
    }

    this.scatterText.text = `SCATTER  3/4/5 → ${SCATTER_FREE_SPINS[3]}/${SCATTER_FREE_SPINS[4]}/${SCATTER_FREE_SPINS[5]} Spins + ${fmt(SCATTER_PAYOUTS[3] * bet)}/${fmt(SCATTER_PAYOUTS[4] * bet)}/${fmt(SCATTER_PAYOUTS[5] * bet)}`;
  }

  toggle(): void {
    this.visible = !this.visible;
  }
}
