import gsap from 'gsap';
import { Application, Container, Graphics, Text } from 'pixi.js';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

export class SlotStage {
  readonly app = new Application();
  readonly root = new Container();
  private readonly bgBase = new Graphics();
  private readonly bgBonus = new Graphics();
  private readonly fxLayer = new Container();
  private readonly titleText: Text;

  constructor() {
    this.bgBase.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill(0x16050e);
    this.bgBase.circle(STAGE_WIDTH / 2, 310, 420).fill({ color: 0x58102a, alpha: 0.45 });

    this.bgBonus.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill(0x1c0629);
    this.bgBonus.circle(STAGE_WIDTH / 2, 310, 450).fill({ color: 0x7e22ce, alpha: 0.42 });
    this.bgBonus.alpha = 0;

    this.titleText = new Text({
      text: 'ROYAL JEWEL VAULT',
      style: {
        fill: 0xfacc15,
        fontSize: 32,
        fontWeight: '900',
        fontFamily: 'Georgia, serif',
        letterSpacing: 3,
      },
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(STAGE_WIDTH / 2, 38);

    this.root.addChild(this.bgBase, this.bgBonus, this.titleText);
  }

  async init(mountEl: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: mountEl,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    mountEl.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);
    this.root.addChild(this.fxLayer);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const scale = Math.min(w / STAGE_WIDTH, h / STAGE_HEIGHT);
    this.root.scale.set(scale);
    this.root.position.set((w - STAGE_WIDTH * scale) / 2, (h - STAGE_HEIGHT * scale) / 2);
  }

  setBonusMood(active: boolean): void {
    gsap.to(this.bgBonus, { alpha: active ? 1 : 0, duration: 0.5 });
    this.titleText.text = active ? 'ROYAL FREE SPINS BONUS' : 'ROYAL JEWEL VAULT';
  }

  spawnWinSparkles(count = 24): void {
    for (let i = 0; i < count; i++) {
      const dot = new Graphics().circle(0, 0, 4 + Math.random() * 4).fill(i % 2 === 0 ? 0xfacc15 : 0xff4d6d);
      dot.position.set(STAGE_WIDTH / 2 + (Math.random() - 0.5) * 420, 320 + (Math.random() - 0.5) * 140);
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
