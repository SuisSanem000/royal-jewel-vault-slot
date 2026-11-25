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
  onReset: () => void;
}

interface HudButton {
  container: Container;
  bg: Graphics;
  text: Text;
  w: number;
  h: number;
  radius: number;
  fill: number;
  stroke: number;
}

interface StatBlock {
  label: Text;
  value: Text;
}

function makeButton(
  label: string,
  width: number,
  height: number,
  fill: number,
  stroke: number,
  fontSize = 16,
  radius = 12,
): HudButton {
  const container = new Container();
  const bg = new Graphics();
  const text = new Text({
    text: label,
    style: { fill: 0xfff8dc, fontSize, fontWeight: '700', fontFamily: 'system-ui, sans-serif' },
  });
  text.anchor.set(0.5);
  container.addChild(bg, text);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const btn: HudButton = { container, bg, text, w: width, h: height, radius, fill, stroke };
  redrawButton(btn, width, height, fill, stroke, fontSize);
  return btn;
}

function redrawButton(
  btn: HudButton,
  width: number,
  height: number,
  fill = btn.fill,
  stroke = btn.stroke,
  fontSize?: number,
): void {
  btn.w = width;
  btn.h = height;
  btn.fill = fill;
  btn.stroke = stroke;
  btn.bg
    .clear()
    .roundRect(0, 0, width, height, btn.radius)
    .fill(fill)
    .stroke({ width: 2, color: stroke });
  if (fontSize !== undefined) {
    btn.text.style.fontSize = fontSize;
  }
  btn.text.position.set(width / 2, height / 2);
}

export class HudView extends Container {
  private readonly bar = new Graphics();
  private readonly balanceBlock: StatBlock;
  private readonly betBlock: StatBlock;
  private readonly winBlock: StatBlock;
  private readonly spinBtn: HudButton;
  private readonly autoBtn: HudButton;
  private readonly turboBtn: HudButton;
  private readonly muteBtn: HudButton;
  private readonly infoBtn: HudButton;
  private readonly demoBtn: HudButton;
  private readonly resetBtn: HudButton;
  private readonly refillBtn: HudButton;
  private readonly betDownBtn: HudButton;
  private readonly betUpBtn: HudButton;
  private readonly winCounter = { v: 0 };
  private autoActive = false;
  private turboActive = false;
  private isPortrait = false;

  constructor(callbacks: HudCallbacks) {
    super();

    this.addChild(this.bar);

    this.balanceBlock = this.createStatBlock('BALANCE', '1000.00');
    this.betBlock = this.createStatBlock('BET', '5.00');
    this.winBlock = this.createStatBlock('WIN', '0.00');

    this.betDownBtn = makeButton('-', 38, 38, 0x3b0d22, 0xeab308, 22);
    this.betDownBtn.container.on('pointertap', callbacks.onBetDown);

    this.betUpBtn = makeButton('+', 38, 38, 0x3b0d22, 0xeab308, 22);
    this.betUpBtn.container.on('pointertap', callbacks.onBetUp);

    this.spinBtn = makeButton('SPIN', 170, 62, 0xb91c1c, 0xfacc15, 24);
    this.spinBtn.container.on('pointertap', callbacks.onSpin);

    this.autoBtn = makeButton('AUTO', 84, 44, 0x3b0d22, 0xd97706, 13);
    this.autoBtn.container.on('pointertap', callbacks.onToggleAuto);

    this.turboBtn = makeButton('TURBO', 84, 44, 0x3b0d22, 0xd97706, 13);
    this.turboBtn.container.on('pointertap', callbacks.onToggleTurbo);

    this.infoBtn = makeButton('INFO', 74, 44, 0x3b0d22, 0xd97706, 13);
    this.infoBtn.container.on('pointertap', callbacks.onTogglePaytable);

    this.muteBtn = makeButton('SFX ON', 84, 44, 0x3b0d22, 0xd97706, 13);
    this.muteBtn.container.on('pointertap', callbacks.onToggleMute);

    // Discreet evaluator shortcut to test Bonus Game on demand
    this.demoBtn = makeButton('DEMO BONUS', 120, 32, 0x4c1d95, 0xfacc15, 12);
    this.demoBtn.container.on('pointertap', callbacks.onDemoBonus);

    this.resetBtn = makeButton('RESET', 84, 32, 0x3b0d22, 0xd97706, 12);
    this.resetBtn.container.on('pointertap', callbacks.onReset);

    this.refillBtn = makeButton('REFILL +1000', 130, 32, 0x15803d, 0xfacc15, 12);
    this.refillBtn.container.visible = false;
    this.refillBtn.container.on('pointertap', callbacks.onRefill);

    this.addChild(
      this.betDownBtn.container,
      this.betUpBtn.container,
      this.spinBtn.container,
      this.autoBtn.container,
      this.turboBtn.container,
      this.infoBtn.container,
      this.muteBtn.container,
      this.demoBtn.container,
      this.resetBtn.container,
      this.refillBtn.container,
    );

    this.applyLayout(false);
  }

  private createStatBlock(title: string, initial: string): StatBlock {
    const label = new Text({
      text: title,
      style: { fill: 0xfde68a, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
    });
    const value = new Text({
      text: initial,
      style: { fill: 0xffffff, fontSize: 26, fontWeight: '800' },
    });
    this.addChild(label, value);
    return { label, value };
  }

  private positionStatBlock(block: StatBlock, x: number, labelY: number, valueY: number, centered: boolean, valueSize: number): void {
    const anchorX = centered ? 0.5 : 0;
    block.label.anchor.set(anchorX, 0);
    block.value.anchor.set(anchorX, 0);
    block.label.position.set(x, labelY);
    block.value.style.fontSize = valueSize;
    block.value.position.set(x, valueY);
  }

  setLayout(isPortrait: boolean): void {
    if (this.isPortrait === isPortrait) return;
    this.applyLayout(isPortrait);
  }

  private applyLayout(isPortrait: boolean): void {
    this.isPortrait = isPortrait;

    if (!isPortrait) {
      this.bar
        .clear()
        .roundRect(0, 0, 1180, 96, 18)
        .fill({ color: 0x180610, alpha: 0.92 })
        .stroke({ width: 2, color: 0xd97706, alpha: 0.7 });

      this.positionStatBlock(this.balanceBlock, 28, 18, 38, false, 26);
      this.positionStatBlock(this.betBlock, 300, 18, 38, true, 26);
      this.positionStatBlock(this.winBlock, 445, 18, 38, false, 26);

      this.betDownBtn.container.position.set(212, 29);
      redrawButton(this.betDownBtn, 38, 38, 0x3b0d22, 0xeab308, 22);

      this.betUpBtn.container.position.set(350, 29);
      redrawButton(this.betUpBtn, 38, 38, 0x3b0d22, 0xeab308, 22);

      this.spinBtn.container.position.set(610, 17);
      redrawButton(this.spinBtn, 170, 62, 0xb91c1c, 0xfacc15, 24);

      this.autoBtn.container.position.set(795, 26);
      redrawButton(this.autoBtn, 84, 44, this.autoActive ? 0xb45309 : 0x3b0d22, this.autoActive ? 0xfacc15 : 0xd97706, 13);

      this.turboBtn.container.position.set(889, 26);
      redrawButton(this.turboBtn, 84, 44, this.turboActive ? 0xb45309 : 0x3b0d22, this.turboActive ? 0xfacc15 : 0xd97706, 13);

      this.infoBtn.container.position.set(983, 26);
      redrawButton(this.infoBtn, 74, 44, 0x3b0d22, 0xd97706, 13);

      this.muteBtn.container.position.set(1067, 26);
      redrawButton(this.muteBtn, 84, 44, 0x3b0d22, 0xd97706, 13);

      this.resetBtn.container.position.set(4, -40);
      redrawButton(this.resetBtn, 84, 32, 0x3b0d22, 0xd97706, 12);

      this.refillBtn.container.position.set(98, -40);
      redrawButton(this.refillBtn, 130, 32, 0x15803d, 0xfacc15, 12);

      this.demoBtn.container.position.set(1056, -40);
      redrawButton(this.demoBtn, 120, 32, 0x4c1d95, 0xfacc15, 12);
      return;
    }

    // Portrait layout: 780×352 card with thumb-friendly SPIN & generous touch targets
    this.bar
      .clear()
      .roundRect(0, 0, 780, 352, 22)
      .fill({ color: 0x180610, alpha: 0.94 })
      .stroke({ width: 2, color: 0xd97706, alpha: 0.75 });

    this.positionStatBlock(this.balanceBlock, 120, 20, 44, true, 28);
    this.positionStatBlock(this.betBlock, 390, 20, 44, true, 28);
    this.positionStatBlock(this.winBlock, 660, 20, 44, true, 28);

    this.betDownBtn.container.position.set(264, 24);
    redrawButton(this.betDownBtn, 56, 56, 0x3b0d22, 0xeab308, 28);

    this.betUpBtn.container.position.set(460, 24);
    redrawButton(this.betUpBtn, 56, 56, 0x3b0d22, 0xeab308, 28);

    this.spinBtn.container.position.set(210, 114);
    redrawButton(this.spinBtn, 360, 96, 0xb91c1c, 0xfacc15, 34);

    this.autoBtn.container.position.set(20, 238);
    redrawButton(this.autoBtn, 170, 68, this.autoActive ? 0xb45309 : 0x3b0d22, this.autoActive ? 0xfacc15 : 0xd97706, 17);

    this.turboBtn.container.position.set(210, 238);
    redrawButton(this.turboBtn, 170, 68, this.turboActive ? 0xb45309 : 0x3b0d22, this.turboActive ? 0xfacc15 : 0xd97706, 17);

    this.infoBtn.container.position.set(400, 238);
    redrawButton(this.infoBtn, 170, 68, 0x3b0d22, 0xd97706, 17);

    this.muteBtn.container.position.set(590, 238);
    redrawButton(this.muteBtn, 170, 68, 0x3b0d22, 0xd97706, 17);

    this.resetBtn.container.position.set(0, -48);
    redrawButton(this.resetBtn, 108, 38, 0x3b0d22, 0xd97706, 13);

    this.refillBtn.container.position.set(120, -48);
    redrawButton(this.refillBtn, 160, 38, 0x15803d, 0xfacc15, 13);

    this.demoBtn.container.position.set(632, -48);
    redrawButton(this.demoBtn, 148, 38, 0x4c1d95, 0xfacc15, 13);
  }

  setBalance(balance: number, showRefill: boolean): void {
    this.balanceBlock.value.text = balance.toFixed(2);
    this.refillBtn.container.visible = showRefill;
  }

  setBet(bet: number, locked: boolean): void {
    this.betBlock.value.text = bet.toFixed(2);
    const alpha = locked ? 0.4 : 1;
    const cursor = locked ? 'default' : 'pointer';
    for (const btn of [this.betDownBtn, this.betUpBtn, this.demoBtn, this.resetBtn, this.infoBtn]) {
      btn.container.alpha = alpha;
      btn.container.cursor = cursor;
    }
  }

  setWin(amount: number, animate = true): void {
    gsap.killTweensOf(this.winCounter);
    if (!animate || amount === 0) {
      this.winCounter.v = amount;
      this.winBlock.value.text = amount.toFixed(2);
      return;
    }
    gsap.to(this.winCounter, {
      v: amount,
      duration: 0.65,
      ease: 'power2.out',
      onUpdate: () => {
        this.winBlock.value.text = this.winCounter.v.toFixed(2);
      },
    });
  }

  setSpinLabel(label: string, enabled: boolean): void {
    this.spinBtn.text.text = label;
    this.spinBtn.container.alpha = enabled ? 1 : 0.55;
    this.spinBtn.container.cursor = enabled ? 'pointer' : 'default';
  }

  setAutoActive(active: boolean): void {
    this.autoActive = active;
    this.autoBtn.text.text = active ? 'AUTO ON' : 'AUTO';
    redrawButton(this.autoBtn, this.autoBtn.w, this.autoBtn.h, active ? 0xb45309 : 0x3b0d22, 0xfacc15);
  }

  setTurboActive(active: boolean): void {
    this.turboActive = active;
    this.turboBtn.text.text = active ? 'TURBO ON' : 'TURBO';
    redrawButton(this.turboBtn, this.turboBtn.w, this.turboBtn.h, active ? 0xb45309 : 0x3b0d22, 0xfacc15);
  }

  setMuted(muted: boolean): void {
    this.muteBtn.text.text = muted ? 'MUTED' : 'SFX ON';
  }
}
