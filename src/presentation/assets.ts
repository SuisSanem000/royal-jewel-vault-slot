import { Assets, type Spritesheet, Texture } from 'pixi.js';
import type { SymbolId } from '../core/types';

export interface GameTextures {
  symbols: Record<SymbolId, Texture>;
  overlay: Texture;
}

const FRAME_MAP: Record<Exclude<SymbolId, 'WILD' | 'SCATTER'>, string> = {
  HIGH_RUBY: 'high_ruby.png',
  HIGH_SAPPHIRE: 'high_sapphire.png',
  HIGH_EMERALD: 'high_emerald.png',
  HIGH_AMETHYST: 'high_amethyst.png',
  LOW_A: 'low_a.png',
  LOW_K: 'low_k.png',
  LOW_Q: 'low_q.png',
  LOW_J: 'low_j.png',
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
  const logicalSize = 256;
  const scale = 2; // Render at 512x512 for crisp 3x mobile & 2K/4K displays
  const canvas = document.createElement('canvas');
  canvas.width = logicalSize * scale;
  canvas.height = logicalSize * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const size = logicalSize;
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

  ctx.beginPath();
  drawRoundedRect(ctx, 36, 36, size - 72, size - 72, 26);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 245, 200, 0.5)';
  ctx.stroke();

  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.moveTo(cx, 54);
  ctx.lineTo(cx + 22, 84);
  ctx.lineTo(cx, 102);
  ctx.lineTo(cx - 22, 84);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 44px Georgia, serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3b0814';
  ctx.strokeText(label, cx, 148);
  ctx.fillStyle = '#fff5cc';
  ctx.fillText(label, cx, 148);

  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillStyle = '#ffd966';
  ctx.fillText(sublabel, cx, 188);
  ctx.restore();

  return Texture.from(canvas);
}

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) return;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch {
    // Proceed even if FontFaceSet rejects
  }
}

export async function loadGameTextures(onProgress?: (progress: number) => void): Promise<GameTextures> {
  const entries = Object.entries(FRAME_MAP) as [Exclude<SymbolId, 'WILD' | 'SCATTER'>, string][];
  const symbols = {} as Record<SymbolId, Texture>;
  let overlay: Texture | undefined;

  await waitForFonts();

  try {
    const sheet = await Assets.load<Spritesheet>('./assets/symbols/symbols.json', (p) => {
      onProgress?.(Math.min(1, Math.max(0, p)));
    });
    for (const [id, frameName] of entries) {
      symbols[id] = sheet.textures[frameName];
    }
    overlay = sheet.textures['symbol_overlay.png'];
  } catch {
    // Graceful fallback to individual PNG files if atlas is unavailable
    const urls = [...entries.map(([, f]) => `./assets/symbols/${f}`), './assets/symbols/symbol_overlay.png'];
    const loaded = await Assets.load<Texture>(urls, (p) => {
      onProgress?.(Math.min(1, Math.max(0, p)));
    });
    for (const [id, frameName] of entries) {
      symbols[id] = loaded[`./assets/symbols/${frameName}`];
    }
    overlay = loaded['./assets/symbols/symbol_overlay.png'];
  }

  onProgress?.(1);
  symbols.WILD = createEmblemTexture('WILD', 'SUBSTITUTES ALL', '#d90429', '#590d22');
  symbols.SCATTER = createEmblemTexture('BONUS', 'FREE SPINS', '#7b2cbf', '#240046');

  return {
    symbols,
    overlay: overlay!,
  };
}
