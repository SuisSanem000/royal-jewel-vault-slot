export const LANDSCAPE_WIDTH = 1280;
export const LANDSCAPE_HEIGHT = 720;
export const PORTRAIT_WIDTH = 820;
export const PORTRAIT_HEIGHT = 1060;

export interface StageLayout {
  isPortrait: boolean;
  virtualWidth: number;
  virtualHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Clamps devicePixelRatio to [1, 3] for native 3x mobile Retina & 2K/4K sharpness. */
export function clampDevicePixelRatio(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 1) return 1;
  return Math.min(dpr, 3);
}

/** Computes responsive landscape or portrait virtual stage coordinates anchored cleanly inside the viewport. */
export function computeStageLayout(screenWidth: number, screenHeight: number): StageLayout {
  const w = Math.max(1, Number.isFinite(screenWidth) ? screenWidth : 1);
  const h = Math.max(1, Number.isFinite(screenHeight) ? screenHeight : 1);
  const isPortrait = h > w * 1.05;
  const virtualWidth = isPortrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH;
  const virtualHeight = isPortrait ? PORTRAIT_HEIGHT : LANDSCAPE_HEIGHT;
  const scale = Math.min(w / virtualWidth, h / virtualHeight);

  return {
    isPortrait,
    virtualWidth,
    virtualHeight,
    scale,
    offsetX: (w - virtualWidth * scale) / 2,
    offsetY: (h - virtualHeight * scale) / 2,
  };
}
