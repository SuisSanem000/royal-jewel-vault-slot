#!/usr/bin/env node
/**
 * Asset Normalization Script (Designer Handoff -> Game-Ready Textures)
 *
 * Normalizes inconsistent designer filenames (casing, spaces, missing underscores)
 * and resizes oversized raw PNGs to 512x512 for fast WebGL loading.
 *
 * Usage:
 *   node scripts/normalize-assets.mjs --src ../resources/slot_game_assets
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ASSET_NAME_MAP = {
  'symbol_high_1.png': 'high_ruby.png',
  'symbol_high_2.png': 'high_sapphire.png',
  'symbol_high3.png': 'high_emerald.png',
  'Symbol high_4.png': 'high_amethyst.png',
  'symbol_low_1.png': 'low_a.png',
  'symbol_low_2.png': 'low_k.png',
  'symbol_low_3.png': 'low_q.png',
  'symbol_low4.png': 'low_j.png',
  'symbol_overlay.png': 'symbol_overlay.png',
};

const TARGET_SIZE = 512;
const srcArgIdx = process.argv.indexOf('--src');
const srcDir = resolve(srcArgIdx !== -1 ? process.argv[srcArgIdx + 1] : '../resources/slot_game_assets');
const outDir = resolve('public/assets/symbols');

if (!existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const [rawName, cleanName] of Object.entries(ASSET_NAME_MAP)) {
  const srcPath = join(srcDir, rawName);
  const outPath = join(outDir, cleanName);

  if (!existsSync(srcPath)) {
    console.warn(`Skipping missing asset: ${rawName}`);
    continue;
  }

  copyFileSync(srcPath, outPath);
  execFileSync('sips', ['-Z', String(TARGET_SIZE), outPath], { stdio: 'ignore' });
  console.log(`Normalized: ${rawName} -> ${cleanName} (${TARGET_SIZE}x${TARGET_SIZE})`);
}
