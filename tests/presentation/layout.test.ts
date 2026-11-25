import { describe, expect, it } from 'vitest';
import {
  LANDSCAPE_HEIGHT,
  LANDSCAPE_WIDTH,
  PORTRAIT_HEIGHT,
  PORTRAIT_WIDTH,
  clampDevicePixelRatio,
  computeStageLayout,
} from '../../src/presentation/layout';

describe('computeStageLayout', () => {
  it('uses landscape virtual box for desktop widescreen and ultrawide', () => {
    const fhd = computeStageLayout(1920, 1080);
    expect(fhd.isPortrait).toBe(false);
    expect(fhd.virtualWidth).toBe(LANDSCAPE_WIDTH);
    expect(fhd.virtualHeight).toBe(LANDSCAPE_HEIGHT);
    expect(fhd.scale).toBeCloseTo(1.5, 5);
    expect(fhd.offsetX).toBeCloseTo(0, 5);
    expect(fhd.offsetY).toBeCloseTo(0, 5);

    const uw = computeStageLayout(3440, 1440);
    expect(uw.isPortrait).toBe(false);
    expect(uw.scale).toBeCloseTo(2, 5);
    expect(uw.offsetX).toBeCloseTo((3440 - 1280 * 2) / 2, 5);
  });

  it('switches to portrait virtual box on mobile portrait screens and fills width cleanly', () => {
    const iphone = computeStageLayout(390, 844);
    expect(iphone.isPortrait).toBe(true);
    expect(iphone.virtualWidth).toBe(PORTRAIT_WIDTH);
    expect(iphone.virtualHeight).toBe(PORTRAIT_HEIGHT);
    expect(iphone.scale).toBeCloseTo(390 / PORTRAIT_WIDTH, 5);
    expect(iphone.offsetX).toBeCloseTo(0, 5);
    expect(iphone.offsetY).toBeGreaterThan(0);

    const smallMobile = computeStageLayout(375, 667);
    expect(smallMobile.isPortrait).toBe(true);
    expect(smallMobile.virtualWidth * smallMobile.scale).toBeLessThanOrEqual(375.01);
    expect(smallMobile.virtualHeight * smallMobile.scale).toBeLessThanOrEqual(667.01);
  });

  it('keeps landscape layout when phone rotates to landscape or tablet portrait meets threshold', () => {
    const mobileLandscape = computeStageLayout(844, 390);
    expect(mobileLandscape.isPortrait).toBe(false);
    expect(mobileLandscape.virtualWidth).toBe(LANDSCAPE_WIDTH);

    const ipadPortrait = computeStageLayout(768, 1024);
    expect(ipadPortrait.isPortrait).toBe(true);
    expect(ipadPortrait.virtualWidth).toBe(PORTRAIT_WIDTH);
  });

  it('guards against zero or negative viewport dimensions', () => {
    const zero = computeStageLayout(0, 0);
    expect(zero.scale).toBeGreaterThan(0);
    expect(Number.isFinite(zero.offsetX)).toBe(true);
    expect(Number.isFinite(zero.offsetY)).toBe(true);
  });
});

describe('clampDevicePixelRatio', () => {
  it('clamps DPR to [1, 2] for zoom and high-density mobile screens', () => {
    expect(clampDevicePixelRatio(0.5)).toBe(1);
    expect(clampDevicePixelRatio(1)).toBe(1);
    expect(clampDevicePixelRatio(1.5)).toBe(1.5);
    expect(clampDevicePixelRatio(2)).toBe(2);
    expect(clampDevicePixelRatio(3)).toBe(2);
    expect(clampDevicePixelRatio(4)).toBe(2);
    expect(clampDevicePixelRatio(Number.NaN)).toBe(1);
  });
});
