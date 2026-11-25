import gsap from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';

export interface HudCallbacks {
  onSpin: () => void;
  onBetUp: () => void;
  onBetDown: () => void;
  onToggleAuto: () => void;
  onToggleTurbo: () => void;
  onToggleMute: () => void;
  onTogglePaytable: () => void;
  onDemoBonus: () => void;
  onRefill: () => void;
}

function makeButton(
  label: string,
  width: number,
  height: number,
  fill: number,
  stroke: number,
  fontSize = 16,
): { container: Container; bg: Graphics; text: Text } {
  const container = new Container();
  const bg = new Graphics()
    .roundRect(0, 0, width, height, 12)
    .fill(fill)
    .stroke({ width: 2, color: stroke });
  const text = new Text({
    text: label,
    style: { fill: 0xfff8dc, fontSize, fontWeight: '700', fontFamily: 'system-ui, sans-serif' },
  });
  text.anchor.set(0.5);
  text.position.set(width / 2, height / 2);
  container.addChild(bg, text);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return { container, bg, text };
}

export class HudView extends Container {
  private readonly balanceVal: Text;
  private readonly betVal: Text;
  private readonly winVal: Text;
  private readonly spinBtn: ReturnType<typeof makeButton>;
  private readonly autoBtn: ReturnType<typeof makeButton>;
  private readonly turboBtn: ReturnType<typeof makeButton>;
  private readonly muteBtn: ReturnType<typeof makeButton>;
  private readonly demoBtn: ReturnType<typeof makeButton>;
  private readonly refillBtn: ReturnType<typeof makeButton>;
  private readonly betDownBtn: ReturnType<typeof makeButton>;
  private readonly betUpBtn: ReturnType<typeof makeButton>;
  private readonly winCounter = { v: 0 };

  constructor(callbacks: HudCallbacks) {
    super();

    // Bottom bar backdrop
    const bar = new Graphics()
      .roundRect(0, 0, 1180, 96, 18)
      .fill({ color: 0x180610, alpha: 0.92 })
      .stroke({ width: 2, color: 0xd97706, alpha: 0.7 });
    this.addChild(bar);

    this.balanceVal = this.createStatBlock('BALANCE', '1000.00', 28);
    this.betVal = this.createStatBlock('BET', '5.00', 250);
    this.winVal = this.createStatBlock('WIN', '0.00', 475);

    this.betDownBtn = makeButton('-', 42, 42, 0x3b0d22, 0xeab308, 22);
    this.betDownBtn.container.position.set(200, 27);
    this.betDownBtn.container.on('pointertap', callbacks.onBetDown);

    this.betUpBtn = makeButton('+', 42, 42, 0x3b0d22, 0xeab308, 22);
    this.betUpBtn.container.position.set(365, 27);
    this.betUpBtn.container.on('pointertap', callbacks.onBetUp);

    this.spinBtn = makeButton('SPIN', 170, 62, 0xb91c1c, 0xfacc15, 24);
    this.spinBtn.container.position.set(610, 17);
    this.spinBtn.container.on('pointertap', callbacks.onSpin);

    this.autoBtn = makeButton('AUTO', 84, 44, 0x3b0d22, 0xd97706, 13);
    this.autoBtn.container.position.set(795, 26);
    this.autoBtn.container.on('pointertap', callbacks.onToggleAuto);

    this.turboBtn = makeButton('TURBO', 84, 44, 0x3b0d22, 0xd97706, 13);
    this.turboBtn.container.position.set(889, 26);
    this.turboBtn.container.on('pointertap', callbacks.onToggleTurbo);

    const infoBtn = makeButton('INFO', 74, 44, 0x3b0d22, 0xd97706, 13);
    infoBtn.container.position.set(983, 26);
    infoBtn.container.on('pointertap', callbacks.onTogglePaytable);

    this.muteBtn = makeButton('SFX ON', 84, 44, 0x3b0d22, 0xd97706, 13);
    this.muteBtn.container.position.set(1067, 26);
    this.muteBtn.container.on('pointertap', callbacks.onToggleMute);

    // Discreet evaluator shortcut to test Bonus Game on demand
    this.demoBtn = makeButton('DEMO BONUS', 120, 32, 0x4c1d95, 0xfacc15, 12);
    this.demoBtn.container.position.set(1056, -42);
    this.demoBtn.container.on('pointertap', callbacks.onDemoBonus);

    this.refillBtn = makeButton('REFILL +1000', 140, 36, 0x15803d, 0xfacc15, 13);
    this.refillBtn.container.position.set(28, -44);
    this.refillBtn.container.visible = false;
    this.refillBtn.container.on('pointertap', callbacks.onRefill);

    this.addChild(
      this.betDownBtn.container,
      this.betUpBtn.container,
      this.spinBtn.container,
      this.autoBtn.container,
      this.turboBtn.container,
      infoBtn.container,
      this.muteBtn.container,
      this.demoBtn.container,
      this.refillBtn.container,
    );
  }

  private createStatBlock(title: string, initial: string, x: number): Text {
    const label = new Text({
      text: title,
      style: { fill: 0xfde68a, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
    });
    label.position.set(x, 18);

    const value = new Text({
      text: initial,
      style: { fill: 0xffffff, fontSize: 26, fontWeight: '800' },
    });
    value.position.set(x, 38);

    this.addChild(label, value);
    return value;
  }

  setBalance(balance: number, showRefill: boolean): void {
    this.balanceVal.text = balance.toFixed(2);
    this.refillBtn.container.visible = showRefill;
  }

  setBet(bet: number, locked: boolean): void {
    this.betVal.text = bet.toFixed(2);
    this.betDownBtn.container.alpha = locked ? 0.4 : 1;
    this.betUpBtn.container.alpha = locked ? 0.4 : 1;
    this.demoBtn.container.alpha = locked ? 0.4 : 1;
  }

  setWin(amount: number, animate = true): void {
    gsap.killTweensOf(this.winCounter);
    if (!animate || amount === 0) {
      this.winCounter.v = amount;
      this.winVal.text = amount.toFixed(2);
      return;
    }
    gsap.to(this.winCounter, {
      v: amount,
      duration: 0.65,
      ease: 'power2.out',
      onUpdate: () => {
        this.winVal.text = this.winCounter.v.toFixed(2);
      },
    });
  }

  setSpinLabel(label: string, enabled: boolean): void {
    this.spinBtn.text.text = label;
    this.spinBtn.container.alpha = enabled ? 1 : 0.55;
  }

  setAutoActive(active: boolean): void {
    this.autoBtn.text.text = active ? 'AUTO ON' : 'AUTO';
    this.autoBtn.bg
      .clear()
      .roundRect(0, 0, 84, 44, 12)
      .fill(active ? 0xb45309 : 0x3b0d22)
      .stroke({ width: 2, color: 0xfacc15 });
  }

  setTurboActive(active: boolean): void {
    this.turboBtn.text.text = active ? 'TURBO ON' : 'TURBO';
    this.turboBtn.bg
      .clear()
      .roundRect(0, 0, 84, 44, 12)
      .fill(active ? 0xb45309 : 0x3b0d22)
      .stroke({ width: 2, color: 0xfacc15 });
  }

  setMuted(muted: boolean): void {
    this.muteBtn.text.text = muted ? 'MUTED' : 'SFX ON';
  }
}
