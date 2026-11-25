import { Assets, Texture } from 'pixi.js';
import type { SymbolId } from '../core/types';

export interface GameTextures {
  symbols: Record<SymbolId, Texture>;
  overlay: Texture;
}

const PNG_MAP: Record<Exclude<SymbolId, 'WILD' | 'SCATTER'>, string> = {
  HIGH_RUBY: './assets/symbols/high_ruby.png',
  HIGH_SAPPHIRE: './assets/symbols/high_sapphire.png',
  HIGH_EMERALD: './assets/symbols/high_emerald.png',
  HIGH_AMETHYST: './assets/symbols/high_amethyst.png',
  LOW_A: './assets/symbols/low_a.png',
  LOW_K: './assets/symbols/low_k.png',
  LOW_Q: './assets/symbols/low_q.png',
  LOW_J: './assets/symbols/low_j.png',
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function createEmblemTexture(
  label: string,
  sublabel: string,
  primary: string,
  secondary: string,
): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Outer golden emblem shield
  const cx = size / 2;
  const cy = size / 2;
  const bg = ctx.createRadialGradient(cx, cy - 20, 14, cx, cy, 108);
  bg.addColorStop(0, primary);
  bg.addColorStop(1, secondary);

  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, 22, 22, size - 44, size - 44, 38);
  ctx.fillStyle = bg;
  ctx.fill();

  const border = ctx.createLinearGradient(0, 20, size, size - 20);
  border.addColorStop(0, '#fff3b0');
  border.addColorStop(0.5, '#f5b700');
  border.addColorStop(1, '#b87400');
  ctx.lineWidth = 12;
  ctx.strokeStyle = border;
  ctx.stroke();

  // Inner subtle highlight ring
  ctx.beginPath();
  drawRoundedRect(ctx, 36, 36, size - 72, size - 72, 26);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 245, 200, 0.5)';
  ctx.stroke();

  // Crown / gem icon at top
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.moveTo(cx, 54);
  ctx.lineTo(cx + 22, 84);
  ctx.lineTo(cx, 102);
  ctx.lineTo(cx - 22, 84);
  ctx.closePath();
  ctx.fill();

  // Main label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 44px Georgia, serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3b0814';
  ctx.strokeText(label, cx, 148);
  ctx.fillStyle = '#fff5cc';
  ctx.fillText(label, cx, 148);

  // Sublabel
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillStyle = '#ffd966';
  ctx.fillText(sublabel, cx, 188);
  ctx.restore();

  return Texture.from(canvas);
}

export async function loadGameTextures(): Promise<GameTextures> {
  const entries = Object.entries(PNG_MAP) as [Exclude<SymbolId, 'WILD' | 'SCATTER'>, string][];
  const urls = [...entries.map(([, url]) => url), './assets/symbols/symbol_overlay.png'];
  const loaded = await Assets.load<Texture>(urls);

  const symbols = {} as Record<SymbolId, Texture>;
  for (const [id, url] of entries) {
    symbols[id] = loaded[url];
  }

  symbols.WILD = createEmblemTexture('WILD', 'SUBSTITUTES ALL', '#d90429', '#590d22');
  symbols.SCATTER = createEmblemTexture('BONUS', 'FREE SPINS', '#7b2cbf', '#240046');

  return {
    symbols,
    overlay: loaded['./assets/symbols/symbol_overlay.png'],
  };
}
